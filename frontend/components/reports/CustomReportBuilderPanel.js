import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles,
  Plus,
  Play,
  Save,
  Download,
  Trash2,
  BarChart3,
  TrendingUp,
  PieChart,
  Table as TableIcon,
  Filter,
  FolderOpen,
  Cpu,
  Cloud,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Calendar,
  Sliders,
  Clock
} from "lucide-react";
import * as XLSX from "xlsx";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";
import DictationButton from "../common/DictationButton";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";

const EXAMPLE_PROMPTS = [
  "Son 7 günde temsilci bazlı toplam çağrı, cevaplanan, kaçan çağrı ve ortalama konuşma süresini sütun grafikle göster",
  "Günlük tarih bazlı çağrı trendini ve cevaplanma oranını çizgi grafik olarak çıkar",
  "Temsilcilerin toplam mola adedi ve mola sürelerini büyükten küçüğe listele",
  "Omnichannel kanallarına göre toplam sohbet ve AI karşılama oranlarını pasta dağılım olarak getir",
  "Müşteri duygu durumuna göre çağrı dağılımını ve ortalama kalite puanını göster",
  "VoIP ses kalitesi MOS skorlarını ve paket kaybı oranlarını dahili bazlı analiz et"
];

const FILTER_OPS = [
  { value: "contains", label: "İçerir" },
  { value: "eq", label: "Eşittir (=)" },
  { value: "neq", label: "Eşit Değildir (≠)" },
  { value: "gt", label: "Büyüktür (>)" },
  { value: "lt", label: "Küçüktür (<)" }
];

function getTodayStr() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function getRelativeDateStr(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export default function CustomReportBuilderPanel({ userPermissions = null }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const API_BASE = getApiBaseUrl();

  const resolvedPerms = useMemo(() => {
    if (Array.isArray(userPermissions)) return userPermissions;
    if (typeof window !== "undefined") {
      try {
        const u = JSON.parse(localStorage.getItem("pbx_user") || "{}");
        if (u?.role === "admin") return ["*"];
        if (Array.isArray(u?.permissions)) return u.permissions;
      } catch (_) {}
    }
    return ["*"];
  }, [userPermissions]);

  const hasPerm = (code) =>
    resolvedPerms.includes("*") ||
    resolvedPerms.includes(code) ||
    resolvedPerms.includes("reports_custom_builder") ||
    resolvedPerms.includes("reports:access");

  const canRead = hasPerm("reports_custom_builder:read");
  const canWrite = resolvedPerms.includes("*") || resolvedPerms.includes("reports_custom_builder:write");
  const canDelete = resolvedPerms.includes("*") || resolvedPerms.includes("reports_custom_builder:delete");

  const [datasets, setDatasets] = useState([]);
  const [aiRoutingInfo, setAiRoutingInfo] = useState({ provider: "gemini", model: "gemini-2.5-flash" });
  const [savedReports, setSavedReports] = useState([]);

  // Designer state
  const [activeSavedId, setActiveSavedId] = useState("");
  const [reportTitle, setReportTitle] = useState("Temsilci Çağrı Performans Analizi");
  const [reportDesc, setReportDesc] = useState("");
  const [datasetId, setDatasetId] = useState("calls");
  const [groupBy, setGroupBy] = useState("agent");
  const [selectedMetrics, setSelectedMetrics] = useState([
    "total_calls",
    "answered_calls",
    "missed_calls",
    "answer_rate_pct",
    "total_talk_min",
    "avg_talk_sec"
  ]);
  const [filters, setFilters] = useState([]);
  const [chartType, setChartType] = useState("bar");
  const [sortBy, setSortBy] = useState("total_calls");
  const [sortDir, setSortDir] = useState("desc");

  // Date filter state
  const [quickRange, setQuickRange] = useState("last_7_days");
  const [startDate, setStartDate] = useState(() => getRelativeDateStr(6));
  const [endDate, setEndDate] = useState(() => getTodayStr());

  // AI Prompt state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [lastAiMeta, setLastAiMeta] = useState(null);

  // Execution result state
  const [running, setRunning] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [toast, setToast] = useState(null);

  // Modals
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const currentDatasetMeta = useMemo(
    () => datasets.find((d) => d.id === datasetId) || datasets[0] || null,
    [datasets, datasetId]
  );

  const loadInitialData = async () => {
    try {
      const [metaRes, savedRes] = await Promise.all([
        tenantFetch(`${API_BASE}/api/reports/custom/metadata`),
        tenantFetch(`${API_BASE}/api/reports/custom/saved`)
      ]);
      if (metaRes.ok) {
        const metaJson = await metaRes.json();
        if (Array.isArray(metaJson.datasets)) setDatasets(metaJson.datasets);
        if (metaJson.ai_routing) setAiRoutingInfo(metaJson.ai_routing);
      }
      if (savedRes.ok) {
        const savedJson = await savedRes.json();
        setSavedReports(Array.isArray(savedJson.reports) ? savedJson.reports : []);
      }
    } catch (err) {
      console.error("Custom report metadata error:", err);
    }
  };

  useEffect(() => {
    if (canRead) {
      loadInitialData();
      runReportQuery();
    }
  }, [canRead]);

  const applyQuickRange = (preset) => {
    setQuickRange(preset);
    const today = getTodayStr();
    if (preset === "today") {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === "yesterday") {
      const y = getRelativeDateStr(1);
      setStartDate(y);
      setEndDate(y);
    } else if (preset === "last_7_days") {
      setStartDate(getRelativeDateStr(6));
      setEndDate(today);
    } else if (preset === "last_30_days") {
      setStartDate(getRelativeDateStr(29));
      setEndDate(today);
    }
  };

  const handleDatasetChange = (newDsId) => {
    setDatasetId(newDsId);
    const ds = datasets.find((d) => d.id === newDsId);
    if (ds) {
      setGroupBy(ds.default_group_by || ds.dimensions?.[0]?.id || "date");
      const defM = Array.isArray(ds.default_metrics) ? ds.default_metrics : [];
      setSelectedMetrics(defM);
      setSortBy(defM[0] || "group_key");
      setFilters([]);
    }
  };

  const toggleMetric = (mId) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(mId)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== mId);
      }
      return [...prev, mId];
    });
  };

  const addFilterRow = () => {
    const firstField = currentDatasetMeta?.filter_fields?.[0]?.id || "";
    if (!firstField) return;
    setFilters((prev) => [...prev, { field: firstField, op: "contains", value: "" }]);
  };

  const updateFilterRow = (idx, key, val) => {
    setFilters((prev) => prev.map((f, i) => (i === idx ? { ...f, [key]: val } : f)));
  };

  const removeFilterRow = (idx) => {
    setFilters((prev) => prev.filter((_, i) => i !== idx));
  };

  const buildCurrentDefinition = () => ({
    title: reportTitle,
    description: reportDesc,
    dataset: datasetId,
    group_by: groupBy,
    metrics: selectedMetrics,
    filters: filters.filter((f) => String(f.value || "").trim() !== ""),
    chart_type: chartType,
    sort_by: sortBy,
    sort_dir: sortDir,
    limit: 150
  });

  const runReportQuery = async (overrideDef = null, overrideStart = null, overrideEnd = null) => {
    setRunning(true);
    try {
      const defToRun = overrideDef || buildCurrentDefinition();
      const res = await tenantFetch(`${API_BASE}/api/reports/custom/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          definition: defToRun,
          start_date: overrideStart || startDate,
          end_date: overrideEnd || endDate,
          start_time: "00:00",
          end_time: "23:59"
        })
      });
      if (!res.ok) throw new Error("Rapor sorgusu çalıştırılamadı.");
      const data = await res.json();
      setResultData(data);
    } catch (err) {
      showToast(err.message || "Rapor çalıştırılırken hata oluştu.", "error");
    } finally {
      setRunning(false);
    }
  };

  const handleAiGenerate = async (customPromptText = null) => {
    const finalPrompt = String(customPromptText !== null ? customPromptText : aiPrompt).trim();
    if (!finalPrompt) {
      showToast("Lütfen AI için bir rapor tarifi yazın veya mikrofonla dikte edin.", "error");
      return;
    }
    setAiLoading(true);
    try {
      const res = await tenantFetch(`${API_BASE}/api/reports/custom/ai-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          start_date: startDate,
          end_date: endDate
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "AI rapor üretemedi.");

      const def = data.definition || {};
      setActiveSavedId("");
      setReportTitle(def.title || "AI Özel Raporu");
      setReportDesc(finalPrompt);
      setDatasetId(def.dataset || "calls");
      setGroupBy(def.group_by || "agent");
      setSelectedMetrics(Array.isArray(def.metrics) ? def.metrics : ["total_calls"]);
      setFilters(Array.isArray(def.filters) ? def.filters : []);
      setChartType(def.chart_type || "bar");
      setSortBy(def.sort_by || def.metrics?.[0] || "group_key");
      setSortDir(def.sort_dir || "desc");

      if (data.applied_start_date && data.applied_end_date) {
        setStartDate(data.applied_start_date);
        setEndDate(data.applied_end_date);
        if (data.suggested_period) setQuickRange(data.suggested_period);
      }

      setResultData(data);
      setLastAiMeta({
        provider: data.provider_used,
        model: data.model_used,
        fallback: data.fallback_used
      });
      showToast("AI rapor tasarımını oluşturdu ve verileri getirdi.");
    } catch (err) {
      showToast(err.message || "AI rapor oluşturma hatası.", "error");
    } finally {
      setAiLoading(false);
    }
  };

  const handleResetNewReport = () => {
    setActiveSavedId("");
    setReportTitle("Yeni Özel Rapor");
    setReportDesc("");
    setAiPrompt("");
    setLastAiMeta(null);
    handleDatasetChange("calls");
    setChartType("bar");
    showToast("Yeni rapor tasarım alanı sıfırlandı.");
  };

  const handleLoadSavedReport = (rep) => {
    const def = rep.definition || {};
    setActiveSavedId(rep.id);
    setReportTitle(rep.title || def.title || "Kayıtlı Rapor");
    setReportDesc(rep.description || def.description || "");
    setDatasetId(def.dataset || "calls");
    setGroupBy(def.group_by || "agent");
    setSelectedMetrics(Array.isArray(def.metrics) ? def.metrics : ["total_calls"]);
    setFilters(Array.isArray(def.filters) ? def.filters : []);
    setChartType(def.chart_type || "bar");
    setSortBy(def.sort_by || def.metrics?.[0] || "group_key");
    setSortDir(def.sort_dir || "desc");
    runReportQuery(def);
  };

  const handleSaveReport = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setSavingReport(true);
    try {
      const def = buildCurrentDefinition();
      const res = await tenantFetch(`${API_BASE}/api/reports/custom/saved`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeSavedId || undefined,
          title: reportTitle.trim() || "Özel Raporum",
          description: reportDesc.trim(),
          definition: def
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Rapor kaydedilemedi.");
      setActiveSavedId(data.report?.id || "");
      setIsSaveModalOpen(false);
      await loadInitialData();
      showToast("Özel rapor kaydedildi. Artık Zamanlanmış Raporlar içinde de seçilebilir!");
    } catch (err) {
      showToast(err.message || "Kaydetme hatası.", "error");
    } finally {
      setSavingReport(false);
    }
  };

  const confirmDeleteSavedReport = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await tenantFetch(`${API_BASE}/api/reports/custom/saved/${deleteTarget.id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Kayıtlı rapor silinemedi.");
      if (activeSavedId === deleteTarget.id) setActiveSavedId("");
      setDeleteTarget(null);
      await loadInitialData();
      showToast("Kayıtlı özel rapor silindi.");
    } catch (err) {
      showToast(err.message || "Silme hatası.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleExportExcel = () => {
    if (!resultData || !Array.isArray(resultData.rows) || resultData.rows.length === 0) {
      showToast("Dışa aktarılacak veri bulunamadı.", "error");
      return;
    }
    const wb = XLSX.utils.book_new();
    const cols = resultData.columns || [];

    const summaryRows = [
      { Bilgi: "Rapor Başlığı", Değer: reportTitle },
      { Bilgi: "Tarih Aralığı", Değer: `${startDate} - ${endDate}` },
      ...(resultData.summary_cards || []).map((c) => ({
        Bilgi: c.label,
        Değer: `${c.value}${c.unit ? " " + c.unit : ""}`
      }))
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Ozet_KPI");

    const detailRows = resultData.rows.map((r) => {
      const obj = {};
      cols.forEach((col) => {
        obj[col.label] = r[col.key];
      });
      return obj;
    });
    const wsData = XLSX.utils.json_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(wb, wsData, "Rapor_Verisi");

    const safeName = (reportTitle || "ozel_rapor")
      .toLowerCase()
      .replace(/[^a-z0-9ğüşıöç_-]+/gi, "_")
      .slice(0, 45);
    XLSX.writeFile(wb, `${safeName}_${startDate}_${endDate}.xlsx`);
  };

  if (!canRead) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <AlertTriangle className="mx-auto mb-3 text-amber-500" size={32} />
        <h3 className="text-base font-bold text-slate-800 dark:text-white">Yetki Gerekli</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Özel Rapor Tasarımcısı ekranını görüntülemek için yetkiniz bulunmuyor.
        </p>
      </div>
    );
  }

  const chartItems = resultData?.chart_data || [];
  const maxChartVal = Math.max(1, ...chartItems.map((x) => Number(x.value) || 0));
  const totalChartSum = chartItems.reduce((acc, x) => acc + (Number(x.value) || 0), 0);

  return (
    <div className="space-y-5">
      {/* Toast Bildirimi */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all ${
            toast.type === "error"
              ? "bg-rose-600 text-white border-rose-500"
              : "bg-slate-900 dark:bg-slate-800 text-white border-slate-700"
          }`}
        >
          {toast.type === "error" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} className="text-emerald-400" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Üst Başlık & Yeni Tasarım (+) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${lightBg} ${text} border ${borderLight}`}>
              <Sparkles size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Özel Rapor Tasarımcısı & AI Rapor Üretici
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${lightBg} ${lightText} ${borderLight}`}
                >
                  {aiRoutingInfo.provider === "ollama" ? <Cpu size={12} /> : <Cloud size={12} />}
                  {aiRoutingInfo.provider === "ollama"
                    ? `Yerel LLM (${aiRoutingInfo.model})`
                    : `Cloud AI (${aiRoutingInfo.provider.toUpperCase()} • ${aiRoutingInfo.model})`}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                İster doğal dilde yazarak veya sesli dikte ile AI&apos;a tarif edin, isterseniz veri kaynağı ve metrikleri seçerek kendi raporunuzu oluşturup kaydedin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {canWrite && (
              <button
                type="button"
                onClick={handleResetNewReport}
                title="Yeni Özel Rapor Tasarla"
                className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 shadow-sm transition-colors"
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        </div>

        {/* AI Doğal Dil & Sesli Dikte Prompt Alanı */}
        {canWrite && (
          <div className={`mt-4 p-4 rounded-2xl border ${borderLight} bg-slate-50/70 dark:bg-slate-950/50`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles size={14} className={text} />
                Yapay Zeka ile Doğal Dilde / Sesli Dikte ile Rapor Üret
              </label>
              {lastAiMeta && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Son üretim: <b className="text-slate-700 dark:text-slate-200">{lastAiMeta.provider}</b> ({lastAiMeta.model})
                </span>
              )}
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
              <div className="relative flex-1 flex items-center">
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAiGenerate();
                    }
                  }}
                  placeholder="Örn: Son 7 günde temsilcilerin cevapladığı ve kaçırdığı çağrıları sütun grafikle karşılaştır..."
                  className={`w-full pl-3.5 pr-12 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                />
                <div className="absolute right-2 flex items-center">
                  <DictationButton
                    value={aiPrompt}
                    onChange={setAiPrompt}
                    disabled={aiLoading}
                    size={16}
                    onError={(msg) => showToast(msg, "error")}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAiGenerate()}
                disabled={aiLoading}
                className={`px-4 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 shrink-0 shadow-sm transition-all ${bg} ${hover} disabled:opacity-50`}
              >
                {aiLoading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                <span>{aiLoading ? "AI Hazırlıyor..." : "AI ile Rapor Üret"}</span>
              </button>
            </div>

            {/* Hızlı Örnek Çipler */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <span className="text-[11px] font-semibold text-slate-400 mr-1">Örnekler:</span>
              {EXAMPLE_PROMPTS.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setAiPrompt(ex);
                    handleAiGenerate(ex);
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500 transition-colors truncate max-w-[300px]"
                  title={ex}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Ana Gövde: Sol Tasarım & Kayıtlılar / Sağ Canlı Önizleme */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* SOL KOLON: Görsel Tasarımcı + Kayıtlı Özel Raporlar */}
        <div className="xl:col-span-4 space-y-5">
          {/* Görsel Rapor Tasarım Parametreleri */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders size={16} className={text} />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Rapor Tasarım Parametreleri</h3>
              </div>
              <button
                type="button"
                onClick={() => runReportQuery()}
                disabled={running}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 ${bg} ${hover} disabled:opacity-50`}
              >
                {running ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                Çalıştır
              </button>
            </div>

            {/* Rapor Adı */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Rapor Başlığı</label>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            {/* Veri Kaynağı */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">1. Veri Kaynağı (Modül)</label>
              <select
                value={datasetId}
                onChange={(e) => handleDatasetChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {datasets.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Gruplama Boyutu */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                2. Kırılım / Gruplama Boyutu (Satırlar)
              </label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {(currentDatasetMeta?.dimensions || []).map((dim) => (
                  <option key={dim.id} value={dim.id}>
                    {dim.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Metrik Seçimi */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  3. Hesaplanacak Sütunlar ({selectedMetrics.length} Seçili)
                </label>
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/40">
                {(currentDatasetMeta?.metrics || []).map((m) => {
                  const checked = selectedMetrics.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        checked
                          ? `${lightBg} ${lightText} font-semibold`
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMetric(m.id)}
                          className="rounded border-slate-300"
                        />
                        {m.label}
                      </span>
                      {m.unit && <span className="text-[10px] opacity-75">{m.unit}</span>}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Dinamik Filtre Koşulları */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Filter size={12} /> 4. Özel Filtre Koşulları
                </label>
                <button
                  type="button"
                  onClick={addFilterRow}
                  className={`text-[11px] font-semibold ${text} hover:underline`}
                >
                  + Koşul Ekle
                </button>
              </div>

              {filters.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">Ek filtre yok (tüm kayıtlar dahil edilir).</p>
              ) : (
                <div className="space-y-2">
                  {filters.map((flt, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <select
                        value={flt.field}
                        onChange={(e) => updateFilterRow(idx, "field", e.target.value)}
                        className="w-1/3 px-2 py-1.5 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      >
                        {(currentDatasetMeta?.filter_fields || []).map((ff) => (
                          <option key={ff.id} value={ff.id}>
                            {ff.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={flt.op}
                        onChange={(e) => updateFilterRow(idx, "op", e.target.value)}
                        className="w-1/4 px-2 py-1.5 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      >
                        {FILTER_OPS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={flt.value}
                        onChange={(e) => updateFilterRow(idx, "value", e.target.value)}
                        placeholder="Değer..."
                        className="flex-1 min-w-0 px-2 py-1.5 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => removeFilterRow(idx)}
                        className="p-1 text-slate-400 hover:text-rose-500"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Kayıtlı Özel Raporlarım */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FolderOpen size={16} className={text} />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                  Kayıtlı Özel Raporlar ({savedReports.length})
                </h3>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1">
              <Clock size={12} className="shrink-0" />
              Kaydettiğiniz raporlar <b>Zamanlanmış Raporlar</b> ekranına da otomatik eklenir.
            </p>

            {savedReports.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                Henüz kaydedilmiş özel raporunuz bulunmuyor.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {savedReports.map((rep) => {
                  const isActive = activeSavedId === rep.id;
                  return (
                    <div
                      key={rep.id}
                      onClick={() => handleLoadSavedReport(rep)}
                      className={`group flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isActive
                          ? `${lightBg} ${border} shadow-sm`
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-bold text-slate-800 dark:text-white truncate">{rep.title}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {rep.definition?.dataset?.toUpperCase()} • {rep.updated_at || "-"}
                        </div>
                      </div>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(rep);
                          }}
                          title="Kayıtlı Raporu Sil"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* SAĞ KOLON: Tarih Aralığı, Görselleştirme, KPI Kartları ve Veri Tablosu */}
        <div className="xl:col-span-8 space-y-5">
          {/* Üst Araç Çubuğu: Tarih + Grafik Türü + Kaydet + Excel */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            {/* Tarih Seçici */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "today", label: "Bugün" },
                { id: "yesterday", label: "Dün" },
                { id: "last_7_days", label: "Son 7 Gün" },
                { id: "last_30_days", label: "Son 30 Gün" }
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    applyQuickRange(p.id);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    quickRange === p.id
                      ? `${bg} text-white`
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <div className="flex items-center gap-1.5 ml-1">
                <Calendar size={14} className="text-slate-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setQuickRange("custom");
                    setStartDate(e.target.value);
                  }}
                  className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white"
                />
                <span className="text-xs text-slate-400">—</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setQuickRange("custom");
                    setEndDate(e.target.value);
                  }}
                  className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => runReportQuery()}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-700 text-white hover:opacity-90"
                >
                  Uygula
                </button>
              </div>
            </div>

            {/* Görsel Tipi + Aksiyonlar */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {[
                  { id: "bar", icon: BarChart3, title: "Sütun Grafik" },
                  { id: "line", icon: TrendingUp, title: "Çizgi Trend" },
                  { id: "pie", icon: PieChart, title: "Dağılım Oranı" },
                  { id: "table", icon: TableIcon, title: "Sadece Tablo" }
                ].map((ct) => {
                  const IconComp = ct.icon;
                  return (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => setChartType(ct.id)}
                      title={ct.title}
                      className={`p-1.5 rounded-lg transition-colors ${
                        chartType === ct.id
                          ? `bg-white dark:bg-slate-900 ${text} shadow-sm`
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                      }`}
                    >
                      <IconComp size={15} />
                    </button>
                  );
                })}
              </div>

              {canWrite && (
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5"
                >
                  <Save size={14} />
                  {activeSavedId ? "Güncelle" : "Kaydet"}
                </button>
              )}

              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm"
              >
                <Download size={14} />
                Excel (.xlsx)
              </button>
            </div>
          </div>

          {/* Özet KPI Kartları */}
          {resultData?.summary_cards && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {resultData.summary_cards.map((card, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm"
                >
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                    {card.label}
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {card.value}
                    {card.unit && <span className="text-xs font-semibold text-slate-400 ml-1">{card.unit}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Grafik Görselleştirme Alanı */}
          {chartType !== "table" && chartItems.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{reportTitle}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Görselleştirilen Ana Metrik: <b>{resultData?.primary_metric_label}</b>
                  </p>
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    runReportQuery({ ...buildCurrentDefinition(), sort_by: e.target.value });
                  }}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  {(resultData?.columns || []).slice(1).map((c) => (
                    <option key={c.key} value={c.key}>
                      Sırala: {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {chartType === "bar" && (
                <div className="space-y-2.5">
                  {chartItems.slice(0, 12).map((item, i) => {
                    const pct = Math.max(3, Math.round(((Number(item.value) || 0) / maxChartVal) * 100));
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[65%]">
                            {item.label}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">{item.value}</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${bg}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {chartType === "line" && (
                <div className="w-full overflow-x-auto">
                  <svg viewBox="0 0 640 200" className="w-full h-48 overflow-visible">
                    {[0, 0.25, 0.5, 0.75, 1].map((g, gi) => (
                      <line
                        key={gi}
                        x1="20"
                        x2="620"
                        y1={20 + g * 145}
                        y2={20 + g * 145}
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-800"
                        strokeDasharray="3 3"
                      />
                    ))}
                    {chartItems.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className={text}
                        points={chartItems
                          .slice(0, 16)
                          .map((pt, idx, arr) => {
                            const x = 30 + (idx / Math.max(1, arr.length - 1)) * 580;
                            const y = 165 - ((Number(pt.value) || 0) / maxChartVal) * 140;
                            return `${x},${y}`;
                          })
                          .join(" ")}
                      />
                    )}
                    {chartItems.slice(0, 16).map((pt, idx, arr) => {
                      const x = arr.length === 1 ? 320 : 30 + (idx / Math.max(1, arr.length - 1)) * 580;
                      const y = 165 - ((Number(pt.value) || 0) / maxChartVal) * 140;
                      return (
                        <g key={idx}>
                          <circle cx={x} cy={y} r="4.5" className={`fill-current ${text}`} />
                          <text
                            x={x}
                            y={y - 9}
                            textAnchor="middle"
                            className="fill-slate-700 dark:fill-slate-200 text-[10px] font-bold"
                          >
                            {pt.value}
                          </text>
                          <text
                            x={x}
                            y={186}
                            textAnchor="middle"
                            className="fill-slate-400 text-[9px]"
                          >
                            {String(pt.label).slice(-8)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}

              {chartType === "pie" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {chartItems.slice(0, 10).map((item, i) => {
                    const share = totalChartSum > 0 ? ((Number(item.value) / totalChartSum) * 100).toFixed(1) : "0.0";
                    return (
                      <div
                        key={i}
                        className={`p-3 rounded-xl border ${borderLight} bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-between`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-bold text-slate-800 dark:text-white truncate">{item.label}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">Toplam Pay: %{share}</div>
                        </div>
                        <span className={`text-sm font-extrabold px-2.5 py-1 rounded-lg ${lightBg} ${lightText}`}>
                          {item.value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Veri Tablosu */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                Detaylı Rapor Tablosu ({resultData?.rows?.length || 0} Satır)
              </h4>
              <span className="text-xs text-slate-400">
                {startDate} — {endDate}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                    {(resultData?.columns || []).map((col) => (
                      <th key={col.key} className="px-4 py-3 font-bold whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {running ? (
                    <tr>
                      <td colSpan={(resultData?.columns || [1]).length} className="px-4 py-10 text-center text-slate-400">
                        <RefreshCw size={18} className="animate-spin inline mr-2" />
                        Veriler hesaplanıyor...
                      </td>
                    </tr>
                  ) : !resultData?.rows || resultData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={(resultData?.columns || [1]).length} className="px-4 py-10 text-center text-slate-400">
                        Seçilen tarih aralığı ve kriterlere uygun kayıt bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    resultData.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        {(resultData.columns || []).map((col, cIdx) => (
                          <td
                            key={col.key}
                            className={`px-4 py-2.5 whitespace-nowrap ${
                              cIdx === 0 ? "font-bold text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {row[col.key]}
                            {cIdx > 0 && col.unit === "%" ? "%" : ""}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Özel Rapor Kaydetme Modalı (Portal + GPU İzole Arkaplan) */}
      {isSaveModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm pointer-events-none"
              style={{ transform: "translateZ(0)" }}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Özel Raporu Kaydet</h3>
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSaveReport} className="p-5 space-y-4 overscroll-contain">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rapor Adı
                  </label>
                  <input
                    type="text"
                    required
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    placeholder="Örn: Haftalık VIP Satış Çağrı Analizi"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Açıklama / Not (İsteğe Bağlı)
                  </label>
                  <textarea
                    rows={2}
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                    placeholder="Bu raporun amacı..."
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSaveModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={savingReport}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold text-white ${bg} ${hover}`}
                  >
                    {savingReport ? "Kaydediliyor..." : "Raporu Kaydet"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Silme Onay Modalı */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteSavedReport}
        title="Özel Raporu Sil"
        message={
          deleteTarget
            ? `"${deleteTarget.title}" adlı kayıtlı özel raporu silmek istediğinize emin misiniz?`
            : ""
        }
        loading={deleting}
      />
    </div>
  );
}
