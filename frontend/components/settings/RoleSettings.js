import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, X, Shield, Search, Check, CheckCircle, Smartphone, Server, Coffee, User, Users, Terminal, HardDrive, Lock, Unlock, Eye, Edit3, Trash, GitBranch, Bot, MessageSquare, BookOpen, FileText, Cable, Fingerprint, Volume2, ArrowUpRight, PhoneCall, Network, Mail, RotateCcw, Activity, Monitor, Database, Sliders, Calendar, Clock, MapPin, Hash, Shuffle, Languages, Heart, Sparkles } from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

export const CALL_PANEL_SUB_GROUPS = [
  {
    id: "tabs",
    title: "Panel Sekmeleri",
    items: [
      { id: "call_panel:tab_dashboard", name: "Pano" },
      { id: "call_panel:tab_webphone", name: "Webphone" },
      { id: "call_panel:tab_agents", name: "Temsilciler" },
      { id: "call_panel:tab_speeddial", name: "Hızlı Arama" },
      { id: "call_panel:tab_missed", name: "Kayıp Çağrı" },
      { id: "call_panel:tab_directory", name: "Rehber" },
      { id: "call_panel:tab_history", name: "Çağrı Geçmişi" },
      { id: "call_panel:tab_voicemail", name: "Sesli Posta" },
      { id: "call_panel:tab_chat", name: "Sohbet" }
    ]
  },
  {
    id: "webphone_features",
    title: "Webphone Özellikleri",
    items: [
      { id: "call_panel:listen_records", name: "Ses Kayıt Dinleme" },
      { id: "call_panel:webphone_save_contact", name: "Rehbere Kaydı" },
      { id: "call_panel:webphone_transfer", name: "Çağrı Transferi" },
      { id: "call_panel:webphone_conference", name: "Konferans" },
      { id: "call_panel:webphone_reject", name: "Çağrı Reddi" },
      {
        id: "call_panel:webphone_mask_number",
        name: "Numara Maskeleme (Kayıtlı İsim ve Son 4 Hane ** **)",
        isRestriction: true
      }
    ]
  },
  {
    id: "agents_tab_features",
    title: "Temsilciler Sekmesi Yetkileri",
    items: [
      { id: "call_panel:agents_status", name: "Sadece Durum Görüşebilir (Müsait - Molada - Meşgul)" },
      { id: "call_panel:agents_duration", name: "Durum ile Birlikte Süre Bilgisi (Ne Kadar Süredir Müsait / Molada / Meşgul)" },
      { id: "call_panel:agents_call_counts", name: "Diğer Agentların Çağrı Adetleri" },
      { id: "call_panel:agents_login_logout", name: "Diğer Agentların Login / Logout Zamanları" }
    ]
  }
];

export const DEFAULT_CALL_PANEL_SUB_PERMS = CALL_PANEL_SUB_GROUPS.flatMap(g =>
  g.items.filter(it => !it.isRestriction).map(it => it.id)
);

const SYSTEM_FEATURES = [
  // 1. Operasyon & İzleme
  { id: "dashboard", name: "Gerçek Zamanlı AI Pano", icon: Activity, type: "access", color: "purple" },
  { id: "wallboard", name: "Canlı İzleme Paneli (Wallboard)", icon: Monitor, type: "access", color: "indigo" },
  { id: "call_panel", name: "Temsilci Çağrı Paneli", icon: Coffee, type: "access", color: "emerald" },
  { id: "call_panel:listen_records", name: "Temsilci Paneli Ses Kaydı Dinleme", icon: Volume2, type: "access", color: "emerald" },
  { id: "omnichannel", name: "Ortak Gelen Kutusu (Omnichannel)", icon: MessageSquare, type: "access", color: "purple" },

  // 2. Yapay Zeka & Bilgi
  { id: "ai_agents", name: "Yapay Zeka Temsilcileri (AI Agents)", icon: Bot, type: "crud", color: "purple" },
  { id: "ai_agent_scenarios", name: "AI Temsilci Senaryo Editörü", icon: GitBranch, type: "crud", color: "purple" },
  { id: "rag_kb", name: "Bilgi Bankası (RAG) Yönetimi", icon: Database, type: "crud", color: "blue" },
  { id: "rule_editor", name: "Kural & Senaryo Editörü", icon: Sliders, type: "crud", color: "indigo" },
  { id: "ai_whisper", name: "AI Fısıldama Yönetimi & Yetkisi", icon: Sparkles, type: "crud_partial", color: "amber" },
  { id: "voice_biometrics", name: "Biyometrik Ses Doğrulama", icon: Fingerprint, type: "crud", color: "indigo" },
  { id: "qa", name: "Otomatik Kalite Değerlendirme (QA)", icon: FileText, type: "crud", color: "indigo" },
  { id: "lang_detect", name: "Otomatik Dil Algılama", icon: Languages, type: "crud_partial", color: "rose" },
  { id: "emotion_management", name: "Dinamik Duygu Yönetimi", icon: Heart, type: "crud_partial", color: "rose" },
  { id: "ai_providers", name: "Yapay Zeka API Sağlayıcı Ayarları", icon: Bot, type: "crud_partial", color: "purple" },

  // 3. Santral (PBX) & Çağrı Yönlendirme
  { id: "pbx", name: "Santral Entegrasyonu", icon: Server, type: "crud", color: "indigo" },
  { id: "users", name: "Kullanıcı Yönetimi", icon: User, type: "crud", color: "blue" },
  { id: "announcements", name: "Anons Yönetimi", icon: Volume2, type: "crud", color: "pink" },
  { id: "acd_queues", name: "ACD Kuyruk Yönetimi", icon: Users, type: "crud", color: "blue" },
  { id: "autoprovision", name: "Oto Provizyon Cihaz Yönetimi", icon: Smartphone, type: "crud", color: "indigo" },
  { id: "autoprovision_templates", name: "Otoprovizyon Şablonları", icon: FileText, type: "crud", color: "amber" },
  { id: "outbound_rules", name: "Giden Arama Kuralları", icon: ArrowUpRight, type: "crud", color: "indigo" },
  { id: "inbound_rules", name: "Gelen Arama Kuralları", icon: PhoneCall, type: "crud", color: "pink" },
  { id: "call_pickup_groups", name: "Çağrı Toplama Grupları", icon: Users, type: "crud", color: "blue" },
  { id: "subscriber_groups", name: "Abone Grupları", icon: Users, type: "crud", color: "blue" },
  { id: "contacts", name: "Rehber (Contacts)", icon: BookOpen, type: "crud", color: "blue" },
  { id: "trunks", name: "Dış Hat Tanımı (SIP Trunks)", icon: Cable, type: "crud", color: "indigo" },
  { id: "conferences", name: "Konferans Yönetimi", icon: Users, type: "crud", color: "blue" },
  { id: "speed_dials", name: "Hızlı Arama Yönetimi", icon: PhoneCall, type: "crud", color: "rose" },
  { id: "blacklist", name: "Numara Engelleme & Kara Liste", icon: Shield, type: "crud", color: "rose" },
  { id: "call_flow", name: "Arama Akış Yönetimi (Call Flow)", icon: GitBranch, type: "crud", color: "indigo" },
  { id: "dialer", name: "Dış Arama Modülü (Dialer)", icon: Smartphone, type: "crud", color: "blue" },
  { id: "calendar", name: "Randevu Takvimi", icon: Calendar, type: "crud", color: "amber" },
  { id: "follow_me", name: "Beni Takip Et (Follow Me) Özelliği", icon: PhoneCall, type: "crud_partial", color: "indigo" },
  { id: "mobile_transfer", name: "Mobil Numaraya Akıllı AI Transferi", icon: Smartphone, type: "crud_partial", color: "indigo" },
  { id: "smart_callback", name: "Akıllı Geri Arama (Smart Callback)", icon: Shuffle, type: "crud_partial", color: "indigo" },
  { id: "numbering_plan", name: "Numara Planı Ayarları", icon: Hash, type: "crud_partial", color: "blue" },

  // 4. Raporlar & Analiz
  { id: "reports", name: "Gelişmiş Çağrı Raporları ve KPI Panosu", icon: FileText, type: "access", color: "purple" },
  { id: "agent_timeline", name: "Temsilci Kronolojisi Raporu", icon: Clock, type: "access", color: "emerald" },
  { id: "transcripts", name: "Maskesiz Görüşme Metinleri Yetkisi", icon: Terminal, type: "access", color: "orange" },
  { id: "roi_settings", name: "ROI Rapor Ayarları", icon: FileText, type: "crud", color: "amber" },

  // 5. İletişim Kanalları
  { id: "channels", name: "Kanal Entegrasyonları (WhatsApp/Meta/TG)", icon: Smartphone, type: "crud_partial", color: "pink" },
  { id: "canned_responses", name: "Hızlı Cevap Taslakları", icon: FileText, type: "crud", color: "pink" },

  // 6. Yönetim, Güvenlik & Sistem Ayarları
  { id: "roles", name: "Rol ve Yetki Tanımları", icon: Shield, type: "crud", color: "purple" },
  { id: "breaks", name: "Mola Tanımları", icon: Coffee, type: "crud", color: "amber" },
  { id: "locations", name: "Lokasyon ve Departmanlar", icon: MapPin, type: "crud", color: "rose" },
  { id: "nat", name: "NAT ve Dış IP Ayarları", icon: Network, type: "crud", color: "blue" },
  { id: "universal_api", name: "Evrensel API & Webhook Sihirbazı", icon: Cable, type: "crud", color: "indigo" },
  { id: "ssl", name: "SSL Sertifika Yönetimi", icon: Shield, type: "crud_partial", color: "emerald" },
  { id: "backup_restore", name: "Sistem Yedekleme ve Geri Yükleme", icon: HardDrive, type: "crud_partial", color: "blue" },
  { id: "recording_retention", name: "Kayıt & Saklama Süresi Sistemi", icon: Server, type: "crud", color: "rose" },
  { id: "storage", name: "Recording/NAS Depolama Erişimi", icon: HardDrive, type: "access", color: "rose" },
  { id: "api_budgets", name: "API Bütçe ve Tüketim Takibi", icon: HardDrive, type: "crud_partial", color: "emerald" },
  { id: "tenant_license", name: "Müşteri (Tenant) & Lisans Yönetimi", icon: Lock, type: "crud", color: "rose" },
  { id: "email_notifications", name: "E-Mail ve WhatsApp Sistem Bildirimleri", icon: Mail, type: "crud", color: "blue" },
  { id: "restore_points", name: "Geri Yükleme Noktası Yönetimi", icon: RotateCcw, type: "crud", color: "emerald" },
  { id: "system_status", name: "Sistem Panosu & Sağlık İzleme", icon: Server, type: "access", color: "cyan" },
  { id: "logs", name: "Olay Günlükleri & Sistem Logları", icon: Terminal, type: "access", color: "cyan" },
  { id: "sip_debugger", name: "SIP Trafik Yakalayıcı (sngrep)", icon: Terminal, type: "access", color: "indigo" },
  { id: "security", name: "Güvenlik Kalkanı (Fail2Ban & UFW)", icon: Shield, type: "crud", color: "cyan" },
  { id: "system_version", name: "Sistem Versiyonu & Değişiklik Günlüğü", icon: GitBranch, type: "access", color: "indigo" }
];

export default function RoleSettings({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [roles, setRoles] = useState([]);
  const [breaks, setBreaks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Modal / Popup States
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Form Fields
  const [roleCode, setRoleCode] = useState("");
  const [roleName, setRoleName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [selectedBreaks, setSelectedBreaks] = useState([]);

  const safeFetch = async (path, options = {}) => {
    return await fetch(path, options);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resRoles, resBreaks, resUsers] = await Promise.all([
        safeFetch(`/api/settings/roles`),
        safeFetch(`/api/settings/breaks`),
        safeFetch(`/api/settings/users`).catch(() => null)
      ]);

      const dataRoles = await resRoles.json();
      setRoles(Array.isArray(dataRoles) ? dataRoles : (dataRoles?.roles || []));

      const dataBreaks = await resBreaks.json();
      setBreaks(Array.isArray(dataBreaks) ? dataBreaks : (dataBreaks?.breaks || []));

      if (resUsers && resUsers.ok) {
        const dataUsers = await resUsers.json();
        setUsers(Array.isArray(dataUsers) ? dataUsers : (dataUsers?.users || []));
      }
    } catch (err) {
      console.error("Roller/Molalar yüklenemedi:", err);
      setError("Rol ve mola tanımları sunucudan alınamadı.");
    } finally {
      setLoading(false);
    }
  };

  const getRolePermissionStats = (role) => {
    const perms = Array.isArray(role?.permissions) ? role.permissions : [];
    let total = 0;
    let granted = 0;

    SYSTEM_FEATURES.forEach((feat) => {
      if (feat.type === "crud") {
        total += 3;
        const hasRead =
          perms.includes(`${feat.id}:read`) ||
          (feat.id === "ai_whisper" && perms.includes("ai_whisper:access")) ||
          (feat.id === "call_flow" && perms.includes("call_flow:access")) ||
          (feat.id === "dialer" && perms.includes("dialer:access"));
        const hasWrite = perms.includes(`${feat.id}:write`);
        const hasDelete = perms.includes(`${feat.id}:delete`);
        if (hasRead) granted += 1;
        if (hasWrite) granted += 1;
        if (hasDelete) granted += 1;
      } else if (feat.type === "crud_partial") {
        total += 2;
        const hasRead =
          perms.includes(`${feat.id}:read`) ||
          (feat.id === "ai_whisper" && perms.includes("ai_whisper:access"));
        const hasWrite = perms.includes(`${feat.id}:write`);
        if (hasRead) granted += 1;
        if (hasWrite) granted += 1;
      } else {
        total += 1;
        const accessKey = feat.id.includes(":") ? feat.id : `${feat.id}:access`;
        const hasAccess = perms.includes(accessKey) || perms.includes(feat.id);
        if (hasAccess) granted += 1;
      }
    });

    const hasCallPanelAccess = perms.includes("call_panel:access") || perms.includes("call_panel");
    const hasAnyTabPerm = perms.some((p) => p.startsWith("call_panel:tab_"));

    CALL_PANEL_SUB_GROUPS.forEach((group) => {
      group.items.forEach((subItem) => {
        if (SYSTEM_FEATURES.some((f) => f.id === subItem.id)) return;
        total += 1;
        const isGranted =
          perms.includes(subItem.id) ||
          (hasCallPanelAccess && !hasAnyTabPerm && !subItem.isRestriction);
        if (isGranted) granted += 1;
      });
    });

    return { total, granted };
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSaveAll = async (updatedRoles) => {
    setError("");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await safeFetch(`/api/settings/roles`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-User-ID": localStorage.getItem("current_user_id") || "admin"
        },
        body: JSON.stringify(updatedRoles),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (res.ok && data.status === "success") {
        if (data.roles) setRoles(data.roles);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        return true;
      } else {
        const msg = data.detail || data.message || "Roller kaydedilirken bir hata oluştu.";
        setError(msg);
        return false;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("Roller kaydedilemedi:", err);
      if (err.name === 'AbortError') {
        setError("Sunucu yanıt vermedi (Zaman aşımı). Lütfen sunucu bağlantınızı kontrol ediniz.");
      } else {
        setError("Sunucuya bağlanırken bir hata oluştu.");
      }
      return false;
    }
  };

  const [activeModalTab, setActiveModalTab] = useState("operations");

  const ROLE_MODAL_CATEGORIES = [
    {
      id: "operations",
      name: "Operasyon & Canlı İzleme",
      icon: Activity,
      items: ["dashboard", "wallboard", "call_panel", "omnichannel"]
    },
    {
      id: "ai",
      name: "Yapay Zeka & Otomasyon",
      icon: Bot,
      items: ["ai_agents", "ai_agent_scenarios", "rag_kb", "rule_editor", "ai_whisper", "voice_biometrics", "qa", "lang_detect", "emotion_management", "ai_providers"]
    },
    {
      id: "pbx",
      name: "Santral (PBX) & Çağrı Yönlendirme",
      icon: Server,
      items: ["pbx", "users", "announcements", "acd_queues", "autoprovision", "autoprovision_templates", "outbound_rules", "inbound_rules", "call_pickup_groups", "subscriber_groups", "contacts", "trunks", "conferences", "speed_dials", "blacklist", "call_flow", "dialer", "calendar", "follow_me", "mobile_transfer", "smart_callback", "numbering_plan"]
    },
    {
      id: "reports",
      name: "Raporlar & Performans Analitiği",
      icon: FileText,
      items: ["reports", "agent_timeline", "transcripts", "roi_settings"]
    },
    {
      id: "omnichannel",
      name: "İletişim Kanalları & Şablonlar",
      icon: MessageSquare,
      items: ["channels", "canned_responses"]
    },
    {
      id: "system",
      name: "Yönetim, Güvenlik & Sistem Ayarları",
      icon: Shield,
      items: ["roles", "breaks", "locations", "nat", "universal_api", "ssl", "backup_restore", "recording_retention", "storage", "api_budgets", "tenant_license", "email_notifications", "restore_points", "system_status", "logs", "sip_debugger", "security", "system_version"]
    },
    {
      id: "breaks",
      name: "İzin Verilen Mola Tipleri",
      icon: Coffee,
      items: []
    }
  ];

  const getCategoryPermissionCodes = (cat) => {
    if (!cat || cat.id === "breaks") return [];
    const codes = [];
    SYSTEM_FEATURES.filter((f) => cat.items.includes(f.id)).forEach((feat) => {
      if (feat.type === "crud") {
        codes.push(`${feat.id}:read`, `${feat.id}:write`, `${feat.id}:delete`);
      } else if (feat.type === "crud_partial") {
        codes.push(`${feat.id}:read`, `${feat.id}:write`);
      } else {
        const accessKey = feat.id.includes(":") ? feat.id : `${feat.id}:access`;
        codes.push(accessKey);
      }
      if (feat.id === "call_panel") {
        CALL_PANEL_SUB_GROUPS.forEach((sg) => {
          sg.items.forEach((subItem) => {
            if (!codes.includes(subItem.id) && !subItem.isRestriction) {
              codes.push(subItem.id);
            }
          });
        });
      }
    });
    return codes;
  };

  const openAddModal = () => {
    setError("");
    setEditingRole(null);
    setRoleCode("");
    setRoleName("");
    setSelectedPermissions([]);
    setSelectedBreaks(breaks.map(b => b.id)); // Default allow all breaks
    setActiveModalTab("operations");
    setShowModal(true);
  };

  const openEditModal = (r) => {
    setError("");
    setEditingRole(r);
    setRoleCode(r.role_code);
    setRoleName(r.name);
    let initialPerms = Array.isArray(r.permissions) ? [...r.permissions] : [];
    const hasCallPanelAccess = initialPerms.includes("call_panel:access") || initialPerms.includes("call_panel");
    const hasAnyTabPerm = initialPerms.some(p => p.startsWith("call_panel:tab_"));
    if (hasCallPanelAccess && !hasAnyTabPerm) {
      initialPerms = Array.from(new Set([...initialPerms, ...DEFAULT_CALL_PANEL_SUB_PERMS]));
    }
    setSelectedPermissions(initialPerms);
    setSelectedBreaks(r.allowed_breaks || []);
    setActiveModalTab("operations");
    setShowModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const trimmedCode = roleCode.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const trimmedName = roleName.trim();
    if (!trimmedCode || !trimmedName) {
      setError("Lütfen geçerli bir Rol Kodu ve Rol Adı giriniz.");
      return;
    }

    setSubmitting(true);
    let ok = false;
    try {
      if (editingRole) {
        // Edit
        const updated = roles.map((r) => {
          if (r.id === editingRole.id) {
            return {
              ...r,
              role_code: trimmedCode,
              name: trimmedName,
              permissions: Array.from(new Set([
                ...(r.permissions || []).filter(p => !SYSTEM_FEATURES.some(f => p.startsWith(f.id + ':'))),
                ...selectedPermissions
              ])),
              allowed_breaks: selectedBreaks
            };
          }
          return r;
        });
        setRoles(updated);
        ok = await handleSaveAll(updated);
      } else {
        // Add
        const nextId = roles.length > 0 ? Math.max(...roles.map(r => r.id || 0)) + 1 : 1;
        const newRole = {
          id: nextId,
          role_code: trimmedCode,
          name: trimmedName,
          permissions: selectedPermissions,
          allowed_breaks: selectedBreaks
        };
        const updated = [...roles, newRole];
        setRoles(updated);
        ok = await handleSaveAll(updated);
      }
    } finally {
      setSubmitting(false);
    }
    if (ok) {
      setShowModal(false);
    }
  };

  const handleDeleteRole = (id) => {
    setDeleteTargetId(id);
  };

  const confirmDeleteRole = async () => {
    if (deleteTargetId) {
      const filtered = roles.filter((r) => r.id !== deleteTargetId);
      setRoles(filtered);
      await handleSaveAll(filtered);
      setDeleteTargetId(null);
    }
  };

  const togglePermission = (permCode) => {
    if (selectedPermissions.includes(permCode)) {
      setSelectedPermissions(selectedPermissions.filter(p => p !== permCode));
    } else {
      if (permCode === "call_panel:access" && !selectedPermissions.some(p => p.startsWith("call_panel:tab_"))) {
        setSelectedPermissions(Array.from(new Set([...selectedPermissions, permCode, ...DEFAULT_CALL_PANEL_SUB_PERMS])));
      } else {
        setSelectedPermissions([...selectedPermissions, permCode]);
      }
    }
  };

  const toggleBreak = (breakId) => {
    if (selectedBreaks.includes(breakId)) {
      setSelectedBreaks(selectedBreaks.filter(id => id !== breakId));
    } else {
      setSelectedBreaks([...selectedBreaks, breakId]);
    }
  };

  const getRoleCardStyles = (code) => {
    if (code === "admin") {
      return {
        bgClass: "from-rose-500/10 via-rose-500/5 to-transparent",
        borderClass: "border-rose-200 dark:border-rose-900/40",
        badgeClass: "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50",
        iconColor: "text-rose-500"
      };
    }
    if (code === "supervisor") {
      return {
        bgClass: "from-indigo-500/10 via-indigo-500/5 to-transparent",
        borderClass: "border-indigo-200 dark:border-indigo-900/40",
        badgeClass: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50",
        iconColor: "text-indigo-500"
      };
    }
    if (code === "agent") {
      return {
        bgClass: "from-emerald-500/10 via-emerald-500/5 to-transparent",
        borderClass: "border-emerald-200 dark:border-emerald-900/40",
        badgeClass: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50",
        iconColor: "text-emerald-500"
      };
    }
    return {
      bgClass: "from-purple-500/10 via-purple-500/5 to-transparent",
      borderClass: "border-purple-200 dark:border-purple-900/40",
      badgeClass: "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/50",
      iconColor: "text-purple-500"
    };
  };

  const filteredRoles = roles.filter(
    (r) =>
      r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.role_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <Shield size={18} className="text-purple-500" />
            Rol ve Yetki Tanımları
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Sistem kullanıcılarının erişebileceği modülleri, yetkilerini ve molalarını detaylıca yapılandırın.
          </p>
        </div>

        {/* Search & Add Button */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="relative">
            <input
              type="text"
              placeholder="Rollerde ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-48 text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} dark:focus:ring-rose-400/25 transition-all`}
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-555" />
          </div>

          <button
            onClick={openAddModal}
            className={`p-2 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center h-8 w-8 shrink-0`}
            title="Yeni Rol Ekle"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-955/15 border border-rose-200/50 dark:border-rose-900/30 rounded-2xl text-primary dark:text-rose-400 text-xs font-bold flex items-center justify-between gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Success Alert Banner */}
      {success && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/15 border border-emerald-200/50 dark:border-emerald-900/30 rounded-2xl text-primary dark:text-emerald-450 text-xs font-bold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
          <CheckCircle size={15} /> Değişiklikler başarıyla kaydedildi!
        </div>
      )}

      {/* Roles Compact List */}
      {loading ? (
        <div className="text-center py-12 text-xs text-slate-500">Rol verileri yükleniyor...</div>
      ) : filteredRoles.length === 0 ? (
        <div className="p-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-slate-550 dark:text-slate-450 text-xs">
          Arama kriterine uygun veya kayıtlı sistem rolü bulunmuyor.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredRoles.map((r) => {
            const styles = getRoleCardStyles(r.role_code);
            const permStats = getRolePermissionStats(r);
            const permPercent = permStats.total > 0 ? Math.round((permStats.granted / permStats.total) * 100) : 0;
            const roleUsers = users.filter(
              (u) => u.username !== "admin" && String(u.role || "agent").toLowerCase() === String(r.role_code || "").toLowerCase()
            );
            const visibleRoleUsers = roleUsers.slice(0, 5);
            const extraUserCount = Math.max(0, roleUsers.length - visibleRoleUsers.length);

            return (
              <div
                key={r.id}
                className={`px-6 py-4 bg-gradient-to-r ${styles.bgClass} bg-white dark:bg-slate-900 border rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200 hover:shadow-md ${styles.borderClass}`}
              >
                {/* 1. Role Name & Icon */}
                <div className="flex items-center gap-3.5 min-w-[220px] md:w-1/3">
                  <div className={`p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/40 dark:border-slate-800/50 shrink-0 ${styles.iconColor}`}>
                    <Shield size={18} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-white tracking-wide truncate">
                      {r.name}
                    </h4>
                    <span className="inline-block text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono">
                      {r.role_code}
                    </span>
                  </div>
                </div>

                {/* 2. Permission Summary (Total vs Granted) */}
                <div className="flex flex-col gap-1.5 min-w-[210px] md:w-1/3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      İzin Verilen Yetki
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold border ${styles.badgeClass}`}>
                        {permStats.granted} / {permStats.total}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        (Toplam {permStats.total} Yetki)
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${bg} rounded-full transition-all duration-300`}
                      style={{ width: `${permPercent}%` }}
                    />
                  </div>
                </div>

                {/* 3. Subscribers Avatar Stack */}
                <div className="flex items-center justify-start md:justify-center min-w-[160px] md:w-1/4">
                  {roleUsers.length === 0 ? (
                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 italic">
                      Bu rolde abone yok
                    </span>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center -space-x-2.5">
                        {visibleRoleUsers.map((u) => {
                          const avatarSrc =
                            u.avatar ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                              u.full_name || u.extension || u.id
                            )}`;
                          return (
                            <img
                              key={u.id || u.extension}
                              src={avatarSrc}
                              alt={u.full_name || "Abone"}
                              title={`${u.full_name || "Abone"}${u.extension ? ` (${u.extension})` : ""}`}
                              className="w-9 h-9 rounded-full border-2 border-white dark:border-slate-900 bg-slate-50 dark:bg-slate-800 object-cover shadow-sm transition-transform hover:scale-110 hover:z-10 cursor-pointer"
                            />
                          );
                        })}
                        {extraUserCount > 0 && (
                          <div
                            title={`${extraUserCount} abone daha`}
                            className="w-9 h-9 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-extrabold flex items-center justify-center shadow-sm z-10"
                          >
                            +{extraUserCount}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {roleUsers.length} Abone
                      </span>
                    </div>
                  )}
                </div>

                {/* 4. Edit & Delete Buttons */}
                <div className="flex items-center justify-end gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800/40 shrink-0">
                  <button
                    onClick={() => openEditModal(r)}
                    title="Rolü Düzenle"
                    className="px-3 py-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-950 flex items-center gap-1.5 text-xs font-bold transition-all"
                  >
                    <Edit2 size={13} />
                    <span>Düzenle</span>
                  </button>
                  <button
                    onClick={() => handleDeleteRole(r.id)}
                    title="Rolü Sil"
                    className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-900/50 hover:bg-rose-50/40 dark:hover:bg-rose-950/30 flex items-center justify-center text-xs font-bold transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* POPUP MODAL (Add / Edit Form with Left Sidebar Tabs) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
          <div className="w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20 shrink-0">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-primary" />
                <h3 className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-wider">
                  {editingRole ? `Rolü Düzenle: ${editingRole.name}` : "Yeni Rol Tanımla"}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 overflow-hidden">
              {/* Top Bar: Rol Kodu & Rol İsmi */}
              <div className="px-6 py-4 bg-slate-50/40 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
                {error && (
                  <div className="mb-3 p-3 bg-rose-50 dark:bg-rose-955/15 border border-rose-200/50 dark:border-rose-900/30 rounded-xl text-primary dark:text-rose-400 text-xs font-bold flex items-center justify-between gap-2.5">
                    <span>{error}</span>
                    <button type="button" onClick={() => setError("")} className="text-slate-400 hover:text-slate-600">
                      <X size={14} />
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Role Code */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1">
                      Rol Kodu
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Örn: agent, admin, supervisor"
                      value={roleCode}
                      onChange={(e) => setRoleCode(e.target.value)}
                      disabled={!!editingRole && ["admin", "agent", "supervisor"].includes(editingRole.role_code)}
                      className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none disabled:opacity-50"
                    />
                  </div>
                  {/* Role Name */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1">
                      Rol İsmi
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Örn: Müşteri Temsilcisi"
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Split Content: Left Sidebar Tabs + Right Permission Panel */}
              <div className="flex flex-1 overflow-hidden min-h-[380px]">
                {/* Left Sidebar Tabs */}
                <div className="w-64 sm:w-72 bg-slate-50/50 dark:bg-slate-950/30 border-r border-slate-100 dark:border-slate-800/60 p-3.5 shrink-0 overflow-y-auto">
                  <div className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2.5 mb-2">
                    Yetki Başlıkları
                  </div>
                  <nav className="space-y-1">
                    {ROLE_MODAL_CATEGORIES.map((cat) => {
                      const TabIcon = cat.icon;
                      const isActive = activeModalTab === cat.id;
                      let grantedInCat = 0;
                      let totalInCat = 0;
                      if (cat.id === "breaks") {
                        totalInCat = breaks.length;
                        grantedInCat = breaks.filter((b) => selectedBreaks.includes(b.id)).length;
                      } else {
                        const codes = getCategoryPermissionCodes(cat);
                        totalInCat = codes.length;
                        grantedInCat = codes.filter((c) => selectedPermissions.includes(c)).length;
                      }

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setActiveModalTab(cat.id)}
                          className={
                            "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left " +
                            (isActive
                              ? "bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700"
                              : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")
                          }
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <TabIcon size={15} className="shrink-0" />
                            <span className="truncate">{cat.name}</span>
                          </div>
                          <span
                            className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 ${
                              grantedInCat > 0
                                ? `${lightBg} ${text}`
                                : "bg-slate-200/70 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            {grantedInCat}/{totalInCat}
                          </span>
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Right Active Category Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {(() => {
                    const activeCat = ROLE_MODAL_CATEGORIES.find((c) => c.id === activeModalTab) || ROLE_MODAL_CATEGORIES[0];

                    if (activeCat.id === "breaks") {
                      const allBreaksSelected = breaks.length > 0 && breaks.every((b) => selectedBreaks.includes(b.id));
                      return (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
                            <div>
                              <h4 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                                {activeCat.name}
                              </h4>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                Bu role sahip temsilcilerin kullanabileceği mola tiplerini seçin.
                              </p>
                            </div>
                            {breaks.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (allBreaksSelected) {
                                    setSelectedBreaks([]);
                                  } else {
                                    setSelectedBreaks(breaks.map((b) => b.id));
                                  }
                                }}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                              >
                                {allBreaksSelected ? "Tümünü Kaldır" : "Tümünü Seç"}
                              </button>
                            )}
                          </div>

                          {breaks.length === 0 ? (
                            <p className="text-xs italic text-slate-400">
                              Sistemde tanımlı mola bulunmamaktadır. Lütfen önce Mola Tanımları yapın.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                              {breaks.map((b) => {
                                const isSelected = selectedBreaks.includes(b.id);
                                return (
                                  <button
                                    key={b.id}
                                    type="button"
                                    onClick={() => toggleBreak(b.id)}
                                    style={{
                                      borderColor: isSelected ? b.color : "transparent",
                                      backgroundColor: isSelected ? `${b.color}15` : ""
                                    }}
                                    className={`p-3 rounded-2xl border flex items-center justify-between text-left transition-all ${
                                      isSelected
                                        ? "text-slate-800 dark:text-white"
                                        : "bg-slate-50/50 dark:bg-slate-950/20 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-800/80 hover:bg-slate-50"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span
                                        style={{ backgroundColor: b.color }}
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                      />
                                      <span className="text-xs font-bold truncate">{b.name}</span>
                                    </div>
                                    <div
                                      className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                        isSelected
                                          ? "text-white"
                                          : "border-slate-300 dark:border-slate-700 bg-transparent"
                                      }`}
                                      style={{
                                        backgroundColor: isSelected ? b.color : "",
                                        borderColor: isSelected ? b.color : ""
                                      }}
                                    >
                                      {isSelected && <Check size={10} strokeWidth={3} />}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    const catCodes = getCategoryPermissionCodes(activeCat);
                    const allCatSelected = catCodes.length > 0 && catCodes.every((c) => selectedPermissions.includes(c));

                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
                          <div>
                            <h4 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                              {activeCat.name}
                            </h4>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                              Bu başlık altındaki modül ve işlem yetkilerini yapılandırın.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (allCatSelected) {
                                setSelectedPermissions(selectedPermissions.filter((p) => !catCodes.includes(p)));
                              } else {
                                setSelectedPermissions(Array.from(new Set([...selectedPermissions, ...catCodes])));
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shrink-0"
                          >
                            {allCatSelected ? "Tümünü Kaldır" : "Tümünü Seç"}
                          </button>
                        </div>

                        <div className="space-y-3">
                          {SYSTEM_FEATURES.filter((f) => activeCat.items.includes(f.id)).map((feat) => {
                            const Icon = feat.icon;
                            const accessKey = feat.id.includes(":") ? feat.id : `${feat.id}:access`;
                            const hasAccessSelected =
                              selectedPermissions.includes(accessKey) || selectedPermissions.includes(`${feat.id}:access`);

                            return (
                              <div
                                key={feat.id}
                                className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl flex flex-col gap-4"
                              >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  {/* Title & Icon Header */}
                                  <div className="flex items-center gap-3 md:w-2/5 shrink-0">
                                    <div className="p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400">
                                      <Icon size={14} />
                                    </div>
                                    <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                                      {feat.name}
                                    </span>
                                  </div>

                                  {/* Granular Action Switches */}
                                  <div className="flex flex-wrap gap-2.5 flex-1 md:justify-end">
                                    {feat.type === "crud" && (
                                      <>
                                        {/* Read */}
                                        <button
                                          type="button"
                                          onClick={() => togglePermission(`${feat.id}:read`)}
                                          className={`px-2.5 py-1.5 rounded-xl border text-[9px] font-bold transition-all flex items-center gap-1.5 ${
                                            selectedPermissions.includes(`${feat.id}:read`)
                                              ? "bg-indigo-50 dark:bg-indigo-950/20 text-primary dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/40"
                                              : "bg-white dark:bg-slate-900 text-slate-450 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                                          }`}
                                        >
                                          <Eye size={10} />
                                          <span>Görüntüleme</span>
                                        </button>

                                        {/* Write */}
                                        <button
                                          type="button"
                                          onClick={() => togglePermission(`${feat.id}:write`)}
                                          className={`px-2.5 py-1.5 rounded-xl border text-[9px] font-bold transition-all flex items-center gap-1.5 ${
                                            selectedPermissions.includes(`${feat.id}:write`)
                                              ? "bg-blue-50 dark:bg-blue-950/20 text-primary dark:text-blue-400 border-blue-200 dark:border-blue-900/40"
                                              : "bg-white dark:bg-slate-900 text-slate-450 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                                          }`}
                                        >
                                          <Edit3 size={10} />
                                          <span>Düzenleme</span>
                                        </button>

                                        {/* Delete */}
                                        <button
                                          type="button"
                                          onClick={() => togglePermission(`${feat.id}:delete`)}
                                          className={`px-2.5 py-1.5 rounded-xl border text-[9px] font-bold transition-all flex items-center gap-1.5 ${
                                            selectedPermissions.includes(`${feat.id}:delete`)
                                              ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 border-rose-200 dark:border-rose-900/40"
                                              : "bg-white dark:bg-slate-900 text-slate-450 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                                          }`}
                                        >
                                          <Trash size={10} />
                                          <span>Silme</span>
                                        </button>
                                      </>
                                    )}

                                    {feat.type === "crud_partial" && (
                                      <>
                                        {/* Read */}
                                        <button
                                          type="button"
                                          onClick={() => togglePermission(`${feat.id}:read`)}
                                          className={`px-2.5 py-1.5 rounded-xl border text-[9px] font-bold transition-all flex items-center gap-1.5 ${
                                            selectedPermissions.includes(`${feat.id}:read`)
                                              ? "bg-indigo-50 dark:bg-indigo-950/20 text-primary dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/40"
                                              : "bg-white dark:bg-slate-900 text-slate-450 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                                          }`}
                                        >
                                          <Eye size={10} />
                                          <span>Görüntüleme</span>
                                        </button>

                                        {/* Write */}
                                        <button
                                          type="button"
                                          onClick={() => togglePermission(`${feat.id}:write`)}
                                          className={`px-2.5 py-1.5 rounded-xl border text-[9px] font-bold transition-all flex items-center gap-1.5 ${
                                            selectedPermissions.includes(`${feat.id}:write`)
                                              ? "bg-blue-50 dark:bg-blue-950/20 text-primary dark:text-blue-400 border-blue-200 dark:border-blue-900/40"
                                              : "bg-white dark:bg-slate-900 text-slate-450 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                                          }`}
                                        >
                                          <Edit3 size={10} />
                                          <span>Güncelleme</span>
                                        </button>
                                      </>
                                    )}

                                    {feat.type === "access" && (
                                      <button
                                        type="button"
                                        onClick={() => togglePermission(accessKey)}
                                        className={`px-3 py-1.5 rounded-xl border text-[9px] font-bold transition-all flex items-center gap-1.5 ${
                                          hasAccessSelected
                                            ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-450 border-emerald-200 dark:border-emerald-900/40"
                                            : "bg-white dark:bg-slate-900 text-slate-450 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                                        }`}
                                      >
                                        <Unlock size={10} />
                                        <span>Erişim İzni</span>
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Nested Sub-Options for Temsilci Çağrı Paneli (call_panel) */}
                                {feat.id === "call_panel" && hasAccessSelected && (
                                  <div className="mt-1 pt-3.5 border-t border-slate-200/70 dark:border-slate-800/80 space-y-4">
                                    {CALL_PANEL_SUB_GROUPS.map((subGroup) => (
                                      <div key={subGroup.id} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                            {subGroup.title}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {subGroup.items.map((subItem) => {
                                            const isSubSelected = selectedPermissions.includes(subItem.id);
                                            return (
                                              <button
                                                key={subItem.id}
                                                type="button"
                                                onClick={() => togglePermission(subItem.id)}
                                                className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-bold transition-all flex items-center gap-1.5 text-left ${
                                                  isSubSelected
                                                    ? subItem.isRestriction
                                                      ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/60"
                                                      : `${lightBg} ${text} ${border}`
                                                    : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                                }`}
                                              >
                                                <div
                                                  className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${
                                                    isSubSelected
                                                      ? subItem.isRestriction
                                                        ? "bg-amber-500 border-amber-500 text-white"
                                                        : `${bg} border-transparent text-white`
                                                      : "border-slate-300 dark:border-slate-700"
                                                  }`}
                                                >
                                                  {isSubSelected && <Check size={9} strokeWidth={3} />}
                                                </div>
                                                <span>{subItem.name}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Modal Footer Action Buttons */}
              <div className="flex gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-950/20 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-500 hover:bg-slate-600 text-white transition-all"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${bg} ${hover} text-white transition-all shadow-md disabled:opacity-50`}
                >
                  {submitting ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDeleteRole}
        title="Rolü Sil"
        message="Seçilen sistem rolünü silmek istediğinize emin misiniz? Bu role sahip kullanıcılar varsayılan erişim haklarına düşecektir. Bu işlem geri alınamaz."
      />
    </div>
  );
}
