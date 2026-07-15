import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, X, User, Mail, Phone, Shield, Check, CheckCircle, ToggleLeft, ToggleRight, Search } from "lucide-react";
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

export default function UserSettings({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  
  // Delete confirmation
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Modal / Popup States
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [extension, setExtension] = useState("");
  const [avatar, setAvatar] = useState(PRESET_AVATARS[0]);
  const [role, setRole] = useState("agent"); // admin, agent, supervisor
  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState("");

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
      console.error("Kullanıcılar veya Roller yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async (updatedUsers) => {
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
      }
    } catch (err) {
      console.error("Kullanıcı ayarları kaydedilemedi:", err);
    }
  };

  const openAddModal = () => {
    setEditingUser(null);
    setFullName("");
    setEmail("");
    setExtension("");
    setAvatar(PRESET_AVATARS[0]);
    setRole("agent");
    setIsActive(true);
    setPassword("");
    setShowModal(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setFullName(u.full_name);
    setEmail(u.email);
    setExtension(u.extension);
    setAvatar(u.avatar);
    setRole(u.role);
    setIsActive(u.is_active);
    setPassword(u.password || "");
    setShowModal(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !extension.trim()) return;

    if (editingUser) {
      // Edit mode
      const updated = users.map((u) => {
        if (u.id === editingUser.id) {
          return {
            ...u,
            full_name: fullName.trim(),
            email: email.trim(),
            extension: extension.trim(),
            avatar,
            role,
            is_active: isActive,
            password
          };
        }
        return u;
      });
      setUsers(updated);
      handleSaveAll(updated);
    } else {
      // Add mode
      const newUser = {
        id: Date.now(),
        full_name: fullName.trim(),
        email: email.trim(),
        extension: extension.trim(),
        avatar,
        role,
        is_active: isActive,
        password
      };
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
      u.full_name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.extension.includes(query)
    );
  });

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
              className={`w-48 text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} dark:focus:ring-rose-400/25 transition-all`}
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-555" />
          </div>

          <button
            onClick={openAddModal}
            className={`p-2 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center h-8 w-8 shrink-0`}
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
              <div className="w-12 text-center shrink-0">Profil</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 items-center">
                <div className="pl-1">Kullanıcı Adı / Rol</div>
                <div className="pl-1">E-Posta Adresi</div>
                <div className="pl-1">Dahili Numarası</div>
              </div>
            </div>
            <div className="w-36 text-right pr-4 shrink-0">Durum / İşlem</div>
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
                <img
                  src={u.avatar}
                  alt={u.full_name}
                  className="w-12 h-12 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-1 shrink-0"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 items-center">
                  <div>
                    <h4 className="font-bold text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                      {u.full_name}
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
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${roleColor}`}>
                            {roleLabel}
                          </span>
                        );
                      })()}
                    </h4>
                  </div>
                  
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Mail size={12} className="text-slate-400 shrink-0" />
                    <span className="truncate">{u.email}</span>
                  </div>

                  <div className="text-[10px] text-slate-500 dark:text-slate-450 flex items-center gap-2">
                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-bold">
                      <Phone size={10} /> Dahili:
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-extrabold text-slate-700 dark:text-slate-300 text-[9px]">
                      {u.extension}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Side: Actions */}
              <div className="flex items-center gap-4 justify-between sm:justify-end border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-450 dark:text-slate-550 mr-1">
                    {u.is_active ? "Etkin" : "Devre Dışı"}
                  </span>
                  <button
                    onClick={() => toggleUserActive(u)}
                    className="text-slate-400 dark:text-slate-550 hover:text-slate-700 dark:hover:text-slate-350 transition-colors"
                    title={u.is_active ? "Kullanıcıyı Devre Dışı Bırak" : "Kullanıcıyı Etkinleştir"}
                  >
                    {u.is_active ? <ToggleRight size={22} className="text-primary" /> : <ToggleLeft size={22} />}
                  </button>
                </div>

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

      {/* POPUP MODAL (Add / Edit Form) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20">
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

            {/* Modal Body Form */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Full name */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">
                    İsim Soyisim
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Ahmet Yılmaz"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                {/* Email */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">
                    Mail Adresi
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="ahmet@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Extension */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">
                    Dahili Numarası
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: 202, 203"
                    value={extension}
                    onChange={(e) => setExtension(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                {/* Password */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">
                    Şifre (Login)
                  </label>
                  <input
                    type="password"
                    placeholder="Şifre belirleyin"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">
                  Kullanıcı Rolü
                </label>
                <div className="flex flex-wrap gap-2">
                  {systemRoles.map((r) => (
                    <button
                      key={r.role_code}
                      type="button"
                      onClick={() => setRole(r.role_code)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold uppercase transition-all border ${
                        role === r.role_code
                          ? "bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-450 border-rose-200 dark:border-rose-900/40"
                          : "bg-slate-50/50 dark:bg-slate-950/20 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-slate-800/80 hover:bg-slate-50"
                      }`}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Avatar Selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-1.5">
                  Profil Avatarı Seçin
                </label>
                <div className="flex items-center gap-3">
                  <div className="grid grid-cols-6 gap-2 flex-1">
                    {PRESET_AVATARS.map((av) => (
                      <button
                        key={av}
                        type="button"
                        onClick={() => setAvatar(av)}
                        className={`p-1.5 rounded-xl border bg-slate-50 dark:bg-slate-950 transition-all ${
                          avatar === av
                            ? "border-rose-500 dark:border-rose-400 scale-105"
                            : "border-transparent hover:scale-102"
                        }`}
                      >
                        <img src={av} alt="Avatar" className="w-8 h-8" />
                      </button>
                    ))}
                  </div>
                  <div className="w-12 h-12 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-1 flex items-center justify-center shrink-0">
                    <img src={avatar} alt="Seçili Avatar" className="w-10 h-10" />
                  </div>
                </div>
              </div>

              {/* Active Toggle Switch */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <h5 className="text-xs font-bold text-slate-700 dark:text-white">Kullanıcı Aktif mi?</h5>
                  <p className="text-[9px] text-slate-400">Aktif olmayan kullanıcılar sisteme giriş yapamaz.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className="text-slate-400 dark:text-slate-550 hover:text-slate-700 dark:hover:text-slate-350 transition-colors"
                >
                  {isActive ? <ToggleRight size={26} className={text} /> : <ToggleLeft size={26} />}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold border dark: dark: dark: hover: transition-all bg-slate-500 hover:bg-slate-600 text-white border-transparent"
                >Vazgeç</button>
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
