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
        tabTitle: "Alt Ekran 2: Otoprovizyon Şablonları (.CFG / .XML Editörü)",
        badge: "Santral & Ağ 8/9",
        screenshot: { src: "/screenshots/tabs/settings/08-otoprovizyon-sablon.jpg", caption: "Sistem Ayarları → Otoprovizyon Şablonları — Marka/Model bazlı CFG/XML özelleştirme", routeHint: "Sistem Ayarları → Otoprovizyon Şablonları" },
        description: "Yealink, Fanvil, Grandstream, Cisco ve Snom telefonların kurumsal konfigürasyon şablonlarını düzenler.",
        fields: [
          { name: "Şablon Adı, Marka, Model & Konfigürasyon İçeriği", type: ".CFG / .XML + {{degisken}}", defaultVal: "Hazır Şablonlar", required: false, effect: "Dil, saat, NTP, zil sesi, şirket logosu ve BLF kurallarını model bazında özelleştirir." }
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
      }
    ]
  }
};
