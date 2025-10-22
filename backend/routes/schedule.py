# backend/routes/schedule.py
from fastapi import APIRouter, HTTPException, Depends, Request
from models import ScheduleModel
from pydantic import BaseModel

router = APIRouter()

class ScheduleRequest(BaseModel):
    username: str
    events: list

@router.post("/schedule")
async def save_schedule(data: ScheduleRequest, request: Request):
    await request.app.mongodb["schedules"].replace_one(
        {"username": data.username},
        {"username": data.username, "events": data.events},
        upsert=True
    )
    return {"msg": "Schedule saved"}

@router.get("/schedule/{username}")
async def get_schedule(username: str, request: Request):
    sched = await request.app.mongodb["schedules"].find_one({"username": username})
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return sched

@router.get("/availability/{username}")
async def get_availability(username: str, request: Request):
    # Placeholder: always returns free
    return {"username": username, "status": "free"}
