export const EDIT_GUIDES_PART2 = {
  "kullanicilar": {
    editFormSections: [
      {
        tabTitle: "Sekme 1: Genel (Temel Kimlik, Rol, Lokasyon, Departman & Başlangıç Ekranı)",
        badge: "Kullanıcı Düzenle 1/11",
        screenshot: { src: "/screenshots/tabs/users/01-genel.jpg", caption: "Kullanıcı Düzenle → Sekme 1: Genel Bilgiler, Kullanıcı Aktiflik Anahtarı ve Hoş Geldiniz Maili", routeHint: "Kullanıcılar → Düzenle → Genel" },
        description: "Kullanıcının temel kimlik bilgileri, web giriş şifresi, rol ataması, organizasyon konumu ve girişte açılacak başlangıç ekranı.",
        fields: [
          { name: "Kullanıcı Aktif mi? & 'Hoş Geldiniz Maili Gönder'", type: "Toggle + Tek Tık E-Posta", defaultVal: "Aktif", required: false, effect: "Pasife alındığında kullanıcının geçmiş CDR/rapor verileri silinmeden web ve SIP erişimi anında dondurulur. Üstteki buton kurulum bilgilerini e-posta atar." },
          { name: "İsim Soyisim & E-Posta Adresi", type: "Metin / Email", defaultVal: "Zorunlu", required: true, effect: "Web giriş kimliği, CallerID adı, AI isimle dahili transferi (directory_lookup) ve sesli posta e-posta teslimatı için kullanılır." },
          { name: "Kullanıcı Rolü & Arayüz Şifresi (Login)", type: "Rol Seçimi + Parola", defaultVal: "Agent", required: true, effect: "RBAC ekran/sekme yetkilerini belirler. Düzenlemede şifre boş bırakılırsa mevcut şifre değişmez." },
          { name: "Lokasyon, Departman & Başlangıç Modülü", type: "Seçim", defaultVal: "Role Göre Otomatik", required: false, effect: "Toplu Konfigürasyon/rapor kırılımları ve kullanıcının oturum açtığında doğrudan düşeceği ekran (örn. Temsilci Çağrı Paneli)." }
        ]
      },
      {
        tabTitle: "Sekme 2: SIP (Dahili, CallerID, Giden Kurallar, Cihazlar, BLF 1–24, Softkeys & Kodekler)",
        badge: "Kullanıcı Düzenle 2/11",
        screenshot: { src: "/screenshots/tabs/users/02-sip.jpg", caption: "Kullanıcı Düzenle → Sekme 2: SIP Ayarları, WebPhone/Masa Telefonu Cihazları, BLF/DSS ve Kodek Önceliği", routeHint: "Kullanıcılar → Düzenle → SIP" },
        description: "Asterisk PJSIP dahili kimliği, dış arama limitleri, WebPhone WebRTC, fiziksel masa telefonu MAC/Oto Provizyon, 24 programlanabilir BLF tuşu ve kodek ayarları.",
        fields: [
          { name: "Dahili Numarası (Extension) & Dış Aramada Görünecek Numara (CallerID)", type: "3–5 Hane + DID", defaultVal: "1000+", required: true, effect: "PJSIP endpoint kimliği ve bu abonenin dışarıyı ararken karşı tarafta göstereceği şirket numarası." },
          { name: "Giden Arama Kuralları, Çağrı Toplama Grubu (*8) & Eş Zamanlı Dış Arama Limiti", type: "Çoklu Seçim + Güvenlik Limiti", defaultVal: "Limit: 2", required: false, effect: "Hangi dış rotalara çıkabileceğini, *8 ile hangi grubun çağrılarını çekebileceğini ve toll-fraud'a karşı eşzamanlı dış arama tavanını belirler." },
          { name: "Web Telefonu (WebRTC), Masa Telefonu (MAC/Marka/Model) & Cisco 5160 / SIP Edge", type: "Cihaz İnceleme + Reprovision", defaultVal: "Çoklu Cihaz (5)", required: false, effect: "Cihaz bazlı SIP kimliği, 24 haneli şifre, Cisco Enterprise TCP 5160 ve uzak şube Nornia SIP Edge erişimi yönetilir." },
          { name: "BLF & Programlanabilir DSS Tuşları (1–24) + Softkeys (F1–F4)", type: "blf / line / speed_dial / voicemail / dnd / transfer / pickup / history / directory / redial", defaultVal: "Oto Provizyon Sync", required: false, effect: "IP masa telefonundaki tüm yan tuş ve ekran altı tuşlarını yönetir, kaydedilince telefona uzaktan gönderir." },
          { name: "Ses Kodek Önceliği & AI Mikrofon Gürültü Engelleme", type: "g722, alaw, ulaw, opus, g729 + AI Denoise", defaultVal: "g722, alaw, ulaw", required: false, effect: "HD ses önceliği, zil sesi melodisi ve arka plan ofis gürültüsü temizleme." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 2.1: SIP Cihazı Ekle / SIP Cihazı Ayarlarını Düzenle (Kimlik, Sürücü, Transport & SIP Edge)",
        badge: "Kullanıcı → SIP → Cihaz Düzenle",
        screenshot: { src: "/screenshots/tabs/deep/deskphone-sip-credentials-edit.jpg", caption: "Kullanıcı Düzenle → SIP → Masa Telefonu Düzenle (Kalem / +): Cihaz Tipi, SIP Kullanıcı Adı, Şifre, PJSIP/Cisco Motoru, Transport ve Nornia SIP Edge", routeHint: "Kullanıcılar → Düzenle → SIP → SIP Cihazları → Düzenle" },
        description: "SIP sekmesindeki 'SIP Cihazları' kartında '+' veya kalem ikonuna tıklandığında açılan 3. seviye kimlik ve protokol yapılandırma penceresidir. Her kullanıcıya birden fazla fiziksel masa telefonu, Cisco kurumsal telefon veya harici mobil SIP istemcisi eklenebilir.",
        fields: [
          { name: "SIP Cihazı Adı & Telefon / Cihaz Tipi", type: "Masa Telefonu (IP Telefon) / Web Telefonu (WebRTC) / Cisco Enterprise / Mobil SIP / Softphone", defaultVal: "Masa Telefonu 1", required: true, effect: "Cihaz tipine göre Asterisk PJSIP şablonunu (WSS DTLS-SRTP vs. UDP/TCP/TLS IP Telefon) ve inceleme penceresindeki sekmeleri otomatik belirler." },
          { name: "Kullanıcı Adı (SIP Aktivasyon) & SIP Register Şifresi", type: "Rastgele 8 Hane Alfanümerik + 24 Hane Güçlü Parola", defaultVal: "Sayısal Dahilisiz Güvenli ID", required: true, effect: "SIP tarayıcı botlarına (sipvicious) karşı sayısal dahili (1000) yerine tahmin edilemez endpoint ID (örn. qST5JFuQ) ile kayıt alır; kopyala/yenile butonları anında yeni kimlik üretir." },
          { name: "SIP Motoru (Sürücü)", type: "PJSIP (Standart) / Cisco Enterprise (TCP 5160 UseCallManager)", defaultVal: "PJSIP", required: true, effect: "Yealink, Fanvil, Grandstream, Snom, Poly için PJSIP; Cisco 79xx/88xx kurumsal seriler için özel TCP 5160 sürücüsünü etkinleştirir." },
          { name: "Maksimum Aktivasyon Sayısı (max_contacts) & Transport Protokolü", type: "1–5 Eşzamanlı Kayıt + UDP (5060) / TCP (5060) / TLS (5061) / WSS", defaultVal: "1–3 / UDP veya TCP", required: true, effect: "TCP seçimi NAT/firewall arkasındaki masa telefonlarında bağlantı kopmalarını azaltır; TLS tüm SIP sinyalleşmesini şifreler." },
          { name: "Uzak Erişim (Nornia SIP Edge) & SIP Cihazı Aktif", type: "Toggle + Toggle", defaultVal: "Aktif", required: false, effect: "Uzak Erişim açıldığında telefon evden veya dış şubeden port açmadan Nornia SIP Edge tüneli üzerinden santrale güvenle kayıt olur; Aktif kapatılırsa cihaz silinmeden geçici olarak devre dışı bırakılır." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 2.2: Masa Telefonu İnceleme — Sekme 1/4: Cihaz & Ağ Detayları, Autoprovision & Uzaktan Komutlar",
        badge: "Masa Telefonu İncele 1/4",
        screenshot: { src: "/screenshots/tabs/deep/deskphone-inspect-overview.jpg", caption: "Masa Telefonu — Cihaz İnceleme & Telefon Ayarları → Sekme 1: Canlı Durum, MAC Otomatik Marka Algılama, LAN/WAN Modu, Check-Sync ve Reboot", routeHint: "Kullanıcılar → Düzenle → SIP → Masa Telefonu (Büyüteç) → Cihaz & Ağ Detayları" },
        description: "SIP Cihazları listesindeki masa telefonunun büyüteç (İncele) butonuna tıklandığında açılan 4 sekmeli derin donanım ve yönetim penceresinin 1. sekmesidir.",
        fields: [
          { name: "Canlı Durum Kartları (Kayıt & RTT / Canlı IP & Web GUI / User-Agent & MAC)", type: "Gerçek Zamanlı Asterisk PJSIP Sorgusu", defaultVal: "Anlık", required: false, effect: "Telefonun kayıtlı (Online) durumunu, gecikmesini (ms), aldığı IP adresini, doğrudan telefonun kendi Web arayüzüne giden 'Web GUI' bağlantısını ve firmware sürümünü gösterir." },
          { name: "MAC Adresi (Otomatik Marka), Telefon Markası & Model", type: "XX:XX:XX:XX:XX:XX + Yealink / Fanvil / Grandstream / Cisco / Snom / Poly", defaultVal: "OUI Otomatik Algılama", required: true, effect: "MAC adresi yazıldığı anda OUI önekine göre marka (örn. 80:5E:C0 → Yealink) ve desteklenen model listesi otomatik seçilir." },
          { name: "Sabit / Bilinen IP Adresi & Bağlantı Lokasyonu (LAN / WAN / Otomatik)", type: "IPv4 + lan / wan / auto", defaultVal: "LAN veya WAN", required: false, effect: "LAN: Santral yerel IP ile tünelsiz kurulum. WAN: Uzak şube/ev ofis için dış FQDN + NAT Keep-Alive. Otomatik: Telefonun geldiği IP bloğuna göre dinamik seçim." },
          { name: "Otomatik Kurulum (Autoprovision) URL'leri & Uzaktan Komutlar", type: ".cfg/.xml İndir • Check-Sync Gönder • Reboot • LAN/WAN URL Kopyala", defaultVal: "SIP NOTIFY", required: false, effect: "'.cfg/.xml İndir' manuel yükleme dosyasını verir; 'Check-Sync Gönder' telefonu kapatmadan yeni ayar/BLF'leri çektirir; 'Reboot' telefonu uzaktan yeniden başlatır." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 2.3: Masa Telefonu İnceleme — Sekme 2/4: BLF & Programlanabilir DSS Tuşları (1–24) ve Softkeys (F1–F4)",
        badge: "Masa Telefonu İncele 2/4",
        screenshot: { src: "/screenshots/tabs/deep/deskphone-inspect-blf.jpg", caption: "Masa Telefonu — Cihaz İnceleme → Sekme 2: 24 Programlanabilir DSS/BLF Tuşu, Rehberden Otomatik BLF Doldur ve Ekran Altı Softkeys (F1–F4)", routeHint: "Kullanıcılar → Düzenle → SIP → Masa Telefonu (Büyüteç) → BLF & Tuş Tanımları" },
        description: "Fiziksel IP masa telefonunun yan ekran tuşlarını (1–24) ve ekran altı esnek tuşlarını (F1–F4) tek tek veya rehberden otomatik programlayan 2. sekmedir.",
        fields: [
          { name: "Rehberden Otomatik BLF Doldur & Yeni Tuş Ekle (+)", type: "Tek Tık Otomatik Doldurma + Satır Ekle", defaultVal: "1–24 Tuş", required: false, effect: "'Rehberden Otomatik BLF Doldur' sistemdeki diğer aktif dahilileri isimleriyle birlikte boş DSS tuşlarına sırayla yerleştirir." },
          { name: "Tuş No (1–24) & Tuş Tipi (DSS Key Type)", type: "Hat (Line) / BLF (Meşguliyet & Çağrı Çekme) / Hızlı Arama (Speed Dial) / Sesli Posta (*97) / Rahatsız Etme (DND) / Aktar (Transfer) / Çağrı Çek (*8)", defaultVal: "BLF", required: true, effect: "BLF seçili tuşlar karşı dahili konuşurken kırmızı yanar, çalarken yanıp söner ve tek basışta o çağrıyı çekmenizi (Directed Pickup) sağlar." },
          { name: "Dahili / Hedef Değeri & Ekran Etiketi", type: "Kullanıcı Seçici / Serbest Kod + Etiket", defaultVal: "Otomatik İsim", required: true, effect: "BLF tipinde sistem kullanıcıları açılır listeden seçilir; ekran etiketi masa telefonunun LCD ekranında görünecek kısa addır." },
          { name: "Ekran Altı Esnek Tuşlar (Softkeys F1–F4)", type: "Geçmiş / Rehber / Yönlendirme / DND / Menü / Tekrar Ara / Aktar / Çağrı Çek", defaultVal: "F1–F4", required: false, effect: "Telefon boştayken LCD ekranın hemen altındaki 4 fiziksel tuşun işlevini marka bağımsız olarak autoprovision dosyasına basar." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 2.4: Masa Telefonu İnceleme — Sekme 3/4: Diğer Telefon Ayarları (Kodek Önceliği, DTMF, Dil, NTP, Auto-Answer & Ghost Call)",
        badge: "Masa Telefonu İncele 3/4",
        screenshot: { src: "/screenshots/tabs/deep/deskphone-inspect-settings.jpg", caption: "Masa Telefonu — Cihaz İnceleme → Sekme 3: Ses Kodek Önceliği, DTMF, Dil, Saat Dilimi, NTP, İnterkom Auto-Answer ve Ghost Call Koruması", routeHint: "Kullanıcılar → Düzenle → SIP → Masa Telefonu (Büyüteç) → Diğer Telefon Ayarları" },
        description: "Hem Asterisk PJSIP endpoint'ine hem de telefonun otomatik kurulum (.cfg/.xml) dosyasına eşzamanlı uygulanan ses, zaman ve güvenlik ayarlarıdır.",
        fields: [
          { name: "Ses Kodek Önceliği (Audio Codecs — Öncelik #1..#5)", type: "G.722 (HD 16 kHz) / G.711 A-Law (PCMA) / G.711 µ-Law (PCMU) / Opus / G.729 (8 kbps)", defaultVal: "G.722 → PCMA → PCMU → G.729", required: true, effect: "Yukarı/Aşağı oklarla kodek müzakere sırasını değiştirir. Ofis içi HD ses için G.722 #1, Türkiye operatör uyumu için G.711 A-Law #2 önerilir." },
          { name: "DTMF Tuşlama Modu", type: "RFC 4733 / RFC 2833 (Önerilen) / SIP INFO / Inband", defaultVal: "RFC 4733", required: true, effect: "Banka ve IVR menülerinde tuşlamaların kusursuz algılanması için RFC 4733 standart olarak tutulmalıdır." },
          { name: "Telefon Ekran Dili, Saat Dilimi & NTP Saat Sunucusu", type: "Türkçe / English + GMT+3..+0 + pool.ntp.org", defaultVal: "Türkçe / GMT+3 / pool.ntp.org", required: false, effect: "Telefonun menü dilini ve LCD ekranındaki tarih/saat senkronizasyonunu merkezi olarak ayarlar." },
          { name: "İnterkom / Otomatik Cevap (Auto-Answer)", type: "Toggle", defaultVal: "Kapalı", required: false, effect: "Açıkken iç interkom/anons çağrılarında ahizeyi kaldırmadan hoparlörden otomatik yanıt verir (yönetici-asistan ve depo kullanımı için idealdir)." },
          { name: "Doğrudan IP Çağrı Engeli (Ghost Call Koruması)", type: "Toggle", defaultVal: "Aktif (Önerilen)", required: false, effect: "Santral dışı sahte SIP tarayıcılarının (örn. 100/1000@IP) telefonun yerel portunu doğrudan çaldırarak oluşturduğu 'hayalet çağrıları' cihaz seviyesinde engeller." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 2.5: Masa Telefonu İnceleme — Sekme 4/4: Canlı PJSIP Dahili Detay (asterisk -rx \"pjsip show endpoint\")",
        badge: "Masa Telefonu İncele 4/4",
        screenshot: { src: "/screenshots/tabs/deep/deskphone-inspect-pjsip.jpg", caption: "Masa Telefonu — Cihaz İnceleme → Sekme 4: Canlı Asterisk PJSIP Endpoint & Contact Terminal Çıktısı", routeHint: "Kullanıcılar → Düzenle → SIP → Masa Telefonu (Büyüteç) → PJSIP Dahili Detay" },
        description: "SSH bağlantısı açmadan doğrudan tarayıcı içinden bu cihaza ait canlı Asterisk PJSIP endpoint ve contact durumunu inceleyen teknik teşhis sekmesidir.",
        fields: [
          { name: "4 Özet Teknik Kart (Endpoint/Context, İzinli Kodekler, CallerID & DTMF, Pickup/Max Kayıt)", type: "Salt Okunur Canlı Veri", defaultVal: "webrtc_agents", required: false, effect: "Asterisk belleğinde fiilen yüklü olan aktif endpoint parametrelerini özetler." },
          { name: "Canlı Terminal Çıktısı (pjsip show endpoint + pjsip show contact)", type: "Yenile + Kopyala", defaultVal: "Anlık CLI", required: false, effect: "Kayıt sorunlarında, NAT RTT yüksekliğinde veya transport uyuşmazlığında Asterisk'in gerçek zamanlı çıktısını tek tıkla kopyalamanızı sağlar. Alt soldaki 'SIP Kimlik Bilgilerini Düzenle' butonu doğrudan 2.1 penceresine geçer." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere 2.6: Web Telefonu (WebRTC) — Cihaz İnceleme & Sayısal Dahilisiz PJSIP Mimarisi",
        badge: "Web Telefon İncele",
        screenshot: { src: "/screenshots/tabs/deep/user-sip-device-inspect.jpg", caption: "Web Telefonu (WebRTC) — Cihaz İnceleme: Canlı WSS bağlantısı, istemci IP:Port ve sayısal dahilisiz PJSIP güvenlik mimarisi", routeHint: "Kullanıcılar → Düzenle → SIP → Yazılım İstemcileri (Büyüteç)" },
        description: "Tarayıcı WebPhone, PC/Mac Masaüstü ve Mobil uygulamaların ortak WebRTC (WSS DTLS-SRTP) oturumunu inceleyen alt penceredir.",
        fields: [
          { name: "Kayıt & Durum, İstemci IP Adresi & WSS, Tarayıcı / SIP.js İstemci", type: "Canlı WSS Telemetrisi", defaultVal: "WSS (DTLS-SRTP)", required: false, effect: "Kullanıcının şu an tarayıcıdan kayıtlı olup olmadığını, anlık WSS soket bilgisini ve maksimum eşzamanlı sekme/cihaz limitini (varsayılan 5) gösterir." },
          { name: "Sayısal Dahilisiz PJSIP Mimarisi", type: "Güvenlik Açıklaması", defaultVal: "Mantıksal Dahili Korunur", required: false, effect: "Tarayıcı Asterisk'e sayısal dahili (1000) yerine rastgele endpoint ID ile kayıt olur; ancak tüm iç/dış aramalarda ve kuyruklarda mantıksal dahili numaranız korunur." }
        ]
      },
      {
        tabTitle: "Sekme 3: Profiller & Yönlendirme (*70 Profiller, Cihaz Seçimi, 3-Seviye Yönlendirme & Follow Me)",
        badge: "Kullanıcı Düzenle 3/11",
        screenshot: { src: "/screenshots/tabs/users/03-profiller-yonlendirme.jpg", caption: "Kullanıcı Düzenle → Sekme 3: Profiller (*70), Cihaz Seçimi, Çalma Süresi ve 3-Seviye Çağrı Yönlendirme", routeHint: "Kullanıcılar → Düzenle → Profiller & Yönlendirme" },
        description: "Her profil (Ofis, Uzaktan, Dışarıda, Toplantıda) için ayrı çalacak cihazlar, çalma süresi ve Her Zaman / Meşgulde / Cevapsız yönlendirme kuralları.",
        fields: [
          { name: "1. Bu Profilde Çalacak Cihazlar", type: "Web Telefon / PC-Mac / Mobil / Masa Telefonu", defaultVal: "Tümü", required: false, effect: "Örn. 'Evden' profilinde sadece Mobil + WebPhone çalarken 'Ofis' profilinde yalnızca Masa Telefonu çalabilir." },
          { name: "2. Çalma Süresi (sn) & 3. Telefon Tuşlama Kodu (*70 + Digit)", type: "15–60 sn + Rakam", defaultVal: "30 sn", required: false, effect: "Cevapsız yönlendirmeye düşmeden önceki çalma süresi ve telefondan profil değiştirme kısa kodu." },
          { name: "4. Çağrı Yönlendirme Kuralları (Her Zaman / Meşgulde / Cevapsız)", type: "Toggle + Hedef Tipi + Hedef", defaultVal: "Pasif", required: false, effect: "Dahili çevrimdışı, meşgul veya cevapsızsa çağrıyı başka dahiliye, kuyruğa, sesli postaya veya Operator_Trunk üzerinden GSM'e otomatik aktarır." },
          { name: "Kullanıcı GSM Numarası & Beni Takip Et (Follow Me 1. ve 2. Hedef)", type: "GSM + Sıralı Takip", defaultVal: "Opsiyonel", required: false, effect: "Önce 1. hedefi (örn. asistan), açmazsa 2. hedefi (cep telefonu) sırayla çaldırır." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Görünüm 3.1: 3-Seviye Yönlendirme Kuralları Açık Hali (Her Zaman / Meşgul / Cevapsız & *70 Kodu)",
        badge: "Profiller → Yönlendirme Açık",
        screenshot: { src: "/screenshots/tabs/toggled/user-profiller-expanded.jpg", caption: "Kullanıcı Düzenle → Profiller & Yönlendirme: Her Zaman, Meşgul Durumda ve Zaman Aşımında (Cevapsız) yönlendirme kartları açık görünümü", routeHint: "Kullanıcılar → Düzenle → Profiller & Yönlendirme → Yönlendirmeler Aktif" },
        description: "Yönlendirme anahtarları açıldığında ortaya çıkan 3 kademeli hedef seçim (Dahili Hat / Dış Numara / Kuyruk / Sesli Posta / Anons) ve 'Yönlendirmeleri Kapat' hızlı sıfırlama kontrolleridir.",
        fields: [
          { name: "1. Çalacak Cihazlar (4 Kutu), 2. Çalma Süresi (15s/30s/45s) & 3. Telefon Tuşlama Kodu (*70*1)", type: "Cihaz + Süre + Kısa Kod", defaultVal: "30s / *70*1", required: false, effect: "Masa telefonundan *70*1..*70*4 tuşlayarak profilinizi anında değiştirebilirsiniz." },
          { name: "HER ZAMAN / MEŞGUL DURUMDA / ZAMAN AŞIMINDA (CEVAPSIZ) + 'Yönlendirmeleri Kapat'", type: "Tip + Hedef (Dahili / Dış Numara / Kuyruk / Voicemail)", defaultVal: "resolve_forwarding", required: false, effect: "Her Zaman açıkken cihaz çalmadan doğrudan hedefe gider; Meşgul ve Cevapsız kuralları sırayla Asterisk dialplan tarafından değerlendirilir." }
        ]
      },
      {
        tabTitle: "Sekme 4: Özellikler (Ses Kaydı, Sesli Posta *97, Hot-Desking *75/*76 & Patron-Sekreter *74)",
        badge: "Kullanıcı Düzenle 4/11",
        screenshot: { src: "/screenshots/tabs/users/04-ozellikler.jpg", caption: "Kullanıcı Düzenle → Sekme 4: Ses Kayıt Politikası, Voicemail (*97), Hot-Desking (*75/*76) ve Patron-Sekreter (*74)", routeHint: "Kullanıcılar → Düzenle → Özellikler" },
        description: "Aboneye özel ses kayıt seviyesi, sesli posta kutusu, paylaşımlı masa telefonu oturumu ve yönetici-asistan yönlendirme politikaları.",
        fields: [
          { name: "Ses Kayıt Modu", type: "Yapay Zeka (AI) / Standart / Kapalı", defaultVal: "Standart", required: false, effect: "AI: Çift kanal RX/TX kayıt + otomatik transkript, duygu ve QA puanlama. Standart: WAV kayıt. Kapalı: Kayıt yok." },
          { name: "Sesli Posta (Voicemail *97)", type: "Aktif + 4 Rakam PIN + Karşılama Anonsu + E-Posta WAV", defaultVal: "Kapalı", required: false, effect: "Bırakılan sesli mesajları *97'den veya Çağrı Paneli'nden dinleme ve e-postaya otomatik WAV gönderme." },
          { name: "Ortak Masa Telefonu (Hot-Desking *75 / *76)", type: "Aktif + PIN + Gece Yarısı Otomatik Çıkış", defaultVal: "auto_logout_midnight: true", required: false, effect: "Vardiyalı çalışanların boş masadaki IP telefona PIN ile giriş yapmasını ve gece 00:00'da masanın otomatik boşalmasını sağlar." },
          { name: "Patron-Sekreter (*74)", type: "Atanan Sekreter Dahilileri + VIP Doğrudan Erişim Listesi", defaultVal: "Kapalı", required: false, effect: "Patrona gelen aramaları önce sekretere düşürür; sadece VIP listedeki dahili/GSM numaraları doğrudan patronu çaldırır." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Görünüm 4.1: Özellikler Açık Hali — Sesli Posta (*97), Ortak Masa Telefonu (Hot-Desking) & Beni Takip Et",
        badge: "Özellikler → Aktif Görünüm",
        screenshot: { src: "/screenshots/tabs/toggled/user-ozellikler-expanded.jpg", caption: "Kullanıcı Düzenle → Özellikler: Sesli Posta (Anons/PIN/E-Posta), Ortak Masa Telefonu (PIN Üret / Gece 00:00 Oto Çıkış) ve Beni Takip Et açık görünümü", routeHint: "Kullanıcılar → Düzenle → Özellikler (Tüm Kartlar Aktif)" },
        description: "Varsayılan olarak kapalı duran Sesli Posta, Ortak Masa Telefonu (Hot-Desking) ve Beni Takip Et (Follow Me) kartları aktifleştirildiğinde açılan tüm detay alanlarıdır.",
        fields: [
          { name: "Sesli Posta Karşılama Anonsu, 4 Rakam Şifre & 'Bırakılan Sesli Postaları E-Posta İle Gönder'", type: "Anons Seçici + 4 Hane PIN + Email Toggle", defaultVal: "1234", required: false, effect: "Mesaj bırakıldığında ses dosyasını .WAV eki olarak kullanıcının e-posta adresine anında gönderir." },
          { name: "Ortak Masa Telefonu PIN Şifresi ('Rastgele PIN Üret'), Gece 00:00 Oto Kapatma & Aktif Oturum", type: "4–6 Hane PIN + *75*Dahili*PIN / *76", defaultVal: "Gece 00:00 Açık", required: false, effect: "Telefonu yeniden başlatmadan anında dahili profili yükler; aktif oturum satırından hangi masada oturum açıldığı görülür." }
        ]
      },
      {
        tabTitle: "Sekme 5: Güvenlik (2FA, Güvenilen Cihazlar, Otomatik Çıkış & Şifre Yenileme)",
        badge: "Kullanıcı Düzenle 5/11",
        screenshot: { src: "/screenshots/tabs/users/05-guvenlik.jpg", caption: "Kullanıcı Düzenle → Sekme 5: 2FA (Google Auth / E-Posta / WhatsApp), Oturum Zaman Aşımı ve Güvenlik Kilidi", routeHint: "Kullanıcılar → Düzenle → Güvenlik" },
        description: "Hesap ele geçirme ve veri sızıntısına karşı kullanıcı bazlı kurumsal güvenlik kalkanı.",
        fields: [
          { name: "İki Faktörlü Doğrulama (2FA) & Çoklu Yöntem", type: "Google Authenticator TOTP / E-Posta OTP / WhatsApp OTP", defaultVal: "Opsiyonel", required: false, effect: "Kullanıcı girişinde ek doğrulama kodu ister; tekli veya çoklu yöntem kombinasyonu destekler." },
          { name: "Hareketsizlikte Otomatik Oturum Kapatma", type: "Kapalı / 1 Saat / 2 Saat / 3 Saat", defaultVal: "Kapalı", required: false, effect: "İşlem yapılmadığında tarayıcı oturumunu ve WebPhone kaydını otomatik sonlandırır." },
          { name: "Periyodik Şifre Yenileme & Dış Arama Karantinası", type: "1/3/6/12 Ay + Karantina", defaultVal: "Opsiyonel", required: false, effect: "Düzenli şifre değişimi zorunlu kılar ve şüpheli aboneyi dış aramalara kapatır." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Görünüm 5.1: İki Aşamalı Doğrulama (2FA) Aktif Görünümü — Tek / VE / VEYA Modu, 4 Yöntem & Canlı QR Eşleştirme",
        badge: "Güvenlik → 2FA Aktif",
        screenshot: { src: "/screenshots/tabs/toggled/user-guvenlik-2fa-expanded.jpg", caption: "Kullanıcı Düzenle → Güvenlik → İki Aşamalı Doğrulama (2FA) Aktif: Tek/VE/VEYA çalışma modu, 4 yöntem (E-Posta, WhatsApp, Google/Microsoft Auth) ve QR kurulumu", routeHint: "Kullanıcılar → Düzenle → Güvenlik → 2FA Aktif" },
        description: "2FA anahtarı açıldığında ekrana gelen çoklu doğrulama politikası ve canlı TOTP QR eşleştirme sihirbazıdır.",
        fields: [
          { name: "Doğrulama Çalışma Modu (Tek / 2 Aşamalı VE / Esnek Yedekli VEYA)", type: "single / all / any", defaultVal: "Tek Yöntem (Standart)", required: true, effect: "VE Modu en yüksek güvenlik için iki farklı yöntemi peş peşe ister (örn. E-Posta + Google Auth); VEYA Modu telefon yanında yoksa yedek yöntemle girişe izin verir." },
          { name: "4 Doğrulama Yöntemi (E-Posta / WhatsApp Giriş Kodu / Google Auth / Microsoft Auth)", type: "Çoklu Seçimli (+ Birlikte Kullan)", defaultVal: "Google Authenticator", required: true, effect: "WhatsApp Giriş Kodu seçildiğinde kullanıcı 5 dakika geçerli ücretsiz OTP kodunu WhatsApp üzerinden alır." },
          { name: "Google/Microsoft Authenticator QR Kodu, Manuel Anahtar, 'Yeni QR Üret' & 'Test Et & Eşleştir'", type: "TOTP 30 sn", defaultVal: "İlk Girişte de Eşleştirilebilir", required: false, effect: "Yönetici 2FA'yı hemen burada test edip eşleştirebilir veya kullanıcının ilk girişinde kendi telefonundan okutmasını sağlayabilir." }
        ]
      },
      {
        tabTitle: "Sekme 6: Uygulamalar (Web, PC/Mac Masaüstü, Mobil iOS/Android & QR Sihirli Giriş)",
        badge: "Kullanıcı Düzenle 6/11",
        screenshot: { src: "/screenshots/tabs/users/06-uygulamalar.jpg", caption: "Kullanıcı Düzenle → Sekme 6: Uygulamalar & Kolay Giriş (QR Kod ve Magic Login)", routeHint: "Kullanıcılar → Düzenle → Uygulamalar" },
        description: "Kullanıcının Nornia Masaüstü ve Mobil uygulamalarına parola yazmadan QR kod veya Sihirli Bağlantı (Magic Login) ile saniyeler içinde bağlanmasını sağlar.",
        fields: [
          { name: "Masaüstü & Mobil Uygulama Eşleştirme (QR / Magic Link)", type: "Tek Kullanımlık Token", defaultVal: "Anında Üretilir", required: false, effect: "Mobil uygulamadan QR okutulduğunda sunucu FQDN'i, kullanıcı oturumu ve SIP hesabı otomatik yapılandırılır." }
        ]
      },
      {
        tabTitle: "Sekme 7: CTI (Kullanıcıya Özel CRM Screen Pop & Müşteri Sorgu API)",
        badge: "Kullanıcı Düzenle 7/11",
        screenshot: { src: "/screenshots/tabs/users/07-cti.jpg", caption: "Kullanıcı Düzenle → Sekme 7: CTI Screen Pop URL, Açılma Zamanı ve CRM Sorgu API Ayarları", routeHint: "Kullanıcılar → Düzenle → CTI" },
        description: "Çağrı geldiğinde temsilcinin tarayıcısında 2. sekmede harici CRM/ERP müşteri kartını otomatik açma ayarları.",
        fields: [
          { name: "Hızlı CRM Şablonu & Screen Pop URL", type: "Zoho / HubSpot / Salesforce / Bitrix24 / Özel URL", defaultVal: "https://crm.../ara?tel={phone}", required: false, effect: "{phone}, {did}, {ext} yer tutucularını canlı çağrı bilgisiyle doldurup CRM ekranını açar." },
          { name: "Otomatik Sekme Açılma Zamanı & Davranışı", type: "Çalarken / Cevaplandığında + Yeni/Aynı Sekme", defaultVal: "Çalarken", required: false, effect: "Temsilci telefonu açmadan müşterinin kimliğini görmesini sağlar." },
          { name: "CRM Müşteri Sorgu API URL, Metod & Auth Token", type: "GET/POST + Header/Bearer", defaultVal: "Canlı Testli", required: false, effect: "Çağrı çalarken arka planda CRM'den müşteri özetini çekip WebPhone kartına yansıtır." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Görünüm 7.1: CTI Otomatik Ekran Açık — 7 Dinamik URL Parametresi, '2. Sekmede Test Et' & Canlı CRM REST API Ön İzleme",
        badge: "CTI → Aktif Görünüm",
        screenshot: { src: "/screenshots/tabs/toggled/user-cti-expanded.jpg", caption: "Kullanıcı Düzenle → CTI Aktif: Rol Bazlı CTI Yetkisi, 7 dinamik parametre çipi, 2. Sekmede Test Et ve Canlı CRM REST API Ön İzleme", routeHint: "Kullanıcılar → Düzenle → CTI (Aktif)" },
        description: "'CTI Otomatik Ekran Açık' ve 'Canlı CRM Müşteri Kartı Ön İzleme (REST API)' anahtarları açıldığında ortaya çıkan tüm entegrasyon alanlarıdır.",
        fields: [
          { name: "Rol Bazlı CTI Yetki Durumu & 7 Dinamik Parametre Ekleme Çipi", type: "{caller_clean} / {caller} / {last10} / {extension} / {call_id} / {queue} / {agent_name}", defaultVal: "Tek Tıkla URL'ye Ekler", required: false, effect: "Harici CRM/ERP adresine çağrı bilgilerini hatasız yerleştirir; '2. Sekmede Test Et' ile örnek bir numara üzerinden hemen doğrulanır." },
          { name: "Web Telefon Üzerinde Canlı CRM Müşteri Kartı Ön İzleme (REST API)", type: "HTTP Metodu (GET/POST) + Sorgu API URL + Auth", defaultVal: "WebPhone İçi Özet Kart", required: false, effect: "2. sekme açılmasına ek olarak temsilcinin WebPhone ekranının içinde müşterinin adını, bakiyesini veya son siparişini canlı gösterir." }
        ]
      },
      {
        tabTitle: "Sekme 8: Avatar & Tema (Profil Görseli & Otomatik Karanlık/Aydınlık Mod)",
        badge: "Kullanıcı Düzenle 8/11",
        screenshot: { src: "/screenshots/tabs/users/08-avatar-tema.jpg", caption: "Kullanıcı Düzenle → Sekme 8: Hazır Avatar Koleksiyonu ve Karanlık/Aydınlık Mod Zamanlaması", routeHint: "Kullanıcılar → Düzenle → Avatar & Tema" },
        description: "Kullanıcı profil fotoğrafı ve göz yorgunluğunu azaltan otomatik gece/gündüz tema zamanlaması.",
        fields: [
          { name: "Hazır Avatar Koleksiyonu / Özel Fotoğraf", type: "SVG / Görsel Seçici", defaultVal: "Çevrimdışı SVG Uyumlu", required: false, effect: "Wallboard, Temsilci Listesi ve sohbet ekranlarında kullanıcıyı temsil eden avatar." },
          { name: "Karanlık Mod Başlangıcı & Aydınlık Moda Dönüş Saati", type: "Saat Zamanlayıcı", defaultVal: "Opsiyonel", required: false, effect: "Akşam belirlenen saatte arayüzü otomatik karanlık temaya geçirir." }
        ]
      },
      {
        tabTitle: "Sekme 9: Arayüz & Panel Düzeni (Kişisel Çalışma Alanı Tercihleri)",
        badge: "Kullanıcı Düzenle 9/11",
        screenshot: { src: "/screenshots/tabs/users/09-arayuz-panel.jpg", caption: "Kullanıcı Düzenle → Sekme 9: Arayüz & Çağrı Paneli Düzeni Tercihleri", routeHint: "Kullanıcılar → Düzenle → Arayüz & Panel Düzeni" },
        description: "Temsilci Çağrı Panelinin açılış sekmesini, sekme görünüm stilini (İkon+Başlık / Sadece İkon) ve arayüz kompaktlığını özelleştirir.",
        fields: [
          { name: "Çağrı Paneli Açılış Sekmesi & Sekme Görünüm Stili", type: "Pano/WebPhone + İkon+Başlık / Sadece İkon", defaultVal: "Web Telefon", required: false, effect: "Küçük ekranlı bilgisayarlarda 'Sadece İkon' moduyla daha geniş çalışma alanı sunar." }
        ]
      },
      {
        tabTitle: "Sekme 10: Rapor & Yönetim Filtresi (Süpervizör Ekip & Kuyruk Kapsamı)",
        badge: "Kullanıcı Düzenle 10/11",
        screenshot: { src: "/screenshots/tabs/users/10-rapor-filtre.jpg", caption: "Kullanıcı Düzenle → Sekme 10: Rapor & Yönetim Filtresi — Süpervizörün yetkili olduğu kuyruk ve ekip kapsamı", routeHint: "Kullanıcılar → Düzenle → Rapor & Yönetim Filtresi" },
        description: "Takım lideri veya şube müdürünün yalnızca kendi sorumlu olduğu kuyruk ve temsilcilerin canlı ekranlarını, ses kayıtlarını ve raporlarını görmesini sağlar.",
        fields: [
          { name: "Yönetilen Kuyruklar & Temsilciler (supervisor:scope_filter)", type: "Çoklu Kuyruk / Kullanıcı Seçimi", defaultVal: "Tümü (Kısıtsız)", required: false, effect: "Seçildiğinde bu yönetici Wallboard, Canlı Çağrı, CDR ve Mola raporlarında yalnızca kendi ekibini görür." }
        ]
      },
      {
        tabTitle: "Sekme 11: Müşteri / Tenant (Çoklu Müşteri İzolasyon Ataması)",
        badge: "Kullanıcı Düzenle 11/11",
        screenshot: { src: "/screenshots/tabs/users/11-musteri-tenant.jpg", caption: "Kullanıcı Düzenle → Sekme 11: Müşteri / Tenant — Multi-Tenant izolasyon ataması", routeHint: "Kullanıcılar → Düzenle → Müşteri / Tenant" },
        description: "Aynı sunucuda birden fazla grup şirketi barındırılıyorsa kullanıcının hangi firmaya ait olduğunu belirler.",
        fields: [
          { name: "Bağlı Olduğu Müşteri (Tenant)", type: "Tenant Seçimi", defaultVal: "Ana Müşteri (tenant-default)", required: true, effect: "Kullanıcının tüm çağrı, rehber, ses kaydı ve sohbet verilerini ilgili şirketle %100 izole eder." }
        ]
      }
    ]
  },
  "anons-yonetimi": {
    editFormSections: [
      {
        tabTitle: "Bekleme Müzikleri (MOH) & Özel Anonslar — AI TTS Seslendirme Stüdyosu",
        badge: "Anons & MOH",
        screenshot: { src: "/screenshots/tabs/modals/anons-moh.jpg", caption: "Anons Yönetimi → Bekleme Müzikleri (MOH) sınıf yönetimi ve canlı önizleme", routeHint: "Santral → Anons Yönetimi → Bekleme Müzikleri" },
        description: "Sistem Anonsları, Bekleme Müzikleri (MOH) ve Özel Anonslar sekmeleri ile stüdyo kalitesinde AI TTS anons üretim penceresi.",
        fields: [
          { name: "Kategori Sekmeleri", type: "Sistem Anonsları / Bekleme Müzikleri / Özel Anonslar", defaultVal: "Otomatik 8kHz Mono WAV", required: true, effect: "Yüklenen MP3/WAV/OGG dosyaları FFmpeg ile Asterisk'in hatasız çaldığı 8000 Hz 16-bit Mono WAV'a dönüştürülür." },
          { name: "AI TTS Stüdyosu (ElevenLabs / Google / OpenAI)", type: "Ses Aktörü / Özel Voice ID / Üslup / Hız (Speaking Rate)", defaultVal: "Türkçe Doğal Ses", required: false, effect: "Rachel, Bella, Antoni, Josh, Adam, George veya kendi klonlanmış Voice ID'niz ile metinden anında profesyonel anons üretir." }
        ]
      },
      {
        tabTitle: "Yeni Anons / AI TTS Oluşturma Penceresi",
        badge: "Anons Ekle",
        screenshot: { src: "/screenshots/tabs/modals/anons-tts-modal.jpg", caption: "Anons Yönetimi → Yeni Anons / AI TTS Stüdyo penceresi", routeHint: "Santral → Anons Yönetimi → +" },
        description: "Dosya yükleyerek veya doğrudan metin yazıp AI ile seslendirerek yeni anons kaydetme ekranı.",
        fields: [
          { name: "Medya Adı & Okunacak Anons Metni", type: "Metin + Çok Satırlı Script", defaultVal: "Zorunlu", required: true, effect: "Kaydedilen anons anında CallFlow IVR ve ACD Kuyruk listelerinde seçilebilir hale gelir." }
        ]
      }
    ]
  },
  "acd-kuyruk": {
    editFormSections: [
      {
        tabTitle: "Sekme 1: Genel (Kimlik, Çalma Stratejisi, Kapasite, ACW & Maks. Eşzamanlı Mola)",
        badge: "Kuyruk Düzenle 1/11",
        screenshot: { src: "/screenshots/tabs/queues/01-genel.jpg", caption: "Kuyruk Düzenle → Sekme 1: Temel Kimlik, Çağrı Dağıtım Stratejisi, Kapasite, ACW ve Mola Limitleri", routeHint: "ACD Kuyruk → Düzenle → Genel" },
        description: "Kuyruğun adı, dahili numarası, çalma algoritması, temsilci çalma süresi, maksimum bekleyen kapasitesi, ACW wrap-up ve eşzamanlı mola kotası.",
        fields: [
          { name: "Kuyruk İsmi, Numarası & Kuyruk İsmini Telefon Ekranında Göster", type: "Metin + 2000+ + Toggle", defaultVal: "Açık", required: true, effect: "Birden fazla kuyruğa bakan temsilcinin telefon ekranında çağrının hangi kuyruktan geldiğini (örn. SATIS:) gösterir." },
          { name: "Çalma Düzeni (Strategy) & Temsilci Çalma Süresi (sn)", type: "rrmemory / ringall / leastrecent / fewestcalls / random / linear / wrandom", defaultVal: "rrmemory / 15–20 sn", required: true, effect: "Çağrıların temsilcilere adil dağıtım algoritmasını ve bir temsilci açmazsa kaç saniyede sıradakine geçeceğini belirler." },
          { name: "Maks. Bekleyen Çağrı, ACW Süresi (sn) & Maks. Eşzamanlı Mola", type: "Integer (0 = Sınırsız)", defaultVal: "0 / 5–10 sn / 0", required: false, effect: "ACW: Çağrı bitiminde not giriş dinlenmesi. Maks. Eşzamanlı Mola > 0 ise kota dolunca yeni mola talebi Süpervizör onayına düşer." }
        ]
      },
      {
        tabTitle: "Sekme 2: Çağrı Sonuç Kodları (Dispositions / Etiketler)",
        badge: "Kuyruk Düzenle 2/11",
        screenshot: { src: "/screenshots/tabs/queues/02-sonuc-kodlari.jpg", caption: "Kuyruk Düzenle → Sekme 2: Görüşme sonu seçilecek Çağrı Sonuç Kodları (Disposition) listesi", routeHint: "ACD Kuyruk → Düzenle → Çağrı Sonuç Kodları" },
        description: "Bu kuyruktan gelen her görüşme bittiğinde temsilcinin seçeceği (veya AI Not Asistanının önereceği) standart sonuç kodları.",
        fields: [
          { name: "Sonuç Kodu Listesi & Zorunluluk", type: "Örn. Satış Tamamlandı, Bilgi Verildi, Geri Aranacak, Şikayet", defaultVal: "Özelleştirilebilir", required: false, effect: "Çağrı Sonuç Kodları Raporu'nda kuyruk bazlı dönüşüm analizini besler." }
        ]
      },
      {
        tabTitle: "Sekme 3: Otomatik Mola (RONA) & Bağlantı Kopma Koruması",
        badge: "Kuyruk Düzenle 3/11",
        screenshot: { src: "/screenshots/tabs/queues/03-rona.jpg", caption: "Kuyruk Düzenle → Sekme 3: Otomatik Mola (RONA), kopma toleransı ve temsilci bildirim kuralları", routeHint: "ACD Kuyruk → Düzenle → Otomatik Mola (RONA)" },
        description: "Masa başında olmayıp çağrıyı açmayan veya interneti kopan temsilcinin müşterileri bekletmesini engelleyen koruma motoru.",
        fields: [
          { name: "Üst Üste Kaçırılan Çağrı Limiti (RONA)", type: "Integer (1–5)", defaultVal: "2", required: false, effect: "Üst üste X çağrıya cevap vermeyen temsilciyi otomatik RONA molasına alır." },
          { name: "Kopma Tolerans Süresi (sn), Bağlantı Geldiğinde Davranış & Bildirim Kanalı", type: "Saniye + Oto Dön/Molada Kal + Uyarı", defaultVal: "30 sn", required: false, effect: "Anlık internet kopmalarında temsilciye tolerans tanır; süre aşılırsa mola/uyarı uygular." }
        ]
      },
      {
        tabTitle: "Sekme 4: Otomatik Logout (Mesai Sonu Otomatik Çıkış)",
        badge: "Kuyruk Düzenle 4/11",
        screenshot: { src: "/screenshots/tabs/queues/04-logout.jpg", caption: "Kuyruk Düzenle → Sekme 4: Mesai sonu otomatik logout gün, saat ve aksiyon kapsamı", routeHint: "ACD Kuyruk → Düzenle → Otomatik Logout" },
        description: "Mesai bitiminde çıkış yapmayı unutan temsilcileri belirlenen gün ve saatte otomatik logout eder.",
        fields: [
          { name: "Zamanlama Modu, Uygulanacak Günler & Saat", type: "Gece Yarısı / Özel Saat + Pzt–Paz + HH:MM", defaultVal: "18:00", required: false, effect: "Mola & Puantaj Raporu'nda gece 23:59'a kadar açık kalmış sahte mesai oluşmasını engeller." },
          { name: "Otomatik Çıkış Kapsamı (Aksiyon)", type: "Sadece Kuyruktan Çıkar / Tam Sistem Logout", defaultVal: "Kuyruktan Çıkar", required: false, effect: "Temsilcinin sadece kuyruk üyeliğini mi yoksa tam web oturumunu mu kapatacağını belirler." }
        ]
      },
      {
        tabTitle: "Sekme 5: Anons & Bekleme (Karşılama, Bekleme Müziği, Sıra & Tahmini Süre Anonsu)",
        badge: "Kuyruk Düzenle 5/11",
        screenshot: { src: "/screenshots/tabs/queues/05-anons-bekleme.jpg", caption: "Kuyruk Düzenle → Sekme 5: Karşılama anonsu, Bekleme Müziği (MOH), sıra ve tahmini süre anonsları", routeHint: "ACD Kuyruk → Düzenle → Anons & Bekleme" },
        description: "Müşterinin kuyruğa girdiğinde ve temsilci beklerken duyacağı tüm karşılama, müzik ve sıra bildirim ayarları.",
        fields: [
          { name: "Karşılama Anonsu & Aktif Bekleme Müziği Sınıfı (MOH)", type: "Anons / MOH Seçimi", defaultVal: "default", required: false, effect: "Kuyruğa giren müşteriye ilk çalınacak anons ve ardından dinletilecek müzik." },
          { name: "Sıra Numarası Anonsu & Tahmini Bekleme Süresi Anonsu", type: "Toggle + Sıklık (sn)", defaultVal: "60 sn", required: false, effect: "'Şu an sırada 2. kişisiniz' anonsuyla müşterinin hattı kapatma (terk) oranını düşürür." }
        ]
      },
      {
        tabTitle: "Sekme 6: Maksimum Bekleme Süresi & Düşüş (Timeout) Yönlendirmesi",
        badge: "Kuyruk Düzenle 6/11",
        screenshot: { src: "/screenshots/tabs/queues/06-maks-bekleme.jpg", caption: "Kuyruk Düzenle → Sekme 6: Maksimum bekleme süresi dolduğunda çağrının taşacağı 1. ve 2. hedefler", routeHint: "ACD Kuyruk → Düzenle → Maksimum Bekleme Süresi" },
        description: "Müşterinin kuyrukta sonsuza kadar beklemesini önleyen zaman aşımı ve yedek hedef (AI Asistan / Yedek Kuyruk / Sesli Posta) yönlendirmesi.",
        fields: [
          { name: "Maksimum Bekleme Süresi (sn)", type: "Integer", defaultVal: "120 sn", required: false, effect: "Bu süre dolduğunda çağrı kuyruktan çıkarılıp aşağıdaki hedefe aktarılır." },
          { name: "1. Hedef Tipi & Anons Sonrası Hedef", type: "AI Temsilci / Yedek Kuyruk / Dahili / Sesli Posta / Anons + Hedef", defaultVal: "AI Asistan / Voicemail", required: false, effect: "Müşteriye bilgilendirme anonsu dinletip yapay zeka asistanına veya sesli mesaja bağlar." }
        ]
      },
      {
        tabTitle: "Sekme 7: Periyodik Anons & Beklerken IVR Tuşlama (Breakout)",
        badge: "Kuyruk Düzenle 7/11",
        screenshot: { src: "/screenshots/tabs/queues/07-periyodik-anons.jpg", caption: "Kuyruk Düzenle → Sekme 7: Periyodik bilgilendirme anonsu ve beklerken IVR tuşlama seçenekleri", routeHint: "ACD Kuyruk → Düzenle → Periyodik Anons" },
        description: "Bekleme sırasında belirli aralıklarla özel duyuru çalma ve müşterinin tuşlama yaparak (örn. 'Geri arama için 1'e basın') kuyruktan çıkabilmesi.",
        fields: [
          { name: "Periyodik Anons Ses Kaydı & Sıklığı", type: "Özel Anons + Saniye", defaultVal: "45–60 sn", required: false, effect: "Kampanya, web sitesi veya sıra bilgilendirmesi anonsu." },
          { name: "Anons Sırasında IVR Tuşlama Seçenekleri", type: "Tuş → Hedef", defaultVal: "Opsiyonel", required: false, effect: "Beklemek istemeyen müşterinin tek tuşla geri arama talebi bırakmasını veya AI asistana geçmesini sağlar." }
        ]
      },
      {
        tabTitle: "Sekme 8: Üyeler & Yöneticiler (Temsilci Atama, Öncelik Puanı / Penalty & Supervisor)",
        badge: "Kuyruk Düzenle 8/11",
        screenshot: { src: "/screenshots/tabs/queues/08-uyeler-yoneticiler.jpg", caption: "Kuyruk Düzenle → Sekme 8: Kuyruk temsilcileri, Penalty öncelik puanları ve Kuyruk Yöneticileri", routeHint: "ACD Kuyruk → Düzenle → Üyeler & Yöneticiler" },
        description: "Kuyruğa bakacak temsilcileri, 1./2. seviye yedek ekip önceliklerini (Penalty) ve kuyruğun süpervizörlerini belirler.",
        fields: [
          { name: "Üye Tipi & Öncelik Puanı (Penalty 0–10)", type: "Statik / Dinamik + Penalty", defaultVal: "Penalty 0", required: true, effect: "Penalty 0 birinci ekip, Penalty 1 herkes meşgulken devreye giren yedek ekiptir." },
          { name: "Kuyruk Yöneticileri (Supervisors)", type: "Kullanıcı Seçimi", defaultVal: "Opsiyonel", required: false, effect: "Mola onay talepleri ve cevapsız çağrı bildirimleri seçilen yöneticilere gider." }
        ]
      },
      {
        tabTitle: "Sekme 9: Tüm Agent'lar Meşgul / Çevrimdışı (Boş Kuyruk Taşma Kuralı)",
        badge: "Kuyruk Düzenle 9/11",
        screenshot: { src: "/screenshots/tabs/queues/09-tum-agent-mesgul.jpg", caption: "Kuyruk Düzenle → Sekme 9: Tüm temsilciler meşgul veya çevrimdışıyken uygulanacak anlık yönlendirme", routeHint: "ACD Kuyruk → Düzenle → Tüm Agent'lar Meşgul" },
        description: "Kuyrukta hiç aktif/müsait temsilci yoksa müşteriyi boşuna bekletmeden anında alternatif hedefe yönlendirir.",
        fields: [
          { name: "Boş/Meşgul Kuyruk Aksiyonu & Hedef", type: "Anons + AI Temsilci / Yedek Kuyruk / Voicemail", defaultVal: "Beklet veya Taşır", required: false, effect: "Tüm ekip toplantıdayken veya çevrimdışıyken sıfır saniye bekleme ile AI Asistana devredebilirsiniz." }
        ]
      },
      {
        tabTitle: "Sekme 10: Otomatik Geri Arama (Smart Callback)",
        badge: "Kuyruk Düzenle 10/11",
        screenshot: { src: "/screenshots/tabs/queues/10-geri-arama.jpg", caption: "Kuyruk Düzenle → Sekme 10: Kuyruk bazlı akıllı geri arama (Smart Callback) ve çıkış hattı", routeHint: "ACD Kuyruk → Düzenle → Otomatik Geri Arama" },
        description: "Yoğun saatlerde hatta bekleyemeden kapatan müşteriyi temsilci müsait olduğunda sistemin otomatik geri araması.",
        fields: [
          { name: "Smart Callback Aktifliği & Kullanılacak Dış Hat (Trunk)", type: "Toggle + SIP Trunk", defaultVal: "Kapalı", required: false, effect: "Temsilci boşa çıktığında önce temsilciyi, ardından kaçan müşteriyi otomatik arayıp bağlar." }
        ]
      },
      {
        tabTitle: "Sekme 11: Memnuniyet Anketi (Çok Sorulu Çağrı Sonu CSAT)",
        badge: "Kuyruk Düzenle 11/11",
        screenshot: { src: "/screenshots/tabs/queues/11-anket.jpg", caption: "Kuyruk Düzenle → Sekme 11: Çağrı sonrası çok sorulu DTMF memnuniyet anketi (CSAT) yapılandırması", routeHint: "ACD Kuyruk → Düzenle → Memnuniyet Anketi" },
        description: "Görüşme bittiğinde müşteriye 1–5 arası tuşlamalı memnuniyet soruları soran ve sonuçları Anket Raporu'na işleyen modül.",
        fields: [
          { name: "Anket Aktifliği & Çoklu Soru Seti (TTS / Kayıtlı Anons)", type: "1. Soru + Ek Sorular (1–5 DTMF)", defaultVal: "Kapalı", required: false, effect: "Temsilci telefonu kapattığında müşteri otomatik ankete aktarılır; düşük puanlar yöneticilere raporlanır." }
        ]
      }
    ]
  },
  "oto-provizyon": {
    editFormSections: [
      {
        tabTitle: "Yeni IP Telefon Ekle / Düzenle, LAN-WAN Modu & Canlı Provizyon İzleme",
        badge: "Cihaz Ekle / Düzenle",
        screenshot: { src: "/screenshots/tabs/modals/autoprovision-edit.jpg", caption: "Oto Provizyon → IP Telefon Ekle / Düzenle — MAC, Marka/Model, Dahili ve Ağ Modu (LAN/WAN)", routeHint: "Oto Provizyon → Ekle / Düzenle" },
        description: "Fiziksel masa telefonlarını MAC adresi üzerinden dahili aboneye bağlama ve LAN/WAN şablon seçimi.",
        fields: [
          { name: "Marka, Model, MAC Adresi & Bağlanacak SIP Cihazı (Dahili)", type: "Yealink / Fanvil / Grandstream / Cisco / Snom / Poly", defaultVal: "Zorunlu", required: true, effect: "Telefon açılışta /api/prov/<mac>.cfg dosyasını çekerek tüm SIP ve BLF tuşlarını otomatik yükler." },
          { name: "Bağlantı Lokasyonu (Ağ Modu)", type: "Aynı Ofis (LAN) / Uzak Şube (WAN) / Otomatik", defaultVal: "Otomatik", required: true, effect: "WAN seçildiğinde Nornia Connect FQDN ve SIP Edge adresini cihaza basar." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere: Ağdaki Yeni Cihazları Tara (Yerel Ağ IP Telefon Keşif Modalı)",
        badge: "Oto Provizyon → Ağ Tara",
        screenshot: { src: "/screenshots/tabs/deep/autoprov-scan.jpg", caption: "Oto Provizyon → Ağdaki Yeni Cihazları Tara (Wi-Fi ikonu): Yerel ağdaki eşleştirilmemiş Yealink, Fanvil, Grandstream ve Cisco telefonları otomatik tarama", routeHint: "Santral → Oto Provizyon → Ağdaki Yeni Cihazları Tara" },
        description: "Aynı yerel ağa (LAN) yeni takılan ancak henüz hiçbir dahiliye atanmamış IP masa telefonlarını MAC OUI imzasından keşfeden alt penceredir.",
        fields: [
          { name: "Otomatik Komşu & ARP/OUI Taraması + Tekrar Tara", type: "Yealink / Grandstream / Fanvil / Cisco / Snom / Poly", defaultVal: "Anlık Tarama", required: false, effect: "Ağdaki telefonların IP, MAC ve üretici bilgisini listeler; bulunan cihaza tek tıkla dahili eşleştirmesi başlatır. Farklı VLAN veya uzak şubedeki cihazlar için sağ üstteki '+' butonuyla manuel MAC eklenir." }
        ]
      },
      {
        level: 3,
        tabTitle: "Alt Pencere: Son Provizyon İstekleri (Canlı İzleme & HTTP .CFG/.XML Günlüğü)",
        badge: "Oto Provizyon → Canlı Loglar",
        screenshot: { src: "/screenshots/tabs/deep/autoprov-logs.jpg", caption: "Oto Provizyon → Son Provizyon İstekleri: Fiziksel telefonların santralden çektiği .cfg/.xml isteklerinin canlı izlenmesi", routeHint: "Santral → Oto Provizyon → Son Provizyon İstekleri" },
        description: "IP telefonların açılışta veya 'Check-Sync' sonrasında santrale attığı HTTP/HTTPS provizyon isteklerini canlı izleyen teşhis penceresidir.",
        fields: [
          { name: "Zaman Damgası, Kaynak IP, MAC / Dosya Adı, User-Agent & HTTP Sonucu", type: "Canlı İstek Akışı", defaultVal: "200 OK / 404", required: false, effect: "Bir telefon ayarlarını çekmiyorsa doğru URL'ye gelip gelmediğini, hangi dosya adını (.cfg/.xml) istediğini ve firmware User-Agent bilgisini anında görmenizi sağlar." }
        ]
      }
    ]
  },
  "giden-arama-kurali": {
    editFormSections: [
      {
        tabTitle: "Giden Arama Kuralı Ekle / Düzenle — Desen, Strip/Prepend, Failover Trunk & Saatli PIN",
        badge: "Kural Ekle / Düzenle",
        screenshot: { src: "/screenshots/tabs/modals/outbound-rule-edit.jpg", caption: "Giden Arama Kuralı → Ekle / Düzenle — Önek eşleştirme, operatör formatı, CallerID ve PIN koruması", routeHint: "Giden Arama Kuralı → Düzenle" },
        description: "Dış arama rotası, numara önek dönüşümü, yedek dış hat sırası, transit CallerID eşleşmesi ve saat bazlı PIN kilidi.",
        fields: [
          { name: "Genel & Birincil/Yedek Dış Hatlar (Failover)", type: "Sıralı Trunk Listesi", defaultVal: "1. Trunk → 2. Trunk", required: true, effect: "Birincil operatör dolu/erişilemezse çağrı otomatik yedek Trunk'tan çıkar." },
          { name: "Arama Düzeni, Strip/Prepend & Görünür Numara (CallerID Override)", type: "Örn. 05. → Strip 1, Prepend 90", defaultVal: "TR Standardı", required: true, effect: "Numarayı operatörün beklediği E.164 formatına çevirir ve çıkış CallerID'sini zorlar." },
          { name: "Giden Arama Parolası (PIN) & Başlangıç–Bitiş Saati", type: "4–6 Hane PIN + Saat Aralığı", defaultVal: "Opsiyonel", required: false, effect: "Mesai dışında veya uluslararası aramalarda çıkış öncesi sesli PIN ister." }
        ]
      }
    ]
  },
  "gelen-arama-kurali": {
    editFormSections: [
      {
        tabTitle: "Gelen Arama Kuralı Ekle / Düzenle — DID Modeli, CID Öneki & Hedef Seçimi",
        badge: "Gelen Kural Düzenle",
        screenshot: { src: "/screenshots/tabs/modals/inbound-rule-edit.jpg", caption: "Gelen Arama Kuralı → Ekle / Düzenle — DID eşleştirme modeli ve varsayılan yönlendirme hedefi", routeHint: "Gelen Arama Kuralı → Düzenle" },
        description: "Operatörden gelen dış hat numaralarının hangi Arama Akışına, Kuyruğa, AI Asistana veya Dahiliye gideceğini tanımlar.",
        fields: [
          { name: "DID Modeli & Arayan Numara (CID) Filtresi", type: "Tam DID / Wildcard", defaultVal: "908503607390", required: true, effect: "Asterisk REAL_DID çıkarıcı ile operatörün gönderdiği gerçek DID'yi yakalar." },
          { name: "Varsayılan Hedef Türü & Hedef Seçimi", type: "CallFlow / ACD Kuyruk / AI Temsilci / Dahili / Konferans / Sesli Posta", defaultVal: "CallFlow", required: true, effect: "Gelen çağrıyı anında hedefe yönlendirir." }
        ]
      }
    ]
  },
  "cagri-toplama-grubu": {
    editFormSections: [
      {
        tabTitle: "Çağrı Toplama Grubu Ekle / Düzenle (*8 / **)",
        badge: "Grup Düzenle",
        screenshot: { src: "/screenshots/tabs/modals/pickup-group-edit.jpg", caption: "Çağrı Toplama Grubu → Ekle / Düzenle — Departman pickup grubu ve üye dahili ataması", routeHint: "Çağrı Toplama Grubu → Düzenle" },
        description: "Aynı gruptaki dahililerin birbirlerinin çalan telefonlarını *8 veya BLF tuşu ile çekebilmesi için grup tanımlama penceresi.",
        fields: [
          { name: "Grup Adı & Üye Dahililer", type: "Metin + Çoklu Kullanıcı", defaultVal: "PJSIP named_pickup_group", required: true, effect: "Kaydedildiğinde pjsip_custom.conf anında güncellenir." }
        ]
      }
    ]
  },
  "abone-grubu": {
    editFormSections: [
      {
        tabTitle: "Abone Grubu Ekle / Düzenle (Class of Service — CoS)",
        badge: "Yetki Sınıfı Düzenle",
        screenshot: { src: "/screenshots/tabs/modals/subscriber-group-edit.jpg", caption: "Abone Grubu → Ekle / Düzenle — İzinli giden arama kuralları ve grup üyeleri", routeHint: "Abone Grubu → Düzenle" },
        description: "Aboneleri yetki sınıflarına ayırıp dış arama rotalarını ve gruplar arası iç arama izinlerini tek yerden yönetir.",
        fields: [
          { name: "Grup Adı, İzinli Giden Arama Kuralları & Grup Üyeleri", type: "CoS Politikası", defaultVal: "Standart", required: true, effect: "Seçilmeyen dış arama rotaları (örn. Uluslararası) bu gruptaki kullanıcılar için otomatik engellenir." }
        ]
      }
    ]
  }
};
