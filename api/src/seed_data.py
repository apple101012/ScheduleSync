# api/src/seed_data.py
import os
import sys
import random
import string
import time
import datetime as dt
from zoneinfo import ZoneInfo

import requests

API_BASE = os.environ.get("API_BASE", "http://localhost:8000")
SEED_KEY = os.environ.get("SEED_KEY", "dev-seed-only-change-me")  # must match API .env

TZ = ZoneInfo("America/New_York")

ADMIN_EMAIL = "apple@apple.com"
ADMIN_PASS  = "apple"
ADMIN_NAME  = "Admin Apple"

SAMPLE_COUNT = 20
SAMPLE_NAME_WORDS = [
    "Alex","Jordan","Sam","Taylor","Casey","Riley","Morgan","Jamie","Avery","Drew",
    "Quinn","Skyler","Cameron","Parker","Rowan","Reese","Bailey","Emerson","Hayden","Kendall",
]

def warn_and_confirm():
    print("="*70)
    print(" SEEDING WARNING")
    print("- This will DELETE and RECREATE:")
    print(f"   - Admin: {ADMIN_EMAIL}")
    print(f"   - {SAMPLE_COUNT} sample users with random schedules in the current week")
    print(" - Admin will be friended with every sample user")
    print(" - Existing accounts with same emails will be removed first")
    print("-"*70)
    print(f" API_BASE = {API_BASE}")
    print(" To continue, type YES (all caps) and press Enter.")
    print("="*70)
    choice = input("> ")
    if choice.strip() != "YES":
        print("Aborted.")
        sys.exit(0)

def api_get(path, token=None):
    r = requests.get(API_BASE + path, headers={"Authorization": f"Bearer {token}"} if token else None)
    if r.status_code >= 400:
        raise RuntimeError(f"GET {path}: {r.status_code} {r.text}")
    return r.json() if r.text else None

def api_post(path, body=None, token=None, extra_headers=None):
    headers = {"Content-Type": "application/json"}
    if token: headers["Authorization"] = f"Bearer {token}"
    if extra_headers: headers.update(extra_headers)
    r = requests.post(API_BASE + path, json=body or {}, headers=headers)
    if r.status_code >= 400:
        raise RuntimeError(f"POST {path}: {r.status_code} {r.text}")
    return r.json() if r.text else None

def api_delete(path, token=None, extra_headers=None):
    headers = {}
    if token: headers["Authorization"] = f"Bearer {token}"
    if extra_headers: headers.update(extra_headers)
    r = requests.delete(API_BASE + path, headers=headers)
    if r.status_code >= 400:
        raise RuntimeError(f"DELETE {path}: {r.status_code} {r.text}")
    return r.json() if r.text else None

def delete_by_email(email):
    # Seed-key protected destructive endpoint
    return api_delete(f"/users/by-email?email={email}", extra_headers={"X-Seed-Key": SEED_KEY})

def register(email, password, name):
    return api_post("/auth/register", {"email": email, "password": password, "name": name})

def login(email, password):
    return api_post("/auth/login", {"email": email, "password": password})

def make_admin(user_id):
    return api_post("/users/make-admin", {"userId": user_id}, extra_headers={"X-Seed-Key": SEED_KEY})

def add_friend(token, friend_id):
    # Adjust path/payload to your existing friends API
    return api_post("/friends/add", {"friendId": friend_id}, token=token)

def add_event(token, title, start_iso, end_iso, description=""):
    # Adjust to your existing events route shape if needed
    body = {"title": title, "start": start_iso, "end": end_iso, "description": description}
    return api_post("/events", body, token=token)

def random_email():
    # unique-ish email to avoid collisions across runs; still deleted if exists
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"user_{suffix}@example.com"

def random_name():
    return random.choice(SAMPLE_NAME_WORDS) + " " + random.choice(["Lee", "Rivera", "Singh", "Chen", "Patel", "Diaz", "Kim", "Nguyen", "Brown", "Miller"])

def week_bounds_today():
    now = dt.datetime.now(TZ)
    # start of this week (Mon 00:00)
    start = (now - dt.timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + dt.timedelta(days=7)
    return start, end

def rnd_event_blocks_for_week():
    """
    Generate 5–10 random events Mon–Fri between 9:00–19:00, 1–3 hours each.
    Return list of (title, start_iso, end_iso).
    """
    week_start, _ = week_bounds_today()
    events = []
    n = random.randint(5, 10)

    for _ in range(n):
        day_offset = random.randint(0, 6)  # Sun–Sat; change to 0-4 for Mon–Fri
        hour = random.randint(9, 18)       # start hour
        dur_hours = random.randint(1, 3)

        start_dt = (week_start + dt.timedelta(days=day_offset)).replace(hour=hour, minute=0, second=0, microsecond=0)
        end_dt = start_dt + dt.timedelta(hours=dur_hours)

        # Titles
        title = random.choice([
            "Class", "Study Session", "Gym", "Work Shift", "Meeting",
            "Project Time", "Lab", "Office Hours", "Group Study", "Break"
        ])
        events.append((
            title,
            start_dt.isoformat(),
            end_dt.isoformat()
        ))
    return events

def main():
    warn_and_confirm()

    # 1) (Re)create admin
    print(f"[seed] Reset admin {ADMIN_EMAIL}")
    delete_by_email(ADMIN_EMAIL)  # ignore result
    reg = register(ADMIN_EMAIL, ADMIN_PASS, ADMIN_NAME)
    admin_token = reg["token"]
    admin = reg["user"]
    make_admin(admin["id"])
    print(f"[seed] Admin created: {admin['email']} (id={admin['id']})")

    # 2) Create 20 users with random schedules
    created_users = []
    for i in range(SAMPLE_COUNT):
        name = random_name()
        email = random_email()
        password = "password123"

        # delete if exists (probably won’t since email is random, but consistent behavior)
        delete_by_email(email)

        r = register(email, password, name)
        token = r["token"]
        user = r["user"]
        print(f"[seed] User {i+1}/{SAMPLE_COUNT}: {user['email']} (id={user['id']})")

        # random events
        for (title, s_iso, e_iso) in rnd_event_blocks_for_week():
            add_event(token, title, s_iso, e_iso, description="Seeded")

        created_users.append(user)

    # 3) Admin auto-friends everyone
    print(f"[seed] Admin friending {len(created_users)} users…")
    for u in created_users:
        add_friend(admin_token, u["id"])
    print("[seed] Done.")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("ERROR:", e)
        sys.exit(1)
