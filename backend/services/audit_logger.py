import json
from backend.database.config import AsyncSessionLocal
from backend.database.models import EventLog

async def log_event(user_id: str, action: str, module: str, details: dict = None, ip_address: str = None):
    """
    Logs an event into the EventLog table.
    
    :param user_id: Identifier of the user performing the action (e.g. extension, username)
    :param action: A string describing the action (e.g. 'UPDATE', 'CREATE', 'DELETE', 'LOGIN')
    :param module: The module where the action took place (e.g. 'Users', 'Queues', 'Settings')
    :param details: A dictionary containing details of the action (before/after state, etc.)
    :param ip_address: IP address of the requester
    """
    try:
        details_str = json.dumps(details, ensure_ascii=False) if details else None
        
        async with AsyncSessionLocal() as session:
            new_log = EventLog(
                user_id=user_id,
                action=action,
                module=module,
                details=details_str,
                ip_address=ip_address
            )
            session.add(new_log)
            await session.commit()
    except Exception as e:
        print(f"[AuditLogger] Failed to log event: {e}")
