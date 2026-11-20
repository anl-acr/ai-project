import os
import sys
import time
import hmac
import base64
import struct
import secrets
import smtplib
import ssl
import urllib.parse
import datetime
import asyncio
import hashlib
import json
import sqlite3
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from sqlalchemy import select, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from license_center.backend.database import get_central_db, init_central_db, AsyncSessionLocal, DB_PATH, BACKUPS_DIR
from license_center.backend.models import (
    ClientServer,
    LicenseRecord,
    TelemetryLog,
    MasterUser,
    MasterAuditLog,
    MasterBlockedIP,
    MasterSecurityPolicy,
    MasterPackageTemplate,
)
from license_center.backend.license_generator import (
    generate_signed_license_key,
    verify_signed_license_key,
    compute_system_serial_number,
    generate_tenant_serial_number,
    generate_nornia_root_sso_token,
    LICENSE_MASTER_SECRET,
)

app = FastAPI(title="Nornia Cloud Center - Central License & Fleet Management API", version="2.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://panel.nornia.com.tr",
        "https://connect.nornia.com.tr",
        "http://localhost:3050",
        "http://127.0.0.1:3050",
    ],
    allow_origin_regex=r"^https://([a-z0-9-]+\.)?nornia\.com\.tr$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------------
# Signed Master Panel Session Token Engine (HMAC-SHA256) & Global Auth Guard
# --------------------------------------------------------------------------
MASTER_SESSION_TTL_SECONDS = 12 * 3600
_REVOKED_MASTER_TOKENS: Dict[str, int] = {}  # sha256(token) -> exp_ts


def generate_master_session_token(user: MasterUser) -> str:
    """Issues a 12-hour HMAC-SHA256 signed session token for authenticated panel users."""
    now_ts = int(time.time())
    payload = {
        "uid": int(user.id),
        "u": str(user.username or "admin"),
        "r": str(user.role or "admin"),
        "iat": now_ts,
        "exp": now_ts + MASTER_SESSION_TTL_SECONDS,
        "jti": secrets.token_hex(6),
    }
    b64_payload = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    ).decode("utf-8").rstrip("=")
    sig = hmac.new(
        LICENSE_MASTER_SECRET.encode("utf-8"),
        f"NORNIA_MASTER_SESSION:{b64_payload}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:16].upper()
    return f"MSESS.{b64_payload}.{sig}"


def verify_master_session_token(token: Optional[str]) -> Optional[Dict[str, Any]]:
    """Verifies signature, expiration, and logout revocation for a Master Panel session token."""
    if not token or not isinstance(token, str):
        return None
    raw = token.strip()
    if not raw.startswith("MSESS."):
        return None
    parts = raw.split(".")
    if len(parts) != 3:
        return None
    _, b64_payload, sig = parts
    expected_sig = hmac.new(
        LICENSE_MASTER_SECRET.encode("utf-8"),
        f"NORNIA_MASTER_SESSION:{b64_payload}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:16].upper()
    if not hmac.compare_digest(sig.upper(), expected_sig):
        return None
    tok_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    if tok_hash in _REVOKED_MASTER_TOKENS:
        return None
    try:
        padded = b64_payload + "=" * (-len(b64_payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8"))
        if int(data.get("exp") or 0) < int(time.time()):
            return None
        return data
    except Exception:
        return None


def revoke_master_session_token(token: Optional[str]):
    """Marks a session token as revoked immediately upon logout and prunes expired revocations."""
    now_ts = int(time.time())
    for k, exp_v in list(_REVOKED_MASTER_TOKENS.items()):
        if exp_v < now_ts:
            _REVOKED_MASTER_TOKENS.pop(k, None)
    if not token or not isinstance(token, str) or not token.strip().startswith("MSESS."):
        return
    raw = token.strip()
    tok_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    _REVOKED_MASTER_TOKENS[tok_hash] = now_ts + MASTER_SESSION_TTL_SECONDS


def extract_master_token_from_request(request: Request) -> Optional[str]:
    auth_hdr = str(request.headers.get("authorization") or "").strip()
    if auth_hdr.lower().startswith("bearer "):
        return auth_hdr[7:].strip()
    q_tok = request.query_params.get("token")
    if q_tok:
        return str(q_tok).strip()
    return None


_PUBLIC_V1_EXACT_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/verify-2fa",
    "/api/v1/auth/resend-email-2fa",
    "/api/v1/telemetry/heartbeat",
    "/api/v1/connect/check-subdomain",
    "/api/v1/ras/tunnel",
}
_PUBLIC_V1_PREFIXES = (
    "/api/v1/connect/ssh-proxy/",
    "/api/v1/connect/tcp-relay/",
)


@app.middleware("http")
async def enforce_master_panel_auth(request: Request, call_next):
    path = request.url.path or ""
    if request.method == "OPTIONS":
        return await call_next(request)
    if path.startswith("/api/v1/"):
        is_public = (
            path in _PUBLIC_V1_EXACT_PATHS
            or any(path.startswith(pref) for pref in _PUBLIC_V1_PREFIXES)
        )
        if not is_public:
            tok = extract_master_token_from_request(request)
            session_info = verify_master_session_token(tok)
            if not session_info:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Yetkisiz erişim veya oturum süresi doldu. Lütfen tekrar giriş yapın."},
                )
            request.state.master_user = session_info
    return await call_next(request)

def hash_password(password: str) -> str:
    """Computes SHA-256 hash for secure user password storage."""
    return hashlib.sha256(f"AIDA_MASTER_SALT_{password.strip()}".encode("utf-8")).hexdigest()


def extract_client_ip(request: Request) -> str:
    """Extracts the real client IP address behind Nginx reverse proxy."""
    xff = request.headers.get("x-forwarded-for") or request.headers.get("x-real-ip")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


# --------------------------------------------------------------------------
# Pure-Python RFC 6238 TOTP (Google / Microsoft Authenticator) Engine
# --------------------------------------------------------------------------
def generate_totp_secret() -> str:
    """Generates a 16-character RFC 4648 Base32 TOTP secret (80 bits)."""
    return base64.b32encode(os.urandom(10)).decode("utf-8").rstrip("=")


def compute_totp_code(secret_b32: str, time_step: Optional[int] = None) -> str:
    """Computes a 6-digit RFC 6238 TOTP code for a Base32 secret."""
    clean = (secret_b32 or "").strip().upper().replace(" ", "")
    padded = clean + "=" * ((8 - len(clean) % 8) % 8)
    key = base64.b32decode(padded, casefold=True)
    step = time_step if time_step is not None else int(time.time() // 30)
    msg = struct.pack(">Q", step)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code_int = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1000000
    return f"{code_int:06d}"


def verify_totp_code(secret_b32: str, code: str) -> bool:
    """Verifies a 6-digit TOTP code allowing ±1 time step (30s) clock drift."""
    if not secret_b32 or not code:
        return False
    clean_code = str(code).strip().replace(" ", "")
    if not clean_code.isdigit() or len(clean_code) != 6:
        return False
    now_step = int(time.time() // 30)
    for delta in (-1, 0, 1):
        try:
            if hmac.compare_digest(compute_totp_code(secret_b32, now_step + delta), clean_code):
                return True
        except Exception:
            pass
    return False


def generate_2fa_temp_token(user_id: int, username: str) -> str:
    """Generates a 5-minute HMAC-signed token between password check and 2FA code verification."""
    exp = int(time.time()) + 300
    payload_str = f"{user_id}:{username}:{exp}"
    b64 = base64.urlsafe_b64encode(payload_str.encode("utf-8")).decode("utf-8").rstrip("=")
    sig = hmac.new(
        LICENSE_MASTER_SECRET.encode("utf-8"),
        f"2FA_TEMP:{b64}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:16].upper()
    return f"T2FA.{b64}.{sig}"


def verify_2fa_temp_token(token: str) -> Optional[int]:
    """Verifies the 2FA challenge temp token and returns the user_id if valid."""
    if not token or not token.startswith("T2FA."):
        return None
    parts = token.strip().split(".")
    if len(parts) != 3:
        return None
    _, b64, sig = parts
    expected_sig = hmac.new(
        LICENSE_MASTER_SECRET.encode("utf-8"),
        f"2FA_TEMP:{b64}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:16].upper()
    if not hmac.compare_digest(sig.upper(), expected_sig):
        return None
    try:
        padded = b64 + "=" * (-len(b64) % 4)
        raw = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
        uid_str, _, exp_str = raw.split(":", 2)
        if int(time.time()) > int(exp_str):
            return None
        return int(uid_str)
    except Exception:
        return None


# --------------------------------------------------------------------------
# Brute-Force Protection & Security Policy Helpers
# --------------------------------------------------------------------------
_FAILED_LOGIN_TRACKER: Dict[str, List[float]] = {}


async def get_or_create_security_policy(db: AsyncSession) -> MasterSecurityPolicy:
    res = await db.execute(select(MasterSecurityPolicy).order_by(MasterSecurityPolicy.id.asc()))
    pol = res.scalars().first()
    if not pol:
        pol = MasterSecurityPolicy(
            max_failed_attempts=5,
            block_duration_minutes=60,
            auto_logout_minutes=15,
            whitelisted_ips_json="[]",
        )
        db.add(pol)
        await db.commit()
        await db.refresh(pol)
    return pol


def parse_whitelisted_ips(pol: MasterSecurityPolicy) -> List[str]:
    try:
        arr = json.loads(pol.whitelisted_ips_json or "[]")
        return [str(x).strip() for x in arr if str(x).strip()]
    except Exception:
        return []


async def check_ip_blocked(db: AsyncSession, client_ip: str, pol: MasterSecurityPolicy):
    """Checks if client_ip is currently blocked by Brute-Force or manual IP ban."""
    if not client_ip or client_ip in ("127.0.0.1", "::1", "localhost"):
        return
    whitelist = parse_whitelisted_ips(pol)
    if client_ip in whitelist:
        return

    res = await db.execute(select(MasterBlockedIP).where(MasterBlockedIP.ip_address == client_ip))
    blk = res.scalars().first()
    if not blk:
        return

    now = datetime.datetime.utcnow()
    if not blk.is_permanent and blk.blocked_until and blk.blocked_until <= now:
        await db.delete(blk)
        await db.commit()
        _FAILED_LOGIN_TRACKER.pop(client_ip, None)
        return

    if blk.is_permanent:
        raise HTTPException(
            status_code=429,
            detail=f"IP adresiniz ({client_ip}) güvenlik politikası gereği kalıcı olarak engellenmiştir. ({blk.reason})",
        )

    mins_left = max(1, int(((blk.blocked_until - now).total_seconds() + 59) // 60)) if blk.blocked_until else pol.block_duration_minutes
    raise HTTPException(
        status_code=429,
        detail=f"Çok fazla hatalı giriş denemesi nedeniyle IP adresiniz ({client_ip}) geçici olarak engellenmiştir. Kalan süre: {mins_left} dakika.",
    )


async def record_failed_login_attempt(db: AsyncSession, client_ip: str, username: str, pol: MasterSecurityPolicy) -> int:
    """Records a failed login attempt for client_ip and auto-bans if threshold is reached. Returns remaining attempts."""
    if not client_ip or client_ip in ("127.0.0.1", "::1", "localhost") or client_ip in parse_whitelisted_ips(pol):
        return pol.max_failed_attempts

    now_ts = time.time()
    window_start = now_ts - 900  # 15-minute rolling window
    history = [ts for ts in _FAILED_LOGIN_TRACKER.get(client_ip, []) if ts > window_start]
    history.append(now_ts)
    _FAILED_LOGIN_TRACKER[client_ip] = history

    attempts = len(history)
    max_att = max(2, int(pol.max_failed_attempts or 5))
    if attempts >= max_att:
        dur_mins = max(1, int(pol.block_duration_minutes or 60))
        until_dt = datetime.datetime.utcnow() + datetime.timedelta(minutes=dur_mins)
        res = await db.execute(select(MasterBlockedIP).where(MasterBlockedIP.ip_address == client_ip))
        blk = res.scalars().first()
        reason_str = f"Brute-Force Koruması ({attempts} hatalı giriş - Son denenen: {username})"
        if not blk:
            blk = MasterBlockedIP(
                ip_address=client_ip,
                reason=reason_str,
                failed_attempts=attempts,
                blocked_until=until_dt,
                is_permanent=False,
            )
            db.add(blk)
        else:
            blk.failed_attempts = attempts
            blk.blocked_until = until_dt
            blk.reason = reason_str
        await db.commit()
        await log_master_action(
            db,
            username or "unknown",
            "BRUTE_FORCE_BAN",
            f"IP Otomatik Engellendi: {client_ip} ({attempts} hatalı giriş, Süre: {dur_mins} dk)",
            client_ip,
        )
        raise HTTPException(
            status_code=429,
            detail=f"{attempts} kez hatalı giriş yapıldığı için IP adresiniz ({client_ip}) {dur_mins} dakika süreyle engellenmiştir.",
        )

    return max(0, max_att - attempts)

async def log_master_action(db: AsyncSession, username: str, action: str, details: str, ip_address: str = None, user_id: int = None):
    """Utility function to log all central admin user actions into MasterAuditLog."""
    try:
        log_entry = MasterAuditLog(
            user_id=user_id,
            username=username or "system",
            action=action,
            details=details,
            ip_address=ip_address or "127.0.0.1"
        )
        db.add(log_entry)
        await db.commit()
    except Exception as e:
        print(f"[Audit Log Error]: {e}")

def _create_sqlite_online_backup_sync(dest_path: str) -> str:
    """Performs a WAL-safe online SQLite backup using Python's native sqlite3 backup API."""
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    src_conn = sqlite3.connect(DB_PATH, timeout=15)
    dst_conn = sqlite3.connect(dest_path)
    try:
        src_conn.backup(dst_conn)
    finally:
        dst_conn.close()
        src_conn.close()
    return dest_path


def _prune_old_backup_files_sync(keep_daily: int = 14):
    """Keeps the most recent daily backup files inside BACKUPS_DIR."""
    if not os.path.isdir(BACKUPS_DIR):
        return
    files = []
    for fname in os.listdir(BACKUPS_DIR):
        if fname.startswith("license_center_") and fname.endswith(".db"):
            full_p = os.path.join(BACKUPS_DIR, fname)
            if os.path.isfile(full_p):
                files.append((os.path.getmtime(full_p), full_p))
    files.sort(reverse=True)
    for _, old_path in files[keep_daily:]:
        try:
            os.remove(old_path)
        except Exception:
            pass


async def run_central_db_maintenance():
    """Prunes TelemetryLog rows older than 30 days and creates/refreshes today's online SQLite backup."""
    try:
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=30)
        async with AsyncSessionLocal() as db:
            res = await db.execute(delete(TelemetryLog).where(TelemetryLog.recorded_at < cutoff))
            deleted_cnt = res.rowcount or 0
            await db.commit()
            if deleted_cnt > 0:
                print(f"[Central Maintenance] Pruned {deleted_cnt} TelemetryLog rows older than 30 days.")
    except Exception as e_prune:
        print(f"[Central Maintenance] TelemetryLog prune warning: {e_prune}")

    try:
        today_tag = (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).strftime("%Y%m%d")
        daily_path = os.path.join(BACKUPS_DIR, f"license_center_auto_{today_tag}.db")
        await asyncio.to_thread(_create_sqlite_online_backup_sync, daily_path)
        await asyncio.to_thread(_prune_old_backup_files_sync, 14)
    except Exception as e_bkp:
        print(f"[Central Maintenance] Daily SQLite backup warning: {e_bkp}")


async def periodic_central_maintenance_loop():
    await asyncio.sleep(25)
    while True:
        await run_central_db_maintenance()
        await asyncio.sleep(6 * 3600)


@app.on_event("startup")
async def on_startup():
    await init_central_db()
    print("[AIDA License Master] Central License Database initialized (WAL enabled).")
    asyncio.create_task(periodic_central_maintenance_loop())
    
    # Auto-seed default superadmin user if no users exist
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(MasterUser))
        users = res.scalars().all()
        if not users:
            admin_user = MasterUser(
                username="admin",
                full_name="Sistem Yöneticisi",
                email="admin@aidapanel.com",
                password_hash=hash_password("admin123"),
                role="admin",
                is_active=True
            )
            db.add(admin_user)
            await db.commit()
            print("[AIDA License Master] Default admin user created (admin / admin123).")

        # Ensure Nginx default_server and Let's Encrypt certificates cover all registered connect_subdomains
        try:
            from license_center.backend.connect_hub import ensure_subdomain_ssl_and_nginx
            res_subs = await db.execute(select(ClientServer.connect_subdomain))
            all_subs = [s for (s,) in res_subs.all() if s]
            first_sub = all_subs[0] if all_subs else "app"
            asyncio.create_task(ensure_subdomain_ssl_and_nginx(first_sub))
        except Exception as e_ssl:
            print(f"[AIDA License Master] Startup SSL sync warning: {e_ssl}")

        # Hydrate WireGuard & Kamailio SIP/RTP Edge routes from DB on Hub startup
        try:
            from license_center.backend.sip_edge_manager import sync_all_sip_edge_peers_from_db
            await sync_all_sip_edge_peers_from_db(db)
        except Exception as e_edge:
            print(f"[AIDA License Master] Startup SIP Edge sync warning: {e_edge}")

# Pydantic Schemas
class ClientCreateSchema(BaseModel):
    company_name: str
    tenant_code: str
    tenant_serial_number: Optional[str] = None
    system_serial_number: Optional[str] = None
    hardware_id: Optional[str] = None
    ip_address: Optional[str] = None
    domain_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    plan_tier: Optional[str] = "professional"
    license_expires_at: Optional[str] = "2026-12-31"
    status: Optional[str] = "active"
    custom_quotas: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    performed_by: Optional[str] = "admin"

class LicenseGenerateSchema(BaseModel):
    client_id: Optional[int] = None
    tenant_code: str
    tenant_serial_number: Optional[str] = None
    expiry_date: str
    hardware_id: Optional[str] = "UNBOUND"
    plan_tier: Optional[str] = "professional"
    custom_quotas: Optional[Dict[str, Any]] = None
    performed_by: Optional[str] = "admin"

class TenantPingItem(BaseModel):
    tenant_code: str
    company_name: Optional[str] = None
    tenant_num_id: Optional[int] = None
    serial_number: Optional[str] = None
    license_key: Optional[str] = ""
    status: Optional[str] = "active"

class HeartbeatSchema(BaseModel):
    hardware_id: str
    system_serial_number: Optional[str] = None
    tenant_code: Optional[str] = None
    tenant_serial_number: Optional[str] = None
    license_key: Optional[str] = None
    software_version: Optional[str] = None
    cpu_percent: Optional[float] = 0.0
    memory_percent: Optional[float] = 0.0
    disk_percent: Optional[float] = 0.0
    services_health: Optional[Dict[str, Any]] = None
    failed_services: Optional[List[str]] = None
    active_calls: Optional[int] = 0
    total_users: Optional[int] = 0
    whatsapp_status: Optional[str] = "offline"
    ip_address: Optional[str] = None
    public_ip: Optional[str] = None
    tenants: Optional[List[TenantPingItem]] = []

class LoginSchema(BaseModel):
    username: str
    password: str

class MasterUserCreateSchema(BaseModel):
    username: str
    full_name: str
    email: str
    password: str
    role: Optional[str] = "admin" # admin, operator, viewer
    is_active: Optional[bool] = True
    performed_by: Optional[str] = "admin"

# --------------------------------------------------------------------------
# E-Mail 2FA OTP Engine & Central SMTP Mailer
# --------------------------------------------------------------------------
_MASTER_EMAIL_OTP_STORE: Dict[str, Dict[str, Any]] = {}


def mask_email_address(email_str: str) -> str:
    raw = str(email_str or "").strip()
    if "@" not in raw:
        return raw
    local, domain = raw.split("@", 1)
    if len(local) <= 2:
        masked_local = (local[0] + "***") if local else "***"
    else:
        masked_local = local[:2] + "***" + local[-1]
    return f"{masked_local}@{domain}"


def generate_master_email_otp(cache_key: str, email_str: str, ttl_seconds: int = 300) -> Dict[str, Any]:
    code = str(secrets.randbelow(900000) + 100000)
    now = time.time()
    _MASTER_EMAIL_OTP_STORE[cache_key] = {
        "code": code,
        "email": str(email_str or "").strip(),
        "sent_at": now,
        "expires_at": now + ttl_seconds,
    }
    return {
        "code": code,
        "expires_in": ttl_seconds,
        "masked_email": mask_email_address(email_str),
    }


def verify_master_email_otp(cache_key: str, code: str, consume: bool = True) -> bool:
    if not cache_key or not code:
        return False
    clean_code = "".join(ch for ch in str(code).strip() if ch.isdigit())
    if len(clean_code) != 6:
        return False
    entry = _MASTER_EMAIL_OTP_STORE.get(cache_key)
    if not entry:
        return False
    if time.time() > float(entry.get("expires_at", 0)):
        _MASTER_EMAIL_OTP_STORE.pop(cache_key, None)
        return False
    if hmac.compare_digest(str(entry.get("code", "")), clean_code):
        if consume:
            _MASTER_EMAIL_OTP_STORE.pop(cache_key, None)
        return True
    return False


def resolve_master_smtp_config(pol: Optional[MasterSecurityPolicy]) -> Dict[str, Any]:
    host = ((pol.smtp_host if pol else "") or os.getenv("SMTP_HOST") or "").strip()
    port = int((pol.smtp_port if pol and pol.smtp_port else 0) or os.getenv("SMTP_PORT") or 587)
    user = ((pol.smtp_user if pol else "") or os.getenv("SMTP_USER") or "").strip()
    password = ((pol.smtp_password if pol else "") or os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_PASS") or "").strip()
    from_email = ((pol.smtp_from_email if pol else "") or os.getenv("SMTP_FROM") or user or "").strip()
    use_tls = bool(pol.smtp_use_tls) if (pol and pol.smtp_use_tls is not None) else True
    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "from_email": from_email,
        "use_tls": use_tls,
        "configured": bool(host and user and password),
    }


def _send_smtp_sync(smtp_cfg: Dict[str, Any], to_email: str, subject: str, html_body: str, plain_body: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    sender = smtp_cfg.get("from_email") or smtp_cfg.get("user") or "noreply@nornia.com.tr"
    msg["From"] = f"Nornia Cloud Center <{sender}>"
    msg["To"] = to_email
    msg.attach(MIMEText(plain_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    host = smtp_cfg["host"]
    port = int(smtp_cfg["port"] or 587)
    user = smtp_cfg["user"]
    password = smtp_cfg["password"]
    use_tls = bool(smtp_cfg.get("use_tls", True))

    context = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=15, context=context) as server:
            server.login(user, password)
            server.sendmail(sender, [to_email], msg.as_string())
    else:
        with smtplib.SMTP(host, port, timeout=15) as server:
            server.ehlo()
            if use_tls:
                server.starttls(context=context)
                server.ehlo()
            server.login(user, password)
            server.sendmail(sender, [to_email], msg.as_string())


async def send_master_2fa_email_otp(
    pol: MasterSecurityPolicy,
    to_email: str,
    user_name: str,
    otp_code: str,
    ttl_seconds: int = 300,
) -> Dict[str, Any]:
    clean_to = str(to_email or "").strip()
    if not clean_to or "@" not in clean_to:
        return {"ok": False, "error": "Kullanıcıya tanımlı geçerli bir e-posta adresi bulunamadı."}

    smtp_cfg = resolve_master_smtp_config(pol)
    if not smtp_cfg["configured"]:
        return {
            "ok": False,
            "smtp_missing": True,
            "error": "SMTP sunucu ayarları henüz yapılmamış. Lütfen Güvenlik Kalkanı → E-Posta (SMTP) Sunucu Ayarları bölümünden SMTP bilgilerini kaydediniz.",
        }

    tr_now = (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).strftime("%d.%m.%Y %H:%M:%S")
    mins = max(1, ttl_seconds // 60)
    subject = f"🔐 [Nornia Cloud Center] 2FA Doğrulama Kodunuz: {otp_code}"
    plain_body = (
        f"Merhaba {user_name or 'Kullanıcı'},\n\n"
        f"Nornia Cloud Center paneline güvenli giriş / 2FA doğrulaması için 6 haneli tek kullanımlık kodunuz:\n\n"
        f"    {otp_code}\n\n"
        f"Bu kod {mins} dakika boyunca geçerlidir.\n"
        f"Tarih/Saat (TR): {tr_now}\n\n"
        f"Bu işlemi siz başlatmadıysanız lütfen şifrenizi hemen değiştiriniz."
    )
    html_body = f"""
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #0f172a;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; overflow: hidden; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);">
          <div style="background: linear-gradient(135deg, #4f46e5, #e11d48); color: #ffffff; padding: 18px 24px; font-weight: 800; font-size: 16px;">
            🔐 Nornia Cloud Center — İki Aşamalı Doğrulama (2FA)
          </div>
          <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
            <p style="margin-top: 0; color: #334155;">Merhaba <strong>{user_name or 'Kullanıcı'}</strong>,</p>
            <p style="color: #475569;">Nornia Cloud Center hesabınız için tek kullanımlık 6 haneli doğrulama kodunuz:</p>
            <div style="background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 14px; padding: 18px; text-align: center; margin: 20px 0;">
              <span style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #0f172a;">{otp_code}</span>
            </div>
            <p style="font-size: 12px; color: #64748b; margin-bottom: 4px;">⏱️ Bu kod <strong>{mins} dakika</strong> boyunca geçerlidir.</p>
            <p style="font-size: 12px; color: #94a3b8; margin-top: 0;">Tarih / Saat (TR): {tr_now}</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 18px 0;" />
            <p style="font-size: 11px; color: #94a3b8; margin-bottom: 0;">Bu işlemi siz başlatmadıysanız lütfen yönetici şifrenizi derhal güncelleyiniz.</p>
          </div>
        </div>
      </body>
    </html>
    """
    try:
        await asyncio.to_thread(_send_smtp_sync, smtp_cfg, clean_to, subject, html_body, plain_body)
        return {"ok": True, "masked_email": mask_email_address(clean_to)}
    except Exception as e:
        return {"ok": False, "error": f"E-posta gönderilemedi: {str(e)}"}


# --------------------------------------------------------------------------
# Auth, Multi-Method & 2-Stage 2FA (E-Mail + Google/Microsoft Authenticator)
# --------------------------------------------------------------------------
VALID_2FA_METHODS = ("email", "google_auth", "microsoft_auth")
_LOGIN_2FA_CHALLENGES: Dict[str, Dict[str, Any]] = {}
_PENDING_TOTP_SECRETS: Dict[str, str] = {}  # key: f"{user_id}:{method}"


def _build_local_qr_svg_data_uri(text_val: str) -> str:
    """Generates a zero-dependency local SVG QR data URI so 2FA QR never depends on external services."""
    try:
        from backend.services.totp_service import generate_qr_svg_data_uri
        return generate_qr_svg_data_uri(text_val)
    except Exception:
        return ""


def _method_display_label(method_id: str) -> str:
    return {
        "email": "E-Posta (E-Mail)",
        "google_auth": "Google Authenticator",
        "microsoft_auth": "Microsoft Authenticator",
    }.get(method_id, "Authenticator")


def _parse_user_2fa_secrets(u: MasterUser) -> Dict[str, Dict[str, Any]]:
    raw = getattr(u, "two_factor_secrets_json", None) or "{}"
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            data = {}
    except Exception:
        data = {}

    # Legacy migration: populate google_auth from totp_secret/totp_enabled
    if u.totp_secret and not (data.get("google_auth") or {}).get("secret"):
        data["google_auth"] = {
            "secret": u.totp_secret,
            "enrolled": bool(u.totp_enabled),
        }
    if getattr(u, "email_2fa_enabled", False) and not (data.get("email") or {}).get("enrolled"):
        data["email"] = {"enrolled": True}
    return data


def _parse_user_2fa_methods(u: MasterUser) -> List[str]:
    raw = getattr(u, "two_factor_methods_json", None) or "[]"
    try:
        arr = json.loads(raw)
        if not isinstance(arr, list):
            arr = []
    except Exception:
        arr = []

    clean: List[str] = []
    for item in arr:
        m = str(item or "").strip().lower()
        if m == "totp" or m == "app":
            m = "google_auth"
        if m in VALID_2FA_METHODS and m not in clean:
            clean.append(m)

    # Legacy fallback if JSON list wasn't populated yet
    if not clean:
        if getattr(u, "email_2fa_enabled", False):
            clean.append("email")
        if bool(u.totp_enabled and u.totp_secret):
            clean.append("google_auth")
    return clean


def _get_user_2fa_state(u: MasterUser) -> Dict[str, Any]:
    active_methods = _parse_user_2fa_methods(u)
    secrets_map = _parse_user_2fa_secrets(u)
    raw_mode = str(getattr(u, "two_factor_mode", None) or "single").strip().lower()
    if raw_mode not in ("single", "all", "any"):
        raw_mode = "single"
    if len(active_methods) <= 1:
        effective_mode = "single"
    else:
        effective_mode = raw_mode if raw_mode in ("all", "any") else "any"

    enabled = len(active_methods) > 0
    meta = {}
    for m in VALID_2FA_METHODS:
        entry = secrets_map.get(m) or {}
        meta[m] = {
            "enrolled": bool(entry.get("enrolled")),
            "has_secret": bool(entry.get("secret")) if m != "email" else bool(u.email),
        }

    return {
        "enabled": enabled,
        "mode": effective_mode,
        "active_methods": active_methods,
        "meta": meta,
        "secrets_map": secrets_map,
    }


def _sync_legacy_2fa_columns(u: MasterUser, active_methods: List[str], mode: str, secrets_map: Dict[str, Dict[str, Any]]):
    clean_methods = [m for m in active_methods if m in VALID_2FA_METHODS]
    clean_methods = list(dict.fromkeys(clean_methods))
    if len(clean_methods) <= 1:
        clean_mode = "single"
    else:
        clean_mode = mode if mode in ("all", "any") else "all"

    u.two_factor_methods_json = json.dumps(clean_methods)
    u.two_factor_mode = clean_mode
    u.two_factor_secrets_json = json.dumps(secrets_map)
    u.email_2fa_enabled = "email" in clean_methods
    has_app = ("google_auth" in clean_methods) or ("microsoft_auth" in clean_methods)
    u.totp_enabled = has_app
    # Sync primary totp_secret for backwards compatibility
    primary_sec = (
        (secrets_map.get("google_auth") or {}).get("secret")
        if "google_auth" in clean_methods
        else (secrets_map.get("microsoft_auth") or {}).get("secret")
    )
    if primary_sec:
        u.totp_secret = primary_sec
    elif not has_app:
        u.totp_secret = None


def _build_totp_qr_bundle(u: MasterUser, method_id: str, secret: str) -> Dict[str, str]:
    issuer = "Nornia Cloud Center" if method_id == "google_auth" else "Nornia Cloud Center (MS)"
    label = urllib.parse.quote(f"{issuer}:{u.username}")
    issuer_enc = urllib.parse.quote(issuer)
    otpauth_url = f"otpauth://totp/{label}?secret={secret}&issuer={issuer_enc}&algorithm=SHA1&digits=6&period=30"
    return {
        "secret": secret,
        "otpauth_url": otpauth_url,
        "qr_svg_data_uri": _build_local_qr_svg_data_uri(otpauth_url),
    }


class Verify2FASchema(BaseModel):
    temp_token: str
    code: str
    method: Optional[str] = None  # "email" | "google_auth" | "microsoft_auth" | "totp" | None


class ResendEmail2FASchema(BaseModel):
    temp_token: str


def _serialize_master_user(u: MasterUser) -> Dict[str, Any]:
    st = _get_user_2fa_state(u)
    return {
        "id": u.id,
        "username": u.username,
        "full_name": u.full_name,
        "email": u.email,
        "role": u.role,
        "is_active": u.is_active,
        "totp_enabled": ("google_auth" in st["active_methods"]) or ("microsoft_auth" in st["active_methods"]),
        "email_2fa_enabled": "email" in st["active_methods"],
        "two_factor_enabled": st["enabled"],
        "two_factor_mode": st["mode"],
        "two_factor_methods": st["active_methods"],
        "two_factor_meta": st["meta"],
        "expiring_soon_days": int(getattr(u, "expiring_soon_days", None) or 15),
        "auto_logout_minutes": 15 if getattr(u, "auto_logout_minutes", None) is None else int(getattr(u, "auto_logout_minutes", 15)),
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


@app.post("/api/v1/auth/login")
async def login_master_user(payload: LoginSchema, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Authenticates central master user with Brute-Force IP protection and single/2-stage 2FA support."""
    client_ip = extract_client_ip(request)
    pol = await get_or_create_security_policy(db)
    await check_ip_blocked(db, client_ip, pol)

    login_ident = payload.username.strip().lower()
    res = await db.execute(
        select(MasterUser).where(
            (func.lower(MasterUser.username) == login_ident)
            | (func.lower(MasterUser.email) == login_ident)
            | (func.lower(MasterUser.full_name) == login_ident)
        )
    )
    user = res.scalars().first()
    
    if not user or user.password_hash != hash_password(payload.password):
        await log_master_action(db, payload.username, "USER_LOGIN_FAILED", f"Başarısız Giriş Denemesi (Kullanıcı: {payload.username})", client_ip)
        rem = await record_failed_login_attempt(db, client_ip, payload.username, pol)
        raise HTTPException(status_code=401, detail=f"Kullanıcı adı veya şifre hatalı. (Kalan deneme hakkı: {rem})")
        
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Bu kullanıcı hesabı pasife alınmıştır.")

    st = _get_user_2fa_state(user)
    if st["enabled"] and st["active_methods"]:
        methods = st["active_methods"]
        mode = st["mode"]  # single | all | any
        secrets_map = st["secrets_map"]
        # Ensure secrets exist for any active authenticator methods (supports first-login enrollment!)
        dirty_sec = False
        for m in methods:
            if m in ("google_auth", "microsoft_auth") and not (secrets_map.get(m) or {}).get("secret"):
                secrets_map[m] = {"secret": generate_totp_secret(), "enrolled": False}
                dirty_sec = True
        if dirty_sec:
            _sync_legacy_2fa_columns(user, methods, mode, secrets_map)
            await db.commit()

        default_method = methods[0]
        temp_token = generate_2fa_temp_token(user.id, user.username)
        _LOGIN_2FA_CHALLENGES[temp_token] = {
            "user_id": user.id,
            "mode": mode,
            "required_methods": list(methods),
            "verified_methods": [],
            "expires_at": time.time() + 600,
        }

        email_sent = False
        email_error = None
        if default_method == "email":
            otp_info = generate_master_email_otp(f"login:{user.id}", user.email, ttl_seconds=300)
            send_res = await send_master_2fa_email_otp(pol, user.email, user.full_name, otp_info["code"], ttl_seconds=300)
            email_sent = bool(send_res.get("ok"))
            if not email_sent:
                email_error = send_res.get("error")

        # Provide first-login QR enrollment bundle if any active authenticator is not yet enrolled
        enrollment_bundles = {}
        for m in methods:
            if m in ("google_auth", "microsoft_auth"):
                entry = secrets_map.get(m) or {}
                if entry.get("secret") and not entry.get("enrolled"):
                    enrollment_bundles[m] = _build_totp_qr_bundle(user, m, entry["secret"])

        return {
            "success": True,
            "requires_2fa": True,
            "temp_token": temp_token,
            "username": user.username,
            "full_name": user.full_name,
            "mode": mode,
            "methods": methods,
            "required_methods": methods,
            "verified_methods": [],
            "default_method": default_method,
            "current_step_method": default_method,
            "masked_email": mask_email_address(user.email) if "email" in methods else None,
            "email_sent": email_sent,
            "email_error": email_error,
            "enrollment_bundles": enrollment_bundles,
        }

    _FAILED_LOGIN_TRACKER.pop(client_ip, None)
    user.last_login_at = datetime.datetime.utcnow()
    await db.commit()
    
    await log_master_action(db, user.username, "USER_LOGIN", f"Başarılı Kullanıcı Girişi ({user.full_name})", client_ip, user.id)
    access_token = generate_master_session_token(user)
    
    return {
        "success": True,
        "requires_2fa": False,
        "access_token": access_token,
        "auto_logout_minutes": 15 if getattr(user, "auto_logout_minutes", None) is None else int(user.auto_logout_minutes),
        "user": _serialize_master_user(user),
    }


@app.post("/api/v1/auth/resend-email-2fa")
async def resend_master_user_email_2fa(payload: ResendEmail2FASchema, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Sends or resends the 6-digit E-Mail 2FA OTP during an active login challenge."""
    client_ip = extract_client_ip(request)
    pol = await get_or_create_security_policy(db)
    await check_ip_blocked(db, client_ip, pol)

    uid = verify_2fa_temp_token(payload.temp_token)
    if not uid:
        raise HTTPException(status_code=401, detail="2FA doğrulama oturumu süresi doldu. Lütfen tekrar giriş yapınız.")

    res = await db.execute(select(MasterUser).where(MasterUser.id == uid))
    user = res.scalars().first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı veya pasif.")
    st = _get_user_2fa_state(user)
    if "email" not in st["active_methods"] or not user.email:
        raise HTTPException(status_code=400, detail="Bu kullanıcıda E-Posta 2FA aktif değil.")

    otp_info = generate_master_email_otp(f"login:{user.id}", user.email, ttl_seconds=300)
    send_res = await send_master_2fa_email_otp(pol, user.email, user.full_name, otp_info["code"], ttl_seconds=300)
    if not send_res.get("ok"):
        raise HTTPException(status_code=400, detail=send_res.get("error") or "Doğrulama e-postası gönderilemedi.")

    return {
        "success": True,
        "masked_email": otp_info["masked_email"],
        "expires_in": otp_info["expires_in"],
        "message": f"6 haneli doğrulama kodu {otp_info['masked_email']} adresine gönderildi.",
    }


@app.post("/api/v1/auth/verify-2fa")
async def verify_master_user_2fa(payload: Verify2FASchema, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Verifies a 6-digit 2FA code (supporting single, flexible VEYA, and 2-stage mandatory VE modes)."""
    client_ip = extract_client_ip(request)
    pol = await get_or_create_security_policy(db)
    await check_ip_blocked(db, client_ip, pol)

    uid = verify_2fa_temp_token(payload.temp_token)
    if not uid:
        raise HTTPException(status_code=401, detail="2FA doğrulama oturumu süresi doldu. Lütfen tekrar giriş yapınız.")

    res = await db.execute(select(MasterUser).where(MasterUser.id == uid))
    user = res.scalars().first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı veya pasif.")

    st = _get_user_2fa_state(user)
    secrets_map = st["secrets_map"]
    challenge = _LOGIN_2FA_CHALLENGES.get(payload.temp_token)
    if not challenge or challenge.get("user_id") != user.id:
        challenge = {
            "user_id": user.id,
            "mode": st["mode"],
            "required_methods": list(st["active_methods"]),
            "verified_methods": [],
            "expires_at": time.time() + 600,
        }
        _LOGIN_2FA_CHALLENGES[payload.temp_token] = challenge

    mode = challenge.get("mode", st["mode"])
    required_methods: List[str] = list(challenge.get("required_methods") or st["active_methods"])
    verified_methods: List[str] = list(challenge.get("verified_methods") or [])

    req_method = (payload.method or "").strip().lower()
    if req_method in ("totp", "app"):
        req_method = "google_auth" if "google_auth" in required_methods else (
            "microsoft_auth" if "microsoft_auth" in required_methods else "google_auth"
        )

    # In mandatory VE (all) mode, enforce the next unverified step if no specific method given
    remaining_before = [m for m in required_methods if m not in verified_methods]
    if mode == "all" and remaining_before and req_method not in remaining_before:
        req_method = remaining_before[0]

    def _verify_for_method(m_id: str) -> bool:
        if m_id == "email":
            return verify_master_email_otp(f"login:{user.id}", payload.code, consume=True)
        if m_id in ("google_auth", "microsoft_auth"):
            sec = (secrets_map.get(m_id) or {}).get("secret") or (user.totp_secret if m_id == "google_auth" else None)
            return bool(sec and verify_totp_code(sec, payload.code))
        return False

    matched_method = None
    if req_method in required_methods:
        if _verify_for_method(req_method):
            matched_method = req_method
    else:
        for cand in remaining_before or required_methods:
            if _verify_for_method(cand):
                matched_method = cand
                break

    if not matched_method:
        fail_label = _method_display_label(req_method) if req_method else "2FA"
        await log_master_action(db, user.username, "USER_2FA_FAILED", f"Hatalı 2FA Kodu ({fail_label} - {user.username})", client_ip, user.id)
        rem = await record_failed_login_attempt(db, client_ip, user.username, pol)
        raise HTTPException(status_code=401, detail=f"6 haneli {fail_label} doğrulama kodu hatalı veya süresi dolmuş. (Kalan deneme hakkı: {rem})")

    # Mark method enrolled if it was enrolled during first login
    if not (secrets_map.get(matched_method) or {}).get("enrolled"):
        entry = dict(secrets_map.get(matched_method) or {})
        entry["enrolled"] = True
        secrets_map[matched_method] = entry
        _sync_legacy_2fa_columns(user, st["active_methods"], st["mode"], secrets_map)
        await db.commit()

    if matched_method not in verified_methods:
        verified_methods.append(matched_method)
        challenge["verified_methods"] = verified_methods

    # If VE (all) mode still has remaining steps, advance to next step!
    remaining_after = [m for m in required_methods if m not in verified_methods]
    if mode == "all" and remaining_after:
        next_method = remaining_after[0]
        email_sent = False
        email_error = None
        if next_method == "email":
            otp_info = generate_master_email_otp(f"login:{user.id}", user.email, ttl_seconds=300)
            send_res = await send_master_2fa_email_otp(pol, user.email, user.full_name, otp_info["code"], ttl_seconds=300)
            email_sent = bool(send_res.get("ok"))
            if not email_sent:
                email_error = send_res.get("error")

        enrollment_bundles = {}
        if next_method in ("google_auth", "microsoft_auth"):
            entry = secrets_map.get(next_method) or {}
            if entry.get("secret") and not entry.get("enrolled"):
                enrollment_bundles[next_method] = _build_totp_qr_bundle(user, next_method, entry["secret"])

        return {
            "success": True,
            "completed": False,
            "requires_next_step": True,
            "mode": mode,
            "required_methods": required_methods,
            "verified_methods": verified_methods,
            "current_step_method": next_method,
            "masked_email": mask_email_address(user.email) if "email" in required_methods else None,
            "email_sent": email_sent,
            "email_error": email_error,
            "enrollment_bundles": enrollment_bundles,
            "message": f"{_method_display_label(matched_method)} doğrulandı. Şimdi {_method_display_label(next_method)} kodunu giriniz.",
        }

    # Login fully completed!
    _LOGIN_2FA_CHALLENGES.pop(payload.temp_token, None)
    _FAILED_LOGIN_TRACKER.pop(client_ip, None)
    user.last_login_at = datetime.datetime.utcnow()
    await db.commit()

    labels = " + ".join(_method_display_label(m) for m in verified_methods)
    await log_master_action(db, user.username, "USER_LOGIN_2FA", f"2FA ({labels}) ile Başarılı Giriş ({user.full_name})", client_ip, user.id)
    access_token = generate_master_session_token(user)

    return {
        "success": True,
        "completed": True,
        "access_token": access_token,
        "auto_logout_minutes": 15 if getattr(user, "auto_logout_minutes", None) is None else int(user.auto_logout_minutes),
        "user": _serialize_master_user(user),
    }


@app.get("/api/v1/auth/me")
async def get_authenticated_master_me(request: Request, db: AsyncSession = Depends(get_central_db)):
    """Validates active Bearer token and returns current authenticated master user profile."""
    s_info = getattr(request.state, "master_user", None) or {}
    uid = s_info.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Oturum geçersiz.")
    res = await db.execute(select(MasterUser).where(MasterUser.id == int(uid)))
    u = res.scalars().first()
    if not u or not u.is_active:
        raise HTTPException(status_code=401, detail="Kullanıcı aktif değil.")
    return {
        "valid": True,
        "user": _serialize_master_user(u),
        "auto_logout_minutes": 15 if getattr(u, "auto_logout_minutes", None) is None else int(u.auto_logout_minutes),
    }


@app.post("/api/v1/auth/logout")
async def logout_master_user(request: Request, db: AsyncSession = Depends(get_central_db)):
    """Logs user logout event and immediately revokes the active session token."""
    tok = extract_master_token_from_request(request)
    revoke_master_session_token(tok)
    s_info = getattr(request.state, "master_user", None) or {}
    username = s_info.get("u") or request.headers.get("X-User-Name", "admin")
    reason = request.headers.get("X-Logout-Reason", "manual")
    action_code = "AUTO_LOGOUT" if reason == "idle_timeout" else "USER_LOGOUT"
    msg = f"Hareketsizlik Nedeniyle Otomatik Oturum Kapatıldı ({username})" if reason == "idle_timeout" else f"Kullanıcı Çıkış Yaptı ({username})"
    await log_master_action(db, username, action_code, msg, extract_client_ip(request))
    return {"success": True, "message": "Çıkış yapıldı."}


@app.get("/api/v1/system/backups")
async def list_central_db_backups(db: AsyncSession = Depends(get_central_db)):
    """Returns SQLite DB health (WAL mode, size, telemetry log count) and recent daily backup snapshots."""
    os.makedirs(BACKUPS_DIR, exist_ok=True)
    db_size_bytes = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0
    wal_path = f"{DB_PATH}-wal"
    wal_size_bytes = os.path.getsize(wal_path) if os.path.exists(wal_path) else 0

    journal_mode = "unknown"
    try:
        from sqlalchemy import text as _sq_text
        res_jm = await db.execute(_sq_text("PRAGMA journal_mode;"))
        journal_mode = str(res_jm.scalar() or "unknown").upper()
    except Exception:
        pass

    t_count = 0
    try:
        res_tc = await db.execute(select(func.count(TelemetryLog.id)))
        t_count = int(res_tc.scalar() or 0)
    except Exception:
        pass

    backups = []
    try:
        for fname in os.listdir(BACKUPS_DIR):
            if fname.endswith(".db"):
                full_p = os.path.join(BACKUPS_DIR, fname)
                if os.path.isfile(full_p):
                    st = os.stat(full_p)
                    backups.append({
                        "filename": fname,
                        "size_kb": round(st.st_size / 1024.0, 1),
                        "created_at": datetime.datetime.utcfromtimestamp(st.st_mtime).isoformat(),
                    })
        backups.sort(key=lambda x: x["created_at"], reverse=True)
    except Exception:
        pass

    return {
        "db_size_mb": round((db_size_bytes + wal_size_bytes) / (1024.0 * 1024.0), 2),
        "journal_mode": journal_mode,
        "telemetry_log_count": t_count,
        "retention_days": 30,
        "backups": backups[:20],
    }


@app.post("/api/v1/system/backups/create")
async def create_central_db_backup_now(request: Request, db: AsyncSession = Depends(get_central_db)):
    """Creates an immediate WAL-safe online SQLite backup snapshot."""
    s_info = getattr(request.state, "master_user", None) or {}
    performed_by = s_info.get("u") or request.headers.get("X-User-Name", "admin")
    ts_tag = (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).strftime("%Y%m%d_%H%M%S")
    fname = f"license_center_manual_{ts_tag}.db"
    dest_path = os.path.join(BACKUPS_DIR, fname)
    await asyncio.to_thread(_create_sqlite_online_backup_sync, dest_path)
    await asyncio.to_thread(_prune_old_backup_files_sync, 20)
    size_kb = round(os.path.getsize(dest_path) / 1024.0, 1)
    await log_master_action(
        db,
        performed_by,
        "DB_BACKUP_CREATE",
        f"Merkezi Veritabanı Yedeği Oluşturuldu: {fname} ({size_kb} KB)",
        extract_client_ip(request),
    )
    return {"success": True, "filename": fname, "size_kb": size_kb}


@app.get("/api/v1/system/backups/download")
async def download_central_db_backup(
    request: Request,
    filename: Optional[str] = None,
    db: AsyncSession = Depends(get_central_db),
):
    """Streams either a named backup file or a freshly created live WAL-safe snapshot as a .db download."""
    s_info = getattr(request.state, "master_user", None) or {}
    performed_by = s_info.get("u") or request.headers.get("X-User-Name", "admin")

    if filename:
        safe_name = os.path.basename(str(filename).strip())
        if not safe_name.endswith(".db") or "/" in safe_name or "\\" in safe_name:
            raise HTTPException(status_code=400, detail="Geçersiz yedek dosya adı.")
        target_path = os.path.join(BACKUPS_DIR, safe_name)
        if not os.path.isfile(target_path):
            raise HTTPException(status_code=404, detail="Yedek dosyası bulunamadı.")
        dl_name = safe_name
    else:
        ts_tag = (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).strftime("%Y%m%d_%H%M%S")
        dl_name = f"nornia_panel_backup_{ts_tag}.db"
        target_path = os.path.join(BACKUPS_DIR, f"license_center_download_{ts_tag}.db")
        await asyncio.to_thread(_create_sqlite_online_backup_sync, target_path)
        await asyncio.to_thread(_prune_old_backup_files_sync, 20)

    await log_master_action(
        db,
        performed_by,
        "DB_BACKUP_DOWNLOAD",
        f"Merkezi Veritabanı Yedeği İndirildi: {dl_name}",
        extract_client_ip(request),
    )
    return FileResponse(
        path=target_path,
        media_type="application/octet-stream",
        filename=dl_name,
    )


# --------------------------------------------------------------------------
# Panel Server Firewall Management (UFW Port & Access Control)
# --------------------------------------------------------------------------
def _run_ufw_cmd_sync(args: List[str], timeout: float = 8.0) -> Dict[str, Any]:
    import shutil
    import subprocess
    ufw_bin = shutil.which("ufw")
    if not ufw_bin:
        return {"ok": False, "supported": False, "stdout": "", "stderr": "Bu sunucuda UFW yüklü değil (Linux sunucuda çalışır)."}
    try:
        proc = subprocess.run([ufw_bin] + args, capture_output=True, text=True, timeout=timeout)
        return {
            "ok": proc.returncode == 0,
            "supported": True,
            "stdout": (proc.stdout or "").strip(),
            "stderr": (proc.stderr or "").strip(),
        }
    except Exception as ex:
        return {"ok": False, "supported": True, "stdout": "", "stderr": str(ex)}


def _parse_ufw_status_sync() -> Dict[str, Any]:
    import re as _re
    import shutil
    import subprocess

    ufw_bin = shutil.which("ufw")
    listening_ports: List[Dict[str, Any]] = []
    ss_bin = shutil.which("ss")
    if ss_bin:
        try:
            ss_proc = subprocess.run([ss_bin, "-tulnp"], capture_output=True, text=True, timeout=5.0)
            seen_lp = set()
            for ln in (ss_proc.stdout or "").splitlines()[1:]:
                parts = ln.split()
                if len(parts) < 5:
                    continue
                proto = parts[0].lower().replace("6", "")
                if proto not in ("tcp", "udp"):
                    continue
                local_addr = parts[4]
                if ":" not in local_addr:
                    continue
                host_part, port_part = local_addr.rsplit(":", 1)
                if not port_part.isdigit():
                    continue
                port_num = int(port_part)
                host_clean = host_part.strip("[]")
                is_public = host_clean in ("0.0.0.0", "*", "::", "")
                proc_m = _re.search(r'"([^"]+)"', ln)
                proc_name = proc_m.group(1) if proc_m else "-"
                lp_key = (proto, port_num, host_clean)
                if lp_key in seen_lp:
                    continue
                seen_lp.add(lp_key)
                listening_ports.append({
                    "protocol": proto,
                    "port": port_num,
                    "bind": host_clean or "0.0.0.0",
                    "is_public": is_public,
                    "process": proc_name,
                })
            listening_ports.sort(key=lambda x: (not x["is_public"], x["port"], x["protocol"]))
        except Exception:
            pass

    if not ufw_bin:
        return {
            "supported": False,
            "enabled": False,
            "default_incoming": "unknown",
            "default_outgoing": "unknown",
            "rules": [],
            "listening_ports": listening_ports,
            "message": "UFW yalnızca Linux panel sunucusunda aktiftir.",
        }

    verbose_res = _run_ufw_cmd_sync(["status", "verbose"])
    num_res = _run_ufw_cmd_sync(["status", "numbered"])

    raw_v = verbose_res.get("stdout") or ""
    enabled = "status: active" in raw_v.lower()
    def_in = "deny"
    def_out = "allow"
    m_def = _re.search(r"Default:\s*([a-z]+)\s*\(incoming\),\s*([a-z]+)\s*\(outgoing\)", raw_v, flags=_re.IGNORECASE)
    if m_def:
        def_in = m_def.group(1).lower()
        def_out = m_def.group(2).lower()

    rules: List[Dict[str, Any]] = []
    for ln in (num_res.get("stdout") or "").splitlines():
        m_r = _re.match(r"^\[\s*(\d+)\]\s+(.+?)\s{2,}(ALLOW IN|DENY IN|REJECT IN|LIMIT IN|ALLOW OUT|DENY OUT|ALLOW|DENY|REJECT|LIMIT)\s+(.+)$", ln.strip())
        if not m_r:
            continue
        r_num = int(m_r.group(1))
        to_val = m_r.group(2).strip()
        act_val = m_r.group(3).strip().upper()
        from_val = m_r.group(4).strip()
        is_crit = any(tok in to_val for tok in ("22/tcp", "22 ", "443/tcp", "443 ", "80/tcp", "80 ")) or to_val in ("22", "80", "443")
        rules.append({
            "num": r_num,
            "to": to_val,
            "action": act_val,
            "from_ip": from_val,
            "is_critical": is_crit,
        })

    return {
        "supported": True,
        "enabled": enabled,
        "default_incoming": def_in,
        "default_outgoing": def_out,
        "rules": rules,
        "listening_ports": listening_ports,
        "raw_error": verbose_res.get("stderr") or "",
    }


@app.get("/api/v1/security/firewall/status")
async def get_panel_firewall_status():
    """Returns live UFW firewall status, numbered port rules, and listening ports on the panel server."""
    return await asyncio.to_thread(_parse_ufw_status_sync)


@app.post("/api/v1/security/firewall/toggle")
async def toggle_panel_firewall(request: Request, payload: Dict[str, Any] = Body(...), db: AsyncSession = Depends(get_central_db)):
    """Enables or disables UFW safely (always ensuring SSH 22, HTTP 80, HTTPS 443 are allowed before enabling)."""
    s_info = getattr(request.state, "master_user", None) or {}
    performed_by = s_info.get("u") or request.headers.get("X-User-Name", "admin")
    want_enable = bool(payload.get("enabled", True))

    def _do_toggle():
        if want_enable:
            _run_ufw_cmd_sync(["default", "deny", "incoming"])
            _run_ufw_cmd_sync(["default", "allow", "outgoing"])
            _run_ufw_cmd_sync(["allow", "22/tcp"])
            _run_ufw_cmd_sync(["allow", "80/tcp"])
            _run_ufw_cmd_sync(["allow", "443/tcp"])
            return _run_ufw_cmd_sync(["--force", "enable"])
        return _run_ufw_cmd_sync(["--force", "disable"])

    res = await asyncio.to_thread(_do_toggle)
    if not res.get("supported"):
        raise HTTPException(status_code=400, detail=res.get("stderr") or "UFW bu sunucuda desteklenmiyor.")
    if not res.get("ok"):
        raise HTTPException(status_code=500, detail=res.get("stderr") or "Güvenlik duvarı durumu değiştirilemedi.")

    await log_master_action(
        db,
        performed_by,
        "FIREWALL_TOGGLE",
        f"Panel Güvenlik Duvarı (UFW) {'Aktif Edildi (22/80/443 korumalı)' if want_enable else 'Devre Dışı Bırakıldı'}",
        extract_client_ip(request),
    )
    status_data = await asyncio.to_thread(_parse_ufw_status_sync)
    return {"success": True, **status_data}


@app.post("/api/v1/security/firewall/rules")
async def add_panel_firewall_rule(request: Request, payload: Dict[str, Any] = Body(...), db: AsyncSession = Depends(get_central_db)):
    """Adds a strictly validated UFW port rule (allow/deny, tcp/udp/any, optional source IP/CIDR)."""
    import re as _re
    s_info = getattr(request.state, "master_user", None) or {}
    performed_by = s_info.get("u") or request.headers.get("X-User-Name", "admin")

    port_raw = str(payload.get("port") or "").strip()
    proto = str(payload.get("protocol") or "tcp").strip().lower()
    action = str(payload.get("action") or "allow").strip().lower()
    source_ip = str(payload.get("source_ip") or "").strip()

    if not _re.match(r"^\d{1,5}(:\d{1,5})?$", port_raw):
        raise HTTPException(status_code=400, detail="Geçersiz port biçimi. Örn: 443 veya 8000:8010")
    for p_seg in port_raw.split(":"):
        if not (1 <= int(p_seg) <= 65535):
            raise HTTPException(status_code=400, detail="Port numarası 1 ile 65535 arasında olmalıdır.")

    if proto not in ("tcp", "udp", "any"):
        raise HTTPException(status_code=400, detail="Protokol tcp, udp veya any olmalıdır.")
    if action not in ("allow", "deny"):
        raise HTTPException(status_code=400, detail="Aksiyon allow (İzin Ver) veya deny (Engelle) olmalıdır.")

    if action == "deny" and port_raw in ("22", "443") and (not source_ip or source_ip.lower() in ("any", "anywhere", "0.0.0.0/0")):
        raise HTTPException(status_code=400, detail="Kilitlenme koruması: Tüm dünyaya 22 (SSH) veya 443 (HTTPS Panel) portları kapatılamaz.")

    if source_ip and source_ip.lower() not in ("any", "anywhere"):
        if not _re.match(r"^[0-9a-fA-F.:/]+$", source_ip):
            raise HTTPException(status_code=400, detail="Geçersiz kaynak IP / CIDR adresi.")
        cmd = [action, "from", source_ip, "to", "any", "port", port_raw]
        if proto in ("tcp", "udp"):
            cmd += ["proto", proto]
    else:
        port_spec = f"{port_raw}/{proto}" if proto in ("tcp", "udp") else port_raw
        cmd = [action, port_spec]

    res = await asyncio.to_thread(_run_ufw_cmd_sync, cmd)
    if not res.get("supported"):
        raise HTTPException(status_code=400, detail=res.get("stderr") or "UFW bu sunucuda desteklenmiyor.")
    if not res.get("ok"):
        raise HTTPException(status_code=500, detail=res.get("stderr") or "Kural eklenemedi.")

    await log_master_action(
        db,
        performed_by,
        "FIREWALL_RULE_ADD",
        f"Güvenlik Duvarı Kuralı Eklendi: {action.upper()} Port={port_raw}/{proto} Kaynak={source_ip or 'Anywhere'}",
        extract_client_ip(request),
    )
    status_data = await asyncio.to_thread(_parse_ufw_status_sync)
    return {"success": True, **status_data}


@app.delete("/api/v1/security/firewall/rules/{rule_num}")
async def delete_panel_firewall_rule(rule_num: int, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Deletes a numbered UFW rule safely."""
    s_info = getattr(request.state, "master_user", None) or {}
    performed_by = s_info.get("u") or request.headers.get("X-User-Name", "admin")
    if rule_num < 1 or rule_num > 500:
        raise HTTPException(status_code=400, detail="Geçersiz kural numarası.")

    res = await asyncio.to_thread(_run_ufw_cmd_sync, ["--force", "delete", str(rule_num)])
    if not res.get("supported"):
        raise HTTPException(status_code=400, detail=res.get("stderr") or "UFW bu sunucuda desteklenmiyor.")
    if not res.get("ok"):
        raise HTTPException(status_code=500, detail=res.get("stderr") or "Kural silinemedi.")

    await log_master_action(
        db,
        performed_by,
        "FIREWALL_RULE_DELETE",
        f"Güvenlik Duvarı Kuralı Silindi: #{rule_num}",
        extract_client_ip(request),
    )
    status_data = await asyncio.to_thread(_parse_ufw_status_sync)
    return {"success": True, **status_data}


@app.post("/api/v1/security/firewall/harden-preset")
async def apply_panel_firewall_harden_preset(request: Request, db: AsyncSession = Depends(get_central_db)):
    """Applies recommended Nornia Panel firewall hardening: allow ONLY 22/tcp, 80/tcp, 443/tcp and block public 8050/3050."""
    s_info = getattr(request.state, "master_user", None) or {}
    performed_by = s_info.get("u") or request.headers.get("X-User-Name", "admin")

    def _do_harden():
        chk = _run_ufw_cmd_sync(["default", "deny", "incoming"])
        if not chk.get("supported"):
            return chk
        _run_ufw_cmd_sync(["default", "allow", "outgoing"])
        _run_ufw_cmd_sync(["allow", "22/tcp"])
        _run_ufw_cmd_sync(["allow", "80/tcp"])
        _run_ufw_cmd_sync(["allow", "443/tcp"])
        for internal_p in ("8050", "8050/tcp", "3050", "3050/tcp"):
            _run_ufw_cmd_sync(["--force", "delete", "allow", internal_p])
        return _run_ufw_cmd_sync(["--force", "enable"])

    res = await asyncio.to_thread(_do_harden)
    if not res.get("supported"):
        raise HTTPException(status_code=400, detail=res.get("stderr") or "UFW bu sunucuda desteklenmiyor.")
    if not res.get("ok"):
        raise HTTPException(status_code=500, detail=res.get("stderr") or "Önerilen güvenlik duvarı profili uygulanamadı.")

    await log_master_action(
        db,
        performed_by,
        "FIREWALL_HARDEN_PRESET",
        "Önerilen Panel Güvenlik Duvarı Profili Uygulandı (Sadece 22, 80, 443 açık; 8050 ve 3050 dışarıya kapatıldı)",
        extract_client_ip(request),
    )
    status_data = await asyncio.to_thread(_parse_ufw_status_sync)
    return {"success": True, **status_data}


@app.get("/api/v1/security/sip-edge/status")
async def get_sip_edge_status_endpoint():
    """Returns live Hub status of Nornia SIP/RTP Edge (WireGuard wg0, Kamailio 5060/5061, RTPEngine 20000-40000)."""
    from license_center.backend.sip_edge_manager import get_sip_edge_live_status_sync
    return await asyncio.to_thread(get_sip_edge_live_status_sync)


@app.post("/api/v1/security/firewall/sip-edge-ports")
async def toggle_sip_edge_firewall_ports(
    request: Request,
    payload: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_central_db),
):
    """Safely opens or closes the Nornia SIP/RTP Edge ports (51820/udp, 5060/udp+tcp, 5061/tcp, 20000:40000/udp) in UFW."""
    s_info = getattr(request.state, "master_user", None) or {}
    performed_by = s_info.get("u") or request.headers.get("X-User-Name", "admin")
    want_open = bool(payload.get("enabled", True))
    edge_ports = ["51820/udp", "5060/udp", "5060/tcp", "5061/tcp", "20000:40000/udp"]

    def _do_edge_ports():
        chk = _run_ufw_cmd_sync(["status"])
        if not chk.get("supported"):
            return chk
        for p_spec in edge_ports:
            if want_open:
                _run_ufw_cmd_sync(["allow", p_spec])
            else:
                _run_ufw_cmd_sync(["--force", "delete", "allow", p_spec])
        return {"ok": True, "supported": True}

    res = await asyncio.to_thread(_do_edge_ports)
    if not res.get("supported"):
        raise HTTPException(status_code=400, detail=res.get("stderr") or "UFW bu sunucuda desteklenmiyor.")

    await log_master_action(
        db,
        performed_by,
        "FIREWALL_RULE_ADD" if want_open else "FIREWALL_RULE_DELETE",
        f"Nornia SIP/RTP Edge Portları (51820, 5060, 5061, 20000-40000) {'Açıldı' if want_open else 'Kapatıldı'}",
        extract_client_ip(request),
    )
    status_data = await asyncio.to_thread(_parse_ufw_status_sync)
    return {"success": True, **status_data}


@app.get("/api/v1/users")
async def get_master_users(db: AsyncSession = Depends(get_central_db)):
    """Returns list of all central master portal users."""
    res = await db.execute(select(MasterUser).order_by(MasterUser.id.asc()))
    users = res.scalars().all()
    return [_serialize_master_user(u) for u in users]


@app.put("/api/v1/users/{user_id}/preferences")
async def update_master_user_preferences(user_id: int, request: Request, payload: Dict[str, Any] = Body(...), db: AsyncSession = Depends(get_central_db)):
    """Saves per-user dashboard preferences such as expiring_soon_days and auto_logout_minutes."""
    res = await db.execute(select(MasterUser).where(MasterUser.id == user_id))
    u = res.scalars().first()
    if not u:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    if "expiring_soon_days" in payload:
        try:
            days_val = int(payload.get("expiring_soon_days") or 15)
        except Exception:
            raise HTTPException(status_code=400, detail="Geçersiz gün değeri.")
        if days_val not in (7, 15, 30, 60, 90, 120):
            raise HTTPException(status_code=400, detail="Geçerli seçenekler: 7, 15, 30, 60, 90 veya 120 gün.")
        u.expiring_soon_days = days_val

    if "auto_logout_minutes" in payload:
        try:
            raw_mins = payload.get("auto_logout_minutes")
            mins_val = int(0 if raw_mins is None else raw_mins)
        except Exception:
            raise HTTPException(status_code=400, detail="Geçersiz otomatik çıkış süresi.")
        if mins_val < 0 or mins_val > 1440:
            raise HTTPException(status_code=400, detail="Otomatik çıkış süresi 0 ile 1440 dakika arasında olmalıdır.")
        u.auto_logout_minutes = mins_val
        performed_by = request.headers.get("X-User-Name", u.username)
        lbl = "Kapalı" if mins_val == 0 else f"{mins_val} Dakika"
        await log_master_action(
            db,
            performed_by,
            "USER_AUTO_LOGOUT_PREF",
            f"Kullanıcı Otomatik Oturum Kapatma Süresini Güncelledi ({u.username}): {lbl}",
            extract_client_ip(request),
            u.id,
        )

    await db.commit()
    await db.refresh(u)
    return {
        "success": True,
        "expiring_soon_days": int(u.expiring_soon_days or 15),
        "auto_logout_minutes": 15 if u.auto_logout_minutes is None else int(u.auto_logout_minutes),
        "user": _serialize_master_user(u),
    }


@app.post("/api/v1/users/{user_id}/change-password")
async def change_master_user_password(user_id: int, request: Request, payload: Dict[str, Any] = Body(...), db: AsyncSession = Depends(get_central_db)):
    """Self-service password update requiring current password verification."""
    res = await db.execute(select(MasterUser).where(MasterUser.id == user_id))
    u = res.scalars().first()
    if not u:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    current_pw = str(payload.get("current_password") or "")
    new_pw = str(payload.get("new_password") or "")
    confirm_pw = payload.get("confirm_password")

    if not current_pw.strip():
        raise HTTPException(status_code=400, detail="Lütfen mevcut şifrenizi giriniz.")
    if hash_password(current_pw) != u.password_hash:
        raise HTTPException(status_code=400, detail="Mevcut şifreniz hatalı.")
    if len(new_pw.strip()) < 6:
        raise HTTPException(status_code=400, detail="Yeni şifre en az 6 karakter olmalıdır.")
    if confirm_pw is not None and str(confirm_pw) != new_pw:
        raise HTTPException(status_code=400, detail="Yeni şifre ve şifre tekrarı eşleşmiyor.")
    if new_pw.strip() == current_pw.strip():
        raise HTTPException(status_code=400, detail="Yeni şifre mevcut şifrenizle aynı olamaz.")

    u.password_hash = hash_password(new_pw)
    await db.commit()
    await db.refresh(u)

    performed_by = request.headers.get("X-User-Name", u.username)
    await log_master_action(
        db,
        performed_by,
        "USER_PASSWORD_CHANGE",
        f"Kullanıcı Kendi Şifresini Güncelledi: {u.full_name} (@{u.username})",
        extract_client_ip(request),
        u.id,
    )
    return {
        "success": True,
        "message": "Şifreniz başarıyla güncellendi.",
        "user": _serialize_master_user(u),
    }


@app.post("/api/v1/users/{user_id}/2fa/config")
async def save_master_user_2fa_config(user_id: int, request: Request, payload: Dict[str, Any] = Body(...), db: AsyncSession = Depends(get_central_db)):
    """Saves the user's complete 2FA configuration (enabled, single/all/any mode, active methods order)."""
    res = await db.execute(select(MasterUser).where(MasterUser.id == user_id))
    u = res.scalars().first()
    if not u:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    enabled = bool(payload.get("enabled", False))
    mode = str(payload.get("mode") or "single").strip().lower()
    if mode not in ("single", "all", "any"):
        mode = "single"

    raw_methods = payload.get("active_methods")
    if not isinstance(raw_methods, list):
        raw_methods = []
    clean_methods = [str(m).strip().lower() for m in raw_methods if str(m).strip().lower() in VALID_2FA_METHODS]
    clean_methods = list(dict.fromkeys(clean_methods))

    st = _get_user_2fa_state(u)
    secrets_map = st["secrets_map"]

    if not enabled:
        clean_methods = []
        mode = "single"
    else:
        if not clean_methods:
            clean_methods = ["google_auth"]
        if mode == "single":
            clean_methods = [clean_methods[0]]
        # Auto-generate TOTP secret if an authenticator method is selected and doesn't have one yet
        for m in clean_methods:
            if m in ("google_auth", "microsoft_auth") and not (secrets_map.get(m) or {}).get("secret"):
                secrets_map[m] = {"secret": generate_totp_secret(), "enrolled": False}

    _sync_legacy_2fa_columns(u, clean_methods, mode, secrets_map)
    await db.commit()
    await db.refresh(u)

    performed_by = request.headers.get("X-User-Name", u.username)
    if enabled:
        mode_lbl = {"single": "Tek Yöntem", "all": "2 Aşamalı Zorunlu (VE)", "any": "Esnek / Yedekli (VEYA)"}.get(mode, mode)
        m_lbls = " + ".join(_method_display_label(m) for m in clean_methods)
        await log_master_action(db, performed_by, "USER_2FA_CONFIG", f"2FA Ayarları Güncellendi ({u.username}): {mode_lbl} [{m_lbls}]", extract_client_ip(request), u.id)
    else:
        await log_master_action(db, performed_by, "USER_2FA_DISABLED", f"2FA Kapatıldı: {u.full_name} (@{u.username})", extract_client_ip(request), u.id)

    return {"success": True, "user": _serialize_master_user(u)}


@app.post("/api/v1/users/{user_id}/2fa/setup")
async def setup_master_user_2fa(user_id: int, request: Request, payload: Dict[str, Any] = Body(default={}), db: AsyncSession = Depends(get_central_db)):
    """Returns existing or fresh TOTP secret, otpauth:// URI, and local SVG QR for google_auth or microsoft_auth."""
    res = await db.execute(select(MasterUser).where(MasterUser.id == user_id))
    u = res.scalars().first()
    if not u:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    method_id = str((payload or {}).get("method") or "google_auth").strip().lower()
    if method_id not in ("google_auth", "microsoft_auth"):
        method_id = "google_auth"
    reset_flag = bool((payload or {}).get("reset", False))

    st = _get_user_2fa_state(u)
    secrets_map = st["secrets_map"]
    existing_entry = secrets_map.get(method_id) or {}
    existing_secret = existing_entry.get("secret")
    is_enrolled = bool(existing_entry.get("enrolled"))

    pending_key = f"{u.id}:{method_id}"
    if reset_flag or not existing_secret:
        secret = generate_totp_secret()
        if is_enrolled and reset_flag:
            # Keep active secret safe until new QR is verified!
            _PENDING_TOTP_SECRETS[pending_key] = secret
        else:
            secrets_map[method_id] = {"secret": secret, "enrolled": False}
            _PENDING_TOTP_SECRETS.pop(pending_key, None)
            _sync_legacy_2fa_columns(u, st["active_methods"], st["mode"], secrets_map)
            await db.commit()
    else:
        secret = existing_secret
        _PENDING_TOTP_SECRETS.pop(pending_key, None)

    bundle = _build_totp_qr_bundle(u, method_id, secret)
    return {
        "success": True,
        "user_id": u.id,
        "username": u.username,
        "method": method_id,
        "enrolled": is_enrolled and not reset_flag,
        **bundle,
    }


@app.post("/api/v1/users/{user_id}/2fa/enable")
async def enable_master_user_2fa(user_id: int, request: Request, payload: Dict[str, Any] = Body(...), db: AsyncSession = Depends(get_central_db)):
    """Verifies the 6-digit code for Google/Microsoft Authenticator or E-Mail and marks that method enrolled."""
    res = await db.execute(select(MasterUser).where(MasterUser.id == user_id))
    u = res.scalars().first()
    if not u:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    method_id = str((payload or {}).get("method") or "google_auth").strip().lower()
    if method_id not in VALID_2FA_METHODS:
        method_id = "google_auth"
    code = str((payload or {}).get("code") or "").strip()

    st = _get_user_2fa_state(u)
    secrets_map = st["secrets_map"]

    if method_id == "email":
        if not verify_master_email_otp(f"setup:{u.id}", code, consume=True):
            raise HTTPException(status_code=400, detail="Girilen 6 haneli e-posta doğrulama kodu hatalı veya süresi dolmuş.")
        secrets_map["email"] = {"enrolled": True}
    else:
        pending_key = f"{u.id}:{method_id}"
        candidate_secret = _PENDING_TOTP_SECRETS.get(pending_key) or (secrets_map.get(method_id) or {}).get("secret") or u.totp_secret
        if not candidate_secret:
            raise HTTPException(status_code=400, detail="Önce 2FA QR kurulumu başlatılmalıdır.")
        if not verify_totp_code(candidate_secret, code):
            raise HTTPException(status_code=400, detail=f"Girilen 6 haneli {_method_display_label(method_id)} kodu hatalı. Lütfen uygulamanızdaki güncel kodu giriniz.")
        secrets_map[method_id] = {"secret": candidate_secret, "enrolled": True}
        _PENDING_TOTP_SECRETS.pop(pending_key, None)

    req_active = payload.get("active_methods")
    if isinstance(req_active, list) and req_active:
        next_methods = [str(m).strip().lower() for m in req_active if str(m).strip().lower() in VALID_2FA_METHODS]
    else:
        next_methods = list(st["active_methods"])
    if method_id not in next_methods:
        next_methods.append(method_id)

    req_mode = str(payload.get("mode") or st["mode"] or "single").strip().lower()
    if req_mode not in ("single", "all", "any"):
        req_mode = "single"
    if req_mode == "single":
        next_methods = [method_id]

    _sync_legacy_2fa_columns(u, next_methods, req_mode, secrets_map)
    await db.commit()
    await db.refresh(u)

    performed_by = request.headers.get("X-User-Name", u.username)
    await log_master_action(db, performed_by, "USER_2FA_ENABLED", f"2FA ({_method_display_label(method_id)}) Doğrulandı & Eşleştirildi: {u.full_name} (@{u.username})", extract_client_ip(request), u.id)
    return {
        "success": True,
        "method": method_id,
        "user": _serialize_master_user(u),
        "message": f"{_method_display_label(method_id)} başarıyla doğrulandı ve eşleştirildi!",
    }


@app.post("/api/v1/users/{user_id}/2fa/disable")
async def disable_master_user_2fa(user_id: int, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Disables all 2FA for a master user."""
    res = await db.execute(select(MasterUser).where(MasterUser.id == user_id))
    u = res.scalars().first()
    if not u:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    st = _get_user_2fa_state(u)
    _sync_legacy_2fa_columns(u, [], "single", st["secrets_map"])
    u.totp_enabled = False
    u.email_2fa_enabled = False
    for m in ("google_auth", "microsoft_auth"):
        _PENDING_TOTP_SECRETS.pop(f"{u.id}:{m}", None)
    await db.commit()
    await db.refresh(u)
    performed_by = request.headers.get("X-User-Name", u.username)
    await log_master_action(db, performed_by, "USER_2FA_DISABLED", f"2FA Devre Dışı Bırakıldı: {u.full_name} (@{u.username})", extract_client_ip(request), u.id)
    return {"success": True, "user": _serialize_master_user(u), "message": "2 Aşamalı Doğrulama devre dışı bırakıldı."}


@app.post("/api/v1/users/{user_id}/2fa/email/send-test")
async def send_master_user_email_2fa_setup_code(user_id: int, request: Request, payload: Dict[str, Any] = Body(default={}), db: AsyncSession = Depends(get_central_db)):
    """Sends a 6-digit verification code to the user's e-mail address to verify & enable E-Mail 2FA."""
    res = await db.execute(select(MasterUser).where(MasterUser.id == user_id))
    u = res.scalars().first()
    if not u:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    target_email = str((payload or {}).get("email") or u.email or "").strip().lower()
    if not target_email or "@" not in target_email:
        raise HTTPException(status_code=400, detail="Bu kullanıcı için geçerli bir e-posta adresi tanımlı değil.")

    pol = await get_or_create_security_policy(db)
    otp_info = generate_master_email_otp(f"setup:{u.id}", target_email, ttl_seconds=300)
    send_res = await send_master_2fa_email_otp(pol, target_email, u.full_name, otp_info["code"], ttl_seconds=300)
    if not send_res.get("ok"):
        raise HTTPException(status_code=400, detail=send_res.get("error") or "Doğrulama e-postası gönderilemedi.")

    return {
        "success": True,
        "masked_email": otp_info["masked_email"],
        "email": target_email,
        "expires_in": otp_info["expires_in"],
        "message": f"6 haneli doğrulama kodu {target_email} adresine gönderildi.",
    }


@app.post("/api/v1/users/{user_id}/2fa/email/enable")
async def enable_master_user_email_2fa(user_id: int, request: Request, payload: Dict[str, Any] = Body(...), db: AsyncSession = Depends(get_central_db)):
    """Backwards-compatible endpoint to verify & activate E-Mail 2FA."""
    merged = dict(payload or {})
    merged["method"] = "email"
    return await enable_master_user_2fa(user_id, request, merged, db)


@app.post("/api/v1/users/{user_id}/2fa/email/disable")
async def disable_master_user_email_2fa(user_id: int, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Removes E-Mail 2FA from active methods for a master user."""
    res = await db.execute(select(MasterUser).where(MasterUser.id == user_id))
    u = res.scalars().first()
    if not u:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    st = _get_user_2fa_state(u)
    next_methods = [m for m in st["active_methods"] if m != "email"]
    _sync_legacy_2fa_columns(u, next_methods, st["mode"], st["secrets_map"])
    _MASTER_EMAIL_OTP_STORE.pop(f"setup:{u.id}", None)
    _MASTER_EMAIL_OTP_STORE.pop(f"login:{u.id}", None)
    await db.commit()
    await db.refresh(u)
    performed_by = request.headers.get("X-User-Name", u.username)
    await log_master_action(db, performed_by, "USER_2FA_EMAIL_DISABLED", f"2FA (E-Posta OTP) Devre Dışı Bırakıldı: {u.full_name} (@{u.username})", extract_client_ip(request), u.id)
    return {"success": True, "user": _serialize_master_user(u), "message": "E-Posta 2FA devre dışı bırakıldı."}


# --------------------------------------------------------------------------
# Central Security Shield Endpoints (Brute-Force Policy, Blocked IPs, Auto-Logout, SMTP)
# --------------------------------------------------------------------------
def _serialize_security_policy(pol: MasterSecurityPolicy) -> Dict[str, Any]:
    smtp_cfg = resolve_master_smtp_config(pol)
    return {
        "max_failed_attempts": pol.max_failed_attempts,
        "block_duration_minutes": pol.block_duration_minutes,
        "auto_logout_minutes": pol.auto_logout_minutes,
        "whitelisted_ips": parse_whitelisted_ips(pol),
        "smtp_host": pol.smtp_host or "",
        "smtp_port": pol.smtp_port or 587,
        "smtp_user": pol.smtp_user or "",
        "smtp_from_email": pol.smtp_from_email or "",
        "smtp_use_tls": bool(pol.smtp_use_tls) if pol.smtp_use_tls is not None else True,
        "has_smtp_password": bool(pol.smtp_password),
        "smtp_configured": smtp_cfg["configured"],
    }


@app.get("/api/v1/security/settings")
async def get_central_security_settings(request: Request, db: AsyncSession = Depends(get_central_db)):
    pol = await get_or_create_security_policy(db)
    now = datetime.datetime.utcnow()

    # Clean up expired temporary IP blocks
    res_blk = await db.execute(select(MasterBlockedIP).order_by(MasterBlockedIP.created_at.desc()))
    all_blks = res_blk.scalars().all()
    active_blks = []
    dirty = False
    for b in all_blks:
        if not b.is_permanent and b.blocked_until and b.blocked_until <= now:
            await db.delete(b)
            dirty = True
        else:
            mins_rem = None
            if not b.is_permanent and b.blocked_until:
                mins_rem = max(1, int(((b.blocked_until - now).total_seconds() + 59) // 60))
            active_blks.append({
                "id": b.id,
                "ip_address": b.ip_address,
                "reason": b.reason,
                "failed_attempts": b.failed_attempts,
                "is_permanent": bool(b.is_permanent),
                "minutes_remaining": mins_rem,
                "blocked_until": b.blocked_until.isoformat() if b.blocked_until else None,
                "created_at": b.created_at.isoformat() if b.created_at else None,
            })
    if dirty:
        await db.commit()

    # 2FA summary across all master users
    res_users = await db.execute(select(MasterUser).order_by(MasterUser.id.asc()))
    all_users = res_users.scalars().all()
    totp_users = []
    for u in all_users:
        st_u = _get_user_2fa_state(u)
        totp_users.append({
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "totp_enabled": ("google_auth" in st_u["active_methods"]) or ("microsoft_auth" in st_u["active_methods"]),
            "email_2fa_enabled": "email" in st_u["active_methods"],
            "two_factor_enabled": st_u["enabled"],
            "two_factor_mode": st_u["mode"],
            "two_factor_methods": st_u["active_methods"],
        })

    return {
        "client_ip": extract_client_ip(request),
        "policy": _serialize_security_policy(pol),
        "blocked_ips": active_blks,
        "totp_summary": {
            "total_users": len(totp_users),
            "enabled_users": sum(1 for x in totp_users if x["totp_enabled"] or x["email_2fa_enabled"]),
            "users": totp_users,
        },
    }


@app.post("/api/v1/security/policy")
async def update_central_security_policy(request: Request, payload: Dict[str, Any] = Body(...), db: AsyncSession = Depends(get_central_db)):
    pol = await get_or_create_security_policy(db)
    if "max_failed_attempts" in payload:
        pol.max_failed_attempts = max(2, min(50, int(payload["max_failed_attempts"] or 5)))
    if "block_duration_minutes" in payload:
        pol.block_duration_minutes = max(1, min(43200, int(payload["block_duration_minutes"] or 60)))
    if "auto_logout_minutes" in payload:
        pol.auto_logout_minutes = max(0, min(1440, int(payload["auto_logout_minutes"] or 0)))
    if "whitelisted_ips" in payload and isinstance(payload["whitelisted_ips"], list):
        clean_wl = [str(ip).strip() for ip in payload["whitelisted_ips"] if str(ip).strip()]
        pol.whitelisted_ips_json = json.dumps(list(dict.fromkeys(clean_wl)))

    # SMTP Settings for Central E-Mail 2FA
    if "smtp_host" in payload:
        pol.smtp_host = str(payload.get("smtp_host") or "").strip()
    if "smtp_port" in payload:
        try:
            pol.smtp_port = max(1, min(65535, int(payload.get("smtp_port") or 587)))
        except Exception:
            pol.smtp_port = 587
    if "smtp_user" in payload:
        pol.smtp_user = str(payload.get("smtp_user") or "").strip()
    if "smtp_password" in payload and str(payload.get("smtp_password") or "").strip():
        pol.smtp_password = str(payload.get("smtp_password")).strip()
    if "smtp_from_email" in payload:
        pol.smtp_from_email = str(payload.get("smtp_from_email") or "").strip()
    if "smtp_use_tls" in payload:
        pol.smtp_use_tls = bool(payload.get("smtp_use_tls"))

    await db.commit()
    performed_by = request.headers.get("X-User-Name", "admin")
    await log_master_action(
        db,
        performed_by,
        "SECURITY_POLICY_UPDATE",
        f"Merkez Güvenlik Politikası Güncellendi: MaxHata={pol.max_failed_attempts}, BlokSüresi={pol.block_duration_minutes}dk, AutoLogout={pol.auto_logout_minutes}dk, SMTP={pol.smtp_host or 'Yok'}",
        extract_client_ip(request),
    )
    return {
        "success": True,
        "policy": _serialize_security_policy(pol),
    }


@app.post("/api/v1/security/smtp-test")
async def test_central_smtp_settings(request: Request, payload: Dict[str, Any] = Body(...), db: AsyncSession = Depends(get_central_db)):
    """Sends a test 2FA e-mail using saved or provided SMTP settings."""
    pol = await get_or_create_security_policy(db)
    to_email = str((payload or {}).get("to_email") or "").strip()
    if not to_email or "@" not in to_email:
        raise HTTPException(status_code=400, detail="Test e-postası için geçerli bir alıcı adresi giriniz.")

    # Allow testing unsaved form inputs seamlessly
    temp_pol = MasterSecurityPolicy(
        smtp_host=str(payload.get("smtp_host") if payload.get("smtp_host") is not None else (pol.smtp_host or "")).strip(),
        smtp_port=int(payload.get("smtp_port") or pol.smtp_port or 587),
        smtp_user=str(payload.get("smtp_user") if payload.get("smtp_user") is not None else (pol.smtp_user or "")).strip(),
        smtp_password=str(payload.get("smtp_password") or "").strip() or (pol.smtp_password or ""),
        smtp_from_email=str(payload.get("smtp_from_email") if payload.get("smtp_from_email") is not None else (pol.smtp_from_email or "")).strip(),
        smtp_use_tls=bool(payload["smtp_use_tls"]) if "smtp_use_tls" in payload else (bool(pol.smtp_use_tls) if pol.smtp_use_tls is not None else True),
    )

    test_code = str(secrets.randbelow(900000) + 100000)
    send_res = await send_master_2fa_email_otp(temp_pol, to_email, "Yönetici (SMTP Testi)", test_code, ttl_seconds=300)
    if not send_res.get("ok"):
        raise HTTPException(status_code=400, detail=send_res.get("error") or "Test e-postası gönderilemedi.")

    return {"success": True, "message": f"Test 2FA e-postası {to_email} adresine başarıyla gönderildi."}


@app.post("/api/v1/security/blocked-ips")
async def add_manual_blocked_ip(request: Request, payload: Dict[str, Any] = Body(...), db: AsyncSession = Depends(get_central_db)):
    ip_addr = str(payload.get("ip_address") or "").strip()
    if not ip_addr:
        raise HTTPException(status_code=400, detail="Engellenecek IP adresi boş olamaz.")
    reason = str(payload.get("reason") or "Manuel Yönetici Engeli").strip()
    is_perm = bool(payload.get("is_permanent", True))
    pol = await get_or_create_security_policy(db)
    until_dt = None if is_perm else (datetime.datetime.utcnow() + datetime.timedelta(minutes=pol.block_duration_minutes))

    res = await db.execute(select(MasterBlockedIP).where(MasterBlockedIP.ip_address == ip_addr))
    blk = res.scalars().first()
    if not blk:
        blk = MasterBlockedIP(
            ip_address=ip_addr,
            reason=reason,
            failed_attempts=0,
            blocked_until=until_dt,
            is_permanent=is_perm,
        )
        db.add(blk)
    else:
        blk.reason = reason
        blk.is_permanent = is_perm
        blk.blocked_until = until_dt

    await db.commit()
    performed_by = request.headers.get("X-User-Name", "admin")
    await log_master_action(db, performed_by, "IP_MANUAL_BAN", f"IP Manuel Engellendi: {ip_addr} ({reason})", extract_client_ip(request))
    return {"success": True, "ip_address": ip_addr}


@app.delete("/api/v1/security/blocked-ips/{block_id}")
async def unblock_master_ip(block_id: int, request: Request, db: AsyncSession = Depends(get_central_db)):
    res = await db.execute(select(MasterBlockedIP).where(MasterBlockedIP.id == block_id))
    blk = res.scalars().first()
    if not blk:
        raise HTTPException(status_code=404, detail="Engelli IP kaydı bulunamadı.")

    ip_str = blk.ip_address
    _FAILED_LOGIN_TRACKER.pop(ip_str, None)
    await db.delete(blk)
    await db.commit()

    performed_by = request.headers.get("X-User-Name", "admin")
    await log_master_action(db, performed_by, "IP_UNBAN", f"IP Engeli Kaldırıldı: {ip_str}", extract_client_ip(request))
    return {"success": True, "unblocked_ip": ip_str}

@app.post("/api/v1/users")
async def create_master_user(payload: MasterUserCreateSchema, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Creates a new central master portal user."""
    uname = payload.username.strip().lower()
    existing = await db.execute(select(MasterUser).where((MasterUser.username == uname) | (MasterUser.email == payload.email.strip().lower())))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Bu kullanıcı adı veya e-posta adresi zaten kullanımda.")

    new_u = MasterUser(
        username=uname,
        full_name=payload.full_name.strip(),
        email=payload.email.strip().lower(),
        password_hash=hash_password(payload.password),
        role=payload.role or "admin",
        is_active=payload.is_active if payload.is_active is not None else True
    )
    db.add(new_u)
    await db.commit()
    await db.refresh(new_u)

    await log_master_action(db, payload.performed_by or "admin", "USER_CREATE", f"Yeni Kullanıcı Oluşturuldu: {new_u.full_name} ({new_u.username}) [Rol: {new_u.role}]", extract_client_ip(request))
    return _serialize_master_user(new_u)

@app.put("/api/v1/users/{user_id}")
async def update_master_user(user_id: int, payload: MasterUserCreateSchema, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Updates master user metadata, password, or active state."""
    res = await db.execute(select(MasterUser).where(MasterUser.id == user_id))
    u = res.scalars().first()
    if not u:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    u.full_name = payload.full_name.strip()
    u.email = payload.email.strip().lower()
    u.role = payload.role or u.role
    if payload.is_active is not None:
        u.is_active = payload.is_active
    if payload.password and payload.password.strip():
        u.password_hash = hash_password(payload.password)

    await db.commit()
    await db.refresh(u)
    await log_master_action(db, payload.performed_by or "admin", "USER_UPDATE", f"Kullanıcı Bilgileri Güncellendi: {u.full_name} ({u.username})", extract_client_ip(request))
    return _serialize_master_user(u)

@app.delete("/api/v1/users/{user_id}")
async def delete_master_user(user_id: int, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Deletes a master user."""
    res = await db.execute(select(MasterUser).where(MasterUser.id == user_id))
    u = res.scalars().first()
    if not u:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
        
    if u.username == "admin":
        raise HTTPException(status_code=400, detail="Varsayılan süper yönetici (admin) hesabı silinemez.")

    performed_by = request.headers.get("X-User-Name", "admin")
    await db.delete(u)
    await db.commit()
    await log_master_action(db, performed_by, "USER_DELETE", f"Kullanıcı Silindi: {u.full_name} ({u.username})", extract_client_ip(request))
    return {"success": True, "message": f"Kullanıcı #{user_id} silindi."}

# --------------------------------------------------------------------------
# Audit Logs Endpoint
# --------------------------------------------------------------------------
@app.get("/api/v1/audit-logs")
async def get_master_audit_logs(db: AsyncSession = Depends(get_central_db)):
    """Returns chronological user action audit logs."""
    res = await db.execute(select(MasterAuditLog).order_by(MasterAuditLog.id.desc()).limit(200))
    logs = res.scalars().all()
    return [{
        "id": l.id,
        "username": l.username,
        "action": l.action,
        "details": l.details,
        "ip_address": l.ip_address,
        "created_at": l.created_at.isoformat() if l.created_at else None
    } for l in logs]

# --------------------------------------------------------------------------
# Fleet Dashboard & Stats
# --------------------------------------------------------------------------
def _extract_expiry_from_license_key(license_key: Optional[str]) -> Optional[str]:
    """Extracts YYYY-MM-DD or 'unlimited' from an AIDA-{TENANT}-{YYYYMMDD|UNLIMITED}-{HW8}-{SIG8}[.B64] key."""
    if not license_key or not isinstance(license_key, str):
        return None
    base_part = license_key.strip().split(".", 1)[0]
    parts = base_part.split("-")
    if len(parts) < 5:
        return None
    exp_seg = parts[-3].strip().upper()
    if exp_seg == "UNLIMITED":
        return "unlimited"
    if len(exp_seg) == 8 and exp_seg.isdigit():
        try:
            dt = datetime.datetime.strptime(exp_seg, "%Y%m%d")
            return dt.strftime("%Y-%m-%d")
        except Exception:
            return None
    return None


@app.get("/api/v1/dashboard/stats")
@app.get("/api/v1/stats")
async def get_dashboard_stats(expiring_days: int = 15, db: AsyncSession = Depends(get_central_db)):
    """Returns real-time fleet overview metrics."""
    threshold_days = expiring_days if expiring_days in (7, 15, 30, 60, 90, 120) else 15
    res_clients = await db.execute(select(ClientServer))
    clients = res_clients.scalars().all()
    
    total_clients = len(clients)
    now = datetime.datetime.utcnow()
    fifteen_mins_ago = now - datetime.timedelta(minutes=15)
    
    online_count = sum(1 for c in clients if c.last_heartbeat_at and c.last_heartbeat_at >= fifteen_mins_ago)
    expired_count = sum(1 for c in clients if c.status in ["expired", "suspended"])
    expiring_soon_count = 0
    total_active_calls = sum(c.active_calls_count or 0 for c in clients)
    total_licensed_subscribers = 0
    
    for c in clients:
        # Sum licensed user quota (max_users) per server (default 50 if unset)
        user_quota = 50
        if c.custom_quotas:
            try:
                parsed_q = json.loads(c.custom_quotas)
                if isinstance(parsed_q, dict) and parsed_q.get("max_users") is not None:
                    user_quota = int(parsed_q.get("max_users"))
            except Exception:
                pass
        total_licensed_subscribers += max(0, user_quota)

        exp_str = c.license_expires_at or _extract_expiry_from_license_key(c.current_license_key)
        if exp_str and exp_str != "unlimited":
            try:
                exp_d = datetime.datetime.strptime(exp_str, "%Y-%m-%d")
                days_left = (exp_d - now).days
                if 0 <= days_left <= threshold_days and c.status == "active":
                    expiring_soon_count += 1
            except Exception:
                pass
                
    return {
        "total_clients": total_clients,
        "online_count": online_count,
        "offline_count": total_clients - online_count,
        "expiring_soon_count": expiring_soon_count,
        "expired_count": expired_count,
        "total_active_calls": total_active_calls,
        "total_licensed_subscribers": total_licensed_subscribers,
    }

# --------------------------------------------------------------------------
# Client Server CRUD
# --------------------------------------------------------------------------
@app.get("/api/v1/clients")
async def get_clients(db: AsyncSession = Depends(get_central_db)):
    """Returns list of registered client servers with telemetry and license info."""
    res = await db.execute(select(ClientServer).order_by(ClientServer.id.desc()))
    clients = res.scalars().all()
    
    output = []
    now = datetime.datetime.utcnow()
    fifteen_mins_ago = now - datetime.timedelta(minutes=15)
    db_modified = False

    wg_peers_live = {}
    try:
        from license_center.backend.sip_edge_manager import _read_live_wg_peers_sync
        wg_peers_live = await asyncio.to_thread(_read_live_wg_peers_sync)
    except Exception:
        wg_peers_live = {}
    
    for c in clients:
        if not c.tenant_serial_number:
            c.tenant_serial_number = generate_tenant_serial_number(c.tenant_code, 99 + (c.id or 1))
            db_modified = True
        if not c.system_serial_number and c.hardware_id and c.hardware_id not in ("UNBOUND", "Bilinmiyor", "HW-UNKNOWN"):
            c.system_serial_number = compute_system_serial_number(c.hardware_id)
            db_modified = True
        if not c.license_expires_at and c.current_license_key:
            extracted_exp = _extract_expiry_from_license_key(c.current_license_key)
            if extracted_exp:
                c.license_expires_at = extracted_exp
                db_modified = True

        from license_center.backend.connect_hub import ACTIVE_TUNNELS_BY_HWID, ACTIVE_TUNNELS_BY_SUBDOMAIN
        c_sub = (c.connect_subdomain or "").strip().lower()
        c_hw = (c.hardware_id or "").strip().upper()
        tunnel_sess = (
            (ACTIVE_TUNNELS_BY_SUBDOMAIN.get(c_sub) if c_sub else None)
            or (ACTIVE_TUNNELS_BY_HWID.get(c_hw) if c_hw else None)
        )
        is_online = bool(tunnel_sess) or bool(c.last_heartbeat_at and c.last_heartbeat_at >= fifteen_mins_ago)
        days_left = None
        if c.license_expires_at and c.license_expires_at != "unlimited":
            try:
                exp_d = datetime.datetime.strptime(c.license_expires_at, "%Y-%m-%d")
                days_left = max(0, (exp_d - now).days + 1)
            except Exception:
                pass

        parsed_quotas = None
        if c.custom_quotas:
            try:
                parsed_quotas = json.loads(c.custom_quotas)
            except Exception:
                pass

        grace_until_str = str((parsed_quotas or {}).get("license_grace_until") or "").strip()[:10]
        in_grace_period = False
        grace_days_left = None
        if len(grace_until_str) == 10:
            try:
                now_tr_d = (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).date()
                g_d = datetime.datetime.strptime(grace_until_str, "%Y-%m-%d").date()
                if g_d >= now_tr_d:
                    grace_days_left = max(0, (g_d - now_tr_d).days)
                    if days_left is not None and days_left <= 0:
                        in_grace_period = True
            except Exception:
                grace_until_str = ""
                
        parsed_failed_services = []
        raw_fs = getattr(c, "failed_services_json", None)
        if raw_fs:
            try:
                arr_fs = json.loads(raw_fs)
                if isinstance(arr_fs, list):
                    parsed_failed_services = [str(x) for x in arr_fs if x]
            except Exception:
                pass

        alert_reasons = []
        cpu_v = round(float(c.cpu_usage_percent or 0.0), 1)
        ram_v = round(float(c.ram_usage_percent or 0.0), 1)
        disk_v = round(float(getattr(c, "disk_usage_percent", 0.0) or 0.0), 1)
        if not is_online:
            alert_reasons.append("Sunucu Çevrimdışı")
        if (c.connect_subdomain or (tunnel_sess.subdomain if tunnel_sess else None)) and not bool(tunnel_sess):
            alert_reasons.append("Tünel Kopuk")
        if cpu_v >= 85:
            alert_reasons.append(f"Kritik CPU (%{cpu_v})")
        if ram_v >= 85:
            alert_reasons.append(f"Kritik RAM (%{ram_v})")
        if disk_v >= 85:
            alert_reasons.append(f"Kritik Disk (%{disk_v})")
        for fs_name in parsed_failed_services:
            alert_reasons.append(f"Servis Kapalı: {fs_name}")

        wg_peer_info = wg_peers_live.get((c.wg_public_key or "").strip(), {}) if c.wg_public_key else {}
        output.append({
            "id": c.id,
            "company_name": c.company_name,
            "tenant_code": c.tenant_code,
            "connect_subdomain": c.connect_subdomain or (tunnel_sess.subdomain if tunnel_sess else None),
            "tunnel_connected": bool(tunnel_sess),
            "wg_tunnel_ip": c.wg_tunnel_ip,
            "wg_connected": bool(wg_peer_info.get("connected")),
            "wg_last_handshake_sec": wg_peer_info.get("last_handshake_sec"),
            "sip_edge_enabled": bool(c.sip_edge_enabled if c.sip_edge_enabled is not None else True),
            "remote_ssh_enabled": bool(c.remote_ssh_enabled if c.remote_ssh_enabled is not None else True),
            "tenant_serial_number": c.tenant_serial_number,
            "system_serial_number": c.system_serial_number or (compute_system_serial_number(c.hardware_id) if c.hardware_id and c.hardware_id not in ("UNBOUND", "Bilinmiyor") else "Henüz Bağlanmadı"),
            "hardware_id": c.hardware_id or "Bilinmiyor",
            "ip_address": c.ip_address or (tunnel_sess.client_ip if tunnel_sess else None),
            "domain_name": c.domain_name or (f"{c.connect_subdomain}.nornia.com.tr" if c.connect_subdomain else None),
            "contact_email": c.contact_email,
            "contact_phone": c.contact_phone,
            "plan_tier": c.plan_tier,
            "status": c.status,
            "current_license_key": c.current_license_key,
            "license_expires_at": c.license_expires_at,
            "license_grace_until": grace_until_str,
            "in_grace_period": in_grace_period,
            "grace_days_left": grace_days_left,
            "custom_quotas": parsed_quotas,
            "is_online": is_online,
            "last_heartbeat_at": c.last_heartbeat_at.isoformat() if c.last_heartbeat_at else None,
            "software_version": c.software_version,
            "cpu_usage_percent": cpu_v,
            "ram_usage_percent": ram_v,
            "disk_usage_percent": disk_v,
            "failed_services": parsed_failed_services,
            "has_alert": len(alert_reasons) > 0,
            "alert_reasons": alert_reasons,
            "active_calls_count": c.active_calls_count,
            "total_users_count": c.total_users_count,
            "whatsapp_status": c.whatsapp_status,
            "days_left": days_left,
            "created_at": c.created_at.isoformat() if c.created_at else None
        })
    if db_modified:
        await db.commit()
    return output

@app.post("/api/v1/clients")
async def create_client(payload: ClientCreateSchema, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Registers a new Client Server and generates their cryptographic license key."""
    t_code = payload.tenant_code.strip().lower().replace(" ", "-")
    existing = await db.execute(select(ClientServer).where(ClientServer.tenant_code == t_code))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail=f"'{t_code}' kodlu müşteri zaten veritabanında kayıtlı.")

    hw_id = payload.hardware_id.strip().upper() if payload.hardware_id else "UNBOUND"
    exp_date = payload.license_expires_at or "2026-12-31"
    cnt_res = await db.execute(select(func.count(ClientServer.id)))
    next_idx = 100 + (cnt_res.scalar() or 0)
    t_sn = (payload.tenant_serial_number or "").strip() or generate_tenant_serial_number(t_code, next_idx)
    sys_sn = (payload.system_serial_number or "").strip() or (compute_system_serial_number(hw_id) if hw_id != "UNBOUND" else None)

    quotas_with_sn = dict(payload.custom_quotas or {})
    quotas_with_sn["tenant_serial_number"] = t_sn
    cq_json = json.dumps(quotas_with_sn)
    gen_key = generate_signed_license_key(t_code, exp_date, hw_id, custom_quotas=quotas_with_sn)

    new_client = ClientServer(
        company_name=payload.company_name.strip(),
        tenant_code=t_code,
        tenant_serial_number=t_sn,
        system_serial_number=sys_sn,
        hardware_id=hw_id,
        ip_address=payload.ip_address,
        domain_name=payload.domain_name,
        contact_email=payload.contact_email,
        contact_phone=payload.contact_phone,
        plan_tier=payload.plan_tier or "professional",
        status=payload.status or "active",
        current_license_key=gen_key,
        license_expires_at=exp_date,
        custom_quotas=cq_json,
        notes=payload.notes
    )
    db.add(new_client)
    await db.commit()
    await db.refresh(new_client)

    # Save to License History Log
    lic_log = LicenseRecord(
        client_id=new_client.id,
        tenant_code=t_code,
        hardware_id=hw_id,
        license_key=gen_key,
        expires_at=exp_date,
        plan_tier=payload.plan_tier or "professional",
        created_by=payload.performed_by or "admin"
    )
    db.add(lic_log)
    await db.commit()

    await log_master_action(db, payload.performed_by or "admin", "CLIENT_CREATE", f"Yeni Müşteri & Sunucu Eklendi: {new_client.company_name} ({t_code}) [Donanım: {hw_id}]", extract_client_ip(request))

    return new_client

@app.put("/api/v1/clients/{client_id}")
async def update_client(client_id: int, payload: ClientCreateSchema, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Updates client status, package tier, expiration date, or regenerates license key."""
    res = await db.execute(select(ClientServer).where(ClientServer.id == client_id))
    client = res.scalars().first()
    if not client:
        raise HTTPException(status_code=404, detail="Müşteri kaydı bulunamadı.")

    old_status = client.status
    client.company_name = payload.company_name.strip()
    client.status = payload.status or client.status
    client.plan_tier = payload.plan_tier or client.plan_tier
    client.license_expires_at = payload.license_expires_at or client.license_expires_at
    if payload.hardware_id:
        client.hardware_id = payload.hardware_id.strip().upper()

    if payload.custom_quotas is not None:
        client.custom_quotas = json.dumps(payload.custom_quotas) if payload.custom_quotas else None

    parsed_quotas = None
    if client.custom_quotas:
        try:
            parsed_quotas = json.loads(client.custom_quotas)
        except Exception:
            pass

    hw_id = client.hardware_id or "UNBOUND"
    gen_key = generate_signed_license_key(client.tenant_code, client.license_expires_at, hw_id, custom_quotas=parsed_quotas)
    client.current_license_key = gen_key

    await db.commit()
    await db.refresh(client)

    try:
        from license_center.backend.connect_hub import trigger_pbx_license_sync
        asyncio.create_task(trigger_pbx_license_sync(hardware_id=client.hardware_id, subdomain=client.connect_subdomain))
    except Exception:
        pass

    try:
        from license_center.backend.sip_edge_manager import revoke_pbx_sip_edge, sync_all_sip_edge_peers_from_db
        if client.status == "suspended" or client.sip_edge_enabled is False:
            await revoke_pbx_sip_edge(db, client.wg_public_key)
        else:
            await sync_all_sip_edge_peers_from_db(db)
    except Exception as ex_edge_upd:
        print(f"[SIP Edge Update Sync Warning]: {ex_edge_upd}")

    action_name = "CLIENT_SUSPEND" if client.status == "suspended" else "CLIENT_UPDATE"
    await log_master_action(db, payload.performed_by or "admin", action_name, f"Müşteri Bilgileri Güncellendi ({client.company_name}): Durum={client.status}, Bitiş={client.license_expires_at}", extract_client_ip(request))

    return client

@app.delete("/api/v1/clients/{client_id}")
async def delete_client(client_id: int, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Deletes client record from central database and unlocks its Nornia Connect subdomain on the PBX."""
    from license_center.backend.connect_hub import notify_and_unbind_pbx_tunnel
    res = await db.execute(select(ClientServer).where(ClientServer.id == client_id))
    client = res.scalars().first()
    if not client:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı.")
        
    performed_by = request.headers.get("X-User-Name", "admin")
    company = client.company_name
    hw_to_unbind = client.hardware_id
    sub_to_unbind = client.connect_subdomain or client.tenant_code
    wg_pk_to_revoke = client.wg_public_key

    await db.delete(client)
    await db.commit()

    await notify_and_unbind_pbx_tunnel(hardware_id=hw_to_unbind, subdomain=sub_to_unbind)
    try:
        from license_center.backend.sip_edge_manager import revoke_pbx_sip_edge
        await revoke_pbx_sip_edge(db, wg_pk_to_revoke)
    except Exception:
        pass

    await log_master_action(db, performed_by, "CLIENT_DELETE", f"Müşteri Kaydı ve Nornia Connect Alt Alan Adı Kilidi Silindi: {company} (#{client_id}, Subdomain: {sub_to_unbind})", extract_client_ip(request))
    return {"success": True, "message": f"Müşteri #{client_id} silindi ve santraldeki Nornia Connect isim kilidi kaldırıldı."}


@app.post("/api/v1/clients/{client_id}/unlock-subdomain")
async def unlock_client_subdomain(client_id: int, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Unlocks the Nornia Connect subdomain across all tenant records sharing this server's hardware_id."""
    from license_center.backend.connect_hub import notify_and_unbind_pbx_tunnel
    res = await db.execute(select(ClientServer).where(ClientServer.id == client_id))
    client = res.scalars().first()
    if not client:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı.")

    performed_by = request.headers.get("X-User-Name", "admin")
    old_sub = client.connect_subdomain
    hw_id = client.hardware_id

    if hw_id and hw_id not in ("UNBOUND", "Bilinmiyor", "HW-UNKNOWN"):
        res_all = await db.execute(select(ClientServer).where(func.upper(ClientServer.hardware_id) == hw_id.upper()))
        for sibling in res_all.scalars().all():
            sibling.connect_subdomain = None
            sibling.domain_name = None
    else:
        client.connect_subdomain = None
        client.domain_name = None

    await db.commit()

    await notify_and_unbind_pbx_tunnel(hardware_id=hw_id, subdomain=old_sub)
    await log_master_action(db, performed_by, "SUBDOMAIN_UNLOCK", f"Nornia Connect Alt Alan Adı Kilidi Açıldı: {client.company_name} (Donanım: {hw_id}, Eski Subdomain: {old_sub})", extract_client_ip(request))
    return {"success": True, "message": f"'{old_sub}.nornia.com.tr' alt alan adı kilidi kaldırıldı ve serbest bırakıldı. Santral üzerinden yeni alt alan adı tanımlanabilir."}


@app.post("/api/v1/clients/{client_id}/toggle-ssh")
async def toggle_client_ssh_access(client_id: int, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Centrally enables or disables SSH & Web SSH access on the target PBX server."""
    from license_center.backend.connect_hub import push_ssh_control_to_pbx
    res = await db.execute(select(ClientServer).where(ClientServer.id == client_id))
    client = res.scalars().first()
    if not client:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı.")

    performed_by = request.headers.get("X-User-Name", "admin")
    current_val = bool(client.remote_ssh_enabled if client.remote_ssh_enabled is not None else True)
    new_val = not current_val
    hw_id = client.hardware_id
    sub = client.connect_subdomain

    if hw_id and hw_id not in ("UNBOUND", "Bilinmiyor", "HW-UNKNOWN"):
        res_all = await db.execute(select(ClientServer).where(func.upper(ClientServer.hardware_id) == hw_id.upper()))
        for sibling in res_all.scalars().all():
            sibling.remote_ssh_enabled = new_val
    else:
        client.remote_ssh_enabled = new_val

    await db.commit()

    await push_ssh_control_to_pbx(hardware_id=hw_id, subdomain=sub, enabled=new_val)
    state_label = "AKTİF (AÇIK)" if new_val else "PASİF (KAPALI)"
    await log_master_action(
        db,
        performed_by,
        "SSH_CONTROL",
        f"Santral SSH Erişimi Merkezden Değiştirildi: {client.company_name} (Donanım: {hw_id}) -> {state_label}",
        extract_client_ip(request),
    )
    return {
        "success": True,
        "remote_ssh_enabled": new_val,
        "message": f"Santral SSH erişimi merkezden {state_label} durumuna getirildi.",
    }


@app.post("/api/v1/clients/{client_id}/sso-token")
async def create_client_root_sso_token(client_id: int, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Generates a short-lived HMAC-signed Root SSO token for passwordless Service Provider login into a client PBX."""
    res = await db.execute(select(ClientServer).where(ClientServer.id == client_id))
    client = res.scalars().first()
    if not client:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı.")

    performed_by = request.headers.get("X-User-Name", "admin")
    hw_id = (client.hardware_id or "UNBOUND").strip().upper()
    t_code = (client.tenant_code or "default").strip().lower()
    token = generate_nornia_root_sso_token(tenant_code=t_code, hw_id=hw_id, master_username=performed_by)

    if client.connect_subdomain:
        target_base = f"https://{client.connect_subdomain}.nornia.com.tr"
    elif client.domain_name:
        target_base = f"https://{client.domain_name}"
    else:
        target_base = f"http://{client.ip_address or '127.0.0.1'}:3000"

    sso_url = f"{target_base}/?nornia_sso={token}&tenant={t_code}"

    await log_master_action(
        db,
        performed_by,
        "ROOT_SSO_LOGIN",
        f"Santrale Merkezden Root SSO Girişi Başlatıldı: {client.company_name} ({t_code} | {hw_id})",
        extract_client_ip(request),
    )
    return {
        "success": True,
        "sso_token": token,
        "sso_url": sso_url,
        "tenant_code": t_code,
    }


@app.post("/api/v1/clients/{client_id}/ota-update")
async def trigger_client_remote_ota_update(client_id: int, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Sends a remote OTA Update command over the active Nornia Connect tunnel to pull latest code, build, and restart the PBX."""
    from license_center.backend.connect_hub import trigger_pbx_ota_update

    res = await db.execute(select(ClientServer).where(ClientServer.id == client_id))
    client = res.scalars().first()
    if not client:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı.")

    performed_by = request.headers.get("X-User-Name", "admin")
    hw_id = (client.hardware_id or "").strip().upper()
    sub = (client.connect_subdomain or "").strip().lower()

    sent = await trigger_pbx_ota_update(hardware_id=hw_id, subdomain=sub, triggered_by=performed_by)
    if not sent:
        raise HTTPException(
            status_code=400,
            detail="Santralin Nornia Connect tüneli şu anda aktif değil. OTA güncelleme için tünelin bağlı olması gerekmektedir.",
        )

    await log_master_action(
        db,
        performed_by,
        "OTA_UPDATE",
        f"Uzaktan OTA Güncelleme Başlatıldı: {client.company_name} (Donanım: {hw_id}, Tünel: {sub}.nornia.com.tr)",
        extract_client_ip(request),
    )
    return {
        "success": True,
        "message": f"{client.company_name} santraline Nornia Connect tüneli üzerinden OTA güncelleme emri iletildi. Santral arka planda güncellenip yeniden başlatılacak.",
    }


@app.post("/api/v1/clients/bulk-ota-update")
async def trigger_bulk_remote_ota_update(
    request: Request,
    payload: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_central_db),
):
    """Triggers remote OTA Update across multiple selected PBX servers that have active Nornia Connect tunnels."""
    from license_center.backend.connect_hub import trigger_pbx_ota_update

    raw_ids = payload.get("client_ids") or []
    client_ids = []
    for x in raw_ids:
        try:
            client_ids.append(int(x))
        except Exception:
            pass
    if not client_ids:
        raise HTTPException(status_code=400, detail="Toplu OTA güncelleme için en az bir santral seçiniz.")

    s_info = getattr(request.state, "master_user", None) or {}
    performed_by = s_info.get("u") or request.headers.get("X-User-Name", "admin")

    res = await db.execute(select(ClientServer).where(ClientServer.id.in_(client_ids)))
    clients = res.scalars().all()

    triggered: List[Dict[str, Any]] = []
    skipped: List[Dict[str, Any]] = []

    for c in clients:
        hw_id = (c.hardware_id or "").strip().upper()
        sub = (c.connect_subdomain or "").strip().lower()
        sent = await trigger_pbx_ota_update(hardware_id=hw_id, subdomain=sub, triggered_by=performed_by)
        if sent:
            triggered.append({"id": c.id, "company_name": c.company_name, "subdomain": sub})
        else:
            skipped.append({"id": c.id, "company_name": c.company_name, "reason": "Tünel aktif değil"})

    await log_master_action(
        db,
        performed_by,
        "BULK_OTA_UPDATE",
        f"Toplu OTA Güncelleme Gönderildi: Başarılı={len(triggered)} ({', '.join(x['company_name'] for x in triggered) or '-'}), Atlanan={len(skipped)}",
        extract_client_ip(request),
    )

    return {
        "success": True,
        "triggered_count": len(triggered),
        "skipped_count": len(skipped),
        "triggered": triggered,
        "skipped": skipped,
        "message": f"{len(triggered)} santrale OTA güncelleme emri iletildi" + (f" ({len(skipped)} santral tünel kapalı olduğu için atlandı)." if skipped else "."),
    }


@app.get("/api/v1/clients/{client_id}/telemetry-dashboard")
async def get_client_telemetry_dashboard(client_id: int, db: AsyncSession = Depends(get_central_db)):
    """Returns real-time PBX system health, disk/CPU/RAM/channel metrics, service statuses, and historical time-series telemetry."""
    from license_center.backend.connect_hub import fetch_pbx_live_system_stats, ACTIVE_TUNNELS_BY_HWID, ACTIVE_TUNNELS_BY_SUBDOMAIN

    res = await db.execute(select(ClientServer).where(ClientServer.id == client_id))
    client = res.scalars().first()
    if not client:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı.")

    hw_id = (client.hardware_id or "").strip().upper()
    sub = (client.connect_subdomain or "").strip().lower()

    # 1. Fetch historical telemetry series from Central DB (last 25 points)
    history_series = []
    try:
        hist_res = await db.execute(
            select(TelemetryLog)
            .where((TelemetryLog.client_id == client.id) | (func.upper(TelemetryLog.hardware_id) == hw_id))
            .order_by(TelemetryLog.created_at.desc())
            .limit(25)
        )
        hist_rows = list(reversed(hist_res.scalars().all()))
        history_series = [
            {
                "time": r.created_at.strftime("%H:%M:%S") if r.created_at else "",
                "cpu": round(float(r.cpu_percent or 0.0), 1),
                "ram": round(float(r.memory_percent or 0.0), 1),
                "calls": int(r.active_calls or 0),
            }
            for r in hist_rows
        ]
    except Exception as e_hist:
        print(f"[Telemetry Dashboard History Warning]: {e_hist}")

    # 2. Query live real-time /api/system/stats over Nornia Connect tunnel if connected
    live_stats = await fetch_pbx_live_system_stats(hardware_id=hw_id, subdomain=sub)
    tunnel_sess = ACTIVE_TUNNELS_BY_SUBDOMAIN.get(sub) or ACTIVE_TUNNELS_BY_HWID.get(hw_id)
    tunnel_connected = tunnel_sess is not None

    parsed_quotas = {}
    if client.custom_quotas:
        try:
            parsed_quotas = json.loads(client.custom_quotas)
        except Exception:
            pass

    max_calls = int(parsed_quotas.get("max_concurrent_calls") or 4)
    tol_calls = int(parsed_quotas.get("tolerance_concurrent_calls") or 0)

    cpu_now = round(float((live_stats or {}).get("cpu_usage") if live_stats else (client.cpu_usage_percent or 0.0)), 1)
    ram_now = round(float((live_stats or {}).get("ram_usage") if live_stats else (client.ram_usage_percent or 0.0)), 1)
    ram_used_gb = (live_stats or {}).get("ram_used_gb", round((ram_now / 100.0) * 8.0, 1))
    ram_total_gb = (live_stats or {}).get("ram_total_gb", 8.0)
    disk_now = round(float((live_stats or {}).get("disk_usage", getattr(client, "disk_usage_percent", 0.0) or 42.0)), 1)
    disk_used_gb = (live_stats or {}).get("disk_used_gb", 24.5)
    disk_total_gb = (live_stats or {}).get("disk_total_gb", 50.0)
    active_calls_now = int((live_stats or {}).get("active_calls_count") if live_stats else (client.active_calls_count or 0))
    today_calls = int((live_stats or {}).get("today_calls_count", 0))
    net_sent_mb = float((live_stats or {}).get("net_sent_mb", 0.0))
    net_recv_mb = float((live_stats or {}).get("net_recv_mb", 0.0))
    rec_file_count = int((live_stats or {}).get("rec_file_count", 0))
    rec_total_size_mb = float((live_stats or {}).get("rec_total_size_mb", 0.0))

    # Append live point to history_series
    history_series.append({
        "time": datetime.datetime.utcnow().strftime("%H:%M:%S"),
        "cpu": cpu_now,
        "ram": ram_now,
        "calls": active_calls_now,
    })

    ami_ok = ((live_stats or {}).get("asterisk_ami_status") == "OK") if live_stats else bool(client.last_heartbeat_at)
    gemini_ok = ((live_stats or {}).get("gemini_live_status") == "OK") if live_stats else True

    services = [
        {
            "id": "asterisk_ami",
            "name": "Asterisk PBX & AMI Motoru",
            "port": "5038 / 5060",
            "status": "online" if ami_ok else "offline",
            "detail": "PJSIP & Dahili Çağrı Yönlendirme Aktif" if ami_ok else "Bağlantı Yok",
        },
        {
            "id": "nornia_connect",
            "name": "Nornia Connect Bulut Tüneli",
            "port": "HTTPS :443",
            "status": "online" if tunnel_connected else "offline",
            "detail": f"{sub}.nornia.com.tr (Sıfır-Port Aktif)" if tunnel_connected and sub else "Tünel Bağlı Değil",
        },
        {
            "id": "audiosocket_ai",
            "name": "AI Voice AudioSocket & Gemini Live",
            "port": "TCP :9092",
            "status": "online" if gemini_ok else "warning",
            "detail": f"Gecikme: {(live_stats or {}).get('gemini_latency_ms', 45)} ms • Gerçek Zamanlı Ses" if gemini_ok else "Kontrol Bekleniyor",
        },
        {
            "id": "postgresql_db",
            "name": "PostgreSQL & Vektör Veritabanı (RAG)",
            "port": "TCP :5444",
            "status": "online" if (live_stats or client.last_heartbeat_at) else "offline",
            "detail": f"{(live_stats or {}).get('total_sources', 0)} Doküman • {(live_stats or {}).get('total_chunks', 0)} Vektör Chunk",
        },
        {
            "id": "webrtc_wss",
            "name": "WebRTC SIP.js & TLS WSS",
            "port": "WSS :8089",
            "status": "online" if ami_ok else "offline",
            "detail": f"{client.total_users_count or 0} Kayıtlı Kullanıcı / Dahili",
        },
        {
            "id": "remote_ssh",
            "name": "Uzaktan Web SSH Köprüsü",
            "port": "Zero-Port PTY",
            "status": "online" if client.remote_ssh_enabled is not False else "locked",
            "detail": "Merkezden Yetki Açık" if client.remote_ssh_enabled is not False else "Merkezden Kilitli",
        },
    ]

    return {
        "client_id": client.id,
        "company_name": client.company_name,
        "tenant_code": client.tenant_code,
        "hardware_id": client.hardware_id,
        "connect_subdomain": client.connect_subdomain,
        "software_version": client.software_version or "—",
        "ip_address": client.ip_address or "127.0.0.1",
        "live_tunnel_fetched": live_stats is not None,
        "tunnel_connected": tunnel_connected,
        "cpu_usage": cpu_now,
        "ram_usage": ram_now,
        "ram_used_gb": ram_used_gb,
        "ram_total_gb": ram_total_gb,
        "disk_usage": disk_now,
        "disk_used_gb": disk_used_gb,
        "disk_total_gb": disk_total_gb,
        "net_sent_mb": net_sent_mb,
        "net_recv_mb": net_recv_mb,
        "rec_file_count": rec_file_count,
        "rec_total_size_mb": rec_total_size_mb,
        "active_calls": active_calls_now,
        "today_calls": today_calls,
        "max_concurrent_calls": max_calls,
        "tolerance_concurrent_calls": tol_calls,
        "effective_max_calls": max_calls + tol_calls,
        "total_users": client.total_users_count or 0,
        "services": services,
        "history": history_series,
        "system_logs": ((live_stats or {}).get("system_logs") or [])[:15],
    }

# --------------------------------------------------------------------------
# Package Template Management (Feature-Based License Tiers)
# --------------------------------------------------------------------------
@app.get("/api/v1/packages")
async def list_package_templates(db: AsyncSession = Depends(get_central_db)):
    """Returns all customized feature-based license package templates stored in DB."""
    res = await db.execute(select(MasterPackageTemplate).order_by(MasterPackageTemplate.id.asc()))
    rows = res.scalars().all()
    items = []
    for r in rows:
        cfg = {}
        try:
            cfg = json.loads(r.config_json or "{}")
            if not isinstance(cfg, dict):
                cfg = {}
        except Exception:
            cfg = {}
        items.append({
            "tier_key": r.tier_key,
            "name": r.name,
            "tagline": r.tagline or "",
            "allowed_features": cfg.get("allowed_features"),
            "allowed_sub_features": cfg.get("allowed_sub_features"),
            "allowed_stt_providers": cfg.get("allowed_stt_providers"),
            "allowed_tts_providers": cfg.get("allowed_tts_providers"),
            "allowed_llm_providers": cfg.get("allowed_llm_providers"),
            "unlicensed_module_mode": cfg.get("unlicensed_module_mode", "hidden"),
            "is_customized": True,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        })
    return {"packages": items}


@app.put("/api/v1/packages/{tier_key}")
async def upsert_package_template(tier_key: str, request: Request, payload: Dict[str, Any] = Body(...), db: AsyncSession = Depends(get_central_db)):
    """Creates or updates a feature-based package template override."""
    clean_key = (tier_key or "").strip().lower()
    if clean_key not in ("trial", "starter", "professional", "enterprise", "unlimited"):
        raise HTTPException(status_code=400, detail="Geçersiz paket anahtarı.")

    res = await db.execute(select(MasterPackageTemplate).where(MasterPackageTemplate.tier_key == clean_key))
    row = res.scalars().first()

    cfg = {
        "allowed_features": payload.get("allowed_features") if isinstance(payload.get("allowed_features"), list) else [],
        "allowed_sub_features": payload.get("allowed_sub_features") if isinstance(payload.get("allowed_sub_features"), list) else [],
        "allowed_stt_providers": payload.get("allowed_stt_providers") if isinstance(payload.get("allowed_stt_providers"), list) else [],
        "allowed_tts_providers": payload.get("allowed_tts_providers") if isinstance(payload.get("allowed_tts_providers"), list) else [],
        "allowed_llm_providers": payload.get("allowed_llm_providers") if isinstance(payload.get("allowed_llm_providers"), list) else [],
        "unlicensed_module_mode": str(payload.get("unlicensed_module_mode") or "hidden"),
    }
    name = str(payload.get("name") or clean_key.title()).strip()
    tagline = str(payload.get("tagline") or "").strip()

    if not row:
        row = MasterPackageTemplate(
            tier_key=clean_key,
            name=name,
            tagline=tagline,
            config_json=json.dumps(cfg),
        )
        db.add(row)
    else:
        row.name = name
        row.tagline = tagline
        row.config_json = json.dumps(cfg)

    await db.commit()
    await db.refresh(row)

    performed_by = request.headers.get("X-User-Name", "admin")
    await log_master_action(
        db,
        performed_by,
        "PACKAGE_TEMPLATE_UPDATE",
        f"Lisans Paket Şablonu Güncellendi: {name} ({clean_key}) — {len(cfg['allowed_features'])} modül, {len(cfg['allowed_sub_features'])} alt özellik",
        extract_client_ip(request),
    )

    return {
        "success": True,
        "package": {
            "tier_key": row.tier_key,
            "name": row.name,
            "tagline": row.tagline or "",
            **cfg,
            "is_customized": True,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        },
    }


@app.post("/api/v1/packages/{tier_key}/reset")
async def reset_package_template(tier_key: str, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Deletes custom override for a package tier so it reverts to built-in defaults."""
    clean_key = (tier_key or "").strip().lower()
    res = await db.execute(select(MasterPackageTemplate).where(MasterPackageTemplate.tier_key == clean_key))
    row = res.scalars().first()
    if row:
        await db.delete(row)
        await db.commit()
        performed_by = request.headers.get("X-User-Name", "admin")
        await log_master_action(
            db,
            performed_by,
            "PACKAGE_TEMPLATE_RESET",
            f"Lisans Paket Şablonu Varsayılana Sıfırlandı: {clean_key}",
            extract_client_ip(request),
        )
    return {"success": True, "tier_key": clean_key}


# --------------------------------------------------------------------------
# License Key Generator Studio
# --------------------------------------------------------------------------
@app.post("/api/v1/licenses/generate")
async def generate_license(payload: LicenseGenerateSchema, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Generates a cryptographic machine-bound key and records it in history."""
    t_code = payload.tenant_code.strip().lower().replace(" ", "-")
    exp_date = payload.expiry_date or "2027-12-31"
    hw_id = payload.hardware_id.strip().upper() if payload.hardware_id else "UNBOUND"

    quotas = payload.custom_quotas.copy() if payload.custom_quotas else {}
    if payload.plan_tier:
        quotas["plan_tier"] = payload.plan_tier
    quotas["license_expires_at"] = exp_date
    quotas["status"] = quotas.get("status", "active")
    if exp_date in ["unlimited", "Süresiz", ""] or payload.plan_tier == "unlimited":
        quotas["is_unlimited"] = True

    # Find matching client if available
    res = await db.execute(select(ClientServer).where(ClientServer.tenant_code == t_code))
    client = res.scalars().first()
    resolved_t_sn = (
        (payload.tenant_serial_number or "").strip()
        or (client.tenant_serial_number if client else None)
        or generate_tenant_serial_number(t_code, 100 + (client.id if client and client.id else 0))
    )
    quotas["tenant_serial_number"] = resolved_t_sn
    resolved_sys_sn = compute_system_serial_number(hw_id) if hw_id not in ("UNBOUND", "Bilinmiyor") else (client.system_serial_number if client else None)

    key = generate_signed_license_key(t_code, exp_date, hw_id, custom_quotas=quotas)

    if not client:
        client = ClientServer(
            company_name=f"Müşteri ({t_code})",
            tenant_code=t_code,
            tenant_serial_number=resolved_t_sn,
            system_serial_number=resolved_sys_sn,
            hardware_id=hw_id,
            plan_tier=payload.plan_tier or "professional",
            status="active",
            current_license_key=key,
            license_expires_at=exp_date,
            custom_quotas=json.dumps(quotas)
        )
        db.add(client)
        await db.commit()
        await db.refresh(client)
    else:
        client.custom_quotas = json.dumps(quotas)
        client.tenant_serial_number = resolved_t_sn
        if resolved_sys_sn:
            client.system_serial_number = resolved_sys_sn
        if payload.plan_tier:
            client.plan_tier = payload.plan_tier
        client.current_license_key = key
        client.license_expires_at = exp_date
        client.hardware_id = hw_id
        client.status = str(quotas.get("status") or "active")

    # Safely insert or update LicenseRecord to avoid UNIQUE constraint exception on identical keys
    rec_res = await db.execute(select(LicenseRecord).where(LicenseRecord.license_key == key))
    existing_log = rec_res.scalars().first()
    if not existing_log:
        log = LicenseRecord(
            client_id=client.id,
            tenant_code=t_code,
            hardware_id=hw_id,
            license_key=key,
            expires_at=exp_date,
            plan_tier=payload.plan_tier or client.plan_tier,
            created_by=payload.performed_by or "admin"
        )
        db.add(log)
    else:
        existing_log.created_at = datetime.datetime.utcnow()

    await db.commit()

    # Push instant license/quota sync signal over active Nornia Connect tunnel (~1s update on PBX)
    try:
        from license_center.backend.connect_hub import trigger_pbx_license_sync
        asyncio.create_task(trigger_pbx_license_sync(hardware_id=client.hardware_id, subdomain=client.connect_subdomain))
    except Exception:
        pass

    try:
        from license_center.backend.sip_edge_manager import revoke_pbx_sip_edge, sync_all_sip_edge_peers_from_db
        if client.status == "suspended" or client.sip_edge_enabled is False:
            await revoke_pbx_sip_edge(db, client.wg_public_key)
        else:
            await sync_all_sip_edge_peers_from_db(db)
    except Exception as ex_edge_upd:
        print(f"[SIP Edge Update Sync Warning]: {ex_edge_upd}")

    try:
        from license_center.backend.connect_hub import notify_pbx_license_sync
        await notify_pbx_license_sync(hardware_id=hw_id, subdomain=client.connect_subdomain)
    except Exception:
        pass

    await log_master_action(db, payload.performed_by or "admin", "LICENSE_GENERATE", f"Yeni Lisans Key Üretildi ({t_code}): Key={key}, Bitiş={exp_date}, HW={hw_id}", extract_client_ip(request))

    return {
        "license_key": key,
        "tenant_code": t_code,
        "expiry_date": exp_date,
        "hardware_id": hw_id
    }

# --------------------------------------------------------------------------
# Telemetry Heartbeat Receiver (Pings from Client Servers)
# --------------------------------------------------------------------------
@app.post("/api/v1/telemetry/heartbeat")
async def receive_heartbeat(payload: HeartbeatSchema, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Receives 10-minute status pings from client on-premise servers (supports single & multi-tenant pings)."""
    forwarded = request.headers.get("x-forwarded-for") or request.headers.get("x-real-ip")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    else:
        client_ip = extract_client_ip(request)

    if (not client_ip or client_ip in ["127.0.0.1", "localhost", "::1"]) and (payload.public_ip or payload.ip_address):
        client_ip = payload.public_ip or payload.ip_address

    hw_id = payload.hardware_id or "HW-UNKNOWN"
    sys_sn = (payload.system_serial_number or "").strip() or compute_system_serial_number(hw_id)

    tenant_items = []
    if payload.tenants and len(payload.tenants) > 0:
        tenant_items = payload.tenants
    elif payload.tenant_code:
        tenant_items = [
            TenantPingItem(
                tenant_code=payload.tenant_code,
                serial_number=payload.tenant_serial_number,
                license_key=payload.license_key or ""
            )
        ]

    tenants_response = []
    active_t_codes_for_hw = set()

    # Check if this hardware_id already has a bound connect_subdomain
    bound_sub_for_hw = None
    if hw_id and hw_id not in ("HW-UNKNOWN", "UNBOUND", "Bilinmiyor"):
        from license_center.backend.connect_hub import ACTIVE_TUNNELS_BY_HWID
        live_t = ACTIVE_TUNNELS_BY_HWID.get(hw_id.upper())
        if live_t and live_t.subdomain:
            bound_sub_for_hw = live_t.subdomain
        else:
            res_sub = await db.execute(
                select(ClientServer.connect_subdomain).where(
                    (func.upper(ClientServer.hardware_id) == hw_id.upper())
                    & (ClientServer.connect_subdomain.isnot(None))
                )
            )
            row_sub = res_sub.scalars().first()
            if row_sub:
                bound_sub_for_hw = row_sub

    for idx, t_item in enumerate(tenant_items):
        t_code = t_item.tenant_code.strip().lower()
        if not t_code:
            continue
        active_t_codes_for_hw.add(t_code)

        incoming_t_sn = (t_item.serial_number or "").strip() or generate_tenant_serial_number(t_code, t_item.tenant_num_id or (100 + idx))
        res = await db.execute(
            select(ClientServer).where(
                (ClientServer.tenant_code == t_code)
                | ((ClientServer.tenant_serial_number == incoming_t_sn) & (ClientServer.hardware_id == hw_id))
            )
        )
        client = res.scalars().first()

        extracted_hb_exp = _extract_expiry_from_license_key(t_item.license_key)
        if not client:
            client = ClientServer(
                company_name=(t_item.company_name or "").strip() or f"Otomatik Kayıt ({t_code})",
                tenant_code=t_code,
                tenant_serial_number=incoming_t_sn,
                system_serial_number=sys_sn,
                hardware_id=hw_id,
                connect_subdomain=bound_sub_for_hw,
                domain_name=f"{bound_sub_for_hw}.nornia.com.tr" if bound_sub_for_hw else None,
                ip_address=client_ip,
                status="active",
                current_license_key=t_item.license_key,
                license_expires_at=extracted_hb_exp,
                software_version=payload.software_version
            )
            db.add(client)
            await db.commit()
            await db.refresh(client)

        if not client.license_expires_at:
            fallback_exp = extracted_hb_exp or _extract_expiry_from_license_key(client.current_license_key)
            if fallback_exp:
                client.license_expires_at = fallback_exp

        if t_item.company_name and t_item.company_name.strip():
            client.company_name = t_item.company_name.strip()
        client.tenant_code = t_code
        if bound_sub_for_hw and not client.connect_subdomain:
            client.connect_subdomain = bound_sub_for_hw
            client.domain_name = f"{bound_sub_for_hw}.nornia.com.tr"
        if not client.tenant_serial_number:
            client.tenant_serial_number = incoming_t_sn
        client.system_serial_number = sys_sn
        client.last_heartbeat_at = datetime.datetime.utcnow()
        client.ip_address = client_ip or client.ip_address
        client.hardware_id = hw_id
        client.cpu_usage_percent = payload.cpu_percent or 0.0
        client.ram_usage_percent = payload.memory_percent or 0.0
        if payload.disk_percent is not None:
            client.disk_usage_percent = payload.disk_percent or 0.0
        if payload.failed_services is not None:
            client.failed_services_json = json.dumps([str(x) for x in payload.failed_services if x])
        client.active_calls_count = payload.active_calls or 0
        client.total_users_count = payload.total_users or 0
        client.whatsapp_status = payload.whatsapp_status or "offline"
        client.software_version = payload.software_version or client.software_version

        t_log = TelemetryLog(
            client_id=client.id,
            tenant_code=t_code,
            hardware_id=hw_id,
            ip_address=client_ip,
            software_version=payload.software_version,
            cpu_percent=payload.cpu_percent,
            memory_percent=payload.memory_percent,
            active_calls=payload.active_calls,
            whatsapp_status=payload.whatsapp_status
        )
        db.add(t_log)
        await db.commit()

        parsed_quotas = None
        if client.custom_quotas:
            try:
                parsed_quotas = json.loads(client.custom_quotas)
            except Exception:
                pass

        grace_active = False
        grace_str_hb = str((parsed_quotas or {}).get("license_grace_until") or "").strip()[:10]
        if len(grace_str_hb) == 10:
            try:
                now_tr_hb = (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).date()
                if datetime.datetime.strptime(grace_str_hb, "%Y-%m-%d").date() >= now_tr_hb:
                    grace_active = True
            except Exception:
                pass

        remote_kill_switch = (client.status == "suspended") or (client.status == "expired" and not grace_active)

        tenants_response.append({
            "tenant_code": t_code,
            "serial_number": client.tenant_serial_number,
            "tenant_serial_number": client.tenant_serial_number,
            "system_serial_number": client.system_serial_number,
            "client_status": client.status,
            "remote_kill_switch": remote_kill_switch,
            "remote_ssh_enabled": bool(client.remote_ssh_enabled if client.remote_ssh_enabled is not None else True),
            "latest_license_key": client.current_license_key,
            "license_expires_at": client.license_expires_at,
            "quotas": parsed_quotas
        })

    # Clean up deleted tenants on this hardware_id so Central Panel stays in sync with PBX
    if payload.tenants and len(active_t_codes_for_hw) > 0 and hw_id and hw_id not in ("HW-UNKNOWN", "UNBOUND", "Bilinmiyor"):
        try:
            stale_res = await db.execute(
                select(ClientServer).where(func.upper(ClientServer.hardware_id) == hw_id.upper())
            )
            stale_rows = stale_res.scalars().all()
            for s_row in stale_rows:
                if (s_row.tenant_code or "").strip().lower() not in active_t_codes_for_hw:
                    await db.delete(s_row)
            await db.commit()
        except Exception as e:
            print(f"[Heartbeat Cleanup Warning] {e}")

    primary_resp = tenants_response[0] if tenants_response else {}

    return {
        "status": "ok",
        "remote_kill_switch": primary_resp.get("remote_kill_switch", False),
        "latest_license_key": primary_resp.get("latest_license_key"),
        "license_expires_at": primary_resp.get("license_expires_at"),
        "tenants_response": tenants_response,
        "message": f"Heartbeat alındı ({len(tenants_response)} tenant güncellendi)."
    }


# --------------------------------------------------------------------------
# Nornia Connect Hub — Zero-Port Cloud Tunnel & Reverse Proxy Gateway
# --------------------------------------------------------------------------
from license_center.backend.connect_hub import connect_hub_router, forward_http_request_to_pbx

app.include_router(connect_hub_router)


@app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def catch_all_nornia_connect_proxy(request: Request, full_path: str):
    """Forwards all non-/api/v1/* requests through the active Nornia Connect tunnel to the PBX."""
    return await forward_http_request_to_pbx(request, full_path)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("license_center.backend.main:app", host="0.0.0.0", port=8050, reload=True)

