import React, { useState, useEffect } from "react";
import {
  RotateCcw,
  Plus,
  Trash2,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Bot,
  GitBranch,
  Server,
  Users,
  MessageSquare,
  Bell,
  Calendar,
  Sparkles,
  RefreshCw,
  Sliders,
  Check,
  X,
  HardDrive,
  User,
  Layers
} from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

const CATEGORY_ICONS = {
  ai_agents: Bot,
  call_flows_rules: GitBranch,
  pbx_routing: Server,
  users_roles: Users,
  channels_omnichannel: MessageSquare,
  integrations_notifications: Bell
};

const QUICK_TITLE_PRESETS = [
  "AI Temsilci & Senaryo Değişikliği Öncesi",
  "Çağrı Akışı (Call Flow) Güncellemesi Öncesi",
  "SIP Trunk & Dış Hat Ayarı Öncesi",
  "Kullanıcı & Rol Yetki Değişikliği Öncesi",
  "Stabil Çalışan Sistem Konfigürasyonu"
];

export default function RestorePointsPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();

  const [points, setPoints] = useState([]);
  const [categoriesMeta, setCategoriesMeta] = useState([]);
  const [policy, setPolicy] = useState({
    auto_create_enabled: false,
    auto_create_interval_hours: 24,
    auto_cleanup_enabled: true,
    max_restore_points: 20,
    retention_days: 30,
    last_auto_created_at: null
  });

  const [loading, setLoading] = useState(true);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [cleaningNow, setCleaningNow] = useState(false);
  const [creatingPoint, setCreatingPoint] = useState(false);
  const [restoringPoint, setRestoringPoint] = useState(false);

  // Permissions
  const [canWrite, setCanWrite] = useState(true);
  const [canDelete, setCanDelete] = useState(true);

  // Create Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Restore Modal state
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoreMode, setRestoreMode] = useState("all"); // "all" | "custom"
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [createSafetyPoint, setCreateSafetyPoint] = useState(true);

  // Delete Modal state
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Feedback banner
  const [feedback, setFeedback] = useState(null); // { type: "success" | "error", message: "" }

  const showToast = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const getHeaders = () => {
    const userId =
      (typeof window !== "undefined" &&
        (localStorage.getItem("current_user_id") || sessionStorage.getItem("current_user_id"))) ||
      "admin";
    const tenantId =
      (typeof window !== "undefined" &&
        (localStorage.getItem("selected_tenant_id") ||
          localStorage.getItem("current_tenant_id") ||
          sessionStorage.getItem("current_tenant_id"))) ||
      "tenant-default";
    return {
      "Content-Type": "application/json",
      "X-User-ID": String(userId),
      "X-Tenant-ID": String(tenantId)
    };
  };

  const fetchRestorePoints = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/settings/restore-points?t=${Date.now()}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setPoints(Array.isArray(data.points) ? data.points : []);
        if (data.policy) {
          setPolicy((prev) => ({ ...prev, ...data.policy }));
        }
        if (Array.isArray(data.categories_meta) && data.categories_meta.length > 0) {
          setCategoriesMeta(data.categories_meta);
          setSelectedCategories(data.categories_meta.map((c) => c.id));
        }
      }
    } catch (err) {
      console.error("Geri yükleme noktaları alınamadı:", err);
      showToast("error", "Geri yükleme noktaları sunucudan alınamadı.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestorePoints();
  }, []);

  const handleCreatePoint = async (e, quickPresetTitle = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const nowStr = new Date().toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    const finalTitle = (quickPresetTitle || newTitle || "").trim() || `Manuel Geri Yükleme Noktası (${nowStr})`;
    const finalDesc = quickPresetTitle
      ? "Tek tıkla manuel olarak oluşturulan sistem ayarları geri yükleme noktası."
      : newDescription.trim();

    setCreatingPoint(true);
    try {
      const res = await fetch(`/api/settings/restore-points`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          title: finalTitle,
          description: finalDesc
        })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        showToast("success", data.message || "Manuel geri yükleme noktası başarıyla oluşturuldu.");
        setShowCreateModal(false);
        setNewTitle("");
        setNewDescription("");
        await fetchRestorePoints();
      } else {
        showToast("error", data.detail || data.message || "Geri yükleme noktası oluşturulamadı.");
      }
    } catch (err) {
      showToast("error", "Sunucu bağlantı hatası oluştu.");
    } finally {
      setCreatingPoint(false);
    }
  };

  const handleSavePolicy = async () => {
    setSavingPolicy(true);
    try {
      const res = await fetch(`/api/settings/restore-points/policy`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          auto_create_enabled: Boolean(policy.auto_create_enabled),
          auto_create_interval_hours: Number(policy.auto_create_interval_hours) || 24,
          auto_cleanup_enabled: Boolean(policy.auto_cleanup_enabled),
          max_restore_points: Number(policy.max_restore_points) || 20,
          retention_days: Number(policy.retention_days) || 30
        })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        if (data.policy) setPolicy(data.policy);
        showToast("success", data.message || "Otomatik geri yükleme ve silme politikası kaydedildi.");
        if (data.removed_count > 0) {
          await fetchRestorePoints();
        }
      } else {
        showToast("error", data.detail || "Ayarlar kaydedilemedi.");
      }
    } catch (err) {
      showToast("error", "Politika kaydedilirken hata oluştu.");
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleCleanupNow = async () => {
    setCleaningNow(true);
    try {
      const res = await fetch(`/api/settings/restore-points/cleanup-now`, {
        method: "POST",
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        showToast("success", data.message);
        await fetchRestorePoints();
      } else {
        showToast("error", data.detail || "Temizleme işlemi başarısız oldu.");
      }
    } catch (err) {
      showToast("error", "Temizleme sırasında sunucu hatası oluştu.");
    } finally {
      setCleaningNow(false);
    }
  };

  const openRestoreModal = (pt) => {
    setRestoreTarget(pt);
    setRestoreMode("all");
    setSelectedCategories(categoriesMeta.map((c) => c.id));
    setCreateSafetyPoint(true);
  };

  const toggleCategory = (catId) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    if (restoreMode === "custom" && selectedCategories.length === 0) {
      showToast("error", "Lütfen geri yüklenecek en az bir ayar kategorisi seçiniz.");
      return;
    }
    setRestoringPoint(true);
    try {
      const res = await fetch(`/api/settings/restore-points/${restoreTarget.id}/restore`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          categories: restoreMode === "all" ? null : selectedCategories,
          create_safety_point: Boolean(createSafetyPoint)
        })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        showToast("success", data.message || "Ayarlar başarıyla geri yüklendi.");
        setRestoreTarget(null);
        await fetchRestorePoints();
      } else {
        showToast("error", data.detail || data.message || "Geri yükleme işlemi başarısız oldu.");
      }
    } catch (err) {
      showToast("error", "Geri yükleme sırasında bağlantı hatası oluştu.");
    } finally {
      setRestoringPoint(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/settings/restore-points/${deleteTarget.id}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        showToast("success", data.message || "Geri yükleme noktası silindi.");
        setPoints((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        showToast("error", data.detail || "Silme işlemi başarısız oldu.");
      }
    } catch (err) {
      showToast("error", "Silme işlemi sırasında hata oluştu.");
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return "-";
    try {
      const d = new Date(isoStr);
      return d.toLocaleString("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return isoStr;
    }
  };

  const totalStorageKb = points.reduce((acc, p) => acc + (Number(p.size_kb) || 0), 0).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-2xl ${lightBg} ${lightText} border ${borderLight} shrink-0`}>
              <RotateCcw size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Geri Yükleme Noktaları (Sistem Ayarları)
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${lightBg} ${lightText} border ${borderLight}`}>
                  Tenant Bazlı İzole Snapshot
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                AI Temsilci, Çağrı Akışı, Santral veya Kullanıcı ayarlarında kritik bir değişiklik yapmadan önce anlık geri yükleme noktası oluşturun. Çağrı geçmişi, ses kayıtları ve lisans anahtarları etkilenmeden sadece sistem ayarlarınızı istediğiniz ana geri döndürün.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={fetchRestorePoints}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Listeyi Yenile"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            {canWrite && (
              <button
                type="button"
                onClick={() => {
                  setNewTitle("");
                  setNewDescription("");
                  setShowCreateModal(true);
                }}
                title="Yeni Geri Yükleme Noktası Oluştur"
                className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 shadow-sm transition-all"
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800/70">
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Kayıtlı Nokta Sayısı</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {points.length} <span className="text-xs font-normal text-slate-400">/ {policy.max_restore_points} limit</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Otomatik Oluşturma</div>
            <div className="text-sm font-bold mt-1 flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${policy.auto_create_enabled ? "bg-emerald-500" : "bg-slate-400"}`} />
              <span className="text-slate-800 dark:text-slate-200">
                {policy.auto_create_enabled ? `Aktif (${policy.auto_create_interval_hours} Saatte Bir)` : "Kapalı"}
              </span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Otomatik Temizleme</div>
            <div className="text-sm font-bold mt-1 flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${policy.auto_cleanup_enabled ? "bg-emerald-500" : "bg-amber-500"}`} />
              <span className="text-slate-800 dark:text-slate-200">
                {policy.auto_cleanup_enabled ? `${policy.retention_days} Gün / Maks ${policy.max_restore_points}` : "Kapalı"}
              </span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Toplam Ayar Boyutu</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{totalStorageKb} KB</div>
          </div>
        </div>
      </div>

      {/* Feedback Notification */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            feedback.type === "success"
              ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50/90 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Manual Restore Point Creation Card (Inline & 1-Click) */}
      {canWrite && (
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${lightBg} ${lightText}`}>
                <RotateCcw size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Manuel Geri Yükleme Noktası Oluştur
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  AI Temsilci, Çağrı Akışı veya Santral ayarlarında değişiklik yapmadan önce mevcut durumu manuel olarak kaydedin.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={creatingPoint}
              onClick={() =>
                handleCreatePoint(
                  null,
                  `Hızlı Manuel Kayıt (${new Date().toLocaleString("tr-TR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })})`
                )
              }
              className="px-4 py-2 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all flex items-center gap-2 shrink-0 self-start sm:self-center"
            >
              <Sparkles size={14} />
              <span>{creatingPoint ? "Oluşturuluyor..." : "Tek Tıkla Anlık Kayıt Al"}</span>
            </button>
          </div>

          <form onSubmit={(e) => handleCreatePoint(e, null)} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-5">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Geri Yükleme Noktası Başlığı
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Örn: Satış AI Temsilcisi Güncellemesi Öncesi"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="md:col-span-5">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Açıklama / Not (İsteğe Bağlı)
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Yapacağınız işlem hakkında kısa bilgi..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="md:col-span-2 flex items-end">
                <button
                  type="submit"
                  disabled={creatingPoint}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-sm transition-all flex items-center justify-center gap-1.5 ${bg} ${hover}`}
                >
                  <Plus size={15} />
                  <span>{creatingPoint ? "Kaydediliyor..." : "Manuel Oluştur"}</span>
                </button>
              </div>
            </div>

            {/* Quick Title Presets */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mr-1">
                Hazır Başlıklar:
              </span>
              {QUICK_TITLE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setNewTitle(preset)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </form>
        </div>
      )}

      {/* Automation & Retention Policy Card */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Sliders size={18} className={lightText} />
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Otomatik Oluşturma & Otomatik Silme (Şişmeyi Önleme) Ayarları
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Sistemin belirlediğiniz periyotlarla kendi kendine geri yükleme noktası almasını ve eski kayıtları temizleyerek şişmesini önlemesini yapılandırın.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left: Automatic Restore Point Creation */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/70 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${lightBg} ${lightText}`}>
                  <Clock size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Otomatik Geri Yükleme Noktası Oluşturma
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Belirlenen periyotlarda sistem ayarlarını otomatik yedekler
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={Boolean(policy.auto_create_enabled)}
                  onChange={(e) => setPolicy({ ...policy, auto_create_enabled: e.target.checked })}
                />
                <div className="w-10 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className={`space-y-3 transition-opacity ${policy.auto_create_enabled ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Otomatik Oluşturma Periyodu
                </label>
                <select
                  value={policy.auto_create_interval_hours}
                  onChange={(e) => setPolicy({ ...policy, auto_create_interval_hours: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value={6}>Her 6 Saatte Bir</option>
                  <option value={12}>Her 12 Saatte Bir</option>
                  <option value={24}>Günlük (Her 24 Saatte Bir)</option>
                  <option value={72}>3 Günde Bir (72 Saat)</option>
                  <option value={168}>Haftalık (7 Günde Bir)</option>
                </select>
              </div>
              {policy.last_auto_created_at && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Calendar size={12} />
                  <span>Son otomatik kayıt: {formatDate(policy.last_auto_created_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Automatic Restore Point Deletion / Retention */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/70 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${lightBg} ${lightText}`}>
                  <HardDrive size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Otomatik Geri Yükleme Noktası Silme (Şişmeyi Önleme)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Eski veya sayı limitini aşan noktaları otomatik temizler
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={Boolean(policy.auto_cleanup_enabled)}
                  onChange={(e) => setPolicy({ ...policy, auto_cleanup_enabled: e.target.checked })}
                />
                <div className="w-10 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 transition-opacity ${policy.auto_cleanup_enabled ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Maksimum Kayıt Adedi Limiti
                </label>
                <select
                  value={policy.max_restore_points}
                  onChange={(e) => setPolicy({ ...policy, max_restore_points: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value={5}>En Fazla 5 Nokta Sakla</option>
                  <option value={10}>En Fazla 10 Nokta Sakla</option>
                  <option value={15}>En Fazla 15 Nokta Sakla</option>
                  <option value={20}>En Fazla 20 Nokta Sakla (Önerilen)</option>
                  <option value={30}>En Fazla 30 Nokta Sakla</option>
                  <option value={50}>En Fazla 50 Nokta Sakla</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Maksimum Saklama Süresi (Gün)
                </label>
                <select
                  value={policy.retention_days}
                  onChange={(e) => setPolicy({ ...policy, retention_days: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value={7}>7 Günden Eskileri Sil</option>
                  <option value={14}>14 Günden Eskileri Sil</option>
                  <option value={30}>30 Günden Eskileri Sil (Önerilen)</option>
                  <option value={60}>60 Günden Eskileri Sil</option>
                  <option value={90}>90 Günden Eskileri Sil</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Save Policy Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleCleanupNow}
            disabled={cleaningNow}
            className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <Trash2 size={14} />
            <span>{cleaningNow ? "Temizleniyor..." : "Eski Kayıtları Şimdi Temizle"}</span>
          </button>

          <button
            type="button"
            onClick={handleSavePolicy}
            disabled={savingPolicy}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all flex items-center gap-2 ${bg} ${hover}`}
          >
            <Check size={15} />
            <span>{savingPolicy ? "Kaydediliyor..." : "Otomasyon Ayarlarını Kaydet"}</span>
          </button>
        </div>
      </div>

      {/* Restore Points Timeline List */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers size={16} className={lightText} />
            <span>Kayıtlı Geri Yükleme Noktaları ({points.length})</span>
          </h4>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
            Geri yükleme noktaları yükleniyor...
          </div>
        ) : points.length === 0 ? (
          <div className="py-12 px-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
            <div className={`mx-auto w-12 h-12 rounded-2xl ${lightBg} ${lightText} flex items-center justify-center`}>
              <RotateCcw size={22} />
            </div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Henüz Geri Yükleme Noktası Bulunmuyor
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Sağ üstteki <strong>+</strong> butonuna tıklayarak sistem ayarlarınızın ilk geri yükleme noktasını saniyeler içinde oluşturabilirsiniz.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {points.map((pt) => {
              const s = pt.summary || {};
              const isAuto = Boolean(pt.is_auto);
              const isPreRestore = pt.point_type === "pre_restore";

              return (
                <div
                  key={pt.id}
                  className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/40 dark:bg-slate-800/20 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {pt.title}
                      </span>
                      {isPreRestore ? (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                          Güvenlik Yedeği (Geri Yükleme Öncesi)
                        </span>
                      ) : isAuto ? (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
                          Otomatik Periyodik Kayıt
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                          Manuel Kayıt
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                        {pt.size_kb || 0} KB
                      </span>
                    </div>

                    {pt.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {pt.description}
                      </p>
                    )}

                    {/* Summary Pills */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                        <Bot size={11} className="text-purple-500" />
                        {s.ai_agents_count ?? 0} AI Temsilci
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                        <GitBranch size={11} className="text-indigo-500" />
                        {s.workflows_count ?? 0} Akış / {s.rules_count ?? 0} Kural
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                        <Server size={11} className="text-blue-500" />
                        {s.trunks_count ?? 0} Trunk / {s.queues_count ?? 0} Kuyruk
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                        <Users size={11} className="text-emerald-500" />
                        {s.users_count ?? 0} Kullanıcı / {s.roles_count ?? 0} Rol
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-slate-400 dark:text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDate(pt.created_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        Oluşturan: {pt.created_by || "Admin"}
                      </span>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => openRestoreModal(pt)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all flex items-center gap-1.5 ${bg} ${hover}`}
                      >
                        <RotateCcw size={14} />
                        <span>Bu Noktaya Geri Dön</span>
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(pt)}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="Geri Yükleme Noktasını Sil"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Restore Point Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${lightBg} ${lightText}`}>
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Yeni Geri Yükleme Noktası Oluştur
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Mevcut müşteri (tenant) için tüm sistem ayarlarının anlık kopyası alınır
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreatePoint} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Geri Yükleme Noktası Başlığı *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Örn: Satış AI Temsilcisi Prompt Güncellemesi Öncesi"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none"
                />
                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {QUICK_TITLE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNewTitle(preset)}
                      className="px-2 py-1 rounded-lg text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Açıklama / Not (İsteğe Bağlı)
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Yapacağınız değişiklik hakkında kısa bilgi yazabilirsiniz..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-500/20 transition cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={creatingPoint}
                  className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm ${bg} ${hover}`}
                >
                  {creatingPoint ? "Oluşturuluyor..." : "Noktayı Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restore Selection & Confirmation Modal */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${lightBg} ${lightText}`}>
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Geri Yükleme Noktasına Dön
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Seçili Nokta: <strong>{restoreTarget.title}</strong> ({formatDate(restoreTarget.created_at)})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Mode selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRestoreMode("all")}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    restoreMode === "all"
                      ? `${lightBg} ${border} ring-1 ${ring}`
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>Tüm Ayarları Geri Yükle</span>
                    {restoreMode === "all" && <CheckCircle2 size={15} className={lightText} />}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    AI Temsilciler, Çağrı Akışları, Santral ve Kullanıcı ayarlarının tamamını o andaki haline döndürür.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setRestoreMode("custom")}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    restoreMode === "custom"
                      ? `${lightBg} ${border} ring-1 ${ring}`
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>Sadece Seçili Alanları Yükle</span>
                    {restoreMode === "custom" && <CheckCircle2 size={15} className={lightText} />}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Örn: Sadece AI Temsilci ayarlarını geri yükleyip diğer santral ayarlarına dokunmaz.
                  </p>
                </button>
              </div>

              {/* Granular category checkboxes */}
              {restoreMode === "custom" && (
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Geri Yüklenecek Ayar Kategorilerini Seçin:
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {categoriesMeta.map((cat) => {
                      const IconComp = CATEGORY_ICONS[cat.id] || Layers;
                      const isChecked = selectedCategories.includes(cat.id);
                      return (
                        <label
                          key={cat.id}
                          onClick={() => toggleCategory(cat.id)}
                          className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                            isChecked
                              ? "bg-slate-50 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700"
                              : "border-slate-200/60 dark:border-slate-800/60 opacity-60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="mt-0.5 rounded"
                          />
                          <IconComp size={16} className={`${lightText} shrink-0 mt-0.5`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              {cat.title}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {cat.description}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Safety Point Option */}
              <label className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createSafetyPoint}
                  onChange={(e) => setCreateSafetyPoint(e.target.checked)}
                  className="mt-0.5 rounded"
                />
                <div className="text-xs text-amber-900 dark:text-amber-200">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldCheck size={14} />
                    <span>Geri yüklemeden önce şu anki ayarların güvenlik kopyasını otomatik oluştur</span>
                  </div>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    Önerilir. Böylece geri yükleme sonrasında isterseniz şu anki mevcut duruma tekrar dönebilirsiniz.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-500/20 transition cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={restoringPoint}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1.5 ${bg} ${hover}`}
              >
                <RotateCcw size={14} />
                <span>{restoringPoint ? "Geri Yükleniyor..." : "Şimdi Geri Yükle"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Geri Yükleme Noktasını Sil"
        message={
          deleteTarget
            ? `'${deleteTarget.title}' adlı geri yükleme noktasını kalıcı olarak silmek istediğinize emin misiniz?`
            : ""
        }
      />
    </div>
  );
}
