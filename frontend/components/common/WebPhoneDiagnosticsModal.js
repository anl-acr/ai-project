import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle,
  X,
  Mic,
  MicOff,
  Wifi,
  Server,
  ShieldAlert,
  Volume2,
  Cpu,
  RefreshCw,
  Copy,
  Check,
  PhoneCall
} from "lucide-react";
import { webphoneManager } from "../../utils/webphoneManager";
import { getDeviceKeySync } from "../../utils/deviceIdentity";
import { useTheme } from "../../utils/theme";

export default function WebPhoneDiagnosticsModal() {
  const { bg, hover, text, border, lightBg } = useTheme();
  const [wpState, setWpState] = useState(() => webphoneManager.getState());
  const [actionBusyId, setActionBusyId] = useState("");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedDevKey, setCopiedDevKey] = useState(false);
  const [localDeviceKey, setLocalDeviceKey] = useState("");

  useEffect(() => {
    setLocalDeviceKey(getDeviceKeySync());
  }, []);

  useEffect(() => {
    const unsub = webphoneManager.subscribe((nextState) => {
      setWpState({ ...nextState });
    });
    const handleOpenEvent = () => {
      webphoneManager.openDiagnosticsModal();
    };
    window.addEventListener("OPEN_WEBPHONE_DIAGNOSTICS", handleOpenEvent);
    // Run an initial check 2.5s after mount
    const initTimer = setTimeout(() => {
      webphoneManager.runDiagnosticsCheck({ reason: "mount_check", autoOpenIfCritical: true });
    }, 2500);
    return () => {
      unsub();
      window.removeEventListener("OPEN_WEBPHONE_DIAGNOSTICS", handleOpenEvent);
      clearTimeout(initTimer);
    };
  }, []);

  const report = wpState.healthReport;
  const isOpen = Boolean(wpState.diagnosticsModalOpen);

  // Auto-close modal 1.8s after all blocking & warning issues are resolved (if it was auto-opened)
  useEffect(() => {
    if (!isOpen || !report) return;
    if (report.criticalCount === 0 && !wpState.memorySaverDetected) {
      // Keep open if manually opened, otherwise user can see everything is green
    }
  }, [isOpen, report, wpState.memorySaverDetected]);

  const handleAction = async (item) => {
    if (!item?.actionType) return;
    setActionBusyId(item.id);
    try {
      if (item.actionType === "request_mic") {
        await webphoneManager.requestMicrophonePermissionNow();
      } else if (item.actionType === "rescan_devices") {
        await webphoneManager.runDiagnosticsCheck({ reason: "manual_rescan", autoOpenIfCritical: false });
      } else if (item.actionType === "reconnect_pbx") {
        webphoneManager.reloadWebrtcConfig();
        await new Promise((r) => setTimeout(r, 1200));
        await webphoneManager.runDiagnosticsCheck({ reason: "manual_reconnect", autoOpenIfCritical: false });
      } else if (item.actionType === "switch_https") {
        if (typeof window !== "undefined") {
          window.location.href = window.location.href.replace(/^http:/i, "https:");
        }
      } else if (item.actionType === "copy_memory_saver_url") {
        try {
          await navigator.clipboard.writeText("chrome://settings/performance");
          setCopiedUrl(true);
          setTimeout(() => setCopiedUrl(false), 3500);
        } catch (e) {}
        webphoneManager.acknowledgeMemorySaverWarning();
      } else if (item.actionType === "copy_device_key") {
        const dk = localDeviceKey || getDeviceKeySync();
        try {
          await navigator.clipboard.writeText(dk);
          setCopiedDevKey(true);
          setTimeout(() => setCopiedDevKey(false), 3000);
        } catch (e) {}
      } else if (item.actionType === "test_speaker") {
        await webphoneManager.unlockAudioAndTestSpeaker();
      } else if (item.actionType === "retry_all") {
        await webphoneManager.runDiagnosticsCheck({ reason: "manual_retry", autoOpenIfCritical: false });
      }
    } finally {
      setActionBusyId("");
    }
  };

  const getItemIcon = (item) => {
    switch (item.id) {
      case "microphone":
        return item.status === "ok" ? <Mic size={16} /> : <MicOff size={16} />;
      case "pbx_connection":
        return <Server size={16} />;
      case "memory_saver":
        return <Cpu size={16} />;
      case "network":
        return <Wifi size={16} />;
      case "secure_context":
        return <ShieldAlert size={16} />;
      case "audio_output":
        return <Volume2 size={16} />;
      default:
        return <PhoneCall size={16} />;
    }
  };

  const curUser = wpState.currentUser;
  const isSuperAdminWithoutExt =
    (curUser?.username === "admin" || curUser?.id === "admin") &&
    !curUser?.extension &&
    !wpState.webrtcConfig?.agentExtension;

  const hasPersistentIssue =
    !isSuperAdminWithoutExt &&
    curUser &&
    report &&
    report.criticalCount > 0;

  return (
    <>
      {/* Persistent Floating Alert Pill when an issue exists and popup is closed */}
      {!isOpen && hasPersistentIssue && (
        <button
          type="button"
          onClick={() => webphoneManager.openDiagnosticsModal()}
          className="fixed bottom-4 left-4 z-[85] flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white shadow-xl border border-rose-400/40 transition-all cursor-pointer animate-bounce"
          title="Web Telefon sorunlarını görüntülemek ve çözmek için tıklayın"
        >
          <AlertTriangle size={16} className="shrink-0" />
          <div className="flex flex-col text-left leading-tight">
            <span className="text-[11px] font-extrabold">Web Telefon Uyarısı ({report.criticalCount || 1} Sorun)</span>
            <span className="text-[9px] text-rose-100 font-semibold">Detay ve çözüm için tıklayın</span>
          </div>
        </button>
      )}

      {/* Main Diagnostics Popup Modal */}
      {isOpen && report && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => webphoneManager.closeDiagnosticsModal(report.issueSignature)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full max-h-[88vh] overflow-y-auto p-6 flex flex-col gap-4 text-slate-800 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-2xl text-white shadow-sm ${
                    report.criticalCount > 0
                      ? "bg-rose-600 animate-pulse"
                      : report.warningCount > 0
                      ? "bg-amber-500"
                      : "bg-emerald-600"
                  }`}
                >
                  {report.criticalCount > 0 || report.warningCount > 0 ? (
                    <AlertTriangle size={20} />
                  ) : (
                    <CheckCircle size={20} />
                  )}
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {report.criticalCount > 0
                      ? "Web Telefon Çalışmasını Engelleyen Sorun Tespit Edildi!"
                      : report.warningCount > 0
                      ? "Web Telefon Sistem Uyarısı & Kontrol Paneli"
                      : "Web Telefon Sistem Kontrolü — Tüm Sistemler Hazır"}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Çağrı alabilmeniz ve sesinizin karşı tarafa sorunsuz iletilmesi için aşağıdaki kontroller gerçekleştirildi.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => webphoneManager.closeDiagnosticsModal(report.issueSignature)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl transition cursor-pointer"
                title="Kapat"
              >
                <X size={16} />
              </button>
            </div>

            {/* Summary Banner */}
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                report.criticalCount > 0
                  ? "bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200"
                  : report.warningCount > 0
                  ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200"
                  : "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200"
              }`}
            >
              <div className="flex flex-col text-left gap-0.5">
                <span className="text-xs font-extrabold">
                  {report.criticalCount > 0
                    ? `${report.criticalCount} Kritik Engel Mevcut — Lütfen Aşağıdaki Adımları Uygulayın`
                    : report.warningCount > 0
                    ? `${report.warningCount} Dikkat Edilmesi Gereken Uyarı Bulundu`
                    : "Mikrofon, Hoparlör, Santral Bağlantısı ve Bellek Koruması Sorunsuz Çalışıyor"}
                </span>
                <span className="text-[10px] opacity-85">
                  Dahili: <strong>{wpState.webrtcConfig?.agentExtension || curUser?.extension || "Tanımsız"}</strong> • Durum:{" "}
                  <strong>{wpState.registered ? "Santrale Bağlı (Çevrimiçi)" : "Çevrimdışı"}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => webphoneManager.runDiagnosticsCheck({ reason: "manual_refresh", autoOpenIfCritical: false })}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1.5 hover:bg-slate-50 transition cursor-pointer shrink-0"
              >
                <RefreshCw size={12} /> Tekrar Tara
              </button>
            </div>

            {/* Method A: This PC's Trusted Device Key Copy Bar */}
            {localDeviceKey && (
              <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2 min-w-0 text-left">
                  <Cpu size={14} className="text-slate-400 shrink-0" />
                  <span className="text-slate-500 dark:text-slate-400 font-semibold truncate">
                    Bu Bilgisayarın Cihaz Anahtarı:
                  </span>
                  <code className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-extrabold text-slate-800 dark:text-slate-100">
                    {localDeviceKey}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(localDeviceKey);
                      setCopiedDevKey(true);
                      setTimeout(() => setCopiedDevKey(false), 2500);
                    } catch (_) {}
                  }}
                  title="Anahtarı Kopyala"
                  className="h-7 w-7 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 cursor-pointer transition"
                >
                  {copiedDevKey ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>
              </div>
            )}

            {/* Diagnostic Checklist Items */}
            <div className="flex flex-col gap-2.5 text-left">
              {(report.items || []).map((item) => {
                const isError = item.status === "error";
                const isWarn = item.status === "warning";
                const isConnecting = item.status === "connecting";

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col gap-2 ${
                      isError
                        ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/70"
                        : isWarn
                        ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/70"
                        : "bg-slate-50/70 dark:bg-slate-950/40 border-slate-150 dark:border-slate-800/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                            isError
                              ? "bg-rose-600 text-white"
                              : isWarn
                              ? "bg-amber-500 text-white"
                              : isConnecting
                              ? "bg-sky-500 text-white animate-spin"
                              : "bg-emerald-600 text-white"
                          }`}
                        >
                          {getItemIcon(item)}
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                              {item.title}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider ${
                                isError
                                  ? "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300"
                                  : isWarn
                                  ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300"
                                  : isConnecting
                                  ? "bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300"
                                  : "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                              }`}
                            >
                              {isError ? "Sorun Var" : isWarn ? "Uyarı" : isConnecting ? "Bağlanıyor" : "Sorunsuz"}
                            </span>
                          </div>
                          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-snug">
                            {item.summary}
                          </p>
                          {item.solution && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                              <strong>Çözüm:</strong> {item.solution}
                            </p>
                          )}
                        </div>
                      </div>

                      {item.actionType && (
                        <button
                          type="button"
                          disabled={actionBusyId === item.id}
                          onClick={() => handleAction(item)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold shrink-0 transition cursor-pointer shadow-sm ${
                            isError
                              ? "bg-rose-600 hover:bg-rose-500 text-white"
                              : isWarn
                              ? "bg-amber-600 hover:bg-amber-500 text-white"
                              : `${bg} ${hover} text-white`
                          }`}
                        >
                          {actionBusyId === item.id ? "İşleniyor..." : item.actionLabel}
                        </button>
                      )}
                    </div>

                    {/* Extra helper box for Chrome Memory Saver */}
                    {item.id === "memory_saver" && isWarn && (
                      <div className="mt-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-2 text-[10px]">
                        <div className="font-mono text-slate-700 dark:text-slate-300 truncate">
                          Tarayıcı adres çubuğuna yapıştırın: <strong className="text-amber-600 dark:text-amber-400">chrome://settings/performance</strong>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText("chrome://settings/performance");
                              setCopiedUrl(true);
                              setTimeout(() => setCopiedUrl(false), 3000);
                            } catch (e) {}
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          {copiedUrl ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                          {copiedUrl ? "Kopyalandı!" : "Adresi Kopyala"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400">
                Sorun giderildiğinde durum otomatik olarak güncellenir.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => webphoneManager.closeDiagnosticsModal(report.issueSignature)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Anladım / Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
