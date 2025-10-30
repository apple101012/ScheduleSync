#!/usr/bin/env python3
import os, sys, random, string, requests
from typing import Tuple, Dict, Any, List
from datetime import datetime, timedelta, timezone
import zoneinfo

API_BASE = os.environ.get("API_BASE", "http://localhost:8000")

ADMIN_EMAIL = "apple@apple.com"
ADMIN_PASS = "apple"
ADMIN_NAME = "Admin"

BUSY_EMAIL = "busy@demo.com"
BUSY_PASS = "busy"
BUSY_NAME = "Busy Person"
# Make the Busy Person busy the entire day so demos and checks that use "busy-now"
# will reliably detect them as busy regardless of local test time.
BUSY_START_HOUR = 0
BUSY_END_HOUR = 24

SAMPLE_COUNT = 20
SAMPLE_EMAIL_DOMAIN = "example.com"
SAMPLE_NAME_PREFIX = "User"
SAMPLE_DEFAULT_PASS = "testpass"

def _headers(token: str | None = None) -> Dict[str, str]:
  h = {"Content-Type": "application/json"}
  if token:
    h["Authorization"] = f"Bearer {token}"
  return h

def post(path: str, json: Dict[str, Any] | None = None, token: str | None = None, ok=(200, 201)) -> Dict[str, Any]:
  url = f"{API_BASE}{path}"
  r = requests.post(url, json=json or {}, headers=_headers(token))
  if r.status_code not in ok:
    raise RuntimeError(f"POST {path}: {r.status_code} {r.text}")
  try:
    return r.json()
  except Exception:
    return {}

def register_admin(email: str, password: str, name: str) -> Dict[str, Any]:
  print(f"[seed] (admin) {email} via /auth/register-admin …")
  return post("/auth/register-admin", {"email": email, "password": password, "name": name})

def login(email: str, password: str) -> Tuple[str, Dict[str, Any]]:
  data = post("/auth/login", {"email": email, "password": password})
  token = data.get("token")
  user = data.get("user") or {}
  if not token or not user.get("id"):
    raise RuntimeError("Login succeeded but response missing token/user")
  return token, user

def register_user(email: str, password: str, name: str) -> Dict[str, Any]:
  return post("/auth/register", {"email": email, "password": password, "name": name})

def ensure_user(email: str, password: str, name: str) -> Tuple[str, Dict[str, Any]]:
  try:
    _ = register_user(email, password, name)
    token, user = login(email, password)
    print(f"[seed] created {email} id={user['id']}")
    return token, user
  except RuntimeError as e:
    msg = str(e).lower()
    if "409" in msg or "already" in msg:
      token, user = login(email, password)
      print(f"[seed] existing {email} -> logged in id={user['id']}")
      return token, user
    raise

def add_friend(token_admin: str, friend_id: str) -> bool:
  try:
    post("/friends/add", {"friendId": friend_id}, token=token_admin)
    return True
  except RuntimeError as e:
    print(f"[seed][warn] /friends/add failed for {friend_id}: {e}")
    return False

def seed_all_week(token_admin: str, clear: bool = True, include_admin: bool = False) -> Dict[str, Any]:
  data = post("/seed/all", {"mode": "week", "clear": clear, "includeAdmin": include_admin}, token=token_admin)
  print(f"[seed] /seed/all week -> users={data.get('users')} created={data.get('created')} (includeAdmin={include_admin})")
  return data

def seed_full_week_user(token_admin: str, user_id: str, start_hour: int, end_hour: int, clear: bool = True) -> Dict[str, Any]:
  data = post("/seed/full-week-user", {
    "userId": user_id,
    "startHour": start_hour,
    "endHour": end_hour,
    "clear": clear
  }, token=token_admin)
  print(f"[seed] /seed/full-week-user {user_id} -> created={data.get('created')}")
  return data

def dedupe_events(token_admin: str) -> Dict[str, Any]:
  url = f"{API_BASE}/seed/dedupe"
  r = requests.post(url, json={}, headers=_headers(token_admin))
  if r.status_code == 404:
    print("[seed][note] /seed/dedupe not found (skipping).")
    return {"ok": False, "skipped": True}
  if r.status_code not in (200, 201):
    raise RuntimeError(f"POST /seed/dedupe: {r.status_code} {r.text}")
  data = r.json()
  print(f"[seed] /seed/dedupe -> removed={data.get('removed')}")
  return data

def reset_samples(token_admin: str, extra_emails: List[str]) -> Dict[str, Any]:
  data = post("/seed/reset-sample", {
    "domain": SAMPLE_EMAIL_DOMAIN,
    "emails": extra_emails
  }, token=token_admin)
  print(f"[seed] /seed/reset-sample -> users={data.get('removedUsers')} events={data.get('removedEvents')} pulledFrom={data.get('pulledFriendsFrom')}")
  return data

def random_email() -> str:
  slug = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
  return f"user_{slug}@{SAMPLE_EMAIL_DOMAIN}"

def confirm_banner() -> None:
  banner = f"""
 SEEDING WARNING
 - This will DELETE:
     • All users ending in @{SAMPLE_EMAIL_DOMAIN}
     • {BUSY_EMAIL}
     • {ADMIN_EMAIL}
   (and all of their events and friend references)
 - Then it will recreate admin, Busy Person, and {SAMPLE_COUNT} sample users,
   friend everyone to admin, and seed the current WEEK (≤3 events/day) for ALL (excluding admin).
 ----------------------------------------------------------------------
 API_BASE = {API_BASE}
 To continue, type YES (all caps) and press Enter.
======================================================================
> """
  ans = input(banner).strip()
  if ans != "YES":
    print("Aborted.")
    sys.exit(0)

def main() -> None:
  confirm_banner()

  # 0) Ensure we can auth as admin (create or reuse) to run resets
  created = register_admin(ADMIN_EMAIL, ADMIN_PASS, ADMIN_NAME)
  print(f"[seed] admin ok: id={created.get('id')} admin={created.get('admin')}")
  token_admin, admin_user = login(ADMIN_EMAIL, ADMIN_PASS)
  print(f"[seed] logged in as {admin_user['email']} (admin={admin_user.get('admin')})")

  # 1) Drop previous demo data (admin, busy, and *@example.com)
  reset_samples(token_admin, [ADMIN_EMAIL, BUSY_EMAIL])

  # 2) Recreate admin (fresh)
  created = register_admin(ADMIN_EMAIL, ADMIN_PASS, ADMIN_NAME)
  print(f"[seed] admin re-created: id={created.get('id')} admin={created.get('admin')}")
  token_admin, admin_user = login(ADMIN_EMAIL, ADMIN_PASS)

  # 3) Busy Person
  print("[seed] creating Busy Person …")
  busy_token, busy_user = ensure_user(BUSY_EMAIL, BUSY_PASS, BUSY_NAME)
  add_friend(token_admin, busy_user["id"])
  # Seed full-week busy blocks as before (keeps busy person busy for full days if configured)
  seed_full_week_user(token_admin, busy_user["id"], BUSY_START_HOUR, BUSY_END_HOUR, clear=True)

  # Also create a small explicit event that overlaps the current local time so
  # busy-now checks immediately detect the Busy Person as busy regardless of
  # how the hour-based seeding was applied.
  # NOTE: we intentionally do NOT create the immediate 'now' event here because
  # later steps (seed_all_week with clear=True) will delete week-range events for
  # all users and would remove the marker. We'll add the immediate event after
  # the global seeding/dedupe steps so it remains present for the demo.

  # Verify via admin that the Busy Person is considered busy right now.
  try:
    url = f"{API_BASE}/friends/{busy_user['id']}/busy-now"
    r = requests.get(url, headers=_headers(token_admin))
    if r.status_code not in (200, 201):
      raise RuntimeError(f"GET /friends/{busy_user['id']}/busy-now: {r.status_code} {r.text}")
    payload = r.json()
    print(f"[seed] busy-now check -> {payload}")
    if not payload.get("busy"):
      raise RuntimeError(f"Busy Person not busy after seeding (busy-now returned {payload})")
  except Exception as e:
    print(f"[seed][error] busy-now verification failed: {e}")
    raise

  # 4) Sample users + friend to admin
  for i in range(1, SAMPLE_COUNT + 1):
    email = random_email()
    name = f"{SAMPLE_NAME_PREFIX} {i}"
    try:
      _, user_u = ensure_user(email, SAMPLE_DEFAULT_PASS, name)
      add_friend(token_admin, user_u["id"])
    except Exception as e:
      print(f"[seed][warn] sample user {i} failed: {e}")

  # 5) Seed ALL (exclude admin to avoid piling admin’s events)
  seed_all_week(token_admin, clear=True, include_admin=False)

  # 6) De-dupe safety
  dedupe_events(token_admin)

  # After global seeding/dedupe, create an immediate timezone-aware event for
  # Busy Person so they remain busy at the end of the seeding process (the
  # earlier attempt was removed by /seed/all which clears the week's events).
  try:
    try:
      local_tz = datetime.now().astimezone().tzinfo
    except Exception:
      try:
        local_tz = zoneinfo.ZoneInfo(os.environ.get('TZ') or 'UTC')
      except Exception:
        local_tz = timezone.utc
    now = datetime.now(tz=local_tz)
    start = (now - timedelta(minutes=15)).isoformat()
    end = (now + timedelta(hours=2)).isoformat()
    ev = post("/events", {
      "title": "Busy Now (seed)",
      "description": "Seeder-created busy marker (final)",
      "start": start,
      "end": end
    }, token=busy_token)
    print(f"[seed] Created final immediate busy event for Busy Person: {ev.get('_id') if isinstance(ev, dict) else ev}")

    # Verify via admin that the Busy Person is considered busy right now.
    try:
      url = f"{API_BASE}/friends/{busy_user['id']}/busy-now"
      r = requests.get(url, headers=_headers(token_admin))
      if r.status_code not in (200, 201):
        raise RuntimeError(f"GET /friends/{busy_user['id']}/busy-now: {r.status_code} {r.text}")
      payload = r.json()
      print(f"[seed] final busy-now check -> {payload}")
      if not payload.get("busy"):
        raise RuntimeError(f"Busy Person not busy after final seeding (busy-now returned {payload})")
    except Exception as e:
      print(f"[seed][error] final busy-now verification failed: {e}")
      raise
  except Exception as e:
    print(f"[seed][warn] failed to create final immediate busy event: {e}")

  print("\n[seed] Done ✔")

if __name__ == "__main__":
  try:
    main()
  except Exception as e:
    print("SEED ERROR:", e)
    sys.exit(1)
