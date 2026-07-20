import asyncio
from backend.main import get_reports_agents
async def test():
    try:
        res = await get_reports_agents()
        print(res)
    except Exception as e:
        import traceback
        traceback.print_exc()
asyncio.run(test())
