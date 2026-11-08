import os
import re
import uuid
import wave
import json
import copy
import asyncio
import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from typing import Dict, Any, List, Optional, Tuple

TR_TZ = datetime.timezone(datetime.timedelta(hours=3))

DEFAULT_EMERGENCY_NUMBERS = ["112", "110", "155", "156", "177", "185", "186", "187"]

DEFAULT_PBX_FEATURE_CODES = {
    "voicemail_listen": "*97",
    "recording_pause": "*9",
    "profile_switch": "*70",
    "boss_secretary_toggle": "*74",
    "hotdesk_login": "*75",
    "hotdesk_logout": "*76",
}


def get_tr_now() -> datetime.datetime:
    return datetime.datetime.now(TR_TZ)


def get_tr_date_str(dt: Optional[datetime.datetime] = None) -> str:
    target = dt or get_tr_now()
    if target.tzinfo is None:
        target = target.replace(tzinfo=datetime.timezone.utc).astimezone(TR_TZ)
    else:
        target = target.astimezone(TR_TZ)
    return target.strftime("%Y-%m-%d")


def normalize_emergency_config(raw: Any) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        raw = {}
    raw_nums = raw.get("numbers")
    nums: List[str] = []
    if isinstance(raw_nums, list):
        for item in raw_nums:
            cleaned = re.sub(r"[^0-9]", "", str(item or "").strip())
            if cleaned and cleaned not in nums:
                nums.append(cleaned)
    elif raw_nums is None:
        nums = list(DEFAULT_EMERGENCY_NUMBERS)
    pref_trunk = str(raw.get("preferred_trunk") or "").strip()
    return {
        "numbers": nums,
        "preferred_trunk": pref_trunk,
    }


def normalize_pbx_features_config(raw: Any) -> Dict[str, str]:
    if not isinstance(raw, dict):
        raw = {}
    merged = dict(DEFAULT_PBX_FEATURE_CODES)
    for k, def_v in DEFAULT_PBX_FEATURE_CODES.items():
        val = str(raw.get(k) or "").strip()
        if val:
            merged[k] = val
        else:
            merged[k] = def_v
    return merged


def normalize_boss_secretary_config(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, str) and raw.strip().startswith("{"):
        try:
            raw = json.loads(raw)
        except Exception:
            raw = {}
    if not isinstance(raw, dict):
        raw = {}
    secs: List[str] = []
    for s in (raw.get("secretaries") or []):
        sc = re.sub(r"[^0-9]", "", str(s or "").strip())
        if sc and sc not in secs:
            secs.append(sc)
    single_sec = re.sub(r"[^0-9]", "", str(raw.get("secretary_extension") or "").strip())
    if single_sec and single_sec not in secs:
        secs.insert(0, single_sec)

    vips: List[str] = []
    for v in (raw.get("vip_whitelist") or []):
        vc = re.sub(r"[^0-9]", "", str(v or "").strip())
        if vc and vc not in vips:
            vips.append(vc)
    return {
        "enabled": bool(raw.get("enabled", False)),
        "secretaries": secs,
        "vip_whitelist": vips,
    }


def normalize_hotdesk_config(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, str) and raw.strip().startswith("{"):
        try:
            raw = json.loads(raw)
        except Exception:
            raw = {}
    if not isinstance(raw, dict):
        raw = {}
    pin_clean = re.sub(r"\D", "", str(raw.get("pin") or "").strip())[:8]
    enabled_val = raw.get("enabled")
    auto_mid_val = raw.get("auto_logout_midnight")
    return {
        "enabled": True if enabled_val is None else bool(enabled_val),
        "pin": pin_clean,
        "auto_logout_midnight": True if auto_mid_val is None else bool(auto_mid_val),
    }


def is_configured_emergency_number(callee: str, settings_db: dict) -> bool:
    clean = re.sub(r"[^0-9]", "", str(callee or "").strip())
    if not clean:
        return False
    pbx_cfg = settings_db.get("pbx", {}) if isinstance(settings_db.get("pbx"), dict) else {}
    num_plan = pbx_cfg.get("numbering_plan", {}) if isinstance(pbx_cfg.get("numbering_plan"), dict) else {}
    em_cfg = normalize_emergency_config(num_plan.get("emergency_numbers"))
    return clean in em_cfg["numbers"]


def build_ordered_outbound_trunks(
    active_trunks: List[Dict[str, Any]],
    matched_rule: Optional[Dict[str, Any]] = None,
    preferred_trunk: str = "",
) -> List[Dict[str, Any]]:
    """
    Returns ordered deduplicated list of active trunks for outbound failover:
    - If preferred_trunk is specified (e.g. Emergency Number preferred trunk), puts it first, followed by remaining active trunks.
    - If matched_rule specifies trunk_ids/trunks, returns those active trunks in exact top-to-bottom UI order!
      (Does NOT append unconfigured trunks when a rule explicitly defines allowed trunks, preserving admin routing intent;
       falls back to all active trunks only if none of the rule's trunk references exist.)
    - Otherwise returns active trunks starting with primary trunk ('908503607390' or index 0).
    """
    if not active_trunks:
        return []

    ordered: List[Dict[str, Any]] = []
    seen_keys = set()

    def _trunk_key(t_obj: dict) -> str:
        return f"{t_obj.get('id') or ''}:{t_obj.get('trunk_name') or t_obj.get('name') or ''}"

    def _add_cand(t_obj: Optional[dict]):
        if not t_obj:
            return
        tk = _trunk_key(t_obj)
        if tk not in seen_keys:
            seen_keys.add(tk)
            ordered.append(t_obj)

    def _find_trunk(ref_str: str) -> Optional[dict]:
        r = str(ref_str or "").strip()
        if not r:
            return None
        for t in active_trunks:
            if (
                str(t.get("id") or "").strip() == r
                or str(t.get("trunk_name") or "").strip() == r
                or str(t.get("name") or "").strip() == r
            ):
                return t
        return None

    if preferred_trunk:
        _add_cand(_find_trunk(preferred_trunk))
        for t in active_trunks:
            _add_cand(t)
        return ordered

    if isinstance(matched_rule, dict):
        r_trunks = (
            matched_rule.get("trunk_ids")
            or matched_rule.get("trunks")
            or ([matched_rule.get("trunk_id")] if matched_rule.get("trunk_id") else [])
        )
        if isinstance(r_trunks, list) and len(r_trunks) > 0:
            for t_ref in r_trunks:
                _add_cand(_find_trunk(str(t_ref)))
            if ordered:
                return ordered

    primary = next((t for t in active_trunks if str(t.get("trunk_name")) == "908503607390"), active_trunks[0])
    _add_cand(primary)
    for t in active_trunks:
        _add_cand(t)
    return ordered


def extract_peer_from_channel(channel_name: str) -> str:
    ch = str(channel_name or "").strip()
    if not ch:
        return ""
    m = re.match(r"^(?:PJSIP|SIP|IAX2)/([^-\;@/]+)", ch, re.IGNORECASE)
    return m.group(1).strip() if m else ""


def resolve_hotdesk_session_for_channel(channel_name: str, settings_db: dict) -> Optional[Dict[str, Any]]:
    peer = extract_peer_from_channel(channel_name)
    if not peer:
        return None
    sessions = settings_db.get("hotdesk_sessions")
    if not isinstance(sessions, dict):
        return None
    peer_low = peer.lower()
    for dev_key, sess in sessions.items():
        if str(dev_key or "").strip().lower() == peer_low and isinstance(sess, dict):
            if sess.get("extension"):
                return sess
    return None


def cleanup_expired_midnight_hotdesk_sessions(settings_db: dict, save_fn=None, log_fn=None) -> List[Dict[str, Any]]:
    """
    Removes any Hot-Desk sessions whose auto_logout_midnight is True and whose Turkish local start date
    is earlier than today's Turkish calendar date (00:00:00 Europe/Istanbul).
    """
    sessions = settings_db.get("hotdesk_sessions")
    if not isinstance(sessions, dict) or not sessions:
        return []
    today_tr = get_tr_date_str()
    expired_items: List[Dict[str, Any]] = []
    for dev_key in list(sessions.keys()):
        sess = sessions.get(dev_key)
        if not isinstance(sess, dict):
            sessions.pop(dev_key, None)
            continue
        if not bool(sess.get("auto_logout_midnight", True)):
            continue
        started_date = str(sess.get("started_date_tr") or "").strip()
        if not started_date:
            sess["started_date_tr"] = today_tr
            continue
        if started_date < today_tr:
            expired_items.append(dict(sess))
            sessions.pop(dev_key, None)

    if expired_items:
        if callable(save_fn):
            try:
                save_fn(settings_db)
            except Exception:
                pass
        if callable(log_fn):
            for exp in expired_items:
                try:
                    log_fn(
                        "HOTDESK",
                        "INFO",
                        f"Gece 00:00 otomatik Hot-Desk oturum kapatma: Dahili {exp.get('extension')} -> Cihaz {exp.get('device_sip_username')}",
                    )
                except Exception:
                    pass
    return expired_items


def check_user_has_pause_recording_perm(user_dict: Optional[dict], settings_db: dict) -> bool:
    if not isinstance(user_dict, dict):
        return False
    role_code = str(user_dict.get("role") or "agent").strip()
    role_low = role_code.lower()
    roles_list = settings_db.get("roles") or []
    matched_role = next(
        (r for r in roles_list if isinstance(r, dict) and str(r.get("role_code") or "").strip().lower() == role_low),
        None,
    )
    if matched_role and isinstance(matched_role.get("permissions"), list):
        perms = matched_role["permissions"]
        if "*" in perms or "call_panel:pause_recording" in perms:
            return True
        return False
    return role_low in ("admin", "superadmin")


def evaluate_boss_secretary_target(
    boss_user_dict: dict,
    caller_ext: str,
    channel_name: str,
    settings_db: dict,
    registered_endpoints: Any = None,
) -> Optional[str]:
    """
    Evaluates Boss/Secretary filter for `boss_user_dict`:
    - Returns None if Boss/Secretary mode is disabled, no secretary configured, or caller is Secretary / VIP!
    - Otherwise returns the target Secretary extension to intercept the call.
    """
    bs_cfg = normalize_boss_secretary_config(boss_user_dict.get("boss_secretary"))
    if not bs_cfg["enabled"] or not bs_cfg["secretaries"]:
        return None

    boss_ext = str(boss_user_dict.get("extension") or "").strip()
    eff_caller = str(caller_ext or "").strip()

    # Check Hot-Desk identity or SIP peer identity on calling channel
    hd_sess = resolve_hotdesk_session_for_channel(channel_name, settings_db)
    if hd_sess and hd_sess.get("extension"):
        eff_caller = str(hd_sess["extension"]).strip()
    elif channel_name:
        try:
            from backend.services.ami_manager import _extract_ext_from_channel
            ch_ext = _extract_ext_from_channel(channel_name)
            if ch_ext:
                eff_caller = ch_ext
        except Exception:
            pass

    if eff_caller and (
        eff_caller == boss_ext
        or eff_caller in bs_cfg["secretaries"]
        or eff_caller in bs_cfg["vip_whitelist"]
    ):
        return None

    # Prefer an online/registered secretary if multiple secretaries are configured
    if registered_endpoints is not None and len(bs_cfg["secretaries"]) > 1:
        from backend.services.autoprovision_service import normalize_user_sip_devices
        users_all = settings_db.get("users") or []
        for sec_ext in bs_cfg["secretaries"]:
            if sec_ext == boss_ext:
                continue
            if sec_ext in registered_endpoints:
                return sec_ext
            sec_u = next((u for u in users_all if isinstance(u, dict) and str(u.get("extension") or "").strip() == sec_ext), None)
            if sec_u:
                for sdev in normalize_user_sip_devices(sec_u):
                    if sdev.get("is_active") is not False and str(sdev.get("sip_username") or "").strip() in registered_endpoints:
                        return sec_ext

    for sec_ext in bs_cfg["secretaries"]:
        if sec_ext and sec_ext != boss_ext:
            return sec_ext
    return None


def compute_wav_duration_seconds(filepath: str) -> int:
    if not filepath or not os.path.exists(filepath):
        return 0
    try:
        with wave.open(filepath, "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            if rate > 0:
                return max(1, int(round(frames / float(rate))))
    except Exception:
        try:
            sz = os.path.getsize(filepath)
            if sz > 44:
                return max(1, int((sz - 44) / 16000))
        except Exception:
            pass
    return 0


async def send_voicemail_email_notification(
    to_email: str,
    user_full_name: str,
    extension: str,
    caller_number: str,
    duration_seconds: int,
    wav_path: str,
    created_at_utc: datetime.datetime,
    settings_db: dict,
) -> bool:
    to_addr = str(to_email or "").strip()
    if not to_addr or "@" not in to_addr:
        return False
    try:
        from backend.services.notification_service import normalize_smtp_host_and_port, deliver_mime_message_sync
        channels_cfg = settings_db.get("channels") or {}
        smtp_user = str(channels_cfg.get("email_smtp_user") or "").strip()
        smtp_pass = str(channels_cfg.get("email_smtp_pass") or "").strip()
        smtp_host, smtp_port = normalize_smtp_host_and_port(
            channels_cfg.get("email_smtp_host", ""),
            channels_cfg.get("email_smtp_port", 587),
            smtp_user,
        )
        use_tls = bool(channels_cfg.get("email_use_tls", True))
        if not smtp_host or not smtp_user:
            return False

        dt_tr = created_at_utc.replace(tzinfo=datetime.timezone.utc).astimezone(TR_TZ)
        time_str = dt_tr.strftime("%d.%m.%Y %H:%M:%S")

        msg = MIMEMultipart("mixed")
        msg["From"] = smtp_user
        msg["To"] = to_addr
        msg["Subject"] = f"Yeni Sesli Mesaj (Voicemail) - Arayan: {caller_number} (Dahili {extension})"

        body_plain = (
            f"Merhaba {user_full_name or extension},\n\n"
            f"Dahili hattınıza ({extension}) yeni bir sesli mesaj bırakıldı.\n\n"
            f"• Arayan Numara: {caller_number}\n"
            f"• Tarih / Saat: {time_str}\n"
            f"• Mesaj Süresi: {duration_seconds} saniye\n\n"
            f"Ses kaydı ekte (.wav) yer almaktadır. Ayrıca Web Çağrı Panelinizdeki 'Sesli Posta' sekmesinden veya masa telefonunuzdan *97 tuşlayarak dinleyebilirsiniz."
        )
        html_content = f"""
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
            <div style="max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 14px;">
              <h3 style="margin-top: 0; color: #e11d48;">Yeni Sesli Posta (Voicemail)</h3>
              <p>Merhaba <strong>{user_full_name or extension}</strong>, dahili hattınıza (<strong>{extension}</strong>) yeni bir sesli mesaj bırakıldı:</p>
              <ul style="background: #f8fafc; padding: 14px 18px 14px 34px; border-radius: 10px; border: 1px solid #e2e8f0;">
                <li><strong>Arayan Numara:</strong> {caller_number}</li>
                <li><strong>Tarih / Saat:</strong> {time_str}</li>
                <li><strong>Mesaj Süresi:</strong> {duration_seconds} saniye</li>
              </ul>
              <p style="font-size: 13px; color: #64748b;">Ses kaydı bu e-postanın ekinde yer almaktadır. Dilerseniz Web Panel &gt; Sesli Posta sekmesinden veya masa telefonunuzdan <strong>*97</strong> tuşlayarak da dinleyebilirsiniz.</p>
            </div>
          </body>
        </html>
        """
        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(body_plain, "plain", "utf-8"))
        alt.attach(MIMEText(html_content, "html", "utf-8"))
        msg.attach(alt)

        if wav_path and os.path.exists(wav_path) and os.path.isfile(wav_path):
            fname = f"sesli_mesaj_{extension}_{caller_number}_{dt_tr.strftime('%Y%m%d_%H%M%S')}.wav"
            with open(wav_path, "rb") as f:
                att = MIMEApplication(f.read(), Name=fname)
            att["Content-Disposition"] = f'attachment; filename="{fname}"'
            msg.attach(att)

        res = await asyncio.to_thread(
            deliver_mime_message_sync,
            smtp_host,
            smtp_port,
            smtp_user,
            smtp_pass,
            use_tls,
            [to_addr],
            msg.as_string(),
        )
        return res.get("status") == "success"
    except Exception as e_vm_mail:
        print(f"[Voicemail Email Warning]: {e_vm_mail}")
        return False


def sanitize_trunk_name_safe(name: Any) -> str:
    clean = re.sub(r"[^a-zA-Z0-9_\-.]", "_", str(name or "trunk").strip())
    return clean or "trunk"


def _parse_pjsip_registrations_cli_output(raw_text: str) -> Dict[str, str]:
    """
    Parses `asterisk -rx 'pjsip show registrations'` output into {reg_object_lower: status_lower}.
    Example row:
      908503607390-reg/sip:ikonsip.com:5060   908503607390-auth   Registered   (exp. 3412s)
    """
    reg_map: Dict[str, str] = {}
    known_statuses = {"registered", "unregistered", "rejected", "attempting", "stopped"}
    for line in (raw_text or "").splitlines():
        ls = line.strip()
        if not ls or ls.startswith("<") or ls.startswith("=") or ls.lower().startswith("objects found") or ls.lower().startswith("no objects"):
            continue
        parts = ls.split()
        if len(parts) < 3 or "/" not in parts[0]:
            continue
        reg_name = parts[0].split("/", 1)[0].strip().lower()
        if not reg_name:
            continue
        matched_st = ""
        for tok in parts[1:]:
            tl = tok.strip().lower()
            if tl in known_statuses:
                matched_st = tl
                break
        if matched_st:
            reg_map[reg_name] = matched_st
    return reg_map


def _parse_pjsip_registration_detail_cli_output(raw_text: str) -> str:
    """
    Parses `asterisk -rx 'pjsip show registration <name>-reg'` output and returns status_lower or ''.
    """
    if not raw_text or "Unable to find object" in raw_text or "No objects found" in raw_text:
        return ""
    m_param = re.search(r"^\s*status\s*:\s*([A-Za-z]+)", raw_text, re.IGNORECASE | re.MULTILINE)
    if m_param:
        return m_param.group(1).strip().lower()
    summary_map = _parse_pjsip_registrations_cli_output(raw_text)
    if summary_map:
        return next(iter(summary_map.values()))
    return ""


def _parse_pjsip_contacts_cli_output(raw_text: str) -> Dict[str, List[str]]:
    """
    Parses `asterisk -rx 'pjsip show contacts'` or `pjsip show aor <aor>` output into
    {aor_name_lower: [status_lower, ...]}.
    Example row:
      Contact:  test-aor/sip:1.2.3.4:5060   88a12b33c9 Unavail   0.000
    """
    aor_map: Dict[str, List[str]] = {}
    known_contact_states = {"avail", "unavail", "unknown", "nonqual", "created", "removed", "reachable", "unreachable"}
    for line in (raw_text or "").splitlines():
        ls = line.strip()
        if not ls.startswith("Contact:"):
            continue
        rest = ls[len("Contact:"):].strip()
        if not rest or rest.startswith("<"):
            continue
        parts = rest.split()
        if len(parts) < 3:
            continue
        aor_name = parts[0].split("/", 1)[0].strip().lower()
        if not aor_name:
            continue
        matched_st = ""
        for tok in parts[1:]:
            tl = tok.strip().lower()
            if tl in known_contact_states:
                matched_st = tl
                break
        if matched_st:
            aor_map.setdefault(aor_name, []).append(matched_st)
    return aor_map


def _collect_asterisk_cli_trunk_snapshot(trunks_list: List[dict]) -> Tuple[bool, Dict[str, str], Dict[str, List[str]]]:
    """
    Runs Asterisk CLI commands synchronously (meant to be invoked via asyncio.to_thread)
    to gather live PJSIP registration states and AOR contact qualify states.
    """
    import subprocess

    def _run_cli(cmd_str: str, timeout_s: float = 2.0) -> Tuple[bool, str]:
        try:
            proc = subprocess.run(
                ["asterisk", "-rx", cmd_str],
                capture_output=True,
                text=True,
                timeout=timeout_s,
                check=False,
            )
            out = (proc.stdout or proc.stderr or "").strip()
            if proc.returncode == 0 and "Unable to connect to remote asterisk" not in out:
                return True, out
        except FileNotFoundError:
            pass
        except Exception:
            return False, ""

        try:
            proc_d = subprocess.run(
                ["docker", "exec", "ai_pbx_asterisk", "asterisk", "-rx", cmd_str],
                capture_output=True,
                text=True,
                timeout=timeout_s,
                check=False,
            )
            out_d = (proc_d.stdout or proc_d.stderr or "").strip()
            if proc_d.returncode == 0 and "Unable to connect to remote asterisk" not in out_d:
                return True, out_d
        except Exception:
            pass
        return False, ""

    ok_reg, raw_regs = _run_cli("pjsip show registrations", 2.0)
    ok_con, raw_cons = _run_cli("pjsip show contacts", 2.0)
    if not ok_reg and not ok_con:
        return False, {}, {}

    reg_map = _parse_pjsip_registrations_cli_output(raw_regs) if ok_reg else {}
    aor_map = _parse_pjsip_contacts_cli_output(raw_cons) if ok_con else {}

    for t in trunks_list or []:
        if not isinstance(t, dict) or t.get("is_active", True) is False:
            continue
        raw_name = t.get("trunk_name") or t.get("name") or "trunk"
        safe_name = sanitize_trunk_name_safe(raw_name)
        t_type = str(t.get("trunk_type") or "register").strip().lower()
        if t_type == "ip":
            t_type = "peer"

        if t_type == "register":
            reg_key = f"{safe_name}-reg".lower()
            if reg_key not in reg_map:
                ok_d, raw_d = _run_cli(f"pjsip show registration {safe_name}-reg", 1.5)
                if ok_d:
                    det_st = _parse_pjsip_registration_detail_cli_output(raw_d)
                    if det_st:
                        reg_map[reg_key] = det_st
        else:
            aor_key = f"{safe_name}-aor".lower()
            if aor_key not in aor_map:
                ok_a, raw_a = _run_cli(f"pjsip show aor {safe_name}-aor", 1.5)
                if ok_a and "Unable to find object" not in raw_a:
                    parsed_a = _parse_pjsip_contacts_cli_output(raw_a)
                    for k_a, v_a in parsed_a.items():
                        aor_map.setdefault(k_a, []).extend(v_a)
            if t_type == "account":
                acc_user = sanitize_trunk_name_safe(str(t.get("username") or "").strip())
                if acc_user and acc_user.lower() != safe_name.lower() and acc_user.lower() not in aor_map:
                    ok_u, raw_u = _run_cli(f"pjsip show aor {acc_user}", 1.5)
                    if ok_u and "Unable to find object" not in raw_u:
                        parsed_u = _parse_pjsip_contacts_cli_output(raw_u)
                        for k_u, v_u in parsed_u.items():
                            aor_map.setdefault(k_u, []).extend(v_u)

    return True, reg_map, aor_map


async def inspect_live_trunks_pjsip_status(trunks_list: List[dict]) -> Dict[Any, str]:
    """
    Evaluates real-time Asterisk PJSIP trunk status for all trunk types:
      - 'register': checks PJSIP outbound registration (`<name>-reg` == 'Registered').
      - 'peer' / 'ip': checks PJSIP AOR SIP OPTIONS qualify status (`<name>-aor` == 'Avail' / 'Reachable').
      - 'account': checks inbound registered contacts on `<name>-aor` / `<username>`.
      - disabled trunks (`is_active == False`): returns 'passive'.
    Never uses DNS/socket.gethostbyname to mark unreachable IPs (like 1.2.3.4) as active.
    """
    status_dict: Dict[Any, str] = {}
    if not trunks_list:
        return status_dict

    cli_ok, reg_map, aor_map = await asyncio.to_thread(_collect_asterisk_cli_trunk_snapshot, trunks_list)
    ami_ok = False

    if not cli_ok:
        try:
            from backend.services.ami_manager import get_ami_manager, _iter_ami_responses
            manager = await get_ami_manager()
            if manager:
                try:
                    res_reg = await asyncio.wait_for(
                        manager.send_action({"Action": "PJSIPShowRegistrationsOutbound"}),
                        timeout=2.5,
                    )
                    if res_reg is not None:
                        ami_ok = True
                    for ev in _iter_ami_responses(res_reg):
                        if not hasattr(ev, "get"):
                            continue
                        obj_name = str(ev.get("ObjectName") or ev.get("Registration") or "").strip().lower()
                        st_val = str(ev.get("Status") or "").strip().lower()
                        if obj_name and st_val:
                            reg_map[obj_name] = st_val
                except Exception:
                    pass

                try:
                    res_con = await asyncio.wait_for(
                        manager.send_action({"Action": "PJSIPShowContacts"}),
                        timeout=2.5,
                    )
                    if res_con is not None:
                        ami_ok = True
                    for ev in _iter_ami_responses(res_con):
                        if not hasattr(ev, "get"):
                            continue
                        aor_name = str(ev.get("AOR") or ev.get("Endpoint") or "").strip().lower()
                        st_val = str(ev.get("Status") or ev.get("ContactStatus") or "").strip().lower()
                        if aor_name and st_val:
                            aor_map.setdefault(aor_name, []).append(st_val)
                except Exception:
                    pass
        except Exception:
            pass

    ast_reachable = cli_ok or ami_ok

    for t in trunks_list:
        if not isinstance(t, dict):
            continue
        trunk_id = t.get("id")
        if trunk_id is None:
            continue

        if t.get("is_active", True) is False:
            status_dict[trunk_id] = "passive"
            continue

        if not ast_reachable:
            status_dict[trunk_id] = "inactive"
            continue

        raw_name = t.get("trunk_name") or t.get("name") or "trunk"
        safe_name = sanitize_trunk_name_safe(raw_name)
        t_type = str(t.get("trunk_type") or "register").strip().lower()
        if t_type == "ip":
            t_type = "peer"

        host = str(t.get("host") or "").strip()
        username = str(t.get("username") or "").strip()

        if t_type == "register":
            if not host or not username:
                status_dict[trunk_id] = "inactive"
                continue
            reg_st = reg_map.get(f"{safe_name}-reg".lower(), "")
            if reg_st == "registered":
                status_dict[trunk_id] = "registered"
            elif reg_st == "attempting":
                status_dict[trunk_id] = "trying"
            else:
                status_dict[trunk_id] = "inactive"

        elif t_type == "peer":
            if not host:
                status_dict[trunk_id] = "inactive"
                continue
            c_states = aor_map.get(f"{safe_name}-aor".lower(), [])
            if any(s in ("avail", "reachable") for s in c_states):
                status_dict[trunk_id] = "active"
            elif any(s == "unknown" for s in c_states):
                status_dict[trunk_id] = "trying"
            else:
                status_dict[trunk_id] = "inactive"

        elif t_type == "account":
            c_states = list(aor_map.get(f"{safe_name}-aor".lower(), []))
            acc_user = sanitize_trunk_name_safe(username) if username else ""
            if acc_user and acc_user.lower() != safe_name.lower():
                c_states.extend(aor_map.get(acc_user.lower(), []))
            if any(s in ("avail", "reachable", "nonqual", "nonqualified", "created", "registered") for s in c_states):
                status_dict[trunk_id] = "registered"
            else:
                status_dict[trunk_id] = "inactive"
        else:
            status_dict[trunk_id] = "inactive"

    return status_dict

