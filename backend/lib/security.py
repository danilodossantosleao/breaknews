"""Auth plumbing: password hashing, JWT session cookie, current-user dependency, rate limit, sanitizers."""

import os
import re
import time
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, Response
from passlib.context import CryptContext

from lib.db import db

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

COOKIE_NAME = "nexus_session"
SESSION_DAYS = 30


def _secret() -> str:
    return os.environ.get("SESSION_SECRET", "nexus-dev-secret-change-me")


def hash_password(password: str) -> str:
    return pwd_ctx.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return pwd_ctx.verify(password, password_hash)
    except Exception:
        return False


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, _secret(), algorithm="HS256")


def set_session_cookie(response: Response, user_id: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        create_token(user_id),
        httponly=True,
        samesite="lax",
        max_age=SESSION_DAYS * 86400,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


async def get_current_user(request: Request) -> dict:
    """FastAPI dependency — resolves the user from the httpOnly session cookie."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Sessão não encontrada. Faça login.")
    try:
        payload = jwt.decode(token, _secret(), algorithms=["HS256"])
        user_id = payload.get("sub")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada.")
    if not user_id:
        raise HTTPException(status_code=401, detail="Sessão inválida.")
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado.")
    user.pop("password_hash", None)
    return user


# ---- simple in-memory sliding-window rate limiter (single process) ----
_hits: dict[str, list[float]] = {}


def rate_limit(key: str, limit: int, window_s: int) -> None:
    now = time.time()
    bucket = [t for t in _hits.get(key, []) if now - t < window_s]
    if len(bucket) >= limit:
        raise HTTPException(status_code=429, detail="Muitas tentativas. Aguarde um momento.")
    bucket.append(now)
    _hits[key] = bucket


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def safe_text(value: str | None, max_len: int = 200) -> str | None:
    """Trim/collapse whitespace in user-provided free text."""
    if value is None:
        return None
    cleaned = re.sub(r"\s+", " ", value).strip()
    return cleaned[:max_len] or None


def safe_url(value: str | None, max_len: int = 500) -> str | None:
    """Only absolute http(s) URLs are accepted — blocks javascript:/data: injection."""
    if value is None:
        return None
    value = value.strip()[:max_len]
    if re.match(r"^https?://", value, flags=re.IGNORECASE):
        return value
    return None
