import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

# PostgreSQL connection string
# During development, it will look at environment variables or default to the Docker container database.
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://admin:admin_password123@localhost:5444/ai_pbx"
)

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
sync_db_url = DATABASE_URL.replace("postgresql+asyncpg", "postgresql")
sync_engine = create_engine(sync_db_url, pool_pre_ping=True)
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
