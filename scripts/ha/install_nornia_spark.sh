#!/usr/bin/env bash
# ==============================================================================
# NORNIA SPARK — Tek Sunucu Always-Up Docker HA Kurulum & Rolling Update Scripti
# Sürüm: v3.12.0 | Mimari: Edition 1 (Nornia Spark)
#
# Kullanım:
#   İlk Kurulum : sudo bash scripts/ha/install_nornia_spark.sh --domain pbx.firma.com --ip 203.0.113.10
#   Zero-Downtime Güncelleme : sudo bash scripts/ha/install_nornia_spark.sh --update
#   Air-Gapped ISO Kurulumu  : sudo bash scripts/ha/install_nornia_spark.sh --offline --images-tar /opt/nornia-offline/images.tar.gz
# ==============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; AMBER='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}[Nornia Spark]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${AMBER}[UYARI]${NC} $*"; }
err()  { echo -e "${RED}[HATA]${NC} $*" >&2; exit 1; }

PROJECT_ROOT="${NORNIA_PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
HA_DIR="${PROJECT_ROOT}/deploy/ha"
COMPOSE_FILE="${HA_DIR}/docker-compose.spark.yml"
ENV_FILE="${HA_DIR}/.env"
CERTS_DIR="/etc/nornia/certs"

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
# ZERO-DOWNTIME ROLLING UPDATE MODU (Mevcut çalışan çağrıları ve oturumları kesmeden)
# ------------------------------------------------------------------------------
if [[ "$MODE" == "update" ]]; then
  log "Nornia Spark Zero-Downtime Rolling Update başlatılıyor..."
  [[ -f "$ENV_FILE" ]] || err ".env dosyası bulunamadı: $ENV_FILE"
  cd "$HA_DIR"

  if [[ "$OFFLINE" -eq 0 && -d "${PROJECT_ROOT}/.git" ]]; then
    log "Git deposu güncelleniyor..."
    git -C "$PROJECT_ROOT" pull --ff-only || warn "git pull atlandı (yerel değişiklik olabilir)."
  fi

  log "Yeni backend ve frontend imajları derleniyor (canlı trafik kesilmeden)..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build nornia-backend-1 nornia-frontend-1

  for pair in "nornia-backend-1:nornia-frontend-1" "nornia-backend-2:nornia-frontend-2"; do
    b_svc="${pair%%:*}"
    f_svc="${pair##*:}"
    log ">>> ${b_svc} & ${f_svc} sırayla güncelleniyor (diğer çift tüm canlı trafiği taşır)..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps --force-recreate "$b_svc" "$f_svc"
    log "${b_svc} /api/system/ready sağlık kontrolü bekleniyor..."
    for _i in $(seq 1 30); do
      if docker exec "$b_svc" curl -fsS http://127.0.0.1:8000/api/system/ready >/dev/null 2>&1; then
        ok "${b_svc} READY (HTTP 200) — HAProxy trafiği tekrar açtı!"
        break
      fi
      sleep 2
    done
  done

  ok "Nornia Spark sıfır kesintili (Zero-Downtime) güncelleme tamamlandı!"
  exit 0
fi

# ------------------------------------------------------------------------------
# 1. SİSTEM KONTROLÜ & DOCKER KURULUMU
# ------------------------------------------------------------------------------
log "=== NORNIA SPARK (Tek Sunucu Always-Up Docker HA) KURULUMU BAŞLIYOR ==="
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
CPU_CORES=$(nproc)
log "Donanım algılandı: ${CPU_CORES} vCPU | ${TOTAL_RAM_MB} MB RAM"
if [[ "$TOTAL_RAM_MB" -lt 7000 ]]; then
  warn "Nornia Spark için minimum 8 GB RAM önerilir (mevcut: ${TOTAL_RAM_MB} MB)."
fi

if ! command -v docker >/dev/null 2>&1; then
  if [[ "$OFFLINE" -eq 1 ]]; then
    err "Offline kurulumda Docker Engine önceden kurulu olmalıdır (ISO Autoinstall otomatik kurar)."
  fi
  log "Docker Engine + Compose v2 kuruluyor..."
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
ok "Docker hazır: $(docker --version)"

# ------------------------------------------------------------------------------
# 2. AĞ, DOMAIN & TLS SERTİFİKA HAZIRLIĞI
# ------------------------------------------------------------------------------
if [[ -z "$PUBLIC_IP" ]]; then
  PUBLIC_IP=$(hostname -I | awk '{print $1}')
fi
if [[ -z "$DOMAIN" ]]; then
  DOMAIN="${PUBLIC_IP}"
fi

mkdir -p "$CERTS_DIR"
PEM_PATH="${CERTS_DIR}/nornia.pem"

if [[ -n "$LETSENCRYPT_EMAIL" && "$OFFLINE" -eq 0 && "$DOMAIN" != "$PUBLIC_IP" ]]; then
  log "Let's Encrypt TLS sertifikası alınıyor: ${DOMAIN}"
  apt-get install -y -qq certbot || true
  certbot certonly --standalone --non-interactive --agree-tos -m "$LETSENCRYPT_EMAIL" -d "$DOMAIN" || true
  if [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
    cat "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" > "$PEM_PATH"
    cp "$PEM_PATH" "${CERTS_DIR}/asterisk.pem"
    chmod 644 "$PEM_PATH" "${CERTS_DIR}/asterisk.pem"
    ok "Let's Encrypt sertifikası hazırlandı."
  fi
fi

if [[ ! -f "$PEM_PATH" ]]; then
  log "Self-signed TLS sertifikası üretiliyor (${DOMAIN})..."
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
    -keyout "${CERTS_DIR}/privkey.pem" \
    -out "${CERTS_DIR}/fullchain.pem" \
    -subj "/CN=${DOMAIN}/O=Nornia Enterprise PBX" >/dev/null 2>&1
  cat "${CERTS_DIR}/fullchain.pem" "${CERTS_DIR}/privkey.pem" > "$PEM_PATH"
  cp "$PEM_PATH" "${CERTS_DIR}/asterisk.pem"
  chmod 644 "$PEM_PATH" "${CERTS_DIR}/asterisk.pem"
  ok "TLS sertifikası oluşturuldu: ${PEM_PATH}"
fi

# ------------------------------------------------------------------------------
# 3. GÜVENLİ .env DOSYASI OLUŞTURMA
# ------------------------------------------------------------------------------
if [[ ! -f "$ENV_FILE" ]]; then
  log "Kriptografik parolalarla ${ENV_FILE} oluşturuluyor..."
  PG_PASS=$(openssl rand -hex 16)
  RD_PASS=$(openssl rand -hex 16)
  S3_PASS=$(openssl rand -hex 16)
  AMI_SEC=$(openssl rand -hex 16)
  SESS_SEC=$(openssl rand -hex 32)
  INT_TOK=$(openssl rand -hex 32)
  cat > "$ENV_FILE" <<EOF
NORNIA_EDITION=spark
NORNIA_VERSION=3.12.0
NORNIA_DOMAIN=${DOMAIN}
PUBLIC_IP=${PUBLIC_IP}
NORNIA_CERTS_DIR=${CERTS_DIR}
HOST_GATEWAY_IP=172.28.0.1

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
  ok ".env oluşturuldu (0600)."
else
  ok "Mevcut .env korunuyor: ${ENV_FILE}"
fi

# ------------------------------------------------------------------------------
# 4. FIREWALL (UFW) KURALLARI
# ------------------------------------------------------------------------------
if command -v ufw >/dev/null 2>&1; then
  log "Güvenlik duvarı portları yapılandırılıyor (80, 443, 5060, 5061, 8089, 10000-20000/udp)..."
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw allow 8089/tcp >/dev/null 2>&1 || true
  ufw allow 5060/udp >/dev/null 2>&1 || true
  ufw allow 5060/tcp >/dev/null 2>&1 || true
  ufw allow 5061/tcp >/dev/null 2>&1 || true
  ufw allow 10000:20000/udp >/dev/null 2>&1 || true
fi

# ------------------------------------------------------------------------------
# 5. OFFLINE İMAJ YÜKLEME VEYA DERLEME & BAŞLATMA
# ------------------------------------------------------------------------------
cd "$HA_DIR"
if [[ "$OFFLINE" -eq 1 && -n "$IMAGES_TAR" && -f "$IMAGES_TAR" ]]; then
  log "Air-gapped Docker imajları yükleniyor: ${IMAGES_TAR}"
  gunzip -c "$IMAGES_TAR" | docker load
  ok "Tüm offline imajlar Docker motoruna yüklendi."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-build
else
  log "Nornia Spark konteynerleri derleniyor ve başlatılıyor..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
fi

# ------------------------------------------------------------------------------
# 6. DERİN SAĞLIK KONTROLÜ (/api/system/ready)
# ------------------------------------------------------------------------------
log "Nornia Spark HA kümesi sağlık kontrolleri doğrulanıyor..."
READY_OK=0
for _i in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:8000/api/system/ready >/dev/null 2>&1; then
    READY_OK=1
    break
  fi
  sleep 3
done

if [[ "$READY_OK" -eq 1 ]]; then
  ok "NORNIA SPARK KURULUMU BAŞARIYLA TAMAMLANDI!"
  echo ""
  echo -e "  ${GREEN}Web Panel (HTTPS)     :${NC} https://${DOMAIN}"
  echo -e "  ${GREEN}WebRTC WSS Gateway    :${NC} wss://${DOMAIN}:8089/ws"
  echo -e "  ${GREEN}HAProxy Live Stats    :${NC} http://127.0.0.1:8404/haproxy-stats"
  echo -e "  ${GREEN}MinIO S3 Console      :${NC} http://127.0.0.1:9001"
  echo -e "  ${GREEN}Deep Readiness Probe  :${NC} http://127.0.0.1:8000/api/system/ready"
  echo -e "  ${GREEN}Rolling Update Komutu :${NC} sudo bash scripts/ha/install_nornia_spark.sh --update"
else
  warn "Servisler başlatıldı ancak /api/system/ready henüz 200 dönmedi. Kontrol: docker compose -f ${COMPOSE_FILE} logs -f"
fi
