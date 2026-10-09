"""Minha Coleção: notícias salvas, eventos salvos e coleções personalizadas."""

from fastapi import APIRouter, Depends, HTTPException

from lib.dates import to_utc
from lib.db import db
from lib.security import get_current_user, safe_text
from models.misc import SavedEventEntry, SavedNewsEntry, SavedOut
from routers.news import _game_map, _news_item, _user_state_map

router = APIRouter()


@router.get("/saved", response_model=SavedOut)
async def get_saved(user: dict = Depends(get_current_user)):
    saved_states = await db.user_news.find({"user_id": user["id"], "is_saved": True}).sort("saved_at", -1).to_list(500)
    news_ids = [s["news_id"] for s in saved_states]
    news_docs = {d["id"]: d for d in await db.news.find({"id": {"$in": news_ids}}).to_list(500)} if news_ids else {}
    games = await _game_map([d.get("game_id") for d in news_docs.values() if d.get("game_id")])

    news_entries = []
    collections: dict[str, int] = {}
    for state in saved_states:
        doc = news_docs.get(state["news_id"])
        if not doc:
            continue
        entry = SavedNewsEntry(
            collection_name=state.get("collection_name", "Geral"),
            personal_note=state.get("personal_note"),
            saved_at=to_utc(state.get("saved_at")),
            news=_news_item(doc, state, games.get(doc.get("game_id"))),
        )
        news_entries.append(entry)
        name = entry.collection_name
        collections[name] = collections.get(name, 0) + 1

    event_states = await db.user_events.find({"user_id": user["id"], "is_saved": True}).to_list(200)
    event_ids = [s["event_id"] for s in event_states]
    event_docs = {d["id"]: d for d in await db.events.find({"id": {"$in": event_ids}}).to_list(200)} if event_ids else {}
    games2 = await _game_map([d.get("game_id") for d in event_docs.values() if d.get("game_id")])

    from routers.updates import _event_item
    event_entries = [
        SavedEventEntry(
            personal_note=state.get("personal_note"),
            reminder=state.get("reminder", False),
            event=_event_item(event_docs[state["event_id"]], games2.get(event_docs[state["event_id"]].get("game_id")), state),
        )
        for state in event_states
        if state["event_id"] in event_docs
    ]

    return SavedOut(
        news=news_entries,
        events=event_entries,
        collections=[{"name": name, "count": count} for name, count in sorted(collections.items(), key=lambda kv: -kv[1])],
    )


@router.patch("/saved/news/{news_id}")
async def patch_saved_news(news_id: str, data: dict, user: dict = Depends(get_current_user)):
    state = await db.user_news.find_one({"user_id": user["id"], "news_id": news_id, "is_saved": True})
    if not state:
        raise HTTPException(status_code=404, detail="Notícia salva não encontrada.")
    updates: dict = {"updated_at": to_utc(state.get("updated_at")) or None}
    if "collection_name" in data:
        updates["collection_name"] = safe_text(data.get("collection_name"), 40) or "Geral"
    if "personal_note" in data:
        updates["personal_note"] = safe_text(data.get("personal_note"), 1000)
    await db.user_news.update_one({"user_id": user["id"], "news_id": news_id}, {"$set": updates})
    return {"ok": True}


@router.patch("/saved/events/{event_id}")
async def patch_saved_event(event_id: str, data: dict, user: dict = Depends(get_current_user)):
    state = await db.user_events.find_one({"user_id": user["id"], "event_id": event_id, "is_saved": True})
    if not state:
        raise HTTPException(status_code=404, detail="Evento salvo não encontrado.")
    updates = {"personal_note": safe_text(data.get("personal_note"), 1000)}
    await db.user_events.update_one({"user_id": user["id"], "event_id": event_id}, {"$set": updates})
    return {"ok": True}
