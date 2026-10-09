"""Ingestão de notícias via feeds RSS/Atom públicos — normalização, dedupe, categorização,
match com o catálogo, notificações internas e log de sincronização.

Fontes públicas e legalmente acessíveis (feeds RSS oficiais). Sem chave de API.
Se nenhuma fonte responder, o log marca `fallback` — o lote de demonstração do seed
(permanentemente rotulado `is_demo=True`) continua cobrindo a interface.
"""

import asyncio
import hashlib
import html
import logging
import os
import re
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

import httpx

from lib.db import db
from lib.dates import utc_now

logger = logging.getLogger(__name__)

FEEDS = [
    {"name": "PlayStation Blog", "url": "https://blog.playstation.com/feed/", "official": True},
    {"name": "Xbox Wire", "url": "https://news.xbox.com/feed/", "official": True},
    {"name": "Rock Paper Shotgun", "url": "https://www.rockpapershotgun.com/feed", "official": False},
    {"name": "PC Gamer", "url": "https://www.pcgamer.com/rss/", "official": False},
    {"name": "Polygon", "url": "https://www.polygon.com/rss/index.xml", "official": False},
    {"name": "IGN", "url": "https://feeds.ign.com/ign/games-all", "official": False},
]

PER_FEED_LIMIT = 15
FETCH_TIMEOUT = 10.0
BACKOFF = [1, 3]

CATEGORY_RULES = [
    (r"patch|atualiza|update|corre|fix|balancea|hotfix| buff | nerf |versão \d", "atualizacao"),
    (r"dlc|expansão|expansion", "dlc"),
    (r"trailer|gameplay|teaser|cinemát", "trailer"),
    (r"análise|analise|review|avaliação|nota", "analise"),
    (r"grátis|gratis|free|gratuito|promoção|desconto|sale|oferta", "promocao"),
    (r"manutenção|servidores|servers|indispon|offline|down", "manutencao"),
    (r"evento|showcase|gamescom|games beat|state of play|nintendo direct|the game awards|e3", "evento"),
    (r"lançamento|lanca |release date|chega em|chegará|estreia", "lancamento"),
    (r"alerta|recall|aviso oficial|segurança", "alerta"),
]

STOP_TOKENS = {"the", "of", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "2", "3", "4", "5", "6"}


def _clean_text(raw: str | None, limit: int = 400) -> str:
    if not raw:
        return ""
    text = re.sub(r"<[^>]+>", " ", raw)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]


def _canon_url(url: str) -> str:
    """Canonical URL: lowercase host, strip tracking params and trailing slash."""
    try:
        base, _, query = url.partition("?")
        if query:
            kept = [
                p for p in query.split("&")
                if p and not re.match(r"^(utm_|fbclid|gclid|ref)", p, re.IGNORECASE)
            ]
            if kept:
                base = base + "?" + "&".join(kept)
        return base.rstrip("/")
    except Exception:
        return url


def content_hash(url: str, title: str) -> str:
    return hashlib.sha1(f"{_canon_url(url)}|{title.strip().lower()[:140]}".encode()).hexdigest()


def _parse_date(raw: str | None) -> datetime | None:
    if not raw:
        return None
    raw = raw.strip()
    try:
        dt = parsedate_to_datetime(raw)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        pass
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            dt = datetime.strptime(raw, fmt)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _first_img(item_text: str) -> str | None:
    match = re.search(r"<img[^>]+src=[\"']([^\"']+)[\"']", item_text or "", re.IGNORECASE)
    return match.group(1) if match else None


def _parse_feed(xml_text: str) -> list[dict]:
    """Parse RSS 2.0 or Atom into normalized item dicts."""
    root = ET.fromstring(xml_text.encode("utf-8") if isinstance(xml_text, str) else xml_text)
    items: list[dict] = []
    atom_ns = "{http://www.w3.org/2005/Atom}"
    media_ns = "{http://search.yahoo.com/mrss/}"

    entries = root.findall(".//item") or root.findall(f".//{atom_ns}entry")
    for entry in entries:
        def txt(tag: str) -> str | None:
            el = entry.find(tag)
            if el is None:
                return None
            return el.text or (el.get("href") if tag == f"{atom_ns}link" else None)

        title = _clean_text(txt("title"), 300)
        link = txt("link") or ""
        if not title or not link:
            continue
        description = _clean_text(txt("description") or txt(f"{atom_ns}summary") or txt(f"{atom_ns}content"), 500)
        published = _parse_date(txt("pubDate") or txt(f"{atom_ns}published") or txt(f"{atom_ns}updated"))

        image = None
        enc = entry.find("enclosure")
        if enc is not None and enc.get("url", "").startswith("http"):
            image = enc.get("url")
        if not image:
            media = entry.find(f"{media_ns}content") or entry.find(f"{media_ns}thumbnail")
            if media is not None and (media.get("url") or "").startswith("http"):
                image = media.get("url")
        if not image:
            image = _first_img(txt("description") or txt(f"{atom_ns}content") or "")

        items.append({"title": title, "url": link, "description": description, "published_at": published, "image_url": image})
    return items


def categorize(title: str, summary: str) -> str:
    blob = f" {title.lower()} {summary.lower()} "
    for pattern, category in CATEGORY_RULES:
        if re.search(pattern, blob):
            return category
    return "noticias"


def _tokens(text: str) -> set[str]:
    return {t for t in re.split(r"[^a-z0-9]+", text.lower()) if len(t) > 2 and t not in STOP_TOKENS}


async def _load_game_index() -> list[dict]:
    docs = await db.games.find({}, {"id": 1, "title": 1, "aliases": 1}).to_list(500)
    for doc in docs:
        doc["_tokens"] = _tokens(doc["title"])
        for alias in doc.get("aliases") or []:
            doc["_tokens"].update(_tokens(alias))
    return docs


def match_game(news_title: str, game_index: list[dict]) -> str | None:
    title_tokens = _tokens(news_title)
    best, best_score = None, 0.0
    for game in game_index:
        tokens = game["_tokens"]
        if not tokens:
            continue
        overlap = len(tokens & title_tokens) / len(tokens)
        if game["title"].lower() in news_title.lower():
            overlap = 1.0
        if overlap > best_score:
            best, best_score = game["id"], overlap
    return best if best_score >= 0.66 else None


async def _fetch_feed(client: httpx.AsyncClient, feed: dict) -> list[dict]:
    last_error: Exception | None = None
    for attempt, delay in enumerate([0] + BACKOFF):
        if delay:
            await asyncio.sleep(delay)
        try:
            resp = await client.get(feed["url"], timeout=FETCH_TIMEOUT, follow_redirects=True,
                                    headers={"User-Agent": "NexusGamingHub/1.0 (+news reader)"})
            resp.raise_for_status()
            items = _parse_feed(resp.text)
            logger.info("ingest: %s → %d itens", feed["name"], len(items))
            return items
        except Exception as exc:  # noqa: BLE001 — feed individual pode estar fora
            last_error = exc
            logger.warning("ingest: falha em %s (tentativa %d): %s", feed["name"], attempt + 1, exc)
    logger.error("ingest: fonte %s indisponível: %s", feed["name"], last_error)
    raise ConnectionError(str(last_error))


async def _notify_trackers(game_id: str, news_doc: dict) -> None:
    trackers = await db.user_games.find({"game_id": game_id}, {"user_id": 1}).to_list(1000)
    for tracker in trackers:
        user_id = tracker["user_id"]
        profile = await db.users.find_one({"id": user_id}, {"notification_frequency": 1})
        if profile and profile.get("notification_frequency") == "desativado":
            continue
        pref = await db.notification_preferences.find_one({"user_id": user_id, "category": news_doc["category"]})
        if pref and (not pref.get("enabled", True) or pref.get("frequency") == "desativado"):
            continue
        await db.notifications.update_one(
            {"user_id": user_id, "news_id": news_doc["id"]},
            {"$setOnInsert": {
                "id": str(uuid.uuid4()),
                "title": f"Novidade: {news_doc['title'][:120]}",
                "body": news_doc.get("summary", "")[:180],
                "category": news_doc["category"],
                "game_id": game_id,
                "news_id": news_doc["id"],
                "is_read": False,
                "created_at": utc_now(),
            }},
            upsert=True,
        )


async def run_sync(trigger: str = "manual") -> dict:
    """Ciclo completo: buscar → normalizar → dedup → registrar → notificar → log."""
    started = utc_now()
    sources_ok = sources_failed = fetched = inserted = 0
    demo_fallback = False

    game_index = await _load_game_index()

    async with httpx.AsyncClient() as client:
        for feed in FEEDS:
            try:
                items = await _fetch_feed(client, feed)
                sources_ok += 1
            except Exception:
                sources_failed += 1
                continue
            fetched += len(items)
            for item in items[:PER_FEED_LIMIT]:
                c_hash = content_hash(item["url"], item["title"])
                if await db.news.find_one({"content_hash": c_hash}, {"_id": 1}):
                    continue
                game_id = match_game(item["title"], game_index)
                published = item["published_at"] or utc_now()
                category = categorize(item["title"], item["description"])
                doc = {
                    "id": str(uuid.uuid4()),
                    "external_id": None,
                    "source_name": feed["name"],
                    "source_url": item["url"][:600],
                    "canonical_url": _canon_url(item["url"])[:600],
                    "title": item["title"][:280],
                    "summary": item["description"],
                    "image_url": item["image_url"][:600] if item["image_url"] else None,
                    "category": category,
                    "published_at": published,
                    "is_official": feed["official"],
                    "is_demo": False,
                    "content_hash": c_hash,
                    "game_id": game_id,
                    "ai_summary": None,
                    "created_at": utc_now(),
                }
                await db.news.insert_one(doc)
                inserted += 1
                if game_id:
                    await _notify_trackers(game_id, doc)

    # Retenção configurável: descarta notícias antigas e seus estados por usuário
    retention_days = int(os.environ.get("NEWS_RETENTION_DAYS", "120"))
    cutoff = started - timedelta(days=retention_days)
    old = await db.news.find({"published_at": {"$lt": cutoff}}, {"id": 1}).to_list(2000)
    if old:
        old_ids = [doc["id"] for doc in old]
        await db.news.delete_many({"id": {"$in": old_ids}})
        await db.user_news.delete_many({"news_id": {"$in": old_ids}})

    status = "ok"
    if fetched == 0:
        status = "fallback"
        demo_fallback = True
    elif sources_failed > 0:
        status = "parcial"

    log = {
        "id": str(uuid.uuid4()),
        "trigger": trigger,
        "status": status,
        "sources_ok": sources_ok,
        "sources_failed": sources_failed,
        "items_fetched": fetched,
        "items_inserted": inserted,
        "demo_fallback": demo_fallback,
        "error": None if sources_failed == 0 else f"{sources_failed} fonte(s) indisponível(is)",
        "started_at": started,
        "finished_at": utc_now(),
    }
    await db.sync_logs.insert_one(log)
    logger.info("ingest: sincronização %s — %d novos itens", status, inserted)
    return log
