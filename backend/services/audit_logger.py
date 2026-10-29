import json
import re
import contextvars
import urllib.request
from backend.database.config import AsyncSessionLocal
from backend.database.models import EventLog

current_request_ip_ctx = contextvars.ContextVar("current_request_ip", default=None)
LAST_KNOWN_USER_IPS = {}
_CACHED_HOST_PUBLIC_IP = None


def is_loopback_or_empty_ip(ip_val: str) -> bool:
    s = str(ip_val or "").strip().lower()
    return (not s) or s in ("127.0.0.1", "::1", "localhost", "0.0.0.0", "none", "null", "unknown")


def record_known_user_ip(user_key: str, ip_val: str):
    if is_loopback_or_empty_ip(ip_val):
        return
    clean_ip = str(ip_val).strip()
    LAST_KNOWN_USER_IPS["__last_global__"] = clean_ip
    if user_key:
        LAST_KNOWN_USER_IPS[str(user_key).strip()] = clean_ip


def get_host_public_ip_fallback() -> str:
    global _CACHED_HOST_PUBLIC_IP
    if _CACHED_HOST_PUBLIC_IP and not is_loopback_or_empty_ip(_CACHED_HOST_PUBLIC_IP):
        return _CACHED_HOST_PUBLIC_IP
    for url in ("https://api.ipify.org", "https://icanhazip.com"):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "AIDA-AuditLogger/1.0"})
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                ip_txt = resp.read().decode("utf-8", errors="ignore").strip()
                if ip_txt and not is_loopback_or_empty_ip(ip_txt) and len(ip_txt) <= 45:
                    _CACHED_HOST_PUBLIC_IP = ip_txt
                    return _CACHED_HOST_PUBLIC_IP
        except Exception:
            pass
    return "127.0.0.1"


def resolve_real_ip(ip_address: str = None, user_id: str = None) -> str:
    if not is_loopback_or_empty_ip(ip_address):
        clean = str(ip_address).strip()
        record_known_user_ip(user_id, clean)
        return clean

    ctx_ip = current_request_ip_ctx.get()
    if not is_loopback_or_empty_ip(ctx_ip):
        record_known_user_ip(user_id, ctx_ip)
        return str(ctx_ip).strip()

    uid_str = str(user_id or "").strip()
    if uid_str and uid_str in LAST_KNOWN_USER_IPS:
        return LAST_KNOWN_USER_IPS[uid_str]

    try:
        from backend.services.ami_manager import registered_endpoints
        if uid_str:
            ep_ip = registered_endpoints.get_ip(uid_str)
            if not is_loopback_or_empty_ip(ep_ip):
                record_known_user_ip(uid_str, ep_ip)
                return ep_ip
            m_ext = re.search(r"Dahili:\s*(\d+)", uid_str)
            if m_ext:
                ext_ip = registered_endpoints.get_ip(m_ext.group(1))
                if not is_loopback_or_empty_ip(ext_ip):
                    record_known_user_ip(uid_str, ext_ip)
                    return ext_ip
        for _, reg_ip in registered_endpoints.items():
            if not is_loopback_or_empty_ip(reg_ip):
                return reg_ip
    except Exception:
        pass

    if "__last_global__" in LAST_KNOWN_USER_IPS:
        return LAST_KNOWN_USER_IPS["__last_global__"]

    return "127.0.0.1"


async def log_event(user_id: str, action: str, module: str, details: dict = None, ip_address: str = None):
    """
    Logs an event into the EventLog table with automatic real client IP resolution.
    """
    try:
        if details is not None:
            if isinstance(details, (dict, list)):
                details_str = json.dumps(details, ensure_ascii=False)
            else:
                details_str = str(details)
        else:
            details_str = None

        resolved_ip = resolve_real_ip(ip_address, user_id)

        async with AsyncSessionLocal() as session:
            new_log = EventLog(
                user_id=str(user_id) if user_id else "System",
                action=str(action) if action else "INFO",
                module=str(module) if module else "System",
                details=details_str,
                ip_address=resolved_ip
            )
            session.add(new_log)
            await session.commit()
    except Exception as e:
        print(f"[AuditLogger] Failed to log event: {e}")
