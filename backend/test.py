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

    # Create sample users with bcrypt hashes
    users = [
        {"username": "alice", "email": "alice@example.com", "password_hash": bcrypt_hash("password123"), "friends": ["bob", "carol"]},
        {"username": "bob", "email": "bob@example.com", "password_hash": bcrypt_hash("password123"), "friends": ["alice"]},
        {"username": "carol", "email": "carol@example.com", "password_hash": bcrypt_hash("password123"), "friends": ["alice"]},
        {"username": "apple", "email": "apple@example.com", "password_hash": bcrypt_hash("apple"), "friends": []}
    ]

    result = await db.users.insert_many(users)
    print(f"Inserted {len(result.inserted_ids)} users")

    schedules = [
        {"username": "alice", "events": [
            {"day": "monday", "start_time": "09:00", "end_time": "11:00", "status": "class"},
            {"day": "friday", "start_time": "15:00", "end_time": "17:00", "status": "work"}
        ]},
        {"username": "bob", "events": [
            {"day": "friday", "start_time": "14:00", "end_time": "16:00", "status": "class"}
        ]},
        {"username": "carol", "events": [
            {"day": "friday", "start_time": "15:00", "end_time": "18:00", "status": "work"}
        ]},
        {"username": "apple", "events": []}
    ]

    res2 = await db.schedules.insert_many(schedules)
    print(f"Inserted {len(res2.inserted_ids)} schedules")
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
