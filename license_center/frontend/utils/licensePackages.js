export const STT_PROVIDER_LIST = [
  { id: "google", label: "Google Gemini STT (Dahili)" },
  { id: "deepgram", label: "Deepgram Nova-2 STT" },
  { id: "openai", label: "OpenAI Whisper STT" },
  { id: "elevenlabs", label: "ElevenLabs Scribe / ConvAI STT" }
];

export const TTS_PROVIDER_LIST = [
  { id: "google", label: "Google Gemini Dahili Ses Motoru" },
  { id: "elevenlabs", label: "ElevenLabs TTS (Kütüphane & Klon Ses)" },
  { id: "openai", label: "OpenAI TTS (Alloy / Nova / Shimmer)" }
];

export const LLM_PROVIDER_LIST = [
  { id: "google", label: "Google Gemini (Multimodal Live)" },
  { id: "elevenlabs", label: "ElevenLabs (Conversational AI)" },
  { id: "openai", label: "OpenAI (GPT-4o / Realtime)" },
  { id: "anthropic", label: "Anthropic (Claude 3.5 Sonnet)" },
  { id: "groq", label: "Groq (Fast LLM - Llama 3)" }
];

export const SANTRAL_MODULE_CATEGORIES = [
  {
    id: "pbx",
    title: "1. Temel IP Santral (PBX) & Haberleşme",
    items: [
      { id: "users", label: "Kullanıcılar & Dahililer" },
      { id: "trunks", label: "Dış Hat Tanımı (SIP Trunk)" },
      { id: "inbound_rules", label: "Gelen Arama Kuralları (DID)" },
      { id: "outbound_rules", label: "Giden Arama Kuralları" },
      { id: "announcements", label: "Anons Yönetimi" },
      { id: "call_flow", label: "Arama Akış Yönetimi (Görsel IVR)" },
      { id: "work_hours", label: "Mesai Saatleri & Resmi Tatiller" },
      { id: "contacts", label: "Rehber (Telefon Defteri)" },
      { id: "speed_dials", label: "Hızlı Arama (Speed Dial)" },
      { id: "blacklist", label: "Numara Engelleme (Blacklist)" },
      { id: "call_pickup_groups", label: "Çağrı Toplama Grupları (Pickup)" },
      { id: "subscriber_groups", label: "Abone Grupları (Ring Groups)" },
      { id: "conferences", label: "Konferans Odaları" },
      { id: "locations", label: "Lokasyon ve Departmanlar" },
      { id: "numbering_plan", label: "Numara Planı" },
      { id: "autoprovision", label: "Oto Provizyon (IP Telefon)" },
      { id: "autoprovision_templates", label: "Otoprovizyon Şablonları (Özel)" },
      { id: "bulk_config", label: "Toplu Konfigürasyon Merkezi" }
    ]
  },
  {
    id: "operations",
    title: "2. Çağrı Merkezi, Süpervizör & Operasyon",
    items: [
      { id: "call_panel", label: "Temsilci Çağrı Paneli (WebPhone)" },
      { id: "acd_queues", label: "ACD Kuyruk Yönetimi" },
      { id: "breaks", label: "Mola Tanımları & Durum Takibi" },
      { id: "wallboard", label: "Canlı İzleme Paneli (Wallboard)" },
      { id: "realtime_calls", label: "Gerçek Zamanlı Çağrı İzleme" },
      { id: "supervisor", label: "Süpervizör İşlemleri (Durum/Logout)" },
      { id: "call_monitor", label: "Dinleme / Sufle / Araya Girme" },
      { id: "callback_tasks", label: "Geri Arama Planlayıcı" },
      { id: "smart_callback", label: "Akıllı Geri Arama (Smart Callback)" },
      { id: "dialer", label: "Dış Arama Kampanyası (Auto-Dialer)" },
      { id: "calendar", label: "Randevu Takvimi" },
      { id: "scheduled_reports", label: "Zamanlanmış Otomatik Raporlar" }
    ]
  },
  {
    id: "omnichannel_crm",
    title: "3. Omnichannel, CRM & Entegrasyonlar",
    items: [
      { id: "omnichannel", label: "Ortak Gelen Kutusu (Omnichannel)" },
      { id: "channels", label: "Kanal Entegrasyonları" },
      { id: "canned_responses", label: "Hızlı Cevaplar" },
      { id: "cti_integration", label: "CTI & CRM Entegrasyonu" },
      { id: "customer_360", label: "Müşteri 360° Kartı & VIP Etiketler" },
      { id: "crm_integrations", label: "Hazır CRM Marketi (Zoho/HubSpot/SF/Bitrix)" },
      { id: "active_directory", label: "Active Directory (LDAP & Entra ID SSO)" },
      { id: "universal_api", label: "Evrensel API Sihirbazı (Webhook)" },
      { id: "api_management", label: "Kurumsal Dış API & Token Yönetimi" }
    ]
  },
  {
    id: "ai",
    title: "4. Yapay Zeka (AI) Suite & Ses Analitiği",
    items: [
      { id: "dashboard", label: "Gerçek Zamanlı AI Pano" },
      { id: "ai_agents", label: "AI Temsilcileri & Senaryo Editörü" },
      { id: "rag_kb", label: "Bilgi Bankası (RAG & Web Crawler)" },
      { id: "rule_editor", label: "Kural & Senaryo Editörü" },
      { id: "ai_config_assistant", label: "AI Konfigürasyon Asistanı (Doğal Dil)" },
      { id: "live_translator", label: "Canlı Çeviri & Simultane Tercüman" },
      { id: "lang_detect", label: "Otomatik Dil Algılama" },
      { id: "emotion_management", label: "Dinamik Duygu Yönetimi" },
      { id: "crisis_alerts", label: "Canlı Kriz & Negatif Duygu Radarı" },
      { id: "ai_whisper", label: "AI Fısıldama Yönetimi (AI Whisper)" },
      { id: "qa", label: "Çağrı Kalite Kontrol (Otomatik AI QA)" },
      { id: "voice_biometrics", label: "Biyometrik Ses Analizi" },
      { id: "ai_providers", label: "Yapay Zeka API Ayarları" },
      { id: "ai_task_routing", label: "AI Görev & Model Yönlendirme" },
      { id: "api_budgets", label: "API Bütçe ve Tüketim Takibi" },
      { id: "roi_settings", label: "ROI Rapor Ayarları" }
    ]
  },
  {
    id: "reports_basic",
    title: "5A. Raporlama — Temel Santral (12 Rapor)",
    items: [
      { id: "reports_pano", label: "Rapor Panosu" },
      { id: "reports_cdr", label: "CDR Çağrı Kayıtları" },
      { id: "reports_audio", label: "Ses Kayıtları" },
      { id: "reports_missed", label: "Kaçan Çağrı Analizi" },
      { id: "reports_traffic_load", label: "Yoğunluk Raporu" },
      { id: "reports_trunk", label: "Hat Kapasite Raporu" },
      { id: "reports_did", label: "DID Raporu" },
      { id: "reports_trunk_minutes", label: "Operatör Dakika & Paket Raporu" },
      { id: "reports_invalid_calls", label: "Hatalı & Eşleşmeyen Çağrı Raporu" },
      { id: "reports_voicemail", label: "Sesli Posta Raporu" },
      { id: "reports_conferences", label: "Konferans Odası Kullanım Raporu" },
      { id: "reports_blacklist_security", label: "Engellenen Çağrı & İhlal Raporu" }
    ]
  },
  {
    id: "reports_callcenter",
    title: "5B. Raporlama — Çağrı Merkezi & Kuyruk (17 Rapor)",
    items: [
      { id: "reports_perf", label: "Temsilci Performans & KPI" },
      { id: "agent_timeline", label: "Temsilci Kronolojisi (Zaman Çizelgesi)" },
      { id: "reports_breaks_attendance", label: "Mola & Puantaj Raporu" },
      { id: "reports_notes", label: "Temsilci Notları" },
      { id: "reports_disposition", label: "Çağrı Sonuç Kodları" },
      { id: "reports_queue", label: "Kuyruk & Bekleme Analitiği" },
      { id: "reports_queue_sla", label: "Kuyruk SLA & Hız Dilimleri" },
      { id: "reports_survey", label: "Çağrı Sonu Anket Raporları" },
      { id: "reports_fcr", label: "İlk Aramada Çözüm (FCR)" },
      { id: "reports_ivr_drop", label: "IVR Terk Oranı" },
      { id: "reports_transfer_hold", label: "Aktarma & Bekletme Raporu" },
      { id: "reports_repeat_callers", label: "Tekrar Eden Arayanlar" },
      { id: "reports_dept_pickup", label: "Departman & Çağrı Toplama" },
      { id: "reports_forwarding_gsm", label: "Çağrı Yönlendirme (Follow-Me / GSM)" },
      { id: "reports_supervisor_audit", label: "Süpervizör Dinleme & Müdahale" },
      { id: "reports_omnichannel", label: "Omnichannel Kanal & SLA" },
      { id: "reports_voip_quality", label: "VoIP & Ses Kalitesi (MOS)" }
    ]
  },
  {
    id: "reports_ai",
    title: "5C. Raporlama — AI, Dialer & Üst Yönetim (15 Rapor)",
    items: [
      { id: "reports_custom_builder", label: "Özel Rapor Tasarımcısı & AI Rapor" },
      { id: "reports_transcripts", label: "Çağrı Transkriptleri (STT)" },
      { id: "reports_sentiment", label: "Duygu Analizi" },
      { id: "reports_sentiment_heat", label: "Duygu Durumu Isı Haritası" },
      { id: "reports_intent", label: "Müşteri Niyet Raporu" },
      { id: "reports_qa", label: "AI Kalite Değerlendirmeleri" },
      { id: "reports_wordcloud", label: "Kelime Bulutu & Trendler" },
      { id: "reports_friction", label: "Müşteri Çile Noktaları" },
      { id: "reports_compliance", label: "Senaryo Sadakati Raporu" },
      { id: "reports_silence", label: "Sessizlik & Söz Kesme" },
      { id: "reports_roi", label: "AI vs İnsan ROI Paneli" },
      { id: "reports_ceo_summary", label: "CEO Özet Raporu" },
      { id: "reports_ai_appointments_rag", label: "AI Randevu & Bilgi Bankası (RAG)" },
      { id: "reports_dialer_callback", label: "Kampanya (Dialer) & Geri Arama" },
      { id: "reports_ab_testing", label: "Verimlilik Karşılaştırması (A/B)" }
    ]
  },
  {
    id: "infra",
    title: "6. Altyapı, Teşhis, Güvenlik & Çoklu Kiracı",
    items: [
      { id: "pbx", label: "Santral Entegrasyonu (Asterisk/PJSIP)" },
      { id: "server_network", label: "Sunucu Ağ (Network) & IP/Rota" },
      { id: "nat", label: "NAT ve Dış IP Ayarları" },
      { id: "ras_settings", label: "Nornia Connect (Bulut Köprüsü)" },
      { id: "ssl", label: "SSL Sertifikaları" },
      { id: "roles", label: "Roller & Granüler Yetki Yönetimi" },
      { id: "email_notifications", label: "E-Mail Bildirimleri (SMTP)" },
      { id: "system_status", label: "Sistem Panosu & Sağlık" },
      { id: "logs", label: "Olay Günlükleri (Audit Logs)" },
      { id: "security", label: "Güvenlik Kalkanı (Fail2Ban / 2FA)" },
      { id: "backup_restore", label: "Sistem Yedekleme & Geri Yükleme" },
      { id: "restore_points", label: "Geri Yükleme Noktası" },
      { id: "recording_retention", label: "Kayıt & Saklama Sistemi (Retention)" },
      { id: "troubleshooting", label: "Sorun İnceleme (SIP Debugger / sngrep)" },
      { id: "tenants", label: "Çoklu Müşteri (Multi-Tenant)" },
      { id: "server_ssh", label: "Sunucu Web SSH Terminali" }
    ]
  }
];

export const ALL_SANTRAL_MODULE_IDS = SANTRAL_MODULE_CATEGORIES.flatMap((c) => c.items.map((i) => i.id));

export const SUB_FEATURE_LIST = [
  // Gelişmiş Abone & WebPhone Özellikleri
  { id: "voicemail", group: "Abone & WebPhone", label: "Sesli Posta (Voicemail & E-Posta İletimi)" },
  { id: "follow_me", group: "Abone & WebPhone", label: "Beni Takip Et (Follow-Me / GSM Yönlendirme)" },
  { id: "mobile_apps", group: "Abone & WebPhone", label: "Mobil / Masaüstü Uygulama & QR Provizyon" },
  { id: "internal_chat", group: "Abone & WebPhone", label: "Dahili Ekip Sohbeti (Internal Chat)" },
  { id: "deskphone_blf", group: "Abone & WebPhone", label: "Masa Telefonum (BLF / Hızlı Tuş / Softkey)" },
  { id: "boss_secretary", group: "Abone & WebPhone", label: "Yönetici–Asistan (Boss–Secretary)" },
  { id: "hotdesking", group: "Abone & WebPhone", label: "Esnek Masa / Ortak Telefon (Hot-Desking)" },
  { id: "multi_device", group: "Abone & WebPhone", label: "Çoklu SIP Cihaz Aktivasyonu" },
  { id: "mask_number", group: "Abone & WebPhone", label: "Numara Maskeleme (Son 4 Hane ** **)" },
  { id: "pause_recording", group: "Abone & WebPhone", label: "KVKK & Kredi Kartı Ses Kaydı Maskeleme" },
  { id: "cti_screen_pop", group: "Abone & WebPhone", label: "CTI Müşteri Kartı Otomatik Açma (Screen Pop)" },
  { id: "call_monitor", group: "Abone & WebPhone", label: "Süpervizör: Canlı Dinleme / Sufle / Araya Girme" },
  // Omnichannel Kanalları
  { id: "whatsapp", group: "Omnichannel Kanalları", label: "WhatsApp Business Cloud API Kanalı" },
  { id: "email", group: "Omnichannel Kanalları", label: "E-Posta (IMAP / SMTP) Müşteri Kanalı" },
  { id: "instagram_meta", group: "Omnichannel Kanalları", label: "Instagram DM & Facebook Messenger Kanalı" },
  { id: "telegram", group: "Omnichannel Kanalları", label: "Telegram Bot Kanalı" },
  // Yapay Zeka WebPhone Özellikleri
  { id: "ai_note_assistant", group: "AI WebPhone", label: "AI Otomatik Çağrı Özeti & Sonuç Kodu Asistanı" },
  { id: "live_translation", group: "AI WebPhone", label: "Anlık Altyazı Konuşma Çevirisi" },
  { id: "voice_interpreter", group: "AI WebPhone", label: "Simultane Çift Yönlü Sesli Tercüman" }
];

export const ALL_SUB_FEATURE_IDS = SUB_FEATURE_LIST.map((s) => s.id);
export const ALL_STT_IDS = STT_PROVIDER_LIST.map((p) => p.id);
export const ALL_TTS_IDS = TTS_PROVIDER_LIST.map((p) => p.id);
export const ALL_LLM_IDS = LLM_PROVIDER_LIST.map((p) => p.id);

// Tier feature lists aligned 1:1 with the approved Nornia PBX Package Matrix
const STARTER_MODULES = [
  // 1. Temel IP Santral (16/18)
  "users", "trunks", "inbound_rules", "outbound_rules", "announcements",
  "call_flow", "work_hours", "contacts", "speed_dials", "blacklist",
  "call_pickup_groups", "subscriber_groups", "conferences", "locations",
  "numbering_plan", "autoprovision",
  // 2. Temel WebPhone
  "call_panel",
  // 5A. Temel Santral Raporları (12)
  "reports_pano", "reports_cdr", "reports_audio", "reports_missed",
  "reports_traffic_load", "reports_trunk", "reports_did", "reports_trunk_minutes",
  "reports_invalid_calls", "reports_voicemail", "reports_conferences", "reports_blacklist_security",
  // 6. Altyapı & Güvenlik (13)
  "pbx", "server_network", "nat", "ras_settings", "ssl", "roles",
  "email_notifications", "system_status", "logs", "security",
  "backup_restore", "restore_points", "recording_retention"
];

const STARTER_SUBS = ["voicemail", "follow_me", "mobile_apps"];

const PROFESSIONAL_MODULES = [
  ...STARTER_MODULES,
  // 1. Ek PBX
  "autoprovision_templates", "bulk_config",
  // 2. Çağrı Merkezi & Süpervizör
  "acd_queues", "breaks", "wallboard", "realtime_calls", "supervisor",
  "call_monitor", "callback_tasks", "smart_callback", "calendar", "scheduled_reports",
  // 3. Omnichannel & CTI
  "omnichannel", "channels", "canned_responses", "cti_integration", "customer_360",
  // 5B. Çağrı Merkezi & Kuyruk Raporları (17)
  "reports_perf", "agent_timeline", "reports_breaks_attendance", "reports_notes",
  "reports_disposition", "reports_queue", "reports_queue_sla", "reports_survey",
  "reports_fcr", "reports_ivr_drop", "reports_transfer_hold", "reports_repeat_callers",
  "reports_dept_pickup", "reports_forwarding_gsm", "reports_supervisor_audit",
  "reports_omnichannel", "reports_voip_quality",
  // 6. Teşhis
  "troubleshooting"
];

const PROFESSIONAL_SUBS = [
  ...STARTER_SUBS,
  "internal_chat", "deskphone_blf", "boss_secretary", "hotdesking",
  "multi_device", "mask_number", "pause_recording", "cti_screen_pop",
  "call_monitor", "whatsapp", "email"
];

export const DEFAULT_PACKAGE_TEMPLATES = {
  starter: {
    tier_key: "starter",
    name: "Starter / Başlangıç Paket",
    shortName: "Starter",
    tagline: "Temel Kurumsal IP Santral, WebPhone, IVR ve 12 Temel Rapor",
    badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    allowed_features: STARTER_MODULES,
    allowed_sub_features: STARTER_SUBS,
    allowed_stt_providers: [],
    allowed_tts_providers: [],
    allowed_llm_providers: [],
    unlicensed_module_mode: "hidden",
    auto_expiry_days: null,
    auto_unlimited: false
  },
  professional: {
    tier_key: "professional",
    name: "Professional Paket",
    shortName: "Professional",
    tagline: "Çağrı Merkezi, ACD Kuyruk, Wallboard, Süpervizör, WhatsApp/E-Posta, CTI & 29 Rapor",
    badgeClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    allowed_features: PROFESSIONAL_MODULES,
    allowed_sub_features: PROFESSIONAL_SUBS,
    allowed_stt_providers: [],
    allowed_tts_providers: [],
    allowed_llm_providers: [],
    unlicensed_module_mode: "hidden",
    auto_expiry_days: null,
    auto_unlimited: false
  },
  enterprise: {
    tier_key: "enterprise",
    name: "Enterprise / Kurumsal Özel",
    shortName: "Enterprise",
    tagline: "Tüm Yapay Zeka (AI) Suite, Auto-Dialer, Tüm Kanallar, CRM/AD/API, 44 Rapor & Çoklu Kiracı",
    badgeClass: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    allowed_features: [...ALL_SANTRAL_MODULE_IDS],
    allowed_sub_features: [...ALL_SUB_FEATURE_IDS],
    allowed_stt_providers: [...ALL_STT_IDS],
    allowed_tts_providers: [...ALL_TTS_IDS],
    allowed_llm_providers: [...ALL_LLM_IDS],
    unlicensed_module_mode: "hidden",
    auto_expiry_days: null,
    auto_unlimited: false
  },
  unlimited: {
    tier_key: "unlimited",
    name: "Limitsiz / Özel Paket",
    shortName: "Limitsiz",
    tagline: "Tüm Modüller, Tüm AI Motorları ve Süresiz Lisans",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    allowed_features: ["*"],
    allowed_sub_features: ["*"],
    allowed_stt_providers: [...ALL_STT_IDS],
    allowed_tts_providers: [...ALL_TTS_IDS],
    allowed_llm_providers: [...ALL_LLM_IDS],
    unlicensed_module_mode: "hidden",
    auto_expiry_days: null,
    auto_unlimited: true
  },
  trial: {
    tier_key: "trial",
    name: "Trial / Deneme Süresi (30 Gün)",
    shortName: "Trial (30 Gün)",
    tagline: "30 Gün Boyunca Tüm Özellikler & Yapay Zeka Suite Tam Deneme",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    allowed_features: [...ALL_SANTRAL_MODULE_IDS],
    allowed_sub_features: [...ALL_SUB_FEATURE_IDS],
    allowed_stt_providers: [...ALL_STT_IDS],
    allowed_tts_providers: [...ALL_TTS_IDS],
    allowed_llm_providers: [...ALL_LLM_IDS],
    unlicensed_module_mode: "hidden",
    auto_expiry_days: 30,
    auto_unlimited: false
  }
};

export const PACKAGE_TIER_ORDER = ["trial", "starter", "professional", "enterprise", "unlimited"];

export function mergePackageTemplates(serverList = []) {
  const merged = {};
  for (const key of PACKAGE_TIER_ORDER) {
    merged[key] = { ...DEFAULT_PACKAGE_TEMPLATES[key] };
  }
  if (Array.isArray(serverList)) {
    for (const item of serverList) {
      if (!item || !item.tier_key || !merged[item.tier_key]) continue;
      merged[item.tier_key] = {
        ...merged[item.tier_key],
        name: item.name || merged[item.tier_key].name,
        tagline: item.tagline ?? merged[item.tier_key].tagline,
        allowed_features: Array.isArray(item.allowed_features)
          ? item.allowed_features
          : merged[item.tier_key].allowed_features,
        allowed_sub_features: Array.isArray(item.allowed_sub_features)
          ? item.allowed_sub_features
          : merged[item.tier_key].allowed_sub_features,
        allowed_stt_providers: Array.isArray(item.allowed_stt_providers)
          ? item.allowed_stt_providers
          : merged[item.tier_key].allowed_stt_providers,
        allowed_tts_providers: Array.isArray(item.allowed_tts_providers)
          ? item.allowed_tts_providers
          : merged[item.tier_key].allowed_tts_providers,
        allowed_llm_providers: Array.isArray(item.allowed_llm_providers)
          ? item.allowed_llm_providers
          : merged[item.tier_key].allowed_llm_providers,
        unlicensed_module_mode: item.unlicensed_module_mode || merged[item.tier_key].unlicensed_module_mode,
        is_customized: Boolean(item.is_customized)
      };
    }
  }
  return merged;
}

export function computeDatePlusDaysISO(days = 30) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 30));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
