import asyncio
from backend.database.config import AsyncSessionLocal
from backend.database.models import Transcript
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as session:
        for cid in ["call_test_deepfake", "call_test_regular", "test-call-uuid-123"]:
            stmt = select(Transcript).where(Transcript.call_id == cid)
            res = await session.execute(stmt)
            t = res.scalars().all()
            print(f"Call {cid}: {len(t)} transcripts")

if __name__ == "__main__":
    asyncio.run(main())
