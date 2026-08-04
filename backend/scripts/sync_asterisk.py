import os
import sys
import subprocess

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
