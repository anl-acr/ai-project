import React, { useState, useEffect, useCallback } from "react";
import {
  HardDrive,
  Save,
  CheckCircle,
  ShieldAlert,
  Mic,
  Sparkles,
  Plus,
  X,
  Users,
  Headphones,
  UserCheck,
  ShieldCheck,
  FileText,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  Trash2,
  Server,
  FolderSync,
  RefreshCw,
  Database,
  Wifi,
  WifiOff,
  Copy,
  ArrowRightLeft,
  FolderOpen,
  Lock,
  Activity,
} from "lucide-react";
import { useTheme } from "../../utils/theme";

const KEEP_PRESETS = [
  "ses kaydını aktif et",
  "ses kaydını başlat",
  "kayıt altına alınsın",
  "görüşmeyi kaydet",
  "ses kaydını onaylıyorum",
];

const DELETE_PRESETS = [
  "ses kaydını sil",
  "kayıt istemiyorum",
  "ses kaydını kapat",
  "kaydı durdur",
  "kayıt alınmasın",
];

function formatCapacityValue(gbVal) {
  const num = Number(gbVal || 0);
  if (num >= 1024) {
    return `${(num / 1024).toFixed(2)} TB`;
  }
  return `${num.toFixed(1)} GB`;
}

export default function RecordingRetentionSettings({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [writePermission, setWritePermission] = useState(false);

  // Standard Retention States
  const [deleteByDisk, setDeleteByDisk] = useState(true);
  const [diskThresholdPct, setDiskThresholdPct] = useState(80);
  const [deleteByDays, setDeleteByDays] = useState(false);
  const [keepDays, setKeepDays] = useState(90);

  // Dynamic Voice Recording States
  const [dynamicRecordingEnabled, setDynamicRecordingEnabled] = useState(false);
  const [dynamicMode, setDynamicMode] = useState("keep_on_match"); // "keep_on_match" | "delete_on_match"
  const [dynamicSpeaker, setDynamicSpeaker] = useState("both"); // "both" | "agent" | "caller"
  const [dynamicKeywords, setDynamicKeywords] = useState([
    "ses kaydını aktif et",
    "ses kaydını başlat",
    "kayıt altına alınsın",
    "görüşmeyi kaydet",
  ]);
  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [keepIfNoTranscript, setKeepIfNoTranscript] = useState(true);
  const [keepTranscriptOnDelete, setKeepTranscriptOnDelete] = useState(true);

  // External NAS / File Server Storage States
  const [externalStorageEnabled, setExternalStorageEnabled] = useState(false);
  const [externalStorageMode, setExternalStorageMode] = useState("move"); // "move" | "mirror"
  const [externalStorageType, setExternalStorageType] = useState("mount_path"); // "mount_path" | "smb" | "sftp"
  const [externalMountPath, setExternalMountPath] = useState("/mnt/nas/ai-recordings");
  const [externalHost, setExternalHost] = useState("");
  const [externalPort, setExternalPort] = useState(22);
  const [externalShareName, setExternalShareName] = useState("");
  const [externalRemotePath, setExternalRemotePath] = useState("/recordings");
  const [externalUsername, setExternalUsername] = useState("");
  const [externalPassword, setExternalPassword] = useState("");
  const [externalDomain, setExternalDomain] = useState("WORKGROUP");

  // Live Storage Capacity Telemetry States
  const [storageStatus, setStorageStatus] = useState(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [testingStorage, setTestingStorage] = useState(false);
  const [testResultBanner, setTestResultBanner] = useState(null);
  const [syncingNow, setSyncingNow] = useState(false);

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  const fetchStorageStatus = useCallback(async () => {
    setStorageLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/recording-retention/storage-status`);
      if (res.ok) {
        const snap = await res.json();
        setStorageStatus(snap);
      }
    } catch (err) {
      console.error("Depolama alanı durumu alınamadı:", err);
    } finally {
      setStorageLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    const fetchSettingsAndPermissions = async () => {
      setLoading(true);
      try {
        const resStatus = await fetch(`${API_BASE}/api/agent/status`);
        const statusData = await resStatus.json();
        if (!statusData.is_logged_in) {
          setWritePermission(true);
        } else {
          const resUsers = await fetch(`${API_BASE}/api/settings/users`);
          const usersData = await resUsers.json();
          const currentUser = usersData.find((u) => u.id === statusData.user_id);
          if (currentUser) {
            const resRoles = await fetch(`${API_BASE}/api/settings/roles`);
            const rolesData = await resRoles.json();
            const currentRole = rolesData.find((r) => r.role_code === currentUser.role);
            if (currentRole) {
              setWritePermission(currentRole.permissions.includes("recording_retention:write"));
            } else {
              setWritePermission(true);
            }
          } else {
            setWritePermission(true);
          }
        }

        const resSettings = await fetch(`${API_BASE}/api/settings/recording-retention`);
        if (resSettings.ok) {
          const data = await resSettings.json();
          setDeleteByDisk(data.delete_by_disk ?? true);
          setDiskThresholdPct(data.disk_threshold_pct ?? 80);
          setDeleteByDays(data.delete_by_days ?? false);
          setKeepDays(data.keep_days ?? 90);
          setDynamicRecordingEnabled(Boolean(data.dynamic_recording_enabled));
          setDynamicMode(data.dynamic_mode || "keep_on_match");
          setDynamicSpeaker(data.dynamic_speaker || "both");
          if (Array.isArray(data.dynamic_keywords)) {
            setDynamicKeywords(data.dynamic_keywords);
          }
          setKeepIfNoTranscript(data.keep_if_no_transcript ?? true);
          setKeepTranscriptOnDelete(data.keep_transcript_on_delete ?? true);

          setExternalStorageEnabled(Boolean(data.external_storage_enabled));
          setExternalStorageMode(data.external_storage_mode || "move");
          setExternalStorageType(data.external_storage_type || "mount_path");
          setExternalMountPath(data.external_mount_path || "/mnt/nas/ai-recordings");
          setExternalHost(data.external_host || "");
          setExternalPort(data.external_port ?? 22);
          setExternalShareName(data.external_share_name || "");
          setExternalRemotePath(data.external_remote_path || "/recordings");
          setExternalUsername(data.external_username || "");
          setExternalPassword(data.external_password || "");
          setExternalDomain(data.external_domain || "WORKGROUP");
        }
      } catch (err) {
        console.error("Ses kayıt ayarları yüklenirken hata:", err);
        setWritePermission(true);
      } finally {
        setLoading(false);
      }
    };

    fetchSettingsAndPermissions();
    fetchStorageStatus();
  }, [backendHost, fetchStorageStatus]);

  const handleAddKeyword = (phrase) => {
    if (!writePermission) return;
    const cleaned = String(phrase ?? newKeywordInput)
      .trim()
      .replace(/\s+/g, " ");
    if (!cleaned) return;
    const exists = dynamicKeywords.some((k) => k.toLowerCase() === cleaned.toLowerCase());
    if (!exists) {
      setDynamicKeywords((prev) => [...prev, cleaned]);
    }
    if (phrase === undefined) {
      setNewKeywordInput("");
    }
  };

  const handleRemoveKeyword = (targetKw) => {
    if (!writePermission) return;
    setDynamicKeywords((prev) => prev.filter((k) => k !== targetKw));
  };

  const handleTestExternalStorage = async () => {
    setTestingStorage(true);
    setTestResultBanner(null);
    try {
      const res = await fetch(`${API_BASE}/api/settings/recording-retention/test-storage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          external_storage_enabled: true,
          external_storage_mode: externalStorageMode,
          external_storage_type: externalStorageType,
          external_mount_path: externalMountPath,
          external_host: externalHost,
          external_port: parseInt(externalPort) || 22,
          external_share_name: externalShareName,
          external_remote_path: externalRemotePath,
          external_username: externalUsername,
          external_password: externalPassword,
          external_domain: externalDomain,
        }),
      });
      const data = await res.json();
      if (data.storage_status) {
        setStorageStatus(data.storage_status);
      }
      setTestResultBanner({
        type: data.status === "success" ? "success" : "error",
        message: data.message || "Test tamamlandı.",
      });
    } catch (err) {
      setTestResultBanner({
        type: "error",
        message: `Bağlantı testi sırasında hata oluştu: ${err.message}`,
      });
    } finally {
      setTestingStorage(false);
    }
  };

  const handleSyncPendingNow = async () => {
    if (!writePermission) return;
    setSyncingNow(true);
    setTestResultBanner(null);
    try {
      const res = await fetch(`${API_BASE}/api/settings/recording-retention/sync-now`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.storage_status) {
        setStorageStatus(data.storage_status);
      }
      setTestResultBanner({
        type: data.status === "success" ? "success" : "error",
        message: data.message || "Senkronizasyon tamamlandı.",
      });
    } catch (err) {
      setTestResultBanner({
        type: "error",
        message: `Senkronizasyon sırasında hata: ${err.message}`,
      });
    } finally {
      setSyncingNow(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!writePermission) return;
    setLoading(true);
    setSuccess(false);

    try {
      const res = await fetch(`${API_BASE}/api/settings/recording-retention`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delete_by_disk: deleteByDisk,
          disk_threshold_pct: parseInt(diskThresholdPct) || 80,
          delete_by_days: deleteByDays,
          keep_days: parseInt(keepDays) || 90,
          dynamic_recording_enabled: dynamicRecordingEnabled,
          dynamic_mode: dynamicMode,
          dynamic_speaker: dynamicSpeaker,
          dynamic_keywords: dynamicKeywords,
          keep_if_no_transcript: keepIfNoTranscript,
          keep_transcript_on_delete: keepTranscriptOnDelete,
          external_storage_enabled: externalStorageEnabled,
          external_storage_mode: externalStorageMode,
          external_storage_type: externalStorageType,
          external_mount_path: externalMountPath,
          external_host: externalHost,
          external_port: parseInt(externalPort) || 22,
          external_share_name: externalShareName,
          external_remote_path: externalRemotePath,
          external_username: externalUsername,
          external_password: externalPassword,
          external_domain: externalDomain,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        fetchStorageStatus();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Ses kayıt ayarları kaydedilemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const activePresets = dynamicMode === "delete_on_match" ? DELETE_PRESETS : KEEP_PRESETS;

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 ${lightBg} ${text} rounded-xl flex items-center justify-center shrink-0`}>
            <HardDrive size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-850 dark:text-slate-100">
              Ses Kayıt Saklama ve Dinamik Kayıt Politikası
            </h3>
            <p className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 uppercase tracking-wider mt-0.5">
              Voice Recording Lifecycle & Dynamic Keyword Retention
            </p>
          </div>
        </div>

          {/* Live Mode Status Pill */}
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-extrabold ${
                externalStorageEnabled
                  ? `${lightBg} ${text} ${borderLight}`
                  : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              }`}
            >
              <Server size={13} />
              <span>
                {externalStorageEnabled
                  ? `Harici Depolama Aktif (${
                      externalStorageMode === "mirror" ? "Çift Yedekli" : "NAS'a Taşı"
                    })`
                  : "Yerel Sunucu Depolama"}
              </span>
            </div>

            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-extrabold ${
                dynamicRecordingEnabled
                  ? `${lightBg} ${text} ${borderLight}`
                  : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  dynamicRecordingEnabled ? `${bg} animate-pulse` : "bg-emerald-500"
                }`}
              />
              <span>
                {dynamicRecordingEnabled
                  ? "Dinamik Ses Kaydı Aktif (Kelime Tetiklemeli)"
                  : "Standart Kayıt Aktif (Her Çağrıyı Kaydet)"}
              </span>
            </div>
          </div>
      </div>

      {!writePermission && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-semibold">
          <ShieldAlert size={16} className={text} />
          <span>Düzenleme yetkiniz bulunmamaktadır. Ayarları sadece görüntüleyebilirsiniz.</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-xs font-semibold animate-in fade-in duration-200">
          <CheckCircle size={16} />
          <span>Ses kayıt saklama, dinamik kayıt ve harici depolama ayarları başarıyla kaydedildi.</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* LIVE DISK CAPACITY & STORAGE TELEMETRY DASHBOARD                    */}
      {/* =================================================================== */}
      <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${lightBg} ${text}`}>
              <Database size={18} />
            </div>
            <div>
              <h4 className="font-black text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                Canlı Disk Alanı ve Kapasite İzleme Paneli
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Yerel sunucu diski ve harici NAS / File Server üzerindeki anlık doluluk, boş alan ve tahmini ses kaydı kapasitesi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {externalStorageEnabled && writePermission && (
              <button
                type="button"
                disabled={syncingNow}
                onClick={handleSyncPendingNow}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer disabled:opacity-50 ${lightBg} ${text} ${borderLight}`}
                title="Yerel diskte bekleyen ses kayıtlarını harici sunucuya şimdi aktar"
              >
                <FolderSync size={14} className={syncingNow ? "animate-spin" : ""} />
                <span>{syncingNow ? "Aktarılıyor..." : "Bekleyen Kayıtları Şimdi Aktar"}</span>
              </button>
            )}
            <button
              type="button"
              disabled={storageLoading}
              onClick={fetchStorageStatus}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
              title="Disk Kapasite Bilgilerini Yenile"
            >
              <RefreshCw size={13} className={storageLoading ? "animate-spin" : ""} />
              <span>Kapasiteyi Yenile</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card 1: Local Server Disk */}
          {(() => {
            const loc = storageStatus?.local_storage || {};
            const usedPct = Number(loc.used_percent || 0);
            const freePct = Math.max(0, Number((100 - usedPct).toFixed(1)));
            const barColor =
              usedPct >= 90
                ? "bg-rose-600"
                : usedPct >= 75
                ? "bg-amber-500"
                : "bg-emerald-500";
            return (
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col gap-3 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <HardDrive size={16} className="text-slate-600 dark:text-slate-300" />
                    <div>
                      <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                        Yerel Sunucu Diski (Local Storage)
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate max-w-[260px]">
                        {loc.path || "/app/recordings"}
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                    <Wifi size={11} />
                    Çevrimiçi
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-600 dark:text-slate-300">
                      Kullanılan: {formatCapacityValue(loc.used_gb)} (%{usedPct})
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                      Boş Alan: {formatCapacityValue(loc.free_gb)} (%{freePct})
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor} transition-all duration-300 rounded-full`}
                      style={{ width: `${Math.min(100, Math.max(2, usedPct))}%` }}
                    />
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-center">
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Toplam Disk</div>
                    <div className="text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">
                      {formatCapacityValue(loc.total_gb)}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Yerel Ses Kaydı</div>
                    <div className="text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">
                      {loc.recordings_count ?? 0} Dosya ({loc.recordings_size_mb ?? 0} MB)
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Kalan Kapasite</div>
                    <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                      ~{(loc.estimated_remaining_hours ?? 0).toLocaleString("tr-TR")} Saat
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Card 2: External NAS / File Server Disk */}
          {(() => {
            const ext = storageStatus?.external_storage || {};
            const isOnline = Boolean(ext.online && ext.writable);
            const usedPct = Number(ext.used_percent || 0);
            const freePct = Math.max(0, Number((100 - usedPct).toFixed(1)));
            const barColor =
              usedPct >= 90
                ? "bg-rose-600"
                : usedPct >= 75
                ? "bg-amber-500"
                : "bg-emerald-500";

            return (
              <div
                className={`p-4 rounded-xl bg-white dark:bg-slate-900 border flex flex-col gap-3 shadow-xs ${
                  externalStorageEnabled
                    ? isOnline
                      ? "border-emerald-200 dark:border-emerald-800/70"
                      : "border-rose-300 dark:border-rose-800/80"
                    : "border-slate-200/80 dark:border-slate-800 opacity-85"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Server size={16} className={externalStorageEnabled ? text : "text-slate-400"} />
                    <div>
                      <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <span>Harici NAS / File Server Diski</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase">
                          {externalStorageType === "mount_path"
                            ? "Dizine Bağlı (NAS/NFS)"
                            : externalStorageType.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate max-w-[260px]">
                        {ext.path ||
                          (externalStorageType === "mount_path"
                            ? externalMountPath
                            : `${externalHost || "Sunucu seçilmedi"}:${externalRemotePath}`)}
                      </div>
                    </div>
                  </div>

                  {!externalStorageEnabled ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-500">
                      Devre Dışı
                    </span>
                  ) : isOnline ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                      <Wifi size={11} />
                      Bağlı & Yazılabilir
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
                      <WifiOff size={11} />
                      Bağlantı Yok / Yerel Yedekte
                    </span>
                  )}
                </div>

                {ext.total_gb > 0 ? (
                  <>
                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-slate-600 dark:text-slate-300">
                          Kullanılan: {formatCapacityValue(ext.used_gb)} (%{usedPct})
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                          Boş Alan: {formatCapacityValue(ext.free_gb)} (%{freePct})
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} transition-all duration-300 rounded-full`}
                          style={{ width: `${Math.min(100, Math.max(2, usedPct))}%` }}
                        />
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-center">
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Toplam Alan</div>
                        <div className="text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">
                          {formatCapacityValue(ext.total_gb)}
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Harici Kayıtlar</div>
                        <div className="text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">
                          {ext.recordings_count ?? 0} Dosya ({ext.recordings_size_mb ?? 0} MB)
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Kalan Kapasite</div>
                        <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                          ~{(ext.estimated_remaining_hours ?? 0).toLocaleString("tr-TR")} Saat
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col justify-center items-center text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    {ext.error ? (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold">
                        ⚠️ {ext.error} — Ses kayıtları veri kaybı olmaması için yerel diskte güvenle tutuluyor.
                      </span>
                    ) : (
                      <span>
                        Harici bir NAS veya File Server aktif edildiğinde karşı sunucunun toplam ve boş disk kapasitesi burada canlı olarak gösterilir.
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* =================================================================== */}
        {/* SECTION 0: EXTERNAL NAS / FILE SERVER VOICE RECORDING STORAGE       */}
        {/* =================================================================== */}
        <div
          className={`p-5 rounded-2xl border transition-all flex flex-col gap-5 ${
            externalStorageEnabled
              ? `bg-slate-50/80 dark:bg-slate-900/90 ${border}`
              : "bg-slate-50/50 dark:bg-slate-950/30 border-slate-200/80 dark:border-slate-800"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  externalStorageEnabled
                    ? `${bg} text-white shadow-sm`
                    : "bg-slate-200/70 dark:bg-slate-800 text-slate-500"
                }`}
              >
                <Server size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">
                    Harici Depolama (NAS / File Server Ses Kayıt Aktarımı)
                  </h4>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wide ${
                      externalStorageEnabled
                        ? `${lightBg} ${text} border ${borderLight}`
                        : "bg-slate-200/70 dark:bg-slate-800 text-slate-500"
                    }`}
                  >
                    {externalStorageEnabled ? "AÇIK" : "KAPALI"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {externalStorageEnabled
                    ? "Harici depolama AÇIK: Çağrı tamamlandığında (ve dinamik kayıt politikası onayladığında) ses kayıtları otomatik olarak harici NAS / File Server üzerine yazılır. Harici sunucuya ulaşılamazsa kayıtlar yerel diskte korunur ve bağlantı geldiğinde aktarılır."
                    : "Harici depolama KAPALI: Tüm ses kayıtları yalnızca mevcut PBX sunucusunun yerel diskinde (/app/recordings) saklanır."}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={!writePermission}
              onClick={() => setExternalStorageEnabled((prev) => !prev)}
              className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
              title={externalStorageEnabled ? "Harici Depolamayı Kapat" : "Harici Depolamayı Aç"}
            >
              {externalStorageEnabled ? (
                <ToggleRight size={36} className={text} />
              ) : (
                <ToggleLeft size={36} />
              )}
            </button>
          </div>

          {externalStorageEnabled && (
            <div className="space-y-5 pt-2 border-t border-slate-200/70 dark:border-slate-800 animate-in fade-in duration-200">
              {/* 1. Storage Strategy Mode (Move vs Mirror) */}
              <div className="space-y-2">
                <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                  1. Harici Kayıt Saklama Çalışma Modu
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!writePermission}
                    onClick={() => setExternalStorageMode("move")}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      externalStorageMode === "move"
                        ? `bg-white dark:bg-slate-950 ${border} ring-2 ${ring} shadow-sm`
                        : "bg-white/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        externalStorageMode === "move"
                          ? `${bg} text-white`
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      <ArrowRightLeft size={16} />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                        Sadece Harici Sunucuda Tut (Taşı / Move)
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Ses dosyası harici NAS / File Server&apos;a eksiksiz yazıldıktan ve boyutu doğrulandıktan sonra{" "}
                        <strong>yerel sunucu diskinden silinir</strong>. Yerel diski doldurmaz.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={!writePermission}
                    onClick={() => setExternalStorageMode("mirror")}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      externalStorageMode === "mirror"
                        ? `bg-white dark:bg-slate-950 ${border} ring-2 ${ring} shadow-sm`
                        : "bg-white/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        externalStorageMode === "mirror"
                          ? `${bg} text-white`
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      <Copy size={16} />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                        Çift Yedekli Sakla (Hem Yerel Hem Harici / Mirror)
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Ses kaydının bir kopyası yerel sunucuda kalır, ikinci bir kopyası felaket kurtarma (Disaster Recovery) için{" "}
                        <strong>harici sunucuya yedeklenir</strong>.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Protocol / Storage Connection Type */}
              <div className="space-y-2">
                <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                  2. Bağlantı Türü / Protokol Seçimi
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    {
                      id: "mount_path",
                      title: "Bağlı Disk / NAS Dizini (NFS / Local Mount)",
                      desc: "Sunucuya bağlı harici disk veya /mnt/nas gibi bağlanmış ağ klasörü.",
                      icon: FolderOpen,
                    },
                    {
                      id: "smb",
                      title: "Windows File Server / NAS (SMB / CIFS)",
                      desc: "IP adresi, Paylaşım Adı (Share) ve kullanıcı bilgisi ile SMB bağlantısı.",
                      icon: Server,
                    },
                    {
                      id: "sftp",
                      title: "Uzak Linux / Depolama Sunucusu (SFTP / SSH)",
                      desc: "SSH/SFTP protokolü üzerinden şifreli uzak sunucu klasörüne aktarım.",
                      icon: Lock,
                    },
                  ].map((typeOpt) => {
                    const IconComp = typeOpt.icon;
                    const isSelected = externalStorageType === typeOpt.id;
                    return (
                      <button
                        key={typeOpt.id}
                        type="button"
                        disabled={!writePermission}
                        onClick={() => {
                          setExternalStorageType(typeOpt.id);
                          if (typeOpt.id === "smb" && externalPort === 22) setExternalPort(445);
                          if (typeOpt.id === "sftp" && externalPort === 445) setExternalPort(22);
                        }}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                          isSelected
                            ? `bg-white dark:bg-slate-950 ${border} ring-2 ${ring} shadow-sm`
                            : "bg-white/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            isSelected ? `${lightBg} ${text}` : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                          }`}
                        >
                          <IconComp size={15} />
                        </div>
                        <div>
                          <div className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                            {typeOpt.title}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            {typeOpt.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Connection Details Inputs */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-4">
                {externalStorageType === "mount_path" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 dark:text-slate-200 block">
                      Harici Disk / NAS Klasör Yolu (Mount Path)
                    </label>
                    <input
                      type="text"
                      value={externalMountPath}
                      disabled={!writePermission}
                      onChange={(e) => setExternalMountPath(e.target.value)}
                      placeholder="/mnt/nas/ai-recordings"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Örn: <code>/mnt/nas/recordings</code>, <code>/media/external-hdd/pbx</code>. Sistem bu dizindeki toplam ve boş disk alanını otomatik okur.
                    </p>
                  </div>
                )}

                {externalStorageType === "smb" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        NAS / File Server IP veya Host
                      </label>
                      <input
                        type="text"
                        value={externalHost}
                        disabled={!writePermission}
                        onChange={(e) => setExternalHost(e.target.value)}
                        placeholder="192.168.1.200"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        Paylaşım Adı (SMB Share Name)
                      </label>
                      <input
                        type="text"
                        value={externalShareName}
                        disabled={!writePermission}
                        onChange={(e) => setExternalShareName(e.target.value)}
                        placeholder="SesKayitlari"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        Alt Klasör Yolu (Opsiyonel)
                      </label>
                      <input
                        type="text"
                        value={externalRemotePath}
                        disabled={!writePermission}
                        onChange={(e) => setExternalRemotePath(e.target.value)}
                        placeholder="/pbx-recordings"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        Kullanıcı Adı
                      </label>
                      <input
                        type="text"
                        value={externalUsername}
                        disabled={!writePermission}
                        onChange={(e) => setExternalUsername(e.target.value)}
                        placeholder="nas_user"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        Şifre
                      </label>
                      <input
                        type="password"
                        value={externalPassword}
                        disabled={!writePermission}
                        onChange={(e) => setExternalPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        Domain / Workgroup ve Yerel Bağlama Dizini
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={externalDomain}
                          disabled={!writePermission}
                          onChange={(e) => setExternalDomain(e.target.value)}
                          placeholder="WORKGROUP"
                          className="w-28 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                        />
                        <input
                          type="text"
                          value={externalMountPath}
                          disabled={!writePermission}
                          onChange={(e) => setExternalMountPath(e.target.value)}
                          placeholder="/mnt/nas/ai-recordings"
                          className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {externalStorageType === "sftp" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        SFTP / SSH Sunucu IP veya Host
                      </label>
                      <input
                        type="text"
                        value={externalHost}
                        disabled={!writePermission}
                        onChange={(e) => setExternalHost(e.target.value)}
                        placeholder="10.0.0.50"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        SSH Port
                      </label>
                      <input
                        type="number"
                        value={externalPort}
                        disabled={!writePermission}
                        onChange={(e) => setExternalPort(Number(e.target.value || 22))}
                        placeholder="22"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        Uzak Hedef Klasör (Remote Path)
                      </label>
                      <input
                        type="text"
                        value={externalRemotePath}
                        disabled={!writePermission}
                        onChange={(e) => setExternalRemotePath(e.target.value)}
                        placeholder="/mnt/storage/recordings"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        SSH Kullanıcı Adı
                      </label>
                      <input
                        type="text"
                        value={externalUsername}
                        disabled={!writePermission}
                        onChange={(e) => setExternalUsername(e.target.value)}
                        placeholder="root"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        SSH Şifresi
                      </label>
                      <input
                        type="password"
                        value={externalPassword}
                        disabled={!writePermission}
                        onChange={(e) => setExternalPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                )}

                {/* Test Connection & Write Permission Action Bar */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                    <span>
                      <strong>Kesintisiz Yedekleme Güvencesi:</strong> Harici NAS bağlantısı koparsa ses kayıtları silinmez; yerel diskte bekletilir ve bağlantı geldiğinde aktarılır.
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={testingStorage || !writePermission}
                    onClick={handleTestExternalStorage}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer disabled:opacity-50 ${lightBg} ${text} ${borderLight}`}
                  >
                    <Activity size={14} className={testingStorage ? "animate-spin" : ""} />
                    <span>
                      {testingStorage
                        ? "Bağlantı ve Disk Alanı Test Ediliyor..."
                        : "Bağlantıyı ve Yazma İznini Test Et"}
                    </span>
                  </button>
                </div>

                {testResultBanner && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
                      testResultBanner.ok
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
                        : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
                    }`}
                  >
                    <span>
                      {testResultBanner.ok ? "✅ " : "❌ "}
                      {testResultBanner.message}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTestResultBanner(null)}
                      className="opacity-70 hover:opacity-100 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* SECTION 1: DYNAMIC VOICE RECORDING (ANAHTAR KELİME TETİKLEMELİ)      */}
        {/* =================================================================== */}
        <div
          className={`p-5 rounded-2xl border transition-all flex flex-col gap-5 ${
            dynamicRecordingEnabled
              ? `bg-slate-50/80 dark:bg-slate-900/90 ${border}`
              : "bg-slate-50/50 dark:bg-slate-950/30 border-slate-200/80 dark:border-slate-800"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  dynamicRecordingEnabled
                    ? `${bg} text-white shadow-sm`
                    : "bg-slate-200/70 dark:bg-slate-800 text-slate-500"
                }`}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">
                    Dinamik Ses Kaydı (Anahtar Kelime Tetiklemeli)
                  </h4>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wide ${
                      dynamicRecordingEnabled
                        ? `${lightBg} ${text} border ${borderLight}`
                        : "bg-slate-200/70 dark:bg-slate-800 text-slate-500"
                    }`}
                  >
                    {dynamicRecordingEnabled ? "AÇIK" : "KAPALI"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {dynamicRecordingEnabled
                    ? "Dinamik ses kaydı AÇIK: Çağrılar 00:00 saniyeden itibaren kaydedilir. Görüşme bittiğinde konuşma metni (STT) taranır; belirlediğiniz tetikleyici kelime kuralına göre ses kaydı saklanır veya otomatik silinir."
                    : "Dinamik ses kaydı KAPALI: Sistem standart modda çalışır. Kullanıcı ayarlarında (Kullanıcılar > Özellikler > Ses Kayıt) ses kaydı açık olan kullanıcıların ve AI asistanların tüm çağrıları eksiksiz kaydedilir."}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={!writePermission}
              onClick={() => setDynamicRecordingEnabled((prev) => !prev)}
              className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
              title={dynamicRecordingEnabled ? "Dinamik Ses Kaydını Kapat" : "Dinamik Ses Kaydını Aç"}
            >
              {dynamicRecordingEnabled ? (
                <ToggleRight size={36} className={text} />
              ) : (
                <ToggleLeft size={36} />
              )}
            </button>
          </div>

          {/* Standard Mode Reassurance Banner when Dynamic Recording is OFF */}
          {!dynamicRecordingEnabled && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs">
              <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <span className="font-extrabold">Standart Kayıt Güvencesi: </span>
                <span>
                  Dinamik ses kaydı kapalı olduğu sürece hiçbir çağrı kelime filtresine takılmaz.{" "}
                  <strong>Kullanıcılar</strong> ekranında <strong>Ses Kayıt</strong> özelliği açık olan tüm dahililerin
                  ve AI temsilcilerin ses kayıtları %100 oranında saklanır.
                </span>
              </div>
            </div>
          )}

          {/* Full Dynamic Recording Configuration Panel when ON */}
          {dynamicRecordingEnabled && (
            <div className="space-y-5 pt-2 border-t border-slate-200/70 dark:border-slate-800 animate-in fade-in duration-200">
              {/* 1. Operating Mode Selector (Opt-In vs Opt-Out) */}
              <div className="space-y-2">
                <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                  1. Dinamik Kayıt Çalışma Modu
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!writePermission}
                    onClick={() => setDynamicMode("keep_on_match")}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      dynamicMode === "keep_on_match"
                        ? `bg-white dark:bg-slate-950 ${border} ring-2 ${ring} shadow-sm`
                        : "bg-white/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        dynamicMode === "keep_on_match"
                          ? `${bg} text-white`
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                        Mod 1: Sadece Tetikleyici Geçerse Sakla (Opt-In)
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Çağrı içinde aşağıdaki anahtar kelimelerden biri{" "}
                        <strong>geçerse ses kaydı saklanır</strong>; geçmezse çağrı sonunda ses dosyası{" "}
                        <strong>otomatik silinir</strong>.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={!writePermission}
                    onClick={() => setDynamicMode("delete_on_match")}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      dynamicMode === "delete_on_match"
                        ? `bg-white dark:bg-slate-950 ${border} ring-2 ${ring} shadow-sm`
                        : "bg-white/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        dynamicMode === "delete_on_match"
                          ? `${bg} text-white`
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      <Trash2 size={16} />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                        Mod 2: Tetikleyici Geçerse Sil (Opt-Out / KVKK)
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Varsayılan olarak tüm çağrılar saklanır; ancak çağrı içinde silme tetikleyicisi (örn.{" "}
                        <em>&ldquo;ses kaydını sil&rdquo;</em>) <strong>geçerse ses kaydı silinir</strong>.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Speaker Filter Selector */}
              <div className="space-y-2">
                <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                  2. Konuşmacı Yetkisi (Kelimeyi Kim Söylediğinde Geçerli Olsun?)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    {
                      id: "both",
                      title: "Herhangi Biri (Temsilci veya Müşteri)",
                      desc: "Temsilci, AI Asistan veya Müşteri söylediğinde kural tetiklenir.",
                      icon: Users,
                    },
                    {
                      id: "agent",
                      title: "Sadece Temsilci / AI Söylediğinde",
                      desc: "Sadece müşteri temsilcisi veya AI asistan söylediğinde geçerli olur.",
                      icon: Headphones,
                    },
                    {
                      id: "caller",
                      title: "Sadece Müşteri Söylediğinde",
                      desc: "Sadece arayan müşteri/karşı taraf söylediğinde geçerli olur.",
                      icon: UserCheck,
                    },
                  ].map((spkOpt) => {
                    const IconComp = spkOpt.icon;
                    const isSelected = dynamicSpeaker === spkOpt.id;
                    return (
                      <button
                        key={spkOpt.id}
                        type="button"
                        disabled={!writePermission}
                        onClick={() => setDynamicSpeaker(spkOpt.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                          isSelected
                            ? `bg-white dark:bg-slate-950 ${border} ring-2 ${ring} shadow-sm`
                            : "bg-white/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            isSelected ? `${lightBg} ${text}` : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                          }`}
                        >
                          <IconComp size={15} />
                        </div>
                        <div>
                          <div className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                            {spkOpt.title}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            {spkOpt.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Trigger Keywords & Phrases */}
              <div className="bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <label className="text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Mic size={14} className={text} />
                      <span>
                        3. Tetikleyici Anahtar Kelime ve Cümleler ({dynamicKeywords.length} Adet)
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Çağrı transkriptinde bu ifadelerden <strong>herhangi biri</strong> geçtiğinde kural tetiklenir (büyük/küçük harf ve Türkçe karakter duyarsız).
                    </p>
                  </div>
                </div>

                {/* Add new keyword input + Unified Red Plus Button */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newKeywordInput}
                    disabled={!writePermission}
                    onChange={(e) => setNewKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddKeyword();
                      }
                    }}
                    placeholder={
                      dynamicMode === "keep_on_match"
                        ? "Örn: ses kaydını aktif et, kaydı başlat, görüşmeyi kaydet..."
                        : "Örn: ses kaydını sil, kayıt istemiyorum..."
                    }
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    disabled={!writePermission || !newKeywordInput.trim()}
                    onClick={() => handleAddKeyword()}
                    title="Tetikleyici Kelime / Cümle Ekle"
                    className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition cursor-pointer disabled:opacity-40"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Active Keyword Chips */}
                {dynamicKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {dynamicKeywords.map((kw) => (
                      <span
                        key={kw}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${lightBg} ${text} ${borderLight}`}
                      >
                        <span>&ldquo;{kw}&rdquo;</span>
                        {writePermission && (
                          <button
                            type="button"
                            onClick={() => handleRemoveKeyword(kw)}
                            className="hover:opacity-75 transition cursor-pointer"
                            title="Kelimeyi Kaldır"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                    ⚠️ Henüz hiçbir tetikleyici kelime eklenmedi. Güvenlik amacıyla kelime listesi boşken hiçbir ses kaydı silinmez.
                  </div>
                )}

                {/* Preset Quick-Add Suggestions */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                    Hazır Kalıplar:
                  </span>
                  {activePresets.map((preset) => {
                    const alreadyAdded = dynamicKeywords.some(
                      (k) => k.toLowerCase() === preset.toLowerCase()
                    );
                    return (
                      <button
                        key={preset}
                        type="button"
                        disabled={!writePermission || alreadyAdded}
                        onClick={() => handleAddKeyword(preset)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                          alreadyAdded
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-800 opacity-50 cursor-default"
                            : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        + {preset}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Safety Locks & Transcript Preservation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                        Transkript Hatasında Kaydı Koru (Güvenli Mod)
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        Görüşmede konuşma olduğu halde teknik bir STT hatası nedeniyle metin çıkarılamazsa ses kaydını silme, koru.
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={keepIfNoTranscript}
                    disabled={!writePermission}
                    onChange={(e) => setKeepIfNoTranscript(e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-rose-500 h-4 w-4 cursor-pointer mt-1 shrink-0 disabled:opacity-50"
                  />
                </div>

                <div className="p-3.5 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <FileText size={16} className={`${text} shrink-0 mt-0.5`} />
                    <div>
                      <div className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                        Ses Silindiğinde Yazılı Transkripti Sakla
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        Ses dosyası (.wav) dinamik kural gereği silinse bile çağrının yazılı transkriptini ve AI özetini koru.
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={keepTranscriptOnDelete}
                    disabled={!writePermission}
                    onChange={(e) => setKeepTranscriptOnDelete(e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-rose-500 h-4 w-4 cursor-pointer mt-1 shrink-0 disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* SECTION 2: DISK THRESHOLD RETENTION                                 */}
        {/* =================================================================== */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-955/20 border border-slate-100 dark:border-slate-850 rounded-2xl flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-black text-xs text-slate-800 dark:text-slate-200">
                Disk Doluluk Oranına Göre Silme
              </h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Sistem diski belirlenen limitin üzerine çıktığında en eski ses kayıtlarını otomatik olarak temizler.
              </p>
            </div>
            <input
              type="checkbox"
              checked={deleteByDisk}
              disabled={!writePermission}
              onChange={(e) => setDeleteByDisk(e.target.checked)}
              className="rounded border-slate-300 text-primary focus:ring-rose-500 h-4 w-4 cursor-pointer disabled:opacity-50"
            />
          </div>

          {deleteByDisk && (
            <div className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-xl mt-1 animate-in slide-in-from-top-2 duration-150">
              <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Silme Eşiği (Disk Doluluğu)
                  </span>
                  <span className={`text-xs font-black ${text}`}>%{diskThresholdPct}</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  value={diskThresholdPct}
                  disabled={!writePermission}
                  onChange={(e) => setDiskThresholdPct(e.target.value)}
                  className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-600 disabled:opacity-50"
                />
              </div>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* SECTION 3: DAYS BASED RETENTION                                     */}
        {/* =================================================================== */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-955/20 border border-slate-100 dark:border-slate-850 rounded-2xl flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-black text-xs text-slate-800 dark:text-slate-200">
                Zaman Aşımına Göre Silme (Periyodik)
              </h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Belirtilen gün sayısından daha eski olan tüm ses kayıtlarını düzenli olarak sistemden temizler.
              </p>
            </div>
            <input
              type="checkbox"
              checked={deleteByDays}
              disabled={!writePermission}
              onChange={(e) => setDeleteByDays(e.target.checked)}
              className="rounded border-slate-300 text-primary focus:ring-rose-500 h-4 w-4 cursor-pointer disabled:opacity-50"
            />
          </div>

          {deleteByDays && (
            <div className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-xl mt-1 animate-in slide-in-from-top-2 duration-150">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider">
                  Kayıt Tutma Süresi (Gün)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    value={keepDays}
                    disabled={!writePermission}
                    onChange={(e) => setKeepDays(e.target.value)}
                    className="w-32 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-rose-500 font-bold"
                  />
                  <span className="text-xs font-semibold text-slate-550 dark:text-slate-455">
                    gün sonra silinir.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Never delete safeguard */}
        {!deleteByDisk && !deleteByDays && !dynamicRecordingEnabled && (
          <div className="p-4 bg-rose-50/50 dark:bg-rose-955/10 border border-rose-100/65 dark:border-rose-900/30 rounded-2xl flex flex-col gap-1">
            <h4 className={`font-black text-xs ${text}`}>
              ⚠️ Koruma Modu Aktif (Ömür Boyu Saklama)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 leading-relaxed">
              Tüm silme filtreleri kapalı olduğu için ses kayıtları{" "}
              <strong>asla otomatik olarak silinmeyecektir</strong>. Disk dolup sistem kilitlenene kadar tüm
              geçmiş kayıtlar muhafaza edilir.
            </p>
          </div>
        )}

        {/* Save action button */}
        {writePermission && (
          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={loading}
              className={`flex items-center gap-2 ${bg} ${hover} text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50`}
            >
              <Save size={14} />
              <span>{loading ? "Kaydediliyor..." : "Ayarları Kaydet"}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
