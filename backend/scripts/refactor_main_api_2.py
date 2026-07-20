import os
import re

MAIN_PY = os.path.join(os.path.dirname(os.path.dirname(__file__)), "main.py")

with open(MAIN_PY, "r", encoding="utf-8") as f:
    content = f.read()

# 5. AI AGENTS
ai_agents_replacement = """@app.get("/api/settings/ai_agents")
async def get_ai_agents_endpoint(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AIAgent))
    agents = result.scalars().all()
    out = []
    for a in agents:
        d = {c.name: getattr(a, c.name) for c in a.__table__.columns}
        out.append(d)
    return out

@app.post("/api/settings/ai_agents")
async def save_ai_agents_endpoint(payload: List[AIAgentSchema], background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(AIAgent))
    new_agents = []
    for idx, item in enumerate(payload):
        data = item.model_dump()
        if not data.get("id"):
            import uuid
            data["id"] = str(uuid.uuid4())
        a = AIAgent(**data)
        db.add(a)
        new_agents.append(data)
        
    await db.commit()
    settings_db["ai_agents"] = new_agents
    
    await log_event(
        user_id=user_info["user_id"],
        action="UPDATE_AI_AGENTS",
        module="AI Agents",
        details={"status": "updated"},
        ip_address=user_info["ip_address"]
    )
    
    return {"status": "success", "ai_agents": new_agents}"""

content = re.sub(r'@app\.get\("/api/settings/ai_agents"\)[\s\S]*?return \{"status": "success", "ai_agents": settings_db\["ai_agents"\]\}', ai_agents_replacement, content)

# 6. BREAKS
breaks_replacement = """@app.get("/api/settings/breaks")
async def get_breaks_endpoint(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BreakType).order_by(BreakType.id))
    breaks = result.scalars().all()
    out = []
    for b in breaks:
        d = {c.name: getattr(b, c.name) for c in b.__table__.columns}
        out.append(d)
    return out

@app.post("/api/settings/breaks")
async def save_breaks_endpoint(payload: List[BreakSchema], user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(BreakType))
    new_breaks = []
    for idx, item in enumerate(payload):
        data = item.model_dump()
        if not data.get("id"):
            data["id"] = idx + 1
        b = BreakType(**data)
        db.add(b)
        new_breaks.append(data)
        
    await db.commit()
    settings_db["breaks"] = new_breaks
    
    await log_event(
        user_id=user_info["user_id"],
        action="UPDATE_BREAKS",
        module="Breaks",
        details={"status": "updated"},
        ip_address=user_info["ip_address"]
    )
    
    return {"status": "success"}"""

content = re.sub(r'@app\.get\("/api/settings/breaks"\)[\s\S]*?return \{"status": "success"\}', breaks_replacement, content)

with open(MAIN_PY, "w", encoding="utf-8") as f:
    f.write(content)

print("Refactored AI agents and breaks successfully!")
