# backend/routes/schedule.py
from fastapi import APIRouter, HTTPException, Depends, Request
from models import ScheduleModel
from pydantic import BaseModel
from bson import ObjectId

router = APIRouter()


class ScheduleRequest(BaseModel):
    username: str
    events: list


class EventCreateRequest(BaseModel):
    title: str
    start: str  # ISO datetime
    end: str


class EventUpdateRequest(BaseModel):
    title: str | None = None
    start: str | None = None
    end: str | None = None


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
        # return empty schedule
        return {"username": username, "events": []}
    # Remove MongoDB _id field (ObjectId is not serializable)
    sched.pop('_id', None)
    return sched


@router.post("/events/{username}")
async def create_event(username: str, data: EventCreateRequest, request: Request):
    # create event with generated id
    event = {"_id": str(ObjectId()), "title": data.title, "start": data.start, "end": data.end}
    await request.app.mongodb["schedules"].update_one(
        {"username": username},
        {"$push": {"events": event}},
        upsert=True
    )
    return {"event": event}


@router.put("/events/{username}/{event_id}")
async def update_event(username: str, event_id: str, data: EventUpdateRequest, request: Request):
    sched = await request.app.mongodb["schedules"].find_one({"username": username})
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    updated = False
    for ev in sched.get("events", []):
        if ev.get("_id") == event_id:
            if data.title is not None:
                ev["title"] = data.title
            if data.start is not None:
                ev["start"] = data.start
            if data.end is not None:
                ev["end"] = data.end
            updated = True
            break
    if not updated:
        raise HTTPException(status_code=404, detail="Event not found")
    await request.app.mongodb["schedules"].replace_one({"username": username}, sched)
    return {"event": ev}


@router.delete("/events/{username}/{event_id}")
async def delete_event(username: str, event_id: str, request: Request):
    await request.app.mongodb["schedules"].update_one({"username": username}, {"$pull": {"events": {"_id": event_id}}})
    return {"msg": "deleted"}


@router.get("/availability/{username}")
async def get_availability(username: str, request: Request):
    # Improved rule: busy if any event overlaps with current time, else free
    from datetime import datetime, timezone
    import dateutil.parser
    sched = await request.app.mongodb["schedules"].find_one({"username": username})
    if not sched or len(sched.get("events", [])) == 0:
        return {"username": username, "status": "free"}
    now = datetime.now(timezone.utc)
    for ev in sched.get("events", []):
        try:
            start = dateutil.parser.isoparse(ev["start"])
            end = dateutil.parser.isoparse(ev["end"])
            # If no tzinfo, assume UTC
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            if end.tzinfo is None:
                end = end.replace(tzinfo=timezone.utc)
            # Debug log
            # print(f"Checking event: {start} to {end} against now: {now}")
            if start <= now <= end:
                return {"username": username, "status": "busy"}
        except Exception as e:
            # print(f"Error parsing event: {ev}, error: {e}")
            continue
    return {"username": username, "status": "free"}
