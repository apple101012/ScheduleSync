"""Seed the MongoDB with many fake users and schedules for testing.
Run inside the backend container to ensure bcrypt/pymongo versions match.
"""
import os
import random
import json
from datetime import datetime, timedelta

from pymongo import MongoClient
from bson.objectid import ObjectId
import bcrypt

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://mongo:27017')
DB_NAME = os.environ.get('MONGO_DB', 'schedulesync')

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Remove existing sample users and schedules
print('Clearing old sample data...')
db.users.delete_many({})
db.schedules.delete_many({})

# Helper
def rand_username(i):
    return f'user{i:04d}'

# Create N users (ensure 'apple' exists)
N_USERS = int(os.environ.get('SEED_USERS', '50'))
N_EVENTS_PER_USER = int(os.environ.get('SEED_EVENTS_PER_USER', '8'))

users = []
# Add apple user first with known password
apple_pwd = 'apple'
apple_hash = bcrypt.hashpw(apple_pwd.encode()[:72], bcrypt.gensalt()).decode()
users.append({'username': 'apple', 'email': 'apple@example.com', 'password_hash': apple_hash, 'friends': []})

# Generate remaining users (start numbering at 2 because apple is present)
for i in range(1, N_USERS):
    uname = rand_username(i+1)
    # avoid duplicating 'apple'
    if uname == 'apple':
        continue
    pwd = f'password{i+1}'
    pw_hash = bcrypt.hashpw(pwd.encode()[:72], bcrypt.gensalt()).decode()
    users.append({'username': uname, 'email': f'{uname}@example.com', 'password_hash': pw_hash, 'friends': []})

# insert users
print(f'Inserting {len(users)} users...')
db.users.insert_many(users)

# Print 5 sample user credentials for manual testing
print('\nSample users (username : password):')
# Print 'apple' explicitly first
print('apple : apple')
for i in range(1, min(5, len(users))):
    # users[0] is apple, other users' passwords use the password{i+1} pattern
    uname = users[i]['username']
    print(f"{uname} : password{i+1}")

# Build random friendships
print('Creating friend links...')
all_usernames = [u['username'] for u in users]
for u in all_usernames:
    friends = random.sample(all_usernames, k=min(6, len(all_usernames)))
    friends = [f for f in friends if f != u][:4]
    db.users.update_one({'username': u}, {'$set': {'friends': friends}})

# Create schedules with events for each user in October 2025
print('Creating schedules for October 2025...')
oct_start = datetime(2025, 10, 1, 8, 0, 0)
for u in all_usernames:
    events = []
    for j in range(N_EVENTS_PER_USER):
        day = random.randint(1, 31)
        hour = random.choice([8,9,10,11,13,14,15,16])
        st = datetime(2025, 10, day, hour, 0, 0)
        # random duration 1-2 hours (allow 1.5 as 90 minutes)
        dur = random.choice([60, 90, 120])
        en = st + timedelta(minutes=dur)
        ev = {
            '_id': str(ObjectId()),
            'title': random.choice(['Math','Meeting','Gym','Lunch','Study','Call','Focus time','Project']) + f' #{j+1}',
            'start': st.isoformat(),
            'end': en.isoformat()
        }
        events.append(ev)
    db.schedules.update_one({'username': u}, {'$set': {'username': u, 'events': events}}, upsert=True)

print('Seeding complete.')
