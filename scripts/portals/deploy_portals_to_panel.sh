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

echo "======================================================================"
echo "  NORNIA API & DOKÜMANTASYON PORTALLARI DERLEME + YAYINLAMA"
echo "======================================================================"

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
NODE_OPTIONS="--max-old-space-size=1024" npm run build

echo "[3/5] dokuman.nornia.com.tr (docs-portal) statik derleniyor..."
cd "${REPO_ROOT}/portals/docs-portal"
if [[ ! -d node_modules ]]; then
  if [[ -d "${REPO_ROOT}/license_center/frontend/node_modules" ]]; then
    ln -sfn "${REPO_ROOT}/license_center/frontend/node_modules" node_modules
  else
    npm install --no-audit --no-fund
  fi
fi
rm -rf .next out
NODE_OPTIONS="--max-old-space-size=1024" npm run build

echo "[4/5] Statik dosyalar /var/www/nornia-api ve /var/www/nornia-docs altına kopyalanıyor..."
mkdir -p /var/www/nornia-api /var/www/nornia-docs
rsync -a --delete "${REPO_ROOT}/portals/api-portal/out/" /var/www/nornia-api/
rsync -a --delete "${REPO_ROOT}/portals/docs-portal/out/" /var/www/nornia-docs/

echo "[5/5] Nginx yapılandırması yenileniyor ve SSL sertifikası kontrol ediliyor..."
# Connect Hub Nginx şablonunu güncelleyip SSL sertifikasına api + dokuman ekle
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
