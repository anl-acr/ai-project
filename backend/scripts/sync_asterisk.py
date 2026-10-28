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
    try:
        if os.path.exists("/etc/asterisk"):
            os.makedirs(ast_keys_dir, exist_ok=True)
    except Exception:
        pass
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

    # Update /etc/asterisk/rtp.conf for WebRTC RTP NAT & STUN
    rtp_content = """; ==========================================
; Asterisk RTP Configuration
; ==========================================
[general]
rtpstart=10000
rtpend=20000
stunaddr=stun.l.google.com:19302
"""
    if os.path.exists("/etc/asterisk"):
        try:
            with open("/etc/asterisk/rtp.conf", "w", encoding="utf-8") as f:
                f.write(rtp_content)
        except Exception as e:
            print(f"[Sync Script] rtp.conf error: {e}")

    # Generate /etc/asterisk/pjsip_custom.conf directly in sync script
    sdata = {}
    try:
        import json
        settings_json_path = os.path.join(BASE_DIR, "settings.json")
        users_list = []
        nat_cfg = {}
        if os.path.exists(settings_json_path):
            with open(settings_json_path, "r", encoding="utf-8") as sf:
                sdata = json.load(sf)
                users_list = sdata.get("users", [])
                nat_cfg = sdata.get("nat", {})

        nat_enabled = nat_cfg.get("enabled", False)
        extern_ip = (nat_cfg.get("extern_ip") or "").strip()
        local_nets = nat_cfg.get("local_nets", [])
        if isinstance(local_nets, str):
            local_nets = [net.strip() for net in local_nets.split(",") if net.strip()]

        import hashlib
        def resolve_secure_sip_password(ext_val, raw_pwd=""):
            ext_c = str(ext_val or "1000").strip()
            pwd_c = str(raw_pwd or "").strip()
            weak_s = {"", "1234", "12345", "123456", "12345678", "0000", "1111", "admin", "password", ext_c}
            if pwd_c in weak_s or len(pwd_c) < 8:
                dg = hashlib.sha256(f"AIDA_PBX_SIP_V2_SECRET_{ext_c}_8842".encode("utf-8")).hexdigest()[:12]
                return f"Aida#{dg}"
            return pwd_c

        user_1000 = next((u for u in users_list if str(u.get("extension") or "").strip() == "1000"), None)
        pwd_1000 = resolve_secure_sip_password("1000", (user_1000.get("sip_password") if user_1000 else ""))
        name_1000 = (user_1000.get("full_name") or user_1000.get("username") or "Temsilci 1000") if user_1000 else "Temsilci 1000"

        nat_lines = ""
        if extern_ip:
            nat_lines += f"external_media_address={extern_ip}\nexternal_signaling_address={extern_ip}\n"
        if nat_enabled and local_nets:
            for net in local_nets:
                net_clean = str(net).strip()
                if net_clean:
                    nat_lines += f"local_net={net_clean}\n"

        trunks_list = sdata.get("trunks", []) if isinstance(sdata, dict) else []

        import re
        def _sanitize_t_name(nm):
            c = re.sub(r"[^a-zA-Z0-9_\-.]", "_", str(nm or "trunk").strip())
            return c or "trunk"

        def _norm_codecs(t_obj):
            valid_c = {"alaw", "ulaw", "g722", "g729", "opus", "gsm", "ilbc", "h264", "vp8", "g726", "slin", "speex"}
            rl = t_obj.get("codecs")
            if isinstance(rl, str):
                try:
                    rl = json.loads(rl)
                except Exception:
                    rl = [x.strip() for x in rl.split(",") if x.strip()]
            out_c = []
            if isinstance(rl, list) and rl:
                for it in rl:
                    cc = str(it or "").strip().lower()
                    if cc in ("g711", "g.711"):
                        for sb in ("alaw", "ulaw"):
                            if sb not in out_c:
                                out_c.append(sb)
                    elif cc in valid_c and cc not in out_c:
                        out_c.append(cc)
            if not out_c:
                leg = str(t_obj.get("codec") or "alaw,ulaw,g722,g729").strip()
                for pt in leg.split(","):
                    pp = pt.strip().lower()
                    if pp in ("g711", "g.711"):
                        for sb in ("alaw", "ulaw"):
                            if sb not in out_c:
                                out_c.append(sb)
                    elif pp in valid_c and pp not in out_c:
                        out_c.append(pp)
            return ",".join(out_c or ["alaw", "ulaw", "g722", "g729"])

        def _parse_sh(t_obj):
            rw = t_obj.get("sip_headers")
            if isinstance(rw, str):
                try:
                    rw = json.loads(rw)
                except Exception:
                    rw = {}
            return rw if isinstance(rw, dict) else {}

        custom_global_ua = ""
        for t in trunks_list:
            if t.get("is_active", True) is False:
                continue
            ua_v = str(_parse_sh(t).get("user_agent") or "").strip()
            if ua_v:
                custom_global_ua = ua_v
                break

        global_ua_block = f"[global]\ntype=global\nuser_agent={custom_global_ua}\nmax_forwards=70\n\n" if custom_global_ua else ""
        has_tls_trunk = any(str(t.get("protocol") or "").lower() == "tls" and (t.get("is_active", True) is not False) for t in trunks_list)
        tls_block = ""
        if has_tls_trunk or os.path.exists("/etc/asterisk/keys/asterisk.pem"):
            tls_block = f"""[transport-tls]
type=transport
protocol=tls
bind=0.0.0.0:5061
cert_file=/etc/asterisk/keys/asterisk.pem
priv_key_file=/etc/asterisk/keys/webphone_privkey.pem
method=tlsv1_2
verify_server=no
verify_client=no
{nat_lines}"""

        pjsip_custom_content = f"""; ==========================================
; DINAMIK OLARAK OLUŞTURULAN SIP TRUNK VE DAHILI AYARLARI
; ==========================================

{global_ua_block}[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0
{nat_lines}
[transport-tcp]
type=transport
protocol=tcp
bind=0.0.0.0
{nat_lines}
{tls_block}[transport-ws]
type=transport
protocol=ws
bind=0.0.0.0:8088
{nat_lines}
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
{nat_lines}
; --- OPERATOR TRUNK (OUTBOUND LINK) ---
[Operator_Trunk]
type=endpoint
context=default
disallow=all
allow=ulaw,alaw,g722,g729
direct_media=no
rtp_symmetric=yes
force_rport=yes
rewrite_contact=no
media_use_received_transport=yes
outbound_auth=908503607390-auth
aors=908503607390-aor

"""
        for t in trunks_list:
            if t.get("is_active", True) is False:
                continue
            raw_name = t.get("trunk_name") or t.get("name") or "trunk"
            name = _sanitize_t_name(raw_name)
            host = str(t.get("host") or "").strip() or "127.0.0.1"
            port = t.get("port") or 5060
            did = str(t.get("did_number") or "").strip()
            protocol = str(t.get("protocol") or "udp").lower()
            transport = "transport-tls" if protocol == "tls" else ("transport-tcp" if protocol == "tcp" else "transport-udp")
            t_type = str(t.get("trunk_type") or "register").lower()
            if t_type == "ip":
                t_type = "peer"
            username = str(t.get("username") or "").strip()
            password = str(t.get("password") or "").strip()
            allow_codecs = _norm_codecs(t)
            sh = _parse_sh(t)
            realm = str(sh.get("realm") or "").strip()
            in_caller_hdr = str(sh.get("inbound_caller_header") or "default").strip()
            out_from_user = str(sh.get("outbound_from_user") or "default").strip()
            out_from_user_custom = str(sh.get("outbound_from_user_custom") or "").strip()
            out_diversion = str(sh.get("outbound_diversion") or "none").strip()
            out_rpid = str(sh.get("outbound_rpid") or "none").strip()
            out_pai = str(sh.get("outbound_pai") or "none").strip()

            send_rpid = "yes" if out_rpid != "none" else "no"
            send_pai = "yes" if out_pai != "none" else "no"
            send_diversion = "yes" if out_diversion != "none" else "no"
            trust_id_in = "yes" if in_caller_hdr in ("rpid", "pai", "ppi", "default") else "no"

            endpoint_from_user = ""
            if out_from_user == "trunk_username" and username:
                endpoint_from_user = username
            elif out_from_user == "trunk_did" and did:
                endpoint_from_user = did
            elif out_from_user == "custom" and out_from_user_custom:
                endpoint_from_user = out_from_user_custom
            elif t_type == "register" and out_from_user == "default" and username:
                endpoint_from_user = username

            endpoint_from_domain = realm if realm else (host if t_type in ("register", "peer") and host != "127.0.0.1" else "")
            realm_line = f"realm={realm}\n" if realm else ""
            contact_user_line = f"contact_user={did}\n" if did else ""

            pjsip_custom_content += f"\n; --- TRUNK: {raw_name} ({t_type}) ---\n"
            if t_type == "register":
                pjsip_custom_content += f"""[{name}-auth]
type=auth
auth_type=userpass
username={username}
password={password}
{realm_line}
[{name}-reg]
type=registration
transport={transport}
outbound_auth={name}-auth
server_uri=sip:{host}:{port}
client_uri=sip:{username}@{host}:{port}
retry_interval=60
expiration=3600
auth_rejection_permanent=no
{contact_user_line}
[{name}-aor]
type=aor
contact=sip:{host}:{port}
qualify_frequency=60

[{name}]
type=endpoint
transport={transport}
context=from-trunk-{name}
disallow=all
allow={allow_codecs}
aors={name}-aor
outbound_auth={name}-auth
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes
send_rpid={send_rpid}
send_pai={send_pai}
send_diversion={send_diversion}
trust_id_inbound={trust_id_in}
"""
                if endpoint_from_user:
                    pjsip_custom_content += f"from_user={endpoint_from_user}\n"
                if endpoint_from_domain:
                    pjsip_custom_content += f"from_domain={endpoint_from_domain}\n"
                if did:
                    pjsip_custom_content += f"callerid={did} <{did}>\n"
                pjsip_custom_content += f"\n[{name}-identify]\ntype=identify\nendpoint={name}\nmatch={host}\n\n"
            elif t_type == "peer":
                pjsip_custom_content += f"""[{name}-aor]
type=aor
contact=sip:{host}:{port}
qualify_frequency=60

[{name}]
type=endpoint
transport={transport}
context=from-trunk-{name}
disallow=all
allow={allow_codecs}
aors={name}-aor
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes
send_rpid={send_rpid}
send_pai={send_pai}
send_diversion={send_diversion}
trust_id_inbound={trust_id_in}
"""
                if endpoint_from_user:
                    pjsip_custom_content += f"from_user={endpoint_from_user}\n"
                if endpoint_from_domain:
                    pjsip_custom_content += f"from_domain={endpoint_from_domain}\n"
                if did:
                    pjsip_custom_content += f"callerid={did} <{did}>\n"
                pjsip_custom_content += f"\n[{name}-identify]\ntype=identify\nendpoint={name}\nmatch={host}\n\n"
            elif t_type == "account":
                acc_user = username or name
                pjsip_custom_content += f"""[{name}-auth]
type=auth
auth_type=userpass
username={acc_user}
password={password}
{realm_line}
[{name}-aor]
type=aor
max_contacts=5
remove_existing=yes
qualify_frequency=30

[{name}]
type=endpoint
transport={transport}
context=from-trunk-{name}
disallow=all
allow={allow_codecs}
auth={name}-auth
outbound_auth={name}-auth
aors={name}-aor
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes
send_rpid={send_rpid}
send_pai={send_pai}
send_diversion={send_diversion}
trust_id_inbound={trust_id_in}
"""
                if endpoint_from_user:
                    pjsip_custom_content += f"from_user={endpoint_from_user}\n"
                if endpoint_from_domain:
                    pjsip_custom_content += f"from_domain={endpoint_from_domain}\n"
                if did:
                    pjsip_custom_content += f"callerid={did} <{did}>\n"
                pjsip_custom_content += "\n"
                if acc_user and acc_user != name:
                    pjsip_custom_content += f"""[{acc_user}]
type=aor
max_contacts=5
remove_existing=yes
qualify_frequency=30

[{acc_user}]
type=endpoint
transport={transport}
context=from-trunk-{name}
disallow=all
allow={allow_codecs}
auth={name}-auth
outbound_auth={name}-auth
aors={acc_user}
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes
send_rpid={send_rpid}
send_pai={send_pai}
send_diversion={send_diversion}
trust_id_inbound={trust_id_in}
"""
                    if endpoint_from_user:
                        pjsip_custom_content += f"from_user={endpoint_from_user}\n"
                    if endpoint_from_domain:
                        pjsip_custom_content += f"from_domain={endpoint_from_domain}\n"
                    pjsip_custom_content += "\n"

        has_1000_in_users = any(str(u.get("extension") or "").strip() == "1000" and (u.get("is_active", True) is not False) for u in users_list)
        if not has_1000_in_users:
            pjsip_custom_content += f"""
; --- DEFAULT WEBRTC AGENT: 1000 ---
[1000]
type=endpoint
context=webrtc_agents
disallow=all
allow=ulaw,alaw,g722,g729
direct_media=no
force_rport=yes
rewrite_contact=no
rtp_symmetric=yes
webrtc=yes
use_avpf=yes
media_encryption=dtls
dtls_auto_generate_cert=yes
dtls_verify=fingerprint
dtls_setup=actpass
ice_support=yes
media_use_received_transport=yes
auth=1000-auth
aors=1000
callerid={name_1000} <1000>

[1000-auth]
type=auth
auth_type=userpass
username=1000
password={pwd_1000}

[1000]
type=aor
max_contacts=5
remove_existing=yes
"""
        seen_exts = set()
        for u in users_list:
            is_act = u.get("is_active") if "is_active" in u else True
            if not is_act:
                continue
            ext = str(u.get("extension", "")).strip()
            if not ext or ext in seen_exts:
                continue
            seen_exts.add(ext)
            pwd = resolve_secure_sip_password(ext, u.get("sip_password") or "")
            name = u.get("full_name") or u.get("username") or ext
            sip_user = str(u.get("sip_username") or "").strip()
            try:
                max_act = max(5, int(u.get("max_activations") or 5))
            except Exception:
                max_act = 5

            pjsip_custom_content += f"\n; --- USER: {name} ({ext}) ---\n"
            pjsip_custom_content += f"""[{ext}]
type=endpoint
context=webrtc_agents
disallow=all
allow=ulaw,alaw,g722,g729
direct_media=no
force_rport=yes
rewrite_contact=no
rtp_symmetric=yes
webrtc=yes
use_avpf=yes
media_encryption=dtls
dtls_auto_generate_cert=yes
dtls_verify=fingerprint
dtls_setup=actpass
ice_support=yes
media_use_received_transport=yes
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
max_contacts={max_act}
remove_existing=yes
"""
            if sip_user and sip_user != ext:
                pjsip_custom_content += f"""
[{sip_user}]
type=endpoint
context=webrtc_agents
disallow=all
allow=ulaw,alaw,g722,g729
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes
auth={sip_user}-auth
aors={ext}
callerid={name} <{ext}>

[{sip_user}-auth]
type=auth
auth_type=userpass
username={sip_user}
password={pwd}
"""

        # Write directly to /etc/asterisk/pjsip_custom.conf
        pjsip_custom_path = "/etc/asterisk/pjsip_custom.conf"
        with open(pjsip_custom_path, "w", encoding="utf-8") as pf:
            pf.write(pjsip_custom_content)
        print(f"[Sync Script] pjsip_custom.conf yazıldı -> {pjsip_custom_path}")

        # Clean and reset /etc/asterisk/pjsip.conf to cleanly include pjsip_custom.conf
        pjsip_main = "/etc/asterisk/pjsip.conf"
        clean_pjsip_main = """; ==========================================
; Asterisk PJSIP Main Configuration
; ==========================================
#include /etc/asterisk/pjsip_custom.conf
"""
        with open(pjsip_main, "w", encoding="utf-8") as f:
            f.write(clean_pjsip_main)
        print("[Sync Script] /etc/asterisk/pjsip.conf temizlendi ve #include pjsip_custom.conf eklendi.")

        subprocess.run(["asterisk", "-rx", "module reload res_pjsip.so"], check=False)
        subprocess.run(["asterisk", "-rx", "pjsip reload"], check=False)
        print("[Sync Script] Asterisk PJSIP başarıyla yenilendi (pjsip reload).")
    except Exception as e_pjsip:
        print(f"[Sync Script] PJSIP oluşturma hatası: {e_pjsip}")

    # 2. Generate clean extensions_custom.conf with dynamic Call Pickup & Call Forwarding Feature Codes
    pbx_cfg = sdata.get("pbx", {}) if isinstance(sdata.get("pbx"), dict) else {}
    num_plan = pbx_cfg.get("numbering_plan", {}) if isinstance(pbx_cfg.get("numbering_plan"), dict) else {}
    pickup_cfg = num_plan.get("call_pickup", {}) if isinstance(num_plan.get("call_pickup"), dict) else {}
    fwd_cfg = num_plan.get("call_forwarding", {}) if isinstance(num_plan.get("call_forwarding"), dict) else {}
    mon_cfg = num_plan.get("call_monitoring", {}) if isinstance(num_plan.get("call_monitoring"), dict) else {}

    pickup_group = str(pickup_cfg.get("group") or "*8").strip() or "*8"
    pickup_directed = str(pickup_cfg.get("directed") or "**").strip() or "**"
    pickup_dir_len = len(pickup_directed)

    fwd_always_pfx = str(fwd_cfg.get("always") or "*21*").strip() or "*21*"
    fwd_busy_pfx = str(fwd_cfg.get("busy") or "*67*").strip() or "*67*"
    fwd_noans_pfx = str(fwd_cfg.get("no_answer") or "*61*").strip() or "*61*"
    fwd_cancel_pfx = str(fwd_cfg.get("cancel") or "#21#").strip() or "#21#"

    mon_listen_pfx = str(mon_cfg.get("listen") or "*551*").strip() or "*551*"
    mon_whisper_pfx = str(mon_cfg.get("whisper") or "*552*").strip() or "*552*"
    mon_barge_pfx = str(mon_cfg.get("barge") or "*553*").strip() or "*553*"

    def _build_chanspy_exten(pat_str: str, mode_str: str, comment_str: str) -> str:
        return f"""; {comment_str} ({pat_str})
exten => {pat_str},1,NoOp(Masa Telefonu Canli Cagri Izleme [{mode_str}]: Arayan=${{CALLERID(num)}}, Kod=${{EXTEN}})
same => n,Set(CURLOPT(conntimeout)=1)
same => n,Set(CURLOPT(httptimeout)=3)
same => n,Set(SPY_RES=${{CURL(http://127.0.0.1:8000/api/calls/resolve_chanspy?caller=${{URIENCODE(${{CALLERID(num)}})}}&exten=${{URIENCODE(${{EXTEN}})}}&mode={mode_str}&channel=${{URIENCODE(${{CHANNEL(name)}})}})}})
same => n,Set(SPY_STATUS=${{CUT(SPY_RES,:,1)}})
same => n,Set(SPY_CHAN=${{CUT(SPY_RES,:,2)}})
same => n,Set(SPY_FLAGS=${{CUT(SPY_RES,:,3)}})
same => n,GotoIf($["${{SPY_STATUS}}"="ALLOW"]?do_spy:deny_spy)
same => n(do_spy),NoOp(ChanSpy Baslatiliyor: Kanal=${{SPY_CHAN}}, Bayraklar=${{SPY_FLAGS}})
same => n,Answer()
same => n,Wait(0.2)
same => n,ChanSpy(${{SPY_CHAN}},${{SPY_FLAGS}})
same => n,Hangup()
same => n(deny_spy),NoOp(ChanSpy Reddedildi veya Aktif Cagri Yok: ${{SPY_RES}})
same => n,Answer()
same => n,Wait(0.2)
same => n,Playback(beeperr)
same => n,Hangup()
"""

    def _build_feat_exten(pat_str: str, comment_str: str) -> str:
        return f"""; {comment_str} ({pat_str})
exten => {pat_str},1,NoOp(Masa Telefonu Yonlendirme Kodu: Arayan=${{CALLERID(num)}}, Kod=${{EXTEN}})
same => n,Set(CURLOPT(conntimeout)=1)
same => n,Set(CURLOPT(httptimeout)=3)
same => n,Set(FEAT_RES=${{CURL(http://127.0.0.1:8000/api/subscriber/resolve_feature_code?caller=${{URIENCODE(${{CALLERID(num)}})}}&exten=${{URIENCODE(${{EXTEN}})}}&channel=${{URIENCODE(${{CHANNEL(name)}})}})}})
same => n,GotoIf($["${{CUT(FEAT_RES,:,1)}}"="CHANSPY"]?do_feat_spy)
same => n,Answer()
same => n,Wait(0.3)
same => n,GotoIf($["${{FEAT_RES}}"="ACTIVATED"]?play_act)
same => n,GotoIf($["${{FEAT_RES}}"="CANCELLED"]?play_canc)
same => n,Playback(beeperr)
same => n,Hangup()
same => n(do_feat_spy),Set(SPY_CHAN=${{CUT(FEAT_RES,:,2)}})
same => n,Set(SPY_FLAGS=${{CUT(FEAT_RES,:,3)}})
same => n,Answer()
same => n,Wait(0.2)
same => n,ChanSpy(${{SPY_CHAN}},${{SPY_FLAGS}})
same => n,Hangup()
same => n(play_act),Playback(/var/spool/asterisk/monitor/tr_yonlendirme_aktif)
same => n,Hangup()
same => n(play_canc),Playback(/var/spool/asterisk/monitor/tr_yonlendirme_iptal)
same => n,Hangup()
"""

    reserved_pats = {pickup_group, f"_{pickup_directed}X."}
    feat_blocks = []
    seen_pats = set(reserved_pats)

    def _add_chanspy_feat(pat: str, mode_str: str, label: str):
        if not pat or pat in seen_pats:
            return
        seen_pats.add(pat)
        feat_blocks.append(_build_chanspy_exten(pat, mode_str, label))

    def _add_feat(pat: str, label: str):
        if not pat or pat in seen_pats:
            return
        seen_pats.add(pat)
        feat_blocks.append(_build_feat_exten(pat, label))

    for m_pfx, m_mode, m_lbl in [
        (mon_listen_pfx, "listen", "Cagri Dinleme / Fisildama (ChanSpy Listen)"),
        (mon_whisper_pfx, "whisper", "Sufle Verme (ChanSpy Whisper)"),
        (mon_barge_pfx, "barge", "Araya Girme (ChanSpy Barge)"),
    ]:
        _add_chanspy_feat(f"_{m_pfx}.", m_mode, m_lbl)
        if m_pfx.endswith("*") and len(m_pfx.rstrip("*")) >= 2:
            _add_chanspy_feat(f"_{m_pfx.rstrip('*')}X.", m_mode, f"{m_lbl} (Alternatif)")
        _add_chanspy_feat(m_pfx, m_mode, f"{m_lbl} (Genel AI/Aktif Cagri)")

    for pfx, lbl in [
        (fwd_always_pfx, "Her Zaman Yonlendirme"),
        (fwd_busy_pfx, "Mesgulde Yonlendirme"),
        (fwd_noans_pfx, "Zaman Asiminda Yonlendirme"),
    ]:
        _add_feat(f"_{pfx}.", f"{lbl} Aktiflestirme")
        if pfx.endswith("*") and len(pfx.rstrip("*")) >= 2:
            _add_feat(f"_{pfx.rstrip('*')}X.", f"{lbl} Alternatif Aktiflestirme")
        _add_feat(pfx, f"{lbl} Dogrudan Iptal")

    _add_feat(fwd_cancel_pfx, "Yonlendirme Iptal Kodu")
    if fwd_cancel_pfx.endswith("#") and len(fwd_cancel_pfx.rstrip("#")) >= 2:
        _add_feat(fwd_cancel_pfx.rstrip("#"), "Yonlendirme Iptal Kodu (# Send Fallback)")
    _add_feat(f"_{fwd_cancel_pfx}.", "Yonlendirme Iptal Kodu + Hedef")

    _add_feat("_*.", "Genel Yildiz (*) Ozellik Kodu Yakalayici")
    _add_feat("_#.", "Genel Kare (#) Ozellik Kodu Yakalayici")
    _add_feat("_%23.", "Genel URL-Encoded Kare (%23) Ozellik Kodu Yakalayici")

    dynamic_feature_dialplan = "\n".join(feat_blocks)

    webrtc_header_and_features = f"""; Hedefli Çağrı Çekme (Directed Call Pickup: {pickup_directed}1001 vb.) ve Grup Çağrı Çekme ({pickup_group})
exten => _{pickup_directed}X.,1,NoOp(Hedefli Cagri Cekme: Ceken=${{CALLERID(num)}} -> Calan=${{EXTEN:{pickup_dir_len}}})
same => n,Set(CURLOPT(conntimeout)=1)
same => n,Set(CURLOPT(httptimeout)=2)
same => n,Set(PICKUP_CHAN=${{CURL(http://127.0.0.1:8000/api/webrtc/resolve_pickup_channel?target_ext=${{EXTEN:{pickup_dir_len}}}&picker_ext=${{CALLERID(num)}})}})
same => n,GotoIf($["${{PICKUP_CHAN}}" != "" & "${{PICKUP_CHAN}}" != "NONE"]?do_pickupchan:do_std_pickup)
same => n(do_pickupchan),NoOp(PickupChan ile cagri cekiliyor: ${{PICKUP_CHAN}})
same => n,PickupChan(${{PICKUP_CHAN}})
same => n(do_std_pickup),Pickup(${{EXTEN:{pickup_dir_len}}}@webrtc_agents)
same => n,Pickup(${{EXTEN:{pickup_dir_len}}}@default)
same => n,Hangup()

exten => {pickup_group},1,NoOp(Grup Cagri Cekme ({pickup_group}): Ceken=${{CALLERID(num)}})
same => n,Pickup()
same => n,Hangup()

; Çağrı Yönlendirme (Her Zaman, Meşgulde, Zaman Aşımında, İptal Kodu) Prefix'leri
{dynamic_feature_dialplan}"""

    header_map = {
        "from": "From",
        "contact": "Contact",
        "rpid": "Remote-Party-ID",
        "pai": "P-Asserted-Identity",
        "ppi": "P-Preferred-Identity",
        "to": "To",
        "diversion": "Diversion",
        "p_called_party_id": "P-Called-Party-ID",
    }
    import re
    import json
    trunk_in_blocks = []
    seen_tnames = set()
    for t in (sdata.get("trunks", []) if isinstance(sdata, dict) else []):
        if t.get("is_active", True) is False:
            continue
        rname = t.get("trunk_name") or t.get("name") or "trunk"
        tname = re.sub(r"[^a-zA-Z0-9_\-.]", "_", str(rname).strip()) or "trunk"
        if tname in seen_tnames:
            continue
        seen_tnames.add(tname)
        sh = t.get("sip_headers") or {}
        if isinstance(sh, str):
            try:
                sh = json.loads(sh)
            except Exception:
                sh = {}
        in_caller = str(sh.get("inbound_caller_header") or "default").strip().lower()
        in_callee = str(sh.get("inbound_callee_header") or "default").strip().lower()
        maxptime = str(sh.get("maxptime") or "").strip()
        limit_enabled = bool(t.get("call_limit_enabled", False))
        limit_dir = str(t.get("call_limit_direction") or "both").strip().lower()
        try:
            max_ch = max(1, int(t.get("max_channels") or 30))
        except Exception:
            max_ch = 30
        caller_hdr_name = header_map.get(in_caller, "")
        callee_hdr_name = header_map.get(in_callee, "")
        t_lines = [f"; --- INBOUND CONTEXT FOR TRUNK: {rname} ({tname}) ---", f"[from-trunk-{tname}]"]
        for ext_pat in ("_X.", "_+X.", "s"):
            t_lines.append(f"exten => {ext_pat},1,NoOp(Trunk [{tname}] Gelen Arama: Exten=${{EXTEN}} Caller=${{CALLERID(num)}})")
            t_lines.append(f"same => n,Set(__INBOUND_TRUNK_NAME={tname})")
            if maxptime:
                t_lines.append(f"same => n,Set(__SIP_MAXPTIME={maxptime})")
            if caller_hdr_name:
                t_lines.append(f"same => n,Set(RAW_IN_CALLER=${{PJSIP_HEADER(read,{caller_hdr_name})}})")
                t_lines.append("same => n,Set(PARSED_CALLER=${CUT(CUT(CUT(RAW_IN_CALLER,@,1),:,2),>,1)})")
                t_lines.append("same => n,Set(CALLERID(num)=${IF($[\"${PARSED_CALLER}\" != \"\"]?${PARSED_CALLER}:${CALLERID(num)})})")
            if callee_hdr_name:
                t_lines.append(f"same => n,Set(RAW_IN_CALLEE=${{PJSIP_HEADER(read,{callee_hdr_name})}})")
                t_lines.append("same => n,Set(PARSED_CALLEE=${CUT(CUT(CUT(RAW_IN_CALLEE,@,1),:,2),>,1)})")
                t_lines.append("same => n,Set(RESOLVED_DID=${IF($[\"${PARSED_CALLEE}\" != \"\"]?${PARSED_CALLEE}:${EXTEN})})")
            else:
                t_lines.append("same => n,Set(RESOLVED_DID=${EXTEN})")
            t_lines.append("same => n,Set(__ORIG_CALLER_NUM=${CALLERID(num)})")
            t_lines.append("same => n,Set(__ORIG_CALLER_NAME=${CALLERID(name)})")
            if limit_enabled and limit_dir in ("both", "inbound"):
                t_lines.append(f"same => n,Set(GROUP(trunk_limit)={tname})")
                t_lines.append(f"same => n,GotoIf($[${{GROUP_COUNT({tname}@trunk_limit)}} > {max_ch}]?limit_exceeded)")
            t_lines.append("same => n,Goto(default,${RESOLVED_DID},1)")
            if limit_enabled and limit_dir in ("both", "inbound"):
                t_lines.append(f"same => n(limit_exceeded),NoOp(TRUNK CAGRI LIMITI ASILDI [{tname}]: Max={max_ch})")
                t_lines.append("same => n,Busy(5)")
                t_lines.append("same => n,Hangup(17)")
            t_lines.append("")
        trunk_in_blocks.append("\n".join(t_lines))

    trunk_inbound_str = "\n".join(trunk_in_blocks)

    ext_content = """; ==========================================
; DINAMIK OLARAK OLUŞTURULAN EXTENSIONS (DIALPLAN) AYARLARI
; ==========================================

[from-trunk]
include => default

[from-pstn]
include => default

[from-sip]
include => default

__TRUNK_INBOUND_BLOCK__

[trunk-outbound-headers]
exten => s,1,NoOp(Trunk Giden SIP Basliklari Uygulanıyor: Trunk=${OUT_TRUNK_NAME})
same => n,GotoIf($["${OUT_HDR_DIVERSION}" = ""]?chk_rpid)
same => n,Set(PJSIP_HEADER(add,Diversion)=${OUT_HDR_DIVERSION})
same => n(chk_rpid),GotoIf($["${OUT_HDR_RPID}" = ""]?chk_pai)
same => n,Set(PJSIP_HEADER(add,Remote-Party-ID)=${OUT_HDR_RPID})
same => n(chk_pai),GotoIf($["${OUT_HDR_PAI}" = ""]?chk_ppi)
same => n,Set(PJSIP_HEADER(add,P-Asserted-Identity)=${OUT_HDR_PAI})
same => n(chk_ppi),GotoIf($["${OUT_HDR_PPI}" = ""]?chk_ptime)
same => n,Set(PJSIP_HEADER(add,P-Preferred-Identity)=${OUT_HDR_PPI})
same => n(chk_ptime),GotoIf($["${OUT_MAXPTIME}" = ""]?done_hdrs)
same => n,Set(PJSIP_HEADER(add,X-Maxptime)=${OUT_MAXPTIME})
same => n(done_hdrs),Return()

[default]
; Operatörden gelen aramaları yakalamak için (Standart numara eşleşmesi)
exten => _X.,1,NoOp(Gelen arama DID ile yakalandi: ${EXTEN} - Arayan: ${CALLERID(num)})
same => n,Set(UUID_VAL=${UUID()})
same => n,Set(MD5_VAL=${MD5(${UNIQUEID})})
same => n,Set(CALL_UUID=${IF($[${ISNULL(${UUID_VAL})}]?${MD5_VAL:0:8}-${MD5_VAL:8:4}-4${MD5_VAL:13:3}-a${MD5_VAL:17:3}-${MD5_VAL:20:12}:${UUID_VAL})})
same => n,Set(CURL_RESULT=${CURL(http://127.0.0.1:8000/api/calls/register?call_id=${CALL_UUID}&did=${EXTEN}&caller=${CALLERID(num)}&asterisk_id=${UNIQUEID})})
same => n,GotoIf($["${CURL_RESULT}" = "BLOCKED"]?hangup_blocked_x)
same => n,Progress()
same => n,Answer()
same => n,MixMonitor(/var/spool/asterisk/monitor/${CALL_UUID}.wav)
same => n,AudioSocket(${CALL_UUID},127.0.0.1:9092)
same => n,Hangup()
same => n(hangup_blocked_x),NoOp(KARA LISTE / GUVENLIK ENGELI: Arayan reddedildi -> ${CALLERID(num)})
same => n,Hangup(21)

; Uluslararası / + ile gelen DID numaraları için (+90...)
exten => _+X.,1,NoOp(Gelen arama +DID ile yakalandi: ${EXTEN} - Arayan: ${CALLERID(num)})
same => n,Set(UUID_VAL=${UUID()})
same => n,Set(MD5_VAL=${MD5(${UNIQUEID})})
same => n,Set(CALL_UUID=${IF($[${ISNULL(${UUID_VAL})}]?${MD5_VAL:0:8}-${MD5_VAL:8:4}-4${MD5_VAL:13:3}-a${MD5_VAL:17:3}-${MD5_VAL:20:12}:${UUID_VAL})})
same => n,Set(CURL_RESULT=${CURL(http://127.0.0.1:8000/api/calls/register?call_id=${CALL_UUID}&did=${EXTEN}&caller=${CALLERID(num)}&asterisk_id=${UNIQUEID})})
same => n,GotoIf($["${CURL_RESULT}" = "BLOCKED"]?hangup_blocked_plus)
same => n,Progress()
same => n,Answer()
same => n,MixMonitor(/var/spool/asterisk/monitor/${CALL_UUID}.wav)
same => n,AudioSocket(${CALL_UUID},127.0.0.1:9092)
same => n,Hangup()
same => n(hangup_blocked_plus),NoOp(KARA LISTE / GUVENLIK ENGELI: Arayan reddedildi -> ${CALLERID(num)})
same => n,Hangup(21)

; Fallback (s uzantısı)
exten => s,1,NoOp(Gelen arama s uzantisi ile yakalandi: ${CALLERID(num)})
same => n,Set(UUID_VAL=${UUID()})
same => n,Set(MD5_VAL=${MD5(${UNIQUEID})})
same => n,Set(CALL_UUID=${IF($[${ISNULL(${UUID_VAL})}]?${MD5_VAL:0:8}-${MD5_VAL:8:4}-4${MD5_VAL:13:3}-a${MD5_VAL:17:3}-${MD5_VAL:20:12}:${UUID_VAL})})
same => n,Set(HEADER_TO=${PJSIP_HEADER(read,To)})
same => n,Set(EXTEN_FROM_HEADER=${CUT(CUT(HEADER_TO,@,1),:,2)})
same => n,Set(TRUNK_EXTEN=${CUT(CUT(CHANNEL(name),/,2),-,1)})
same => n,Set(REAL_DID=${IF($[${ISNULL(${EXTEN_FROM_HEADER})} | "${EXTEN_FROM_HEADER}"="s"]?${TRUNK_EXTEN}:${EXTEN_FROM_HEADER})})
same => n,Set(CURL_RESULT=${CURL(http://127.0.0.1:8000/api/calls/register?call_id=${CALL_UUID}&did=${REAL_DID}&caller=${CALLERID(num)}&asterisk_id=${UNIQUEID})})
same => n,GotoIf($["${CURL_RESULT}" = "BLOCKED"]?hangup_blocked_s)
same => n,Progress()
same => n,Answer()
same => n,MixMonitor(/var/spool/asterisk/monitor/${CALL_UUID}.wav)
same => n,AudioSocket(${CALL_UUID},127.0.0.1:9092)
same => n,Hangup()
same => n(hangup_blocked_s),NoOp(KARA LISTE / GUVENLIK ENGELI: Arayan reddedildi -> ${CALLERID(num)})
same => n,Hangup(21)

; Hangup handler (h uzantısı)
exten => h,1,NoOp(Cagri sonlandi: ${EXTEN})
same => n,Hangup()

; Yapay zeka aramayı insana aktarmak istediğinde AMI üzerinden bu dahili extension'a yönlendirir
exten => transfer_to_human,1,NoOp(Yapay zeka cagriyi temsilciye aktariyor: ${UNIQUEID})
same => n,Playback(/var/spool/asterisk/monitor/tr_aktariliyor)
same => n,Queue(temsilci_kuyrugu,c)
same => n,Set(CURLOPT(conntimeout)=1)
same => n,Set(CURLOPT(httptimeout)=2)
same => n,Set(SURVEY_CFG=${CURL(http://127.0.0.1:8000/api/queues/survey/config?queue_ext=temsilci_kuyrugu&agent_ext=${URIENCODE(${MEMBERINTERFACE})}&call_id=${CALL_UUID})})
same => n,GotoIf($["${CUT(SURVEY_CFG,:,1)}" != "ENABLED"]?hangup_transfer)
same => n,Set(SURVEY_Q_EXT=${CUT(SURVEY_CFG,:,2)})
same => n,Set(SURVEY_MAX_DIGITS=${CUT(SURVEY_CFG,:,3)})
same => n,Set(SURVEY_TIMEOUT=${CUT(SURVEY_CFG,:,4)})
same => n,Set(SURVEY_Q_WAVS=${CUT(SURVEY_CFG,:,5)})
same => n,Set(SURVEY_TY_WAV=${CUT(SURVEY_CFG,:,6)})
same => n,Set(SURVEY_Q_CNT=${CUT(SURVEY_CFG,:,7)})
same => n,Set(SURVEY_Q_CNT=${IF($["${SURVEY_Q_CNT}" = ""]?1:${SURVEY_Q_CNT})})
same => n,Set(SURVEY_Q_IDX=1)
same => n,Set(SURVEY_ALL_SCORES=)
same => n,Set(SURVEY_ANY_ANS=0)
same => n(survey_t_loop),GotoIf($[${SURVEY_Q_IDX} > ${SURVEY_Q_CNT}]?survey_t_done)
same => n,Set(CUR_Q_WAV=${CUT(SURVEY_Q_WAVS,&,${SURVEY_Q_IDX})})
same => n,Set(CUR_Q_WAV=${IF($["${CUR_Q_WAV}" = ""]?tr_anket_soru:${CUR_Q_WAV})})
same => n,Set(SURVEY_SCORE=)
same => n,Read(SURVEY_SCORE,/var/spool/asterisk/monitor/${CUR_Q_WAV},${SURVEY_MAX_DIGITS},,,${SURVEY_TIMEOUT})
same => n,Set(SURVEY_ANY_ANS=${IF($["${SURVEY_SCORE}" != ""]?1:${SURVEY_ANY_ANS})})
same => n,Set(SURVEY_ALL_SCORES=${IF($[${SURVEY_Q_IDX} = 1]?${SURVEY_SCORE}:${SURVEY_ALL_SCORES},${SURVEY_SCORE})})
same => n,Set(SURVEY_Q_IDX=$[${SURVEY_Q_IDX} + 1])
same => n,Goto(survey_t_loop)
same => n(survey_t_done),Set(SURVEY_RES=${CURL(http://127.0.0.1:8000/api/queues/survey/submit?call_id=${CALL_UUID}&queue_ext=${SURVEY_Q_EXT}&agent_ext=${URIENCODE(${MEMBERINTERFACE})}&caller=${CALLERID(num)}&score=${URIENCODE(${SURVEY_ALL_SCORES})})})
same => n,GotoIf($["${SURVEY_ANY_ANS}" != "1"]?hangup_transfer)
same => n,Playback(/var/spool/asterisk/monitor/${SURVEY_TY_WAV})
same => n(hangup_transfer),Hangup()

[webrtc_agents]
; WebRTC istemcileri ve Masa Telefonları (temsilciler) bu context üzerinden görüşme yapar

__WEBRTC_FEATURES_BLOCK__

; +90 veya + ile başlayan dış hat aramalarını başında + olmadan yönlendir
exten => _+X.,1,Goto(webrtc_agents,${EXTEN:1},1)

; Dış hat aramaları için (0 ile başlayan numaralar - Güvenlik & Toll-Fraud ACL Korumalı)
exten => _0.,1,NoOp(Dis arama guvenlik kontrolu: Arayan=${CALLERID(num)}, Aranan=${EXTEN})"""
    ext_content = ext_content.replace("__TRUNK_INBOUND_BLOCK__", trunk_inbound_str).replace("__WEBRTC_FEATURES_BLOCK__", webrtc_header_and_features) + """
same => n(outbound_start),Set(CURLOPT(conntimeout)=1)
same => n,Set(CURLOPT(httptimeout)=2)
same => n,Set(OUT_ACL=${CURL(http://127.0.0.1:8000/api/acl/check_outbound_call?caller=${CALLERID(num)}&callee=${EXTEN}&channel=${URIENCODE(${CHANNEL(name)})}&via=${URIENCODE(${PJSIP_HEADER(read,Via)})})})
same => n,GotoIf($["${OUT_ACL}" = "ALLOW"]?allow_out:deny_out)
same => n(deny_out),NoOp(GUVENLIK ENGELI: Yetkisiz veya sahte dis arama reddedildi -> Arayan=${CALLERID(num)}, Aranan=${EXTEN}, Sebep=${OUT_ACL})
same => n,Playback(/var/spool/asterisk/monitor/tr_yetkisiz_arama)
same => n,Hangup(21)
same => n(allow_out),NoOp(Dis arama onaylandi: Arayan=${CALLERID(num)}, Aranan=${EXTEN})
same => n,Set(MD5_VAL=${MD5(${UNIQUEID}${EPOCH})})
same => n,Set(__CALL_UUID=${MD5_VAL:0:8}-${MD5_VAL:8:4}-4${MD5_VAL:13:3}-a${MD5_VAL:17:3}-${MD5_VAL:20:12})
same => n,Set(CURL_RESULT=${CURL(http://127.0.0.1:8000/api/calls/register?call_id=${CALL_UUID}&did=${EXTEN}&caller=${CALLERID(num)}&asterisk_id=${UNIQUEID})})
same => n,GotoIf($["${CURL_RESULT}" = "BLOCKED"]?deny_out)
same => n,MixMonitor(/var/spool/asterisk/monitor/${CALL_UUID}.wav)
same => n,Set(DIAL_NUM=${IF($["${EXTEN:0:1}"="0"]?90${EXTEN:1}:${EXTEN})})
same => n,Set(OUT_CFG=${CURL(http://127.0.0.1:8000/api/trunks/resolve_outbound_dial?caller=${URIENCODE(${CALLERID(num)})}&caller_name=${URIENCODE(${CALLERID(name)})}&callee=${URIENCODE(${EXTEN})}&dial_num=${URIENCODE(${DIAL_NUM})}&orig_caller=${URIENCODE(${ORIG_CALLER_NUM})}&orig_name=${URIENCODE(${ORIG_CALLER_NAME})})})
same => n,GotoIf($["${CUT(OUT_CFG,|,1)}" = "ALLOW"]?apply_out_cfg:fallback_out_dial)
same => n(apply_out_cfg),Set(__OUT_TRUNK_NAME=${CUT(OUT_CFG,|,2)})
same => n,Set(OUT_LIMIT_EN=${CUT(OUT_CFG,|,3)})
same => n,Set(OUT_MAX_CH=${CUT(OUT_CFG,|,4)})
same => n,Set(OUT_CID_NUM=${CUT(OUT_CFG,|,5)})
same => n,Set(OUT_CID_NAME=${CUT(OUT_CFG,|,6)})
same => n,Set(OUT_DIAL_STR=${CUT(OUT_CFG,|,7)})
same => n,Set(__OUT_HDR_DIVERSION=${CUT(OUT_CFG,|,8)})
same => n,Set(__OUT_HDR_RPID=${CUT(OUT_CFG,|,9)})
same => n,Set(__OUT_HDR_PAI=${CUT(OUT_CFG,|,10)})
same => n,Set(__OUT_HDR_PPI=${CUT(OUT_CFG,|,11)})
same => n,Set(__OUT_MAXPTIME=${CUT(OUT_CFG,|,12)})
same => n,GotoIf($["${OUT_LIMIT_EN}" != "1"]?set_out_cid)
same => n,Set(GROUP(trunk_limit)=${OUT_TRUNK_NAME})
same => n,GotoIf($[${GROUP_COUNT(${OUT_TRUNK_NAME}@trunk_limit)} > ${OUT_MAX_CH}]?out_limit_exceeded)
same => n(set_out_cid),Set(CALLERID(num)=${IF($["${OUT_CID_NUM}" != ""]?${OUT_CID_NUM}:908503607390)})
same => n,Set(CALLERID(name)=${IF($["${OUT_CID_NAME}" != ""]?${OUT_CID_NAME}:${CALLERID(num)})})
same => n,Dial(${OUT_DIAL_STR},60,rb(trunk-outbound-headers^s^1))
same => n,Hangup()
same => n(out_limit_exceeded),NoOp(TRUNK GIDEN CAGRI LIMITI ASILDI: ${OUT_TRUNK_NAME} Max=${OUT_MAX_CH})
same => n,Busy(5)
same => n,Hangup(17)
same => n(fallback_out_dial),Set(CALLERID(num)=908503607390)
same => n,Set(CALLERID(name)=908503607390)
same => n,Dial(PJSIP/Operator_Trunk/sip:${DIAL_NUM}@ikonsip.com:5060,60,r)
same => n,Hangup()

exten => h,1,NoOp(Temsilci aramasi sonlandi. Call ID: ${CALL_UUID}, Status: ${DIALSTATUS}, QueueStatus: ${QUEUESTATUS}, Member: ${MEMBERINTERFACE}, Cause: ${HANGUPCAUSE})
same => n,GotoIf($["${CALL_UUID}" = ""]?done_h)
same => n,Set(CURLOPT(conntimeout)=1)
same => n,Set(CURLOPT(httptimeout)=2)
same => n,Set(CURL_RESULT=${CURL(http://127.0.0.1:8000/api/calls/end?call_id=${CALL_UUID}&dialstatus=${DIALSTATUS}&hangupcause=${HANGUPCAUSE}&queuestatus=${QUEUESTATUS}&memberinterface=${URIENCODE(${MEMBERINTERFACE})})})
same => n(done_h),NoOp(Hangup tamamlandi)

; İç hat (Diğer temsilciler & Dahililer: 100-999999) ve Prefix'li Dış Aramalar (99805..., 905..., 507... vb. >= 7 hane)
exten => _[1-9]X.,1,GotoIf($[${LEN(${EXTEN})} >= 7]?outbound_route_ext)
same => n,NoOp(Dahili arama basladi: Arayan=${CALLERID(num)}, Aranan=${EXTEN})
same => n,Set(CURLOPT(conntimeout)=1)
same => n,Set(CURLOPT(httptimeout)=2)
same => n,Set(MD5_VAL=${MD5(${UNIQUEID}${EPOCH})})
same => n,Set(__CALL_UUID=${MD5_VAL:0:8}-${MD5_VAL:8:4}-4${MD5_VAL:13:3}-a${MD5_VAL:17:3}-${MD5_VAL:20:12})
same => n,Set(CURL_RESULT=${CURL(http://127.0.0.1:8000/api/calls/register?call_id=${CALL_UUID}&did=${EXTEN}&caller=${CALLERID(num)}&asterisk_id=${UNIQUEID})})
same => n,GotoIf($["${CURL_RESULT}" = "BLOCKED"]?deny)
same => n,Set(ACL_RESULT=${CURL(http://127.0.0.1:8000/api/acl/check_subscriber_call?caller=${CALLERID(num)}&callee=${EXTEN})})
same => n,GotoIf($["${ACL_RESULT}" = "DENY"]?deny:allow)
same => n(deny),NoOp(ACL REDDEDILDI: Yetkisiz arama)
same => n,Set(DIALSTATUS=FAILED)
same => n,Answer()
same => n,Playback(/var/spool/asterisk/monitor/tr_yetkisiz_arama)
same => n,Hangup()
same => n(outbound_route_ext),NoOp(Prefixli veya 7+ haneli dis arama yonlendiriliyor: Arayan=${CALLERID(num)}, Aranan=${EXTEN})
same => n,Set(CURLOPT(conntimeout)=1)
same => n,Set(CURLOPT(httptimeout)=2)
same => n,Set(OUT_ACL=${CURL(http://127.0.0.1:8000/api/acl/check_outbound_call?caller=${CALLERID(num)}&callee=${EXTEN}&channel=${URIENCODE(${CHANNEL(name)})}&via=${URIENCODE(${PJSIP_HEADER(read,Via)})})})
same => n,GotoIf($["${OUT_ACL}" = "ALLOW"]?allow_out_ext:deny_out_ext)
same => n(deny_out_ext),NoOp(GUVENLIK ENGELI: Yetkisiz veya sahte dis arama reddedildi -> Arayan=${CALLERID(num)}, Aranan=${EXTEN}, Sebep=${OUT_ACL})
same => n,Playback(/var/spool/asterisk/monitor/tr_yetkisiz_arama)
same => n,Hangup(21)
same => n(allow_out_ext),NoOp(Dis arama onaylandi: Arayan=${CALLERID(num)}, Aranan=${EXTEN})
same => n,Set(MD5_VAL=${MD5(${UNIQUEID}${EPOCH})})
same => n,Set(__CALL_UUID=${MD5_VAL:0:8}-${MD5_VAL:8:4}-4${MD5_VAL:13:3}-a${MD5_VAL:17:3}-${MD5_VAL:20:12})
same => n,Set(CURL_RESULT=${CURL(http://127.0.0.1:8000/api/calls/register?call_id=${CALL_UUID}&did=${EXTEN}&caller=${CALLERID(num)}&asterisk_id=${UNIQUEID})})
same => n,GotoIf($["${CURL_RESULT}" = "BLOCKED"]?deny_out_ext)
same => n,MixMonitor(/var/spool/asterisk/monitor/${CALL_UUID}.wav)
same => n,Set(DIAL_NUM=${IF($["${EXTEN:0:1}"="0"]?90${EXTEN:1}:${EXTEN})})
same => n,Set(OUT_CFG=${CURL(http://127.0.0.1:8000/api/trunks/resolve_outbound_dial?caller=${URIENCODE(${CALLERID(num)})}&caller_name=${URIENCODE(${CALLERID(name)})}&callee=${URIENCODE(${EXTEN})}&dial_num=${URIENCODE(${DIAL_NUM})}&orig_caller=${URIENCODE(${ORIG_CALLER_NUM})}&orig_name=${URIENCODE(${ORIG_CALLER_NAME})})})
same => n,GotoIf($["${CUT(OUT_CFG,|,1)}" = "ALLOW"]?apply_out_cfg_ext:fallback_out_dial_ext)
same => n(apply_out_cfg_ext),Set(__OUT_TRUNK_NAME=${CUT(OUT_CFG,|,2)})
same => n,Set(OUT_LIMIT_EN=${CUT(OUT_CFG,|,3)})
same => n,Set(OUT_MAX_CH=${CUT(OUT_CFG,|,4)})
same => n,Set(OUT_CID_NUM=${CUT(OUT_CFG,|,5)})
same => n,Set(OUT_CID_NAME=${CUT(OUT_CFG,|,6)})
same => n,Set(OUT_DIAL_STR=${CUT(OUT_CFG,|,7)})
same => n,Set(__OUT_HDR_DIVERSION=${CUT(OUT_CFG,|,8)})
same => n,Set(__OUT_HDR_RPID=${CUT(OUT_CFG,|,9)})
same => n,Set(__OUT_HDR_PAI=${CUT(OUT_CFG,|,10)})
same => n,Set(__OUT_HDR_PPI=${CUT(OUT_CFG,|,11)})
same => n,Set(__OUT_MAXPTIME=${CUT(OUT_CFG,|,12)})
same => n,GotoIf($["${OUT_LIMIT_EN}" != "1"]?set_out_cid_ext)
same => n,Set(GROUP(trunk_limit)=${OUT_TRUNK_NAME})
same => n,GotoIf($[${GROUP_COUNT(${OUT_TRUNK_NAME}@trunk_limit)} > ${OUT_MAX_CH}]?out_limit_exceeded_ext)
same => n(set_out_cid_ext),Set(CALLERID(num)=${IF($["${OUT_CID_NUM}" != ""]?${OUT_CID_NUM}:908503607390)})
same => n,Set(CALLERID(name)=${IF($["${OUT_CID_NAME}" != ""]?${OUT_CID_NAME}:${CALLERID(num)})})
same => n,Dial(${OUT_DIAL_STR},60,rb(trunk-outbound-headers^s^1))
same => n,Hangup()
same => n(out_limit_exceeded_ext),NoOp(TRUNK GIDEN CAGRI LIMITI ASILDI: ${OUT_TRUNK_NAME} Max=${OUT_MAX_CH})
same => n,Busy(5)
same => n,Hangup(17)
same => n(fallback_out_dial_ext),Set(CALLERID(num)=908503607390)
same => n,Set(CALLERID(name)=908503607390)
same => n,Dial(PJSIP/Operator_Trunk/sip:${DIAL_NUM}@ikonsip.com:5060,60,r)
same => n,Hangup()
same => n(allow),NoOp(ACL ONAYLANDI: On Yonlendirme Kontrol Ediliyor)
same => n,MixMonitor(/var/spool/asterisk/monitor/${CALL_UUID}.wav)

; 1. Ön Yönlendirme ve Aktif Profil Kontrolü (Offline / Koşulsuz Yönlendirme / Cihaz Seçimi)
same => n,Set(FWD_PRE=${CURL(http://127.0.0.1:8000/api/subscriber/resolve_forwarding?extension=${EXTEN}&dialstatus=BEFORE_DIAL)})
same => n,Set(FWD_STATUS=${CUT(FWD_PRE,:,1)})
same => n,Set(FWD_TARGET=${CUT(FWD_PRE,:,2)})
same => n,Set(FWD_TIMEOUT=${CUT(FWD_PRE,:,3)})
same => n,Set(DIAL_TIMEOUT=${IF($[${ISNULL(${FWD_TIMEOUT})} | "${FWD_TIMEOUT}"=""]?30:${FWD_TIMEOUT})})
same => n,GotoIf($["${FWD_STATUS}"="ALLOW"]?forward_call:dial_pjsip)

; 2. PJSIP Dahili Arama (Profil veya Yönlendirme Zaman Aşımı Süresi)
same => n(dial_pjsip),Set(TARGET_CONTACTS=${PJSIP_DIAL_CONTACTS(${EXTEN})})
same => n,Set(DIAL_STR=${IF($["${TARGET_CONTACTS}"=""]?PJSIP/${EXTEN}:${TARGET_CONTACTS})})
same => n,NoOp(PJSIP Dahiliye Arama Yapiliyor: ${DIAL_STR} Timeout=${DIAL_TIMEOUT}s)
same => n,Dial(${DIAL_STR},${DIAL_TIMEOUT},tTg)
same => n,NoOp(PJSIP Arama Sonucu: ${DIALSTATUS})
same => n,GotoIf($["${DIALSTATUS}"="ANSWER"]?end_call)

; 3. Sonrası Yönlendirme / Beni Takip Et (1. Adım) ve Profil Zaman Aşımı Kontrolü
same => n,Set(ORIG_EXTEN=${EXTEN})
same => n,Set(FWD_STEP=1)
same => n,Set(FWD_POST=${CURL(http://127.0.0.1:8000/api/subscriber/resolve_forwarding?extension=${ORIG_EXTEN}&dialstatus=${DIALSTATUS}&step=1)})
same => n,Set(FWD_STATUS=${CUT(FWD_POST,:,1)})
same => n,Set(FWD_TARGET=${CUT(FWD_POST,:,2)})
same => n,Set(FWD_TIMEOUT=${CUT(FWD_POST,:,3)})
same => n,Set(STEP_TIMEOUT=${IF($[${ISNULL(${FWD_TIMEOUT})} | "${FWD_TIMEOUT}"=""]?25:${FWD_TIMEOUT})})
same => n,GotoIf($["${FWD_STATUS}"="ALLOW"]?forward_call:end_call)

; 4. Yönlendirme ve Beni Takip Et Uygulama Bağlamı
same => n(forward_call),NoOp(Yonlendirme Aktif [Adim=${FWD_STEP}]! Hedef: ${FWD_TARGET} Timeout: ${STEP_TIMEOUT}s)
same => n,GotoIf($["${FWD_TARGET}"="HANGUP" | "${FWD_TARGET}"="NONE"]?end_call)
same => n,GotoIf($["${FWD_TARGET}"="VOICEMAIL"]?voicemail_fwd)
same => n,GotoIf($["${FWD_TARGET:0:6}"="QUEUE_"]?queue_fwd)
same => n,Set(CALLERID(num)=908503607390)
same => n,Set(CALLERID(name)=908503607390)
same => n,Set(RAW_NUM=${IF($["${FWD_TARGET:0:1}"="0"]?90${FWD_TARGET:1}:${FWD_TARGET})})
same => n,Set(CLEAN_TARGET=${IF($["${RAW_NUM:0:2}"="90"]?${RAW_NUM}:90${RAW_NUM})})
same => n,GotoIf($[${LEN(${FWD_TARGET})} < 6]?dial_internal_fwd:dial_external_fwd)

same => n(queue_fwd),NoOp(Kuyruk Aktarimi Baslatiliyor: ${FWD_TARGET:6})
same => n,Queue(${FWD_TARGET:6},tTc)
same => n,Set(DIALSTATUS=${IF($["${MEMBERINTERFACE}" != ""]?ANSWER:NOANSWER)})
same => n,Goto(end_call)

same => n(voicemail_fwd),NoOp(Sesli Mesaj / Voicemail Aktarimi: ${EXTEN})
same => n,Answer()
same => n,Playback(/var/spool/asterisk/monitor/tr_sesli_mesaj)
same => n,Hangup()

same => n(dial_internal_fwd),NoOp(Ic Dahili / Mobil Uygulama Yonlendirme: PJSIP/${FWD_TARGET} Timeout=${STEP_TIMEOUT}s)
same => n,Dial(PJSIP/${FWD_TARGET},${STEP_TIMEOUT},tTg)
same => n,GotoIf($["${DIALSTATUS}"="ANSWER"]?end_call:check_step2)

same => n(dial_external_fwd),NoOp(Dis Hat / Mobil Telefon Yonlendirme: PJSIP/Operator_Trunk/sip:${CLEAN_TARGET}@ikonsip.com:5060 Timeout=${STEP_TIMEOUT}s)
same => n,Dial(PJSIP/Operator_Trunk/sip:${CLEAN_TARGET}@ikonsip.com:5060,${STEP_TIMEOUT},r)
same => n,GotoIf($["${DIALSTATUS}"="ANSWER"]?end_call:check_step2)

; 5. Beni Takip Et (2. Adım) Kontrolü
same => n(check_step2),GotoIf($["${FWD_STEP}"="1"]?resolve_step2:end_call)
same => n(resolve_step2),Set(FWD_STEP=2)
same => n,Set(FWD_POST2=${CURL(http://127.0.0.1:8000/api/subscriber/resolve_forwarding?extension=${ORIG_EXTEN}&dialstatus=${DIALSTATUS}&step=2)})
same => n,Set(FWD_STATUS=${CUT(FWD_POST2,:,1)})
same => n,Set(FWD_TARGET=${CUT(FWD_POST2,:,2)})
same => n,Set(FWD_TIMEOUT=${CUT(FWD_POST2,:,3)})
same => n,Set(STEP_TIMEOUT=${IF($[${ISNULL(${FWD_TIMEOUT})} | "${FWD_TIMEOUT}"=""]?30:${FWD_TIMEOUT})})
same => n,GotoIf($["${FWD_STATUS}"="ALLOW"]?forward_call:end_call)

same => n(end_call),NoOp(Cagri tamamlandi veya yanitlanmadi: Status=${DIALSTATUS})
same => n,GotoIf($["${DIALSTATUS}"="ANSWER"]?check_post_call_survey)
same => n,GotoIf($["${DIALSTATUS}"="CANCEL"]?final_hangup)
same => n,Answer()
same => n,GotoIf($["${DIALSTATUS}"="BUSY"]?play_busy:play_unavail)
same => n(play_busy),Playback(/var/spool/asterisk/monitor/tr_abone_mesgul)
same => n,Goto(final_hangup)
same => n(play_unavail),Playback(/var/spool/asterisk/monitor/tr_abone_ulasilamiyor)
same => n,Goto(final_hangup)
same => n(check_post_call_survey),Set(SURVEY_CFG=${CURL(http://127.0.0.1:8000/api/queues/survey/config?queue_ext=${EXTEN}&agent_ext=${EXTEN}&call_id=${CALL_UUID})})
same => n,GotoIf($["${CUT(SURVEY_CFG,:,1)}" != "ENABLED"]?final_hangup)
same => n,Set(SURVEY_Q_EXT=${CUT(SURVEY_CFG,:,2)})
same => n,Set(SURVEY_MAX_DIGITS=${CUT(SURVEY_CFG,:,3)})
same => n,Set(SURVEY_TIMEOUT=${CUT(SURVEY_CFG,:,4)})
same => n,Set(SURVEY_Q_WAVS=${CUT(SURVEY_CFG,:,5)})
same => n,Set(SURVEY_TY_WAV=${CUT(SURVEY_CFG,:,6)})
same => n,Set(SURVEY_Q_CNT=${CUT(SURVEY_CFG,:,7)})
same => n,Set(SURVEY_Q_CNT=${IF($["${SURVEY_Q_CNT}" = ""]?1:${SURVEY_Q_CNT})})
same => n,Set(SURVEY_Q_IDX=1)
same => n,Set(SURVEY_ALL_SCORES=)
same => n,Set(SURVEY_ANY_ANS=0)
same => n(survey_w_loop),GotoIf($[${SURVEY_Q_IDX} > ${SURVEY_Q_CNT}]?survey_w_done)
same => n,Set(CUR_Q_WAV=${CUT(SURVEY_Q_WAVS,&,${SURVEY_Q_IDX})})
same => n,Set(CUR_Q_WAV=${IF($["${CUR_Q_WAV}" = ""]?tr_anket_soru:${CUR_Q_WAV})})
same => n,Set(SURVEY_SCORE=)
same => n,Read(SURVEY_SCORE,/var/spool/asterisk/monitor/${CUR_Q_WAV},${SURVEY_MAX_DIGITS},,,${SURVEY_TIMEOUT})
same => n,Set(SURVEY_ANY_ANS=${IF($["${SURVEY_SCORE}" != ""]?1:${SURVEY_ANY_ANS})})
same => n,Set(SURVEY_ALL_SCORES=${IF($[${SURVEY_Q_IDX} = 1]?${SURVEY_SCORE}:${SURVEY_ALL_SCORES},${SURVEY_SCORE})})
same => n,Set(SURVEY_Q_IDX=$[${SURVEY_Q_IDX} + 1])
same => n,Goto(survey_w_loop)
same => n(survey_w_done),Set(SURVEY_RES=${CURL(http://127.0.0.1:8000/api/queues/survey/submit?call_id=${CALL_UUID}&queue_ext=${SURVEY_Q_EXT}&agent_ext=${EXTEN}&caller=${CALLERID(num)}&score=${URIENCODE(${SURVEY_ALL_SCORES})})})
same => n,GotoIf($["${SURVEY_ANY_ANS}" != "1"]?final_hangup)
same => n,Playback(/var/spool/asterisk/monitor/${SURVEY_TY_WAV})
same => n(final_hangup),Hangup()

[mobile_transfer_context]
exten => s,1,NoOp(Mobil aktarim arandi ve cevaplandi. Arayan=${CALLERID(num)})
same => n,Progress()
same => n,Answer()
same => n,Playback(/var/spool/asterisk/monitor/summary_${CALL_UUID})
same => n,Bridge(${CUSTOMER_CHANNEL})
same => n,Hangup()
"""

    # Copy Turkish announcement WAV files to /var/spool/asterisk/monitor/
    try:
        sounds_tr_dir = os.path.join(PROJECT_ROOT, "asterisk_config", "sounds_tr")
        uploads_ann_dir = os.path.join(PROJECT_ROOT, "uploads", "announcements")
        monitor_dir = "/var/spool/asterisk/monitor"
        if os.path.exists("/var/spool/asterisk") or os.path.exists("/etc/asterisk"):
            os.makedirs(monitor_dir, exist_ok=True)
            for src_dir in [sounds_tr_dir, uploads_ann_dir]:
                if os.path.isdir(src_dir):
                    for fname in os.listdir(src_dir):
                        if fname.endswith(".wav"):
                            src_wav = os.path.join(src_dir, fname)
                            dst_wav = os.path.join(monitor_dir, fname)
                            shutil.copy2(src_wav, dst_wav)
                            os.chmod(dst_wav, 0o644)
            print(f"[Sync Script] Türkçe anons ses dosyaları kopyalandı -> {monitor_dir}")
    except Exception as e_snd:
        print(f"[Sync Script] Türkçe ses kopyalama uyarısı: {e_snd}")

    for path in ["/etc/asterisk/extensions_custom.conf", os.path.join(PROJECT_ROOT, "asterisk_config", "extensions_custom.conf")]:
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(ext_content)
            print(f"[Sync Script] extensions_custom.conf başarıyla yazıldı -> {path}")
        except Exception as e:
            print(f"[Sync Script] Hata ({path}): {e}")

    try:
        main_ext_path = "/etc/asterisk/extensions.conf"
        if os.path.exists("/etc/asterisk"):
            with open(main_ext_path, "w", encoding="utf-8") as f:
                f.write("[general]\nstatic=yes\nwriteprotect=no\nclearglobalvars=no\n\n#include /etc/asterisk/extensions_custom.conf\n")
            print(f"[Sync Script] Ana extensions.conf #include yapilandirmasi guncellendi -> {main_ext_path}")
    except Exception as e:
        print(f"[Sync Script] Ana extensions.conf yazma hatasi: {e}")

    try:
        subprocess.run(["asterisk", "-rx", "dialplan reload"], check=True)
        print("[Sync Script] Asterisk Dialplan başarıyla yenilendi (reload).")
    except Exception as e:
        print(f"[Sync Script] Asterisk reload hatası: {e}")

if __name__ == "__main__":
    sync()
