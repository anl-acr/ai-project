// Shared catalog & permission-aware resolvers for per-user startup / landing screen preferences

export const LANDING_SCREEN_CATALOG = [
  // Operasyon & Canlı Ekranlar
  {
    id: "dashboard",
    group: "Operasyon & Canlı Ekranlar",
    label: "Gerçek Zamanlı AI Pano",
    shortLabel: "AI Pano",
    perms: ["dashboard"],
    disallowAgentOnly: true,
    disallowWallboardOnly: true
  },
  {
    id: "wallboard",
    group: "Operasyon & Canlı Ekranlar",
    label: "Canlı İzleme Paneli (Wallboard)",
    shortLabel: "Wallboard",
    perms: ["wallboard"]
  },
  {
    id: "call-center",
    group: "Operasyon & Canlı Ekranlar",
    label: "Temsilci Çağrı Paneli",
    shortLabel: "Çağrı Paneli",
    perms: ["call_panel"],
    allowAgentOnly: true
  },
  {
    id: "omnichannel",
    group: "Operasyon & Canlı Ekranlar",
    label: "Ortak Gelen Kutusu (Omnichannel)",
    shortLabel: "Omnichannel",
    perms: ["omnichannel"]
  },
  {
    id: "contacts",
    group: "Operasyon & Canlı Ekranlar",
    label: "Rehber Yönetimi",
    shortLabel: "Rehber",
    perms: ["contacts"]
  },
  {
    id: "calendar",
    group: "Operasyon & Canlı Ekranlar",
    label: "Randevu Takvimi",
    shortLabel: "Takvim",
    perms: ["calendar"],
    allowGeneralSupervisor: true
  },
  {
    id: "dialer",
    group: "Operasyon & Canlı Ekranlar",
    label: "Dış Arama (Dialer)",
    shortLabel: "Dialer",
    perms: ["dialer"],
    allowGeneralSupervisor: true
  },

  // Santral & Yönlendirme
  {
    id: "users",
    group: "Santral & Yönlendirme",
    label: "Kullanıcılar",
    shortLabel: "Kullanıcılar",
    perms: ["users"]
  },
  {
    id: "acd-queues",
    group: "Santral & Yönlendirme",
    label: "ACD Kuyruk Yönetimi",
    shortLabel: "Kuyruklar",
    perms: ["acd_queues"]
  },
  {
    id: "call-flow",
    group: "Santral & Yönlendirme",
    label: "Arama Akış Yönetimi",
    shortLabel: "Akış Yönetimi",
    perms: ["call_flow", "pbx"],
    allowGeneralSupervisor: true
  },
  {
    id: "inbound-rules",
    group: "Santral & Yönlendirme",
    label: "Gelen Arama Kuralı",
    shortLabel: "Gelen Kural",
    perms: ["inbound_rules"]
  },
  {
    id: "outbound-rules",
    group: "Santral & Yönlendirme",
    label: "Giden Arama Kuralı",
    shortLabel: "Giden Kural",
    perms: ["outbound_rules"]
  },
  {
    id: "trunks",
    group: "Santral & Yönlendirme",
    label: "Dış Hat Tanımı (SIP Trunk)",
    shortLabel: "Dış Hatlar",
    perms: ["trunks"]
  },
  {
    id: "auto-provision",
    group: "Santral & Yönlendirme",
    label: "Oto Provizyon",
    shortLabel: "Provizyon",
    perms: ["autoprovision"]
  },
  {
    id: "announcements",
    group: "Santral & Yönlendirme",
    label: "Anons Yönetimi",
    shortLabel: "Anonslar",
    perms: ["announcements"]
  },
  {
    id: "work-hours",
    group: "Santral & Yönlendirme",
    label: "Mesai & Resmi Tatiller",
    shortLabel: "Mesai",
    perms: ["work_hours", "pbx", "call_flow"]
  },
  {
    id: "call-pickup-groups",
    group: "Santral & Yönlendirme",
    label: "Çağrı Yakalama Grupları",
    shortLabel: "Yakalama Grubu",
    perms: ["call_pickup_groups"]
  },
  {
    id: "subscriber-groups",
    group: "Santral & Yönlendirme",
    label: "Abone Grupları",
    shortLabel: "Abone Grubu",
    perms: ["subscriber_groups"]
  },
  {
    id: "conferences",
    group: "Santral & Yönlendirme",
    label: "Konferans Odaları",
    shortLabel: "Konferans",
    perms: ["conferences"]
  },
  {
    id: "speed-dial",
    group: "Santral & Yönlendirme",
    label: "Hızlı Arama Kodları",
    shortLabel: "Hızlı Arama",
    perms: ["speed_dials"]
  },
  {
    id: "blacklist",
    group: "Santral & Yönlendirme",
    label: "Numara Engelleme (Kara Liste)",
    shortLabel: "Kara Liste",
    perms: ["blacklist"]
  },

  // Yapay Zeka & Bilgi
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
  {
    id: "ai-config-assistant",
    group: "Yapay Zeka & Bilgi",
    label: "AI Konfigürasyon Asistanı",
    shortLabel: "AI Asistan",
    perms: ["ai_config_assistant"]
  },

  // Raporlar, Güvenlik & Sistem
  {
    id: "reports-pano",
    group: "Raporlar, Güvenlik & Sistem",
    label: "Çağrı Rapor Panosu",
    shortLabel: "Rapor Panosu",
    perms: ["reports", "reports_"]
  },
  {
    id: "reports-cdr",
    group: "Raporlar, Güvenlik & Sistem",
    label: "CDR Çağrı Kayıtları",
    shortLabel: "CDR",
    perms: ["reports", "reports_cdr", "reports_"]
  },
  {
    id: "reports-audio",
    group: "Raporlar, Güvenlik & Sistem",
    label: "Ses Kayıtları",
    shortLabel: "Ses Kaydı",
    perms: ["reports", "reports_audio", "reports_"]
  },
  {
    id: "reports-perf",
    group: "Raporlar, Güvenlik & Sistem",
    label: "Temsilci Performans Raporu",
    shortLabel: "Temsilci Perf.",
    perms: ["reports", "reports_perf", "reports_"]
  },
  {
    id: "reports-queue",
    group: "Raporlar, Güvenlik & Sistem",
    label: "Kuyruk Performans Raporu",
    shortLabel: "Kuyruk Perf.",
    perms: ["reports", "reports_queue", "reports_"]
  },
  {
    id: "reports-missed",
    group: "Raporlar, Güvenlik & Sistem",
    label: "Cevapsız Çağrı Raporu",
    shortLabel: "Cevapsız Raporu",
    perms: ["reports", "reports_missed", "reports_"]
  },
  {
    id: "reports-custom-builder",
    group: "Raporlar, Güvenlik & Sistem",
    label: "Özel Rapor Oluşturucu",
    shortLabel: "Özel Rapor",
    perms: ["reports", "reports_"]
  },
  {
    id: "scheduled-reports",
    group: "Raporlar, Güvenlik & Sistem",
    label: "Zamanlanmış Raporlar",
    shortLabel: "Zamanlanmış Rap.",
    perms: ["scheduled_reports"]
  },
  {
    id: "troubleshooting",
    group: "Raporlar, Güvenlik & Sistem",
    label: "Sorun İnceleme & sngrep",
    shortLabel: "Sorun İncele",
    perms: ["sip_debugger", "troubleshooting", "system_settings"]
  },
  {
    id: "security",
    group: "Raporlar, Güvenlik & Sistem",
    label: "Güvenlik Kalkanı",
    shortLabel: "Güvenlik",
    perms: ["security", "system_settings"]
  },
  {
    id: "event-logs",
    group: "Raporlar, Güvenlik & Sistem",
    label: "Olay Günlükleri",
    shortLabel: "Loglar",
    perms: ["event_logs", "logs", "system_settings"]
  },
  {
    id: "system-status",
    group: "Raporlar, Güvenlik & Sistem",
    label: "Sistem Panosu & Sağlık",
    shortLabel: "Sistem Sağlığı",
    adminOnly: true
  },
  {
    id: "settings",
    group: "Raporlar, Güvenlik & Sistem",
    label: "Sistem Ayarları",
    shortLabel: "Ayarlar",
    perms: ["system_settings", "roles"]
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
    checkHasPerm(perms, "rag") ||
    checkHasPerm(perms, "knowledge_base") ||
    checkHasPerm(perms, "rules");
  const canPbxOrSysModules = [
    "users",
    "pbx",
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
    (roleLower === "agent" || (!canDashboard && !canWallboard && !canReports && !canAiModules && !canPbxOrSysModules));

  return { isAdmin: false, isWallboardOnly, isAgentOnly };
}

export function getAllowedLandingScreensForRole(roleCode, rolePermissions) {
  const { isAdmin, isWallboardOnly, isAgentOnly } = classifyRoleScope(roleCode, rolePermissions);
  if (isAdmin) {
    return [...LANDING_SCREEN_CATALOG];
  }
  if (isWallboardOnly) {
    return LANDING_SCREEN_CATALOG.filter((s) => s.id === "wallboard");
  }
  if (isAgentOnly) {
    return LANDING_SCREEN_CATALOG.filter((s) => s.id === "call-center");
  }

  const perms = Array.isArray(rolePermissions) ? rolePermissions : [];
  return LANDING_SCREEN_CATALOG.filter((item) => {
    if (item.adminOnly) return false;
    if (Array.isArray(item.perms) && item.perms.some((pref) => checkHasPerm(perms, pref))) {
      return true;
    }
    if (item.allowGeneralSupervisor && !isAgentOnly && !isWallboardOnly) {
      return true;
    }
    return false;
  });
}

export function isLandingTabAllowedForRole(tabId, roleCode, rolePermissions) {
  if (!tabId) return false;
  const { isAdmin, isWallboardOnly, isAgentOnly } = classifyRoleScope(roleCode, rolePermissions);
  if (isAdmin) return true;
  if (isWallboardOnly) return tabId === "wallboard";
  if (isAgentOnly) return tabId === "call-center";

  const perms = Array.isArray(rolePermissions) ? rolePermissions : [];
  if (String(tabId).startsWith("reports-")) {
    return checkHasPerm(perms, "reports") || checkHasPerm(perms, "reports_");
  }
  const catalogMatch = LANDING_SCREEN_CATALOG.find((s) => s.id === tabId);
  if (!catalogMatch) return false;
  if (catalogMatch.adminOnly) return false;
  if (Array.isArray(catalogMatch.perms) && catalogMatch.perms.some((pref) => checkHasPerm(perms, pref))) {
    return true;
  }
  if (catalogMatch.allowGeneralSupervisor) return true;
  return false;
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
  isFreshLogin = false
}) {
  const { isAdmin, isWallboardOnly, isAgentOnly } = classifyRoleScope(roleCode, rolePermissions);
  if (isWallboardOnly) return "wallboard";
  if (isAgentOnly) return "call-center";

  // 1. Direct URL link or F5 page reload (?tab=...) takes precedence when not a fresh login
  if (!isFreshLogin && explicitUrlTab && isLandingTabAllowedForRole(explicitUrlTab, roleCode, rolePermissions)) {
    return explicitUrlTab;
  }

  // 2. User / Admin configured startup preference
  const rawPref = String(
    panelPrefs?.defaultLandingTab || user?.call_panel_prefs?.defaultLandingTab || "auto"
  ).trim();

  if (rawPref === "last_visited") {
    const lastTab = getLastVisitedTab(user, panelPrefs);
    if (lastTab && isLandingTabAllowedForRole(lastTab, roleCode, rolePermissions)) {
      return lastTab;
    }
  } else if (rawPref && rawPref !== "auto") {
    if (isLandingTabAllowedForRole(rawPref, roleCode, rolePermissions)) {
      return rawPref;
    }
  }

  // 3. Role-based smart fallback ("auto")
  if (isAdmin || isLandingTabAllowedForRole("dashboard", roleCode, rolePermissions)) {
    return "dashboard";
  }
  const fallbackPriority = ["wallboard", "call-center", "omnichannel", "reports-pano", "users", "contacts"];
  for (const candidate of fallbackPriority) {
    if (isLandingTabAllowedForRole(candidate, roleCode, rolePermissions)) {
      return candidate;
    }
  }
  const allowedScreens = getAllowedLandingScreensForRole(roleCode, rolePermissions);
  return allowedScreens[0]?.id || "dashboard";
}
