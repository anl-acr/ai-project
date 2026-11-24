export const CHAPTERS_BASLANGIC = [
  {
    id: "kurulum-dokumani",
    number: "01",
    groupId: "baslangic",
    category: "Başlangıç & Kurulum",
    title: "Kurulum Dokümanı — Çevrimdışı ISO, Kaynak Hesaplayıcı & Script Kurulum",
    shortTitle: "Kurulum Dokümanı",
    menuPath: "Kurulum Öncesi → ISO İndir / Kaynak Hesaplayıcı / Ubuntu 24.04 Script",
    pbxRoute: "/kurulum-dokumani",
    permissions: ["Sunucu root / sudo erişimi (Ubuntu 24.04 LTS veya Nornia Çevrimdışı ISO)"],
    badge: "ISO • Hesaplayıcı • Script",
    readMinutes: 14,
    summary:
      "Nornia Enterprise AI PBX'i ister tam çevrimdışı (Air-Gapped) Nornia ISO imajıyla ister temiz bir Ubuntu 24.04 LTS sunucusu üzerine tek komutluk çevrimiçi kurulum betiğiyle kurma rehberidir. Sunucu kaynak hesaplayıcısı, ISO indirme bağlantısı, SHA-256 doğrulama ve servis sağlık kontrollerini tek sayfada toplar.",
    showIsoDownload: true,
    isoMeta: {
      version: "v3.10.11",
      os: "Ubuntu 24.04 LTS (amd64)",
      size: "4.5 GB",
      filename: "nornia-v3.10.11-ubuntu24.04-amd64.iso",
      downloadUrl: "https://dokuman.nornia.com.tr/downloads/nornia-v3.10.11-ubuntu24.04-amd64.iso",
      sha256Url: "https://dokuman.nornia.com.tr/downloads/nornia-v3.10.11-ubuntu24.04-amd64.iso.sha256",
      sha256: "b38169011e07729818e21231731494efd2c72a5e7b368adec121c7cd35a141be",
      updatedAt: "24 Kasım 2026"
    },
    showSizingCalculator: true,
    prerequisites: [
      "Kurulum öncesi aşağıdaki 'Nornia Sunucu Kaynak Hesaplama Aracı' ile kullanıcı adedi, eşzamanlı çağrı, ses kaydı saklama süresi ve yerel LLM/AI tercihinize göre gerekli vCPU, RAM, NVMe/NAS disk ve bant genişliğini belirleyin.",
      "Kurulum Seçeneği 1 (Çevrimdışı ISO): 64-bit (amd64) fiziksel sunucu veya VMware / Proxmox / Hyper-V sanal makinesine Nornia ISO imajını bağlayın (kurulum sırasında internet gerekmez).",
      "Kurulum Seçeneği 2 (Script ile Çevrimiçi Kurulum): Temiz bir Ubuntu 24.04 LTS (amd64) işletim sistemi ve internet erişimi hazır olmalıdır.",
      "Kurulum tamamlandıktan sonra tarayıcıda açılacak 6 adımlı İlk Kurulum Sihirbazı (/setup) için Merkez Lisans Paneli'nden alınmış AIDA-... lisans anahtarınızı hazır bulundurun."
    ],
    fieldTable: [
      { field: "Tam Çevrimdışı ISO (Air-Gapped)", type: "Önyüklenebilir ISO (4.5 GB)", defaultVal: "nornia-v3.10.11-ubuntu24.04-amd64.iso", required: false, description: "İnternet erişimi olmayan kapalı ağlar ve hızlı appliance kurulumu için Ubuntu 24.04, PostgreSQL 16 + pgvector, Asterisk, Next.js 16.4.6, Fail2Ban ve tüm güvenlik sertleştirmelerini tek imajda içerir." },
      { field: "Çevrimiçi Kurulum Betiği", type: "Bash Script (12 Adım)", defaultVal: "install_nornia_online.sh", required: false, description: "Bulut (VPS/AWS/Hetzner) veya mevcut temiz Ubuntu 24.04 LTS makinelerde tek komutla tüm Nornia servislerini ve güvenlik duvarını kurar." },
      { field: "Minimum Donanım (≤ 25 Kullanıcı)", type: "Sunucu Kaynağı", defaultVal: "4 vCPU / 8 GB RAM / 80 GB NVMe", required: true, description: "Bulut AI (Gemini/OpenAI) ile standart kurumsal santral kurulumları için başlangıç önerisi. Yerel LLM (Ollama) için aşağıdaki hesaplayıcıyı kullanın." },
      { field: "Yönetim & Destek SSH Hesapları", type: "Linux Hesapları", defaultVal: "nornia (sudo) / destek (kısıtlı)", required: true, description: "Yeni çevrimiçi kurulumlarda her sunucu için benzersiz rastgele parolalar üretilir ve yalnızca root'un okuyabildiği /root/nornia-credentials.txt (chmod 0600) dosyasına kaydedilir." },
      { field: "Güvenlik & Sertleştirme Paketi", type: "Yerleşik Koruma", defaultVal: "UFW + Fail2Ban (2 Jail) + HSTS + 401 Auth", required: true, description: "Merkezi imzalı oturum doğrulaması (NSESS), bcrypt parola hash, localhost-only DB/Backend/AMI, Fail2Ban [asterisk]+[sshd] ve Nginx TLS 1.2/1.3 güvenlik başlıkları hazır gelir." }
    ],
    sections: [
      {
        heading: "1. Tam Çevrimdışı (Air-Gapped) Nornia ISO ile Kurulum",
        body: "Yukarıdaki indirme kartından aldığınız Nornia Appliance ISO dosyası tüm işletim sistemi, Asterisk, PostgreSQL 16, Node.js 20 LTS, Python sanal ortamı ve derlenmiş Next.js arayüzünü çevrimdışı paketlenmiş halde içerir. Fiziksel sunucuya USB (Rufus / BalenaEtcher / Ventoy) ile veya VMware ESXi, Proxmox VE, Hyper-V sanallaştırma ortamlarında sanal CD/DVD olarak bağlayarak 10–15 dakika içinde sıfır dokunuşla kurulum yapabilirsiniz.",
        steps: [
          "Yukarıdaki 'Nornia ISO İndir' butonundan nornia-v3.10.11-ubuntu24.04-amd64.iso dosyasını indirin ve SHA-256 özetini doğrulayın.",
          "ISO dosyasını sanal makineye (VMware / Proxmox / Hyper-V) bağlayın veya fiziksel sunucu için USB belleğe yazdırıp UEFI/BIOS üzerinden ISO'dan başlatın.",
          "Açılış (GRUB) menüsünden 'Nornia Otomatik Kurulum' seçeneğini seçin; disk bölümleme, paket kurulumu, servis yapılandırması ve güvenlik duvarı tamamen otomatik tamamlanır.",
          "Sunucu yeniden başladığında TTY1 konsol ekranında görünen yerel IP adresini not edin ve tarayıcıdan http://<sunucu-ip>/setup adresini açarak 'Bölüm 02 — İlk Kurulum Sihirbazı' adımlarına geçin."
        ],
        codeBlock: {
          title: "İndirilen ISO Dosyasının SHA-256 Bütünlük Doğrulaması",
          lang: "bash",
          code: `# macOS üzerinde doğrulama:
shasum -a 256 ~/Downloads/nornia-v3.10.11-ubuntu24.04-amd64.iso

# Linux üzerinde doğrulama:
sha256sum nornia-v3.10.11-ubuntu24.04-amd64.iso

# Beklenen SHA-256 özeti (v3.10.11):
# b38169011e07729818e21231731494efd2c72a5e7b368adec121c7cd35a141be`
        }
      },
      {
        heading: "2. Temiz Ubuntu 24.04 LTS Üzerine Script ile Çevrimiçi (Online) Kurulum",
        body: "ISO bağlama imkanı olmayan bulut sunucularında (VPS, AWS, Hetzner, DigitalOcean) veya halihazırda temiz Ubuntu 24.04 LTS (amd64) kurulu makinelerde resmi çevrimiçi kurulum betiği (install_nornia_online.sh) ile tüm sistem 12 adımda otomatik kurulur. Betik; imzalı NodeSource GPG deposundan Node.js 20 LTS, PostgreSQL 16 (Port 5444 + pgvector), Asterisk PJSIP (legacy chan_sip kapalı), Python sanal ortamı, Next.js 16.4.6 üretim derlemesi, PM2 servisleri (127.0.0.1 kilitli), Nginx HTTPS/WSS + güvenlik başlıkları, UFW ve Fail2Ban (sshd + asterisk jail) katmanlarını ISO ile birebir aynı standartta kurar.",
        steps: [
          "Sunucunuza SSH ile root veya sudo yetkili kullanıcı olarak bağlanın ve işletim sisteminin Ubuntu 24.04 LTS olduğunu doğrulayın (`lsb_release -a`).",
          "`wget https://dokuman.nornia.com.tr/install_nornia_online.sh` komutuyla resmi kurulum betiğini sunucunuza indirin.",
          "Betiği `sudo bash install_nornia_online.sh` ile başlatın (parametre verilmezse etkileşimli olarak paket/erişim adresini sorar; ya da `--bundle-url` / `--asterisk-deb` bayraklarıyla tek satırda çalıştırabilirsiniz).",
          "Düşük bellekli sunucularda (< 6 GB RAM) betik derleme kararlılığı için otomatik 4 GB swap alanı oluşturur; kurulumda üretilen benzersiz rastgele AMI ve SSH parolaları `/root/nornia-credentials.txt` (`chmod 0600`) dosyasına kaydedilir.",
          "Kurulum tamamlandığında ekranda PostgreSQL, Asterisk, Backend (8000) ve Frontend (3000) sağlık doğrulaması ile `http://<sunucu-ip>/setup` adresi yazdırılır; tarayıcıdan 'Bölüm 02 — İlk Kurulum Sihirbazı' ile devam edilir."
        ],
        codeBlock: {
          title: "Ubuntu 24.04 LTS Script ile Çevrimiçi Kurulum Komutları",
          lang: "bash",
          code: `# 1. Resmi Nornia kurulum betiğini indir
wget https://dokuman.nornia.com.tr/install_nornia_online.sh

# 2. Etkileşimli başlatma
sudo bash install_nornia_online.sh

# --- VEYA tek satırda parametreli kurulum ---
sudo bash install_nornia_online.sh \\
  --bundle-url "<NORNIA_KURUMSAL_PAKET_URL>" \\
  --bundle-token "<YETKILI_KURULUM_ANAHTARI>" \\
  --asterisk-deb "<NORNIA_ASTERISK_DEB_URL>"

# Opsiyonel güvenlik ve bulut parametreleri:
#   --sysadmin-pass '<guclu-sifre>'   : 'nornia' SSH hesabı şifresi (verilmezse rastgele üretilir)
#   --destek-pass '<destek-sifre>'    : Kısıtlı 'destek' konsol şifresi (verilmezse rastgele üretilir)
#   --lock-root-ssh                   : Root SSH girişini tamamen kapatır (PermitRootLogin no)
#   --skip-ufw                        : Mevcut harici bulut güvenlik duvarını korur

# 3. Kurulum günlüğünü canlı izleme & üretilen parolaları görme
tail -f /var/log/nornia-online-install.log
sudo cat /root/nornia-credentials.txt`
        },
        callout: {
          type: "warning",
          title: "Güvenlik & Özel Kaynak Politikası",
          text: "Nornia kaynak kodları kapalı kurumsal lisans altındadır. Kurulum sonrası tüm hassas parolalar (DB, AMI, Oturum Anahtarı, SSH) sunucuya özel rastgele üretilir; backend/.env ve /root/nornia-credentials.txt dosyaları yalnızca root (chmod 0600) erişimine açıktır."
        }
      },
      {
        heading: "3. Servis Mimarisi, Port Haritası ve Sağlık Doğrulama",
        body: "Nornia tek sunucuda tümleşik kurumsal mimariyle çalışır. PM2 altında çalışan aida-app (Next.js 16.4.6 arayüz, 127.0.0.1:3000) ve aida-backend (FastAPI + AudioSocket AI TCP Motoru, 127.0.0.1:8000 / 9092), Nginx Reverse Proxy (80/443), PostgreSQL 16 (127.0.0.1:5444, ai_pbx veritabanı) ve Asterisk PJSIP (5060 UDP/TCP, 5061 TLS, 5160 Cisco TCP, 8089 WSS WebRTC, 10000–20000 UDP RTP) eşzamanlı çalışır.",
        codeBlock: {
          title: "Kurulum Sonrası Sunucu Sağlık Doğrulama Komutları (SSH)",
          lang: "bash",
          code: `# 1. PM2 servis durumunu kontrol et
pm2 status

# 2. Asterisk PJSIP transport ve kayıtlarını doğrula
asterisk -rx "pjsip show transports"
asterisk -rx "pjsip show endpoints"

# 3. Fail2Ban (sshd + asterisk) ve API sağlık kontrolü
sudo fail2ban-client status
curl -sk https://127.0.0.1/api/version`
        }
      }
    ],
    troubleshooting: [
      { problem: "ISO kurulumunda sanal makine önyükleme (boot) yapmıyor", cause: "VM ayarlarında Secure Boot açık kalmış veya CD/DVD önyükleme sırası diskin gerisinde.", solution: "VMware/Proxmox/Hyper-V ayarlarından Secure Boot'u devre dışı bırakıp ISO/CD-ROM sürücüsünü 1. önyükleme sırasına alın." },
      { problem: "Çevrimiçi kurulumda Next.js derlemesi bellek (OOM) hatası veriyor", cause: "Sunucuda 4 GB'tan az RAM var ve swap alanı kapalı.", solution: "install_nornia_online.sh 6 GB altı RAM'de otomatik 4 GB swap açar; minimum 4 vCPU / 8 GB RAM önerilir." },
      { problem: "Kurulum bitti ama tarayıcıdan http://<ip>/setup açılmıyor", cause: "Yerel güvenlik duvarı veya kurumsal ağ politikası 80/443 portunu engelliyor olabilir.", solution: "Sunucuda `pm2 status` ve `systemctl status nginx` çıktılarının active/online olduğunu ve `ufw status` içinde 80/443 izinlerini doğrulayın." }
    ],
    relatedPages: ["ilk-kurulum-sihirbazi", "sistem-mimarisi-ve-servis-haritasi", "sunucu-ag-ve-nornia-connect"],
    relatedApis: ["GET /api/version", "GET /api/setup/status", "GET /api/system/health"]
  },
  {
    id: "ilk-kurulum-sihirbazi",
    number: "02",
    groupId: "baslangic",
    category: "Başlangıç & Kurulum",
    title: "İlk Kurulum Sihirbazı (/setup)",
    shortTitle: "İlk Kurulum Sihirbazı",
    menuPath: "Tarayıcı → http://<sunucu-ip>/setup",
    pbxRoute: "/setup",
    permissions: ["system_settings:write (İlk kurulum — oturum gerektirmez, tamamlanınca otomatik kilitlenir)"],
    badge: "Sihirbaz • 6 Adım",
    readMinutes: 8,
    summary:
      "ISO veya çevrimiçi kurulum betiği tamamlandıktan sonra tarayıcıda açılan 6 adımlı İlk Kurulum Sihirbazı (/setup) üzerinden statik LAN IP, NAT, donanım kilidi (HW-ID) lisansı, Nornia Connect alt alan adı, numara planı ve yönetici hesabını adım adım yapılandırma rehberidir.",
    prerequisites: [
      "Bölüm 01 (Kurulum Dokümanı) adımlarıyla Nornia ISO veya Ubuntu 24.04 çevrimiçi kurulumu tamamlanmış ve sunucu yerel ağdan IP almış olmalıdır.",
      "Merkez Lisans Paneli'nden (panel.nornia.com.tr) bu sunucunun HW-ID'si için üretilmiş imzalı AIDA-... lisans anahtarı hazır olmalıdır.",
      "Kullanılacak kalıcı yerel LAN IP/CIDR, Gateway, DNS bilgileri ve tercih edilecek <firma>.nornia.com.tr alt alan adı belirlenmiş olmalıdır."
    ],
    screenshots: [
      {
        src: "/screenshots/setup-01-network.jpg",
        caption: "Adım 1/6 — Ağ & NAT Ayarları: Algılanan ağ kartları (enp0s3 / wg0), kalıcı statik LAN IP, Gateway, DNS ve PJSIP Dinamik NAT",
        routeHint: "http://<sunucu-ip>/setup → Adım 1: Ağ Ayarları"
      },
      {
        src: "/screenshots/setup-02-license.jpg",
        caption: "Adım 2/6 — Lisans Aktivasyonu & Donanım Kimliği: HW-ID kopyalama ve imzalı AIDA-... anahtar doğrulaması",
        routeHint: "http://<sunucu-ip>/setup → Adım 2: Lisans"
      }
    ],
    fieldTable: [
      { field: "Santral Yerel LAN IP (CIDR)", type: "IPv4/Mask", defaultVal: "DHCP IP /24", required: true, description: "Sunucunun kalıcı yerel IP adresi (örn. 192.168.1.25/24). Adım 6 'Kurulumu Tamamla' butonuna basıldığında Ubuntu Netplan (/etc/netplan/99-nornia-static.yaml) dosyasına yazılır ve 2 saniye sonra canlı uygulanır; çakışan 00-installer-config.yaml otomatik etkisizleştirilir." },
      { field: "Varsayılan Ağ Geçidi (Gateway)", type: "IPv4", defaultVal: "192.168.1.1", required: true, description: "İnternet ve SIP operatör çıkışı için yönlendirici (router) IP adresi." },
      { field: "Birincil / İkincil DNS", type: "IPv4", defaultVal: "8.8.8.8 / 1.1.1.1", required: true, description: "Nornia Connect, Let's Encrypt ve SIP Trunk alan adı çözümlemesi için DNS sunucuları." },
      { field: "PJSIP Dinamik NAT & Dış IP", type: "Boolean + IPv4", defaultVal: "NAT Aktif", required: false, description: "Santral NAT arkasındaysa PJSIP transport'larına (UDP/TCP/WS/WSS) external_signaling_address ve external_media_address enjekte eder." },
      { field: "Yerel Ağ Aralıkları (Local Nets)", type: "CIDR List", defaultVal: "192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12", required: false, description: "Asterisk'in NAT çevirisi yapmayacağı iç ağ (LAN/VPN) blokları." },
      { field: "Lisans Anahtarı (AIDA-...)", type: "HMAC-SHA256 Token", defaultVal: "Zorunlu", required: true, description: "AIDA-{KOD}-{YYYYMMDD}-{HW8}-{SIG8}[.BASE64_KOTA] biçimindedir. Büyük/küçük harf duyarlı Base64 kota uzantısı (max_users, max_concurrent_calls, allowed_features) otomatik çözülür." },
      { field: "FQDN & Nornia Alt Alan Adı", type: "Bulut / Özel / LAN", defaultVal: "Nornia Bulut FQDN", required: true, description: "<ad>.nornia.com.tr adresini belirler. 'Kontrol Et' butonu Merkez Connect Hub'a HTTPS sorgusu atar; dolu veya rezerve (api, dokuman, panel, connect) ise ilerlemeyi engeller." },
      { field: "Dahili & Numara Planı", type: "4 Hane / 3 Hane", defaultVal: "1000–1099 / 6000–6099 / 8000–8099", required: true, description: "4 Haneli Kurumsal Plan (Dahililer 1000–1099, ACD Kuyruklar 6000–6099, Konferans 8000–8099, *8/**8/*97) ve isteğe bağlı Hızlı İlk Dahili Oluşturucu." },
      { field: "Saat Dilimi, NTP & Dil", type: "Timezone + NTP + TR/EN", defaultVal: "Europe/Istanbul • NTP • Türkçe", required: true, description: "Sistem saat dilimini, otomatik NTP eşitlemesini (pool.ntp.org / tr.pool.ntp.org), tarih/saat biçimini ve varsayılan arayüz dilini ayarlar." },
      { field: "Sistem Yöneticisi (admin) Şifresi", type: "Email + Parola (bcrypt)", defaultVal: "admin", required: true, description: "Adım 6'da oluşturulan süper yönetici ilk giriş şifresi (bcrypt cost=12 ile hashlenerek saklanır) ve şifre kurtarma e-posta adresi." }
    ],
    sections: [
      {
        heading: "1. 6 Adımlı Kurulum Sihirbazı Akışı",
        body: "Tarayıcıda http://<sunucu-ip>/setup adresi açıldığında sihirbaz 6 ardışık adımdan geçer. Değişiklikler son adımda 'Ayarları Uygula ve Kurulumu Tamamla' denilene kadar sunucunun mevcut ağ bağlantısını koparmaz; böylece tarayıcı oturumunuz kesilmeden tüm ayarları güvenle tamamlayabilirsiniz.",
        steps: [
          "Adım 1 — Ağ & NAT Ayarları: Algılanan ağ kartlarını (enp0s3/wg0) görün, kalıcı LAN IP/CIDR, Gateway, DNS ve gerekirse PJSIP Dış IP (External IP) girin.",
          "Adım 2 — Lisans Aktivasyonu & Donanım Kimliği: Ekranda gösterilen Donanım Kimliğini (HW-XXXX-XXXX) merkez panele verip aldığınız AIDA-... anahtarını yapıştırın ve 'Anahtarı Doğrula'ya basın.",
          "Adım 3 — FQDN Yapısı & Uzak Erişim: Nornia Bulut FQDN (örn. acme.nornia.com.tr), Özel Kurumsal FQDN veya Sadece Yerel Ağ (LAN) modunu seçin; bulut modunda 'Kontrol Et' ile müsaitliği doğrulayın.",
          "Adım 4 — Dahili Yapısı ve Numara Planı: 4 Haneli Kurumsal Plan (1000–1099) veya 3 Haneli Kompakt Plan seçin, kuyruk/konferans aralıkları ile özellik kodlarını (*8, **8, *97) ayarlayın ve isterseniz ilk dahilileri seri ekleyin.",
          "Adım 5 — Saat, Tarih & Dil: Sistem saat dilimini (İstanbul / Türkiye TRT), Otomatik NTP (veya kapalı ağlar için Manuel Tarih/Saat), tarih-saat formatını ve varsayılan dili (Türkçe / English) belirleyin.",
          "Adım 6 — Özet, Yönetici (admin) Hesabı & Uygula: 5 adımın özetini kontrol edin, zorunlu admin ilk giriş şifresini belirleyin ve 'Ayarları Uygula ve Kurulumu Tamamla' butonuna tıklayın."
        ],
        callout: {
          type: "info",
          title: "Statik IP Değişikliği Ne Zaman Uygulanır?",
          text: "Adım 1'de yazdığınız yeni statik LAN IP (örn. 192.168.1.25/24) hemen uygulanmaz; Adım 6'da kurulum tamamlandıktan 2 saniye sonra Linux Netplan ile devreye alınır. Bu sayede sihirbaz ortasında bağlantı kopması yaşanmaz."
        }
      },
      {
        heading: "2. Sihirbaz Tamamlandıktan Sonra Otomatik Kilitlenme",
        body: "Adım 6 başarıyla tamamlandığında sistem `setup_wizard.completed = true` olarak işaretlenir ve `/setup` rotası ile tüm `/api/setup/*` uç noktaları güvenlik gereği otomatik olarak kilitlenir (HTTP 403). Kurulum sonrası ağ, lisans, alt alan adı veya yönetici ayarlarında değişiklik yapmak için yönetim paneline giriş yaparak ilgili Yönetim & Sistem Ayarları menülerini kullanabilirsiniz.",
        callout: {
          type: "success",
          title: "Sonraki Adım",
          text: "Sihirbaz tamamlandıktan sonra yeni sekmede açılan https://<alt-alan-adiniz>.nornia.com.tr adresinde oluşturduğunuz yönetici hesabıyla oturum açın ve 'Bölüm 03 — Uygulamalar' rehberiyle RUNA Masaüstü ve Mobil uygulamalarını kurun."
        }
      }
    ],
    troubleshooting: [
      { problem: "Adım 2'de 'Lisans bu donanıma ait değildir' hatası veriyor", cause: "Lisans anahtarı farklı bir sunucu/VM HW-ID'si için üretilmiş veya VM klonlanmış.", solution: "Kurulum ekranındaki HW-XXXX-XXXX kodunu kopyalayıp Merkez Lisans Panelinden yeni donanım için lisans yenileyin." },
      { problem: "Adım 3'te alt alan adı dolu görünüyor veya 'Kontrol Et' başarısız", cause: "Subdomain başka bir aktif santrale kilitli veya sunucunun DNS/HTTPS çıkışı yok.", solution: "DNS ayarlarında 8.8.8.8 / 1.1.1.1 tanımlı olduğundan emin olun; domain başka santraldeyse farklı benzersiz bir ad seçin." },
      { problem: "Kurulum sonrası eski IP'den erişim kesildi", cause: "Adım 1'de tanımlanan yeni statik IP başarıyla uygulandı.", solution: "Tarayıcıda yeni statik IP'yi veya doğrudan https://<alt-alan-adiniz>.nornia.com.tr adresini açın." }
    ],
    relatedPages: ["kurulum-dokumani", "sunucu-ag-ve-nornia-connect", "musteri-ve-lisans-yonetimi"],
    relatedApis: ["GET /api/setup/status", "POST /api/setup/validate-license", "POST /api/setup/complete"]
  },
  {
    id: "masaustu-mobil-ve-webphone",
    number: "03",
    groupId: "baslangic",
    category: "Başlangıç & Kurulum",
    title: "Uygulamalar — RUNA Masaüstü (macOS / Windows) & RUNA Mobil (iOS / Android)",
    shortTitle: "Uygulamalar",
    menuPath: "Sağ Üst Avatar Menüsü → Uygulamalar & İndir (PC / Mobil)",
    pbxRoute: "/ (Avatar → Uygulamalar & İndir)",
    permissions: ["call_panel:tab_webphone", "desktop_enabled (Kullanıcı bazlı Masaüstü izni)", "mobile_enabled (Kullanıcı bazlı Mobil izni)"],
    badge: "Masaüstü • Mobil • RUNA",
    readMinutes: 15,
    summary:
      "Nornia santral için geliştirilen RUNA Masaüstü (Windows & macOS Electron) ve RUNA Mobil (iOS SwiftUI & Android Kotlin) uygulamalarının kurulum paketlerini, Magic Link / QR kod ile şifresiz eşleştirmeyi ve her iki uygulamadaki tüm ekranların (Giriş, 2FA, Ana Çağrı Paneli, Gelen/Aktif Çağrı, 3 Bağımsız Ses Donanımı, Sistem Tepsisi, Alt Navigasyon, Sohbet, Hızlı Durum Çekmecesi ve Kesinti Kurtarma) en ince ayrıntısına kadar kullanımını kapsar.",
    prerequisites: [
      "Kullanıcı kartında veya profil ayarlarında ilgili kullanıcı için Masaüstü (`desktop_enabled`) ve/veya Mobil (`mobile_enabled`) uygulama giriş yetkisi aktif olmalıdır.",
      "Kurulum dosyaları (`.exe`, Apple Silicon `.dmg`, Intel `.dmg`, `.ipa`, `.apk`) ve kişisel Kolay Giriş Linki / QR Kodu santral arayüzündeki 'Avatar → Uygulamalar & İndir' ekranından alınır.",
      "Uygulama girişinde santral adresine HTTPS (443) ve WebRTC/WSS erişimi açık olmalıdır; Nornia Bulut FQDN (`<firma>.nornia.com.tr`) kullanılıyorsa ek port yönlendirmesi gerekmez."
    ],
    screenshots: [
      {
        src: "/screenshots/apps/runa-desktop-overview.jpg",
        caption: "RUNA Masaüstü Uygulaması (macOS & Windows) — Aktif çağrı, tuş takımı, Omnichannel bildirimleri, Sistem Tepsisi ve 3 bağımsız ses donanımı",
        routeHint: "RUNA Masaüstü (Electron • .dmg / .exe)"
      },
      {
        src: "/screenshots/apps/runa-mobile-overview.jpg",
        caption: "RUNA Mobil Uygulaması (iOS & Android) — QR ile 3 saniyede kurulum, kilit ekranı VoIP uyandırma, aktif çağrı kontrolleri ve 9 mobil ekran",
        routeHint: "RUNA Mobil (iOS .ipa / Android .apk)"
      }
    ],
    fieldTable: [
      { field: "RUNA Masaüstü Kurulum Paketleri", type: "Windows .exe / macOS .dmg", defaultVal: "v2.9.3", required: true, description: "Windows Kurulum Sihirbazı (.exe ~78.5 MB), macOS Apple Silicon M1/M2/M3/M4 (.dmg ~95.5 MB) ve macOS Intel (.dmg ~99.9 MB) doğrudan santralden indirilir." },
      { field: "RUNA Mobil Kurulum Paketleri", type: "iOS .ipa / Android .apk", defaultVal: "v2.9.3", required: true, description: "iOS (SwiftUI + CallKit + AudioSession) ve Android (Kotlin/Compose + Foreground VoIP Service + ConnectionService) yerel mobil istemcileri." },
      { field: "Kolay Giriş Linki (Magic Link URL)", type: "Süreli Token URL", defaultVal: "24 Saat (1 Gün)", required: false, description: "Masaüstü giriş ekranında sağ üstteki bağlantı ikonuna yapıştırıldığında sunucu adresi ve şifre girmeden doğrudan oturum açar; e-posta ile kullanıcıya gönderilebilir." },
      { field: "QR Kod ile Mobil Eşleştirme", type: "SVG QR + Kamera Tarayıcı", defaultVal: "Tek Taramada Giriş", required: false, description: "RUNA Mobil giriş ekranındaki QR butonuna dokunup santraldeki QR kodu okutarak sunucu, kullanıcı ve oturumu 3 saniyede otomatik yapılandırır." },
      { field: "3 Bağımsız Ses Donanımı (Masaüstü)", type: "Mikrofon / Kulaklık / Zil", defaultVal: "Ayrı Yönlendirme", required: false, description: "Görüşme sesi kulaklıktan giderken gelen çağrı zilinin harici masaüstü hoparlöründen çalmasını ve AI RNNoise mikrofon gürültü engellemeyi sağlar." },
      { field: "Masaüstü Sistem Tepsisi (Tray)", type: "Arka Plan & Hızlı Menü", defaultVal: "Aktif", required: false, description: "Pencere kapatıldığında uygulamayı arka planda açık tutar; tepsi menüsünden Uygun/Uzakta/Toplantıda durum geçişi, ses aygıtı ve otomatik başlatma sunar." },
      { field: "Çağrıda Pencereyi Öne Getir & Uyku Kilidi", type: "OS Bildirim + PowerSave", defaultVal: "Aktif", required: false, description: "Gelen çağrıda simge durumundaki RUNA penceresini öne taşır; powerSaveBlocker ile uygulama arka planda uyutulmaz ve WebRTC hattı kopmaz." },
      { field: "Mobil Kilit Ekranı VoIP Uyandırma", type: "iOS CallKit / Android VoIP", defaultVal: "Tam Ekran Çalma", required: false, description: "Telefon kilitliyken veya uygulama arka plandayken gelen kurumsal çağrıları tam ekran çalar; Bluetooth/AirPods, ahize ve hoparlör geçişini yönetir." },
      { field: "Mobil Alt Navigasyon & Daha Fazlası", type: "4 Ana + 5 Ek Sekme", defaultVal: "9 Mobil Ekran", required: false, description: "Alt çubukta Çağrı Geçmişi, Rehber, Telefon ve Sohbet; 'Daha Fazlası' menüsünde Pano, Temsilciler, Hızlı Arama, Kayıp Çağrı ve Sesli Posta yer alır." },
      { field: "Kesinti Koruması (Offline Ekranı)", type: "Otomatik Yeniden Bağlan", defaultVal: "8 sn Geri Sayım", required: false, description: "İnternet veya sunucu erişimi geçici kesildiğinde her 8 saniyede bir otomatik yeniden bağlanmayı dener; istenirse 'Sunucu Değiştir' ile başka santrale geçilir." }
    ],
    sections: [
      {
        heading: "1. RUNA Masaüstü Uygulaması Kurulumu ve İlk Giriş (Windows & macOS)",
        body: "RUNA Masaüstü uygulaması, tarayıcı sekmesine bağımlı kalmadan bilgisayarınızda yerel bir çağrı merkezi istemcisi olarak çalışır. Arka planda tarayıcı uyku moduna girmediği (`disable-renderer-backgrounding` + `powerSaveBlocker`) için uzun vardiyalarda gelen çağrı kaçırma riskini ortadan kaldırır.",
        steps: [
          "Santral arayüzünde sağ üstteki Avatar menüsünden 'Uygulamalar & İndir' ekranını açın.",
          "İşletim sisteminize uygun paketi indirin: Windows için `.exe`, Apple Silicon (M1–M4) Mac için `arm64.dmg` veya Intel Mac için `Intel .dmg`.",
          "Kurulumu tamamlayıp RUNA uygulamasını başlatın. İsterseniz Sunucu Adresi, Kullanıcı Adı/Dahili ve Şifrenizi girin; isterseniz sağ üstteki bağlantı (🔗) ikonuna tıklayıp panelden kopyaladığınız 'Masaüstü Kolay Giriş Linki'ni yapıştırarak şifresiz bağlanın.",
          "Bilgisayar her açıldığında otomatik başlaması için giriş ekranındaki veya sistem tepsisindeki 'Bilgisayar açıldığında başlat' seçeneğini işaretleyin (macOS LaunchAgent / Windows Başlangıç otomatik ayarlanır).",
          "Giriş yaptıktan sonra sistem tepsisinden 'Ses & Çalma Aygıtları...' seçeneğini açarak Mikrofon, Görüşme Kulaklığı ve Harici Çalma Zili Hoparlörünü ayrı ayrı seçin."
        ],
        callout: {
          type: "info",
          title: "Toplu Kurulum İçin Hazır Ayar Dosyası (.json)",
          text: "BT yöneticileri 'Uygulamalar & İndir' kartındaki 'Hazır Ayar Dosyası (.json)' indirme bağlantısıyla sunucu adresi ön tanımlı konfigürasyon dosyasını tüm şirket bilgisayarlarına dağıtabilir."
        }
      },
      {
        heading: "2. RUNA Mobil Uygulaması Kurulumu ve QR Kod ile 3 Saniyede Eşleştirme (iOS & Android)",
        body: "RUNA Mobil uygulaması (iOS & Android), ofis dışındayken veya hibrit çalışırken kurumsal dahili numaranızı cep telefonunuzda taşımanızı sağlar. Kurumsal numaranızla dış arama yapabilir, gelen santral/kuyruk çağrılarını kilit ekranından yanıtlayabilir ve ekip sohbetlerini anlık takip edebilirsiniz.",
        steps: [
          "Santral arayüzünde 'Avatar → Uygulamalar & İndir' ekranındaki 'Mobil Uygulama (Runa)' kartından cihazınıza göre iOS (`.ipa`) veya Android (`.apk`) paketini indirin ve kurun.",
          "Uygulamayı ilk açtığınızda Mikrofon, Bildirim ve (Android'de) Arka Plan Pil İstisnası izinlerini onaylayın.",
          "Giriş ekranının sağ üst köşesindeki QR Kod ikonuna dokunun ve santral ekranınızdaki aktif QR kodu kameraya okutun (sunucu adresi, kullanıcı ve oturum otomatik tanımlanır).",
          "QR kullanmak istemezseniz santral adresini (örn. `firma.nornia.com.tr`), kullanıcı adı/dahili ve şifrenizi girin; 2FA aktifse 6 haneli güvenlik kodunu doğrulayarak giriş yapın.",
          "Alt menüdeki Telefon, Çağrı Geçmişi, Rehber, Sohbet ve 'Daha Fazlası' (Pano, Temsilciler, Hızlı Arama, Kayıp Çağrı, Sesli Posta) ekranlarını kullanmaya başlayın."
        ]
      },
      {
        heading: "3. Masaüstü ve Mobil Uygulamalar Arası Çoklu Cihaz & Kesintisiz Geçiş",
        body: "Aynı dahili kullanıcı hem RUNA Masaüstü hem de RUNA Mobil uygulamalarında eşzamanlı oturum açabilir (varsayılan 5 eşzamanlı kayıt). Gelen çağrılar profil tercihlerinize göre her iki uygulamada birden çalar; bir cihazdan yanıtlandığında diğer cihazdaki çalma otomatik durur.",
        steps: [
          "Masaüstü uygulamasında görüşme yaparken ofisten çıkmanız gerekirse, mobil uygulamanın Telefon tuş takımından `*11` (Call Flip) tuşlayarak aktif görüşmeyi kesmeden cep telefonunuza aktarabilirsiniz.",
          "Mobil uygulamada aktif çağrı sırasında başka bir sekmeye (ör. Rehber veya Sohbet) geçtiğinizde ekranın üstünde beliren yeşil 'Arama Ekranına Dön' şeridine dokunarak anında görüşme ekranına geri dönersiniz.",
          "Hızlı durum değişiklikleri için Masaüstü'nde sistem tepsisi sağ tık menüsünü, Mobil'de ise üst çubuktaki Hızlı Durum Çekmecesi'ni (Uygun / Uzakta / Toplantıda) kullanabilirsiniz."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Masaüstü uygulaması simge durumundayken gelen çağrı çalmıyor veya öne gelmiyor", cause: "Sistem tepsisi / 'Çağrıda Pencereyi Öne Getir' kapalı olabilir veya işletim sistemi bildirimleri kısıtlanmıştır.", solution: "Uygulamalar & İndir ayarlarından 'Çağrıda Pencereyi Öne Getir' ve 'Sistem Tepsisinde Çalıştır' kutucuklarını aktif edip kaydedin; Windows/macOS bildirim izinlerinde Runa'ya izin verin." },
      { problem: "Masaüstü uygulamasında görüşme sesi kulaklıktan geliyor ama zil sesi duyulmuyor", cause: "İkincil Zil Sesi Hoparlörü seçilmemiş veya sessize alınmış.", solution: "Sistem tepsisi → 'Ses & Çalma Aygıtları...' ekranından Görüşme Kulaklığı için USB/Bluetooth kulaklığınızı, Çalma Zili Hoparlörü için bilgisayar hoparlörünü seçip test edin." },
      { problem: "Mobil uygulamada QR kod okutulduğunda 'Geçersiz veya süresi dolmuş bağlantı' hatası veriyor", cause: "Kolay Giriş Linki / QR kodunun geçerlilik süresi (varsayılan 24 saat) dolmuş veya iptal edilmiş.", solution: "Santral panelinde 'Uygulamalar & İndir' ekranında 'QR Kodu Yenile' butonuna basıp yeni QR kodu okutun." },
      { problem: "Android veya iOS ekran kilitliyken gelen çağrılar gecikmeli düşüyor", cause: "Android pil optimizasyonu arka plan VoIP servisini kısıtlıyor veya iOS bildirim/mikrofon izni eksik.", solution: "Android'de Uygulama Bilgisi → Pil ayarını 'Kısıtlanmamış' yapın ve Runa arka plan bildirimine izin verin; iOS'ta Ayarlar → Runa altında Mikrofon ve Bildirim izinlerini açın." }
    ],
    relatedPages: ["kisisel-profil-ve-ust-cubuk", "temsilci-cagri-paneli", "kullanicilar"],
    relatedApis: ["GET /api/downloads/mobile/ios", "GET /api/downloads/mobile/android", "POST /api/auth/login"]
  },
  {
    id: "kisisel-profil-ve-ust-cubuk",
    number: "03",
    groupId: "baslangic",
    category: "Başlangıç & Kurulum",
    title: "Üst Çubuk, Global Arama (Ctrl+K) & Kişisel Profil Ayarları (Avatar Menüsü)",
    shortTitle: "Profil & Avatar Ayarları",
    menuPath: "Sağ Üst Avatar Menüsü → Profil Ayarları (11 Kişisel Sekme)",
    pbxRoute: "/ (Sağ Üst Avatar Menüsü)",
    permissions: ["Tüm oturum açmış kullanıcılar (Kendi profil, donanım, kısayol, yönlendirme ve uygulama tercihlerini yönetir)"],
    badge: "Avatar • 11 Kişisel Sekme",
    readMinutes: 14,
    summary:
      "Nornia arayüzünün üst çubuğundaki Global Arama & Sesli Komut (Ctrl+K), dil/tema/bildirim kontrolleri, sağ üst Avatar açılır menüsündeki hızlı profil değiştirme (Müsait / Dışarıda / Toplantı / Diğer) ve her temsilcinin yöneticiye ihtiyaç duymadan kendi hesabını özelleştirebildiği 11 sekmeli 'Temsilci Profil Ayarları' penceresini eksiksiz açıklar.",
    prerequisites: [
      "Herhangi bir yetki rolüyle (Temsilci, Süpervizör veya Admin) Nornia web veya RUNA masaüstü uygulamasına giriş yapılmış olmalıdır.",
      "Donanım ses testi ve AI Gürültü Engelleme için tarayıcı mikrofon izni verilmiş olmalıdır."
    ],
    screenshots: [
      {
        src: "/screenshots/tabs/profile/00-avatar-dropdown.jpg",
        caption: "Sağ üst Avatar menüsü — Aktif Profil Seçimi (Müsait / Dışarıda / Toplantı / Diğer), Profil Ayarları, Uygulamalar & İndir ve Çıkış Yap",
        routeHint: "Üst Bar → Sağ Üst Kullanıcı Avatarı"
      }
    ],
    fieldTable: [
      { field: "Global Arama & Sesli Komut (Ctrl+K / ⌘K)", type: "Anlık Komut Paleti + Mikrofon", defaultVal: "Ctrl+K", required: false, description: "Menü, ayar, kullanıcı, dahili numarası, rapor veya işlemi klavyeden ya da sesli dikte ile 1 saniyede açar." },
      { field: "Hızlı Profil Seçici (Avatar Menüsü)", type: "Müsait / Dışarıda / Toplantı / Diğer", defaultVal: "Müsait", required: false, description: "Tek tıkla aktif profilinizi değiştirir; o profile tanımlı çalacak cihazları (Web/Mobil/Masa) ve yönlendirme kurallarını anında devreye alır." },
      { field: "Profil Ayarları (11 Sekme)", type: "Kişisel Tercih Modalı", defaultVal: "Kullanıcı Bazlı", required: false, description: "Avatar & Tema, Başlangıç Ekranı, Profiller & Yönlendirme, Donanım (AI RNNoise), Klavye Kısayolları, Ortak Masa Telefonu, Güvenlik, Uygulamalar & İndir, Çağrı Paneli, Üst Bar ve Canlı İzleme Paneli sekmelerini içerir." },
      { field: "Uygulamalar & İndir (PC / Mobil)", type: "Doğrudan Kısayol", defaultVal: "RUNA Desktop & Mobile", required: false, description: "Bilgisayar ve telefon uygulamalarını indirme, tek tıkla Magic Link ve QR kodla parolasız giriş ekranını doğrudan açar." },
      { field: "Çıkış Yap (Güvenli Logout)", type: "Oturum + WebRTC Unregister", defaultVal: "Anlık", required: false, description: "Oturumu kapatırken /api/webrtc/unregister_notify ile WebPhone SIP kaydını da temizleyip kullanıcıyı çevrimdışı durumuna geçirir." }
    ],
    sections: [
      {
        heading: "1. Üst Çubuk (Topbar) Araçları & Global Arama (Ctrl+K)",
        body: "Nornia'nın her ekranında sabit kalan üst çubuk; solda Nornia Akıllı Merkez kısayolu, ortada klavye (Ctrl+K / ⌘K) ve mikrofon destekli Global Arama kutusu, sağda ise TR/EN dil değiştirici, canlı bildirim zili, karanlık/aydınlık mod anahtarı, sürüm bilgisi ikonu ve kullanıcı avatar menüsünden oluşur. Sağ alt köşedeki yüzen 'Web Telefon (Dahili)' çipi hangi sayfada olursanız olun gelen çağrıyı tek tıkla yanıtlamanızı sağlar.",
        steps: [
          "Herhangi bir ekrandayken Ctrl+K (macOS'ta ⌘K) tuşuna basın veya üst arama kutusuna tıklayın.",
          "Bir dahili numarası (örn. 1001), rapor adı (örn. MOS veya Puantaj) ya da ayar başlığı yazıp Enter'a basarak doğrudan o ekrana atlayın.",
          "Sağ üstteki avatarınıza tıklayıp toplantıya girerken profilinizi 'Toplantı' moduna alın; çağrılarınız o profil için tanımladığınız sekretere veya sesli postaya otomatik yönlenir."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Donanım sekmesinde mikrofon veya kulaklık listesi boş görünüyor", cause: "Tarayıcı bu alan adı için mikrofon iznine henüz sahip değil.", solution: "Adres çubuğunun solundaki kilit ikonundan Mikrofon iznini açıp 'Aygıtları Tara' butonuna tıklayın." },
      { problem: "Profili 'Dışarıda' yaptığım halde çağrılar cep telefonuma yönlenmiyor", cause: "'Dışarıda' profilinde Çağrı Yönlendirme kuralı veya GSM numarası henüz tanımlanmamış.", solution: "Avatar → Profil Ayarları → Profiller & Yönlendirme sekmesinden 'Dışarıda' profilini seçip yönlendirme hedefini girerek 'Ayarları Kaydet' butonuna basın." }
    ],
    relatedPages: ["temsilci-cagri-paneli", "masaustu-mobil-ve-webphone", "kullanicilar"],
    relatedApis: ["GET /api/auth/me", "POST /api/webrtc/unregister_notify", "POST /api/agent/status"]
  }
];
