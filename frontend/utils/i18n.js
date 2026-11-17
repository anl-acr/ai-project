import { useState, useEffect, useCallback } from "react";

export const SUPPORTED_LANGUAGES = [
  { code: "tr", label: "Türkçe", shortLabel: "TR", flag: "🇹🇷" },
  { code: "en", label: "English", shortLabel: "EN", flag: "🇬🇧" },
];

const STORAGE_KEY = "aida_ui_lang";

// Exact TR -> EN dictionary (case-insensitive & trimmed lookup supported)
const EXACT_TR_TO_EN = {
  // Brand & Topbar
  "Sistem Ayarları": "System Settings",
  "Kullanıcı Profili ve Menüsü": "User Profile & Menu",
  "Profil Ayarları": "Profile Settings",
  "Profil ve Hesap": "Profile & Account",
  "Profil ve Tercih Ayarları": "Profile & Preference Settings",
  "Kişisel görünüm, yönlendirme, güvenlik ve ses tercihlerinizi yönetin": "Manage your personal appearance, forwarding, security, and audio preferences",
  "Uygulamalar & İndir": "Apps & Download",
  "Masaüstü & Mobil Uygulamalar": "Desktop & Mobile Apps",
  "Çıkış Yap": "Sign Out",
  "Oturumu Kapat": "Log Out",
  "Oturumu Kapat (Logout)": "Log Out",
  "Sistem Girişi Yap (Login)": "Queue Login",
  "Kuyruk Oturumu & Mola": "Queue Session & Break",
  "Mola Durumları & Oturum": "Break Status & Session",
  "Molayı Bitir ve Müsait Duruma Geç": "End Break & Go Available",
  "Mola Türü Seçin": "Select Break Type",
  "Tanımlı mola bulunmamaktadır.": "No break types defined.",
  "Süre sınırı yok": "No time limit",
  "Arayüz Dili": "Interface Language",
  "Dil Seçimi": "Language Selection",
  "Uygulama ve panel dilini seçin (Masaüstü ve Mobil ile senkronize çalışır)": "Select application & panel language (synchronizes across Desktop and Mobile)",
  "← Geri": "← Back",
  "← Ayarlar": "← Settings",
  "← Liste": "← List",

  // Sidebar Groups & Main Navigation
  "Operasyon & İzleme": "Operations & Monitoring",
  "Operasyon ve İzleme": "Operations & Monitoring",
  "Gerçek Zamanlı AI Pano": "Real-Time AI Dashboard",
  "Canlı İzleme Paneli": "Live Wallboard",
  "Temsilci Çağrı Paneli": "Agent Call Panel",
  "Ortak Gelen Kutusu": "Omnichannel Inbox",
  "API Bütçe ve Tüketim": "API Budget & Usage",
  "Yapay Zeka & Bilgi": "AI & Knowledge",
  "AI Temsilcileri": "AI Agents",
  "AI Konfigürasyon Asistanı": "AI Configuration Assistant",
  "Bilgi Bankası (RAG)": "Knowledge Base (RAG)",
  "Kural & Senaryo Editörü": "Rule & Scenario Editor",
  "Santral": "PBX & Telephony",
  "Kullanıcılar": "Users",
  "Anons Yönetimi": "Announcements",
  "ACD Kuyruk": "ACD Queues",
  "Oto Provizyon": "Auto Provisioning",
  "Giden Arama Kuralı": "Outbound Rules",
  "Gelen Arama Kuralı": "Inbound Rules",
  "Çağrı Toplama Grubu": "Call Pickup Groups",
  "Abone Grubu": "Subscriber Groups",
  "Toplu Konfigürasyon Merkezi": "Bulk Configuration Center",
  "Rehber": "Directory",
  "Şirket Rehberi": "Company Directory",
  "Dış Hat Tanımı": "SIP Trunks",
  "Konferans": "Conferences",
  "Hızlı Arama": "Speed Dial",
  "Numara Engelleme": "Number Blocking",
  "Zamanlanmış Raporlar": "Scheduled Reports",
  "Çağrı & Yönlendirme": "Call & Routing",
  "Arama Akış Yönetimi": "Call Flow Management",
  "Mesai & Resmi Tatiller": "Working Hours & Holidays",
  "Mesai Saatleri & Resmi Tatiller": "Working Hours & Public Holidays",
  "Dış Arama (Dialer)": "Outbound Dialer",
  "Randevu Takvimi": "Appointment Calendar",
  "Çağrı Raporları & Analiz": "Call Reports & Analytics",
  "Raporlar & Analiz": "Reports & Analytics",
  "Raporlar, Güvenlik & Sistem": "Reports, Security & System",
  "Yönetim & Ayarlar": "Administration & Settings",
  "Sistem Panosu & Sağlık": "System Health & Status",
  "Olay Günlükleri": "Event Logs",
  "Sorun İnceleme": "Troubleshooting",
  "Güvenlik Kalkanı": "Security Shield",

  // Call Panel Tabs & Mobile Dock
  "Pano": "Dashboard",
  "Performans Panosu": "Performance Dashboard",
  "Web Telefon": "Web Phone",
  "Telefon": "Phone",
  "Temsilciler": "Agents",
  "Kayıp Çağrı": "Missed Calls",
  "Kayıp Çağrılar": "Missed Calls",
  "Planlı Geri Aramalar": "Scheduled Callbacks",
  "Çağrı Geçmişi": "Call History",
  "Sesli Posta": "Voicemail",
  "Sohbet": "Chat",
  "Daha Fazlası": "More",
  "Masa Telefonum": "My Deskphone",
  "GELEN ÇAĞRI": "INBOUND CALLS",
  "GİDEN ÇAĞRI": "OUTBOUND CALLS",
  "TOPLAM MOLA SÜRESİ": "TOTAL BREAK TIME",
  "CEVAPSIZ": "MISSED",
  "Çağrı Dağılımı": "Call Distribution",
  "Çağrı verisi bulunmuyor.": "No call data available.",
  "Mola Dağılımı & Süreler": "Break Distribution & Durations",
  "Henüz mola kullanılmadı.": "No breaks used yet.",
  "Bugünkü Mola Hareketleri (Ne Kadar Süredir Kullanıldı)": "Today's Break Activity (Duration Used)",
  "Bugün kayıtlı mola hareketi bulunmuyor.": "No break activity recorded today.",
  "Numara veya Dahili...": "Number or Extension...",
  "Görüşme Aktif": "Call Active",
  "Aranıyor...": "Calling...",
  "Gelen Çağrı...": "Incoming Call...",
  "Beklemede": "On Hold",
  "Çağrıyı Sonlandır": "End Call",
  "Çağrıyı Reddet": "Decline Call",
  "Yanıtla": "Answer",
  "Reddet": "Decline",
  "Geri Ara": "Call Back",
  "Dinlendi": "Listened",
  "YENİ": "NEW",
  "Son Aramalar": "Recent Searches",
  "Favoriler": "Favorites",
  "Henüz Son Arama Kaydı Yok": "No Recent Search History",
  "Sağ üstteki arama kutusundan kişi, dahili, kuyruk veya numara aradığınızda son 10 aramanız hızlı erişim için bu ekranda listelenir.": "When you search for a contact, extension, queue, or number using the search box above, your last 10 searches will be listed here for quick access.",
  "Kişi, kuyruk veya numara ara...": "Search contact, queue, or number...",
  "Müşteri Sohbetleri": "Customer Chats",
  "İç Yazışma": "Internal Chat",
  "Bana Atananlar": "Assigned to Me",
  "Tüm Sohbetler (AI + Canlı)": "All Chats (AI + Live)",
  "Görüntülemek için bir sohbet seçin": "Select a conversation to view",
  "Sol listeden bir konuşma tıklayın.": "Click a conversation from the left list.",
  "İsim veya tel no ara...": "Search name or phone...",
  "Kuyrukta geri dönülmemiş kayıp çağrı bulunmuyor.": "No unreturned missed calls in queue.",
  "Kuyruğunuza gelip hiçbir temsilci tarafından açılamayan çağrılar burada listelenir. Görüşme sağlandığında listeden otomatik düşer.": "Calls that arrived in your queue and could not be answered by any agent are listed here. Once called back, they are automatically removed.",
  "Seçili kriterlere uygun çağrı kaydı bulunamadı.": "No call records found matching the selected criteria.",
  "Son 1 Haftayı Göster": "Show Last 7 Days",
  "Bugün": "Today",
  "Dün": "Yesterday",
  "Bu Hafta": "This Week",
  "Bu Ay": "This Month",
  "Tüm Zamanlar": "All Time",

  // Active Call Network / Jitter Warnings
  "Çağrı Ağ Bağlantısı Kopuk • Ses İletilemiyor": "Call Network Disconnected • Audio Interrupted",
  "Çağrı Ağ Kalitesi Zayıf • Ses Kesintisi Yaşanabilir": "Poor Call Network Quality • Audio Dropouts Possible",
  "Çağrı Ağ Bağlantısı Dalgalı • Yüksek Jitter / Gecikme": "Unstable Call Network • High Jitter / Latency",
  "Çağrı Ses Kalitesi İyi • Bağlantı Stabil": "Good Call Audio Quality • Connection Stable",
  "Aktif görüşme sırasında sunucu bağlantısı kesildi.": "Server connection lost during active call.",
  "Tekrar Ölç": "Re-test",
  "Ölçülüyor...": "Testing...",

  // Profile Settings Modal Tabs & Sections
  "Görünüm & Tema": "Appearance & Theme",
  "Profiller & Yönlendirme": "Profiles & Forwarding",
  "Güvenlik": "Security",
  "Bildirim & Ses": "Notifications & Audio",
  "Görünüm Modu": "Appearance Mode",
  "Açık": "Light",
  "Koyu": "Dark",
  "Sisteme Göre": "System",
  "Manuel Seçim": "Manual Selection",
  "İşletim Sistemiyle Eşitle": "Sync with OS",
  "Sistem Tema Rengi": "System Theme Color",
  "Animasyon": "Animation",
  "Akıcı": "Fluid",
  "Minimal": "Minimal",
  "Kapalı": "Off",
  "Görünüm Şablonları": "Layout Templates",
  "Şifre Değiştirme": "Change Password",
  "İki Faktörlü Doğrulama (2FA)": "Two-Factor Authentication (2FA)",
  "Bu Cihaz İçin Güvenilir Anahtar": "Trusted Device Key for This Device",

  // System Settings Categories & Items
  "Santral & Ağ": "PBX & Network",
  "Santral Entegrasyonu": "PBX Integration",
  "NAT ve Dış IP Ayarları": "NAT & External IP Settings",
  "Numara Planı": "Numbering Plan",
  "Otoprovizyon Şablonları": "Auto-Provision Templates",
  "SSL Sertifikaları": "SSL Certificates",
  "Organizasyon & Lisans": "Organization & License",
  "Roller": "Roles",
  "Active Directory (LDAP & SSO)": "Active Directory (LDAP & SSO)",
  "Lokasyon ve Departmanlar": "Locations & Departments",
  "Mola Tanımları": "Break Definitions",
  "Müşteri (Tenant) Yönetimi": "Tenant Management",
  "Lisans & Key Yönetimi": "License & Key Management",
  "Yapay Zeka & Analiz": "AI & Analytics",
  "Yapay Zeka API Ayarları": "AI Provider API Settings",
  "AI Görev & Model Yönlendirme": "AI Task & Model Routing",
  "Çağrı Kalite Kontrol": "Call Quality Assurance (QA)",
  "Otomatik Dil Algılama": "Automatic Language Detection",
  "Dinamik Duygu Yönetimi": "Dynamic Emotion Management",
  "AI Fısıldama Yönetimi": "AI Whisper Coaching",
  "Biyometrik Ses Analizi": "Voice Biometrics",
  "ROI Rapor Ayarları": "ROI Report Settings",
  "Kanallar & Entegrasyon": "Channels & Integrations",
  "Kanal Entegrasyonları": "Channel Integrations",
  "Hazır CRM Entegrasyonları": "Ready CRM Integrations",
  "Hızlı Cevaplar": "Canned Responses",
  "Evrensel API Sihirbazı": "Universal API Wizard",
  "Kurumsal Dış API & Token Yönetimi": "Enterprise External API & Token Management",
  "E-Mail Bildirimleri": "Email Notifications",
  "Bakım & Sistem": "Maintenance & System",
  "Sistem Yedekleme": "System Backup",
  "Geri Yükleme Noktası": "Restore Points",
  "Kayıt & Saklama Sistemi": "Recording & Retention Policy",
  "Sistem Versiyonu & Günlük": "System Version & Changelog",

  // Event Logs Panel
  "Kullanıcı Hareket ve Denetim Günlükleri": "User Activity & Audit Logs",
  "Sistemde hangi kullanıcının ne zaman giriş/çıkış yaptığı, hangi ekranlara girdiği ve ne ekleyip çıkardığının veya sildiğinin kaydı.": "Audit trail of user logins/logouts, screen navigation, and all created, updated, or deleted records.",
  "Kayıtları Yenile": "Refresh Logs",
  "Toplam Hareket": "Total Events",
  "Giriş / Çıkış & Oturum": "Login / Logout & Session",
  "Ekran Gezinmeleri": "Screen Navigations",
  "Ekleme / Düzenleme / Silme": "Created / Updated / Deleted",
  "Tüm Hareketler": "All Events",
  "Giriş / Çıkış & Mola": "Login / Logout & Break",
  "Yeni Eklenenler": "Newly Created",
  "Düzenleme & Çıkarma": "Updated & Removed",
  "Silinenler": "Deleted",
  "Tüm Kullanıcılar": "All Users",
  "Tüm Ekranlar / Bölümler": "All Screens / Modules",
  "Kullanıcı adı, dahili, yapılan işlem veya ekran ara...": "Search username, extension, action, or screen...",
  "Tarih & Saat": "Date & Time",
  "Kullanıcı": "User",
  "İşlem Türü": "Action Type",
  "Bölüm / Ekran": "Module / Screen",
  "Yapılan İşlem Açıklaması": "Action Summary",
  "İncele": "Inspect",
  "Detay": "Details",
  "Hareket Kaydı Detayı": "Audit Log Details",
  "İşlemi Yapan Kullanıcı": "Performed By User",
  "Bölüm & İşlem Türü": "Module & Action Type",
  "İşlem Özeti": "Action Summary",
  "Etkilenen Kayıtlar ve Değişiklikler": "Affected Records & Changes",
  "Kayıtlı Kullanıcı Hareketi Bulunamadı": "No User Activity Logs Found",
  "Sayfa başına:": "Per page:",
  "İlk": "First",
  "‹ Önceki": "‹ Prev",
  "Sonraki ›": "Next ›",
  "Son": "Last",

  // Role Settings & Permissions
  "Rol ve Yetki Tanımları": "Role & Permission Definitions",
  "Sistem kullanıcılarının erişebileceği modülleri, yetkilerini ve molalarını detaylıca yapılandırın.": "Configure modules, granular permissions, and break types accessible to system users.",
  "Rollerde ara...": "Search roles...",
  "Yeni Rol Ekle": "Add New Role",
  "Yeni Rol Tanımla": "Create New Role",
  "Rol Kodu": "Role Code",
  "Rol İsmi": "Role Name",
  "Yetki Başlıkları": "Permission Categories",
  "İzin Verilen Yetki": "Granted Permissions",
  "İzin Verilen Mola Tipleri": "Allowed Break Types",
  "Bu rolde abone yok": "No subscribers in this role",
  "Görüntüle": "View",
  "Ekle / Düzenle": "Create / Edit",
  "Ekle/Düzenle": "Create/Edit",
  "Erişim": "Access",

  // Work Hours & Holidays
  "Haftalık Mesai Saatleri": "Weekly Working Hours",
  "Resmi Tatiller & Özel Günler": "Public Holidays & Special Days",
  "Pazartesi": "Monday",
  "Salı": "Tuesday",
  "Çarşamba": "Wednesday",
  "Perşembe": "Thursday",
  "Cuma": "Friday",
  "Cumartesi": "Saturday",
  "Pazar": "Sunday",

  // Common Buttons & Statuses
  "Kaydet": "Save",
  "Değişiklikleri Kaydet": "Save Changes",
  "Vazgeç": "Cancel",
  "İptal": "Cancel",
  "Sil": "Delete",
  "Düzenle": "Edit",
  "Kapat": "Close",
  "Ekle": "Add",
  "Yeni Ekle": "Add New",
  "Tümünü Seç": "Select All",
  "Tümünü Kaldır": "Clear All",
  "Aktif": "Active",
  "Pasif": "Passive",
  "Müsait": "Available",
  "Molada": "On Break",
  "Meşgul": "Busy",
  "Çevrimdışı": "Offline",
  "Çalıyor": "Ringing",
  "Dahili": "Internal",
  "Harici": "External",
  "Kuyruk": "Queue",
  "Akış": "Flow",
};

// Lowercase lookup map for case-insensitive matching
const LOWER_TR_TO_EN = Object.entries(EXACT_TR_TO_EN).reduce((acc, [tr, en]) => {
  acc[tr.toLocaleLowerCase("tr-TR")] = en;
  acc[tr.toLowerCase()] = en;
  return acc;
}, {});

function translateDynamicPatternToEn(trimmed) {
  let m;

  // "Toplam 45 kayıttan 1 - 20 arası gösteriliyor"
  m = trimmed.match(/^Toplam\s+(\d+)\s+kayıttan\s+(\d+)\s*-\s*(\d+)\s+arası\s+gösteriliyor$/i);
  if (m) return `Showing ${m[2]} - ${m[3]} of ${m[1]} records`;

  // "(Toplam 130 Yetki)"
  m = trimmed.match(/^\(Toplam\s+(\d+)\s+Yetki\)$/i);
  if (m) return `(Total ${m[1]} Permissions)`;

  // "5 Abone"
  m = trimmed.match(/^(\d+)\s+Abone$/i);
  if (m) return `${m[1]} Subscriber${Number(m[1]) === 1 ? "" : "s"}`;

  // "0 Kayıt"
  m = trimmed.match(/^(\d+)\s+Kayıt$/i);
  if (m) return `${m[1]} Record${Number(m[1]) === 1 ? "" : "s"}`;

  // "Tümü (8)"
  m = trimmed.match(/^Tümü\s*\((\d+)\)$/i);
  if (m) return `All (${m[1]})`;

  // "Okunmamış (6)"
  m = trimmed.match(/^Okunmamış\s*\((\d+)\)$/i);
  if (m) return `Unread (${m[1]})`;

  // "Kayıp Çağrılar (0)"
  m = trimmed.match(/^Kayıp Çağrılar\s*\((\d+)\)$/i);
  if (m) return `Missed Calls (${m[1]})`;

  // "Planlı Geri Aramalar (0)"
  m = trimmed.match(/^Planlı Geri Aramalar\s*\((\d+)\)$/i);
  if (m) return `Scheduled Callbacks (${m[1]})`;

  // "Mola Türü Seçin (3)"
  m = trimmed.match(/^Mola Türü Seçin\s*\((\d+)\)$/i);
  if (m) return `Select Break Type (${m[1]})`;

  // "HAZIR (1000)"
  m = trimmed.match(/^HAZIR\s*\(([^)]+)\)$/i);
  if (m) return `READY (${m[1]})`;

  // "Rolü Düzenle: ..."
  m = trimmed.match(/^Rolü Düzenle:\s*(.+)$/i);
  if (m) return `Edit Role: ${m[1]}`;

  // "Toplam Kullanım: 0 sn (00:00)"
  m = trimmed.match(/^Toplam Kullanım:\s*(.+)$/i);
  if (m) return `Total Usage: ${m[1].replace(/\bsn\b/g, "s")}`;

  // "Dönem: Bugün"
  m = trimmed.match(/^Dönem:\s*(.+)$/i);
  if (m) {
    const sub = translateStringToEn(m[1]);
    return `Period: ${sub}`;
  }

  // "Süre: 00:03"
  m = trimmed.match(/^Süre:\s*(.+)$/i);
  if (m) return `Duration: ${m[1]}`;

  // "Gecikme: 12 ms • Jitter: 4 ms • Paket Kaybı: %0"
  if (trimmed.startsWith("Gecikme:") && trimmed.includes("Jitter:")) {
    return trimmed
      .replace(/Gecikme:/g, "Latency:")
      .replace(/Paket Kaybı:/g, "Packet Loss:")
      .replace(/Kayıp:/g, "Loss:");
  }

  // "● Hat Kalitesi İyi • Jitter: ..." / "⚠ Zayıf Ağ • Jitter: ..."
  if (trimmed.includes("Hat Kalitesi İyi")) {
    return trimmed.replace("Hat Kalitesi İyi", "Good Line Quality");
  }
  if (trimmed.includes("Zayıf Ağ")) {
    return trimmed.replace("Zayıf Ağ", "Poor Network").replace(/Gecikme:/g, "Latency:");
  }
  if (trimmed.includes("Dalgalı Ağ")) {
    return trimmed.replace("Dalgalı Ağ", "Unstable Network").replace(/Gecikme:/g, "Latency:");
  }

  return null;
}

export function translateStringToEn(rawStr) {
  if (!rawStr || typeof rawStr !== "string") return rawStr;
  const trimmed = rawStr.trim();
  if (!trimmed) return rawStr;

  const exact =
    EXACT_TR_TO_EN[trimmed] ||
    LOWER_TR_TO_EN[trimmed.toLocaleLowerCase("tr-TR")] ||
    LOWER_TR_TO_EN[trimmed.toLowerCase()];

  if (exact) {
    const lead = rawStr.match(/^\s*/)?.[0] || "";
    const trail = rawStr.match(/\s*$/)?.[0] || "";
    return `${lead}${exact}${trail}`;
  }

  const dyn = translateDynamicPatternToEn(trimmed);
  if (dyn) {
    const lead = rawStr.match(/^\s*/)?.[0] || "";
    const trail = rawStr.match(/\s*$/)?.[0] || "";
    return `${lead}${dyn}${trail}`;
  }

  return rawStr;
}

export function getUiLanguage() {
  if (typeof window === "undefined") return "tr";
  try {
    const saved = (localStorage.getItem(STORAGE_KEY) || "tr").trim().toLowerCase();
    return saved === "en" ? "en" : "tr";
  } catch (e) {
    return "tr";
  }
}

export function notifyNativeClientsLanguage(lang) {
  if (typeof window === "undefined") return;
  try {
    // 1. Electron Desktop Bridge
    if (window.aidaDesktop && typeof window.aidaDesktop.updatePreferences === "function") {
      window.aidaDesktop.updatePreferences({ uiLanguage: lang });
    }
    // 2. iOS WKWebView Native Bridge
    if (
      window.webkit &&
      window.webkit.messageHandlers &&
      window.webkit.messageHandlers.aidaNative
    ) {
      window.webkit.messageHandlers.aidaNative.postMessage({
        action: "updatePreferences",
        payload: { uiLanguage: lang },
      });
    }
    // 3. Android Native Bridge
    if (
      window.RunaNativeBridge &&
      typeof window.RunaNativeBridge.postMessage === "function"
    ) {
      window.RunaNativeBridge.postMessage(
        JSON.stringify({
          action: "updatePreferences",
          payload: { uiLanguage: lang },
        })
      );
    }
  } catch (e) {}
}

export async function setUiLanguage(nextLang, options = {}) {
  if (typeof window === "undefined") return "tr";
  const normalized = String(nextLang || "tr").trim().toLowerCase() === "en" ? "en" : "tr";
  const prev = getUiLanguage();

  try {
    localStorage.setItem(STORAGE_KEY, normalized);
    sessionStorage.setItem(STORAGE_KEY, normalized);
  } catch (e) {}

  if (document.documentElement) {
    document.documentElement.setAttribute("lang", normalized);
    document.documentElement.setAttribute("data-aida-lang", normalized);
  }

  applyDomLanguagePass(normalized);
  notifyNativeClientsLanguage(normalized);

  if (prev !== normalized || options.forceBroadcast) {
    try {
      window.dispatchEvent(
        new CustomEvent("AIDA_LANGUAGE_CHANGED", { detail: { lang: normalized } })
      );
    } catch (e) {}
  }

  if (options.saveRemote !== false) {
    const uid =
      options.userId ||
      localStorage.getItem("current_user_id") ||
      sessionStorage.getItem("current_user_id");
    if (uid) {
      try {
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        const host = options.backendHost || window.location.host;
        const baseUrl = host.startsWith("http") ? host : `${protocol}//${host}`;
        await fetch(`${baseUrl}/api/agent/profile/${encodeURIComponent(uid)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ui_language: normalized }),
        });
      } catch (e) {}
    }
  }

  return normalized;
}

const TRANSLATABLE_ATTRS = ["placeholder", "title", "aria-label"];
let isApplyingTranslationPass = false;

export function applyDomLanguagePass(targetLang) {
  if (typeof document === "undefined" || !document.body) return;
  if (isApplyingTranslationPass) return;
  const lang = targetLang || getUiLanguage();
  isApplyingTranslationPass = true;

  try {
    // 1. Walk Text Nodes
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      const parentTag = node.parentElement ? node.parentElement.tagName : "";
      if (
        parentTag === "SCRIPT" ||
        parentTag === "STYLE" ||
        parentTag === "NOSCRIPT" ||
        parentTag === "TEXTAREA" ||
        parentTag === "CODE"
      ) {
        continue;
      }

      const currentVal = node.nodeValue || "";
      if (!currentVal.trim()) continue;

      if (lang === "en") {
        // If already translated and DOM text hasn't changed from our English output, skip
        if (node.__aidaLastEnVal === currentVal && node.__aidaOrigTrVal) {
          continue;
        }
        // Otherwise, currentVal is the source Turkish text (either fresh or updated by React)
        const sourceTr =
          node.__aidaOrigTrVal && node.__aidaLastEnVal === currentVal
            ? node.__aidaOrigTrVal
            : currentVal;
        const translatedEn = translateStringToEn(sourceTr);
        if (translatedEn !== sourceTr) {
          node.__aidaOrigTrVal = sourceTr;
          node.__aidaLastEnVal = translatedEn;
          if (node.nodeValue !== translatedEn) {
            node.nodeValue = translatedEn;
          }
        }
      } else {
        // Restore original Turkish text immediately when switching back to TR
        if (node.__aidaOrigTrVal && node.nodeValue === node.__aidaLastEnVal) {
          node.nodeValue = node.__aidaOrigTrVal;
        }
      }
    }

    // 2. Translate Attributes (placeholder, title, aria-label)
    const attrSelector = "[placeholder],[title],[aria-label]";
    document.querySelectorAll(attrSelector).forEach((el) => {
      TRANSLATABLE_ATTRS.forEach((attr) => {
        const val = el.getAttribute(attr);
        if (!val || !val.trim()) return;
        const origKey = `data-aida-orig-tr-${attr}`;
        const lastEnKey = `data-aida-last-en-${attr}`;

        if (lang === "en") {
          const prevEn = el.getAttribute(lastEnKey);
          const prevTr = el.getAttribute(origKey);
          if (prevEn === val && prevTr) return;

          const sourceTr = prevEn === val && prevTr ? prevTr : val;
          const translatedEn = translateStringToEn(sourceTr);
          if (translatedEn !== sourceTr) {
            el.setAttribute(origKey, sourceTr);
            el.setAttribute(lastEnKey, translatedEn);
            el.setAttribute(attr, translatedEn);
          }
        } else {
          const origTr = el.getAttribute(origKey);
          const prevEn = el.getAttribute(lastEnKey);
          if (origTr && val === prevEn) {
            el.setAttribute(attr, origTr);
          }
        }
      });
    });
  } catch (e) {
  } finally {
    isApplyingTranslationPass = false;
  }
}

let globalObserverInstalled = false;
let rafId = null;

export function installGlobalDomTranslator() {
  if (typeof window === "undefined" || globalObserverInstalled) return;
  globalObserverInstalled = true;

  const initialLang = getUiLanguage();
  if (document.documentElement) {
    document.documentElement.setAttribute("lang", initialLang);
    document.documentElement.setAttribute("data-aida-lang", initialLang);
  }

  const schedulePass = () => {
    if (rafId) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      const curLang = getUiLanguage();
      if (curLang === "en") {
        applyDomLanguagePass("en");
      }
    });
  };

  if (initialLang === "en") {
    schedulePass();
  }

  const obs = new MutationObserver(() => {
    if (getUiLanguage() === "en" && !isApplyingTranslationPass) {
      schedulePass();
    }
  });

  if (document.documentElement) {
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
}

export function useUiLanguage() {
  const [lang, setLangState] = useState(() => getUiLanguage());

  useEffect(() => {
    installGlobalDomTranslator();
    setLangState(getUiLanguage());

    const onLangChanged = (e) => {
      const next = e?.detail?.lang || getUiLanguage();
      setLangState(next);
    };
    window.addEventListener("AIDA_LANGUAGE_CHANGED", onLangChanged);
    return () => window.removeEventListener("AIDA_LANGUAGE_CHANGED", onLangChanged);
  }, []);

  const changeLanguage = useCallback((nextLang, opts = {}) => {
    return setUiLanguage(nextLang, opts);
  }, []);

  return { lang, setLanguage: changeLanguage, languages: SUPPORTED_LANGUAGES };
}
