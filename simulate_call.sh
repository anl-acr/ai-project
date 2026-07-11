#!/bin/bash
# AI PBX Call Simulation Script
# Bu betik, AI Sesli Asistana gelen yapay bir aramayı simüle eder.

echo "========================================================="
echo "AI PBX Arama Simülasyonu Başlatılıyor..."
echo "========================================================="

# Asterisk konteyneri üzerinde s uzantısına arama yönlendir
docker exec ai_pbx_asterisk asterisk -rx "channel originate Local/s@default extension s@default"

echo "========================================================="
echo "Arama simülasyon komutu Asterisk'e gönderildi."
echo "Canlı panodan (http://localhost:3001) veya backend loglarından takip edebilirsiniz."
echo "========================================================="
