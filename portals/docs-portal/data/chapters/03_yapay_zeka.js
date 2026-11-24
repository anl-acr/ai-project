export const CHAPTERS_YAPAY_ZEKA = [
  {
    id: "ai-konfigurasyon-asistani",
    number: "09",
    groupId: "yapay-zeka",
    category: "Yapay Zeka & Bilgi",
    title: "AI Konfigürasyon Asistanı (Doğal Dil ile Santral Yönetimi)",
    shortTitle: "AI Konfigürasyon Asistanı",
    menuPath: "Yapay Zeka & Bilgi → AI Konfigürasyon Asistanı",
    pbxRoute: "/?tab=ai-konfigurasyon-asistani",
    permissions: ["ai_config_assistant:read", "ai_config_assistant:write"],
    badge: "Doğal Dil • Sesli Dikte • Undo",
    readMinutes: 8,
    summary:
      "Yöneticilerin karmaşık menülerde dolaşmadan Türkçe doğal dilde yazarak veya mikrofonla konuşarak (sesli dikte) santral yapılandırması yapmasını sağlayan akıllı asistandır. Her değişiklik önce önizleme planı olarak sunulur, otomatik geri yükleme noktası (Snapshot) alınır ve tek tıkla geri alınabilir.",
    screenshots: [
      {
        src: "/screenshots/07-ai-config-assistant.jpg",
        caption: "AI Konfigürasyon Asistanı — Doğal dil komut kutusu, önizleme planı ve tek tıkla geri alma geçmişi",
        routeHint: "Yapay Zeka & Bilgi → AI Konfigürasyon Asistanı"
      }
    ],
    fieldTable: [
      { field: "Komut Kutusu & Sesli Dikte", type: "Metin / Mikrofon", defaultVal: "Türkçe NLP", required: true, description: "Örn: '1030-1035 arası 6 adet satış temsilcisi aç, hepsini 2000 Satış kuyruğuna ekle ve ses kaydını aktif et.'" },
      { field: "Önizleme Değişiklik Planı (Dry-Run)", type: "Yapısal Diff", defaultVal: "Zorunlu Onay", required: true, description: "Hiçbir değişiklik yönetici onayı olmadan uygulanmaz; eklenecek/güncellenecek her kayıt tek tek listelenir." },
      { field: "Otomatik Snapshot & Tek Tıkla Geri Al", type: "Rollback Engine", defaultVal: "Her uygulamada", required: false, description: "Plan uygulanmadan önce mevcut santral yapılandırması anlık kopyalanır; geçmiş listesinden tek tıkla eski hale dönülebilir." }
    ],
    sections: [
      {
        heading: "1. Güvenli 3 Aşamalı Uygulama Akışı (Planla → Onayla → Geri Al)",
        body: "AI Konfigürasyon Asistanı üretim santrallerinde sıfır risk prensibiyle çalışır.",
        steps: [
          "İstediğiniz santral değişikliğini Türkçe olarak yazın veya mikrofon ikonuna basarak söyleyin.",
          "'Plan Oluştur' butonuna basın; sistem arka planda /api/ai-config-assistant/plan ile tam etki analizini çıkarır.",
          "Ekrandaki değişiklik kartlarını inceleyip 'Planı Uygula'ya basın. Sistem otomatik Snapshot alır, veritabanı ve Asterisk dosyalarını senkronize eder."
        ],
        codeBlock: {
          title: "Örnek Doğal Dil Komutları",
          lang: "text",
          code: `• "Satış departmanı için 2010 numaralı yeni ACD kuyruğu oluştur, çalma stratejisi rrmemory olsun ve 1001, 1002 dahililerini ekle."
• "05320001122 numarasını spam gerekçesiyle kara listeye ekle."
• "Hafta içi 09:00-18:00 dışındaki tüm aramaları AI Karşılama asistanına yönlendir."
• "Tüm kullanıcıların dış arama CallerID numarasını 908503607390 olarak güncelle."`
        }
      }
    ],
    troubleshooting: [
      { problem: "Asistan plan üretemiyor veya API anahtarı hatası veriyor", cause: "Sistem Ayarları → Yapay Zeka API Ayarları altında geçerli bir LLM sağlayıcı anahtarı girilmemiş.", solution: "Gemini veya OpenAI API anahtarınızı tanımlayıp bağlantıyı doğrulayın." }
    ],
    relatedPages: ["ai-temsilcileri", "toplu-konfigurasyon", "bakim-yedekleme-ve-kayit-saklama"],
    relatedApis: ["POST /api/ai-config-assistant/plan", "POST /api/ai-config-assistant/apply", "POST /api/ai-config-assistant/undo/{snapshot_id}"]
  },
  {
    id: "ai-temsilcileri",
    number: "10",
    groupId: "yapay-zeka",
    category: "Yapay Zeka & Bilgi",
    title: "AI Temsilcileri & Görsel Senaryo Editörü",
    shortTitle: "AI Temsilcileri",
    menuPath: "Yapay Zeka & Bilgi → AI Temsilcileri",
    pbxRoute: "/?tab=yapay-zeka-temsilcileri",
    permissions: ["ai_agents:read", "ai_agents:write", "ai_agents:delete"],
    badge: "Gemini Live • AudioSocket • 7 Sekme",
    readMinutes: 14,
    summary:
      "Gerçek telefon çağrılarını milisaniye gecikmeyle (AudioSocket TCP 9092 + Gemini Multimodal Live / OpenAI Realtime / ElevenLabs) doğal insan sesiyle karşılayan, isimle dahili transferi yapan, randevu alan, CRM sorgulayan ve sürükle-bırak Görsel Senaryo Editörü ile yönetilen Yapay Zeka Sesli Asistanları modülüdür.",
    screenshots: [
      {
        src: "/screenshots/08-ai-agents.jpg",
        caption: "AI Temsilcileri — Sesli asistan listesi, 7 sekmeli detaylı yapılandırma ve Görsel Senaryo Editörü",
        routeHint: "Yapay Zeka & Bilgi → AI Temsilcileri"
      }
    ],
    fieldTable: [
      { field: "Sekme 1: Kimlik & Sistem Talimatı (general_prompt)", type: "Prompt + Rol", defaultVal: "Türkçe Kurumsal", required: true, description: "Asistanın adı, karşılama cümlesi, üslubu ve davranış kuralları. Görsel Senaryo kaydedildiğinde otomatik derlenerek (compile_agent_scenario_to_instruction) talimata eklenir." },
      { field: "Sekme 2: Ses Motoru — STT & TTS (voice_tts)", type: "Provider Seçimi", defaultVal: "Google Gemini Native", required: true, description: "STT: Google Gemini Native, Deepgram Nova-2, OpenAI Whisper, ElevenLabs Scribe. TTS: Gemini Dahili Ses, ElevenLabs (ses klonlama dahil), OpenAI TTS (Alloy/Nova/Shimmer)." },
      { field: "Sekme 3: Arka Plan Sesi & Test Stüdyosu (ambient_test)", type: "Akustik Ambiyans", defaultVal: "Kapalı / Call Center", required: false, description: "Doğallık için gerçekçi arka plan sesleri: call_center (operasyon uğultusu), office_keyboard, cafe_lounge, soft_rain, analog_warmth. Canlı mikrofon test stüdyosu içerir." },
      { field: "Sekme 4: Söz Kesme & Dinleme — VAD (barge_in_vad)", type: "Barge-In / Eşik", defaultVal: "Echo Suppression < 150", required: false, description: "Müşteri araya girdiğinde AI'ın susma hassasiyeti. Düşük genlikli ortam yankısının (avg_amplitude < 150) AI sesini yanlışlıkla kesmesini önleyen akıllı bastırma motoru içerir." },
      { field: "Sekme 5: Zeka Motoru — LLM & RAG (llm_brain)", type: "Model + Bilgi Bankası", defaultVal: "Gemini Live / GPT-4o", required: true, description: "LLM sağlayıcı seçimi (Google Gemini, ElevenLabs Conversational, OpenAI GPT-4o, Anthropic Claude 3.5, Groq) ve Bilgi Bankası (RAG) bağlama." },
      { field: "Sekme 6: Konuşma Doğallığı & Güvenlik (behavior_guardrails)", type: "Guardrails", defaultVal: "Aktif", required: false, description: "Yasaklı kelimeler, küfür/suistimal durumunda nazik sonlandırma ([ACTION: HANGUP]), maksimum konuşma süresi ve konu dışı koruma." },
      { field: "Sekme 7: Müşteri CRM Entegrasyonu (crm_integration)", type: "Async Tool Engine", defaultVal: "Opsiyonel", required: false, description: "Evrensel API Sihirbazı ile tanımlanan dış REST servislerini konuşma kesilmeden arka planda (Async Tool Execution — WebSocket 1007 çökmesi olmadan) sorgulayıp müşteriye sesli aktarır." },
      { field: "Görsel Senaryo Editörü & AI Asistan", type: "Node-Based Akış", defaultVal: "Sürükle-Bırak", required: false, description: "Karşılama, Niyet Dallanması, KVKK Onayı, Form Veri Toplama, İsimle Dahili Transferi (directory_lookup), Kuyruk Aktarımı ve Kapanış düğümleri. Doğal dil modalı ile tek paragraftan akış üretebilir." }
    ],
    sections: [
      {
        heading: "1. İsimle Dahili / Personel Transferi (Directory Lookup)",
        body: "Görsel Senaryo Editörüne 'İsimle Dahili / Personel Transferi (directory_lookup)' düğümü eklendiğinde Nornia, santraldeki tüm aktif kullanıcı adlarını ve dahili numaralarını (SystemUser) dinamik olarak AI sistem talimatına enjekte eder. Müşteri 'Anıl Bey ile görüşebilir miyim?' dediğinde AI doğrudan `[ACTION: TRANSFER:1000]` üretir ve Asterisk AMI çağrıyı 1000 dahilisine aktarır."
      },
      {
        heading: "2. Görsel Senaryo Akışı ve Doğal Dil Sihirbazı",
        body: "Görsel Senaryo Editöründeki 'AI ile Senaryo Oluştur' butonuna tıklayıp işletmenizin çağrı akışını düz Türkçe yazmanız yeterlidir; backend (/api/settings/ai-agents/generate-scenario) cümleleri, koşulları ('eğer/ise'), dahili numaralarını ve kapanış adımlarını otomatik düğümlere ve bağlantı oklarına dönüştürür.",
        codeBlock: {
          title: "AI Sesli Asistan Dahili Aksiyon Etiketleri (AudioSocket Engine)",
          lang: "text",
          code: `[ACTION: HANGUP]                        -> Nazik vedalaşma sonrası çağrıyı kapatır
[ACTION: TRANSFER:1000]                 -> Çağrıyı 1000 dahilisine aktarır (AMI Redirect)
[ACTION: TRANSFER:2000]                 -> Çağrıyı 2000 ACD kuyruğuna aktarır
[ACTION: TOOL_CALL name="order_lookup" order_no="45921"] -> Arka planda ERP/CRM API çağırır`
        }
      }
    ],
    troubleshooting: [
      { problem: "AI konuşurken kendi yankısı yüzünden cümle ortasında susuyor", cause: "Karşı tarafın hoparlöründen gelen yankı Barge-In VAD'ı tetikliyor.", solution: "Sekme 4 (Söz Kesme & VAD) içinde Yankı Bastırma / Minimum Ses Genliği eşiğini yükseltin (önerilen: 150-220)." },
      { problem: "AI isimle transfer yaparken yanlış dahiliye aktarıyor", cause: "Kullanıcı kartında Ad Soyad alanı eksik veya senaryoda directory_lookup düğümü ekli değil.", solution: "Kullanıcı kartlarının tam ad içerdiğini doğrulayın ve Görsel Senaryo'ya 'İsimle Dahili Transferi' düğümünü ekleyip kaydedin." }
    ],
    relatedPages: ["bilgi-bankasi-rag", "yapay-zeka-ayar-ve-yonlendirme", "arama-akis-yonetimi"],
    relatedApis: ["GET /api/v1/ai-agents", "POST /api/v1/ai-calls/originate"]
  },
  {
    id: "bilgi-bankasi-rag",
    number: "11",
    groupId: "yapay-zeka",
    category: "Yapay Zeka & Bilgi",
    title: "Bilgi Bankası (RAG — Doküman & Web Tarama)",
    shortTitle: "Bilgi Bankası (RAG)",
    menuPath: "Yapay Zeka & Bilgi → Bilgi Bankası (RAG)",
    pbxRoute: "/?tab=bilgi-bankasi",
    permissions: ["rag_kb:read", "rag_kb:write", "rag_kb:delete"],
    badge: "PDF • Web Crawler • Medya",
    readMinutes: 8,
    summary:
      "Yapay Zeka Sesli Asistanları ve Omnichannel (WhatsApp/Telegram/E-Posta) botlarının şirketinizin ürün, fiyat, garanti, şube ve prosedür sorularına %100 doğru ve halüsinasyonsuz yanıt vermesini sağlayan kurumsal Bilgi Bankası (Retrieval-Augmented Generation) modülüdür.",
    screenshots: [
      {
        src: "/screenshots/09-rag-kb.jpg",
        caption: "Bilgi Bankası (RAG) — PDF/Doküman yükleme, Web Sitesi Tarayıcı, Manuel SSS ve Canlı Sorgu Testi",
        routeHint: "Yapay Zeka & Bilgi → Bilgi Bankası (RAG)"
      }
    ],
    fieldTable: [
      { field: "PDF / Doküman Yükleme", type: "Dosya (.pdf, .txt, .docx)", defaultVal: "Çoklu dosya", required: false, description: "Kataloglar, fiyat listeleri, sözleşme ve SSS belgelerini otomatik metne çevirip anlamsal parçalara (document_chunks) böler." },
      { field: "Web Sitesi Tarama (Web Crawler)", type: "URL + Derinlik", defaultVal: "verify=False SSL uyumlu", required: false, description: "Kurumsal web sitenizi (self-signed SSL dahil) tarar, navigasyon gürültüsünü temizleyerek bilgi bankasına indeksler." },
      { field: "Manuel Bilgi & SSS Kartı", type: "Başlık + Zengin Metin", defaultVal: "Anında aktif", required: false, description: "Anlık kampanya, çalışma saati değişikliği veya kritik şirket kurallarını saniyeler içinde eklemenizi sağlar." },
      { field: "Medya Kütüphanesi (RAG Media)", type: "Görsel / PDF Katalog", defaultVal: "WhatsApp/Chat uyumlu", required: false, description: "Müşteri 'katalog gönderir misiniz?' dediğinde AI'ın WhatsApp/Telegram üzerinden otomatik paylaşabileceği broşür ve görseller." },
      { field: "Anlamsal Arama Testi", type: "Canlı Sorgu", defaultVal: "/api/rag/search", required: false, description: "Örnek bir müşteri sorusu yazıp AI'ın hangi bilgi parçalarını çektiğini anında doğrulayabilirsiniz." }
    ],
    sections: [
      {
        heading: "1. Gemini Live Sesli Çağrılarla Sıfır-Gecikmeli RAG Entegrasyonu",
        body: "Nornia, canlı sesli çağrılarda WebSocket 1007 protokol çökmesini ve konuşma duraksamalarını sıfırlamak için aktif tenant'a ait optimize edilmiş bilgi bankası bağlamını çağrı başlangıcında doğrudan Gemini Live systemInstruction katmanına enjekte eder. Böylece AI müşteri sorusunu duyduğu anda bekleme yapmadan doğru şirket bilgisiyle yanıt verir."
      },
      {
        heading: "2. Yüksek Doğruluk İçin İçerik Hazırlama Kuralları",
        body: "RAG kalitesi yüklenen metnin yapısıyla doğrudan ilişkilidir.",
        steps: [
          "Fiyat ve paket bilgilerini düz paragraf yerine 'Paket Adı: X | Fiyat: Y TL | Kapsam: Z' biçiminde net yazın.",
          "Güncelliğini yitiren eski fiyat listesi PDF'lerini mutlaka kaynak listesinden silin ki AI çelişkili bilgi vermesin.",
          "Her yükleme sonrası 'Sorgu Testi' kutusunda 3-4 kritik müşteri sorusu deneyerek doğru parçanın döndüğünü teyit edin."
        ]
      }
    ],
    troubleshooting: [
      { problem: "Web sitesi taraması boş içerik döndürüyor", cause: "Hedef site tamamen istemci taraflı (SPA/JavaScript) render ediliyor veya bot koruması (Cloudflare) arkasında.", solution: "İlgili sayfaların metnini PDF olarak kaydedip yükleyin veya Manuel SSS kartı olarak ekleyin." }
    ],
    relatedPages: ["ai-temsilcileri", "ortak-gelen-kutusu", "rapor-duygu-analizi"],
    relatedApis: ["GET /api/rag/sources", "POST /api/rag/crawl", "POST /api/rag/manual", "GET /api/rag/search"]
  },
  {
    id: "kural-ve-senaryo-editoru",
    number: "12",
    groupId: "yapay-zeka",
    category: "Yapay Zeka & Bilgi",
    title: "Kural & Senaryo Editörü (AI Davranış ve Yasaklı Kelimeler)",
    shortTitle: "Kural & Senaryo Editörü",
    menuPath: "Yapay Zeka & Bilgi → Kural & Senaryo Editörü",
    pbxRoute: "/?tab=kural-editoru",
    permissions: ["rule_editor:read", "rule_editor:write", "rule_editor:delete"],
    badge: "Guardrails • Eskalasyon",
    readMinutes: 7,
    summary:
      "Yapay Zeka asistanlarının ve temsilcilerin tüm sesli/yazılı görüşmelerde uyması gereken kurumsal iş kurallarını, kesinlikle söylenmemesi gereken yasaklı kelimeleri (block_words) ve belirli anahtar kelimeler duyulduğunda tetiklenecek otomatik eskalasyon/transfer aksiyonlarını tanımladığınız politika merkezidir.",
    screenshots: [
      {
        src: "/screenshots/10-rule-editor.jpg",
        caption: "Kural & Senaryo Editörü — İş kuralları, yasaklı kelime filtresi ve otomatik eskalasyon koşulları",
        routeHint: "Yapay Zeka & Bilgi → Kural & Senaryo Editörü"
      }
    ],
    fieldTable: [
      { field: "Kural Adı & Öncelik", type: "Metin + Sayı", defaultVal: "Öncelik 1-100", required: true, description: "Kuralların değerlendirilme sırasını belirler." },
      { field: "Tetikleyici Koşul (Trigger)", type: "Anahtar Kelime / Niyet / Duygu", defaultVal: "İçerir (Contains)", required: true, description: "Örn: 'iptal', 'avukat', 'Tüketici Hakem Heyeti', 'yönetici' kelimeleri geçtiğinde." },
      { field: "Aksiyon (Action)", type: "Transfer / Uyarı / Kapat / Etiket", defaultVal: "Süpervizör Alarmı", required: true, description: "Kriz alarmı üretme, doğrudan İkna/VIP kuyruğuna aktarma veya KVKK ihlal günlüğüne kaydetme." },
      { field: "Yasaklı Kelimeler (Block Words)", type: "Kelime Listesi", defaultVal: "Tenant Bazlı", required: false, description: "AI'ın asla telaffuz etmeyeceği ve müşteri söylediğinde güvenlik/suistimal sayacını artıracak kelimeler." }
    ],
    sections: [
      {
        heading: "1. Kriz Eskalasyonu ve Uyumluluk (Compliance) Denetimi",
        body: "Burada tanımlanan her kural yalnızca canlı AI görüşmelerinde değil, aynı zamanda çağrı sonrası Senaryo Sadakati (Compliance) ve Müşteri Çile Noktaları raporlarında otomatik denetim ölçütü olarak kullanılır. Örneğin 'temsilci KVKK aydınlatmasını okumadan işlem yapmamalı' kuralı tüm görüşmelerde otomatik kontrol edilir."
      }
    ],
    troubleshooting: [
      { problem: "Eklediğim yeni kural aktif görüşmede tetiklenmiyor", cause: "Kural durumu 'Pasif' bırakılmış veya kaydedildikten sonra yeni çağrı beklenmemiş olabilir.", solution: "Kuralın sağındaki aktiflik anahtarının açık olduğunu doğrulayın; kurallar yeni başlayan çağrılarda anında devreye girer." }
    ],
    relatedPages: ["ai-temsilcileri", "rapor-duygu-analizi", "canli-cagri-izleme"],
    relatedApis: ["GET /api/v1/ai-agents", "GET /api/workspace/crisis-alerts"]
  }
];
