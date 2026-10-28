import React, { useState, useEffect, useCallback } from "react";
import {
  DownloadCloud,
  UploadCloud,
  AlertTriangle,
  Shield,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  RefreshCw,
  Database,
  Server,
  ToggleLeft,
  ToggleRight,
  Activity,
  ArrowRightLeft,
  FolderSync,
  Trash2,
  RotateCcw,
  Clock,
  Wifi,
  WifiOff,
  Save,
  FolderOpen,
  Lock,
  Copy,
  CheckCircle,
  X,
  ShieldAlert,
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";

function formatCapacity(gbVal) {
  const num = Number(gbVal || 0);
  if (num >= 1024) return `${(num / 1024).toFixed(2)} TB`;
  return `${num.toFixed(1)} GB`;
}

export default function BackupRestorePanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();

  const [writePermission, setWritePermission] = useState(true);
  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // External PostgreSQL States
  const [externalDbEnabled, setExternalDbEnabled] = useState(false);
  const [externalDbMode, setExternalDbMode] = useState("standby_mirror"); // "standby_mirror" | "primary_external"
  const [externalDbHost, setExternalDbHost] = useState("");
  const [externalDbPort, setExternalDbPort] = useState(5432);
  const [externalDbName, setExternalDbName] = useState("ai_pbx");
  const [externalDbUser, setExternalDbUser] = useState("postgres");
  const [externalDbPassword, setExternalDbPassword] = useState("");
  const [externalDbSslMode, setExternalDbSslMode] = useState("prefer");
  const [standbySyncIntervalMinutes, setStandbySyncIntervalMinutes] = useState(15);
  const [lastStandbySyncAt, setLastStandbySyncAt] = useState(null);

  // Automated & Off-Site Backup States
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupIntervalHours, setAutoBackupIntervalHours] = useState(24);
  const [backupRetentionCount, setBackupRetentionCount] = useState(14);
  const [backupExternalEnabled, setBackupExternalEnabled] = useState(false);
  const [useRecordingNasSettings, setUseRecordingNasSettings] = useState(true);
  const [backupStorageType, setBackupStorageType] = useState("mount_path"); // "mount_path" | "smb" | "sftp"
  const [backupMountPath, setBackupMountPath] = useState("/mnt/nas/ai-db-backups");
  const [backupHost, setBackupHost] = useState("");
  const [backupPort, setBackupPort] = useState(22);
  const [backupShareName, setBackupShareName] = useState("");
  const [backupRemotePath, setBackupRemotePath] = useState("/db-backups");
  const [backupUsername, setBackupUsername] = useState("");
  const [backupPassword, setBackupPassword] = useState("");
  const [backupDomain, setBackupDomain] = useState("WORKGROUP");
  const [lastBackupAt, setLastBackupAt] = useState(null);

  // Live Telemetry States
  const [activeDbTarget, setActiveDbTarget] = useState("local");
  const [localDbInfo, setLocalDbInfo] = useState(null);
  const [externalDbInfo, setExternalDbInfo] = useState(null);
  const [localBackupDisk, setLocalBackupDisk] = useState(null);
  const [externalBackupDisk, setExternalBackupDisk] = useState(null);
  const [backupsList, setBackupsList] = useState([]);

  // Test & Sync Action States
  const [testingExternalDb, setTestingExternalDb] = useState(false);
  const [externalDbBanner, setExternalDbBanner] = useState(null);
  const [syncingExternalDb, setSyncingExternalDb] = useState(false);
  const [testingBackupStorage, setTestingBackupStorage] = useState(false);
  const [backupStorageBanner, setBackupStorageBanner] = useState(null);

  // Upload & Restore States
  const [file, setFile] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState("idle"); // idle, success, error
  const [message, setMessage] = useState("");

  // Modals for Named Archive Restore & Delete
  const [deleteTargetFilename, setDeleteTargetFilename] = useState(null);
  const [restoreTargetFilename, setRestoreTargetFilename] = useState(null);
  const [restoringNamed, setRestoringNamed] = useState(false);

  const getApiBase = useCallback(() => {
    if (typeof window === "undefined") return `http://${backendHost}`;
    return `${window.location.protocol}//${backendHost}`;
  }, [backendHost]);

  const fetchAllStatusAndBackups = useCallback(async () => {
    setLoading(true);
    try {
      const apiBase = getApiBase();
      const [drRes, listRes] = await Promise.all([
        fetch(`${apiBase}/api/system/database-dr/settings`),
        fetch(`${apiBase}/api/system/backups/list`),
      ]);

      if (drRes.ok) {
        const data = await drRes.json();
        const cfg = data.settings || {};
        setExternalDbEnabled(Boolean(cfg.external_db_enabled));
        setExternalDbMode(cfg.external_db_mode || "standby_mirror");
        setExternalDbHost(cfg.external_db_host || "");
        setExternalDbPort(Number(cfg.external_db_port || 5432));
        setExternalDbName(cfg.external_db_name || "ai_pbx");
        setExternalDbUser(cfg.external_db_user || "postgres");
        setExternalDbPassword(cfg.external_db_password || "");
        setExternalDbSslMode(cfg.external_db_ssl_mode || "prefer");
        setStandbySyncIntervalMinutes(Number(cfg.standby_sync_interval_minutes || 15));
        setLastStandbySyncAt(cfg.last_standby_sync_at || null);

        setAutoBackupEnabled(Boolean(cfg.auto_backup_enabled));
        setAutoBackupIntervalHours(Number(cfg.auto_backup_interval_hours || 24));
        setBackupRetentionCount(Number(cfg.backup_retention_count || 14));
        setBackupExternalEnabled(Boolean(cfg.backup_external_enabled));
        setUseRecordingNasSettings(cfg.use_recording_nas_settings ?? true);
        setBackupStorageType(cfg.backup_storage_type || "mount_path");
        setBackupMountPath(cfg.backup_mount_path || "/mnt/nas/ai-db-backups");
        setBackupHost(cfg.backup_host || "");
        setBackupPort(Number(cfg.backup_port || 22));
        setBackupShareName(cfg.backup_share_name || "");
        setBackupRemotePath(cfg.backup_remote_path || "/db-backups");
        setBackupUsername(cfg.backup_username || "");
        setBackupPassword(cfg.backup_password || "");
        setBackupDomain(cfg.backup_domain || "WORKGROUP");
        setLastBackupAt(cfg.last_backup_at || null);

        setActiveDbTarget(data.active_db_target || "local");
        setLocalDbInfo(data.local_database || null);
        setExternalDbInfo(data.external_database || null);
        setLocalBackupDisk(data.local_backup_disk || null);
        setExternalBackupDisk(data.external_backup_disk || null);
      }

      if (listRes.ok) {
        const lData = await listRes.json();
        setBackupsList(Array.isArray(lData.backups) ? lData.backups : []);
      }
    } catch (err) {
      console.error("Veritabanı ve yedekleme bilgileri alınamadı:", err);
    } finally {
      setLoading(false);
    }
  }, [getApiBase]);

  useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("pbx_user") || "{}");
      const role = storedUser?.role;
      const perms = JSON.parse(localStorage.getItem("pbx_permissions") || "[]");
      const canWrite =
        role === "admin" ||
        perms.includes("all") ||
        perms.includes("backup_restore:write") ||
        perms.includes("backup_restore");
      setWritePermission(canWrite);
    } catch (e) {
      setWritePermission(true);
    }
    fetchAllStatusAndBackups();
  }, [fetchAllStatusAndBackups]);

  const buildCurrentSettingsPayload = () => ({
    external_db_enabled: Boolean(externalDbEnabled),
    external_db_mode: externalDbMode,
    external_db_host: externalDbHost.trim(),
    external_db_port: Number(externalDbPort || 5432),
    external_db_name: externalDbName.trim() || "ai_pbx",
    external_db_user: externalDbUser.trim() || "postgres",
    external_db_password: externalDbPassword,
    external_db_ssl_mode: externalDbSslMode,
    standby_sync_interval_minutes: Number(standbySyncIntervalMinutes || 15),
    auto_backup_enabled: Boolean(autoBackupEnabled),
    auto_backup_interval_hours: Number(autoBackupIntervalHours || 24),
    backup_retention_count: Number(backupRetentionCount || 14),
    backup_external_enabled: Boolean(backupExternalEnabled),
    use_recording_nas_settings: Boolean(useRecordingNasSettings),
    backup_storage_type: backupStorageType,
    backup_mount_path: backupMountPath,
    backup_host: backupHost.trim(),
    backup_port: Number(backupPort || 22),
    backup_share_name: backupShareName.trim(),
    backup_remote_path: backupRemotePath.trim(),
    backup_username: backupUsername.trim(),
    backup_password: backupPassword,
    backup_domain: backupDomain.trim() || "WORKGROUP",
  });

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    if (!writePermission) return;
    setSavingSettings(true);
    setStatus("idle");
    try {
      const storedUser = JSON.parse(localStorage.getItem("pbx_user") || "{}");
      const res = await fetch(`${getApiBase()}/api/system/database-dr/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": storedUser?.username || "Admin",
        },
        body: JSON.stringify(buildCurrentSettingsPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Ayarlar kaydedilemedi.");

      setActiveDbTarget(data.active_db_target || "local");
      if (data.warning) {
        setStatus("error");
        setMessage(data.warning);
      } else {
        setStatus("success");
        setMessage(
          "Harici PostgreSQL ve otomatik yedekleme ayarları başarıyla kaydedildi ve devreye alındı."
        );
      }
      fetchAllStatusAndBackups();
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Ayarlar kaydedilirken hata oluştu.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestExternalPostgres = async () => {
    setTestingExternalDb(true);
    setExternalDbBanner(null);
    try {
      const res = await fetch(`${getApiBase()}/api/system/database-dr/test-external-db`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCurrentSettingsPayload()),
      });
      const data = await res.json();
      setExternalDbBanner({
        ok: Boolean(data.ok),
        message: data.message || (data.ok ? "Bağlantı başarılı." : "Bağlantı başarısız."),
      });
      if (data.database_info) {
        setExternalDbInfo(data.database_info);
      }
    } catch (err) {
      setExternalDbBanner({
        ok: false,
        message: "Harici PostgreSQL bağlantı testi sırasında sunucu hatası oluştu.",
      });
    } finally {
      setTestingExternalDb(false);
    }
  };

  const handleSyncExternalDatabase = async (direction = "local_to_external") => {
    if (!writePermission) return;
    setSyncingExternalDb(true);
    setExternalDbBanner(null);
    try {
      const storedUser = JSON.parse(localStorage.getItem("pbx_user") || "{}");
      const res = await fetch(`${getApiBase()}/api/system/database-dr/sync-external-db`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": storedUser?.username || "Admin",
        },
        body: JSON.stringify({
          ...buildCurrentSettingsPayload(),
          direction,
        }),
      });
      const data = await res.json();
      setExternalDbBanner({
        ok: Boolean(data.ok),
        message: data.message || "İşlem tamamlandı.",
      });
      if (data.ok) {
        fetchAllStatusAndBackups();
      }
    } catch (err) {
      setExternalDbBanner({
        ok: false,
        message: "Veritabanı senkronizasyonu sırasında hata oluştu.",
      });
    } finally {
      setSyncingExternalDb(false);
    }
  };

  const handleTestBackupStorage = async () => {
    setTestingBackupStorage(true);
    setBackupStorageBanner(null);
    try {
      const res = await fetch(`${getApiBase()}/api/system/database-dr/test-backup-storage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCurrentSettingsPayload()),
      });
      const data = await res.json();
      setBackupStorageBanner({
        ok: Boolean(data.ok),
        message: data.message || (data.ok ? "Bağlantı başarılı." : "Bağlantı başarısız."),
      });
      if (data.storage) {
        setExternalBackupDisk(data.storage);
      }
    } catch (err) {
      setBackupStorageBanner({
        ok: false,
        message: "Harici yedekleme sunucusu test edilirken hata oluştu.",
      });
    } finally {
      setTestingBackupStorage(false);
    }
  };

  const handleCreateArchiveNow = async () => {
    if (!writePermission) return;
    setCreatingBackup(true);
    setStatus("idle");
    try {
      const storedUser = JSON.parse(localStorage.getItem("pbx_user") || "{}");
      const res = await fetch(`${getApiBase()}/api/system/backups/create`, {
        method: "POST",
        headers: { "X-User-ID": storedUser?.username || "Admin" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Yedek oluşturulamadı.");

      setStatus("success");
      setMessage(
        `Tam sistem yedeği (${data.filename} - ${data.size_mb} MB, ${data.total_rows} kayıt) başarıyla oluşturuldu${
          data.external_copied ? " ve Harici NAS / File Server'a kopyalandı." : "."
        }`
      );
      fetchAllStatusAndBackups();
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Yedek oluşturulurken hata oluştu.");
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDownloadDirect = async (specificFilename = null) => {
    setDownloading(true);
    setStatus("idle");
    try {
      const endpoint = specificFilename
        ? `${getApiBase()}/api/system/backups/download/${encodeURIComponent(specificFilename)}`
        : `${getApiBase()}/api/system/backup`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error("Yedek indirme başarısız oldu.");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      let filename = specificFilename || "ai_pbx_backup.tar.gz";
      const contentDisposition = response.headers.get("content-disposition");
      if (!specificFilename && contentDisposition && contentDisposition.includes("filename=")) {
        filename = contentDisposition.split("filename=")[1].replace(/"/g, "");
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      setStatus("success");
      setMessage(`'${filename}' yedeği bilgisayarınıza indirildi.`);
      fetchAllStatusAndBackups();
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Yedek indirme sırasında bir hata oluştu.");
    } finally {
      setDownloading(false);
    }
  };

  const handleDeleteNamedBackup = async () => {
    if (!deleteTargetFilename) return;
    try {
      const storedUser = JSON.parse(localStorage.getItem("pbx_user") || "{}");
      const res = await fetch(
        `${getApiBase()}/api/system/backups/${encodeURIComponent(deleteTargetFilename)}`,
        {
          method: "DELETE",
          headers: { "X-User-ID": storedUser?.username || "Admin" },
        }
      );
      if (res.ok) {
        setStatus("success");
        setMessage(`'${deleteTargetFilename}' yedek arşivi silindi.`);
        fetchAllStatusAndBackups();
      }
    } catch (err) {
      setStatus("error");
      setMessage("Yedek silinirken hata oluştu.");
    } finally {
      setDeleteTargetFilename(null);
    }
  };

  const handleRestoreNamedBackup = async () => {
    if (!restoreTargetFilename) return;
    setRestoringNamed(true);
    setStatus("idle");
    try {
      const storedUser = JSON.parse(localStorage.getItem("pbx_user") || "{}");
      const res = await fetch(
        `${getApiBase()}/api/system/backups/restore/${encodeURIComponent(restoreTargetFilename)}`,
        {
          method: "POST",
          headers: { "X-User-ID": storedUser?.username || "Admin" },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Geri yükleme başarısız oldu.");

      setStatus("success");
      setMessage(data.message || "Sistem başarıyla geri yüklendi.");
      setRestoreTargetFilename(null);
      fetchAllStatusAndBackups();
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Geri yükleme sırasında hata oluştu.");
    } finally {
      setRestoringNamed(false);
    }
  };

  const handleRestoreUploadedFile = async () => {
    if (!file) return;
    setUploading(true);
    setStatus("idle");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${getApiBase()}/api/system/backup/restore`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Geri yükleme başarısız oldu.");
      }

      setStatus("success");
      setMessage(
        data.message ||
          "Sistem başarıyla geri yüklendi. Değişikliklerin etkili olması için sayfayı yenileyebilirsiniz."
      );
      setFile(null);
      setConfirmed(false);
      fetchAllStatusAndBackups();
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Sunucuya bağlanılamadı.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className={`h-11 w-11 rounded-2xl flex items-center justify-center ${lightBg} ${text}`}>
            <Database size={22} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-800 dark:text-white">
              Veritabanı Kurtarma, Harici PostgreSQL ve Sistem Yedekleme Merkezi
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Harici PostgreSQL sunucu bağlantısı (Canlı DB / Standby Replikasyon) ve NAS / File Server otomatik sistem yedekleme yönetimi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border ${
              activeDbTarget === "external"
                ? `${lightBg} ${text} ${borderLight}`
                : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60"
            }`}
          >
            <Database size={13} />
            <span>
              Aktif Veritabanı:{" "}
              {activeDbTarget === "external"
                ? `Harici PostgreSQL (${externalDbHost})`
                : "Yerel Sunucu Veritabanı"}
            </span>
          </span>

          <button
            type="button"
            onClick={fetchAllStatusAndBackups}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Durumu Yenile</span>
          </button>
        </div>
      </div>

      {!writePermission && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-semibold">
          <ShieldAlert size={16} className={text} />
          <span>Düzenleme yetkiniz bulunmamaktadır. Ayarları sadece görüntüleyebilirsiniz.</span>
        </div>
      )}

      {status === "error" && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="text-rose-500 mt-0.5 shrink-0" size={18} />
            <div className="text-xs font-bold text-rose-700 dark:text-rose-300">{message}</div>
          </div>
          <button onClick={() => setStatus("idle")} className="text-rose-500 cursor-pointer">
            <X size={15} />
          </button>
        </div>
      )}

      {status === "success" && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="text-emerald-500 mt-0.5 shrink-0" size={18} />
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{message}</div>
          </div>
          <button onClick={() => setStatus("idle")} className="text-emerald-500 cursor-pointer">
            <X size={15} />
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* LIVE TELEMETRY CARDS (YEREL DB, HARİCİ POSTGRESQL & YEDEK DİSK ALANI) */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: Local Database Status */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-3 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database size={16} className="text-emerald-600 dark:text-emerald-400" />
              <div>
                <div className="text-xs font-black text-slate-800 dark:text-slate-100">
                  Yerel Veritabanı (Local DB)
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">
                  {localDbInfo?.version || "PostgreSQL / Yerel Motor"}
                </div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
              <Wifi size={10} />
              Çevrimiçi
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Boyut</div>
              <div className="text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">
                {localDbInfo?.db_size_mb ?? 0} MB
              </div>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Tablo</div>
              <div className="text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">
                {localDbInfo?.tables_count ?? 0} Adet
              </div>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Kayıt</div>
              <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {(localDbInfo?.total_rows ?? 0).toLocaleString("tr-TR")} Satır
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: External PostgreSQL Server Status */}
        <div
          className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border flex flex-col justify-between gap-3 shadow-xs ${
            externalDbEnabled
              ? externalDbInfo?.online
                ? "border-emerald-200 dark:border-emerald-800/70"
                : "border-rose-300 dark:border-rose-800/70"
              : "border-slate-200/80 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Server size={16} className={externalDbEnabled ? text : "text-slate-400"} />
              <div>
                <div className="text-xs font-black text-slate-800 dark:text-slate-100">
                  Harici PostgreSQL Sunucusu
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  {externalDbHost
                    ? `${externalDbHost}:${externalDbPort}/${externalDbName}`
                    : "Henüz sunucu tanımlanmadı"}
                </div>
              </div>
            </div>
            {!externalDbEnabled ? (
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-500">
                Kapalı
              </span>
            ) : externalDbInfo?.online ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                <Wifi size={10} />
                {externalDbMode === "primary_external" ? "Birincil Aktif" : "Canlı Yedek (Standby)"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
                <WifiOff size={10} />
                Bağlantı Yok
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Boyut</div>
              <div className="text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">
                {externalDbInfo?.db_size_mb ?? 0} MB
              </div>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Kayıt</div>
              <div className="text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">
                {(externalDbInfo?.total_rows ?? 0).toLocaleString("tr-TR")} Satır
              </div>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Son Senkron</div>
              <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                {lastStandbySyncAt ? lastStandbySyncAt.split(" ")[1] || lastStandbySyncAt : "-"}
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Backup Storage Disk Capacity (Local / External NAS) */}
        {(() => {
          const targetDisk =
            backupExternalEnabled && externalBackupDisk?.total_gb > 0
              ? externalBackupDisk
              : localBackupDisk || {};
          const usedPct = Number(targetDisk.used_percent || 0);
          const freePct = Math.max(0, Number((100 - usedPct).toFixed(1)));
          return (
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <HardDrive size={16} className={text} />
                  <div>
                    <div className="text-xs font-black text-slate-800 dark:text-slate-100">
                      {backupExternalEnabled ? "Harici NAS Yedek Diski" : "Yerel Yedekleme Diski"}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 truncate max-w-[210px]">
                      {targetDisk.path || "/opt/ai-project/backups"}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                  %{freePct} Boş
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-slate-500">
                    Kullanılan: {formatCapacity(targetDisk.used_gb)}
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                    Boş Alan: {formatCapacity(targetDisk.free_gb)} / {formatCapacity(targetDisk.total_gb)}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      usedPct >= 90 ? "bg-rose-600" : usedPct >= 75 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(2, usedPct))}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* =================================================================== */}
        {/* INFRASTRUCTURE 1: EXTERNAL POSTGRESQL SERVER CONFIGURATION          */}
        {/* =================================================================== */}
        <div
          className={`p-5 rounded-2xl border transition-all flex flex-col gap-5 ${
            externalDbEnabled
              ? `bg-slate-50/80 dark:bg-slate-900/90 ${border}`
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  externalDbEnabled
                    ? `${bg} text-white shadow-sm`
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                }`}
              >
                <Database size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">
                    1. Altyapı: Harici PostgreSQL Veritabanı Sunucusu (Canlı Dış Sunucu veya Standby Yedek)
                  </h3>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase ${
                      externalDbEnabled
                        ? `${lightBg} ${text} border ${borderLight}`
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                    }`}
                  >
                    {externalDbEnabled ? "AÇIK" : "KAPALI"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {externalDbEnabled
                    ? "Harici PostgreSQL AÇIK: Veritabanını doğrudan farklı bir sunucudaki PostgreSQL üzerinde çalıştırabilir veya yerel veritabanınızı harici PostgreSQL sunucusuna canlı olarak klonlayabilirsiniz."
                    : "Harici PostgreSQL KAPALI: Sistem yerel sunucu üzerindeki varsayılan PostgreSQL veritabanını kullanır. İstediğiniz zaman açıp harici bir PostgreSQL sunucusuna bağlanabilirsiniz."}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={!writePermission}
              onClick={() => setExternalDbEnabled((prev) => !prev)}
              className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
              title={externalDbEnabled ? "Harici PostgreSQL'i Kapat" : "Harici PostgreSQL'i Aç"}
            >
              {externalDbEnabled ? (
                <ToggleRight size={36} className={text} />
              ) : (
                <ToggleLeft size={36} />
              )}
            </button>
          </div>

          {externalDbEnabled && (
            <div className="space-y-5 pt-3 border-t border-slate-200/70 dark:border-slate-800 animate-in fade-in duration-200">
              {/* Working Mode Selector */}
              <div className="space-y-2">
                <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                  Harici PostgreSQL Çalışma Modu
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!writePermission}
                    onClick={() => setExternalDbMode("standby_mirror")}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      externalDbMode === "standby_mirror"
                        ? `bg-white dark:bg-slate-950 ${border} ring-2 ${ring} shadow-sm`
                        : "bg-white/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        externalDbMode === "standby_mirror"
                          ? `${bg} text-white`
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      <Copy size={16} />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                        Mod 1: Canlı Yedek Veritabanı (Yerel DB + Harici PostgreSQL Senkronizasyon)
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Santral maksimum hız için yerel veritabanında çalışır; tüm tablolar belirlediğiniz periyotta{" "}
                        <strong>otomatik olarak harici PostgreSQL sunucusuna klonlanır</strong>.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={!writePermission}
                    onClick={() => setExternalDbMode("primary_external")}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      externalDbMode === "primary_external"
                        ? `bg-white dark:bg-slate-950 ${border} ring-2 ${ring} shadow-sm`
                        : "bg-white/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        externalDbMode === "primary_external"
                          ? `${bg} text-white`
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      <ArrowRightLeft size={16} />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                        Mod 2: Doğrudan Harici PostgreSQL Sunucusunu Kullan (Primary External DB)
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Tüm canlı okuma ve yazma işlemleri doğrudan{" "}
                        <strong>harici sunucudaki PostgreSQL veritabanı</strong> üzerinden yürütülür.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Connection Inputs */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="lg:col-span-2">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      PostgreSQL Sunucu IP / Host
                    </label>
                    <input
                      type="text"
                      value={externalDbHost}
                      disabled={!writePermission}
                      onChange={(e) => setExternalDbHost(e.target.value)}
                      placeholder="192.168.1.250"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Port
                    </label>
                    <input
                      type="number"
                      value={externalDbPort}
                      disabled={!writePermission}
                      onChange={(e) => setExternalDbPort(Number(e.target.value || 5432))}
                      placeholder="5432"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Veritabanı Adı
                    </label>
                    <input
                      type="text"
                      value={externalDbName}
                      disabled={!writePermission}
                      onChange={(e) => setExternalDbName(e.target.value)}
                      placeholder="ai_pbx"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Kullanıcı Adı
                    </label>
                    <input
                      type="text"
                      value={externalDbUser}
                      disabled={!writePermission}
                      onChange={(e) => setExternalDbUser(e.target.value)}
                      placeholder="postgres"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Şifre
                    </label>
                    <input
                      type="password"
                      value={externalDbPassword}
                      disabled={!writePermission}
                      onChange={(e) => setExternalDbPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500">SSL Modu:</span>
                      <select
                        value={externalDbSslMode}
                        disabled={!writePermission}
                        onChange={(e) => setExternalDbSslMode(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200"
                      >
                        <option value="prefer">Prefer (Varsayılan)</option>
                        <option value="disable">Disable (SSL Kapalı)</option>
                        <option value="require">Require (Zorunlu SSL)</option>
                      </select>
                    </div>

                    {externalDbMode === "standby_mirror" && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500">
                          Otomatik Senkronizasyon Sıklığı:
                        </span>
                        <select
                          value={standbySyncIntervalMinutes}
                          disabled={!writePermission}
                          onChange={(e) => setStandbySyncIntervalMinutes(Number(e.target.value))}
                          className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200"
                        >
                          <option value={5}>Her 5 Dakikada Bir</option>
                          <option value={15}>Her 15 Dakikada Bir</option>
                          <option value={30}>Her 30 Dakikada Bir</option>
                          <option value={60}>Her 1 Saatte Bir</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Test & One-Click Sync Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={testingExternalDb || !writePermission}
                      onClick={handleTestExternalPostgres}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer disabled:opacity-50 ${lightBg} ${text} ${borderLight}`}
                    >
                      <Activity size={14} className={testingExternalDb ? "animate-spin" : ""} />
                      <span>
                        {testingExternalDb ? "Test Ediliyor..." : "PostgreSQL Bağlantısını Test Et"}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={syncingExternalDb || !writePermission}
                      onClick={() => handleSyncExternalDatabase("local_to_external")}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer disabled:opacity-50"
                      title="Yerel veritabanındaki tüm tabloları ve verileri harici PostgreSQL sunucusuna şimdi klonla"
                    >
                      <FolderSync size={14} className={syncingExternalDb ? "animate-spin" : ""} />
                      <span>
                        {syncingExternalDb
                          ? "Veriler Aktarılıyor..."
                          : "Yerel Verileri Harici PostgreSQL'e Şimdi Aktar"}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={syncingExternalDb || !writePermission}
                      onClick={() => handleSyncExternalDatabase("external_to_local")}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
                      title="Harici PostgreSQL sunucusundaki verileri yerel veritabanına geri çek"
                    >
                      <DownloadCloud size={14} />
                      <span>Harici DB&apos;den Yerel Sunucuya Çek</span>
                    </button>
                  </div>
                </div>

                {externalDbBanner && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
                      externalDbBanner.ok
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
                        : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
                    }`}
                  >
                    <span>
                      {externalDbBanner.ok ? "✅ " : "❌ "}
                      {externalDbBanner.message}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExternalDbBanner(null)}
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
        {/* INFRASTRUCTURE 2: AUTOMATED & OFF-SITE NAS SYSTEM BACKUP            */}
        {/* =================================================================== */}
        <div
          className={`p-5 rounded-2xl border transition-all flex flex-col gap-5 ${
            autoBackupEnabled || backupExternalEnabled
              ? `bg-slate-50/80 dark:bg-slate-900/90 ${border}`
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800"
          }`}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  autoBackupEnabled || backupExternalEnabled
                    ? `${bg} text-white shadow-sm`
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                }`}
              >
                <HardDrive size={18} />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">
                  2. Altyapı: Otomatik Tam Sistem Yedekleme & Harici NAS / File Server Aktarımı
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Tüm veritabanı tablolarını, AI senaryolarını (<code>settings.json</code>), Asterisk ayarlarını ve özel anonsları tek bir <code>.tar.gz</code> paketi olarak periyodik yedekler ve harici NAS / File Server üzerine gönderir.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                  Otomatik Zamanlanmış Yedek:
                </span>
                <button
                  type="button"
                  disabled={!writePermission}
                  onClick={() => setAutoBackupEnabled((prev) => !prev)}
                  className="cursor-pointer text-slate-400"
                >
                  {autoBackupEnabled ? (
                    <ToggleRight size={34} className={text} />
                  ) : (
                    <ToggleLeft size={34} />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                  Harici NAS / Sunucuya Gönder:
                </span>
                <button
                  type="button"
                  disabled={!writePermission}
                  onClick={() => setBackupExternalEnabled((prev) => !prev)}
                  className="cursor-pointer text-slate-400"
                >
                  {backupExternalEnabled ? (
                    <ToggleRight size={34} className={text} />
                  ) : (
                    <ToggleLeft size={34} />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-800">
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
              <label className="text-[11px] font-bold text-slate-500 block mb-1">
                Otomatik Yedekleme Periyodu
              </label>
              <select
                value={autoBackupIntervalHours}
                disabled={!writePermission}
                onChange={(e) => setAutoBackupIntervalHours(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                <option value={1}>Her 1 Saatte Bir</option>
                <option value={6}>Her 6 Saatte Bir</option>
                <option value={12}>Her 12 Saatte Bir</option>
                <option value={24}>Her 24 Saatte Bir (Günlük)</option>
                <option value={168}>Haftada Bir (7 Gün)</option>
              </select>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
              <label className="text-[11px] font-bold text-slate-500 block mb-1">
                Maksimum Yedek Saklama Sayısı (Rotasyon)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={backupRetentionCount}
                  disabled={!writePermission}
                  onChange={(e) => setBackupRetentionCount(Number(e.target.value || 14))}
                  className="w-24 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                />
                <span className="text-xs text-slate-500 font-semibold">
                  adet yedek tutulur (eskiler silinir)
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-center">
              <div className="text-[11px] font-bold text-slate-400">Son Otomatik / Manuel Yedek Zamanı</div>
              <div className="text-xs font-black text-slate-800 dark:text-slate-100 mt-1 flex items-center gap-1.5">
                <Clock size={14} className={text} />
                <span>{lastBackupAt || "Henüz yedek alınmadı"}</span>
              </div>
            </div>
          </div>

          {backupExternalEnabled && (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useRecordingNasSettings}
                    disabled={!writePermission}
                    onChange={(e) => setUseRecordingNasSettings(e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-rose-500 h-4 w-4 cursor-pointer"
                  />
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                    Ses Kayıtları İçin Tanımlanan Harici NAS / File Server Bağlantısını Kullan (Otomatik{" "}
                    <code>/db-backups</code> klasörüne yazar)
                  </span>
                </label>

                <button
                  type="button"
                  disabled={testingBackupStorage || !writePermission}
                  onClick={handleTestBackupStorage}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border transition cursor-pointer disabled:opacity-50 ${lightBg} ${text} ${borderLight}`}
                >
                  <Activity size={13} className={testingBackupStorage ? "animate-spin" : ""} />
                  <span>
                    {testingBackupStorage
                      ? "Test Ediliyor..."
                      : "Harici Yedekleme Sunucusunu Test Et"}
                  </span>
                </button>
              </div>

              {!useRecordingNasSettings && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { id: "mount_path", label: "Bağlı NAS Dizini (Local/NFS Mount)" },
                      { id: "smb", label: "Windows File Server / NAS (SMB/CIFS)" },
                      { id: "sftp", label: "Uzak Linux Sunucu (SSH / SFTP)" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setBackupStorageType(opt.id)}
                        className={`p-2.5 rounded-xl border text-xs font-extrabold cursor-pointer transition ${
                          backupStorageType === opt.id
                            ? `${lightBg} ${text} ${border}`
                            : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {backupStorageType === "mount_path" ? (
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        Harici Yedekleme Klasör Yolu
                      </label>
                      <input
                        type="text"
                        value={backupMountPath}
                        onChange={(e) => setBackupMountPath(e.target.value)}
                        placeholder="/mnt/nas/ai-db-backups"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <input
                        type="text"
                        value={backupHost}
                        onChange={(e) => setBackupHost(e.target.value)}
                        placeholder="Sunucu IP / Host"
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                      />
                      <input
                        type="text"
                        value={backupStorageType === "smb" ? backupShareName : backupRemotePath}
                        onChange={(e) =>
                          backupStorageType === "smb"
                            ? setBackupShareName(e.target.value)
                            : setBackupRemotePath(e.target.value)
                        }
                        placeholder={
                          backupStorageType === "smb" ? "SMB Paylaşım Adı" : "Uzak Klasör (/db-backups)"
                        }
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                      />
                      <input
                        type="text"
                        value={backupUsername}
                        onChange={(e) => setBackupUsername(e.target.value)}
                        placeholder="Kullanıcı Adı"
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                      />
                      <input
                        type="password"
                        value={backupPassword}
                        onChange={(e) => setBackupPassword(e.target.value)}
                        placeholder="Şifre"
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  )}
                </div>
              )}

              {backupStorageBanner && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
                    backupStorageBanner.ok
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
                      : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  <span>
                    {backupStorageBanner.ok ? "✅ " : "❌ "}
                    {backupStorageBanner.message}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBackupStorageBanner(null)}
                    className="opacity-70 hover:opacity-100 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {writePermission && (
            <div className="flex justify-end pt-2 border-t border-slate-200/60 dark:border-slate-800">
              <button
                type="submit"
                disabled={savingSettings}
                className={`flex items-center gap-2 ${bg} ${hover} text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md transition cursor-pointer disabled:opacity-50`}
              >
                <Save size={14} />
                <span>
                  {savingSettings
                    ? "Kaydediliyor..."
                    : "Veritabanı & Yedekleme Ayarlarını Kaydet"}
                </span>
              </button>
            </div>
          )}
        </div>
      </form>

      {/* ===================================================================== */}
      {/* MANUAL BACKUP CREATION, ARCHIVE LIST & FILE RESTORE                   */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Backup Archive List (Local & External NAS) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white">
                Sistem ve Veritabanı Yedek Arşivi ({backupsList.length} Adet)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Yerel sunucu ve harici NAS üzerindeki yedek paketlerini tek tıkla indirebilir veya doğrudan geri yükleyebilirsiniz.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={creatingBackup || !writePermission}
                onClick={handleCreateArchiveNow}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold text-white shadow-sm transition cursor-pointer disabled:opacity-50 ${bg} ${hover}`}
              >
                <RefreshCw size={14} className={creatingBackup ? "animate-spin" : ""} />
                <span>
                  {creatingBackup ? "Yedekleniyor..." : "Şimdi Yedek Oluştur (+ NAS'a Gönder)"}
                </span>
              </button>

              <button
                type="button"
                disabled={downloading}
                onClick={() => handleDownloadDirect(null)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
              >
                <DownloadCloud size={14} />
                <span>{downloading ? "İndiriliyor..." : "Bilgisayara İndir"}</span>
              </button>
            </div>
          </div>

          {backupsList.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
              Henüz kayıtlı bir sistem yedeği bulunmuyor. Yukarıdaki <strong>&ldquo;Şimdi Yedek Oluştur&rdquo;</strong> butonuna tıklayarak ilk tam yedeğinizi alabilirsiniz.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-80 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 text-[10px] font-extrabold text-slate-500 uppercase border-b border-slate-200/70 dark:border-slate-800">
                    <th className="py-2.5 px-3">Yedek Dosyası</th>
                    <th className="py-2.5 px-3">Tarih</th>
                    <th className="py-2.5 px-3">Boyut</th>
                    <th className="py-2.5 px-3">Depolama Konumu</th>
                    <th className="py-2.5 px-3 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {backupsList.map((item) => (
                    <tr
                      key={item.filename}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-100">
                        {item.filename}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-semibold">
                        {item.created_at}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">
                        {item.size_mb} MB
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.in_local && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              Yerel Sunucu
                            </span>
                          )}
                          {item.in_external && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                              Harici NAS
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDownloadDirect(item.filename)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                            title="Bilgisayara İndir"
                          >
                            <DownloadCloud size={14} />
                          </button>
                          {writePermission && (
                            <>
                              <button
                                type="button"
                                onClick={() => setRestoreTargetFilename(item.filename)}
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 transition cursor-pointer"
                                title="Bu Yedeği Sisteme Geri Yükle (Restore)"
                              >
                                <RotateCcw size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTargetFilename(item.filename)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                                title="Yedeği Sil"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Upload External .tar.gz File & Restore */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400">
              <UploadCloud size={20} />
            </div>
            <h3 className="text-sm font-black text-slate-800 dark:text-white mb-1">
              Bilgisayardan Yedek Dosyası Yükle (.tar.gz)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Daha önce bilgisayarınıza indirdiğiniz bir <code>.tar.gz</code> yedek paketini seçerek yeni veya mevcut sunucuya geri yükleyebilirsiniz.
            </p>
          </div>

          <div className="space-y-3">
            <input
              type="file"
              id="backup-upload"
              className="hidden"
              accept=".tar.gz,.gz"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
              }}
            />
            <label
              htmlFor="backup-upload"
              className={`w-full flex items-center justify-center px-4 py-3 border-2 border-dashed rounded-xl text-xs font-bold cursor-pointer transition-all ${
                file
                  ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-300"
              }`}
            >
              {file ? file.name : "Yedek Dosyası Seç (.tar.gz)"}
            </label>

            {file && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={15} />
                  <div>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mb-2">
                      Geri yükleme işlemi mevcut veritabanı ve santral ayarlarını yedekteki verilerle günceller.
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-amber-300 text-amber-600"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                      />
                      <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                        Geri yükleme işlemini onaylıyorum.
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleRestoreUploadedFile}
              disabled={uploading || downloading || !file || !confirmed || !writePermission}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                uploading || downloading || !file || !confirmed || !writePermission
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                  : "bg-rose-600 hover:bg-rose-500 text-white shadow-md cursor-pointer"
              }`}
            >
              {uploading ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Geri Yükleniyor...</span>
                </>
              ) : (
                <>
                  <Shield size={15} />
                  <span>Seçili Dosyadan Geri Yükle</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Backup Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTargetFilename)}
        onClose={() => setDeleteTargetFilename(null)}
        onConfirm={handleDeleteNamedBackup}
        title="Yedek Arşivini Sil"
        message={`'${deleteTargetFilename}' adlı sistem yedeğini silmek istediğinize emin misiniz?`}
      />

      {/* Restore Named Backup Confirmation Modal */}
      {restoreTargetFilename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
                <RotateCcw size={22} />
              </div>
              <div>
                <h4 className="font-black text-sm text-slate-800 dark:text-white">
                  Yedekten Sistemi Geri Yükle
                </h4>
                <p className="text-xs text-slate-500 font-mono">{restoreTargetFilename}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Seçili yedek paketi içerisindeki tüm veritabanı tabloları, AI senaryoları (<code>settings.json</code>), Asterisk santral ayarları ve özel anonslar sisteme geri yüklenecektir. Devam etmek istiyor musunuz?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={restoringNamed}
                onClick={() => setRestoreTargetFilename(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={restoringNamed}
                onClick={handleRestoreNamedBackup}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={14} className={restoringNamed ? "animate-spin" : ""} />
                <span>{restoringNamed ? "Geri Yükleniyor..." : "Evet, Şimdi Geri Yükle"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
