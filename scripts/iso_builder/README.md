# Nornia — Tam Çevrimdışı (Air-Gapped) Otomatik ISO Üretimi

Bu dizin, internetsiz ortamda **sıfırdan ve katılımsız (Autoinstall)** kurulum yapan özel **Nornia Ubuntu 24.04 LTS ISO** imajını tek komutla üretmek için gerekli tüm araçları içerir.

## ISO İçeriğinde Neler Var?
- **Ubuntu Server 24.04 LTS** + Tam Otomatik Subiquity Autoinstall (GRUB'da 5 sn içinde otomatik başlar; çoklu diskli sunucular için 2. seçenek olarak "Disk Seçimli Kurulum" bulunur)
- **Tam Çevrimdışı Paketler:**
  - Yerel APT deposu (PostgreSQL 16 + pgvector, Nginx, WireGuard, UFW, Fail2Ban, Chrony, Node.js 20, Python3, OpenSSH, `sngrep`, `tcpdump`, `mtr`, `traceroute`, `dnsutils`)
  - Önceden derlenmiş **Asterisk 18.11.3** (`nornia-asterisk_18.11.3_amd64.deb` — Cisco yaması, WebRTC SRTP AES-256/GCM, AudioSocket)
  - Tüm Python çevrimdışı `.whl` paketleri ve çevrimdışı **PM2**
  - Önceden build edilmiş temiz **Nornia Frontend + Backend** paketi
- **SSH Varsayılan Açık** (`22/tcp`, `PermitRootLogin no`):
  - Tam yetkili yönetim hesabı: **`nornia`**
  - Kısıtlı ağ/IP destek hesabı: **`destek`** (varsayılan şifre: `destekgiris2027!*`, ham bash'e düşemez, yalnızca `nornia-destek-shell` üzerinden ağ analizi, IP/Gateway/DNS tanımı, Rollback ve salt-okunur servis sağlık kontrolü yapabilir)
- **İlk Açılış:** Konsolda canlı IP + `http://<IP>/setup` + Donanım ID görünür. Tarayıcıdan açıldığında tek seferlik `/setup` sihirbazı `admin` şifresini belirler ve kalıcı olarak kilitlenir.

---

## ISO Nasıl Üretilir? (Ubuntu 24.04 Linux Sunucuda)

```bash
cd /opt/ai-project
git pull origin main

# Varsayılan şifrelerle ISO üretimi:
sudo bash scripts/iso_builder/build_nornia_iso.sh

# Özel yönetici / destek şifreleriyle ISO üretimi (Bash !* genişlemesi olmaması için TEK TIRNAK kullanın):
sudo NORNIA_SYSADMIN_PASS='GucluYoneticiSifresi!*' \
     NORNIA_DESTEK_PASS='destekgiris2027!*' \
     bash scripts/iso_builder/build_nornia_iso.sh
```

Üretim tamamlandığında imaj şu konumda oluşur:
- `dist/nornia-vX.Y.Z-ubuntu24.04-amd64.iso`
- `dist/nornia-vX.Y.Z-ubuntu24.04-amd64.iso.sha256`

> **Önbellek Notu:** İlk çalıştırmada Ubuntu 24.04 taban ISO ve `nornia-asterisk_18.11.3_amd64.deb` `/var/cache/nornia-iso/` dizininde önbelleğe alınır. Sonraki sürümlerde yeni ISO üretimi birkaç dakika içinde tamamlanır.

---

## VM Şablonu (OVA / QCOW2) Mühürleme
Temiz ISO ile kurulmuş bir sanal makineyi klonlanabilir VMware `.ova` veya Proxmox `.qcow2` şablonuna çevirmek için kapatmadan önce şunu çalıştırın:

```bash
sudo bash /opt/ai-project/scripts/installer/nornia_sysprep.sh
sudo poweroff
```
