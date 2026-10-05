import os
import sys
import datetime
import asyncio
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

from license_center.backend.database import get_central_db, init_central_db
from license_center.backend.models import ClientServer, LicenseRecord, TelemetryLog
from license_center.backend.license_generator import generate_signed_license_key, verify_signed_license_key

app = FastAPI(title="AIDA Control Center - Central License & Fleet Management API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    await init_central_db()
    print("[AIDA License Master] Central License Database initialized.")

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
    notes: Optional[str] = None

class LicenseGenerateSchema(BaseModel):
    client_id: Optional[int] = None
    tenant_code: str
    expiry_date: str
    hardware_id: Optional[str] = "UNBOUND"
    plan_tier: Optional[str] = "professional"

class HeartbeatSchema(BaseModel):
    tenant_code: str
    hardware_id: str
    license_key: str
    software_version: Optional[str] = "v2.4.8"
    cpu_percent: Optional[float] = 0.0
    memory_percent: Optional[float] = 0.0
    active_calls: Optional[int] = 0
    total_users: Optional[int] = 0
    whatsapp_status: Optional[str] = "offline"

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
    five_mins_ago = now - datetime.timedelta(minutes=15)
    
    online_count = sum(1 for c in clients if c.last_heartbeat_at and c.last_heartbeat_at >= five_mins_ago)
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
async def create_client(payload: ClientCreateSchema, db: AsyncSession = Depends(get_central_db)):
    """Registers a new Client Server and generates their cryptographic license key."""
    t_code = payload.tenant_code.strip().lower().replace(" ", "-")
    existing = await db.execute(select(ClientServer).where(ClientServer.tenant_code == t_code))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail=f"'{t_code}' kodlu müşteri zaten veritabanında kayıtlı.")

    hw_id = payload.hardware_id.strip().upper() if payload.hardware_id else "UNBOUND"
    exp_date = payload.license_expires_at or "2026-12-31"
    gen_key = generate_signed_license_key(t_code, exp_date, hw_id)

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
        plan_tier=payload.plan_tier or "professional"
    )
    db.add(lic_log)
    await db.commit()

    return new_client

@app.put("/api/v1/clients/{client_id}")
async def update_client(client_id: int, payload: ClientCreateSchema, db: AsyncSession = Depends(get_central_db)):
    """Updates client status, package tier, expiration date, or regenerates license key."""
    res = await db.execute(select(ClientServer).where(ClientServer.id == client_id))
    client = res.scalars().first()
    if not client:
        raise HTTPException(status_code=404, detail="Müşteri kaydı bulunamadı.")

    client.company_name = payload.company_name.strip()
    client.status = payload.status or client.status
    client.plan_tier = payload.plan_tier or client.plan_tier
    client.license_expires_at = payload.license_expires_at or client.license_expires_at
    if payload.hardware_id:
        client.hardware_id = payload.hardware_id.strip().upper()

    hw_id = client.hardware_id or "UNBOUND"
    gen_key = generate_signed_license_key(client.tenant_code, client.license_expires_at, hw_id)
    client.current_license_key = gen_key

    await db.commit()
    await db.refresh(client)
    return client

@app.delete("/api/v1/clients/{client_id}")
async def delete_client(client_id: int, db: AsyncSession = Depends(get_central_db)):
    """Deletes client record from central database."""
    res = await db.execute(select(ClientServer).where(ClientServer.id == client_id))
    client = res.scalars().first()
    if not client:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı.")
        
    await db.delete(client)
    await db.commit()
    return {"success": True, "message": f"Müşteri #{client_id} silindi."}

# --------------------------------------------------------------------------
# License Key Generator Studio
# --------------------------------------------------------------------------
@app.post("/api/v1/licenses/generate")
async def generate_license(payload: LicenseGenerateSchema, db: AsyncSession = Depends(get_central_db)):
    """Generates a cryptographic machine-bound key and records it in history."""
    t_code = payload.tenant_code.strip().lower()
    hw_id = payload.hardware_id.strip().upper() if payload.hardware_id else "UNBOUND"
    exp_date = payload.expiry_date.strip()

    key = generate_signed_license_key(t_code, exp_date, hw_id)

    # Find matching client if available
    res = await db.execute(select(ClientServer).where(ClientServer.tenant_code == t_code))
    client = res.scalars().first()
    if client:
        client.current_license_key = key
        client.license_expires_at = exp_date
        client.hardware_id = hw_id
        client.status = "active"

        log = LicenseRecord(
            client_id=client.id,
            tenant_code=t_code,
            hardware_id=hw_id,
            license_key=key,
            expires_at=exp_date,
            plan_tier=payload.plan_tier or client.plan_tier
        )
        db.add(log)
        await db.commit()

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
    """Receives 10-minute status pings from client on-premise servers."""
    client_ip = request.client.host if request.client else None
    t_code = payload.tenant_code.strip().lower()

    res = await db.execute(select(ClientServer).where(ClientServer.tenant_code == t_code))
    client = res.scalars().first()

    if not client:
        # Auto-register unknown server ping
        client = ClientServer(
            company_name=f"Otomatik Kayıt ({t_code})",
            tenant_code=t_code,
            hardware_id=payload.hardware_id,
            ip_address=client_ip,
            status="active",
            current_license_key=payload.license_key,
            software_version=payload.software_version
        )
        db.add(client)
        await db.commit()
        await db.refresh(client)

    # Update Telemetry Metrics
    client.last_heartbeat_at = datetime.datetime.utcnow()
    client.ip_address = client_ip or client.ip_address
    client.hardware_id = payload.hardware_id or client.hardware_id
    client.cpu_usage_percent = payload.cpu_percent or 0.0
    client.ram_usage_percent = payload.memory_percent or 0.0
    client.active_calls_count = payload.active_calls or 0
    client.total_users_count = payload.total_users or 0
    client.whatsapp_status = payload.whatsapp_status or "offline"
    client.software_version = payload.software_version or client.software_version

    # Record Telemetry Log Entry
    t_log = TelemetryLog(
        client_id=client.id,
        tenant_code=t_code,
        hardware_id=payload.hardware_id,
        ip_address=client_ip,
        software_version=payload.software_version,
        cpu_percent=payload.cpu_percent,
        memory_percent=payload.memory_percent,
        active_calls=payload.active_calls,
        whatsapp_status=payload.whatsapp_status
    )
    db.add(t_log)
    await db.commit()

    # Determine response instructions
    remote_kill_switch = (client.status in ["suspended", "expired"])
    
    return {
        "status": "ok",
        "client_status": client.status,
        "remote_kill_switch": remote_kill_switch,
        "latest_license_key": client.current_license_key,
        "license_expires_at": client.license_expires_at,
        "message": "Heartbeat alındı."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("license_center.backend.main:app", host="0.0.0.0", port=8050, reload=True)
