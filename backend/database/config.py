import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

# PostgreSQL / SQLite connection string
# Uses DATABASE_URL env var if set, otherwise defaults to local SQLite database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./backend/data.db")

# Async database engine
engine = create_async_engine(DATABASE_URL, echo=False, future=True)


# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

# Sync database engine & session factory for synchronous helper calls
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
sync_db_url = DATABASE_URL.replace("postgresql+asyncpg", "postgresql").replace("sqlite+aiosqlite", "sqlite")
sync_engine = create_engine(sync_db_url, pool_pre_ping=True if "postgresql" in sync_db_url else False)

SyncSessionLocal = sessionmaker(bind=sync_engine)

# Base class for models
Base = declarative_base()

async def get_db():
    """Dependency for obtaining an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
