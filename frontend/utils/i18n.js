import { useState, useEffect, useCallback } from "react";

export const SUPPORTED_LANGUAGES = [
  { code: "tr", label: "Türkçe", shortLabel: "TR", flag: "🇹🇷" },
  { code: "en", label: "English", shortLabel: "EN", flag: "🇬🇧" },
];

const STORAGE_KEY = "aida_ui_lang";

// ============================================================================
// 1. EXACT TR -> EN DICTIONARY (Titles, Headers, Descriptions, Empty States)
// ============================================================================
const EXACT_TR_TO_EN = {
  // Brand & Topbar & Global Search
  "Akıllı İletişim Platformu": "Smart Communication Platform",
  "OMNICHANNEL İLETİŞİM MERKEZİ": "OMNICHANNEL CONTACT CENTER",
  "TEMSİLCİ ÇAĞRI PANELİ": "AGENT CALL PANEL",
  "CANLI İZLEME PANELİ": "LIVE WALLBOARD",
  "Menü, ayar, kullanıcı, dahili veya işlem ara... (Ctrl+K)": "Search menu, settings, user, extension, or action... (Ctrl+K)",
  "Menü, ayar, kullanıcı, dahili veya işlem ara...": "Search menu, settings, user, extension, or action...",
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
  "Ana Müşteri": "Main Tenant",
  "Ana Müşteri (Varsayılan)": "Main Tenant (Default)",
  "Tüm Müşteriler": "All Tenants",
  "Uygula": "Apply",
  "Uygulandı": "Applied",
  "Uygulanamadı": "Failed to Apply",
  "⚠️ LİSANS DOLDU": "⚠️ LICENSE EXPIRED",
  "Sistem Lisans Yönetimi": "System License Management",

  // Real-Time AI Dashboard (Main Screen)
  "AKTİF AI GÖRÜŞMELERİ": "ACTIVE AI CALLS",
  "Bugün toplam": "Today total",
  "çağrı AI tarafından karşılandı": "calls handled by AI",
  "AI OTONOM ÇÖZÜM ORANI": "AI AUTONOMOUS RESOLUTION RATE",
  "CANLI DUYGU & MEMNUNİYET": "LIVE SENTIMENT & SATISFACTION",
  "Aktif kriz veya şikayet alarmı yok": "No active crisis or complaint alerts",
  "TEMSİLCİYE DEVİR & ORT. SÜRE": "AGENT HANDOFF & AVG. DURATION",
  "devir": "handoffs",
  "AI asistanından canlı temsilciye aktarılan": "Transferred from AI assistant to live agent",
  "AKTİF ARAMA LİSTESİ": "ACTIVE CALL LIST",
  "Aktif Görüşme Bulunmuyor": "No Active Calls",
  "Telefon hattı boşta. Arama yapıldığında listelenecektir.": "Phone line is idle. Calls will be listed when active.",
  "Canlı Arama Konsolu": "Live Call Console",
  "İzlemek istediğiniz aktif bir aramayı soldaki listeden seçin.": "Select an active call from the left list to monitor.",
  "AI BÜTÇE & KREDİ TÜKETİM ÖZETİ": "AI BUDGET & CREDIT USAGE SUMMARY",
  "BUGÜN EN ÇOK ARAYANLAR & KONU DAĞILIMI": "TODAY'S TOP CALLERS & TOPIC DISTRIBUTION",
  "Bugün henüz çağrı kaydı oluşmadı.": "No call records generated today yet.",
  "Panoyu Özelleştir": "Customize Dashboard",

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
  "Toplu Konfigürasyon": "Bulk Configuration",
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
  "Saate Göre Otomatik": "Scheduled Auto",
  "Sistem Tema Rengi": "System Theme Color",
  "Animasyon": "Animation",
  "Akıcı": "Fluid",
  "Akıcı (Varsayılan)": "Fluid (Default)",
  "Minimal": "Minimal",
  "Minimal (Hızlı)": "Minimal (Fast)",
  "Kapalı": "Off",
  "Kapalı (Anında)": "Off (Instant)",
  "Görünüm Şablonları": "Layout Templates",
  "Şifre Değiştirme": "Change Password",
  "İki Faktörlü Doğrulama (2FA)": "Two-Factor Authentication (2FA)",
  "Bu Cihaz İçin Güvenilir Anahtar": "Trusted Device Key for This Device",
  "Bu Bilgisayarın Cihaz Anahtarı (Güvenilir PC Kimliği)": "This Computer's Device Key (Trusted PC ID)",
  "Arayüz Oturum Süresi & Ekran Kapatma": "Session Timeout & Auto Sign-Out",
  "Şifre Geçerlilik Süresi": "Password Expiration Policy",

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

const LOWER_TR_TO_EN = Object.entries(EXACT_TR_TO_EN).reduce((acc, [tr, en]) => {
  acc[tr.toLocaleLowerCase("tr-TR")] = en;
  acc[tr.toLowerCase()] = en;
  return acc;
}, {});

// ============================================================================
// 2. COMPOSITIONAL MULTI-WORD PHRASE & VOCABULARY TRANSLATOR
//    Handles all inner panel contents, table headers, descriptions, and badges
// ============================================================================
const MULTI_WORD_PHRASES = [
  ["gerçek zamanlı ai pano", "Real-Time AI Dashboard"],
  ["canlı izleme paneli", "Live Wallboard"],
  ["temsilci çağrı paneli", "Agent Call Panel"],
  ["ortak gelen kutusu", "Omnichannel Inbox"],
  ["api bütçe ve tüketim", "API Budget & Usage"],
  ["ai konfigürasyon asistanı", "AI Configuration Assistant"],
  ["bilgi bankası", "Knowledge Base"],
  ["kural & senaryo editörü", "Rule & Scenario Editor"],
  ["kural ve senaryo editörü", "Rule & Scenario Editor"],
  ["anons yönetimi", "Announcement Management"],
  ["acd kuyruk yönetimi", "ACD Queue Management"],
  ["acd arama kuyrukları", "ACD Call Queues"],
  ["oto provizyon", "Auto Provisioning"],
  ["otoprovizyon şablonları", "Auto-Provision Templates"],
  ["giden arama kuralı", "Outbound Call Rules"],
  ["giden arama kuralları", "Outbound Call Rules"],
  ["gelen arama kuralı", "Inbound Call Rules"],
  ["gelen arama kuralları", "Inbound Call Rules"],
  ["çağrı toplama grubu", "Call Pickup Groups"],
  ["çağrı toplama grupları", "Call Pickup Groups"],
  ["abone grubu", "Subscriber Groups"],
  ["abone grupları", "Subscriber Groups"],
  ["toplu konfigürasyon merkezi", "Bulk Configuration Center"],
  ["toplu konfigürasyon", "Bulk Configuration"],
  ["dış hat tanımı", "SIP Trunks"],
  ["dış hatlar", "SIP Trunks"],
  ["hızlı arama", "Speed Dial"],
  ["numara engelleme", "Number Blocking"],
  ["kara liste", "Blacklist"],
  ["zamanlanmış raporlar", "Scheduled Reports"],
  ["arama akış yönetimi", "Call Flow Management"],
  ["çağrı akışı", "Call Flow"],
  ["mesai saatleri & resmi tatiller", "Working Hours & Public Holidays"],
  ["mesai & resmi tatiller", "Working Hours & Holidays"],
  ["mesai saatleri", "Working Hours"],
  ["resmi tatiller", "Public Holidays"],
  ["dış arama", "Outbound Dialer"],
  ["randevu takvimi", "Appointment Calendar"],
  ["sistem panosu & sağlık", "System Health & Status"],
  ["olay günlükleri", "Event Logs"],
  ["sorun inceleme", "Troubleshooting"],
  ["güvenlik kalkanı", "Security Shield"],
  ["santral entegrasyonu", "PBX Integration"],
  ["nat ve dış ip ayarları", "NAT & External IP Settings"],
  ["numara planı", "Numbering Plan"],
  ["ssl sertifikaları", "SSL Certificates"],
  ["lokasyon ve departmanlar", "Locations & Departments"],
  ["mola tanımları", "Break Definitions"],
  ["müşteri (tenant) yönetimi", "Tenant Management"],
  ["lisans & key yönetimi", "License & Key Management"],
  ["yapay zeka api ayarları", "AI Provider API Settings"],
  ["ai görev & model yönlendirme", "AI Task & Model Routing"],
  ["çağrı kalite kontrol", "Call Quality Assurance"],
  ["otomatik dil algılama", "Automatic Language Detection"],
  ["dinamik duygu yönetimi", "Dynamic Emotion Management"],
  ["ai fısıldama yönetimi", "AI Whisper Management"],
  ["biyometrik ses analizi", "Voice Biometrics"],
  ["roi rapor ayarları", "ROI Report Settings"],
  ["kanal entegrasyonları", "Channel Integrations"],
  ["hazır crm entegrasyonları", "Ready CRM Integrations"],
  ["hızlı cevaplar", "Canned Responses"],
  ["evrensel api sihirbazı", "Universal API Wizard"],
  ["e-mail bildirimleri", "Email Notifications"],
  ["sistem yedekleme", "System Backup"],
  ["geri yükleme noktası", "Restore Points"],
  ["kayıt & saklama sistemi", "Recording & Retention Policy"],
  ["sistem versiyonu & günlük", "System Version & Changelog"],
  ["özel rapor tasarımcısı", "Custom Report Builder"],
  ["ses kayıtları", "Audio Recordings"],
  ["çağrı transkripti", "Call Transcripts"],
  ["duygu analizi", "Sentiment Analysis"],
  ["kalite değerlendirmeleri", "Quality Evaluations"],
  ["temsilci notları", "Agent Notes"],
  ["temsilci performans", "Agent Performance"],
  ["kuyruk & bekleme analitiği", "Queue & Wait Analytics"],
  ["anket raporları", "Survey Reports"],
  ["duygu durumu ısı haritası", "Sentiment Heatmap"],
  ["kelime bulutu & trendler", "Word Cloud & Trends"],
  ["ilk aramada çözüm", "First Call Resolution"],
  ["kaçan çağrı analizi", "Missed Call Analysis"],
  ["temsilci kronolojisi", "Agent Timeline"],
  ["yoğunluk raporu", "Traffic Load Report"],
  ["hat kapasite raporu", "Trunk Capacity Report"],
  ["did raporu", "DID Report"],
  ["operatör dakika & paket raporu", "Carrier Minute & Package Report"],
  ["hatalı & eşleşmeyen çağrı raporu", "Invalid & Unmatched Call Report"],
  ["ivr terk oranı", "IVR Drop Rate"],
  ["aktarma & bekletme", "Transfer & Hold"],
  ["verimlilik karşılaştırması", "Efficiency Comparison"],
  ["müşteri çile noktaları", "Customer Friction Points"],
  ["senaryo sadakati raporu", "Scenario Compliance Report"],
  ["sessizlik & söz kesme", "Silence & Interruption"],
  ["ceo özet raporu", "CEO Executive Summary"],
  ["niyet raporu", "Intent Report"],
  ["mola & puantaj raporu", "Break & Attendance Report"],
  ["çağrı sonuç kodları", "Call Disposition Codes"],
  ["kampanya & geri arama", "Campaign & Callback"],
  ["kuyruk sla & hız dilimleri", "Queue SLA & Speed Tiers"],
  ["tekrar eden arayanlar", "Repeat Callers"],
  ["departman & çağrı toplama", "Department & Call Pickup"],
  ["ses kalitesi", "Voice Quality"],
  ["çağrı yönlendirme", "Call Forwarding"],
  ["süpervizör dinleme & müdahale", "Supervisor Listen & Barge"],
  ["engellenen çağrı & ihlal raporu", "Blocked Call & Violation Report"],
  ["sesli posta raporu", "Voicemail Report"],
  ["konferans odası kullanım raporu", "Conference Room Usage Report"],
  ["aktif görüşme bulunmuyor", "No Active Calls"],
  ["kayıt bulunamadı", "No records found"],
  ["sonuç bulunamadı", "No results found"],
  ["veri bulunamadı", "No data found"],
  ["henüz kayıt yok", "No records yet"],
  ["değişiklikleri kaydet", "Save Changes"],
  ["yeni kullanıcı ekle", "Add New User"],
  ["yeni kuyruk ekle", "Add New Queue"],
  ["yeni kural ekle", "Add New Rule"],
  ["yeni kayıt ekle", "Add New Record"],
  ["yeni ekle", "Add New"],
  ["tümünü seç", "Select All"],
  ["tümünü kaldır", "Clear All"],
  ["dışa aktar", "Export"],
  ["içe aktar", "Import"],
  ["panoyu özelleştir", "Customize Dashboard"],
  ["devre dışı", "Disabled"],
  ["isteğe bağlı", "Optional"],
  ["tüm zamanlar", "All Time"],
  ["son 7 gün", "Last 7 Days"],
  ["son 30 gün", "Last 30 Days"],
  ["bu hafta", "This Week"],
  ["bu ay", "This Month"],
  ["geçen ay", "Last Month"],
  ["ad soyad", "Full Name"],
  ["kullanıcı adı", "Username"],
  ["dahili numara", "Extension Number"],
  ["e-posta adresi", "Email Address"],
  ["telefon numarası", "Phone Number"],
  ["cep telefonu", "Mobile Phone"],
  ["çalma stratejisi", "Ring Strategy"],
  ["çalma süresi", "Ring Timeout"],
  ["bekleme süresi", "Wait Time"],
  ["görüşme süresi", "Talk Duration"],
  ["toplam çağrı", "Total Calls"],
  ["gelen çağrı", "Inbound Calls"],
  ["giden çağrı", "Outbound Calls"],
  ["cevapsız çağrı", "Missed Calls"],
  ["kayıp çağrı", "Missed Calls"],
  ["sesli posta", "Voicemail"],
  ["yapay zeka", "Artificial Intelligence"],
  ["canlı temsilci", "Live Agent"],
  ["müşteri temsilcisi", "Customer Representative"],
  ["sistem yöneticisi", "System Administrator"],
  ["aşağıda seçtiğiniz", "selected below"],
  ["19 mayıs atatürk", "May 19 Commemoration of Atatürk"],
  ["28 ekim cumhuriyet bayramı arifesi", "Oct 28 Republic Day Eve"],
  ["29 ekim cumhuriyet bayramı", "Oct 29 Republic Day"],
  ["30 ağustos zafer bayramı", "Aug 30 Victory Day"],
  ["virgülle ayırın", "separate with commas"],
  ["abd doğu", "US East"],
  ["acw / işlemde", "ACW / Wrap-Up"],
  ["ai gönderim koşulu", "AI Dispatch Condition"],
  ["ai medya & katalog kütüphanesi", "AI Media & Catalog Library"],
  ["ai vs. insan performansı", "AI vs. Human Performance"],
  ["alıcı kanalları", "Recipient Channels"],
  ["bağlantıyı test et", "Test Connection"],
  ["belirli sayıda tekrarlayan döngü / sayaç kontrolü", "Loop / Counter control repeating a set number of times"],
  ["bilgisayarın gece/gündüz temasını takip eder.", "Follows your computer's light/dark theme."],
  ["büyüktür", "Greater than"],
  ["küçüktür", "Less than"],
  ["eşittir", "Equals"],
  ["did numaraları", "DID Numbers"],
  ["dns çözümle", "Resolve DNS"],
  ["dinamik tts düğümünde", "in Dynamic TTS node"],
  ["doğrulandı", "Verified"],
  ["doğrulanıyor", "Verifying"],
  ["doğrusal sıralı", "Linear"],
  ["döngü (sayaç)", "Loop (Counter)"],
  ["dönüldü (ulaşılamadı)", "Returned (Unreachable)"],
  ["düğüm / ip", "Node / IP"],
  ["eklenecek / yenilenen özellikler", "Added / Updated Features"],
  ["eksik wrap-up çağrısı", "Missing Wrap-Up Call"],
  ["eşleşmeyen did (anında hangup)", "Unmatched DID (Immediate Hangup)"],
  ["ferah kart kutucukları görünümü", "Spacious card tiles view"],
  ["kompakt kart kutucukları görünümü", "Compact card tiles view"],
  ["kompakt büyüteç", "Compact magnifier"],
  ["gerçekleşen toplantı", "Completed Meeting"],
  ["grafikte çizilecek metrik", "Metric to Plot on Chart"],
  ["gönderilecek whatsapp mesajı", "WhatsApp Message to Send"],
  ["görünür pencereler", "Visible Widgets"],
  ["görünür sütunlar", "Visible Columns"],
  ["görüşmeyi kendinize devralın", "Take over the call"],
  ["güvenli ip / cidr bloğu", "Trusted IP / CIDR Block"],
  ["https & wss tls güvenliği", "HTTPS & WSS TLS Security"],
  ["ip adresi", "IP ADDRESS"],
  ["mac adresi", "MAC ADDRESS"],
  ["jetonu nereden alacağım", "Where do I get the token"],
  ["kvkk & onay kontrolü", "Privacy & Consent Check"],
  ["karşı tarafa gönderilecek json şablonu", "JSON Payload Template to Send"],
  ["karşılaştırma operatörü", "Comparison Operator"],
  ["kaybedilmek üzereyken çevrilen ciro", "Revenue recovered from churn risk"],
  ["kaynak dökümanlar", "Source Documents"],
  ["kesintisiz yedekleme güvencesi", "Continuous Backup Assurance"],
  ["kişisel verilerinizin işlenmesini onaylıyor musunuz?", "Do you consent to the processing of your personal data?"],
  ["klavye kısayolları", "Keyboard Shortcuts"],
  ["konsol çıktısı", "Console Output"],
  ["kurban bayramı arifesi", "Eid al-Adha Eve"],
  ["kurban bayramı", "Eid al-Adha"],
  ["ramazan bayramı arifesi", "Eid al-Fitr Eve"],
  ["ramazan bayramı", "Eid al-Fitr"],
  ["kurulum kılavuzu chat botu", "Setup guide chatbot"],
  ["kurumsal ofis & klavye tuşlaması", "Corporate Office & Keyboard Typing"],
  ["kurye şikayeti", "Courier Complaint"],
  ["kuyrukta kaçanlar", "Abandoned in Queue"],
  ["lisanslı ai motorları", "Licensed AI Engines"],
  ["lisansı doğrula & aktifleştir", "Verify & Activate License"],
  ["login / logout zamanı", "Login / Logout Time"],
  ["merkez ofisimiz istanbul maslak teknoloji kampüsü", "Our headquarters at Istanbul Maslak Technology Campus"],
  ["meta whatsapp cloud api (0850 işletme hattı)", "Meta WhatsApp Cloud API (0850 Business Line)"],
  ["microsoft edge neural tts (ücretsiz / sıfır token)", "Microsoft Edge Neural TTS (Free / Zero Token)"],
  ["mikrofon donanımı", "Microphone Hardware"],
  ["modem reset yönlendirmesi", "Modem Reset Guidance"],
  ["nasıl eşleştirilir?", "How to Pair?"],
  ["nasıl çalışır?", "How It Works?"],
  ["otoprovizyon", "AUTOPROVISIONING"],
  ["omnichannel mesajlaşma merkezi", "Omnichannel Messaging Center"],
  ["operasyonel başarılar", "Operational Wins"],
  ["operasyonlarınız şu anda hedeflenen hizmet standartlarının %12 üzerinde seyrediyor.", "Your operations are currently performing 12% above target service standards."],
  ["parametre değerleri", "Parameter Values"],
  ["pasta / donut dağılım", "Pie / Donut Distribution"],
  ["rehberde arayın", "Search directory"],
  ["servis seviyesi", "SERVICE LEVEL"],
  ["sip başlıkları", "SIP Headers"],
  ["sip güvenliği", "SIP Security"],
  ["sip notify gönderilemedi", "SIP NOTIFY could not be sent"],
  ["sert / kararlı (kısa, ciddi & otoriter)", "Firm / Decisive (Brief, Serious & Authoritative)"],
  ["sertifikalar yüklendi", "Certificates Uploaded"],
  ["sertifikanıza ait private key.", "Private Key for your certificate."],
  ["servis / sağlayıcı", "Service / Provider"],
  ["seçilenleri çıkart", "Remove Selected"],
  ["tümünü çıkart", "Remove All"],
  ["tümünü çaldır", "Ring All"],
  ["supervizor işlemleri", "Supervisor Actions"],
  ["sözleşme onayı", "Contract Confirmation"],
  ["sürükle & bırak", "Drag & Drop"],
  ["sıcak akortlu melodi", "Warm Tuned Melody"],
  ["yumuşak melodi", "Soft Melody"],
  ["sıralı hafızalı", "Round Robin Memory"],
  ["sırayla hatırlamalı", "Round Robin Memory"],
  ["şifreli sinyalizasyon", "Encrypted Signaling"],
  ["takım lideri", "Team Leader"],
  ["tekrarla (döngü)", "Repeat (Loop)"],
  ["tenant kotası", "Tenant Quota"],
  ["transport protokolü", "Transport Protocol"],
  ["trend değişimi", "Trend Change"],
  ["uygunsuz dil / küfür tespiti", "Profanity / Abuse Detection"],
  ["vurgu şiddeti", "Emphasis Style"],
  ["web servis (api) düğümünden", "from Web Service (API) Node"],
  ["whatsapp / gsm numaranız", "Your WhatsApp / Mobile Number"],
  ["xml konfigürasyonu", "XML Configuration"],
  ["yapılandır & test et", "Configure & Test"],
  ["yasaklanacak ifade", "Phrase to Block"],
  ["yasaklı kelime / cümle", "Blocked Word / Phrase"],
  ["yemek molası", "Lunch Break"],
  ["ihtiyaç molası", "Restroom / Personal Break"],
  ["yenilenme günü", "Renewal Day"],
  ["yük seviyesi", "Load Level"],
  ["zeka modeli & özellikler", "AI Model & Capabilities"],
  ["zili çal", "Ring Bell"],
  ["çalma düzeni", "Ring Strategy"],
  ["çağrılan adres", "Called Endpoint"],
  ["çevir & seslendir", "Translate & Speak"],
  ["çizgi trend", "Line Trend"],
  ["öfkeli / kızgın", "Angry / Upset"],
  ["üyeler & yöneticiler", "Members & Admins"],
  ["üyelik iptali", "Membership Cancellation"],
  ["içerik modülleri", "Content Modules"],
  ["işlemi onaylayın", "Confirm Action"],
  ["şirket adresi & ulaşım", "Company Address & Directions"],
  ["şu anda bağlandığınız ip adresini güvenli listeye ekler", "Adds your current IP address to the trusted list"],
  ["panodan yapıştır", "Paste from Clipboard"],
];

const WORD_DICT_TR_EN = {
  "ve": "and",
  "veya": "or",
  "için": "for",
  "ile": "with",
  "olarak": "as",
  "göre": "by",
  "tarafından": "by",
  "üzerinden": "via",
  "sonra": "after",
  "önce": "before",
  "arasında": "between",
  "arası": "to",
  "kadar": "up to",
  "tüm": "All",
  "tümü": "All",
  "hepsi": "All",
  "hiç": "None",
  "yok": "None",
  "var": "Available",
  "evet": "Yes",
  "hayır": "No",
  "aktif": "Active",
  "pasif": "Passive",
  "açık": "On",
  "kapalı": "Off",
  "müsait": "Available",
  "uygun": "Available",
  "molada": "On Break",
  "meşgul": "Busy",
  "çevrimiçi": "Online",
  "çevrimdışı": "Offline",
  "çalıyor": "Ringing",
  "beklemede": "On Hold",
  "görüşmede": "In Call",
  "hazır": "Ready",
  "yeni": "New",
  "eski": "Old",
  "ekle": "Add",
  "düzenle": "Edit",
  "güncelle": "Update",
  "sil": "Delete",
  "kaldır": "Remove",
  "kaydet": "Save",
  "uygula": "Apply",
  "iptal": "Cancel",
  "vazgeç": "Cancel",
  "kapat": "Close",
  "aç": "Open",
  "göster": "Show",
  "gizle": "Hide",
  "ara": "Search",
  "arama": "Call",
  "aramalar": "Calls",
  "arayan": "Caller",
  "arayanlar": "Callers",
  "aranan": "Callee",
  "çağrı": "Call",
  "çağrılar": "Calls",
  "çağrıları": "Calls",
  "görüşme": "Call",
  "görüşmeler": "Calls",
  "görüşmeleri": "Calls",
  "temsilci": "Agent",
  "temsilciler": "Agents",
  "temsilciye": "to Agent",
  "kullanıcı": "User",
  "kullanıcılar": "Users",
  "abone": "Subscriber",
  "aboneler": "Subscribers",
  "müşteri": "Customer",
  "müşteriler": "Customers",
  "kuyruk": "Queue",
  "kuyruklar": "Queues",
  "kuyruğu": "Queue",
  "dahili": "Extension",
  "dahililer": "Extensions",
  "harici": "External",
  "numara": "Number",
  "numarası": "Number",
  "numaralar": "Numbers",
  "telefon": "Phone",
  "santral": "PBX",
  "hat": "Line",
  "hatlar": "Lines",
  "dış": "Outbound",
  "iç": "Internal",
  "gelen": "Inbound",
  "giden": "Outbound",
  "cevapsız": "Missed",
  "kaçan": "Missed",
  "kayıp": "Missed",
  "bekleyen": "Waiting",
  "bekleme": "Wait",
  "mola": "Break",
  "molalar": "Breaks",
  "oturum": "Session",
  "süre": "Duration",
  "süresi": "Duration",
  "ortalama": "Average",
  "ort.": "Avg.",
  "toplam": "Total",
  "adet": "Count",
  "sayısı": "Count",
  "oranı": "Rate",
  "dağılımı": "Distribution",
  "özeti": "Summary",
  "özet": "Summary",
  "detay": "Detail",
  "detaylar": "Details",
  "detayları": "Details",
  "detaylı": "Detailed",
  "liste": "List",
  "listesi": "List",
  "tablo": "Table",
  "pano": "Dashboard",
  "panosu": "Dashboard",
  "ekran": "Screen",
  "ekranı": "Screen",
  "panel": "Panel",
  "paneli": "Panel",
  "bölüm": "Section",
  "modül": "Module",
  "ayar": "Setting",
  "ayarlar": "Settings",
  "ayarları": "Settings",
  "yapılandırma": "Configuration",
  "konfigürasyon": "Configuration",
  "yönetim": "Management",
  "yönetimi": "Management",
  "kontrol": "Control",
  "güvenlik": "Security",
  "yetki": "Permission",
  "yetkiler": "Permissions",
  "yetkileri": "Permissions",
  "rol": "Role",
  "roller": "Roles",
  "grup": "Group",
  "grubu": "Group",
  "gruplar": "Groups",
  "grupları": "Groups",
  "kural": "Rule",
  "kuralı": "Rule",
  "kurallar": "Rules",
  "kuralları": "Rules",
  "senaryo": "Scenario",
  "akış": "Flow",
  "akışı": "Flow",
  "yönlendirme": "Routing",
  "aktarma": "Transfer",
  "devir": "Handoff",
  "konferans": "Conference",
  "rehber": "Directory",
  "rehberi": "Directory",
  "anons": "Announcement",
  "anonslar": "Announcements",
  "ses": "Audio",
  "sesli": "Voice",
  "kayıt": "Record",
  "kayıtlar": "Records",
  "kayıtları": "Records",
  "rapor": "Report",
  "raporu": "Report",
  "raporlar": "Reports",
  "raporları": "Reports",
  "analiz": "Analysis",
  "analizi": "Analysis",
  "kalite": "Quality",
  "performans": "Performance",
  "duygu": "Sentiment",
  "memnuniyet": "Satisfaction",
  "çözüm": "Resolution",
  "otonom": "Autonomous",
  "canlı": "Live",
  "anlık": "Real-Time",
  "otomatik": "Automatic",
  "manuel": "Manual",
  "varsayılan": "Default",
  "özel": "Custom",
  "genel": "General",
  "standart": "Standard",
  "önerilen": "Recommended",
  "zorunlu": "Required",
  "opsiyonel": "Optional",
  "başarılı": "Successful",
  "başarısız": "Failed",
  "hata": "Error",
  "hatalı": "Invalid",
  "uyarı": "Warning",
  "bilgi": "Info",
  "durum": "Status",
  "durumu": "Status",
  "tarih": "Date",
  "saat": "Hour",
  "dakika": "Minute",
  "saniye": "Second",
  "sn": "s",
  "dk": "min",
  "gün": "Day",
  "günlük": "Daily",
  "hafta": "Week",
  "haftalık": "Weekly",
  "ay": "Month",
  "aylık": "Monthly",
  "yıl": "Year",
  "yıllık": "Yearly",
  "bugün": "Today",
  "dün": "Yesterday",
  "şimdi": "Now",
  "henüz": "Yet",
  "seçin": "Select",
  "seçiniz": "Select",
  "seçili": "Selected",
  "filtre": "Filter",
  "filtrele": "Filter",
  "temizle": "Clear",
  "sıfırla": "Reset",
  "yenile": "Refresh",
  "indir": "Download",
  "yükle": "Upload",
  "gönder": "Send",
  "başlat": "Start",
  "durdur": "Stop",
  "bitir": "Finish",
  "onayla": "Confirm",
  "reddet": "Decline",
  "yanıtla": "Answer",
  "dinle": "Listen",
  "incele": "Inspect",
  "görüntüle": "View",
  "kopyala": "Copy",
  "test": "Test",
  "kanal": "Channel",
  "kanallar": "Channels",
  "mesaj": "Message",
  "mesajlar": "Messages",
  "sohbet": "Chat",
  "sohbetler": "Chats",
  "not": "Note",
  "notlar": "Notes",
  "etiket": "Tag",
  "etiketler": "Tags",
  "cihaz": "Device",
  "cihazlar": "Devices",
  "sunucu": "Server",
  "bağlantı": "Connection",
  "bağlantısı": "Connection",
  "bağlı": "Connected",
  "kopuk": "Disconnected",
  "bütçe": "Budget",
  "kredi": "Credit",
  "tüketim": "Usage",
  "kullanım": "Usage",
  "konu": "Topic",
  "niyet": "Intent",
  "şablon": "Template",
  "şablonlar": "Templates",
  "şablonları": "Templates",
  "lokasyon": "Location",
  "departman": "Department",
  "şube": "Branch",
  "personel": "Staff",
  "kişi": "Contact",
  "kişiler": "Contacts",
  "firma": "Company",
  "isim": "Name",
  "ad": "Name",
  "adı": "Name",
  "soyad": "Surname",
  "açıklama": "Description",
  "açıklaması": "Description",
  "neden": "Reason",
  "tür": "Type",
  "türü": "Type",
  "tipi": "Type",
  "seviye": "Level",
  "öncelik": "Priority",
  "yüksek": "High",
  "normal": "Normal",
  "düşük": "Low",
  "kritik": "Critical",
  "sayfa": "Page",
  "ilk": "First",
  "son": "Last",
  "önceki": "Prev",
  "sonraki": "Next",
  "örn": "e.g.",
  "satış": "Sales",
  "destek": "Support",
  "teknik": "Technical",
  "muhasebe": "Accounting",
  "fatura": "Billing",
  "ödeme": "Payment",
  "sipariş": "Order",
  "iade": "Refund",
  "ürün": "Product",
  "şikayet": "Complaint",
  "arıza": "Fault",
  "kriz": "Crisis",
  "alarm": "Alert",
  "değiştirme": "Change",
  "değiştir": "Change",
  "değişim": "Change",
  "değişken": "Variable",
  "değer": "Value",
  "tuş": "Key",
  "tuşu": "Key",
  "tuşlama": "Keypress",
  "giriş": "Login",
  "girişi": "Login",
  "çıkış": "Logout",
  "çıkışı": "Logout",
  "sadece": "Only",
  "yalnızca": "Only",
  "sistem": "System",
  "yıldız": "Star",
  "kare": "Pound",
  "karşılama": "Greeting",
  "açılış": "Opening",
  "kapanış": "Closing",
  "selamlama": "Greeting",
  "çıkar": "Remove",
  "taşı": "Move",
  "en": "Most",
  "çok": "High",
  "az": "Least",
  "lisans": "License",
  "bir": "a",
  "bu": "This",
  "başlangıç": "Start",
  "bitiş": "End",
  "şifre": "Password",
  "şifresi": "Password",
  "parola": "Password",
  "hedef": "Target",
  "saati": "Time",
  "zaman": "Time",
  "zamanlı": "Scheduled",
  "eş": "Concurrent",
  "eşzamanlı": "Concurrent",
  "geri": "Back",
  "ileri": "Forward",
  "yukarı": "Up",
  "aşağı": "Down",
  "sol": "Left",
  "sağ": "Right",
  "üst": "Top",
  "alt": "Bottom",
  "yükleniyor": "Loading",
  "kuyruğa": "to Queue",
  "kuyruktan": "from Queue",
  "kodu": "Code",
  "kod": "Code",
  "kodunu": "Code",
  "sınırsız": "Unlimited",
  "hızlı": "Quick",
  "yavaş": "Slow",
  "anahtar": "Key",
  "anahtarı": "Key",
  "hatası": "Error",
  "asistan": "Assistant",
  "asistanı": "Assistant",
  "erişim": "Access",
  "veri": "Data",
  "menü": "Menu",
  "menüde": "in Menu",
  "mesai": "Work Hours",
  "tatil": "Holiday",
  "resmi": "Public",
  "buraya": "here",
  "günde": "per day",
  "doğrulama": "Verification",
  "haneli": "digit",
  "hane": "digit",
  "randevu": "Appointment",
  "söz": "Speech",
  "kesme": "Interruption",
  "sessizlik": "Silence",
  "birleşik": "Unified",
  "araya": "Barge",
  "girme": "In",
  "sufle": "Whisper",
  "fısıldama": "Whisper",
  "fısılda": "Whisper",
  "müdahale": "Intervention",
  "sesi": "Audio",
  "bulunamadı": "not found",
  "bulunmuyor": "not found",
  "bulunmamaktadır": "not available",
  "tarihi": "Date",
  "dön": "Return",
  "dönüş": "Return",
  "eşit": "Equal",
  "girin": "Enter",
  "giriniz": "Please enter",
  "yazın": "Type",
  "tıklayın": "Click",
  "dinleme": "Listening",
  "diğer": "Other",
  "paket": "Package",
  "paketi": "Package",
  "anonsu": "Announcement",
  "yanıt": "Response",
  "cevap": "Reply",
  "aktar": "Transfer",
  "aktarım": "Transfer",
  "aktarılan": "Transferred",
  "olumlu": "Positive",
  "olumsuz": "Negative",
  "negatif": "Negative",
  "nötr": "Neutral",
  "ikon": "Icon",
  "seçilen": "Selected",
  "seç": "Select",
  "izin": "Permission",
  "izinli": "Allowed",
  "engelli": "Blocked",
  "engelle": "Block",
  "engellenen": "Blocked",
  "müşteriyi": "Customer",
  "aksiyon": "Action",
  "uyumu": "Compatibility",
  "genişlik": "Width",
  "sonlandır": "End",
  "çağrıya": "to Call",
  "çağrıyı": "Call",
  "plan": "Plan",
  "planlı": "Scheduled",
  "ağ": "Network",
  "bildirim": "Notification",
  "bildirimleri": "Notifications",
  "boş": "Empty",
  "boşta": "Idle",
  "dosya": "File",
  "dosyası": "File",
  "simülasyon": "Simulation",
  "diyalog": "Dialogue",
  "konuşma": "Conversation",
  "düzenleme": "Editing",
  "başlık": "Title",
  "başlığı": "Title",
  "ekleme": "Addition",
  "silme": "Deletion",
  "çile": "Friction",
  "noktası": "Point",
  "noktaları": "Points",
  "yapılan": "Performed",
  "kampanya": "Campaign",
  "kampanyası": "Campaign",
  "çalışma": "Working",
  "yerel": "Local",
  "kimlik": "Identity",
  "kolay": "Easy",
  "kopyalandı": "Copied",
  "lütfen": "Please",
  "terk": "Drop",
  "aşımı": "Timeout",
  "aşım": "Limit",
  "merhaba": "Hello",
  "mevcut": "Current",
  "rahatsız": "Disturb",
  "kaydı": "Record",
  "kaydını": "Record",
  "inceleme": "Inspection",
  "temsilcisi": "Agent",
  "sorun": "Issue",
  "tarayıcı": "Browser",
  "yardım": "Help",
  "masası": "Desk",
  "masa": "Desk",
  "masaüstü": "Desktop",
  "mobil": "Mobile",
  "hafif": "Light",
  "yoğun": "Heavy",
  "yoğunluk": "Traffic",
  "operatör": "Carrier",
  "ölçeği": "Scale",
  "yöntem": "Method",
  "tanıma": "Recognition",
  "tanımı": "Definition",
  "tanımları": "Definitions",
  "tanımlı": "Defined",
  "mükemmel": "Excellent",
  "iyi": "Good",
  "zayıf": "Poor",
  "kötü": "Bad",
  "limit": "Limit",
  "limiti": "Limit",
  "kota": "Quota",
  "kotaları": "Quotas",
  "çalıştır": "Run",
  "akıllı": "Smart",
  "yatay": "Horizontal",
  "dikey": "Vertical",
  "dahil": "Included",
  "arayüz": "Interface",
  "geçiş": "Transition",
  "grafik": "Chart",
  "arka": "Background",
  "oluştur": "Create",
  "oluşturma": "Creation",
  "sayısal": "Numeric",
  "atanan": "Assigned",
  "atanmamış": "Unassigned",
  "ihlal": "Violation",
  "edilen": "Processed",
  "adım": "Step",
  "adımı": "Step",
  "tara": "Scan",
  "taranıyor": "Scanning",
  "tekrar": "Repeat",
  "dönem": "Period",
  "harcanan": "Spent",
  "tespit": "Detected",
  "herhangi": "any",
  "büyük": "Large",
  "küçük": "Small",
  "kutucuk": "Widget",
  "gizli": "Secret",
  "geniş": "Wide",
  "mod": "Mode",
  "modu": "Mode",
  "seçenekleri": "Options",
  "bekleniyor": "Waiting",
  "kaydedildi": "Saved",
  "yönetici": "Admin",
  "süpervizör": "Supervisor",
  "ocak": "January",
  "şubat": "February",
  "mart": "March",
  "nisan": "April",
  "mayıs": "May",
  "haziran": "June",
  "temmuz": "July",
  "ağustos": "August",
  "eylül": "September",
  "ekim": "October",
  "kasım": "November",
  "aralık": "December",
  "pzt": "Mon",
  "sal": "Tue",
  "çar": "Wed",
  "per": "Thu",
  "cum": "Fri",
  "cmt": "Sat",
  "paz": "Sun",
  "türkçe": "Turkish",
  "ingilizce": "English",
  "arapça": "Arabic",
  "fransızca": "French",
  "rusça": "Russian",
  "ispanyolca": "Spanish",
  "almanca": "German",
  "türkiye": "Turkey",
  "azerbaycan": "Azerbaijan",
  "bakü": "Baku",
  "kktc": "TRNC",
  "lefkoşa": "Nicosia",
  "avrupa": "Europe",
  "kış": "Winter",
  "çin": "China",
  "aydınlık": "Light",
  "karanlık": "Dark",
  "gül": "Rose",
  "kırmızı": "Red",
  "kızıl": "Crimson",
  "pembe": "Pink",
  "sarı": "Yellow",
  "yeşil": "Green",
  "mavi": "Blue",
  "mor": "Purple",
  "indigo": "Indigo",
  "turuncu": "Orange",
  "arşivle": "Archive",
  "bağlanıyor": "Connecting",
  "değişkenler": "Variables",
  "döndür": "Rotate",
  "dışarıda": "Away",
  "erişilemiyor": "Unreachable",
  "gelişmiş": "Advanced",
  "geçmiş": "History",
  "gönderiliyor": "Sending",
  "görev": "Task",
  "görüntüleme": "View",
  "güncelleme": "Update",
  "güncelleniyor": "Updating",
  "başlıklar": "Headers",
  "kararlılık": "Stability",
  "karşılaştırma": "Comparison",
  "katılımcılar": "Participants",
  "küçült": "Minimize",
  "kısayol": "Shortcut",
  "örneğin": "e.g.",
  "selam": "hello",
  "mağaza": "Store",
  "çekirdek": "cores",
  "meşgulde": "On Busy",
  "seçilmedi": "Not Selected",
  "soyadı": "Last Name",
  "süresiz": "Unlimited",
  "sütunlar": "Columns",
  "şifreli": "Encrypted",
  "taşıma": "Transport",
  "teşekkürler": "Thank You",
  "toplantı": "Meeting",
  "tuşlar": "Keys",
  "yönet": "Manage",
  "yöneticiler": "Admins",
  "yön": "Direction",
  "yılbaşı": "New Year's Day",
  "ekranında": "on screen",
  "hattımıza": "to our line",
  "kullanılan": "used",
  "menüsünden": "from menu",
  "mesajı": "message",
  "gönderir": "sends",
  "portundan": "from port",
  "sağlanmazsa": "if not provided",
  "sınırlarıyla": "within limits",
  "kurar": "establishes",
  "uygulamasını": "application",
  "açın": "open",
  "çözüldü": "Resolved",
  "ölçümler": "Metrics",
  "ücret": "Cost",
  "üye": "Member",
  "limit": "limit",
  "dolduğunda": "when reached",
  "ise": "then",
  "ilerleme": "Progress",
  "içerik": "Content",
  "içerir": "Contains",
  "işlem": "Action",
  "işlemler": "Actions",
  "işlemci": "Processor",
  "bileşen": "Component",
};

function normTrKey(s) {
  return String(s || "")
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .replace(/ı/g, "i")
    .toLowerCase()
    .replace(/i\u0307/g, "i");
}

const NORM_EXACT_TR_TO_EN = Object.entries(EXACT_TR_TO_EN).reduce((acc, [tr, en]) => {
  acc[normTrKey(tr)] = en;
  return acc;
}, {});

const NORM_WORD_DICT_TR_EN = Object.entries(WORD_DICT_TR_EN).reduce((acc, [tr, en]) => {
  acc[normTrKey(tr)] = en;
  return acc;
}, {});

const TR_DETECTOR_RE =
  /[çğıöşüÇĞİÖŞÜ]|\b(ve|veya|için|ile|olan|olarak|yeni|ekle|sil|düzenle|kaydet|kapat|iptal|vazgeç|ara|arama|arayan|çağrı|çağrılar|temsilci|temsilciler|kullanıcı|kullanıcılar|kuyruk|kuyruklar|ayarlar|ayarları|rapor|raporlar|raporu|günlük|günlükleri|oturum|mola|aktif|pasif|tümü|toplam|bugün|dün|henüz|yok|seçin|seçiniz|listesi|detay|durum|durumu|numara|numarası|dahili|harici|kanal|kanallar|mesaj|sohbet|ses|sesli|kayıt|kayıtları|tarafından|göre|üzerinden|saat|dakika|saniye|gün|hafta|ay|yıl|yönetimi|panosu|ekranı|merkezi|grubu|grupları|kuralları|kuralı|tanımı|tanımları|şablonları|entegrasyonu|analizi|oranı|süresi|süre|sayısı|adedi|özeti|dağılımı|kontrol|güvenlik|sistem|santral|hat|dış|iç|gelen|giden|cevapsız|kaçan|bekleyen|bekleme|konferans|rehber|anons|tatil|mesai|yetki|rol|roller|cihaz|bağlantı|hata|başarılı|uyarı|bilgi|otomatik|manuel|canlı|izleme|dinleme|fısıldama|aktarma|transfer|not|notlar|etiket|filtre|temizle|yenile|indir|yükle|gönder|başlat|durdur|bitir|onayla|reddet|yanıtla)\b/i;

function matchCaseStyle(sourceText, translatedText) {
  if (!sourceText || !translatedText) return translatedText;
  const lettersOnly = sourceText.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, "");
  if (lettersOnly.length >= 2 && lettersOnly === lettersOnly.toLocaleUpperCase("tr-TR")) {
    return translatedText.toUpperCase();
  }
  return translatedText;
}

function translateDynamicPatternToEn(trimmed) {
  let m;

  // "Panoyu Özelleştir (4/4)"
  m = trimmed.match(/^Panoyu\s+Özelleştir\s*\(([^)]+)\)$/i);
  if (m) return `Customize Dashboard (${m[1]})`;

  // "Web Telefon (1000)"
  m = trimmed.match(/^Web\s+Telefon\s*\(([^)]+)\)$/i);
  if (m) return `Web Phone (${m[1]})`;

  // "Ort. 0 sn"
  m = trimmed.match(/^Ort\.\s*(\d+)\s*sn$/i);
  if (m) return `Avg. ${m[1]} s`;

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

  // "-- ... Seçin --" / "-- ... Seçiniz --"
  m = trimmed.match(/^--\s*(.+?)\s*Seçin(?:iz)?\s*--$/i);
  if (m) return `-- Select ${translateStringToEn(m[1])} --`;

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

function translateCompositionalTrToEn(str) {
  const isAllUpper =
    str.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, "").length >= 3 &&
    str.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, "") ===
      str.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, "").toLocaleUpperCase("tr-TR");

  let working = str;

  // 1. Replace multi-word phrases (longest first)
  for (let i = 0; i < MULTI_WORD_PHRASES.length; i++) {
    const [trPhrase, enPhrase] = MULTI_WORD_PHRASES[i];
    const escaped = trPhrase
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/[iıİI]/g, "[iıİI]");
    const rx = new RegExp(escaped, "gi");
    if (rx.test(working)) {
      working = working.replace(rx, enPhrase);
    }
  }

  // 2. Replace individual Turkish words while preserving punctuation
  working = working.replace(/[A-Za-zÇĞİÖŞÜçğıöşü]+(?:\.)?/g, (token) => {
    const cleanTok = token.replace(/\.$/, "");
    const nKey = normTrKey(cleanTok);

    const mapped =
      WORD_DICT_TR_EN[token.toLocaleLowerCase("tr-TR")] ||
      NORM_WORD_DICT_TR_EN[nKey];

    if (mapped) {
      if (cleanTok === cleanTok.toLocaleUpperCase("tr-TR") && cleanTok.length >= 2) {
        return mapped.toUpperCase();
      }
      if (cleanTok[0] === cleanTok[0].toLocaleUpperCase("tr-TR")) {
        return mapped.charAt(0).toUpperCase() + mapped.slice(1);
      }
      return mapped.toLowerCase();
    }
    return token;
  });

  if (isAllUpper && working !== str) {
    return working.toUpperCase();
  }
  return working;
}

export function translateStringToEn(rawStr) {
  if (!rawStr || typeof rawStr !== "string") return rawStr;
  const trimmed = rawStr.trim();
  if (!trimmed) return rawStr;

  const exact =
    EXACT_TR_TO_EN[trimmed] ||
    LOWER_TR_TO_EN[trimmed.toLocaleLowerCase("tr-TR")] ||
    LOWER_TR_TO_EN[trimmed.toLowerCase()] ||
    NORM_EXACT_TR_TO_EN[normTrKey(trimmed)];

  if (exact) {
    const lead = rawStr.match(/^\s*/)?.[0] || "";
    const trail = rawStr.match(/\s*$/)?.[0] || "";
    return `${lead}${matchCaseStyle(trimmed, exact)}${trail}`;
  }

  const dyn = translateDynamicPatternToEn(trimmed);
  if (dyn) {
    const lead = rawStr.match(/^\s*/)?.[0] || "";
    const trail = rawStr.match(/\s*$/)?.[0] || "";
    return `${lead}${dyn}${trail}`;
  }

  const comp = translateCompositionalTrToEn(trimmed);
  if (comp && comp !== trimmed) {
    const lead = rawStr.match(/^\s*/)?.[0] || "";
    const trail = rawStr.match(/\s*$/)?.[0] || "";
    return `${lead}${comp}${trail}`;
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
    if (window.aidaDesktop && typeof window.aidaDesktop.updatePreferences === "function") {
      window.aidaDesktop.updatePreferences({ uiLanguage: lang });
    }
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
        if (node.__aidaLastEnVal === currentVal && node.__aidaOrigTrVal) {
          continue;
        }
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

  // Also trigger delayed passes on click/navigation so lazy-loaded dynamic panels translate immediately
  document.addEventListener(
    "click",
    () => {
      if (getUiLanguage() !== "en") return;
      setTimeout(() => applyDomLanguagePass("en"), 40);
      setTimeout(() => applyDomLanguagePass("en"), 180);
      setTimeout(() => applyDomLanguagePass("en"), 450);
    },
    true
  );

  // Periodic lightweight sweep for async API data renders
  setInterval(() => {
    if (getUiLanguage() === "en" && !isApplyingTranslationPass) {
      applyDomLanguagePass("en");
    }
  }, 700);
}

export function useUiLanguage() {
  const [lang, setLangState] = useState(() => getUiLanguage());

  useEffect(() => {
    installGlobalDomTranslator();
    const cur = getUiLanguage();
    setLangState(cur);
    if (cur === "en") {
      applyDomLanguagePass("en");
    }

    const onLangChanged = (e) => {
      const next = e?.detail?.lang || getUiLanguage();
      setLangState(next);
      applyDomLanguagePass(next);
    };
    window.addEventListener("AIDA_LANGUAGE_CHANGED", onLangChanged);
    return () => window.removeEventListener("AIDA_LANGUAGE_CHANGED", onLangChanged);
  }, []);

  const changeLanguage = useCallback((nextLang, opts = {}) => {
    return setUiLanguage(nextLang, opts);
  }, []);

  return { lang, setLanguage: changeLanguage, languages: SUPPORTED_LANGUAGES };
}
