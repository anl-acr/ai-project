#!/usr/bin/env bash
# ==============================================================================
# NORNIA CONNECT HUB & CENTRAL LICENSE SERVER — UBUNTU 24.04 LTS KURULUM SİHİRBAZI
# ==============================================================================
# Bu script Ubuntu 22.04 / 24.04 LTS sunucu üzerinde:
#   1. Merkezi Lisans Otoritesi API & Nornia Connect Tünel Sunucusu (Port 8050)
#   2. Merkezi Lisans & Filo Yönetim Web Konsolu (Port 3050)
#   3. WebRTC / Mobil Çift Yönlü Ses Rölesi (Coturn TURN Server - Port 3478)
#   4. Nginx HTTPS / WSS Ters Proxy (Port 80 & 443 -> 8050)
#   5. PM2 Süreç Yöneticisi ve Otomatik Başlatma (systemd)
# kurulumlarını tek komutla tamamlar.
# ==============================================================================

set -e

echo "========================================================================"
echo "   NORNIA CONNECT HUB & MERKEZİ LİSANS SUNUCUSU KURULUMU (Ubuntu 24.04)"
echo "========================================================================"

if [ "$EUID" -ne 0 ]; then
  echo "Lütfen bu scripti root yetkisiyle çalıştırın: sudo bash $0"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

# 1. Temel Sistem Paketlerinin Kurulumu
echo "[1/6] Sistem paketleri (Python3, Nginx, Coturn, Git, OpenSSL) yükleniyor..."
apt-get update -y
apt-get install -y curl wget git build-essential python3 python3-venv python3-pip \
  nginx coturn openssl ca-certificates gnupg lsof

# 2. Node.js 20 LTS ve PM2 Kurulumu
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -qE "v(18|20|22)"; then
  echo "[2/6] Node.js 20 LTS kuruluyor..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "[2/6] Node.js zaten kurulu: $(node -v)"
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

# 3. Proje Dizinini Hazırlama (/opt/ai-project)
INSTALL_DIR="/opt/ai-project"
if [ ! -d "$INSTALL_DIR/.git" ]; then
  echo "[3/6] Nornia kaynak kodu /opt/ai-project dizinine indiriliyor..."
  git clone https://github.com/anl-acr/ai-project.git "$INSTALL_DIR"
else
  echo "[3/6] Mevcut /opt/ai-project deposu güncelleniyor..."
  cd "$INSTALL_DIR" && git pull origin main
fi

cd "$INSTALL_DIR"

# 4. Python Sanal Ortamı (venv) ve Bağımlılıklar
echo "[4/6] Python sanal ortamı (venv) ve Nornia Connect Hub kütüphaneleri kuruluyor..."
if [ ! -d "$INSTALL_DIR/venv" ]; then
  python3 -m venv "$INSTALL_DIR/venv"
fi

"$INSTALL_DIR/venv/bin/pip" install --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install \
  "fastapi>=0.100.0" \
  "uvicorn[standard]>=0.22.0" \
  "sqlalchemy>=2.0.0" \
  "aiosqlite>=0.19.0" \
  "pydantic>=2.0.0" \
  "httpx>=0.24.0" \
  "websockets>=11.0" \
  "python-multipart>=0.0.6" \
  "requests>=2.31.0"

# 5. Coturn (WebRTC TURN Ses Rölesi) Yapılandırması (Port 3478)
echo "[5/6] WebRTC & Mobil Ses Rölesi (Coturn TURN Server - Port 3478) yapılandırılıyor..."
LOCAL_IP=$(hostname -I | awk '{print $1}')
PUBLIC_IP=$(curl -s --max-time 4 https://api.ipify.org || echo "$LOCAL_IP")

sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/g' /etc/default/coturn 2>/dev/null || true

cat <<EOT > /etc/turnserver.conf
listening-port=3478
fingerprint
lt-cred-mech
user=nornia:nornia_turn_secret_2026
realm=nornia.connect
external-ip=${PUBLIC_IP}/${LOCAL_IP}
min-port=49152
max-port=65535
no-cli
no-tlsv1
no-tlsv1_1
EOT

systemctl enable coturn || true
systemctl restart coturn || true

# 6. Merkezi Lisans Konsolu Frontend Build & PM2 Servislerinin Başlatılması
echo "[6/6] Merkezi Lisans & Nornia Connect arayüzü derleniyor ve PM2 servisleri başlatılıyor..."
cd "$INSTALL_DIR/license_center/frontend"
npm install
npm run build

# PM2 üzerinde Nornia Connect Hub Backend (8050) ve Master Web UI (3050) başlatma
pm2 delete nornia-connect-hub >/dev/null 2>&1 || true
pm2 delete nornia-license-ui >/dev/null 2>&1 || true

cat <<'EOBACK' > "$INSTALL_DIR/scripts/run_hub_backend.sh"
#!/usr/bin/env bash
cd /opt/ai-project
exec /opt/ai-project/venv/bin/python -m uvicorn license_center.backend.main:app --host 0.0.0.0 --port 8050
EOBACK
chmod +x "$INSTALL_DIR/scripts/run_hub_backend.sh"

cat <<'EOFRONT' > "$INSTALL_DIR/scripts/run_hub_frontend.sh"
#!/usr/bin/env bash
cd /opt/ai-project/license_center/frontend
exec npm run start
EOFRONT
chmod +x "$INSTALL_DIR/scripts/run_hub_frontend.sh"

pm2 start "$INSTALL_DIR/scripts/run_hub_backend.sh" --name "nornia-connect-hub"
pm2 start "$INSTALL_DIR/scripts/run_hub_frontend.sh" --name "nornia-license-ui"

pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# Nginx Reverse Proxy (Port 80 & 443 -> 127.0.0.1:8050 Nornia Connect Tünel Kapısı)
mkdir -p /etc/nginx/ssl
if [ ! -f /etc/nginx/ssl/nornia_connect.crt ]; then
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nornia_connect.key \
    -out /etc/nginx/ssl/nornia_connect.crt \
    -subj "/C=TR/ST=Istanbul/L=Istanbul/O=NorniaConnect/CN=${PUBLIC_IP}" >/dev/null 2>&1
fi

cat <<'EONGINX' > /etc/nginx/sites-available/nornia_connect_hub
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    listen 443 ssl;
    server_name _;

    ssl_certificate /etc/nginx/ssl/nornia_connect.crt;
    ssl_certificate_key /etc/nginx/ssl/nornia_connect.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:8050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $http_host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EONGINX

ln -sf /etc/nginx/sites-available/nornia_connect_hub /etc/nginx/sites-enabled/nornia_connect_hub
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

echo ""
echo "========================================================================"
echo " ✅ NORNIA CONNECT HUB & MERKEZİ LİSANS SUNUCUSU BAŞARIYLA KURULDU!"
echo "========================================================================"
echo " 🌐 Merkezi Lisans Yönetim Paneli : http://${LOCAL_IP}:3050"
echo "    (Varsayılan Giriş             : admin / admin123)"
echo ""
echo " 🔗 Nornia Connect Tünel Kapısı   : http://${LOCAL_IP}:8050"
echo " 🔒 HTTPS / WSS Tünel Kapısı      : https://${LOCAL_IP}"
echo " 🎧 WebRTC TURN Ses Rölesi        : turn:${LOCAL_IP}:3478 (Kullanıcı: nornia)"
echo "------------------------------------------------------------------------"
echo " 📌 SANTRALDE YAPILACAK İŞLEM:"
echo " Santral arayüzünde (Sistem Ayarları -> Nornia Connect) veya konsolda:"
echo " sudo python3 /opt/ai-project/backend/scripts/network_recovery.py --set-connect http://${LOCAL_IP}:8050 merkez"
echo "========================================================================"
