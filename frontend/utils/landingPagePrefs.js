// Shared catalog & permission-aware resolvers for per-user startup / landing screen preferences

export const LANDING_SCREEN_CATALOG = [
  // 1. Operasyon & İzleme
  {
    id: "dashboard",
    group: "Operasyon & İzleme",
    label: "Gerçek Zamanlı AI Pano",
    shortLabel: "AI Pano",
    perms: ["dashboard"],
    disallowAgentOnly: true,
    disallowWallboardOnly: true
  },
  {
    id: "wallboard",
    group: "Operasyon & İzleme",
    label: "Canlı İzleme Paneli (Wallboard)",
    shortLabel: "Wallboard",
    perms: ["wallboard"]
  },
  {
    id: "call-center",
    group: "Operasyon & İzleme",
    label: "Temsilci Çağrı Paneli",
    shortLabel: "Çağrı Paneli",
    perms: ["call_panel"],
    allowAgentOnly: true,
    desktopAllowed: true
  },
  {
    id: "omnichannel",
    group: "Operasyon & İzleme",
    label: "Ortak Gelen Kutusu (Omnichannel)",
    shortLabel: "Omnichannel",
    perms: ["omnichannel"],
    desktopAllowed: true
  },
  {
    id: "api-budgets",
    group: "Operasyon & İzleme",
    label: "API Bütçe ve Tüketim",
    shortLabel: "API Bütçe",
    perms: ["api_budgets", "budget_"]
  },

  // 2. Yapay Zeka & Bilgi
  {
    id: "ai-config-assistant",
    group: "Yapay Zeka & Bilgi",
    label: "AI Konfigürasyon Asistanı",
    shortLabel: "AI Asistan",
    perms: ["ai_config_assistant"]
  },
  {
    id: "ai-agents",
    group: "Yapay Zeka & Bilgi",
    label: "AI Temsilcileri",
    shortLabel: "AI Temsilci",
    perms: ["ai_agents"]
  },
  {
    id: "rag-kb",
    group: "Yapay Zeka & Bilgi",
    label: "Bilgi Bankası (RAG)",
    shortLabel: "Bilgi Bankası",
    perms: ["rag", "knowledge_base"]
  },
  {
    id: "rule-editor",
    group: "Yapay Zeka & Bilgi",
    label: "Kural & Senaryo Editörü",
    shortLabel: "Senaryolar",
    perms: ["rules"]
  },

  // 3. Santral
  {
    id: "users",
    group: "Santral",
    label: "Kullanıcılar",
    shortLabel: "Kullanıcılar",
    perms: ["users"]
  },
  {
    id: "announcements",
    group: "Santral",
    label: "Anons Yönetimi",
    shortLabel: "Anonslar",
    perms: ["announcements"]
  },
  {
    id: "acd-queues",
    group: "Santral",
    label: "ACD Kuyruk Yönetimi",
    shortLabel: "Kuyruklar",
    perms: ["acd_queues"]
  },
  {
    id: "auto-provision",
    group: "Santral",
    label: "Oto Provizyon",
    shortLabel: "Provizyon",
    perms: ["autoprovision"]
  },
  {
    id: "outbound-rules",
    group: "Santral",
    label: "Giden Arama Kuralı",
    shortLabel: "Giden Kural",
    perms: ["outbound_rules"]
  },
  {
    id: "inbound-rules",
    group: "Santral",
    label: "Gelen Arama Kuralı",
    shortLabel: "Gelen Kural",
    perms: ["inbound_rules"]
  },
  {
    id: "call-pickup-groups",
    group: "Santral",
    label: "Çağrı Yakalama Grupları",
    shortLabel: "Yakalama Grubu",
    perms: ["call_pickup_groups"]
  },
  {
    id: "subscriber-groups",
    group: "Santral",
    label: "Abone Grupları",
    shortLabel: "Abone Grubu",
    perms: ["subscriber_groups"]
  },
  {
    id: "contacts",
    group: "Santral",
    label: "Rehber Yönetimi",
    shortLabel: "Rehber",
    perms: ["contacts"]
  },
  {
    id: "trunks",
    group: "Santral",
    label: "Dış Hat Tanımı (SIP Trunk)",
    shortLabel: "Dış Hatlar",
    perms: ["trunks"]
  },
  {
    id: "conferences",
    group: "Santral",
    label: "Konferans Odaları",
    shortLabel: "Konferans",
    perms: ["conferences"]
  },
  {
    id: "speed-dial",
    group: "Santral",
    label: "Hızlı Arama Kodları",
    shortLabel: "Hızlı Arama",
    perms: ["speed_dials"]
  },
  {
    id: "blacklist",
    group: "Santral",
    label: "Numara Engelleme (Kara Liste)",
    shortLabel: "Kara Liste",
    perms: ["blacklist"]
  },
  {
    id: "scheduled-reports",
    group: "Santral",
    label: "Zamanlanmış Raporlar",
    shortLabel: "Zamanlanmış Rap.",
    perms: ["scheduled_reports"]
  },

  // 4. Çağrı & Yönlendirme
  {
    id: "call-flow",
    group: "Çağrı & Yönlendirme",
    label: "Arama Akış Yönetimi",
    shortLabel: "Akış Yönetimi",
    perms: ["call_flow", "pbx"],
    allowGeneralSupervisor: true
  },
  {
    id: "work-hours",
    group: "Çağrı & Yönlendirme",
    label: "Mesai & Resmi Tatiller",
    shortLabel: "Mesai",
    perms: ["work_hours", "pbx", "call_flow"]
  },
  {
    id: "dialer",
    group: "Çağrı & Yönlendirme",
    label: "Dış Arama (Dialer)",
    shortLabel: "Dialer",
    perms: ["dialer"],
    allowGeneralSupervisor: true
  },
  {
    id: "calendar",
    group: "Çağrı & Yönlendirme",
    label: "Randevu Takvimi",
    shortLabel: "Takvim",
    perms: ["calendar"],
    allowGeneralSupervisor: true
  },

  // 5. Çağrı Raporları & Analiz
  {
    id: "reports-custom-builder",
    group: "Çağrı Raporları & Analiz",
    label: "Özel Rapor Tasarımcısı",
    shortLabel: "Özel Rapor",
    perms: ["reports", "reports_custom_builder"]
  },
  {
    id: "reports-pano",
    group: "Çağrı Raporları & Analiz",
    label: "Çağrı Rapor Panosu",
    shortLabel: "Rapor Panosu",
    perms: ["reports", "reports_pano", "reports_"]
  },
  {
    id: "reports-cdr",
    group: "Çağrı Raporları & Analiz",
    label: "CDR Çağrı Kayıtları",
    shortLabel: "CDR",
    perms: ["reports", "reports_cdr", "reports_"]
  },
  {
    id: "reports-audio",
    group: "Çağrı Raporları & Analiz",
    label: "Ses Kayıtları",
    shortLabel: "Ses Kaydı",
    perms: ["reports", "reports_audio", "reports_"]
  },
  {
    id: "reports-transcripts",
    group: "Çağrı Raporları & Analiz",
    label: "Çağrı Transkripti",
    shortLabel: "Transkript",
    perms: ["reports", "reports_transcripts", "reports_"]
  },
  {
    id: "reports-sentiment",
    group: "Çağrı Raporları & Analiz",
    label: "Duygu Analizi",
    shortLabel: "Duygu Analizi",
    perms: ["reports", "reports_sentiment", "reports_"]
  },
  {
    id: "reports-intent",
    group: "Çağrı Raporları & Analiz",
    label: "Niyet Raporu",
    shortLabel: "Niyet Raporu",
    perms: ["reports", "reports_intent", "reports_"]
  },
  {
    id: "reports-qa",
    group: "Çağrı Raporları & Analiz",
    label: "Kalite Değerlendirmeleri",
    shortLabel: "Kalite (QA)",
    perms: ["reports", "reports_qa", "reports_"]
  },
  {
    id: "reports-notes",
    group: "Çağrı Raporları & Analiz",
    label: "Temsilci Notları",
    shortLabel: "Temsilci Notları",
    perms: ["reports", "reports_notes", "reports_"]
  },
  {
    id: "reports-perf",
    group: "Çağrı Raporları & Analiz",
    label: "Temsilci Performans & KPI",
    shortLabel: "Temsilci Perf.",
    perms: ["reports", "reports_perf", "reports_"]
  },
  {
    id: "reports-queue",
    group: "Çağrı Raporları & Analiz",
    label: "Kuyruk / Bekleme Analitiği",
    shortLabel: "Kuyruk Analitik",
    perms: ["reports", "reports_queue", "reports_"]
  },
  {
    id: "reports-survey",
    group: "Çağrı Raporları & Analiz",
    label: "Anket Raporları",
    shortLabel: "Anketler",
    perms: ["reports", "reports_survey", "reports_"]
  },
  {
    id: "reports-sentiment-heat",
    group: "Çağrı Raporları & Analiz",
    label: "Duygu Durumu Isı Haritası",
    shortLabel: "Duygu Haritası",
    perms: ["reports", "reports_sentiment_heat", "reports_"]
  },
  {
    id: "reports-wordcloud",
    group: "Çağrı Raporları & Analiz",
    label: "Kelime Bulutu & Trendler",
    shortLabel: "Kelime Bulutu",
    perms: ["reports", "reports_wordcloud", "reports_"]
  },
  {
    id: "reports-fcr",
    group: "Çağrı Raporları & Analiz",
    label: "İlk Aramada Çözüm (FCR)",
    shortLabel: "FCR",
    perms: ["reports", "reports_fcr", "reports_"]
  },
  {
    id: "reports-roi",
    group: "Çağrı Raporları & Analiz",
    label: "AI vs. İnsan ROI Paneli",
    shortLabel: "ROI Paneli",
    perms: ["reports", "reports_roi", "reports_"]
  },
  {
    id: "reports-missed",
    group: "Çağrı Raporları & Analiz",
    label: "Kaçan Çağrı Analizi",
    shortLabel: "Kaçan Çağrı",
    perms: ["reports", "reports_missed", "reports_"]
  },
  {
    id: "reports-agent-status-timeline",
    group: "Çağrı Raporları & Analiz",
    label: "Temsilci Kronolojisi",
    shortLabel: "Kronoloji",
    perms: ["reports", "reports_agent_status_timeline", "reports_"]
  },
  {
    id: "reports-traffic-load",
    group: "Çağrı Raporları & Analiz",
    label: "Yoğunluk Raporu",
    shortLabel: "Yoğunluk",
    perms: ["reports", "reports_traffic_load", "reports_"]
  },
  {
    id: "reports-trunk",
    group: "Çağrı Raporları & Analiz",
    label: "Hat Kapasite Raporu",
    shortLabel: "Hat Kapasite",
    perms: ["reports", "reports_trunk", "reports_"]
  },
  {
    id: "reports-did",
    group: "Çağrı Raporları & Analiz",
    label: "DID Raporu",
    shortLabel: "DID Raporu",
    perms: ["reports", "reports_did"]
  },
  {
    id: "reports-trunk-minutes",
    group: "Çağrı Raporları & Analiz",
    label: "Operatör Dakika & Paket",
    shortLabel: "Operatör Dakika",
    perms: ["reports", "reports_trunk_minutes"]
  },
  {
    id: "reports-invalid-calls",
    group: "Çağrı Raporları & Analiz",
    label: "Hatalı & Eşleşmeyen Çağrı",
    shortLabel: "Hatalı Çağrı",
    perms: ["reports", "reports_invalid_calls"]
  },
  {
    id: "reports-ivr-drop",
    group: "Çağrı Raporları & Analiz",
    label: "IVR Terk Oranı",
    shortLabel: "IVR Terk",
    perms: ["reports", "reports_ivr_drop", "reports_"]
  },
  {
    id: "reports-transfer-hold",
    group: "Çağrı Raporları & Analiz",
    label: "Aktarma & Bekletme",
    shortLabel: "Aktarma/Bekletme",
    perms: ["reports", "reports_transfer_hold", "reports_"]
  },
  {
    id: "reports-ab-testing",
    group: "Çağrı Raporları & Analiz",
    label: "Verimlilik Karşılaştırması",
    shortLabel: "Verimlilik A/B",
    perms: ["reports", "reports_ab_testing", "reports_"]
  },
  {
    id: "reports-friction",
    group: "Çağrı Raporları & Analiz",
    label: "Müşteri Çile Noktaları",
    shortLabel: "Çile Noktaları",
    perms: ["reports", "reports_friction", "reports_"]
  },
  {
    id: "reports-compliance",
    group: "Çağrı Raporları & Analiz",
    label: "Senaryo Sadakati Raporu",
    shortLabel: "Senaryo Sadakati",
    perms: ["reports", "reports_compliance", "reports_"]
  },
  {
    id: "reports-silence",
    group: "Çağrı Raporları & Analiz",
    label: "Sessizlik & Söz Kesme",
    shortLabel: "Sessizlik/Kesme",
    perms: ["reports", "reports_silence", "reports_"]
  },
  {
    id: "reports-ceo-summary",
    group: "Çağrı Raporları & Analiz",
    label: "CEO Özet Raporu",
    shortLabel: "CEO Özeti",
    perms: ["reports", "reports_ceo_summary", "reports_"]
  },
  {
    id: "reports-breaks-attendance",
    group: "Çağrı Raporları & Analiz",
    label: "Mola & Puantaj Raporu",
    shortLabel: "Mola & Puantaj",
    perms: ["reports", "reports_breaks_attendance"]
  },
  {
    id: "reports-omnichannel",
    group: "Çağrı Raporları & Analiz",
    label: "Omnichannel Kanal & SLA",
    shortLabel: "Omnichannel SLA",
    perms: ["reports", "reports_omnichannel"]
  },
  {
    id: "reports-disposition",
    group: "Çağrı Raporları & Analiz",
    label: "Çağrı Sonuç Kodları",
    shortLabel: "Sonuç Kodları",
    perms: ["reports", "reports_disposition"]
  },
  {
    id: "reports-dialer-callback",
    group: "Çağrı Raporları & Analiz",
    label: "Kampanya & Geri Arama",
    shortLabel: "Kampanya Raporu",
    perms: ["reports", "reports_dialer_callback"]
  },
  {
    id: "reports-queue-sla",
    group: "Çağrı Raporları & Analiz",
    label: "Kuyruk SLA & Hız Dilimleri",
    shortLabel: "Kuyruk SLA",
    perms: ["reports", "reports_queue_sla"]
  },
  {
    id: "reports-repeat-callers",
    group: "Çağrı Raporları & Analiz",
    label: "Tekrar Eden Arayanlar",
    shortLabel: "Tekrar Arayanlar",
    perms: ["reports", "reports_repeat_callers"]
  },
  {
    id: "reports-dept-pickup",
    group: "Çağrı Raporları & Analiz",
    label: "Departman & Çağrı Toplama",
    shortLabel: "Dept. Toplama",
    perms: ["reports", "reports_dept_pickup"]
  },
  {
    id: "reports-voip-quality",
    group: "Çağrı Raporları & Analiz",
    label: "VoIP & Ses Kalitesi (MOS)",
    shortLabel: "VoIP Kalite",
    perms: ["reports", "reports_voip_quality"]
  },
  {
    id: "reports-forwarding-gsm",
    group: "Çağrı Raporları & Analiz",
    label: "Yönlendirme (Follow-Me / GSM)",
    shortLabel: "Yönlendirme Rap.",
    perms: ["reports", "reports_forwarding_gsm"]
  },
  {
    id: "reports-supervisor-audit",
    group: "Çağrı Raporları & Analiz",
    label: "Süpervizör Dinleme & Müdahale",
    shortLabel: "Süpervizör Denetim",
    perms: ["reports", "reports_supervisor_audit"]
  },
  {
    id: "reports-blacklist-security",
    group: "Çağrı Raporları & Analiz",
    label: "Engellenen Çağrı & İhlal",
    shortLabel: "Engel & İhlal",
    perms: ["reports", "reports_blacklist_security"]
  },
  {
    id: "reports-ai-appointments-rag",
    group: "Çağrı Raporları & Analiz",
    label: "AI Randevu & Bilgi Bankası",
    shortLabel: "AI Randevu/RAG",
    perms: ["reports", "reports_ai_appointments_rag"]
  },
  {
    id: "reports-voicemail",
    group: "Çağrı Raporları & Analiz",
    label: "Sesli Posta (Voicemail)",
    shortLabel: "Sesli Posta Rap.",
    perms: ["reports", "reports_voicemail"]
  },
  {
    id: "reports-conferences",
    group: "Çağrı Raporları & Analiz",
    label: "Konferans Odası Kullanımı",
    shortLabel: "Konferans Rap.",
    perms: ["reports", "reports_conferences"]
  },

  // 6. Yönetim & Ayarlar
  {
    id: "settings",
    group: "Yönetim & Ayarlar",
    label: "Sistem Ayarları",
    shortLabel: "Ayarlar",
    perms: ["system_settings", "roles"]
  },
  {
    id: "system-status",
    group: "Yönetim & Ayarlar",
    label: "Sistem Panosu & Sağlık",
    shortLabel: "Sistem Sağlığı",
    adminOnly: true
  },
  {
    id: "event-logs",
    group: "Yönetim & Ayarlar",
    label: "Olay Günlükleri",
    shortLabel: "Loglar",
    perms: ["event_logs", "logs", "system_settings"]
  },
  {
    id: "troubleshooting",
    group: "Yönetim & Ayarlar",
    label: "Sorun İnceleme & sngrep",
    shortLabel: "Sorun İncele",
    perms: ["sip_debugger", "troubleshooting", "system_settings"]
  },
  {
    id: "security",
    group: "Yönetim & Ayarlar",
    label: "Güvenlik Kalkanı",
    shortLabel: "Güvenlik",
    perms: ["security", "system_settings"]
  },
  {
    id: "changelog",
    group: "Yönetim & Ayarlar",
    label: "Sistem Versiyonu & Günlük",
    shortLabel: "Versiyon & Günlük",
    perms: ["dashboard", "system_settings"],
    allowGeneralSupervisor: true
  }
];

export const CALL_PANEL_SUBTABS_CATALOG = [
  { id: "dashboard", perm: "call_panel:tab_dashboard", label: "Pano (Günlük Çağrı & Mola Özeti)", shortLabel: "Pano" },
  { id: "webphone", perm: "call_panel:tab_webphone", label: "Web Telefon (WebRTC Hat Kontrolü)", shortLabel: "Web Telefon" },
  { id: "agents", perm: "call_panel:tab_agents", label: "Temsilciler (Canlı Kuyruk Durumu)", shortLabel: "Temsilciler" },
  { id: "speeddial", perm: "call_panel:tab_speeddial", label: "Hızlı Arama", shortLabel: "Hızlı Arama" },
  { id: "missed", perm: "call_panel:tab_missed", label: "Kayıp Çağrı", shortLabel: "Kayıp Çağrı" },
  { id: "directory", perm: "call_panel:tab_directory", label: "Rehber", shortLabel: "Rehber" },
  { id: "history", perm: "call_panel:tab_history", label: "Çağrı Geçmişi", shortLabel: "Çağrı Geçmişi" },
  { id: "voicemail", perm: "call_panel:tab_voicemail", label: "Sesli Posta", shortLabel: "Sesli Posta" },
  { id: "chat", perm: "call_panel:tab_chat", label: "Sohbet (İç Yazışma)", shortLabel: "Sohbet" },
  { id: "deskphone", perm: "call_panel:tab_deskphone", label: "Masa Telefonum", shortLabel: "Masa Telefonum" }
];

function checkHasPerm(permsList, prefix) {
  if (!Array.isArray(permsList)) return false;
  if (prefix.endsWith("_")) {
    return permsList.some((p) => String(p || "").startsWith(prefix));
  }
  return permsList.some((p) => p === prefix || String(p || "").startsWith(`${prefix}:`));
}

export function classifyRoleScope(roleCode, rolePermissions) {
  const roleLower = String(roleCode || "").toLowerCase().trim();
  if (roleLower === "admin") {
    return { isAdmin: true, isWallboardOnly: false, isAgentOnly: false };
  }
  const perms = Array.isArray(rolePermissions) ? rolePermissions : null;
  if (!perms || perms.length === 0) {
    return {
      isAdmin: false,
      isWallboardOnly: false,
      isAgentOnly: roleLower === "agent" || !roleLower
    };
  }
  if (perms.includes("*")) {
    return { isAdmin: true, isWallboardOnly: false, isAgentOnly: false };
  }

  const canDashboard = checkHasPerm(perms, "dashboard");
  const canWallboard = checkHasPerm(perms, "wallboard");
  const canCallPanel = checkHasPerm(perms, "call_panel");
  const canOmni = checkHasPerm(perms, "omnichannel");
  const canReports = checkHasPerm(perms, "reports") || checkHasPerm(perms, "reports_");
  const canAiModules =
    checkHasPerm(perms, "ai_agents") ||
    checkHasPerm(perms, "ai_config_assistant") ||
    checkHasPerm(perms, "rag") ||
    checkHasPerm(perms, "knowledge_base") ||
    checkHasPerm(perms, "rules");
  const canPbxOrSysModules = [
    "users",
    "pbx",
    "api_budgets",
    "announcements",
    "acd_queues",
    "autoprovision",
    "outbound_rules",
    "inbound_rules",
    "call_pickup_groups",
    "subscriber_groups",
    "trunks",
    "conferences",
    "speed_dials",
    "scheduled_reports",
    "work_hours",
    "call_flow",
    "dialer",
    "contacts",
    "blacklist",
    "calendar",
    "roles",
    "breaks",
    "channels",
    "logs",
    "storage",
    "troubleshooting",
    "sip_debugger",
    "security",
    "system_settings"
  ].some((k) => checkHasPerm(perms, k));

  const isWallboardOnly =
    canWallboard && !canDashboard && !canCallPanel && !canOmni && !canReports && !canAiModules && !canPbxOrSysModules;
  const isAgentOnly =
    !isWallboardOnly &&
    !canDashboard &&
    !canWallboard &&
    !canOmni &&
    !canReports &&
    !canAiModules &&
    !canPbxOrSysModules;

  return { isAdmin: false, isWallboardOnly, isAgentOnly };
}

export function getAllowedLandingScreensForRole(roleCode, rolePermissions, options = {}) {
  const desktopMode = Boolean(options?.desktopMode);
  const { isAdmin, isWallboardOnly, isAgentOnly } = classifyRoleScope(roleCode, rolePermissions);

  let allowed = [];
  if (isAdmin) {
    allowed = [...LANDING_SCREEN_CATALOG];
  } else if (Array.isArray(rolePermissions) && rolePermissions.length > 0) {
    const perms = rolePermissions;
    allowed = LANDING_SCREEN_CATALOG.filter((item) => {
      if (item.adminOnly) return false;
      if (Array.isArray(item.perms) && item.perms.some((pref) => checkHasPerm(perms, pref))) {
        return true;
      }
      if (item.allowGeneralSupervisor && !isAgentOnly && !isWallboardOnly) {
        return true;
      }
      return false;
    });
    if (allowed.length === 0) {
      if (isWallboardOnly) {
        allowed = LANDING_SCREEN_CATALOG.filter((s) => s.id === "wallboard");
      } else {
        allowed = LANDING_SCREEN_CATALOG.filter((s) => s.id === "call-center");
      }
    }
  } else if (isWallboardOnly) {
    allowed = LANDING_SCREEN_CATALOG.filter((s) => s.id === "wallboard");
  } else if (isAgentOnly) {
    allowed = LANDING_SCREEN_CATALOG.filter((s) => s.id === "call-center");
  } else {
    allowed = LANDING_SCREEN_CATALOG.filter(
      (s) => !s.adminOnly && (s.id === "dashboard" || s.id === "call-center" || s.allowGeneralSupervisor)
    );
  }

  if (desktopMode) {
    const desktopScreens = allowed.filter((s) => s.desktopAllowed);
    return desktopScreens.length > 0
      ? desktopScreens
      : LANDING_SCREEN_CATALOG.filter((s) => s.id === "call-center");
  }

  return allowed;
}

export function isLandingTabAllowedForRole(tabId, roleCode, rolePermissions, options = {}) {
  if (!tabId) return false;
  const allowedList = getAllowedLandingScreensForRole(roleCode, rolePermissions, options);
  return allowedList.some((s) => s.id === tabId);
}

export function getAllowedAgentSubTabsForRole(roleCode, rolePermissions) {
  const roleLower = String(roleCode || "").toLowerCase().trim();
  if (roleLower === "admin") return [...CALL_PANEL_SUBTABS_CATALOG];
  const perms = Array.isArray(rolePermissions) ? rolePermissions : [];
  const hasConfiguredTabs = perms.some((p) => String(p || "").startsWith("call_panel:tab_"));
  if (!hasConfiguredTabs) return [...CALL_PANEL_SUBTABS_CATALOG];
  const allowed = CALL_PANEL_SUBTABS_CATALOG.filter((t) => perms.includes(t.perm));
  return allowed.length > 0 ? allowed : [CALL_PANEL_SUBTABS_CATALOG[0]];
}

export function getLandingScreenLabel(tabId) {
  if (!tabId || tabId === "auto") return "Varsayılan (Role Göre Otomatik)";
  if (tabId === "last_visited") return "Son Kaldığım Ekrandan Devam Et";
  const found = LANDING_SCREEN_CATALOG.find((s) => s.id === tabId);
  if (found) return found.label;
  if (String(tabId).startsWith("reports-")) return "Raporlar Ekranı";
  return String(tabId);
}

export function getAgentSubTabLabel(subTabId) {
  if (!subTabId || subTabId === "auto") return "Sıralamadaki İlk Sekme (Varsayılan)";
  if (subTabId === "last_visited") return "Son Kaldığım Alt Sekme";
  const found = CALL_PANEL_SUBTABS_CATALOG.find((t) => t.id === subTabId);
  return found ? found.shortLabel : String(subTabId);
}

function getUserScopeKeys(user) {
  const keys = [];
  if (user?.id !== undefined && user?.id !== null && String(user.id).trim()) {
    keys.push(String(user.id).trim());
  }
  if (user?.extension && String(user.extension).trim()) {
    keys.push(String(user.extension).trim());
  }
  if (user?.username === "admin" || user?.role === "admin") {
    keys.push("admin");
  }
  return Array.from(new Set(keys));
}

export function saveLastVisitedTab(user, tabId) {
  if (typeof window === "undefined" || !tabId) return;
  try {
    const keys = getUserScopeKeys(user);
    keys.forEach((k) => {
      localStorage.setItem(`aida_last_visited_tab_${k}`, String(tabId));
    });
  } catch (e) {}
}

export function getLastVisitedTab(user, fallbackPrefs = null) {
  if (typeof window !== "undefined") {
    try {
      const keys = getUserScopeKeys(user);
      for (const k of keys) {
        const val = localStorage.getItem(`aida_last_visited_tab_${k}`);
        if (val && val.trim()) return val.trim();
      }
    } catch (e) {}
  }
  const serverSaved = fallbackPrefs?.lastVisitedTab || user?.call_panel_prefs?.lastVisitedTab;
  return typeof serverSaved === "string" && serverSaved.trim() ? serverSaved.trim() : null;
}

export function saveLastVisitedAgentSubTab(user, subTabId) {
  if (typeof window === "undefined" || !subTabId) return;
  try {
    const keys = getUserScopeKeys(user);
    keys.forEach((k) => {
      localStorage.setItem(`aida_last_visited_agent_subtab_${k}`, String(subTabId));
    });
  } catch (e) {}
}

export function getLastVisitedAgentSubTab(user, fallbackPrefs = null) {
  if (typeof window !== "undefined") {
    try {
      const keys = getUserScopeKeys(user);
      for (const k of keys) {
        const val = localStorage.getItem(`aida_last_visited_agent_subtab_${k}`);
        if (val && val.trim()) return val.trim();
      }
    } catch (e) {}
  }
  const serverSaved = fallbackPrefs?.lastVisitedAgentSubTab || user?.call_panel_prefs?.lastVisitedAgentSubTab;
  return typeof serverSaved === "string" && serverSaved.trim() ? serverSaved.trim() : null;
}

export function resolveUserLandingTab({
  user,
  panelPrefs,
  roleCode,
  rolePermissions,
  explicitUrlTab = null,
  isFreshLogin = false,
  desktopMode = false
}) {
  const allowedScreens = getAllowedLandingScreensForRole(roleCode, rolePermissions, { desktopMode });
  if (allowedScreens.length === 1) {
    return allowedScreens[0].id;
  }

  // 1. Direct URL link or F5 page reload (?tab=...) takes precedence when not a fresh login
  if (
    !isFreshLogin &&
    explicitUrlTab &&
    isLandingTabAllowedForRole(explicitUrlTab, roleCode, rolePermissions, { desktopMode })
  ) {
    return explicitUrlTab;
  }

  // 2. User / Admin configured startup preference
  const rawPref = String(
    panelPrefs?.defaultLandingTab || user?.call_panel_prefs?.defaultLandingTab || "auto"
  ).trim();

  if (rawPref === "last_visited") {
    const lastTab = getLastVisitedTab(user, panelPrefs);
    if (lastTab && isLandingTabAllowedForRole(lastTab, roleCode, rolePermissions, { desktopMode })) {
      return lastTab;
    }
  } else if (rawPref && rawPref !== "auto") {
    if (isLandingTabAllowedForRole(rawPref, roleCode, rolePermissions, { desktopMode })) {
      return rawPref;
    }
  }

  // 3. Role-based smart fallback ("auto")
  if (desktopMode) {
    if (isLandingTabAllowedForRole("call-center", roleCode, rolePermissions, { desktopMode: true })) {
      return "call-center";
    }
    return allowedScreens[0]?.id || "call-center";
  }

  const { isAdmin } = classifyRoleScope(roleCode, rolePermissions);
  const roleLower = String(roleCode || "").toLowerCase().trim();
  if (roleLower === "agent" && isLandingTabAllowedForRole("call-center", roleCode, rolePermissions)) {
    return "call-center";
  }
  if (isAdmin || isLandingTabAllowedForRole("dashboard", roleCode, rolePermissions)) {
    return "dashboard";
  }
  const fallbackPriority = ["wallboard", "call-center", "omnichannel", "reports-pano", "users", "contacts"];
  for (const candidate of fallbackPriority) {
    if (isLandingTabAllowedForRole(candidate, roleCode, rolePermissions)) {
      return candidate;
    }
  }
  return allowedScreens[0]?.id || "dashboard";
}
