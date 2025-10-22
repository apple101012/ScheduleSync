
# backend/routes/ask.py
from fastapi import APIRouter, Request
from pydantic import BaseModel
import re
from models import ScheduleModel

router = APIRouter()

class AskRequest(BaseModel):
    question: str

@router.post("/ask")
async def ask(data: AskRequest, request: Request):
    # Simple regex to extract day and time (can be replaced with spaCy later)
    match = re.search(r'(\w+day|today|tomorrow)[^\d]*(\d{1,2}(?::\d{2})?\s*(am|pm)?)?', data.question, re.IGNORECASE)
    day = match.group(1).lower() if match and match.group(1) else None
    time_str = match.group(2) if match and match.group(2) else None

    # Convert time to 24h format for comparison
    def parse_time(t):
        import datetime
        if not t:
            return None
        t = t.strip().lower()
        try:
            if 'am' in t or 'pm' in t:
                return datetime.datetime.strptime(t, '%I:%M %p').time() if ':' in t else datetime.datetime.strptime(t, '%I %p').time()
            return datetime.datetime.strptime(t, '%H:%M').time() if ':' in t else datetime.datetime.strptime(t, '%H').time()
        except Exception:
            return None

    query_time = parse_time(time_str)

    # Get all users and their friends
    users = await request.app.mongodb["users"].find().to_list(100)
    schedules = await request.app.mongodb["schedules"].find().to_list(100)

    # Build a map of username -> schedule events
    schedule_map = {s['username']: s.get('events', []) for s in schedules}

    free_users = []
    busy_users = []

    for user in users:
        username = user['username']
        events = schedule_map.get(username, [])
        is_free = True
        if day and query_time:
            for event in events:
                # Compare day (case-insensitive)
                if event.get('day', '').lower() == day:
                    # Parse event start/end
                    start = parse_time(event.get('start_time'))
                    end = parse_time(event.get('end_time'))
                    if start and end and start <= query_time < end:
                        if event.get('status', '').lower() != 'free':
                            is_free = False
                            break
        # If no events or not busy at that time, user is free
        if is_free:
            free_users.append(username)
        else:
            busy_users.append(username)

    return {
        "free_users": free_users,
        "busy_users": busy_users,
        "day": day,
        "time": time_str
    }
