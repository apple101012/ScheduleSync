import pytest
from fastapi.testclient import TestClient
import os

# Attempt to import the app
from main import app

client = TestClient(app)

TEST_USER = {
    "username": "testuser",
    "email": "testuser@example.com",
    # password handling: depends on backend; if hashed password required, tests may need DB setup
    "password": "password123"
}


def test_crud_events_flow():
    # NOTE: This test assumes the backend is wired to allow direct writes to schedules
    # and that authentication is optional for test environment. If auth is required,
    # tests should first register/login and use the token.

    username = TEST_USER['username']

    # Ensure initial schedule is empty
    r = client.get(f"/schedule/{username}")
    assert r.status_code in (200, 404)
    # Create an event
    create_payload = {"title": "Test Event", "start": "2025-10-22T10:00:00", "end": "2025-10-22T11:00:00"}
    r = client.post(f"/events/{username}", json=create_payload)
    assert r.status_code == 200
    event = r.json().get('event')
    assert event is not None
    assert event.get('title') == "Test Event"
    event_id = event.get('_id')
    assert event_id

    # Get schedule and check event present
    r = client.get(f"/schedule/{username}")
    assert r.status_code == 200
    data = r.json()
    assert any(ev.get('_id') == event_id for ev in data.get('events', []))

    # Update the event
    update_payload = {"title": "Updated Title", "start": "2025-10-22T10:30:00", "end": "2025-10-22T11:30:00"}
    r = client.put(f"/events/{username}/{event_id}", json=update_payload)
    assert r.status_code == 200
    updated = r.json().get('event')
    assert updated.get('title') == "Updated Title"

    # Delete the event
    r = client.delete(f"/events/{username}/{event_id}")
    assert r.status_code == 200

    # Verify deletion
    r = client.get(f"/schedule/{username}")
    assert r.status_code == 200
    data = r.json()
    assert not any(ev.get('_id') == event_id for ev in data.get('events', []))
