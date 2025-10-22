# backend/routes/user.py
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from ..models import UserModel
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
    if not user or not pwd_context.verify(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    payload = {
        "sub": user["username"],
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer"}
