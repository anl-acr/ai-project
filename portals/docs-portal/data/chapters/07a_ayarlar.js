export const CHAPTERS_YONETIM_A = [
  {
    id: "santral-entegrasyonu-ve-nat",
    number: "39",
    groupId: "yonetim",
    category: "Yönetim & Sistem Ayarları",
    title: "Santral Entegrasyonu (PJSIP/AMI), NAT & Dış IP ve Numara Planı",
    shortTitle: "Santral, NAT & Numara Planı",
    menuPath: "Yönetim & Ayarlar → Sistem Ayarları → Santral & Ağ (Santral Entegrasyonu / NAT / Numara Planı)",
    pbxRoute: "/?tab=ayarlar&subtab=santral-ayarlari",
    permissions: ["pbx:read", "pbx:write", "nat:read", "nat:write", "numbering_plan:read", "numbering_plan:write"],
    badge: "Asterisk AMI • PJSIP NAT • Özellik Kodları",
    readMinutes: 11,
    summary:
      "Nornia ile Asterisk çekirdeği arasındaki AMI (5038) bağlantısını, PJSIP Dinamik NAT & Dış IP enjeksiyonunu (external_signaling_address / external_media_address / local_net), santral genelindeki dahili/kuyruk/konferans numara aralıklarını ve tüm *XX özellik kodlarını (Feature Codes) yapılandırdığınız temel çekirdek ayarlarıdır.",
    screenshots: [
      {
        src: "/screenshots/37-settings-pbx.jpg",
        caption: "Sistem Ayarları → Santral Entegrasyonu, NAT & Dış IP ve Numara Planı yapılandırması",
        routeHint: "Sistem Ayarları → Santral & Ağ"
      }
    ],
    fieldTable: [
      { field: "Asterisk AMI Host / Port / Kullanıcı", type: "127.0.0.1:5038", defaultVal: "ai_backend_user", required: true, description: "Canlı çağrı izleme, Click-to-Call, Transfer, ChanSpy ve Presence olaylarını taşıyan Asterisk Manager Interface bağlantısı." },
      { field: "NAT Aktif & Dış IP (External IP)", type: "Boolean + IPv4", defaultVal: "Otomatik Algılama", required: false, description: "Kaydedildiğinde pjsip_custom.conf içindeki [transport-udp], [transport-tcp], [transport-ws] ve [transport-wss] bölümlerine otomatik yazılır." },
      { field: "Yerel Ağ Aralıkları (Local Nets)", type: "CIDR Listesi", defaultVal: "192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12", required: false, description: "LAN ve VPN alt ağlarında sesin dış IP yerine doğrudan iç IP'den akmasını sağlar." },
      { field: "Numara Planı Aralıkları", type: "Başlangıç–Bitiş", defaultVal: "Dahili: 1000-1999 | Kuyruk: 2000-2999 | Konferans: 3000-3999", required: true, description: "Yeni kayıt açılırken numara çakışmasını engeller ve dialplan desenlerini üretir." },
      { field: "Özellik Kodları (Feature Codes)", type: "*97, *9, *70, *74, *75, *76, *11", defaultVal: "Standart Set", required: true, description: "Sesli Posta (*97), Kayıt Duraklat (*9), Profil (*70), Patron-Sekreter (*74), Hot-Desk (*75/*76) ve Call Flip (*11) kodlarını kurumsal alışkanlıklarınıza göre özelleştirebilirsiniz." }
    ],
    sections: [
      {
        heading: "1. WebRTC & SIP NAT Altın Kuralları",
        body: "Nornia WebRTC endpoint'lerinde rewrite_contact=no standardını ve gerçek IPv4 viaHost çözümlemesini (/api/webrtc/config) otomatik yönetir; böylece SIP.js kayıt düşmesi veya tek yönlü ses problemleri yaşanmaz."
      }
    ],
    troubleshooting: [
      { problem: "Dışarıdan gelen çağrılarda 32. saniyede çağrı düşüyor", cause: "NAT ayarında eski veya yanlış Dış IP kalmış.", solution: "Sistem Ayarları → NAT ve Dış IP ekranında 'Dış IP'yi Otomatik Algıla' butonuna basıp kaydedin." }
    ],
    relatedPages: ["sunucu-ag-ve-nornia-connect", "dis-hat-tanimi", "kullanicilar"],
    relatedApis: ["GET /api/system/overview"]
  },
  {
    id: "sunucu-ag-ve-nornia-connect",
    number: "40",
    groupId: "yonetim",
    category: "Yönetim & Sistem Ayarları",
    title: "Sunucu Ağ (Netplan), Nornia Connect (Bulut Köprüsü) & Web SSH Terminali",
    shortTitle: "Ağ, Nornia Connect & SSH",
    menuPath: "Yönetim & Ayarlar → Sistem Ayarları → Sunucu Ağ Yönetimi / Nornia Connect / Web SSH",
    pbxRoute: "/?tab=ayarlar&subtab=nornia-connect",
    permissions: ["server_network:read", "server_network:write", "ras_settings:read", "ras_settings:write", "server_ssh:access"],
    badge: "Sıfır-Port Tünel • Netplan Rollback • WireGuard • Web SSH",
    readMinutes: 12,
    summary:
      "Linux sunucunun ağ kartlarını (IPv4/CIDR, Gateway, statik MPLS/SIP rotaları, DNS/hosts) otomatik 60 sn geri alma (rollback) güvencesiyle yönetmenizi, firewall'da tek port açmadan HTTPS + WebRTC + SIP Edge yayını yapan Nornia Connect (Sıfır-Port Bulut Köprüsü) tünelini kontrol etmenizi ve tarayıcı içinden doğrudan güvenli Web SSH terminaline bağlanmanızı sağlayan altyapı paketidir.",
    screenshots: [
      {
        src: "/screenshots/38-settings-ras.jpg",
        caption: "Nornia Connect (Sıfır-Port Bulut Köprüsü) — Kilitli alt alan adı (FQDN), HTTPS/WSS tünel durumu ve WireGuard SIP Edge",
        routeHint: "Sistem Ayarları → Nornia Connect (Bulut Köprüsü)"
      }
    ],
    fieldTable: [
      { field: "Ağ Arayüzleri (NIC) & 60 sn Onaylı Rollback", type: "Netplan Yönetimi", defaultVal: "Güvenli Mod", required: false, description: "Yanlış IP girilip sunucuya erişim kesilirse 60 saniye içinde onay gelmediği için sunucu otomatik eski çalışan IP'sine geri döner." },
      { field: "Statik Rotalar (SIP / MPLS)", type: "Hedef CIDR + Gateway + NIC", defaultVal: "Kalıcı Netplan", required: false, description: "Türk Telekom Metro Ethernet veya şubeler arası MPLS ağlarına özel statik rota ekler." },
      { field: "Nornia Connect Alt Alan Adı (Subdomain)", type: "<ad>.nornia.com.tr", defaultVal: "Merkez Panel Kilitli", required: true, description: "Santralinize port yönlendirme veya statik dış IP olmadan otomatik SSL'li https://<ad>.nornia.com.tr ve wss://<ad>.nornia.com.tr/ras-sip-ws erişimi sağlar." },
      { field: "WireGuard SIP Edge & TURN Rölesi", type: "Otomatik Şifreli Tünel", defaultVal: "Aktif", required: false, description: "Uzak IP masa telefonlarının (UDP/TCP 5060, Cisco 5160) merkez bulut köprüsü üzerinden şifreli şekilde yerel santrale ulaşmasını sağlar." },
      { field: "Sunucu Web SSH Terminali", type: "xterm.js", defaultVal: "Yetki: server_ssh:access", required: false, description: "Ek bir SSH istemcisine gerek kalmadan tarayıcı içinden Asterisk CLI, log inceleme ve Linux bakımı yapmanızı sağlar." }
    ],
    sections: [
      {
        heading: "1. Alt Alan Adı Kilidi ve Merkez Panel (panel.nornia.com.tr) Entegrasyonu",
        body: "Bir santral bir alt alan adını (örn. home2.nornia.com.tr) aldığında güvenlik gereği o donanıma kilitlenir; başka bir santral aynı adı alamaz ve Cross-Tenant trafik sızıntısı %100 engellenir. Alt alan adını değiştirmek için önce panel.nornia.com.tr'den 'Kilidi Çöz' butonuna basıp santralde 'Kilidi Sorgula'ya tıklamanız gerekir."
      }
    ],
    troubleshooting: [
      { problem: "https://<ad>.nornia.com.tr 502/503 döndürüyor", cause: "Nornia Connect tüneli henüz kurulmamış veya santralin internete HTTPS (443) çıkışı engelli.", solution: "Sistem Ayarları → Nornia Connect ekranında 'Tüneli Yeniden Başlat' butonuna basın ve bağlantı loglarını kontrol edin." }
    ],
    relatedPages: ["ilk-kurulum-sihirbazi", "santral-entegrasyonu-ve-nat", "cok-subeli-santral-federation"],
    relatedApis: ["GET /api/settings/ras/status", "POST /api/settings/ras/reconnect", "GET /api/settings/network/status"]
  },
  {
    id: "cok-subeli-santral-federation",
    number: "41",
    groupId: "yonetim",
    category: "Yönetim & Sistem Ayarları",
    title: "Çok-Şubeli Santral (Multi-Site Federation), Oto Provizyon Şablonları & SSL",
    shortTitle: "Çok-Şubeli, Şablonlar & SSL",
    menuPath: "Yönetim & Ayarlar → Sistem Ayarları → Çok-Şubeli Santral / Otoprovizyon Şablonları / SSL Sertifikaları",
    pbxRoute: "/?tab=ayarlar&subtab=cok-subeli-santral",
    permissions: ["federation_multisite:read", "federation_multisite:write", "autoprovision_templates:read", "autoprovision_templates:write", "ssl:read", "ssl:write"],
    badge: "Hub & Edge • SRST Failover • Custom CFG • TLS/WSS",
    readMinutes: 10,
    summary:
      "Birden fazla şehirde veya fabrikada şubesi bulunan kurumlar için Merkez (Hub) ↔ Şube (Edge) dağıtık santral mimarisini (internet kopsa bile yerel aramaların sürdüğü SRST Failover dahil), IP telefon XML/CFG şablon özelleştiricisini ve Let's Encrypt / özel kurumsal SSL sertifika yönetimini anlatır.",
    screenshots: [
      {
        src: "/screenshots/39-settings-federation.jpg",
        caption: "Çok-Şubeli Santral (Multi-Site Federation) — Standalone / Hub / Edge rol seçimi, şube sağlığı ve SRST Failover",
        routeHint: "Sistem Ayarları → Çok-Şubeli Santral (Multi-Site)"
      }
    ],
    fieldTable: [
      { field: "Sunucu Rolü", type: "Standalone / Hub (Merkez) / Edge (Şube)", defaultVal: "Standalone", required: true, description: "Hub tüm şubeleri merkezi yönetir ve CDR/ses kayıtlarını toplar; Edge şubedeki yerel telefonlara hizmet verir." },
      { field: "Medya & Failover Politikası", type: "active_local (Aktif-Yerel Edge) / srst_failover", defaultVal: "active_local", required: false, description: "active_local: Şube içi görüşme sesi merkeze gitmeden yerel LAN'da kalır. srst_failover: Merkezle WAN koparsa şube santrali otomatik devralır." },
      { field: "Anlık Konfigürasyon İtme (Push Config)", type: "Tek Tık Senkron", defaultVal: "Delta Sync", required: false, description: "Merkezde yapılan dahili/kural değişikliklerini tüm şube santrallerine anında dağıtır." },
      { field: "Otoprovizyon Şablonları", type: "Marka/Model CFG/XML Editörü", defaultVal: "Hazır Şablonlar", required: false, description: "Yealink, Fanvil, Grandstream, Cisco telefonların dil, saat, zil sesi, logo ve NTP parametrelerini özelleştirir." },
      { field: "SSL Sertifikaları", type: "fullchain.pem + privkey.pem", defaultVal: "Otomatik asterisk.pem", required: false, description: "Yüklenen kurumsal SSL sertifikasını hem Nginx (443) hem de Asterisk WSS (8089, /etc/asterisk/keys/asterisk.pem, chmod 644) için birleştirip uygular." }
    ],
    sections: [
      {
        heading: "1. Şube Santralleri Arası Tek Numara Planı ile Ücretsiz Arama",
        body: "Merkez (1000–1999), Ankara Şubesi (2000–2999) ve İzmir Şubesi (3000–3999) şifreli PJSIP trunk ile otomatik bağlanır; Ankara'daki 2005 numaralı telefon, İstanbul'daki 1010'u normal iç dahili gibi ücretsiz ve HD sesle arar."
      }
    ],
    troubleshooting: [
      { problem: "WebRTC 8089 WSS portu özel SSL sonrası açılmıyor", cause: "Özel anahtar (privkey) şifreli (passphrase'li) veya /etc/asterisk/keys/asterisk.pem okuma izni yok.", solution: "Passphrase içermeyen PEM dosyaları yükleyin; Nornia otomatik olarak fullchain+privkey birleştirip 644 izinle Asterisk'i yeniler." }
    ],
    relatedPages: ["oto-provizyon", "sunucu-ag-ve-nornia-connect"],
    relatedApis: ["GET /api/federation/node-config", "GET /api/federation/sites", "POST /api/federation/sites/{site_code}/push-config"]
  },
  {
    id: "roller-kvkk-ve-ldap",
    number: "42",
    groupId: "yonetim",
    category: "Yönetim & Sistem Ayarları",
    title: "Roller (RBAC), KVKK Gizlilik Onayı, Active Directory (LDAP), Lokasyon & Molalar",
    shortTitle: "Roller, KVKK, LDAP & Molalar",
    menuPath: "Yönetim & Ayarlar → Sistem Ayarları → Organizasyon & Lisans",
    pbxRoute: "/?tab=ayarlar&subtab=rol-ve-yetkiler",
    permissions: ["roles:read", "roles:write", "kvkk_consent:read", "kvkk_consent:write", "active_directory:read", "active_directory:write", "locations:read", "breaks:read"],
    badge: "Granüler Yetki • 6698 KVKK • AD/Entra ID SSO",
    readMinutes: 12,
    summary:
      "Kurumsal organizasyon ve uyumluluk çekirdeğidir: 60+ modül için Görüntüleme/Yazma/Silme (`:read` / `:write` / `:delete` / `:access`) granüler Rol & Yetki matrisi, 6698 sayılı KVKK metni ve değiştirilemez hukuki kullanıcı onay denetimi, Microsoft Active Directory / Azure Entra ID / OpenLDAP / FreeIPA kullanıcı eşitleme, Lokasyon-Departman ağacı ve Mola Tanımlarını içerir.",
    screenshots: [
      {
        src: "/screenshots/40-settings-roles.jpg",
        caption: "Sistem Ayarları → Roller (RBAC) — Modül bazlı granüler okuma/yazma/silme ve Temsilci Paneli alt sekme yetkileri",
        routeHint: "Sistem Ayarları → Roller"
      }
    ],
    fieldTable: [
      { field: "Rol & Yetki Matrisi (roles)", type: ":read / :write / :delete / :access", defaultVal: "Admin / Süpervizör / Temsilci", required: true, description: "Her modül ve Temsilci Panelindeki her tekil sekme (Ses Kaydı Dinleme, Transfer, Call Flip, Diğer Agent Süreleri vb.) ayrı ayrı açılıp kapatılabilir." },
      { field: "KVKK & Gizlilik Onayı (kvkk-consent)", type: "Sürüm + Zorunlu Onay + Hukuki Log", defaultVal: "Sürüm v1.0", required: false, description: "Metin güncellendiğinde tüm kullanıcılar (Admin dahil) oturum açtığında onay ekranını görür; IP, zaman damgası ve metin hash'i değiştirilemez denetim tablosuna kaydedilir." },
      { field: "Active Directory / LDAP (active-directory)", type: "Microsoft AD / Azure Entra / OpenLDAP / FreeIPA", defaultVal: "Opsiyonel", required: false, description: "Kurumsal dizindeki personelleri tek tıkla veya periyodik olarak Nornia'ya aktarır ve şirket şifresiyle giriş (LDAP Auth) sağlar." },
      { field: "Lokasyon ve Departmanlar (locations)", type: "Hiyerarşik Liste", defaultVal: "Merkez / Departmanlar", required: false, description: "Toplu Konfigürasyon, Kullanıcı kartı ve Departman Raporlarında filtreleme ekseni olarak kullanılır." },
      { field: "Mola Tanımları (breaks)", type: "Ad + Günlük Limit (dk) + Renk", defaultVal: "Yemek, İhtiyaç, Eğitim, Toplantı", required: false, description: "Temsilcilerin seçebileceği mola türlerini, süre limitlerini ve Wallboard renklerini belirler." }
    ],
    sections: [
      {
        heading: "1. En Az Yetki (Least Privilege) Rol Tasarımı",
        body: "Önerilen kurumsal rol hiyerarşisi: (1) Sistem Yöneticisi (Tam Yetki); (2) Çağrı Merkezi Süpervizörü (Canlı İzleme + Listen/Whisper/Barge + Kendi Kuyruk Raporları + Mola Onayı); (3) Kalite Uzmanı (Sadece Ses Kayıtları + Transkript + QA Raporları); (4) Temsilci (Yalnızca Temsilci Çağrı Paneli + Ortak Gelen Kutusu)."
      }
    ],
    troubleshooting: [
      { problem: "Active Directory 'Bağlantı Testi' başarısız oluyor", cause: "Bind DN formatı hatalı veya 389/636 portu firewall'da kapalı.", solution: "Bind DN'i 'CN=svc_pbx,OU=Services,DC=sirket,DC=local' veya 'svc_pbx@sirket.local' formatında girin; LDAPS (636) kullanıyorsanız sertifika doğrulamasını kontrol edin." }
    ],
    relatedPages: ["kullanicilar", "temsilci-cagri-paneli", "temsilci-performans-mola-puantaj"],
    relatedApis: ["GET /api/v1/extensions"]
  },
  {
    id: "musteri-ve-lisans-yonetimi",
    number: "43",
    groupId: "yonetim",
    category: "Yönetim & Sistem Ayarları",
    title: "Müşteri (Multi-Tenant) Yönetimi, Donanım Kilidi & Lisans Yenileme",
    shortTitle: "Müşteri & Lisans Yönetimi",
    menuPath: "Yönetim & Ayarlar → Sistem Ayarları → Müşteri (Tenant) Yönetimi / Lisans & Key Yönetimi",
    pbxRoute: "/?tab=ayarlar&subtab=musteri-lisanslari",
    permissions: ["tenants:read", "tenants:write", "tenant_license:read", "tenant_license:write"],
    badge: "Multi-Tenant İzolasyon • HW-ID • HMAC-SHA256",
    readMinutes: 9,
    summary:
      "Aynı Nornia sunucusunda birden fazla şirket/grup firmasını %100 veritabanı izolasyonuyla (15 PostgreSQL tablosunda katı tenant_id ayrımı) barındırmayı, donanım parmak izine (HW-XXXX-XXXX) kilitli kriptografik HMAC-SHA256 lisans anahtarlarını doğrulamayı ve kesintisiz lisans yenilemeyi yöneten modüldür.",
    screenshots: [
      {
        src: "/screenshots/41-settings-license.jpg",
        caption: "Lisans & Key Yönetimi — Sunucu Donanım Kimliği (HW-ID), aktif kotalar, kalan gün ve tek tıkla lisans yenileme",
        routeHint: "Sistem Ayarları → Lisans & Key Yönetimi"
      }
    ],
    fieldTable: [
      { field: "Sunucu Donanım Kimliği (Hardware ID)", type: "HW-XXXX-XXXX (Salt Okunur)", defaultVal: "DMI + Machine-ID + MAC", required: true, description: "Klonlama ve izinsiz kopyalamaya karşı anakart/disk/NIC parmak izinden üretilir." },
      { field: "Lisans Anahtarı Biçimi", type: "AIDA-{KOD}-{YYYYMMDD}-{HW8}-{SIG8}[.KOTA]", defaultVal: "HMAC-SHA256 İmzalı", required: true, description: "Bitiş tarihi, donanım kilidi ve şifreli kota/modül matrisini (max_users, max_concurrent_calls, allowed_features) tek anahtarda taşır." },
      { field: "Aktif Lisans Kotaları", type: "Kullanıcı / Eşzamanlı Çağrı / Trunk / Kuyruk / AI", defaultVal: "Lisans Paketine Göre", required: false, description: "Her kaynağın anlık kullanım / tavan oranını çubuk grafikle gösterir." },
      { field: "Çoklu Müşteri (Multi-Tenant)", type: "İzole Tenant Kayıtları", defaultVal: "Tek tenantta gizli switcher", required: false, description: "Sunucuda yalnızca 1 müşteri varsa üstteki 'AKTİF SİSTEM' seçicisi sade görünüm için gizlenir; 2+ müşteri eklendiğinde otomatik görünür." }
    ],
    sections: [
      {
        heading: "1. Lisans Yenileme ve Merkez Panel (panel.nornia.com.tr) Senkronizasyonu",
        body: "Lisansınız Merkez Lisans Paneli'nden uzatıldığında sunucu arka plan telemetri servisi (telemetry_worker) yeni anahtarı otomatik çekip kesintisiz yenileyebilir veya çevrimdışı (air-gapped) ortamlarda 'Yeni Lisans Anahtarı Gir' penceresinden manuel yapıştırabilirsiniz."
      }
    ],
    troubleshooting: [
      { problem: "Sunucuyu yeni sanallaştırma hostuna taşıdım, lisans 'Pasif' oldu", cause: "VM taşıma/klonlama sonrası anakart UUID (HW-ID) değişti ve kriptografik donanım kilidi devreye girdi.", solution: "Lisans ekranındaki yeni HW-XXXX-XXXX kodunu sistem sağlayıcınıza iletip yeni donanım için yenilenmiş anahtarı girin." }
    ],
    relatedPages: ["ilk-kurulum-sihirbazi", "sistem-panosu-ve-saglik"],
    relatedApis: ["GET /api/v1/system/capacity", "GET /api/system/overview"]
  },
  {
    id: "yapay-zeka-ayar-ve-yonlendirme",
    number: "44",
    groupId: "yonetim",
    category: "Yönetim & Sistem Ayarları",
    title: "Yapay Zeka API Sağlayıcıları, Model Yönlendirme, QA, Dil, Duygu, Fısıldama, Biyometri & ROI",
    shortTitle: "Yapay Zeka & Analiz Ayarları",
    menuPath: "Yönetim & Ayarlar → Sistem Ayarları → Yapay Zeka & Analiz (8 Alt Ekran)",
    pbxRoute: "/?tab=ayarlar&subtab=yapay-zeka-saglayicilari",
    permissions: ["ai_providers:write", "ai_task_routing:write", "qa:write", "lang_detect:write", "emotion_management:write", "ai_whisper:write", "voice_biometrics:write", "roi_settings:write"],
    badge: "8 AI Ayar Ekranı • Yerel LLM • Biyometri • ROI",
    readMinutes: 12,
    summary:
      "Nornia'nın tüm yapay zeka motorlarını kontrol eden 8 kurumsal ayar ekranını birleştirir: Yapay Zeka API Sağlayıcıları (Gemini, OpenAI, ElevenLabs, Deepgram, Anthropic, Groq, Ollama), AI Görev & Model Yönlendirme (maliyet optimizasyonu), Çağrı Kalite Kontrol (QA) Kriterleri, Otomatik Dil Algılama, Dinamik Duygu Yönetimi, AI Fısıldama, Biyometrik Ses Analizi (Voiceprint) ve ROI Maliyet Parametreleri.",
    screenshots: [
      {
        src: "/screenshots/42-settings-ai-providers.jpg",
        caption: "Yapay Zeka API Ayarları — Sağlayıcı anahtarları (maskeli güvenli saklama), bağlantı testi ve model yönlendirme",
        routeHint: "Sistem Ayarları → Yapay Zeka API Ayarları"
      }
    ],
    fieldTable: [
      { field: "Yapay Zeka API Sağlayıcıları", type: "API Key + Bağlantı Testi", defaultVal: "Gemini / OpenAI / ElevenLabs / Deepgram / Groq / Anthropic", required: true, description: "Girilen anahtarlar veritabanında güvenli saklanır; arayüzde maskelenir." },
      { field: "AI Görev & Model Yönlendirme (ai-task-routing)", type: "Görev → Model Eşleşmesi", defaultVal: "Hibrit Bulut / Yerel LLM", required: false, description: "Canlı sesli görüşme, transkript, QA puanlama, özetleme ve özel rapor görevlerini farklı modellere (veya şirket içi Ollama/vLLM yerel sunucusuna) atayarak token tasarrufu ve KVKK veri mahremiyeti sağlar." },
      { field: "Çağrı Kalite Kontrol (QA)", type: "Soru + Kategori + Ağırlık Puanı", defaultVal: "Toplam 100 Puan", required: false, description: "AI denetçinin her çağrıda kontrol edeceği kurumsal kalite soru havuzu." },
      { field: "Otomatik Dil Algılama & Dinamik Duygu", type: "Eşik & Aksiyon", defaultVal: "TR/EN/DE/AR/RU", required: false, description: "Arayanın konuştuğu dili ilk cümlede algılayıp AI dilini değiştirir; öfke skoru eşiği aşarsa Kriz Alarmı tetikler." },
      { field: "AI Fısıldama (AI Whisper)", type: "Canlı Temsilci Koçluğu", defaultVal: "Opsiyonel", required: false, description: "İnsan temsilci konuşurken AI müşterinin sorusunu RAG'da bulup ekrana anlık yanıt önerisi fısıldar." },
      { field: "Biyometrik Ses Analizi (Voiceprint)", type: "Ses İmzası Doğrulama", defaultVal: "Eşik: %80", required: false, description: "Kayıtlı VIP/bankacılık müşterilerini ses tonundan saniyeler içinde tanır veya dolandırıcı ses uyarısı verir." },
      { field: "ROI Rapor Ayarları", type: "Saatlik Temsilci Maliyeti (TL/$)", defaultVal: "Özelleştirilebilir", required: false, description: "AI vs. İnsan ROI raporundaki aylık tasarruf hesabının finansal baz değerleri." }
    ],
    sections: [
      {
        heading: "1. Yerel LLM (On-Premise Ollama / vLLM) ile KVKK Tam Veri Egemenliği",
        body: "Bankacılık, sağlık ve kamu kurumları, çağrı transkript ve QA analizlerinin yurt dışı bulut API'lere hiç çıkmaması için 'AI Görev & Model Yönlendirme' ekranından yerel sunucuda çalışan Ollama/vLLM uç noktasını (örn. http://192.168.1.90:11434) atayabilir."
      }
    ],
    troubleshooting: [
      { problem: "AI sağlayıcı testi '401/403' hatası veriyor", cause: "API anahtarı süresi dolmuş, kredi bakiyesi bitmiş veya kopyalanırken başında/sonunda boşluk kalmış.", solution: "Anahtarı sağlayıcı konsolundan teyit edip yeniden yapıştırın ve 'Bağlantıyı Test Et' ile yeşil onay alın." }
    ],
    relatedPages: ["ai-temsilcileri", "api-butce-ve-tuketim", "ai-analitik-duygu-niyet-qa"],
    relatedApis: ["GET /api/qa/questions", "POST /api/qa/questions", "POST /api/live-translator/translate-text"]
  }
];
