export const SITE_CONFIG = {
  brand: "Nornia",
  tagline: "Kurumsal Yapay Zeka Santral ve İletişim Platformu",
  domain: "https://www.nornia.com.tr",
  docsUrl: "https://dokuman.nornia.com.tr",
  apiUrl: "https://api.nornia.com.tr",
  sizingCalcUrl: "https://dokuman.nornia.com.tr/ilk-kurulum-sihirbazi/",
  email: "info@nornia.com.tr",
  phoneDisplay: "0850 360 73 90",
  phoneHref: "tel:+908503607390",
  whatsappHref: "https://wa.me/908503607390?text=Merhaba%2C%20Nornia%20Kurumsal%20AI%20Santral%20hakk%C4%B1nda%20demo%20ve%20bilgi%20almak%20istiyorum.",
  location: "İstanbul, Türkiye",
};

export const HERO_METRICS = [
  { value: "44+", label: "Canlı & AI Rapor", tone: "indigo" },
  { value: "7/24", label: "AI Sesli Asistan", tone: "sky" },
  { value: "On-Prem", label: "& Bulut Esnekliği", tone: "emerald" },
  { value: "KVKK", label: "Tam Uyumlu Mimari", tone: "rose" },
];

export const COMPATIBILITY_BADGES = [
  "Yealink",
  "Cisco IP",
  "Fanvil",
  "Grandstream",
  "Asterisk PJSIP",
  "WebRTC WSS",
  "WhatsApp Cloud API",
  "Meta Direct",
  "Telegram",
  "Active Directory / LDAP",
  "PostgreSQL",
  "Ollama Yerel LLM",
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
      "Bulut AI sağlayıcıları (Gemini / OpenAI) veya tam veri gizliliği için yerel Ollama + Whisper seçeneği",
    ],
  },
  {
    id: "agent-panel",
    label: "Temsilci Çağrı Paneli",
    badge: "Tarayıcı Tabanlı WebRTC İş İstasyonu",
    title: "Yüzlerce Temsilci İçin Kurulumsuz Çağrı Merkezi Ekranı",
    description:
      "Masa telefonu, Runa Mobil veya dahili WebRTC Web Telefon tek ekranda birleşir. Temsilciler tüm çağrı kontrollerini, müşteri kartını ve mola sürelerini tek panelden yönetir.",
    screenshot: "/screenshots/04-call-center.jpg",
    screenshotAlt: "Nornia Temsilci Çağrı Paneli ve Web Telefon ekranı",
    docUrl: "https://dokuman.nornia.com.tr/temsilci-cagri-paneli/",
    bullets: [
      "Aktif çağrıda 10 canlı kontrol: Kör/Danışmalı Aktarım, Bekletme, Konferans, Çağrı Parkı, Kayıt ve DTMF",
      "Süpervizör canlı dinleme, fısıldama (whisper) ve müdahale (barge-in) yetkileri",
      "Anlık CTI müşteri kartı açılışı, çağrı notları, sonuç kodları ve kayıp çağrı geri arama kuyruğu",
      "Gerçek zamanlı vardiya, mola puantajı ve temsilci performans sayaçları",
    ],
  },
  {
    id: "omnichannel",
    label: "Omnichannel",
    badge: "Çok Kanallı Ortak Gelen Kutusu",
    title: "WhatsApp, Instagram, Telegram ve E-Posta Tek Akışta",
    description:
      "0850 kurumsal WhatsApp hattınız dahil tüm yazılı kanalları AI destekli ortak gelen kutusunda birleştirin; yapay zeka ilk yanıtı versin, gerektiğinde canlı temsilciye devretsin.",
    screenshot: "/screenshots/05-omnichannel.jpg",
    screenshotAlt: "Nornia Omnichannel Ortak Gelen Kutusu ekranı",
    docUrl: "https://dokuman.nornia.com.tr/ortak-gelen-kutusu/",
    bullets: [
      "Çoklu 0850 WhatsApp hattı desteği, etkileşimli karşılama menüleri ve mesai dışı otomatik yanıt",
      "Cevapsız kalan telefon çağrılarına otomatik WhatsApp geri dönüş mesajı",
      "CSV ile toplu WhatsApp kampanya bildirimi, hazır yanıt şablonları ve müşteri rehber eşleştirme",
      "Instagram DM, Facebook Messenger, Telegram ve SMTP/IMAP e-posta kanalları tek SLA ekranında",
    ],
  },
  {
    id: "analytics",
    label: "44+ Rapor & AI Analitik",
    badge: "Veriye Dayalı Yönetim",
    title: "Kuyruk SLA'dan Duygu Analizine 44+ Hazır Kurumsal Rapor",
    description:
      "Her çağrının transkripti, müşteri duygu skoru, sessizlik/söz kesme oranları, VoIP MOS ses kalitesi ve AI-İnsan verimlilik ROI'si otomatik hesaplanır.",
    screenshot: "/screenshots/35-reports-queue-sla.jpg",
    screenshotAlt: "Nornia Kuyruk SLA ve Kurumsal Analitik Rapor ekranı",
    docUrl: "https://dokuman.nornia.com.tr/rapor-kuyruk-sla/",
    bullets: [
      "CDR, ses kayıt dinleme, kaçan çağrı, tekrar arayanlar, kuyruk bekleme ve FCR (İlk Aramada Çözüm)",
      "Yapay zeka destekli duygu ısı haritası, müşteri çile noktaları, niyet raporu ve kalite puanlama (QA)",
      "Sürükle-bırak Özel Rapor Tasarımcısı ve e-posta ile otomatik zamanlanmış Excel/PDF gönderimi",
      "VoIP MOS kalite izleme ve dahili Web sngrep / PCAP paket inceleyici (SIP Debugger)",
    ],
  },
  {
    id: "callflow",
    label: "Görsel Arama Akışı",
    badge: "Kodsuz IVR & Yönlendirme",
    title: "Sürükle-Bırak IVR, Kuyruk ve Akıllı Zamanlama",
    description:
      "Gelen çağrıları mesai saatleri, resmi tatiller, VIP listeleri, tuşlama menüleri ve 3 kademeli abone yönlendirme kurallarına göre saniyeler içinde şekillendirin.",
    screenshot: "/screenshots/26-call-flow.jpg",
    screenshotAlt: "Nornia Görsel Arama Akışı ve IVR Editörü",
    docUrl: "https://dokuman.nornia.com.tr/arama-akis-yonetimi/",
    bullets: [
      "Görsel düğüm tabanlı IVR: Anons, tuşlama (DTMF), mesai/tatil kontrolü, AI Asistan ve ACD kuyruk",
      "Her zaman, meşgulde ve cevapsızda dinamik süreli GSM/dahili yönlendirme",
      "AI seslendirme ile saniyeler içinde kurumsal karşılama anonsu üretme",
      "Otomatik dış arama (Power/Predictive Dialer) ve geri arama kampanya yönetimi",
    ],
  },
  {
    id: "provisioning",
    label: "Oto-Provizyon & Güvenlik",
    badge: "Sıfır Dokunuşlu Altyapı",
    title: "IP Telefon Oto-Provizyon, Çok Şube ve Kurumsal Güvenlik",
    description:
      "Yealink, Cisco, Fanvil ve Grandstream telefonları MAC adresiyle otomatik yapılandırın; şubeler arası şifreli santral federasyonu ve SIP güvenlik kalkanıyla altyapınızı koruyun.",
    screenshot: "/screenshots/14-autoprovision.jpg",
    screenshotAlt: "Nornia IP Telefon Oto-Provizyon ekranı",
    docUrl: "https://dokuman.nornia.com.tr/oto-provizyon/",
    bullets: [
      "MAC tabanlı sıfır dokunuşlu IP telefon yapılandırması, BLF tuşları ve uzaktan yeniden başlatma",
      "Çok şubeli santral federasyonu (Federation) ve tam izole Multi-Tenant kiracı mimarisi",
      "Otomatik SIP IPS Güvenlik Kalkanı, Fail2Ban, 2FA, Active Directory/LDAP ve granüler RBAC yetkileri",
      "Nornia Connect ile port açmadan NAT arkasındaki santrallere şifreli HTTPS + SIP erişimi",
    ],
  },
];

export const ARCHITECTURE_CARDS = [
  {
    icon: "smartphone",
    title: "Runa Mobil & Masaüstü",
    description:
      "iOS, Android, macOS ve Windows uygulamalarıyla dahili numaranız ofis dışında da kesintisiz cebinizde; push bildirimli WebRTC ve SIP desteği.",
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
    title: "Nornia Connect & NAT'sız Erişim",
    description:
      "Statik IP veya güvenlik duvarında karmaşık port yönlendirme olmadan kendi kurumsal alan adınızla şifreli erişim ve uzaktan güvenli yönetim.",
  },
  {
    icon: "cpu",
    title: "Yüksek Ölçekli Santral Motoru",
    description:
      "Tek sunucuda 1.000+ eş zamanlı çağrı kapasitesi, çok şubeli federasyon ve aktif-aktif ölçeklenebilir PostgreSQL + Asterisk PJSIP çekirdeği.",
  },
  {
    icon: "code",
    title: "Açık REST API & CRM Webhook'ları",
    description:
      "OpenAPI 3.1 uyumlu REST API, gerçek zamanlı WebSocket olay akışı ve çift yönlü CRM/ERP webhook entegrasyonları ile mevcut yazılımlarınıza tam uyum.",
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
    modules: ["ACD Kuyruk & VIP Öncelik", "Canlı Wallboard", "Fısıldama & Dinleme", "Duygu Analizi & QA", "Otomatik Dialer"],
  },
  {
    id: "healthcare",
    name: "Sağlık, Hastane & Klinikler",
    headline: "7/24 Sesli & WhatsApp Randevu Asistanı",
    summary:
      "Hastalarınız gece gündüz telefonla veya WhatsApp üzerinden doktor müsaitliğini sorup anında randevu oluşturabilir, iptal/değişiklik yapabilir ve hatırlatma mesajı alabilir.",
    stats: [
      { value: "7/24", label: "Kesintisiz Randevu Hattı" },
      { value: "%0", label: "Cevapsız Hasta Kaybı" },
      { value: "%100", label: "KVKK Uyumlu Kayıt" },
    ],
    modules: ["AI Randevu Takvimi", "KVKK Sesli Onay Akışı", "Cevapsız Çağrı WhatsApp Dönüşü", "Çoklu Klinik Şubesi", "RAG Tedavi Bilgi Bankası"],
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
    modules: ["WhatsApp 0850 & Instagram DM", "CRM / Kargo API Araç Çağrısı", "Toplu Kampanya Bildirimi", "AI vs İnsan ROI Raporu", "Tek Tıkla Canlı Devir"],
  },
  {
    id: "enterprise",
    name: "Çok Şubeli Kurumlar & Finans",
    headline: "Merkezi Yönetim, Tam Şube ve Veri İzolasyonu",
    summary:
      "Farklı şehirlerdeki şubelerinizi tek santral federasyonunda birleştirin. Active Directory/LDAP entegrasyonu, donanıma bağlı lisanslama ve yerel LLM ile regülasyonlara tam uyum sağlayın.",
    stats: [
      { value: "On-Prem", label: "Tam Veri Hakimiyeti" },
      { value: "LDAP/2FA", label: "Kurumsal Kimlik Güvenliği" },
      { value: "Sınırsız", label: "Şube Federasyonu" },
    ],
    modules: ["Multi-Tenant & Federation", "Yealink/Cisco Oto-Provizyon", "Active Directory & RBAC", "Yerel Ollama/Whisper AI", "SIP IPS Güvenlik Kalkanı"],
  },
];

export const DEPLOYMENT_PLANS = [
  {
    name: "Kurumsal On-Premise",
    badge: "Tam Veri Hakimiyeti",
    description:
      "Kendi fiziksel veya sanal sunucunuzda çalışan, KVKK ve regülasyon odaklı tam bağımsız santral kurulumu.",
    featured: false,
    cta: "On-Premise Teklifi Al",
    features: [
      "ISO veya tek komut Ubuntu 24.04 LTS kurulumu",
      "Tüm ses kayıtları ve veritabanı kendi sunucunuzda",
      "Yerel LLM (Ollama / Whisper) veya bulut AI seçimi",
      "Donanıma bağlı kriptografik lisans & çevrimdışı çalışma",
      "Yealink, Cisco, Fanvil, Grandstream oto-provizyon",
      "Active Directory / LDAP ve 44+ rapor paketi dahil",
    ],
  },
  {
    name: "Nornia Bulut (Yönetilen)",
    badge: "En Çok Tercih Edilen",
    description:
      "Sunucu bakımıyla uğraşmadan dakikalar içinde devreye alınan, yüksek erişilebilirlikli yönetilen bulut santral.",
    featured: true,
    cta: "Canlı Demo & Teklif Al",
    features: [
      "Kendi kurumsal alan adınız (sirketiniz.nornia.com.tr) + otomatik SSL",
      "AI Sesli Asistan, Omnichannel (WhatsApp/Instagram/Telegram/E-posta)",
      "Runa Mobil, Masaüstü ve tarayıcı WebRTC Web Telefon",
      "7/24 izleme, otomatik günlük yedekleme ve sıfır kesinti güncellemeler",
      "0850 / 0212 / tüm Türk SIP operatörleriyle anında entegrasyon",
      "Esnek abone ve eş zamanlı çağrı ölçeklendirme",
    ],
  },
  {
    name: "Enterprise & Multi-Tenant",
    badge: "Büyük Ölçek & Operatörler",
    description:
      "Yüzlerce temsilci, çoklu şube federasyonu veya kendi müşterilerine hizmet veren telekom/BPO yapıları için.",
    featured: false,
    cta: "Mimari Görüşme Planla",
    features: [
      "Sınırsız izole kiracı (Multi-Tenant) ve şube federasyonu",
      "Aktif-Aktif yüksek erişilebilirlik (HA) & yük dengeleme mimarisi",
      "1.000+ eş zamanlı çağrı ve özel donanım/GPU boyutlandırma",
      "Özel CRM/ERP entegrasyonu, OpenAPI 3.1 ve webhook desteği",
      "Özel marka (White-Label) arayüz ve merkezi filo yönetimi",
      "Adanmış mühendislik desteği ve kurumsal SLA garantisi",
    ],
  },
];

export const FAQ_ITEMS = [
  {
    q: "Nornia'yı kendi sunucumuza (On-Premise) kurabilir miyiz, yoksa bulut zorunlu mu?",
    a: "İkisi de desteklenir. Kendi fiziksel sunucunuza, VMware/Proxmox/VirtualBox ortamınıza Nornia ISO imajıyla veya temiz Ubuntu 24.04 LTS üzerine tek komutla kurulum yapabilirsiniz. Sunucu yönetmek istemeyen kurumlar için tam yönetilen Nornia Bulut seçeneğimiz de mevcuttur.",
  },
  {
    q: "Mevcut 0850, 0212 veya SIP Trunk operatörümüzle çalışır mı?",
    a: "Evet. Nornia standart SIP / PJSIP protokolünü kullanır. Türk Telekom, Turkcell Superonline, Vodafone, İkon Telekom, Netgsm, Bulutfon ve tüm uluslararası SIP trunk sağlayıcılarıyla numaranızı değiştirmeden doğrudan çalışır.",
  },
  {
    q: "Elimizdeki Yealink, Cisco veya Fanvil masa telefonlarını kullanabilir miyiz?",
    a: "Evet. Nornia'nın dahili Oto-Provizyon motoru sayesinde Yealink, Cisco, Fanvil ve Grandstream IP telefonlar MAC adresiyle dakikalar içinde otomatik yapılandırılır. Masa telefonuna ek olarak tarayıcıdaki Web Telefon ve Runa Mobil/Masaüstü uygulamalarıyla eş zamanlı çalışabilir.",
  },
  {
    q: "Yapay Zeka Sesli Asistan KVKK uyumlu mu? Verilerimiz yurt dışına çıkmadan çalışabilir mi?",
    a: "Evet. Görüşme başında sesli KVKK aydınlatma ve onay akışı otomatik yürütülebilir. Dilerseniz Gemini/OpenAI gibi bulut modellerini, dilerseniz kendi GPU sunucunuzda çalışan yerel Ollama + Whisper motorlarını kullanarak hiçbir ses ve metin verisini kurum dışına çıkarmadan yapay zeka çalıştırabilirsiniz.",
  },
  {
    q: "Tek bir sunucu kaç kullanıcı ve kaç eş zamanlı çağrı destekler?",
    a: "Tek bir Nornia sunucusu donanım kaynağına göre yüzlerce kullanıcıya ve 1.000 eş zamanlı çağrıya kadar ölçeklenebilir. Kullanıcı sayınıza, canlı AI çağrı adedinize ve ses kayıt saklama sürenize göre gereken vCPU, RAM ve disk miktarını doküman portalımızdaki interaktif Kapasite Hesaplayıcı ile anında görebilirsiniz.",
  },
  {
    q: "Mevcut CRM veya ERP yazılımımızla entegre olabilir mi?",
    a: "Evet. Nornia'nın kapsamlı REST API'si (api.nornia.com.tr), gelen çağrı CTI müşteri kartı açılışı ve çift yönlü webhook desteği bulunur. Ayrıca AI Sesli Asistan görüşme esnasında arka planda kendi CRM/ERP API'nizi çağırıp sipariş, borç veya randevu bilgisini müşteriye doğal sesle aktarabilir.",
  },
  {
    q: "Kurulum ve devreye alma süreci ne kadar sürer?",
    a: "Standart bir kurulum 15–30 dakika içinde tamamlanır ve 6 adımlı İlk Kurulum Sihirbazı ile ağ, lisans, dahili numara planı ve yönetici hesabı kolayca yapılandırılır. Mevcut numara aktarımı, IVR senaryosu ve AI bilgi bankası eğitimiyle birlikte çoğu kurum aynı gün canlıya geçer.",
  },
];
