import hashlib
import html
import os
import re
import secrets
import subprocess
from typing import Any, Dict, List, Optional, Tuple

VENDOR_OUI_MAP: Dict[str, str] = {
    "00:15:65": "Yealink",
    "80:5e:c0": "Yealink",
    "80:5e:0c": "Yealink",
    "24:9a:d8": "Yealink",
    "c4:fc:e4": "Yealink",
    "00:0b:82": "Grandstream",
    "c0:74:ad": "Grandstream",
    "ec:74:d7": "Grandstream",
    "0c:38:3e": "Fanvil",
    "00:a8:59": "Fanvil",
    "d0:7a:b5": "Fanvil",
    "00:04:13": "Snom",
    "00:08:5d": "Aastra",
    "00:0e:08": "Cisco",
    "68:bc:0c": "Cisco",
    "00:1b:d4": "Cisco",
    "7c:2f:80": "Gigaset",
}

SUPPORTED_PHONE_MODELS: Dict[str, List[str]] = {
    "Yealink": ["T31P", "T31G", "T33G", "T43U", "T46U", "T48U", "T54W", "T58W"],
    "Fanvil": ["X3U", "X4U", "X5U", "X6U", "V62", "V64", "V65"],
    "Grandstream": ["GRP2602", "GRP2612", "GRP2614", "GXP1625", "GXP2140", "GXP2170"],
    "Snom": ["D315", "D385", "D717", "D735", "D785"],
}


def resolve_user_sip_username(ext_val: Any, raw_sip_user: Any = "") -> str:
    """
    Returns a clean, deterministic PJSIP endpoint identifier for physical IP phones / SIP clients.
    - Uses user's configured `sip_username` (Kullanıcı Ayarları > SIP > Kullanıcı Adı) when valid and non-numeric.
    - Otherwise derives a stable 8-character alphanumeric SIP username from `ext_val` so it never changes randomly across restarts
      and never exposes numeric extension numbers in Asterisk PJSIP.
    """
    ext_s = str(ext_val or "").strip()
    cand = re.sub(r"[^a-zA-Z0-9_.-]", "", str(raw_sip_user or "").strip())
    if cand and cand != ext_s and not cand.isdigit():
        return cand
    seed = f"AIDA_SIP_USER_V1_{ext_s or '1000'}"
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    alpha_up = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    alpha_lo = "abcdefghijkmnopqrstuvwxyz"
    digits = "23456789"
    b = bytes.fromhex(digest[:16])
    chars = [
        alpha_up[b[0] % len(alpha_up)],
        alpha_lo[b[1] % len(alpha_lo)],
        digits[b[2] % len(digits)],
        alpha_up[b[3] % len(alpha_up)],
        alpha_lo[b[4] % len(alpha_lo)],
        digits[b[5] % len(digits)],
        alpha_up[b[6] % len(alpha_up)],
        digits[b[7] % len(digits)],
    ]
    return "".join(chars)


def resolve_user_webphone_sip_username(ext_val: Any, raw_web_sip_user: Any = "") -> str:
    """
    Returns a clean, deterministic alphanumeric PJSIP endpoint identifier for the browser WebRTC phone (`web_phone`).
    Never returns a numeric extension so Asterisk `pjsip show endpoints` contains zero extension numbers.
    """
    ext_s = str(ext_val or "").strip()
    cand = re.sub(r"[^a-zA-Z0-9_.-]", "", str(raw_web_sip_user or "").strip())
    if cand and cand != ext_s and not cand.isdigit():
        return cand
    seed = f"AIDA_WEBPHONE_SIP_V1_{ext_s or '1000'}"
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    alpha_up = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    alpha_lo = "abcdefghijkmnopqrstuvwxyz"
    digits = "23456789"
    b = bytes.fromhex(digest[:16])
    chars = [
        "W",
        alpha_lo[b[1] % len(alpha_lo)],
        digits[b[2] % len(digits)],
        alpha_up[b[3] % len(alpha_up)],
        alpha_lo[b[4] % len(alpha_lo)],
        digits[b[5] % len(digits)],
        alpha_up[b[6] % len(alpha_up)],
        digits[b[7] % len(digits)],
    ]
    return "".join(chars)


def generate_random_sip_device_username(ext_val: Any = "", index: int = 1) -> str:
    """Generates a unique 8-char alphanumeric SIP username for additional SIP devices."""
    alpha_up = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    alpha_lo = "abcdefghijkmnopqrstuvwxyz"
    digits = "23456789"
    pool = alpha_up + alpha_lo + digits
    chars = [
        secrets.choice(alpha_up),
        secrets.choice(alpha_lo),
        secrets.choice(digits),
    ] + [secrets.choice(pool) for _ in range(5)]
    return "".join(chars)


def normalize_user_sip_devices(
    user_dict: Dict[str, Any],
    autoprovision_list: Optional[List[Dict[str, Any]]] = None,
    deskphone_configs: Optional[Dict[str, Any]] = None,
    fallback_password_fn=None,
) -> List[Dict[str, Any]]:
    """
    Ensures every subscriber has a normalized `sip_devices` list (with at least 1 default SIP device
    migrated seamlessly from legacy `sip_username` / `sip_password` / `autoprovision` / `user_deskphone_configs`).
    """
    import json as _json_mod

    ext_s = str(user_dict.get("extension") or "").strip()
    uid_s = str(user_dict.get("id") or "").strip()
    raw_devices = user_dict.get("sip_devices")
    if isinstance(raw_devices, str):
        try:
            raw_devices = _json_mod.loads(raw_devices)
        except Exception:
            raw_devices = None

    ap_list = autoprovision_list if isinstance(autoprovision_list, list) else []
    dp_cfgs = deskphone_configs if isinstance(deskphone_configs, dict) else {}
    legacy_dp = dp_cfgs.get(ext_s) if (ext_s and isinstance(dp_cfgs.get(ext_s), dict)) else {}

    bound_ap_devices: List[Dict[str, Any]] = []
    match_keys = {k for k in (ext_s, uid_s) if k}
    for d in ap_list:
        if not isinstance(d, dict):
            continue
        assigned = str(d.get("assigned_user") or d.get("extension") or "").strip()
        if assigned and assigned in match_keys:
            bound_ap_devices.append(d)

    def _clean_pwd(raw_p: Any) -> str:
        p_s = str(raw_p or "").strip()
        if fallback_password_fn:
            return fallback_password_fn(ext_s or "1000", p_s)
        if len(p_s) >= 8:
            return p_s
        dg = hashlib.sha256(f"AIDA_PBX_SIP_V2_SECRET_{ext_s or '1000'}_8842".encode("utf-8")).hexdigest()[:12]
        return f"Aida#{dg}"

    valid_codecs = ("g722", "alaw", "ulaw", "opus", "g729", "gsm")

    cti_cfg = user_dict.get("cti_config") if isinstance(user_dict.get("cti_config"), dict) else {}
    explicitly_empty = bool(cti_cfg.get("sip_devices_empty")) and isinstance(raw_devices, list) and len(raw_devices) == 0
    is_system_admin_no_ext = (not ext_s) and (
        str(user_dict.get("role") or "").strip().lower() == "admin" or uid_s in ("admin", "9999")
    )

    if not isinstance(raw_devices, list) or len(raw_devices) == 0:
        if is_system_admin_no_ext:
            return []
        if explicitly_empty:
            raw_devices = []
        else:
            primary_sip_u = resolve_user_sip_username(ext_s, user_dict.get("sip_username") or "")
            primary_pwd = _clean_pwd(user_dict.get("sip_password") or "")
            try:
                primary_max_act = max(1, min(5, int(user_dict.get("max_activations") or 1)))
            except Exception:
                primary_max_act = 1
            primary_tr = str(user_dict.get("transport") or "UDP").strip().upper()
            if primary_tr not in ("UDP", "TCP", "TLS"):
                primary_tr = "UDP"

            ap0 = bound_ap_devices[0] if bound_ap_devices else {}
            mac0, _ = normalize_mac_address(ap0.get("mac") or legacy_dp.get("mac") or "")
            brand0 = str(ap0.get("brand") or legacy_dp.get("brand") or (detect_brand_from_mac(mac0, "Yealink") if mac0 else "Yealink")).strip()
            model0 = str(ap0.get("model") or legacy_dp.get("model") or "T46U").strip()
            ip0 = str(ap0.get("ip") or legacy_dp.get("ip") or "").strip()
            dss0 = ap0.get("dss_keys") if isinstance(ap0.get("dss_keys"), list) and ap0.get("dss_keys") else (legacy_dp.get("dss_keys") if isinstance(legacy_dp.get("dss_keys"), list) else [])
            soft0 = ap0.get("soft_keys") if isinstance(ap0.get("soft_keys"), list) and ap0.get("soft_keys") else (legacy_dp.get("soft_keys") if isinstance(legacy_dp.get("soft_keys"), list) else [])

            raw_devices = [
                {
                    "id": f"dev-{ext_s or '1'}-1",
                    "name": "Masa Telefonu 1",
                    "device_type": "desk_phone",
                    "sip_username": primary_sip_u,
                    "sip_password": primary_pwd,
                    "max_activations": primary_max_act,
                    "transport": primary_tr,
                    "is_active": True,
                    "mac": mac0,
                    "ip": ip0,
                    "brand": brand0,
                    "model": model0,
                    "codecs": ["g722", "alaw", "ulaw", "g729"],
                    "dtmf_mode": "rfc4733",
                    "language": "Turkish",
                    "timezone": "+3",
                    "ntp_server": "pool.ntp.org",
                    "auto_answer": False,
                    "direct_ip_call_block": True,
                    "dss_keys": dss0,
                    "soft_keys": soft0,
                }
            ]

    # Ensure exactly one Web Telefonu (`web_phone`) sits at index 0 for every subscriber with an extension
    if ext_s or any(isinstance(d, dict) and str(d.get("device_type") or "").strip().lower() == "web_phone" for d in raw_devices):
        existing_web_devs = [
            d for d in raw_devices
            if isinstance(d, dict) and str(d.get("device_type") or "").strip().lower() == "web_phone"
        ]
        other_devs = [
            d for d in raw_devices
            if isinstance(d, dict) and str(d.get("device_type") or "").strip().lower() != "web_phone"
        ]
        if existing_web_devs:
            web_seed_item = dict(existing_web_devs[0])
        else:
            web_seed_item = {
                "id": f"dev-web-{ext_s or uid_s or '1'}",
                "name": "Web Telefonu",
                "device_type": "web_phone",
                "sip_username": resolve_user_webphone_sip_username(ext_s, ""),
                "sip_password": _clean_pwd(user_dict.get("sip_password") or ""),
                "max_activations": 5,
                "transport": "WSS",
                "is_active": True,
            }
        raw_devices = [web_seed_item] + other_devs

    normalized: List[Dict[str, Any]] = []
    seen_sip_users = {ext_s.lower()} if ext_s else set()
    assigned_primary_real_sip = False

    for idx, dev in enumerate(raw_devices):
        if not isinstance(dev, dict):
            continue
        dev_type = str(dev.get("device_type") or "desk_phone").strip().lower()
        if dev_type not in ("web_phone", "desk_phone", "softphone", "dect", "virtual_subscriber"):
            dev_type = "desk_phone"

        if dev_type == "web_phone":
            dev_id = str(dev.get("id") or f"dev-web-{ext_s or 'u'}").strip()
            default_dev_label = "Web Telefonu"
        elif dev_type == "virtual_subscriber":
            dev_id = str(dev.get("id") or f"dev-{ext_s or 'u'}-{idx + 1}").strip()
            default_dev_label = f"Sanal Abone {idx}"
        else:
            dev_id = str(dev.get("id") or f"dev-{ext_s or 'u'}-{idx + 1}").strip()
            default_dev_label = f"SIP Cihazı {idx}"
        dev_name = str(dev.get("name") or default_dev_label).strip() or default_dev_label

        dev_trunk = str(dev.get("trunk") or "").strip()
        dev_prefix = re.sub(r"[^0-9a-zA-Z*#+_.-]", "", str(dev.get("prefix") or "").strip())
        raw_vmode = str(dev.get("virtual_target_mode") or "extension").strip().lower()
        dev_vmode = "custom" if raw_vmode == "custom" else "extension"
        dev_custom_target = re.sub(r"[^0-9a-zA-Z*#+_.-]", "", str(dev.get("custom_target") or "").strip())

        if dev_type == "virtual_subscriber":
            cand_su = ""
            dev_pwd = ""
        elif dev_type == "web_phone":
            raw_su = str(dev.get("sip_username") or "").strip()
            cand_su = resolve_user_webphone_sip_username(ext_s, raw_su)
            while cand_su.lower() in seen_sip_users or cand_su.isdigit():
                cand_su = "W" + generate_random_sip_device_username(ext_s, idx + 1)[1:]
            seen_sip_users.add(cand_su.lower())
            dev_pwd = _clean_pwd(dev.get("sip_password") or user_dict.get("sip_password") or "")
        else:
            raw_su = str(dev.get("sip_username") or "").strip()
            if not assigned_primary_real_sip:
                cand_su = resolve_user_sip_username(ext_s, raw_su or user_dict.get("sip_username") or "")
                assigned_primary_real_sip = True
            else:
                cand_su = re.sub(r"[^a-zA-Z0-9_.-]", "", raw_su)
                if not cand_su or cand_su.isdigit() or cand_su.lower() in seen_sip_users:
                    cand_su = generate_random_sip_device_username(ext_s, idx + 1)
            while cand_su.lower() in seen_sip_users or cand_su.isdigit():
                cand_su = generate_random_sip_device_username(ext_s, idx + 2)
            seen_sip_users.add(cand_su.lower())
            dev_pwd = _clean_pwd(dev.get("sip_password") or (user_dict.get("sip_password") if not normalized else ""))
        try:
            max_upper = 10 if dev_type == "web_phone" else 5
            default_max_act = 5 if dev_type == "web_phone" else 1
            dev_max_act = max(1, min(max_upper, int(dev.get("max_activations") or default_max_act)))
        except Exception:
            dev_max_act = 5 if dev_type == "web_phone" else 1

        if dev_type == "web_phone":
            dev_tr = "WSS"
        else:
            dev_tr = str(dev.get("transport") or "UDP").strip().upper()
            if dev_tr not in ("UDP", "TCP", "TLS"):
                dev_tr = "UDP"

        mac_colon, _ = normalize_mac_address(dev.get("mac") or "")
        raw_brand = str(dev.get("brand") or "").strip()
        dev_brand = detect_brand_from_mac(mac_colon, raw_brand or "Yealink") if mac_colon and not raw_brand else (raw_brand or "Yealink")
        dev_model = str(dev.get("model") or "T46U").strip()
        dev_ip = str(dev.get("ip") or "").strip()

        raw_codecs = dev.get("codecs")
        if isinstance(raw_codecs, str):
            raw_codecs = [c.strip().lower() for c in raw_codecs.split(",") if c.strip()]
        dev_codecs: List[str] = []
        if isinstance(raw_codecs, list):
            for c in raw_codecs:
                cl = str(c or "").strip().lower()
                if cl == "pcma":
                    cl = "alaw"
                elif cl == "pcmu":
                    cl = "ulaw"
                if cl in valid_codecs and cl not in dev_codecs:
                    dev_codecs.append(cl)
        if not dev_codecs:
            dev_codecs = ["g722", "alaw", "ulaw", "g729"]

        dtmf_m = str(dev.get("dtmf_mode") or "rfc4733").strip().lower()
        if dtmf_m not in ("rfc4733", "info", "inband"):
            dtmf_m = "rfc4733"

        dss_list: List[Dict[str, Any]] = []
        if isinstance(dev.get("dss_keys"), list):
            for k_idx, k_item in enumerate(dev.get("dss_keys")):
                if not isinstance(k_item, dict):
                    continue
                dss_list.append({
                    "key_index": int(k_item.get("key_index") or (k_idx + 1)),
                    "type": str(k_item.get("type") or "blf").strip(),
                    "label": str(k_item.get("label") or "").strip(),
                    "value": str(k_item.get("value") or "").strip(),
                    "pickup_code": str(k_item.get("pickup_code") or "**").strip() or "**",
                })

        soft_list: List[Dict[str, Any]] = []
        if isinstance(dev.get("soft_keys"), list):
            for s_idx, s_item in enumerate(dev.get("soft_keys")):
                if not isinstance(s_item, dict):
                    continue
                soft_list.append({
                    "key_index": int(s_item.get("key_index") or (s_idx + 1)),
                    "type": str(s_item.get("type") or "history").strip(),
                    "label": str(s_item.get("label") or "").strip(),
                    "value": str(s_item.get("value") or "").strip(),
                })

        normalized.append({
            "id": dev_id,
            "name": dev_name,
            "device_type": dev_type,
            "sip_username": cand_su,
            "sip_password": dev_pwd,
            "max_activations": dev_max_act,
            "transport": dev_tr,
            "is_active": dev.get("is_active") is not False,
            "is_deletable": dev_type != "web_phone",
            "trunk": dev_trunk,
            "prefix": dev_prefix,
            "virtual_target_mode": dev_vmode,
            "custom_target": dev_custom_target,
            "mac": mac_colon,
            "ip": dev_ip,
            "brand": dev_brand,
            "model": dev_model,
            "codecs": dev_codecs,
            "dtmf_mode": dtmf_m,
            "language": str(dev.get("language") or "Turkish").strip() or "Turkish",
            "timezone": str(dev.get("timezone") or "+3").strip() or "+3",
            "ntp_server": str(dev.get("ntp_server") or "pool.ntp.org").strip() or "pool.ntp.org",
            "auto_answer": bool(dev.get("auto_answer", False)),
            "direct_ip_call_block": dev.get("direct_ip_call_block") is not False,
            "dss_keys": dss_list,
            "soft_keys": soft_list,
        })

    return normalized


def normalize_mac_address(raw_mac: Any) -> Tuple[str, str]:
    """
    Normalizes any MAC string ('00-15-65-AA-BB-CC', '001565aabbcc', '00:15:65:a:b:c')
    into ('00:15:65:aa:bb:cc', '001565aabbcc'). Returns ('', '') if invalid.
    """
    s = str(raw_mac or "").strip().lower()
    if not s:
        return "", ""
    if ":" in s or "-" in s:
        sep = ":" if ":" in s else "-"
        parts = [p.strip() for p in s.split(sep) if p.strip()]
        if len(parts) == 6 and all(re.fullmatch(r"[0-9a-f]{1,2}", p) for p in parts):
            padded = [p.zfill(2) for p in parts]
            return ":".join(padded), "".join(padded)
    hex_only = re.sub(r"[^0-9a-f]", "", s)
    if len(hex_only) == 12:
        colon = ":".join(hex_only[i : i + 2] for i in range(0, 12, 2))
        return colon, hex_only
    return "", ""


def extract_mac_from_provision_filename(filename: str) -> str:
    """
    Extracts 12-hex lowercase MAC from common vendor provisioning request filenames:
    - Yealink / Fanvil: 805ec0112233.cfg, 001565aabbcc.boot, 001565aabbcc-local.cfg
    - Grandstream: cfg000b82112233.xml, cfg000b82112233
    - Snom / Cisco: snomD785-000413112233.htm, spa000e08112233.xml, SEP000E08112233.cnf.xml
    """
    fn = str(filename or "").strip()
    m = re.search(r"([0-9a-fA-F]{12})", fn)
    if m:
        return m.group(1).lower()
    return ""


def detect_brand_from_mac(mac_colon: str, fallback_brand: str = "Yealink") -> str:
    oui = str(mac_colon or "").lower()[:8]
    return VENDOR_OUI_MAP.get(oui) or (str(fallback_brand or "").strip() or "Yealink")


def generate_device_token(mac_val: Any = "") -> str:
    """Generates a deterministic-or-random URL-safe provisioning token for a MAC-bound SIP device."""
    clean_mac = re.sub(r"[^0-9a-fA-F]", "", str(mac_val or "")).lower()
    if clean_mac:
        digest = hashlib.sha256(f"AIDA_AP_DEV_TOKEN_{clean_mac}".encode("utf-8")).hexdigest()
        return digest[:24]
    return secrets.token_urlsafe(18).replace("-", "").replace("_", "")[:24]


def get_or_create_provisioning_token(settings_db: dict, tenant_id: str = "tenant-default", force_rotate: bool = False) -> str:
    t_key = "tenant-default" if not tenant_id or tenant_id in ("default", "tenant-default", "all", "global") else str(tenant_id)
    tokens_map = settings_db.get("provisioning_tokens")
    if not isinstance(tokens_map, dict):
        tokens_map = {}
        settings_db["provisioning_tokens"] = tokens_map
    existing = str(tokens_map.get(t_key) or "").strip()
    if existing and len(existing) >= 16 and not force_rotate:
        return existing
    new_tok = secrets.token_urlsafe(18).replace("-", "").replace("_", "")[:24]
    tokens_map[t_key] = new_tok
    return new_tok


def resolve_tenant_by_provisioning_token(settings_db: dict, token: str) -> Optional[str]:
    tok_s = str(token or "").strip()
    if not tok_s:
        return None
    tokens_map = settings_db.get("provisioning_tokens")
    if isinstance(tokens_map, dict):
        for tid, tval in tokens_map.items():
            if str(tval or "").strip() == tok_s:
                return tid
    return None


def resolve_pbx_sip_server_host(settings_db: dict, request_host: str = "") -> str:
    nat_cfg = settings_db.get("nat") if isinstance(settings_db.get("nat"), dict) else {}
    ext_ip = str(nat_cfg.get("extern_ip") or "").strip()
    req_h = str(request_host or "").split(":")[0].strip()
    if req_h and req_h not in ("127.0.0.1", "localhost", "0.0.0.0"):
        return req_h
    if ext_ip and ext_ip not in ("127.0.0.1", "localhost", "0.0.0.0"):
        return ext_ip
    return req_h or ext_ip or "127.0.0.1"


def ensure_pjsip_notify_conf(asterisk_config_dir: str) -> None:
    """Writes pjsip_notify.conf so Asterisk CLI `pjsip send notify <type> endpoint <sip_username>` works across IP phone brands."""
    notify_content = """; ==========================================
; AIDA Otoprovizyon SIP NOTIFY (check-sync) Tanımları
; ==========================================

[default-yealink]
Event=>check-sync;reboot=false

[yealink-reboot]
Event=>check-sync;reboot=true

[grandstream-check-sync]
Event=>check-sync;reboot=false

[grandstream-reboot]
Event=>sys-control

[fanvil-check-sync]
Event=>check-sync;reboot=false

[fanvil-reboot]
Event=>check-sync;reboot=true

[snom-check-sync]
Event=>check-sync;reboot=false
"""
    try:
        os.makedirs(asterisk_config_dir, exist_ok=True)
        with open(os.path.join(asterisk_config_dir, "pjsip_notify.conf"), "w", encoding="utf-8") as f:
            f.write(notify_content)
    except Exception:
        pass

    if os.path.exists("/etc/asterisk"):
        try:
            with open("/etc/asterisk/pjsip_notify.conf", "w", encoding="utf-8") as f:
                f.write(notify_content)
            os.chmod("/etc/asterisk/pjsip_notify.conf", 0o644)
        except Exception:
            pass


def trigger_phone_sip_notify(sip_username: str, brand: str = "Yealink", reboot: bool = False) -> Tuple[bool, str]:
    """Triggers SIP NOTIFY check-sync on the user's PJSIP hardware endpoint (<sip_username>)."""
    ep = re.sub(r"[^a-zA-Z0-9_.-]", "", str(sip_username or "").strip())
    if not ep:
        return False, "Geçersiz SIP kullanıcı adı."

    b_low = str(brand or "Yealink").lower()
    if "grandstream" in b_low:
        notify_type = "grandstream-check-sync"
    elif "fanvil" in b_low:
        notify_type = "fanvil-reboot" if reboot else "fanvil-check-sync"
    elif "snom" in b_low:
        notify_type = "snom-check-sync"
    else:
        notify_type = "yealink-reboot" if reboot else "default-yealink"

    try:
        proc = subprocess.run(
            ["asterisk", "-rx", f"pjsip send notify {notify_type} endpoint {ep}"],
            capture_output=True,
            text=True,
            timeout=2.5,
            check=False,
        )
        out = (proc.stdout or proc.stderr or "").strip()
        if proc.returncode == 0 and "Unable to find" not in out and "No such command" not in out:
            return True, out or f"SIP NOTIFY ({notify_type}) -> {ep} gönderildi."
        return False, out or f"Asterisk endpoint ({ep}) aktif değil veya ulaşılamadı."
    except FileNotFoundError:
        return False, "Bu ortamda Asterisk servisi bulunamadı (yalnızca üretim sunucusunda çalışır)."
    except Exception as e:
        return False, str(e)


def inspect_asterisk_pjsip_endpoint(sip_username: str) -> Dict[str, Any]:
    """Runs `asterisk -rx 'pjsip show endpoint <sip_username>'` to verify endpoint existence, live contact IP/Port/RTT, User-Agent, and PJSIP parameters."""
    ep = re.sub(r"[^a-zA-Z0-9_.-]", "", str(sip_username or "").strip())
    if not ep:
        return {"exists": False, "endpoint": "", "online": False, "contacts": [], "parsed": {}, "raw": "SIP kullanıcı adı boş."}

    parsed: Dict[str, Any] = {
        "ip_address": "",
        "port": "",
        "rtt_ms": "",
        "user_agent": "",
        "device_state": "",
        "context": "",
        "transport": "",
        "allow": "",
        "dtmf_mode": "",
        "callerid": "",
        "named_call_group": "",
        "named_pickup_group": "",
        "max_contacts": "",
    }

    def _run_ast_cli(cmd_str: str, timeout_s: float = 2.5) -> Tuple[bool, str]:
        try:
            proc = subprocess.run(
                ["asterisk", "-rx", cmd_str],
                capture_output=True,
                text=True,
                timeout=timeout_s,
                check=False,
            )
            return True, (proc.stdout or proc.stderr or "").strip()
        except FileNotFoundError:
            try:
                proc_d = subprocess.run(
                    ["docker", "exec", "ai_pbx_asterisk", "asterisk", "-rx", cmd_str],
                    capture_output=True,
                    text=True,
                    timeout=timeout_s,
                    check=False,
                )
                if proc_d.returncode == 0 or (proc_d.stdout or "").strip():
                    return True, (proc_d.stdout or proc_d.stderr or "").strip()
            except Exception:
                pass
            return False, ""

    try:
        cli_ok, raw = _run_ast_cli(f"pjsip show endpoint {ep}", 2.5)
        if not cli_ok:
            return {
                "exists": False,
                "endpoint": ep,
                "online": False,
                "contacts": [],
                "parsed": parsed,
                "cli_available": False,
                "contact_raw": "",
                "raw": "Asterisk CLI bu makinede kurulu değil (üretim sunucusunda `asterisk -rx \"pjsip show endpoint " + ep + "\"` çıktısı canlı olarak görüntülenir).",
            }
        exists = bool(raw) and ("Unable to find object" not in raw) and ("No objects found" not in raw)
        online = exists and ("Avail" in raw or "NonQual" in raw or ("Contact:" in raw and "Unavailable" not in raw))
        contacts: List[str] = []
        contact_id_for_ua = ""
        contact_raw = ""
        for line in raw.splitlines():
            ls = line.strip()
            if ls.startswith("Endpoint:") and not parsed["device_state"]:
                for st_lbl in ("Not in use", "In use", "Ringing", "Busy", "On hold", "Unavailable", "Invalid"):
                    if st_lbl in ls:
                        parsed["device_state"] = st_lbl
                        break
            elif ls.startswith("Contact:"):
                contacts.append(ls)
                m_uri = re.search(r"sip:[^@\s]+@([0-9a-fA-F\.\:]+?)(?::(\d+))?(?:[;\s]|$)", ls)
                if m_uri and not parsed["ip_address"]:
                    parsed["ip_address"] = m_uri.group(1)
                    parsed["port"] = m_uri.group(2) or "5060"
                m_rtt = re.search(r"(?:Avail|NonQual)\s+([0-9]+(?:\.[0-9]+)?)", ls)
                if m_rtt and not parsed["rtt_ms"]:
                    parsed["rtt_ms"] = m_rtt.group(1)
                m_cid = re.match(r"^Contact:\s+([^\s]+)", ls)
                if m_cid and not contact_id_for_ua:
                    contact_id_for_ua = m_cid.group(1).strip()
            elif ls.startswith("Aor:") and not parsed["max_contacts"]:
                m_mc = re.search(r"\s(\d+)\s*$", ls)
                if m_mc:
                    parsed["max_contacts"] = m_mc.group(1)
            elif ":" in ls:
                k_raw, _, v_raw = ls.partition(":")
                k_clean = k_raw.strip().lower()
                v_clean = v_raw.strip()
                if k_clean in parsed and v_clean:
                    parsed[k_clean] = v_clean

        if contact_id_for_ua:
            try:
                c_ok, c_out = _run_ast_cli(f"pjsip show contact {contact_id_for_ua}", 1.5)
                if c_ok and c_out and "Unable to find object" not in c_out:
                    contact_raw = c_out
                    for cline in c_out.splitlines():
                        cls = cline.strip()
                        if cls.lower().startswith("user_agent"):
                            _, _, ua_v = cls.partition(":")
                            if ua_v.strip():
                                parsed["user_agent"] = ua_v.strip()
                                break
            except Exception:
                pass

        return {
            "exists": exists,
            "endpoint": ep,
            "online": online,
            "contacts": contacts,
            "parsed": parsed,
            "cli_available": True,
            "contact_raw": contact_raw,
            "raw": raw,
        }
    except Exception as e:
        return {"exists": False, "endpoint": ep, "online": False, "contacts": [], "parsed": parsed, "cli_available": False, "contact_raw": "", "raw": str(e)}


def generate_yealink_common_boot_cfg() -> str:
    """Common Yealink boot/model config (y0000000000xx.cfg) requested prior to <mac>.cfg."""
    return "\n".join(
        [
            "#!version:1.0.0.1",
            "# AIDA PBX Yealink Common Provisioning Profile",
            "lang.gui = Turkish",
            "lang.wui = Turkish",
            "local_time.time_zone = +3",
            "local_time.time_zone_name = Turkey(Ankara)",
            "local_time.ntp_server1 = pool.ntp.org",
            "local_time.summer_time = 0",
            "sip.notify_reboot_enable = 0",
            "features.direct_ip_call_enable = 0",
            "",
        ]
    )


def generate_provisioning_config(
    ext: str,
    sip_username: str,
    sip_password: str,
    full_name: str,
    pbx_host: str,
    brand: str = "Yealink",
    model: str = "T46U",
    mac_colon: str = "",
    transport: str = "UDP",
    dss_keys: Optional[List[Dict[str, Any]]] = None,
    soft_keys: Optional[List[Dict[str, Any]]] = None,
    pickup_group: str = "*8",
    pickup_directed: str = "**",
    template_obj: Optional[Dict[str, Any]] = None,
    requested_filename: str = "",
    codecs: Optional[List[str]] = None,
    dtmf_mode: str = "rfc4733",
    language: str = "Turkish",
    timezone: str = "+3",
    ntp_server: str = "pool.ntp.org",
    auto_answer: bool = False,
    direct_ip_call_block: bool = True,
) -> Tuple[str, str, str]:
    """
    Generates multi-vendor provisioning content using `sip_username` (Kullanıcı > SIP > Kullanıcı Adı)
    as the SIP Register & Auth Username so it authenticates directly against `[<sip_username>]` in Asterisk PJSIP.
    Returns (content_text, media_type, suggested_filename).
    """
    ext_s = str(ext or "").strip()
    sip_u = str(sip_username or "").strip() or resolve_user_sip_username(ext_s, "")
    disp_name = str(full_name or f"Dahili {ext_s}").strip()
    line_label = f"{ext_s} - {disp_name}" if ext_s else disp_name
    mac_norm, mac_hex = normalize_mac_address(mac_colon)
    tr_up = str(transport or "UDP").strip().upper()
    sip_port = 5061 if tr_up == "TLS" else 5060

    dss_list = dss_keys if isinstance(dss_keys, list) else []
    soft_list = soft_keys if isinstance(soft_keys, list) else []

    # 1. If a custom XML/CFG template is explicitly assigned, interpolate variables
    if isinstance(template_obj, dict) and str(template_obj.get("xml_content") or "").strip():
        raw_tpl = str(template_obj.get("xml_content") or "")
        replacements = {
            "{MAC}": mac_hex,
            "{MAC_UPPER}": mac_hex.upper(),
            "{MAC_COLON}": mac_norm,
            "{EXTENSION}": ext_s,
            "{SIP_USERNAME}": sip_u,
            "{USERNAME}": sip_u,
            "{AUTH_NAME}": sip_u,
            "{SIP_PASSWORD}": sip_password,
            "{PASSWORD}": sip_password,
            "{DISPLAY_NAME}": disp_name,
            "{FULL_NAME}": disp_name,
            "{LABEL}": line_label,
            "{SIP_SERVER}": pbx_host,
            "{PBX_HOST}": pbx_host,
            "{SIP_PORT}": str(sip_port),
            "{TRANSPORT}": tr_up,
            "{VOICEMAIL_CODE}": "*97",
            "{PICKUP_GROUP}": pickup_group,
            "{PICKUP_DIRECTED}": pickup_directed,
        }
        rendered = raw_tpl
        for k, v in replacements.items():
            rendered = rendered.replace(k, str(v))
        is_xml = rendered.lstrip().startswith("<")
        ext_suffix = "xml" if is_xml else "cfg"
        fname = f"{mac_hex or ('ext_' + ext_s)}.{ext_suffix}"
        return rendered, ("application/xml; charset=utf-8" if is_xml else "text/plain; charset=utf-8"), fname

    b_low = str(brand or "Yealink").strip().lower()
    fn_low = str(requested_filename or "").strip().lower()
    if fn_low.startswith("cfg") and fn_low.endswith(".xml"):
        b_low = "grandstream"
    elif fn_low.startswith("snom"):
        b_low = "snom"

    # --- GRANDSTREAM XML (GRP26xx / GXP16xx / GXP21xx) ---
    if "grandstream" in b_low:
        gs_tr = "2" if tr_up == "TLS" else ("1" if tr_up == "TCP" else "0")
        gs_mpk_lines: List[str] = []
        # Grandstream VPK / MPK basic mapping (Account 1 = 0, Mode: 0=Line, 1=SpeedDial, 2=BLF)
        gs_mode_map = {"line": "0", "speed_dial": "1", "blf": "2", "transfer": "9", "voicemail": "1"}
        for idx_zero, k in enumerate(dss_list[:8]):
            ktype = str(k.get("type") or "none")
            if ktype == "none":
                continue
            mode_code = gs_mode_map.get(ktype, "1")
            klbl = html.escape(str(k.get("label") or ""))
            kval = html.escape(str(k.get("value") or ""))
            # VPK P-codes for VPK 1..8 (P1363/1364 etc. vary, standard MPK 1..8 start at P323..P350)
            p_mode = 323 + idx_zero
            p_acct = 301 + (idx_zero * 3)
            p_desc = 302 + (idx_zero * 3)
            p_val = 303 + (idx_zero * 3)
            gs_mpk_lines.append(f"    <P{p_mode}>{mode_code}</P{p_mode}>")
            gs_mpk_lines.append(f"    <P{p_acct}>0</P{p_acct}>")
            gs_mpk_lines.append(f"    <P{p_desc}>{klbl}</P{p_desc}>")
            gs_mpk_lines.append(f"    <P{p_val}>{kval}</P{p_val}>")

        mpk_block = "\n".join(gs_mpk_lines)
        xml_out = f"""<?xml version="1.0" encoding="UTF-8" ?>
<!-- AIDA PBX Grandstream Auto-Provisioning ({html.escape(model)}) | Ext: {html.escape(ext_s)} | SIP Endpoint: {html.escape(sip_u)} -->
<gs_provision version="1">
  <mac>{html.escape(mac_hex)}</mac>
  <config version="1">
    <P271>1</P271>
    <P270>{html.escape(line_label)}</P270>
    <P47>{html.escape(pbx_host)}:{sip_port}</P47>
    <P35>{html.escape(sip_u)}</P35>
    <P36>{html.escape(sip_u)}</P36>
    <P34>{html.escape(sip_password)}</P34>
    <P3>{html.escape(disp_name)}</P3>
    <P130>{gs_tr}</P130>
    <P52>2</P52>
    <P33>*97</P33>
    <P1347>{html.escape(pickup_directed)}</P1347>
    <P64>TZT-3</P64>
    <P30>pool.ntp.org</P30>
{mpk_block}
  </config>
</gs_provision>
"""
        fname = f"cfg{mac_hex}.xml" if mac_hex else f"cfg_ext_{ext_s}.xml"
        return xml_out, "application/xml; charset=utf-8", fname

    # --- FANVIL CFG (X3U / X4U / X5U / V62 / V64 / V65) ---
    if "fanvil" in b_low:
        fv_tr = "3" if tr_up == "TLS" else ("1" if tr_up == "TCP" else "0")
        fv_lines = [
            "<<VOIP CONFIG FILE>>Version:2.0000",
            f"# AIDA PBX Fanvil Auto-Provisioning ({model}) | Ext: {ext_s} | SIP Endpoint: {sip_u}",
            "",
            "<SIP CONFIG MODULE>",
            "--SIP Line List--  :",
            "SIP1 Enable          :1",
            f"SIP1 Phone Number    :{sip_u}",
            f"SIP1 Display Name    :{line_label}",
            f"SIP1 Sip Name        :{disp_name}",
            f"SIP1 Register Addr   :{pbx_host}",
            f"SIP1 Register Port   :{sip_port}",
            f"SIP1 Register User   :{sip_u}",
            f"SIP1 Register Pswd   :{sip_password}",
            "SIP1 Register TTL    :3600",
            f"SIP1 Transport       :{fv_tr}",
            "SIP1 Rport           :1",
            "SIP1 Subscribe Expire:1800",
            "SIP1 MWI Num         :*97",
            "",
            "<DSSKEY CONFIG MODULE>",
        ]
        # Fanvil DSS Type: 1=MemoryKey(BLF/SpeedDial), 2=Line
        for k in dss_list:
            idx = int(k.get("key_index") or 1)
            ktype = str(k.get("type") or "none")
            klbl = str(k.get("label") or "")
            kval = str(k.get("value") or "")
            pickup = str(k.get("pickup_code") or pickup_directed)
            if ktype == "line":
                fv_lines.append(f"Dsskey{idx} Type         :2")
                fv_lines.append(f"Dsskey{idx} Line         :1")
                fv_lines.append(f"Dsskey{idx} Title        :{klbl or line_label}")
            elif ktype == "blf" and kval:
                fv_lines.append(f"Dsskey{idx} Type         :1")
                fv_lines.append(f"Dsskey{idx} Line         :1")
                fv_lines.append(f"Dsskey{idx} Value        :{kval}@1/ba{pickup}{kval}")
                fv_lines.append(f"Dsskey{idx} Title        :{klbl}")
            elif ktype == "speed_dial" and kval:
                fv_lines.append(f"Dsskey{idx} Type         :1")
                fv_lines.append(f"Dsskey{idx} Line         :1")
                fv_lines.append(f"Dsskey{idx} Value        :{kval}@1/f")
                fv_lines.append(f"Dsskey{idx} Title        :{klbl}")
        fv_lines.append("")
        fv_lines.append("<<END OF FILE>>")
        fname = f"{mac_hex}.cfg" if mac_hex else f"fanvil_{ext_s}.cfg"
        return "\n".join(fv_lines) + "\n", "text/plain; charset=utf-8", fname

    # --- SNOM XML (D3xx / D7xx) ---
    if "snom" in b_low:
        sn_tr = ";transport=tls" if tr_up == "TLS" else (";transport=tcp" if tr_up == "TCP" else "")
        fkey_lines: List[str] = []
        for k in dss_list:
            idx = max(0, int(k.get("key_index") or 1) - 1)
            ktype = str(k.get("type") or "none")
            klbl = html.escape(str(k.get("label") or ""))
            kval = html.escape(str(k.get("value") or ""))
            if ktype == "blf" and kval:
                fkey_lines.append(f'    <fkey idx="{idx}" context="1" label="{klbl}" perm="">blf sip:{kval}@{html.escape(pbx_host)}|{html.escape(pickup_directed)}{kval}</fkey>')
            elif ktype == "speed_dial" and kval:
                fkey_lines.append(f'    <fkey idx="{idx}" context="1" label="{klbl}" perm="">speed {kval}</fkey>')
        fkeys_xml = "\n".join(fkey_lines)
        snom_xml = f"""<?xml version="1.0" encoding="utf-8"?>
<settings>
  <phone-settings>
    <user_active idx="1" perm="">on</user_active>
    <user_realname idx="1" perm="">{html.escape(disp_name)}</user_realname>
    <user_idle_text idx="1" perm="">{html.escape(line_label)}</user_idle_text>
    <user_name idx="1" perm="">{html.escape(sip_u)}</user_name>
    <user_pname idx="1" perm="">{html.escape(sip_u)}</user_pname>
    <user_pass idx="1" perm="">{html.escape(sip_password)}</user_pass>
    <user_host idx="1" perm="">{html.escape(pbx_host)}:{sip_port}{sn_tr}</user_host>
    <user_mailbox idx="1" perm="">*97</user_mailbox>
    <timezone perm="">TUR+3</timezone>
    <ntp_server perm="">pool.ntp.org</ntp_server>
{fkeys_xml}
  </phone-settings>
</settings>
"""
        fname = f"snom-{mac_hex}.xml" if mac_hex else f"snom_{ext_s}.xml"
        return snom_xml, "application/xml; charset=utf-8", fname

    # --- DEFAULT: YEALINK CFG (T3x / T4x / T5x) ---
    yl_tr = 2 if tr_up == "TLS" else (1 if tr_up == "TCP" else 0)
    dtmf_low = str(dtmf_mode or "rfc4733").strip().lower()
    yl_dtmf = 0 if dtmf_low == "inband" else (3 if dtmf_low == "info" else 2)
    codec_list = codecs if isinstance(codecs, list) and codecs else ["g722", "alaw", "ulaw", "g729"]
    yl_codec_map = {"g722": "g722", "alaw": "pcma", "ulaw": "pcmu", "opus": "opus", "g729": "g729"}
    codec_cfg_lines: List[str] = []
    prio_num = 1
    for ck in codec_list:
        yl_ck = yl_codec_map.get(str(ck).lower())
        if yl_ck:
            codec_cfg_lines.append(f"account.1.codec.{yl_ck}.enable = 1")
            codec_cfg_lines.append(f"account.1.codec.{yl_ck}.priority = {prio_num}")
            prio_num += 1
    for ck_all, yl_ck in yl_codec_map.items():
        if ck_all not in [str(x).lower() for x in codec_list]:
            codec_cfg_lines.append(f"account.1.codec.{yl_ck}.enable = 0")

    lang_val = str(language or "Turkish").strip() or "Turkish"
    tz_val = str(timezone or "+3").strip() or "+3"
    ntp_val = str(ntp_server or "pool.ntp.org").strip() or "pool.ntp.org"

    lines = [
        "#!version:1.0.0.1",
        f"# AIDA PBX Auto-Provisioning ({brand or 'Yealink'} {model or 'T46U'})",
        f"# Dahili: {ext_s} ({disp_name}) | PJSIP Endpoint / SIP Kullanici Adi: {sip_u}",
        "",
        "# --- SIP Hesap 1 (Kullanici SIP Aktivasyon Kimligi ile Kayit) ---",
        "account.1.enable = 1",
        f"account.1.label = {line_label}",
        f"account.1.display_name = {disp_name}",
        f"account.1.auth_name = {sip_u}",
        f"account.1.user_name = {sip_u}",
        f"account.1.password = {sip_password}",
        f"account.1.sip_server.1.address = {pbx_host}",
        f"account.1.sip_server.1.port = {sip_port}",
        f"account.1.sip_server.1.transport_type = {yl_tr}",
        "account.1.sip_server.1.expires = 3600",
        "account.1.nat.udp_update_enable = 1",
        "account.1.nat.udp_update_time = 30",
        "account.1.nat.rport = 1",
        f"account.1.dtmf.type = {yl_dtmf}",
        "account.1.dtmf.info_type = 0",
        "account.1.cid_source = 4",
        "account.1.cp_source = 0",
        f"account.1.auto_answer = {1 if auto_answer else 0}",
        "voice_mail.number.1 = *97",
        "account.1.direct_pickup_code = " + pickup_directed,
        "account.1.group_pickup_code = " + pickup_group,
        "account.1.dialoginfo_callpickup = 1",
        "",
        "# --- Ses Kodek Onceligi ---",
        *codec_cfg_lines,
        "",
        "# --- Dil, Saat Dilimi ve Uzaktan Senkronizasyon (check-sync) ---",
        f"lang.gui = {lang_val}",
        f"lang.wui = {lang_val}",
        f"local_time.time_zone = {tz_val}",
        "local_time.time_zone_name = Turkey(Ankara)" if tz_val in ("+3", "3", "UTC+3") else f"local_time.time_zone_name = GMT{tz_val}",
        f"local_time.ntp_server1 = {ntp_val}",
        "local_time.summer_time = 0",
        "sip.notify_reboot_enable = 0",
        f"features.direct_ip_call_enable = {0 if direct_ip_call_block else 1}",
        "",
        "# --- Programlanabilir Yan Tuslar / BLF / Hizli Arama (DSS Keys) ---",
    ]

    yealink_type_map = {
        "none": 0,
        "conference": 1,
        "transfer": 2,
        "hold": 4,
        "dnd": 5,
        "speed_dial": 13,
        "line": 15,
        "blf": 16,
        "voicemail": 13,
    }
    if not dss_list:
        lines.append("linekey.1.type = 15")
        lines.append("linekey.1.line = 1")
        lines.append(f"linekey.1.label = {ext_s or sip_u}")
    else:
        for k in dss_list:
            idx = int(k.get("key_index") or 1)
            ktype = str(k.get("type") or "none")
            label = str(k.get("label") or "")
            val = str(k.get("value") or ("*97" if ktype == "voicemail" else ""))
            pickup = str(k.get("pickup_code") or pickup_directed)
            yl_code = yealink_type_map.get(ktype, 0)

            lines.append(f"linekey.{idx}.type = {yl_code}")
            lines.append(f"linekey.{idx}.line = 1")
            lines.append(f"linekey.{idx}.value = {val}")
            lines.append(f"linekey.{idx}.label = {label}")
            if ktype == "blf":
                lines.append(f"linekey.{idx}.extension = {pickup}")

    lines.append("")
    lines.append("# --- Ekran Alti Softkey Tuslari (F1-F4) ---")
    soft_type_map = {
        "history": 28,
        "directory": 22,
        "dnd": 5,
        "transfer": 2,
        "speed_dial": 13,
        "redial": 27,
        "voicemail": 13,
    }
    for sk in soft_list:
        sidx = int(sk.get("key_index") or 1)
        stype = str(sk.get("type") or "history")
        slabel = str(sk.get("label") or "")
        sval = str(sk.get("value") or ("*97" if stype == "voicemail" else ""))
        lines.append(f"programablekey.{sidx}.type = {soft_type_map.get(stype, 0)}")
        lines.append(f"programablekey.{sidx}.line = 1")
        lines.append(f"programablekey.{sidx}.value = {sval}")
        lines.append(f"programablekey.{sidx}.label = {slabel}")

    fname = f"{mac_hex}.cfg" if mac_hex else f"deskphone_{ext_s}.cfg"
    return "\n".join(lines) + "\n", "text/plain; charset=utf-8", fname
