export const CHAPTERS_YUKSEK_ERISILEBILIRLIK = [
  {
    id: "nornia-spark",
    number: "HA-1",
    hidden: true,
    groupId: "yuksek-erisilebilirlik",
    category: "Yüksek Erişilebilirlik & Coğrafi Yedeklilik",
    title: "Nornia Spark — Tek Sunucu Always-Up Docker HA & ISO Kurulumu",
    shortTitle: "Nornia Spark",
    menuPath: "Yüksek Erişilebilirlik & Coğrafi Yedeklilik → Nornia Spark",
    pbxRoute: "/opt/ai-project/deploy/ha/docker-compose.spark.yml",
    permissions: ["Sistem Yöneticisi / BT Mühendisi (SSH: root)"],
    badge: "Edition 1 • Tek Sunucu HA",
    readMinutes: 16,
    summary:
      "Nornia Spark; tek bir fiziksel sunucu veya sanal makine (VM) içinde Nornia'nın tüm bileşenlerini Docker konteynerlerine izole ederek çalıştıran, 2× Backend + 2× Frontend Aktif-Aktif yük dengeleme, Redis 7 küme veri yolu, MinIO S3 ses kayıt kasası ve sıfır kesintili (Zero-Downtime) güncelleme sunan Always-Up yüksek erişilebilirlik sürümüdür. Müşteri sahasına internet gerektirmeyen Air-Gapped Bootable ISO olarak da kurulabilir.",
    prerequisites: [
      "Mevcut tek sunuculu (PM2 + systemd) Nornia kurulumlarını kesinlikle bozmaz; tüm HA özellikleri ortam değişkenleri (REDIS_URL, S3_ENDPOINT, NORNIA_API_INTERNAL_URL) üzerinden opt-in olarak çalışır.",
      "Minimum Donanım: 4 vCPU, 8 GB RAM, 120 GB NVMe/SSD (50–100 eşzamanlı çağrı). Önerilen Üretim Donanımı: 8 vCPU, 16 GB RAM, 250–500 GB NVMe.",
      "İşletim Sistemi: Ubuntu 24.04 LTS (amd64) veya doğrudan üretilen Air-Gapped `nornia-spark-ha-v3.12.0.iso` kurulum medyası.",
      "Güvenlik Duvarı Portları: TCP 80/443 (HTTPS), TCP 8089 (WebRTC WSS), UDP/TCP 5060–5061 (SIP), UDP 10000–20000 (RTP Medya)."
    ],
    fieldTable: [
      {
        field: "nornia-haproxy",
        type: "Edge L7 + TCP Proxy • 80/443/8089/8000/9092",
        defaultVal: "haproxy:2.9-alpine",
        required: true,
        description:
          "Tüm HTTPS, WebSocket, WebRTC WSS (:8089) ve iç AudioSocket (:9092) trafiğini karşılar. Her 3 saniyede bir `/api/system/ready` derin sağlık kontrolü yaparak arızalı backend'i otomatik olarak havuzdan çıkarır."
      },
      {
        field: "nornia-backend-1 & backend-2",
        type: "Stateless FastAPI + AudioSocket • Aktif-Aktif",
        defaultVal: "nornia/backend:3.12.0",
        required: true,
        description:
          "Çift çalışan API, yapay zeka ses motoru ve çağrı mantığı düğümleridir. Biri yeniden başlarken veya güncellenirken diğer düğüm tüm API, WebSocket ve AI çağrılarını sıfır kesintiyle devralır."
      },
      {
        field: "nornia-frontend-1 & frontend-2",
        type: "Next.js Web & Temsilci Paneli • Aktif-Aktif",
        defaultVal: "nornia/frontend:3.12.0",
        required: true,
        description:
          "Çift kopya çalışan web arayüzü konteynerleri. Arayüz güncellemesi sırasında kullanıcıların ekranı düşmez, oturum kopmaz."
      },
      {
        field: "nornia-redis",
        type: "Redis 7 • Pub/Sub & Leader Lock",
        defaultVal: "redis:7-alpine (AOF açık)",
        required: true,
        description:
          "İki backend arasındaki canlı çağrı transkriptlerini, Omnichannel sohbet olaylarını ve ayar güncellemelerini (`settings_db` invalidation) milisaniyeler içinde senkronize eder."
      },
      {
        field: "nornia-postgres",
        type: "PostgreSQL 16 + pgvector",
        defaultVal: "pgvector/pgvector:pg16",
        required: true,
        description:
          "CDR, kullanıcılar, kuyruklar, KVKK logları ve RAG vektör indekslerini kalıcı Docker Volume (`spark_pgdata`) üzerinde barındırır."
      },
      {
        field: "nornia-minio",
        type: "MinIO S3 Ses Kayıt Kasası • :9000/:9001",
        defaultVal: "minio/minio:latest",
        required: true,
        description:
          "Asterisk tarafından oluşturulan çağrı ses kayıtlarını S3 uyumlu nesne depolama katmanında güvenle saklar; ileride harici File Server'a veya Nornia Odin'e geçişi tek satırla hazırlar."
      },
      {
        field: "nornia-asterisk",
        type: "Asterisk + Nornia Media Agent • network_mode: host",
        defaultVal: "nornia/asterisk:3.12.0",
        required: true,
        description:
          "SIP (5060) ve RTP (10000–20000/udp) performans kaybı (NAT/iptables overhead) yaşamamak için `network_mode: host` modunda çalışır. İçindeki `nornia_media_agent.py` biten çağrı kayıtlarını otomatik MinIO S3'e aktarır."
      }
    ],
    sections: [
      {
        heading: "1. Nornia Spark Mimari Şeması (Tek Sunucu Always-Up Docker HA)",
        body:
          "Nornia Spark, tek bir sunucu ayakta olduğu sürece yazılım çökmesi, bellek taşması veya sürüm güncellemesi nedeniyle sistemin asla kapanmamasını sağlar. HAProxy ön kapı olarak davranır; her iki backend düğümü ortak PostgreSQL, Redis Pub/Sub ve MinIO S3 katmanına bağlanır.",
        archDiagram: {
          eyebrow: "EDITION 1 • TEK SUNUCU ALWAYS-UP HA",
          title: "Nornia Spark — Konteyner Topolojisi ve Trafik Akışı",
          badges: ["8 Konteyner", "Zero-Downtime Update", "RTO < 3 sn (Uygulama)", "Min 4 vCPU / 8 GB RAM"],
          tiers: [
            {
              label: "Katman 1 — İstemciler & Dış Dünya",
              tone: "sky",
              meta: "HTTPS :443 • WebRTC WSS :8089 • SIP :5060 • RTP 10000-20000/udp",
              nodes: [
                { name: "Web Phone & Temsilci Paneli", badge: "HTTPS + WSS", desc: "Tarayıcı tabanlı SIP.js WebRTC ve canlı çağrı arayüzü" },
                { name: "Runa Desktop & Runa Mobile", badge: "TLS + WSS", desc: "Masaüstü (Win/macOS) ve iOS/Android uygulamaları" },
                { name: "SIP Trunk & IP Telefonlar", badge: "UDP/TCP 5060", desc: "Operatör SIP trunkları ve Yealink/Fanvil masabaşı cihazlar" }
              ],
              arrowToNext: "TLS 1.3 / WSS :443 & :8089 -> HAProxy | SIP/RTP :5060 -> Asterisk Host"
            },
            {
              label: "Katman 2 — Akıllı Giriş & Yük Dengeleyici",
              tone: "indigo",
              meta: "nornia-haproxy (3 sn /api/system/ready sağlık kontrolü)",
              nodes: [
                {
                  name: "nornia-haproxy",
                  badge: "ACTIVE EDGE",
                  ports: "80 • 443 • 8089 • 8000 (iç) • 9092 (AI TCP) • 8404 (Stats)",
                  desc: "HTTP/WS isteklerini leastconn algoritmasıyla sağlıklı Backend çiftine, UI isteklerini Frontend çiftine, WSS'i Asterisk'e aktarır."
                }
              ],
              arrowToNext: "LeastConn HTTP/WS + TCP AudioSocket Yük Dağıtımı"
            },
            {
              label: "Katman 3 — Aktif-Aktif Uygulama & Ses Motoru",
              tone: "emerald",
              meta: "Rolling Update & Otomatik Restart Koruması",
              nodes: [
                { name: "nornia-backend-1", badge: "ACTIVE #1", ports: ":8000 API • :9092 AI", desc: "FastAPI + Gemini Live AudioSocket" },
                { name: "nornia-backend-2", badge: "ACTIVE #2", ports: ":8000 API • :9092 AI", desc: "Anlık yedek + paralel yük paylaşımı" },
                { name: "nornia-frontend-1 & 2", badge: "2× NEXT.JS", ports: ":3000 UI", desc: "Sıfır kesintili arayüz sunumu" },
                { name: "nornia-asterisk", badge: "HOST NET", ports: "5060 • 5038 • RTP", desc: "Asterisk PBX + Media Agent (S3 Uploader)" }
              ],
              arrowToNext: "SQL (5432) • Redis Pub/Sub (6379) • S3 API (9000)"
            },
            {
              label: "Katman 4 — Kalıcı Veri, Olay Otobüsü & Ses Kayıt Kasası",
              tone: "amber",
              meta: "Kalıcı Docker Volume'ler (spark_pgdata / spark_redis / spark_minio)",
              nodes: [
                { name: "nornia-postgres", badge: "PG 16 + pgvector", ports: ":5432", desc: "ACID veritabanı, CDR, RAG vektörleri, ayarlar" },
                { name: "nornia-redis", badge: "REDIS 7 AOF", ports: ":6379", desc: "WS Pub/Sub yayını, Leader Lock, Cache senkronu" },
                { name: "nornia-minio", badge: "S3 OBJECT VAULT", ports: ":9000 / :9001", desc: "S3 uyumlu çağrı ses kayıt arşivi" }
              ]
            }
          ]
        }
      },
      {
        heading: "2. Donanım & Kapasite Planlama Tablosu (Nornia Spark)",
        body:
          "Spark mimarisi tek bir sunucuda çalıştığı için CPU ve disk IOPS planlaması eşzamanlı çağrı sayısına ve yapay zeka (AudioSocket) kanal yoğunluğuna göre yapılmalıdır.",
        table: {
          headers: ["Profil", "vCPU", "RAM", "Disk (NVMe/SSD)", "Eşzamanlı Çağrı", "Kayıt Saklama (Opus/WAV)"],
          rows: [
            ["Minimum (KOBİ / Test)", "4 vCPU", "8 GB", "120 GB NVMe", "50–100 Çağrı", "~6 Ay"],
            ["Önerilen (Kurumsal Üretim)", "8 vCPU", "16 GB", "250–500 GB NVMe", "150–300 Çağrı", "1–2 Yıl"],
            ["Yüksek AI & Çağrı Merkezi", "12 vCPU", "24 GB", "1 TB NVMe RAID-1", "300–500 Çağrı", "3+ Yıl"]
          ]
        }
      },
      {
        heading: "3. Adım Adım Kurulum Sırası (Online Kurulum Scripti)",
        body:
          "Temiz bir Ubuntu 24.04 LTS sunucusunda tek komutla tüm Nornia Spark kümesi, TLS sertifikası, kriptografik `.env` sırları ve UFW güvenlik duvarı kuralları otomatik yapılandırılır.",
        steps: [
          "Sunucuya SSH ile root olarak bağlanın ve proje deposunu `/opt/ai-project` altına çekin (veya mevcut depoyu güncelleyin).",
          "DNS kaydınızı (`pbx.firma.com`) sunucunun statik public IP adresine yönlendirin.",
          "`install_nornia_spark.sh` scriptini `--domain`, `--ip` ve (isteğe bağlı Let's Encrypt için) `--email` parametreleriyle çalıştırın.",
          "Script Docker Engine'i kurar, `/etc/nornia/certs/nornia.pem` sertifikasını üretir, 0600 izinli `/opt/ai-project/deploy/ha/.env` dosyasını kriptografik rastgele parolalarla oluşturur ve 8 konteyneri ayağa kaldırır.",
          "Kurulum sonunda `/api/system/ready` HTTP 200 doğrulamasını ve `http://127.0.0.1:8404/haproxy-stats` panelinden tüm backend'lerin UP olduğunu kontrol edin."
        ],
        codeBlock: {
          title: "Nornia Spark — İlk Kurulum, Sağlık Doğrulama ve Zero-Downtime Güncelleme",
          code: `# 1. İlk Kurulum (Let's Encrypt TLS dahil)
cd /opt/ai-project
sudo bash scripts/ha/install_nornia_spark.sh \\
  --domain pbx.firma.com \\
  --ip 203.0.113.10 \\
  --email bt@firma.com

# 2. Derin Sağlık Kontrolü (HAProxy Readiness Probe)
curl -s http://127.0.0.1:8000/api/system/ready | jq .

# 3. Konteyner Durumlarını İzle
docker compose -f deploy/ha/docker-compose.spark.yml ps

# 4. Sıfır Kesintili (Zero-Downtime) Sürüm Güncelleme
#    (Önce backend-1/frontend-1 güncellenir ve READY beklenir; ardından 2. çift güncellenir)
sudo bash scripts/ha/install_nornia_spark.sh --update`
        }
      },
      {
        heading: "4. Air-Gapped (İnternetsiz) Nornia Spark ISO Üretimi ve Müşteri Kurulumu",
        body:
          "İnternet erişimi kısıtlı kurumsal müşteriler veya hızlı saha kurulumları için tüm Docker imajlarını ve Ubuntu 24.04 Autoinstall kurulumunu tek bir bootable ISO dosyasında paketleyebilirsiniz.",
        steps: [
          "Derleme makinesinde (`docker` ve `xorriso` kurulu Ubuntu sunucu) `build_nornia_ha_iso.sh --edition spark` komutunu çalıştırın.",
          "Script tüm Nornia Spark Docker imajlarını derleyip sıkıştırılmış `nornia-spark-images.tar.gz` arşivine alır ve Ubuntu 24.04 Live Server ISO içine Cloud-Init `autoinstall` ile gömer.",
          "Üretilen `dist/nornia-spark-ha-v3.12.0.iso` dosyasını müşterinin VMware ESXi / Proxmox / Hyper-V sunucusuna veya USB belleğe yazıp başlatın.",
          "İlk açılışta `nornia-firstboot.service` internet erişimine ihtiyaç duymadan tüm offline imajları Docker'a yükler ve Nornia Spark kümesini otomatik olarak ayağa kaldırır."
        ],
        codeBlock: {
          title: "Nornia Spark Air-Gapped Bootable ISO Üretim Komutu",
          code: `cd /opt/ai-project
sudo bash scripts/ha/build_nornia_ha_iso.sh \\
  --edition spark \\
  --version 3.12.0

# Çıktılar:
#   dist/nornia-spark-ha-v3.12.0.iso
#   dist/nornia-spark-ha-v3.12.0.iso.sha256`
        },
        callout: {
          type: "info",
          title: "Kilit Güvenlik Notu — Mevcut Tek Sunucu Kurulumlarına Sıfır Etki",
          text: "Nornia Spark'ta kullanılan REDIS_URL, S3_ENDPOINT, NORNIA_TRUSTED_INTERNAL_CIDRS ve NORNIA_INTERNAL_API_TOKEN değişkenleri yalnızca deploy/ha/.env içinde tanımlanır. Mevcut PM2 tabanlı sunucular bu değişkenler tanımlı olmadığı için birebir eski davranışında çalışmaya devam eder."
        }
      }
    ],
    troubleshooting: [
      {
        problem: "HAProxy /haproxy-stats ekranında backend-1 veya backend-2 DOWN görünüyor",
        cause: "PostgreSQL henüz ayağa kalkmamış olabilir veya REDIS_PASSWORD / DATABASE_URL uyuşmazlığı nedeniyle `/api/system/ready` HTTP 503 dönüyordur.",
        solution: "`docker exec nornia-backend-1 curl -i http://127.0.0.1:8000/api/system/ready` komutuyla hangi alt kontrolün (`db_writable`, `redis`, `ami_connected`) hata verdiğini inceleyin."
      },
      {
        problem: "Asterisk dialplan CURL() çağrıları 401 Unauthorized dönüyor",
        cause: "Docker köprü alt ağı `NORNIA_TRUSTED_INTERNAL_CIDRS` kapsamı dışında kalmıştır.",
        solution: "`deploy/ha/docker-compose.spark.yml` içinde `NORNIA_TRUSTED_INTERNAL_CIDRS` değerinin `127.0.0.1/32,172.16.0.0/12,10.0.0.0/8` içerdiğini doğrulayın ve backend konteynerlerini yeniden başlatın."
      },
      {
        problem: "WebRTC Web Phone 8089 WSS bağlantısında SSL hatası veriyor",
        cause: "`/etc/nornia/certs/nornia.pem` self-signed sertifikadır ve tarayıcı henüz güvenmemiştir.",
        solution: "Üretim ortamında `--email` parametresiyle Let's Encrypt sertifikası alın veya kurumsal CA sertifikanızı fullchain+privkey birleşik formatında `/etc/nornia/certs/nornia.pem` dosyasına kopyalayıp `docker restart nornia-haproxy` çalıştırın."
      }
    ],
    relatedPages: ["nornia-midgard", "nornia-odin", "sistem-mimarisi-ve-servis-haritasi"],
    relatedApis: ["GET /api/system/ready", "GET /api/system/health", "GET /api/recordings/{filename}"]
  },

  {
    id: "nornia-midgard",
    number: "HA-2",
    hidden: true,
    groupId: "yuksek-erisilebilirlik",
    category: "Yüksek Erişilebilirlik & Coğrafi Yedeklilik",
    title: "Nornia Midgard — Tek Sunucu Tam SIP-HA (Kamailio + RTPEngine + 2×Asterisk)",
    shortTitle: "Nornia Midgard",
    menuPath: "Yüksek Erişilebilirlik & Coğrafi Yedeklilik → Nornia Midgard",
    pbxRoute: "/opt/ai-project/deploy/ha/docker-compose.midgard.yml",
    permissions: ["Sistem Yöneticisi / Telekom Mühendisi (SSH: root)"],
    badge: "Edition 2 • Tam SIP-HA",
    readMinutes: 18,
    summary:
      "Nornia Midgard, Nornia Spark'ın tüm uygulama yedekliliğine ek olarak ses/telekom katmanındaki tek hata noktasını (Single Point of Failure) tamamen ortadan kaldırır. Ön cephede Kamailio SIP/WebRTC (WSS) Edge Proxy ve RTPEngine DTLS-SRTP medya köprüsü bulunur; arkada ise Aktif-Aktif çalışan 2 adet Asterisk düğümü (:5062 ve :5064) 5 saniyelik OPTIONS sağlık kontrolüyle otomatik failover yapar.",
    prerequisites: [
      "Minimum Donanım: 6 vCPU, 12 GB RAM, 160 GB NVMe/SSD (150–250 eşzamanlı çağrı). Önerilen Üretim Donanımı: 8–12 vCPU, 16–24 GB RAM, 500 GB NVMe.",
      "RTPEngine için yüksek medya port aralığı UDP 20000–30000 güvenlik duvarında açık olmalıdır.",
      "Kamailio WSS TLS sonlandırması için `/etc/nornia/certs/fullchain.pem` ve `privkey.pem` dosyaları (script tarafından otomatik hazırlanır) gerekir."
    ],
    fieldTable: [
      {
        field: "nornia-kamailio",
        type: "SIP & WebRTC WSS Edge Proxy • :5060 / :8089",
        defaultVal: "ghcr.io/kamailio/kamailio:5.8-bullseye",
        required: true,
        description:
          "Web Phone, Runa Desktop/Mobile (WSS :8089), IP telefonlar ve SIP operatör trunklarının (UDP/TCP :5060) tek giriş noktasıdır. `dispatcher` modülü ile arkadaki 2 Asterisk düğümünü her 5 saniyede bir SIP OPTIONS ile tarar; biri durursa yeni çağrıları milisaniyeler içinde sağ düğüme yönlendirir."
      },
      {
        field: "nornia-rtpengine",
        type: "DTLS-SRTP <-> RTP Medya Köprüsü • UDP 20000–30000",
        defaultVal: "drachtio/rtpengine:latest",
        required: true,
        description:
          "WebRTC istemcilerinin şifreli DTLS-SRTP/ICE ses akışlarını sonlandırır ve arka plandaki Asterisk havuzuna hafif saf RTP olarak iletir. Asterisk CPU yükünü %40'a kadar azaltır ve kurumsal NAT/Firewall sorunlarını kökünden çözer."
      },
      {
        field: "nornia-asterisk-1 & asterisk-2",
        type: "Aktif-Aktif Çift Asterisk Havuzu • :5062/:5038 & :5064/:5039",
        defaultVal: "nornia/asterisk:3.12.0",
        required: true,
        description:
          "İki bağımsız Asterisk örneği yerel arayüzde farklı SIP/AMI portlarında çalışır. Backend tarafındaki `ASTERISK_NODES=172.29.0.1:5038,172.29.0.1:5039` ayarı sayesinde AMI bağlantısı bile bir Asterisk düştüğünde diğerine otomatik geçer."
      },
      {
        field: "nornia-haproxy + 2×Backend + 2×Frontend",
        type: "Web / API / AI Yedeklilik Katmanı",
        defaultVal: "haproxy:2.9 + nornia/backend + frontend",
        required: true,
        description:
          "Nornia Spark ile birebir aynı sıfır kesintili uygulama katmanıdır. Midgard'da WSS :8089 yükünü Kamailio devraldığı için HAProxy yalnızca HTTPS/API/AudioSocket trafiğine odaklanır."
      },
      {
        field: "nornia-postgres + redis + minio",
        type: "Veri, Olay Otobüsü & S3 Ses Kayıt Kasası",
        defaultVal: "PG 16 + Redis 7 + MinIO",
        required: true,
        description:
          "Her iki Asterisk düğümü ortak spool ve `nornia_media_agent.py` üzerinden ses kayıtlarını anlık olarak MinIO S3 kasasına aktarır."
      }
    ],
    sections: [
      {
        heading: "1. Nornia Midgard Mimari Şeması (Tam SIP-HA + WebRTC Edge)",
        body:
          "Nornia Midgard'da bir Asterisk konteyneri kilitlense veya sürüm güncellemesi için yeniden başlatılsa bile yeni gelen çağrılar, dış aramalar ve WebRTC kayıtları Kamailio `failure_route[DISPATCH_FAILOVER]` mekanizması sayesinde kesintisiz olarak diğer Asterisk düğümünden akmaya devam eder.",
        archDiagram: {
          eyebrow: "EDITION 2 • TEK SUNUCU TAM SIP-HA",
          title: "Nornia Midgard — Kamailio + RTPEngine + 2×Asterisk + 2×Nornia Mimarisi",
          badges: ["11 Konteyner", "Kamailio 5s Failover", "2×Asterisk Active-Active", "Min 6 vCPU / 12 GB RAM"],
          tiers: [
            {
              label: "Katman 1 — Çift Girişli Akıllı Edge Katmanı (HTTP & SIP/WSS)",
              tone: "sky",
              meta: "Tek Public IP • Sıfır Port Çakışması",
              nodes: [
                {
                  name: "nornia-haproxy",
                  badge: "WEB & API EDGE",
                  ports: "TCP 80 • 443 • 8000 • 9092",
                  desc: "HTTPS Panel, REST API, WebSocket ve AudioSocket TCP yük dengeleme"
                },
                {
                  name: "nornia-kamailio",
                  badge: "SIP & WSS EDGE",
                  ports: "UDP/TCP 5060 • WSS/TLS 8089",
                  desc: "WebRTC WSS sonlandırma, Pike flood koruması, 5s OPTIONS Dispatcher"
                },
                {
                  name: "nornia-rtpengine",
                  badge: "MEDIA PROXY",
                  ports: "UDP 20000–30000 • NG :22222",
                  desc: "DTLS-SRTP/ICE <-> RTP çevirimi, NAT traversal, düşük CPU medya köprüsü"
                }
              ],
              arrowToNext: "HTTP/WS -> 2×Backend | SIP (Round-Robin + Failover) -> 2×Asterisk"
            },
            {
              label: "Katman 2 — Aktif-Aktif Telekom & Uygulama Havuzu",
              tone: "emerald",
              meta: "Her Bileşenden 2 Kopya • Zero-Downtime Rolling Update",
              nodes: [
                { name: "nornia-asterisk-1", badge: "SIP :5062 • AMI :5038", desc: "Aktif Medya Düğümü #1 + Media Agent" },
                { name: "nornia-asterisk-2", badge: "SIP :5064 • AMI :5039", desc: "Aktif Medya Düğümü #2 + Media Agent" },
                { name: "nornia-backend-1 & 2", badge: "ASTERISK_NODES HA", ports: ":8000 / :9092", desc: "Otomatik AMI failover destekli 2× FastAPI" },
                { name: "nornia-frontend-1 & 2", badge: "2× NEXT.JS", ports: ":3000", desc: "Aktif-Aktif yönetim ve temsilci arayüzü" }
              ],
              arrowToNext: "SQL :5432 • Redis Pub/Sub :6379 • S3 Upload :9000"
            },
            {
              label: "Katman 3 — Ortak Veri & S3 Depolama Katmanı",
              tone: "amber",
              meta: "Tek Kaynak Doğruluğu (Single Source of Truth)",
              nodes: [
                { name: "nornia-postgres", badge: "PG 16 + pgvector", ports: ":5432", desc: "Merkezi veritabanı ve CDR" },
                { name: "nornia-redis", badge: "REDIS 7", ports: ":6379", desc: "Canlı WS yayını + Asterisk reload sinyali" },
                { name: "nornia-minio", badge: "S3 VAULT", ports: ":9000 / :9001", desc: "Her iki Asterisk'in ortak kayıt kasası" }
              ]
            }
          ]
        }
      },
      {
        heading: "2. Donanım & Kapasite Planlama Tablosu (Nornia Midgard)",
        body:
          "Kamailio + RTPEngine + 2×Asterisk mimarisi, çağrı yoğunluğu yüksek orta-büyük işletmeler ve 7/24 kesintisiz çağrı merkezleri için tasarlanmıştır.",
        table: {
          headers: ["Profil", "vCPU", "RAM", "Disk (NVMe/SSD)", "Eşzamanlı Çağrı", "Asterisk Failover Süresi"],
          rows: [
            ["Minimum", "6 vCPU", "12 GB", "160 GB NVMe", "150–250 Çağrı", "< 5 saniye (OPTIONS)"],
            ["Önerilen Üretim", "8–12 vCPU", "16–24 GB", "500 GB NVMe", "300–600 Çağrı", "< 5 saniye (OPTIONS)"],
            ["Yüksek Yoğunluk", "16 vCPU", "32 GB", "1 TB NVMe RAID-10", "600–1.000 Çağrı", "< 5 saniye (OPTIONS)"]
          ]
        }
      },
      {
        heading: "3. Adım Adım Kurulum Sırası, Konfigürasyon ve Failover Testi",
        body:
          "`install_nornia_midgard.sh` scripti Kamailio `tls.cfg`, `dispatcher-midgard.list`, Asterisk-2 port izolasyon dosyaları (`/etc/nornia/asterisk-2`) ve RTPEngine UDP port kurallarını eksiksiz oluşturur.",
        steps: [
          "Temiz Ubuntu 24.04 LTS sunucusunda `/opt/ai-project` dizinine geçin ve `install_nornia_midgard.sh` kurulumunu başlatın.",
          "Script otomatik olarak Kamailio'yu 5060/8089, RTPEngine'i 20000–30000/udp, Asterisk-1'i 5062/5038 ve Asterisk-2'yi 5064/5039 portlarına izole eder.",
          "Kurulum sonrası `kamcmd dispatcher.list` komutuyla her iki Asterisk düğümünün `FLAGS: AP` (Active Probing) durumunda olduğunu doğrulayın.",
          "Canlı failover testi için `docker stop nornia-asterisk-1` çalıştırın; 5 saniye içinde Kamailio'nun düğümü `IP` (Inactive) işaretleyip tüm yeni çağrıları `nornia-asterisk-2` üzerinden geçirdiğini gözlemleyin."
        ],
        codeBlock: {
          title: "Nornia Midgard — Kurulum, Kamailio Dispatcher Doğrulama ve ISO Üretimi",
          code: `# 1. Nornia Midgard Tam SIP-HA Kurulumu
cd /opt/ai-project
sudo bash scripts/ha/install_nornia_midgard.sh \\
  --domain pbx.firma.com \\
  --ip 203.0.113.10 \\
  --email bt@firma.com

# 2. Kamailio Dispatcher Havuz Durumunu Kontrol Et (Her 2 Asterisk AP olmalı)
docker exec nornia-kamailio kamcmd dispatcher.list

# 3. Sıfır Kesintili (Zero-Downtime) Rolling Update (Backend + Frontend + 2x Asterisk sırayla!)
sudo bash scripts/ha/install_nornia_midgard.sh --update

# 4. Air-Gapped Nornia Midgard Bootable ISO Üretimi
sudo bash scripts/ha/build_nornia_ha_iso.sh --edition midgard --version 3.12.0`
        }
      }
    ],
    troubleshooting: [
      {
        problem: "WebRTC çağrısında ses tek yönlü veya hiç gelmiyor",
        cause: "RTPEngine `--interface` parametresine sunucunun dış (Public) IP'si yerine iç IP verilmiş veya UDP 20000–30000 portları harici güvenlik duvarında kapalıdır.",
        solution: "`deploy/ha/.env` dosyasındaki `PUBLIC_IP` değerini doğrulayın, harici firewall/NAT cihazında UDP 20000–30000 aralığını sunucuya açın ve `docker restart nornia-rtpengine` çalıştırın."
      },
      {
        problem: "Kamailio `dispatcher.list` içinde Asterisk-2 `IP` (Inactive) görünüyor",
        cause: "`/etc/nornia/asterisk-2/pjsip_midgard_port.conf` henüz yüklenmemiş veya 5064 portu başka bir süreç tarafından tutuluyordur.",
        solution: "`docker exec nornia-asterisk-2 asterisk -rx 'pjsip show transports'` çıktısında `127.0.0.1:5064` göründüğünü doğrulayın."
      }
    ],
    relatedPages: ["nornia-spark", "nornia-odin", "sip-webrtc-ami-cagri-akisi"],
    relatedApis: ["GET /api/system/ready", "GET /api/webrtc/config", "GET /api/sip-debugger/calls"]
  },

  {
    id: "nornia-odin",
    number: "HA-3",
    hidden: true,
    groupId: "yuksek-erisilebilirlik",
    category: "Yüksek Erişilebilirlik & Coğrafi Yedeklilik",
    title: "Nornia Odin — Çoklu Sunucu, Ayrıştırılmış Asterisk & Coğrafi Yedeklilik (Geo-DR)",
    shortTitle: "Nornia Odin",
    menuPath: "Yüksek Erişilebilirlik & Coğrafi Yedeklilik → Nornia Odin",
    pbxRoute: "/opt/ai-project/scripts/ha/install_nornia_odin.sh",
    permissions: ["Kurumsal Altyapı Mimarı / Sistem Yöneticisi (SSH: root)"],
    badge: "Edition 3 • Enterprise Geo-HA",
    readMinutes: 25,
    summary:
      "Nornia Odin, bir fiziksel sunucunun değil tüm bir veri merkezinin (Datacenter) çökmesine karşı bile tam koruma sağlayan en üst düzey kurumsal bulut ve coğrafi yedeklilik mimarisidir. 5 katmana ayrıştırılmıştır: Edge Proxy (HAProxy + Kamailio + RTPEngine + Keepalived VIP), Stateless Nornia App Havuzu, Ayrıştırılmış Harici Asterisk Medya Havuzu, Lokasyon İçi Çift PostgreSQL Patroni (RPO=0) + Coğrafi Replikasyon, MinIO Geo-S3 File Server, 3. Lokasyon Witness Quorum ve Multi-HQ Taşra Şube Yedekliliği.",
    prerequisites: [
      "En az 2 bağımsız Veri Merkezi (Lokasyon A Birincil + Lokasyon B Coğrafi DR) ve Split-Brain önleme için 3. bir lokasyonda (Lokasyon C) 1 vCPU / 1 GB RAM Witness sunucusu.",
      "Lokasyon A, B ve C arasında düşük gecikmeli özel L3 omurga (WireGuard VPN, MPLS veya Fiber P2P; önerilen RTT < 30 ms).",
      "Lokasyon A ve B arasında otomatik DNS Failover (Cloudflare Load Balancing / Route53 Health Check -> `/api/system/ready`) veya BGP Anycast IP.",
      "Lokasyon A içindeki veritabanı kesintisinin tüm lokasyonu kilitlememesi için Lokasyon A'da mutlaka 2× PostgreSQL (PG-A1 Primary + PG-A2 Sync Standby) + PgBouncer kullanılır."
    ],
    fieldTable: [
      {
        field: "Rol 1: witness (Lokasyon C)",
        type: "etcd + Redis Sentinel Quorum • 1 vCPU / 1 GB RAM",
        defaultVal: "--role witness",
        required: true,
        description:
          "İki veri merkezi arasındaki hat koptuğunda Split-Brain (çift Primary çakışması) oluşmasını engelleyen 3. hakem oyu (Quorum). Çağrı veya veri trafiği taşımaz, yalnızca lider seçim oylaması yapar."
      },
      {
        field: "Rol 2: postgres (Lokasyon A×2 + Lokasyon B×1)",
        type: "Patroni + PostgreSQL 16 + PgBouncer (:6432)",
        defaultVal: "--role postgres",
        required: true,
        description:
          "Lokasyon A'da `PG-A1 (Primary)` ile `PG-A2 (Sync Standby)` arasında sıfır veri kayıplı (RPO=0) senkron replikasyon çalışır. PG-A1 giderse 15 saniyede PG-A2 lider olur; Lokasyon A tamamen düşerse Lokasyon B'deki `PG-B1` devralır."
      },
      {
        field: "Rol 3: minio (Lokasyon A + Lokasyon B)",
        type: "Ayrıştırılmış File Server & S3 Geo-Replikasyon",
        defaultVal: "--role minio",
        required: true,
        description:
          "Tüm çağrı ses kayıtları, anonslar ve dışa aktarılan dosyalar Nornia ve Asterisk disklerinden ayrıştırılır. İki lokasyon arasında Active-Active S3 Bucket Replication ile anlık eşlenir."
      },
      {
        field: "Rol 4: media (Harici Asterisk Havuzu)",
        type: "Ayrıştırılmış Asterisk + nornia_media_agent.py",
        defaultVal: "--role media",
        required: true,
        description:
          "Asterisk tamamen Nornia uygulama sunucularının dışına alınır. Kamailio arkasında yatay olarak (2, 4, 8+ sunucu) ölçeklenebilir. Çağrı bittiğinde `nornia_media_agent.py` ses kaydını MinIO S3'e yükleyip yerel diski temizler."
      },
      {
        field: "Rol 5: app (Stateless Nornia Havuzu)",
        type: "Stateless FastAPI + Next.js + Redis",
        defaultVal: "--role app",
        required: true,
        description:
          "Diskinde hiçbir kalıcı durum tutmayan Nornia uygulama sunucularıdır. PgBouncer (:6432), Redis, `ASTERISK_NODES` havuzu ve MinIO S3'e bağlanır. `/api/system/ready` veritabanı yazılabilirliğini de doğrulayarak yalancı sağlıklı yanıtı (false-positive) önler."
      },
      {
        field: "Rol 6: edge (HAProxy + Kamailio + RTPEngine + Keepalived)",
        type: "Çift Aktif/Pasif VIP Giriş Katmanı",
        defaultVal: "--role edge",
        required: true,
        description:
          "Keepalived VRRP Floating VIP sayesinde bir Edge proxy makinesi kapansa bile IP adresi 2 saniye içinde yedek Edge makinesine kayar; WebRTC WSS, HTTPS ve SIP trafiği kesilmez."
      },
      {
        field: "Taşra / Şube (Multi-Site Federation Multi-HQ)",
        type: "Yerel Hayatta Kalma + Çoklu Merkez Failover",
        defaultVal: "hq_backup_urls",
        required: false,
        description:
          "Mevcut Çok-Şubeli Dağıtık Santral (`federation_service.py`) altyapısı artık `hq_backup_urls` listesini destekler. Lokasyon A çökerse taşra şube sunucuları otomatik olarak Lokasyon B'ye bağlanır; her ikisi de ulaşılamazsa yerel çağrıları ve kayıtları kendi diskinde kuyruklayıp merkez açıldığında senkronize eder."
      }
    ],
    sections: [
      {
        heading: "1. Nornia Odin Tam Coğrafi Yedeklilik Mimari Şeması",
        body:
          "Aşağıdaki şema; Lokasyon A (Birincil Veri Merkezi), Lokasyon B (Coğrafi Yedek Veri Merkezi), Lokasyon C (Quorum Witness) ve Taşra Şube düğümlerinin uçtan uca nasıl haberleştiğini ve hangi katmanda hangi failover mekanizmasının devreye girdiğini gösterir.",
        archDiagram: {
          eyebrow: "EDITION 3 • ENTERPRISE MULTI-SERVER & GEO-REDUNDANCY",
          title: "Nornia Odin — 2 Veri Merkezi + Witness Quorum + Ayrıştırılmış Medya & S3 Topolojisi",
          badges: ["SLA %99.99", "Intra-DC RPO = 0", "Geo-DR RTO < 60 sn", "Multi-HQ Taşra Desteği"],
          tiers: [
            {
              label: "Katman 0 — Küresel Trafik Yönlendirme & Taşra Şubeler",
              tone: "purple",
              meta: "Geo-DNS (/api/system/ready) • SIP SRV Priority 10/20 • Multi-HQ Federation",
              nodes: [
                { name: "Geo-DNS / BGP Anycast", badge: "HEALTH CHECK", desc: "Lokasyon A /api/system/ready HTTP 503 verirse 30 sn içinde Lokasyon B'ye kaydırır" },
                { name: "Taşra Şube Sunucuları", badge: "MULTI-HQ FAILOVER", desc: "hq_url (Lok A) -> hq_backup_urls (Lok B) -> Yerel Hayatta Kalma (Offline Queue)" }
              ],
              arrowToNext: "HTTPS/WSS :443/:8089 & SIP :5060 -> Keepalived Floating VIP"
            },
            {
              label: "Katman 1 — Edge Proxy Katmanı (Her Lokasyonda 2× Sunucu)",
              tone: "sky",
              meta: "Keepalived VRRP VIP (2 sn Failover) • HAProxy + Kamailio + RTPEngine",
              nodes: [
                { name: "Edge-A1 & Edge-A2 (Lokasyon A)", badge: "VIP ACTIVE", ports: "443 • 8089 • 5060 • RTP", desc: "HAProxy + Kamailio WSS/SIP + RTPEngine" },
                { name: "Edge-B1 & Edge-B2 (Lokasyon B)", badge: "GEO-DR READY", ports: "443 • 8089 • 5060 • RTP", desc: "Lokasyon B tam eşlenik Edge katmanı" }
              ],
              arrowToNext: "Özel VLAN/WireGuard -> Stateless App Pool & Harici Asterisk Pool"
            },
            {
              label: "Katman 2 — Stateless Nornia Uygulama & Ayrıştırılmış Asterisk Havuzu",
              tone: "emerald",
              meta: "Yatay Ölçeklenebilir • Disk Bağımsız (Stateless)",
              nodes: [
                { name: "App-A1 & App-A2", badge: "STATELESS NORNIA", ports: ":8000 • :3000 • :9092", desc: "FastAPI + Next.js + Redis Cluster Bus" },
                { name: "Media-A1 & Media-A2", badge: "HARİCİ ASTERISK", ports: ":5060 • :5038", desc: "Ayrıştırılmış Asterisk + Media Agent (S3)" },
                { name: "App-B1 + Media-B1 (Lok B)", badge: "WARM/ACTIVE DR", ports: ":8000 • :5060", desc: "Coğrafi yedek uygulama ve medya havuzu" }
              ],
              arrowToNext: "PgBouncer :6432 (SQL) • MinIO S3 :9000 • Patroni/etcd Quorum"
            },
            {
              label: "Katman 3 — Çift İçi-DC PostgreSQL Patroni + MinIO Geo-S3 + Lokasyon C Witness",
              tone: "amber",
              meta: "Lokasyon İçi RPO=0 (Sync) • Lokasyonlar Arası Async Geo-DR • Split-Brain Koruması",
              nodes: [
                { name: "PG-A1 (Primary) + PG-A2 (Sync)", badge: "RPO = 0", ports: ":5432 / :6432", desc: "Lokasyon A'da 1 PG çökse bile trafik Lok A'da 15 sn'de kesintisiz sürer!" },
                { name: "PG-B1 (Geo-Replica)", badge: "RPO < 3 sn", ports: ":5432 / :6432", desc: "Lokasyon A tamamen giderse Patroni ile Primary olur" },
                { name: "MinIO-A <-> MinIO-B", badge: "GEO S3 SYNC", ports: ":9000 / :9001", desc: "Active-Active ses kayıt File Server replikasyonu" },
                { name: "Witness-C (Lokasyon C)", badge: "3. QUORUM OYU", ports: "etcd :2379 • Sentinel :26379", desc: "1 vCPU bulut hakemi; Split-Brain imkânsız kılar" }
              ]
            }
          ]
        }
      },
      {
        heading: "2. Sunucu Envanteri & Kaynak Gereksinimleri (Nornia Odin)",
        body:
          "Nornia Odin, bütçe ve yedeklilik hedefine göre Minimal Kurumsal (7 sunucu) veya Tam Coğrafi Yedekli Enterprise (13 sunucu) profillerinde kurulabilir.",
        table: {
          headers: ["Katman / Sunucu Rolü", "Adet (Minimal / Tam Geo)", "Sunucu Başına vCPU / RAM", "Disk", "Görev Özeti"],
          rows: [
            ["Witness-C (Lokasyon C)", "1 / 1", "1 vCPU / 1–2 GB RAM", "20 GB SSD", "etcd + Redis Sentinel 3. hakem oyu"],
            ["PostgreSQL Patroni (PG-A1, A2, B1)", "2 / 3", "4–8 vCPU / 8–16 GB RAM", "250 GB NVMe", "Intra-DC Sync (RPO=0) + Geo-Replica + PgBouncer"],
            ["MinIO S3 File Server (A & B)", "1 / 2", "2–4 vCPU / 4–8 GB RAM", "1–4 TB SSD/HDD", "Ayrıştırılmış ses kayıt kasası + Geo Bucket Sync"],
            ["Harici Asterisk Media Pool", "2 / 3", "4–8 vCPU / 8 GB RAM", "80 GB SSD", "SIP/RTP medya işleme + nornia_media_agent.py"],
            ["Stateless Nornia App Pool", "2 / 3", "4–8 vCPU / 8–16 GB RAM", "80 GB SSD", "FastAPI + Next.js + AudioSocket AI + Redis"],
            ["Edge Proxy (HAProxy+Kamailio+RTP)", "2 / 4", "4 vCPU / 4–8 GB RAM", "40 GB SSD", "Keepalived VIP, HTTPS, WSS :8089, SIP :5060"],
            ["TOPLAM (Minimal Tek DC -> Tam Geo-DR)", "7 -> 13 Sunucu", "24–40 vCPU (Min) / 56–96 vCPU (Geo)", "1.5 TB -> 6+ TB", "1.000 – 5.000+ Eşzamanlı Çağrı Kapasitesi"]
          ]
        }
      },
      {
        heading: "3. Zorunlu Kurulum Sırası (6 Aşamalı Rol Bazlı Dağıtım)",
        body:
          "Nornia Odin bileşenleri birbirine bağımlı olduğu için `install_nornia_odin.sh` scripti mutlaka aşağıdan yukarıya (Veri & Quorum -> Medya -> Uygulama -> Edge) sırasıyla çalıştırılmalıdır.",
        steps: [
          "ADIM 1 — Witness (Lokasyon C): İlk olarak 3. lokasyonda `etcd` ve `Redis Sentinel` hakem düğümünü ayağa kaldırın.",
          "ADIM 2 — PostgreSQL Patroni (PG-A1 -> PG-A2 -> PG-B1): Önce Lokasyon A Primary (`--pg-role primary`), sonra aynı lokasyonda Sync Standby (`--pg-role sync-standby`), ardından Lokasyon B Geo-Replica (`--pg-role geo-replica`) kurulumunu yapın.",
          "ADIM 3 — MinIO S3 File Server (Lokasyon A & B): Her iki lokasyonda MinIO kurup `mc admin replicate add loc-a loc-b` ile Active-Active ses kayıt replikasyonunu başlatın.",
          "ADIM 4 — Ayrıştırılmış Asterisk Media Pool (Media-A1, A2, B1): Harici Asterisk sunucularını kurun; dialplan API çağrıları için `--api-internal-url` ve ses kayıtları için `--s3-endpoint` adreslerini verin.",
          "ADIM 5 — Stateless Nornia App Pool (App-A1, A2, B1): Uygulama sunucularını PgBouncer, Redis, `ASTERISK_NODES` ve MinIO adreslerine bağlayın.",
          "ADIM 6 — Edge Proxy + Keepalived VIP (Edge-A1, A2, B1, B2): HAProxy, Kamailio, RTPEngine ve Keepalived VRRP VIP'i devreye alın; son olarak Geo-DNS (Cloudflare/Route53) sağlık kontrolünü `https://pbx.firma.com/api/system/ready` ucuna bağlayın."
        ],
        codeBlock: {
          title: "Nornia Odin — 6 Adımlı Tam Kurulum Komut Zinciri",
          code: `# --- ADIM 1: LOKASYON C (Witness Quorum) ---
sudo bash scripts/ha/install_nornia_odin.sh --role witness \\
  --node-ip 10.99.0.10 --redis-host 10.10.20.11 --redis-pass "STRONG_REDIS"

# --- ADIM 2: VERİTABANI (PG-A1 Primary, PG-A2 Sync Standby, PG-B1 Geo-Replica) ---
# PG-A1 (Lokasyon A Primary):
sudo bash scripts/ha/install_nornia_odin.sh --role postgres --site loc-a --pg-role primary \\
  --node-name pg-a1 --node-ip 10.10.40.11 \\
  --etcd-endpoints "10.10.40.11:2379,10.10.40.12:2379,10.99.0.10:2379" --pg-pass "STRONG_PG"

# PG-A2 (Lokasyon A Sync Standby - RPO=0):
sudo bash scripts/ha/install_nornia_odin.sh --role postgres --site loc-a --pg-role sync-standby \\
  --node-name pg-a2 --node-ip 10.10.40.12 \\
  --etcd-endpoints "10.10.40.11:2379,10.10.40.12:2379,10.99.0.10:2379" --pg-pass "STRONG_PG"

# PG-B1 (Lokasyon B Geo-Replica):
sudo bash scripts/ha/install_nornia_odin.sh --role postgres --site loc-b --pg-role geo-replica \\
  --node-name pg-b1 --node-ip 10.20.40.11 \\
  --etcd-endpoints "10.10.40.11:2379,10.10.40.12:2379,10.99.0.10:2379" --pg-pass "STRONG_PG"

# --- ADIM 3: MINIO S3 FILE SERVER (Lokasyon A & B) ---
sudo bash scripts/ha/install_nornia_odin.sh --role minio --site loc-a \\
  --node-ip 10.10.50.11 --minio-pass "STRONG_S3" --peer-minio "http://10.20.50.11:9000"

# --- ADIM 4: AYRIŞTIRILMIŞ ASTERISK MEDYA HAVUZU (Media-A1 & A2) ---
sudo bash scripts/ha/install_nornia_odin.sh --role media --site loc-a \\
  --node-name media-a1 --node-ip 10.10.30.11 \\
  --api-internal-url "http://10.10.10.10:8000" --audiosocket-addr "10.10.10.10:9092" \\
  --s3-endpoint "http://10.10.50.11:9000" --minio-pass "STRONG_S3" \\
  --redis-host 10.10.20.11 --redis-pass "STRONG_REDIS"

# --- ADIM 5: STATELESS NORNIA APP HAVUZU (App-A1 & A2) ---
sudo bash scripts/ha/install_nornia_odin.sh --role app --site loc-a \\
  --node-name app-a1 --node-ip 10.10.20.11 \\
  --pgbouncer-host 10.10.40.11 --pg-pass "STRONG_PG" \\
  --redis-host 10.10.20.11 --redis-pass "STRONG_REDIS" \\
  --media-nodes "10.10.30.11:5038,10.10.30.12:5038" \\
  --s3-endpoint "http://10.10.50.11:9000" --minio-pass "STRONG_S3"

# --- ADIM 6: EDGE PROXY + KEEPALIVED VIP (Edge-A1 Priority 110, Edge-A2 Priority 100) ---
sudo bash scripts/ha/install_nornia_odin.sh --role edge --site loc-a \\
  --node-ip 10.10.10.11 --public-ip 203.0.113.10 \\
  --vip-ip 203.0.113.10 --vip-iface eth0 --vip-priority 110 \\
  --domain pbx.firma.com \\
  --app-nodes "10.10.20.11,10.10.20.12" \\
  --media-nodes "10.10.30.11:5060,10.10.30.12:5060"`
        }
      },
      {
        heading: "4. Taşra Şube Multi-HQ Failover & Air-Gapped Odin ISO Üretimi",
        body:
          "Taşra şube santralleriniz (Edge) için birincil merkez (`hq_url`) yanında ikincil coğrafi merkez adreslerini (`hq_backup_urls` veya `NORNIA_FEDERATION_HQ_BACKUP_URLS`) tanımladığınızda şube sunucuları otomatik olarak Lokasyon B'ye geçiş yapar. Ayrıca tüm Odin bileşenlerini barındıran tek bir Offline ISO paketi üreterek yüksek güvenlikli kapalı ağ veri merkezlerine kurulum yapabilirsiniz.",
        codeBlock: {
          title: "Taşra Multi-HQ Yapılandırması & Nornia Odin Offline ISO Üretimi",
          code: `# 1. Taşra Şube Sunucusu Multi-HQ Yedek Merkez Ayarı (API veya .env ile)
export NORNIA_FEDERATION_HQ_BACKUP_URLS="https://dr-hq.firma.com"

# 2. Nornia Odin Air-Gapped Offline ISO Üretimi (Tüm 6 rolün Docker imajları dahil!)
cd /opt/ai-project
sudo bash scripts/ha/build_nornia_ha_iso.sh --edition odin --version 3.12.0

# 3. ISO ile İnternetsiz Veri Merkezinde Rol Kurulumu
sudo bash /opt/ai-project/scripts/ha/install_nornia_odin.sh \\
  --role app --offline --images-tar /opt/nornia-offline/nornia-odin-images.tar.gz ...`
        },
        callout: {
          type: "warning",
          title: "Kritik Mimari Garanti — Lokasyon A PostgreSQL Arızası Senaryosu",
          text: "Lokasyon A'da yalnızca PG-A1 çöktüğünde Patroni 15 sn içinde aynı veri merkezindeki PG-A2'yi senkron Primary (RPO=0) yapar; trafik Lokasyon A'dan çıkmaz. Eğer Lokasyon A'nın HER İKİ veritabanı da erişilemez olursa, App-A1/A2 üzerindeki /api/system/ready uç noktası SELECT NOT pg_is_in_recovery() kontrolünde HTTP 503 döner; bu sayede Geo-DNS ve Keepalived yalancı sağlıklı yanıt almadan tüm trafiği derhal Lokasyon B'ye aktarır."
        }
      },
      {
        heading: "5. Spark • Midgard • Odin Karşılaştırma Özeti",
        body:
          "Müşteri ölçeğine ve SLA gereksinimine göre doğru Nornia Yüksek Erişilebilirlik sürümünü aşağıdaki tablodan seçebilirsiniz.",
        table: {
          headers: ["Özellik / Kriter", "Nornia Spark", "Nornia Midgard", "Nornia Odin"],
          rows: [
            ["Kurulum Topolojisi", "Tek Sunucu (8 Konteyner)", "Tek Sunucu (11 Konteyner)", "Çoklu Sunucu & 2+1 Veri Merkezi"],
            ["Uygulama (Backend / UI)", "2× Aktif-Aktif + HAProxy", "2× Aktif-Aktif + HAProxy", "Sınırsız Stateless Havuz"],
            ["SIP & WebRTC Edge", "HAProxy WSS + 1× Asterisk", "Kamailio + RTPEngine + 2× Asterisk", "Çift VIP Edge + Harici Asterisk Havuzu"],
            ["Veritabanı (PostgreSQL)", "Tek PG 16 + pgvector", "Tek PG 16 + pgvector", "Çift İçi-DC Patroni (RPO=0) + Geo-DR"],
            ["Ses Kayıtları (File Server)", "Yerel MinIO S3", "Yerel MinIO S3", "Ayrıştırılmış MinIO Geo-S3 Replikasyon"],
            ["Zero-Downtime Güncelleme", "Evet (Uygulama + UI)", "Evet (Uygulama + UI + Asterisk)", "Evet (Tüm Katmanlar + DC Bakımı)"],
            ["Coğrafi Yedeklilik (Geo-DR)", "Hayır (Tek Sunucu)", "Hayır (Tek Sunucu)", "Evet (Tam Veri Merkezi Yedekliliği)"],
            ["Air-Gapped Bootable ISO", "Evet (nornia-spark-ha.iso)", "Evet (nornia-midgard-ha.iso)", "Evet (nornia-odin-ha.iso)"],
            ["Minimum Kaynak", "4 vCPU / 8 GB RAM", "6 vCPU / 12 GB RAM", "7–13 Sunucu (24–96 vCPU)"]
          ]
        }
      }
    ],
    troubleshooting: [
      {
        problem: "Lokasyon A'da PG-A1 durdu ama Geo-DNS trafiği Lokasyon B'ye kaydırdı",
        cause: "Geo-DNS sağlık kontrolü eşik süresi (örn. 10 sn), Patroni içi-DC failover süresinden (15 sn) daha kısa ayarlanmıştır.",
        solution: "Geo-DNS sağlık kontrolünü 10 sn aralıkla 3 ardışık başarısızlık (30 sn) olarak ayarlayın; böylece içi-DC PG-A1 -> PG-A2 geçişi (15 sn) sırasında gereksiz coğrafi geçiş tetiklenmez."
      },
      {
        problem: "Ayrıştırılmış Asterisk'te kaydedilen çağrı Web Panelde dinlenemiyor",
        cause: "`nornia_media_agent.py` MinIO S3'e erişemiyor veya App sunucularında `S3_ENDPOINT` eksik tanımlanmıştır.",
        solution: "Media düğümünde `docker logs odin-asterisk-* | grep MediaAgent` ile yükleme logunu, App düğümünde `S3_ENDPOINT`, `S3_ACCESS_KEY` ve `S3_SECRET_KEY` eşleşmesini kontrol edin."
      },
      {
        problem: "Keepalived VIP iki Edge makinesinde aynı anda aktif (VRRP Split)",
        cause: "Bulut veya switch katmanında VRRP multicast (224.0.0.18 / proto 112) engelleniyordur.",
        solution: "`/etc/keepalived/keepalived.conf` içinde `unicast_src_ip` ve `unicast_peer` bloklarını ekleyerek Keepalived'ı unicast moda geçirin."
      }
    ],
    relatedPages: ["nornia-spark", "nornia-midgard", "cok-subeli-santral-federation"],
    relatedApis: ["GET /api/system/ready", "POST /api/federation/heartbeat", "GET /api/recordings/{filename}"]
  }
];
