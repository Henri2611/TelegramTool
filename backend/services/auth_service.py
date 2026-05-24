import os
import time
import jwt
from fastapi import Header, HTTPException
from typing import Optional

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required. Set it in backend/.env")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY = 86400  # 24 hours

BLACKLISTED_TOKENS: set[str] = set()


def create_token(phone: str) -> str:
    payload = {
        "phone": phone,
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRY,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> str:
    if token in BLACKLISTED_TOKENS:
        raise HTTPException(status_code=401, detail="Token has been revoked")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload["phone"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def blacklist_token(token: str) -> None:
    BLACKLISTED_TOKENS.add(token)


def _extract_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    return authorization.split(" ", 1)[1]


async def require_auth(authorization: Optional[str] = Header(None)) -> str:
    token = _extract_token(authorization)
    return verify_token(token)


async def require_auth_with_token(authorization: Optional[str] = Header(None)) -> tuple[str, str]:
    token = _extract_token(authorization)
    phone = verify_token(token)
    return phone, token
