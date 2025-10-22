
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_login_success():
    response = client.post("/login", json={"username": "apple", "password": "apple"})
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_login_fail():
    response = client.post("/login", json={"username": "apple", "password": "wrongpass"})
    assert response.status_code == 401

def test_add_friend():
    response = client.post("/user/add-friend", json={"username": "apple", "friend": "eve"})
    assert response.status_code == 200
    assert "msg" in response.json()
    response2 = client.post("/user/add-friend", json={"username": "apple", "friend": "eve"})
    assert response2.status_code == 200
    assert response2.json()["msg"] == "Already friends"
