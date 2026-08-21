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

def register_event_handlers(manager: Manager):
    @manager.register_event('Newchannel')
    def handle_new_channel(m, event):
        uniqueid = event.get('Uniqueid')
        channel = event.get('Channel')
        if uniqueid and channel:
            active_channels[uniqueid] = channel
            print(f"[AMI] Yeni Kanal Kaydedildi: {uniqueid} -> {channel}")

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
            print("[AMI] Connected successfully!")
            
            # Fetch initial SIP registration states
            try:
                res = await manager_instance.send_action({"Action": "PJSIPShowEndpoints"})
                if res and hasattr(res, 'responses'):
                    for r in res.responses:
                        if r.get('Event') == 'EndpointList':
                            obj = r.get('ObjectName')
                            status = r.get('DeviceState')
                            if obj and status and status != 'Unavailable':
                                registered_endpoints.add(obj)
            except Exception as ex:
                print(f"[AMI] Error fetching initial endpoints: {ex}")
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
        print(f"[AMI] Hata: UniqueID {call_id} (Asterisk ID: {ast_id}) için aktif kanal adi bulunamadi.")
        return False

    print(f"[AMI] Kanal {channel_name} transfer ediliyor -> Exten: {extension}, Context: {context}")
    
    # Send Redirect action
    action = {
        'Action': 'Redirect',
        'Channel': channel_name,
        'Exten': extension,
        'Context': context,
        'Priority': '1'
    }
    
    try:
        response = await manager.send_action(action)
        res_item = response[0] if isinstance(response, list) and len(response) > 0 else response
        resp_val = res_item.get('Response') if hasattr(res_item, 'get') else getattr(res_item, 'Response', None)
        if resp_val == 'Success':
            print(f"[AMI] Transfer Basarili: {call_id}")
            # Update call status in database
            # ...
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

async def hangup_call(call_id: str) -> bool:
    """
    AMI command to hang up/drop the active Asterisk call channel.
    """
    manager = await get_ami_manager()
    if not manager:
        print("[AMI] Hata: AMI baglantisi kurulamadigi icin hangup iptal edildi.")
        return False

    ast_id = call_id_to_asterisk_id.get(call_id, call_id)
    channel_name = active_channels.get(ast_id)
    if not channel_name:
        print(f"[AMI] Hata: UniqueID {call_id} için aktif kanal adi bulunamadi.")
        return False

    print(f"[AMI] Arama sonlandiriliyor (Hangup) -> Channel: {channel_name}")
    action = {
        'Action': 'Hangup',
        'Channel': channel_name
    }
    try:
        response = await manager.send_action(action)
        res_item = response[0] if isinstance(response, list) and len(response) > 0 else response
        resp_val = res_item.get('Response') if hasattr(res_item, 'get') else getattr(res_item, 'Response', None)
        return resp_val == 'Success'
    except Exception as e:
        print(f"[AMI] Hangup sirasinda hata olustu: {e}")
        return False

# background task to keep AMI connected
async def start_ami_listener():
    while True:
        try:
            await get_ami_manager()
        except Exception:
            pass
        await asyncio.sleep(10)
