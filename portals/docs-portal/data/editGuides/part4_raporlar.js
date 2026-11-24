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
          { name: "Koşullu Filtreler (VE/VEYA) & Sıralama", type: "Tarih / Kuyruk / Temsilci / Yön / Sonuç / Süre > X", defaultVal: "AND / OR", required: false, effect: "Örn. 'Süre > 120 sn VE Duygu = Negatif' gibi çoklu kırılımlar oluşturur." },
          { name: "Kaydet, CSV/Excel İndir & Zamanla", type: "Kalıcı Şablon", defaultVal: "/api/reports/custom/saved", required: false, effect: "Kaydedilen özel raporları Zamanlanmış Raporlar ekranından periyodik e-posta görevine bağlayabilirsiniz." }
        ]
      }
    ]
  },
  "rapor-cdr": {
    editFormSections: [
      {
        level: 3,
        tabTitle: "Alt Pencereler: CDR Satır İçi 4 Detay Popup'ı (Transkript, AI Özet, QA Puan Kartı & Temsilci Notları)",
        badge: "CDR → Satır Detayları",
        description: "Detaylı CDR tablosundaki her bir görüşme satırında bulunan aksiyon ikonlarına tıklandığında açılan ve sayfadan ayrılmadan derin inceleme sunan 4 alt penceredir.",
        fields: [
          { name: "Konuşma Dökümü (Transkript) Popup'ı", type: "Konuşmacı Ayrımı + Zaman Damgası", defaultVal: "Müşteri / Temsilci / AI", required: false, effect: "Görüşmenin tamamını sohbet balonu düzeninde okumanızı ve kritik ifadeleri kopyalamanızı sağlar." },
          { name: "AI Görüşme Özeti & Duygu Analizi Popup'ı", type: "Otomatik Özet + Konu Etiketi + Duygu Skoru", defaultVal: "LLM Analizi", required: false, effect: "10 dakikalık bir görüşmenin ana konusunu, müşteri memnuniyetini ve alınması gereken aksiyonları 3 saniyede özetler." },
          { name: "Kalite Değerlendirmesi (QA) Puan Kartı Popup'ı", type: "0–100 Puan + Kriter Bazlı Geçti/Kaldı + Koçluk Önerisi", defaultVal: "Otomatik QA", required: false, effect: "Her bir QA sorusundan kaç puan alındığını ve temsilcinin hangi cümleyi atladığını tek tek gösterir." },
          { name: "Temsilci Notları & Transfer Zinciri (call_legs) Alt Tablosu", type: "ACW Notu + Sonuç Kodu + Bacak Dökümü", defaultVal: "Genişletilebilir Satır", required: false, effect: "Çağrı sırasındaki tüm transfer, *8 çekme ve kuyruk geçiş adımlarını ayrı bacaklar halinde açar." }
        ]
      }
    ]
  },
  "rapor-temsilci-kronolojisi": {
    editFormSections: [
      {
        level: 3,
        tabTitle: "Alt Pencere: Temsilci Gün İçi Kronoloji Detay Modalı (Saniye Bazlı Olay Dökümü & Filtre)",
        badge: "Kronoloji → Temsilci Detay",
        description: "Temsilci Kronolojisi (Gantt) ekranında herhangi bir temsilcinin satırına tıklandığında açılan ve gün boyu tüm durum değişimlerini saniye hassasiyetinde filtreleyen alt penceredir.",
        fields: [
          { name: "Olay Tipi Filtreleri (Giriş/Çıkış, Müsait, Çağrı, Yemek/İhtiyaç Molası, RONA, Çevrimdışı)", type: "Çoklu Durum Çipleri", defaultVal: "Tümü", required: false, effect: "Sadece belirli bir mola türünü veya gün içi kısa kopmaları anında süzerek denetim yapmanızı sağlar." },
          { name: "Başlangıç / Bitiş Saati, Süre (dk:sn) & Kaynak Notu", type: "Kronolojik Tablo", defaultVal: "agent_break_logs", required: false, effect: "Molanın temsilci tarafından mı yoksa RONA/Süpervizör müdahalesiyle mi başlatıldığını şeffaf biçimde gösterir." }
        ]
      }
    ]
  },
  "rapor-mola-puantaj": {
    editFormSections: [
      {
        level: 3,
        tabTitle: "Alt Panel: WFM Vardiya Planlayıcı & Sapma (Geç Kalma / Erken Çıkma / Mola Aşımı) Kuralları",
        badge: "Mola & Puantaj → WFM",
        description: "Mola & Puantaj Raporu içinde yer alan WFM vardiya tanımlama ve günlük vardiya uyum denetim aracıdır.",
        fields: [
          { name: "Temsilci Haftalık Vardiya Başlangıç / Bitiş Saatleri", type: "agent_shifts Tablosu", defaultVal: "09:00–18:00", required: false, effect: "Her temsilciye özel vardiya planı girildiğinde geç giriş, erken çıkış ve fazla mesai otomatik hesaplanır." },
          { name: "Özet / Detaylı Log Görünümü & Bordro Excel Dışa Aktarımı", type: "Özet / Oturum Logları", defaultVal: "CSV/Excel", required: false, effect: "İK departmanına doğrudan bordro eki olarak verilebilecek temiz puantaj tablosu üretir." }
        ]
      }
    ]
  }
};
