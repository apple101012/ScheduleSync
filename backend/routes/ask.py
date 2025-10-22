# backend/routes/ask.py
from fastapi import APIRouter, Request
from pydantic import BaseModel
import re

router = APIRouter()

class AskRequest(BaseModel):
    question: str

@router.post("/ask")
async def ask(data: AskRequest, request: Request):
    # Simple regex to extract time and day (placeholder for spaCy)
    match = re.search(r'(\w+day|today|tomorrow)[^\d]*(\d{1,2}(?::\d{2})?\s*(am|pm)?)?', data.question, re.IGNORECASE)
    day = match.group(1) if match else None
    time = match.group(2) if match else None
    # Placeholder: always returns all users as free
    users = await request.app.mongodb["users"].find().to_list(100)
    usernames = [u["username"] for u in users]
    return {"free_users": usernames, "day": day, "time": time}
