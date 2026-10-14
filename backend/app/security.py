import os
from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from .db import get_db
from .models import User

ALGO = "HS256"
bearer = HTTPBearer(auto_error=False)


def _secret() -> str:
    return os.getenv("JWT_SECRET", "dev-secret-change-me-please-use-a-long-random-string")


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode()[:72], h.encode())
    except ValueError:
        return False


def create_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=int(os.getenv("JWT_EXPIRE_MINUTES", "1440")))
    return jwt.encode({"sub": str(user_id), "exp": exp}, _secret(), algorithm=ALGO)


def _user(creds, db: Session):
    if not creds:
        return None
    try:
        uid = int(jwt.decode(creds.credentials, _secret(), algorithms=[ALGO])["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        return None
    return db.get(User, uid)


def optional_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)):
    return _user(creds, db)


def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)):
    u = _user(creds, db)
    if not u:
        raise HTTPException(401, "Not authenticated.")
    return u
