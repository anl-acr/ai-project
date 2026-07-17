import React, { useState, useEffect } from "react";
import { Plus, Search, Trash2, Edit2, X, PhoneCall, Check, AlertCircle } from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

export default function SpeedDialsPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [speedDials, setSpeedDials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Form Fields
  const [editingId, setEditingId] = useState(null);
  const [shortCode, setShortCode] = useState("");
  const [longNumber, setLongNumber] = useState("");
  const [description, setDescription] = useState("");

  // Role permissions
  const [permissions, setPermissions] = useState({ write: false, delete: false });

  const API_BASE = `${window.location.protocol}//${backendHost}`;

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
        write: currentRole.permissions.includes("speed_dials:write"),
        delete: currentRole.permissions.includes("speed_dials:delete")
      });
    } catch (err) {
      console.error("Speed dials permissions load error:", err);
      setPermissions({ write: true, delete: true });
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/settings/speed_dials`);
      if (res.ok) {
        const data = await res.json();
        setSpeedDials(data);
      } else {
        setError("Hızlı arama verileri yüklenemedi.");
      }
    } catch (err) {
      setError("Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!shortCode.trim() || !longNumber.trim()) {
      setError("Kısa kod ve uzun numara alanları zorunludur.");
      return;
    }
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/api/settings/speed_dials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          short_code: shortCode.trim(),
          long_number: longNumber.trim(),
          description: description.trim()
        })
      });
      if (res.ok) {
        setSuccess("Hızlı arama kaydı başarıyla kaydedildi.");
        setShowModal(false);
        fetchData();
      } else {
        const errData = await res.json();
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
      const res = await fetch(`${API_BASE}/api/settings/speed_dials/${deleteTarget.id}`, { method: "DELETE" });
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
    setEditingId(null);
    setShortCode("");
    setLongNumber("");
    setDescription("");
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setShortCode(item.short_code || "");
    setLongNumber(item.long_number || "");
    setDescription(item.description || "");
    setShowModal(true);
  };

  // Filter items
  const filteredList = speedDials.filter(item =>
    (item.short_code && item.short_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.long_number && item.long_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="w-full space-y-6 transition-all duration-300">
      {/* Title & Actions Header Card */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${lightBg} ${text} rounded-xl`}>
            <PhoneCall size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">HIZLI ARAMA (SPEED DIAL)</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Sistem genelinde kullanılacak kısa kod ve uzun numara eşleştirmelerini yapılandırın.
            </p>
          </div>
        </div>

        {/* Search + Plus */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <input
              type="text"
              placeholder="Ara..."
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
              title="Yeni Hızlı Arama Ekle"
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
                <th className="px-4 py-3">Kısa Kod</th>
                <th className="px-4 py-3">Uzun Numara</th>
                <th className="px-4 py-3">Açıklama</th>
                {(permissions.write || permissions.delete) && <th className="px-4 py-3 text-right">İşlem</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-xs">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400 font-bold">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-950/10">
                    <td className="px-4 py-3.5 font-bold text-slate-700 dark:text-slate-200">
                      {item.short_code}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-600 dark:text-slate-300">
                      {item.long_number}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                      {item.description || "-"}
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
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">
                {editingId ? "HIZLI ARAMA DÜZENLE" : "YENİ HIZLI ARAMA"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Kısa Kod</label>
                <input
                  type="text"
                  placeholder="Örn: 100"
                  value={shortCode}
                  onChange={(e) => setShortCode(e.target.value.replace(/\D/g, ''))} // Numeric only
                  required
                  className={`w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
                />
                <p className="text-[10px] text-slate-400 mt-1">Sadece rakam giriniz.</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Uzun Numara</label>
                <input
                  type="text"
                  placeholder="Örn: 05321234567"
                  value={longNumber}
                  onChange={(e) => setLongNumber(e.target.value)}
                  required
                  className={`w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Açıklama</label>
                <input
                  type="text"
                  placeholder="Örn: Ahmet Bey Cep"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2 rounded-xl text-xs font-bold text-white ${bg} ${hover} transition-all shadow-sm`}
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title="Silme Onayı"
        message={deleteTarget ? `${deleteTarget.short_code} kısa kodlu Hızlı Arama kaydını silmek istediğinize emin misiniz?` : ""}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
