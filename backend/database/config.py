import os
import json
import urllib.parse
from typing import Optional, Tuple
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, sessionmaker

# Ensure .env from backend directory is loaded before reading DATABASE_URL
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_BACKEND_DIR, ".env"))

EXTERNAL_DB_CONFIG_FILE = os.path.join(_BACKEND_DIR, "external_db_config.json")

# Local (Default) PostgreSQL / SQLite connection string
LOCAL_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./backend/data.db")


def build_postgres_urls(
    host: str,
    port: int,
    db_name: str,
    username: str,
    password: str,
    ssl_mode: str = "prefer",
) -> Tuple[str, str]:
    """Constructs both async (postgresql+asyncpg) and sync (postgresql) URLs safely."""
    safe_user = urllib.parse.quote_plus(str(username or "postgres").strip())
    safe_pass = urllib.parse.quote_plus(str(password or ""))
    safe_host = str(host or "localhost").strip()
    safe_port = int(port or 5432)
    safe_db = str(db_name or "ai_pbx").strip()

    async_url = f"postgresql+asyncpg://{safe_user}:{safe_pass}@{safe_host}:{safe_port}/{safe_db}"
    sync_url = f"postgresql://{safe_user}:{safe_pass}@{safe_host}:{safe_port}/{safe_db}"
    if ssl_mode and ssl_mode not in ("disable", "prefer"):
        sync_url += f"?sslmode={urllib.parse.quote_plus(ssl_mode)}"
    return async_url, sync_url


def _resolve_startup_database_url() -> Tuple[str, str]:
    """Checks if external PostgreSQL is configured as primary_external and reachable at boot."""
    try:
        if os.path.exists(EXTERNAL_DB_CONFIG_FILE):
            with open(EXTERNAL_DB_CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            if cfg.get("external_db_enabled") and cfg.get("external_db_mode") == "primary_external":
                host = str(cfg.get("external_db_host") or "").strip()
                if host:
                    async_u, sync_u = build_postgres_urls(
                        host=host,
                        port=int(cfg.get("external_db_port") or 5432),
                        db_name=str(cfg.get("external_db_name") or "ai_pbx"),
                        username=str(cfg.get("external_db_user") or "postgres"),
                        password=str(cfg.get("external_db_password") or ""),
                        ssl_mode=str(cfg.get("external_db_ssl_mode") or "prefer"),
                    )
                    # Quick pre-flight test so server never crashes if external DB is temporarily down
                    test_eng = create_engine(sync_u, connect_args={"connect_timeout": 4})
                    with test_eng.connect() as conn:
                        conn.execute(text("SELECT 1"))
                    test_eng.dispose()
                    print(f"[DATABASE] Harici PostgreSQL birincil veritabanı olarak aktif edildi: {host}:{cfg.get('external_db_port', 5432)}/{cfg.get('external_db_name', 'ai_pbx')}")
                    return async_u, "external"
    except Exception as e:
        print(f"[DATABASE] Harici PostgreSQL başlangıç bağlantısı kurulamadı, yerel veritabanına (Failover) geçiliyor: {e}")

    return LOCAL_DATABASE_URL, "local"


DATABASE_URL, ACTIVE_DB_TARGET = _resolve_startup_database_url()

# Active Async & Sync database engines
engine = create_async_engine(DATABASE_URL, echo=False, future=True)

sync_db_url = DATABASE_URL.replace("postgresql+asyncpg", "postgresql").replace("sqlite+aiosqlite", "sqlite")
sync_engine = create_engine(sync_db_url, pool_pre_ping=True if "postgresql" in sync_db_url else False)

_active_async_sessionmaker = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
_active_sync_sessionmaker = sessionmaker(bind=sync_engine)


class _DynamicAsyncSessionFactory:
    """Callable proxy so all modules importing AsyncSessionLocal automatically use the active DB engine."""
    def __call__(self, *args, **kwargs):
        return _active_async_sessionmaker(*args, **kwargs)

    def __getattr__(self, name):
        return getattr(_active_async_sessionmaker, name)


class _DynamicSyncSessionFactory:
    """Callable proxy so all modules importing SyncSessionLocal automatically use the active DB engine."""
    def __call__(self, *args, **kwargs):
        return _active_sync_sessionmaker(*args, **kwargs)

    def __getattr__(self, name):
        return getattr(_active_sync_sessionmaker, name)


AsyncSessionLocal = _DynamicAsyncSessionFactory()
SyncSessionLocal = _DynamicSyncSessionFactory()


def reconfigure_active_database(new_async_url: Optional[str] = None, target_label: str = "local") -> dict:
    """Hot-reloads the active SQLAlchemy async & sync engines without requiring a server restart."""
    global DATABASE_URL, ACTIVE_DB_TARGET, engine, sync_engine, _active_async_sessionmaker, _active_sync_sessionmaker
    target_url = new_async_url or LOCAL_DATABASE_URL
    new_sync_url = target_url.replace("postgresql+asyncpg", "postgresql").replace("sqlite+aiosqlite", "sqlite")

    new_sync_eng = create_engine(new_sync_url, pool_pre_ping=True if "postgresql" in new_sync_url else False)
    with new_sync_eng.connect() as conn:
        conn.execute(text("SELECT 1"))

    new_async_eng = create_async_engine(target_url, echo=False, future=True)

    DATABASE_URL = target_url
    ACTIVE_DB_TARGET = target_label
    engine = new_async_eng
    sync_engine = new_sync_eng
    _active_async_sessionmaker = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    _active_sync_sessionmaker = sessionmaker(bind=sync_engine)
    return {"ok": True, "active_target": ACTIVE_DB_TARGET}


# Base class for models
Base = declarative_base()


async def get_db():
    """Dependency for obtaining an async database session from the currently active engine."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

