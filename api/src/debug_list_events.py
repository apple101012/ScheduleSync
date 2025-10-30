#!/usr/bin/env python3
"""Debug helper: list events for Busy Person and call busy-now.

Use this to verify whether the Busy Person's events exist in the same API/DB the frontend uses.
"""
import os, sys, requests

API_BASE = os.environ.get("API_BASE", "http://localhost:8000")
ADMIN_EMAIL = "apple@apple.com"
ADMIN_PASS = "apple"
BUSY_EMAIL = "busy@demo.com"

def headers(token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h

def post(path, data=None, token=None):
    url = f"{API_BASE}{path}"
    r = requests.post(url, json=data or {}, headers=headers(token))
    print(f"POST {path} -> {r.status_code}")
    try:
        return r.json()
    except Exception:
        return None

def get(path, token=None):
    url = f"{API_BASE}{path}"
    r = requests.get(url, headers=headers(token))
    print(f"GET {path} -> {r.status_code}")
    try:
        return r.json()
    except Exception:
        return None

def main():
    print("API_BASE=", API_BASE)
    login = post("/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    if not login:
        print("Could not login admin")
        sys.exit(1)
    token = login.get("token")

    friends = get("/friends", token=token)
    busy_id = None
    if isinstance(friends, list):
        for f in friends:
            if f.get("email") == BUSY_EMAIL:
                busy_id = f.get("id") or f.get("_id") or f.get("userId")
                print("Found busy friend in friends list:", busy_id)
                break

    if not busy_id:
        print("Busy friend not found in /friends — trying to lookup user by email via /users")
        users = get(f"/users?email={BUSY_EMAIL}", token=token)
        print("users lookup ->", users)
        if isinstance(users, dict) and users.get('users'):
            ulist = users.get('users')
        elif isinstance(users, list):
            ulist = users
        else:
            ulist = None
        if ulist:
            # find matching email
            for u in ulist:
                if u.get('email') == BUSY_EMAIL:
                    busy_id = u.get('id') or u.get('_id')
                    break

    if not busy_id:
        print("Could not find Busy Person id. Exiting.")
        sys.exit(1)

    events = get(f"/events?ownerId={busy_id}", token=token)
    print(f"Events for busy id {busy_id} (count={len(events) if isinstance(events, list) else 'n/a'}):")
    print(events)

    busynow = get(f"/friends/{busy_id}/busy-now", token=token)
    print("busy-now ->", busynow)

if __name__ == '__main__':
    main()
