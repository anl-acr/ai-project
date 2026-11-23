export const EDIT_GUIDES_PART2 = {
  "kullanicilar": {
    editFormSections: [
      {
        tabTitle: "Sekme 1: Genel Bilgiler, Organizasyon, Görünüm & Tenant Ataması",
        badge: "Kullanıcı Düzenle 1/6",
        description: "Kullanıcıyı Düzenle veya Yeni Kullanıcı Ekle penceresindeki temel kimlik, rol, organizasyon, başlangıç ekranı, avatar ve tema zamanlama ayarları.",
        fields: [
          { name: "İsim Soyisim & E-posta Adresi", type: "Metin / Email", defaultVal: "Zorunlu", required: true, effect: "Web girişi, arayan kimliği (CallerID Name), AI isimle dahili transferi (directory_lookup) ve sesli posta/hoş geldiniz e-postaları için kullanılır." },
          { name: "Kullanıcı Rolü & Arayüz Şifresi (Login)", type: "Rol Seçimi + Parola", defaultVal: "Agent", required: true, effect: "Rol, kullanıcının hangi menü ve alt sekmeleri görebileceğini (RBAC) belirler. Şifre alanı düzenlemede boş bırakılırsa mevcut şifre korunur." },
          { name: "Lokasyon & Departman", type: "Organizasyon Seçimi", defaultVal: "Opsiyonel", required: false, effect: "Toplu Konfigürasyon kapsam filtrelerinde ve Departman/Lokasyon raporlarında gruplama ekseni olur." },
          { name: "Başlangıç Modülü & Çağrı Paneli Açılış Sekmesi", type: "Açılış Sayfası Tercihi", defaultVal: "Temsilci Paneli / Pano", required: false, effect: "Kullanıcı giriş yaptığında doğrudan hangi ekrana düşeceğini (örn. temsilci için direkt Çağrı Paneli → Web Telefon) belirler." },
          { name: "Hazır Avatar Koleksiyonu & Tema Zamanlaması", type: "Avatar + Karanlık/Aydınlık Saat", defaultVal: "Otomatik Avatar", required: false, effect: "Kullanıcı profil fotoğrafı ve akşam belirli saatte otomatik karanlık moda, sabah aydınlık moda geçiş tercihi." },
          { name: "Bağlı Olduğu Müşteri / Tenant", type: "Multi-Tenant Seçimi", defaultVal: "Aktif Tenant", required: false, effect: "Çoklu müşteri (multi-tenant) kurulumlarda kullanıcının veri izolasyon grubunu belirler." }
        ],
        tips: [
          "Ad Soyad alanını Türkçe karakterle tam yazın; AI Sesli Asistan müşterinin 'Anıl Bey ile görüşebilir miyim?' talebini bu alandan eşleştirir.",
          "Kullanıcı listesinde sağ üstteki 'Görünür Sütunlar' menüsünden tabloda görmek istediğiniz sütunları özelleştirebilirsiniz."
        ]
      },
      {
        tabTitle: "Sekme 2: SIP Ayarları, Cihaz İnceleme, BLF/DSS (1–24), Softkeys (F1–F4) & Kodekler",
        badge: "Kullanıcı Düzenle 2/6",
        description: "Dahili numara, dış arama CallerID, güvenlik limitleri, WebPhone WebRTC, fiziksel masa telefonu MAC/Oto Provizyon, 24'e kadar BLF tuşu ve ses kodek öncelikleri.",
        fields: [
          { name: "Dahili Numarası (Extension)", type: "3–5 Hane Sayı", defaultVal: "1000+", required: true, effect: "Asterisk PJSIP endpoint kimliği. Numara Planı aralığına uygun ve benzersiz olmalıdır." },
          { name: "Dış Aramada Görünecek Numara (Outbound CallerID)", type: "DID / E.164", defaultVal: "Trunk Varsayılanı", required: false, effect: "Bu kullanıcı dış arama yaptığında karşı tarafın ekranında görünecek şirket numarası (örn. 908503607390)." },
          { name: "Giden Arama Kuralları & Çağrı Toplama Grubu (*8)", type: "Çoklu Seçim", defaultVal: "Abone Grubundan", required: false, effect: "Kullanıcının hangi dış arama rotalarını kullanabileceğini ve hangi departmanın çalan telefonlarını *8 ile çekebileceğini belirler." },
          { name: "Eş Zamanlı Dış Arama Limiti (Güvenlik)", type: "Integer (1–10)", defaultVal: "2", required: false, effect: "Tek bir dahili hesabının ele geçirilmesi halinde aynı anda onlarca dış arama (toll-fraud) başlatmasını önleyen güvenlik tavanı." },
          { name: "Web Telefonu (WebRTC) & AI Mikrofon Gürültü Engelleme", type: "PJSIP WSS + AI Denoise", defaultVal: "Aktif", required: false, effect: "Tarayıcı içi şifreli WebPhone kaydı, zil sesi melodisi seçimi ve arka plan ofis gürültüsünü temizleyen yapay zeka mikrofon filtresi." },
          { name: "Masa Telefonu Donanım Kimliği (MAC / Marka / Model / IP)", type: "Cihaz İnceleme + Oto Provizyon", defaultVal: "LAN / WAN / Cisco 5160", required: false, effect: "Fiziksel telefonun MAC adresini bağlar, uzaktan yeniden başlatma (check-sync) komutu gönderir. Cisco Enterprise (78xx/79xx/88xx/89xx) için TCP 5160, uzak çalışanlar için Nornia SIP Edge adresini üretir." },
          { name: "BLF & Programlanabilir DSS Tuşları (1–24)", type: "blf / line / speed_dial / voicemail / dnd / transfer / pickup", defaultVal: "Boş", required: false, effect: "Masa telefonundaki 1–24 arası yan tuşlara arkadaşının meşguliyet ışığı (BLF + tek tuşla çağrı çekme), hızlı arama, DND veya transfer atar." },
          { name: "Ekran Altı Esnek Tuşlar (Softkeys F1–F4)", type: "history / directory / forward / dnd / menu / redial / transfer / pickup", defaultVal: "Standart", required: false, effect: "IP telefon ekranının hemen altındaki 4 yazılım tuşunun (F1–F4) görevlerini özelleştirir." },
          { name: "Ses Kodek Önceliği (Audio Codecs)", type: "g722, alaw, ulaw, opus, g729", defaultVal: "g722, alaw, ulaw", required: false, effect: "HD ses için G.722/Opus, zayıf internet bağlantısı için G.729 öncelik sırasını sürükleyip belirleyebilirsiniz." }
        ]
      },
      {
        tabTitle: "Sekme 3: Profiller (*70), 3-Seviye Yönlendirme, Follow Me, Voicemail, Hot-Desk & Patron-Sekreter",
        badge: "Kullanıcı Düzenle 3/6",
        description: "Her kullanıcı için sınırsız çalışma profili (Ofis, Uzaktan, Dışarıda, Toplantıda) ve profil bazlı cihaz/yönlendirme kuralları.",
        fields: [
          { name: "1. Bu Profilde Çalacak Cihazlar", type: "Web Telefon / PC-Mac / Mobil / Masa Telefonu", defaultVal: "Tümü", required: false, effect: "Örn. 'Ofis' profilinde sadece Masa Telefonu, 'Evden' profilinde sadece WebPhone + Mobil Uygulama çalacak şekilde ayarlanır." },
          { name: "2. Çalma Süresi (sn) & 3. Telefon Tuşlama Kodu (Digit)", type: "15–60 sn + *70 + Rakam", defaultVal: "30 sn / *701", required: false, effect: "Dahiliye gelen çağrının yönlendirmeye düşmeden önce kaç saniye çalacağı ve fiziksel telefondan profil değiştirme kısa kodu." },
          { name: "4. 3 Seviyeli Çağrı Yönlendirme (Her Zaman / Meşgulde / Cevapsız)", type: "Bağımsız Toggle + Hedef Tipi + Hedef", defaultVal: "Pasif", required: false, effect: "Her durum için ayrı hedef seçilir (Dahili, Kuyruk, Dış GSM, Sesli Posta, Anons). Dahili çevrimdışı veya cevapsızsa Asterisk çağrıyı Operator_Trunk üzerinden kullanıcının GSM numarasına otomatik aktarır." },
          { name: "Beni Takip Et (Follow Me — 1. ve 2. Hedef)", type: "1. Hedef + 2. Hedef + Bekleme (sn)", defaultVal: "Kapalı", required: false, effect: "Önce dahiliyi çaldırır, açılmazsa 1. hedefe (örn. sekreter), o da açmazsa 2. hedefe (örn. cep telefonu) sıralı takip uygular." },
          { name: "Sesli Posta (Voicemail *97)", type: "Karşılama Anonsu + 4 Rakam PIN + E-Posta WAV", defaultVal: "Kapalı", required: false, effect: "Cevapsız çağrılarda sesli mesaj kaydı alır, 4 rakamlı PIN ile *97'den dinlenebilir veya e-posta ekine otomatik WAV gönderilir." },
          { name: "Ortak Masa Telefonu (Hot-Desking *75 / *76)", type: "Aktif + PIN + Gece Yarısı Otomatik Çıkış", defaultVal: "auto_logout_midnight: true", required: false, effect: "Vardiyalı personelin herhangi bir boş masadaki IP telefondan *75 + Dahili + PIN ile oturum açmasını sağlar." },
          { name: "Patron-Sekreter (*74)", type: "Atanan Sekreter Dahilileri + VIP Doğrudan Erişim Listesi", defaultVal: "Kapalı", required: false, effect: "Aktifken patrona gelen aramalar önce sekreterlere düşer; sadece VIP listesinde kayıtlı dahili veya GSM numaraları doğrudan patronu çaldırabilir." }
        ]
      },
      {
        tabTitle: "Sekme 4: Ses Kayıt Politikası & Kullanıcı Bazlı CRM / CTI Screen Pop",
        badge: "Kullanıcı Düzenle 4/6",
        description: "Aboneye özel ses kayıt seviyesi ve dış CRM sisteminde otomatik müşteri kartı açma (Screen Pop) konfigürasyonu.",
        fields: [
          { name: "Ses Kayıt Modu", type: "Yapay Zeka (AI) / Standart / Kapalı", defaultVal: "Standart", required: false, effect: "AI: Çift kanal RX/TX kayıt + otomatik transkript, duygu ve QA puanlama. Standart: MixMonitor WAV kaydı. Kapalı: Kayıt alınmaz." },
          { name: "Hızlı CRM Şablonu & Screen Pop URL", type: "Zoho / HubSpot / Salesforce / Bitrix24 / Özel URL", defaultVal: "Opsiyonel", required: false, effect: "Örn. https://crm.sirket.com/ara?tel={phone}. {phone}, {did}, {ext} değişkenleri canlı çağrı verisiyle dolar." },
          { name: "Otomatik Sekme Açılma Zamanı & Davranışı", type: "Çalarken / Cevaplandığında + Yeni/Aynı Sekme", defaultVal: "Çalarken / Tek Sekme", required: false, effect: "Tarayıcıda 2. sekmede CRM müşteri kartının tam hangi anda açılacağını belirler." },
          { name: "CRM Müşteri Sorgu API URL & Auth", type: "GET/POST + Bearer/Header Token", defaultVal: "Opsiyonel", required: false, effect: "Çağrı geldiğinde arka planda CRM'den müşteri adı/bakiyesi çekip WebPhone ekranında göstermek için kullanılır." }
        ]
      },
      {
        tabTitle: "Sekme 5–11: Özellikler, Güvenlik (2FA), Uygulamalar, CTI, Avatar/Tema, Arayüz/Panel Düzeni, Rapor & Yönetim Filtresi ve Tenant",
        badge: "Kullanıcı Düzenle 5–11/11",
        description: "Kullanıcı Düzenle penceresinin sol menüsündeki 11 sekmenin tamamının (Genel, SIP, Profiller & Yönlendirme, Özellikler, Güvenlik, Uygulamalar, CTI, Avatar & Tema, Arayüz & Panel Düzeni, Rapor & Yönetim Filtresi, Müşteri/Tenant) kalan kurumsal kontrolleri.",
        fields: [
          { name: "Özellikler Sekmesi (Ses Kayıt, Sesli Posta, Hot-Desk, Patron-Sekreter)", type: "AI / Standart / Kapalı + Voicemail + Hot-Desk + Boss-Secretary", defaultVal: "Standart", required: false, effect: "Kullanıcının ses kaydı düzeyini, sesli posta PIN/e-posta aktarımını, ortak masa (*75/*76) ve patron-sekreter (*74) politikalarını tek sekmede yönetir." },
          { name: "Güvenlik Sekmesi (2FA, Oturum Zaman Aşımı & Şifre Politikası)", type: "Google Auth / E-Posta OTP / WhatsApp OTP + 1/2/3 Saat Oto Çıkış + 1/3/6/12 Ay Şifre Yenileme", defaultVal: "Opsiyonel", required: false, effect: "İki faktörlü doğrulama, güvenilen cihaz kilidi, hareketsizlikte otomatik logout ve dış arama karantinası." },
          { name: "Uygulamalar Sekmesi & 'Hoş Geldiniz Maili Gönder' Butonu", type: "Web / PC-Mac / iOS-Android + Magic Login QR", defaultVal: "Tek Tık Mail/QR", required: false, effect: "Kullanıcıya tek tıkla kurulum/hoş geldiniz e-postası gönderir ve mobil/masaüstü uygulama QR bağlantısını yönetir." },
          { name: "Arayüz & Panel Düzeni Sekmesi", type: "Başlangıç Modülü + Çağrı Paneli Sekmesi + Görünüm (İkon+Başlık / Sadece İkon)", defaultVal: "Role Göre Otomatik", required: false, effect: "Kullanıcının girişte açılacak varsayılan ekranını, sol menü düzenini ve kişisel çalışma alanı tercihlerini kaydeder." },
          { name: "Rapor & Yönetim Filtresi Sekmesi (Supervisor Scope)", type: "Yönetilen Temsilci & Kuyruk Kapsamı", defaultVal: "Tümü / Seçili Ekip", required: false, effect: "Süpervizör veya takım liderinin yalnızca kendi sorumlu olduğu temsilci ve kuyrukların canlı ekranlarını ve raporlarını görmesini sağlar." },
          { name: "Kullanıcı Aktif mi? & Müşteri / Tenant Sekmesi", type: "Üst Sağ Toggle + Multi-Tenant Atama", defaultVal: "Aktif / Ana Müşteri", required: false, effect: "İşten ayrılan personelin verilerini silmeden anında oturum ve SIP erişimini dondurur." }
        ]
      }
    ]
  },
  "anons-yonetimi": {
    editFormSections: [
      {
        tabTitle: "Anons Kategorileri (Sistem / Bekleme Müziği MOH / Özel Anonslar) & AI TTS Stüdyosu",
        badge: "Anons Ekle / Düzenle",
        description: "Yeni anons yükleme veya yapay zeka seslendirme stüdyosundaki tüm ses karakteri, hız ve üslup seçenekleri.",
        fields: [
          { name: "Kategori Sekmesi", type: "Sistem Anonsları / Bekleme Müzikleri (MOH) / Özel Anonslar", defaultVal: "Özel Anonslar", required: true, effect: "Bekleme Müziği (MOH) olarak yüklenen dosyalar Asterisk moh sınıfına senkronlanır; Özel Anonslar CallFlow ve Kuyruk listelerinde çıkar." },
          { name: "Medya / Anons Adı", type: "Metin", defaultVal: "Zorunlu", required: true, effect: "Santral genelinde bu anonsu seçerken göreceğiniz açıklayıcı etiket." },
          { name: "Seslendirme Motoru (TTS Sağlayıcısı)", type: "ElevenLabs / Google Gemini / OpenAI TTS", defaultVal: "ElevenLabs / Google", required: false, effect: "Metinden stüdyo kalitesinde Türkçe/İngilizce anons üretir." },
          { name: "ElevenLabs Ses Kütüphanesi & Özel Klonlanmış Voice ID", type: "Rachel, Domi, Bella, Antoni, Josh, Adam, George + Özel ID", defaultVal: "Bella / Özel ID", required: false, effect: "Kurumunuzun kendi marka sesini ElevenLabs'te klonlayıp Voice ID'sini buraya yapıştırabilirsiniz." },
          { name: "Konuşma Üslubu / Tonu & Konuşma Hızı (Speaking Rate)", type: "Kurumsal/Samimi + 0.75x–1.25x", defaultVal: "1.0x", required: false, effect: "IVR tuşlama anonslarının müşteriler tarafından rahat anlaşılması için 0.95x–1.0x hız önerilir." }
        ]
      }
    ]
  },
  "acd-kuyruk": {
    editFormSections: [
      {
        tabTitle: "Bölüm 1–3: Temel Kimlik, Çağrı Dağıtım Stratejisi, Kapasite, ACW & Mola Limitleri",
        badge: "Kuyruk Düzenle 1/4",
        description: "Kuyruk Düzenle penceresinin ilk üç bloğundaki tüm çalma, öncelik ve operasyonel kapasite parametreleri.",
        fields: [
          { name: "Kuyruk İsmi & Numarası (Dahili)", type: "Metin + 2000+/6000+", defaultVal: "Zorunlu", required: true, effect: "İç transferlerde ve CallFlow hedeflerinde kullanılan kuyruk kimliği." },
          { name: "Kuyruk İsmini Telefon Ekranında Göster & Kuyruk Öncelik Derecesi", type: "Toggle + Weight (0–10)", defaultVal: "Açık / 0", required: false, effect: "Aynı temsilci 2 kuyruğa üyeyse yüksek öncelikli (örn. VIP) kuyruğun çağrısı öne geçer; ekranda hangi kuyruktan çağrı geldiği yazar." },
          { name: "Çalma Düzeni (Strategy) & Temsilci Çalma Süresi (sn)", type: "ringall / rrmemory / leastrecent / fewestcalls / random / linear / wrandom", defaultVal: "rrmemory / 20 sn", required: true, effect: "Çağrıların temsilciler arasında hangi adalet algoritmasıyla ve kaç saniye çalarak dağıtılacağını belirler." },
          { name: "Meşguldeki Temsilciyi Çaldır (Ring In Use)", type: "Toggle", defaultVal: "Kapalı (Önerilen)", required: false, effect: "Kapalıyken zaten görüşmede olan temsilcinin 2. hattı çalmaz." },
          { name: "Maks. Bekleyen Çağrı, ACW Süresi (sn) & Maks. Eşzamanlı Mola", type: "Integer", defaultVal: "0 (Sınırsız) / 10 sn / 2 kişi", required: false, effect: "ACW: Çağrı bitiminde not girmek için nefes alma süresi. Maks. Eşzamanlı Mola: Limit dolunca yeni mola isteğini Süpervizör onayına gönderir." },
          { name: "Çağrı Sonuç Kodları (Dispositions)", type: "Etiket Listesi", defaultVal: "Satış, Bilgi, Şikayet, Takip", required: false, effect: "Bu kuyruktan gelen görüşme bittiğinde temsilcinin seçebileceği zorunlu/opsiyonel sonuç kodları." }
        ]
      },
      {
        tabTitle: "Bölüm 4–5: Otomatik Mola (RONA), Kopma Toleransı & Mesai Sonu Otomatik Çıkış",
        badge: "Kuyruk Düzenle 2/4",
        description: "Cevap vermeyen veya bağlantısı kopan temsilcilerin müşterileri bekletmesini engelleyen akıllı koruma kuralları.",
        fields: [
          { name: "Üst Üste Kaçırılan Çağrı Limiti (Auto-Pause / RONA)", type: "Integer (1–5)", defaultVal: "2", required: false, effect: "Temsilci üst üste X çağrıyı açmazsa otomatik 'RONA Molası'na alınır ve bildirim kanalından uyarılır." },
          { name: "Kopma Tolerans Süresi (sn) & Bağlantı Geldiğinde Davranış", type: "Saniye + Otomatik Dön / Molada Kal", defaultVal: "30 sn", required: false, effect: "Evden çalışan temsilcinin interneti anlık koptuğunda kaç saniye tolerans tanınacağını ve geri dönünce davranışını belirler." },
          { name: "Otomatik Çıkış Zamanlama Modu (Auto-Logout)", type: "Kapalı / Gece Yarısı / Özel Saat + Günler (Pzt–Paz)", defaultVal: "Özel Saat 18:00", required: false, effect: "Belirlenen gün ve saatte kuyrukta açık kalmış tüm temsilcileri otomatik logout eder (puantaj doğruluğu için kritik)." },
          { name: "Otomatik Çıkış Kapsamı (Aksiyon)", type: "Sadece Kuyruktan Çıkar / Tam Sistem Logout", defaultVal: "Kuyruktan Çıkar", required: false, effect: "Mesai sonunda temsilcinin yalnızca kuyruk üyeliğini mi yoksa tam oturumunu mu kapatacağını seçer." }
        ]
      },
      {
        tabTitle: "Bölüm 6–8: Karşılama, Bekleme Müziği, Sıra/Süre Anonsu, IVR Tuşlama & Timeout Taşması",
        badge: "Kuyruk Düzenle 3/4",
        description: "Müşterinin kuyrukta beklerken duyacağı tüm ses deneyimi ve maksimum bekleme süresi dolduğunda yapılacak yönlendirmeler.",
        fields: [
          { name: "Karşılama Anonsu & Aktif Bekleme Müziği Sınıfı (MOH)", type: "Anons / MOH Seçimi", defaultVal: "default", required: false, effect: "Müşteri kuyruğa girdiğinde çalınacak karşılama anonsu ve bekleme müziği." },
          { name: "Sıra Numarası Anonsu, Tahmini Bekleme Süresi & Periyodik Anons", type: "Toggle + Periyot (sn) + Özel Anons", defaultVal: "60 sn", required: false, effect: "'Sırada 3. kişisiniz, tahmini bekleme süreniz 2 dakikadır' ve aralarda özel kampanya/bilgilendirme anonsları." },
          { name: "Anons Sırasında IVR Tuşlama Seçenekleri (Breakout IVR)", type: "Tuş → Hedef", defaultVal: "Örn. 1 → Geri Arama / Sesli Mesaj", required: false, effect: "Müşteri beklemek istemezse müzik esnasında örn. '1' tuşlayarak geri arama bırakabilir veya AI asistana geçebilir." },
          { name: "Maksimum Bekleme Süresi (sn) & Düşüş (Timeout) Hedefleri", type: "Saniye + 1. Hedef + Anons Sonrası Hedef", defaultVal: "120 sn", required: false, effect: "Süre dolduğunda çağrıyı yedek kuyruğa, AI Sesli Asistana, dış numaraya veya sesli postaya taşır." },
          { name: "Cevapsız Çağrıları Yöneticiye Bildir", type: "Toggle + E-Posta/WhatsApp", defaultVal: "Opsiyonel", required: false, effect: "Kuyruktan terk edilen çağrıları anlık veya özet olarak kuyruk yöneticisine bildirir." }
        ]
      },
      {
        tabTitle: "Bölüm 9–11: Smart Callback (Geri Arama), Çağrı Sonu CSAT Anketi & Üye/Penalty Yönetimi",
        badge: "Kuyruk Düzenle 4/4",
        description: "Kuyruk bazlı akıllı geri arama, çok sorulu memnuniyet anketi ve temsilci/yönetici ataması.",
        fields: [
          { name: "Kuyruk Bazlı Otomatik Geri Arama (Smart Callback)", type: "Aktif + Geri Arama Dış Hattı (Trunk)", defaultVal: "Opsiyonel", required: false, effect: "Yoğunlukta kapatan müşteriyi temsilci müsait olduğunda sistem otomatik geri arar ve kuyruğa bağlar." },
          { name: "Çağrı Sonu Memnuniyet Anketi (CSAT — Çoklu Soru)", type: "1. Soru + Ek Sorular + TTS / Kayıtlı Anons", defaultVal: "1–5 DTMF", required: false, effect: "Temsilci görüşmeyi kapattığında müşteriye sesli olarak 1–5 puanlama soruları sorar ve Anket Raporu'na işler." },
          { name: "Üye Tipi, Öncelik Puanı (Penalty 0–10) & Kuyruk Yöneticileri", type: "Statik/Dinamik + Penalty + Supervisor", defaultVal: "Penalty 0", required: true, effect: "Penalty 0 birinci ekip, Penalty 1 yedek ekiptir. Atanan Kuyruk Yöneticileri bu kuyruğun mola taleplerini ve raporlarını yönetir." }
        ]
      }
    ]
  },
  "oto-provizyon": {
    editFormSections: [
      {
        tabTitle: "Provizyon Sunucu Adresleri (LAN/WAN & DHCP 66), Ağ Taraması & Cihaz Ekle/Düzenle",
        badge: "Oto Provizyon Detay",
        description: "Masa telefonlarını sıfır manuel işlemle kurmak için sunucu ayarları, ağ keşfi ve cihaz kayıt formu.",
        fields: [
          { name: "Santral Yerel IP, Port & Dış (WAN) SIP Sunucusu", type: "Otomatik LAN + Nornia FQDN", defaultVal: "8000 / 443", required: true, effect: "Ofis içi telefonlar LAN adresini, uzak şube telefonları WAN FQDN adresini otomatik alır." },
          { name: "Ağdaki Yeni Cihazları Tara (Network Discovery)", type: "ARP / mDNS / SIP Tarama", defaultVal: "Tek Tık", required: false, effect: "Yerel ağa yeni bağlanan Yealink/Fanvil/Grandstream/Cisco telefonların MAC ve IP adreslerini otomatik keşfeder." },
          { name: "Cihaz Ekle/Düzenle: Marka, Model, MAC, Bağlanacak Dahili & Şablon", type: "Form Alanları", defaultVal: "Marka Şablonu", required: true, effect: "MAC adresini kullanıcıyla eşler; kullanıcının SIP parolası ve BLF tuşlarını seçilen şablona otomatik gömer." },
          { name: "Bağlantı Lokasyonu (Ağ Modu)", type: "Aynı Ofis (LAN) / Uzak Şube (WAN) / Otomatik", defaultVal: "Otomatik", required: true, effect: "Telefonun yapılandırma dosyasındaki SIP registrar ve outbound proxy adresini belirler." },
          { name: "Son Provizyon İstekleri (Canlı İzleme)", type: "Canlı Log", defaultVal: "HTTP 200 / 404", required: false, effect: "Hangi MAC adresinin hangi saniyede provizyon dosyasını başarıyla indirdiğini canlı doğrular." }
        ]
      }
    ]
  },
  "giden-arama-kurali": {
    editFormSections: [
      {
        tabTitle: "Giden Arama Kuralı Ekle / Düzenle — Genel, Arama Düzeni, CallerID & PIN Politikası",
        badge: "Kural Düzenle",
        description: "Her dış arama rotası için desen eşleştirme, numara dönüştürme, transit CID seçimi ve saatli PIN koruması.",
        fields: [
          { name: "Genel: Kural Adı, Öncelik & Birincil/Yedek Dış Hatlar (Failover)", type: "Sıralı Trunk Listesi", defaultVal: "1. Trunk → 2. Trunk", required: true, effect: "İlk operatör meşgul veya erişilemez olduğunda (CONGESTION/CHANUNAVAIL) çağrı otomatik 2. Trunk'a düşer." },
          { name: "Arama Düzeni (Prefix / Pattern) & Operatöre Giden Format (Strip/Prepend)", type: "Örn. 05. → Strip 1, Prepend 90", defaultVal: "TR Standardı", required: true, effect: "Örn. 0532... çevrildiğinde baştaki 0 silinir ve başına 90 eklenerek operatöre 90532... gönderilir." },
          { name: "Görünür Numara (Çıkış CallerID Override)", type: "E.164", defaultVal: "Opsiyonel", required: false, effect: "Bu kuraldan çıkan tüm çağrılarda zorunlu olarak belirli bir DID numarasının görünmesini sağlar." },
          { name: "Arayan Numara (CallerID/DID) Eşleşmesi (Transit & Hat Seçimi)", type: "Opsiyonel Desen", defaultVal: "Tümü", required: false, effect: "Çoklu şirket/şube yapısında A departmanı ararsa A operatöründen, B departmanı ararsa B operatöründen çıkış yapılmasını sağlar." },
          { name: "Giden Arama Parolası (PIN) & Parola Başlangıç–Bitiş Saati", type: "4–6 Hane PIN + Saat Aralığı", defaultVal: "Opsiyonel", required: false, effect: "Örn. sadece mesai dışı saatlerde (18:00–09:00) veya uluslararası aramalarda çıkış öncesi sesli PIN kodu sorar." }
        ]
      }
    ]
  },
  "gelen-arama-kurali": {
    editFormSections: [
      {
        tabTitle: "Gelen Arama Kuralı Ekle / Düzenle — Genel, DID Modeli & Varsayılan Hedef",
        badge: "Gelen Kural Düzenle",
        description: "Operatörden gelen çağrıların DID ve arayan numara bazında tam yönlendirme kuralları.",
        fields: [
          { name: "Genel: Kural Adı, Aktiflik & Öncelik Sırası", type: "Metin + Toggle", defaultVal: "Aktif", required: true, effect: "Üstteki daha spesifik kurallar (örn. tam DID veya VIP arayan) alttaki genel kurallardan önce eşleşir." },
          { name: "DID Modeli (Eşleşme Deseni)", type: "Tam Numara / Son 10 Hane / Wildcard", defaultVal: "908503607390", required: true, effect: "Asterisk REAL_DID çıkarıcı sayesinde operatör To/Request-URI başlığındaki gerçek DID'yi yakalar." },
          { name: "Varsayılan Hedef Türü & Hedef Seçimi", type: "CallFlow / ACD Kuyruk / AI Temsilci / Dahili / Anons / Konferans / Sesli Posta", defaultVal: "Arama Akışı (CallFlow)", required: true, effect: "Gelen çağrının doğrudan yönlendirileceği santral nesnesi." },
          { name: "Arayan Numara Filtresi & Ekran Öneki (CID Prefix)", type: "Opsiyonel", defaultVal: "Boş", required: false, effect: "Örn. 'VIP:' öneki eklenirse temsilci telefonunda 'VIP: 0532...' şeklinde görünür." }
        ]
      }
    ]
  },
  "cagri-toplama-grubu": {
    editFormSections: [
      {
        tabTitle: "Çağrı Toplama Grubu Ekle / Düzenle",
        badge: "Grup Düzenle",
        description: "Asterisk PJSIP named_call_group ve named_pickup_group tanımlarının detaylı ayarları.",
        fields: [
          { name: "Grup Adı & Açıklama", type: "Metin", defaultVal: "Zorunlu", required: true, effect: "Departman veya kat bazlı toplama grubu adı (örn. Satış Katı, Muhasebe)." },
          { name: "Grup Üyesi Dahililer", type: "Çoklu Kullanıcı Seçimi", defaultVal: "En az 2 dahili", required: true, effect: "Gruptaki kullanıcılar birbirlerinin çalan çağrılarını *8 (grup içi) veya **<dahili> (direkt) ile çekebilir." }
        ]
      }
    ]
  },
  "abone-grubu": {
    editFormSections: [
      {
        tabTitle: "Abone Grubu Ekle / Düzenle (Class of Service — CoS)",
        badge: "Yetki Sınıfı Düzenle",
        description: "Grup bazlı dış arama kuralları, gruplar arası iç arama kısıtı ve toplu üye politikaları.",
        fields: [
          { name: "Grup Adı & Açıklama", type: "Metin", defaultVal: "Zorunlu", required: true, effect: "Örn. 'Sadece Dahili', 'Yurtiçi Personel', 'Üst Yönetim'." },
          { name: "İzinli Giden Arama Kuralları & Uluslararası Yetki", type: "Çoklu Kural Seçimi", defaultVal: "Yurtiçi", required: false, effect: "Bu gruba bağlı tüm dahililerin dışarıya hangi rotalardan arama yapabileceğini merkezi yönetir." },
          { name: "Gruplar Arası İç Arama Yetkisi", type: "İzinli Abone Grupları", defaultVal: "Tüm Gruplar", required: false, effect: "Örn. Depo/Misafir telefonlarının Genel Müdürlük abone grubunu doğrudan aramasını kısıtlayabilirsiniz." },
          { name: "Grup Üyeleri", type: "Çoklu Kullanıcı Seçimi", defaultVal: "Dinamik", required: false, effect: "Üye eklendiğinde Toplu Konfigürasyon üzerinden tüm gruba tek tıkla ses kaydı/yönlendirme de uygulanabilir." }
        ]
      }
    ]
  }
};
