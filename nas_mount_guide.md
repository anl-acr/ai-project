# Ubuntu Sunucu Üzerinde Yerel NAS Cihazı Bağlantı (Mount) Rehberi

Bu kılavuz, yerel ağınızda (LAN) bulunan NAS cihazınızı (Synology, QNAP, TrueNAS veya herhangi bir paylaşımlı disk) Ubuntu sunucunuza kalıcı olarak nasıl bağlayacağınızı (mount) adım adım açıklar. 

Ses kayıtlarımızın doğrudan NAS üzerine kaydedilmesi için bu adımların yapılması gerekmektedir.

---

## Seçenek A: NFS (Network File System) İle Bağlantı (Önerilen)
NFS, Linux sunucular arasında en yüksek performanslı ve en stabil çalışan dosya paylaşım protokolüdür.

### 1. Gerekli Paketlerin Kurulması
Ubuntu üzerinde NFS istemcisini kurun:
```bash
sudo apt update
sudo apt install -y nfs-common
```

### 2. Mount Dizininin Oluşturulması
Ses kayıtlarının kaydedileceği hedef klasörü oluşturun ve yetkilendirin:
```bash
sudo mkdir -p /mnt/nas/ai-recordings
# Asterisk ve Backend servislerinin yazabilmesi için izinleri ayarlayın
sudo chown -R 1000:1000 /mnt/nas/ai-recordings
sudo chmod -R 775 /mnt/nas/ai-recordings
```

### 3. Geçici Test Bağlantısı
NAS IP adresini ve NAS üzerinde paylaşılan klasör yolunu (export path) girerek testi yapın:
```bash
sudo mount -t nfs -o rw,sync,hard,intr 192.168.1.100:/volume1/ai-recordings /mnt/nas/ai-recordings
```
*Görüşme Kaydını Test Edin:*
```bash
touch /mnt/nas/ai-recordings/test.txt && ls -l /mnt/nas/ai-recordings/
```
Eğer dosya başarıyla oluşturulduysa bağlantı başarılıdır. Test bağlantısını sökün:
```bash
sudo umount /mnt/nas/ai-recordings
```

### 4. Kalıcı Bağlantı (/etc/fstab Yapılandırması)
Sunucu yeniden başladığında bağlantının otomatik kurulması için `/etc/fstab` dosyasını düzenleyin:
```bash
sudo nano /etc/fstab
```
Dosyanın en altına şu satırı ekleyin:
```text
192.168.1.100:/volume1/ai-recordings /mnt/nas/ai-recordings nfs rw,sync,hard,intr,nofail,x-systemd.automount 0 0
```
*Not: `nofail` parametresi, NAS cihazına ulaşılamadığında Ubuntu sunucunun açılışta kilitlenmesini engeller.*

Bağlantıyı test edin ve aktifleştirin:
```bash
sudo mount -a
```

---

## Seçenek B: Samba / CIFS (Windows Share) İle Bağlantı
Eğer NAS cihazınız sadece kullanıcı adı ve şifre korumalı Samba/Windows paylaşımına izin veriyorsa bu yöntemi kullanın.

### 1. Gerekli Paketlerin Kurulması
Samba istemci paketlerini kurun:
```bash
sudo apt update
sudo apt install -y cifs-utils
```

### 2. Kimlik Bilgilerinin Güvenli Saklanması
Kullanıcı adı ve şifrenizin herkes tarafından görünmemesi için gizli bir kimlik dosyası oluşturun:
```bash
sudo nano /etc/nas-credentials
```
İçerisine şu bilgileri girin (NAS kullanıcı adınız ve şifreniz):
```text
username=nas_kullanici_adi
password=nas_sifre
domain=WORKGROUP
```
Dosya izinlerini sadece root okuyabilecek şekilde kısıtlayın:
```bash
sudo chmod 600 /etc/nas-credentials
```

### 3. Mount Dizininin Oluşturulması
```bash
sudo mkdir -p /mnt/nas/ai-recordings
```

### 4. Kalıcı Bağlantı (/etc/fstab Yapılandırması)
`/etc/fstab` dosyasını açın:
```bash
sudo nano /etc/fstab
```
En alta şu satırı ekleyin (Asterisk ve Backend uid/gid değerlerini 1000 veya Asterisk kullanıcısının ID'si olarak güncelleyin):
```text
//192.168.1.100/ai-recordings /mnt/nas/ai-recordings cifs credentials=/etc/nas-credentials,iocharset=utf8,uid=1000,gid=1000,nofail,x-systemd.automount 0 0
```

Bağlantıyı aktifleştirin:
```bash
sudo mount -a
```

---

## İzin Sorunlarının Giderilmesi (Troubleshooting)
Sistem çalışırken ses kayıtlarının yazılamaması genellikle izin (permission) sorunlarından kaynaklanır.
* **Asterisk İzinleri:** Eğer Asterisk sunucuda `asterisk` kullanıcısı ile çalışıyorsa, mount klasörünün sahibi asterisk olmalıdır:
  ```bash
  sudo chown -R asterisk:asterisk /mnt/nas/ai-recordings
  ```
* **Docker İzinleri:** Backend uygulamanız Docker konteynerında çalışıyorsa, konteyner içindeki kullanıcının (genellikle root veya node/python kullanıcısı) NAS dizinine yazma yetkisi olmalıdır. Bunun en temiz yolu NFS paylaşımında NAS tarafında `No Squash` (Root Squash'i Kapat) seçeneğini aktif etmektir.
