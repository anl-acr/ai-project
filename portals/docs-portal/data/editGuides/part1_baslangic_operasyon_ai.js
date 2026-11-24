export const EDIT_GUIDES_PART1 = {
  "ilk-kurulum-sihirbazi": {
    editFormSections: [
      {
        tabTitle: "Adım 1: Ağ & NAT Ayarları (Netplan + PJSIP Dinamik NAT)",
        badge: "Kurulum Adımı 1/6",
        description: "Sunucunun kalıcı yerel LAN IP adresini, varsayılan ağ geçidini, DNS sunucularını ve NAT arkasındaki dış IP davranışını tanımlar. Girilen yeni statik IP sihirbaz sırasında bağlantıyı koparmamak için Adım 6 tamamlandıktan 2 saniye sonra canlı uygulanır.",
        fields: [
          { name: "Algılanan Ağ Arayüzleri (NIC)", type: "Salt Okunur Bilgi", defaultVal: "enp0s3 / eth0", required: false, effect: "Sunucuda fiziksel/sanal olarak algılanan aktif ağ kartını ve o anki DHCP IPv4/CIDR adresini gösterir." },
          { name: "Santral Yerel LAN IP Adresi (CIDR)", type: "IPv4/Mask", defaultVal: "Mevcut IP /24", required: true, effect: "Örn. 192.168.1.25/24. /etc/netplan/99-nornia-static.yaml dosyasına yazılır; çakışan 00-installer-config.yaml otomatik etkisizleştirilir." },
          { name: "Varsayılan Ağ Geçidi (Gateway)", type: "IPv4", defaultVal: "192.168.1.1", required: true, effect: "İnternet, SIP operatör ve Nornia Connect Hub çıkışı için yönlendirici IP adresi." },
          { name: "Birincil & İkincil DNS Sunucusu", type: "IPv4", defaultVal: "8.8.8.8 / 1.1.1.1", required: true, effect: "connect.nornia.com.tr, operatör SIP alan adları ve SSL çözümlemesi için kullanılır." },
          { name: "PJSIP Dinamik NAT & Dış IP (External IP)", type: "Toggle + IPv4", defaultVal: "Aktif", required: false, effect: "Açıkken tüm PJSIP transport'larına external_signaling_address ve external_media_address enjekte eder; tek yönlü ses ve 32 sn kopma sorununu önler." },
          { name: "Yerel Ağ Aralıkları (Local Nets)", type: "CIDR Listesi", defaultVal: "192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12", required: false, effect: "İç ağ ve VPN bloklarında Asterisk'in NAT çevirisi yapmadan doğrudan yerel IP ile haberleşmesini sağlar." }
        ]
      },
      {
        tabTitle: "Adım 2: Lisans Anahtarı & Donanım Kilidi (HW-ID) Doğrulaması",
        badge: "Kurulum Adımı 2/6",
        description: "Anakart UUID, /etc/machine-id ve NIC MAC parmak izinden üretilen donanım kimliğini gösterir; imzalı AIDA-... lisans anahtarının kotalarını çözümler.",
        fields: [
          { name: "Sunucu Donanım Kimliği (HW-ID)", type: "HW-XXXX-XXXX", defaultVal: "Otomatik Üretilir", required: true, effect: "Merkez Lisans Paneli'nden bu donanım için üretilmiş anahtarı doğrulayan benzersiz parmak izi." },
          { name: "Lisans Anahtarı (AIDA-...[.BASE64])", type: "HMAC-SHA256 Token", defaultVal: "Boş", required: true, effect: "Nokta (.) sonrasındaki Base64 kota paketi büyük/küçük harf korunarak çözülür; bitiş tarihi, firma adı, kullanıcı/kanal/AI kotaları anında önizlenir." }
        ]
      },
      {
        tabTitle: "Adım 3: Nornia Connect Alt Alan Adı (Subdomain) & Hub Tescili",
        badge: "Kurulum Adımı 3/6",
        description: "Port yönlendirme açmadan HTTPS, WebRTC WSS ve WireGuard SIP Edge erişimi sağlayan <alt-alan>.nornia.com.tr adresini sorgular ve tescil eder.",
        fields: [
          { name: "Nornia Alt Alan Adı (Subdomain)", type: "Küçük harf / rakam", defaultVal: "Boş", required: true, effect: "'Kontrol Et' butonu Merkez Hub'a canlı HTTPS sorgusu atar. Başka santralde kilitliyse veya rezerveyse 'İleri' butonu kilitlenir." },
          { name: "Nornia Hub Adresi & Bağlantı Anahtarı", type: "HTTPS URL + Opsiyonel Token", defaultVal: "https://connect.nornia.com.tr", required: false, effect: "Anahtar boş bırakılırsa Adım 2'deki lisans anahtarı otomatik kullanılır." }
        ]
      },
      {
        tabTitle: "Adım 4–6: Numara Planı, Yönetici Hesabı & Kurulumu Tamamla",
        badge: "Kurulum Adımı 4–6/6",
        description: "Firma kimliği, 4 haneli dahili planı ve süper yönetici hesabı oluşturularak kurulum sonlandırılır.",
        fields: [
          { name: "Firma Adı & Dahili Basamak Planı", type: "Metin + 3/4 Hane", defaultVal: "4 Hane (1000–1999)", required: true, effect: "Dahili (1000+), Kuyruk (2000+), Konferans (3000+) ve IVR (5000+) bloklarını başlatır." },
          { name: "Yönetici E-Posta & Güçlü Parola", type: "Email + Şifre", defaultVal: "Zorunlu", required: true, effect: "Eski demo kullanıcıları (200/201) temizlenir, yönetici oluşturulur ve yeni sekmede https://<alt-alan>.nornia.com.tr açılır." }
        ]
      }
    ]
  },
  "masaustu-mobil-ve-webphone": {
    editFormSections: [
      {
        tabTitle: "WebPhone Ses Cihazları, Çift Hoparlör (Zil + Kulaklık) & SIP.js Kaydı",
        badge: "Web Telefon",
        screenshot: { src: "/screenshots/tabs/call-panel/02-webphone.jpg", caption: "Dahili WebPhone — Tuş takımı, ses cihazı seçici, aktif görüşme ve hızlı aktarım kontrolleri", routeHint: "Temsilci Çağrı Paneli → Web Telefon" },
        description: "Tarayıcı içi şifreli WebRTC telefonun mikrofon, konuşma kulaklığı ve harici zil hoparlörü ayarları.",
        fields: [
          { name: "Mikrofon & Konuşma Hoparlörü", type: "Tarayıcı MediaDevice", defaultVal: "Sistem Varsayılanı", required: true, effect: "USB/Bluetooth kulaklığı seçer; kullanıcı ayarındaki AI Mikrofon Gürültü Engelleme ofis uğultusunu keser." },
          { name: "İkincil Zil Sesi Hoparlörü (Secondary Ringer)", type: "Audio Output", defaultVal: "PC Hoparlörü", required: false, effect: "Kulaklık masadayken gelen çağrı zilini bilgisayar hoparlöründen de çalar." },
          { name: "Call Flip (*11) & Hot-Desking (*75 / *76)", type: "Özellik Kodları", defaultVal: "*11 / *75 / *76", required: false, effect: "*11 ile aktif görüşmeyi cihazlar arası kesintisiz taşır; *75/*76 ile paylaşımlı masa telefonuna PIN ile oturum açar/kapatırsınız." }
        ]
      }
    ]
  },
  "kisisel-profil-ve-ust-cubuk": {
    editFormSections: [
      {
        tabTitle: "Üst Çubuk: Global Arama & Sesli Komut Paleti (Ctrl+K / ⌘K)",
        badge: "Üst Bar • Ctrl+K",
        screenshot: { src: "/screenshots/tabs/profile/12-global-arama-ctrl-k.jpg", caption: "Üst Çubuk → Global Arama (Ctrl+K / ⌘K) ve Sesli Komut Paleti — Menü, ayar, kullanıcı, dahili ve rapor araması", routeHint: "Üst Bar → Arama Kutusu (Ctrl+K)" },
        description: "Nornia'nın herhangi bir ekranında tek kısayolla tüm modüllere, ayar alt sekmelerine, 44 rapora ve kullanıcı dahililerine anında ulaşmanızı sağlar.",
        fields: [
          { name: "Anlık Arama Kutusu (Ctrl+K) & Mikrofon Sesli Komut", type: "Klavye + Sesli Dikte", defaultVal: "Her Ekranda Aktif", required: false, effect: "Örn. '1001', 'MOS', 'NAT' veya 'WhatsApp' yazıldığında ilgili kullanıcı, rapor veya ayar ekranını doğrudan açar." },
          { name: "Dil Seçici (TR/EN), Bildirim Zili, Karanlık Mod & Sistem Bilgisi", type: "Üst Bar Sağ Araçları", defaultVal: "TR / Canlı", required: false, effect: "Anlık sistem/kriz bildirimlerini açar, karanlık/aydınlık temayı değiştirir ve yüklü sürüm bilgisini gösterir." }
        ]
      },
      {
        tabTitle: "Sağ Üst Avatar Menüsü (Hızlı Profil Seçici, Uygulamalar & Güvenli Çıkış)",
        badge: "Avatar Menüsü",
        screenshot: { src: "/screenshots/tabs/profile/00-avatar-dropdown.jpg", caption: "Sağ üst Avatar Menüsü — Müsait / Dışarıda / Toplantı / Diğer hızlı profil seçimi ve Profil Ayarları erişimi", routeHint: "Sağ Üst Avatar → Açılır Menü" },
        description: "Temsilcilerin günlük iş akışında en sık kullandığı durum/profil geçişini ve kişisel ayar penceresini tek tıkla sunar.",
        fields: [
          { name: "Aktif Profil Seçimi (Müsait / Dışarıda / Toplantı / Diğer) & 'Profilleri Özelleştir'", type: "4 Hızlı Profil Butonu", defaultVal: "Müsait", required: false, effect: "Seçilen profile ait çalacak cihazları ve yönlendirme kurallarını (örn. Toplantı → Sekreter/Voicemail) anında aktif eder." },
          { name: "Profil Ayarları / Uygulamalar & İndir / Çıkış Yap", type: "Kişisel Aksiyonlar", defaultVal: "11 Sekme", required: false, effect: "Profil Ayarları 11 sekmeli kişisel yapılandırma penceresini açar; Çıkış Yap hem oturumu hem WebRTC kaydını temizler." }
        ]
      },
      {
        level: 3,
        tabTitle: "Profil Sekmesi 1/11: Avatar & Tema (42 Hazır Avatar, Özel Fotoğraf, Arayüz Şablonu & Tema)",
        badge: "Profil Ayarları 1/11",
        screenshot: { src: "/screenshots/tabs/profile/01-avatar-tema.jpg", caption: "Temsilci Profil Ayarları → Sekme 1: Avatar Koleksiyonu, Özel Fotoğraf Yükleme, Renk Teması ve Arayüz Şablonu", routeHint: "Avatar → Profil Ayarları → Avatar & Tema" },
        description: "Kullanıcının kendi profil avatarını, panel renk temasını, arayüz görünüm şablonunu (Aurora Glass vb.) ve otomatik karanlık mod saatlerini seçtiği sekmedir.",
        fields: [
          { name: "Bilgisayardan Avatar Yükle & 42 Hazır Avatar Koleksiyonu", type: "Sinema / Klasik / Robotik + Özel Görsel", defaultVal: "Çevrimdışı SVG", required: false, effect: "Wallboard, ekip listesi ve sohbet ekranlarında temsilcinin görünen profil simgesini belirler." },
          { name: "Arayüz Görünüm Şablonu, Renk Paleti & Karanlık/Aydınlık Saat Zamanlayıcısı", type: "Kişisel Tema", defaultVal: "Otomatik Kayıt", required: false, effect: "Diğer kullanıcıları etkilemeden yalnızca kendi ekranınızın görsel stilini ve gece tema geçiş saatini özelleştirir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Profil Sekmesi 2/11: Başlangıç Ekranı (Girişte Açılacak Ekran & Akıllı Başlangıç Modları)",
        badge: "Profil Ayarları 2/11",
        screenshot: { src: "/screenshots/tabs/profile/02-baslangic-ekrani.jpg", caption: "Temsilci Profil Ayarları → Sekme 2: Girişte Açılacak Başlangıç Ekranı, 'Açık Ekranı Seç' ve Çağrı Paneli Açılış Sekmesi", routeHint: "Avatar → Profil Ayarları → Başlangıç Ekranı" },
        description: "Kullanıcının oturum açtığında doğrudan hangi ekran ve hangi alt sekmeyle başlamak istediğini belirlediği sekmedir.",
        fields: [
          { name: "Akıllı Başlangıç Modları & 'Açık Ekranı Seç' / 'Varsayılana Sıfırla'", type: "Role Göre Otomatik / Son Kaldığım Ekrandan Devam Et", defaultVal: "Varsayılan", required: false, effect: "Oturum açıldığında her seferinde aranan ekrana tıklamak yerine doğrudan belirlenen modüle veya son kalınan sayfaya düşer." },
          { name: "Temsilci Çağrı Paneli Açılış Alt Sekmesi & İzinli Ekran Arama", type: "Pano / Web Telefon / Temsilciler / Sohbet / Masa Telefonum...", defaultVal: "Sıralamadaki İlk Sekme", required: false, effect: "Rol yetkinizin izin verdiği tüm ekran ve raporlar içinde arama yaparak sabit başlangıç sayfası belirlemenizi sağlar." }
        ]
      },
      {
        level: 3,
        tabTitle: "Profil Sekmesi 3/11: Profiller & Yönlendirme (Kişisel *70 Profilleri, Cihaz Seçimi & 3-Seviye Yönlendirme)",
        badge: "Profil Ayarları 3/11",
        screenshot: { src: "/screenshots/tabs/profile/03-profiller-yonlendirme.jpg", caption: "Temsilci Profil Ayarları → Sekme 3: Kişisel Profiller (Müsait / Dışarıda / Toplantı / Diğer), Çalma Süresi ve Çağrı Yönlendirme", routeHint: "Avatar → Profil Ayarları → Profiller & Yönlendirme" },
        description: "Temsilcinin yöneticiye gerek kalmadan kendi Müsait, Dışarıda, Toplantı ve Diğer profillerinin hangi cihazları çaldıracağını ve çağrıları nereye yönlendireceğini yönettiği sekmedir.",
        fields: [
          { name: "Profil Bazlı Cihaz Seçimi (Masa Telefonu / Web / PC / Mobil) & Çalma Süresi (15s–45s)", type: "4 Cihaz + Saniye + *70*X Kodu", defaultVal: "30 sn", required: false, effect: "Örn. 'Dışarıda' profilinde sadece Mobil çalarken açılmazsa 15 saniye sonra cep telefonuna veya asistana yönlendirme yapılabilir." },
          { name: "Her Zaman / Meşgul Durumda / Zaman Aşımında (Cevapsız) Yönlendirme & GSM", type: "Dahili / Kuyruk / Dış Numara / Sesli Posta", defaultVal: "Anında Asterisk Sync", required: false, effect: "Kaydedildiğinde Asterisk yönlendirme çözücüsü anında yeni kurala göre çalışır." }
        ]
      },
      {
        level: 3,
        tabTitle: "Profil Sekmesi 4/11: Donanım (Hızlı Ses Testi, Zil Melodisi, AI RNNoise Gürültü Engelleme & Çift Hoparlör)",
        badge: "Profil Ayarları 4/11",
        screenshot: { src: "/screenshots/tabs/profile/04-donanim.jpg", caption: "Temsilci Profil Ayarları → Sekme 4: Hızlı Ses Testi, Çağrı Zil Sesi, AI RNNoise Gürültü Engelleme ve Ses Çıkış Aygıtları", routeHint: "Avatar → Profil Ayarları → Donanım" },
        description: "WebPhone görüşmeleri öncesi mikrofon, kulaklık, ikincil zil hoparlörü ve Yapay Zeka (RNNoise) gürültü engelleme seviyesini test edip kaydettiğiniz sekmedir.",
        fields: [
          { name: "Ses Cihazı Hızlı Testi & 'Aygıtları Tara'", type: "Canlı Mikrofon + Hoparlör VU Metre", defaultVal: "Tek Tık Doğrulama", required: false, effect: "Vardiyaya başlamadan önce USB/Bluetooth kulaklığın ve mikrofonun çalıştığını canlı seviye çubuğuyla doğrular." },
          { name: "Çağrı Zil Sesi + 'Dinle' & İkincil Zil Hoparlörü", type: "Klasik / Modern Melodiler + İkinci Hoparlör", defaultVal: "Klasik Telefon Melodisi", required: false, effect: "Kulaklık kafanızda değilken gelen çağrı zilini bilgisayarın harici hoparlöründen de duyurur." },
          { name: "Yapay Zeka (AI) Gürültü Engelleme + 'Mikrofonu Test Et (Kendini Dinle)'", type: "Yapay Zeka (RNNoise + Yan Ses Kesici) / Standart / Kapalı", defaultVal: "Yapay Zeka (AI)", required: false, effect: "Kalabalık çağrı merkezinde yan masadaki konuşmaları, klavye seslerini ve klima uğultusunu müşteriye gitmeden temizler." }
        ]
      },
      {
        level: 3,
        tabTitle: "Profil Sekmesi 5/11: Klavye Kısayolları (Çağrı Cevapla, Sessize Al, Transfer & Müşteri 360° Kısayolları)",
        badge: "Profil Ayarları 5/11",
        screenshot: { src: "/screenshots/tabs/profile/05-klavye-kisayollari.jpg", caption: "Temsilci Profil Ayarları → Sekme 5: Kişiselleştirilebilir Klavye Kısayolları Tablosu", routeHint: "Avatar → Profil Ayarları → Klavye Kısayolları" },
        description: "Yoğun çağrı trafiğinde fareye dokunmadan çağrı cevaplama, kapatma, bekletme, transfer ve Müşteri 360° (`Alt+C`) açma tuş kombinasyonlarını kişiselleştirir.",
        fields: [
          { name: "Kısayol Atama & Varsayılana Sıfırla", type: "Alt/Ctrl/Shift + Tuş Kombinasyonu", defaultVal: "Özelleştirilebilir", required: false, effect: "Her temsilci kendi el alışkanlığına göre kısayol tuşlarını tanımlayabilir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Profil Sekmesi 6/11: Ortak Masa Telefonu (Kişisel Hot-Desking *75 / *76 PIN & Aktif Oturum)",
        badge: "Profil Ayarları 6/11",
        screenshot: { src: "/screenshots/tabs/profile/06-ortak-masa-telefonu.jpg", caption: "Temsilci Profil Ayarları → Sekme 6: Kişisel Ortak Masa Telefonu (Hot-Desking *75 / *76) PIN ve Oturum Yönetimi", routeHint: "Avatar → Profil Ayarları → Ortak Masa Telefonu" },
        description: "Vardiyalı ofislerde temsilcinin kendi Hot-Desking PIN şifresini yönetmesini ve hangi paylaşımlı masa telefonunda oturumunun açık olduğunu görüp uzaktan kapatmasını sağlar.",
        fields: [
          { name: "Hot-Desking PIN, *75*Dahili*PIN Giriş & *76 / Tek Tık Uzaktan Çıkış", type: "4–6 Hane PIN + Aktif Masa Durumu", defaultVal: "Gece 00:00 Oto Çıkış", required: false, effect: "Masadan ayrılırken *76 tuşlamayı unutan temsilci kendi profilinden masadaki oturumunu tek tıkla kapatabilir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Profil Sekmesi 7/11: Güvenlik (Parola Değiştirme, Kişisel 2FA Kurulumu & Güvenilen Cihazlar)",
        badge: "Profil Ayarları 7/11",
        screenshot: { src: "/screenshots/tabs/profile/07-guvenlik.jpg", caption: "Temsilci Profil Ayarları → Sekme 7: Kişisel Şifre Değiştirme, 2FA Eşleştirme ve Aktif Güvenilen Cihazlar", routeHint: "Avatar → Profil Ayarları → Güvenlik" },
        description: "Kullanıcının kendi giriş şifresini değiştirdiği, Google/Microsoft Authenticator 2FA QR eşleştirmesini yaptığı ve güvenilen tarayıcı cihazlarını yönettiği sekmedir.",
        fields: [
          { name: "Mevcut / Yeni Parola, Kişisel 2FA QR Eşleştirme & Güvenilen Cihazları İptal Et", type: "Self-Servis Güvenlik", defaultVal: "Audit Loglu", required: false, effect: "Kayıp/ortak bilgisayardaki oturum ve güvenilen cihaz kayıtları tek tıkla iptal edilir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Profil Sekmesi 8/11: Uygulamalar & İndir (RUNA PC/Mac & Mobil İndirme + QR Sihirli Giriş)",
        badge: "Profil Ayarları 8/11",
        screenshot: { src: "/screenshots/tabs/profile/08-uygulamalar-indir.jpg", caption: "Temsilci Profil Ayarları → Sekme 8: RUNA Masaüstü & Mobil Uygulama İndirme, Magic Link ve QR Kod İle Eşleştirme", routeHint: "Avatar → Profil Ayarları → Uygulamalar & İndir" },
        description: "Temsilcilerin Windows/macOS masaüstü ve iOS/Android mobil uygulamalarını indirip şifre ya da sunucu adresi yazmadan QR kodla anında giriş yapmalarını sağlar.",
        fields: [
          { name: "Windows (.exe) / macOS (.dmg) / iOS & Android Kurulum + QR / Sihirli Bağlantı", type: "Tek Kullanımlık Güvenli Token", defaultVal: "Otomatik Sunucu & SIP Ayarı", required: false, effect: "QR okutulduğunda FQDN, oturum ve SIP/WebRTC bilgileri mobil uygulamaya eksiksiz aktarılır." }
        ]
      },
      {
        level: 3,
        tabTitle: "Profil Sekmesi 9/11: Çağrı Paneli (Sekme Sırası, İkon+Başlık / Sadece İkon & Tam Ekran Tercihi)",
        badge: "Profil Ayarları 9/11",
        screenshot: { src: "/screenshots/tabs/profile/09-cagri-paneli.jpg", caption: "Temsilci Profil Ayarları → Sekme 9: Temsilci Çağrı Paneli Sekme Görünüm Stili, Sıralama ve Çalışma Alanı Tercihleri", routeHint: "Avatar → Profil Ayarları → Çağrı Paneli" },
        description: "Temsilci Çağrı Paneli'ndeki 10 sekmenin görünüm stilini, sıralamasını ve gelen çağrı pop-up davranışlarını özelleştirir.",
        fields: [
          { name: "Sekme Görünüm Stili (İkon+Başlık / Sadece İkon), Sekme Sıralaması & Otomatik Odaklama", type: "Kişisel Arayüz Tercihi", defaultVal: "İkon + Başlık", required: false, effect: "Çağrı geldiğinde otomatik Web Telefon sekmesine geçme ve küçük ekranlarda kompakt ikon çubuğu kullanma seçenekleri sunar." }
        ]
      },
      {
        level: 3,
        tabTitle: "Profil Sekmesi 10/11: Üst Bar Özelleştirme (Topbar Bileşen Görünürlüğü & Hizalama)",
        badge: "Profil Ayarları 10/11",
        screenshot: { src: "/screenshots/tabs/profile/10-ust-bar.jpg", caption: "Temsilci Profil Ayarları → Sekme 10: Üst Bar (Topbar) Modül Görünürlüğü, Hızlı Kısayollar ve Düzen Ayarları", routeHint: "Avatar → Profil Ayarları → Üst Bar Özelleştirme" },
        description: "Üst çubukta hangi araçların (Global Arama, Bildirim Zili, Karanlık Mod, Dil Seçici, Hızlı Çağrı vb.) görüneceğini ve yerleşimini özelleştirir.",
        fields: [
          { name: "Üst Bar Bileşen Anahtarları & Sıralama", type: "Açık/Kapalı + Konum", defaultVal: "Kişisel Kayıt", required: false, effect: "Sade bir çalışma ekranı isteyen temsilciler kullanmadıkları üst bar öğelerini gizleyebilir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Profil Sekmesi 11/11: Canlı İzleme Paneli (Kişisel Wallboard Tercihleri)",
        badge: "Profil Ayarları 11/11",
        screenshot: { src: "/screenshots/tabs/profile/11-canli-izleme.jpg", caption: "Temsilci Profil Ayarları → Sekme 11: Kişisel Canlı İzleme Paneli (Wallboard) Görünüm ve Yenileme Tercihleri", routeHint: "Avatar → Profil Ayarları → Canlı İzleme Paneli" },
        description: "Kullanıcının Canlı İzleme Paneli (Wallboard) ekranındaki kart yoğunluğu, sesli bekleme uyarısı ve varsayılan kuyruk filtresini yönetir.",
        fields: [
          { name: "Wallboard Kart Yoğunluğu, Sesli Uyarı & Varsayılan Kuyruk Görünümü", type: "Kişisel Wallboard Ayarı", defaultVal: "Otomatik", required: false, effect: "Süpervizörlerin ve TV ekranlarının kendilerine özel sadeleştirilmiş canlı izleme düzeniyle açılmasını sağlar." }
        ]
      }
    ]
  },
  "gercek-zamanli-ai-pano": {
    editFormSections: [
      {
        tabTitle: "AI Pano Kartları, Canlı Trafik Grafikleri & Kriz Alarm Şeridi",
        badge: "Yönetici Kokpiti",
        description: "Günlük çağrı sayaçları (00:00 UTC+3 sıfırlamalı), AI otomasyon oranı, canlı duygu dağılımı ve son görüşme özetleri.",
        fields: [
          { name: "Günlük KPI Kartları", type: "Toplam / Cevaplanan / Kaçan / AI Çözüm", defaultVal: "Bugün 00:00", required: false, effect: "Her gece Türkiye saati 00:00'da otomatik sıfırlanır; tıklanınca ilgili CDR filtresini açar." },
          { name: "Canlı Duygu & Kriz Radarı", type: "Pozitif / Nötr / Negatif", defaultVal: "Gerçek Zamanlı", required: false, effect: "Devam eden çağrıda yüksek öfke tespit edilirse süpervizöre canlı kırmızı alarm çıkarır." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere: Kişisel Özet Ekranı Düzeni (Panoyu Özelleştir Modalı)",
        badge: "AI Pano → Özelleştir",
        screenshot: { src: "/screenshots/tabs/deep/live-dashboard-customize.jpg", caption: "Gerçek Zamanlı AI Pano → Panoyu Özelleştir: 4 pano bileşeninin görünürlük ve sıralama kontrolü", routeHint: "Gerçek Zamanlı AI Pano → Panoyu Özelleştir" },
        description: "Sağ üstteki 'Panoyu Özelleştir (4/4)' butonuna tıklandığında açılan ve her yöneticinin kendi kokpit düzenini kaydetmesini sağlayan alt penceredir.",
        fields: [
          { name: "Canlı Kriz & Negatif Duygu Alarm Radarı", type: "Açık/Kapalı + Yukarı/Aşağı Sıra", defaultVal: "Açık (#1)", required: false, effect: "Aktif çağrılarda gerginlik veya şikayet algılandığında tek tıkla dinleme/sufle/devralma kartını en üstte tutar." },
          { name: "Canlı AI Operasyon & Çözüm Kartları", type: "Açık/Kapalı + Sıra", defaultVal: "Açık (#2)", required: false, effect: "Aktif AI görüşmeleri, otonom çözüm oranı, canlı duygu dengesi ve temsilciye devir metriklerini gösterir." },
          { name: "Canlı Arama Listesi & Gerçek Zamanlı AI Konsolu", type: "Açık/Kapalı + Sıra", defaultVal: "Açık (#3)", required: false, effect: "Aktif aramalar, canlı akan konuşma dökümü (STT), AI sufle kutusu ve temsilci notlarını yan yana sunar." },
          { name: "AI Maliyet Özeti, Konu Dağılımı & En Çok Arayanlar + 'Sıfırla'", type: "Açık/Kapalı + Varsayılana Dön", defaultVal: "Açık (#4)", required: false, effect: "Yapay zeka sağlayıcı kredi tüketimini, gün içi konu dağılımını ve en yoğun arayanları listeler; 'Sıfırla' fabrika düzenine döner." }
        ]
      }
    ]
  },
  "canli-izleme-paneli": {
    editFormSections: [
      {
        tabTitle: "Wallboard Düzen Özelleştirme, Eşik Alarmları & Tam Ekran TV Modu",
        badge: "Wallboard",
        description: "Operasyon TV ekranları için özelleştirilebilir widget düzeni, kuyruk bekleme alarmları ve temsilci matrisi.",
        fields: [
          { name: "Widget Düzeni (/api/wallboard/layout)", type: "Kalıcı JSON Layout", defaultVal: "Varsayılan Grid", required: false, effect: "Ekranda görünecek KPI kartlarını, kuyruk kutularını ve temsilci tablolarını sunucuya kaydeder." },
          { name: "SLA & Bekleme Eşik Alarmları + Kiosk/TV Modu", type: "Sarı / Kırmızı Uyarı", defaultVal: "Bekleyen >=3 / >=30 sn", required: false, effect: "Eşik aşılınca kart kırmızı alarm moduna geçer; TV modu sol menüyü gizleyerek tam ekran sunar." }
        ]
      }
    ]
  },
  "canli-cagri-izleme": {
    editFormSections: [
      {
        tabTitle: "Canlı Çağrı Müdahale Butonları (Listen / Whisper / Barge / Transfer / Hangup)",
        badge: "Süpervizör ChanSpy",
        description: "Aktif görüşmelere tek tıkla müdahale ve Asterisk AMI yönlendirme kontrolleri.",
        fields: [
          { name: "Sessiz Dinle (Listen — ChanSpy q)", type: "call_monitor:listen", defaultVal: "Tek Yönlü", required: false, effect: "Süpervizörün dahilisini çaldırır; ne müşteri ne temsilci dinlendiğini duyar." },
          { name: "Sufle / Fısılda (Whisper — ChanSpy qw)", type: "call_monitor:whisper", defaultVal: "Sadece Temsilci Duyar", required: false, effect: "Süpervizör konuştuğunda yalnızca temsilci duyar; canlı koçluk ve kriz yönlendirmesi için kullanılır." },
          { name: "Araya Gir (Barge-In — ChanSpy qB)", type: "call_monitor:barge", defaultVal: "3'lü Konferans", required: false, effect: "Süpervizörü her iki tarafın duyacağı şekilde görüşmeye dahil eder." },
          { name: "Canlı Transfer / Sonlandır & Mola Onay Kuyruğu", type: "AMI Redirect / Hangup / Break Approval", defaultVal: "Anlık", required: false, effect: "Görüşmeyi başka dahili/kuyruğa aktarır, takılı kanalı kapatır, temsilci mola taleplerini onaylar veya zorla logout eder." }
        ]
      }
    ]
  },
  "temsilci-cagri-paneli": {
    editFormSections: [
      {
        tabTitle: "Sekme 1: Pano (Günlük Performans & Mola Sayaçları)",
        badge: "Çağrı Paneli 1/10",
        screenshot: { src: "/screenshots/tabs/call-panel/01-pano.jpg", caption: "Temsilci Çağrı Paneli → Pano sekmesi — Bugünkü çağrı adetleri ve mola dağılımı", routeHint: "Temsilci Çağrı Paneli → Pano" },
        description: "Temsilcinin o günkü kişisel gelen/giden/kaçan çağrı sayılarını, ortalama konuşma süresini ve mola türlerine göre (Yemek, İhtiyaç, Eğitim) kullandığı toplam dakikaları gösterir.",
        fields: [
          { name: "Gerekli Yetki Kodu", type: "call_panel:tab_dashboard", defaultVal: "Aktif", required: false, effect: "Rol ayarından açılıp kapatılabilir. Sayaçlar her gece 00:00 (UTC+3) itibarıyla otomatik sıfırlanır." },
          { name: "Mola Durum Seçici & Kuyruk Pause", type: "Müsait / Yemek / İhtiyaç / Eğitim / Toplantı", defaultVal: "agent_break_logs", required: false, effect: "Mola seçildiğinde kuyruk çağrıları durur, süre saniye bazında PostgreSQL puantaj tablosuna işlenir." }
        ]
      },
      {
        tabTitle: "Sekme 2: Web Telefon (Softphone, Transfer, Konferans, *9 Kayıt Duraklat & *11 Flip)",
        badge: "Çağrı Paneli 2/10",
        screenshot: { src: "/screenshots/tabs/call-panel/02-webphone.jpg", caption: "Temsilci Çağrı Paneli → Web Telefon — Tuş takımı, aktif görüşme ve hızlı işlem tuşları", routeHint: "Temsilci Çağrı Paneli → Web Telefon" },
        description: "Temsilcinin tüm sesli çağrıları yönettiği gömülü SIP.js WebRTC telefonu.",
        fields: [
          { name: "Tuş Takımı, Mute, Hold & Çağrı Reddi", type: "call_panel:tab_webphone / webphone_reject", defaultVal: "Aktif", required: false, effect: "Numara çevirme, sessize alma, bekleme müziğine (MoH) alma ve meşgule düşürme." },
          { name: "Kör & Danışmalı Transfer + 3'lü Konferans", type: "webphone_transfer / webphone_conference", defaultVal: "Aktif", required: false, effect: "Görüşmeyi başka dahili/kuyruğa aktarma veya 3. kişiyi görüşmeye dahil etme." },
          { name: "KVKK Kayıt Duraklat (*9), Call Flip (*11) & Rehbere Kaydet", type: "call_panel:call_flip / webphone_save_contact", defaultVal: "Aktif", required: false, effect: "Kredi kartı/KVKK bilgisinde MixMonitor kaydını duraklatır; *11 ile çağrıyı mobile/masa telefonuna geçirir." },
          { name: "Müşteri 360°, CTI Screen Pop, AI Not & Canlı Çeviri", type: "cti_screen_pop / ai_note_assistant / live_translation", defaultVal: "Çağrı Anında", required: false, effect: "Çağrı çaldığında CRM kartını açar, görüşme bitince AI özet notu ve sonuç kodu önerir, yabancı dilleri canlı çevirir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 2.1: Web Telefon Sistem Kontrolü & 6 Adımlı Sorun Giderme Ekranı",
        badge: "Web Telefon → Sistem Kontrolü",
        screenshot: { src: "/screenshots/tabs/call-panel/deep/webphone-diagnostics.jpg", caption: "Web Telefon → 'WEB TELEFON HAZIR' durum çipi: İnternet, HTTPS/WebRTC, Mikrofon İzni, Santral WSS/SIP, Web Lock ve Hoparlör 6'lı Sağlık Kontrolü", routeHint: "Temsilci Çağrı Paneli → Web Telefon → Sistem Kontrolü" },
        description: "Web Telefon üstündeki yeşil/kırmızı durum rozetine tıklandığında açılan ve ses, mikrofon veya kayıt sorunlarını temsilcinin kendi başına 10 saniyede teşhis etmesini sağlayan 6'lı tanılama ekranıdır.",
        fields: [
          { name: "Bu Bilgisayarın Cihaz Anahtarı (AIDA-DEV-...) & 'Tekrar Tara'", type: "Benzersiz İstemci ID", defaultVal: "Kopyalanabilir", required: false, effect: "BT destek ekibinin ilgili bilgisayarın WebRTC oturumunu loglarda anında bulmasını sağlar." },
          { name: "1. İnternet & Ağ • 2. Güvenli Bağlantı (HTTPS/WebRTC) • 3. Mikrofon İzni ('İzni Tekrar Dene')", type: "SORUNSUZ / SORUN VAR", defaultVal: "Canlı Kontrol", required: false, effect: "Mikrofon reddedildiyse adres çubuğundaki kilit ikonundan nasıl açılacağını adım adım gösterir ve tek tıkla yeniden izin ister." },
          { name: "4. Santral (WSS/SIP) Bağlantısı • 5. Arka Plan & Bellek Tasarrufu Koruması (Web Lock) • 6. Hoparlör & Zil Çıkışı ('Test Sesi Çal')", type: "WSS + Uyku Koruması + Ses Testi", defaultVal: "Aktif", required: false, effect: "Tarayıcının sekmeyi uyutup gelen çağrıları kaçırmasını önleyen Web Lock korumasını doğrular ve hoparlöre canlı test sesi yollar." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 2.2: Aktif Görüşme Araçları — Canlı Çeviri, Müşteri 360° (Alt+C), AI Not Asistanı & ACW",
        badge: "Web Telefon → Görüşme Araçları",
        description: "Görüşme başladığında veya ACW (Çağrı Sonrası İşlem) aşamasına geçildiğinde Web Telefon ekranında açılan ileri seviye temsilci yardımcı araçlarıdır.",
        fields: [
          { name: "Canlı Konuşma & Çeviri Akışı (Live Translator)", type: "Anlık Çift Yönlü Çeviri + Sesli Okutma", defaultVal: "Çok Dilli", required: false, effect: "Yabancı dil konuşan müşterinin sözlerini anlık Türkçeye çevirir; temsilcinin yazdığı Türkçe yanıtı müşterinin diline çevirip hatta sesli okutur." },
          { name: "Müşteri 360° Tüm Kanal Geçmişi (Alt+C) & CRM Screen Pop", type: "Birleşik Zaman Tüneli", defaultVal: "Alt+C", required: false, effect: "Arayan müşterinin geçmiş tüm telefon çağrılarını, WhatsApp/E-Posta yazışmalarını, randevularını ve temsilci notlarını tek yan çekmecede gösterir." },
          { name: "Yeni Çağrı / 2. Hat Ekle, Kör/Danışmalı Transfer & 3'lü Konferans", type: "Çoklu Hat Yönetimi", defaultVal: "WebRTC", required: false, effect: "Mevcut müşteriyi bekletip 2. dahili/dış hattı arayabilir, önce konuşup sonra bağlayabilir (Danışmalı Transfer) veya 3 kişiyi konferansa alabilirsiniz." },
          { name: "ACW Notu, Sonuç Kodu & AI Not Asistanı", type: "Otomatik Özet + Hızlı Kaydet & Müsaite Geç", defaultVal: "Kuyruk ACW Süreli", required: false, effect: "Görüşme bitiminde AI'ın çıkardığı özet notu ve önerdiği sonuç kodunu tek tıkla onaylayıp hemen tekrar Müsait duruma dönersiniz." }
        ]
      },
      {
        tabTitle: "Sekme 3: Temsilciler (Ekip Canlı Durum & BLF Transfer Matrisi)",
        badge: "Çağrı Paneli 3/10",
        screenshot: { src: "/screenshots/tabs/call-panel/03-temsilciler.jpg", caption: "Temsilci Çağrı Paneli → Temsilciler — Ekip arkadaşlarının anlık durumu, süresi ve hızlı transfer", routeHint: "Temsilci Çağrı Paneli → Temsilciler" },
        description: "Diğer temsilcilerin Müsait/Konuşuyor/Molada durumlarını ve granüler rol yetkisine göre süre, çağrı adedi ve login/logout saatlerini gösterir.",
        fields: [
          { name: "4 Granüler Görünürlük Yetkisi", type: "agents_status / agents_duration / agents_call_counts / agents_login_logout", defaultVal: "Rol Bazlı", required: false, effect: "Temsilcinin diğer arkadaşları hakkında ne kadar detay görebileceğini hassas biçimde sınırlar." },
          { name: "Tek Tıkla Ara veya Aktif Çağrıyı Transfer Et", type: "Hızlı Aksiyon", defaultVal: "Canlı", required: false, effect: "Müsait görünen ekip arkadaşına dahili arama başlatır veya eldeki çağrıyı tek tıkla aktarır." }
        ]
      },
      {
        tabTitle: "Sekme 4: Hızlı Arama (Speed Dial Kartları)",
        badge: "Çağrı Paneli 4/10",
        screenshot: { src: "/screenshots/tabs/call-panel/04-hizli-arama.jpg", caption: "Temsilci Çağrı Paneli → Hızlı Arama — Tanımlı kısa kodlar ve tek tıkla arama kartları", routeHint: "Temsilci Çağrı Paneli → Hızlı Arama" },
        description: "Santralde tanımlı tüm hızlı arama kodlarını (*01, *02 vb.) tıklanabilir kartlar halinde sunar.",
        fields: [
          { name: "Tek Tıkla Arama (call_panel:tab_speeddial)", type: "Speed Dial Listesi", defaultVal: "Santralle Senkron", required: false, effect: "Numara ezberlemeden sık aranan kurum içi/dışı hedeflere tek tıkla çağrı başlatır." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 4.1: Yeni Hızlı Arama Ekle / Düzenle Modalı",
        badge: "Hızlı Arama → Yeni Ekle (+)",
        screenshot: { src: "/screenshots/tabs/call-panel/deep/speeddial-add-modal.jpg", caption: "Temsilci Çağrı Paneli → Hızlı Arama → '+' Yeni Hızlı Arama Ekle penceresi", routeHint: "Temsilci Çağrı Paneli → Hızlı Arama → +" },
        description: "Temsilcinin sık aradığı dahili veya dış telefon numaralarını kısa kod ve açıklamayla kişisel/kurumsal hızlı arama kartlarına eklediği alt penceredir.",
        fields: [
          { name: "Kısa Kod, Hedef Numara & Açıklama", type: "Örn. *05 → 0212... → Kargo Şubesi", defaultVal: "Anında Kart Ekler", required: true, effect: "Eklendiği anda Hızlı Arama sekmesinde tek tıkla aranabilir kart olarak görünür." }
        ]
      },
      {
        tabTitle: "Sekme 5: Kayıp Çağrı (Cevapsız Sahiplenme / Claim & Geri Arama)",
        badge: "Çağrı Paneli 5/10",
        screenshot: { src: "/screenshots/tabs/call-panel/05-kayip-cagri.jpg", caption: "Temsilci Çağrı Paneli → Kayıp Çağrı — Cevapsız çağrıları sahiplenme (Claim) ve geri arama", routeHint: "Temsilci Çağrı Paneli → Kayıp Çağrı" },
        description: "Cevapsız kalan çağrıları listeler ve iki temsilcinin aynı müşteriyi tekrar aramasını önleyen 'Üzerime Al (Claim)' kilidi sunar.",
        fields: [
          { name: "Üzerime Al (Claim) & Tek Tıkla Geri Ara", type: "call_panel:tab_missed", defaultVal: "missed_claims", required: false, effect: "Bir temsilci kayıp çağrıyı sahiplendiğinde diğer tüm temsilcilerin ekranında kim tarafından ilgilenildiği görünür." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 5.1: Yeni Geri Arama Hatırlatıcısı & İleri Tarihli Geri Arama Planla Modalı",
        badge: "Kayıp Çağrı → Geri Arama Planla",
        screenshot: { src: "/screenshots/tabs/call-panel/deep/missed-callback-modal.jpg", caption: "Temsilci Çağrı Paneli → Kayıp Çağrı → Yeni Geri Arama Hatırlatıcısı / Planla penceresi", routeHint: "Temsilci Çağrı Paneli → Kayıp Çağrı → Geri Arama Planla" },
        description: "Müşteri 'beni saat 15:00'te tekrar arayın' dediğinde veya cevapsız bir çağrı için ileri saatli hatırlatma oluşturulmak istendiğinde açılan alt penceredir.",
        fields: [
          { name: "Müşteri Telefonu, Müşteri Adı, Planlanan Tarih/Saat & Hatırlatma Notu", type: "Tarih/Saat + Öncelik + Not", defaultVal: "Zamanı Gelince Uyarı", required: true, effect: "Planlanan saat geldiğinde temsilciye görsel/sesli hatırlatma çıkarır ve tek tıkla geri arama başlatır." }
        ]
      },
      {
        tabTitle: "Sekme 6: Rehber (Müşteri Arama & 360° Zaman Tüneli)",
        badge: "Çağrı Paneli 6/10",
        screenshot: { src: "/screenshots/tabs/call-panel/06-rehber.jpg", caption: "Temsilci Çağrı Paneli → Rehber — Kurumsal müşteri arama ve hızlı çağrı başlatma", routeHint: "Temsilci Çağrı Paneli → Rehber" },
        description: "Kurumsal rehberdeki tüm kayıtları arayıp tek tıkla arama ve Müşteri 360° kartı görüntüleme sekmesidir.",
        fields: [
          { name: "İsim / Şirket / Telefon Arama", type: "call_panel:tab_directory", defaultVal: "Son 10 Hane Eşleşmeli", required: false, effect: "Müşteri kartından doğrudan arama başlatır veya geçmiş tüm etkileşimleri görüntüler." }
        ]
      },
      {
        tabTitle: "Sekme 7: Çağrı Geçmişi (Kişisel CDR, Ses Kaydı & Transkript)",
        badge: "Çağrı Paneli 7/10",
        screenshot: { src: "/screenshots/tabs/call-panel/07-cagri-gecmisi.jpg", caption: "Temsilci Çağrı Paneli → Çağrı Geçmişi — Kişisel görüşme listesi, ses kaydı ve transkript erişimi", routeHint: "Temsilci Çağrı Paneli → Çağrı Geçmişi" },
        description: "Temsilcinin kendi gerçekleştirdiği gelen ve giden çağrıların dökümünü sunar.",
        fields: [
          { name: "Ses Kaydı Dinleme & Transkript Okuma", type: "call_panel:listen_records / view_transcripts", defaultVal: "Yetki Bazlı", required: false, effect: "Rol yetkisi verilirse temsilci kendi geçmiş görüşmelerini dinleyip konuşma dökümüne ve notlarına bakabilir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 7.1: Kişisel Çağrı Geçmişi Gelişmiş Filtre Paneli & Transkript Popup'ı",
        badge: "Çağrı Geçmişi → Filtreler",
        screenshot: { src: "/screenshots/tabs/call-panel/deep/history-filters.jpg", caption: "Temsilci Çağrı Paneli → Çağrı Geçmişi → 'Filtreler' çekmecesi: Yön, Durum, Tarih ve Numara/İsim filtreleri", routeHint: "Temsilci Çağrı Paneli → Çağrı Geçmişi → Filtreler" },
        description: "Temsilcinin kendi çağrı kayıtlarını yön (Gelen/Giden/Dahili), sonuç (Cevaplanan/Cevapsız) ve tarih aralığına göre süzmesini ve satırdaki transkript penceresini açmasını sağlar.",
        fields: [
          { name: "Yön, Sonuç, Tarih Aralığı & Numara/İsim Araması + Tekrar Ara", type: "Hızlı Filtre Paneli", defaultVal: "Bugün / Hafta / Özel", required: false, effect: "Doğrudan dahilinize gelen yanıtsız çağrıları ve belirli bir müşteriyle yapılan geçmiş görüşmeleri saniyeler içinde bulur." }
        ]
      },
      {
        tabTitle: "Sekme 8: Sesli Posta (Görsel Voicemail Oynatıcı)",
        badge: "Çağrı Paneli 8/10",
        screenshot: { src: "/screenshots/tabs/call-panel/08-sesli-posta.jpg", caption: "Temsilci Çağrı Paneli → Sesli Posta — Bırakılan sesli mesajları dinleme ve yönetme", routeHint: "Temsilci Çağrı Paneli → Sesli Posta" },
        description: "*97 aramadan doğrudan tarayıcıdan sesli mesaj dinleme, okundu işaretleme ve geri arama sekmesidir.",
        fields: [
          { name: "Ses Oynatıcı, .WAV İndirme, Geri Ara, Okundu İşareti & Silme", type: "call_panel:tab_voicemail", defaultVal: "WAV Stream", required: false, effect: "Yeni mesaj bırakıldığında kırmızı rozetle temsilciyi uyarır; mesaj .wav olarak indirilebilir veya tek tıkla geri aranabilir." }
        ]
      },
      {
        tabTitle: "Sekme 9: Sohbet (Omnichannel Müşteri & Ekip İçi Mesajlaşma)",
        badge: "Çağrı Paneli 9/10",
        screenshot: { src: "/screenshots/tabs/call-panel/09-sohbet.jpg", caption: "Temsilci Çağrı Paneli → Sohbet — Temsilciye atanmış müşteri ve ekip içi sohbet oturumları", routeHint: "Temsilci Çağrı Paneli → Sohbet" },
        description: "Temsilcinin çağrı panelinden ayrılmadan hem atanmış müşteri (WhatsApp/E-Posta/Telegram) hem ekip içi yazışmaları yönettiği sekmedir.",
        fields: [
          { name: "AI ↔ Temsilci Devral / Devret, Yeni İç Yazışma & İletildi/Okundu Tikleri", type: "call_panel:tab_chat", defaultVal: "Gerçek Zamanlı", required: false, effect: "Müşteri sohbetini AI'dan devralabilir, işiniz bitince AI'a geri devredebilir ve ekip arkadaşlarıyla iç sohbet başlatabilirsiniz." }
        ]
      },
      {
        tabTitle: "Sekme 10: Masa Telefonum — Canlı Görsel Tasarımcı (Fiziksel IP Telefon Simülatörü)",
        badge: "Çağrı Paneli 10/10",
        screenshot: { src: "/screenshots/tabs/call-panel/deep/deskphone-visual-simulator.jpg", caption: "Temsilci Çağrı Paneli → Masa Telefonum: Canlı Görsel IP Telefon Tasarımcısı (Yealink T42S Monokrom LCD, T1–T6 Tuşları ve Rehberden Tek Tıkla BLF)", routeHint: "Temsilci Çağrı Paneli → Masa Telefonum → Tuşlar" },
        description: "Temsilcinin kendi masasında duran Yealink/Fanvil/Grandstream/Cisco IP telefonunu birebir görsel kasa ve LCD ekran üzerinde tasarlayıp tek tıkla telefona gönderdiği (Check-Sync / Reboot) stüdyodur.",
        fields: [
          { name: "Üst Aksiyon Çubuğu (Sıfırla • Kod Önizle • Kaydet • Hızlı Uygula • Telefona Gönder & Yeniden Başlat)", type: "Canlı Provizyon Kontrolü", defaultVal: "SIP NOTIFY", required: false, effect: "'Hızlı Uygula' telefonu kapatmadan Check-Sync gönderir; 'Telefona Gönder & Yeniden Başlat' tam provizyon uygular." },
          { name: "Görsel Telefon Tuşları (T1 Kilitli Ana Hat + T2..T24 + Sidecar Genişleme Modülü) & 'Rehberden Tek Tıkla Ata'", type: "BLF / Speed Dial / Voicemail / DND / Transfer / Pickup", defaultVal: "Otomatik İsimli", required: false, effect: "Telefon gövdesindeki herhangi bir tuşa tıklayıp sağdaki rehber listesinden ekip arkadaşını seçtiğinizde BLF ve LCD etiketi anında ekranda önizlenir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 10.1: Masa Telefonum → Ses & Zil Sekmesi (Zil Melodisi Dinleme, Kodek & İnterkom)",
        badge: "Masa Telefonum → Ses & Zil",
        screenshot: { src: "/screenshots/tabs/call-panel/deep/deskphone-tab-audio.jpg", caption: "Masa Telefonum → Ses & Zil sekmesi: Fiziksel telefon zil melodisi seçimi, ön dinleme ve ses ayarları", routeHint: "Temsilci Çağrı Paneli → Masa Telefonum → Ses & Zil" },
        description: "Fiziksel masa telefonunun çalma melodisini (Ring1..Ring8), tarayıcıdan ön dinleme ile seçip ses/kodek tercihlerini özelleştirdiğiniz alt sekmedir.",
        fields: [
          { name: "Zil Melodisi Seçici + 'Melodiyi Dinle', Otomatik Cevap (İnterkom) & Ses Tercihleri", type: "Donanım Ses Profili", defaultVal: "Ring1.wav", required: false, effect: "Kaydedilip telefona gönderildiğinde fiziksel IP telefonun zil sesi anında güncellenir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 10.2: Masa Telefonum → Ekran Sekmesi (LCD Dil, Saat Biçimi, Kontrast & Bekleme Ekranı)",
        badge: "Masa Telefonum → Ekran",
        screenshot: { src: "/screenshots/tabs/call-panel/deep/deskphone-tab-screen.jpg", caption: "Masa Telefonum → Ekran sekmesi: Fiziksel telefon LCD ekran dili, saat dilimi, ekran koruyucu ve etiket ayarları", routeHint: "Temsilci Çağrı Paneli → Masa Telefonum → Ekran" },
        description: "Fiziksel IP telefonun LCD ekranında görünecek dil, saat formatı, arka ışık zaman aşımı ve kullanıcı karşılama etiketini yönetir.",
        fields: [
          { name: "Ekran Dili, Saat Formatı (24s/12s), Arka Işık & Bekleme Etiketi", type: "LCD Görünüm Ayarları", defaultVal: "Türkçe / 24 Saat", required: false, effect: "Yapılan değişiklikler soldaki canlı LCD telefon simülatöründe anında önizlenir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 10.3: Masa Telefonum → Provizyon Sekmesi (LAN / WAN URL & Son Provizyon Durumu)",
        badge: "Masa Telefonum → Provizyon",
        screenshot: { src: "/screenshots/tabs/call-panel/deep/deskphone-tab-provision.jpg", caption: "Masa Telefonum → Provizyon sekmesi: LAN/WAN Auto-Provision URL kopyalama ve cihaz bağlantı detayları", routeHint: "Temsilci Çağrı Paneli → Masa Telefonum → Provizyon" },
        description: "Telefonun MAC adresi, SIP Endpoint kimliği, son provizyon zamanı ve ofis içi (LAN) / uzak şube (WAN) otomatik kurulum bağlantılarını sunar.",
        fields: [
          { name: "LAN URL Kopyala / WAN URL Kopyala & Son Provizyon Zamanı", type: "Zero-Touch Provizyon", defaultVal: "HTTP/HTTPS", required: false, effect: "Telefonun web arayüzündeki Auto Provision Server URL alanına yapıştırılarak sıfırdan kurulum yapılmasını sağlar." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 10.4: Masa Telefonum → Canlı Oto-Provizyon Kodu (.CFG / .XML) Önizle & İndir Modalı",
        badge: "Masa Telefonum → Kod Önizle",
        screenshot: { src: "/screenshots/tabs/call-panel/deep/deskphone-cfg-preview.jpg", caption: "Masa Telefonum → 'Kod Önizle' Modalı: Telefon için üretilen canlı .cfg/.xml dosyasını inceleme, kopyalama ve indirme", routeHint: "Temsilci Çağrı Paneli → Masa Telefonum → Kod Önizle" },
        description: "Üst çubuktaki 'Kod Önizle' butonuna tıklandığında santralin bu masa telefonu için anlık ürettiği ham `.cfg` veya `.xml` yapılandırma dosyasını gösteren teknik inceleme penceresidir.",
        fields: [
          { name: "Canlı Üretilen .CFG/.XML İçeriği, 'Kopyala' & 'İndir' Butonları", type: "Yealink / Fanvil / Grandstream / Cisco / Snom", defaultVal: "Anlık Render", required: false, effect: "SIP hesap bloğu, NAT keep-alive, DTMF, ses kodek öncelikleri ve tüm BLF/DSS tuş satırlarını telefona göndermeden önce doğrulamanızı sağlar." }
        ]
      }
    ]
  },
  "ortak-gelen-kutusu": {
    editFormSections: [
      {
        tabTitle: "Sohbet Kontrol Paneli, AI ↔ İnsan Devri, Hat Rozetleri & Toplu Broadcast",
        badge: "Omnichannel Araçları",
        description: "Çok kanallı sohbet ekranındaki devralma, şablon gönderimi, toplu WhatsApp kampanyası ve rehber eşleştirme kontrolleri.",
        fields: [
          { name: "Devral (Takeover) / AI'a Devret & Temsilciye Ata", type: "AI ↔ İnsan Anahtarı", defaultVal: "AI Otomatik", required: false, effect: "Takeover yapıldığında AI otomatik yanıtlamayı durdurur; 'Canlı Temsilci' butonu tıklanınca otomatik insan moduna geçer." },
          { name: "Çoklu Hat Rozeti (recipient_info) & Hızlı Cevaplar (/)", type: "Örn. Satış Hattı - 0850...", defaultVal: "Otomatik", required: false, effect: "Müşterinin hangi WhatsApp hattına yazdığını gösterir; '/' ile hazır yanıtlar anında eklenir." },
          { name: "WhatsApp Toplu Yayın (Broadcast) & Onaylı HSM Şablonları", type: "CSV/TXT İçe Aktarma + Meta Template", defaultVal: "24 Saat Dışı Uyumlu", required: false, effect: "CSV/TXT'den numaraları temizleyip tekilleştirerek toplu mesaj veya 24 saat dışı onaylı şablon gönderir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 1: Yeni İleti Başlat (Tekil E-Posta / Tekil WhatsApp Mesajı Gönderme)",
        badge: "Omnichannel → Yeni İleti",
        screenshot: { src: "/screenshots/tabs/deep/omni-compose.jpg", caption: "Ortak Gelen Kutusu → '+' Yeni İleti Başlat: Tekil E-Posta (Konu, Gövde, Ek Dosya) veya Tekil WhatsApp oturumu başlatma", routeHint: "Ortak Gelen Kutusu → +" },
        description: "Sağ üstteki kırmızı '+' butonuna tıklandığında açılan ve temsilcinin sıfırdan giden E-Posta veya WhatsApp görüşmesi başlatmasını sağlayan alt penceredir.",
        fields: [
          { name: "Kanal Sekmesi (Yeni E-Posta Gönder / Yeni WhatsApp Mesajı)", type: "Çift Kanal Seçici", defaultVal: "E-Posta / WhatsApp", required: true, effect: "E-Posta sekmesinde alıcı adresi, konu, HTML/metin gövde ve dosya eki; WhatsApp sekmesinde Tekil Mesaj veya Toplu Kampanya modları açılır." },
          { name: "Alıcı, Konu, Mesaj İçeriği & Ek Dosya Yükle", type: "Email / E.164 Telefon + Dosya", defaultVal: "SMTP / Meta Cloud API", required: true, effect: "Gönderilen ileti doğrudan ilgili müşterinin Ortak Gelen Kutusu sohbet geçmişine işlenir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 2: WhatsApp Toplu Mesaj / Kampanya & PDF Katalog Yayınlama Modalı",
        badge: "Omnichannel → Toplu Kampanya",
        screenshot: { src: "/screenshots/tabs/deep/omni-broadcast.jpg", caption: "Ortak Gelen Kutusu → Yeni İleti → WhatsApp → Toplu Mesaj / Kampanya: Hedef kitle, duyuru metni ve PDF/medya ekleme", routeHint: "Ortak Gelen Kutusu → + → Yeni WhatsApp Mesajı → Toplu Mesaj / Kampanya" },
        description: "Rehberdeki tüm kayıtlı kişilere, seçili rehber defterine veya CSV/TXT dosyasından yüklenen numara listesine tek tıkla toplu WhatsApp duyurusu ve PDF katalog gönderir.",
        fields: [
          { name: "Hedef Kitle Seçici (Rehberdeki Tüm Kayıtlı Kişiler / Rehber Defteri / CSV-TXT Dosyası)", type: "Dinamik Kitle + Otomatik Tekilleştirme", defaultVal: "Rehber", required: true, effect: "CSV/TXT seçildiğinde numaralar tarayıcıda temizlenir, +90 formatına normalize edilir ve mükerrer kayıtlar otomatik elenir." },
          { name: "Kampanya / Duyuru Mesajı*", type: "Çok Satırlı Metin", defaultVal: "Zorunlu", required: true, effect: "Meta WhatsApp Business Cloud API üzerinden belirlenen hedef kitleye sırayla iletilir." },
          { name: "Medya veya PDF Katalog URL / 'Ek Dosya Ekle'", type: "HTTPS URL veya Yerel Dosya (PDF/Görsel)", defaultVal: "Opsiyonel", required: false, effect: "Broşür, fiyat listesi PDF'i veya kampanya görselini mesajla birlikte müşterilere otomatik gönderir." }
        ]
      }
    ]
  },
  "api-butce-ve-tuketim": {
    editFormSections: [
      {
        tabTitle: "7 Sağlayıcı İçin Ücret/Paket Yükleme, Bütçe Eşiği & Tüketim Sıfırlama Modalları",
        badge: "Maliyet Kontrolü",
        description: "Google Gemini, ElevenLabs, Meta WhatsApp, OpenAI, Anthropic, Groq ve Deepgram için bakiye yükleme ve alarm yönetimi.",
        fields: [
          { name: "Ücret / Paket Yükleme Modalı ($ USD)", type: "Hızlı Tutar + Mevcut Harcama", defaultVal: "USD", required: true, effect: "Yüklenen kredi tutarını kaydederek kalan bakiye yüzdesini ve tahmini kalan konuşma dakikasını hesaplar." },
          { name: "Kritik Uyarı Alarm Eşiği (%) & Dönem Sıfırlama", type: "50–95% + Sıfırla", defaultVal: "%80", required: false, effect: "Eşik aşılınca E-Mail & WhatsApp Bildirimleri üzerinden yöneticilere anında uyarı gönderilir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 1: Sağlayıcı Ücret / Paket Yüklemesi Modalı ($ USD)",
        badge: "API Bütçe → Ücret Yükle (+)",
        screenshot: { src: "/screenshots/tabs/deep/budget-add-credit.jpg", caption: "API Bütçe ve Tüketim → Sağlayıcı '+' Butonu: Yeni Ücret Yüklemesi Başlat, Hızlı Tutar ($5–$100) ve Halihazırda Harcanmış Tutar", routeHint: "API Bütçe ve Tüketim → Sağlayıcı Kartı → +" },
        description: "Google Gemini, ElevenLabs veya OpenAI gibi bulut servislere yeni kredi yüklediğinizde santraldeki takip dönemini başlatan alt penceredir.",
        fields: [
          { name: "Yükleme İşlem Türü", type: "Yeni Ücret Yüklemesi Başlat (Önerilen) / Mevcut Pakete Ekle", defaultVal: "Yeni Yükleme", required: true, effect: "Yeni yükleme seçildiğinde son yükleme tarihi şu an olarak kaydedilir ve yalnızca bundan sonraki çağrı/token tüketimleri bu paketten düşülür." },
          { name: "Hızlı Tutar Seçimi ($5 / $10 / $20 / $50 / $100) & Yüklenen Paket Tutarı ($ USD)", type: "USD Ondalıklı", defaultVal: "$10", required: true, effect: "Kalan bakiye yüzdesini ve kalan tahmini konuşma dakikasını bu tutar üzerinden hesaplar." },
          { name: "Platformda Halihazırda Harcanmış Tutar Varsa ($ USD – Opsiyonel)", type: "Başlangıç Ofseti", defaultVal: "0", required: false, effect: "Sağlayıcı panelinde önceden harcanmış küsurat (örn. $0.04) varsa birebir eşitleme yapmanızı sağlar." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 2: Paket Bütçesi, Tüketim Referansı & Alarm Eşiği Düzenle Modalı",
        badge: "API Bütçe → Düzenle",
        screenshot: { src: "/screenshots/tabs/deep/budget-edit-threshold.jpg", caption: "API Bütçe ve Tüketim → Sağlayıcı 'Düzenle' Butonu: Yüklenen paket, referans harcama ve kritik uyarı alarm eşiği (%)", routeHint: "API Bütçe ve Tüketim → Sağlayıcı Kartı → Düzenle" },
        description: "Mevcut bir sağlayıcı paketinin bütçe tutarını düzeltme ve E-Mail/WhatsApp kota alarm yüzdesini özelleştirme penceresidir.",
        fields: [
          { name: "Tanımlı Paket Bütçesi ($ USD) & Düzeltilmiş Harcanan Referans ($ USD)", type: "Manuel Mutabakat", defaultVal: "Mevcut Değer", required: true, effect: "Ay sonu fatura mutabakatında santral tahminini sağlayıcı faturasıyla kuruşu kuruşuna eşitler." },
          { name: "Kritik Uyarı Alarm Eşiği (%)", type: "Yüzde (50%–95%)", defaultVal: "%80", required: true, effect: "Harcanan tutar bu yüzdeyi geçtiğinde kart kırmızı uyarı moduna geçer ve tanımlı yöneticilere E-Mail + WhatsApp bildirimi tetiklenir." }
        ]
      }
    ]
  },
  "ai-konfigurasyon-asistani": {
    editFormSections: [
      {
        tabTitle: "Doğal Dil Planlama, Etki Önizleme (Diff) & Tek Tıkla Snapshot Geri Alma",
        badge: "AI Otomasyon",
        description: "Türkçe yazarak veya sesli dikte ile santral yapılandırması yaparken çalışan 3 aşamalı güvenli akış.",
        fields: [
          { name: "Komut & Sesli Dikte Kutusu", type: "Türkçe NLP + Mikrofon", defaultVal: "Dry-Run Önce", required: true, effect: "Kullanıcı, kuyruk, kural, mesai veya kara liste taleplerini yapısal değişiklik planına çevirir." },
          { name: "Plan Önizleme, Uygulama & Snapshot Geri Alma (Undo)", type: "Rollback", defaultVal: "Her işlemde snapshot", required: false, effect: "Hiçbir değişiklik onaylanmadan uygulanmaz; geçmişten tek tıkla eski santral durumuna dönülür." }
        ]
      }
    ]
  },
  "ai-temsilcileri": {
    editFormSections: [
      {
        tabTitle: "Sekme 1: Kimlik & Sistem Talimatı (Prompt & Hazır Karakter Şablonları)",
        badge: "AI Düzenle 1/8",
        screenshot: { src: "/screenshots/tabs/ai-agents/01-kimlik-prompt.jpg", caption: "AI Temsilcisi → Sekme 1: Kimlik Bilgileri, Hazır Karakter Şablonları, Açılış/Veda ve Sistem Talimatı", routeHint: "AI Temsilcileri → Kimlik & Sistem Talimatı" },
        description: "Asistanın adını, kurumsal unvanını, canlı temsilci aktarım hedefini, karşılama/veda cümlelerini ve ana davranış prompt'unu belirler.",
        fields: [
          { name: "Temsilci Adı, Görev/Unvan & Canlı Aktarım Hedefi (Dahili/Kuyruk)", type: "Metin + Hedef No", defaultVal: "Aktif", required: true, effect: "Asistan müşteri talebi veya kriz durumunda çağrıyı doğrudan bu dahili/kuyruğa aktarır." },
          { name: "Hazır Karakter Şablonları (Tek Tıkla Uygula)", type: "Satış / Teknik Destek / Sekreterya-Randevu / Finans-Tahsilat", defaultVal: "4 Hazır Şablon", required: false, effect: "Sektöre göre optimize edilmiş profesyonel Türkçe sistem talimatını tek tıkla doldurur." },
          { name: "Çağrı Karşılama Cümlesi, Veda Cümlesi & Sistem Talimatı", type: "Çok Satırlı Metin", defaultVal: "Zorunlu", required: true, effect: "İlk söylenen karşılama cümlesini ve tüm görüşme kurallarını belirler." }
        ]
      },
      {
        tabTitle: "Sekme 2: Ses Motoru (STT & TTS Sağlayıcı ve Ses Aktörü Seçimi)",
        badge: "AI Düzenle 2/8",
        screenshot: { src: "/screenshots/tabs/ai-agents/02-ses-motoru.jpg", caption: "AI Temsilcisi → Sekme 2: STT (Konuşma Tanıma) ve TTS (Ses Sentezleme) motor ayarları", routeHint: "AI Temsilcileri → Ses Motoru (STT & TTS)" },
        description: "Müşterinin sesini algılayan STT ve AI'ın konuşacağı doğal insan sesi TTS motorlarını yapılandırır.",
        fields: [
          { name: "STT Sağlayıcısı (Speech-to-Text)", type: "Google Gemini Native / Deepgram Nova-2 / OpenAI Whisper / ElevenLabs Scribe", defaultVal: "Google Gemini Native", required: true, effect: "Gemini Native seçildiğinde doğrudan ses-to-ses (Multimodal Live) çalışarak en düşük gecikmeyi sağlar." },
          { name: "TTS Sağlayıcısı & Ses Karakteri", type: "Gemini Dahili / ElevenLabs (Klon Ses dahil) / OpenAI (Alloy, Nova, Shimmer)", defaultVal: "Gemini Dahili", required: true, effect: "Asistanın kadın/erkek ses tonunu, aksanını ve konuşma hızını belirler." }
        ]
      },
      {
        tabTitle: "Sekme 3: Arka Plan Sesi & Canlı Test Stüdyosu",
        badge: "AI Düzenle 3/8",
        screenshot: { src: "/screenshots/tabs/ai-agents/03-arka-plan-test.jpg", caption: "AI Temsilcisi → Sekme 3: Gerçekçi arka plan ambiyans sesleri ve tarayıcı içi canlı mikrofon testi", routeHint: "AI Temsilcileri → Arka Plan Sesi & Test Stüdyosu" },
        description: "Yapay zeka görüşmesinin robotik sessizlik yerine gerçek bir çağrı merkezi/ofis sıcaklığında duyulmasını sağlar ve tarayıcıdan canlı konuşarak test etmenize imkan tanır.",
        fields: [
          { name: "Arka Plan Ambiyans Profili", type: "Kapalı / call_center / office_keyboard / cafe_lounge / soft_rain / analog_warmth", defaultVal: "Kapalı", required: false, effect: "call_center: Gerçekçi operasyon uğultusu. office_keyboard: Hafif klavye/ofis. soft_rain: Sakinleştirici yağmur. analog_warmth: Sıcak telefon hattı." },
          { name: "Ses Seviyesi & Canlı Test Stüdyosu", type: "Slider (%) + Mikrofon Testi", defaultVal: "%15", required: false, effect: "Telefon araması yapmadan tarayıcı mikrofonuyla asistanla canlı konuşup gecikme ve ses doğallığını test edersiniz." }
        ]
      },
      {
        tabTitle: "Sekme 4: Söz Kesme & Dinleme (Barge-In & VAD Yankı Bastırma)",
        badge: "AI Düzenle 4/8",
        screenshot: { src: "/screenshots/tabs/ai-agents/04-soz-kesme-vad.jpg", caption: "AI Temsilcisi → Sekme 4: Barge-In (söz kesme), VAD hassasiyeti ve yankı bastırma eşikleri", routeHint: "AI Temsilcileri → Söz Kesme & Dinleme (VAD)" },
        description: "Müşteri araya girdiğinde AI'ın ne kadar hızlı susacağını ve arka plan gürültüsü/yankısının AI'ı yanlış kesmesini önleyen eşikleri belirler.",
        fields: [
          { name: "Barge-In (Söz Kesme) & Yankı Bastırma Genliği", type: "Toggle + Amplitude Eşiği", defaultVal: "avg_amplitude < 150 bastırılır", required: false, effect: "model_is_speaking aktifken düşük genlikli yankının Gemini server-side VAD'ı yanlış tetikleyip cümleyi bölmesini engeller." },
          { name: "Sessizlik Süresi (Endpointing)", type: "Milisaniye", defaultVal: "600–900 ms", required: false, effect: "Müşteri sustuktan kaç ms sonra AI'ın cevaba başlayacağını ince ayarlar." }
        ]
      },
      {
        tabTitle: "Sekme 5: Zeka Motoru (LLM) & Bilgi Bankası (RAG) Bağlantısı",
        badge: "AI Düzenle 5/8",
        screenshot: { src: "/screenshots/tabs/ai-agents/05-zeka-llm-rag.jpg", caption: "AI Temsilcisi → Sekme 5: LLM sağlayıcı seçimi, sıcaklık (temperature) ve RAG bilgi bankası bağlama", routeHint: "AI Temsilcileri → Zeka Motoru (LLM) & RAG" },
        description: "Asistanın akıl yürütme modelini ve Bilgi Bankası (RAG) dokümanlarından yararlanma politikasını yönetir.",
        fields: [
          { name: "LLM Sağlayıcı & Model", type: "Google Gemini Live / ElevenLabs Conv. / OpenAI GPT-4o / Anthropic Claude 3.5 / Groq", defaultVal: "Gemini Live", required: true, effect: "Çağrı sırasında kullanılacak ana dil modeli." },
          { name: "Bilgi Bankası (RAG) Enjeksiyonu & Sıcaklık (Temperature)", type: "Toggle + 0.0–1.0", defaultVal: "Aktif / 0.3", required: false, effect: "Düşük sıcaklık (0.2–0.4) kurumsal fiyat/bilgi sorularında halüsinasyonu önler ve %100 dokümana sadık kalır." }
        ]
      },
      {
        tabTitle: "Sekme 6: Konuşma Doğallığı & Güvenlik (Guardrails)",
        badge: "AI Düzenle 6/8",
        screenshot: { src: "/screenshots/tabs/ai-agents/06-dogallik-guvenlik.jpg", caption: "AI Temsilcisi → Sekme 6: Konuşma doğallığı, maksimum süre ve güvenlik korkulukları", routeHint: "AI Temsilcileri → Konuşma Doğallığı & Güvenlik" },
        description: "Suistimal koruması, maksimum konuşma süresi, konu dışı sohbet sınırları ve doğal dolgu ifadelerini ayarlar.",
        fields: [
          { name: "Maksimum Çağrı Süresi & Suistimal/Küfür Koruması", type: "Dakika + Otomatik Kapatma", defaultVal: "10 dk / Aktif", required: false, effect: "Hakaret veya suistimal tespitinde nazikçe uyarır veya [ACTION: HANGUP] ile sonlandırıp kara listeye bildirir." },
          { name: "Konu Dışı Koruma (Off-Topic Guardrail)", type: "Toggle", defaultVal: "Aktif", required: false, effect: "Müşteri şirket dışı konularda (siyaset, kod yazma vb.) sohbet etmeye çalışırsa nazikçe şirket konusuna geri döndürür." }
        ]
      },
      {
        tabTitle: "Sekme 7: Müşteri CRM Entegrasyonu & Harici API Araçları",
        badge: "AI Düzenle 7/8",
        screenshot: { src: "/screenshots/tabs/ai-agents/07-crm-entegrasyonu.jpg", caption: "AI Temsilcisi → Sekme 7: Asistanın canlı görüşmede kullanacağı CRM ve Evrensel API araçları", routeHint: "AI Temsilcileri → Müşteri CRM Entegrasyonu" },
        description: "Evrensel API Sihirbazı ile tanımlanan dış ERP/CRM/Sipariş/Randevu araçlarını asistana bağlar.",
        fields: [
          { name: "Bağlı API Araçları (Async Tool Execution Engine)", type: "Çoklu Araç Seçimi", defaultVal: "1007 Çökmesiz Mimari", required: false, effect: "AI görüşmede [ACTION: TOOL_CALL ...] ürettiğinde backend arka planda ERP/CRM'i sorgular ve sonucu konuşma kesilmeden AI'a sesli okutur." }
        ]
      },
      {
        tabTitle: "Sekme 8: Görsel Senaryo Akışı & AI Senaryo Asistanı",
        badge: "AI Düzenle 8/8",
        screenshot: { src: "/screenshots/tabs/ai-agents/08-gorsel-senaryo.jpg", caption: "AI Temsilcisi → Görsel Senaryo Editörü — Sürükle-bırak diyalog düğümleri, directory_lookup ve AI senaryo üretici", routeHint: "AI Temsilcileri → Görsel Senaryo Akışı" },
        description: "Asistanın adım adım diyalog ağacını görsel düğümlerle tasarladığınız ve doğal dil modalından tek tıkla üretebildiğiniz akış editörüdür.",
        fields: [
          { name: "Düğüm Tipleri", type: "Açılış / Diyalog / KVKK Onay / Niyet Dallanması / Form Toplama / İsimle Dahili Transferi (directory_lookup) / Hedefe Transfer / Kapanış", defaultVal: "Otomatik Prompt Derleyici", required: false, effect: "Kaydedildiğinde compile_agent_scenario_to_instruction ile yapısal doğal dil talimatına derlenip Gemini Live'a yüklenir." },
          { name: "AI Senaryo Asistanı (Doğal Dil Modalı)", type: "Türkçe Metin → Görsel Akış", defaultVal: "Hazır Şablonlu", required: false, effect: "Akışınızı paragraf halinde yazın; sistem tüm dalları, dahili numaralarını ve kapanış düğümlerini otomatik çizer." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 8.1: AI Senaryo Asistanı (Doğal Dil İle Akış Tasarımı Modalı)",
        badge: "Görsel Senaryo → AI İle Çiz",
        screenshot: { src: "/screenshots/tabs/deep/ai-scenario-assistant.jpg", caption: "AI Temsilcileri → Görsel Senaryo → 'AI ile Otomatik Çiz': Türkçe senaryo metnini anında düğümlere ve ok bağlantılarına çeviren modal", routeHint: "AI Temsilcileri → Görsel Senaryo → AI ile Otomatik Çiz" },
        description: "Görsel Senaryo Editöründe tek tek düğüm sürüklemek yerine akışınızı günlük Türkçe cümlelerle anlatarak tüm diyalog ağacını otomatik çizdiren 3. seviye penceredir.",
        fields: [
          { name: "Senaryo Açıklamanız (Türkçe Metin)", type: "Çok Satırlı Serbest Metin", defaultVal: "1–5 Maddeli Örnek Rehberli", required: true, effect: "POST /api/settings/ai-agents/generate-scenario üzerinden cümleleri, 'eğer/ise' dallanmalarını, KVKK onaylarını, 2000/1000 dahili transferlerini ve kapanışları düğüm JSON'una dönüştürür." },
          { name: "Örnek Hazır Senaryo Komutları (Tek Tıkla Doldur)", type: "Satış & KVKK Akışı / Arıza & Destek Kaydı / İsimle Dahili Rehber", defaultVal: "3 Hazır Kalıp", required: false, effect: "Başlangıç için sektörel hazır metni kutuya doldurur; üzerinde düzenleme yapıp 'Senaryoyu Çiz ve Oluştur'a bastığınızda kanvas otomatik çizilir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 8.2: Senaryo Düğümü Düzenleme & İsimle Dahili Transferi (directory_lookup)",
        badge: "Görsel Senaryo → Düğüm Düzenle",
        description: "Kanvastaki herhangi bir düğümün kalem ikonuna tıklandığında açılan ve düğümün konuşma metnini, koşul dallarını, toplanacak form alanlarını veya aktarım hedefini düzenleyen alt penceredir.",
        fields: [
          { name: "Düğüm Başlığı, Konuşma / Prompt Metni & Zorunlu Cümle", type: "Metin / KVKK / Diyalog", defaultVal: "Düğüm Tipine Özel", required: true, effect: "AI'ın bu adımda müşteriye söyleyeceği ana ifadeyi veya sorması gereken soruyu belirler." },
          { name: "İsimle Dahili / Personel Transferi (directory_lookup)", type: "Dinamik system_users Eşleşmesi", defaultVal: "[ACTION: TRANSFER:ext]", required: false, effect: "Aktif sistem rehberini Gemini'a otomatik yükler; müşteri 'Anıl Bey'le görüşmek istiyorum' dediğinde AI ilgili dahiliyi bulup Asterisk AMI üzerinden anında aktarır." },
          { name: "Form & Veri Toplama / CRM Webhook / Temsilciye Transfer / Sonlandırma", type: "Alan Listesi + Hedef Dahili/Kuyruk", defaultVal: "Async Tool / AMI Redirect", required: false, effect: "Müşteriden alınan ad-soyad, sipariş no veya randevu bilgisini ERP'ye yollar, kuyruğa aktarır veya nazik veda sonrası [ACTION: HANGUP] ile çağrıyı kapatır." }
        ]
      }
    ]
  },
  "bilgi-bankasi-rag": {
    editFormSections: [
      {
        tabTitle: "Sekme 1: Veri Kaynakları (İndekslenmiş Doküman Yönetimi)",
        badge: "RAG 1/5",
        screenshot: { src: "/screenshots/tabs/rag/01-kaynaklar.jpg", caption: "Bilgi Bankası (RAG) → Sekme 1: İndekslenmiş PDF, Web ve SSS kaynak listesi", routeHint: "Bilgi Bankası (RAG) → Veri Kaynakları" },
        description: "Yapay zekanın şu an aktif olarak kullandığı tüm bilgi kaynaklarını, parça (chunk) sayılarını ve son güncelleme tarihlerini yönetir.",
        fields: [
          { name: "Kaynak Arama & Silme", type: "Tablo + Tek Tık Temizle", defaultVal: "Tenant İzole", required: false, effect: "Eskimiş fiyat listelerini sildiğinizde ilişkili tüm vektör parçaları anında temizlenir." }
        ]
      },
      {
        tabTitle: "Sekme 2: Veri Ekleme (Web Crawler, PDF Yükleme & Manuel SSS)",
        badge: "RAG 2/5",
        screenshot: { src: "/screenshots/tabs/rag/02-veri-ekleme.jpg", caption: "Bilgi Bankası (RAG) → Sekme 2: Web sitesi tarama, PDF yükleme ve manuel SSS öğretme", routeHint: "Bilgi Bankası (RAG) → Veri Ekleme" },
        description: "Bilgi bankasına 3 farklı kaynaktan (Web URL, PDF doküman, Manuel metin/SSS) saniyeler içinde yeni veri öğretme ekranı.",
        fields: [
          { name: "Web Sitesi Tarama (URL Crawler)", type: "HTTPS URL", defaultVal: "verify=False SSL uyumlu", required: false, effect: "Kurumsal web sitenizi tarayıp temiz metin çıkarır ve otomatik parçalar." },
          { name: "PDF Belgesi & Manuel SSS Öğretme", type: "PDF + Konu Başlığı + Metin", defaultVal: "Anında Aktif", required: false, effect: "Katalog, garanti, şube adresi veya kampanya metinlerini saniyeler içinde AI'a öğretir." }
        ]
      },
      {
        tabTitle: "Sekme 3: AI Medya & Katalog (Otomatik Dosya Paylaşımı)",
        badge: "RAG 3/5",
        screenshot: { src: "/screenshots/tabs/rag/03-medya-katalog.jpg", caption: "Bilgi Bankası (RAG) → Sekme 3: AI Medya & Katalog — Gönderim koşuluna bağlı PDF/Görsel paylaşımı", routeHint: "Bilgi Bankası (RAG) → AI Medya & Katalog" },
        description: "Müşteri WhatsApp veya sohbet üzerinden broşür, fiyat listesi veya konum görseli istediğinde AI'ın otomatik göndereceği medya kütüphanesi.",
        fields: [
          { name: "Dosya Adı, AI Gönderim Koşulu & Medya Dosyası", type: "PDF / Görsel / Video / Ses", defaultVal: "Koşullu Gönderim", required: true, effect: "Örn. 'Müşteri 2026 ürün kataloğunu isterse bu PDF dosyasını gönder' talimatıyla otonom çalışır." }
        ]
      },
      {
        tabTitle: "Sekme 4: Vektör Arama Testi (Canlı Doğruluk Kontrolü)",
        badge: "RAG 4/5",
        screenshot: { src: "/screenshots/tabs/rag/04-vektor-test.jpg", caption: "Bilgi Bankası (RAG) → Sekme 4: Vektör Arama Testi — Gerçek müşteri sorusuyla eşleşme skoru kontrolü", routeHint: "Bilgi Bankası (RAG) → Vektör Arama Testi" },
        description: "Yüklediğiniz bilgilerin AI tarafından doğru bulunup bulunmadığını gerçek çağrı açmadan test ettiğiniz simülasyon ekranıdır.",
        fields: [
          { name: "Test Edilecek Müşteri Sorusu", type: "Canlı Anlamsal Sorgu", defaultVal: "/api/rag/search", required: true, effect: "Dönen ilk Top-K bilgi parçasını ve benzerlik yüzdesini (%) şeffaf olarak gösterir." }
        ]
      },
      {
        tabTitle: "Sekme 5: RAG Motoru & Parametreler (Tuning)",
        badge: "RAG 5/5",
        screenshot: { src: "/screenshots/tabs/rag/05-tuning.jpg", caption: "Bilgi Bankası (RAG) → Sekme 5: Chunk Size, Chunk Overlap, Top K ve Benzerlik Eşiği ayarları", routeHint: "Bilgi Bankası (RAG) → RAG Motoru & Parametreler" },
        description: "Doküman bölme ve vektör eşleştirme hassasiyetini yöneten mühendislik ayarları.",
        fields: [
          { name: "Metin Bölme Boyutu (Chunk Size) & Çakışma Oranı (Chunk Overlap)", type: "Karakter Sayısı", defaultVal: "800–1000 / 150–200", required: false, effect: "Parça bütünlüğünü koruyarak fiyat/ürün bilgilerinin bölünmeden eksiksiz getirilmesini sağlar." },
          { name: "Eşleşme Sayısı (Top K) & Asgari Benzerlik Eşiği", type: "Integer + 0.0–1.0", defaultVal: "Top K: 4 / Eşik: 0.65", required: false, effect: "AI'ın yanıt üretirken kaç parçayı bağlama alacağını ve alakasız sonuçların elenme barajını belirler." }
        ]
      }
    ]
  },
  "kural-ve-senaryo-editoru": {
    editFormSections: [
      {
        tabTitle: "Yeni Kural Tanımla & Aktif Yapay Zeka Kuralları Yönetimi",
        badge: "AI Kural Formu",
        description: "Soru-Cevap (FAQ) eşleşmesi, karakter talimatı ve eskalasyon kuralları ekleme/düzenleme ekranı.",
        fields: [
          { name: "Kural Türü", type: "Soru-Cevap (FAQ) / Karakter Talimatı / Eskalasyon", defaultVal: "FAQ", required: true, effect: "Belirli müşteri sorusuna kesin sabit yanıt veya tüm görüşmelerde geçerli davranış kuralı tanımlar." },
          { name: "Müşteri Konuşması (Anahtar Kelime) & Yapay Zeka Cevabı", type: "Metin + Cevap/Talimat", defaultVal: "Zorunlu", required: true, effect: "Örn. 'ürünlerin garantisi kaç yıl' → 'Ürünler mevzuat gereği 2 yıl üretici hatalarına karşı garantilidir.'" }
        ]
      }
    ]
  }
};
