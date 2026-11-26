#!/usr/bin/env bash
# ==============================================================================
# NORNIA ENTERPRISE HA — Air-Gapped Bootable Offline ISO Üretici
# Desteklenen Sürümler: spark | midgard | odin
#
# Kullanım:
#   sudo bash scripts/ha/build_nornia_ha_iso.sh --edition spark   --version 3.12.0
#   sudo bash scripts/ha/build_nornia_ha_iso.sh --edition midgard --version 3.12.0
#   sudo bash scripts/ha/build_nornia_ha_iso.sh --edition odin    --version 3.12.0
#
# Çıktı:
#   dist/nornia-<edition>-ha-v<VERSION>.iso  +  .sha256 doğrulama özeti
# ==============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; AMBER='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}[Nornia ISO Builder]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${AMBER}[UYARI]${NC} $*"; }
err()  { echo -e "${RED}[HATA]${NC} $*" >&2; exit 1; }

EDITION=""
VERSION="3.12.0"
BASE_ISO=""
UBUNTU_ISO_URL="https://releases.ubuntu.com/24.04.2/ubuntu-24.04.2-live-server-amd64.iso"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST_DIR="${PROJECT_ROOT}/dist"
WORK_DIR="/tmp/nornia-iso-build"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --edition)  EDITION="$2"; shift 2 ;;
    --version)  VERSION="$2"; shift 2 ;;
    --base-iso) BASE_ISO="$2"; shift 2 ;;
    -h|--help)
      echo "Kullanım: sudo $0 --edition <spark|midgard|odin> [--version 3.12.0] [--base-iso /path/ubuntu-24.04-live-server-amd64.iso]"
      exit 0 ;;
    *) err "Bilinmeyen parametre: $1" ;;
  esac
done

case "$EDITION" in
  spark|midgard|odin) ;;
  *) err "--edition parametresi spark, midgard veya odin olmalıdır." ;;
esac

[[ $EUID -eq 0 ]] || err "ISO üretimi (mount / xorriso) için root yetkisi (sudo) gerekir."

for bin in docker xorriso 7z curl sha256sum; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    warn "Gerekli araç eksik (${bin}), kuruluyor..."
    apt-get update -qq && apt-get install -y -qq xorriso p7zip-full curl coreutils
    break
  fi
done

mkdir -p "$DIST_DIR" "$WORK_DIR"
rm -rf "${WORK_DIR}/iso_root" "${WORK_DIR}/payload"
mkdir -p "${WORK_DIR}/iso_root" "${WORK_DIR}/payload/nornia-app"

# ------------------------------------------------------------------------------
# 1. SEÇİLEN EDITION İÇİN DOCKER İMAJLARINI DERLE VE ÇEK
# ------------------------------------------------------------------------------
log "=== Adım 1/5: Nornia ${EDITION^^} v${VERSION} Docker imajları hazırlanıyor ==="
docker build -t "nornia/backend:${VERSION}"  -f "${PROJECT_ROOT}/deploy/ha/Dockerfile.backend"  "$PROJECT_ROOT"
docker build -t "nornia/frontend:${VERSION}" -f "${PROJECT_ROOT}/deploy/ha/Dockerfile.frontend" "$PROJECT_ROOT"
docker build -t "nornia/asterisk:${VERSION}" -f "${PROJECT_ROOT}/deploy/ha/Dockerfile.asterisk" "$PROJECT_ROOT"

IMAGES=(
  "nornia/backend:${VERSION}"
  "nornia/frontend:${VERSION}"
  "nornia/asterisk:${VERSION}"
  "haproxy:2.9-alpine"
  "redis:7-alpine"
  "minio/minio:latest"
)

if [[ "$EDITION" == "spark" || "$EDITION" == "midgard" ]]; then
  IMAGES+=("pgvector/pgvector:pg16")
fi

if [[ "$EDITION" == "midgard" || "$EDITION" == "odin" ]]; then
  IMAGES+=(
    "ghcr.io/kamailio/kamailio:5.8-bullseye"
    "drachtio/rtpengine:latest"
  )
fi

if [[ "$EDITION" == "odin" ]]; then
  IMAGES+=(
    "quay.io/coreos/etcd:v3.5.15"
    "ghcr.io/zalando/spilo-16:3.3-p1"
    "edoburu/pgbouncer:v1.23.1-p0"
  )
fi

for img in "${IMAGES[@]}"; do
  if [[ "$img" != nornia/* ]]; then
    log "İmaj indiriliyor: ${img}"
    docker pull "$img"
  fi
done

IMAGES_TAR="${WORK_DIR}/payload/nornia-${EDITION}-images.tar.gz"
log "Tüm Docker imajları tek offline arşive paketleniyor: ${IMAGES_TAR}"
docker save "${IMAGES[@]}" | gzip -1 > "$IMAGES_TAR"
ok "Offline imaj arşivi hazır: $(du -h "$IMAGES_TAR" | awk '{print $1}')"

# ------------------------------------------------------------------------------
# 2. UYGULAMA & KURULUM SCRIPTLERİNİ PAKETLE
# ------------------------------------------------------------------------------
log "=== Adım 2/5: Nornia deploy/ha ve scripts/ha dosyaları paketleniyor ==="
tar -czf "${WORK_DIR}/payload/nornia-source.tar.gz" \
  -C "$PROJECT_ROOT" \
  deploy/ha \
  scripts/ha \
  backend/services/cluster_bus.py \
  backend/services/object_storage_service.py \
  backend/scripts/nornia_media_agent.py

# ------------------------------------------------------------------------------
# 3. UBUNTU 24.04 BASE ISO TEMİNİ & ÇIKARIMI
# ------------------------------------------------------------------------------
log "=== Adım 3/5: Ubuntu 24.04 LTS Server taban ISO hazırlanıyor ==="
if [[ -z "$BASE_ISO" ]]; then
  BASE_ISO="${WORK_DIR}/ubuntu-24.04.2-live-server-amd64.iso"
  if [[ ! -f "$BASE_ISO" ]]; then
    log "Ubuntu 24.04 LTS Server ISO indiriliyor..."
    curl -fL "$UBUNTU_ISO_URL" -o "$BASE_ISO"
  fi
fi
[[ -f "$BASE_ISO" ]] || err "Taban ISO bulunamadı: ${BASE_ISO}"

7z x -y -o"${WORK_DIR}/iso_root" "$BASE_ISO" >/dev/null
mkdir -p "${WORK_DIR}/iso_root/nornia-offline" "${WORK_DIR}/iso_root/nocloud"
cp "$IMAGES_TAR" "${WORK_DIR}/iso_root/nornia-offline/"
cp "${WORK_DIR}/payload/nornia-source.tar.gz" "${WORK_DIR}/iso_root/nornia-offline/"

# ------------------------------------------------------------------------------
# 4. CLOUD-INIT AUTOINSTALL (user-data) & İLK AÇILIŞ SERVİSİ
# ------------------------------------------------------------------------------
log "=== Adım 4/5: Katılımsız Autoinstall (user-data) ve First-Boot servisi üretiliyor ==="
touch "${WORK_DIR}/iso_root/nocloud/meta-data"

FIRSTBOOT_CMD="bash /opt/ai-project/scripts/ha/install_nornia_${EDITION}.sh --offline --images-tar /opt/nornia-offline/nornia-${EDITION}-images.tar.gz"
if [[ "$EDITION" == "odin" ]]; then
  FIRSTBOOT_CMD="echo 'Nornia Odin offline paketi hazır! Kurulum için: sudo bash /opt/ai-project/scripts/ha/install_nornia_odin.sh --role <witness|postgres|minio|media|app|edge> --offline --images-tar /opt/nornia-offline/nornia-odin-images.tar.gz'"
fi

cat > "${WORK_DIR}/iso_root/nocloud/user-data" <<EOF
#cloud-config
autoinstall:
  version: 1
  locale: tr_TR.UTF-8
  keyboard:
    layout: tr
  identity:
    hostname: nornia-${EDITION}
    username: nornia
    password: "\$6\$rounds=4096\$norniaiso\$R1.S7K1Z2kS4xN4zN1T4E8aM0q2w3e4r5t6y7u8i9o0p1a2s3d4f5g6h7j8k9l0"
  ssh:
    install-server: true
    allow-pw: true
  packages:
    - docker.io
    - docker-compose-v2
    - openssl
    - curl
    - ufw
    - keepalived
  storage:
    layout:
      name: lvm
      sizing-policy: all
  late-commands:
    - mkdir -p /target/opt/nornia-offline /target/opt/ai-project
    - cp /cdrom/nornia-offline/* /target/opt/nornia-offline/
    - tar -xzf /target/opt/nornia-offline/nornia-source.tar.gz -C /target/opt/ai-project/
    - |
      cat <<'UNIT' > /target/etc/systemd/system/nornia-firstboot.service
      [Unit]
      Description=Nornia ${EDITION^^} HA First-Boot Offline Bootstrap
      After=network-online.target docker.service
      Wants=network-online.target docker.service
      ConditionPathExists=!/opt/nornia-offline/.bootstrapped

      [Service]
      Type=oneshot
      ExecStart=/bin/bash -c "${FIRSTBOOT_CMD} && touch /opt/nornia-offline/.bootstrapped"
      RemainAfterExit=yes

      [Install]
      WantedBy=multi-user.target
      UNIT
    - curtin in-target --target=/target -- systemctl enable docker nornia-firstboot.service
EOF

# GRUB menüsüne katılımsız Nornia Autoinstall seçeneğini ekle
GRUB_CFG="${WORK_DIR}/iso_root/boot/grub/grub.cfg"
if [[ -f "$GRUB_CFG" ]]; then
  sed -i 's|---|autoinstall ds=nocloud;s=/cdrom/nocloud/ ---|g' "$GRUB_CFG"
fi

# ------------------------------------------------------------------------------
# 5. BOOTABLE HYBRID ISO PAKETLEME (BIOS + UEFI)
# ------------------------------------------------------------------------------
OUT_ISO="${DIST_DIR}/nornia-${EDITION}-ha-v${VERSION}.iso"
log "=== Adım 5/5: Bootable Hybrid ISO oluşturuluyor: ${OUT_ISO} ==="

xorriso -as mkisofs \
  -r -V "NORNIA_${EDITION^^}_HA" \
  -J -joliet-long -l \
  -iso-level 3 \
  -partition_offset 16 \
  -o "$OUT_ISO" \
  "${WORK_DIR}/iso_root" >/dev/null 2>&1 || \
xorriso -as mkisofs \
  -r -V "NORNIA_${EDITION^^}_HA" \
  -J -l -o "$OUT_ISO" "${WORK_DIR}/iso_root"

sha256sum "$OUT_ISO" > "${OUT_ISO}.sha256"
ok "ISO ÜRETİMİ TAMAMLANDI!"
echo -e "  ${GREEN}ISO Dosyası :${NC} ${OUT_ISO} ($(du -h "$OUT_ISO" | awk '{print $1}'))"
echo -e "  ${GREEN}SHA-256     :${NC} $(cat "${OUT_ISO}.sha256")"
