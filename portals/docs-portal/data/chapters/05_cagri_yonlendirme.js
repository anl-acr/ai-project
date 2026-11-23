export const CHAPTERS_CAGRI_YONLENDIRME = [
  {
    id: "arama-akis-yonetimi",
    number: "28",
    groupId: "cagri-yonlendirme",
    category: "Çağrı & Yönlendirme",
    title: "Arama Akış Yönetimi (Görsel CallFlow & IVR Tasarımcısı)",
    shortTitle: "Arama Akış Yönetimi",
    menuPath: "Çağrı & Yönlendirme → Arama Akış Yönetimi",
    pbxRoute: "/?tab=arama-akislari",
    permissions: ["call_flow:read", "call_flow:write", "call_flow:delete"],
    badge: "Sürükle-Bırak IVR • Simülatör • Koşullu Dallanma",
    readMinutes: 14,
    summary:
      "Gelen çağrıların saniye saniye nasıl karşılanacağını kod yazmadan sürükle-bırak düğümlerle (node-based) tasarladığınız kurumsal IVR ve CallFlow motorudur. Mesai saati/resmi tatil kontrolü, sesli anons (kayıtlı veya TTS), tuşlama menüsü (DTMF 0–9), harici API/CRM sorgusu, döngü/hata limiti, AI Sesli Asistan, ACD Kuyruk, Dahili ve Sesli Posta yönlendirmelerini tek tuvalde birleştirir ve canlı çağrı simülatörüyle test imkanı verir.",
    screenshots: [
      {
        src: "/screenshots/26-call-flow.jpg",
        caption: "Arama Akış Yönetimi (CallFlow Editor) — Sürükle-bırak IVR akış tuvali, Mesai/Tatil dalları ve düğüm özellikleri",
        routeHint: "Çağrı & Yönlendirme → Arama Akış Yönetimi"
      }
    ],
    fieldTable: [
      { field: "Akış Başlangıcı (node-start)", type: "Kök Düğüm", defaultVal: "Her akışta 1 adet", required: true, description: "Gelen Arama Kuralından (DID) gelen çağrının akışa girdiği giriş noktası." },
      { field: "Mesai & Resmi Tatil Kontrolü", type: "3 Çıkış (active / inactive / holiday)", defaultVal: "Mesai Takvimi", required: false, description: "Çağrıyı Mesai Saatleri, Mesai Dışı ve Resmi Tatil kollarına otomatik ayırır." },
      { field: "IVR Tuşlama Menüsü (DTMF)", type: "0–9, *, # + Tekrar/Hata Kolu", defaultVal: "Timeout 5 sn, 3 deneme", required: false, description: "Kayıtlı anons veya TTS okuyup müşterinin tuşladığı rakama göre (1: Satış, 2: Destek vb.) ilgili kola yönlendirir. Hatalı tuşlamada döngü veya operatör koluna geçer." },
      { field: "Anons Oynat (recorded / tts)", type: "Ses Dosyası / TTS", defaultVal: "Kesintisiz veya Tuşla Geçilebilir", required: false, description: "KVKK bilgilendirme, kampanya veya tatil duyurusu çalar." },
      { field: "Koşul / Değişken & API Sorgusu", type: "true / false veya success / error", defaultVal: "Dinamik", required: false, description: "Arayan numara, DID veya Evrensel API sorgu sonucuna (örn. VIP müşteri mi?) göre akışı dinamik dallandırır." },
      { field: "Hedefe Yönlendir", type: "ACD Kuyruk / Dahili / AI Temsilci / Konferans / Dış Numara / Sesli Posta", defaultVal: "Seçimli", required: true, description: "Çağrıyı son hedefe iletir; ulaşılamazsa alternatif kol (fallback) tanımlanabilir." },
      { field: "Canlı Akış Simülatörü", type: "Test Aracı (/api/settings/call-flow/simulate)", defaultVal: "Ücretsiz Test", required: false, description: "Gerçek telefon aramadan örnek tarih, saat, arayan numara ve tuşlama vererek çağrının hangi düğümlerden geçtiğini adım adım simüle eder." }
    ],
    sections: [
      {
        heading: "1. Örnek Kurumsal 7/24 Hibrit (İnsan + AI) CallFlow Mimarisi",
        body: "En yaygın kurumsal senaryoda mesai saatlerinde müşteri IVR'dan satış/destek kuyruğuna gider; mesai dışında veya resmi tatillerde ise doğrudan Yapay Zeka Sesli Asistanı devreye girerek 7/24 sipariş/randevu alır:",
        codeBlock: {
          title: "Örnek CallFlow Dallanma Şeması",
          lang: "text",
          code: `[Akış Başlangıcı (DID: 908503607390)]
   └── [Mesai & Tatil Kontrolü]
         ├── (Mesai Saatleri: Pzt-Cum 09:00-18:00)
         │     └── [KVKK & Karşılama IVR Menüsü]
         │           ├── Tuş 1 -> [ACD Kuyruk: 2000 Satış] --(120sn Taşma)--> [AI Asistan: Sales_AI]
         │           ├── Tuş 2 -> [ACD Kuyruk: 2001 Teknik Destek]
         │           ├── Tuş 0 / Zaman Aşımı -> [Resepsiyon Dahili: 1000]
         ├── (Mesai Dışı)
         │     └── [Anons: Mesai Dışı] -> [AI Asistan: 7/24 Nöbetçi Asistan]
         └── (Resmi Tatil)
               └── [Anons: Bayram/Tatil Duyurusu] -> [Sesli Posta / WhatsApp Yönlendirme]`
        }
      },
      {
        heading: "2. Çoklu Akış (Workflow) Yönetimi",
        body: "Birden fazla bağımsız arama akışı (örn. Ana Hat IVR, Teknik Destek Hattı IVR, Kampanya Hattı) oluşturup her birini Gelen Arama Kurallarında farklı DID numaralarına bağlayabilirsiniz."
      }
    ],
    troubleshooting: [
      { problem: "IVR tuşlamalarım algılanmıyor", cause: "SIP Trunk DTMF modu operatörle uyuşmuyor (inband vs rfc4733).", solution: "Santral → Dış Hat Tanımı → Gelişmiş sekmesinde DTMF modunu 'rfc4733' (veya 'auto') yapıp kaydedin." },
      { problem: "Tasarladığım yeni CallFlow devreye girmedi", cause: "Akış kaydedilmiş ama Gelen Arama Kuralında hedef olarak bu akış seçilmemiş.", solution: "Santral → Gelen Arama Kuralı ekranında ilgili DID'nin hedefini yeni CallFlow olarak seçip kaydedin." }
    ],
    relatedPages: ["gelen-arama-kurali", "mesai-ve-resmi-tatiller", "anons-yonetimi", "ai-temsilcileri"],
    relatedApis: ["GET /api/v1/inbound-rules", "POST /api/v1/inbound-rules"]
  },
  {
    id: "mesai-ve-resmi-tatiller",
    number: "29",
    groupId: "cagri-yonlendirme",
    category: "Çağrı & Yönlendirme",
    title: "Mesai Saatleri & Resmi Tatil Takvimi",
    shortTitle: "Mesai & Resmi Tatiller",
    menuPath: "Çağrı & Yönlendirme → Mesai & Resmi Tatiller",
    pbxRoute: "/?tab=mesai-ve-tatiller",
    permissions: ["work_hours:read", "work_hours:write", "work_hours:delete"],
    badge: "Haftalık Takvim • Türkiye Resmi Tatilleri • Öğle Arası",
    readMinutes: 7,
    summary:
      "Şirketinizin haftalık çalışma saatlerini (gün bazlı açılış/kapanış ve öğle arası dahil) ve Türkiye resmi/dini tatil günlerini (1 Ocak, 23 Nisan, 1 Mayıs, 19 Mayıs, 15 Temmuz, 30 Ağustos, 29 Ekim, Ramazan & Kurban Bayramı + özel şirket tatilleri) tanımladığınız merkezi zaman motorudur.",
    screenshots: [
      {
        src: "/screenshots/27-work-hours.jpg",
        caption: "Mesai & Resmi Tatiller — Haftalık gün-saat takvimi ve resmi tatil günleri listesi",
        routeHint: "Çağrı & Yönlendirme → Mesai & Resmi Tatiller"
      }
    ],
    fieldTable: [
      { field: "Gün Bazlı Çalışma Saatleri", type: "Pazartesi–Pazar (Başlangıç–Bitiş)", defaultVal: "Pzt–Cum 09:00–18:00", required: true, description: "Her gün bağımsız açık/kapalı işaretlenebilir (örn. Cumartesi 09:00–13:00 yarım gün, Pazar kapalı)." },
      { field: "Resmi Tatiller Listesi", type: "Tarih + Ad + Tekrarlama", defaultVal: "TR Resmi Tatiller Hazır", required: false, description: "Tarih geldiğinde CallFlow'un 'Resmi Tatil (holiday)' kolunu ve WhatsApp mesai dışı otomatik yanıtını otomatik tetikler." },
      { field: "Özel Şirket Tatili / Acil Kapanış", type: "Tarih Aralığı", defaultVal: "Opsiyonel", required: false, description: "Planlı bakım, elektrik kesintisi veya şirket etkinliği günlerinde tek tıkla tatil anonsuna geçebilirsiniz." },
      { field: "Saat Dilimi", type: "Timezone", defaultVal: "Europe/Istanbul (UTC+3)", required: true, description: "Sistem Ayarları → Tarih, Saat & Bölge Ayarları ile tam senkronizedir." }
    ],
    sections: [
      {
        heading: "1. Hem Sesli Santral Hem WhatsApp AI ile Ortak Kullanım",
        body: "Burada belirlediğiniz mesai ve tatil saatleri hem Arama Akışı (CallFlow) Mesai Kontrol düğümünde hem de WhatsApp Mesai Dışı Otomatik Yanıtlayıcıda (After-Hours Auto-Responder) tek merkezden kullanılır."
      }
    ],
    troubleshooting: [
      { problem: "Saat 10:00 olmasına rağmen santral mesai dışı anonsu çalıyor", cause: "Sunucu saat dilimi UTC'de kalmış veya o gün Resmi Tatiller listesinde işaretli olabilir.", solution: "Sistem Ayarları → Tarih, Saat & Bölge ekranında Europe/Istanbul (UTC+3) seçili olduğunu ve bugün için aktif tatil kaydı olmadığını kontrol edin." }
    ],
    relatedPages: ["arama-akis-yonetimi", "bakim-yedekleme-ve-kayit-saklama", "ortak-gelen-kutusu"],
    relatedApis: ["GET /api/system/overview"]
  },
  {
    id: "dis-arama-dialer",
    number: "30",
    groupId: "cagri-yonlendirme",
    category: "Çağrı & Yönlendirme",
    title: "Otomatik Dış Arama (Outbound Dialer & Kampanyalar)",
    shortTitle: "Dış Arama (Dialer)",
    menuPath: "Çağrı & Yönlendirme → Dış Arama (Dialer)",
    pbxRoute: "/?tab=dis-arama-dialer",
    permissions: ["dialer:read", "dialer:write", "dialer:delete"],
    badge: "AI Dialer • Kuyruk Dialer • CSV • Tekrar Deneme",
    readMinutes: 10,
    summary:
      "Binlerce müşteriyi randevu teyidi, tahsilat hatırlatma, memnuniyet anketi veya satış kampanyası için otomatik olarak arayan; açılan çağrıları doğrudan Yapay Zeka Sesli Asistana, ACD Kuyruğa veya sesli anonsa bağlayan, eşzamanlı kanal hızı ve tekrar deneme (retry) kontrollü kurumsal dış arama motorudur.",
    screenshots: [
      {
        src: "/screenshots/28-dialer.jpg",
        caption: "Dış Arama (Dialer) — Kampanya kartları, canlı ilerleme çubuğu, CSV numara yükleme ve Başlat/Duraklat kontrolü",
        routeHint: "Çağrı & Yönlendirme → Dış Arama (Dialer)"
      }
    ],
    fieldTable: [
      { field: "Kampanya Adı & Arama Modu", type: "AI Asistan / ACD Kuyruk / Sesli Anons", defaultVal: "AI Asistan", required: true, description: "AI Modu: Müşteri açtığında seçilen AI Temsilci kişiselleştirilmiş veriyle (isim, borç, randevu saati) konuşur. Kuyruk Modu: Müsait temsilciye aktarır." },
      { field: "Eşzamanlı Kanal Sayısı (Concurrency)", type: "Integer (1–50)", defaultVal: "3", required: true, description: "Aynı anda kaç dış arama yapılacağını belirler. Lisans ve SIP Trunk kanal limitini aşmamalıdır." },
      { field: "Çıkış CallerID & Zaman Penceresi", type: "DID + Saat Aralığı", defaultVal: "09:30–18:30", required: true, description: "Müşterilerin gece veya mesai dışında aranmasını yasal olarak engelleyen çalışma saati penceresi." },
      { field: "Tekrar Deneme (Retry) Politikası", type: "Deneme Sayısı + Bekleme (dk)", defaultVal: "2 deneme / 30 dk arayla", required: false, description: "Meşgul veya cevapsız kalan numaraları belirtilen dakika sonra otomatik tekrar arar." },
      { field: "CSV / Excel Liste Yükleme", type: "phone, name, custom_data", defaultVal: "UTF-8 CSV", required: true, description: "Müşteriye özel sütunlar (örn. fatura_tutari, arac_plakasi) AI asistanın sistem bağlamına otomatik geçer." }
    ],
    sections: [
      {
        heading: "1. Örnek CSV Kampanya Dosya Biçimi",
        body: "Kampanya oluşturduktan sonra aşağıdaki formatta CSV dosyanızı yükleyip 'Başlat' butonuna basmanız yeterlidir:",
        codeBlock: {
          title: "Örnek Dialer CSV Dosyası (UTF-8)",
          lang: "csv",
          code: `phone,name,randevu_tarihi,not
05321234567,Ahmet Yılmaz,25 Kasım 14:30,Yıllık bakım teyidi
05429876543,Ayşe Kaya,25 Kasım 16:00,Demo görüşmesi hatırlatma`
        }
      }
    ],
    troubleshooting: [
      { problem: "Kampanyayı başlattım ama hiç arama çıkmıyor", cause: "Şu anki saat kampanya zaman penceresi dışında, aktif SIP Trunk yok veya listede 'Bekliyor (pending)' kayıt kalmamış.", solution: "Kampanya zaman penceresini ve yüklenen numara listesinde bekleyen kayıt sayısını kontrol edin." }
    ],
    relatedPages: ["ai-temsilcileri", "dis-hat-tanimi", "omnichannel-voip-ve-diger-raporlar"],
    relatedApis: ["GET /api/settings/dialer/campaigns", "POST /api/settings/dialer/campaigns", "POST /api/settings/dialer/campaigns/{campaign_id}/upload-list", "POST /api/settings/dialer/campaigns/{campaign_id}/control"]
  },
  {
    id: "randevu-takvimi",
    number: "31",
    groupId: "cagri-yonlendirme",
    category: "Çağrı & Yönlendirme",
    title: "Randevu Takvimi (AI & Temsilci Randevu Yönetimi)",
    shortTitle: "Randevu Takvimi",
    menuPath: "Çağrı & Yönlendirme → Randevu Takvimi",
    pbxRoute: "/?tab=takvim",
    permissions: ["calendar:read", "calendar:write", "calendar:delete"],
    badge: "AI Otomatik Kayıt • Aylık/Haftalık • Durum Takibi",
    readMinutes: 6,
    summary:
      "Yapay Zeka Sesli Asistanları, WhatsApp botları ve insan temsilcilerin müşterilerle görüşme sırasında oluşturduğu tüm randevuların aylık/haftalık/liste görünümünde yönetildiği, onay/iptal/hatırlatma durumlarının takip edildiği kurumsal randevu takvimidir.",
    screenshots: [
      {
        src: "/screenshots/29-calendar.jpg",
        caption: "Randevu Takvimi — AI ve temsilci tarafından alınan randevular, durum filtreleri ve yeni randevu ekleme",
        routeHint: "Çağrı & Yönlendirme → Randevu Takvimi"
      }
    ],
    fieldTable: [
      { field: "Müşteri Adı & Telefonu", type: "Metin + Telefon", defaultVal: "Zorunlu", required: true, description: "Randevu sahibinin kimliği; tek tıkla WebPhone ile aranabilir veya WhatsApp teyit mesajı gönderilebilir." },
      { field: "Randevu Tarih & Saati", type: "YYYY-MM-DD HH:MM", defaultVal: "Zorunlu", required: true, description: "AI Asistan canlı çağrıda çakışma kontrolü yaparak müsait saate doğrudan kayıt oluşturur." },
      { field: "Kaynak (AI / Temsilci / API)", type: "Otomatik Rozet", defaultVal: "Otomatik", required: false, description: "Randevunun telefon AI asistanından mı, WhatsApp'tan mı yoksa dış API'den mi geldiğini gösterir." },
      { field: "Durum", type: "Bekliyor / Onaylandı / Tamamlandı / İptal", defaultVal: "Onaylandı", required: false, description: "AI Randevu & Bilgi Bankası Raporu'nda dönüşüm oranı hesaplanır." }
    ],
    sections: [
      {
        heading: "1. AI Sesli Asistan ile Otomatik Randevu Alma",
        body: "AI Temsilci konuşma sırasında müşteriden ad, telefon ve uygun tarih/saati aldığında Async Tool Engine üzerinden arka planda PostgreSQL appointments tablosuna kaydı işler ve müşteriye sesli teyit verir. Kayıt saniyeler içinde bu takvimde görünür."
      }
    ],
    troubleshooting: [
      { problem: "AI görüşmede randevu aldığını söyledi ama takvimde görünmüyor", cause: "AI senaryosunda randevu oluşturma aracı/talimatı aktif değil veya tenant eşleşmesi farklı.", solution: "AI Temsilcisi ayarlarında randevu aracının etkin olduğunu ve doğru aktif tenant'a baktığınızı doğrulayın." }
    ],
    relatedPages: ["ai-temsilcileri", "ai-analitik-duygu-niyet-qa", "ortak-gelen-kutusu"],
    relatedApis: ["GET /api/v1/appointments", "POST /api/v1/appointments"]
  }
];
