"""Small developer utility for quick Python/Mongo tasks.

Usage (run inside the backend container or locally with the same env):

# Show users
python backend/test.py show-users

# Hash a password
python backend/test.py hash password123

# Verify username/password against DB
python backend/test.py verify alice password123

# Insert/reset sample data (creates alice,bob,carol,apple)
python backend/test.py insert-sample

"""

import os
import asyncio
import argparse
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "schedulesync")

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

def bcrypt_hash(password: str) -> str:
    # bcrypt in this environment expects bytes and will produce a hash compatible with passlib
    pw = password.encode('utf-8')[:72]
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode('utf-8')

async def get_db():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[MONGO_DB]
    return client, db

async def show_users():
    client, db = await get_db()
    print("Users in DB:")
    async for u in db.users.find({}):
        print(f"- {u.get('username')}: {u.get('password_hash')}")
    client.close()

async def hash_password(pw: str):
    print(bcrypt_hash(pw))

async def verify_user(username: str, password: str):
    client, db = await get_db()
    u = await db.users.find_one({"username": username})
    if not u:
        print("User not found")
        client.close()
        return
    ph = u.get("password_hash")
    ok = False
    if ph:
        try:
            ok = pwd.verify(password, ph)
        except Exception as e:
            print("Warning: hash verify failed, falling back to plaintext compare:", e)
            ok = (password == ph)
    else:
        ok = False
    print("Verified:", ok)
    client.close()

async def insert_sample():
    client, db = await get_db()
    print("Resetting sample data...")
    await db.users.delete_many({})
    await db.schedules.delete_many({})

    import random
    from bson import ObjectId

    # Generate 20+ friends for apple
    friend_count = 25
    apple_friends = [f"friend{i}" for i in range(1, friend_count+1)]
    # Add a 'busy friend' who is always busy
    busy_friend_username = "busy friend"
    users = [
        {"username": "alice", "email": "alice@example.com", "password_hash": bcrypt_hash("password123"), "friends": ["bob", "carol"]},
        {"username": "bob", "email": "bob@example.com", "password_hash": bcrypt_hash("password123"), "friends": ["alice"]},
        {"username": "carol", "email": "carol@example.com", "password_hash": bcrypt_hash("password123"), "friends": ["alice"]},
        {"username": "apple", "email": "apple@example.com", "password_hash": bcrypt_hash("apple"), "friends": apple_friends + [busy_friend_username]},
        {"username": busy_friend_username, "email": "busyfriend@example.com", "password_hash": bcrypt_hash("password123"), "friends": ["apple"]}
    ]
    for f in apple_friends:
        users.append({"username": f, "email": f"{f}@example.com", "password_hash": bcrypt_hash("password123"), "friends": ["apple"]})
    print(f"Usernames to be inserted: {[u['username'] for u in users]}")
    if busy_friend_username not in [u['username'] for u in users]:
        raise Exception("'busy friend' is missing from users list before insertion!")

    result = await db.users.insert_many(users)
    print(f"Inserted {len(result.inserted_ids)} users: {[u['username'] for u in users]}")
    # Double-check after insert
    inserted_usernames = [u['username'] for u in users]
    if busy_friend_username not in inserted_usernames:
        print("Warning: 'busy friend' was not inserted!")
    else:
        print("'busy friend' successfully included in inserted users.")

    # Helper to generate random event
    def random_event():
        # Random day in October 2025
        day = random.randint(1, 31)
        start_hour = random.randint(8, 20)
        duration = random.randint(1, 3)
        start = datetime(2025, 10, day, start_hour, random.choice([0, 15, 30, 45]))
        end = start.replace(hour=min(start.hour+duration, 23))
        return {
            "_id": str(ObjectId()),
            "title": random.choice(["Meeting", "Class", "Work", "Gym", "Call", "Study", "Lunch", "Project", "Break", "Appointment"]),
            "start": start.isoformat(),
            "end": end.isoformat()
        }

    # Helper to generate a busy event for today (current time, system clock, in October 2025)
    def busy_event_now():
        now = datetime.now()
        # Always set year/month to 2025-10, but use current day/hour
        start = datetime(2025, 10, now.day, now.hour, 0, 0)
        end = start.replace(hour=min(start.hour+2, 23))
        return {
            "_id": str(ObjectId()),
            "title": "Busy Now",
            "start": start.isoformat(),
            "end": end.isoformat()
        }

    # Helper to generate a 24/7 busy event for the whole of October 2025
    def always_busy_event():
        start = datetime(2025, 10, 1, 0, 0, 0)
        end = datetime(2025, 10, 31, 23, 59, 59)
        return {
            "_id": str(ObjectId()),
            "title": "Busy All Week",
            "start": start.isoformat(),
            "end": end.isoformat()
        }

    # Helper to generate a free schedule (no event at current time)
    def free_events():
        # All events are outside current hour
        now = datetime.now()
        events = []
        for _ in range(20):
            # Pick a random hour not equal to now.hour
            hour = random.choice([h for h in range(8, 20) if h != now.hour])
            day = random.randint(1, 31)
            start = datetime(2025, 10, day, hour, 0)
            end = start.replace(hour=min(hour+2, 23))
            events.append({
                "_id": str(ObjectId()),
                "title": random.choice(["Meeting", "Class", "Work", "Gym", "Call", "Study", "Lunch", "Project", "Break", "Appointment"]),
                "start": start.isoformat(),
                "end": end.isoformat()
            })
        return events


    schedules = [
        {"username": "alice", "events": [random_event() for _ in range(5)]},
        {"username": "bob", "events": [random_event() for _ in range(5)]},
        {"username": "carol", "events": [random_event() for _ in range(5)]},
        {"username": "apple", "events": []},
        {"username": busy_friend_username, "events": [always_busy_event()]}
    ]

    # Guarantee friend1, friend2, friend3 are busy right now (on current system day/hour in October 2025)
    hardcoded_busy = {"friend1", "friend2", "friend3"}
    random.shuffle(apple_friends)
    half = len(apple_friends) // 2
    for i, f in enumerate(apple_friends):
        if f in hardcoded_busy:
            # Always busy now (on current system day/hour in October 2025)
            events = [busy_event_now()] + [random_event() for _ in range(19)]
        elif i < half:
            # Busy now (randomized)
            events = [busy_event_now()] + [random_event() for _ in range(19)]
        else:
            # Free now
            events = free_events()
        schedules.append({"username": f, "events": events})

    res2 = await db.schedules.insert_many(schedules)
    print(f"Inserted {len(res2.inserted_ids)} schedules.")
    # Print all users in DB for verification
    print("Current users in DB after insert:")
    async for u in db.users.find({}):
        print(f"- {u.get('username')}")
    client.close()


def main():
    parser = argparse.ArgumentParser(description="Dev test helper for ScheduleSync backend")
    sub = parser.add_subparsers(dest='cmd')

    sub.add_parser('show-users')
    h = sub.add_parser('hash')
    h.add_argument('password')
    v = sub.add_parser('verify')
    v.add_argument('username')
    v.add_argument('password')
    sub.add_parser('insert-sample')

    args = parser.parse_args()
    if args.cmd == 'show-users':
        asyncio.run(show_users())
    elif args.cmd == 'hash':
        asyncio.run(hash_password(args.password))
    elif args.cmd == 'verify':
        asyncio.run(verify_user(args.username, args.password))
    elif args.cmd == 'insert-sample':
        asyncio.run(insert_sample())
    else:
        parser.print_help()

if __name__ == '__main__':
    main()
