"""Updates Tracker (patches e DLCs) e Calendário gamer (eventos e lançamentos)."""

import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.dates import to_utc, today_iso, utc_now
from lib.db import db
from lib.security import get_current_user, safe_text
from models.misc import EventItem, EventStateIn, UpdateItem, UpdatePage, UpdateReadIn

router = APIRouter()


async def _game_map(ids: list[str]) -> dict[str, dict]:
    ids = [i for i in ids if i]
    if not ids:
        return {}
    docs = await db.games.find({"id": {"$in": ids}}, {"id": 1, "title": 1, "cover_url": 1}).to_list(len(ids) * 2)
    return {d["id"]: d for d in docs}


def _update_item(doc: dict, game_doc: dict | None, is_read: bool) -> UpdateItem:
    published = to_utc(doc.get("published_at"))
    return UpdateItem(
        id=doc["id"],
        game_id=doc.get("game_id"),
        game_title=game_doc["title"] if game_doc else None,
        game_cover=game_doc.get("cover_url") if game_doc else None,
        version=doc.get("version"),
        title=doc["title"],
        summary=doc.get("summary", ""),
        highlights=doc.get("highlights", []),
        patch_notes_url=doc.get("patch_notes_url"),
        category=doc.get("category", "patch"),
        published_at=published,
        is_read=is_read,
        is_recent=bool(published and utc_now() - published <= timedelta(days=7)),
    )


@router.get("/updates", response_model=UpdatePage)
async def list_updates(
    scope: str = "tracked",
    game_id: str | None = None,
    category: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    user: dict = Depends(get_current_user),
):
    query: dict = {}
    if game_id:
        query["game_id"] = game_id
    elif scope == "tracked":
        my_games = [d["game_id"] for d in await db.user_games.find({"user_id": user["id"]}, {"game_id": 1}).to_list(500)]
        if not my_games:
            return UpdatePage(total=0)
        query["game_id"] = {"$in": my_games}
    if category and category != "todos":
        query["category"] = category

    total = await db.game_updates.count_documents(query)
    docs = await db.game_updates.find(query).sort("published_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    games = await _game_map([d.get("game_id") for d in docs])
    reads = {d["update_id"] for d in await db.user_updates.find({"user_id": user["id"]}).to_list(5000) if d.get("is_read")}
    items = [_update_item(d, games.get(d.get("game_id")), d["id"] in reads) for d in docs]
    return UpdatePage(items=items, total=total)


@router.post("/updates/{update_id}/read")
async def set_update_read(update_id: str, data: UpdateReadIn, user: dict = Depends(get_current_user)):
    update_doc = await db.game_updates.find_one({"id": update_id}, {"_id": 1})
    if not update_doc:
        raise HTTPException(status_code=404, detail="Atualização não encontrada.")
    await db.user_updates.update_one(
        {"user_id": user["id"], "update_id": update_id},
        {"$set": {"is_read": data.is_read, "read_at": utc_now() if data.is_read else None}},
        upsert=True,
    )
    return {"ok": True, "is_read": data.is_read}


@router.post("/updates/read-all")
async def read_all_updates(user: dict = Depends(get_current_user)):
    my_games = [d["game_id"] for d in await db.user_games.find({"user_id": user["id"]}, {"game_id": 1}).to_list(500)]
    if not my_games:
        return {"updated": 0}
    docs = await db.game_updates.find({"game_id": {"$in": my_games}}, {"id": 1}).to_list(2000)
    already = {d["update_id"] for d in await db.user_updates.find({"user_id": user["id"], "is_read": True}, {"update_id": 1}).to_list(5000)}
    now = utc_now()
    new_states = [
        {"id": str(uuid.uuid4()), "user_id": user["id"], "update_id": d["id"], "is_read": True, "read_at": now}
        for d in docs if d["id"] not in already
    ]
    if new_states:
        await db.user_updates.insert_many(new_states)
    return {"updated": len(new_states)}


# ---------------- Calendário ----------------

def _event_item(doc: dict, game_doc: dict | None, state: dict | None) -> EventItem:
    return EventItem(
        id=doc["id"],
        game_id=doc.get("game_id"),
        game_title=game_doc["title"] if game_doc else None,
        game_cover=game_doc.get("cover_url") if game_doc else None,
        title=doc["title"],
        description=doc.get("description", ""),
        event_type=doc.get("event_type", "evento"),
        starts_at=to_utc(doc.get("starts_at")),
        ends_at=to_utc(doc.get("ends_at")),
        timezone_label=doc.get("timezone_label", "UTC"),
        date_status=doc.get("date_status", "confirmado"),
        source_url=doc.get("source_url"),
        is_saved=bool(state and state.get("is_saved")),
        reminder=bool(state and state.get("reminder")),
    )


@router.get("/events")
async def list_events(
    month: str | None = None,  # YYYY-MM
    upcoming: bool = False,
    event_type: str | None = None,
    tracked: bool = False,
    user: dict = Depends(get_current_user),
):
    query: dict = {}
    if upcoming:
        query["starts_at"] = {"$gte": utc_now()}
        sort_dir, limit = 1, 40
    else:
        month = month or today_iso()[:7]
        try:
            year, mon = (int(x) for x in month.split("-"))
            start = datetime(year, mon, 1, tzinfo=utc_now().tzinfo)
            end = datetime(year + (mon == 12), (mon % 12) + 1, 1, tzinfo=utc_now().tzinfo)
        except ValueError:
            raise HTTPException(status_code=422, detail="Mês inválido; use YYYY-MM.")
        query["starts_at"] = {"$gte": start, "$lt": end}
        sort_dir, limit = 1, 100
    if event_type and event_type != "todos":
        query["event_type"] = event_type
    if tracked:
        my_games = [d["game_id"] for d in await db.user_games.find({"user_id": user["id"]}, {"game_id": 1}).to_list(500)]
        if not my_games:
            return []
        query["game_id"] = {"$in": my_games}

    docs = await db.events.find(query).sort("starts_at", sort_dir).limit(limit).to_list(limit)
    games = await _game_map([d.get("game_id") for d in docs])
    states = {s["event_id"]: s for s in await db.user_events.find({"user_id": user["id"]}).to_list(2000)}
    return [_event_item(d, games.get(d.get("game_id")), states.get(d["id"])) for d in docs]


@router.post("/events/{event_id}/state")
async def set_event_state(event_id: str, data: EventStateIn, user: dict = Depends(get_current_user)):
    event_doc = await db.events.find_one({"id": event_id}, {"_id": 1})
    if not event_doc:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    updates: dict = {}
    if data.is_saved is not None:
        updates["is_saved"] = data.is_saved
    if data.reminder is not None:
        updates["reminder"] = data.reminder
    if updates:
        updates["updated_at"] = utc_now()
        await db.user_events.update_one(
            {"user_id": user["id"], "event_id": event_id},
            {"$set": updates, "$setOnInsert": {"created_at": utc_now()}},
            upsert=True,
        )
    state = await db.user_events.find_one({"user_id": user["id"], "event_id": event_id})
    return {"is_saved": bool(state and state.get("is_saved")), "reminder": bool(state and state.get("reminder"))}


@router.patch("/events/{event_id}/note")
async def set_event_note(event_id: str, data: dict, user: dict = Depends(get_current_user)):
    note = safe_text(data.get("personal_note"), 1000)
    await db.user_events.update_one(
        {"user_id": user["id"], "event_id": event_id},
        {"$set": {"personal_note": note, "updated_at": utc_now()}, "$setOnInsert": {"created_at": utc_now()}},
        upsert=True,
    )
    return {"ok": True}
