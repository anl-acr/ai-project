import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Square,
  Trash2,
  Download,
  Search,
  RefreshCw,
  Terminal,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Copy,
  Check,
  Layers,
  Code,
  PhoneCall,
  Activity
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

const DIALOG_FILTERS = [
  { id: "ALL", label: "Tümü" },
  { id: "INVITE", label: "Çağrılar (INVITE)" },
  { id: "REGISTER", label: "Kayıt (REGISTER)" },
  { id: "OPTIONS", label: "Keepalive (OPTIONS)" }
];

// Classify an IP:Port endpoint into column 0 (Client/WebRTC/Ext), 1 (PBX), or 2 (Trunk/External)
function classifyLadderColumn(ip, port, call) {
  const ipStr = String(ip || "");
  const pNum = Number(port || 0);
  // PBX side typically listens on 5060, 5061, or 8089 on loopback / server local IP
  const isPbxPort = pNum === 8089 || pNum === 5061;
  if (isPbxPort) return 1;

  // Check if call initial packet helps distinguish PBX IP
  const firstMsg = call?.messages?.[0];
  if (firstMsg) {
    if (pNum === 5060 && ipStr === firstMsg.dst_ip && firstMsg.src_ip !== firstMsg.dst_ip) {
      return 1;
    }
  }

  // Private / loopback / WebRTC ephemeral port -> Client (0); Public IP on 5060 -> Trunk (2)
  const isPrivate =
    ipStr.startsWith("10.") ||
    ipStr.startsWith("192.168.") ||
    ipStr.startsWith("127.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ipStr);

  if (pNum !== 5060) return 0;
  if (!isPrivate) return 2;
  return 0;
}

export default function SipDebuggerPanel({ backendHost = "localhost:8000", embedded = false }) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();

  const [calls, setCalls] = useState([]);
  const [selectedCallId, setSelectedCallId] = useState(null);
  const [callDetails, setCallDetails] = useState(null);
  const [isRunning, setIsRunning] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState({});

  const selectedCallIdRef = useRef(selectedCallId);
  const autoFollowRef = useRef(autoFollow);
  const methodFilterRef = useRef(methodFilter);
  const searchQueryRef = useRef(searchQuery);
  const lastFetchedPktCountRef = useRef({});

  useEffect(() => {
    selectedCallIdRef.current = selectedCallId;
  }, [selectedCallId]);
  useEffect(() => {
    autoFollowRef.current = autoFollow;
  }, [autoFollow]);
  useEffect(() => {
    methodFilterRef.current = methodFilter;
  }, [methodFilter]);
  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  const protocol =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
  const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
  const apiBase = `${protocol}//${backendHost}/api/sip-debugger`;
  const wsUrl = `${wsProtocol}//${backendHost}/api/sip-debugger/ws`;

  const fetchCallDetails = async (callId, silent = false) => {
    if (!callId) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${apiBase}/calls/${encodeURIComponent(callId)}`);
      if (res.ok) {
        const data = await res.json();
        const detail = data.call;
        setCallDetails(detail);
        if (detail?.messages?.length > 0) {
          lastFetchedPktCountRef.current[callId] = detail.messages.length;
          setSelectedMessage((prev) => {
            if (prev && detail.messages.some((m) => m.id === prev.id)) {
              return prev;
            }
            return detail.messages[detail.messages.length - 1];
          });
        }
      }
    } catch (e) {
      console.error("SIP debugger fetch details error:", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchCalls = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQueryRef.current) params.set("q", searchQueryRef.current);
      if (methodFilterRef.current && methodFilterRef.current !== "ALL") {
        params.set("method", methodFilterRef.current);
      }
      const res = await fetch(`${apiBase}/calls?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const nextCalls = data.calls || [];
        setCalls(nextCalls);
        setIsRunning(Boolean(data.is_running));

        const curSelected = selectedCallIdRef.current;
        if (!curSelected && nextCalls.length > 0) {
          setSelectedCallId(nextCalls[0].call_id);
        } else if (curSelected) {
          const matching = nextCalls.find((c) => c.call_id === curSelected);
          if (
            matching &&
            lastFetchedPktCountRef.current[curSelected] !== matching.packet_count
          ) {
            fetchCallDetails(curSelected, true);
          }
        }
      }
    } catch (e) {
      console.error("SIP debugger fetch calls error:", e);
    }
  };

  useEffect(() => {
    fetchCalls();
    const interval = setInterval(() => {
      fetchCalls();
    }, 2500);
    return () => clearInterval(interval);
  }, [searchQuery, methodFilter]);

  useEffect(() => {
    if (selectedCallId) {
      fetchCallDetails(selectedCallId);
    }
  }, [selectedCallId]);

  // Real-time WebSocket stream for instant (< 20ms) live packet updates
  useEffect(() => {
    if (typeof window === "undefined") return;
    let ws = null;
    let pingTimer = null;
    let reconnectTimer = null;
    let disposed = false;

    const connectWs = () => {
      if (disposed) return;
      try {
        ws = new WebSocket(wsUrl);
      } catch (_err) {
        reconnectTimer = setTimeout(connectWs, 3000);
        return;
      }

      ws.onopen = () => {
        if (disposed) return;
        setWsConnected(true);
        pingTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 15000);
      };

      ws.onmessage = (evt) => {
        if (disposed || !evt.data || evt.data === "pong") return;
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "status") {
            setIsRunning(Boolean(msg.is_running));
            return;
          }
          if (msg.type === "sip_packet" && msg.packet && msg.call) {
            const incomingCall = msg.call;
            const incomingPkt = msg.packet;

            const mf = methodFilterRef.current;
            const sq = (searchQueryRef.current || "").toLowerCase();
            const initM = String(incomingCall.initial_method || "").toUpperCase();

            const passesMethod = mf === "ALL" || initM === mf;
            const passesSearch =
              !sq ||
              incomingCall.call_id.toLowerCase().includes(sq) ||
              incomingCall.caller.toLowerCase().includes(sq) ||
              incomingCall.callee.toLowerCase().includes(sq) ||
              incomingCall.last_status.toLowerCase().includes(sq);

            if (passesMethod && passesSearch) {
              setCalls((prev) => {
                const filtered = prev.filter((c) => c.call_id !== incomingCall.call_id);
                return [incomingCall, ...filtered].slice(0, 300);
              });

              const curSel = selectedCallIdRef.current;
              const isBrandNewInvite =
                incomingCall.packet_count === 1 && initM === "INVITE";

              if (!curSel || (autoFollowRef.current && isBrandNewInvite)) {
                setSelectedCallId(incomingCall.call_id);
                setCallDetails({
                  ...incomingCall,
                  messages: [incomingPkt]
                });
                lastFetchedPktCountRef.current[incomingCall.call_id] = 1;
                setSelectedMessage(incomingPkt);
              } else if (curSel === incomingCall.call_id) {
                setCallDetails((prevDetails) => {
                  if (!prevDetails || prevDetails.call_id !== incomingCall.call_id) {
                    return prevDetails;
                  }
                  const alreadyExists = (prevDetails.messages || []).some(
                    (m) => m.id === incomingPkt.id
                  );
                  if (alreadyExists) return prevDetails;
                  const nextMsgs = [...(prevDetails.messages || []), incomingPkt];
                  lastFetchedPktCountRef.current[incomingCall.call_id] = nextMsgs.length;
                  return {
                    ...prevDetails,
                    last_status: incomingCall.last_status,
                    last_time: incomingCall.last_time,
                    messages: nextMsgs
                  };
                });
                setSelectedMessage(incomingPkt);
              }
            }
          }
        } catch (_parseErr) {
          // ignore non-json keepalive frames
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (pingTimer) clearInterval(pingTimer);
        if (!disposed) {
          reconnectTimer = setTimeout(connectWs, 3000);
        }
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch (_e) {}
      };
    };

    connectWs();

    return () => {
      disposed = true;
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try {
          ws.close();
        } catch (_e) {}
      }
    };
  }, [wsUrl]);

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

  const handleClearTraces = async () => {
    try {
      const res = await fetch(`${apiBase}/clear`, { method: "DELETE" });
      if (res.ok) {
        setCalls([]);
        setSelectedCallId(null);
        setCallDetails(null);
        setSelectedMessage(null);
        lastFetchedPktCountRef.current = {};
      }
    } catch (e) {
      console.error("Clear traces error:", e);
    } finally {
      setShowClearModal(false);
    }
  };

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
      console.error("PCAP indirilemedi:", err);
    } finally {
      setIsDownloading((prev) => ({ ...prev, [callId]: false }));
    }
  };

  const handleCopyRaw = () => {
    if (!selectedMessage) return;
    navigator.clipboard.writeText(selectedMessage.raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status) => {
    const st = String(status || "");
    if (st.includes("200") || st === "ACK") {
      return "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40";
    }
    if (st.includes("100") || st.includes("180") || st.includes("183")) {
      return "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40";
    }
    if (st.startsWith("4") || st.startsWith("5") || st.startsWith("6")) {
      return "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40";
    }
    return `${lightBg} ${text} border border-primary/25`;
  };

  return (
    <div className="w-full space-y-5">
      {/* Control & Filter Bar */}
      <div
        className={
          "p-4 bg-white dark:bg-slate-900 rounded-2xl border shadow-sm space-y-3.5 " +
          borderLight
        }
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {!embedded && (
              <div className={`p-2.5 rounded-xl ${lightBg} ${text}`}>
                <Terminal size={20} aria-hidden="true" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  sngrep Çağrı Diyagramı & Canlı Akış Analizi
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                    isRunning
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isRunning ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                    }`}
                  />
                  {isRunning
                    ? wsConnected
                      ? "Canlı Akış Aktif (WebSocket)"
                      : "Canlı Dinleme Aktif"
                    : "Durduruldu"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Gerçek zamanlı SIP diyalog akışı (Asterisk PJSIP, WebRTC WSS, Trunk & AMI), görsel Ladder diyagramı ve PCAP indirme.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <label htmlFor="sngrep-call-search" className="sr-only">
                Call-ID, numara veya durum ara
              </label>
              <Search
                size={14}
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="sngrep-call-search"
                name="q"
                type="text"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="Call-ID, numara veya durum ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 ${ring} w-56`}
              />
            </div>

            <button
              type="button"
              onClick={() => setAutoFollow(!autoFollow)}
              aria-pressed={autoFollow}
              title="Yeni başlayan çağrılara otomatik odaklan"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                autoFollow
                  ? `${lightBg} ${text} border-primary/30`
                  : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
              }`}
            >
              <Activity size={13} aria-hidden="true" />
              <span>Canlı Takip</span>
            </button>

            <button
              type="button"
              onClick={toggleCapture}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                isRunning
                  ? "bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                  : `${bg} ${hover} text-white shadow-sm`
              }`}
            >
              {isRunning ? (
                <Square size={13} aria-hidden="true" />
              ) : (
                <Play size={13} aria-hidden="true" />
              )}
              <span>{isRunning ? "Durdur" : "Başlat"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 rounded-xl text-xs font-semibold transition border border-rose-200 dark:border-rose-900/40"
              title="Temizle"
            >
              <Trash2 size={13} aria-hidden="true" />
              <span>Temizle</span>
            </button>

            <button
              type="button"
              onClick={fetchCalls}
              aria-label="Çağrı listesini yenile"
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs transition"
              title="Yenile"
            >
              <RefreshCw size={14} aria-hidden="true" className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Method Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <span className="text-[11px] font-bold text-slate-400 mr-1">Diyalog Tipi:</span>
          {DIALOG_FILTERS.map((df) => {
            const active = methodFilter === df.id;
            return (
              <button
                key={df.id}
                type="button"
                onClick={() => setMethodFilter(df.id)}
                className={
                  "px-2.5 py-1 rounded-lg text-[11px] font-bold transition " +
                  (active
                    ? `${bg} text-white shadow-sm`
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700")
                }
              >
                {df.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Left Call Sessions List | Right sngrep Ladder & Raw SIP Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Captured Calls (5 Cols) */}
        <div
          className={
            "lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-sm flex flex-col h-[680px] " +
            borderLight
          }
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <PhoneCall size={14} aria-hidden="true" className={text} />
              <span>Canlı SIP Diyalogları ({calls.length})</span>
            </h4>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {calls.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center py-12 px-4">
                <Terminal size={36} aria-hidden="true" className="mb-2 opacity-40" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Canlı SIP trafiği bekleniyor...
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  WebPhone veya dış hat üzerinden bir arama başlatıldığında ya da REGISTER / OPTIONS paketi geldiğinde anlık olarak burada görünecektir.
                </p>
              </div>
            ) : (
              calls.map((c) => {
                const isSelected = selectedCallId === c.call_id;
                return (
                  <div
                    key={c.call_id}
                    onClick={() => {
                      setSelectedCallId(c.call_id);
                    }}
                    className={`p-3.5 rounded-xl border transition cursor-pointer relative group ${
                      isSelected
                        ? `${lightBg} ${border} shadow-sm`
                        : "bg-slate-50/50 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800 border-slate-200/60 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/70 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200">
                            {c.initial_method}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${getStatusBadge(
                              c.last_status
                            )}`}
                          >
                            {c.last_status}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 truncate">
                            {c.last_time || c.start_time}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-white truncate">
                          <span>{c.caller}</span>
                          <ChevronRight size={12} aria-hidden="true" className="text-slate-400 shrink-0" />
                          <span>{c.callee}</span>
                        </div>

                        <div
                          className="mt-1 text-[10px] font-mono text-slate-400 truncate"
                          title={c.call_id}
                        >
                          CID: {c.call_id}
                        </div>
                      </div>

                      <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-200/60 dark:bg-slate-700/60 px-1.5 py-0.5 rounded">
                          {c.packet_count} pkt
                        </span>

                        <button
                          type="button"
                          onClick={(e) => downloadPcap(c.call_id, e)}
                          disabled={isDownloading[c.call_id]}
                          className={`mt-2 p-1.5 ${lightBg} ${text} rounded-lg text-xs transition border border-primary/25 hover:opacity-90 flex items-center gap-1`}
                          title="Wireshark/sngrep uyumlu PCAP dosyasını indir"
                        >
                          <Download size={13} aria-hidden="true" />
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
        <div
          className={
            "lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-sm flex flex-col h-[680px] " +
            borderLight
          }
        >
          {!selectedCallId || !callDetails ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center">
              <Layers size={40} aria-hidden="true" className="mb-2 opacity-30" />
              <p className="text-xs font-medium">
                İncelemek istediğiniz SIP diyaloğunu soldaki listeden seçin.
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Call Flow Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className={text}>SIP Akış Diyagramı (sngrep Ladder View)</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      ({callDetails.messages?.length || 0} paket)
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-md">
                    {callDetails.call_id}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => downloadPcap(callDetails.call_id, e)}
                  disabled={isDownloading[callDetails.call_id]}
                  className={`flex items-center gap-1.5 px-3 py-1.5 ${bg} ${hover} text-white rounded-xl text-xs font-semibold shadow-sm transition shrink-0`}
                >
                  <Download size={14} aria-hidden="true" />
                  <span>PCAP İndir</span>
                </button>
              </div>

              {/* Ladder Network Node Columns Header */}
              <div className="grid grid-cols-3 gap-2 bg-slate-900 text-slate-200 text-[11px] font-mono py-2 px-3 rounded-xl mb-3 shadow-inner">
                <div className="text-center truncate font-bold text-emerald-400">
                  İstemci (WebRTC / Dahili)
                </div>
                <div className="text-center truncate font-bold text-amber-400">
                  Santral PBX (Asterisk)
                </div>
                <div className="text-center truncate font-bold text-sky-400">
                  Dış Hat (Trunk / Operatör)
                </div>
              </div>

              {/* Messages Flow Arrows Timeline */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar mb-4">
                {callDetails.messages?.map((m, idx) => {
                  const isSelectedMsg =
                    selectedMessage &&
                    (selectedMessage.id ? selectedMessage.id === m.id : selectedMessage === m);

                  const srcCol = classifyLadderColumn(m.src_ip, m.src_port, callDetails);
                  let dstCol = classifyLadderColumn(m.dst_ip, m.dst_port, callDetails);
                  if (srcCol === dstCol) {
                    dstCol = srcCol === 0 ? 1 : 0;
                  }
                  const leftCol = Math.min(srcCol, dstCol);
                  const rightCol = Math.max(srcCol, dstCol);
                  const goingRight = srcCol < dstCol;
                  const leftOffsetPct = leftCol === 0 ? 16 : 50;
                  const widthPct = rightCol - leftCol === 2 ? 68 : 34;

                  return (
                    <div
                      key={m.id || idx}
                      onClick={() => setSelectedMessage(m)}
                      className={`p-2.5 rounded-xl border font-mono text-xs transition cursor-pointer ${
                        isSelectedMsg
                          ? `bg-slate-900 text-white ${border} shadow-md`
                          : "bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 text-[10px] text-slate-400">
                        <span>{m.timestamp}</span>
                        <span>
                          {m.protocol || "UDP"} • {m.src_ip}:{m.src_port} → {m.dst_ip}:{m.dst_port}
                        </span>
                      </div>

                      {/* Directional Ladder Span */}
                      <div className="relative h-7 flex items-center">
                        {/* Vertical guide rails */}
                        <div className="absolute inset-y-0 left-[16%] w-px bg-slate-300/50 dark:bg-slate-700/60" />
                        <div className="absolute inset-y-0 left-[50%] w-px bg-slate-300/50 dark:bg-slate-700/60" />
                        <div className="absolute inset-y-0 left-[84%] w-px bg-slate-300/50 dark:bg-slate-700/60" />

                        <div
                          className="relative flex items-center"
                          style={{
                            marginLeft: `${leftOffsetPct}%`,
                            width: `${widthPct}%`
                          }}
                        >
                          {!goingRight && (
                            <ArrowLeft
                              size={14}
                              aria-hidden="true"
                              className="text-amber-500 shrink-0 -ml-1"
                            />
                          )}
                          <div className="w-full h-0.5 bg-slate-400 dark:bg-slate-500 relative flex items-center justify-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold shadow-sm whitespace-nowrap ${getStatusBadge(
                                m.status
                              )}`}
                            >
                              {m.status}
                            </span>
                          </div>
                          {goingRight && (
                            <ArrowRight
                              size={14}
                              aria-hidden="true"
                              className="text-emerald-500 shrink-0 -mr-1"
                            />
                          )}
                        </div>
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
                      <Code size={14} aria-hidden="true" className={text} />
                      <span>Ham SIP Başlıkları ({selectedMessage.status})</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyRaw}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition"
                    >
                      {copied ? (
                        <Check size={13} aria-hidden="true" className="text-emerald-400" />
                      ) : (
                        <Copy size={13} aria-hidden="true" />
                      )}
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

      {showClearModal && (
        <ConfirmDeleteModal
          isOpen={showClearModal}
          onClose={() => setShowClearModal(false)}
          onConfirm={handleClearTraces}
          title="SIP İzlerini Temizle"
          description="Yakalanan tüm SIP paketleri ve çağrı oturumları listeden temizlenecektir. Bu işlem geri alınamaz."
        />
      )}
    </div>
  );
}
