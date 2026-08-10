import os
import sys
import subprocess
import shutil

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))

def sync():
    print("[Sync Script] Asterisk konfigürasyonları güncelleniyor...")
    
    # 1. Update /etc/asterisk/manager.conf for AMI authentication
    mgr_content = """; ==========================================
; Asterisk Manager Interface (AMI) Yapılandırması
; ==========================================
[general]
enabled = yes
port = 5038
bindaddr = 0.0.0.0

[ai_backend_user]
secret = backend_secure_key_99
read = system,call,log,verbose,command,agent,user
write = system,call,agent,originate
permit = 0.0.0.0/0.0.0.0
"""
    manager_conf_path = "/etc/asterisk/manager.conf"
    if os.path.exists("/etc/asterisk"):
        try:
            write_mgr = True
            if os.path.exists(manager_conf_path):
                with open(manager_conf_path, "r", encoding="utf-8") as f:
                    curr = f.read()
                if "[ai_backend_user]" in curr:
                    write_mgr = False
            if write_mgr:
                with open(manager_conf_path, "w", encoding="utf-8") as f:
                    f.write(mgr_content)
                subprocess.run(["asterisk", "-rx", "manager reload"], check=False)
                print("[Sync Script] manager.conf başarıyla güncellendi ve reload edildi.")
        except Exception as e:
            print(f"[Sync Script] manager.conf hatası: {e}")

    # Comprehensive search for SSL certificate (Let's Encrypt / System)
    ast_keys_dir = "/etc/asterisk/keys"
    os.makedirs(ast_keys_dir, exist_ok=True)
    target_cert = None
    target_key = None

    letsencrypt_base = "/etc/letsencrypt/live"
    if os.path.exists(letsencrypt_base):
        try:
            for root, dirs, files in os.walk(letsencrypt_base):
                if "fullchain.pem" in files and "privkey.pem" in files:
                    target_cert = os.path.join(root, "fullchain.pem")
                    target_key = os.path.join(root, "privkey.pem")
                    break
        except Exception:
            pass

    if not target_cert:
        for ssl_path in ["/etc/nginx", "/etc/ssl", "/etc/pki"]:
            if os.path.exists(ssl_path):
                for root, dirs, files in os.walk(ssl_path):
                    for f in files:
                        if (f.endswith(".crt") or f.endswith(".pem") or "fullchain" in f) and not target_cert:
                            target_cert = os.path.join(root, f)
                        elif (f.endswith(".key") or "privkey" in f) and not target_key:
                            target_key = os.path.join(root, f)

    if target_cert and target_key:
        try:
            ast_fc = os.path.join(ast_keys_dir, "webphone_fullchain.pem")
            ast_pk = os.path.join(ast_keys_dir, "webphone_privkey.pem")
            ast_combined = os.path.join(ast_keys_dir, "asterisk.pem")

            shutil.copy2(target_cert, ast_fc)
            shutil.copy2(target_key, ast_pk)

            with open(ast_fc, "r") as f1, open(ast_pk, "r") as f2, open(ast_combined, "w") as fout:
                fout.write(f1.read() + "\n" + f2.read())

            os.chmod(ast_fc, 0o644)
            os.chmod(ast_pk, 0o644)
            os.chmod(ast_combined, 0o644)
            print(f"[Sync Script] SSL sertifikası Asterisk için hazırlandı ve birleştirildi: {ast_combined}")
        except Exception as e_ssl:
            print(f"[Sync Script] SSL birleştirme hatası: {e_ssl}")

    # Update /etc/asterisk/http.conf for WebRTC WebSocket
    http_content = """; ==========================================
; Asterisk HTTP/WebSocket (WSS) Konfigürasyonu
; ==========================================
[general]
enabled=yes
bindaddr=0.0.0.0
bindport=8088
tlsenable=yes
tlsbindaddr=0.0.0.0:8089
tlscertfile=/etc/asterisk/keys/asterisk.pem
tlsprivatekey=/etc/asterisk/keys/webphone_privkey.pem
"""
    if os.path.exists("/etc/asterisk"):
        try:
            http_conf_path = "/etc/asterisk/http.conf"
            with open(http_conf_path, "w", encoding="utf-8") as f:
                f.write(http_content)
        except Exception as e:
            print(f"[Sync Script] http.conf hatası: {e}")

    # Generate /etc/asterisk/pjsip_custom.conf directly in sync script
    try:
        import json
        settings_json_path = os.path.join(BASE_DIR, "settings.json")
        users_list = []
        if os.path.exists(settings_json_path):
            with open(settings_json_path, "r", encoding="utf-8") as sf:
                sdata = json.load(sf)
                users_list = sdata.get("users", [])

        pjsip_custom_content = """; ==========================================
; DINAMIK OLARAK OLUŞTURULAN SIP TRUNK VE DAHILI AYARLARI
; ==========================================

[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0

[transport-tcp]
type=transport
protocol=tcp
bind=0.0.0.0

[transport-ws]
type=transport
protocol=ws
bind=0.0.0.0:8088

[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089

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
webrtc=yes
use_avpf=yes
media_encryption=dtls
dtls_auto_generate_cert=yes
dtls_verify=fingerprint
dtls_setup=actpass
ice_support=yes
media_use_received_transport=yes
transport=transport-ws
"""
        for u in users_list:
            is_act = u.get("is_active") if "is_active" in u else True
            if not is_act:
                continue
            ext = str(u.get("extension", "")).strip()
            if not ext:
                continue
            pwd = u.get("sip_password") or u.get("password") or "1234"
            name = u.get("full_name") or u.get("username") or ext

            pjsip_custom_content += f"\n; --- USER: {name} ({ext}) ---\n"
            pjsip_custom_content += f"""[{ext}](webrtc_agent_template)
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

        pjsip_custom_path = "/etc/asterisk/pjsip_custom.conf"
        with open(pjsip_custom_path, "w", encoding="utf-8") as pf:
            pf.write(pjsip_custom_content)
        print(f"[Sync Script] pjsip_custom.conf yazıldı -> {pjsip_custom_path}")

        # Also save to project config dir
        prj_pjsip = os.path.join(PROJECT_ROOT, "asterisk_config", "pjsip_custom.conf")
        os.makedirs(os.path.dirname(prj_pjsip), exist_ok=True)
        with open(prj_pjsip, "w", encoding="utf-8") as pf:
            pf.write(pjsip_custom_content)

        # Ensure #include /etc/asterisk/pjsip_custom.conf in /etc/asterisk/pjsip.conf
        pjsip_main = "/etc/asterisk/pjsip.conf"
        need_append = True
        if os.path.exists(pjsip_main):
            with open(pjsip_main, "r", encoding="utf-8") as f:
                curr_pjsip = f.read()
            if "#include /etc/asterisk/pjsip_custom.conf" in curr_pjsip or "#include pjsip_custom.conf" in curr_pjsip:
                need_append = False
        
        if need_append:
            with open(pjsip_main, "a", encoding="utf-8") as f:
                f.write("\n#include /etc/asterisk/pjsip_custom.conf\n#include pjsip_custom.conf\n")
            print("[Sync Script] #include pjsip_custom.conf -> /etc/asterisk/pjsip.conf eklendi.")

        subprocess.run(["asterisk", "-rx", "module reload res_pjsip.so"], check=False)
        subprocess.run(["asterisk", "-rx", "pjsip reload"], check=False)
        print("[Sync Script] Asterisk PJSIP başarıyla yenilendi (pjsip reload).")
    except Exception as e_pjsip:
        print(f"[Sync Script] PJSIP oluşturma hatası: {e_pjsip}")

    # 2. Generate clean extensions_custom.conf without discouragged _.-pattern
    ext_content = """; ==========================================
; DINAMIK OLARAK OLUŞTURULAN EXTENSIONS (DIALPLAN) AYARLARI
; ==========================================

[default]
; Operatörden gelen aramaları yakalamak için (Standart numara eşleşmesi)
exten => _X.,1,NoOp(Gelen arama DID ile yakalandi: ${EXTEN} - Arayan: ${CALLERID(num)})
same => n,Set(UUID_VAL=${UUID()})
same => n,Set(MD5_VAL=${MD5(${UNIQUEID})})
same => n,Set(CALL_UUID=${IF($[${ISNULL(${UUID_VAL})}]?${MD5_VAL:0:8}-${MD5_VAL:8:4}-4${MD5_VAL:13:3}-a${MD5_VAL:17:3}-${MD5_VAL:20:12}:${UUID_VAL})})
same => n,Set(CURL_RESULT=${CURL(http://127.0.0.1:8000/api/calls/register?call_id=${CALL_UUID}&did=${EXTEN}&caller=${CALLERID(num)}&asterisk_id=${UNIQUEID})})
same => n,Progress()
same => n,Answer()
same => n,MixMonitor(/var/spool/asterisk/monitor/${CALL_UUID}.wav)
same => n,AudioSocket(${CALL_UUID},127.0.0.1:9092)
same => n,Hangup()

; Uluslararası / + ile gelen DID numaraları için (+90...)
exten => _+X.,1,NoOp(Gelen arama +DID ile yakalandi: ${EXTEN} - Arayan: ${CALLERID(num)})
same => n,Set(UUID_VAL=${UUID()})
same => n,Set(MD5_VAL=${MD5(${UNIQUEID})})
same => n,Set(CALL_UUID=${IF($[${ISNULL(${UUID_VAL})}]?${MD5_VAL:0:8}-${MD5_VAL:8:4}-4${MD5_VAL:13:3}-a${MD5_VAL:17:3}-${MD5_VAL:20:12}:${UUID_VAL})})
same => n,Set(CURL_RESULT=${CURL(http://127.0.0.1:8000/api/calls/register?call_id=${CALL_UUID}&did=${EXTEN}&caller=${CALLERID(num)}&asterisk_id=${UNIQUEID})})
same => n,Progress()
same => n,Answer()
same => n,MixMonitor(/var/spool/asterisk/monitor/${CALL_UUID}.wav)
same => n,AudioSocket(${CALL_UUID},127.0.0.1:9092)
same => n,Hangup()

; Fallback (s uzantısı)
exten => s,1,NoOp(Gelen arama s uzantisi ile yakalandi: ${CALLERID(num)})
same => n,Set(UUID_VAL=${UUID()})
same => n,Set(MD5_VAL=${MD5(${UNIQUEID})})
same => n,Set(CALL_UUID=${IF($[${ISNULL(${UUID_VAL})}]?${MD5_VAL:0:8}-${MD5_VAL:8:4}-4${MD5_VAL:13:3}-a${MD5_VAL:17:3}-${MD5_VAL:20:12}:${UUID_VAL})})
same => n,Set(CURL_RESULT=${CURL(http://127.0.0.1:8000/api/calls/register?call_id=${CALL_UUID}&did=s&caller=${CALLERID(num)}&asterisk_id=${UNIQUEID})})
same => n,Progress()
same => n,Answer()
same => n,MixMonitor(/var/spool/asterisk/monitor/${CALL_UUID}.wav)
same => n,AudioSocket(${CALL_UUID},127.0.0.1:9092)
same => n,Hangup()

; Hangup handler (h uzantısı)
exten => h,1,NoOp(Cagri sonlandi: ${EXTEN})
same => n,Hangup()

[webrtc_agents]
exten => _0.,1,NoOp(Dis arama baslatiliyor: Arayan=${CALLERID(num)}, Aranan=${EXTEN})
same => n,Set(CALL_UUID=${UUID()})
same => n,Set(CURL_RESULT=${CURL(http://127.0.0.1:8000/api/calls/register?call_id=${CALL_UUID}&did=${EXTEN}&caller=${CALLERID(num)}&asterisk_id=${UNIQUEID})})
same => n,MixMonitor(/var/spool/asterisk/monitor/${CALL_UUID}.wav)
same => n,Dial(PJSIP/Operator_Trunk/sip:${EXTEN}@ikonsip.com:5060,60,r)
same => n,Hangup()

exten => h,1,NoOp(Temsilci dis aramasi sonlandi. Call ID: ${CALL_UUID})
same => n,Set(CURL_RESULT=${CURL(http://127.0.0.1:8000/api/calls/end?call_id=${CALL_UUID})})

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

    try:
        subprocess.run(["asterisk", "-rx", "dialplan reload"], check=True)
        print("[Sync Script] Asterisk Dialplan başarıyla yenilendi (reload).")
    except Exception as e:
        print(f"[Sync Script] Asterisk reload hatası: {e}")

if __name__ == "__main__":
    sync()
