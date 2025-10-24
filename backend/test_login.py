import requests

# Test user login endpoint
url = "http://localhost:8000/token"
data = {
    "username": "testuser",
    "password": "testpass"
}
try:
    r = requests.post(url, data=data)
    print("/token status:", r.status_code, r.json())
except Exception as e:
    print("Could not connect to backend:", e)

# Test invalid login
invalid_data = {
    "username": "testuser",
    "password": "wrongpass"
}
try:
    r = requests.post(url, data=invalid_data)
    print("/token invalid status:", r.status_code, r.json())
except Exception as e:
    print("Could not connect to backend (invalid):", e)
