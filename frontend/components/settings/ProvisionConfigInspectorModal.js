import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileCode,
  X,
  Search,
  Copy,
  Check,
  Download,
  RefreshCw,
  Eye,
  EyeOff,
  Clock,
  Globe,
  Server,
  HardDrive,
  AlertCircle,
  Filter,
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";

function maskSecretsInConfig(text) {
  if (!text) return "";
  return text
    .replace(/(<P34>)([^<]*)(<\/P34>)/gi, "$1••••••••$3")
    .replace(/(<Password_1_[^>]*>)([^<]*)(<\/Password_1_>)/gi, "$1••••••••$3")
    .replace(/^(\s*account\.\d+\.password\s*=\s*)(.+)$/gim, "$1••••••••")
    .replace(/^(\s*SIP\d+\s+Register\s+Pswd\s*:\s*)(.+)$/gim, "$1••••••••")
    .replace(/^(\s*static\.security\.user_password\s*=\s*)(.+)$/gim, "$1••••••••");
}

export default function ProvisionConfigInspectorModal({
  isOpen,
  lookupKey, // MAC address or sip_username
  deviceLabel = "",
  backendHost = "localhost:8000",
  onClose,
}) {
  const { bg, hover, text, lightBg, borderLight } = useTheme();
  const API_BASE = getApiBaseUrl(backendHost);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("snapshot"); // "snapshot" | "live"
  const [previewMode, setPreviewMode] = useState("auto"); // "auto" | "lan" | "wan"
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMatchesOnly, setFilterMatchesOnly] = useState(false);
  const [maskPasswords, setMaskPasswords] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchConfig = useCallback(
    async (modeOverride = previewMode) => {
      if (!lookupKey) return;
      setLoading(true);
      setError("");
      try {
        const res = await tenantFetch(
          `${API_BASE}/api/settings/autoprovision-inspect/${encodeURIComponent(lookupKey)}?mode=${encodeURIComponent(modeOverride)}`
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.detail || `Provizyon dosyası okunamadı (HTTP ${res.status}).`);
          setData(null);
          return;
        }
        setData(json);
        // If no snapshot exists yet on first open, automatically land on Live Preview tab
        setActiveTab((prev) => {
          if (prev === "snapshot" && !json?.snapshot?.exists) return "live";
          return prev;
        });
      } catch {
        setError("Sunucuya bağlanılamadı.");
      } finally {
        setLoading(false);
      }
    },
    [API_BASE, lookupKey, previewMode]
  );

  useEffect(() => {
    if (isOpen && lookupKey) {
      setSearchTerm("");
      setFilterMatchesOnly(false);
      setPreviewMode("auto");
      setActiveTab("snapshot");
      fetchConfig("auto");
    }
  }, [isOpen, lookupKey]);

  const rawContent = useMemo(() => {
    if (!data) return "";
    if (activeTab === "snapshot") {
      return data.snapshot?.exists ? data.snapshot.content || "" : "";
    }
    return data.live?.content || "";
  }, [data, activeTab]);

  const displayContent = useMemo(
    () => (maskPasswords ? maskSecretsInConfig(rawContent) : rawContent),
    [rawContent, maskPasswords]
  );

  const linesData = useMemo(() => {
    const allLines = displayContent ? displayContent.split("\n") : [];
    const q = searchTerm.trim().toLowerCase();
    let matchCount = 0;
    const rows = allLines.map((line, i) => {
      const matched = Boolean(q && line.toLowerCase().includes(q));
      if (matched) matchCount += 1;
      return { num: i + 1, text: line, matched };
    });
    return {
      rows: q && filterMatchesOnly ? rows.filter((r) => r.matched) : rows,
      totalLines: allLines.length,
      matchCount,
    };
  }, [displayContent, searchTerm, filterMatchesOnly]);

  const currentFilename = useMemo(() => {
    if (!data) return "provision.cfg";
    if (activeTab === "snapshot" && data.snapshot?.meta?.filename) {
      return data.snapshot.meta.filename;
    }
    return data.live?.filename || "provision.cfg";
  }, [data, activeTab]);

  const handleCopy = () => {
    if (!displayContent || typeof navigator === "undefined") return;
    navigator.clipboard?.writeText(displayContent).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!displayContent || typeof document === "undefined") return;
    const blob = new Blob([displayContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeTab === "snapshot" ? `snapshot_${currentFilename}` : currentFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleModeSwitch = (m) => {
    setPreviewMode(m);
    setActiveTab("live");
    fetchConfig(m);
  };

  if (!isOpen) return null;

  const dev = data?.device;
  const snap = data?.snapshot;
  const live = data?.live;

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl ${lightBg} ${text} border ${borderLight} flex items-center justify-center shrink-0`}>
              <FileCode size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white truncate">
                  Provizyon Dosya İnceleyici — {dev ? `${dev.brand} ${dev.model}` : deviceLabel || lookupKey}
                </h3>
                {dev?.extension && (
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold ${lightBg} ${text}`}>
                    Dahili {dev.extension}
                  </span>
                )}
                {dev?.current_fw_version && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
                    FW: v{dev.current_fw_version}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {dev
                  ? `MAC: ${dev.mac} • SIP: ${dev.sip_username || "-"}${dev.live_ip ? ` • IP: ${dev.live_ip}` : ""}`
                  : lookupKey}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fetchConfig(previewMode)}
              disabled={loading}
              title="Yenile"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              title="Kapat"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab & Toolbar */}
        <div className="px-5 py-3 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab("snapshot")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                  activeTab === "snapshot"
                    ? `${bg} text-white shadow-sm`
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Clock size={12} />
                <span>Telefona Giden Son Dosya</span>
                {snap?.exists && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("live")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                  activeTab === "live"
                    ? `${bg} text-white shadow-sm`
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <FileCode size={12} />
                <span>Şu An Üretilecek (Canlı)</span>
              </button>
            </div>

            {activeTab === "live" && (
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => handleModeSwitch("lan")}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer ${
                    (live?.mode || previewMode) === "lan"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  }`}
                >
                  <Server size={10} /> LAN
                </button>
                <button
                  type="button"
                  onClick={() => handleModeSwitch("wan")}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer ${
                    (live?.mode || previewMode) === "wan"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  }`}
                >
                  <Globe size={10} /> WAN
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Dosyada ara (ör. P2325, P192, dnd)..."
                className="w-56 pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
            {searchTerm.trim() && (
              <button
                type="button"
                onClick={() => setFilterMatchesOnly((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[10px] font-extrabold cursor-pointer ${
                  filterMatchesOnly
                    ? `${bg} text-white border-transparent`
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                }`}
                title="Yalnızca arama terimini içeren satırları göster"
              >
                <Filter size={11} />
                <span>{linesData.matchCount} eşleşme</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setMaskPasswords((v) => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              title="SIP parolalarını gizle / göster"
            >
              {maskPasswords ? <EyeOff size={12} /> : <Eye size={12} />}
              <span>{maskPasswords ? "Şifre Gizli" : "Şifre Açık"}</span>
            </button>
            <button
              type="button"
              disabled={!displayContent}
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40"
            >
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              <span>{copied ? "Kopyalandı" : "Kopyala"}</span>
            </button>
            <button
              type="button"
              disabled={!displayContent}
              onClick={handleDownload}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl ${bg} ${hover} text-white text-[10px] font-extrabold cursor-pointer disabled:opacity-40`}
            >
              <Download size={12} />
              <span>İndir</span>
            </button>
          </div>
        </div>

        {/* Metadata Info Bar */}
        {data && (
          <div className="px-5 py-2 bg-slate-900 text-slate-300 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap text-[10px] font-mono shrink-0">
            {activeTab === "snapshot" ? (
              snap?.exists ? (
                <>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-emerald-400 font-bold">Dosya: {currentFilename}</span>
                    <span>Çekilme: {snap.meta?.fetched_at || "-"}</span>
                    <span>IP: {snap.meta?.client_ip || "-"}</span>
                    <span>Mod: {String(snap.meta?.mode || "-").toUpperCase()}</span>
                    <span>{linesData.totalLines} satır</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 truncate max-w-md" title={snap.disk_path}>
                    <HardDrive size={11} className="shrink-0" />
                    <span className="truncate">{snap.disk_path}</span>
                  </div>
                </>
              ) : (
                <span className="text-amber-400">
                  Bu cihaz güncellemeden sonra henüz santralden yeni bir provizyon çekmedi.
                </span>
              )
            ) : (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sky-400 font-bold">Dosya: {currentFilename}</span>
                  <span>Mod: {String(live?.mode || "-").toUpperCase()}</span>
                  <span>Üretilme: {live?.generated_at || "-"}</span>
                  <span>{linesData.totalLines} satır ({live?.size_bytes || 0} byte)</span>
                </div>
                {dev?.user_agent && (
                  <span className="text-slate-400 truncate max-w-md" title={dev.user_agent}>
                    UA: {dev.user_agent}
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {/* Code Body */}
        <div className="flex-1 overflow-auto bg-slate-950 p-4 font-mono text-[11px] leading-relaxed">
          {loading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-slate-400">
              <RefreshCw size={16} className="animate-spin" />
              <span>Provizyon dosyası yükleniyor...</span>
            </div>
          ) : error ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-rose-400 text-xs">
              <AlertCircle size={22} />
              <span>{error}</span>
            </div>
          ) : activeTab === "snapshot" && !snap?.exists ? (
            <div className="py-14 text-center space-y-3 max-w-md mx-auto">
              <Clock size={26} className="mx-auto text-slate-500" />
              <div className="text-xs font-bold text-slate-200">
                Henüz kaydedilmiş telefon çekim anlık görüntüsü (snapshot) yok.
              </div>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                Telefon bir sonraki provizyon çekimini (Check-Sync / Reboot) yaptığında gönderilen birebir dosya otomatik olarak hem buraya hem sunucu diskine kaydedilir.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("live")}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl ${bg} ${hover} text-white text-xs font-sans font-extrabold cursor-pointer`}
              >
                <FileCode size={13} />
                <span>Şu An Üretilecek Dosyayı Görüntüle</span>
              </button>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <tbody>
                {linesData.rows.map((row) => (
                  <tr
                    key={row.num}
                    className={
                      row.matched
                        ? "bg-amber-500/20 text-amber-100"
                        : "hover:bg-slate-900/80 text-emerald-200/90"
                    }
                  >
                    <td className="select-none pr-4 text-right text-slate-600 w-10 align-top">
                      {row.num}
                    </td>
                    <td className="whitespace-pre-wrap break-all">{row.text || " "}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
