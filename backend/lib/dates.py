"""Server-side date helpers. The pod clock is UTC — anchor "today" here, never in the browser."""

import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo


def today_iso(tz: str | None = None) -> str:
    """Today's date as YYYY-MM-DD in `tz` (default: APP_TZ env, else UTC)."""
    zone = tz or os.environ.get("APP_TZ", "UTC")
    return datetime.now(ZoneInfo(zone)).strftime("%Y-%m-%d")


def utc_now() -> datetime:
    """Aware UTC now — store aware datetimes so Pydantic serialises with an offset."""
    return datetime.now(timezone.utc)


def to_utc(dt: datetime | None) -> datetime | None:
    """Normalise a naive BSON datetime to aware UTC so `new Date(...)` parses it correctly."""
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
