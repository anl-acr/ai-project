#!/usr/bin/env bash
# AIDA Control Center - Central License Authority & Fleet Monitoring Startup Script

BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PYTHON_BIN="${BASE_DIR}/venv/bin/python"

if [ ! -f "$PYTHON_BIN" ]; then
    PYTHON_BIN="python3"
fi

echo "================================================================="
echo " 🛡️  AIDA MASTER CONTROL CENTER - LİSANS VE FİLO YÖNETİM PORTALI"
echo "================================================================="

# 1. Start Central License Backend API (Port 8050)
echo "[1/2] Starting Central License API Server on port 8050..."
$PYTHON_BIN -m uvicorn license_center.backend.main:app --host 0.0.0.0 --port 8050 --reload &
BACKEND_PID=$!

# 2. Start Central License Master Frontend (Port 3050)
echo "[2/2] Starting Central License Master Console Frontend on port 3050..."
cd "${BASE_DIR}/license_center/frontend" && npm run start &
FRONTEND_PID=$!

echo "-----------------------------------------------------------------"
echo " ✅ AIDA Master Center Başarıyla Çalıştırıldı!"
echo " 🌐 Master Web Paneli : http://localhost:3050"
echo " 🔌 Master API Endpoint: http://localhost:8050"
echo "-----------------------------------------------------------------"

wait $BACKEND_PID $FRONTEND_PID
