import React, { useState, useEffect, useRef } from "react";
import {
  Star,
  Users,
  Headphones,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Download,
  Search,
  Filter,
  Volume2,
  Play,
  Square,
  PhoneIncoming,
  Clock,
  Award,
  TrendingUp,
  Columns
} from "lucide-react";
import * as XLSX from "xlsx";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";

const SURVEY_REPORT_COLUMNS = {
  createdAt: { label: "Tarih / Saat", defaultVisible: true },
  queue: { label: "Kuyruk", defaultVisible: true },
  agent: { label: "Temsilci", defaultVisible: true },
  callerNumber: { label: "Arayan Numara", defaultVisible: true },
  score: { label: "Müşteri Puanı", defaultVisible: true },
  status: { label: "Durum", defaultVisible: true },
  audio: { label: "Ses Kaydı", defaultVisible: true }
};

export default function QueueSurveyReportPanel({ backendHost }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const API_BASE = getApiBaseUrl(backendHost);

  const [loading, setLoading] = useState(true);
  const [isColumnsDropdownOpen, setIsColumnsDropdownOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const initial = {};
    Object.keys(SURVEY_REPORT_COLUMNS).forEach((k) => {
      initial[k] = SURVEY_REPORT_COLUMNS[k].defaultVisible;
    });
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("queue_survey_report_columns_v1");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object") {
            return { ...initial, ...parsed };
          }
        }
      } catch (e) {}
    }
    return initial;
  });

  const handleToggleColumn = (key) => {
    setVisibleColumns((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("queue_survey_report_columns_v1", JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });
  };
  const [reportData, setReportData] = useState({
    summary: {
      total_offered: 0,
      completed_responses: 0,
      timeout_count: 0,
      participation_rate: 0,
      avg_score: 0,
      csat_percent: 0,
      high_satisfaction_count: 0,
      high_satisfaction_rate: 0,
      low_score_count: 0,
      low_score_rate: 0,
      distribution: { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 }
    },
    by_queue: [],
    by_agent: [],
    items: [],
    queues: []
  });

  // Filters
  const [selectedQueue, setSelectedQueue] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [scoreFilter, setScoreFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Audio playback
  const [playingCallId, setPlayingCallId] = useState(null);
  const audioRef = useRef(null);

  const fetchSurveyReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedQueue) params.append("queue_ext", selectedQueue);
      if (selectedAgent) params.append("agent_ext", selectedAgent);
      if (scoreFilter) params.append("score_filter", scoreFilter);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);

      const res = await tenantFetch(`${API_BASE}/api/reports/queue-surveys?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReportData({
          summary: data.summary || reportData.summary,
          by_queue: Array.isArray(data.by_queue) ? data.by_queue : [],
          by_agent: Array.isArray(data.by_agent) ? data.by_agent : [],
          items: Array.isArray(data.items) ? data.items : [],
          queues: Array.isArray(data.queues) ? data.queues : []
        });
      }
    } catch (err) {
      console.error("Anket raporu alınamadı:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSurveyReport();
  }, [selectedQueue, selectedAgent, scoreFilter, startDate, endDate]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleToggleAudio = (item) => {
    if (!item.audio_url && !item.call_id) return;
    if (playingCallId === item.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingCallId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const src = item.audio_url?.startsWith("http")
      ? item.audio_url
      : `${API_BASE}${item.audio_url || `/api/calls/${item.call_id}/audio`}`;
    const audio = new Audio(src);
    audio.onended = () => setPlayingCallId(null);
    audio.onerror = () => setPlayingCallId(null);
    audio.play().catch(() => setPlayingCallId(null));
    audioRef.current = audio;
    setPlayingCallId(item.id);
  };

  const filteredItems = (reportData.items || []).filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(item.caller_number || "").toLowerCase().includes(q) ||
      String(item.agent_name || "").toLowerCase().includes(q) ||
      String(item.agent_extension || "").toLowerCase().includes(q) ||
      String(item.queue_name || "").toLowerCase().includes(q) ||
      String(item.queue_extension || "").toLowerCase().includes(q)
    );
  });

  const formatDateDMY = (dateStr) => {
    if (!dateStr) return "-";
    const raw = String(dateStr).trim();
    const isoDateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDateOnly) {
      return `${isoDateOnly[3]}.${isoDateOnly[2]}.${isoDateOnly[1]}`;
    }
    let cleanDateStr = raw;
    if (!raw.endsWith("Z") && !raw.includes("+") && !raw.includes("GMT") && raw.includes("T")) {
      cleanDateStr = raw + "Z";
    }
    const d = new Date(cleanDateStr);
    if (isNaN(d.getTime())) return raw;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const sec = String(d.getSeconds()).padStart(2, "0");
    return `${dd}.${mm}.${yyyy} ${hh}:${min}:${sec}`;
  };

  const handleExportExcel = () => {
    const rows = filteredItems.map((it) => {
      const qBreakdown = Array.isArray(it.question_answers) && it.question_answers.length > 0
        ? it.question_answers.map((qa, idx) => `${qa.question_text || `Soru ${idx + 1}`}: ${qa.score ?? "Yanıtsız"}`).join(" | ")
        : "-";
      return {
        "Tarih / Saat": it.created_at ? formatDateDMY(it.created_at) : "-",
        "Kuyruk No": it.queue_extension || "-",
        "Kuyruk Adı": it.queue_name || "-",
        "Temsilci Dahili": it.agent_extension || "-",
        "Temsilci Adı": it.agent_name || "-",
        "Arayan Numara": it.caller_number || "-",
        "Ortalama Puan": it.score !== null && it.score !== undefined ? `${it.score} / ${it.max_score || 5}` : "Yanıtsız",
        "Soru Bazlı Yanıtlar": qBreakdown,
        "Durum":
          it.status === "completed"
            ? "Tamamlandı"
            : it.status === "timeout"
            ? "Zaman Aşımı"
            : "Geçersiz Tuşlama",
        "Kritik Düşük Puan": it.is_low_score ? "EVET (Kritik)" : "Hayır",
        "Görüşme Süresi (Sn)": it.call_duration || 0
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Anket_Raporu");
    XLSX.writeFile(wb, `ACD_Kuyruk_Anket_Raporu_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const renderStars = (score, maxScore = 5, questionAnswers = []) => {
    if (score === null || score === undefined) {
      return <span className="text-[11px] font-semibold text-slate-400 italic">Tuşlama Yok</span>;
    }
    const normalizedStars = maxScore === 10 ? Math.round(score / 2) : maxScore === 2 ? (score === 2 ? 5 : 1) : score;
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((st) => (
              <Star
                key={st}
                size={13}
                className={
                  st <= normalizedStars
                    ? "text-amber-400 fill-amber-400"
                    : "text-slate-300 dark:text-slate-700"
                }
              />
            ))}
          </div>
          <span
            className={
              "ml-1.5 px-2 py-0.5 rounded-md text-[10px] font-black " +
              (score <= 2
                ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50"
                : score >= 4
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50")
            }
          >
            {score} / {maxScore}
          </span>
        </div>
        {Array.isArray(questionAnswers) && questionAnswers.length > 1 && (
          <div className="flex flex-wrap items-center gap-1">
            {questionAnswers.map((qa, qIdx) => (
              <span
                key={qIdx}
                title={qa.question_text || `${qIdx + 1}. Soru`}
                className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700"
              >
                S{qa.question_index || qIdx + 1}: {qa.score !== null && qa.score !== undefined ? `${qa.score}★` : "-"}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  const { summary } = reportData;
  const dist = summary?.distribution || { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 };
  const totalCompleted = summary?.completed_responses || 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Üst Başlık ve Filtre Barı */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={"p-3 rounded-2xl " + lightBg + " " + text}>
              <Star size={22} className="fill-current" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-wide flex items-center gap-2">
                ACD Kuyruk Memnuniyet Anketi Raporları (CSAT)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Çağrı sonu tuşlamalı müşteri memnuniyet anketi sonuçları, kuyruk ortalamaları ve temsilci puan sıralaması
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Sütun Seçici (Column Visibility Dropdown) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsColumnsDropdownOpen(!isColumnsDropdownOpen)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-all cursor-pointer"
                title="Tablo Sütunlarını Seç"
              >
                <Columns size={14} className={text} />
                <span>Sütunlar</span>
              </button>

              {isColumnsDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsColumnsDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl p-2 z-20 space-y-1 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                    <p className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 py-1">
                      Görünür Sütunlar
                    </p>
                    {Object.entries(SURVEY_REPORT_COLUMNS).map(([key, col]) => (
                      <label
                        key={key}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
                      >
                        <input
                          type="checkbox"
                          checked={!!visibleColumns[key]}
                          onChange={() => handleToggleColumn(key)}
                          className="rounded border-slate-300 text-primary focus:ring-purple-500 h-3.5 w-3.5 cursor-pointer"
                        />
                        <span>{col.label}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={fetchSurveyReport}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-all"
              title="Verileri Yenile"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Yenile
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className={"px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-2 transition-all " + bg + " " + hover}
              title="Excel Raporu İndir"
            >
              <Download size={14} />
              Excel İndir
            </button>
          </div>
        </div>

        {/* Filtre Alanları */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/60">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Kuyruk Filtresi
            </label>
            <select
              value={selectedQueue}
              onChange={(e) => setSelectedQueue(e.target.value)}
              className={"w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 " + ring}
            >
              <option value="">Tüm Kuyruklar</option>
              {(reportData.queues || []).map((q) => (
                <option key={q.extension} value={q.extension}>
                  {q.name} ({q.extension})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Temsilci Filtresi
            </label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className={"w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 " + ring}
            >
              <option value="">Tüm Temsilciler</option>
              {(reportData.by_agent || []).map((ag) => (
                <option key={ag.agent_extension} value={ag.agent_extension}>
                  {ag.agent_name} ({ag.agent_extension})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Puan / Durum Filtresi
            </label>
            <select
              value={scoreFilter}
              onChange={(e) => setScoreFilter(e.target.value)}
              className={"w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 " + ring}
            >
              <option value="">Tüm Yanıtlar</option>
              <option value="high">⭐ Yüksek Memnuniyet (4-5 Puan)</option>
              <option value="low">🚨 Düşük / Kritik Puan (1-2 Puan)</option>
              <option value="5">⭐⭐⭐⭐⭐ Sadece 5 Yıldız</option>
              <option value="4">⭐⭐⭐⭐ Sadece 4 Yıldız</option>
              <option value="3">⭐⭐⭐ Sadece 3 Yıldız</option>
              <option value="2">⭐⭐ Sadece 2 Yıldız</option>
              <option value="1">⭐ Sadece 1 Yıldız</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Başlangıç Tarihi
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={"w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 " + ring}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Hızlı Arama
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Numara, temsilci, kuyruk..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={"w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 " + ring}
              />
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* 4 Özet KPI Kartı */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Ortalama Memnuniyet Puanı */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Ortalama Memnuniyet (CSAT)
            </p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-black text-slate-800 dark:text-white">
                {Number(summary?.avg_score || 0).toFixed(2)}
              </span>
              <span className="text-xs font-bold text-slate-400">/ 5.0</span>
            </div>
            <div className="flex items-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((st) => (
                <Star
                  key={st}
                  size={12}
                  className={
                    st <= Math.round(summary?.avg_score || 0)
                      ? "text-amber-400 fill-amber-400"
                      : "text-slate-300 dark:text-slate-700"
                  }
                />
              ))}
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 ml-1">
                %{summary?.csat_percent || 0} Skor
              </span>
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-500">
            <Award size={24} />
          </div>
        </div>

        {/* 2. Ankete Katılım Oranı */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Ankete Katılım Oranı
            </p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-black text-slate-800 dark:text-white">
                %{summary?.participation_rate || 0}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-medium">
              <strong className="text-slate-700 dark:text-slate-200">{summary?.completed_responses || 0}</strong> yanıt /{" "}
              {summary?.total_offered || 0} sunulan anket
            </p>
          </div>
          <div className={"p-3.5 rounded-2xl " + lightBg + " " + text}>
            <TrendingUp size={24} />
          </div>
        </div>

        {/* 3. Yüksek Memnuniyet (4-5 Yıldız) */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Yüksek Memnuniyet (4-5★)
            </p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {summary?.high_satisfaction_count || 0}
              </span>
              <span className="text-xs font-bold text-emerald-600/80 dark:text-emerald-400/80">
                (%{summary?.high_satisfaction_rate || 0})
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-medium">
              4 ve 5 puan veren mutlu müşteriler
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500">
            <CheckCircle2 size={24} />
          </div>
        </div>

        {/* 4. Düşük Puan / Kritik Uyarı (1-2 Yıldız) */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Düşük Puan / Kritik (1-2★)
            </p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {summary?.low_score_count || 0}
              </span>
              <span className="text-xs font-bold text-rose-600/80 dark:text-rose-400/80">
                (%{summary?.low_score_rate || 0})
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-medium">
              İnceleme gerektiren düşük puanlı çağrılar
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-500">
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      {/* Orta Analiz Bölümü: Puan Dağılımı + Kuyruk Bazlı + Temsilci Bazlı */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 1. Puan Dağılım Grafiği */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-4">
              <Star size={15} className="text-amber-500 fill-amber-500" />
              Puan Dağılım Analizi (1 - 5 Yıldız)
            </h3>
            <div className="space-y-3.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = dist[String(star)] || 0;
                const pct = totalCompleted > 0 ? Math.round((count / totalCompleted) * 100) : 0;
                const barColor =
                  star >= 4
                    ? "bg-emerald-500"
                    : star === 3
                    ? "bg-amber-400"
                    : "bg-rose-500";
                return (
                  <div key={star} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        {star} <Star size={11} className="text-amber-400 fill-amber-400" />
                      </span>
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {count} Oy (%{pct})
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
            <span>Zaman Aşımı (Tuşlama Yapmayan):</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">{summary?.timeout_count || 0} Çağrı</span>
          </div>
        </div>

        {/* 2. Kuyruk Bazlı Memnuniyet Tablosu */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col">
          <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <Headphones size={15} className={text} />
            Kuyruk Bazlı Memnuniyet Özeti
          </h3>
          <div className="overflow-y-auto max-h-60 space-y-2.5 pr-1">
            {(reportData.by_queue || []).length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">Kuyruk verisi bulunamadı.</div>
            ) : (
              reportData.by_queue.map((q) => (
                <div
                  key={q.queue_extension}
                  className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-white truncate">
                        {q.queue_name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">({q.queue_extension})</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {q.completed} yanıt / {q.total_offered} çağrı (%{q.participation_rate} katılım)
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1 text-xs font-black text-amber-500">
                      <Star size={12} className="fill-amber-400 text-amber-400" />
                      {Number(q.avg_score || 0).toFixed(2)}
                    </div>
                    {q.low_score_count > 0 && (
                      <span className="text-[9px] font-bold text-rose-500">
                        {q.low_score_count} düşük puan
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. Temsilci Memnuniyet Sıralaması */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col">
          <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <Users size={15} className={text} />
            Temsilci Memnuniyet Sıralaması
          </h3>
          <div className="overflow-y-auto max-h-60 space-y-2.5 pr-1">
            {(reportData.by_agent || []).length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">Henüz temsilci değerlendirmesi yok.</div>
            ) : (
              reportData.by_agent.map((ag, idx) => (
                <div
                  key={ag.agent_extension || idx}
                  className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={
                        "w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center shrink-0 " +
                        (idx === 0
                          ? "bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400"
                          : "bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400")
                      }
                    >
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                        {ag.agent_name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Dahili {ag.agent_extension} • {ag.completed} Değerlendirme
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1 text-xs font-black text-amber-500">
                      <Star size={12} className="fill-amber-400 text-amber-400" />
                      {Number(ag.avg_score || 0).toFixed(2)}
                    </div>
                    <p className="text-[9px] text-slate-400">
                      {ag.high_score_count} olumlu / {ag.low_score_count} kritik
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Detaylı Anket Çağrı Kayıtları Tablosu */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 px-5 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <PhoneIncoming size={15} className={text} />
            Detaylı Çağrı Sonu Anket Kayıtları ({filteredItems.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800/60 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-950/40">
                {visibleColumns.createdAt && <th className="py-3 px-4">Tarih / Saat</th>}
                {visibleColumns.queue && <th className="py-3 px-4">Kuyruk</th>}
                {visibleColumns.agent && <th className="py-3 px-4">Temsilci</th>}
                {visibleColumns.callerNumber && <th className="py-3 px-4">Arayan Numara</th>}
                {visibleColumns.score && <th className="py-3 px-4">Müşteri Puanı</th>}
                {visibleColumns.status && <th className="py-3 px-4">Durum</th>}
                {visibleColumns.audio && <th className="py-3 px-4 text-right">Ses Kaydı</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Anket verileri yükleniyor...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Seçilen filtrelere uygun memnuniyet anketi kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className={
                      "transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 " +
                      (item.is_low_score ? "bg-rose-50/20 dark:bg-rose-950/10" : "")
                    }
                  >
                    {visibleColumns.createdAt && (
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {item.created_at ? formatDateDMY(item.created_at) : "-"}
                      </td>
                    )}
                    {visibleColumns.queue && (
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 dark:text-white">{item.queue_name}</span>
                        <span className="ml-1.5 text-[10px] font-mono text-slate-400">({item.queue_extension})</span>
                      </td>
                    )}
                    {visibleColumns.agent && (
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{item.agent_name}</span>
                        {item.agent_extension && (
                          <span className="ml-1.5 text-[10px] font-mono text-slate-400">({item.agent_extension})</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.callerNumber && (
                      <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {item.caller_number || "-"}
                      </td>
                    )}
                    {visibleColumns.score && <td className="py-3 px-4">{renderStars(item.score, item.max_score || 5, item.question_answers)}</td>}
                    {visibleColumns.status && (
                      <td className="py-3 px-4">
                        {item.status === "completed" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={11} /> Yanıtlandı
                          </span>
                        ) : item.status === "timeout" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                            <Clock size={11} /> Tuşlama Yok
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-600">
                            Geçersiz Tuş
                          </span>
                        )}
                      </td>
                    )}
                    {visibleColumns.audio && (
                      <td className="py-3 px-4 text-right">
                        {item.call_id ? (
                          <button
                            type="button"
                            onClick={() => handleToggleAudio(item)}
                            className={
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all " +
                              (playingCallId === item.id
                                ? "bg-rose-600 text-white"
                                : lightBg + " " + text + " hover:opacity-80")
                            }
                            title="Görüşme Ses Kaydını Dinle"
                          >
                            {playingCallId === item.id ? <Square size={10} /> : <Play size={10} />}
                            {playingCallId === item.id ? "Durdur" : "Kaydı Dinle"}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
