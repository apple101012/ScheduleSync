import requests

# Test backend health endpoint
try:
    r = requests.get("http://localhost:8000/health")
    print("/health status:", r.status_code, r.json())
except Exception as e:
    print("Could not connect to backend:", e)
