import os
import re

MAIN_PY = os.path.join(os.path.dirname(os.path.dirname(__file__)), "main.py")

with open(MAIN_PY, "r", encoding="utf-8") as f:
    lines = f.readlines()

def comment_out_endpoint(lines, endpoint_path):
    # Find the line with @app.get(endpoint_path) or @app.post(endpoint_path)
    # and comment it out until the next @app
    in_target = False
    for i, line in enumerate(lines):
        if line.startswith("@app") and endpoint_path in line:
            in_target = True
        elif in_target and line.startswith("@app"):
            in_target = False
            
        if in_target:
            lines[i] = "# " + line
            
    return lines

lines = comment_out_endpoint(lines, '"/api/settings/users"')
lines = comment_out_endpoint(lines, '"/api/settings/roles"')
lines = comment_out_endpoint(lines, '"/api/settings/queues"')
lines = comment_out_endpoint(lines, '"/api/settings/trunks"')

content = "".join(lines)

# Add imports if missing
if "from backend.database.models import SystemUser" not in content:
    imports = """from backend.database.models import SystemUser, SystemRole, PBXQueue, Trunk, AIAgent, BreakType, SystemSetting
from sqlalchemy import select, delete
from backend.database.config import get_db
from sqlalchemy.ext.asyncio import AsyncSession
"""
    content = content.replace("from backend.database.config import Base", "from backend.database.config import Base\n" + imports)

# Append new endpoints at the end of the file
new_endpoints = """

# --- REFACTORED ENDPOINTS ---

@app.get("/api/settings/users")
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
    
    regenerate_pjsip_custom_conf(background_tasks)
    
    return {"status": "success", "users": new_users}

@app.get("/api/settings/roles")
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
    
    return {"status": "success", "roles": new_roles}

@app.get("/api/settings/queues")
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
    
    regenerate_queues_conf(background_tasks)
    
    return {"status": "success", "queues": new_queues}

@app.get("/api/settings/trunks")
async def list_trunks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Trunk).order_by(Trunk.id))
    trunks = result.scalars().all()
    out = []
    for t in trunks:
        d = {c.name: getattr(t, c.name) for c in t.__table__.columns}
        out.append(d)
    return out

@app.post("/api/settings/trunks")
async def add_or_update_trunk(payload: TrunkSettingsSchema, background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info), db: AsyncSession = Depends(get_db)):
    data = payload.model_dump()
    
    if not data.get("id"):
        result = await db.execute(select(Trunk))
        existing_trunks = result.scalars().all()
        data["id"] = max([t.id for t in existing_trunks]) + 1 if existing_trunks else 1
        t = Trunk(**data)
        db.add(t)
    else:
        result = await db.execute(select(Trunk).where(Trunk.id == data["id"]))
        t = result.scalars().first()
        if t:
            for k, v in data.items():
                setattr(t, k, v)
        else:
            t = Trunk(**data)
            db.add(t)
            
    await db.commit()
    
    settings_db["trunks"] = [t for t in settings_db.get("trunks", []) if t.get("id") != data["id"]]
    settings_db["trunks"].append(data)
    
    regenerate_pjsip_custom_conf(background_tasks)
    
    await log_event(
        user_id=user_info["user_id"],
        action="SAVE_TRUNK",
        module="SIP Trunks",
        details={"trunk_name": data.get("trunk_name")},
        ip_address=user_info["ip_address"]
    )
    
    return {"status": "success"}
"""

content += new_endpoints

with open(MAIN_PY, "w", encoding="utf-8") as f:
    f.write(content)

print("Refactored main.py successfully with comment method!")
