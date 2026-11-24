export const EDIT_GUIDES_PART3 = {
  "toplu-konfigurasyon": {
    editFormSections: [
      {
        tabTitle: "Modül 1: Kullanıcılar & Aboneler — 7 Kapsam Filtresi, 20+ Toplu Alan & Hoş Geldiniz Maili",
        badge: "Toplu Konfigürasyon 1/4",
        screenshot: { src: "/screenshots/tabs/modals/bulk-users.jpg", caption: "Toplu Konfigürasyon → Kullanıcılar & Aboneler — Hedef kitle seçimi ve toplu değişiklik matrisi", routeHint: "Toplu Konfigürasyon → Kullanıcılar" },
        description: "Tüm kullanıcıları veya belirli bir Abone Grubu / Çağrı Toplama Grubu / Rol / Departman / Lokasyon / Dahili Aralığını (1000–1050) seçip tek tıkla 20+ ayarı aynı anda günceller.",
        fields: [
          { name: "7 Hedef Kitle Filtresi", type: "Tümü / Abone Grubu / Toplama Grubu / Rol / Departman / Lokasyon / Dahili Aralığı", defaultVal: "Önizlemeli", required: true, effect: "Yalnızca kriterle eşleşen kayıtlar güncellenir; uygulanmadan önce tam liste önizlenir." },
          { name: "Ses Kayıt, Hesap Durumu, Voicemail, Rol, Departman, Lokasyon", type: "Seçimli Alanlar", defaultVal: "Dokunulmaz (Boşsa)", required: false, effect: "Yalnızca işaretlediğiniz alanları toplu değiştirir." },
          { name: "Yönlendirme, Follow Me, Karantina, Kanal Limiti, CallerID, Transport, Oto Logout & Şifre Periyodu", type: "Güvenlik & SIP Politikası", defaultVal: "Seçimli", required: false, effect: "50+ aboneyi saniyeler içinde standart kurumsal güvenlik politikasına geçirir ve tek tıkla Hoş Geldiniz Maili yollar." }
        ]
      },
      {
        tabTitle: "Modül 2: Abone Grupları & Kuralları Toplu Güncelleme",
        badge: "Toplu Konfigürasyon 2/4",
        screenshot: { src: "/screenshots/tabs/modals/bulk-subgroups.jpg", caption: "Toplu Konfigürasyon → Abone Grupları & Kuralları toplu düzenleme ekranı", routeHint: "Toplu Konfigürasyon → Abone Grupları" },
        description: "Abone gruplarının dış arama yetkilerini, gruplar arası iç arama izinlerini ve uluslararası arama politikasını toplu günceller.",
        fields: [
          { name: "Dış Hat Kuralı, İç Arama İzni & Uluslararası Arama Yetkisi", type: "Grup Politikası", defaultVal: "Tek Tık", required: false, effect: "Seçilen gruplardaki tüm kullanıcıların ses kaydı, çaldırma süresi ve dış arama haklarını tek işlemde eşitler." }
        ]
      },
      {
        tabTitle: "Modül 3: ACD Arama Kuyrukları Toplu Konfigürasyon",
        badge: "Toplu Konfigürasyon 3/4",
        screenshot: { src: "/screenshots/tabs/modals/bulk-queues.jpg", caption: "Toplu Konfigürasyon → ACD Arama Kuyrukları — Strateji, RONA, ACW, Smart Callback ve Anket toplu ayarları", routeHint: "Toplu Konfigürasyon → ACD Kuyrukları" },
        description: "Birden fazla çağrı kuyruğunun dağıtım stratejisini, RONA kopma korumasını, anonslarını ve memnuniyet anketini tek seferde günceller.",
        fields: [
          { name: "Hızlı Şablonlar & Kuyruk Politikası", type: "Strateji / Çaldırma / ACW / Maks. Mola / RONA / Smart Callback / CSAT / Meşgulü Çaldır", defaultVal: "Undo Korumalı", required: false, effect: "Örn. tek tıkla tüm kuyruklarda 'Sırayla Hatırlamalı (rrmemory) & 20sn Çaldırma' veya 'RONA Aç' şablonunu uygular." }
        ]
      },
      {
        tabTitle: "Modül 4: Giden Arama Kuralları Toplu Güncelleme & Tek Tıkla Geri Al (Undo)",
        badge: "Toplu Konfigürasyon 4/4",
        screenshot: { src: "/screenshots/tabs/modals/bulk-outbound.jpg", caption: "Toplu Konfigürasyon → Giden Arama Kuralları — Toplu SIP Trunk, CallerID, PIN ve İşlem Geçmişi (Undo)", routeHint: "Toplu Konfigürasyon → Giden Arama Kuralları" },
        description: "Operatör değişikliğinde tüm giden arama rotalarının Trunk, CallerID ve PIN politikasını saniyeler içinde taşır.",
        fields: [
          { name: "Dış Hat (Trunk), CallerID Override, PIN & İşlem Geçmişi (Undo)", type: "Snapshot Rollback", defaultVal: "Her işlem kayıtlı", required: false, effect: "Hatalı toplu işlem yapılırsa İşlem Geçmişi listesinden tek tıkla eski haline döndürülür." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere: Son Uygulanan Toplu Konfigürasyonlar & Tek Tıkla Geri Al (Undo Çekmecesi)",
        badge: "Toplu Konfigürasyon → Geçmiş & Undo",
        screenshot: { src: "/screenshots/tabs/deep/bulk-history-drawer.jpg", caption: "Toplu Konfigürasyon → 'İşlem Geçmişi & Geri Al' paneli ve Hızlı İşlem Şablonları", routeHint: "Santral → Toplu Konfigürasyon → İşlem Geçmişi & Geri Al" },
        description: "Sağ üstteki 'İşlem Geçmişi & Geri Al' butonuna basıldığında açılan ve geçmişte uygulanan tüm toplu değişiklikleri etkilenen kayıt sayısıyla birlikte tek tıkla geri almanızı (Undo) sağlayan denetim çekmecesidir.",
        fields: [
          { name: "İşlem Özeti, Tarih/Saat, Uygulayan Yönetici & Etkilenen Kayıt Sayısı", type: "Değiştirilemez Snapshot Listesi", defaultVal: "Otomatik Kaydedilir", required: false, effect: "Uygulama öncesinde tüm hedef kayıtların önceki JSON değerlerini saklar." },
          { name: "Tek Tıkla Geri Al (Rollback) & Hızlı İşlem Şablonları", type: "Ses Kaydı / Yönlendirme Sıfırla / Karantina Kaldır", defaultVal: "Anında Asterisk Sync", required: false, effect: "Yanlışlıkla tüm abonelerin yönlendirmesi veya kaydı değiştirildiyse tek tıkla önceki değerlere döner ve Asterisk yapılandırmasını yeniden yazar." }
        ]
      }
    ]
  },
  "rehber": {
    editFormSections: [
      {
        tabTitle: "Yeni Kişi Ekle / Kişi Düzenle, Rehber Defterleri & Voiceprint",
        badge: "Rehber Formu",
        screenshot: { src: "/screenshots/tabs/modals/contact-edit.jpg", caption: "Rehber → Yeni Kişi Ekle / Düzenle penceresi", routeHint: "Santral → Rehber → +" },
        description: "Kurumsal müşteri kartı oluşturma, rehber defteri atama ve esnek son 10 hane eşleşmesi.",
        fields: [
          { name: "Ad Soyad, Telefon, Şirket, E-Posta & Notlar", type: "Son 10 Hane Eşleşmeli", defaultVal: "Zorunlu", required: true, effect: "Gelen çağrı, WhatsApp ve IP telefon XML rehberinde müşteri adını otomatik gösterir." },
          { name: "Rehber Defteri (Phonebook) & Biyometrik Ses İmzası", type: "Grup + Voiceprint", defaultVal: "Genel Rehber", required: false, effect: "Farklı departmanlara özel rehber defterleri ve ses tanıma imzası bağlanabilir." }
        ]
      }
    ]
  },
  "dis-hat-tanimi": {
    editFormSections: [
      {
        tabTitle: "Sekme 1: Genel (Hat Tipi, Host/Port, Kimlik, Transport, /30 VLAN & İç Santral Transit)",
        badge: "Dış Hat Düzenle 1/4",
        screenshot: { src: "/screenshots/tabs/trunks/01-genel.jpg", caption: "Dış Hat Düzenle → Sekme 1: Genel Bağlantı Parametreleri, /30 VLAN Policy Routing ve Transit Trunk Modu", routeHint: "Dış Hat Tanımı → Düzenle → Genel" },
        description: "Operatör SIP Trunk'ının temel kayıt/IP kimlik bilgileri, taşıma protokolü, çoklu /30 Metro VLAN anahtarı ve diğer santral bağlantısı (Transit Gateway).",
        fields: [
          { name: "İsim, Durum (Aktif/Pasif) & Dış Hat Tipi", type: "Register (Operatöre Kayıt) / IP-Auth (Sabit IP) / Peer", defaultVal: "Register", required: true, effect: "0850 bulut operatörlerde Register, Türk Telekom/Superonline Metro Ethernet hatlarda IP-Auth seçilir." },
          { name: "Host IP, Port, Kullanıcı Adı, SIP Şifresi, Transport & Görünür Numara (DID)", type: "UDP / TCP / TLS + E.164", defaultVal: "5060 / UDP", required: true, effect: "PJSIP registration, auth, aor ve endpoint bloklarını otomatik üretir." },
          { name: "Operatör /30 VLAN & Özel Çıkış IP Yönlendirmesi (Policy Routing)", type: "5 Alanlı Linux Table 201+", defaultVal: "Kapalı", required: false, effect: "Aynı operatör SBC'sine giden çoklu /30 hatlarda: (1) VLAN/NIC Interface, (2) Yerel IP/CIDR (/30), (3) Hat Gateway, (4) SBC/Media Subnet, (5) Ek DID Blokları otomatik yönlendirilir." },
          { name: "İç Santral / Transit Trunk Modu (SIP Gateway)", type: "Toggle", defaultVal: "Kapalı", required: false, effect: "Avaya, Cisco CUCM, Karel, Grandstream veya şube santralleriyle doğrudan dahili-to-dahili köprü kurar." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Görünüm 1.1: Operatör /30 VLAN Policy Routing (5 Alan) & İç Santral Transit Trunk Açık Görünümü",
        badge: "Dış Hat → /30 VLAN & Transit Açık",
        screenshot: { src: "/screenshots/tabs/toggled/trunk-vlan-transit-expanded.jpg", caption: "Dış Hat Düzenle → Operatör /30 VLAN Policy Routing (5 alan) ve İç Santral / Transit Trunk Modu (SIP Gateway) aktif görünümü", routeHint: "Dış Hat Tanımı → Düzenle → Genel → Policy Routing Aktif" },
        description: "Türk Telekom, Superonline veya Vodafone gibi operatörlerden aynı sunucuya birden fazla Metro Ethernet /30 VLAN ses hattı bağlandığında açılan 5 alanlı Linux Policy Routing yapılandırmasıdır.",
        fields: [
          { name: "1. Ağ Kartı / VLAN Arayüzü (Interface)* & 2. Santral Yerel IP / CIDR (/30)*", type: "Örn. ens192 / eth0.100 + 10.87.1.5/30", defaultVal: "Otomatik NIC", required: true, effect: "Operatör kurulum tablosunda bu hat için santrale verilen /30 IP adresini ilgili fiziksel veya VLAN alt arayüzüne otomatik ekler." },
          { name: "3. Hat Gateway (GW) Adresi* & 4. Operatör SBC & Media Rota Blokları (Subnet)", type: "Örn. 10.87.1.4 + 10.99.1.0/24", defaultVal: "Linux Table 201+", required: true, effect: "Sunucunun ana Default Gateway'ini bozmadan bu /30 hattın tüm SIP ve RTP ses paketlerini kendi özel Linux yönlendirme tablosundan geçirir." },
          { name: "5. Ek DID Eşleştirme Blokları (Opsiyonel) & İç Santral / Transit Trunk Modu", type: "Örn. 0212555, 90212555 + SIP Gateway Toggle", defaultVal: "Aynı SBC Çoklu Hat", required: false, effect: "Aynı operatör SBC IP'sinden gelen birden fazla /30 DID bloğunu kesin ayırt eder; Transit Trunk diğer PBX'lerle doğrudan dahili geçişi sağlar." }
        ]
      },
      {
        tabTitle: "Sekme 2: Dakika Paketi (Aylık Kota, Fatura Sıfırlama Günü & Ücretlendirme Periyodu)",
        badge: "Dış Hat Düzenle 2/4",
        screenshot: { src: "/screenshots/tabs/trunks/02-dakika-paketi.jpg", caption: "Dış Hat Düzenle → Sekme 2: Aylık Dakika Paketi, Sıfırlama Günü ve Ücretlendirme Periyodu", routeHint: "Dış Hat Tanımı → Düzenle → Dakika Paketi" },
        description: "Operatörünüzden aldığınız aylık dakika paketini tanımlayarak kalan dakika ve aşım takibini otomatikleştirir.",
        fields: [
          { name: "Aylık Paket Dakikası (dk), Yenilenme Günü (1–28) & Ücretlendirme Periyodu", type: "Integer + 1sn / 6sn / 60sn", defaultVal: "60 sn", required: false, effect: "Operatör Dakika & Paket Raporu'nda canlı tüketim yüzdesini ve kalan dakikayı hesaplar." }
        ]
      },
      {
        tabTitle: "Sekme 3: Gelişmiş (9 Kodek Önceliği, Max Eşzamanlı Çağrı, DTMF & Yön Kısıtlama)",
        badge: "Dış Hat Düzenle 3/4",
        screenshot: { src: "/screenshots/tabs/trunks/03-gelismis.jpg", caption: "Dış Hat Düzenle → Sekme 3: Ses/Video Kodek Önceliği, Maksimum Eşzamanlı Çağrı ve Arama Yönü", routeHint: "Dış Hat Tanımı → Düzenle → Gelişmiş" },
        description: "Ses/video kodek sıralaması, sözleşmeli kanal kapasitesi ve arama yönü kısıtlamaları.",
        fields: [
          { name: "Kodek Sırası", type: "alaw, ulaw, g722, g729, opus, gsm, ilbc, h264, vp8", defaultVal: "alaw, ulaw", required: true, effect: "Türkiye'de tüm PSTN/GSM operatörleriyle sorunsuz ses için G.711 A-Law (alaw) ilk sırada olmalıdır." },
          { name: "Maksimum Eş Zamanlı Çağrı & Giden/Gelen Arama Yönü", type: "Integer + Çift Yön / Sadece Gelen / Sadece Giden", defaultVal: "30 kanal / Çift Yön", required: false, effect: "Kanal tavanı dolduğunda yeni çağrılar Giden Arama Kuralındaki 2. yedek Trunk'a taşar." }
        ]
      },
      {
        tabTitle: "Sekme 4: SIP Başlıkları (PAI, RPID, Diversion, From-User & Özel PJSIP Başlıkları)",
        badge: "Dış Hat Düzenle 4/4",
        screenshot: { src: "/screenshots/tabs/trunks/04-sip-basliklari.jpg", caption: "Dış Hat Düzenle → Sekme 4: Gelen ve Giden PJSIP Başlık (Header) Eşleştirme Kuralları", routeHint: "Dış Hat Tanımı → Düzenle → SIP Başlıkları" },
        description: "Operatör SBC'sinin CallerID ve yönlendirilmiş çağrı kimliği için beklediği P-Asserted-Identity, Remote-Party-ID ve Diversion başlıkları.",
        fields: [
          { name: "Arayan Numara (Outbound) & Aranan Numara (Inbound) Başlık Kaynağı", type: "PAI / RPID / From / To / Diversion", defaultVal: "Otomatik", required: false, effect: "Farklı operatörlerin özel SIP header beklentilerini kod değiştirmeden arayüzden karşılar." }
        ]
      }
    ]
  },
  "konferans": {
    editFormSections: [
      {
        tabTitle: "Konferans Odası Ekle / Düzenle (PIN, Dahili/Harici Katılımcılar & Ses Kaydı)",
        badge: "ConfBridge Düzenle",
        screenshot: { src: "/screenshots/tabs/modals/conference-edit.jpg", caption: "Konferans Odaları → Konferans Odası Düzenle penceresi", routeHint: "Santral → Konferans → Düzenle" },
        description: "Toplantı oda numarası, katılımcı/moderatör PIN, tek tıkla aranacak dahili/harici katılımcılar ve ses kaydı.",
        fields: [
          { name: "Oda Numarası, Oda Adı, PIN & Moderatörü Bekle", type: "3000+ / 4–8 Hane PIN", defaultVal: "3000", required: true, effect: "ConfBridge odasını oluşturur; moderatör gelene kadar bekleme müziği çalabilir." },
          { name: "Eklenecek Dahili & Harici Numaralar + Ses Kaydı", type: "Dial-Out + WAV Kayıt", defaultVal: "Kayıt Açık", required: false, effect: "Toplantı başlatıldığında tüm katılımcıları otomatik arar ve görüşmeyi kaydeder." }
        ]
      }
    ]
  },
  "hizli-arama": {
    editFormSections: [
      {
        tabTitle: "Hızlı Arama (Speed Dial) Ekle / Düzenle",
        badge: "Kısa Kod Düzenle",
        screenshot: { src: "/screenshots/tabs/modals/speed-dial-edit.jpg", caption: "Hızlı Arama → Hızlı Arama Düzenle penceresi — Kısa kod, uzun numara ve açıklama", routeHint: "Santral → Hızlı Arama → Düzenle" },
        description: "Sık aranan numaralara kısa tuşlama kodu tanımlama penceresi.",
        fields: [
          { name: "Kısa Kod, Uzun Numara & Açıklama", type: "Örn. *01 → 0212...", defaultVal: "Zorunlu", required: true, effect: "Hem masa telefonlarında hem Temsilci Çağrı Paneli'nde anında aktif olur." }
        ]
      }
    ]
  },
  "numara-engelleme": {
    editFormSections: [
      {
        tabTitle: "Kara Liste Kaydı & Yasaklı Kelime / Cümle Ekleme Formu",
        badge: "Engelleme Düzenle",
        screenshot: { src: "/screenshots/tabs/modals/blacklist-edit.jpg", caption: "Numara Engelleme → Engellenen Kaydı Düzenle (Telefon / E-Posta & Gerekçe)", routeHint: "Santral → Numara Engelleme → Düzenle" },
        description: "İstenmeyen telefon numarası, spam e-posta ve AI suistimal filtresi yasaklı ifadelerini düzenleme.",
        fields: [
          { name: "Engel Türü (Telefon / E-Posta), Değer & Engelleme Nedeni", type: "phone / email + Gerekçe", defaultVal: "phone", required: true, effect: "Çağrıyı veya e-postayı daha girişte keser ve İhlal Raporu'na işler." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere: Yasaklı Kelime / Cümle Ekleme Modalı (AI Suistimal & Otomatik Kapatma)",
        badge: "Kara Liste → Yasaklı Kelimeler",
        screenshot: { src: "/screenshots/tabs/deep/blacklist-word-modal.jpg", caption: "Numara Engelleme → Yasaklı Kelimeler → '+' Yasaklı Kelime/Cümle Ekle penceresi", routeHint: "Santral → Numara Engelleme → Yasaklı Kelimeler → +" },
        description: "Sesli AI görüşmelerinde ve yazılı Omnichannel sohbetlerinde hakaret, dolandırıcılık veya şirket politikasına aykırı ifadeler tespit edildiğinde anında uyarı veya otomatik sonlandırma tetikleyen sözlük penceresidir.",
        fields: [
          { name: "Yasaklanacak İfade (Kelime veya Cümle)", type: "Türkçe Büyük/Küçük Harf Duyarsız", defaultVal: "block_words", required: true, effect: "Canlı konuşma dökümünde veya WhatsApp mesajında bu ifade geçtiği anda olay İhlal Raporu'na kaydedilir, yöneticilere E-Mail/WhatsApp uyarısı gidebilir ve AI görüşmeyi güvenle kapatabilir." }
        ]
      }
    ]
  },
  "zamanlanmis-raporlar": {
    editFormSections: [
      {
        tabTitle: "Zamanlanmış Rapor Ekle / Düzenle & Gönderim Günlüğü",
        badge: "Rapor Zamanlayıcı",
        screenshot: { src: "/screenshots/tabs/modals/scheduled-report-edit.jpg", caption: "Zamanlanmış Raporlar → Yeni Zamanlanmış Rapor Ekle penceresi", routeHint: "Santral → Zamanlanmış Raporlar → +" },
        description: "Periyodik e-posta rapor görevi tanımlama ve anlık test gönderimi.",
        fields: [
          { name: "Rapor Başlığı, Sıklık, Gönderim Saati (TR), Veri Dönemi & Alıcılar", type: "Günlük/Haftalık/Aylık + PDF/CSV", defaultVal: "08:30 TR", required: true, effect: "Belirlenen saatte raporu derleyip tüm alıcılara e-posta atar; 'Şimdi Çalıştır' ile anında test edilir." }
        ]
      }
    ]
  },
  "arama-akis-yonetimi": {
    editFormSections: [
      {
        tabTitle: "CallFlow Düğüm Türleri (12 Düğüm: Mesai, IVR, TTS, WhatsApp, API, Koşul, Döngü, AI, Portal)",
        badge: "Görsel Düğümler",
        description: "Arama Akış Editöründe tuvale sürüklenen tüm düğümlerin sağ paneldeki yapılandırma parametreleri.",
        fields: [
          { name: "Akış Başlangıcı, Mesai & Tatil Kontrolü (active / inactive / holiday)", type: "Kök + 3 Çıkış", defaultVal: "Mesai Takvimi", required: true, effect: "Gelen çağrıyı Mesai Saatleri, Mesai Dışı ve Resmi Tatil kollarına ayırır." },
          { name: "IVR Tuşlama (DTMF #), Dinamik Anons (recorded / tts) & WhatsApp Gönder", type: "Değişken Atamalı + WhatsApp", defaultVal: "output / error", required: false, effect: "Müşteriden tuşlama toplar, dinamik TTS okur veya arayan numaraya anında WhatsApp mesajı gönderir." },
          { name: "API Sorgu, Koşul (If/Else), Döngü (Loop), Gemini AI, Geçit (Portal) & Hedef", type: "success/error, true/false, loop/completed", defaultVal: "Dinamik", required: false, effect: "Dış ERP'den VIP/borç sorgulayıp dallandırır, Gemini AI'a bağlam aktarır veya Kuyruk/Dahili/Voicemail'e yönlendirir." },
          { name: "Canlı Akış Simülatörü (Test Aracı)", type: "Arayan CID + DID + DTMF", defaultVal: "/api/settings/call-flow/simulate", required: false, effect: "Telefon aramadan verdiğiniz senaryoyu adım adım canlandırır." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 1: CallFlow Düğüm Yapılandırma Modalı (DTMF, API Değişkeni, Koşul & WhatsApp)",
        badge: "CallFlow → Düğüm Düzenle",
        description: "Kanvastaki herhangi bir düğüme çift tıklandığında açılan ve o düğümün çalışma mantığını, değişken adını ve çıkış dallarını ayrıntılı düzenleyen 3. seviye penceredir.",
        fields: [
          { name: "Mesai & Tatil Kontrolü (working_hours)", type: "Takvim Seçici → active / inactive / holiday", defaultVal: "Varsayılan Mesai", required: false, effect: "Gelen çağrıyı hafta içi mesai, mesai dışı ve resmi tatil kollarına milisaniyeler içinde ayırır." },
          { name: "IVR Tuşlama (ivr) & Dinamik Anons (audio / tts)", type: "Ses Dosyası / AI TTS + Tuş Listesi (1–9, *, #) + Timeout & Hatalı Tuş Limiti", defaultVal: "3 Tekrar / 5 sn", required: false, effect: "Müşterinin bastığı rakamları (örn. TC/Sipariş No) değişkene atar veya ilgili tuş koluna yönlendirir." },
          { name: "Harici API Sorgu (api_call) & Koşul (condition — If/Else)", type: "GET/POST URL + JSONPath Değişkeni + ==, !=, >, contains", defaultVal: "success / error + true / false", required: false, effect: "Örn. ERP'den müşterinin VIP statüsünü veya borç durumunu çekip true/false kollarına dallandırır." },
          { name: "WhatsApp Mesaj Gönder, Gemini AI & Geçit (Portal)", type: "Anlık Şablon / AI Asistan + Bağlam Aktarımı / Başka Akışa Atla", defaultVal: "Dinamik Değişkenli", required: false, effect: "Arayan cep numarasına konum/link WhatsApp mesajı atar veya toplanan değişkenleri Gemini AI asistanına bağlam olarak aktarır." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 2: Canlı Arama Akışı Simülatörü ('Akışı Test Et')",
        badge: "CallFlow → Simülatör",
        description: "Üst araç çubuğundaki yeşil 'Akışı Test Et (Simülatör)' butonuna basıldığında açılan ve gerçek bir telefon araması yapmadan tüm dalları kanvas üzerinde canlı yeşille izlemenizi sağlayan test penceresidir.",
        fields: [
          { name: "Test Arayan Numara (CID), Aranan DID, Simüle Tarih/Saat & DTMF Dizisi", type: "Örn. 0532... + 90850... + 1,2", defaultVal: "POST /api/settings/call-flow/simulate", required: true, effect: "Mesai içi/dışı veya resmi tatil saatini taklit ederek çağrının hangi düğümlerden geçip hangi hedefe ulaşacağını adım adım raporlar ve kanvas üzerinde görsel iz bırakır." }
        ]
      }
    ]
  },
  "mesai-ve-resmi-tatiller": {
    editFormSections: [
      {
        tabTitle: "8 Bölge Saat Dilimi, Haftalık Mesai & Resmi/Özel Tatil Ekleme",
        badge: "Takvim Düzenle",
        description: "Haftalık açılış-kapanış saatleri, arife yarım gün tanımları ve Türkiye resmi/dini tatil takvimi.",
        fields: [
          { name: "Saat Dilimi, Günlük Başlangıç/Bitiş & Özel Tatil Ekle", type: "Europe/Istanbul + Tarih Aralığı + Yarım Gün", defaultVal: "Pzt–Cum 09:00–18:00", required: true, effect: "Hem CallFlow hem WhatsApp mesai dışı otomatik yanıtlayıcısı tarafından ortak kullanılır." }
        ]
      }
    ]
  },
  "dis-arama-dialer": {
    editFormSections: [
      {
        tabTitle: "Dış Arama Kampanyası Ekle / Düzenle (Kanal Hızı, Retry, Hedef & Saat Penceresi)",
        badge: "Kampanya Düzenle",
        screenshot: { src: "/screenshots/tabs/modals/dialer-edit.jpg", caption: "Dış Arama (Dialer) → Kampanya Ayarlarını Düzenle penceresi", routeHint: "Dış Arama (Dialer) → Düzenle" },
        description: "Otomatik dış arama kampanyasının çıkış hattı, eşzamanlı kanal hızı, tekrar deneme, AI/Kuyruk hedefi ve CSV numara listesi.",
        fields: [
          { name: "Kampanya Adı, Çıkış Hattı (Trunk), Eşzamanlı Arama Limiti, Tekrar Deneme & Aralığı (dk)", type: "Concurrency + Retry + Delay", defaultVal: "3 kanal / 2 deneme / 30 dk", required: true, effect: "Lisans ve operatör kanal limitini aşmadan kontrollü hızda arama yapar." },
          { name: "Yanıtlandığında Hedef, Yasal Başlangıç–Bitiş Saati & Numara Listesi", type: "AI Temsilci / Kuyruk / Anons + CSV", defaultVal: "09:30–18:30", required: true, effect: "Müşteri açtığında seçilen AI asistana veya kuyruğa bağlar; pencere dışında otomatik bekler." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere: Telefon Listesi Yükle Modalı (Kampanya Numara Havuzu İçe Aktarma)",
        badge: "Dialer → Numara Yükle",
        screenshot: { src: "/screenshots/tabs/deep/dialer-upload-modal.jpg", caption: "Dış Arama (Dialer) → 'Numara Listesi Yükle' (Upload ikonu): Her satıra numara veya 'Numara, İsim' formatında toplu liste ekleme", routeHint: "Dış Arama (Dialer) → Kampanya Satırı → Numara Listesi Yükle" },
        description: "Mevcut bir dış arama kampanyasına saniyeler içinde yüzlerce veya binlerce aranacak telefon numarası ve müşteri adı ekleyen alt penceredir.",
        fields: [
          { name: "Telefon Numaraları (Her Satıra Bir Numara veya 'Numara, İsim')", type: "Çok Satırlı Liste / CSV Yapıştır", defaultVal: "05321002030, Ahmet Yılmaz", required: true, effect: "Müşteri adı birlikte verildiğinde AI Sesli Asistan müşteriye ismiyle hitap edebilir; hatalı/boş satırlar otomatik temizlenir ve kara listedeki numaralar aranmaz." }
        ]
      }
    ]
  },
  "randevu-takvimi": {
    editFormSections: [
      {
        tabTitle: "Randevu Ekle / Düzenle & AI Otomatik Randevu Kartı",
        badge: "Takvim Detay",
        description: "AI Asistan, WhatsApp veya temsilcilerin oluşturduğu randevuların yönetimi.",
        fields: [
          { name: "Müşteri Adı, Telefon, Tarih/Saat, Durum & Kaynak Rozeti", type: "Bekliyor / Onaylandı / Tamamlandı / İptal", defaultVal: "Onaylandı", required: true, effect: "Tek tıkla geri arama ve AI Randevu Raporu dönüşüm takibi sağlar." }
        ]
      }
    ]
  }
};
