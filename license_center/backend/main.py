import os
import sys
import time
import hmac
import base64
import struct
import urllib.parse
import datetime
import asyncio
import hashlib
import json
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import select, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from license_center.backend.database import get_central_db, init_central_db, AsyncSessionLocal
from license_center.backend.models import (
    ClientServer,
    LicenseRecord,
    TelemetryLog,
    MasterUser,
    MasterAuditLog,
    MasterBlockedIP,
    MasterSecurityPolicy,
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.on_event("startup")
async def on_startup():
    await init_central_db()
    print("[AIDA License Master] Central License Database initialized.")
    
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
    software_version: Optional[str] = "v2.4.9"
    cpu_percent: Optional[float] = 0.0
    memory_percent: Optional[float] = 0.0
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
# Auth, 2FA (TOTP), Brute-Force Guard & User Management Endpoints
# --------------------------------------------------------------------------
class Verify2FASchema(BaseModel):
    temp_token: str
    code: str


@app.post("/api/v1/auth/login")
async def login_master_user(payload: LoginSchema, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Authenticates central master user with Brute-Force IP protection and 2FA (TOTP) support."""
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

    # Check if 2FA (Google Authenticator) is enabled for this user
    if user.totp_enabled and user.totp_secret:
        temp_token = generate_2fa_temp_token(user.id, user.username)
        return {
            "success": True,
            "requires_2fa": True,
            "temp_token": temp_token,
            "username": user.username,
            "full_name": user.full_name,
        }

    _FAILED_LOGIN_TRACKER.pop(client_ip, None)
    user.last_login_at = datetime.datetime.utcnow()
    await db.commit()
    
    await log_master_action(db, user.username, "USER_LOGIN", f"Başarılı Kullanıcı Girişi ({user.full_name})", client_ip, user.id)
    
    return {
        "success": True,
        "requires_2fa": False,
        "auto_logout_minutes": pol.auto_logout_minutes,
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "totp_enabled": bool(user.totp_enabled),
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None
        }
    }


@app.post("/api/v1/auth/verify-2fa")
async def verify_master_user_2fa(payload: Verify2FASchema, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Verifies the 6-digit TOTP Authenticator code after password step."""
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

    if not verify_totp_code(user.totp_secret, payload.code):
        await log_master_action(db, user.username, "USER_2FA_FAILED", f"Hatalı 2FA Authenticator Kodu ({user.username})", client_ip, user.id)
        rem = await record_failed_login_attempt(db, client_ip, user.username, pol)
        raise HTTPException(status_code=401, detail=f"6 haneli Authenticator doğrulama kodu hatalı. (Kalan deneme hakkı: {rem})")

    _FAILED_LOGIN_TRACKER.pop(client_ip, None)
    user.last_login_at = datetime.datetime.utcnow()
    await db.commit()

    await log_master_action(db, user.username, "USER_LOGIN_2FA", f"2FA Doğrulaması ile Başarılı Giriş ({user.full_name})", client_ip, user.id)

    return {
        "success": True,
        "auto_logout_minutes": pol.auto_logout_minutes,
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "totp_enabled": bool(user.totp_enabled),
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None
        }
    }


@app.post("/api/v1/auth/logout")
async def logout_master_user(request: Request, db: AsyncSession = Depends(get_central_db)):
    """Logs user logout event."""
    username = request.headers.get("X-User-Name", "admin")
    reason = request.headers.get("X-Logout-Reason", "manual")
    action_code = "AUTO_LOGOUT" if reason == "idle_timeout" else "USER_LOGOUT"
    msg = f"Hareketsizlik Nedeniyle Otomatik Oturum Kapatıldı ({username})" if reason == "idle_timeout" else f"Kullanıcı Çıkış Yaptı ({username})"
    await log_master_action(db, username, action_code, msg, extract_client_ip(request))
    return {"success": True, "message": "Çıkış yapıldı."}


@app.get("/api/v1/users")
async def get_master_users(db: AsyncSession = Depends(get_central_db)):
    """Returns list of all central master portal users."""
    res = await db.execute(select(MasterUser).order_by(MasterUser.id.asc()))
    users = res.scalars().all()
    return [{
        "id": u.id,
        "username": u.username,
        "full_name": u.full_name,
        "email": u.email,
        "role": u.role,
        "is_active": u.is_active,
        "totp_enabled": bool(u.totp_enabled),
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        "created_at": u.created_at.isoformat() if u.created_at else None
    } for u in users]


_PENDING_TOTP_SECRETS: Dict[int, str] = {}


def _build_local_qr_svg_data_uri(text_val: str) -> str:
    """Generates a zero-dependency local SVG QR data URI so 2FA QR never depends on external services."""
    try:
        from backend.services.totp_service import generate_qr_svg_data_uri
        return generate_qr_svg_data_uri(text_val)
    except Exception:
        return ""


@app.post("/api/v1/users/{user_id}/2fa/setup")
async def setup_master_user_2fa(user_id: int, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Generates a new TOTP secret, otpauth:// URI, and offline SVG QR for Google/Microsoft Authenticator setup."""
    res = await db.execute(select(MasterUser).where(MasterUser.id == user_id))
    u = res.scalars().first()
    if not u:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    secret = generate_totp_secret()
    _PENDING_TOTP_SECRETS[u.id] = secret
    if not u.totp_enabled:
        u.totp_secret = secret
        await db.commit()

    issuer = "Nornia Cloud Center"
    label = urllib.parse.quote(f"{issuer}:{u.username}")
    issuer_enc = urllib.parse.quote(issuer)
    otpauth_url = f"otpauth://totp/{label}?secret={secret}&issuer={issuer_enc}&algorithm=SHA1&digits=6&period=30"
    qr_svg_data_uri = _build_local_qr_svg_data_uri(otpauth_url)

    return {
        "success": True,
        "user_id": u.id,
        "username": u.username,
        "secret": secret,
        "otpauth_url": otpauth_url,
        "qr_svg_data_uri": qr_svg_data_uri,
    }


@app.post("/api/v1/users/{user_id}/2fa/enable")
async def enable_master_user_2fa(user_id: int, request: Request, payload: Dict[str, Any] = Body(...), db: AsyncSession = Depends(get_central_db)):
    """Verifies the 6-digit code from the user's Authenticator app and activates 2FA."""
    res = await db.execute(select(MasterUser).where(MasterUser.id == user_id))
    u = res.scalars().first()
    candidate_secret = _PENDING_TOTP_SECRETS.get(user_id) or (u.totp_secret if u else None)
    if not u or not candidate_secret:
        raise HTTPException(status_code=400, detail="Önce 2FA QR kurulumu başlatılmalıdır.")

    code = str(payload.get("code") or "").strip()
    if not verify_totp_code(candidate_secret, code):
        raise HTTPException(status_code=400, detail="Girilen 6 haneli doğrulama kodu hatalı. Lütfen Authenticator uygulamanızdaki güncel kodu giriniz.")

    u.totp_secret = candidate_secret
    u.totp_enabled = True
    _PENDING_TOTP_SECRETS.pop(u.id, None)
    await db.commit()
    performed_by = request.headers.get("X-User-Name", u.username)
    await log_master_action(db, performed_by, "USER_2FA_ENABLED", f"2FA (Google Authenticator) Aktifleştirildi: {u.full_name} (@{u.username})", extract_client_ip(request), u.id)
    return {"success": True, "totp_enabled": True, "message": "2 Aşamalı Doğrulama (2FA) başarıyla aktifleştirildi."}


@app.post("/api/v1/users/{user_id}/2fa/disable")
async def disable_master_user_2fa(user_id: int, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Disables 2FA for a master user."""
    res = await db.execute(select(MasterUser).where(MasterUser.id == user_id))
    u = res.scalars().first()
    if not u:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    u.totp_enabled = False
    u.totp_secret = None
    _PENDING_TOTP_SECRETS.pop(u.id, None)
    await db.commit()
    performed_by = request.headers.get("X-User-Name", u.username)
    await log_master_action(db, performed_by, "USER_2FA_DISABLED", f"2FA (Google Authenticator) Devre Dışı Bırakıldı: {u.full_name} (@{u.username})", extract_client_ip(request), u.id)
    return {"success": True, "totp_enabled": False, "message": "2 Aşamalı Doğrulama devre dışı bırakıldı."}


# --------------------------------------------------------------------------
# Central Security Shield Endpoints (Brute-Force Policy, Blocked IPs, Auto-Logout)
# --------------------------------------------------------------------------
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
    totp_users = [{
        "id": u.id,
        "username": u.username,
        "full_name": u.full_name,
        "role": u.role,
        "totp_enabled": bool(u.totp_enabled),
    } for u in all_users]

    return {
        "client_ip": extract_client_ip(request),
        "policy": {
            "max_failed_attempts": pol.max_failed_attempts,
            "block_duration_minutes": pol.block_duration_minutes,
            "auto_logout_minutes": pol.auto_logout_minutes,
            "whitelisted_ips": parse_whitelisted_ips(pol),
        },
        "blocked_ips": active_blks,
        "totp_summary": {
            "total_users": len(totp_users),
            "enabled_users": sum(1 for x in totp_users if x["totp_enabled"]),
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

    await db.commit()
    performed_by = request.headers.get("X-User-Name", "admin")
    await log_master_action(
        db,
        performed_by,
        "SECURITY_POLICY_UPDATE",
        f"Merkez Güvenlik Politikası Güncellendi: MaxHata={pol.max_failed_attempts}, BlokSüresi={pol.block_duration_minutes}dk, AutoLogout={pol.auto_logout_minutes}dk",
        extract_client_ip(request),
    )
    return {
        "success": True,
        "policy": {
            "max_failed_attempts": pol.max_failed_attempts,
            "block_duration_minutes": pol.block_duration_minutes,
            "auto_logout_minutes": pol.auto_logout_minutes,
            "whitelisted_ips": parse_whitelisted_ips(pol),
        },
    }


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
    return {
        "id": new_u.id,
        "username": new_u.username,
        "full_name": new_u.full_name,
        "email": new_u.email,
        "role": new_u.role,
        "is_active": new_u.is_active,
        "totp_enabled": bool(new_u.totp_enabled),
        "last_login_at": new_u.last_login_at.isoformat() if new_u.last_login_at else None,
        "created_at": new_u.created_at.isoformat() if new_u.created_at else None,
    }

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
    return {
        "id": u.id,
        "username": u.username,
        "full_name": u.full_name,
        "email": u.email,
        "role": u.role,
        "is_active": u.is_active,
        "totp_enabled": bool(u.totp_enabled),
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }

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
    await log_master_action(db, performed_by, "USER_DELETE", f"Kullanıcı Silindi: {u.full_name} ({u.username})", request.client.host if request.client else None)
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
@app.get("/api/v1/dashboard/stats")
@app.get("/api/v1/stats")
async def get_dashboard_stats(db: AsyncSession = Depends(get_central_db)):
    """Returns real-time fleet overview metrics."""
    res_clients = await db.execute(select(ClientServer))
    clients = res_clients.scalars().all()
    
    total_clients = len(clients)
    now = datetime.datetime.utcnow()
    fifteen_mins_ago = now - datetime.timedelta(minutes=15)
    
    online_count = sum(1 for c in clients if c.last_heartbeat_at and c.last_heartbeat_at >= fifteen_mins_ago)
    expired_count = sum(1 for c in clients if c.status in ["expired", "suspended"])
    expiring_soon_count = 0
    total_active_calls = sum(c.active_calls_count or 0 for c in clients)
    
    for c in clients:
        exp_str = c.license_expires_at
        if exp_str and exp_str != "unlimited":
            try:
                exp_d = datetime.datetime.strptime(exp_str, "%Y-%m-%d")
                days_left = (exp_d - now).days
                if 0 <= days_left <= 15 and c.status == "active":
                    expiring_soon_count += 1
            except Exception:
                pass
                
    return {
        "total_clients": total_clients,
        "online_count": online_count,
        "offline_count": total_clients - online_count,
        "expiring_soon_count": expiring_soon_count,
        "expired_count": expired_count,
        "total_active_calls": total_active_calls
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
    
    for c in clients:
        if not c.tenant_serial_number:
            c.tenant_serial_number = generate_tenant_serial_number(c.tenant_code, 99 + (c.id or 1))
            db_modified = True
        if not c.system_serial_number and c.hardware_id and c.hardware_id not in ("UNBOUND", "Bilinmiyor", "HW-UNKNOWN"):
            c.system_serial_number = compute_system_serial_number(c.hardware_id)
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
                
        output.append({
            "id": c.id,
            "company_name": c.company_name,
            "tenant_code": c.tenant_code,
            "connect_subdomain": c.connect_subdomain or (tunnel_sess.subdomain if tunnel_sess else None),
            "tunnel_connected": bool(tunnel_sess),
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
            "custom_quotas": parsed_quotas,
            "is_online": is_online,
            "last_heartbeat_at": c.last_heartbeat_at.isoformat() if c.last_heartbeat_at else None,
            "software_version": c.software_version,
            "cpu_usage_percent": c.cpu_usage_percent,
            "ram_usage_percent": c.ram_usage_percent,
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

    await log_master_action(db, payload.performed_by or "admin", "CLIENT_CREATE", f"Yeni Müşteri & Sunucu Eklendi: {new_client.company_name} ({t_code}) [Donanım: {hw_id}]", request.client.host if request.client else None)

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

    action_name = "CLIENT_SUSPEND" if client.status == "suspended" else "CLIENT_UPDATE"
    await log_master_action(db, payload.performed_by or "admin", action_name, f"Müşteri Bilgileri Güncellendi ({client.company_name}): Durum={client.status}, Bitiş={client.license_expires_at}", request.client.host if request.client else None)

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

    await db.delete(client)
    await db.commit()

    await notify_and_unbind_pbx_tunnel(hardware_id=hw_to_unbind, subdomain=sub_to_unbind)

    await log_master_action(db, performed_by, "CLIENT_DELETE", f"Müşteri Kaydı ve Nornia Connect Alt Alan Adı Kilidi Silindi: {company} (#{client_id}, Subdomain: {sub_to_unbind})", request.client.host if request.client else None)
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
    await log_master_action(db, performed_by, "SUBDOMAIN_UNLOCK", f"Nornia Connect Alt Alan Adı Kilidi Açıldı: {client.company_name} (Donanım: {hw_id}, Eski Subdomain: {old_sub})", request.client.host if request.client else None)
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
        request.client.host if request.client else None,
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
        request.client.host if request.client else None,
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
        request.client.host if request.client else None,
    )
    return {
        "success": True,
        "message": f"{client.company_name} santraline Nornia Connect tüneli üzerinden OTA güncelleme emri iletildi. Santral arka planda güncellenip yeniden başlatılacak.",
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
    disk_now = round(float((live_stats or {}).get("disk_usage", 42.0)), 1)
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
        "software_version": client.software_version or "v2.5.0",
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
        client.current_license_key = key
        client.license_expires_at = exp_date
        client.hardware_id = hw_id
        client.status = "active"

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

    try:
        from license_center.backend.connect_hub import notify_pbx_license_sync
        await notify_pbx_license_sync(hardware_id=hw_id, subdomain=client.connect_subdomain)
    except Exception:
        pass

    await log_master_action(db, payload.performed_by or "admin", "LICENSE_GENERATE", f"Yeni Lisans Key Üretildi ({t_code}): Key={key}, Bitiş={exp_date}, HW={hw_id}", request.client.host if request.client else None)

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
        client_ip = request.client.host if request.client else None

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
                software_version=payload.software_version
            )
            db.add(client)
            await db.commit()
            await db.refresh(client)

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

        remote_kill_switch = (client.status in ["suspended", "expired"])

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

