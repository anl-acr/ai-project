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
    relatedPages: ["ortak-gelen-kutusu", "ai-temsilcileri", "zamanlanmis-raporlar"],
    relatedApis: ["GET /api/v1/status", "POST /api/v1/webhooks/subscribe", "POST /api/cti/lookup", "GET /api/webhooks/whatsapp"]
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
    pbxRoute: "/?tab=sorun-inceleme",
    permissions: ["troubleshooting:access"],
    badge: "Web sngrep • Ladder Diyagram • .pcap İndir • Ping",
    readMinutes: 10,
    summary:
      "SSH açmadan doğrudan web arayüzünden canlı SIP sinyalizasyonunu (UDP/TCP 5060, TLS 5061, Cisco 5160, WebRTC WSS 8089) sngrep tarzı görsel merdiven (ladder) diyagramıyla incelemenizi, ham SIP/SDP başlıklarını okumanızı, tek tıkla Wireshark/sngrep uyumlu `.pcap` dosyası indirmenizi ve operatör sunucularına Ping / Traceroute yapmanızı sağlayan profesyonel VoIP tanılama aracıdır.",
    screenshots: [
      {
        src: "/screenshots/46-sip-debugger.jpg",
        caption: "Sorun İnceleme (Web sngrep) — Canlı SIP çağrı listesi, görsel sinyal akış diyagramı, ham başlıklar ve .pcap indirme",
        routeHint: "Yönetim & Ayarlar → Sorun İnceleme"
      }
    ],
    fieldTable: [
      { field: "Canlı Yakalama (Başlat / Durdur / Temizle)", type: "SipTrapper Engine", defaultVal: "Port 5060/5061/8089", required: false, description: "SIP paketlerini Call-ID bazında çağrı oturumlarına gruplar; INVITE, 100 Trying, 180 Ringing, 200 OK, ACK, BYE ve 4xx/5xx hatalarını renk kodlu gösterir." },
      { field: "Merdiven (Ladder) Akış Diyagramı", type: "Görsel Zaman Çizelgesi", defaultVal: "Seçili Çağrı", required: false, description: "Kaynak IP → Santral → Operatör SBC arasındaki her SIP mesajını ok yönü ve milisaniye farkıyla görselleştirir." },
      { field: "Tek Tık .PCAP İndirme", type: "Wireshark / sngrep Binary", defaultVal: "/api/sip-debugger/calls/{call_id}/pcap", required: false, description: "Operatör destek ekibine veya VoIP mühendisine göndermek üzere standart Ethernet/IP/UDP başlıklı `.pcap` paket dosyası üretir." },
      { field: "Ağ Tanılama (Ping & Traceroute)", type: "ICMP / Hop Analizi", defaultVal: "Kayıtlı Trunklar Hazır", required: false, description: "Tanımlı SIP Trunk sunucularına tek tıkla ping atar, RTT gecikmesini ve paket kaybını ölçer." }
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
