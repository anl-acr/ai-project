import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles,
  Plus,
  Play,
  Save,
  Copy,
  Download,
  FileSpreadsheet,
  Printer,
  Trash2,
  BarChart3,
  TrendingUp,
  PieChart,
  Table as TableIcon,
  Filter,
  FolderOpen,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Calendar,
  Clock,
  Sliders,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import * as XLSX from "xlsx";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";
import DictationButton from "../common/DictationButton";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";

const EXAMPLE_PROMPTS = [
  {
    label: "Temsilci Performansı & SLA",
    prompt: "Son 7 günde temsilci bazlı toplam çağrı, cevaplanan, kaçan çağrı, SLA % ve ortalama konuşma süresini sütun grafikle göster"
  },
  {
    label: "Kuyruk SLA & Terk Analizi",
    prompt: "Kuyruk bazlı toplam çağrı, terk edilen çağrı, terk oranı ve 20 sn SLA yüzdesini karşılaştır"
  },
  {
    label: "Mesai Saati Çağrı Trendi",
    prompt: "Son 7 günde mesai saatleri içinde (09:00-18:00) saatlik çağrı yoğunluğu ve cevaplanma oranını çizgi grafik yap"
  },
  {
    label: "Mola Süreleri",
    prompt: "Temsilcilerin toplam mola adedi ve mola sürelerini büyükten küçüğe listele"
  },
  {
    label: "Omnichannel Dağılımı",
    prompt: "Omnichannel kanallarına göre toplam sohbet ve AI karşılama oranlarını pasta dağılım olarak getir"
  },
  {
    label: "VoIP Ses Kalitesi",
    prompt: "VoIP ses kalitesi MOS skorlarını, paket kaybı ve RTT gecikme değerlerini dahili bazlı analiz et"
  },
  {
    label: "Kampanya & Otomatik Arama",
    prompt: "Kampanya bazlı toplam numara, aranan, ulaşılan ve isabet oranını sütun grafik olarak göster"
  },
  {
    label: "Randevu & Denetim",
    prompt: "Son 30 günde randevu durumlarına göre toplam randevu ve onay oranını pasta grafik olarak çıkar"
  }
];

const FILTER_OPS = [
  { value: "contains", label: "İçerir" },
  { value: "eq", label: "Eşittir (=)" },
  { value: "neq", label: "Eşit Değildir (≠)" },
  { value: "gt", label: "Büyüktür (>)" },
  { value: "gte", label: "Büyük Eşit (≥)" },
  { value: "lt", label: "Küçüktür (<)" },
  { value: "lte", label: "Küçük Eşit (≤)" }
];

const DONUT_PALETTE = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#8b5cf6",
  "#f43f5e",
  "#14b8a6",
  "#eab308",
  "#64748b"
];

function formatLocalDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getTodayStr() {
  return formatLocalDate(new Date());
}

function getRelativeDateStr(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return formatLocalDate(d);
}

function formatErrDetail(detail, fallback = "İşlem sırasında bir hata oluştu.") {
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return (
      detail
        .map((item) => {
          if (typeof item === "string") return item;
          const loc = Array.isArray(item?.loc) ? item.loc.slice(1).join(".") : "";
          const msg = item?.msg || JSON.stringify(item);
          return loc ? `${loc}: ${msg}` : msg;
        })
        .join(" | ") || fallback
    );
  }
  if (typeof detail === "object") {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return String(detail);
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
    "sla_20s_pct",
    "total_talk_min",
    "avg_talk_sec"
  ]);
  const [filters, setFilters] = useState([]);
  const [filterLogic, setFilterLogic] = useState("and");
  const [chartType, setChartType] = useState("bar");
  const [chartMetric, setChartMetric] = useState("total_calls");
  const [sortBy, setSortBy] = useState("total_calls");
  const [sortDir, setSortDir] = useState("desc");

  // Date & Time filter state
  const [quickRange, setQuickRange] = useState("last_7_days");
  const [startDate, setStartDate] = useState(() => getRelativeDateStr(6));
  const [endDate, setEndDate] = useState(() => getTodayStr());
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");

  // AI Prompt state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Execution result state
  const [running, setRunning] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [toast, setToast] = useState(null);
  const [alertPopup, setAlertPopup] = useState(null);

  // Modals
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveAsCopy, setSaveAsCopy] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = (msg, type = "success", customTitle = null) => {
    if (type === "error") {
      setAlertPopup({
        title: customTitle || "Uyarı",
        msg
      });
      return;
    }
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
    let newStart = startDate;
    let newEnd = endDate;
    if (preset === "today") {
      newStart = today;
      newEnd = today;
    } else if (preset === "yesterday") {
      const y = getRelativeDateStr(1);
      newStart = y;
      newEnd = y;
    } else if (preset === "last_7_days") {
      newStart = getRelativeDateStr(6);
      newEnd = today;
    } else if (preset === "last_30_days") {
      newStart = getRelativeDateStr(29);
      newEnd = today;
    }
    setStartDate(newStart);
    setEndDate(newEnd);
    runReportQuery(null, newStart, newEnd, startTime, endTime);
  };

  const toggleWorkHoursWindow = () => {
    const isWork = startTime === "09:00" && endTime === "18:00";
    const nextStart = isWork ? "00:00" : "09:00";
    const nextEnd = isWork ? "23:59" : "18:00";
    setStartTime(nextStart);
    setEndTime(nextEnd);
    runReportQuery(null, startDate, endDate, nextStart, nextEnd);
  };

  const handleDatasetChange = (newDsId) => {
    setDatasetId(newDsId);
    const ds = datasets.find((d) => d.id === newDsId);
    if (ds) {
      const nextGroup = ds.default_group_by || ds.dimensions?.[0]?.id || "date";
      const defM = Array.isArray(ds.default_metrics) ? ds.default_metrics : [];
      const firstM = defM[0] || "group_key";
      setGroupBy(nextGroup);
      setSelectedMetrics(defM);
      setChartMetric(defM[0] || "");
      setSortBy(firstM);
      setSortDir("desc");
      setFilters([]);
      setFilterLogic("and");
    }
  };

  const toggleMetric = (mId) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(mId)) {
        if (prev.length === 1) return prev;
        const next = prev.filter((x) => x !== mId);
        if (chartMetric === mId) setChartMetric(next[0] || "");
        if (sortBy === mId) setSortBy(next[0] || "group_key");
        return next;
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

  const buildCurrentDefinition = (overrides = {}) => ({
    title: reportTitle,
    description: reportDesc,
    dataset: datasetId,
    group_by: groupBy,
    metrics: selectedMetrics,
    filters: filters.filter((f) => String(f.value || "").trim() !== ""),
    filter_logic: filterLogic,
    chart_type: chartType,
    chart_metric: selectedMetrics.includes(chartMetric) ? chartMetric : selectedMetrics[0],
    sort_by: sortBy,
    sort_dir: sortDir,
    start_time: startTime,
    end_time: endTime,
    limit: 200,
    ...overrides
  });

  const runReportQuery = async (
    overrideDef = null,
    overrideStart = null,
    overrideEnd = null,
    overrideStartTime = null,
    overrideEndTime = null
  ) => {
    setRunning(true);
    try {
      const defToRun = overrideDef || buildCurrentDefinition();
      const sTime = overrideStartTime || defToRun.start_time || startTime || "00:00";
      const eTime = overrideEndTime || defToRun.end_time || endTime || "23:59";
      const res = await tenantFetch(`${API_BASE}/api/reports/custom/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          definition: defToRun,
          start_date: overrideStart || startDate,
          end_date: overrideEnd || endDate,
          start_time: sTime,
          end_time: eTime
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatErrDetail(data?.detail, "Rapor sorgusu çalıştırılamadı."));
      setResultData(data);
    } catch (err) {
      showToast(err.message || "Rapor çalıştırılırken hata oluştu.", "error", "Rapor Hatası");
    } finally {
      setRunning(false);
    }
  };

  const handleAiGenerate = async (customPromptText = null) => {
    const finalPrompt = String(customPromptText !== null ? customPromptText : aiPrompt).trim();
    if (!finalPrompt) {
      showToast("Lütfen AI için bir rapor tarifi yazın veya mikrofonla dikte edin.", "error", "Rapor Tarifi Eksik");
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
          end_date: endDate,
          start_time: startTime,
          end_time: endTime
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatErrDetail(data?.detail, "AI rapor üretemedi."));

      const def = data.definition || {};
      const nextMetrics = Array.isArray(def.metrics) && def.metrics.length > 0 ? def.metrics : ["total_calls"];
      setActiveSavedId("");
      setReportTitle(def.title || "AI Özel Raporu");
      setReportDesc(finalPrompt);
      setDatasetId(def.dataset || "calls");
      setGroupBy(def.group_by || "agent");
      setSelectedMetrics(nextMetrics);
      setFilters(Array.isArray(def.filters) ? def.filters : []);
      setFilterLogic(def.filter_logic || "and");
      setChartType(def.chart_type || "bar");
      setChartMetric(def.chart_metric || nextMetrics[0]);
      setSortBy(def.sort_by || nextMetrics[0] || "group_key");
      setSortDir(def.sort_dir || "desc");

      if (data.applied_start_date && data.applied_end_date) {
        setStartDate(data.applied_start_date);
        setEndDate(data.applied_end_date);
        if (data.suggested_period) setQuickRange(data.suggested_period);
      }
      if (data.applied_start_time && data.applied_end_time) {
        setStartTime(data.applied_start_time);
        setEndTime(data.applied_end_time);
      }

      setResultData(data);
      showToast("AI özel raporunuzu oluşturdu.");
    } catch (err) {
      showToast(err.message || "Rapor oluşturma hatası.", "error", "AI Rapor Hatası");
    } finally {
      setAiLoading(false);
    }
  };

  const handleResetNewReport = () => {
    setActiveSavedId("");
    setReportTitle("Yeni Özel Rapor");
    setReportDesc("");
    setAiPrompt("");
    setStartTime("00:00");
    setEndTime("23:59");
    handleDatasetChange("calls");
    setChartType("bar");
  };

  const handleLoadSavedReport = (rep) => {
    const def = rep.definition || {};
    const nextMetrics = Array.isArray(def.metrics) && def.metrics.length > 0 ? def.metrics : ["total_calls"];
    const nextStartT = def.start_time || "00:00";
    const nextEndT = def.end_time || "23:59";
    setActiveSavedId(rep.id);
    setReportTitle(rep.title || def.title || "Kayıtlı Rapor");
    setReportDesc(rep.description || def.description || "");
    setDatasetId(def.dataset || "calls");
    setGroupBy(def.group_by || "agent");
    setSelectedMetrics(nextMetrics);
    setFilters(Array.isArray(def.filters) ? def.filters : []);
    setFilterLogic(def.filter_logic || "and");
    setChartType(def.chart_type || "bar");
    setChartMetric(def.chart_metric || nextMetrics[0]);
    setSortBy(def.sort_by || nextMetrics[0] || "group_key");
    setSortDir(def.sort_dir || "desc");
    setStartTime(nextStartT);
    setEndTime(nextEndT);
    runReportQuery(def, startDate, endDate, nextStartT, nextEndT);
  };

  const handleColumnSort = (colKey) => {
    const nextDir = sortBy === colKey ? (sortDir === "desc" ? "asc" : "desc") : colKey === "group_key" ? "asc" : "desc";
    setSortBy(colKey);
    setSortDir(nextDir);
    runReportQuery(buildCurrentDefinition({ sort_by: colKey, sort_dir: nextDir }));
  };

  const openSaveModal = (asCopy = false) => {
    setSaveAsCopy(asCopy);
    if (asCopy && reportTitle && !reportTitle.endsWith("(Kopya)")) {
      setReportTitle(`${reportTitle} (Kopya)`);
    }
    setIsSaveModalOpen(true);
  };

  const handleSaveReport = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setSavingReport(true);
    try {
      const def = buildCurrentDefinition();
      const targetId = saveAsCopy ? undefined : activeSavedId || undefined;
      const res = await tenantFetch(`${API_BASE}/api/reports/custom/saved`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetId,
          title: reportTitle.trim() || "Özel Raporum",
          description: reportDesc.trim(),
          definition: def
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatErrDetail(data?.detail, "Rapor kaydedilemedi."));
      setActiveSavedId(data.report?.id || "");
      setIsSaveModalOpen(false);
      setSaveAsCopy(false);
      await loadInitialData();
      showToast("Özel rapor kaydedildi. Zamanlanmış Raporlar içinde de seçilebilir!");
    } catch (err) {
      showToast(err.message || "Kaydetme hatası.", "error", "Kaydetme Hatası");
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
      showToast(err.message || "Silme hatası.", "error", "Silme Hatası");
    } finally {
      setDeleting(false);
    }
  };

  const getSafeFilePrefix = () =>
    (reportTitle || "ozel_rapor")
      .toLowerCase()
      .replace(/[^a-z0-9ğüşıöç_-]+/gi, "_")
      .slice(0, 45);

  const handleExportExcel = () => {
    if (!resultData || !Array.isArray(resultData.rows) || resultData.rows.length === 0) {
      showToast("Dışa aktarılacak veri bulunamadı.", "error", "Veri Bulunamadı");
      return;
    }
    const wb = XLSX.utils.book_new();
    const cols = resultData.columns || [];

    const summaryRows = [
      { Bilgi: "Rapor Başlığı", Değer: reportTitle },
      { Bilgi: "Tarih Aralığı", Değer: `${startDate} ${startTime} - ${endDate} ${endTime}` },
      ...(resultData.summary_cards || []).map((c) => ({
        Bilgi: c.label,
        Değer: `${c.value}${c.unit ? " " + c.unit : ""}`
      }))
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Ozet_KPI");

    const allRows = [...resultData.rows];
    if (resultData.totals_row) allRows.push(resultData.totals_row);

    const detailRows = allRows.map((r) => {
      const obj = {};
      cols.forEach((col) => {
        obj[col.label] = r[col.key];
      });
      return obj;
    });
    const wsData = XLSX.utils.json_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(wb, wsData, "Rapor_Verisi");

    XLSX.writeFile(wb, `${getSafeFilePrefix()}_${startDate}_${endDate}.xlsx`);
  };

  const handleExportCsv = () => {
    if (!resultData || !Array.isArray(resultData.rows) || resultData.rows.length === 0) {
      showToast("Dışa aktarılacak veri bulunamadı.", "error", "Veri Bulunamadı");
      return;
    }
    const cols = resultData.columns || [];
    const escapeCell = (val) => {
      const s = String(val ?? "");
      if (s.includes(";") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const lines = [];
    lines.push(cols.map((c) => escapeCell(c.label)).join(";"));
    resultData.rows.forEach((r) => {
      lines.push(cols.map((c) => escapeCell(r[c.key])).join(";"));
    });
    if (resultData.totals_row) {
      lines.push(cols.map((c) => escapeCell(resultData.totals_row[c.key])).join(";"));
    }
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${getSafeFilePrefix()}_${startDate}_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintReport = () => {
    if (!resultData || !Array.isArray(resultData.rows) || resultData.rows.length === 0) {
      showToast("Yazdırılacak rapor verisi bulunamadı.", "error", "Veri Bulunamadı");
      return;
    }
    const cols = resultData.columns || [];
    const esc = (v) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const cardsHtml = (resultData.summary_cards || [])
      .map(
        (c) =>
          `<div style="border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;flex:1;min-width:140px;">
            <div style="font-size:11px;color:#64748b;font-weight:600;">${esc(c.label)}</div>
            <div style="font-size:18px;font-weight:800;color:#0f172a;margin-top:4px;">${esc(c.value)} ${esc(c.unit || "")}</div>
          </div>`
      )
      .join("");

    const theadHtml = cols
      .map((c) => `<th style="padding:8px 10px;border:1px solid #cbd5e1;background:#f8fafc;text-align:left;">${esc(c.label)}</th>`)
      .join("");

    const tbodyHtml = resultData.rows
      .map(
        (r) =>
          `<tr>${cols
            .map(
              (c, idx) =>
                `<td style="padding:7px 10px;border:1px solid #e2e8f0;${idx === 0 ? "font-weight:700;" : ""}">${esc(
                  r[c.key]
                )}${idx > 0 && c.unit === "%" ? "%" : ""}</td>`
            )
            .join("")}</tr>`
      )
      .join("");

    const tfootHtml = resultData.totals_row
      ? `<tfoot><tr>${cols
          .map(
            (c, idx) =>
              `<td style="padding:8px 10px;border:1px solid #cbd5e1;background:#f1f5f9;font-weight:800;">${esc(
                resultData.totals_row[c.key]
              )}${idx > 0 && c.unit === "%" ? "%" : ""}</td>`
          )
          .join("")}</tr></tfoot>`
      : "";

    const win = window.open("", "_blank", "width=1024,height=768");
    if (!win) {
      showToast("Tarayıcı açılır pencereyi engelledi. Lütfen izin verin.", "error");
      return;
    }
    win.document.write(`<!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>${esc(reportTitle)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 24px; color: #0f172a; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:16px;">
          <div>
            <h1 style="margin:0;font-size:20px;">${esc(reportTitle)}</h1>
            ${reportDesc ? `<p style="margin:4px 0 0;font-size:12px;color:#475569;">${esc(reportDesc)}</p>` : ""}
          </div>
          <div style="text-align:right;font-size:12px;color:#475569;">
            <div><b>Dönem:</b> ${esc(startDate)} ${esc(startTime)} — ${esc(endDate)} ${esc(endTime)}</div>
            <div><b>Satır Sayısı:</b> ${resultData.rows.length}</div>
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px;">${cardsHtml}</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr>${theadHtml}</tr></thead>
          <tbody>${tbodyHtml}</tbody>
          ${tfootHtml}
        </table>
        <script>window.onload = function() { setTimeout(function(){ window.print(); }, 250); };</script>
      </body>
      </html>`);
    win.document.close();
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
  const totalChartSum = chartItems.reduce((acc, x) => acc + Math.max(0, Number(x.value) || 0), 0);
  const donutCircumference = 2 * Math.PI * 56;
  let donutCumulativePct = 0;

  return (
    <div className="space-y-5">
      {/* Başarı Bildirimi (Sağ Üst - Web Telefon Balonu İle Çakışmaz) */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all bg-slate-900 dark:bg-slate-800 text-white border-slate-700">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Ortada Açılan Uyarı / Hata Popup Modalı */}
      {alertPopup &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center space-y-4 overscroll-contain"
            >
              <div className="mx-auto w-14 h-14 rounded-full bg-rose-500/10 dark:bg-rose-500/15 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center animate-pulse">
                  <AlertTriangle size={22} className="text-rose-500" />
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {alertPopup.title || "Uyarı"}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {alertPopup.msg}
                </p>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setAlertPopup(null)}
                  className={`min-w-[130px] px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all ${bg} ${hover}`}
                >
                  Tamam
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Üst Başlık & AI Rapor Komut Alanı */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${lightBg} ${text} border ${borderLight}`}>
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Özel Rapor Tasarımcısı
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                9 veri kaynağı (Çağrı, Kuyruk, Mola, Omnichannel, Anket, VoIP, Kampanya, Randevu, Denetim) üzerinde doğal dille veya görsel parametrelerle özel rapor üretin.
              </p>
            </div>
          </div>

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

        {canWrite && (
          <div className="space-y-2.5">
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
                  placeholder="Oluşturmak istediğiniz raporu yazın veya dikte edin (Örn: Son 7 günde kuyruk bazlı 20 sn SLA ve terk oranlarını göster)..."
                  className={`w-full pl-3.5 pr-12 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
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
                {aiLoading ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
                <span>{aiLoading ? "Hazırlanıyor..." : "Rapor Üret"}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {EXAMPLE_PROMPTS.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setAiPrompt(ex.prompt);
                    handleAiGenerate(ex.prompt);
                  }}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                  title={ex.prompt}
                >
                  {ex.label}
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders size={16} className={text} />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Rapor Ayarları</h3>
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
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Veri Kaynağı</label>
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
                Gruplama Kırılımı
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
                  Metrikler ({selectedMetrics.length})
                </label>
                {currentDatasetMeta?.metrics?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = currentDatasetMeta.metrics.map((m) => m.id);
                      if (selectedMetrics.length === allIds.length) {
                        const defM = currentDatasetMeta.default_metrics || [allIds[0]];
                        setSelectedMetrics(defM);
                      } else {
                        setSelectedMetrics(allIds);
                      }
                    }}
                    className={`text-[11px] font-semibold ${text} hover:underline`}
                  >
                    {selectedMetrics.length === (currentDatasetMeta?.metrics?.length || 0) ? "Varsayılan" : "Tümünü Seç"}
                  </button>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/40">
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
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Filter size={12} /> Filtreler
                  </label>
                  {filters.length > 1 && (
                    <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setFilterLogic("and")}
                        className={`px-1.5 py-0.5 rounded-md transition-colors ${
                          filterLogic === "and" ? `${bg} text-white` : "text-slate-500"
                        }`}
                      >
                        VE
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterLogic("or")}
                        className={`px-1.5 py-0.5 rounded-md transition-colors ${
                          filterLogic === "or" ? `${bg} text-white` : "text-slate-500"
                        }`}
                      >
                        VEYA
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={addFilterRow}
                  className={`text-[11px] font-semibold ${text} hover:underline`}
                >
                  + Koşul Ekle
                </button>
              </div>

              {filters.length > 0 && (
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
                  Kayıtlı Raporlar ({savedReports.length})
                </h3>
              </div>
            </div>

            {savedReports.length === 0 ? (
              <div className="text-center py-5 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                Kayıtlı özel rapor bulunmuyor.
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

        {/* SAĞ KOLON: Tarih/Saat Aralığı, Görselleştirme, KPI Kartları ve Veri Tablosu */}
        <div className="xl:col-span-8 space-y-5">
          {/* Üst Araç Çubuğu: Tarih + Saat + Grafik Türü + Kaydet + Dışa Aktarım */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              {/* Hızlı Tarih Seçici */}
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
                    onClick={() => applyQuickRange(p.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      quickRange === p.id
                        ? `${bg} text-white`
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Görsel Tipi + Aksiyonlar */}
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  {[
                    { id: "bar", icon: BarChart3, title: "Sütun Grafik" },
                    { id: "line", icon: TrendingUp, title: "Çizgi Trend" },
                    { id: "pie", icon: PieChart, title: "Pasta / Donut Dağılım" },
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
                  <>
                    <button
                      type="button"
                      onClick={() => openSaveModal(false)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5"
                    >
                      <Save size={13} />
                      {activeSavedId ? "Güncelle" : "Kaydet"}
                    </button>
                    {activeSavedId && (
                      <button
                        type="button"
                        onClick={() => openSaveModal(true)}
                        title="Farklı Yeni Rapor Olarak Kopyala"
                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1"
                      >
                        <Copy size={13} />
                        Kopyala
                      </button>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={handleExportExcel}
                  title="Excel (.xlsx) Olarak İndir"
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow-sm"
                >
                  <FileSpreadsheet size={13} />
                  Excel
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  title="CSV (.csv) Olarak İndir"
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1"
                >
                  <Download size={13} />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={handlePrintReport}
                  title="Yazdır veya PDF Olarak Kaydet"
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1"
                >
                  <Printer size={13} />
                  PDF / Yazdır
                </button>
              </div>
            </div>

            {/* Alt Satır: Özel Tarih ve Saat Aralığı */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <Calendar size={13} className="text-slate-400" />
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
              </div>

              <div className="flex items-center gap-1.5">
                <Clock size={13} className="text-slate-400 ml-1" />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value || "00:00")}
                  className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white"
                />
                <span className="text-xs text-slate-400">—</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value || "23:59")}
                  className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={toggleWorkHoursWindow}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                    startTime === "09:00" && endTime === "18:00"
                      ? `${lightBg} ${lightText} ${borderLight}`
                      : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {startTime === "09:00" && endTime === "18:00" ? "Mesai (09-18) ✓" : "Mesai (09-18)"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => runReportQuery()}
                className="ml-auto px-3 py-1 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-700 text-white hover:opacity-90"
              >
                Tarih / Saat Uygula
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
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{reportTitle}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Görselleştirilen Metrik: <b>{resultData?.primary_metric_label}</b>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Grafik Metriği Seçici */}
                  <select
                    value={selectedMetrics.includes(chartMetric) ? chartMetric : selectedMetrics[0] || ""}
                    onChange={(e) => {
                      const nextCm = e.target.value;
                      setChartMetric(nextCm);
                      runReportQuery(buildCurrentDefinition({ chart_metric: nextCm }));
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                    title="Grafikte Çizilecek Metrik"
                  >
                    {(resultData?.columns || []).slice(1).map((c) => (
                      <option key={c.key} value={c.key}>
                        Grafik: {c.label}
                      </option>
                    ))}
                  </select>

                  {/* Sıralama Kolonu & Yönü */}
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      const nextSort = e.target.value;
                      setSortBy(nextSort);
                      runReportQuery(buildCurrentDefinition({ sort_by: nextSort }));
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    {(resultData?.columns || []).map((c) => (
                      <option key={c.key} value={c.key}>
                        Sırala: {c.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      const nextDir = sortDir === "desc" ? "asc" : "desc";
                      setSortDir(nextDir);
                      runReportQuery(buildCurrentDefinition({ sort_dir: nextDir }));
                    }}
                    title={sortDir === "desc" ? "Büyükten Küçüğe (Azalan)" : "Küçükten Büyüğe (Artan)"}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-1"
                  >
                    {sortDir === "desc" ? <ArrowDown size={13} /> : <ArrowUp size={13} />}
                    {sortDir === "desc" ? "Azalan" : "Artan"}
                  </button>
                </div>
              </div>

              {chartType === "bar" && (
                <div className="space-y-2.5">
                  {chartItems.slice(0, 14).map((item, i) => {
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
                          .slice(0, 18)
                          .map((pt, idx, arr) => {
                            const x = 30 + (idx / Math.max(1, arr.length - 1)) * 580;
                            const y = 165 - ((Number(pt.value) || 0) / maxChartVal) * 140;
                            return `${x},${y}`;
                          })
                          .join(" ")}
                      />
                    )}
                    {chartItems.slice(0, 18).map((pt, idx, arr) => {
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
                            {String(pt.label).slice(-10)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}

              {chartType === "pie" && (
                <div className="flex flex-col md:flex-row items-center gap-6">
                  {/* Gerçek SVG Donut Grafiği */}
                  <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                    <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                      <circle
                        cx="80"
                        cy="80"
                        r="56"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="22"
                        className="text-slate-100 dark:text-slate-800"
                      />
                      {totalChartSum > 0 &&
                        chartItems.slice(0, 10).map((item, idx) => {
                          const val = Math.max(0, Number(item.value) || 0);
                          const pct = val / totalChartSum;
                          const dash = pct * donutCircumference;
                          const offset = -donutCumulativePct * donutCircumference;
                          donutCumulativePct += pct;
                          return (
                            <circle
                              key={idx}
                              cx="80"
                              cy="80"
                              r="56"
                              fill="none"
                              stroke={DONUT_PALETTE[idx % DONUT_PALETTE.length]}
                              strokeWidth="22"
                              strokeDasharray={`${dash} ${donutCircumference}`}
                              strokeDashoffset={offset}
                            />
                          );
                        })}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Toplam</span>
                      <span className="text-base font-extrabold text-slate-900 dark:text-white truncate max-w-full">
                        {Math.round(totalChartSum * 100) / 100}
                      </span>
                    </div>
                  </div>

                  {/* Dağılım Kartları */}
                  <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {chartItems.slice(0, 10).map((item, i) => {
                      const val = Math.max(0, Number(item.value) || 0);
                      const share = totalChartSum > 0 ? ((val / totalChartSum) * 100).toFixed(1) : "0.0";
                      const swatch = DONUT_PALETTE[i % DONUT_PALETTE.length];
                      return (
                        <div
                          key={i}
                          className={`p-2.5 rounded-xl border ${borderLight} bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-between gap-2`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: swatch }}
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-800 dark:text-white truncate">{item.label}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">Pay: %{share}</div>
                            </div>
                          </div>
                          <span className={`text-xs font-extrabold px-2 py-1 rounded-lg shrink-0 ${lightBg} ${lightText}`}>
                            {item.value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Veri Tablosu */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                Detaylı Rapor Tablosu ({resultData?.rows?.length || 0} Satır)
              </h4>
              <span className="text-xs text-slate-400">
                {startDate} {startTime} — {endDate} {endTime}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                    {(resultData?.columns || []).map((col) => {
                      const isSorted = sortBy === col.key;
                      return (
                        <th
                          key={col.key}
                          onClick={() => handleColumnSort(col.key)}
                          title="Sıralamak için tıklayın"
                          className="px-4 py-3 font-bold whitespace-nowrap cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            {isSorted ? (
                              sortDir === "desc" ? (
                                <ArrowDown size={12} className={text} />
                              ) : (
                                <ArrowUp size={12} className={text} />
                              )
                            ) : (
                              <ArrowUpDown size={11} className="opacity-35" />
                            )}
                          </span>
                        </th>
                      );
                    })}
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
                {!running && resultData?.rows?.length > 0 && resultData?.totals_row && (
                  <tfoot>
                    <tr className="bg-slate-100/90 dark:bg-slate-800/80 border-t-2 border-slate-200 dark:border-slate-700 font-extrabold text-slate-900 dark:text-white">
                      {(resultData.columns || []).map((col, cIdx) => (
                        <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                          {resultData.totals_row[col.key]}
                          {cIdx > 0 && col.unit === "%" ? "%" : ""}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
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
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {saveAsCopy ? "Yeni Rapor Olarak Kopyala" : activeSavedId ? "Özel Raporu Güncelle" : "Özel Raporu Kaydet"}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsSaveModalOpen(false);
                    setSaveAsCopy(false);
                  }}
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
                    onClick={() => {
                      setIsSaveModalOpen(false);
                      setSaveAsCopy(false);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={savingReport}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold text-white ${bg} ${hover}`}
                  >
                    {savingReport ? "Kaydediliyor..." : saveAsCopy ? "Yeni Olarak Kaydet" : "Raporu Kaydet"}
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
