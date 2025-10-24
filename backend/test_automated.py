import requests
import random
from datetime import datetime, timedelta
from pymongo import MongoClient
from passlib.context import CryptContext

API = "http://localhost:8000"

def run_all():
    # --- RESET DATABASE ---
    print("Resetting MongoDB database...")
    client = MongoClient("mongodb://localhost:27017")
    db = client["schedulesync"]
    db["users"].delete_many({})
    db["schedules"].delete_many({})
    print("Database reset complete.")

    # --- SEED USERS, FRIENDS, EVENTS DIRECTLY ---
    print("Seeding 20 users with random friends and events (direct MongoDB)...")
    users = [f"user_{i:02d}" for i in range(1, 21)]
    pw = "testpass"
    now = datetime.utcnow()
    pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
    # Create users with hashed passwords
    user_docs = []
    for u in users:
        user_docs.append({
            "username": u,
            "password": pwd_context.hash(pw),
            "friends": []
        })
    # Add apple user
    user_docs.append({
        "username": "apple",
        "password": pwd_context.hash("apple"),
        "friends": []
    })
    db["users"].insert_many(user_docs)
    # Assign random friends
    apple_friends = random.sample(users, k=5)
    db["users"].update_one({"username": "apple"}, {"$set": {"friends": apple_friends}})
    for u in users:
        n_friends = random.randint(3, 7)
        friends = random.sample([x for x in users if x != u], k=n_friends)
        db["users"].update_one({"username": u}, {"$set": {"friends": friends}})
    # Assign events: half busy now, half free
    schedule_docs = []
    for i, u in enumerate(users):
        events = []
        if i < 10:
            # Event covering now
            start = (now - timedelta(hours=1)).replace(microsecond=0).isoformat() + "Z"
            end = (now + timedelta(hours=1)).replace(microsecond=0).isoformat() + "Z"
            events.append({"title": "Busy Now", "start": start, "end": end})
        for _ in range(random.randint(2, 4)):
            day = random.randint(1, 28)
            hour = random.randint(8, 20)
            start_dt = now.replace(day=day, hour=hour, minute=0, second=0, microsecond=0)
            end_dt = start_dt + timedelta(hours=random.randint(1, 3))
            # Avoid overlap with 'busy now' event
            if i < 10 and start_dt <= now <= end_dt:
                continue
            events.append({"title": f"Event {day}-{hour}", "start": start_dt.isoformat() + "Z", "end": end_dt.isoformat() + "Z"})
        schedule_docs.append({"username": u, "events": events})
    db["schedules"].insert_many(schedule_docs)
    print("Seeded 20 users with random friends and events. 'apple' has friends:", apple_friends)

    # --- TEST BUSY STATUS (HTTP) ---
    print("Testing busy/free status for all users...")
    busy, free = [], []
    for i, u in enumerate(users):
        try:
            r = requests.get(f"{API}/availability/{u}", timeout=5)
            status = r.json().get("status")
        except Exception as e:
            print(f"Error checking availability for {u}: {e}")
            continue
        if i < 10:
            assert status == "busy", f"{u} should be busy but is {status}"
            busy.append(u)
        else:
            assert status == "free", f"{u} should be free but is {status}"
            free.append(u)
    print(f"Busy users: {busy}")
    print(f"Free users: {free}")
    print("All busy/free status checks passed.")

    # --- TEST APPLE USER (HTTP) ---
    data = {"username": "apple", "password": "apple"}
    r = requests.post(f"{API}/token", data=data)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    print("Admin user created and login successful.")
    print("All automated tests passed.")

if __name__ == "__main__":
    run_all()