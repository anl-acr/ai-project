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
    """Background async worker that sends periodic server health & license heartbeat for ALL tenants to Central License Master Console."""
    print("[Telemetry Worker] Central License Telemetry Loop Initialized (Interval: 10 mins).")
    
    # Wait 10 seconds after server startup before sending first ping
    await asyncio.sleep(10)
    
    while True:
        try:
            current_settings = load_settings()
            tenants = current_settings.get("tenants", [])
            if not tenants:
                tenants = [{"code": "default", "license_key": "", "status": "active"}]

            tenant_pings = []
            for t in tenants:
                tenant_pings.append({
                    "tenant_code": t.get("code") or "default",
                    "license_key": t.get("license_key") or "",
                    "status": t.get("status") or "active"
                })
            
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

            # Server Public WAN IP lookup with fast 2.0s timeout fallback
            public_ip = None
            try:
                ip_resp = httpx.get("https://api.ipify.org?format=json", timeout=2.0)
                if ip_resp.status_code == 200:
                    public_ip = ip_resp.json().get("ip")
            except Exception:
                pass
                
            payload = {
                "hardware_id": hw_id,
                "software_version": "v2.4.9",
                "cpu_percent": round(cpu_pct, 1),
                "memory_percent": round(mem_pct, 1),
                "active_calls": active_calls,
                "total_users": len(current_settings.get("users", [])),
                "whatsapp_status": "connected" if current_settings.get("channels", {}).get("whatsapp_phone_number_id") else "offline",
                "ip_address": public_ip,
                "public_ip": public_ip,
                "tenants": tenant_pings,
                # Legacy fallback fields for backwards compatibility:
                "tenant_code": tenant_pings[0]["tenant_code"],
                "license_key": tenant_pings[0]["license_key"]
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(LICENSE_CENTER_URL, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    tenants_resp = data.get("tenants_response", [])
                    
                    settings_changed = False
                    
                    for t_res in tenants_resp:
                        t_code = t_res.get("tenant_code")
                        # Find matching tenant in local settings
                        target_t = next((t for t in tenants if t.get("code") == t_code), None)
                        if not target_t:
                            continue
                            
                        # Remote Kill-Switch Enforcement per tenant
                        if t_res.get("remote_kill_switch"):
                            if target_t.get("status") != "passive":
                                print(f"[Telemetry Worker] REMOTE KILL-SWITCH RECEIVED! Tenant '{t_code}' suspended on Central Portal.")
                                target_t["status"] = "passive"
                                settings_changed = True
                                
                        # Remote Quota Update Enforcement per tenant
                        quotas = t_res.get("quotas") or t_res.get("custom_quotas")
                        if quotas and isinstance(quotas, dict):
                            for q_key, q_val in quotas.items():
                                if isinstance(q_val, (int, float)):
                                    if target_t.get(q_key) != int(q_val):
                                        target_t[q_key] = int(q_val)
                                        settings_changed = True

                        # Remote License Auto-Renewal Enforcement per tenant
                        latest_key = t_res.get("latest_license_key")
                        latest_expiry = t_res.get("license_expires_at")
                        if latest_key and latest_key != target_t.get("license_key"):
                            print(f"[Telemetry Worker] REMOTE LICENSE AUTO-RENEWAL RECEIVED! Tenant '{t_code}' updating key to: {latest_key}")
                            target_t["license_key"] = latest_key
                            if latest_expiry:
                                target_t["license_expires_at"] = latest_expiry
                            target_t["status"] = "active"
                            
                            # Check if latest_key has embedded Base64 quotas
                            v_key = verify_license_key(t_code, latest_key)
                            if v_key.get("custom_quotas") and isinstance(v_key["custom_quotas"], dict):
                                for q_k, q_v in v_key["custom_quotas"].items():
                                    if isinstance(q_v, (int, float)):
                                        target_t[q_k] = int(q_v)

                            settings_changed = True

                    if settings_changed:
                        current_settings["tenants"] = tenants
                        save_settings(current_settings)
                        
        except Exception as e:
            # Silent fallback if Central Server is offline or air-gapped network
            pass

        # Sleep 10 minutes (600 seconds)
        await asyncio.sleep(600)

