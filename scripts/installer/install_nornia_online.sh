#!/usr/bin/env bash
# ==============================================================================
# Nornia Enterprise AI PBX — Ubuntu 24.04 LTS Çevrimiçi (Online) Kurulum Betiği
# ==============================================================================
# ISO imajı olmadan temiz bir Ubuntu 24.04 LTS sunucusuna (VPS, Cloud, VMware,
# Proxmox veya fiziksel sunucu) internetten eksiksiz Nornia sistemini kurar:
#   • PostgreSQL 16 (Port 5444) + pgvector
#   • Nornia Asterisk 18.11.3 (Cisco Patch + WebRTC SRTP AES-256/GCM + AudioSocket + Opus)
#   • Python 3.12 Virtual Environment (/opt/ai-project/venv) + FastAPI & AudioSocket (9092)
#   • Node.js 20 LTS + Next.js Frontend Production Build + PM2 (pm2-root.service)
#   • Nginx Reverse Proxy (HTTP 80 + Self-Signed HTTPS 443 + WebRTC WSS /asterisk/ws)
#   • UFW Güvenlik Duvarı, Fail2Ban, Chrony NTP, WireGuard, SMB/NFS NAS Desteği
#   • 'nornia' Yönetim Hesabı + Kısıtlı 'destek' Hesabı + TTY1 Canlı Konsol Panosu
#   • İlk Web Kurulum Sihirbazı (/setup) hazır olarak açılır.
#
# Kurulum Modları (Özel/Private Kaynak Korumalı):
#   1) Nornia Kurumsal Paket Sunucusu (Müşteri Kurulumları — GitHub Gerektirmez):
#      sudo bash install_nornia_online.sh \
#        --bundle-url https://panel.nornia.com.tr/releases/nornia-app-bundle.tar.gz \
#        --asterisk-deb https://panel.nornia.com.tr/releases/nornia-asterisk_18.11.3_amd64.deb
#
#   2) Yetkili Nornia Teknik Ekibi (Private Git Repo):
#      sudo bash install_nornia_online.sh --token ghp_xxxxxxxxxxxxxxxxxxxx
#
# Ortam Değişkenleri (Opsiyonel):
#   NORNIA_BUNDLE_URL       (önceden paketlenmiş nornia-app-bundle.tar.gz URL veya yerel dosya)
#   NORNIA_BUNDLE_TOKEN     (bundle indirirken kullanılacak Bearer token / lisans anahtarı)
#   NORNIA_REPO_URL         (özel Git depo URL'si — yalnızca yetkili ekip)
#   NORNIA_BRANCH           (varsayılan: main)
#   NORNIA_GIT_TOKEN        (özel GitHub repo için Personal Access Token — yalnızca yetkili ekip)
#   NORNIA_ASTERISK_DEB_URL (önceden derlenmiş .deb URL veya yerel dosya yolu — ~15 sn kurulum)
#   NORNIA_SYSADMIN_USER    (varsayılan: nornia)
#   NORNIA_SYSADMIN_PASS    (varsayılan: NorniaAdmin2027!*)
#   NORNIA_DESTEK_PASS      (varsayılan: destekgiris2027!*)
#   NORNIA_LOCK_ROOT_SSH    (1 ise PermitRootLogin no; varsayılan: 0 -> prohibit-password)
# ==============================================================================
set -euo pipefail

LOG_FILE="/var/log/nornia-online-install.log"
mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1

BUNDLE_URL="${NORNIA_BUNDLE_URL:-}"
BUNDLE_TOKEN="${NORNIA_BUNDLE_TOKEN:-}"
REPO_URL="${NORNIA_REPO_URL:-https://github.com/anl-acr/ai-project.git}"
BRANCH="${NORNIA_BRANCH:-main}"
GIT_TOKEN="${NORNIA_GIT_TOKEN:-}"
ASTERISK_DEB_SRC="${NORNIA_ASTERISK_DEB_URL:-}"
SYSADMIN_USER="${NORNIA_SYSADMIN_USER:-nornia}"
SYSADMIN_PASS="${NORNIA_SYSADMIN_PASS:-NorniaAdmin2027!*}"
DESTEK_USER="destek"
DESTEK_PASS="${NORNIA_DESTEK_PASS:-destekgiris2027!*}"
LOCK_ROOT_SSH="${NORNIA_LOCK_ROOT_SSH:-0}"
SKIP_UFW="${NORNIA_SKIP_UFW:-0}"
SKIP_SSH_CONFIG="${NORNIA_SKIP_SSH_CONFIG:-0}"
PROJECT_DIR="/opt/ai-project"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bundle-url)
      BUNDLE_URL="${2:-}"
      shift 2
      ;;
    --bundle-token)
      BUNDLE_TOKEN="${2:-}"
      shift 2
      ;;
    --repo)
      REPO_URL="${2:-}"
      shift 2
      ;;
    --branch)
      BRANCH="${2:-main}"
      shift 2
      ;;
    --token)
      GIT_TOKEN="${2:-}"
      shift 2
      ;;
    --asterisk-deb)
      ASTERISK_DEB_SRC="${2:-}"
      shift 2
      ;;
    --sysadmin-user)
      SYSADMIN_USER="${2:-nornia}"
      shift 2
      ;;
    --sysadmin-pass)
      SYSADMIN_PASS="${2:-}"
      shift 2
      ;;
    --destek-pass)
      DESTEK_PASS="${2:-}"
      shift 2
      ;;
    --lock-root-ssh)
      LOCK_ROOT_SSH="1"
      shift
      ;;
    --skip-ufw)
      SKIP_UFW="1"
      shift
      ;;
    --skip-ssh-config)
      SKIP_SSH_CONFIG="1"
      shift
      ;;
    -h|--help)
      sed -n '2,42p' "$0"
      exit 0
      ;;
    *)
      echo "[UYARI] Bilinmeyen parametre atlandı: $1"
      shift
      ;;
  esac
done

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[HATA] Bu betik root (sudo) yetkisiyle çalıştırılmalıdır." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

# İşletim sistemi kontrolü
OS_ID="unknown"
OS_VER="unknown"
if [[ -f /etc/os-release ]]; then
  # shellcheck disable=SC1091
  source /etc/os-release
  OS_ID="${ID:-unknown}"
  OS_VER="${VERSION_ID:-unknown}"
fi

echo "======================================================================"
echo "  NORNIA ENTERPRISE AI PBX — ÇEVRİMİÇİ (ONLINE) KURULUM BAŞLATILIYOR"
echo "  Tarih      : $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Sistem     : ${OS_ID} ${OS_VER} ($(dpkg --print-architecture 2>/dev/null || uname -m))"
echo "  Hedef Dizin: ${PROJECT_DIR}"
echo "  Depo / Dal : ${REPO_URL} (${BRANCH})"
echo "  Log Dosyası: ${LOG_FILE}"
echo "======================================================================"

if [[ "$OS_ID" != "ubuntu" || "$OS_VER" != "24.04" ]]; then
  echo "[UYARI] Bu betik Ubuntu 24.04 LTS için optimize edilmiştir (algılanan: ${OS_ID} ${OS_VER})."
  echo "        5 saniye içinde kuruluma devam ediliyor (iptal için Ctrl+C)..."
  sleep 5
fi

# ------------------------------------------------------------------------------
# 1. Sistem Güncelleme, Swap Koruması & Temel Sistem Paketleri
# ------------------------------------------------------------------------------
echo "[1/12] Sistem güncelleniyor, swap belleği ve temel paketler kuruluyor..."

# RAM < 6 GB ise Next.js build ve Asterisk derlemesinde OOM olmaması için 4 GB swap oluştur
TOTAL_RAM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 8192)"
TOTAL_SWAP_MB="$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)"
if [[ "$TOTAL_RAM_MB" -lt 6144 && "$TOTAL_SWAP_MB" -lt 2048 && ! -f /swapfile ]]; then
  echo "  → Sunucu RAM (${TOTAL_RAM_MB} MB) düşük; güvenli derleme için 4 GB /swapfile oluşturuluyor..."
  fallocate -l 4G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -qF "/swapfile" /etc/fstab || echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

apt-get update -y
apt-get install -y --no-install-recommends \
  openssh-server sudo curl wget git ca-certificates gnupg lsb-release openssl \
  nginx wireguard wireguard-tools ufw fail2ban chrony \
  python3 python3-venv python3-pip python3-dev build-essential \
  ffmpeg sox cifs-utils nfs-common \
  sngrep tcpdump mtr-tiny dnsutils traceroute iputils-ping iproute2 net-tools netcat-openbsd

# Güvenilir yedek DNS
mkdir -p /etc/systemd/resolved.conf.d
cat <<'EOF' > /etc/systemd/resolved.conf.d/99-nornia-dns.conf
[Resolve]
FallbackDNS=8.8.8.8 1.1.1.1
EOF
systemctl restart systemd-resolved 2>/dev/null || true

# ------------------------------------------------------------------------------
# 2. Node.js 20 LTS (NodeSource) & PM2 Kurulumu
# ------------------------------------------------------------------------------
echo "[2/12] Node.js 20 LTS ve PM2 kuruluyor..."
NODE_MAJOR="$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0)"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "  → Node.js $(node -v) / npm $(npm -v)"
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

# ------------------------------------------------------------------------------
# 3. PostgreSQL 16 (Port 5444) & pgvector Kurulumu
# ------------------------------------------------------------------------------
echo "[3/12] PostgreSQL 16 (Port 5444) ve pgvector kuruluyor..."
apt-get install -y --no-install-recommends postgresql-16 postgresql-client-16
if apt-cache show postgresql-16-pgvector >/dev/null 2>&1; then
  apt-get install -y --no-install-recommends postgresql-16-pgvector
else
  echo "  [BİLGİ] Ubuntu deposunda postgresql-16-pgvector bulunamadı, PGDG deposu ekleniyor..."
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -y
  apt-get install -y --no-install-recommends postgresql-16-pgvector || true
fi

PG_CONF="$(find /etc/postgresql -name postgresql.conf 2>/dev/null | head -n 1 || true)"
if [[ -n "$PG_CONF" ]]; then
  sed -i -E 's/^#?\s*port\s*=\s*[0-9]+/port = 5444/' "$PG_CONF"
fi
systemctl enable postgresql
systemctl restart postgresql
sleep 2

# Tekrar çalıştırıldığında mevcut şifreyi koru
EXISTING_DB_PASS=""
if [[ -f "${PROJECT_DIR}/backend/.env" ]]; then
  EXISTING_DB_PASS="$(sed -nE 's|^DATABASE_URL=postgresql\+asyncpg://ai_pbx:([^@]+)@.*|\1|p' "${PROJECT_DIR}/backend/.env" | head -n 1 || true)"
fi
DB_PASS="${EXISTING_DB_PASS:-$(openssl rand -hex 18)}"

sudo -u postgres psql -p 5444 -tAc "SELECT 1 FROM pg_roles WHERE rolname='ai_pbx'" | grep -q 1 \
  && sudo -u postgres psql -p 5444 -c "ALTER USER ai_pbx WITH PASSWORD '${DB_PASS}';" \
  || sudo -u postgres psql -p 5444 -c "CREATE USER ai_pbx WITH PASSWORD '${DB_PASS}' SUPERUSER;"

sudo -u postgres psql -p 5444 -tAc "SELECT 1 FROM pg_database WHERE datname='ai_pbx'" | grep -q 1 \
  || sudo -u postgres psql -p 5444 -c "CREATE DATABASE ai_pbx OWNER ai_pbx;"

sudo -u postgres psql -p 5444 -d ai_pbx -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true

# ------------------------------------------------------------------------------
# 4. Nornia Uygulama Dosyalarının İndirilmesi (/opt/ai-project)
# ------------------------------------------------------------------------------
echo "[4/12] Nornia uygulama dosyaları /opt/ai-project dizinine kuruluyor..."
mkdir -p "$PROJECT_DIR"

if [[ -n "$BUNDLE_URL" ]]; then
  BUNDLE_TMP="/tmp/nornia-app-bundle.tar.gz"
  if [[ -f "$BUNDLE_URL" ]]; then
    echo "  → Yerel kurumsal paket açılıyor: ${BUNDLE_URL}"
    tar -xzf "$BUNDLE_URL" -C "$PROJECT_DIR"
  else
    echo "  → Nornia kurumsal paket indiriliyor..."
    if [[ -n "$BUNDLE_TOKEN" ]]; then
      curl -fsSL -H "Authorization: Bearer ${BUNDLE_TOKEN}" "$BUNDLE_URL" -o "$BUNDLE_TMP"
    else
      curl -fsSL "$BUNDLE_URL" -o "$BUNDLE_TMP"
    fi
    tar -xzf "$BUNDLE_TMP" -C "$PROJECT_DIR"
    rm -f "$BUNDLE_TMP"
  fi
else
  CLONE_URL="$REPO_URL"
  if [[ -n "$GIT_TOKEN" && "$REPO_URL" == https://* ]]; then
    CLONE_URL="https://x-access-token:${GIT_TOKEN}@${REPO_URL#https://}"
  fi

  if [[ -d "${PROJECT_DIR}/.git" ]]; then
    echo "  → Mevcut depo güncelleniyor (${BRANCH})..."
    git -C "$PROJECT_DIR" fetch "$CLONE_URL" "$BRANCH"
    git -C "$PROJECT_DIR" checkout "$BRANCH" 2>/dev/null || git -C "$PROJECT_DIR" checkout -b "$BRANCH" FETCH_HEAD
    git -C "$PROJECT_DIR" reset --hard FETCH_HEAD
  else
    if ! git clone --depth 1 --branch "$BRANCH" "$CLONE_URL" "$PROJECT_DIR"; then
      echo "[HATA] Özel kaynak deposuna erişilemedi." >&2
      echo "       Müşteri kurulumları için --bundle-url, yetkili ekip için --token <PAT> parametresi ile çalıştırın." >&2
      exit 1
    fi
    # Token'ı .git/config içine açık bırakma
    if [[ -n "$GIT_TOKEN" ]]; then
      git -C "$PROJECT_DIR" remote set-url origin "$REPO_URL"
    fi
  fi
fi

mkdir -p "${PROJECT_DIR}/recordings" "${PROJECT_DIR}/uploads" "${PROJECT_DIR}/backups" "${PROJECT_DIR}/network_backups"

# ------------------------------------------------------------------------------
# 5. Nornia Asterisk 18.11.3 (Cisco Patch + WebRTC SRTP + AudioSocket + Opus)
# ------------------------------------------------------------------------------
echo "[5/12] Nornia Asterisk 18.11.3 kuruluyor..."
AST_CACHE_DIR="/var/cache/nornia-online/debs"
mkdir -p "$AST_CACHE_DIR"

if command -v asterisk >/dev/null 2>&1 && [[ -f /usr/lib/asterisk/modules/app_audiosocket.so ]]; then
  echo "  [OK] AudioSocket destekli Nornia Asterisk zaten kurulu, derleme atlandı."
else
  AST_DEB_LOCAL=""
  if [[ -n "$ASTERISK_DEB_SRC" ]]; then
    if [[ -f "$ASTERISK_DEB_SRC" ]]; then
      AST_DEB_LOCAL="$ASTERISK_DEB_SRC"
    elif [[ "$ASTERISK_DEB_SRC" == http://* || "$ASTERISK_DEB_SRC" == https://* ]]; then
      AST_DEB_LOCAL="${AST_CACHE_DIR}/nornia-asterisk_18.11.3_amd64.deb"
      echo "  → Önceden derlenmiş Asterisk .deb indiriliyor..."
      curl -fsSL "$ASTERISK_DEB_SRC" -o "$AST_DEB_LOCAL"
    fi
  fi

  if [[ -z "$AST_DEB_LOCAL" || ! -f "$AST_DEB_LOCAL" ]]; then
    echo "  → Önceden derlenmiş .deb belirtilmedi; Asterisk 18.11.3 (Cisco + WebRTC SRTP + AudioSocket + Opus) kaynak koddan derleniyor..."
    bash "${PROJECT_DIR}/scripts/installer/build_asterisk_deb.sh" "$AST_CACHE_DIR"
    AST_DEB_LOCAL="$(find "$AST_CACHE_DIR" -maxdepth 1 -name "nornia-asterisk_*.deb" | head -n 1 || true)"
  fi

  if [[ -n "$AST_DEB_LOCAL" && -f "$AST_DEB_LOCAL" ]]; then
    if ! dpkg -i "$AST_DEB_LOCAL"; then
      apt-get install -f -y --no-install-recommends
      dpkg -i "$AST_DEB_LOCAL"
    fi
  else
    echo "[HATA] Nornia Asterisk .deb paketi kurulamadı." >&2
    exit 1
  fi
fi

# ------------------------------------------------------------------------------
# 6. Python Virtual Environment (/opt/ai-project/venv) & Bağımlılıklar
# ------------------------------------------------------------------------------
echo "[6/12] Python 3 venv ve tüm backend bağımlılıkları kuruluyor..."
if [[ ! -d "${PROJECT_DIR}/venv" ]]; then
  python3 -m venv "${PROJECT_DIR}/venv"
fi

"${PROJECT_DIR}/venv/bin/pip" install --upgrade pip setuptools wheel

REQ_COMBINED="/tmp/nornia_online_requirements.txt"
{
  [[ -f "${PROJECT_DIR}/requirements.txt" ]] && cat "${PROJECT_DIR}/requirements.txt"
  echo ""
  [[ -f "${PROJECT_DIR}/backend/requirements.txt" ]] && cat "${PROJECT_DIR}/backend/requirements.txt"
  echo ""
  echo "aiosqlite>=0.20.0"
  echo "cryptography>=42.0.0"
  echo "PyYAML>=6.0.0"
  echo "psutil>=6.0.0"
  echo "pyotp>=2.9.0"
  echo "psycopg[binary]>=3.1.0"
  echo "psycopg2-binary>=2.9.0"
  echo "uvicorn[standard]>=0.28.0"
  echo "python-dotenv>=1.0.0"
} | grep -Ev '^\s*(#|$)' | sort -u > "$REQ_COMBINED"

"${PROJECT_DIR}/venv/bin/pip" install -r "$REQ_COMBINED"
rm -f "$REQ_COMBINED"

# ------------------------------------------------------------------------------
# 7. Backend .env, settings.json (/setup Hazır) & Veritabanı Tablo İlklendirme
# ------------------------------------------------------------------------------
echo "[7/12] Backend yapılandırması ve PostgreSQL şeması hazırlanıyor..."
if [[ ! -f "${PROJECT_DIR}/backend/.env" ]]; then
  cat <<EOF > "${PROJECT_DIR}/backend/.env"
DATABASE_URL=postgresql+asyncpg://ai_pbx:${DB_PASS}@127.0.0.1:5444/ai_pbx
AMI_HOST=127.0.0.1
AMI_PORT=5038
AMI_USER=ai_backend_user
AMI_SECRET=backend_secure_key_99
EOF
  chmod 0600 "${PROJECT_DIR}/backend/.env"
fi

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
# 8. Frontend (Next.js) Bağımlılıkları & Üretim Derlemesi
# ------------------------------------------------------------------------------
echo "[8/12] Nornia Frontend (Next.js) bağımlılıkları kuruluyor ve derleniyor..."
cd "${PROJECT_DIR}/frontend"
if [[ -f package-lock.json ]]; then
  npm ci --no-audit --no-fund || npm install --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi
NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS="--max-old-space-size=3072" npm run build
cd "$PROJECT_DIR"

# ------------------------------------------------------------------------------
# 9. Asterisk Konfigürasyonu, AMI (5038) & WebRTC SSL Sertifikası (8089)
# ------------------------------------------------------------------------------
echo "[9/12] Asterisk modüler konfigürasyonu ve WebRTC TLS sertifikası hazırlanıyor..."
mkdir -p /etc/asterisk/keys /var/spool/asterisk/monitor /var/run/asterisk /var/log/asterisk

if [[ ! -f /etc/asterisk/keys/asterisk.pem ]]; then
  openssl req -new -x509 -days 3650 -nodes \
    -out /etc/asterisk/keys/asterisk.crt \
    -keyout /etc/asterisk/keys/asterisk.key \
    -subj "/C=TR/ST=Istanbul/L=Istanbul/O=Nornia/CN=$(hostname)"
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
maxcalls = 1000
maxload = 100.0
maxfiles = 65535
EOF

cat <<'EOF' > /etc/asterisk/manager.conf
[general]
enabled = yes
port = 5038
bindaddr = 127.0.0.1

[ai_backend_user]
secret = backend_secure_key_99
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

touch /etc/asterisk/pjsip_custom.conf /etc/asterisk/extensions_custom.conf /etc/asterisk/queues_custom.conf /etc/asterisk/features_custom.conf
chown -R asterisk:asterisk /etc/asterisk /var/lib/asterisk /var/spool/asterisk /var/log/asterisk /var/run/asterisk
chmod -R 775 /etc/asterisk /var/run/asterisk
chmod 644 /etc/asterisk/keys/asterisk.pem

"${PROJECT_DIR}/venv/bin/python" "${PROJECT_DIR}/backend/scripts/sync_asterisk.py" || true
systemctl enable asterisk 2>/dev/null || true
systemctl restart asterisk 2>/dev/null || true

# ------------------------------------------------------------------------------
# 10. Nginx Reverse Proxy (HTTP 80 + Self-Signed HTTPS 443)
# ------------------------------------------------------------------------------
echo "[10/12] Nginx Reverse Proxy yapılandırılıyor..."
mkdir -p /etc/nginx/ssl
if [[ ! -f /etc/nginx/ssl/nornia.crt ]]; then
  openssl req -new -x509 -days 3650 -nodes \
    -out /etc/nginx/ssl/nornia.crt \
    -keyout /etc/nginx/ssl/nornia.key \
    -subj "/C=TR/ST=Istanbul/L=Istanbul/O=Nornia/CN=$(hostname)"
fi

cat <<'EOF' > /etc/nginx/sites-available/nornia
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;

    ssl_certificate     /etc/nginx/ssl/nornia.crt;
    ssl_certificate_key /etc/nginx/ssl/nornia.key;

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
# 11. Sistem Hesapları ('nornia' + Kısıtlı 'destek'), SSH & Konsol Servisleri
# ------------------------------------------------------------------------------
echo "[11/12] Sistem hesapları, SSH güvenliği ve konsol araçları yapılandırılıyor..."
if [[ -f "${PROJECT_DIR}/backend/scripts/nornia_destek_ops.py" && -f "${PROJECT_DIR}/backend/scripts/nornia_destek_shell.py" ]]; then
  mkdir -p /usr/local/lib/nornia
  cp "${PROJECT_DIR}/backend/scripts/nornia_destek_ops.py" /usr/local/lib/nornia/nornia_destek_ops.py
  cp "${PROJECT_DIR}/backend/scripts/nornia_destek_shell.py" /usr/local/bin/nornia-destek-shell
  chown root:root /usr/local/lib/nornia/nornia_destek_ops.py /usr/local/bin/nornia-destek-shell
  chmod 0755 /usr/local/lib/nornia/nornia_destek_ops.py /usr/local/bin/nornia-destek-shell
  grep -qxF "/usr/local/bin/nornia-destek-shell" /etc/shells || echo "/usr/local/bin/nornia-destek-shell" >> /etc/shells

  if ! id -u "$DESTEK_USER" >/dev/null 2>&1; then
    useradd -m -s /usr/local/bin/nornia-destek-shell "$DESTEK_USER"
  else
    usermod -s /usr/local/bin/nornia-destek-shell "$DESTEK_USER"
  fi
  echo "${DESTEK_USER}:${DESTEK_PASS}" | chpasswd

  cat <<'EOF' > /etc/sudoers.d/nornia-destek
Defaults:destek !requiretty, env_reset, secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
destek ALL=(root) NOPASSWD: /usr/local/lib/nornia/nornia_destek_ops.py *
EOF
  chmod 0440 /etc/sudoers.d/nornia-destek
  visudo -cf /etc/sudoers.d/nornia-destek
fi

if ! id -u "$SYSADMIN_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash -G sudo "$SYSADMIN_USER"
else
  usermod -aG sudo "$SYSADMIN_USER"
fi
echo "${SYSADMIN_USER}:${SYSADMIN_PASS}" | chpasswd
chmod 0750 "${PROJECT_DIR}/backend" 2>/dev/null || true

if [[ "$SKIP_SSH_CONFIG" != "1" ]]; then
  ROOT_SSH_MODE="prohibit-password"
  if [[ "$LOCK_ROOT_SSH" == "1" ]]; then
    ROOT_SSH_MODE="no"
  fi
  mkdir -p /etc/ssh/sshd_config.d
  cat <<EOF > /etc/ssh/sshd_config.d/50-nornia.conf
PermitRootLogin ${ROOT_SSH_MODE}
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
  if sshd -t; then
    systemctl enable ssh 2>/dev/null || systemctl enable sshd 2>/dev/null || true
    systemctl restart ssh 2>/dev/null || systemctl restart ssh.socket 2>/dev/null || systemctl restart sshd 2>/dev/null || true
  fi
fi

# TTY1 Canlı Konsol Panosu Servisi
if [[ -f "${PROJECT_DIR}/backend/scripts/nornia_console.py" ]]; then
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
  systemctl daemon-reload
  systemctl enable nornia-console-banner.service
  systemctl restart nornia-console-banner.service || true
  python3 "${PROJECT_DIR}/backend/scripts/nornia_console.py" --write-issue || true
fi

# ------------------------------------------------------------------------------
# 12. PM2 Servisleri, UFW Güvenlik Duvarı & Canlı Sağlık Doğrulaması
# ------------------------------------------------------------------------------
echo "[12/12] PM2 servisleri, UFW güvenlik duvarı ve canlı sağlık testleri başlatılıyor..."

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
      args: "backend.main:app --host 0.0.0.0 --port 8000",
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

cd "$PROJECT_DIR"
pm2 startOrReload "${PROJECT_DIR}/ecosystem.config.js" || pm2 start "${PROJECT_DIR}/ecosystem.config.js"
pm2 save --force
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
pm2 save --force
pm2 kill >/dev/null 2>&1 || true
systemctl daemon-reload
systemctl enable pm2-root.service 2>/dev/null || true
systemctl restart pm2-root.service 2>/dev/null || true

if [[ "$SKIP_UFW" != "1" ]]; then
  ufw default deny incoming >/dev/null 2>&1 || true
  ufw default allow outgoing >/dev/null 2>&1 || true
  ufw allow 22/tcp comment 'SSH' >/dev/null 2>&1 || true
  ufw allow 80/tcp comment 'HTTP' >/dev/null 2>&1 || true
  ufw allow 443/tcp comment 'HTTPS' >/dev/null 2>&1 || true
  ufw allow 5060/udp comment 'SIP UDP' >/dev/null 2>&1 || true
  ufw allow 5060/tcp comment 'SIP TCP' >/dev/null 2>&1 || true
  ufw allow 5061/tcp comment 'SIP TLS' >/dev/null 2>&1 || true
  ufw allow 5160/tcp comment 'Cisco Enterprise SIP TCP' >/dev/null 2>&1 || true
  ufw allow 8089/tcp comment 'WebRTC WSS' >/dev/null 2>&1 || true
  ufw allow 10000:20000/udp comment 'RTP Media' >/dev/null 2>&1 || true
  ufw --force enable >/dev/null 2>&1 || true
fi

systemctl enable fail2ban chrony 2>/dev/null || true
systemctl restart fail2ban chrony 2>/dev/null || true

# Kısa sağlık doğrulaması
sleep 4
SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
BACKEND_OK="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/api/version || echo 000)"
FRONTEND_OK="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || echo 000)"
AST_OK="$(systemctl is-active asterisk 2>/dev/null || echo inactive)"
PG_OK="$(systemctl is-active postgresql 2>/dev/null || echo inactive)"

echo "======================================================================"
echo "  NORNIA UBUNTU 24.04 ÇEVRİMİÇİ KURULUM BAŞARIYLA TAMAMLANDI!"
echo "----------------------------------------------------------------------"
echo "  Servis Doğrulama:"
echo "    • PostgreSQL 16 (5444) : ${PG_OK}"
echo "    • Asterisk 18 (PJSIP)  : ${AST_OK}"
echo "    • Backend API (8000)   : HTTP ${BACKEND_OK}"
echo "    • Frontend UI (3000)   : HTTP ${FRONTEND_OK}"
echo "----------------------------------------------------------------------"
echo "  Erişim & Hesap Bilgileri:"
echo "    • İlk Kurulum Sihirbazı: http://${SERVER_IP}/setup"
echo "    • Yönetim SSH Hesabı   : ${SYSADMIN_USER}"
echo "    • Kısıtlı Destek Hesabı: ${DESTEK_USER} (Ağ & IP konsolu)"
echo "    • Kurulum Logu         : ${LOG_FILE}"
echo "======================================================================"
