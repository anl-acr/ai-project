import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Check, X, Coffee, Save, CheckCircle } from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

const CURATED_COLORS = [
  { name: "Turuncu", hex: "#f59e0b" },
  { name: "Mavi", hex: "#3b82f6" },
  { name: "Yeşil", hex: "#10b981" },
  { name: "Kızıl/Pembe", hex: "#ec4899" },
  { name: "Mor", hex: "#8b5cf6" },
  { name: "Kırmızı", hex: "#ef4444" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "İndigo", hex: "#6366f1" }
];

export default function BreakDefinitions({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [breaks, setBreaks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Delete confirmation
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // New break form states
  const [name, setName] = useState("");
  const [color, setColor] = useState("#f59e0b");
  const [customColor, setCustomColor] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    fetchBreaks();
  }, []);

  const fetchBreaks = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/settings/breaks`)
      .then((res) => res.json())
      .then((data) => {
        setBreaks(Array.isArray(data) ? data : (data?.breaks || []));
      })
      .catch((err) => console.error("Molalar yüklenemedi:", err))
      .finally(() => setLoading(false));
  };

  const handleSaveAll = async (updatedBreaks) => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/breaks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedBreaks)
      });
      if (res.ok) {
        const data = await res.json();
        setBreaks(Array.isArray(data?.breaks) ? data.breaks : (Array.isArray(data) ? data : updatedBreaks));
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Mola ayarları kaydedilemedi:", err);
    }
  };

  const handleAddBreak = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const chosenColor = customColor ? customColor : color;
    const newId = breaks.length > 0 ? Math.max(...breaks.map(b => b.id || 0)) + 1 : 1;
    const newBreak = {
      id: newId,
      name: name.trim(),
      color: chosenColor
    };

    const newBreaksList = [...breaks, newBreak];
    setBreaks(newBreaksList);
    setName("");
    setCustomColor("");
    handleSaveAll(newBreaksList);
  };

  const handleDeleteBreak = (id) => {
    setDeleteTargetId(id);
  };

  const confirmDeleteBreak = () => {
    if (deleteTargetId) {
      const filtered = breaks.filter((b) => b.id !== deleteTargetId);
      setBreaks(filtered);
      handleSaveAll(filtered);
      setDeleteTargetId(null);
    }
  };

  const startEdit = (b) => {
    setEditingId(b.id);
    setEditName(b.name);
    setEditColor(b.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditColor("");
  };

  const saveEdit = (id) => {
    if (!editName.trim()) return;
    const updated = breaks.map((b) => {
      if (b.id === id) {
        return { ...b, name: editName.trim(), color: editColor };
      }
      return b;
    });
    setBreaks(updated);
    setEditingId(null);
    handleSaveAll(updated);
  };

  return (
    <div className="w-full space-y-6">
      {/* Title Card */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${lightBg} ${text} rounded-xl`}>
            <Coffee size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">MOLA TANIMLARI YAPILANDIRMASI</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Müşteri temsilcilerinin mola durumlarını belirleyin. Moladaki temsilciler arama aktarımlarından muaf tutulur.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add New Break Card */}
        <div className="lg:col-span-1 p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm h-fit">
          <h4 className="font-bold text-xs text-slate-700 dark:text-slate-350 uppercase tracking-wider pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-4">
            Yeni Mola Tipi Ekle
          </h4>
          <form onSubmit={handleAddBreak} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Mola Adı
              </label>
              <input
                type="text"
                placeholder="Örn: Kahve Molası, Yemek Arası"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} dark:focus:ring-rose-400/25 transition-all`}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Renk Seçimi
              </label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {CURATED_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => {
                      setColor(c.hex);
                      setCustomColor("");
                    }}
                    className={`h-7 rounded-lg border flex items-center justify-center transition-all ${
                      color === c.hex && !customColor
                        ? "border-slate-800 dark:border-slate-200 scale-105"
                        : "border-transparent hover:scale-102"
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {color === c.hex && !customColor && (
                      <Check size={14} className="text-white drop-shadow-md" />
                    )}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[9px] font-semibold text-slate-400 dark:text-slate-500 mb-1">
                  Veya Özel Renk Kodu (HEX)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="#ff0000"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                  {customColor && (
                    <div className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800" style={{ backgroundColor: customColor }} />
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className={`w-full flex items-center justify-center gap-1.5 py-2.5 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition-all shadow-sm`}
            >
              <Plus size={14} />
              <span>Listeye Ekle</span>
            </button>
          </form>
        </div>

        {/* Breaks List Column */}
        <div className="lg:col-span-2 p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-4">
              <h4 className="font-bold text-xs text-slate-700 dark:text-slate-350 uppercase tracking-wider">
                Mola Tanımları Listesi
              </h4>
              {success && (
                <span className="text-[10px] text-primary dark:text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
                  <CheckCircle size={12} /> Değişiklikler Kaydedildi
                </span>
              )}
            </div>

            {loading ? (
              <div className="text-center py-10 text-xs text-slate-500">Yükleniyor...</div>
            ) : breaks.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl text-slate-500 text-xs">
                Mola tanımı bulunmuyor. Sol taraftan yeni bir tane ekleyin.
              </div>
            ) : (
              <div className="space-y-2">
                {breaks.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors"
                  >
                    {editingId === b.id ? (
                      <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 text-xs px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border-0"
                          />
                          <button
                            onClick={() => saveEdit(b.id)}
                            className="p-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 rounded-lg hover:scale-105"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 bg-slate-50 dark:bg-slate-800 text-slate-500 rounded-lg hover:scale-105"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 rounded-full border border-slate-200/20 shadow-sm"
                            style={{ backgroundColor: b.color }}
                          />
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-350">{b.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(b)}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg"
                            title="Düzenle"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteBreak(b.id)}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-primary rounded-lg"
                            title="Sil"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDeleteBreak}
        title="Mola Tipini Sil"
        message="Seçilen mola tanımını silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
      />
    </div>
  );
}
