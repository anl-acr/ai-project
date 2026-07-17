#!/bin/bash
# AI PBX Call Simulation Script
# Bu betik, AI Sesli Asistana gelen yapay bir aramayı simüle eder.

echo "========================================================="
echo "AI PBX Arama Simülasyonu Başlatılıyor..."
echo "========================================================="

DID=${1:-"s"}
echo "Arama DID'si: $DID"
# Asterisk konteyneri üzerinde belirlenen DID uzantısına arama yönlendir
docker exec ai_pbx_asterisk asterisk -rx "channel originate Local/$DID@default extension $DID@default"

echo "========================================================="
echo "Arama simülasyon komutu Asterisk'e gönderildi."
echo "Canlı panodan (http://localhost:3001) veya backend loglarından takip edebilirsiniz."
echo "========================================================="
