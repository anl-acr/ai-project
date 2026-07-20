import asyncio
import os
import sys
import random
from datetime import datetime, timedelta

# Add parent directory to python path so we can import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database.config import AsyncSessionLocal
from backend.database.models import Call

async def seed_calls():
    async with AsyncSessionLocal() as session:
        # Check if there are already calls
        from sqlalchemy import select, func
        count_stmt = select(func.count(Call.id))
        count_res = await session.execute(count_stmt)
        count = count_res.scalar()
        
        if count > 10:
            print(f"Already {count} calls in the database. Deleting them to re-seed...")
            from sqlalchemy import delete
            await session.execute(delete(Call))
            await session.commit()

        print("Seeding database with 50 mock calls...")
        
        now = datetime.utcnow()
        topics = ["Teknik Destek", "Fatura / Ödeme", "Yeni Abonelik", "Şikayet", "Bilgi Alma"]
        sentiments = ["Olumlu", "Nötr", "Kızgın", "Hüsran"]
        
        calls = []
        for i in range(50):
            # Calls spread out over the last 24 hours
            minutes_ago = random.randint(10, 1440)
            start_time = now - timedelta(minutes=minutes_ago)
            duration = random.randint(30, 600)  # 30 seconds to 10 minutes
            end_time = start_time + timedelta(seconds=duration)
            
            qa = random.randint(50, 100)
            
            call = Call(
                id=f"MOCK-{int(start_time.timestamp())}-{i}",
                caller_number=f"05{random.randint(30, 55)}{random.randint(1000000, 9999999)}",
                callee_number=f"20{random.randint(0, 5)}",
                status="completed",
                start_time=start_time,
                end_time=end_time,
                summary="Bu görüşme yapay zeka tarafından mock (sahte) veri olarak oluşturulmuştur.",
                agent_topic=random.choice(topics),
                agent_notes="Müşteriye bilgi verildi.",
                sentiment=random.choice(sentiments),
                qa_score=qa,
                qa_report="Görüşme standartlara uygun geçmiştir." if qa > 80 else "Müşteri bekleme süresinden şikayetçi."
            )
            session.add(call)
            calls.append(call)
            
        await session.commit()
        print("Successfully seeded 50 calls!")

if __name__ == "__main__":
    asyncio.run(seed_calls())
