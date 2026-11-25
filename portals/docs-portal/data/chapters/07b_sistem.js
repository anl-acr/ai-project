export const CHAPTERS_YONETIM_B = [
  {
    id: "kanallar-crm-ve-dis-api",
    number: "45",
    groupId: "yonetim",
    category: "Yönetim & Sistem Ayarları",
    title: "Kanallar (WhatsApp/Telegram/Meta/E-Posta), CRM, Hızlı Cevap, Evrensel & Dış API",
    shortTitle: "Kanallar, CRM & Dış API",
    menuPath: "Yönetim & Ayarlar → Sistem Ayarları → Kanallar & Entegrasyon (6 Alt Ekran)",
    pbxRoute: "/?tab=ayarlar&subtab=dis-api-ve-anahtar-yonetimi",
    permissions: ["channels:write", "crm_integrations:write", "canned_responses:write", "universal_api:write", "api_management:write", "email_notifications:write"],
    badge: "Meta Cloud API • CRM Market • API Key & Scope • SMTP",
    readMinutes: 13,
    summary:
      "Santralin dış dünyayla tüm yazılı ve programatik entegrasyonlarını yöneten 6 kritik ayar ekranıdır: Çoklu Hat WhatsApp Business / Telegram / Instagram / Facebook / IMAP-SMTP Kanal Entegrasyonları, Hazır CRM Entegrasyon Marketi (Zoho, HubSpot, Salesforce, Bitrix24), Hızlı Cevaplar, AI için Evrensel API Sihirbazı, Kurumsal Dış REST API & Token Yönetimi ve E-Posta Bildirimleri.",
    screenshots: [
      {
        src: "/screenshots/43-settings-api-management.jpg",
        caption: "Kurumsal Dış API & Anahtar (Token) Yönetimi — Scope yetkileri, IP Whitelist, Rate Limit, Webhook ve canlı erişim logları",
        routeHint: "Sistem Ayarları → Kurumsal Dış API & Token Yönetimi"
      }
    ],
    fieldTable: [
      { field: "WhatsApp Çoklu Hat (whatsapp_accounts)", type: "Phone Number ID + Permanent Token + Persona", defaultVal: "Meta Graph v18.0", required: false, description: "Her numara (örn. Satış 0850... / Destek 0850...) için ayrı AI Persona (samimi/satis/destek/kurumsal), 3 butonlu karşılama menüsü ve mesai dışı yanıt tanımlanabilir." },
      { field: "Telegram / Meta Direct / E-Posta (IMAP+SMTP)", type: "Bot Token / Page Token / IMAP 30 sn Poller", defaultVal: "Aktif Edilebilir", required: false, description: "Tüm kanalları Ortak Gelen Kutusu'na bağlar. IMAP poller her 30 saniyede okunmamış e-postaları otomatik sohbete dönüştürür." },
      { field: "Hazır CRM Marketi (crm-integrations)", type: "Zoho / HubSpot / Salesforce / Bitrix24 / Özel CTI", defaultVal: "Tek Tık Bağlayıcı", required: false, description: "Çağrı çaldığında CRM müşteri kartını otomatik açar (Screen Pop) ve görüşme bitince CDR + ses kaydı linkini CRM aktivitesine işler." },
      { field: "Evrensel API Sihirbazı (universal-api)", type: "Dış REST Araç Tanımı", defaultVal: "AI Tool Engine", required: false, description: "Kendi ERP'nizdeki sipariş/kargo/borç sorgulama API'sini kod yazmadan tanımlarsınız; AI Sesli Asistan görüşme sırasında canlı sorgular." },
      { field: "Kurumsal Dış API & Token (api-management)", type: "aida_live_... + Scope + IP Whitelist + Rate Limit", defaultVal: "120 istek/dk", required: false, description: "api.nornia.com.tr üzerinde belgelenen tüm REST v1 uç noktaları için SHA-256 hash'li anahtarlar üretir, IP kısıtlar ve canlı erişim loglarını tutar." },
      { field: "E-Posta Bildirimleri (email-notifications)", type: "SMTP SSL/TLS + Olay Tetikleyicileri", defaultVal: "Port 587 / 465", required: false, description: "Sesli posta, zamanlanmış rapor, bütçe uyarısı, lisans yenileme ve güvenlik alarmlarının gideceği kurumsal SMTP ayarları." }
    ],
    sections: [
      {
        heading: "1. WhatsApp Meta Cloud API Webhook Kurulum Adımları",
        body: "Meta Developers Console → WhatsApp → Configuration ekranında şu bilgileri girmeniz yeterlidir:",
        codeBlock: {
          title: "Meta WhatsApp & Instagram Webhook URL Yapısı",
          lang: "text",
          code: `Callback URL : https://<alt-alan-adiniz>.nornia.com.tr/api/webhooks/whatsapp
Verify Token : ai_pbx_whatsapp_verify_token_secure  (veya Kanal Ayarlarındaki özel token)
Webhook Fields: messages`
        }
      }
    ],
    troubleshooting: [
      { problem: "Dış API anahtarı ile istek atınca '403 Forbidden' alıyorum", cause: "Anahtarda o uç noktanın gerekli Scope yetkisi işaretli değil veya sunucu IP'si IP Whitelist listesinde yok.", solution: "Sistem Ayarları → Kurumsal Dış API → Canlı Erişim Günlüğü sekmesinde tam reddedilme gerekçesini okuyup Scope/IP ayarını güncelleyin." }
    ],
    relatedPages: ["ortak-gelen-kutusu", "omnichannel-memnuniyet-anketi-csat", "otel-ve-pms-yonetim-merkezi", "ai-temsilcileri"],
    relatedApis: ["GET /api/v1/status", "POST /api/v1/webhooks/subscribe", "POST /api/cti/lookup", "GET /api/webhooks/whatsapp"]
  },
  {
    id: "omnichannel-memnuniyet-anketi-csat",
    number: "46",
    groupId: "yonetim",
    category: "Yönetim & Sistem Ayarları",
    title: "Omnichannel Memnuniyet Anketi (CSAT — WhatsApp, Telegram, Meta & E-Posta)",
    shortTitle: "Omnichannel CSAT",
    menuPath: "Yönetim & Ayarlar → Sistem Ayarları → Kanallar & Entegrasyon → Omnichannel Memnuniyet Anketi (CSAT)",
    pbxRoute: "/?tab=ayarlar&subtab=omnichannel-csat",
    permissions: ["omnichannel_csat:read", "omnichannel_csat:write"],
    badge: "WhatsApp Buton • Telegram Inline • Meta Quick Reply • AI vs İnsan",
    readMinutes: 9,
    summary:
      "WhatsApp, Telegram, Instagram DM, Facebook Messenger ve E-Posta kanallarındaki sohbetler çözüldü olarak kapatıldığında müşteriye kanalın kendi etkileşimli butonlarıyla (ücretsiz 24 saatlik müşteri hizmet penceresi içinde) otomatik memnuniyet anketi gönderir; düşük puanlarda takip sorusu ile süpervizöre anlık alarm üretir ve AI vs. İnsan Temsilci CSAT karnesi sunar.",
    screenshots: [],
    fieldTable: [
      { field: "Omnichannel CSAT Motoru & Kapanışta Tetikleme", type: "Toggle (enabled / trigger_on_close)", defaultVal: "Aktif", required: false, description: "Ortak Gelen Kutusu'nda bir sohbet 'Çözüldü / Kapat' yapıldığında anketi otomatik gönderir." },
      { field: "Aktif Anket Kanalları", type: "Çoklu Seçim", defaultVal: "WhatsApp, Telegram, Instagram, Facebook, E-Posta", required: false, description: "WhatsApp'ta Interactive Quick Reply butonları, Telegram'da InlineKeyboard, Meta'da Quick Reply ve E-Posta'da tek tık puanlama bağlantısı (/api/omnichannel/csat/rate/{id}) kullanılır." },
      { field: "Soğuma Süresi — Cooldown (Saat)", type: "Integer (0–720)", defaultVal: "24 Saat", required: false, description: "Aynı müşteriye belirtilen süre içinde ikinci kez anket gönderilerek rahatsız edilmesini önler (0 = her kapatmada gönder)." },
      { field: "Süpervizör Alarm Eşiği & Düşük Puan Takip Sorusu", type: "Seçim (≤1 / ≤2 / ≤3) + Metin", defaultVal: "≤ 2 Puan", required: false, description: "Eşik altı puan veren müşteriye 'Yaşadığınız aksaklığı kısaca yazar mısınız?' sorusu gider; yanıtı kaydedilir ve süpervizörlere WebSocket üzerinden anlık uyarı düşer." },
      { field: "Rapor & Skorlar Sekmesi (7 / 30 / 90 Gün)", type: "Canlı KPI & Tablo", defaultVal: "Son 30 Gün", required: false, description: "Ortalama CSAT, katılım oranı, AI Asistan vs. İnsan Temsilci ortalama puan kıyaslaması, kanal bazlı dağılım ve müşteri yorum listesi." }
    ],
    sections: [
      {
        heading: "1. Müşteri Yanıt Yakalama (Yeni AI Bileti Açmadan Puanlama)",
        body: "Müşteri anket butonuna bastığında veya 1–5 arası puan yazdığında, Nornia'nın chat_service katmanı bu yanıtı anket cevabı olarak yakalar, yeni bir AI sohbeti başlatmadan veritabanına (omnichannel_csat_surveys) işler ve teşekkür/takip mesajını iletir. Düşük puanlarda 20 dakika içinde gelen açıklama mesajı da otomatik olarak ilgili anketin yorum alanına eklenir.",
        codeBlock: {
          title: "Omnichannel CSAT REST Uç Noktaları",
          lang: "text",
          code: `GET  /api/settings/omnichannel-csat          # Anket yapılandırmasını getir
POST /api/settings/omnichannel-csat          # Anket yapılandırmasını kaydet
GET  /api/omnichannel/csat/stats?days=30     # Kanal & AI vs İnsan CSAT raporu
POST /api/omnichannel/chats/{id}/send-csat   # Seçili sohbete manuel anket gönder
GET  /api/omnichannel/csat/rate/{survey_id}?score=5  # E-posta tek tık puanlama`
        }
      }
    ],
    troubleshooting: [
      { problem: "Sohbeti kapattım ama WhatsApp'a anket gitmedi", cause: "Aynı numaraya son 24 saat içinde anket gönderilmiş (Cooldown aktif) veya WhatsApp kanalı anket kanalları listesinde seçili değil.", solution: "Ayarlar → Omnichannel Memnuniyet Anketi → Anket Ayarları sekmesinden Cooldown süresini ve aktif kanalları kontrol edin." },
      { problem: "E-posta anketindeki puanlama linkleri açılmıyor", cause: "Genel URL (public_base_url) veya Nornia Connect alt alan adı tanımlı değil.", solution: "Nornia Connect tünelini aktif edin veya CSAT ayarlarında genel erişim adresinizi belirtin." }
    ],
    relatedPages: ["ortak-gelen-kutusu", "kanallar-crm-ve-dis-api", "rapor-anket"],
    relatedApis: ["GET /api/omnichannel/csat/stats", "POST /api/settings/omnichannel-csat", "POST /api/omnichannel/chats/{session_id}/send-csat"]
  },
  {
    id: "otel-ve-pms-yonetim-merkezi",
    number: "47",
    groupId: "yonetim",
    category: "Yönetim & Sistem Ayarları",
    title: "Otel & PMS Yönetim Merkezi (Check-In/Out, AI Uyandırma, Kat Hizmetleri, ElektraWeb & FIAS)",
    shortTitle: "Otel & PMS Merkezi",
    menuPath: "Yönetim & Ayarlar → Sistem Ayarları → Kanallar & Entegrasyon → Otel & PMS Yönetim Merkezi",
    pbxRoute: "/?tab=ayarlar&subtab=otel-pms",
    permissions: ["hotel_pms:read", "hotel_pms:write", "hotel_pms:delete"],
    badge: "Check-In/Out • *71-*74 • AI *55 Uyandırma • ElektraWeb • FIAS OPERA",
    readMinutes: 14,
    summary:
      "Oteller, tatil köyleri ve hastaneler için eksiksiz Otel Santrali ve PMS (Property Management System) köprü modülüdür. Bağımsız çalışabildiği gibi ElektraWeb REST API, Oracle OPERA / Protel / Fidelio FIAS (TCP/IP) ve Open PMS API ile çift yönlü haberleşerek Check-In/Check-Out dış arama kilidi, kat hizmetleri (*71–*74), 6 dilde kişiselleştirilmiş AI uyandırma (*55), oda-arası arama kısıtlama ve çağrı ücretlendirme (Folio) süreçlerini otomatikleştirir.",
    screenshots: [],
    fieldTable: [
      { field: "Sekme 1: Oda Panosu (Check-In / Check-Out)", type: "Oda Kartları + Tek Tık İşlem", defaultVal: "Boş Oda = Dış Arama Kilitli", required: true, description: "Check-In ile odanın dış araması açılır ve misafir adı CallerID'ye yazılır. Check-Out ile dış arama kilitlenir (112 ve Resepsiyon hariç), uyandırmalar ve sesli mesajlar (voicemail) silinir, DND sıfırlanır, oda Kirli işaretlenir ve Folio hesabı çıkarılır." },
      { field: "Kat Hizmetleri (Housekeeping) Telefon Kodları", type: "Asterisk Dialplan (*71–*74)", defaultVal: "*71 Temiz, *72 Kirli, *73 Arıza, *74 Onaylı", required: false, description: "Kat görevlisi oda telefonundan kodu tuşladığında onay bip sesi alır; resepsiyon panosu ve bağlı PMS (ElektraWeb / FIAS) anlık güncellenir." },
      { field: "Sekme 2: AI Çok Dilli Uyandırma (*55 / *56)", type: "edge-tts (TR/EN/DE/RU/AR/FR) + AMI Originate", defaultVal: "2 Tekrar (5 dk) + Resepsiyon Alarmı", required: false, description: "Misafir oda telefonundan *55 + 4 haneli saat (örn. 0730) tuşlayarak veya resepsiyondan uyandırma kurar (*56 iptal eder). Saatinde misafirin kendi dilinde AI sesli uyandırma yapılır; yanıt alınmazsa 5 dk arayla tekrar dener ve hâlâ açılmazsa Resepsiyona kırmızı alarm düşer." },
      { field: "Oda-Arası Arama Kısıtlama & Aile Grubu", type: "ACL Politikası (block_room_to_room)", defaultVal: "Aktif (Aynı Aile Grubu Serbest)", required: false, description: "Misafir odalarının birbirini rahatsız etmesini engeller; aynı Aile/Grup koduna sahip bağlantılı odalar birbirini serbestçe arayabilir." },
      { field: "Sekme 3: Ücretlendirme & Folio (Call Accounting)", type: "Şehir İçi / GSM / Uluslararası + Minibar", defaultVal: "TRY / EUR / USD", required: false, description: "Oda dahililerinden yapılan tüm dış aramalar dakika tarifesine göre otomatik hesaplanıp oda foliosuna işlenir; Check-Out'ta toplam tutar PMS'e gönderilir." },
      { field: "Sekme 4: ElektraWeb / FIAS (OPERA & Fidelio) / Open PMS API", type: "REST Webhook + TCP/IP STX/ETX + X-PMS-API-Key", defaultVal: "FIAS Port 5008 (Sunucu/İstemci)", required: false, description: "ElektraWeb için REST Webhook, Oracle OPERA/Protel/Fidelio için canlı FIAS TCP/IP köprüsü (LS/LA/GI/GO/GC/RE/WR/WA/PS) ve Sedna/HMS/Mod Hotel için Open PMS API." }
    ],
    sections: [
      {
        heading: "1. Oda Telefonu Özellik Kodları (Asterisk Dialplan)",
        body: "Otel modülü aktif edildiğinde tüm oda dahilileri (IP telefon veya analog ATA gateway) aşağıdaki kısa kodları doğrudan tuşlayabilir:",
        codeBlock: {
          title: "Otel Oda Telefonu Kısa Kodları",
          lang: "text",
          code: `*71  -> Kat Hizmetleri: Oda Temiz (Hazır)
*72  -> Kat Hizmetleri: Oda Kirli (Temizlik Bekliyor)
*73  -> Kat Hizmetleri: Oda Arıza / Teknik Bakım Gerekli
*74  -> Kat Hizmetleri: Oda Kontrol Edildi (Onaylı)
*55  -> Uyandırma Kur (Bip sesinden sonra 4 hane saat: örn. 0730)
*56  -> Aktif Oda Uyandırmasını İptal Et`
        }
      },
      {
        heading: "2. FIAS (OPERA / Protel / Fidelio) & Open PMS REST API Örnekleri",
        body: "FIAS köprüsü hem TCP Sunucu (OPERA santrale bağlanır) hem TCP İstemci (santral OPERA IFC'ye bağlanır) modunu destekler. Yerel PMS yazılımları için ise X-PMS-API-Key başlığı ile doğrudan REST entegrasyonu kullanılabilir:",
        codeBlock: {
          title: "Open PMS REST API & FIAS Çerçeve Yapısı",
          lang: "bash",
          code: `# Open PMS REST Check-In (Sedna / HMS / Mod Hotel / Özel PMS)
curl -X POST https://<alt-alan-adiniz>.nornia.com.tr/api/pms/checkin \\
  -H "X-PMS-API-Key: <OPEN_API_KEY>" -H "Content-Type: application/json" \\
  -d '{"room_number":"304","guest_name":"Ahmet Yilmaz","guest_language":"tr","reservation_code":"RES-9921"}'

# Open PMS REST Check-Out & Folio
curl -X POST https://<alt-alan-adiniz>.nornia.com.tr/api/pms/checkout \\
  -H "X-PMS-API-Key: <OPEN_API_KEY>" -H "Content-Type: application/json" \\
  -d '{"room_number":"304"}'

# FIAS TCP/IP Desteklenen Çerçeveler (STX 0x02 ... ETX 0x03)
# GI|RN304|GNAhmet Yilmaz|GLTR|G#9921|   (Check-In)
# GO|RN304|                              (Check-Out)
# RE|RN304|RS2|                          (Kat Hizmetleri: 1=Kirli, 2=Temiz, 4=Onaylı, 5=Arıza)
# WR|RN304|TI0730|                       (Uyandırma Talebi)
# PS|RN304|TA1250|PT1|                   (Folio Ücret Aktarımı - Kuruş)`
        }
      }
    ],
    troubleshooting: [
      { problem: "Check-In yapılan odadan dış arama yapılamıyor", cause: "Check-In formunda 'Dış Arama Açık' kutusu işaretsiz bırakılmış veya santralde genel giden arama kuralı tanımlı değil.", solution: "Oda Panosu'ndan ilgili odanın 'Dış Arama Açık' rozetini kontrol edin; acil durum (112) ve resepsiyon aramaları her zaman serbesttir." },
      { problem: "FIAS bağlantısı 'Dinliyor' görünüyor ama OPERA bağlanmıyor", cause: "Sunucu güvenlik duvarında (UFW) 5008/TCP portu PMS sunucusunun IP adresine açılmamış.", solution: "FIAS TCP portunu (varsayılan 5008/TCP) yalnızca yerel ağdaki OPERA/Protel IFC sunucusunun IP adresine izin vererek açın." }
    ],
    relatedPages: ["kanallar-crm-ve-dis-api", "giden-arama-kurali", "dis-hat-tanimi"],
    relatedApis: ["POST /api/pms/checkin", "POST /api/pms/checkout", "POST /api/pms/housekeeping", "POST /api/pms/wakeup", "GET /api/pms/folio/{room_number}", "POST /api/pms/elektra/webhook"]
  },
  {
    id: "bakim-yedekleme-ve-kayit-saklama",
    number: "46",
    groupId: "yonetim",
    category: "Yönetim & Sistem Ayarları",
    title: "Tarih/Saat, Sistem Yedekleme, Geri Yükleme Noktası, Kayıt Saklama (NAS/SFTP) & Versiyon",
    shortTitle: "Bakım, Yedek & Kayıt Saklama",
    menuPath: "Yönetim & Ayarlar → Sistem Ayarları → Bakım & Sistem (5 Alt Ekran)",
    pbxRoute: "/?tab=ayarlar&subtab=sistem-versiyonu",
    permissions: ["datetime_settings:write", "backup_restore:write", "restore_points:write", "recording_retention:write", "system_version:read"],
    badge: "NTP • Tam Yedek • Snapshot • NAS/SMB/SFTP • Versiyon",
    readMinutes: 10,
    summary:
      "Santralin uzun ömürlü, KVKK uyumlu ve felaket kurtarma (Disaster Recovery) garantili çalışması için gereken 5 bakım modülüdür: Tarih/Saat/NTP, Sistem Yedekleme & Geri Yükleme, Anlık Geri Yükleme Noktaları (Restore Points), Kayıt & Saklama Sistemi (Yerel / NFS / Windows SMB / SFTP + otomatik saklama süresi imhası) ve Sistem Versiyonu & Güncelleme Günlüğü.",
    screenshots: [
      {
        src: "/screenshots/44-settings-retention.jpg",
        caption: "Kayıt & Saklama Sistemi — Depolama hedefi (Yerel / NAS / SMB / SFTP), disk doluluğu ve KVKK otomatik imha süresi",
        routeHint: "Sistem Ayarları → Kayıt & Saklama Sistemi"
      }
    ],
    fieldTable: [
      { field: "Tarih, Saat Dilimi & NTP (datetime-settings)", type: "Timezone + NTP Sunucu", defaultVal: "Europe/Istanbul (UTC+3)", required: true, description: "CDR zaman damgaları, günlük 00:00 performans sıfırlaması ve mesai saatlerinin doğruluğu için kritik." },
      { field: "Sistem Yedekleme (backup-restore)", type: "PostgreSQL + Ayarlar + Asterisk + Anonslar", defaultVal: "İndirilebilir .tar.gz / Zamanlı", required: false, description: "Tek tıkla tam santral yedeği alır veya başka bir Nornia sunucusuna sorunsuz geri yükler." },
      { field: "Geri Yükleme Noktaları (restore-points)", type: "Hızlı Konfigürasyon Snapshot", defaultVal: "Anlık", required: false, description: "Büyük bir CallFlow veya kural değişikliği öncesinde anlık nokta oluşturup saniyeler içinde geri dönmenizi sağlar." },
      { field: "Kayıt & Saklama Sistemi (recording-retention)", type: "mount_path (NFS) / smb (Windows NAS) / sftp", defaultVal: "Yerel Disk + 365 Gün", required: false, description: "Ses kayıtlarını harici sunucuya otomatik senkronlar, disk dolmasını önler ve KVKK saklama süresi dolan kayıtları otomatik temizler." },
      { field: "Sistem Versiyonu & Günlük (version)", type: "Sürüm Kodu + Changelog", defaultVal: "Tek Tık Kopyala", required: false, description: "Yüklü Nornia sürümünü (v3.x.x), sürüm notlarını ve tek tıkla destek ekibiyle paylaşılabilir versiyon kodunu gösterir." }
    ],
    sections: [
      {
        heading: "1. Harici NAS / Windows File Server (SMB) Ses Kaydı Arşivleme",
        body: "Yüksek çağrı hacimli çağrı merkezlerinde yerel SSD'nin dolmaması için Kayıt & Saklama Sistemi'nden SMB veya SFTP seçip şirket NAS bilgilerini girin, 'Depolamayı Test Et' ile yeşil onay alın ve 'Şimdi Eşitle' ile arşivlemeyi başlatın."
      }
    ],
    troubleshooting: [
      { problem: "SMB/NAS bağlantısı testte hata veriyor", cause: "Paylaşım klasöründe yazma izni yok veya firewall 445/TCP portunu engelliyor.", solution: "NAS kullanıcısının hedef paylaşıma Read+Write yetkisi olduğunu ve santralden 445/TCP erişilebildiğini doğrulayın." }
    ],
    relatedPages: ["rapor-ses-kayitlari", "sistem-panosu-ve-saglik", "ai-konfigurasyon-asistani"],
    relatedApis: ["GET /api/version", "GET /api/system/overview"]
  },
  {
    id: "sistem-panosu-ve-saglik",
    number: "47",
    groupId: "yonetim",
    category: "Yönetim & Sistem Ayarları",
    title: "Sistem Panosu & Sağlık İzleme (CPU, RAM, Disk, Servisler & Ağ)",
    shortTitle: "Sistem Panosu & Sağlık",
    menuPath: "Yönetim & Ayarlar → Sistem Panosu & Sağlık",
    pbxRoute: "/?tab=sistem-durumu",
    permissions: ["system_status:access"],
    badge: "Donanım Telemetri • Servis Sağlığı • Uptime",
    readMinutes: 6,
    summary:
      "Santral sunucusunun canlı donanım kaynaklarını (CPU yükü, RAM kullanımı, SSD disk doluluğu, ağ trafiği), tüm kritik servislerin durumunu (Asterisk 20, PostgreSQL 16, FastAPI Backend, AudioSocket AI Motoru, Nornia Connect Tüneli, Nginx) ve sistem çalışma süresini (Uptime) tek ekranda izlediğiniz operasyonel sağlık panosudur.",
    screenshots: [
      {
        src: "/screenshots/01-system-status.jpg",
        caption: "Sistem Panosu & Sağlık — CPU/RAM/Disk metrikleri, LAN/WAN/FQDN özeti ve çekirdek servis durumları",
        routeHint: "Yönetim & Ayarlar → Sistem Panosu & Sağlık"
      }
    ],
    fieldTable: [
      { field: "CPU / RAM / Disk Kullanımı", type: "Canlı % Gösterge", defaultVal: "5 sn yenileme", required: false, description: "Disk %85 üzerine çıktığında sarı, %92 üzerine çıktığında kırmızı uyarı verir (ses kayıtlarını harici NAS'a taşıma sinyali)." },
      { field: "Çekirdek Servis Durumları", type: "Asterisk / PostgreSQL / AudioSocket / AMI / Connect", defaultVal: "Yeşil Çevrimiçi", required: false, description: "Herhangi bir arka plan servisinde kesinti olursa anında kırmızı alarm gösterir." },
      { field: "Ağ & FQDN Kimliği", type: "LAN IP / WAN IP / NAT / FQDN", defaultVal: "Canlı", required: false, description: "Santralin yerel IP'sini, dış IP'sini, aktif <ad>.nornia.com.tr adresini ve HW-ID bilgisini tek bakışta verir." }
    ],
    sections: [
      {
        heading: "1. Proaktif Kapasite Planlama Eşikleri",
        body: "Sağlıklı bir üretim santralinde ortalama CPU %60 altında, RAM %75 altında ve Disk kullanımı %80 altında tutulmalıdır. Disk %80'e yaklaşıyorsa Kayıt & Saklama Sistemi'nden otomatik saklama süresi veya harici NAS arşivleme etkinleştirilmelidir."
      }
    ],
    troubleshooting: [
      { problem: "Asterisk AMI durumu kırmızı görünüyor", cause: "Asterisk servisi yeniden başlamış veya /etc/asterisk/manager.conf şifresi değişmiş olabilir.", solution: "Web SSH terminalinden 'systemctl status asterisk' ve 'pm2 restart aida-backend' ile bağlantıyı tazeleyin." }
    ],
    relatedPages: ["sorun-inceleme-sip-debugger", "bakim-yedekleme-ve-kayit-saklama", "olay-gunlukleri"],
    relatedApis: ["GET /api/system/overview", "GET /api/v1/system/capacity"]
  },
  {
    id: "olay-gunlukleri",
    number: "48",
    groupId: "yonetim",
    category: "Yönetim & Sistem Ayarları",
    title: "Olay Günlükleri & Kurumsal Denetim İzi (Audit & Event Logs)",
    shortTitle: "Olay Günlükleri",
    menuPath: "Yönetim & Ayarlar → Olay Günlükleri",
    pbxRoute: "/?tab=event-logs",
    permissions: ["logs:access"],
    badge: "Kim / Ne Zaman / Hangi IP • Denetim İzi",
    readMinutes: 6,
    summary:
      "Santralde gerçekleşen tüm yönetici değişikliklerini (kullanıcı ekleme/silme, kural değiştirme, yetki güncelleme, lisans işlemi), başarılı/başarısız giriş denemelerini, webhook/entegrasyon hatalarını ve sistem olaylarını kullanıcı adı, gerçek istemci IP adresi ve zaman damgasıyla kronolojik olarak kaydeden kurumsal denetim günlüğüdür.",
    screenshots: [
      {
        src: "/screenshots/45-event-logs.jpg",
        caption: "Olay Günlükleri — Seviye/kaynak filtreleri, kullanıcı aksiyonları, gerçek IP adresi ve detay inceleme",
        routeHint: "Yönetim & Ayarlar → Olay Günlükleri"
      }
    ],
    fieldTable: [
      { field: "Kaynak & Seviye Filtresi", type: "INFO / WARNING / ERROR / SECURITY / AUDIT", defaultVal: "Tümü", required: false, description: "Yalnızca hata (PROCESS_ERROR) veya güvenlik olaylarını anında süzmenizi sağlar." },
      { field: "Aktör & İstemci IP Adresi", type: "Kullanıcı + X-Forwarded-For IP", defaultVal: "Otomatik Middleware", required: false, description: "audit_client_ip_middleware sayesinde her değişikliğin hangi kullanıcı ve hangi dış/iç IP'den yapıldığı kayıt altındadır." },
      { field: "Arama & CSV Dışa Aktarım", type: "Metin Arama + Export", defaultVal: "Tarih Filtreli", required: false, description: "ISO 27001 ve KVKK denetimleri için log dökümü alınabilir." }
    ],
    sections: [
      {
        heading: "1. Güvenlik ve Uyumluluk Denetimi",
        body: "Bir ayar beklenmedik şekilde değiştiyse (örn. bir gelen arama kuralı veya kullanıcı yönlendirmesi) Olay Günlükleri ekranında ilgili kullanıcı veya kural adını aratarak değişikliği kimin, hangi saatte ve hangi IP'den yaptığını saniyeler içinde tespit edebilirsiniz."
      }
    ],
    troubleshooting: [
      { problem: "İstemci IP adresi hep 127.0.0.1 görünüyor", cause: "Önündeki özel reverse proxy X-Forwarded-For / X-Real-IP başlığını iletmiyor.", solution: "Standart Nornia Nginx yapılandırması bu başlıkları otomatik iletir; harici proxy kullanıyorsanız proxy_set_header X-Forwarded-For ekleyin." }
    ],
    relatedPages: ["guvenlik-kalkani", "sistem-panosu-ve-saglik", "sorun-inceleme-sip-debugger"],
    relatedApis: ["GET /api/system/overview"]
  },
  {
    id: "sorun-inceleme-sip-debugger",
    number: "49",
    groupId: "yonetim",
    category: "Yönetim & Sistem Ayarları",
    title: "Sorun İnceleme (Web sngrep, Canlı SIP Akışı, PCAP & Ping/Traceroute)",
    shortTitle: "Sorun İnceleme (SIP/PCAP)",
    menuPath: "Yönetim & Ayarlar → Sorun İnceleme",
    pbxRoute: "/?tab=troubleshooting",
    permissions: ["troubleshooting:access"],
    badge: "Ping • Traceroute • SIP Capture • Web sngrep",
    readMinutes: 10,
    summary:
      "SSH açmadan doğrudan web arayüzünden operatör SBC sunucularına Ping (RTT, Jitter & Paket Kaybı) ve Traceroute (Ağ Rotası & Hop Analizi) çalıştırmanızı, SIP Capture Yakalama ile ham SIP/SDP paketlerini filtreleyip sunucuya `.pcap` olarak arşivlemenizi ve dahili Web sngrep merdiven (ladder) diyagramıyla çağrı sinyalizasyonunu satır satır incelemenizi sağlayan 4 sekmeli VoIP tanılama merkezidir.",
    screenshots: [
      {
        src: "/screenshots/tabs/troubleshooting/04-sngrep.jpg",
        caption: "Sorun İnceleme — Web sngrep canlı SIP diyalogları, 3 sütunlu merdiven (ladder) akış diyagramı, ham SIP/SDP başlıkları ve tek tık .PCAP indirme",
        routeHint: "Yönetim & Ayarlar → Sorun İnceleme"
      }
    ],
    fieldTable: [
      { field: "Sekme 1: Ping (RTT, Jitter & Paket Kaybı)", type: "ICMP Kalite Testi", defaultVal: "Kayıtlı Trunklar Hazır", required: false, description: "Tanımlı SIP Trunk SBC'lerine, Nornia Connect Hub'a veya özel IP/alan adlarına 4/6/10 paketlik ping atar; paket kaybı, ortalama RTT, VoIP jitter (mdev) ve ham konsol çıktısını sunar." },
      { field: "Sekme 2: Traceroute (Ağ Rotası & Hop Analizi)", type: "Ağ Geçidi (Hop) İzi", defaultVal: "Maks. 15 Hop", required: false, description: "Santral ile operatör veya uzak şube arasındaki her yönlendiriciyi (hop) gecikme değerleriyle listeler; ICMP filtreli (`* * *`) veya dar boğaz oluşturan noktaları tespit eder." },
      { field: "Sekme 3: SIP Capture Yakalama & PCAP Arşivi", type: "Canlı Packet Sniffer", defaultVal: "Port 5060/5061/5160/8089", required: false, description: "Ham SIP paketlerini IP, port, metot (INVITE/REGISTER/OPTIONS/BYE/4xx-5xx) ve içerik bazında canlı filtreler; yakalanan akışı indirir veya sunucuya `.pcap` kaydı olarak arşivler." },
      { field: "Sekme 4: sngrep (Ladder Diyagram & .PCAP)", type: "Call-ID Bazlı Diyalog", defaultVal: "İstemci ↔ PBX ↔ Operatör", required: false, description: "SIP mesajlarını çağrı oturumlarına gruplar; İstemci, Santral PBX ve Dış Hat arasında görsel ok diyagramı, ham SIP/SDP inceleyici ve tek tık Wireshark/sngrep `.pcap` indirme sunar." }
    ],
    sections: [
      {
        heading: "1. En Yaygın SIP Hata Kodlarını Hızlı Okuma Rehberi",
        body: "Web sngrep ekranında kırmızı görünen SIP hata kodlarının anlamları:",
        codeBlock: {
          title: "SIP Hata Kodları Hızlı Teşhis Tablosu",
          lang: "text",
          code: `401 / 407 Unauthorized   -> SIP şifresi yanlış (veya ilk challenge — 2. paket 200 OK ise normal)
403 Forbidden            -> Operatör CallerID'yi veya IP adresimizi reddetti
404 Not Found            -> Aranan DID veya dahili santralde tanımlı değil
480 / 486 Busy           -> Karşı taraf meşgul veya cihaz kayıtlı değil
488 Not Acceptable Here  -> Kodek uyuşmazlığı (Trunk'ta G.711 A-Law / alaw aktif olmalı)
503 Service Unavailable  -> Operatör hattı dolu veya erişilemiyor (Yedek Trunk devreye girer)`
        }
      }
    ],
    troubleshooting: [
      { problem: "Canlı yakalamayı başlattım ama hiç paket görünmüyor", cause: "O esnada yeni SIP trafiği oluşmamış veya filtre kutusunda eski bir numara yazılı kalmış.", solution: "Arama filtresini temizleyin ve test amaçlı bir dahili veya dış arama gerçekleştirin." }
    ],
    relatedPages: ["dis-hat-tanimi", "santral-entegrasyonu-ve-nat", "rapor-voip-kalite-mos"],
    relatedApis: ["GET /api/sip-debugger/calls", "GET /api/sip-debugger/calls/{call_id}/pcap", "POST /api/sip-debugger/diagnostics/ping", "POST /api/sip-debugger/diagnostics/traceroute"]
  },
  {
    id: "guvenlik-kalkani",
    number: "50",
    groupId: "yonetim",
    category: "Yönetim & Sistem Ayarları",
    title: "Güvenlik Kalkanı (SIP Firewall, Fail2Ban, IP Yasaklama & Dolandırıcılık Koruması)",
    shortTitle: "Güvenlik Kalkanı",
    menuPath: "Yönetim & Ayarlar → Güvenlik Kalkanı",
    pbxRoute: "/?tab=security",
    permissions: ["security:read", "security:write", "security:delete"],
    badge: "Fail2Ban • Brute-Force • IP Whitelist • Anti-Fraud",
    readMinutes: 9,
    summary:
      "Santralinizi internetten gelebilecek SIP şifre kırma (brute-force), yetkisiz uluslararası arama (toll-fraud), SIP tarayıcı botlar (sipvicious/friendly-scanner) ve API saldırılarına karşı 7/24 koruyan; engellenen IP adreslerini yönetip beyaz liste (Whitelist) tanımladığınız kurumsal siber güvenlik merkezidir.",
    screenshots: [
      {
        src: "/screenshots/47-security.jpg",
        caption: "Güvenlik Kalkanı — Engellenen saldırgan IP'ler, Beyaz Liste (Whitelist), SIP Brute-Force eşikleri ve canlı alarm akışı",
        routeHint: "Yönetim & Ayarlar → Güvenlik Kalkanı"
      }
    ],
    fieldTable: [
      { field: "Engellenen IP Listesi (Banned IPs)", type: "IPv4 + Neden + Süre + Kaldır", defaultVal: "Otomatik Fail2Ban", required: false, description: "Kısa sürede hatalı SIP REGISTER veya API/Web girişi yapan saldırgan IP'leri anında engeller; yanlışlıkla engellenen ofis IP'si tek tıkla açılabilir." },
      { field: "Güvenilir IP Beyaz Listesi (Whitelist)", type: "IPv4 / CIDR", defaultVal: "127.0.0.1 + Yerel LAN", required: false, description: "Merkez ofis, şubeler ve operatör SBC IP'lerini buraya ekleyerek hiçbir koşulda otomatik engellenmemelerini sağlarsınız." },
      { field: "Brute-Force & API Koruma Eşiği", type: "Hatalı Deneme / Dakika", defaultVal: "SIP: 5 deneme | API: 25 deneme/dk", required: false, description: "Eşik aşıldığında IP geçici veya kalıcı bloklanır ve Olay Günlükleri'ne SECURITY kaydı düşer." },
      { field: "Uluslararası Arama & Toll-Fraud Kalkanı", type: "Otomatik Engel", defaultVal: "Aktif", required: false, description: "Yetkisiz yüksek tarifeli (premium) ülke aramalarını anında bloke eder." },
      { field: "Ülke (GeoIP) & User-Agent Filtresi", type: "Politika", defaultVal: "sipvicious / friendly-scanner engelli", required: false, description: "Bilinen SIP saldırı araçlarının imzalarını paket seviyesinde düşürür." }
    ],
    sections: [
      {
        heading: "1. Üretim Santrali Güvenlik Kontrol Listesi",
        body: "Santralinizi canlıya alırken şu 5 güvenlik adımını mutlaka tamamlayın:",
        steps: [
          "Ofisinizin statik dış IP'sini ve SIP Trunk operatör SBC IP'lerini Güvenlik Kalkanı → Beyaz Liste'ye ekleyin.",
          "Dışarıya port açmak yerine Nornia Connect (Sıfır-Port Bulut Köprüsü) kullanarak 5060/8000 portlarını internete tamamen kapatın.",
          "Yönetici hesaplarında Sistem Ayarları / Kullanıcı Kartı üzerinden 2FA (Google Authenticator / E-Posta / WhatsApp OTP) zorunlu yapın.",
          "Abone Gruplarında 'Uluslararası Arama' yetkisini yalnızca gerekli yöneticilere tanımlayın ve PIN koruması ekleyin.",
          "Dış API anahtarlarında mutlaka IP Beyaz Liste (Whitelist) ve sadece gerekli en dar Scope yetkilerini kullanın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Ofisteki tüm IP telefonlar bir anda bağlantıyı kaybetti", cause: "Ofis içinde şifresi yanlış girilmiş tek bir telefon arka arkaya 401 alarak ortak ofis NAT IP'sini Fail2Ban'a düşürmüş olabilir.", solution: "Güvenlik Kalkanı → Engellenen IP'ler listesinden ofis IP'nizin engelini kaldırın, ofis IP'nizi Beyaz Liste'ye ekleyin ve hatalı şifreli cihazı düzeltin." }
    ],
    relatedPages: ["olay-gunlukleri", "sorun-inceleme-sip-debugger", "numara-engelleme", "roller-kvkk-ve-ldap"],
    relatedApis: ["GET /api/reports/enterprise/blacklist-security", "GET /api/v1/blacklist"]
  }
];
