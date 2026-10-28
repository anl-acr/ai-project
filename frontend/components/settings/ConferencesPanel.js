import React, { useState, useEffect, useRef } from "react";
import { Plus, Search, Trash2, Edit2, X, Users, Check, AlertCircle, Mic, AlertTriangle, Download, Upload, BookOpen, Phone, ChevronDown } from "lucide-react";
import * as XLSX from "xlsx";

import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import TransferList from "../ui/TransferList";
import { useTheme } from "../../utils/theme";

export default function ConferencesPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [conferences, setConferences] = useState([]);
  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef(null);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Form Fields
  const [editingId, setEditingId] = useState(null);
  const [roomNumber, setRoomNumber] = useState("");
  const [roomName, setRoomName] = useState("");
  const [selectedInternals, setSelectedInternals] = useState([]);
  const [externalNumbers, setExternalNumbers] = useState([]);
  const [currentExternal, setCurrentExternal] = useState("");
  const [recordingEnabled, setRecordingEnabled] = useState(false);

  // Role permissions
  const [permissions, setPermissions] = useState({ write: false, delete: false });

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    fetchPermissions();
    fetchData();
  }, [backendHost]);


  const fetchPermissions = async () => {
    try {
      const resStatus = await fetch(`${API_BASE}/api/agent/status`);
      const statusData = await resStatus.json();
      if (!statusData.is_logged_in) {
        setPermissions({ write: true, delete: true });
        return;
      }
      const resUsers = await fetch(`${API_BASE}/api/settings/users`);
      const usersData = await resUsers.json();
      setUsers(usersData); // Store users for the multi-select
      
      const currentUser = usersData.find(u => u.id === statusData.user_id);
      if (!currentUser) {
        setPermissions({ write: true, delete: true });
        return;
      }
      const resRoles = await fetch(`${API_BASE}/api/settings/roles`);
      const rolesData = await resRoles.json();
      const currentRole = rolesData.find(r => r.role_code === currentUser.role);
      if (!currentRole) {
        setPermissions({ write: true, delete: true });
        return;
      }
      setPermissions({
        write: currentRole.permissions.includes("conferences:write"),
        delete: currentRole.permissions.includes("conferences:delete")
      });
    } catch (err) {
      console.error("Conferences permissions load error:", err);
      setPermissions({ write: true, delete: true });
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/settings/conferences`);
      if (res.ok) {
        const data = await res.json();
        setConferences(data);
      } else {
        setError("Konferans odaları yüklenemedi.");
      }
      
      // Fetch users again just in case fetchPermissions wasn't called (e.g. if we refresh)
      const resUsers = await fetch(`${API_BASE}/api/settings/users`);
      if (resUsers.ok) {
        const uData = await resUsers.json();
        setUsers(uData);
      }

      // Fetch contacts from directory for external participant selection
      try {
        const resContacts = await fetch(`${API_BASE}/api/contacts`);
        if (resContacts.ok) {
          const cData = await resContacts.json();
          setContacts(Array.isArray(cData) ? cData : []);
        }
      } catch (cErr) {
        console.error("Contacts load error in ConferencesPanel:", cErr);
      }
    } catch (err) {
      setError("Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!roomNumber.trim() || !roomName.trim()) {
      setError("Lütfen Oda Numarası ve Oda Adı alanlarını doldurunuz.");
      return;
    }

    const roomNum = roomNumber.trim();

    // Client-side duplicate check for conference room_number / extension
    const dupConf = (conferences || []).find(
      c => String(c.room_number || c.extension || c.number || "").trim() === roomNum && (!editingId || String(c.id) !== String(editingId))
    );
    if (dupConf) {
      setError(`Bu Konferans Oda Numarası (${roomNum}) zaten '${dupConf.room_name || dupConf.name || 'Konferans Odası'}' tarafından kullanılıyor.`);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/settings/conferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          room_number: roomNum,
          room_name: roomName.trim(),
          internals: selectedInternals,
          externals: externalNumbers,
          recording_enabled: recordingEnabled
        })
      });
      if (res.ok) {
        setSuccess("Konferans odası başarıyla kaydedildi.");
        setShowModal(false);
        fetchData();
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.detail || "Kaydetme hatası oluştu.");
      }
    } catch (err) {
      setError("Bağlantı hatası oluştu.");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/api/settings/conferences/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setSuccess("Kayıt başarıyla silindi.");
        setDeleteTarget(null);
        fetchData();
      } else {
        setError("Silme işlemi başarısız oldu.");
      }
    } catch (err) {
      setError("Bağlantı hatası oluştu.");
    }
  };

  const openAddModal = () => {
    setError("");
    setEditingId(null);
    setRoomNumber("");
    setRoomName("");
    setSelectedInternals([]);
    setExternalNumbers([]);
    setCurrentExternal("");
    setShowContactPicker(false);
    setContactSearchQuery("");
    setRecordingEnabled(false);
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setError("");
    setEditingId(item.id);
    setRoomNumber(item.room_number || "");
    setRoomName(item.room_name || "");
    setSelectedInternals(item.internals || []);
    setExternalNumbers(item.externals || []);
    setCurrentExternal("");
    setShowContactPicker(false);
    setContactSearchQuery("");
    setRecordingEnabled(item.recording_enabled || false);
    setShowModal(true);
  };


  const toggleInternal = (userId) => {
    setSelectedInternals(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const normalizeDigits = (val) => String(val || "").replace(/\D/g, "");

  const isSamePhone = (a, b) => {
    const dA = normalizeDigits(a);
    const dB = normalizeDigits(b);
    if (!dA || !dB) return false;
    if (dA === dB) return true;
    if (dA.length >= 10 && dB.length >= 10 && dA.slice(-10) === dB.slice(-10)) return true;
    return false;
  };

  const getContactNameForNumber = (num) => {
    if (!num || !contacts || contacts.length === 0) return null;
    const matched = contacts.find(c => c.phone_number && isSamePhone(c.phone_number, num));
    if (!matched) return null;
    return `${matched.first_name || ""} ${matched.last_name || ""}`.trim() || null;
  };

  const isContactSelected = (phoneStr) => {
    const clean = normalizeDigits(phoneStr);
    if (!clean) return false;
    return externalNumbers.some(n => isSamePhone(n, clean));
  };

  const toggleContactExternal = (phoneStr) => {
    const clean = normalizeDigits(phoneStr);
    if (!clean) return;
    setExternalNumbers(prev => {
      const exists = prev.some(n => isSamePhone(n, clean));
      if (exists) {
        return prev.filter(n => !isSamePhone(n, clean));
      }
      return [...prev, clean];
    });
  };

  const addExternal = (e) => {
    e.preventDefault();
    const clean = normalizeDigits(currentExternal);
    if (clean && !externalNumbers.some(n => isSamePhone(n, clean))) {
      setExternalNumbers(prev => [...prev, clean]);
      setCurrentExternal("");
    }
  };

  const removeExternal = (num) => {
    setExternalNumbers(prev => prev.filter(n => n !== num));
  };

  const handleExportExcel = () => {
    const data = conferences.map(item => {
      const internalNames = (item.internals || []).map(uid => {
        const u = users.find(x => x.id === uid || x.extension === uid);
        return u ? `${u.full_name} (${u.extension})` : uid;
      }).join(", ");
      return {
        "Oda No": item.room_number || "",
        "Oda Adı": item.room_name || "",
        "Dahili Katılımcılar": internalNames,
        "Harici Numaralar": (item.externals || []).join(", "),
        "Ses Kaydı": item.recording_enabled ? "Evet" : "Hayır"
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "KonferansOdalari");
    XLSX.writeFile(workbook, "Konferans_Odalari.xlsx");
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      setLoading(true);
      setError("");
      setSuccess("");
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        for (const row of data) {
          const room_number = String(row["Oda No"] || row["Oda Numarası"] || "").trim();
          const room_name = String(row["Oda Adı"] || "").trim();
          if (!room_number || !room_name) continue;

          const internalsRaw = String(row["Dahili Katılımcılar"] || "").split(",").map(s => s.trim()).filter(Boolean);
          const internals = internalsRaw.map(mName => {
            const u = users.find(x =>
              (x.full_name && x.full_name.toLowerCase() === mName.toLowerCase()) ||
              (`${x.full_name} (${x.extension})`).toLowerCase() === mName.toLowerCase() ||
              String(x.extension) === mName ||
              String(x.id) === mName
            );
            return u ? u.id : null;
          }).filter(Boolean);

          const externals = String(row["Harici Numaralar"] || "").split(",").map(s => s.trim()).filter(Boolean);
          const recording_enabled = String(row["Ses Kaydı"] || "").trim().toLowerCase() === "evet";

          const existing = conferences.find(c => String(c.room_number || "") === room_number);

          await fetch(`${API_BASE}/api/settings/conferences`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: existing ? existing.id : null,
              room_number,
              room_name,
              internals,
              externals,
              recording_enabled
            })
          });
        }

        setSuccess("Konferans odaları başarıyla içe aktarıldı.");
        await fetchData();
      } catch (err) {
        console.error("Excel import error:", err);
        setError("Excel dosyası okunurken bir hata oluştu.");
      } finally {
        setLoading(false);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsBinaryString(file);
  };

  // Filter items
  const filteredList = conferences.filter(item =>
    (item.room_number && item.room_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.room_name && item.room_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="w-full space-y-6 transition-all duration-300">
      {/* Title & Actions Header Card */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${lightBg} ${text} rounded-xl`}>
            <Users size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">KONFERANS ODALARI</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Sanal toplantı ve çoklu görüşme konferans odalarının tanımlanması ve katılımcı yönetimi.
            </p>
          </div>
        </div>

        {/* Search + Plus */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <input
              type="text"
              placeholder="Oda Ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-48 text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
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

          {permissions.write && (
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

          {permissions.write && (
            <button
              onClick={openAddModal}
              className={`p-2 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center h-8 w-8 shrink-0`}
              title="Yeni Konferans Odası Ekle"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className={`p-3.5 ${lightBg} border ${borderLight} ${text} rounded-xl text-xs flex items-center gap-2.5`}>
          <AlertCircle size={15} />
          <span className="font-semibold">{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-450 rounded-xl text-xs flex items-center gap-2.5">
          <Check size={15} />
          <span className="font-semibold">{success}</span>
        </div>
      )}

      {/* Main List Rendering */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500 font-bold">Veriler yükleniyor...</div>
      ) : (
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-950/40 text-[10px] text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100 dark:border-slate-850">
                <th className="px-4 py-3">Oda No</th>
                <th className="px-4 py-3">Oda Adı</th>
                <th className="px-4 py-3">Katılımcılar</th>
                <th className="px-4 py-3">Kayıt</th>
                {(permissions.write || permissions.delete) && <th className="px-4 py-3 text-right">İşlem</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-xs">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-bold">
                    Konferans odası bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-950/10">
                    <td className="px-4 py-3.5 font-bold text-slate-700 dark:text-slate-200">
                      {item.room_number}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700 dark:text-slate-300">
                      {item.room_name}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px]">Dahili: {(item.internals || []).length} kişi</span>
                        <span className="text-[10px]">Harici: {(item.externals || []).length} numara</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                      {item.recording_enabled ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-md">
                          <Mic size={12} /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          Kapalı
                        </span>
                      )}
                    </td>
                    {(permissions.write || permissions.delete) && (
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {permissions.write && (
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                              title="Düzenle"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                          {permissions.delete && (
                            <button
                              onClick={() => setDeleteTarget(item)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                              title="Sil"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">
                {editingId ? "KONFERANS ODASI DÜZENLE" : "YENİ KONFERANS ODASI"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            {error && (
              <div className="mx-4 mt-3 p-3 bg-rose-50 dark:bg-rose-950/15 border border-rose-200/50 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-between animate-in fade-in duration-200 shrink-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setError("")}
                  className="p-1 text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 transition-colors rounded-lg shrink-0"
                  title="Kapat"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            
            <div className="p-4 overflow-y-auto space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Oda Numarası</label>
                  <input
                    type="text"
                    placeholder="Örn: 900"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value.replace(/\D/g, ''))}
                    className={`w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Oda Adı</label>
                  <input
                    type="text"
                    placeholder="Örn: Yönetim Kurulu"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className={`w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Eklenecek Dahili Numaralar (Aboneler)
                </label>
                <div className="mt-2">
                  <TransferList 
                    items={users} 
                    selectedIds={selectedInternals} 
                    onChange={setSelectedInternals} 
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Harici Numaralar (Dış Katılımcılar)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowContactPicker(prev => {
                        const next = !prev;
                        if (!next) setContactSearchQuery("");
                        return next;
                      });
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                      showContactPicker
                        ? `${lightBg} ${text} ${borderLight}`
                        : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Search size={13} />
                    <span>Rehberde Ara</span>
                    <ChevronDown size={13} className={`transition-transform duration-200 ${showContactPicker ? "rotate-180" : ""}`} />
                  </button>
                </div>

                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Harici telefon numarası yazıp Ekle'ye basın..."
                    value={currentExternal}
                    onChange={(e) => setCurrentExternal(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExternal(e); } }}
                    className={`flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
                  />
                  <button
                    type="button"
                    onClick={addExternal}
                    className={`px-4 py-2 rounded-xl text-xs font-bold text-white ${bg} ${hover} transition-all`}
                  >
                    Ekle
                  </button>
                </div>

                {/* Search-on-type Directory Contact Picker */}
                {showContactPicker && (
                  <div className="mb-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Rehberde kişi adı, soyadı veya numara yazın..."
                          value={contactSearchQuery}
                          onChange={(e) => setContactSearchQuery(e.target.value)}
                          className={`w-full text-xs pl-8 pr-8 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
                        />
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        {contactSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setContactSearchQuery("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            title="Aramayı Temizle"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowContactPicker(false);
                          setContactSearchQuery("");
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
                        title="Arama Alanını Kapat"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {(() => {
                      const q = contactSearchQuery.trim().toLocaleLowerCase("tr-TR");
                      if (!q) {
                        return (
                          <div className="py-2.5 px-3 text-center text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                            Rehberden kişi seçmek için yukarıdaki alana isim, harf veya telefon numarası yazın.
                          </div>
                        );
                      }

                      const qDigits = normalizeDigits(q);
                      const validContacts = (contacts || []).filter(c => c.phone_number && normalizeDigits(c.phone_number));
                      const matchedContacts = validContacts.filter(c => {
                        const fullName = `${c.first_name || ""} ${c.last_name || ""}`.toLocaleLowerCase("tr-TR");
                        const phoneStr = String(c.phone_number || "").toLowerCase();
                        const phoneDigits = normalizeDigits(c.phone_number);
                        const emailStr = String(c.email || "").toLocaleLowerCase("tr-TR");
                        return (
                          fullName.includes(q) ||
                          phoneStr.includes(q) ||
                          (qDigits && phoneDigits.includes(qDigits)) ||
                          emailStr.includes(q)
                        );
                      });

                      if (matchedContacts.length === 0) {
                        return (
                          <div className="py-3 text-center text-xs text-slate-400 font-medium">
                            "{contactSearchQuery}" ile eşleşen rehber kaydı bulunamadı.
                          </div>
                        );
                      }

                      const visibleMatches = matchedContacts.slice(0, 30);

                      return (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between px-1 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                            <span>Eşleşen Kişiler ({matchedContacts.length})</span>
                            {matchedContacts.length > 30 && (
                              <span>İlk 30 sonuç gösteriliyor</span>
                            )}
                          </div>
                          <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
                            {visibleMatches.map((c) => {
                              const fullName = `${c.first_name || ""} ${c.last_name || ""}`.trim() || "İsimsiz Kişi";
                              const selected = isContactSelected(c.phone_number);
                              return (
                                <button
                                  key={c.id || c.phone_number}
                                  type="button"
                                  onClick={() => toggleContactExternal(c.phone_number)}
                                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-all border ${
                                    selected
                                      ? `${lightBg} ${text} ${borderLight} font-bold shadow-xs`
                                      : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                  }`}
                                >
                                  <div className="min-w-0 pr-2">
                                    <div className="font-bold truncate">{fullName}</div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                      <Phone size={10} />
                                      <span className="font-mono">{c.phone_number}</span>
                                    </div>
                                  </div>
                                  <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all ${
                                    selected
                                      ? `${bg} text-white`
                                      : "border border-slate-300 dark:border-slate-700 text-transparent"
                                  }`}>
                                    <Check size={12} />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {externalNumbers.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    {externalNumbers.map((num, idx) => {
                      const cName = getContactNameForNumber(num);
                      return (
                        <div key={idx} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold ${lightBg} ${text} border ${borderLight}`}>
                          {cName ? (
                            <span>{cName} <span className="opacity-75 font-mono">({num})</span></span>
                          ) : (
                            <span className="font-mono">{num}</span>
                          )}
                          <button type="button" onClick={() => removeExternal(num)} className="hover:text-rose-500 transition-colors ml-1" title="Kaldır">
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Ses Kaydı</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-450 mt-0.5">Konferans görüşmesi kayıt altına alınsın mı?</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={recordingEnabled}
                    onChange={(e) => setRecordingEnabled(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-rose-500"></div>
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-500/20 transition-all cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleSave}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white ${bg} ${hover} transition-all shadow-sm`}
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title="Silme Onayı"
        message={deleteTarget ? `"${deleteTarget.room_name}" konferans odasını silmek istediğinize emin misiniz?` : ""}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
