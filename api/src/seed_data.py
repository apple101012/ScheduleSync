# seed_data.py
import time
import requests
from datetime import datetime, timedelta, timezone

BASE = "http://localhost:8000"

USERS = [
    {"name": "You", "email": "me@example.com", "password": "secret123"},
    {"name": "Alice", "email": "alice@example.com", "password": "secret123"},
    {"name": "Bob", "email": "bob@example.com", "password": "secret123"},
]

def post(path, json=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token: headers["Authorization"] = f"Bearer {token}"
    r = requests.post(BASE + path, json=json or {}, headers=headers)
    if r.status_code >= 400:
        raise RuntimeError(f"POST {path}: {r.status_code} {r.text}")
    return r.json()

def get(path, token=None):
    headers = {}
    if token: headers["Authorization"] = f"Bearer {token}"
    r = requests.get(BASE + path, headers=headers)
    if r.status_code >= 400:
        raise RuntimeError(f"GET {path}: {r.status_code} {r.text}")
    return r.json()

def iso(dt):
    # ensure Zulu
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

def register_or_login(user):
    try:
        data = post("/auth/register", {"email": user["email"], "password": user["password"], "name": user["name"]})
        print(f"Registered {user['email']}")
        return data["token"], data["user"]
    except Exception as e:
        # If already exists, attempt login with provided password
        try:
            data = post("/auth/login", {"email": user["email"], "password": user["password"]})
            print(f"Logged in {user['email']}")
            return data["token"], data["user"]
        except Exception as e2:
            print(f"[WARN] User exists but password mismatch for {user['email']}. "
                  f"Either delete the user in Mongo or update the seed password.")
            raise


def create_blocks(token, day_offset=0, who=""):
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    day = today + timedelta(days=day_offset)
    blocks = [
        (9, 11, "Focus Block"),
        (13, 14, "Lunch"),
        (15, 17, "Project Work"),
    ]
    for h1, h2, title in blocks:
        s = day.replace(hour=h1)
        e = day.replace(hour=h2)
        post("/events", {
            "title": f"{title}",
            "description": f"{who} {title}".strip(),
            "start": iso(s),
            "end": iso(e)
        }, token=token)

def main():
    tokens = {}
    users = {}
    for u in USERS:
        t, me = register_or_login(u)
        tokens[u["email"]] = t
        users[u["email"]] = me
        time.sleep(0.1)

    # As "You", add Alice and Bob as friends
    me_token = tokens["me@example.com"]
    for friend_email in ["alice@example.com", "bob@example.com"]:
        try:
            post("/friends/add", {"email": friend_email}, token=me_token)
            print(f"Added friend {friend_email}")
        except Exception as e:
            print(f"(Maybe already friends) {friend_email}: {e}")

    # Create events for each person (today and tomorrow)
    create_blocks(tokens["me@example.com"], 0, "Me")
    create_blocks(tokens["me@example.com"], 1, "Me")
    create_blocks(tokens["alice@example.com"], 0, "Alice")
    create_blocks(tokens["bob@example.com"], 0, "Bob")

    print("Done. You can now login at the frontend with me@example.com / secret123")

if __name__ == "__main__":
    main()
