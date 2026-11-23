export const EDIT_GUIDES_PART3 = {
  "toplu-konfigurasyon": {
    editFormSections: [
      {
        tabTitle: "Adım 1: Modül Seçimi, 7 Hedef Kitle Filtresi & Toplu Hoş Geldiniz Maili",
        badge: "Toplu Konfigürasyon 1/3",
        description: "Tek seferde yüzlerce kaydı filtreleyip güvenli biçimde hedefleme ve kullanıcılara kurulum maili gönderme adımı.",
        fields: [
          { name: "Hedef Modül", type: "Kullanıcılar / Abone Grupları / ACD Kuyrukları / Giden Arama Kuralları", defaultVal: "users", required: true, effect: "Toplu düzenlemenin uygulanacağı santral nesne tipi." },
          { name: "7 Hedef Kapsam Filtresi", type: "Tümü / Abone Grubu / Çağrı Toplama Grubu / Rol / Departman / Lokasyon / Dahili Aralığı (1000-1050)", defaultVal: "all", required: true, effect: "Yalnızca kriterle eşleşen kayıtlar önizlemeye alınır; diğerlerine dokunulmaz." },
          { name: "Toplu Hoş Geldiniz & Kurulum E-Postası Gönder", type: "Tek Tık Toplu Mail", defaultVal: "E-postası olan kullanıcılar", required: false, effect: "Seçilen tüm kullanıcılara giriş URL'si, dahili numarası ve kurulum talimatlarını tek seferde gönderir." }
        ]
      },
      {
        tabTitle: "Adım 2: Kullanıcı & Abone Grubu Toplu Değişiklik Matrisi (20+ Özellik)",
        badge: "Toplu Konfigürasyon 2/3",
        description: "Kullanıcılar ve Abone Grupları modüllerinde tek tıkla güncellenebilen tüm alanlar (işaretlenmeyen alanlar olduğu gibi bırakılır).",
        fields: [
          { name: "Ses Kayıt, Hesap Durumu, Sesli Posta & E-Posta Gönderimi", type: "AI / Standart / Kapalı + Aktif/Pasif + Voicemail Toggle", defaultVal: "Seçimli", required: false, effect: "Tüm bir departmanda AI ses kaydını veya sesli posta e-posta gönderimini saniyeler içinde açar/kapatır." },
          { name: "Rol, Mobil Aktarım, Departman, Lokasyon, Giden Kural & Kuyruk", type: "Atama / Ekleme", defaultVal: "Seçimli", required: false, effect: "Yeni açılan 50 kullanıcıyı aynı anda Satış kuyruğuna, Abone Grubuna ve *8 Toplama Grubuna ekler." },
          { name: "Çaldırma Süresi, Beni Takip Et (Follow Me) & Yönlendirme", type: "Timeout (sn) + Hedef Tipi + Hedef", defaultVal: "Seçimli", required: false, effect: "Tüm ofis telefonlarının cevapsız yönlendirme süresini örn. 25 sn olarak standartlaştırır." },
          { name: "Dış Arama Karantinası, Kanal Limiti, CallerID, SIP Transport & Güvenlik", type: "Karantina / Limit / UDP-TCP-WSS / Oto Logout / Şifre Periyodu", defaultVal: "Seçimli", required: false, effect: "Tüm kullanıcılarda hareketsizlikte otomatik çıkışı (2 saat) ve 3 aylık şifre yenileme politikasını tek hamlede zorunlu kılar." }
        ]
      },
      {
        tabTitle: "Adım 3: Kuyruk / Giden Kural Toplu Güncelleme, Onay & Tek Tıkla Geri Al (Undo)",
        badge: "Toplu Konfigürasyon 3/3",
        description: "ACD Kuyrukları ve Giden Arama Kuralları üzerinde toplu politika değişikliği ve tam geri alma güvencesi.",
        fields: [
          { name: "Kuyruk Toplu Alanları", type: "Strateji / Çaldırma / ACW / Maks. Çağrı / Maks. Mola / RONA / Anons / Smart Callback / Anket / Meşgulü Çaldır", defaultVal: "Seçimli", required: false, effect: "Birden fazla çağrı kuyruğunun RONA, ACW ve memnuniyet anketi ayarlarını tek seferde eşitler." },
          { name: "Giden Kural Toplu Alanları", type: "Birincil/Yedek Trunk / CallerID / PIN Politikası", defaultVal: "Seçimli", required: false, effect: "Operatör değişikliğinde tüm giden kuralları saniyeler içinde yeni SIP Trunk'a geçirir." },
          { name: "Son Uygulanan İşlemler & Tek Tıkla Geri Al (Undo)", type: "Snapshot Geçmişi", defaultVal: "Her uygulamada", required: false, effect: "Her toplu işlemin eski değerleri yedeklenir; 'Geri Al (Undo)' ile anında eski duruma dönülür." }
        ]
      }
    ]
  },
  "rehber": {
    editFormSections: [
      {
        tabTitle: "Kişi Ekle / Düzenle, Çoklu Rehber Defteri & Toplu CSV İçe Aktarma",
        badge: "Rehber Yönetimi",
        description: "Müşteri kartı düzenleme, rehber defterleri ve IP telefon XML uzak rehber eşleştirme seçenekleri.",
        fields: [
          { name: "Ad Soyad, Telefon, Şirket, E-Posta & Özel Notlar", type: "Metin / Telefon / Email", defaultVal: "Son 10 hane eşleşir", required: true, effect: "Gelen çağrı, WhatsApp ve CDR raporlarında arayan adını otomatik gösterir." },
          { name: "Rehber Defteri (Phonebook) & Departman Görünürlüğü", type: "Genel / Özel Defter", defaultVal: "Genel Rehber", required: false, effect: "Örn. 'Tedarikçiler', 'VIP Müşteriler', 'Şubeler' şeklinde ayrı defterler oluşturup IP telefonlara XML olarak sunar." },
          { name: "Biyometrik Ses İmzası (Voiceprint) Bağlama", type: "Kayıt / Silme", defaultVal: "Opsiyonel", required: false, effect: "Müşterinin referans ses örneğini karta bağlayarak sonraki aramalarda sesinden otomatik tanınmasını sağlar." }
        ]
      }
    ]
  },
  "dis-hat-tanimi": {
    editFormSections: [
      {
        tabTitle: "Sekme 1: Genel (Register vs IP-Auth, Transport & DID)",
        badge: "Trunk Düzenle 1/4",
        description: "Operatör bağlantı kimliği, taşıma protokolü ve çıkış CallerID ayarları.",
        fields: [
          { name: "İsim & Dış Hat Tipi", type: "Registration (User/Pass) / IP-Auth (Static IP) / Peer", defaultVal: "Registration", required: true, effect: "0850 bulut operatörlerde Registration, Türk Telekom/Superonline Metro Ethernet hatlarda IP-Auth seçilir." },
          { name: "Host IP / Domain & Port", type: "IPv4 / FQDN + Port", defaultVal: "5060", required: true, effect: "Operatör SBC adresi ve SIP sinyal portu." },
          { name: "Kullanıcı Adı, SIP Parolası & Taşıma (Transport)", type: "UDP / TCP / TLS", defaultVal: "UDP", required: true, effect: "PJSIP registration ve outbound auth kimlik bilgileri." },
          { name: "Görünür Numara (DID / Caller ID) & Arama Yönü", type: "E.164 + Gelen/Giden/Çift Yönlü", defaultVal: "Çift Yönlü", required: true, effect: "Varsayılan çıkış CallerID numarası ve hattın sadece gelen/giden kısıtlaması." },
          { name: "İç Santral / Transit Trunk Modu (SIP Gateway — Diğer Santral Bağlantısı)", type: "Toggle (Açık / Kapalı)", defaultVal: "Kapalı", required: false, effect: "Başka bir Avaya, Cisco CUCM, Karel, Grandstream veya şube Asterisk santrali ile karşılıklı dahili-to-dahili transit köprü kurmak için kullanılır." }
        ]
      },
      {
        tabTitle: "Sekme 2: Dakika Paketi & Maliyet Takibi (package)",
        badge: "Trunk Düzenle 2/4",
        description: "Operatörünüzden satın aldığınız aylık dakika paketini ve ücretlendirme periyodunu tanımlarsınız.",
        fields: [
          { name: "Aylık Paket Dakikası (dk)", type: "Integer", defaultVal: "Örn. 5000 dk", required: false, effect: "Operatör Dakika & Paket Raporu'nda tüketim yüzdesi ve kalan dakika buradan hesaplanır." },
          { name: "Paket Yenilenme / Sıfırlama Günü", type: "Ayın Günü (1–28)", defaultVal: "1", required: false, effect: "Fatura kesim gününüzde paket sayacı otomatik sıfırlanır." },
          { name: "Ücretlendirme Periyodu (Billing Increment)", type: "1 sn / 6 sn / 60 sn", defaultVal: "60 sn", required: false, effect: "Operatörün görüşmeleri saniye mi yoksa dakika başı yuvarlayarak mı ücretlendirdiğini yansıtır." }
        ]
      },
      {
        tabTitle: "Sekme 3: Gelişmiş (9 Kodek Önceliği, Max Kanal, DTMF & Qualify)",
        badge: "Trunk Düzenle 3/4",
        description: "Ses kalitesi, kanal kapasitesi ve bağlantı canlılık ayarları.",
        fields: [
          { name: "Ses & Video Kodek Önceliği", type: "alaw, ulaw, g722, g729, opus, gsm, ilbc, h264, vp8", defaultVal: "alaw, ulaw", required: true, effect: "Türkiye'deki tüm PSTN/GSM operatörleriyle %100 uyumluluk için G.711 A-Law (alaw) 1. sırada olmalıdır." },
          { name: "Maksimum Eş Zamanlı Çağrı (Max Channels)", type: "Integer", defaultVal: "30", required: false, effect: "Hattın sözleşmeli kanal kapasitesi dolduğunda giden çağrıları otomatik yedek Trunk'a yönlendirir." },
          { name: "DTMF Modu & Qualify Keepalive", type: "rfc4733 / inband / auto + 60 sn", defaultVal: "rfc4733 / 60 sn", required: false, effect: "IVR tuşlamalarının operatör üzerinden hatasız geçmesi ve hat düşerse anında algılanması için kullanılır." }
        ]
      },
      {
        tabTitle: "Sekme 4: SIP Başlıkları & Çoklu /30 VLAN Policy Routing (Table 201+)",
        badge: "Trunk Düzenle 4/4",
        description: "Kurumsal operatörlerin istediği özel SIP başlıkları ve aynı SBC bloğuna giden çoklu Metro/VLAN hatları için otomatik Linux Policy Routing.",
        fields: [
          { name: "Arayan / Aranan SIP Başlık Kuralları (PAI / RPID / Diversion)", type: "P-Asserted-Identity / Remote-Party-ID / From-User", defaultVal: "Otomatik", required: false, effect: "Operatörün CallerID doğrulaması için beklediği özel SIP başlık biçimini seçer." },
          { name: "1. Ağ Kartı / VLAN Arayüzü (Interface)", type: "Örn. ens192.100", defaultVal: "Opsiyonel", required: false, effect: "Aynı operatör SBC'sine giden çoklu /30 hatlarda trafiğin çıkacağı fiziksel/VLAN arayüzü." },
          { name: "2. Santral Yerel IP / CIDR (/30) & 3. Hat Gateway (GW)", type: "IPv4/30 + Gateway IPv4", defaultVal: "Opsiyonel", required: false, effect: "Nornia bu yerel IP'yi ağ kartına ekler ve özel Linux yönlendirme tablosu (Table 201+) oluşturur." },
          { name: "4. Operatör SBC & Media Rota Blokları & 5. Ek DID Blokları", type: "CIDR (örn. 10.99.1.0/24) + DID Listesi", defaultVal: "Opsiyonel", required: false, effect: "SIP ve RTP paketlerinin yalnızca ilgili /30 hattan operatör SBC/Media sunucularına ulaşmasını ve gelen çağrıların doğru Trunk'a eşleşmesini garanti eder." }
        ]
      }
    ]
  },
  "konferans": {
    editFormSections: [
      {
        tabTitle: "Yeni Konferans Odası / Konferans Odası Düzenle Formu",
        badge: "ConfBridge Düzenle",
        description: "Sesli toplantı odası kimliği, PIN güvenliği, otomatik davet edilecek katılımcılar ve ses kaydı ayarları.",
        fields: [
          { name: "Oda Numarası & Oda Adı", type: "3000+ / Metin", defaultVal: "3000", required: true, effect: "İçeriden veya dış IVR'dan aranacak toplantı odası numarası." },
          { name: "Katılımcı PIN, Moderatör PIN & Moderatörü Bekle", type: "4–8 Hane + Toggle", defaultVal: "Opsiyonel", required: false, effect: "Yönetici odaya girmeden katılımcıların birbirini duymasını engelleyip bekleme müziği çalar." },
          { name: "Eklenecek Dahili & Harici Katılımcılar (Dial-Out)", type: "Dahili + Dış Telefonlar", defaultVal: "Opsiyonel", required: false, effect: "Tek tıkla tüm iç ve dış katılımcıları aynı anda çaldırıp toplantıya davet edebilirsiniz." },
          { name: "Ses Kaydı (MixMonitor)", type: "Toggle", defaultVal: "Açık", required: false, effect: "Toplantının tamamını WAV olarak kaydeder ve Konferans Raporu'nda saklar." }
        ]
      }
    ]
  },
  "hizli-arama": {
    editFormSections: [
      {
        tabTitle: "Yeni Hızlı Arama / Hızlı Arama Düzenle Formu",
        badge: "Speed Dial Düzenle",
        description: "Kısa kod, uzun hedef numara ve açıklama alanları.",
        fields: [
          { name: "Kısa Kod (Code)", type: "Örn. *01, 801", defaultVal: "Benzersiz", required: true, effect: "Masa telefonu ve WebPhone'dan çevrilecek kısa numara." },
          { name: "Uzun Numara & Açıklama", type: "Telefon + Etiket", defaultVal: "Zorunlu", required: true, effect: "Aranacak dış telefon numarası ve Temsilci Paneli'nde görünecek açıklayıcı ad." }
        ]
      }
    ]
  },
  "numara-engelleme": {
    editFormSections: [
      {
        tabTitle: "Yeni Kişi Engelle (Telefon/E-Posta) & Yasaklı Kelime/Cümle Ekleme",
        badge: "Kara Liste & Suistimal",
        description: "Numara/e-posta kara listesi ve görüşmelerde otomatik engel tetikleyen yasaklı ifade tanımları.",
        fields: [
          { name: "Engel Türü (Telefon / E-Posta)", type: "phone / email", defaultVal: "phone", required: true, effect: "Hem sesli/WhatsApp telefon numaralarını hem de istenmeyen spam e-posta adreslerini tek merkezden engeller." },
          { name: "Telefon Numarası / E-Posta & Engelleme Nedeni", type: "Değer + Gerekçe", defaultVal: "Zorunlu", required: true, effect: "Gelen çağrıları daha santral girişinde reddeder ve Engellenen Çağrı Raporu'na gerekçesiyle yazar." },
          { name: "Yasaklı Kelime / Cümle (Abuse Filter)", type: "İfade Listesi", defaultVal: "Suistimal Koruması", required: false, effect: "AI görüşmelerinde müşteri ağır küfür/hakaret ederse otomatik kara listeye alma ve yöneticiye bildirim tetikleyicisidir." }
        ]
      }
    ]
  },
  "zamanlanmis-raporlar": {
    editFormSections: [
      {
        tabTitle: "Yeni Zamanlanmış Rapor Ekle / Düzenle & Gönderim Günlüğü",
        badge: "Otomatik Rapor Görevi",
        description: "Rapor periyodu, veri dönemi, alıcılar ve canlı gönderim geçmişi.",
        fields: [
          { name: "Rapor Görevi Başlığı & Rapor Türü", type: "Standart / Özel Rapor", defaultVal: "CEO Özet", required: true, effect: "E-posta konu satırında görünecek ad ve üretilecek rapor içeriği." },
          { name: "Gönderim Sıklığı, Saati (TR), Haftanın/Ayın Günü", type: "Günlük / Haftalık / Aylık (1–28) + HH:MM", defaultVal: "Günlük 08:30", required: true, effect: "Türkiye saat diliminde belirlenen anda raporu otomatik derleyip gönderir." },
          { name: "Raporlanacak Veri Dönemi", type: "Dün / Son 7 Gün / Geçen Ay", defaultVal: "Dün", required: true, effect: "Raporun hangi tarih aralığındaki verileri kapsayacağını belirler." },
          { name: "Alıcı Kullanıcılar, Ek Harici E-Postalar & Son Gönderim Günlüğü", type: "Alıcı Listesi + Log", defaultVal: "Şimdi Çalıştır Testi", required: true, effect: "Gönderimlerin başarı/hata durumunu tarihçede saklar." }
        ]
      }
    ]
  },
  "arama-akis-yonetimi": {
    editFormSections: [
      {
        tabTitle: "CallFlow Düğüm Türleri 1–6: Başlangıç, Mesai/Tatil, IVR/DTMF, Anons/TTS, WhatsApp & API",
        badge: "Görsel Düğümler 1/2",
        description: "Arama Akış Editöründe tuvale sürükleyebileceğiniz her düğümün içindeki tam parametre seti.",
        fields: [
          { name: "1. Akış Başlangıcı (node-start)", type: "Giriş Düğümü", defaultVal: "Akış başına 1", required: true, effect: "Gelen Arama Kuralından (DID) gelen çağrının akışa girdiği kök nokta." },
          { name: "2. Mesai & Resmi Tatil Kontrolü", type: "Başlangıç/Bitiş Saati + Aktif Günler + Özel Günler", defaultVal: "3 Çıkış: active / inactive / holiday", required: false, effect: "Çağrıyı Mesai Saatleri, Mesai Dışı ve Resmi Tatil kollarına anlık olarak ayırır." },
          { name: "3. IVR / Tuşlama Topla (DTMF)", type: "Anons (recorded/tts) + Değişken Ataması (#) + Hata/Limit Kolu", defaultVal: "output / error", required: false, effect: "Müşteriden tek tuş (1, 2, 3) veya çok haneli numara (örn. T.C./Sipariş No + #) alır ve değişkene kaydeder." },
          { name: "4. Dinamik Anons / TTS Oynat", type: "Kayıtlı Anons / Dinamik TTS Metni", defaultVal: "recorded / tts", required: false, effect: "Değişken içeren dinamik metinleri (örn. 'Kargonuz dağıtıma çıkmıştır') anında seslendirir." },
          { name: "5. WhatsApp Mesajı Gönder Düğümü", type: "Alıcı Telefon ({caller}) + Mesaj Metni", defaultVal: "Otomatik Gönderim", required: false, effect: "Müşteri örn. 'Konum ve IBAN için 4'e basın' dediğinde arayan numaraya anında WhatsApp mesajı atar." },
          { name: "6. Harici API / CRM Sorgu Düğümü", type: "Tanımlı API + Sonucun Kaydedileceği Değişken", defaultVal: "success / error", required: false, effect: "Çağrı sırasında ERP'den müşteri tipi (VIP/Standart) veya borç durumu sorgulayıp değişkene yazar." }
        ]
      },
      {
        tabTitle: "CallFlow Düğüm Türleri 7–12: Koşul, Döngü, AI Temsilci, Geçit/Portal, Hedef & Canlı Simülatör",
        badge: "Görsel Düğümler 2/2",
        description: "Mantıksal dallanma, yapay zeka yönlendirme, alt akış geçitleri ve telefon açmadan test simülatörü.",
        fields: [
          { name: "7. Koşul / Karşılaştırma (If/Else)", type: "Kontrol Değeri + Operatör (==, !=, >, içerir) + Hedef Değer", defaultVal: "true / false", required: false, effect: "Örn. `musteri_tipi == VIP` ise VIP kuyruğa, değilse standart IVR'a gönderir." },
          { name: "8. Döngü / Sayaç (Loop)", type: "Maksimum Tekrar Sayısı", defaultVal: "loop / completed (3 tekrar)", required: false, effect: "Hatalı tuşlamada menüyü en fazla 3 kez tekrarlar, limit dolunca operatöre bağlar." },
          { name: "9. Gemini Yapay Zeka Temsilcisi", type: "AI Temsilci Seçimi + Context Şablonu", defaultVal: "AudioSocket 9092", required: false, effect: "Çağrıyı seçilen AI Sesli Asistana aktarır; önceki düğümlerden toplanan değişkenleri (sipariş no vb.) AI bağlamına geçirir." },
          { name: "10. Geçit (Portal) & Alt Akış", type: "Geçit Adı", defaultVal: "Modüler Bağlantı", required: false, effect: "Karmaşık büyük akışları temiz tutmak için çağrıyı başka bir akışa veya portala atlatır." },
          { name: "11. Hedef Yönlendirme", type: "Dahili Abone / ACD Kuyruk / Dış Hat (Trunk) / Konferans / Sesli Posta / Kapat", defaultVal: "Son Hedef", required: true, effect: "Çağrıyı son varış noktasına iletir." },
          { name: "12. Canlı Akış Simülatörü (Test Aracı)", type: "Arayan CID + Aranan DID + Tuşlanan DTMF", defaultVal: "/api/settings/call-flow/simulate", required: false, effect: "Gerçek arama yapmadan verdiğiniz senaryoyla çağrının hangi düğümlerden geçtiğini adım adım vurgulayarak doğrular." }
        ]
      }
    ]
  },
  "mesai-ve-resmi-tatiller": {
    editFormSections: [
      {
        tabTitle: "Haftalık Mesai Çizelgesi, Saat Dilimi & Resmi/Özel Tatil Ekleme Formu",
        badge: "Takvim Düzenle",
        description: "8 hazır bölge saat dilimi, gün bazlı çalışma saatleri ve Türkiye resmi/dini tatil yönetimi.",
        fields: [
          { name: "Saat Dilimi", type: "Europe/Istanbul, Asia/Nicosia, Asia/Baku, Europe/Berlin, Europe/London, Europe/Amsterdam, Asia/Dubai, America/New_York", defaultVal: "Europe/Istanbul", required: true, effect: "Tüm mesai ve tatil kontrollerinin referans saat dilimi." },
          { name: "Haftalık Günler (Pazartesi–Pazar)", type: "Aktif Toggle + Başlangıç / Bitiş Saati", defaultVal: "Pzt–Cum 09:00–18:00", required: true, effect: "Her gün için ayrı açılış-kapanış saati belirlenir." },
          { name: "Hazır Türkiye Resmi & Dini Tatilleri + Özel Gün Ekle", type: "Tatil Adı + Tarih Aralığı + Açılış/Kapanış (Arife yarım gün)", defaultVal: "1 Ocak – 29 Ekim + Bayramlar", required: false, effect: "28 Ekim ve bayram arifeleri için yarım gün (09:00–13:00) özel kapanış saati tanımlanabilir." }
        ]
      }
    ]
  },
  "dis-arama-dialer": {
    editFormSections: [
      {
        tabTitle: "Yeni Dış Arama Kampanyası / Kampanya Düzenle Formu",
        badge: "Dialer Kampanya",
        description: "Otomatik dış arama kampanyasının tüm hız, zaman, hedef ve tekrar deneme parametreleri.",
        fields: [
          { name: "Kampanya Adı & Arama Çıkış Hattı (Trunk)", type: "Metin + SIP Trunk", defaultVal: "Operator_Trunk", required: true, effect: "Kampanya aramalarının hangi dış hattan çıkacağını belirler." },
          { name: "Eşzamanlı Arama Limiti, Tekrar Denemesi & Aralığı (dk)", type: "Concurrency + Retry + Delay", defaultVal: "3 kanal / 2 deneme / 30 dk", required: true, effect: "Aynı anda kaç çağrı açılacağını ve meşgul/cevapsız numaraların kaç dakika sonra tekrar aranacağını yönetir." },
          { name: "Çağrı Yanıtlandığında Hedef & Hedef Seçimi", type: "AI Temsilci / ACD Kuyruk / Anons / CallFlow", defaultVal: "AI Temsilci", required: true, effect: "Müşteri telefonu açtığı anda kime bağlanacağını seçer." },
          { name: "Başlangıç & Bitiş Saati (Yasal Arama Penceresi)", type: "HH:MM – HH:MM", defaultVal: "09:30 – 18:30", required: true, effect: "Pencere dışında kampanya otomatik duraklatılır, ertesi gün saatinde kendiliğinden devam eder." },
          { name: "Telefon Numaraları (CSV veya Satır Satır)", type: "\"Numara, İsim\" veya CSV", defaultVal: "Toplu Liste", required: true, effect: "Her satıra bir müşteri numarası/adı veya CSV dosyası yüklenir." }
        ]
      }
    ]
  },
  "randevu-takvimi": {
    editFormSections: [
      {
        tabTitle: "Randevu Ekle / Düzenle & Durum Yönetimi",
        badge: "Takvim Detay",
        description: "Manuel veya AI Asistan tarafından alınan randevuların tüm kart alanları.",
        fields: [
          { name: "Müşteri Adı, Telefonu, Tarih/Saat & Notlar", type: "Form Alanları", defaultVal: "Zorunlu", required: true, effect: "Görüşme bağlamı, randevu konusu ve tek tıkla arama/WhatsApp teyit bağlantısı." },
          { name: "Durum & Kaynak Rozeti", type: "Bekliyor / Onaylandı / Tamamlandı / İptal", defaultVal: "Onaylandı", required: false, effect: "AI Randevu & Bilgi Bankası raporundaki dönüşüm oranlarını besler." }
        ]
      }
    ]
  }
};
