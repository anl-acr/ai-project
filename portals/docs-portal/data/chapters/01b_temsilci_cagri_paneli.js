// Temsilci Çağrı Paneli (Agent Workspace) — Son Kullanıcı & Temsilci Rehberi (11 Ayrı Sayfa)
export const CHAPTERS_TEMSILCI_PANELI = [
  {
    id: "temsilci-cagri-paneli",
    number: "04",
    groupId: "temsilci-paneli",
    category: "Temsilci Çağrı Paneli",
    title: "Temsilci Çağrı Paneli: Genel Bakış, Oturum Giriş/Çıkış & Mola Yönetimi",
    shortTitle: "Oturum & Mola Yönetimi",
    menuPath: "Temsilci Çağrı Paneli → Sol Alt 'Temsilci Oturumu' Kartı",
    pbxRoute: "/?tab=cagri-merkezi",
    permissions: ["call_panel:access", "call_panel:tab_dashboard", "call_panel:tab_webphone"],
    badge: "Temsilci Rehberi 1/11 • Login • Mola & Onay",
    readMinutes: 9,
    summary:
      "Çağrı merkezi temsilcilerinin ve tüm şirket çalışanlarının gün boyu kullandığı 10 sekmeli çalışma alanının ana giriş rehberidir. Sol alttaki 'Temsilci Oturumu' kartından kuyruk oturumu açma (Sistem Girişi Yap), Müsait / Mola geçişleri, canlı mola kronometresi, Kuyruk Maksimum Eşzamanlı Mola engeli ve Süpervizör Mola Onay Talebi akışını ayrıntılı olarak anlatır.",
    prerequisites: [
      "Kullanıcı hesabınıza bir dahili numara atanmış ve rolünüzde 'call_panel:access' yetkisi aktif olmalıdır.",
      "Tarayıcıda mikrofon izni verilmiş ve sağ alttaki 'Web Telefon (Dahili)' rozetinin yeşil (Çevrimiçi) olduğu doğrulanmış olmalıdır."
    ],
    screenshots: [
      {
        src: "/screenshots/tabs/call-panel/active/01-session-mola-dropdown.jpg",
        caption: "Temsilci Çağrı Paneli — Sol menü 10 sekme ve 'Temsilci Oturumu' kartında Mola Durumları (Yemek, İhtiyaç, Eğitim, Toplantı) açılır menüsü",
        routeHint: "Temsilci Çağrı Paneli → Temsilci Oturumu → Mola Durumları"
      }
    ],
    fieldTable: [
      { field: "Sistem Girişi Yap / Çıkış Yap (Kuyruk Login/Logout)", type: "Tek Tık Oturum Anahtarı", defaultVal: "Vardiya Başlangıcı", required: true, description: "Mesai başlangıcında 'Sistem Girişi Yap' butonuna basıldığında temsilci üye olduğu ACD kuyruklarına dahil olur ve çağrı almaya başlar. Mesai sonunda çıkış yapıldığında puantaj kaydı kapatılır." },
      { field: "Müsait (Available) Durumu", type: "Yeşil Durum Rozeti", defaultVal: "Kuyruk Aktif", required: false, description: "Kuyruk çağrılarının otomatik olarak bu temsilciye yönlendirildiği aktif çalışma durumudur." },
      { field: "Mola Durumları (Yemek / İhtiyaç / Eğitim / Toplantı)", type: "Açılır Menü + Canlı Kronometre", defaultVal: "agent_break_logs", required: false, description: "Mola seçildiğinde kuyruk çağrıları anında duraklatılır (Queue Pause), canlı mola sayacı başlar ve süre saniye hassasiyetinde puantaja işlenir." },
      { field: "Kuyruk Eşzamanlı Mola Limiti & Süpervizör Onay Talebi", type: "Otomatik Kota + İstek Modalı", defaultVal: "Kuyruk Bazlı", required: false, description: "Kuyrukta izin verilen maksimum kişi sayısı halihazırda moladaysa sistem molayı engeller; temsilci açıklama yazarak 'Süpervizörden Mola Onayı İste' talebi gönderebilir." },
      { field: "Çağrı Sonrası İşlem (ACW) Geri Sayımı", type: "Otomatik Wrap-Up", defaultVal: "Kuyruk ACW Süresi", required: false, description: "Kuyruk çağrısı bittiğinde temsilciyi belirli süre (örn. 20 sn) meşgul tutarak not ve sonuç kodu girmesine imkan tanır; süre bitince otomatik Müsait'e döner." }
    ],
    editFormSections: [
      {
        level: 3,
        tabTitle: "Molada Görünümü: Canlı Mola Kronometresi & 'Molayı Bitir (Müsait)'",
        badge: "Temsilci Oturumu → Molada",
        screenshot: { src: "/screenshots/tabs/call-panel/active/01b-session-molada-sayac.jpg", caption: "Temsilci Oturumu — Aktif mola (Yemek Molası) canlı geçen süre sayacı ve tek tıkla Müsait'e dönüş butonu", routeHint: "Temsilci Çağrı Paneli → Temsilci Oturumu (Molada)" },
        description: "Mola seçildiğinde sol alttaki Temsilci Oturumu kartı mola rengine döner, geçen süreyi saniye saniye sayar ve günlük mola limiti aşılırsa uyarı gösterir.",
        fields: [
          { name: "Canlı Mola Kronometresi & 'Müsait Durumuna Dön'", type: "MM:SS Sayaç + Tek Tık", defaultVal: "Canlı", required: false, effect: "Butona basıldığında mola oturumu kapatılır, süre PostgreSQL agent_break_logs tablosuna kaydedilir ve kuyruk çağrıları yeniden başlar." },
          { name: "10 Sekmeli Çalışma Alanı Hızlı Haritası", type: "Pano • Web Telefon • Temsilciler • Hızlı Arama • Kayıp Çağrı • Rehber • Çağrı Geçmişi • Sesli Posta • Sohbet • Masa Telefonum", defaultVal: "Granüler Rol Yetkili", required: false, effect: "Sol menüdeki her sekme bu kılavuzda kendine ait ayrı bir sayfada en ince detayına kadar anlatılmıştır." }
        ]
      }
    ],
    sections: [
      {
        heading: "1. Bir Temsilcinin Örnek Günlük Çalışma Akışı",
        body: "Sabah oturum açmaktan akşam çıkış yapmaya kadar tüm adımlar tek ekranda ilerler:",
        steps: [
          "Sisteme giriş yapın, sağ alttaki yeşil 'Web Telefon (Dahili)' durumunu kontrol edin ve sol alttan 'Sistem Girişi Yap' butonuna tıklayın.",
          "Gelen çağrıları 'Web Telefon' sekmesinden yanıtlayın; çağrı bitiminde ACW süresinde not ve sonuç kodunu kaydedin.",
          "Molaya çıkarken 'Mola Durumları' menüsünden uygun mola nedenini (Yemek, İhtiyaç vb.) seçin; dönüşte 'Müsait'e geçin.",
          "Kayıp Çağrı ve Sesli Posta sekmelerindeki kırmızı bildirim rozetlerini kontrol edip bekleyen müşterilere geri dönüş yapın.",
          "Mesai bitiminde 'Çıkış Yap' ile kuyruk oturumunu kapatın ve sağ üst Avatar menüsünden güvenli çıkış yapın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Mola seçtiğimde 'Kuyruk mola kotası dolu' uyarısı çıkıyor", cause: "Bağlı olduğunuz kuyrukta aynı anda molada olabilecek maksimum kişi sayısına ulaşılmış.", solution: "Açılan kutucuğa kısa mazeretinizi yazıp 'Süpervizörden Onay İste' butonuna basın; süpervizör onayladığında molanız otomatik başlar." },
      { problem: "Sol menüde bazı sekmeler (örn. Masa Telefonum veya Temsilciler) görünmüyor", cause: "Rol ayarınızda ilgili call_panel:tab_* yetkisi kapalı.", solution: "Sistem yöneticinizden Sistem Ayarları → Roller ekranından ilgili sekme yetkisini açmasını isteyin." }
    ],
    relatedPages: [
      "cagri-paneli-pano",
      "cagri-paneli-web-telefon-aktif-cagri",
      "cagri-paneli-temsilciler",
      "cagri-paneli-hizli-arama",
      "cagri-paneli-kayip-cagri",
      "cagri-paneli-rehber",
      "cagri-paneli-cagri-gecmisi",
      "cagri-paneli-sesli-posta",
      "cagri-paneli-sohbet",
      "cagri-paneli-masa-telefonum",
      "kisisel-profil-ve-ust-cubuk"
    ],
    relatedApis: ["POST /api/agent/status", "GET /api/agent/stats", "POST /api/v1/extensions/{extension}/status"]
  },
  {
    id: "cagri-paneli-pano",
    number: "05",
    groupId: "temsilci-paneli",
    category: "Temsilci Çağrı Paneli",
    title: "Çağrı Paneli — Sekme 1: Pano (Günlük Performans & Mola Sayaçları)",
    shortTitle: "1. Pano (Performans)",
    menuPath: "Temsilci Çağrı Paneli → Pano",
    pbxRoute: "/?tab=cagri-merkezi",
    permissions: ["call_panel:tab_dashboard"],
    badge: "Temsilci Rehberi 2/11 • 00:00 Sıfırlama",
    readMinutes: 5,
    summary:
      "Temsilcinin o günkü kişisel gelen, giden ve cevapsız çağrı adetlerini, çağrı yön dağılım grafiğini, mola türlerine göre kullandığı toplam dakikaları ve gün içi mola hareketlerinin saatlik dökümünü gösteren kişisel performans kokpitidir.",
    screenshots: [
      {
        src: "/screenshots/tabs/call-panel/01-pano.jpg",
        caption: "Temsilci Çağrı Paneli → Sekme 1: Pano — Bugünkü çağrı dağılımı, mola süreleri ve gün içi mola hareketleri",
        routeHint: "Temsilci Çağrı Paneli → Pano"
      }
    ],
    fieldTable: [
      { field: "Günlük Çağrı Sayaçları (Gelen / Giden / Cevapsız)", type: "Canlı KPI Kartları", defaultVal: "00:00 UTC+3 Sıfırlama", required: false, description: "Her gece Türkiye saati 00:00:00 itibarıyla otomatik sıfırlanarak yalnızca bugünkü kişisel trafiğinizi gösterir." },
      { field: "Çağrı Dağılımı Grafiği", type: "Gelen / Giden / Kaçan %", defaultVal: "Canlı", required: false, description: "Gün içinde cevapladığınız ve kaçırdığınız çağrı dengesini görselleştirir." },
      { field: "Mola Dağılımı & Süreler", type: "Yemek / İhtiyaç / Eğitim / Toplantı (dk)", defaultVal: "agent_break_logs", required: false, description: "Her mola türünde bugün toplam kaç dakika harcadığınızı ve günlük limite ne kadar yaklaştığınızı gösterir." },
      { field: "Bugünkü Mola Hareketleri", type: "Başlangıç / Bitiş / Süre Listesi", defaultVal: "Kronolojik", required: false, description: "Gün içinde hangi saatte hangi molaya çıkıp döndüğünüzü şeffaf biçimde listeler." }
    ],
    sections: [
      {
        heading: "1. Günlük Hedef ve Mola Bütçesi Takibi",
        body: "Temsilciler süpervizöre sormadan gün içinde kaç çağrı karşıladıklarını ve ne kadar mola hakları kaldığını bu sekmeden anlık olarak takip edebilir.",
        steps: [
          "Sol menüden 'Pano' sekmesine tıklayın.",
          "Mola Dağılımı kartından Yemek ve İhtiyaç molası toplam sürenizi kontrol edin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Dünkü çağrı sayıları hala görünüyor mu?", cause: "Hayır — sayaçlar her gece 00:00 Türkiye saatinde (UTC+3) otomatik sıfırlanır.", solution: "Geçmiş günlerin dökümü için 'Çağrı Geçmişi' sekmesini kullanın." }
    ],
    relatedPages: ["temsilci-cagri-paneli", "cagri-paneli-cagri-gecmisi", "rapor-mola-puantaj"],
    relatedApis: ["GET /api/agent/stats"]
  },
  {
    id: "cagri-paneli-web-telefon-aktif-cagri",
    number: "06",
    groupId: "temsilci-paneli",
    category: "Temsilci Çağrı Paneli",
    title: "Çağrı Paneli — Sekme 2: Web Telefon & Tüm Aktif Çağrı Ekranları",
    shortTitle: "2. Web Telefon & Aktif Çağrı",
    menuPath: "Temsilci Çağrı Paneli → Web Telefon",
    pbxRoute: "/?tab=cagri-merkezi",
    permissions: [
      "call_panel:tab_webphone",
      "call_panel:webphone_transfer",
      "call_panel:webphone_conference",
      "call_panel:webphone_reject",
      "call_panel:call_flip",
      "call_panel:cti_screen_pop",
      "call_panel:live_translation",
      "call_panel:ai_note_assistant"
    ],
    badge: "Temsilci Rehberi 3/11 • Gelen • Aktif • Transfer • Konferans • ACW",
    readMinutes: 16,
    summary:
      "Temsilcinin tüm telefon görüşmelerini yönettiği ana merkezdir. Bu sayfa; boşta arama ekranından başlayarak Gelen Çağrı Çalarken, Aktif Görüşme, Sessize Al / Bekletme / *9 KVKK Kayıt Duraklatma / *11 Call Flip, Kör ve Danışmalı Transfer, 3'lü Konferans, Çift Hat, 6 Dilli Canlı Çeviri, Müşteri 360° (Alt+C) ve Çağrı Sonrası İşlem (ACW + AI Not + Sonuç Kodu) ekranlarının tamamını tek tek görselleriyle açıklar.",
    screenshots: [
      {
        src: "/screenshots/tabs/call-panel/02-webphone.jpg",
        caption: "Web Telefon Boşta (Idle) Görünümü — Tuş takımı, Web Telefon Hazır durumu, Son Görüşmeler ve Hızlı Rehber & Dahililer",
        routeHint: "Temsilci Çağrı Paneli → Web Telefon (Boşta)"
      }
    ],
    fieldTable: [
      { field: "1. Tuş Takımı (Dialpad), Hızlı Rehber & Son Görüşmeler", type: "Klavye + Fare + Tek Tık Ara", defaultVal: "Boşta & Görüşme İçi DTMF", required: false, description: "Boştayken numara çevirir veya sağdaki Son Görüşmeler / Hızlı Rehber listesinden tek tıkla arar; aktif görüşmedeyken karşı IVR/banka menülerine DTMF tuşlaması (1, 2, *, #) gönderir ve '2. Hat İçin Numara...' ile yeni hat açar." },
      { field: "2. Müşteri Bilgi Şeridi (Rehbere Ekle • 360° Kart Alt+C • CRM Aç)", type: "3 Hızlı Müşteri Aksiyonu", defaultVal: "Otomatik Eşleşme", required: false, description: "Numara rehberde yoksa 'Rehbere Ekle' çıkar; '360° Kart (Alt+C)' müşterinin geçmiş tüm çağrı/WhatsApp/E-Posta zaman tünelini açar; CTI tanımlıysa 'Müşteri CRM Aç (2. Sekme)' dış CRM'i açar." },
      { field: "3. Sessize Al (Mic) & Beklemeye Al (Hold / MOH)", type: "Aktif Çağrı Buton 1 & 2", defaultVal: "Tek Tık", required: false, description: "Sessize Al (Mic) yalnızca kendi mikrofonunuzu kapatır (kırmızı olur); Beklemeye Al (Pause) müşteriye santralin kurumsal bekleme müziğini (MOH) dinletir (sarı olur)." },
      { field: "4. Canlı AI Gürültü Engelleme Anahtarı (Sparkles)", type: "Aktif Çağrı Buton 3", defaultVal: "Yapay Zeka (RNNoise)", required: false, description: "Görüşmeyi kesmeden tek tıkla 'Yapay Zeka (RNNoise + Yan Ses Kesici) → Standart → Kapalı' modları arasında canlı geçiş yapar." },
      { field: "5. KVKK & Kredi Kartı Ses Kaydı Duraklat (*9 — Kalkan)", type: "Aktif Çağrı Buton 4", defaultVal: "call_panel:pause_recording", required: false, description: "Müşteri kredi kartı numarası, CVV veya gizli şifre paylaşırken Asterisk MixMonitor ses kaydını duraklatır (sarı yanıp söner); bilgi bitince tekrar basılarak kayıt sürdürülür." },
      { field: "6. Cihaz Değiştir / Call Flip (*11 — Çift Ok)", type: "Aktif Çağrı Buton 5", defaultVal: "call_panel:call_flip", required: false, description: "Aktif görüşmeyi kapatmadan aynı kullanıcıya kayıtlı tüm diğer cihazları (IP masa telefonu, RUNA masaüstü, mobil uygulama) çaldırır; hangisinden açarsanız görüşme kesintisiz oraya geçer." },
      { field: "7. Çağrı Transferi (Kör & Danışmalı) + 3'lü Konferans + 2. Hat", type: "Aktif Çağrı Buton 6, 7 & 8", defaultVal: "Çoklu Hat Motoru", required: false, description: "Kör Transfer (doğrudan aktarır), Danışmalı Transfer (önce 2. hatta konuşup sonra birleştirir), Konferans (3. katılımcıyı sesli dahil eder) ve 2. Hat Ekle (Hat 1 / Hat 2 arasında geçiş)." },
      { field: "8. Canlı Konuşma & Çeviri (6 Dil • 4 Ses Modu) & Çağrıyı Sonlandır", type: "Aktif Çağrı Buton 9 & 10", defaultVal: "EN/DE/RU/AR/FR/ES ↔ TR", required: false, description: "Yabancı dildeki müşteriyi canlı Türkçe metne çevirir; Türkçe yazdığınız yanıtı hedef dilde seslendirir ('Sadece Müşteri', 'Müşteri + Ben', 'Sadece Ben', 'Yazarak Seslendir'). Kırmızı ahize görüşmeyi bitirip ACW'ye geçirir." },
      { field: "9. Canlı Donanım Mikrofon & Müşteri RTP Hoparlör VU Barları", type: "Gerçek Zamanlı Ses Ölçer", defaultVal: "%0–%100 Canlı", required: false, description: "Mikrofon (Donanım) kendi sesinizin gittiğini, Hoparlör (Müşteri Sesi) karşıdan RTP ses paketi geldiğini canlı yüzde barıyla kanıtlar." },
      { field: "10. Sonuç Kodu Çipleri, AI Not Çıkar, Türkçe Sesli Dikte & ACW", type: "Görüşme İçi & Çağrı Sonrası", defaultVal: "Kuyruk ACW Süreli", required: false, description: "Görüşme sırasında veya ACW geri sayımında Sonuç Kodu seçer, 'AI Not Çıkar' ile otomatik özet oluşturur, mikrofonla sesli not dikte eder ve 'Kaydet & Müsaite Geç' ile sonraki çağrıya hazır olursunuz." }
    ],
    editFormSections: [
      {
        level: 3,
        tabTitle: "Ekran 1: Gelen Çağrı Çalarken (Incoming Call Ringing — Yanıtla, Reddet, Kuyruk & CRM Kartı)",
        badge: "Aktif Çağrı 1/6 • Gelen Çağrı",
        screenshot: { src: "/screenshots/tabs/call-panel/active/02-gelen-cagri-calarken.jpg", caption: "Gelen Çağrı Çalarken (Ringing) — Arayan kimliği, Kuyruk etiketi, VIP CRM özeti, 360° Kart ve yeşil 'Gelen Çağrıyı Yanıtla' butonu", routeHint: "Web Telefon → Gelen Çağrı (Ringing)" },
        description: "Telefon çaldığında Web Telefon otomatik öne gelir, masaüstü bildirimi çıkar ve kulaklık + tanımlıysa ikincil zil hoparlörü çalar. Temsilci ahizeyi açmadan önce arayanın adını, şirketini, hangi kuyruktan geldiğini ve geçmiş notlarını görür.",
        fields: [
          { name: "Kuyruk Rozeti, Kayıtlı Kişi Etiketi, 'Rehbere Ekle' & '360° Kart (Alt+C)'", type: "Örn. Satış Kuyruğu (2000) • VIP Müşteri", defaultVal: "Otomatik Eşleşme", required: false, effect: "Rehber ve CRM'den otomatik çekilen müşteri kimliğiyle temsilci 'Merhaba Ahmet Bey, Anadolu Lojistik...' şeklinde profesyonel karşılama yapar. Alt+C ile geçmiş tüm aramalar ve WhatsApp mesajları anında açılır." },
          { name: "Gelen Çağrıyı Yanıtla (Yeşil) & Çağrıyı Reddet (Kırmızı)", type: "Tek Tık / Klavye Kısayolu", defaultVal: "call_panel:webphone_reject", required: false, effect: "Yanıtla görüşmeyi anında başlatır (CTI Screen Pop açıksa dış CRM sekmesi de otomatik tetiklenir). Reddet yetkisi açıksa çağrıyı meşgule düşürerek kuyruktaki sıradaki temsilciye iletir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Ekran 2: Aktif Görüşme (InCall) — 10 Kontrol Butonu, VU Barları, AI Not, Dikte & Canlı Çeviri",
        badge: "Aktif Çağrı 2/6 • Tüm Aktif İşlemler",
        screenshot: { src: "/screenshots/tabs/call-panel/active/03-aktif-gorusme.jpg", caption: "Aktif Görüşme (InCall) — Canlı süre sayacı (02:14), 10 çağrı kontrol butonu, canlı Mikrofon/Hoparlör VU barları, Sonuç Kodu/AI Not kutusu ve Canlı Çeviri paneli", routeHint: "Web Telefon → Aktif Görüşme (InCall)" },
        description: "Görüşme bağlandığında aktif olan tam kontrol panelidir. Sol kısımda DTMF tuş takımı ve 'Yeni Hat Ara', sağ üstte müşteri aksiyonları ile 10'lu çağrı kontrol çubuğu, ortada canlı Mikrofon/Hoparlör ses barları ile sonuç kodu / AI Not / sesli dikte alanı ve altta 6 dilli Canlı Konuşma & Çeviri paneli yer alır.",
        fields: [
          { name: "Buton 1 & 2: Sessize Al (Mikrofon) & Beklemeye Al (Hold / MOH)", type: "Mic / Pause İkonu", defaultVal: "Tek Tık", required: false, effect: "Sessize Al yalnızca sizin mikrofonunuzu keser (ofis içi danışma için idealdir); Beklemeye Al müşteriyi kurumsal bekleme müziğine (MOH) alır ve iki tarafın sesini keser." },
          { name: "Buton 3: Canlı Gürültü Engelleme (Sparkles — AI RNNoise / Standart / Kapalı)", type: "Canlı Ses Filtresi", defaultVal: "Yapay Zeka (AI)", required: false, effect: "Çağrı devam ederken yan masadaki gürültü veya klavye sesleri oluşursa tek tıkla AI RNNoise gürültü engelleyiciyi açıp kapatabilirsiniz." },
          { name: "Buton 4: KVKK & Kredi Kartı Ses Kaydı Duraklat (*9 — Kalkan İkonu)", type: "call_panel:pause_recording", defaultVal: "MixMonitor Pause", required: false, effect: "Müşteri kart numarası, son kullanma tarihi, CVV veya gizli şifre söylerken basıldığında Asterisk ses kaydını duraklatır (kalkan sarı yanıp söner). Hassas veri bittiğinde tekrar basılarak kayda devam edilir." },
          { name: "Buton 5: Cihaz Değiştir / Call Flip (*11 — Çift Ok İkonu)", type: "call_panel:call_flip", defaultVal: "Tüm Cihazları Çaldır", required: false, effect: "Masadan kalkmanız gerektiğinde görüşmeyi kapatmadan diğer kayıtlı cihazlarınızı (IP masa telefonu veya mobil uygulama) çaldırır; açtığınız anda görüşme kesintisiz o cihaza aktarılır. Ayrıca başka cihazda konuşurken Web Telefon üstünde 'Görüşmeyi Bu Cihaza Al (*11)' banner'ı da çıkar." },
          { name: "Buton 6, 7 & 8: Çağrı Transferi (→) • Konferans (Radio) • Yeni Çağrı / 2. Hat Ekle (Telefon)", type: "Yönlendirme & Çoklu Hat", defaultVal: "Yetki Bazlı", required: false, effect: "Kör/Danışmalı Transfer panelini açar, 3. kişiyi konferansa dahil eder veya mevcut müşteriyi bekletip 2. dahili/dış hat açar." },
          { name: "Buton 9 & 10: Canlı Konuşma & Çeviri (Languages) • Çağrıyı Sonlandır (Kırmızı Ahize)", type: "6 Dil Tercüman + Hangup", defaultVal: "EN/DE/RU/AR/FR/ES", required: false, effect: "Canlı Çeviri panelinde 'Oto. Sesli Çeviri', 'Sadece Müşteri', 'Müşteri + Ben', 'Sadece Ben' ve 'Yazarak Seslendir' modları bulunur; yazdığınız Türkçe metin müşterinin dilinde doğal sesle okutulur." },
          { name: "Canlı Mikrofon (Donanım) & Hoparlör (Müşteri Sesi) VU Seviye Çubukları", type: "%0–%100 Canlı Gösterge", defaultVal: "Gerçek Zamanlı", required: false, effect: "Görüşmede 'sesim gidiyor mu / müşterinin sesi geliyor mu' şüphesini saniyeler içinde giderir." },
          { name: "Görüşme İçi Hızlı Sonuç Kodu Çipleri, 'AI Not Çıkar', Sesle Not Yaz (Dikte) & 'Kaydet'", type: "AI Özet + Türkçe Dikte", defaultVal: "Anlık Kayıt", required: false, effect: "Görüşme sürerken tek tıkla sonuç kodu seçer, AI Not Çıkar ile konuşmadan otomatik özet üretir veya mikrofonla sesli not dikte edip kaydedersiniz." }
        ],
        tips: [
          "Karşı tarafın IVR menüsünde 'Muhasebe için 2'ye basın' dendiğinde soldaki tuş takımına (veya klavyeden rakamlara) basarak doğrudan DTMF sinyali gönderebilirsiniz.",
          "Müşteri başka bir departmanı sorarsa 'Yeni Hat Ara' veya 'Kontrollü Transfer' ile önce ekip arkadaşınızı arayıp ön bilgi vermeniz müşteri memnuniyetini belirgin artırır."
        ]
      },
      {
        level: 3,
        tabTitle: "Ekran 3: Aktif Görüşmede Çağrı Transferi (Kontrolsüz/Kör & Kontrollü/Danışmalı Transfer)",
        badge: "Aktif Çağrı 3/6 • Transfer",
        screenshot: { src: "/screenshots/tabs/call-panel/active/04-aktif-gorusme-transfer.jpg", caption: "Aktif Görüşme → Çağrı Transferi Paneli: Hedef dahili/kuyruk/dış numara arama, Kontrolsüz (Kör) Transfer ve Kontrollü (Danışmalı) Transfer seçimi", routeHint: "Web Telefon → Aktif Görüşme → Çağrı Transferi" },
        description: "Aktif görüşme sırasında 'Çağrı Transferi (→)' butonuna basıldığında açılan hedef seçim ve aktarım penceresidir. Dahili numara (örn. 1001), kuyruk numarası (örn. 2000) veya dış GSM/sabit numara yazabilirsiniz.",
        fields: [
          { name: "Kontrolsüz Transfer (Kör / Blind Transfer)", type: "Mor Buton • Tek Adım", defaultVal: "Anında Aktar", required: false, effect: "Hedef numarayı yazıp 'Kontrolsüz Transfer'e bastığınızda görüşme sizin ekranınızdan anında çıkar ve doğrudan hedef dahiliyi/kuyruğu çaldırır." },
          { name: "Kontrollü Transfer (Danışmalı / Attended Transfer)", type: "İndigo Buton • 2 Adım", defaultVal: "Önce Konuş, Sonra Birleştir", required: false, effect: "1) Mevcut müşteriyi otomatik bekleme müziğine (Hold) alır. 2) Hedef ekip arkadaşınızı 2. hattan arar. 3) Arkadaşınız açtığında ön bilgi verirsiniz ve 'Transferi Tamamla' diyerek ikisini birbirine bağlayıp hattan çıkarsınız; arkadaşınız meşgulse 2. hattı kapatıp müşteriye geri dönersiniz." }
        ]
      },
      {
        level: 3,
        tabTitle: "Ekran 4: Aktif Görüşmede 3'lü Konferans (Ara & Konferansa Ekle)",
        badge: "Aktif Çağrı 4/6 • 3'lü Konferans",
        screenshot: { src: "/screenshots/tabs/call-panel/active/05-aktif-gorusme-konferans.jpg", caption: "Aktif Görüşme → Konferans Yönetimi Paneli: Görüşmeye 3. dahili veya dış telefon katılımcısı ekleme", routeHint: "Web Telefon → Aktif Görüşme → Konferans" },
        description: "Mevcut müşteri görüşmesine teknik uzman, süpervizör veya harici bir tedarikçiyi anında 3. katılımcı olarak dahil etmenizi sağlar.",
        fields: [
          { name: "Katılımcı Dahili / No & 'Ara & Konferansa Ekle'", type: "Dahili veya Dış Numara", defaultVal: "WebRTC Audio Mix", required: false, effect: "Hedef kişi aramayı yanıtladığında tüm taraflar aynı anda birbirini kristal netliğinde duyar. İhtiyaç bittiğinde tek katılımcıyı çıkarabilir veya görüşmeyi tamamen sonlandırabilirsiniz." }
        ]
      },
      {
        level: 3,
        tabTitle: "Ekran 5: Çift Hat Yönetimi, Bekletme & Hatlar Arası Geçiş (Multi-Line Swap & Merge)",
        badge: "Aktif Çağrı 5/6 • Çift Hat & Bekletme",
        screenshot: { src: "/screenshots/tabs/call-panel/active/06-cift-hat-danismali-bekletme.jpg", caption: "Çift Hat Aktif Görünümü — Hat 1 (Ahmet Yılmaz — Beklemede) ve Hat 2 (Murat BATTAL — Dahili Danışma Aktif) arasında tek tık geçiş", routeHint: "Web Telefon → Çift Hat / Danışmalı Görüşme" },
        description: "Aktif bir müşteri görüşmesi sürerken 'Yeni Hat Ara' veya Kontrollü Transfer ile 2. bir hat açıldığında üstte her iki hattı canlı kartlar halinde yönetmenizi sağlar.",
        fields: [
          { name: "Hat 1 / Hat 2 Kartları (Beklemede ↔ Aktif Geçiş / Swap)", type: "Çoklu Hat Çubuğu", defaultVal: "Tek Tık Swap", required: false, effect: "Hangi hat kartına tıklarsanız o hat aktif konuşmaya geçer, diğer hat otomatik bekleme müziğine (Hold) alınır. Her hattın kendi süre sayacı ve kapatma butonu vardır." },
          { name: "Transferi Tamamla (İki Hattı Birleştir) veya 3'lü Konferansa Çevir", type: "İki Hattı Bağla", defaultVal: "Tek Tık", required: false, effect: "2. hattaki ekip arkadaşınızla konuştuktan sonra tek tıkla müşteriyi ona bağlayabilir veya üçlü konferansa dönüştürebilirsiniz." }
        ]
      },
      {
        level: 3,
        tabTitle: "Ekran 6: Çağrı Sonrası İşlem (ACW), AI Not Asistanı & Sonuç Kodu Kaydetme",
        badge: "Aktif Çağrı 6/6 • ACW & AI Not",
        screenshot: { src: "/screenshots/tabs/call-panel/active/07-cagri-sonrasi-acw-not.jpg", caption: "Çağrı Sonrası İşlem (ACW) — Hem sol Temsilci Oturumu kartında hem ana ekranda geri sayım, sonuç kodu seçici, AI Not Çıkar ve görüşme notu kaydetme", routeHint: "Web Telefon → Çağrı Sonrası İşlem (ACW)" },
        description: "Kuyruk çağrısı sonlandığında otomatik devreye giren toparlanma (Wrap-Up) ekranıdır. Geri sayım dolana kadar temsilciye yeni kuyruk çağrısı düşmez; böylece temsilci sakin biçimde notunu ve sonuç kodunu kaydeder.",
        fields: [
          { name: "Sonuç Kodu (Disposition) Seçimi, 'AI Not Çıkar' & Sesli Dikte", type: "Satış Yapıldı / Bilgi Verildi / Teklif İletildi / Teknik Destek...", defaultVal: "Kuyruk Kodları", required: false, effect: "Görüşmenin sonucunu işaretleyip AI'ın konuşma dökümünden ürettiği özeti tek tıkla onaylarsınız; tüm veriler Çağrı Sonuç Kodları ve Temsilci Notları raporuna işlenir." },
          { name: "'Kaydet & Müsaite Geç' / 'ACW Kapat (Not Yazmadan Müsaite Geç)'", type: "Erken ACW Bitirme", defaultVal: "Otomatik Geri Sayım", required: false, effect: "İşleminizi ACW süresi bitmeden tamamladıysanız beklemeden hemen Müsait durumuna geçip yeni çağrı almaya başlayabilirsiniz." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere: Web Telefon 6'lı Sistem Kontrolü & Sorun Giderme Ekranı",
        badge: "Web Telefon → Sistem Kontrolü",
        screenshot: { src: "/screenshots/tabs/call-panel/deep/webphone-diagnostics.jpg", caption: "Web Telefon Sistem Kontrolü — İnternet, HTTPS/WebRTC, Mikrofon İzni, Santral WSS/SIP, Web Lock ve Hoparlör 6'lı Tanılama", routeHint: "Web Telefon → 'WEB TELEFON HAZIR' Rozeti" },
        description: "Web Telefon üstündeki yeşil/kırmızı durum rozetine tıklayıp açabileceğiniz 6 adımlı otomatik sağlık kontrolüdür.",
        fields: [
          { name: "Cihaz Anahtarı (AIDA-DEV-...) & 6 Canlı Kontrol Satırı", type: "İnternet / HTTPS / Mikrofon / WSS-SIP / Web Lock / Hoparlör Testi", defaultVal: "Tekrar Tara + Test Sesi Çal", required: false, effect: "Mikrofon engellendiyse veya tarayıcı sekmeyi uyutuyorsa anında kırmızı uyarı ve tek tıkla çözüm rehberi sunar." }
        ]
      }
    ],
    sections: [
      {
        heading: "1. Aktif Çağrı Sırasında En Sık Kullanılan 5 İş Akışı",
        body: "Gerçek bir çağrı merkezi gününde temsilcilerin en sık uyguladığı uçtan uca adımlar:",
        steps: [
          "Müşteriyi Tanıma: Telefon çaldığında Kuyruk rozeti ve müşteri adını okuyun; `Alt+C` ile Müşteri 360° kartından son görüşme/WhatsApp özetine 2 saniyede göz atın.",
          "Kredi Kartı / Hassas Veri Alma: Kalkan ikonuna (`*9`) basıp ses kaydını duraklatın (buton sarı yanıp söner), kart bilgisini aldıktan sonra tekrar basıp kaydı sürdürün.",
          "Danışmalı Transfer: Transfer (`→`) butonundan arkadaşınızın dahilisini yazıp 'Kontrollü Transfer'e basın; arkadaşınıza ön bilgi verip 'Transferi Tamamla' ile bağlayın.",
          "Yabancı Dil Görüşmesi: Canlı Çeviri (`Languages`) ikonunu açın, dili seçin (örn. EN); müşterinin sözlerini Türkçe okuyup yanıtınızı Türkçe yazarak müşterinin dilinde sesli okutun.",
          "Görüşme Kapanışı (ACW): Kırmızı ahizeye bastıktan sonra 'AI Not Çıkar' ile özeti oluşturun, Sonuç Kodunu seçin ve 'Kaydet' diyerek anında Müsait'e dönün."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Karşı taraf sesimi duymuyor", cause: "Mikrofon izni kapalı, yanlış mikrofon seçili veya Mute açık kalmış.", solution: "'WEB TELEFON HAZIR' rozetine tıklayıp 6'lı Sistem Kontrolü'nü çalıştırın ve Avatar → Profil Ayarları → Donanım'dan mikrofonunuzu test edin." }
    ],
    relatedPages: ["temsilci-cagri-paneli", "cagri-paneli-temsilciler", "kisisel-profil-ve-ust-cubuk"],
    relatedApis: ["POST /api/v1/calls/originate", "POST /api/v1/calls/{call_id}/recording-pause", "GET /api/workspace/customer-360"]
  },
  {
    id: "cagri-paneli-temsilciler",
    number: "07",
    groupId: "temsilci-paneli",
    category: "Temsilci Çağrı Paneli",
    title: "Çağrı Paneli — Sekme 3: Temsilciler (Ekip Meşguliyet, BLF & Hızlı Transfer)",
    shortTitle: "3. Temsilciler (Ekip BLF)",
    menuPath: "Temsilci Çağrı Paneli → Temsilciler",
    pbxRoute: "/?tab=cagri-merkezi",
    permissions: [
      "call_panel:tab_agents",
      "call_panel:agents_status",
      "call_panel:agents_duration",
      "call_panel:agents_call_counts",
      "call_panel:agents_login_logout"
    ],
    badge: "Temsilci Rehberi 4/11 • Canlı BLF • 4 Yetki",
    readMinutes: 6,
    summary:
      "Aynı kuyrukta veya şirkette çalışan tüm ekip arkadaşlarınızın anlık Müsait, Görüşmede, Molada veya Çevrimdışı durumlarını canlı olarak görmenizi, tek tıkla dahili arama başlatmanızı, elinizdeki aktif çağrıyı müsait arkadaşınıza aktarmanızı veya iç sohbet açmanızı sağlar.",
    screenshots: [
      {
        src: "/screenshots/tabs/call-panel/03-temsilciler.jpg",
        caption: "Temsilci Çağrı Paneli → Sekme 3: Temsilciler — Kuyruk/durum filtresi, ekip kartları, canlı meşguliyet ve tek tıkla arama/transfer",
        routeHint: "Temsilci Çağrı Paneli → Temsilciler"
      }
    ],
    fieldTable: [
      { field: "Kuyruk Filtresi, Durum Filtresi & İsim/Dahili Arama", type: "Tümü / Müsait / Görüşmede / Molada / Çevrimdışı", defaultVal: "Canlı", required: false, description: "Örn. yalnızca 'Satış Kuyruğu'ndaki 'Müsait' ekip arkadaşlarını 1 saniyede süzmenizi sağlar." },
      { field: "4 Granüler Görünürlük Yetkisi", type: "Durum / Süre / Çağrı Adetleri / Giriş-Çıkış Saatleri", defaultVal: "Rol Bazlı", required: false, description: "Yöneticiniz rol ayarından temsilcilerin birbirlerinin çağrı sayılarını veya mola sürelerini görüp görmeyeceğini hassas biçimde belirler." },
      { field: "Kart Yoğunluğu & Sıralama Tercihi", type: "Kompakt / Standart + Duruma/İsme Göre", defaultVal: "Kişisel Kayıt", required: false, description: "50+ kişilik büyük ekiplerde kompakt görünümle tüm ekibi tek ekranda izlemenizi sağlar." },
      { field: "Tek Tık Aksiyonlar (Ara / Aktif Çağrıyı Transfer Et / İç Sohbet)", type: "Hızlı Butonlar", defaultVal: "Anlık", required: false, description: "Aktif çağrı yokken arkadaşınızı arar; aktif çağrı varken tek tıkla transfer başlatır." }
    ],
    sections: [
      {
        heading: "1. Müsait Ekip Arkadaşına Hızlı Çağrı Aktarma",
        body: "Çağrıyı meşgul bir dahiliye aktarıp müşteriyi bekletmek yerine önce bu sekmeden kimin yeşil (Müsait) olduğunu görüp tek tıkla aktarabilirsiniz.",
        steps: [
          "Durum filtresini 'Müsait' seçin.",
          "Hedef arkadaşınızın kartındaki 'Ara' veya 'Transfer' butonuna tıklayın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Arkadaşlarımın çağrı sayıları görünmüyor", cause: "Rolünüzde 'call_panel:agents_call_counts' yetkisi gizli tutulmuş.", solution: "Bu bir güvenlik/gizlilik tercihidir; yalnızca yöneticiniz rol ayarından açabilir." }
    ],
    relatedPages: ["cagri-paneli-web-telefon-aktif-cagri", "cagri-paneli-sohbet", "canli-izleme-paneli"],
    relatedApis: ["GET /api/v1/extensions"]
  },
  {
    id: "cagri-paneli-hizli-arama",
    number: "08",
    groupId: "temsilci-paneli",
    category: "Temsilci Çağrı Paneli",
    title: "Çağrı Paneli — Sekme 4: Hızlı Arama (Speed Dial Kartları)",
    shortTitle: "4. Hızlı Arama",
    menuPath: "Temsilci Çağrı Paneli → Hızlı Arama",
    pbxRoute: "/?tab=cagri-merkezi",
    permissions: ["call_panel:tab_speeddial"],
    badge: "Temsilci Rehberi 5/11 • Speed Dial • Tek Tık",
    readMinutes: 5,
    summary:
      "Sık aranan tedarikçi, kargo şubesi, teknik servis, banka veya kurum içi önemli numaraları kısa kodlu kartlar halinde listeleyen ve tek tıkla arama başlatmanızı sağlayan hızlı arama panosudur.",
    screenshots: [
      {
        src: "/screenshots/tabs/call-panel/04-hizli-arama.jpg",
        caption: "Temsilci Çağrı Paneli → Sekme 4: Hızlı Arama — Kısa kodlu hızlı arama kartları ve tek tıkla arama",
        routeHint: "Temsilci Çağrı Paneli → Hızlı Arama"
      }
    ],
    fieldTable: [
      { field: "Kısa Kod Kartları (*01, *02...)", type: "Kısa Kod + Açıklama + Hedef Numara", defaultVal: "Santralle Senkron", required: false, description: "Kart üzerine tıklandığında Web Telefon üzerinden anında arama başlatır." },
      { field: "Yeni Hızlı Arama Ekle (+) / Düzenle / Sil", type: "Kişisel & Kurumsal Kayıt", defaultVal: "Yetki Bazlı", required: false, description: "Yeni numara ekleyip kısa kod atamanızı veya mevcut kaydı güncellemenizi sağlar." }
    ],
    editFormSections: [
      {
        level: 3,
        tabTitle: "Alt Pencere: Yeni Hızlı Arama Ekle / Düzenle Modalı",
        badge: "Hızlı Arama → Yeni Ekle (+)",
        screenshot: { src: "/screenshots/tabs/call-panel/deep/speeddial-add-modal.jpg", caption: "Hızlı Arama → '+' Yeni Hızlı Arama Ekle modalı: Kısa kod, hedef numara ve açıklama girişi", routeHint: "Temsilci Çağrı Paneli → Hızlı Arama → +" },
        description: "Sağ üstteki kırmızı '+' butonuna basıldığında açılan ve yeni hızlı arama kartı oluşturan penceredir.",
        fields: [
          { name: "Kısa Kod, Hedef Numara & Açıklama", type: "Örn. *05 • 0212 555 00 00 • Kargo Merkezi", defaultVal: "Zorunlu", required: true, effect: "Kaydedildiği anda kart listesine eklenir ve masa telefonlarından da aynı kısa kodla çevrilebilir." }
        ]
      }
    ],
    sections: [
      {
        heading: "1. Numara Ezberlemeden Tek Tık Arama",
        body: "Gün içinde defalarca aradığınız dış numaraları Hızlı Arama'ya ekleyerek hem zamandan kazanır hem yanlış numara çevirme riskini sıfırlarsınız.",
        steps: [
          "Sağ üstteki '+' butonuna tıklayın, kısa kod, telefon numarası ve açıklamayı girip kaydedin.",
          "Karttaki arama butonuna tıklayarak Web Telefon'dan hemen arayın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Yeni hızlı arama ekleme (+) butonu görünmüyor", cause: "Yöneticiniz hızlı arama listesini yalnızca admin düzenlemesine açık bırakmış.", solution: "Santral → Hızlı Arama ekranından yönetici tarafından eklenen kurumsal kodlar burada otomatik listelenir." }
    ],
    relatedPages: ["hizli-arama", "cagri-paneli-web-telefon-aktif-cagri", "cagri-paneli-rehber"],
    relatedApis: ["GET /api/speed-dials"]
  },
  {
    id: "cagri-paneli-kayip-cagri",
    number: "09",
    groupId: "temsilci-paneli",
    category: "Temsilci Çağrı Paneli",
    title: "Çağrı Paneli — Sekme 5: Kayıp Çağrı (Üzerime Al / Claim & Geri Arama Planlama)",
    shortTitle: "5. Kayıp Çağrı & Hatırlatıcı",
    menuPath: "Temsilci Çağrı Paneli → Kayıp Çağrı",
    pbxRoute: "/?tab=cagri-merkezi",
    permissions: ["call_panel:tab_missed"],
    badge: "Temsilci Rehberi 6/11 • Claim Kilidi • Callback",
    readMinutes: 7,
    summary:
      "Hem doğrudan dahilinize hem üyesi olduğunuz kuyruklara düşüp cevapsız kalan çağrıları takip ettiğiniz, 'Üzerime Al (Claim)' kilidi ile aynı müşteriyi iki temsilcinin birden aramasını önlediğiniz ve ileri saatli 'Geri Arama Hatırlatıcıları' planladığınız sekmedir.",
    screenshots: [
      {
        src: "/screenshots/tabs/call-panel/05-kayip-cagri.jpg",
        caption: "Temsilci Çağrı Paneli → Sekme 5: Kayıp Çağrı — Cevapsız çağrı listesi, Üzerime Al (Claim), Müşteri 360° ve geri arama",
        routeHint: "Temsilci Çağrı Paneli → Kayıp Çağrı"
      }
    ],
    fieldTable: [
      { field: "2 Alt Görünüm (Kayıp Çağrılar & Geri Arama Hatırlatıcıları)", type: "Sekme Geçişi", defaultVal: "Kayıp Çağrılar", required: false, description: "Cevapsız aramalar ile ileri saat/tarih için planlanmış müşteri geri arama görevlerini ayrı yönetir." },
      { field: "Üzerime Al (Claim) Kilidi", type: "Ekip Senkron Kilidi", defaultVal: "missed_claims", required: false, description: "Bir temsilci kayıp çağrıyı üzerine aldığında tüm ekip arkadaşlarının ekranında 'X ilgileniyor' etiketi görünür; mükerrer arama önlenir." },
      { field: "Tek Tıkla Geri Ara & Müşteri 360°", type: "Hızlı Aksiyonlar", defaultVal: "WebPhone Bağlı", required: false, description: "Geri aramadan önce müşterinin geçmiş çağrı/WhatsApp özetine bakıp tek tıkla ararsınız." },
      { field: "İleri Tarihli Geri Arama Planla (+)", type: "Tarih/Saat + Öncelik + Not", defaultVal: "Hatırlatıcı Alarmlı", required: false, description: "Müşteri 'beni saat 16:00'da arayın' dediğinde görev oluşturur ve zamanı gelince hatırlatır." }
    ],
    editFormSections: [
      {
        level: 3,
        tabTitle: "Alt Pencere: Yeni Geri Arama Hatırlatıcısı & İleri Tarihli Planlama Modalı",
        badge: "Kayıp Çağrı → Geri Arama Planla",
        screenshot: { src: "/screenshots/tabs/call-panel/deep/missed-callback-modal.jpg", caption: "Kayıp Çağrı → Yeni Geri Arama Hatırlatıcısı Ekle modalı: Müşteri numarası, adı, tarih/saat, öncelik ve hatırlatma notu", routeHint: "Temsilci Çağrı Paneli → Kayıp Çağrı → Yeni Geri Arama Hatırlatıcısı" },
        description: "Belirli bir tarih ve saatte aranması gereken müşteriler için öncelikli geri arama görevi oluşturan penceredir.",
        fields: [
          { name: "Telefon Numarası, Müşteri Adı, Planlanan Tarih/Saat, Öncelik & Not", type: "Normal / Yüksek / Acil", defaultVal: "Zamanı Gelince Bildirim", required: true, effect: "Geri Arama Hatırlatıcıları listesine eklenir; tamamlandığında veya silindiğinde listeden düşer." }
        ]
      }
    ],
    sections: [
      {
        heading: "1. Ekip İçinde Çift Arama Olmadan Kayıp Çağrı Kurtarma",
        body: "Özellikle 10+ kişilik satış/destek ekiplerinde en büyük sorun iki kişinin aynı cevapsız müşteriyi arka arkaya aramasıdır. Claim kilidi bu sorunu tamamen çözer:",
        steps: [
          "Kayıp Çağrı listesinde 'Bekliyor' durumundaki en eski kaydın yanındaki 'Üzerime Al' butonuna tıklayın.",
          "'Müşteriyi Geri Ara' butonuna basarak Web Telefon üzerinden arayın.",
          "Müşteri ulaşılabilir değilse 'İleri Tarihli Geri Arama Planla' ile 2 saat sonraya hatırlatıcı kurun."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Başkasının üzerine aldığı kaydı ben aramak istiyorum", cause: "Diğer temsilci molaya çıkmış veya ilgilenememiş olabilir.", solution: "Süpervizör veya ekip içi koordinasyonla 'Üzerime Al' devrini güncelleyebilirsiniz." }
    ],
    relatedPages: ["rapor-kacan-cagri", "cagri-paneli-web-telefon-aktif-cagri", "cagri-paneli-cagri-gecmisi"],
    relatedApis: ["POST /api/workspace/missed-claims", "GET /api/workspace/customer-360"]
  },
  {
    id: "cagri-paneli-rehber",
    number: "10",
    groupId: "temsilci-paneli",
    category: "Temsilci Çağrı Paneli",
    title: "Çağrı Paneli — Sekme 6: Rehber (Şirket Rehberi, Favoriler & Son Aramalar)",
    shortTitle: "6. Rehber",
    menuPath: "Temsilci Çağrı Paneli → Rehber",
    pbxRoute: "/?tab=cagri-merkezi",
    permissions: ["call_panel:tab_directory"],
    badge: "Temsilci Rehberi 7/11 • Favoriler • 360° Kart",
    readMinutes: 5,
    summary:
      "Tüm kurum içi dahilileri ve kurumsal müşteri rehberini tek ekranda aramanızı, sık iletişim kurduğunuz kişileri yıldızlayarak 'Favoriler' sekmesine almanızı, tek tıkla arama/transfer başlatmanızı ve Müşteri 360° zaman tünelini açmanızı sağlar.",
    screenshots: [
      {
        src: "/screenshots/tabs/call-panel/06-rehber.jpg",
        caption: "Temsilci Çağrı Paneli → Sekme 6: Rehber — İsim/şirket/numara araması, kurum içi dahililer ve hızlı çağrı başlatma",
        routeHint: "Temsilci Çağrı Paneli → Rehber"
      }
    ],
    fieldTable: [
      { field: "Alt Sekmeler (Tümü / Dahililer / Müşteriler / Favoriler / Son Aramalar)", type: "Hızlı Süzme", defaultVal: "Tümü", required: false, description: "İç personel dahilileri ile dış müşteri kartlarını anında ayırır; yıldızlı favorilere 1 tıkta erişirsiniz." },
      { field: "Esnek Arama (Ad, Soyad, Şirket, Telefon, E-Posta, Dahili)", type: "Anlık Filtre", defaultVal: "Son 10 Hane Uyumlu", required: false, description: "Numaranın başındaki +90 veya 0 fark etmeksizin eşleşen kişiyi anında bulur." },
      { field: "Tek Tık Ara / Aktif Çağrıyı Transfer Et / Müşteri 360°", type: "WebPhone Entegreli", defaultVal: "Anlık", required: false, description: "Aktif görüşme varken transfer butonu otomatik çıkar; boşta iken doğrudan arama başlatır." }
    ],
    sections: [
      {
        heading: "1. Kişisel Favori Rehberinizi Oluşturma",
        body: "Her gün aradığınız ekip arkadaşlarınızı veya VIP müşterilerinizi yıldız ikonuna tıklayarak Favoriler sekmesine sabitleyebilirsiniz.",
        steps: [
          "Üst arama çubuğundan kişiyi bulun.",
          "Yıldız ikonuna tıklayarak Favorilere ekleyin veya 'Ara' ile hemen çağrı başlatın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Yeni eklediğim müşteri rehberde görünmüyor", cause: "Kayıt farklı bir tenant altında eklenmiş veya sayfa yenilenmemiş.", solution: "Web Telefon üzerinden 'Rehbere Kaydet' ile eklenen kişiler anında tüm temsilcilerin Rehber sekmesine yansır." }
    ],
    relatedPages: ["rehber", "cagri-paneli-web-telefon-aktif-cagri", "cagri-paneli-hizli-arama"],
    relatedApis: ["GET /api/v1/contacts"]
  },
  {
    id: "cagri-paneli-cagri-gecmisi",
    number: "11",
    groupId: "temsilci-paneli",
    category: "Temsilci Çağrı Paneli",
    title: "Çağrı Paneli — Sekme 7: Çağrı Geçmişi (Kişisel CDR, Filtreler, Ses Kaydı & Transkript)",
    shortTitle: "7. Çağrı Geçmişi",
    menuPath: "Temsilci Çağrı Paneli → Çağrı Geçmişi",
    pbxRoute: "/?tab=cagri-merkezi",
    permissions: ["call_panel:tab_history", "call_panel:listen_records", "call_panel:view_transcripts"],
    badge: "Temsilci Rehberi 8/11 • Kişisel CDR • Transkript",
    readMinutes: 6,
    summary:
      "Temsilcinin yalnızca kendi gerçekleştirdiği gelen, giden, dahili ve doğrudan yanıtsız çağrıların tam geçmişini listeler. Rol yetkisine bağlı olarak satır içi ses kaydı dinleme, konuşma dökümü (transkript) okuma ve tek tıkla tekrar arama imkanı verir.",
    screenshots: [
      {
        src: "/screenshots/tabs/call-panel/07-cagri-gecmisi.jpg",
        caption: "Temsilci Çağrı Paneli → Sekme 7: Çağrı Geçmişi — Kişisel gelen/giden/yanıtsız çağrı tablosu ve ses/transkript butonları",
        routeHint: "Temsilci Çağrı Paneli → Çağrı Geçmişi"
      }
    ],
    fieldTable: [
      { field: "Tarih, Yön & Numara/İsim Arama Filtreleri", type: "Bugün / 7 Gün / 30 Gün + Gelen/Giden/Cevapsız", defaultVal: "Sayfalamalı", required: false, description: "Geçmişte görüştüğünüz bir müşteriyi saniyeler içinde bulmanızı sağlar." },
      { field: "Satır İçi Ses Kaydı Dinleme (call_panel:listen_records)", type: "Oynatıcı", defaultVal: "Rol Yetkili", required: false, description: "Yetki verildiyse temsilci kendi unuttuğu bir adres/sipariş detayını ses kaydından tekrar dinleyebilir." },
      { field: "Çağrı Transkripti Popup'ı (call_panel:view_transcripts)", type: "Konuşmacı Ayrımlı Döküm", defaultVal: "Rol Yetkili", required: false, description: "Görüşmenin metin dökümünü satır içinden açıp kopyalamanızı sağlar." },
      { field: "Tekrar Ara & Doğrudan Yanıtsız Rozeti", type: "Tek Tık WebPhone", defaultVal: "Aktif", required: false, description: "Kuyruktan değil doğrudan dahilinize gelip kaçan çağrıları özel rozetle öne çıkarır." }
    ],
    editFormSections: [
      {
        level: 3,
        tabTitle: "Alt Panel: Çağrı Geçmişi Gelişmiş Filtre Çekmecesi",
        badge: "Çağrı Geçmişi → Filtreler",
        screenshot: { src: "/screenshots/tabs/call-panel/deep/history-filters.jpg", caption: "Çağrı Geçmişi → 'Filtreler' çekmecesi: Tarih aralığı, arama yönü ve numara/isim araması", routeHint: "Temsilci Çağrı Paneli → Çağrı Geçmişi → Filtreler" },
        description: "Sağ üstteki 'Filtreler' butonuna basıldığında açılan ve kişisel çağrı geçmişinizi yön, tarih ve anahtar kelimeye göre daraltan kontrol şerididir.",
        fields: [
          { name: "Tarih Filtresi, Yön Filtresi & Sayfa Başı Kayıt", type: "Gelen / Giden / Cevapsız + 10/25/50", defaultVal: "25 Satır", required: false, effect: "Uzun geçmişte aradığınız spesifik görüşmeye anında ulaşmanızı sağlar." }
        ]
      }
    ],
    sections: [
      {
        heading: "1. Görüşmede Kaçırdığınız Bilgiyi Saniyeler İçinde Doğrulama",
        body: "Müşterinin telefonla söylediği vergi numarası, adres veya kargo kodunu eksik not aldıysanız müşteriyi tekrar rahatsız etmeden transkript veya ses kaydından doğrulayabilirsiniz.",
        steps: [
          "'Filtreler' ile ilgili müşteriyi bulun.",
          "Satır sonundaki Transkript veya Ses Kaydı oynat ikonuna tıklayarak bilgiyi kontrol edin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Ses kaydı veya transkript ikonları görünmüyor", cause: "Rolünüzde 'call_panel:listen_records' veya 'call_panel:view_transcripts' yetkisi kapalı.", solution: "Yöneticinizden Sistem Ayarları → Roller ekranından ilgili yetkiyi talep edebilirsiniz." }
    ],
    relatedPages: ["rapor-cdr", "cagri-paneli-kayip-cagri", "cagri-paneli-web-telefon-aktif-cagri"],
    relatedApis: ["GET /api/v1/reports/cdr"]
  },
  {
    id: "cagri-paneli-sesli-posta",
    number: "12",
    groupId: "temsilci-paneli",
    category: "Temsilci Çağrı Paneli",
    title: "Çağrı Paneli — Sekme 8: Sesli Posta (Görsel Voicemail Oynatıcı)",
    shortTitle: "8. Sesli Posta",
    menuPath: "Temsilci Çağrı Paneli → Sesli Posta",
    pbxRoute: "/?tab=cagri-merkezi",
    permissions: ["call_panel:tab_voicemail"],
    badge: "Temsilci Rehberi 9/11 • Görsel Voicemail • .WAV",
    readMinutes: 5,
    summary:
      "Telefondan *97 çevirip sesli menü dinlemek zorunda kalmadan dahilinize bırakılan tüm sesli mesajları görsel liste halinde gösteren, tek tıkla tarayıcıdan dinlemenizi, .WAV olarak indirmenizi ve arayan müşteriyi hemen geri aramanızı sağlayan sekmedir.",
    screenshots: [
      {
        src: "/screenshots/tabs/call-panel/08-sesli-posta.jpg",
        caption: "Temsilci Çağrı Paneli → Sekme 8: Sesli Posta — Okunmamış rozeti, görsel WAV oynatıcı, indirme ve geri arama kontrolleri",
        routeHint: "Temsilci Çağrı Paneli → Sesli Posta"
      }
    ],
    fieldTable: [
      { field: "Okunmamış Bildirim Rozeti & Filtre (Tümü / Yeni)", type: "Kırmızı Sayaç", defaultVal: "Canlı", required: false, description: "Sol menüdeki kırmızı rozet dinlenmemiş kaç sesli mesajınız olduğunu anlık bildirir." },
      { field: "Görsel Ses Oynatıcı & .WAV İndirme", type: "İleri/Geri Sarma + İndir", defaultVal: "Tarayıcı İçi", required: false, description: "Mesajı dinlediğiniz anda otomatik 'Okundu' olarak işaretlenir; gerekirse .wav dosyası bilgisayara indirilebilir." },
      { field: "Tek Tıkla Geri Ara & Mesajı Sil", type: "WebPhone + Özel Silme Onayı", defaultVal: "Aktif", required: false, description: "Mesajı bırakan müşteriyi tek tıkla geri arayıp işiniz bitince sesli postayı temizleyebilirsiniz." }
    ],
    sections: [
      {
        heading: "1. Mesai Dışı Bırakılan Mesajları Hızlıca Eritme",
        body: "Sabah ofise geldiğinizde sol menüde kırmızı rozet görüyorsanız ilk iş olarak Sesli Posta sekmesini açıp bekleyen mesajları sırayla dinleyip geri arayabilirsiniz.",
        steps: [
          "Filtreyi 'Okunmamış' seçin.",
          "Mesajı oynatın ve hemen yanındaki 'Geri Ara' butonuyla müşteriye dönüş yapın."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Bana hiç sesli mesaj düşmüyor", cause: "Kullanıcı kartınızda Sesli Posta aktif edilmemiş veya Cevapsız yönlendirme hedefi olarak atanmamış.", solution: "Yöneticinizden Kullanıcılar → Özellikler sekmesinde Sesli Posta'yı aktif etmesini isteyin." }
    ],
    relatedPages: ["rapor-sesli-posta", "kullanicilar", "cagri-paneli-kayip-cagri"],
    relatedApis: ["GET /api/voicemail"]
  },
  {
    id: "cagri-paneli-sohbet",
    number: "13",
    groupId: "temsilci-paneli",
    category: "Temsilci Çağrı Paneli",
    title: "Çağrı Paneli — Sekme 9: Sohbet (Müşteri Omnichannel & Ekip İçi Yazışma)",
    shortTitle: "9. Sohbet (Müşteri & Ekip)",
    menuPath: "Temsilci Çağrı Paneli → Sohbet",
    pbxRoute: "/?tab=cagri-merkezi",
    permissions: ["call_panel:tab_chat"],
    badge: "Temsilci Rehberi 10/11 • AI Devral • İç Sohbet",
    readMinutes: 7,
    summary:
      "Temsilcinin Çağrı Paneli'nden hiç ayrılmadan hem kendisine/kuyruğuna düşen WhatsApp, Telegram, Instagram, Facebook ve E-Posta müşteri yazışmalarını yanıtladığı hem de ekip arkadaşlarıyla anlık iç mesajlaşma (okundu bilgili) yaptığı birleşik sohbet merkezidir.",
    screenshots: [
      {
        src: "/screenshots/tabs/call-panel/09-sohbet.jpg",
        caption: "Temsilci Çağrı Paneli → Sekme 9: Sohbet — Müşteri sohbetleri, AI ↔ Temsilci devralma ve ekip içi anlık yazışma",
        routeHint: "Temsilci Çağrı Paneli → Sohbet"
      }
    ],
    fieldTable: [
      { field: "2 Ana Sekme (Müşteri Sohbetleri & Ekip İçi Yazışma)", type: "Birleşik Mesajlaşma", defaultVal: "Yeniden Boyutlanabilir Panel", required: false, description: "Dış müşteri kanalları ile şirket içi personel sohbetlerini temiz biçimde ayırır." },
      { field: "Sohbeti Temsilci Olarak Devral / AI Asistana Geri Devret", type: "Takeover Anahtarı", defaultVal: "Anlık", required: false, description: "AI asistanın yürüttüğü bir WhatsApp sohbetini tek tıkla devralabilir, özel soruyu yanıtladıktan sonra tekrar AI'a bırakabilirsiniz." },
      { field: "Yeni İç Yazışma Başlat & Gönderildi / İletildi / Okundu Tikleri", type: "Ekip İçi Chat", defaultVal: "Gerçek Zamanlı", required: false, description: "Görüşme sırasında yan departmandaki arkadaşınızdan sessizce bilgi almak için birebir iç sohbet başlatırsınız." },
      { field: "Mesaj / Sohbet Silme (Benden Sil) & Hızlı Cevaplar", type: "Özel Onay Modallı", defaultVal: "Aktif", required: false, description: "Mesaj kutusunda '/' kısayoluyla kurumsal hazır cevapları saniyeler içinde gönderebilirsiniz." }
    ],
    sections: [
      {
        heading: "1. Çağrı Sırasında Ekip Arkadaşından Sessiz Destek Alma",
        body: "Müşteriyi uzun süre bekleme müziğine almak yerine sohbet sekmesinden teknik ekip veya muhasebeye anlık mesaj yazıp saniyeler içinde yanıt alabilirsiniz.",
        steps: [
          "Sohbet sekmesinde 'Ekip İçi' görünümüne geçin ve 'Yeni İç Yazışma Başlat' ile arkadaşınızı seçin.",
          "Müşteri sohbetlerinde ise 'Devral' butonuna basıp yanıtınızı gönderin; gerekirse tekrar AI'a devredin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Müşteriye mesaj gönderirken 'AI yanıtlıyor' uyarısı var", cause: "Sohbet henüz Yapay Zeka modunda.", solution: "Üstteki 'Sohbeti temsilci olarak devral' butonuna tıkladığınızda AI durur ve mesaj kutusu size açılır." }
    ],
    relatedPages: ["ortak-gelen-kutusu", "cagri-paneli-temsilciler", "rapor-omnichannel-sla"],
    relatedApis: ["GET /api/omnichannel/chats", "POST /api/omnichannel/chats/{session_id}/send"]
  },
  {
    id: "cagri-paneli-masa-telefonum",
    number: "14",
    groupId: "temsilci-paneli",
    category: "Temsilci Çağrı Paneli",
    title: "Çağrı Paneli — Sekme 10: Masa Telefonum (Canlı Görsel IP Telefon Tasarımcısı)",
    shortTitle: "10. Masa Telefonum (BLF)",
    menuPath: "Temsilci Çağrı Paneli → Masa Telefonum",
    pbxRoute: "/?tab=cagri-merkezi",
    permissions: ["call_panel:tab_deskphone"],
    badge: "Temsilci Rehberi 11/11 • Görsel LCD • Check-Sync",
    readMinutes: 10,
    summary:
      "Masasında fiziksel Yealink, Fanvil, Grandstream, Cisco veya Snom IP telefon bulunan kullanıcıların BT ekibine ihtiyaç duymadan kendi telefonlarının birebir görsel kasa ve LCD simülatörü üzerinde BLF/Hızlı Arama tuşlarını, genişleme modüllerini (Sidecar), zil sesini ve ekran ayarlarını tasarlayıp tek tıkla telefona gönderdiği kişisel tasarım stüdyosudur.",
    screenshots: [
      {
        src: "/screenshots/tabs/call-panel/deep/deskphone-visual-simulator.jpg",
        caption: "Masa Telefonum — Canlı Görsel Tasarımcı (Yealink T42S LCD Simülatörü, T1–T6 Tuşları, Rehberden Tek Tıkla BLF ve Üst Aksiyon Çubuğu)",
        routeHint: "Temsilci Çağrı Paneli → Masa Telefonum → Tuşlar"
      }
    ],
    fieldTable: [
      { field: "Üst Aksiyon Çubuğu (Sıfırla • Kod Önizle • Kaydet • Hızlı Uygula • Telefona Gönder & Yeniden Başlat)", type: "5 Uzaktan Kontrol Butonu", defaultVal: "SIP NOTIFY", required: false, description: "'Hızlı Uygula' telefonu kapatmadan Check-Sync göndererek tuşları saniyeler içinde günceller; 'Telefona Gönder & Yeniden Başlat' tam provizyon uygular." },
      { field: "Canlı Görsel LCD Telefon Simülatörü & Kilitli Ana Hat (T1)", type: "Marka/Model Gerçek Kasası", defaultVal: "Otomatik Model Eşleşmeli", required: false, description: "Telefon üzerindeki her tuşa tıkladığınızda sağ panelde o tuşun işlevi açılır ve yazdığınız etiket LCD ekranda canlı görünür." },
      { field: "Rehberden Tek Tıkla Ata & Otomatik BLF Doldur", type: "BLF / Speed Dial / Voicemail / DND / Transfer / Pickup", defaultVal: "Otomatik İsimli", required: false, description: "Sağdaki dahili listesinden tek tıkla arkadaşınızı seçtiğinizde BLF meşguliyet izleme ve tek tuşla çağrı çekme otomatik tanımlanır." },
      { field: "Meşguliyet Genişleme Modülleri (Sidecar / EXP40 vb.)", type: "Model Destekliyse", defaultVal: "Dinamik", required: false, description: "Sekreterya telefonlarına takılan 20–40 tuşlu yan genişleme modüllerini de aynı görsel ekrandan programlar." }
    ],
    editFormSections: [
      {
        level: 3,
        tabTitle: "Alt Sekme 10.1: Ses & Zil Ayarları (Zil Melodisi Dinleme, Kodek & İnterkom)",
        badge: "Masa Telefonum → Ses & Zil",
        screenshot: { src: "/screenshots/tabs/call-panel/deep/deskphone-tab-audio.jpg", caption: "Masa Telefonum → Ses & Zil sekmesi: Fiziksel masa telefonu zil melodisi seçimi, tarayıcıdan ön dinleme ve ses ayarları", routeHint: "Masa Telefonum → Ses & Zil" },
        description: "Fiziksel masa telefonunun zil melodisini tarayıcıdan dinleyerek seçmenizi ve interkom/otomatik cevap tercihlerinizi düzenlemenizi sağlar.",
        fields: [
          { name: "Zil Melodisi + 'Melodiyi Dinle' & Donanım Ses Tercihleri", type: "Ring1..Ring8 + İnterkom", defaultVal: "Ring1.wav", required: false, effect: "Kaydedilip 'Hızlı Uygula' dendiğinde masa telefonunuzun zil sesi anında değişir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Sekme 10.2: Ekran Ayarları (LCD Dil, Saat Formatı, Arka Işık & Bekleme Etiketi)",
        badge: "Masa Telefonum → Ekran",
        screenshot: { src: "/screenshots/tabs/call-panel/deep/deskphone-tab-screen.jpg", caption: "Masa Telefonum → Ekran sekmesi: Telefon LCD dili, 24/12 saat biçimi ve ekran tercihleri", routeHint: "Masa Telefonum → Ekran" },
        description: "Fiziksel telefonunuzun LCD ekranında görünecek dil, saat formatı ve bekleme ekranı görünümünü özelleştirir.",
        fields: [
          { name: "LCD Ekran Dili, Saat Biçimi & Arka Işık", type: "Türkçe/English + 24s/12s", defaultVal: "Türkçe / 24 Saat", required: false, effect: "Değişiklikler soldaki canlı LCD simülatöründe anında önizlenir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Sekme 10.3: Provizyon Sekmesi (LAN / WAN URL & Son Provizyon Durumu)",
        badge: "Masa Telefonum → Provizyon",
        screenshot: { src: "/screenshots/tabs/call-panel/deep/deskphone-tab-provision.jpg", caption: "Masa Telefonum → Provizyon sekmesi: LAN/WAN Auto-Provision URL kopyalama ve cihaz MAC/Endpoint bilgileri", routeHint: "Masa Telefonum → Provizyon" },
        description: "Telefonunuzun MAC adresi, SIP Endpoint kimliği, son provizyon saati ve ofis içi (LAN) / uzak şube (WAN) kurulum bağlantılarını gösterir.",
        fields: [
          { name: "LAN URL Kopyala / WAN URL Kopyala & Son Provizyon Damgası", type: "Zero-Touch URL", defaultVal: "HTTP/HTTPS", required: false, effect: "Telefonu sıfırdan kurarken web arayüzündeki Auto Provision Server URL alanına yapıştırılır." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 10.4: Canlı Oto-Provizyon Kodu (.CFG / .XML) Önizle & İndir Modalı",
        badge: "Masa Telefonum → Kod Önizle",
        screenshot: { src: "/screenshots/tabs/call-panel/deep/deskphone-cfg-preview.jpg", caption: "Masa Telefonum → 'Kod Önizle' Modalı: Telefon için üretilen canlı .cfg/.xml konfigürasyon dosyasını inceleme, kopyalama ve indirme", routeHint: "Masa Telefonum → Kod Önizle" },
        description: "Santralin seçtiğiniz tuş ve ayarlara göre anlık ürettiği ham `.cfg`/`.xml` dosyasını telefona göndermeden önce görmenizi ve indirmenizi sağlar.",
        fields: [
          { name: "Canlı .CFG / .XML İçeriği, 'Kopyala' & 'İndir'", type: "Yealink / Fanvil / Grandstream / Cisco / Snom", defaultVal: "Anlık Render", required: false, effect: "SIP hesabı, kodek önceliği, DTMF ve tüm BLF/DSS satırlarının eksiksiz üretildiğini doğrular." }
        ]
      }
    ],
    sections: [
      {
        heading: "1. 30 Saniyede Masa Telefonunuza BLF Tuşu Ekleme",
        body: "BT ekibine destek talebi açmadan kendi masa telefonunuzun yan tuşlarını anında güncelleyebilirsiniz:",
        steps: [
          "Soldaki görsel telefon üzerinde boş bir tuşa (örn. T2) tıklayın.",
          "Sağdaki 'Rehberden Tek Tıkla Ata' listesinden izlemek istediğiniz arkadaşınızı seçin.",
          "Üstten 'Kaydet' ve ardından 'Hızlı Uygula' butonuna basın; telefonunuz kapanmadan 5 saniye içinde yeni tuş ekranda görünür."
        ]
      }
    ],
    troubleshooting: [
      { problem: "'Tanımlı Fiziksel Masa Telefonunuz Bulunmamaktadır' mesajı çıkıyor", cause: "Hesabınıza yalnızca WebPhone tanımlı, fiziksel IP telefon MAC eşleştirmesi yapılmamış.", solution: "Sistem yöneticiniz Santral → Kullanıcılar → SIP veya Oto Provizyon ekranından masa telefonunuzun MAC adresini dahilinize atadığında bu tasarım stüdyosu otomatik açılır." }
    ],
    relatedPages: ["oto-provizyon", "kullanicilar", "cagri-paneli-web-telefon-aktif-cagri"],
    relatedApis: ["GET /api/deskphone/my-device", "POST /api/deskphone/my-device/save"]
  }
];
