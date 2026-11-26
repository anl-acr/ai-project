#!/usr/bin/env bash
# ==============================================================================
# NORNIA MIDGARD — Tek Sunucu Tam SIP-HA (Kamailio + RTPEngine + 2x Asterisk)
# Sürüm: v3.12.0 | Mimari: Edition 2 (Nornia Midgard)
#
# Kullanım:
#   İlk Kurulum : sudo bash scripts/ha/install_nornia_midgard.sh --domain pbx.firma.com --ip 203.0.113.10
#   Zero-Downtime Güncelleme : sudo bash scripts/ha/install_nornia_midgard.sh --update
#   Air-Gapped ISO Kurulumu  : sudo bash scripts/ha/install_nornia_midgard.sh --offline --images-tar /opt/nornia-offline/images.tar.gz
# ==============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; AMBER='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}[Nornia Midgard]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${AMBER}[UYARI]${NC} $*"; }
err()  { echo -e "${RED}[HATA]${NC} $*" >&2; exit 1; }

PROJECT_ROOT="${NORNIA_PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
HA_DIR="${PROJECT_ROOT}/deploy/ha"
COMPOSE_FILE="${HA_DIR}/docker-compose.midgard.yml"
ENV_FILE="${HA_DIR}/.env"
CERTS_DIR="/etc/nornia/certs"
AST2_ETC="/etc/nornia/asterisk-2"

DOMAIN="${NORNIA_DOMAIN:-}"
PUBLIC_IP="${PUBLIC_IP:-}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
MODE="install"
OFFLINE=0
IMAGES_TAR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)            DOMAIN="$2"; shift 2 ;;
    --ip)                PUBLIC_IP="$2"; shift 2 ;;
    --email)             LETSENCRYPT_EMAIL="$2"; shift 2 ;;
    --update)            MODE="update"; shift ;;
    --offline)           OFFLINE=1; shift ;;
    --images-tar)        IMAGES_TAR="$2"; shift 2 ;;
    -h|--help)
      echo "Kullanım: sudo $0 [--domain pbx.firma.com] [--ip 1.2.3.4] [--email admin@firma.com] [--update] [--offline --images-tar /path/images.tar.gz]"
      exit 0 ;;
    *) err "Bilinmeyen parametre: $1" ;;
  esac
done

[[ $EUID -eq 0 ]] || err "Bu script root yetkisiyle (sudo) çalıştırılmalıdır."

# ------------------------------------------------------------------------------
# ZERO-DOWNTIME ROLLING UPDATE MODU (Backend + Frontend + 2x Asterisk sırayla!)
# ------------------------------------------------------------------------------
if [[ "$MODE" == "update" ]]; then
  log "Nornia Midgard Zero-Downtime Rolling Update başlatılıyor..."
  [[ -f "$ENV_FILE" ]] || err ".env dosyası bulunamadı: $ENV_FILE"
  cd "$HA_DIR"

  if [[ "$OFFLINE" -eq 0 && -d "${PROJECT_ROOT}/.git" ]]; then
    git -C "$PROJECT_ROOT" pull --ff-only || warn "git pull atlandı."
  fi

  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build nornia-backend-1 nornia-frontend-1 nornia-asterisk-1

  for pair in "nornia-backend-1:nornia-frontend-1" "nornia-backend-2:nornia-frontend-2"; do
    b_svc="${pair%%:*}"
    f_svc="${pair##*:}"
    log ">>> ${b_svc} & ${f_svc} güncelleniyor..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps --force-recreate "$b_svc" "$f_svc"
    for _i in $(seq 1 30); do
      if docker exec "$b_svc" curl -fsS http://127.0.0.1:8000/api/system/ready >/dev/null 2>&1; then
        ok "${b_svc} READY!"
        break
      fi
      sleep 2
    done
  done

  log ">>> 2x Asterisk Media Node sırayla güncelleniyor (Kamailio trafiği ayaktaki düğüme aktarır)..."
  for ast_svc in nornia-asterisk-1 nornia-asterisk-2; do
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps --force-recreate "$ast_svc"
    sleep 8
    ok "${ast_svc} yeniden başlatıldı ve Kamailio havuzuna döndü."
  done

  ok "Nornia Midgard Zero-Downtime Rolling Update tamamlandı!"
  exit 0
fi

# ------------------------------------------------------------------------------
# 1. DONANIM KONTROLÜ & DOCKER KURULUMU
# ------------------------------------------------------------------------------
log "=== NORNIA MIDGARD (Tek Sunucu Tam SIP-HA: Kamailio + RTPEngine + 2x Asterisk) ==="
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
CPU_CORES=$(nproc)
log "Donanım algılandı: ${CPU_CORES} vCPU | ${TOTAL_RAM_MB} MB RAM"
if [[ "$TOTAL_RAM_MB" -lt 11000 ]]; then
  warn "Nornia Midgard için minimum 12 GB RAM önerilir (mevcut: ${TOTAL_RAM_MB} MB)."
fi

if ! command -v docker >/dev/null 2>&1; then
  [[ "$OFFLINE" -eq 0 ]] || err "Offline kurulumda Docker önceden yüklü olmalıdır."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release openssl ufw
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi

# ------------------------------------------------------------------------------
# 2. TLS SERTİFİKA + KAMAILIO TLS.CFG + ASTERISK-2 İZOLASYONU
# ------------------------------------------------------------------------------
[[ -n "$PUBLIC_IP" ]] || PUBLIC_IP=$(hostname -I | awk '{print $1}')
[[ -n "$DOMAIN" ]]    || DOMAIN="${PUBLIC_IP}"

mkdir -p "$CERTS_DIR" "$AST2_ETC"
PEM_PATH="${CERTS_DIR}/nornia.pem"

if [[ -n "$LETSENCRYPT_EMAIL" && "$OFFLINE" -eq 0 && "$DOMAIN" != "$PUBLIC_IP" ]]; then
  apt-get install -y -qq certbot || true
  certbot certonly --standalone --non-interactive --agree-tos -m "$LETSENCRYPT_EMAIL" -d "$DOMAIN" || true
  if [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
    cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "${CERTS_DIR}/fullchain.pem"
    cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" "${CERTS_DIR}/privkey.pem"
    cat "${CERTS_DIR}/fullchain.pem" "${CERTS_DIR}/privkey.pem" > "$PEM_PATH"
    cp "$PEM_PATH" "${CERTS_DIR}/asterisk.pem"
    chmod 644 "${CERTS_DIR}"/*.pem
  fi
fi

if [[ ! -f "$PEM_PATH" ]]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
    -keyout "${CERTS_DIR}/privkey.pem" \
    -out "${CERTS_DIR}/fullchain.pem" \
    -subj "/CN=${DOMAIN}/O=Nornia Midgard SIP-HA" >/dev/null 2>&1
  cat "${CERTS_DIR}/fullchain.pem" "${CERTS_DIR}/privkey.pem" > "$PEM_PATH"
  cp "$PEM_PATH" "${CERTS_DIR}/asterisk.pem"
  chmod 644 "${CERTS_DIR}"/*.pem
fi

# Kamailio tls.cfg (WSS 8089 TLS termination)
cat > "${CERTS_DIR}/tls.cfg" <<EOF
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

# Asterisk-2 port izolasyonu (SIP :5064, AMI :5039)
cat > "${AST2_ETC}/manager_custom.conf" <<EOF
[general]
enabled = yes
port = 5039
bindaddr = 0.0.0.0
EOF

cat > "${AST2_ETC}/pjsip_midgard_port.conf" <<EOF
[transport-udp-ast2]
type=transport
protocol=udp
bind=127.0.0.1:5064

[transport-tcp-ast2]
type=transport
protocol=tcp
bind=127.0.0.1:5064
EOF

# ------------------------------------------------------------------------------
# 3. GÜVENLİ .env DOSYASI
# ------------------------------------------------------------------------------
if [[ ! -f "$ENV_FILE" ]]; then
  PG_PASS=$(openssl rand -hex 16)
  RD_PASS=$(openssl rand -hex 16)
  S3_PASS=$(openssl rand -hex 16)
  AMI_SEC=$(openssl rand -hex 16)
  SESS_SEC=$(openssl rand -hex 32)
  INT_TOK=$(openssl rand -hex 32)
  cat > "$ENV_FILE" <<EOF
NORNIA_EDITION=midgard
NORNIA_VERSION=3.12.0
NORNIA_DOMAIN=${DOMAIN}
PUBLIC_IP=${PUBLIC_IP}
NORNIA_CERTS_DIR=${CERTS_DIR}
NORNIA_MIDGARD_AST2_ETC=${AST2_ETC}
HOST_GATEWAY_IP=172.29.0.1

POSTGRES_USER=pbx_user
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_DB=ai_pbx

REDIS_PASSWORD=${RD_PASS}

MINIO_ROOT_USER=nornia_s3
MINIO_ROOT_PASSWORD=${S3_PASS}
S3_BUCKET=nornia-recordings

AMI_USER=ai_backend_user
AMI_SECRET=${AMI_SEC}
NORNIA_SESSION_SECRET=${SESS_SEC}
NORNIA_INTERNAL_API_TOKEN=${INT_TOK}
EOF
  chmod 600 "$ENV_FILE"
fi

# ------------------------------------------------------------------------------
# 4. FIREWALL (Kamailio + RTPEngine 20000-30000/udp + HAProxy)
# ------------------------------------------------------------------------------
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw allow 8089/tcp >/dev/null 2>&1 || true
  ufw allow 5060/udp >/dev/null 2>&1 || true
  ufw allow 5060/tcp >/dev/null 2>&1 || true
  ufw allow 5061/tcp >/dev/null 2>&1 || true
  ufw allow 20000:30000/udp >/dev/null 2>&1 || true
fi

# ------------------------------------------------------------------------------
# 5. KURULUM & BAŞLATMA
# ------------------------------------------------------------------------------
cd "$HA_DIR"
if [[ "$OFFLINE" -eq 1 && -n "$IMAGES_TAR" && -f "$IMAGES_TAR" ]]; then
  log "Air-gapped Midgard Docker imajları yükleniyor..."
  gunzip -c "$IMAGES_TAR" | docker load
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-build
else
  log "Nornia Midgard tam SIP-HA yığını derleniyor ve başlatılıyor..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
fi

log "Derin sağlık kontrolü (/api/system/ready) & Kamailio Dispatcher doğrulanıyor..."
for _i in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:8000/api/system/ready >/dev/null 2>&1; then
    ok "NORNIA MIDGARD TAM SIP-HA KURULUMU BAŞARILI!"
    echo ""
    echo -e "  ${GREEN}Web Panel (HTTPS)      :${NC} https://${DOMAIN}"
    echo -e "  ${GREEN}Kamailio WebRTC WSS    :${NC} wss://${DOMAIN}:8089/ws"
    echo -e "  ${GREEN}Kamailio SIP Edge      :${NC} ${PUBLIC_IP}:5060 (UDP/TCP -> 2x Asterisk :5062/:5064)"
    echo -e "  ${GREEN}RTPEngine Medya Aralığı:${NC} UDP 20000-30000"
    echo -e "  ${GREEN}HAProxy Live Stats     :${NC} http://127.0.0.1:8404/haproxy-stats"
    echo -e "  ${GREEN}MinIO S3 Console       :${NC} http://127.0.0.1:9001"
    exit 0
  fi
  sleep 3
done
warn "Konteynerler açıldı; logları kontrol ediniz: docker compose -f ${COMPOSE_FILE} logs -f"
