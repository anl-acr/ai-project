export const CHAPTERS_OPERASYON = [
  {
    id: "gercek-zamanli-ai-pano",
    number: "03",
    groupId: "operasyon",
    category: "Operasyon & İzleme",
    title: "Gerçek Zamanlı AI Pano (Dashboard)",
    shortTitle: "Gerçek Zamanlı AI Pano",
    menuPath: "Operasyon & İzleme → Gerçek Zamanlı AI Pano",
    pbxRoute: "/?tab=pano",
    permissions: ["dashboard:access"],
    badge: "Canlı KPI • AI Özet",
    readMinutes: 7,
    summary:
      "Yöneticilerin santralin anlık çağrı hacmini, yapay zeka karşılama oranını, duygu dağılımını, günlük SLA performansını, aktif kriz alarmlarını ve son görüşme transkriptlerini tek bakışta takip ettiği ana komuta merkezidir.",
    screenshots: [
      {
        src: "/screenshots/02-dashboard.jpg",
        caption: "Gerçek Zamanlı AI Pano — Günlük çağrı KPI'ları, AI otomasyon oranı ve canlı trafik grafikleri",
        routeHint: "Operasyon & İzleme → Gerçek Zamanlı AI Pano"
      }
    ],
    fieldTable: [
      { field: "Toplam / Cevaplanan / Kaçan Çağrı", type: "Canlı Sayaç", defaultVal: "Bugün 00:00 (UTC+3)", required: false, description: "Her gece yerel saat 00:00'da (UTC+3) otomatik sıfırlanan günlük çağrı metrikleri." },
      { field: "AI Otomasyon & Çözüm Oranı (%)", type: "Yüzde KPI", defaultVal: "Canlı hesap", required: false, description: "İnsan temsilciye aktarılmadan Yapay Zeka Sesli Asistan tarafından uçtan uca çözülen çağrıların oranı." },
      { field: "Canlı Duygu Dağılımı", type: "Pozitif / Nötr / Negatif", defaultVal: "Anlık", required: false, description: "Görüşmelerin duygu skoru dağılımı; negatif eşik aşılırsa Kriz Alarmı tetiklenir." },
      { field: "Aktif SIP Hat & Dahili Özeti", type: "Durum Kartı", defaultVal: "Canlı AMI", required: false, description: "Çevrimiçi SIP Trunk ve kayıtlı abone sayısını Asterisk AMI üzerinden anlık gösterir." },
      { field: "Zaman Aralığı & Tenant Filtresi", type: "Filtre", defaultVal: "Bugün / Aktif Tenant", required: false, description: "Bugün, Son 7 Gün veya Son 30 Gün kırılımında KPI ve saatlik yoğunluk grafiğini günceller." }
    ],
    sections: [
      {
        heading: "1. Pano Bileşenleri ve Günlük Sıfırlama Kuralı",
        body: "AI Pano, /api/workspace/dashboard-widgets-summary ve /api/reports/wallboard uçlarından beslenir. Tüm günlük sayaçlar Türkiye yerel saatine göre 00:00:00 itibarıyla sıfırlanır; geçmiş günler ise Çağrı Raporları & Analiz altındaki kalıcı PostgreSQL tablolarında saklanır."
      },
      {
        heading: "2. Kriz Radarı ve Hızlı Aksiyonlar",
        body: "Panonun üst kısmındaki uyarı bandı, devam eden bir çağrıda müşterinin yüksek öfke/şikayet belirtisi göstermesi durumunda süpervizörü sesli ve görsel olarak uyarır. Tek tıkla Canlı Çağrı İzleme ekranına geçip 'Sessiz Dinle' veya 'Sufle (Whisper)' başlatabilirsiniz."
      }
    ],
    troubleshooting: [
      { problem: "Pano verileri 0 görünüyor veya yenilenmiyor", cause: "Tarayıcı sekmesi uzun süre uyku modunda kalmış veya Asterisk AMI bağlantısı kopmuş olabilir.", solution: "Sayfayı yenileyin; devam ederse Yönetim & Ayarlar → Sistem Panosu & Sağlık ekranından Asterisk AMI durumunu kontrol edin." }
    ],
    relatedPages: ["canli-izleme-paneli", "canli-cagri-izleme", "rapor-cdr"],
    relatedApis: ["GET /api/reports/wallboard", "GET /api/workspace/crisis-alerts", "GET /api/v1/system/capacity"]
  },
  {
    id: "canli-izleme-paneli",
    number: "04",
    groupId: "operasyon",
    category: "Operasyon & İzleme",
    title: "Canlı İzleme Paneli (Wallboard)",
    shortTitle: "Canlı İzleme Paneli",
    menuPath: "Operasyon & İzleme → Canlı İzleme Paneli",
    pbxRoute: "/?tab=canli-wallboard",
    permissions: ["wallboard:access"],
    badge: "TV Modu • Özelleştirilebilir",
    readMinutes: 7,
    summary:
      "Çağrı merkezi operasyon katındaki büyük TV ekranları ve süpervizör monitörleri için tasarlanmış, sürükle-bırak widget düzenine sahip tam ekran (Kiosk/TV) canlı performans panosudur.",
    screenshots: [
      {
        src: "/screenshots/03-wallboard.jpg",
        caption: "Canlı İzleme Paneli (Wallboard) — Kuyrukta bekleyenler, temsilci durum matrisi ve SLA eşik göstergeleri",
        routeHint: "Operasyon & İzleme → Canlı İzleme Paneli"
      }
    ],
    fieldTable: [
      { field: "Kuyrukta Bekleyen Çağrı", type: "Canlı Sayaç + Alarm", defaultVal: "Eşik: 3+", required: false, description: "ACD kuyruklarında bekleyen toplam müşteri sayısı ve en uzun bekleme süresi (saniye). Eşik aşılınca kart kırmızı uyarıya döner." },
      { field: "Temsilci Durum Matrisi", type: "Grid Tablo", defaultVal: "Tüm Kuyruklar", required: false, description: "Her temsilcinin anlık durumu (Müsait, Konuşuyor, Çalıyor, Molada + Mola Türü, Çevrimdışı) ve o durumda geçirdiği canlı sayaç." },
      { field: "SLA Hedef Göstergesi (%)", type: "Gauge / Progress", defaultVal: "%85 (20 sn)", required: false, description: "Hedef saniye içinde yanıtlanan çağrıların toplam kuyruk çağrılarına oranı." },
      { field: "Düzen Özelleştirme (Layout)", type: "JSON Kalıcı Kayıt", defaultVal: "Varsayılan Grid", required: false, description: "/api/wallboard/layout üzerinden hangi kartların görüneceği ve sıralaması sunucuya kaydedilir." },
      { field: "Tam Ekran (TV / Kiosk) Modu", type: "Toggle", defaultVal: "Kapalı", required: false, description: "Sol menüyü ve üst çubuğu gizleyerek büyük ekranlarda maksimum okunabilirlik sağlar." }
    ],
    sections: [
      {
        heading: "1. Kuyruk ve Ekip Filtreleme",
        body: "Süpervizörler kendi sorumluluğundaki kuyrukları (örn. sadece Satış 6000 veya Teknik Destek 6001) seçerek Wallboard'u departmana özel görüntüleyebilir. Rol ayarlarında 'supervisor:scope_filter' tanımlıysa süpervizör yalnızca yetkili olduğu kuyrukları görür."
      },
      {
        heading: "2. Görsel & Sesli Eşik Alarmları",
        body: "Bekleyen çağrı sayısı veya en uzun bekleme süresi tanımlı SLA eşiğini geçtiğinde ilgili kuyruk kartı dikkat çekici uyarı rengine geçer. Böylece takım liderleri moladaki temsilcileri hızla çağrıya döndürebilir."
      }
    ],
    troubleshooting: [
      { problem: "TV ekranında oturum bir süre sonra kapanıyor", cause: "Kullanıcı kartında 'Otomatik Oturum Kapatma (Idle Timeout)' aktif olabilir.", solution: "TV ekranı için sadece 'wallboard:access' yetkili özel bir kullanıcı oluşturun ve kullanıcı kartında otomatik oturum kapatmayı devre dışı bırakın." }
    ],
    relatedPages: ["canli-cagri-izleme", "acd-kuyruk", "rapor-kuyruk-sla"],
    relatedApis: ["GET /api/reports/wallboard", "GET /api/v1/calls/active", "GET /api/v1/queues"]
  },
  {
    id: "canli-cagri-izleme",
    number: "05",
    groupId: "operasyon",
    category: "Operasyon & İzleme",
    title: "Canlı Çağrı İzleme & Süpervizör Müdahalesi",
    shortTitle: "Canlı Çağrı İzleme",
    menuPath: "Operasyon & İzleme → Canlı Çağrı İzleme",
    pbxRoute: "/?tab=canli-cagri-izleme",
    permissions: ["realtime_calls:read", "call_monitor:listen", "call_monitor:whisper", "call_monitor:barge", "supervisor:agent_status", "supervisor:agent_logout"],
    badge: "ChanSpy • Whisper • Barge",
    readMinutes: 9,
    summary:
      "Santral üzerindeki tüm aktif (konuşulan, çalan, kuyrukta bekleyen ve AI tarafından yönetilen) çağrıları anlık izleme; süpervizörlerin Sessiz Dinleme (Listen), Temsilciye Fısıldama (Whisper), Araya Girme (Barge-In), Çağrı Aktarma, Sonlandırma ve temsilci mola/oturum müdahalesi yapma ekranıdır.",
    screenshots: [
      {
        src: "/screenshots/04-realtime-calls.jpg",
        caption: "Canlı Çağrı İzleme — Aktif kanallar, süre sayaçları ve Süpervizör Listen / Whisper / Barge kontrolleri",
        routeHint: "Operasyon & İzleme → Canlı Çağrı İzleme"
      }
    ],
    fieldTable: [
      { field: "Sessiz Dinle (Listen)", type: "ChanSpy Modu (q)", defaultVal: "Yetki: call_monitor:listen", required: false, description: "Süpervizörün telefonunu çaldırır; ne müşteri ne temsilci süpervizörün dinlediğini duyar." },
      { field: "Sufle / Fısılda (Whisper)", type: "ChanSpy Modu (qw)", defaultVal: "Yetki: call_monitor:whisper", required: false, description: "Süpervizör her iki tarafı duyar ancak konuştuğunda YALNIZCA temsilci duyar (müşteri duymaz). Eğitim ve kriz koçluğu için idealdir." },
      { field: "Araya Gir (Barge-In)", type: "ChanSpy Modu (qB)", defaultVal: "Yetki: call_monitor:barge", required: false, description: "Süpervizörü 3'lü konferans gibi görüşmeye dahil eder; hem müşteri hem temsilci süpervizörü duyar." },
      { field: "Canlı Transfer / Sonlandır", type: "AMI Redirect / Hangup", defaultVal: "Yetki: realtime_calls:write", required: false, description: "Aktif bir çağrıyı başka dahiliye/kuyruğa anında yönlendirir veya zorla sonlandırır." },
      { field: "Temsilci Durum Müdahalesi", type: "Müsait / Mola / Logout", defaultVal: "Yetki: supervisor:agent_status", required: false, description: "Molada unutulmuş temsilciyi Müsait'e alır, mola onay talebini onaylar/reddeder veya oturumunu uzaktan kapatır." },
      { field: "Süpervizör Denetim Kaydı", type: "Otomatik Audit Log", defaultVal: "Her zaman aktif", required: false, description: "Yapılan her Listen/Whisper/Barge işlemi kim, kimi, ne zaman ve kaç saniye dinledi bilgisiyle Süpervizör Denetim Raporu'na işlenir." }
    ],
    sections: [
      {
        heading: "1. Listen / Whisper / Barge Çalışma Mekanizması",
        body: "Süpervizör butona bastığında Nornia arka planda Asterisk AMI üzerinden süpervizörün kayıtlı dahili numarasını (WebPhone veya masa telefonu) çaldırır. Süpervizör ahizeyi kaldırdığında Asterisk ChanSpy motoru hedef temsilcinin aktif SIP kanalına seçilen modda bağlanır.",
        steps: [
          "Süpervizör hesabınıza atanmış dahili numaranın (örn. 1000) WebPhone veya masa telefonunda çevrimiçi olduğundan emin olun.",
          "Aktif Çağrılar listesinde müdahale etmek istediğiniz görüşmenin sağındaki Dinle / Fısılda / Araya Gir butonuna tıklayın.",
          "Kendi telefonunuz çaldığında cevaplayın; bağlantı anında kurulur ve tüm işlem denetim günlüğüne kaydedilir."
        ]
      },
      {
        heading: "2. Kuyruk Mola Onay Talepleri",
        body: "Kuyruk ayarlarında eşzamanlı mola limiti (örn. aynı anda en fazla 2 kişi molada olabilir) doluysa, temsilcinin mola isteği bu ekranda süpervizöre canlı bildirim olarak düşer. Süpervizör tek tıkla onaylayabilir veya gerekçeli reddedebilir."
      }
    ],
    troubleshooting: [
      { problem: "Dinle / Whisper butonuna basınca kendi telefonum çalmıyor", cause: "Süpervizör kullanıcısına dahili numara atanmamış veya dahili SIP kayıtlı (registered) değil.", solution: "Kullanıcı kartında geçerli bir dahili numara tanımlı olduğunu ve WebPhone/IP telefonun yeşil 'Bağlı' olduğunu doğrulayın." }
    ],
    relatedPages: ["canli-izleme-paneli", "temsilci-cagri-paneli", "rapor-mola-puantaj"],
    relatedApis: ["GET /api/v1/calls/active", "POST /api/v1/calls/monitor", "POST /api/v1/calls/{call_id}/transfer", "GET /api/supervisor/break-requests"]
  },
  {
    id: "temsilci-cagri-paneli",
    number: "06",
    groupId: "operasyon",
    category: "Operasyon & İzleme",
    title: "Temsilci Çağrı Paneli (Agent Workspace)",
    shortTitle: "Temsilci Çağrı Paneli",
    menuPath: "Operasyon & İzleme → Temsilci Çağrı Paneli",
    pbxRoute: "/?tab=cagri-merkezi",
    permissions: ["call_panel:access", "call_panel:tab_webphone", "call_panel:tab_history", "call_panel:tab_directory", "call_panel:cti_screen_pop", "call_panel:live_translation"],
    badge: "Agent Masaüstü • 10 Sekme",
    readMinutes: 11,
    summary:
      "Çağrı merkezi temsilcilerinin tüm mesai boyunca kullandığı tek ekranlı çalışma alanıdır: Dahili WebPhone, Temsilci Durumu/Mola Seçici, Müşteri 360° Kartı, CTI Screen Pop, AI Otomatik Çağrı Notu, Canlı Çift Yönlü Çeviri, Cevapsız Çağrı Sahiplenme, Rehber, Sesli Posta ve Masa Telefonu BLF yönetimi bu panelde birleşir.",
    screenshots: [
      {
        src: "/screenshots/04-call-center.jpg",
        caption: "Temsilci Çağrı Paneli — WebPhone, canlı istatistikler, mola kontrolü ve alt çalışma sekmeleri",
        routeHint: "Operasyon & İzleme → Temsilci Çağrı Paneli"
      }
    ],
    fieldTable: [
      { field: "Pano Sekmesi (tab_dashboard)", type: "Günlük KPI", defaultVal: "Aktif", required: false, description: "Temsilcinin bugünkü gelen/giden/kaçan çağrı sayıları, toplam konuşma süresi ve mola türlerine göre (Yemek, İhtiyaç vb.) kullandığı dakikalar." },
      { field: "Web Telefon (tab_webphone)", type: "SIP.js Softphone", defaultVal: "Aktif", required: false, description: "Numara çevirme, Sessize Al (Mute), Beklet (Hold), Kör/Danışmalı Transfer, 3'lü Konferans, KVKK Ses Kaydı Duraklatma (*9) ve Call Flip (*11)." },
      { field: "Temsilciler (tab_agents)", type: "BLF / Presence", defaultVal: "Rol Bazlı", required: false, description: "Ekip arkadaşlarının anlık Müsait/Meşgul/Molada durumlarını gösterir; tek tıkla arama veya çağrı transferi yapılabilir." },
      { field: "Kayıp Çağrı (tab_missed)", type: "Sahiplenme (Claim)", defaultVal: "Aktif", required: false, description: "Cevapsız kalan aramaları gösterir. Temsilci 'Üzerime Al (Claim)' diyerek çift aramayı önler ve tek tıkla geri arar." },
      { field: "Müşteri 360° & CTI Screen Pop", type: "Otomatik Açılış", defaultVal: "Çağrı anında", required: false, description: "Çağrı geldiğinde müşterinin geçmiş aramaları, WhatsApp sohbetleri, VIP etiketleri açılır; CTI tanımlıysa dış CRM sekmesi otomatik açılır." },
      { field: "AI Not & Sonuç Kodu (ACW)", type: "Wrap-up Formu", defaultVal: "Çağrı bitiminde", required: false, description: "Görüşme bitince AI tarafından önerilen özet not ve çağrı sonuç kodu (Disposition) tek tıkla kaydedilir." },
      { field: "Canlı Çeviri & Tercüman", type: "TR ↔ Yabancı Dil", defaultVal: "Yetki Bazlı", required: false, description: "Yabancı dilde konuşan müşterinin sesini canlı Türkçe altyazıya çevirir ve temsilcinin yanıtını hedef dilde seslendirebilir." },
      { field: "Masa Telefonum (tab_deskphone)", type: "BLF / Softkey", defaultVal: "Yetki Bazlı", required: false, description: "Temsilcinin masadaki fiziksel IP telefonunun BLF ve hızlı arama tuşlarını kendi ekranından yönetmesini sağlar." }
    ],
    sections: [
      {
        heading: "1. Temsilci Mola ve Kuyruk Durum Yönetimi",
        body: "Üst çubuktaki durum seçiciden 'Müsait' veya tanımlı mola türlerinden birine (Yemek Molası, İhtiyaç Molası, Eğitim, Toplantı) geçebilirsiniz. Her mola geçişi PostgreSQL agent_break_logs tablosuna saniye hassasiyetinde yazılır ve kuyruktan geçici olarak (Pause) çıkarılırsınız; Müsait'e dönünce kuyruk çağrıları tekrar akmaya başlar."
      },
      {
        heading: "2. KVKK / Kredi Kartı Ses Kaydı Duraklatma",
        body: "Müşteri telefon üzerinden kredi kartı numarası veya T.C. kimlik/hassas veri paylaşırken temsilci WebPhone üzerindeki 'Kaydı Duraklat' butonuna (veya masa telefonundan *9'a) basarak Asterisk MixMonitor kaydını duraklatabilir; işlem bitince tekrar devam ettirebilir."
      }
    ],
    troubleshooting: [
      { problem: "Çağrı Panelinde bazı sekmeler (örn. Ses Kayıt Dinleme veya Temsilciler) görünmüyor", cause: "Kullanıcının rolünde ilgili granüler call_panel:* yetkisi kapalı.", solution: "Sistem Ayarları → Roller ekranından ilgili role call_panel:tab_* veya call_panel:listen_records yetkisini verin." }
    ],
    relatedPages: ["masaustu-mobil-ve-webphone", "ortak-gelen-kutusu", "roller-kvkk-ve-ldap"],
    relatedApis: ["POST /api/v1/extensions/{extension}/status", "POST /api/v1/calls/{call_id}/recording-pause", "GET /api/workspace/customer-360", "POST /api/workspace/missed-claims"]
  },
  {
    id: "ortak-gelen-kutusu",
    number: "07",
    groupId: "operasyon",
    category: "Operasyon & İzleme",
    title: "Ortak Gelen Kutusu (Omnichannel)",
    shortTitle: "Ortak Gelen Kutusu",
    menuPath: "Operasyon & İzleme → Ortak Gelen Kutusu",
    pbxRoute: "/?tab=coklu-kanal",
    permissions: ["omnichannel:access"],
    badge: "WhatsApp • Telegram • Meta • E-Posta",
    readMinutes: 10,
    summary:
      "WhatsApp Business Cloud API (çoklu hat desteğiyle), Telegram Bot, Instagram Direct, Facebook Messenger, Kurumsal E-Posta (SMTP/IMAP) ve Webchat mesajlarını tek bir birleşik gelen kutusunda toplayan, Yapay Zeka ↔ İnsan Temsilci devir teslimini ve toplu WhatsApp kampanyalarını yöneten modüldür.",
    screenshots: [
      {
        src: "/screenshots/05-omnichannel.jpg",
        caption: "Ortak Gelen Kutusu — Çok kanallı sohbet listesi, hat rozetleri, AI/İnsan devir ve hızlı cevaplar",
        routeHint: "Operasyon & İzleme → Ortak Gelen Kutusu"
      }
    ],
    fieldTable: [
      { field: "Kanal & Hat Filtresi", type: "Çoklu Seçim", defaultVal: "Tümü", required: false, description: "WhatsApp (Satış Hattı / Destek Hattı rozetli), Telegram, Instagram, Facebook, E-Posta ve Webchat oturumlarını filtreler." },
      { field: "Atama Modu (AI ↔ İnsan)", type: "Toggle / Buton", defaultVal: "AI Otomatik", required: false, description: "'Devral (Takeover)' ile sohbeti AI'dan insan temsilciye alırsınız; 'AI'a Devret' ile tekrar otonom yanıta bırakırsınız." },
      { field: "Hızlı Cevaplar (/ kısayolu)", type: "Şablon Ekleme", defaultVal: "Tanımlı şablonlar", required: false, description: "Mesaj kutusuna '/' yazarak IBAN, adres, kargo takip gibi hazır yanıtları tek tuşla eklersiniz." },
      { field: "WhatsApp Toplu Yayın (Broadcast)", type: "CSV / TXT İçe Aktarma", defaultVal: "Modal", required: false, description: "CSV/TXT dosyasından numaraları temizleyip tekilleştirerek Meta onaylı şablon veya bilgilendirme mesajı gönderir." },
      { field: "Rehbere Hızlı Kaydet", type: "Tek Tık Modal", defaultVal: "Otomatik Eşleşme", required: false, description: "Numara son 10 hane eşleşmesiyle rehberde yoksa 'Rehbere Kaydet' butonu çıkar; kayıtlıysa müşteri adı (örn. Anıl Özel) otomatik görünür." },
      { field: "Sohbet Kalite (QA) & Özet", type: "AI Değerlendirme", defaultVal: "Otomatik", required: false, description: "Kapanan yazılı görüşmeleri otomatik puanlar ve Omnichannel SLA raporuna işler." }
    ],
    sections: [
      {
        heading: "1. Çoklu WhatsApp Hattı, Persona ve Karşılama Menüsü",
        body: "Sistem Ayarları → Kanal Entegrasyonları altında birden fazla WhatsApp Business hattı (örn. Satış Hattı +90 850 360 7390, Destek Hattı +90 850 360 7391) tanımlanabilir. Gelen her mesaj Meta phone_number_id bilgisiyle ilgili hatta eşleşir, sohbet kartında hat rozeti görünür ve yeni oturumlarda müşteriye otomatik 3 butonlu karşılama menüsü ([Fiyat ve Bilgi], [Randevu Al], [Canlı Temsilci]) gönderilebilir."
      },
      {
        heading: "2. Cevapsız Çağrı Sonrası Otomatik WhatsApp Karşılama",
        body: "Santrale gelen bir telefon çağrısı cevapsız (NOANSWER/BUSY) sonuçlandığında, arayan cep telefonu numarasına tanımlı WhatsApp hattından otomatik nazik bir karşılama ve geri dönüş mesajı iletilir; müşteri yanıt verirse sohbet doğrudan Ortak Gelen Kutusu'na düşer."
      }
    ],
    troubleshooting: [
      { problem: "WhatsApp'ta 24 saatten eski sohbete serbest metin gönderilemiyor", cause: "Meta WhatsApp Business Cloud API 24 saatlik müşteri hizmet penceresi kuralı.", solution: "Mesaj penceresindeki 'Onaylı Şablon Gönder (HSM Template)' butonunu kullanarak Meta onaylı bir şablon ile sohbeti yeniden açın." }
    ],
    relatedPages: ["kanallar-crm-ve-dis-api", "rapor-voip-kalite-mos", "rehber"],
    relatedApis: ["GET /api/omnichannel/chats", "POST /api/omnichannel/chats/{session_id}/send", "POST /api/omnichannel/whatsapp/broadcast", "POST /api/v1/omnichannel/whatsapp/send"]
  },
  {
    id: "api-butce-ve-tuketim",
    number: "08",
    groupId: "operasyon",
    category: "Operasyon & İzleme",
    title: "API Bütçe ve Tüketim Takibi",
    shortTitle: "API Bütçe ve Tüketim",
    menuPath: "Operasyon & İzleme → API Bütçe ve Tüketim",
    pbxRoute: "/?tab=api-butce-ve-tuketim",
    permissions: ["api_budgets:read", "api_budgets:write"],
    badge: "Token • Maliyet • Kota",
    readMinutes: 6,
    summary:
      "Google Gemini, OpenAI, ElevenLabs, Deepgram, Anthropic ve Groq yapay zeka sağlayıcılarının gerçek zamanlı token/dakika tüketimini, tahmini ABD Doları ($) maliyetini, aylık harcama tavanlarını ve bütçe uyarı eşiklerini yönettiğiniz finansal kontrol merkezidir.",
    screenshots: [
      {
        src: "/screenshots/06-api-budgets.jpg",
        caption: "API Bütçe ve Tüketim — Sağlayıcı bazlı token/dakika kullanımı ve aylık bütçe limitleri",
        routeHint: "Operasyon & İzleme → API Bütçe ve Tüketim"
      }
    ],
    fieldTable: [
      { field: "Aylık Bütçe Limiti ($)", type: "Decimal USD", defaultVal: "Örn. $100 / ay", required: false, description: "Her sağlayıcı (Gemini, OpenAI, ElevenLabs vb.) için ayrı aylık üst harcama limiti." },
      { field: "Uyarı Eşiği (%)", type: "Integer (50-95)", defaultVal: "%80", required: false, description: "Bütçe bu yüzdeye ulaştığında yöneticilere e-posta ve sistem bildirimi gönderilir." },
      { field: "Limit Aşımı Politikası", type: "Seçim", defaultVal: "Uyarı Gönder / Yerel LLM'e Düş", required: false, description: "Bütçe dolduğunda AI görevlerini otomatik daha ekonomik modele veya insan kuyruğuna yönlendirebilirsiniz." },
      { field: "Görev Kırılımı", type: "Tablo / Grafik", defaultVal: "Canlı", required: false, description: "Canlı Sesli Asistan, Transkript, Duygu Analizi, QA Puanlama ve AI Konfigürasyon Asistanı bazında tüketim detayı." }
    ],
    sections: [
      {
        heading: "1. Token Tasarrufu ve Hibrit Model Optimizasyonu",
        body: "API Bütçe ekranını Sistem Ayarları → AI Görev & Model Yönlendirme ile birlikte kullanarak büyük maliyet avantajı sağlayabilirsiniz: Örneğin canlı sesli görüşmelerde Gemini Live kullanırken, çağrı sonrası özet/QA puanlama işlemlerini daha ekonomik Flash/Yerel Ollama modellerine yönlendirerek aylık AI faturasını %60'a kadar düşürebilirsiniz."
      }
    ],
    troubleshooting: [
      { problem: "AI Asistan çağrıları aniden insan kuyruğuna düşmeye başladı", cause: "Aylık API bütçe limiti %100'e ulaşmış ve sert durdurma politikası aktif olabilir.", solution: "API Bütçe ve Tüketim ekranından ilgili sağlayıcının aylık limitini artırın veya sağlayıcı panelinde kredi bakiyesini kontrol edin." }
    ],
    relatedPages: ["yapay-zeka-ayar-ve-yonlendirme", "ai-temsilcileri"],
    relatedApis: ["GET /api/system/overview"]
  }
];
