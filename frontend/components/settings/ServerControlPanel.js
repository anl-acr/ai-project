import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Server,
  Power,
  RotateCw,
  Play,
  Square,
  RefreshCw,
  Terminal,
  Cpu,
  HardDrive,
  Activity,
  PhoneCall,
  AlertTriangle,
  CheckCircle2,
  X,
  Clock,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";

const STATUS_BADGE = {
  running: {
    label: "ÇALIŞIYOR",
    dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]",
    cls: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
  },
  stopped: {
    label: "DURDURULDU",
    dot: "bg-slate-400",
    cls: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  },
  failed: {
    label: "HATALI",
    dot: "bg-rose-500 animate-pulse",
    cls: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60",
  },
  errored: {
    label: "HATALI",
    dot: "bg-rose-500 animate-pulse",
    cls: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60",
  },
  restarting: {
    label: "BAŞLATILIYOR",
    dot: "bg-amber-500 animate-pulse",
    cls: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
  },
  unavailable: {
    label: "YEREL ORTAM",
    dot: "bg-slate-300 dark:bg-slate-600",
    cls: "bg-slate-100 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  },
};

export default function ServerControlPanel({ backendHost = "localhost:8000", userPermissions = ["*"] }) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();

  const API_BASE = getApiBaseUrl(backendHost);

  const getAuthHeaders = useCallback(() => {
    const hdrs = {};
    if (typeof window !== "undefined") {
      try {
        const rawU = localStorage.getItem("aida_user") || sessionStorage.getItem("aida_user");
        if (rawU) {
          const parsed = JSON.parse(rawU);
          const uid = parsed?.id || parsed?.extension;
          if (uid) hdrs["X-User-ID"] = String(uid);
        }
      } catch {}
    }
    return hdrs;
  }, []);

  const [serverPerms, setServerPerms] = useState(null); // { can_read, can_manage_services, can_power, role_code }

  const canManageServices = useMemo(() => {
    if (serverPerms && typeof serverPerms.can_manage_services === "boolean") {
      return serverPerms.can_manage_services;
    }
    if (typeof window !== "undefined" && sessionStorage.getItem("is_nornia_root") === "true") {
      return true;
    }
    if (!Array.isArray(userPermissions)) return false;
    return (
      userPermissions.includes("*") ||
      userPermissions.includes("server_control:write")
    );
  }, [serverPerms, userPermissions]);

  const canPower = useMemo(() => {
    if (serverPerms && typeof serverPerms.can_power === "boolean") {
      return serverPerms.can_power;
    }
    if (typeof window !== "undefined" && sessionStorage.getItem("is_nornia_root") === "true") {
      return true;
    }
    if (!Array.isArray(userPermissions)) return false;
    return (
      userPermissions.includes("*") ||
      userPermissions.includes("server_control:power")
    );
  }, [serverPerms, userPermissions]);

  const [host, setHost] = useState(null);
  const [services, setServices] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [banner, setBanner] = useState(null);
  const [showAudit, setShowAudit] = useState(false);

  // Reconnect overlay after reboot or backend restart
  const [reconnectingState, setReconnectingState] = useState(null); // { mode: "reboot"|"poweroff"|"backend_restart", text }

  // Custom Confirmation Modal (never browser confirm())
  const [confirmModal, setConfirmModal] = useState(null);
  // { kind: "service"|"power", service?, action, title, message, warning, requireText? }
  const [confirmInput, setConfirmInput] = useState("");

  // Log Viewer Modal
  const [logModal, setLogModal] = useState(null); // { service_id, service_name, unit, lines, loading }

  const flashBanner = (ok, msg) => {
    setBanner({ ok, text: msg });
    setTimeout(() => {
      setBanner((prev) => (prev && prev.text === msg ? null : prev));
    }, 8000);
  };

  const fetchOverview = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await tenantFetch(`${API_BASE}/api/server/control/overview`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (!silent) flashBanner(false, err.detail || `Sunucu bilgileri alınamadı (HTTP ${res.status}).`);
          return false;
        }
        const data = await res.json();
        setHost(data.host || null);
        setServices(Array.isArray(data.services) ? data.services : []);
        setAuditLogs(Array.isArray(data.audit_logs) ? data.audit_logs : []);
        if (data.permissions && typeof data.permissions === "object") {
          setServerPerms(data.permissions);
        }
        return true;
      } catch {
        if (!silent) flashBanner(false, "Sunucuya bağlanılamadı.");
        return false;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [API_BASE, getAuthHeaders]
  );

  useEffect(() => {
    fetchOverview(false);
    const t = setInterval(() => {
      fetchOverview(true);
    }, 15000);
    return () => clearInterval(t);
  }, [fetchOverview]);

  // Automatic reconnect polling after reboot or backend restart
  useEffect(() => {
    if (!reconnectingState || reconnectingState.mode === "poweroff") return;
    let cancelled = false;
    const waitStart = reconnectingState.mode === "reboot" ? 12000 : 4000;
    let pollInterval = null;
    const starter = setTimeout(() => {
      pollInterval = setInterval(async () => {
        if (cancelled) return;
        const ok = await fetchOverview(true);
        if (ok && !cancelled) {
          setReconnectingState(null);
          flashBanner(
            true,
            reconnectingState.mode === "reboot"
              ? "Sunucu başarıyla yeniden başladı ve servisler çevrimiçi!"
              : "Servis yeniden başlatıldı ve bağlantı geri geldi."
          );
        }
      }, 3000);
    }, waitStart);
    return () => {
      cancelled = true;
      clearTimeout(starter);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [reconnectingState, fetchOverview]);

  const executeServiceAction = async (svc, action) => {
    const key = `${svc.id}:${action}`;
    setBusyKey(key);
    try {
      const res = await tenantFetch(
        `${API_BASE}/api/server/control/service/${encodeURIComponent(svc.id)}/${encodeURIComponent(action)}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flashBanner(false, data.detail || "Servis işlemi başarısız oldu.");
      } else {
        flashBanner(true, data.message || "İşlem tamamlandı.");
        if (data.delayed && (svc.id === "aida-backend" || (svc.id === "nginx" && action === "restart"))) {
          setReconnectingState({
            mode: "backend_restart",
            text: `${svc.name} yeniden başlatılıyor. Bağlantı birkaç saniye içinde otomatik geri gelecek...`,
          });
        } else {
          setTimeout(() => fetchOverview(true), 1200);
        }
      }
    } catch {
      flashBanner(false, "İstek gönderilirken ağ hatası oluştu.");
    } finally {
      setBusyKey("");
    }
  };

  const requestServiceAction = (svc, action) => {
    // Non-destructive reload or start doesn't need a blocking confirmation modal
    if (action === "start" || action === "reload") {
      executeServiceAction(svc, action);
      return;
    }
    const actionTr = action === "stop" ? "Durdur" : "Yeniden Başlat";
    setConfirmInput("");
    setConfirmModal({
      kind: "service",
      service: svc,
      action,
      title: `${svc.name} — ${actionTr}`,
      message: `${svc.name} (${svc.unit}) servisini ${action === "stop" ? "durdurmak" : "yeniden başlatmak"} istediğinize emin misiniz?`,
      warning: svc.stop_warning || "",
      danger: action === "stop" || svc.critical,
      requireText: "",
    });
  };

  const requestHostPower = (powerAction) => {
    setConfirmInput("");
    if (powerAction === "reboot") {
      setConfirmModal({
        kind: "power",
        action: "reboot",
        title: "Sunucuyu Yeniden Başlat (Reboot)",
        message: "Santral sunucusu güvenli biçimde kapatılıp yeniden başlatılacak. Tüm servisler ve aktif telefon görüşmeleri geçici olarak kesilecek, sunucu yaklaşık 30–60 saniye içinde tekrar açılacaktır.",
        warning:
          host?.active_calls_count > 0
            ? `DİKKAT: Şu an santralde ${host.active_calls_count} aktif çağrı kanalı bulunuyor! Yeniden başlatma bu görüşmeleri kesecektir.`
            : "Sunucu yeniden başlatılırken panel bağlantısı geçici olarak kopacak ve açıldığında otomatik geri gelecektir.",
        danger: true,
        requireText: "",
      });
    } else {
      setConfirmModal({
        kind: "power",
        action: "poweroff",
        title: "Sunucuyu Tamamen Kapat (Power Off)",
        message: "Santral sunucusu tamamen kapatılacaktır. Fiziksel güç tuşu veya sanallaştırma/IPMI konsolu olmadan uzaktan tekrar açılamaz!",
        warning:
          host?.active_calls_count > 0
            ? `KRİTİK: Şu an ${host.active_calls_count} aktif çağrı kanalı var! Kapatma işlemi tüm telefon ve sistem erişimini kalıcı olarak durdurur.`
            : "Sunucuyu yalnızca bakım veya fiziksel taşıma öncesi kapatmanız önerilir.",
        danger: true,
        requireText: "KAPAT",
      });
    }
  };

  const handleConfirmModalSubmit = async () => {
    if (!confirmModal) return;
    if (confirmModal.requireText && confirmInput.trim().toUpperCase() !== confirmModal.requireText) {
      return;
    }
    const modalSnap = confirmModal;
    setConfirmModal(null);

    if (modalSnap.kind === "service") {
      await executeServiceAction(modalSnap.service, modalSnap.action);
      return;
    }

    // Host reboot / poweroff
    setBusyKey(`host:${modalSnap.action}`);
    try {
      const res = await tenantFetch(`${API_BASE}/api/server/control/power`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          action: modalSnap.action,
          confirm_text: confirmInput.trim().toUpperCase(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flashBanner(false, data.detail || "Sunucu güç komutu başarısız.");
      } else {
        setReconnectingState({
          mode: modalSnap.action,
          text: data.message,
        });
      }
    } catch {
      flashBanner(false, "Sunucuya güç komutu iletilemedi.");
    } finally {
      setBusyKey("");
    }
  };

  const openLogsModal = async (svc) => {
    setLogModal({ service_id: svc.id, service_name: svc.name, unit: svc.unit, lines: "", loading: true });
    try {
      const res = await tenantFetch(
        `${API_BASE}/api/server/control/service/${encodeURIComponent(svc.id)}/logs?lines=100`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      setLogModal({
        service_id: svc.id,
        service_name: svc.name,
        unit: data.unit || svc.unit,
        lines: res.ok ? data.lines || "Log boş." : data.detail || "Log okunamadı.",
        loading: false,
      });
    } catch {
      setLogModal((prev) => (prev ? { ...prev, lines: "Sunucuya ulaşılamadı.", loading: false } : null));
    }
  };

  const runningCount = services.filter((s) => s.status === "running").length;

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Header */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${lightBg} ${text} rounded-xl`}>
            <Server size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">
              SUNUCU &amp; SERVİS YÖNETİMİ
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Santral sunucusundaki Asterisk, PM2, PostgreSQL, Nginx ve ağ servislerini kontrol edin; sunucuyu güvenli biçimde yeniden başlatın veya kapatın.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span
            className={`px-2.5 py-1 rounded-lg border text-[10px] font-extrabold ${
              canPower && canManageServices
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                : canManageServices
                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            }`}
            title="Bu ekrandaki müdahale yetkileri Ayarlar → Roller → Sunucu & Servis Yönetimi üzerinden belirlenir."
          >
            {canPower && canManageServices
              ? "Rol: Tam Kontrol"
              : canManageServices
              ? "Rol: Servis Müdahalesi"
              : canPower
              ? "Rol: Yalnızca Güç (Reboot/Kapat)"
              : "Rol: Salt-Okunur İzleme"}
          </span>
          {host && (
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
              {host.hostname} • {runningCount}/{services.length} Aktif
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchOverview(false)}
            title="Durumu Yenile"
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all h-8 w-8 flex items-center justify-center cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Non-Linux Dev Notice */}
      {host && !host.control_supported && (
        <div className="p-3.5 rounded-xl border bg-amber-50/80 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-2.5">
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            Şu an yerel geliştirme ortamında ({host.os_name}) çalışıyorsunuz. Gerçek servis başlatma/durdurma ve sunucu Reboot/Kapat komutları canlı Ubuntu Linux santral sunucusunda aktif olur.
          </span>
        </div>
      )}

      {/* Reconnecting Banner */}
      {reconnectingState && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-bold ${
            reconnectingState.mode === "poweroff"
              ? "bg-rose-50 dark:bg-rose-950/35 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
              : "bg-indigo-50 dark:bg-indigo-950/35 border-indigo-300 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200"
          }`}
        >
          {reconnectingState.mode === "poweroff" ? (
            <Power size={18} className="shrink-0" />
          ) : (
            <RefreshCw size={18} className="animate-spin shrink-0" />
          )}
          <div>
            <div>{reconnectingState.text}</div>
            {reconnectingState.mode !== "poweroff" && (
              <div className="text-[11px] font-medium opacity-80 mt-0.5">
                Bağlantı otomatik olarak kontrol ediliyor; sayfayı kapatmanıza gerek yok.
              </div>
            )}
          </div>
        </div>
      )}

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
            {banner.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            <span>{banner.text}</span>
          </div>
          <button type="button" onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Host Telemetry Cards */}
      {host && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">CPU Yükü</span>
              <Cpu size={15} className={text} />
            </div>
            <div className="text-lg font-extrabold text-slate-800 dark:text-white">%{host.cpu_percent}</div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className={`h-full ${bg}`} style={{ width: `${Math.min(100, host.cpu_percent || 0)}%` }} />
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              {host.cpu_cores} Çekirdek • Yük: {(host.load_avg || [0, 0, 0]).join(" / ")}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bellek (RAM)</span>
              <Activity size={15} className="text-emerald-500" />
            </div>
            <div className="text-lg font-extrabold text-slate-800 dark:text-white">
              %{host.memory?.percent || 0}
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${Math.min(100, host.memory?.percent || 0)}%` }}
              />
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              {host.memory?.used_gb || 0} GB / {host.memory?.total_gb || 0} GB
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Disk (/)</span>
              <HardDrive size={15} className="text-amber-500" />
            </div>
            <div className="text-lg font-extrabold text-slate-800 dark:text-white">
              %{host.disk?.percent || 0}
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full ${(host.disk?.percent || 0) > 85 ? "bg-rose-500" : "bg-amber-500"}`}
                style={{ width: `${Math.min(100, host.disk?.percent || 0)}%` }}
              />
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              {host.disk?.used_gb || 0} GB / {host.disk?.total_gb || 0} GB ({host.disk?.free_gb || 0} GB boş)
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Çalışma Süresi &amp; Çağrı</span>
              <PhoneCall size={15} className={host.active_calls_count > 0 ? "text-amber-500 animate-pulse" : "text-slate-400"} />
            </div>
            <div className="text-sm font-extrabold text-slate-800 dark:text-white truncate" title={host.uptime_human}>
              {host.uptime_human}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                  host.active_calls_count > 0
                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                    : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {host.active_calls_count > 0
                  ? `${host.active_calls_count} Aktif Çağrı`
                  : "Aktif Çağrı Yok"}
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 truncate" title={`${host.os_name} (${host.kernel})`}>
              {host.os_name}
            </div>
          </div>
        </div>
      )}

      {/* Host Power Controls (Reboot / Shutdown) */}
      <div className={`p-5 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/70 dark:border-rose-900/60 flex items-center justify-center shrink-0">
            <Power size={19} />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Sunucu Güç Kontrolü (Yeniden Başlat / Kapat)
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              İşletim sistemini güvenli biçimde yeniden başlatın (Reboot) veya bakım öncesi kapatın (Power Off). Kapatma işlemi için çift onay istenir.
            </p>
          </div>
        </div>
        {canPower ? (
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              disabled={Boolean(busyKey)}
              onClick={() => requestHostPower("reboot")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <RotateCw size={14} className={busyKey === "host:reboot" ? "animate-spin" : ""} />
              <span>Sunucuyu Yeniden Başlat</span>
            </button>
            <button
              type="button"
              disabled={Boolean(busyKey)}
              onClick={() => requestHostPower("poweroff")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Power size={14} />
              <span>Sunucuyu Kapat</span>
            </button>
          </div>
        ) : (
          <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            Reboot / Kapat yetkisi rolünüzde kapalı
          </span>
        )}
      </div>

      {/* Managed Services List */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Santral &amp; Sistem Servisleri
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Servisleri tek tıkla başlatın, durdurun, yeniden başlatın veya canlı günlük (log) çıktılarını inceleyin.
            </p>
          </div>
        </div>

        {loading && services.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={22} className={`animate-spin ${text}`} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {services.map((svc) => {
              const badge = STATUS_BADGE[svc.status] || STATUS_BADGE.stopped;
              const isRunning = svc.status === "running";
              const allowed = Array.isArray(svc.allowed_actions) ? svc.allowed_actions : [];
              const rowBusy = busyKey.startsWith(`${svc.id}:`);

              return (
                <div
                  key={svc.id}
                  className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-1.5 shrink-0">
                      <span className={`block w-2.5 h-2.5 rounded-full ${badge.dot}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-xs text-slate-800 dark:text-white">
                          {svc.name}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                          {svc.kind === "pm2" ? `PM2: ${svc.unit}` : svc.unit}
                        </span>
                        {svc.critical && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 text-[9px] font-extrabold uppercase">
                            Kritik
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{svc.description}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-slate-400 flex-wrap">
                        {svc.pid > 0 && <span>PID: {svc.pid}</span>}
                        {svc.memory_mb > 0 && <span>RAM: {svc.memory_mb} MB</span>}
                        {svc.uptime && <span>Süre: {svc.uptime}</span>}
                        {typeof svc.restarts === "number" && svc.kind === "pm2" && (
                          <span>Restart: {svc.restarts}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    {canManageServices && allowed.includes("start") && !isRunning && (
                      <button
                        type="button"
                        disabled={Boolean(busyKey)}
                        onClick={() => requestServiceAction(svc, "start")}
                        title="Servisi Başlat"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <Play size={12} />
                        <span>Başlat</span>
                      </button>
                    )}

                    {canManageServices && allowed.includes("reload") && isRunning && (
                      <button
                        type="button"
                        disabled={Boolean(busyKey)}
                        onClick={() => requestServiceAction(svc, "reload")}
                        title="Çağrı / bağlantı kesmeden yapılandırmayı yenile"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <RefreshCw size={12} className={busyKey === `${svc.id}:reload` ? "animate-spin" : ""} />
                        <span>Yenile (Reload)</span>
                      </button>
                    )}

                    {canManageServices && allowed.includes("restart") && (
                      <button
                        type="button"
                        disabled={Boolean(busyKey)}
                        onClick={() => requestServiceAction(svc, "restart")}
                        title="Servisi Yeniden Başlat"
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg ${bg} ${hover} text-white text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-40`}
                      >
                        <RotateCw size={12} className={rowBusy && busyKey.endsWith(":restart") ? "animate-spin" : ""} />
                        <span>Yeniden Başlat</span>
                      </button>
                    )}

                    {canManageServices && allowed.includes("stop") && isRunning && (
                      <button
                        type="button"
                        disabled={Boolean(busyKey)}
                        onClick={() => requestServiceAction(svc, "stop")}
                        title="Servisi Durdur"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <Square size={11} />
                        <span>Durdur</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openLogsModal(svc)}
                      title="Servis Loglarını Görüntüle"
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Terminal size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Collapsible Server Control Audit Log */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAudit((v) => !v)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-slate-400" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Son Sunucu &amp; Servis İşlem Kayıtları ({auditLogs.length})
            </span>
          </div>
          {showAudit ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
        </button>
        {showAudit && (
          <div className="px-5 pb-4 border-t border-slate-100 dark:border-slate-800 max-h-60 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">Henüz kayıtlı sunucu işlemi yok.</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/70 text-[11px]">
                {auditLogs.map((lg, idx) => (
                  <div key={`${lg.timestamp}-${idx}`} className="py-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded font-mono text-[10px] font-bold mr-2 ${
                          lg.status === "ok"
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                            : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {lg.target} • {lg.action}
                      </span>
                      <span className="text-slate-700 dark:text-slate-200">{lg.detail}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">
                      {lg.actor} • {lg.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Safety Confirmation Modal (Matches Design System) */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 animate-pulse">
                <ShieldAlert size={22} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">{confirmModal.title}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {confirmModal.message}
                </p>
              </div>
            </div>

            {confirmModal.warning && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-[11px] font-bold text-amber-800 dark:text-amber-200">
                {confirmModal.warning}
              </div>
            )}

            {confirmModal.requireText && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Onaylamak için aşağıya <span className="font-mono text-rose-600 dark:text-rose-400">{confirmModal.requireText}</span> yazın:
                </label>
                <input
                  type="text"
                  autoFocus
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder={confirmModal.requireText}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-mono font-extrabold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={
                  Boolean(confirmModal.requireText) &&
                  confirmInput.trim().toUpperCase() !== confirmModal.requireText
                }
                onClick={handleConfirmModalSubmit}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Onayla ve Uygula
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service Log Viewer Modal */}
      {logModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-100">
                <Terminal size={15} className="text-emerald-400" />
                <span className="text-xs font-extrabold">{logModal.service_name}</span>
                <span className="text-[10px] font-mono text-slate-400">({logModal.unit})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openLogsModal({ id: logModal.service_id, name: logModal.service_name, unit: logModal.unit })}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
                >
                  <RefreshCw size={11} className={logModal.loading ? "animate-spin" : ""} />
                  <span>Yenile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLogModal(null)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto flex-1">
              {logModal.loading ? (
                <div className="py-12 flex items-center justify-center text-slate-400 text-xs gap-2">
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Loglar okunuyor...</span>
                </div>
              ) : (
                <pre className="text-[11px] font-mono text-emerald-300/90 whitespace-pre-wrap break-words leading-relaxed">
                  {logModal.lines}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
