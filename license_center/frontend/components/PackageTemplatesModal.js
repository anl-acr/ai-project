import React, { useState, useEffect } from "react";
import {
  X,
  Layers,
  Check,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  EyeOff,
  Lock
} from "lucide-react";
import {
  SANTRAL_MODULE_CATEGORIES,
  ALL_SANTRAL_MODULE_IDS,
  SUB_FEATURE_LIST,
  ALL_SUB_FEATURE_IDS,
  STT_PROVIDER_LIST,
  TTS_PROVIDER_LIST,
  LLM_PROVIDER_LIST,
  PACKAGE_TIER_ORDER,
  DEFAULT_PACKAGE_TEMPLATES
} from "../utils/licensePackages";

export default function PackageTemplatesModal({
  isOpen,
  onClose,
  currentUser,
  packageTemplates,
  onTemplatesUpdated
}) {
  const [selectedTier, setSelectedTier] = useState("starter");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [allowedFeatures, setAllowedFeatures] = useState([]);
  const [allowedSubFeatures, setAllowedSubFeatures] = useState([]);
  const [allowedStt, setAllowedStt] = useState([]);
  const [allowedTts, setAllowedTts] = useState([]);
  const [allowedLlm, setAllowedLlm] = useState([]);
  const [unlicensedMode, setUnlicensedMode] = useState("hidden");
  const [moduleSearch, setModuleSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const loadTierIntoForm = (tierKey) => {
    const tpl = (packageTemplates && packageTemplates[tierKey]) || DEFAULT_PACKAGE_TEMPLATES[tierKey];
    if (!tpl) return;
    setSelectedTier(tierKey);
    setName(tpl.name || "");
    setTagline(tpl.tagline || "");
    const featList = Array.isArray(tpl.allowed_features)
      ? tpl.allowed_features.includes("*")
        ? [...ALL_SANTRAL_MODULE_IDS]
        : [...tpl.allowed_features]
      : [...ALL_SANTRAL_MODULE_IDS];
    const subList = Array.isArray(tpl.allowed_sub_features)
      ? tpl.allowed_sub_features.includes("*")
        ? [...ALL_SUB_FEATURE_IDS]
        : [...tpl.allowed_sub_features]
      : [...ALL_SUB_FEATURE_IDS];
    setAllowedFeatures(featList);
    setAllowedSubFeatures(subList);
    setAllowedStt(Array.isArray(tpl.allowed_stt_providers) ? [...tpl.allowed_stt_providers] : []);
    setAllowedTts(Array.isArray(tpl.allowed_tts_providers) ? [...tpl.allowed_tts_providers] : []);
    setAllowedLlm(Array.isArray(tpl.allowed_llm_providers) ? [...tpl.allowed_llm_providers] : []);
    setUnlicensedMode(tpl.unlicensed_module_mode || "hidden");
    setFeedback(null);
  };

  useEffect(() => {
    if (isOpen) {
      loadTierIntoForm(selectedTier || "starter");
      setModuleSearch("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleItem = (list, setter, id) => {
    if (list.includes(id)) {
      setter(list.filter((x) => x !== id));
    } else {
      setter([...list, id]);
    }
  };

  const setCategoryAll = (catItems, selectAll) => {
    const ids = catItems.map((i) => i.id);
    if (selectAll) {
      setAllowedFeatures((prev) => Array.from(new Set([...prev, ...ids])));
    } else {
      setAllowedFeatures((prev) => prev.filter((id) => !ids.includes(id)));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/packages/${selectedTier}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-Name": currentUser?.username || "admin"
        },
        body: JSON.stringify({
          name: name.trim() || DEFAULT_PACKAGE_TEMPLATES[selectedTier]?.name || selectedTier,
          tagline: tagline.trim(),
          allowed_features: allowedFeatures,
          allowed_sub_features: allowedSubFeatures,
          allowed_stt_providers: allowedStt,
          allowed_tts_providers: allowedTts,
          allowed_llm_providers: allowedLlm,
          unlicensed_module_mode: unlicensedMode
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Paket şablonu kaydedilemedi.");
      setFeedback({
        type: "ok",
        text: `"${name || selectedTier}" paket şablonu kaydedildi (${allowedFeatures.length} modül, ${allowedSubFeatures.length} alt özellik). Yeni lisanslarda otomatik uygulanacak.`
      });
      if (onTemplatesUpdated) await onTemplatesUpdated();
    } catch (err) {
      setFeedback({ type: "err", text: err.message || "Kaydetme sırasında hata oluştu." });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/packages/${selectedTier}/reset`, {
        method: "POST",
        headers: { "X-User-Name": currentUser?.username || "admin" }
      });
      if (!res.ok) throw new Error("Sıfırlama başarısız oldu.");
      const defTpl = DEFAULT_PACKAGE_TEMPLATES[selectedTier];
      if (defTpl) {
        setName(defTpl.name);
        setTagline(defTpl.tagline);
        setAllowedFeatures(
          defTpl.allowed_features.includes("*") ? [...ALL_SANTRAL_MODULE_IDS] : [...defTpl.allowed_features]
        );
        setAllowedSubFeatures(
          defTpl.allowed_sub_features.includes("*") ? [...ALL_SUB_FEATURE_IDS] : [...defTpl.allowed_sub_features]
        );
        setAllowedStt([...defTpl.allowed_stt_providers]);
        setAllowedTts([...defTpl.allowed_tts_providers]);
        setAllowedLlm([...defTpl.allowed_llm_providers]);
        setUnlicensedMode(defTpl.unlicensed_module_mode || "hidden");
      }
      if (onTemplatesUpdated) await onTemplatesUpdated();
      setFeedback({ type: "ok", text: "Paket şablonu varsayılan fabrika matrisine sıfırlandı." });
    } catch (err) {
      setFeedback({ type: "err", text: err.message || "Sıfırlama hatası." });
    } finally {
      setResetting(false);
    }
  };

  const q = moduleSearch.trim().toLowerCase();
  const subGroups = ["Abone & WebPhone", "Omnichannel Kanalları", "AI WebPhone"];
  const aiEngineCount = allowedStt.length + allowedTts.length + allowedLlm.length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-6xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 shrink-0">
              <Layers size={18} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Lisans Paket Şablonları (Özellik Bazlı Yönetim)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Her pakette hangi santral modüllerinin, alt özelliklerin ve AI motorlarının açık olacağını buradan özelleştirin.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tier Selector Bar */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 overflow-x-auto">
          {PACKAGE_TIER_ORDER.map((tk) => {
            const tpl = (packageTemplates && packageTemplates[tk]) || DEFAULT_PACKAGE_TEMPLATES[tk];
            const isSel = selectedTier === tk;
            const modCount = Array.isArray(tpl.allowed_features)
              ? tpl.allowed_features.includes("*")
                ? ALL_SANTRAL_MODULE_IDS.length
                : tpl.allowed_features.length
              : 0;
            return (
              <button
                key={tk}
                type="button"
                onClick={() => loadTierIntoForm(tk)}
                className={`px-3.5 py-2 rounded-xl border text-xs font-extrabold whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer ${
                  isSel
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-400"
                }`}
              >
                <span>{tpl.shortName || tpl.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] ${
                    isSel ? "bg-white/20 text-white" : "bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {modCount}/{ALL_SANTRAL_MODULE_IDS.length}
                </span>
                {tpl.is_customized && (
                  <span
                    className={`w-2 h-2 rounded-full ${isSel ? "bg-amber-300" : "bg-amber-500"}`}
                    title="Özelleştirilmiş Şablon"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* Package Metadata & Summary */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1">
                Paket Görünen Adı
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1">
                Kısa Açıklama
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1">
                Paket Dışı Modüller Santralde Nasıl Görünsün?
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setUnlicensedMode("hidden")}
                  className={`px-2.5 py-2 rounded-xl border text-[11px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    unlicensedMode === "hidden"
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <EyeOff size={12} />
                  <span>Gizle</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUnlicensedMode("teaser")}
                  className={`px-2.5 py-2 rounded-xl border text-[11px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    unlicensedMode === "teaser"
                      ? "bg-amber-600 text-white border-amber-600"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <Lock size={12} />
                  <span>Kilitli Göster</span>
                </button>
              </div>
            </div>
          </div>

          {/* Live Counters + Search */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-extrabold">
                Modül: {allowedFeatures.length} / {ALL_SANTRAL_MODULE_IDS.length}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-extrabold">
                Alt Özellik: {allowedSubFeatures.length} / {ALL_SUB_FEATURE_IDS.length}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-extrabold">
                AI Motoru: {aiEngineCount} / {STT_PROVIDER_LIST.length + TTS_PROVIDER_LIST.length + LLM_PROVIDER_LIST.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={moduleSearch}
                  onChange={(e) => setModuleSearch(e.target.value)}
                  placeholder="Modül veya rapor ara..."
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 w-52"
                />
              </div>
              <button
                type="button"
                onClick={() => setAllowedFeatures([...ALL_SANTRAL_MODULE_IDS])}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white font-bold text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Tümünü Aç
              </button>
              <button
                type="button"
                onClick={() => setAllowedFeatures([])}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-600 hover:text-white font-bold text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Temizle
              </button>
            </div>
          </div>

          {/* 8 Module Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {SANTRAL_MODULE_CATEGORIES.map((cat) => {
              const filteredItems = q
                ? cat.items.filter(
                    (it) => it.label.toLowerCase().includes(q) || it.id.toLowerCase().includes(q)
                  )
                : cat.items;
              if (q && filteredItems.length === 0) return null;
              const selectedInCat = cat.items.filter((it) => allowedFeatures.includes(it.id)).length;

              return (
                <div
                  key={cat.id}
                  className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/70 dark:border-slate-800">
                    <div className="font-extrabold text-slate-800 dark:text-slate-100 text-[11px]">
                      {cat.title}{" "}
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">
                        ({selectedInCat}/{cat.items.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setCategoryAll(cat.items, true)}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 cursor-pointer"
                      >
                        Tümü
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryAll(cat.items, false)}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 hover:text-rose-500 cursor-pointer"
                      >
                        Hiçbiri
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {filteredItems.map((it) => {
                      const active = allowedFeatures.includes(it.id);
                      return (
                        <label
                          key={it.id}
                          className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                            active
                              ? "bg-indigo-50/80 dark:bg-indigo-950/35 border-indigo-400/70 dark:border-indigo-700 text-slate-900 dark:text-white font-bold"
                              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleItem(allowedFeatures, setAllowedFeatures, it.id)}
                            className="accent-indigo-600 rounded cursor-pointer shrink-0"
                          />
                          <span className="text-[11px] leading-tight truncate" title={it.label}>
                            {it.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sub-Features (Grouped) */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span>Gelişmiş Abone, WebPhone &amp; Omnichannel Alt Özellikleri</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAllowedSubFeatures([...ALL_SUB_FEATURE_IDS])}
                  className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-emerald-600 cursor-pointer"
                >
                  Tümünü Aç
                </button>
                <button
                  type="button"
                  onClick={() => setAllowedSubFeatures([])}
                  className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 hover:text-rose-500 cursor-pointer"
                >
                  Temizle
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {subGroups.map((grp) => (
                <div key={grp} className="space-y-1.5">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{grp}</div>
                  {SUB_FEATURE_LIST.filter((s) => s.group === grp).map((sf) => {
                    const active = allowedSubFeatures.includes(sf.id);
                    return (
                      <label
                        key={sf.id}
                        className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                          active
                            ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-400/70 dark:border-emerald-700 text-slate-900 dark:text-white font-bold"
                            : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleItem(allowedSubFeatures, setAllowedSubFeatures, sf.id)}
                          className="accent-emerald-600 rounded cursor-pointer shrink-0"
                        />
                        <span className="text-[11px] leading-tight">{sf.label}</span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* AI Engine Entitlements */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
              <Sparkles size={14} className="text-purple-500" />
              <span>Yapay Zeka Motor Yetkileri (STT / TTS / LLM)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { title: "STT (Konuşma → Metin)", list: STT_PROVIDER_LIST, val: allowedStt, set: setAllowedStt },
                { title: "TTS (Metin → Ses)", list: TTS_PROVIDER_LIST, val: allowedTts, set: setAllowedTts },
                { title: "LLM (Yapay Zeka Beyni)", list: LLM_PROVIDER_LIST, val: allowedLlm, set: setAllowedLlm }
              ].map((grp) => (
                <div key={grp.title} className="space-y-1.5">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{grp.title}</div>
                  {grp.list.map((p) => {
                    const active = grp.val.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-2 cursor-pointer ${
                          active
                            ? "bg-purple-50/80 dark:bg-purple-950/30 border-purple-400/70 dark:border-purple-700 text-slate-900 dark:text-white font-bold"
                            : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-500"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleItem(grp.val, grp.set, p.id)}
                          className="accent-purple-600 rounded cursor-pointer shrink-0"
                        />
                        <span className="text-[11px]">{p.label}</span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {feedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-extrabold flex items-center gap-2 ${
                feedback.type === "ok"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400"
              }`}
            >
              {feedback.type === "ok" ? <Check size={15} /> : <AlertTriangle size={15} />}
              <span>{feedback.text}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-950/50">
          <button
            type="button"
            disabled={resetting}
            onClick={handleReset}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw size={13} />
            <span>{resetting ? "Sıfırlanıyor..." : "Varsayılana Sıfırla"}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Kapat
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-extrabold shadow-md shadow-indigo-500/20 flex items-center gap-2 cursor-pointer"
            >
              <Save size={14} />
              <span>{saving ? "Kaydediliyor..." : "Şablonu Kaydet"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
