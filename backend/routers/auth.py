"""Autenticação: registro, login, logout, sessão, perfil e onboarding."""

import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lib.dates import utc_now
from lib.db import db
from lib.security import (
    clear_session_cookie,
    client_ip,
    get_current_user,
    hash_password,
    rate_limit,
    safe_text,
    safe_url,
    set_session_cookie,
    verify_password,
)
from models.auth import MessageOut, OnboardingData, ProfileUpdate, UserCreate, UserLogin, UserOut

router = APIRouter()

SAFE_FREQUENCIES = {"imediato", "diario", "semanal", "desativado"}
SAFE_THEMES = {"dark", "light"}


def _user_out(doc: dict) -> UserOut:
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return UserOut(**doc)


@router.post("/auth/register", response_model=UserOut, status_code=201)
async def register(data: UserCreate, request: Request, response: Response):
    rate_limit(f"register:{client_ip(request)}", 10, 60)
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}, {"_id": 1}):
        raise HTTPException(status_code=409, detail="E-mail já cadastrado.")
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(data.password),
        "display_name": safe_text(data.display_name, 40),
        "avatar_url": None,
        "theme": "dark",
        "locale": "pt-BR",
        "notification_frequency": "diario",
        "favorite_platforms": [],
        "favorite_genres": [],
        "onboarding_done": False,
        "created_at": utc_now(),
    }
    await db.users.insert_one(user)
    set_session_cookie(response, user["id"])
    return _user_out(user)


@router.post("/auth/login", response_model=UserOut)
async def login(data: UserLogin, request: Request, response: Response):
    rate_limit(f"login:{client_ip(request)}", 10, 60)
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
    set_session_cookie(response, user["id"])
    return _user_out(user)


@router.post("/auth/logout", response_model=MessageOut)
async def logout(response: Response):
    clear_session_cookie(response)
    return MessageOut(ok=True, message="Sessão encerrada.")


@router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return _user_out(user)


@router.patch("/auth/profile", response_model=UserOut)
async def update_profile(data: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates: dict = {}
    if data.display_name is not None:
        updates["display_name"] = safe_text(data.display_name, 40) or user["display_name"]
    if data.avatar_url is not None:
        updates["avatar_url"] = safe_url(data.avatar_url)
    if data.theme is not None:
        if data.theme not in SAFE_THEMES:
            raise HTTPException(status_code=422, detail="Tema inválido.")
        updates["theme"] = data.theme
    if data.locale is not None:
        updates["locale"] = data.locale[:10]
    if data.notification_frequency is not None:
        if data.notification_frequency not in SAFE_FREQUENCIES:
            raise HTTPException(status_code=422, detail="Frequência inválida.")
        updates["notification_frequency"] = data.notification_frequency
    if data.favorite_platforms is not None:
        updates["favorite_platforms"] = [safe_text(p, 40) for p in data.favorite_platforms[:20] if p]
    if data.favorite_genres is not None:
        updates["favorite_genres"] = [safe_text(g, 40) for g in data.favorite_genres[:20] if g]
    if data.onboarding_done is not None:
        updates["onboarding_done"] = data.onboarding_done
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    fresh = await db.users.find_one({"id": user["id"]})
    return _user_out(fresh)


@router.post("/auth/onboarding", response_model=UserOut)
async def complete_onboarding(data: OnboardingData, user: dict = Depends(get_current_user)):
    """Salva preferências do onboarding e adiciona os jogos escolhidos à biblioteca."""
    freq = data.notification_frequency if data.notification_frequency in SAFE_FREQUENCIES else "diario"
    game_ids = list(dict.fromkeys(data.game_ids))[:20]
    valid_ids = set()
    if game_ids:
        docs = await db.games.find({"id": {"$in": game_ids}}, {"id": 1}).to_list(50)
        valid_ids = {d["id"] for d in docs}
    existing = {
        d["game_id"]
        for d in await db.user_games.find({"user_id": user["id"]}, {"game_id": 1}).to_list(500)
    }
    now = utc_now()
    for game_id in game_ids:
        if game_id in valid_ids and game_id not in existing:
            await db.user_games.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "game_id": game_id,
                "status": "quero_jogar",
                "platform": None,
                "personal_rating": None,
                "personal_notes": None,
                "started_at": None,
                "completed_at": None,
                "hours_played": None,
                "is_favorite": False,
                "tags": [],
                "created_at": now,
                "updated_at": now,
            })
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "favorite_platforms": [safe_text(p, 40) for p in data.platforms[:20] if p],
            "favorite_genres": [safe_text(g, 40) for g in data.genres[:20] if g],
            "notification_frequency": freq,
            "onboarding_done": True,
        }},
    )
    fresh = await db.users.find_one({"id": user["id"]})
    return _user_out(fresh)
