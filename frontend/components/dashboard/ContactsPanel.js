import React, { useState, useEffect } from "react";
import { Search, Plus, Edit2, Trash2, BookOpen, Save, X, Phone, Mail, CheckCircle } from "lucide-react";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

export default function ContactsPanel({ backendHost = "localhost:8000" }) {
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Role Permissions State
  const [hasWritePermission, setHasWritePermission] = useState(false);
  const [hasDeletePermission, setHasDeletePermission] = useState(false);

  // Form Modal States
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  
  // Fields State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Delete Modal State
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  // Fetch contacts
  const fetchContacts = async (q = "") => {
    setLoading(true);
    try {
      const url = q ? `${API_BASE}/api/contacts?q=${encodeURIComponent(q)}` : `${API_BASE}/api/contacts`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setContacts(data);
      }
    } catch (err) {
      console.error("[Contacts] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Check role permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        const resStatus = await fetch(`${protocol}//${backendHost}/api/agent/status`);
        const statusData = await resStatus.json();
        if (!statusData.is_logged_in) {
          // Default dev fallback
          setHasWritePermission(true);
          setHasDeletePermission(true);
          return;
        }

        const resUsers = await fetch(`${protocol}//${backendHost}/api/settings/users`);
        const usersData = await resUsers.json();
        const currentUser = usersData.find(u => u.id === statusData.user_id);
        if (!currentUser) {
          setHasWritePermission(true);
          setHasDeletePermission(true);
          return;
        }

        const resRoles = await fetch(`${protocol}//${backendHost}/api/settings/roles`);
        const rolesData = await resRoles.json();
        const currentRole = rolesData.find(r => r.role_code === currentUser.role);
        if (!currentRole) {
          setHasWritePermission(true);
          setHasDeletePermission(true);
          return;
        }

        setHasWritePermission(currentRole.permissions.includes("contacts:write"));
        setHasDeletePermission(currentRole.permissions.includes("contacts:delete"));
      } catch (err) {
        console.error("Contacts permission load error:", err);
        setHasWritePermission(true);
        setHasDeletePermission(true);
      }
    };

    checkPermissions();
    fetchContacts();
  }, [backendHost]);

  // Handle Search Input Change
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    fetchContacts(val);
  };

  // Open Create/Edit modal
  const openFormModal = (contact = null) => {
    if (contact) {
      setEditingContact(contact);
      setFirstName(contact.first_name);
      setLastName(contact.last_name);
      setPhone(contact.phone_number);
      setEmail(contact.email || "");
    } else {
      setEditingContact(null);
      setFirstName("");
      setLastName("");
      setPhone("");
      setEmail("");
    }
    setErrorMsg("");
    setShowFormModal(true);
  };

  // Close Form Modal
  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingContact(null);
  };

  // Submit create or edit form
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setErrorMsg("Ad, Soyad ve Telefon alanları zorunludur.");
      return;
    }

    const payload = {
      first_name: firstName,
      last_name: lastName,
      phone_number: phone,
      email: email.trim() || null
    };

    setLoading(true);
    setErrorMsg("");

    try {
      let res;
      if (editingContact) {
        res = await fetch(`${API_BASE}/api/contacts/${editingContact.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_BASE}/api/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setSuccessMsg(editingContact ? "Kişi bilgileri güncellendi." : "Yeni kişi rehbere eklendi.");
        setTimeout(() => setSuccessMsg(""), 3000);
        closeFormModal();
        fetchContacts(searchQuery);
      } else {
        const data = await res.json();
        setErrorMsg(data.detail || "İşlem başarısız oldu.");
      }
    } catch (err) {
      console.error("[Contacts] Save error:", err);
      setErrorMsg("Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  // Trigger contact deletion using custom modal
  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await fetch(`${API_BASE}/api/contacts/${deleteTargetId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setSuccessMsg("Kişi rehberden başarıyla silindi.");
        setTimeout(() => setSuccessMsg(""), 3000);
        fetchContacts(searchQuery);
      }
    } catch (err) {
      console.error("[Contacts] Delete error:", err);
    } finally {
      setDeleteTargetId(null);
    }
  };

  return (
    <div className="w-full max-w-6xl space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/85 dark:border-slate-800/80 pb-5 text-left">
        <div>
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
            <BookOpen size={22} className="text-blue-500" />
            Rehber (Contact Directory)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            İsim, soyisim, telefon numarası ve e-posta adreslerini merkezi olarak yönetin.
          </p>
        </div>

        {hasWritePermission && (
          <button
            onClick={() => openFormModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 transition"
          >
            <Plus size={14} />
            <span>Yeni Kişi Ekle</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-emerald-600 dark:text-emerald-450 text-xs font-semibold flex items-center gap-1.5 text-left">
          <CheckCircle size={14} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search & Actions Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-3 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="İsim, telefon veya e-postaya göre rehberde arayın..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-xl text-xs focus:outline-none focus:border-blue-500 dark:text-slate-200"
          />
        </div>
      </div>

      {/* Contacts List Grid/Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm transition-colors duration-300">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-850">
              <th className="p-4 text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">İsim Soyisim</th>
              <th className="p-4 text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Telefon Numarası</th>
              <th className="p-4 text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">E-posta</th>
              { (hasWritePermission || hasDeletePermission) && (
                <th className="p-4 text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider text-right">İşlemler</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
            {loading && contacts.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-xs text-slate-400 font-bold animate-pulse">Kişiler yükleniyor...</td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-xs text-slate-400 dark:text-slate-550 font-bold">Kayıt bulunamadı.</td>
              </tr>
            ) : (
              contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-850/20 transition">
                  <td className="p-4 text-xs font-bold text-slate-850 dark:text-slate-200">
                    {contact.first_name} {contact.last_name}
                  </td>
                  <td className="p-4 text-xs font-mono text-slate-550 dark:text-slate-400">
                    {contact.phone_number}
                  </td>
                  <td className="p-4 text-xs font-mono text-slate-550 dark:text-slate-400">
                    {contact.email || <span className="text-slate-300 dark:text-slate-700">-</span>}
                  </td>
                  { (hasWritePermission || hasDeletePermission) && (
                    <td className="p-4 text-right flex items-center justify-end gap-2.5">
                      {hasWritePermission && (
                        <button
                          onClick={() => openFormModal(contact)}
                          className="p-1.5 text-slate-450 hover:text-blue-600 dark:hover:text-blue-400 transition"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                      {hasDeletePermission && (
                        <button
                          onClick={() => setDeleteTargetId(contact.id)}
                          className="p-1.5 text-slate-450 hover:text-rose-600 dark:hover:text-rose-455 transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit / Create Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-slate-955/65 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-left">
            <div className="p-5 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
              <h3 className="text-xs font-extrabold text-slate-850 dark:text-white uppercase tracking-wider">
                {editingContact ? "Kişi Detaylarını Düzenle" : "Yeni Kişi Kaydı"}
              </h3>
              <button onClick={closeFormModal} className="p-1 text-slate-400 hover:text-slate-650 dark:hover:text-slate-250 transition">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Ad *</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Soyad *</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Telefon Numarası *</label>
                <div className="relative">
                  <Phone size={13} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="+905551112233"
                    className="pl-9 pr-3 py-2 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">E-posta</label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@posta.com"
                    className="pl-9 pr-3 py-2 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-850">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-slate-700 rounded-xl text-xs font-bold transition"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 transition"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Premium Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleDeleteConfirm}
        title="Kişiyi Rehberden Sil"
        message="Bu rehber kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
      />

    </div>
  );
}
