import asyncio
from sqlalchemy import text
from backend.database.config import engine, Base
from backend.database.models import Call, Transcript, Rule, Appointment, DocumentChunk

async def init_db():
    print("Veritabanı bağlantısı kuruluyor ve pgvector aktifleştiriliyor...")
    async with engine.begin() as conn:
        # Enable pgvector extension
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        print("pgvector uzantısı aktifleştirildi.")
        
        # Create all tables
        print("Tablolar oluşturuluyor...")
        await conn.run_sync(Base.metadata.create_all)
        print("Tüm tablolar başarıyla oluşturuldu!")

if __name__ == "__main__":
    asyncio.run(init_db())
