import requests

API_BASE = "http://localhost:8000"

def test_login(username, password):
    print(f"Testing login for {username}...")
    r = requests.post(f"{API_BASE}/login", json={"username": username, "password": password})
    print("Status:", r.status_code)
    print("Response:", r.text)
    print()

def test_add_friend(username, friend):
    print(f"Testing add_friend: {username} -> {friend}...")
    r = requests.post(f"{API_BASE}/user/add-friend", json={"username": username, "friend": friend})
    print("Status:", r.status_code)
    print("Response:", r.text)
    print()

if __name__ == "__main__":
    test_login("apple", "apple")
    test_login("apple", "wrongpass")
    test_add_friend("apple", "eve")
    test_add_friend("apple", "eve")
