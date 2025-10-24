import requests

def test_get_schedule():
    url = "http://localhost:8000/schedule/testuser"
    r = requests.get(url)
    print("/schedule status:", r.status_code, r.json())

def test_get_availability():
    url = "http://localhost:8000/availability/testuser"
    r = requests.get(url)
    print("/availability status:", r.status_code, r.json())

if __name__ == "__main__":
    test_get_schedule()
    test_get_availability()
