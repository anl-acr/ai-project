export const SITE_CONFIG = {
  brand: "Nornia",
  tagline: "Kurumsal Yapay Zeka Santral ve İletişim Platformu",
  domain: "https://www.nornia.com.tr",
  docsUrl: "https://dokuman.nornia.com.tr",
  apiUrl: "https://api.nornia.com.tr",
  catalogUrl: "/Nornia-Kurumsal-Tanitim-Katalogu.pdf",
  sizingCalcUrl: "https://dokuman.nornia.com.tr/ilk-kurulum-sihirbazi/",
  email: "info@nornia.com.tr",
  phoneDisplay: "0850 360 73 90",
  phoneHref: "tel:+908503607390",
  whatsappHref:
    "https://wa.me/908503607390?text=Merhaba%2C%20Nornia%20Kurumsal%20AI%20Santral%20hakk%C4%B1nda%20demo%20ve%20plan%20teklifi%20almak%20istiyorum.",
  location: "İstanbul, Türkiye",
};

export const HERO_METRICS = [
  { value: "44+", label: "Canlı & AI Rapor", tone: "indigo" },
  { value: "7/24", label: "AI Sesli Asistan", tone: "sky" },
  { value: "6 Dil", label: "Canlı Çağrı Çevirisi", tone: "emerald" },
  { value: "KVKK", label: "On-Prem & Bulut", tone: "rose" },
];

export const DEPLOYMENT_EDITIONS = [
  {
    id: "onprem",
    badge: "Yazılım & ISO",
    title: "Kurumsal On-Premise",
    subtitle: "Kendi Sunucunuzda Tam Hakimiyet",
    description:
      "VMware, Proxmox veya fiziksel sunucunuza ISO ya da tek komut Ubuntu 24.04 ile 15 dakikada kurulur. Yerel Ollama + Whisper LLM ile verileriniz kurum dışına çıkmaz.",
    highlights: [
      "Donanıma bağlı kriptografik lisans & çevrimdışı çalışma",
      "Ses kayıtları ve veritabanı %100 kendi sunucunuzda",
      "Nornia Connect ile port açmadan güvenli uzak erişim",
    ],
    cta: "On-Premise Teklifi Al",
    featured: false,
  },
  {
    id: "cloud",
    badge: "En Çok Tercih Edilen",
    title: "Nornia Bulut (Yönetilen)",
    subtitle: "Dakikalar İçinde Hazır UCaaS",
    description:
      "Sunucu bakımı, yedekleme ve güvenlik güncellemeleriyle uğraşmadan kendi kurumsal adresinizle (sirketiniz.nornia.com.tr) anında yayına geçin.",
    highlights: [
      "Otomatik Let's Encrypt SSL & yüksek erişilebilir altyapı",
      "0850 / 0212 Türk ve global tüm SIP Trunk'larla anında bağlantı",
      "İhtiyaca göre esnek dahili, kanal ve AI paketi ölçeklendirme",
    ],
    cta: "30 Gün Ücretsiz Dene",
    featured: true,
  },
  {
    id: "multitenant",
    badge: "Operatör & Çoklu Şube",
    title: "Multi-Tenant & Federasyon",
    subtitle: "Tek Çekirdekte İzole Müşteriler",
    description:
      "Kendi müşterilerine bulut santral hizmeti sunan operatörler, BPO'lar ve çok şubeli holdingler için tam izole kiracı mimarisi ve şube federasyonu.",
    highlights: [
      "Her müşteri için ayrı dahili planı, kayıt, RAG ve trunk izolasyonu",
      "Alt alan adı / Firma Kodu ile izole giriş & merkezi lisans kontrolü",
      "Tek sunucuda 1.000+ eş zamanlı çağrı ve beyaz etiket (White-Label)",
    ],
    cta: "Mimari Görüşme Planla",
    featured: false,
  },
];

export const COMPATIBILITY_BADGES = [
  "Yealink",
  "Grandstream",
  "Fanvil",
  "Cisco IP",
  "Asterisk PJSIP",
  "WebRTC WSS",
  "WhatsApp Cloud API",
  "Instagram & Meta Direct",
  "Telegram",
  "Zoho / HubSpot / Salesforce",
  "Active Directory / Entra ID",
  "Gemini / OpenAI / Ollama",
];

export const PLATFORM_TABS = [
  {
    id: "ai-voice",
    label: "AI Sesli Asistan",
    badge: "Gerçek Zamanlı Sesli Yapay Zeka",
    title: "7/24 Doğal Türkçe Konuşan Otonom Sesli Asistanlar",
    description:
      "Görsel senaryo editörüyle karşılama, KVKK onayı, RAG bilgi bankası sorgusu, randevu oluşturma ve isimle dahili aktarma akışlarını kod yazmadan kurgulayın.",
    screenshot: "/screenshots/08-ai-agents.jpg",
    screenshotAlt: "Nornia Yapay Zeka Temsilcileri ve görsel diyalog senaryo editörü",
    docUrl: "https://dokuman.nornia.com.tr/ai-temsilcileri/",
    bullets: [
      "AudioSocket üzerinden milisaniye gecikmeli doğal sesli diyalog ve söz kesme (barge-in) algılama",
      "PDF, web sitesi ve kurumsal dokümanlardan anlık yanıt üreten RAG Bilgi Bankası",
      "Görüşme sırasında PostgreSQL randevu oluşturma, CRM sorgulama ve isimle personele aktarım",
      "Bulut AI sağlayıcıları (Gemini / OpenAI / ElevenLabs) veya tam gizlilik için yerel Ollama + Whisper",
    ],
  },
  {
    id: "live-translate",
    label: "AI Canlı Çeviri",
    badge: "Simultane Tercüman • 6 Dil",
    title: "Canlı Çağrı Sırasında Çift Yönlü Yapay Zeka Sesli Tercüme",
    description:
      "Yabancı dil bilmeyen temsilcileriniz bile İngilizce, Almanca, Rusça, Arapça, Fransızca ve İspanyolca konuşan müşterilerle anlık altyazı ve çift yönlü sesli dublajla akıcı görüşme yapsın.",
    screenshot: "/screenshots/active-call-panel.jpg",
    screenshotAlt: "Nornia Temsilci Çağrı Paneli içinde Canlı Konuşma & Çeviri simultane tercüman ekranı",
    docUrl: "https://dokuman.nornia.com.tr/cagri-paneli-web-telefon-aktif-cagri/",
    bullets: [
      "6 dilde anlık çeviri: İngilizce (EN), Almanca (DE), Rusça (RU), Arapça (AR), Fransızca (FR) ve İspanyolca (ES) ↔ Türkçe",
      "Çift yönlü Oto. Sesli Çeviri: Temsilci Türkçe konuşur, müşteri kendi dilinde doğal sesle dinler (Audio Ducking)",
      "Yazarak Seslendir modu: Temsilcinin yazdığı Türkçe yanıt anında hedef dile çevrilip aktif hatta sesli okunur",
      "3 ses çıkış modu (Sadece Müşteri / Müşteri + Ben / Sadece Ben) ve granüler rol yetkisi",
    ],
  },
  {
    id: "agent-panel",
    label: "Çağrı Merkezi & WebPhone",
    badge: "Tarayıcı Tabanlı İş İstasyonu",
    title: "Yüzlerce Temsilci İçin Kurulumsuz Çağrı Merkezi ve Süpervizör Ekranı",
    description:
      "Masa telefonu, Runa Mobil veya dahili WebRTC Web Telefon tek ekranda birleşir. ACD kuyruklar, canlı Wallboard, Dinleme/Sufle/Araya Girme ve 360° müşteri kartı tek paneldedir.",
    screenshot: "/screenshots/active-call-panel.jpg",
    screenshotAlt: "Nornia canlı Temsilci Çağrı Paneli, Web Telefon ve aktif görüşme ekranı",
    docUrl: "https://dokuman.nornia.com.tr/temsilci-cagri-paneli/",
    bullets: [
      "Aktif çağrıda 10 canlı kontrol: Kör/Danışmalı Aktarım, Bekletme, Konferans, Çağrı Parkı, AI Not ve DTMF",
      "Süpervizör Canlı Dinleme (Listen), Sufle (Whisper), Araya Girme (Barge-in) ve anlık Wallboard izleme",
      "Anlık 360° CTI müşteri kartı açılışı, çağrı sonuç kodları, KVKK ses kaydı duraklatma ve Smart Callback",
      "Gerçek zamanlı vardiya, mola puantajı ve temsilci performans sayaçları",
    ],
  },
  {
    id: "omnichannel",
    label: "Omnichannel & CRM",
    badge: "Çok Kanallı Ortak Gelen Kutusu",
    title: "WhatsApp, Instagram, Telegram, E-Posta ve CRM Tek Akışta",
    description:
      "0850 kurumsal WhatsApp hattınız dahil tüm yazılı kanalları AI destekli ortak gelen kutusunda birleştirin; Zoho, HubSpot, Salesforce ve Bitrix24 ile çift yönlü çalışın.",
    screenshot: "/screenshots/05-omnichannel.jpg",
    screenshotAlt: "Nornia Omnichannel Ortak Gelen Kutusu ekranı",
    docUrl: "https://dokuman.nornia.com.tr/ortak-gelen-kutusu/",
    bullets: [
      "Çoklu 0850 WhatsApp Business hattı, etkileşimli karşılama butonları ve mesai dışı otomatik yanıt",
      "Cevapsız kalan telefon çağrılarına otomatik WhatsApp geri dönüş mesajı ve CSV toplu kampanya",
      "Instagram DM, Facebook Messenger, Telegram ve SMTP/IMAP e-posta kanalları tek SLA ekranında",
      "Hazır CRM Marketi (Zoho, HubSpot, Salesforce, Bitrix24), Active Directory SSO ve OpenAPI 3.1",
    ],
  },
  {
    id: "analytics",
    label: "44+ Rapor & AI Analitik",
    badge: "Veriye Dayalı Yönetim",
    title: "Kuyruk SLA'dan Duygu Isı Haritasına 44+ Hazır Kurumsal Rapor",
    description:
      "Her çağrının transkripti, müşteri duygu skoru, sessizlik/söz kesme oranları, VoIP MOS ses kalitesi ve AI-İnsan verimlilik ROI'si otomatik hesaplanır.",
    screenshot: "/screenshots/35-reports-queue-sla.jpg",
    screenshotAlt: "Nornia Kuyruk SLA ve Kurumsal Analitik Rapor ekranı",
    docUrl: "https://dokuman.nornia.com.tr/rapor-kuyruk-sla/",
    bullets: [
      "12 Temel Santral + 17 Çağrı Merkezi/Kuyruk + 15 AI & Üst Yönetim raporu (toplam 44+ hazır rapor)",
      "Duygu ısı haritası, müşteri çile noktaları, niyet raporu, senaryo sadakati ve otomatik AI QA puanlama",
      "Sürükle-bırak Özel Rapor Tasarımcısı ve e-posta ile otomatik zamanlanmış Excel/PDF gönderimi",
      "VoIP MOS ses kalitesi analizi ve dahili Web sngrep / PCAP paket inceleyici (SIP Debugger)",
    ],
  },
  {
    id: "callflow",
    label: "Görsel IVR & Dialer",
    badge: "Kodsuz Çağrı Akışı",
    title: "Sürükle-Bırak IVR, Akıllı Yönlendirme ve Otomatik Dış Arama",
    description:
      "Gelen çağrıları mesai saatleri, resmi tatiller, VIP listeleri, tuşlama menüleri ve 3 kademeli abone yönlendirme kurallarına göre saniyeler içinde şekillendirin.",
    screenshot: "/screenshots/26-call-flow.jpg",
    screenshotAlt: "Nornia Görsel Arama Akışı ve IVR Editörü",
    docUrl: "https://dokuman.nornia.com.tr/arama-akis-yonetimi/",
    bullets: [
      "Görsel düğüm tabanlı IVR: Anons, DTMF tuşlama, mesai/tatil kontrolü, AI Asistan ve ACD kuyruk",
      "Her zaman, meşgulde ve cevapsızda dinamik süreli GSM/dahili yönlendirme ve DFKS telefon senkronizasyonu",
      "Yapay zeka seslendirme ile saniyeler içinde kurumsal karşılama ve bekleme anonsu üretme",
      "Otomatik dış arama kampanyaları (Power / Auto-Dialer) ve çağrı sonu memnuniyet anketi",
    ],
  },
  {
    id: "provisioning",
    label: "Oto-Provizyon & Yönetim",
    badge: "Sıfır Dokunuşlu Altyapı",
    title: "IP Telefon Oto-Provizyon, Merkezi Firmware ve Sunucu Yönetimi",
    description:
      "Yealink, Grandstream, Fanvil ve Cisco telefonları MAC adresiyle otomatik kurun; firmware güncellemelerini, DFKS DND/Yönlendirme durumlarını ve sunucu servislerini tek panelden yönetin.",
    screenshot: "/screenshots/14-autoprovision.jpg",
    screenshotAlt: "Nornia IP Telefon Oto-Provizyon ekranı",
    docUrl: "https://dokuman.nornia.com.tr/oto-provizyon/",
    bullets: [
      "MAC tabanlı sıfır dokunuşlu IP telefon kurulumu, özel şablon editörü ve telefona giden dosya inceleyici",
      "Merkezi IP Telefon Firmware deposu: Aktif çağrı korumalı, model bazlı güvenli uzaktan güncelleme",
      "DFKS çift yönlü anlık senkronizasyon: Masa telefonundaki DND ve yönlendirme web panelle anında eşleşir",
      "Arayüzden Sunucu & Servis Yönetimi (Asterisk, PM2, PostgreSQL, Nginx, Reboot), Fail2Ban ve Multi-Tenant",
    ],
  },
];

export const CLIENT_APPS = [
  {
    id: "runa-mobile",
    badge: "iOS & Android",
    title: "Runa Mobil — Ofis Dahiliniz Her An Cebinizde",
    summary:
      "Kurumsal numaranızla ofis dışında, sahada veya seyahatte kesintisiz HD sesli görüşme yapın; kişisel GSM numaranızı paylaşmadan müşterilerinizle iletişimde kalın.",
    image: "/screenshots/runa-mobile.jpg",
    imageAlt:
      "Runa Mobil iOS ve Android kurumsal softphone uygulaması, QR kurulum, Call Flip ve PushKit özellikleri",
    docUrl: "https://dokuman.nornia.com.tr/masaustu-mobil-ve-webphone/",
    highlights: [
      {
        title: "QR ile 3 Saniyede Şifresiz Kurulum",
        desc: "SIP sunucu adresi, port veya şifre yazmadan kullanıcı ekranındaki QR kodu okutup anında oturum açın.",
      },
      {
        title: "Call Flip (Görüşmeyi Kesmeden Cihaz Değiştir)",
        desc: "Masa telefonundaki veya bilgisayardaki aktif görüşmeyi kapatmadan tek dokunuşla cebe, ofise dönünce tekrar masaya aktarın.",
      },
      {
        title: "PushKit & FCM Anlık Uyandırma",
        desc: "Uygulama arka planda veya tamamen kapalıyken bile pil tüketmeden gelen çağrıları anında çaldırır; ortak rehber ve sesli posta her an elinizdedir.",
      },
    ],
  },
  {
    id: "runa-desktop",
    badge: "macOS & Windows (.dmg / .exe)",
    title: "Runa Masaüstü — Tarayıcıdan Bağımsız Temsilci Uygulaması",
    summary:
      "Çağrı merkezi temsilcileri ve yoğun telefon trafiği yöneten ekipler için Apple Silicon, macOS Intel ve Windows uyumlu yerel masaüstü istemcisi.",
    image: "/screenshots/runa-desktop.jpg",
    imageAlt:
      "Runa Masaüstü macOS ve Windows temsilci uygulaması, 3 bağımsız ses donanımı ve sistem tepsisi özellikleri",
    docUrl: "https://dokuman.nornia.com.tr/masaustu-mobil-ve-webphone/",
    highlights: [
      {
        title: "3 Bağımsız Ses Donanımı Yönlendirmesi",
        desc: "Mikrofonu (Jabra USB), görüşme kulaklığını (Bluetooth) ve zil sesi çalacak masaüstü hoparlörünü birbirinden bağımsız tanımlayın.",
      },
      {
        title: "Çağrıda Pencereyi Öne Getir & Sistem Tepsisi (Tray)",
        desc: "Bilgisayar açıldığında otomatik başlar, arka planda sessizce bekler ve çağrı geldiğinde masaüstünde anında öne çıkar.",
      },
      {
        title: "Tek Tıkla Kolay Giriş & Tüm 10 Panel Modülü",
        desc: "E-postayla gönderilen tek kullanımlık kolay giriş linkiyle kurulur; Web Telefon, AI Canlı Çeviri, Omnichannel ve rehber tek pencerede çalışır.",
      },
    ],
  },
];

export const TUNNEL_FLOW_STEPS = [
  {
    step: "01",
    title: "Kurum İçi Santral",
    subtitle: "Firewall / NAT / CGNAT Arkası",
    detail: "Hiçbir gelen port (80/443/5060) açılmaz, statik IP gerekmez.",
  },
  {
    step: "02",
    title: "Şifreli Outbound Tünel",
    subtitle: "HTTPS WSS + WireGuard + TURN",
    detail: "Santral dışa doğru şifreli köprü kurar; SIP ve RTP sesi kesintisiz akar.",
  },
  {
    step: "03",
    title: "Nornia Connect Hub",
    subtitle: "sirketiniz.nornia.com.tr + SSL",
    detail: "Kurumsal alt alan adı ve otomatik yenilenen Let's Encrypt sertifikası.",
  },
  {
    step: "04",
    title: "Her Yerden Güvenli Erişim",
    subtitle: "Web • Runa Mobil • Uzak IP Telefon",
    detail: "Evden, şubeden ve mobilden tek yönlü ses sorunu olmadan HD görüşme.",
  },
];

export const TUNNEL_PILLARS = [
  {
    title: "Sıfır Gelen Port (Zero-Port) Güvenliği",
    desc: "Güvenlik duvarınızda dış dünyaya 80, 443, 5060 veya 10000–20000 RTP portu açmanıza gerek kalmaz. Santral yalnızca dışa doğru (outbound) şifreli tünel açtığı için tarama ve SIP saldırı yüzeyi ortadan kalkar.",
  },
  {
    title: "Statik IP Olmadan Kurumsal FQDN & Otomatik SSL",
    desc: "Ofisinizde dinamik IP veya CGNAT olsa bile kurulum sihirbazında seçtiğiniz sirketiniz.nornia.com.tr adresi otomatik SSL sertifikasıyla yayına girer; WebRTC mikrofon izinleri sıfır uyarıyla çalışır.",
  },
  {
    title: "WireGuard SIP Edge & WebRTC TURN Ses Rölesi",
    desc: "Uzak şubelerdeki Yealink/Grandstream/Cisco masa telefonları (5060 UDP/TCP & 5061 TLS) ve Runa Mobil cihazları WireGuard + TURN ses rölesi üzerinden çift NAT arkasında dahi tek yönlü ses yaşamadan bağlanır.",
  },
  {
    title: "Yönetici Kontrollü Web-SSH & Filo Sağlığı",
    desc: "Sistem yöneticisi tek anahtarla uzaktan destek erişimini dilediğinde açıp kapatabilir; kesintisiz çalışma durumu ve gecikme (ms) canlı olarak izlenir.",
  },
];

export const ARCHITECTURE_CARDS = [
  {
    icon: "smartphone",
    title: "Runa Mobil, Masaüstü & DFKS",
    description:
      "iOS, Android, macOS, Windows uygulamaları ve masa telefonlarıyla tam senkronizasyon; DND ve yönlendirme durumu tüm cihazlarda anlık eşitlenir.",
  },
  {
    icon: "server",
    title: "15 Dakikada ISO veya Ubuntu Kurulum",
    description:
      "Kendi sunucunuza tek komutla Ubuntu 24.04 LTS çevrimiçi kurulum veya tam çevrimdışı ISO kurulumu; 6 adımlı web sihirbazıyla anında hazır.",
  },
  {
    icon: "shield",
    title: "KVKK & Yerel LLM Veri Hakimiyeti",
    description:
      "Ses kayıtları, transkriptler ve müşteri verileri tamamen sizin sunucunuzda kalabilir; Ollama ve yerel Whisper ile dış buluta veri çıkarmadan AI çalıştırın.",
  },
  {
    icon: "network",
    title: "Tam İzole Multi-Tenant Bulut Mimarisi",
    description:
      "Tek santral çekirdeğinde yüzlerce müşteri birbirinden %100 izole çalışır; ayrı dahili planı, ayrı trunk, ayrı RAG bilgi bankası ve ayrı ses kayıt arşivi.",
  },
  {
    icon: "cpu",
    title: "Merkezi Firmware & Sunucu Yönetimi",
    description:
      "IP telefon firmware güncellemelerini aktif çağrıyı kesmeden merkezi yönetin; Asterisk, PM2, PostgreSQL, Nginx ve sunucu gücünü rol yetkili arayüzden kontrol edin.",
  },
  {
    icon: "code",
    title: "Açık REST API & Hazır CRM Marketi",
    description:
      "OpenAPI 3.1 uyumlu REST API, Zoho/HubSpot/Salesforce/Bitrix24 entegrasyonları, Active Directory/Entra ID SSO ve çift yönlü CRM/ERP webhook desteği.",
  },
];

export const SECTOR_SOLUTIONS = [
  {
    id: "call-center",
    name: "Çağrı Merkezleri & BPO",
    headline: "Yüksek Hacimli Kuyruklarda SLA ve Maliyet Kontrolü",
    summary:
      "Yüzlerce temsilciyi tarayıcı tabanlı çağrı panelinde yönetin; rutin bilgi ve yönlendirme çağrılarını AI Sesli Asistan karşılasın, temsilcileriniz yüksek değerli satış ve çözüme odaklansın.",
    stats: [
      { value: "%65", label: "Rutin Çağrıda Otomasyon" },
      { value: "< 1.5 sn", label: "AI İlk Yanıt Süresi" },
      { value: "44+", label: "Anlık SLA & QA Raporu" },
    ],
    modules: [
      "ACD Kuyruk & VIP Öncelik",
      "Canlı Wallboard",
      "Fısıldama & Dinleme",
      "Duygu Analizi & QA",
      "Otomatik Dialer",
    ],
  },
  {
    id: "healthcare",
    name: "Sağlık, Hastane & Klinikler",
    headline: "7/24 Sesli & WhatsApp Randevu Asistanı",
    summary:
      "Hastalarınız gece gündüz telefonla veya WhatsApp üzerinden doktor müsaitliğini sorup anında randevu oluşturabilir, iptal/değişiklik yapabilir ve 6 dilde canlı çeviriyle sağlık turizmi hizmeti alabilir.",
    stats: [
      { value: "7/24", label: "Kesintisiz Randevu Hattı" },
      { value: "6 Dil", label: "Sağlık Turizmi Canlı Çeviri" },
      { value: "%100", label: "KVKK Uyumlu Kayıt" },
    ],
    modules: [
      "AI Randevu Takvimi",
      "6 Dil Simultane Çeviri",
      "KVKK Sesli Onay Akışı",
      "Cevapsız Çağrı WhatsApp Dönüşü",
      "RAG Tedavi Bilgi Bankası",
    ],
  },
  {
    id: "ecommerce",
    name: "E-Ticaret & Perakende",
    headline: "Sipariş, Kargo ve İade Sorularında Anında Çözüm",
    summary:
      "Telefon, WhatsApp, Instagram DM ve e-postadan gelen sipariş sorgularını ERP/CRM API'nizle anlık yanıtlayın; yoğun kampanya dönemlerinde bekleme kuyruğu oluşturmadan tüm talepleri karşılayın.",
    stats: [
      { value: "5 Kanal", label: "Tek Gelen Kutusunda" },
      { value: "3x", label: "Temsilci Verimliliği" },
      { value: "%98", label: "İlk Temasta Yanıt Oranı" },
    ],
    modules: [
      "WhatsApp 0850 & Instagram DM",
      "CRM / Kargo API Araç Çağrısı",
      "Toplu Kampanya Bildirimi",
      "AI vs İnsan ROI Raporu",
      "Tek Tıkla Canlı Devir",
    ],
  },
  {
    id: "enterprise",
    name: "Çok Şubeli Kurumlar & Telekom",
    headline: "Merkezi Yönetim, Tam Şube ve Çoklu Kiracı İzolasyonu",
    summary:
      "Farklı şehirlerdeki şubelerinizi veya kurumsal müşterilerinizi tek çekirdekte tam izole yönetin. Active Directory/LDAP entegrasyonu, donanıma bağlı lisanslama ve yerel LLM ile regülasyonlara tam uyum sağlayın.",
    stats: [
      { value: "On-Prem", label: "& Bulut Multi-Tenant" },
      { value: "LDAP/2FA", label: "Kurumsal Kimlik Güvenliği" },
      { value: "Sınırsız", label: "Şube Federasyonu" },
    ],
    modules: [
      "Multi-Tenant & Federation",
      "Yealink/Grandstream Oto-Provizyon",
      "Active Directory & RBAC",
      "Yerel Ollama/Whisper AI",
      "SIP IPS Güvenlik Kalkanı",
    ],
  },
];

/* ============================================================================
   YEASTAR-INSPIRED NORNIA PLAN TIERS & FEATURE COMPARISON MATRIX
   Aligned 1:1 with license_center/frontend/utils/licensePackages.js
   ============================================================================ */

export const PLAN_TIERS = [
  {
    id: "starter",
    name: "Starter",
    subtitle: "Başlangıç Paketi",
    badge: "KOBİ & Ofis Santrali",
    audience: "Güçlü bir kurumsal IP santral, WebPhone ve mobilite arayan işletmeler için.",
    deploymentNote: "On-Premise & Bulut",
    moduleSummary: "16 PBX Modülü • 12 Temel Rapor",
    featured: false,
    cta: "Starter Teklifi Al",
    accent: "sky",
    highlights: [
      "Tam kurumsal IP Santral (SIP Trunk, Görsel IVR, DID, Konferans)",
      "WebRTC Web Telefon + Runa Mobil (iOS/Android) & Masaüstü",
      "IP Telefon Oto-Provizyon (Yealink, Grandstream, Fanvil, Cisco)",
      "Nornia Connect Sıfır-Port Tünel, Fail2Ban, 2FA & Otomatik SSL",
      "12 Temel Santral & CDR Raporu + Ses Kayıt Arşivi",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    subtitle: "Çağrı Merkezi & Omnichannel",
    badge: "En Çok Tercih Edilen",
    audience: "Büyüyen ekipler, çağrı merkezleri, süpervizör yönetimi ve WhatsApp/CTI akışları için.",
    deploymentNote: "On-Premise & Bulut",
    moduleSummary: "Starter + Çağrı Merkezi, WhatsApp & 29 Rapor",
    featured: true,
    cta: "Professional Teklifi Al",
    accent: "indigo",
    highlights: [
      "Starter paketindeki tüm özellikler eksiksiz dahil",
      "ACD Kuyruklar, Canlı Wallboard, Dinleme / Sufle / Araya Girme",
      "Omnichannel Ortak Gelen Kutusu (WhatsApp 0850 & E-Posta)",
      "CTI Müşteri 360° Kartı, DFKS Masa Telefonu Senkronu & Merkezi Firmware",
      "29 Kurumsal Rapor (Kuyruk SLA, FCR, Mola/Puantaj, VoIP MOS) + Web sngrep",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    subtitle: "Tam AI Suite & Multi-Tenant",
    badge: "Kurumsal & Operatör",
    audience: "Yapay zeka sesli asistan, 6 dil canlı çeviri, CRM/AD entegrasyonu ve çoklu kiracı yapıları için.",
    deploymentNote: "On-Premise, Bulut & Multi-Tenant",
    moduleSummary: "Tüm Modüller • AI Suite • 44+ Rapor • Multi-Tenant",
    featured: false,
    cta: "Enterprise Teklifi Al",
    accent: "violet",
    highlights: [
      "Professional paketindeki tüm özellikler eksiksiz dahil",
      "7/24 AI Sesli Asistan, RAG Bilgi Bankası, 6 Dil Canlı Çeviri & AI QA",
      "Auto-Dialer Dış Arama, Instagram DM / Facebook / Telegram Kanalları",
      "Hazır CRM Marketi (Zoho/HubSpot/SF/Bitrix), Active Directory SSO & Open API",
      "44+ Rapor (Duygu Analizi, AI ROI, CEO Özeti) & Tam İzole Multi-Tenant",
    ],
  },
];

/**
 * Cell value format:
 *   true  -> Checkmark ("Dahil")
 *   false -> Dash ("Dahil Değil")
 *   string -> Exact badge text (e.g. "12 Rapor", "Opsiyonel", "Tek Kiracı")
 */
export const PLAN_COMPARISON_CATEGORIES = [
  {
    id: "deployment",
    title: "Kurulum Seçenekleri & Mimari Ölçek",
    description: "On-Premise, Bulut ve Çoklu Kiracı (Cloud PBX) barındırma esnekliği",
    rows: [
      {
        feature: "Kurumsal On-Premise Kurulum (ISO / Ubuntu 24.04 LTS)",
        note: "Kendi fiziksel veya sanal sunucunuzda %100 veri hakimiyeti",
        starter: true,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Nornia Bulut (Yönetilen UCaaS — sirketiniz.nornia.com.tr)",
        note: "Otomatik SSL, 7/24 izleme ve yönetilen altyapı",
        starter: true,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Çoklu Müşteri / Kiracı İzolasyonu (Multi-Tenant Cloud PBX)",
        note: "Her müşteri için ayrı dahili planı, kayıt, trunk, RAG ve alt alan adı girişi",
        starter: false,
        professional: false,
        enterprise: true,
      },
      {
        feature: "Çok Şubeli Santral Federasyonu (Multi-Site Edge & Failover)",
        note: "Şubeler arası şifreli santral ağı ve çevrimdışı hayatta kalma",
        starter: false,
        professional: "Opsiyonel",
        enterprise: true,
      },
      {
        feature: "Donanıma Bağlı Kriptografik Lisanslama & Çevrimdışı Çalışma",
        note: "Klonlama korumalı HMAC-SHA256 lisans doğrulaması",
        starter: true,
        professional: true,
        enterprise: true,
      },
    ],
  },
  {
    id: "pbx",
    title: "Temel IP Santral (PBX) & IP Telefon Yönetimi",
    description: "Asterisk PJSIP çekirdeği, görsel IVR ve sıfır dokunuşlu masa telefonu yönetimi",
    rows: [
      {
        feature: "Kullanıcılar, Dahililer & Çoklu Profil (Müsait / Toplantı / DND)",
        starter: true,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Dış Hat (SIP Trunk), Gelen (DID) & Giden Arama Kuralları",
        note: "Türk Telekom, Superonline, İkon, Netgsm ve tüm standart SIP sağlayıcılar",
        starter: true,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Görsel Arama Akışı (Sürükle-Bırak IVR) & Anons Yönetimi",
        starter: true,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Mesai Saatleri, Resmi Tatiller, Rehber, Hızlı Arama & Blacklist",
        starter: true,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Çağrı Toplama (Pickup), Abone Grupları (Ring Group) & Konferans Odaları",
        starter: true,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Lokasyon / Departman Yönetimi & Esnek Numara Planı",
        starter: true,
        professional: true,
        enterprise: true,
      },
      {
        feature: "IP Telefon Oto-Provizyon (Yealink, Grandstream, Fanvil, Cisco)",
        note: "MAC adresiyle sıfır dokunuşlu LAN/WAN kurulum",
        starter: true,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Özel Otoprovizyon Şablonları, Dosya İnceleyici & Toplu Konfigürasyon",
        note: "Telefona giden ham XML/CFG snapshot inceleme ve toplu cihaz güncelleme",
        starter: false,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Merkezi IP Telefon Firmware Yönetimi (Aktif Çağrı Korumalı)",
        note: "Model bazlı firmware politikası ve görüşme bitince otomatik güncelleme",
        starter: false,
        professional: true,
        enterprise: true,
      },
    ],
  },
  {
    id: "uc-devices",
    title: "Birleşik İletişim (Runa UC) & Gelişmiş Abone Özellikleri",
    description: "WebPhone, Runa Mobil/Masaüstü ve çift yönlü masa telefonu senkronizasyonu",
    rows: [
      {
        feature: "Tarayıcı WebRTC Web Telefonu (Temsilci Çağrı Paneli)",
        starter: true,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Runa Mobil (iOS/Android) & Runa Masaüstü (macOS/Win) + QR Kurulum",
        note: "PushKit/FCM uyandırma, Call Flip ve 3 bağımsız ses donanımı seçimi",
        starter: true,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Sesli Posta (Voicemail & E-Posta İletimi) ve Follow-Me / GSM Yönlendirme",
        starter: true,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Dahili Ekip Sohbeti (Internal Chat)",
        starter: false,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Masa Telefonu BLF/Softkey & Canlı DFKS (DND / Yönlendirme Eşitleme)",
        note: "Masa telefonundaki DND ve yönlendirme tuşları santralle anlık çift yönlü eşleşir",
        starter: false,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Yönetici–Asistan (Boss–Secretary) & Esnek Masa (Hot-Desking)",
        starter: false,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Çoklu SIP Cihaz Aktivasyonu & Numara Maskeleme (Son 4 Hane ** **)",
        starter: false,
        professional: true,
        enterprise: true,
      },
      {
        feature: "KVKK & Kredi Kartı Ses Kaydı Duraklatma / Maskeleme",
        starter: false,
        professional: true,
        enterprise: true,
      },
    ],
  },
  {
    id: "call-center",
    title: "Çağrı Merkezi, Süpervizör & Dış Arama Kampanyaları",
    description: "Kuyruk dağıtımı, canlı izleme, koçluk müdahaleleri ve otomatik arama",
    rows: [
      {
        feature: "ACD Çağrı Kuyruk Yönetimi & VIP Önceliklendirme",
        starter: false,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Canlı İzleme Paneli (Wallboard) & Gerçek Zamanlı Çağrı İzleme",
        starter: false,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Mola Tanımları, Temsilci Durum Takibi & Süpervizör İşlemleri",
        starter: false,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Süpervizör Canlı Dinleme (Listen), Sufle (Whisper) & Araya Girme (Barge-in)",
        starter: false,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Geri Arama Planlayıcı & Akıllı Geri Arama (Smart Callback)",
        starter: false,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Randevu Takvimi & E-Posta ile Zamanlanmış Otomatik Raporlar",
        starter: false,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Otomatik Dış Arama Kampanyası (Power / Auto-Dialer)",
        note: "Liste bazlı dış arama kampanyaları ve telesekreter tespiti",
        starter: false,
        professional: false,
        enterprise: true,
      },
    ],
  },
  {
    id: "omnichannel-crm",
    title: "Omnichannel, CRM Marketi & Açık API Entegrasyonları",
    description: "Çok kanallı yazılı müşteri iletişimi, CTI ve kurumsal kimlik/yazılım entegrasyonu",
    rows: [
      {
        feature: "Ortak Gelen Kutusu (Omnichannel) & Hazır Cevap Şablonları",
        starter: false,
        professional: true,
        enterprise: true,
      },
      {
        feature: "WhatsApp Business Cloud API (0850 / Çoklu Hat) & E-Posta (IMAP/SMTP)",
        note: "Cevapsız çağrı otomatik WhatsApp dönüşü ve toplu CSV duyuru dahil",
        starter: false,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Instagram DM, Facebook Messenger (Meta Direct) & Telegram Bot",
        starter: false,
        professional: false,
        enterprise: true,
      },
      {
        feature: "CTI Müşteri Kartı Otomatik Açma (Screen Pop) & Müşteri 360° Kartı",
        starter: false,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Hazır CRM Marketi (Zoho, HubSpot, Salesforce, Bitrix24)",
        starter: false,
        professional: false,
        enterprise: true,
      },
      {
        feature: "Active Directory (LDAP & Microsoft Entra ID SSO)",
        starter: false,
        professional: false,
        enterprise: true,
      },
      {
        feature: "Evrensel API Sihirbazı (Webhook) & Kurumsal REST API / Token Yönetimi",
        note: "OpenAPI 3.1 uyumlu çift yönlü entegrasyon ve WebSocket olay akışı",
        starter: false,
        professional: false,
        enterprise: true,
      },
    ],
  },
  {
    id: "ai-suite",
    title: "Yapay Zeka (AI) Suite & Gerçek Zamanlı Ses Analitiği",
    description: "Otonom sesli asistan, 6 dil canlı çeviri, RAG bilgi bankası ve otomatik kalite denetimi",
    rows: [
      {
        feature: "7/24 AI Sesli Asistan & Görsel Diyalog Senaryo Editörü",
        note: "AudioSocket canlı sesli diyalog, KVKK onayı ve isimle dahili aktarma",
        starter: false,
        professional: false,
        enterprise: true,
      },
      {
        feature: "Bilgi Bankası (RAG — PDF & Web Sitesi Tarayıcı) ve Kural Editörü",
        starter: false,
        professional: false,
        enterprise: true,
      },
      {
        feature: "AI Canlı Çağrı Çevirisi (6 Dil Altyazı & Çift Yönlü Simultane Tercüman)",
        note: "EN, DE, RU, AR, FR, ES ↔ TR anlık dublaj ve yazarak seslendirme",
        starter: false,
        professional: false,
        enterprise: true,
      },
      {
        feature: "AI Otomatik Çağrı Özeti, Not & Sonuç Kodu Asistanı",
        starter: false,
        professional: false,
        enterprise: true,
      },
      {
        feature: "Otomatik Dil Algılama, Duygu Yönetimi & Canlı Kriz Radarı",
        starter: false,
        professional: false,
        enterprise: true,
      },
      {
        feature: "AI Fısıldama (AI Whisper) & Otomatik Çağrı Kalite Puanlama (AI QA)",
        starter: false,
        professional: false,
        enterprise: true,
      },
      {
        feature: "Biyometrik Ses Analizi (Voice Biometrics) & AI Konfigürasyon Asistanı",
        starter: false,
        professional: false,
        enterprise: true,
      },
      {
        feature: "Çoklu AI Sağlayıcı (Gemini, OpenAI, Claude, ElevenLabs, Yerel Ollama) & Bütçe Takibi",
        note: "Görev bazlı model yönlendirme ve tam gizlilik için yerel GPU/Ollama desteği",
        starter: false,
        professional: false,
        enterprise: true,
      },
    ],
  },
  {
    id: "reports",
    title: "44+ Raporlama & Üst Yönetim Analitiği",
    description: "Temel santral CDR'larından kuyruk SLA ve yapay zeka ROI raporlarına kadar eksiksiz görünürlük",
    rows: [
      {
        feature: "Temel Santral Raporları (CDR, Ses Kayıtları, Kaçan Çağrı, DID, Trunk, Yoğunluk)",
        note: "12 hazır santral raporu + çift kanallı ses kayıt oynatıcı",
        starter: "12 Rapor",
        professional: "12 Rapor",
        enterprise: "12 Rapor",
      },
      {
        feature: "Çağrı Merkezi & Kuyruk Raporları (SLA, FCR, KPI, Mola/Puantaj, Anket, VoIP MOS)",
        note: "Temsilci kronolojisi, IVR terk, tekrar arayanlar ve süpervizör denetimi dahil",
        starter: false,
        professional: "+17 Rapor (Toplam 29)",
        enterprise: "+17 Rapor (Toplam 29)",
      },
      {
        feature: "AI, Dialer & Üst Yönetim Raporları (Transkript, Duygu Isı Haritası, AI ROI, CEO Özeti)",
        note: "Sürükle-bırak Özel Rapor Tasarımcısı, çile noktaları ve A/B verimlilik analizi",
        starter: false,
        professional: false,
        enterprise: "+15 Rapor (Toplam 44+)",
      },
    ],
  },
  {
    id: "security-infra",
    title: "Güvenlik, Altyapı & Sistem Teşhis Araçları",
    description: "Sıfır-port bulut tüneli, SIP güvenlik kalkanı, yedekleme ve paket seviyesi teşhis",
    rows: [
      {
        feature: "Nornia Connect (Sıfır-Port Şifreli Bulut Köprüsü, WireGuard & TURN)",
        starter: true,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Güvenlik Kalkanı (SIP IPS, Fail2Ban, 2FA) & Otomatik Let's Encrypt SSL",
        starter: true,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Granüler Rol & Yetki Yönetimi (RBAC) + Olay Günlükleri (Audit Log)",
        starter: true,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Sistem Yedekleme, Geri Yükleme Noktası & Kayıt Saklama Politikası (Retention)",
        starter: true,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Arayüzden Sunucu & Servis Yönetimi (Asterisk, PM2, PostgreSQL, Nginx, Güç)",
        note: "3 seviyeli rol yetkili servis kontrolü ve aktif çağrı korumalı yeniden başlatma",
        starter: true,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Sorun İnceleme: Web sngrep Çağrı Akışı & PCAP İndirme (SIP Debugger)",
        starter: false,
        professional: true,
        enterprise: true,
      },
      {
        feature: "Yönetici Kontrollü Sunucu Web SSH Terminali",
        starter: false,
        professional: false,
        enterprise: true,
      },
    ],
  },
];

export const FAQ_ITEMS = [
  {
    q: "Starter, Professional ve Enterprise planları arasında sonradan geçiş yapabilir miyiz?",
    a: "Evet. Tüm planlar aynı Nornia çekirdeği üzerinde çalışır. Başlangıçta Starter ile başlayıp ekibiniz büyüdüğünde veya yapay zeka modüllerine ihtiyaç duyduğunuzda yeniden kurulum yapmadan, yalnızca lisans anahtarınızı güncelleyerek saniyeler içinde Professional veya Enterprise paketine geçebilirsiniz.",
  },
  {
    q: "Nornia'yı kendi sunucumuza (On-Premise) kurabilir miyiz, yoksa bulut zorunlu mu?",
    a: "İkisi de desteklenir. Kendi fiziksel sunucunuza, VMware/Proxmox/VirtualBox ortamınıza Nornia ISO imajıyla veya temiz Ubuntu 24.04 LTS üzerine tek komutla kurulum yapabilirsiniz. Sunucu yönetmek istemeyen kurumlar için tam yönetilen Nornia Bulut ve operatörler için Multi-Tenant seçeneklerimiz de mevcuttur.",
  },
  {
    q: "Mevcut 0850, 0212 veya SIP Trunk operatörümüzle çalışır mı?",
    a: "Evet. Nornia standart SIP / PJSIP protokolünü kullanır. Türk Telekom, Turkcell Superonline, Vodafone, İkon Telekom, Netgsm, Bulutfon ve tüm uluslararası SIP trunk sağlayıcılarıyla numaranızı değiştirmeden doğrudan çalışır.",
  },
  {
    q: "Elimizdeki Yealink, Grandstream, Cisco veya Fanvil masa telefonlarını kullanabilir miyiz?",
    a: "Evet. Nornia'nın dahili Oto-Provizyon motoru sayesinde Yealink, Grandstream, Fanvil ve Cisco IP telefonlar MAC adresiyle dakikalar içinde otomatik yapılandırılır; Professional ve Enterprise planlarda merkezi firmware yönetimi ve DFKS canlı DND/Yönlendirme senkronizasyonu da dahildir.",
  },
  {
    q: "Yapay Zeka Sesli Asistan KVKK uyumlu mu? Verilerimiz yurt dışına çıkmadan çalışabilir mi?",
    a: "Evet. Görüşme başında sesli KVKK aydınlatma ve onay akışı otomatik yürütülebilir. Dilerseniz Gemini/OpenAI/ElevenLabs gibi bulut modellerini, dilerseniz kendi GPU sunucunuzda çalışan yerel Ollama + Whisper motorlarını kullanarak hiçbir ses ve metin verisini kurum dışına çıkarmadan yapay zeka çalıştırabilirsiniz.",
  },
  {
    q: "Tek bir sunucu kaç kullanıcı ve kaç eş zamanlı çağrı destekler?",
    a: "Tek bir Nornia sunucusu donanım kaynağına göre yüzlerce kullanıcıya ve 1.000 eş zamanlı çağrıya kadar ölçeklenebilir. Kullanıcı sayınıza, canlı AI çağrı adedinize ve ses kayıt saklama sürenize göre gereken vCPU, RAM ve disk miktarını doküman portalımızdaki interaktif Kapasite Hesaplayıcı ile anında görebilirsiniz.",
  },
  {
    q: "30 günlük deneme (Trial) sürümünde hangi özellikler açık gelir?",
    a: "30 günlük Trial lisansında Enterprise paketindeki tüm modüller — AI Sesli Asistan, 6 Dil Canlı Çeviri, Omnichannel, 44+ Rapor, Oto-Provizyon ve Nornia Connect dahil — eksiksiz olarak test edilebilir.",
  },
];
