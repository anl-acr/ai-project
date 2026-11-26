#!/usr/bin/env bash
# ==============================================================================
# NORNIA ODIN — Çoklu Sunucu & Coğrafi Yedekli Kurumsal Bulut HA Kurulum Scripti
# Sürüm: v3.12.0 | Mimari: Edition 3 (Nornia Odin)
#
# Önerilen Kurulum Sırası (Rol Bazlı):
#   1. --role witness  (Lokasyon C — 3. Gözlemci: etcd + Redis Sentinel Quorum)
#   2. --role postgres (Lokasyon A PG-A1 Primary, PG-A2 Sync Standby + Lokasyon B PG-B1 Geo-Replica)
#   3. --role minio    (Lokasyon A & B — S3 Ses Kayıt File Server + Geo Bucket Replikasyonu)
#   4. --role media    (Ayrıştırılmış Harici Asterisk Medya Havuzu + nornia_media_agent.py)
#   5. --role app      (Stateless Nornia Backend + Frontend Uygulama Havuzu)
#   6. --role edge     (HAProxy + Kamailio WSS/SIP + RTPEngine + Keepalived VIP)
# ==============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; AMBER='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}[Nornia Odin]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${AMBER}[UYARI]${NC} $*"; }
err()  { echo -e "${RED}[HATA]${NC} $*" >&2; exit 1; }

ROLE=""
SITE="loc-a"
NODE_NAME="$(hostname -s)"
NODE_IP=""
PUBLIC_IP=""
VIP_IP=""
VIP_IFACE="eth0"
VIP_PRIORITY="100"
DOMAIN="pbx.firma.com"
ETCD_ENDPOINTS=""
PG_ROLE="primary"
PG_PASSWORD=""
REDIS_PASSWORD=""
MINIO_USER="nornia_s3"
MINIO_PASS=""
PEER_MINIO_URL=""
APP_NODES=""
MEDIA_NODES=""
PGBOUNCER_HOST=""
REDIS_HOST=""
S3_ENDPOINT=""
API_INTERNAL_URL=""
AUDIOSOCKET_ADDR=""
AMI_SECRET=""
SESSION_SECRET=""
INTERNAL_TOKEN=""
OFFLINE=0
IMAGES_TAR=""

usage() {
  cat <<'EOF'
Nornia Odin — Kurumsal Çoklu Sunucu & Coğrafi Yedeklilik Kurulum Aracı

Kullanım:
  sudo bash scripts/ha/install_nornia_odin.sh --role <witness|postgres|minio|media|app|edge> [SEÇENEKLER]

Zorunlu Kurulum Sırası:
  Adım 1 (Lokasyon C): --role witness  --node-ip 10.99.0.10 --redis-host 10.10.20.11 --redis-pass <PASS>
  Adım 2 (Veritabanı): --role postgres --site loc-a --pg-role primary|sync-standby|geo-replica --node-ip 10.10.40.11 --etcd-endpoints 10.10.40.11:2379,10.10.40.12:2379,10.99.0.10:2379 --pg-pass <PASS>
  Adım 3 (File Srv)  : --role minio    --site loc-a --node-ip 10.10.50.11 --minio-pass <PASS> [--peer-minio http://10.20.50.11:9000]
  Adım 4 (Asterisk)  : --role media    --site loc-a --node-ip 10.10.30.11 --api-internal-url http://10.10.10.10:8000 --audiosocket-addr 10.10.10.10:9092 --s3-endpoint http://10.10.50.11:9000 --minio-pass <PASS> --redis-host 10.10.20.11 --redis-pass <PASS>
  Adım 5 (Nornia App): --role app      --site loc-a --node-ip 10.10.20.11 --pgbouncer-host 10.10.40.10 --pg-pass <PASS> --redis-host 10.10.20.11 --redis-pass <PASS> --media-nodes 10.10.30.11:5038,10.10.30.12:5038 --s3-endpoint http://10.10.50.11:9000 --minio-pass <PASS>
  Adım 6 (Edge Proxy): --role edge     --site loc-a --node-ip 10.10.10.11 --public-ip 203.0.113.10 --vip-ip 203.0.113.10 --vip-iface eth0 --vip-priority 110 --domain pbx.firma.com --app-nodes 10.10.20.11,10.10.20.12 --media-nodes 10.10.30.11:5060,10.10.30.12:5060
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --role)              ROLE="$2"; shift 2 ;;
    --site)              SITE="$2"; shift 2 ;;
    --node-name)         NODE_NAME="$2"; shift 2 ;;
    --node-ip)           NODE_IP="$2"; shift 2 ;;
    --public-ip)         PUBLIC_IP="$2"; shift 2 ;;
    --vip-ip)            VIP_IP="$2"; shift 2 ;;
    --vip-iface)         VIP_IFACE="$2"; shift 2 ;;
    --vip-priority)      VIP_PRIORITY="$2"; shift 2 ;;
    --domain)            DOMAIN="$2"; shift 2 ;;
    --etcd-endpoints)    ETCD_ENDPOINTS="$2"; shift 2 ;;
    --pg-role)           PG_ROLE="$2"; shift 2 ;;
    --pg-pass)           PG_PASSWORD="$2"; shift 2 ;;
    --redis-host)        REDIS_HOST="$2"; shift 2 ;;
    --redis-pass)        REDIS_PASSWORD="$2"; shift 2 ;;
    --minio-user)        MINIO_USER="$2"; shift 2 ;;
    --minio-pass)        MINIO_PASS="$2"; shift 2 ;;
    --peer-minio)        PEER_MINIO_URL="$2"; shift 2 ;;
    --app-nodes)         APP_NODES="$2"; shift 2 ;;
    --media-nodes)       MEDIA_NODES="$2"; shift 2 ;;
    --pgbouncer-host)    PGBOUNCER_HOST="$2"; shift 2 ;;
    --s3-endpoint)       S3_ENDPOINT="$2"; shift 2 ;;
    --api-internal-url)  API_INTERNAL_URL="$2"; shift 2 ;;
    --audiosocket-addr)  AUDIOSOCKET_ADDR="$2"; shift 2 ;;
    --ami-secret)        AMI_SECRET="$2"; shift 2 ;;
    --session-secret)    SESSION_SECRET="$2"; shift 2 ;;
    --internal-token)    INTERNAL_TOKEN="$2"; shift 2 ;;
    --offline)           OFFLINE=1; shift ;;
    --images-tar)        IMAGES_TAR="$2"; shift 2 ;;
    -h|--help)           usage ;;
    *) err "Bilinmeyen parametre: $1" ;;
  esac
done

[[ $EUID -eq 0 ]] || err "Bu script root yetkisiyle (sudo) çalıştırılmalıdır."
[[ -n "$ROLE" ]] || usage
[[ -n "$NODE_IP" ]] || NODE_IP=$(hostname -I | awk '{print $1}')
[[ -n "$PUBLIC_IP" ]] || PUBLIC_IP="$NODE_IP"

PROJECT_ROOT="${NORNIA_PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ODIN_DIR="/opt/nornia-odin/${ROLE}"
mkdir -p "$ODIN_DIR"

ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    [[ "$OFFLINE" -eq 0 ]] || err "Offline kurulumda Docker önceden yüklü olmalıdır."
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg openssl ufw
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable --now docker
  fi
  if [[ "$OFFLINE" -eq 1 && -n "$IMAGES_TAR" && -f "$IMAGES_TAR" ]]; then
    log "Air-gapped Odin imajları yükleniyor: ${IMAGES_TAR}"
    gunzip -c "$IMAGES_TAR" | docker load
  fi
}

ensure_docker

# ==============================================================================
# ROL 1: WITNESS (Lokasyon C — Split-Brain Önleyici 3. Gözlemci Quorum)
# ==============================================================================
if [[ "$ROLE" == "witness" ]]; then
  log "=== ODIN ADIM 1: WITNESS (etcd + Redis Sentinel Quorum) ==="
  [[ -n "$REDIS_PASSWORD" ]] || REDIS_PASSWORD="nornia_redis_odin_secret"
  [[ -n "$REDIS_HOST" ]] || REDIS_HOST="10.10.20.11"

  cat > "${ODIN_DIR}/sentinel.conf" <<EOF
port 26379
sentinel monitor nornia-master ${REDIS_HOST} 6379 2
sentinel auth-pass nornia-master ${REDIS_PASSWORD}
sentinel down-after-milliseconds nornia-master 5000
sentinel failover-timeout nornia-master 15000
sentinel parallel-syncs nornia-master 1
EOF

  cat > "${ODIN_DIR}/docker-compose.yml" <<EOF
name: nornia-odin-witness
services:
  etcd-witness:
    image: quay.io/coreos/etcd:v3.5.15
    container_name: odin-etcd-witness
    restart: always
    network_mode: host
    command: >
      /usr/local/bin/etcd
      --name=witness-c
      --data-dir=/etcd-data
      --listen-client-urls=http://0.0.0.0:2379
      --advertise-client-urls=http://${NODE_IP}:2379
      --listen-peer-urls=http://0.0.0.0:2380
      --initial-advertise-peer-urls=http://${NODE_IP}:2380
      --initial-cluster=witness-c=http://${NODE_IP}:2380
      --initial-cluster-token=nornia-odin-quorum
      --initial-cluster-state=new
    volumes:
      - etcd_witness_data:/etcd-data

  redis-sentinel-witness:
    image: redis:7-alpine
    container_name: odin-redis-sentinel
    restart: always
    network_mode: host
    command: ["redis-sentinel", "/etc/redis/sentinel.conf"]
    volumes:
      - ./sentinel.conf:/etc/redis/sentinel.conf

volumes:
  etcd_witness_data:
EOF
  docker compose -f "${ODIN_DIR}/docker-compose.yml" up -d
  ok "Odin Witness (etcd :2379 + Redis Sentinel :26379) aktif! IP: ${NODE_IP}"
  exit 0
fi

# ==============================================================================
# ROL 2: POSTGRES (Intra-DC Çift Patroni PG-A1/A2 RPO=0 + PG-B1 Geo-Replica + PgBouncer)
# ==============================================================================
if [[ "$ROLE" == "postgres" ]]; then
  log "=== ODIN ADIM 2: POSTGRESQL PATRONI + PGBOUNCER (Rol: ${PG_ROLE} | Site: ${SITE}) ==="
  [[ -n "$PG_PASSWORD" ]] || err "--pg-pass parametresi zorunludur."
  [[ -n "$ETCD_ENDPOINTS" ]] || ETCD_ENDPOINTS="${NODE_IP}:2379"

  SYNC_MODE="true"
  [[ "$PG_ROLE" == "geo-replica" ]] && SYNC_MODE="false"

  cat > "${ODIN_DIR}/patroni.yml" <<EOF
scope: nornia-odin-pg
namespace: /nornia/
name: ${NODE_NAME}

restapi:
  listen: 0.0.0.0:8008
  connect_address: ${NODE_IP}:8008

etcd3:
  hosts: ${ETCD_ENDPOINTS}

bootstrap:
  dcs:
    ttl: 20
    loop_wait: 5
    retry_timeout: 5
    maximum_lag_on_failover: 1048576
    synchronous_mode: ${SYNC_MODE}
    synchronous_mode_strict: false
    postgresql:
      use_pg_rewind: true
      use_slots: true
      parameters:
        wal_level: replica
        hot_standby: "on"
        max_connections: 400
        max_wal_senders: 10
        max_replication_slots: 10
        wal_keep_size: 1024MB
        synchronous_commit: "on"
  initdb:
    - encoding: UTF8
    - data-checksums
  users:
    pbx_user:
      password: ${PG_PASSWORD}
      options:
        - superuser
    replicator:
      password: ${PG_PASSWORD}
      options:
        - replication

postgresql:
  listen: 0.0.0.0:5432
  connect_address: ${NODE_IP}:5432
  data_dir: /var/lib/postgresql/data/pgdata
  authentication:
    replication:
      username: replicator
      password: ${PG_PASSWORD}
    superuser:
      username: postgres
      password: ${PG_PASSWORD}
  pg_hba:
    - host replication replicator 0.0.0.0/0 scram-sha-256
    - host all all 0.0.0.0/0 scram-sha-256
EOF

  cat > "${ODIN_DIR}/docker-compose.yml" <<EOF
name: nornia-odin-postgres
services:
  patroni-pg:
    image: ghcr.io/zalando/spilo-16:3.3-p1
    container_name: odin-pg-${NODE_NAME}
    restart: always
    network_mode: host
    environment:
      PGPASSWORD_SUPERUSER: ${PG_PASSWORD}
      PGPASSWORD_ADMIN: ${PG_PASSWORD}
      PGPASSWORD_STANDBY: ${PG_PASSWORD}
      SCOPE: nornia-odin-pg
    volumes:
      - ./patroni.yml:/etc/patroni/patroni.yml:ro
      - odin_pgdata:/var/lib/postgresql/data

  pgbouncer:
    image: edoburu/pgbouncer:v1.23.1-p0
    container_name: odin-pgbouncer
    restart: always
    network_mode: host
    environment:
      DB_HOST: 127.0.0.1
      DB_PORT: 5432
      DB_USER: pbx_user
      DB_PASSWORD: ${PG_PASSWORD}
      DB_NAME: ai_pbx
      LISTEN_PORT: 6432
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 1000
      DEFAULT_POOL_SIZE: 60
      AUTH_TYPE: scram-sha-256

volumes:
  odin_pgdata:
EOF
  docker compose -f "${ODIN_DIR}/docker-compose.yml" up -d
  ok "Odin PostgreSQL Patroni (${PG_ROLE}) :5432, Patroni REST :8008 ve PgBouncer :6432 aktif!"
  exit 0
fi

# ==============================================================================
# ROL 3: MINIO (Ayrıştırılmış File Server & Coğrafi S3 Ses Kayıt Replikasyonu)
# ==============================================================================
if [[ "$ROLE" == "minio" ]]; then
  log "=== ODIN ADIM 3: MINIO S3 FILE SERVER (Site: ${SITE}) ==="
  [[ -n "$MINIO_PASS" ]] || err "--minio-pass parametresi zorunludur."

  cat > "${ODIN_DIR}/docker-compose.yml" <<EOF
name: nornia-odin-minio
services:
  minio:
    image: minio/minio:latest
    container_name: odin-minio-${SITE}
    restart: always
    network_mode: host
    command: server /data --address ":9000" --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_PASS}
      MINIO_SITE_NAME: nornia-${SITE}
    volumes:
      - odin_minio_data:/data

volumes:
  odin_minio_data:
EOF
  docker compose -f "${ODIN_DIR}/docker-compose.yml" up -d
  ok "Odin MinIO S3 File Server (:9000 API / :9001 Console) aktif!"
  if [[ -n "$PEER_MINIO_URL" ]]; then
    log "Coğrafi S3 Active-Active replikasyon komutu (MinIO Client 'mc' ile):"
    echo "  mc alias set loc-a http://${NODE_IP}:9000 ${MINIO_USER} <PASS>"
    echo "  mc alias set loc-b ${PEER_MINIO_URL} ${MINIO_USER} <PASS>"
    echo "  mc mb --with-versioning loc-a/nornia-recordings loc-b/nornia-recordings"
    echo "  mc admin replicate add loc-a loc-b"
  fi
  exit 0
fi

# ==============================================================================
# ROL 4: MEDIA (Ayrıştırılmış Harici Asterisk Havuzu + Nornia Media Agent)
# ==============================================================================
if [[ "$ROLE" == "media" ]]; then
  log "=== ODIN ADIM 4: AYRIŞTIRILMIŞ ASTERISK MEDYA NODE (Site: ${SITE}) ==="
  [[ -n "$API_INTERNAL_URL" ]] || err "--api-internal-url zorunludur (örn: http://10.10.20.10:8000)"
  [[ -n "$AUDIOSOCKET_ADDR" ]] || err "--audiosocket-addr zorunludur (örn: 10.10.20.10:9092)"
  [[ -n "$S3_ENDPOINT" ]]      || err "--s3-endpoint zorunludur (örn: http://10.10.50.11:9000)"
  [[ -n "$MINIO_PASS" ]]       || err "--minio-pass zorunludur."

  cat > "${ODIN_DIR}/docker-compose.yml" <<EOF
name: nornia-odin-media
services:
  asterisk-media:
    build:
      context: ${PROJECT_ROOT}
      dockerfile: deploy/ha/Dockerfile.asterisk
    image: nornia/asterisk:3.12.0
    container_name: odin-asterisk-${NODE_NAME}
    restart: always
    network_mode: host
    environment:
      NORNIA_API_INTERNAL_URL: "${API_INTERNAL_URL}"
      NORNIA_AUDIOSOCKET_INTERNAL_ADDR: "${AUDIOSOCKET_ADDR}"
      REDIS_URL: "redis://:${REDIS_PASSWORD}@${REDIS_HOST:-127.0.0.1}:6379/0"
      S3_ENDPOINT: "${S3_ENDPOINT}"
      S3_ACCESS_KEY: "${MINIO_USER}"
      S3_SECRET_KEY: "${MINIO_PASS}"
      S3_BUCKET: "nornia-recordings"
      S3_VERIFY_TLS: "0"
      MEDIA_AGENT_DELETE_AFTER_UPLOAD: "1"
      TZ: Europe/Istanbul
    volumes:
      - /etc/nornia/asterisk:/etc/asterisk
      - /var/spool/asterisk/monitor:/var/spool/asterisk/monitor
      - /etc/nornia/certs:/etc/asterisk/keys:ro
EOF
  mkdir -p /etc/nornia/asterisk /var/spool/asterisk/monitor /etc/nornia/certs
  if [[ "$OFFLINE" -eq 1 ]]; then
    docker compose -f "${ODIN_DIR}/docker-compose.yml" up -d --no-build
  else
    docker compose -f "${ODIN_DIR}/docker-compose.yml" up -d --build
  fi
  ok "Odin Ayrıştırılmış Asterisk Medya Düğümü (${NODE_IP}:5060, AMI :5038) + S3 Media Agent aktif!"
  exit 0
fi

# ==============================================================================
# ROL 5: APP (Stateless Nornia Backend + Frontend Uygulama Sunucusu)
# ==============================================================================
if [[ "$ROLE" == "app" ]]; then
  log "=== ODIN ADIM 5: STATELESS NORNIA APP NODE (Site: ${SITE}) ==="
  [[ -n "$PGBOUNCER_HOST" ]] || err "--pgbouncer-host zorunludur."
  [[ -n "$PG_PASSWORD" ]]    || err "--pg-pass zorunludur."
  [[ -n "$REDIS_HOST" ]]     || err "--redis-host zorunludur."
  [[ -n "$REDIS_PASSWORD" ]] || err "--redis-pass zorunludur."
  [[ -n "$MEDIA_NODES" ]]    || err "--media-nodes zorunludur (örn: 10.10.30.11:5038,10.10.30.12:5038)"
  [[ -n "$S3_ENDPOINT" ]]    || err "--s3-endpoint zorunludur."
  [[ -n "$MINIO_PASS" ]]     || err "--minio-pass zorunludur."
  [[ -n "$AMI_SECRET" ]]     || AMI_SECRET="backend_secure_key_99"
  [[ -n "$SESSION_SECRET" ]] || SESSION_SECRET=$(openssl rand -hex 32)
  [[ -n "$INTERNAL_TOKEN" ]] || INTERNAL_TOKEN=$(openssl rand -hex 32)

  cat > "${ODIN_DIR}/docker-compose.yml" <<EOF
name: nornia-odin-app
services:
  redis-local:
    image: redis:7-alpine
    container_name: odin-redis-${NODE_NAME}
    restart: always
    network_mode: host
    command: ["redis-server", "--appendonly", "yes", "--requirepass", "${REDIS_PASSWORD}"]

  nornia-backend:
    build:
      context: ${PROJECT_ROOT}
      dockerfile: deploy/ha/Dockerfile.backend
    image: nornia/backend:3.12.0
    container_name: odin-backend-${NODE_NAME}
    restart: always
    network_mode: host
    environment:
      NORNIA_NODE_ID: "odin-${SITE}-${NODE_NAME}"
      DATABASE_URL: "postgresql+asyncpg://pbx_user:${PG_PASSWORD}@${PGBOUNCER_HOST}:6432/ai_pbx"
      SYNC_DATABASE_URL: "postgresql://pbx_user:${PG_PASSWORD}@${PGBOUNCER_HOST}:6432/ai_pbx"
      REDIS_URL: "redis://:${REDIS_PASSWORD}@${REDIS_HOST}:6379/0"
      ASTERISK_NODES: "${MEDIA_NODES}"
      AMI_USER: "ai_backend_user"
      AMI_SECRET: "${AMI_SECRET}"
      NORNIA_SESSION_SECRET: "${SESSION_SECRET}"
      NORNIA_INTERNAL_API_TOKEN: "${INTERNAL_TOKEN}"
      NORNIA_TRUSTED_INTERNAL_CIDRS: "127.0.0.1/32,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
      NORNIA_API_INTERNAL_URL: "${API_INTERNAL_URL:-http://${NODE_IP}:8000}"
      NORNIA_AUDIOSOCKET_INTERNAL_ADDR: "${AUDIOSOCKET_ADDR:-${NODE_IP}:9092}"
      S3_ENDPOINT: "${S3_ENDPOINT}"
      S3_ACCESS_KEY: "${MINIO_USER}"
      S3_SECRET_KEY: "${MINIO_PASS}"
      S3_BUCKET: "nornia-recordings"
      S3_VERIFY_TLS: "0"
      TZ: Europe/Istanbul

  nornia-frontend:
    build:
      context: ${PROJECT_ROOT}
      dockerfile: deploy/ha/Dockerfile.frontend
    image: nornia/frontend:3.12.0
    container_name: odin-frontend-${NODE_NAME}
    restart: always
    network_mode: host
EOF
  if [[ "$OFFLINE" -eq 1 ]]; then
    docker compose -f "${ODIN_DIR}/docker-compose.yml" up -d --no-build
  else
    docker compose -f "${ODIN_DIR}/docker-compose.yml" up -d --build
  fi
  ok "Odin Stateless App Node (${NODE_IP}:8000 API, :3000 UI, :9092 AudioSocket) aktif!"
  exit 0
fi

# ==============================================================================
# ROL 6: EDGE (HAProxy + Kamailio WSS/SIP + RTPEngine + Keepalived VIP)
# ==============================================================================
if [[ "$ROLE" == "edge" ]]; then
  log "=== ODIN ADIM 6: EDGE PROXY KATMANI (HAProxy + Kamailio + RTPEngine + Keepalived VIP) ==="
  [[ -n "$APP_NODES" ]]   || err "--app-nodes zorunludur (örn: 10.10.20.11,10.10.20.12)"
  [[ -n "$MEDIA_NODES" ]] || err "--media-nodes zorunludur (örn: 10.10.30.11:5060,10.10.30.12:5060)"

  CERTS_DIR="/etc/nornia/certs"
  mkdir -p "$CERTS_DIR"
  if [[ ! -f "${CERTS_DIR}/nornia.pem" ]]; then
    openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
      -keyout "${CERTS_DIR}/privkey.pem" -out "${CERTS_DIR}/fullchain.pem" \
      -subj "/CN=${DOMAIN}/O=Nornia Odin Edge" >/dev/null 2>&1
    cat "${CERTS_DIR}/fullchain.pem" "${CERTS_DIR}/privkey.pem" > "${CERTS_DIR}/nornia.pem"
    chmod 644 "${CERTS_DIR}"/*.pem
  fi

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

  # Kamailio dispatcher.list (External Asterisk Media Pool)
  : > "${ODIN_DIR}/dispatcher.list"
  IFS=',' read -ra M_ARR <<< "$MEDIA_NODES"
  for m in "${M_ARR[@]}"; do
    echo "1 sip:${m} 0 0 weight=50;maxload=1000" >> "${ODIN_DIR}/dispatcher.list"
  done

  # Dynamic HAProxy config pointing to Odin App Pool
  cat > "${ODIN_DIR}/haproxy.cfg" <<'EOF'
global
    log stdout format raw local0
    maxconn 20000
    tune.ssl.default-dh-param 2048

defaults
    log global
    mode http
    option forwardfor
    timeout connect 5s
    timeout client 60s
    timeout server 60s
    timeout tunnel 3600s

listen stats
    bind *:8404
    stats enable
    stats uri /haproxy-stats

frontend ft_https
    bind *:80
    bind *:443 ssl crt /etc/haproxy/certs/nornia.pem alpn h2,http/1.1
    http-request redirect scheme https code 301 unless { ssl_fc }
    acl is_api path_beg /api /uploads /static /ws /openapi.json /docs
    acl is_ws  hdr(Upgrade) -i websocket
    use_backend bk_app_api if is_api
    use_backend bk_app_api if is_ws
    default_backend bk_app_web

frontend ft_internal_api
    bind *:8000
    default_backend bk_app_api

frontend ft_audiosocket
    bind *:9092
    mode tcp
    timeout client 3600s
    default_backend bk_audiosocket

backend bk_app_api
    balance leastconn
    option httpchk GET /api/system/ready
    http-check expect status 200
    default-server inter 3s fall 2 rise 2
EOF
  idx=1
  IFS=',' read -ra A_ARR <<< "$APP_NODES"
  for a in "${A_ARR[@]}"; do
    echo "    server app-api-${idx} ${a}:8000 check" >> "${ODIN_DIR}/haproxy.cfg"
    idx=$((idx+1))
  done

  cat >> "${ODIN_DIR}/haproxy.cfg" <<'EOF'

backend bk_app_web
    balance roundrobin
    option httpchk GET /
    http-check expect status 200
    default-server inter 5s fall 2 rise 2
EOF
  idx=1
  for a in "${A_ARR[@]}"; do
    echo "    server app-web-${idx} ${a}:3000 check" >> "${ODIN_DIR}/haproxy.cfg"
    idx=$((idx+1))
  done

  cat >> "${ODIN_DIR}/haproxy.cfg" <<'EOF'

backend bk_audiosocket
    mode tcp
    balance leastconn
    timeout server 3600s
EOF
  idx=1
  for a in "${A_ARR[@]}"; do
    echo "    server app-as-${idx} ${a}:9092 check port 8000 inter 3s fall 2 rise 2" >> "${ODIN_DIR}/haproxy.cfg"
    idx=$((idx+1))
  done

  # Optional Keepalived VRRP VIP
  if [[ -n "$VIP_IP" && "$OFFLINE" -eq 0 ]]; then
    apt-get install -y -qq keepalived || true
    cat > /etc/keepalived/keepalived.conf <<EOF
vrrp_script chk_odin_edge {
    script "/usr/bin/curl -fsS http://127.0.0.1:8000/api/system/ready"
    interval 3
    fall 2
    rise 2
}
vrrp_instance VI_NORNIA_ODIN {
    state BACKUP
    interface ${VIP_IFACE}
    virtual_router_id 51
    priority ${VIP_PRIORITY}
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass norniaha
    }
    virtual_ipaddress {
        ${VIP_IP}/24
    }
    track_script {
        chk_odin_edge
    }
}
EOF
    systemctl enable --now keepalived || true
    ok "Keepalived Floating VIP yapılandırıldı: ${VIP_IP} (Priority: ${VIP_PRIORITY})"
  fi

  cp "${PROJECT_ROOT}/deploy/ha/kamailio-midgard.cfg" "${ODIN_DIR}/kamailio.cfg"

  cat > "${ODIN_DIR}/docker-compose.yml" <<EOF
name: nornia-odin-edge
services:
  haproxy:
    image: haproxy:2.9-alpine
    container_name: odin-edge-haproxy
    restart: always
    network_mode: host
    volumes:
      - ./haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro
      - ${CERTS_DIR}:/etc/haproxy/certs:ro

  rtpengine:
    image: drachtio/rtpengine:latest
    container_name: odin-edge-rtpengine
    restart: always
    network_mode: host
    command: >
      rtpengine
      --interface=${NODE_IP}!${PUBLIC_IP}
      --listen-ng=127.0.0.1:22222
      --port-min=20000
      --port-max=35000
      --log-level=5
      --foreground

  kamailio:
    image: ghcr.io/kamailio/kamailio:5.8-bullseye
    container_name: odin-edge-kamailio
    restart: always
    network_mode: host
    depends_on:
      - rtpengine
    volumes:
      - ./kamailio.cfg:/etc/kamailio/kamailio.cfg:ro
      - ./dispatcher.list:/etc/kamailio/dispatcher.list:ro
      - ${CERTS_DIR}:/etc/kamailio/certs:ro
EOF
  docker compose -f "${ODIN_DIR}/docker-compose.yml" up -d
  ok "Odin Edge Proxy (HAProxy :443/:8000/:9092 + Kamailio :5060/:8089 + RTPEngine + VIP ${VIP_IP:-yok}) aktif!"
  exit 0
fi

err "Geçersiz --role değeri: ${ROLE}. Kullanılabilir roller: witness, postgres, minio, media, app, edge"
