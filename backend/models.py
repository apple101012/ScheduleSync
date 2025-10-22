// backend/models.py
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

class UserModel(BaseModel):
    username: str = Field(...)
    email: EmailStr
    password_hash: str
    friends: Optional[List[str]] = []

class EventModel(BaseModel):
    day: str
    start_time: str  # e.g. '14:00'
    end_time: str    # e.g. '15:30'
    status: str      # e.g. 'class', 'work', 'free'

class ScheduleModel(BaseModel):
    username: str
    events: List[EventModel]
