import requests

# Test user registration endpoint
url = "http://localhost:8000/register"
data = {
    "username": "testuser",
    "password": "testpass",
    "friends": []
}
try:
    r = requests.post(url, json=data)
    print("/register status:", r.status_code, r.json())
except Exception as e:
    print("Could not connect to backend:", e)
