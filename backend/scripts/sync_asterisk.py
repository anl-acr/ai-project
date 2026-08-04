import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

try:
    from dotenv import load_dotenv
    env_path = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
except ImportError:
    pass

def sync():
    users_list = []
    trunks_list = []
    queues_list = []
    
    try:
        from backend.database.config import SyncSessionLocal
        from backend.database.models import SystemUser, Trunk, PBXQueue
        with SyncSessionLocal() as session:
            db_users = session.query(SystemUser).all()
            for u in db_users:
                users_list.append({col.name: getattr(u, col.name) for col in SystemUser.__table__.columns})
                
            db_trunks = session.query(Trunk).all()
            for t in db_trunks:
                trunks_list.append({col.name: getattr(t, col.name) for col in Trunk.__table__.columns})
                
            db_queues = session.query(PBXQueue).all()
            for q in db_queues:
                queues_list.append({col.name: getattr(q, col.name) for col in PBXQueue.__table__.columns})
    except Exception as e_db:
        print(f"[Sync Script] Veritabanı bağlantısı veya modül hatası: {e_db}")
        settings_path = os.path.join(BASE_DIR, "settings.json")
        if os.path.exists(settings_path):
            import json
            try:
                with open(settings_path, "r", encoding="utf-8") as f:
                    s_data = json.load(f)
                    users_list = s_data.get("users", [])
                    trunks_list = s_data.get("trunks", [])
                    queues_list = s_data.get("queues", [])
            except Exception as e_json:
                print(f"[Sync Script] settings.json okunamadı: {e_json}")

    print(f"[Sync Script] Toplam {len(users_list)} kullanıcı, {len(trunks_list)} trunk ve {len(queues_list)} kuyruk ile konfigürasyon hazırlanıyor.")

    pjsip_content = """; ==========================================
; DINAMIK OLARAK OLUŞTURULAN SIP TRUNK & KULLANICI AYARLARI
; ==========================================

[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0

[transport-tcp]
type=transport
protocol=tcp
bind=0.0.0.0

; WebRTC / Standard Dahili Şablonu
[webrtc_agent_template](!)
type=endpoint
context=webrtc_agents
disallow=all
allow=ulaw,alaw,g722,g729
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes
"""
    
    for t in trunks_list:
        name = t.get("trunk_name") or t.get("name") or "trunk"
        host = t.get("host", "127.0.0.1")
        port = t.get("port", 5060)
        did = t.get("did_number", "")
        t_type = t.get("trunk_type", "ip")
        protocol = t.get("protocol", "udp")
        transport = "transport-tcp" if protocol == "tcp" else "transport-udp"

        pjsip_content += f"\n; --- TRUNK: {name} ({t_type.upper()}) ---\n"
        if t_type == "register":
            pjsip_content += f"""[{name}-reg]
type=registration
transport={transport}
outbound_auth={name}-auth
client_uri=sip:{t.get('username','')}@{host}:{port}
server_uri=sip:{host}:{port}
contact_user={did}

[{name}-auth]
type=auth
auth_type=userpass
username={t.get('username','')}
password={t.get('password','')}

"""

        pjsip_content += f"""[{name}-aor]
type=aor
contact=sip:{host}:{port}

[{name}]
type=endpoint
transport={transport}
context=default
disallow=all
allow=ulaw,alaw,g729
aors={name}-aor
"""
        if t_type == "register":
            pjsip_content += f"""outbound_auth={name}-auth
from_user={t.get('username','')}
from_domain={host}

"""

        pjsip_content += f"""[{name}-identify]
type=identify
endpoint={name}
match={host}

"""

    pjsip_content += "\n; ==========================================\n"
    pjsip_content += "; DINAMIK OLARAK OLUŞTURULAN KULLANICI (DAHILI) AYARLARI\n"
    pjsip_content += "; ==========================================\n"

    for u in users_list:
        ext = u.get("extension")
        if not ext:
            continue
        pwd = u.get("sip_password") or u.get("password") or "1234"
        name = u.get("full_name") or u.get("username") or ext
        pjsip_content += f"""
; --- USER: {name} ({ext}) ---
[{ext}](webrtc_agent_template)
type=endpoint
auth={ext}-auth
aors={ext}
callerid={name} <{ext}>

[{ext}-auth]
type=auth
auth_type=userpass
username={ext}
password={pwd}

[{ext}]
type=aor
max_contacts=5
remove_existing=yes
"""

    for path in ["/etc/asterisk/pjsip_custom.conf", os.path.join(PROJECT_ROOT, "asterisk_config", "pjsip_custom.conf")]:
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(pjsip_content)
            print(f"[Sync Script] pjsip_custom.conf başarıyla yazıldı -> {path}")
        except Exception as e:
            print(f"[Sync Script] Hata ({path}): {e}")

    queue_content = """; ==========================================
; DINAMIK OLARAK OLUŞTURULAN KUYRUK AYARLARI
; ==========================================
"""
    for q in queues_list:
        q_key = q.get("extension") or str(q.get("id")) or q.get("name", "queue_temp")
        strategy = q.get("strategy", "ringall")
        timeout = q.get("timeout", 15)
        retry = q.get("retry", 5)
        wrapup = q.get("wrapuptime", 0)
        
        queue_content += f"\n[{q_key}]\nstrategy={strategy}\ntimeout={timeout}\nretry={retry}\nwrapuptime={wrapup}\nautopause=no\nmaxlen=0\njoinempty=yes\nleavewhenempty=no\n"
        
        members = q.get("queueMembers") or q.get("members") or []
        if isinstance(members, str):
            import json
            try:
                members = json.loads(members)
            except Exception:
                members = []
        for member in members:
            user_id = member.get("user_id") if isinstance(member, dict) else member
            u = next((u for u in users_list if str(u["id"]) == str(user_id)), None)
            if u and u.get("extension"):
                queue_content += f"member => PJSIP/{u['extension']}\n"

    for path in ["/etc/asterisk/queues_custom.conf", os.path.join(PROJECT_ROOT, "asterisk_config", "queues_custom.conf")]:
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(queue_content)
            print(f"[Sync Script] queues_custom.conf başarıyla yazıldı -> {path}")
        except Exception as e:
            print(f"[Sync Script] Hata ({path}): {e}")

    ext_content = """; ==========================================
; DINAMIK OLARAK OLUŞTURULAN EXTENSIONS (DIALPLAN) AYARLARI
; ==========================================

[default]
; Operatörden gelen aramaları yakalamak için (Standart numara eşleşmesi)
exten => _X.,1,NoOp(Gelen arama DID ile yakalandi: ${EXTEN} - Arayan: ${CALLERID(num)})
same => n,Set(CALL_UUID=${UNIQUEID})
same => n,Set(CURL_RESULT=${CURL(http://127.0.0.1:8000/api/calls/register?call_id=${CALL_UUID}&did=${EXTEN}&caller=${CALLERID(num)}&asterisk_id=${UNIQUEID})})
same => n,Progress()
same => n,Answer()
same => n,MixMonitor(/var/spool/asterisk/monitor/${CALL_UUID}.wav)
same => n,AudioSocket(${CALL_UUID},127.0.0.1:9092)
same => n,Hangup()

; Uluslararası / + ile gelen DID numaraları için (+90...)
exten => _+X.,1,NoOp(Gelen arama +DID ile yakalandi: ${EXTEN} - Arayan: ${CALLERID(num)})
same => n,Set(CALL_UUID=${UNIQUEID})
same => n,Set(CURL_RESULT=${CURL(http://127.0.0.1:8000/api/calls/register?call_id=${CALL_UUID}&did=${EXTEN}&caller=${CALLERID(num)}&asterisk_id=${UNIQUEID})})
same => n,Progress()
same => n,Answer()
same => n,MixMonitor(/var/spool/asterisk/monitor/${CALL_UUID}.wav)
same => n,AudioSocket(${CALL_UUID},127.0.0.1:9092)
same => n,Hangup()

; Fallback (s uzantısı)
exten => s,1,NoOp(Gelen arama s uzantisi ile yakalandi: ${CALLERID(num)})
same => n,Set(CALL_UUID=${UNIQUEID})
same => n,Set(CURL_RESULT=${CURL(http://127.0.0.1:8000/api/calls/register?call_id=${CALL_UUID}&did=s&caller=${CALLERID(num)}&asterisk_id=${UNIQUEID})})
same => n,Progress()
same => n,Answer()
same => n,MixMonitor(/var/spool/asterisk/monitor/${CALL_UUID}.wav)
same => n,AudioSocket(${CALL_UUID},127.0.0.1:9092)
same => n,Hangup()

; Hangup handler (h uzantısı)
exten => h,1,NoOp(Cagri sonlandi: ${EXTEN})
same => n,Hangup()

; Her türlü diğer numara/uzantı formatı için Catch-all
exten => _.,1,NoOp(Gelen arama catch-all ile yakalandi: ${EXTEN} - Arayan: ${CALLERID(num)})
same => n,Set(CALL_UUID=${UNIQUEID})
same => n,Set(CURL_RESULT=${CURL(http://127.0.0.1:8000/api/calls/register?call_id=${CALL_UUID}&did=${EXTEN}&caller=${CALLERID(num)}&asterisk_id=${UNIQUEID})})
same => n,Progress()
same => n,Answer()
same => n,MixMonitor(/var/spool/asterisk/monitor/${CALL_UUID}.wav)
same => n,AudioSocket(${CALL_UUID},127.0.0.1:9092)
same => n,Hangup()

; Yapay zeka aramayı insana aktarmak istediğinde AMI üzerinden bu dahili extension'a yönlendirir
exten => transfer_to_human,1,NoOp(Yapay zeka cagriyi temsilciye aktariyor: ${UNIQUEID})
same => n,Playback(transfer-please-wait)
same => n,Queue(temsilci_kuyrugu)
same => n,Hangup()

[webrtc_agents]
; WebRTC istemcileri (temsilciler) bu context üzerinden görüşme yapar

; Dış hat aramaları için (0 ile başlayan numaralar)
exten => _0.,1,NoOp(Dis arama baslatiliyor: Arayan=${CALLERID(num)}, Aranan=${EXTEN})
same => n,Set(CALL_UUID=${UUID()})
same => n,Set(CURL_RESULT=${CURL(http://127.0.0.1:8000/api/calls/register?call_id=${CALL_UUID}&did=${EXTEN}&caller=${CALLERID(num)}&asterisk_id=${UNIQUEID})})
same => n,MixMonitor(/var/spool/asterisk/monitor/${CALL_UUID}.wav)
same => n,Dial(PJSIP/Operator_Trunk/sip:${EXTEN}@ikonsip.com:5060,60,r)
same => n,Hangup()

exten => h,1,NoOp(Temsilci dis aramasi sonlandi. Call ID: ${CALL_UUID})
same => n,Set(CURL_RESULT=${CURL(http://127.0.0.1:8000/api/calls/end?call_id=${CALL_UUID})})

; İç hat (Diğer temsilciler) aramaları için (2XX vb.)
exten => _2XX,1,NoOp(ACL kontrol ediliyor: Arayan=${CALLERID(num)}, Aranan=${EXTEN})
same => n,Set(ACL_RESULT=${CURL(http://127.0.0.1:8000/api/acl/check_subscriber_call?caller=${CALLERID(num)}&callee=${EXTEN})})
same => n,GotoIf($["${ACL_RESULT}" = "ALLOW"]?allow:deny)
same => n(deny),NoOp(ACL REDDEDILDI: Yetkisiz arama)
same => n,Playback(ss-noservice)
same => n,Hangup()
same => n(allow),NoOp(ACL ONAYLANDI: Arama baslatiliyor)
same => n,Dial(PJSIP/${EXTEN})
same => n,Hangup()

[mobile_transfer_context]
exten => s,1,NoOp(Mobil aktarim arandi ve cevaplandi. Arayan=${CALLERID(num)})
same => n,Progress()
same => n,Answer()
same => n,Playback(/var/spool/asterisk/monitor/summary_${CALL_UUID})
same => n,Bridge(${CUSTOMER_CHANNEL})
same => n,Hangup()
"""

    for path in ["/etc/asterisk/extensions_custom.conf", os.path.join(PROJECT_ROOT, "asterisk_config", "extensions_custom.conf")]:
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(ext_content)
            print(f"[Sync Script] extensions_custom.conf başarıyla yazıldı -> {path}")
        except Exception as e:
            print(f"[Sync Script] Hata ({path}): {e}")

    import subprocess
    try:
        subprocess.run(["asterisk", "-rx", "pjsip reload"], check=True)
        subprocess.run(["asterisk", "-rx", "dialplan reload"], check=True)
        subprocess.run(["asterisk", "-rx", "queue reload all"], check=True)
        print("[Sync Script] Asterisk PJSIP, Dialplan ve Kuyruklar başarıyla yenilendi (reload).")
    except Exception as e:
        print(f"[Sync Script] Asterisk reload hatası: {e}")

if __name__ == "__main__":
    sync()
