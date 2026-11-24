export const EDIT_GUIDES_PART5 = {
  "santral-entegrasyonu-ve-nat": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Santral Entegrasyonu (Asterisk AMI, WebRTC WSS, NAS & SIP Güvenliği)",
        badge: "Santral & Ağ 1/9",
        screenshot: { src: "/screenshots/tabs/settings/01-santral-entegrasyonu.jpg", caption: "Sistem Ayarları → Santral Entegrasyonu — Sunucu & AMI bağlantısı, WebRTC WSS, NAS kayıt dizini ve SIP güvenliği", routeHint: "Sistem Ayarları → Santral Entegrasyonu" },
        description: "FastAPI backend servisi ile Asterisk 20 santral çekirdeği arasındaki AMI (5038) kontrol köprüsünü, tarayıcı içi WebPhone'un bağlandığı şifreli WSS adresini, ses kayıt kök dizinini ve SIP güvenlik politikalarını tanımlar.",
        fields: [
          { name: "AMI Host", type: "IPv4 / Hostname", defaultVal: "127.0.0.1", required: true, effect: "Asterisk Manager Interface sunucu adresi. Tek sunucu kurulumlarda 127.0.0.1 olarak bırakılır; harici Asterisk düğümünde iç ağ IP'si girilir." },
          { name: "AMI Port", type: "TCP Port", defaultVal: "5038", required: true, effect: "Canlı çağrı listesi, Click-to-Call (Originate), Transfer (Redirect), Süpervizör ChanSpy ve Web Phone Presence (ContactStatus) olaylarının taşındığı porttur." },
          { name: "AMI Kullanıcı & AMI Şifre", type: "manager.conf Kimliği", defaultVal: "ai_backend_user", required: true, effect: "/etc/asterisk/manager.conf içindeki backend kullanıcısıyla birebir eşleşmelidir; hatalıysa Wallboard ve Canlı Çağrı İzleme boş görünür." },
          { name: "WebRTC (WSS) URL", type: "wss://<domain>:8089/ws", defaultVal: "Otomatik FQDN", required: false, effect: "Tarayıcı içi SIP.js WebPhone'un bağlandığı TLS şifreli WebSocket sinyal adresidir. Nornia Connect aktifse otomatik santral alt alan adıyla çözülür." },
          { name: "NAS Kayıt Dizin Yolu", type: "Linux Mount Yolu", defaultVal: "/var/spool/asterisk/monitor", required: false, effect: "Asterisk MixMonitor tarafından yazılan .wav ses kayıtlarının okunduğu ve harici NAS deposuna aktarıldığı kök klasördür." },
          { name: "SIP Güvenliği (TLS / SRTP & Yetkisiz Çağrı Koruması)", type: "Güvenlik Politikası", defaultVal: "allowguest=no", required: false, effect: "Anonim SIP INVITE isteklerini reddeder, güçlü SIP parola politikasını ve şifreli taşıma (WSS/TLS) ayarlarını Asterisk PJSIP çekirdeğine uygular." }
        ],
        tips: [
          "AMI şifresi değiştirildiğinde Asterisk manager.conf dosyasıyla senkronize edilmesi gerekir; değişiklik sonrası Sistem Panosu → Asterisk AMI kartının yeşil 'Bağlı' olduğunu doğrulayın.",
          "WebRTC WebPhone'un tarayıcıda çalışması için WebRTC (WSS) URL'sinin mutlaka geçerli SSL sertifikalı HTTPS/WSS adresi olması zorunludur."
        ]
      },
      {
        tabTitle: "Alt Ekran 2: NAT ve Dış IP (Extern IP) Yapılandırması",
        badge: "Santral & Ağ 6/9",
        screenshot: { src: "/screenshots/tabs/settings/06-nat.jpg", caption: "Sistem Ayarları → NAT ve Dış IP Ayarları — Dinamik NAT anahtarı, Dış IP ve Yerel Ağ Blokları (Localnet)", routeHint: "Sistem Ayarları → NAT ve Dış IP Ayarları" },
        description: "Güvenlik duvarı (Firewall) veya modem NAT arkasında çalışan santrallerde Asterisk PJSIP transport'larının dış dünyaya özel LAN IP'si yerine gerçek statik dış IP'yi bildirmesini sağlar.",
        fields: [
          { name: "NAT ve Dış IP Yönlendirmesini Etkinleştir", type: "Açık / Kapalı Anahtar", defaultVal: "Açık (NAT arkasında)", required: false, effect: "Açıldığında pjsip_custom.conf içindeki [transport-udp], [transport-tcp], [transport-ws] ve [transport-wss] bloklarının tamamına dinamik NAT satırları enjekte edilir." },
          { name: "Dış IP Adresi (Extern IP / Hostname)", type: "Statik IPv4 veya DDNS FQDN", defaultVal: "Sunucu Public IP", required: true, effect: "SIP SDP ve Contact başlıklarına external_signaling_address ve external_media_address olarak yazılır. Yanlışsa aramalar 32. saniyede kopar veya tek yönlü ses oluşur." },
          { name: "Yerel Ağ Blokları (Local Networks / Localnet)", type: "CIDR Listesi", defaultVal: "192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12", required: true, effect: "Ofis içi IP telefonlar ve VPN şubeleriyle haberleşirken Asterisk'in dış IP çevirisi yapmadan doğrudan yerel LAN IP'siyle medya (RTP) kurmasını sağlar." },
          { name: "Kaydet & Asterisk PJSIP Yeniden Yükle", type: "Anlık Senkronizasyon", defaultVal: "pjsip_custom.conf", required: false, effect: "Değişiklikleri aktif görüşmeleri kesmeden PJSIP transport yapılandırmasına yazar." }
        ],
        tips: [
          "İnternet sağlayıcınız statik IP değiştirdiğinde yalnızca bu ekrandan Dış IP'yi güncellemeniz yeterlidir; tüm SIP Trunk ve WebRTC transport'ları otomatik güncellenir.",
          "Şube VPN bloğunuz 192.168/10/172 dışında özel bir alt ağ kullanıyorsa Yerel Ağ Blokları listesine mutlaka CIDR formatında ekleyin."
        ]
      },
      {
        tabTitle: "Alt Ekran 3: Numara Planı (Acil Durumlar, 5 Numara Aralığı & 16 Özellik/Prefix Kodu)",
        badge: "Santral & Ağ 7/9",
        screenshot: { src: "/screenshots/tabs/settings/07-numara-plani.jpg", caption: "Sistem Ayarları → Numara Planı — Acil numaralar, 5 numara bloğu ve tüm *XX özellik/prefix kodları", routeHint: "Sistem Ayarları → Numara Planı" },
        description: "Santral genelindeki acil durum çıkışını, dahili/kuyruk/konferans/hızlı arama/IVR numara aralıklarını ve tüm masa telefonu/WebPhone *XX tuşlama kodlarını tek merkezden yönetir.",
        fields: [
          { name: "Tanımlı Acil Durum Kısa Numaraları", type: "Virgüllü Liste", defaultVal: "112, 110, 155, 156, 177", required: true, effect: "Bu numaralar Giden Arama Kuralları ve abone arama kısıtlamalarının tamamını atlayarak (sadece dahili yetkili telefonlar dahil) anında dışarı çıkar." },
          { name: "Öncelikli Acil Çıkış Trunk Hattı", type: "SIP Trunk Seçici", defaultVal: "Birincil Dış Hat", required: true, effect: "Acil durum aramalarının kesinlikle hangi dış hat üzerinden (doğru lokasyon CallerID ile) çıkacağını belirler." },
          { name: "5 Numara Aralığı (Başlangıç – Bitiş)", type: "Dahili / Kuyruk / Konferans / Hızlı Arama / IVR", defaultVal: "1000–1999 / 2000–2999 / 3000–3999 / 4000–4999 / 5000–5999", required: true, effect: "Yeni kullanıcı, kuyruk, konferans odası veya IVR oluşturulurken numara çakışmasını önler ve otomatik sıradaki boş numarayı önerir." },
          { name: "7 Gelişmiş Özellik Kodu (Sesli Posta, KVKK, Profil, Sekreter, Hot-Desk, Flip)", type: "*97 • *9 • *70 • *74 • *75 • *76 • *11", defaultVal: "Özelleştirilebilir", required: true, effect: "*97 Sesli Posta dinleme, *9 KVKK ses kaydı duraklatma, *70*X profil değiştirme, *74 Yönetici–Sekreter filtresi, *75/*76 Hot-Desking giriş/çıkış, *11 Call Flip cihaz değiştirme kodlarıdır." },
          { name: "4 Çağrı Yönlendirme (Call Forwarding) Prefix'i", type: "Her Zaman / Meşgulde / Zaman Aşımında / İptal", defaultVal: "*21 / *67 / *61 / #21", required: false, effect: "Fiziksel masa telefonundan tuşlanarak kullanıcının 3 seviyeli yönlendirme kuralını anında açıp kapatmasını sağlar." },
          { name: "3 Çağrı Dinleme / Sufle / Araya Girme (ChanSpy) Prefix'i", type: "Spy / Whisper / Barge-In", defaultVal: "*551 / *552 / *553", required: false, effect: "Yetkili süpervizörlerin telefon tuş takımından doğrudan hedef dahiliyi sessiz dinlemesini, sufle vermesini veya görüşmeye dahil olmasını sağlar." },
          { name: "2 Çağrı Toplama (Call Pickup) Prefix'i", type: "Grup İçinden (*8) & Grup Dışından (**)", defaultVal: "*8 / **<Dahili>", required: false, effect: "*8 aynı Çağrı Toplama Grubunda çalan telefonu çeker; **1005 ise gruptan bağımsız olarak 1005 dahilide çalan telefonu kendi telefonunuza çeker." }
        ],
        tips: [
          "Eski santralinizden (Yeastar, 3CX, Karel vb.) alışık olduğunuz *XX kodlarını buraya birebir tanımlayarak çalışanların yeni kod ezberleme ihtiyacını ortadan kaldırabilirsiniz."
        ]
      }
    ]
  },
  "sunucu-ag-ve-nornia-connect": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Sunucu Ağ (Network) Yönetimi — Sekme 1: Ağ Arayüzleri (NIC) & 60 sn Rollback",
        badge: "Santral & Ağ 2/9",
        screenshot: { src: "/screenshots/tabs/settings/02-sunucu-ag.jpg", caption: "Sistem Ayarları → Sunucu Ağ (Network) Yönetimi — Fiziksel/sanal ağ kartları, IP/CIDR ve 60 sn geri alma koruması", routeHint: "Sistem Ayarları → Sunucu Ağ Yönetimi → Ağ Arayüzleri" },
        description: "Ubuntu/Debian Linux Netplan ağ yapılandırmasını SSH'a girmeden güvenli web arayüzünden yönetir. Her IP değişikliğinde 60 saniyelik canlı onay penceresi açarak erişim kaybını önler.",
        fields: [
          { name: "Algılanan Ağ Arayüzleri (NIC) & Link Durumu", type: "eth0 / ens18 / enp0s3 / VLAN", defaultVal: "Canlı Okuma", required: false, effect: "Sunucudaki tüm fiziksel, sanal ve VLAN ağ kartlarını hız (1000Mbps), MAC adresi ve aktif IPv4/CIDR bilgisiyle listeler." },
          { name: "IP Atama Modu (Statik IP / DHCP)", type: "Seçici", defaultVal: "Statik (Önerilen)", required: true, effect: "Santral IP'sinin değişmemesi için Statik seçilir ve /etc/netplan/99-nornia-static.yaml dosyasına kalıcı yazılır." },
          { name: "IPv4 Adresi / CIDR & Varsayılan Ağ Geçidi (Gateway)", type: "Örn. 192.168.1.25/24 + 192.168.1.1", defaultVal: "Mevcut IP", required: true, effect: "Santralin yerel ağ kimliğini ve internet/operatör çıkış yönlendiricisini tanımlar." },
          { name: "60 Saniye Otomatik Geri Alma (Rollback) Koruması", type: "Güvenlik Zamanlayıcısı", defaultVal: "Her Zaman Aktif", required: false, effect: "Yeni IP uygulandığında 60 saniye içinde 'Yeni IP Çalışıyor, Onayla' butonuna basılmazsa sistem otomatik olarak eski çalışan Netplan yapılandırmasına geri döner." }
        ],
        tips: [
          "İkinci bir fiziksel ağ kartı veya VLAN üzerinden Türk Telekom / Superonline / Vodafone /30 Metro SIP Trunk bağlayacaksanız, ana LAN kartının Default Gateway'ini bozmadan ikinci kartı yalnızca statik rota ile yapılandırın."
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Sekme 1.1: Statik Rotalar (SIP / MPLS & Operatör SBC Yönlendirme Tablosu)",
        badge: "Sunucu Ağ → Statik Rotalar",
        screenshot: { src: "/screenshots/tabs/toggled/net-static-routes.jpg", caption: "Sunucu Ağ (Network) Yönetimi → Sekme 2: Statik Rotalar (SIP / MPLS) — Özel operatör SBC ve şube MPLS ağ geçidi tanımları", routeHint: "Sistem Ayarları → Sunucu Ağ Yönetimi → Statik Rotalar" },
        description: "Operatör SIP SBC bloklarına, MPLS şube alt ağlarına veya ikinci ağ kartı üzerinden özel VLAN'lara kalıcı Linux Netplan statik rotası tanımlar.",
        fields: [
          { name: "Hedef Ağ (Destination CIDR)", type: "Örn. 10.45.0.0/16 veya 212.156.x.x/32", defaultVal: "Zorunlu", required: true, effect: "Özel yönlendirme yapılacak operatör SBC IP'si, medya (RTP) bloğu veya uzak şube MPLS alt ağıdır." },
          { name: "Ağ Geçidi (Via Gateway)", type: "IPv4", defaultVal: "Zorunlu", required: true, effect: "İlgili hedef ağa paketleri iletecek yerel router veya /30 operatör uç IP'sidir." },
          { name: "Çıkış Arayüzü (NIC) & Rota Metriği", type: "Ağ Kartı + Öncelik Sayısı", defaultVal: "Metrik 100", required: false, effect: "Çoklu ağ kartlı sunucularda trafiğin hangi arayüzden ve hangi öncelikle çıkacağını belirler." },
          { name: "Statik Rota Ekleme Güvenlik Onayı", type: "Netplan Kalıcı Yazım", defaultVal: "Reboot Kalıcı", required: false, effect: "Rotayı hem anında Linux kernel tablosuna hem Netplan YAML'a işler; sunucu yeniden başlasa da kaybolmaz." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Sekme 1.2: DNS Sunucuları, Sunucu Hostname & /etc/hosts Yönetimi",
        badge: "Sunucu Ağ → DNS & Hosts",
        screenshot: { src: "/screenshots/tabs/toggled/net-dns-hosts.jpg", caption: "Sunucu Ağ (Network) Yönetimi → Sekme 3: DNS Sunucuları, Hostname ve /etc/hosts Yerel Alan Adı Eşleştirmeleri", routeHint: "Sistem Ayarları → Sunucu Ağ Yönetimi → DNS & Hosts" },
        description: "Birincil/ikincil DNS sunucularını, santral makine adını (hostname) ve kurum içi DNS'siz ERP/SBC sunucuları için `/etc/hosts` kayıtlarını yönetir.",
        fields: [
          { name: "Birincil & İkincil DNS Sunucuları", type: "IPv4 Listesi", defaultVal: "8.8.8.8, 1.1.1.1", required: true, effect: "SIP operatör FQDN'leri, Nornia Connect Hub, AI API sunucuları ve SSL doğrulaması için alan adı çözümlemesini yürütür." },
          { name: "Sunucu Makine Adı (Hostname)", type: "hostnamectl", defaultVal: "nornia-pbx", required: false, effect: "Linux sistem adını, SIP log kimliğini ve SSH terminal istemini günceller." },
          { name: "/etc/hosts Yerel Eşleştirmeleri (IP ↔ Alan Adı)", type: "Satır Ekle / Sil", defaultVal: "Anında Etkin", required: false, effect: "İç ağdaki Active Directory, CRM veya SIP SBC alan adlarını harici DNS'e gerek kalmadan doğrudan iç IP'ye çözer." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Sekme 1.3: Ağ Yedekleri & 3 Adımlı Konsol / SSH Acil Kurtarma Scripti",
        badge: "Sunucu Ağ → Yedekler & Kurtarma",
        screenshot: { src: "/screenshots/tabs/toggled/net-backups.jpg", caption: "Sunucu Ağ (Network) Yönetimi → Sekme 4: Otomatik Netplan Yedekleri ve Konsol/SSH Acil Kurtarma Scripti", routeHint: "Sistem Ayarları → Sunucu Ağ Yönetimi → Yedekler" },
        description: "Her ağ değişikliği öncesi alınan Netplan YAML snapshot'larını tek tıkla geri yükleme ve fiziksel sunucu konsolundan 3 farklı yöntemle ağ kurtarma komutlarını sunar.",
        fields: [
          { name: "Otomatik Netplan Snapshot Geçmişi & 'Geri Yükle'", type: "Tarih Damgalı YAML Arşivi", defaultVal: "Her Değişiklikte Otomatik", required: false, effect: "Hatalı ağ değişikliği sonrası tek tıkla önceki çalışan Netplan dosyasını uygular." },
          { name: "1. Etkileşimli Türkçe Konsol Menüsü (TUI)", type: "sudo nornia-net", defaultVal: "VM / Fiziksel Konsol", required: false, effect: "Web erişimi kopsa dahi VMware/Proxmox/monitör konsolundan menüyle IP, DHCP veya Gateway değiştirmenizi sağlar." },
          { name: "2. Tek Komutla Acil Rollback & 3. Tek Satır Statik IP Atama", type: "CLI Kurtarma Komutları", defaultVal: "Kopyalanabilir", required: false, effect: "Soru sormadan son çalışan ağ yedeğine dönen veya belirtilen ağ kartına tek komutta yeni IP/CIDR/Gateway atayan kurtarma komutlarını gösterir." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2: Nornia Connect (Sıfır-Port Bulut Köprüsü, WireGuard SIP Edge & TURN)",
        badge: "Santral & Ağ 3/9",
        screenshot: { src: "/screenshots/tabs/settings/03-nornia-connect.jpg", caption: "Sistem Ayarları → Nornia Connect — Merkez Hub, kilitli alt alan adı, dış erişim adresleri ve WireGuard SIP Edge", routeHint: "Sistem Ayarları → Nornia Connect" },
        description: "Ofis güvenlik duvarında (Firewall) tek bir gelen port açmadan HTTPS web paneli, WebRTC WSS softphone ve uzak şube/evden çalışan fiziksel IP telefonlar için şifreli tünel kurar.",
        fields: [
          { name: "Merkez Sunucu Adresi (Hub URL veya IP)", type: "HTTPS URL", defaultVal: "https://connect.nornia.com.tr", required: true, effect: "Santralin ters tünel, SSL sertifikası ve WireGuard SIP Edge oturumunu kurduğu Nornia Merkez Hub adresidir." },
          { name: "Santral Alt Alan Adı (Subdomain) & 'Kilidi Sorgula'", type: "Küçük Harf / Rakam", defaultVal: "Donanıma Kilitli", required: true, effect: "<alt-alan>.nornia.com.tr adresini bu santralin HW-ID donanım kimliğine kilitler; başka bir sunucunun aynı alan adını kullanmasını engeller." },
          { name: "Kimlik Doğrulama / Lisans Anahtarı (Opsiyonel)", type: "Token", defaultVal: "Aktif Lisans Anahtarı", required: false, effect: "Boş bırakıldığında Lisans & Key Yönetimi ekranındaki imzalı anahtar otomatik kullanılır." },
          { name: "Dış Erişim Bağlantı Adresleri (Web HTTPS / WSS / SIP Edge / TURN)", type: "Kopyalanabilir Kartlar", defaultVal: "Otomatik SSL", required: false, effect: "Uzak masa telefonlarının, RUNA PC/Mac ve mobil uygulamaların şifre + port açmadan bağlanacağı hazır adresleri sunar." },
          { name: "Canlı Tünel Durumu & Yeniden Bağlan", type: "Bağlı / Kopuk + Gecikme (ms)", defaultVal: "Otomatik Yeniden Bağlanma", required: false, effect: "İnternet kesilip geldiğinde tüneli saniyeler içinde otomatik toparlar." }
        ]
      },
      {
        tabTitle: "Alt Ekran 3: Sunucu Web SSH Terminali (Tarayıcı İçi Güvenli Linux/Asterisk Konsolu)",
        badge: "Santral & Ağ 5/9",
        screenshot: { src: "/screenshots/tabs/settings/05-web-ssh.jpg", caption: "Sistem Ayarları → Sunucu Web SSH Terminali — Tarayıcı içi xterm.js SSH konsolu ve yetki koruması", routeHint: "Sistem Ayarları → Sunucu Web SSH Terminali" },
        description: "PuTTY veya harici SSH portu (22) açmadan yalnızca yetkili yöneticilerin tarayıcı içinden Asterisk CLI, PM2 servisleri ve Linux ağ araçlarına ulaşmasını sağlar.",
        fields: [
          { name: "Rol Yetkisi (server_ssh:access) & Merkez Lisans SSH Kilidi", type: "Çift Katmanlı Güvenlik", defaultVal: "Sadece Yetkili Admin", required: true, effect: "Merkez Lisans Sunucusu tarafından SSH erişimi kapatıldıysa ekran otomatik kilitlenir; tüm açılış/kapanışlar Olay Günlüklerine işlenir." },
          { name: "Canlı xterm.js Konsolu & Hızlı Bakım Komutları", type: "Tam Etkileşimli TTY", defaultVal: "WebSocket SSH", required: false, effect: "`asterisk -rvvv`, `pm2 status`, `pm2 logs aida-backend`, `sngrep`, `df -h` gibi ileri seviye teşhis komutlarını doğrudan tarayıcıda çalıştırır." }
        ]
      }
    ]
  },
  "cok-subeli-santral-federation": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Çok-Şubeli Dağıtık Santral (Standalone / Hub / Edge & Ses Senkronizasyonu)",
        badge: "Santral & Ağ 4/9",
        screenshot: { src: "/screenshots/tabs/settings/04-cok-subeli.jpg", caption: "Sistem Ayarları → Çok-Şubeli Santral — Sunucu rolü, WireGuard tüneli, şube listesi ve ses kaydı senkronizasyon ayarları", routeHint: "Sistem Ayarları → Çok-Şubeli Santral" },
        description: "Merkez (Hub) ve taşra/şube (Edge) Nornia santrallerini tek dahili planı altında birleştiren, şube interneti kopsa bile yerel aramaları ve dış hat çıkışını kesintisiz sürdüren dağıtık santral mimarisidir.",
        fields: [
          { name: "Sunucu Rolü (Standalone / Merkez Hub / Şube Edge)", type: "Mimari Seçici", defaultVal: "Standalone", required: true, effect: "Merkez Hub tüm şubeleri yönetip CDR ve ses kayıtlarını toplar; Şube Edge yerel telefonlara hizmet verir ve şube içi sesi LAN'da tutar." },
          { name: "Bu Sunucunun Şube Kodu, Yerel LAN IP & WireGuard Tünel IP", type: "site-hq / site-01 + 10.200.x.x", defaultVal: "Otomatik LAN Algılama", required: true, effect: "Şubeler arası şifreli WireGuard ağı ve PJSIP Federation Trunk kimliğini kurar." },
          { name: "Merkez (HQ) Sunucu URL & Eşleştirme Anahtarı (Pairing Token)", type: "Edge → Hub Eşleştirme", defaultVal: "Kriptografik Token", required: false, effect: "Edge şube santralinin tek adımda Merkez Hub'a bağlanıp dahili tablosunu ve ayarlarını otomatik çekmesini sağlar." },
          { name: "Şube Ses Kaydı Aktarımı & Sıkıştırma Politikası", type: "Format (OPUS ~%85 küçültme) + Bant Genişliği Limiti + Mesai Dışı Aralığı", defaultVal: "OPUS / 256 Kbps / 19:00–08:00", required: false, effect: "Şube internetini mesai saatlerinde yormadan ses kayıtlarını OPUS ile sıkıştırıp gece merkeze güvenle aktarır." },
          { name: "Şube Kartları & 'Eşleştirme Bilgileri' Modalı", type: "Canlı Çevrimiçi / Kopuk Durumu", defaultVal: "Anlık Heartbeat", required: false, effect: "Her şubenin aktif çağrı sayısını, WireGuard gecikmesini ve Edge kurulum eşleştirme bilgilerini tek tıkla gösterir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 1.1: Yeni Taşra / Şube Santrali Ekle (Aktif-Yerel Edge / SRST, Dahili Bloğu & Failover Trunk)",
        badge: "Multi-Site → Yeni Şube Ekle",
        screenshot: { src: "/screenshots/tabs/deep/federation-site-modal.jpg", caption: "Çok-Şubeli Santral → 'Yeni Şube Ekle': Çalışma & Hayatta Kalma Modu, Dahili Aralığı, WireGuard IP, Failover Trunk ve Opus Sync", routeHint: "Sistem Ayarları → Çok-Şubeli Santral → +" },
        description: "Merkez (Hub) santraline yeni bir taşra/şube Edge santrali tanımlarken dahili bloğunu, WireGuard tünel IP'sini, internet kesintisi yedek hattını ve ses kaydı senkronizasyon politikasını belirleyen 3. seviye penceredir.",
        fields: [
          { name: "Şube Kodu (Benzersiz) & Şube Adı", type: "Örn. site-01 / Polatlı Şubesi", defaultVal: "Zorunlu", required: true, effect: "Merkez ile şube arasındaki PJSIP Trunk ve CDR/ses kaydı eşitleme kimliğini belirler." },
          { name: "Çalışma & Hayatta Kalma Modu", type: "Aktif-Yerel Edge (Önerilen) / SRST Failover (Merkez → Yerel)", defaultVal: "Aktif-Yerel Edge", required: true, effect: "Aktif-Yerel Edge'de telefonlar daima yerel şube santraline bağlı kalır (kötü internette sıfır kesinti); SRST modunda normalde merkeze bağlı olup kopmada 15–30 sn içinde yerele geçer." },
          { name: "Dahili Başlangıç / Bitiş, Şube Yerel IP & WireGuard IP", type: "Örn. 2000–2999 + LAN IP + 10.200.1.1", defaultVal: "Çakışmasız Blok", required: true, effect: "Merkez ile şube arasında çakışmasız dahili-to-dahili arama tablosu ve şifreli WireGuard ağı kurar." },
          { name: "1. Birincil Dış Hat & 2. Yedek Yerel Hat (GSM/FXO — Opsiyonel)", type: "hq_federation_trunk + Lokal GSM/FXO", defaultVal: "Otomatik Failover", required: false, effect: "İnternet kesildiğinde şube dış aramaları otomatik olarak 2. yedek yerel GSM/FXO ağ geçidinden çıkar." },
          { name: "Ses Kaydı Sıkıştırma & Aktarım Zamanlaması", type: "OPUS / 256 Kbps / Mesai Dışı", defaultVal: "Otomatik", required: false, effect: "Merkez raporlarında şube ses kayıtlarının eksiksiz dinlenmesini sağlar." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2: Otoprovizyon Şablonları (Marka/Model .CFG & .XML Yönetimi)",
        badge: "Santral & Ağ 8/9",
        screenshot: { src: "/screenshots/tabs/settings/08-otoprovizyon-sablon.jpg", caption: "Sistem Ayarları → Otoprovizyon Şablonları — Yerleşik sistem şablonları ve özel kurumsal şablon listesi", routeHint: "Sistem Ayarları → Otoprovizyon Şablonları" },
        description: "Yealink, Fanvil, Grandstream, Cisco ve Snom masa telefonları için üretilen otomatik kurulum (Zero-Touch) şablonlarını listeler, klonlar ve özelleştirir.",
        fields: [
          { name: "Yerleşik Sistem Şablonları (Salt-Okunur Korumalı)", type: "Marka / Model Bazlı", defaultVal: "Hazır Şablonlar", required: false, effect: "Fabrika doğrulamalı temel şablonları korur; bozulmasını engellemek için doğrudan değiştirmek yerine 'Kopyala' ile kurumsal şablon üretmenizi sağlar." },
          { name: "Özel Şablon Oluştur (+), Kopyala, Düzenle & Sil", type: "Özel Kurumsal Profiller", defaultVal: "Tenant Bazlı", required: false, effect: "Örn. 'Yealink T42S - Kurumsal Logo + VLAN 20' gibi özel profiller oluşturup Oto Provizyon cihazlarına atamanızı sağlar." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 2.1: Özel Otoprovizyon Şablonu Kopyala / Düzenle Editörü (.CFG / .XML)",
        badge: "Şablonlar → Kopyala / Düzenle",
        screenshot: { src: "/screenshots/tabs/toggled/autoprov-template-edit.jpg", caption: "Otoprovizyon Şablonları → Şablon Kopyala / Özel Şablon Oluştur: Marka, model, değişken yer tutucuları ve ham .CFG/.XML kod editörü", routeHint: "Sistem Ayarları → Otoprovizyon Şablonları → Kopyala / Düzenle" },
        description: "Yerleşik sistem şablonlarını klonlayıp kendi şirketinize özel logo, VLAN, LDAP rehber, kodek sırası veya zil sesi parametreleri eklediğiniz tam metin editörüdür.",
        fields: [
          { name: "Şablon Adı, Marka & Model", type: "Metin + Marka/Model Seçici", defaultVal: "Zorunlu", required: true, effect: "Oto Provizyon cihaz atama penceresinde bu şablonun hangi telefon modellerinde önerileceğini belirler." },
          { name: "Konfigürasyon İçeriği (.CFG / .XML) & Değişken Yer Tutucuları", type: "{{sip_user}}, {{sip_pass}}, {{sip_host}}, {{sip_port}}, {{display_name}}, {{blf_block}}, {{ntp_server}}", defaultVal: "Canlı Render", required: true, effect: "Telefon provizyon URL'sini çağırdığında tüm yer tutucular o kullanıcının gerçek SIP kimliği ve Masa Telefonum BLF tuşlarıyla anında doldurulur." }
        ]
      },
      {
        tabTitle: "Alt Ekran 3: SSL Sertifikaları (Nginx HTTPS + Asterisk WSS 8089)",
        badge: "Santral & Ağ 9/9",
        screenshot: { src: "/screenshots/tabs/settings/09-ssl.jpg", caption: "Sistem Ayarları → SSL Sertifikaları — Sertifika (.crt/.pem), Özel Anahtar (.key) ve CA Bundle yükleme", routeHint: "Sistem Ayarları → SSL Sertifikaları" },
        description: "Kurumsal veya Wildcard SSL sertifikalarını hem web paneline (Nginx 443) hem de Asterisk WebRTC/TLS (8089 / 5061) servisine tek tıkla ve doğru dosya izinleriyle uygular.",
        fields: [
          { name: "Sertifika Dosyası (.crt, .pem)", type: "Dosya Yükleme", defaultVal: "Zorunlu", required: true, effect: "Alan adınıza ait açık anahtar sertifika dosyası (fullchain.pem veya domain.crt)." },
          { name: "Özel Anahtar (.key)", type: "Dosya Yükleme", defaultVal: "Zorunlu", required: true, effect: "Sertifikaya ait şifresiz PEM formatındaki özel anahtar dosyası (privkey.pem)." },
          { name: "CA Bundle / Ara Sertifika Zinciri (Opsiyonel)", type: "Dosya Yükleme", defaultVal: "Opsiyonel", required: false, effect: "Tam zincir (fullchain) ayrıysa ara sertifikaları birleştirerek mobil ve Chrome WebRTC güven zinciri hatasını önler." },
          { name: "Otomatik Asterisk WSS Birleştirme & İzinler", type: "/etc/asterisk/keys/asterisk.pem (chmod 644)", defaultVal: "Otomatik Uygulanır", required: false, effect: "fullchain + privkey birleştirilip Asterisk servisinin okuyabileceği izinle kaydedilir ve Nginx + Asterisk TLS güvenle yenilenir." }
        ]
      }
    ]
  },
  "roller-kvkk-ve-ldap": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Roller (RBAC — 60+ Modül & 25+ Çağrı Paneli Granüler Yetki Matrisi)",
        badge: "Organizasyon 1/7",
        screenshot: { src: "/screenshots/tabs/settings/10-roller.jpg", caption: "Sistem Ayarları → Roller — Sistem rolleri, yetki sayacı kartları ve yeni rol oluşturma", routeHint: "Sistem Ayarları → Roller" },
        description: "Şirket içi her pozisyon (Yönetici, Süpervizör, Kalite Uzmanı, Satış Temsilcisi, Resepsiyon, Muhasebe vb.) için hangi ekranların, raporların ve butonların görünür/düzenlenebilir olacağını belirler.",
        fields: [
          { name: "Hazır Sistem Rolleri & Yeni Rol Ekle (+)", type: "Admin / Süpervizör / Temsilci + Sınırsız Özel Rol", defaultVal: "Özelleştirilebilir", required: true, effect: "Her rol kartında o role bağlı aktif kullanıcı sayısı ve açık yetki adedi görünür." },
          { name: "En Az Yetki (Least Privilege) & Canlı Arayüz Kısıtlama", type: "UI + Backend API Enforcement", defaultVal: "Anında Etkin", required: false, effect: "Yetkisi kapatılan bir menü, ekleme (+) veya silme butonu hem arayüzden gizlenir hem de backend API tarafından HTTP 403 ile engellenir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 1.1: Rolü Düzenle / Yeni Rol Tanımla (9 Kategori, 248+ Yetki & Mola İzinleri)",
        badge: "Roller → Düzenle Modalı",
        screenshot: { src: "/screenshots/tabs/deep/role-edit-modal.jpg", caption: "Roller → Rolü Düzenle: 9 yetki kategorisi, Görüntüleme/Güncelleme/Silme butonları, Süpervizör alt yetkileri ve İzin Verilen Mola Tipleri", routeHint: "Sistem Ayarları → Roller → Düzenle" },
        description: "Herhangi bir rol kartında 'Düzenle' veya '+' butonuna basıldığında açılan ve sistemdeki 248+ bireysel yetki kodunu 9 kategori sekmesinde yöneten 3. seviye RBAC penceresidir.",
        fields: [
          { name: "Rol Kodu & Rol İsmi", type: "Slug (admin/supervisor/agent) + Görünen Ad", defaultVal: "Zorunlu", required: true, effect: "Kullanıcı Düzenle ekranındaki Rol seçicisinde görünecek benzersiz kimliği belirler." },
          { name: "9 Kategori Sekmesi & 'Tümünü Seç / Tümünü Kaldır'", type: "Operasyon • Süpervizör • AI & Bilgi • Santral • Çağrı & Yönlendirme • Raporlar (44) • Yönetim • Sistem Ayarları • İzin Verilen Mola Tipleri", defaultVal: "Canlı Sayaçlı", required: false, effect: "Her kategoride kaç yetkinin açık olduğunu anlık sayaçla gösterir; tek tıkla kategori bazlı toplu seçim/kaldırma yapar." },
          { name: "Granüler İşlem Yetkileri (:access / :read / :write / :delete)", type: "Görüntüleme / Ekleme-Düzenleme / Silme", defaultVal: "Modül Bazlı", required: false, effect: "Örn. bir kullanıcıya Rehber'i yalnızca görme (:read) yetkisi verip ekleme/düzenleme (:write) ve silme (:delete) işlemlerini kapalı tutabilirsiniz." },
          { name: "Süpervizör Müdahale Alt Yetkileri", type: "call_monitor:listen / whisper / barge • supervisor:agent_status / agent_logout / scope_filter", defaultVal: "Granüler", required: false, effect: "Takım liderine Sessiz Dinle + Sufle yetkisi verirken Araya Gir veya Zorla Oturum Kapatma yetkisini sınırlandırabilirsiniz." },
          { name: "Temsilci Çağrı Paneli 25+ İnce Yetkisi & İzin Verilen Mola Tipleri", type: "10 Sekme + Ses Kaydı Dinleme + Transkript + *9 + *11 + Reddet + 4 Ekip Görünürlüğü + Mola Türleri", defaultVal: "Rol Bazlı", required: false, effect: "Örn. stajyer temsilciye 'Çağrı Reddet' ve 'Eğitim dışı mola' butonlarını kapatıp yalnızca yetkili sekmeleri açabilirsiniz." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2: KVKK & Gizlilik Politikası Onay Yönetimi (6698 Sayılı Kanun)",
        badge: "Organizasyon 2/7",
        screenshot: { src: "/screenshots/tabs/settings/11-kvkk.jpg", caption: "Sistem Ayarları → KVKK & Gizlilik Politikası — Metin düzenleyici, sürüm takibi ve hukuki onay denetim tablosu", routeHint: "Sistem Ayarları → KVKK & Gizlilik Politikası" },
        description: "6698 sayılı KVKK aydınlatma metnini ve ses kaydı gizlilik politikasını tüm kullanıcılara onaylatır; her onayı değiştirilemez metin snapshot'ı, tarih/saat ve IP adresiyle hukuki olarak arşivler.",
        fields: [
          { name: "KVKK Aydınlatma Metni (6698 Sayılı Kanun)", type: "Çok Satırlı Hukuki Metin", defaultVal: "Hazır Şablon", required: true, effect: "Metin değiştirilip kaydedildiğinde sürüm numarası otomatik artar ve tüm kullanıcıların (Admin dahil) bir sonraki girişinde yeni metni onaylaması zorunlu kılınır." },
          { name: "Gizlilik, Bilgi Güvenliği ve Ses Kaydı Kullanım Politikası", type: "Çok Satırlı Hukuki Metin", defaultVal: "Hazır Şablon", required: true, effect: "İkinci onay sekmesi olarak kullanıcı ekranında görüntülenir; 'Varsayılan Metinlere Dön' ile fabrika şablonuna dönülebilir." },
          { name: "Onay Durum Filtresi (Tümü / Onayladı / Bekliyor / Eski Sürüm)", type: "Canlı Denetim Tablosu", defaultVal: "Tümü", required: false, effect: "Hangi personelin güncel metni onayladığını, kimin henüz giriş yapmadığını veya eski sürümde kaldığını saniyeler içinde raporlar." },
          { name: "Onay Anındaki Metin Snapshot'ı (İncele Modalı)", type: "Tarih + IP + Metin Kopyası", defaultVal: "Değiştirilemez Arşiv", required: false, effect: "Hukuki denetimlerde 'Ahmet Bey 12.03.2026 tarihinde tam olarak hangi metni onaylamıştı?' sorusunu birebir metin fotoğrafıyla kanıtlar." }
        ]
      },
      {
        tabTitle: "Alt Ekran 3: Active Directory (LDAP & Microsoft Entra ID SSO) Entegrasyonu",
        badge: "Organizasyon 3/7",
        screenshot: { src: "/screenshots/tabs/settings/12-active-directory.jpg", caption: "Sistem Ayarları → Active Directory (LDAP / Entra ID) — Dizin sunucusu bağlantısı, otomatik dahili atama ve kullanıcı eşleştirme önizlemesi", routeHint: "Sistem Ayarları → Active Directory" },
        description: "Şirket içi Microsoft Active Directory (LDAP/LDAPS), bulut Microsoft Entra ID (Azure AD), OpenLDAP veya FreeIPA dizinlerindeki kullanıcıları otomatik içeri aktarır ve şirket şifresiyle giriş imkanı sunar.",
        fields: [
          { name: "Dizin Servisi Sağlayıcısı", type: "Active Directory / Microsoft Entra ID / OpenLDAP / FreeIPA", defaultVal: "Active Directory", required: true, effect: "Seçilen dizin motoruna uygun kullanıcı özniteliklerini (sAMAccountName, userPrincipalName, mail, department) otomatik eşler." },
          { name: "Domain Adı (FQDN) & DC Sunucu Adresi (Host / IP)", type: "Örn. sirket.local • 192.168.1.10", defaultVal: "Zorunlu", required: true, effect: "Domain Controller sunucu adresi. DNS yoksa Sunucu Ağ → /etc/hosts üzerinden eşleştirilebilir." },
          { name: "LDAP Portu (389 / 636 LDAPS) & TLS/SSL", type: "389 (LDAP) / 636 (LDAPS)", defaultVal: "389 / 636", required: true, effect: "Şifreli LDAPS (636) kurumsal güvenlik standartları için önerilir." },
          { name: "Base DN (Kök Dizin) & Kullanıcı Arama OU Dizini (Search Base)", type: "Örn. DC=sirket,DC=local • OU=Personel,DC=sirket,DC=local", defaultVal: "OU Bazlı Süzme", required: true, effect: "Yalnızca santrale dahil edilecek departman/OU altındaki gerçek kullanıcıları çekerek servis hesaplarını hariç tutar." },
          { name: "Yetkili Servis Hesabı (Bind DN / UPN) & Bind Parolası", type: "Örn. ldap_reader@sirket.local", defaultVal: "Salt-Okunur AD Hesabı", required: true, effect: "Dizin sorgulaması için yalnızca okuma yetkili servis hesabı bilgileri girilir." },
          { name: "Otomatik Dahili Başlangıç No & Varsayılan Atanacak Rol", type: "Örn. 1050 + Temsilci", defaultVal: "Çakışmasız Atama", required: false, effect: "AD'den ilk kez içeri alınan her yeni personele sıradaki boş dahili numarasını ve varsayılan rolü otomatik atar." },
          { name: "Bağlantı Testi, Bulunan Kullanıcılar Önizlemesi & 'Senkronize Et'", type: "Önizlemeli Aktarım", defaultVal: "Güvenli Eşitleme", required: false, effect: "Aktarım öncesi dizinde bulunan kullanıcıları tablo halinde önizler; seçili kullanıcıları tek tıkla Nornia abonesine dönüştürür." }
        ]
      },
      {
        tabTitle: "Alt Ekran 4: Lokasyon ve Departmanlar (Kurumsal Organizasyon Yapısı)",
        badge: "Organizasyon 4/7",
        screenshot: { src: "/screenshots/tabs/settings/13-lokasyon-departman.jpg", caption: "Sistem Ayarları → Lokasyon ve Departmanlar — Şube/lokasyon ve şirket departmanı tanımları", routeHint: "Sistem Ayarları → Lokasyon ve Departmanlar" },
        description: "Şirketin fiziksel lokasyonlarını (Genel Merkez, Ankara Şube, Fabrika, Depo) ve organizasyonel departmanlarını (Satış, Teknik Destek, Muhasebe, İK) tanımlar.",
        fields: [
          { name: "Lokasyonlar (Ekle / Düzenle / Sil)", type: "Şube & Ofis Listesi", defaultVal: "Merkez", required: false, effect: "Kullanıcı kartı, Toplu Konfigürasyon ve lokasyon bazlı çağrı raporlarında filtreleme ekseni olur." },
          { name: "Departmanlar (Ekle / Düzenle / Sil)", type: "Birim Listesi", defaultVal: "Genel", required: false, effect: "Departman Toplama Raporu, Rehber gruplaması ve ekip bazlı yetki filtrelemesinde kullanılır." }
        ]
      },
      {
        tabTitle: "Alt Ekran 5: Mola Tanımları (Tek Sefer Limit, Günlük Kota & Wallboard Renkleri)",
        badge: "Organizasyon 5/7",
        screenshot: { src: "/screenshots/tabs/settings/14-mola-tanimlari.jpg", caption: "Sistem Ayarları → Mola Tanımları — Yeni mola tipi ekleme, tek sefer/günlük dakika kotaları ve renk etiketleri", routeHint: "Sistem Ayarları → Mola Tanımları" },
        description: "Temsilcilerin sol alttaki 'Temsilci Oturumu' kartından seçebileceği mola nedenlerini, tek seferlik ve günlük toplam dakika limitlerini ve canlı izleme renklerini yapılandırır.",
        fields: [
          { name: "Mola Adı", type: "Örn. Yemek Molası, İhtiyaç Molası, Eğitim, Toplantı", defaultVal: "Zorunlu", required: true, effect: "Temsilci mola menüsünde, Wallboard matrisinde ve Mola & Puantaj Raporu'nda görünen ad." },
          { name: "Tek Sefer Maks (Dk)", type: "Dakika Limiti", defaultVal: "Örn. 15 / 60 dk", required: false, effect: "Bir seferde bu süre aşıldığında Temsilci Oturumu sayacı ve süpervizör Wallboard kartı kırmızı aşım uyarısına döner." },
          { name: "Günlük Kota (Dk)", type: "Toplam Günlük Hak", defaultVal: "Örn. 30 / 60 dk", required: false, effect: "Temsilcinin gün boyu (00:00 sıfırlamalı) bu mola tipinde harcayabileceği toplam dakika kotasını belirler." },
          { name: "Renk Seçimi & Özel Renk Kodu (Hex)", type: "Hazır Palet + #RRGGBB", defaultVal: "Tema Uyumlu", required: false, effect: "Wallboard ve Temsilci Kronolojisi Gantt çizelgesinde bu mola türünün hangi renkle gösterileceğini belirler." }
        ]
      }
    ]
  },
  "musteri-ve-lisans-yonetimi": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Müşteri (Tenant) Yönetimi — Katı Multi-Tenant İzolasyon & Kota Motoru",
        badge: "Organizasyon 6/7",
        screenshot: { src: "/screenshots/tabs/settings/15-musteri-tenant.jpg", caption: "Sistem Ayarları → Müşteri (Tenant) Yönetimi — Kiracı listesi, lisans planı, durum ve kota yönetimi", routeHint: "Sistem Ayarları → Müşteri (Tenant) Yönetimi" },
        description: "Tek bir fiziksel/sanal Nornia sunucusu üzerinde birden fazla şirketi (kiracıyı) 15 PostgreSQL tablosunda katı `tenant_id` izolasyonuyla ve bağımsız lisans anahtarlarıyla yönetir.",
        fields: [
          { name: "Müşteri / Firma Adı & Kod Adı (Slug Code)", type: "Örn. Nolto Teknoloji • tenant-nolto", defaultVal: "tenant-default", required: true, effect: "Her kiracı için tüm API isteklerinde `X-Tenant-ID` izolasyon anahtarı olarak kullanılır; veriler başka kiracıya asla sızmaz." },
          { name: "Lisans Paketi / Planı & Lisans Bitiş Tarihi", type: "Starter / Professional / Enterprise + Tarih", defaultVal: "İmzalı Anahtardan Çözülür", required: true, effect: "Süresi dolan veya donanım uyuşmazlığı tespit edilen kiracı otomatik olarak pasife çekilir." },
          { name: "Müşteri Durumu (active / passive)", type: "Anında Durdurma / Açma", defaultVal: "active", required: true, effect: "Pasife alınan müşterinin web oturumları kapatılır ve gelen/giden AudioSocket AI çağrıları anında bloklanır." },
          { name: "Çoklu Kiracı Telemetri Heartbeat (Merkez Lisans Kontrolü)", type: "Otomatik Arka Plan", defaultVal: "Her Kiracı Bağımsız", required: false, effect: "Aynı sunucudaki her kiracı Merkez Lisans Paneli'nden bağımsız olarak uzaktan uzatılabilir veya askıya alınabilir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 1.1: Yeni Müşteri Lisansı Oluştur / Düzenle (İmzalı Anahtar & İzinli AI Motorları)",
        badge: "Tenant → Müşteri Lisansı",
        screenshot: { src: "/screenshots/tabs/deep/tenant-edit-modal.jpg", caption: "Müşteri (Tenant) Yönetimi → '+' Yeni Müşteri Lisansı Oluştur: İmzalı lisans anahtarı yapıştırma, izinli AI motorları ve salt-okunur kota özeti", routeHint: "Sistem Ayarları → Müşteri (Tenant) Yönetimi → +" },
        description: "Yeni bir şirket (tenant) oluştururken veya mevcut şirketin paketini güncellerken Merkez Lisans Sunucusundan üretilen donanım-kilitli imzalı anahtarı kriptografik olarak doğrulayıp kotaları anında önizleyen penceredir.",
        fields: [
          { name: "Müşteri / Firma Adı, Kod Adı (Slug) & Lisans Anahtarı (Panodan Yapıştır)", type: "HMAC-SHA256 + Base64 Kota", defaultVal: "Otomatik Çözümlenir", required: true, effect: "Anahtar yapıştırıldığı anda lisans paketi, bitiş tarihi, kullanıcı/kanal kotaları ve modül hakları kriptografik olarak çözümlenir." },
          { name: "Yapay Zeka Lisans Hakları & İzinli Motorlar (Salt-Okunur)", type: "AI Temsilci / RAG / Senaryo Kotası + İzinli STT / TTS / LLM", defaultVal: "Merkezi Lisans Kilitli", required: false, effect: "Bu kiracının hangi STT (Gemini/Deepgram/OpenAI/ElevenLabs), TTS ve LLM (Gemini/OpenAI/Claude/Groq) motorlarını kullanabileceğini ve eşzamanlı kanal (+tolerans) sınırlarını gösterir." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2: Lisans & Key Yönetimi (Donanım Kilidi HW-ID & Kriptografik Yenileme)",
        badge: "Organizasyon 7/7",
        screenshot: { src: "/screenshots/tabs/settings/16-lisans-key.jpg", caption: "Sistem Ayarları → Lisans & Key Yönetimi — Sunucu Donanım Kimliği (HW-ID), aktif kotalar ve anahtar yenileme", routeHint: "Sistem Ayarları → Lisans & Key Yönetimi" },
        description: "Sunucunun donanım parmak izini (DMI/Anakart UUID, `/etc/machine-id`, disk UUID ve NIC MAC) gösteren, kopyalamaya karşı korumalı lisans doğrulama ve yenileme merkezidir.",
        fields: [
          { name: "Sunucu Donanım Kimliği (HW-ID)", type: "HW-XXXX-XXXX (Kopyalanabilir)", defaultVal: "Otomatik Üretilir", required: true, effect: "Sanal makine veya disk imajı başka bir sunucuya klonlanırsa HW-ID uyuşmazlığı oluşur ve lisans anında reddedilir (Anti-Cloning)." },
          { name: "Hedef Müşteri / Kiracı & İmzalı Lisans Anahtarı (Key)", type: "AIDA-{KOD}-{YYYYMMDD}-{HW8}-{SIG8}.KOTA", defaultVal: "HMAC-SHA256 Doğrulamalı", required: true, effect: "Merkez Lisans Paneli'nden üretilen yeni anahtar girilip 'Lisansı Güncelle' dendiğinde tüm kullanıcı, eşzamanlı çağrı, AI ve modül kotaları kesintisiz yenilenir." },
          { name: "Aktif Kullanım & Kota Çubukları", type: "Kullanıcı / Eşzamanlı Kanal / AI Temsilci / Modül Hakları", defaultVal: "Canlı Hesap", required: false, effect: "Mevcut kullanımın lisans limitlerine oranını ve kalan lisans gün sayısını şeffaf biçimde gösterir." }
        ]
      }
    ]
  },
  "yapay-zeka-ayar-ve-yonlendirme": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Yapay Zeka API Anahtarları (5 Bulut Sağlayıcı & Güvenli Maskeleme)",
        badge: "AI & Analiz 1/8",
        screenshot: { src: "/screenshots/tabs/settings/17-ai-api.jpg", caption: "Sistem Ayarları → Yapay Zeka API Anahtarları — Gemini, OpenAI, Anthropic, Groq ve ElevenLabs anahtar yönetimi", routeHint: "Sistem Ayarları → Yapay Zeka API Ayarları" },
        description: "Canlı sesli AI asistanların, transkript, özetleme, QA ve TTS motorlarının kullanacağı bulut API anahtarlarını tek merkezden şifreli ve maskeli olarak saklar.",
        fields: [
          { name: "Google (Gemini) API Key", type: "AIza... (Maskeli)", defaultVal: "Multimodal Live + LLM", required: false, effect: "Gemini Multimodal Live gerçek zamanlı sesli asistan, görsel senaryo üretici, özel rapor tasarımcısı ve RAG vektörleme için kullanılır." },
          { name: "OpenAI API Key", type: "sk-... (Maskeli)", defaultVal: "Realtime / GPT / Whisper", required: false, effect: "OpenAI Realtime sesli asistan, Whisper transkript ve GPT tabanlı arka plan analizi için kullanılır." },
          { name: "Anthropic API Key", type: "sk-ant-... (Maskeli)", defaultVal: "Claude LLM", required: false, effect: "Yüksek hassasiyetli çağrı kalite değerlendirmesi (Auto-QA) ve kurumsal özetleme görevlerinde seçilebilir." },
          { name: "Groq API Key", type: "gsk_... (Maskeli)", defaultVal: "Ultra Hızlı Whisper / Llama", required: false, effect: "Milisaniye hızında düşük maliyetli Whisper transkript ve özetleme için kullanılır." },
          { name: "ElevenLabs API Key", type: "Doğal Türkçe TTS", defaultVal: "Premium Ses Klonlama", required: false, effect: "Doğal insan tonlamalı Türkçe anons üretimi ve özel kurumsal ses klonlama için kullanılır." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2: AI Görev & Model Yönlendirme Merkezi (Yerel Ollama, Whisper & 11 Görev Matrisi)",
        badge: "AI & Analiz 2/8",
        screenshot: { src: "/screenshots/tabs/settings/18-ai-task-routing.jpg", caption: "Sistem Ayarları → AI Görev & Model Yönlendirme — Yerel/harici Ollama, Whisper STT modu, CPU koruma ve 11 görev matrisi", routeHint: "Sistem Ayarları → AI Görev & Model Yönlendirme" },
        description: "Arka plan AI görevlerini yerel/şirket içi Ollama veya Whisper sunucusuna yönlendirerek hem bulut token maliyetini %60–90 düşürür hem KVKK veri egemenliği sağlar.",
        fields: [
          { name: "Ollama / OpenAI-Uyumlu AI Sunucu Adresi & Bearer Token", type: "http://127.0.0.1:11434 veya Harici GPU IP", defaultVal: "qwen2.5:1.5b / nomic-embed-text", required: false, effect: "Aynı sunucuda veya şirket içi ayrı bir GPU sunucusunda çalışan Ollama/vLLM servisini Nornia'ya bağlar." },
          { name: "Çağrı Kaydı Whisper (STT) Çalışma Modu", type: "Yerel CPU / Harici Whisper HTTP Sunucu IP'si / Bulut", defaultVal: "Sıfır Token Yerel", required: false, effect: "İnsan temsilci çağrıları bittikten sonra .wav ses kayıtlarını harici GPU sunucusunda veya yerelde sıfır API maliyetiyle metne döker." },
          { name: "Maksimum CPU Çekirdek Sınırı (Asterisk Ses Koruması)", type: "Çekirdek Limiti + Tek Sıralı FIFO Kuyruk", defaultVal: "Asterisk Öncelikli", required: false, effect: "Yerel LLM/Whisper çalışırken Asterisk canlı telefon ses paketlerinin (RTP) asla donmamasını ve cızırdamamasını garanti eder." },
          { name: "11 Arka Plan Görevi İçin Bağımsız Model Seçimi", type: "Transkript • Özet/Duygu • Temsilci ACW Notu • Sesli Auto-QA • Yazılı Chat QA • RAG 768d Vektör • Mobil Fısıltı Ön-Özet • Senaryo Üretici • API Asistanı • Özel Rapor Üretici • AI Konfigürasyon Asistanı", defaultVal: "Görev Bazlı", required: false, effect: "Örn. Transkript ve Özetlemeyi sıfır maliyetli yerel Ollama'ya verip, karmaşık Görsel Senaryo ve Özel Rapor üretimini Google Gemini'de bırakabilirsiniz." },
          { name: "Ubuntu/Debian Linux Tek Komut Kurulum Scripti", type: "Kopyalanabilir Bash Script", defaultVal: "Otomatik Model İndirme", required: false, effect: "Ollama + Türkçe uyumlu Qwen2.5 + nomic-embed-text modellerini sunucuya tek komutta kurar." }
        ]
      },
      {
        tabTitle: "Alt Ekran 3: Otomatik Kalite Değerlendirme (QA — Kural Havuzu & Ceza Puanları)",
        badge: "AI & Analiz 3/8",
        screenshot: { src: "/screenshots/tabs/settings/19-qa.jpg", caption: "Sistem Ayarları → Otomatik Kalite Değerlendirme (QA) — AI kontrol kriterleri ve ihlal ceza puanları", routeHint: "Sistem Ayarları → Çağrı Kalite Kontrol" },
        description: "Tamamlanan her telefon görüşmesini ve yazılı sohbeti 100 tam puan üzerinden otomatik denetleyen kurumsal kalite kontrol sorularını tanımlar.",
        fields: [
          { name: "Kural Sorusu (AI Kontrol Kriteri)", type: "Açık Evet/Hayır Kontrol Sorusu", defaultVal: "Zorunlu", required: true, effect: "Örn. 'Temsilci görüşmeye kurumsal selamlama ile başlayıp adını söyledi mi?' veya 'KVKK ses kaydı uyarısı/kapanış nezaketi sağlandı mı?'." },
          { name: "Maksimum Ceza Puanı (İhlal Halinde Düşülecek)", type: "1–100 Puan", defaultVal: "Örn. 15–25 Puan", required: true, effect: "Kural ihlal edildiğinde AI 100 tam puandan bu ceza puanını düşer ve Kalite Değerlendirmeleri Raporu'na somut gerekçeyle yazar." },
          { name: "Yeni Değerlendirme Kuralı (+), Düzenle & Sil", type: "Sınırsız Kriter", defaultVal: "Anında Etkin", required: false, effect: "Eklenen yeni kurallar bir sonraki tamamlanan çağrıdan itibaren otomatik değerlendirmeye alınır." }
        ]
      },
      {
        tabTitle: "Alt Ekran 4: Otomatik Dil Algılama (Language Detection)",
        badge: "AI & Analiz 4/8",
        screenshot: { src: "/screenshots/tabs/settings/20-dil-algilama.jpg", caption: "Sistem Ayarları → Otomatik Dil Algılama — Servis durumu ve çok dilli otomatik geçiş", routeHint: "Sistem Ayarları → Otomatik Dil Algılama" },
        description: "Arayan müşterinin konuştuğu dili ilk cümleden otomatik algılayarak AI Sesli Asistanın dilini veya hedef yabancı dil kuyruğunu dinamik olarak değiştirir.",
        fields: [
          { name: "Dil Algılama Servisi Durumu", type: "Açık / Kapalı Anahtar", defaultVal: "Opsiyonel", required: false, effect: "Açık olduğunda sağlık turizmi, otel ve ihracat çağrılarında yabancı arayanlar tuşlama yapmadan kendi dillerinde karşılanır." },
          { name: "Desteklenen Diller & Dinamik Yanıt", type: "TR / EN / DE / AR / RU / FR / ES", defaultVal: "Otomatik Algılama", required: false, effect: "Algılanan dil hem sesli yanıtı belirler hem de Canlı Çeviri ve Raporlara işlenir." }
        ]
      },
      {
        tabTitle: "Alt Ekran 5: Dinamik Duygu Yönetimi (Öfke/Kriz Tespiti & Acil Eskalasyon)",
        badge: "AI & Analiz 5/8",
        screenshot: { src: "/screenshots/tabs/settings/21-duygu.jpg", caption: "Sistem Ayarları → Dinamik Duygu Yönetimi — Duygu servisi, kriz alarmı ve acil eskalasyon", routeHint: "Sistem Ayarları → Dinamik Duygu Yönetimi" },
        description: "Görüşme sırasında müşterinin ses tonu ve kelimelerinden öfke/şikayet artışını gerçek zamanlı algılayıp süpervizör Kriz Alarm Radarı'nı tetikler.",
        fields: [
          { name: "Dinamik Duygu Yönetimi Durumu", type: "Açık / Kapalı Anahtar", defaultVal: "Aktif", required: false, effect: "Açıkken her görüşme Pozitif / Nötr / Negatif olarak canlı skorlanır ve Duygu Isı Haritası raporunu besler." },
          { name: "Kriz Alarmı & Canlı Temsilciye Acil Aktarım", type: "Eskalasyon Kuralı", defaultVal: "Gerçek Zamanlı", required: false, effect: "Negatif duygu eşiği aşıldığında AI Pano'da kırmızı kriz alarmı yanar, istenirse yöneticiye anında E-Posta/WhatsApp bildirimi gider veya çağrı kıdemli temsilciye aktarılır." }
        ]
      },
      {
        tabTitle: "Alt Ekran 6: AI Fısıldama Yönetimi (Canlı Temsilci Koçluğu / Whispering)",
        badge: "AI & Analiz 6/8",
        screenshot: { src: "/screenshots/tabs/settings/22-ai-fisildama.jpg", caption: "Sistem Ayarları → AI Fısıldama Yönetimi — Görüşme sırasında temsilciye anlık RAG yanıt önerileri", routeHint: "Sistem Ayarları → AI Fısıldama Yönetimi" },
        description: "İnsan temsilci müşteriyle konuşurken AI'ın soruyu canlı analiz edip Bilgi Bankası'ndan (RAG) doğru yanıtı yalnızca temsilcinin ekranına anında önermesini sağlar.",
        fields: [
          { name: "AI Fısıldama Servisi Durumu", type: "Açık / Kapalı Anahtar", defaultVal: "Opsiyonel", required: false, effect: "Açıldığında yeni başlayan temsilciler fiyat, kampanya veya teknik sorularda bekleme yapmadan ekrandaki AI kartından doğru bilgiyi okuyabilir." },
          { name: "RAG Bilgi Bankası Bağlantısı", type: "Otomatik Senkron", defaultVal: "768d Vektör Arama", required: false, effect: "Bilgi Bankası'na yeni yüklenen PDF ve fiyat listeleri saniyeler içinde canlı fısıldama önerilerine dahil olur." }
        ]
      },
      {
        tabTitle: "Alt Ekran 7: Canlı Biyometrik Doğrulama (Voice Bio-Verification & Ses İmzaları)",
        badge: "AI & Analiz 7/8",
        screenshot: { src: "/screenshots/tabs/settings/23-biyometrik-ses.jpg", caption: "Sistem Ayarları → Canlı Biyometrik Doğrulama — Güvenlik yapılandırması ve kayıtlı ses imzaları", routeHint: "Sistem Ayarları → Biyometrik Ses Analizi" },
        description: "Müşterilerin ses parmak izini (Voiceprint) çıkararak telefon görüşmesinde ekstra güvenlik sorusu sormadan kimlik doğrulaması ve taklit ses uyarısı sunar.",
        fields: [
          { name: "Güvenlik Yapılandırması & Ses Eşleşme Eşiği (%)", type: "Açık/Kapalı + Eşik Kaydırıcısı (%60–%95)", defaultVal: "%80", required: false, effect: "Eşik yükseldikçe doğrulama daha katı hale gelir; eşik altındaki seslerde kimlik doğrulama uyarısı üretilir." },
          { name: "Kayıtlı Ses İmzaları (Voiceprints) Listesi", type: "Kişi + Ses İzi Kaydı + Sil", defaultVal: "Rehber Bağlı", required: false, effect: "Sisteme tanımlanmış VIP müşteri ses imzalarını görüntüler ve KVKK talebi halinde tek tıkla kalıcı olarak siler." }
        ]
      },
      {
        tabTitle: "Alt Ekran 8: ROI Rapor Ayarları (Finansal Tasarruf Baz Değerleri)",
        badge: "AI & Analiz 8/8",
        screenshot: { src: "/screenshots/tabs/settings/24-roi.jpg", caption: "Sistem Ayarları → ROI Rapor Ayarları — Birim insan maliyeti ve temsilci sayısı parametreleri", routeHint: "Sistem Ayarları → ROI Rapor Ayarları" },
        description: "AI vs. İnsan ROI Raporu ile CEO Yönetici Özeti'ndeki aylık/yıllık finansal tasarruf hesaplamalarının temel birim maliyetlerini belirler.",
        fields: [
          { name: "Birim İnsan Maliyeti (Aylık ₺)", type: "Sayısal (TL)", defaultVal: "Özelleştirilebilir", required: true, effect: "Bir çağrı merkezi temsilcisinin şirket için aylık brüt maliyetini (maaş + SGK + yan haklar) tanımlar." },
          { name: "İnsan (Temsilci) Sayısı", type: "Tam Sayı", defaultVal: "Ekip Büyüklüğü", required: true, effect: "Yapay zekanın karşıladığı çağrı dakikalarını eşdeğer FTE temsilci tasarrufuna ve net TL kazancına çevirir." }
        ]
      }
    ]
  },
  "kanallar-crm-ve-dis-api": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Kanal Entegrasyonları — WhatsApp Business Cloud API & AI Davranış Ayarları",
        badge: "Kanallar 1/6",
        screenshot: { src: "/screenshots/tabs/settings/25-kanallar.jpg", caption: "Sistem Ayarları → Kanal Entegrasyonları — WhatsApp Cloud API bağlantısı, AI personası, mesai saatleri ve çoklu hat listesi", routeHint: "Sistem Ayarları → Kanal Entegrasyonları → WhatsApp" },
        description: "Meta WhatsApp Business Cloud API bağlantısını, AI konuşma personasını, 3 butonlu karşılama menüsünü, cevapsız çağrı otomatik WhatsApp yanıtını ve mesai dışı davranışını yönetir.",
        fields: [
          { name: "WhatsApp Erişim Jetonu (Permanent Access Token)", type: "Meta System User Token", defaultVal: "Graph API v18.0", required: true, effect: "Meta Business Manager'dan üretilen süresiz erişim jetonudur; tüm giden mesaj, medya ve butonlar bu anahtarla imzalanır." },
          { name: "Telefon Numarası Kimliği (Phone Number ID) & Verify Token", type: "Meta ID + Webhook Doğrulama", defaultVal: "ai_pbx_whatsapp_verify_token_secure", required: true, effect: "Meta webhook doğrulamasında (`GET /api/webhooks/whatsapp`) eşleştirilir; yanlışsa gelen mesajlar santrale düşmez." },
          { name: "Yapay Zeka Temsilci Personası & Konuşma Üslubu", type: "Samimi / Satış / Destek / Kurumsal", defaultVal: "Kurumsal", required: false, effect: "AI asistanın müşteriye yanıt verirken kullanacağı tonu, satış yönlendirmesini ve empati düzeyini dinamik olarak ayarlar." },
          { name: "Canlı Temsilci Aktarım Kuyruğu & 3 Butonlu Karşılama Menüsü", type: "Kuyruk Seçici + [Fiyat ve Bilgi] [Randevu Al] [Canlı Temsilci]", defaultVal: "Otomatik", required: false, effect: "Yeni sohbetlerde müşteriye hızlı yanıt butonları sunar; 'Canlı Temsilci' seçildiğinde oturumu anında ilgili kuyruktaki insan temsilciye devreder." },
          { name: "Mesai Başlangıç / Bitiş Saati & Cevapsız Çağrı Otomatik WhatsApp", type: "HH:MM – HH:MM + Toggle", defaultVal: "09:00 – 18:00 (UTC+3)", required: false, effect: "Mesai dışı saatlerde ve hafta sonlarında müşteriye otomatik çalışma saatleri bilgisi verir; santralde kaçan telefon çağrılarına otomatik nazik WhatsApp mesajı atar." },
          { name: "Entegrasyon Asistanı", type: "Adım Adım Meta Rehberi", defaultVal: "Yerleşik Yardım", required: false, effect: "Meta Developers panelinde webhook URL'si ve izinlerin nasıl ekleneceğini adım adım gösterir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 1.1: Çoklu WhatsApp Hattı Ekle / Düzenle (Hat Adı, Phone Number ID, Persona & Kuyruk)",
        badge: "Kanallar → Çoklu WhatsApp (+)",
        screenshot: { src: "/screenshots/tabs/deep/channel-wa-account-modal.jpg", caption: "Kanal Entegrasyonları → Çoklu WhatsApp Hatları '+' Butonu: Hat adı, görünen numara, Meta Phone Number ID, özel token, AI personası ve aktarım kuyruğu", routeHint: "Sistem Ayarları → Kanal Entegrasyonları → WhatsApp → +" },
        description: "Aynı şirket (tenant) altında Satış Hattı, Destek Hattı veya Şube Hattı gibi birden fazla Meta WhatsApp Business numarasını ayrı AI personası ve kuyrukla bağlayan alt penceredir.",
        fields: [
          { name: "Hat Tanımı / Adı*, Görünecek Telefon Numarası & Phone Number ID*", type: "Örn. Satış Hattı + +90 850... + Meta ID", defaultVal: "Zorunlu", required: true, effect: "Webhook'tan gelen `metadata.phone_number_id` değerini bu hatla eşleştirir ve Ortak Gelen Kutusu'nda hat rozetini (`recipient_info`) gösterir." },
          { name: "Hatta Özel Erişim Jetonu (Opsiyonel)", type: "Meta Permanent Access Token", defaultVal: "Boş = Genel Token", required: false, effect: "Farklı bir Meta Business uygulamasından bağlı numaralar için hatta özel erişim anahtarı tanımlanabilir." },
          { name: "Bu Hatta Atanacak Yapay Zeka Personası & Canlı Temsilci Aktarım Kuyruğu", type: "Samimi / Satış / Destek / Kurumsal + Kuyruk Seçici", defaultVal: "Otomatik (AI Konu Analizi)", required: false, effect: "Örn. 0850 Satış hattına yazan müşteriye satış odaklı AI cevap verir, canlı temsilci istediğinde doğrudan Satış Kuyruğuna düşürür." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Sekme 1.2: Telegram Bot Kanalı Yapılandırması (BotFather Token & Webhook)",
        badge: "Kanallar → Telegram Bot",
        screenshot: { src: "/screenshots/tabs/toggled/channels-telegram.jpg", caption: "Kanal Entegrasyonları → Telegram Bot sekmesi: Bot Token, otomatik Webhook kaydı ve yapay zeka yanıt ayarları", routeHint: "Sistem Ayarları → Kanal Entegrasyonları → Telegram Bot" },
        description: "Telegram `@BotFather` üzerinden oluşturulan kurumsal botunuzu tek tıkla Ortak Gelen Kutusu ve AI Asistana bağlar.",
        fields: [
          { name: "Telegram Bot Token (HTTP API Token)", type: "123456:ABC-DEF...", defaultVal: "@BotFather", required: true, effect: "Telegram API ile güvenli mesaj alışverişi sağlar." },
          { name: "Otomatik HTTPS Webhook Kaydı", type: "POST /api/webhooks/telegram", defaultVal: "Tek Tık Kurulum", required: false, effect: "Müşterilerin Telegram botunuza yazdığı mesajlar anında Ortak Gelen Kutusu'na düşer ve AI/Temsilci tarafından yanıtlanır." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Sekme 1.3: Instagram DM & Facebook Messenger (Meta Direct) Entegrasyonu",
        badge: "Kanallar → Instagram & FB",
        screenshot: { src: "/screenshots/tabs/toggled/channels-meta.jpg", caption: "Kanal Entegrasyonları → Instagram & FB sekmesi: Sayfa Erişim Jetonları, Webhook Callback URL ve Verify Token", routeHint: "Sistem Ayarları → Kanal Entegrasyonları → Instagram & FB" },
        description: "Kurumsal Instagram DM ve Facebook Messenger mesajlarını Meta Graph API v18.0 üzerinden doğrudan Nornia Ortak Gelen Kutusu'na aktarır.",
        fields: [
          { name: "Instagram Sayfa Erişim Jetonu (Page Access Token)", type: "Meta Graph Token", defaultVal: "Instagram Business", required: false, effect: "Instagram işletme hesabınıza gelen DM'leri okur ve AI/Temsilci yanıtlarını doğrudan DM olarak gönderir." },
          { name: "Facebook Sayfa Erişim Jetonu", type: "Meta Graph Token", defaultVal: "Facebook Page", required: false, effect: "Facebook Messenger müşteri mesajlarını Ortak Gelen Kutusu'na bağlar." },
          { name: "Meta Webhook Callback URL & Verify Token", type: "/api/webhooks/meta", defaultVal: "Graph API v18.0", required: false, effect: "Meta App Dashboard'a kopyalanarak gerçek zamanlı mesaj akışını başlatır." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Sekme 1.4: Kurumsal E-Posta Kanalı (SMTP Gönderim & 30 sn IMAP Gelen Kutusu Dinleyici)",
        badge: "Kanallar → E-Posta (SMTP/IMAP)",
        screenshot: { src: "/screenshots/tabs/toggled/channels-email.jpg", caption: "Kanal Entegrasyonları → E-Posta (SMTP/IMAP) sekmesi: Giden SMTP, Gelen IMAP ve aktarım kuyruğu", routeHint: "Sistem Ayarları → Kanal Entegrasyonları → E-Posta" },
        description: "`info@` veya `destek@` şirket e-posta kutularını 30 saniyelik arka plan IMAP dinleyicisi ile Ortak Gelen Kutusu'na bağlar ve SMTP üzerinden yanıt gönderir.",
        fields: [
          { name: "SMTP Sunucu Adresi & SMTP Portu", type: "Örn. smtp.gmail.com • 587 (TLS) / 465 (SSL)", defaultVal: "587", required: true, effect: "Ortak Gelen Kutusu'ndan gönderilen temsilci ve AI yanıt e-postalarını iletir." },
          { name: "E-Posta Adresi (Kullanıcı) & Şifre / Uygulama Şifresi", type: "Kimlik Bilgisi", defaultVal: "App Password", required: true, effect: "Google Workspace ve Microsoft 365 hesaplarında 2FA aktifse Uygulama Şifresi kullanılması önerilir." },
          { name: "IMAP Sunucu Adresi & IMAP Portu", type: "Örn. imap.gmail.com • 993 (SSL)", defaultVal: "30 sn Otomatik Tarama", required: true, effect: "Arka plan poller her 30 saniyede okunmamış e-postaları çekip Ortak Gelen Kutusu'nda yeni sohbet oturumu açar." },
          { name: "E-Posta Canlı Temsilci Aktarım Kuyruğu", type: "Kuyruk Seçici", defaultVal: "Otomatik", required: false, effect: "Gelen müşteri e-postalarının hangi departman temsilcilerine düşeceğini belirler." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2: Hazır Kurumsal CRM Entegrasyon Marketi (Native Connectors)",
        badge: "Kanallar 2/6",
        screenshot: { src: "/screenshots/tabs/settings/26-hazir-crm.jpg", caption: "Sistem Ayarları → Hazır CRM Entegrasyonları — Zoho, HubSpot, Salesforce, Bitrix24 bağlayıcıları ve Screen Pop şablonu", routeHint: "Sistem Ayarları → Hazır CRM Entegrasyonları" },
        description: "Popüler kurumsal CRM sistemleriyle kod yazmadan iki yönlü kişi senkronizasyonu, otomatik çağrı kaydı (CDR + ses kaydı linki) ve canlı Screen Pop bağlantısı kurar.",
        fields: [
          { name: "Hazır CRM Bağlayıcı Kartları", type: "Zoho / HubSpot / Salesforce / Bitrix24 / Özel Webhook", defaultVal: "Tek Tık Aktivasyon", required: false, effect: "İlgili CRM kartına tıklandığında o platforma özel API Token, Domain ve Client ID alanları açılır." },
          { name: "Otomatik Müşteri Kartı Açma (Screen Pop) Şablonu", type: "URL + {{phone}} Değişkeni", defaultVal: "2. Sekme Açılış", required: false, effect: "Çağrı geldiğinde temsilcinin ekranında doğrudan arayan müşterinin CRM profil kartını yeni sekmede açar." },
          { name: "Bağlantı Testi & Otomatik CDR / Ses Kaydı Yazımı", type: "Canlı Doğrulama", defaultVal: "Çağrı Sonunda", required: false, effect: "Görüşme bittiğinde arama süresi, sonuç kodu, AI özet notu ve ses kaydı bağlantısını CRM müşteri aktivitesine otomatik işler." }
        ]
      },
      {
        tabTitle: "Alt Ekran 3: Hızlı Cevap Taslakları (Canned Responses — '/' Kısayolu)",
        badge: "Kanallar 3/6",
        screenshot: { src: "/screenshots/tabs/settings/27-hizli-cevaplar.jpg", caption: "Sistem Ayarları → Hızlı Cevaplar — / kısayollu kurumsal hazır mesaj şablonları", routeHint: "Sistem Ayarları → Hızlı Cevaplar" },
        description: "Ortak Gelen Kutusu'nda ve Temsilci Sohbet sekmesinde `/` yazılarak tek tıkla eklenebilen kurumsal hazır cevap şablonlarını yönetir.",
        fields: [
          { name: "Kısayol* (örn. /selam, /iban, /adres)", type: "Eğik Çizgili Kısa Kod", defaultVal: "Zorunlu", required: true, effect: "Temsilci mesaj kutusuna `/` yazdığında açılan listeden bu kodla anında seçilir." },
          { name: "Şablon Başlığı* & Cevap İçeriği*", type: "Başlık + Çok Satırlı Metin", defaultVal: "Zorunlu", required: true, effect: "Banka IBAN bilgileri, çalışma saatleri, kargo takip adresi gibi sık tekrarlanan yanıtları hatasız ve tek tip standartla göndermeyi sağlar." }
        ]
      },
      {
        tabTitle: "Alt Ekran 4: Evrensel API ve Webhook Sihirbazı (AI İçin Canlı ERP/CRM Araçları)",
        badge: "Kanallar 4/6",
        screenshot: { src: "/screenshots/tabs/settings/28-evrensel-api.jpg", caption: "Sistem Ayarları → Evrensel API Sihirbazı — AI araç tanımı, API Test Sandbox ve Canlı Entegrasyon Logları", routeHint: "Sistem Ayarları → Evrensel API Sihirbazı" },
        description: "Şirketinizin kendi ERP, kargo, hastane HBYS veya e-ticaret REST API'lerini kod yazmadan AI Sesli Asistana canlı araç (tool) olarak tanıtmanızı sağlar.",
        fields: [
          { name: "API Anahtarı (ID)* & API Adı (Başlık)*", type: "Örn. siparis_sorgula • Sipariş Durumu Sorgulama", defaultVal: "Zorunlu", required: true, effect: "Yapay zekanın arka planda tetikleyeceği benzersiz araç kimliğini belirler." },
          { name: "Yapay Zeka Açıklaması (LLM Instruction)*", type: "Doğal Dil Yönergesi", defaultVal: "Zorunlu", required: true, effect: "AI'ın bu aracı ne zaman ve hangi müşteri sorusunda çağıracağını (örn. 'Müşteri sipariş veya kargo durumunu sorduğunda sipariş numarasını isteyip bu aracı çalıştır') öğretir." },
          { name: "Metot* (GET/POST/PUT/DELETE), Endpoint URL* & Headers", type: "HTTPS URL + Authorization / X-API-Key", defaultVal: "Async Tool Engine", required: true, effect: "Aktif Gemini Live ses akışını kesmeden arka planda REST isteği atar ve dönen JSON yanıtını müşteriye doğal sesle okur." },
          { name: "API Parametreleri (Ad, Konum, Tip, Zorunlu)", type: "Query / Path / Body", defaultVal: "Dinamik", required: false, effect: "AI'ın görüşme sırasında müşteriden toplayıp API'ye göndereceği parametreleri (örn. `order_id`, `tc_no`) tanımlar." },
          { name: "API Test Sandbox, Canlı Entegrasyon Logları & Entegrasyon Asistanı", type: "Yerleşik Test & Log Ekranı", defaultVal: "Canlı HTTP Çıktısı", required: false, effect: "Tanımlanan API'yi gerçek çağrı yapmadan önce örnek değerlerle test etmenizi ve tüm geçmiş çağrı/hata loglarını incelemenizi sağlar." }
        ]
      },
      {
        tabTitle: "Alt Ekran 5: Kurumsal Dış API & Anahtar (Token) Yönetimi",
        badge: "Kanallar 5/6",
        screenshot: { src: "/screenshots/tabs/settings/29-dis-api.jpg", caption: "Sistem Ayarları → Kurumsal Dış API & Token Yönetimi — Kimlik doğrulama rehberi, anahtar listesi ve canlı erişim günlüğü", routeHint: "Sistem Ayarları → Kurumsal Dış API & Token Yönetimi" },
        description: "`api.nornia.com.tr` üzerinde belgelenen tüm harici REST API v1 uç noktaları için SHA-256 güvenli anahtarlar, IP kısıtları, Webhook imzası ve canlı erişim günlüğü sağlar.",
        fields: [
          { name: "Nasıl Bağlanılır? (Kimlik Doğrulama Başlıkları)", type: "X-API-Key: aida_live_... veya Authorization: Bearer", defaultVal: "SHA-256 Hash", required: false, effect: "Dış yazılımların (ERP, CRM, Mobil App) santral REST API'sine bağlanırken kullanacağı hazır header örneğini gösterir." },
          { name: "Aktif API Anahtarları, Durum, Son Kullanım & İptal Et", type: "Yönetim Tablosu", defaultVal: "Anlık İptal", required: false, effect: "Sızma şüphesinde ilgili entegrasyon anahtarını tek tıkla pasife alabilir veya kalıcı silebilirsiniz." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 5.1: Yeni Dış API Anahtarı (Token) Oluştur — IP Whitelist, Webhook HMAC & 8 Modül Scope Matrisi",
        badge: "Dış API → Yeni Anahtar (+)",
        screenshot: { src: "/screenshots/tabs/deep/api-key-create-modal.jpg", caption: "Kurumsal Dış API → '+' Yeni Dış API Anahtarı Oluştur: IP Whitelist, Süre, Rate Limit, Webhook URL/HMAC ve Modül Scope Matrisi", routeHint: "Sistem Ayarları → Kurumsal Dış API → +" },
        description: "Harici ERP/CRM/Mobil yazılımlara en az yetki prensibiyle güvenli REST API v1 anahtarı üreten 3. seviye penceredir. Üretilen `aida_live_...` anahtarı güvenlik gereği yalnızca tek sefer gösterilir.",
        fields: [
          { name: "Entegrasyon / Yazılım Adı* & Açıklama / Not", type: "Örn. Logo ERP / Özel CRM", defaultVal: "Zorunlu", required: true, effect: "API Erişim Günlüğü ve güvenlik denetiminde isteği hangi entegrasyonun yaptığını tanımlar." },
          { name: "İzin Verilen Sunucu IP Adresleri (IP Whitelist), Geçerlilik Süresi & Dakikalık İstek Limiti", type: "IPv4/CIDR + Süresiz/30/90/365 Gün + req/dk", defaultVal: "Süresiz / 120 istek/dk", required: false, effect: "IP Whitelist girilirse anahtar sızsa bile liste dışındaki IP'lerden gelen tüm istekler HTTP 403 ile reddedilir." },
          { name: "Canlı Olay Bildirimi (Webhook URL) & Webhook Güvenlik İmzası (HMAC Secret)", type: "HTTPS URL + X-AIDA-Signature (HMAC-SHA256)", defaultVal: "Opsiyonel", required: false, effect: "Çağrı çaldığında, açıldığında veya kapandığında harici sunucunuza kriptografik imzalı POST olayı iletir." },
          { name: "Modül Bazlı İşlem Yetkileri (Scope Matrisi) & 3 Hızlı Şablon", type: "Sadece GET / Standart CRM / Tüm Yetkiler + 8 Modül (GET/POST/PUT/DELETE)", defaultVal: "En Az Yetki", required: true, effect: "Canlı Çağrı Kontrolü, CDR & Ses Kayıtları, Aboneler, Rehber, Kuyruk, Kara Liste, Omnichannel ve Sistem Sağlığı yetkilerini metod bazında açıp kapatır." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 5.2: Canlı API Erişim & Güvenlik Denetim Günlüğü (Endpoint, Kaynak IP & HTTP Durum)",
        badge: "Dış API → Erişim Günlüğü",
        screenshot: { src: "/screenshots/tabs/deep/api-access-logs.jpg", caption: "Kurumsal Dış API → 'Canlı API Erişim & Güvenlik Günlüğü' sekmesi: Gerçek zamanlı istek, metod, kaynak IP ve HTTP sonuç kaydı", routeHint: "Sistem Ayarları → Kurumsal Dış API → Canlı API Erişim & Güvenlik Günlüğü" },
        description: "Tüm harici yazılımların `/api/v1/*` uç noktalarına attığı istekleri canlı olarak izleyen, 401/403 yetki hatalarını ve brute-force denemelerini gösteren denetim sekmesidir.",
        fields: [
          { name: "Tarih/Saat, Entegrasyon/Anahtar, Metod, Endpoint, Kaynak IP & HTTP Sonuç", type: "HTTP 200 / 401 / 403 / 429", defaultVal: "Canlı Akış + Günlüğü Temizle", required: false, effect: "Entegrasyon geliştiricilerinin hangi endpoint'in hangi scope ile başarılı olduğunu veya reddedildiğini anında teşhis etmesini sağlar." }
        ]
      },
      {
        tabTitle: "Alt Ekran 6: E-Mail & WhatsApp Sistem Bildirimleri (12 Kritik Olay Tetikleyicisi)",
        badge: "Kanallar 6/6",
        screenshot: { src: "/screenshots/tabs/settings/30-email-bildirim.jpg", caption: "Sistem Ayarları → E-Mail & WhatsApp Sistem Bildirimleri — SMTP, WhatsApp alıcıları ve 12 kritik sistem alarm anahtarı", routeHint: "Sistem Ayarları → E-Mail Bildirimleri" },
        description: "Santralde oluşan tüm kritik arıza, dış hat kopması, donanım darboğazı, güvenlik saldırısı, lisans bitişi ve çağrı krizi olaylarında yöneticilere anında E-Posta ve WhatsApp uyarısı yollar.",
        fields: [
          { name: "Alıcı E-Posta Adresi (Virgülle Çoklu) & Alıcı WhatsApp Numarası (Ülke Koduyla Çoklu)", type: "Örn. it@sirket.com, yonetim@... • 90532...", defaultVal: "Çift Kanal Uyarı", required: false, effect: "Aynı alarmı hem BT yöneticisinin e-postasına hem operasyon müdürünün WhatsApp'ına eşzamanlı gönderir." },
          { name: "SMTP Sunucu (Host), Port, Kullanıcı & Şifre / Uygulama Şifresi", type: "TLS 587 / SSL 465 + Test Gönder", defaultVal: "Test Butonlu", required: false, effect: "Sistem alarmlarının gönderileceği kurumsal SMTP sunucu bilgilerini doğrular." },
          { name: "12 Kritik Olay Tetikleyicisi (Tek Tek Aç/Kapat)", type: "1) SIP Trunk Bağlandı/Koptu • 2) Eşzamanlı Kanal / Tolerans Doldu • 3) AI STT/TTS/LLM Kota & Bağlantı Hatası • 4) Sistem Reboot / Servis Başlatma • 5) Lisans Güncelleme • 6) Lisans Limit / Süre Bitişi • 7) Genel Servis Hatası • 8) Disk/CPU/RAM %90+ • 9) Fail2Ban / Başarısız Giriş • 10) Küfür / Kara Liste • 11) Dialer Başladı/Bitti • 12) Kriz/Öfke Acil Aktarım", defaultVal: "Olay Bazlı Anahtarlar", required: false, effect: "Yalnızca takip etmek istediğiniz kritik olayları açarak gereksiz bildirim kalabalığını önlersiniz." },
          { name: "Son Gönderilen Bildirim Geçmişi", type: "İletim Denetim Tablosu", defaultVal: "Başarılı / Hatalı", required: false, effect: "Gönderilen tüm E-Posta ve WhatsApp uyarılarının saatini, alıcısını ve iletim sonucunu takip etmenizi sağlar." }
        ]
      }
    ]
  },
  "bakim-yedekleme-ve-kayit-saklama": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Tarih, Saat Dilimi, NTP & Sistem Varsayılan Dili",
        badge: "Bakım & Sistem 1/5",
        screenshot: { src: "/screenshots/tabs/settings/31-tarih-saat.jpg", caption: "Sistem Ayarları → Tarih, Saat Dilimi & Bölge Ayarları — NTP sunucuları, manuel saat, 24/12 saat ve dil", routeHint: "Sistem Ayarları → Tarih, Saat & Bölge Ayarları" },
        description: "CDR arama kayıtlarının, mesai/tatil yönlendirmelerinin, 00:00 temsilci performans sıfırlamasının ve SSL sertifikalarının hatasız çalışması için sunucu saatini ve bölgesel biçimleri yönetir.",
        fields: [
          { name: "Sistem Saat Dilimi", type: "IANA Timezone", defaultVal: "Europe/Istanbul (UTC+3)", required: true, effect: "Tüm raporlar, mesai kuralları ve günlük 00:00 sıfırlama bu saat dilimine göre çalışır." },
          { name: "Saat Senkronizasyon Yöntemi (Otomatik NTP / Manuel)", type: "Seçici", defaultVal: "Otomatik NTP", required: true, effect: "İnternetli sunucularda NTP önerilir; tamamen kapalı (Air-Gapped) ağlarda yerel NTP veya Manuel saat seçilebilir." },
          { name: "Birincil & Yedek (İkincil) NTP Sunucusu / Manuel Sunucu Tarih-Saati", type: "pool.ntp.org / İç NTP IP", defaultVal: "tr.pool.ntp.org", required: false, effect: "Sunucu saatinin milisaniye sapmasız kalmasını sağlar." },
          { name: "Tarih Gösterim Formatı, Saat Formatı & Sistem Varsayılan Dili", type: "GG.AA.YYYY / 24 Saat-12 Saat / TR-EN", defaultVal: "GG.AA.YYYY • 24 Saat • TR", required: true, effect: "Yeni açılan kullanıcıların ve rapor dışa aktarımlarının varsayılan tarih, saat ve dil biçimini belirler." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2: Veritabanı Kurtarma, Harici PostgreSQL & Otomatik Sistem Yedekleme Merkezi",
        badge: "Bakım & Sistem 2/5",
        screenshot: { src: "/screenshots/tabs/settings/32-sistem-yedekleme.jpg", caption: "Sistem Ayarları → Sistem Yedekleme — Harici PostgreSQL sunucusu, otomatik NAS yedekleme ve tam .tar.gz yedek arşivi", routeHint: "Sistem Ayarları → Sistem Yedekleme" },
        description: "İki ayrı kurumsal süreklilik altyapısını birleştirir: (1) Harici/Standby PostgreSQL veritabanı sunucusu bağlantısı, (2) Zamanlanmış otomatik tam sistem yedeği (.tar.gz), harici NAS aktarımı ve tek tıkla geri yükleme.",
        fields: [
          { name: "1. Altyapı — Harici PostgreSQL Çalışma Modu", type: "Yerel DB / Canlı Harici Sunucu / Standby Yedek Replikasyon", defaultVal: "Yerel PostgreSQL (5444)", required: false, effect: "Büyük kurumsal kurulumlarda PostgreSQL veritabanını harici yüksek erişilebilir (HA) veritabanı sunucusuna taşımanızı veya canlı yedeğini tutmanızı sağlar." },
          { name: "PostgreSQL Sunucu IP / Host, Port, Veritabanı Adı, Kullanıcı & Şifre", type: "TCP 5432/5444 + Bağlantı Testi", defaultVal: "ai_pbx", required: false, effect: "Harici PostgreSQL erişimini canlı test eder ve güvenli bağlantı dizesini yapılandırır." },
          { name: "2. Altyapı — Otomatik Yedekleme Periyodu & Rotasyon Sayısı", type: "Günlük / Haftalık / Aylık + Maks. Yedek Adedi", defaultVal: "Rotasyonlu Temizlik", required: false, effect: "Belirlenen periyotta tam PostgreSQL + ayarlar + Asterisk + anons yedeği alır; limit dolunca en eski yedeği otomatik silerek diskin dolmasını önler." },
          { name: "Harici Yedekleme Klasör Yolu (NAS / File Server)", type: "Mount Dizin Yolu", defaultVal: "Opsiyonel", required: false, effect: "Oluşturulan tam .tar.gz yedeklerini yerel diskle birlikte harici NAS/dosya sunucusuna otomatik kopyalar." },
          { name: "Sistem & Veritabanı Yedek Arşivi + Bilgisayardan Yükle (.tar.gz) & Onaylı Geri Yükle", type: "İndir / Yükle / Geri Yükle", defaultVal: "Onay Kutucuklu", required: false, effect: "Felaket kurtarma veya yeni sunucuya geçişte .tar.gz arşivini yükleyip onay kutucuğuyla tüm santrali dakikalar içinde eski haline döndürür." }
        ]
      },
      {
        tabTitle: "Alt Ekran 3: Geri Yükleme Noktaları (Anlık Snapshot & Otomatik Şişme Koruması)",
        badge: "Bakım & Sistem 3/5",
        screenshot: { src: "/screenshots/tabs/settings/33-geri-yukleme.jpg", caption: "Sistem Ayarları → Geri Yükleme Noktası — Manuel snapshot, otomatik oluşturma periyodu ve şişmeyi önleme politikası", routeHint: "Sistem Ayarları → Geri Yükleme Noktası" },
        description: "Büyük CallFlow, SIP Trunk, AI Senaryosu veya Toplu Konfigürasyon değişiklikleri öncesinde saniyeler içinde alınan hafif, tenant-izole konfigürasyon geri dönüş noktalarıdır.",
        fields: [
          { name: "Otomatik Oluşturma Anahtarı & Otomatik Oluşturma Periyodu", type: "Açık/Kapalı + Saatlik / Günlük / Haftalık", defaultVal: "Otomatik", required: false, effect: "Yönetici unutsa dahi düzenli aralıklarla çalışan santral ayarlarının fotoğrafını arka planda saklar." },
          { name: "Otomatik Silme (Şişmeyi Önleme): Maksimum Kayıt Adedi & Saklama Süresi (Gün)", type: "Örn. Maks. 20 Kayıt / 30 Gün", defaultVal: "Aktif", required: false, effect: "Eski snapshot'ların diski doldurmasını otomatik önler." },
          { name: "Kayıtlı Geri Yükleme Noktaları & 'Geri Yükleme Noktasına Dön'", type: "Tek Tık Konfigürasyon Rollback", defaultVal: "Ses Kayıtlarına Dokunmaz", required: false, effect: "CDR geçmişini ve ses kayıtlarını silmeden yalnızca santral ayarlarını seçilen noktaya anında geri alır." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 3.1: Yeni Geri Yükleme Noktası Oluştur (5 Hazır Başlık Çipi & Not)",
        badge: "Bakım → Snapshot Oluştur (+)",
        screenshot: { src: "/screenshots/tabs/deep/restore-point-create.jpg", caption: "Geri Yükleme Noktası → '+' Yeni Geri Yükleme Noktası Oluştur: 5 hazır operasyon başlığı ve açıklama notu", routeHint: "Sistem Ayarları → Geri Yükleme Noktası → +" },
        description: "Kritik bir düzenleme öncesi 1 saniyede adlandırılmış konfigürasyon fotoğrafı alan penceredir.",
        fields: [
          { name: "Geri Yükleme Noktası Başlığı* & 5 Hazır Başlık Çipi", type: "AI Senaryo / CallFlow / SIP Trunk / Kullanıcı-Rol / Stabil Konfigürasyon", defaultVal: "Zorunlu", required: true, effect: "Standart başlıkları tek tıkla doldurarak gelecekte hangi noktaya döneceğinizi kolayca hatırlamanızı sağlar." },
          { name: "Açıklama / Not (İsteğe Bağlı)", type: "Serbest Not", defaultVal: "Tenant Bazlı İzole", required: false, effect: "Yapılacak değişikliğin sebebini kayıt altına alır." }
        ]
      },
      {
        tabTitle: "Alt Ekran 4: Ses Kayıt Saklama, Harici NAS/SMB/SFTP, Dinamik Kayıt & KVKK İmha Politikası",
        badge: "Bakım & Sistem 4/5",
        screenshot: { src: "/screenshots/tabs/settings/34-kayit-saklama.jpg", caption: "Sistem Ayarları → Kayıt & Saklama Sistemi — Canlı disk kapasite paneli, harici aktarım, dinamik kayıt ve KVKK imha kuralları", routeHint: "Sistem Ayarları → Kayıt & Saklama Sistemi" },
        description: "Ses kayıtlarının yerel/harici depolanmasını, anahtar kelime tetiklemeli dinamik ses kaydını, disk/zaman bazlı otomatik KVKK imhasını ve ömür boyu koruma modunu yönetir.",
        fields: [
          { name: "Canlı Disk Alanı ve Kapasite İzleme Paneli", type: "Yerel SSD + Harici NAS + Kalan Saat Tahmini", defaultVal: "Gerçek Zamanlı", required: false, effect: "Mevcut kayıt boyutunu, boş alanı ve mevcut trafik hızında diskin kaç saat daha kayıt tutabileceğini canlı hesaplar." },
          { name: "Harici Depolama Çalışma Modu & 3 Protokol Seçimi", type: "Taşı (Move) / Çift Yedekli (Mirror) • NFS Mount Path / Windows SMB / SFTP (SSH)", defaultVal: "Yerel Disk", required: false, effect: "NFS için Mount Path; Windows SMB için Host, Share Name, Alt Klasör, Kullanıcı, Şifre, Domain/Workgroup; SFTP için Host, SSH Port, Remote Path, Kullanıcı ve Şifre girilip canlı test edilir." },
          { name: "Dinamik Ses Kaydı (Anahtar Kelime Tetiklemeli)", type: "Çalışma Modu + Konuşmacı Yetkisi (Her İkisi / Temsilci / Arayan) + Tetikleyici Kelimeler", defaultVal: "Özelleştirilebilir", required: false, effect: "Sürekli kayıt yapılmayan hatlarda dahi belirlenen hukuki/satış anahtar kelimeleri söylendiğinde görüşmeyi otomatik arşivler." },
          { name: "Disk Doluluk Oranına Göre Silme & Zaman Aşımına Göre Silme (Gün)", type: "% Doluluk Eşiği + Kayıt Tutma Süresi (Gün)", defaultVal: "365 Gün", required: false, effect: "Disk belirlenen doluluğa ulaşınca veya KVKK saklama süresi dolunca en eski ses kayıtlarını periyodik imha eder." },
          { name: "Güvenlik Kalkanı Engellenen IP Otomatik Silme (Gün)", type: "Periyodik Temizleme", defaultVal: "Gün Bazlı", required: false, effect: "Eski Fail2Ban engelleme geçmişinin veritabanını şişirmesini önler." },
          { name: "Koruma Modu (Ömür Boyu Saklama)", type: "Üst Kilit Anahtarı", defaultVal: "Kapalı", required: false, effect: "Açıldığında disk ve süre bazlı tüm otomatik ses kaydı silme kuralları devre dışı bırakılarak hiçbir kaydın silinmemesi garanti edilir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Görünüm 4.1: Harici Depolama (NAS / SMB / SFTP) & Dinamik Ses Kaydı Aktif Görünümü",
        badge: "Kayıt & Saklama → NAS & Dinamik Açık",
        screenshot: { src: "/screenshots/tabs/toggled/storage-external-smb-expanded.jpg", caption: "Kayıt & Saklama Sistemi → Harici Depolama (NAS/SMB/SFTP) ve Dinamik Ses Kaydı aktif görünümü", routeHint: "Sistem Ayarları → Kayıt & Saklama Sistemi (Aktif)" },
        description: "Harici NAS/File Server aktarımı ve Dinamik Ses Kaydı anahtarları açıldığında görünen canlı çift disk kapasite paneli ve anlık eşitleme kontrolleridir.",
        fields: [
          { name: "Canlı Çift Disk İzleme & 'Bekleyen Kayıtları Şimdi Aktar'", type: "Bağlı & Yazılabilir Durumu + Manuel Eşitle", defaultVal: "Gerçek Zamanlı", required: false, effect: "Arka plan zamanlayıcısını beklemeden yerel diskteki tüm bekleyen ses kayıtlarını harici NAS/SMB/SFTP sunucusuna anında aktarır." },
          { name: "Taşı (Move) vs. Çift Yedekli (Mirror) Karşılaştırması", type: "Disk Tasarrufu / Çift Kopya", defaultVal: "Seçilebilir", required: false, effect: "'Taşı' yerel SSD'yi anında boşaltır; 'Çift Yedekli' hem santralde hem NAS'ta kopya tutarak NAS kesintisinde dahi anında dinleme sağlar." }
        ]
      },
      {
        tabTitle: "Alt Ekran 5: Sistem Versiyonu, Güncelleme Merkezi & Değişiklik Günlüğü",
        badge: "Bakım & Sistem 5/5",
        screenshot: { src: "/screenshots/tabs/settings/35-sistem-versiyonu.jpg", caption: "Sistem Ayarları → Sistem Versiyonu & Güncelleme Merkezi — Yüklü sürüm, kopyala butonu ve tüm değişiklik geçmişi", routeHint: "Sistem Ayarları → Sistem Versiyonu & Günlük" },
        description: "Santralde kurulu aktif sürüm kodunu, yeni güncelleme kontrolünü ve kronolojik tüm özellik/düzeltme günlüğünü (Changelog) sunar.",
        fields: [
          { name: "Aktif Sürüm Rozeti & 'Versiyon Kodu Kopyala'", type: "GET /api/version", defaultVal: "v3.10.11", required: false, effect: "Destek taleplerinde veya çoklu sunucu karşılaştırmasında tek tıkla güncel sürüm kodunu kopyalar." },
          { name: "Güncelleme Kontrolü & Yüklü Sürüm Geçmişi (Changelog)", type: "Sürüm Notları + Onay Modalı", defaultVal: "Kronolojik", required: false, effect: "Her sürümle gelen yeni modülleri, güvenlik yamalarını ve hata düzeltmelerini ayrıntılı olarak listeler." }
        ]
      }
    ]
  },
  "sistem-panosu-ve-saglik": {
    editFormSections: [
      {
        tabTitle: "Bölüm 1: 5 Çekirdek Servis Sağlık Kartı & Canlı Kapasite Göstergeleri",
        badge: "Canlı Sağlık 1/2",
        description: "Santralin ses, yapay zeka, depolama ve veritabanı omurgasını oluşturan 5 kritik alt sistemin gerçek zamanlı sağlık durumunu 5 saniyede bir denetler.",
        fields: [
          { name: "Asterisk AMI Bağlantısı (Port 5038)", type: "Bağlı / Kopuk + Uptime", defaultVal: "Canlı Socket", required: false, effect: "Santral çekirdeğiyle kontrol köprüsünün canlı durumunu gösterir; kopma varsa anında kırmızı alarm üretir." },
          { name: "Gemini Live Audio API & AudioSocket TCP (Port 9092)", type: "AI Ses Köprüsü Durumu", defaultVal: "Dinlemede", required: false, effect: "Yapay zeka sesli asistanlarının canlı telefon çağrılarına cevap verebilmesi için kritik AudioSocket ve API erişimini doğrular." },
          { name: "Ses Kayıt Depolama (Yerel SSD / Harici NAS)", type: "Doluluk % + Boş GB", defaultVal: "< %80 Normal", required: false, effect: "%85 üzerinde sarı, %90 üzerinde kırmızı kritik uyarı ve otomatik yönetici bildirimi üretir." },
          { name: "Bilgi Bankası (RAG — PostgreSQL pgvector)", type: "İndeksli Parça & Vektör Sağlığı", defaultVal: "Aktif", required: false, effect: "RAG veritabanının erişilebilirliğini ve aktif doküman/chunk sayısını doğrular." },
          { name: "Çağrı Sağlığı & Eşzamanlı Kanal Kapasitesi", type: "Aktif Çağrı / Lisans Limiti", defaultVal: "Gerçek Zamanlı", required: false, effect: "Anlık eşzamanlı çağrı sayısının lisans tavanına oranını ve tolerans kanalı kullanımını izler." }
        ]
      },
      {
        tabTitle: "Bölüm 2: Gerçek Zamanlı Donanım Telemetrisi (CPU, RAM & Ağ Trafiği Grafikleri)",
        badge: "Canlı Sağlık 2/2",
        description: "Sunucunun işlemci, bellek ve ağ kartı bant genişliği (RTP + SIP + Web) yükünü canlı akan grafiklerle görselleştirir.",
        fields: [
          { name: "KAYNAK KULLANIM AKIŞI (CPU / RAM)", type: "Canlı Zaman Serisi Grafiği", defaultVal: "5 sn Yenileme", required: false, effect: "Yoğun çağrı veya yerel Whisper/Ollama anlarında işlemci ve RAM darboğazlarını anında yakalamanızı sağlar." },
          { name: "AĞ TRAFİĞİ ETKİNLİĞİ (Throughput RX / TX)", type: "KB/sn – MB/sn Akış", defaultVal: "NIC Bazlı", required: false, effect: "Eşzamanlı ses (RTP) trafiği ile olası DDoS/SIP flood kaynaklı olağandışı ağ sıçramalarını görünür kılar." }
        ]
      }
    ]
  },
  "olay-gunlukleri": {
    editFormSections: [
      {
        tabTitle: "Bölüm 1: Detaylı Filtreleme, Gerçek İstemci IP Denetimi & CSV Dışa Aktarım",
        badge: "Audit Log 1/2",
        description: "Sistemde yapılan her yönetici değişikliğini, giriş/çıkış hareketini, güvenlik uyarısını ve entegrasyon hatasını 5651/KVKK uyumlu biçimde gerçek istemci IP'siyle (`X-Forwarded-For`) kaydeder.",
        fields: [
          { name: "İşlem Kategorisi (Seviye Filtresi)", type: "INFO / WARNING / ERROR / SECURITY / AUDIT", defaultVal: "Tümü", required: false, effect: "Yalnızca kritik hataları, güvenlik girişimlerini veya yönetici yapılandırma değişikliklerini tek tıkla süzmenizi sağlar." },
          { name: "Kullanıcı & Bölüm / Ekran Filtresi", type: "Aktör + Modül Seçici", defaultVal: "Tümü", required: false, effect: "Örn. 'Ali Yılmaz'ın son 7 günde 'Kullanıcılar' veya 'Dış Hat Tanımı' ekranında yaptığı tüm değişiklikleri listeler." },
          { name: "Serbest Arama & Gerçek İstemci IP Adresi", type: "Metin / IP Arama", defaultVal: "X-Forwarded-For", required: false, effect: "Proxy veya Nornia Connect arkasından gelen gerçek kullanıcı IP adresini kaydeder." },
          { name: "CSV / Excel Dışa Aktarım", type: "Denetim Raporu İndir", defaultVal: "Filtreli İndirme", required: false, effect: "İç denetim, ISO 27001 ve hukuki inceleme talepleri için filtrelenmiş günlükleri indirilebilir tablo haline getirir." }
        ]
      },
      {
        tabTitle: "Bölüm 2: Hareket Kaydı Detayı (Etkilenen Kayıtlar & Önce/Sonra Değişiklikler)",
        badge: "Audit Log 2/2",
        description: "Herhangi bir log satırına tıklandığında açılan ve hangi kaydın hangi alanının eski değerinden yeni değerine nasıl değiştiğini gösteren inceleme penceresidir.",
        fields: [
          { name: "Hareket Kaydı Detayı & Etkilenen Kayıtlar (Diff)", type: "Eski Değer → Yeni Değer", defaultVal: "Satıra Tıklayınca Açılır", required: false, effect: "Örn. bir dahili yönlendirmesinin veya dış arama kuralının kim tarafından, saat kaçta ve nasıl değiştirildiğini eksiksiz kanıtlar." }
        ]
      }
    ]
  },
  "sorun-inceleme-sip-debugger": {
    editFormSections: [
      {
        tabTitle: "Sekme 1: Ping (Gecikme RTT, VoIP Jitter & Paket Kaybı Analizi)",
        badge: "Sorun İnceleme 1/4",
        screenshot: {
          src: "/screenshots/tabs/troubleshooting/01-ping.jpg",
          caption: "Sorun İnceleme → Sekme 1: Ping — Hızlı SIP Trunk hedefleri, VoIP kalite özet kartları (Paket Kaybı, Ort. RTT, Jitter/mdev), ICMP yanıt dökümü ve ham konsol çıktısı",
          routeHint: "Yönetim & Ayarlar → Sorun İnceleme → Ping"
        },
        description: "SIP Trunk operatör SBC sunucularına, Nornia Connect Hub'a, şube IP'lerine veya DNS sunucularına anlık ICMP testi yaparak ses kesintisi, robotik ses ve tek yönlü ses problemlerinin ağ kaynaklı olup olmadığını saniyeler içinde tespit eder.",
        fields: [
          { name: "Hızlı Hedefler (Otomatik Trunk & Sistem Listesi)", type: "Tek Tık Seçim", defaultVal: "Kayıtlı SIP Trunklar + DNS", required: false, effect: "Sistemde tanımlı tüm SIP operatör hostları (örn. Ikon Telekom, Netgsm), Nornia Connect Hub ve 8.8.8.8/1.1.1.1 hedefleri tek tıkla doldurulur." },
          { name: "Hedef IP / Alan Adı, Paket Sayısı (4/6/10 Pkt) & Boyut (56B/512B)", type: "ICMP Parametreleri", defaultVal: "4 Pkt • 56B", required: true, effect: "512B paket boyutu seçilerek MTU parçalanması veya büyük RTP paketlerindeki olası ağ kayıpları gerçekçi biçimde test edilebilir." },
          { name: "VoIP Kalite Özet Kartları (Paket Kaybı, Avg RTT, Jitter/mdev, Min/Max)", type: "4 KPI Kartı", defaultVal: "Otomatik Kalite Etiketi", required: false, effect: "%0 kayıp ve düşük jitter değerlerinde 'Mükemmel VoIP Kalitesi (HD)' rozetini gösterir; yüksek sapmada operatör/hat dar boğazını anında işaret eder." },
          { name: "ICMP Paket Yanıt Dökümü & Ham Konsol Çıktısı (Kopyala)", type: "Görsel Çubuk + Terminal", defaultVal: "Her Paket İçin TTL & ms", required: false, effect: "Her ICMP yanıtının gecikmesini görsel çubukla karşılaştırır ve destek kaydına yapıştırmanız için ham Linux `ping` çıktısını tek tıkla kopyalar." }
        ]
      },
      {
        tabTitle: "Sekme 2: Traceroute (Ağ Rotası & Hop Sıçrama Analizi)",
        badge: "Sorun İnceleme 2/4",
        screenshot: {
          src: "/screenshots/tabs/troubleshooting/02-traceroute.jpg",
          caption: "Sorun İnceleme → Sekme 2: Traceroute — Ağ Geçidi (Hop) Rotası tablosu, düğüm IP/alan adı, gecikme ortalamaları ve ham konsol çıktısı",
          routeHint: "Yönetim & Ayarlar → Sorun İnceleme → Traceroute"
        },
        description: "Santral sunucusundan hedef SIP operatörüne veya uzak şubeye giden tüm yönlendiricileri (router/hop) adım adım izler; gecikmenin veya paket düşüşünün tam olarak hangi ağ geçidinde (yerel firewall, ISP omurgası veya operatör peering) başladığını ortaya çıkarır.",
        fields: [
          { name: "Hedef IP / Alan Adı, Maksimum Hop (10/15/20/30) & DNS Çözümle", type: "Rota Parametreleri", defaultVal: "15 Hop", required: true, effect: "'DNS Çözümle' işaretlendiğinde her sıçramanın yalnızca IP adresini değil ters DNS (PTR) düğüm adını da gösterir." },
          { name: "Ağ Geçidi (Hop) Rotası Tablosu (#1..#N)", type: "Düğüm / IP + 3 Ölçüm + Ortalama", defaultVal: "Renk Kodlu Gecikme", required: false, effect: "Her hop için 3 ayrı milisaniye ölçümü ve ortalama gecikmeyi listeler; ICMP yanıtı vermeyen ara güvenlik duvarlarını `* * * (Yanıt Yok / ICMP Filtreli)` olarak işaretler." },
          { name: "Ham Konsol Çıktısı (traceroute) & Kopyala", type: "Terminal Çıktısı", defaultVal: "Tek Tık Kopyala", required: false, effect: "İnternet servis sağlayıcısı (ISP) veya SIP operatör teknik ekibine rota arıza kaydı açarken doğrudan iletilebilir." }
        ]
      },
      {
        tabTitle: "Sekme 3: SIP Capture Yakalama (Canlı Paket Yakalama & PCAP Arşivleme)",
        badge: "Sorun İnceleme 3/4",
        screenshot: {
          src: "/screenshots/tabs/troubleshooting/03-sip-capture.jpg",
          caption: "Sorun İnceleme → Sekme 3: SIP Capture Yakalama — Canlı SIP paket akışı, IP/Port/Metot filtreleri, ham SIP & SDP inceleyici ve arşivlenmiş .PCAP kayıtları",
          routeHint: "Yönetim & Ayarlar → Sorun İnceleme → SIP Capture Yakalama"
        },
        description: "UDP/TCP 5060, TLS 5061, Cisco 5160 ve WebRTC WSS 8089 portlarındaki tüm SIP paketlerini kronolojik ham akış halinde yakalar; gelişmiş filtrelerle daraltıp anında `.pcap` olarak indirmenizi veya sunucuda kalıcı arşiv oluşturmanızı sağlar.",
        fields: [
          { name: "Yakalamayı Başlat/Durdur, Tümünü .PCAP İndir & Temizle", type: "SipTrapper Tampon Kontrolü", defaultVal: "Canlı Tampon", required: false, effect: "Bellekte tutulan tüm yakalanmış paketleri tek seferde Wireshark uyumlu `.pcap` dosyası olarak indirir veya tamponu güvenle sıfırlar." },
          { name: "Çok Boyutlu Filtreler (IP, Port, SIP Metot/Hata & Serbest Arama)", type: "IP • Port • INVITE/REGISTER/4xx-5xx", defaultVal: "Tümü", required: false, effect: "Yalnızca `4xx / 5xx / 6xx Hatalar` veya belirli bir dahili numara / User-Agent / SDP satırı içeren paketleri anında süzer." },
          { name: "Kronolojik SIP Paket Akışı & Ham SIP/SDP Paket İnceleyici", type: "Tablo + Canlı Frame", defaultVal: "Satır Seçimli", required: false, effect: "Tablodan tıklanan herhangi bir paketin tam SIP başlıklarını (`Via`, `Contact`, `P-Asserted-Identity`, `User-Agent`) ve SDP kodek/medya satırlarını (`PCMA`, `RTP port`) gösterir." },
          { name: "Sunucuya Arşivle & Arşivlenmiş PCAP Kayıtları Listesi", type: "Etiketli .PCAP Arşivi", defaultVal: "İndir / Sil", required: false, effect: "Örn. `ikon_trunk_486_analiz` etiketiyle o anki paket yakalamayı sunucu diskine `.pcap` olarak arşivler; daha sonra indirilebilir veya silinebilir." }
        ]
      },
      {
        tabTitle: "Sekme 4: sngrep (Çağrı Akış Diyagramı / Ladder View & Çağrı Bazlı .PCAP)",
        badge: "Sorun İnceleme 4/4",
        screenshot: {
          src: "/screenshots/tabs/troubleshooting/04-sngrep.jpg",
          caption: "Sorun İnceleme → Sekme 4: sngrep — Canlı SIP diyalogları listesi, 3 sütunlu merdiven (ladder) akış diyagramı, ham SIP başlıkları ve çağrı bazlı .PCAP indirici",
          routeHint: "Yönetim & Ayarlar → Sorun İnceleme → sngrep"
        },
        description: "SSH'a bağlanıp terminalde `sngrep` çalıştırmadan doğrudan tarayıcı içinden Call-ID bazlı çağrı diyaloglarını, 3 sütunlu (İstemci ↔ Santral PBX ↔ Dış Hat) merdiven sinyalizasyon diyagramını ve tekil çağrı `.pcap` indirme işlemlerini yönetir.",
        fields: [
          { name: "Diyalog Tipi Filtresi (Tümü / INVITE / REGISTER / OPTIONS) & Canlı Takip", type: "WebSocket Canlı Akış", defaultVal: "Canlı Dinleme Aktif", required: false, effect: "Yeni gelen çağrıları WebSocket üzerinden <20ms gecikmeyle yakalar; 'Canlı Takip' açıkken en son başlayan INVITE diyaloğuna otomatik odaklanır." },
          { name: "Canlı SIP Diyalogları Listesi & Çağrı Bazlı `.PCAP` Butonu", type: "Call-ID Gruplu Liste", defaultVal: "Renk Kodlu Son Durum", required: false, effect: "Her çağrının arayan/aranan bilgisini, paket sayısını ve son SIP kodunu (200 OK, 486 Busy Here, 403 Forbidden vb.) gösterir; her satırın kendi `.PCAP` indirme butonu vardır." },
          { name: "3 Sütunlu SIP Akış Diyagramı (sngrep Ladder View)", type: "İstemci ↔ PBX ↔ Operatör", defaultVal: "Milisaniye Kronolojisi", required: false, effect: "INVITE → 100 Trying → 183/180 Ringing → 200 OK → ACK → BYE akışını yön oklarıyla çizerek çağrının hangi bacakta reddedildiğini veya zaman aşımına uğradığını netleştirir." },
          { name: "Ham SIP Başlıkları İnceleyici & Metni Kopyala", type: "Seçili Okun Ham Paketi", defaultVal: "Tam SIP + SDP", required: false, effect: "Ladder diyagramında tıklanan herhangi bir mesajın ham SIP ve SDP gövdesini anında görüntüler ve tek tıkla panoya kopyalar." }
        ]
      }
    ]
  },
  "guvenlik-kalkani": {
    editFormSections: [
      {
        tabTitle: "Sekme 1: Fail2Ban & UFW Engellenenler Listesi (Canlı Saldırı İzleme & Unban)",
        badge: "Güvenlik Kalkanı 1/4",
        description: "Asterisk SIP (5060/5061/8089), SSH ve Web/API brute-force saldırılarını otomatik algılayıp Linux UFW ve Fail2Ban üzerinde bloklayan ana komuta ekranıdır.",
        fields: [
          { name: "Engellenen IP Tablosu (Kaynak IP, Jail/Sebep, Engelleme Zamanı, Kalan Süre)", type: "Fail2Ban + UFW Senkron", defaultVal: "Canlı Liste", required: false, effect: "sipvicious, friendly-scanner gibi SIP tarayıcı botlarını ve yetkisiz şifre denemelerini anlık gösterir." },
          { name: "Tek Tık Engel Kaldır (Unban) & Manuel Engelle (+)", type: "Anında Firewall İşlemi", defaultVal: "Audit Loglu", required: false, effect: "Yanlış şifre yüzünden kilitlenen bir şube IP'sinin engelini saniyeler içinde açar veya şüpheli bir IP'yi anında bloklar." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 1.1: Manuel IP / Alt Ağ Engelle Modalı (Fail2Ban & UFW Firewall)",
        badge: "Güvenlik → Manuel IP Engelle (+)",
        screenshot: { src: "/screenshots/tabs/deep/security-ban-modal.jpg", caption: "Güvenlik Kalkanı → '+' Manuel IP / Alt Ağ Engelle: Tekil IPv4 veya CIDR bloğunu anında UFW/Fail2Ban üzerinde bloklama", routeHint: "Güvenlik Kalkanı → Engellenen IP'ler → +" },
        description: "Şüpheli bir kaynak IP adresini veya tüm saldırgan alt ağı (`/24`) otomatik eşiği beklemeden anında Linux güvenlik duvarından (UFW + Fail2Ban) engelleyen alt penceredir.",
        fields: [
          { name: "IP Adresi veya CIDR Bloğu*", type: "Örn. 31.70.90.134 veya 31.70.90.0/24", defaultVal: "Zorunlu", required: true, effect: "'Firewall'da Engelle' tıklandığında ilgili IP veya blok tüm SIP ve web portlarına anında kapatılır." },
          { name: "Engelleme Sebebi / Açıklama", type: "Denetim Notu", defaultVal: "SIP Tarayıcı / Yetkisiz Erişim", required: false, effect: "Diğer yöneticilerin bu bloğun neden kapatıldığını ileride görebilmesi için kaydedilir." }
        ]
      },
      {
        tabTitle: "Sekme 2: Güvenli IP / Blok Listesi (Fail2Ban IgnoreIP & UFW Allow Tablosu)",
        badge: "Güvenlik Kalkanı 2/4",
        screenshot: { src: "/screenshots/tabs/toggled/security-tab-whitelist.jpg", caption: "Güvenlik Kalkanı → Sekme 2: Güvenli IP / Blok Listesi (Fail2Ban ignoreip & UFW Allow) yönetim tablosu", routeHint: "Güvenlik Kalkanı → Güvenli IP / Blok Listesi" },
        description: "Merkez ofis, şubeler, SIP operatör SBC'leri ve ERP sunucularını Fail2Ban yanlış engellemesine karşı kalıcı koruma altına alan beyaz liste tablosudur.",
        fields: [
          { name: "Güvenli IP / CIDR Arama, Düzenleme & Silme", type: "IPv4 / CIDR Tablosu", defaultVal: "Fail2Ban ignoreip + UFW Allow", required: false, effect: "Listelenen tüm IP/CIDR blokları yanlış şifre veya yoğun SIP trafiğinde dahi asla engellenmez." },
          { name: "'Mevcut Yönetici IP'mi Ekle' Hızlı Butonu", type: "Tek Tık Kendi IP'ni Koru", defaultVal: "Otomatik Algılama", required: false, effect: "Kurulum sırasında yöneticinin kendi ofis/ev IP'sini tek tıkla güvenli listeye alarak kendini kilitlemesini önler." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 2.1: Güvenli IP / Alt Ağ Bloğu (IgnoreIP) Ekle / Düzenle Modalı",
        badge: "Güvenlik → Güvenli IP Ekle (+)",
        screenshot: { src: "/screenshots/tabs/deep/security-whitelist-modal.jpg", caption: "Güvenlik Kalkanı → Güvenli IP / Blok Listesi → '+' Güvenli IP (IgnoreIP) Ekle penceresi", routeHint: "Güvenlik Kalkanı → Güvenli IP / Blok Listesi → +" },
        description: "Yeni bir güvenli IPv4 adresi veya `/24` ofis/operatör bloğunu Fail2Ban `ignoreip` ve UFW `allow` kurallarına işler.",
        fields: [
          { name: "IP Adresi veya CIDR Alt Ağ Bloğu* & Açıklama / Lokasyon Adı", type: "Örn. 78.189.x.x/32 • Merkez Ofis Statik IP / Operatör SBC", defaultVal: "Zorunlu", required: true, effect: "Kaydedildiği anda Fail2Ban ve UFW kuralları otomatik yenilenir." }
        ]
      },
      {
        tabTitle: "Sekme 3: Bölgesel Erişim (GeoIP — Ülke Bazlı SIP & Web Güvenlik Duvarı)",
        badge: "Güvenlik Kalkanı 3/4",
        screenshot: { src: "/screenshots/tabs/toggled/security-tab-geoip.jpg", caption: "Güvenlik Kalkanı → Sekme 3: Bölgesel Erişim (GeoIP) — İzin verilen ülkeler ve yabancı ülke erişim engelleme", routeHint: "Güvenlik Kalkanı → Bölgesel Erişim (GeoIP)" },
        description: "Yalnızca hizmet verdiğiniz ülkelerden (örn. sadece Türkiye `TR` veya TR+DE+GB) gelen SIP kayıt ve web bağlantılarına izin vererek yurt dışı kaynaklı otomatik tarama saldırılarını %99 oranında keser.",
        fields: [
          { name: "Ülke Bazlı Erişim Engelleme (GeoIP) Anahtarı", type: "Açık / Kapalı", defaultVal: "Önerilen: Açık", required: false, effect: "Açıldığında izinli liste dışındaki ülkelerden gelen SIP REGISTER/INVITE istekleri daha Asterisk'e ulaşmadan düşürülür." },
          { name: "İzin Verilen Ülkeler Listesi", type: "ISO Ülke Kodları (TR, DE, US, GB...)", defaultVal: "TR", required: false, effect: "Yurt dışı seyahat veya yabancı şubeniz varsa ilgili ülkeyi tek tıkla izinli listeye ekleyebilirsiniz." }
        ]
      },
      {
        tabTitle: "Sekme 4: Anti-DDoS, Fail2Ban Eşikleri & Toll-Fraud Çağrı Sınırlandırması (9 Kritik Parametre)",
        badge: "Güvenlik Kalkanı 4/4",
        screenshot: { src: "/screenshots/tabs/toggled/security-tab-antiddos.jpg", caption: "Güvenlik Kalkanı → Sekme 4: Anti-DDoS / Hız & Çağrı Sınırlandırması — Toll-Fraud, Fail2Ban maxretry/bantime ve hız limitleri", routeHint: "Güvenlik Kalkanı → Anti-DDoS / Hız & Çağrı Sınırlandırması" },
        description: "Ele geçirilen bir dahili hesabın gece saatlerinde pahalı uluslararası numaralara eşzamanlı arama açarak fatura şişirmesini (Toll-Fraud) ve SIP/API DDoS saldırılarını önleyen 9 hassas eşik parametresini yönetir.",
        fields: [
          { name: "Varsayılan Eş Zamanlı Dış Çağrı", type: "Abone Başı Kanal Limiti", defaultVal: "2 Eşzamanlı", required: true, effect: "Bir dahili kullanıcı kartında özel limit girilmediyse aynı anda en fazla kaç dış arama yapabileceğini sınırlar." },
          { name: "Saniye Hız Penceresi (Sn) & Pencere İçi Maks. Arama Adeti", type: "Burst Koruma (örn. 10 sn / 3 arama)", defaultVal: "Otomatik İzleme", required: true, effect: "Bot yazılımın 5 saniye içinde art arda onlarca dış arama başlatmasını anında yakalar." },
          { name: "Dakikalık Maks. Dış Arama (60 sn)", type: "Abone Dakika Tavanı", defaultVal: "Örn. 10 arama/dk", required: true, effect: "Bir abonenin 1 dakika içinde başlatabileceği maksimum dış çağrı sayısını sınırlar." },
          { name: "Toll-Fraud İhlal Eşiği & Otomatik Karantina", type: "İhlal Sayısı → Otomatik Blok", defaultVal: "Anında Karantina", required: true, effect: "Eşik aşıldığında ilgili dahili otomatik karantinaya alınır ve yöneticilere acil E-Posta/WhatsApp bildirimi gönderilir." },
          { name: "Hatalı SIP / Giriş Deneme Limiti (maxretry)", type: "Fail2Ban Eşiği", defaultVal: "5 Hatalı Deneme", required: true, effect: "Aynı IP'den bu sayı kadar hatalı SIP REGISTER veya panel şifresi girildiğinde IP otomatik banlanır." },
          { name: "Firewall Engelleme Süresi (Dakika - bantime)", type: "Dakika (örn. 60 / 1440 dk)", defaultVal: "60–1440 dk", required: true, effect: "Fail2Ban tarafından engellenen saldırgan IP'nin güvenlik duvarında kaç dakika bloklu kalacağını belirler." },
          { name: "API İstek Limiti (Dakikada)", type: "Rate Limit (req/dk)", defaultVal: "120 istek/dk", required: true, effect: "Harici API uç noktalarına yönelik Flood/DDoS saldırılarında IP bazlı HTTP 429 hız sınırlaması uygular." },
          { name: "SIP Paket Limiti (Saniyede)", type: "Anti-DDoS (paket/sn)", defaultVal: "Koruma Eşiği", required: true, effect: "Saniyede aşırı SIP INVITE/OPTIONS paketi gönderen saldırgan kaynakları Asterisk'i kilitlemeden engeller." }
        ],
        tips: [
          "Merkez ofisinizde 20+ telefon aynı dış IP arkasından santrale bağlanıyorsa, Fail2Ban yanlış pozitif engellemesini önlemek için ofis IP'nizi mutlaka Sekme 2 (Güvenli IP Listesi) altına ekleyin."
        ]
      }
    ]
  }
};
