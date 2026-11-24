// Çağrı Raporları & Analiz — Raporlar 23–44 (Her Rapor İçin Ayrı Sayfa, Canlı Görsel & PDF)
export const CHAPTERS_RAPORLAR_B = [
  {
    id: "rapor-hatali-cagri",
    number: "55",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Hatalı & Eşleşmeyen Çağrı Raporu (Arıza & Yetki Teşhisi)",
    shortTitle: "Hatalı & Eşleşmeyen Çağrı",
    menuPath: "Çağrı Raporları & Analiz → Hatalı & Eşleşmeyen Çağrı",
    pbxRoute: "/?tab=raporlar-hatali-cagri",
    permissions: ["reports_invalid_calls:access"],
    badge: "Rapor 23/44 • SIP Hata Teşhisi",
    readMinutes: 6,
    summary:
      "Yanlış çevrilen numaraları, giden arama kuralı/yetkisi bulunmayan çıkış denemelerini, DID kuralı eşleşmeyen gelen aramaları ve operatör red (CONGESTION/CHANUNAVAIL) hatalarını anlaşılır Türkçe nedenleriyle listeler.",
    screenshots: [
      { src: "/screenshots/reports/rapor-hatali-cagri.jpg", caption: "Hatalı & Eşleşmeyen Çağrı — Başarısız arama denemeleri ve Türkçe kök neden teşhisi", routeHint: "Çağrı Raporları & Analiz → Hatalı & Eşleşmeyen Çağrı" }
    ],
    fieldTable: [
      { field: "Arayan, Çevrilen Numara & Hata Kategorisi", type: "Kural Yok / Yetkisiz / Operatör Reddi / Karantina", defaultVal: "Otomatik Teşhis", required: false, description: "Bir kullanıcı 'dışarıyı arayamıyorum' dediğinde saniyeler içinde eksik giden kuralı veya operatör hatasını gösterir." },
      { field: "SIP Yanıt Kodu & Önerilen Çözüm", type: "403 / 404 / 486 / 503", defaultVal: "Türkçe Açıklama", required: false, description: "Teknik SIP kodlarını yöneticinin hemen düzeltebileceği sade açıklamaya çevirir." }
    ],
    sections: [
      {
        heading: "1. Eksik Yönlendirme Kurallarını Anında Yakalama",
        body: "Yeni satın alınan bir 0850 hattı Gelen Arama Kuralı'na eklenmeyi unutulursa gelen çağrılar anında bu raporda görünür.",
        steps: [
          "Son 24 saatteki hatalı çağrıları listeleyin.",
          "'DID Eşleşmedi' veya 'Giden Kural Yok' uyarısı veren numaralar için ilgili kuralı ekleyin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Çok sayıda 'Yetkisiz Uluslararası Deneme' görünüyor", cause: "Bir abone yetkisi olmayan yurt dışı numara aramaya çalışıyor veya hesap ele geçirilmiş olabilir.", solution: "İlgili aboneyi kontrol edin; şüpheliyse Dış Arama Karantinası'na alıp SIP şifresini yenileyin." }
    ],
    relatedPages: ["giden-arama-kurali", "gelen-arama-kurali", "sorun-inceleme-sip-debugger"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-ivr-terk",
    number: "56",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "IVR Terk Oranı & Tuşlama (DTMF) Dağılım Raporu",
    shortTitle: "IVR Terk Oranı",
    menuPath: "Çağrı Raporları & Analiz → IVR Terk Oranı",
    pbxRoute: "/?tab=raporlar-ivr-terk",
    permissions: ["reports_ivr_drop:access"],
    badge: "Rapor 24/44 • CallFlow • DTMF Analizi",
    readMinutes: 6,
    summary:
      "Müşterilerin Görsel Arama Akışı (CallFlow) IVR menüsünde hangi tuşlara (1, 2, 3...) ne oranda bastığını ve menüde ilerlemeden tam hangi düğümde/saniyede telefonu kapattığını (IVR Drop) ölçer.",
    screenshots: [
      { src: "/screenshots/reports/rapor-ivr-terk.jpg", caption: "IVR Terk Oranı — CallFlow düğüm bazlı terk yüzdeleri ve DTMF tuşlama dağılımı", routeHint: "Çağrı Raporları & Analiz → IVR Terk Oranı" }
    ],
    fieldTable: [
      { field: "IVR Düğüm Bazlı Giriş & Terk Oranı (%)", type: "Huni (Funnel) Analizi", defaultVal: "CallFlow Senkron", required: false, description: "Çok uzun veya karmaşık anons nedeniyle müşterilerin yarıda kapattığı düğümleri tespit eder." },
      { field: "DTMF Tuşlama Dağılımı (1–9, 0, *, #)", type: "Adet & %", defaultVal: "Tuş Bazlı", required: false, description: "En çok seçilen departmanı 1. sıraya alarak müşteri deneyimini hızlandırmanızı sağlar." }
    ],
    sections: [
      {
        heading: "1. IVR Menüsünü Sadeleştirme",
        body: "30 saniyeden uzun karşılama anonsları IVR terk oranını %25'in üzerine çıkarır; bu raporla hangi anonsun kısaltılması gerektiğini veriye dayalı görürsünüz.",
        steps: [
          "Terk yüzdesi %15 üzerindeki IVR düğümlerini belirleyin.",
          "Arama Akış Yönetimi'nde o düğümün anonsunu kısaltın ve en popüler seçeneği ilk sıraya alın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Hatalı/zaman aşımı tuşlama oranı yüksek", cause: "Anons bitmeden tuşlama izni veya bekleme süresi çok kısa.", solution: "CallFlow IVR düğümünde timeout süresini 5–7 sn yapın ve geçersiz tuşta otomatik ana kuyruğa aktarın." }
    ],
    relatedPages: ["arama-akis-yonetimi", "anons-yonetimi", "rapor-kuyruk-bekleme"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-aktarma-bekletme",
    number: "57",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Aktarma (Transfer) & Bekletme (Hold) Analiz Raporu",
    shortTitle: "Aktarma & Bekletme",
    menuPath: "Çağrı Raporları & Analiz → Aktarma & Bekletme",
    pbxRoute: "/?tab=raporlar-aktarma-bekletme",
    permissions: ["reports_transfer_hold:access"],
    badge: "Rapor 25/44 • Kör/Danışmalı • Hold sn",
    readMinutes: 6,
    summary:
      "Görüşme sırasında hangi temsilcilerin çağrıyı en sık başka dahiliye/kuyruğa aktardığını (Kör & Danışmalı Transfer) ve müşteriyi bekleme müziğinde (Hold) ortalama kaç saniye beklettiğini ölçer.",
    screenshots: [
      { src: "/screenshots/reports/rapor-aktarma-bekletme.jpg", caption: "Aktarma & Bekletme — Temsilci bazlı transfer adedi, aktarım matrisi ve ortalama Hold süresi", routeHint: "Çağrı Raporları & Analiz → Aktarma & Bekletme" }
    ],
    fieldTable: [
      { field: "Transfer Adedi & Oranı (Kör / Danışmalı)", type: "Temsilci & Hedef Kırılımı", defaultVal: "call_legs Kaynaklı", required: false, description: "Gereksiz 'topu başkasına atma' davranışlarını ve yanlış IVR yönlendirmelerini ortaya çıkarır." },
      { field: "Ortalama & Maksimum Bekletme (Hold) Süresi", type: "Saniye", defaultVal: "Müşteri Sabır Metriği", required: false, description: "Müşteriyi uzun süre hatta bekleten bilgi eksikliklerini (RAG/AI Fısıldama ihtiyacı) tespit eder." }
    ],
    sections: [
      {
        heading: "1. Müşteriyi Departmanlar Arası Dolaştırmayı Önleme",
        body: "Bir kuyruktan başka bir kuyruğa sürekli transfer yapılıyorsa IVR anonsu net değildir veya temsilcinin yetkisi eksiktir.",
        steps: [
          "En sık transfer yapılan kaynak → hedef çiftlerini inceleyin.",
          "AI Fısıldama veya Bilgi Bankası (RAG) dokümanlarını güçlendirerek bekletme süresini düşürün."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Transfer sayısı yüksek ama hepsi AI'dan geliyor", cause: "AI Temsilcisi canlı aktarım kurallarıyla çağrıları satış/destek kuyruğuna devrediyor.", solution: "Temsilci filtresinden insan dahilileri seçerek sadece ekip içi transferleri ayrı değerlendirin." }
    ],
    relatedPages: ["rapor-cdr", "rapor-fcr", "rapor-sessizlik-soz-kesme"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-verimlilik-ab",
    number: "58",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Verimlilik Karşılaştırması (A/B Testi: AI vs. İnsan / Ekip vs. Ekip)",
    shortTitle: "Verimlilik Karşılaştırması",
    menuPath: "Çağrı Raporları & Analiz → Verimlilik Karşılaştırması",
    pbxRoute: "/?tab=raporlar-verimlilik",
    permissions: ["reports_ab_testing:access"],
    badge: "Rapor 26/44 • A/B Kıyas • FCR & CSAT",
    readMinutes: 6,
    summary:
      "Yapay zeka asistanları ile insan temsilcileri veya iki farklı AI senaryosunu/kuyruğunu (Grup A vs. Grup B) ortalama görüşme süresi (AHT), çözüm oranı (FCR), duygu skoru ve kalite puanı (QA) ekseninde yan yana kıyaslar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-verimlilik-ab.jpg", caption: "Verimlilik Karşılaştırması (A/B) — AI vs. İnsan veya farklı kuyruk/senaryo performans kıyası", routeHint: "Çağrı Raporları & Analiz → Verimlilik Karşılaştırması" }
    ],
    fieldTable: [
      { field: "Grup A vs. Grup B Karşılaştırma Kartları", type: "AHT / FCR % / QA / Pozitif Duygu %", defaultVal: "AI vs. İnsan", required: false, description: "Yeni bir AI prompt veya senaryo değişikliğinin çözüm oranını gerçekten artırıp artırmadığını ölçer." },
      { field: "Kazanan Varyant & Yüzdesel Fark Göstergesi", type: "+% / -% Delta", defaultVal: "Otomatik Hesap", required: false, description: "Veriye dayalı optimizasyon kararları almanızı sağlar." }
    ],
    sections: [
      {
        heading: "1. AI Senaryosu ve Kuyruk Stratejisi Testi",
        body: "İki farklı karşılama veya satış senaryosunu aynı dönemde kıyaslayıp yüksek dönüşümlü olanı kalıcı hale getirebilirsiniz.",
        steps: [
          "Karşılaştırmak istediğiniz iki grubu (örn. Satış AI vs. Satış Kuyruğu) seçin.",
          "AHT, pozitif duygu ve çözüm yüzdelerindeki farkı inceleyin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Gruplardan birinde veri yetersiz uyarısı var", cause: "İstatistiksel karşılaştırma için seçili dönemde yeterli çağrı oluşmamış.", solution: "Tarih aralığını Son 30 Gün veya 90 Gün olarak genişletin." }
    ],
    relatedPages: ["rapor-ai-insan-roi", "ai-temsilcileri", "rapor-kalite-degerlendirmeleri"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-musteri-cile-noktalari",
    number: "59",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Müşteri Çile Noktaları (Tekrarlayan Şikayet & Darboğaz Radarı)",
    shortTitle: "Müşteri Çile Noktaları",
    menuPath: "Çağrı Raporları & Analiz → Müşteri Çile Noktaları",
    pbxRoute: "/?tab=raporlar-cile-noktalari",
    permissions: ["reports_friction:access"],
    badge: "Rapor 27/44 • AI Kök Neden • Şikayet Kümesi",
    readMinutes: 6,
    summary:
      "Negatif duygu, yüksek tekrar arama ve uzun görüşmelerden yola çıkarak müşterileri en çok yoran operasyonel darboğazları (örn. kargo gecikmesi, fatura hatası, uzun bekleme, eksik bilgilendirme) yapay zeka ile kümeleyip öncelik sırasıyla sunar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-musteri-cile-noktalari.jpg", caption: "Müşteri Çile Noktaları — Tekrarlayan şikayet kümeleri, etki skoru ve iyileştirme önerileri", routeHint: "Çağrı Raporları & Analiz → Müşteri Çile Noktaları" }
    ],
    fieldTable: [
      { field: "Çile Noktası Kümesi & Etkilenen Müşteri Sayısı", type: "AI Kümeleme", defaultVal: "Şiddet Sıralı", required: false, description: "Yüzlerce ayrı şikayeti 5–10 somut iş problemine indirger." },
      { field: "Örnek Görüşme Linkleri & AI Çözüm Önerisi", type: "Kanıt + Aksiyon", defaultVal: "Otomatik", required: false, description: "Yönetim toplantılarında 'müşteriler neyden şikayet ediyor?' sorusunu gerçek ses kanıtlarıyla yanıtlar." }
    ],
    sections: [
      {
        heading: "1. Müşteri Kaybını (Churn) Kökünden Durdurma",
        body: "Aynı sorunun her hafta onlarca müşteriyi sinirlendirmesini beklemeden ilk dalgada yakalayıp süreç düzeltmesi yapabilirsiniz.",
        steps: [
          "En yüksek etki skoruna sahip ilk 3 çile noktasını açın.",
          "İlgili ürün, lojistik veya finans departmanına kanıt dökümlerle aksiyon açın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Çile noktaları listesi boş", cause: "Seçili dönemde negatif/şikayet içeren AI analizli çağrı tespit edilmemiş.", solution: "Tarih aralığını genişleterek tekrar kontrol edin." }
    ],
    relatedPages: ["rapor-duygu-analizi", "rapor-niyet-raporu", "rapor-ceo-ozeti"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-senaryo-sadakati",
    number: "60",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Senaryo Sadakati & Yasal Uyum (Compliance) Raporu",
    shortTitle: "Senaryo Sadakati",
    menuPath: "Çağrı Raporları & Analiz → Senaryo Sadakati Raporu",
    pbxRoute: "/?tab=raporlar-senaryo-sadakati",
    permissions: ["reports_compliance:access"],
    badge: "Rapor 28/44 • KVKK • Zorunlu Cümleler",
    readMinutes: 6,
    summary:
      "Temsilcilerin ve AI asistanların görüşmelerde söylemek zorunda olduğu kurumsal selamlama, KVKK aydınlatma metni, kimlik teyidi veya yasal satış/tahsilat uyarılarına yüzde kaç oranında sadık kaldığını denetler.",
    screenshots: [
      { src: "/screenshots/reports/rapor-senaryo-sadakati.jpg", caption: "Senaryo Sadakati — Zorunlu ifade uyum yüzdesi ve eksik bırakılan çağrıların denetim listesi", routeHint: "Çağrı Raporları & Analiz → Senaryo Sadakati Raporu" }
    ],
    fieldTable: [
      { field: "Genel & Temsilci Bazlı Uyum Yüzdesi (%)", type: "0–100% Compliance", defaultVal: "Zorunlu Maddeler", required: false, description: "Finans, sigorta, sağlık ve telekom gibi regüle sektörlerde yasal ceza riskini sıfırlar." },
      { field: "İhlal / Eksik Cümle Listesi", type: "Çağrı + Ses + Transkript", defaultVal: "Anında Denetim", required: false, description: "Örn. 'Görüşmemiz kayıt altına alınmaktadır' veya kimlik doğrulama sorusu atlanan çağrıları tek tıkla ayıklar." }
    ],
    sections: [
      {
        heading: "1. Düzenleyici Kurum (BDDK / KVKK / BTK) Denetimine Hazırlık",
        body: "Tüm görüşmelerde zorunlu yasal ifadelerin okunduğunu belgelendirir ve uyumsuzlukları aynı gün giderir.",
        steps: [
          "Kural & Senaryo Editörü veya QA kriterlerinden zorunlu ifadelerinizi tanımlayın.",
          "Bu rapordan uyum oranı %95 altındaki temsilcilere hedefli hatırlatma yapın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Uyum %100 veya boş görünüyor", cause: "Zorunlu senaryo kuralları henüz tanımlanmamış.", solution: "Yapay Zeka → Kural & Senaryo Editörü ve Sistem Ayarları → Çağrı Kalite Kontrol kurallarını yapılandırın." }
    ],
    relatedPages: ["rapor-kalite-degerlendirmeleri", "kural-ve-senaryo-editoru", "roller-kvkk-ve-ldap"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-sessizlik-soz-kesme",
    number: "61",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Sessizlik (Dead-Air) & Söz Kesme (Talk-Over) Akustik Raporu",
    shortTitle: "Sessizlik & Söz Kesme",
    menuPath: "Çağrı Raporları & Analiz → Sessizlik & Söz Kesme",
    pbxRoute: "/?tab=raporlar-sessizlik",
    permissions: ["reports_silence:access"],
    badge: "Rapor 29/44 • Dead-Air • Talk-Over",
    readMinutes: 6,
    summary:
      "Çift kanallı ses kayıtlarını akustik olarak analiz ederek görüşmelerdeki uzun garip sessizlikleri (Dead-Air sn) ve temsilcinin müşterinin sözünü kesme (Talk-Over / Over-Talk %) oranını ölçer.",
    screenshots: [
      { src: "/screenshots/reports/rapor-sessizlik-soz-kesme.jpg", caption: "Sessizlik & Söz Kesme — Ortalama Dead-Air süresi, Talk-Over oranı ve temsilci iletişim kalitesi", routeHint: "Çağrı Raporları & Analiz → Sessizlik & Söz Kesme" }
    ],
    fieldTable: [
      { field: "Ortalama & Maksimum Sessizlik (Dead-Air sn)", type: "Saniye / %", defaultVal: "Akustik Analiz", required: false, description: "Yüksek sessizlik, temsilcinin bilgi ararken müşteriyi hatta sessizce beklettiğini veya CRM ekranının yavaş kaldığını gösterir." },
      { field: "Söz Kesme (Talk-Over) Oranı (%)", type: "Çakışan Konuşma %", defaultVal: "Nezaket Metriği", required: false, description: "Müşteri cümlesini bitirmeden sık sık araya giren temsilcileri tespit ederek iletişim koçluğu sağlar." }
    ],
    sections: [
      {
        heading: "1. Müşteri İletişim Kalitesini Akustik Veriyle İyileştirme",
        body: "Dead-Air oranı yüksek temsilcilere AI Fısıldama ve Hızlı CRM Screen Pop açarak bilgi arama sessizliğini ortadan kaldırabilirsiniz.",
        steps: [
          "Sessizlik oranı %20 üzerindeki görüşmeleri filtreleyin.",
          "Ses kaydını dinleyip beklemenin bilgi eksikliğinden mi yoksa teknik bir kesintiden mi kaynaklandığını doğrulayın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Söz kesme oranı her çağrıda yüksek çıkıyor", cause: "Kulaklık mikrofonuna hoparlörden yankı (echo) sızıyor olabilir.", solution: "Avatar → Profil Ayarları → Donanım sekmesinden 'Yapay Zeka (AI) RNNoise Gürültü Engelleme' modunu açın." }
    ],
    relatedPages: ["rapor-ses-kayitlari", "rapor-aktarma-bekletme", "kisisel-profil-ve-ust-cubuk"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-ceo-ozeti",
    number: "62",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "CEO Özet Raporu (Tek Sayfa Üst Yönetim Stratejik Karnesi)",
    shortTitle: "CEO Özet Raporu",
    menuPath: "Çağrı Raporları & Analiz → CEO Özet Raporu",
    pbxRoute: "/?tab=raporlar-ceo-ozeti",
    permissions: ["reports_ceo_summary:access"],
    badge: "Rapor 30/44 • Yönetim Özeti • PDF/Mail",
    readMinutes: 6,
    summary:
      "Yönetim kurulu ve genel müdürler için tüm telefon, omnichannel, yapay zeka ROI, müşteri memnuniyeti (CSAT), SLA ve en kritik 3 operasyonel risk/fırsatı tek bir yönetici özetinde birleştiren üst düzey rapordur.",
    screenshots: [
      { src: "/screenshots/reports/rapor-ceo-ozeti.jpg", caption: "CEO Özet Raporu — Tek sayfa stratejik KPI'lar, AI tasarruf özeti, duygu/QA karnesi ve yönetici aksiyonları", routeHint: "Çağrı Raporları & Analiz → CEO Özet Raporu" }
    ],
    fieldTable: [
      { field: "Stratejik Özet Kartları", type: "Toplam Etkileşim / Cevaplama % / AI Otomasyon % / Net ROI / CSAT / QA", defaultVal: "Dönem Kıyaslı", required: false, description: "Şirketin tüm müşteri iletişim sağlığını 30 saniyede okunabilir tek özet halinde verir." },
      { field: "AI Yönetici Değerlendirmesi & Zamanlanmış Gönderim", type: "Otomatik Türkçe Özet + PDF", defaultVal: "Haftalık / Aylık", required: false, description: "Zamanlanmış Raporlar üzerinden her Pazartesi sabahı genel müdürün e-postasına otomatik gönderilebilir." }
    ],
    sections: [
      {
        heading: "1. Haftalık & Aylık Yönetim Kurulu Sunumu",
        body: "Farklı 10 rapordan manuel Excel birleştirmek yerine tek tıkla eksiksiz yönetici karnesi çıkarır.",
        steps: [
          "Dönemi 'Geçen Hafta' veya 'Geçen Ay' seçin.",
          "Zamanlanmış Raporlar ekranından CEO Özetini her Pazartesi 08:30 için yöneticilere tanımlayın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "AI Yönetici Özeti paragrafı boş", cause: "Özetleme LLM modeli seçili değil veya o dönemde çağrı verisi yok.", solution: "AI Görev & Model Yönlendirme'de özetleme görevini aktif bir modele bağlayın." }
    ],
    relatedPages: ["rapor-ai-insan-roi", "zamanlanmis-raporlar", "rapor-pano"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-mola-puantaj",
    number: "63",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Mola & Puantaj Raporu + WFM Vardiya Planlayıcı",
    shortTitle: "Mola & Puantaj",
    menuPath: "Çağrı Raporları & Analiz → Mola & Puantaj Raporu",
    pbxRoute: "/?tab=raporlar-mola-puantaj",
    permissions: ["reports_breaks_attendance:access"],
    badge: "Rapor 31/44 • WFM Vardiya • İK Puantaj",
    readMinutes: 9,
    summary:
      "İK ve çağrı merkezi yöneticileri için her temsilcinin ilk giriş (Login), son çıkış (Logout), net çalışma süresi, mola türlerine göre (Yemek, İhtiyaç, Eğitim, Toplantı, RONA) kullandığı dakikaları ve WFM Vardiya Planına göre geç kalma/erken çıkma/mola aşımı sapmalarını raporlar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-mola-puantaj.jpg", caption: "Mola & Puantaj Raporu — Giriş/Çıkış saatleri, mola türleri kırılımı, WFM vardiya uyumu ve Excel dışa aktarım", routeHint: "Çağrı Raporları & Analiz → Mola & Puantaj Raporu" }
    ],
    fieldTable: [
      { field: "İlk Giriş / Son Çıkış / Toplam Oturum / Net Çalışma", type: "HH:MM + Dakika", defaultVal: "UTC+3 Günlük", required: false, description: "Bordro ve puantaj takibi için temsilcinin fiili çalışma süresini kuruşu kuruşuna çıkarır." },
      { field: "Mola Türü Kırılımı & Mola Limit Aşımı", type: "Yemek / İhtiyaç / Eğitim / Toplantı / RONA", defaultVal: "agent_break_logs", required: false, description: "Sistem Ayarları → Mola Tanımları'ndaki günlük dakika limitini aşan satırları kırmızı vurgular." },
      { field: "Entegre WFM Vardiya Planlayıcı", type: "Haftalık Vardiya Atama + Sapma Kontrolü", defaultVal: "agent_shifts", required: false, description: "Her temsilciye özel mesai başlangıç/bitiş saati tanımlayıp geç kalma ve erken çıkma dakikalarını otomatik hesaplar." }
    ],
    sections: [
      {
        heading: "1. WFM Vardiya Tanımlama ve Aylık İK Puantajı Çıkarma",
        body: "Hem günlük mola disiplinini denetlemek hem de ay sonunda İK departmanına tek tıkla bordro eki vermek için kullanılır.",
        steps: [
          "Üstteki WFM Vardiya Planlayıcı kartından her temsilcinin vardiya başlangıç/bitiş saatlerini tanımlayın.",
          "Özet veya Detaylı Oturum görünümünde geç kalma/mola aşımı satırlarını inceleyip Excel olarak indirin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Mola türlerinden biri raporda sütun olarak çıkmıyor", cause: "İlgili mola türü o tarih aralığında hiç kullanılmamış.", solution: "Sistem Ayarları → Mola Tanımları'nda aktif olduğunu doğrulayın; kullanıldığı anda raporda otomatik görünür." }
    ],
    relatedPages: ["rapor-temsilci-kronolojisi", "roller-kvkk-ve-ldap", "rapor-temsilci-performans"],
    relatedApis: ["GET /api/agent/stats"]
  },
  {
    id: "rapor-omnichannel-sla",
    number: "64",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Omnichannel Kanal & SLA Raporu (WhatsApp, Telegram, Meta, E-Posta)",
    shortTitle: "Omnichannel Kanal & SLA",
    menuPath: "Çağrı Raporları & Analiz → Omnichannel Kanal & SLA",
    pbxRoute: "/?tab=raporlar-omnichannel",
    permissions: ["reports_omnichannel:access"],
    badge: "Rapor 32/44 • FRT • Çözüm Süresi",
    readMinutes: 7,
    summary:
      "WhatsApp, Telegram, Instagram DM, Facebook Messenger ve kurumsal E-Posta kanallarından gelen tüm yazılı oturumların sayısını, İlk Yanıt Süresini (FRT), Ortalama Çözüm Süresini, AI otonom kapatma oranını ve temsilci bazlı mesaj iş yükünü ölçer.",
    screenshots: [
      { src: "/screenshots/reports/rapor-omnichannel-sla.jpg", caption: "Omnichannel Kanal & SLA — Kanal kırılımlı sohbet hacmi, İlk Yanıt Süresi (FRT), AI vs. İnsan çözümü", routeHint: "Çağrı Raporları & Analiz → Omnichannel Kanal & SLA" }
    ],
    fieldTable: [
      { field: "Kanal Bazlı Oturum & Mesaj Hacmi", type: "WhatsApp / Telegram / Instagram / Facebook / E-Posta", defaultVal: "Çoklu Hat Destekli", required: false, description: "Müşterilerin hangi yazılı kanalı en yoğun kullandığını ve çoklu WhatsApp hatlarının dağılımını gösterir." },
      { field: "İlk Yanıt Süresi (FRT) & Ortalama Çözüm Süresi", type: "Saniye / Dakika", defaultVal: "SLA Hedefli", required: false, description: "Müşteri mesaj attıktan kaç saniye sonra ilk yanıtı aldığını ve sorunun kaç dakikada kapandığını ölçer." },
      { field: "AI Otonom vs. Canlı Temsilci Devir Oranı", type: "% Dağılım", defaultVal: "chat_sessions", required: false, description: "WhatsApp AI asistanınızın yazılı trafiğin yüzde kaçını insana ihtiyaç duymadan çözdüğünü kanıtlar." }
    ],
    sections: [
      {
        heading: "1. Yazılı Destek SLA Takibi",
        body: "Özellikle e-ticaret ve satış hatlarında 2 dakikanın altındaki İlk Yanıt Süresi (FRT) dönüşüm oranını doğrudan artırır.",
        steps: [
          "Kanal filtresinden WhatsApp veya E-Posta'yı seçip FRT ortalamasını kontrol edin.",
          "Mesai dışı geç yanıtları önlemek için Kanal Entegrasyonları'ndan WhatsApp Mesai Dışı AI yanıtlayıcısını aktif tutun."
        ]
      }
    ],
    troubleshooting: [
      { problem: "E-Posta oturumları raporda görünmüyor", cause: "Kanal Entegrasyonları'nda IMAP gelen kutusu dinleyicisi yapılandırılmamış.", solution: "Sistem Ayarları → Kanal Entegrasyonları → E-Posta sekmesinden IMAP/SMTP ayarlarını kaydedin." }
    ],
    relatedPages: ["ortak-gelen-kutusu", "kanallar-crm-ve-dis-api", "rapor-ai-insan-roi"],
    relatedApis: ["GET /api/omnichannel/sessions"]
  },
  {
    id: "rapor-sonuc-kodlari",
    number: "65",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Çağrı Sonuç Kodları (Dispositions) Raporu",
    shortTitle: "Çağrı Sonuç Kodları",
    menuPath: "Çağrı Raporları & Analiz → Çağrı Sonuç Kodları",
    pbxRoute: "/?tab=raporlar-sonuc-kodlari",
    permissions: ["reports_disposition:access"],
    badge: "Rapor 33/44 • Dönüşüm • Etiketleme",
    readMinutes: 6,
    summary:
      "Görüşme sonlarında temsilcilerin seçtiği veya AI Not Asistanının atadığı standart sonuç kodlarının (Satış Tamamlandı, Teklif İletildi, Bilgi Verildi, Geri Aranacak, İptal/Şikayet vb.) kuyruk ve temsilci bazlı dağılımını raporlar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-sonuc-kodlari.jpg", caption: "Çağrı Sonuç Kodları — Sonuç etiketi dağılımı, satış dönüşüm oranları ve temsilci kırılımı", routeHint: "Çağrı Raporları & Analiz → Çağrı Sonuç Kodları" }
    ],
    fieldTable: [
      { field: "Sonuç Kodu Adedi & Yüzdesi", type: "Kuyruk / Temsilci Bazlı", defaultVal: "ACD Kuyruk → Sekme 2", required: false, description: "Örn. Satış kuyruğunda gelen 100 çağrıdan kaçının 'Satış Tamamlandı' ile sonuçlandığını gösterir." },
      { field: "Kodlanmamış Çağrı Oranı", type: "Uyum Takibi", defaultVal: "ACW Disiplini", required: false, description: "Sonuç kodu seçmeden çağrıyı kapatan temsilcileri takip etmenizi sağlar." }
    ],
    sections: [
      {
        heading: "1. Satış ve Destek Dönüşüm Hunisi",
        body: "Her kuyruğa özel sonuç kodları tanımlayarak satış, teknik destek ve tahsilat ekiplerinin başarı oranlarını net biçimde ayırabilirsiniz.",
        steps: [
          "ACD Kuyruk → Düzenle → Çağrı Sonuç Kodları sekmesinden kuyruğunuza özgü etiketleri tanımlayın.",
          "Bu rapordan haftalık dönüşüm yüzdelerini Excel olarak dışa aktarın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Sonuç kodu seçimi temsilci ekranında çıkmıyor", cause: "İlgili kuyrukta sonuç kodu listesi tanımlanmamış.", solution: "ACD Kuyruk → Düzenle → Sekme 2: Çağrı Sonuç Kodları alanına kodlarınızı ekleyin." }
    ],
    relatedPages: ["acd-kuyruk", "rapor-temsilci-notlari", "temsilci-cagri-paneli"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-kampanya-geri-arama",
    number: "66",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Kampanya (Dialer) & Akıllı Geri Arama (Smart Callback) Raporu",
    shortTitle: "Kampanya & Geri Arama",
    menuPath: "Çağrı Raporları & Analiz → Kampanya & Geri Arama",
    pbxRoute: "/?tab=raporlar-kampanya-geri-arama",
    permissions: ["reports_dialer_callback:access"],
    badge: "Rapor 34/44 • Dialer • Smart Callback",
    readMinutes: 6,
    summary:
      "Otomatik Dış Arama (Dialer) kampanyalarının ulaşma, cevaplama, meşgul, cevapsız ve AI/temsilci dönüşüm oranları ile kuyruk bazlı Akıllı Geri Arama (Smart Callback) başarı istatistiklerini bir arada raporlar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-kampanya-geri-arama.jpg", caption: "Kampanya & Geri Arama — Dialer ilerleme/ulaşma oranları ve Smart Callback geri dönüş performansı", routeHint: "Çağrı Raporları & Analiz → Kampanya & Geri Arama" }
    ],
    fieldTable: [
      { field: "Kampanya İlerleme & Ulaşma Oranı (%)", type: "Toplam / Aranan / Cevaplanan / Meşgul / Cevapsız", defaultVal: "Kampanya Bazlı", required: false, description: "Yüklenen numara listesinin yüzde kaçına başarıyla ulaşıldığını ve ortalama görüşme süresini ölçer." },
      { field: "Smart Callback Başarı & Ortalama Dönüş Süresi", type: "Kuyruk Bazlı", defaultVal: "Otomatik Geri Arama", required: false, description: "Kuyrukta bekleyemeyip geri arama talep eden müşterilere kaç dakika içinde dönüldüğünü raporlar." }
    ],
    sections: [
      {
        heading: "1. Dış Arama Kampanyası Verimlilik Analizi",
        body: "Hangi saat aralığında dış aramaların en yüksek cevaplama oranına ulaştığını görüp kampanya saat pencerelerini optimize edebilirsiniz.",
        steps: [
          "Aktif veya tamamlanan kampanyayı seçip cevaplanan/cevapsız dağılımını inceleyin.",
          "Ulaşılamayan numaralar için tekrar deneme (retry) aralığını Dialer ayarlarından güncelleyin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Dialer kampanyasında tüm çağrılar 'Cevapsız/Hata' düşüyor", cause: "Seçili çıkış hattı (Trunk) veya CallerID operatör tarafından reddediliyor.", solution: "Dış Arama kampanyasında doğru Trunk'ın seçili olduğunu ve Hatalı Çağrı Raporu'ndaki red nedenini kontrol edin." }
    ],
    relatedPages: ["dis-arama-dialer", "acd-kuyruk", "rapor-kacan-cagri"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-kuyruk-sla",
    number: "67",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Kuyruk SLA & Hız Dilimleri Raporu (0–10s / 10–20s / 20–30s / 30s+)",
    shortTitle: "Kuyruk SLA & Hız Dilimleri",
    menuPath: "Çağrı Raporları & Analiz → Kuyruk SLA & Hız Dilimleri",
    pbxRoute: "/?tab=raporlar-kuyruk-sla",
    permissions: ["reports_queue_sla:access"],
    badge: "Rapor 35/44 • 80/20 SLA • Hız Kovaları",
    readMinutes: 7,
    summary:
      "Çağrı merkezi endüstri standardı olan Servis Seviyesi (SLA — örn. çağrıların %80'ini 20 saniye içinde yanıtlama) performansını 0–10s, 10–20s, 20–30s, 30–60s ve 60s+ hız kovalarına bölerek kuyruk bazında ölçer.",
    screenshots: [
      { src: "/screenshots/reports/rapor-kuyruk-sla.jpg", caption: "Kuyruk SLA & Hız Dilimleri — Saniye kovalarına göre cevaplanma/terk dağılımı ve SLA % uyumu", routeHint: "Çağrı Raporları & Analiz → Kuyruk SLA & Hız Dilimleri" }
    ],
    fieldTable: [
      { field: "SLA Eşik Hedefi (sn) & Gerçekleşen SLA (%)", type: "10s / 15s / 20s / 30s Eşik", defaultVal: "20 sn (%80 Hedef)", required: false, description: "Kurumsal hizmet sözleşmesi (SLA) taahhütlerinizin gerçekleşme oranını kesin rakamla verir." },
      { field: "Cevaplanma & Terk Hız Kovaları", type: "0–10s / 10–20s / 20–30s / 30–60s / 60s+", defaultVal: "Kuyruk Bazlı", required: false, description: "Müşterilerin tam kaçıncı saniyede sabrının tükenip telefonu kapattığını netleştirir." }
    ],
    sections: [
      {
        heading: "1. Kurumsal SLA Sözleşmesi Takibi",
        body: "Dış kaynak (BPO) çağrı merkezleri ve kurumsal destek birimleri için aylık SLA karnesinin resmi kanıtıdır.",
        steps: [
          "Üstten SLA eşik saniyesini (örn. 20 sn) ve tarih aralığını seçin.",
          "20–30s kovasındaki yığılma yüksekse kuyruktaki Temsilci Çalma Süresini (örn. 20s → 15s) kısaltarak sıradaki temsilciye geçişi hızlandırın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "SLA yüzdesi düşük ama ortalama bekleme kısa", cause: "Birkaç uzun bekleyen çağrı SLA eşiğini aşmış.", solution: "ACD Kuyruk → Maksimum Bekleme Süresi'nden 45–60 sn sonrası için AI Asistan veya Yedek Kuyruk taşması tanımlayın." }
    ],
    relatedPages: ["rapor-kuyruk-bekleme", "acd-kuyruk", "canli-izleme-paneli"],
    relatedApis: ["GET /api/v1/queues"]
  },
  {
    id: "rapor-tekrar-arayanlar",
    number: "68",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Tekrar Eden Arayanlar (Repeat Callers & Sık Arayan Analizi)",
    shortTitle: "Tekrar Eden Arayanlar",
    menuPath: "Çağrı Raporları & Analiz → Tekrar Eden Arayanlar",
    pbxRoute: "/?tab=raporlar-tekrar-arayanlar",
    permissions: ["reports_repeat_callers:access"],
    badge: "Rapor 36/44 • Çözümsüzlük & VIP Takibi",
    readMinutes: 6,
    summary:
      "Belirli bir zaman diliminde şirketinizi 2, 3 veya daha fazla kez arayan telefon numaralarını toplam arama adedi, son konuştuğu temsilci ve toplam süre bilgileriyle sıralayarak çözülememiş kronik müşteri sorunlarını veya spam arayanları tespit eder.",
    screenshots: [
      { src: "/screenshots/reports/rapor-tekrar-arayanlar.jpg", caption: "Tekrar Eden Arayanlar — En sık arayan numaralar, tekrar sayısı ve son görüşme detayları", routeHint: "Çağrı Raporları & Analiz → Tekrar Eden Arayanlar" }
    ],
    fieldTable: [
      { field: "Arayan Numara / Rehber Adı & Tekrar Sayısı", type: "Minimum Eşik (2+ / 3+ / 5+)", defaultVal: "En Çok Arayandan Aza", required: false, description: "Aynı gün içinde 5 kez arayan bir müşterinin acil çözümsüzlük yaşadığını veya hattı meşgul ettiğini anında gösterir." },
      { field: "Cevaplanan / Cevapsız Dağılımı & Son Temsilci", type: "Çağrı Geçmişi Linkli", defaultVal: "Tek Tık İnceleme", required: false, description: "Numaraya tıklandığında o müşterinin tüm geçmiş çağrılarını ve transkriptlerini açar." }
    ],
    sections: [
      {
        heading: "1. Kronik Müşteri Sorunlarını Kıdemli Ekibe Yönlendirme",
        body: "3 kez üst üste arayan bir müşteri artık yüksek şikayet riski taşır; bu rapordan yakalanıp doğrudan takım lideri tarafından aranabilir.",
        steps: [
          "Minimum tekrar filtresini '3+ Arama' yapın.",
          "Listelenen müşterilerin son görüşme özetini okuyup kalıcı çözüm üretin; rahatsız edici spam ise tek tıkla Kara Listeye alın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Şirketin kendi şubeleri veya kuryeleri en üstte çıkıyor", cause: "Kurum içi/partner GSM numaraları düzenli arama yapıyor.", solution: "Rehberde isimlendirilen iç partnerleri ayırt edip harici müşteri numaralarına odaklanın." }
    ],
    relatedPages: ["rapor-fcr", "rapor-musteri-cile-noktalari", "numara-engelleme"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-departman-toplama",
    number: "69",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Departman & Çağrı Toplama (*8 Pickup) Raporu",
    shortTitle: "Departman & Çağrı Toplama",
    menuPath: "Çağrı Raporları & Analiz → Departman & Çağrı Toplama",
    pbxRoute: "/?tab=raporlar-departman-toplama",
    permissions: ["reports_dept_pickup:access"],
    badge: "Rapor 37/44 • Departman • *8 Pickup",
    readMinutes: 6,
    summary:
      "Kullanıcıların bağlı olduğu Departman ve Lokasyon bazında çağrı hacmi/cevaplama performansını ve Çağrı Toplama Grubu (*8 / BLF Directed Pickup) kullanılarak arkadaşının çalan telefonunu kimin kaç kez çekip kurtardığını raporlar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-departman-toplama.jpg", caption: "Departman & Çağrı Toplama — Departman/lokasyon kırılımı ve *8 çağrı toplama başarı istatistikleri", routeHint: "Çağrı Raporları & Analiz → Departman & Çağrı Toplama" }
    ],
    fieldTable: [
      { field: "Departman & Lokasyon Bazlı Çağrı Özeti", type: "Gelen / Giden / Cevaplanan / Cevapsız", defaultVal: "Organizasyon Kırılımı", required: false, description: "Satış, Muhasebe, Teknik Destek veya Ankara/İstanbul şubelerinin trafik yükünü kıyaslar." },
      { field: "*8 / BLF Çağrı Toplama (Pickup) İstatistikleri", type: "Çeken Dahili ↔ Asıl Çalan Dahili", defaultVal: "Takım İşbirliği", required: false, description: "Masasında olmayan arkadaşının telefonunu *8 ile çekerek müşteriyi kurtaran ekip üyelerini ödüllendirmenizi sağlar." }
    ],
    sections: [
      {
        heading: "1. Departmanlar Arası İş Yükü Dengesi",
        body: "Hangi departmanda veya şubede cevapsız çağrıların arttığını görüp *8 çağrı toplama gruplarını doğru biçimde kurgulayabilirsiniz.",
        steps: [
          "Kullanıcı kartlarında Lokasyon ve Departman alanlarının dolu olduğundan emin olun.",
          "Bu rapordan departmanların cevaplama oranını ve *8 kurtarma adetlerini aylık takip edin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Tüm kullanıcılar 'Departman Tanımsız' altında görünüyor", cause: "Kullanıcı profillerine departman atanmamış.", solution: "Toplu Konfigürasyon ekranından saniyeler içinde kullanıcı gruplarına Departman ve Lokasyon atayın." }
    ],
    relatedPages: ["cagri-toplama-grubu", "roller-kvkk-ve-ldap", "toplu-konfigurasyon"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-voip-kalite-mos",
    number: "70",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "VoIP & Ses Kalitesi — MOS, Jitter, RTT & Paket Kaybı Raporu",
    shortTitle: "VoIP & Ses Kalitesi (MOS)",
    menuPath: "Çağrı Raporları & Analiz → VoIP & Ses Kalitesi (MOS)",
    pbxRoute: "/?tab=raporlar-voip-kalite",
    permissions: ["reports_voip_quality:access"],
    badge: "Rapor 38/44 • MOS 1.0–4.5 • RTCP",
    readMinutes: 7,
    summary:
      "Asterisk RTCP ses kalitesi metriklerinden hesaplanan MOS (Mean Opinion Score 1.0–4.5), RTT gecikme (ms), Jitter (ms) ve Paket Kaybı (%) değerlerini çağrı, dahili ve dış hat bazında raporlayarak 'ses kesik kesik geliyor' şikayetlerinin ağ kaynağını bilimsel olarak kanıtlar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-voip-kalite-mos.jpg", caption: "VoIP & Ses Kalitesi (MOS) — Ortalama MOS puanı, Jitter, RTT, paket kaybı ve sorunlu çağrı listesi", routeHint: "Çağrı Raporları & Analiz → VoIP & Ses Kalitesi (MOS)" }
    ],
    fieldTable: [
      { field: "MOS Puanı (1.0–4.5)", type: "4.0+ Mükemmel / 3.5–4.0 İyi / <3.5 Sorunlu", defaultVal: "ITU-T E-Model", required: false, description: "Ses kalitesinin uluslararası standarttaki objektif puanı." },
      { field: "RTT (ms), Jitter (ms) & Paket Kaybı (%)", type: "RTCP Telemetrisi", defaultVal: "Çağrı & Dahili Bazlı", required: false, description: "Sorunun evden çalışan temsilcinin Wi-Fi bağlantısında mı yoksa SIP operatör hattında mı olduğunu kesinleştirir." }
    ],
    sections: [
      {
        heading: "1. Kötü Ses Şikayetlerinde Kök Neden Tespiti",
        body: "Eğer sadece tek bir temsilcinin MOS puanı 3.2'nin altındaysa sorun o kullanıcının internetindedir; tüm dış aramalarda düşüyorsa sorun operatör hattı veya şirket internet upload tıkanıklığıdır.",
        steps: [
          "MOS < 3.6 filtresiyle sorunlu görüşmeleri süzün.",
          "Yüksek Jitter/Paket Kaybı görülen dahili veya Trunk'ı belirleyip kablolu ağ/QoS veya G.729/Opus kodek optimizasyonu uygulayın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Uzak çalışanlarda Jitter ve paket kaybı yüksek", cause: "Zayıf Wi-Fi sinyali veya katı NAT üzerinden UDP paket kaybı.", solution: "Masa telefonunda TCP Transport / Nornia SIP Edge, WebPhone'da ise kablolu Ethernet bağlantısı önerin." }
    ],
    relatedPages: ["sorun-inceleme-sip-debugger", "dis-hat-tanimi", "sunucu-ag-ve-nornia-connect"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-yonlendirme-gsm",
    number: "71",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Yönlendirme (Follow-Me / GSM) Maliyet & Kullanım Raporu",
    shortTitle: "Yönlendirme (Follow-Me / GSM)",
    menuPath: "Çağrı Raporları & Analiz → Yönlendirme (Follow-Me / GSM)",
    pbxRoute: "/?tab=raporlar-yonlendirme-gsm",
    permissions: ["reports_forwarding_gsm:access"],
    badge: "Rapor 39/44 • GSM Maliyeti • Follow-Me",
    readMinutes: 6,
    summary:
      "Her Zaman, Meşgulde, Cevapsız veya Beni Takip Et (Follow Me) kurallarıyla cep telefonlarına (GSM) ve dış numaralara yönlendirilen çağrıların abone bazlı adedini ve toplam dakikasını raporlayarak GSM yönlendirme maliyetini kontrol altında tutar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-yonlendirme-gsm.jpg", caption: "Yönlendirme (Follow-Me / GSM) — Abone bazlı cep telefonuna yönlenen çağrı adedi ve toplam GSM dakikası", routeHint: "Çağrı Raporları & Analiz → Yönlendirme (Follow-Me / GSM)" }
    ],
    fieldTable: [
      { field: "Abone Dahilisi, Yönlendirme Türü & Hedef GSM Numarası", type: "Her Zaman / Meşgul / Cevapsız / Follow-Me", defaultVal: "Operatör Çıkışlı", required: false, description: "Hangi personelin sürekli cep telefonuna yönlendirme açık unuttuğunu anında tespit eder." },
      { field: "Yönlendirilen Çağrı Adedi & Toplam GSM Dakikası", type: "Adet + dk:sn", defaultVal: "Maliyet Kontrolü", required: false, description: "Mobil uygulama (Nornia Mobile / WebRTC) yerine ücretli GSM yönlendirmesi kullanan aboneleri belirleyip tasarruf sağlar." }
    ],
    sections: [
      {
        heading: "1. GSM Yönlendirme Faturasını Sıfırlama",
        body: "Cep telefonuna GSM yönlendirmesi yerine Nornia Mobil Uygulamasını (Wi-Fi/4.5G WebRTC) kurdurarak aynı mobiliteyi sıfır operatör ücretiyle elde edebilirsiniz.",
        steps: [
          "En yüksek GSM yönlendirme dakikasına sahip kullanıcıları listeleyin.",
          "Bu kullanıcılara Profil Ayarları → Uygulamalar & İndir üzerinden QR kodla Mobil Uygulama kurun ve gereksiz GSM yönlendirmesini kapatın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "GSM yönlendirmesi çalışıyor ama raporda görünmüyor", cause: "Yönlendirme hedefi iç dahili olarak ayarlanmış (GSM değil).", solution: "Bu rapor özellikle dış hat (Operator_Trunk) üzerinden GSM/dış numaraya çıkan yönlendirmeleri öne çıkarır." }
    ],
    relatedPages: ["kullanicilar", "rapor-operator-dakika", "kisisel-profil-ve-ust-cubuk"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-supervizor-denetim",
    number: "72",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Süpervizör Dinleme & Müdahale Denetim Raporu (ChanSpy Audit)",
    shortTitle: "Süpervizör Denetim",
    menuPath: "Çağrı Raporları & Analiz → Süpervizör Dinleme & Müdahale",
    pbxRoute: "/?tab=raporlar-supervizor-denetim",
    permissions: ["reports_supervisor_audit:access"],
    badge: "Rapor 40/44 • ChanSpy • Değiştirilemez Log",
    readMinutes: 6,
    summary:
      "KVKK ve kurumsal iç denetim gereği; hangi süpervizörün, hangi tarihte, hangi temsilcinin görüşmesine hangi modda (Sessiz Dinle / Fısılda-Sufle / Araya Gir-Barge / Zorla Logout / Mola Müdahalesi) bağlandığını değiştirilemez denetim kaydı olarak raporlar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-supervizor-denetim.jpg", caption: "Süpervizör Dinleme & Müdahale — ChanSpy Listen/Whisper/Barge ve canlı durum müdahale denetim tablosu", routeHint: "Çağrı Raporları & Analiz → Süpervizör Dinleme & Müdahale" }
    ],
    fieldTable: [
      { field: "Süpervizör, Hedef Temsilci & Müdahale Tipi", type: "Listen / Whisper / Barge / Force Logout / Break Action", defaultVal: "Değiştirilemez Audit", required: false, description: "Yetki suistimalini önler ve tüm canlı dinlemeleri tam şeffaflıkla kayıt altına alır." },
      { field: "Tarih/Saat, Çağrı ID & Kaynak IP", type: "Tam İzlenebilirlik", defaultVal: "CSV Dışa Aktar", required: false, description: "Hukuki veya İK denetimlerinde resmi kanıt olarak sunulabilir." }
    ],
    sections: [
      {
        heading: "1. İç Denetim ve KVKK Şeffaflığı",
        body: "Canlı dinleme yetkisine sahip tüm takım liderlerinin koçluk aktivitelerini hem eğitim verimliliği hem gizlilik uyumu açısından izleyebilirsiniz.",
        steps: [
          "Süpervizör veya müdahale tipine göre filtreleyin.",
          "Düzenli aylık iç denetim arşivi için CSV çıktısı alın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Canlı dinleme yapıldığı halde kayıt düşmedi", cause: "Dinleme panelden değil fiziksel telefon özellik koduyla yapılmış olabilir.", solution: "Web arayüzündeki Canlı Çağrı İzleme butonları her işlemi anında bu denetim tablosuna yazar." }
    ],
    relatedPages: ["canli-cagri-izleme", "olay-gunlukleri", "roller-kvkk-ve-ldap"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-engellenen-ihlal",
    number: "73",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Engellenen Çağrı & Güvenlik İhlal Raporu (Kara Liste + Toll-Fraud)",
    shortTitle: "Engellenen Çağrı & İhlal",
    menuPath: "Çağrı Raporları & Analiz → Engellenen Çağrı & İhlal",
    pbxRoute: "/?tab=raporlar-engellenen-ihlal",
    permissions: ["reports_blacklist_security:access"],
    badge: "Rapor 41/44 • Kara Liste • Suistimal",
    readMinutes: 6,
    summary:
      "Kara Liste (Numara/E-Posta) tarafından girişte kesilen spam aramaları, AI konuşmalarında tespit edilen yasaklı kelime/küfür ihlallerini ve Güvenlik Kalkanı tarafından engellenen Toll-Fraud / SIP saldırı girişimlerini tek raporda toplar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-engellenen-ihlal.jpg", caption: "Engellenen Çağrı & İhlal — Kara liste redleri, yasaklı kelime tespitleri ve güvenlik ihlal kayıtları", routeHint: "Çağrı Raporları & Analiz → Engellenen Çağrı & İhlal" }
    ],
    fieldTable: [
      { field: "İhlal Türü & Kaynak (Numara / IP / Dahili)", type: "Kara Liste / Yasaklı Kelime / Toll-Fraud / SIP Brute-Force", defaultVal: "Otomatik Kayıt", required: false, description: "Santral güvenlik katmanlarının kaç adet spam ve saldırı girişimini önlediğini gösterir." },
      { field: "Gerekçe / Tespit Edilen İfade & Alınan Aksiyon", type: "Engellendi / Çağrı Kapatıldı / Karantina", defaultVal: "Audit Loglu", required: false, description: "Hukuki delil gerektiren taciz veya dolandırıcılık aramalarını tarih/saat kanıtıyla saklar." }
    ],
    sections: [
      {
        heading: "1. Taciz, Spam ve Siber Saldırı Raporlaması",
        body: "Haftalık güvenlik taramalarında engellenen saldırı trendlerini ve kara listeden en sık zorlayan numaraları inceleyebilirsiniz.",
        steps: [
          "İhlal türü filtresinden Kara Liste veya Güvenlik İhlali seçin.",
          "Tekrarlayan IP saldırıları varsa Güvenlik Kalkanı → Bölgesel Erişim (GeoIP) kalkanını sıkılaştırın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Meşru bir müşteri Kara Liste nedeniyle engellenmiş", cause: "Müşterinin numarası yanlışlıkla Kara Listeye eklenmiş veya yasaklı kelime yanlış eşleşmiş.", solution: "Santral → Numara Engelleme ekranından ilgili kaydı arayıp kaldırın." }
    ],
    relatedPages: ["numara-engelleme", "guvenlik-kalkani", "olay-gunlukleri"],
    relatedApis: ["GET /api/v1/blacklist"]
  },
  {
    id: "rapor-ai-randevu-rag",
    number: "74",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "AI Randevu Dönüşümü & Bilgi Bankası (RAG) Eksik Tespit Raporu",
    shortTitle: "AI Randevu & RAG",
    menuPath: "Çağrı Raporları & Analiz → AI Randevu & Bilgi Bankası",
    pbxRoute: "/?tab=raporlar-ai-randevu-rag",
    permissions: ["reports_ai_appointments_rag:access"],
    badge: "Rapor 42/44 • Randevu • RAG Bilgi Açığı",
    readMinutes: 7,
    summary:
      "Yapay zeka sesli ve yazılı asistanlarının oluşturduğu randevuların onay/tamamlanma dönüşüm oranlarını ve müşterilerin sorduğu ancak Bilgi Bankası (RAG) dokümanlarında yanıtı bulunamayan 'Bilgi Açığı (Unanswered Questions)' konularını listeler.",
    screenshots: [
      { src: "/screenshots/reports/rapor-ai-randevu-rag.jpg", caption: "AI Randevu & Bilgi Bankası — AI randevu dönüşüm metrikleri ve RAG dokümanlarında eksik kalan müşteri soruları", routeHint: "Çağrı Raporları & Analiz → AI Randevu & Bilgi Bankası" }
    ],
    fieldTable: [
      { field: "AI Tarafından Oluşturulan Randevular & Durum Dağılımı", type: "Bekliyor / Onaylandı / Tamamlandı / İptal", defaultVal: "Randevu Takvimi Senkron", required: false, description: "AI asistanın gerçek iş/satış randevusuna dönüşüm başarısını ölçer." },
      { field: "RAG Bilgi Açığı (Cevaplanamayan Sorular)", type: "Önerilen Yeni SSS Başlıkları", defaultVal: "Otomatik Keşif", required: false, description: "AI'ın yanıtlayamadığı için canlı temsilciye aktardığı soruları listeler; bu başlıkları RAG'a ekledikçe AI otomasyonu her hafta yükselir." }
    ],
    sections: [
      {
        heading: "1. Yapay Zekanızı Her Hafta Daha Akıllı Hale Getirme",
        body: "Bu rapordaki 'Cevapsız Kalan Sorular' listesini haftada 1 kez Bilgi Bankası (RAG) → Manuel SSS bölümüne eklemek AI otonom çözüm oranını %90+ seviyesine taşır.",
        steps: [
          "RAG Bilgi Açığı tablosundaki en sık sorulan eksik konuları inceleyin.",
          "Bilgi Bankası (RAG) → Veri Ekleme ekranından doğru yanıtları ekleyip kaydedin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "AI randevu oluşturmuyor", cause: "AI Temsilcisi senaryosunda veya sistem talimatında randevu alma adımı tanımlı değil.", solution: "AI Temsilcileri → Görsel Senaryo veya Sistem Talimatı'na randevu toplama adımını ekleyin." }
    ],
    relatedPages: ["bilgi-bankasi-rag", "randevu-takvimi", "ai-temsilcileri"],
    relatedApis: ["GET /api/appointments"]
  },
  {
    id: "rapor-sesli-posta",
    number: "75",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Sesli Posta (Voicemail) Raporu & Dinlenmemiş Mesaj Takibi",
    shortTitle: "Sesli Posta Raporu",
    menuPath: "Çağrı Raporları & Analiz → Sesli Posta (Voicemail)",
    pbxRoute: "/?tab=raporlar-sesli-posta",
    permissions: ["reports_voicemail:access"],
    badge: "Rapor 43/44 • Okunmamış • WAV Dinleme",
    readMinutes: 6,
    summary:
      "Mesai dışında veya cevapsız anlarda tüm dahililere ve kuyruklara bırakılan sesli mesajları (Voicemail), dinlenmiş/dinlenmemiş durumuyla birlikte merkezden izleyip doğrudan tarayıcıdan dinlemenizi ve geri dönüş denetimi yapmanızı sağlar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-sesli-posta.jpg", caption: "Sesli Posta Raporu — Tüm dahililere bırakılan sesli mesajlar, okunma durumu ve merkezi WAV oynatıcı", routeHint: "Çağrı Raporları & Analiz → Sesli Posta" }
    ],
    fieldTable: [
      { field: "Hedef Dahili, Arayan Numara, Tarih & Mesaj Süresi", type: "Merkezi Voicemail Tablosu", defaultVal: "Okunmamış Öncelikli", required: false, description: "Temsilcilerin gözden kaçırdığı veya dinlemeyi unuttuğu müşteri sesli mesajlarını yöneticiye anında bildirir." },
      { field: "WAV Oynat / İndir & Okundu Durumu", type: "Dinlendi / Yeni", defaultVal: "Anlık Stream", required: false, description: "Yönetici doğrudan bu ekrandan sesli mesajı dinleyip ilgili personele görev atayabilir." }
    ],
    sections: [
      {
        heading: "1. Mesai Dışı Bırakılan Hiçbir Sesli Mesajı Kaçırmama",
        body: "Sabah 09:00'da mesai başlarken gece veya hafta sonu bırakılan tüm sesli mesajların kaç saat içinde dinlenip geri dönüldüğünü denetler.",
        steps: [
          "Durum filtresini 'Dinlenmedi (Yeni)' yapın.",
          "Bekleyen mesajları dinleyip ilgili dahiliye veya ekip liderine aktarın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Kullanıcıya sesli mesaj bırakılamıyor", cause: "Kullanıcı kartında Sesli Posta kapalı veya Cevapsız Yönlendirme hedefi Sesli Posta seçilmemiş.", solution: "Kullanıcılar → Düzenle → Özellikler'den Sesli Posta'yı aktif edip Profiller & Yönlendirme'de Cevapsız hedefi olarak atayın." }
    ],
    relatedPages: ["temsilci-cagri-paneli", "kullanicilar", "rapor-kacan-cagri"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-konferans-kullanim",
    number: "76",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Konferans Odası Kullanım Raporu (ConfBridge Katılımcı & Süre)",
    shortTitle: "Konferans Odası Kullanımı",
    menuPath: "Çağrı Raporları & Analiz → Konferans Odası Kullanımı",
    pbxRoute: "/?tab=raporlar-konferans",
    permissions: ["reports_conferences:access"],
    badge: "Rapor 44/44 • ConfBridge • Ses Kaydı",
    readMinutes: 6,
    summary:
      "Santralde kurulu ConfBridge sesli toplantı odalarının (3000+) aylık toplantı adedini, toplam konuşma dakikasını, her oturumdaki eşzamanlı katılımcı listesini (dahili/harici) ve toplantı ses kayıtlarını raporlar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-konferans-kullanim.jpg", caption: "Konferans Odası Kullanımı — Oda bazlı toplantı sayısı, katılımcı detayı, süre ve ses kaydı", routeHint: "Çağrı Raporları & Analiz → Konferans Odası Kullanımı" }
    ],
    fieldTable: [
      { field: "Konferans Oda Numarası, Toplantı Adedi & Toplam Süre", type: "Oda Bazlı Özet", defaultVal: "3000+ Odalar", required: false, description: "Hangi toplantı odalarının aktif kullanıldığını ve aylık toplam toplantı dakikasını gösterir." },
      { field: "Katılımcı Dökümü & Toplantı Ses Kaydı", type: "Giriş/Çıkış Saati + WAV", defaultVal: "Kayıt Açıksa", required: false, description: "Toplantıya hangi dahili veya dış telefonun kaç dakika katıldığını ve toplantı kaydını listeler." }
    ],
    sections: [
      {
        heading: "1. Kurumsal Toplantı Arşivi ve Maliyet Takibi",
        body: "Dış katılımcıların arandığı (Dial-Out) yönetim toplantılarının süresini ve kayıt arşivini tek merkezden denetlersiniz.",
        steps: [
          "Tarih aralığını seçip oda bazlı toplantı geçmişini açın.",
          "İlgili toplantının katılımcı dökümünü ve kayıt dosyasını indirin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Toplantı ses kaydı görünmüyor", cause: "İlgili konferans odasında Ses Kaydı anahtarı kapalı.", solution: "Santral → Konferans → Düzenle ekranından Ses Kaydı seçeneğini aktif edin." }
    ],
    relatedPages: ["konferans", "rapor-ses-kayitlari", "rapor-operator-dakika"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  }
];
