import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
from lib.db import client, db, ensure_indexes

from routers import auth as auth_router
from routers import games as games_router
from routers import news as news_router
from routers import updates as updates_router
from routers import notifications as notifications_router
from routers import saved as saved_router
from routers import misc as misc_router

logger = logging.getLogger(__name__)


async def _sync_loop() -> None:
    """Rotina periódica de sincronização (server-side) — roda mesmo com o site fechado."""
    from lib.ingest import run_sync
    interval = int(os.environ.get("SYNC_INTERVAL_MINUTES", "360"))
    await asyncio.sleep(20)  # pequena folga após o boot
    while True:
        try:
            await run_sync(trigger="auto")
        except Exception as exc:  # noqa: BLE001
            logger.error("sync_loop: %s", exc)
        await asyncio.sleep(max(15, interval) * 60)


# Startup runs before the yield, shutdown after it. Add your own setup/teardown here.
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.index_task = asyncio.create_task(ensure_indexes())  # background: a big index build must not block boot
    app.state.sync_task = asyncio.create_task(_sync_loop())
    yield
    app.state.sync_task.cancel()
    client.close()


# Create the main app without a prefix
app = FastAPI(lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.model_dump())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


# NEXUS feature routers
api_router.include_router(auth_router.router)
api_router.include_router(games_router.router)
api_router.include_router(news_router.router)
api_router.include_router(updates_router.router)
api_router.include_router(notifications_router.router)
api_router.include_router(saved_router.router)
api_router.include_router(misc_router.router)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
