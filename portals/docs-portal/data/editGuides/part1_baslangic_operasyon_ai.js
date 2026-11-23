export const EDIT_GUIDES_PART1 = {
  "ilk-kurulum-sihirbazi": {
    editFormSections: [
      {
        tabTitle: "Adım 1: Ağ & NAT Ayarları (Netplan + PJSIP Dinamik NAT)",
        badge: "Kurulum Adımı 1/6",
        description: "Sunucunun kalıcı yerel ağ kimliğini ve NAT arkasındaki dış IP davranışını tanımlar. Girilen yeni statik IP kurulumun ortasında oturumu koparmamak için Adım 6 tamamlandıktan 2 saniye sonra canlı uygulanır.",
        fields: [
          { name: "Algılanan Ağ Arayüzleri (NIC)", type: "Salt Okunur Bilgi", defaultVal: "enp0s3 / eth0", required: false, effect: "Sunucuda fiziksel/sanal olarak algılanan aktif ağ kartını ve o anki DHCP IPv4/CIDR adresini gösterir." },
          { name: "Santral Yerel LAN IP Adresi (CIDR)", type: "IPv4/Mask", defaultVal: "Mevcut IP /24", required: true, effect: "Örn. 192.168.1.25/24. /etc/netplan/99-nornia-static.yaml dosyasına yazılır; çakışan 00-installer-config.yaml otomatik yedeklenip devre dışı bırakılır." },
          { name: "Varsayılan Ağ Geçidi (Gateway)", type: "IPv4", defaultVal: "192.168.1.1", required: true, effect: "Sunucunun internete, operatör SIP sunucularına ve Nornia Connect Hub'a erişeceği yönlendirici IP adresi." },
          { name: "Birincil & İkincil DNS Sunucusu", type: "IPv4", defaultVal: "8.8.8.8 / 1.1.1.1", required: true, effect: "Alan adı çözümlemesi (connect.nornia.com.tr, sip.operatortelekom.com.tr, Let's Encrypt) için kullanılır." },
          { name: "PJSIP Dinamik NAT & Dış IP (External IP)", type: "Toggle + IPv4", defaultVal: "Aktif", required: false, effect: "Açıkken tüm PJSIP transport'larına (UDP/TCP/WS/WSS) external_signaling_address ve external_media_address eklenir; dış çağrılarda tek yönlü ses ve 32 sn kopma sorunu önlenir." },
          { name: "Yerel Ağ Aralıkları (Local Nets)", type: "CIDR Listesi", defaultVal: "192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12", required: false, effect: "Bu bloklardaki yerel telefon ve şubelerle görüşürken Asterisk Dış IP yerine yerel LAN IP'yi kullanır." }
        ],
        tips: [
          "IP adresinin sonuna mutlaka ağ maskesini (/24 gibi) yazın; maske eksikse sistem doğrulama uyarısı verir.",
          "Statik dış IP'niz yoksa veya sadece Nornia Connect (sıfır-port) kullanacaksanız Dış IP alanını boş bırakabilirsiniz."
        ]
      },
      {
        tabTitle: "Adım 2: Lisans Anahtarı & Donanım Kilidi Doğrulaması",
        badge: "Kurulum Adımı 2/6",
        description: "Sunucunun donanım parmak izini (HW-ID) gösterir ve Merkez Lisans Paneli'nden (panel.nornia.com.tr) üretilen imzalı AIDA-... anahtarını çevrimdışı/çevrimiçi doğrular.",
        fields: [
          { name: "Sunucu Donanım Kimliği (HW-ID)", type: "HW-XXXX-XXXX", defaultVal: "Otomatik Üretilir", required: true, effect: "Anakart UUID, /etc/machine-id ve birincil NIC MAC adresinden üretilen benzersiz kimlik. Lisans bu donanıma kilitlenir." },
          { name: "Lisans Anahtarı (License Key)", type: "AIDA-...[.BASE64]", defaultVal: "Boş", required: true, effect: "Nokta (.) sonrasındaki Base64 kota paketi büyük/küçük harf duyarlı korunarak okunur; bitiş tarihi, firma adı, müşteri kodu ve tüm lisans kotaları (max_users, max_concurrent_calls, allowed_features) anında ekranda önizlenir." }
        ]
      },
      {
        tabTitle: "Adım 3: Nornia Connect (Bulut Alt Alan Adı / FQDN) Seçimi",
        badge: "Kurulum Adımı 3/6",
        description: "Santralinize port açmadan HTTPS, WebRTC ve Uzak IP Telefon erişimi sağlayan <alt-alan>.nornia.com.tr adresini tescil eder.",
        fields: [
          { name: "Nornia Alt Alan Adı (Subdomain)", type: "Küçük harf/rakam", defaultVal: "Boş", required: true, effect: "'Kontrol Et' butonu Merkez Hub'a canlı HTTPS sorgusu atar. Başka santralde kilitli veya rezerve (app, api, dokuman, panel, connect) ise 'İleri' butonu kilitlenir." },
          { name: "Nornia Hub Adresi & Bağlantı Anahtarı", type: "HTTPS URL + Token", defaultVal: "https://connect.nornia.com.tr", required: false, effect: "Anahtar boş bırakılırsa Adım 2'deki lisans anahtarı tünel kimlik doğrulaması için otomatik kullanılır." }
        ]
      },
      {
        tabTitle: "Adım 4–6: Numara Planı, Yönetici Hesabı & Kurulumu Tamamla",
        badge: "Kurulum Adımı 4–6/6",
        description: "Firma kimliğini, dahili basamak planını ve süper yönetici hesabını oluşturur; son adımda tüm servisleri tek seferde yapılandırır.",
        fields: [
          { name: "Firma / Organizasyon Adı", type: "Metin", defaultVal: "Lisanstan otomatik gelir", required: true, effect: "Web başlığı, e-posta bildirimleri ve PDF rapor başlıklarında görünür." },
          { name: "Dahili Basamak Planı", type: "3 veya 4 Hane", defaultVal: "4 Hane (1000–1999)", required: true, effect: "Dahili, kuyruk (2000+), konferans (3000+) ve IVR (5000+) numara bloklarını ilklendirir." },
          { name: "Yönetici E-Posta & Şifre", type: "Email + Parola", defaultVal: "Zorunlu", required: true, effect: "Kurulum tamamlanınca eski demo kullanıcıları (200/201) temizlenir, yönetici hesabı açılır ve yeni sekmede https://<alt-alan>.nornia.com.tr/login açılır." }
        ]
      }
    ]
  },
  "masaustu-mobil-ve-webphone": {
    editFormSections: [
      {
        tabTitle: "WebPhone Ses Cihazları, Zil Sesi & Mikrofon Kontrolleri",
        badge: "Web Telefon Ayarları",
        description: "Temsilci Çağrı Paneli içindeki WebPhone modülünde her kullanıcı kendi bilgisayarındaki mikrofon, kulaklık ve ikincil zil hoparlörünü bağımsız seçebilir.",
        fields: [
          { name: "Mikrofon (Ses Girişi)", type: "Tarayıcı MediaDevice", defaultVal: "Sistem Varsayılanı", required: true, effect: "USB/Bluetooth çağrı merkezi kulaklığının mikrofonunu seçer; AI gürültü engelleme kullanıcı ayarından açılabilir." },
          { name: "Konuşma Hoparlörü (Ses Çıkışı)", type: "Audio Output", defaultVal: "Sistem Varsayılanı", required: true, effect: "Aktif görüşme sırasında karşı tarafın sesinin iletileceği kulaklık." },
          { name: "Zil Sesi Hoparlörü (Secondary Ringer)", type: "Audio Output", defaultVal: "Bilgisayar Hoparlörü", required: false, effect: "Kulaklık kafanızda değilken gelen çağrı zilinin bilgisayar hoparlöründen de çalmasını sağlar." },
          { name: "WebRTC 200 OK & Kayıt Takibi", type: "SIP.js 0.20.1", defaultVal: "Otomatik", required: false, effect: "Giriş yapıldığında anında WSS kayıt kurar; çıkış (Logout) yapıldığında /api/webrtc/unregister_notify ile kaydı düşürüp çevrimdışı gösterir." }
        ]
      },
      {
        tabTitle: "Masaüstü (PC/Mac), Mobil Uygulama & QR Sihirli Giriş",
        badge: "Çoklu Cihaz",
        description: "Kullanıcı kartındaki 'Uygulamalar & Kolay Giriş' bölümünden veya kullanıcı profilinden tüm cihazlar tek tıkla eşleştirilir.",
        fields: [
          { name: "Masaüstü Uygulaması (Windows / macOS Electron)", type: "Sistem Tepsisi + Kısayol", defaultVal: "Otomatik Güncelleme", required: false, effect: "Tarayıcı kapansa bile arka planda çalar, gelen çağrıda masaüstü bildirimi çıkarır ve CTI Screen Pop açar." },
          { name: "Mobil Uygulama (iOS / Android) & QR Kod", type: "Magic Login QR", defaultVal: "Tek Kullanımlık Token", required: false, effect: "Kullanıcı şifre veya SIP sunucu adresi yazmadan QR kodu okutarak mobil uygulamayı saniyeler içinde kaydeder." },
          { name: "Call Flip (*11) Canlı Cihaz Değiştirme", type: "Özellik Kodu", defaultVal: "*11", required: false, effect: "Örn. WebPhone'da konuşurken cep telefonunuzdan *11 tuşladığınızda ses 1 saniyeden kısa sürede mobile geçer, müşteri kesinti hissetmez." },
          { name: "Hot-Desking (*75 Giriş / *76 Çıkış)", type: "PIN + Gece Sıfırlama", defaultVal: "*75 / *76", required: false, effect: "Paylaşımlı masadaki IP telefona oturum açar; auto_logout_midnight aktifse gece 00:00'da masayı otomatik serbest bırakır." }
        ]
      }
    ]
  },
  "gercek-zamanli-ai-pano": {
    editFormSections: [
      {
        tabTitle: "Pano Üst Kartları, Grafikler & Canlı Akış Bileşenleri",
        badge: "Yönetici Kokpiti",
        description: "Gerçek Zamanlı AI Pano ekranındaki her kartın veri kaynağı, yenileme periyodu ve tıklama aksiyonu.",
        fields: [
          { name: "Günlük Çağrı Özeti Kartları", type: "Toplam / Cevaplanan / Kaçan / AI Çözüm", defaultVal: "00:00 UTC+3 Sıfırlama", required: false, effect: "Her gece yerel saat 00:00'da sıfırlanan anlık çağrı performansı. Kartlara tıklayarak ilgili CDR filtresine geçebilirsiniz." },
          { name: "Saatlik Trafik & AI vs. İnsan Dağılım Grafiği", type: "Çizgi / Bar Grafik", defaultVal: "Son 24 Saat", required: false, effect: "Günün yoğun saatlerini ve AI asistanın üstlendiği çağrı payını görselleştirir." },
          { name: "Canlı Duygu & Kriz Alarm Şeridi", type: "Pozitif / Nötr / Negatif", defaultVal: "Anlık WebSocket", required: false, effect: "Devam eden bir çağrıda negatif duygu/öfke skoru eşiği aşarsa üstte kırmızı kriz uyarısı belirir ve tek tıkla Canlı Çağrı İzleme açılır." },
          { name: "Son Görüşmeler & AI Özet Akışı", type: "Canlı Liste", defaultVal: "Son 10 Çağrı", required: false, effect: "Kapanan son çağrıların AI özetini, duygu etiketini ve QA skorunu gösterir." }
        ]
      }
    ]
  },
  "canli-izleme-paneli": {
    editFormSections: [
      {
        tabTitle: "Wallboard Düzen Özelleştirme, Eşik Alarmları & TV/Kiosk Modu",
        badge: "Wallboard Ayarları",
        description: "Wallboard üzerindeki kartları özelleştirme, kuyruk filtreleme ve alarm eşiklerini belirleme seçenekleri.",
        fields: [
          { name: "Görünür Widget & Kart Sıralaması", type: "Layout Editörü", defaultVal: "/api/wallboard/layout", required: false, effect: "Hangi KPI kartlarının, kuyruk kutularının ve temsilci tablolarının ekranda yer alacağını sunucuya kalıcı kaydeder." },
          { name: "Kuyruk Bekleme & SLA Uyarı Eşikleri", type: "Sarı / Kırmızı Sınır", defaultVal: "Bekleyen >=3, Süre >=30 sn", required: false, effect: "Eşik aşıldığında ilgili kuyruk kartı yanıp sönen kırmızı alarm durumuna geçer." },
          { name: "Temsilci Durum Sütunları", type: "Müsait / Konuşuyor / Mola / Süre", defaultVal: "Canlı Sayaç", required: false, effect: "Her temsilcinin hangi mola türünde kaç dakikadır beklediğini, bugünkü çağrı adedini ve aktif konuştuğu numarayı gösterir." },
          { name: "Tam Ekran (TV / Kiosk) Modu", type: "Üst Sağ Buton", defaultVal: "Kapalı", required: false, effect: "Sol menüyü ve üst çubuğu tamamen kaldırarak çağrı merkezi duvar TV'lerinde maksimum okunabilirlik sunar." }
        ]
      }
    ]
  },
  "canli-cagri-izleme": {
    editFormSections: [
      {
        tabTitle: "Canlı Çağrı Müdahale Butonları (Listen / Whisper / Barge / Transfer)",
        badge: "Süpervizör Araçları",
        description: "Aktif çağrılar listesindeki her satırda bulunan canlı müdahale aksiyonlarının teknik karşılıkları.",
        fields: [
          { name: "Sessiz Dinle (Listen — ChanSpy q)", type: "call_monitor:listen", defaultVal: "Tek Yönlü Dinleme", required: false, effect: "Süpervizörün telefonunu çaldırır; her iki tarafı duyar ama kimse süpervizörü duymaz." },
          { name: "Sufle / Fısılda (Whisper — ChanSpy qw)", type: "call_monitor:whisper", defaultVal: "Sadece Temsilci Duyar", required: false, effect: "Süpervizör konuşunca yalnızca temsilci (veya AI kanalı) duyar, müşteri duymaz. Yeni başlayan temsilciye canlı koçluk için kullanılır." },
          { name: "Araya Gir (Barge-In — ChanSpy qB)", type: "call_monitor:barge", defaultVal: "3'lü Konuşma", required: false, effect: "Süpervizörü doğrudan müşteri + temsilci görüşmesine dahil eder; kriz anlarında yönetimi devralmak için kullanılır." },
          { name: "Canlı Transfer (AMI Redirect)", type: "realtime_calls:write", defaultVal: "Dahili / Kuyruk", required: false, effect: "Devam eden çağrıyı temsilciye sormadan başka bir dahiliye, kuyruğa veya AI asistana aktarır." },
          { name: "Çağrıyı Sonlandır (Hangup)", type: "realtime_calls:write", defaultVal: "AMI Hangup", required: false, effect: "Takılı kalan veya istenmeyen kanalı anında kapatır." }
        ]
      },
      {
        tabTitle: "Canlı Temsilci Durum Müdahalesi & Mola Onay Kuyruğu",
        badge: "Supervisor Control",
        description: "Süpervizörlerin temsilcilerin durumlarını uzaktan değiştirmesi ve kuyruk mola kotasına takılan talepleri onaylaması.",
        fields: [
          { name: "Müsait / Molaya Çıkar / Moladan Döndür", type: "supervisor:agent_status", defaultVal: "Anlık Etki", required: false, effect: "Molada unutulan temsilciyi tek tıkla 'Müsait'e döndürür veya yemek/eğitim molasına alır; kuyruk pause durumu anında güncellenir." },
          { name: "Temsilci Oturum Kapatma (Force Logout)", type: "supervisor:agent_logout", defaultVal: "Zorla Çıkış", required: false, effect: "Mesai bitiminde oturumunu açık unutan temsilcinin WebPhone kaydını ve kuyruk üyeliğini uzaktan kapatır." },
          { name: "Bekleyen Mola Onay Talepleri", type: "Onayla / Reddet", defaultVal: "90 sn canlı bildirim", required: false, effect: "Kuyruğun 'Maks. Eşzamanlı Mola' limiti dolduğunda temsilcinin gönderdiği talep burada görünür; süpervizör tek tıkla onaylar veya reddeder." }
        ]
      }
    ]
  },
  "temsilci-cagri-paneli": {
    editFormSections: [
      {
        tabTitle: "Sekme 1–5: Pano, Web Telefon, Temsilciler, Hızlı Arama & Kayıp Çağrı",
        badge: "Agent Sekmeleri 1–5",
        description: "Temsilci Çağrı Panelindeki ilk 5 ana çalışma sekmesinin detaylı işlevleri ve rol yetki kodları.",
        fields: [
          { name: "1. Pano (call_panel:tab_dashboard)", type: "Günlük İstatistik", defaultVal: "00:00 Sıfırlama", required: false, effect: "Temsilcinin bugünkü gelen/giden/cevapsız çağrı sayıları, ortalama konuşma süresi ve mola türü bazlı (Yemek/İhtiyaç/Eğitim) dakika dağılımı." },
          { name: "2. Web Telefon (call_panel:tab_webphone)", type: "WebRTC Softphone", defaultVal: "Otomatik Kayıt", required: false, effect: "Tuş takımı, Mute, Hold (Bekletme), Kör/Danışmalı Transfer, 3'lü Konferans, KVKK Kayıt Duraklatma (*9), Call Flip (*11), Çağrı Reddi ve Rehbere Kaydet butonları." },
          { name: "3. Temsilciler (call_panel:tab_agents)", type: "BLF & Durum Matrisi", defaultVal: "Rol Bazlı Görünürlük", required: false, effect: "Diğer temsilcilerin anlık Müsait/Meşgul/Molada durumlarını, o durumdaki sürelerini, çağrı adetlerini ve giriş/çıkış saatlerini (granüler yetkiye göre) gösterir; tek tıkla arama veya transfer yapılır." },
          { name: "4. Hızlı Arama (call_panel:tab_speeddial)", type: "Kısa Kod Kartları", defaultVal: "Santral Speed Dial", required: false, effect: "Santralde tanımlı *01, *02 gibi hızlı arama hedeflerini tek tıkla arar." },
          { name: "5. Kayıp Çağrı (call_panel:tab_missed)", type: "Cevapsız Sahiplenme", defaultVal: "Claim Kilidi", required: false, effect: "Cevapsız çağrıları listeler. Temsilci 'Üzerime Al (Claim)' dediğinde çağrı kendi adına kilitlenir, diğer temsilciler aynı müşteriyi tekrar aramaz." }
        ]
      },
      {
        tabTitle: "Sekme 6–10: Rehber, Çağrı Geçmişi, Sesli Posta, Sohbet & Masa Telefonum",
        badge: "Agent Sekmeleri 6–10",
        description: "Temsilcinin müşteri geçmişine, sesli postalarına ve fiziksel masa telefonu tuşlarına eriştiği 5 ileri sekme.",
        fields: [
          { name: "6. Rehber (call_panel:tab_directory)", type: "Kurumsal Rehber", defaultVal: "Arama + Ekleme", required: false, effect: "Kayıtlı müşterileri arar, Müşteri 360° zaman tünelini açar ve tek tıkla arar." },
          { name: "7. Çağrı Geçmişi (call_panel:tab_history)", type: "Kişisel CDR", defaultVal: "Son Aramalar", required: false, effect: "Temsilcinin kendi görüşmelerini listeler; call_panel:listen_records ve view_transcripts yetkisi varsa ses kaydını dinleyip transkripti okuyabilir." },
          { name: "8. Sesli Posta (call_panel:tab_voicemail)", type: "Görsel Voicemail", defaultVal: "WAV Oynatıcı", required: false, effect: "Temsilcinin dahili numarasına bırakılan sesli mesajları *97 aramadan tarayıcıdan dinleme, okundu işaretleme ve silme." },
          { name: "9. Sohbet (call_panel:tab_chat)", type: "İç Mesaj / Omnichannel", defaultVal: "Canlı", required: false, effect: "Temsilcinin atanmış WhatsApp/Chat görüşmelerine panelden ayrılmadan yanıt vermesi." },
          { name: "10. Masa Telefonum (call_panel:tab_deskphone)", type: "BLF / Softkey Editör", defaultVal: "Oto Provizyon Sync", required: false, effect: "Temsilcinin masadaki fiziksel IP telefonunun BLF ve hızlı arama tuşlarını kendi ekranından düzenlemesi." }
        ]
      },
      {
        tabTitle: "Görüşme İçi Akıllı Yardımcılar (Müşteri 360°, CTI, AI Not, Canlı Çeviri & Callback)",
        badge: "Akıllı Özellikler",
        description: "Aktif çağrı geldiği anda otomatik devreye giren verimlilik araçları.",
        fields: [
          { name: "CTI Screen Pop (call_panel:cti_screen_pop)", type: "Otomatik 2. Sekme", defaultVal: "Çalarken / Açılınca", required: false, effect: "Müşteri aradığında tanımlı dış CRM kartını (Zoho/HubSpot/Özel ERP) telefon numarasıyla yeni sekmede otomatik açar." },
          { name: "AI Otomatik Çağrı Notu & Sonuç Kodu (ACW)", type: "call_panel:ai_note_assistant", defaultVal: "Görüşme Sonu", required: false, effect: "Görüşme özetini ve en uygun Çağrı Sonuç Kodunu (Disposition) yapay zeka ile önerir; temsilci tek tıkla onaylar." },
          { name: "Anlık Konuşma Çevirisi & Sesli Tercüman", type: "live_translation / voice_interpreter", defaultVal: "TR ↔ EN/DE/AR/RU", required: false, effect: "Yabancı müşteri konuşurken ekrana canlı Türkçe altyazı basar; Sesli Tercüman modunda temsilcinin Türkçe yanıtını karşı tarafa hedef dilde seslendirir." },
          { name: "Geri Arama Planlayıcı (Callback)", type: "Tarih/Saat + Hatırlatma", defaultVal: "Kişisel Görev", required: false, effect: "'Yarın 14:00'te tekrar ara' diyerek hatırlatma kurar; zamanı gelince ekran üstünde canlı uyarı ve tek tıkla arama çıkar." }
        ]
      }
    ]
  },
  "ortak-gelen-kutusu": {
    editFormSections: [
      {
        tabTitle: "Sohbet Kontrol Paneli, AI ↔ İnsan Devri & Çoklu Hat Rozetleri",
        badge: "Sohbet Yönetimi",
        description: "Her sohbet oturumunun üst çubuğunda ve mesaj kutusunda yer alan operasyonel aksiyonlar.",
        fields: [
          { name: "Devral (Takeover) / AI'a Devret", type: "Atama Anahtarı", defaultVal: "AI Otomatik", required: false, effect: "Takeover yapıldığında AI susar ve sohbet temsilciye kilitlenir; 'Canlı Temsilci' butonu tıklanırsa otomatik insan moduna geçer." },
          { name: "Hat Rozeti (recipient_info)", type: "Örn. Satış Hattı - 0850...", defaultVal: "Çoklu WhatsApp", required: false, effect: "Birden fazla WhatsApp hattı bağlıysa müşterinin hangi şirket hattına yazdığını sohbet kartında ve başlıkta gösterir." },
          { name: "Sohbeti Başka Temsilciye Ata / İlet", type: "Assign / Forward", defaultVal: "Aktif Temsilciler", required: false, effect: "Yazışmayı ilgili departman veya uzman temsilciye devreder." },
          { name: "Medya, Belge & Onaylı Şablon Gönderimi", type: "Görsel / PDF / Ses / HSM", defaultVal: "Meta Cloud API", required: false, effect: "Dosya yükleyip gönderir; 24 saatlik pencere dolmuşsa Meta onaylı şablon (Send Template) penceresini açar." },
          { name: "Hızlı Cevaplar (/ komutu) & Rehbere Kaydet", type: "Canned Responses", defaultVal: "Son 10 Hane Eşleşme", required: false, effect: "'/' yazarak hazır yanıt seçer; numara rehberde yoksa tek tıkla rehber kartı oluşturur." }
        ]
      },
      {
        tabTitle: "WhatsApp Toplu Kampanya Gönderimi (Broadcast Modal) & Yeni Sohbet Başlat",
        badge: "Toplu Gönderim",
        description: "Müşteri listelerine toplu bilgilendirme veya şablon mesajı gönderme penceresi.",
        fields: [
          { name: "CSV / TXT Dosyası Seç (Otomatik Temizleyici)", type: "FileReader", defaultVal: "Otomatik Tekilleştirme", required: false, effect: "Yüklenen CSV/TXT dosyasındaki numaraları (+90/0/boşluk) otomatik temizler ve mükerrer numaraları eler." },
          { name: "Gönderici WhatsApp Hattı & Şablon/Mesaj", type: "Hat Seçimi + İçerik", defaultVal: "Varsayılan Hat", required: true, effect: "Seçilen Meta WhatsApp Business hattı üzerinden hız kontrollü olarak gönderim başlatır ve teslimat özetini raporlar." },
          { name: "Yeni Sohbet / E-Posta Oluştur (Compose)", type: "WhatsApp / Telegram / E-Posta", defaultVal: "Dışa Başlatma", required: false, effect: "Müşteri yazmadan önce ona yeni bir WhatsApp şablonu veya kurumsal e-posta göndermenizi sağlar." }
        ]
      }
    ]
  },
  "api-butce-ve-tuketim": {
    editFormSections: [
      {
        tabTitle: "Sağlayıcı Ücret/Paket Yükleme & Bütçe Eşik Düzenleme Modalları",
        badge: "7 AI & Kanal Sağlayıcısı",
        description: "Google Gemini, ElevenLabs, Meta WhatsApp Cloud API, OpenAI, Anthropic, Groq ve Deepgram için bakiye yükleme, bütçe sınırı ve sıfırlama pencereleri.",
        fields: [
          { name: "Ücret / Paket Yükleme Modalı", type: "Hızlı Tutar ($ USD) + Mevcut Harcama", defaultVal: "USD", required: true, effect: "Sağlayıcı paneline yüklediğiniz krediyi ($10/$25/$50/$100 veya özel tutar) kaydeder; harcama takibini sıfırdan veya mevcut tutardan başlatır." },
          { name: "Toplam Yüklenen Paket Bütçesi ($ USD)", type: "Decimal", defaultVal: "Sağlayıcı Bazlı", required: true, effect: "Kalan bakiye yüzdesini ve tahmini kalan konuşma/mesaj kapasitesini hesaplar." },
          { name: "Kritik Uyarı Alarm Eşiği (%)", type: "Integer (50–95%)", defaultVal: "%80", required: false, effect: "Tüketim bu yüzdeye ulaştığında Sistem Ayarları → E-Mail & WhatsApp Bildirimleri üzerinden yöneticilere anında uyarı gönderilir." },
          { name: "Yükleme Sonrası Tüketimi Sıfırla", type: "Onaylı Aksiyon", defaultVal: "Dönem Başında", required: false, effect: "Yeni fatura dönemine veya yeni kredi yüklemesine geçerken sayaçları temizler." }
        ]
      }
    ]
  },
  "ai-konfigurasyon-asistani": {
    editFormSections: [
      {
        tabTitle: "Doğal Dil Planlama, Etki Önizleme (Diff) & Snapshot Geri Alma",
        badge: "Güvenli AI Otomasyonu",
        description: "Komut yazıldıktan veya sesli dikte edildikten sonra sistemin izlediği 3 aşamalı güvenli işlem ekranı.",
        fields: [
          { name: "Doğal Dil Komut & Mikrofon Dikte Kutusu", type: "Metin + STT", defaultVal: "Türkçe", required: true, effect: "Kullanıcı, kuyruk, kara liste, mesai, kural veya toplu ayar değişikliklerini cümle olarak alır." },
          { name: "Değişiklik Planı Önizleme (Plan Explanation & Diff)", type: "Salt Okunur Onay Kartı", defaultVal: "Dry-Run", required: true, effect: "Hangi kayıtların ekleneceğini/değişeceğini açık Türkçe özetle gösterir; onaylanmadan veritabanına dokunulmaz." },
          { name: "İşlem Geçmişi & Tek Tıkla Geri Al (Undo Snapshot)", type: "Rollback", defaultVal: "Her işlemde kayıtlı", required: false, effect: "Uygulanan her konfigürasyon paketini tek tıkla önceki durumuna döndürür ve Asterisk'i yeniden senkronlar." }
        ]
      }
    ]
  },
  "ai-temsilcileri": {
    editFormSections: [
      {
        tabTitle: "Sekme 1: Kimlik & Sistem Talimatı (general_prompt)",
        badge: "AI Düzenle 1/7",
        description: "Yapay zeka sesli asistanının kişiliğini, karşılama metnini ve ana sistem prompt'unu tanımlar.",
        fields: [
          { name: "Asistan Adı, Kod Adı & Aktiflik", type: "Metin + Toggle", defaultVal: "Aktif", required: true, effect: "Arama Akışları (CallFlow), Gelen Arama Kuralları ve API'lerde seçilen benzersiz asistan kimliği." },
          { name: "Açılış / Karşılama Cümlesi", type: "Metin", defaultVal: "Merhaba, nasıl yardımcı olabilirim?", required: true, effect: "Çağrı bağlandığı anda müşteriye söylenen ilk cümle." },
          { name: "Sistem Talimatı (System Prompt)", type: "Çok Satırlı Metin", defaultVal: "Kurumsal Şablon", required: true, effect: "Asistanın rolü, üslubu, bilgi sınırları ve aksiyon kuralları. Görsel Senaryo Editörü kaydedildiğinde derlenmiş senaryo metni buraya otomatik eklenir." }
        ]
      },
      {
        tabTitle: "Sekme 2: Ses Motoru — STT & TTS (voice_tts)",
        badge: "AI Düzenle 2/7",
        description: "Konuşmayı metne çevirme (STT) ve doğal insan sesiyle konuşma (TTS) sağlayıcılarını belirler.",
        fields: [
          { name: "STT Motoru (Speech-to-Text)", type: "Google Gemini Native / Deepgram Nova-2 / OpenAI Whisper / ElevenLabs Scribe", defaultVal: "Google Gemini Native", required: true, effect: "Gemini Multimodal Live kullanıldığında ayrı STT/TTS gecikmesi olmadan doğrudan ses-to-ses çalışır." },
          { name: "TTS Motoru & Ses Aktörü", type: "Gemini Dahili / ElevenLabs (Klon Ses dahil) / OpenAI (Alloy, Nova, Shimmer)", defaultVal: "Gemini Native", required: true, effect: "Müşterinin duyacağı kadın/erkek ses tonu ve konuşma hızı." }
        ]
      },
      {
        tabTitle: "Sekme 3: Arka Plan Sesi & Canlı Test Stüdyosu (ambient_test)",
        badge: "AI Düzenle 3/7",
        description: "Yapay zeka konuşmasının dijital boşluk hissi vermemesi için gerçekçi ortam ambiyansı ekler ve tarayıcı mikrofonuyla canlı test sunar.",
        fields: [
          { name: "Arka Plan Ambiyans Profili", type: "Kapalı / call_center / office_keyboard / cafe_lounge / soft_rain / analog_warmth", defaultVal: "Kapalı", required: false, effect: "call_center: Gerçekçi çağrı merkezi uğultusu. office_keyboard: Hafif ofis/klavye sesi. soft_rain: Stresli müşterileri yatıştıran yağmur. analog_warmth: Sıcak telefon hattı dokusu." },
          { name: "Ambiyans Ses Seviyesi & Canlı Test Stüdyosu", type: "Slider (%) + Mikrofon Testi", defaultVal: "%15", required: false, effect: "Gerçek telefon aramadan doğrudan tarayıcı mikrofonunuzla AI asistanla konuşup sesini ve gecikmesini test edebilirsiniz." }
        ]
      },
      {
        tabTitle: "Sekme 4: Söz Kesme & Dinleme — VAD (barge_in_vad)",
        badge: "AI Düzenle 4/7",
        description: "Müşteri araya girdiğinde AI'ın susma hassasiyetini ve yankı bastırma eşiklerini ayarlar.",
        fields: [
          { name: "Barge-In (Söz Kesme) Aktifliği", type: "Toggle", defaultVal: "Aktif", required: false, effect: "Müşteri AI konuşurken araya girerse AI anında susup müşteriyi dinler." },
          { name: "Yankı Bastırma Genlik Eşiği (Echo Suppression)", type: "Amplitude Threshold", defaultVal: "150", required: false, effect: "AI konuşurken düşük genlikli ortam gürültüsü veya hoparlör yankısının (<150) Gemini VAD'ı yanlış tetikleyip AI sesini kesmesini önler." },
          { name: "Sessizlik Bekleme Süresi (Endpointing)", type: "Milisaniye", defaultVal: "600–900 ms", required: false, effect: "Müşteri cümlesini bitirdikten kaç ms sonra AI'ın yanıt vermeye başlayacağını belirler." }
        ]
      },
      {
        tabTitle: "Sekme 5–7: Zeka Motoru (LLM/RAG), Doğallık/Güvenlik & CRM Entegrasyonu",
        badge: "AI Düzenle 5–7/7",
        description: "Hangi LLM modelinin kullanılacağı, güvenlik korkulukları (guardrails) ve dış CRM/ERP araç bağlantıları.",
        fields: [
          { name: "LLM Sağlayıcı & Model (llm_brain)", type: "Google Gemini / ElevenLabs Conv. / OpenAI GPT-4o / Anthropic Claude 3.5 / Groq", defaultVal: "Gemini Live", required: true, effect: "Asistanın akıl yürütme motoru ve Bilgi Bankası (RAG) dokümanlarına erişim anahtarı." },
          { name: "Davranış Korkulukları (behavior_guardrails)", type: "Maks. Süre / Küfür Engel / Konu Dışı Koruma", defaultVal: "Aktif", required: false, effect: "Hakaret/suistimal durumunda nazikçe kapatır ([ACTION: HANGUP]) ve isteğe bağlı kara listeye bildirir." },
          { name: "CRM / Evrensel API Araçları (crm_integration)", type: "Async Tool Execution", defaultVal: "Seçimli Araçlar", required: false, effect: "Evrensel API Sihirbazı'nda tanımlı ERP/Sipariş/Kargo API'lerini konuşma kesilmeden arka planda sorgular." }
        ]
      },
      {
        tabTitle: "Görsel Senaryo Editörü & Doğal Dil AI Senaryo Üretici",
        badge: "Diyalog Ağacı",
        description: "AI Temsilcisi kartındaki 'Senaryo Editörü' butonuyla açılan düğüm tabanlı diyalog tasarımcısı.",
        fields: [
          { name: "Açılış & Karşılama / Diyalog Düğümü", type: "Açılış Metni + Script", defaultVal: "node-1", required: true, effect: "Adım adım konuşma akışını ve sorulacak soruları belirler." },
          { name: "KVKK Onay & Niyet Dallanması", type: "yes / no / özel dallar", defaultVal: "Koşullu", required: false, effect: "Müşterinin cevabına göre (örn. İnternet Kesintisi vs Cihaz Arızası) farklı akış kollarına yönlendirir." },
          { name: "İsimle Dahili / Personel Transferi (directory_lookup)", type: "Transfer Öncesi Anons + Varsayılan Dahili", defaultVal: "Otomatik Rehber", required: false, effect: "Sistemdeki tüm aktif kullanıcı adlarını ve dahili numaralarını AI'a öğretir; müşteri personel adı söylediğinde [ACTION: TRANSFER:<ext>] ile aktarır." },
          { name: "Hedefe Transfer & Kapanış Düğümleri", type: "Dahili / ACD Kuyruk / Harici GSM / Kapanış Anonsu", defaultVal: "AMI Redirect / Hangup", required: false, effect: "Görüşmeyi insan temsilciye/kuyruğa aktarır veya vedalaşarak kapatır." },
          { name: "AI Senaryo Asistanı (Doğal Dil Modalı)", type: "Türkçe Paragraf → Görsel Akış", defaultVal: "Tek Tık", required: false, effect: "İşletmenizin karşılama akışını düz Türkçe yazın; sistem tüm düğümleri ve okları otomatik çizer." }
        ]
      }
    ]
  },
  "bilgi-bankasi-rag": {
    editFormSections: [
      {
        tabTitle: "Sekme 1–3: Veri Kaynakları, Veri Ekleme (Web/PDF/SSS) & AI Medya Katalog",
        badge: "RAG Sekmeleri 1–3",
        description: "Yapay zekaya şirket bilgisini öğretmenin 4 farklı yolu ve WhatsApp/Chat üzerinden otomatik gönderilecek medya katalogları.",
        fields: [
          { name: "Veri Kaynakları (sources)", type: "Liste + Arama + Silme", defaultVal: "Aktif İndeks", required: false, effect: "İndekslenmiş tüm PDF, web sayfası ve manuel SSS kayıtlarını parça (chunk) sayılarıyla yönetir." },
          { name: "Web Sitesi Tarama (URL Crawler)", type: "URL", defaultVal: "SSL verify=False uyumlu", required: false, effect: "Kurumsal sitenizi tarar, HTML etiketlerini temizler ve RAG parçalarına böler." },
          { name: "PDF Doküman Yükleme & Manuel SSS", type: "PDF + Konu Başlığı + Detaylı Metin", defaultVal: "Anında İndeks", required: false, effect: "Fiyat listeleri, teknik şartnameler ve sık sorulan soruları sisteme öğretir." },
          { name: "AI Medya & Katalog (media)", type: "Dosya Adı + AI Gönderim Koşulu + PDF/Görsel/Video/Ses", defaultVal: "Omnichannel Uyumlu", required: false, effect: "'Müşteri ürün kataloğu veya konum isterse gönder' gibi doğal dil koşuluyla AI'ın sohbet esnasında otomatik dosya paylaşmasını sağlar." }
        ]
      },
      {
        tabTitle: "Sekme 4–5: Vektör Arama Testi & RAG Motoru Parametreleri (Tuning)",
        badge: "RAG Tuning",
        description: "Bilgi getirme doğruluğunu ve token tüketimini ince ayarlayan gelişmiş mühendislik parametreleri.",
        fields: [
          { name: "Vektör Arama Testi (search_test)", type: "Canlı Müşteri Sorusu", defaultVal: "/api/rag/search", required: false, effect: "Gerçek bir müşteri sorusu yazarak hangi doküman parçalarının kaç benzerlik skoruyla eşleştiğini anında görürsünüz." },
          { name: "Metin Bölme Boyutu (Chunk Size)", type: "Karakter Sayısı", defaultVal: "800–1000", required: false, effect: "Her bilgi parçasının uzunluğu. Çok küçükse bağlam kopar, çok büyükse gereksiz token harcar." },
          { name: "Bölme Çakışma Oranı (Chunk Overlap)", type: "Karakter Sayısı", defaultVal: "150–200", required: false, effect: "Ardışık iki parça arasında cümle bütünlüğünü korumak için tekrarlanan karakter sayısı." },
          { name: "Eşleşme Sayısı (Top K) & Asgari Benzerlik Eşiği", type: "Integer + 0.0–1.0", defaultVal: "Top K: 4 / Eşik: 0.65", required: false, effect: "AI yanıt üretirken en alakalı kaç parçayı kullanacağını ve minimum doğruluk barajını belirler." }
        ]
      }
    ]
  },
  "kural-ve-senaryo-editoru": {
    editFormSections: [
      {
        tabTitle: "Yeni Kural Tanımla / Kuralı Düzenle Formu",
        badge: "AI Politikaları",
        description: "Yapay zekanın görüşmelerde uyması gereken kesin kurallar, hazır SSS cevapları ve eskalasyon tetikleyicileri.",
        fields: [
          { name: "Kural Türü (Rule Type)", type: "SSS (FAQ) / Davranış Talimatı / Eskalasyon / Yasak", defaultVal: "Talimat", required: true, effect: "SSS türünde kesin sabit cevap tanımlanır; Talimat türünde asistanın karakter ve sınır kuralları yazılır." },
          { name: "Çalıştırılacak Aksiyon", type: "Yanıtla / Canlı Temsilciye Aktar / Kriz Alarmı / Kapat", defaultVal: "Yanıtla", required: true, effect: "Koşul gerçekleştiğinde santralin alacağı otomatik aksiyon." },
          { name: "Yapay Zeka Cevabı / Karakter Talimat Metni", type: "Çok Satırlı Metin", defaultVal: "Zorunlu", required: true, effect: "Örn. 'Rakip firma isimlerini asla anma; fiyat indirim yetkin yok, indirim taleplerini Satış 2000 kuyruğuna aktar.'" }
        ]
      }
    ]
  }
};
