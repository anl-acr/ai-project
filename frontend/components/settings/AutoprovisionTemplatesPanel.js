import React, { useState, useEffect } from "react";
import { Search, Plus, Trash2, Edit2, X, CheckCircle, FileText } from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

export default function AutoprovisionTemplatesPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg } = useTheme();
  
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal & Form States
  const [showModal, setShowModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  
  const [editingId, setEditingId] = useState(null);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [xmlContent, setXmlContent] = useState("");
  
  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/autoprovision_templates`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setTemplates(data);
      } else if (data.templates) {
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error("Şablonlar yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!brand || !xmlContent) return;
    
    const payload = {
      id: editingId,
      brand: brand.trim(),
      model: model.trim(),
      name: templateName.trim() || `${brand} ${model} Şablonu`,
      xml_content: xmlContent
    };

    try {
      const res = await fetch(`${API_BASE}/api/settings/autoprovision_templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === "success") {
        setTemplates(data.templates);
        setShowModal(false);
      }
    } catch (err) {
      console.error("Şablon kaydedilemedi:", err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await fetch(`${API_BASE}/api/settings/autoprovision_templates/${deleteTargetId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.status === "success") {
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error("Şablon silinemedi:", err);
    } finally {
      setDeleteTargetId(null);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setBrand("");
    setModel("");
    setTemplateName("");
    setXmlContent("");
    setShowModal(true);
  };

  const openEditModal = (t) => {
    setEditingId(t.id);
    setBrand(t.brand || "");
    setModel(t.model || "");
    setTemplateName(t.name || "");
    setXmlContent(t.xml_content || "");
    setShowModal(true);
  };

  const filteredTemplates = templates.filter(t => 
    (t.brand && t.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (t.model && t.model.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (t.name && t.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Header */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${lightBg} ${text} rounded-xl`}>
            <FileText size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">OTOPROVİZYON ŞABLONLARI</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Ağdaki telefonlar için XML konfigürasyon şablonlarını yönetin.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <input
              type="text"
              placeholder="Şablon Ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-48 text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-550" />
          </div>
          <button
            onClick={openAddModal}
            title="Yeni Şablon Ekle"
            className={`p-2 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center h-8 w-8 shrink-0`}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin ${border}`} />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-xs font-semibold">
            Kayıtlı şablon bulunamadı. "+" butonuna tıklayarak ekleyebilirsiniz.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-4">ŞABLON ADI</th>
                  <th className="py-2.5 px-4">MARKA</th>
                  <th className="py-2.5 px-4">MODEL</th>
                  <th className="py-2.5 px-4 text-right">İŞLEMLER</th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {t.name}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {t.brand}
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-500">
                      {t.model || "-"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(t)}
                          className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          title="Düzenle"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTargetId(t.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Sil"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit/Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50 flex flex-col max-h-[90vh]">
            <div className={`px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center ${bg} text-white shrink-0`}>
              <h3 className="font-bold flex items-center gap-2">
                <FileText size={18} />
                {editingId ? "Şablonu Düzenle" : "Yeni Şablon Ekle"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 ml-1">Şablon Adı</label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="Örn: Yealink Standart"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 ml-1">Marka</label>
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      placeholder="Örn: Yealink"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 ml-1">Model (İsteğe Bağlı)</label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      placeholder="Örn: T46U"
                    />
                  </div>
                </div>

                <div className="flex flex-col h-64">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 ml-1">XML Konfigürasyonu</label>
                  <textarea
                    value={xmlContent}
                    onChange={(e) => setXmlContent(e.target.value)}
                    className="flex-1 w-full p-4 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none"
                    placeholder="<xml>...</xml>"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-2 ml-1">
                    İpucu: Mac adresi için {'{MAC}'}, dahili numarası için {'{EXTENSION}'} gibi değişkenler kullanabilirsiniz.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2 text-sm font-medium rounded-xl text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-sm font-semibold rounded-xl text-white shadow-sm transition-all ${bg} ${hover} hover:-translate-y-0.5 flex items-center gap-2`}
                >
                  <CheckCircle size={16} />
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTargetId && (
        <ConfirmDeleteModal
          title="Şablonu Sil"
          message="Bu şablonu silmek istediğinize emin misiniz? Bu şablonu kullanan telefonlar mevcut konfigürasyonlarını koruyacaktır ancak yeniden provizyon edilemezler."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}
    </div>
  );
}
