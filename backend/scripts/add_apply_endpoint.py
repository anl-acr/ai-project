import os

MAIN_PY = os.path.join(os.path.dirname(os.path.dirname(__file__)), "main.py")

apply_endpoint = """
@app.post("/api/settings/apply")
async def apply_settings_endpoint(background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    # 1. Rebuild settings_db from PostgreSQL so that this worker has the absolute latest data
    
    # Users
    result_users = await db.execute(select(SystemUser).order_by(SystemUser.id))
    users = result_users.scalars().all()
    settings_db["users"] = [{c.name: getattr(u, c.name) for c in u.__table__.columns} for u in users]
    
    # Roles
    result_roles = await db.execute(select(SystemRole).order_by(SystemRole.id))
    roles = result_roles.scalars().all()
    settings_db["roles"] = [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in roles]
    
    # Queues
    result_queues = await db.execute(select(PBXQueue).order_by(PBXQueue.id))
    queues = result_queues.scalars().all()
    settings_db["queues"] = [{c.name: getattr(q, c.name) for c in q.__table__.columns} for q in queues]
    
    # Trunks
    result_trunks = await db.execute(select(Trunk).order_by(Trunk.id))
    trunks = result_trunks.scalars().all()
    settings_db["trunks"] = [{c.name: getattr(t, c.name) for c in t.__table__.columns} for t in trunks]
    
    # AI Agents
    result_agents = await db.execute(select(AIAgent))
    agents = result_agents.scalars().all()
    settings_db["ai_agents"] = [{c.name: getattr(a, c.name) for c in a.__table__.columns} for a in agents]
    
    # Breaks
    result_breaks = await db.execute(select(BreakType).order_by(BreakType.id))
    breaks = result_breaks.scalars().all()
    settings_db["breaks"] = [{c.name: getattr(b, c.name) for c in b.__table__.columns} for b in breaks]
    
    # Settings
    result_settings = await db.execute(select(SystemSetting))
    sys_settings = result_settings.scalars().all()
    for s in sys_settings:
        settings_db[s.key] = s.value

    # 2. Call Asterisk configuration generators
    regenerate_pjsip_custom_conf(background_tasks)
    regenerate_queues_conf(background_tasks)
    
    # 3. Log event
    await log_event(
        user_id=user_info["user_id"],
        action="APPLY_SETTINGS",
        module="System",
        details={"status": "Asterisk configurations generated and reloaded."},
        ip_address=user_info["ip_address"]
    )
    
    return {"status": "success", "message": "Değişiklikler başarıyla Asterisk'e uygulandı."}
"""

with open(MAIN_PY, "a", encoding="utf-8") as f:
    f.write(apply_endpoint)

print("Added /api/settings/apply to main.py")
