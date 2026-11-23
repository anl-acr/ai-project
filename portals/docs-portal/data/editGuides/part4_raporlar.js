export const EDIT_GUIDES_PART4 = {
  "ozel-rapor-tasarimcisi": {
    editFormSections: [
      {
        tabTitle: "AI Rapor Üretici, Veri Kaynakları, Sütun/Filtre Seçici & Kayıtlı Şablonlar",
        badge: "BI Stüdyosu",
        description: "Özel Rapor Tasarımcısı ekranındaki tüm görsel ve yapay zeka bileşenlerinin çalışma mantığı.",
        fields: [
          { name: "Doğal Dil AI Rapor Üretici", type: "Türkçe İstek → Otomatik Sorgu", defaultVal: "/api/reports/custom/ai-generate", required: false, effect: "Yazdığınız Türkçe talebi otomatik olarak veri seti, gruplama, metrik ve filtrelere dönüştürür." },
          { name: "Veri Kaynağı & Sütun Seçimi", type: "Çağrılar / Kuyruklar / Molalar / Omnichannel / Anketler / Randevular", defaultVal: "calls", required: true, effect: "Raporda görünmesini istediğiniz sütunları ve özet metrikleri (Adet, Toplam, Ortalama, Min/Maks) seçersiniz." },
          { name: "Koşullu Filtreler & Sıralama", type: "Tarih / Kuyruk / Temsilci / Yön / Sonuç / Süre > X", defaultVal: "Çoklu AND Filtre", required: false, effect: "Örn. 'Süre > 120 sn VE Duygu = Negatif' gibi çoklu kırılımlar oluşturur." },
          { name: "Kaydet, CSV/Excel İndir & Zamanla", type: "Kalıcı Şablon", defaultVal: "/api/reports/custom/saved", required: false, effect: "Kaydedilen özel raporları Zamanlanmış Raporlar ekranından periyodik e-posta görevine bağlayabilirsiniz." }
        ]
      }
    ]
  },
  "raporlar-pano-ve-cdr": {
    editFormSections: [
      {
        tabTitle: "7 Raporun Tek Tek Detayı: Pano, CDR, Yoğunluk, Hat Kapasite, DID, Operatör Dakika & Hatalı Çağrı",
        badge: "7 Temel Trafik Raporu",
        description: "Bu grup altındaki 7 kurumsal rapor ekranının her birindeki sütunlar, filtreler ve yönetimsel kullanım amaçları.",
        fields: [
          { name: "1. Rapor Panosu (reports-pano)", type: "Özet KPI + Trend", defaultVal: "Tarih Aralığı", required: false, effect: "Toplam gelen/giden/dahili çağrı, cevaplama oranı (%), ortalama konuşma süresi ve en yoğun 5 temsilci/kuyruk özeti." },
          { name: "2. Detaylı CDR (reports-cdr)", type: "Çağrı + Transfer/Pickup Bacakları (call_legs)", defaultVal: "CSV/Excel", required: false, effect: "Tarih, Arayan, Aranan/DID, Yön, Dahili, Kuyruk, Toplam Süre, Konuşma Süresi, Sonuç, Duygu, QA Puanı, Ses Kaydı ve genişletilebilir Transfer Zinciri." },
          { name: "3. Yoğunluk Raporu (reports-traffic-load)", type: "Saatlik / Günlük Isı Tablosu", defaultVal: "00:00–23:59", required: false, effect: "Hangi gün ve saatlerde çağrı patlaması yaşandığını göstererek vardiya planlamasını (WFM) kolaylaştırır." },
          { name: "4. Hat Kapasite Raporu (reports-trunk)", type: "Eşzamanlı Kanal Zirvesi (Peak)", defaultVal: "Trunk Bazlı", required: false, effect: "Operatör hatlarının maksimum eşzamanlı kullanımını ve meşguliyet kaynaklı kayıpları raporlar." },
          { name: "5. DID Raporu (reports-did)", type: "0850 / 0212 Hat Kırılımı", defaultVal: "Numara Bazlı", required: false, effect: "Her bir şirket hattınızın gelen çağrı adedi, cevaplama yüzdesi ve kaçan oranını karşılaştırır." },
          { name: "6. Operatör Dakika & Paket (reports-trunk-minutes)", type: "Kullanılan / Kalan Dakika (%)", defaultVal: "Fatura Dönemi", required: false, effect: "Dış Hat ayarında tanımlı aylık paket dakikasının canlı tüketimini ve ay sonu taşma tahminini gösterir." },
          { name: "7. Hatalı & Eşleşmeyen Çağrı (reports-invalid-calls)", type: "Hata Nedeni Teşhisi", defaultVal: "Otomatik", required: false, effect: "Yanlış çevrilen numaraları, yetkisiz çıkış denemelerini ve DID kuralı eşleşmeyen gelen çağrıları Türkçe nedenleriyle listeler." }
        ]
      }
    ]
  },
  "ses-kayitlari-ve-transkript": {
    editFormSections: [
      {
        tabTitle: "3 Raporun Detayı: Ses Kayıtları (RX/TX), Çağrı Transkripti & Temsilci Notları",
        badge: "Kayıt & Metin Arşivi",
        description: "Görüşme ses kayıtlarının çift kanal incelemesi, tam metin araması ve temsilci not dökümleri.",
        fields: [
          { name: "1. Ses Kayıtları (reports-audio)", type: "Dalga Formu + Split RX/TX + 0.75x–2x Hız + WAV İndir", defaultVal: "Canlı Stream", required: false, effect: "Müşteri (RX) ve Temsilci (TX) ses izlerini ayrı kanallarda dinleyip PCM ses seviyesi teşhisi yapmanızı sağlar." },
          { name: "2. Çağrı Transkripti (reports-transcripts)", type: "Konuşmacı Ayrımı + Tam Metin Arama", defaultVal: "Müşteri / Temsilci / AI", required: false, effect: "Anahtar kelimeyle binlerce konuşma dökümü içinde anlık arama yapar; tıklanan satırın ses saniyesine atlar." },
          { name: "3. Temsilci Notları (reports-notes)", type: "ACW Notları + Sonuç Kodu + Dışa Aktar", defaultVal: "Temsilci & Tarih Filtreli", required: false, effect: "Görüşme sırasında veya ACW aşamasında girilen manuel ve AI destekli çağrı notlarını listeler." }
        ]
      }
    ]
  },
  "ai-analitik-duygu-niyet-qa": {
    editFormSections: [
      {
        tabTitle: "AI Analitik Raporları 1–6: Duygu, Isı Haritası, Niyet, Kelime Bulutu, QA & Senaryo Sadakati",
        badge: "AI Analitik 1/2",
        description: "Konuşma zekası motorunun ürettiği ilk 6 analitik raporun metrikleri ve iş değeri.",
        fields: [
          { name: "1. Duygu Analizi (reports-sentiment)", type: "Pozitif / Nötr / Negatif %", defaultVal: "Temsilci & Kuyruk", required: false, effect: "Müşteri memnuniyetsizliğinin arttığı çağrıları tek tıkla filtreleyip dinlemenizi sağlar." },
          { name: "2. Duygu Isı Haritası (reports-sentiment-heat)", type: "Gün × Saat Renkli Matris", defaultVal: "Haftalık", required: false, effect: "Negatif duygunun hangi gün/saat aralıklarında yoğunlaştığını görselleştirir." },
          { name: "3. Niyet Raporu (reports-intent)", type: "Konu Sınıflandırma", defaultVal: "Otomatik Etiket", required: false, effect: "Aramaların konularını (Fiyat, Kargo, İade, Teknik Arıza, Randevu) yüzdesel pasta/bar grafikte sunar." },
          { name: "4. Kelime Bulutu & Trendler (reports-wordcloud)", type: "Sıklık Analizi", defaultVal: "Türkçe Stop-Word Temizli", required: false, effect: "Müşterilerin en sık telaffuz ettiği ürün, hata veya şikayet kelimelerini öne çıkarır." },
          { name: "5. Kalite Değerlendirmeleri — QA (reports-qa)", type: "0–100 Otomatik Puanlama", defaultVal: "Kriter Bazlı", required: false, effect: "Her görüşmenin QA soru setinden aldığı puanı, eksik maddeleri ve AI koçluk önerisini gösterir." },
          { name: "6. Senaryo Sadakati (reports-compliance)", type: "% Uyumluluk & İhlal Listesi", defaultVal: "Zorunlu Cümleler", required: false, effect: "KVKK aydınlatması, şirket selamlaması veya yasal uyarıların atlandığı görüşmeleri yakalar." }
        ]
      },
      {
        tabTitle: "AI Analitik Raporları 7–12: ROI, A/B Verimlilik, Çile Noktaları, Sessizlik, CEO Özeti & AI Randevu/RAG",
        badge: "AI Analitik 2/2",
        description: "Üst yönetim ve sürekli iyileştirme ekipleri için 6 ileri seviye zeka raporu.",
        fields: [
          { name: "7. AI vs. İnsan ROI Paneli (reports-roi)", type: "TL / $ Tasarruf Hesabı", defaultVal: "ROI Ayarlarına Göre", required: false, effect: "Yapay zekanın çözdüğü çağrıların insan maliyetine kıyasla sağladığı net finansal kazancı gösterir." },
          { name: "8. Verimlilik Karşılaştırması (reports-ab-testing)", type: "AI vs İnsan / Kuyruk A vs B", defaultVal: "AHT / FCR / CSAT", required: false, effect: "Farklı AI senaryolarının veya ekiplerin çözüm hızı ve memnuniyet performansını yan yana kıyaslar." },
          { name: "9. Müşteri Çile Noktaları (reports-friction)", type: "Tekrarlayan Şikayet Kümesi", defaultVal: "AI Özet", required: false, effect: "Müşterileri en çok yoran süreç darboğazlarını (örn. uzun bekleme, eksik bilgi, kargo gecikmesi) özetler." },
          { name: "10. Sessizlik & Söz Kesme (reports-silence)", type: "Dead-Air sn / Talk-Over %", defaultVal: "Akustik Analiz", required: false, effect: "Görüşmedeki garip uzun sessizlikleri ve temsilcinin müşterinin sözünü kesme oranını ölçer." },
          { name: "11. CEO Özet Raporu (reports-ceo-summary)", type: "Tek Sayfa Yönetici Özeti", defaultVal: "PDF / Zamanlı Mail", required: false, effect: "Üst yönetime tüm operasyonun haftalık/aylık stratejik karnesini tek bakışta sunar." },
          { name: "12. AI Randevu & Bilgi Bankası RAG (reports-ai-appointments-rag)", type: "Randevu Dönüşümü + Cevapsız Sorular", defaultVal: "RAG Eksik Tespiti", required: false, effect: "AI'ın aldığı randevu başarısını ve Bilgi Bankası'nda yanıtı bulunamadığı için eklemeniz gereken yeni SSS başlıklarını listeler." }
        ]
      }
    ]
  },
  "temsilci-performans-mola-puantaj": {
    editFormSections: [
      {
        tabTitle: "4 Rapor & WFM Vardiya Planlayıcı: Performans KPI, Kronoloji, Mola/Puantaj & Süpervizör Denetimi",
        badge: "İK & Takım Lideri",
        description: "Temsilci verimliliği, mesai uyumu ve süpervizör şeffaflığı için tüm metrikler.",
        fields: [
          { name: "1. Temsilci Performans & KPI (reports-perf)", type: "Gelen/Giden/Kaçan + AHT + ACW + QA + FCR", defaultVal: "Excel Dışa Aktar", required: false, effect: "Prim ve performans değerlendirmesi için temsilci karnesi çıkarır." },
          { name: "2. Temsilci Kronolojisi (reports-agent-status-timeline)", type: "Saniye Hassasiyetli Gantt Şeridi", defaultVal: "Günlük", required: false, effect: "Temsilcinin gün boyu hangi dakika Müsait, Görüşmede, Yemek Molasında veya Çevrimdışı olduğunu görselleştirir." },
          { name: "3. Mola & Puantaj Raporu + WFM Vardiya Planlayıcı", type: "İlk Giriş / Son Çıkış / Net Çalışma / Mola Türleri / Vardiya Sapması", defaultVal: "agent_break_logs + agent_shifts", required: false, effect: "WFM kartından her temsilciye haftalık vardiya tanımlanır; geç kalma, erken çıkma ve mola aşımı otomatik kırmızı vurgulanır." },
          { name: "4. Süpervizör Dinleme & Müdahale (reports-supervisor-audit)", type: "Süpervizör / Hedef / Mod (Listen-Whisper-Barge) / Süre", defaultVal: "Değiştirilemez Kayıt", required: false, effect: "KVKK ve iç denetim gereği yapılan her canlı dinleme/araya girme işlemini tam şeffaflıkla kaydeder." }
        ]
      }
    ]
  },
  "kuyruk-sla-anket-ve-fcr": {
    editFormSections: [
      {
        tabTitle: "10 Kuyruk & Servis Seviyesi Raporunun Tam Sütun ve Formül Dökümü",
        badge: "10 Operasyon Raporu",
        description: "Çağrı merkezi SLA, bekleme, terk, anket ve tekrar arama analitiğinin tüm raporları.",
        fields: [
          { name: "1. Kuyruk / Bekleme Analitiği (reports-queue)", type: "Giren / Cevaplanan / Terk / Ort. Bekleme", defaultVal: "Kuyruk Bazlı", required: false, effect: "Kuyrukların genel karşılama başarısını ve en uzun bekleme sürelerini özetler." },
          { name: "2. Kuyruk SLA & Hız Dilimleri (reports-queue-sla)", type: "0–10s / 10–20s / 20–30s / 30s+ Kovaları", defaultVal: "SLA % Hedefi", required: false, effect: "Çağrıların saniye dilimlerine göre cevaplanma ve terk edilme dağılımını gösterir." },
          { name: "3. Anket Raporları — CSAT (reports-survey)", type: "1–5 Puan Ortalaması + Soru Kırılımı", defaultVal: "Ses Kaydı Linkli", required: false, effect: "Düşük puan (1–2) veren müşterilerin görüşme kaydına tek tıkla ulaşıp geri arama yapmanızı sağlar." },
          { name: "4. İlk Aramada Çözüm — FCR (reports-fcr) & 5. Tekrar Arayanlar", type: "24/48/72 Saat Penceresi", defaultVal: "Otomatik Numara Eşleşme", required: false, effect: "Aynı sorunu çözülmediği için tekrar arayan müşterileri tespit ederek gerçek FCR oranını hesaplar." },
          { name: "6. Kaçan Çağrı Analizi (reports-missed)", type: "Geri Arandı / Bekliyor Durumu", defaultVal: "Claim Entegreli", required: false, effect: "Henüz geri aranmamış cevapsız çağrıları öncelikli listeler." },
          { name: "7. IVR Terk Oranı (reports-ivr-drop)", type: "Düğüm Bazlı Düşme", defaultVal: "CallFlow", required: false, effect: "Müşterilerin IVR menüsünün hangi saniyesinde/anonsunda telefonu kapattığını tespit eder." },
          { name: "8. Aktarma & Bekletme / 9. Departman & Toplama / 10. Sonuç Kodları", type: "Transfer / Hold / *8 Pickup / Disposition", defaultVal: "Kırılımlı Tablo", required: false, effect: "Gereksiz transfer zincirlerini, aşırı bekletme yapanları, *8 çağrı toplama başarısını ve sonuç kodu dağılımını raporlar." }
        ]
      }
    ]
  },
  "omnichannel-voip-ve-diger-raporlar": {
    editFormSections: [
      {
        tabTitle: "7 Uzman Altyapı & Kanal Raporunun Detaylı Metrikleri",
        badge: "7 Uzman Rapor",
        description: "Yazılı kanallar, dış arama kampanyaları, VoIP ses kalitesi, GSM yönlendirme maliyeti ve güvenlik ihlalleri.",
        fields: [
          { name: "1. Omnichannel Kanal & SLA (reports-omnichannel)", type: "WhatsApp / Telegram / Instagram / Facebook / E-Posta", defaultVal: "İlk Yanıt (FRT) & Çözüm", required: false, effect: "Her yazılı kanalda ortalama ilk yanıt süresini, AI çözüm oranını ve temsilci iş yükünü ölçer." },
          { name: "2. Kampanya & Geri Arama (reports-dialer-callback)", type: "Ulaşılan / Meşgul / Cevapsız / Dönüşüm", defaultVal: "Kampanya Bazlı", required: false, effect: "Dialer kampanyalarının ve Smart Callback geri aramalarının verimliliğini raporlar." },
          { name: "3. VoIP & Ses Kalitesi — MOS (reports-voip-quality)", type: "MOS (1.0–4.5) / RTT (ms) / Jitter (ms) / Paket Kaybı (%)", defaultVal: "Çağrı & Dahili Bazlı", required: false, effect: "Kötü ses kalitesi yaşanan kullanıcıları ve operatör hatlarını objektif ağ verileriyle tespit eder." },
          { name: "4. Yönlendirme — Follow-Me / GSM (reports-forwarding-gsm)", type: "GSM'e Aktarılan Adet & Dakika", defaultVal: "Abone Bazlı", required: false, effect: "Cep telefonuna yönlendirilen çağrıların oluşturduğu GSM maliyetini kontrol altında tutar." },
          { name: "5. Engellenen Çağrı & İhlal (reports-blacklist-security)", type: "Kara Liste + Toll-Fraud + Saldırı", defaultVal: "Güvenlik Denetimi", required: false, effect: "Reddedilen spam çağrıları ve engellenen yetkisiz uluslararası arama girişimlerini listeler." },
          { name: "6. Sesli Posta (reports-voicemail) & 7. Konferans Kullanımı (reports-conferences)", type: "Okunmamış Mesaj / Oda Süresi & Katılımcı", defaultVal: "WAV Dinlemeli", required: false, effect: "Geri dönülmemiş sesli postaları ve konferans odalarının aylık kullanım istatistiklerini verir." }
        ]
      }
    ]
  }
};
