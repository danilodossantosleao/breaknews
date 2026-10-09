from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    display_name: str = Field(min_length=2, max_length=40)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=40)
    avatar_url: str | None = None
    theme: str | None = None  # "dark" | "light"
    locale: str | None = None
    notification_frequency: str | None = None  # imediato | diario | semanal | desativado
    favorite_platforms: list[str] | None = None
    favorite_genres: list[str] | None = None
    onboarding_done: bool | None = None


class OnboardingData(BaseModel):
    platforms: list[str] = []
    genres: list[str] = []
    game_ids: list[str] = []
    notification_frequency: str = "diario"


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str
    avatar_url: str | None = None
    theme: str = "dark"
    locale: str = "pt-BR"
    notification_frequency: str = "diario"
    favorite_platforms: list[str] = []
    favorite_genres: list[str] = []
    onboarding_done: bool = False
    created_at: datetime | None = None


class MessageOut(BaseModel):
    ok: bool = True
    message: str = ""
