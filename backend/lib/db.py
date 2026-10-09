"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "users": [
        IndexModel([("email", ASCENDING)], name="email", unique=True),
    ],
    "games": [
        IndexModel([("slug", ASCENDING)], name="slug", unique=True),
        IndexModel([("popularity", DESCENDING)], name="popularity_desc"),
        IndexModel([("release_date", ASCENDING)], name="release_date_asc"),
        IndexModel([("genres", ASCENDING)], name="genres_asc"),
        IndexModel([("franchise", ASCENDING)], name="franchise_asc"),
    ],
    "user_games": [
        IndexModel([("user_id", ASCENDING), ("game_id", ASCENDING)], name="user_game", unique=True),
        IndexModel([("user_id", ASCENDING), ("updated_at", DESCENDING)], name="user_updated"),
    ],
    "news": [
        IndexModel([("content_hash", ASCENDING)], name="content_hash"),
        IndexModel([("published_at", DESCENDING)], name="published_desc"),
        IndexModel([("game_id", ASCENDING), ("published_at", DESCENDING)], name="game_published"),
        IndexModel([("category", ASCENDING), ("published_at", DESCENDING)], name="category_published"),
        IndexModel([("source_name", ASCENDING)], name="source_name"),
    ],
    "user_news": [
        IndexModel([("user_id", ASCENDING), ("news_id", ASCENDING)], name="user_news", unique=True),
        IndexModel([("user_id", ASCENDING), ("is_saved", ASCENDING)], name="user_saved"),
        IndexModel([("user_id", ASCENDING), ("is_read", ASCENDING)], name="user_read"),
    ],
    "game_updates": [
        IndexModel([("published_at", DESCENDING)], name="published_desc"),
        IndexModel([("game_id", ASCENDING), ("published_at", DESCENDING)], name="game_published"),
        IndexModel([("game_id", ASCENDING), ("version", ASCENDING)], name="game_version"),
    ],
    "events": [
        IndexModel([("starts_at", ASCENDING)], name="starts_asc"),
        IndexModel([("game_id", ASCENDING), ("starts_at", ASCENDING)], name="game_starts"),
        IndexModel([("event_type", ASCENDING), ("starts_at", ASCENDING)], name="type_starts"),
    ],
    "user_updates": [
        IndexModel([("user_id", ASCENDING), ("update_id", ASCENDING)], name="user_update", unique=True),
    ],
    "user_events": [
        IndexModel([("user_id", ASCENDING), ("event_id", ASCENDING)], name="user_event", unique=True),
    ],
    "notifications": [
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"),
        IndexModel([("user_id", ASCENDING), ("is_read", ASCENDING)], name="user_unread"),
    ],
    "notification_preferences": [
        IndexModel([("user_id", ASCENDING), ("category", ASCENDING)], name="user_category", unique=True),
    ],
    "sync_logs": [
        IndexModel([("started_at", DESCENDING)], name="started_desc"),
    ],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
