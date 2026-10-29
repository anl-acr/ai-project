import os
import asyncio
from panoramisk import Manager

AMI_HOST = os.getenv("AMI_HOST", "localhost")
AMI_PORT = int(os.getenv("AMI_PORT", 5038))
AMI_USER = os.getenv("AMI_USER", "ai_backend_user")
AMI_SECRET = os.getenv("AMI_SECRET", "backend_secure_key_99")

# Registry to map uniqueid -> active Asterisk channel name
active_channels = {}
# Registry to map uniqueid -> {"channel": str, "caller": str, "exten": str, "state": "ringing"|"busy"}
channel_states = {}
# Registry to map Call UUID (call_id) -> Asterisk's internal Uniqueid (asterisk_id)
call_id_to_asterisk_id = {}
# Registry to map child Uniqueid -> master Linkedid for multi-leg bridged calls
uniqueid_to_linkedid = {}
# Registry to record the FIRST leg that initiated hangup per Linkedid / Uniqueid
first_hangup_by_id = {}


def _record_first_hangup(uniqueid: str, linkedid: str, channel: str, caller: str = "", cause: str = ""):
    ch = str(channel or "").strip()
    if not ch:
        return
    # Skip internal Local/ helper legs if not informative
    if ch.lower().startswith("local/"):
        return
    uid_s = str(uniqueid or "").strip()
    lid_s = str(linkedid or "").strip() or uniqueid_to_linkedid.get(uid_s, "") or uid_s
    info = {
        "channel": ch,
        "caller": str(caller or "").strip(),
        "cause": str(cause or "").strip(),
    }
    if len(first_hangup_by_id) > 800:
        # Evict oldest ~200 entries to bound memory
        for old_k in list(first_hangup_by_id.keys())[:200]:
            first_hangup_by_id.pop(old_k, None)
    if lid_s and lid_s not in first_hangup_by_id:
        first_hangup_by_id[lid_s] = info
    if uid_s and uid_s not in first_hangup_by_id:
        first_hangup_by_id[uid_s] = info


def classify_hangup_channel(chan_name: str, caller_num: str = "", callee_num: str = "") -> str:
    """
    Classifies an Asterisk channel string (e.g. 'PJSIP/1000-0000001a' or 'PJSIP/Operator_Trunk-0000001b')
    into an ended_by identifier:
      - 'ext:<ext>' for internal SIP/PJSIP subscriber extensions (e.g. 'ext:1000')
      - 'ai' for AudioSocket / AI channels
      - 'customer' for external SIP trunk legs
      - '' if unknown
    """
    import re
    ch = str(chan_name or "").strip()
    if not ch:
        return ""
    if ch.lower().startswith("audiosocket/"):
        return "ai"
    m = re.match(r"^(?:PJSIP|SIP|IAX2)/([^-\;@/]+)", ch, re.IGNORECASE)
    if not m:
        return ""
    peer = m.group(1).strip()
    if not peer:
        return ""
    if peer.lower() == "ai":
        return "ai"
    # Short numeric peer (e.g. 100, 1000, 1001) is an internal extension
    if peer.isdigit() and len(peer) <= 6:
        return f"ext:{peer}"
    # Otherwise peer is a SIP Trunk name or DID (e.g. Operator_Trunk, 908503607390, Ikon_Trunk) -> remote/customer side hung up
    return "customer"


def resolve_hangup_initiator(call_id: str, caller_num: str = "", callee_num: str = "", hangupsource_chan: str = "") -> str:
    """Resolves who terminated the call using dialplan CHANNEL(hangupsource) or AMI first-hangup tracking."""
    if hangupsource_chan:
        classified = classify_hangup_channel(hangupsource_chan, caller_num, callee_num)
        if classified:
            return classified
    ast_id = str(call_id_to_asterisk_id.get(str(call_id or "").strip()) or "").strip()
    for lookup_key in (ast_id, str(call_id or "").strip()):
        if lookup_key and lookup_key in first_hangup_by_id:
            ch = first_hangup_by_id[lookup_key].get("channel") or ""
            classified = classify_hangup_channel(ch, caller_num, callee_num)
            if classified:
                return classified
    return ""


class RegisteredEndpointsDict(dict):
    def add(self, key, ip=""):
        k = str(key)
        ip_s = str(ip or "").strip()
        existing = self.get(k, "")
        if ip_s in ("", "127.0.0.1", "::1", "localhost") and existing and existing not in ("", "127.0.0.1", "::1", "localhost"):
            return
        self[k] = ip_s

    def discard(self, key):
        self.pop(str(key), None)

    def get_ip(self, key):
        return self.get(str(key), "")

registered_endpoints = RegisteredEndpointsDict()
manager_instance = None

def get_extension_call_state(ext: str):
    """Returns 'busy' if the extension is in an active/Up channel, 'ringing' if ringing, or None."""
    ext_s = str(ext or "").strip()
    if not ext_s:
        return None
    found_ringing = False
    pjsip_prefix = f"pjsip/{ext_s.lower()}-"
    sip_prefix = f"sip/{ext_s.lower()}-"
    for uid, info in list(channel_states.items()):
        ch_lower = str(info.get("channel") or "").lower()
        caller_s = str(info.get("caller") or "").strip()
        exten_s = str(info.get("exten") or "").strip()
        st = info.get("state") or "ringing"
        if ch_lower.startswith(pjsip_prefix) or ch_lower.startswith(sip_prefix) or caller_s == ext_s or exten_s == ext_s:
            if st == "busy":
                return "busy"
            # If this extension is the caller initiating an outbound/internal call, its state is busy
            if caller_s == ext_s and exten_s and exten_s != ext_s:
                return "busy"
            found_ringing = True
    if found_ringing:
        return "ringing"
    for uid, ch in list(active_channels.items()):
        ch_lower = str(ch or "").lower()
        if ch_lower.startswith(pjsip_prefix) or ch_lower.startswith(sip_prefix):
            return "busy"
    return None


def get_extension_ringing_info(ext: str):
    """Returns {'ringing_ext': ext, 'caller_number': caller, 'channel': ch} if ext is currently ringing in AMI channel_states."""
    ext_s = str(ext or "").strip()
    if not ext_s:
        return None
    pjsip_prefix = f"pjsip/{ext_s.lower()}-"
    sip_prefix = f"sip/{ext_s.lower()}-"
    ringing_match = None
    for uid, info in list(channel_states.items()):
        ch = str(info.get("channel") or "")
        ch_lower = ch.lower()
        caller_s = str(info.get("caller") or "").strip()
        exten_s = str(info.get("exten") or "").strip()
        st = info.get("state") or "ringing"
        if ch_lower.startswith(pjsip_prefix) or ch_lower.startswith(sip_prefix) or exten_s == ext_s:
            if st == "busy":
                return None
            if caller_s != ext_s:
                ringing_match = {
                    "ringing_ext": ext_s,
                    "caller_number": caller_s,
                    "channel": ch
                }
    return ringing_match


async def find_ringing_channel_for_extension(target_ext: str) -> str:
    """Finds the exact ringing PJSIP/SIP channel name for target_ext to use with Asterisk PickupChan()."""
    ext_s = str(target_ext or "").strip()
    if not ext_s:
        return ""
    pjsip_prefix = f"pjsip/{ext_s.lower()}-"
    sip_prefix = f"sip/{ext_s.lower()}-"

    for uid, info in list(channel_states.items()):
        ch = str(info.get("channel") or "").strip()
        if ch and (ch.lower().startswith(pjsip_prefix) or ch.lower().startswith(sip_prefix)):
            if info.get("state") != "busy":
                return ch

    manager = await get_ami_manager()
    if manager:
        try:
            res = await manager.send_action({"Action": "CoreShowChannels"})
            for r in _iter_ami_responses(res):
                if not hasattr(r, "get"):
                    continue
                ch = str(r.get("Channel") or "").strip()
                st_desc = str(r.get("ChannelStateDesc") or "").strip().lower()
                if ch and (ch.lower().startswith(pjsip_prefix) or ch.lower().startswith(sip_prefix)):
                    if st_desc in ("ringing", "ring", "down", "rsrvd"):
                        return ch
        except Exception as e:
            print(f"[AMI] find_ringing_channel_for_extension error: {e}")

    return ""

async def _check_and_hangup_blacklisted_channel(manager: Manager, channel: str, uniqueid: str, caller_num: str, exten: str):
    try:
        from backend.main import is_phone_or_value_blacklisted, add_system_log
        is_bl, bl_reason = await is_phone_or_value_blacklisted(caller_num)
        if not is_bl and exten and exten not in ("s", "h"):
            is_bl, bl_reason = await is_phone_or_value_blacklisted(exten)
        if is_bl:
            print(f"[AMI Abuse Shield] Newchannel Blacklist Match! Anında sonlandırılıyor -> Channel={channel}, Caller={caller_num}, Exten={exten} ({bl_reason})")
            try:
                await manager.send_action({
                    "Action": "Hangup",
                    "Channel": channel,
                    "Cause": "21"
                })
            except Exception as e_h:
                print(f"[AMI Newchannel Hangup Error]: {e_h}")
            try:
                import subprocess
                subprocess.run(["asterisk", "-rx", f"channel request hangup {channel}"], check=False, timeout=1.5)
            except Exception:
                pass
            try:
                add_system_log("ABUSE_SHIELD", "WARNING", f"Kara Liste Çağrı Anında Reddedildi (Newchannel): {caller_num} -> {exten} ({bl_reason})")
            except Exception:
                pass
    except Exception as e:
        print(f"[AMI Blacklist Check Error]: {e}")


def _iter_ami_responses(res):
    if not res:
        return []
    if isinstance(res, list):
        return res
    if hasattr(res, "responses") and res.responses:
        return list(res.responses)
    return [res]


def register_event_handlers(manager: Manager):
    @manager.register_event('Newchannel')
    def handle_new_channel(m, event):
        uniqueid = event.get('Uniqueid')
        linkedid = event.get('Linkedid')
        channel = event.get('Channel')
        caller_num = str(event.get('CallerIDNum') or "").strip()
        exten = str(event.get('Exten') or "").strip()
        state_desc = str(event.get('ChannelStateDesc') or "").strip().lower()
        init_state = "busy" if state_desc == "up" else "ringing"
        if uniqueid and linkedid:
            if len(uniqueid_to_linkedid) > 1000:
                for old_k in list(uniqueid_to_linkedid.keys())[:250]:
                    uniqueid_to_linkedid.pop(old_k, None)
            uniqueid_to_linkedid[str(uniqueid)] = str(linkedid)
        if uniqueid and channel:
            active_channels[uniqueid] = channel
            channel_states[uniqueid] = {
                "channel": channel,
                "caller": caller_num,
                "exten": exten,
                "state": init_state
            }
            print(f"[AMI] Yeni Kanal Kaydedildi: {uniqueid} -> {channel} (Caller: {caller_num}, Exten: {exten}, State: {init_state})")
            if caller_num or exten:
                asyncio.create_task(_check_and_hangup_blacklisted_channel(m, channel, uniqueid, caller_num, exten))

    @manager.register_event('HangupRequest')
    def handle_hangup_request(m, event):
        _record_first_hangup(
            uniqueid=event.get('Uniqueid'),
            linkedid=event.get('Linkedid'),
            channel=event.get('Channel'),
            caller=event.get('CallerIDNum'),
            cause=event.get('Cause')
        )

    @manager.register_event('SoftHangupRequest')
    def handle_soft_hangup_request(m, event):
        _record_first_hangup(
            uniqueid=event.get('Uniqueid'),
            linkedid=event.get('Linkedid'),
            channel=event.get('Channel'),
            caller=event.get('CallerIDNum'),
            cause=event.get('Cause')
        )

    @manager.register_event('Newstate')
    def handle_new_state(m, event):
        uniqueid = event.get('Uniqueid')
        channel = event.get('Channel')
        caller_num = str(event.get('CallerIDNum') or "").strip()
        exten = str(event.get('Exten') or "").strip()
        connected_num = str(event.get('ConnectedLineNum') or "").strip()
        state_desc = str(event.get('ChannelStateDesc') or "").strip().lower()
        state_code = str(event.get('ChannelState') or "").strip()
        if uniqueid:
            mapped = "busy" if (state_desc == "up" or state_code == "6") else "ringing"
            existing = channel_states.get(uniqueid, {})
            channel_states[uniqueid] = {
                "channel": channel or existing.get("channel") or active_channels.get(uniqueid, ""),
                "caller": caller_num or existing.get("caller") or "",
                "exten": exten or connected_num or existing.get("exten") or "",
                "state": mapped
            }
            try:
                import re
                from backend.main import set_live_extension_call_state
                ch_s = str(channel_states[uniqueid].get("channel") or "")
                m_ext = re.search(r"(?:PJSIP|SIP)/(\d+)-", ch_s, re.IGNORECASE)
                ch_ext = m_ext.group(1) if m_ext else ""
                if mapped == "busy":
                    if ch_ext:
                        set_live_extension_call_state(ch_ext, "busy")
                        from backend.services.agent_presence import reset_agent_missed_calls
                        reset_agent_missed_calls(ch_ext)
                    c_num = channel_states[uniqueid].get("caller") or ""
                    e_num = channel_states[uniqueid].get("exten") or ""
                    if c_num and c_num.isdigit() and len(c_num) <= 5:
                        set_live_extension_call_state(c_num, "busy")
                    if e_num and e_num.isdigit() and len(e_num) <= 5:
                        set_live_extension_call_state(e_num, "busy")
                elif state_desc == "ringing" or state_code == "5":
                    if ch_ext:
                        set_live_extension_call_state(ch_ext, "ringing", caller_number=caller_num)
            except Exception:
                pass

    @manager.register_event('Hangup')
    def handle_hangup(m, event):
        uniqueid = event.get('Uniqueid')
        linkedid = event.get('Linkedid')
        old_info = channel_states.pop(uniqueid, None) or {}
        old_ch = active_channels.pop(uniqueid, None) or old_info.get("channel") or event.get('Channel') or ""
        _record_first_hangup(
            uniqueid=uniqueid,
            linkedid=linkedid,
            channel=old_ch,
            caller=event.get('CallerIDNum') or old_info.get("caller") or "",
            cause=event.get('Cause') or ""
        )
        if old_ch:
            print(f"[AMI] Kanal Silindi (Hangup): {uniqueid} ({old_ch})")
        try:
            import re
            from backend.main import set_live_extension_call_state
            candidates = set()
            m_ext = re.search(r"(?:PJSIP|SIP)/(\d+)-", str(old_ch), re.IGNORECASE)
            if m_ext:
                candidates.add(m_ext.group(1))
            for k in ("caller", "exten"):
                v = str(old_info.get(k) or "").strip()
                if v.isdigit() and len(v) <= 5:
                    candidates.add(v)
            for ext_cand in candidates:
                if get_extension_call_state(ext_cand) is None:
                    set_live_extension_call_state(ext_cand, None)
        except Exception:
            pass

    @manager.register_event('ContactStatus')
    def handle_contact_status(m, event):
        import re
        aor = event.get('AOR')
        status = event.get('ContactStatus')
        uri = event.get('URI') or event.get('Contact') or event.get('ViaAddress') or ""
        ip_match = re.search(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', uri)
        extracted_ip = ip_match.group(0) if ip_match else ""
        if aor:
            if status in ["Reachable", "Created", "Registered"]:
                registered_endpoints.add(aor, extracted_ip)
                print(f"[AMI] Endpoint Kaydedildi: {aor} (IP: {extracted_ip})")
                try:
                    from backend.services.agent_presence import handle_agent_reconnect_auto_pause
                    asyncio.create_task(handle_agent_reconnect_auto_pause(str(aor)))
                except Exception as e_rec:
                    print(f"[AMI AutoPause Reconnect Hook Error]: {e_rec}")
            elif status in ["Removed", "Unreachable", "Unknown"]:
                registered_endpoints.discard(aor)
                print(f"[AMI] Endpoint Koptu: {aor}")
                try:
                    from backend.services.agent_presence import schedule_agent_disconnect_auto_pause
                    asyncio.create_task(schedule_agent_disconnect_auto_pause(str(aor)))
                except Exception as e_dc:
                    print(f"[AMI AutoPause Disconnect Hook Error]: {e_dc}")

    @manager.register_event('QueueCallerJoin')
    def handle_queue_caller_join(m, event):
        q_name = str(event.get('Queue') or "").strip()
        caller_num = str(event.get('CallerIDNum') or "").strip()
        uniqueid = str(event.get('Uniqueid') or "").strip()
        if q_name:
            try:
                from backend.main import handle_ami_queue_call_event
                asyncio.create_task(handle_ami_queue_call_event("join", q_name, caller_num, "", uniqueid))
            except Exception as e_qj:
                print(f"[AMI QueueCallerJoin Hook Error]: {e_qj}")

    @manager.register_event('QueueCallerAbandon')
    def handle_queue_caller_abandon(m, event):
        q_name = str(event.get('Queue') or "").strip()
        caller_num = str(event.get('CallerIDNum') or "").strip()
        uniqueid = str(event.get('Uniqueid') or "").strip()
        if q_name:
            try:
                from backend.main import handle_ami_queue_call_event
                asyncio.create_task(handle_ami_queue_call_event("abandon", q_name, caller_num, "", uniqueid))
            except Exception as e_qa:
                print(f"[AMI QueueCallerAbandon Hook Error]: {e_qa}")

    @manager.register_event('AgentRingNoAnswer')
    def handle_agent_ring_no_answer(m, event):
        import re
        iface = str(event.get('Interface') or event.get('MemberName') or "").strip()
        q_name = str(event.get('Queue') or "").strip()
        caller_num = str(event.get('CallerIDNum') or "").strip()
        uniqueid = str(event.get('Uniqueid') or "").strip()
        m_ext = re.search(r"(?:PJSIP|SIP)/(\d+)", iface, re.IGNORECASE)
        ext_val = m_ext.group(1) if m_ext else iface
        if ext_val:
            print(f"[AMI] AgentRingNoAnswer: {ext_val} (Queue: {q_name})")
            try:
                from backend.services.agent_presence import handle_agent_missed_call_for_auto_pause
                asyncio.create_task(handle_agent_missed_call_for_auto_pause(ext_val, queue_ext=q_name))
            except Exception as e_rna:
                print(f"[AMI AgentRingNoAnswer AutoPause Error]: {e_rna}")
            if q_name:
                try:
                    from backend.main import handle_ami_queue_call_event
                    asyncio.create_task(handle_ami_queue_call_event("ring_no_answer", q_name, caller_num, ext_val, uniqueid))
                except Exception:
                    pass

    @manager.register_event('AgentConnect')
    def handle_agent_connect(m, event):
        import re
        iface = str(event.get('Interface') or event.get('MemberName') or "").strip()
        q_name = str(event.get('Queue') or "").strip()
        caller_num = str(event.get('CallerIDNum') or "").strip()
        uniqueid = str(event.get('Uniqueid') or "").strip()
        m_ext = re.search(r"(?:PJSIP|SIP)/(\d+)", iface, re.IGNORECASE)
        ext_val = m_ext.group(1) if m_ext else iface
        if ext_val:
            try:
                from backend.services.agent_presence import reset_agent_missed_calls
                reset_agent_missed_calls(ext_val)
            except Exception:
                pass
            if q_name:
                try:
                    from backend.main import handle_ami_queue_call_event
                    asyncio.create_task(handle_ami_queue_call_event("connect", q_name, caller_num, ext_val, uniqueid))
                except Exception as e_ac:
                    print(f"[AMI AgentConnect Hook Error]: {e_ac}")

    def _handle_ami_security_event(m, event):
        import re
        ev_name = str(event.get('Event') or "Security").strip()
        remote_addr = str(event.get('RemoteAddress') or "").strip()
        account_id = str(event.get('AccountID') or "").strip()
        service = str(event.get('Service') or "PJSIP").strip()
        # Format: IPV4/UDP/85.184.251.234/61661
        m_ip = re.search(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})", remote_addr)
        if not m_ip:
            return
        ip_addr = m_ip.group(1)
        try:
            from backend.main import record_and_ban_realtime_sip_attack
            record_and_ban_realtime_sip_attack(
                ip_addr=ip_addr,
                event_type=ev_name,
                account_id=account_id,
                service=service
            )
        except Exception as e_sec:
            print(f"[AMI Security Handler Error]: {e_sec}")

    for sec_ev in ('InvalidAccountID', 'ChallengeResponseFailed', 'InvalidPassword', 'FailedACL', 'RequestNotSupported', 'UnexpectedAddress'):
        manager.register_event(sec_ev)(_handle_ami_security_event)


_last_asterisk_self_heal_ts = 0.0


def _probe_ami_banner_sync(timeout_sec: float = 2.0) -> bool:
    """Probes AMI port and verifies that Asterisk actually sends its 'Asterisk Call Manager' banner (not deadlocked)."""
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout_sec)
    try:
        s.connect((AMI_HOST, AMI_PORT))
        banner = s.recv(128)
        return bool(banner and b"Asterisk" in banner)
    except Exception:
        return False
    finally:
        try:
            s.close()
        except Exception:
            pass


def ensure_asterisk_alive_sync(force_restart: bool = False) -> bool:
    """
    Checks if local Asterisk is responsive on AMI (port 5038).
    If deadlocked (TCP open but 0 bytes returned) or stopped on a Linux host, force-restarts Asterisk cleanly.
    """
    global _last_asterisk_self_heal_ts
    import time, subprocess
    if not os.path.exists("/etc/asterisk"):
        return False

    if not force_restart and _probe_ami_banner_sync(timeout_sec=2.0):
        return True

    now = time.time()
    if not force_restart and (now - _last_asterisk_self_heal_ts) < 45.0:
        return False
    _last_asterisk_self_heal_ts = now

    print("[AMI Self-Heal] Asterisk AMI yanıt vermiyor veya kilitlendi (deadlock). Otomatik kurtarma başlatılıyor...")
    try:
        if os.path.exists("/etc/asterisk/keys"):
            os.chmod("/etc/asterisk/keys", 0o755)
            for fn in os.listdir("/etc/asterisk/keys"):
                fp = os.path.join("/etc/asterisk/keys", fn)
                if os.path.isfile(fp):
                    os.chmod(fp, 0o644)
        subprocess.run(
            ["chown", "-R", "asterisk:asterisk", "/etc/asterisk/keys", "/var/log/asterisk", "/var/run/asterisk"],
            check=False, capture_output=True, timeout=3.0
        )
    except Exception:
        pass

    try:
        subprocess.run(["systemctl", "kill", "-s", "SIGKILL", "asterisk"], check=False, capture_output=True, timeout=3.0)
    except Exception:
        pass
    try:
        subprocess.run(["killall", "-9", "asterisk"], check=False, capture_output=True, timeout=3.0)
    except Exception:
        pass
    time.sleep(0.5)
    try:
        subprocess.run(["systemctl", "restart", "asterisk"], check=False, capture_output=True, timeout=8.0)
    except Exception:
        try:
            subprocess.run(["service", "asterisk", "restart"], check=False, capture_output=True, timeout=8.0)
        except Exception:
            pass

    for _ in range(8):
        time.sleep(0.6)
        if _probe_ami_banner_sync(timeout_sec=1.5):
            print("[AMI Self-Heal] Asterisk servisi başarıyla kurtarıldı ve AMI aktif!")
            return True
    return False


async def get_ami_manager() -> Manager:
    """Returns or initializes the active AMI manager connection."""
    global manager_instance
    if manager_instance is not None and getattr(manager_instance, "_connected", False):
        return manager_instance

    # Close any stale disconnected manager instance before creating a new one
    if manager_instance is not None:
        try:
            manager_instance.close()
        except Exception:
            pass
        manager_instance = None

    # Verify AMI socket is responsive (not deadlocked) before connecting panoramisk
    banner_ok = await asyncio.to_thread(_probe_ami_banner_sync, 1.8)
    if not banner_ok and os.path.exists("/etc/asterisk"):
        recovered = await asyncio.to_thread(ensure_asterisk_alive_sync, False)
        if not recovered:
            return None

    print(f"[AMI] Connecting to Asterisk AMI at {AMI_HOST}:{AMI_PORT}...")
    try:
        mgr = Manager(
            host=AMI_HOST,
            port=AMI_PORT,
            username=AMI_USER,
            secret=AMI_SECRET,
            loop=asyncio.get_event_loop()
        )
        await asyncio.wait_for(mgr.connect(), timeout=2.0)
        register_event_handlers(mgr)
        manager_instance = mgr
        print("[AMI] Connected successfully and event handlers registered!")

        # Fetch initial SIP registration states with strict timeout so it never hangs
        try:
            res = await asyncio.wait_for(mgr.send_action({"Action": "PJSIPShowContacts"}), timeout=2.5)
            for r in _iter_ami_responses(res):
                if hasattr(r, "get") and r.get('Event') == 'ContactList':
                    aor = r.get('AOR') or r.get('ObjectName')
                    status = r.get('Status')
                    uri = r.get('URI') or r.get('ViaAddress') or ""
                    import re
                    ip_match = re.search(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', uri)
                    extracted_ip = ip_match.group(0) if ip_match else ""
                    if aor and status in ["Reachable", "Created", "Registered"]:
                        registered_endpoints.add(aor, extracted_ip)
        except Exception as ex:
            print(f"[AMI] Error fetching initial contacts: {ex}")
    except Exception as e:
        print(f"[AMI] Connection error: {e}")
        manager_instance = None
    return manager_instance

async def redirect_call_to_human(call_id: str, extension: str = "transfer_to_human", context: str = "default") -> bool:
    """
    AMI command to redirect the Asterisk call to the human agent queue/extension.
    Uses the uniqueid (call_id) to look up the active channel name.
    """
    manager = await get_ami_manager()
    if not manager:
        print("[AMI] Hata: AMI baglantisi kurulamadigi icin transfer iptal edildi.")
        return False

    ast_id = call_id_to_asterisk_id.get(call_id, call_id)
    channel_name = active_channels.get(ast_id)
    
    if not channel_name:
        for k, v in list(active_channels.items()):
            if k in ast_id or ast_id in k or k in call_id or call_id in k:
                channel_name = v
                break
                
    if not channel_name:
        try:
            res = await manager.send_action({"Action": "CoreShowChannels"})
            for r in _iter_ami_responses(res):
                if not hasattr(r, "get"):
                    continue
                ch = r.get('Channel')
                uid = r.get('Uniqueid')
                if ch and uid:
                    active_channels[uid] = ch
                    if uid == ast_id or uid in ast_id or ast_id in uid:
                        channel_name = ch
            if not channel_name and active_channels:
                if len(active_channels) == 1:
                    channel_name = list(active_channels.values())[0]
        except Exception as ex:
            print(f"[AMI] CoreShowChannels error: {ex}")

    if not channel_name:
        print(f"[AMI] Hata: UniqueID {call_id} (Asterisk ID: {ast_id}) için aktif kanal adi bulunamadi.")
        return False

    print(f"[AMI] Kanal {channel_name} transfer ediliyor -> Exten: {extension}, Context: {context}")
    
    # Send Redirect action
    action = {
        'Action': 'Redirect',
        'Channel': channel_name,
        'Exten': str(extension),
        'Context': context,
        'Priority': '1'
    }
    
    try:
        response = await manager.send_action(action)
        res_item = response[0] if isinstance(response, list) and len(response) > 0 else response
        resp_val = res_item.get('Response') if hasattr(res_item, 'get') else getattr(res_item, 'Response', None)
        if resp_val == 'Success':
            print(f"[AMI] Transfer Basarili: {call_id} -> {extension}")
            try:
                from backend.database.config import AsyncSessionLocal
                from backend.database.models import Call
                from backend.main import resolve_user_name_by_ext_or_id
                async with AsyncSessionLocal() as session:
                    db_call = await session.get(Call, call_id)
                    if db_call:
                        db_call.status = "transferred"
                        db_call.hangup_source = f"transfer:{extension}"
                        resolved_u_name = resolve_user_name_by_ext_or_id(extension)
                        if resolved_u_name:
                            db_call.agent_name = resolved_u_name
                        await session.commit()
            except Exception as db_err:
                print(f"[AMI] Transfer DB update error: {db_err}")
            return True
        else:
            print(f"[AMI] Transfer Basarisiz (Asterisk Red): {response}")
            return False
    except Exception as e:
        print(f"[AMI] Transfer sirasinda hata olustu: {e}")
        return False

async def resolve_active_channel_for_spy(
    call_id: str = None,
    target_extension: str = None,
    caller_number: str = None,
    mode: str = "listen"
) -> str:
    """
    Resolves the exact active Asterisk channel name for ChanSpy.
    Supports both human extension calls (PJSIP/1000-xxxx) and AI Agent calls (AudioSocket on inbound trunk/extension channel).
    When mode == 'whisper' (Sufle) and a human agent leg (PJSIP/<target_ext>-...) exists, prefers that leg so only the agent hears the supervisor.
    """
    import re
    manager = await get_ami_manager()
    target_ext_clean = str(target_extension or "").strip()
    call_id_clean = str(call_id or "").strip()
    caller_digits = re.sub(r"\D", "", str(caller_number or ""))
    caller_last10 = caller_digits[-10:] if len(caller_digits) >= 10 else caller_digits

    ast_id = call_id_to_asterisk_id.get(call_id_clean, call_id_clean) if call_id_clean else ""

    # 1. If target_extension is a specific human extension (e.g. 1000), check if there is a direct PJSIP/<ext>- channel first
    if target_ext_clean and target_ext_clean not in ("ai", "all", "0", "200") and not target_ext_clean.startswith("agent-"):
        pjsip_pfx = f"pjsip/{target_ext_clean.lower()}-"
        sip_pfx = f"sip/{target_ext_clean.lower()}-"
        for uid, info in list(channel_states.items()):
            ch = str(info.get("channel") or "") if isinstance(info, dict) else str(info or "")
            if ch.lower().startswith(pjsip_pfx) or ch.lower().startswith(sip_pfx):
                return ch
        for uid, ch_val in list(active_channels.items()):
            ch = str(ch_val.get("channel") or "") if isinstance(ch_val, dict) else str(ch_val or "")
            if ch.lower().startswith(pjsip_pfx) or ch.lower().startswith(sip_pfx):
                return ch

    # 2. Check by call_id / ast_id in active_channels & channel_states
    if ast_id:
        ch_val = active_channels.get(ast_id)
        if ch_val:
            ch = str(ch_val.get("channel") or "") if isinstance(ch_val, dict) else str(ch_val or "")
            if ch:
                return ch
        for k, v in list(active_channels.items()):
            if k in ast_id or ast_id in k or (call_id_clean and (k in call_id_clean or call_id_clean in k)):
                ch = str(v.get("channel") or "") if isinstance(v, dict) else str(v or "")
                if ch:
                    return ch

    # 3. Check channel_states by caller or exten matching target_extension or caller_number
    for uid, info in list(channel_states.items()):
        if not isinstance(info, dict):
            continue
        ch = str(info.get("channel") or "")
        c_num = str(info.get("caller") or "").strip()
        e_num = str(info.get("exten") or "").strip()
        if not ch:
            continue
        if target_ext_clean and (c_num == target_ext_clean or e_num == target_ext_clean):
            return ch
        if caller_last10:
            c_dig = re.sub(r"\D", "", c_num)[-10:]
            e_dig = re.sub(r"\D", "", e_num)[-10:]
            if caller_last10 in (c_dig, e_dig):
                return ch

    # 4. Query Asterisk AMI CoreShowChannels live as authoritative fallback (critical for AI Agent AudioSocket calls & Desk Phones)
    if manager:
        try:
            res = await manager.send_action({"Action": "CoreShowChannels"})
            fallback_audio_ch = ""
            any_up_ch = ""
            for r in _iter_ami_responses(res):
                if not hasattr(r, "get"):
                    continue
                ch = str(r.get("Channel") or "").strip()
                if not ch or ch.lower().startswith(" local/"):
                    continue
                uid = str(r.get("Uniqueid") or "").strip()
                app_name = str(r.get("Application") or "").strip().lower()
                app_data = str(r.get("ApplicationData") or "").strip()
                cid_num = str(r.get("CallerIDNum") or "").strip()
                conn_num = str(r.get("ConnectedLineNum") or "").strip()
                exten_num = str(r.get("Exten") or "").strip()

                # Keep active_channels synced
                if uid and ch and app_name != "chanspy":
                    active_channels[uid] = ch

                if app_name == "chanspy":
                    continue

                # Match by exact call_id in AudioSocket ApplicationData (e.g. "uuid,127.0.0.1:9092")
                if call_id_clean and call_id_clean in app_data:
                    return ch

                # Match by Uniqueid
                if ast_id and uid and (uid == ast_id or uid in ast_id or ast_id in uid):
                    return ch

                # Match by target_extension on PJSIP/<ext>-
                if target_ext_clean:
                    if ch.lower().startswith(f"pjsip/{target_ext_clean.lower()}-") or ch.lower().startswith(f"sip/{target_ext_clean.lower()}-"):
                        return ch
                    if target_ext_clean in (cid_num, conn_num, exten_num):
                        return ch

                # Match by caller_number last 10 digits
                if caller_last10:
                    cid_last10 = re.sub(r"\D", "", cid_num)[-10:]
                    conn_last10 = re.sub(r"\D", "", conn_num)[-10:]
                    if caller_last10 in (cid_last10, conn_last10):
                        return ch

                if app_name == "audiosocket" and not fallback_audio_ch:
                    fallback_audio_ch = ch
                if not any_up_ch:
                    any_up_ch = ch

            # If spying on AI Agent (or generic active call) and an AudioSocket channel is active, return it
            if fallback_audio_ch and (not target_ext_clean or target_ext_clean in ("ai", "200", "0") or target_ext_clean.startswith("agent-") or call_id_clean):
                return fallback_audio_ch
            if any_up_ch and len(active_channels) == 1:
                return any_up_ch
        except Exception as ex:
            print(f"[AMI] resolve_active_channel_for_spy CoreShowChannels error: {ex}")

    # 5. Final fallback if only 1 channel is in active_channels
    if len(active_channels) == 1:
        only_val = list(active_channels.values())[0]
        return str(only_val.get("channel") if isinstance(only_val, dict) else only_val or "")

    return ""


async def spy_on_call(
    call_id: str,
    agent_extension: str,
    mode: str = "listen",
    target_extension: str = None,
    caller_number: str = None
) -> bool:
    """
    AMI command to Originate a call to the supervisor's extension,
    connecting them to ChanSpy on the target call's active channel.
    Modes:
      - 'listen'  (Fısılda / Sessiz Dinle): ChanSpy flags 'qE'
      - 'whisper' (Sufle Verme):            ChanSpy flags 'qwE'
      - 'barge'   (Araya Girme):            ChanSpy flags 'qBE'
    """
    manager = await get_ami_manager()
    if not manager:
        print("[AMI] Hata: AMI baglantisi kurulamadigi icin ChanSpy baslatilamadi.")
        return False

    norm_mode = str(mode or "listen").strip().lower()
    if norm_mode in ("barge", "araya_gir", "conference"):
        norm_mode = "barge"
        chanspy_flags = "qBE"
        caller_label = "Canli Dinleme (Araya Gir)"
    elif norm_mode in ("whisper", "sufle", "coach"):
        norm_mode = "whisper"
        chanspy_flags = "qwE"
        caller_label = "Canli Dinleme (Sufle)"
    else:
        norm_mode = "listen"
        chanspy_flags = "qE"
        caller_label = "Canli Dinleme (Fisilda)"

    channel_name = await resolve_active_channel_for_spy(
        call_id=call_id,
        target_extension=target_extension,
        caller_number=caller_number,
        mode=norm_mode
    )
    if not channel_name:
        print(f"[AMI] Hata: CallID={call_id}, TargetExt={target_extension} icin aktif kanal adi bulunamadi.")
        return False

    target_num_display = str(target_extension or caller_number or (call_id[:6] if call_id else "Cagri")).strip()
    print(f"[AMI] ChanSpy ({norm_mode} / {chanspy_flags}) baslatiliyor -> Supervisor: {agent_extension} -> Channel: {channel_name}")

    action = {
        'Action': 'Originate',
        'Channel': f'PJSIP/{agent_extension}',
        'Application': 'ChanSpy',
        'Data': f'{channel_name},{chanspy_flags}',
        'CallerID': f'"{caller_label}" <{target_num_display}>',
        'Variable': f'__CHANSPY_MODE={norm_mode},PJSIP_HEADER(add,Call-Info)=<sip:127.0.0.1>;answer-after=0,PJSIP_HEADER(add,Alert-Info)=<http://127.0.0.1>;info=alert-autoanswer',
        'Async': 'true'
    }

    try:
        response = await manager.send_action(action)
        res_item = response[0] if isinstance(response, list) and len(response) > 0 else response
        resp_val = res_item.get('Response') if hasattr(res_item, 'get') else getattr(res_item, 'Response', None)
        if resp_val == 'Success':
            print(f"[AMI] ChanSpy ({norm_mode}) basariyla tetiklendi: {call_id} -> {channel_name}")
            return True
        else:
            print(f"[AMI] ChanSpy basarisiz (Asterisk Red): {response}")
            return False
    except Exception as e:
        print(f"[AMI] ChanSpy sirasinda hata: {e}")
        return False

async def hangup_call(call_id: str, caller_number: str = None) -> bool:
    """
    AMI command to hang up/drop the active Asterisk call channel.
    """
    manager = await get_ami_manager()

    ast_id = call_id_to_asterisk_id.get(call_id, call_id)
    channel_name = active_channels.get(ast_id)

    if not channel_name:
        for k, v in list(active_channels.items()):
            if k in ast_id or ast_id in k or k in call_id or call_id in k:
                channel_name = v
                break

    if not channel_name and manager:
        try:
            import re
            caller_digits = re.sub(r"\D", "", str(caller_number or ""))
            caller_last10 = caller_digits[-10:] if len(caller_digits) >= 10 else caller_digits
            res = await manager.send_action({"Action": "CoreShowChannels"})
            for r in _iter_ami_responses(res):
                if not hasattr(r, "get"):
                    continue
                ch = r.get('Channel')
                uid = r.get('Uniqueid')
                cid = re.sub(r"\D", "", str(r.get('CallerIDNum') or ""))
                cid_last10 = cid[-10:] if len(cid) >= 10 else cid
                if ch and uid:
                    active_channels[uid] = ch
                    if uid == ast_id or uid in ast_id or ast_id in uid:
                        channel_name = ch
                        break
                    if caller_last10 and cid_last10 and caller_last10 == cid_last10:
                        channel_name = ch
                        break
            if not channel_name and len(active_channels) == 1:
                channel_name = list(active_channels.values())[0]
        except Exception as ex:
            print(f"[AMI] Hangup CoreShowChannels error: {ex}")

    if not channel_name:
        print(f"[AMI] Hata: UniqueID {call_id} (Asterisk ID: {ast_id}) için aktif kanal adi bulunamadi.")
        return False

    print(f"[AMI] Arama sonlandiriliyor (Hangup) -> Channel: {channel_name}")
    ok = False
    if manager:
        action = {
            'Action': 'Hangup',
            'Channel': channel_name,
            'Cause': '21'
        }
        try:
            response = await manager.send_action(action)
            res_item = response[0] if isinstance(response, list) and len(response) > 0 else response
            resp_val = res_item.get('Response') if hasattr(res_item, 'get') else getattr(res_item, 'Response', None)
            ok = (resp_val == 'Success')
        except Exception as e:
            print(f"[AMI] Hangup sirasinda hata olustu: {e}")

    try:
        import subprocess
        subprocess.run(["asterisk", "-rx", f"channel request hangup {channel_name}"], check=False, timeout=1.5)
        ok = True
    except Exception:
        pass

    return ok


async def blind_transfer_agent_call(agent_extension: str, target_extension: str, remote_number: str = "") -> bool:
    """
    Redirects the peer channel currently talking/ringing with agent_extension
    to target_extension in webrtc_agents context via Asterisk AMI.
    """
    import re
    manager = await get_ami_manager()
    if not manager:
        print("[AMI] Hata: AMI baglantisi olmadigi icin blind transfer yapilamadi.")
        return False

    ag_ext = str(agent_extension or "").strip()
    tgt_ext = str(target_extension or "").strip()
    rem_digits = re.sub(r"\D", "", str(remote_number or ""))
    rem_last10 = rem_digits[-10:] if len(rem_digits) >= 10 else rem_digits

    if not ag_ext or not tgt_ext:
        return False

    agent_ch = None
    agent_bridge_id = None
    peer_ch = None
    ch_rows = []

    try:
        res = await manager.send_action({"Action": "CoreShowChannels"})
        for r in _iter_ami_responses(res):
            if not hasattr(r, "get"):
                continue
            ch = str(r.get("Channel") or "").strip()
            if not ch:
                continue
            uid = str(r.get("Uniqueid") or "").strip()
            cid = str(r.get("CallerIDNum") or "").strip()
            conn_num = str(r.get("ConnectedLineNum") or "").strip()
            exten_val = str(r.get("Exten") or "").strip()
            bridge_id = str(r.get("BridgeId") or "").strip()
            if uid:
                active_channels[uid] = ch
            row = {
                "channel": ch,
                "ch_lower": ch.lower(),
                "uid": uid,
                "cid": cid,
                "cid_digits": re.sub(r"\D", "", cid),
                "conn_num": conn_num,
                "exten": exten_val,
                "bridge_id": bridge_id,
            }
            ch_rows.append(row)
            if row["ch_lower"].startswith(f"pjsip/{ag_ext.lower()}-") or row["ch_lower"].startswith(f"sip/{ag_ext.lower()}-"):
                agent_ch = ch
                if bridge_id:
                    agent_bridge_id = bridge_id

        # 1. If remote_number is specified, match peer_ch by remote_number first (crucial for multi-line calls)
        if rem_digits:
            for row in ch_rows:
                if row["ch_lower"].startswith(f"pjsip/{ag_ext.lower()}-") or row["ch_lower"].startswith(f"sip/{ag_ext.lower()}-"):
                    continue
                if row["ch_lower"].startswith(f"pjsip/{rem_digits.lower()}-") or row["ch_lower"].startswith(f"sip/{rem_digits.lower()}-"):
                    peer_ch = row["channel"]
                    if row["bridge_id"]:
                        agent_bridge_id = row["bridge_id"]
                    break
                row_last10 = row["cid_digits"][-10:] if len(row["cid_digits"]) >= 10 else row["cid_digits"]
                if rem_last10 and row_last10 and rem_last10 == row_last10:
                    peer_ch = row["channel"]
                    if row["bridge_id"]:
                        agent_bridge_id = row["bridge_id"]
                    break

        # 2. Match by shared BridgeId with agent_ch
        if not peer_ch and agent_bridge_id:
            for row in ch_rows:
                if row["channel"] != agent_ch and row["bridge_id"] == agent_bridge_id:
                    peer_ch = row["channel"]
                    break

        # 3. Match by ConnectedLineNum or Exten == ag_ext
        if not peer_ch:
            for row in ch_rows:
                if row["channel"] == agent_ch:
                    continue
                if row["conn_num"] == ag_ext or row["exten"] == ag_ext:
                    peer_ch = row["channel"]
                    break

        # 4. Fallback if exactly 2 channels exist and one is agent_ch
        if not peer_ch and agent_ch and len(ch_rows) == 2:
            for row in ch_rows:
                if row["channel"] != agent_ch:
                    peer_ch = row["channel"]
                    break

        # Resolve the specific agent_ch bridged with peer_ch if multiple agent lines exist
        if peer_ch:
            peer_row = next((r for r in ch_rows if r["channel"] == peer_ch), None)
            if peer_row and peer_row.get("bridge_id"):
                matching_ag = next(
                    (
                        r["channel"]
                        for r in ch_rows
                        if r["channel"] != peer_ch
                        and r["bridge_id"] == peer_row["bridge_id"]
                        and (r["ch_lower"].startswith(f"pjsip/{ag_ext.lower()}-") or r["ch_lower"].startswith(f"sip/{ag_ext.lower()}-"))
                    ),
                    None,
                )
                if matching_ag:
                    agent_ch = matching_ag
    except Exception as ex:
        print(f"[AMI] BlindTransfer CoreShowChannels error: {ex}")

    if not peer_ch:
        print(f"[AMI] BlindTransfer icin hedef peer kanal bulunamadi (Agent={ag_ext}, Remote={remote_number}, Target={tgt_ext})")
        return False

    print(f"[AMI] BlindTransfer: Peer Kanal {peer_ch} -> Hedef {tgt_ext} (Context: webrtc_agents)")
    try:
        response = await manager.send_action({
            "Action": "Redirect",
            "Channel": peer_ch,
            "Exten": tgt_ext,
            "Context": "webrtc_agents",
            "Priority": "1",
        })
        res_item = response[0] if isinstance(response, list) and len(response) > 0 else response
        resp_val = res_item.get("Response") if hasattr(res_item, "get") else getattr(res_item, "Response", None)
        if resp_val == "Success":
            if agent_ch:
                try:
                    await manager.send_action({"Action": "Hangup", "Channel": agent_ch, "Cause": "16"})
                except Exception:
                    pass
            return True
    except Exception as e_red:
        print(f"[AMI] BlindTransfer Redirect error: {e_red}")

    return False


async def attended_transfer_agent_calls(agent_extension: str, remote_number_1: str, remote_number_2: str) -> bool:
    """
    Attended (Warm) Transfer:
    Finds the two peer channels currently connected to agent_extension (Line 1: remote_number_1, Line 2: remote_number_2)
    and bridges them directly together using Asterisk AMI Bridge action, then hangs up the agent's channels.
    """
    import re
    manager = await get_ami_manager()
    if not manager:
        print("[AMI] Hata: AMI baglantisi olmadigi icin attended transfer yapilamadi.")
        return False

    ag_ext = str(agent_extension or "").strip()
    rem1_digits = re.sub(r"\D", "", str(remote_number_1 or ""))
    rem2_digits = re.sub(r"\D", "", str(remote_number_2 or ""))
    rem1_last10 = rem1_digits[-10:] if len(rem1_digits) >= 10 else rem1_digits
    rem2_last10 = rem2_digits[-10:] if len(rem2_digits) >= 10 else rem2_digits

    if not ag_ext:
        return False

    ch_rows = []
    agent_channels = []
    agent_bridge_ids = set()

    try:
        res = await manager.send_action({"Action": "CoreShowChannels"})
        for r in _iter_ami_responses(res):
            if not hasattr(r, "get"):
                continue
            ch = str(r.get("Channel") or "").strip()
            if not ch:
                continue
            cid = str(r.get("CallerIDNum") or "").strip()
            conn_num = str(r.get("ConnectedLineNum") or "").strip()
            exten_val = str(r.get("Exten") or "").strip()
            bridge_id = str(r.get("BridgeId") or "").strip()
            ch_lower = ch.lower()
            is_agent_leg = ch_lower.startswith(f"pjsip/{ag_ext.lower()}-") or ch_lower.startswith(f"sip/{ag_ext.lower()}-")
            row = {
                "channel": ch,
                "ch_lower": ch_lower,
                "cid": cid,
                "cid_digits": re.sub(r"\D", "", cid),
                "conn_num": conn_num,
                "conn_digits": re.sub(r"\D", "", conn_num),
                "exten": exten_val,
                "bridge_id": bridge_id,
                "is_agent_leg": is_agent_leg,
            }
            ch_rows.append(row)
            if is_agent_leg:
                agent_channels.append(ch)
                if bridge_id:
                    agent_bridge_ids.add(bridge_id)

        def match_peer_for_remote(rem_dig, rem_l10, exclude_ch=None):
            if not rem_dig:
                return None
            for row in ch_rows:
                if row["is_agent_leg"] or row["channel"] == exclude_ch:
                    continue
                if row["ch_lower"].startswith(f"pjsip/{rem_dig.lower()}-") or row["ch_lower"].startswith(f"sip/{rem_dig.lower()}-"):
                    return row["channel"]
                row_l10 = row["cid_digits"][-10:] if len(row["cid_digits"]) >= 10 else row["cid_digits"]
                if rem_l10 and row_l10 and rem_l10 == row_l10:
                    return row["channel"]
                if row["exten"] == rem_dig or row["conn_digits"] == rem_dig:
                    return row["channel"]
            return None

        peer_1 = match_peer_for_remote(rem1_digits, rem1_last10)
        peer_2 = match_peer_for_remote(rem2_digits, rem2_last10, exclude_ch=peer_1)

        # Fallback: check non-agent channels sharing a bridge with agent_channels
        if not peer_1 or not peer_2:
            bridged_peers = [
                r["channel"]
                for r in ch_rows
                if not r["is_agent_leg"] and (r["bridge_id"] in agent_bridge_ids or r["conn_num"] == ag_ext or r["exten"] == ag_ext)
            ]
            for bp in bridged_peers:
                if not peer_1 and bp != peer_2:
                    peer_1 = bp
                elif not peer_2 and bp != peer_1:
                    peer_2 = bp

        if not peer_1 or not peer_2:
            print(f"[AMI] AttendedTransfer: Iki peer kanal bulunamadi (peer1={peer_1}, peer2={peer_2}, ag={ag_ext})")
            return False

        print(f"[AMI] AttendedTransfer Bridge: {peer_1} <---> {peer_2}")
        response = await manager.send_action({
            "Action": "Bridge",
            "Channel1": peer_1,
            "Channel2": peer_2,
            "Tone": "yes"
        })
        res_item = response[0] if isinstance(response, list) and len(response) > 0 else response
        resp_val = res_item.get("Response") if hasattr(res_item, "get") else getattr(res_item, "Response", None)
        if resp_val == "Success":
            for ag_ch in agent_channels:
                try:
                    await manager.send_action({"Action": "Hangup", "Channel": ag_ch, "Cause": "16"})
                except Exception:
                    pass
            return True
    except Exception as ex:
        print(f"[AMI] AttendedTransfer error: {ex}")

    return False


# background task to keep AMI connected
async def start_ami_listener():
    while True:
        try:
            await get_ami_manager()
        except Exception:
            pass
        await asyncio.sleep(10)
