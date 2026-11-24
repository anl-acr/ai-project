// Çağrı Raporları & Analiz — Raporlar 1–22 (Her Rapor İçin Ayrı Sayfa, Canlı Görsel & PDF)
export const CHAPTERS_RAPORLAR_A = [
  {
    id: "ozel-rapor-tasarimcisi",
    number: "33",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Özel Rapor Tasarımcısı & AI Rapor Üretici",
    shortTitle: "Özel Rapor Tasarımcısı",
    menuPath: "Çağrı Raporları & Analiz → Özel Rapor Tasarımcısı",
    pbxRoute: "/?tab=ozel-rapor-tasarimcisi",
    permissions: ["reports_custom_builder:access"],
    badge: "Rapor 1/44 • BI Stüdyosu • AI Sorgu",
    readMinutes: 9,
    summary:
      "Hazır 43 kurumsal raporun ötesinde, SQL yazmadan kendi veri kaynağınızı, sütunlarınızı, gruplamalarınızı, koşul mantığınızı (VE/VEYA) ve grafik tipinizi seçerek veya Türkçe doğal dilde yazarak sınırsız özel rapor tasarlayıp kaydedebileceğiniz ve Zamanlanmış Raporlara bağlayabileceğiniz BI stüdyosudur.",
    screenshots: [
      { src: "/screenshots/reports/ozel-rapor-tasarimcisi.jpg", caption: "Özel Rapor Tasarımcısı — Doğal dil AI rapor üretici, veri kaynağı, sütun/filtre seçici ve canlı önizleme", routeHint: "Çağrı Raporları & Analiz → Özel Rapor Tasarımcısı" }
    ],
    fieldTable: [
      { field: "AI Rapor Üretici Kutusu", type: "Türkçe Doğal Dil", defaultVal: "POST /api/reports/custom/ai-generate", required: false, description: "Örn. 'Bu ay 30 sn üstü bekleyip kaçan çağrıları kuyruk bazında çıkar' cümlesini otomatik veri seti, sütun ve filtrelere çevirir." },
      { field: "Veri Kaynağı (Dataset)", type: "Çağrılar / Kuyruklar / Molalar / Omnichannel / Anketler / Randevular", defaultVal: "calls", required: true, description: "Sorgulanacak ana PostgreSQL kurumsal tablosunu seçer." },
      { field: "Sütunlar, Metrikler & Gruplama (Group By)", type: "Adet / Toplam / Ortalama / Min-Maks / SLA %", defaultVal: "Çoklu Seçim", required: true, description: "Temsilci, kuyruk, DID, saat, yön veya sonuç kodu kırılımlarıyla özet tablo ve grafik üretir." },
      { field: "Koşul Mantığı (AND / OR) & Kayıtlı Şablonlar", type: "Çoklu Koşul + CSV/Excel + Zamanla", defaultVal: "AND", required: false, description: "Kaydedilen özel raporlar ekip arkadaşlarıyla paylaşılabilir veya Zamanlanmış Raporlar ile otomatik e-posta olarak gönderilebilir." }
    ],
    sections: [
      {
        heading: "1. Görsel ve Yapay Zeka İle Özel Rapor Oluşturma",
        body: "İster sol panelden veri kaynağını ve sütunları seçin, ister üstteki AI kutusuna Türkçe talebinizi yazın; sistem saniyeler içinde canlı tabloyu ve grafiği çizer.",
        steps: [
          "Veri kaynağını seçin veya AI Rapor Üretici kutusuna istediğiniz kırılımı Türkçe yazıp 'Oluştur'a basın.",
          "Filtre mantığını (VE / VEYA) ve tarih aralığını doğrulayın, önizleme tablosunu inceleyin.",
          "'Raporu Kaydet' butonuna basıp adlandırın; isterseniz CSV/Excel indirin veya Zamanlanmış Raporlara bağlayın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Özel rapor 0 satır dönüyor", cause: "Birden fazla VE (AND) koşulu kesişmiyor veya seçili tarih aralığında veri yok.", solution: "Tarih aralığını genişletin ya da filtre mantığını VEYA (OR) olarak test edin." }
    ],
    relatedPages: ["zamanlanmis-raporlar", "rapor-pano", "rapor-cdr"],
    relatedApis: ["GET /api/reports/custom/metadata", "POST /api/reports/custom/execute", "POST /api/reports/custom/ai-generate"]
  },
  {
    id: "rapor-pano",
    number: "34",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Rapor Panosu (Genel Çağrı Özet Kokpiti)",
    shortTitle: "Rapor Panosu",
    menuPath: "Çağrı Raporları & Analiz → Pano",
    pbxRoute: "/?tab=raporlar-pano",
    permissions: ["reports_pano:access"],
    badge: "Rapor 2/44 • Yönetici Özeti",
    readMinutes: 6,
    summary:
      "Seçilen tarih aralığındaki tüm gelen, giden, dahili, cevaplanan ve cevapsız çağrı hacmini, cevaplama oranını (%), ortalama konuşma süresini, günlük/saatlik trafik trend grafiğini ve en aktif temsilci/kuyruk özetini tek ekranda sunan ana rapor panosudur.",
    screenshots: [
      { src: "/screenshots/reports/rapor-pano.jpg", caption: "Rapor Panosu — Toplam çağrı KPI kartları, cevaplama oranı, trafik trend grafiği ve özet dağılım", routeHint: "Çağrı Raporları & Analiz → Pano" }
    ],
    fieldTable: [
      { field: "Tarih Aralığı & Hızlı Dönem Seçici", type: "Bugün / Dün / 7 Gün / 30 Gün / Bu Ay / Özel", defaultVal: "Son 30 Gün", required: true, description: "Tüm KPI kartları ve trend grafiklerini seçilen zaman dilimine göre anında yeniler." },
      { field: "Özet KPI Kartları", type: "Toplam / Cevaplanan / Cevapsız / AI Çözüm / Ort. Süre", defaultVal: "Canlı Hesap", required: false, description: "Santral genel performansının üst seviye sağlık göstergeleri." },
      { field: "Yön & Sonuç Dağılım Grafikleri", type: "Gelen / Giden / Dahili + Trend", defaultVal: "Etkileşimli Grafik", required: false, description: "Günlük arama hacmindeki yükseliş/düşüşleri ve cevaplama eğrisini görselleştirir." },
      { field: "Süpervizör Kapsam Filtresi", type: "Yönetilen Ekip / Kuyruk İzolasyonu", defaultVal: "Rol Bazlı", required: false, description: "Süpervizör kullanıcısıysa yalnızca yetkili olduğu kuyruk ve ekibin rakamlarını görür." }
    ],
    sections: [
      {
        heading: "1. Günlük & Aylık Performans Kontrolü",
        body: "Sabah operasyon toplantılarında veya haftalık yönetim sunumlarında ilk bakılacak özet ekrandır.",
        steps: [
          "Üst tarih çubuğundan dönem seçin (örn. Bu Hafta veya Geçen Ay).",
          "Cevaplama oranı %90 altına düştüyse 'Kaçan Çağrı Analizi' ve 'Yoğunluk Raporu'na geçerek hangi saatte darboğaz oluştuğunu görün."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Pano rakamları ile Canlı AI Pano sayaçları farklı", cause: "Canlı AI Pano yalnızca bugünü (00:00 UTC+3'ten itibaren), Rapor Panosu ise seçili tarih aralığını gösterir.", solution: "İki ekranı kıyaslamak için Rapor Panosunda tarih filtresini 'Bugün' olarak seçin." }
    ],
    relatedPages: ["rapor-cdr", "rapor-ceo-ozeti", "rapor-yogunluk"],
    relatedApis: ["GET /api/v1/reports/cdr", "GET /api/reports/summary"]
  },
  {
    id: "rapor-cdr",
    number: "35",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "CDR — Detaylı Çağrı Kayıtları & Transfer Zinciri (call_legs)",
    shortTitle: "CDR Çağrı Kayıtları",
    menuPath: "Çağrı Raporları & Analiz → CDR",
    pbxRoute: "/?tab=raporlar-detayli-cagri",
    permissions: ["reports_cdr:access"],
    badge: "Rapor 3/44 • Transfer Bacakları • Excel/CSV",
    readMinutes: 10,
    summary:
      "Santralden geçen her bir görüşmenin saniye hassasiyetindeki tam dökümüdür. Arayan/Aranan/DID bilgisi, yön, dahili, kuyruk, çalma ve konuşma süresi, sonuç kodu, duygu etiketi, QA puanı, satır içi ses oynatıcı, transkript/özet/QA/not popup'ları ve genişletilebilir Transfer Zinciri (call_legs) içerir.",
    screenshots: [
      { src: "/screenshots/reports/rapor-cdr.jpg", caption: "Detaylı CDR — Gelişmiş arama/filtreleme, çağrı bacakları (call_legs), satır içi ses/transkript/QA ve CSV/Excel dışa aktarım", routeHint: "Çağrı Raporları & Analiz → CDR" }
    ],
    fieldTable: [
      { field: "Çoklu Filtre Çubuğu", type: "Tarih / Numara / Yön / Durum / Kuyruk / Temsilci / DID / Sonuç Kodu", defaultVal: "Tam Metin & Kırılım", required: false, description: "Milyonlarca kayıt arasından tek bir müşterinin veya belirli bir kuyruğun çağrılarını milisaniyede süzer." },
      { field: "Çağrı Bacakları (Transfer & *8 Pickup Zinciri)", type: "Genişletilebilir call_legs Satırı", defaultVal: "Otomatik İzleme", required: false, description: "Bir çağrı önce IVR'a, sonra 1001'e, oradan 1002'ye aktarıldıysa her bacağın süresini ve kimlerin konuştuğunu ayrı ayrı listeler." },
      { field: "Satır İçi Popup'lar (Transkript, AI Özet, QA Puanı, Temsilci Notları)", type: "4 Derin İnceleme Modalı", defaultVal: "Tek Tık", required: false, description: "Sayfadan çıkmadan görüşme kaydını dinlemenizi, dökümü okumanızı ve QA puan kartını incelemenizi sağlar." },
      { field: "CSV / Excel Dışa Aktarım", type: "UTF-8 BOM Excel Uyumlu", defaultVal: "Filtrelenmiş Veri", required: false, description: "Türkçe karakter bozulması olmadan tüm sütunları muhasebe/BI analizine aktarır." }
    ],
    sections: [
      {
        heading: "1. Bir Müşterinin Tüm Transfer Hikayesini İzleme",
        body: "Karmaşık çağrı yönlendirmelerinde 'bu müşteri kiminle konuştu, nereye aktarıldı?' sorusunun kesin yanıtı CDR tablosundaki bacak (call_legs) genişletmesindedir.",
        steps: [
          "Arama kutusuna müşterinin telefon numarasının son 7–10 hanesini yazın.",
          "İlgili satırın solundaki genişletme okuna tıklayarak IVR → Kuyruk → Dahili → Transfer bacaklarını görün.",
          "Satır sonundaki kulaklık, döküm veya QA ikonlarına basarak ses kaydını ve yapay zeka analizini inceleyin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "CDR'da DID sütunu boş veya 's' görünüyor", cause: "Eski Asterisk dialplan'ında REAL_DID çıkarıcısı güncellenmemiş.", solution: "Sistem Ayarları → Santral Entegrasyonu'ndan Asterisk senkronizasyonunu çalıştırın; REAL_DID PJSIP To başlığından otomatik okunur." }
    ],
    relatedPages: ["rapor-ses-kayitlari", "rapor-cagri-transkripti", "rapor-aktarma-bekletme"],
    relatedApis: ["GET /api/v1/reports/cdr", "GET /api/v1/recordings/{call_id}"]
  },
  {
    id: "rapor-ses-kayitlari",
    number: "36",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Ses Kayıtları Arşivi (Çift Kanal RX/TX & Dalga Formu Oynatıcı)",
    shortTitle: "Ses Kayıtları",
    menuPath: "Çağrı Raporları & Analiz → Ses Kayıtları",
    pbxRoute: "/?tab=raporlar-ses-kayitlari",
    permissions: ["reports_audio:access"],
    badge: "Rapor 4/44 • RX/TX Split • 2x Hız • WAV",
    readMinutes: 7,
    summary:
      "Asterisk MixMonitor tarafından kaydedilen tüm ses dosyalarını görsel dalga formu, müşteri (RX) ve temsilci (TX) ayrı kanal dinleme, 0.75x–2x oynatma hızı ve güvenli WAV indirme kontrolleriyle sunan kurumsal ses kayıt arşividir.",
    screenshots: [
      { src: "/screenshots/reports/rapor-ses-kayitlari.jpg", caption: "Ses Kayıtları Arşivi — Dalga formu oynatıcı, hız kontrolü, filtreler ve WAV indirme", routeHint: "Çağrı Raporları & Analiz → Ses Kayıtları" }
    ],
    fieldTable: [
      { field: "Dalga Formu (Waveform) & Oynatma Hızı", type: "0.75x / 1x / 1.25x / 1.5x / 2x", defaultVal: "1x + Atlama", required: false, description: "Uzun görüşmeleri 1.5x–2x hızda tarayıp sessizlik veya konuşma zirvelerine tek tıkla atlamanızı sağlar." },
      { field: "Çift Kanal (RX Müşteri / TX Temsilci) İzolasyonu", type: "Stereo Split Kayıt", defaultVal: "Ses Kalitesi Teşhisi", required: false, description: "Yankı, mikrofon düşüklüğü veya karşılıklı konuşma çakışmalarında hangi tarafın sesinin sorunlu olduğunu netleştirir." },
      { field: "WAV İndirme & KVKK Saklama Politikası", type: "Yerel SSD / Harici NAS-SMB-SFTP", defaultVal: "Yetki Kontrollü", required: false, description: "Harici NAS'a taşınan eski kayıtlar dahi bu ekrandan kesintisiz stream edilip dinlenir." }
    ],
    sections: [
      {
        heading: "1. Kalite Denetimi & Hukuki Kayıt Çıkarma",
        body: "İtiraz veya şikayet durumlarında ilgili görüşmenin ses kaydına numara, temsilci veya tarih filtresiyle saniyeler içinde ulaşıp WAV olarak arşivleyebilirsiniz.",
        steps: [
          "Tarih aralığı ve müşteri telefonu veya temsilci dahilisi ile filtreleyin.",
          "Oynat butonuna tıklayıp dalga formu üzerinden kritik saniyeye atlayın.",
          "Gerekirse 'WAV İndir' butonuyla orijinal ses dosyasını bilgisayarınıza kaydedin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Bazı çağrılarda ses kaydı ikonu görünmüyor", cause: "İlgili kullanıcının Ses Kayıt Modu 'Kapalı' veya çağrı cevaplanmadan kapandı.", solution: "Kullanıcılar → Düzenle → Özellikler sekmesinden Ses Kayıt Modunu 'Standart' veya 'Yapay Zeka (AI)' yapın." }
    ],
    relatedPages: ["rapor-cagri-transkripti", "bakim-yedekleme-ve-kayit-saklama", "rapor-cdr"],
    relatedApis: ["GET /api/v1/recordings/{call_id}"]
  },
  {
    id: "rapor-cagri-transkripti",
    number: "37",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Çağrı Transkriptleri (Konuşmacı Ayrımı & Tam Metin Arama)",
    shortTitle: "Çağrı Transkripti",
    menuPath: "Çağrı Raporları & Analiz → Çağrı Transkripti",
    pbxRoute: "/?tab=raporlar-transkript",
    permissions: ["reports_transcripts:access"],
    badge: "Rapor 5/44 • STT • Tam Metin Arama",
    readMinutes: 7,
    summary:
      "Yapay zeka STT motoru (Gemini / Deepgram / Whisper / Yerel Model) tarafından metne dökülen tüm telefon görüşmelerinde kelime/cümle bazlı tam metin araması yapmanızı, konuşmacı ayrımını (Müşteri / Temsilci / AI) sohbet düzeninde okumanızı ve ilgili saniyeden sesi dinlemenizi sağlar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-cagri-transkripti.jpg", caption: "Çağrı Transkripti — Konuşmacı ayrımlı tam metin dökümü, anahtar kelime arama ve ses senkronizasyonu", routeHint: "Çağrı Raporları & Analiz → Çağrı Transkripti" }
    ],
    fieldTable: [
      { field: "Tam Metin Arama (Full-Text Search)", type: "Kelime / İfade Filtresi", defaultVal: "Anlık Vurgulama", required: false, description: "Örn. 'iptal', 'avukat', 'garanti' veya ürün adı yazarak o kelimenin geçtiği tüm görüşmeleri saniyeler içinde bulur." },
      { field: "Konuşmacı Ayrımı (Diarization)", type: "Müşteri / Temsilci / AI Asistan", defaultVal: "Zaman Damgalı", required: false, description: "Kimin hangi saniyede ne söylediğini sohbet balonu formatında net biçimde ayırır." },
      { field: "Metin Kopyalama & Dışa Aktarım", type: "Kopyala / CSV", defaultVal: "Tek Tık", required: false, description: "Hukuk, kalite veya CRM kayıtlarına eklenecek görüşme dökümünü temiz metin olarak dışa aktarır." }
    ],
    sections: [
      {
        heading: "1. Binlerce Görüşme İçinde Kritik Kelime Yakalama",
        body: "Saatlerce ses kaydı dinlemek yerine tam metin aramasıyla belirli bir kampanya, rakip firma adı veya şikayet sebebinin geçtiği tüm aramaları 2 saniyede tespit edersiniz.",
        steps: [
          "Üst arama çubuğuna aradığınız kelimeyi (örn. 'fatura itirazı') yazın.",
          "Eşleşen görüşme kartına tıklayıp vurgulanan cümleyi okuyun ve isterseniz ilgili ses kaydını oynatın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Görüşmelerin transkripti oluşmuyor", cause: "Kullanıcının Ses Kayıt Modu 'Standart' seçili (AI değil) veya AI API anahtarı tanımlı değil.", solution: "Kullanıcı Özellikleri'nden Ses Kayıt Modunu 'Yapay Zeka (AI)' yapın ve Sistem Ayarları → AI Görev Yönlendirme'de Transkript motorunu doğrulayın." }
    ],
    relatedPages: ["rapor-ses-kayitlari", "rapor-kelime-bulutu", "yapay-zeka-ayar-ve-yonlendirme"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-duygu-analizi",
    number: "38",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Duygu Analizi Raporu (Pozitif / Nötr / Negatif & Kriz Takibi)",
    shortTitle: "Duygu Analizi",
    menuPath: "Çağrı Raporları & Analiz → Duygu Analizi",
    pbxRoute: "/?tab=raporlar-duygu-analizi",
    permissions: ["reports_sentiment:access"],
    badge: "Rapor 6/44 • AI Sentiment",
    readMinutes: 7,
    summary:
      "Tamamlanan tüm sesli görüşmeleri yapay zeka ile analiz ederek Pozitif, Nötr ve Negatif duygu dağılımını temsilci, kuyruk ve zaman bazında raporlar; mutsuz müşterileri tek tıkla filtreleyip geri kazanım (win-back) aksiyonu almanızı sağlar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-duygu-analizi.jpg", caption: "Duygu Analizi — Pozitif/Nötr/Negatif yüzdelik dağılım, temsilci kırılımı ve negatif çağrı inceleme listesi", routeHint: "Çağrı Raporları & Analiz → Duygu Analizi" }
    ],
    fieldTable: [
      { field: "Duygu Dağılım KPI'ları", type: "Pozitif % / Nötr % / Negatif %", defaultVal: "Seçili Dönem", required: false, description: "Müşteri memnuniyet atmosferinin genel nabzını gösterir." },
      { field: "Temsilci & Kuyruk Duygu Karşılaştırması", type: "Kırılım Tablosu", defaultVal: "Sıralanabilir", required: false, description: "Hangi ekipte veya temsilcide negatif görüşme oranının arttığını hızla tespit eder." },
      { field: "Negatif Çağrı Hızlı Filtresi", type: "Ses & Transkript Linkli", defaultVal: "Tek Tık", required: false, description: "Yalnızca öfkeli/memnuniyetsiz görüşmeleri listeleyip yöneticinin anında dinlemesini sağlar." }
    ],
    sections: [
      {
        heading: "1. Proaktif Müşteri Geri Kazanımı",
        body: "Anket doldurmayan ancak görüşme sırasında ses tonu ve ifadeleri negatif olan müşterileri erken yakalayıp kayıp (churn) önleme araması yapabilirsiniz.",
        steps: [
          "Duygu filtresinden 'Negatif' seçeneğine tıklayın.",
          "Listelenen çağrıların AI özetini okuyup acil geri dönüş gereken müşterileri süpervizör ekibine yönlendirin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Duygu grafikleri boş görünüyor", cause: "AI Özet & Duygu motoru için API anahtarı veya yerel Ollama modeli yapılandırılmamış.", solution: "Sistem Ayarları → AI Görev & Model Yönlendirme'de 'Özet & Duygu Analizi' görevini aktif bir modele atayın." }
    ],
    relatedPages: ["rapor-duygu-isi-haritasi", "rapor-musteri-cile-noktalari", "yapay-zeka-ayar-ve-yonlendirme"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-niyet-raporu",
    number: "39",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Müşteri Niyet Raporu (Otomatik Konu & Talep Sınıflandırma)",
    shortTitle: "Niyet Raporu",
    menuPath: "Çağrı Raporları & Analiz → Niyet Raporu",
    pbxRoute: "/?tab=raporlar-niyet",
    permissions: ["reports_intent:access"],
    badge: "Rapor 7/44 • AI Intent • Özel Kurallar",
    readMinutes: 7,
    summary:
      "Müşterilerin şirketinizi neden aradığını (Fiyat/Teklif, Teknik Arıza, Kargo/Sipariş, İade/İptal, Randevu, Fatura vb.) yapay zeka ve özel anahtar kelime kurallarıyla otomatik sınıflandırarak hacim yüzdelerini grafikleştiren stratejik iş zekası raporudur.",
    screenshots: [
      { src: "/screenshots/reports/rapor-niyet-raporu.jpg", caption: "Niyet Raporu — Müşteri arama nedenlerinin yüzdesel dağılımı ve özel niyet kuralı yönetimi", routeHint: "Çağrı Raporları & Analiz → Niyet Raporu" }
    ],
    fieldTable: [
      { field: "Niyet Dağılım Grafiği & Yüzdeleri", type: "Pasta / Bar Grafik", defaultVal: "Otomatik Sınıflandırma", required: false, description: "Çağrı merkezine gelen toplam hacmin hangi iş biriminden kaynaklandığını kanıtlar." },
      { field: "Özel Niyet Kuralı & Anahtar Kelime Tanımlama", type: "Kural Adı + Anahtar Kelimeler", defaultVal: "Özelleştirilebilir", required: false, description: "Kendi sektörünüze özel konular (örn. 'Kombide E01 Hatası', 'Kredi Kartı İade') tanımlayıp otomatik etiketletebilirsiniz." }
    ],
    sections: [
      {
        heading: "1. Çağrı Sebeplerini Azaltmak İçin Kök Neden Analizi",
        body: "Örn. aramaların %38'i 'Kargo Takip' niyetinden geliyorsa CallFlow'a otomatik WhatsApp kargo linki veya AI self-servis ekleyerek insan iş yükünü anında düşürebilirsiniz.",
        steps: [
          "En yüksek hacimli ilk 3 niyet kategorisini belirleyin.",
          "Bu konuları AI Temsilcileri veya Bilgi Bankası (RAG) kapsamına alarak otomasyon oranınızı artırın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Aramaların çoğu 'Diğer / Genel' kategorisinde toplanıyor", cause: "Sektörünüze özel niyet kuralları ve anahtar kelimeler henüz eklenmemiş.", solution: "Niyet Raporu üstündeki özel niyet tanımlarından şirketinize özgü başlık ve anahtar kelimeleri ekleyin." }
    ],
    relatedPages: ["rapor-kelime-bulutu", "rapor-musteri-cile-noktalari", "bilgi-bankasi-rag"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-kalite-degerlendirmeleri",
    number: "40",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Kalite Değerlendirmeleri — Otomatik AI QA Puan Kartları",
    shortTitle: "Kalite Değerlendirmeleri",
    menuPath: "Çağrı Raporları & Analiz → Kalite Değerlendirmeleri",
    pbxRoute: "/?tab=raporlar-qa",
    permissions: ["reports_qa:access"],
    badge: "Rapor 8/44 • 0–100 AI QA • Koçluk",
    readMinutes: 8,
    summary:
      "Geleneksel çağrı merkezlerinde sadece %1–2 oranında yapılabilen kalite denetimini tüm görüşmelerin %100'üne yayan otomatik AI QA raporudur. Her görüşmeyi tanımladığınız soru havuzuna göre 0–100 arası puanlar, eksik kriterleri ve temsilciye özel koçluk önerilerini sunar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-kalite-degerlendirmeleri.jpg", caption: "Kalite Değerlendirmeleri (QA) — Ortalama kalite puanı, temsilci sıralaması ve kriter bazlı puan kartları", routeHint: "Çağrı Raporları & Analiz → Kalite Değerlendirmeleri" }
    ],
    fieldTable: [
      { field: "Genel & Temsilci Bazlı QA Ortalaması", type: "0–100 Puan", defaultVal: "Ağırlıklı Kriter", required: false, description: "Her temsilcinin selamlama, KVKK, doğru bilgilendirme ve kapanış standartlarına uyumunu objektif puanlar." },
      { field: "Kriter Bazlı Geçti / Kaldı Detayı", type: "Soru Seti Matrisi", defaultVal: "Sistem Ayarları → QA", required: false, description: "Ekibin en çok hangi kuralda (örn. KVKK aydınlatması veya çapraz satış) puan kaybettiğini gösterir." },
      { field: "AI Koçluk & Gelişim Notu", type: "Otomatik Öneri", defaultVal: "Çağrı Bazlı", required: false, description: "Takım liderinin birebir geri bildirim toplantılarında doğrudan kullanabileceği somut öneriler üretir." }
    ],
    sections: [
      {
        heading: "1. %100 Otomatik Kalite Denetimi Nasıl Çalışır?",
        body: "Sistem Ayarları → Çağrı Kalite Kontrol ekranında belirlediğiniz sorular ve puan ağırlıkları (toplam 100) her tamamlanan görüşmenin transkripti üzerinde AI tarafından değerlendirilir.",
        steps: [
          "Düşük QA puanı (<70) alan görüşmeleri filtreleyin.",
          "Satırdaki QA Puan Kartı popup'ını açıp eksik kalan maddeleri ve ilgili konuşma satırını inceleyin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "QA puanları üretilmiyor", cause: "Çağrı Kalite Kontrol kriter havuzu boş veya AI QA görevi devre dışı.", solution: "Sistem Ayarları → Çağrı Kalite Kontrol ekranından kriterleri tanımlayın ve AI Görev Yönlendirme'de QA modelini doğrulayın." }
    ],
    relatedPages: ["rapor-senaryo-sadakati", "rapor-temsilci-performans", "yapay-zeka-ayar-ve-yonlendirme"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-temsilci-notlari",
    number: "41",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Temsilci Notları & ACW Görüşme Özeti Raporu",
    shortTitle: "Temsilci Notları",
    menuPath: "Çağrı Raporları & Analiz → Temsilci Notları",
    pbxRoute: "/?tab=raporlar-notlar",
    permissions: ["reports_notes:access"],
    badge: "Rapor 9/44 • ACW • AI Notlar",
    readMinutes: 6,
    summary:
      "Temsilcilerin görüşme esnasında veya ACW (Çağrı Sonrası İşlem) aşamasında kaydettiği manuel notlar ile AI Not Asistanının ürettiği yapısal özetleri ve sonuç kodlarını tek listede arayıp dışa aktarmanızı sağlar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-temsilci-notlari.jpg", caption: "Temsilci Notları — Görüşme notları, sonuç kodu, müşteri numarası ve dışa aktarım", routeHint: "Çağrı Raporları & Analiz → Temsilci Notları" }
    ],
    fieldTable: [
      { field: "Temsilci, Tarih & Metin Arama Filtresi", type: "Tam Metin", defaultVal: "Kronolojik", required: false, description: "Örn. 'teklif gönderildi' veya belirli bir sipariş numarasının geçtiği tüm temsilci notlarını anında bulur." },
      { field: "Sonuç Kodu (Disposition) & Ses Kaydı Bağlantısı", type: "Etiket + Oynat", defaultVal: "CDR İlişkili", required: false, description: "Notun girildiği asıl telefon görüşmesine ve ses kaydına doğrudan geçiş imkanı verir." }
    ],
    sections: [
      {
        heading: "1. Vardiya Devri ve CRM Senkron Takibi",
        body: "Gün sonu açık kalan talepleri, geri arama sözü verilen müşterileri ve satış fırsatlarını tek ekrandan gözden geçirip Excel'e aktarabilirsiniz.",
        steps: [
          "İlgili temsilci veya tarih aralığını seçin.",
          "Kritik notları gözden geçirin veya CSV/Excel olarak dışa aktarın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Not listesi boş görünüyor", cause: "Temsilciler WebPhone görüşme sonrasında ACW not kutusuna kayıt girmemiş.", solution: "Kuyruk ayarlarından ACW süresini (örn. 10 sn) aktif edip temsilcilerin not ve sonuç kodu girmesini teşvik edin." }
    ],
    relatedPages: ["temsilci-cagri-paneli", "rapor-sonuc-kodlari", "rapor-cdr"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-temsilci-performans",
    number: "42",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Temsilci Performans & KPI Raporu (AHT, ACW, FCR & QA Karnesi)",
    shortTitle: "Temsilci Performans & KPI",
    menuPath: "Çağrı Raporları & Analiz → Temsilci Performans & KPI",
    pbxRoute: "/?tab=raporlar-performans",
    permissions: ["reports_perf:access"],
    badge: "Rapor 10/44 • AHT • Prim Karnesi",
    readMinutes: 8,
    summary:
      "Her bir temsilcinin gelen, giden, dahili ve kaçırdığı çağrı adetlerini, toplam ve ortalama konuşma süresini (AHT), ACW süresini, ilk aramada çözüm (FCR) ve ortalama QA puanını yan yana karşılaştıran kurumsal performans ve prim karnesidir.",
    screenshots: [
      { src: "/screenshots/reports/rapor-temsilci-performans.jpg", caption: "Temsilci Performans & KPI — Temsilci bazlı gelen/giden/kaçan çağrı, AHT, QA ve karşılaştırma tablosu", routeHint: "Çağrı Raporları & Analiz → Temsilci Performans & KPI" }
    ],
    fieldTable: [
      { field: "Gelen / Giden / Cevapsız / Toplam Çağrı", type: "Adet", defaultVal: "Dönem Bazlı", required: false, description: "Temsilcinin iş yükünü ve çağrı karşılama disiplinini ölçer." },
      { field: "Ortalama Konuşma Süresi (AHT) & Toplam Konuşma", type: "dk:sn", defaultVal: "Konuşulan Çağrılar", required: false, description: "Verimlilik karşılaştırması için ortalama görüşme süresini hesaplar." },
      { field: "Ortalama QA Puanı & Duygu Dengesi", type: "0–100 + % Pozitif", defaultVal: "AI Entegreli", required: false, description: "Sadece hızı değil kaliteyi de dengeleyerek adil prim değerlendirmesi sağlar." }
    ],
    sections: [
      {
        heading: "1. Adil Prim ve Eğitim İhtiyacı Tespiti",
        body: "Çok hızlı konuşup (düşük AHT) ama düşük QA/FCR puanı alan temsilcilerle, yüksek memnuniyet sağlayan en iyi örnekleri kolayca ayırt edersiniz.",
        steps: [
          "Ay sonu dönemini seçip tabloyu Cevaplanan Çağrı veya QA Puanına göre sıralayın.",
          "Excel çıktısı alarak İK/prim hesaplama tablosuna doğrudan aktarın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Bir temsilci tabloda görünmüyor", cause: "Seçilen tarih aralığında bu dahili üzerinden hiç çağrı gerçekleşmemiş veya Süpervizör kapsam filtresi dışında.", solution: "Tarih aralığını kontrol edin ve yöneticinizin Rapor & Yönetim Filtresi kapsamını doğrulayın." }
    ],
    relatedPages: ["rapor-temsilci-kronolojisi", "rapor-mola-puantaj", "rapor-kalite-degerlendirmeleri"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-kuyruk-bekleme",
    number: "43",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Kuyruk / Bekleme Analitiği Raporu",
    shortTitle: "Kuyruk / Bekleme Analitiği",
    menuPath: "Çağrı Raporları & Analiz → Kuyruk / Bekleme Analitiği",
    pbxRoute: "/?tab=raporlar-kuyruk",
    permissions: ["reports_queue:access"],
    badge: "Rapor 11/44 • ACD • Terk & Bekleme",
    readMinutes: 7,
    summary:
      "Her ACD çağrı kuyruğuna (Satış, Destek, Finans vb.) giren toplam çağrı sayısını, cevaplanan ve terk edilen (abandoned) oranlarını, ortalama bekleme süresini (ASA) ve en uzun bekleme zirvesini raporlar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-kuyruk-bekleme.jpg", caption: "Kuyruk / Bekleme Analitiği — Kuyruk bazlı giren, cevaplanan, terk oranı ve ortalama bekleme süreleri", routeHint: "Çağrı Raporları & Analiz → Kuyruk / Bekleme Analitiği" }
    ],
    fieldTable: [
      { field: "Kuyruğa Giren / Cevaplanan / Terk Edilen (Abandoned)", type: "Adet & %", defaultVal: "Kuyruk Bazlı", required: false, description: "Müşterilerin temsilciye bağlanamadan kapatma oranını gösterir." },
      { field: "Ortalama Bekleme Süresi (ASA) & Maksimum Bekleme", type: "Saniye", defaultVal: "Gerçek Ölçüm", required: false, description: "Kuyrukta bekleme sabır eşiğini ve personel yeterliliğini ortaya koyar." }
    ],
    sections: [
      {
        heading: "1. Kuyruk Darboğazlarını Giderme",
        body: "Terk oranı %5'in üzerine çıkan kuyruklarda Penalty 1 yedek ekip eklemek veya Smart Callback'i açmak müşteri kaybını anında azaltır.",
        steps: [
          "Terk oranı en yüksek kuyruğu belirleyin.",
          "ACD Kuyruk ayarlarından Periyodik Anons, Smart Callback veya Maksimum Bekleme sonrası AI Asistan devrini yapılandırın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Terk sayısı yüksek ama bekleme süresi çok kısa (2–4 sn)", cause: "Müşteriler karşılama anonsunu duyup hemen kapatıyor (kısa terk).", solution: "Kuyruk karşılama anonsunu kısaltın ve Kuyruk SLA Raporu'nda 0–10 sn terk kovasını inceleyin." }
    ],
    relatedPages: ["rapor-kuyruk-sla", "acd-kuyruk", "rapor-kacan-cagri"],
    relatedApis: ["GET /api/v1/queues"]
  },
  {
    id: "rapor-anket-csat",
    number: "44",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Anket Raporları (Çağrı Sonu CSAT / NPS Memnuniyet Analizi)",
    shortTitle: "Anket Raporları",
    menuPath: "Çağrı Raporları & Analiz → Anket Raporları",
    pbxRoute: "/?tab=raporlar-anket",
    permissions: ["reports_survey:access"],
    badge: "Rapor 12/44 • 1–5 CSAT • Ses Linkli",
    readMinutes: 7,
    summary:
      "Görüşme sonunda müşterilerin telefon tuşlarıyla (1–5) yanıtladığı çok sorulu memnuniyet anketlerini (CSAT/NPS) kuyruk, temsilci ve soru bazında ortalamalarıyla raporlar; düşük puan (1–2) veren müşterilerin ses kaydına tek tıkla ulaşmanızı sağlar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-anket-csat.jpg", caption: "Anket Raporları (CSAT) — 1–5 puan dağılımı, soru bazlı ortalama ve temsilci memnuniyet sıralaması", routeHint: "Çağrı Raporları & Analiz → Anket Raporları" }
    ],
    fieldTable: [
      { field: "Genel CSAT Ortalaması & Katılım Oranı", type: "5.00 Üzerinden Puan + %", defaultVal: "Anket Katılımcıları", required: false, description: "Müşteri memnuniyet skorunun zaman içindeki trendini ölçer." },
      { field: "1–5 Yıldız / Puan Dağılımı & Soru Kırılımı", type: "Çok Sorulu Anket Desteği", defaultVal: "Kuyruk Bazlı", required: false, description: "Örn. 'Temsilci nezaketi' ile 'Çözüm hızı' sorularının puanlarını ayrı ayrı kıyaslar." },
      { field: "Düşük Puan (1–2) Ses Kaydı & Geri Arama Listesi", type: "Doğrudan Dinleme", defaultVal: "Kırmızı Vurgu", required: false, description: "1 veya 2 puan veren müşterinin görüşmesini hemen dinleyip telafi araması yapmanızı sağlar." }
    ],
    sections: [
      {
        heading: "1. Düşük Memnuniyet Puanlarını Fırsata Çevirme",
        body: "1–2 puan alan her çağrıyı aynı gün içinde ekip liderinin dinleyip müşteriyi geri araması marka sadakatini katlar.",
        steps: [
          "Puan filtresini '1–2 Puan (Düşük)' olarak seçin.",
          "Satırdaki ses kaydı ve transkripti inceleyip müşteriye geri dönüş yapın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Anket sonuçları gelmiyor", cause: "İlgili ACD Kuyrukta 'Memnuniyet Anketi' aktif edilmemiş.", solution: "Santral → ACD Kuyruk → Düzenle → Sekme 11: Memnuniyet Anketi'ni aktif edip sorularınızı kaydedin." }
    ],
    relatedPages: ["acd-kuyruk", "rapor-duygu-analizi", "rapor-temsilci-performans"],
    relatedApis: ["GET /api/v1/queues"]
  },
  {
    id: "rapor-duygu-isi-haritasi",
    number: "45",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Duygu Durumu Isı Haritası (Gün × Saat Memnuniyet Matrisi)",
    shortTitle: "Duygu Isı Haritası",
    menuPath: "Çağrı Raporları & Analiz → Duygu Durumu Isı Haritası",
    pbxRoute: "/?tab=raporlar-duygu-isi-haritasi",
    permissions: ["reports_sentiment_heat:access"],
    badge: "Rapor 13/44 • Gün × Saat Matris",
    readMinutes: 6,
    summary:
      "Haftanın günleri (Pazartesi–Pazar) ve günün saatleri (00:00–23:00) ekseninde müşteri duygu skorunu renkli ısı haritası (yeşil→sarı→kırmızı) olarak görselleştirir; gerilimin hangi vardiya dilimlerinde arttığını tek bakışta gösterir.",
    screenshots: [
      { src: "/screenshots/reports/rapor-duygu-isi-haritasi.jpg", caption: "Duygu Durumu Isı Haritası — Gün ve saat kırılımlı renkli memnuniyet matrisi", routeHint: "Çağrı Raporları & Analiz → Duygu Durumu Isı Haritası" }
    ],
    fieldTable: [
      { field: "7×24 Renkli Isı Matrisi", type: "Yeşil (Pozitif) / Sarı (Nötr) / Kırmızı (Negatif)", defaultVal: "Seçili Tarih Aralığı", required: false, description: "Örn. Pazartesi 09:00–11:00 veya Cuma 16:00–18:00 arasındaki yoğunluk kaynaklı gerginlik odaklarını ortaya çıkarır." },
      { field: "Hücre Detay Tooltip'i", type: "Çağrı Adedi + Oran", defaultVal: "Hover", required: false, description: "İlgili gün/saat dilimindeki toplam çağrı ve negatif yüzdesini gösterir." }
    ],
    sections: [
      {
        heading: "1. Vardiya ve Kıdemli Temsilci Planlaması",
        body: "Kırmızı yoğunlaşan gün/saat dilimlerine daha deneyimli temsilci veya ek kuyruk kapasitesi yerleştirerek şikayet dalgalarını önleyebilirsiniz.",
        steps: [
          "Son 30 günlük ısı haritasını açıp koyu kırmızı hücreleri belirleyin.",
          "Mola & Puantaj Raporu'ndaki WFM vardiya planını bu yoğun saatlere göre güçlendirin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Matriste bazı saat dilimleri gri görünüyor", cause: "O saat aralığında AI analizli görüşme gerçekleşmemiş (mesai dışı).", solution: "Mesai saatlerindeki (08:00–19:00) hücreleri baz alın." }
    ],
    relatedPages: ["rapor-duygu-analizi", "rapor-yogunluk", "rapor-mola-puantaj"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-kelime-bulutu",
    number: "46",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Kelime Bulutu & Trendler (Konuşma Sıklık Analizi)",
    shortTitle: "Kelime Bulutu & Trendler",
    menuPath: "Çağrı Raporları & Analiz → Kelime Bulutu & Trendler",
    pbxRoute: "/?tab=raporlar-kelime-bulutu",
    permissions: ["reports_wordcloud:access"],
    badge: "Rapor 14/44 • Türkçe NLP • Tıkla-Filtrele",
    readMinutes: 6,
    summary:
      "Tüm çağrı transkriptlerinden Türkçe bağlaç/dolgu kelimelerini (stop-words) temizleyerek müşterilerin en sık telaffuz ettiği ürün, arıza, kampanya ve şikayet kelimelerini etkileşimli kelime bulutu halinde sunar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-kelime-bulutu.jpg", caption: "Kelime Bulutu & Trendler — En sık geçen müşteri ifadeleri ve tek tıkla ilgili çağrıları süzme", routeHint: "Çağrı Raporları & Analiz → Kelime Bulutu & Trendler" }
    ],
    fieldTable: [
      { field: "Etkileşimli Kelime Bulutu", type: "Frekans Boyutlu Etiketler", defaultVal: "Türkçe Stop-Word Temizli", required: false, description: "Büyük puntolu kelimeler müşterilerin o dönemde en çok gündeme getirdiği konuları gösterir." },
      { field: "Tıkla-Filtrele (Drill-Down)", type: "Anlık Çağrı Listesi", defaultVal: "Tek Tık", required: false, description: "Herhangi bir kelimeye tıkladığınızda yalnızca o kelimenin geçtiği çağrıları ve dökümleri aşağıda listeler." }
    ],
    sections: [
      {
        heading: "1. Ani Kriz ve Ürün Hatası Erken Tespiti",
        body: "Yeni bir ürün güncellemesi veya kargo aksaklığı sonrası bir kelimenin (örn. 'şifre', 'kırık', 'gecikme') aniden büyümesiyle sorunu rapor beklemeden saatler içinde fark edersiniz.",
        steps: [
          "Dönemi 'Son 7 Gün' yapın ve öne çıkan yeni kelimelere tıklayın.",
          "Eşleşen görüşmeleri inceleyip ilgili departmana anında geri bildirim verin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Kelime bulutu boş görünüyor", cause: "Seçilen tarih aralığında metne dökülmüş (transkriptli) çağrı kaydı bulunmuyor.", solution: "AI ses kaydı/transkript akışının aktif olduğunu doğrulayın." }
    ],
    relatedPages: ["rapor-cagri-transkripti", "rapor-niyet-raporu", "rapor-musteri-cile-noktalari"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-fcr",
    number: "47",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "İlk Aramada Çözüm — FCR (First Call Resolution) Raporu",
    shortTitle: "İlk Aramada Çözüm (FCR)",
    menuPath: "Çağrı Raporları & Analiz → İlk Aramada Çözüm (FCR)",
    pbxRoute: "/?tab=raporlar-fcr",
    permissions: ["reports_fcr:access"],
    badge: "Rapor 15/44 • 24/48/72s Pencere • FCR %",
    readMinutes: 7,
    summary:
      "Bir müşterinin aradıktan sonraki 24, 48 veya 72 saat içinde aynı numaradan tekrar arayıp aramadığını otomatik analiz ederek çağrı merkezinin gerçek 'İlk Aramada Çözüm (FCR %)' başarısını temsilci ve kuyruk bazında hesaplar.",
    screenshots: [
      { src: "/screenshots/reports/rapor-fcr.jpg", caption: "İlk Aramada Çözüm (FCR) — FCR yüzdesi, tekrar arama penceresi ve ekip karşılaştırması", routeHint: "Çağrı Raporları & Analiz → İlk Aramada Çözüm (FCR)" }
    ],
    fieldTable: [
      { field: "FCR Oranı (%) Formülü", type: "(İlk Aramada Çözülen / Toplam Tekil Müşteri) × 100", defaultVal: "Hedef > %80", required: false, description: "Yüksek FCR hem müşteri memnuniyetini artırır hem tekrar eden gereksiz çağrı maliyetini düşürür." },
      { field: "Tekrar Arama Zaman Penceresi", type: "24 Saat / 48 Saat / 72 Saat / 7 Gün", defaultVal: "48 Saat", required: false, description: "Sektörünüze göre (örn. teknik destek 72 saat, kargo 24 saat) pencereyi özelleştirir." }
    ],
    sections: [
      {
        heading: "1. Düşük FCR'nin Kök Nedenini Bulma",
        body: "Çok kısa konuşup telefonu kapatan ama müşterisi 2 saat sonra tekrar arayan temsilcileri tespit ederek eğitim ve Bilgi Bankası güncellemelerini hedeflersiniz.",
        steps: [
          "FCR oranı düşük olan kuyruk veya temsilciyi seçin.",
          "'Tekrar Eden Arayanlar' raporuyla birlikte inceleyip çözülemeyen ortak konuları belirleyin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "FCR oranı beklenenden düşük çıkıyor", cause: "Tekrar arama penceresi çok geniş (7 gün) veya aynı bayiler/tedarikçiler gün içinde farklı siparişler için düzenli arıyor.", solution: "Pencereyi 24–48 saat seçerek gerçek destek/çözüm tekrarlarını izole edin." }
    ],
    relatedPages: ["rapor-tekrar-arayanlar", "rapor-temsilci-performans", "rapor-kuyruk-sla"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-ai-insan-roi",
    number: "48",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "AI vs. İnsan Maliyet & Tasarruf (ROI) Paneli",
    shortTitle: "AI vs. İnsan ROI Paneli",
    menuPath: "Çağrı Raporları & Analiz → AI vs. İnsan ROI Paneli",
    pbxRoute: "/?tab=raporlar-roi",
    permissions: ["reports_roi:access"],
    badge: "Rapor 16/44 • Finansal Tasarruf • ROI",
    readMinutes: 7,
    summary:
      "Yapay zeka sesli asistanların ve yazılı omnichannel AI'ın insan temsilciye devretmeden otonom çözdüğü çağrı ve sohbetlerin şirkete sağladığı net TL / USD tasarrufunu, amortisman süresini ve temsilci iş yükü kazancını hesaplayan finansal yönetim raporudur.",
    screenshots: [
      { src: "/screenshots/reports/rapor-ai-insan-roi.jpg", caption: "AI vs. İnsan ROI Paneli — Otonom çözüm adedi, kurtarılan temsilci saati ve net finansal tasarruf", routeHint: "Çağrı Raporları & Analiz → AI vs. İnsan ROI Paneli" }
    ],
    fieldTable: [
      { field: "AI Otonom Çözüm Adedi & Kurtarılan Çalışma Saati", type: "Adet + Saat", defaultVal: "Gerçek Süre", required: false, description: "AI'ın insana devretmeden tamamladığı görüşmelerin kaç tam zamanlı temsilciye (FTE) denk geldiğini hesaplar." },
      { field: "İnsan Çağrı Maliyeti vs. AI Token Maliyeti (Net Tasarruf)", type: "TL / USD", defaultVal: "ROI Ayarlarına Göre", required: false, description: "Sistem Ayarları → ROI Rapor Ayarları'nda girdiğiniz saatlik/aylık temsilci maliyetini baz alarak net kârı çıkarır." }
    ],
    sections: [
      {
        heading: "1. Üst Yönetim İçin Yatırım Geri Dönüşü (ROI) Raporlama",
        body: "AI yatırımının maliyetini ne kadar sürede çıkardığını gerçek santral verileriyle kanıtlar.",
        steps: [
          "Önce Sistem Ayarları → ROI Rapor Ayarları'ndan kurumunuzun ortalama temsilci maliyetini girin.",
          "Bu ekrandan aylık/yıllık tasarruf özetini CEO Özet Raporu ile birlikte yönetime sunun."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Tasarruf tutarı $0 veya düşük görünüyor", cause: "ROI Rapor Ayarları'nda baz temsilci maliyeti tanımlanmamış veya henüz AI çağrısı alınmamış.", solution: "Sistem Ayarları → Yapay Zeka & Analiz → ROI Rapor Ayarları'ndan birim maliyetleri kaydedin." }
    ],
    relatedPages: ["rapor-ceo-ozeti", "rapor-verimlilik-ab", "api-butce-ve-tuketim"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-kacan-cagri",
    number: "49",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Kaçan Çağrı Analizi (Cevapsız & Geri Arama Takibi)",
    shortTitle: "Kaçan Çağrı Analizi",
    menuPath: "Çağrı Raporları & Analiz → Kaçan Çağrı Analizi",
    pbxRoute: "/?tab=raporlar-kacan-cagri",
    permissions: ["reports_missed:access"],
    badge: "Rapor 17/44 • Claim • Geri Dönüş",
    readMinutes: 7,
    summary:
      "Cevapsız kalan veya kuyrukta terk edilen tüm çağrıları, müşterinin daha sonra geri aranıp aranmadığı (Geri Arandı / Bekliyor) ve hangi temsilcinin sahiplendiği (Claim) bilgisiyle birlikte raporlar; sıfır müşteri kaybı hedefini takip eder.",
    screenshots: [
      { src: "/screenshots/reports/rapor-kacan-cagri.jpg", caption: "Kaçan Çağrı Analizi — Cevapsız çağrılar, geri dönüş durumu, sahiplenen temsilci ve bekleyen liste", routeHint: "Çağrı Raporları & Analiz → Kaçan Çağrı Analizi" }
    ],
    fieldTable: [
      { field: "Toplam Kaçan / Geri Aranan / Henüz Dönülmeyen", type: "Adet & %", defaultVal: "Otomatik Eşleşme", required: false, description: "Bir numara sonradan dış aramayla arandıysa veya müşteri tekrar bağlandıysa otomatik 'Geri Arandı' işaretlenir." },
      { field: "Sahiplenen Temsilci (Claim) & Tek Tık Geri Arama", type: "missed_claims Entegreli", defaultVal: "Temsilci Paneli Senkron", required: false, description: "Henüz dönülmemiş kaçan çağrıları kırmızı öncelikle en üstte gösterir." }
    ],
    sections: [
      {
        heading: "1. Kaçan Satış Fırsatlarını Kurtarma",
        body: "Özellikle yoğun saatlerde veya öğle arasında kaçan müşterilere 15 dakika içinde dönüş yapılıp yapılmadığını denetler.",
        steps: [
          "Durum filtresini 'Henüz Geri Aranmadı' olarak seçin.",
          "Ekip lideri olarak açık kalan numaraları temsilcilere paylaştırın veya WhatsApp cevapsız çağrı otomatik yanıtlayıcısını aktif edin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Geri aranan müşteri hala 'Bekliyor' görünüyor", cause: "Temsilci müşteriyi farklı bir cep telefonundan (santral dışı) aramış.", solution: "Geri aramaların santral üzerinden yapılmasını sağlayın veya Çağrı Paneli → Kayıp Çağrı sekmesinden manuel 'Tamamlandı' işaretleyin." }
    ],
    relatedPages: ["temsilci-cagri-paneli", "rapor-kuyruk-bekleme", "rapor-kampanya-geri-arama"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-temsilci-kronolojisi",
    number: "50",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Temsilci Kronolojisi (Saniye Hassasiyetli Gantt Zaman Çizelgesi)",
    shortTitle: "Temsilci Kronolojisi",
    menuPath: "Çağrı Raporları & Analiz → Temsilci Kronolojisi",
    pbxRoute: "/?tab=raporlar-temsilci-kronolojisi",
    permissions: ["reports_agent_status_timeline:access"],
    badge: "Rapor 18/44 • Gantt Şeridi • Detay Popup",
    readMinutes: 7,
    summary:
      "Her temsilcinin gün boyu (00:00–23:59) hangi saniyede sisteme giriş yaptığını, ne kadar Müsait kaldığını, hangi dakikalarda görüşmede, Yemek/İhtiyaç molasında, RONA'da veya Çevrimdışı olduğunu renkli Gantt zaman çizelgesi olarak görselleştirir.",
    screenshots: [
      { src: "/screenshots/reports/rapor-temsilci-kronolojisi.jpg", caption: "Temsilci Kronolojisi — Renkli gün içi Gantt zaman çizelgesi ve saniye bazlı durum değişimi takibi", routeHint: "Çağrı Raporları & Analiz → Temsilci Kronolojisi" }
    ],
    fieldTable: [
      { field: "Renkli Gün İçi Gantt Şeridi", type: "Yeşil (Müsait) / Mavi (Görüşme) / Turuncu (Mola) / Gri (Çevrimdışı)", defaultVal: "Tarih Seçimli", required: false, description: "Tüm ekibin çalışma disiplinini ve vardiya boşluklarını tek bakışta görmenizi sağlar." },
      { field: "Satır Tıklama — Saniye Bazlı Olay Detay Popup'ı", type: "Çoklu Durum Filtreli Modal", defaultVal: "agent_break_logs", required: false, description: "Bir temsilciye tıklandığında o günkü tüm durum geçişlerini (başlangıç, bitiş, süre, kaynak) filtreli tabloda açar." }
    ],
    sections: [
      {
        heading: "1. Vardiya Uyumunu ve Kısa Kopmaları Denetleme",
        body: "Temsilcilerin sabah geç giriş, öğle molası aşımı veya sık sık kısa süreli çevrimdışı olma alışkanlıklarını net biçimde ortaya çıkarır.",
        steps: [
          "İncelemek istediğiniz günü seçin.",
          "Detayını görmek istediğiniz temsilcinin Gantt şeridine tıklayıp saniye bazlı olay dökümünü açın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Temsilci gece 23:59'a kadar Müsait görünüyor", cause: "Temsilci akşam çıkış (Logout) yapmadan tarayıcıyı açık bırakmış.", solution: "ACD Kuyruk → Otomatik Logout veya Kullanıcı Güvenlik → Hareketsizlikte Otomatik Oturum Kapatma ayarını aktif edin." }
    ],
    relatedPages: ["rapor-mola-puantaj", "rapor-temsilci-performans", "canli-izleme-paneli"],
    relatedApis: ["GET /api/agent/stats"]
  },
  {
    id: "rapor-yogunluk",
    number: "51",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Saatlik & Günlük Yoğunluk Raporu (Trafik Pik Analizi)",
    shortTitle: "Yoğunluk Raporu",
    menuPath: "Çağrı Raporları & Analiz → Yoğunluk Raporu",
    pbxRoute: "/?tab=raporlar-yogunluk",
    permissions: ["reports_traffic_load:access"],
    badge: "Rapor 19/44 • 00:00–23:59 • WFM",
    readMinutes: 6,
    summary:
      "Çağrı trafiğinin günün hangi saatlerinde ve haftanın hangi günlerinde zirve (peak) yaptığını gelen/giden/cevapsız kırılımıyla grafikleştiren iş gücü planlama (WFM) raporudur.",
    screenshots: [
      { src: "/screenshots/reports/rapor-yogunluk.jpg", caption: "Yoğunluk Raporu — Saatlik ve haftalık çağrı yoğunluğu grafiği ve pik saat tespiti", routeHint: "Çağrı Raporları & Analiz → Yoğunluk Raporu" }
    ],
    fieldTable: [
      { field: "Saatlik Trafik Dağılımı (00:00–23:59)", type: "Çubuk / Alan Grafiği", defaultVal: "24 Saatlik Dilim", required: false, description: "En yoğun çağrı saatlerini (örn. 10:00–12:00 ve 14:00–16:00) net olarak gösterir." },
      { field: "Haftanın Günleri Karşılaştırması", type: "Pzt–Paz", defaultVal: "Dönem Toplamı", required: false, description: "Pazartesi yoğunluğu veya hafta sonu mesai dışı çağrı talebini kanıtlar." }
    ],
    sections: [
      {
        heading: "1. Yemek Molası ve Vardiya Saatlerini Optimize Etme",
        body: "Çağrı zirvesinin 11:00–12:00 arasında olduğu bir firmada yemek molalarını 12:30–14:00 arasına kaydırarak kaçan çağrıları %40 azaltabilirsiniz.",
        steps: [
          "Son 30 günün saatlik yoğunluk grafiğini inceleyin.",
          "En yüksek cevapsız oranının görüldüğü saatlerde eşzamanlı mola limitini (ACD Kuyruk → Maks. Eşzamanlı Mola) daraltın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Saatler 3 saat kayık görünüyor", cause: "Sunucu saat dilimi UTC kalmış.", solution: "Sistem Ayarları → Tarih, Saat & Bölge Ayarları'ndan Europe/Istanbul (GMT+3) seçin." }
    ],
    relatedPages: ["rapor-hat-kapasite", "rapor-mola-puantaj", "rapor-kuyruk-sla"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-hat-kapasite",
    number: "52",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Hat Kapasite Raporu (Eşzamanlı Kanal Zirvesi — Peak Channels)",
    shortTitle: "Hat Kapasite Raporu",
    menuPath: "Çağrı Raporları & Analiz → Hat Kapasite Raporu",
    pbxRoute: "/?tab=raporlar-hat-kapasite",
    permissions: ["reports_trunk:access"],
    badge: "Rapor 20/44 • Eşzamanlı Kanal • Trunk",
    readMinutes: 6,
    summary:
      "Operatör SIP Trunk hatlarınızda gün içinde ulaşılan maksimum eşzamanlı çağrı kanalı zirvesini (Peak Concurrent Calls), ortalama doluluk oranını ve kanal yetersizliği nedeniyle meşgule düşme riskini ölçer.",
    screenshots: [
      { src: "/screenshots/reports/rapor-hat-kapasite.jpg", caption: "Hat Kapasite Raporu — Trunk bazlı eşzamanlı kanal zirvesi ve kapasite kullanım grafiği", routeHint: "Çağrı Raporları & Analiz → Hat Kapasite Raporu" }
    ],
    fieldTable: [
      { field: "Maksimum Eşzamanlı Kanal (Peak) & Tanımlı Kapasite", type: "Kanal Adedi & %", defaultVal: "Trunk Bazlı", required: false, description: "30 kanallı bir SIP Trunk'ta zirve 28'e ulaştıysa yeni kanal paketi veya yedek Trunk gereksinimini erken bildirir." },
      { field: "Kanal Doluluk Tarih/Saat Damgası", type: "Zirve Anı", defaultVal: "Saniye Bazlı", required: false, description: "En yüksek eşzamanlı çağrının tam hangi gün ve saatte yaşandığını gösterir." }
    ],
    sections: [
      {
        heading: "1. Gereksiz Kanal Maliyetini veya Hat Tıkanmasını Önleme",
        body: "Operatöre 60 kanal parası öderken zirveniz 12 kanalı geçmiyorsa tasarruf edebilir; aksine 29/30 doluyorsa müşteriler meşgul tonu duymadan kapasite artırabilirsiniz.",
        steps: [
          "Dış Hat Tanımı → Gelişmiş sekmesinden her Trunk'ın sözleşmeli Maksimum Eşzamanlı Çağrı limitini girin.",
          "Bu rapordan aylık zirve doluluk yüzdesini takip edin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Kapasite %100'ü aşıyor gibi görünüyor", cause: "Dış Hat ayarındaki kanal limiti operatör sözleşmesindeki gerçek rakamdan küçük girilmiş.", solution: "Dış Hat Tanımı → Düzenle → Gelişmiş sekmesinde Maks. Eşzamanlı Çağrı değerini güncelleyin." }
    ],
    relatedPages: ["dis-hat-tanimi", "rapor-operator-dakika", "rapor-yogunluk"],
    relatedApis: ["GET /api/v1/trunks"]
  },
  {
    id: "rapor-did",
    number: "53",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "DID Numara Bazlı Rapor (0850 / 0212 / 444 Hat Performansı)",
    shortTitle: "DID Raporu",
    menuPath: "Çağrı Raporları & Analiz → DID Raporu",
    pbxRoute: "/?tab=raporlar-did",
    permissions: ["reports_did:access"],
    badge: "Rapor 21/44 • Hat Kırılımı • Pazarlama",
    readMinutes: 6,
    summary:
      "Şirketinizin sahip olduğu her bir dış telefon numarasına (0850, 0212, 0312, 444 veya kampanya hatları) gelen çağrı hacmini, cevaplama oranını, kaçan çağrı adedini ve ortalama konuşma süresini numara bazında karşılaştırır.",
    screenshots: [
      { src: "/screenshots/reports/rapor-did.jpg", caption: "DID Raporu — Her şirket hattının gelen çağrı adedi, cevaplama oranı ve kaçan çağrı kıyaslaması", routeHint: "Çağrı Raporları & Analiz → DID Raporu" }
    ],
    fieldTable: [
      { field: "Aranan DID Numarası & Kural Açıklaması", type: "E.164 / 0850 / Coğrafi", defaultVal: "Gelen Kural Eşleşmeli", required: false, description: "Farklı şubeler, markalar veya reklam kampanyaları için ayrılan numaraları ayrı satırlarda ölçer." },
      { field: "Gelen / Cevaplanan / Cevapsız / Cevaplama % / Ort. Süre", type: "KPI Satırı", defaultVal: "Excel Dışa Aktar", required: false, description: "Hangi reklam kanalının veya şube hattının en çok arama ürettiğini kanıtlar." }
    ],
    sections: [
      {
        heading: "1. Reklam ve Şube Hattı Verimliliği Ölçümü",
        body: "Google Ads, Instagram ve web sitesi için farklı 0850 numaraları tanımlayıp hangi mecradan kaç gerçek müşteri araması geldiğini kuruşu kuruşuna ölçebilirsiniz.",
        steps: [
          "Gelen Arama Kuralı'nda her DID numarasına açıklayıcı bir etiket verin.",
          "Ay sonunda DID Raporundan kampanya bazlı çağrı dönüşümünü dışa aktarın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Tüm çağrılar tek bir ana DID altında görünüyor", cause: "Operatör tüm numaraları aynı SIP To başlığıyla gönderiyor veya ek DID'ler tanımlanmamış.", solution: "Dış Hat Tanımı → SIP Başlıkları sekmesinden Aranan Numara kaynağını (To / Request-URI / P-Called-Party-ID) doğrulayın." }
    ],
    relatedPages: ["gelen-arama-kurali", "dis-hat-tanimi", "rapor-cdr"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "rapor-operator-dakika",
    number: "54",
    groupId: "raporlar",
    category: "Çağrı Raporları & Analiz",
    title: "Operatör Dakika & Paket Tüketim Raporu",
    shortTitle: "Operatör Dakika & Paket",
    menuPath: "Çağrı Raporları & Analiz → Operatör Dakika & Paket",
    pbxRoute: "/?tab=raporlar-operator-dakika",
    permissions: ["reports_trunk_minutes:access"],
    badge: "Rapor 22/44 • Fatura Dönemi • Kota",
    readMinutes: 6,
    summary:
      "Dış Hat (SIP Trunk) ayarlarında tanımladığınız aylık dakika paketlerinin (örn. 10.000 dk/ay) fatura yenilenme gününe ve ücretlendirme periyoduna (1 sn / 6 sn / 60 sn) göre canlı tüketimini, kalan dakikayı ve ay sonu aşım riskini takip eder.",
    screenshots: [
      { src: "/screenshots/reports/rapor-operator-dakika.jpg", caption: "Operatör Dakika & Paket — Aylık dakika kotası, kullanılan/kalan dakika yüzdesi ve fatura yenilenme günü", routeHint: "Çağrı Raporları & Analiz → Operatör Dakika & Paket" }
    ],
    fieldTable: [
      { field: "Tanımlı Aylık Paket / Kullanılan / Kalan Dakika (%)", type: "İlerleme Çubuğu", defaultVal: "Dış Hat → Dakika Paketi", required: false, description: "Paket %85'e yaklaştığında sürpriz aşım faturası gelmeden önce yedek ekonomik hatta geçiş yapmanızı sağlar." },
      { field: "Ücretlendirme Periyodu (1 sn / 6 sn / 60 sn) & Yenilenme Günü", type: "Operatör Tarifesi", defaultVal: "60 sn", required: false, description: "Operatörünüz 60 saniye periyotla faturalandırıyorsa 12 saniyelik bir aramayı 1 dakika olarak hesaplayarak faturanızla birebir eşleşir." }
    ],
    sections: [
      {
        heading: "1. Fatura Aşımı Olmadan Otomatik Maliyet Kontrolü",
        body: "Birden fazla SIP operatörü kullanan işletmelerde dakika paketi dolan hattan hemen ikinci ekonomik operatöre geçiş için canlı gösterge sunar.",
        steps: [
          "Dış Hat Tanımı → Düzenle → Dakika Paketi sekmesinden paket dakikasını, fatura kesim gününü ve periyodu girin.",
          "Bu ekrandan aylık tüketim hızını takip edin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Paket limiti 'Tanımlanmadı' görünüyor", cause: "İlgili Dış Hat üzerinde Dakika Paketi sekmesi boş bırakılmış.", solution: "Santral → Dış Hat Tanımı → Düzenle → Sekme 2: Dakika Paketi alanını doldurun." }
    ],
    relatedPages: ["dis-hat-tanimi", "rapor-hat-kapasite", "giden-arama-kurali"],
    relatedApis: ["GET /api/v1/trunks"]
  }
];
