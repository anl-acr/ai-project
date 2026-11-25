import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Cpu,
  Plus,
  Trash2,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  Send,
  ShieldCheck,
  X,
  HardDrive,
  FileArchive,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Ban,
  PhoneCall,
} from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

const BRAND_LIST = ["Yealink", "Grandstream", "Fanvil", "Cisco"];

function formatBytes(bytes) {
  const b = Number(bytes || 0);
  if (!b) return "0 KB";
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

function normalizeModelKey(m) {
  return String(m || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isFwCompatibleWithDevice(fw, dev) {
  if (!fw || !dev) return false;
  if (String(fw.brand || "").toLowerCase() !== String(dev.brand || "").toLowerCase()) return false;
  const devM = normalizeModelKey(dev.model);
  if (!devM) return false;
  const compat = Array.isArray(fw.compatible_models) ? fw.compatible_models : [];
  return compat.some((cm) => {
    const c = normalizeModelKey(cm);
    if (!c) return false;
    if (c === devM) return true;
    if (devM.startsWith(c) && devM.length - c.length <= 2) return true;
    if (c.startsWith(devM) && c.length - devM.length <= 2) return true;
    return false;
  });
}

function getFwStatusBadge(status) {
  switch (status) {
    case "up_to_date":
      return {
        label: "Güncel",
        cls: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
      };
    case "update_available":
      return {
        label: "Güncelleme Hazır",
        cls: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
      };
    case "downgrade_available":
      return {
        label: "Daha Yeni Sürümde",
        cls: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60",
      };
    case "queued_active_call":
      return {
        label: "Görüşme Bitimi Bekleniyor",
        cls: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/70 animate-pulse",
      };
    case "notified":
    case "pending_prov":
      return {
        label: "Komut Gönderildi",
        cls: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60 animate-pulse",
      };
    case "downloading":
      return {
        label: "İndiriliyor / Yükleniyor",
        cls: "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 animate-pulse",
      };
    case "rebooting":
      return {
        label: "Yeniden Başlatılıyor",
        cls: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60 animate-pulse",
      };
    case "failed":
      return {
        label: "Hata",
        cls: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60",
      };
    default:
      return {
        label: "Politika Yok",
        cls: "bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700",
      };
  }
}

export default function PhoneFirmwareTab({
  backendHost = "localhost:8000",
  getAuthHeaders,
  onSummaryChange,
}) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();

  const API_BASE =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${backendHost}`
      : `http://${backendHost}`;

  // RBAC permissions check (admin or phone_firmware:* / autoprovision:*)
  const { canWrite, canDelete } = useMemo(() => {
    if (typeof window === "undefined") return { canWrite: true, canDelete: true };
    try {
      const raw = localStorage.getItem("aida_user") || sessionStorage.getItem("aida_user");
      if (!raw) return { canWrite: true, canDelete: true };
      const u = JSON.parse(raw);
      if (String(u?.role || "").toLowerCase() === "admin") return { canWrite: true, canDelete: true };
      const perms = Array.isArray(u?.permissions) ? u.permissions : null;
      if (!perms) return { canWrite: true, canDelete: true };
      return {
        canWrite: perms.includes("phone_firmware:write") || perms.includes("autoprovision:write"),
        canDelete: perms.includes("phone_firmware:delete") || perms.includes("autoprovision:delete"),
      };
    } catch {
      return { canWrite: true, canDelete: true };
    }
  }, []);

  const [packages, setPackages] = useState([]);
  const [policies, setPolicies] = useState({});
  const [devices, setDevices] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ package_count: 0, policy_count: 0, total_mb: 0 });
  const [supportedModels, setSupportedModels] = useState({});
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);

  // Selection & deploy states
  const [selectedMacs, setSelectedMacs] = useState([]);
  const [rowSelectedFw, setRowSelectedFw] = useState({});
  const [waitForIdle, setWaitForIdle] = useState(true);
  const [forceReinstall, setForceReinstall] = useState(false);
  const [allowDowngrade, setAllowDowngrade] = useState(false);
  const [deployingKey, setDeployingKey] = useState("");
  const [policySavingKey, setPolicySavingKey] = useState("");
  const [copiedSha, setCopiedSha] = useState("");
  const [showLogs, setShowLogs] = useState(false);

  // Upload modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadBrand, setUploadBrand] = useState("Grandstream");
  const [uploadVersion, setUploadVersion] = useState("");
  const [uploadModels, setUploadModels] = useState([]);
  const [customModelInput, setCustomModelInput] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const filePickerRef = useRef(null);

  // Delete modal target
  const [deleteTargetFw, setDeleteTargetFw] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const flashBanner = (ok, msg) => {
    setBanner({ ok, text: msg });
    setTimeout(() => {
      setBanner((prev) => (prev && prev.text === msg ? null : prev));
    }, 7000);
  };

  const fetchOverview = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/settings/phone-firmware`, {
          headers: getAuthHeaders ? getAuthHeaders() : {},
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (!silent) flashBanner(false, err.detail || "Firmware bilgileri alınamadı.");
          return;
        }
        const data = await res.json();
        const pkgs = Array.isArray(data.packages) ? data.packages : [];
        const devs = Array.isArray(data.devices) ? data.devices : [];
        setPackages(pkgs);
        setPolicies(data.policies && typeof data.policies === "object" ? data.policies : {});
        setDevices(devs);
        setLogs(Array.isArray(data.logs) ? data.logs : []);
        setStats(data.stats || { package_count: pkgs.length, policy_count: 0, total_mb: 0 });
        setSupportedModels(data.supported_models || {});
        if (onSummaryChange) {
          const pendingCnt = devs.filter((d) =>
            ["update_available", "queued_active_call", "notified", "downloading", "rebooting"].includes(d.fw_status)
          ).length;
          onSummaryChange({ packageCount: pkgs.length, pendingCount: pendingCnt });
        }
      } catch (e) {
        if (!silent) flashBanner(false, "Sunucuya bağlanılamadı.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [API_BASE, getAuthHeaders, onSummaryChange]
  );

  useEffect(() => {
    fetchOverview(false);
  }, [fetchOverview]);

  // Auto-poll every 5s when any device is actively downloading / notified / waiting for call end
  useEffect(() => {
    const hasActive = devices.some((d) =>
      ["queued_active_call", "notified", "downloading", "rebooting"].includes(d.fw_status)
    );
    if (!hasActive) return;
    const timer = setInterval(() => {
      fetchOverview(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [devices, fetchOverview]);

  // Distinct brand+model pairs present in registered devices for Model Policy matrix
  const registeredModelPairs = useMemo(() => {
    const map = new Map();
    devices.forEach((d) => {
      const b = String(d.brand || "").trim();
      const m = String(d.model || "").trim();
      if (!b || !m) return;
      const key = `${b.toLowerCase()}::${m.toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, { key, brand: b, model: m, count: 0, onlineCount: 0 });
      }
      const item = map.get(key);
      item.count += 1;
      if (d.status === "online") item.onlineCount += 1;
    });
    return Array.from(map.values()).sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
  }, [devices]);

  const brandModelsForUpload = useMemo(() => {
    const base = Array.isArray(supportedModels[uploadBrand]) ? supportedModels[uploadBrand] : [];
    const extraFromDevices = devices
      .filter((d) => String(d.brand || "").toLowerCase() === String(uploadBrand || "").toLowerCase() && d.model)
      .map((d) => String(d.model).trim());
    const merged = Array.from(new Set([...base, ...extraFromDevices, ...uploadModels]));
    return merged;
  }, [supportedModels, uploadBrand, devices, uploadModels]);

  const openUploadModal = () => {
    setUploadFile(null);
    setUploadBrand("Grandstream");
    setUploadVersion("");
    setUploadModels([]);
    setCustomModelInput("");
    setUploadNotes("");
    setUploadProgress(0);
    setShowUploadModal(true);
  };

  const handleFileChosen = async (fileObj) => {
    if (!fileObj) return;
    setUploadFile(fileObj);
    try {
      const res = await fetch(`${API_BASE}/api/settings/phone-firmware/inspect-filename`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(getAuthHeaders ? getAuthHeaders() : {}) },
        body: JSON.stringify({ filename: fileObj.name }),
      });
      if (res.ok) {
        const hint = await res.json();
        if (hint.brand && BRAND_LIST.includes(hint.brand)) setUploadBrand(hint.brand);
        if (hint.version) setUploadVersion(hint.version);
        if (Array.isArray(hint.compatible_models) && hint.compatible_models.length > 0) {
          setUploadModels(hint.compatible_models);
        }
      }
    } catch {}
  };

  const toggleUploadModel = (m) => {
    setUploadModels((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const handleAddCustomModel = () => {
    const clean = customModelInput.trim();
    if (!clean) return;
    if (!uploadModels.includes(clean)) setUploadModels((prev) => [...prev, clean]);
    setCustomModelInput("");
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      flashBanner(false, "Lütfen bir firmware dosyası seçin.");
      return;
    }
    if (!uploadVersion.trim()) {
      flashBanner(false, "Lütfen firmware sürüm numarasını girin (ör. 1.0.7.71).");
      return;
    }
    if (uploadModels.length === 0) {
      flashBanner(false, "Lütfen en az bir uyumlu telefon modeli seçin.");
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("brand", uploadBrand);
      formData.append("version", uploadVersion.trim());
      formData.append("compatible_models", JSON.stringify(uploadModels));
      formData.append("release_notes", uploadNotes.trim());

      // Use XHR so user sees smooth real upload progress for 20-50MB .rom/.bin files
      const respJson = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE}/api/settings/phone-firmware/upload`, true);
        const hdrs = getAuthHeaders ? getAuthHeaders() : {};
        Object.entries(hdrs).forEach(([k, v]) => {
          if (k.toLowerCase() !== "content-type") xhr.setRequestHeader(k, v);
        });
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            const pct = Math.min(95, Math.round((ev.loaded / ev.total) * 100));
            setUploadProgress(pct);
          }
        };
        xhr.onload = () => {
          let parsed = {};
          try {
            parsed = JSON.parse(xhr.responseText || "{}");
          } catch {}
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
            resolve(parsed);
          } else {
            reject(new Error(parsed.detail || `Yükleme başarısız (HTTP ${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error("Ağ hatası nedeniyle dosya yüklenemedi."));
        xhr.send(formData);
      });

      setShowUploadModal(false);
      flashBanner(true, respJson.message || "Firmware başarıyla yüklendi.");
      await fetchOverview(true);
    } catch (err) {
      flashBanner(false, err?.message || "Firmware yüklenirken hata oluştu.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetFw) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/phone-firmware/${encodeURIComponent(deleteTargetFw.id)}`, {
        method: "DELETE",
        headers: getAuthHeaders ? getAuthHeaders() : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flashBanner(false, data.detail || "Silme işlemi başarısız.");
      } else {
        flashBanner(true, data.message || "Firmware paketi silindi.");
        await fetchOverview(true);
      }
    } catch {
      flashBanner(false, "Sunucuya bağlanılamadı.");
    } finally {
      setDeleting(false);
      setDeleteTargetFw(null);
    }
  };

  const handleSaveModelPolicy = async (brandVal, modelVal, fwIdVal) => {
    const pkey = `${brandVal}::${modelVal}`;
    setPolicySavingKey(pkey);
    try {
      const res = await fetch(`${API_BASE}/api/settings/phone-firmware/policy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(getAuthHeaders ? getAuthHeaders() : {}) },
        body: JSON.stringify({
          brand: brandVal,
          model: modelVal,
          fw_id: fwIdVal || "",
          auto_apply: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flashBanner(false, data.detail || "Politika kaydedilemedi.");
      } else {
        flashBanner(true, data.message || "Hedef sürüm politikası güncellendi.");
        await fetchOverview(true);
      }
    } catch {
      flashBanner(false, "Sunucuya bağlanılamadı.");
    } finally {
      setPolicySavingKey("");
    }
  };

  const handleDeployDevices = async (macList, explicitFwId = "") => {
    if (!macList || macList.length === 0) return;
    const busyKey = macList.length === 1 ? macList[0] : "__BULK__";
    setDeployingKey(busyKey);
    try {
      const res = await fetch(`${API_BASE}/api/settings/phone-firmware/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(getAuthHeaders ? getAuthHeaders() : {}) },
        body: JSON.stringify({
          macs: macList,
          fw_id: explicitFwId || "",
          force: forceReinstall,
          allow_downgrade: allowDowngrade,
          wait_for_idle: waitForIdle,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flashBanner(false, data.detail || "Firmware dağıtımı başlatılamadı.");
      } else {
        const detailReasons = (data.results || [])
          .filter((r) => r.status === "downgrade_blocked" || r.status === "skipped")
          .map((r) => `${r.mac}: ${r.reason}`)
          .slice(0, 2)
          .join(" • ");
        const okFlag = (data.sent_count || 0) > 0 || (data.queued_count || 0) > 0;
        flashBanner(okFlag, detailReasons ? `${data.message} (${detailReasons})` : data.message);
        if (macList.length > 1) setSelectedMacs([]);
        await fetchOverview(true);
      }
    } catch {
      flashBanner(false, "Sunucuya bağlanılamadı.");
    } finally {
      setDeployingKey("");
    }
  };

  const handleCancelOverride = async (macVal) => {
    setDeployingKey(macVal);
    try {
      const res = await fetch(`${API_BASE}/api/settings/phone-firmware/cancel-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(getAuthHeaders ? getAuthHeaders() : {}) },
        body: JSON.stringify({ mac: macVal }),
      });
      const data = await res.json().catch(() => ({}));
      flashBanner(res.ok, data.message || data.detail || "İşlem tamamlandı.");
      await fetchOverview(true);
    } catch {
      flashBanner(false, "Sunucuya bağlanılamadı.");
    } finally {
      setDeployingKey("");
    }
  };

  const toggleSelectMac = (mh) => {
    setSelectedMacs((prev) => (prev.includes(mh) ? prev.filter((x) => x !== mh) : [...prev, mh]));
  };

  const toggleSelectAll = () => {
    if (selectedMacs.length === devices.length) {
      setSelectedMacs([]);
    } else {
      setSelectedMacs(devices.map((d) => d.mac_hex).filter(Boolean));
    }
  };

  const copySha = (sha) => {
    if (!sha || typeof navigator === "undefined") return;
    navigator.clipboard?.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(""), 1800);
  };

  const updateReadyCount = useMemo(
    () => devices.filter((d) => d.fw_status === "update_available").length,
    [devices]
  );

  return (
    <div className="flex flex-col gap-5">
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

      {/* Top Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${lightBg} ${text} flex items-center justify-center shrink-0`}>
            <FileArchive size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Yüklü Paket</div>
            <div className="text-lg font-extrabold text-slate-800 dark:text-white">{stats.package_count || 0}</div>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Model Politikası</div>
            <div className="text-lg font-extrabold text-slate-800 dark:text-white">{stats.policy_count || 0}</div>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Cpu size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Güncelleme Hazır</div>
            <div className="text-lg font-extrabold text-slate-800 dark:text-white">{updateReadyCount}</div>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
            <HardDrive size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Depo Kullanımı</div>
            <div className="text-lg font-extrabold text-slate-800 dark:text-white">{stats.total_mb || 0} MB</div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Firmware Repository */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl ${lightBg} ${text} border ${borderLight} flex items-center justify-center shrink-0`}>
              <Cpu size={17} />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Santral Firmware Deposu
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Yealink (.rom), Grandstream (.bin / .zip), Fanvil (.z) veya Cisco (.loads) firmware dosyalarını modele göre yükleyin.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchOverview(false)}
              title="Listeyi Yenile"
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            {canWrite && (
              <button
                type="button"
                onClick={openUploadModal}
                title="Yeni Firmware Yükle"
                className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all shadow-sm cursor-pointer"
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        </div>

        {loading && packages.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw size={22} className={`animate-spin ${text}`} />
          </div>
        ) : packages.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
            Henüz yüklenmiş firmware dosyası yok. Sağ üstteki <strong>&quot;+&quot;</strong> butonuna tıklayarak model bazlı firmware yükleyebilirsiniz.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Marka / Sürüm</th>
                  <th className="py-2.5 px-3">Uyumlu Modeller</th>
                  <th className="py-2.5 px-3">Dosya &amp; SHA-256</th>
                  <th className="py-2.5 px-3">Boyut / İndirme</th>
                  <th className="py-2.5 px-3">Yüklenme</th>
                  <th className="py-2.5 px-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr
                    key={pkg.id}
                    className="border-b border-slate-100 dark:border-slate-800/70 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-800 dark:text-white">{pkg.brand}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-extrabold ${lightBg} ${text} border ${borderLight}`}>
                          v{pkg.version}
                        </span>
                      </div>
                      {pkg.release_notes && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs truncate" title={pkg.release_notes}>
                          {pkg.release_notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(pkg.compatible_models || []).map((m) => (
                          <span
                            key={m}
                            className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] font-bold"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200">{pkg.filename}</div>
                      {Array.isArray(pkg.extracted_files) && pkg.extracted_files.length > 0 && pkg.filename?.toLowerCase().endsWith(".zip") && (
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                          İçerik: {pkg.extracted_files.join(", ")}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => copySha(pkg.sha256)}
                        title={`Tam SHA-256 kopyala: ${pkg.sha256}`}
                        className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mt-0.5 cursor-pointer"
                      >
                        <span>SHA256: {String(pkg.sha256 || "").slice(0, 12)}…</span>
                        {copiedSha === pkg.sha256 ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                      </button>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-700 dark:text-slate-200">{formatBytes(pkg.size_bytes)}</div>
                      <div className="text-[10px] text-slate-400 inline-flex items-center gap-1">
                        <Download size={10} />
                        <span>{pkg.download_count || 0} kez indirildi</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-500 dark:text-slate-400">
                      <div>{pkg.uploaded_at || "-"}</div>
                      <div className="text-[10px] text-slate-400">{pkg.uploaded_by || "admin"}</div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeleteTargetFw(pkg)}
                          title="Firmware Paketini Sil"
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 2: Model-Based Target Version Policies */}
      {registeredModelPairs.length > 0 && (
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm space-y-3">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Model Bazlı Hedef Sürüm Politikası
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Bir model için hedef sürüm seçildiğinde, o modeldeki telefonlar provizyon çektiğinde hedef sürümde değilse otomatik güncellenir; hedef sürüme ulaştığında döngüye girmeden durur.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {registeredModelPairs.map((mp) => {
              const pol = policies[mp.key];
              const compatPkgs = packages.filter((p) => isFwCompatibleWithDevice(p, mp));
              const isBusy = policySavingKey === `${mp.brand}::${mp.model}`;
              return (
                <div
                  key={mp.key}
                  className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-extrabold text-xs text-slate-800 dark:text-white">
                      {mp.brand} {mp.model}
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      {mp.count} cihaz ({mp.onlineCount} bağlı)
                    </span>
                  </div>
                  <select
                    disabled={!canWrite || isBusy}
                    value={pol?.fw_id || ""}
                    onChange={(e) => handleSaveModelPolicy(mp.brand, mp.model, e.target.value)}
                    className={`w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} disabled:opacity-60`}
                  >
                    <option value="">— Hedef Sürüm Yok (Serbest) —</option>
                    {compatPkgs.map((p) => (
                      <option key={p.id} value={p.id}>
                        v{p.version} ({p.filename})
                      </option>
                    ))}
                  </select>
                  {compatPkgs.length === 0 && (
                    <div className="text-[10px] text-slate-400">
                      Bu model için henüz depoya firmware yüklenmemiş.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: Devices Live Firmware Matrix & Push Control */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Kayıtlı Telefonlar &amp; Canlı Sürüm Dağıtımı
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Telefonların mevcut sürümleri canlı SIP/HTTP kimliğinden otomatik okunur. İhtiyaç halinde tekil veya toplu olarak hemen gönderebilirsiniz.
            </p>
          </div>
          {canWrite && (
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={waitForIdle}
                  onChange={(e) => setWaitForIdle(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <PhoneCall size={12} className="text-emerald-500" />
                <span>Görüşmedeyse çağrı bitince gönder</span>
              </label>
              <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allowDowngrade}
                  onChange={(e) => setAllowDowngrade(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Sürüm düşürmeye izin ver</span>
              </label>
              <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={forceReinstall}
                  onChange={(e) => setForceReinstall(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Aynıysa zorla yükle</span>
              </label>
              <button
                type="button"
                disabled={selectedMacs.length === 0 || deployingKey === "__BULK__"}
                onClick={() => handleDeployDevices(selectedMacs, "")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <Send size={13} />
                <span>
                  {deployingKey === "__BULK__"
                    ? "Gönderiliyor..."
                    : `Seçilenlere Gönder (${selectedMacs.length})`}
                </span>
              </button>
            </div>
          )}
        </div>

        {devices.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400">Kayıtlı masa telefonu bulunamadı.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-2 w-8">
                    <input
                      type="checkbox"
                      checked={devices.length > 0 && selectedMacs.length === devices.length}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="py-2.5 px-3">Cihaz / Dahili</th>
                  <th className="py-2.5 px-3">Marka / Model</th>
                  <th className="py-2.5 px-3">Mevcut Sürüm</th>
                  <th className="py-2.5 px-3">Hedef / Gönderilecek Paket</th>
                  <th className="py-2.5 px-3">Durum</th>
                  <th className="py-2.5 px-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((dev) => {
                  const mh = dev.mac_hex || "";
                  const isOnline = dev.status === "online";
                  const badge = getFwStatusBadge(dev.fw_status);
                  const compatPkgs = packages.filter((p) => isFwCompatibleWithDevice(p, dev));
                  const chosenFwId = rowSelectedFw[mh] ?? dev.target_fw_id ?? (compatPkgs[0]?.id || "");
                  const isBusy = deployingKey === mh;
                  const hasPendingOverride = ["queued_active_call", "notified", "pending_prov"].includes(dev.fw_status);

                  return (
                    <tr
                      key={mh || dev.mac}
                      className="border-b border-slate-100 dark:border-slate-800/70 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-2">
                        <input
                          type="checkbox"
                          checked={selectedMacs.includes(mh)}
                          onChange={() => toggleSelectMac(mh)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isOnline ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-slate-300 dark:bg-slate-600"
                            }`}
                            title={isOnline ? "Çevrimiçi" : "Çevrimdışı"}
                          />
                          <div>
                            <div className="font-bold text-slate-800 dark:text-white">
                              {dev.assigned_extension ? `Dahili ${dev.assigned_extension}` : "Atanmamış"}
                              {dev.assigned_user_name ? ` • ${dev.assigned_user_name}` : ""}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400">
                              {dev.mac} • {dev.sip_username || "-"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-700 dark:text-slate-200">
                          {dev.brand} {dev.model}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase">{dev.connection_mode || "lan"}</div>
                      </td>
                      <td className="py-3 px-3">
                        {dev.current_fw_version ? (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono text-[11px] font-bold">
                            v{dev.current_fw_version}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400" title={dev.user_agent || "Cihaz çevrimdışı"}>
                            Bilinmiyor
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {compatPkgs.length > 0 ? (
                          <select
                            disabled={!canWrite || isBusy}
                            value={chosenFwId}
                            onChange={(e) => setRowSelectedFw((prev) => ({ ...prev, [mh]: e.target.value }))}
                            className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-bold text-slate-800 dark:text-slate-100 max-w-[200px]"
                          >
                            {compatPkgs.map((p) => (
                              <option key={p.id} value={p.id}>
                                v{p.version} ({p.filename})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[10px] text-slate-400">Uyumlu paket yok</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-extrabold ${badge.cls}`}
                          title={dev.fw_status_message || ""}
                        >
                          {badge.label}
                        </span>
                        {dev.fw_status_message && (
                          <div className="text-[10px] text-slate-400 mt-0.5 max-w-[220px] truncate" title={dev.fw_status_message}>
                            {dev.fw_status_message}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {canWrite && compatPkgs.length > 0 && (
                            <button
                              type="button"
                              disabled={isBusy || !chosenFwId}
                              onClick={() => handleDeployDevices([mh], chosenFwId)}
                              title="Bu telefona seçili firmware'i gönder"
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg ${bg} ${hover} text-white text-[11px] font-bold shadow-sm transition-all cursor-pointer disabled:opacity-40`}
                            >
                              {isBusy ? <RefreshCw size={11} className="animate-spin" /> : <Send size={11} />}
                              <span>Gönder</span>
                            </button>
                          )}
                          {canWrite && hasPendingOverride && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleCancelOverride(mh)}
                              title="Bekleyen güncellemeyi iptal et"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                            >
                              <Ban size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 4: Collapsible Firmware Audit / Download Logs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowLogs((v) => !v)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-slate-400" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Firmware İşlem ve İndirme Kayıtları ({logs.length})
            </span>
          </div>
          {showLogs ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
        </button>
        {showLogs && (
          <div className="px-5 pb-4 border-t border-slate-100 dark:border-slate-800 max-h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">Henüz firmware işlem kaydı bulunmuyor.</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/70 text-[11px]">
                {logs.map((lg, idx) => (
                  <div key={`${lg.timestamp}-${idx}`} className="py-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300 mr-2">
                        {lg.event}
                      </span>
                      <span className="text-slate-700 dark:text-slate-200 font-medium">{lg.detail}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">{lg.timestamp}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Firmware Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl ${lightBg} ${text} flex items-center justify-center`}>
                  <Upload size={17} />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Yeni Firmware Paketi Yükle</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Dosyayı seçin; marka, sürüm ve uyumlu modelleri doğrulayıp santral deposuna kaydedin.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={uploading}
                onClick={() => setShowUploadModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* File dropzone */}
              <div>
                <input
                  ref={filePickerRef}
                  type="file"
                  accept=".rom,.bin,.zip,.z,.loads"
                  className="hidden"
                  onChange={(e) => handleFileChosen(e.target.files?.[0])}
                />
                <div
                  onClick={() => !uploading && filePickerRef.current?.click()}
                  className={`p-5 rounded-xl border-2 border-dashed ${
                    uploadFile
                      ? `${border} ${lightBg}`
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500"
                  } text-center cursor-pointer transition-all`}
                >
                  {uploadFile ? (
                    <div className="space-y-1">
                      <div className="text-xs font-extrabold text-slate-800 dark:text-white font-mono">
                        {uploadFile.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formatBytes(uploadFile.size)} • Değiştirmek için tıklayın
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Upload size={22} className="mx-auto text-slate-400" />
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        Firmware Dosyasını Seçmek İçin Tıklayın
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Desteklenen formatlar: Yealink (.rom), Grandstream (.bin / .zip), Fanvil (.z), Cisco (.loads)
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Marka</label>
                  <select
                    value={uploadBrand}
                    onChange={(e) => {
                      setUploadBrand(e.target.value);
                      setUploadModels([]);
                    }}
                    className={`w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
                  >
                    {BRAND_LIST.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Sürüm Numarası (Zorunlu)
                  </label>
                  <input
                    type="text"
                    required
                    value={uploadVersion}
                    onChange={(e) => setUploadVersion(e.target.value)}
                    placeholder="Ör. 1.0.7.71 veya 66.86.0.160"
                    className={`w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
                  />
                </div>
              </div>

              {/* Compatible models selector */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">
                  Uyumlu Telefon Modelleri ({uploadModels.length} seçili)
                </label>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 max-h-36 overflow-y-auto flex flex-wrap gap-1.5">
                  {brandModelsForUpload.map((m) => {
                    const active = uploadModels.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleUploadModel(m)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                          active
                            ? `${bg} text-white border-transparent shadow-sm`
                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400"
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={customModelInput}
                    onChange={(e) => setCustomModelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomModel();
                      }
                    }}
                    placeholder="Listede olmayan model ekle (ör. GRP2602P)..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomModel}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    Ekle
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Sürüm Notu (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="Ör. DFKS ve Türkçe arayüz kararlı sürümü"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100"
                />
              </div>

              {uploading && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <span>Sunucuya yükleniyor...</span>
                    <span>%{uploadProgress}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className={`h-full ${bg} transition-all duration-200`} style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold shadow-sm cursor-pointer disabled:opacity-50`}
                >
                  <Upload size={14} />
                  <span>{uploading ? "Yükleniyor..." : "Depoya Kaydet"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal (Rule-compliant) */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTargetFw)}
        title="Firmware Paketini Sil"
        message={
          deleteTargetFw
            ? `${deleteTargetFw.brand} v${deleteTargetFw.version} (${deleteTargetFw.filename}) dosyasını santral deposundan ve bağlı model politikalarından kalıcı olarak silmek istiyor musunuz?`
            : ""
        }
        confirmText={deleting ? "Siliniyor..." : "Sil"}
        onCancel={() => !deleting && setDeleteTargetFw(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
