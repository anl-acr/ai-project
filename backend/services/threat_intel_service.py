"""
Nornia Collective Threat Intelligence Service (Kolektif Tehdit Kalkanı)
=======================================================================
Bir santralin engellediği saldırgan IP adreslerini anında Merkez Panel'e
(panel.nornia.com.tr / connect.nornia.com.tr) bildirir ve diğer santrallerden
gelen doğrulanmış küresel saldırgan IP'lerini yerel güvenlik duvarında
(iptables raw PREROUTING + INPUT + UFW + Fail2Ban) proaktif olarak engeller.

Güvenlik Korumaları:
  - Özel ağlar (RFC1918), loopback, CGNAT, link-local ve geniş CIDR blokları ASLA paylaşılmaz/uygulanmaz.
  - Yerel Beyaz Liste (security_whitelisted_ips), kayıtlı SIP Trunk'lar ve aktif dahili IP'leri ASLA engellenmez.
  - Yankı döngüsü koruması: `nornia-global-shield` kaynağından gelen engeller tekrar Panele raporlanmaz.
  - Global iptal (unban) yalnızca `nornia-global-shield` ile eklenen kuralları kaldırır; yerel engellere dokunmaz.
"""

import datetime
import ipaddress
import os
import threading
import time
from typing import Any, Callable, Dict, List, Optional

import httpx

GLOBAL_SHIELD_JAIL = "nornia-global-shield"

_REPORTED_IP_TS: Dict[str, float] = {}
_SYNC_LOCK = threading.Lock()

THREAT_INTEL_RUNTIME_STATE: Dict[str, Any] = {
    "panel_enabled": True,
    "ttl_days": 7,
    "last_sync_at": None,
    "last_report_at": None,
    "last_push_at": None,
    "reported_session_count": 0,
    "applied_session_count": 0,
    "revoked_session_count": 0,
}


def is_shareable_public_ip(ip_str: str) -> Optional[str]:
    """Returns canonical public IPv4/IPv6 string if globally routable single host IP, else None."""
    raw = str(ip_str or "").strip()
    if not raw:
        return None
    if "/" in raw:
        parts = raw.split("/", 1)
        if parts[1] not in ("32", "128"):
            return None
        raw = parts[0].strip()
    try:
        ip_obj = ipaddress.ip_address(raw)
    except Exception:
        return None
    if (
        ip_obj.is_private
        or ip_obj.is_loopback
        or ip_obj.is_link_local
        or ip_obj.is_multicast
        or ip_obj.is_reserved
        or ip_obj.is_unspecified
    ):
        return None
    if ip_obj.version == 4 and ip_obj in ipaddress.ip_network("100.64.0.0/10"):
        return None
    return str(ip_obj)


def get_collective_shield_config(settings_dict: Optional[Dict[str, Any]]) -> Dict[str, bool]:
    adv = (settings_dict or {}).get("security_advanced")
    if not isinstance(adv, dict):
        adv = {}
    master_on = bool(adv.get("collective_shield_enabled", True))
    return {
        "enabled": master_on,
        "report_enabled": master_on and bool(adv.get("collective_shield_report_enabled", True)),
        "apply_enabled": master_on and bool(adv.get("collective_shield_apply_enabled", True)),
    }


def resolve_panel_base_url(current_settings: Optional[Dict[str, Any]]) -> str:
    env_url = os.getenv("LICENSE_CENTER_URL", "").strip()
    if env_url:
        # Strip known telemetry suffix if full heartbeat URL was set in env
        if "/api/v1/" in env_url:
            return env_url.split("/api/v1/", 1)[0].rstrip("/")
        return env_url.rstrip("/")

    ras_cfg = (current_settings or {}).get("ras_config") if isinstance(current_settings, dict) else {}
    hub_raw = str((ras_cfg or {}).get("hub_url") or "").strip().rstrip("/")
    if hub_raw:
        if hub_raw.startswith("wss://"):
            hub_raw = "https://" + hub_raw[6:]
        elif hub_raw.startswith("ws://"):
            hub_raw = "http://" + hub_raw[5:]
        if not hub_raw.startswith(("http://", "https://")):
            host_part = hub_raw.split(":")[0]
            if all(p.isdigit() for p in host_part.split(".")) and ":" not in hub_raw:
                hub_raw = f"http://{hub_raw}:8050"
            else:
                hub_raw = f"https://{hub_raw}"
        return hub_raw.rstrip("/")
    return "https://connect.nornia.com.tr"


def report_local_ban_nonblocking(
    ip_str: str,
    jail: str,
    reason: str,
    is_manual: bool = False,
    settings_dict: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Fires a lightweight background thread to immediately notify the Central Panel when this PBX
    bans an attacker IP, enabling <1s fleet-wide protection via Panel WebSocket broadcast.
    """
    if str(jail or "").strip().lower() == GLOBAL_SHIELD_JAIL:
        return

    ip_clean = is_shareable_public_ip(ip_str)
    if not ip_clean:
        return

    cfg = get_collective_shield_config(settings_dict)
    if not cfg["report_enabled"]:
        return

    now_ts = time.time()
    prev_ts = _REPORTED_IP_TS.get(ip_clean, 0.0)
    if now_ts - prev_ts < 600:
        return
    _REPORTED_IP_TS[ip_clean] = now_ts

    # Cap dedupe map memory cleanly
    if len(_REPORTED_IP_TS) > 2000:
        cutoff = now_ts - 600
        for k in [k for k, v in _REPORTED_IP_TS.items() if v < cutoff]:
            _REPORTED_IP_TS.pop(k, None)

    def _worker():
        try:
            from backend.services.hardware_info import get_system_hardware_fingerprint

            cur_settings = settings_dict
            if cur_settings is None:
                try:
                    from backend.services.telemetry_worker import load_settings
                    cur_settings = load_settings()
                except Exception:
                    cur_settings = {}

            hw_info = get_system_hardware_fingerprint()
            hw_id = hw_info.get("hardware_id", "HW-UNKNOWN")
            sys_sn = hw_info.get("system_serial_number", "")
            tenants = (cur_settings or {}).get("tenants", [])
            primary_t = tenants[0] if isinstance(tenants, list) and tenants else {}
            t_code = (
                primary_t.get("code")
                or str(primary_t.get("id") or "default").replace("tenant-", "")
                or "default"
            )
            lic_key = primary_t.get("license_key") or ""

            base_url = resolve_panel_base_url(cur_settings)
            report_url = f"{base_url}/api/v1/security/threat-intel/report"
            verify_tls = os.getenv("NORNIA_ALLOW_INSECURE_TLS", "0") != "1"

            body = {
                "hardware_id": hw_id,
                "system_serial_number": sys_sn,
                "tenant_code": t_code,
                "license_key": lic_key,
                "bans": [
                    {
                        "ip": ip_clean,
                        "jail": str(jail or "asterisk-pjsip")[:64],
                        "reason": str(reason or "SIP Brute-Force / Yetkisiz Deneme")[:220],
                        "is_manual": bool(is_manual),
                        "banned_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    }
                ],
            }

            with httpx.Client(timeout=4.5, verify=verify_tls) as client:
                resp = client.post(report_url, json=body)
                if resp.status_code == 200:
                    data = resp.json()
                    THREAT_INTEL_RUNTIME_STATE["last_report_at"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    THREAT_INTEL_RUNTIME_STATE["reported_session_count"] = (
                        int(THREAT_INTEL_RUNTIME_STATE.get("reported_session_count") or 0) + 1
                    )
                    pushed = int(data.get("pushed_pbx_count") or 0)
                    if data.get("accepted_count"):
                        print(
                            f"[Collective Shield] Saldırgan IP ({ip_clean}) Merkez Panel'e bildirildi "
                            f"(anlık iletilen santral: {pushed})."
                        )
        except Exception:
            # Silent non-blocking fallback — heartbeat will also carry this IP on the next 60s tick
            pass

    threading.Thread(target=_worker, daemon=True, name=f"threat-report-{ip_clean}").start()


def collect_local_banned_ips_for_heartbeat(
    settings_dict: Optional[Dict[str, Any]],
    external_blocked_map: Optional[Dict[str, Any]] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """
    Collects local non-global-shield public banned IPs (including Fail2Ban/UFW native bans)
    to attach to the periodic telemetry heartbeat so Panel stays 100% in sync.
    """
    cfg = get_collective_shield_config(settings_dict)
    if not cfg["report_enabled"]:
        return []

    collected: List[Dict[str, Any]] = []
    seen = set()

    blocked_list = (settings_dict or {}).get("security_blocked_ips", [])
    if isinstance(blocked_list, list):
        for item in blocked_list:
            if not isinstance(item, dict):
                continue
            jail = str(item.get("jail") or "asterisk-pjsip").strip()
            if jail.lower() == GLOBAL_SHIELD_JAIL:
                continue
            ip_clean = is_shareable_public_ip(item.get("ip") or "")
            if not ip_clean or ip_clean in seen:
                continue
            seen.add(ip_clean)
            reason = str(item.get("reason") or "SIP Brute-Force / Yetkisiz Deneme").strip()[:220]
            is_manual = ("manual" in jail.lower()) or ("manuel" in reason.lower())
            collected.append(
                {
                    "ip": ip_clean,
                    "jail": jail[:64],
                    "reason": reason,
                    "is_manual": is_manual,
                    "banned_at": str(item.get("banned_at") or ""),
                }
            )
            if len(collected) >= limit:
                return collected

    if isinstance(external_blocked_map, dict):
        for ext_ip, info in external_blocked_map.items():
            if len(collected) >= limit:
                break
            ip_clean = is_shareable_public_ip(ext_ip)
            if not ip_clean or ip_clean in seen:
                continue
            jail = str((info or {}).get("jail") or "fail2ban").strip() if isinstance(info, dict) else "fail2ban"
            if jail.lower() == GLOBAL_SHIELD_JAIL:
                continue
            seen.add(ip_clean)
            reason = (
                str((info or {}).get("reason") or "Fail2Ban Otomatik Engelleme").strip()[:220]
                if isinstance(info, dict)
                else "Fail2Ban Otomatik Engelleme"
            )
            collected.append(
                {
                    "ip": ip_clean,
                    "jail": jail[:64],
                    "reason": reason,
                    "is_manual": False,
                    "banned_at": str((info or {}).get("banned_at") or "") if isinstance(info, dict) else "",
                }
            )

    return collected


def apply_global_threat_intel(
    active_bans: Optional[List[Dict[str, Any]]],
    revoked_ips: Optional[List[str]],
    settings_dict: Dict[str, Any],
    execute_ban_fn: Callable,
    execute_unban_fn: Callable,
    is_trusted_fn: Callable[[str], bool],
    save_settings_fn: Callable[[Dict[str, Any]], Any],
    panel_enabled: bool = True,
    ttl_days: int = 7,
    via_realtime_push: bool = False,
) -> Dict[str, int]:
    """
    Applies fleet-wide threat bans & revocations locally while strictly honoring local whitelists
    and active SIP endpoints. Batch-persists settings once if anything changed.
    """
    with _SYNC_LOCK:
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        THREAT_INTEL_RUNTIME_STATE["panel_enabled"] = bool(panel_enabled)
        THREAT_INTEL_RUNTIME_STATE["ttl_days"] = int(ttl_days or 7)
        THREAT_INTEL_RUNTIME_STATE["last_sync_at"] = now_str
        if via_realtime_push:
            THREAT_INTEL_RUNTIME_STATE["last_push_at"] = now_str

        cfg = get_collective_shield_config(settings_dict)
        if not panel_enabled or not cfg["apply_enabled"]:
            return {"applied": 0, "revoked": 0, "skipped": 0}

        blocked_list = settings_dict.setdefault("security_blocked_ips", [])
        existing_map = {
            str(item.get("ip") or "").strip(): item
            for item in blocked_list
            if isinstance(item, dict) and item.get("ip")
        }

        applied = 0
        revoked = 0
        skipped = 0
        changed = False

        # 1. Apply global active bans
        for entry in (active_bans or []):
            if not isinstance(entry, dict):
                continue
            ip_clean = is_shareable_public_ip(entry.get("ip") or entry.get("ip_address") or "")
            if not ip_clean:
                skipped += 1
                continue
            if is_trusted_fn(ip_clean):
                skipped += 1
                continue

            if ip_clean in existing_map:
                # Already blocked locally (either natively or via global shield); ensure kernel drop is active
                continue

            src_pbx = str(entry.get("first_reported_by") or "Nornia Ağı").strip()
            raw_reason = str(entry.get("reason") or "SIP Brute-Force / Yetkisiz Deneme").strip()
            rep_cnt = int(entry.get("reporting_pbx_count") or 1)
            prefix = f"Kolektif Kalkan ({rep_cnt} santral • {src_pbx})" if rep_cnt > 1 else f"Kolektif Kalkan ({src_pbx})"
            full_reason = f"{prefix}: {raw_reason}"[:240]

            ok = execute_ban_fn(
                ip_clean,
                jail=GLOBAL_SHIELD_JAIL,
                reason=full_reason,
                force_manual=False,
                save_now=False,
                propagate_global=False,
            )
            if ok:
                existing_map[ip_clean] = {"ip": ip_clean, "jail": GLOBAL_SHIELD_JAIL}
                applied += 1
                changed = True

        # 2. Unban globally revoked IPs (ONLY if banned by global shield, never touch local admin bans)
        for raw_rev in (revoked_ips or []):
            ip_clean = is_shareable_public_ip(raw_rev)
            if not ip_clean:
                continue
            cur = existing_map.get(ip_clean)
            if cur and str(cur.get("jail") or "").strip().lower() == GLOBAL_SHIELD_JAIL:
                if execute_unban_fn(ip_clean, add_to_whitelist=False):
                    existing_map.pop(ip_clean, None)
                    revoked += 1
                    changed = True

        if changed:
            save_settings_fn(settings_dict)
            THREAT_INTEL_RUNTIME_STATE["applied_session_count"] = (
                int(THREAT_INTEL_RUNTIME_STATE.get("applied_session_count") or 0) + applied
            )
            THREAT_INTEL_RUNTIME_STATE["revoked_session_count"] = (
                int(THREAT_INTEL_RUNTIME_STATE.get("revoked_session_count") or 0) + revoked
            )
            mode_lbl = "Anlık Push" if via_realtime_push else "Heartbeat"
            print(
                f"[Collective Shield • {mode_lbl}] Senkronizasyon tamamlandı: "
                f"+{applied} proaktif global engel, -{revoked} iptal, {skipped} yerel beyaz liste/atlanan."
            )

        return {"applied": applied, "revoked": revoked, "skipped": skipped}


def get_collective_shield_status_summary(settings_dict: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    cfg = get_collective_shield_config(settings_dict)
    blocked_list = (settings_dict or {}).get("security_blocked_ips", [])
    global_blocked_count = 0
    if isinstance(blocked_list, list):
        for item in blocked_list:
            if isinstance(item, dict) and str(item.get("jail") or "").strip().lower() == GLOBAL_SHIELD_JAIL:
                global_blocked_count += 1
    return {
        "enabled": cfg["enabled"],
        "report_enabled": cfg["report_enabled"],
        "apply_enabled": cfg["apply_enabled"],
        "panel_enabled": bool(THREAT_INTEL_RUNTIME_STATE.get("panel_enabled", True)),
        "ttl_days": int(THREAT_INTEL_RUNTIME_STATE.get("ttl_days") or 7),
        "global_blocked_count": global_blocked_count,
        "reported_session_count": int(THREAT_INTEL_RUNTIME_STATE.get("reported_session_count") or 0),
        "applied_session_count": int(THREAT_INTEL_RUNTIME_STATE.get("applied_session_count") or 0),
        "last_sync_at": THREAT_INTEL_RUNTIME_STATE.get("last_sync_at"),
        "last_report_at": THREAT_INTEL_RUNTIME_STATE.get("last_report_at"),
        "last_push_at": THREAT_INTEL_RUNTIME_STATE.get("last_push_at"),
    }
