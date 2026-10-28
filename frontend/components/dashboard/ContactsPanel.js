import React, { useState, useEffect, useRef } from "react";
import { Search, Plus, Edit2, Trash2, BookOpen, Save, X, Phone, Mail, CheckCircle, AlertTriangle, Download, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl } from "../../utils/apiHost";

export default function ContactsPanel({ backendHost }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => {
        setErrorMsg("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);


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

  const API_BASE = getApiBaseUrl(backendHost);

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
        const resStatus = await fetch(`${API_BASE}/api/agent/status`);
        const statusData = await resStatus.json();
        if (!statusData.is_logged_in) {
          // Default dev fallback
          setHasWritePermission(true);
          setHasDeletePermission(true);
          return;
        }

        const resUsers = await fetch(`${API_BASE}/api/settings/users`);
        const usersData = await resUsers.json();
        const currentUser = usersData.find(u => u.id === statusData.user_id);
        if (!currentUser) {
          setHasWritePermission(true);
          setHasDeletePermission(true);
          return;
        }

        const resRoles = await fetch(`${API_BASE}/api/settings/roles`);

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
    setErrorMsg("");
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setErrorMsg("Ad, Soyad ve Telefon alanları zorunludur.");
      return;
    }

    const phoneClean = phone.trim();

    // Client-side phone number duplicate check
    const dupPhoneContact = (contacts || []).find(
      c => String(c.phone_number || "").trim() === phoneClean && (!editingContact || String(c.id) !== String(editingContact.id))
    );
    if (dupPhoneContact) {
      const cName = `${dupPhoneContact.first_name || ""} ${dupPhoneContact.last_name || ""}`.trim() || "Kayıtlı Kişi";
      setErrorMsg(`Bu telefon numarasına (${phoneClean}) ait '${cName}' isimli bir kayıt zaten mevcut.`);
      return;
    }

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone_number: phoneClean,
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

  const handleExportExcel = () => {
    const data = contacts.map(c => ({
      "Ad": c.first_name || "",
      "Soyad": c.last_name || "",
      "Telefon Numarası": c.phone_number || "",
      "E-posta": c.email || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rehber");
    XLSX.writeFile(workbook, "Rehber.xlsx");
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      setLoading(true);
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        for (const row of data) {
          let first_name = String(row["Ad"] || row["İsim"] || "").trim();
          let last_name = String(row["Soyad"] || row["Soyisim"] || "").trim();
          const fullName = String(row["Ad Soyad"] || row["İsim Soyisim"] || "").trim();
          if (!first_name && fullName) {
            const parts = fullName.split(" ");
            first_name = parts[0] || "";
            last_name = parts.slice(1).join(" ") || "-";
          }
          if (first_name && !last_name) last_name = "-";
          const phone_number = String(row["Telefon Numarası"] || row["Telefon"] || "").trim();
          const email = String(row["E-posta"] || row["Email"] || "").trim() || null;

          if (!first_name || !phone_number) continue;

          const existing = contacts.find(c => String(c.phone_number || "").trim() === phone_number);
          const payload = { first_name, last_name, phone_number, email };

          if (existing) {
            await fetch(`${API_BASE}/api/contacts/${existing.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
          } else {
            await fetch(`${API_BASE}/api/contacts`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
          }
        }

        setSuccessMsg("Rehber kayıtları başarıyla içe aktarıldı.");
        setTimeout(() => setSuccessMsg(""), 3000);
        await fetchContacts(searchQuery);
      } catch (err) {
        console.error("[Contacts] Excel import error:", err);
        setErrorMsg("Excel dosyası okunurken bir hata oluştu.");
      } finally {
        setLoading(false);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      {/* Standalone Header Card */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${lightBg} ${text} rounded-xl`}>
            <BookOpen size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">Rehber (Contact Directory)</h3>
            <p className="text-[10px] text-slate-505 dark:text-slate-400 mt-0.5 font-medium">
              İsim, soyisim, telefon numarası ve e-posta adreslerini merkezi olarak yönetin.
            </p>
          </div>
        </div>

        {/* Search Bar + "+" Icon Wrapper */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Rehberde arayın..."
              className={`w-56 text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} dark:focus:ring-rose-400/25 transition-all`}
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-555" />
          </div>

          <input 
            type="file" 
            accept=".xlsx, .xls" 
            ref={fileInputRef}
            className="hidden" 
            onChange={handleImportExcel}
          />

          {hasWritePermission && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50"
              title="Excel'den İçe Aktar (Import)"
            >
              <Upload size={16} />
            </button>
          )}

          <button
            onClick={handleExportExcel}
            className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 border border-transparent hover:border-blue-200 dark:hover:border-blue-800/50"
            title="Excel'e Dışa Aktar (Export)"
          >
            <Download size={16} />
          </button>

          {hasWritePermission && (
            <button
              onClick={() => openFormModal()}
              className={`p-2 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center h-8 w-8 shrink-0`}
              title="Yeni Kişi Ekle"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-primary dark:text-emerald-450 text-xs font-semibold flex items-center gap-1.5 text-left">
          <CheckCircle size={14} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Contacts List Grid/Table Card */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300">
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
                          className="p-1.5 text-slate-450 hover:text-primary dark:hover:text-blue-400 transition"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                      {hasDeletePermission && (
                        <button
                          onClick={() => setDeleteTargetId(contact.id)}
                          className="p-1.5 text-slate-450 hover:text-primary dark:hover:text-rose-455 transition"
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
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorMsg("")}
                    className="p-1 text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 transition-colors rounded-lg shrink-0"
                    title="Kapat"
                  >
                    <X size={14} />
                  </button>
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
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm shadow-rose-500/20 transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 ${bg} ${hover} text-white rounded-xl text-xs font-bold shadow-md transition`}
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
