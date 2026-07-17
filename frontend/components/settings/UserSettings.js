import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, Edit2, X, User, Mail, Phone, Shield, Check, CheckCircle, ToggleLeft, ToggleRight, Search, Copy, RefreshCw, KeyRound, PhoneCall, Settings, Image as ImageIcon, Monitor, Smartphone, AlertTriangle } from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

const PRESET_AVATARS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Anil",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Can",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Sara",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Adrian",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Jack",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
];

const ANNOUNCEMENTS = [
  "Varsayılan Anons",
  "Kişisel Anons 1",
  "Mesai Dışı Anonsu"
];

export default function UserSettings({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  
  // Delete confirmation
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Modal / Popup States
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [activeTab, setActiveTab] = useState("login_sip");

  // Basic Form Fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [extension, setExtension] = useState("");
  const [avatar, setAvatar] = useState(PRESET_AVATARS[0]);
  const [role, setRole] = useState("agent");
  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState("");

  // SIP Fields
  const [sipPassword, setSipPassword] = useState("");
  const [outboundCallerId, setOutboundCallerId] = useState("");

  // Forwarding Fields
  const [fwdAlwaysActive, setFwdAlwaysActive] = useState(false);
  const [fwdAlwaysType, setFwdAlwaysType] = useState("internal");
  const [fwdAlwaysTarget, setFwdAlwaysTarget] = useState("");
  
  const [fwdBusyActive, setFwdBusyActive] = useState(false);
  const [fwdBusyType, setFwdBusyType] = useState("internal");
  const [fwdBusyTarget, setFwdBusyTarget] = useState("");
  
  const [fwdNoAnswerActive, setFwdNoAnswerActive] = useState(false);
  const [fwdNoAnswerType, setFwdNoAnswerType] = useState("internal");
  const [fwdNoAnswerTarget, setFwdNoAnswerTarget] = useState("");
  const [fwdNoAnswerTimeout, setFwdNoAnswerTimeout] = useState(30);

  // Voicemail Fields
  const [voicemailActive, setVoicemailActive] = useState(false);
  const [voicemailAnnouncement, setVoicemailAnnouncement] = useState(ANNOUNCEMENTS[0]);
  const [voicemailPin, setVoicemailPin] = useState("");
  const [voicemailToEmail, setVoicemailToEmail] = useState(false);

  // Feature Fields
  const [recordingActive, setRecordingActive] = useState(false);
  const [transport, setTransport] = useState("UDP");

  const [systemRoles, setSystemRoles] = useState([]);

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    fetchUsersAndRoles();
  }, []);

  const fetchUsersAndRoles = async () => {
    setLoading(true);
    try {
      const resUsers = await fetch(`${API_BASE}/api/settings/users`);
      const dataUsers = await resUsers.json();
      if (dataUsers) setUsers(dataUsers);

      const resRoles = await fetch(`${API_BASE}/api/settings/roles`);
      const dataRoles = await resRoles.json();
      if (dataRoles) setSystemRoles(dataRoles);
    } catch (err) {
      console.error(`Kullanıcılar veya Roller yüklenemedi:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (systemRoles.length > 0 && !systemRoles.find(r => r.role_code === role)) {
      setRole(systemRoles[0].role_code);
    }
  }, [systemRoles, role]);

  const handleSaveAll = async (updatedUsers) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/settings/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedUsers)
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const errData = await res.json();
        setError(errData.detail || "Kullanıcı kaydedilirken bir hata oluştu.");
        fetchUsersAndRoles(); // reload previous state
      }
    } catch (err) {
      console.error("Kullanıcı ayarları kaydedilemedi:", err);
      setError("Bağlantı hatası oluştu.");
      fetchUsersAndRoles();
    }
  };

  const generateSipPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$*()";
    let pwd = "";
    for(let i=0; i<16; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSipPassword(pwd);
  };

  const copySipPassword = () => {
    navigator.clipboard.writeText(sipPassword);
  };

  const resetForm = () => {
    setEditingUser(null);
    setActiveTab("login_sip");
    setFullName("");
    setEmail("");
    setExtension("");
    setAvatar(PRESET_AVATARS[0]);
    setRole(systemRoles.length > 0 ? systemRoles[0].role_code : "agent");
    setIsActive(true);
    setPassword("");
    setSipPassword("");
    setOutboundCallerId("");

    setFwdAlwaysActive(false); setFwdAlwaysType("internal"); setFwdAlwaysTarget("");
    setFwdBusyActive(false); setFwdBusyType("internal"); setFwdBusyTarget("");
    setFwdNoAnswerActive(false); setFwdNoAnswerType("internal"); setFwdNoAnswerTarget(""); setFwdNoAnswerTimeout(30);

    setVoicemailActive(false); setVoicemailAnnouncement(ANNOUNCEMENTS[0]);
    setVoicemailPin(""); setVoicemailToEmail(false);

    setRecordingActive(false); setTransport("UDP");
  };

  const openAddModal = () => {
    resetForm();
    generateSipPassword();
    setShowModal(true);
  };

  const openEditModal = (u) => {
    resetForm();
    setEditingUser(u);
    setFullName(u.full_name || "");
    setEmail(u.email || "");
    setExtension(u.extension || "");
    setAvatar(u.avatar || PRESET_AVATARS[0]);
    setRole(u.role || "agent");
    setIsActive(u.is_active !== undefined ? u.is_active : true);
    setPassword(u.password || "");
    
    setSipPassword(u.sip_password || "");
    if(!u.sip_password) generateSipPassword();
    
    setOutboundCallerId(u.outbound_caller_id || "");

    if (u.forwarding_always) { setFwdAlwaysActive(u.forwarding_always.active || false); setFwdAlwaysType(u.forwarding_always.type || "internal"); setFwdAlwaysTarget(u.forwarding_always.target || ""); }
    if (u.forwarding_busy) { setFwdBusyActive(u.forwarding_busy.active || false); setFwdBusyType(u.forwarding_busy.type || "internal"); setFwdBusyTarget(u.forwarding_busy.target || ""); }
    if (u.forwarding_no_answer) { setFwdNoAnswerActive(u.forwarding_no_answer.active || false); setFwdNoAnswerType(u.forwarding_no_answer.type || "internal"); setFwdNoAnswerTarget(u.forwarding_no_answer.target || ""); setFwdNoAnswerTimeout(u.forwarding_no_answer.timeout || 30); }

    setVoicemailActive(u.voicemail_active || false);
    setVoicemailAnnouncement(u.voicemail_announcement || ANNOUNCEMENTS[0]);
    setVoicemailPin(u.voicemail_pin || "");
    setVoicemailToEmail(u.voicemail_to_email || false);

    setRecordingActive(u.recording_active || false);
    setTransport(u.transport || "UDP");

    setShowModal(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !extension.trim()) return;

    const userData = {
      full_name: fullName.trim(),
      email: email.trim(),
      extension: extension.trim(),
      avatar,
      role,
      is_active: isActive,
      password,
      sip_password: sipPassword,
      outbound_caller_id: outboundCallerId.trim(),
      forwarding_always: fwdAlwaysTarget ? { active: fwdAlwaysActive, type: fwdAlwaysType, target: fwdAlwaysTarget } : null,
      forwarding_busy: fwdBusyTarget ? { active: fwdBusyActive, type: fwdBusyType, target: fwdBusyTarget } : null,
      forwarding_no_answer: fwdNoAnswerTarget ? { active: fwdNoAnswerActive, type: fwdNoAnswerType, target: fwdNoAnswerTarget, timeout: fwdNoAnswerTimeout } : null,
      voicemail_active: voicemailActive,
      voicemail_announcement: voicemailAnnouncement,
      voicemail_pin: voicemailPin,
      voicemail_to_email: voicemailToEmail,
      recording_active: recordingActive,
      transport: transport
    };

    if (editingUser) {
      // Edit mode
      const updated = users.map((u) => {
        if (u.id === editingUser.id) {
          return { ...u, ...userData };
        }
        return u;
      });
      setUsers(updated);
      handleSaveAll(updated);
    } else {
      // Add mode
      const newUser = { id: Date.now(), ...userData };
      const updated = [...users, newUser];
      setUsers(updated);
      handleSaveAll(updated);
    }
    setShowModal(false);
  };

  const handleDeleteUser = (id) => {
    setDeleteTargetId(id);
  };

  const confirmDeleteUser = () => {
    if (deleteTargetId) {
      const filtered = users.filter((u) => u.id !== deleteTargetId);
      setUsers(filtered);
      handleSaveAll(filtered);
      setDeleteTargetId(null);
    }
  };

  const toggleUserActive = (userItem) => {
    const updated = users.map((u) => {
      if (u.id === userItem.id) {
        return { ...u, is_active: !u.is_active };
      }
      return u;
    });
    setUsers(updated);
    handleSaveAll(updated);
  };

  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase();
    return (
      (u.full_name || "").toLowerCase().includes(query) ||
      (u.email || "").toLowerCase().includes(query) ||
      (u.extension || "").includes(query)
    );
  });

  const renderForwardingRow = (label, active, setActive, type, setType, target, setTarget, timeout, setTimeoutVal) => (
    <div className={`grid grid-cols-12 gap-3 items-end p-3 rounded-xl border transition-all ${active ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800' : 'bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/40 opacity-70'}`}>
        <div className="col-span-12 flex items-center justify-between mb-1 pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <label className="text-[11px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">{label}</label>
            <button type="button" onClick={() => setActive(!active)} className="text-slate-400 hover:text-slate-700 transition-colors">
                {active ? <ToggleRight size={24} className={text} /> : <ToggleLeft size={24} />}
            </button>
        </div>
        <div className="col-span-12 sm:col-span-3">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Tip</label>
            <select
                disabled={!active}
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none disabled:opacity-50"
            >
                <option value="internal">Dahili Hat</option>
                <option value="external">Dış Numara</option>
            </select>
        </div>
        <div className="col-span-12 sm:col-span-6">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Hedef</label>
            {type === "internal" ? (
                <select
                    disabled={!active}
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none disabled:opacity-50"
                >
                    <option value="">Seçiniz...</option>
                    {users.map(u => <option key={u.id} value={u.extension}>{u.full_name} ({u.extension})</option>)}
                </select>
            ) : (
                <input
                    disabled={!active}
                    type="text"
                    placeholder="Numara giriniz"
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none disabled:opacity-50"
                />
            )}
        </div>
        {setTimeoutVal && (
            <div className="col-span-12 sm:col-span-3">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Süre (sn)</label>
                <input
                    disabled={!active}
                    type="number"
                    min="1"
                    value={timeout}
                    onChange={e => setTimeoutVal(parseInt(e.target.value) || 30)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none disabled:opacity-50"
                />
            </div>
        )}
    </div>
  );

  return (
    <div className="w-full space-y-6">
      {/* Header and Search & Add Action */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${lightBg} ${text} rounded-xl`}>
            <User size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-850 dark:text-white uppercase tracking-wider">KULLANICI YÖNETİMİ</h3>
            <p className="text-[10px] text-slate-505 dark:text-slate-400 mt-0.5 font-medium">
              Sistem yöneticileri ve çağrı merkezi temsilcilerinin erişim tanımlarını yönetin.
            </p>
          </div>
        </div>

        {/* Search Bar + "+" Icon Wrapper */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <input
              type="text"
              placeholder="Kullanıcı ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-48 text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}  transition-all`}
            />
            <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-555`} />
          </div>

          <button
            onClick={openAddModal}
            className={`p-2 ${bg} ${hover} text-white rounded-xl font-bold transition-all shadow-sm flex items-center justify-center h-8 w-8 shrink-0`}
            title="Yeni Kullanıcı Ekle"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Status Bar */}
      {success && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/15 border border-emerald-200/50 dark:border-emerald-900/30 rounded-xl text-primary dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-pulse">
          <CheckCircle size={14} /> Değişiklikler başarıyla kaydedildi!
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/15 border border-rose-200/50 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Users List (Responsive Full Width Table Rows) */}
      {loading ? (
        <div className="text-center py-10 text-xs text-slate-500">Kullanıcı listesi yükleniyor...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-slate-500 text-xs">
          Arama kriterine uygun veya kayıtlı sistem kullanıcısı bulunmuyor.
        </div>
      ) : (
        <div className="space-y-3.5 w-full">
          {/* Column Header Row */}
          <div className="hidden sm:flex items-center justify-between px-4 py-2 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider select-none border-b border-slate-100 dark:border-slate-800/40 pb-2.5">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-10 text-center shrink-0">Durum</div>
              <div className="w-12 text-center shrink-0">Profil</div>
              <div className="grid grid-cols-12 gap-4 flex-1 items-center">
                <div className="col-span-3">Kullanıcı Adı</div>
                <div className="col-span-2">Rol</div>
                <div className="col-span-4">E-Posta Adresi</div>
                <div className="col-span-3">Dahili Numarası</div>
              </div>
            </div>
            <div className="w-24 text-right shrink-0">İşlem</div>
          </div>

          {filteredUsers.map((u) => (
            <div
              key={u.id}
              className={`p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 hover:scale-[1.005] w-full ${
                !u.is_active ? "opacity-60" : ""
              }`}
            >
              {/* Left Side: Avatar & Details */}
              <div className="flex items-center gap-4 flex-1">
                <div className="w-10 flex items-center justify-center shrink-0">
                  <div className="relative group flex items-center justify-center cursor-pointer">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 shadow-sm ${u.active_sessions?.length > 0 ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-rose-500 shadow-rose-500/50 opacity-60'}`} />
                    {u.active_sessions?.length > 0 && (
                      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 w-48 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl border border-slate-200 dark:border-slate-700/50">
                        <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white/95 dark:bg-slate-900/95 border-l border-b border-slate-200 dark:border-slate-700/50 rotate-45"></div>
                        <h5 className="text-[10px] font-extrabold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-2 border-b border-slate-200 dark:border-slate-700/50 pb-1.5">Aktif Oturumlar</h5>
                        <div className="space-y-2 relative z-10">
                          {u.active_sessions.map((sess, idx) => (
                            <div key={idx} className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 text-slate-800 dark:text-white text-xs font-bold">
                                {sess.device_type === "web" ? <Monitor size={12} className="text-blue-500 dark:text-blue-400" /> : sess.device_type === "sip" ? <Phone size={12} className="text-emerald-500 dark:text-emerald-400" /> : <Smartphone size={12} className="text-purple-500 dark:text-purple-400" />}
                                <span className="capitalize">{sess.device_type}</span>
                              </div>
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-slate-500 dark:text-slate-400 font-mono">{sess.ip_address}</span>
                                {sess.last_seen && <span className="text-slate-400 dark:text-slate-500">{sess.last_seen}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-12 flex items-center justify-center shrink-0">
                  <img
                    src={u.avatar}
                    alt={u.full_name}
                    className="w-12 h-12 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-1 shrink-0"
                  />
                </div>
                <div className="grid grid-cols-12 gap-4 flex-1 items-center">
                  <div className="col-span-3">
                    <h4 className="font-bold text-xs text-slate-800 dark:text-white truncate">
                      {u.full_name}
                    </h4>
                  </div>
                  
                  <div className="col-span-2 flex items-center">
                    {(() => {
                      const userRoleObj = systemRoles.find(r => r.role_code === u.role);
                      const roleLabel = userRoleObj ? userRoleObj.name : u.role;
                      const roleColor = 
                        u.role === "admin"
                          ? "bg-purple-50 dark:bg-purple-950/20 text-primary dark:text-purple-400 border-purple-200/50 dark:border-purple-900/30"
                          : u.role === "supervisor"
                          ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/30"
                          : "bg-blue-50 dark:bg-blue-950/20 text-primary dark:text-blue-400 border-blue-200/50 dark:border-blue-900/30";
                      return (
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${roleColor} truncate`}>
                          {roleLabel}
                        </span>
                      );
                    })()}
                  </div>
                  
                  <div className="col-span-4 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                    <Mail size={12} className="text-slate-400 shrink-0" />
                    <span className="truncate">{u.email}</span>
                  </div>

                  <div className="col-span-3 text-[10px] text-slate-500 dark:text-slate-450 flex items-center gap-2">
                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-bold shrink-0">
                      <Phone size={10} /> Dahili:
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-extrabold text-slate-700 dark:text-slate-300 text-[9px] shrink-0">
                      {u.extension}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Side: Actions */}
              <div className="flex items-center gap-2 justify-between sm:justify-end border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100 dark:border-slate-800/60 w-24 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(u)}
                    className="p-1.5 text-slate-450 hover:text-slate-700 dark:hover:text-white rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-200"
                    title="Düzenle"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleDeleteUser(u.id)}
                    className="p-1.5 text-slate-450 hover:text-primary dark:hover:text-primary rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-250"
                    title="Kullanıcıyı Sil"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* POPUP MODAL (Add / Edit Form with Tabs) */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 transition-all duration-300">
          <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20 shrink-0">
              <h3 className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-wider">
                {editingUser ? "Kullanıcı Düzenle" : "Yeni Kullanıcı Ekle"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Tabs */}
                <div className="w-64 bg-slate-50/50 dark:bg-slate-950/30 border-r border-slate-100 dark:border-slate-800/60 p-4 shrink-0 overflow-y-auto">
                    <nav className="space-y-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab("login_sip")}
                            className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === 'login_sip' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                        >
                            <KeyRound size={16} />
                            Giriş ve SIP
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("forwarding")}
                            className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === 'forwarding' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                        >
                            <PhoneCall size={16} />
                            Yönlendirme & Voicemail
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("features")}
                            className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === 'features' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                        >
                            <Settings size={16} />
                            Özellikler
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("avatar")}
                            className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === 'avatar' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                        >
                            <ImageIcon size={16} />
                            Avatar Seçimi
                        </button>
                    </nav>
                </div>

                {/* Tab Content Area */}
                <div className="flex-1 overflow-y-auto">
                    <form onSubmit={handleFormSubmit} className="p-6 space-y-6 h-full flex flex-col justify-between">
                        
                        {/* TAB 1: GİRİŞ VE SIP */}
                        {activeTab === "login_sip" && (
                            <div className="space-y-5 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60">
                                    <div>
                                        <h5 className="text-xs font-bold text-slate-700 dark:text-white">Kullanıcı Aktif mi?</h5>
                                        <p className="text-[10px] text-slate-400">Pasif kullanıcılar sisteme giremez ve SIP kaydedemez.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsActive(!isActive)}
                                        className="text-slate-400 hover:text-slate-700 transition-colors"
                                    >
                                        {isActive ? <ToggleRight size={30} className={text} /> : <ToggleLeft size={30} />}
                                    </button>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">İsim Soyisim</label>
                                        <input type="text" required placeholder="Örn: Ahmet Yılmaz" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">E-posta Adresi</label>
                                        <input type="email" required placeholder="ahmet@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">Kullanıcı Rolü</label>
                                        <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none">
                                            {systemRoles.length === 0 && <option value="agent">Agent</option>}
                                            {systemRoles.map(r => <option key={r.role_code} value={r.role_code}>{r.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">Arayüz Şifresi (Login)</label>
                                        <input type="password" placeholder="Şifre belirleyin" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none" />
                                    </div>
                                </div>

                                <div className={`p-4 rounded-xl border ${borderLight} ${lightBg} space-y-4 mt-2`}>
                                    <h4 className={`text-xs font-bold ${text} border-b ${borderLight} pb-2`}>SIP AYARLARI</h4>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">Dahili Numarası (Extension)</label>
                                            <input type="text" required placeholder="Örn: 202" value={extension} onChange={(e) => setExtension(e.target.value)} className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">Dış Aramada Görünecek Numara</label>
                                            <input type="text" placeholder="Boş bırakılırsa varsayılan kural" value={outboundCallerId} onChange={(e) => setOutboundCallerId(e.target.value)} className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">SIP Register Şifresi</label>
                                        <div className="flex gap-2">
                                            <input type="text" readOnly value={sipPassword} className="flex-1 text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none font-mono" />
                                            <button type="button" onClick={copySipPassword} className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors" title="Şifreyi Kopyala"><Copy size={16}/></button>
                                            <button type="button" onClick={generateSipPassword} className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors" title="Yeni Şifre Üret"><RefreshCw size={16}/></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: YÖNLENDİRME VE VOICEMAIL */}
                        {activeTab === "forwarding" && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-3">Çağrı Yönlendirme Kuralları</h4>
                                    <div className="space-y-3">
                                        {renderForwardingRow("Her Zaman", fwdAlwaysActive, setFwdAlwaysActive, fwdAlwaysType, setFwdAlwaysType, fwdAlwaysTarget, setFwdAlwaysTarget, null, null)}
                                        {renderForwardingRow("Meşgul Durumda", fwdBusyActive, setFwdBusyActive, fwdBusyType, setFwdBusyType, fwdBusyTarget, setFwdBusyTarget, null, null)}
                                        {renderForwardingRow("Zaman Aşımında (Cevapsız)", fwdNoAnswerActive, setFwdNoAnswerActive, fwdNoAnswerType, setFwdNoAnswerType, fwdNoAnswerTarget, setFwdNoAnswerTarget, fwdNoAnswerTimeout, setFwdNoAnswerTimeout)}
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">Sesli Mesaj (Voicemail)</h4>
                                        <button type="button" onClick={() => setVoicemailActive(!voicemailActive)} className="text-slate-400 hover:text-slate-700 transition-colors">
                                            {voicemailActive ? <ToggleRight size={28} className={`${text}`} /> : <ToggleLeft size={28} />}
                                        </button>
                                    </div>

                                    {voicemailActive && (
                                        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Voicemail Anonsu</label>
                                                <select value={voicemailAnnouncement} onChange={(e) => setVoicemailAnnouncement(e.target.value)} className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none">
                                                    {ANNOUNCEMENTS.map(a => <option key={a} value={a}>{a}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Voicemail Şifresi (Sadece 4 Rakam)</label>
                                                <input type="text" maxLength={4} pattern="\d{4}" placeholder="Örn: 1234" value={voicemailPin} onChange={(e) => setVoicemailPin(e.target.value.replace(/\D/g, ''))} className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none" />
                                            </div>
                                            <div className="col-span-2 flex items-center justify-between pt-2">
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Sesli mesajları e-posta ile gönder</span>
                                                <button type="button" onClick={() => setVoicemailToEmail(!voicemailToEmail)} className="text-slate-400 hover:text-slate-700 transition-colors">
                                                    {voicemailToEmail ? <ToggleRight size={24} className={`${text}`} /> : <ToggleLeft size={24} />}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 3: ÖZELLİKLER */}
                        {activeTab === "features" && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <div>
                                        <h5 className="text-sm font-bold text-slate-800 dark:text-white">Ses Kayıt</h5>
                                        <p className="text-[10px] text-slate-500 mt-0.5">Bu kullanıcının tüm görüşmeleri kaydedilsin mi?</p>
                                    </div>
                                    <button type="button" onClick={() => setRecordingActive(!recordingActive)} className="text-slate-400 hover:text-slate-700 transition-colors">
                                        {recordingActive ? <ToggleRight size={30} className={`${text}`} /> : <ToggleLeft size={30} />}
                                    </button>
                                </div>

                                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <label className="block text-xs font-bold text-slate-800 dark:text-white mb-2">Transport Protokolü</label>
                                    <p className="text-[10px] text-slate-500 mb-3">Kullanıcının SIP cihazı veya softphone'u için geçerli protokol.</p>
                                    <div className="flex gap-3">
                                        {["UDP", "TCP", "TLS"].map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setTransport(t)}
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${transport === t ? (lightBg + " " + border + " " + text) : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 4: AVATAR */}
                        {activeTab === "avatar" && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <label className="block text-sm font-bold text-slate-800 dark:text-white mb-4">Profil Avatarı Seçin</label>
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                                    {PRESET_AVATARS.map((av) => (
                                        <button
                                            key={av}
                                            type="button"
                                            onClick={() => setAvatar(av)}
                                            className={`aspect-square rounded-2xl border-2 transition-all p-2 bg-slate-50 dark:bg-slate-950 ${
                                            avatar === av
                                                ? (border + " shadow-md scale-105")
                                                : "border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                                            }`}
                                        >
                                            <img src={av} alt="Avatar" className="w-full h-full object-contain" />
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-8 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Seçili Görünüm</span>
                                    <div className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-800 shadow-lg bg-slate-100 dark:bg-slate-950 overflow-hidden">
                                        <img src={avatar} alt="Seçili Avatar" className="w-full h-full object-cover" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4 mt-auto border-t border-slate-100 dark:border-slate-800/60">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Vazgeç
                            </button>
                            <button
                                type="submit"
                                className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${bg} ${hover} text-white transition-all shadow-sm`}
                            >
                                Kaydet
                            </button>
                        </div>
                    </form>
                </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDeleteUser}
        title="Kullanıcıyı Sil"
        message="Seçilen sistem kullanıcısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
      />
    </div>
  );
}
