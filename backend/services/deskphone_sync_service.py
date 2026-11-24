"""
Nornia Bi-Directional Desk Phone DND & Call Forwarding Sync Service (Yealink-First)
===================================================================================
Masa telefonu (Yealink T3x/T4x/T5x vb.) ile Nornia Santral arasında DND (Rahatsız Etmeyin)
ve 3 kademeli Çağrı Yönlendirme (Her Zaman / Meşgul / Cevapsız) durumlarını çift yönlü
ve yeniden başlatma gerektirmeden (Zero-Reboot) senkronize eder.

Yön 1 — Masa Telefonu → Nornia Santral:
  - Yealink yerel menüsünden DND veya Yönlendirme açıldığında/kapatıldığında telefon:
      (a) `features.dnd.on_code / off_code` (*78 / *79) ve `forward.*.on_code / off_code`
          (*21*<hedef> / #21#, *67*<hedef> / #67#, *61*<hedef> / #61#) ile Asterisk'e
          tam hedef numarasını anında iletir.
      (b) Paralel `action_url.*` HTTP webhook'ları ile (`/api/prov/{token}/phone-sync`)
          anlık olay bildirimi yapar (HMAC-SHA256 imzalı).

Yön 2 — Nornia Santral → Masa Telefonu:
  - Web arayüzü, profil geçişi veya yönetici ekranından DND / Yönlendirme değiştiğinde:
      (a) Kullanıcının dinamik `.cfg` dosyası güncel `features.dnd.enable` ve `forward.*`
          değerleriyle sunulur (`sip.notify_reboot_enable = 0`).
      (b) Asterisk üzerinden telefona `Event: check-sync;reboot=false` SIP NOTIFY gönderilir.
      (c) Telefon yeniden başlamadan (~1-2 sn) ekranını günceller; kullanıcı isterse
          telefonun kendi tuşundan veya menüsünden iptal edebilir.
"""

import datetime
import hashlib
import hmac
import json
import threading
import time
import urllib.parse
from typing import Any, Dict, List, Optional

from backend.services.hardware_info import _load_serial_secret

_ECHO_GUARD_LOCK = threading.Lock()
_PHONE_ORIGIN_TS: Dict[str, float] = {}
ECHO_SUPPRESS_SECONDS = 8.0


def compute_phone_sync_token(ext: str, sip_username: str) -> str:
    """Computes a deterministic 16-char HMAC-SHA256 token for authenticating desk phone Action URL webhooks."""
    clean_ext = str(ext or "").strip()
    clean_su = str(sip_username or "").strip()
    msg = f"NORNIA_PHONE_SYNC:{clean_ext}:{clean_su}"
    return hmac.new(
        _load_serial_secret().encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:16].upper()


def verify_phone_sync_token(ext: str, sip_username: str, token: str) -> bool:
    provided = str(token or "").strip().upper()
    if not provided or len(provided) < 12:
        return False
    expected = compute_phone_sync_token(ext, sip_username)
    return hmac.compare_digest(provided, expected)


def _echo_key(ext: str, sip_username: str = "") -> str:
    return f"{str(ext or '').strip()}::{str(sip_username or '').strip().lower()}"


def record_phone_origin_change(ext: str, sip_username: str = "") -> None:
    """Marks a recent state update as originating from this specific desk phone so we do not echo check-sync back to it."""
    now_ts = time.time()
    with _ECHO_GUARD_LOCK:
        _PHONE_ORIGIN_TS[_echo_key(ext, sip_username)] = now_ts
        if not sip_username:
            _PHONE_ORIGIN_TS[_echo_key(ext, "*")] = now_ts
        # Prune stale entries
        if len(_PHONE_ORIGIN_TS) > 500:
            cutoff = now_ts - 60.0
            for k in [k for k, v in _PHONE_ORIGIN_TS.items() if v < cutoff]:
                _PHONE_ORIGIN_TS.pop(k, None)


def is_echo_suppressed(ext: str, sip_username: str = "") -> bool:
    now_ts = time.time()
    with _ECHO_GUARD_LOCK:
        t1 = _PHONE_ORIGIN_TS.get(_echo_key(ext, sip_username), 0.0)
        t2 = _PHONE_ORIGIN_TS.get(_echo_key(ext, "*"), 0.0)
        return (now_ts - max(t1, t2)) < ECHO_SUPPRESS_SECONDS


def _parse_fwd_obj(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, str) and raw.strip().startswith("{"):
        try:
            raw = json.loads(raw)
        except Exception:
            raw = None
    if not isinstance(raw, dict):
        return {"active": False, "type": "internal", "target": "", "timeout": 30}
    target = str(raw.get("target") or "").strip()
    active = bool(raw.get("active") and target)
    try:
        timeout = max(5, min(120, int(raw.get("timeout") or 30)))
    except Exception:
        timeout = 30
    return {
        "active": active,
        "type": "external" if raw.get("type") == "external" else "internal",
        "target": target,
        "timeout": timeout,
    }


def extract_user_live_phone_sync_state(user_dict: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Resolves the single-source-of-truth DND & 3-level Call Forwarding state for a user,
    honoring active profile overrides and explicit deskphoneSync flags.
    """
    if not isinstance(user_dict, dict):
        return {
            "dnd_enabled": False,
            "active_profile": "available",
            "fwd_always": {"active": False, "type": "internal", "target": ""},
            "fwd_busy": {"active": False, "type": "internal", "target": ""},
            "fwd_no_answer": {"active": False, "type": "internal", "target": "", "timeout": 30, "ring_count": 6},
            "last_sync_source": "",
            "last_sync_at": "",
        }

    act_prof_id = str(user_dict.get("active_profile") or "available").strip()
    raw_profiles = user_dict.get("profiles")
    if isinstance(raw_profiles, str):
        try:
            raw_profiles = json.loads(raw_profiles)
        except Exception:
            raw_profiles = []
    act_prof = None
    if isinstance(raw_profiles, list):
        act_prof = next((p for p in raw_profiles if isinstance(p, dict) and str(p.get("id")) == act_prof_id), None)

    prefs = user_dict.get("call_panel_prefs")
    if isinstance(prefs, str):
        try:
            prefs = json.loads(prefs)
        except Exception:
            prefs = {}
    if not isinstance(prefs, dict):
        prefs = {}
    dp_sync = prefs.get("deskphoneSync") if isinstance(prefs.get("deskphoneSync"), dict) else {}

    # DND is active if explicitly flagged by deskphoneSync OR active profile silences all devices (e.g. meeting/dnd)
    prof_devices = act_prof.get("devices") if isinstance(act_prof, dict) else None
    profile_is_dnd = (
        act_prof_id in ("dnd", "meeting")
        or (isinstance(prof_devices, list) and len(prof_devices) == 0)
    )
    dnd_enabled = bool(dp_sync.get("dnd_active", False) or profile_is_dnd)

    f_always_raw = (
        act_prof.get("forwarding_always")
        if (isinstance(act_prof, dict) and "forwarding_always" in act_prof)
        else user_dict.get("forwarding_always")
    )
    f_busy_raw = (
        act_prof.get("forwarding_busy")
        if (isinstance(act_prof, dict) and "forwarding_busy" in act_prof)
        else user_dict.get("forwarding_busy")
    )
    f_noans_raw = (
        act_prof.get("forwarding_no_answer")
        if (isinstance(act_prof, dict) and "forwarding_no_answer" in act_prof)
        else user_dict.get("forwarding_no_answer")
    )

    f_always = _parse_fwd_obj(f_always_raw)
    f_busy = _parse_fwd_obj(f_busy_raw)
    f_noans = _parse_fwd_obj(f_noans_raw)

    # Prefer active profile's timeout if present
    eff_timeout = f_noans["timeout"]
    if isinstance(act_prof, dict) and act_prof.get("timeout"):
        try:
            eff_timeout = max(5, min(120, int(act_prof.get("timeout"))))
        except Exception:
            pass
    # Yealink `forward.no_answer.timeout` is in ring count (1 ring ≈ 5-6 seconds, 0..20)
    ring_count = max(1, min(20, int(round(eff_timeout / 5.0))))
    f_noans["timeout"] = eff_timeout
    f_noans["ring_count"] = ring_count

    return {
        "dnd_enabled": dnd_enabled,
        "active_profile": act_prof_id,
        "fwd_always": f_always,
        "fwd_busy": f_busy,
        "fwd_no_answer": f_noans,
        "last_sync_source": str(dp_sync.get("last_sync_source") or ""),
        "last_sync_at": str(dp_sync.get("last_sync_at") or ""),
    }


def _derive_rule_cancel_code(prefix: str, default_cancel: str) -> str:
    """
    Derives a rule-specific cancel code without trailing '#' so Yealink's `# = Send` key
    never strips it and cancelling one rule (e.g. Always) never wipes other rules (Busy/No-Answer).
    Example: '*21*' -> '*21', '*67*' -> '*67', '*61*' -> '*61'.
    """
    core = str(prefix or "").strip().strip("*#")
    if core.isdigit():
        return f"*{core}"
    return default_cancel


def build_yealink_sync_cfg_lines(
    ext: str,
    sip_username: str,
    live_state: Optional[Dict[str, Any]] = None,
    sync_base_url: str = "",
    fwd_codes: Optional[Dict[str, str]] = None,
) -> List[str]:
    """
    Builds Yealink T3x/T4x/T5x provisioning config lines for full bi-directional DND & Call Forwarding sync:
      - Zero-reboot hot-sync (`sip.notify_reboot_enable = 0`)
      - Live DND + Always / Busy / No Answer Forward state displayed natively on Yealink LCD
      - Automatic SIP Feature Codes on phone menu toggle (*78/*79, *21*<num>/#21#, *67*<num>/#67#, *61*<num>/#61#)
      - Authenticated Action URL webhooks for instant HTTP telemetry & toggle notification
    """
    st = live_state if isinstance(live_state, dict) else extract_user_live_phone_sync_state(None)
    codes = fwd_codes if isinstance(fwd_codes, dict) else {}

    p_always = str(codes.get("always") or "*21*").strip() or "*21*"
    p_busy = str(codes.get("busy") or "*67*").strip() or "*67*"
    p_noans = str(codes.get("no_answer") or "*61*").strip() or "*61*"
    p_always_off = _derive_rule_cancel_code(p_always, "*21")
    p_busy_off = _derive_rule_cancel_code(p_busy, "*67")
    p_noans_off = _derive_rule_cancel_code(p_noans, "*61")

    f_alw = st.get("fwd_always") or {}
    f_bsy = st.get("fwd_busy") or {}
    f_noa = st.get("fwd_no_answer") or {}

    dnd_bit = 1 if st.get("dnd_enabled") else 0
    alw_bit = 1 if (f_alw.get("active") and f_alw.get("target")) else 0
    bsy_bit = 1 if (f_bsy.get("active") and f_bsy.get("target")) else 0
    noa_bit = 1 if (f_noa.get("active") and f_noa.get("target")) else 0
    noa_rings = max(1, min(20, int(f_noa.get("ring_count") or 6)))

    lines = [
        "",
        "# --- Nornia Cift Yonlu DND & Cagri Yonlendirme Senkronizasyonu (Yealink <-> Santral) ---",
        "sip.notify_reboot_enable = 0",
        "features.dnd.allow = 1",
        "features.dnd_mode = 0",
        f"features.dnd.enable = {dnd_bit}",
        "features.dnd.on_code = *78",
        "features.dnd.off_code = *79",
        "features.fwd.allow = 1",
        "features.fwd_mode = 0",
        f"forward.always.enable = {alw_bit}",
        f"forward.always.target = {f_alw.get('target') or ''}",
        f"forward.always.on_code = {p_always}",
        f"forward.always.off_code = {p_always_off}",
        f"forward.busy.enable = {bsy_bit}",
        f"forward.busy.target = {f_bsy.get('target') or ''}",
        f"forward.busy.on_code = {p_busy}",
        f"forward.busy.off_code = {p_busy_off}",
        f"forward.no_answer.enable = {noa_bit}",
        f"forward.no_answer.target = {f_noa.get('target') or ''}",
        f"forward.no_answer.timeout = {noa_rings}",
        f"forward.no_answer.on_code = {p_noans}",
        f"forward.no_answer.off_code = {p_noans_off}",
    ]

    clean_base = str(sync_base_url or "").strip().rstrip("/")
    if clean_base and ext and sip_username:
        sig_tok = compute_phone_sync_token(ext, sip_username)
        qs_common = urllib.parse.urlencode({"ext": str(ext).strip(), "su": str(sip_username).strip(), "sig": sig_tok})
        base_ep = f"{clean_base}?{qs_common}"
        lines.extend([
            "",
            "# --- Anlik Action URL Senkronizasyonu (Yealink -> Nornia Santral) ---",
            f"action_url.dnd_on = {base_ep}&event=dnd_on&mac=$mac&ip=$ip",
            f"action_url.dnd_off = {base_ep}&event=dnd_off&mac=$mac&ip=$ip",
            f"action_url.always_fwd_on = {base_ep}&event=fwd_always_on&mac=$mac&ip=$ip",
            f"action_url.always_fwd_off = {base_ep}&event=fwd_always_off&mac=$mac&ip=$ip",
            f"action_url.busy_fwd_on = {base_ep}&event=fwd_busy_on&mac=$mac&ip=$ip",
            f"action_url.busy_fwd_off = {base_ep}&event=fwd_busy_off&mac=$mac&ip=$ip",
            f"action_url.no_answer_fwd_on = {base_ep}&event=fwd_no_answer_on&mac=$mac&ip=$ip",
            f"action_url.no_answer_fwd_off = {base_ep}&event=fwd_no_answer_off&mac=$mac&ip=$ip",
        ])

    return lines


def collect_user_physical_deskphones(user_dict: Optional[Dict[str, Any]], settings_db: Optional[Dict[str, Any]]) -> List[Dict[str, str]]:
    """Returns deduplicated list of physical SIP desk phones ({sip_username, brand}) bound to a user's extension."""
    if not isinstance(user_dict, dict):
        return []
    ext_s = str(user_dict.get("extension") or "").strip()
    if not ext_s:
        return []

    found: List[Dict[str, str]] = []
    seen_su = set()

    # 1. From user.sip_devices
    try:
        from backend.services.autoprovision_service import normalize_user_sip_devices
        devs = normalize_user_sip_devices(user_dict, settings_db.get("autoprovision") if isinstance(settings_db, dict) else None)
    except Exception:
        devs = user_dict.get("sip_devices") if isinstance(user_dict.get("sip_devices"), list) else []

    for d in devs or []:
        if not isinstance(d, dict):
            continue
        su = str(d.get("sip_username") or "").strip()
        if not su or su in seen_su:
            continue
        # Only physical desk phones / DECT hardware (exclude web/mobile/desktop softphones & virtual subscribers)
        d_type = str(d.get("device_type") or d.get("type") or "desk_phone").strip().lower()
        d_brand = str(d.get("brand") or "").strip().lower()
        if d_type not in ("desk_phone", "dect", "ip_phone", "hardware", "") or d_brand in ("webrtc", "runa"):
            continue
        seen_su.add(su)
        found.append({
            "sip_username": su,
            "brand": str(d.get("brand") or "Yealink").strip() or "Yealink",
        })

    # 2. Fallback: autoprovision table entries matched by extension
    if isinstance(settings_db, dict):
        for ap in settings_db.get("autoprovision", []) or []:
            if not isinstance(ap, dict):
                continue
            ap_ext = str(ap.get("assigned_user") or ap.get("extension") or "").strip()
            if ap_ext != ext_s:
                continue
            su = str(ap.get("sip_username") or user_dict.get("sip_username") or "").strip()
            if su and su not in seen_su:
                seen_su.add(su)
                found.append({
                    "sip_username": su,
                    "brand": str(ap.get("brand") or "Yealink").strip() or "Yealink",
                })

    return found


def push_live_state_to_user_deskphones(
    user_dict: Optional[Dict[str, Any]],
    settings_db: Optional[Dict[str, Any]],
    exclude_sip_username: Optional[str] = None,
    reason_log: str = "Web / Santral Güncellemesi",
) -> int:
    """
    Non-blocking background Zero-Reboot SIP NOTIFY (`Event: check-sync;reboot=false`) push
    to all physical desk phones of the given user so their LCD screen immediately reflects
    new DND or Call Forwarding state.
    """
    if not isinstance(user_dict, dict):
        return 0
    ext_s = str(user_dict.get("extension") or "").strip()
    if not ext_s:
        return 0

    excl = str(exclude_sip_username or "").strip().lower()
    devices = collect_user_physical_deskphones(user_dict, settings_db)
    targets = []
    for d in devices:
        su = d["sip_username"]
        if excl and su.lower() == excl:
            continue
        if is_echo_suppressed(ext_s, su):
            continue
        targets.append(d)

    if not targets:
        return 0

    def _worker():
        try:
            from backend.services.autoprovision_service import trigger_phone_sip_notify
            for dev in targets:
                ok, msg = trigger_phone_sip_notify(dev["sip_username"], brand=dev["brand"], reboot=False)
                if ok:
                    print(
                        f"[DeskPhone Live Sync] Dahili {ext_s} ({dev['brand']} • {dev['sip_username']}) "
                        f"ekranı yeniden başlatmasız güncellendi ({reason_log})."
                    )
        except Exception as exc:
            print(f"[DeskPhone Live Sync Warning] {exc}")

    threading.Thread(target=_worker, daemon=True, name=f"deskphone-sync-{ext_s}").start()
    return len(targets)
