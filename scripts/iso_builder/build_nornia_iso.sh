#!/usr/bin/env bash
# ==============================================================================
# Nornia — Tam Çevrimdışı (Air-Gapped) Otomatik ISO Üretici
# ==============================================================================
# Ubuntu 24.04 LTS (amd64) Linux sunucuda tek komutla önyüklenebilir,
# tamamen internetsiz çalışan Nornia Appliance ISO dosyasını üretir.
#
# Kullanım:
#   sudo bash scripts/iso_builder/build_nornia_iso.sh
#
# Opsiyonel Ortam Değişkenleri:
#   NORNIA_SYSADMIN_USER   (varsayılan: nornia)
#   NORNIA_SYSADMIN_PASS   (varsayılan: NorniaAdmin2027!*)
#   NORNIA_DESTEK_PASS     (varsayılan: destekgiris2027!*)
#   UBUNTU_ISO_PATH        (önceden indirilmiş ubuntu-24.04-live-server-amd64.iso yolu)
#   OUT_DIR                (varsayılan: <repo>/dist)
# ==============================================================================
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[HATA] ISO üretici root (sudo) yetkisiyle çalıştırılmalıdır." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CACHE_DIR="/var/cache/nornia-iso"
WORK_DIR="/tmp/nornia_iso_build_work"
OUT_DIR="${OUT_DIR:-${REPO_ROOT}/dist}"

SYSADMIN_USER="${NORNIA_SYSADMIN_USER:-nornia}"
SYSADMIN_PASS="${NORNIA_SYSADMIN_PASS:-NorniaAdmin2027!*}"
DESTEK_PASS="${NORNIA_DESTEK_PASS:-destekgiris2027!*}"

# Sürümü backend/main.py'den otomatik oku
NORNIA_VER="$(grep -m1 '"version": "v' "${REPO_ROOT}/backend/main.py" | sed -E 's/.*"version": "([^"]+)".*/\1/' || echo "v3.10.8")"
ISO_FILENAME="nornia-${NORNIA_VER}-ubuntu24.04-amd64.iso"
FINAL_ISO="${OUT_DIR}/${ISO_FILENAME}"

UBUNTU_ISO_URL="${UBUNTU_ISO_URL:-}"
UBUNTU_ISO_FILE="${UBUNTU_ISO_PATH:-${CACHE_DIR}/ubuntu-24.04-live-server-amd64.iso}"

# Önce varsa yarım kalmış geçici derleme dizinlerini temizle ki disk ölçümü doğru olsun
rm -rf "$WORK_DIR" /tmp/nornia_asterisk_deb_build

# Şifre güvenlik kontrolü (bash çift tırnak içinde !* genişlemesi kazasını yakala)
if [[ "$SYSADMIN_PASS" == *"&&"* || "$DESTEK_PASS" == *"&&"* || "$SYSADMIN_PASS" == *" "* || "$DESTEK_PASS" == *" "* ]]; then
  echo "[HATA] Şifrelerde boşluk veya '&&' tespit edildi! Bash içinde '!' veya '*' karakterli şifreleri TEK TIRNAK ('...') ile yazmalısınız." >&2
  echo "       Örnek: NORNIA_SYSADMIN_PASS='Sifreniz!*' NORNIA_DESTEK_PASS='destekgiris2027!*'" >&2
  exit 1
fi

# Boş disk alanı kontrolü (canlı santralde diskin %100 dolmasını önler)
FREE_GB="$(df -BG --output=avail / 2>/dev/null | tail -n 1 | tr -dc '0-9' || echo 20)"
LOW_DISK_MODE="${LOW_DISK_MODE:-0}"
MIN_FREE_GB=11
if [[ -f "$UBUNTU_ISO_FILE" ]]; then
  MIN_FREE_GB=9
fi
if [[ "${FREE_GB:-20}" -lt "$MIN_FREE_GB" ]]; then
  echo "[HATA] Kök diskte yalnızca ${FREE_GB} GB boş alan var. Güvenli ISO üretimi için en az ${MIN_FREE_GB} GB boş alan gereklidir." >&2
  exit 1
fi
if [[ "${FREE_GB:-20}" -lt 18 && -z "${UBUNTU_ISO_PATH:-}" ]]; then
  LOW_DISK_MODE="1"
fi

mkdir -p "$CACHE_DIR" "${CACHE_DIR}/debs" "$OUT_DIR"
mkdir -p "$WORK_DIR"

echo "======================================================================"
echo "  NORNIA TAM ÇEVRİMDIŞI ISO ÜRETİCİ"
echo "  Sürüm         : ${NORNIA_VER}"
echo "  Yönetici SSH  : ${SYSADMIN_USER}"
echo "  Destek Hesap  : destek (kısıtlı ağ/IP kabuğu)"
echo "  Boş Disk      : ${FREE_GB} GB (Düşük Disk Koruma Modu: ${LOW_DISK_MODE})"
echo "  Çıktı ISO     : ${FINAL_ISO}"
echo "======================================================================"

# ------------------------------------------------------------------------------
# 1. Build Aracı Bağımlılıkları
# ------------------------------------------------------------------------------
echo "[1/8] ISO üretim araçları kontrol ediliyor..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
  xorriso dpkg-dev apt-rdepends wget curl openssl python3 python3-pip python3-venv \
  rsync squashfs-tools ca-certificates gnupg

# Node.js 20 yoksa NodeSource'tan kur (Frontend build + pm2 paketleme için)
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 18 ]]; then
  echo "[1b] Node.js 20 LTS kuruluyor..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
apt-get clean

# ------------------------------------------------------------------------------
# 2. Ubuntu 24.04 Live Server Taban ISO İndir / Önbellekten Kullan
# ------------------------------------------------------------------------------
echo "[2/8] Ubuntu 24.04 Server taban ISO kontrol ediliyor..."
if [[ ! -f "$UBUNTU_ISO_FILE" ]]; then
  if [[ -z "$UBUNTU_ISO_URL" ]]; then
    # Ubuntu 24.04 dizininden en güncel nokta sürümünü (24.04.x) otomatik keşfet
    LATEST_ISO_NAME="$(curl -fsSL https://releases.ubuntu.com/24.04/ 2>/dev/null \
      | grep -oE 'ubuntu-24\.04(\.[0-9]+)?-live-server-amd64\.iso' | sort -V | tail -n 1 || true)"
    if [[ -n "$LATEST_ISO_NAME" ]]; then
      UBUNTU_ISO_URL="https://releases.ubuntu.com/24.04/${LATEST_ISO_NAME}"
    else
      UBUNTU_ISO_URL="https://releases.ubuntu.com/24.04/ubuntu-24.04.5-live-server-amd64.iso"
    fi
  fi
  echo "  İndiriliyor: ${UBUNTU_ISO_URL}"
  wget --show-progress -O "${UBUNTU_ISO_FILE}.part" "$UBUNTU_ISO_URL"
  mv "${UBUNTU_ISO_FILE}.part" "$UBUNTU_ISO_FILE"
else
  echo "  [OK] Önbellekteki taban ISO kullanılıyor: ${UBUNTU_ISO_FILE}"
fi

# ------------------------------------------------------------------------------
# 3. Pre-built Asterisk .deb Hazırla (Önbellekli)
# ------------------------------------------------------------------------------
echo "[3/8] Nornia Asterisk 18 (.deb) paketi hazırlanıyor..."
bash "${REPO_ROOT}/scripts/installer/build_asterisk_deb.sh" "${CACHE_DIR}/debs"

# ------------------------------------------------------------------------------
# 4. Çevrimdışı Paket Havuzunu Oluştur (APT + Python Wheels + PM2)
# ------------------------------------------------------------------------------
BUNDLE_ROOT="${WORK_DIR}/nornia_bundle"
mkdir -p "${BUNDLE_ROOT}/apt-repo" "${BUNDLE_ROOT}/debs" "${BUNDLE_ROOT}/wheels" "${BUNDLE_ROOT}/npm/pm2-global" "${BUNDLE_ROOT}/app"

cp "${CACHE_DIR}/debs"/nornia-asterisk_*.deb "${BUNDLE_ROOT}/debs/"
cp "${REPO_ROOT}/scripts/installer/install_nornia_offline.sh" "${BUNDLE_ROOT}/install_nornia_offline.sh"
chmod 0755 "${BUNDLE_ROOT}/install_nornia_offline.sh"

echo "[4/8] Çevrimdışı Ubuntu 24.04 APT deposu indiriliyor..."
TARGET_PKGS=(
  openssh-server sudo curl wget ca-certificates gnupg openssl
  postgresql-16 postgresql-client-16
  nginx wireguard wireguard-tools ufw fail2ban chrony
  python3 python3-venv python3-pip
  nodejs
  ffmpeg sox
  sngrep tcpdump mtr-tiny dnsutils traceroute iputils-ping iproute2 net-tools netcat-openbsd
  libssl3t64 libjansson4 libsrtp2-1 libsqlite3-0 libxml2 libedit2 libuuid1 libcurl4t64 libopus0
)
# Ubuntu 24.04 t64 paket adını otomatik ekle (libspandsp2t64 veya libspandsp2)
if apt-cache show libspandsp2t64 >/dev/null 2>&1; then
  TARGET_PKGS+=(libspandsp2t64)
elif apt-cache show libspandsp2 >/dev/null 2>&1; then
  TARGET_PKGS+=(libspandsp2)
fi
# NodeSource nodejs zaten npm içerir ve Ubuntu npm ile çakışır; yalnızca nodejs npm sağlamıyorsa npm ekle
if ! apt-cache show nodejs 2>/dev/null | grep -qiE '^Provides:.*\bnpm\b'; then
  TARGET_PKGS+=(npm)
fi
# pgvector varsa ekle
if apt-cache show postgresql-16-pgvector >/dev/null 2>&1; then
  TARGET_PKGS+=(postgresql-16-pgvector)
fi

pushd "${BUNDLE_ROOT}/apt-repo" >/dev/null
# Gerçek APT çözümleyicisini boş status dosyasıyla çalıştırarak TÜM gerçek & t64/sanal bağımlılıkları eksiksiz indir
EMPTY_STATUS="${WORK_DIR}/apt_empty_status"
: > "$EMPTY_STATUS"
mkdir -p "${BUNDLE_ROOT}/apt-repo/partial"

echo "  → APT çözümleyici ile tüm gerçek bağımlılıklar (t64 dahil) indiriliyor..."
apt-get install -y --download-only --no-install-recommends \
  -o "Dir::State::status=${EMPTY_STATUS}" \
  -o "Dir::Cache::archives=${BUNDLE_ROOT}/apt-repo" \
  -o Debug::NoLocking=1 \
  "${TARGET_PKGS[@]}"

rm -rf "${BUNDLE_ROOT}/apt-repo/partial" "${BUNDLE_ROOT}/apt-repo/lock" "$EMPTY_STATUS"
dpkg-scanpackages -m . /dev/null > Packages
gzip -9c Packages > Packages.gz
echo "  [OK] $(ls -1 *.deb | wc -l) adet .deb paketi çevrimdışı depoya eksiksiz eklendi."
popd >/dev/null

echo "[5/8] Python çevrimdışı wheel paketleri ve PM2 hazırlanıyor..."
REQ_COMBINED="${BUNDLE_ROOT}/wheels/requirements-locked.txt"
{
  cat "${REPO_ROOT}/requirements.txt" 2>/dev/null || true
  echo ""
  cat "${REPO_ROOT}/backend/requirements.txt" 2>/dev/null || true
  echo ""
  echo "aiosqlite>=0.20.0"
  echo "cryptography>=42.0.0"
  echo "PyYAML>=6.0.0"
  echo "psutil>=6.0.0"
  echo "pyotp>=2.9.0"
  echo "uvicorn[standard]>=0.28.0"
} | grep -Ev '^\s*(#|$)' | sort -u > "$REQ_COMBINED"

pip3 download --dest "${BUNDLE_ROOT}/wheels" -r "$REQ_COMBINED"

# PM2 çevrimdışı kurulum paketi (npm install --prefix ile sıfır internet kurulumu)
npm install -g --prefix "${BUNDLE_ROOT}/npm/pm2-global" pm2

# ------------------------------------------------------------------------------
# 6. Nornia Uygulamasını Derle & Temiz Üretim Paketi Oluştur
# ------------------------------------------------------------------------------
echo "[6/8] Nornia Frontend derleniyor ve temiz uygulama paketi oluşturuluyor..."
APP_STAGE="${WORK_DIR}/app_stage"
mkdir -p "$APP_STAGE"
rsync -a \
  --exclude='.git' \
  --exclude='venv' \
  --exclude='node_modules' \
  --exclude='frontend/.next' \
  --exclude='frontend/node_modules' \
  --exclude='license_center' \
  --exclude='desktop' \
  --exclude='mobile' \
  --exclude='dist' \
  --exclude='recordings/*' \
  --exclude='uploads/*' \
  --exclude='backups/*' \
  --exclude='network_backups/*' \
  --exclude='scratch' \
  --exclude='backend/settings.json' \
  --exclude='backend/.env' \
  --exclude='backend/*.db' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  "${REPO_ROOT}/" "${APP_STAGE}/"

pushd "${APP_STAGE}/frontend" >/dev/null
npm ci --no-audit --no-fund
npm run build
popd >/dev/null

tar -czf "${BUNDLE_ROOT}/app/nornia-app-bundle.tar.gz" -C "$APP_STAGE" .
rm -rf "$APP_STAGE"
echo "  [OK] Uygulama paketi boyutu: $(du -h "${BUNDLE_ROOT}/app/nornia-app-bundle.tar.gz" | cut -f1)"

# ------------------------------------------------------------------------------
# 7. Taban ISO'yu Aç, Autoinstall & GRUB Dosyalarını Göm
# ------------------------------------------------------------------------------
echo "[7/8] Taban ISO açılıyor ve katılımsız autoinstall enjekte ediliyor..."
ISO_EXTRACT="${WORK_DIR}/iso_extract"
mkdir -p "$ISO_EXTRACT"
xorriso -osirrox on -indev "$UBUNTU_ISO_FILE" -extract / "$ISO_EXTRACT" >/dev/null 2>&1
chmod -R u+w "$ISO_EXTRACT"

# Nornia çevrimdışı paketini ISO köküne yerleştir
mkdir -p "${ISO_EXTRACT}/nornia"
mv "${BUNDLE_ROOT}"/* "${ISO_EXTRACT}/nornia/"

# Yönetici şifre hash'i (SHA-512)
SYSADMIN_PASS_HASH="$(openssl passwd -6 "$SYSADMIN_PASS")"

# 7a) Tam Otomatik Autoinstall seed
mkdir -p "${ISO_EXTRACT}/nornia-autoinstall/auto"
touch "${ISO_EXTRACT}/nornia-autoinstall/auto/meta-data"

python3 - "$SCRIPT_DIR/autoinstall/user-data.tmpl" "${ISO_EXTRACT}/nornia-autoinstall/auto/user-data" \
  "$SYSADMIN_USER" "$SYSADMIN_PASS_HASH" "$SYSADMIN_PASS" "$DESTEK_PASS" <<'PYEOF'
import sys
tmpl_path, out_path, u, h, p_plain, d_plain = sys.argv[1:7]
def _esc_env(v: str) -> str:
    return v.replace("\\", "\\\\").replace('"', '\\"')
with open(tmpl_path, "r", encoding="utf-8") as f:
    txt = f.read()
txt = (
    txt.replace("__SYSADMIN_USER__", _esc_env(u))
    .replace("__SYSADMIN_PASS_HASH__", h)
    .replace("__SYSADMIN_PASS_PLAIN__", _esc_env(p_plain))
    .replace("__DESTEK_PASS_PLAIN__", _esc_env(d_plain))
)
with open(out_path, "w", encoding="utf-8") as f:
    f.write(txt)
PYEOF

# 7b) Disk Seçimli (Etkileşimli Storage) Autoinstall seed
mkdir -p "${ISO_EXTRACT}/nornia-autoinstall/interactive"
touch "${ISO_EXTRACT}/nornia-autoinstall/interactive/meta-data"
python3 - "${ISO_EXTRACT}/nornia-autoinstall/auto/user-data" "${ISO_EXTRACT}/nornia-autoinstall/interactive/user-data" <<'PYEOF'
import sys
src, dst = sys.argv[1:3]
with open(src, "r", encoding="utf-8") as f:
    txt = f.read()
txt = txt.replace(
    "autoinstall:\n  version: 1",
    "autoinstall:\n  version: 1\n  interactive-sections:\n    - storage"
)
with open(dst, "w", encoding="utf-8") as f:
    f.write(txt)
PYEOF

# GRUB boot menüsü
cp "${SCRIPT_DIR}/grub/grub.cfg" "${ISO_EXTRACT}/boot/grub/grub.cfg"

# ------------------------------------------------------------------------------
# 8. UEFI + BIOS Hibrit Önyüklenebilir ISO'yu Paketle
# ------------------------------------------------------------------------------
echo "[8/8] Önyüklenebilir Nornia ISO dosyası paketleniyor: ${FINAL_ISO}..."

# Orijinal ISO'dan MBR & EFI boot imajlarını çıkar
BOOT_IMG_DIR="${WORK_DIR}/boot_imgs"
mkdir -p "$BOOT_IMG_DIR"
dd if="$UBUNTU_ISO_FILE" bs=1 count=432 of="${BOOT_IMG_DIR}/boot_hybrid.img" status=none

EFI_START="$(fdisk -l "$UBUNTU_ISO_FILE" 2>/dev/null | awk '/EFI/ {print $2; exit}' || true)"
EFI_SECTORS="$(fdisk -l "$UBUNTU_ISO_FILE" 2>/dev/null | awk '/EFI/ {print $4; exit}' || true)"
if [[ -n "$EFI_START" && -n "$EFI_SECTORS" ]]; then
  dd if="$UBUNTU_ISO_FILE" bs=512 skip="$EFI_START" count="$EFI_SECTORS" of="${BOOT_IMG_DIR}/efi.img" status=none
fi

# Düşük disk koruma modu (<18 GB): xorriso final ISO'yu yazmadan önce taban ISO'yu silerek ~2.6 GB alan aç
if [[ "$LOW_DISK_MODE" == "1" && -f "$UBUNTU_ISO_FILE" && -z "${UBUNTU_ISO_PATH:-}" ]]; then
  echo "  [Düşük Disk Modu] Final ISO yazılmadan önce geçici taban ISO temizleniyor (~2.6 GB kazanıldı)..."
  rm -f "$UBUNTU_ISO_FILE"
fi

XORRISO_ARGS=(
  -as mkisofs
  -r
  -V "NORNIA_${NORNIA_VER}"
  -o "$FINAL_ISO"
  --grub2-mbr "${BOOT_IMG_DIR}/boot_hybrid.img"
  -partition_offset 16
  --mbr-force-bootable
  -eltorito-boot boot/grub/i386-pc/eltorito.img
  -no-emul-boot
  -boot-load-size 4
  -boot-info-table
  --grub2-boot-info
)

if [[ -f "${BOOT_IMG_DIR}/efi.img" ]]; then
  XORRISO_ARGS+=(
    -eltorito-alt-boot
    -e --interval:appended_partition_2:::
    -no-emul-boot
    -append_partition 2 28732ac11ff8d211ba4b00a0c93ec93b "${BOOT_IMG_DIR}/efi.img"
    -appended_part_as_gpt
    -iso_mbr_part_type a2a0d0ebe5b9334487c068b6b72699c7
  )
fi

XORRISO_ARGS+=("$ISO_EXTRACT")
xorriso "${XORRISO_ARGS[@]}"

sha256sum "$FINAL_ISO" > "${FINAL_ISO}.sha256"
rm -rf "$WORK_DIR"

echo "======================================================================"
echo "  [BAŞARILI] NORNIA TAM ÇEVRİMDIŞI ISO HAZIR!"
echo "  Dosya  : ${FINAL_ISO}"
echo "  Boyut  : $(du -h "$FINAL_ISO" | cut -f1)"
echo "  SHA256 : $(cat "${FINAL_ISO}.sha256")"
echo "======================================================================"
