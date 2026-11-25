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
import html
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


def clear_phone_origin_change(ext: str) -> None:
    """Clears any active phone-origin echo guard when an explicit Web/Admin change overrides it."""
    prefix = f"{str(ext or '').strip()}::"
    with _ECHO_GUARD_LOCK:
        for k in [k for k in _PHONE_ORIGIN_TS if k.startswith(prefix)]:
            _PHONE_ORIGIN_TS.pop(k, None)


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

    alw_target_cfg = str(f_alw.get("target") or "").strip() if alw_bit else "%NULL%"
    bsy_target_cfg = str(f_bsy.get("target") or "").strip() if bsy_bit else "%NULL%"
    noa_target_cfg = str(f_noa.get("target") or "").strip() if noa_bit else "%NULL%"

    lines = [
        "",
        "# --- Nornia Cift Yonlu DND & Cagri Yonlendirme Senkronizasyonu (Yealink <-> Santral) ---",
        "sip.notify_reboot_enable = 0",
        "static.auto_provision.custom.protect = 0",
        "static.auto_provision.custom.sync = 0",
        "features.dnd.allow = 1",
        "features.dnd_mode = 0",
        f"features.dnd.enable = {dnd_bit}",
        "features.dnd.on_code = *78",
        "features.dnd.off_code = *79",
        f"account.1.dnd.enable = {dnd_bit}",
        "account.1.dnd.on_code = *78",
        "account.1.dnd.off_code = *79",
        "features.fwd.allow = 1",
        "features.fwd_mode = 0",
        f"forward.always.enable = {alw_bit}",
        f"forward.always.target = {alw_target_cfg}",
        f"forward.always.on_code = {p_always}",
        f"forward.always.off_code = {p_always_off}",
        f"forward.busy.enable = {bsy_bit}",
        f"forward.busy.target = {bsy_target_cfg}",
        f"forward.busy.on_code = {p_busy}",
        f"forward.busy.off_code = {p_busy_off}",
        f"forward.no_answer.enable = {noa_bit}",
        f"forward.no_answer.target = {noa_target_cfg}",
        f"forward.no_answer.timeout = {noa_rings}",
        f"forward.no_answer.on_code = {p_noans}",
        f"forward.no_answer.off_code = {p_noans_off}",
        f"account.1.always_fwd.enable = {alw_bit}",
        f"account.1.always_fwd.target = {alw_target_cfg}",
        f"account.1.always_fwd.on_code = {p_always}",
        f"account.1.always_fwd.off_code = {p_always_off}",
        f"account.1.busy_fwd.enable = {bsy_bit}",
        f"account.1.busy_fwd.target = {bsy_target_cfg}",
        f"account.1.busy_fwd.on_code = {p_busy}",
        f"account.1.busy_fwd.off_code = {p_busy_off}",
        f"account.1.timeout_fwd.enable = {noa_bit}",
        f"account.1.timeout_fwd.target = {noa_target_cfg}",
        f"account.1.timeout_fwd.timeout = {noa_rings}",
        f"account.1.timeout_fwd.on_code = {p_noans}",
        f"account.1.timeout_fwd.off_code = {p_noans_off}",
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


def build_grandstream_sync_xml_lines(
    ext: str,
    sip_username: str,
    live_state: Optional[Dict[str, Any]] = None,
    sync_base_url: str = "",
    fwd_codes: Optional[Dict[str, str]] = None,
) -> List[str]:
    """
    Builds Grandstream GXP21xx / GRP26xx XML (<config version="1">) P-code lines for
    bi-directional DND & 3-level Call Forwarding sync:
      - Zero-reboot SIP NOTIFY check-sync (`P194=1`, `P240=0`, `P4428=1`) + Local Call Features (`P191=1`)
      - Account 1 Feature Access Codes (`P2344`/`P2345` DND, `P26013`/`P26014` Always,
        `P26009`/`P26010` Busy, `P26011`/`P26012` No Answer, `P139` timeout)
      - Authenticated Action URLs (`P8316`..`P8319` + `P22164`..`P22169`)
    """
    st = live_state if isinstance(live_state, dict) else extract_user_live_phone_sync_state(None)
    codes = fwd_codes if isinstance(fwd_codes, dict) else {}

    p_always = str(codes.get("always") or "*21*").strip() or "*21*"
    p_busy = str(codes.get("busy") or "*67*").strip() or "*67*"
    p_noans = str(codes.get("no_answer") or "*61*").strip() or "*61*"
    p_always_off = _derive_rule_cancel_code(p_always, "*21")
    p_busy_off = _derive_rule_cancel_code(p_busy, "*67")
    p_noans_off = _derive_rule_cancel_code(p_noans, "*61")

    f_noa = st.get("fwd_no_answer") or {}
    noa_timeout = max(5, min(120, int(f_noa.get("timeout") or 30)))

    lines = [
        "    <!-- Nornia Cift Yonlu DND & Cagri Yonlendirme Senkronizasyonu (Grandstream <-> Santral) -->",
        "    <P191>1</P191>",
        f"    <P139>{noa_timeout}</P139>",
        "    <P2344>*78</P2344>",
        "    <P2345>*79</P2345>",
        f"    <P26013>{html.escape(p_always)}</P26013>",
        f"    <P26014>{html.escape(p_always_off)}</P26014>",
        f"    <P26009>{html.escape(p_busy)}</P26009>",
        f"    <P26010>{html.escape(p_busy_off)}</P26010>",
        f"    <P26011>{html.escape(p_noans)}</P26011>",
        f"    <P26012>{html.escape(p_noans_off)}</P26012>",
    ]

    clean_base = str(sync_base_url or "").strip().rstrip("/")
    if clean_base and ext and sip_username:
        sig_tok = compute_phone_sync_token(ext, sip_username)
        qs_common = urllib.parse.urlencode({"ext": str(ext).strip(), "su": str(sip_username).strip(), "sig": sig_tok})
        base_ep = f"{clean_base}?{qs_common}"

        def _gs_url(ev: str) -> str:
            return html.escape(f"{base_ep}&event={ev}&mac=$mac&ip=$phone_ip", quote=False)

        lines.extend([
            "    <!-- Anlik Action URL Senkronizasyonu (Grandstream -> Nornia Santral) -->",
            f"    <P8316>{_gs_url('dnd_on')}</P8316>",
            f"    <P8317>{_gs_url('dnd_off')}</P8317>",
            f"    <P8318>{_gs_url('fwd_always_on')}</P8318>",
            f"    <P8319>{_gs_url('fwd_all_off')}</P8319>",
            f"    <P22164>{_gs_url('fwd_always_on')}</P22164>",
            f"    <P22165>{_gs_url('fwd_always_off')}</P22165>",
            f"    <P22166>{_gs_url('fwd_busy_on')}</P22166>",
            f"    <P22167>{_gs_url('fwd_busy_off')}</P22167>",
            f"    <P22168>{_gs_url('fwd_no_answer_on')}</P22168>",
            f"    <P22169>{_gs_url('fwd_no_answer_off')}</P22169>",
        ])

    return lines


def format_grandstream_live_lcd_label(base_label: str, live_state: Optional[Dict[str, Any]]) -> str:
    """Appends compact live DND / Always-Forward status onto Grandstream Account 1 LCD label when active."""
    lbl = str(base_label or "").strip()
    if not isinstance(live_state, dict):
        return lbl
    f_alw = live_state.get("fwd_always") or {}
    if f_alw.get("active") and f_alw.get("target"):
        return f"{lbl} -> {f_alw['target']}"
    if live_state.get("dnd_enabled"):
        return f"{lbl} [DND]"
    return lbl


def build_fanvil_sync_sip_lines(
    live_state: Optional[Dict[str, Any]] = None,
    fwd_codes: Optional[Dict[str, str]] = None,
) -> List[str]:
    """
    Builds Fanvil X/V-Series `<SIP CONFIG MODULE>` Line 1 DND & 3-level Call Forwarding
    lines (live state + feature code synchronization).
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
    noa_timeout = max(5, min(120, int(f_noa.get("timeout") or 30)))

    alw_target = str(f_alw.get("target") or "").strip() if alw_bit else ""
    bsy_target = str(f_bsy.get("target") or "").strip() if bsy_bit else ""
    noa_target = str(f_noa.get("target") or "").strip() if noa_bit else ""

    # Legacy Fanvil single-type FWD indicator (0=Off, 1=Always, 2=Busy, 3=NoAnswer)
    legacy_fwd_type = 1 if alw_bit else (2 if bsy_bit else (3 if noa_bit else 0))
    legacy_fwd_num = alw_target or bsy_target or noa_target

    return [
        "# --- Nornia Cift Yonlu DND & Cagri Yonlendirme (Fanvil SIP1 <-> Santral) ---",
        f"SIP1 Enable DND      :{dnd_bit}",
        "SIP1 DND On Code     :*78",
        "SIP1 DND Off Code    :*79",
        "SIP1 Fwd Service     :1",
        f"SIP1 Fwd Always      :{alw_bit}",
        f"SIP1 Fwd Always Num  :{alw_target}",
        f"SIP1 Fwd Always On   :{p_always}",
        f"SIP1 Fwd Always Off  :{p_always_off}",
        f"SIP1 Fwd Busy        :{bsy_bit}",
        f"SIP1 Fwd Busy Num    :{bsy_target}",
        f"SIP1 Fwd Busy On     :{p_busy}",
        f"SIP1 Fwd Busy Off    :{p_busy_off}",
        f"SIP1 Fwd No Answer   :{noa_bit}",
        f"SIP1 Fwd No Ans Num  :{noa_target}",
        f"SIP1 Fwd Timer       :{noa_timeout}",
        f"SIP1 Fwd No Ans On   :{p_noans}",
        f"SIP1 Fwd No Ans Off  :{p_noans_off}",
        f"SIP1 FWD Type        :{legacy_fwd_type}",
        f"SIP1 FWD Number      :{legacy_fwd_num}",
    ]


def build_fanvil_sync_phone_lines(
    ext: str,
    sip_username: str,
    live_state: Optional[Dict[str, Any]] = None,
    sync_base_url: str = "",
) -> List[str]:
    """
    Builds Fanvil X/V-Series `<PHONE CONFIG MODULE>` DND mode + authenticated Action URL
    hooks for instant Fanvil -> Nornia PBX telemetry.
    """
    st = live_state if isinstance(live_state, dict) else extract_user_live_phone_sync_state(None)
    dnd_bit = 1 if st.get("dnd_enabled") else 0

    lines = [
        "DND Mode             :0",
        f"Default DND          :{dnd_bit}",
    ]

    clean_base = str(sync_base_url or "").strip().rstrip("/")
    if clean_base and ext and sip_username:
        sig_tok = compute_phone_sync_token(ext, sip_username)
        qs_common = urllib.parse.urlencode({"ext": str(ext).strip(), "su": str(sip_username).strip(), "sig": sig_tok})
        base_ep = f"{clean_base}?{qs_common}"
        lines.extend([
            "# --- Anlik Action URL Senkronizasyonu (Fanvil -> Nornia Santral) ---",
            f"DND On Url           :{base_ep}&event=dnd_on&mac=$mac&ip=$ip",
            f"DND Off Url          :{base_ep}&event=dnd_off&mac=$mac&ip=$ip",
            f"Always FWD On Url    :{base_ep}&event=fwd_always_on&mac=$mac&ip=$ip",
            f"Always FWD Off Url   :{base_ep}&event=fwd_always_off&mac=$mac&ip=$ip",
            f"Busy FWD On Url      :{base_ep}&event=fwd_busy_on&mac=$mac&ip=$ip",
            f"Busy FWD Off Url     :{base_ep}&event=fwd_busy_off&mac=$mac&ip=$ip",
            f"No Answer FWD On Url :{base_ep}&event=fwd_no_answer_on&mac=$mac&ip=$ip",
            f"No Answer FWD Off Url:{base_ep}&event=fwd_no_answer_off&mac=$mac&ip=$ip",
        ])

    return lines


def collect_user_physical_deskphones(user_dict: Optional[Dict[str, Any]], settings_db: Optional[Dict[str, Any]]) -> List[Dict[str, str]]:
    """Returns deduplicated list of physical SIP desk phones ({sip_username, brand}) bound to a user's extension."""
    if not isinstance(user_dict, dict):
        return []
    ext_s = str(user_dict.get("extension") or "").strip()
    uid_s = str(user_dict.get("id") or "").strip()
    if not ext_s:
        return []

    found: List[Dict[str, str]] = []
    seen_su = set()

    # 1. From user.sip_devices (passing BOTH autoprovision & user_deskphone_configs)
    try:
        from backend.services.autoprovision_service import normalize_user_sip_devices
        devs = normalize_user_sip_devices(
            user_dict,
            settings_db.get("autoprovision") if isinstance(settings_db, dict) else None,
            settings_db.get("user_deskphone_configs") if isinstance(settings_db, dict) else None,
        )
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

    # 2. Fallback: autoprovision table entries matched by extension OR user.id
    match_keys = {k for k in (ext_s, uid_s) if k}
    if isinstance(settings_db, dict):
        for ap in settings_db.get("autoprovision", []) or []:
            if not isinstance(ap, dict):
                continue
            ap_ext = str(ap.get("assigned_user") or ap.get("extension") or "").strip()
            if ap_ext not in match_keys:
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
    respect_echo_guard: bool = False,
) -> int:
    """
    Non-blocking background Zero-Reboot SIP NOTIFY (`Event: check-sync;reboot=false`) push
    to all physical desk phones of the given user so their LCD screen immediately reflects
    new DND or Call Forwarding state.

    `respect_echo_guard=False` (default): Explicit Web / Admin / API updates ALWAYS push
    immediately (even within seconds of a phone-originated change) and clear stale echo guards.
    `respect_echo_guard=True`: Used only when fanning out a phone-originated event to peer phones.
    """
    if not isinstance(user_dict, dict):
        return 0
    ext_s = str(user_dict.get("extension") or "").strip()
    if not ext_s:
        return 0

    if not respect_echo_guard:
        clear_phone_origin_change(ext_s)

    excl = str(exclude_sip_username or "").strip().lower()
    devices = collect_user_physical_deskphones(user_dict, settings_db)
    targets = []
    for d in devices:
        su = d["sip_username"]
        if excl and su.lower() == excl:
            continue
        if respect_echo_guard and is_echo_suppressed(ext_s, su):
            continue
        targets.append(d)

    if not targets:
        if not excl:
            print(f"[DeskPhone Live Sync] Dahili {ext_s} için bildirilecek fiziksel masa telefonu bulunamadı ({reason_log}).")
        return 0

    def _worker():
        try:
            import os
            import subprocess
            from backend.services.autoprovision_service import (
                ensure_pjsip_notify_conf,
                trigger_phone_sip_notify,
            )
            ast_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "asterisk_config")
            ensure_pjsip_notify_conf(ast_dir)

            for dev in targets:
                ok, msg = trigger_phone_sip_notify(dev["sip_username"], brand=dev["brand"], reboot=False)
                if not ok and ("Unable to find notify" in str(msg) or "not found" in str(msg).lower()):
                    try:
                        subprocess.run(
                            ["asterisk", "-rx", "module reload res_pjsip_notify.so"],
                            capture_output=True,
                            text=True,
                            timeout=2.0,
                            check=False,
                        )
                        ok, msg = trigger_phone_sip_notify(dev["sip_username"], brand=dev["brand"], reboot=False)
                    except Exception:
                        pass
                if ok:
                    print(
                        f"[DeskPhone Live Sync] Dahili {ext_s} ({dev['brand']} • {dev['sip_username']}) "
                        f"ekranı yeniden başlatmasız güncellendi ({reason_log})."
                    )
                else:
                    print(
                        f"[DeskPhone Live Sync FAILED] Dahili {ext_s} ({dev['brand']} • {dev['sip_username']}) "
                        f"SIP NOTIFY gönderilemedi ({reason_log}): {msg}"
                    )
        except Exception as exc:
            print(f"[DeskPhone Live Sync Warning] {exc}")

    threading.Thread(target=_worker, daemon=True, name=f"deskphone-sync-{ext_s}").start()
    return len(targets)
