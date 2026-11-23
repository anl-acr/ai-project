#!/usr/bin/env bash
# ==============================================================================
# Nornia API & Dokümantasyon Portalları — Tek Komut Derleme & Yayınlama Betiği
# ==============================================================================
# Kullanım (panel.nornia.com.tr üzerinde root olarak):
#   sudo bash scripts/portals/deploy_portals_to_panel.sh
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
export NEXT_TELEMETRY_DISABLED=1

# Düşük RAM'li sunucularda (2GB vb.) swap yoksa 2GB geçici swap koruması
ensure_temp_swap() {
  local mem_mb
  mem_mb=$(free -m 2>/dev/null | awk '/^Mem:/ {print $2}' || echo 4096)
  local swap_mb
  swap_mb=$(free -m 2>/dev/null | awk '/^Swap:/ {print $2}' || echo 0)
  if [[ "$mem_mb" -lt 3500 && "$swap_mb" -lt 1024 && ! -f /swapfile_nornia_build ]]; then
    echo "  [*] Düşük RAM algılandı (${mem_mb} MB) — derleme koruması için geçici 2GB swap oluşturuluyor..."
    fallocate -l 2G /swapfile_nornia_build 2>/dev/null || dd if=/dev/zero of=/swapfile_nornia_build bs=1M count=2048 status=none
    chmod 600 /swapfile_nornia_build
    mkswap /swapfile_nornia_build >/dev/null
    swapon /swapfile_nornia_build || true
  fi
}

STASH_DIR=""
restore_docs_assets() {
  if [[ -n "${STASH_DIR}" && -d "${STASH_DIR}" ]]; then
    [[ -d "${STASH_DIR}/pdfs" ]] && mv "${STASH_DIR}/pdfs" "${REPO_ROOT}/portals/docs-portal/public/pdfs"
    [[ -d "${STASH_DIR}/screenshots" ]] && mv "${STASH_DIR}/screenshots" "${REPO_ROOT}/portals/docs-portal/public/screenshots"
    rmdir "${STASH_DIR}" 2>/dev/null || true
    STASH_DIR=""
  fi
}
trap restore_docs_assets EXIT

echo "======================================================================"
echo "  NORNIA API & DOKÜMANTASYON PORTALLARI DERLEME + YAYINLAMA"
echo "======================================================================"

ensure_temp_swap

echo "[1/5] OpenAPI 3.1 + Postman + API Kataloğu güncelleniyor..."
PY_BIN="${REPO_ROOT}/venv/bin/python"
if [[ ! -x "$PY_BIN" ]]; then
  PY_BIN="${REPO_ROOT}/backend/venv/bin/python"
fi
if [[ ! -x "$PY_BIN" ]]; then
  PY_BIN="python3"
fi
"$PY_BIN" "${REPO_ROOT}/scripts/portals/export_openapi_catalog.py"

echo "[2/5] api.nornia.com.tr (api-portal) statik derleniyor..."
cd "${REPO_ROOT}/portals/api-portal"
if [[ ! -d node_modules ]]; then
  if [[ -d "${REPO_ROOT}/license_center/frontend/node_modules" ]]; then
    ln -sfn "${REPO_ROOT}/license_center/frontend/node_modules" node_modules
  else
    npm install --no-audit --no-fund
  fi
fi
rm -rf .next out
NODE_OPTIONS="--max-old-space-size=1536" npm run build

echo "[3/5] dokuman.nornia.com.tr (docs-portal) statik derleniyor (düşük RAM modu)..."
cd "${REPO_ROOT}/portals/docs-portal"
if [[ ! -d node_modules ]]; then
  if [[ -d "${REPO_ROOT}/license_center/frontend/node_modules" ]]; then
    ln -sfn "${REPO_ROOT}/license_center/frontend/node_modules" node_modules
  else
    npm install --no-audit --no-fund
  fi
fi

# Önceki yarım kalan çalışmalardan kalmış olabilecek stash klasörlerini otomatik geri yükle
for leftover in "${REPO_ROOT}/portals"/.docs_assets_stash_*; do
  if [[ -d "$leftover" ]]; then
    [[ -d "${leftover}/pdfs" && ! -d "${REPO_ROOT}/portals/docs-portal/public/pdfs" ]] && mv "${leftover}/pdfs" "${REPO_ROOT}/portals/docs-portal/public/pdfs"
    [[ -d "${leftover}/screenshots" && ! -d "${REPO_ROOT}/portals/docs-portal/public/screenshots" ]] && mv "${leftover}/screenshots" "${REPO_ROOT}/portals/docs-portal/public/screenshots"
    rm -rf "${leftover}" 2>/dev/null || true
  fi
done

# Büyük statik varlıkları (62 görsel + 51 PDF) Next.js build sırasında kenara al, build sonrası doğrudan kopyala
STASH_DIR="${REPO_ROOT}/portals/.docs_assets_stash_$$"
mkdir -p "${STASH_DIR}"
[[ -d public/pdfs ]] && mv public/pdfs "${STASH_DIR}/pdfs"
[[ -d public/screenshots ]] && mv public/screenshots "${STASH_DIR}/screenshots"

rm -rf .next out
NODE_OPTIONS="--max-old-space-size=1536" npm run build

restore_docs_assets

echo "[4/5] Statik dosyalar /var/www/nornia-api ve /var/www/nornia-docs altına kopyalanıyor..."
mkdir -p /var/www/nornia-api /var/www/nornia-docs
rsync -a --delete "${REPO_ROOT}/portals/api-portal/out/" /var/www/nornia-api/
rsync -a --delete "${REPO_ROOT}/portals/docs-portal/out/" /var/www/nornia-docs/
rsync -a "${REPO_ROOT}/portals/docs-portal/public/screenshots/" /var/www/nornia-docs/screenshots/
rsync -a "${REPO_ROOT}/portals/docs-portal/public/pdfs/" /var/www/nornia-docs/pdfs/

echo "[5/5] Nginx yapılandırması yenileniyor ve SSL sertifikası kontrol ediliyor..."
"$PY_BIN" -c "
import asyncio
from license_center.backend.connect_hub import ensure_subdomain_ssl_and_nginx
async def run():
    await ensure_subdomain_ssl_and_nginx('api')
    await ensure_subdomain_ssl_and_nginx('dokuman')
asyncio.run(run())
" || true

nginx -t && systemctl reload nginx
pm2 restart all || true

echo "======================================================================"
echo "  [TAMAMLANDI]"
echo "  * API Portalı      : https://api.nornia.com.tr"
echo "  * Kullanım Kılavuzu: https://dokuman.nornia.com.tr"
echo "======================================================================"
