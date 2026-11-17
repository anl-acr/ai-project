import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneForwarded,
  PhoneOff,
  Users,
  Bot,
  Clock,
  Activity,
  Headphones,
  Mic,
  Volume2,
  Search,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Sparkles,
  LayoutGrid,
  List,
  X,
  Send,
  GitBranch,
  Shield,
  PauseCircle,
  PlayCircle,
  UserCheck,
  Hash,
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { tenantFetch } from "../../utils/apiHost";

const STAGE_META = {
  ivr: {
    id: "ivr",
    label: "IVR / Karşılama Menüsünde",
    shortLabel: "IVR / Menüde",
    badgeCls:
      "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    dotCls: "bg-purple-500",
    borderCls: "border-l-4 border-l-purple-500",
    icon: GitBranch,
  },
  queue_waiting: {
    id: "queue_waiting",
    label: "Kuyrukta Bekliyor",
    shortLabel: "Kuyrukta",
    badgeCls:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dotCls: "bg-amber-500",
    borderCls: "border-l-4 border-l-amber-500",
    icon: Users,
  },
  ringing: {
    id: "ringing",
    label: "Abone / Temsilci Çalıyor",
    shortLabel: "Çalıyor",
    badgeCls:
      "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    dotCls: "bg-sky-500",
    borderCls: "border-l-4 border-l-sky-500",
    icon: PhoneCall,
  },
  dialing_outbound: {
    id: "dialing_outbound",
    label: "Dış Arama Çalıyor",
    shortLabel: "Dış Arama",
    badgeCls:
      "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    dotCls: "bg-blue-500",
    borderCls: "border-l-4 border-l-blue-500",
    icon: PhoneOutgoing,
  },
  ai_talking: {
    id: "ai_talking",
    label: "AI Asistan ile Görüşmede",
    shortLabel: "AI Görüşmesinde",
    badgeCls:
      "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    dotCls: "bg-indigo-500",
    borderCls: "border-l-4 border-l-indigo-500",
    icon: Bot,
  },
  agent_talking: {
    id: "agent_talking",
    label: "Temsilci ile Görüşmede",
    shortLabel: "Görüşmede",
    badgeCls:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dotCls: "bg-emerald-500",
    borderCls: "border-l-4 border-l-emerald-500",
    icon: Headphones,
  },
  conference: {
    id: "conference",
    label: "Konferans Odasında",
    shortLabel: "Konferansta",
    badgeCls:
      "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    dotCls: "bg-teal-500",
    borderCls: "border-l-4 border-l-teal-500",
    icon: Users,
  },
};

function formatDuration(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

function formatTimeOnly(isoStr) {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch (e) {
    return "-";
  }
}

export default function RealtimeCallMonitorPanel({
  backendHost = "localhost:8000",
  currentUser = null,
  userPermissions = ["*"],
}) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();

  const [calls, setCalls] = useState([]);
  const [summary, setSummary] = useState({
    total_active: 0,
    inbound: 0,
    outbound: 0,
    internal: 0,
    in_ivr: 0,
    in_queue: 0,
    ringing: 0,
    ai_talking: 0,
    agent_talking: 0,
    longest_wait_sec: 0,
    longest_talk_sec: 0,
  });
  const [transferTargets, setTransferTargets] = useState({
    extensions: [],
    queues: [],
  });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("pipeline"); // "pipeline" | "table"
  const [stageFilter, setStageFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Selected call for right-side live inspection & intervention drawer
  const [selectedCallId, setSelectedCallId] = useState(null);
  const [whisperText, setWhisperText] = useState("");
  const [transferTargetExt, setTransferTargetExt] = useState("");
  const [actionFeedback, setActionFeedback] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Custom Hangup Confirmation Modal state
  const [hangupConfirmCall, setHangupConfirmCall] = useState(null);

  // Local 1-second tick counter to smoothly advance durations between 2s API polls
  const [tickOffset, setTickOffset] = useState(0);
  const lastFetchTsRef = useRef(Date.now());

  const isAdmin =
    currentUser?.role === "admin" ||
    (Array.isArray(userPermissions) && userPermissions.includes("*"));
  const canIntervene =
    isAdmin ||
    !Array.isArray(userPermissions) ||
    userPermissions.includes("realtime_calls:write") ||
    userPermissions.includes("call_monitor:listen") ||
    userPermissions.includes("call_monitor:whisper") ||
    userPermissions.includes("call_monitor:barge") ||
    userPermissions.includes("supervisor:access");

  const fetchRealtimeCalls = useCallback(async (showSpinner = false) => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    if (showSpinner) setLoading(true);
    try {
      const res = await tenantFetch(`/api/calls/realtime-monitor`);
      if (res.ok) {
        const data = await res.json();
        setCalls(Array.isArray(data.calls) ? data.calls : []);
        if (data.summary) setSummary(data.summary);
        if (data.transfer_targets) setTransferTargets(data.transfer_targets);
        lastFetchTsRef.current = Date.now();
        setTickOffset(0);
      }
    } catch (e) {
      console.error("Realtime call monitor fetch error:", e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRealtimeCalls(true);
    const pollInterval = setInterval(() => {
      fetchRealtimeCalls(false);
    }, 2000);
    const tickInterval = setInterval(() => {
      const elapsedSec = Math.max(
        0,
        Math.floor((Date.now() - lastFetchTsRef.current) / 1000)
      );
      setTickOffset(elapsedSec);
    }, 1000);
    return () => {
      clearInterval(pollInterval);
      clearInterval(tickInterval);
    };
  }, [fetchRealtimeCalls]);

  const effectiveCalls = useMemo(() => {
    return calls.map((c) => {
      const addSec = tickOffset;
      const isTalking =
        c.stage === "agent_talking" ||
        c.stage === "ai_talking" ||
        c.stage === "conference";
      return {
        ...c,
        total_duration_sec: (c.total_duration_sec || 0) + addSec,
        talk_duration_sec: isTalking ? (c.talk_duration_sec || 0) + addSec : 0,
        stage_duration_sec: (c.stage_duration_sec || 0) + addSec,
      };
    });
  }, [calls, tickOffset]);

  const effectiveSummary = useMemo(() => {
    const hasActive = calls.length > 0;
    return {
      ...summary,
      longest_wait_sec:
        hasActive && summary.longest_wait_sec > 0
          ? summary.longest_wait_sec + tickOffset
          : 0,
      longest_talk_sec:
        hasActive && summary.longest_talk_sec > 0
          ? summary.longest_talk_sec + tickOffset
          : 0,
    };
  }, [summary, calls.length, tickOffset]);

  const filteredCalls = useMemo(() => {
    return effectiveCalls.filter((c) => {
      if (stageFilter !== "all") {
        if (stageFilter === "ringing" && !["ringing", "dialing_outbound"].includes(c.stage)) {
          return false;
        } else if (
          stageFilter === "agent_talking" &&
          !["agent_talking", "conference"].includes(c.stage)
        ) {
          return false;
        } else if (
          stageFilter !== "ringing" &&
          stageFilter !== "agent_talking" &&
          c.stage !== stageFilter
        ) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = [
          c.caller_number,
          c.caller_name,
          c.callee_number,
          c.trunk_name,
          c.stage_label,
          c.stage_detail,
          c.assigned_agent_ext,
          c.assigned_agent_name,
          c.queue_name,
          c.workflow_name,
          c.agent_topic,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [effectiveCalls, stageFilter, searchQuery]);

  const selectedCall = useMemo(() => {
    if (!selectedCallId) return null;
    return effectiveCalls.find((c) => c.id === selectedCallId) || null;
  }, [effectiveCalls, selectedCallId]);

  const showToast = (type, msg) => {
    setActionFeedback({ type, msg });
    setTimeout(() => {
      setActionFeedback((prev) => (prev?.msg === msg ? null : prev));
    }, 4000);
  };

  const handleSpyAction = async (callObj, mode = "listen") => {
    if (!callObj) return;
    setActionBusy(true);
    try {
      const supExt =
        currentUser?.extension ||
        localStorage.getItem("current_user_ext") ||
        "1000";
      const res = await tenantFetch(`/api/calls/${encodeURIComponent(callObj.id)}/spy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: callObj.id,
          agent_ext: supExt,
          target_ext: callObj.assigned_agent_ext || callObj.callee_number || "",
          caller_number: callObj.caller_number || "",
          mode,
          user_id: currentUser?.id || supExt,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast("success", data.message || "Canlı dinleme/müdahale başlatıldı.");
      } else {
        showToast("error", data.detail || "Canlı müdahale başlatılamadı.");
      }
    } catch (e) {
      showToast("error", "Sunucu bağlantı hatası oluştu.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleSendWhisperText = async (e) => {
    e.preventDefault();
    if (!selectedCall || !whisperText.trim()) return;
    setActionBusy(true);
    try {
      const res = await tenantFetch(
        `/api/calls/${encodeURIComponent(selectedCall.id)}/whisper`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: whisperText.trim() }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast("success", data.message || "Sufle / Fısıldama başarıyla iletildi.");
        setWhisperText("");
        fetchRealtimeCalls(false);
      } else {
        showToast("error", data.detail || "Sufle gönderilemedi.");
      }
    } catch (e) {
      showToast("error", "Sufle gönderilirken hata oluştu.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleTransferCall = async (callObj, targetExt) => {
    const dest = String(targetExt || transferTargetExt || "").trim();
    if (!callObj || !dest) return;
    setActionBusy(true);
    try {
      const res = await tenantFetch(
        `/api/calls/${encodeURIComponent(callObj.id)}/transfer?extension=${encodeURIComponent(dest)}`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast("success", `Çağrı başarıyla ${dest} hedefine aktarıldı.`);
        setTransferTargetExt("");
        fetchRealtimeCalls(false);
      } else {
        showToast("error", data.detail || "Çağrı aktarılamadı.");
      }
    } catch (e) {
      showToast("error", "Çağrı aktarımı sırasında hata oluştu.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmHangup = async () => {
    if (!hangupConfirmCall) return;
    const targetCall = hangupConfirmCall;
    setHangupConfirmCall(null);

    setActionBusy(true);
    try {
      const res = await tenantFetch(
        `/api/calls/${encodeURIComponent(targetCall.id)}/hangup`,
        { method: "POST" }
      );
      if (res.ok) {
        showToast("success", "Çağrı başarıyla sonlandırıldı.");
        if (selectedCallId === targetCall.id) setSelectedCallId(null);
        fetchRealtimeCalls(false);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("error", data.detail || "Çağrı sonlandırılamadı.");
      }
    } catch (e) {
      showToast("error", "Çağrı sonlandırılırken hata oluştu.");
    } finally {
      setActionBusy(false);
    }
  };

  const renderDirectionBadge = (direction) => {
    if (direction === "outbound") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <PhoneOutgoing size={11} />
          Giden
        </span>
      );
    }
    if (direction === "internal") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/20">
          <PhoneForwarded size={11} />
          Dahili
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <PhoneIncoming size={11} />
        Gelen
      </span>
    );
  };

  return (
    <div className="w-full space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={`p-3 rounded-2xl ${lightBg} ${text} border ${borderLight} shrink-0`}>
            <Radio size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Gerçek Zamanlı Çağrı İzleme
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                CANLI AKIŞ
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Santrale gelen ve giden tüm aktif çağrıların anlık olarak hangi adımda (IVR, Kuyruk, AI veya Temsilci) olduğunu, konuşma sürelerini ve canlı diyalog akışını izleyin.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Numara, müşteri, dahili veya kuyruk ara..."
              className={`w-60 pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
            />
          </div>

          {/* View Mode Switcher */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode("pipeline")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === "pipeline"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
              }`}
            >
              <LayoutGrid size={13} />
              <span>Akış Kartları</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === "table"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
              }`}
            >
              <List size={13} />
              <span>Tablo</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchRealtimeCalls(true)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Şimdi Yenile"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between ${
            actionFeedback.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
              : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          <span>{actionFeedback.msg}</span>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="opacity-70 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 6 Live KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <button
          type="button"
          onClick={() => setStageFilter("all")}
          className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer ${
            stageFilter === "all"
              ? `bg-white dark:bg-slate-900 ${border} ring-2 ${ring}`
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Toplam Aktif Çağrı
            </span>
            <Activity size={15} className={text} />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5 tabular-nums">
            {effectiveSummary.total_active}
          </div>
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
            {effectiveSummary.inbound} Gelen • {effectiveSummary.outbound} Giden •{" "}
            {effectiveSummary.internal} Dahili
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStageFilter(stageFilter === "ivr" ? "all" : "ivr")}
          className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer ${
            stageFilter === "ivr"
              ? "bg-purple-50/60 dark:bg-purple-950/30 border-purple-500 ring-2 ring-purple-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-purple-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              IVR & Karşılamada
            </span>
            <GitBranch size={15} className="text-purple-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5 tabular-nums">
            {effectiveSummary.in_ivr}
          </div>
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Anons / Menü Tuşlamasında
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setStageFilter(stageFilter === "queue_waiting" ? "all" : "queue_waiting")
          }
          className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer ${
            stageFilter === "queue_waiting"
              ? "bg-amber-50/60 dark:bg-amber-950/30 border-amber-500 ring-2 ring-amber-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Kuyrukta Bekleyen
            </span>
            <Users size={15} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5 tabular-nums">
            {effectiveSummary.in_queue}
          </div>
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            En Uzun Bekleme: {formatDuration(effectiveSummary.longest_wait_sec)}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStageFilter(stageFilter === "ringing" ? "all" : "ringing")}
          className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer ${
            stageFilter === "ringing"
              ? "bg-sky-50/60 dark:bg-sky-950/30 border-sky-500 ring-2 ring-sky-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-sky-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Çalan / Bağlanan
            </span>
            <PhoneCall size={15} className="text-sky-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5 tabular-nums">
            {effectiveSummary.ringing}
          </div>
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Temsilci / Hedef Çalıyor
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setStageFilter(stageFilter === "ai_talking" ? "all" : "ai_talking")
          }
          className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer ${
            stageFilter === "ai_talking"
              ? "bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-500 ring-2 ring-indigo-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-indigo-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              AI ile Görüşmede
            </span>
            <Bot size={15} className="text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5 tabular-nums">
            {effectiveSummary.ai_talking}
          </div>
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Otonom Sesli AI Diyaloğu
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setStageFilter(stageFilter === "agent_talking" ? "all" : "agent_talking")
          }
          className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer ${
            stageFilter === "agent_talking"
              ? "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Temsilci Görüşmesinde
            </span>
            <Headphones size={15} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5 tabular-nums">
            {effectiveSummary.agent_talking}
          </div>
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            En Uzun Süre: {formatDuration(effectiveSummary.longest_talk_sec)}
          </div>
        </button>
      </div>

      {/* Empty State */}
      {filteredCalls.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-12 text-center shadow-sm">
          <div className={`w-14 h-14 mx-auto rounded-2xl ${lightBg} ${text} flex items-center justify-center mb-3`}>
            <PhoneCall size={26} />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">
            Şu Anda Aktif Çağrı Bulunmuyor
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Santrale yeni bir çağrı geldiğinde veya dış arama başlatıldığında; IVR adımı, kuyruk sırası, temsilci eşleşmesi ve konuşma süresi anlık olarak burada belirecektir.
          </p>
        </div>
      ) : viewMode === "pipeline" ? (
        /* PIPELINE / CARD FLOW VIEW */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredCalls.map((call) => {
            const stMeta = STAGE_META[call.stage] || STAGE_META.ringing;
            const StageIcon = stMeta.icon;
            const isTalking =
              call.stage === "agent_talking" ||
              call.stage === "ai_talking" ||
              call.stage === "conference";

            return (
              <div
                key={call.id}
                onClick={() => setSelectedCallId(call.id)}
                className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between gap-4 ${stMeta.borderCls} ${
                  selectedCallId === call.id ? `ring-2 ${ring}` : ""
                }`}
              >
                {/* Top Row: Caller Info + Stage Badge + Timers */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2.5 rounded-xl ${lightBg} ${text} shrink-0 mt-0.5`}>
                      <StageIcon size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {renderDirectionBadge(call.direction)}
                        <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                          {call.caller_number}
                        </span>
                        {call.caller_name && (
                          <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 truncate">
                            • {call.caller_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                        <span>
                          Hedef / Hat:{" "}
                          <strong className="font-mono text-slate-700 dark:text-slate-200">
                            {call.callee_number}
                          </strong>
                        </span>
                        {call.trunk_name && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                            {call.trunk_name}
                          </span>
                        )}
                        <span>• Giriş: {formatTimeOnly(call.start_time)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Live Stage Pill & Dual Timers */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${stMeta.badgeCls}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${stMeta.dotCls} animate-pulse`} />
                      {call.stage_label}
                    </span>
                    <div className="flex items-center gap-2 text-xs font-mono font-bold">
                      {isTalking ? (
                        <>
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 tabular-nums">
                            Görüşme: {formatDuration(call.talk_duration_sec)}
                          </span>
                          <span className="text-slate-400 text-[11px] tabular-nums">
                            Toplam: {formatDuration(call.total_duration_sec)}
                          </span>
                        </>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 tabular-nums">
                          Bekleme / Süre: {formatDuration(call.total_duration_sec)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle Row: Current Location / What the call is doing right now */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 shrink-0">
                        Anlık Konum:
                      </span>
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">
                        {call.stage_detail}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {call.agent_topic && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                          Konu: {call.agent_topic}
                        </span>
                      )}
                      {isTalking && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            call.recording_paused
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {call.recording_paused ? (
                            <>
                              <PauseCircle size={11} /> Kayıt Duraklatıldı
                            </>
                          ) : (
                            <>
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                              Kayıtta
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Step-by-Step Breadcrumb Journey */}
                  {Array.isArray(call.journey_steps) && call.journey_steps.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      {call.journey_steps.map((st, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && (
                            <ArrowRight size={11} className="text-slate-400 shrink-0" />
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-md whitespace-nowrap border ${
                              st.active
                                ? `${lightBg} ${text} ${borderLight} font-extrabold`
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
                            }`}
                          >
                            {st.title}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  {/* Live Transcript Preview if talking */}
                  {call.last_transcript && call.last_transcript.text && (
                    <div
                      data-no-translate="true"
                      className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2"
                    >
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 shrink-0">
                        {call.last_transcript.speaker === "customer"
                          ? "Müşteri"
                          : call.last_transcript.speaker === "ai"
                          ? "AI"
                          : "Temsilci"}
                      </span>
                      <span className="italic line-clamp-1">
                        &ldquo;{call.last_transcript.text}&rdquo;
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom Row: Supervisor Live Actions */}
                <div
                  className="flex items-center justify-between gap-2 pt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-[10px] font-mono text-slate-400 truncate">
                    Kanal: {call.channel}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {canIntervene && (
                      <>
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => handleSpyAction(call, "listen")}
                          className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                          title="Gizli Dinle (Spy)"
                        >
                          <Headphones size={12} />
                          <span>Dinle</span>
                        </button>
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => handleSpyAction(call, "whisper")}
                          className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1 transition-colors cursor-pointer"
                          title="Temsilciye Fısılda / Sufle Ver (Whisper)"
                        >
                          <Mic size={12} />
                          <span>Fısılda</span>
                        </button>
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => handleSpyAction(call, "barge")}
                          className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 flex items-center gap-1 transition-colors cursor-pointer"
                          title="Araya Gir / Konferansa Katıl (Barge)"
                        >
                          <Volume2 size={12} />
                          <span>Araya Gir</span>
                        </button>
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => setHangupConfirmCall(call)}
                          className="p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                          title="Çağrıyı Sonlandır"
                        >
                          <PhoneOff size={13} />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedCallId(call.id)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold text-white ${bg} ${hover} transition-colors cursor-pointer`}
                    >
                      Detay & Yolculuk
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* DETAILED TABLE VIEW */
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200/70 dark:border-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  <th className="p-4">Yön & Arayan</th>
                  <th className="p-4">Hedef / Hat</th>
                  <th className="p-4">Anlık Aşama</th>
                  <th className="p-4">Ne Yapıyor / Temsilci & Kuyruk</th>
                  <th className="p-4">Görüşme Süresi</th>
                  <th className="p-4">Toplam Süre</th>
                  <th className="p-4 text-right">Müdahale & İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredCalls.map((call) => {
                  const stMeta = STAGE_META[call.stage] || STAGE_META.ringing;
                  const isTalking =
                    call.stage === "agent_talking" ||
                    call.stage === "ai_talking" ||
                    call.stage === "conference";

                  return (
                    <tr
                      key={call.id}
                      onClick={() => setSelectedCallId(call.id)}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {renderDirectionBadge(call.direction)}
                          <div>
                            <div className="font-mono font-extrabold text-slate-900 dark:text-white">
                              {call.caller_number}
                            </div>
                            {call.caller_name && (
                              <div className="text-[11px] font-semibold text-slate-500">
                                {call.caller_name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-200">
                        <div>{call.callee_number}</div>
                        {call.trunk_name && (
                          <div className="text-[10px] font-sans text-slate-400">
                            {call.trunk_name}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${stMeta.badgeCls}`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${stMeta.dotCls} animate-pulse`}
                          />
                          {call.stage_label}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          {call.stage_detail}
                        </div>
                        {call.last_transcript?.text && (
                          <div
                            data-no-translate="true"
                            className="text-[11px] text-slate-500 italic truncate max-w-xs mt-0.5"
                          >
                            &ldquo;{call.last_transcript.text}&rdquo;
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-mono font-extrabold tabular-nums">
                        {isTalking ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {formatDuration(call.talk_duration_sec)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-4 font-mono font-extrabold text-slate-800 dark:text-slate-200 tabular-nums">
                        {formatDuration(call.total_duration_sec)}
                      </td>
                      <td
                        className="p-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          {canIntervene && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSpyAction(call, "listen")}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                                title="Gizli Dinle"
                              >
                                Dinle
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSpyAction(call, "whisper")}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-[11px] font-bold text-amber-700 dark:text-amber-300 cursor-pointer"
                                title="Fısılda"
                              >
                                Fısılda
                              </button>
                              <button
                                type="button"
                                onClick={() => setHangupConfirmCall(call)}
                                className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 cursor-pointer"
                                title="Çağrıyı Sonlandır"
                              >
                                <PhoneOff size={13} />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedCallId(call.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-white ${bg} ${hover} cursor-pointer`}
                          >
                            İncele
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RIGHT-SIDE CALL JOURNEY & LIVE INTERVENTION DRAWER */}
      {selectedCall && (
        <div className="fixed inset-0 z-[180] bg-slate-950/70 flex justify-end">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-950/40 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  {renderDirectionBadge(selectedCall.direction)}
                  <h3 className="text-sm font-black text-slate-900 dark:text-white font-mono">
                    {selectedCall.caller_number}
                  </h3>
                  {selectedCall.caller_name && (
                    <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
                      ({selectedCall.caller_name})
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Canlı Çağrı Yolculuğu, Süreler ve Anlık Müdahale Paneli
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCallId(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Scroll Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-6">
              {/* Live Timers & Current Stage Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">
                    Anlık Aşama
                  </div>
                  <div className="text-xs font-black text-slate-900 dark:text-white mt-1">
                    {selectedCall.stage_label}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">
                    Görüşme Süresi
                  </div>
                  <div className="text-base font-black font-mono text-emerald-700 dark:text-emerald-300 mt-0.5 tabular-nums">
                    {formatDuration(selectedCall.talk_duration_sec)}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[10px] font-extrabold uppercase text-slate-400">
                    Toplam Süre
                  </div>
                  <div className="text-base font-black font-mono text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {formatDuration(selectedCall.total_duration_sec)}
                  </div>
                </div>
              </div>

              {/* Supervisor Intervention Controls */}
              {canIntervene && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    Canlı Süpervizör Müdahalesi
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => handleSpyAction(selectedCall, "listen")}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-400 text-xs font-extrabold text-slate-800 dark:text-white flex flex-col items-center gap-1 cursor-pointer"
                    >
                      <Headphones size={15} className={text} />
                      <span>Gizli Dinle</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => handleSpyAction(selectedCall, "whisper")}
                      className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-extrabold text-amber-700 dark:text-amber-300 flex flex-col items-center gap-1 cursor-pointer"
                    >
                      <Mic size={15} />
                      <span>Sesli Fısılda</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => handleSpyAction(selectedCall, "barge")}
                      className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 flex flex-col items-center gap-1 cursor-pointer"
                    >
                      <Volume2 size={15} />
                      <span>Araya Gir</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => setHangupConfirmCall(selectedCall)}
                      className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-600 hover:text-white text-xs font-extrabold text-rose-600 dark:text-rose-400 flex flex-col items-center gap-1 cursor-pointer transition-colors"
                    >
                      <PhoneOff size={15} />
                      <span>Kapat</span>
                    </button>
                  </div>

                  {/* Quick Call Transfer / Redirect */}
                  <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center gap-2">
                    <select
                      value={transferTargetExt}
                      onChange={(e) => setTransferTargetExt(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                    >
                      <option value="">
                        -- Çağrıyı Başka Dahiliye / Kuyruğa Aktar --
                      </option>
                      {transferTargets.extensions?.length > 0 && (
                        <optgroup label="Temsilci Dahilileri">
                          {transferTargets.extensions.map((ext) => (
                            <option key={ext.extension} value={ext.extension}>
                              {ext.extension} - {ext.name}{" "}
                              {ext.online ? "(Çevrimiçi)" : ""}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {transferTargets.queues?.length > 0 && (
                        <optgroup label="ACD Çağrı Kuyrukları">
                          {transferTargets.queues.map((q) => (
                            <option key={q.extension} value={q.extension}>
                              Kuyruk {q.extension} - {q.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <button
                      type="button"
                      disabled={!transferTargetExt || actionBusy}
                      onClick={() =>
                        handleTransferCall(selectedCall, transferTargetExt)
                      }
                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold text-white ${bg} ${hover} disabled:opacity-50 cursor-pointer shrink-0`}
                    >
                      Aktar
                    </button>
                  </div>
                </div>
              )}

              {/* Step-by-Step Call Journey Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Adım Adım Çağrı Yolculuğu
                </h4>
                <div className="space-y-2.5 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                  {(selectedCall.journey_steps || []).map((step, sIdx) => (
                    <div
                      key={sIdx}
                      className="relative pl-9 flex items-start justify-between gap-3"
                    >
                      <span
                        className={`absolute left-1.5 top-1.5 w-4 h-4 rounded-full flex items-center justify-center border-2 ${
                          step.active
                            ? `${bg} border-white dark:border-slate-900 shadow-sm`
                            : "bg-slate-200 dark:bg-slate-800 border-white dark:border-slate-900"
                        }`}
                      />
                      <div
                        className={`flex-1 p-3 rounded-xl border ${
                          step.active
                            ? `${lightBg} ${borderLight}`
                            : "bg-slate-50/70 dark:bg-slate-950/60 border-slate-200/70 dark:border-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                            {step.title}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {formatTimeOnly(step.timestamp)}
                          </span>
                        </div>
                        <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                          {step.subtitle}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Transcript Stream & Written Whisper Input */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Canlı Konuşma Dökümü (Transkript)
                  </h4>
                  <span className="text-[10px] font-bold text-slate-400">
                    {selectedCall.transcripts?.length || 0} Mesaj
                  </span>
                </div>

                <div
                  data-no-translate="true"
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 max-h-64 overflow-y-auto space-y-2.5"
                >
                  {!selectedCall.transcripts ||
                  selectedCall.transcripts.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400">
                      Bu çağrı için henüz sesli diyalog metni oluşmadı.
                    </div>
                  ) : (
                    selectedCall.transcripts.map((tr, idx) => {
                      const isCust = tr.speaker === "customer";
                      const isWhisper = tr.speaker === "supervisor_whisper";
                      return (
                        <div
                          key={tr.id || idx}
                          className={`p-2.5 rounded-xl text-xs ${
                            isWhisper
                              ? "bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200"
                              : isCust
                              ? "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                              : `${lightBg} ${borderLight} border text-slate-900 dark:text-white`
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] font-extrabold mb-1 opacity-75">
                            <span>
                              {isWhisper
                                ? "Süpervizör Suflesi"
                                : isCust
                                ? "Müşteri"
                                : tr.speaker === "ai"
                                ? "AI Asistan"
                                : "Temsilci"}
                            </span>
                            <span className="font-mono">
                              {formatTimeOnly(tr.timestamp)}
                            </span>
                          </div>
                          <div>{tr.text}</div>
                        </div>
                      );
                    })
                  )}
                </div>

                {canIntervene && (
                  <form
                    onSubmit={handleSendWhisperText}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={whisperText}
                      onChange={(e) => setWhisperText(e.target.value)}
                      placeholder="AI veya temsilciye yazılı sufle / yönlendirme fısıldayın..."
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-800 dark:text-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!whisperText.trim() || actionBusy}
                      className={`px-4 py-2.5 rounded-xl text-xs font-extrabold text-white ${bg} ${hover} disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shrink-0`}
                    >
                      <Send size={13} />
                      <span>Fısılda</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Native Hangup Confirmation Modal */}
      {hangupConfirmCall && (
        <div className="fixed inset-0 z-[220] bg-slate-950/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Aktif Çağrıyı Sonlandır
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <strong className="font-mono text-slate-800 dark:text-slate-200">
                    {hangupConfirmCall.caller_number}
                  </strong>{" "}
                  numaralı aktif görüşmeyi kapatmak istediğinize emin misiniz?
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setHangupConfirmCall(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmHangup}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-sm cursor-pointer"
              >
                Sil / Çağrıyı Sonlandır
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
