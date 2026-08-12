import React, { useState, useEffect, useRef } from "react";
import { 
  Play, Square, Trash2, Download, Search, RefreshCw, Terminal, 
  ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle, XCircle, 
  Info, ChevronRight, Copy, Check, Filter, Layers, Code, PhoneCall
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

export default function SipDebuggerPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  
  const [calls, setCalls] = useState([]);
  const [selectedCallId, setSelectedCallId] = useState(null);
  const [callDetails, setCallDetails] = useState(null);
  const [isRunning, setIsRunning] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState({});

  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
  const apiBase = `${protocol}//${backendHost}/api/sip-debugger`;

  // Fetch calls list
  const fetchCalls = async () => {
    try {
      const res = await fetch(`${apiBase}/calls?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls || []);
        setIsRunning(data.is_running);
        
        // Auto select first call if none selected
        if (!selectedCallId && data.calls && data.calls.length > 0) {
          setSelectedCallId(data.calls[0].call_id);
        }
      }
    } catch (e) {
      console.error("SIP debugger fetch calls error:", e);
    }
  };

  // Fetch details of selected call
  const fetchCallDetails = async (callId) => {
    if (!callId) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/calls/${encodeURIComponent(callId)}`);
      if (res.ok) {
        const data = await res.json();
        setCallDetails(data.call);
        if (data.call?.messages?.length > 0 && !selectedMessage) {
          setSelectedMessage(data.call.messages[0]);
        }
      }
    } catch (e) {
      console.error("SIP debugger fetch details error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
    const interval = setInterval(() => {
      fetchCalls();
    }, 3000);
    return () => clearInterval(interval);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedCallId) {
      fetchCallDetails(selectedCallId);
    }
  }, [selectedCallId]);

  // Toggle Sniffing Start/Stop
  const toggleCapture = async () => {
    const action = isRunning ? "stop" : "start";
    try {
      const res = await fetch(`${apiBase}/${action}`, { method: "POST" });
      if (res.ok) {
        setIsRunning(!isRunning);
      }
    } catch (e) {
      console.error("Toggle capture error:", e);
    }
  };

  // Clear traces
  const handleClearTraces = async () => {
    try {
      const res = await fetch(`${apiBase}/clear`, { method: "DELETE" });
      if (res.ok) {
        setCalls([]);
        setSelectedCallId(null);
        setCallDetails(null);
        setSelectedMessage(null);
      }
    } catch (e) {
      console.error("Clear traces error:", e);
    } finally {
      setShowClearModal(false);
    }
  };

  // Download PCAP for call
  const downloadPcap = async (callId, e) => {
    if (e) e.stopPropagation();
    setIsDownloading((prev) => ({ ...prev, [callId]: true }));
    try {
      const url = `${apiBase}/calls/${encodeURIComponent(callId)}/pcap`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("PCAP indirme hatası");
      
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      const safeId = callId.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
      a.download = `sip_trace_${safeId}.pcap`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert("PCAP indirilemedi: " + err.message);
    } finally {
      setIsDownloading((prev) => ({ ...prev, [callId]: false }));
    }
  };

  // Copy raw text to clipboard
  const handleCopyRaw = () => {
    if (!selectedMessage) return;
    navigator.clipboard.writeText(selectedMessage.raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Badge styling for status codes
  const getStatusBadge = (status) => {
    if (!status) return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300";
    if (status.includes("200") || status === "ACK") {
      return "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40";
    }
    if (status.includes("100") || status.includes("180") || status.includes("183")) {
      return "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40";
    }
    if (status.includes("4") || status.includes("5") || status.includes("6")) {
      return "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40";
    }
    return "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40";
  };

  return (
    <div className="w-full space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${lightBg} ${text}`}>
            <Terminal size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                SIP Trafik Yakalayıcı (sngrep)
              </h2>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isRunning 
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" 
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}>
                <span className={`w-2 h-2 rounded-full ${isRunning ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}></span>
                {isRunning ? "Canlı Dinleme Aktif" : "Durduruldu"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Gerçek zamanlı SIP paket akışı, görsel akış (Ladder Diagram) ve Wireshark uyumlu PCAP indirme.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Call-ID, numara veya metot ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>

          <button
            onClick={toggleCapture}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              isRunning 
                ? "bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
            }`}
          >
            {isRunning ? <Square size={14} /> : <Play size={14} />}
            <span>{isRunning ? "Durdur" : "Başlat"}</span>
          </button>

          <button
            onClick={() => setShowClearModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 rounded-xl text-xs font-medium transition border border-rose-200 dark:border-rose-900/40"
            title="Temizle"
          >
            <Trash2 size={14} />
            <span>Temizle</span>
          </button>

          <button
            onClick={fetchCalls}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs transition"
            title="Yenile"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Main Grid: Left Call Sessions List | Right sngrep Ladder & Raw SIP Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Captured Calls (5 Cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col h-[700px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <PhoneCall size={14} className={text} />
              Yakalnan SIP Çağrıları ({calls.length})
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {calls.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center py-12">
                <Terminal size={36} className="mb-2 opacity-40" />
                <p className="text-xs font-medium">Henüz yakalanan SIP çağrısı yok.</p>
                <p className="text-[11px] text-slate-500 mt-1">Sistemde yeni bir arama yapıldığında burada listelenecektir.</p>
              </div>
            ) : (
              calls.map((c) => {
                const isSelected = selectedCallId === c.call_id;
                return (
                  <div
                    key={c.call_id}
                    onClick={() => setSelectedCallId(c.call_id)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer relative group ${
                      isSelected
                        ? `${lightBg} ${border} shadow-sm`
                        : "bg-slate-50/50 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800 border-slate-200/60 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${getStatusBadge(c.last_status)}`}>
                            {c.last_status}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 truncate">
                            {c.start_time}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-white truncate">
                          <span>{c.caller}</span>
                          <ChevronRight size={12} className="text-slate-400 shrink-0" />
                          <span>{c.callee}</span>
                        </div>

                        <div className="mt-1 text-[10px] font-mono text-slate-400 truncate" title={c.call_id}>
                          CID: {c.call_id}
                        </div>
                      </div>

                      <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-200/60 dark:bg-slate-700/60 px-1.5 py-0.5 rounded">
                          {c.packet_count} pkt
                        </span>

                        <button
                          onClick={(e) => downloadPcap(c.call_id, e)}
                          disabled={isDownloading[c.call_id]}
                          className="mt-2 p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 dark:text-indigo-400 rounded-lg text-xs transition border border-indigo-200 dark:border-indigo-800/40 flex items-center gap-1"
                          title="Wireshark/sngrep uyumlu PCAP dosyasını indir"
                        >
                          <Download size={13} />
                          <span className="text-[10px] font-bold">.PCAP</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: sngrep Visual Flow Ladder Diagram & Header Inspector (7 Cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col h-[700px]">
          {!selectedCallId || !callDetails ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center">
              <Layers size={40} className="mb-2 opacity-30" />
              <p className="text-xs font-medium">Lütfen soldan incelemek istediğiniz bir SIP çağrısı seçin.</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Call Flow Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className={text}>SIP Akış Diyagramı (sngrep Ladder View)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-md">
                    {callDetails.call_id}
                  </p>
                </div>

                <button
                  onClick={(e) => downloadPcap(callDetails.call_id, e)}
                  disabled={isDownloading[callDetails.call_id]}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  <Download size={14} />
                  <span>PCAP İndir</span>
                </button>
              </div>

              {/* Ladder Network Node Columns Header */}
              <div className="grid grid-cols-3 gap-2 bg-slate-900 text-slate-200 text-[11px] font-mono py-2 px-3 rounded-xl mb-3 shadow-inner">
                <div className="text-center truncate font-bold text-emerald-400">
                  İstemci (Client / WebRTC)
                </div>
                <div className="text-center truncate font-bold text-amber-400">
                  Santral PBX (Asterisk)
                </div>
                <div className="text-center truncate font-bold text-indigo-400">
                  Dış Hat (Trunk / Provider)
                </div>
              </div>

              {/* Messages Flow Arrows Timeline */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar mb-4">
                {callDetails.messages?.map((m, idx) => {
                  const isSelectedMsg = selectedMessage === m;
                  const isOutbound = m.src_ip.startsWith("192.168") || m.src_port === 5060;

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedMessage(m)}
                      className={`p-2.5 rounded-xl border font-mono text-xs transition cursor-pointer ${
                        isSelectedMsg
                          ? "bg-slate-900 text-white border-indigo-500 shadow-md ring-2 ring-indigo-500/20"
                          : "bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 text-[10px] text-slate-400">
                        <span>{m.timestamp}</span>
                        <span>{m.src_ip}:{m.src_port} → {m.dst_ip}:{m.dst_port}</span>
                      </div>

                      {/* Directional Visual Arrow */}
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBadge(m.status)}`}>
                          {m.status}
                        </span>

                        <div className="flex-1 flex items-center px-2">
                          <div className="w-full h-0.5 bg-slate-300 dark:bg-slate-600 relative flex items-center justify-center">
                            <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                              {m.method}
                            </span>
                          </div>
                        </div>

                        <ChevronRight size={16} className={isSelectedMsg ? "text-indigo-400" : "text-slate-400"} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Raw SIP Header Inspector */}
              {selectedMessage && (
                <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 flex flex-col h-[220px]">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                    <div className="flex items-center gap-2 text-slate-300 text-xs font-mono">
                      <Code size={14} className="text-indigo-400" />
                      <span>Ham SIP Başlıkları ({selectedMessage.status})</span>
                    </div>

                    <button
                      onClick={handleCopyRaw}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition"
                    >
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      <span>{copied ? "Kopyalandı" : "Metni Kopyala"}</span>
                    </button>
                  </div>

                  <pre className="flex-1 overflow-y-auto text-[11px] font-mono text-emerald-400 bg-slate-900/80 p-2.5 rounded-lg custom-scrollbar whitespace-pre-wrap select-all">
                    {selectedMessage.raw}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Delete / Clear Confirm Modal */}
      {showClearModal && (
        <ConfirmDeleteModal
          isOpen={showClearModal}
          onClose={() => setShowClearModal(false)}
          onConfirm={handleClearTraces}
          title="SIP İzlerini Temizle"
          description="Yakalnan tüm SIP paketleri ve çağrı oturumları listeden temizlenecektir. Bu işlem geri alınamaz."
        />
      )}
    </div>
  );
}
