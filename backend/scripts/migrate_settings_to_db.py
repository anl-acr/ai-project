import asyncio
import json
import os
import sys

# Add parent directory to path to allow importing backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database.config import AsyncSessionLocal, engine, Base
from backend.database.models import SystemUser, SystemRole, PBXQueue, Trunk, AIAgent, BreakType, SystemSetting
from sqlalchemy import select

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "settings.json")

async def migrate_settings():
    # Ensure tables are created
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    if not os.path.exists(SETTINGS_FILE):
        print(f"Settings file not found at {SETTINGS_FILE}. Nothing to migrate.")
        return

    with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    async with AsyncSessionLocal() as session:
        # Check if already migrated
        result = await session.execute(select(SystemUser))
        if result.scalars().first() is not None:
            print("Database already contains SystemUser data. Skipping migration to avoid duplicates.")
            return

        print("Migrating users...")
        for u in data.get("users", []):
            user = SystemUser(
                full_name=u.get("full_name", ""),
                email=u.get("email", ""),
                extension=u.get("extension", ""),
                avatar=u.get("avatar"),
                role=u.get("role", "agent"),
                is_active=u.get("is_active", True),
                gsm_number=u.get("gsm_number"),
                mobile_transfer_enabled=u.get("mobile_transfer_enabled", False),
                theme_color=u.get("theme_color", "rose"),
                sip_password=u.get("sip_password"),
                outbound_caller_id=u.get("outbound_caller_id"),
                forwarding_always=u.get("forwarding_always"),
                forwarding_busy=u.get("forwarding_busy"),
                forwarding_no_answer=u.get("forwarding_no_answer"),
                voicemail_active=u.get("voicemail_active", False),
                voicemail_announcement=u.get("voicemail_announcement"),
                voicemail_pin=u.get("voicemail_pin"),
                voicemail_to_email=u.get("voicemail_to_email", False),
                recording_active=u.get("recording_active", False),
                transport=u.get("transport", "UDP"),
                active_sessions=u.get("active_sessions", [])
            )
            session.add(user)

        print("Migrating roles...")
        for r in data.get("roles", []):
            role = SystemRole(
                role_code=r.get("role_code", ""),
                name=r.get("name", ""),
                permissions=r.get("permissions", []),
                allowed_breaks=r.get("allowed_breaks", [])
            )
            session.add(role)

        print("Migrating queues...")
        for q in data.get("queues", []):
            queue = PBXQueue(
                name=q.get("name", ""),
                strategy=q.get("strategy", "ringall"),
                timeout=q.get("timeout", 15),
                wrapuptime=q.get("wrapuptime", 0),
                maxlen=q.get("maxlen", 0),
                joinempty=q.get("joinempty", "yes"),
                leavewhenempty=q.get("leavewhenempty", "no"),
                ringinuse=q.get("ringinuse", "no"),
                members=q.get("members", [])
            )
            session.add(queue)

        print("Migrating trunks...")
        for t in data.get("trunks", []):
            trunk = Trunk(
                trunk_type=t.get("trunk_type", "register"),
                trunk_name=t.get("trunk_name", ""),
                host=t.get("host", ""),
                username=t.get("username"),
                password=t.get("password"),
                port=t.get("port", 5060),
                did_number=t.get("did_number", ""),
                protocol=t.get("protocol", "udp"),
                greeting_prompt=t.get("greeting_prompt"),
                transfer_target_type=t.get("transfer_target_type", "extension"),
                transfer_target=t.get("transfer_target", ""),
                codec=t.get("codec", "G711"),
                is_active=t.get("is_active", True)
            )
            session.add(trunk)

        print("Migrating ai_agents...")
        for a in data.get("ai_agents", []):
            agent = AIAgent(
                id=a.get("id", ""),
                name=a.get("name", ""),
                voice=a.get("voice", ""),
                tone=a.get("tone", ""),
                model=a.get("model", ""),
                temperature=float(a.get("temperature", 0.7)),
                max_tokens=int(a.get("max_tokens", 300)),
                system_instruction=a.get("system_instruction", ""),
                status=a.get("status", "active"),
                transfer_target=a.get("transfer_target", "")
            )
            session.add(agent)

        print("Migrating break types...")
        for b in data.get("breaks", []):
            brk = BreakType(
                name=b.get("name", ""),
                color=b.get("color", "")
            )
            session.add(brk)

        print("Migrating remaining system settings...")
        exclude_keys = ["users", "roles", "queues", "trunks", "ai_agents", "breaks"]
        for key, val in data.items():
            if key not in exclude_keys:
                setting = SystemSetting(
                    key=key,
                    value=val
                )
                session.add(setting)

        await session.commit()
        print("Migration complete!")

if __name__ == "__main__":
    asyncio.run(migrate_settings())
