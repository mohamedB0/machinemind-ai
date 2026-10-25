from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import engine, Base
from app.api.routes import auth, machines, chat, manuals, help_chat

# Import all models so Alembic / create_all can see them
from app.models import user, machine, rag  # noqa: F401

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Enable pgvector extension, then create all tables
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
        # Defensive dev migration for pre-existing databases (no alembic versions in this project)
        await conn.execute(text(
            "ALTER TABLE document_pages ADD COLUMN IF NOT EXISTS has_figure BOOLEAN NOT NULL DEFAULT FALSE"
        ))
    yield


app = FastAPI(
    title="MachineMind AI",
    description="RAG-powered technical assistant for machine manuals",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(machines.router)
app.include_router(manuals.router)
app.include_router(chat.router)
app.include_router(help_chat.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
