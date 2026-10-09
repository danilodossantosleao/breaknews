"""Busca global, sincronização manual e resumo do dashboard."""

import re
from datetime import timedelta

from fastapi import APIRouter, Depends, Query

from lib.dates import to_utc, utc_now
from lib.db import db
from lib.security import get_current_user, rate_limit
from models.misc import DashboardSummary, SearchResults, SyncLogOut
from routers.games import _game_out
from routers.news import _game_map, _news_item, _user_state_map
from routers.updates import _event_item, _update_item

router = APIRouter()


@router.get("/search", response_model=SearchResults)
async def global_search(q: str = Query(min_length=2, max_length=80), user: dict = Depends(get_current_user)):
    q = q.strip()
    rx = {"$regex": re.escape(q), "$options": "i"}

    game_docs = await db.games.find({"$or": [{"title": rx}, {"developer": rx}, {"franchise": rx}, {"publisher": rx}]}).sort("popularity", -1).limit(6).to_list(6)
    news_docs = await db.news.find({"$or": [{"title": rx}, {"summary": rx}]}).sort("published_at", -1).limit(6).to_list(6)
    update_docs = await db.game_updates.find({"$or": [{"title": rx}, {"summary": rx}, {"version": rx}]}).sort("published_at", -1).limit(5).to_list(5)
    event_docs = await db.events.find({"$or": [{"title": rx}, {"description": rx}]}).sort("starts_at", 1).limit(5).to_list(5)

    games = await _game_map([d.get("game_id") for d in news_docs] + [d.get("game_id") for d in update_docs] + [d.get("game_id") for d in event_docs])
    states = await _user_state_map(user["id"], [d["id"] for d in news_docs])
    reads = {d["update_id"] for d in await db.user_updates.find({"user_id": user["id"]}, {"update_id": 1}).to_list(5000)}
    event_states = {s["event_id"]: s for s in await db.user_events.find({"user_id": user["id"]}).to_list(2000)}

    return SearchResults(
        games=[_game_out(d) for d in game_docs],
        news=[_news_item(d, states.get(d["id"]), games.get(d.get("game_id"))) for d in news_docs],
        updates=[_update_item(d, games.get(d.get("game_id")), d["id"] in reads) for d in update_docs],
        events=[_event_item(d, games.get(d.get("game_id")), event_states.get(d["id"])) for d in event_docs],
    )


def _sync_log_out(doc: dict) -> SyncLogOut:
    return SyncLogOut(
        id=doc["id"], trigger=doc.get("trigger", "manual"), status=doc.get("status", "ok"),
        sources_ok=doc.get("sources_ok", 0), sources_failed=doc.get("sources_failed", 0),
        items_fetched=doc.get("items_fetched", 0), items_inserted=doc.get("items_inserted", 0),
        demo_fallback=doc.get("demo_fallback", False), error=doc.get("error"),
        started_at=to_utc(doc.get("started_at")), finished_at=to_utc(doc.get("finished_at")),
    )


@router.get("/sync/last", response_model=SyncLogOut | None)
async def last_sync(user: dict = Depends(get_current_user)):
    doc = await db.sync_logs.find().sort("started_at", -1).limit(1).to_list(1)
    return _sync_log_out(doc[0]) if doc else None


@router.post("/sync", response_model=SyncLogOut)
async def trigger_sync(user: dict = Depends(get_current_user)):
    rate_limit(f"sync:{user['id']}", 2, 60)
    from lib.ingest import run_sync
    log = await run_sync(trigger="manual")
    return _sync_log_out(log)


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def dashboard_summary(user: dict = Depends(get_current_user)):
    my_games = [d["game_id"] for d in await db.user_games.find({"user_id": user["id"]}, {"game_id": 1}).to_list(500)]
    week_ago = utc_now() - timedelta(days=7)

    read_news_ids = {s["news_id"] for s in await db.user_news.find({"user_id": user["id"], "is_read": True}, {"news_id": 1}).to_list(5000)}
    tracked_news_total = await db.news.count_documents({"game_id": {"$in": my_games}}) if my_games else 0
    unread_news = max(0, tracked_news_total - len(read_news_ids)) if my_games else 0

    recent_updates = await db.game_updates.count_documents({"game_id": {"$in": my_games}, "published_at": {"$gte": week_ago}}) if my_games else 0
    upcoming_releases = await db.events.count_documents({"game_id": {"$in": my_games}, "starts_at": {"$gte": utc_now()}}) if my_games else 0
    games_with_news = len(await db.news.distinct("game_id", {"game_id": {"$in": my_games}, "published_at": {"$gte": week_ago}})) if my_games else 0

    last_log = await db.sync_logs.find().sort("started_at", -1).limit(1).to_list(1)
    return DashboardSummary(
        games_tracked=len(my_games),
        unread_news=unread_news,
        recent_updates=recent_updates,
        upcoming_releases=upcoming_releases,
        games_with_news=games_with_news,
        last_sync_at=to_utc(last_log[0].get("finished_at")) if last_log else None,
    )
