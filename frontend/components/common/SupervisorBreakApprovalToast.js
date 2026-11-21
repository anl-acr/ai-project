import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Coffee,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  BellRing,
  Loader2,
  AlertTriangle,
  MessageSquare
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { isDesktopApp, isNativeElectron, sendDesktopNotification } from "../../utils/desktopBridge";

const EXTRA_DURATION_OPTIONS = [
  { value: 10, label: "10 dk" },
  { value: 15, label: "15 dk" },
  { value: 30, label: "30 dk" },
  { value: 0, label: "Sınırsız" }
];

function playSoftApprovalChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const freqs = [660, 880];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now + idx * 0.14);
      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.14 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.3);
    });
    setTimeout(() => {
      try {
        ctx.close();
      } catch (e) {}
    }, 900);
  } catch (e) {}
}

function formatCountdown(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export default function SupervisorBreakApprovalToast({
  backendHost = "localhost:8000",
  currentUser = null,
  activeTenantId = "tenant-default"
}) {
  const { bg, hover, text, lightBg, borderLight } = useTheme();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [selectedMinutesMap, setSelectedMinutesMap] = useState({});
  const [noteMap, setNoteMap] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const alertedIdsRef = useRef(new Set());
  const userKey = currentUser?.id ? String(currentUser.id) : "";

  const fetchPending = useCallback(async () => {
    if (!userKey || typeof window === "undefined") return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden" && !isDesktopApp()) {
      return;
    }
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(
        `${protocol}//${backendHost}/api/supervisor/break-requests?t=${Date.now()}`,
        {
          headers: {
            "X-User-ID": userKey,
            "X-Tenant-ID": activeTenantId || "tenant-default"
          }
        }
      );
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data.pending) ? data.pending : [];
      setPendingRequests(list);

      // Alert on newly arrived request IDs
      const newItems = list.filter((item) => item?.id && !alertedIdsRef.current.has(item.id));
      if (newItems.length > 0) {
        newItems.forEach((item) => alertedIdsRef.current.add(item.id));
        playSoftApprovalChime();
        const first = newItems[0];
        const title = `Ek Mola Onay Talebi • ${first.agent_name}`;
        const body = `${first.break_name} (${
          first.reason_type === "queue_concurrent_limit"
            ? "Eşzamanlı Mola Limiti"
            : "Günlük Kota Aşımı"
        })${first.agent_note ? ` — "${first.agent_note}"` : ""}`;
        try {
          if (isNativeElectron()) {
            sendDesktopNotification({
              title,
              body,
              tag: `break_req_${first.id}`,
              urgent: true,
              popWindow: false,
              focusOnClick: true
            });
          } else if ("Notification" in window && Notification.permission === "granted") {
            const n = new Notification(title, { body, tag: `break_req_${first.id}` });
            n.onclick = () => {
              window.focus();
              n.close();
            };
          }
        } catch (e) {}
      }
    } catch (err) {
      // silent polling failure
    }
  }, [backendHost, userKey, activeTenantId]);

  useEffect(() => {
    if (!userKey) return;
    fetchPending();
    const interval = setInterval(fetchPending, 4000);
    return () => clearInterval(interval);
  }, [fetchPending, userKey]);

  // Smooth local 1s countdown tick
  useEffect(() => {
    if (pendingRequests.length === 0) return;
    const t = setInterval(() => {
      setPendingRequests((prev) =>
        prev
          .map((item) => ({
            ...item,
            remaining_seconds: Math.max(0, (item.remaining_seconds || 0) - 1)
          }))
          .filter((item) => item.remaining_seconds > 0)
      );
    }, 1000);
    return () => clearInterval(t);
  }, [pendingRequests.length]);

  const handleDecision = async (reqItem, decision) => {
    if (!reqItem?.id || submittingId) return;
    setSubmittingId(reqItem.id);
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const extraMin =
        selectedMinutesMap[reqItem.id] !== undefined ? selectedMinutesMap[reqItem.id] : 15;
      const reviewerNote = (noteMap[reqItem.id] || "").trim();

      const res = await fetch(
        `${protocol}//${backendHost}/api/supervisor/break-requests/${reqItem.id}/decide`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-ID": userKey,
            "X-Tenant-ID": activeTenantId || "tenant-default"
          },
          body: JSON.stringify({
            decision,
            extra_minutes: decision === "approve" ? extraMin : 0,
            reviewer_note: reviewerNote
          })
        }
      );
      const data = await res.json().catch(() => ({}));
      setPendingRequests((prev) => prev.filter((item) => item.id !== reqItem.id));

      if (!res.ok) {
        setFeedbackMsg({
          type: "error",
          text: data?.detail || "İşlem tamamlanamadı."
        });
      } else if (decision === "approve") {
        setFeedbackMsg({
          type: "success",
          text: `${reqItem.agent_name} onaylandı ve otomatik olarak '${reqItem.break_name}' molasına alındı.`
        });
      } else {
        setFeedbackMsg({
          type: "info",
          text: `${reqItem.agent_name} mola talebi reddedildi.`
        });
      }
      setTimeout(() => setFeedbackMsg(null), 4500);
    } catch (err) {
      setFeedbackMsg({ type: "error", text: "Sunucu bağlantı hatası oluştu." });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } finally {
      setSubmittingId(null);
    }
  };

  if (pendingRequests.length === 0 && !feedbackMsg) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9990] w-[380px] max-w-[calc(100vw-2rem)] space-y-3 pointer-events-none">
      {feedbackMsg && (
        <div
          className={`pointer-events-auto px-4 py-3 rounded-2xl border shadow-xl text-xs font-bold flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            feedbackMsg.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200"
              : feedbackMsg.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-200"
              : "bg-slate-900 dark:bg-slate-800 border-slate-700 text-white"
          }`}
        >
          {feedbackMsg.type === "error" ? (
            <AlertTriangle size={15} className="shrink-0" />
          ) : (
            <CheckCircle2 size={15} className="shrink-0" />
          )}
          <span className="leading-snug">{feedbackMsg.text}</span>
        </div>
      )}

      {pendingRequests.slice(0, 3).map((req) => {
        const chosenMin =
          selectedMinutesMap[req.id] !== undefined ? selectedMinutesMap[req.id] : 15;
        const isBusy = submittingId === req.id;
        const isConcurrent = req.reason_type === "queue_concurrent_limit";

        return (
          <div
            key={req.id}
            className="pointer-events-auto bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-slate-50/90 dark:bg-slate-950/70 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-7 h-7 rounded-xl ${lightBg} ${text} border ${borderLight} flex items-center justify-center shrink-0`}
                >
                  <BellRing size={14} className="animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                    Ek Mola Onay Talebi
                  </div>
                  <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    {isConcurrent ? "Eşzamanlı Mola Kontenjanı Dolu" : "Günlük Mola Kotası Doldu"}
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] font-bold shrink-0">
                <Clock size={10} />
                {formatCountdown(req.remaining_seconds)}
              </span>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              {/* Agent & Break Summary */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                    <User size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {req.agent_name}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {req.agent_extension ? `Dahili ${req.agent_extension}` : ""}
                      {req.agent_extension && req.queue_name ? " · " : ""}
                      {req.queue_name || ""}
                    </div>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-extrabold text-slate-800 dark:text-slate-100 shrink-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: req.break_color || "#f59e0b" }}
                  />
                  {req.break_name}
                </span>
              </div>

              {req.limit_detail && (
                <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 rounded-xl px-3 py-2 leading-relaxed">
                  {req.limit_detail}
                </p>
              )}

              {req.agent_note && (
                <div className="flex items-start gap-2 text-[11px] text-slate-700 dark:text-slate-200 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 rounded-xl px-3 py-2">
                  <MessageSquare size={13} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Temsilci Notu:</strong> {req.agent_note}
                  </span>
                </div>
              )}

              {/* Extra Duration Pills */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Onaylanacak Ek Mola Süresi
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {EXTRA_DURATION_OPTIONS.map((opt) => {
                    const active = chosenMin === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          setSelectedMinutesMap((prev) => ({ ...prev, [req.id]: opt.value }))
                        }
                        className={`py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                          active
                            ? `${bg} text-white border-transparent shadow-sm`
                            : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Supervisor Note */}
              <input
                type="text"
                disabled={isBusy}
                value={noteMap[req.id] || ""}
                onChange={(e) =>
                  setNoteMap((prev) => ({ ...prev, [req.id]: e.target.value }))
                }
                placeholder="Yönetici notu (opsiyonel)..."
                className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />

              {/* Actions */}
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleDecision(req, "reject")}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <XCircle size={14} />
                  <span>Reddet</span>
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleDecision(req, "approve")}
                  className={`flex-[1.5] inline-flex items-center justify-center gap-1.5 py-2 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer disabled:opacity-50`}
                >
                  {isBusy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Coffee size={14} />
                  )}
                  <span>Onayla ve Molaya Al</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {pendingRequests.length > 3 && (
        <div className="pointer-events-auto text-center text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 shadow-lg">
          +{pendingRequests.length - 3} bekleyen mola talebi daha var
        </div>
      )}
    </div>
  );
}
