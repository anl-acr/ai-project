import os
import sys
import datetime
import asyncio
import hashlib
import json
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import select, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from license_center.backend.database import get_central_db, init_central_db, AsyncSessionLocal
from license_center.backend.models import ClientServer, LicenseRecord, TelemetryLog, MasterUser, MasterAuditLog
from license_center.backend.license_generator import generate_signed_license_key, verify_signed_license_key

app = FastAPI(title="AIDA Control Center - Central License & Fleet Management API", version="1.0.0")

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

# Pydantic Schemas
class ClientCreateSchema(BaseModel):
    company_name: str
    tenant_code: str
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
    expiry_date: str
    hardware_id: Optional[str] = "UNBOUND"
    plan_tier: Optional[str] = "professional"
    custom_quotas: Optional[Dict[str, Any]] = None
    performed_by: Optional[str] = "admin"

class TenantPingItem(BaseModel):
    tenant_code: str
    license_key: Optional[str] = ""
    status: Optional[str] = "active"

class HeartbeatSchema(BaseModel):
    hardware_id: str
    tenant_code: Optional[str] = None
    license_key: Optional[str] = None
    software_version: Optional[str] = "v2.4.8"
    cpu_percent: Optional[float] = 0.0
    memory_percent: Optional[float] = 0.0
    active_calls: Optional[int] = 0
    total_users: Optional[int] = 0
    whatsapp_status: Optional[str] = "offline"
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
# Auth & User Management Endpoints
# --------------------------------------------------------------------------
@app.post("/api/v1/auth/login")
async def login_master_user(payload: LoginSchema, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Authenticates central master user and returns session object."""
    res = await db.execute(select(MasterUser).where(MasterUser.username == payload.username.strip()))
    user = res.scalars().first()
    
    if not user or user.password_hash != hash_password(payload.password):
        await log_master_action(db, payload.username, "USER_LOGIN_FAILED", f"Başarısız Giriş Denemesi (Kullanıcı: {payload.username})", request.client.host if request.client else None)
        raise HTTPException(status_code=401, detail="Kullanıcı adı veya şifre hatalı.")
        
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Bu kullanıcı hesabı pasife alınmıştır.")
        
    user.last_login_at = datetime.datetime.utcnow()
    await db.commit()
    
    await log_master_action(db, user.username, "USER_LOGIN", f"Başarılı Kullanıcı Girişi ({user.full_name})", request.client.host if request.client else None, user.id)
    
    return {
        "success": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None
        }
    }

@app.post("/api/v1/auth/logout")
async def logout_master_user(request: Request, db: AsyncSession = Depends(get_central_db)):
    """Logs user logout event."""
    username = request.headers.get("X-User-Name", "admin")
    await log_master_action(db, username, "USER_LOGOUT", f"Kullanıcı Çıkış Yaptı ({username})", request.client.host if request.client else None)
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
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        "created_at": u.created_at.isoformat() if u.created_at else None
    } for u in users]

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

    await log_master_action(db, payload.performed_by or "admin", "USER_CREATE", f"Yeni Kullanıcı Oluşturuldu: {new_u.full_name} ({new_u.username}) [Rol: {new_u.role}]", request.client.host if request.client else None)
    return new_u

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
    await log_master_action(db, payload.performed_by or "admin", "USER_UPDATE", f"Kullanıcı Bilgileri Güncellendi: {u.full_name} ({u.username})", request.client.host if request.client else None)
    return u

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
    
    for c in clients:
        is_online = bool(c.last_heartbeat_at and c.last_heartbeat_at >= fifteen_mins_ago)
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
            "hardware_id": c.hardware_id or "Bilinmiyor",
            "ip_address": c.ip_address,
            "domain_name": c.domain_name,
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
    cq_json = json.dumps(payload.custom_quotas) if payload.custom_quotas else None
    gen_key = generate_signed_license_key(t_code, exp_date, hw_id, custom_quotas=payload.custom_quotas)

    new_client = ClientServer(
        company_name=payload.company_name.strip(),
        tenant_code=t_code,
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
    """Deletes client record from central database."""
    res = await db.execute(select(ClientServer).where(ClientServer.id == client_id))
    client = res.scalars().first()
    if not client:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı.")
        
    performed_by = request.headers.get("X-User-Name", "admin")
    company = client.company_name
    await db.delete(client)
    await db.commit()

    await log_master_action(db, performed_by, "CLIENT_DELETE", f"Müşteri Kaydı Silindi: {company} (#{client_id})", request.client.host if request.client else None)
    return {"success": True, "message": f"Müşteri #{client_id} silindi."}

# --------------------------------------------------------------------------
# License Key Generator Studio
# --------------------------------------------------------------------------
@app.post("/api/v1/licenses/generate")
async def generate_license(payload: LicenseGenerateSchema, request: Request, db: AsyncSession = Depends(get_central_db)):
    """Generates a cryptographic machine-bound key and records it in history."""
    t_code = payload.tenant_code.strip().lower()
    hw_id = payload.hardware_id.strip().upper() if payload.hardware_id else "UNBOUND"
    exp_date = payload.expiry_date.strip()

    key = generate_signed_license_key(t_code, exp_date, hw_id, custom_quotas=payload.custom_quotas)

    # Find matching client if available
    res = await db.execute(select(ClientServer).where(ClientServer.tenant_code == t_code))
    client = res.scalars().first()
    if not client:
        client = ClientServer(
            company_name=f"Müşteri ({t_code})",
            tenant_code=t_code,
            hardware_id=hw_id,
            plan_tier=payload.plan_tier or "professional",
            status="active",
            current_license_key=key,
            license_expires_at=exp_date,
            custom_quotas=json.dumps(payload.custom_quotas) if payload.custom_quotas else None
        )
        db.add(client)
        await db.commit()
        await db.refresh(client)
    else:
        if payload.custom_quotas is not None:
            client.custom_quotas = json.dumps(payload.custom_quotas) if payload.custom_quotas else None
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
    client_ip = request.client.host if request.client else None
    hw_id = payload.hardware_id or "HW-UNKNOWN"

    tenant_items = []
    if payload.tenants and len(payload.tenants) > 0:
        tenant_items = payload.tenants
    elif payload.tenant_code:
        tenant_items = [TenantPingItem(tenant_code=payload.tenant_code, license_key=payload.license_key or "")]

    tenants_response = []

    for t_item in tenant_items:
        t_code = t_item.tenant_code.strip().lower()
        if not t_code:
            continue

        res = await db.execute(select(ClientServer).where(ClientServer.tenant_code == t_code))
        client = res.scalars().first()

        if not client:
            client = ClientServer(
                company_name=f"Otomatik Kayıt ({t_code})",
                tenant_code=t_code,
                hardware_id=hw_id,
                ip_address=client_ip,
                status="active",
                current_license_key=t_item.license_key,
                software_version=payload.software_version
            )
            db.add(client)
            await db.commit()
            await db.refresh(client)

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
            "client_status": client.status,
            "remote_kill_switch": remote_kill_switch,
            "latest_license_key": client.current_license_key,
            "license_expires_at": client.license_expires_at,
            "quotas": parsed_quotas
        })

    primary_resp = tenants_response[0] if tenants_response else {}

    return {
        "status": "ok",
        "remote_kill_switch": primary_resp.get("remote_kill_switch", False),
        "latest_license_key": primary_resp.get("latest_license_key"),
        "license_expires_at": primary_resp.get("license_expires_at"),
        "tenants_response": tenants_response,
        "message": f"Heartbeat alındı ({len(tenants_response)} tenant güncellendi)."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("license_center.backend.main:app", host="0.0.0.0", port=8050, reload=True)

