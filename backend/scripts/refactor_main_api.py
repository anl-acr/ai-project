import os
import re

MAIN_PY = os.path.join(os.path.dirname(os.path.dirname(__file__)), "main.py")

with open(MAIN_PY, "r", encoding="utf-8") as f:
    content = f.read()

# Make sure imports are present
if "from backend.database.models import SystemUser" not in content:
    imports = """from backend.database.models import SystemUser, SystemRole, PBXQueue, Trunk, AIAgent, BreakType, SystemSetting
from sqlalchemy import select, delete
from backend.database.config import get_db
from sqlalchemy.ext.asyncio import AsyncSession
"""
    content = content.replace("from backend.database.config import Base", "from backend.database.config import Base\n" + imports)


# 1. USERS
users_replacement = """@app.get("/api/settings/users")
async def get_users_endpoint(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemUser).order_by(SystemUser.id))
    users = result.scalars().all()
    out = []
    for u in users:
        d = {c.name: getattr(u, c.name) for c in u.__table__.columns}
        out.append(d)
    return out

@app.post("/api/settings/users")
async def save_users_endpoint(payload: List[UserSchema], background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemUser))
    existing_users_db = result.scalars().all()
    existing_users = {u.id: {c.name: getattr(u, c.name) for c in u.__table__.columns} for u in existing_users_db}
    
    for item in payload:
        if item.id and item.id in existing_users:
            if str(existing_users[item.id].get("extension")) == str(item.extension):
                continue
        validate_number_range(item.extension, "extension")
        
    changes = []
    await db.execute(delete(SystemUser))
    
    new_users = []
    for idx, item in enumerate(payload):
        data = item.model_dump()
        if not data.get("id"):
            data["id"] = idx + 1
            changes.append({"action": "CREATED", "name": data.get("full_name"), "extension": data.get("extension")})
        else:
            old_data = existing_users.get(data["id"])
            if old_data:
                diff = {}
                for k, v in data.items():
                    if k != "avatar" and old_data.get(k) != v:
                        diff[k] = {"old": old_data.get(k), "new": v}
                if diff:
                    changes.append({"action": "UPDATED", "name": data.get("full_name"), "diff": diff})
        
        u = SystemUser(**data)
        db.add(u)
        new_users.append(data)
        
    await db.commit()
    settings_db["users"] = new_users
    
    await log_event(
        user_id=user_info["user_id"],
        action="UPDATE_USERS",
        module="Users",
        details={"changes": changes} if changes else {"status": "No changes detected"},
        ip_address=user_info["ip_address"]
    )
    
    return {"status": "success", "users": new_users}"""

content = re.sub(r'@app\.get\("/api/settings/users"\)[\s\S]*?return \{"status": "success", "users": settings_db\["users"\]\}', users_replacement, content)

# 2. ROLES
roles_replacement = """@app.get("/api/settings/roles")
async def get_roles_endpoint(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemRole).order_by(SystemRole.id))
    roles = result.scalars().all()
    out = []
    for r in roles:
        d = {c.name: getattr(r, c.name) for c in r.__table__.columns}
        out.append(d)
    return out

@app.post("/api/settings/roles")
async def save_roles_endpoint(payload: List[RoleSchema], user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemRole))
    existing_roles_db = result.scalars().all()
    existing_roles = {r.id: {c.name: getattr(r, c.name) for c in r.__table__.columns} for r in existing_roles_db}
    
    changes = []
    await db.execute(delete(SystemRole))
    
    new_roles = []
    for idx, item in enumerate(payload):
        data = item.model_dump()
        if not data.get("id"):
            data["id"] = idx + 1
            changes.append({"action": "CREATED", "name": data.get("name"), "role_code": data.get("role_code")})
        else:
            old_data = existing_roles.get(data["id"])
            if old_data:
                diff = {}
                for k, v in data.items():
                    if old_data.get(k) != v:
                        diff[k] = {"old": old_data.get(k), "new": v}
                if diff:
                    changes.append({"action": "UPDATED", "name": data.get("name"), "diff": diff})
                    
        r = SystemRole(**data)
        db.add(r)
        new_roles.append(data)
        
    await db.commit()
    settings_db["roles"] = new_roles
    
    await log_event(
        user_id=user_info["user_id"],
        action="UPDATE_ROLES",
        module="Roles",
        details={"changes": changes} if changes else {"status": "No changes detected"},
        ip_address=user_info["ip_address"]
    )
    
    return {"status": "success", "roles": new_roles}"""

content = re.sub(r'@app\.get\("/api/settings/roles"\)[\s\S]*?return \{"status": "success", "roles": settings_db\["roles"\]\}', roles_replacement, content)

# 3. QUEUES
queues_replacement = """@app.get("/api/settings/queues")
async def get_queues_endpoint(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PBXQueue).order_by(PBXQueue.id))
    queues = result.scalars().all()
    out = []
    for q in queues:
        d = {c.name: getattr(q, c.name) for c in q.__table__.columns}
        out.append(d)
    return out

@app.post("/api/settings/queues")
async def save_queues_endpoint(payload: List[QueueSchema], background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(PBXQueue))
    new_queues = []
    for idx, item in enumerate(payload):
        data = item.model_dump()
        if not data.get("id"):
            data["id"] = idx + 1
        q = PBXQueue(**data)
        db.add(q)
        new_queues.append(data)
        
    await db.commit()
    settings_db["queues"] = new_queues
    
    await log_event(
        user_id=user_info["user_id"],
        action="UPDATE_QUEUES",
        module="Queues",
        details={"status": "updated"},
        ip_address=user_info["ip_address"]
    )
    
    return {"status": "success", "queues": new_queues}"""

content = re.sub(r'@app\.get\("/api/settings/queues"\)[\s\S]*?return \{"status": "success", "queues": settings_db\["queues"\]\}', queues_replacement, content)

# 4. TRUNKS
trunks_replacement = """@app.get("/api/settings/trunks")
async def get_trunks_endpoint(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Trunk).order_by(Trunk.id))
    trunks = result.scalars().all()
    out = []
    for t in trunks:
        d = {c.name: getattr(t, c.name) for c in t.__table__.columns}
        out.append(d)
    return out

@app.post("/api/settings/trunks")
async def save_trunks_endpoint(payload: List[TrunkSettingsSchema], background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Trunk))
    new_trunks = []
    for idx, item in enumerate(payload):
        data = item.model_dump()
        if not data.get("id"):
            data["id"] = idx + 1
        t = Trunk(**data)
        db.add(t)
        new_trunks.append(data)
        
    await db.commit()
    settings_db["trunks"] = new_trunks
    
    await log_event(
        user_id=user_info["user_id"],
        action="UPDATE_TRUNKS",
        module="Trunks",
        details={"status": "updated"},
        ip_address=user_info["ip_address"]
    )
    
    return {"status": "success"}"""

content = re.sub(r'@app\.get\("/api/settings/trunks"\)[\s\S]*?return \{"status": "success"\}', trunks_replacement, content)

with open(MAIN_PY, "w", encoding="utf-8") as f:
    f.write(content)

print("Refactored main.py successfully!")
