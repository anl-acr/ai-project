export const MANUAL_META = {
  productName: "Nornia Enterprise AI PBX",
  version: "v3.10.11",
  updatedAt: "Kasım 2026",
  apiPortalUrl: "https://api.nornia.com.tr",
  docsPortalUrl: "https://dokuman.nornia.com.tr",
  fullPdfPath: "/pdfs/nornia-kullanim-kilavuzu-tam.pdf"
};

export const MANUAL_CHAPTERS = [
  {
    id: "kurulum-ve-ilk-baslangic",
    number: "01",
    title: "Kurulum & İlk Başlangıç",
    shortTitle: "Kurulum & Sihirbaz",
    category: "Başlangıç",
    badge: "ISO & /setup",
    readMinutes: 8,
    summary:
      "Çevrimdışı Nornia ISO kurulumu, 6 adımlı İlk Kurulum Sihirbazı (/setup), donanım kimliğine bağlı kriptografik lisanslama, statik IP / NAT ve kısıtlı 'destek' SSH kurtarma konsolu.",
    screenshots: [
      {
        src: "/screenshots/kurulum-ve-ilk-baslangic/01-login.png",
        caption: "Nornia Giriş Ekranı — Kurulum tamamlandığında yönetici (admin) ve kullanıcı oturum açma arayüzü",
        routeHint: "/login"
      },
      {
        src: "/screenshots/kurulum-ve-ilk-baslangic/02-system-info.png",
        caption: "Sistem Bilgisi Çekmecesi (i) — Donanım Kimliği, Nornia FQDN, LAN/WAN IP ve canlı lisans kapasite özeti",
        routeHint: "Üst Bar → (i) Bilgi Butonu"
      }
    ],
    sections: [
      {
        heading: "1.1 Tam Çevrimdışı (Air-Gapped) ISO Kurulumu",
        body:
          "Nornia Appliance ISO (Ubuntu 24.04 LTS tabanlı) sanal sunucuya (VMware ESXi, Proxmox VE, Hyper-V, VirtualBox) veya fiziksel sunucuya takıldığında hiçbir soru sormadan tam otomatik kurulur. İlk açılışta Asterisk 18, PostgreSQL 16 (port 5444), Nginx, PM2, Nornia Backend ve Frontend servisleri internetsiz olarak ayağa kalkar.",
        steps: [
          "Minimum kaynak önerisi: 4 vCPU, 4 GB RAM (AI ve yoğun çağrı merkezi için 8 GB RAM), 30 GB SSD disk.",
          "ISO ile sistemi başlattığınızda TTY1 konsol ekranında santralin yerel LAN IP adresi, Donanım Kimliği (HW-XXXX-XXXX) ve ilk kurulum linki (http://<IP>/setup) otomatik görünür.",
          "Tarayıcıdan http://<SANTRAL-IP>/setup adresini açarak 6 adımlı İlk Kurulum Sihirbazını başlatın."
        ]
      },
      {
        heading: "1.2 6 Adımlı İlk Kurulum Sihirbazı (/setup)",
        body:
          "Güvenlik gereği /setup sihirbazı yalnızca tek seferliktir; kurulum tamamlandığında kalıcı olarak kilitlenir ve tüm /api/setup/* uç noktaları HTTP 403 döndürür.",
        configTable: {
          headers: ["Adım", "Yapılandırılan Alanlar", "Önemli Kural / Davranış"],
          rows: [
            ["Adım 1 — Ağ & NAT", "Yerel LAN IP (örn. 192.168.1.24/24), Gateway, DNS, PJSIP NAT & Dış IP", "Mevcut IP'den farklı bir statik IP yazıldığında 6. adımda Netplan'a otomatik uygulanır."],
            ["Adım 2 — Lisans", "Donanım Kimliği (HW-ID), Firma Adı, Müşteri Kodu, İmzalı Lisans Anahtarı (AIDA-...)", "Geçerli ve bu donanıma imzalı lisans anahtarı doğrulanmadan 3. adıma geçilemez."],
            ["Adım 3 — FQDN", "Nornia Bulut FQDN (musteri.nornia.com.tr), Özel Kurumsal FQDN veya Sadece LAN", "Bulut FQDN seçildiğinde 'Kontrol Et' ile Merkez Hub'da müsaitlik teyit edilir; dolu ad engellenir."],
            ["Adım 4 — Numara Planı", "4 Haneli (1000–1099, Kuyruk 6000–6099, Konferans 8000–8099) veya 3 Haneli Plan + Hızlı Seri Dahili", "Çağrı çekme (*8 / **8) ve sesli posta (*97) kodları otomatik tanımlanır."],
            ["Adım 5 — Tarih & Dil", "Saat Dilimi (Europe/Istanbul), NTP Sunucuları, Tarih/Saat Biçimi, Varsayılan Dil", "Tüm CDR raporları, mesai saatleri ve masa telefonu saatleri bu ayara göre hizalanır."],
            ["Adım 6 — Yönetici & Özet", "admin Hesabı Ad Soyad, E-Posta ve Zorunlu Şifre (en az 6 karakter)", "Kurulum tamamlandığında seçilen FQDN giriş ekranı yeni sekmede açılır."]
          ]
        }
      },
      {
        heading: "1.3 Kısıtlı 'destek' SSH Kurtarma Konsolu",
        body:
          "Saha teknisyenlerinin işletim sistemi kabuğuna (bash) erişmeden yalnızca ağ/IP düzeltmesi, DNS/ping testi, Netplan geri alma ve servis sağlığı kontrolü yapabilmesi için kısıtlı 'destek' hesabı kuruludur.",
        codeExample: {
          title: "Saha Destek SSH Girişi",
          lang: "bash",
          code: `# Kısıtlı Nornia Destek Konsolu (yalnızca menü tabanlı ağ/servis kurtarma)
ssh destek@192.168.1.25

# Menü Seçenekleri:
# 1) Canlı Ağ Arayüzleri ve IP Özeti
# 2) Statik IP / DHCP Değiştir (Otomatik Snapshot + 60sn Güvenlik Geri Alma)
# 3) Son Çalışan Ağ Yedeğine Geri Dön (Rollback)
# 4) DNS / Ping / Hub Bağlantı Testi
# 5) Nornia Servis Durumu (Asterisk / PostgreSQL / Nginx / PM2)`
        }
      }
    ],
    troubleshooting: [
      {
        problem: "Kurulum bittikten sonra yeni FQDN adresinde ilk 10 saniyede SSL uyarısı görünüyor.",
        solution: "Merkez Hub'da Let's Encrypt sertifikası yeni alt alan adı için ~10 saniyede genişletilir. 10 saniye bekleyip Gizli Sekmede (Incognito) sayfayı açtığınızda geçerli HTTPS kilit simgesi gelir."
      },
      {
        problem: "Sanal makine başka bir sunucuya klonlandıktan sonra lisans pasife düştü.",
        solution: "Nornia lisansları kriptografik olarak anakart/disk donanım kimliğine (HW-ID) bağlıdır. Yeni sunucunun HW-ID bilgisini Merkez Lisans Panelinde güncelleyip yeni anahtar üretin."
      }
    ]
  },
  {
    id: "kullanicilar-ve-numara-plani",
    number: "02",
    title: "Kullanıcılar, Dahililer & Numara Planı",
    shortTitle: "Kullanıcılar & Dahililer",
    category: "Santral (PBX)",
    badge: "Aboneler",
    readMinutes: 7,
    summary:
      "Dahili abone oluşturma, çoklu cihaz eşleştirme (WebPhone + Masa Telefonu + Mobil Runa), 3 kademeli çağrı yönlendirme (Her Zaman / Meşgul / Cevapsız GSM), profil yönetimi ve toplu konfigürasyon.",
    screenshots: [
      {
        src: "/screenshots/kullanicilar-ve-numara-plani/01-users-list.png",
        caption: "Kullanıcı Yönetimi — Çevrimiçi SIP kayıt LED'i, istemci IP adresi, ses kaydı ve hızlı işlemler",
        routeHint: "Santral → Kullanıcılar"
      },
      {
        src: "/screenshots/kullanicilar-ve-numara-plani/02-numbering-plan.png",
        caption: "Numara Planı Ayarları — Dahili, Kuyruk, Konferans aralıkları ve özellik kodları",
        routeHint: "Sistem Ayarları → Santral & Ağ → Numara Planı"
      }
    ],
    sections: [
      {
        heading: "2.1 Varsayılan 4 Haneli Kurumsal Numara Planı",
        body:
          "Nornia, kurumsal ölçeklenebilirlik için varsayılan olarak 4 haneli numara planıyla gelir. İhtiyaca göre Sistem Ayarları → Numara Planı bölümünden 3 haneli kompakt plana veya özel aralıklara geçilebilir.",
        configTable: {
          headers: ["Kategori", "Varsayılan Aralık / Kod", "Açıklama"],
          rows: [
            ["Dahili (Abone) Aralığı", "1000 – 1099", "Kullanıcı dahili numaraları (WebPhone, Masa Telefonu, Mobil)"],
            ["ACD Kuyruk Aralığı", "6000 – 6099", "Çağrı merkezi kuyruk numaraları (örn. 6000 Satış, 6001 Destek)"],
            ["Konferans Odası Aralığı", "8000 – 8099", "PIN korumalı çoklu sesli konferans odaları"],
            ["Grup Çağrı Çekme", "*8", "Aynı çağrı toplama grubunda çalan telefonu çekme"],
            ["Doğrudan Çağrı Çekme", "**8 + Dahili", "Belirli bir dahili numarada çalan çağrıyı çekme (örn. **81002)"],
            ["Sesli Posta Dinleme", "*97", "Abone kendi sesli posta kutusunu dinler"],
            ["Cihaz Değiştir (Call Flip)", "*11", "Aktif görüşmeyi WebPhone ↔ Masa Telefonu ↔ Mobil arasında kesintisiz taşıma"]
          ]
        }
      },
      {
        heading: "2.2 Yeni Kullanıcı Ekleme & Çoklu Cihaz Mimarisi",
        body:
          "Her kullanıcıya tek bir dahili numara altında birbirinden bağımsız SIP kimlikleriyle Web Telefonu (WSS), Masa Telefonu (PJSIP TCP/UDP) ve Runa Mobil/Masaüstü cihazları atanabilir.",
        steps: [
          "Sol menüden Santral → Kullanıcılar ekranını açın ve sağ üstteki kırmızı '+' (Yeni Kullanıcı Ekle) butonuna tıklayın.",
          "Ad Soyad, E-Posta, Dahili Numara (örn. 1005), Rol (Yönetici / Süpervizör / Temsilci) ve departman bilgilerini girin.",
          "Ses Kaydı (MixMonitor), Giden Arama Kuralı ve arayan numara (CallerID) tercihlerini belirleyin.",
          "Kaydettiğinizde Asterisk PJSIP uç noktaları anında senkronize olur; isterseniz kullanıcıya şifre oluşturma rehberli 'Hoş Geldiniz E-Postası' gönderebilirsiniz."
        ]
      },
      {
        heading: "2.3 3 Kademeli Çağrı Yönlendirme & GSM Follow-Me",
        body:
          "Her abone için üç bağımsız yönlendirme kuralı ayrı ayrı aktif edilebilir. Dahili çevrimdışı (SIP kaydı yok), meşgul veya belirlenen sürede (örn. 20 sn) açmazsa çağrı otomatik olarak tanımlı cep telefonuna veya başka bir dahiliye aktarılır.",
        configTable: {
          headers: ["Kural", "Tetiklenme Koşulu", "Örnek Yapılandırma"],
          rows: [
            ["Her Zaman (Always)", "Abone müsait olsa dahi gelen tüm çağrılar", "Aktif → Dış Numara: 0532 123 45 67"],
            ["Meşgul Durumda (Busy)", "Abone aktif görüşmedeyken veya DND modundayken", "Aktif → Dahili: 1002 veya Kuyruk: 6000"],
            ["Cevapsız / Ulaşılamaz (No Answer)", "Süre aşımı (15–60 sn) veya telefon kapalı/kayıtsızken", "Aktif → GSM: 0532 123 45 67 • Süre: 20 sn"]
          ]
        }
      }
    ],
    troubleshooting: [
      {
        problem: "Kullanıcının yanındaki durum ışığı kırmızı (Bağlı Değil) görünüyor.",
        solution: "WebPhone için tarayıcı mikrofon iznini ve HTTPS bağlantısını kontrol edin. Masa telefonu için Oto Provizyon sekmesinden SIP şifresinin ve TCP/UDP portunun (5060) eşleştiğini doğrulayın."
      }
    ]
  },
  {
    id: "dis-hatlar-ve-arama-kurallari",
    number: "03",
    title: "Dış Hatlar (SIP Trunk) & Arama Kuralları",
    shortTitle: "SIP Trunk & Kurallar",
    category: "Santral (PBX)",
    badge: "Operatör & DID",
    readMinutes: 8,
    summary:
      "Operatör SIP Trunk tanımlama (Ikon Telekom, Netgsm, Bulutfon, Türk Telekom), DID gelen arama yönlendirme, giden arama önek/CallerID/PIN kuralları, anonslar ve mesai saatleri.",
    screenshots: [
      {
        src: "/screenshots/dis-hatlar-ve-arama-kurallari/01-trunks.png",
        caption: "Dış Hat Tanımı (SIP Trunks) — Kayıt durumu, eşzamanlı kanal limiti ve kodek önceliği",
        routeHint: "Santral → Dış Hat Tanımı"
      },
      {
        src: "/screenshots/dis-hatlar-ve-arama-kurallari/02-inbound-outbound.png",
        caption: "Gelen Arama (DID) ve Giden Arama Kuralları — Numara bazlı yönlendirme ve önek yönetimi",
        routeHint: "Santral → Gelen / Giden Arama Kuralı"
      }
    ],
    sections: [
      {
        heading: "3.1 Örnek Operatör SIP Trunk Konfigürasyonu",
        body:
          "Nornia, PJSIP tabanlı modern SIP Trunk yapısını kullanır. Hem kullanıcı adı/şifre (Registration) hem de statik IP yetkilendirmeli (IP-Auth) operatör hatlarını destekler.",
        configTable: {
          headers: ["Parametre", "Kayıtlı Hat (Registration) Örneği", "Statik IP Hat (IP-Auth) Örneği"],
          rows: [
            ["Hat Adı", "Operator_Trunk", "TT_SIP_Trunk"],
            ["SIP Sunucu (Host)", "sip.ikontelekom.com.tr (Port: 5060)", "212.156.x.x (Port: 5060)"],
            ["Kimlik Doğrulama", "Kullanıcı Adı + Şifre (Outbound Register Açık)", "IP Tabanlı (Auth Kapalı / Match IP Dolu)"],
            ["Varsayılan CallerID / DID", "908503607390", "902124440000"],
            ["Kodek Önceliği", "alaw, ulaw, g729", "alaw, ulaw"],
            ["NAT Ayarı", "Sistem Ayarları → NAT → Dış IP tanımlı olmalı", "Yerel ağ aralıkları (local_nets) tanımlı olmalı"]
          ]
        }
      },
      {
        heading: "3.2 Gelen (DID) ve Giden Arama Kuralları",
        body:
          "Operatörden gelen her numara (DID) farklı bir Arama Akışına (IVR), ACD Kuyruğuna, AI Temsilciye veya doğrudan bir dahiliye bağlanabilir. Giden aramalarda ise numara önekine göre (05 GSM, 02/03/04 sabit, 00 uluslararası) farklı trunk, CallerID ve PIN zorunluluğu tanımlanabilir.",
        codeExample: {
          title: "Örnek Giden Arama Kural Seti",
          lang: "text",
          code: `# 1. Acil Numaralar (112, 110, 155) -> Kısıtsız, Lisans Ek Süresinde Bile Açık
Kural: Acil Aramalar     | Önek: 112        | Trunk: Operator_Trunk | PIN: Yok

# 2. Yurtiçi GSM Aramaları -> 905XXXXXXXXX formatına otomatik dönüştür
Kural: Yurtiçi GSM       | Önek: 05         | Silinen Hane: 1 | Eklenen Önek: 90 | CallerID: 908503607390

# 3. Yurtiçi Sabit Hatlar
Kural: Şehir İçi/Dışı    | Önek: 02,03,04   | Silinen Hane: 1 | Eklenen Önek: 90 | CallerID: 908503607390

# 4. Uluslararası Aramalar (Yalnızca Yetkili Abone Grubu)
Kural: Yurtdışı          | Önek: 00         | İzinli Grup: Yöneticiler | PIN: Aktif`
        }
      },
      {
        heading: "3.3 Mesai Saatleri, Resmi Tatiller & Anons Yönetimi",
        body:
          "Mesai saatleri haftanın günlerine göre (örn. Pzt–Cum 09:00–18:00, Cmt 09:00–13:00) tanımlanır. Türkiye resmi tatilleri (1 Ocak, 23 Nisan, 1 Mayıs, 19 Mayıs, 15 Temmuz, 30 Ağustos, 28 Ekim yarım gün, 29 Ekim) hazır yüklü gelir. Anons Yönetimi ekranında WAV/MP3 yükleyebilir veya dahili TTS motoruyla metinden stüdyo kalitesinde Türkçe anons üretebilirsiniz."
      }
    ],
    troubleshooting: [
      {
        problem: "Giden aramada 'Everyone is busy/congested' hatası alınıyor.",
        solution: "Operatör genellikle kayıtlı DID numarasını CallerID olarak bekler. Giden Arama Kuralı veya Kullanıcı ayarındaki 'Giden CallerID' alanına operatörün tahsis ettiği 90850... / 90212... numarasını girin."
      },
      {
        problem: "Arama bağlanıyor ancak tek yönlü ses veya hiç ses gelmiyor.",
        solution: "Sistem Ayarları → NAT ve Dış IP ekranında 'NAT Aktif' işaretleyin, sunucunun gerçek dış IP'sini girin ve güvenlik duvarında UDP 10000–20000 (RTP) portlarının açık olduğunu doğrulayın."
      }
    ]
  },
  {
    id: "arama-akisi-ve-ivr",
    number: "04",
    title: "Görsel Arama Akışı (Call Flow) & IVR",
    shortTitle: "Arama Akışı & IVR",
    category: "Çağrı & Yönlendirme",
    badge: "Görsel Editör",
    readMinutes: 6,
    summary:
      "Kod yazmadan sürükle-bırak görsel IVR tasarımı, mesai kontrol düğümü, DTMF tuşlama menüleri, kuyruk taşma politikaları ve Yapay Zeka Asistanına koşullu aktarım.",
    screenshots: [
      {
        src: "/screenshots/arama-akisi-ve-ivr/01-call-flow.png",
        caption: "Görsel Arama Akışı Tasarımcısı — Düğümler arası bağlantılar ve anlık doğrulama",
        routeHint: "Çağrı & Yönlendirme → Arama Akış Yönetimi"
      }
    ],
    sections: [
      {
        heading: "4.1 Kullanılabilir Akış Düğümleri",
        body:
          "Arama Akış Yönetimi ekranında her gelen hat (DID) için bağımsız bir akış şeması çizebilirsiniz. Kaydettiğiniz anda Asterisk dialplan'ı otomatik derlenir.",
        configTable: {
          headers: ["Düğüm Tipi", "Görevi", "Örnek Kullanım"],
          rows: [
            ["Gelen Çağrı (Start)", "DID veya genel giriş noktası", "908503607390 hattına gelen çağrılar"],
            ["Mesai Saati Kontrolü", "Mesai İçi / Mesai Dışı / Tatil dallanması", "09:00–18:00 canlı ekip, sonrası AI Asistan"],
            ["Anons / Ses Çal", "Karşılama veya KVKK bilgilendirme anonsu", "'Görüşmelerimiz kalite gereği kayıt altındadır...'"],
            ["IVR Tuşlama Menüsü", "1–9 arası DTMF tuşlarına göre dallanma", "1: Satış, 2: Teknik Destek, 3: Muhasebe, 0: Operatör"],
            ["ACD Kuyruğa Aktar", "Çağrıyı bekleme müziğiyle kuyruğa gönderme", "6000 Satış Kuyruğu (60 sn taşarsa AI/Sesli Posta)"],
            ["AI Temsilciye Bağla", "Gerçek zamanlı sesli yapay zeka asistanına aktarma", "Mesai dışı randevu ve sipariş sorgulama AI'ı"],
            ["Dahili / Dış Numara", "Tekil abone veya nöbetçi GSM yönlendirmesi", "VIP müşteriyi doğrudan müşteri temsilcisine bağla"]
          ]
        }
      },
      {
        heading: "4.2 Örnek Kurumsal Senaryo: Mesai İçi Kuyruk + Mesai Dışı AI Asistan",
        body:
          "Aşağıdaki örnek şema, çağrı merkezlerinde en yaygın kullanılan sıfır kayıp çağrı mimarisini gösterir:",
        codeExample: {
          title: "Örnek Akış Zinciri",
          lang: "text",
          code: `[Gelen Çağrı: 908503607390]
   └──▶ [KVKK & Karşılama Anonsu]
           └──▶ [Mesai Kontrolü (Pzt-Cum 09:00-18:00)]
                   ├── (Mesai İçi) ──▶ [IVR Menü]
                   │                      ├── Tuş 1 ──▶ [ACD Kuyruk 6000: Satış] ──(Taşma 45sn)──▶ [Smart Callback]
                   │                      ├── Tuş 2 ──▶ [ACD Kuyruk 6001: Destek]
                   │                      └── Hatalı/Zaman Aşımı ──▶ [Operatör Dahili 1000]
                   └── (Mesai Dışı / Tatil) ──▶ [AI Temsilci: Nornia_7x24_Asistan]
                                                    └──▶ (Randevu / Arıza Kaydı + WhatsApp Özet)`
        }
      }
    ],
    troubleshooting: [
      {
        problem: "IVR tuşlamaları (DTMF) algılanmıyor.",
        solution: "SIP Trunk ayarlarında DTMF modunun 'rfc4733' (veya operatörün belirttiği 'inband/info') olduğunu kontrol edin."
      }
    ]
  },
  {
    id: "cagri-merkezi-ve-acd",
    number: "05",
    title: "Çağrı Merkezi, ACD Kuyruk & Süpervizör",
    shortTitle: "Çağrı Merkezi & ACD",
    category: "Operasyon & İzleme",
    badge: "ACD & Wallboard",
    readMinutes: 9,
    summary:
      "ACD kuyruk stratejileri, Temsilci Çağrı Paneli & dahili WebPhone, Canlı Wallboard, Süpervizör Dinleme/Fısıldama/Araya Girme, Mola Onayı, WFM Vardiya, Smart Callback ve Dialer.",
    screenshots: [
      {
        src: "/screenshots/cagri-merkezi-ve-acd/01-call-panel.png",
        caption: "Temsilci Çağrı Paneli — Dahili WebPhone, canlı müşteri kartı, hızlı transfer ve ACW sonuç kodları",
        routeHint: "Operasyon & İzleme → Temsilci Çağrı Paneli"
      },
      {
        src: "/screenshots/cagri-merkezi-ve-acd/02-wallboard.png",
        caption: "Canlı İzleme Paneli (Wallboard) — Gerçek zamanlı SLA, bekleyen çağrılar ve temsilci durumları",
        routeHint: "Operasyon & İzleme → Canlı İzleme Paneli"
      },
      {
        src: "/screenshots/cagri-merkezi-ve-acd/03-queues.png",
        caption: "ACD Kuyruk Yönetimi — Dağıtım stratejileri, RONA, ACW süresi ve memnuniyet anketi",
        routeHint: "Santral → ACD Kuyruk"
      }
    ],
    sections: [
      {
        heading: "5.1 ACD Kuyruk Dağıtım Stratejileri",
        body:
          "Her kuyruk için en adil veya en hızlı yanıtı sağlayacak çalma stratejisini, çalma süresini, ACW (çağrı sonrası not süresi) ve RONA (cevaplamayan temsilciyi otomatik molaya alma) kurallarını belirleyebilirsiniz.",
        configTable: {
          headers: ["Strateji", "Çalışma Mantığı", "İdeal Senaryo"],
          rows: [
            ["rrmemory (Sıralı Hafızalı)", "En son çalan temsilciden bir sonrakine sırayla verir", "Dengeli çağrı dağılımı (en çok önerilen)"],
            ["leastrecent (En Az Görüşen)", "En uzun süredir çağrı almayan temsilciyi çaldırır", "Yüksek hacimli destek ekipleri"],
            ["ringall (Hepsini Çaldır)", "Müsait tüm temsilcileri aynı anda çaldırır", "Küçük ofisler ve VIP acil hatlar"],
            ["fewestcalls (En Az Çağrı)", "Gün içinde en az çağrı yanıtlayan temsilciye verir", "Prim/satış adaleti gerektiren ekipler"]
          ]
        }
      },
      {
        heading: "5.2 Süpervizör Canlı Müdahale (Dinle / Fısılda / Araya Gir)",
        body:
          "Yetkili süpervizörler Canlı Çağrı İzleme ekranından devam eden herhangi bir temsilci veya AI görüşmesine tek tıkla 3 farklı modda bağlanabilir:",
        steps: [
          "Sessiz Dinleme (Listen): Hem müşteri hem temsilci sesi duyulur; iki taraf da süpervizörü duymaz.",
          "Fısıldama / Sufle (Whisper): Süpervizörün sesi yalnızca temsilciye gider; müşteri duymaz (yeni personel eğitimi için ideal).",
          "Araya Girme (Barge-In): Süpervizör görüşmeye 3. taraf konferans olarak dahil olur; herkes birbirini duyar."
        ]
      },
      {
        heading: "5.3 Smart Callback & Dış Arama (Dialer)",
        body:
          "Kuyrukta belirlenen süreden (örn. 60 sn) uzun bekleyen müşterilere 'Sıranızı kaybetmeden sizi geri arayalım' seçeneği sunulur. Dış Arama (Dialer) modülü ile CSV/Excel numara listelerini otomatik temsilciye veya AI Asistana aratıp kampanya dönüşüm oranlarını raporlayabilirsiniz."
      }
    ],
    troubleshooting: [
      {
        problem: "Temsilci WebPhone'da çağrı alıyor ancak ses mikrofondan gitmiyor.",
        solution: "Tarayıcı adres çubuğundaki kilit simgesinden Mikrofon izninin 'İzin Verildi' olduğunu ve WebPhone ayarlarında doğru kulaklık/mikrofon cihazının seçildiğini kontrol edin."
      }
    ]
  },
  {
    id: "yapay-zeka-suite",
    number: "06",
    title: "Yapay Zeka Suite (AI Temsilciler & RAG)",
    shortTitle: "Yapay Zeka (AI)",
    category: "Yapay Zeka & Bilgi",
    badge: "Gemini / OpenAI / RAG",
    readMinutes: 10,
    summary:
      "Gerçek zamanlı sesli AI Temsilcileri, Görsel Senaryo Tasarımcısı, Bilgi Bankası (RAG — PDF & Web Tarama), AI Konfigürasyon Asistanı, Canlı Çeviri & Simultane Tercüman, Duygu Analizi ve QA.",
    screenshots: [
      {
        src: "/screenshots/yapay-zeka-suite/01-ai-agents.png",
        caption: "AI Temsilcileri & Görsel Senaryo Editörü — Diyalog dallanması, KVKK onayı, form toplama ve aktarım",
        routeHint: "Yapay Zeka & Bilgi → AI Temsilcileri"
      },
      {
        src: "/screenshots/yapay-zeka-suite/02-rag-kb.png",
        caption: "Bilgi Bankası (RAG) — PDF/DOCX doküman yükleme ve kurumsal web sitesi otomatik tarama",
        routeHint: "Yapay Zeka & Bilgi → Bilgi Bankası (RAG)"
      },
      {
        src: "/screenshots/yapay-zeka-suite/03-ai-providers.png",
        caption: "Yapay Zeka API Anahtarları ve Görev Bazlı Model Yönlendirme",
        routeHint: "Sistem Ayarları → Yapay Zeka & Analiz"
      }
    ],
    sections: [
      {
        heading: "6.1 Sesli AI Temsilci Oluşturma & Görsel Senaryo Editörü",
        body:
          "Nornia AudioSocket motoru (port 9092), çağrı sesini milisaniye gecikmeyle Gemini Live / OpenAI Realtime motorlarına aktarır. Görsel Senaryo Editörü ile kod yazmadan akış çizebilir veya 'AI Senaryo Asistanı' kutusuna Türkçe talimat yazarak tüm diyagramı otomatik ürettirebilirsiniz.",
        steps: [
          "Önce Sistem Ayarları → Yapay Zeka & Analiz → Yapay Zeka API Anahtarları ekranından Google Gemini / OpenAI / ElevenLabs anahtarınızı kaydedin.",
          "Yapay Zeka & Bilgi → Bilgi Bankası (RAG) ekranından ürün kataloglarınızı (PDF) veya web sitenizin URL'ini indeksleyin.",
          "AI Temsilcileri ekranında '+' ile yeni bir AI Temsilci oluşturun; ses tonu, karşılama cümlesi ve izin verilen aksiyonları (Randevu Al, İsimle Dahiliye Aktar, CRM Sorgula) seçin.",
          "Görsel Senaryo Editöründe akışı kaydedip Gelen Arama Kuralı veya Call Flow üzerinden bir numaraya bağlayın."
        ]
      },
      {
        heading: "6.2 İsimle Dinamik Dahili Transfer & Canlı Araç (Tool) Çağrısı",
        body:
          "Müşteri 'Ahmet Yılmaz ile görüşmek istiyorum' dediğinde AI Temsilci santralin canlı kullanıcı rehberinden ilgili dahili numarayı otomatik bulur ve çağrıyı Asterisk AMI üzerinden anında aktarır. Ayrıca konuşma sırasında dış ERP/CRM API'lerini asenkron çağırarak sipariş veya randevu bilgisi okuyabilir."
      },
      {
        heading: "6.3 Canlı Çeviri, AI Fısıldama, Kriz Radarı & Otomatik QA",
        body:
          "Temsilci görüşmeleri sırasında yabancı dilde konuşan müşterilerin sesini anlık Türkçe altyazıya veya çift yönlü sesli tercümeye dönüştürebilirsiniz. Negatif duygu/kriz algılandığında süpervizör ekranında anlık alarm radarı açılır; çağrı bitiminde ise AI Kalite Kontrol (QA) görüşmeyi tanımlı kriterlere göre otomatik puanlar."
      }
    ],
    troubleshooting: [
      {
        problem: "AI Temsilci yanıt vermiyor veya çağrı hemen kapanıyor.",
        solution: "Yapay Zeka API Anahtarları ekranında aktif sağlayıcı anahtarının girildiğini ve API Bütçe/Kota limitinin dolmadığını kontrol edin."
      }
    ]
  },
  {
    id: "omnichannel-ve-crm",
    number: "07",
    title: "Omnichannel & CRM Entegrasyonları",
    shortTitle: "Omnichannel & CRM",
    category: "Kanallar & Entegrasyon",
    badge: "WhatsApp / Meta / CRM",
    readMinutes: 8,
    summary:
      "Ortak Gelen Kutusu, çoklu hat destekli WhatsApp Business Cloud API (0850 dahil), Telegram, Instagram & Facebook Direct, E-Posta (SMTP/IMAP), Müşteri 360°, CTI Screen Pop ve Evrensel API.",
    screenshots: [
      {
        src: "/screenshots/omnichannel-ve-crm/01-omnichannel.png",
        caption: "Ortak Gelen Kutusu — WhatsApp, Telegram, Instagram, Facebook ve E-Posta tek ekranda",
        routeHint: "Operasyon & İzleme → Ortak Gelen Kutusu"
      },
      {
        src: "/screenshots/omnichannel-ve-crm/02-channels.png",
        caption: "Kanal Entegrasyonları — Çoklu WhatsApp hattı, AI Persona, Mesai Dışı Otomatik Yanıt ve Webhook",
        routeHint: "Sistem Ayarları → Kanallar & Entegrasyon"
      }
    ],
    sections: [
      {
        heading: "7.1 WhatsApp Business Cloud API Kurulumu (Çoklu Hat & 0850)",
        body:
          "Meta Developers üzerinden resmi WhatsApp Business Cloud API ile hem cep hem 0850 kurumsal numaralarınızı bağlayabilirsiniz. Her hat için ayrı AI Persona (Samimi, Satış, Destek, Kurumsal), 3 butonlu karşılama menüsü ve mesai dışı otomatik yanıt tanımlanabilir.",
        configTable: {
          headers: ["Meta Webhook Alanı", "Değer"],
          rows: [
            ["Callback URL", "https://<santraliniz>.nornia.com.tr/api/webhooks/whatsapp"],
            ["Verify Token", "ai_pbx_whatsapp_verify_token_secure (Kanal ayarlarından değiştirilebilir)"],
            ["Abone Olunacak Alan", "messages"],
            ["Cevapsız Çağrı Oto-Mesaj", "Açıldığında, kaçan gelen aramalarda müşteriye otomatik WhatsApp mesajı gönderilir"],
            ["Toplu Kampanya", "CSV/TXT numara listesi yükleyerek onaylı şablonlarla toplu bilgilendirme"]
          ]
        }
      },
      {
        heading: "7.2 Telegram, Meta Direct (Instagram / Facebook) ve E-Posta",
        body:
          "Telegram Bot Token, Instagram/Facebook Sayfa Erişim Anahtarı ve kurumsal SMTP/IMAP bilgilerini Sistem Ayarları → Kanallar ekranına girdiğinizde tüm kanallardan gelen mesajlar Ortak Gelen Kutusuna düşer. İsterseniz ilk yanıtı AI verir; müşteri 'Canlı Temsilci' dediğinde görüşme anında temsilciye devredilir."
      },
      {
        heading: "7.3 CRM Marketi, CTI Screen Pop & API",
        body:
          "Zoho, HubSpot, Salesforce ve Bitrix24 için hazır bağlantı şablonları mevcuttur. Özel CRM/ERP entegrasyonları için Kurumsal Dış REST API dokümanına (https://api.nornia.com.tr) başvurabilirsiniz."
      }
    ],
    troubleshooting: [
      {
        problem: "WhatsApp webhook doğrulaması Meta panelinde başarısız oluyor.",
        solution: "Santralinizin Nornia Bulut FQDN (HTTPS) ile dışarıdan erişilebilir olduğunu ve Verify Token değerinin her iki tarafta birebir aynı olduğunu kontrol edin."
      }
    ]
  },
  {
    id: "oto-provizyon-ve-cihazlar",
    number: "08",
    title: "Oto Provizyon & Masa Telefonları",
    shortTitle: "Oto Provizyon & Cihazlar",
    category: "Santral (PBX)",
    badge: "Zero-Touch DHCP 66",
    readMinutes: 7,
    summary:
      "Aynı ofis (LAN) ve uzak şube (WAN) Zero-Touch masa telefonu kurulumu, DHCP Option 66, Yealink/Grandstream/Fanvil/Cisco şablonları, BLF/DSS tuş yönetimi ve Runa Masaüstü/Mobil uygulamaları.",
    screenshots: [
      {
        src: "/screenshots/oto-provizyon-ve-cihazlar/01-autoprovision.png",
        caption: "Oto Provizyon Merkezi — LAN/WAN Zero-Touch adresleri, MAC eşleştirme ve canlı ağ taraması",
        routeHint: "Santral → Oto Provizyon"
      }
    ],
    sections: [
      {
        heading: "8.1 LAN ve WAN (Uzak Şube) Zero-Touch Provizyon",
        body:
          "Nornia her kurulumda otomatik olarak iki benzersiz provizyon adresi üretir. Telefonun MAC adresini dahiliyle eşleştirdiğinizde cihaz fabrika ayarlarıyla fişe takıldığı anda SIP hesabını, saat dilimini, Türkçe arayüzü, kurumsal rehberi ve BLF tuşlarını otomatik çeker.",
        configTable: {
          headers: ["Mod", "Provizyon URL Yapısı", "SIP Sunucu & Kullanım Alanı"],
          rows: [
            ["Aynı Lokasyon (LAN)", "http://<YEREL-IP>:8000/api/prov/<TOKEN>/lan", "<YEREL-IP>:5060 (UDP) — Ofis içi DHCP Option 66 veya manuel URL"],
            ["Uzak Şube (WAN)", "http://<musteri>.nornia.com.tr/api/prov/<TOKEN>/wan", "<musteri>.nornia.com.tr:5060 (TCP) — Port açmadan Nornia SIP Edge üzerinden kayıt"]
          ]
        }
      },
      {
        heading: "8.2 Masa Telefonu BLF, DSS Tuşları & Uzaktan Yeniden Başlatma",
        body:
          "Kullanıcılar veya Oto Provizyon ekranından her telefonun fiziksel tuşlarına (Line, BLF meşgul lambası, Hızlı Arama, Çağrı Park/Çekme) görsel simülatör üzerinde atama yapabilirsiniz. Kaydettikten sonra 'Telefona Bildir (SIP NOTIFY)' butonuyla cihazı yerinden kalkmadan güncelleyebilirsiniz."
      },
      {
        heading: "8.3 Runa Masaüstü / Mobil Uygulama & Call Flip (*11)",
        body:
          "Runa uygulamaları (macOS, Windows, iOS, Android) santralin FQDN adresi ve kullanıcı e-posta/şifresi ile tek tıkla bağlanır. Görüşme sırasında *11 tuşlayarak (veya WebPhone 'Cihaz Değiştir' butonuyla) çağrıyı masanızdaki telefondan cep telefonunuza kesintisiz aktarabilirsiniz."
      }
    ],
    troubleshooting: [
      {
        problem: "Uzak şubedeki masa telefonu provizyon çekiyor ancak SIP kaydı olmuyor.",
        solution: "Telefonun cihaz ayarında 'Bağlantı Modu: WAN (Uzak Şube)' ve 'Transport: TCP' seçili olduğunu, ayrıca santralde Nornia Connect tünelinin ve SIP Edge'in aktif olduğunu doğrulayın."
      }
    ]
  },
  {
    id: "raporlama-ve-analitik",
    number: "09",
    title: "Raporlama & Analitik (40+ Rapor)",
    shortTitle: "Raporlama & Analitik",
    category: "Çağrı Raporları & Analiz",
    badge: "40+ Kurumsal Rapor",
    readMinutes: 7,
    summary:
      "Detaylı CDR, transfer/pickup zinciri, ses kayıtları, kuyruk SLA, temsilci KPI & puantaj, ilk aramada çözüm (FCR), AI vs İnsan ROI, CEO özeti, Özel Rapor Tasarımcısı ve zamanlanmış e-posta raporları.",
    screenshots: [
      {
        src: "/screenshots/raporlama-ve-analitik/01-reports-hub.png",
        caption: "Raporlama Merkezi — 40+ hazır çağrı merkezi, santral ve yapay zeka analiz raporu",
        routeHint: "Çağrı Raporları & Analiz"
      },
      {
        src: "/screenshots/raporlama-ve-analitik/02-cdr.png",
        caption: "Detaylı CDR & Ses Kayıtları — Gelişmiş filtreleme, transkript ve Excel/CSV dışa aktarım",
        routeHint: "Çağrı Raporları → CDR"
      }
    ],
    sections: [
      {
        heading: "9.1 Başlıca Rapor Kategorileri",
        body:
          "Nornia tüm çağrı verilerini PostgreSQL üzerinde indeksler; tarih, kuyruk, temsilci, departman, lokasyon, yön ve sonuç koduna göre saniyeler içinde filtreleyip Excel/CSV/PDF olarak dışa aktarabilirsiniz.",
        configTable: {
          headers: ["Kategori", "Öne Çıkan Raporlar"],
          rows: [
            ["Santral & Trafik", "CDR, Ses Kayıtları, Kaçan Çağrı, Hat Kapasite, DID Raporu, Operatör Dakika & Paket, Hatalı Çağrılar, VoIP MOS Kalitesi"],
            ["Çağrı Merkezi & ACD", "Kuyruk SLA & Hız Dilimleri, Temsilci Performans & KPI (AHT/ASA/ACW), Temsilci Kronolojisi, Mola & Puantaj, FCR, IVR Terk Oranı, Tekrar Eden Arayanlar"],
            ["Yapay Zeka & Denetim", "Çağrı Transkripti, Duygu Analizi & Isı Haritası, Kalite Değerlendirmeleri (QA), Kelime Bulutu, Niyet & Çile Noktaları, AI vs İnsan ROI, CEO Özet Raporu, Süpervizör Müdahale Denetimi"],
            ["Omnichannel & Kampanya", "Omnichannel Kanal & SLA, Dialer Kampanya & Geri Arama, Anket Raporları, Randevu & RAG Raporu"]
          ]
        }
      },
      {
        heading: "9.2 Özel Rapor Tasarımcısı & Zamanlanmış Raporlar",
        body:
          "Özel Rapor Tasarımcısı ile kendi sütun ve filtre kombinasyonlarınızı kaydedebilir veya doğal dille AI Rapor Üreticiye sorabilirsiniz. Zamanlanmış Raporlar modülü ile seçtiğiniz raporların her sabah 08:30'da veya her Pazartesi yöneticilerin e-posta adresine otomatik gönderilmesini sağlayabilirsiniz."
      }
    ],
    troubleshooting: [
      {
        problem: "Süpervizör tüm temsilcileri değil sadece kendi ekibini görmeli.",
        solution: "Roller ekranında süpervizör rolüne 'Rapor & Yönetim Filtresi (supervisor:scope_filter)' yetkisini verip Kullanıcı düzenleme ekranından yönettiği kuyruk/temsilcileri atayın."
      }
    ]
  },
  {
    id: "ag-guvenlik-ve-merkezi-panel",
    number: "10",
    title: "Ağ, Federasyon, Güvenlik & Merkezi Panel",
    shortTitle: "Ağ, Güvenlik & Panel",
    category: "Yönetim & Güvenlik",
    badge: "Güvenlik & Filo",
    readMinutes: 9,
    summary:
      "Çok-şubeli Multi-Site Federasyon, Sunucu Ağ & Statik Rota, Güvenlik Kalkanı & 2FA, KVKK Onay, Active Directory (LDAP/Entra ID), Roller, Yedekleme, sngrep/PCAP ve Merkezi Yönetim Paneli.",
    screenshots: [
      {
        src: "/screenshots/ag-guvenlik-ve-merkezi-panel/01-security.png",
        caption: "Güvenlik Kalkanı & Roller — Brute-Force koruması, IP engelleme, 2FA ve granüler yetki matrisi",
        routeHint: "Yönetim & Ayarlar → Güvenlik Kalkanı / Roller"
      },
      {
        src: "/screenshots/ag-guvenlik-ve-merkezi-panel/02-sngrep.png",
        caption: "Web sngrep & SIP Paket İnceleyici — Canlı çağrı merdiven diyagramı ve tek tıkla .pcap indirme",
        routeHint: "Yönetim & Ayarlar → Sorun İnceleme"
      }
    ],
    sections: [
      {
        heading: "10.1 Güvenlik Kalkanı, 2FA & KVKK Onay Yönetimi",
        body:
          "Nornia, SIP taramalarına ve web kaba kuvvet (Brute-Force) saldırılarına karşı yerleşik Güvenlik Kalkanı ile gelir. Tüm kullanıcılar için Google Authenticator / Microsoft Authenticator (TOTP) veya E-Posta 2FA zorunlu kılınabilir; KVKK & Gizlilik Politikası metni ilk girişte onaylanarak zaman damgalı loglanır."
      },
      {
        heading: "10.2 Web sngrep, PCAP İndirme & Yedekleme / Geri Yükleme",
        body:
          "Sorun İnceleme ekranındaki dahili Web sngrep motoru (port 5060/5061/8089) SIP sinyalleşmesini görsel merdiven akışı olarak gösterir ve tek tıkla Wireshark uyumlu .pcap dosyası indirmenizi sağlar. Geri Yükleme Noktaları ile büyük değişikliklerden önce anlık konfigürasyon yedeği alıp kategori bazlı geri dönebilirsiniz."
      },
      {
        heading: "10.3 Çok-Şubeli Federasyon & Merkezi Filo Paneli (panel.nornia.com.tr)",
        body:
          "Birden fazla şubedeki Nornia santrallerini Multi-Site Federasyon ile tek birleşik numara planı altında birbirine bağlayabilirsiniz. Tüm santrallerinizin CPU/RAM/Disk sağlığını, lisans yenilemelerini, tek tıkla toplu OTA yazılım güncellemelerini ve güvenli Web SSH erişimini panel.nornia.com.tr üzerinden merkezi olarak yönetebilirsiniz."
      }
    ],
    troubleshooting: [
      {
        problem: "Yanlış şifre denemeleri nedeniyle kendi IP adresim engellendi.",
        solution: "Sunucuya konsoldan veya başka bir beyaz listeli IP'den giriş yapıp Güvenlik Kalkanı → Engellenen IP'ler listesinden engeli kaldırabilir ve ofis IP'nizi Beyaz Listeye ekleyebilirsiniz."
      }
    ]
  }
];
