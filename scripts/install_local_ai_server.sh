#!/usr/bin/env bash
# ==============================================================================
# AIDA Santral - Yerel / Harici AI Motoru Kurulum Betiği (Ollama + Faster-Whisper)
# ==============================================================================
# Kullanım:
#   1) 4 CPU / 4 GB RAM Ana Santral Sunucusuna Kurulum (Sadece 127.0.0.1):
#      sudo bash scripts/install_local_ai_server.sh local
#
#   2) Harici Ayrı Bir LLM Sunucusuna Kurulum (Santralden IP ile Bağlanmak İçin):
#      sudo bash scripts/install_local_ai_server.sh remote
# ==============================================================================

set -e

MODE="${1:-local}"
echo "=========================================================="
echo " AIDA Yerel AI Kurulumu Başlatılıyor (Mod: $MODE)"
echo "=========================================================="

# 1. Ollama Kurulumu (CPU otomatik algılar; NVIDIA GPU varsa otomatik CUDA kullanır)
if ! command -v ollama >/dev/null 2>&1; then
  echo "[1/4] Ollama indiriliyor ve kuruluyor..."
  curl -fsSL https://ollama.com/install.sh | sh
else
  echo "[1/4] Ollama zaten kurulu."
fi

# 2. Systemd Servis Optimizasyonu (4GB RAM Koruması: Tek Model + Tek Paralel İşlem)
echo "[2/4] Bellek & CPU koruma parametreleri yapılandırılıyor..."
mkdir -p /etc/systemd/system/ollama.service.d

if [ "$MODE" = "remote" ]; then
  BIND_HOST="0.0.0.0:11434"
else
  BIND_HOST="127.0.0.1:11434"
fi

cat >/etc/systemd/system/ollama.service.d/override.conf <<EOF
[Service]
Environment="OLLAMA_HOST=${BIND_HOST}"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_KEEP_ALIVE=30s"
Nice=15
EOF

systemctl daemon-reload
systemctl enable ollama
systemctl restart ollama
sleep 3

# 3. 4 GB RAM Dostu Ultra-Hafif Türkçe LLM & 768d Embedding Modellerini İndir
echo "[3/4] Hafif modeller indiriliyor (qwen2.5:1.5b ~980MB & nomic-embed-text ~270MB)..."
ollama pull qwen2.5:1.5b
ollama pull nomic-embed-text

# 4. Çağrı Ses Kaydı Transkripti için Faster-Whisper (CPU int8 destekli)
if [ -d "/opt/ai-project/venv" ]; then
  echo "[4/4] /opt/ai-project/venv içerisine faster-whisper kuruluyor..."
  /opt/ai-project/venv/bin/pip install --upgrade faster-whisper
else
  echo "[4/4] Not: /opt/ai-project/venv bulunamadı (Harici sunucudaysanız normaldir)."
fi

echo "=========================================================="
echo " Kurulum Tamamlandı!"
echo " Ollama Adresi : http://${BIND_HOST}"
echo " Hazır Modeller: qwen2.5:1.5b , nomic-embed-text"
echo "=========================================================="
