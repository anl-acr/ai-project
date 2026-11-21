import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  GitCommit,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Calendar,
  ShieldCheck,
  Copy,
  Check,
  RefreshCw,
  Cpu,
  DownloadCloud,
  Lock,
  PhoneCall,
  Clock,
  RotateCcw,
  Terminal,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  X,
  Loader2,
  Radio
} from "lucide-react";
import { useTheme } from "../../utils/theme";

const UPDATE_STEPS = [
  { index: 1, label: "Ön Kontrol & Yedek" },
  { index: 2, label: "Sürüm İndirme" },
  { index: 3, label: "Bağımlılık Kontrolü" },
  { index: 4, label: "Asterisk Senkron" },
  { index: 5, label: "Arayüz Derleme" },
  { index: 6, label: "Yeniden Başlatma & Doğrulama" }
];

const CHANNEL_LABELS = {
  stable: { label: "Kararlı Kanal (Stable)", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  beta: { label: "Beta / Pilot Kanal", cls: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  pinned: { label: "Sabitlenmiş (Pinned)", cls: "bg-slate-600/30 text-slate-300 border-slate-500/40" }
};

export default function ChangelogPanel({ onBack, backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();

  const [versionData, setVersionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Central Update Check & Runtime Status
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateCheck, setUpdateCheck] = useState(null);
  const [runtimeStatus, setRuntimeStatus] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState(null); // { type: "success"|"error"|"info", text: string }

  // Custom Confirmation Modal (never browser confirm())
  const [confirmModal, setConfirmModal] = useState(null); // { kind: "update_now"|"update_after_calls"|"rollback", title, desc }

  const pollTimerRef = useRef(null);
  const logBoxRef = useRef(null);
  const API_BASE = typeof window !== "undefined" ? `${window.location.protocol}//${backendHost}` : "";

  const getAuthHeaders = useCallback(() => {
    const hdrs = { "Content-Type": "application/json" };
    if (typeof window !== "undefined") {
      try {
        const rawU = localStorage.getItem("aida_user") || sessionStorage.getItem("aida_user");
        if (rawU) {
          const parsed = JSON.parse(rawU);
          const uid = parsed?.id || parsed?.extension;
          if (uid) hdrs["X-User-ID"] = String(uid);
        }
      } catch (e) {}
    }
    return hdrs;
  }, []);

  const fetchVersionInfo = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/settings/version`)
      .then((res) => res.json())
      .then((data) => {
        setVersionData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[Changelog] Versiyon yüklenemedi:", err);
        setLoading(false);
      });
  }, [API_BASE]);

  const checkForUpdates = useCallback(
    async (silent = false) => {
      if (!silent) {
        setCheckingUpdate(true);
        setFeedbackBanner(null);
      }
      try {
        const res = await fetch(`${API_BASE}/api/system/update/check`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          setUpdateCheck(data);
          if (data?.runtime_status) {
            setRuntimeStatus(data.runtime_status);
          }
          if (!silent) {
            if (!data.reachable) {
              setFeedbackBanner({
                type: "error",
                text: data.error || "Merkez Güncelleme Sunucusuna ulaşılamadı."
              });
            } else if (data.update_available) {
              setFeedbackBanner({
                type: "info",
                text: `Yeni onaylı sürüm bulundu: ${data.latest_version} (${data.pending_releases?.length || 1} sürüm paketi).`
              });
            } else {
              setFeedbackBanner({
                type: "success",
                text: data.message || `Santraliniz (${data.current_version}) kanalındaki en güncel sürümde çalışıyor.`
              });
            }
          }
        }
      } catch (e) {
        if (!silent) {
          setFeedbackBanner({ type: "error", text: "Güncelleme sorgulaması sırasında bağlantı hatası oluştu." });
        }
      } finally {
        if (!silent) setCheckingUpdate(false);
      }
    },
    [API_BASE, getAuthHeaders]
  );

  const pollRuntimeStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/system/update/status`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) return;
      const data = await res.json();
      setRuntimeStatus(data);
      if (data.status === "success" || data.status === "rolled_back") {
        fetchVersionInfo();
      }
    } catch (e) {
      // Tolerate brief connection reset while pm2 restarts aida-backend
    }
  }, [API_BASE, getAuthHeaders, fetchVersionInfo]);

  useEffect(() => {
    fetchVersionInfo();
    checkForUpdates(true);
  }, [fetchVersionInfo, checkForUpdates]);

  const isUpdateActive =
    Boolean(runtimeStatus?.is_running) ||
    ["starting", "waiting_calls", "updating", "rolling_back"].includes(String(runtimeStatus?.status || ""));

  useEffect(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (isUpdateActive) {
      pollTimerRef.current = setInterval(pollRuntimeStatus, 2500);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isUpdateActive, pollRuntimeStatus]);

  useEffect(() => {
    if (showLogs && logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [runtimeStatus?.log_tail, showLogs]);

  const executeConfirmedAction = async () => {
    if (!confirmModal || actionBusy) return;
    const kind = confirmModal.kind;
    setActionBusy(true);
    setConfirmModal(null);
    setFeedbackBanner(null);

    try {
      let endpoint = "/api/system/update/start";
      let bodyObj = { mode: "now" };
      if (kind === "update_after_calls") {
        bodyObj = { mode: "after_calls" };
      } else if (kind === "rollback") {
        endpoint = "/api/system/update/rollback";
        bodyObj = {};
      }
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(bodyObj)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedbackBanner({
          type: "error",
          text: data?.detail || data?.message || "İşlem başlatılamadı."
        });
      } else {
        setFeedbackBanner({
          type: "success",
          text: data?.message || "Güncelleme işlemi başlatıldı."
        });
        setShowLogs(true);
        setTimeout(() => pollRuntimeStatus(), 600);
      }
    } catch (e) {
      setFeedbackBanner({ type: "error", text: "Sunucuya bağlanılamadı." });
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancelWaitingUpdate = async () => {
    setActionBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/system/update/cancel`, {
        method: "POST",
        headers: getAuthHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFeedbackBanner({ type: "info", text: data?.message || "Bekleyen güncelleme iptal edildi." });
        setTimeout(() => pollRuntimeStatus(), 800);
      }
    } catch (e) {}
    setActionBusy(false);
  };

  const copyVersionInfo = () => {
    if (!versionData) return;
    const strToCopy = `Sistem Versiyonu: ${versionData.version} | Commit: ${versionData.commit_hash} | Çıkış: ${versionData.release_date}`;
    navigator.clipboard.writeText(strToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentVer = versionData?.version || "v3.9.1";
  const commitHash = versionData?.commit_hash || "auto";
  const releaseDate = versionData?.release_date || "21 Kasım 2026";
  const changelogList = versionData?.changelog || [];

  const activeCallsCnt = Number(
    runtimeStatus?.active_calls_count ?? updateCheck?.active_calls_count ?? 0
  );
  const canExecuteRole = updateCheck?.can_execute_role !== false;
  const selfUpdateAllowed = Boolean(updateCheck?.self_update_allowed);
  const canTriggerUpdate = canExecuteRole && selfUpdateAllowed && !isUpdateActive;
  const rollbackInfo = runtimeStatus?.rollback_info || updateCheck?.rollback_info || null;
  const channelKey = String(updateCheck?.update_channel || "stable").toLowerCase();
  const channelMeta = CHANNEL_LABELS[channelKey] || CHANNEL_LABELS.stable;

  const filteredChangelog = changelogList.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const inVer = (item.version || "").toLowerCase().includes(q);
    const inTitle = (item.title || "").toLowerCase().includes(q);
    const inSum = (item.summary || "").toLowerCase().includes(q);
    const inFeat = (item.features || []).some((f) =>
      typeof f === "string"
        ? f.toLowerCase().includes(q)
        : (f.title || "").toLowerCase().includes(q) || (f.desc || "").toLowerCase().includes(q)
    );
    const inFix = (item.fixes || []).some((fx) => String(fx || "").toLowerCase().includes(q));
    return inVer || inTitle || inSum || inFeat || inFix;
  });

  const pendingReleases = Array.isArray(updateCheck?.pending_releases) ? updateCheck.pending_releases : [];
  const showRuntimePanel =
    runtimeStatus &&
    runtimeStatus.status &&
    runtimeStatus.status !== "idle" &&
    runtimeStatus.status !== "cancelled";

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-sm p-6 space-y-6 transition-colors duration-300 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl border ${lightBg} ${text} ${borderLight} flex items-center justify-center shadow-sm`}>
            <GitCommit size={22} />
          </div>
          <div>
            <h2 className="font-extrabold text-base text-slate-900 dark:text-white tracking-wide flex items-center gap-2 flex-wrap">
              Sistem Versiyonu ve Güncelleme Merkezi
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${lightBg} ${text} ${borderLight}`}>
                {currentVer}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Merkez Panel onaylı sürümleri sorgulayın, yenilikleri inceleyin ve santralinizi güvenle güncelleyin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => checkForUpdates(false)}
            disabled={checkingUpdate || isUpdateActive}
            className={`flex items-center gap-1.5 px-3.5 py-2 ${bg} ${hover} text-white text-xs font-extrabold rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50`}
          >
            <DownloadCloud size={14} className={checkingUpdate ? "animate-bounce" : ""} />
            <span>{checkingUpdate ? "Sorgulanıyor..." : "Güncellemeleri Denetle"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchVersionInfo();
              pollRuntimeStatus();
            }}
            title="Versiyon Bilgisini Yenile"
            className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 rounded-xl transition cursor-pointer"
            >
              <ArrowLeft size={13} />
              Geri Dön
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${
            feedbackBanner.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
              : feedbackBanner.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300"
              : `${lightBg} ${borderLight} ${text}`
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackBanner.type === "error" ? (
              <AlertTriangle size={15} className="shrink-0" />
            ) : feedbackBanner.type === "success" ? (
              <CheckCircle2 size={15} className="shrink-0" />
            ) : (
              <Sparkles size={15} className="shrink-0" />
            )}
            <span>{feedbackBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Hero Version Card */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-white rounded-2xl shadow-md border border-slate-800/80 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`h-12 w-12 rounded-2xl ${bg} text-white flex items-center justify-center shrink-0 shadow-inner`}>
            <Cpu size={24} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Aktif Yayın Sürümü</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                {versionData?.status || "Güncel / Canlıda"}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${channelMeta.cls}`}>
                {channelMeta.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-2xl font-black font-mono tracking-tight text-white">{currentVer}</span>
              <span className="text-xs font-mono text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                Commit: {commitHash}
              </span>
              <span className="text-xs font-medium text-slate-300 bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/50 flex items-center gap-1.5">
                <Calendar size={12} />
                {releaseDate}
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                  activeCallsCnt > 0
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-slate-800/60 text-slate-300 border-slate-700/50"
                }`}
              >
                <PhoneCall size={12} />
                Aktif Çağrı: {activeCallsCnt}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {rollbackInfo && rollbackInfo.previous_version && canTriggerUpdate && (
            <button
              type="button"
              onClick={() =>
                setConfirmModal({
                  kind: "rollback",
                  title: `Önceki Sürüme Geri Dön (${rollbackInfo.previous_version})`,
                  desc: `Santral ${currentVer} sürümünden kayıtlı önceki sürüm olan ${rollbackInfo.previous_version} (#${rollbackInfo.previous_commit}) noktasına geri döndürülecek ve servisler yeniden başlatılacaktır.`
                })
              }
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-xs font-bold text-amber-200 rounded-xl transition cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Geri Al ({rollbackInfo.previous_version})</span>
            </button>
          )}
          <button
            type="button"
            onClick={copyVersionInfo}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/70 text-xs font-bold text-slate-200 rounded-xl transition cursor-pointer"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? "Kopyalandı!" : "Versiyon Kodu Kopyala"}</span>
          </button>
        </div>
      </div>

      {/* Live 6-Step Update Progress Panel */}
      {showRuntimePanel && (
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                  runtimeStatus.status === "success"
                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                    : runtimeStatus.status === "failed" || runtimeStatus.status === "rolled_back"
                    ? "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
                    : `${lightBg} ${text}`
                }`}
              >
                {isUpdateActive ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : runtimeStatus.status === "success" ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <AlertTriangle size={20} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {runtimeStatus.status === "waiting_calls"
                      ? "Aktif Çağrıların Bitmesi Bekleniyor"
                      : runtimeStatus.status === "success"
                      ? "Güncelleme Başarıyla Tamamlandı"
                      : runtimeStatus.status === "rolled_back"
                      ? "Otomatik Geri Alma (Rollback) Uygulandı"
                      : runtimeStatus.status === "failed"
                      ? "Güncelleme Hatası"
                      : `Güncelleme İşlemi Devam Ediyor (${runtimeStatus.target_version || ""})`}
                  </h3>
                  <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    %{runtimeStatus.progress || 0}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                  {runtimeStatus.step_label || "Hazırlanıyor..."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {runtimeStatus.status === "waiting_calls" && (
                <button
                  type="button"
                  onClick={handleCancelWaitingUpdate}
                  disabled={actionBusy}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  Beklemeyi İptal Et
                </button>
              )}
              {runtimeStatus.status === "success" && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className={`px-3.5 py-1.5 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold transition cursor-pointer`}
                >
                  Yeni Arayüzü Yükle (Yenile)
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowLogs((v) => !v)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <Terminal size={13} />
                <span>Loglar</span>
                {showLogs ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                runtimeStatus.status === "failed" || runtimeStatus.status === "rolled_back"
                  ? "bg-rose-500"
                  : runtimeStatus.status === "success"
                  ? "bg-emerald-500"
                  : bg
              }`}
              style={{ width: `${Math.max(4, Math.min(100, Number(runtimeStatus.progress || 0)))}%` }}
            />
          </div>

          {/* 6-Step Indicators */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {UPDATE_STEPS.map((st) => {
              const curIdx = Number(runtimeStatus.step_index || 0);
              const done = runtimeStatus.status === "success" || curIdx > st.index;
              const active = isUpdateActive && curIdx === st.index;
              return (
                <div
                  key={st.index}
                  className={`px-2.5 py-2 rounded-xl border text-[10px] font-bold flex items-center gap-1.5 transition ${
                    done
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300"
                      : active
                      ? `${lightBg} ${borderLight} ${text} animate-pulse`
                      : "bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-800 text-slate-400"
                  }`}
                >
                  <span className="font-mono font-black">{st.index}.</span>
                  <span className="truncate">{st.label}</span>
                </div>
              );
            })}
          </div>

          {runtimeStatus.error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-mono text-rose-700 dark:text-rose-300 break-words">
              {runtimeStatus.error}
            </div>
          )}

          {showLogs && (
            <pre
              ref={logBoxRef}
              className="p-3.5 rounded-xl bg-slate-950 text-emerald-300 font-mono text-[11px] leading-relaxed max-h-60 overflow-y-auto border border-slate-800 whitespace-pre-wrap"
            >
              {runtimeStatus.log_tail || "Henüz log çıktısı yok..."}
            </pre>
          )}
        </div>
      )}

      {/* Pending Central-Approved Update Preview Card */}
      {updateCheck?.reachable && updateCheck?.update_available && pendingReleases.length > 0 && (
        <div className={`p-5 rounded-2xl border-2 ${borderLight} ${lightBg} space-y-4 shadow-sm`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-slate-800/60 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase text-white ${bg}`}>
                  <Sparkles size={11} />
                  Merkez Panel Onaylı Yeni Güncelleme
                </span>
                <span className="text-xs font-mono font-black text-slate-900 dark:text-white">
                  {currentVer} → {updateCheck.latest_version}
                </span>
                {updateCheck.target_commit && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/80 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">
                    #{updateCheck.target_commit}
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Bu güncelleme paketi{" "}
                <strong>{pendingReleases.length} sürüm</strong>,{" "}
                <strong>{updateCheck.total_features_count || 0} yeni özellik/iyileştirme</strong> ve{" "}
                <strong>{updateCheck.total_fixes_count || 0} hata düzeltmesi</strong> içeriyor.
              </p>
            </div>

            {canTriggerUpdate ? (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() =>
                    setConfirmModal({
                      kind: "update_after_calls",
                      title: `${updateCheck.latest_version} — Çağrılar Bitince Güncelle`,
                      desc: `Santral şu anki aktif görüşmeler (${activeCallsCnt} çağrı) tamamen bitene kadar bekleyecek, ardından otomatik olarak ${updateCheck.latest_version} sürümüne güncellenip yeniden başlatılacaktır. Hata olursa önceki sürüme otomatik geri döner.`
                    })
                  }
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-extrabold text-slate-800 dark:text-slate-100 transition cursor-pointer disabled:opacity-50"
                >
                  <Clock size={14} className={text} />
                  <span>Çağrılar Bitince Güncelle</span>
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() =>
                    setConfirmModal({
                      kind: "update_now",
                      title: `${updateCheck.latest_version} Sürümüne Şimdi Güncelle`,
                      desc:
                        activeCallsCnt > 0
                          ? `DİKKAT: Şu anda ${activeCallsCnt} aktif görüşme tespit edildi! Hemen güncelleme başlatırsanız servis yeniden başlatılırken görüşmeler etkilenebilir. Bunun yerine "Çağrılar Bitince Güncelle" seçeneğini kullanmanız önerilir.`
                          : `Santral ${currentVer} sürümünden Merkez Panel onaylı ${updateCheck.latest_version} (#${updateCheck.target_commit || "stable"}) sürümüne güncellenecektir. Asterisk dialplan ve arayüz otomatik derlenir; hata durumunda otomatik geri alma (rollback) devreye girer.`
                    })
                  }
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold shadow-md transition cursor-pointer disabled:opacity-50`}
                >
                  <DownloadCloud size={14} />
                  <span>Şimdi Güncelle</span>
                </button>
              </div>
            ) : !selfUpdateAllowed ? (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 max-w-md">
                <Lock size={15} className="text-amber-500 shrink-0" />
                <span>
                  Bu santralde güncelleme başlatma yetkisi <strong>Merkez Yönetim Paneli</strong> kontrolündedir. Yenilikleri aşağıdan inceleyebilirsiniz.
                </span>
              </div>
            ) : !canExecuteRole ? (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">
                <Lock size={15} className="text-slate-400 shrink-0" />
                <span>Rolünüzde güncelleme başlatma yetkisi kapalı.</span>
              </div>
            ) : null}
          </div>

          {/* Pending Releases Breakdown */}
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {pendingReleases.map((rel) => (
              <div
                key={rel.version}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                      {rel.version}
                    </span>
                    {rel.commit_hash && (
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        #{rel.commit_hash}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase ${
                        rel.channel === "beta"
                          ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                      }`}
                    >
                      {rel.channel === "beta" ? "Beta / Pilot" : "Kararlı"}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <Calendar size={12} />
                    {rel.release_date || "-"}
                  </span>
                </div>

                {rel.title && (
                  <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{rel.title}</h4>
                )}
                {rel.summary && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{rel.summary}</p>
                )}

                {Array.isArray(rel.features) && rel.features.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Yeni Özellikler ve İyileştirmeler
                    </p>
                    <ul className="space-y-1">
                      {rel.features.map((f, i) => (
                        <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                          <span>{typeof f === "string" ? f : `${f.title || ""}${f.desc ? ` — ${f.desc}` : ""}`}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(rel.fixes) && rel.fixes.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Düzeltilen Sorunlar
                    </p>
                    <ul className="space-y-1">
                      {rel.fixes.map((fx, i) => (
                        <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                          <AlertCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                          <span>{String(fx)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Installed Changelog Timeline */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Yüklü Sürüm Geçmişi ve Değişiklik Listesi
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">
              Toplam {changelogList.length} Sürüm Kaydı {searchQuery.trim() ? `(${filteredChangelog.length} eşleşme)` : ""}
            </span>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Sürüm veya özellik ara (örn: Call Flip, Web Phone, Trunk)..."
            className="w-full sm:w-72 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary"
          />
        </div>

        <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 pl-6 space-y-8 py-2">
          {filteredChangelog.map((item, idx) => {
            const isCurrent = item.version === currentVer;
            return (
              <div key={idx} className="relative group">
                <span
                  className={`absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 shadow-sm transition-all duration-300 ${
                    isCurrent ? `${bg} ring-4 ${ring} scale-110` : "bg-slate-300 dark:bg-slate-700"
                  }`}
                />

                <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/50 dark:border-slate-800/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-slate-900 dark:text-white">{item.version}</span>
                      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-800 px-2 py-0.5 rounded">
                        #{item.commit_hash}
                      </span>
                      {item.badge && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${
                            isCurrent
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 font-medium">
                      <Calendar size={13} />
                      {item.release_date}
                    </div>
                  </div>

                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{item.title || item.summary}</h4>

                  {item.summary && item.title && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">{item.summary}</p>
                  )}

                  {item.features && item.features.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                        Eklenen / Yenilenen Özellikler
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {item.features.map((feat, fIdx) => (
                          <div
                            key={fIdx}
                            className="p-3 bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800/80 rounded-xl space-y-1"
                          >
                            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                              <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                              {typeof feat === "string" ? feat : feat.title}
                            </h5>
                            {typeof feat !== "string" && feat.desc && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pl-5 font-medium">
                                {feat.desc}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.fixes && item.fixes.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                        Düzeltmeler ve İyileştirmeler
                      </div>
                      <ul className="space-y-1 pl-1">
                        {item.fixes.map((fix, fxIdx) => (
                          <li
                            key={fxIdx}
                            className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2 font-medium"
                          >
                            <AlertCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                            <span>{fix}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Confirmation Modal (Application-Native — No browser confirm()) */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div
                className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmModal.kind === "rollback" || (confirmModal.kind === "update_now" && activeCallsCnt > 0)
                    ? "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 animate-pulse"
                    : `${lightBg} ${text}`
                }`}
              >
                {confirmModal.kind === "rollback" ? (
                  <RotateCcw size={20} />
                ) : confirmModal.kind === "update_after_calls" ? (
                  <Clock size={20} />
                ) : (
                  <DownloadCloud size={20} />
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{confirmModal.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{confirmModal.desc}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={executeConfirmedAction}
                className={`px-4 py-2 rounded-xl text-white text-xs font-extrabold shadow-sm transition cursor-pointer ${
                  confirmModal.kind === "rollback" ? "bg-rose-600 hover:bg-rose-500" : `${bg} ${hover}`
                }`}
              >
                {confirmModal.kind === "rollback" ? "Geri Almayı Başlat" : "Onayla ve Başlat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
