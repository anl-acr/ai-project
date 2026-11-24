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
          text: "Sihirbaz tamamlandıktan sonra yeni sekmede açılan https://<alt-alan-adiniz>.nornia.com.tr adresinde oluşturduğunuz yönetici hesabıyla oturum açın ve 'Bölüm 03 — WebPhone & İstemciler' ile ilk test çağrınızı gerçekleştirin."
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
    number: "02",
    groupId: "baslangic",
    category: "Başlangıç & Kurulum",
    title: "WebPhone, Masaüstü (Electron), Mobil & Hot-Desking",
    shortTitle: "WebPhone & İstemciler",
    menuPath: "Operasyon → Temsilci Çağrı Paneli → Web Telefon / Cihazlarım",
    pbxRoute: "/?tab=cagri-merkezi",
    permissions: ["call_panel:tab_webphone", "call_panel:call_flip", "call_panel:tab_deskphone"],
    badge: "WebRTC • SIP • *11",
    readMinutes: 10,
    summary:
      "Nornia santralde bir kullanıcı aynı anda WebPhone (tarayıcı WebRTC), Nornia Masaüstü Uygulaması (Windows/macOS Electron), IP Masa Telefonu (Yealink/Fanvil/Grandstream/Cisco) ve Mobil SIP uygulaması üzerinden çalışabilir. Bu sayfa WebRTC bağlantı mimarisini, *11 Call Flip (cihazlar arası canlı çağrı aktarma) ve *75/*76 Hot-Desking ortak masa kullanımını detaylandırır.",
    prerequisites: [
      "WebPhone için tarayıcıda HTTPS bağlantısı (https://<alt-alan>.nornia.com.tr) ve mikrofon izni zorunludur.",
      "Kurumsal güvenlik duvarında WSS (8089 veya 443 /ras-sip-ws) ve RTP/TURN bağlantısına izin verilmelidir."
    ],
    screenshots: [
      {
        src: "/screenshots/04-call-center.jpg",
        caption: "Temsilci Çağrı Paneli dahili WebPhone, tuş takımı, aktif görüşme ve hızlı aktarım kontrolleri",
        routeHint: "Operasyon & İzleme → Temsilci Çağrı Paneli"
      }
    ],
    fieldTable: [
      { field: "WSS Sinyal Kanalı", type: "WebSocket TLS", defaultVal: "wss://<fqdn>/ras-sip-ws (veya :8089/ws)", required: true, description: "SIP.js tabanlı dahili WebPhone'un Asterisk PJSIP ile şifreli kayıt (REGISTER) ve arama sinyalleşme kanalı." },
      { field: "Çoklu Cihaz (Max Contacts)", type: "Integer", defaultVal: "5 eşzamanlı cihaz", required: false, description: "Aynı dahili numaranın WebPhone + Masa Telefonu + Mobil uygulamada aynı anda çalabilmesini sağlar." },
      { field: "Call Flip (*11)", type: "Özellik Kodu", defaultVal: "*11", required: false, description: "Aktif görüşme sürerken başka bir cihazınızdan (örn. mobil uygulamadan masa telefonuna) *11 tuşlayarak görüşmeyi kesintisiz o cihaza çekersiniz." },
      { field: "Hot-Desk Giriş (*75)", type: "Özellik Kodu", defaultVal: "*75 + Dahili + PIN", required: false, description: "Ortak çalışma masalarındaki paylaşımlı fiziksel IP telefondan kendi dahili kimliğinizle oturum açmanızı sağlar." },
      { field: "Hot-Desk Çıkış (*76)", type: "Özellik Kodu", defaultVal: "*76", required: false, description: "Vardiya bitiminde masa telefonundaki oturumu kapatır. Gece yarısı otomatik çıkış (auto_logout_midnight) kullanıcı ayarından açılabilir." },
      { field: "STUN / TURN Sunucusu", type: "ICE Relay", defaultVal: "Otomatik (Nornia TURN)", required: false, description: "Katı kurumsal simetrik NAT/Firewall arkasındaki uzak WebPhone kullanıcılarında tek yönlü ses sorununu ortadan kaldırır." }
    ],
    sections: [
      {
        heading: "1. WebPhone Çevrimiçi Kayıt ve Otomatik Ses Kontrolü",
        body: "Kullanıcı sisteme giriş yaptığında WebPhone otomatik olarak PJSIP endpoint'ine kayıt olur ve üst çubukta yeşil 'Bağlı' göstergesi yanar. Çıkış (Logout) yapıldığında santral /api/webrtc/unregister_notify üzerinden kaydı temizler ve temsilciyi çevrimdışı durumuna geçirir. Sistem 'admin' hesabı operasyonel çağrı almamak için otomatik WebPhone kaydı başlatmaz.",
        steps: [
          "Tarayıcı adres çubuğunun solundaki kilit ikonundan Mikrofon iznini 'İzin Ver' olarak ayarlayın.",
          "Temsilci Çağrı Paneli → Web Telefon sekmesinde ses girişi (mikrofon) ve çıkış (kulaklık / zil sesi hoparlörü) cihazlarını seçin.",
          "Zil sesi için harici hoparlör, konuşma için USB/Bluetooth kulaklık ayrı ayrı atanabilir."
        ]
      },
      {
        heading: "2. Call Flip (*11) ve Hot-Desking (*75 / *76) Kullanımı",
        body: "Mobil çalışanlar veya vardiyalı çağrı merkezleri için Nornia iki özel fiziksel/sanal cihaz akışı sunar: Call Flip ile ofisten çıkarken masa telefonundaki aktif görüşmeyi tek tuşla mobil uygulamaya aktarabilirsiniz; Hot-Desking ile her temsilci boş bulduğu masadaki telefona kendi dahili numarası ve 4 haneli PIN'i ile bağlanabilir.",
        codeBlock: {
          title: "Fiziksel Telefon Özellik Kodları Özeti",
          lang: "text",
          code: `*11        -> Aktif çağrıyı diğer cihazınıza çek (Call Flip)
*75        -> Hot-Desking Oturum Açma (Sesli yönlendirme ile Dahili + PIN girilir)
*76        -> Hot-Desking Oturum Kapatma
*97        -> Sesli Posta (Voicemail) Dinleme
*9         -> Aktif Görüşmede Ses Kaydını Duraklat / Devam Ettir (KVKK / PCI)
*70        -> Abone Profil Değiştirme (Ofis / Evden Çalışma / Dışarıda)
*74        -> Patron-Sekreter Yönlendirme Aç/Kapat`
        }
      }
    ],
    troubleshooting: [
      { problem: "WebPhone bağlı görünüyor ama çağrıda tek yönlü ses var", cause: "Şirket güvenlik duvarı UDP RTP veya TURN portlarını engelliyor.", solution: "Sistem Ayarları → NAT ve Dış IP bölümünde Dış IP'yi doğrulayın ve Nornia Connect TURN rölesinin aktif olduğundan emin olun." },
      { problem: "Hot-Desk *75 ile giriş yaparken 'PIN hatalı' uyarısı veriyor", cause: "Kullanıcı kartında Hot-Desking aktif edilmemiş veya PIN boş bırakılmış.", solution: "Santral → Kullanıcılar → ilgili kullanıcı → Hot-Desking sekmesinden özelliği aktif edip 4-6 haneli PIN tanımlayın." }
    ],
    relatedPages: ["temsilci-cagri-paneli", "kullanicilar", "oto-provizyon", "kisisel-profil-ve-ust-cubuk"],
    relatedApis: ["GET /api/hotdesk/sessions", "DELETE /api/hotdesk/sessions/{session_key}", "POST /api/v1/calls/originate"]
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
