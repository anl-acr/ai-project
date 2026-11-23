export const CHAPTERS_SANTRAL_B = [
  {
    id: "toplu-konfigurasyon",
    number: "21",
    groupId: "santral",
    category: "Santral",
    title: "Toplu Konfigürasyon (Bulk Config & Geri Alma)",
    shortTitle: "Toplu Konfigürasyon",
    menuPath: "Santral → Toplu Konfigürasyon",
    pbxRoute: "/?tab=toplu-konfigurasyon",
    permissions: ["bulk_config:read", "bulk_config:write"],
    badge: "Toplu İşlem • Önizleme • Undo",
    readMinutes: 8,
    summary:
      "Yüzlerce kullanıcı, abone grubu, ACD kuyruk veya giden arama kuralı üzerinde tek tek gezinmeden saniyeler içinde toplu özellik güncellemesi (örn. tüm satış ekibinde ses kaydını açma, 1000–1050 aralığının çıkış CallerID'sini değiştirme, toplu yönlendirme atama) yapan ve her işlemde tek tıkla Geri Al (Undo) imkanı sunan güçlü yönetim aracıdır.",
    screenshots: [
      {
        src: "/screenshots/19-bulk-config.jpg",
        caption: "Toplu Konfigürasyon — Modül seçimi, hedef kapsam filtresi, değişiklik matrisi ve geri alma geçmişi",
        routeHint: "Santral → Toplu Konfigürasyon"
      }
    ],
    fieldTable: [
      { field: "Hedef Modül", type: "users / subscriber_groups / queues / outbound_rules", defaultVal: "users", required: true, description: "Toplu değişikliğin uygulanacağı santral modülü." },
      { field: "Hedef Kapsamı (Target Mode)", type: "all / subscriber_group / pickup_group / role / department / location / range", defaultVal: "all", required: true, description: "Örn. sadece 'İstanbul Merkez' lokasyonundaki veya '1000-1050' dahili aralığındaki kullanıcıları hedefleyebilirsiniz." },
      { field: "Uygulanacak Değişiklikler", type: "Özellik Matrisi", defaultVal: "Seçilen alanlar", required: true, description: "Ses kaydı modu, dış arama CallerID, yönlendirme timeout, kodek, kuyruk stratejisi, wrap-up süresi gibi alanlar." },
      { field: "Canlı Önizleme & Tek Tıkla Geri Al (Undo)", type: "Snapshot", defaultVal: "Her işlemde kayıtlı", required: false, description: "Uygulamadan önce etkilenecek kayıt sayısı gösterilir; hata olursa /api/settings/bulk-config/undo ile saniyeler içinde geri alınır." }
    ],
    sections: [
      {
        heading: "1. Güvenli Toplu Güncelleme Adımları",
        body: "Özellikle 50+ aboneli kurumlarda standartlaştırma için Toplu Konfigürasyon büyük hız kazandırır.",
        steps: [
          "Hedef modülü (örn. Kullanıcılar & Aboneler) ve kapsam filtresini (örn. Departman = Satış) seçin.",
          "Yalnızca değiştirmek istediğiniz alanların kutucuğunu işaretleyip yeni değerlerini girin (işaretlenmeyen alanlara dokunulmaz).",
          "'Etkilenecek Kayıtları Önizle' listesini kontrol edip 'Toplu Uygula'ya basın; sistem Asterisk yapılandırmasını tek seferde yeniler."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Toplu işlem sonrası bazı kullanıcılar etkilenmedi", cause: "Seçilen kapsam filtresinde (örn. Departman veya Lokasyon) o kullanıcıların alanı boş olabilir.", solution: "Önizleme tablosunda etkilenecek kullanıcı listesini kontrol edin veya 'Dahili Numara Aralığı (1000-1099)' filtresini kullanın." }
    ],
    relatedPages: ["kullanicilar", "abone-grubu", "ai-konfigurasyon-asistani"],
    relatedApis: ["POST /api/v1/bulk-config/apply"]
  },
  {
    id: "rehber",
    number: "22",
    groupId: "santral",
    category: "Santral",
    title: "Rehber & Kurumsal Müşteri Kartları (Contacts)",
    shortTitle: "Rehber",
    menuPath: "Santral → Rehber",
    pbxRoute: "/?tab=rehber",
    permissions: ["contacts:read", "contacts:write", "contacts:delete"],
    badge: "CallerID Eşleşme • XML IP Telefon Rehberi • CSV",
    readMinutes: 7,
    summary:
      "Müşteri, tedarikçi ve iş ortağı telefon kayıtlarını merkezi olarak saklayan; gelen çağrılarda ve WhatsApp sohbetlerinde son 10 hane esnek eşleşmeyle arayan adını otomatik gösteren, IP telefonlara XML uzak rehber (Remote Phonebook) sunan ve biyometrik ses imzası (Voiceprint) bağlanabilen kurumsal rehber modülüdür.",
    screenshots: [
      {
        src: "/screenshots/20-contacts.jpg",
        caption: "Rehber — Müşteri kartları, hızlı arama, CSV toplu yükleme ve çoklu rehber defterleri",
        routeHint: "Santral → Rehber"
      }
    ],
    fieldTable: [
      { field: "Ad Soyad / Firma Adı", type: "Metin", defaultVal: "Zorunlu", required: true, description: "Çağrı çalarken WebPhone, masa telefonu ekranı ve CDR raporlarında görünen isim." },
      { field: "Telefon Numarası", type: "Esnek Format", defaultVal: "Son 10 hane eşleşir", required: true, description: "+90, 0 veya boşluk fark etmeksizin resolve_contact_name_by_phone ile otomatik eşleşir." },
      { field: "E-Posta / Notlar / VIP Etiketi", type: "Metin + Etiket", defaultVal: "Opsiyonel", required: false, description: "Müşteri 360° kartında ve çağrı pop-up'ında temsilciye gösterilen özet bilgi." },
      { field: "Rehber Defteri (Phonebook)", type: "Grup Seçimi", defaultVal: "Genel Rehber", required: false, description: "Farklı departmanlara özel rehber defterleri oluşturup IP telefonlara ayrı ayrı dağıtabilirsiniz." },
      { field: "CSV / Excel İçe-Dışa Aktarma", type: "Toplu Yükleme", defaultVal: "UTF-8 CSV", required: false, description: "Binlerce müşteri kaydını ERP/CRM'den tek seferde santral rehberine aktarır." }
    ],
    sections: [
      {
        heading: "1. IP Masa Telefonu Uzak Rehber (XML Phonebook) Senkronizasyonu",
        body: "Oto Provizyon ile kurulan Yealink/Fanvil/Grandstream telefonlar santral rehberini otomatik çeker; yeni bir müşteri rehbere eklendiğinde tüm masa telefonlarında anında aranabilir hale gelir."
      }
    ],
    troubleshooting: [
      { problem: "Rehberde kayıtlı müşteri arayınca adı görünmüyor", cause: "Numara içinde gizli özel karakter veya eksik hane kalmış olabilir.", solution: "Rehber kartındaki telefon numarasının 10 veya 11 haneli geçerli bir numara olduğunu (örn. 05321234567) doğrulayın." }
    ],
    relatedPages: ["temsilci-cagri-paneli", "ortak-gelen-kutusu", "kanallar-crm-ve-dis-api"],
    relatedApis: ["GET /api/v1/contacts", "POST /api/v1/contacts", "DELETE /api/v1/contacts/{contact_id}"]
  },
  {
    id: "dis-hat-tanimi",
    number: "23",
    groupId: "santral",
    category: "Santral",
    title: "Dış Hat Tanımı (SIP Trunk, Dakika Paketi & /30 VLAN)",
    shortTitle: "Dış Hat Tanımı",
    menuPath: "Santral → Dış Hat Tanımı",
    pbxRoute: "/?tab=dis-hatlar-sip-trunk",
    permissions: ["trunks:read", "trunks:write", "trunks:delete"],
    badge: "PJSIP • Register/IP-Auth • /30 Policy Routing",
    readMinutes: 13,
    summary:
      "Türk Telekom, Superonline, Vodafone, Ikon Telekom, NetGSM, Bulutfon ve tüm VoIP operatörlerinin SIP Trunk bağlantılarını (Kullanıcı/Şifre Register veya Sabit IP-Auth), eşzamanlı kanal limitlerini, dakika paketlerini, özel SIP başlıklarını (PAI / RPID / Diversion) ve aynı operatöre giden çoklu /30 Metro/VLAN hatları için Linux Policy Routing (Table 201+) yapılandırmasını yöneten kritik santral modülüdür.",
    screenshots: [
      {
        src: "/screenshots/21-trunks.jpg",
        caption: "Dış Hat Tanımı (SIP Trunk) — Operatör kayıt durumu, aktif kanal kullanımı ve 4 sekmeli detaylı trunk ayarları",
        routeHint: "Santral → Dış Hat Tanımı"
      }
    ],
    fieldTable: [
      { field: "Sekme 1: Genel — Trunk Adı & Operatör Host/Port", type: "Metin + IP/FQDN + Port", defaultVal: "Port 5060 (UDP/TCP/TLS)", required: true, description: "Operatör SBC sunucu adresi ve sinyal protokolü." },
      { field: "Kimlik Doğrulama Modu", type: "Registration (User/Pass) / IP-Auth (Static IP)", defaultVal: "Registration", required: true, description: "Sabit IP / Metro Ethernet SIP Trunk'larda IP-Auth, 0850 bulut operatörlerde Registration seçilir." },
      { field: "DID Numarası & Varsayılan CallerID", type: "E.164", defaultVal: "908503607390", required: true, description: "Bu hattan çıkacak aramalarda operatöre bildirilecek resmi şirket numarası." },
      { field: "Eşzamanlı Kanal Limiti (Max Channels)", type: "Integer", defaultVal: "30", required: false, description: "Operatörle sözleşmeli maksimum eşzamanlı konuşma kanalı; dolduğunda yedek Trunk'a taşar." },
      { field: "Sekme 2: Dakika Paketi (package)", type: "Aylık Dakika + Yenileme Günü", defaultVal: "Opsiyonel", required: false, description: "Örn. aylık 5.000 dakika paket tanımlayıp Operatör Dakika & Paket Raporu'nda anlık kalan dakikayı ve uyarı eşiklerini izlersiniz." },
      { field: "Sekme 3: Gelişmiş — Kodek & DTMF & Keepalive", type: "alaw/ulaw/g722/g729 + rfc4733", defaultVal: "alaw, ulaw + 60 sn qualify", required: false, description: "Operatör uyumluluğu için Türkiye'de birincil kodek olarak mutlaka G.711 A-Law (alaw) ilk sırada olmalıdır." },
      { field: "Sekme 4: SIP Başlıkları & /30 VLAN Policy Routing", type: "PAI / RPID / Diversion + Local Bind IP", defaultVal: "Opsiyonel", required: false, description: "Aynı operatör SBC bloğuna (örn. 10.99.1.0/24) giden birden fazla /30 hattınız varsa Nornia yerel IP'yi ağ kartına ekleyip Linux Policy Routing (Table 201+) ile SIP/RTP paketlerini doğru hattan çıkarır." }
    ],
    sections: [
      {
        heading: "1. PJSIP Özel Konfigürasyon ve NAT Uyumluluğu",
        body: "Dış Hat kaydedildiğinde /etc/asterisk/pjsip_custom.conf dosyasında Registration, Auth, AOR, Endpoint ve Identify bölümleri otomatik oluşturulur. Santral NAT arkasındaysa Sistem Ayarları → NAT ve Dış IP bölümündeki dış IP tüm PJSIP transport'larına otomatik işlenir.",
        codeBlock: {
          title: "Operatör SIP Trunk Sağlık Kontrolü (Asterisk CLI)",
          lang: "bash",
          code: `asterisk -rx "pjsip show registrations"
asterisk -rx "pjsip show aors"
asterisk -rx "pjsip show identify"`
        }
      }
    ],
    troubleshooting: [
      { problem: "SIP Trunk durumu 'Rejected' veya 'Unregistered'", cause: "Şifre/kullanıcı adı hatalı, operatör IP'mizi whitelist'e almamış veya NAT dış IP eksik.", solution: "Sorun İnceleme (Web sngrep) ekranında REGISTER paketine gelen 401/403 cevabını inceleyin ve operatörle dış IP'nizi teyit edin." },
      { problem: "Çağrı kuruluyor ama 30 saniyede kendiliğinden kopuyor", cause: "SIP ACK paketi NAT nedeniyle santrale dönemiyor.", solution: "Sistem Ayarları → NAT ve Dış IP ekranında gerçek statik dış IP'nizi tanımlayıp kaydedin." }
    ],
    relatedPages: ["giden-arama-kurali", "gelen-arama-kurali", "santral-entegrasyonu-ve-nat", "sorun-inceleme-sip-debugger"],
    relatedApis: ["GET /api/v1/trunks", "GET /api/reports/trunk-package-usage"]
  },
  {
    id: "konferans",
    number: "24",
    groupId: "santral",
    category: "Santral",
    title: "Konferans Odaları (ConfBridge Sesli Toplantı)",
    shortTitle: "Konferans",
    menuPath: "Santral → Konferans",
    pbxRoute: "/?tab=konferans-odalari",
    permissions: ["conferences:read", "conferences:write", "conferences:delete"],
    badge: "PIN Korumalı • Moderatör • Ses Kaydı",
    readMinutes: 7,
    summary:
      "İç dahililerin ve dışarıdan arayan iş ortaklarının aynı anda katılabileceği, katılımcı ve moderatör PIN korumalı, konuşan kişi algılamalı, bekleme müzikli ve otomatik ses kayıtlı kurumsal sesli konferans odalarını (Asterisk ConfBridge) yönettiğiniz modüldür.",
    screenshots: [
      {
        src: "/screenshots/22-conferences.jpg",
        caption: "Konferans Odaları — Oda numaraları, PIN ayarları, canlı katılımcı listesi ve moderatör kontrolleri",
        routeHint: "Santral → Konferans"
      }
    ],
    fieldTable: [
      { field: "Oda Adı & Numarası", type: "Metin + Dahili (3000+)", defaultVal: "3000", required: true, description: "İçeriden veya IVR/Gelen Arama Kuralından aranan konferans oda numarası." },
      { field: "Katılımcı PIN & Yönetici (Moderatör) PIN", type: "4-8 Hane Sayı", defaultVal: "Opsiyonel", required: false, description: "Yönetici PIN'i ile giren moderatör gelene kadar diğer katılımcılar bekleme müziği dinleyebilir." },
      { field: "Maksimum Katılımcı & Ses Kaydı", type: "Integer + Toggle", defaultVal: "25 kişi / Kayıt Açık", required: false, description: "Toplantının tamamını WAV olarak kaydedip Konferans Kullanım Raporu'ndan dinleyebilirsiniz." },
      { field: "Canlı Katılımcı Yönetimi", type: "Sessize Al / Odadan Çıkar / Kilitle", defaultVal: "Canlı", required: false, description: "Toplantı sürerken gürültü yapan katılımcıyı sessize alabilir veya odayı yeni girişlere kilitleyebilirsiniz." }
    ],
    sections: [
      {
        heading: "1. Dış Katılımcıları Konferansa Bağlama",
        body: "Bir DID numarasını veya IVR tuşunu (örn. 'Toplantı odası için 8'i tuşlayın') doğrudan konferans oda numarasına yönlendirerek şehir/yurt dışındaki müşterilerin PIN girerek toplantıya katılmasını sağlayabilirsiniz."
      }
    ],
    troubleshooting: [
      { problem: "Katılımcılar odaya giriyor ama birbirini duyamıyor, sadece müzik çalıyor", cause: "'Moderatör Bekle' seçeneği açık ve henüz yönetici PIN'i ile kimse bağlanmamış.", solution: "Moderatör PIN ile odaya girin veya oda ayarından 'Moderatörü Bekle' seçeneğini kapatın." }
    ],
    relatedPages: ["omnichannel-voip-ve-diger-raporlar", "gelen-arama-kurali"],
    relatedApis: ["GET /api/v1/conferences", "POST /api/v1/conferences"]
  },
  {
    id: "hizli-arama",
    number: "25",
    groupId: "santral",
    category: "Santral",
    title: "Hızlı Arama (Speed Dial Kısa Kodları)",
    shortTitle: "Hızlı Arama",
    menuPath: "Santral → Hızlı Arama",
    pbxRoute: "/?tab=hizli-arama",
    permissions: ["speed_dials:read", "speed_dials:write", "speed_dials:delete"],
    badge: "Kısa Kod • Global / Kişisel",
    readMinutes: 5,
    summary:
      "Sık aranan tedarikçi, şube, acil destek veya VIP müşteri numaralarına 2–4 haneli kısa arama kodları (örn. *01 → Kargo Merkezi, *02 → Teknik Servis) tanımlayarak tüm WebPhone ve masa telefonlarından tek tuşla aranmasını sağlayan modüldür.",
    screenshots: [
      {
        src: "/screenshots/23-speed-dial.jpg",
        caption: "Hızlı Arama — Kısa kod tanımları, hedef numaralar ve kategori etiketleri",
        routeHint: "Santral → Hızlı Arama"
      }
    ],
    fieldTable: [
      { field: "Kısa Kod (Code)", type: "Örn. *01, *02, 801", defaultVal: "Benzersiz", required: true, description: "Telefon tuş takımından çevrildiğinde hedef numarayı otomatik arayan kısa kod." },
      { field: "Hedef Numara & Açıklama", type: "Telefon + Metin", defaultVal: "Zorunlu", required: true, description: "Aranacak dış numara veya uzak şube dahili numarası." },
      { field: "Kapsam (Genel / Departman)", type: "Seçim", defaultVal: "Tüm Kullanıcılar", required: false, description: "Temsilci Çağrı Paneli'ndeki 'Hızlı Arama' sekmesinde de tek tıkla arama kartı olarak listelenir." }
    ],
    sections: [
      {
        heading: "1. WebPhone ve IP Telefon Entegrasyonu",
        body: "Burada tanımlanan her hızlı arama kodu hem Asterisk dialplanına anında işlenir (masa telefonundan tuşlanabilir) hem de Temsilci Çağrı Paneli'nin Hızlı Arama sekmesinde tıklanabilir buton olarak görünür."
      }
    ],
    troubleshooting: [
      { problem: "Kısa kodu çevirince çağrı çıkmıyor", cause: "Hedef dış numara, kullanıcının Abone Grubundaki giden arama kurallarıyla eşleşmiyor.", solution: "Hedef numaranın giden arama kuralı önekine (örn. 05..., 0212...) uygun yazıldığını doğrulayın." }
    ],
    relatedPages: ["temsilci-cagri-paneli", "giden-arama-kurali"],
    relatedApis: ["GET /api/v1/speed-dials"]
  },
  {
    id: "numara-engelleme",
    number: "26",
    groupId: "santral",
    category: "Santral",
    title: "Numara Engelleme (Kara Liste / Blacklist)",
    shortTitle: "Numara Engelleme",
    menuPath: "Santral → Numara Engelleme",
    pbxRoute: "/?tab=karaliste",
    permissions: ["blacklist:read", "blacklist:write", "blacklist:delete"],
    badge: "Spam Koruması • Gelen & Giden Engel",
    readMinutes: 6,
    summary:
      "İstenmeyen reklam, spam, taciz veya yetkisiz dış aramaları numara veya önek (prefix) bazında engelleyen; gelen çağrıyı sessiz reddetme, meşgul tonu verme veya özel uyarı anonsuyla sonlandırma seçenekleri sunan güvenlik modülüdür.",
    screenshots: [
      {
        src: "/screenshots/24-blacklist.jpg",
        caption: "Numara Engelleme (Kara Liste) — Engellenen numaralar, engelleme nedeni ve yön filtresi",
        routeHint: "Santral → Numara Engelleme"
      }
    ],
    fieldTable: [
      { field: "Telefon Numarası / Desen", type: "Numara veya Prefix", defaultVal: "Zorunlu", required: true, description: "Tekil numara (05320001122) veya önek eşleşmesi. +90/0 normalizasyonu otomatik yapılır." },
      { field: "Engelleme Yönü", type: "Gelen / Giden / Her İkisi", defaultVal: "Gelen (Inbound)", required: true, description: "Gelen spam aramaları veya personelin araması yasak olan özel servis/ücretli hatları (0900 vb.) engelleyebilirsiniz." },
      { field: "Engelleme Gerekçesi", type: "Metin", defaultVal: "Spam / Taciz", required: false, description: "Engellenen Çağrı & İhlal Raporu'nda denetim kaydı olarak görünür." },
      { field: "Engelleme Aksiyonu", type: "Kapat / Meşgul / Anons", defaultVal: "Anında Kapat", required: false, description: "Engelli numara aradığında çağrı kuyruğa ve temsilcilere hiç ulaşmadan santral girişinde sonlandırılır." }
    ],
    sections: [
      {
        heading: "1. Gerçek Zamanlı Engelleme ve İhlal Raporlaması",
        body: "Kara listeye eklenen bir numara saniyeler içinde veritabanına ve dialplan kontrolüne yansır; yeniden başlatma gerektirmez. Engellenen her deneme 'Engellenen Çağrı & İhlal Raporu'nda tarih/saat ve hedef DID bilgisiyle kayıt altına alınır."
      }
    ],
    troubleshooting: [
      { problem: "Kara listeye eklediğim numara tekrar ulaşabildi", cause: "Operatör numarayı farklı önek (örn. 90532... yerine +90532...) ile göndermiş olabilir.", solution: "Numarayı son 10 hane (5321234567) veya 05321234567 biçiminde kaydedin; CDR ekranından operatörün gönderdiği ham CallerID'yi kontrol edin." }
    ],
    relatedPages: ["gelen-arama-kurali", "guvenlik-kalkani", "omnichannel-voip-ve-diger-raporlar"],
    relatedApis: ["GET /api/v1/blacklist", "POST /api/v1/blacklist"]
  },
  {
    id: "zamanlanmis-raporlar",
    number: "27",
    groupId: "santral",
    category: "Santral",
    title: "Zamanlanmış Raporlar (Otomatik E-Posta Rapor Gönderimi)",
    shortTitle: "Zamanlanmış Raporlar",
    menuPath: "Santral → Zamanlanmış Raporlar",
    pbxRoute: "/?tab=zamanlanmis-raporlar",
    permissions: ["scheduled_reports:read", "scheduled_reports:write", "scheduled_reports:delete"],
    badge: "Günlük / Haftalık / Aylık • PDF & Excel",
    readMinutes: 6,
    summary:
      "Yöneticilerin panele girmeden her sabah, her Pazartesi veya her ay başında CDR, Kuyruk SLA, Kaçan Çağrı, Temsilci Performans veya CEO Özet raporlarını otomatik olarak e-posta kutularında (PDF/CSV/Excel ekiyle) almasını sağlayan zamanlayıcı modülüdür.",
    screenshots: [
      {
        src: "/screenshots/25-scheduled-reports.jpg",
        caption: "Zamanlanmış Raporlar — Periyodik görev listesi, alıcı e-postaları ve 'Şimdi Çalıştır' test butonu",
        routeHint: "Santral → Zamanlanmış Raporlar"
      }
    ],
    fieldTable: [
      { field: "Rapor Türü", type: "CDR / Kuyruk SLA / Temsilci KPI / Kaçan Çağrı / CEO Özet / Özel Rapor", defaultVal: "CEO Özet", required: true, description: "Gönderilecek standart veya Özel Rapor Tasarımcısı'nda oluşturduğunuz özel rapor." },
      { field: "Sıklık & Saat", type: "Günlük / Haftalık / Aylık + HH:MM", defaultVal: "Her gün 08:30", required: true, description: "Santralin saat dilimine (Europe/Istanbul) göre otomatik tetiklenir." },
      { field: "Alıcı E-Posta Listesi", type: "Virgülle ayrılmış Email", defaultVal: "Zorunlu", required: true, description: "Birden fazla yöneticiye aynı anda gönderilebilir." },
      { field: "Dosya Biçimi & Şimdi Çalıştır", type: "PDF / CSV / XLSX + Test Butonu", defaultVal: "PDF + CSV", required: false, description: "'Şimdi Çalıştır' butonu (/api/settings/scheduled-reports/{id}/run-now) zamanı beklemeden anlık test maili gönderir." }
    ],
    sections: [
      {
        heading: "1. SMTP Ön Koşulu",
        body: "Zamanlanmış raporların iletilebilmesi için Sistem Ayarları → E-Mail Bildirimleri (SMTP) yapılandırmasının tamamlanmış ve test mailinin başarıyla geçmiş olması gerekir."
      }
    ],
    troubleshooting: [
      { problem: "Zamanlanmış rapor maili gelmiyor", cause: "SMTP sunucu bilgileri eksik/hatalı veya mail spam klasörüne düşmüş.", solution: "Sistem Ayarları → E-Mail Bildirimleri ekranından SMTP test maili gönderip bağlantıyı doğrulayın; ardından raporda 'Şimdi Çalıştır'a basın." }
    ],
    relatedPages: ["ozel-rapor-tasarimcisi", "kanallar-crm-ve-dis-api", "raporlar-pano-ve-cdr"],
    relatedApis: ["GET /api/settings/scheduled-reports", "POST /api/settings/scheduled-reports", "POST /api/settings/scheduled-reports/{schedule_id}/run-now"]
  }
];
