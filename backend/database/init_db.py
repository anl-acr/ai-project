import asyncio
from sqlalchemy import text
from backend.database.config import engine, Base
from backend.database.models import Call, Transcript, Rule, Appointment, DocumentChunk, ChatSession, ChatMessage, Contact, CannedResponse, BlacklistItem, BlockWord, QAQuestion

async def init_db():
    print("Veritabanı bağlantısı kuruluyor ve pgvector aktifleştiriliyor...")
    async with engine.begin() as conn:
        # Enable pgvector extension
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        print("pgvector uzantısı aktifleştirildi.")
        
        # Create all tables
        print("Tablolar oluşturuluyor...")
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("ALTER TABLE calls ADD COLUMN IF NOT EXISTS sentiment VARCHAR;"))
        await conn.execute(text("ALTER TABLE calls ADD COLUMN IF NOT EXISTS qa_score INTEGER;"))
        await conn.execute(text("ALTER TABLE calls ADD COLUMN IF NOT EXISTS qa_report TEXT;"))
        await conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS qa_score INTEGER;"))
        await conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS qa_report TEXT;"))
        await conn.execute(text("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS voiceprint TEXT;"))
        print("Tüm tablolar başarıyla oluşturuldu!")

if __name__ == "__main__":
    asyncio.run(init_db())
