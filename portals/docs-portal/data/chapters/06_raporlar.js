export const CHAPTERS_RAPORLAR = [
  {
    id: "ozel-rapor-tasarimcisi",
    number: "32",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Özel Rapor Tasarımcısı & AI Rapor Üretici",
    shortTitle: "Özel Rapor Tasarımcısı",
    menuPath: "Çağrı Raporları & Analiz → Özel Rapor Tasarımcısı",
    pbxRoute: "/?tab=ozel-rapor-tasarimcisi",
    permissions: ["reports_custom_builder:access"],
    badge: "Sürükle-Bırak • Doğal Dil AI • Kaydet & Zamanla",
    readMinutes: 9,
    summary:
      "Hazır 44 kurumsal raporun ötesinde, SQL bilmeden kendi veri kaynağınızı, sütunlarınızı, gruplamalarınızı (temsilci, kuyruk, DID, saat, sonuç kodu), filtrelerinizi ve grafik türünüzü seçerek veya Türkçe doğal dilde yazarak ('Bu ay 30 sn üstü bekleyip kaçan çağrıları kuyruk bazında çıkar') sınırsız özel rapor tasarlayıp kaydedebileceğiniz BI stüdyosudur.",
    screenshots: [
      {
        src: "/screenshots/30-reports-custom-builder.jpg",
        caption: "Özel Rapor Tasarımcısı — AI doğal dil sorgu kutusu, veri kaynağı seçimi, filtreler ve canlı tablo/grafik",
        routeHint: "Çağrı Raporları & Analiz → Özel Rapor Tasarımcısı"
      }
    ],
    fieldTable: [
      { field: "AI Rapor Üretici Kutusu", type: "Türkçe Doğal Dil", defaultVal: "/api/reports/custom/ai-generate", required: false, description: "İstediğiniz raporu cümle olarak yazarsınız; sistem veri setini, metrikleri ve filtreleri otomatik doldurur." },
      { field: "Veri Kaynağı (Dataset)", type: "Çağrılar (CDR) / Kuyruklar / Temsilci Molaları / Omnichannel / Anketler / Randevular", defaultVal: "calls", required: true, description: "Sorgulanacak ana kurumsal tablo." },
      { field: "Metrikler & Gruplama (Group By)", type: "Adet / Toplam Süre / Ortalama / SLA %", defaultVal: "agent_extension / queue / date", required: true, description: "Özet tablo ve grafik kırılım eksenleri." },
      { field: "Kayıtlı Raporlar & Dışa Aktarım", type: "Kaydet / CSV / Excel / Zamanla", defaultVal: "Tek Tık", required: false, description: "Kaydedilen özel raporlar Zamanlanmış Raporlar ekranından her sabah yöneticilere otomatik mail atılabilir." }
    ],
    sections: [
      {
        heading: "1. Adım Adım Özel Rapor Oluşturma",
        body: "Hem görsel filtrelerle hem de AI asistanıyla saniyeler içinde yönetici raporu üretebilirsiniz:",
        steps: [
          "Üstteki AI kutusuna 'Son 30 günde 2000 kuyruğunda ortalama konuşma süresi 3 dakikanın üzerinde olan temsilcileri sırala' yazıp 'Oluştur'a basın.",
          "Tablo ve grafik önizlemesini inceleyin; gerekirse tarih aralığı veya departman filtresi ekleyin.",
          "'Raporu Kaydet' ile isim verip ekibinizle paylaşın veya CSV/Excel olarak indirin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Özel rapor boş sonuç döndürüyor", cause: "Seçilen tarih aralığında veya birleştirilen çoklu filtrelerde eşleşen çağrı kaydı yok.", solution: "Tarih aralığını 'Son 30 Gün' yapın ve filtreleri tek tek gevşeterek tekrar çalıştırın." }
    ],
    relatedPages: ["zamanlanmis-raporlar", "raporlar-pano-ve-cdr"],
    relatedApis: ["GET /api/reports/custom/metadata", "POST /api/reports/custom/execute", "POST /api/reports/custom/ai-generate"]
  },
  {
    id: "raporlar-pano-ve-cdr",
    number: "33",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Rapor Panosu, Detaylı CDR, Transfer Zinciri & DID / Hat Raporları",
    shortTitle: "Pano, CDR & DID/Hat",
    menuPath: "Çağrı Raporları & Analiz → Pano / CDR / Yoğunluk / Hat Kapasite / DID / Operatör Dakika / Hatalı Çağrı",
    pbxRoute: "/?tab=raporlar-detayli-cagri",
    permissions: ["reports_pano:access", "reports_cdr:access", "reports_traffic_load:access", "reports_trunk:access", "reports_did:access", "reports_trunk_minutes:access", "reports_invalid_calls:access"],
    badge: "CDR • Transfer Bacakları • DID • Dakika Paketi",
    readMinutes: 12,
    summary:
      "Santralden geçen her çağrının uçtan uca kayıt defteridir. Rapor Panosu (genel özet), Detaylı CDR (transfer ve çağrı toplama bacakları — call_legs — dahil), Saatlik/Günlük Yoğunluk Raporu, Hat Kapasite (Trunk) Raporu, DID Numara Raporu, Operatör Dakika & Paket Tüketimi ve Hatalı/Eşleşmeyen Çağrı analizlerini tek çatı altında açıklar.",
    screenshots: [
      {
        src: "/screenshots/31-reports-cdr.jpg",
        caption: "Detaylı Çağrı Raporu (CDR) — Gelişmiş filtreler, transfer zinciri (call_legs), anında ses dinleme ve CSV/Excel indirme",
        routeHint: "Çağrı Raporları & Analiz → CDR"
      }
    ],
    fieldTable: [
      { field: "Tarih Aralığı, Yön & Sonuç Filtresi", type: "Başlangıç–Bitiş / Gelen-Giden-Dahili / ANSWERED-NOANSWER-BUSY-FAILED", defaultVal: "Bugün", required: false, description: "Milyonlarca kayıt içinden milisaniyede aranan çağrıyı bulur." },
      { field: "Transfer & Pickup Zinciri (call_legs)", type: "Genişletilebilir Satır", defaultVal: "Her çağrıda", required: false, description: "Bir çağrı önce IVR'a, sonra 1000'e, oradan 1002'ye aktarıldıysa her bacağın süresini ve ayrı ses kaydını gösterir." },
      { field: "DID Raporu (reports-did)", type: "Hat Bazlı Analiz", defaultVal: "Tüm DID'ler", required: false, description: "Hangi 0850 / 0212 numaranızın kaç çağrı aldığını, cevaplama oranını ve ortalama süresini karşılaştırır (reklam/kampanya hattı ölçümü)." },
      { field: "Operatör Dakika & Paket (reports-trunk-minutes)", type: "Kota Takibi", defaultVal: "Aylık Paket", required: false, description: "Dış Hat ayarında tanımlı aylık dakika paketinin tüketim yüzdesini, kalan dakikayı ve aşım tahminini raporlar." },
      { field: "Hat Kapasite & Yoğunluk (reports-trunk / traffic-load)", type: "Eşzamanlı Kanal Zirvesi", defaultVal: "Saatlik / Günlük", required: false, description: "Günün hangi saatlerinde maksimum eşzamanlı kanal kullanıldığını göstererek operatör kanal artırımı kararını netleştirir." },
      { field: "Hatalı & Eşleşmeyen Çağrı (reports-invalid-calls)", type: "Teşhis Raporu", defaultVal: "Otomatik", required: false, description: "Yanlış çevrilen numaraları, yetkisiz çıkış denemelerini ve gelen DID eşleşme hatalarını Türkçe nedenleriyle listeler." }
    ],
    sections: [
      {
        heading: "1. CDR Satırından Tek Tıkla Ses Kaydı, Transkript ve Müşteri 360°",
        body: "CDR tablosundaki herhangi bir çağrıya tıkladığınızda sağ çekmecede çağrının çift kanallı ses oynatıcısı, AI konuşma özeti, duygu rozeti, tam Türkçe transkripti, kalite (QA) puanı ve arayanın Müşteri 360° geçmişi açılır."
      }
    ],
    troubleshooting: [
      { problem: "CDR'da süre 0 saniye ve durum NOANSWER görünüyor", cause: "Arayan kişi çalarken telefonu kapattı veya hedef dahili/kuyruk cevap vermedi.", solution: "Çağrı bacaklarını (call_legs) açarak çağrının hangi dahili veya kuyrukta kaç saniye çalıp düştüğünü inceleyin." }
    ],
    relatedPages: ["ses-kayitlari-ve-transkript", "dis-hat-tanimi", "ozel-rapor-tasarimcisi"],
    relatedApis: ["GET /api/v1/cdr", "GET /api/v1/cdr/{call_id}", "GET /api/reports/trunk-package-usage"]
  },
  {
    id: "ses-kayitlari-ve-transkript",
    number: "34",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Ses Kayıtları (Çift Kanal RX/TX), Çağrı Transkripti & Temsilci Notları",
    shortTitle: "Ses Kayıtları & Transkript",
    menuPath: "Çağrı Raporları & Analiz → Ses Kayıtları / Çağrı Transkripti / Temsilci Notları",
    pbxRoute: "/?tab=raporlar-ses-kayitlari",
    permissions: ["reports_audio:access", "reports_transcripts:access", "reports_notes:access"],
    badge: "Dalga Formu • RX/TX Kanal Ayrımı • Kelime Arama",
    readMinutes: 9,
    summary:
      "Tüm çağrı ses kayıtlarını görsel ses dalga formu (waveform) ile dinleme, müşteri (RX) ve temsilci (TX) ses kanallarını ayrı ayrı test etme/indirme, AI tarafından otomatik metne çevrilmiş çağrı transkriptleri içinde anahtar kelime arama ve temsilcilerin görüşme sonrası (ACW) bıraktığı notları denetleme modülleridir.",
    screenshots: [
      {
        src: "/screenshots/32-reports-audio.jpg",
        caption: "Ses Kayıtları — Dalga formu oynatıcısı, hız kontrolü (1x/1.5x/2x), çift kanal RX/TX ayrımı ve WAV indirme",
        routeHint: "Çağrı Raporları & Analiz → Ses Kayıtları"
      }
    ],
    fieldTable: [
      { field: "Çift Kanal (Split RX / TX) Oynatıcı", type: "Müşteri + Temsilci Ayrı Kanal", defaultVal: "/api/recordings/{call_id}/channels", required: false, description: "Tek yönlü ses veya mikrofon gürültüsü şikayetlerinde müşteri sesini (RX) ve temsilci sesini (TX) ayrı ayrı dinleyip PCM sinyal seviyesini görebilirsiniz." },
      { field: "Oynatma Hızı & Zaman Damgalı Transkript", type: "0.75x – 2x + Senkron Metin", defaultVal: "1.0x", required: false, description: "Kalite ekiplerinin 10 dakikalık görüşmeyi 2x hızda dinlerken transkriptte tıkladığı saniyeye anında atlamasını sağlar." },
      { field: "Transkript İçinde Tam Metin Arama", type: "Full-Text Search", defaultVal: "PostgreSQL", required: false, description: "Örn. 'iptal', 'kargo', 'indirim' geçen tüm görüşmeleri binlerce kayıt arasından saniyede bulur." },
      { field: "Temsilci Notları & Sonuç Kodları", type: "ACW Notu + Disposition", defaultVal: "Tarih / Temsilci Filtreli", required: false, description: "Temsilcilerin veya AI Not Asistanının her görüşme için bıraktığı özet notları dışa aktarır." }
    ],
    sections: [
      {
        heading: "1. Harici Depolama (NAS / SMB / SFTP) ve KVKK Saklama Süresi",
        body: "Ses kayıtları varsayılan olarak yerel diskte saklanır; Sistem Ayarları → Kayıt & Saklama Sistemi üzerinden Windows File Server (SMB), NFS veya SFTP sunucusuna otomatik arşivlenebilir ve KVKK gereği X gün sonra otomatik imha edilebilir."
      }
    ],
    troubleshooting: [
      { problem: "Ses kaydı listede var ama oynatıcı 'Dosya bulunamadı' diyor", cause: "Saklama politikası (Retention) dosyayı arşivlemiş/silmiş veya harici NAS bağlantısı kopmuş olabilir.", solution: "Sistem Ayarları → Kayıt & Saklama Sistemi ekranından depolama bağlantı durumunu test edin." }
    ],
    relatedPages: ["bakim-yedekleme-ve-kayit-saklama", "raporlar-pano-ve-cdr", "ai-analitik-duygu-niyet-qa"],
    relatedApis: ["GET /api/v1/cdr/{call_id}/recording", "GET /api/v1/cdr/{call_id}"]
  },
  {
    id: "ai-analitik-duygu-niyet-qa",
    number: "35",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "AI Analitik: Duygu, Niyet, Kalite (QA), Senaryo Sadakati, ROI & CEO Özeti",
    shortTitle: "AI Analitik, QA & CEO Özeti",
    menuPath: "Çağrı Raporları & Analiz → Duygu / Niyet / QA / Isı Haritası / Kelime Bulutu / ROI / A-B / Çile Noktaları / Sadakat / Sessizlik / CEO Özeti / AI Randevu & RAG",
    pbxRoute: "/?tab=raporlar-kalite-degerlendirme",
    permissions: ["reports_sentiment:access", "reports_intent:access", "reports_qa:access", "reports_sentiment_heat:access", "reports_wordcloud:access", "reports_roi:access", "reports_ab_testing:access", "reports_friction:access", "reports_compliance:access", "reports_silence:access", "reports_ceo_summary:access", "reports_ai_appointments_rag:access"],
    badge: "12 AI Raporu • Otomatik QA Puanlama • ROI",
    readMinutes: 13,
    summary:
      "Nornia'nın yapay zeka konuşma analitiği motorunun her çağrı sonrası otomatik ürettiği 12 ileri seviye yönetici raporunu kapsar: Duygu Analizi, Duygu Isı Haritası, Müşteri Niyet Raporu, Otomatik Kalite Değerlendirme (QA), Kelime Bulutu & Trendler, AI vs. İnsan ROI Paneli, Verimlilik Karşılaştırması (A/B), Müşteri Çile Noktaları (Friction), Senaryo Sadakati (Compliance), Sessizlik & Söz Kesme, CEO Özet Raporu ve AI Randevu & RAG Raporu.",
    screenshots: [
      {
        src: "/screenshots/33-reports-qa.jpg",
        caption: "Yapay Zeka Kalite Değerlendirme (QA) & Analitik — Otomatik 100 üzerinden puanlama, kriter bazlı başarı ve duygu analizi",
        routeHint: "Çağrı Raporları & Analiz → Kalite Değerlendirmeleri"
      }
    ],
    fieldTable: [
      { field: "Kalite Değerlendirmeleri (QA)", type: "0–100 Otomatik Skor", defaultVal: "Kriter Ağırlıklı", required: false, description: "Her çağrıyı tanımlı QA soru setine göre (selamlama, KVKK, çözüm, nezaket) otomatik puanlar; %100 çağrı denetimi sağlar." },
      { field: "Duygu Analizi & Isı Haritası", type: "Pozitif / Nötr / Negatif + Saatlik Matris", defaultVal: "Otomatik", required: false, description: "Günün hangi saatlerinde ve hangi kuyruklarda müşteri memnuniyetsizliğinin yoğunlaştığını renkli ısı haritasında gösterir." },
      { field: "Niyet Raporu (Intent) & Kelime Bulutu", type: "Kategori Dağılımı", defaultVal: "AI Sınıflandırma", required: false, description: "Müşterilerin neden aradığını (Fiyat, Arıza, İade, Kargo, Randevu) yüzdesel grafikle ve trend kelimelerle özetler." },
      { field: "Müşteri Çile Noktaları (Friction) & Sessizlik", type: "Operasyonel Darboğaz", defaultVal: "Otomatik", required: false, description: "Müşteriyi en çok yoran süreçleri, uzun sessizlik (dead-air) ve temsilci söz kesme (talk-over) oranlarını çıkarır." },
      { field: "Senaryo Sadakati (Compliance)", type: "% Uyumluluk Skoru", defaultVal: "Kural Bazlı", required: false, description: "Zorunlu yasal/kurumsal cümlelerin temsilciler tarafından okunma oranını ve ihlalleri raporlar." },
      { field: "AI vs. İnsan ROI & CEO Özeti", type: "Finansal Tasarruf + Yönetici Özeti", defaultVal: "ROI Ayarlarına Bağlı", required: false, description: "AI asistanın karşıladığı çağrıların insan maliyetine göre sağladığı aylık TL/$ tasarrufu ve tek sayfalık yönetim özetini sunar." },
      { field: "AI Randevu & Bilgi Bankası (RAG) Raporu", type: "Dönüşüm & Bilgi Kapsamı", defaultVal: "Otomatik", required: false, description: "AI tarafından oluşturulan randevu başarısını ve RAG bilgi bankasında yanıt bulunamayan müşteri sorularını listeler." }
    ],
    sections: [
      {
        heading: "1. %100 Otomatik Kalite Denetimi Nasıl Çalışır?",
        body: "Geleneksel çağrı merkezlerinde kalite uzmanları çağrıların yalnızca %2–3'ünü dinleyebilirken, Nornia her tamamlanan sesli ve yazılı görüşmeyi arka planda Sistem Ayarları → Çağrı Kalite Kontrol kriterlerinizden geçirerek %100 kapsamla puanlar; 60 puanın altındaki görüşmeleri anında eğitim listesine düşürür."
      }
    ],
    troubleshooting: [
      { problem: "QA veya Duygu Analizi raporları boş görünüyor", cause: "Kullanıcı kartında Ses Kayıt Modu 'Yapay Zeka (AI)' seçilmemiş veya AI API sağlayıcısı yapılandırılmamış.", solution: "İlgili kullanıcılarda ses kaydını 'Yapay Zeka (AI)' yapın ve Yapay Zeka API Ayarları'nda aktif anahtar tanımlı olduğunu doğrulayın." }
    ],
    relatedPages: ["yapay-zeka-ayar-ve-yonlendirme", "ses-kayitlari-ve-transkript", "bilgi-bankasi-rag"],
    relatedApis: ["GET /api/reports/intent-analysis", "GET /api/reports/enterprise/ai-appointments-rag", "GET /api/qa/questions"]
  },
  {
    id: "temsilci-performans-mola-puantaj",
    number: "36",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Temsilci Performans & KPI, Kronoloji, Mola / Puantaj & Süpervizör Denetimi",
    shortTitle: "Temsilci KPI & Mola/Puantaj",
    menuPath: "Çağrı Raporları & Analiz → Temsilci Performans / Kronoloji / Mola & Puantaj / Süpervizör Dinleme",
    pbxRoute: "/?tab=mola-ve-puantaj-raporu",
    permissions: ["reports_perf:access", "agent_timeline:access", "reports_breaks_attendance:access", "reports_supervisor_audit:access"],
    badge: "AHT • Puantaj • WFM Vardiya • Süpervizör Audit",
    readMinutes: 10,
    summary:
      "Çağrı merkezi insan kaynakları ve takım liderlerinin temsilci bazlı verimliliğini (AHT, ACW, cevaplama oranı), gün içi saniye saniye durum zaman çizelgesini (Kronoloji), ilk giriş / son çıkış ve mola türü bazlı puantaj dökümünü (WFM Vardiya karşılaştırmalı) ve süpervizörlerin tüm dinleme/sufle/araya girme kayıtlarını incelediği performans paketidir.",
    screenshots: [
      {
        src: "/screenshots/34-reports-breaks.jpg",
        caption: "Mola & Puantaj Raporu ve WFM Vardiya Planlayıcı — Günlük giriş-çıkış, mola kırılımı ve net çalışma süreleri",
        routeHint: "Çağrı Raporları & Analiz → Mola & Puantaj Raporu"
      }
    ],
    fieldTable: [
      { field: "Temsilci Performans & KPI (reports-perf)", type: "AHT / ACW / Cevaplama %", defaultVal: "Tarih & Kuyruk Filtreli", required: false, description: "Her temsilcinin gelen/giden/cevapsız çağrı adedi, ortalama konuşma süresi (AHT) ve ortalama değerlendirme skoru." },
      { field: "Temsilci Kronolojisi (agent-status-timeline)", type: "Gantt Zaman Çizelgesi", defaultVal: "Günlük", required: false, description: "Temsilcinin 09:00–18:00 arasında hangi dakika Müsait, Konuşuyor, Yemek Molası veya Çevrimdışı olduğunu renkli şerit halinde gösterir." },
      { field: "Mola & Puantaj + WFM Vardiya (breaks-attendance)", type: "Bordro / İK Uyumlu Excel", defaultVal: "agent_break_logs", required: false, description: "İlk oturum açma, son çıkış, toplam mola (Yemek / İhtiyaç / Eğitim ayrı), geç kalma ve WFM vardiya uyumunu hesaplar." },
      { field: "Süpervizör Dinleme & Müdahale (supervisor-audit)", type: "Denetim Kaydı", defaultVal: "Salt Okunur", required: false, description: "Hangi süpervizörün hangi temsilciyi ne zaman Listen / Whisper / Barge ile dinlediğini şeffaf biçimde raporlar." }
    ],
    sections: [
      {
        heading: "1. WFM Vardiya Planlayıcı Entegrasyonu",
        body: "Mola & Puantaj ekranı içindeki WFM Vardiya Planlayıcı kartı (/api/settings/agent-shifts) ile her temsilciye haftalık mesai saatleri atanabilir; rapor otomatik olarak planlanan vardiya ile gerçekleşen giriş-çıkış farkını (geç kalma / erken çıkma / fazla mesai) vurgular."
      }
    ],
    troubleshooting: [
      { problem: "Temsilcinin çıkış saati akşam 23:59 görünüyor", cause: "Temsilci mesai sonunda çıkış (Logout) yapmadan tarayıcıyı açık bırakmış.", solution: "ACD Kuyruk ayarlarından 'Otomatik Çıkış (Özel Saat: 18:00)' özelliğini ve Kullanıcı kartından 'Hareketsizlikte Otomatik Çıkış (1-2 Saat)' kuralını aktif edin." }
    ],
    relatedPages: ["canli-cagri-izleme", "acd-kuyruk", "roller-kvkk-ve-ldap"],
    relatedApis: ["GET /api/reports/enterprise/breaks-attendance", "GET /api/reports/enterprise/agent-kpi-metrics", "GET /api/reports/agent-timeline", "GET /api/reports/enterprise/supervisor-audit"]
  },
  {
    id: "kuyruk-sla-anket-ve-fcr",
    number: "37",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Kuyruk SLA & Hız Dilimleri, Anket (CSAT), FCR, IVR Terk, Kaçan & Tekrar Arayanlar",
    shortTitle: "Kuyruk SLA, Anket & FCR",
    menuPath: "Çağrı Raporları & Analiz → Kuyruk / Kuyruk SLA / Anket / FCR / Kaçan Çağrı / IVR Terk / Aktarma-Bekletme / Tekrar Arayanlar / Departman-Toplama / Sonuç Kodları",
    pbxRoute: "/?tab=kuyruk-sla-ve-hiz-dilimleri",
    permissions: ["reports_queue:access", "reports_queue_sla:access", "reports_survey:access", "reports_fcr:access", "reports_missed:access", "reports_ivr_drop:access", "reports_transfer_hold:access", "reports_repeat_callers:access", "reports_dept_pickup:access", "reports_disposition:access"],
    badge: "10 Kuyruk Raporu • SLA Dilimleri • CSAT • FCR",
    readMinutes: 11,
    summary:
      "Çağrı merkezi servis seviyesi (SLA) yönetimini en ince metriklere bölen 10 operasyon raporudur: Kuyruk/Bekleme Analitiği, Kuyruk SLA & Cevaplama Hız Dilimleri (0-10/10-20/20-30/30+ sn), Müşteri Memnuniyet Anketi (CSAT), İlk Aramada Çözüm (FCR), Kaçan Çağrı Analizi, IVR Terk Oranı, Aktarma & Bekletme, Tekrar Eden Arayanlar, Departman & Çağrı Toplama ve Çağrı Sonuç Kodları (Disposition).",
    screenshots: [
      {
        src: "/screenshots/35-reports-queue-sla.jpg",
        caption: "Kuyruk SLA & Hız Dilimleri — 0-10 sn / 10-20 sn / 20-30 sn cevaplama dağılımı ve terk analizi",
        routeHint: "Çağrı Raporları & Analiz → Kuyruk SLA & Hız Dilimleri"
      }
    ],
    fieldTable: [
      { field: "Kuyruk SLA & Hız Dilimleri (queue-sla)", type: "0-10s / 10-20s / 20-30s / 30s+", defaultVal: "Kuyruk Bazlı", required: false, description: "Çağrıların kaç saniyede açıldığını ve terk edenlerin (abandoned) kaçıncı saniyede kapattığını dilim bazlı gösterir." },
      { field: "Anket Raporları (reports-survey)", type: "1–5 Yıldız CSAT", defaultVal: "Kuyruk & Temsilci Kırılımı", required: false, description: "Çağrı sonrası DTMF memnuniyet anketi sonuçlarını, düşük puanlı (1–2) çağrıların ses kayıt linkleriyle listeler." },
      { field: "İlk Aramada Çözüm (FCR) & Tekrar Arayanlar", type: "24/72 Saat Penceresi", defaultVal: "Otomatik Eşleşme", required: false, description: "Aynı numaranın 24–72 saat içinde tekrar arayıp aramadığını ölçerek gerçek FCR başarısını hesaplar." },
      { field: "IVR Terk Oranı & Kaçan Çağrı", type: "Huni (Funnel) Analizi", defaultVal: "CallFlow Düğüm Bazlı", required: false, description: "Müşterilerin IVR anonsunun hangi adımında kapattığını ve geri aranmamış kaçan çağrıları vurgular." },
      { field: "Aktarma & Bekletme / Departman & Toplama / Sonuç Kodları", type: "Operasyonel Kırılım", defaultVal: "CSV/Excel", required: false, description: "Gereksiz transferleri, uzun bekletmeleri, *8 çağrı toplama istatistiklerini ve çağrı sonuç kodu (Satış, Bilgi, Şikayet) dağılımını verir." }
    ],
    sections: [
      {
        heading: "1. SLA İyileştirme İçin Hızlı Aksiyon Rehberi",
        body: "Kuyruk SLA raporunda 20–30 sn üzeri terkler artıyorsa: (1) ACD Kuyruk'ta 45. saniyede 'Geri Arama / AI Asistan Taşması' ekleyin; (2) Yoğunluk Raporu'na bakarak pik saatlerde (örn. 10:00–12:00) Penalty=1 yedek ekibi devreye alın; (3) IVR anons süresini 20 saniyenin altında tutun."
      }
    ],
    troubleshooting: [
      { problem: "Anket Raporunda hiç kayıt görünmüyor", cause: "İlgili ACD Kuyruk düzenlemesinde 'Çağrı Sonrası Anket' kapalı veya müşteri temsilciden önce kapatıyor.", solution: "ACD Kuyruk → Anket sekmesinden anketi aktif edin; anketin tetiklenmesi için görüşmeyi temsilcinin sonlandırması gerektiğini ekibe bildirin." }
    ],
    relatedPages: ["acd-kuyruk", "arama-akis-yonetimi", "temsilci-performans-mola-puantaj"],
    relatedApis: ["GET /api/reports/enterprise/queue-sla", "GET /api/reports/queue-surveys", "GET /api/reports/enterprise/repeat-callers", "GET /api/reports/enterprise/disposition"]
  },
  {
    id: "omnichannel-voip-ve-diger-raporlar",
    number: "38",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Omnichannel SLA, Kampanya/Geri Arama, VoIP/MOS Kalitesi, Yönlendirme, Güvenlik, Voicemail & Konferans",
    shortTitle: "Omnichannel, VoIP MOS & Diğer",
    menuPath: "Çağrı Raporları & Analiz → Omnichannel SLA / Kampanya-Geri Arama / VoIP MOS / Yönlendirme-GSM / Engellenen-İhlal / Sesli Posta / Konferans Kullanımı",
    pbxRoute: "/?tab=voip-ses-kalitesi-mos-raporu",
    permissions: ["reports_omnichannel:access", "reports_dialer_callback:access", "reports_voip_quality:access", "reports_forwarding_gsm:access", "reports_blacklist_security:access", "reports_voicemail:access", "reports_conferences:access"],
    badge: "7 Uzman Rapor • MOS/Jitter • GSM Maliyet • Güvenlik",
    readMinutes: 10,
    summary:
      "Sesli çağrıların dışındaki tüm kurumsal kanalları ve altyapı kalitesini denetleyen 7 uzman raporudur: Omnichannel Kanal & SLA, Kampanya & Geri Arama (Dialer/Callback), VoIP & Ses Kalitesi (MOS / Jitter / Paket Kaybı), Yönlendirme (Follow-Me / GSM), Engellenen Çağrı & İhlal, Sesli Posta (Voicemail) ve Konferans Odası Kullanım Raporu.",
    screenshots: [
      {
        src: "/screenshots/36-reports-voip-quality.jpg",
        caption: "VoIP & Ses Kalitesi (MOS) Raporu — Ortalama MOS skoru (1.0–4.5), RTT gecikme, Jitter ve paket kaybı teşhisi",
        routeHint: "Çağrı Raporları & Analiz → VoIP & Ses Kalitesi (MOS)"
      }
    ],
    fieldTable: [
      { field: "VoIP & Ses Kalitesi — MOS (voip-quality)", type: "MOS 1.0–4.5 / RTT ms / Jitter ms / Loss %", defaultVal: "RTCP + WebRTC", required: false, description: "4.0–4.5 Mükemmel, 3.5–4.0 İyi, <3.5 Ağ/Wi-Fi sorunu uyarısı. 'Sesim kesiliyor' diyen uzaktan çalışanı anında tespit eder." },
      { field: "Omnichannel Kanal & SLA (reports-omnichannel)", type: "İlk Yanıt (FRT) & Çözüm Süresi", defaultVal: "Kanal Bazlı", required: false, description: "WhatsApp, Telegram, Instagram, Facebook ve E-Posta mesaj hacmi, AI vs İnsan çözüm oranı ve ortalama yanıt süresi." },
      { field: "Kampanya & Geri Arama (dialer-callback)", type: "Ulaşım & Dönüşüm %", defaultVal: "Kampanya Bazlı", required: false, description: "Dialer kampanyalarının ve temsilci Callback görevlerinin tamamlanma oranlarını gösterir." },
      { field: "Yönlendirme / GSM (forwarding-gsm)", type: "Follow-Me Maliyet Takibi", defaultVal: "Abone Bazlı", required: false, description: "Hangi dahilinin kaç çağrıyı GSM'e yönlendirdiğini ve toplam GSM dakika tüketimini raporlar." },
      { field: "Engellenen Çağrı & İhlal / Voicemail / Konferans", type: "Güvenlik & Kullanım", defaultVal: "Tam Kayıt", required: false, description: "Kara liste ve dolandırıcılık blokları, dinlenmemiş sesli postalar ve konferans katılımcı süreleri." }
    ],
    sections: [
      {
        heading: "1. MOS Skoru ile Uzaktan Çalışan Ağ Kalitesi Teşhisi",
        body: "Evden çalışan bir temsilcide MOS < 3.4 ve Paket Kaybı > %2 görünüyorsa sorun santralde değil temsilcinin Wi-Fi/internet hattındadır. Kullanıcıya kablolu Ethernet'e geçmesi veya G.729 düşük bant kodeğine alınması önerilir."
      }
    ],
    troubleshooting: [
      { problem: "Tüm çağrılarda Jitter 80 ms üzerinde görünüyor", cause: "Ofis router'ında VoIP için QoS (DSCP EF / 46) önceliği yok veya upload hattı yedekleme/video trafiğiyle dolmuş.", solution: "Router'da RTP portlarına (10000–20000 UDP) ve SIP sunucusuna en yüksek QoS önceliği tanımlayın." }
    ],
    relatedPages: ["sorun-inceleme-sip-debugger", "ortak-gelen-kutusu", "dis-arama-dialer", "konferans"],
    relatedApis: ["GET /api/reports/enterprise/voip-quality", "GET /api/reports/enterprise/omnichannel", "GET /api/reports/enterprise/forwarding-gsm", "GET /api/reports/enterprise/blacklist-security"]
  }
];
