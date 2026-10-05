import React, { useState, useEffect } from "react";
import { Terminal, X, RefreshCw, Clock, User, ShieldCheck, AlertTriangle } from "lucide-react";

export default function AuditLogsModal({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAuditLogs();
    }
  }, [isOpen]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://localhost:8050/api/v1/audit-logs");
      if (res.ok) {
        setLogs(await res.json());
      }
    } catch (e) {
      console.error("Fetch audit logs error:", e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-extrabold">
              <Terminal size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                Merkezi Portal İşlem ve Denetim Logları (Audit Trail)
              </h3>
              <p className="text-xs font-semibold text-slate-400">Lisans merkezindeki tüm kullanıcı aksiyonları ve işlemler</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchAuditLogs}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Yenile"
            >
              <RefreshCw size={16} className={loading ? "animate-spin text-cyan-400" : ""} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Audit Logs Table */}
        <div className="p-6 overflow-y-auto flex-1">
          <table className="w-full text-left text-xs font-semibold">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="pb-3 pl-2">Zaman</th>
                <th className="pb-3">Kullanıcı</th>
                <th className="pb-3">Eylem / Aksiyon</th>
                <th className="pb-3">Detay / İşlem Özeti</th>
                <th className="pb-3 pr-2 text-right">IP Adresi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {logs.map((log) => {
                const isLicenseGen = log.action === "LICENSE_GENERATE";
                const isClientCreate = log.action === "CLIENT_CREATE";
                const isClientSuspend = log.action === "CLIENT_SUSPEND";
                const isLogin = log.action === "USER_LOGIN";

                return (
                  <tr key={log.id} className="hover:bg-slate-950/50 transition-colors">
                    <td className="py-3 pl-2 text-slate-400 text-[11px] whitespace-nowrap">
                      {log.created_at ? new Date(log.created_at).toLocaleString('tr-TR') : "-"}
                    </td>
                    <td className="py-3 font-bold text-white whitespace-nowrap">
                      @{log.username}
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                        isLicenseGen ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                        isClientSuspend ? "bg-rose-500/20 text-rose-400 border-rose-500/30" :
                        isClientCreate ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 text-slate-300 font-sans text-xs">
                      {log.details}
                    </td>
                    <td className="py-3 pr-2 text-right text-slate-500 text-[11px] whitespace-nowrap">
                      {log.ip_address || "127.0.0.1"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
