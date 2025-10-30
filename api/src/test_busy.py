#!/usr/bin/env python3
"""Non-interactive test helper to verify the friends busy-now endpoint.

This script will:
- Ensure admin exists (apple@apple.com / apple)
- Ensure Busy Person exists (busy@demo.com / busy)
- Make admin friend the Busy Person
- Call /seed/full-week-user to create busy blocks for Busy Person
- Call GET /friends/:id/busy-now with admin's token and print the result

Run while the API dev server is running on http://localhost:8000 (or set API_BASE env).
"""
import os
import requests
import sys
from datetime import datetime, timedelta, timezone
import zoneinfo

API_BASE = os.environ.get("API_BASE", "http://localhost:8000")
ADMIN_EMAIL = "apple@apple.com"
ADMIN_PASS = "apple"
ADMIN_NAME = "Admin"

BUSY_EMAIL = "busy@demo.com"
BUSY_PASS = "busy"
BUSY_NAME = "Busy Person"
BUSY_START = 8
BUSY_END = 22

def headers(token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h

def post(path, data=None, token=None, ok=(200,201)):
    url = f"{API_BASE}{path}"
    r = requests.post(url, json=data or {}, headers=headers(token))
    if r.status_code not in ok:
        print(f"POST {path} -> {r.status_code}: {r.text}")
        return None
    try:
        return r.json()
    except Exception:
        return {}

def get(path, token=None, ok=(200,)):
    url = f"{API_BASE}{path}"
    r = requests.get(url, headers=headers(token))
    if r.status_code not in ok:
        print(f"GET {path} -> {r.status_code}: {r.text}")
        return None
    try:
        return r.json()
    except Exception:
        return {}

def ensure_admin():
    # try register-admin (may error if exists)
    post("/auth/register-admin", {"email": ADMIN_EMAIL, "password": ADMIN_PASS, "name": ADMIN_NAME})
    login = post("/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    if not login:
        print("Failed to login admin. Aborting.")
        sys.exit(1)
    token = login.get("token")
    user = login.get("user") or {}
    print(f"admin logged in: {user.get('email')} id={user.get('id')}")
    return token, user

def ensure_busy():
    post("/auth/register", {"email": BUSY_EMAIL, "password": BUSY_PASS, "name": BUSY_NAME})
    login = post("/auth/login", {"email": BUSY_EMAIL, "password": BUSY_PASS})
    if not login:
        print("Failed to create/login Busy Person.")
        return None
    token = login.get("token")
    user = login.get("user") or {}
    print(f"busy user logged in: {user.get('email')} id={user.get('id')}")
    return token, user

def main():
    print("API_BASE=", API_BASE)
    token_admin, admin = ensure_admin()
    busy = ensure_busy()
    if not busy:
        print("Could not ensure busy user; exiting")
        sys.exit(1)
    busy_token, busy_user = busy

    # ensure admin friended busy user
    post("/friends/add", {"friendId": busy_user.get("id")}, token=token_admin)

    # make busy user have full-week busy blocks
    post("/seed/full-week-user", {
        "userId": busy_user.get("id"),
        "startHour": BUSY_START,
        "endHour": BUSY_END,
        "clear": True
    }, token=token_admin)

    # create an explicit event that covers "now" for the busy user (timezone-aware)
    try:
        # Use local timezone so we create an event that definitely overlaps current local time
        local_tz = datetime.now().astimezone().tzinfo
    except Exception:
        # fallback to system zoneinfo (Windows/Unix)
        try:
            local_tz = zoneinfo.ZoneInfo(os.environ.get('TZ') or 'UTC')
        except Exception:
            local_tz = timezone.utc

    now = datetime.now(tz=local_tz)
    start = (now - timedelta(minutes=15)).isoformat()
    end = (now + timedelta(minutes=60)).isoformat()

    evt = post("/events", {
        "title": "Busy Right Now (test)",
        "description": "Test event to make user busy",
        "start": start,
        "end": end
    }, token=busy_token)
    print("Created explicit event for busy check:", evt)

    # now call busy-now as admin
    res = get(f"/friends/{busy_user.get('id')}/busy-now", token=token_admin)
    print("/friends/:id/busy-now ->", res)

if __name__ == '__main__':
    main()
