import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  X,
  CheckCircle,
  FileText,
  Copy,
  Eye,
  Shield,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

const PLACEHOLDER_CHIPS = [
  "{SIP_SERVER}",
  "{SIP_PORT}",
  "{SIP_USERNAME}",
  "{SIP_PASSWORD}",
  "{EXTENSION}",
  "{DISPLAY_NAME}",
  "{LABEL}",
  "{MAC}",
  "{PROVISION_URL}",
  "{PHONEBOOK_URL}",
  "{DSS_KEYS_BLOCK}",
  "{EXPANSION_MODULES_BLOCK}",
  "{SOFTKEYS_BLOCK}",
  "{RINGTONE}",
  "{BACKLIGHT_ACTIVE}",
  "{LANGUAGE}",
];

export default function AutoprovisionTemplatesPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();

  const [templates, setTemplates] = useState([]);
  const [modelCatalog, setModelCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // all | custom | Yealink | Grandstream | Fanvil | Cisco
  const [banner, setBanner] = useState(null);

  // Modal & Form States
  const [showModal, setShowModal] = useState(false);
  const [isReadOnlyView, setIsReadOnlyView] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [brand, setBrand] = useState("Yealink");
  const [model, setModel] = useState("T42S");
  const [templateName, setTemplateName] = useState("");
  const [xmlContent, setXmlContent] = useState("");

  const API_BASE =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${backendHost}`
      : `http://${backendHost}`;

  const flashBanner = (ok, msg) => {
    setBanner({ ok, text: msg });
    setTimeout(() => setBanner(null), 4500);
  };

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
      if (Array.isArray(data.model_catalog)) {
        setModelCatalog(data.model_catalog);
      }
    } catch (err) {
      console.error("Şablonlar yüklenemedi:", err);
      flashBanner(false, "Şablonlar yüklenirken hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isReadOnlyView) return;
    if (!brand.trim() || !xmlContent.trim()) {
      flashBanner(false, "Marka ve şablon içeriği zorunludur.");
      return;
    }

    setSaving(true);
    const payload = {
      id: editingId,
      brand: brand.trim(),
      model: model.trim(),
      name: templateName.trim() || `${brand.trim()} ${model.trim()} Özel Şablon`,
      xml_content: xmlContent,
    };

    try {
      const res = await fetch(`${API_BASE}/api/settings/autoprovision_templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        throw new Error(data.detail || "Şablon kaydedilemedi.");
      }
      setTemplates(data.templates || []);
      setShowModal(false);
      flashBanner(true, `"${payload.name}" şablonu kaydedildi.`);
    } catch (err) {
      flashBanner(false, err.message || "Şablon kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await fetch(`${API_BASE}/api/settings/autoprovision_templates/${encodeURIComponent(deleteTargetId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Şablon silinemedi.");
      if (Array.isArray(data.templates)) {
        setTemplates(data.templates);
      }
      flashBanner(true, "Özel şablon silindi.");
    } catch (err) {
      flashBanner(false, err.message || "Şablon silinemedi.");
    } finally {
      setDeleteTargetId(null);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setIsReadOnlyView(false);
    setBrand("Yealink");
    setModel("T42S");
    setTemplateName("");
    setXmlContent("");
    setShowModal(true);
  };

  const openViewModal = (t) => {
    setEditingId(t.id);
    setIsReadOnlyView(true);
    setBrand(t.brand || "Yealink");
    setModel(t.model || "");
    setTemplateName(t.name || "");
    setXmlContent(t.xml_content || "");
    setShowModal(true);
  };

  const openEditModal = (t) => {
    if (t.is_system) {
      openViewModal(t);
      return;
    }
    setEditingId(t.id);
    setIsReadOnlyView(false);
    setBrand(t.brand || "Yealink");
    setModel(t.model || "");
    setTemplateName(t.name || "");
    setXmlContent(t.xml_content || "");
    setShowModal(true);
  };

  const openCloneModal = (t) => {
    const cleanBaseName = String(t.name || `${t.brand} ${t.model}`).replace(/\s*—\s*Sistem Şablonu$/i, "").trim();
    setEditingId(null); // null => saves as brand-new custom template!
    setIsReadOnlyView(false);
    setBrand(t.brand || "Yealink");
    setModel(t.model || "");
    setTemplateName(`${cleanBaseName} (Özel Kopya)`);
    setXmlContent(t.xml_content || "");
    setShowModal(true);
  };

  const insertPlaceholder = (chip) => {
    if (isReadOnlyView) return;
    setXmlContent((prev) => `${prev}${prev && !prev.endsWith("\n") ? "\n" : ""}${chip}`);
  };

  const counts = useMemo(() => {
    const c = { all: templates.length, custom: 0, Yealink: 0, Grandstream: 0, Fanvil: 0, Cisco: 0 };
    templates.forEach((t) => {
      if (!t.is_system) c.custom += 1;
      if (c[t.brand] !== undefined) c[t.brand] += 1;
    });
    return c;
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return templates.filter((t) => {
      if (activeFilter === "custom" && t.is_system) return false;
      if (activeFilter !== "all" && activeFilter !== "custom" && t.brand !== activeFilter) return false;
      if (!q) return true;
      return (
        (t.brand && t.brand.toLowerCase().includes(q)) ||
        (t.model && t.model.toLowerCase().includes(q)) ||
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.dss_summary && t.dss_summary.toLowerCase().includes(q))
      );
    });
  }, [templates, activeFilter, searchQuery]);

  const modelsForBrand = useMemo(() => {
    return modelCatalog.filter((m) => m.brand.toLowerCase() === String(brand || "Yealink").toLowerCase());
  }, [modelCatalog, brand]);

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Header */}
      <div className={`p-5 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${lightBg} ${text} rounded-xl`}>
            <FileText size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">
              OTOPROVİZYON ŞABLONLARI
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Sistemde tanımlı tüm marka ve modeller (Yealink, Grandstream, Fanvil, Cisco — {counts.all} şablon) için hazır provizyon şablonları. Herhangi bir modeli <strong>Kopyala</strong> ile çoğaltıp kendi özel şablonunuzu oluşturabilirsiniz.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative">
            <input
              type="text"
              placeholder="Model veya şablon ara (T42S)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-56 text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          <button
            type="button"
            onClick={openAddModal}
            title="Yeni Özel Şablon Ekle"
            className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all shadow-sm cursor-pointer"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
            banner.ok
              ? "bg-emerald-50 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/25 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.ok ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
            <span>{banner.text}</span>
          </div>
          <button type="button" onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Brand & Type Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: "all", label: `Tümü (${counts.all})` },
          { id: "custom", label: `Özel Şablonlarım (${counts.custom})` },
          { id: "Yealink", label: `Yealink (${counts.Yealink})` },
          { id: "Grandstream", label: `Grandstream (${counts.Grandstream})` },
          { id: "Fanvil", label: `Fanvil (${counts.Fanvil})` },
          { id: "Cisco", label: `Cisco (${counts.Cisco})` },
        ].map((pill) => {
          const isAct = activeFilter === pill.id;
          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => setActiveFilter(pill.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                isAct
                  ? `${bg} text-white border-transparent shadow-sm`
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* Templates Table */}
      <div className="flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin ${border}`} />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-14 text-slate-400 dark:text-slate-500 text-xs font-semibold">
            Bu filtreyle eşleşen şablon bulunamadı.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-4">ŞABLON ADI</th>
                  <th className="py-2.5 px-4">TÜR</th>
                  <th className="py-2.5 px-4">MARKA / MODEL</th>
                  <th className="py-2.5 px-4">FORMAT &amp; KAPASİTE</th>
                  <th className="py-2.5 px-4 text-right">İŞLEMLER</th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.map((t) => {
                  const isSys = Boolean(t.is_system);
                  const fmt = String(t.format || (String(t.xml_content || "").trim().startsWith("<") ? "xml" : "cfg")).toUpperCase();
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                        {t.name}
                      </td>
                      <td className="py-3 px-4">
                        {isSys ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-extrabold">
                            <Shield size={10} /> Sistem
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-extrabold">
                            <Sparkles size={10} /> Özel
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{t.brand}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            {t.model || "Genel"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-extrabold">
                            .{fmt}
                          </span>
                          {t.dss_summary && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">{t.dss_summary}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openCloneModal(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-extrabold transition cursor-pointer"
                            title="Bu şablonu kopyalayıp yeni özel şablon oluştur"
                          >
                            <Copy size={12} />
                            <span>Kopyala</span>
                          </button>

                          {isSys ? (
                            <button
                              type="button"
                              onClick={() => openViewModal(t)}
                              className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                              title="Şablon Kodunu İncele"
                            >
                              <Eye size={14} />
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(t)}
                                className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                                title="Düzenle"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTargetId(t.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Sil"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit / Clone / View Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200/70 dark:border-slate-700/70 flex flex-col max-h-[90vh]">
            <div className={`px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center ${bg} text-white shrink-0`}>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <FileText size={18} />
                {isReadOnlyView
                  ? `Sistem Şablonu Önizleme — ${brand} ${model}`
                  : editingId
                  ? "Özel Şablonu Düzenle"
                  : "Yeni Özel Şablon Oluştur"}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-white/80 hover:text-white transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Şablon Adı</label>
                  <input
                    type="text"
                    readOnly={isReadOnlyView}
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    placeholder="Örn: Yealink T42S — Ofis Özel"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Marka</label>
                    <select
                      disabled={isReadOnlyView}
                      value={brand}
                      onChange={(e) => {
                        const nb = e.target.value;
                        setBrand(nb);
                        const firstM = modelCatalog.find((m) => m.brand === nb);
                        if (firstM) setModel(firstM.model);
                      }}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-70"
                    >
                      {["Yealink", "Grandstream", "Fanvil", "Cisco"].map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Model</label>
                    <select
                      disabled={isReadOnlyView}
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-70"
                    >
                      <option value="">Tümü (Marka Geneli)</option>
                      {modelsForBrand.map((m) => (
                        <option key={m.model} value={m.model}>
                          {m.model} ({m.max_dss} DSS)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Clickable Placeholder Chips */}
                {!isReadOnlyView && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-extrabold uppercase text-slate-400">
                      Dinamik Değişkenler (Tıklayarak Koda Ekleyin)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PLACEHOLDER_CHIPS.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => insertPlaceholder(chip)}
                          className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col h-72">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Konfigürasyon İçeriği (.CFG / .XML)
                  </label>
                  <textarea
                    readOnly={isReadOnlyView}
                    value={xmlContent}
                    onChange={(e) => setXmlContent(e.target.value)}
                    className="flex-1 w-full p-3.5 text-[11px] font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-950 text-emerald-300 focus:outline-none resize-none leading-relaxed"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Kapat
                </button>
                {isReadOnlyView ? (
                  <button
                    type="button"
                    onClick={() => {
                      const cleanBase = String(templateName || `${brand} ${model}`).replace(/\s*—\s*Sistem Şablonu$/i, "").trim();
                      setEditingId(null);
                      setIsReadOnlyView(false);
                      setTemplateName(`${cleanBase} (Özel Kopya)`);
                    }}
                    className={`px-5 py-2 text-xs font-extrabold rounded-xl text-white shadow-sm transition-all ${bg} ${hover} flex items-center gap-1.5 cursor-pointer`}
                  >
                    <Copy size={14} />
                    <span>Kopyala &amp; Özelleştir</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={saving}
                    className={`px-5 py-2 text-xs font-extrabold rounded-xl text-white shadow-sm transition-all ${bg} ${hover} flex items-center gap-1.5 cursor-pointer disabled:opacity-50`}
                  >
                    <CheckCircle size={14} />
                    <span>{saving ? "Kaydediliyor..." : "Şablonu Kaydet"}</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal (Fixed with isOpen & onClose!) */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTargetId)}
        title="Özel Şablonu Sil"
        message="Bu özel konfigürasyon şablonunu silmek istediğinize emin misiniz? Bu şablonu kullanan cihazlar otomatik provizyon moduna geçecektir."
        onConfirm={handleDelete}
        onClose={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
