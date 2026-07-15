import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Save, X, Search, FileText, CheckCircle } from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

export default function CannedResponsesSettings({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [responses, setResponses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Role permissions
  const [hasWritePermission, setHasWritePermission] = useState(false);
  const [hasDeletePermission, setHasDeletePermission] = useState(false);

  // Form Modal States
  const [showModal, setShowModal] = useState(false);
  const [editingResponse, setEditingResponse] = useState(null);
  
  // Fields State
  const [shortcut, setShortcut] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  // Delete modal state
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  // Fetch Canned Responses
  const fetchResponses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/canned-responses`);
      if (res.ok) {
        const data = await res.json();
        setResponses(data);
      }
    } catch (err) {
      console.error("[CannedResponses] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Check permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        const resStatus = await fetch(`${protocol}//${backendHost}/api/agent/status`);
        const statusData = await resStatus.json();
        if (!statusData.is_logged_in) {
          // Dev fallback
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

        setHasWritePermission(currentRole.permissions.includes("canned_responses:write"));
        setHasDeletePermission(currentRole.permissions.includes("canned_responses:delete"));
      } catch (err) {
        console.error("Canned responses permission load error:", err);
        setHasWritePermission(true);
        setHasDeletePermission(true);
      }
    };

    checkPermissions();
    fetchResponses();
  }, [backendHost]);

  // Open Form Modal
  const openFormModal = (item = null) => {
    if (item) {
      setEditingResponse(item);
      setShortcut(item.shortcut);
      setTitle(item.title);
      setContent(item.content);
    } else {
      setEditingResponse(null);
      setShortcut("");
      setTitle("");
      setContent("");
    }
    setErrorMsg("");
    setShowModal(true);
  };

  // Close Form Modal
  const closeFormModal = () => {
    setShowModal(false);
    setEditingResponse(null);
  };

  // Save/Submit Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!shortcut.trim() || !title.trim() || !content.trim()) {
      setErrorMsg("Lütfen tüm alanları doldurun.");
      return;
    }

    // Auto prepend leading slash if missing
    let shortcutVal = shortcut.trim();
    if (!shortcutVal.startsWith("/")) {
      shortcutVal = "/" + shortcutVal;
    }

    const payload = {
      shortcut: shortcutVal,
      title: title.trim(),
      content: content.trim()
    };

    setLoading(true);
    setErrorMsg("");

    try {
      let res;
      if (editingResponse) {
        res = await fetch(`${API_BASE}/api/canned-responses/${editingResponse.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_BASE}/api/canned-responses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setSuccessMsg(editingResponse ? "Taslak güncellendi." : "Yeni taslak kaydedildi.");
        setTimeout(() => setSuccessMsg(""), 3000);
        closeFormModal();
        fetchResponses();
      } else {
        const data = await res.json();
        setErrorMsg(data.detail || "İşlem gerçekleştirilemedi.");
      }
    } catch (err) {
      console.error("[CannedResponses] Save error:", err);
      setErrorMsg("Sunucuyla bağlantı kurulamadı.");
    } finally {
      setLoading(false);
    }
  };

  // Confirm delete handler
  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await fetch(`${API_BASE}/api/canned-responses/${deleteTargetId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setSuccessMsg("Taslak başarıyla silindi.");
        setTimeout(() => setSuccessMsg(""), 3000);
        fetchResponses();
      }
    } catch (err) {
      console.error("[CannedResponses] Delete error:", err);
    } finally {
      setDeleteTargetId(null);
    }
  };

  // Filter local responses list based on search term
  const filteredResponses = responses.filter(r => 
    r.shortcut.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full space-y-6 text-left animate-in fade-in duration-200">
      
      {/* Banner / Header */}
      {/* Banner / Header Card */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${lightBg} ${text} rounded-xl`}>
            <FileText size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">HIZLI CEVAP TASLAKLARI (CANNED RESPONSES)</h3>
            <p className="text-[10px] text-slate-505 dark:text-slate-400 mt-0.5 font-medium">
              Omnichannel sohbet pencerelerinde temsilcilerin hızlıca gönderebileceği şablonları tanımlayın.
            </p>
          </div>
        </div>

        {/* Search Bar + "+" Icon Wrapper */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <input
              type="text"
              placeholder="Şablon ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-48 text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} dark:focus:ring-rose-400/25 transition-all`}
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-555" />
          </div>

          {hasWritePermission && (
            <button
              onClick={() => openFormModal()}
              className={`p-2 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center h-8 w-8 shrink-0`}
              title="Yeni Şablon Ekle"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-primary dark:text-emerald-450 text-xs font-semibold flex items-center gap-1.5">
          <CheckCircle size={14} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Table List */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-850">
              <th className="p-4 text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Kısayol (Trigger)</th>
              <th className="p-4 text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Şablon Başlığı</th>
              <th className="p-4 text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">İçerik</th>
              {(hasWritePermission || hasDeletePermission) && (
                <th className="p-4 text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider text-right">İşlemler</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
            {loading && filteredResponses.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-xs text-slate-400 font-bold animate-pulse">Taslaklar yükleniyor...</td>
              </tr>
            ) : filteredResponses.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-xs text-slate-400 dark:text-slate-555 font-bold">Kayıt bulunamadı.</td>
              </tr>
            ) : (
              filteredResponses.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-850/20 transition">
                  <td className="p-4 text-xs font-mono font-bold text-pink-600 dark:text-pink-400">
                    {item.shortcut}
                  </td>
                  <td className="p-4 text-xs font-bold text-slate-800 dark:text-slate-200">
                    {item.title}
                  </td>
                  <td className="p-4 text-xs text-slate-550 dark:text-slate-400 max-w-sm truncate">
                    {item.content}
                  </td>
                  {(hasWritePermission || hasDeletePermission) && (
                    <td className="p-4 text-right flex items-center justify-end gap-2.5">
                      {hasWritePermission && (
                        <button
                          onClick={() => openFormModal(item)}
                          className="p-1.5 text-slate-450 hover:text-pink-600 dark:hover:text-pink-400 transition"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                      {hasDeletePermission && (
                        <button
                          onClick={() => setDeleteTargetId(item.id)}
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

      {/* Create / Edit Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-955/65 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
              <h3 className="text-xs font-extrabold text-slate-850 dark:text-white uppercase tracking-wider">
                {editingResponse ? "Taslağı Düzenle" : "Yeni Taslak Şablonu"}
              </h3>
              <button onClick={closeFormModal} className="p-1 text-slate-400 hover:text-slate-650 dark:hover:text-slate-250 transition">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl text-primary dark:text-rose-400 text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Kısayol * (örneğin: /selam)</label>
                <input
                  type="text"
                  value={shortcut}
                  onChange={(e) => setShortcut(e.target.value)}
                  required
                  placeholder="/merhaba"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-855 dark:text-slate-200 focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Şablon Başlığı *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Müşteri Karşılama Taslağı"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-855 dark:text-slate-200 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Cevap İçeriği *</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  rows={4}
                  placeholder="Merhaba, size nasıl yardımcı olabilirim?"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-855 dark:text-slate-200 focus:outline-none focus:border-pink-500"
                />
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
        title="Şablonu Sil"
        message="Bu hızlı cevap taslağını silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
      />

    </div>
  );
}
