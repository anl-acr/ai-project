import asyncio
import os
import sys
import json
import datetime
import httpx
import psutil
from backend.services.hardware_info import get_system_hardware_fingerprint
from backend.services.license_service import verify_license_key

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SETTINGS_FILE = os.path.join(BASE_DIR, "settings.json")
LICENSE_CENTER_URL = os.getenv("LICENSE_CENTER_URL", "http://localhost:8050/api/v1/telemetry/heartbeat")

def load_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_settings(data):
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"[Telemetry Worker] Save settings error: {e}")

async def start_telemetry_heartbeat_loop():
    """Background async worker that sends periodic server health & license heartbeat to Central License Master Console."""
    print("[Telemetry Worker] Central License Telemetry Loop Initialized (Interval: 10 mins).")
    
    # Wait 10 seconds after server startup before sending first ping
    await asyncio.sleep(10)
    
    while True:
        try:
            current_settings = load_settings()
            tenants = current_settings.get("tenants", [])
            primary_tenant = tenants[0] if tenants else {}
            
            t_code = primary_tenant.get("code") or "default"
            t_key = primary_tenant.get("license_key") or ""
            
            hw_info = get_system_hardware_fingerprint()
            hw_id = hw_info.get("hardware_id", "HW-UNKNOWN")
            
            # System CPU & RAM usage
            cpu_pct = psutil.cpu_percent(interval=1)
            mem = psutil.virtual_memory()
            mem_pct = mem.percent
            
            # Active call count fallback
            active_calls = 0
            try:
                from backend.services.ami_manager import active_channels
                active_calls = len(active_channels) if active_channels else 0
            except Exception:
                pass
                
            payload = {
                "tenant_code": t_code,
                "hardware_id": hw_id,
                "license_key": t_key,
                "software_version": "v2.4.8",
                "cpu_percent": round(cpu_pct, 1),
                "memory_percent": round(mem_pct, 1),
                "active_calls": active_calls,
                "total_users": len(current_settings.get("users", [])),
                "whatsapp_status": "connected" if current_settings.get("channels", {}).get("whatsapp_phone_number_id") else "offline"
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(LICENSE_CENTER_URL, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    
                    # Remote Kill-Switch Enforcement
                    if data.get("remote_kill_switch"):
                        print(f"[Telemetry Worker] REMOTE KILL-SWITCH RECEIVED! Tenant '{t_code}' suspended on Central Portal.")
                        if primary_tenant.get("status") != "passive":
                            primary_tenant["status"] = "passive"
                            save_settings(current_settings)
                            
                    # Remote License Auto-Renewal Enforcement
                    latest_key = data.get("latest_license_key")
                    latest_expiry = data.get("license_expires_at")
                    if latest_key and latest_key != t_key:
                        print(f"[Telemetry Worker] REMOTE LICENSE AUTO-RENEWAL RECEIVED! Updating key to: {latest_key}")
                        primary_tenant["license_key"] = latest_key
                        if latest_expiry:
                            primary_tenant["license_expires_at"] = latest_expiry
                        primary_tenant["status"] = "active"
                        save_settings(current_settings)
                        
        except Exception as e:
            # Silent fallback if Central Server is offline or air-gapped network
            pass

        # Sleep 10 minutes (600 seconds)
        await asyncio.sleep(600)
