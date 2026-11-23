export const EDIT_GUIDES_PART5 = {
  "santral-entegrasyonu-ve-nat": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Asterisk Santral Entegrasyonu (AMI, WSS & NAS Yolu)",
        badge: "Sistem Ayarları → Santral & Ağ",
        description: "FastAPI backend ile Asterisk 20 çekirdeği arasındaki temel köprü ayarları.",
        fields: [
          { name: "AMI Host, Port, Kullanıcı & Şifre", type: "127.0.0.1 : 5038", defaultVal: "ai_backend_user", required: true, effect: "Canlı çağrı listeleme, transfer, ChanSpy dinleme, Click-to-Call ve SIP Presence LED olaylarının tümü AMI üzerinden akar." },
          { name: "WebRTC (WSS) URL & NAS Kayıt Dizin Yolu", type: "wss://... + Dosya Yolu", defaultVal: "Otomatik FQDN", required: false, effect: "Dahili WebPhone'un bağlanacağı WSS adresi ve ses kayıtlarının yerel/mount kök dizini." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2: NAT ve Dış IP (Extern IP) Ayarları",
        badge: "PJSIP Transport NAT",
        description: "NAT arkasındaki sunucularda tüm PJSIP transport'larına dinamik dış IP enjeksiyonu.",
        fields: [
          { name: "NAT Aktif & Dış IP (External IP)", type: "Toggle + IPv4 + Otomatik Algıla", defaultVal: "Aktif", required: false, effect: "pjsip_custom.conf içindeki [transport-udp], [transport-tcp], [transport-ws] ve [transport-wss] bölümlerine external_signaling_address ve external_media_address yazar." },
          { name: "Yerel Ağ Aralıkları (Local Nets)", type: "CIDR Listesi", defaultVal: "192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12", required: false, effect: "İç ağ ve VPN kullanıcılarının ses paketlerini dış IP'ye dolandırmadan doğrudan LAN üzerinden geçirir." }
        ]
      },
      {
        tabTitle: "Alt Ekran 3: Numara Planı, Acil Durumlar & Tüm Özellik/Prefix Kodları",
        badge: "Numara Planı Tam Döküm",
        description: "Santralin tüm numara aralıklarını, kısıtlamasız acil çıkışını ve *XX tuşlama kodlarını tek yerden özelleştirir.",
        fields: [
          { name: "Acil Durum Kısa Numaraları & Öncelikli Acil Çıkış Trunk", type: "112, 110, 155 + Trunk", defaultVal: "Kısıtlamasız Çıkış", required: true, effect: "Abone grubu 'Sadece Dahili' olsa bile tüm telefonlar 112 acil hattını anında arayabilir." },
          { name: "5 Numara Aralığı (Başlangıç–Bitiş)", type: "Dahili / Kuyruk / Konferans / Hızlı Arama / CallFlow", defaultVal: "1000-1999 / 2000+ / 3000+", required: true, effect: "Yeni nesne oluşturulurken çakışmayı önler ve otomatik sıradaki boş numarayı önerir." },
          { name: "Gelişmiş Santral Özellik Kodları", type: "*97 (Voicemail), *9 (Kayıt Duraklat), *70 (Profil), *74 (Patron-Sekreter), *75/*76 (Hot-Desk), *11 (Call Flip)", defaultVal: "Özelleştirilebilir", required: true, effect: "Tüm masa ve yazılım telefonlarında çalışan standart kurumsal kısa kodlar." },
          { name: "Yönlendirme, ChanSpy (Dinle/Fısılda/Araya Gir) & Çağrı Toplama Prefix'leri", type: "Grup İçi (*8) / Grup Dışı (**) / ChanSpy", defaultVal: "Standart Prefix", required: false, effect: "Fiziksel masa telefonundan tuşlama ile yönlendirme, çağrı çekme ve süpervizör dinleme kodlarını tanımlar." }
        ]
      }
    ]
  },
  "sunucu-ag-ve-nornia-connect": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Sunucu Ağ (Network) Yönetimi — 4 Sekme & 60 sn Güvenli Rollback",
        badge: "Linux Netplan GUI",
        description: "Arayüzler, statik MPLS/SIP rotaları, DNS/hosts ve SSH kurtarma araçları.",
        fields: [
          { name: "Sekme 1: Ağ Arayüzleri (NIC) & IP", type: "DHCP / Statik IPv4 CIDR + Gateway", defaultVal: "60 sn Onay Korumalı", required: true, effect: "Yeni IP uygulandığında 60 saniye içinde 'Onayla'ya basılmazsa sunucu kendini kaybetmemek için otomatik eski IP'ye geri döner." },
          { name: "Sekme 2: Statik Rotalar (SIP / MPLS)", type: "Hedef Subnet + Gateway + NIC", defaultVal: "Kalıcı Netplan", required: false, effect: "Operatör Metro Ethernet SBC bloklarına veya uzak şube VPN alt ağlarına kalıcı yönlendirme ekler." },
          { name: "Sekme 3: DNS, Hostname & /etc/hosts", type: "DNS Sunucuları + Yerel Host Eşleme", defaultVal: "8.8.8.8 / 1.1.1.1", required: false, effect: "Şirket içi LDAP/CRM sunucu adlarını yerel hosts tablosuna eklemenizi sağlar." },
          { name: "Sekme 4: Yedekler & Konsol Kurtarma Scripti", type: "Netplan Yedek + Kurtarma", defaultVal: "Otomatik Yedek", required: false, effect: "Her ağ değişikliğinden önceki çalışan Netplan yapılandırmasını saklar." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2–3: Nornia Connect (Bulut Köprüsü) & Sunucu Web SSH Terminali",
        badge: "Sıfır-Port & Web SSH",
        description: "Port açmadan uzak erişim tüneli ve tarayıcı içi güvenli SSH konsolu.",
        fields: [
          { name: "Merkez Hub Adresi, Kilitli Alt Alan Adı & Kilidi Sorgula", type: "connect.nornia.com.tr + <ad>.nornia.com.tr", defaultVal: "Merkez Tescilli", required: true, effect: "Web/Mobil HTTPS, WebRTC WSS (/ras-sip-ws) ve WireGuard SIP/RTP Edge (5060/5061/5160) adreslerini tek ekranda verir ve tüneli yeniden başlatır." },
          { name: "WebRTC Ses Rölesi (TURN Relay)", type: "Otomatik / Özel TURN", defaultVal: "Aktif", required: false, effect: "Sıkı firewall arkasındaki uzak WebPhone kullanıcılarında medya akışını garanti eder." },
          { name: "Sunucu Web SSH Terminali (xterm.js)", type: "Tam İnteraktif Linux Konsolu", defaultVal: "Yetki: server_ssh:access", required: false, effect: "Asterisk CLI (`asterisk -rvvv`), `pm2 logs` ve sistem bakım komutlarını tarayıcıdan çalıştırır." }
        ]
      }
    ]
  },
  "cok-subeli-santral-federation": {
    editFormSections: [
      {
        tabTitle: "Multi-Site Federation (Hub/Edge), Otoprovizyon Şablon Editörü & SSL Sertifikaları",
        badge: "3 Altyapı Alt Ekranı",
        description: "Dağıtık şube mimarisi, IP telefon şablon özelleştirme ve TLS/WSS sertifika yükleme.",
        fields: [
          { name: "Multi-Site: Rol (Standalone / Hub / Edge) & Medya/SRST Politikası", type: "active_local / srst_failover", defaultVal: "Standalone", required: true, effect: "Şube santrallerini tek merkezden yönetir, şube içi sesi yerel tutar ve WAN koparsa şubenin kendi dış hattından çalışmasını (SRST) sağlar." },
          { name: "Şube Ekle / Push Config / Asterisk Önizleme", type: "Site Kodu + Dahili Bloğu + Push", defaultVal: "Delta Senkron", required: false, effect: "Merkezden tüm şubelere tek tıkla konfigürasyon iter ve canlı heartbeat sağlığını izler." },
          { name: "Otoprovizyon Şablonları (.CFG / .XML)", type: "Şablon Adı + Marka + Model + Kod Editörü", defaultVal: "Hazır Kurumsal Şablonlar", required: false, effect: "Yealink/Fanvil/Grandstream/Cisco telefonların dil, saat, logo ve gelişmiş SIP parametrelerini {{degisken}} yapısıyla özelleştirir." },
          { name: "SSL Sertifikaları (Nginx 443 + Asterisk WSS 8089)", type: "fullchain.pem + privkey.pem", defaultVal: "Otomatik asterisk.pem (644)", required: false, effect: "Yüklenen kurumsal SSL'i hem web arayüzüne hem Asterisk WSS TLS katmanına tek tıkla uygular." }
        ]
      }
    ]
  },
  "roller-kvkk-ve-ldap": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Roller (RBAC) — Modül & Temsilci Paneli Alt Yetki Matrisi",
        badge: "Granüler Yetki",
        description: "Her rol için okuma/yazma/silme ve Temsilci Çağrı Paneli'ndeki 25+ ince yetkinin tam kontrolü.",
        fields: [
          { name: "Modül Yetkileri (:read / :write / :delete / :access)", type: "60+ Sistem Modülü", defaultVal: "Rol Bazlı", required: true, effect: "Kullanıcının sol menüde hangi ekranları göreceğini ve Ekle/Düzenle/Sil butonlarının açılıp kapanacağını belirler." },
          { name: "Canlı Müdahale & Süpervizör Yetkileri", type: "call_monitor:listen/whisper/barge + supervisor:agent_status/agent_logout/scope_filter", defaultVal: "Süpervizör Rolü", required: false, effect: "Kimin sessiz dinleyebileceğini, sufle verebileceğini, mola değiştirebileceğini ve hangi kuyruklarla sınırlı olduğunu belirler." },
          { name: "Temsilci Çağrı Paneli Alt Yetkileri (25+ İnce Kontrol)", type: "tab_dashboard..tab_deskphone + listen_records + view_transcripts + transfer + conference + reject + call_flip + cti_screen_pop + ai_note_assistant + live_translation + voice_interpreter + agents_status/duration/call_counts/login_logout", defaultVal: "Temsilci Rolü", required: false, effect: "Örn. temsilcinin sadece kendi durumunu görmesini ama diğer temsilcilerin çağrı adetlerini görmemesini tek kutucukla ayarlayabilirsiniz." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2–5: KVKK Onay Yönetimi, Active Directory (LDAP), Lokasyon/Departman & Molalar",
        badge: "Organizasyon & Uyumluluk",
        description: "Kurumsal hukuk, dizin entegrasyonu ve insan kaynakları tanımları.",
        fields: [
          { name: "KVKK & Gizlilik Politikası (kvkk-consent)", type: "Metin Sürümü + Zorunlu Onay + Hukuki Denetim Tablosu (Onayladı/Bekliyor/Eski Sürüm)", defaultVal: "Değiştirilemez Audit", required: false, effect: "Politika metni güncellendiğinde tüm kullanıcılardan yeniden onay alır ve IP/tarih/hash kaydını saklar." },
          { name: "Active Directory / LDAP (active-directory)", type: "Microsoft AD / Azure Entra ID / OpenLDAP / FreeIPA + Bağlantı Testi + Senkronize Et", defaultVal: "LDAP/LDAPS", required: false, effect: "Şirket dizinindeki kullanıcıları otomatik Nornia'ya aktarır ve kurumsal şifre ile giriş sağlar." },
          { name: "Lokasyon & Departmanlar + Mola Tanımları", type: "Şube/Departman Ağacı + Mola Adı/Süre Limiti/Renk", defaultVal: "Yemek/İhtiyaç/Eğitim", required: false, effect: "Raporlama, Wallboard ve Toplu Konfigürasyon için kurumsal organizasyon temelini oluşturur." }
        ]
      }
    ]
  },
  "musteri-ve-lisans-yonetimi": {
    editFormSections: [
      {
        tabTitle: "Müşteri (Tenant) Ekle/Düzenle & Çevrimdışı/Çevrimiçi Lisans Anahtarı Yükleme",
        badge: "Multi-Tenant & HW-ID",
        description: "Kiracı oluşturma, kota atama ve donanıma kilitli lisans yenileme detayları.",
        fields: [
          { name: "Müşteri / Firma Adı, Kod Adı (Slug) & Durum", type: "Metin + active/passive", defaultVal: "tenant-default", required: true, effect: "Her müşteri için 15 PostgreSQL tablosunda katı tenant_id izolasyonu sağlar." },
          { name: "Lisans Paketi, Bitiş Tarihi & İmzalı Lisans Anahtarı", type: "AIDA-{KOD}-{TARİH}-{HW8}-{SIG8}.KOTA", defaultVal: "HMAC-SHA256", required: true, effect: "Çevrimdışı veya çevrimiçi olarak yeni lisans anahtarı girildiğinde kullanıcı, eşzamanlı çağrı, AI ve modül kotaları kesintisiz güncellenir." }
        ]
      }
    ]
  },
  "yapay-zeka-ayar-ve-yonlendirme": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1–2: Yapay Zeka API Sağlayıcıları & AI Görev/Model Yönlendirme (12 Görev + Yerel Ollama)",
        badge: "AI Çekirdek & Maliyet",
        description: "Bulut API anahtarları ve arka plan AI görevlerini yerel Ollama / ekonomik modellere yönlendirme merkezi.",
        fields: [
          { name: "Yapay Zeka API Sağlayıcıları (ai-providers)", type: "Google Gemini / OpenAI / ElevenLabs / Deepgram / Anthropic / Groq", defaultVal: "Maskeli Güvenli Saklama", required: true, effect: "Her sağlayıcının anahtarı tek tıkla canlı test edilir ve tüm AI modüllerine dağıtılır." },
          { name: "Ollama / OpenAI-Uyumlu Yerel AI Sunucu Adresi & Bearer Token", type: "http://<ip>:11434 + Opsiyonel Token", defaultVal: "On-Premise KVKK", required: false, effect: "Hazır tek tık indirme önerileri (qwen2.5:1.5b 4GB RAM, qwen2.5:3b 8GB+ RAM, nomic-embed-text RAG) ve Ubuntu tek komut kurulum scripti sunar." },
          { name: "12 Arka Plan Görevi İçin Ayrı Model Seçimi", type: "Transkript, Özet/Duygu, Agent Notu, Sesli QA, Yazılı QA, RAG Embedding, Mobil Fısıltı, Senaryo Üretici, API Sihirbazı, Özel Rapor, AI Config Asistan, Anons TTS", defaultVal: "Görev Bazlı Bulut / Yerel", required: false, effect: "Her görevi ayrı modele atayarak token maliyetini %60+ düşürür ve KVKK verilerini yerel sunucuda tutar." },
          { name: "Whisper (STT) Çalışma Modu & Maks. CPU Çekirdek Sınırı", type: "Asterisk Ses Koruması", defaultVal: "CPU Limitli", required: false, effect: "Yerel Whisper çalışırken Asterisk canlı ses paketlerinin kesilmemesi için CPU çekirdek sınırını korur." }
        ]
      },
      {
        tabTitle: "Alt Ekran 3–8: Çağrı Kalite (QA), Dil Algılama, Duygu, AI Fısıldama, Ses Biyometrisi & ROI",
        badge: "6 Akıllı Analiz Ayarı",
        description: "Otomatik puanlama, çok dilli algılama, kriz eşikleri ve ses imzası doğrulama ayarları.",
        fields: [
          { name: "Çağrı Kalite Kontrol (QA) Soru Havuzu", type: "Soru + Kategori + Ağırlık Puanı (Toplam 100)", defaultVal: "Standart Şablon", required: false, effect: "AI Kalite Değerlendirme motorunun her görüşmeyi hangi kurumsal kriterlerle puanlayacağını belirler." },
          { name: "Otomatik Dil Algılama & Dinamik Duygu Yönetimi", type: "Dil Listesi + Negatif Öfke Eşiği + Acil Aksiyon", defaultVal: "TR/EN/DE/AR/RU", required: false, effect: "Müşterinin dilini otomatik tanır; yüksek öfke tespitinde Kriz Alarmı veya canlı temsilciye acil aktarım tetikler." },
          { name: "AI Fısıldama (Whisper) & Biyometrik Ses Analizi (Voiceprint)", type: "Aktiflik + Eşleşme Eşiği (%)", defaultVal: "%80 Eşik", required: false, effect: "Görüşmede temsilciye anlık RAG yanıtı fısıldar ve kayıtlı müşterileri ses imzasından otomatik doğrular." },
          { name: "ROI Rapor Ayarları", type: "Saatlik Temsilci Maliyeti & Çağrı Başı Maliyet", defaultVal: "TL / USD", required: false, effect: "AI vs. İnsan ROI raporundaki aylık tasarruf hesaplamasının finansal baz değerleridir." }
        ]
      }
    ]
  },
  "kanallar-crm-ve-dis-api": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Kanal Entegrasyonları (Çoklu WhatsApp + Telegram + Instagram/FB + SMTP/IMAP)",
        badge: "Omnichannel Kurulum",
        description: "Tüm yazılı iletişim kanallarının token, webhook, persona, mesai ve çoklu hat ayarları.",
        fields: [
          { name: "WhatsApp Cloud API & Çoklu WhatsApp Hatları", type: "Permanent Access Token + Phone Number ID + Verify Token + Hat Adı + Persona + Aktarım Kuyruğu + Mesai Saatleri", defaultVal: "Meta Graph v18.0", required: false, effect: "Birden fazla 0850/GSM WhatsApp hattı eklenebilir; her hatta özel AI personası (samimi/satis/destek/kurumsal), 3 butonlu karşılama menüsü ve mesai dışı yanıt tanımlanır." },
          { name: "Telegram Bot, Instagram Direct & Facebook Messenger", type: "Bot Token / Page Access Token", defaultVal: "Webhook Hazır", required: false, effect: "Gelen tüm sosyal medya mesajlarını Ortak Gelen Kutusu'na ve AI yanıt motoruna bağlar." },
          { name: "E-Posta Entegrasyonu (SMTP + IMAP 30 sn Poller)", type: "SMTP Host/Port + IMAP Host/Port + Aktarım Kuyruğu", defaultVal: "SSL/TLS 587/993", required: false, effect: "Gelen destek e-postalarını her 30 saniyede çekip sohbete dönüştürür, yanıtları kurumsal mailinizden gönderir." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2–4: Hazır CRM Marketi, Hızlı Cevaplar & Evrensel API Sihirbazı",
        badge: "CRM & AI Araçları",
        description: "Hazır CRM bağlayıcıları, temsilci şablonları ve AI'ın konuşurken dış ERP sorgulamasını sağlayan API sihirbazı.",
        fields: [
          { name: "Hazır CRM Marketi (Zoho, HubSpot, Salesforce, Bitrix24)", type: "API Token + Screen Pop + Otomatik CDR Log", defaultVal: "Canlı Test Butonlu", required: false, effect: "Çağrı anında CRM kartını açar ve kapanınca ses kaydı linkini müşteri aktivitesine işler." },
          { name: "Hızlı Cevaplar (Canned Responses)", type: "Kısa Kod (/iban) + Kategori + Zengin Metin", defaultVal: "Omnichannel", required: false, effect: "Temsilcilerin Ortak Gelen Kutusu'nda standart yanıtları tek tuşla göndermesini sağlar." },
          { name: "Evrensel API Sihirbazı (Universal API)", type: "Araç Adı + HTTP Metod/URL + Auth + Parametreler + AI Asistan + Canlı Test", defaultVal: "Async Tool Engine", required: false, effect: "Örn. 'Sipariş Sorgula' ERP API'nizi tanımlarsınız; AI Sesli Asistan konuşma kesilmeden arka planda sorgulayıp müşteriye kargo bilgisini okur." }
        ]
      },
      {
        tabTitle: "Alt Ekran 5–6: Kurumsal Dış API & Token Yönetimi + E-Mail & WhatsApp Sistem Bildirimleri",
        badge: "API Güvenlik & Alarmlar",
        description: "Dış yazılımlar için güvenli anahtar yönetimi ve 10+ kritik sistem olayı için anlık yönetici uyarıları.",
        fields: [
          { name: "Kurumsal Dış API Anahtarı Oluşturma", type: "Ad + İzinli IP (CIDR) + Geçerlilik Günü + Rate Limit (/dk) + Webhook URL/Secret + Modül Bazlı Scope (:read/:write/:delete)", defaultVal: "SHA-256 Tek Gösterim", required: false, effect: "api.nornia.com.tr uç noktalarına güvenli erişim verir; her çağrı Canlı Erişim Günlüğü'ne kaydedilir." },
          { name: "E-Mail & WhatsApp Sistem Bildirimleri (10+ Olay Tetikleyicisi)", type: "Alıcı E-Postalar + Alıcı WhatsApp Numaraları + Olay Anahtarları", defaultVal: "Çift Kanal Alarm", required: false, effect: "LLM kota dolumu, sunucu reboot, lisans yaklaşan bitiş/limit, servis hatası, %90+ disk/CPU/RAM, Fail2Ban/hatalı giriş, küfür/kara liste, Dialer bitişi ve kriz acil aktarımı olaylarında anında bildirim gönderir." }
        ]
      }
    ]
  },
  "bakim-yedekleme-ve-kayit-saklama": {
    editFormSections: [
      {
        tabTitle: "Alt Ekran 1: Kayıt & Saklama Sistemi (NAS/SMB/SFTP + Anahtar Kelime Dinamik Kayıt + Otomatik İmha)",
        badge: "Ses Kayıt & KVKK Saklama",
        description: "Ses kayıtlarının harici depolamaya aktarılması, dinamik kayıt ve disk/zaman bazlı otomatik temizlik kuralları.",
        fields: [
          { name: "Harici Depolama Protokolü (NFS / SMB / SFTP)", type: "mount_path / smb (Windows NAS) / sftp (SSH) + Test + Şimdi Eşitle", defaultVal: "Yerel Disk", required: false, effect: "Ses kayıtlarını yerel diskten şirket NAS'ına otomatik taşır veya yedekler; disk dolmasını engeller." },
          { name: "Dinamik Ses Kaydı (Anahtar Kelime Tetiklemeli)", type: "both (Herhangi Biri) / agent / caller + Anahtar Kelimeler", defaultVal: "Opsiyonel", required: false, effect: "Belirli kritik kelimeler söylendiğinde kaydı otomatik etiketler veya kalıcı korumaya alır." },
          { name: "Disk Doluluğuna Göre Silme, Zaman Aşımı (Gün) & Koruma Modu", type: "% Eşik / Gün Sayısı / Ömür Boyu Saklama + Güvenlik IP Otomatik Temizleme", defaultVal: "365 Gün", required: false, effect: "KVKK saklama süresi dolan kayıtları veya disk %90'a dayandığında en eski kayıtları güvenle temizler." }
        ]
      },
      {
        tabTitle: "Alt Ekran 2–5: Tarih/Saat/NTP, Sistem Yedekleme, Geri Yükleme Noktaları & Versiyon",
        badge: "Bakım & Felaket Kurtarma",
        description: "Zaman senkronizasyonu, tam yedekleme, anlık snapshot ve sürüm doğrulama.",
        fields: [
          { name: "Tarih, Saat Dilimi, NTP & Format/Dil", type: "NTP Sunucu / Manuel + 24/12 Saat + Türkçe/İngilizce", defaultVal: "Europe/Istanbul / 24 Saat", required: true, effect: "Sunucu saati ve arayüz varsayılan dil/format ayarlarını belirler." },
          { name: "Sistem Yedekleme & Geri Yükleme Noktaları (Restore Points)", type: "Tam Yedek (.tar.gz) + Hızlı Konfigürasyon Snapshot", defaultVal: "Tek Tık Geri Yükle", required: false, effect: "Tüm veritabanı, ayar ve anonsları yedekler; büyük değişiklikler öncesi saniyeler içinde geri dönülebilir nokta oluşturur." },
          { name: "Sistem Versiyonu & Değişiklik Günlüğü", type: "Sürüm Kodu Kopyala + Changelog", defaultVal: "v3.x.x", required: false, effect: "Yüklü sürümü ve tüm yeni özellik geçmişini görüntüler." }
        ]
      }
    ]
  },
  "sistem-panosu-ve-saglik": {
    editFormSections: [
      {
        tabTitle: "Donanım, Çekirdek Servisler & Ağ Kimliği Detay Kartları",
        badge: "Canlı Telemetri",
        description: "Sistem Panosu üzerindeki her sağlık göstergesinin normal eşikleri ve kırmızı durumda yapılacak ilk müdahale.",
        fields: [
          { name: "CPU / RAM / SSD Disk / Swap Göstergeleri", type: "Anlık % + Kapasite", defaultVal: "Normal: < %80", required: false, effect: "Disk %85'i geçerse ses kayıt arşivlemesi (NAS/SFTP) veya saklama süresi kontrol edilmelidir." },
          { name: "Servis Durumları (Asterisk, PostgreSQL, Backend, AudioSocket 9092, Connect)", type: "Yeşil / Kırmızı Durum", defaultVal: "5 sn yenileme", required: false, effect: "Herhangi bir çekirdek süreçte kesinti olursa anında bildirim ve teşhis sağlar." }
        ]
      }
    ]
  },
  "olay-gunlukleri": {
    editFormSections: [
      {
        tabTitle: "Log Filtreleme, İstemci IP Denetimi & Detay İnceleme",
        badge: "Kurumsal Audit",
        description: "Yönetici değişikliklerini, sistem hatalarını ve güvenlik olaylarını geriye dönük inceleme araçları.",
        fields: [
          { name: "Seviye, Kaynak, Kullanıcı & Tarih Filtreleri", type: "INFO / WARNING / ERROR / SECURITY / AUDIT", defaultVal: "Son Kayıtlar Üstte", required: false, effect: "Değişikliği yapan kullanıcı, gerçek X-Forwarded-For IP adresi ve önceki/yeni değer özetini listeler." }
        ]
      }
    ]
  },
  "sorun-inceleme-sip-debugger": {
    editFormSections: [
      {
        tabTitle: "Web sngrep Canlı Yakalama, Merdiven Diyagramı, PCAP Snapshot & Ping/Traceroute",
        badge: "VoIP Teşhis Stüdyosu",
        description: "SIP sinyalleşme hatalarını ve ağ gecikmelerini tarayıcıdan ayrılmadan çözme araçları.",
        fields: [
          { name: "Canlı Yakalama (Başlat / Durdur / Temizle) & Call-ID Filtresi", type: "UDP/TCP 5060, 5061, 5160, WSS 8089", defaultVal: "SipTrapper", required: false, effect: "Gelen/giden her INVITE/REGISTER oturumunu Call-ID bazında gruplar, merdiven (ladder) diyagramıyla çizer." },
          { name: "Ham SIP/SDP İnceleyici & .PCAP İndirme / Snapshot", type: "Wireshark Uyumlu .pcap", defaultVal: "Tek Tık İndir", required: false, effect: "Seçili çağrıyı veya tam oturum yakalamasını `.pcap` olarak indirip operatör mühendisleriyle paylaşmanızı sağlar." },
          { name: "Ağ Tanılama (Ping & Traceroute)", type: "Kayıtlı Trunklar / Özel IP", defaultVal: "ICMP / Hop Analizi", required: false, effect: "Operatör SBC sunucusuna gecikme (RTT), paket kaybı ve güzergah testi uygular." }
        ]
      }
    ]
  },
  "guvenlik-kalkani": {
    editFormSections: [
      {
        tabTitle: "Engellenen IP Yönetimi, Beyaz Liste (Whitelist) & Saldırı Koruma Politikaları",
        badge: "SIP & API Firewall",
        description: "Brute-force engelleme, güvenilir IP tanımlama ve toll-fraud kalkanı ayarları.",
        fields: [
          { name: "Engellenen IP'ler (Banned IPs) & Engel Kaldırma", type: "IPv4 + Neden + Tarih + Kaldır", defaultVal: "Otomatik Fail2Ban", required: false, effect: "Yanlışlıkla engellenen bir şube/ofis IP'sini tek tıkla açabilir veya saldırgan IP'yi kalıcı engelleyebilirsiniz." },
          { name: "Güvenilir IP Beyaz Listesi (Whitelist)", type: "IPv4 / CIDR", defaultVal: "Ofis + Operatör SBC", required: true, effect: "Beyaz listedeki IP'ler hiçbir hatalı denemede otomatik engellenmez." },
          { name: "Brute-Force Eşikleri, Toll-Fraud & Scanner Kalkanı", type: "SIP/API Eşik + GeoIP + User-Agent", defaultVal: "Aktif", required: false, effect: "sipvicious/friendly-scanner tarayıcılarını ve yetkisiz yüksek tarifeli ülke aramalarını otomatik bloklar." }
        ]
      }
    ]
  }
};
