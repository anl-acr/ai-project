export const CHAPTERS_TEKNIK_MIMARI = [
  {
    id: "sistem-mimarisi-ve-servis-haritasi",
    number: "99",
    groupId: "teknik-mimari",
    category: "Teknik Mimari & Sistem Dokümantasyonu",
    title: "Sistem Mimarisi, Çalışan Servisler & Port Haritası",
    shortTitle: "Servisler & Port Haritası",
    menuPath: "Teknik Dokümantasyon → Sistem Mimarisi & Servis Envanteri",
    pbxRoute: "/opt/ai-project",
    permissions: ["Sistem Yöneticisi / BT Mühendisi (SSH: nornia veya root)"],
    badge: "Teknik Mimari • Çekirdek",
    readMinutes: 14,
    summary:
      "Nornia Enterprise AI PBX sunucusunda çalışan tüm işletim sistemi, PM2, veritabanı, telekom ve ağ servislerinin görevlerini, hangi port ve protokollerden haberleştiklerini, kritik dizin/dosya yollarını ve canlı sağlık doğrulama komutlarını uçtan uca anlatır.",
    architectureDiagram: "core",
    prerequisites: [
      "Nornia Enterprise AI PBX, Ubuntu 24.04 LTS (amd64) işletim sistemi üzerinde `/opt/ai-project` dizininde tek sunuculu tümleşik mimari veya yüksek erişilebilirlikli çoklu düğüm olarak çalışır.",
      "Web ve API süreçleri `PM2` (`pm2-root.service`), altyapı servisleri ise `systemd` (`nginx`, `asterisk`, `postgresql`, `fail2ban`, `chrony`, `nornia-console-banner`) tarafından yönetilir.",
      "Dış dünya yalnızca Nginx (80/443) ve SIP/RTP portlarıyla temas eder; Next.js (`127.0.0.1:3000`), PostgreSQL (`127.0.0.1:5444`), Asterisk AMI (`127.0.0.1:5038`) ve AudioSocket (`9092`) güvenlik gereği yerel arayüze izoledir."
    ],
    screenshots: [
      {
        src: "/screenshots/01-system-status.jpg",
        caption: "Nornia Sistem Panosu — Tüm servislerin çalışma durumu, CPU/RAM, disk ve aktif bağlantılar",
        routeHint: "Yönetim & Ayarlar → Sistem Panosu & Sağlık"
      }
    ],
    fieldTable: [
      {
        field: "nginx (systemd)",
        type: "Reverse Proxy • TCP 80 / 443",
        defaultVal: "0.0.0.0:80, 443",
        required: true,
        description: "Tüm HTTP/HTTPS ve WebSocket trafiğini karşılar, SSL/TLS sonlandırması yapar. `/` isteklerini Next.js (:3000), `/api/` ve `/ws` isteklerini FastAPI (:8000), `/asterisk/ws` WebRTC sinyalleşmesini ise Asterisk WSS (:8089/ws) ucuna aktarır."
      },
      {
        field: "aida-app (PM2 • Next.js 14)",
        type: "Frontend • TCP 3000",
        defaultVal: "127.0.0.1:3000",
        required: true,
        description: "Yönetim arayüzü, Temsilci Çağrı Paneli, WebRTC SIP.js Web Telefonu, Canlı Çeviri arayüzü, 44+ rapor ve İlk Kurulum Sihirbazı (/setup) üretim sunucusudur. Dışarıya doğrudan açılmaz, Nginx arkasında çalışır."
      },
      {
        field: "aida-backend (PM2 • FastAPI/Uvicorn)",
        type: "API & Orkestratör • TCP 8000",
        defaultVal: "0.0.0.0:8000",
        required: true,
        description: "Tüm REST API uç noktalarını, WebSocket canlı olay yayınını, Asterisk AMI yöneticisini, CallFlow değerlendiricisini, Omnichannel (WhatsApp/Meta/Telegram/IMAP) işçilerini, lisans doğrulamasını ve zamanlanmış rapor motorunu çalıştırır."
      },
      {
        field: "AudioSocket TCP Sunucusu (aida-backend içi)",
        type: "AI Ses Köprüsü • TCP 9092",
        defaultVal: "0.0.0.0:9092 (LAN/Local)",
        required: true,
        description: "`aida-backend` açılışında otomatik başlar. Asterisk dialplanındaki `AudioSocket()` çağrılarından gelen ham 8 kHz 16-bit PCM ses akışını gerçek zamanlı olarak yapay zeka sesli asistan sağlayıcılarına (Gemini Live / OpenAI / Yerel LLM) bağlar."
      },
      {
        field: "asterisk (systemd • Asterisk PJSIP)",
        type: "IP Santral Çekirdeği • 5060/5061/5160/8089/5038",
        defaultVal: "SIP + WSS + AMI + RTP",
        required: true,
        description: "SIP Trunk kayıtları, dahili/WebRTC uç noktaları, ACD kuyrukları, IVR/CallFlow yürütmesi, konferans köprüleri, MixMonitor ses kaydı ve 10000–20000/UDP RTP medya iletimini gerçekleştirir."
      },
      {
        field: "postgresql@16-main (systemd)",
        type: "Veritabanı + pgvector • TCP 5444",
        defaultVal: "127.0.0.1:5444 (ai_pbx)",
        required: true,
        description: "Tüm kullanıcılar, roller, kiracılar (multi-tenant), CDR çağrı kayıtları, transkriptler, mola günlükleri, randevular, Omnichannel sohbetleri ve 768 boyutlu RAG bilgi bankası vektörlerini (`pgvector`) saklar."
      },
      {
        field: "nornia-console-banner (systemd)",
        type: "TTY1 Konsol Panosu",
        defaultVal: "15 sn yenileme",
        required: false,
        description: "Fiziksel/VM konsol ekranındaki `/etc/issue` bilgisini 15 saniyede bir güncelleyerek sunucunun IP adresini, HW-ID'sini, servis durumlarını ve `/setup` adresini canlı gösterir."
      },
      {
        field: "ufw + fail2ban + chrony (systemd)",
        type: "Güvenlik & Zaman Senkronizasyonu",
        defaultVal: "Aktif",
        required: true,
        description: "UFW izinli portlar dışındaki tüm gelen trafiği reddeder; Fail2Ban SSH/SIP kaba kuvvet saldırılarını otomatik engeller; Chrony NTP ile CDR, lisans ve TOTP (2FA) saat doğruluğunu garanti eder."
      },
      {
        field: "wg-quick@wg-nornia (opsiyonel)",
        type: "WireGuard SIP Edge Tüneli • UDP 51820",
        defaultVal: "10.200.0.x",
        required: false,
        description: "Nornia Connect etkinleştirildiğinde kurum içi santral ile Merkez Hub arasında şifreli L3 WireGuard tüneli kurarak uzak IP telefonların açık port olmadan 5060/5061 üzerinden bağlanmasını sağlar."
      }
    ],
    sections: [
      {
        heading: "1. Servisler Arası Bağlantı Matrisi (Kim Kime Bağlanır?)",
        body: "Nornia mimarisinde her bileşenin yalnızca sorumlu olduğu katmanla haberleşmesi esas alınır. Bu izolasyon hem güvenliği artırır hem de tek bir servisin yeniden başlatılması sırasında diğer katmanların kesintisiz kalmasını sağlar.",
        steps: [
          "Tarayıcı / Runa Masaüstü / Runa Mobil → HTTPS (443) ile Nginx'e bağlanır. Sayfa HTML/JS'i `127.0.0.1:3000` (aida-app), API/WebSocket verileri `127.0.0.1:8000` (aida-backend), WebRTC SIP sinyali `/asterisk/ws → 127.0.0.1:8089/ws` (Asterisk) ucuna yönlenir.",
          "aida-backend ↔ PostgreSQL: Asenkron (`asyncpg`) ve senkron (`psycopg2`) SQLAlchemy bağlantı havuzlarıyla `127.0.0.1:5444/ai_pbx` veritabanına bağlanır; yapılandırma yedeğini `/opt/ai-project/backend/settings.json` ile senkronize tutar.",
          "aida-backend ↔ Asterisk: İki yönlü çalışır. (1) Backend, `127.0.0.1:5038` AMI soketiyle Asterisk olaylarını dinler ve canlı transfer/fısıldama/park/originate komutlarını gönderir. (2) Asterisk dialplanı gelen çağrıda `http://127.0.0.1:8000/api/calls/register` ve `/api/subscriber/resolve_forwarding` uçlarını çağırarak dinamik yönlendirme kararı alır.",
          "Asterisk ↔ AudioSocket AI Motoru: AI Sesli Asistan çağrısında Asterisk `127.0.0.1:9092` TCP portuna bağlanır; 36 karakterlik UUID ile oturumu açar ve çift yönlü ham PCM ses akışını `backend/audiosocket_server.py` motoruna iletir.",
          "aida-backend → Merkez Lisans & Connect Hub (`panel.nornia.com.tr`): Yalnızca dışa doğru (outbound) HTTPS/WSS/WireGuard bağlantılarıyla çoklu kiracı lisans heartbeat telemetrisi ve sıfır-port ters tünel bağlantısını sürdürür."
        ]
      },
      {
        heading: "2. Kritik Dizin Yapısı ve Yapılandırma Dosyaları",
        body: "Sistem yöneticilerinin bakım, log inceleme ve yedekleme süreçlerinde bilmesi gereken temel dosya yolları aşağıda özetlenmiştir.",
        codeBlock: {
          title: "Nornia Sunucu Dizin & Log Haritası",
          lang: "text",
          code: `/opt/ai-project/
├── backend/                     # FastAPI, AudioSocket, AMI, Omnichannel, Lisans servisleri
│   ├── main.py                  # Ana API uygulaması ve arka plan işçileri
│   ├── audiosocket_server.py    # Port 9092 AI Sesli Asistan TCP ses motoru
│   ├── .env                     # PostgreSQL & AMI bağlantı sırları (chmod 600)
│   ├── settings.json            # Çalışma zamanı ayar önbelleği (DB ile senkron)
│   └── scripts/sync_asterisk.py # Asterisk PJSIP/Dialplan/Queue konfigürasyon üreticisi
├── frontend/                    # Next.js üretim arayüzü (aida-app, :3000)
├── venv/                        # Python 3 sanal ortamı
├── ecosystem.config.js          # PM2 süreç tanımları (aida-app & aida-backend)
├── recordings/ & uploads/       # Medya, anons, RAG belgeleri ve ses dosyaları
└── backups/                     # Otomatik veritabanı ve ayar yedekleri

/etc/asterisk/
├── pjsip_custom.conf            # Nornia tarafından üretilen transport, trunk ve dahililer
├── extensions_custom.conf       # Dinamik gelen/giden/IVR/AI dialplan kuralları
├── queues_custom.conf           # ACD kuyruk tanımları
└── keys/asterisk.pem            # WebRTC WSS (8089) TLS sertifikası (chmod 644)

/etc/nginx/sites-available/nornia   # HTTP/HTTPS/WSS Reverse Proxy yapılandırması
/var/spool/asterisk/monitor/        # MixMonitor çağrı ses kayıtları (WAV/OPUS)
/root/.pm2/logs/                    # aida-app & aida-backend canlı stdout/stderr logları
/var/log/asterisk/full              # Asterisk ayrıntılı SIP/çağrı günlükleri`
        }
      },
      {
        heading: "3. Hızlı Sistem Sağlık & Servis Yönetim Komutları (SSH)",
        body: "Kurulum sonrası veya bakım sırasında tüm katmanların ayakta ve haberleşebilir olduğunu saniyeler içinde doğrulamak için aşağıdaki komut setini kullanabilirsiniz.",
        codeBlock: {
          title: "Tüm Servisleri ve Portları Tek Seferde Doğrulama",
          lang: "bash",
          code: `# 1. PM2 uygulama süreçlerini ve bellek kullanımını gör
PM2_HOME=/root/.pm2 pm2 status

# 2. Altyapı systemd servis durumlarını kontrol et
systemctl is-active nginx postgresql asterisk pm2-root fail2ban chrony

# 3. Açık dinleme portlarını doğrula (80, 443, 3000, 8000, 9092, 5038, 5444, 5060, 8089)
ss -tlnp | grep -E ':80 |:443 |:3000 |:8000 |:9092 |:5038 |:5444 |:8089 '
ss -ulnp | grep -E ':5060 '

# 4. Canlı HTTP ve AMI sağlık doğrulaması
curl -s http://127.0.0.1:8000/api/version && echo ""
asterisk -rx "manager show connected"
asterisk -rx "pjsip show transports"

# 5. Servis yeniden başlatma komutları
PM2_HOME=/root/.pm2 pm2 restart aida-backend
PM2_HOME=/root/.pm2 pm2 restart aida-app
systemctl restart asterisk nginx`
        }
      }
    ],
    tips: [
      "Yalnızca backend veya frontend güncellemesi yaptığınızda Asterisk'i yeniden başlatmanız gerekmez; devam eden telefon görüşmeleri kesintiye uğramadan `pm2 restart aida-backend` veya `pm2 restart aida-app` güvenle çalıştırılabilir.",
      "Asterisk yapılandırmasını manuel düzenlemek yerine daima Nornia arayüzünden değiştirin; arayüz `sync_asterisk.py` ile `*_custom.conf` dosyalarını atomik olarak üretir ve kesintisiz `reload` uygular."
    ],
    warnings: [
      "`/etc/asterisk/keys/asterisk.pem` sertifikası `asterisk` kullanıcısı tarafından okunabilir (`chmod 644`) olmalıdır; izin bozulursa WebRTC WSS (port 8089) açılmaz ve tarayıcı Web Telefonları çevrimdışı kalır."
    ],
    troubleshooting: [
      {
        symptom: "Tarayıcıda 502 Bad Gateway hatası görünüyor",
        cause: "`aida-app` (3000) veya `aida-backend` (8000) yeni yeniden başlatılmış (açılış ~6–10 sn sürer) ya da PM2 altında durmuş olabilir.",
        resolution: "`PM2_HOME=/root/.pm2 pm2 status` ve `pm2 logs --err --lines 30` ile kontrol edin; süreç kapalıysa `systemctl restart pm2-root` çalıştırın."
      },
      {
        symptom: "Backend açılıyor ancak çağrı izleme / transfer çalışmıyor",
        cause: "Asterisk AMI (`127.0.0.1:5038`) bağlantısı kopmuş veya `manager.conf` içindeki `ai_backend_user` şifresi `.env` ile uyuşmuyor olabilir.",
        resolution: "`asterisk -rx 'manager show connected'` çıktısında `ai_backend_user` görünmelidir; görünmüyorsa `systemctl restart asterisk && pm2 restart aida-backend` uygulayın."
      }
    ],
    relatedChapters: [
      "cagri-ve-ses-akisi-mimarisi",
      "yapay-zeka-audiosocket-ve-canli-ceviri-mimarisi",
      "nornia-connect-tunel-ve-merkez-hub-mimarisi"
    ]
  },

  {
    id: "cagri-ve-ses-akisi-mimarisi",
    number: "100",
    groupId: "teknik-mimari",
    category: "Teknik Mimari & Sistem Dokümantasyonu",
    title: "Çağrı, SIP/PJSIP, WebRTC & Ses Akışı (Call Lifecycle)",
    shortTitle: "Çağrı & Ses Akışı",
    menuPath: "Teknik Dokümantasyon → SIP/PJSIP, WebRTC & AMI Akışı",
    pbxRoute: "/etc/asterisk/*",
    permissions: ["Sistem Yöneticisi / VoIP Mühendisi"],
    badge: "VoIP • PJSIP • WebRTC",
    readMinutes: 13,
    summary:
      "Bir telefon çağrısının SIP operatörden veya tarayıcı WebRTC telefonundan başlayıp sonlanana kadar Asterisk PJSIP, FastAPI CallFlow motoru, AMI olay yöneticisi ve RTP medya katmanlarında tam olarak nasıl işlendiğini adım adım açıklar.",
    prerequisites: [
      "Asterisk PJSIP taşıyıcıları (`transport-udp` 5060, `transport-tcp` 5060, `transport-tls` 5061, `transport-cisco-tcp` 5160, `transport-wss` 8089) `pjsip_custom.conf` içinde tanımlıdır.",
      "NAT arkasındaki sunucularda `external_signaling_address`, `external_media_address` ve `local_net` değerleri Nornia NAT ayarlarından tüm transport bloklarına dinamik olarak enjekte edilir."
    ],
    screenshots: [
      {
        src: "/screenshots/tabs/troubleshooting/04-sngrep.jpg",
        caption: "Dahili Web sngrep / SIP Debugger — Canlı SIP INVITE / 200 OK / BYE akış diyagramı ve PCAP indirici",
        routeHint: "Yönetim & Ayarlar → Sorun İnceleme (SIP Debugger)"
      }
    ],
    fieldTable: [
      {
        field: "SIP UDP / TCP (5060)",
        type: "PJSIP Sinyalleşme",
        defaultVal: "UDP/TCP 5060",
        required: true,
        description: "SIP Trunk operatörleri (Türk Telekom, Superonline, İkon Telekom, Netgsm vb.) ve yerel/uzak IP masa telefonlarının (Yealink, Fanvil, Grandstream) standart sinyalleşme portudur."
      },
      {
        field: "SIP TLS (5061) & Cisco TCP (5160)",
        type: "Şifreli / Kurumsal SIP",
        defaultVal: "TCP 5061 / 5160",
        required: false,
        description: "TLS şifreli SIP oturumları için 5061, Cisco Enterprise IP telefonları (79xx/88xx/89xx özel yama destekli) için ayrılmış 5160 TCP taşıyıcısıdır."
      },
      {
        field: "WebRTC WSS (8089 → Nginx /asterisk/ws)",
        type: "WebSocket Secure SIP",
        defaultVal: "127.0.0.1:8089/ws",
        required: true,
        description: "Tarayıcıdaki SIP.js (0.20.1) Web Telefon, Runa Masaüstü ve Runa Mobil istemcileri HTTPS 443 üzerindeki `/asterisk/ws` yolundan Asterisk'in 8089 WSS ucuna tünellenir."
      },
      {
        field: "RTP Medya Aralığı (10000–20000/UDP)",
        type: "Ses Akışı (DTLS-SRTP / RTP)",
        defaultVal: "UDP 10000–20000",
        required: true,
        description: "Gerçek zamanlı ses paketlerini taşır. Her eşzamanlı çağrı RTP + RTCP için ortalama 2–4 port kullanır; 10.000 portluk aralık 2.500+ eşzamanlı medya bacağını rahatlıkla taşır."
      },
      {
        field: "Asterisk AMI (127.0.0.1:5038)",
        type: "Kontrol & Olay Soketi",
        defaultVal: "TCP 5038 (Localhost)",
        required: true,
        description: "`backend/services/ami_manager.py` üzerinden tüm kanal olaylarını gerçek zamanlı dinler; transfer (`Redirect`), canlı dinleme/fısıldama (`ChanSpy`), park, konferans ve dış arama (`Originate`) komutlarını yürütür."
      }
    ],
    sections: [
      {
        heading: "1. Gelen Çağrının Uçtan Uca Yaşam Döngüsü",
        body: "Dış operatörden gelen bir `SIP INVITE` paketi Nornia'ya ulaştığında, Asterisk ile FastAPI backend senkronize çalışarak milisaniyeler içinde yönlendirme kararını verir.",
        steps: [
          "1. Sinyalleşme & DID Tespiti: SIP Trunk üzerinden gelen çağrı `from-trunk` bağlamına düşer. Dialplan `PJSIP_HEADER(read,To)` ve `CHANNEL(name)` üzerinden gerçek aranan numarayı (`REAL_DID`) çıkarır; böylece `s` gibi sahte DID değerleri engellenir.",
          "2. Backend Kayıt & Kural Değerlendirmesi: Asterisk `CURL(http://127.0.0.1:8000/api/calls/register)` isteğiyle çağrıyı PostgreSQL `calls` tablosuna açar; kara liste, mesai/tatil takvimi ve Görsel Arama Akışı (CallFlow) kurallarını değerlendirir.",
          "3. Hedef Yönlendirme: CallFlow sonucuna göre çağrı ya bir ACD kuyruğuna (`Queue()`), ya bir AI Sesli Asistana (`AudioSocket()`), ya bir IVR anons menüsüne ya da doğrudan bir dahiliye (`webrtc_agents`) yönlenir.",
          "4. 3 Kademeli Abone Yönlendirme Çözümleyici: Dahiliye düşen çağrıda dialplan `/api/subscriber/resolve_forwarding` ucunu sorgular. Kullanıcının Her Zaman, Meşgulde veya Zaman Aşımında (dinamik 15–60 sn) yönlendirme kuralı aktifse veya dahili çevrimdışıysa çağrı otomatik olarak GSM/yedek hedefe (`Operator_Trunk`) aktarılır.",
          "5. Ses Kaydı & Kapanış (CDR + Analitik): Görüşme `MixMonitor` ile `/var/spool/asterisk/monitor/` altına kaydedilir. Çağrı kapandığında `h` uzantısı `/api/calls/end` ucunu tetikler; CDR süresi işlenir, cevapsız çağrıysa WhatsApp otomatik dönüşü gönderilir ve AI transkript/QA/duygu analizi kuyruğa alınır."
        ]
      },
      {
        heading: "2. WebRTC (SIP.js) Kayıt, Presence ve Ses Mühendisliği",
        body: "Tarayıcı tabanlı Web Telefonların kurumsal NAT ve güvenlik duvarı ortamlarında kesintisiz çalışması için Nornia'da özel PJSIP ve SIP.js kuralları uygulanır.",
        steps: [
          "PJSIP WebRTC uç noktalarında `rewrite_contact=no` ayarlıdır; böylece Asterisk `200 OK` yanıtındaki Contact başlığını bozmaz ve SIP.js'in oturumu düşürmesi engellenir.",
          "İstemci açılışta `/api/webrtc/config` ucundan geçerli IPv4 `viaHost` ve WSS URL'ini alır; `ua.transport.onMessage` katmanı `200 OK` REGISTER paketini yakalayarak anlık çevrimiçi durumu garanti eder.",
          "AMI `ContactStatus` olayları ve `/api/webrtc/register_notify` çağrıları `ami_manager.py` içindeki `registered_endpoints` sözlüğünü günceller; kullanıcıların bağlı olduğu istemci IP'si ve canlı durumu tüm temsilcilere WebSocket üzerinden anında yayınlanır.",
          "Çıkış (`handleLogout`) anında `/api/webrtc/unregister_notify` tetiklenir ve dahili anında çevrimdışıya çekilir."
        ]
      },
      {
        heading: "3. Yapılandırma Senkronizasyon Zinciri (UI → Asterisk)",
        body: "Arayüzde bir kullanıcı, SIP Trunk, kuyruk, konferans veya kural değiştirildiğinde değişiklikler kesintisiz olarak Asterisk'e aktarılır.",
        codeBlock: {
          title: "Konfigürasyon Akışı ve Manuel Senkronizasyon",
          lang: "bash",
          code: `# Akış: Web UI (POST /api/...) -> PostgreSQL + settings.json -> sync_asterisk.py -> /etc/asterisk/*_custom.conf -> Asterisk Reload

# Gerekirse SSH üzerinden manuel Asterisk senkronizasyonu:
cd /opt/ai-project
/opt/ai-project/venv/bin/python backend/scripts/sync_asterisk.py

# Canlı kanal, kayıtlı dahili ve kuyruk durumunu izleme:
asterisk -rx "core show channels concise"
asterisk -rx "pjsip show contacts"
asterisk -rx "queue show"`
        }
      }
    ],
    tips: [
      "Tek yönlü ses (one-way audio) veya SIP kayıt hatalarında sunucuda SSH'a girmeden doğrudan Nornia içindeki **Sorun İnceleme (SIP Debugger)** ekranından canlı sngrep diyagramını inceleyip `.pcap` dosyası indirebilirsiniz."
    ],
    troubleshooting: [
      {
        symptom: "Giden çağrıda operatör 'Everyone is busy/congested' hatası veriyor",
        cause: "SIP operatörler genellikle kayıtlı 0850/0212 CallerID numarası dışındaki başlıkları reddeder.",
        resolution: "Dış Hat (SIP Trunk) ayarında operatörün beklediği `CALLERID(num)` formatının (ör. `90850...`) ve giden arama kuralındaki numara öneki dönüşümünün doğru olduğunu doğrulayın."
      },
      {
        symptom: "Çağrı kuruluyor ancak karşı tarafın sesi gelmiyor (tek yönlü ses)",
        cause: "NAT ayarında sunucunun güncel dış IP'si eksik olabilir veya 10000–20000/UDP RTP portları güvenlik duvarında engelleniyordur.",
        resolution: "**Santral & Ağ → NAT Ayarları** ekranında dış IP'yi doğrulayın ya da port açmadan **Nornia Connect + WebRTC TURN** ses rölesini etkinleştirin."
      }
    ],
    relatedChapters: [
      "sistem-mimarisi-ve-servis-haritasi",
      "yapay-zeka-audiosocket-ve-canli-ceviri-mimarisi",
      "sorun-inceleme-sip-debugger"
    ]
  },

  {
    id: "yapay-zeka-audiosocket-ve-canli-ceviri-mimarisi",
    number: "101",
    groupId: "teknik-mimari",
    category: "Teknik Mimari & Sistem Dokümantasyonu",
    title: "Yapay Zeka Motoru: AudioSocket, RAG & Canlı Çağrı Çevirisi",
    shortTitle: "AI, AudioSocket & Canlı Çeviri",
    menuPath: "Teknik Dokümantasyon → AI Ses Motoru, RAG & Simultane Çeviri",
    pbxRoute: "/opt/ai-project/backend/audiosocket_server.py",
    permissions: ["Sistem Yöneticisi / AI & Ses Mühendisi"],
    badge: "AudioSocket • RAG • Live Translate",
    readMinutes: 14,
    summary:
      "Nornia'nın telefon hattı üzerinden milisaniye gecikmeyle konuşan AI Sesli Asistan motorunu (AudioSocket TCP :9092), RAG vektör bilgi bankasını (pgvector), asenkron araç yürütücüsünü ve Temsilci Çağrı Paneli'ndeki 6 dilli AI Real-Time Çağrı Çevirisi (Simultane Tercüman) mimarisini teknik ayrıntılarıyla açıklar.",
    prerequisites: [
      "Asterisk içinde `app_audiosocket.so` modülü yüklü ve aktif olmalıdır (`asterisk -rx 'module show like audiosocket'`).",
      "Bulut AI sağlayıcısı (Gemini API / OpenAI API) veya kurum içi yerel GPU sunucusu (Ollama + Whisper + TTS) **Yapay Zeka Sağlayıcıları** ekranından tanımlanmış olmalıdır."
    ],
    screenshots: [
      {
        src: "/screenshots/08-ai-agents.jpg",
        caption: "Yapay Zeka Temsilcileri — Görsel senaryo derleyicisi, ses modeli ve araç entegrasyonu",
        routeHint: "Yapay Zeka & Bilgi → AI Temsilcileri"
      }
    ],
    fieldTable: [
      {
        field: "AudioSocket TCP Sunucusu (:9092)",
        type: "Ham PCM Ses Akışı",
        defaultVal: "0.0.0.0:9092",
        required: true,
        description: "Asterisk'ten 3-baytlık çerçeve başlığı (`type + length`) ve 20 ms'lik 8 kHz 16-bit Signed Linear PCM ses paketleri alır. İlk çerçevedeki 16-baytlık UUID ile çağrı ve AI temsilci profilini eşleştirir."
      },
      {
        field: "Barge-in Yankı Bastırma Eşiği",
        type: "DSP Gürültü Filtresi",
        defaultVal: "avg_amplitude < 150",
        required: true,
        description: "AI konuşurken (`model_is_speaking = True`) arka plan yankısının yapay zekanın sesini yarıda kesmemesi için düşük genlikli ortam gürültüsünü filtreler; gerçek insan söz kesmesini anında algılar."
      },
      {
        field: "Asenkron Araç Motoru (Async Tool Engine)",
        type: "Metin Etiketi Tetikleyici",
        defaultVal: "[ACTION: ...]",
        required: true,
        description: "Canlı ses akışı sırasında ikili (binary) tool-call çöküşlerini (WebSocket 1007) önlemek için `[ACTION: TRANSFER:1000]`, `[ACTION: HANGUP]` ve `[ACTION: TOOL_CALL ...]` etiketlerini paralel işler ve sonucu `[SYSTEM TOOL RESULT]` olarak akışa geri besler."
      },
      {
        field: "RAG Vektör Deposu (pgvector)",
        type: "768-Boyutlu Vektör",
        defaultVal: "document_chunks tablosu",
        required: false,
        description: "Yüklenen PDF, DOCX, TXT ve web sitesi sayfalarını parçalara böler, vektörleştirir ve çağrı/sohbet başlangıcında ilgili kurumsal bilgiyi AI sistem istemine enjekte eder."
      },
      {
        field: "LiveTranslatorPanel (6 Dil Simultane)",
        type: "WebAudio Çift Akış + Ducking",
        defaultVal: "EN, DE, RU, AR, FR, ES ↔ TR",
        required: false,
        description: "`webphoneManager.js` üzerinden hem hattaki müşteri sesini (`getActiveRemoteStream`) hem temsilci mikrofonunu (`getActiveLocalStream`) ayrı yakalar; 16 kHz PCM'e dönüştürür, çevirir ve hedef dilde dublajı doğrudan hatta basar."
      }
    ],
    sections: [
      {
        heading: "1. AI Sesli Asistan (AudioSocket) Çalışma Mantığı",
        body: "Bir çağrı AI Temsilcisine yönlendirildiğinde ses akışı geleneksel yavaş `kayıt → bekle → yanıtla` döngüsü yerine tam çift yönlü (full-duplex) akış mimarisiyle işlenir.",
        steps: [
          "1. UUID & Lisans Kontrolü: Asterisk dialplanı MD5 tabanlı RFC 4122 UUID üretir ve `AudioSocket(<uuid>,127.0.0.1:9092)` ile TCP bağlantısı açar. `audiosocket_server.py` önce kiracının donanım imzalı lisans geçerliliğini doğrular.",
          "2. Bağlam & Senaryo Derleme: `prompt_manager.py`, temsilcinin görsel senaryo akışını (`compile_agent_scenario_to_instruction`), RAG bilgi bankası bağlamını ve aktif personel dahili rehberini (`system_users`) tek bir sistem talimatında birleştirir.",
          "3. Çift Yönlü Ses Akışı: Asterisk'ten gelen 8 kHz PCM ses 16 kHz'e yükseltilerek AI WebSocket'ine akar; AI'dan dönen 24 kHz ses 8 kHz PCM'e düşürülüp 20 ms'lik paketlerle Asterisk hattına geri yazılır.",
          "4. Canlı Aksiyon & İsimle Transfer: AI konuşma sırasında randevu oluşturma, CRM webhook sorgusu veya `[ACTION: TRANSFER:1005]` etiketini ürettiğinde arka planda PostgreSQL/REST çağrısı veya Asterisk AMI `redirect_call_to_human()` komutu kesintisiz yürütülür."
        ]
      },
      {
        heading: "2. AI Real-Time Çağrı Çevirisi (Simultane Tercüman) Nasıl Çalışır?",
        body: "Temsilci Çağrı Paneli'ndeki `Canlı Konuşma & Çeviri` modülü, iki tarafın sesini tarayıcı düzeyinde WebAudio API ile birbirinden ayırarak gerçek zamanlı tercüme gerçekleştirir.",
        steps: [
          "1. Çift Akış Yakalama: `webphoneManager.js`, aktif WebRTC çağrısında uzak tarafın sesini (`getActiveRemoteStream`) ve temsilcinin kendi mikrofonunu (`getActiveLocalStream`) bağımsız kanallarda yakalar.",
          "2. Konuşma Algılama (VAD) & Gönderim: `LiveTranslatorPanel.js` ses parçalarını 16 kHz Int16 WAV/PCM'e çevirerek backend çeviri uç noktasına gönderir; konuşma anlık olarak hem kaynak dilde hem Türkçe altyazı olarak ekrana düşer.",
          "3. Simultaneous Audio Ducking: `Oto. Sesli Çeviri` açıkken müşteri yabancı dilde konuştuğunda `setRemoteAudioDucking()` müşterinin orijinal sesini yumuşakça kısar ve Türkçe sesli çeviriyi temsilcinin kulaklığına verir.",
          "4. Hatta Dublaj & Yazarak Seslendir: Temsilci Türkçe konuştuğunda (veya metin kutusuna yazıp Enter'a bastığında) çevrilen ses `playAudioIntoActiveCallLine()` ile doğrudan aktif WebRTC RTP göndericisine enjekte edilir. 3 çıkış modu (`Sadece Müşteri`, `Müşteri + Ben`, `Sadece Ben`) desteklenir."
        ]
      },
      {
        heading: "3. Görev Bazlı AI Yönlendirici (Bulut + Yerel LLM Hibrit)",
        body: "Nornia'da tüm yapay zeka görevleri tek bir sağlayıcıya bağımlı değildir. **Yapay Zeka Görev Yönlendirme** üzerinden her görev ayrı bir sağlayıcıya atanabilir: örneğin canlı sesli görüşmede Gemini Live, çağrı sonrası transkript/QA özetlemede kurum içi GPU sunucusundaki yerel **Ollama + Whisper**, vektör gömmede yerel embedding modeli kullanılabilir.",
        codeBlock: {
          title: "AudioSocket ve AI Servisi Doğrulama Komutları",
          lang: "bash",
          code: `# Asterisk AudioSocket modülünü kontrol et
asterisk -rx "module show like audiosocket"

# Port 9092 AudioSocket TCP dinlemesini doğrula
ss -tlnp | grep :9092

# Canlı AI çağrı ve araç yürütme loglarını izle
PM2_HOME=/root/.pm2 pm2 logs aida-backend --lines 50 | grep -E "AudioSocket|TOOL_CALL|TRANSFER"`
        }
      }
    ],
    tips: [
      "KVKK gereği ses ve metin verisini kurum dışına çıkarmak istemeyen hastaneler, bankalar ve kamu kurumları tüm STT, LLM ve TTS akışını kendi sunucularındaki yerel Ollama + Whisper düğümüne yönlendirebilir."
    ],
    relatedChapters: [
      "ai-temsilcileri",
      "bilgi-bankasi-rag",
      "cagri-ve-ses-akisi-mimarisi"
    ]
  },

  {
    id: "nornia-connect-tunel-ve-merkez-hub-mimarisi",
    number: "102",
    groupId: "teknik-mimari",
    category: "Teknik Mimari & Sistem Dokümantasyonu",
    title: "Nornia Connect Sıfır-Port Tünel, WireGuard & Merkez Hub Mimarisi",
    shortTitle: "Tünel & Merkez Hub Mimarisi",
    menuPath: "Teknik Dokümantasyon → Nornia Connect & Lisans Merkezi",
    pbxRoute: "/opt/ai-project/license_center/",
    permissions: ["Sistem Yöneticisi / Ağ & Güvenlik Mühendisi"],
    badge: "Zero-Port • WireGuard • SSL",
    readMinutes: 12,
    summary:
      "Kurum içi santrallerin güvenlik duvarında tek bir gelen port açmadan `https://<firma>.nornia.com.tr` üzerinden dünyaya nasıl açıldığını, WireGuard SIP Edge tünelini, TURN ses rölesini ve Merkez Lisans/Connect Hub'ın çalışma mantığını açıklar.",
    architectureDiagram: "tunnel",
    prerequisites: [
      "Kurum içi santralin yalnızca dışa doğru (outbound) HTTPS (443) ve opsiyonel WireGuard UDP erişimi olması yeterlidir; statik IP veya gelen port yönlendirmesi gerekmez.",
      "Merkez sunucu (`panel.nornia.com.tr`) üzerinde `nornia-connect-hub` (FastAPI, port `8050`), `nornia-license-ui` (Next.js, port `3050`) ve Nginx (80/443) çalışır."
    ],
    screenshots: [
      {
        src: "/screenshots/tabs/settings/03-nornia-connect.jpg",
        caption: "Nornia Connect — Tünel durumu, alt alan adı kilidi, WireGuard SIP Edge ve WebRTC TURN ayarları",
        routeHint: "Santral & Ağ → Nornia Connect (Bulut Köprüsü)"
      }
    ],
    fieldTable: [
      {
        field: "HTTPS / WSS Ters Tünel Köprüsü",
        type: "Outbound WebSocket Tüneli",
        defaultVal: "wss://connect.nornia.com.tr",
        required: true,
        description: "Kurum içi santral (`ras_client_service.py`) dışa doğru şifreli tünel açar. Merkez Hub (`connect_hub.py`), `<firma>.nornia.com.tr` adresine gelen tüm Web, REST API ve `/asterisk/ws` WebRTC sinyallerini bu tünelden santrale aktarır."
      },
      {
        field: "Otomatik Let's Encrypt SSL & SAN",
        type: "TLS 1.2 / 1.3 Sertifika",
        defaultVal: "Otomatik Yenileme",
        required: true,
        description: "Yeni bir alt alan adı tescil edildiğinde `ensure_subdomain_ssl_and_nginx()` Nginx yönlendirmesini ve Let's Encrypt sertifikasını otomatik güncelleyerek tarayıcı WebRTC mikrofon izinlerini sorunsuz kılar."
      },
      {
        field: "WireGuard SIP Edge (10.200.0.x)",
        type: "L3 Şifreli VPN Tüneli",
        defaultVal: "SIP 5060/5061 Edge",
        required: false,
        description: "Evden veya uzak şubeden bağlanan Yealink/Cisco/Fanvil masa telefonlarının `firma.nornia.com.tr:5060` (UDP/TCP) veya `5061` (TLS) üzerinden şifreli WireGuard köprüsüyle doğrudan iç santrale kayıt olmasını sağlar."
      },
      {
        field: "WebRTC Ses Rölesi (TURN / RTP Relay)",
        type: "ICE/TURN Medya Köprüsü",
        defaultVal: "Aktif",
        required: false,
        description: "Sıkı kurumsal güvenlik duvarları veya çift CGNAT arkasındaki mobil/tarayıcı kullanıcılarında UDP doğrudan erişemediğinde ses paketlerini şifreli röle üzerinden aktararak tek yönlü sesi tamamen önler."
      },
      {
        field: "Multi-Tenant Telemetri & Web-SSH",
        type: "Heartbeat + İzinli Terminal",
        defaultVal: "POST /api/v1/telemetry/heartbeat",
        required: true,
        description: "`telemetry_worker.py` sunucudaki tüm kiracıların durumunu merkeze bildirir; uzaktan lisans yenileme veya iptal komutlarını uygular. Web-SSH yalnızca yönetici izni açıkken çalışır."
      }
    ],
    sections: [
      {
        heading: "1. Dış İstek Kurum İçi Santrale Nasıl Ulaşır?",
        body: "Dışarıdaki bir kullanıcı `https://sirketiniz.nornia.com.tr` adresini açtığında trafik hiçbir gelen firewall kuralına ihtiyaç duymadan 4 adımda santrale ulaşır.",
        steps: [
          "1. DNS & TLS Sonlandırma: İstek Merkez Hub'daki Nginx (:443) sunucusuna gelir ve geçerli SSL sertifikasıyla sonlandırılır.",
          "2. Alt Alan Adı Eşleştirme: Nginx isteği `127.0.0.1:8050` (`connect_hub.py`) uygulamasına iletir. Hub, `Host` başlığındaki `sirketiniz` alt alan adını donanım kimliğine (`HW-ID`) kilitli aktif tünel oturumuyla eşleştirir.",
          "3. Tünel Üzerinden İletim: HTTP/WebSocket isteği şifreli outbound tünel içinden kurum içi santraldeki `ras_client_service.py` istemcisine aktarılır.",
          "4. Yerel Yönlendirme & Yanıt: İstemci isteği yerel `127.0.0.1:3000` (UI), `127.0.0.1:8000` (API) veya `127.0.0.1:8089` (Asterisk WSS) servisine iletir ve yanıtı aynı şifreli kanaldan kullanıcıya geri döndürür."
        ]
      },
      {
        heading: "2. Merkez Sunucudaki Statik Portallar (0 MB Ek RAM Mimarisi)",
        body: "`panel.nornia.com.tr` sunucusu yalnızca Connect Hub ve Lisans Panelini değil, aynı zamanda kurumsal web sitesini (`www.nornia.com.tr`), kullanım kılavuzunu (`dokuman.nornia.com.tr`) ve API portalını (`api.nornia.com.tr`) doğrudan Nginx statik dosyaları olarak (`/var/www/nornia-*`) sıfır ek RAM tüketimiyle sunar.",
        codeBlock: {
          title: "Santral Üzerinde Tünel ve WireGuard Tanı Komutları",
          lang: "bash",
          code: `# 1. Nornia Connect tünel canlı durumunu ve gecikmesini sorgula
curl -s http://127.0.0.1:8000/api/settings/ras/status | python3 -m json.tool

# 2. WireGuard SIP Edge arayüz ve el sıkışma (handshake) kontrolü
wg show wg-nornia 2>/dev/null || echo "WireGuard SIP Edge kapalı"

# 3. Merkez Hub'a dış bağlantı (outbound 443) testi
curl -I --connect-timeout 5 https://connect.nornia.com.tr`
        }
      }
    ],
    tips: [
      "Her santralin alt alan adı Merkez Lisans Sunucusunda donanım kimliğine (`HW-ID`) kilitlenir; başka bir sunucunun aynı alt alan adını ele geçirmesi veya çakışması mimari olarak engellenir."
    ],
    relatedChapters: [
      "sunucu-ag-ve-nornia-connect",
      "sistem-mimarisi-ve-servis-haritasi",
      "veritabani-coklu-kiraci-ve-guvenlik-mimarisi"
    ]
  },

  {
    id: "veritabani-coklu-kiraci-ve-guvenlik-mimarisi",
    number: "103",
    groupId: "teknik-mimari",
    category: "Teknik Mimari & Sistem Dokümantasyonu",
    title: "Veritabanı (PostgreSQL 16), Multi-Tenant, Omnichannel & Güvenlik",
    shortTitle: "Veritabanı, Multi-Tenant & Güvenlik",
    menuPath: "Teknik Dokümantasyon → Veri Katmanı, Omnichannel & Güvenlik",
    pbxRoute: "PostgreSQL 127.0.0.1:5444 (ai_pbx)",
    permissions: ["Sistem Yöneticisi / Veritabanı & Güvenlik Mühendisi"],
    badge: "PostgreSQL • Multi-Tenant • Güvenlik",
    readMinutes: 13,
    summary:
      "PostgreSQL 16 (port 5444) veri şemasını, sıkı çoklu kiracı (Multi-Tenant) izolasyon mekanizmasını, Omnichannel (WhatsApp/Instagram/Telegram/E-posta) mesajlaşma işçilerini ve Nornia'nın donanım kilitli lisanslama + çok katmanlı güvenlik mimarisini açıklar.",
    prerequisites: [
      "PostgreSQL 16 `127.0.0.1:5444` portunda `ai_pbx` veritabanı ve `pgvector` eklentisiyle çalışır.",
      "Bağlantı dizesi `/opt/ai-project/backend/.env` içinde (`chmod 600`) saklanır."
    ],
    screenshots: [
      {
        src: "/screenshots/47-security.jpg",
        caption: "Nornia Güvenlik Kalkanı — SIP IPS, GeoIP, Anti-DDoS ve engellenen IP yönetimi",
        routeHint: "Yönetim & Ayarlar → Güvenlik Kalkanı"
      }
    ],
    fieldTable: [
      {
        field: "PostgreSQL 16 (`ai_pbx`)",
        type: "İlişkisel + Vektör DB",
        defaultVal: "127.0.0.1:5444",
        required: true,
        description: "Başlangıçta otomatik DDL göçleri (migration) yürütülür. `system_users`, `pbx_queues`, `trunks`, `calls`, `transcripts`, `appointments`, `chat_sessions`, `chat_messages`, `contacts`, `agent_break_logs`, `document_chunks`, `system_roles`, `event_logs` dahil 15+ temel tabloyu barındırır."
      },
      {
        field: "Multi-Tenant İzolasyon (`tenant_id`)",
        type: "Kiracı Ayrımı",
        defaultVal: "X-Tenant-ID başlığı",
        required: true,
        description: "Her HTTP isteğinde `X-Tenant-ID` / `tenant_id` çözümlenir. Tüm 15 çekirdek tabloda `tenant_id` sütunu zorunludur; yeni kiracılar (örn. `tenant-sube2`) Ana Müşteri verilerini göremez."
      },
      {
        field: "Omnichannel Mesaj Boru Hattı",
        type: "Webhook + IMAP Poller",
        defaultVal: "WhatsApp / Meta / Telegram / Email",
        required: false,
        description: "WhatsApp Cloud API (`phone_number_id` ile çoklu 0850 hat eşleştirme), Instagram/Facebook Direct, Telegram Bot webhook'ları ve 30 sn'lik IMAP e-posta okuyucusu tek `handle_inbound_chat_message()` motorunda birleşir."
      },
      {
        field: "Kriptografik Donanım Lisansı",
        type: "HMAC-SHA256 + HW-ID",
        defaultVal: "AIDA-{KOD}-{TARİH}-{HW8}-{SIG8}",
        required: true,
        description: "Anakart/DMI UUID, `/etc/machine-id`, disk UUID ve birincil NIC MAC adresinden `HW-XXXX-XXXX` parmak izi üretilir. Sanal makine başka sunucuya klonlanırsa imza uyuşmazlığı anında tespit edilir."
      },
      {
        field: "Çift SSH Hesap Ayrımı (`nornia` vs `destek`)",
        type: "İşletim Sistemi Güvenliği",
        defaultVal: "ForceCommand + Sudoers",
        required: true,
        description: "`nornia` hesabı tam yetkili sistem yöneticisidir. `destek` hesabı ise SSH `ForceCommand` ile kısıtlı ağ/tanı menüsüne (`/usr/local/bin/nornia-destek-shell`) hapsedilmiştir; `/opt/ai-project/backend` sırlarını okuyamaz ve ham bash açamaz."
      }
    ],
    sections: [
      {
        heading: "1. Veritabanı ve `settings.json` Çift Katmanlı Kalıcılık",
        body: "Nornia, yüksek okuma hızı gerektiren santral yapılandırmaları (yönlendirme, NAT, AI istemleri, kanal hesapları) için bellek + `settings.json` önbelleğini PostgreSQL `system_settings` tablosuyla senkronize kullanır; tüm yüksek hacimli işlemsel veriler (CDR, ses kayıt meta verisi, sohbetler, mola kayıtları, randevular, RAG vektörleri) doğrudan PostgreSQL 16 tablolarında tutulur.",
        codeBlock: {
          title: "PostgreSQL Sağlık, Boyut ve Tablo Satır Kontrolü",
          lang: "bash",
          code: `# 1. Veritabanı boyutu ve aktif bağlantı sayısı
sudo -u postgres psql -p 5444 -d ai_pbx -c "
  SELECT pg_size_pretty(pg_database_size('ai_pbx')) AS db_size,
         count(*) AS active_connections
  FROM pg_stat_activity WHERE datname = 'ai_pbx';
"

# 2. En büyük tabloları ve satır sayılarını listele
sudo -u postgres psql -p 5444 -d ai_pbx -c "
  SELECT relname AS tablo, n_live_tup AS satir_sayisi
  FROM pg_stat_user_tables
  ORDER BY n_live_tup DESC LIMIT 15;
"

# 3. Anlık manuel SQL yedek alma (sıkıştırılmış)
sudo -u postgres pg_dump -p 5444 -Fc ai_pbx > /opt/ai-project/backups/ai_pbx_$(date +%Y%m%d_%H%M).dump`
        }
      },
      {
        heading: "2. Omnichannel Mesajlaşma Akışı (4 Kanal Tek Motor)",
        body: "WhatsApp, Instagram/Facebook, Telegram ve E-posta kanallarından gelen tüm mesajlar `backend/services/chat_service.py` içindeki ortak boru hattından geçer.",
        steps: [
          "1. Kanal Alımı: Meta Cloud API (`POST /api/webhooks/whatsapp`), Instagram/Facebook (`POST /api/webhooks/meta`), Telegram (`POST /api/webhooks/telegram`) webhook'ları veya 30 saniyede bir çalışan `poll_imap_inbox()` işçisi mesajı yakalar.",
          "2. Hat & Rehber Eşleştirme: WhatsApp'ta `metadata.phone_number_id` ile hangi kurumsal 0850 hattına yazıldığı bulunur; `resolve_contact_name_by_phone()` son 10 hane eşleştirmesiyle müşteriyi kurumsal rehberden tanır.",
          "3. AI Persona, Mesai Kontrolü & Etkileşimli Menü: Yeni oturumda 3 butonlu karşılama menüsü (`Fiyat ve Bilgi`, `Randevu Al`, `Canlı Temsilci`) gönderilir; Türkiye UTC+3 mesai saatleri ve seçili AI personası (`samimi`, `satis`, `destek`, `kurumsal`) otomatik uygulanır.",
          "4. Canlı Temsilci Devri: Müşteri `Canlı Temsilci` seçtiğinde `ChatSession.assigned_agent` alanı `human` yapılır ve sohbet anında Ortak Gelen Kutusu'ndaki temsilcilerin ekranına düşer."
        ]
      },
      {
        heading: "3. Katmanlı Güvenlik & KVKK Uyumu",
        body: "Nornia hem işletim sistemi hem uygulama hem de VoIP sinyalleşme katmanında çoklu koruma uygular.",
        steps: [
          "Ağ & VoIP Katmanı: UFW yalnızca gerekli portlara izin verir; Fail2Ban + SIP IPS Guard yetkisiz SIP REGISTER/INVITE taramalarını otomatik kara listeye alır; GeoIP ve Anti-DDoS politikaları doğrudan arayüzden yönetilir.",
          "Kimlik & Yetki Katmanı: TOTP 2FA, Active Directory/LDAP entegrasyonu, cihaz anahtarı (Device Key) kısıtı ve 90+ yetki kodlu granüler RBAC (`:read`, `:write`, `:delete`, `:access`) uygulanır.",
          "Veri & Lisans Bütünlüğü: Donanım imzalı HMAC-SHA256 lisanslama klonlamayı önler; kayıt saklama (retention) politikaları eski ses kayıtlarını otomatik temizler veya harici SMB/NAS depolamaya arşivler."
        ]
      }
    ],
    tips: [
      "500+ eşzamanlı web kullanıcısı beklenen yüksek ölçekli kurulumlarda `backend/database/config.py` içindeki SQLAlchemy bağlantı havuzu (`pool_size`, `max_overflow`) ve PostgreSQL `max_connections` değerleri sunucu RAM'ine göre büyütülebilir."
    ],
    relatedChapters: [
      "sistem-mimarisi-ve-servis-haritasi",
      "guvenlik-kalkani",
      "bakim-yedekleme-ve-kayit-saklama"
    ]
  },
  {
    id: "desktop-ve-mobil-sdk-rehberi",
    number: "108",
    groupId: "teknik-mimari",
    category: "Teknik Mimari & Sistem Dokümantasyonu",
    title: "Web, Desktop (Electron / .NET) & Mobil (Flutter / React Native) Softphone SDK Rehberi",
    shortTitle: "Desktop & Mobil SDK Rehberi",
    menuPath: "Teknik Dokümantasyon → Desktop & Mobil Softphone SDK",
    pbxRoute: "/api/v1/sdk/session",
    permissions: ["Yazılım Geliştirici • External API Anahtarı (sdk:webrtc veya calls:write)"],
    badge: "Geliştirici SDK • v1.0",
    readMinutes: 15,
    summary:
      "Nornia santralinin arama, cevaplama, aktarma, bekletme ve gelen çağrı yakalama (CRM Screen Pop) yeteneklerini kendi Web CRM, Electron Desktop, C#/.NET veya Flutter / React Native mobil uygulamanızın içine 5 dakikada kopyala-yapıştırla gömmek için sıfırdan adım adım geliştirici kılavuzu.",
    prerequisites: [
      "Nornia yönetim panelinden `Yönetim → API Yönetimi` menüsüne girip yeni bir API Anahtarı (`aida_live_...`) oluşturun ve **`sdk:webrtc`** (veya `calls:write`) yetkisini işaretleyin.",
      "Bağlanacağınız dahili numaranın (ör. `1001`) `Santral → Kullanıcılar` altında aktif olduğunu doğrulayın.",
      "WebRTC mikrofon erişimi için sayfanızın **`https://`** (veya geliştirme ortamında `http://localhost`) üzerinden açılması ve santralin **8089/TCP (WSS)** portunun açık olması gerekir.",
      "Bu SDK'yı kullanmak için hiçbir SIP/VoIP protokolü bilmenize gerek yoktur; Nornia tüm SIP, WSS, STUN/TURN ve NAT ayarlarını tek bir API çağrısıyla otomatik verir."
    ],
    fieldTable: [
      {
        field: "/api/v1/sdk/nornia-voice-sdk.js",
        type: "Web & Desktop (Electron) • Headless JS SDK",
        defaultVal: "GET (Public)",
        required: true,
        description:
          "Kendi butonlarınızı ve tasarımınızı yaparken arkada tüm WebRTC ses/arama işini yöneten sıfır-kurulumlu JavaScript SDK. Tarayıcı `<script>`, React, Vue, Angular ve Electron ile doğrudan çalışır."
      },
      {
        field: "/api/v1/sdk/nornia-softphone-widget.js",
        type: "Web CRM & Electron • Hazır Mini Telefon Widget",
        defaultVal: "GET (Public)",
        required: false,
        description:
          "Hiç arayüz tasarlamadan 3 satır kodla CRM ekranınızın sağ alt köşesine açılır-kapanır hazır WebRTC telefon (tuş takımı, zil, cevapla, sessize al, transfer, süre sayacı) yerleştirir. Shadow DOM kullandığı için sitenizin CSS'ini bozmaz."
      },
      {
        field: "/api/v1/sdk/nornia-mobile-sdk.dart",
        type: "Mobil (Flutter — iOS & Android)",
        defaultVal: "GET (Public)",
        required: false,
        description:
          "Flutter mobil projenizin `lib/` klasörüne doğrudan kopyalayabileceğiniz tek dosyalık hazır SDK sınıfı (`NorniaMobileSDK`)."
      },
      {
        field: "/api/v1/sdk/nornia-mobile-sdk.js",
        type: "Mobil (React Native — iOS & Android)",
        defaultVal: "GET (Public)",
        required: false,
        description:
          "React Native projenize doğrudan kopyalayabileceğiniz hazır ES Module SDK sınıfı (`NorniaReactNativeSDK`)."
      },
      {
        field: "POST /api/v1/sdk/session",
        type: "REST API • X-API-Key Korumalı",
        defaultVal: "Yetki: sdk:webrtc",
        required: true,
        description:
          "Tek istekte bir dahili için `sip_uri`, `sip_username`, `sip_password`, `wss_url`, `via_host` ve `ice_servers` (STUN/TURN) bilgilerini döner. Tüm SDK dosyaları bu ucu otomatik çağırır."
      }
    ],
    sections: [
      {
        heading: "1. Sistem Nasıl Çalışır? (Tek Bakışta Mimari Şema)",
        body:
          "Geliştirici olarak hiçbir SIP sunucusu, port veya şifre ayarı ezberlemeniz gerekmez. Uygulamanız sadece 2 adımda Nornia santraline bağlanır: (1) REST API ile oturum bilgisini alır, (2) WebRTC WSS üzerinden ses hattını açar.",
        archDiagram: {
          eyebrow: "NORNIA VOICE SDK • GELİŞTİRİCİ MİMARİSİ",
          title: "Kendi Uygulamanızdan Nornia Santraline 2 Adımda Bağlantı",
          badges: ["Zero-Build JS", "Shadow DOM Widget", "Electron Desktop", "Flutter & React Native"],
          tiers: [
            {
              label: "Katman 1 — Sizin Uygulamanız (Müşteri Yazılımı)",
              tone: "sky",
              meta: "5 Satır Kod ile Entegrasyon",
              nodes: [
                { name: "Web CRM / ERP", badge: "Widget veya JS SDK", desc: "Sağ altta hazır telefon veya kendi butonlarınızla arama + Screen Pop" },
                { name: "Desktop (Electron / .NET)", badge: "WebRTC veya CTI", desc: "Masaüstü uygulamasından dahili sesli görüşme veya Click-to-Call" },
                { name: "Mobil (Flutter / RN)", badge: "iOS & Android", desc: "Kurum içi saha uygulaması veya uygulama içi ücretsiz destek araması" }
              ],
              arrowToNext: "Adım 1: POST /api/v1/sdk/session (X-API-Key + extension: '1001')"
            },
            {
              label: "Katman 2 — Nornia API & Oturum Dağıtıcı",
              tone: "indigo",
              meta: "Tenant İzolasyonu • Otomatik IPv4 viaHost & STUN/TURN",
              nodes: [
                { name: "Nornia REST API (:443)", badge: "X-API-Key", desc: "Dahiliyi doğrular; wss_url, sip_uri, sip_password ve ICE sunucularını tek JSON'da döner" },
                { name: "SDK Dosya Sunucusu", badge: "/api/v1/sdk/*", desc: "nornia-voice-sdk.js, widget.js, mobile-sdk.dart/js dosyalarını doğrudan sunar" }
              ],
              arrowToNext: "Adım 2: WebRTC WSS (:8089/ws) + DTLS-SRTP Şifreli Ses"
            },
            {
              label: "Katman 3 — Nornia Ses & Çağrı Çekirdeği",
              tone: "emerald",
              meta: "Tüm Çağrı Kayıtları, AI Asistan ve Raporlar Otomatik Çalışır",
              nodes: [
                { name: "Asterisk / Kamailio WSS", badge: "WSS :8089", desc: "Dış hat (0850), dahili, kuyruk ve AI sesli asistan çağrılarını bağlar" },
                { name: "Kayıt, CDR & AI Analiz", badge: "Otomatik", desc: "SDK ile yapılan her görüşme normal dahili gibi kaydedilir ve raporlanır" }
              ]
            }
          ]
        }
      },
      {
        heading: "2. Adım 0 — API Anahtarı Alma (1 Dakika)",
        body:
          "Kodu çalıştırmadan önce santralinizden bir API anahtarı almanız gerekir. Bu işlem sadece 1 kez yapılır:",
        steps: [
          "Nornia yönetici paneline giriş yapın ve sol menüden `Yönetim → API Yönetimi` ekranını açın.",
          "Sağ üstteki `+` butonuna tıklayıp yeni anahtar oluşturun (Ad: örn. `CRM Softphone SDK`).",
          "Yetki listesinden **`Desktop, Web & Mobil Softphone SDK → sdk:webrtc`** kutucuğunu işaretleyin (Click-to-Call de kullanacaksanız `calls:write` yetkisini ekleyin).",
          "Ekranda bir kez gösterilen `aida_live_...` anahtarını kopyalayıp güvenli bir yere kaydedin. Güvenlik için bu anahtarı üretimde kendi backend'inizde tutmanız veya yalnızca yetkili kurum içi CRM'de kullanmanız önerilir."
        ]
      },
      {
        heading: "3. En Kolay Yol: 3 Satırda Hazır Mini Telefon Widget'ı (Kopyala-Yapıştır Test)",
        body:
          "Hiç arayüz kodu yazmak istemiyorsanız, bilgisayarınızda `test.html` adında boş bir dosya açıp aşağıdaki kodu olduğu gibi yapıştırın. Sadece 3 alanı (`serverUrl`, `apiKey`, `extension`) kendinize göre değiştirip tarayıcıda açın — sağ alt köşede tam çalışan Nornia telefonu anında açılacaktır!",
        codeBlock: {
          title: "test.html — Tek Dosya, Sıfır Kurulum, 3 Satırda Hazır CRM Telefonu",
          code: `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>Nornia SDK Test</title>
</head>
<body>
  <h2>Müşteri CRM Ekranım</h2>
  <p id="arayanBilgi">Henüz gelen çağrı yok...</p>

  <!-- 1. Adım: İki SDK dosyasını doğrudan kendi Nornia sunucunuzdan yükleyin -->
  <script src="https://SANTRAL-ADRESINIZ/api/v1/sdk/nornia-voice-sdk.js"></script>
  <script src="https://SANTRAL-ADRESINIZ/api/v1/sdk/nornia-softphone-widget.js"></script>

  <!-- 2. Adım: Telefonu ekrana bağlayın -->
  <script>
    const widget = NorniaSoftphoneWidget.mount({
      serverUrl: "https://SANTRAL-ADRESINIZ",   // Örn: https://pbx.firma.com
      apiKey: "aida_live_BURAYA_ANAHTARINIZ",   // API Yönetimi'nden aldığınız anahtar
      extension: "1001",                        // Bağlanacak dahili numara
      position: "bottom-right",                 // "bottom-right" veya "bottom-left"
      themeColor: "#4f46e5",                    // Kendi kurumsal renginiz

      // Çağrı geldiğinde kendi CRM müşteri kartınızı açın (Screen Pop):
      onIncomingCall: function (call) {
        document.getElementById("arayanBilgi").innerText =
          "GELEN ÇAĞRI: " + call.callerNumber + " (" + call.callerName + ")";
        // Örnek: window.open("/crm/musteri?tel=" + call.callerNumber);
      },
      onEnded: function () {
        document.getElementById("arayanBilgi").innerText = "Görüşme sonlandı.";
      }
    });
  </script>
</body>
</html>`
        }
      },
      {
        heading: "4. Kendi Tasarımını Yapmak İsteyenler İçin: Headless JavaScript SDK (Web & React / Vue)",
        body:
          "Hazır widget yerine kendi CRM butonlarınızla (Ara, Cevapla, Kapat, Sessize Al, Beklet, Aktar) çalışmak isterseniz doğrudan `NorniaVoiceSDK` sınıfını kullanın.",
        table: {
          headers: ["Metot / Olay", "Ne İşe Yarar?", "Örnek Kullanım"],
          rows: [
            ["await phone.connect()", "Santralden oturum alır ve WebRTC'ye kayıt olur", "await phone.connect()"],
            ["await phone.dial(numara)", "Dış numara veya dahili arar", "await phone.dial('05321234567')"],
            ["await phone.answer()", "Çalan gelen çağrıyı açar", "await phone.answer()"],
            ["await phone.reject()", "Gelen çağrıyı reddeder", "await phone.reject()"],
            ["await phone.hangup()", "Aktif çağrıyı kapatır", "await phone.hangup()"],
            ["phone.mute(true/false)", "Mikrofonu sessize alır / açar", "phone.mute(true)"],
            ["phone.hold(true/false)", "Görüşmeyi beklemeye alır / devam ettirir", "await phone.hold(true)"],
            ["phone.sendDtmf('1')", "Karşı IVR menüsüne tuşlama gönderir", "phone.sendDtmf('2')"],
            ["await phone.transfer('1002')", "Aktif çağrıyı başka dahiliye aktarır", "await phone.transfer('1002')"],
            ["await phone.clickToCall(no)", "WebRTC olmadan masa telefonundan aratır", "await phone.clickToCall('0532...')"],
            ["phone.on('incomingCall', fn)", "Çağrı çaldığında tetiklenir (Screen Pop)", "phone.on('incomingCall', c => ...)"],
            ["phone.on('registered', fn)", "Santrale kayıt tamamlandığında tetiklenir", "phone.on('registered', () => ...)"]
          ]
        },
        codeBlock: {
          title: "Headless NorniaVoiceSDK — Kendi Arayüzünüzde Tam Kontrol",
          code: `<script src="https://pbx.firma.com/api/v1/sdk/nornia-voice-sdk.js"></script>
<script>
  const phone = new NorniaVoiceSDK({
    serverUrl: "https://pbx.firma.com",
    apiKey: "aida_live_...",
    extension: "1001",
    debug: true // Geliştirme sırasında tarayıcı konsolunda detay görmek için
  });

  phone.on("registered", () => console.log("Telefon ÇEVRİMİÇİ!"));
  phone.on("incomingCall", (call) => {
    console.log("Arayan Numara:", call.callerNumber);
    // İsterseniz butonla phone.answer() veya phone.reject() çağırın
  });
  phone.on("connected", () => console.log("Ses hattı bağlandı!"));
  phone.on("ended", () => console.log("Görüşme bitti."));

  // Başlatma (Kullanıcı bir butona tıkladıktan sonra çağırın — tarayıcı mikrofon izni için)
  async function baslat() {
    await phone.connect();
  }
</script>`
        }
      },
      {
        heading: "5. Masaüstü Uygulamaları: Electron Desktop & C# / .NET / Python (Click-to-Call)",
        body:
          "Electron tabanlı masaüstü uygulamalarınızda yukarıdaki `nornia-voice-sdk.js` birebir çalışır; yalnızca `main.js` içinde mikrofon iznine onay vermeniz yeterlidir. C# / .NET (WinForms/WPF), Delphi veya Python masaüstü programlarınızda ise hiç WebRTC yazmadan tek bir HTTP POST isteğiyle kullanıcının masa telefonundan veya Runa uygulamasından **Click-to-Call** başlatabilirsiniz.",
        codeBlock: {
          title: "A) Electron main.js (Mikrofon İzni)  &  B) C# .NET Click-to-Call Örneği",
          code: `// --- A) ELECTRON DESKTOP (main.js) — Mikrofon İznini Otomatik Onayla ---
const { session } = require("electron");
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === "media") return callback(true);
    callback(false);
  });
});

// --- B) C# / .NET (WinForms / WPF / ERP) — Tek İstekle Click-to-Call ---
using var http = new HttpClient();
http.DefaultRequestHeaders.Add("X-API-Key", "aida_live_BURAYA_ANAHTARINIZ");
var body = new StringContent(
    "{\"extension\":\"1001\",\"destination\":\"05321234567\"}",
    System.Text.Encoding.UTF8,
    "application/json"
);
var resp = await http.PostAsync("https://pbx.firma.com/api/v1/calls/originate", body);
Console.WriteLine(await resp.Content.ReadAsStringAsync());`
        }
      },
      {
        heading: "6. Mobil Uygulamalar: Flutter (iOS & Android) ve React Native",
        body:
          "Kendi kurumsal mobil uygulamanıza (saha ekibi veya uygulama içi müşteri desteği) sesli arama eklemek için santralinizden hazır mobil SDK dosyasını indirip projenize koymanız yeterlidir.",
        steps: [
          "Flutter için `https://pbx.firma.com/api/v1/sdk/nornia-mobile-sdk.dart` dosyasını indirip projenizdeki `lib/nornia_mobile_sdk.dart` yoluna kaydedin.",
          "`pubspec.yaml` dosyanıza `http: ^1.2.0` ve `sip_ua: ^1.0.0` paketlerini ekleyip `flutter pub get` çalıştırın.",
          "Android için `AndroidManifest.xml` içine `RECORD_AUDIO`, `INTERNET`, `MODIFY_AUDIO_SETTINGS` izinlerini; iOS için `Info.plist` içine `NSMicrophoneUsageDescription` açıklamasını ekleyin.",
          "React Native kullanıyorsanız `https://pbx.firma.com/api/v1/sdk/nornia-mobile-sdk.js` dosyasını projenize kopyalayıp `npm install sip.js@0.20.1 react-native-webrtc` kurun."
        ],
        codeBlock: {
          title: "Flutter (Dart) & React Native — 10 Satırda Çalışan Mobil Arama Örneği",
          code: `// ===================== FLUTTER (lib/main.dart) =====================
import 'nornia_mobile_sdk.dart';

final nornia = NorniaMobileSDK(
  serverUrl: 'https://pbx.firma.com',
  apiKey: 'aida_live_BURAYA_ANAHTARINIZ',
  extension: '1001',
  onRegistrationChanged: (ok) => print('Santral Bağlı: $ok'),
  onIncomingCall: (call, caller) => print('Gelen Arama: $caller'),
);

// Bağlan ve Ara:
await nornia.connect();
await nornia.dial('05321234567');
// Gelen aramayı açmak için: nornia.answer();  Kapatmak için: nornia.hangup();

// ================== REACT NATIVE (App.js) ==================
import { NorniaReactNativeSDK } from "./nornia-mobile-sdk";

const phone = new NorniaReactNativeSDK({
  serverUrl: "https://pbx.firma.com",
  apiKey: "aida_live_BURAYA_ANAHTARINIZ",
  extension: "1001",
  onRegistered: (ok) => console.log("Bağlı:", ok),
  onIncomingCall: ({ callerNumber }) => console.log("Arayan:", callerNumber),
});

await phone.connect();
await phone.dial("05321234567");`
        }
      },
      {
        heading: "7. SDK Oturum API Referansı (`POST /api/v1/sdk/session`)",
        body:
          "Kendi özel dilinizde (Swift, Kotlin, C++, Go vb.) entegrasyon yapıyorsanız doğrudan bu REST ucunu çağırarak tüm WebRTC/SIP parametrelerini alabilirsiniz.",
        codeBlock: {
          title: "cURL Test Komutu ve Örnek JSON Yanıtı",
          code: `# İstek (Terminalden hemen test edebilirsiniz):
curl -X POST "https://pbx.firma.com/api/v1/sdk/session" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: aida_live_BURAYA_ANAHTARINIZ" \\
  -d '{"extension": "1001", "client_type": "web"}'

# Başarılı Yanıt (HTTP 200 OK):
{
  "status": "success",
  "sdk_version": "1.0.0",
  "extension": "1001",
  "display_name": "Ahmet Yılmaz",
  "sip_domain": "pbx.firma.com",
  "sip_uri": "sip:1001@pbx.firma.com",
  "sip_username": "1001",
  "sip_password": "********",
  "wss_url": "wss://pbx.firma.com:8089/ws",
  "wss_proxy_url": "wss://pbx.firma.com/asterisk/ws",
  "via_host": "203.0.113.10",
  "ice_servers": [
    { "urls": "stun:stun.l.google.com:19302" }
  ],
  "expires_in_seconds": 43200
}`
        },
        callout: {
          type: "warning",
          title: "Güvenlik En İyi Uygulaması (Üretim Ortamı İçin)",
          text: "Tarayıcıda çalışan genel bir web uygulamasında `X-API-Key` anahtarını istemci koduna açık yazmak yerine, kendi backend sunucunuzun `/api/v1/sdk/session` isteğini yapıp dönen JSON'ı yalnızca oturum açmış kendi kullanıcınıza vermesi en güvenli yaklaşımdır."
        }
      }
    ],
    troubleshooting: [
      {
        problem: "HTTP 401 veya 403 Yetki Hatası dönüyor",
        cause: "`X-API-Key` başlığı eksik/hatalı veya anahtarda `sdk:webrtc` / `calls:write` yetkisi işaretlenmemiştir.",
        solution: "`Yönetim → API Yönetimi` ekranında anahtarın aktif olduğunu ve `sdk:webrtc` iznine sahip olduğunu kontrol edin."
      },
      {
        problem: "Tarayıcıda mikrofon izni sormuyor veya ses gitmiyor",
        cause: "Tarayıcılar güvenlik gereği yalnızca `https://` veya `http://localhost` adreslerinde WebRTC mikrofon erişimine izin verir.",
        solution: "Sayfanızı `http://192.168.x.x` yerine `https://` üzerinden veya geliştirme sırasında `http://localhost` üzerinden açın."
      },
      {
        problem: "WSS bağlantısı (`wss://...:8089/ws`) kurulamıyor",
        cause: "Güvenlik duvarında 8089/TCP portu kapalıdır veya santralin SSL sertifikası self-signed olduğu için tarayıcı reddediyordur.",
        solution: "8089/TCP portunu açın ve geçerli bir Let's Encrypt / kurumsal SSL sertifikası kullanın (veya alternatif olarak Nginx üzerinden `wss_proxy_url` olan `wss://pbx.firma.com/asterisk/ws` ucunu deneyin)."
      },
      {
        problem: "CORS hatası alıyorum (`Access-Control-Allow-Origin`)",
        cause: "CRM'inizin alan adı santralin izinli CORS listesinde tanımlı değildir.",
        solution: "Santral sunucusundaki `.env` dosyasında `NORNIA_CORS_ORIGINS=https://crm.firmaniz.com` tanımını ekleyip `pm2 restart aida-backend` çalıştırın."
      }
    ],
    relatedChapters: [
      "masaustu-mobil-ve-webphone",
      "sip-webrtc-ami-cagri-akisi",
      "kanallar-crm-ve-dis-api"
    ]
  }
];
