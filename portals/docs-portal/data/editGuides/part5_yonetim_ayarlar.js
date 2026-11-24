export const EDIT_GUIDES_PART5 = {
  "santral-entegrasyonu-ve-nat": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Santral Entegrasyonu (Asterisk AMI, WebRTC WSS & Kayıt Dizin Yolu)",
        badge: "Santral & Ağ 1/9",
        screenshot: { src: "/screenshots/tabs/settings/01-santral-entegrasyonu.jpg", caption: "Sistem Ayarları → Santral Entegrasyonu — AMI, WebRTC WSS ve SIP Güvenlik ayarları", routeHint: "Sistem Ayarları → Santral Entegrasyonu" },
        description: "FastAPI backend ile Asterisk 20 çekirdeği arasındaki AMI (5038) bağlantısı, WSS uç noktası ve ses kayıt kök dizini.",
        fields: [
          { name: "AMI Host, Port, Kullanıcı & Şifre", type: "127.0.0.1 : 5038", defaultVal: "ai_backend_user", required: true, effect: "Canlı çağrı izleme, Click-to-Call, Transfer, ChanSpy dinleme ve SIP Presence LED olaylarının tamamını taşır." },
          { name: "WebRTC (WSS) URL & NAS Kayıt Dizin Yolu", type: "wss://... + Dosya Yolu", defaultVal: "Otomatik FQDN", required: false, effect: "Dahili WebPhone'un şifreli WebSocket sinyal adresini ve kayıt klasörünü belirler." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2: NAT ve Dış IP (Extern IP) Ayarları",
        badge: "Santral & Ağ 6/9",
        screenshot: { src: "/screenshots/tabs/settings/06-nat.jpg", caption: "Sistem Ayarları → NAT ve Dış IP Ayarları — External IP ve Local Nets PJSIP enjeksiyonu", routeHint: "Sistem Ayarları → NAT ve Dış IP Ayarları" },
        description: "NAT arkasındaki santrallerde tüm PJSIP transport'larına (UDP/TCP/WS/WSS) dış IP ve yerel ağ aralığı enjekte eder.",
        fields: [
          { name: "NAT Aktif, Dış IP (External IP) & Yerel Ağ Aralıkları (Local Nets)", type: "Toggle + IPv4 + CIDR", defaultVal: "192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12", required: false, effect: "Tek yönlü ses ve 32. saniyede ACK kopması sorunlarını kökten çözer." }
        ]
      },
      {
        tabTitle: "Alt Ekran 3: Numara Planı (Acil Durumlar, 5 Aralık & Tüm *XX Özellik/Prefix Kodları)",
        badge: "Santral & Ağ 7/9",
        screenshot: { src: "/screenshots/tabs/settings/07-numara-plani.jpg", caption: "Sistem Ayarları → Numara Planı — Acil numaralar, dahili/kuyruk aralıkları ve *XX özellik kodları", routeHint: "Sistem Ayarları → Numara Planı" },
        description: "Kısıtlamasız acil durum çıkışı, 5 numara bloğu ve tüm kurumsal tuşlama kodlarının merkezi yönetim ekranıdır.",
        fields: [
          { name: "Acil Durum Numaraları & Öncelikli Acil Çıkış Trunk", type: "112, 110, 155 + Trunk", defaultVal: "Kısıtlamasız", required: true, effect: "Sadece dahili yetkili telefonlar bile 112 acil aramasını anında dışarı çıkarabilir." },
          { name: "5 Numara Aralığı & Gelişmiş Özellik Kodları", type: "Dahili/Kuyruk/Konferans/Hızlı/IVR + *97, *9, *70, *74, *75, *76, *11", defaultVal: "Özelleştirilebilir", required: true, effect: "Ayrıca Çağrı Yönlendirme, ChanSpy (Dinle/Fısılda/Araya Gir) ve Çağrı Toplama (*8 / **) prefix'lerini yönetir." }
        ]
      }
    ]
  },
  "sunucu-ag-ve-nornia-connect": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Sunucu Ağ (Network) Yönetimi — NIC, Statik Rotalar, DNS & 60 sn Rollback",
        badge: "Santral & Ağ 2/9",
        screenshot: { src: "/screenshots/tabs/settings/02-sunucu-ag.jpg", caption: "Sistem Ayarları → Sunucu Ağ (Network) Yönetimi — Ağ kartları, statik SIP/MPLS rotaları ve DNS", routeHint: "Sistem Ayarları → Sunucu Ağ Yönetimi" },
        description: "Linux Netplan ağ kartları, statik Metro/MPLS rotaları, DNS/hosts ve 60 saniyelik otomatik geri alma koruması.",
        fields: [
          { name: "Ağ Arayüzleri (NIC), Statik Rotalar, DNS/Hosts & Yedekler", type: "4 Sekmeli Netplan GUI", defaultVal: "60 sn Onaylı Rollback", required: true, effect: "Yanlış IP girilip erişim koparsa 60 sn içinde onay gelmediği için sunucu otomatik eski çalışan IP'sine döner." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Sekme 1.1: Statik Rotalar (SIP / MPLS & Operatör SBC Yönlendirme Tablosu)",
        badge: "Sunucu Ağ → Statik Rotalar",
        screenshot: { src: "/screenshots/tabs/toggled/net-static-routes.jpg", caption: "Sunucu Ağ (Network) Yönetimi → Sekme 2: Statik Rotalar (SIP / MPLS) — Özel operatör SBC ve şube MPLS ağ geçidi tanımları", routeHint: "Sistem Ayarları → Sunucu Ağ Yönetimi → Statik Rotalar" },
        description: "Operatör SIP SBC bloklarına, MPLS şube alt ağlarına veya ikinci ağ kartı üzerinden özel VLAN'lara kalıcı Linux Netplan statik rotası tanımlar.",
        fields: [
          { name: "Hedef Ağ (CIDR), Ağ Geçidi (Via), Çıkış Arayüzü (NIC), Metrik & Kalıcı Netplan Yazımı", type: "IPv4/CIDR + Gateway", defaultVal: "Reboot Kalıcı", required: true, effect: "Sunucu yeniden başlasa bile operatör SBC ve MPLS ses rotalarının kaybolmadan ayakta kalmasını sağlar." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Sekme 1.2: DNS Sunucuları, Sunucu Hostname & /etc/hosts Yönetimi",
        badge: "Sunucu Ağ → DNS & Hosts",
        screenshot: { src: "/screenshots/tabs/toggled/net-dns-hosts.jpg", caption: "Sunucu Ağ (Network) Yönetimi → Sekme 3: DNS Sunucuları, Hostname ve /etc/hosts Yerel Alan Adı Eşleştirmeleri", routeHint: "Sistem Ayarları → Sunucu Ağ Yönetimi → DNS & Hosts" },
        description: "Birincil/ikincil DNS sunucularını, santral makine adını (hostname) ve kurum içi DNS'siz ERP/SBC sunucuları için `/etc/hosts` kayıtlarını yönetir.",
        fields: [
          { name: "DNS Sunucuları, Hostname & /etc/hosts Satırları", type: "8.8.8.8 / 1.1.1.1 + Yerel IP ↔ FQDN", defaultVal: "Anında Uygulanır", required: false, effect: "Operatör FQDN veya yerel Active Directory / CRM sunucu adlarının hatasız çözülmesini sağlar." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Sekme 1.3: Ağ Yedekleri & Konsol / SSH Acil Kurtarma Scripti",
        badge: "Sunucu Ağ → Yedekler & Kurtarma",
        screenshot: { src: "/screenshots/tabs/toggled/net-backups.jpg", caption: "Sunucu Ağ (Network) Yönetimi → Sekme 4: Otomatik Netplan Yedekleri ve Konsol/SSH Acil Kurtarma Scripti", routeHint: "Sistem Ayarları → Sunucu Ağ Yönetimi → Yedekler" },
        description: "Her ağ değişikliği öncesi alınan Netplan YAML snapshot'larını tek tıkla geri yükleme ve fiziksel konsoldan tek satırda ağ kurtarma komutunu sunar.",
        fields: [
          { name: "Netplan Snapshot Geçmişi & Tek Tık Geri Yükle / Acil Kurtarma Komutu", type: "YAML Yedek + CLI Kurtarma", defaultVal: "60 sn Rollback Korumalı", required: false, effect: "Yanlış VLAN/IP yapılandırmasında web erişimi kesilse dahi hem 60 sn otomatik geri alma hem fiziksel konsol kurtarma scripti ile sıfır kesinti garantisi verir." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2: Nornia Connect (Sıfır-Port Bulut Köprüsü & WireGuard SIP Edge)",
        badge: "Santral & Ağ 3/9",
        screenshot: { src: "/screenshots/tabs/settings/03-nornia-connect.jpg", caption: "Sistem Ayarları → Nornia Connect — Kilitli FQDN, HTTPS/WSS tüneli, WireGuard SIP Edge ve TURN rölesi", routeHint: "Sistem Ayarları → Nornia Connect" },
        description: "Firewall'da tek port açmadan HTTPS web, WebRTC WSS ve WireGuard SIP/RTP Edge uzak telefon erişimi sağlayan bulut köprüsü.",
        fields: [
          { name: "Merkez Hub, Kilitli Alt Alan Adı, Kilidi Sorgula & TURN Rölesi", type: "<ad>.nornia.com.tr + WireGuard", defaultVal: "Merkez Tescilli", required: true, effect: "Alt alan adı bu sunucu donanımına kilitlenir; Cross-Tenant trafik sızıntısı %100 engellenir." }
        ]
      },
      {
        tabTitle: "Alt Ekran 3: Sunucu Web SSH Terminali (Tarayıcı İçi Linux/Asterisk Konsolu)",
        badge: "Santral & Ağ 5/9",
        screenshot: { src: "/screenshots/tabs/settings/05-web-ssh.jpg", caption: "Sistem Ayarları → Sunucu Web SSH Terminali — Güvenli tarayıcı içi xterm.js SSH konsolu", routeHint: "Sistem Ayarları → Sunucu Web SSH Terminali" },
        description: "Ek bir SSH programı olmadan tarayıcıdan doğrudan Asterisk CLI, PM2 ve Linux bakım komutlarını çalıştırır.",
        fields: [
          { name: "Web SSH Konsolu (xterm.js)", type: "server_ssh:access", defaultVal: "Oturum Loglu", required: false, effect: "asterisk -rvvv, pm2 logs ve ağ tanılama komutlarını anında çalıştırır." }
        ]
      }
    ]
  },
  "cok-subeli-santral-federation": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Çok-Şubeli Santral (Multi-Site Hub/Edge & SRST Failover)",
        badge: "Santral & Ağ 4/9",
        screenshot: { src: "/screenshots/tabs/settings/04-cok-subeli.jpg", caption: "Sistem Ayarları → Çok-Şubeli Santral (Multi-Site) — Standalone / Hub / Edge rolü ve SRST Failover", routeHint: "Sistem Ayarları → Çok-Şubeli Santral" },
        description: "Birden fazla şubedeki Nornia santrallerini tek merkezden yöneten dağıtık mimari.",
        fields: [
          { name: "Sunucu Rolü & Medya/Failover Politikası", type: "Standalone / Hub / Edge + active_local / srst_failover", defaultVal: "Standalone", required: true, effect: "Şube içi ses yerel ağda kalır; WAN koparsa şube santrali kendi dış hattından çalışmaya devam eder (SRST)." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere: Yeni Taşra / Şube Santrali Ekle (Aktif-Yerel Edge / SRST, Dahili Bloğu, Failover Trunk & Opus Sync)",
        badge: "Multi-Site → Yeni Şube Ekle",
        screenshot: { src: "/screenshots/tabs/deep/federation-site-modal.jpg", caption: "Çok-Şubeli Santral → 'Yeni Şube Ekle': Çalışma & Hayatta Kalma Modu, Dahili Aralığı, WireGuard IP, Failover Trunk ve Ses Kaydı Sıkıştırma Politikası", routeHint: "Sistem Ayarları → Çok-Şubeli Santral → +" },
        description: "Merkez (Hub) santraline yeni bir taşra/şube Edge santrali tanımlarken dahili bloğunu, WireGuard tünel IP'sini, internet kesintisi yedek hattını ve ses kaydı senkronizasyon politikasını belirleyen 3. seviye penceredir.",
        fields: [
          { name: "Şube Kodu (Benzersiz) & Şube Adı", type: "Örn. site-01 / Polatlı Şubesi", defaultVal: "Zorunlu", required: true, effect: "Merkez ile şube arasındaki PJSIP Trunk ve CDR/ses kaydı eşitleme kimliğini belirler." },
          { name: "Çalışma & Hayatta Kalma Modu", type: "Aktif-Yerel Edge (Önerilen) / SRST Failover (Merkez → Yerel)", defaultVal: "Aktif-Yerel Edge", required: true, effect: "Aktif-Yerel Edge'de telefonlar daima yerel şube santraline bağlı kalır (kötü internette sıfır kesinti); SRST modunda normalde merkeze bağlı olup kopmada 15–30 sn içinde yerele geçer." },
          { name: "Dahili Başlangıç / Bitiş, Şube Yerel IP & WireGuard IP", type: "Örn. 2000–2999 + LAN IP + 10.200.1.1", defaultVal: "Çakışmasız Blok", required: true, effect: "Merkez ile şube arasında çakışmasız dahili-to-dahili arama tablosu ve şifreli WireGuard ağı kurar." },
          { name: "Dış Arama & İnternet Kesintisi Yedek Hat (1. Birincil + 2. Yedek GSM/FXO)", type: "hq_federation_trunk + Lokal GSM/FXO", defaultVal: "Otomatik Failover", required: false, effect: "İnternet kesildiğinde şube dış aramaları otomatik olarak 2. yedek yerel GSM/FXO ağ geçidinden çıkar." },
          { name: "Ses Kaydı Sıkıştırma & Senkronizasyon Politikası", type: "Format (OPUS ~%85 küçültme) + Hız Limiti (256 Kbps) + Zamanlama (Mesai Dışı 19:00–08:00)", defaultVal: "OPUS / 256 Kbps / Mesai Dışı", required: false, effect: "Şube internetini yavaşlatmadan ses kayıtlarını gece saatlerinde OPUS ile sıkıştırıp merkeze aktarır." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2: Otoprovizyon Şablonları (.CFG / .XML Editörü)",
        badge: "Santral & Ağ 8/9",
        screenshot: { src: "/screenshots/tabs/settings/08-otoprovizyon-sablon.jpg", caption: "Sistem Ayarları → Otoprovizyon Şablonları — Marka/Model bazlı CFG/XML özelleştirme", routeHint: "Sistem Ayarları → Otoprovizyon Şablonları" },
        description: "Yealink, Fanvil, Grandstream, Cisco ve Snom telefonların kurumsal konfigürasyon şablonlarını düzenler.",
        fields: [
          { name: "Şablon Adı, Marka, Model & Konfigürasyon İçeriği", type: ".CFG / .XML + {{degisken}}", defaultVal: "Hazır Şablonlar", required: false, effect: "Dil, saat, NTP, zil sesi, şirket logosu ve BLF kurallarını model bazında özelleştirir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 2.1: Özel Otoprovizyon Şablonu Kopyala / Düzenle Editörü (.CFG / .XML)",
        badge: "Şablonlar → Kopyala / Düzenle",
        screenshot: { src: "/screenshots/tabs/toggled/autoprov-template-edit.jpg", caption: "Otoprovizyon Şablonları → Şablon Kopyala / Özel Şablon Oluştur: Marka, model, değişken yer tutucuları ve ham .CFG/.XML kod editörü", routeHint: "Sistem Ayarları → Otoprovizyon Şablonları → Kopyala / Düzenle" },
        description: "Yerleşik sistem şablonlarını bozmadan kopyalayıp kendi şirketinize özel logo, VLAN, LDAP rehber veya zil sesi satırları eklediğiniz şablon editörüdür.",
        fields: [
          { name: "Şablon Adı, Marka, Model & Ham .CFG/.XML İçeriği", type: "{{sip_user}}, {{sip_pass}}, {{sip_host}}, {{blf_block}}", defaultVal: "Sistem Şablonundan Klon", required: true, effect: "Kaydedilen özel şablon Oto Provizyon cihaz atama penceresinde seçilebilir hale gelir." }
        ]
      },
      {
        tabTitle: "Alt Ekran 3: SSL Sertifikaları (Nginx HTTPS + Asterisk WSS 8089)",
        badge: "Santral & Ağ 9/9",
        screenshot: { src: "/screenshots/tabs/settings/09-ssl.jpg", caption: "Sistem Ayarları → SSL Sertifikaları — Kurumsal TLS/WSS sertifika yükleme ve geçerlilik durumu", routeHint: "Sistem Ayarları → SSL Sertifikaları" },
        description: "Özel kurumsal SSL sertifikalarını hem web arayüzüne hem Asterisk WSS (8089) portuna tek tıkla uygular.",
        fields: [
          { name: "fullchain.pem & privkey.pem Yükleme", type: "PEM Dosyaları", defaultVal: "/etc/asterisk/keys/asterisk.pem (644)", required: false, effect: "Sertifika ve özel anahtarı birleştirip doğru okuma izinleriyle Nginx ve Asterisk'e uygular." }
        ]
      }
    ]
  },
  "roller-kvkk-ve-ldap": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Roller (RBAC — 60+ Modül & 25+ Çağrı Paneli Granüler Yetkisi)",
        badge: "Organizasyon 1/7",
        screenshot: { src: "/screenshots/tabs/settings/10-roller.jpg", caption: "Sistem Ayarları → Roller — Granüler okuma/yazma/silme ve Temsilci Paneli sekme yetkileri", routeHint: "Sistem Ayarları → Roller" },
        description: "Tüm modüller için :read / :write / :delete / :access ve Temsilci Çağrı Paneli'nin 25+ ince yetkisini yönetir.",
        fields: [
          { name: "Modül, Süpervizör & Temsilci Paneli Yetki Matrisi", type: "60+ Modül + 25+ call_panel:*", defaultVal: "Admin / Süpervizör / Temsilci", required: true, effect: "En az yetki prensibiyle her kullanıcının yalnızca görevine ait ekran ve butonları görmesini sağlar." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere: Rolü Düzenle / Yeni Rol Oluştur (9 Yetki Kategorisi, Granüler CRUD & Süpervizör Alt Yetkileri)",
        badge: "Roller → Düzenle Modalı",
        screenshot: { src: "/screenshots/tabs/deep/role-edit-modal.jpg", caption: "Roller → Rolü Düzenle: 9 yetki başlığı, Görüntüleme/Güncelleme/Silme butonları, Süpervizör müdahale alt yetkileri ve İzin Verilen Mola Tipleri", routeHint: "Sistem Ayarları → Roller → Düzenle" },
        description: "Herhangi bir rol kartında 'Düzenle' veya '+' butonuna basıldığında açılan ve 248+ bireysel yetki kodunu 9 kategori sekmesinde yöneten 3. seviye RBAC penceresidir.",
        fields: [
          { name: "Rol Kodu & Rol İsmi", type: "Slug (admin/supervisor/agent) + Görünen Ad", defaultVal: "Zorunlu", required: true, effect: "Kullanıcı Düzenle ekranındaki Rol seçicisinde görünecek kimliği belirler." },
          { name: "9 Kategori Sekmesi & 'Tümünü Seç / Tümünü Kaldır'", type: "Operasyon, Süpervizör, AI & Bilgi, Santral, Çağrı & Yönlendirme, Raporlar, Yönetim, Sistem Ayarları, İzin Verilen Mola Tipleri", defaultVal: "Sayısal Sayaçlı (44/44)", required: false, effect: "Her kategoride kaç yetkinin açık olduğunu anlık sayaçla gösterir; tek tıkla kategori bazlı toplu seçim/kaldırma yapar." },
          { name: "Granüler Aksiyon Kodları (:access / :read / :write / :delete) & Süpervizör Alt Yetkileri", type: "Görüntüleme / Ekleme-Düzenleme / Silme + Canlı Müdahale / Oturum Kapatma / Kapsam Filtresi", defaultVal: "En Az Yetki", required: false, effect: "Örn. bir takım liderine Canlı İzleme'de 'Durum Müdahalesi' yetkisi verirken 'Temsilci Oturum Kapatma' yetkisini kapalı tutabilirsiniz." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2: KVKK & Gizlilik Politikası Onay Yönetimi",
        badge: "Organizasyon 2/7",
        screenshot: { src: "/screenshots/tabs/settings/11-kvkk.jpg", caption: "Sistem Ayarları → KVKK & Gizlilik Politikası — Metin sürümü ve hukuki onay denetim tablosu", routeHint: "Sistem Ayarları → KVKK & Gizlilik Politikası" },
        description: "6698 sayılı KVKK aydınlatma metnini yayımlar ve tüm kullanıcıların onaylarını IP/tarih/hash ile hukuki olarak arşivler.",
        fields: [
          { name: "Politika Metni, Sürüm & Onay Durum Filtresi", type: "Onayladı / Bekliyor / Eski Sürüm", defaultVal: "Değiştirilemez Audit", required: false, effect: "Metin güncellendiğinde tüm kullanıcılar (Admin dahil) girişte yeni metni onaylar." }
        ]
      },
      {
        tabTitle: "Alt Ekran 3: Active Directory (LDAP & Azure Entra ID SSO)",
        badge: "Organizasyon 3/7",
        screenshot: { src: "/screenshots/tabs/settings/12-active-directory.jpg", caption: "Sistem Ayarları → Active Directory (LDAP & Entra ID) — Kurumsal dizin bağlantısı ve eşitleme", routeHint: "Sistem Ayarları → Active Directory" },
        description: "Microsoft AD, Azure Entra ID, OpenLDAP ve FreeIPA sunucularından kullanıcı aktarma ve kurumsal şifreyle giriş.",
        fields: [
          { name: "Dizin Türü, Sunucu, Bind DN, Base DN, Bağlantı Testi & Senkronize Et", type: "AD / Entra / OpenLDAP / FreeIPA", defaultVal: "LDAP 389 / LDAPS 636", required: false, effect: "Şirket dizinindeki personelleri tek tıkla Nornia kullanıcılarına dönüştürür." }
        ]
      },
      {
        tabTitle: "Alt Ekran 4: Lokasyon ve Departmanlar",
        badge: "Organizasyon 4/7",
        screenshot: { src: "/screenshots/tabs/settings/13-lokasyon-departman.jpg", caption: "Sistem Ayarları → Lokasyon ve Departmanlar — Şube ve departman tanımları", routeHint: "Sistem Ayarları → Lokasyon ve Departmanlar" },
        description: "Şirket şubelerini (Merkez, Ankara, Fabrika vb.) ve departmanlarını (Satış, Destek, Muhasebe) tanımlar.",
        fields: [
          { name: "Lokasyon & Departman Listesi", type: "Hiyerarşik Tanım", defaultVal: "Merkez", required: false, effect: "Kullanıcı kartı, Toplu Konfigürasyon ve Departman Raporlarında filtreleme ekseni olur." }
        ]
      },
      {
        tabTitle: "Alt Ekran 5: Mola Tanımları (Mola Türleri, Günlük Limitler & Wallboard Renkleri)",
        badge: "Organizasyon 5/7",
        screenshot: { src: "/screenshots/tabs/settings/14-mola-tanimlari.jpg", caption: "Sistem Ayarları → Mola Tanımları — Yemek, İhtiyaç, Eğitim mola türleri ve süre limitleri", routeHint: "Sistem Ayarları → Mola Tanımları" },
        description: "Temsilcilerin seçebileceği kurumsal mola nedenlerini ve günlük dakika limitlerini yönetir.",
        fields: [
          { name: "Mola Adı, Günlük Süre Limiti (dk) & Renk Etiketi", type: "Yemek / İhtiyaç / Eğitim / Toplantı", defaultVal: "agent_break_logs", required: false, effect: "Wallboard'da temsilci rengini ve Mola & Puantaj Raporu'ndaki kırılım sütunlarını belirler." }
        ]
      }
    ]
  },
  "musteri-ve-lisans-yonetimi": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Müşteri (Tenant) Yönetimi — Multi-Tenant İzolasyon & Kota Motoru",
        badge: "Organizasyon 6/7",
        screenshot: { src: "/screenshots/tabs/settings/15-musteri-tenant.jpg", caption: "Sistem Ayarları → Müşteri (Tenant) Yönetimi — Çoklu müşteri izolasyonu, paket ve durum yönetimi", routeHint: "Sistem Ayarları → Müşteri (Tenant) Yönetimi" },
        description: "Tek sunucuda birden fazla şirketi 15 PostgreSQL tablosunda katı tenant_id izolasyonuyla yönetir.",
        fields: [
          { name: "Müşteri Adı, Kod Adı (Slug), Lisans Planı, Bitiş Tarihi & Durum", type: "active / passive", defaultVal: "tenant-default", required: true, effect: "Pasife alınan müşterinin web erişimi ve AudioSocket AI çağrıları anında durdurulur." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere: Yeni Müşteri Lisansı Oluştur / Düzenle (İmzalı Key, İzinli STT/TTS/LLM & Kota Özeti)",
        badge: "Tenant → Müşteri Lisansı",
        screenshot: { src: "/screenshots/tabs/deep/tenant-edit-modal.jpg", caption: "Müşteri (Tenant) Yönetimi → '+' Yeni Müşteri Lisansı Oluştur: İmzalı lisans anahtarı yapıştırma, izinli AI motorları ve salt-okunur kota özeti", routeHint: "Sistem Ayarları → Müşteri (Tenant) Yönetimi → +" },
        description: "Aynı sunucuda yeni bir firma (tenant) oluştururken Merkez Lisans Sunucusundan (Control Center) üretilen donanım-kilitli imzalı anahtarı doğrulayıp kotaları önizleyen alt penceredir.",
        fields: [
          { name: "Müşteri / Firma Adı, Kod Adı (Slug) & Lisans Anahtarı (Panodan Yapıştır)", type: "HMAC-SHA256 + Base64 Kota", defaultVal: "Otomatik Çözümlenir", required: true, effect: "Anahtar yapıştırıldığı anda lisans paketi (Starter/Professional/Enterprise), bitiş tarihi ve müşteri durumu kriptografik olarak çözülür." },
          { name: "1. Yapay Zeka Lisans Hakları & İzinli Motorlar (Salt-Okunur)", type: "AI Temsilci / RAG / Senaryo Kotası + İzinli STT / TTS / LLM", defaultVal: "Merkezi Lisans Kilitli", required: false, effect: "Bu müşterinin hangi STT (Gemini/Deepgram/OpenAI/ElevenLabs), TTS ve LLM (Gemini/OpenAI/Claude/Groq) motorlarını kullanabileceğini ve eşzamanlı kanal (+tolerans) sınırlarını gösterir." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2: Lisans & Key Yönetimi (Donanım Kilidi HW-ID & Çevrimdışı/Çevrimiçi Yenileme)",
        badge: "Organizasyon 7/7",
        screenshot: { src: "/screenshots/tabs/settings/16-lisans-key.jpg", caption: "Sistem Ayarları → Lisans & Key Yönetimi — Donanım Kimliği (HW-ID), aktif kotalar ve anahtar yenileme", routeHint: "Sistem Ayarları → Lisans & Key Yönetimi" },
        description: "Donanım parmak izine (HW-XXXX-XXXX) kilitli HMAC-SHA256 lisans anahtarını ve tüm kullanım kotalarını gösterir.",
        fields: [
          { name: "Donanım Kimliği (HW-ID) & Lisans Anahtarı Yükle", type: "AIDA-{KOD}-{TARİH}-{HW8}-{SIG8}.KOTA", defaultVal: "Kriptografik Doğrulama", required: true, effect: "Merkez Panelden üretilen yeni anahtar girildiğinde tüm kotalar (kullanıcı, kanal, AI, modüller) kesintisiz güncellenir." }
        ]
      }
    ]
  },
  "yapay-zeka-ayar-ve-yonlendirme": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Yapay Zeka API Ayarları (Sağlayıcı Anahtarları & Bağlantı Testi)",
        badge: "AI & Analiz 1/8",
        screenshot: { src: "/screenshots/tabs/settings/17-ai-api.jpg", caption: "Sistem Ayarları → Yapay Zeka API Ayarları — Gemini, OpenAI, ElevenLabs, Deepgram, Anthropic, Groq", routeHint: "Sistem Ayarları → Yapay Zeka API Ayarları" },
        description: "Tüm yapay zeka sesli asistan, transkript, TTS ve analitik motorlarının kullanacağı bulut API anahtarları.",
        fields: [
          { name: "Sağlayıcı API Anahtarları (Maskeli Saklama)", type: "Gemini / OpenAI / ElevenLabs / Deepgram / Anthropic / Groq", defaultVal: "Bağlantı Testli", required: true, effect: "Girilen anahtarlar arayüzde maskelenir ve tek tıkla canlı doğrulanır." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2: AI Görev & Model Yönlendirme (12 Görev Matrisi, Yerel Ollama & CPU Koruması)",
        badge: "AI & Analiz 2/8",
        screenshot: { src: "/screenshots/tabs/settings/18-ai-task-routing.jpg", caption: "Sistem Ayarları → AI Görev & Model Yönlendirme — Yerel Ollama, CPU koruma kalkanı ve 12 görev matrisi", routeHint: "Sistem Ayarları → AI Görev & Model Yönlendirme" },
        description: "Arka plan AI görevlerini yerel Ollama/vLLM sunucusuna veya ekonomik modellere yönlendirerek %60+ token tasarrufu ve KVKK veri egemenliği sağlar.",
        fields: [
          { name: "Yerel/Harici Ollama Sunucusu & Asterisk CPU Koruma Kalkanı", type: "http://127.0.0.1:11434 + Maks. CPU Çekirdek + Tek Sıralı FIFO Kuyruk", defaultVal: "qwen2.5:1.5b / nomic-embed-text", required: false, effect: "Asterisk canlı ses kalitesini koruyarak yerel LLM görevlerini sırayla işler." },
          { name: "12 Arka Plan Görevi İçin Model Seçimi", type: "Transkript, Özet/Duygu, Agent Notu, Sesli/Yazılı QA, RAG Embedding, Fısıltı, Senaryo, API Sihirbazı, Özel Rapor, Config Asistan, Anons TTS", defaultVal: "Görev Bazlı", required: false, effect: "Her görev bağımsız olarak Bulut veya Yerel modele atanır." }
        ]
      },
      {
        tabTitle: "Alt Ekran 3: Çağrı Kalite Kontrol (Otomatik QA Soru Havuzu & Ağırlıklar)",
        badge: "AI & Analiz 3/8",
        screenshot: { src: "/screenshots/tabs/settings/19-qa.jpg", caption: "Sistem Ayarları → Çağrı Kalite Kontrol — AI QA denetim soruları ve puan ağırlıkları", routeHint: "Sistem Ayarları → Çağrı Kalite Kontrol" },
        description: "Her tamamlanan görüşmeyi %100 otomatik puanlayan kurumsal kalite değerlendirme kriterlerini belirler.",
        fields: [
          { name: "QA Soru Havuzu, Kategori & Ağırlık Puanı", type: "Toplam 100 Puan", defaultVal: "Özelleştirilebilir", required: false, effect: "Örn. Selamlama (15p), KVKK Aydınlatma (20p), Doğru Bilgi (35p), Nezaket & Kapanış (30p)." }
        ]
      },
      {
        tabTitle: "Alt Ekran 4: Otomatik Dil Algılama",
        badge: "AI & Analiz 4/8",
        screenshot: { src: "/screenshots/tabs/settings/20-dil-algilama.jpg", caption: "Sistem Ayarları → Otomatik Dil Algılama — Çok dilli karşılama ve dinamik dil geçişi", routeHint: "Sistem Ayarları → Otomatik Dil Algılama" },
        description: "Yabancı uyruklu arayanların konuştuğu dili ilk cümlede algılayıp AI asistanı veya kuyruk yönlendirmesini anında o dile geçirir.",
        fields: [
          { name: "Aktif Diller & Otomatik Geçiş Politikası", type: "TR / EN / DE / AR / RU / FR", defaultVal: "TR + EN", required: false, effect: "Turizm, sağlık turizmi ve ihracat şirketlerinde çok dilli kusursuz karşılama sağlar." }
        ]
      },
      {
        tabTitle: "Alt Ekran 5: Dinamik Duygu Yönetimi (Kriz Eşiği & Eskalasyon)",
        badge: "AI & Analiz 5/8",
        screenshot: { src: "/screenshots/tabs/settings/21-duygu.jpg", caption: "Sistem Ayarları → Dinamik Duygu Yönetimi — Öfke/kriz eşiği ve otomatik süpervizör alarmı", routeHint: "Sistem Ayarları → Dinamik Duygu Yönetimi" },
        description: "Görüşme sırasında müşteri öfkesi yükseldiğinde kriz alarmı üreten ve canlı temsilciye acil aktarım yapan duygu motoru.",
        fields: [
          { name: "Negatif Duygu Eşiği & Acil Eskalasyon Aksiyonu", type: "Eşik + Kriz Alarmı / Canlı Kuyruk Aktarımı", defaultVal: "Aktif", required: false, effect: "Şikayet büyümeden süpervizörü uyarır veya AI görüşmesini anında kıdemli temsilciye devreder." }
        ]
      },
      {
        tabTitle: "Alt Ekran 6: AI Fısıldama Yönetimi (Canlı Temsilci Koçluğu)",
        badge: "AI & Analiz 6/8",
        screenshot: { src: "/screenshots/tabs/settings/22-ai-fisildama.jpg", caption: "Sistem Ayarları → AI Fısıldama Yönetimi — Görüşme sırasında temsilciye anlık RAG yanıt önerisi", routeHint: "Sistem Ayarları → AI Fısıldama Yönetimi" },
        description: "İnsan temsilci müşteriyle konuşurken AI'ın soruyu dinleyip Bilgi Bankası'ndan doğru yanıtı ekrana anlık fısıldamasını yönetir.",
        fields: [
          { name: "AI Fısıldama Aktifliği & Tetikleme Hassasiyeti", type: "Toggle + RAG Kaynağı", defaultVal: "Opsiyonel", required: false, effect: "Yeni işe başlayan temsilcilerin karmaşık teknik/fiyat sorularını hatasız yanıtlamasını sağlar." }
        ]
      },
      {
        tabTitle: "Alt Ekran 7: Biyometrik Ses Analizi (Voiceprint Doğrulama)",
        badge: "AI & Analiz 7/8",
        screenshot: { src: "/screenshots/tabs/settings/23-biyometrik-ses.jpg", caption: "Sistem Ayarları → Biyometrik Ses Analizi — Ses imzası doğrulama eşiği ve güvenlik ayarları", routeHint: "Sistem Ayarları → Biyometrik Ses Analizi" },
        description: "Kayıtlı müşterileri ses parmak izinden doğrulayan ve şüpheli kimlik taklitlerini uyaran biyometri motoru.",
        fields: [
          { name: "Ses Eşleşme Eşiği (%) & Otomatik Tanıma", type: "Slider (%60–%95)", defaultVal: "%80", required: false, effect: "Rehber kartına ses imzası kaydedilen VIP müşterileri saniyeler içinde doğrular." }
        ]
      },
      {
        tabTitle: "Alt Ekran 8: ROI Rapor Ayarları (Finansal Tasarruf Baz Değerleri)",
        badge: "AI & Analiz 8/8",
        screenshot: { src: "/screenshots/tabs/settings/24-roi.jpg", caption: "Sistem Ayarları → ROI Rapor Ayarları — Temsilci maliyeti ve yapay zeka tasarruf parametreleri", routeHint: "Sistem Ayarları → ROI Rapor Ayarları" },
        description: "AI vs. İnsan ROI raporundaki aylık maliyet tasarrufu hesaplamasının birim maliyetlerini tanımlar.",
        fields: [
          { name: "Temsilci Saatlik/Aylık Maliyeti & Çağrı Başı Maliyet", type: "TL / USD", defaultVal: "Özelleştirilebilir", required: false, effect: "CEO Özet ve ROI raporlarında yönetime sunulan net kazanç rakamını hesaplar." }
        ]
      }
    ]
  },
  "kanallar-crm-ve-dis-api": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Kanal Entegrasyonları (Çoklu WhatsApp + Telegram + Meta + SMTP/IMAP)",
        badge: "Kanallar 1/6",
        screenshot: { src: "/screenshots/tabs/settings/25-kanallar.jpg", caption: "Sistem Ayarları → Kanal Entegrasyonları — Çoklu WhatsApp hatları, Telegram, Meta ve E-Posta", routeHint: "Sistem Ayarları → Kanal Entegrasyonları" },
        description: "WhatsApp Cloud API (birden fazla 0850/GSM hattı, persona, 3 butonlu karşılama menüsü, mesai dışı yanıt), Telegram, Instagram, Facebook ve SMTP/IMAP bağlantıları.",
        fields: [
          { name: "Çoklu WhatsApp Hatları, Persona, Aktarım Kuyruğu & Mesai Saatleri", type: "Phone Number ID + Permanent Token + Verify Token", defaultVal: "Meta Graph v18.0", required: false, effect: "Her numara ayrı AI personası ve karşılama menüsüyle çalışır; cevapsız telefon çağrılarına otomatik WhatsApp mesajı atabilir." },
          { name: "Telegram, Instagram, Facebook & E-Posta (SMTP + 30 sn IMAP Poller)", type: "Bot/Page Token + IMAP/SMTP", defaultVal: "SSL/TLS", required: false, effect: "Tüm yazılı kanalları tek Ortak Gelen Kutusu'nda toplar." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 1.1: WhatsApp Hattı Ekle / Düzenle (Çoklu Numara, Phone Number ID, Persona & Kuyruk)",
        badge: "Kanallar → WhatsApp Hattı",
        screenshot: { src: "/screenshots/tabs/deep/channel-wa-account-modal.jpg", caption: "Kanal Entegrasyonları → Çoklu WhatsApp Hatları '+' Butonu: Hat adı, görünen numara, Meta Phone Number ID, özel token, AI personası ve aktarım kuyruğu", routeHint: "Sistem Ayarları → Kanal Entegrasyonları → WhatsApp → +" },
        description: "Aynı şirket (tenant) altında Satış Hattı, Destek Hattı veya Şube Hattı gibi birden fazla Meta WhatsApp Business numarasını ayrı AI personası ve kuyrukla bağlayan alt penceredir.",
        fields: [
          { name: "Hat Tanımı / Adı*, Görünecek Telefon Numarası & Phone Number ID*", type: "Örn. Satış Hattı + +90 850... + Meta ID", defaultVal: "Zorunlu", required: true, effect: "Webhook'tan gelen metadata.phone_number_id değerini bu hatla eşleştirir ve Ortak Gelen Kutusu'nda hat rozetini (recipient_info) gösterir." },
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
          { name: "Telegram Bot Token & Webhook Otomatik Kurulumu", type: "POST /api/webhooks/telegram", defaultVal: "HTTPS Webhook", required: false, effect: "Müşterilerin Telegram botunuza yazdığı mesajlar anında Ortak Gelen Kutusu'na düşer ve AI/Temsilci tarafından yanıtlanır." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Sekme 1.3: Instagram DM & Facebook Messenger (Meta Direct) Entegrasyonu",
        badge: "Kanallar → Instagram & FB",
        screenshot: { src: "/screenshots/tabs/toggled/channels-meta.jpg", caption: "Kanal Entegrasyonları → Instagram & FB sekmesi: Meta Sayfa Erişim Jetonu, Webhook Callback URL ve Verify Token", routeHint: "Sistem Ayarları → Kanal Entegrasyonları → Instagram & FB" },
        description: "Kurumsal Instagram DM ve Facebook Messenger mesajlarını Meta Graph API v18.0 üzerinden doğrudan Nornia Ortak Gelen Kutusu'na aktarır.",
        fields: [
          { name: "Page Access Token, Instagram Business ID & Meta Webhook URL/Verify Token", type: "/api/webhooks/meta", defaultVal: "Graph API v18.0", required: false, effect: "Sosyal medya DM'lerini 7/24 AI Asistanla karşılayıp satış/destek temsilcilerine devretmenizi sağlar." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Sekme 1.4: Kurumsal E-Posta Kanalı (SMTP Gönderim & 30 sn IMAP Gelen Kutusu Dinleyici)",
        badge: "Kanallar → E-Posta (SMTP/IMAP)",
        screenshot: { src: "/screenshots/tabs/toggled/channels-email.jpg", caption: "Kanal Entegrasyonları → E-Posta (SMTP/IMAP) sekmesi: Giden SMTP, Gelen IMAP sunucu ayarları ve otomatik e-posta yanıtlama", routeHint: "Sistem Ayarları → Kanal Entegrasyonları → E-Posta" },
        description: "info@ veya destek@ şirket e-posta kutularını 30 saniyelik arka plan IMAP dinleyicisi ile Ortak Gelen Kutusu'na bağlar ve SMTP üzerinden yanıt gönderir.",
        fields: [
          { name: "IMAP Sunucu/Port/SSL (Gelen), SMTP Sunucu/Port/TLS (Giden) & E-Posta Kimlik Bilgileri", type: "IMAP 993 + SMTP 587/465", defaultVal: "30 sn Otomatik Tarama", required: false, effect: "Okunmamış müşteri e-postalarını otomatik sohbet oturumuna çevirir; AI taslak/otomatik yanıt veya temsilci cevabı doğrudan müşteriye e-posta olarak iletilir." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2: Hazır CRM Entegrasyon Marketi (Zoho, HubSpot, Salesforce, Bitrix24)",
        badge: "Kanallar 2/6",
        screenshot: { src: "/screenshots/tabs/settings/26-hazir-crm.jpg", caption: "Sistem Ayarları → Hazır CRM Entegrasyonları — Tek tık CRM bağlayıcıları ve bağlantı testi", routeHint: "Sistem Ayarları → Hazır CRM Entegrasyonları" },
        description: "Popüler kurumsal CRM sistemleriyle kod yazmadan iki yönlü çağrı/kişi senkronizasyonu ve Screen Pop.",
        fields: [
          { name: "CRM Bağlayıcı, API Token, Otomatik CDR Kaydı & Canlı Test", type: "Zoho / HubSpot / Salesforce / Bitrix24", defaultVal: "Tek Tık Test", required: false, effect: "Çağrı anında CRM müşteri kartını açar ve görüşme sonunda ses kaydı bağlantısını CRM'e işler." }
        ]
      },
      {
        tabTitle: "Alt Ekran 3: Hızlı Cevaplar (Canned Responses)",
        badge: "Kanallar 3/6",
        screenshot: { src: "/screenshots/tabs/settings/27-hizli-cevaplar.jpg", caption: "Sistem Ayarları → Hızlı Cevaplar — Temsilciler için / kısayollu hazır mesaj şablonları", routeHint: "Sistem Ayarları → Hızlı Cevaplar" },
        description: "Ortak Gelen Kutusu'nda '/' kısayoluyla tek tıkla gönderilebilen standart kurumsal yanıt şablonları.",
        fields: [
          { name: "Kısa Kod (/iban, /adres), Kategori & Mesaj Metni", type: "Şablon Listesi", defaultVal: "Omnichannel", required: false, effect: "Temsilcilerin yazım hatası yapmadan saniyeler içinde standart yanıt göndermesini sağlar." }
        ]
      },
      {
        tabTitle: "Alt Ekran 4: Evrensel API Sihirbazı (AI İçin Harici ERP/CRM Araçları)",
        badge: "Kanallar 4/6",
        screenshot: { src: "/screenshots/tabs/settings/28-evrensel-api.jpg", caption: "Sistem Ayarları → Evrensel API Sihirbazı — Yapay zekanın çağrı sırasında sorgulayacağı REST araçları", routeHint: "Sistem Ayarları → Evrensel API Sihirbazı" },
        description: "Kendi şirket ERP/kargo/randevu API'lerinizi kod yazmadan AI Sesli Asistana araç (tool) olarak tanıtmanızı sağlar.",
        fields: [
          { name: "Araç Adı, HTTP Metod/URL, Header/Auth, Parametreler & Canlı Test", type: "Async Tool Engine", defaultVal: "AI Asistanlı", required: false, effect: "AI konuşma sırasında sipariş numarasını alıp ERP'nize sorgu atar ve sonucu müşteriye doğal sesle okur." }
        ]
      },
      {
        tabTitle: "Alt Ekran 5: Kurumsal Dış API & Anahtar (Token) Yönetimi",
        badge: "Kanallar 5/6",
        screenshot: { src: "/screenshots/tabs/settings/29-dis-api.jpg", caption: "Sistem Ayarları → Kurumsal Dış API & Token Yönetimi — API anahtarları, Scope, IP Whitelist ve erişim logları", routeHint: "Sistem Ayarları → Kurumsal Dış API & Token Yönetimi" },
        description: "api.nornia.com.tr üzerinde belgelenen 117 uç nokta için SHA-256 güvenli anahtarlar, IP kısıtları ve canlı erişim günlüğü.",
        fields: [
          { name: "API Anahtarı, Scope Yetkileri, IP Whitelist, Rate Limit & Webhook URL", type: "aida_live_... + HMAC-SHA256", defaultVal: "120 istek/dk", required: false, effect: "Brute-force koruması (25 hata/dk) ve canlı erişim/hata günlüğü ile tam güvenlik sağlar." }
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
          { name: "Tarih/Saat, Entegrasyon/Anahtar, İşlem Türü (Metod), Çağrılan Endpoint, Kaynak IP & Durum", type: "HTTP 200 / 401 / 403 / 429", defaultVal: "Canlı Akış + Günlüğü Temizle", required: false, effect: "Entegrasyon geliştiricilerinin hangi endpoint'in hangi scope ile başarılı olduğunu veya reddedildiğini anında teşhis etmesini sağlar." }
        ]
      },
      {
        tabTitle: "Alt Ekran 6: E-Mail & WhatsApp Sistem Bildirimleri (10+ Kritik Olay Tetikleyicisi)",
        badge: "Kanallar 6/6",
        screenshot: { src: "/screenshots/tabs/settings/30-email-bildirim.jpg", caption: "Sistem Ayarları → E-Mail & WhatsApp Sistem Bildirimleri — SMTP ve 10+ olay tetikleyicisi", routeHint: "Sistem Ayarları → E-Mail Bildirimleri" },
        description: "Kritik sistem, güvenlik, lisans, kota ve kriz olaylarında yöneticilere anında E-Posta ve WhatsApp uyarısı gönderir.",
        fields: [
          { name: "SMTP Ayarları, Alıcı E-Postalar & Alıcı WhatsApp Numaraları", type: "Çift Kanal Uyarı", defaultVal: "Port 587/465", required: false, effect: "LLM kota, reboot, lisans bitişi, servis hatası, %90+ disk/CPU/RAM, Fail2Ban, küfür/kara liste, Dialer ve kriz acil aktarımında anında bildirim yollar." }
        ]
      }
    ]
  },
  "bakim-yedekleme-ve-kayit-saklama": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Tarih, Saat Dilimi, NTP & Sistem Varsayılan Dili",
        badge: "Bakım & Sistem 1/5",
        screenshot: { src: "/screenshots/tabs/settings/31-tarih-saat.jpg", caption: "Sistem Ayarları → Tarih, Saat & Bölge Ayarları — NTP senkronizasyonu, 24/12 saat ve dil seçimi", routeHint: "Sistem Ayarları → Tarih, Saat & Bölge Ayarları" },
        description: "CDR zaman damgaları ve mesai saatleri için kritik NTP saat senkronizasyonu ve arayüz bölge ayarları.",
        fields: [
          { name: "Saat Dilimi, NTP Sunucusu, Tarih/Saat Formatı & Sistem Dili", type: "Europe/Istanbul + NTP + 24/12 Saat + TR/EN", defaultVal: "Europe/Istanbul / 24 Saat / TR", required: true, effect: "Günlük 00:00 performans sıfırlaması ve tüm rapor zaman damgalarını belirler." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2: Sistem Yedekleme (Tam Santral Yedeği & Geri Yükleme)",
        badge: "Bakım & Sistem 2/5",
        screenshot: { src: "/screenshots/tabs/settings/32-sistem-yedekleme.jpg", caption: "Sistem Ayarları → Sistem Yedekleme — Tam PostgreSQL, ayar, Asterisk ve anons yedekleme", routeHint: "Sistem Ayarları → Sistem Yedekleme" },
        description: "Felaket kurtarma ve sunucu taşıma için tek tıkla tam yedek alma ve geri yükleme ekranı.",
        fields: [
          { name: "Tam Yedek Al (.tar.gz) & Dosyadan Geri Yükle", type: "DB + Ayarlar + Asterisk + Anonslar", defaultVal: "İndirilebilir", required: false, effect: "Yeni bir Nornia sunucusuna dakikalar içinde eksiksiz geçiş yapmanızı sağlar." }
        ]
      },
      {
        tabTitle: "Alt Ekran 3: Geri Yükleme Noktaları (Anlık Konfigürasyon Snapshot)",
        badge: "Bakım & Sistem 3/5",
        screenshot: { src: "/screenshots/tabs/settings/33-geri-yukleme.jpg", caption: "Sistem Ayarları → Geri Yükleme Noktası — Anlık konfigürasyon snapshot oluşturma ve geri dönme", routeHint: "Sistem Ayarları → Geri Yükleme Noktası" },
        description: "Büyük CallFlow, kural veya toplu değişiklik öncesinde saniyeler içinde alınabilen hafif geri dönüş noktaları.",
        fields: [
          { name: "Snapshot Oluştur, Karşılaştır & Tek Tıkla Geri Dön", type: "Hızlı Rollback", defaultVal: "Anlık", required: false, effect: "Veritabanı/ses kayıtlarını bozmadan sadece santral yapılandırmasını önceki çalışan haline döndürür." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 3.1: Yeni Geri Yükleme Noktası Oluştur (Hazır Başlık Çipleri & Anlık Tenant Snapshot)",
        badge: "Bakım → Snapshot Oluştur (+)",
        screenshot: { src: "/screenshots/tabs/deep/restore-point-create.jpg", caption: "Geri Yükleme Noktası → '+' Yeni Geri Yükleme Noktası Oluştur: Hazır operasyon başlıkları ve isteğe bağlı açıklama notu", routeHint: "Sistem Ayarları → Geri Yükleme Noktası → +" },
        description: "Kritik bir AI senaryosu, CallFlow, SIP Trunk veya rol yetkisi değişikliği yapmadan önce 1 saniyede adlandırılmış konfigürasyon fotoğrafı alan alt penceredir.",
        fields: [
          { name: "Geri Yükleme Noktası Başlığı* & 5 Hazır Başlık Çipi", type: "AI Senaryo / CallFlow / SIP Trunk / Kullanıcı-Rol / Stabil Konfigürasyon", defaultVal: "Zorunlu", required: true, effect: "Tek tıkla standart başlık doldurarak gelecekte hangi noktaya döneceğinizi kolayca hatırlamanızı sağlar." },
          { name: "Açıklama / Not (İsteğe Bağlı)", type: "Serbest Not", defaultVal: "Tenant Bazlı İzole", required: false, effect: "Yapılacak değişikliğin sebebini kaydeder; otomatik şişme koruması (örn. 30 gün / maks 20 kayıt) ile uyumlu çalışır." }
        ]
      },
      {
        tabTitle: "Alt Ekran 4: Kayıt & Saklama Sistemi (NAS / SMB / SFTP + Dinamik Kayıt + KVKK İmha)",
        badge: "Bakım & Sistem 4/5",
        screenshot: { src: "/screenshots/tabs/settings/34-kayit-saklama.jpg", caption: "Sistem Ayarları → Kayıt & Saklama Sistemi — Canlı disk alanı, NAS/SMB/SFTP aktarım ve otomatik silme", routeHint: "Sistem Ayarları → Kayıt & Saklama Sistemi" },
        description: "Ses kayıtlarının harici depolamaya otomatik aktarımı, anahtar kelime tetiklemeli dinamik kayıt ve KVKK saklama süresi politikaları.",
        fields: [
          { name: "Harici Depolama (NFS Mount / Windows SMB / SFTP) + Test + Şimdi Eşitle", type: "mount_path / smb / sftp", defaultVal: "Yerel Disk", required: false, effect: "Yerel SSD dolmadan tüm ses kayıtlarını şirket NAS veya dosya sunucusuna otomatik arşivler." },
          { name: "Dinamik Ses Kaydı, Disk/Zaman Bazlı İmha & Koruma Modu", type: "both/agent/caller + % Eşik / Gün / Ömür Boyu", defaultVal: "365 Gün", required: false, effect: "KVKK süresi dolan kayıtları ve eski güvenlik IP loglarını periyodik temizler." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Görünüm 4.1: Harici Depolama (NAS / SMB / SFTP) & Dinamik Ses Kaydı Aktif Görünümü",
        badge: "Kayıt & Saklama → NAS & Dinamik Açık",
        screenshot: { src: "/screenshots/tabs/toggled/storage-external-smb-expanded.jpg", caption: "Kayıt & Saklama Sistemi → Harici Depolama (NAS/SMB/SFTP) ve Dinamik Ses Kaydı (Kelime Tetiklemeli) aktif görünümü", routeHint: "Sistem Ayarları → Kayıt & Saklama Sistemi (Aktif)" },
        description: "Harici NAS/File Server aktarımı ve kelime tetiklemeli Dinamik Ses Kaydı anahtarları açıldığında görünen canlı çift disk kapasite paneli ve saklama modu seçenekleridir.",
        fields: [
          { name: "Canlı Çift Disk İzleme (Yerel SSD + Harici NAS/File Server) & 'Bekleyen Kayıtları Şimdi Aktar'", type: "Bağlı & Yazılabilir Durumu + Kalan Saat Tahmini", defaultVal: "Gerçek Zamanlı", required: false, effect: "Hem yerel SSD hem harici NAS doluluk oranını ve kalan tahmini kayıt saatini canlı gösterir." },
          { name: "Harici Kayıt Saklama Çalışma Modu (Taşı / Move vs. Çift Yedekli / Mirror)", type: "NFS Mount / Windows SMB / SFTP", defaultVal: "Taşı veya Mirror", required: false, effect: "'Taşı' yerel diski anında boşaltarak yalnızca NAS'ta saklar; 'Çift Yedekli' hem yerel sunucuda hem harici sunucuda kopya tutar." }
        ]
      },
      {
        tabTitle: "Alt Ekran 5: Sistem Versiyonu, Güncelleme Merkezi & Değişiklik Günlüğü",
        badge: "Bakım & Sistem 5/5",
        screenshot: { src: "/screenshots/tabs/settings/35-sistem-versiyonu.jpg", caption: "Sistem Ayarları → Sistem Versiyonu & Günlük — Yüklü sürüm, kopyala butonu ve tüm sürüm notları", routeHint: "Sistem Ayarları → Sistem Versiyonu & Günlük" },
        description: "Santraldeki güncel yazılım sürüm kodunu, yayın tarihini ve detaylı özellik günlüğünü görüntüler.",
        fields: [
          { name: "Versiyon Kodu Kopyala & Değişiklik Günlüğü (Changelog)", type: "GET /api/version", defaultVal: "v3.10.11", required: false, effect: "Destek ve güncelleme doğrulamaları için tek tıkla sürüm kodunu kopyalar." }
        ]
      }
    ]
  },
  "sistem-panosu-ve-saglik": {
    editFormSections: [
      {
        tabTitle: "Donanım Telemetri, Çekirdek Servisler & Ağ Kimliği",
        badge: "Canlı Sağlık",
        description: "CPU, RAM, SSD, Asterisk, PostgreSQL, AudioSocket 9092 ve Nornia Connect canlı sağlık göstergeleri.",
        fields: [
          { name: "CPU / RAM / Disk & Çekirdek Servisler", type: "5 sn yenileme", defaultVal: "Normal < %80", required: false, effect: "Herhangi bir serviste kesinti veya disk %85+ uyarısı olursa anında kırmızı alarm gösterir." }
        ]
      }
    ]
  },
  "olay-gunlukleri": {
    editFormSections: [
      {
        tabTitle: "Seviye/Kaynak Filtreleme, Gerçek IP Denetimi & CSV Dışa Aktarım",
        badge: "Audit Log",
        description: "Yönetici aksiyonlarını, giriş denemelerini ve entegrasyon hatalarını gerçek istemci IP'siyle takip eder.",
        fields: [
          { name: "INFO / WARNING / ERROR / SECURITY / AUDIT Filtresi", type: "X-Forwarded-For IP", defaultVal: "Kronolojik", required: false, effect: "Kimin hangi ayarı ne zaman ve hangi IP'den değiştirdiğini kesin olarak kanıtlar." }
        ]
      }
    ]
  },
  "sorun-inceleme-sip-debugger": {
    editFormSections: [
      {
        tabTitle: "Web sngrep Merdiven Diyagramı, .PCAP İndirme & Ping / Traceroute",
        badge: "VoIP Teşhis",
        description: "Tarayıcı içinden canlı SIP sinyalizasyonu yakalama, ham başlık inceleme ve Wireshark `.pcap` dışa aktarımı.",
        fields: [
          { name: "SipTrapper Canlı Yakalama (5060 / 5061 / 5160 / 8089)", type: "Ladder Diyagram + .PCAP", defaultVal: "Tek Tık İndir", required: false, effect: "Operatör destek ekibine iletmek üzere standart `.pcap` üretir ve Trunk'lara Ping/Traceroute atar." }
        ]
      }
    ]
  },
  "guvenlik-kalkani": {
    editFormSections: [
      {
        tabTitle: "Fail2Ban Engellenen IP'ler, Beyaz Liste (Whitelist) & Toll-Fraud Kalkanı",
        badge: "Siber Güvenlik",
        description: "SIP ve API brute-force engelleme, güvenilir IP beyaz listesi ve yetkisiz uluslararası arama kalkanı.",
        fields: [
          { name: "Engellenen IP Kaldırma, Whitelist & Saldırı Eşikleri", type: "IPv4 / CIDR + Anti-Scanner", defaultVal: "SIP 5 / API 25 hata", required: false, effect: "Ofis ve operatör IP'lerini korur, saldırgan botları (sipvicious vb.) otomatik bloklar." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 1: Manuel IP / Alt Ağ Engelle Modalı (Fail2Ban & UFW Firewall)",
        badge: "Güvenlik → Manuel IP Engelle",
        screenshot: { src: "/screenshots/tabs/deep/security-ban-modal.jpg", caption: "Güvenlik Kalkanı → '+' Manuel IP / Alt Ağ Engelle: Tekil IPv4 veya CIDR bloğunu anında UFW/Fail2Ban üzerinde bloklama", routeHint: "Güvenlik Kalkanı → Engellenen IP'ler → +" },
        description: "Şüpheli bir kaynak IP adresini veya tüm saldırgan alt ağı (`/24`) otomatik eşiği beklemeden anında Linux güvenlik duvarından (UFW + Fail2Ban) engelleyen alt penceredir.",
        fields: [
          { name: "IP Adresi veya CIDR Bloğu & Engelleme Sebebi / Açıklama", type: "Örn. 31.70.90.134 veya 31.70.90.0/24", defaultVal: "SIP Tarayıcı / Yetkisiz Erişim", required: true, effect: "'Firewall'da Engelle' tıklandığında ilgili IP/blok tüm SIP (5060/5061) ve web portlarına anında kapatılır." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 2: Güvenli IP / IP Bloğu (Fail2Ban IgnoreIP & UFW Allow) Ekle / Düzenle Modalı",
        badge: "Güvenlik → Güvenli IP Ekle",
        screenshot: { src: "/screenshots/tabs/deep/security-whitelist-modal.jpg", caption: "Güvenlik Kalkanı → Güvenli IP / Blok Listesi → '+' Güvenli IP (IgnoreIP) Ekle penceresi", routeHint: "Güvenlik Kalkanı → Güvenli IP / Blok Listesi → +" },
        description: "Şirket merkez ofisi, şube sabit IP'leri, SIP operatör SBC'leri ve ERP sunucularını Fail2Ban yanlış engellemesine karşı kalıcı olarak koruma altına alan alt penceredir.",
        fields: [
          { name: "Güvenli IP Adresi veya CIDR Bloğu & Açıklama", type: "IPv4 / CIDR + Not (Örn. Merkez Ofis Statik IP / Operatör SBC)", defaultVal: "ignoreip + UFW Allow", required: true, effect: "Fail2Ban jail yapılandırmasındaki ignoreip listesine ve UFW izin kurallarına işlenerek yanlış şifre denemelerinde dahi ofisinizin kilitlenmesini %100 önler." }
        ]
      },
      {
        level: 3,
        tabTitle: "Sekme 2: Güvenli IP / Blok Listesi (Fail2Ban IgnoreIP & UFW Allow Tablosu)",
        badge: "Güvenlik Kalkanı 2/4",
        screenshot: { src: "/screenshots/tabs/toggled/security-tab-whitelist.jpg", caption: "Güvenlik Kalkanı → Sekme 2: Güvenli IP / Blok Listesi (Fail2Ban ignoreip & UFW Allow) yönetim tablosu", routeHint: "Güvenlik Kalkanı → Güvenli IP / Blok Listesi" },
        description: "Tüm beyaz listeye alınmış ofis, şube ve SIP operatör IP bloklarını arama, düzenleme ve tek tıkla yönetici bağlantı IP'sini güvenli listeye ekleme ekranıdır.",
        fields: [
          { name: "Güvenli IP Arama, Düzenleme, Silme & 'Mevcut Yönetici IP'mi Ekle'", type: "IPv4 / CIDR Tablosu", defaultVal: "Fail2Ban + UFW Senkron", required: false, effect: "Listelenen her IP veya CIDR bloğu tüm güvenlik engellemelerinden muaf tutulur." }
        ]
      },
      {
        level: 3,
        tabTitle: "Sekme 3: Bölgesel Erişim (GeoIP — Ülke Bazlı SIP & Web Güvenlik Duvarı)",
        badge: "Güvenlik Kalkanı 3/4",
        screenshot: { src: "/screenshots/tabs/toggled/security-tab-geoip.jpg", caption: "Güvenlik Kalkanı → Sekme 3: Bölgesel Erişim (GeoIP) — İzin verilen ülkeler ve yabancı ülke SIP/Web engelleme", routeHint: "Güvenlik Kalkanı → Bölgesel Erişim (GeoIP)" },
        description: "Yalnızca hizmet verdiğiniz ülkelerden (örn. sadece Türkiye `TR` veya TR+DE+GB) gelen SIP kayıt ve web bağlantılarına izin vererek yurt dışı kaynaklı otomatik tarama saldırılarını %99 oranında keser.",
        fields: [
          { name: "GeoIP Kalkanı Aktifliği & İzin Verilen Ülkeler Listesi", type: "ISO Ülke Kodları (TR, DE, US, GB...)", defaultVal: "TR", required: false, effect: "Seçili ülkeler dışındaki IP'lerden gelen SIP REGISTER/INVITE saldırıları daha Asterisk'e ulaşmadan reddedilir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Sekme 4: Anti-DDoS / Hız & Çağrı Sınırlandırması (Toll-Fraud & Brute-Force Eşikleri)",
        badge: "Güvenlik Kalkanı 4/4",
        screenshot: { src: "/screenshots/tabs/toggled/security-tab-antiddos.jpg", caption: "Güvenlik Kalkanı → Sekme 4: Anti-DDoS / Hız & Çağrı Sınırlandırması — Eşzamanlı dış arama limiti, SIP/API hız eşikleri ve otomatik karantina", routeHint: "Güvenlik Kalkanı → Anti-DDoS / Hız & Çağrı Sınırlandırması" },
        description: "Sistem genelindeki SIP paket hız limitlerini, abone başı varsayılan eşzamanlı dış arama sınırını ve otomatik Toll-Fraud karantina kurallarını yapılandırır.",
        fields: [
          { name: "SIP Hız Limiti (paket/sn), Hatalı Deneme Eşiği (Fail2Ban) & Varsayılan Eşzamanlı Dış Arama Limiti", type: "Anti-DDoS + Toll-Fraud Kalkanı", defaultVal: "5 Hata / 2 Eşzamanlı", required: false, effect: "Ele geçirilen bir dahili hesabın gece saatlerinde yurt dışı pahalı numaralara yüzlerce eşzamanlı arama açarak fatura şişirmesini anında karantinaya alarak durdurur." }
        ]
      }
    ]
  }
};
