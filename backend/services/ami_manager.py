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
class RegisteredEndpointsDict(dict):
    def add(self, key, ip=""):
        self[str(key)] = str(ip or "")

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
    pjsip_prefix = f"pjsip/{ext_s}-"
    sip_prefix = f"sip/{ext_s}-"
    for uid, info in list(channel_states.items()):
        ch_lower = str(info.get("channel") or "").lower()
        caller_s = str(info.get("caller") or "").strip()
        exten_s = str(info.get("exten") or "").strip()
        st = info.get("state") or "ringing"
        if ch_lower.startswith(pjsip_prefix) or ch_lower.startswith(sip_prefix) or caller_s == ext_s or exten_s == ext_s:
            if st == "busy":
                return "busy"
            found_ringing = True
    if found_ringing:
        return "ringing"
    for uid, ch in list(active_channels.items()):
        ch_lower = str(ch or "").lower()
        if ch_lower.startswith(pjsip_prefix) or ch_lower.startswith(sip_prefix):
            return "busy"
    return None

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
        channel = event.get('Channel')
        caller_num = str(event.get('CallerIDNum') or "").strip()
        exten = str(event.get('Exten') or "").strip()
        state_desc = str(event.get('ChannelStateDesc') or "").strip().lower()
        init_state = "busy" if state_desc == "up" else "ringing"
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

    @manager.register_event('Hangup')
    def handle_hangup(m, event):
        uniqueid = event.get('Uniqueid')
        channel_states.pop(uniqueid, None)
        if uniqueid in active_channels:
            channel = active_channels.pop(uniqueid)
            print(f"[AMI] Kanal Silindi (Hangup): {uniqueid} ({channel})")

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
            elif status in ["Removed", "Unreachable", "Unknown"]:
                registered_endpoints.discard(aor)
                print(f"[AMI] Endpoint Koptu: {aor}")

async def get_ami_manager() -> Manager:
    """Returns or initializes the active AMI manager connection."""
    global manager_instance
    if manager_instance is None or not manager_instance._connected:
        print(f"[AMI] Connecting to Asterisk AMI at {AMI_HOST}:{AMI_PORT}...")
        try:
            manager_instance = Manager(
                host=AMI_HOST,
                port=AMI_PORT,
                username=AMI_USER,
                secret=AMI_SECRET,
                loop=asyncio.get_event_loop()
            )
            await asyncio.wait_for(manager_instance.connect(), timeout=1.5)
            register_event_handlers(manager_instance)
            print("[AMI] Connected successfully and event handlers registered!")
            
            # Fetch initial SIP registration states (only active registered contacts)
            try:
                res = await manager_instance.send_action({"Action": "PJSIPShowContacts"})
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

async def spy_on_call(call_id: str, agent_extension: str) -> bool:
    """
    AMI command to Originate a call to the agent extension,
    connecting them to ChanSpy on the target call's active channel.
    """
    manager = await get_ami_manager()
    if not manager:
        print("[AMI] Hata: AMI baglantisi kurulamadigi icin ChanSpy baslatilamadi.")
        return False

    ast_id = call_id_to_asterisk_id.get(call_id, call_id)
    channel_name = active_channels.get(ast_id)
    if not channel_name:
        print(f"[AMI] Hata: UniqueID {call_id} (Asterisk ID: {ast_id}) için aktif kanal adi bulunamadi.")
        return False

    print(f"[AMI] ChanSpy baslatiliyor -> Agent: {agent_extension} spys on Channel: {channel_name}")

    # Send Originate action
    action = {
        'Action': 'Originate',
        'Channel': f'PJSIP/{agent_extension}',
        'Application': 'ChanSpy',
        'Data': f'{channel_name},qE',
        'Async': 'true'
    }
    
    try:
        response = await manager.send_action(action)
        res_item = response[0] if isinstance(response, list) and len(response) > 0 else response
        resp_val = res_item.get('Response') if hasattr(res_item, 'get') else getattr(res_item, 'Response', None)
        if resp_val == 'Success':
            print(f"[AMI] ChanSpy basariyla tetiklendi: {call_id}")
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
