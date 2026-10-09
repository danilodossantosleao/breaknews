"""News Center: feed com filtros, estado de leitura/salvamento, facetas e resumo por IA."""

import asyncio
import json
import os
import re
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.dates import to_utc, utc_now
from lib.db import db
from lib.security import client_ip, get_current_user, rate_limit, safe_text
from models.news import (
    AISummaryContent,
    AISummaryOut,
    AIStatusOut,
    NEWS_CATEGORIES,
    NewsFacets,
    NewsItem,
    NewsPage,
    NewsStateIn,
    ReadAllIn,
)

router = APIRouter()


async def _user_state_map(user_id: str, news_ids: list[str]) -> dict[str, dict]:
    if not news_ids:
        return {}
    docs = await db.user_news.find({"user_id": user_id, "news_id": {"$in": news_ids}}).to_list(len(news_ids) * 2)
    return {d["news_id"]: d for d in docs}


async def _game_map(ids: list[str]) -> dict[str, dict]:
    if not ids:
        return {}
    docs = await db.games.find({"id": {"$in": ids}}, {"id": 1, "title": 1, "cover_url": 1}).to_list(len(ids) * 2)
    return {d["id"]: d for d in docs}


def _news_item(doc: dict, state: dict | None, game_doc: dict | None) -> NewsItem:
    ai = doc.get("ai_summary")
    return NewsItem(
        id=doc["id"],
        title=doc["title"],
        summary=doc.get("summary", ""),
        image_url=doc.get("image_url"),
        category=doc.get("category", "noticias"),
        source_name=doc.get("source_name", "Fonte desconhecida"),
        source_url=doc.get("source_url", ""),
        published_at=to_utc(doc.get("published_at")),
        is_official=doc.get("is_official", False),
        is_demo=doc.get("is_demo", False),
        game_id=doc.get("game_id"),
        game_title=game_doc["title"] if game_doc else doc.get("game_title"),
        game_cover=game_doc.get("cover_url") if game_doc else None,
        read=bool(state and state.get("is_read")),
        saved=bool(state and state.get("is_saved")),
        ai_summary=AISummaryContent(**ai) if ai else None,
    )


def _period_days(period: str | None) -> int | None:
    return {"7d": 7, "30d": 30, "90d": 90}.get(period or "", None)


@router.get("/news", response_model=NewsPage)
async def list_news(
    q: str = "",
    game_id: str | None = None,
    category: str | None = None,
    source: str | None = None,
    period: str | None = None,
    read: bool | None = None,
    saved: bool | None = None,
    official: bool | None = None,
    tracked: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=50),
    user: dict = Depends(get_current_user),
):
    query: dict = {}
    if tracked:
        my_games = [d["game_id"] for d in await db.user_games.find({"user_id": user["id"]}, {"game_id": 1}).to_list(500)]
        if not my_games:
            return NewsPage(page=page, page_size=page_size, total=0)
        query["game_id"] = {"$in": my_games}
    if q:
        rx = {"$regex": re.escape(q.strip())[:80], "$options": "i"}
        query["$or"] = [{"title": rx}, {"summary": rx}]
    if game_id:
        query["game_id"] = game_id
    if category and category in NEWS_CATEGORIES:
        query["category"] = category
    if source:
        query["source_name"] = source
    if official is not None:
        query["is_official"] = official
    days = _period_days(period)
    if days:
        query["published_at"] = {"$gte": utc_now() - timedelta(days=days)}

    # Estado de leitura/salvamento do usuário
    if read is not None or saved is not None:
        states = await db.user_news.find({"user_id": user["id"]}).to_list(5000)
        read_ids = {s["news_id"] for s in states if s.get("is_read")}
        saved_ids = {s["news_id"] for s in states if s.get("is_saved")}
        if read is not None:
            query["id"] = {"$in": list(read_ids)} if read else {"$nin": list(read_ids)}
        if saved is not None:
            base = query.get("id")
            if isinstance(base, dict):
                base["$in" if saved else "$nin"] = list(saved_ids) if saved else list(saved_ids)
            else:
                query["id"] = {"$in": list(saved_ids)} if saved else {"$nin": list(saved_ids)}

    total = await db.news.count_documents(query)
    docs = await db.news.find(query).sort("published_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    games = await _game_map([d.get("game_id") for d in docs if d.get("game_id")])
    states = await _user_state_map(user["id"], [d["id"] for d in docs])
    items = [_news_item(d, states.get(d["id"]), games.get(d.get("game_id"))) for d in docs]
    return NewsPage(items=items, total=total, page=page, page_size=page_size)


@router.get("/news/facets", response_model=NewsFacets)
async def news_facets(user: dict = Depends(get_current_user)):
    sources = await db.news.aggregate([
        {"$group": {"_id": "$source_name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 30},
    ]).to_list(30)
    categories = await db.news.aggregate([
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]).to_list(20)
    my_games = [d["game_id"] for d in await db.user_games.find({"user_id": user["id"]}, {"game_id": 1}).to_list(500)]
    total_tracked = await db.news.count_documents({"game_id": {"$in": my_games}}) if my_games else 0
    read_count = await db.user_news.count_documents({"user_id": user["id"], "is_read": True})
    saved_count = await db.user_news.count_documents({"user_id": user["id"], "is_saved": True})
    return NewsFacets(
        sources=[{"name": r["_id"], "count": r["count"]} for r in sources if r["_id"]],
        categories=[{"name": r["_id"], "count": r["count"]} for r in categories],
        unread=max(0, total_tracked - read_count),
        saved=saved_count,
    )


@router.get("/news/{news_id}", response_model=NewsItem)
async def news_detail(news_id: str, user: dict = Depends(get_current_user)):
    doc = await db.news.find_one({"id": news_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Notícia não encontrada.")
    state = await db.user_news.find_one({"user_id": user["id"], "news_id": news_id})
    game_doc = await db.games.find_one({"id": doc.get("game_id")}, {"id": 1, "title": 1, "cover_url": 1}) if doc.get("game_id") else None
    return _news_item(doc, state, game_doc)


@router.post("/news/{news_id}/state")
async def set_news_state(news_id: str, data: NewsStateIn, user: dict = Depends(get_current_user)):
    news = await db.news.find_one({"id": news_id}, {"_id": 1})
    if not news:
        raise HTTPException(status_code=404, detail="Notícia não encontrada.")
    updates: dict = {"updated_at": utc_now()}
    if data.is_read is not None:
        updates["is_read"] = data.is_read
        updates["read_at"] = utc_now() if data.is_read else None
    if data.is_saved is not None:
        updates["is_saved"] = data.is_saved
        updates["saved_at"] = utc_now() if data.is_saved else None
    if data.collection_name is not None:
        updates["collection_name"] = safe_text(data.collection_name, 40) or "Geral"
    await db.user_news.update_one(
        {"user_id": user["id"], "news_id": news_id},
        {"$set": updates, "$setOnInsert": {"created_at": utc_now()}},
        upsert=True,
    )
    state = await db.user_news.find_one({"user_id": user["id"], "news_id": news_id})
    return {"read": bool(state.get("is_read")), "saved": bool(state.get("is_saved")),
            "collection_name": state.get("collection_name", "Geral")}


@router.post("/news/read-all")
async def read_all(data: ReadAllIn, user: dict = Depends(get_current_user)):
    query: dict = {}
    if data.game_id:
        query["game_id"] = data.game_id
    else:
        my_games = [d["game_id"] for d in await db.user_games.find({"user_id": user["id"]}, {"game_id": 1}).to_list(500)]
        if not my_games:
            return {"updated": 0}
        query["game_id"] = {"$in": my_games}
    news_docs = await db.news.find(query, {"id": 1}).to_list(2000)
    already = {s["news_id"] for s in await db.user_news.find({"user_id": user["id"], "is_read": True}, {"news_id": 1}).to_list(5000)}
    now = utc_now()
    new_states = [
        {"id": str(uuid.uuid4()), "user_id": user["id"], "news_id": d["id"], "is_read": True,
         "is_saved": False, "read_at": now, "saved_at": None, "collection_name": "Geral",
         "created_at": now, "updated_at": now}
        for d in news_docs if d["id"] not in already
    ]
    if new_states:
        await db.user_news.insert_many(new_states)
    return {"updated": len(new_states)}


# ---------- Resumo por IA (opcional; requer EMERGENT_LLM_KEY) ----------

def _ai_enabled() -> bool:
    return bool(os.environ.get("EMERGENT_LLM_KEY"))


@router.get("/ai/status", response_model=AIStatusOut)
async def ai_status():
    return AIStatusOut(enabled=_ai_enabled())


def _extract_json(raw: str) -> dict:
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        raise ValueError("sem JSON na resposta")
    return json.loads(match.group(0))


@router.post("/news/{news_id}/ai-summary", response_model=AISummaryOut)
async def generate_ai_summary(news_id: str, user: dict = Depends(get_current_user)):
    if not _ai_enabled():
        raise HTTPException(status_code=501, detail="Provedor de IA não configurado neste ambiente.")
    rate_limit(f"ai:user:{user['id']}", 12, 60)

    doc = await db.news.find_one({"id": news_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Notícia não encontrada.")
    if doc.get("ai_summary"):
        return AISummaryOut(news_id=news_id, summary=AISummaryContent(**doc["ai_summary"]))

    from emergentintegrations.llm.chat import LlmChat, UserMessage

    system = (
        "Você é um analista de notícias de games do NEXUS Gaming Hub. Gere resumos fiéis ao "
        "conteúdo fornecido, em português brasileiro. NUNCA invente informações ausentes; se um "
        "dado não estiver no texto, indique 'Não informado'. Responda APENAS com um JSON válido "
        'no formato: {"resumo_curto": str (máx 140 chars), "resumo_detalhado": str (2-3 parágrafos '
        'curtos), "pontos_principais": [str], "impacto_jogadores": str (máx 200 chars)}.'
    )
    article = (
        f"Título: {doc['title']}\n"
        f"Fonte: {doc.get('source_name', 'Não informado')} ({'anúncio oficial' if doc.get('is_official') else 'veículo independente'})\n"
        f"Resumo publicado: {doc.get('summary', 'Não informado')}\n"
        f"Categoria: {doc.get('category')}"
    )
    chat = LlmChat(
        api_key=os.environ["EMERGENT_LLM_KEY"],
        session_id=f"nexus-summary-{news_id}",
        system_message=system,
    ).with_model("openai", "gpt-5.4")

    try:
        resp = await asyncio.wait_for(chat.send_message(UserMessage(text=article)), timeout=60)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="O provedor de IA não respondeu a tempo.") from exc

    raw = getattr(resp, "content", None) or (resp.get("content") if isinstance(resp, dict) else str(resp))
    try:
        parsed = _extract_json(raw)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="Não foi possível interpretar o resumo gerado.") from exc

    summary = AISummaryContent(
        resumo_curto=safe_text(str(parsed.get("resumo_curto", "")), 200) or "Não informado",
        resumo_detalhado=safe_text(str(parsed.get("resumo_detalhado", "")), 4000) or "",
        pontos_principais=[safe_text(p, 300) for p in (parsed.get("pontos_principais") or [])[:8] if p],
        impacto_jogadores=safe_text(str(parsed.get("impacto_jogadores", "")), 400) or "",
        gerado_em=utc_now(),
    )
    await db.news.update_one({"id": news_id}, {"$set": {"ai_summary": summary.model_dump(mode="json")}})
    return AISummaryOut(news_id=news_id, summary=summary)
