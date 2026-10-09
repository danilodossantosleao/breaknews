"""Catálogo de jogos, biblioteca pessoal e exploração."""

import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.dates import today_iso, to_utc, utc_now
from lib.db import db
from lib.security import get_current_user, safe_text
from models.games import (
    GAME_STATUSES,
    ExploreOut,
    GameDetailOut,
    GameOut,
    LibraryItem,
    UserGameCreate,
    UserGameUpdate,
)

router = APIRouter()


def _game_out(doc: dict) -> GameOut:
    doc.pop("_id", None)
    return GameOut(**doc)


async def _game_map(ids: list[str]) -> dict[str, dict]:
    if not ids:
        return {}
    docs = await db.games.find({"id": {"$in": ids}}).to_list(len(ids) * 2)
    return {d["id"]: d for d in docs}


async def _last_news_map(game_ids: list[str]) -> dict[str, object]:
    if not game_ids:
        return {}
    pipeline = [
        {"$match": {"game_id": {"$in": game_ids}}},
        {"$group": {"_id": "$game_id", "last": {"$max": "$published_at"}}},
    ]
    rows = await db.news.aggregate(pipeline).to_list(len(game_ids) * 2)
    return {r["_id"]: to_utc(r["last"]) for r in rows}


def _library_item(ug: dict, game_doc: dict, last_news=None) -> LibraryItem:
    return LibraryItem(
        id=ug["id"],
        status=ug.get("status", "quero_jogar"),
        platform=ug.get("platform"),
        personal_rating=ug.get("personal_rating"),
        personal_notes=ug.get("personal_notes"),
        started_at=ug.get("started_at"),
        completed_at=ug.get("completed_at"),
        hours_played=ug.get("hours_played"),
        is_favorite=ug.get("is_favorite", False),
        tags=ug.get("tags", []),
        created_at=to_utc(ug.get("created_at")),
        updated_at=to_utc(ug.get("updated_at")),
        last_news_at=last_news,
        game=_game_out(dict(game_doc)),
    )


@router.get("/games/search")
async def search_games(q: str = "", limit: int = Query(default=12, le=25)):
    """Autocomplete do catálogo por nome, franquia, desenvolvedora, publicadora, plataforma ou gênero."""
    q = (q or "").strip()[:80]
    query: dict = {}
    if q:
        rx = {"$regex": q.replace("+", r"\+").replace("(", r"\(").replace(")", r"\)").replace("?", r"\?"), "$options": "i"}
        query = {"$or": [
            {"title": rx}, {"developer": rx}, {"publisher": rx},
            {"franchise": rx}, {"platforms": rx}, {"genres": rx},
        ]}
    docs = await db.games.find(query).sort("popularity", -1).to_list(limit)
    return [_game_out(d) for d in docs]


@router.get("/games/{game_id}", response_model=GameDetailOut)
async def game_detail(game_id: str):
    doc = await db.games.find_one({"id": game_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Jogo não encontrado no catálogo.")
    similar_docs = []
    if doc.get("genres"):
        similar_docs = await db.games.find(
            {"genres": {"$in": doc["genres"]}, "id": {"$ne": game_id}}
        ).sort("popularity", -1).limit(6).to_list(6)
    detail = GameDetailOut(**_game_out(doc).model_dump())
    detail.similar = [
        {"game": _game_out(s), "shared_genres": sorted(set(s.get("genres", [])) & set(doc.get("genres", [])))}
        for s in similar_docs
    ]
    return detail


@router.get("/library", response_model=list[LibraryItem])
async def get_library(user: dict = Depends(get_current_user)):
    ugs = await db.user_games.find({"user_id": user["id"]}).sort("updated_at", -1).to_list(500)
    games = await _game_map([ug["game_id"] for ug in ugs])
    last_news = await _last_news_map([ug["game_id"] for ug in ugs])
    items = []
    for ug in ugs:
        game_doc = games.get(ug["game_id"])
        if not game_doc:
            continue
        items.append(_library_item(ug, game_doc, last_news.get(ug["game_id"])))
    return items


@router.post("/library", response_model=LibraryItem, status_code=201)
async def add_to_library(data: UserGameCreate, user: dict = Depends(get_current_user)):
    game_doc = await db.games.find_one({"id": data.game_id})
    if not game_doc:
        raise HTTPException(status_code=404, detail="Jogo não encontrado no catálogo.")
    if data.status not in GAME_STATUSES:
        raise HTTPException(status_code=422, detail="Status inválido.")
    existing = await db.user_games.find_one({"user_id": user["id"], "game_id": data.game_id})
    if existing:
        raise HTTPException(status_code=409, detail="Este jogo já está na sua biblioteca.")
    now = utc_now()
    ug = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "game_id": data.game_id,
        "status": data.status,
        "platform": safe_text(data.platform, 40),
        "personal_rating": None,
        "personal_notes": None,
        "started_at": None,
        "completed_at": None,
        "hours_played": None,
        "is_favorite": False,
        "tags": [],
        "created_at": now,
        "updated_at": now,
    }
    await db.user_games.insert_one(ug)
    return _library_item(ug, game_doc)


@router.patch("/library/{ug_id}", response_model=LibraryItem)
async def update_library_item(ug_id: str, data: UserGameUpdate, user: dict = Depends(get_current_user)):
    ug = await db.user_games.find_one({"id": ug_id, "user_id": user["id"]})
    if not ug:
        raise HTTPException(status_code=404, detail="Item da biblioteca não encontrado.")
    if data.status is not None and data.status not in GAME_STATUSES:
        raise HTTPException(status_code=422, detail="Status inválido.")
    updates: dict = {"updated_at": utc_now()}
    for field in ("status", "platform", "personal_notes", "started_at", "completed_at"):
        value = getattr(data, field)
        if value is not None:
            updates[field] = safe_text(value, 2000) if field in ("platform", "personal_notes") else value
    for field in ("personal_rating", "hours_played", "is_favorite"):
        if getattr(data, field) is not None:
            updates[field] = getattr(data, field)
    if data.tags is not None:
        updates["tags"] = [safe_text(t, 30) for t in data.tags[:12] if t][:12]
    await db.user_games.update_one({"id": ug_id}, {"$set": updates})
    ug = await db.user_games.find_one({"id": ug_id})
    game_doc = await db.games.find_one({"id": ug["game_id"]})
    last_news = await _last_news_map([ug["game_id"]])
    return _library_item(ug, game_doc, last_news.get(ug["game_id"]))


@router.delete("/library/{ug_id}")
async def remove_library_item(ug_id: str, user: dict = Depends(get_current_user)):
    result = await db.user_games.delete_one({"id": ug_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item da biblioteca não encontrado.")
    return {"ok": True}


@router.get("/explore", response_model=ExploreOut)
async def explore(user: dict = Depends(get_current_user)):
    today = today_iso()
    year_start = today[:4] + "-01-01"

    popular = await db.games.find().sort("popularity", -1).limit(12).to_list(12)
    recent = await db.games.find({
        "release_date": {"$ne": None, "$lte": today},
        "release_date_status": {"$ne": "tba"},
    }).sort("release_date", -1).limit(12).to_list(12)
    upcoming = await db.games.find({
        "$or": [
            {"release_date": {"$gt": today}},
            {"release_date_status": {"$in": ["estimado", "tba"]}},
        ],
    }).sort("popularity", -1).limit(12).to_list(12)
    free_games = await db.games.find({"is_free": True}).sort("popularity", -1).limit(12).to_list(12)

    # Recomendações: cruzamento de gêneros favoritos + jogos fora da biblioteca
    profile = await db.users.find_one({"id": user["id"]}, {"favorite_genres": 1}) or {}
    fav_genres = [g for g in profile.get("favorite_genres", []) if g]
    owned = {d["game_id"] for d in await db.user_games.find({"user_id": user["id"]}, {"game_id": 1}).to_list(500)}
    if fav_genres:
        candidates = await db.games.find({"genres": {"$in": fav_genres}, "id": {"$nin": list(owned)}}).limit(40).to_list(40)
        candidates.sort(key=lambda g: -len(set(g.get("genres", [])) & set(fav_genres)))
    else:
        candidates = [g for g in await db.games.find({"id": {"$nin": list(owned)}}).sort("popularity", -1).limit(8).to_list(8)]

    franchise_rows = await db.games.aggregate([
        {"$match": {"franchise": {"$ne": None}}},
        {"$group": {"_id": "$franchise", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 8},
    ]).to_list(8)
    franchises = []
    for row in franchise_rows:
        cover_doc = await db.games.find_one({"franchise": row["_id"]}, {"cover_url": 1, "title": 1})
        franchises.append({
            "name": row["_id"],
            "count": row["count"],
            "cover_url": cover_doc.get("cover_url") if cover_doc else None,
        })

    genres = sorted({g for doc in await db.games.find({}, {"genres": 1}).to_list(200) for g in doc.get("genres", [])})
    platforms = sorted({p for doc in await db.games.find({}, {"platforms": 1}).to_list(200) for p in doc.get("platforms", [])})

    return ExploreOut(
        popular=[_game_out(d) for d in popular],
        recent=[_game_out(d) for d in recent],
        upcoming=[_game_out(d) for d in upcoming],
        recommended=[_game_out(d) for d in candidates[:8]],
        free=[_game_out(d) for d in free_games],
        franchises=franchises,
        genres=genres,
        platforms=platforms,
    )
