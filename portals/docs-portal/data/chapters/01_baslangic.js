export const CHAPTERS_BASLANGIC = [
  {
    id: "ilk-kurulum-sihirbazi",
    number: "01",
    groupId: "baslangic",
    category: "Başlangıç & Kurulum",
    title: "İlk Kurulum Sihirbazı (/setup) & Sunucu Mimarisi",
    shortTitle: "İlk Kurulum Sihirbazı",
    menuPath: "Tarayıcı → http://<sunucu-ip>:3000/setup",
    pbxRoute: "/setup",
    permissions: ["system_settings:write (İlk kurulum — oturum gerektirmez, tamamlanınca kilitlenir)"],
    badge: "Kurulum • 6 Adım",
    readMinutes: 12,
    summary:
      "Nornia Enterprise AI PBX'i ister tam çevrimdışı Nornia ISO görüntüsünden ister temiz bir Ubuntu 24.04 LTS sunucusu üzerine çevrimiçi kurulum betiği ile kurup, 6 adımlı Kurulum Sihirbazı (/setup) üzerinden statik LAN IP, donanım kilidi (HW-ID) lisansı, Nornia Connect alt alan adı ve yönetici hesabını uçtan uca yapılandırma rehberidir.",
    showSizingCalculator: true,
    prerequisites: [
      "Kurulum seçeneği 1 (ISO): Ubuntu 24.04 LTS tabanlı tam çevrimdışı Nornia ISO kurulumu tamamlanmış ve sunucu yerel ağdan DHCP veya geçici IP almış olmalıdır.",
      "Kurulum seçeneği 2 (Online): ISO imajı olmayan bulut/sanal makinelerde temiz bir Ubuntu 24.04 LTS (amd64) işletim sistemi ve internet erişimi hazır olmalıdır.",
      "Kurulum öncesi aşağıdaki 'Nornia Sunucu Kaynak Hesaplama Aracı' ile kullanıcı adedi, eşzamanlı çağrı, ses kaydı ve yerel LLM tercihinize göre gerekli vCPU, RAM, NVMe/NAS disk ve ağ kaynağını belirlemeniz önerilir.",
      "Merkez Lisans Paneli'nden (panel.nornia.com.tr) bu sunucunun HW-ID'si için üretilmiş imzalı AIDA-... lisans anahtarı hazır olmalıdır."
    ],
    screenshots: [
      {
        src: "/screenshots/01-system-status.jpg",
        caption: "Kurulum sonrası Sistem Panosu & Sağlık görünümü — Ağ, FQDN, Asterisk ve Lisans doğrulaması",
        routeHint: "Yönetim & Ayarlar → Sistem Panosu & Sağlık"
      }
    ],
    fieldTable: [
      { field: "Santral Yerel LAN IP (CIDR)", type: "IPv4/Mask", defaultVal: "DHCP IP /24", required: true, description: "Sunucunun kalıcı yerel IP adresi (örn. 192.168.1.25/24). Adım 6 'Kurulumu Tamamla' butonuna basıldığında Ubuntu Netplan (/etc/netplan/99-nornia-static.yaml) dosyasına yazılır ve 2 saniye sonra canlı uygulanır; çakışan 00-installer-config.yaml otomatik etkisizleştirilir." },
      { field: "Varsayılan Ağ Geçidi (Gateway)", type: "IPv4", defaultVal: "192.168.1.1", required: true, description: "İnternet ve SIP operatör çıkışı için yönlendirici (router) IP adresi." },
      { field: "Birincil / İkincil DNS", type: "IPv4", defaultVal: "8.8.8.8 / 1.1.1.1", required: true, description: "Nornia Connect, Let's Encrypt ve SIP Trunk alan adı çözümlemesi için DNS sunucuları." },
      { field: "PJSIP Dinamik NAT & Dış IP", type: "Boolean + IPv4", defaultVal: "Aktif", required: false, description: "Santral NAT arkasındaysa PJSIP transport'larına (UDP/TCP/WS/WSS) external_signaling_address ve external_media_address enjekte eder." },
      { field: "Yerel Ağ Aralıkları (Local Nets)", type: "CIDR List", defaultVal: "192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12", required: false, description: "Asterisk'in NAT çevirisi yapmayacağı iç ağ (LAN/VPN) blokları." },
      { field: "Lisans Anahtarı (AIDA-...)", type: "HMAC-SHA256 Token", defaultVal: "Boş", required: true, description: "AIDA-{KOD}-{YYYYMMDD}-{HW8}-{SIG8}[.BASE64_KOTA] biçimindedir. Büyük/küçük harf duyarlı Base64 kota uzantısı (max_users, max_concurrent_calls, allowed_features) otomatik çözülür." },
      { field: "Nornia Alt Alan Adı (Subdomain)", type: "Slug (a-z, 0-9, -)", defaultVal: "Boş", required: true, description: "<ad>.nornia.com.tr adresini belirler. 'Kontrol Et' butonu Merkez Connect Hub'a HTTPS sorgusu atar; dolu veya rezerve (api, dokuman, panel, connect) ise ilerlemeyi engeller." },
      { field: "Dahili Basamak Planı", type: "Seçim (3 / 4 hane)", defaultVal: "4 Haneli (1000-1999)", required: true, description: "İlk kurulumda standart 4 haneli plan (Dahililer 1000+, Kuyruklar 2000+, Konferans 3000+, IVR 5000+) önerilir." },
      { field: "Yönetici E-Posta & Şifre", type: "Email + Parola", defaultVal: "admin", required: true, description: "Kurulum bitiminde yeni sekmede açılan https://<ad>.nornia.com.tr ekranında giriş yapacağınız süper yönetici bilgileri." }
    ],
    sections: [
      {
        heading: "1. Servis Mimarisi ve Port Haritası",
        body: "Nornia ISO tek sunucuda tümleşik kurumsal mimariyle gelir. PM2 altında çalışan aida-app (Next.js arayüz, port 3000) ve aida-backend (FastAPI + AudioSocket AI TCP Motoru, port 8000 / 9092), Nginx Reverse Proxy (80/443), PostgreSQL 16 (port 5444, ai_pbx veritabanı) ve Asterisk 20 PJSIP (5060 UDP/TCP, 5061 TLS, 5160 Cisco Enterprise TCP, 8089 WSS WebRTC, 10000–20000 UDP RTP) eşzamanlı çalışır.",
        codeBlock: {
          title: "Kurulum Sonrası Sunucu Sağlık Doğrulama Komutları (SSH)",
          lang: "bash",
          code: `# 1. PM2 servis durumunu kontrol et
pm2 status

# 2. Asterisk PJSIP transport ve kayıtlarını doğrula
asterisk -rx "pjsip show transports"
asterisk -rx "pjsip show endpoints"

# 3. Nornia Connect tünel durumunu sorgula
curl -s http://127.0.0.1:8000/api/settings/ras/status | python3 -m json.tool`
        }
      },
      {
        heading: "2. ISO Olmadan Temiz Ubuntu 24.04 LTS Üzerine Çevrimiçi (Online) Kurulum",
        body: "Fiziksel veya bulut sunucunuzda (VPS, AWS, Hetzner, VMware, Proxmox) Nornia ISO yerine standart temiz bir Ubuntu 24.04 LTS (64-bit) kuruluysa, Nornia destek ekibi tarafından sağlanan yetkili çevrimiçi kurulum betiği (install_nornia_online.sh) ile tüm sistem 12 adımda otomatik kurulur. Betik; PostgreSQL 16 (Port 5444 + pgvector), Nornia Asterisk (Cisco yaması + WebRTC SRTP + AudioSocket + Opus), Python sanal ortamı, Next.js üretim derlemesi, PM2 servisleri, Nginx HTTPS/WSS vekil sunucusu, UFW/Fail2Ban güvenlik duvarı ve 'nornia' / kısıtlı 'destek' hesaplarını ISO kurulumuyla birebir aynı standartta yapılandırır.",
        steps: [
          "Sunucunuza SSH ile root veya sudo yetkili kullanıcı olarak bağlanın ve işletim sisteminin Ubuntu 24.04 LTS olduğunu doğrulayın (`lsb_release -a`).",
          "Nornia yetkili kurulum paketini (install_nornia_online.sh) sunucuya aktarın ve yetkili paket bağlantısı veya kurulum anahtarı ile çalıştırın.",
          "Düşük bellekli sunucularda (< 6 GB RAM) betik derleme kararlılığı için otomatik 4 GB swap alanı oluşturur; hazır Asterisk .deb paketi verilirse ~15 saniyede kurulur, verilmezse kaynak koddan otomatik derlenir.",
          "Kurulum tamamlandığında ekranda PostgreSQL, Asterisk, Backend (8000) ve Frontend (3000) sağlık doğrulaması ile `http://<sunucu-ip>/setup` adresi yazdırılır; tarayıcıdan 6 adımlı Kurulum Sihirbazı ile devam edilir."
        ],
        codeBlock: {
          title: "Ubuntu 24.04 LTS Çevrimiçi Kurulum Komutu (Yetkili Paket / Opsiyonel Bayraklar)",
          lang: "bash",
          code: `# 1. Yetkili Nornia kurulum paketi ile çevrimiçi kurulum (Önerilen)
sudo bash install_nornia_online.sh \\
  --bundle-url "<NORNIA_KURUMSAL_PAKET_URL>" \\
  --bundle-token "<YETKILI_KURULUM_ANAHTARI>" \\
  --asterisk-deb "<NORNIA_ASTERISK_DEB_URL>"

# 2. Opsiyonel güvenlik ve bulut parametreleri:
#   --sysadmin-pass "<guclu-sifre>"   : 'nornia' SSH yönetim hesabı şifresi
#   --destek-pass "<destek-sifre>"    : Kısıtlı 'destek' ağ konsolu şifresi
#   --lock-root-ssh                   : Root SSH girişini tamamen kapatır (PermitRootLogin no)
#   --skip-ufw                        : Mevcut harici bulut güvenlik duvarını korur

# 3. Kurulum günlüğünü canlı izleme
tail -f /var/log/nornia-online-install.log`
        },
        callout: {
          type: "warning",
          title: "Güvenlik & Özel Kaynak Politikası",
          text: "Nornia kaynak kodları kapalı kurumsal lisans altındadır. Çevrimiçi kurulumda harici herkese açık kaynak deposu kullanılmaz; yalnızca Nornia yetkili kurulum paketi ve donanıma kilitli lisans anahtarı (HW-ID) ile kurulum yapılır. Bulut VPS kurulumlarında kilitlenmeyi önlemek için varsayılan SSH kuralı yalnızca SSH anahtarı ile root erişimine (prohibit-password) izin verir."
        }
      },
      {
        heading: "3. 6 Adımlı Kurulum Sihirbazı Akışı",
        body: "Tarayıcıda /setup adresi açıldığında sihirbaz 6 ardışık adımdan geçer. Değişiklikler son adımda 'Kurulumu Tamamla' denilene kadar sunucunun mevcut ağ bağlantısını koparmaz; böylece tarayıcı oturumunuz kesilmeden tüm ayarları güvenle yapabilirsiniz.",
        steps: [
          "Adım 1 — Ağ & NAT Ayarları: Algılanan ağ kartını (enp0s3/eth0) görün, kalıcı LAN IP/CIDR, Gateway, DNS ve gerekirse Dış IP (External IP) girin.",
          "Adım 2 — Lisans & Donanım Kilidi: Ekranda gösterilen Donanım Kimliğini (HW-XXXX-XXXX) merkez panele verip aldığınız AIDA-... anahtarını yapıştırın ve 'Lisansı Doğrula'ya basın.",
          "Adım 3 — Nornia Connect & Uzak Erişim: Müşteriye özel alt alan adını (örn. firmaadi -> firmaadi.nornia.com.tr) yazıp 'Kontrol Et' ile müsaitliğini doğrulayın.",
          "Adım 4 — Numara Planı & Şirket Kimliği: Firma ünvanını, saat dilimini (Europe/Istanbul) ve dahili numara basamak yapısını belirleyin.",
          "Adım 5 — Yönetici Hesabı & Güvenlik: Yönetici e-posta adresi, güçlü parola ve opsiyonel 2FA politikasını tanımlayın.",
          "Adım 6 — Özet & Uygulama: 'Kurulumu Tamamla'ya tıklayın. Sistem veritabanını ilklendirir, Asterisk konfigürasyonunu yazar, Nornia Connect tünelini açar, Netplan IP değişikliğini uygular ve yeni sekmede https://<ad>.nornia.com.tr adresini açar."
        ],
        callout: {
          type: "info",
          title: "Statik IP Değişikliği Ne Zaman Uygulanır?",
          text: "Adım 1'de yazdığınız yeni statik LAN IP (örn. 192.168.1.25/24) hemen uygulanmaz; Adım 6'da kurulum tamamlandıktan 2 saniye sonra Linux Netplan ile devreye alınır. Bu sayede sihirbaz ortasında bağlantı kopması yaşanmaz."
        }
      }
    ],
    troubleshooting: [
      { problem: "Adım 2'de 'Lisans bu donanıma ait değildir' hatası veriyor", cause: "Lisans anahtarı farklı bir sunucu/VM HW-ID'si için üretilmiş veya VM klonlanmış.", solution: "Kurulum ekranındaki HW-XXXX-XXXX kodunu kopyalayıp Merkez Lisans Panelinden yeni donanım için lisans yenileyin." },
      { problem: "Adım 3'te alt alan adı dolu görünüyor veya 'Kontrol Et' başarısız", cause: "Subdomain başka bir aktif santrale kilitli veya sunucunun DNS/HTTPS çıkışı yok.", solution: "DNS ayarlarında 8.8.8.8 / 1.1.1.1 tanımlı olduğundan emin olun; domain başka santraldeyse farklı benzersiz bir ad seçin." },
      { problem: "Kurulum sonrası eski IP'den erişim kesildi", cause: "Adım 1'de tanımlanan yeni statik IP başarıyla uygulandı.", solution: "Tarayıcıda yeni statik IP'yi veya doğrudan https://<alt-alan-adiniz>.nornia.com.tr adresini açın." }
    ],
    relatedPages: ["sunucu-ag-ve-nornia-connect", "musteri-ve-lisans-yonetimi", "santral-entegrasyonu-ve-nat"],
    relatedApis: ["GET /api/system/overview", "GET /api/settings/ras/status", "GET /api/settings/network/status"]
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
