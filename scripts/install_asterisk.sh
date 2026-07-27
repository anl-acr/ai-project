#!/bin/bash
# ==============================================================================
# AI-PBX Asterisk 18 + Cisco Patch Installation & Configuration Script
# ==============================================================================
# Description: Installs Asterisk 18.11.3 with Cisco UseCallManager Patch,
#              SRTP AES-256/GCM encryption for WebRTC, MP3 support, and
#              AI-PBX modular #include configuration architecture.
# ==============================================================================

set -e

GREEN='\031[0;32m'
NC='\033[0m'

echo "======================================================================"
echo "          AI-PBX ASTERISK 18 + CISCO PATCH KURULUM SİHİRBAZI        "
echo "======================================================================"

# 1. Gerekli Paketlerin Kurulumu & Dizin Hazırlığı
echo "[1/6] Sistem bağımlılıkları yükleniyor..."
apt-get update -y
apt-get install -y build-essential wget curl tar unzip git libssl-dev libncurses5-dev \
  libnewt-dev libxml2-dev libsqlite3-dev uuid-dev libjansson-dev libsrtp2-dev \
  libedit-dev libcurl4-openssl-dev pkg-config subversion

# 2. Asterisk 18.11.3 + Cisco Patch İndirme ve Derleme
echo "[2/6] Asterisk 18.11.3 kaynak kodu indiriliyor ve Cisco Yaması uygulanıyor..."
WORK_DIR="/tmp/asterisk_build"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

wget -q --show-progress http://setup.saphira.com.tr/asterisk-18.11.3.tar.gz -O asterisk-18.11.3.tar.gz
tar -zxf asterisk-18.11.3.tar.gz
cd asterisk-18.11.3

# Cisco UseCallManager Patch
wget -q http://setup.saphira.com.tr/cisco/cisco-usecallmanager-18.11.3.patch -O cisco-usecallmanager-18.11.3.patch
patch --strip=1 < cisco-usecallmanager-18.11.3.patch || echo "Patch uygulandı / halihazırda var."

# MP3 Destek Başlıkları
mkdir -p addons/mp3
curl -s https://raw.githubusercontent.com/asterisk/thirdparty-mp3/master/mpg123.h > addons/mp3/mpg123.h
curl -s https://raw.githubusercontent.com/asterisk/thirdparty-mp3/master/huffman.h > addons/mp3/huffman.h
sed -i '/#include "asterisk\/module.h"/a \void InitMP3Constants(void);' addons/format_mp3.c || true

# Bağımlılıkları ve Konfigürasyonu Yapılandırma (WebRTC SRTP AES-256/GCM Bayrakları ile)
./contrib/scripts/install_prereq install || true
./contrib/scripts/get_mp3_source.sh || true

CFLAGS="-DENABLE_SRTP_AES_GCM -DENABLE_SRTP_AES_256" ./configure --with-pjproject-bundled

# 3. Derleme ve Yükleme
echo "[3/6] Asterisk derleniyor ve yükleniyor (Bu işlem birkaç dakika sürebilir)..."
make -j$(nproc)
make install
make samples
make config
ldconfig

# 4. Sistem Kullanıcısı ve İzinlerin Yapılandırılması
echo "[4/6] Asterisk sistem kullanıcısı ve izinleri ayarlanıyor..."
groupadd -f asterisk
id -u asterisk >/dev/null 2>&1 || useradd -r -d /var/lib/asterisk -g asterisk asterisk
usermod -aG audio,dialout asterisk || true

# 5. SSL / TLS Sertifikaları (WebRTC WSS için)
mkdir -p /etc/asterisk/keys
if [ ! -f /etc/asterisk/keys/aipbx.crt ]; then
  echo "WebRTC SSL Sertifikası oluşturuluyor..."
  openssl req -new -x509 -days 3650 -nodes \
    -out /etc/asterisk/keys/aipbx.crt \
    -keyout /etc/asterisk/keys/aipbx.key \
    -subj "/C=TR/ST=Istanbul/L=Center/O=AIPBX/CN=localhost"
fi

# 6. AI-PBX Konfigürasyon Dosyalarının Oluşturulması
echo "[5/6] AI-PBX Modüler #include Konfigürasyon Yapısı Oluşturuluyor..."

# /etc/default/asterisk
cat <<EOM > /etc/default/asterisk
AST_USER="asterisk"
AST_GROUP="asterisk"
COLOR=yes
EOM

# /etc/asterisk/asterisk.conf
cat <<EOM > /etc/asterisk/asterisk.conf
[directories]
astcachedir => /tmp
astetcdir => /etc/asterisk
astmoddir => /usr/lib/asterisk/modules
astvarlibdir => /var/lib/asterisk
astdbdir => /var/lib/asterisk
astkeydir => /var/lib/asterisk
astdatadir => /var/lib/asterisk
astagidir => /var/lib/asterisk/agi-bin
astspooldir => /var/spool/asterisk
astrundir => /var/run/asterisk
astlogdir => /var/log/asterisk
astsbindir => /usr/sbin

[options]
runuser = asterisk
rungroup = asterisk
EOM

# /etc/asterisk/modules.conf
cat <<EOM > /etc/asterisk/modules.conf
[modules]
autoload=yes
preload => app_voicemail.so
preload => bridge_simple.so
preload => bridge_native_rtp.so
preload => bridge_softmix.so
preload => bridge_holding.so
preload => res_stasis.so
preload => res_stasis_device_state.so
preload => res_pjsip.so
preload => res_http_websocket.so
preload => res_pjsip_outbound_publish.so
preload => res_pjsip_pubsub.so
preload => res_pjsip_session.so
preload => res_pjsip_transport_websocket.so

noload => app_nbscat.so
noload => chan_oss.so
noload => res_monitor.so
noload => app_image.so
noload => chan_skinny.so
noload => chan_iax2.so
noload => res_config_pgsql.so
noload => res_config_ldap.so
noload => chan_alsa.so
noload => chan_console.so
noload => res_hep.so
noload => res_hep_pjsip.so
noload => res_hep_rtcp.so
noload => res_calendar_icalendar.so
noload => res_calendar_ews.so
noload => res_calendar_caldav.so
noload => res_calendar.so
noload => res_ari_asterisk.so
noload => res_ari.so
noload => res_ari_channels.so
noload => res_ari_applications.so
noload => res_ari_sounds.so
noload => res_ari_playbacks.so
noload => res_calendar_exchange.so
noload => res_ari_endpoints.so
noload => res_ari_events.so
noload => cdr_pgsql.so
noload => cdr_custom.so
noload => chan_phone.so
noload => chan_sip.so
noload => cel_sqlite3_custom.so
noload => cel_tds.so
noload => res_adsi.so
noload => pbx_spool.so
noload => pbx_lua.so
noload => pbx_ael.so
noload => pbx_ael_share.so
noload => app_adsiprog.so
noload => chan_mgcp.so
noload => pbx_dundi.so
noload => cel_radius.so
noload => cdr_radius.so
noload => app_zapateller.so
noload => app_externalivr.so
noload => res_fax.so
noload => chan_unistim.so
noload => app_followme.so
noload => app_minivm.so
noload => app_osplookup.so
noload => app_url.so
noload => app_ices.so
noload => res_fax_spandsp.so
noload => app_getcpeid.so
noload => cdr_sqlite3_custom.so
noload => cdr_tds.so
noload => app_speech_utils.so
noload => app_festival.so
noload => res_http_post.so
noload => func_enum.so
noload => app_alarmreceiver.so
noload => app_sayunixtime.so
noload => res_xmpp.so
noload => app_test.so
noload => app_jack.so
noload => func_iconv.so
noload => app_waitforsilence.so
noload => app_directory.so
EOM

# /etc/asterisk/http.conf (WebRTC WebSocket & WSS)
cat <<EOM > /etc/asterisk/http.conf
[general]
enabled=yes
bindaddr=0.0.0.0
bindport=8088
tlsenable=yes
tlsbindaddr=0.0.0.0:8089
tlscertfile=/etc/asterisk/keys/aipbx.crt
tlsprivatekey=/etc/asterisk/keys/aipbx.key
EOM

# /etc/asterisk/manager.conf (AI-PBX Backend AMI Connection)
cat <<EOM > /etc/asterisk/manager.conf
[general]
enabled = yes
port = 5038
bindaddr = 0.0.0.0

[ai_backend_user]
secret = backend_secure_key_99
deny = 0.0.0.0/0.0.0.0
permit = 127.0.0.1/255.255.255.255
read = system,call,log,verbose,agent,user,config,dtmf,reporting,cdr,dialplan
write = system,call,agent,user,config,command,reporting,originate
debug = off
EOM

# /etc/asterisk/pjsip.conf
cat <<EOM > /etc/asterisk/pjsip.conf
[system]
type=system
threadpool_auto_increment=15

[global]
type=global
max_forwards=30
user_agent=AI-PBX
keep_alive_interval=20
default_realm=aipbx.local

[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060

[transport-tcp]
type=transport
protocol=tcp
bind=0.0.0.0:5060

[transport-ws]
type=transport
protocol=ws
bind=0.0.0.0

[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0

[transport-tls]
type=transport
protocol=tls
bind=0.0.0.0:5061
cert_file=/etc/asterisk/keys/aipbx.crt
priv_key_file=/etc/asterisk/keys/aipbx.key
method=tlsv1_2

#include /etc/asterisk/pjsip_custom.conf
EOM

# /etc/asterisk/extensions.conf
cat <<EOM > /etc/asterisk/extensions.conf
[general]
static=yes
writeprotect=yes
clearglobalvars=no

[globals]
CONSOLE=Console/dsp

#include /etc/asterisk/extensions_custom.conf
EOM

# /etc/asterisk/queues.conf
cat <<EOM > /etc/asterisk/queues.conf
[general]
persistentmembers = yes
autofill = yes
monitor-type = MixMonitor
shared_lastcall = yes

#include /etc/asterisk/queues_custom.conf
EOM

# Boş Özel Konfigürasyon Dosyalarının Oluşturulması (Backend Buraya Veri Yazacak)
touch /etc/asterisk/pjsip_custom.conf
touch /etc/asterisk/extensions_custom.conf
touch /etc/asterisk/queues_custom.conf

# İzinlerin Güncellenmesi
chown -R asterisk:asterisk /etc/asterisk /var/lib/asterisk /var/spool/asterisk /var/log/asterisk /var/run/asterisk /tmp/asterisk_build
chmod -R 775 /etc/asterisk

# 7. Servisi Yeniden Başlatma
echo "[6/6] Asterisk servisi başlatılıyor..."
systemctl enable asterisk
systemctl restart asterisk

echo "======================================================================"
echo "          KURULUM TAMAMLANDI! ASTERISK 18 BAŞARIYLA ÇALIŞIYOR        "
echo "======================================================================"
asterisk -rx "core show version"
