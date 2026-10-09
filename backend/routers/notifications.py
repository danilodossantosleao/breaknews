"""Central de notificações internas + preferências por categoria."""

from fastapi import APIRouter, Depends, HTTPException

from lib.dates import to_utc
from lib.db import db
from lib.security import get_current_user
from models.misc import FREQUENCIES, NotificationItem, NotificationList, PrefItem, PrefUpdate

router = APIRouter()

DEFAULT_CATEGORIES = ["noticias", "atualizacao", "dlc", "lancamento", "evento", "trailer", "analise", "promocao", "manutencao", "alerta"]


async def _ensure_prefs(user_id: str) -> list[dict]:
    count = await db.notification_preferences.count_documents({"user_id": user_id})
    if count == 0:
        from lib.dates import utc_now
        rows = [
            {"id": f"{user_id[:8]}-{cat}", "user_id": user_id, "game_id": None, "category": cat,
             "frequency": "imediato" if cat in ("alerta", "atualizacao") else "diario",
             "enabled": True, "created_at": utc_now(), "updated_at": utc_now()}
            for cat in DEFAULT_CATEGORIES
        ]
        await db.notification_preferences.insert_many(rows)
    docs = await db.notification_preferences.find({"user_id": user_id}).to_list(30)
    docs.sort(key=lambda d: DEFAULT_CATEGORIES.index(d["category"]) if d["category"] in DEFAULT_CATEGORIES else 99)
    return docs


@router.get("/notifications", response_model=NotificationList)
async def list_notifications(user: dict = Depends(get_current_user)):
    docs = await db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).limit(100).to_list(100)
    unread = sum(1 for d in docs if not d.get("is_read"))
    items = [
        NotificationItem(
            id=d["id"], title=d["title"], body=d.get("body", ""), category=d.get("category", "noticias"),
            game_id=d.get("game_id"), news_id=d.get("news_id"), is_read=d.get("is_read", False),
            created_at=to_utc(d.get("created_at")),
        )
        for d in docs
    ]
    return NotificationList(items=items, unread=unread)


@router.post("/notifications/{notification_id}/read")
async def mark_read(notification_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notification_id, "user_id": user["id"]},
        {"$set": {"is_read": True, "read_at": utc_now()}},
    )
    return {"ok": True}


@router.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    result = await db.notifications.update_many({"user_id": user["id"], "is_read": False}, {"$set": {"is_read": True}})
    return {"updated": result.modified_count}


@router.get("/notifications/preferences", response_model=list[PrefItem])
async def get_preferences(user: dict = Depends(get_current_user)):
    docs = await _ensure_prefs(user["id"])
    return [PrefItem(category=d["category"], enabled=d.get("enabled", True), frequency=d.get("frequency", "diario")) for d in docs]


@router.patch("/notifications/preferences/{category}", response_model=PrefItem)
async def update_preference(category: str, data: PrefUpdate, user: dict = Depends(get_current_user)):
    if category not in DEFAULT_CATEGORIES:
        raise HTTPException(status_code=404, detail="Categoria inválida.")
    await _ensure_prefs(user["id"])
    updates: dict = {}
    from lib.dates import utc_now
    if data.enabled is not None:
        updates["enabled"] = data.enabled
    if data.frequency is not None:
        if data.frequency not in FREQUENCIES:
            raise HTTPException(status_code=422, detail="Frequência inválida.")
        updates["frequency"] = data.frequency
    if updates:
        updates["updated_at"] = utc_now()
        await db.notification_preferences.update_one({"user_id": user["id"], "category": category}, {"$set": updates})
    doc = await db.notification_preferences.find_one({"user_id": user["id"], "category": category})
    return PrefItem(category=doc["category"], enabled=doc.get("enabled", True), frequency=doc.get("frequency", "diario"))
