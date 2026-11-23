#!/usr/bin/env bash
# ==============================================================================
# Nornia — VM Şablon (OVA / QCOW2) Mühürleme / Sysprep Betiği
# ==============================================================================
# Temiz kurulmuş bir Nornia VM'ini VMware (.ova) veya Proxmox/KVM (.qcow2)
# şablonu olarak dışa aktarmadan hemen önce çalıştırılır.
#
# Yaptığı İşlemler:
#   - Makine kimliğini (/etc/machine-id) ve SSH host key'lerini sıfırlar
#   - settings.json dosyasını temiz ilk kurulum durumuna döndürür (/setup açılır)
#   - İlk açılışta yeni DB şifresi, TLS sertifikası ve SSH key üreten bayrağı koyar
#   - Geçici log, cache ve shell geçmişini temizler
# ==============================================================================
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[HATA] Root (sudo) yetkisi gereklidir." >&2
  exit 1
fi

echo "======================================================================"
echo "  Nornia Appliance Sysprep — VM Şablon Mühürleme Başlatılıyor..."
echo "======================================================================"

# Servisleri durdur
pm2 stop all 2>/dev/null || true
systemctl stop asterisk nginx nornia-console-banner 2>/dev/null || true

# settings.json sıfır kurulum haline getir
cat <<'EOF' > /opt/ai-project/backend/settings.json
{
  "company_name": "",
  "setup_wizard": {
    "completed": false
  },
  "users": [],
  "trunks": [],
  "autoprovision": [],
  "tenants": [],
  "pbx": {
    "numbering_plan": {
      "extension_range": {"start": 1000, "end": 1099},
      "queue_range": {"start": 6000, "end": 6099},
      "conference_range": {"start": 8000, "end": 8099},
      "call_pickup": {"group": "*8", "directed": "**8"},
      "pbx_features": {"voicemail_listen": "*97"}
    }
  },
  "nat": {
    "enabled": true,
    "extern_ip": "",
    "local_nets": ["192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12"]
  }
}
EOF

# PostgreSQL içindeki tüm ayar/kullanıcı/oturum verilerini temizle
sudo -u postgres psql -p 5444 -d ai_pbx -c "TRUNCATE TABLE system_settings, system_users, trunks, pbx_queues, calls, transcripts, appointments, chat_sessions, chat_messages, contacts RESTART IDENTITY CASCADE;" 2>/dev/null || \
sudo -u postgres psql -p 5444 -d ai_pbx -c "TRUNCATE TABLE system_settings, system_users, calls, transcripts, chat_sessions, chat_messages, contacts RESTART IDENTITY CASCADE;" 2>/dev/null || true

# Bir sonraki açılışta yeni benzersiz key/TLS/machine-id üretilmesi için bayrak
mkdir -p /var/lib/nornia
touch /var/lib/nornia/needs-firstboot-hygiene

# Makine kimliği & SSH host key sıfırlama (klon çakışmasını önler)
truncate -s 0 /etc/machine-id
rm -f /var/lib/dbus/machine-id
rm -f /etc/ssh/ssh_host_*
rm -f /etc/wireguard/wg-nornia.conf
rm -rf /opt/ai-project/network_backups/*
rm -rf /opt/ai-project/recordings/* /opt/ai-project/uploads/*
rm -f /tmp/nornia_*

# Log ve shell geçmişi temizliği
find /var/log -type f -name "*.log" -exec truncate -s 0 {} \; 2>/dev/null || true
truncate -s 0 /root/.bash_history /home/nornia/.bash_history 2>/dev/null || true
cloud-init clean --logs 2>/dev/null || true

sync
echo "======================================================================"
echo "  [TAMAMLANDI] VM şablon ihracı (OVA / QCOW2) için hazır."
echo "  Makineyi şimdi kapatın: sudo poweroff"
echo "======================================================================"
