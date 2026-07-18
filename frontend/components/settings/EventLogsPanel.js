import React, { useState, useEffect } from "react";
import { AlertCircle, Calendar, Clock, Database, FileText, Info, Loader2, RefreshCcw, Search, Shield, User, X } from "lucide-react";
import { useTheme } from "../../utils/theme";

export default function EventLogsPanel({ backendHost }) {
  const { bg, text, border, lightBg, hover } = useTheme();
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterModule, setFilterModule] = useState("all");
  
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      // By using window.fetch which is patched in _app.js, X-User-ID is attached
      const res = await fetch(`http://${backendHost}/api/system/logs?limit=500`);
      if (!res.ok) throw new Error("Günlükler alınırken bir hata oluştu.");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [backendHost]);

  const filteredLogs = logs.filter(log => {
    const matchesModule = filterModule === "all" || log.module === filterModule;
    const matchesSearch = 
      (log.user_id && log.user_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.action && log.action.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.module && log.module.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesModule && matchesSearch;
  });

  const getActionColor = (action) => {
    if (action.includes("DELETE") || action.includes("REMOVE")) return "text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400";
    if (action.includes("CREATE") || action.includes("ADD")) return "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900/50 dark:text-emerald-400";
    return "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-900/50 dark:text-blue-400";
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return "-";
    const dateStr = isoStr.endsWith("Z") ? isoStr : `${isoStr}Z`;
    const date = new Date(dateStr);
    return date.toLocaleString("tr-TR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  };

  const moduleTranslations = {
    "Users": "Kullanıcılar",
    "Roles": "Roller",
    "Queues": "Kuyruklar",
    "SIP Trunks": "Dış Hatlar",
    "Blacklist": "Numara Engelleme",
    "System": "Sistem",
  };

  const actionTranslations = {
    "UPDATE_USERS": "Kullanıcı Güncelleme",
    "CREATE_USER": "Kullanıcı Oluşturma",
    "DELETE_USER": "Kullanıcı Silme",
    "UPDATE_ROLES": "Rol Güncelleme",
    "DELETE_ROLE": "Rol Silme",
    "SAVE_QUEUE": "Kuyruk Kaydetme",
    "DELETE_QUEUE": "Kuyruk Silme",
    "SAVE_TRUNK": "Dış Hat Kaydetme",
    "DELETE_TRUNK": "Dış Hat Silme",
    "ADD_BLACKLIST": "Numara Engelleme",
    "REMOVE_BLACKLIST": "Engeli Kaldırma",
    "SYSTEM_STARTUP": "Sistem Başlatma"
  };

  const tModule = (mod) => moduleTranslations[mod] || mod;
  const tAction = (act) => actionTranslations[act] || act;

  const uniqueModules = [...new Set(logs.map(l => l.module))];

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database size={20} className={text} />
            Sistem Olay Günlükleri
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Kullanıcıların ve sistemin yaptığı tüm değişikliklerin detaylı denetim izi.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchLogs}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Yenile
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-8 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Kullanıcı, İşlem veya Modül ara..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
          />
        </div>
        <div className="md:col-span-4">
          <select 
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
          >
            <option value="all">Tüm Modüller</option>
            {uniqueModules.map(mod => (
              <option key={mod} value={mod}>{mod}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400">Tarih</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400">Kullanıcı (IP)</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400">Modül</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400">İşlem</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 text-right">Detaylar</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center">
                    <Loader2 size={32} className={`mx-auto animate-spin ${text}`} />
                    <p className="text-slate-500 dark:text-slate-400 mt-3 text-sm">Günlükler yükleniyor...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-red-500">
                    <AlertCircle size={32} className="mx-auto mb-3" />
                    <p>{error}</p>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center">
                    <Shield size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Kayıt bulunamadı.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <Clock size={14} className="text-slate-400" />
                        {formatDate(log.timestamp)}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${lightBg} ${text}`}>
                          <User size={14} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {log.user_id || "Sistem"}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {log.ip_address || "Bilinmiyor"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-700 dark:text-slate-300 font-medium">
                      {tModule(log.module)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${getActionColor(log.action)}`}>
                        {tAction(log.action)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors`}
                      >
                        <FileText size={14} />
                        İncele
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedLog(null)} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Info size={20} className={text} />
                İşlem Detayları
              </h3>
              <button 
                onClick={() => setSelectedLog(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Gerçekleştiren</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLog.user_id || "Sistem"}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{selectedLog.ip_address}</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">İşlem & Zaman</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{tAction(selectedLog.action)} <span className="text-slate-400 font-normal">({tModule(selectedLog.module)})</span></div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formatDate(selectedLog.timestamp)}</div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Değişiklik Detayları</h4>
                {selectedLog.details && selectedLog.details.changes && Array.isArray(selectedLog.details.changes) ? (
                  <div className="space-y-4">
                    {selectedLog.details.changes.map((change, idx) => (
                      <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl p-4">
                        <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${change.action === "CREATED" ? "bg-emerald-500" : "bg-blue-500"}`}></span>
                          {change.name || "Kayıt"} <span className="text-xs font-normal text-slate-500">({change.action === "CREATED" ? "Yeni Eklendi" : "Güncellendi"})</span>
                        </h5>
                        {change.diff ? (
                          <div className="space-y-2">
                            {Object.entries(change.diff).map(([key, vals]) => (
                              <div key={key} className="grid grid-cols-[100px_1fr_24px_1fr] items-center gap-2 text-sm">
                                <div className="font-medium text-slate-500 dark:text-slate-400 truncate">{key}</div>
                                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 px-2.5 py-1 rounded-lg truncate line-through" title={String(vals.old)}>
                                  {String(vals.old) || "-"}
                                </div>
                                <div className="text-center text-slate-300 dark:text-slate-600">➔</div>
                                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg truncate" title={String(vals.new)}>
                                  {String(vals.new) || "-"}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 dark:text-slate-400">Spesifik alan değişikliği yok.</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-950 rounded-xl p-4 overflow-x-auto border border-slate-800">
                    <pre className="text-xs font-mono text-emerald-400 leading-relaxed">
                      {selectedLog.details ? JSON.stringify(selectedLog.details, null, 2) : "Detay verisi bulunmuyor."}
                    </pre>
                  </div>
                )}
              </div>
              
            </div>
            
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button 
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-xl transition-colors text-sm"
              >
                Kapat
              </button>
            </div>

          </div>
        </div>
      )}
      
    </div>
  );
}
