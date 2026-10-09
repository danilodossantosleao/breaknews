from datetime import datetime

from pydantic import BaseModel, Field

NEWS_CATEGORIES = [
    "noticias",
    "atualizacao",
    "dlc",
    "lancamento",
    "evento",
    "trailer",
    "analise",
    "promocao",
    "manutencao",
    "alerta",
]


class AISummaryContent(BaseModel):
    resumo_curto: str
    resumo_detalhado: str
    pontos_principais: list[str] = []
    impacto_jogadores: str = ""
    gerado_em: datetime | None = None


class NewsItem(BaseModel):
    id: str
    title: str
    summary: str = ""
    image_url: str | None = None
    category: str
    source_name: str
    source_url: str = ""
    published_at: datetime | None = None
    is_official: bool = False
    is_demo: bool = False
    game_id: str | None = None
    game_title: str | None = None
    game_cover: str | None = None
    read: bool = False
    saved: bool = False
    ai_summary: AISummaryContent | None = None


class NewsPage(BaseModel):
    items: list[NewsItem] = []
    total: int = 0
    page: int = 1
    page_size: int = 12


class NewsFacets(BaseModel):
    sources: list[dict] = []
    categories: list[dict] = []
    unread: int = 0
    saved: int = 0


class NewsStateIn(BaseModel):
    is_read: bool | None = None
    is_saved: bool | None = None
    collection_name: str | None = Field(default=None, max_length=40)


class ReadAllIn(BaseModel):
    game_id: str | None = None


class AISummaryOut(BaseModel):
    news_id: str
    summary: AISummaryContent


class AIStatusOut(BaseModel):
    enabled: bool
