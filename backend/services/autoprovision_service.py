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
    - Uses user's configured `sip_username` (Kullanıcı Ayarları > SIP > Kullanıcı Adı) when valid and distinct from numeric extension.
    - Otherwise derives a stable 8-character alphanumeric SIP username from `ext_val` so it never changes randomly across restarts
      and never collides with the WebRTC `[<ext>]` endpoint.
    """
    ext_s = str(ext_val or "").strip()
    cand = re.sub(r"[^a-zA-Z0-9_.-]", "", str(raw_sip_user or "").strip())
    if cand and cand != ext_s:
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
    """Runs `asterisk -rx 'pjsip show endpoint <sip_username>'` to verify endpoint existence and live contact status."""
    ep = re.sub(r"[^a-zA-Z0-9_.-]", "", str(sip_username or "").strip())
    if not ep:
        return {"exists": False, "endpoint": "", "online": False, "raw": "SIP kullanıcı adı boş."}
    try:
        proc = subprocess.run(
            ["asterisk", "-rx", f"pjsip show endpoint {ep}"],
            capture_output=True,
            text=True,
            timeout=2.5,
            check=False,
        )
        raw = (proc.stdout or proc.stderr or "").strip()
        exists = bool(raw) and ("Unable to find object" not in raw) and ("No objects found" not in raw)
        online = exists and ("Avail" in raw or "NonQual" in raw)
        contacts: List[str] = []
        for line in raw.splitlines():
            ls = line.strip()
            if ls.startswith("Contact:"):
                contacts.append(ls)
        return {
            "exists": exists,
            "endpoint": ep,
            "online": online,
            "contacts": contacts,
            "raw": raw,
        }
    except FileNotFoundError:
        return {
            "exists": False,
            "endpoint": ep,
            "online": False,
            "contacts": [],
            "raw": "Asterisk CLI bu makinede kurulu değil (üretim sunucusunda pjsip_custom.conf ile otomatik yüklenir).",
        }
    except Exception as e:
        return {"exists": False, "endpoint": ep, "online": False, "contacts": [], "raw": str(e)}


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
        "account.1.dtmf.type = 2",
        "account.1.dtmf.info_type = 0",
        "account.1.cid_source = 4",
        "account.1.cp_source = 0",
        "voice_mail.number.1 = *97",
        "account.1.direct_pickup_code = " + pickup_directed,
        "account.1.group_pickup_code = " + pickup_group,
        "account.1.dialoginfo_callpickup = 1",
        "",
        "# --- Ses Kodek Onceligi (G.722 HD, PCMA, PCMU) ---",
        "account.1.codec.g722.enable = 1",
        "account.1.codec.g722.priority = 1",
        "account.1.codec.pcma.enable = 1",
        "account.1.codec.pcma.priority = 2",
        "account.1.codec.pcmu.enable = 1",
        "account.1.codec.pcmu.priority = 3",
        "account.1.codec.g729.enable = 1",
        "account.1.codec.g729.priority = 4",
        "",
        "# --- Dil, Saat Dilimi ve Uzaktan Senkronizasyon (check-sync) ---",
        "lang.gui = Turkish",
        "lang.wui = Turkish",
        "local_time.time_zone = +3",
        "local_time.time_zone_name = Turkey(Ankara)",
        "local_time.ntp_server1 = pool.ntp.org",
        "local_time.summer_time = 0",
        "sip.notify_reboot_enable = 0",
        "features.direct_ip_call_enable = 0",
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
