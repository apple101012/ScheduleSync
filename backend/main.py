import os
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from typing import List, Optional
import logging

# Debug logging setup
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
JWT_SECRET = os.getenv("JWT_SECRET", "devsecret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
@app.on_event("startup")
async def startup_db_client():
    logger.debug("Connecting to MongoDB at %s", MONGO_URI)
    app.mongodb_client = AsyncIOMotorClient(MONGO_URI)
    app.mongodb = app.mongodb_client["schedulesync"]

@app.on_event("shutdown")
async def shutdown_db_client():
    logger.debug("Closing MongoDB connection")
    app.mongodb_client.close()

# Password hashing (switch to pbkdf2_sha256 for compatibility)
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    # pbkdf2_sha256 supports arbitrary length passwords
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    # pbkdf2_sha256 supports arbitrary length passwords
    return pwd_context.hash(password)

# JWT helpers
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")

# Models
class User(BaseModel):
    username: str
    password: str
    friends: Optional[List[str]] = []

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class Event(BaseModel):
    title: str
    start: str
    end: str

class Schedule(BaseModel):
    username: str
    events: List[Event]

# Dependency
def get_db(request: Request):
    return request.app.mongodb

# Auth utils
async def authenticate_user(db, username: str, password: str):
    user = await db["users"].find_one({"username": username})
    if not user:
        return False
    if not verify_password(password, user["password"]):
        return False
    return user

async def get_current_user(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = await db["users"].find_one({"username": username})
    if user is None:
        raise credentials_exception
    return user

# Routes
@app.post("/register")
async def register(user: User, db=Depends(get_db)):
    logger.debug(f"Registering user: {user.username}")
    logger.debug(f"Password type: {type(user.password)}, length: {len(user.password) if isinstance(user.password, str) else 'n/a'}")
    if isinstance(user.password, str):
        pw_bytes = user.password.encode('utf-8')
    else:
        pw_bytes = user.password
    logger.debug(f"Password bytes length: {len(pw_bytes)} (will use first 72 bytes for bcrypt)")
    if await db["users"].find_one({"username": user.username}):
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed = get_password_hash(user.password)
    await db["users"].insert_one({"username": user.username, "password": hashed, "friends": user.friends})
    return {"msg": "User registered"}

@app.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db=Depends(get_db)):
    logger.debug(f"Login attempt: {form_data.username}")
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/me")
async def read_users_me(current_user=Depends(get_current_user)):
    logger.debug(f"Current user: {current_user['username']}")
    return {"username": current_user["username"], "friends": current_user.get("friends", [])}


@app.post("/event")
async def create_event(event: Event, current_user=Depends(get_current_user), db=Depends(get_db)):
    logger.debug(f"User {current_user['username']} creating event: {event}")
    await db["schedules"].update_one(
        {"username": current_user["username"]},
        {"$push": {"events": event.dict()}},
        upsert=True
    )
    return {"msg": "Event created"}

# Delete event endpoint
from fastapi import Body
@app.delete("/event")
async def delete_event(event: Event = Body(...), current_user=Depends(get_current_user), db=Depends(get_db)):
    logger.debug(f"User {current_user['username']} deleting event: {event}")
    result = await db["schedules"].update_one(
        {"username": current_user["username"]},
        {"$pull": {"events": event.dict()}}
    )
    if result.modified_count == 0:
        logger.debug("No event deleted (event not found or already removed)")
        return {"msg": "No event deleted (not found)"}
    return {"msg": "Event deleted"}

@app.get("/schedule/{username}")
async def get_schedule(username: str, db=Depends(get_db)):
    logger.debug(f"Fetching schedule for: {username}")
    sched = await db["schedules"].find_one({"username": username})
    if not sched:
        return {"username": username, "events": []}
    sched.pop('_id', None)
    return sched

@app.get("/availability/{username}")
async def get_availability(username: str, db=Depends(get_db)):
    logger.debug(f"Checking availability for: {username}")
    from datetime import datetime, timezone
    import dateutil.parser
    try:
        sched = await db["schedules"].find_one({"username": username})
        logger.debug(f"Fetched schedule: {sched}")
        if not sched or len(sched.get("events", [])) == 0:
            return {"username": username, "status": "free"}
        now = datetime.now(timezone.utc)
        for ev in sched.get("events", []):
            try:
                logger.debug(f"Parsing event: {ev}")
                start = dateutil.parser.isoparse(ev["start"])
                end = dateutil.parser.isoparse(ev["end"])
                if start.tzinfo is None:
                    start = start.replace(tzinfo=timezone.utc)
                if end.tzinfo is None:
                    end = end.replace(tzinfo=timezone.utc)
                if start <= now <= end:
                    logger.debug(f"User {username} is busy at {now}")
                    return {"username": username, "status": "busy"}
            except Exception as e:
                logger.error(f"Error parsing event: {ev}, error: {e}")
                continue
        logger.debug(f"User {username} is free at {now}")
        return {"username": username, "status": "free"}
    except Exception as e:
        logger.error(f"Exception in /availability: {e}")
        return {"error": str(e), "username": username, "status": "error"}

@app.get("/debug/users")
async def debug_users(db=Depends(get_db)):
    users = []
    async for u in db["users"].find({}):
        users.append(u["username"])
    logger.debug(f"All users: {users}")
    return {"users": users}

@app.get("/debug/schedules")
async def debug_schedules(db=Depends(get_db)):
    schedules = []
    async for s in db["schedules"].find({}):
        schedules.append({"username": s["username"], "events": s.get("events", [])})
    logger.debug(f"All schedules: {schedules}")
    return {"schedules": schedules}

# Health check
@app.get("/health")
async def health():
    logger.debug("Health check OK")
    return {"status": "ok"}
