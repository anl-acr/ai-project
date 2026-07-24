import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, X, Shield, Search, Check, CheckCircle, Smartphone, Server, Coffee, User, Users, Terminal, HardDrive, Lock, Unlock, Eye, Edit3, Trash, GitBranch, Bot, MessageSquare, BookOpen, FileText, Cable, Fingerprint, Volume2, ArrowUpRight, PhoneCall } from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

const SYSTEM_FEATURES = [
  { id: "pbx", name: "Santral Entegrasyonu", icon: Server, type: "crud", color: "indigo" },
  { id: "channels", name: "Kanal Entegrasyonları", icon: Smartphone, type: "crud_partial", color: "pink" },
  { id: "breaks", name: "Mola Tanımları", icon: Coffee, type: "crud", color: "amber" },
  { id: "users", name: "Kullanıcı Yönetimi", icon: User, type: "crud", color: "blue" },
  { id: "roles", name: "Rol Tanımları", icon: Shield, type: "crud", color: "purple" },
  { id: "call_panel", name: "Çağrı Paneli", icon: Coffee, type: "access", color: "emerald" },
  { id: "call_panel:listen_records", name: "Temsilci Paneli Ses Kaydı Dinleme", icon: Volume2, type: "access", color: "emerald" },
  { id: "logs", name: "Sistem Logları", icon: Terminal, type: "access", color: "cyan" },
  { id: "storage", name: "Recording/NAS Depolama", icon: HardDrive, type: "access", color: "rose" },
  { id: "transcripts", name: "Maskesiz Görüşme Metinleri Yetkisi", icon: Terminal, type: "access", color: "orange" },
  { id: "dialer", name: "Dış Arama Modülü (Dialer)", icon: Smartphone, type: "access", color: "blue" },
  { id: "call_flow", name: "Arama Akış Yönetimi (Call Flow)", icon: GitBranch, type: "access", color: "indigo" },
  { id: "ai_agents", name: "Yapay Zeka Temsilcileri (AI Agents)", icon: Bot, type: "crud", color: "purple" },
  { id: "ai_whisper", name: "AI Fısıldama Yetkisi", icon: Terminal, type: "access", color: "amber" },
  { id: "omnichannel", name: "Ortak Gelen Kutusu (Omnichannel)", icon: MessageSquare, type: "access", color: "purple" },
  { id: "contacts", name: "Rehber (Contacts)", icon: BookOpen, type: "crud", color: "blue" },
  { id: "canned_responses", name: "Hızlı Cevap Taslakları", icon: FileText, type: "crud", color: "pink" },
  { id: "blacklist", name: "Kara Liste ve Suistimal Koruması (AI Abuse Shield)", icon: Shield, type: "crud", color: "rose" },
  { id: "mobile_transfer", name: "Mobil Numaraya Akıllı AI Transferi", icon: Smartphone, type: "crud_partial", color: "indigo" },
  { id: "qa", name: "Otomatik Kalite Değerlendirme (Automated QA)", icon: FileText, type: "crud", color: "indigo" },
  { id: "autoprovision_templates", name: "Otoprovizyon Şablonları", icon: FileText, type: "crud", color: "amber" },
  { id: "outbound_rules", name: "Giden Arama Kuralları", icon: ArrowUpRight, type: "crud", color: "indigo" },
  { id: "speed_dials", name: "Hızlı Arama Yönetimi", icon: PhoneCall, type: "crud", color: "rose" },
  { id: "conferences", name: "Konferans Yönetimi", icon: Users, type: "crud", color: "blue" },
  { id: "universal_api", name: "Evrensel API & Webhook Sihirbazı", icon: Cable, type: "crud", color: "indigo" },
  { id: "voice_biometrics", name: "Biyometrik Ses Doğrulama", icon: Fingerprint, type: "crud", color: "indigo" },
  { id: "announcements", name: "Anons Yönetimi", icon: Volume2, type: "crud", color: "pink" },
  { id: "reports", name: "Gelişmiş Çağrı Raporları ve KPI Panosu", icon: FileText, type: "access", color: "purple" },
  { id: "autoprovision", name: "Otoprovizyon", icon: Smartphone, type: "crud", color: "indigo" },
  { id: "acd_queues", name: "ACD Kuyruk Yönetimi", icon: Users, type: "crud", color: "blue" },
  { id: "trunks", name: "Santral Dış Hatları (Trunks)", icon: Cable, type: "crud", color: "indigo" },
  { id: "inbound_rules", name: "Gelen Arama Kuralları", icon: PhoneCall, type: "crud", color: "pink" },
  { id: "call_pickup_groups", name: "Çağrı Toplama Grupları", icon: Users, type: "crud", color: "blue" },
  { id: "subscriber_groups", name: "Abone Grupları", icon: Users, type: "crud", color: "blue" },
  { id: "roi_settings", name: "ROI Rapor Ayarları", icon: FileText, type: "crud", color: "amber" },
  { id: "ssl", name: "SSL Sertifika Yönetimi", icon: Shield, type: "crud_partial", color: "emerald" },
  { id: "backup_restore", name: "Yedekleme ve Geri Yükleme", icon: HardDrive, type: "crud_partial", color: "blue" },
  { id: "recording_retention", name: "Ses Kayıt ve Saklama Süresi Yönetimi", icon: Server, type: "crud_partial", color: "rose" },
  { id: "security", name: "Güvenlik Kalkanı", icon: Shield, type: "crud_partial", color: "cyan" },
  { id: "api_budgets", name: "API Bütçe ve Tüketim Takibi", icon: HardDrive, type: "crud_partial", color: "emerald" }
];

export default function RoleSettings({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [roles, setRoles] = useState([]);
  const [breaks, setBreaks] = useState([]);
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

  const resolveHost = (bh) => {
    if (typeof window === "undefined") return bh || "localhost:8000";
    if (window.location.port === "3000" || window.location.port === "3001") {
      return bh || `${window.location.hostname}:8000`;
    }
    return window.location.host;
  };
  const host = resolveHost(backendHost);
  const API_BASE = `${window.location.protocol}//${host}`;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const resRoles = await fetch(`${API_BASE}/api/settings/roles`);
      const dataRoles = await resRoles.json();
      if (dataRoles) setRoles(dataRoles);

      const resBreaks = await fetch(`${API_BASE}/api/settings/breaks`);
      const dataBreaks = await resBreaks.json();
      if (dataBreaks) setBreaks(dataBreaks);
    } catch (err) {
      console.error("Roller/Molalar yüklenemedi:", err);
      setError("Rol ve mola tanımları sunucudan alınamadı.");
    } finally {
      setLoading(false);
    }
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSaveAll = async (updatedRoles) => {
    setError("");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(`${API_BASE}/api/settings/roles`, {
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

  const openAddModal = () => {
    setError("");
    setEditingRole(null);
    setRoleCode("");
    setRoleName("");
    setSelectedPermissions([]);
    setSelectedBreaks(breaks.map(b => b.id)); // Default allow all breaks
    setShowModal(true);
  };

  const openEditModal = (r) => {
    setError("");
    setEditingRole(r);
    setRoleCode(r.role_code);
    setRoleName(r.name);
    setSelectedPermissions(r.permissions || []);
    setSelectedBreaks(r.allowed_breaks || []);
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
      setSelectedPermissions([...selectedPermissions, permCode]);
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

      {/* Roles Dashboard Grid */}
      {loading ? (
        <div className="text-center py-12 text-xs text-slate-500">Rol verileri yükleniyor...</div>
      ) : filteredRoles.length === 0 ? (
        <div className="p-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-slate-550 dark:text-slate-450 text-xs">
          Arama kriterine uygun veya kayıtlı sistem rolü bulunmuyor.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {filteredRoles.map((r) => {
            const styles = getRoleCardStyles(r.role_code);
            return (
              <div
                key={r.id}
                className={`p-6 bg-gradient-to-r ${styles.bgClass} bg-white dark:bg-slate-900 border rounded-3xl shadow-sm flex flex-col xl:flex-row justify-between gap-6 transition-all duration-300 hover:shadow-md hover:scale-[1.002] ${styles.borderClass}`}
              >
                {/* Info & Matrix Group */}
                <div className="flex-1 space-y-4">
                  {/* Card Title Header */}
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/30 dark:border-slate-800/40 ${styles.iconColor}`}>
                      <Shield size={16} />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-slate-800 dark:text-white uppercase tracking-wider">{r.name}</h4>
                      <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 font-mono mt-0.5">{r.role_code}</p>
                    </div>
                  </div>

                  {/* Dynamic Granular Matrix Renderer */}
                  <div className="pt-2">
                    <h5 className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5">Erişim & Eylem Matrisi</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {SYSTEM_FEATURES.map((feat) => {
                        const Icon = feat.icon;
                        const hasRead = r.permissions.includes(`${feat.id}:read`);
                        const hasWrite = r.permissions.includes(`${feat.id}:write`);
                        const hasDelete = r.permissions.includes(`${feat.id}:delete`);
                        const hasAccess = r.permissions.includes(`${feat.id}:access`);
                        
                        const activeCount = [hasRead, hasWrite, hasDelete, hasAccess].filter(Boolean).length;
                        
                        return (
                          <div
                            key={feat.id}
                            className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2.5 bg-slate-50/50 dark:bg-slate-950/30 ${
                              activeCount > 0 
                                ? "border-slate-200 dark:border-slate-800/80" 
                                : "border-slate-200/40 dark:border-slate-800/20 opacity-40"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Icon size={12} className={activeCount > 0 ? "text-slate-600 dark:text-slate-400" : "text-slate-400"} />
                              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-350 truncate">{feat.name.split(" ")[0]}</span>
                            </div>
                            
                            {/* Action Matrix Dots */}
                            <div className="flex gap-1 shrink-0">
                              {feat.type === "crud" ? (
                                <>
                                  <span title="Görüntüleme (Oku)" className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-extrabold ${hasRead ? "bg-primary text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-400"}`}>G</span>
                                  <span title="Düzenleme (Yaz)" className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-extrabold ${hasWrite ? "bg-primary text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-400"}`}>D</span>
                                  <span title="Silme" className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-extrabold ${hasDelete ? "bg-primary text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-400"}`}>S</span>
                                </>
                              ) : feat.type === "crud_partial" ? (
                                <>
                                  <span title="Görüntüleme" className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-extrabold ${hasRead ? "bg-primary text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-400"}`}>G</span>
                                  <span title="Güncelleme" className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-extrabold ${hasWrite ? "bg-primary text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-400"}`}>D</span>
                                </>
                              ) : (
                                <span title="Modül Erişimi" className={`w-6 h-3.5 rounded-full flex items-center justify-center text-[7px] font-extrabold ${hasAccess ? "bg-primary text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-400"}`}>Erişim</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Allowed breaks badges list */}
                  <div className="pt-1.5 flex flex-wrap gap-2 items-center">
                    <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-1.5">Yetkili Molalar:</span>
                    {(r.allowed_breaks || []).length === 0 ? (
                      <span className="text-[9px] text-slate-450 italic">Molalara izin verilmiyor</span>
                    ) : (
                      r.allowed_breaks.map((breakId) => {
                        const b = breaks.find(br => br.id === breakId);
                        if (!b) return null;
                        return (
                          <div
                            key={breakId}
                            style={{
                              borderColor: `${b.color}25`
                            }}
                            className="px-2.5 py-1 rounded-xl border bg-white dark:bg-slate-950 flex items-center gap-1.5 shadow-sm text-[9px] font-bold text-slate-700 dark:text-slate-350"
                          >
                            <span
                              style={{ backgroundColor: b.color }}
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                            />
                            {b.name}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Edit & Delete Buttons */}
                <div className="flex xl:flex-col items-center justify-end gap-2.5 border-t xl:border-t-0 pt-4 xl:pt-0 border-slate-100 dark:border-slate-800/40 shrink-0">
                  <button
                    onClick={() => openEditModal(r)}
                    className="flex-1 xl:flex-none p-2.5 text-slate-450 hover:text-slate-700 dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-950 flex items-center gap-2 text-xs font-bold transition-all"
                  >
                    <Edit2 size={13} />
                    <span className="xl:hidden">Rolü Düzenle</span>
                  </button>
                  <button
                    onClick={() => handleDeleteRole(r.id)}
                    className="flex-1 xl:flex-none p-2.5 text-slate-450 hover:text-primary dark:hover:text-primary rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-rose-50/20 dark:hover:bg-rose-950/20 flex items-center gap-2 text-xs font-bold transition-all"
                  >
                    <Trash2 size={13} />
                    <span className="xl:hidden">Rolü Sil</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* POPUP MODAL (Add / Edit Form) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-primary" />
                <h3 className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-wider">
                  {editingRole ? "Rolü Düzenle" : "Yeni Rol Tanımla"}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-955/15 border border-rose-200/50 dark:border-rose-900/30 rounded-2xl text-primary dark:text-rose-400 text-xs font-bold flex items-center justify-between gap-2.5">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError("")} className="text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {/* Role Code */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">
                    Rol Kodu
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: agent, admin, supervisor"
                    value={roleCode}
                    onChange={(e) => setRoleCode(e.target.value)}
                    disabled={!!editingRole && ["admin", "agent", "supervisor"].includes(editingRole.role_code)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none disabled:opacity-50"
                  />
                </div>
                {/* Role Name */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">
                    Rol İsmi
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Müşteri Temsilcisi"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Granular Permissions Card Stack */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider mb-3">
                  Rol Yetki Detayları (Granüler İzinler)
                </label>
                <div className="space-y-6">
                  {[
                    {
                      id: "pbx",
                      name: "Santral & Çağrı Yönetimi",
                      items: ["pbx", "acd_queues", "trunks", "inbound_rules", "outbound_rules", "call_pickup_groups", "subscriber_groups", "conferences", "speed_dials", "autoprovision", "autoprovision_templates", "announcements"]
                    },
                    {
                      id: "ai",
                      name: "Yapay Zeka & Otomasyon",
                      items: ["ai_agents", "ai_whisper", "voice_biometrics", "qa", "blacklist", "mobile_transfer", "call_flow"]
                    },
                    {
                      id: "reports",
                      name: "Raporlar & İzleme",
                      items: ["reports", "call_panel", "call_panel:listen_records", "transcripts", "logs", "storage"]
                    },
                    {
                      id: "omnichannel",
                      name: "Müşteri & İletişim (Omnichannel)",
                      items: ["omnichannel", "contacts", "canned_responses", "dialer", "channels"]
                    },
                    {
                      id: "system",
                      name: "Sistem Ayarları",
                      items: ["users", "roles", "breaks", "universal_api", "locations", "roi_settings", "ssl", "backup_restore", "recording_retention", "security", "api_budgets"]
                    }
                  ].map(category => (
                    <div key={category.id} className="space-y-3">
                      <h4 className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800/60 pb-2">
                        {category.name}
                      </h4>
                      <div className="space-y-3">
                        {SYSTEM_FEATURES.filter(f => category.items.includes(f.id)).map((feat) => {
                          const Icon = feat.icon;
                          return (
                            <div
                              key={feat.id}
                              className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                              {/* Title & Icon Header */}
                              <div className="flex items-center gap-3 md:w-1/3 shrink-0">
                                <div className="p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400">
                                  <Icon size={14} />
                                </div>
                                <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                                  {feat.name}
                                </span>
                              </div>

                              {/* Granular Action Switches */}
                              <div className="flex flex-wrap gap-3 flex-1 md:justify-end">
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
                                    onClick={() => togglePermission(`${feat.id}:access`)}
                                    className={`px-3 py-1.5 rounded-xl border text-[9px] font-bold transition-all flex items-center gap-1.5 ${
                                      selectedPermissions.includes(`${feat.id}:access`)
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
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Allowed Break Definitions */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider mb-2.5">
                  İzin Verilen Mola Tipleri
                </label>
                {breaks.length === 0 ? (
                  <p className="text-[10px] text-slate-455 italic text-slate-400">Sistemde tanımlı mola bulunmamaktadır. Lütfen önce Mola Tanımları yapın.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                          className={`p-2.5 rounded-2xl border flex items-center justify-between text-left transition-all ${
                            isSelected
                              ? "text-slate-800 dark:text-white"
                              : "bg-slate-50/50 dark:bg-slate-950/20 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-800/80 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              style={{ backgroundColor: b.color }}
                              className="w-2 h-2 rounded-full shrink-0"
                            />
                            <span className="text-[11px] font-bold truncate max-w-[80px]">{b.name}</span>
                          </div>
                          <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
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

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-2xl font-bold border dark: dark: dark: hover: dark:hover: transition-all animate-none bg-slate-500 hover:bg-slate-600 text-white border-transparent"
                >Vazgeç</button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 py-3 rounded-2xl text-xs font-bold ${bg} ${hover} text-white transition-all shadow-md disabled:opacity-50`}
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
