#!/usr/bin/env bash
# ==============================================================================
# Nornia Connect Hub — SIP/RTP Edge v2 Installer (WireGuard + Kamailio + RTPEngine)
# ==============================================================================
# Bu betik Nornia Merkez Sunucusunda (panel.nornia.com.tr / connect.nornia.com.tr)
# uzak fiziksel SIP masa telefonlarının (5060 UDP/TCP, 5061 TLS + RTP 20000-40000)
# santral tarafında HİÇBİR PORT AÇMADAN güvenli biçimde register olup çift yönlü
# sesli görüşme yapabilmesi için gerekli 3 servisi kurar ve sertleştirir:
#   1. WireGuard (wg0 — 10.200.0.1/16, UDP 51820, İstemci İzolasyonu)
#   2. Kamailio SIP Edge Proxy (5060 UDP/TCP, 5061 TLS, Zero-IP Drop + Pike + Fail2Ban)
#   3. RTPEngine Medya Köprüsü (ext/<PUBLIC_IP> <-> int/10.200.0.1, UDP 20000-40000)
#
# Kullanım:
#   sudo bash scripts/install_nornia_sip_edge_hub.sh
#   veya sabit genel IP belirterek:
#   sudo HUB_PUBLIC_IP=213.74.216.246 bash scripts/install_nornia_sip_edge_hub.sh
# ==============================================================================

set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "[HATA] Bu kurulum betiği root (sudo) yetkisiyle çalıştırılmalıdır."
  exit 1
fi

WG_IFACE="wg0"
WG_HUB_IP="10.200.0.1"
WG_PORT="51820"
RTP_PORT_MIN="20000"
RTP_PORT_MAX="40000"
SIP_BASE_DOMAIN="${NORNIA_SIP_BASE_DOMAIN:-nornia.com.tr}"

echo "=============================================================================="
echo "  NORNIA SIP/RTP EDGE v2 — MERKEZ HUB KURULUMU BAŞLIYOR"
echo "=============================================================================="

# 1. Hub Yerel Bind IP'si ve Gerçek Dış (Public) IPv4 Adresini Otomatik Tespit Et
if [[ -z "${HUB_BIND_IP:-}" ]]; then
  HUB_BIND_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if ($i=="src") print $(i+1)}' | head -n1 || true)"
fi
if [[ -z "${HUB_PUBLIC_IP:-}" ]]; then
  HUB_PUBLIC_IP="$(curl -4 -fsS --max-time 4 https://api.ipify.org 2>/dev/null || curl -4 -fsS --max-time 4 https://ifconfig.me/ip 2>/dev/null || true)"
fi
if [[ -z "${HUB_PUBLIC_IP:-}" ]]; then
  HUB_PUBLIC_IP="${HUB_BIND_IP}"
fi
if [[ -z "${HUB_BIND_IP:-}" ]]; then
  HUB_BIND_IP="${HUB_PUBLIC_IP}"
fi
if [[ -z "${HUB_BIND_IP:-}" || -z "${HUB_PUBLIC_IP:-}" ]]; then
  echo "[HATA] Hub sunucusunun IPv4 adresi tespit edilemedi."
  echo "       Lütfen 'sudo HUB_BIND_IP=<YEREL_IP> HUB_PUBLIC_IP=<DIS_IP> bash $0' şeklinde çalıştırın."
  exit 1
fi
if [[ "${HUB_BIND_IP}" != "${HUB_PUBLIC_IP}" ]]; then
  echo "[1/7] Hub 1:1 NAT Algılandı -> Yerel Bind: ${HUB_BIND_IP} | Dış (Advertise) IP: ${HUB_PUBLIC_IP}"
  RTP_EXT_SPEC="ext/${HUB_BIND_IP}!${HUB_PUBLIC_IP}"
  KAM_ADV_5060=" advertise ${HUB_PUBLIC_IP}:5060"
  KAM_ADV_5061=" advertise ${HUB_PUBLIC_IP}:5061"
  KAM_ADV_5160=" advertise ${HUB_PUBLIC_IP}:5160"
else
  echo "[1/7] Hub Genel IPv4 Adresi: ${HUB_PUBLIC_IP}"
  RTP_EXT_SPEC="ext/${HUB_PUBLIC_IP}"
  KAM_ADV_5060=""
  KAM_ADV_5061=""
  KAM_ADV_5160=""
fi

# 2. Paketleri Kur (WireGuard, Kamailio, RTPEngine, Fail2Ban)
echo "[2/7] Sistem paketleri kuruluyor (wireguard, kamailio, rtpengine, fail2ban)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq wireguard wireguard-tools iptables iproute2 fail2ban curl \
  kamailio kamailio-extra-modules kamailio-tls-modules kamailio-utils-modules

# RTPEngine paket adı Ubuntu sürümüne göre değişebilir
RTP_PKG_INSTALLED=0
for pkg in rtpengine rtpengine-daemon ngcp-rtpengine-daemon; do
  if apt-cache show "$pkg" >/dev/null 2>&1; then
    if apt-get install -y -qq "$pkg"; then
      RTP_PKG_INSTALLED=1
      break
    fi
  fi
done
if [[ "$RTP_PKG_INSTALLED" -ne 1 ]]; then
  echo "[UYARI] Standart APT deposunda rtpengine paketi bulunamadı; manuel kurulum gerekebilir."
fi

# 3. WireGuard Hub (wg0) Kurulumu ve Sıkı İstemci İzolasyonu
echo "[3/7] WireGuard Hub (${WG_IFACE} — ${WG_HUB_IP}/16, Port ${WG_PORT}) yapılandırılıyor..."
mkdir -p /etc/wireguard
chmod 700 /etc/wireguard

if [[ ! -f /etc/wireguard/wg0.key ]]; then
  wg genkey | tee /etc/wireguard/wg0.key >/dev/null
  chmod 600 /etc/wireguard/wg0.key
fi
wg pubkey < /etc/wireguard/wg0.key > /etc/wireguard/wg0_public.key
chmod 644 /etc/wireguard/wg0_public.key
HUB_PRIV_KEY="$(cat /etc/wireguard/wg0.key)"
HUB_PUB_KEY="$(cat /etc/wireguard/wg0_public.key)"

if [[ ! -f /etc/wireguard/wg0.conf ]]; then
  cat > /etc/wireguard/wg0.conf <<EOF
# Auto-managed by Nornia Connect Hub (SIP/RTP Edge v2)
[Interface]
Address = ${WG_HUB_IP}/16
ListenPort = ${WG_PORT}
PrivateKey = ${HUB_PRIV_KEY}
# Strict Client-to-Client Isolation: PBX peers can ONLY reach Hub (10.200.0.1)
PostUp = iptables -C FORWARD -i ${WG_IFACE} -o ${WG_IFACE} -j DROP 2>/dev/null || iptables -I FORWARD -i ${WG_IFACE} -o ${WG_IFACE} -j DROP
PostDown = iptables -D FORWARD -i ${WG_IFACE} -o ${WG_IFACE} -j DROP 2>/dev/null || true
EOF
  chmod 600 /etc/wireguard/wg0.conf
fi

# Kernel IP forwarding gerekmiyor çünkü trafik Kamailio/RTPEngine üzerinden sonlandırılıyor
# (ve wg0->wg0 FORWARD zaten DROP ediliyor)
systemctl enable "wg-quick@${WG_IFACE}" >/dev/null 2>&1 || true
if wg show "${WG_IFACE}" >/dev/null 2>&1; then
  echo "      WireGuard ${WG_IFACE} zaten aktif."
else
  systemctl restart "wg-quick@${WG_IFACE}"
fi

# 4. RTPEngine Dual-Interface Yapılandırması (ext/<BIND>[!<PUB>] <-> int/10.200.0.1)
echo "[4/7] RTPEngine medya rölesi (${RTP_EXT_SPEC} <-> int/${WG_HUB_IP}, UDP ${RTP_PORT_MIN}-${RTP_PORT_MAX}) yapılandırılıyor..."
mkdir -p /etc/rtpengine
cat > /etc/rtpengine/rtpengine.conf <<EOF
[rtpengine]
interface = ${RTP_EXT_SPEC};int/${WG_HUB_IP}
foreground = false
log-stderr = false
listen-ng = 127.0.0.1:22222
port-min = ${RTP_PORT_MIN}
port-max = ${RTP_PORT_MAX}
timeout = 60
silent-timeout = 3600
tos = 184
log-level = 6
delete-delay = 0
table = -1
EOF

# Ubuntu 22.04/24.04 default env dosyası uyumluluğu
if [[ -f /etc/default/ngcp-rtpengine-daemon ]]; then
  sed -i 's/^RUN_RTPENGINE=.*/RUN_RTPENGINE=yes/' /etc/default/ngcp-rtpengine-daemon || true
  if ! grep -q '^CONFIG_FILE=' /etc/default/ngcp-rtpengine-daemon; then
    echo 'CONFIG_FILE=/etc/rtpengine/rtpengine.conf' >> /etc/default/ngcp-rtpengine-daemon
  else
    sed -i 's|^CONFIG_FILE=.*|CONFIG_FILE=/etc/rtpengine/rtpengine.conf|' /etc/default/ngcp-rtpengine-daemon
  fi
fi
if [[ -f /etc/default/rtpengine-daemon ]]; then
  sed -i 's/^RUN_RTPENGINE=.*/RUN_RTPENGINE=yes/' /etc/default/rtpengine-daemon || true
fi

RTP_SVC=""
for svc in rtpengine ngcp-rtpengine-daemon rtpengine-daemon; do
  if systemctl list-unit-files | grep -q "^${svc}\.service"; then
    RTP_SVC="$svc"
    break
  fi
done
if [[ -n "$RTP_SVC" ]]; then
  systemctl enable "$RTP_SVC" >/dev/null 2>&1 || true
  systemctl restart "$RTP_SVC"
  echo "      RTPEngine servisi (${RTP_SVC}) başlatıldı."
else
  echo "[UYARI] RTPEngine systemd servisi bulunamadı."
fi

# 5. Kamailio TLS Sertifikası (Varsa Let's Encrypt'ten otomatik kopyala) & Route Yükleyici
echo "[5/7] Kamailio SIP Edge Proxy (5060 UDP/TCP + 5061 TLS + 5 Güvenlik Kalkanı) yapılandırılıyor..."
mkdir -p /etc/kamailio/certs /var/log
touch /var/log/kamailio-security.log
chown kamailio:kamailio /var/log/kamailio-security.log 2>/dev/null || true

if [[ ! -f /etc/kamailio/nornia_routes.map ]]; then
  echo "# Auto-managed by Nornia Connect Hub: domain => pbx_wg_ip:5060" > /etc/kamailio/nornia_routes.map
fi

TLS_ENABLE_LINE=""
TLS_LISTEN_LINE=""
TLS_MOD_BLOCK=""
LE_CERT_DIR=""
for cand in "/etc/letsencrypt/live/${SIP_BASE_DOMAIN}" "/etc/letsencrypt/live/connect.${SIP_BASE_DOMAIN}" "/etc/letsencrypt/live/panel.${SIP_BASE_DOMAIN}"; do
  if [[ -f "${cand}/fullchain.pem" && -f "${cand}/privkey.pem" ]]; then
    LE_CERT_DIR="$cand"
    break
  fi
done
if [[ -z "$LE_CERT_DIR" && -d /etc/letsencrypt/live ]]; then
  FIRST_CERT="$(find /etc/letsencrypt/live -maxdepth 2 -name fullchain.pem 2>/dev/null | head -n1 || true)"
  if [[ -n "$FIRST_CERT" ]]; then
    LE_CERT_DIR="$(dirname "$FIRST_CERT")"
  fi
fi

if [[ -n "$LE_CERT_DIR" ]]; then
  cp -L "${LE_CERT_DIR}/fullchain.pem" /etc/kamailio/certs/fullchain.pem
  cp -L "${LE_CERT_DIR}/privkey.pem" /etc/kamailio/certs/privkey.pem
  chown -R kamailio:kamailio /etc/kamailio/certs 2>/dev/null || true
  chmod 640 /etc/kamailio/certs/privkey.pem
  chmod 644 /etc/kamailio/certs/fullchain.pem

  cat > /etc/kamailio/tls.cfg <<'EOF'
[server:default]
method = TLSv1.2+
verify_certificate = no
require_certificate = no
private_key = /etc/kamailio/certs/privkey.pem
certificate = /etc/kamailio/certs/fullchain.pem

[client:default]
verify_certificate = no
require_certificate = no
EOF

  mkdir -p /etc/letsencrypt/renewal-hooks/deploy
  cat > /etc/letsencrypt/renewal-hooks/deploy/nornia-kamailio-tls.sh <<EOF
#!/usr/bin/env bash
cp -L "${LE_CERT_DIR}/fullchain.pem" /etc/kamailio/certs/fullchain.pem
cp -L "${LE_CERT_DIR}/privkey.pem" /etc/kamailio/certs/privkey.pem
chown -R kamailio:kamailio /etc/kamailio/certs 2>/dev/null || true
chmod 640 /etc/kamailio/certs/privkey.pem
chmod 644 /etc/kamailio/certs/fullchain.pem
systemctl reload kamailio 2>/dev/null || systemctl restart kamailio 2>/dev/null || true
EOF
  chmod +x /etc/letsencrypt/renewal-hooks/deploy/nornia-kamailio-tls.sh

  TLS_ENABLE_LINE="enable_tls=yes"
  TLS_LISTEN_LINE="listen=tls:${HUB_BIND_IP}:5061${KAM_ADV_5061}"
  TLS_FROM_PBX_BRANCH="        } else if (\$du != \$null && \$du =~ \"transport=(tls|TLS)\") {
            \$fs = \"tls:${HUB_BIND_IP}:5061\";"
  TLS_MOD_BLOCK='loadmodule "tls.so"
modparam("tls", "config", "/etc/kamailio/tls.cfg")'
  echo "      Let's Encrypt TLS sertifikası bulundu (${LE_CERT_DIR}) -> SIP TLS 5061 aktif."
else
  TLS_FROM_PBX_BRANCH=""
  echo "      Let's Encrypt sertifikası bulunamadı -> Yalnızca 5060 UDP/TCP aktif."
fi

# Kamailio route map hydration helper (Kamailio açılışında otomatik çalışır)
cat > /usr/local/bin/nornia-load-kamailio-routes.sh <<'EOF'
#!/usr/bin/env bash
MAP_FILE="/etc/kamailio/nornia_routes.map"
if [[ ! -f "$MAP_FILE" ]] || ! command -v kamcmd >/dev/null 2>&1; then
  exit 0
fi
# Kamailio ctl soketinin hazır olmasını en fazla 5 sn bekle
for _ in 1 2 3 4 5; do
  if kamcmd core.version >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
kamcmd htable.flush nornia_routes >/dev/null 2>&1 || true
while read -r domain target _rest; do
  [[ -z "$domain" || "$domain" == \#* || -z "$target" ]] && continue
  kamcmd htable.sets nornia_routes "$domain" "sip:${target}" >/dev/null 2>&1 || true
done < "$MAP_FILE"
exit 0
EOF
chmod +x /usr/local/bin/nornia-load-kamailio-routes.sh

# Mevcut kamailio.cfg yedeğini al
if [[ -f /etc/kamailio/kamailio.cfg && ! -f /etc/kamailio/kamailio.cfg.orig ]]; then
  cp /etc/kamailio/kamailio.cfg /etc/kamailio/kamailio.cfg.orig
fi

cat > /etc/kamailio/kamailio.cfg <<EOF
#!KAMAILIO
# ==============================================================================
# Nornia SIP/RTP Edge v2 — Hardened Multi-Tenant SIP Proxy
# ==============================================================================
# Shields:
#   1. Zero-IP Drop (Only registered customer subdomains in nornia_routes htable)
#   2. Scanner User-Agent Drop (friendly-scanner, sipvicious, sipcli, etc.)
#   3. Pike Flood Detection + ipban Auto-Ban + Fail2Ban integration
#   4. Path + Double Record-Route + NAT Helper for remote deskphones
#   5. Dual-interface RTPEngine bridging (ext/${HUB_PUBLIC_IP} <-> int/${WG_HUB_IP})
# ==============================================================================

debug=2
log_stderror=no
log_facility=LOG_LOCAL0
children=4
auto_aliases=no
alias="${HUB_PUBLIC_IP}"
alias="${HUB_BIND_IP}"
alias="${WG_HUB_IP}"
mhomed=1
server_signature=no
server_header="Server: Nornia-Edge"
user_agent_header="User-Agent: Nornia-Edge"

${TLS_ENABLE_LINE}

listen=udp:${HUB_BIND_IP}:5060${KAM_ADV_5060}
listen=tcp:${HUB_BIND_IP}:5060${KAM_ADV_5060}
listen=tcp:${HUB_BIND_IP}:5160${KAM_ADV_5160}
listen=udp:${HUB_BIND_IP}:5160${KAM_ADV_5160}
${TLS_LISTEN_LINE}
listen=udp:${WG_HUB_IP}:5060
listen=tcp:${WG_HUB_IP}:5060
listen=tcp:${WG_HUB_IP}:5160
listen=udp:${WG_HUB_IP}:5160

tcp_connection_lifetime=3605
tcp_max_connections=4096
tcp_reuse_port=yes

####### Modules ########
loadmodule "kex.so"
loadmodule "corex.so"
loadmodule "tm.so"
loadmodule "tmx.so"
loadmodule "sl.so"
loadmodule "rr.so"
loadmodule "pv.so"
loadmodule "maxfwd.so"
loadmodule "textops.so"
loadmodule "siputils.so"
loadmodule "xlog.so"
loadmodule "sanity.so"
loadmodule "ctl.so"
loadmodule "jsonrpcs.so"
loadmodule "htable.so"
loadmodule "pike.so"
loadmodule "nathelper.so"
loadmodule "path.so"
loadmodule "rtpengine.so"
${TLS_MOD_BLOCK}

####### Module Parameters ########
modparam("tm", "failure_reply_mode", 3)
modparam("tm", "fr_timer", 30000)
modparam("tm", "fr_inv_timer", 120000)
modparam("tm", "reparse_on_dns_failover", 0)

modparam("rr", "enable_full_lr", 1)
modparam("rr", "enable_double_rr", 1)
modparam("rr", "append_fromtag", 1)

modparam("nathelper", "received_avp", "\$avp(RECEIVED)")
modparam("path", "use_received", 1)

modparam("htable", "htable", "nornia_routes=>size=10;autoexpire=0;")
modparam("htable", "htable", "ipban=>size=10;autoexpire=1800;")

modparam("pike", "sampling_time_unit", 2)
modparam("pike", "reqs_density_per_unit", 40)
modparam("pike", "remove_latency", 4)

modparam("rtpengine", "rtpengine_sock", "udp:127.0.0.1:22222")

####### Main Request Routing ########
request_route {
    # 1. Sanity & Max-Forwards Check
    if (!mf_process_maxfwd_header("10")) {
        sl_send_reply("483", "Too Many Hops");
        exit;
    }
    if (!sanity_check("17895", "7")) {
        exit;
    }

    # 2. Traffic Coming FROM Internal WireGuard PBX (10.200.x.y) -> External Deskphone
    if (\$si =~ "^10\\.200\\.") {
        route(FROM_PBX);
        exit;
    }

    # 3. External Traffic Security Shields
    # 3a. Already banned IP check
    if (\$sht(ipban=>\$si) != \$null) {
        exit;
    }

    # 3b. Known SIP Scanner User-Agent Drop (Silent — POSIX ERE, case-insensitive in Kamailio core)
    if (\$ua =~ "(friendly-scanner|sipvicious|sipcli|sipsak|sundayddr|vaxsipuseragent|iwar|sip-scan|pplsip)") {
        xlog("L_WARN", "NORNIA_SEC_DROP scanner src=\$si ua=\$ua rd=\$rd\n");
        \$sht(ipban=>\$si) = 1;
        exit;
    }

    # 3c. Pike Flood Protection
    if (!pike_check_req()) {
        xlog("L_ALERT", "NORNIA_SEC_FLOOD pike_ban src=\$si method=\$rm rd=\$rd\n");
        \$sht(ipban=>\$si) = 1;
        exit;
    }

    # 3d. CANCEL handling
    if (is_method("CANCEL")) {
        if (t_check_trans()) {
            rtpengine_delete();
            t_relay();
        }
        exit;
    }

    # 3e. In-dialog requests (ACK, BYE, re-INVITE, UPDATE)
    if (has_totag()) {
        if (loose_route()) {
            force_rport();
            if (nat_uac_test("19")) {
                fix_nated_contact();
            }
            if (is_method("BYE")) {
                rtpengine_delete();
            } else if (has_body("application/sdp")) {
                rtpengine_manage("SIP-source-address replace-origin replace-session-connection ICE=remove RTP/AVP direction=ext direction=int");
            }
            t_on_reply("REPLY_FROM_PBX");
            t_relay();
            exit;
        }
        if (is_method("ACK")) {
            if (t_check_trans()) {
                t_relay();
                exit;
            }
            exit;
        }
        sl_send_reply("404", "Not Here");
        exit;
    }

    # 3f. Retransmission check
    if (!is_method("ACK")) {
        if (t_precheck_trans()) {
            t_check_trans();
            exit;
        }
        t_check_trans();
    }

    # 3g. ZERO-IP DROP SHIELD: Only registered customer subdomains in nornia_routes are accepted!
    \$var(target_pbx) = \$sht(nornia_routes=>\$rd);
    if (\$var(target_pbx) == \$null) {
        # Silent drop — scanners hitting raw IP or invalid domain receive ZERO reply
        xlog("L_WARN", "NORNIA_SEC_DROP unknown_domain src=\$si method=\$rm rd=\$rd\n");
        exit;
    }

    # Port 5160 = Legacy chan_sip / Cisco UseCallManager BLF bridge (preserves TCP to PBX:5160)
    if (\$Rp == 5160) {
        \$var(target_pbx) = \$(var(target_pbx){s.replace,:5060,:5160});
        if (\$proto == "tcp") {
            \$var(target_pbx) = \$var(target_pbx) + ";transport=tcp";
        }
    }

    # 4. Forward Valid External Request to Customer PBX over WireGuard
    force_rport();
    remove_hf("X-Real-IP");
    append_hf("X-Real-IP: \$si\r\n");

    if (is_method("REGISTER")) {
        if (!(\$hdr(Supported) =~ "path")) {
            append_hf("Supported: path\r\n");
        }
        \$du = \$var(target_pbx);
        if (\$Rp == 5160) {
            if (\$proto == "tcp") {
                \$fs = "tcp:${WG_HUB_IP}:5160";
            } else {
                \$fs = "udp:${WG_HUB_IP}:5160";
            }
        } else {
            \$fs = "udp:${WG_HUB_IP}:5060";
        }
        add_path_received();
        if (!t_relay()) {
            sl_reply_error();
        }
        exit;
    }

    if (nat_uac_test("19")) {
        fix_nated_contact();
    }
    \$du = \$var(target_pbx);
    if (\$Rp == 5160) {
        if (\$proto == "tcp") {
            \$fs = "tcp:${WG_HUB_IP}:5160";
        } else {
            \$fs = "udp:${WG_HUB_IP}:5160";
        }
    } else {
        \$fs = "udp:${WG_HUB_IP}:5060";
    }
    record_route();

    if (has_body("application/sdp")) {
        rtpengine_manage("SIP-source-address replace-origin replace-session-connection ICE=remove RTP/AVP direction=ext direction=int");
    }

    t_on_reply("REPLY_FROM_PBX");
    t_on_failure("MANAGE_FAILURE");
    if (!t_relay()) {
        sl_reply_error();
    }
    exit;
}

route[FROM_PBX] {
    if (is_method("CANCEL")) {
        if (t_check_trans()) {
            rtpengine_delete();
            t_relay();
        }
        exit;
    }

    if (has_totag()) {
        if (loose_route()) {
            if (is_method("BYE")) {
                rtpengine_delete();
            } else if (has_body("application/sdp")) {
                rtpengine_manage("trust-address replace-origin replace-session-connection ICE=remove RTP/AVP direction=int direction=ext");
            }
            t_on_reply("REPLY_FROM_EXT");
            t_relay();
            exit;
        }
        if (is_method("ACK")) {
            if (t_check_trans()) {
                t_relay();
                exit;
            }
            exit;
        }
        sl_send_reply("404", "Not Here");
        exit;
    }

    # Initial request from PBX -> Deskphone (uses Path Route header populated on REGISTER)
    if (loose_route()) {
        # For UDP force external UDP socket; for TCP/TLS let mhomed reuse the phone's existing inbound TCP/TLS connection
        if (\$du == \$null || !(\$du =~ "transport=(tcp|TCP|tls|TLS)")) {
            if (\$Rp == 5160) {
                \$fs = "udp:${HUB_BIND_IP}:5160";
            } else {
                \$fs = "udp:${HUB_BIND_IP}:5060";
            }
        }
    }

    # Self-loop guard: never loop an INVITE/OPTIONS back to Kamailio itself
    if (\$du == \$null && (\$rd == "${WG_HUB_IP}" || \$rd == "${HUB_PUBLIC_IP}" || \$rd == "${HUB_BIND_IP}")) {
        xlog("L_WARN", "NORNIA_LOOP_GUARD from_pbx method=\$rm ru=\$ru du=\$du\n");
        sl_send_reply("480", "Temporarily Unavailable");
        exit;
    }

    if (!is_method("OPTIONS")) {
        record_route();
    }

    if (has_body("application/sdp")) {
        rtpengine_manage("trust-address replace-origin replace-session-connection ICE=remove RTP/AVP direction=int direction=ext");
    }

    t_on_reply("REPLY_FROM_EXT");
    t_on_failure("MANAGE_FAILURE");
    if (!t_relay()) {
        sl_reply_error();
    }
    exit;
}

onreply_route[REPLY_FROM_PBX] {
    if (has_body("application/sdp")) {
        rtpengine_manage("trust-address replace-origin replace-session-connection ICE=remove RTP/AVP direction=int direction=ext");
    }
}

onreply_route[REPLY_FROM_EXT] {
    if (nat_uac_test("19")) {
        fix_nated_contact();
    }
    if (has_body("application/sdp")) {
        rtpengine_manage("SIP-source-address replace-origin replace-session-connection ICE=remove RTP/AVP direction=ext direction=int");
    }
}

failure_route[MANAGE_FAILURE] {
    if (t_is_canceled()) {
        exit;
    }
    rtpengine_delete();
}
EOF

# Rsyslog ile Kamailio güvenlik loglarını ayrı dosyaya yönlendir (Fail2Ban için)
if [[ -d /etc/rsyslog.d ]]; then
  cat > /etc/rsyslog.d/40-nornia-kamailio.conf <<'EOF'
:msg, contains, "NORNIA_SEC_" /var/log/kamailio-security.log
& stop
EOF
  systemctl restart rsyslog 2>/dev/null || true
fi

# Systemd drop-in: Kamailio her yeniden başladığında nornia_routes.map otomatik yüklensin
mkdir -p /etc/systemd/system/kamailio.service.d
cat > /etc/systemd/system/kamailio.service.d/nornia-routes.conf <<'EOF'
[Service]
ExecStartPost=+/usr/local/bin/nornia-load-kamailio-routes.sh
EOF
systemctl daemon-reload

# Kamailio konfigürasyon doğrulaması
echo "      Kamailio konfigürasyonu doğrulanıyor (kamailio -c)..."
kamailio -c -f /etc/kamailio/kamailio.cfg
systemctl enable kamailio >/dev/null 2>&1 || true
systemctl restart kamailio
/usr/local/bin/nornia-load-kamailio-routes.sh || true

# 6. Fail2Ban Jail Yapılandırması
echo "[6/7] Fail2Ban SIP saldırı koruması yapılandırılıyor..."
mkdir -p /etc/fail2ban/filter.d /etc/fail2ban/jail.d
cat > /etc/fail2ban/filter.d/nornia-kamailio.conf <<'EOF'
[Definition]
failregex = NORNIA_SEC_(DROP|FLOOD) .* src=<HOST>\b
ignoreregex =
EOF

cat > /etc/fail2ban/jail.d/nornia-kamailio.conf <<'EOF'
[nornia-kamailio]
enabled  = true
filter   = nornia-kamailio
logpath  = /var/log/kamailio-security.log
maxretry = 5
findtime = 600
bantime  = 86400
action   = iptables-allports[name=nornia-sip, protocol=all]
EOF

systemctl enable fail2ban >/dev/null 2>&1 || true
systemctl restart fail2ban || true

# 7. UFW Portlarını Aç (UFW kurulu ve aktifse) ve Hub'ı Yeniden Başlat
echo "[7/7] Güvenlik duvarı (UFW) SIP Edge portları ve Nornia Connect Hub senkronizasyonu..."
if command -v ufw >/dev/null 2>&1; then
  if ufw status | grep -qi "Status: active"; then
    ufw allow "${WG_PORT}/udp" comment "Nornia WireGuard SIP Edge" >/dev/null || true
    ufw allow 5060/udp comment "Nornia Kamailio SIP UDP" >/dev/null || true
    ufw allow 5060/tcp comment "Nornia Kamailio SIP TCP" >/dev/null || true
    ufw allow 5061/tcp comment "Nornia Kamailio SIP TLS" >/dev/null || true
    ufw allow 5160/tcp comment "Nornia Kamailio Cisco chan_sip TCP" >/dev/null || true
    ufw allow 5160/udp comment "Nornia Kamailio Cisco chan_sip UDP" >/dev/null || true
    ufw allow "${RTP_PORT_MIN}:${RTP_PORT_MAX}/udp" comment "Nornia RTPEngine Media" >/dev/null || true
    echo "      UFW portları açıldı: ${WG_PORT}/udp, 5060/udp+tcp, 5061/tcp, 5160/tcp+udp, ${RTP_PORT_MIN}:${RTP_PORT_MAX}/udp"
  else
    echo "      UFW şu an pasif; Panel Güvenlik Kalkanından tek tıkla aktif edebilirsiniz."
  fi
fi

# Nornia Connect Hub'ı yeniden başlat ki veritabanındaki mevcut santraller wg0 ve Kamailio'ya yüklensin
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart nornia-connect-hub >/dev/null 2>&1 || true
fi

echo ""
echo "=============================================================================="
echo "  NORNIA SIP/RTP EDGE v2 KURULUMU TAMAMLANDI!"
echo "=============================================================================="
echo "  Hub Yerel Bind IP   : ${HUB_BIND_IP}"
echo "  Hub Dış (Public) IP : ${HUB_PUBLIC_IP}"
echo "  WireGuard Arayüzü   : ${WG_IFACE} (${WG_HUB_IP}/16 — Port ${WG_PORT}/UDP)"
echo "  Hub WG Public Key   : ${HUB_PUB_KEY}"
echo "  Kamailio SIP Edge   : 5060 (UDP/TCP)${TLS_LISTEN_LINE:+ | 5061 (TLS)}"
echo "  RTPEngine Medya     : UDP ${RTP_PORT_MIN}-${RTP_PORT_MAX}"
echo "  Fail2Ban Koruması   : Aktif (/var/log/kamailio-security.log)"
echo "=============================================================================="
echo "  Santral tarafında sadece şu paket yeterlidir: sudo apt install -y wireguard"
echo "  Anahtar değişimi ve IP ataması Nornia Connect üzerinden TAM OTOMATİK yapılır."
echo "=============================================================================="
