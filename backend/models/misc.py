from datetime import datetime

from pydantic import BaseModel, Field

from models.news import NewsItem

UPDATE_CATEGORIES = ["patch", "dlc", "expansao", "evento"]
EVENT_TYPES = ["lancamento", "dlc", "beta", "evento", "showcase"]
FREQUENCIES = ["imediato", "diario", "semanal", "desativado"]


class UpdateItem(BaseModel):
    id: str
    game_id: str
    game_title: str | None = None
    game_cover: str | None = None
    version: str | None = None
    title: str
    summary: str = ""
    highlights: list[str] = []
    patch_notes_url: str | None = None
    category: str = "patch"
    published_at: datetime | None = None
    is_read: bool = False
    is_recent: bool = False


class UpdatePage(BaseModel):
    items: list[UpdateItem] = []
    total: int = 0


class UpdateReadIn(BaseModel):
    is_read: bool = True


class EventItem(BaseModel):
    id: str
    game_id: str | None = None
    game_title: str | None = None
    game_cover: str | None = None
    title: str
    description: str = ""
    event_type: str = "lancamento"
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    timezone_label: str = "UTC"
    date_status: str = "confirmado"  # confirmado | estimado | tba
    source_url: str | None = None
    is_saved: bool = False
    reminder: bool = False


class EventStateIn(BaseModel):
    is_saved: bool | None = None
    reminder: bool | None = None


class NotificationItem(BaseModel):
    id: str
    title: str
    body: str = ""
    category: str
    game_id: str | None = None
    news_id: str | None = None
    is_read: bool = False
    created_at: datetime | None = None


class NotificationList(BaseModel):
    items: list[NotificationItem] = []
    unread: int = 0


class PrefItem(BaseModel):
    category: str
    enabled: bool = True
    frequency: str = "diario"


class PrefUpdate(BaseModel):
    enabled: bool | None = None
    frequency: str | None = None


class SearchResults(BaseModel):
    games: list = []
    news: list = []
    updates: list = []
    events: list = []


class SyncLogOut(BaseModel):
    id: str
    trigger: str = "manual"
    status: str = "ok"  # ok | parcial | falha | fallback
    sources_ok: int = 0
    sources_failed: int = 0
    items_fetched: int = 0
    items_inserted: int = 0
    demo_fallback: bool = False
    error: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class DashboardSummary(BaseModel):
    games_tracked: int = 0
    unread_news: int = 0
    recent_updates: int = 0
    upcoming_releases: int = 0
    games_with_news: int = 0
    last_sync_at: datetime | None = None


class SavedNewsEntry(BaseModel):
    collection_name: str = "Geral"
    personal_note: str | None = None
    saved_at: datetime | None = None
    news: NewsItem | None = None


class SavedEventEntry(BaseModel):
    personal_note: str | None = None
    reminder: bool = False
    event: EventItem | None = None


class SavedOut(BaseModel):
    news: list[SavedNewsEntry] = []
    events: list[SavedEventEntry] = []
    collections: list[dict] = []


class SavedNewsPatch(BaseModel):
    collection_name: str | None = Field(default=None, max_length=40)
    personal_note: str | None = Field(default=None, max_length=1000)


class SavedEventPatch(BaseModel):
    personal_note: str | None = Field(default=None, max_length=1000)
