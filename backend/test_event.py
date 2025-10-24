import requests

# Helper: get JWT token for testuser
def get_token():
    url = "http://localhost:8000/token"
    data = {"username": "testuser", "password": "testpass"}
    r = requests.post(url, data=data)
    return r.json()["access_token"]

def test_create_event():
    token = get_token()
    url = "http://localhost:8000/event"
    headers = {"Authorization": f"Bearer {token}"}
    event = {
        "title": "Test Event",
        "start": "2025-10-24T10:00:00Z",
        "end": "2025-10-24T11:00:00Z"
    }
    r = requests.post(url, json=event, headers=headers)
    print("/event create status:", r.status_code, r.json())

def test_get_schedule():
    url = "http://localhost:8000/schedule/testuser"
    r = requests.get(url)
    print("/schedule status:", r.status_code, r.json())

def test_delete_event():
    token = get_token()
    url = "http://localhost:8000/event"
    headers = {"Authorization": f"Bearer {token}"}
    event = {
        "title": "Test Event",
        "start": "2025-10-24T10:00:00Z",
        "end": "2025-10-24T11:00:00Z"
    }
    r = requests.delete(url, json=event, headers=headers)
    print("/event delete status:", r.status_code, r.json())

if __name__ == "__main__":
    test_create_event()
    test_get_schedule()
    test_delete_event()
