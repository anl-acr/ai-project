import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Terminal,
  Search,
  RefreshCw,
  Trash2,
  Pause,
  Play,
  X,
  FileCode,
  Globe,
  Cpu,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function TftpLogTab({
  backendHost = "localhost:8000",
  getAuthHeaders,
  onOpenFileInDirectory,
  onTotalCountChange,
}) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();
  const API_BASE =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${backendHost}`
      : `http://${backendHost}`;

  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [uniqueIps, setUniqueIps] = useState([]);
  const [uniqueMacs, setUniqueMacs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Realtime toggle & filters
  const [isLive, setIsLive] = useState(true);
  const [ipFilter, setIpFilter] = useState("");
  const [macFilter, setMacFilter] = useState("");
  const [queryFilter, setQueryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | ok | 404 | error

  // Clear logs confirmation modal
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const inFlightRef = useRef(false);

  const fetchLogs = useCallback(
    async (silent = false) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      if (!silent) setLoading(true);
      try {
        const qs = new URLSearchParams({ limit: "250" });
        if (ipFilter.trim()) qs.set("ip", ipFilter.trim());
        if (macFilter.trim()) qs.set("mac", macFilter.trim());
        if (queryFilter.trim()) qs.set("q", queryFilter.trim());
        if (statusFilter !== "all") qs.set("status", statusFilter);

        const res = await fetch(`${API_BASE}/api/settings/autoprovision/tftp-logs?${qs.toString()}`, {
          headers: getAuthHeaders ? getAuthHeaders() : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        setLogs(Array.isArray(data.logs) ? data.logs : []);
        const nextTotal = Number(data.total_count || 0);
        setTotalCount(nextTotal);
        setUniqueIps(Array.isArray(data.unique_ips) ? data.unique_ips : []);
        setUniqueMacs(Array.isArray(data.unique_macs) ? data.unique_macs : []);
        if (typeof onTotalCountChange === "function") {
          onTotalCountChange(nextTotal);
        }
      } catch {
        // Silent background polling failure
      } finally {
        inFlightRef.current = false;
        if (!silent) setLoading(false);
      }
    },
    [API_BASE, getAuthHeaders, ipFilter, macFilter, queryFilter, statusFilter, onTotalCountChange]
  );

  useEffect(() => {
    fetchLogs(false);
  }, [fetchLogs]);

  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      fetchLogs(true);
    }, 2000);
    return () => clearInterval(timer);
  }, [isLive, fetchLogs]);

  const handleClearLogs = async () => {
    setClearing(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/autoprovision/tftp-logs`, {
        method: "DELETE",
        headers: getAuthHeaders ? getAuthHeaders() : {},
      });
      if (res.ok) {
        setLogs([]);
        setTotalCount(0);
        setUniqueIps([]);
        setUniqueMacs([]);
        if (typeof onTotalCountChange === "function") onTotalCountChange(0);
      }
    } finally {
      setClearing(false);
      setShowClearConfirm(false);
    }
  };

  const hasActiveFilters = Boolean(ipFilter.trim() || macFilter.trim() || queryFilter.trim() || statusFilter !== "all");

  const resetFilters = () => {
    setIpFilter("");
    setMacFilter("");
    setQueryFilter("");
    setStatusFilter("all");
  };

  return (
    <div className="space-y-4">
      {/* Header & Realtime Controls */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl ${lightBg} ${text} border ${borderLight} flex items-center justify-center shrink-0`}>
              <Terminal size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Gerçek Zamanlı TFTP Trafik İzleme
                </h4>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                  <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${isLive ? "animate-ping" : ""}`} />
                  {isLive ? "CANLI (2sn)" : "DURAKLATILDI"}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 tabular-nums">
                  {logs.length} / {totalCount} kayıt
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Telefonların TFTP (Hub + Yerel UDP 69) üzerinden istediği tüm XML, konfigürasyon ve firmware dosyalarını anlık izleyin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setIsLive((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                isLive
                  ? `${bg} text-white border-transparent shadow-sm`
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
              }`}
            >
              {isLive ? <Pause size={13} /> : <Play size={13} />}
              <span>{isLive ? "Duraklat" : "Canlı İzle"}</span>
            </button>

            <button
              type="button"
              onClick={() => fetchLogs(false)}
              disabled={loading}
              title="Logları Şimdi Yenile"
              className="h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>

            <button
              type="button"
              disabled={totalCount === 0}
              onClick={() => setShowClearConfirm(true)}
              title="TFTP Log Geçmişini Temizle"
              className="h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500 hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-800 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Dedicated Filter Inputs: IP, MAC, File/Text, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="lg:col-span-3 relative">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              IP Adresi Filtresi
            </label>
            <div className="relative">
              <input
                type="text"
                value={ipFilter}
                onChange={(e) => setIpFilter(e.target.value)}
                placeholder="Örn: 78.189.210.15"
                className={`w-full text-xs font-mono pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
              />
              <Globe size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              {ipFilter && (
                <button
                  type="button"
                  onClick={() => setIpFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="IP filtresini temizle"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-3 relative">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              MAC Adresi Filtresi
            </label>
            <div className="relative">
              <input
                type="text"
                value={macFilter}
                onChange={(e) => setMacFilter(e.target.value)}
                placeholder="Örn: 68:86:A7:C5:97:66"
                className={`w-full text-xs font-mono pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
              />
              <Cpu size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              {macFilter && (
                <button
                  type="button"
                  onClick={() => setMacFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="MAC filtresini temizle"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 relative">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Dosya Adı / Metin Ara
            </label>
            <div className="relative">
              <input
                type="text"
                value={queryFilter}
                onChange={(e) => setQueryFilter(e.target.value)}
                placeholder="SEP, XMLDefault, dialplan, .loads, TzData..."
                className={`w-full text-xs pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
              />
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              {queryFilter && (
                <button
                  type="button"
                  onClick={() => setQueryFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="Metin filtresini temizle"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Durum
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
            >
              <option value="all">Tümü</option>
              <option value="ok">200 Başarılı</option>
              <option value="404">404 Bulunamadı</option>
              <option value="error">Tüm Hatalar</option>
            </select>
          </div>
        </div>

        {/* Quick-Click Seen IP & MAC Chips */}
        {(uniqueIps.length > 0 || uniqueMacs.length > 0 || hasActiveFilters) && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {uniqueIps.slice(0, 6).map((ipVal) => {
              const active = ipFilter.trim() === ipVal;
              return (
                <button
                  key={`ip-${ipVal}`}
                  type="button"
                  onClick={() => setIpFilter(active ? "" : ipVal)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold transition-colors cursor-pointer border ${
                    active
                      ? `${bg} text-white border-transparent`
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <Globe size={10} />
                  <span>{ipVal}</span>
                </button>
              );
            })}
            {uniqueMacs.slice(0, 6).map((macVal) => {
              const active = macFilter.trim().toUpperCase() === macVal.toUpperCase();
              return (
                <button
                  key={`mac-${macVal}`}
                  type="button"
                  onClick={() => setMacFilter(active ? "" : macVal)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold transition-colors cursor-pointer border ${
                    active
                      ? `${bg} text-white border-transparent`
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <Cpu size={10} />
                  <span>{macVal}</span>
                </button>
              );
            })}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
              >
                <X size={11} />
                Filtreleri Temizle
              </button>
            )}
          </div>
        )}
      </div>

      {/* Semantic Scrollable Responsive Log Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
        <div
          tabIndex={0}
          role="region"
          aria-label="Gerçek Zamanlı TFTP Trafik Logları"
          className="overflow-auto max-h-[580px] focus:outline-none"
        >
          <table className="w-full text-left border-separate border-spacing-0 min-w-[780px]">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950">
              <tr className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th scope="col" className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                  Zaman
                </th>
                <th scope="col" className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                  Durum
                </th>
                <th scope="col" className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                  Kaynak
                </th>
                <th scope="col" className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                  IP Adresi
                </th>
                <th scope="col" className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                  MAC / Cihaz
                </th>
                <th scope="col" className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                  İstenen Dosya
                </th>
                <th scope="col" className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                  Boyut / Detay
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center space-y-1.5">
                    <Terminal size={28} className="mx-auto text-slate-300 dark:text-slate-700" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {hasActiveFilters
                        ? "Seçilen IP / MAC filtresine uyan TFTP trafiği henüz yok."
                        : "Henüz TFTP trafik kaydı yakalanmadı."}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Bir Cisco veya IP telefonu yeniden başlattığınızda tüm TFTP istekleri (200 OK ve 404 dahil) burada anlık olarak akacaktır.
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((lg) => {
                  const isOk = Number(lg.status_code) === 200;
                  const is404 = Number(lg.status_code) === 404;
                  return (
                    <tr
                      key={lg.id}
                      className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <th
                        scope="row"
                        className="px-3.5 py-2.5 font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums"
                        title={lg.timestamp}
                      >
                        {lg.time_short || lg.timestamp}
                      </th>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {isOk ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle size={11} />
                            {lg.event === "COMPLETED" ? "TAMAM" : "200 OK"}
                          </span>
                        ) : is404 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                            <AlertTriangle size={11} />
                            404 YOK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                            <AlertTriangle size={11} />
                            {lg.status_code || "HATA"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {lg.source || lg.protocol || "TFTP"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {lg.client_ip ? (
                          <button
                            type="button"
                            onClick={() => setIpFilter(lg.client_ip)}
                            title="Bu IP adresine göre filtrele"
                            className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:underline cursor-pointer"
                          >
                            {lg.client_ip}
                          </button>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {lg.mac ? (
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => setMacFilter(lg.mac)}
                              title="Bu MAC adresine göre filtrele"
                              className={`font-mono text-[11px] font-bold ${text} hover:underline text-left cursor-pointer`}
                            >
                              {lg.mac}
                            </button>
                            {(lg.extension || lg.device_name) && (
                              <span className="text-[10px] text-slate-400 truncate max-w-[160px]">
                                {lg.extension ? `Dahili ${lg.extension}` : ""}
                                {lg.extension && lg.device_name ? " • " : ""}
                                {lg.device_name || ""}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <FileCode size={13} className="text-slate-400 shrink-0" />
                          <span className="font-mono text-[11px] font-extrabold text-slate-900 dark:text-white">
                            {lg.filename}
                          </span>
                          {isOk && typeof onOpenFileInDirectory === "function" && (
                            <button
                              type="button"
                              onClick={() => onOpenFileInDirectory(lg.filename)}
                              title="Dosyayı Dizin sekmesinde aç"
                              className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${text} cursor-pointer`}
                            >
                              <ExternalLink size={11} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                          {formatBytes(lg.size_bytes)}
                        </span>
                        {lg.detail && <span className="ml-1.5 text-slate-400">• {lg.detail}</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clear Logs Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showClearConfirm}
        onClose={() => !clearing && setShowClearConfirm(false)}
        onConfirm={handleClearLogs}
        title="TFTP Loglarını Temizle"
        message="Bellekteki tüm gerçek zamanlı TFTP trafik kayıtlarını temizlemek istediğinize emin misiniz?"
        loading={clearing}
      />
    </div>
  );
}
