from datetime import datetime

from pydantic import BaseModel, Field

GAME_STATUSES = ["quero_jogar", "jogando", "pausado", "zerado", "abandonado", "completado_100"]


class GameOut(BaseModel):
    id: str
    slug: str
    title: str
    description: str = ""
    cover_url: str | None = None
    background_url: str | None = None
    release_date: str | None = None  # YYYY-MM-DD quando conhecida
    release_date_status: str = "confirmado"  # confirmado | estimado | tba
    developer: str | None = None
    publisher: str | None = None
    platforms: list[str] = []
    genres: list[str] = []
    franchise: str | None = None
    popularity: float = 0.0
    is_free: bool = False


class SimilarOut(BaseModel):
    game: GameOut
    shared_genres: list[str] = []


class GameDetailOut(GameOut):
    similar: list[SimilarOut] = []


class UserGameCreate(BaseModel):
    game_id: str
    status: str = "quero_jogar"
    platform: str | None = None


class UserGameUpdate(BaseModel):
    status: str | None = None
    platform: str | None = None
    personal_rating: float | None = Field(default=None, ge=0, le=10)
    personal_notes: str | None = Field(default=None, max_length=2000)
    started_at: str | None = None  # YYYY-MM-DD
    completed_at: str | None = None
    hours_played: float | None = Field(default=None, ge=0, le=100000)
    is_favorite: bool | None = None
    tags: list[str] | None = None


class LibraryItem(BaseModel):
    id: str
    status: str
    platform: str | None = None
    personal_rating: float | None = None
    personal_notes: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    hours_played: float | None = None
    is_favorite: bool = False
    tags: list[str] = []
    created_at: datetime | None = None
    updated_at: datetime | None = None
    last_news_at: datetime | None = None
    game: GameOut


class LibraryItemOut(LibraryItem):
    pass


class ExploreOut(BaseModel):
    popular: list[GameOut] = []
    recent: list[GameOut] = []
    upcoming: list[GameOut] = []
    recommended: list[GameOut] = []
    free: list[GameOut] = []
    franchises: list[dict] = []
    genres: list[str] = []
    platforms: list[str] = []
