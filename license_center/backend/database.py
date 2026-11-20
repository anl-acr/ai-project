import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "license_center.db")
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

async def get_central_db():
    async with AsyncSessionLocal() as session:
        yield session

from sqlalchemy import text

async def init_central_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for ddl in [
            "ALTER TABLE client_servers ADD COLUMN custom_quotas TEXT;",
            "ALTER TABLE client_servers ADD COLUMN tenant_serial_number VARCHAR;",
            "ALTER TABLE client_servers ADD COLUMN system_serial_number VARCHAR;",
            "ALTER TABLE client_servers ADD COLUMN connect_subdomain VARCHAR;",
            "ALTER TABLE client_servers ADD COLUMN remote_ssh_enabled BOOLEAN DEFAULT 1;",
            "ALTER TABLE master_users ADD COLUMN totp_secret VARCHAR;",
            "ALTER TABLE master_users ADD COLUMN totp_enabled BOOLEAN DEFAULT 0;",
            "ALTER TABLE master_users ADD COLUMN email_2fa_enabled BOOLEAN DEFAULT 0;",
            "ALTER TABLE master_security_policy ADD COLUMN smtp_host VARCHAR DEFAULT '';",
            "ALTER TABLE master_security_policy ADD COLUMN smtp_port INTEGER DEFAULT 587;",
            "ALTER TABLE master_security_policy ADD COLUMN smtp_user VARCHAR DEFAULT '';",
            "ALTER TABLE master_security_policy ADD COLUMN smtp_password VARCHAR DEFAULT '';",
            "ALTER TABLE master_security_policy ADD COLUMN smtp_from_email VARCHAR DEFAULT '';",
            "ALTER TABLE master_security_policy ADD COLUMN smtp_use_tls BOOLEAN DEFAULT 1;"
        ]:
            try:
                await conn.execute(text(ddl))
            except Exception:
                pass
