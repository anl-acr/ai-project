import React, { useState, useEffect } from "react";
import { Users, Plus, Trash2, Edit3, X, Check, AlertTriangle, Shield, Mail, User, Key, Lock } from "lucide-react";

export default function UserManagementModal({ isOpen, onClose, currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Form states
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [isActive, setIsActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Custom Delete Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://localhost:8050/api/v1/users");
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (e) {
      console.error("Fetch users error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setUsername("");
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("admin");
    setIsActive(true);
    setErrorMsg("");
    setShowFormModal(true);
  };

  const handleOpenEdit = (u) => {
    setEditingUser(u);
    setUsername(u.username);
    setFullName(u.full_name);
    setEmail(u.email);
    setPassword("");
    setRole(u.role || "admin");
    setIsActive(u.is_active);
    setErrorMsg("");
    setShowFormModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!username.trim() || !fullName.trim() || !email.trim()) {
      setErrorMsg("Lütfen zorunlu alanları doldurunuz.");
      return;
    }

    try {
      const url = editingUser 
        ? `http://localhost:8050/api/v1/users/${editingUser.id}`
        : `http://localhost:8050/api/v1/users`;
      const method = editingUser ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          full_name: fullName.trim(),
          email: email.trim(),
          password: password,
          role,
          is_active: isActive,
          performed_by: currentUser?.username || "admin"
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "İşlem başarısız.");
      }

      setShowFormModal(false);
      fetchUsers();
    } catch (err) {
      setErrorMsg(err.message || "Bir hata oluştu.");
    }
  };

  const confirmDelete = (u) => {
    setUserToDelete(u);
    setDeleteModalOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const res = await fetch(`http://localhost:8050/api/v1/users/${userToDelete.id}`, {
        method: "DELETE",
        headers: { "X-User-Name": currentUser?.username || "admin" }
      });
      if (res.ok) {
        setDeleteModalOpen(false);
        setUserToDelete(null);
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.detail || "Silme işlemi başarısız.");
      }
    } catch (e) {
      console.error("Delete user error:", e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600/20 border border-rose-500/30 text-rose-400 flex items-center justify-center font-extrabold">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                Merkezi Portal Kullanıcı Yönetimi
              </h3>
              <p className="text-xs font-semibold text-slate-400">Lisans merkezine erişebilecek kullanıcı ve yöneticiler</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Unified Add Button Rule */}
            <button
              onClick={handleOpenAdd}
              className="bg-rose-600 hover:bg-rose-500 rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all text-white shadow-md shadow-rose-600/20 cursor-pointer"
              title="Yeni Kullanıcı Ekle"
            >
              <Plus size={16} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body Users List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {users.map((u) => (
              <div 
                key={u.id}
                className="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl space-y-3 relative group hover:border-slate-700 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="font-extrabold text-sm text-white flex items-center gap-2">
                      <User size={15} className="text-slate-400" />
                      <span>{u.full_name}</span>
                    </div>
                    <div className="text-xs font-mono text-rose-400">@{u.username}</div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                    u.role === "admin" ? "bg-rose-500/20 text-rose-300 border-rose-500/30" : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                  }`}>
                    {u.role === "admin" ? "Sistem Yöneticisi" : "Operatör"}
                  </span>
                </div>

                <div className="text-xs text-slate-400 font-semibold space-y-1 border-t border-slate-800/60 pt-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail size={13} className="text-slate-500" />
                    <span className="truncate">{u.email}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Son Giriş: {u.last_login_at ? new Date(u.last_login_at).toLocaleString('tr-TR') : "Henüz Giriş Yapmadı"}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/40">
                  <button
                    onClick={() => handleOpenEdit(u)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Düzenle"
                  >
                    <Edit3 size={15} />
                  </button>

                  {u.username !== "admin" && (
                    <button
                      onClick={() => confirmDelete(u)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                      title="Sil"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ADD / EDIT USER FORM MODAL */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
              <User size={16} className="text-rose-500" />
              {editingUser ? "Kullanıcıyı Düzenle" : "Yeni Master Portal Kullanıcısı Ekle"}
            </h4>

            <form onSubmit={handleSaveUser} className="space-y-3.5 text-xs font-semibold">
              <div>
                <label className="block text-slate-400 mb-1">Ad Soyad</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Örn: Ahmet Yılmaz"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Kullanıcı Adı</label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingUser)}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Örn: ahmetyilmaz"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 font-mono text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">E-Posta Adresi</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Örn: ahmet@aidapanel.com"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">
                  {editingUser ? "Yeni Şifre (Boş bırakılırsa değişmez)" : "Şifre"}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Yetki / Rol</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:border-rose-500 text-white font-bold"
                >
                  <option value="admin">Yönetici (Tam Yetkili)</option>
                  <option value="operator">Operatör (Lisans Üretebilir)</option>
                </select>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-400 font-bold flex items-center gap-2">
                  <AlertTriangle size={15} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold shadow-lg shadow-rose-600/20"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL RULE COMPLIANCE */}
      {deleteModalOpen && userToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-center">
            
            {/* Soft Red Pulse Warning Icon */}
            <div className="relative mx-auto flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <span className="absolute inset-0 rounded-2xl bg-rose-500/20 animate-ping" />
              <AlertTriangle size={28} className="relative z-10" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-base font-extrabold text-white">Kullanıcıyı Sil?</h4>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                <span className="text-white font-bold">{userToDelete.full_name}</span> (@{userToDelete.username}) isimli kullanıcıyı silmek istediğinize emin misiniz?
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setUserToDelete(null);
                }}
                className="w-1/2 py-2.5 rounded-xl text-xs font-bold border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="w-1/2 py-2.5 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30 transition-all"
              >
                Sil
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
