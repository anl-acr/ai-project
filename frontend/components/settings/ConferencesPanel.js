import React, { useState, useEffect } from "react";
import { Plus, Search, Trash2, Edit2, X, Users, Check, AlertCircle, Mic, AlertTriangle } from "lucide-react";

import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import TransferList from "../ui/TransferList";
import { useTheme } from "../../utils/theme";

export default function ConferencesPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [conferences, setConferences] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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
    setRecordingEnabled(item.recording_enabled || false);
    setShowModal(true);
  };


  const toggleInternal = (userId) => {
    setSelectedInternals(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const addExternal = (e) => {
    e.preventDefault();
    if (currentExternal.trim() && !externalNumbers.includes(currentExternal.trim())) {
      setExternalNumbers(prev => [...prev, currentExternal.trim()]);
      setCurrentExternal("");
    }
  };

  const removeExternal = (num) => {
    setExternalNumbers(prev => prev.filter(n => n !== num));
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
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Harici Numaralar (Dış Katılımcılar)</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Numara yazıp Ekle'ye basın"
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
                {externalNumbers.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    {externalNumbers.map((num, idx) => (
                      <div key={idx} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold ${lightBg} ${text} border ${borderLight}`}>
                        {num}
                        <button type="button" onClick={() => removeExternal(num)} className="hover:text-rose-500 transition-colors ml-1">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
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
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
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
