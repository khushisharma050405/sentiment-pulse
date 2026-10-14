import os
os.environ["DATABASE_URL"] = "sqlite:///./test_sp.db"
os.environ["AUTH_RATE_LIMIT"] = "1000"
os.environ["SENTIMENT_ENGINE"] = "vader"
import pytest
from fastapi.testclient import TestClient
from app.db import Base, engine
from app.main import app


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def token(client):
    r = client.post("/auth/register", json={"name": "Khushi", "email": "k@example.com", "password": "password123"})
    return r.json()["access_token"]
