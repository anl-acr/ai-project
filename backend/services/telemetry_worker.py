import asyncio
import os
import re
import sys
import json
import datetime
import httpx
import psutil
from backend.services.hardware_info import get_system_hardware_fingerprint
from backend.services.license_service import verify_license_key, generate_tenant_serial_number

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SETTINGS_FILE = os.path.join(BASE_DIR, "settings.json")
LICENSE_CENTER_URL = os.getenv("LICENSE_CENTER_URL", "")
_VERSION_CACHE = {"mtime": 0.0, "version": ""}


def get_current_pbx_version() -> str:
    """Dynamically reads the live PBX version from backend/main.py get_system_version_info() so telemetry & tunnel never drift."""
    main_py = os.path.join(BASE_DIR, "main.py")
    try:
        st = os.stat(main_py)
        if _VERSION_CACHE["version"] and _VERSION_CACHE["mtime"] == st.st_mtime:
            return _VERSION_CACHE["version"]
        with open(main_py, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        idx = content.find("async def get_system_version_info")
        if idx != -1:
            snippet = content[idx : idx + 2000]
            m = re.search(r'"version"\s*:\s*"(v[0-9]+\.[0-9]+\.[0-9]+[^"]*)"', snippet)
            if m:
                ver = m.group(1).strip()
                _VERSION_CACHE["mtime"] = st.st_mtime
                _VERSION_CACHE["version"] = ver
                return ver
    except Exception:
        pass
    return _VERSION_CACHE["version"] or "v3.1.3"


def _resolve_heartbeat_url(current_settings: dict) -> str:
    if LICENSE_CENTER_URL:
        return LICENSE_CENTER_URL
    ras_cfg = current_settings.get("ras_config") if isinstance(current_settings, dict) else {}
    hub_raw = str((ras_cfg or {}).get("hub_url") or "").strip().rstrip("/")
    if hub_raw:
        if hub_raw.startswith("wss://"):
            hub_raw = "https://" + hub_raw[6:]
        elif hub_raw.startswith("ws://"):
            hub_raw = "http://" + hub_raw[5:]
        if not hub_raw.startswith(("http://", "https://")):
            # If IP address, use port 8050; if domain, use https
            host_part = hub_raw.split(":")[0]
            if all(p.isdigit() for p in host_part.split(".")) and ":" not in hub_raw:
                hub_raw = f"http://{hub_raw}:8050"
            else:
                hub_raw = f"https://{hub_raw}"
        return f"{hub_raw}/api/v1/telemetry/heartbeat"
    return "https://connect.nornia.com.tr/api/v1/telemetry/heartbeat"

def load_settings():
    try:
        from backend.main import load_settings as main_load_settings
        data = main_load_settings()
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_settings(data):
    try:
        from backend.main import save_settings as main_save_settings
        main_save_settings(data)
        return
    except Exception as e:
        print(f"[Telemetry Worker] Main save_settings fallback: {e}")
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"[Telemetry Worker] Save settings error: {e}")

_CACHED_PUBLIC_IP = None


async def _probe_local_tcp_port(port: int, timeout: float = 0.35) -> bool:
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection("127.0.0.1", port), timeout=timeout)
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        return True
    except Exception:
        return False


async def _collect_pbx_services_health() -> tuple:
    """Probes core local PBX services in parallel and returns (services_health_dict, failed_service_labels)."""
    ami_ok, audio_ok, pg5444_ok, pg5432_ok, ui_ok = await asyncio.gather(
        _probe_local_tcp_port(5038),
        _probe_local_tcp_port(9092),
        _probe_local_tcp_port(5444),
        _probe_local_tcp_port(5432),
        _probe_local_tcp_port(3000),
    )
    pg_ok = bool(pg5444_ok or pg5432_ok)
    health_map = {
        "asterisk_ami": bool(ami_ok),
        "audiosocket_ai": bool(audio_ok),
        "postgresql_db": bool(pg_ok),
        "frontend_ui": bool(ui_ok),
    }
    failed = []
    if not ami_ok:
        failed.append("Asterisk PBX (5038)")
    if not audio_ok:
        failed.append("AI AudioSocket (9092)")
    if not pg_ok:
        failed.append("PostgreSQL DB (5444)")
    if not ui_ok:
        failed.append("Web Arayüz (3000)")
    return health_map, failed


async def send_single_telemetry_heartbeat(override_tenants: list = None) -> bool:
    """Sends an immediate telemetry & tenant sync heartbeat to the Central License Server."""
    global _CACHED_PUBLIC_IP
    try:
        current_settings = load_settings()
        tenants = override_tenants if override_tenants is not None else current_settings.get("tenants", [])
        if not tenants:
            try:
                from backend.main import settings_db
                if isinstance(settings_db, dict) and settings_db.get("tenants"):
                    tenants = settings_db.get("tenants")
            except Exception:
                pass
        if not tenants:
            tenants = [{"code": "default", "license_key": "", "status": "active"}]

        hw_info = get_system_hardware_fingerprint()
        hw_id = hw_info.get("hardware_id", "HW-UNKNOWN")
        sys_serial = hw_info.get("system_serial_number", "")

        tenant_pings = []
        serial_assigned_locally = False
        for idx, t in enumerate(tenants):
            t_code_val = t.get("code") or (t.get("id", "default").replace("tenant-", "") if t.get("id") else "default")
            t_num_id = t.get("tenant_num_id") or (100 + idx)
            if not t.get("serial_number"):
                t["serial_number"] = generate_tenant_serial_number(t_code_val, t_num_id)
                serial_assigned_locally = True
            tenant_pings.append({
                "tenant_code": t_code_val,
                "company_name": t.get("name") or "",
                "tenant_num_id": t_num_id,
                "serial_number": t.get("serial_number"),
                "license_key": t.get("license_key") or "",
                "status": t.get("status") or "active"
            })
        if serial_assigned_locally:
            current_settings["tenants"] = tenants
            save_settings(current_settings)

        # System CPU, RAM, Disk & Core PBX Services Health (non-blocking)
        cpu_pct = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()
        mem_pct = mem.percent
        try:
            disk_pct = psutil.disk_usage("/").percent
        except Exception:
            disk_pct = 0.0
        try:
            services_health, failed_services = await _collect_pbx_services_health()
        except Exception:
            services_health, failed_services = {}, []

        # Active call count fallback
        active_calls = 0
        try:
            from backend.services.ami_manager import active_channels
            active_calls = len(active_channels) if active_channels else 0
        except Exception:
            pass

        # Server Public WAN IP lookup (cached after first lookup)
        if not _CACHED_PUBLIC_IP:
            try:
                async with httpx.AsyncClient(timeout=2.0) as ip_client:
                    ip_resp = await ip_client.get("https://api.ipify.org?format=json")
                    if ip_resp.status_code == 200:
                        _CACHED_PUBLIC_IP = ip_resp.json().get("ip")
            except Exception:
                pass

        payload = {
            "hardware_id": hw_id,
            "system_serial_number": sys_serial,
            "software_version": get_current_pbx_version(),
            "cpu_percent": round(cpu_pct, 1),
            "memory_percent": round(mem_pct, 1),
            "disk_percent": round(disk_pct, 1),
            "services_health": services_health,
            "failed_services": failed_services,
            "active_calls": active_calls,
            "total_users": len(current_settings.get("users", [])),
            "whatsapp_status": "connected" if current_settings.get("channels", {}).get("whatsapp_phone_number_id") else "offline",
            "ip_address": _CACHED_PUBLIC_IP,
            "public_ip": _CACHED_PUBLIC_IP,
            "tenants": tenant_pings,
            # Legacy fallback fields for backwards compatibility:
            "tenant_code": tenant_pings[0]["tenant_code"],
            "tenant_serial_number": tenant_pings[0]["serial_number"],
            "license_key": tenant_pings[0]["license_key"]
        }

        target_hb_url = _resolve_heartbeat_url(current_settings)
        async with httpx.AsyncClient(timeout=8.0, verify=False) as client:
            resp = await client.post(target_hb_url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                tenants_resp = data.get("tenants_response", [])

                settings_changed = False

                for t_res in tenants_resp:
                    t_code = str(t_res.get("tenant_code") or "").strip().lower()
                    remote_sn_match = str(t_res.get("serial_number") or t_res.get("tenant_serial_number") or "").strip().upper()
                    target_t = next(
                        (
                            t for t in tenants
                            if str(t.get("code") or (t.get("id", "").replace("tenant-", ""))).strip().lower() == t_code
                        ),
                        None
                    )
                    if not target_t and remote_sn_match:
                        target_t = next(
                            (t for t in tenants if str(t.get("serial_number") or "").strip().upper() == remote_sn_match),
                            None
                        )
                    if not target_t and len(tenants) == 1 and len(tenants_resp) == 1:
                        target_t = tenants[0]
                    if not target_t:
                        continue

                    remote_sn = t_res.get("serial_number") or t_res.get("tenant_serial_number")
                    if remote_sn and target_t.get("serial_number") != remote_sn:
                        target_t["serial_number"] = remote_sn
                        settings_changed = True

                    # Central SSH Master Switch Enforcement
                    if "remote_ssh_enabled" in t_res and t_res.get("remote_ssh_enabled") is not None:
                        try:
                            from backend.services.ras_client_service import apply_central_ssh_control
                            apply_central_ssh_control(bool(t_res.get("remote_ssh_enabled")))
                        except Exception:
                            pass

                    # Remote Kill-Switch / Re-Activation Enforcement per tenant
                    if t_res.get("remote_kill_switch"):
                        if target_t.get("status") != "passive" or not target_t.get("remotely_suspended"):
                            print(f"[Telemetry Worker] REMOTE KILL-SWITCH RECEIVED! Tenant '{t_code}' suspended on Central Portal.")
                            target_t["status"] = "passive"
                            target_t["remotely_suspended"] = True
                            settings_changed = True
                    else:
                        if target_t.get("remotely_suspended"):
                            target_t["remotely_suspended"] = False
                            settings_changed = True
                        if t_res.get("client_status") == "active" and target_t.get("status") == "passive":
                            print(f"[Telemetry Worker] REMOTE RE-ACTIVATION RECEIVED! Tenant '{t_code}' restored to active.")
                            target_t["status"] = "active"
                            settings_changed = True

                    # Remote Quota & Module Entitlement Update Enforcement per tenant
                    quotas = t_res.get("quotas") or t_res.get("custom_quotas")
                    if quotas and isinstance(quotas, dict):
                        for q_key, q_val in quotas.items():
                            if q_val is None:
                                if q_key == "license_grace_until" and target_t.get("license_grace_until"):
                                    target_t["license_grace_until"] = ""
                                    settings_changed = True
                                continue
                            if isinstance(q_val, bool):
                                if target_t.get(q_key) != q_val:
                                    target_t[q_key] = q_val
                                    settings_changed = True
                            elif isinstance(q_val, (int, float)):
                                if target_t.get(q_key) != int(q_val):
                                    target_t[q_key] = int(q_val)
                                    settings_changed = True
                            elif isinstance(q_val, list):
                                if target_t.get(q_key) != q_val:
                                    target_t[q_key] = q_val
                                    settings_changed = True
                            elif isinstance(q_val, str) and q_key in ("unlicensed_module_mode", "plan_tier", "license_expires_at", "license_grace_until"):
                                if target_t.get(q_key) != q_val:
                                    target_t[q_key] = q_val
                                    settings_changed = True

                        if "license_grace_until" not in quotas and target_t.get("license_grace_until"):
                            target_t["license_grace_until"] = ""
                            settings_changed = True

                        # Enforce Central Recording Retention Policy if configured (> 0)
                        enf_ret = int(quotas.get("enforced_retention_days") or 0)
                        if enf_ret > 0:
                            rec_cfg = current_settings.get("recording_retention", {})
                            if not isinstance(rec_cfg, dict):
                                rec_cfg = {}
                            if rec_cfg.get("retention_days") != enf_ret or rec_cfg.get("enforced_by_license") != True:
                                rec_cfg["retention_days"] = enf_ret
                                rec_cfg["enforced_by_license"] = True
                                current_settings["recording_retention"] = rec_cfg
                                settings_changed = True

                    # Sync expiry even when license key hasn't changed
                    latest_expiry = t_res.get("license_expires_at")
                    if latest_expiry and target_t.get("license_expires_at") != latest_expiry:
                        target_t["license_expires_at"] = latest_expiry
                        settings_changed = True

                    # Remote License Auto-Renewal Enforcement per tenant
                    latest_key = t_res.get("latest_license_key")
                    if latest_key and latest_key != target_t.get("license_key"):
                        print(f"[Telemetry Worker] REMOTE LICENSE AUTO-RENEWAL RECEIVED! Tenant '{t_code}' updating key.")
                        target_t["license_key"] = latest_key
                        if latest_expiry:
                            target_t["license_expires_at"] = latest_expiry
                        if not t_res.get("remote_kill_switch"):
                            target_t["status"] = "active"

                        # Check if latest_key has embedded Base64 quotas
                        v_key = verify_license_key(t_code, latest_key)
                        if v_key.get("custom_quotas") and isinstance(v_key["custom_quotas"], dict):
                            for q_k, q_v in v_key["custom_quotas"].items():
                                if q_v is None:
                                    if q_k == "license_grace_until":
                                        target_t["license_grace_until"] = ""
                                    continue
                                if isinstance(q_v, bool):
                                    target_t[q_k] = q_v
                                elif isinstance(q_v, (int, float)):
                                    target_t[q_k] = int(q_v)
                                elif isinstance(q_v, list):
                                    target_t[q_k] = q_v
                                elif isinstance(q_v, str) and q_k in ("unlicensed_module_mode", "plan_tier", "license_expires_at", "license_grace_until"):
                                    target_t[q_k] = q_v

                        settings_changed = True

                if settings_changed:
                    current_settings["tenants"] = tenants
                    save_settings(current_settings)
                    print(f"[Telemetry Worker] Central license & quota updates persisted to DB + settings.json ({len(tenants)} tenant(s)).")
                    try:
                        from backend.main import settings_db
                        if isinstance(settings_db, dict):
                            settings_db["tenants"] = tenants
                    except Exception:
                        pass
                return True
    except Exception as exc:
        print(f"[Telemetry Worker] Heartbeat sync warning: {exc}")
    return False


async def start_telemetry_heartbeat_loop():
    """Background async worker that sends periodic server health & license heartbeat for ALL tenants to Central License Master Console."""
    print("[Telemetry Worker] Central License Telemetry Loop Initialized (Interval: 60s + Real-Time Event Sync).")

    # Wait 5 seconds after server startup before sending first ping
    await asyncio.sleep(5)

    while True:
        await send_single_telemetry_heartbeat()
        # Sleep 60 seconds
        await asyncio.sleep(60)


