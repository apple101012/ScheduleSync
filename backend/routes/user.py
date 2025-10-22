# backend/routes/user.py
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from models import UserModel
from fastapi import Request
import os

router = APIRouter()

SECRET_KEY = os.getenv("JWT_SECRET", "changeme")
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str

class AddFriendRequest(BaseModel):
    username: str
    friend: str

@router.post("/register")
async def register(data: RegisterRequest, request: Request):
    user = await request.app.mongodb["users"].find_one({"username": data.username})
    if user:
        raise HTTPException(status_code=400, detail="Username already exists")
    hashed = pwd_context.hash(data.password)
    user_doc = UserModel(
        username=data.username,
        email=data.email,
        password_hash=hashed,
        friends=[]
    ).dict()
    await request.app.mongodb["users"].insert_one(user_doc)
    return {"msg": "User registered successfully"}


@router.post("/login")
async def login(data: LoginRequest, request: Request):
    user = await request.app.mongodb["users"].find_one({"username": data.username})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    # DEV ONLY: Hardcoded password check for demo/testing
    if data.password not in ["apple", "password123"]:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    payload = {
        "sub": user["username"],
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer"}


# Add friend route for frontend
@router.post("/user/add-friend")
async def add_friend(data: AddFriendRequest, request: Request):
    user = await request.app.mongodb["users"].find_one({"username": data.username})
    friend = await request.app.mongodb["users"].find_one({"username": data.friend})
    if not user or not friend:
        raise HTTPException(status_code=404, detail="User or friend not found")
    if data.friend in user.get("friends", []):
        return {"msg": "Already friends"}
    await request.app.mongodb["users"].update_one(
        {"username": data.username},
        {"$push": {"friends": data.friend}}
    )
    return {"msg": f"Added {data.friend} as a friend"}
