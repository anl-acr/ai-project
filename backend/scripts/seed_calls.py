import os
import sys
import asyncio
import uuid
import random
from datetime import datetime, timedelta

# Add the parent directory to Python path so backend can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from backend.database.config import AsyncSessionLocal, engine
from backend.database.models import Call

async def seed_calls(num_calls=150):
    async with AsyncSessionLocal() as session:
        topics = ["Teknik Destek", "Fatura Sorgulama", "Satış/Bilgi", "Şikayet", "İptal Talebi", "Kampanya Bilgisi"]
        sentiments = ["Pozitif", "Negatif", "Nötr", "Çok Sinirli", "Memnun"]
        statuses = ["completed", "completed", "completed", "transferred", "in_progress", "missed"]
        
        now = datetime.utcnow()
        inserted_count = 0
        
        for i in range(num_calls):
            # Random date in last 30 days
            days_ago = random.randint(0, 30)
            hours_ago = random.randint(0, 23)
            mins_ago = random.randint(0, 59)
            duration_secs = random.randint(15, 900) # 15s to 15m
            
            start_dt = now - timedelta(days=days_ago, hours=hours_ago, minutes=mins_ago)
            end_dt = start_dt + timedelta(seconds=duration_secs)
            
            status = random.choice(statuses)
            topic = random.choice(topics)
            sentiment = random.choice(sentiments)
            
            c = Call(
                id=f"seed-{uuid.uuid4().hex[:8]}",
                caller_number=f"05{random.choice(['32', '33', '35', '42', '55', '53'])}{random.randint(1000000, 9999999)}",
                callee_number=random.choice(["08501234567", "200", "201", "Destek Kuyruğu", "Satış Kuyruğu"]),
                status=status,
                start_time=start_dt,
                end_time=end_dt if status != "in_progress" and status != "missed" else (start_dt + timedelta(seconds=random.randint(5, 20)) if status == "missed" else None),
                recording_path=f"/mnt/nas/ai-recordings/{start_dt.strftime('%Y%m%d')}/rec_{uuid.uuid4().hex[:6]}.wav" if status == "completed" else None,
                summary=f"Müşteri {topic} konusunda bilgi almak için aradı. Görüşme {sentiment.lower()} bir tonda ilerledi." if status == "completed" else None,
                agent_topic=topic,
                agent_notes=f"Sistem üzerinden kontroller yapıldı. Müşteri bilgilendirildi." if status == "completed" else None,
                sentiment=sentiment,
                qa_score=random.randint(40, 100) if status == "completed" else None,
                qa_report='{"greeting": true, "empathy": false, "solution": true}' if status == "completed" else None
            )
            session.add(c)
            inserted_count += 1
        
        await session.commit()
        print(f"Successfully inserted {inserted_count} mock calls into the database.")

if __name__ == "__main__":
    asyncio.run(seed_calls(200))
