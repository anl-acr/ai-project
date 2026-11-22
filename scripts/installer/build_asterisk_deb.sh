#!/usr/bin/env bash
# ==============================================================================
# Nornia — Pre-built Asterisk 18.11.3 + Cisco Patch + WebRTC SRTP .deb Üretici
# ==============================================================================
# Bu betik, Ubuntu 24.04 (amd64) build makinesinde TEK SEFER çalıştırılır ve
# yeniden kullanılabilir 'nornia-asterisk_18.11.3_amd64.deb' paketini üretir.
# Üretilen .deb paketi çevrimdışı ISO içine gömülür; böylece müşteri
# kurulumlarında Asterisk 20 dk derlemek yerine ~15 saniyede kurulur.
#
# Kullanım:
#   sudo bash scripts/installer/build_asterisk_deb.sh [CIKTI_DIZINI]
# ==============================================================================
set -euo pipefail

OUT_DIR="${1:-/var/cache/nornia-iso/debs}"
AST_VER="18.11.3"
PKG_NAME="nornia-asterisk"
ARCH="amd64"
DEB_FILE="${OUT_DIR}/${PKG_NAME}_${AST_VER}_${ARCH}.deb"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[HATA] Bu betik root (sudo) yetkisiyle çalıştırılmalıdır." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

if [[ -f "$DEB_FILE" && "${FORCE_REBUILD:-0}" != "1" ]]; then
  echo "[OK] Önceden derlenmiş paket zaten mevcut: $DEB_FILE"
  echo "     Yeniden derlemek için FORCE_REBUILD=1 ile çalıştırın."
  exit 0
fi

echo "======================================================================"
echo "  Nornia Asterisk ${AST_VER} (.deb) Paket Derleyici Başlatılıyor..."
echo "======================================================================"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
  build-essential wget curl tar unzip git dpkg-dev \
  libssl-dev libncurses5-dev libnewt-dev libxml2-dev libsqlite3-dev \
  uuid-dev libjansson-dev libsrtp2-dev libedit-dev libcurl4-openssl-dev \
  pkg-config subversion libopus-dev libvorbis-dev libogg-dev libspeex-dev \
  libspeexdsp-dev libspandsp-dev

WORK_DIR="/tmp/nornia_asterisk_deb_build"
STAGE_DIR="${WORK_DIR}/stage"
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR" "$STAGE_DIR"
cd "$WORK_DIR"

echo "[1/5] Asterisk ${AST_VER} kaynak kodu ve Cisco yaması indiriliyor..."
if ! wget -q --show-progress "http://setup.saphira.com.tr/asterisk-${AST_VER}.tar.gz" -O "asterisk-${AST_VER}.tar.gz"; then
  echo "[UYARI] Saphira aynasına erişilemedi, resmi Asterisk arşivinden indiriliyor..."
  wget -q --show-progress "https://downloads.asterisk.org/pub/telephony/asterisk/releases/asterisk-${AST_VER}.tar.gz" -O "asterisk-${AST_VER}.tar.gz"
fi
tar -zxf "asterisk-${AST_VER}.tar.gz"
cd "asterisk-${AST_VER}"

if wget -q "http://setup.saphira.com.tr/cisco/cisco-usecallmanager-${AST_VER}.patch" -O "cisco-usecallmanager-${AST_VER}.patch"; then
  patch --strip=1 < "cisco-usecallmanager-${AST_VER}.patch" || echo "[BİLGİ] Cisco yaması atlandı / zaten uygulanmış."
fi

# MP3 kaynak kodunu sadece eksiksiz indirilebilirse etkinleştir
rm -rf addons/mp3
./contrib/scripts/get_mp3_source.sh || true
HAS_MP3_SRC="0"
if [[ -f addons/mp3/interface.c ]]; then
  HAS_MP3_SRC="1"
else
  rm -rf addons/mp3
  echo "[BİLGİ] MP3 eklenti kaynağı indirilemedi; format_mp3 devre dışı bırakılıyor (WAV/ULAW/ALAW/OPUS tam aktif)."
fi

echo "[2/5] Configure (Bundled PJProject + WebRTC SRTP AES-256/GCM + AudioSocket)..."
CFLAGS="-DENABLE_SRTP_AES_GCM -DENABLE_SRTP_AES_256" ./configure --with-pjproject-bundled

make menuselect.makeopts
MP3_FLAG="--disable format_mp3"
if [[ "$HAS_MP3_SRC" == "1" ]]; then
  MP3_FLAG="--enable format_mp3"
fi
menuselect/menuselect \
  --enable app_audiosocket \
  --enable chan_audiosocket \
  --enable res_audiosocket \
  $MP3_FLAG \
  --enable codec_opus \
  --enable CORE-SOUNDS-EN-WAV \
  --enable CORE-SOUNDS-EN-ULAW \
  --enable CORE-SOUNDS-EN-ALAW \
  --disable BUILD_NATIVE \
  menuselect.makeopts || true

echo "[3/5] Derleniyor ($(nproc) çekirdek)..."
make -j"$(nproc)"
make DESTDIR="$STAGE_DIR" install
make DESTDIR="$STAGE_DIR" samples

echo "[4/5] Debian paket meta verileri ve postinst hazırlanıyor..."
mkdir -p "${STAGE_DIR}/DEBIAN"
mkdir -p "${STAGE_DIR}/etc/systemd/system"
mkdir -p "${STAGE_DIR}/etc/default"

cat <<'EOF' > "${STAGE_DIR}/etc/default/asterisk"
AST_USER="asterisk"
AST_GROUP="asterisk"
COLOR=yes
EOF

cat <<'EOF' > "${STAGE_DIR}/etc/systemd/system/asterisk.service"
[Unit]
Description=Nornia Asterisk PBX Engine
After=network-online.target
Wants=network-online.target

[Service]
Type=forking
User=asterisk
Group=asterisk
ExecStart=/usr/sbin/asterisk -U asterisk -G asterisk
ExecReload=/usr/sbin/asterisk -rx 'module reload'
ExecStop=/usr/sbin/asterisk -rx 'core stop now'
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

cat <<EOF > "${STAGE_DIR}/DEBIAN/control"
Package: ${PKG_NAME}
Version: ${AST_VER}
Section: comm
Priority: optional
Architecture: ${ARCH}
Maintainer: Nornia Engineering <ops@nornia.com.tr>
Depends: libssl3t64 | libssl3, libjansson4, libsrtp2-1, libsqlite3-0, libxml2, libedit2, libuuid1, libcurl4t64 | libcurl4, libopus0, libspandsp2
Conflicts: asterisk
Replaces: asterisk
Description: Nornia Pre-built Asterisk ${AST_VER} (Cisco Patch, WebRTC SRTP AES-256/GCM, AudioSocket)
 Pre-compiled Asterisk telephony engine packaged for Nornia air-gapped offline ISO deployments.
EOF

cat <<'EOF' > "${STAGE_DIR}/DEBIAN/postinst"
#!/bin/bash
set -e
groupadd -f asterisk
id -u asterisk >/dev/null 2>&1 || useradd -r -d /var/lib/asterisk -g asterisk -s /usr/sbin/nologin asterisk
usermod -aG audio,dialout asterisk 2>/dev/null || true

mkdir -p /var/run/asterisk /var/log/asterisk /var/spool/asterisk/monitor /var/lib/asterisk /etc/asterisk/keys
touch /etc/asterisk/pjsip_custom.conf /etc/asterisk/extensions_custom.conf /etc/asterisk/queues_custom.conf /etc/asterisk/features_custom.conf

chown -R asterisk:asterisk /etc/asterisk /var/lib/asterisk /var/spool/asterisk /var/log/asterisk /var/run/asterisk
chmod -R 775 /etc/asterisk /var/run/asterisk
ldconfig
systemctl daemon-reload 2>/dev/null || true
systemctl enable asterisk 2>/dev/null || true
EOF
chmod 0755 "${STAGE_DIR}/DEBIAN/postinst"

echo "[5/5] .deb paketi derleniyor: ${DEB_FILE}..."
dpkg-deb --build --root-owner-group "$STAGE_DIR" "$DEB_FILE"

rm -rf "$WORK_DIR"
echo "======================================================================"
echo "  [BAŞARILI] Paket hazır: ${DEB_FILE} ($(du -h "$DEB_FILE" | cut -f1))"
echo "======================================================================"
