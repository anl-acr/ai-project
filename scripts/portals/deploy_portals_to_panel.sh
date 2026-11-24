#!/usr/bin/env bash
# ==============================================================================
# Nornia API & Dokümantasyon Portalları — Anında Sıfır-RAM Yayınlama Betiği
# ==============================================================================
# Kullanım (panel.nornia.com.tr üzerinde root olarak):
#   sudo bash scripts/portals/deploy_portals_to_panel.sh
#
# Varsayılan mod: `portals/prebuilt/` içindeki hazır statik çıktıları doğrudan
# /var/www/ altına kopyalar (0 MB RAM, ~2 saniye, sunucuyu asla yormaz).
# İstenirse `--rebuild` parametresiyle sunucu üzerinde yeniden Next.js derler.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REBUILD_MODE="${1:-}"
export NEXT_TELEMETRY_DISABLED=1

echo "======================================================================"
echo "  NORNIA API & DOKÜMANTASYON PORTALLARI YAYINLAMA"
echo "======================================================================"

# Önceki yarım kalan next build süreçleri varsa temizle
pkill -f "next build" 2>/dev/null || true

# Önceki yarım kalan çalışmalardan kalmış olabilecek stash klasörlerini geri yükle
for leftover in "${REPO_ROOT}/portals"/.docs_assets_stash_*; do
  if [[ -d "$leftover" ]]; then
    [[ -d "${leftover}/pdfs" && ! -d "${REPO_ROOT}/portals/docs-portal/public/pdfs" ]] && mv "${leftover}/pdfs" "${REPO_ROOT}/portals/docs-portal/public/pdfs"
    [[ -d "${leftover}/screenshots" && ! -d "${REPO_ROOT}/portals/docs-portal/public/screenshots" ]] && mv "${leftover}/screenshots" "${REPO_ROOT}/portals/docs-portal/public/screenshots"
    rm -rf "${leftover}" 2>/dev/null || true
  fi
done

PY_BIN="${REPO_ROOT}/venv/bin/python"
if [[ ! -x "$PY_BIN" ]]; then
  PY_BIN="${REPO_ROOT}/backend/venv/bin/python"
fi
if [[ ! -x "$PY_BIN" ]]; then
  PY_BIN="python3"
fi

API_SRC="${REPO_ROOT}/portals/prebuilt/nornia-api"
DOCS_SRC="${REPO_ROOT}/portals/prebuilt/nornia-docs"

if [[ "${REBUILD_MODE}" == "--rebuild" || ! -f "${API_SRC}/index.html" || ! -f "${DOCS_SRC}/index.html" ]]; then
  echo "[1/3] Kaynaktan derleme modu (--rebuild)..."
  "$PY_BIN" "${REPO_ROOT}/scripts/portals/export_openapi_catalog.py"

  cd "${REPO_ROOT}/portals/api-portal"
  [[ ! -d node_modules && -d "${REPO_ROOT}/license_center/frontend/node_modules" ]] && ln -sfn "${REPO_ROOT}/license_center/frontend/node_modules" node_modules
  rm -rf .next out
  NODE_OPTIONS="--max-old-space-size=1536" npm run build
  API_SRC="${REPO_ROOT}/portals/api-portal/out"

  cd "${REPO_ROOT}/portals/docs-portal"
  [[ ! -d node_modules && -d "${REPO_ROOT}/license_center/frontend/node_modules" ]] && ln -sfn "${REPO_ROOT}/license_center/frontend/node_modules" node_modules
  rm -rf .next out
  NODE_OPTIONS="--max-old-space-size=1536" npm run build
  DOCS_SRC="${REPO_ROOT}/portals/docs-portal/out"
else
  echo "[1/3] Hazır ön-derlenmiş statik paketler kullanılıyor (0 MB RAM / hızlı yayın)..."
fi

echo "[2/3] Statik dosyalar /var/www/nornia-api ve /var/www/nornia-docs altına kopyalanıyor..."
mkdir -p /var/www/nornia-api /var/www/nornia-docs
rsync -a --delete "${API_SRC}/" /var/www/nornia-api/
rsync -a --delete "${DOCS_SRC}/" /var/www/nornia-docs/
rsync -a "${REPO_ROOT}/portals/docs-portal/public/screenshots/" /var/www/nornia-docs/screenshots/
rsync -a "${REPO_ROOT}/portals/docs-portal/public/pdfs/" /var/www/nornia-docs/pdfs/
if [[ -f "${REPO_ROOT}/scripts/installer/install_nornia_online.sh" ]]; then
  cp "${REPO_ROOT}/scripts/installer/install_nornia_online.sh" /var/www/nornia-docs/install_nornia_online.sh
  chmod 0644 /var/www/nornia-docs/install_nornia_online.sh
fi

echo "[3/3] Nginx yapılandırması yenileniyor ve SSL sertifikası kontrol ediliyor..."
"$PY_BIN" -c "
import asyncio
from license_center.backend.connect_hub import ensure_subdomain_ssl_and_nginx
async def run():
    await ensure_subdomain_ssl_and_nginx('api')
    await ensure_subdomain_ssl_and_nginx('dokuman')
asyncio.run(run())
" || true

nginx -t && systemctl reload nginx

echo "======================================================================"
echo "  [TAMAMLANDI — 0 MB EK RAM]"
echo "  * API Portalı      : https://api.nornia.com.tr"
echo "  * Kullanım Kılavuzu: https://dokuman.nornia.com.tr"
echo "======================================================================"
