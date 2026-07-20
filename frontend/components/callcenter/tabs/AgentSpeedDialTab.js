import React, { useState, useEffect } from "react";
import { Plus, Trash2, Phone, Search, List, Edit2, AlertCircle } from "lucide-react";
import { useTheme } from "../../../utils/theme";

export default function AgentSpeedDialTab({ backendHost, currentUser }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [speedDials, setSpeedDials] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: "", number: "" });

  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    fetchSpeedDials();
  }, [currentUser]);

  const fetchSpeedDials = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`http://${backendHost}/api/agent/speed_dials?extension=${currentUser.extension || currentUser.id}`);
      const data = await res.json();
      setSpeedDials(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.number || !currentUser) return;

    try {
      const payload = {
        name: formData.name,
        number: formData.number
      };
      if (editingItem) {
        payload.id = editingItem.id;
      }

      const res = await fetch(`http://${backendHost}/api/agent/speed_dials?extension=${currentUser.extension || currentUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === "success") {
        setSpeedDials(data.speed_dials);
        setShowModal(false);
        setEditingItem(null);
        setFormData({ name: "", number: "" });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !currentUser) return;
    try {
      const res = await fetch(`http://${backendHost}/api/agent/speed_dials/${deleteTarget.id}?extension=${currentUser.extension || currentUser.id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.status === "success") {
        setSpeedDials(data.speed_dials);
        setDeleteTarget(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openEdit = (sd) => {
    setEditingItem(sd);
    setFormData({ name: sd.name, number: sd.number });
    setShowModal(true);
  };

  const openNew = () => {
    setEditingItem(null);
    setFormData({ name: "", number: "" });
    setShowModal(true);
  };

  const triggerCall = (number) => {
    window.dispatchEvent(new CustomEvent('TRIGGER_CALL', { detail: number }));
  };

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 p-6 overflow-y-auto relative">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Hızlı Arama Listem</h2>
          <button 
            title="Yeni Hızlı Arama Ekle"
            onClick={openNew}
            className="bg-rose-600 hover:bg-rose-500 rounded-xl h-8 w-8 flex items-center justify-center shrink-0 text-white transition-colors shadow-sm"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className={`bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm overflow-hidden`}>
          {loading ? (
            <div className="p-12 text-center text-slate-500">Yükleniyor...</div>
          ) : speedDials.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <List size={24} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">Henüz kayıt yok</h3>
              <p className="text-sm text-slate-500 max-w-md">Sık görüştüğünüz numaraları buraya ekleyerek tek tuşla arayabilirsiniz.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {speedDials.map((sd) => (
                <div key={sd.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-950/30 transition-colors">
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-white">{sd.name}</h4>
                    <p className="text-sm text-slate-500 font-mono mt-0.5">{sd.number}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => triggerCall(sd.number)}
                      className={`h-9 w-9 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/50 transition-colors`}
                      title="Ara"
                    >
                      <Phone size={16} />
                    </button>
                    <button 
                      onClick={() => openEdit(sd)}
                      className="h-9 w-9 rounded-xl flex items-center justify-center bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                      title="Düzenle"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => setDeleteTarget(sd)}
                      className="h-9 w-9 rounded-xl flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 transition-colors"
                      title="Sil"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                {editingItem ? "Hızlı Arama Düzenle" : "Yeni Hızlı Arama"}
              </h3>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Kişi / Kurum Adı</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className={`w-full px-4 py-2.5 rounded-xl border ${borderLight} bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${ring} transition-all`}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Telefon Numarası</label>
                <input 
                  type="text" 
                  value={formData.number}
                  onChange={e => setFormData({...formData, number: e.target.value.replace(/[^0-9+\s-]/g, "")})}
                  className={`w-full px-4 py-2.5 rounded-xl border ${borderLight} bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 ${ring} transition-all`}
                  required
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  İptal
                </button>
                <button 
                  type="submit" 
                  className={`flex-1 py-2.5 rounded-xl text-white font-semibold ${bg} ${hover} transition-colors shadow-sm`}
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-6 text-center">
            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <AlertCircle size={32} className="text-rose-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Kaydı Sil</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              <strong className="text-slate-700 dark:text-slate-300">{deleteTarget.name}</strong> kaydını hızlı arama listenizden silmek istediğinize emin misiniz?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Vazgeç
              </button>
              <button 
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors shadow-sm"
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
