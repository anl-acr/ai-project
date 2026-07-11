import React, { useState, useEffect } from "react";
import { Shield, Plus, Trash2, Search, X, Check, AlertCircle, AlertTriangle, FileText, Type } from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";

export default function BlacklistSettings({ backendHost = "localhost:8000" }) {
  const [activeTab, setActiveTab] = useState("list"); // list, words
  const [blacklist, setBlacklist] = useState([]);
  const [blockWords, setBlockWords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddWordModal, setShowAddWordModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, type: 'blacklist' | 'word', value }

  // Form Fields
  const [formType, setFormType] = useState("phone"); // phone, email
  const [formValue, setFormValue] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formWord, setFormWord] = useState("");

  // Role permissions
  const [permissions, setPermissions] = useState({ write: false, delete: false });

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    fetchPermissions();
    fetchData();
  }, [backendHost, activeTab]);

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
        write: currentRole.permissions.includes("blacklist:write"),
        delete: currentRole.permissions.includes("blacklist:delete")
      });
    } catch (err) {
      console.error("Blacklist permissions load error:", err);
      setPermissions({ write: true, delete: true });
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      if (activeTab === "list") {
        const res = await fetch(`${API_BASE}/api/blacklist`);
        if (res.ok) {
          const data = await res.json();
          setBlacklist(data);
        } else {
          setError("Kara liste verileri yüklenemedi.");
        }
      } else {
        const res = await fetch(`${API_BASE}/api/block-words`);
        if (res.ok) {
          const data = await res.json();
          setBlockWords(data);
        } else {
          setError("Yasaklı kelime listesi yüklenemedi.");
        }
      }
    } catch (err) {
      setError("Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddBlacklist = async (e) => {
    e.preventDefault();
    if (!formValue.trim()) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/api/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formType,
          value: formValue.trim(),
          reason: formReason.trim() || "Manuel Engelleme"
        })
      });
      if (res.ok) {
        setSuccess("Kayıt başarıyla kara listeye eklendi.");
        setFormValue("");
        setFormReason("");
        setShowAddModal(false);
        fetchData();
      } else {
        const errData = await res.json();
        setError(errData.detail || "Ekleme hatası oluştu.");
      }
    } catch (err) {
      setError("Bağlantı hatası oluştu.");
    }
  };

  const handleAddWord = async (e) => {
    e.preventDefault();
    if (!formWord.trim()) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/api/block-words`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: formWord.trim() })
      });
      if (res.ok) {
        setSuccess("Yasaklı kelime/cümle başarıyla eklendi.");
        setFormWord("");
        setShowAddWordModal(false);
        fetchData();
      } else {
        const errData = await res.json();
        setError(errData.detail || "Ekleme hatası oluştu.");
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
      const url = deleteTarget.type === "blacklist"
        ? `${API_BASE}/api/blacklist/${deleteTarget.id}`
        : `${API_BASE}/api/block-words/${deleteTarget.id}`;

      const res = await fetch(url, { method: "DELETE" });
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

  // Filter items
  const filteredList = blacklist.filter(item =>
    item.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.reason && item.reason.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredWords = blockWords.filter(item =>
    item.word.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-md p-6 space-y-6 transition-all duration-300">
      {/* Title & Tabs Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">
              Kara Liste ve Suistimal Koruması
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Telefon, e-posta veya yazılı sohbetlerdeki suistimal teşebbüslerini engelleyin.
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl shrink-0">
          <button
            onClick={() => { setActiveTab("list"); setSearchQuery(""); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "list"
                ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Engellenen Kişiler
          </button>
          <button
            onClick={() => { setActiveTab("words"); setSearchQuery(""); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "words"
                ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Yasaklı Kelimeler
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-450 rounded-xl text-xs flex items-center gap-2.5">
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

      {/* Action Controls & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="w-full sm:max-w-xs relative">
          <Search className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-550 font-semibold" size={14} />
          <input
            type="text"
            placeholder={activeTab === "list" ? "Numara veya e-posta ara..." : "Kelime veya cümle ara..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-rose-500 dark:text-white font-medium"
          />
        </div>

        {/* Add Action Buttons */}
        {permissions.write && (
          <button
            onClick={() => activeTab === "list" ? setShowAddModal(true) : setShowAddWordModal(true)}
            className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
          >
            <Plus size={14} />
            {activeTab === "list" ? "Kişi Engelle" : "Yasaklı Kelime Ekle"}
          </button>
        )}
      </div>

      {/* Main List Rendering */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500 font-bold">Veriler yükleniyor...</div>
      ) : activeTab === "list" ? (
        /* Blacklist Table */
        <div className="border border-slate-100 dark:border-slate-850 rounded-xl overflow-hidden">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-950/40 text-[10px] text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100 dark:border-slate-850">
                <th className="px-4 py-3">Tür</th>
                <th className="px-4 py-3">Engellenen Değer</th>
                <th className="px-4 py-3">Engelleme Nedeni</th>
                <th className="px-4 py-3">Tarih</th>
                {permissions.delete && <th className="px-4 py-3 text-right">İşlem</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-xs">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-bold">
                    Kara listede kayıtlı numara veya e-posta bulunmuyor.
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-950/10">
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.type === "phone"
                          ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600"
                          : "bg-purple-50 dark:bg-purple-950/30 text-purple-600"
                      }`}>
                        {item.type === "phone" ? "Telefon" : "E-posta"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                      {item.value}
                    </td>
                    <td className="px-4 py-3.5 text-slate-550 dark:text-slate-400 font-medium">
                      {item.reason}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 dark:text-slate-550 font-bold">
                      {new Date(item.timestamp).toLocaleString()}
                    </td>
                    {permissions.delete && (
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => setDeleteTarget({ id: item.id, type: "blacklist", value: item.value })}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-600 rounded-lg transition"
                          title="Engeli Kaldır"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Block Words Table */
        <div className="border border-slate-100 dark:border-slate-850 rounded-xl overflow-hidden">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-950/40 text-[10px] text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100 dark:border-slate-850">
                <th className="px-4 py-3">Yasaklı Kelime / Cümle</th>
                <th className="px-4 py-3">Eklenme Tarihi</th>
                {permissions.delete && <th className="px-4 py-3 text-right">İşlem</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-xs">
              {filteredWords.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-400 font-bold">
                    Tanımlanmış yasaklı kelime bulunmuyor.
                  </td>
                </tr>
              ) : (
                filteredWords.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-950/10">
                    <td className="px-4 py-3.5 font-bold text-slate-850 dark:text-slate-200">
                      "{item.word}"
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 dark:text-slate-550 font-bold">
                      {new Date(item.timestamp).toLocaleString()}
                    </td>
                    {permissions.delete && (
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => setDeleteTarget({ id: item.id, type: "word", value: `"${item.word}"` })}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-600 rounded-lg transition"
                          title="Yasaklı Kelimeyi Sil"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Blacklist Person Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Shield size={16} className="text-rose-500" />
                Yeni Kişi Engelle
              </h4>
              <button
                onClick={() => { setShowAddModal(false); setFormValue(""); setFormReason(""); }}
                className="text-slate-400 hover:text-slate-655 dark:hover:text-slate-250 transition"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddBlacklist} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Engel Türü</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-rose-500 dark:text-white"
                >
                  <option value="phone">Telefon Numarası</option>
                  <option value="email">E-posta Adresi</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {formType === "phone" ? "Telefon Numarası" : "E-posta Adresi"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={formType === "phone" ? "+905554443322" : "ornek@domain.com"}
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-rose-500 dark:text-white font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Engelleme Nedeni</label>
                <input
                  type="text"
                  placeholder="Küfür ve hakaret, dolandırıcılık teşebbüsü vb."
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-rose-500 dark:text-white font-medium"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setFormValue(""); setFormReason(""); }}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-xs font-bold text-slate-655 dark:text-slate-300 transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition"
                >
                  Engelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Block Word Modal */}
      {showAddWordModal && (
        <div className="fixed inset-0 bg-slate-955/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Type size={16} className="text-rose-500" />
                Yasaklı Kelime/Cümle Ekle
              </h4>
              <button
                onClick={() => { setShowAddWordModal(false); setFormWord(""); }}
                className="text-slate-400 hover:text-slate-655 dark:hover:text-slate-250 transition"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddWord} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Yasaklanacak İfade</label>
                <input
                  type="text"
                  required
                  placeholder="Engellenecek kelime veya cümle yazın..."
                  value={formWord}
                  onChange={(e) => setFormWord(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-rose-500 dark:text-white font-medium"
                />
                <p className="text-[10px] text-slate-400 leading-normal">
                  * Sistem, müşteriden gelen mesajlarda veya ses dökümlerinde bu ifadeyi tespit ederse numarayı/sohbeti anında engeller.
                </p>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddWordModal(false); setFormWord(""); }}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-xs font-bold text-slate-655 dark:text-slate-300 transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition"
                >
                  Kelimeyi Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Premium Confirm Delete Modal */}
      {deleteTarget && (
        <ConfirmDeleteModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          title={deleteTarget.type === "blacklist" ? "Kara Listeden Kaldır" : "Yasaklı Kelimeyi Sil"}
          message={`${deleteTarget.value} kaydının suistimal koruma listesinden kaldırılmasını onaylıyor musunuz?`}
        />
      )}
    </div>
  );
}
