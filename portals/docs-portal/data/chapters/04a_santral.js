export const CHAPTERS_SANTRAL_A = [
  {
    id: "kullanicilar",
    number: "13",
    groupId: "santral",
    category: "Santral",
    title: "Kullanıcılar & Dahili Abone Yönetimi",
    shortTitle: "Kullanıcılar",
    menuPath: "Santral → Kullanıcılar",
    pbxRoute: "/?tab=kullanicilar",
    permissions: ["users:read", "users:write", "users:delete"],
    badge: "PJSIP • 3-Seviye Yönlendirme • 2FA • BLF",
    readMinutes: 15,
    summary:
      "Santraldeki tüm kullanıcı hesaplarını, SIP dahili numaralarını (PJSIP), WebPhone/IP telefon şifrelerini, ses kayıt kurallarını, 3 seviyeli çağrı yönlendirmeyi (Her Zaman / Meşgul / Cevapsız), Çoklu Profilleri (*70), Patron-Sekreter (*74), Hot-Desking (*75/*76), Sesli Posta (Voicemail), IP Telefon BLF tuşlarını ve 2FA güvenlik politikalarını en ince ayrıntısına kadar yönettiğiniz ana abone modülüdür.",
    screenshots: [
      {
        src: "/screenshots/11-users.jpg",
        caption: "Santral → Kullanıcılar — Çevrimiçi SIP LED durumları (IP adresi hover), rol rozetleri ve abone düzenleme ekranı",
        routeHint: "Santral → Kullanıcılar"
      }
    ],
    fieldTable: [
      { field: "Ad Soyad / Kullanıcı Adı / E-Posta", type: "Metin / Email", defaultVal: "Zorunlu", required: true, description: "Web arayüz girişi, AI isimle dahili transferi (directory_lookup) ve sesli posta e-posta bildirimleri için kullanılır." },
      { field: "Dahili Numara (Extension)", type: "Sayısal (3-5 hane)", defaultVal: "1000+", required: true, description: "Asterisk PJSIP endpoint adı. Otomatik benzersizlik ve Numara Planı aralık kontrolünden geçer." },
      { field: "SIP Kimlik & Güçlü SIP Parolası", type: "24-karakter rastgele", defaultVal: "Otomatik üretilir", required: true, description: "Masa telefonu ve mobil SIP kayıt bilgileri. Masa telefonu QR kodu veya Oto Provizyon ile cihaza otomatik gönderilir." },
      { field: "Rol (Role) & Abone Grubu", type: "Seçim", defaultVal: "Agent / Standart", required: true, description: "Kullanıcının ekran yetkilerini (Rol) ve hangi dış arama kurallarına erişeceğini (Abone Grubu) belirler." },
      { field: "Ses Kayıt Politikası", type: "Yapay Zeka (AI) / Standart / Kapalı", defaultVal: "Standart", required: false, description: "AI: Çift kanal (RX/TX) kayıt + otomatik transkript/duygu/QA. Standart: MixMonitor WAV kaydı. Kapalı: Ses kaydı alınmaz." },
      { field: "3 Seviyeli Çağrı Yönlendirme", type: "Her Zaman / Meşgul / Cevapsız", defaultVal: "Zaman aşımı: 30 sn", required: false, description: "Her biri bağımsız aç/kapat (active), hedef tipi (Dahili / Kuyruk / Dış GSM / Sesli Posta / Anons) ve çalma süresi (15–60 sn) destekler. Dahili çevrimdışı veya cevapsızsa otomatik GSM'e Operator_Trunk üzerinden yönlenir." },
      { field: "Abone Profilleri (*70)", type: "Ofis / Uzaktan / Dışarıda", defaultVal: "Ofis", required: false, description: "Her profil için ayrı yönlendirme ve DND kuralı tanımlanır; kullanıcı webden veya *70 ile tek tuşla profil değiştirebilir." },
      { field: "Patron-Sekreter (*74)", type: "Yönetici-Asistan Eşleşmesi", defaultVal: "Kapalı", required: false, description: "Aktifken patrona gelen aramalar önce sekretere düşer; yalnızca izinli VIP numaralar doğrudan patronu çaldırır." },
      { field: "Hot-Desking (*75 / *76)", type: "Boolean + PIN + Gece Sıfırlama", defaultVal: "auto_logout_midnight: true", required: false, description: "Ortak masadaki IP telefona PIN ile giriş; gece yarısı otomatik çıkış seçeneği." },
      { field: "Sesli Posta (Voicemail *97)", type: "Aktif + PIN + E-Posta", defaultVal: "Kapalı", required: false, description: "Cevapsız aramaları sesli mesaja alır ve ses kaydını kullanıcının e-posta adresine WAV ekiyle yollar." },
      { field: "Kodek Önceliği", type: "alaw, ulaw, g722, opus, g729", defaultVal: "g722, alaw, ulaw", required: false, description: "HD ses (G.722/Opus) veya düşük bant genişliği (G.729) tercihi." },
      { field: "Masa Telefonu BLF & Softkey Tuşları", type: "BLF / Line / Speed Dial / DND / Pickup", defaultVal: "Oto Provizyon uyumlu", required: false, description: "Kullanıcının IP telefonundaki fiziksel yan tuşların fonksiyonlarını belirler; Oto Provizyon kaydedildiğinde telefona otomatik itilir." },
      { field: "2FA & Oturum Zaman Aşımı", type: "TOTP / E-Posta / WhatsApp + 1-3 Saat", defaultVal: "Opsiyonel", required: false, description: "İki faktörlü doğrulama ve hareketsizlikte otomatik çıkış (1/2/3 saat) güvenlik politikaları." }
    ],
    sections: [
      {
        heading: "1. Canlı Kayıt (Presence) LED Göstergesi ve IP Takibi",
        body: "Kullanıcı tablosundaki durum ışığı Asterisk AMI ContactStatus olaylarından ve WebPhone kayıt bildirimlerinden beslenir. Yeşil LED üzerine fareyle geldiğinizde cihaz tipi ve istemcinin gerçek IP adresi görünür (örn. 'Web Phone Bağlı (78.189.210.15)' veya 'Yealink T46U (192.168.1.44)')."
      },
      {
        heading: "2. Cisco Enterprise (78xx/79xx/88xx/89xx) ve Uzak Erişim (Nornia SIP Edge)",
        body: "Kullanıcı kartındaki Cihaz & Uzak Erişim bölümünde standart UDP/TCP 5060 yanı sıra Cisco Enterprise telefonlar için TCP 5160 (UseCallManager/BLF uyumlu) ve şube dışı uzak çalışanlar için Nornia SIP Edge (<alt-alan>.nornia.com.tr:5060/5160) bağlantı bilgileri otomatik üretilir."
      },
      {
        heading: "3. CSV ile Toplu Kullanıcı İçe Aktarma ve PJSIP Senkronizasyonu",
        body: "Yeni kullanıcı kaydedildiğinde veya güncellendiğinde Nornia /etc/asterisk/pjsip_custom.conf dosyasını otomatik yeniler ve 'pjsip reload' uygular. Mevcut aktif görüşmeler kesilmez."
      }
    ],
    troubleshooting: [
      { problem: "Dahiliye gelen çağrılar GSM yönlendirmesine düşmüyor", cause: "Yönlendirme kuralı 'Pasif' kalmış veya kullanıcıya bağlı giden arama kuralı/CallerID tanımlı değil.", solution: "Kullanıcı kartında 'Cevapsız' veya 'Meşgul' anahtarını aktif edin, hedef numaranın başına 0 ekleyip kaydedin." },
      { problem: "IP telefon '401 Unauthorized' hatası alıyor", cause: "SIP kullanıcı adı/şifresi hatalı girilmiş veya Fail2Ban yanlış şifre yüzünden IP'yi engellemiş.", solution: "Kullanıcı kartından SIP bilgilerini teyit edin; Güvenlik Kalkanı menüsünden telefonun IP adresinin engelli olmadığını kontrol edin." }
    ],
    relatedPages: ["oto-provizyon", "abone-grubu", "toplu-konfigurasyon", "roller-kvkk-ve-ldap"],
    relatedApis: ["GET /api/v1/extensions", "POST /api/v1/extensions", "PUT /api/v1/extensions/{extension}", "DELETE /api/v1/extensions/{extension}"]
  },
  {
    id: "anons-yonetimi",
    number: "14",
    groupId: "santral",
    category: "Santral",
    title: "Anons Yönetimi & Yapay Zeka Seslendirme (TTS)",
    shortTitle: "Anons Yönetimi",
    menuPath: "Santral → Anons Yönetimi",
    pbxRoute: "/?tab=anonslar",
    permissions: ["announcements:read", "announcements:write", "announcements:delete"],
    badge: "WAV/MP3 • AI TTS • MOH",
    readMinutes: 7,
    summary:
      "Karşılama (IVR), mesai dışı, resmi tatil, KVKK aydınlatma, kuyruk bekleme anonsları ve Bekleme Müziği (Music on Hold — MOH) dosyalarını yüklediğiniz veya metinden stüdyo kalitesinde Yapay Zeka Ses Sentezleme (TTS) ile saniyeler içinde ürettiğiniz ses kütüphanesidir.",
    screenshots: [
      {
        src: "/screenshots/12-announcements.jpg",
        caption: "Anons Yönetimi — Ses dosyası yükleme, AI TTS stüdyosu, tarayıcıdan önizleme ve Bekleme Müziği (MOH) seçimi",
        routeHint: "Santral → Anons Yönetimi"
      }
    ],
    fieldTable: [
      { field: "Anons Adı & Kategori", type: "Metin + Tip", defaultVal: "IVR / Mesai Dışı / Kuyruk / MOH", required: true, description: "Arama Akışı (CallFlow) ve ACD Kuyruk seçim listelerinde görünecek açıklayıcı ad." },
      { field: "Ses Dosyası Yükleme", type: "WAV / MP3 / OGG", defaultVal: "Otomatik 8kHz Mono PCM WAV", required: false, description: "Yüklenen dosya FFmpeg ile Asterisk'in sıfır gecikmeyle çalabildiği 8000 Hz 16-bit Mono WAV formatına otomatik dönüştürülür." },
      { field: "AI Metinden Sese (TTS) Üretici", type: "Metin + Ses Aktörü", defaultVal: "Türkçe Doğal Ses", required: false, description: "Metni yazıp kadın/erkek kurumsal ses seçerek profesyonel stüdyo anonsu oluşturabilirsiniz (ElevenLabs / OpenAI / Google TTS)." },
      { field: "Bekleme Müziği (MOH) Ataması", type: "Toggle / Sınıf", defaultVal: "default", required: false, description: "Yüklenen müzik dosyasını santral genelinde veya belirli kuyruklarda bekleme müziği olarak etkinleştirir." }
    ],
    sections: [
      {
        heading: "1. Asterisk Format Dönüşümü ve Otomatik Sağlık Onarımı",
        body: "Asterisk telefon hatlarında yüksek örnekleme hızlı stereo MP3 dosyalarını doğrudan çalamaz. Nornia her yüklenen veya TTS ile üretilen anonsu otomatik olarak /var/spool/asterisk/monitor ve /var/lib/asterisk/sounds/custom dizinlerine 8kHz 16-bit Mono WAV olarak kopyalar ve senkronize eder."
      },
      {
        heading: "2. Örnek Kurumsal KVKK & Karşılama Anons Metni",
        body: "AI TTS stüdyosunda aşağıdaki profesyonel kalıbı doğrudan kullanabilirsiniz:",
        codeBlock: {
          title: "Örnek Türkçe Karşılama & KVKK Metni",
          lang: "text",
          code: `Merhaba, Nornia Teknoloji müşteri hizmetlerine hoş geldiniz.
Hizmet kalitemizi artırmak ve 6698 sayılı KVKK kapsamında güvenliğiniz için görüşmelerimiz kayıt altına alınmaktadır.
Satış ve yeni abonelik için 1'i, Teknik Destek için 2'yi, Muhasebe için 3'ü tuşlayınız.
Operatöre bağlanmak için lütfen bekleyiniz.`
        }
      }
    ],
    troubleshooting: [
      { problem: "Arama akışında seçtiğim anons çalmıyor, sessizlik oluyor", cause: "Yüklenen dosya bozuk veya 0 byte olabilir.", solution: "Anons Yönetimi listesinden 'Dinle' butonuyla dosyayı tarayıcıda test edin; çalmıyorsa yeniden yükleyin veya TTS ile tekrar üretin." }
    ],
    relatedPages: ["arama-akis-yonetimi", "acd-kuyruk", "mesai-ve-resmi-tatiller"],
    relatedApis: ["GET /api/v1/announcements"]
  },
  {
    id: "acd-kuyruk",
    number: "15",
    groupId: "santral",
    category: "Santral",
    title: "ACD Kuyruk Yönetimi (Çağrı Dağıtım, SLA, RONA & Anket)",
    shortTitle: "ACD Kuyruk",
    menuPath: "Santral → ACD Kuyruk",
    pbxRoute: "/?tab=kuyruklar",
    permissions: ["queues:read", "queues:write", "queues:delete"],
    badge: "8 Strateji • RONA • CSAT Anket • Oto Logout",
    readMinutes: 14,
    summary:
      "Gelen çağrıları temsilci gruplarına adil, beceri (skill) veya öncelik bazlı dağıtan; çalma stratejisi, bekleme müziği, sıra/bekleme süresi anonsu, RONA (çalıp açmayan temsilciyi otomatik mola/pause'a alma), ACW wrap-up süresi, eşzamanlı mola kotası, otomatik mesai sonu çıkış ve çağrı sonrası DTMF memnuniyet anketi (CSAT) ayarlarını barındıran tam kapsamlı ACD motorudur.",
    screenshots: [
      {
        src: "/screenshots/13-acd-queues.jpg",
        caption: "ACD Kuyruk Yönetimi — Kuyruk listesi, üye sayısı, çalma stratejisi, otomatik logout ve anket ayarları",
        routeHint: "Santral → ACD Kuyruk"
      }
    ],
    fieldTable: [
      { field: "Kuyruk Adı & Numarası", type: "Metin + Dahili (2000+/6000+)", defaultVal: "2000", required: true, description: "İç aramalardan ve Arama Akışından yönlendirilecek benzersiz kuyruk numarası." },
      { field: "Çalma Stratejisi (Strategy)", type: "ringall / rrmemory / leastrecent / fewestcalls / random / linear / wrandom", defaultVal: "rrmemory", required: true, description: "ringall: Herkes aynı anda çalar. rrmemory: Kaldığı yerden sırayla adil dağıtır (en popüler). leastrecent: En uzun süredir boşta olanı çaldırır. fewestcalls: En az çağrı yanıtlayanı seçer." },
      { field: "Temsilci Çalma Süresi (Timeout)", type: "Saniye", defaultVal: "20 sn", required: true, description: "Bir temsilci telefonu kaç saniye açmazsa çağrının sıradaki temsilciye geçeceği." },
      { field: "Maksimum Kuyruk Bekleme & Taşma (Failover)", type: "Saniye + Hedef", defaultVal: "120 sn → AI / Voicemail", required: false, description: "Müşteri kuyrukta bu süreden fazla beklerse başka kuyruğa, AI Asistana veya Sesli Postaya otomatik taşar." },
      { field: "Wrap-Up / ACW Süresi", type: "Saniye", defaultVal: "10 sn", required: false, description: "Görüşme kapandıktan sonra temsilcinin not girmesi için yeni çağrı gelmeden tanınan dinlenme süresi." },
      { field: "RONA (Ring On No Answer)", type: "Aktif + Limit", defaultVal: "2 cevapsız → Oto Pause", required: false, description: "Masa başında olmayan ve çağrıyı açmayan temsilciyi otomatik molaya alarak müşterilerin boş telefonda beklemesini engeller." },
      { field: "Sıra & Tahmini Bekleme Anonsu", type: "Periyot (sn)", defaultVal: "60 sn", required: false, description: "'Şu an sırada 2. kişisiniz' anonsunu belirlenen aralıkta müşteriye dinletir." },
      { field: "Eşzamanlı Mola Kotası & Onay", type: "Maks. Kişi", defaultVal: "Opsiyonel", required: false, description: "Aynı anda kuyruktan en fazla kaç kişinin molada olabileceğini sınırlar; limit doluysa Süpervizör onayına düşürür." },
      { field: "Otomatik Çıkış (Auto-Logout)", type: "Gece Yarısı / Özel Saat", defaultVal: "18:00 / 00:00", required: false, description: "Mesai bitiminde (örn. 18:00) kuyrukta açık unutulan temsilcileri otomatik logout eder." },
      { field: "Çağrı Sonrası Memnuniyet Anketi (CSAT)", type: "1-5 DTMF + Çoklu Soru", defaultVal: "Kapalı", required: false, description: "Temsilci telefonu kapattığında müşteriyi otomatik sesli ankete aktarır; 1–5 arası tuşlamalar Anket Raporu'na işlenir." },
      { field: "Kuyruk Üyeleri & Öncelik (Penalty)", type: "Dahili Listesi + 0..10", defaultVal: "Penalty 0", required: true, description: "Penalty 0 birinci hat ekibidir; herkes meşgulse Penalty 1 (yedek ekip) çalmaya başlar." }
    ],
    sections: [
      {
        heading: "1. Çok Katmanlı Destek (Penalty / Tiered Routing) Tasarımı",
        body: "Örneğin Teknik Destek (2001) kuyruğunda 1. Seviye uzmanlara Penalty=0, kıdemli 2. Seviye mühendislere Penalty=1 atayabilirsiniz. Normal trafikte sadece 1. Seviye ekip çalar; tüm 1. Seviye temsilciler meşgul olduğunda çağrılar otomatik olarak 2. Seviye mühendislere taşar."
      },
      {
        heading: "2. Asterisk queues_custom.conf Senkronizasyonu",
        body: "Kuyruk kaydedildiğinde /etc/asterisk/queues_custom.conf otomatik yazılır ve 'queue reload all' çalıştırılır. Kuyruk yöneticileri (Supervisor) atanarak yalnızca kendi kuyruklarının mola ve raporlarını görmeleri sağlanabilir."
      }
    ],
    troubleshooting: [
      { problem: "Kuyrukta bekleyen çağrı var ama müsait temsilcinin telefonu çalmıyor", cause: "Temsilci molada (Paused), Wrap-Up süresinde veya SIP cihazı kayıtlı değil.", solution: "Canlı Çağrı İzleme veya Temsilci Panelinden temsilcinin 'Müsait' olduğunu ve SIP kaydının yeşil olduğunu doğrulayın." }
    ],
    relatedPages: ["canli-izleme-paneli", "kuyruk-sla-anket-ve-fcr", "arama-akis-yonetimi"],
    relatedApis: ["GET /api/v1/queues", "POST /api/v1/queues", "PUT /api/v1/queues/{queue_id}", "DELETE /api/v1/queues/{queue_id}"]
  },
  {
    id: "oto-provizyon",
    number: "16",
    groupId: "santral",
    category: "Santral",
    title: "Oto Provizyon & IP Telefon Otomatik Kurulumu",
    shortTitle: "Oto Provizyon",
    menuPath: "Santral → Oto Provizyon",
    pbxRoute: "/?tab=otomatik-kurulum",
    permissions: ["autoprovision:read", "autoprovision:write", "autoprovision:delete"],
    badge: "Yealink • Fanvil • Grandstream • Cisco • Snom",
    readMinutes: 12,
    summary:
      "Ofis içi (LAN) ve uzak şube/evden çalışan (WAN — Nornia Connect FQDN) fiziksel IP masa telefonlarını MAC adresi üzerinden sıfır manuel ayar ile saniyeler içinde yapılandıran, uzaktan yeniden başlatma (SIP NOTIFY check-sync) ve BLF/Rehber senkronizasyonu yapan merkezi cihaz yönetim modülüdür.",
    screenshots: [
      {
        src: "/screenshots/14-autoprovision.jpg",
        caption: "Oto Provizyon — Kayıtlı IP telefonlar, MAC eşleştirmeleri, LAN/WAN modu ve tek tıkla uzaktan yeniden yapılandırma",
        routeHint: "Santral → Oto Provizyon"
      }
    ],
    fieldTable: [
      { field: "MAC Adresi", type: "12 Hane HEX (aa:bb:cc:dd:ee:ff)", defaultVal: "Zorunlu", required: true, description: "Telefonun alt etiketindeki benzersiz donanım adresi. Cihaz açılışta /api/prov/<mac>.cfg dosyasını bu adresle çeker." },
      { field: "Marka & Model", type: "Yealink / Fanvil / Grandstream / Cisco / Snom / Poly", defaultVal: "Model Şablonu", required: true, description: "Seçilen markaya özel XML/CFG şablonunu (Oto Provizyon Şablonları'ndan) derler." },
      { field: "Atanan Dahili Abone", type: "Kullanıcı Seçimi", defaultVal: "Zorunlu", required: true, description: "Kullanıcının SIP kimliği, 24 haneli şifresi, Ad Soyad ekran yazısı ve BLF tuşları otomatik şablona basılır." },
      { field: "Ağ Modu (LAN / WAN / Otomatik)", type: "lan / wan / auto", defaultVal: "auto", required: true, description: "LAN: Santral yerel IP adresini yazar. WAN: Santralin https://<alt-alan>.nornia.com.tr FQDN ve SIP Edge adresini yazar." },
      { field: "Provizyon URL'si", type: "HTTPS/HTTP Link", defaultVal: "https://<fqdn>/api/prov/", required: false, description: "Telefonun web arayüzündeki Auto Provision Server URL alanına veya DHCP Option 66'ya yazılacak adres." },
      { field: "Uzaktan Yeniden Yükle (Reprovision)", type: "SIP NOTIFY check-sync", defaultVal: "Tek Tık", required: false, description: "Telefona dokunmadan BLF, rehber veya SIP değişikliğinin anında telefona inmesini sağlar." }
    ],
    sections: [
      {
        heading: "1. Desteklenen Markalar ve Cisco Enterprise TCP 5160",
        body: "Yealink (T3x/T4x/T5x), Fanvil (X/V serisi), Grandstream (GXP/GRP), Snom, Poly ve Cisco Enterprise (78xx/79xx/88xx/89xx — TCP 5160 UseCallManager & BLF destekli) cihazlar için hazır kurumsal şablonlar bulunur. Şablonları özelleştirmek için Sistem Ayarları → Otoprovizyon Şablonları ekranını kullanabilirsiniz."
      },
      {
        heading: "2. DHCP Option 66 ile Sıfır-Dokunuş (Zero-Touch) Kurulum",
        body: "Ofis router/DHCP sunucusunda Option 66 (TFTP/HTTP Boot Server) değerini santralinizin provizyon URL'sine ayarlayarak kutudan yeni çıkan yüzlerce telefonu yalnızca ethernet kablosunu takarak kurabilirsiniz.",
        codeBlock: {
          title: "DHCP Option 66 / Telefon Provision URL Örneği",
          lang: "text",
          code: `# Yerel Ofis (LAN) için:
http://192.168.1.25:8000/api/prov/

# Uzak Şube / Evden Çalışan (WAN - Nornia Connect) için:
https://sirketiniz.nornia.com.tr/api/prov/`
        }
      }
    ],
    troubleshooting: [
      { problem: "Telefon provizyon URL'sini yazdım ama ayar çekmiyor", cause: "MAC adresi yanlış girilmiş veya HTTPS sertifikası eski firmware'li telefonda güvenilir görünmüyor.", solution: "MAC adresini harf/rakam bazında doğrulayın; eski IP telefonlarda 'Only Accept Trusted Certificates' ayarını kapatın veya LAN içinde HTTP URL kullanın." }
    ],
    relatedPages: ["kullanicilar", "cok-subeli-santral-federation", "sunucu-ag-ve-nornia-connect"],
    relatedApis: ["GET /api/v1/extensions"]
  },
  {
    id: "giden-arama-kurali",
    number: "17",
    groupId: "santral",
    category: "Santral",
    title: "Giden Arama Kuralı (Outbound Routing & LCR)",
    shortTitle: "Giden Arama Kuralı",
    menuPath: "Santral → Giden Arama Kuralı",
    pbxRoute: "/?tab=giden-arama-kurallari",
    permissions: ["outbound_rules:read", "outbound_rules:write", "outbound_rules:delete"],
    badge: "Önek • Failover Trunk • PIN • Fraud Koruması",
    readMinutes: 10,
    summary:
      "Dahililerden dışarıya yapılan aramaların (GSM, şehir içi, şehirler arası, 0850, 444, uluslararası, acil 112) hangi SIP Trunk üzerinden, hangi numara dönüşümüyle (önek silme/ekleme), hangi Arayan Numara (CallerID) ile çıkacağını, yedek hat (Failover) sırasını ve PIN/yetki kısıtlarını belirleyen rota motorudur.",
    screenshots: [
      {
        src: "/screenshots/15-outbound-rules.jpg",
        caption: "Giden Arama Kuralı — Önek eşleştirme, birincil/yedek SIP Trunk sırası, CallerID ve PIN koruması",
        routeHint: "Santral → Giden Arama Kuralı"
      }
    ],
    fieldTable: [
      { field: "Kural Adı & Sıralama Önceliği", type: "Metin + Sürükle-Bırak", defaultVal: "Yukarıdan Aşağı", required: true, description: "Dialplan kuralları yukarıdan aşağıya değerlendirir; özel/acil kurallar (112, 444) en üstte olmalıdır." },
      { field: "Önek / Desen (Prefix / Pattern)", type: "Asterisk Pattern", defaultVal: "Örn. 05XXXXXXXXX", required: true, description: "Örn: 05. (GSM), 0212. (İstanbul Avrupa), 00. (Uluslararası), 444XXXX, 112." },
      { field: "Baştan Sil (Strip) & Başa Ekle (Prepend)", type: "Integer + String", defaultVal: "Strip: 1, Prepend: 90", required: false, description: "Kullanıcı 0532... çevirdiğinde baştaki '0'ı silip operatörün istediği '90532...' formatına otomatik dönüştürür." },
      { field: "Birincil & Yedek Dış Hat (Failover Trunk)", type: "Sıralı Trunk Listesi", defaultVal: "Operator_Trunk", required: true, description: "Birincil operatör meşgul/çökük (CONGESTION/CHANUNAVAIL) ise çağrı otomatik 2. yedek SIP Trunk'tan çıkar." },
      { field: "Çıkış Arayan Numarası (Outbound CallerID)", type: "E.164 / DID", defaultVal: "908503607390", required: false, description: "Operatörün kabul ettiği doğrulanmış DID numarası. Yanlış CallerID 'Everyone is busy/congested' reddine yol açar." },
      { field: "PIN Koruması & İzinli Abone Grupları", type: "PIN + Grup Seçimi", defaultVal: "Grup Bazlı", required: false, description: "Örn. Uluslararası aramaları sadece 'Yöneticiler' abone grubuna veya 4 haneli PIN girişine kısıtlayabilirsiniz." }
    ],
    sections: [
      {
        heading: "1. Türkiye Standart Giden Arama Kural Seti",
        body: "Türkiye'deki SIP operatörlerinin çoğu 90XXXXXXXXXX formatını bekler. Önerilen kurulum sırası:",
        codeBlock: {
          title: "Örnek Türkiye Giden Arama Desen Tablosu",
          lang: "text",
          code: `1. Acil Numaralar  | Desen: 112          | Strip: 0 | Prepend: (yok) | Tüm Abonelere Açık
2. 444 Kurumsal    | Desen: 444XXXX      | Strip: 0 | Prepend: 90    | Ana Trunk
3. Yurtiçi GSM     | Desen: 05XXXXXXXXX  | Strip: 1 | Prepend: 90    | Ana Trunk -> Yedek Trunk
4. Yurtiçi Sabit   | Desen: 0[2348]XXXXXXXXX | Strip: 1 | Prepend: 90 | Ana Trunk
5. Uluslararası    | Desen: 00.          | Strip: 2 | Prepend: (yok) | Sadece Yönetici Grubu + PIN`
        }
      },
      {
        heading: "2. Dahili Dolandırıcılık (Toll-Fraud) Koruması",
        body: "Nornia backend'indeki is_suspicious_or_fraud_outbound_number motoru, uluslararası çıkış izni kapalıyken yüksek tarifeli (premium/uydu) ülkelere yapılan şüpheli aramaları anında bloklar ve Güvenlik Kalkanı'na alarm düşer."
      }
    ],
    troubleshooting: [
      { problem: "Dış arama yapınca 'All circuits are busy / congested' hatası veriyor", cause: "Operatör gönderilen CallerID'yi veya numara formatını (05.. vs 905..) reddediyor.", solution: "Dış Hat ve Giden Kural üzerinde CallerID'nin operatörün tahsis ettiği 90850.../90212... numarasıyla birebir eşleştiğini doğrulayın; Strip=1, Prepend=90 deneyin." }
    ],
    relatedPages: ["dis-hat-tanimi", "abone-grubu", "gelen-arama-kurali"],
    relatedApis: ["GET /api/v1/outbound-rules", "POST /api/v1/outbound-rules", "DELETE /api/v1/outbound-rules/{rule_id}"]
  },
  {
    id: "gelen-arama-kurali",
    number: "18",
    groupId: "santral",
    category: "Santral",
    title: "Gelen Arama Kuralı (Inbound DID Routing)",
    shortTitle: "Gelen Arama Kuralı",
    menuPath: "Santral → Gelen Arama Kuralı",
    pbxRoute: "/?tab=gelen-arama-kurallari",
    permissions: ["inbound_rules:read", "inbound_rules:write", "inbound_rules:delete"],
    badge: "DID Eşleştirme • Mesai • VIP Yönlendirme",
    readMinutes: 9,
    summary:
      "Operatörden santrale ulaşan tüm dış hat numaralarının (DID — örn. 0850 / 0212 / 0312) ve isteğe bağlı arayan numara (CID) filtrelerinin hangi Arama Akışına (CallFlow), ACD Kuyruğa, Yapay Zeka Asistanına, Dahili Aboneye veya Anonsa yönlendirileceğini belirleyen giriş kapısıdır.",
    screenshots: [
      {
        src: "/screenshots/16-inbound-rules.jpg",
        caption: "Gelen Arama Kuralı — DID numara eşleştirmeleri, hedef tipi ve öncelikli yönlendirme tablosu",
        routeHint: "Santral → Gelen Arama Kuralı"
      }
    ],
    fieldTable: [
      { field: "DID Numarası / Deseni", type: "E.164 veya Wildcard (_X.)", defaultVal: "908503607390", required: true, description: "Operatörün SIP To / Request-URI başlığında gönderdiği numara. Asterisk REAL_DID çıkarıcı ile s-extension hatasını önler." },
      { field: "Arayan Numara Filtresi (CID Pattern)", type: "Opsiyonel Desen", defaultVal: "Tümü (*)", required: false, description: "Örn. belirli bir VIP müşterinin numarasını doğrudan müşteri temsilcisinin dahili numarasına yönlendirebilirsiniz." },
      { field: "Hedef Tipi", type: "CallFlow / ACD Kuyruk / AI Asistan / Dahili / Anons / Konferans", defaultVal: "CallFlow", required: true, description: "Mesai saati, tatil ve IVR tuşlama mantığı gerekiyorsa hedef olarak Arama Akışı (CallFlow) seçilmesi önerilir." },
      { field: "Arayan Adı Öneki (CID Prefix)", type: "Metin", defaultVal: "Opsiyonel (örn. SATIS:)", required: false, description: "Birden fazla markası/hattı olan şirketlerde temsilcinin ekranında müşterinin hangi numarayı aradığını gösterir." },
      { field: "Kara Liste & Spam Kontrolü", type: "Otomatik", defaultVal: "Her zaman aktif", required: false, description: "Gelen her çağrı kurala girmeden önce Numara Engelleme (Blacklist) kontrolünden geçer." }
    ],
    sections: [
      {
        heading: "1. Çoklu Şirket / Çoklu Hat (Multi-DID) Yapılandırması",
        body: "Tek bir SIP Trunk üzerinden 100'lü DID bloğunuz (örn. 902125551000 – 902125551099) geliyorsa her DID için ayrı gelen arama kuralı oluşturabilir, 1000'i ana IVR'a, 1015'i doğrudan Genel Müdür dahilisine, 1020'yi ise 7/24 AI Teknik Destek Asistanına yönlendirebilirsiniz."
      }
    ],
    troubleshooting: [
      { problem: "Dışarıdan arayınca 'Hatalı & Eşleşmeyen Çağrı'ya düşüyor", cause: "Operatörün gönderdiği DID formatı (örn. +90850... veya 0850...) kuraldaki biçimle uyuşmuyor.", solution: "Raporlar → Hatalı & Eşleşmeyen Çağrı veya Sorun İnceleme ekranından operatörün gönderdiği tam To/DID değerini görüp kuralı o biçimle kaydedin." }
    ],
    relatedPages: ["dis-hat-tanimi", "arama-akis-yonetimi", "numara-engelleme"],
    relatedApis: ["GET /api/v1/inbound-rules", "POST /api/v1/inbound-rules", "DELETE /api/v1/inbound-rules/{rule_id}"]
  },
  {
    id: "cagri-toplama-grubu",
    number: "19",
    groupId: "santral",
    category: "Santral",
    title: "Çağrı Toplama Grubu (Call Pickup Groups)",
    shortTitle: "Çağrı Toplama Grubu",
    menuPath: "Santral → Çağrı Toplama Grubu",
    pbxRoute: "/?tab=cagri-toplama-gruplari",
    permissions: ["call_pickup_groups:read", "call_pickup_groups:write", "call_pickup_groups:delete"],
    badge: "*8 Grup Toplama • ** Direkt Çekme",
    readMinutes: 6,
    summary:
      "Aynı departmanda veya fiziksel odada çalışan kullanıcıların, masa başında olmayan çalışma arkadaşlarının çalan telefonunu kendi ahizelerinden tek tuşla (*8 veya BLF tuşu ile) çekip cevaplamalarını sağlayan Asterisk named_call_group / named_pickup_group yönetim ekranıdır.",
    screenshots: [
      {
        src: "/screenshots/17-call-pickup-groups.jpg",
        caption: "Çağrı Toplama Grubu — Departman bazlı pickup grupları ve üye dahili atamaları",
        routeHint: "Santral → Çağrı Toplama Grubu"
      }
    ],
    fieldTable: [
      { field: "Grup Adı", type: "Metin", defaultVal: "Örn. Muhasebe Toplama", required: true, description: "PJSIP named_call_group ve named_pickup_group kimliği olarak Asterisk'e otomatik yazılır." },
      { field: "Üye Dahililer", type: "Çoklu Seçim", defaultVal: "En az 2 dahili", required: true, description: "Gruptaki her üye, gruptaki diğer üyelerin çalan çağrılarını *8 tuşlayarak kendi telefonuna çekebilir." },
      { field: "Direkt Çağrı Çekme (** + Dahili)", type: "Özellik Kodu", defaultVal: "**1005", required: false, description: "Belirli bir dahili numarayı (örn. 1005) hedef alarak doğrudan çağrıyı çekmek için **1005 tuşlanır veya IP telefonda yanıp sönen BLF tuşuna basılır." }
    ],
    sections: [
      {
        heading: "1. Çağrı Toplama Raporlaması ve CDR Takibi",
        body: "Bir çağrı *8 veya BLF ile başka bir temsilci tarafından çekildiğinde, Nornia CDR kayıtlarında hem ilk çalan dahiliyi hem de çağrıyı toplayan (pickup) dahiliyi ayrı bacaklar halinde kaydeder ve 'Departman & Çağrı Toplama Raporu'nda raporlar."
      }
    ],
    troubleshooting: [
      { problem: "*8 tuşlayınca 'Çağrı çekilemedi' diyor", cause: "Çalan telefon ile *8 tuşlayan telefon aynı Çağrı Toplama Grubunda değil.", solution: "Her iki dahiliyi de aynı Çağrı Toplama Grubuna ekleyip kaydedin." }
    ],
    relatedPages: ["kullanicilar", "abone-grubu", "kuyruk-sla-anket-ve-fcr"],
    relatedApis: ["GET /api/v1/extensions"]
  },
  {
    id: "abone-grubu",
    number: "20",
    groupId: "santral",
    category: "Santral",
    title: "Abone Grubu (Dış Arama Yetki & Politika Grupları)",
    shortTitle: "Abone Grubu",
    menuPath: "Santral → Abone Grubu",
    pbxRoute: "/?tab=abone-gruplari",
    permissions: ["subscriber_groups:read", "subscriber_groups:write", "subscriber_groups:delete"],
    badge: "Yetki Sınıfı • CoS • Toplu Kural",
    readMinutes: 7,
    summary:
      "Kullanıcıları 'Sadece Dahili', 'Yurtiçi Sabit + GSM', 'Yöneticiler (Uluslararası Açık)' veya 'Şube Grubu' gibi mantıksal sınıflara (Class of Service — CoS) ayırarak dış arama kurallarını, varsayılan çıkış CallerID'sini ve toplu konfigürasyon hedeflerini tek noktadan yönettiğiniz modüldür.",
    screenshots: [
      {
        src: "/screenshots/18-subscriber-groups.jpg",
        caption: "Abone Grubu — Yetki sınıfları, izinli giden arama kuralları ve grup üyeleri",
        routeHint: "Santral → Abone Grubu"
      }
    ],
    fieldTable: [
      { field: "Abone Grubu Adı", type: "Metin", defaultVal: "Örn. Standart Çalışanlar", required: true, description: "Kullanıcı kartı ve Giden Arama Kuralında seçilebilir grup adı." },
      { field: "İzinli Giden Arama Kuralları", type: "Çoklu Seçim", defaultVal: "Yurtiçi kurallar", required: false, description: "Bu gruptaki abonelerin kullanabileceği dış arama rotaları. Seçilmeyen rotalar (örn. 00 Uluslararası) otomatik engellenir." },
      { field: "Grup Üyeleri", type: "Dahili Listesi", defaultVal: "Dinamik", required: false, description: "Gruba eklenen kullanıcılar anında grubun dış arama kurallarını ve politikalarını devralır." }
    ],
    sections: [
      {
        heading: "1. Güvenli Kurumsal Class of Service (CoS) Tasarımı",
        body: "En iyi güvenlik pratiği olarak en az 3 Abone Grubu tanımlamanız önerilir: (1) Ortak Alan / Depo Telefonları → Sadece Dahili + 112 Acil; (2) Standart Personel → Yurtiçi Sabit + GSM + 444; (3) Yönetim → Yurtiçi + Uluslararası (PIN korumalı)."
      }
    ],
    troubleshooting: [
      { problem: "Kullanıcı GSM arayamıyor, 'Yetkiniz yok' anonsu duyuyor", cause: "Kullanıcının bağlı olduğu Abone Grubunda GSM giden arama kuralı işaretlenmemiş.", solution: "Santral → Abone Grubu → ilgili grubu düzenle → GSM giden arama kuralını işaretleyip kaydedin." }
    ],
    relatedPages: ["giden-arama-kurali", "kullanicilar", "toplu-konfigurasyon"],
    relatedApis: ["GET /api/v1/subscriber-groups", "POST /api/v1/bulk-config/apply"]
  }
];
