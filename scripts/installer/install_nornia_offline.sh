#!/usr/bin/env bash
# ==============================================================================
# Nornia — Tam Çevrimdışı (Air-Gapped) Ana Kurulum Motoru
# ==============================================================================
# Ubuntu 24.04 LTS üzerinde sıfır internet erişimi ile eksiksiz Nornia
# sistemini (PostgreSQL 16 Port 5444, Asterisk 18, Python Venv, Node/Next.js,
# PM2, Nginx, WireGuard, UFW, SSH, Kısıtlı 'destek' Hesabı, Konsol TUI) kurar.
#
# Kullanım:
#   sudo bash install_nornia_offline.sh [--bundle-dir /opt/nornia-installer]
#
# Ortam Değişkenleri (Opsiyonel):
#   NORNIA_SYSADMIN_USER  (varsayılan: nornia)
#   NORNIA_SYSADMIN_PASS  (varsayılan: her kurulumda otomatik rastgele üretilir)
#   NORNIA_DESTEK_PASS    (varsayılan: her kurulumda otomatik rastgele üretilir)
# ==============================================================================
set -euo pipefail

LOG_FILE="/var/log/nornia-install.log"
mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1

BUNDLE_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --bundle-dir)
      BUNDLE_DIR="${2:-}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [[ -z "$BUNDLE_DIR" ]]; then
  if [[ -d "/opt/nornia-installer" ]]; then
    BUNDLE_DIR="/opt/nornia-installer"
  elif [[ -d "/cdrom/nornia" ]]; then
    BUNDLE_DIR="/cdrom/nornia"
  else
    BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  fi
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[HATA] Bu betik root (sudo) yetkisiyle çalıştırılmalıdır." >&2
  exit 1
fi

SYSADMIN_USER="${NORNIA_SYSADMIN_USER:-nornia}"
SYSADMIN_PASS="${NORNIA_SYSADMIN_PASS:-$(openssl rand -base64 15 | tr -dc 'A-Za-z0-9!@#_' | head -c 16)}"
DESTEK_USER="destek"
DESTEK_PASS="${NORNIA_DESTEK_PASS:-$(openssl rand -base64 15 | tr -dc 'A-Za-z0-9!@#_' | head -c 16)}"
AMI_SECRET_GEN="${NORNIA_AMI_SECRET:-$(openssl rand -hex 24)}"
SESSION_SECRET_GEN="${NORNIA_SESSION_SECRET:-$(openssl rand -hex 32)}"
PROJECT_DIR="/opt/ai-project"

export DEBIAN_FRONTEND=noninteractive

echo "======================================================================"
echo "  NORNIA — TAM ÇEVRİMDIŞI (AIR-GAPPED) KURULUM BAŞLATILIYOR"
echo "  Tarih      : $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Paket Yolu : ${BUNDLE_DIR}"
echo "======================================================================"

# ------------------------------------------------------------------------------
# 1. Yerel Çevrimdışı APT Deposu Yapılandırması
# ------------------------------------------------------------------------------
echo "[1/11] Çevrimdışı APT deposu ve sistem paketleri kuruluyor..."
APT_BACKUP_DIR="/tmp/nornia_apt_sources_backup"
mkdir -p "$APT_BACKUP_DIR"

restore_apt_sources() {
  rm -f /etc/apt/sources.list.d/nornia-offline.list
  if [[ -f "${APT_BACKUP_DIR}/sources.list" ]]; then
    mv "${APT_BACKUP_DIR}/sources.list" /etc/apt/sources.list 2>/dev/null || true
  fi
  if [[ -d "${APT_BACKUP_DIR}/sources.list.d" ]]; then
    find "${APT_BACKUP_DIR}/sources.list.d" -maxdepth 1 -type f -exec mv {} /etc/apt/sources.list.d/ \; 2>/dev/null || true
  fi
  rm -rf "$APT_BACKUP_DIR"
}
trap restore_apt_sources EXIT

if [[ -d "${BUNDLE_DIR}/apt-repo" ]]; then
  # Geçici olarak dış internet kaynaklarını devre dışı bırak, sadece yerel depoyu kullan
  if [[ -f /etc/apt/sources.list ]]; then
    mv /etc/apt/sources.list "${APT_BACKUP_DIR}/sources.list" || true
  fi
  mkdir -p "${APT_BACKUP_DIR}/sources.list.d"
  find /etc/apt/sources.list.d -maxdepth 1 -type f ! -name "nornia-offline.list" -exec mv {} "${APT_BACKUP_DIR}/sources.list.d/" \; 2>/dev/null || true

  cat <<EOF > /etc/apt/sources.list.d/nornia-offline.list
deb [trusted=yes] file://${BUNDLE_DIR}/apt-repo ./
EOF

  apt-get update -o Acquire::AllowInsecureRepositories=true -o Acquire::AllowDowngradeToInsecureRepositories=true
else
  echo "[UYARI] Yerel apt-repo bulunamadı (${BUNDLE_DIR}/apt-repo), mevcut APT kaynakları kullanılacak."
  apt-get update -y || true
fi

install_available_group() {
  local group_name="$1"
  shift
  local avail=()
  for p in "$@"; do
    if apt-cache show "$p" >/dev/null 2>&1; then
      avail+=("$p")
    else
      echo "  [BİLGİ] Paket yerel depoda yok, atlandı: $p"
    fi
  done
  if [[ "${#avail[@]}" -gt 0 ]]; then
    echo "  → Kuruluyor (${group_name}): ${avail[*]}"
    apt-get install -y --no-install-recommends "${avail[@]}"
  fi
}

install_available_group "Temel & SSH" openssh-server sudo curl wget ca-certificates gnupg openssl
install_available_group "PostgreSQL 16" postgresql-16 postgresql-client-16 postgresql-16-pgvector
install_available_group "Web & Ağ Servisleri" nginx wireguard wireguard-tools ufw fail2ban chrony
install_available_group "Python 3" python3 python3-venv python3-pip
install_available_group "Node.js" nodejs
if ! command -v npm >/dev/null 2>&1; then
  install_available_group "npm" npm || true
fi
install_available_group "Ses & Medya" ffmpeg sox
install_available_group "Destek Ağ Araçları" sngrep tcpdump mtr-tiny dnsutils traceroute iputils-ping iproute2 net-tools netcat-openbsd
install_available_group "Asterisk Runtime Kütüphaneleri" libssl3t64 libssl3 libjansson4 libsrtp2-1 libsqlite3-0 libxml2 libedit2 libuuid1 libcurl4t64 libcurl4 libopus0 libspandsp2t64 libspandsp2

# ------------------------------------------------------------------------------
# 2. Pre-built Asterisk .deb Kurulumu
# ------------------------------------------------------------------------------
echo "[2/11] Nornia Asterisk 18 (.deb) kuruluyor..."
AST_DEB="$(find "${BUNDLE_DIR}/debs" -maxdepth 1 -name "nornia-asterisk_*.deb" 2>/dev/null | head -n 1 || true)"
if [[ -n "$AST_DEB" && -f "$AST_DEB" ]]; then
  if ! dpkg -i "$AST_DEB"; then
    apt-get install -f -y --no-install-recommends || dpkg --force-depends -i "$AST_DEB"
  fi
else
  echo "[UYARI] nornia-asterisk_*.deb bulunamadı; sistem Asterisk paketi kontrol ediliyor..."
  apt-get install -y asterisk 2>/dev/null || true
fi

# Yerel APT kaynaklarını temizle, standart Ubuntu kaynaklarını geri yükle
restore_apt_sources
trap - EXIT

# ------------------------------------------------------------------------------
# 3. PostgreSQL 16 (Port 5444) & Benzersiz Veritabanı Şifresi
# ------------------------------------------------------------------------------
echo "[3/11] PostgreSQL 16 (Port 5444 / ai_pbx) yapılandırılıyor..."
PG_CONF="$(find /etc/postgresql -name postgresql.conf 2>/dev/null | head -n 1 || true)"
if [[ -n "$PG_CONF" ]]; then
  sed -i -E 's/^#?\s*port\s*=\s*[0-9]+/port = 5444/' "$PG_CONF"
fi
systemctl enable postgresql
systemctl restart postgresql
sleep 2

DB_PASS="$(openssl rand -hex 18)"
sudo -u postgres psql -p 5444 -tAc "SELECT 1 FROM pg_roles WHERE rolname='ai_pbx'" | grep -q 1 \
  && sudo -u postgres psql -p 5444 -c "ALTER USER ai_pbx WITH PASSWORD '${DB_PASS}';" \
  || sudo -u postgres psql -p 5444 -c "CREATE USER ai_pbx WITH PASSWORD '${DB_PASS}' SUPERUSER;"

sudo -u postgres psql -p 5444 -tAc "SELECT 1 FROM pg_database WHERE datname='ai_pbx'" | grep -q 1 \
  || sudo -u postgres psql -p 5444 -c "CREATE DATABASE ai_pbx OWNER ai_pbx;"

sudo -u postgres psql -p 5444 -d ai_pbx -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true

# ------------------------------------------------------------------------------
# 4. Nornia Uygulama Paketinin Açılması (/opt/ai-project)
# ------------------------------------------------------------------------------
echo "[4/11] Nornia uygulama dosyaları /opt/ai-project dizinine açılıyor..."
mkdir -p "$PROJECT_DIR"
APP_BUNDLE="${BUNDLE_DIR}/app/nornia-app-bundle.tar.gz"
if [[ -f "$APP_BUNDLE" ]]; then
  tar -xzf "$APP_BUNDLE" -C "$PROJECT_DIR"
else
  echo "[HATA] Uygulama paketi bulunamadı: ${APP_BUNDLE}" >&2
  exit 1
fi

mkdir -p "${PROJECT_DIR}/recordings" "${PROJECT_DIR}/uploads" "${PROJECT_DIR}/backups" "${PROJECT_DIR}/network_backups"

# Benzersiz backend/.env
cat <<EOF > "${PROJECT_DIR}/backend/.env"
DATABASE_URL=postgresql+asyncpg://ai_pbx:${DB_PASS}@127.0.0.1:5444/ai_pbx
AMI_HOST=127.0.0.1
AMI_PORT=5038
AMI_USER=ai_backend_user
AMI_SECRET=${AMI_SECRET_GEN}
NORNIA_SESSION_SECRET=${SESSION_SECRET_GEN}
NORNIA_BIND_HOST=127.0.0.1
NORNIA_ENABLE_DOCS=0
EOF
chmod 0600 "${PROJECT_DIR}/backend/.env"

# Sıfır kurulum settings.json (ilk açılışta /setup kesin olarak tetiklenir)
if [[ ! -f "${PROJECT_DIR}/backend/settings.json" ]]; then
  cat <<'EOF' > "${PROJECT_DIR}/backend/settings.json"
{
  "company_name": "",
  "setup_wizard": {
    "completed": false
  },
  "users": [],
  "trunks": [],
  "autoprovision": [],
  "tenants": [],
  "pbx": {
    "numbering_plan": {
      "extension_range": {"start": 1000, "end": 1099},
      "queue_range": {"start": 6000, "end": 6099},
      "conference_range": {"start": 8000, "end": 8099},
      "call_pickup": {"group": "*8", "directed": "**8"},
      "pbx_features": {"voicemail_listen": "*97"}
    }
  },
  "nat": {
    "enabled": true,
    "extern_ip": "",
    "local_nets": ["192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12"]
  }
}
EOF
fi

# Güvenilir yedek DNS (DHCP upstream DNS vermese bile panel.nornia.com.tr / connect.nornia.com.tr çözülsün)
mkdir -p /etc/systemd/resolved.conf.d
cat <<'EOF' > /etc/systemd/resolved.conf.d/99-nornia-dns.conf
[Resolve]
FallbackDNS=8.8.8.8 1.1.1.1
EOF
systemctl restart systemd-resolved 2>/dev/null || true

# ------------------------------------------------------------------------------
# 5. Python Virtual Environment (Tam Çevrimdışı Wheel Kurulumu)
# ------------------------------------------------------------------------------
echo "[5/11] Python venv ve çevrimdışı bağımlılıklar kuruluyor..."
python3 -m venv "${PROJECT_DIR}/venv"
if [[ -d "${BUNDLE_DIR}/wheels" ]]; then
  "${PROJECT_DIR}/venv/bin/pip" install --no-index --find-links="${BUNDLE_DIR}/wheels" --upgrade pip 2>/dev/null || true
  if [[ -f "${BUNDLE_DIR}/wheels/requirements-locked.txt" ]]; then
    "${PROJECT_DIR}/venv/bin/pip" install --no-index --find-links="${BUNDLE_DIR}/wheels" -r "${BUNDLE_DIR}/wheels/requirements-locked.txt"
  else
    "${PROJECT_DIR}/venv/bin/pip" install --no-index --find-links="${BUNDLE_DIR}/wheels" "${BUNDLE_DIR}/wheels"/*.whl
  fi
fi

# Veritabanı tablolarını başlangıçta oluştur
cd "$PROJECT_DIR"
"${PROJECT_DIR}/venv/bin/python" -c "
import asyncio
from backend.database.config import engine
from backend.database.models import Base
async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
asyncio.run(init())
print('[OK] PostgreSQL tabloları hazırlandı.')
" || echo "[UYARI] DB tablo oluşturma ilk backend açılışında tamamlanacak."

# ------------------------------------------------------------------------------
# 6. PM2 Çevrimdışı Kurulum & Servis Tanımları
# ------------------------------------------------------------------------------
echo "[6/11] PM2 (çevrimdışı) ve Nornia servisleri yapılandırılıyor..."
if [[ -d "${BUNDLE_DIR}/npm/pm2-global" ]]; then
  cp -r "${BUNDLE_DIR}/npm/pm2-global/." /usr/local/
  chmod 0755 /usr/local /usr/local/bin /usr/local/lib 2>/dev/null || true
  chmod +x /usr/local/bin/pm2 2>/dev/null || true
elif [[ -f "${BUNDLE_DIR}/npm/pm2-offline.tgz" ]]; then
  npm install -g --offline "${BUNDLE_DIR}/npm/pm2-offline.tgz" || true
fi

cat <<'EOF' > "${PROJECT_DIR}/ecosystem.config.js"
module.exports = {
  apps: [
    {
      name: "aida-app",
      cwd: "/opt/ai-project/frontend",
      script: "node_modules/.bin/next",
      args: "start -p 3000 -H 127.0.0.1",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      autorestart: true,
      max_memory_restart: "1G"
    },
    {
      name: "aida-backend",
      cwd: "/opt/ai-project",
      script: "/opt/ai-project/venv/bin/uvicorn",
      args: "backend.main:app --host 127.0.0.1 --port 8000",
      interpreter: "none",
      env: {
        PYTHONUNBUFFERED: "1"
      },
      autorestart: true,
      max_memory_restart: "1500M"
    }
  ]
};
EOF

# ------------------------------------------------------------------------------
# 7. Asterisk Konfigürasyonu, AMI & WebRTC SSL Sertifikası
# ------------------------------------------------------------------------------
echo "[7/11] Asterisk modüler konfigürasyonu ve WebRTC TLS sertifikası hazırlanıyor..."
mkdir -p /etc/asterisk/keys /var/spool/asterisk/monitor /var/run/asterisk /var/log/asterisk

if [[ ! -f /etc/asterisk/keys/asterisk.pem ]]; then
  openssl req -new -x509 -days 3650 -nodes \
    -out /etc/asterisk/keys/asterisk.crt \
    -keyout /etc/asterisk/keys/asterisk.key \
    -subj "/C=TR/ST=Istanbul/L=Istanbul/O=Nornia/CN=nornia.local"
  cat /etc/asterisk/keys/asterisk.crt /etc/asterisk/keys/asterisk.key > /etc/asterisk/keys/asterisk.pem
  chmod 644 /etc/asterisk/keys/asterisk.pem /etc/asterisk/keys/asterisk.crt
  chmod 640 /etc/asterisk/keys/asterisk.key
fi

cat <<'EOF' > /etc/asterisk/asterisk.conf
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
EOF

cat <<EOF > /etc/asterisk/manager.conf
[general]
enabled = yes
port = 5038
bindaddr = 127.0.0.1

[ai_backend_user]
secret = ${AMI_SECRET_GEN}
deny = 0.0.0.0/0.0.0.0
permit = 127.0.0.1/255.255.255.0
read = all
write = all
EOF

cat <<'EOF' > /etc/asterisk/http.conf
[general]
enabled=yes
bindaddr=0.0.0.0
bindport=8088
tlsenable=yes
tlsbindaddr=0.0.0.0:8089
tlscertfile=/etc/asterisk/keys/asterisk.pem
tlsprivatekey=/etc/asterisk/keys/asterisk.pem
EOF

cat <<'EOF' > /etc/asterisk/rtp.conf
[general]
rtpstart=10000
rtpend=20000
icesupport=yes
stunaddr=stun.l.google.com:19302
EOF

cat <<'EOF' > /etc/asterisk/pjsip.conf
[global]
type=global
user_agent=Nornia

#include /etc/asterisk/pjsip_custom.conf
EOF

cat <<'EOF' > /etc/asterisk/extensions.conf
[general]
static=yes
writeprotect=no

#include /etc/asterisk/extensions_custom.conf
EOF

cat <<'EOF' > /etc/asterisk/queues.conf
[general]
persistentmembers = yes
autofill = yes
monitor-type = MixMonitor
shared_lastcall = yes

#include /etc/asterisk/queues_custom.conf
EOF

# Legacy chan_sip kapat (Nornia yalnızca chan_pjsip kullanır) ve anonim çağrıları engelle
if [[ -f /etc/asterisk/modules.conf ]] && ! grep -q "noload => chan_sip.so" /etc/asterisk/modules.conf; then
  echo "noload => chan_sip.so" >> /etc/asterisk/modules.conf
fi
cat <<'EOF' > /etc/asterisk/sip.conf
[general]
allowguest=no
alwaysauthreject=yes
EOF

if [[ -f /etc/asterisk/logger.conf ]] && ! grep -q "^security =>" /etc/asterisk/logger.conf; then
  sed -i '/^\[logfiles\]/a security => security,notice,warning,error' /etc/asterisk/logger.conf || true
fi
touch /var/log/asterisk/messages /var/log/asterisk/security
touch /etc/asterisk/pjsip_custom.conf /etc/asterisk/extensions_custom.conf /etc/asterisk/queues_custom.conf /etc/asterisk/features_custom.conf
chown -R asterisk:asterisk /etc/asterisk /var/lib/asterisk /var/spool/asterisk /var/log/asterisk /var/run/asterisk
chmod -R 775 /etc/asterisk /var/run/asterisk
chmod 644 /etc/asterisk/keys/asterisk.pem

"${PROJECT_DIR}/venv/bin/python" "${PROJECT_DIR}/backend/scripts/sync_asterisk.py" || true
systemctl enable asterisk 2>/dev/null || true
systemctl restart asterisk 2>/dev/null || true

# ------------------------------------------------------------------------------
# 8. Nginx Reverse Proxy (HTTP 80 + Self-Signed HTTPS 443)
# ------------------------------------------------------------------------------
echo "[8/11] Nginx Reverse Proxy yapılandırılıyor..."
mkdir -p /etc/nginx/ssl
if [[ ! -f /etc/nginx/ssl/nornia.crt ]]; then
  openssl req -new -x509 -days 3650 -nodes \
    -out /etc/nginx/ssl/nornia.crt \
    -keyout /etc/nginx/ssl/nornia.key \
    -subj "/C=TR/ST=Istanbul/L=Istanbul/O=Nornia/CN=nornia.local"
fi

cat <<'EOF' > /etc/nginx/sites-available/nornia
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;

    server_tokens off;
    ssl_certificate     /etc/nginx/ssl/nornia.crt;
    ssl_certificate_key /etc/nginx/ssl/nornia.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    # SEC-08: HTTP Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), geolocation=(), payment=()" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self' https: data: blob: wss: ws:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; frame-ancestors 'self';" always;

    client_max_body_size 100M;

    # Backend FastAPI & WebSockets
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }

    location /ws {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
    }

    # Asterisk WebRTC WSS Proxy
    location /asterisk/ws {
        proxy_pass https://127.0.0.1:8089/ws;
        proxy_ssl_verify off;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }

    # Next.js Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/nornia /etc/nginx/sites-enabled/nornia
nginx -t && systemctl enable nginx && systemctl restart nginx

# ------------------------------------------------------------------------------
# 9. Sistem Hesapları ('nornia' Admin + Kısıtlı 'destek') & SSH Güvenliği
# ------------------------------------------------------------------------------
echo "[9/11] 'nornia' yönetim hesabı, kısıtlı 'destek' hesabı ve SSH yapılandırılıyor..."

# 9a) Kısıtlı destek araçlarının kurulumu (yalnızca root tarafından yazılabilir)
mkdir -p /usr/local/lib/nornia
cp "${PROJECT_DIR}/backend/scripts/nornia_destek_ops.py" /usr/local/lib/nornia/nornia_destek_ops.py
cp "${PROJECT_DIR}/backend/scripts/nornia_destek_shell.py" /usr/local/bin/nornia-destek-shell
chown root:root /usr/local/lib/nornia/nornia_destek_ops.py /usr/local/bin/nornia-destek-shell
chmod 0755 /usr/local/lib/nornia/nornia_destek_ops.py /usr/local/bin/nornia-destek-shell

grep -qxF "/usr/local/bin/nornia-destek-shell" /etc/shells || echo "/usr/local/bin/nornia-destek-shell" >> /etc/shells

# 9b) Tam yetkili SSH yönetim hesabı: nornia
if ! id -u "$SYSADMIN_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash -G sudo "$SYSADMIN_USER"
else
  usermod -aG sudo "$SYSADMIN_USER"
fi
echo "${SYSADMIN_USER}:${SYSADMIN_PASS}" | chpasswd

# 9c) Kısıtlı destek hesabı: destek (ham shell yok, ForceCommand + sınırlı sudoers)
if ! id -u "$DESTEK_USER" >/dev/null 2>&1; then
  useradd -m -s /usr/local/bin/nornia-destek-shell "$DESTEK_USER"
else
  usermod -s /usr/local/bin/nornia-destek-shell "$DESTEK_USER"
fi
echo "${DESTEK_USER}:${DESTEK_PASS}" | chpasswd
# destek kullanıcısının /opt/ai-project sırlarına doğrudan okuma erişimini kısıtla
chmod 0750 "${PROJECT_DIR}/backend" 2>/dev/null || true

# 9d) Beyaz-listeli sudoers (destek YALNIZCA nornia_destek_ops.py çalıştırabilir)
cat <<'EOF' > /etc/sudoers.d/nornia-destek
Defaults:destek !requiretty, env_reset, secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
destek ALL=(root) NOPASSWD: /usr/local/lib/nornia/nornia_destek_ops.py *
EOF
chmod 0440 /etc/sudoers.d/nornia-destek
visudo -cf /etc/sudoers.d/nornia-destek

# 9e) SSH yapılandırması (SSH açık, root kapalı, destek ForceCommand ile kilitli)
mkdir -p /etc/ssh/sshd_config.d
cat <<'EOF' > /etc/ssh/sshd_config.d/50-nornia.conf
PermitRootLogin no
PasswordAuthentication yes
PubkeyAuthentication yes
X11Forwarding no

Match User destek
    ForceCommand /usr/local/bin/nornia-destek-shell
    AllowTcpForwarding no
    AllowAgentForwarding no
    X11Forwarding no
    PermitTunnel no
    PermitTTY yes
EOF
mkdir -p /run/sshd
chmod 0755 /run/sshd
sshd -t
systemctl enable ssh 2>/dev/null || systemctl enable sshd 2>/dev/null || true
systemctl restart ssh 2>/dev/null || systemctl restart ssh.socket 2>/dev/null || systemctl restart sshd 2>/dev/null || true

# ------------------------------------------------------------------------------
# 10. UFW Güvenlik Duvarı, PM2 Başlatma & Konsol Banner Servisi
# ------------------------------------------------------------------------------
echo "[10/11] Güvenlik duvarı (UFW), PM2 ve Konsol Karşılama servisi başlatılıyor..."
ufw --force reset >/dev/null 2>&1 || true
ufw default deny incoming >/dev/null 2>&1 || true
ufw default allow outgoing >/dev/null 2>&1 || true
ufw allow 22/tcp comment 'SSH' >/dev/null 2>&1 || true
ufw allow 80/tcp comment 'HTTP' >/dev/null 2>&1 || true
ufw allow 443/tcp comment 'HTTPS' >/dev/null 2>&1 || true
ufw allow 5060/udp comment 'SIP UDP' >/dev/null 2>&1 || true
ufw allow 5060/tcp comment 'SIP TCP' >/dev/null 2>&1 || true
ufw allow 5061/tcp comment 'SIP TLS' >/dev/null 2>&1 || true
ufw allow 8089/tcp comment 'WebRTC WSS' >/dev/null 2>&1 || true
ufw allow 10000:20000/udp comment 'RTP Media' >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

# Fail2Ban Asterisk SIP koruması
mkdir -p /etc/fail2ban/jail.d
cat <<'EOF' > /etc/fail2ban/jail.d/nornia-asterisk.conf
[asterisk]
enabled  = true
filter   = asterisk
port     = 5060,5061
logpath  = /var/log/asterisk/messages
           /var/log/asterisk/security
maxretry = 5
findtime = 600
bantime  = 3600
EOF
systemctl enable fail2ban 2>/dev/null || true
systemctl restart fail2ban 2>/dev/null || true

# PM2 uygulamalarını başlat & kendi systemd servisi (pm2-root.service) altında kalıcı çalıştır
if command -v pm2 >/dev/null 2>&1; then
  cd "$PROJECT_DIR"
  pm2 startOrReload "${PROJECT_DIR}/ecosystem.config.js" || pm2 start "${PROJECT_DIR}/ecosystem.config.js"
  pm2 save --force
  pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
  pm2 save --force
  # Oneshot bootstrap cgroup kapandığında PM2'nin SIGINT yememesi için kendi systemd unit'inden başlat
  pm2 kill >/dev/null 2>&1 || true
  systemctl daemon-reload
  systemctl enable pm2-root.service 2>/dev/null || true
  systemctl restart pm2-root.service 2>/dev/null || true
fi

# TTY1 Canlı Konsol Panosu Servisi
cat <<'EOF' > /etc/systemd/system/nornia-console-banner.service
[Unit]
Description=Nornia Console Status Banner (/etc/issue Updater)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/ai-project/backend/scripts/nornia_console.py --daemon --interval 15
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Klonlama / Sysprep sonrası İlk Açılış Hijyen Servisi
cat <<'EOF' > /usr/local/sbin/nornia-firstboot-hygiene.sh
#!/usr/bin/env bash
set -euo pipefail
FLAG="/var/lib/nornia/needs-firstboot-hygiene"
[[ -f "$FLAG" ]] || exit 0
if [[ ! -s /etc/machine-id ]]; then
  systemd-machine-id-setup
fi
if ! ls /etc/ssh/ssh_host_*_key >/dev/null 2>&1; then
  dpkg-reconfigure -f noninteractive openssh-server || ssh-keygen -A
  systemctl restart ssh 2>/dev/null || true
fi
openssl req -new -x509 -days 3650 -nodes \
  -out /etc/asterisk/keys/asterisk.crt \
  -keyout /etc/asterisk/keys/asterisk.key \
  -subj "/C=TR/ST=Istanbul/L=Istanbul/O=Nornia/CN=$(hostname)"
cat /etc/asterisk/keys/asterisk.crt /etc/asterisk/keys/asterisk.key > /etc/asterisk/keys/asterisk.pem
chown asterisk:asterisk /etc/asterisk/keys/asterisk.*
chmod 644 /etc/asterisk/keys/asterisk.pem /etc/asterisk/keys/asterisk.crt
rm -f "$FLAG"
EOF
chmod 0755 /usr/local/sbin/nornia-firstboot-hygiene.sh

cat <<'EOF' > /etc/systemd/system/nornia-firstboot-hygiene.service
[Unit]
Description=Nornia First-Boot Security Hygiene (Unique Keys & Machine ID)
Before=ssh.service asterisk.service
ConditionPathExists=/var/lib/nornia/needs-firstboot-hygiene

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/nornia-firstboot-hygiene.sh

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable nornia-console-banner.service nornia-firstboot-hygiene.service
systemctl restart nornia-console-banner.service || true

# ------------------------------------------------------------------------------
# 11. Kurulum Temizliği & Özet
# ------------------------------------------------------------------------------
echo "[11/11] Kurulum tamamlandı!"
python3 "${PROJECT_DIR}/backend/scripts/nornia_console.py" --write-issue || true

echo "======================================================================"
echo "  NORNIA TAM ÇEVRİMDIŞI KURULUM BAŞARIYLA TAMAMLANDI!"
echo "  * Yönetim SSH Hesabı : ${SYSADMIN_USER}"
echo "  * Kısıtlı Destek     : ${DESTEK_USER} (Ağ analizi & IP konsolu)"
echo "  * İlk Web Kurulumu   : http://$(hostname -I | awk '{print $1}')/setup"
echo "======================================================================"
