import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Network,
  Server,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Send,
  KeyRound,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  WifiOff,
  HardDrive,
  Clock,
  Save,
  Copy,
  Check,
  X,
  Shield,
  Sliders,
  PhoneOutgoing,
  UploadCloud
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";

const DEFAULT_MEDIA_POLICY = {
  sync_recordings: true,
  compression: "opus",
  max_kbps: 256,
  schedule_mode: "offhours",
  offhours_start: "19:00",
  offhours_end: "08:00"
};

function formatDateTR(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (e) {
    return iso;
  }
}

export default function FederationMultisitePanel({
  backendHost = "localhost:8000",
  userPermissions = ["*"]
}) {
  const { bg, hover, text, border, lightBg, borderLight } = useTheme();

  const canWrite = useMemo(() => {
    if (!Array.isArray(userPermissions)) return true;
    return userPermissions.includes("*") || userPermissions.includes("federation_multisite:write");
  }, [userPermissions]);

  const canDelete = useMemo(() => {
    if (!Array.isArray(userPermissions)) return true;
    return userPermissions.includes("*") || userPermissions.includes("federation_multisite:delete");
  }, [userPermissions]);

  const [activeTab, setActiveTab] = useState("fleet"); // fleet | node | outbox
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [copiedKey, setCopiedKey] = useState("");

  // Hub Fleet data
  const [summary, setSummary] = useState({
    total_sites: 0,
    online_sites: 0,
    offline_sites: 0,
    pairing_sites: 0,
    total_pending_cdr: 0,
    total_pending_media: 0,
    total_pending_media_mb: 0
  });
  const [sites, setSites] = useState([]);
  const [outbox, setOutbox] = useState([]);

  // Local Node Config data
  const [nodeCfg, setNodeCfg] = useState({
    role: "standalone",
    site_code: "hq",
    site_name: "Genel Merkez",
    hq_url: "",
    pairing_token: "",
    local_lan_ip: "",
    detected_local_ip: "",
    wireguard_ip: "",
    last_config_version_applied: 0,
    last_sync_at: null,
    last_sync_error: "",
    media_sync_policy: { ...DEFAULT_MEDIA_POLICY }
  });
  const [localQueue, setLocalQueue] = useState({
    pending_meta_count: 0,
    pending_media_count: 0,
    pending_media_mb: 0
  });
  const [savingNode, setSavingNode] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);

  // Add/Edit Site Modal
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [editingSiteCode, setEditingSiteCode] = useState(null);
  const [siteForm, setSiteForm] = useState({
    site_code: "",
    site_name: "",
    edge_mode: "active_local",
    extension_range_start: "2000",
    extension_range_end: "2999",
    local_lan_ip: "",
    wireguard_ip: "",
    sip_trunk_port: 5060,
    outbound_primary_trunk: "hq_federation_trunk",
    outbound_failover_trunk: "",
    media_sync_policy: { ...DEFAULT_MEDIA_POLICY }
  });
  const [savingSite, setSavingSite] = useState(false);

  // Pairing & Asterisk Preview Modals
  const [pairingModalSite, setPairingModalSite] = useState(null);
  const [asteriskPreview, setAsteriskPreview] = useState(null);
  const [deleteTargetSite, setDeleteTargetSite] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  };

  const copyText = (val, key) => {
    if (!val || typeof navigator === "undefined") return;
    navigator.clipboard?.writeText(val).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  };

  const apiBase =
    typeof window !== "undefined" ? `${window.location.protocol}//${backendHost}` : `http://${backendHost}`;

  const fetchAll = useCallback(async () => {
    if (typeof window === "undefined") return;
    setLoading(true);
    try {
      const [resSites, resNode] = await Promise.all([
        fetch(`${apiBase}/api/federation/sites?t=${Date.now()}`),
        fetch(`${apiBase}/api/federation/node-config?t=${Date.now()}`)
      ]);
      if (resSites.ok) {
        const d = await resSites.json();
        if (d.summary) setSummary(d.summary);
        setSites(Array.isArray(d.sites) ? d.sites : []);
        setOutbox(Array.isArray(d.outbox) ? d.outbox : []);
      }
      if (resNode.ok) {
        const dn = await resNode.json();
        if (dn.node) {
          setNodeCfg({
            ...dn.node,
            media_sync_policy: { ...DEFAULT_MEDIA_POLICY, ...(dn.node.media_sync_policy || {}) }
          });
        }
        if (dn.local_queue) setLocalQueue(dn.local_queue);
      }
    } catch (err) {
      showToast("error", "Çok-şubeli santral verileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openNewSiteModal = () => {
    const nextIdx = sites.length + 1;
    const baseExt = (nextIdx + 1) * 1000;
    setEditingSiteCode(null);
    setSiteForm({
      site_code: `site-0${nextIdx}`,
      site_name: "",
      edge_mode: "active_local",
      extension_range_start: String(baseExt),
      extension_range_end: String(baseExt + 999),
      local_lan_ip: "",
      wireguard_ip: `10.200.${nextIdx}.1`,
      sip_trunk_port: 5060,
      outbound_primary_trunk: "hq_federation_trunk",
      outbound_failover_trunk: "",
      media_sync_policy: { ...DEFAULT_MEDIA_POLICY }
    });
    setSiteModalOpen(true);
  };

  const openEditSiteModal = (s) => {
    setEditingSiteCode(s.site_code);
    setSiteForm({
      site_code: s.site_code,
      site_name: s.site_name || "",
      edge_mode: s.edge_mode || "active_local",
      extension_range_start: s.extension_range_start || "2000",
      extension_range_end: s.extension_range_end || "2999",
      local_lan_ip: s.local_lan_ip || "",
      wireguard_ip: s.wireguard_ip || "",
      sip_trunk_port: s.sip_trunk_port || 5060,
      outbound_primary_trunk: s.outbound_primary_trunk || "hq_federation_trunk",
      outbound_failover_trunk: s.outbound_failover_trunk || "",
      media_sync_policy: { ...DEFAULT_MEDIA_POLICY, ...(s.media_sync_policy || {}) }
    });
    setSiteModalOpen(true);
  };

  const handleSaveSite = async (e) => {
    e.preventDefault();
    if (!canWrite || savingSite) return;
    setSavingSite(true);
    try {
      const res = await fetch(`${apiBase}/api/federation/sites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(siteForm)
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", d?.detail || "Şube kaydedilemedi.");
        return;
      }
      setSiteModalOpen(false);
      showToast("success", `'${siteForm.site_name}' şubesi kaydedildi.`);
      fetchAll();
    } catch (err) {
      showToast("error", "Sunucu hatası oluştu.");
    } finally {
      setSavingSite(false);
    }
  };

  const handleDeleteSite = async () => {
    if (!deleteTargetSite || !canDelete) return;
    try {
      const res = await fetch(`${apiBase}/api/federation/sites/${encodeURIComponent(deleteTargetSite.site_code)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showToast("success", `'${deleteTargetSite.site_name}' şubesi silindi.`);
        fetchAll();
      }
    } finally {
      setDeleteTargetSite(null);
    }
  };

  const handlePushConfig = async (site) => {
    if (!canWrite) return;
    try {
      const res = await fetch(`${apiBase}/api/federation/sites/${encodeURIComponent(site.site_code)}/push-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: `${site.site_name} konfigürasyon & failover paketi` })
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(
          "success",
          `${site.site_name} için v${d.config_version} konfigürasyon paketi kuyruğa alındı. Şube çevrimiçi ise anında, çevrimdışı ise internete dönünce uygulanır.`
        );
        fetchAll();
      }
    } catch (err) {
      showToast("error", "Konfigürasyon paketi oluşturulamadı.");
    }
  };

  const handleOpenAsteriskPreview = async (site) => {
    try {
      const res = await fetch(`${apiBase}/api/federation/sites/${encodeURIComponent(site.site_code)}/asterisk-preview`);
      if (res.ok) {
        const d = await res.json();
        setAsteriskPreview(d);
      }
    } catch (err) {
      showToast("error", "Asterisk şube-arası yapılandırma önizlemesi alınamadı.");
    }
  };

  const handleSaveNodeConfig = async () => {
    if (!canWrite || savingNode) return;
    setSavingNode(true);
    try {
      const res = await fetch(`${apiBase}/api/federation/node-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nodeCfg)
      });
      if (res.ok) {
        showToast("success", "Sunucu federasyon rolü ve senkronizasyon ayarları kaydedildi.");
        fetchAll();
      }
    } catch (err) {
      showToast("error", "Sunucu rolü kaydedilemedi.");
    } finally {
      setSavingNode(false);
    }
  };

  const handleTriggerEdgeSync = async () => {
    if (syncingNow) return;
    setSyncingNow(true);
    try {
      const res = await fetch(`${apiBase}/api/federation/edge/sync-now`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force_media: true })
      });
      const d = await res.json().catch(() => ({}));
      if (d.status === "ok") {
        showToast(
          "success",
          `Senkronizasyon tamamlandı: ${d.synced_meta || 0} CDR/kayıt ve ${d.synced_media || 0} ses dosyası Merkeze aktarıldı.`
        );
      } else {
        showToast("error", d.error || d.reason || "Merkez şu an erişilemiyor (yerel kayıt devam ediyor).");
      }
      fetchAll();
    } catch (err) {
      showToast("error", "Senkronizasyon başlatılamadı.");
    } finally {
      setSyncingNow(false);
    }
  };

  const hqPublicOrigin =
    typeof window !== "undefined" ? `${window.location.protocol}//${window.location.host}` : "";

  return (
    <div className="space-y-5">
      {/* Header Card */}
      <div className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border ${borderLight} shadow-sm`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`w-11 h-11 rounded-2xl ${lightBg} border ${borderLight} flex items-center justify-center shrink-0`}>
              <Network size={22} className={text} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Çok-Şubeli Dağıtık Santral (Multi-Site Edge &amp; Failover)
                </h3>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase ${lightBg} ${text} border ${borderLight}`}>
                  Rol: {nodeCfg.role === "hub" ? "Merkez (Hub)" : nodeCfg.role === "edge" ? `Şube (${nodeCfg.site_code})` : "Tekil (Standalone)"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Taşra şubelerinde internet kopsa bile yerel çalışan Nornia Edge sunucularını tek arayüzden yönetin, Aktif-Yerel veya SRST Failover modu seçin, CDR ve sıkıştırılmış ses kayıtlarını otomatik Merkeze senkronize edin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchAll}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Yenile</span>
            </button>
            {canWrite && (
              <button
                type="button"
                onClick={openNewSiteModal}
                title="Yeni Şube Ekle"
                className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all shadow-sm cursor-pointer"
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
          {[
            { id: "fleet", label: `Şube Filosu & Sağlık (${sites.length})`, icon: Server },
            { id: "node", label: "Bu Sunucunun Rolü & Medya Politikası", icon: Sliders },
            { id: "outbox", label: `Konfigürasyon Dağıtım Geçmişi (${outbox.length})`, icon: UploadCloud }
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === t.id
                    ? `${bg} text-white shadow-sm`
                    : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                }`}
              >
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {toast && (
        <div
          className={`px-4 py-3 rounded-2xl border text-xs font-bold flex items-center gap-2 shadow-sm ${
            toast.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
              : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {toast.type === "error" ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* TAB 1: FLEET & BRANCH HEALTH */}
      {activeTab === "fleet" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] font-bold text-slate-500">Kayıtlı Şube</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{summary.total_sites}</div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/50">
              <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Çevrimiçi Şube</div>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{summary.online_sites}</div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/50">
              <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Çevrimdışı (Yerel Modda)</div>
              <div className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">{summary.offline_sites}</div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] font-bold text-slate-500">Sync Bekleyen CDR</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{summary.total_pending_cdr}</div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] font-bold text-slate-500">Sync Bekleyen Ses</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {summary.total_pending_media} <span className="text-xs font-bold text-slate-400">({summary.total_pending_media_mb} MB)</span>
              </div>
            </div>
          </div>

          {sites.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
              <Server size={28} className="mx-auto text-slate-400" />
              <div className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                Henüz tanımlı uzak şube (Edge Santral) yok
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Sağ üstteki <strong>+</strong> butonuna tıklayarak taşra şubelerinizi ekleyin; dahili bloğu, Aktif-Yerel/SRST Failover modu, yedek GSM/PSTN dış hattı ve bant genişliği kısıtlı ses kaydı senkronizasyonunu tanımlayın.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {sites.map((s) => {
                const mp = s.media_sync_policy || DEFAULT_MEDIA_POLICY;
                return (
                  <div
                    key={s.site_code}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            s.status === "online"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              : s.status === "offline"
                              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {s.status === "online" ? <Wifi size={11} /> : <WifiOff size={11} />}
                          {s.status === "online" ? "Çevrimiçi" : s.status === "offline" ? "Çevrimdışı (Yerel Çalışıyor)" : "Eşleştirme Bekliyor"}
                        </span>

                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {s.site_name}
                        </h4>
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                          {s.site_code}
                        </span>

                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${lightBg} ${text} border ${borderLight}`}>
                          {s.edge_mode === "srst_failover" ? "SRST Failover (Merkez → Yerel)" : "Aktif-Yerel Edge (LAN)"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                        <span>
                          <strong>Dahililer:</strong>{" "}
                          <span className="font-mono">{s.extension_range_start}–{s.extension_range_end}</span>
                        </span>
                        {s.local_lan_ip && (
                          <span>
                            <strong>LAN IP:</strong> <span className="font-mono">{s.local_lan_ip}</span>
                          </span>
                        )}
                        {s.wireguard_ip && (
                          <span>
                            <strong>Tünel IP:</strong> <span className="font-mono">{s.wireguard_ip}</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <PhoneOutgoing size={11} className="text-slate-400" />
                          <strong>Dış Hat:</strong> {s.outbound_primary_trunk || "Merkez"}
                          {s.outbound_failover_trunk ? ` → Yedek: ${s.outbound_failover_trunk}` : " (Yalnızca Yerel)"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                          <HardDrive size={10} />
                          Medya Sync: {mp.sync_recordings ? `${String(mp.compression).toUpperCase()} • ${mp.max_kbps > 0 ? `${mp.max_kbps} Kbps` : "Sınırsız"} • ${mp.schedule_mode === "offhours" ? `Mesai Dışı (${mp.offhours_start}-${mp.offhours_end})` : mp.schedule_mode === "realtime" ? "7/24 Anlık" : "Manuel"}` : "Kapalı"}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                          <Clock size={10} />
                          Son Görülme: {formatDateTR(s.last_seen_at)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md font-bold ${s.config_in_sync ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"}`}>
                          Config: v{s.last_config_version_applied} / v{s.target_config_version}
                        </span>
                        {(s.pending_cdr_count > 0 || s.pending_media_count > 0) && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-extrabold">
                            Kuyruk: {s.pending_cdr_count} CDR • {s.pending_media_count} Ses ({s.pending_media_mb} MB)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => handlePushConfig(s)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${bg} ${hover} text-white text-xs font-bold shadow-sm cursor-pointer`}
                          title="Şubeye Güncel Konfigürasyon Paketi Gönder"
                        >
                          <Send size={12} />
                          <span>Konfig Gönder</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPairingModalSite(s)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                        title="Edge Sunucu Eşleştirme Anahtarı"
                      >
                        <KeyRound size={12} />
                        <span>Eşleştir</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenAsteriskPreview(s)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                        title="Asterisk Şube-Arası Trunk & Failover Dialplan Önizle"
                      >
                        <Terminal size={12} />
                        <span>Trunk/Failover</span>
                      </button>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => openEditSiteModal(s)}
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                          title="Şubeyi Düzenle"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeleteTargetSite(s)}
                          className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 cursor-pointer"
                          title="Şubeyi Sil"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: THIS NODE ROLE & EDGE STORE-AND-FORWARD CONFIG */}
      {activeTab === "node" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { id: "standalone", title: "Tekil Santral (Standalone)", desc: "Bağımsız çalışan tek lokasyonlu santral" },
              { id: "hub", title: "Merkez Santral (Hub)", desc: "Tüm taşra şubelerini tek arayüzden yöneten ve CDR/ses kayıtlarını toplayan merkez" },
              { id: "edge", title: "Şube Santrali (Edge)", desc: "İnternet kopunca yerelde çalışan, internet gelince Merkeze otomatik senkronize olan şube" }
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={!canWrite}
                onClick={() => setNodeCfg((p) => ({ ...p, role: opt.id }))}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  nodeCfg.role === opt.id
                    ? `${lightBg} ${border} ${text}`
                    : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                <div className="text-xs font-extrabold">{opt.title}</div>
                <div className="text-[11px] opacity-80 mt-1 leading-relaxed">{opt.desc}</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Bu Sunucunun Şube Kodu</label>
              <input
                type="text"
                disabled={!canWrite}
                value={nodeCfg.site_code}
                onChange={(e) => setNodeCfg((p) => ({ ...p, site_code: e.target.value }))}
                placeholder="hq veya site-01"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Yerel LAN IP (Oto: {nodeCfg.detected_local_ip})</label>
              <input
                type="text"
                disabled={!canWrite}
                value={nodeCfg.local_lan_ip}
                onChange={(e) => setNodeCfg((p) => ({ ...p, local_lan_ip: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">WireGuard Tünel IP</label>
              <input
                type="text"
                disabled={!canWrite}
                value={nodeCfg.wireguard_ip}
                onChange={(e) => setNodeCfg((p) => ({ ...p, wireguard_ip: e.target.value }))}
                placeholder="10.200.0.10"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
              />
            </div>
          </div>

          {nodeCfg.role === "edge" && (
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                  <Shield size={14} className={text} />
                  <span>Merkez (Hub) Bağlantı &amp; Store-and-Forward Senkronizasyon</span>
                </div>
                <button
                  type="button"
                  disabled={syncingNow}
                  onClick={handleTriggerEdgeSync}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl ${bg} ${hover} text-white text-xs font-bold cursor-pointer disabled:opacity-50`}
                >
                  <RefreshCw size={12} className={syncingNow ? "animate-spin" : ""} />
                  <span>{syncingNow ? "Senkronize Ediliyor..." : "Şimdi Merkeze Senkronize Et"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Merkez (HQ) Sunucu URL</label>
                  <input
                    type="text"
                    disabled={!canWrite}
                    value={nodeCfg.hq_url}
                    onChange={(e) => setNodeCfg((p) => ({ ...p, hq_url: e.target.value }))}
                    placeholder="https://app.nornia.com.tr veya http://10.200.0.10:8000"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Eşleştirme Anahtarı (Pairing Token)</label>
                  <input
                    type="password"
                    disabled={!canWrite}
                    value={nodeCfg.pairing_token}
                    onChange={(e) => setNodeCfg((p) => ({ ...p, pairing_token: e.target.value }))}
                    placeholder="nfed_..."
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
                <span>Bekleyen CDR/Log: <strong>{localQueue.pending_meta_count}</strong></span>
                <span>Bekleyen Ses Kaydı: <strong>{localQueue.pending_media_count} ({localQueue.pending_media_mb} MB)</strong></span>
                <span>Son Başarılı Sync: <strong>{formatDateTR(nodeCfg.last_sync_at)}</strong></span>
              </div>
              {nodeCfg.last_sync_error && (
                <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
                  {nodeCfg.last_sync_error}
                </div>
              )}
            </div>
          )}

          {/* Media Compression & Throttling Policy Editor */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <HardDrive size={14} className={text} />
              <span>Ses Kaydı Sıkıştırma &amp; Bant Genişliği Politikası</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Ses Aktarımı</label>
                <select
                  disabled={!canWrite}
                  value={nodeCfg.media_sync_policy?.sync_recordings ? "on" : "off"}
                  onChange={(e) =>
                    setNodeCfg((p) => ({
                      ...p,
                      media_sync_policy: { ...p.media_sync_policy, sync_recordings: e.target.value === "on" }
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                >
                  <option value="on">Aktif (Merkeze Aktar)</option>
                  <option value="off">Kapalı (Sadece CDR)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Sıkıştırma Formatı</label>
                <select
                  disabled={!canWrite}
                  value={nodeCfg.media_sync_policy?.compression || "opus"}
                  onChange={(e) =>
                    setNodeCfg((p) => ({
                      ...p,
                      media_sync_policy: { ...p.media_sync_policy, compression: e.target.value }
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                >
                  <option value="opus">OPUS (~%85 tasarruf)</option>
                  <option value="mp3">MP3 (~%75 tasarruf)</option>
                  <option value="wav">WAV (Orijinal)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Bant Genişliği Limiti</label>
                <select
                  disabled={!canWrite}
                  value={String(nodeCfg.media_sync_policy?.max_kbps ?? 256)}
                  onChange={(e) =>
                    setNodeCfg((p) => ({
                      ...p,
                      media_sync_policy: { ...p.media_sync_policy, max_kbps: Number(e.target.value) }
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                >
                  <option value="128">128 Kbps (Çok Zayıf Hat)</option>
                  <option value="256">256 Kbps (Önerilen)</option>
                  <option value="512">512 Kbps</option>
                  <option value="1024">1 Mbps</option>
                  <option value="0">Sınırsız</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Aktarım Zamanlaması</label>
                <select
                  disabled={!canWrite}
                  value={nodeCfg.media_sync_policy?.schedule_mode || "offhours"}
                  onChange={(e) =>
                    setNodeCfg((p) => ({
                      ...p,
                      media_sync_policy: { ...p.media_sync_policy, schedule_mode: e.target.value }
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                >
                  <option value="offhours">Yalnızca Mesai Dışı</option>
                  <option value="realtime">7/24 Anlık</option>
                  <option value="manual">Yalnızca Manuel</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Mesai Dışı Aralığı</label>
                <div className="flex items-center gap-1">
                  <input
                    type="time"
                    disabled={!canWrite || nodeCfg.media_sync_policy?.schedule_mode !== "offhours"}
                    value={nodeCfg.media_sync_policy?.offhours_start || "19:00"}
                    onChange={(e) =>
                      setNodeCfg((p) => ({
                        ...p,
                        media_sync_policy: { ...p.media_sync_policy, offhours_start: e.target.value }
                      }))
                    }
                    className="w-1/2 px-2 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-40"
                  />
                  <input
                    type="time"
                    disabled={!canWrite || nodeCfg.media_sync_policy?.schedule_mode !== "offhours"}
                    value={nodeCfg.media_sync_policy?.offhours_end || "08:00"}
                    onChange={(e) =>
                      setNodeCfg((p) => ({
                        ...p,
                        media_sync_policy: { ...p.media_sync_policy, offhours_end: e.target.value }
                      }))
                    }
                    className="w-1/2 px-2 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-40"
                  />
                </div>
              </div>
            </div>
          </div>

          {canWrite && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={savingNode}
                onClick={handleSaveNodeConfig}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold shadow-sm cursor-pointer disabled:opacity-50`}
              >
                <Save size={14} />
                <span>{savingNode ? "Kaydediliyor..." : "Sunucu Ayarlarını Kaydet"}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CONFIG DISTRIBUTION OUTBOX */}
      {activeTab === "outbox" && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase text-slate-500">
                  <th className="py-3 px-4">Şube</th>
                  <th className="py-3 px-3">Sürüm</th>
                  <th className="py-3 px-3">Özet</th>
                  <th className="py-3 px-3">Durum</th>
                  <th className="py-3 px-3">Oluşturulma</th>
                  <th className="py-3 px-3">Uygulanma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {outbox.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Henüz şubelere gönderilmiş konfigürasyon paketi bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  outbox.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-white">{o.site_code}</td>
                      <td className="py-3 px-3 font-mono font-bold">v{o.config_version}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{o.change_summary}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            o.status === "applied"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                              : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {o.status === "applied" ? "Uygulandı" : "Bekliyor (Şube Çekince Uygulanır)"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{formatDateTR(o.created_at)}</td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{formatDateTR(o.applied_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD / EDIT BRANCH MODAL */}
      {siteModalOpen && (
        <div className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                {editingSiteCode ? `Şube Düzenle (${editingSiteCode})` : "Yeni Taşra / Şube Santrali Ekle"}
              </h4>
              <button type="button" onClick={() => setSiteModalOpen(false)} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSite} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Şube Kodu (Benzersiz)</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingSiteCode)}
                    value={siteForm.site_code}
                    onChange={(e) => setSiteForm((p) => ({ ...p, site_code: e.target.value }))}
                    placeholder="site-01"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Şube Adı</label>
                  <input
                    type="text"
                    required
                    value={siteForm.site_name}
                    onChange={(e) => setSiteForm((p) => ({ ...p, site_name: e.target.value }))}
                    placeholder="Örn: Polatlı Şubesi"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  />
                </div>
              </div>

              {/* Branch Mode Selector */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Çalışma &amp; Hayatta Kalma Modu</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { id: "active_local", title: "Aktif-Yerel Edge (Taşra İçin Önerilen)", desc: "Telefonlar daima şubedeki yerel Nornia'ya bağlıdır; kötü internette sıfır kesinti." },
                    { id: "srst_failover", title: "SRST Failover (Merkez → Yerel)", desc: "İnternet varken Merkeze bağlı, koparsa 15-30 sn'de yerel şube santraline geçer." }
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSiteForm((p) => ({ ...p, edge_mode: m.id }))}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        siteForm.edge_mode === m.id
                          ? `${lightBg} ${border} ${text}`
                          : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <div className="text-xs font-extrabold">{m.title}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Dahili Başlangıç</label>
                  <input
                    type="text"
                    value={siteForm.extension_range_start}
                    onChange={(e) => setSiteForm((p) => ({ ...p, extension_range_start: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Dahili Bitiş</label>
                  <input
                    type="text"
                    value={siteForm.extension_range_end}
                    onChange={(e) => setSiteForm((p) => ({ ...p, extension_range_end: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Şube Yerel IP</label>
                  <input
                    type="text"
                    value={siteForm.local_lan_ip}
                    onChange={(e) => setSiteForm((p) => ({ ...p, local_lan_ip: e.target.value }))}
                    placeholder="192.168.10.250"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">WireGuard IP</label>
                  <input
                    type="text"
                    value={siteForm.wireguard_ip}
                    onChange={(e) => setSiteForm((p) => ({ ...p, wireguard_ip: e.target.value }))}
                    placeholder="10.200.1.1"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Outbound Failover Trunks */}
              <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="text-[11px] font-extrabold text-slate-800 dark:text-white">
                  Dış Arama &amp; İnternet Kesintisi Yedek Hat (Failover Trunk)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">1. Birincil Dış Hat</label>
                    <input
                      type="text"
                      value={siteForm.outbound_primary_trunk}
                      onChange={(e) => setSiteForm((p) => ({ ...p, outbound_primary_trunk: e.target.value }))}
                      placeholder="hq_federation_trunk veya Operator_Trunk"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">2. Yedek Yerel Hat (GSM/FXO — Opsiyonel)</label>
                    <input
                      type="text"
                      value={siteForm.outbound_failover_trunk}
                      onChange={(e) => setSiteForm((p) => ({ ...p, outbound_failover_trunk: e.target.value }))}
                      placeholder="Boş = Sadece Lokal Çalışır (örn. Local_GSM_GW)"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Per-site Media Sync Policy */}
              <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="text-[11px] font-extrabold text-slate-800 dark:text-white">
                  Ses Kaydı Sıkıştırma &amp; Senkronizasyon Politikası
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Format</label>
                    <select
                      value={siteForm.media_sync_policy.compression}
                      onChange={(e) =>
                        setSiteForm((p) => ({
                          ...p,
                          media_sync_policy: { ...p.media_sync_policy, compression: e.target.value }
                        }))
                      }
                      className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                    >
                      <option value="opus">OPUS (~%85 küçük)</option>
                      <option value="mp3">MP3 (~%75 küçük)</option>
                      <option value="wav">WAV (Orijinal)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Hız Limiti</label>
                    <select
                      value={String(siteForm.media_sync_policy.max_kbps)}
                      onChange={(e) =>
                        setSiteForm((p) => ({
                          ...p,
                          media_sync_policy: { ...p.media_sync_policy, max_kbps: Number(e.target.value) }
                        }))
                      }
                      className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                    >
                      <option value="128">128 Kbps</option>
                      <option value="256">256 Kbps</option>
                      <option value="512">512 Kbps</option>
                      <option value="1024">1 Mbps</option>
                      <option value="0">Sınırsız</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Zamanlama</label>
                    <select
                      value={siteForm.media_sync_policy.schedule_mode}
                      onChange={(e) =>
                        setSiteForm((p) => ({
                          ...p,
                          media_sync_policy: { ...p.media_sync_policy, schedule_mode: e.target.value }
                        }))
                      }
                      className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                    >
                      <option value="offhours">Mesai Dışı</option>
                      <option value="realtime">7/24 Anlık</option>
                      <option value="manual">Manuel</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Gece Saatleri</label>
                    <div className="flex gap-1">
                      <input
                        type="time"
                        value={siteForm.media_sync_policy.offhours_start}
                        onChange={(e) =>
                          setSiteForm((p) => ({
                            ...p,
                            media_sync_policy: { ...p.media_sync_policy, offhours_start: e.target.value }
                          }))
                        }
                        className="w-1/2 px-1.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold"
                      />
                      <input
                        type="time"
                        value={siteForm.media_sync_policy.offhours_end}
                        onChange={(e) =>
                          setSiteForm((p) => ({
                            ...p,
                            media_sync_policy: { ...p.media_sync_policy, offhours_end: e.target.value }
                          }))
                        }
                        className="w-1/2 px-1.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSiteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={savingSite}
                  className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold shadow-sm cursor-pointer disabled:opacity-50`}
                >
                  <Save size={13} />
                  <span>{savingSite ? "Kaydediliyor..." : "Şubeyi Kaydet"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAIRING INFO MODAL */}
      {pairingModalSite && (
        <div className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound size={16} className={text} />
                <span>Edge Şube Eşleştirme Bilgileri — {pairingModalSite.site_name}</span>
              </h4>
              <button type="button" onClick={() => setPairingModalSite(null)} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Taşradaki şube Nornia sunucusunda <strong>Sistem Ayarları → Çok-Şubeli Santral → Bu Sunucunun Rolü (Edge)</strong> alanına aşağıdaki 3 bilgiyi girin:
            </p>
            <div className="space-y-2.5 text-xs">
              {[
                { label: "Merkez (HQ) URL", val: hqPublicOrigin, k: "hq" },
                { label: "Şube Kodu (Site Code)", val: pairingModalSite.site_code, k: "sc" },
                { label: "Eşleştirme Anahtarı (Pairing Token)", val: pairingModalSite.pairing_token, k: "tok" }
              ].map((row) => (
                <div key={row.k} className="space-y-1">
                  <div className="text-[10px] font-bold uppercase text-slate-400">{row.label}</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={row.val}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => copyText(row.val, row.k)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === row.k ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      <span>Kopyala</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ASTERISK INTER-SITE TRUNK & FAILOVER PREVIEW MODAL */}
      {asteriskPreview && (
        <div className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[88vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Terminal size={16} className={text} />
                <span>Asterisk Şube-Arası Trunk &amp; Yedek Dış Hat Dialplanı — {asteriskPreview.site?.site_name}</span>
              </h4>
              <button type="button" onClick={() => setAsteriskPreview(null)} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {[
                { title: "1. Merkez (HQ) — PJSIP Inter-Site Trunk", code: asteriskPreview.snippets?.hq_pjsip },
                { title: "2. Merkez (HQ) — Şube Dahili Bloğu Yönlendirmesi", code: asteriskPreview.snippets?.hq_dialplan },
                { title: "3. Şube (Edge) — Merkeze PJSIP Trunk", code: asteriskPreview.snippets?.edge_pjsip },
                { title: "4. Şube (Edge) — Dahili Arama & Yedek Yerel Dış Hat (Failover) Dialplanı", code: asteriskPreview.snippets?.edge_dialplan }
              ].map((blk, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="font-extrabold text-slate-700 dark:text-slate-200">{blk.title}</div>
                  <pre className="p-3.5 rounded-xl bg-slate-950 text-emerald-300 font-mono text-[11px] overflow-x-auto leading-relaxed">
                    {blk.code}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteTargetSite && (
        <ConfirmDeleteModal
          title="Şube Kaydını Sil"
          message={`'${deleteTargetSite.site_name}' (${deleteTargetSite.site_code}) şubesini merkez filodan kaldırmak istediğinize emin misiniz? Şube yerel çalışmaya devam eder ancak merkeze senkronizasyonu durur.`}
          onConfirm={handleDeleteSite}
          onCancel={() => setDeleteTargetSite(null)}
        />
      )}
    </div>
  );
}
