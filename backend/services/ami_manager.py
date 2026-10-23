import os
import asyncio
from panoramisk import Manager

AMI_HOST = os.getenv("AMI_HOST", "localhost")
AMI_PORT = int(os.getenv("AMI_PORT", 5038))
AMI_USER = os.getenv("AMI_USER", "ai_backend_user")
AMI_SECRET = os.getenv("AMI_SECRET", "backend_secure_key_99")

# Registry to map uniqueid -> active Asterisk channel name
active_channels = {}
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
        if uniqueid and channel:
            active_channels[uniqueid] = channel
            print(f"[AMI] Yeni Kanal Kaydedildi: {uniqueid} -> {channel} (Caller: {caller_num}, Exten: {exten})")
            if caller_num or exten:
                asyncio.create_task(_check_and_hangup_blacklisted_channel(m, channel, uniqueid, caller_num, exten))

    @manager.register_event('Hangup')
    def handle_hangup(m, event):
        uniqueid = event.get('Uniqueid')
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

# background task to keep AMI connected
async def start_ami_listener():
    while True:
        try:
            await get_ami_manager()
        except Exception:
            pass
        await asyncio.sleep(10)
