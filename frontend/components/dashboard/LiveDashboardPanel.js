import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  User, 
  Volume2, 
  PhoneForwarded, 
  Activity, 
  Smile, 
  Meh, 
  Frown, 
  Cpu, 
  Layers, 
  Wifi, 
  ShieldAlert,
  Play,
  Pause,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import AddContactModal from "./AddContactModal";

export default function LiveDashboardPanel({ backendHost = "localhost:8000" }) {
  const [activeCalls, setActiveCalls] = useState([]);
  const [selectedCall, setSelectedCall] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [loadingSpy, setLoadingSpy] = useState(false);
  const [loadingTransfer, setLoadingTransfer] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [agentTopic, setAgentTopic] = useState("");
  const [agentNotes, setAgentNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSuccess, setNotesSuccess] = useState(false);
  const [whisperText, setWhisperText] = useState("");
  const [sendingWhisper, setSendingWhisper] = useState(false);
  const [hasWhisperPermission, setHasWhisperPermission] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  
  // Real-time system metrics (mocked but reactive to simulate live engine activity)
  const [metrics, setMetrics] = useState({
    cpu: 18,
    ram: 42,
    activeWs: 0
  });

  const chatEndRef = useRef(null);
  const wsRef = useRef(null);

  // Poll active calls from the Asterisk/FastAPI backend
  useEffect(() => {
    const fetchActiveCalls = () => {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      fetch(`${protocol}//${backendHost}/api/calls/active`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setActiveCalls(data);
            
            // If the currently selected call is no longer active, deselect it
            if (selectedCall && !data.some(c => c.id === selectedCall.id)) {
              setSelectedCall(null);
              setTranscripts([]);
              if (wsRef.current) wsRef.current.close();
            }
          }
        })
        .catch((err) => console.error("Aktif aramalar alinamadi:", err));
    };

    fetchActiveCalls();
    const interval = setInterval(fetchActiveCalls, 2000);
    return () => clearInterval(interval);
  }, [backendHost, selectedCall]);

  // Fetch real system resource metrics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        const res = await fetch(`${protocol}//${backendHost}/api/system/stats`);
        if (res.ok) {
          const data = await res.json();
          setMetrics({
            cpu: Math.round(data.cpu_usage || 0),
            ram: Math.round(data.ram_usage || 0),
            activeWs: activeCalls.length * 2 + 1
          });
        }
      } catch (err) {
        console.error("Failed to fetch system stats:", err);
      }
    };
    
    fetchStats();
    const timer = setInterval(fetchStats, 5000);
    return () => clearInterval(timer);
  }, [activeCalls, backendHost]);

  // Check AI Whisperer permission on load
  useEffect(() => {
    const checkWhisperPermission = async () => {
      try {
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        const resStatus = await fetch(`${protocol}//${backendHost}/api/agent/status`);
        const statusData = await resStatus.json();
        
        if (!statusData.is_logged_in) {
          setHasWhisperPermission(true); // Allow by default for guest/admin if not logged in
          return;
        }
        
        const resUsers = await fetch(`${protocol}//${backendHost}/api/settings/users`);
        const usersData = await resUsers.json();
        const currentUser = usersData.find(u => u.id === statusData.user_id);
        if (!currentUser) {
          setHasWhisperPermission(true);
          return;
        }

        const resRoles = await fetch(`${protocol}//${backendHost}/api/settings/roles`);
        const rolesData = await resRoles.json();
        const currentRole = rolesData.find(r => r.role_code === currentUser.role);
        if (!currentRole) {
          setHasWhisperPermission(true);
          return;
        }

        const hasAccess = currentRole.permissions.includes("ai_whisper:access");
        setHasWhisperPermission(hasAccess);
      } catch (err) {
        console.error("Whisper permission check failed:", err);
        setHasWhisperPermission(true); // Fallback to true on error so we don't break default setups
      }
    };

    checkWhisperPermission();
  }, [backendHost]);

  const handleSendWhisper = async (e) => {
    e.preventDefault();
    if (!selectedCall || !whisperText.trim()) return;
    setSendingWhisper(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/calls/${selectedCall.id}/whisper`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: whisperText })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Fısıltı AI'a başarıyla iletildi.");
        setWhisperText("");
      } else {
        setErrorMsg(data.detail || "Fısıltı gönderilemedi.");
      }
    } catch (err) {
      setErrorMsg("Bağlantı hatası oluştu.");
    } finally {
      setSendingWhisper(false);
    }
  };

  // Connect to live transcript stream when selectedCall changes
  useEffect(() => {
    if (!selectedCall) {
      setTranscripts([]);
      return;
    }

    setTranscripts([]);
    setWsStatus("connecting");

    // Fetch initial transcripts
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    fetch(`${protocol}//${backendHost}/api/calls/${selectedCall.id}/transcripts`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTranscripts(data);
        }
      })
      .catch((err) => console.error("Gecmis transkriptler alinamadi:", err));

    // Connect WebSocket
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${backendHost}/ws/transcripts/${selectedCall.id}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("connected");
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "transcript") {
          setTranscripts((prev) => [
            ...prev,
            {
              speaker: message.speaker,
              text: message.text,
              timestamp: new Date().toISOString()
            }
          ]);
        }
      } catch (err) {
        console.error("WS transcript error:", err);
      }
    };

    ws.onclose = () => {
      setWsStatus("disconnected");
    };

    return () => {
      ws.close();
    };
  }, [selectedCall, backendHost]);

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  // Sync selectedCall agent notes and topic
  useEffect(() => {
    if (selectedCall) {
      setAgentTopic(selectedCall.agent_topic || "");
      setAgentNotes(selectedCall.agent_notes || "");
    } else {
      setAgentTopic("");
      setAgentNotes("");
    }
  }, [selectedCall]);

  const handleSaveNotes = async (e) => {
    e.preventDefault();
    if (!selectedCall) return;
    if (!agentTopic) {
      setErrorMsg("Lütfen önce bir konu seçin.");
      return;
    }
    setSavingNotes(true);
    setNotesSuccess(false);
    setErrorMsg("");
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/calls/${selectedCall.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: agentTopic, notes: agentNotes })
      });
      if (res.ok) {
        setNotesSuccess(true);
        setTimeout(() => setNotesSuccess(false), 3000);
      } else {
        setErrorMsg("Not kaydedilirken bir hata oluştu.");
      }
    } catch (err) {
      setErrorMsg("Ağ hatası oluştu.");
    } finally {
      setSavingNotes(false);
    }
  };

  // Call Sentiment analysis based on transcripts keywords
  const getCallSentiment = (transcriptList) => {
    let score = 0;
    const positiveWords = ["teşekkür", "harika", "iyi", "evet", "tamam", "sağol", "memnun", "güzel"];
    const negativeWords = ["hata", "şikayet", "kötü", "bekliyorum", "hayır", "iptal", "yanlış", "yok"];

    transcriptList.forEach((t) => {
      const text = t.text.toLowerCase();
      positiveWords.forEach(w => { if (text.includes(w)) score += 1; });
      negativeWords.forEach(w => { if (text.includes(w)) score -= 1; });
    });

    if (score > 0) return { type: "Pozitif", color: "text-emerald-400", bg: "bg-primary/10 border-emerald-500/30", icon: <Smile size={16} /> };
    if (score < 0) return { type: "Negatif / Kızgın", color: "text-rose-400", bg: "bg-primary/10 border-rose-500/30", icon: <Frown size={16} /> };
    return { type: "Nötr", color: "text-slate-400", bg: "bg-slate-800 border-slate-700", icon: <Meh size={16} /> };
  };

  const sentiment = getCallSentiment(transcripts);

  // Trigger ChanSpy to listen to this call via supervisor extension 200
  const handleChanSpy = async () => {
    if (!selectedCall) return;
    setLoadingSpy(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/calls/${selectedCall.id}/spy?agent_ext=200`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Canlı dinleme (ChanSpy) başlatıldı! Temsilci WebRTC telefonunuz çalacaktır, lütfen çağrıyı cevaplayın.");
      } else {
        setErrorMsg(data.detail || "Canlı dinleme başlatılamadı.");
      }
    } catch (err) {
      setErrorMsg("Bağlantı hatası oluştu.");
    } finally {
      setLoadingSpy(false);
    }
  };

  // Redirect/transfer call to representative
  const handleTransfer = async () => {
    if (!selectedCall) return;
    setLoadingTransfer(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/calls/${selectedCall.id}/transfer`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Çağrı başarıyla temsilci kuyruğuna (temsilci_kuyrugu) yönlendirildi.");
        setSelectedCall(null);
        setTranscripts([]);
      } else {
        setErrorMsg(data.detail || "Çağrı aktarılamadı.");
      }
    } catch (err) {
      setErrorMsg("Bağlantı hatası oluştu.");
    } finally {
      setLoadingTransfer(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      
      {/* Real-time System Metrics Header Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Active Calls Stat */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl flex items-center justify-between shadow-sm transition-colors duration-300">
          <div>
            <p className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Aktif Görüşmeler</p>
            <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white flex items-center gap-2">
              {activeCalls.length}
              {activeCalls.length > 0 && (
                <span className="h-2 w-2 rounded-full bg-primary dark:bg-emerald-400 animate-ping"></span>
              )}
            </h3>
          </div>
          <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 flex items-center justify-center text-primary dark:text-purple-400">
            <Activity size={20} className={activeCalls.length > 0 ? "animate-pulse" : ""} />
          </div>
        </div>

        {/* Live CPU Meter */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Yapay Zeka CPU Yükü</span>
            <Cpu size={14} className="text-primary dark:text-indigo-400" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-105 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200/40 dark:border-slate-850">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000"
                style={{ width: `${metrics.cpu}%` }}
              ></div>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{metrics.cpu}%</span>
          </div>
        </div>

        {/* Live RAM Meter */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Bellek (RAM)</span>
            <Layers size={14} className="text-pink-500 dark:text-pink-400" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-105 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200/40 dark:border-slate-850">
              <div 
                className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-1000"
                style={{ width: `${metrics.ram}%` }}
              ></div>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{metrics.ram}%</span>
          </div>
        </div>

        {/* Active Websockets */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl flex items-center justify-between shadow-sm transition-colors duration-300">
          <div>
            <p className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">WebSocket Kanalları</p>
            <h3 className="text-xl font-bold mt-1 text-slate-900 dark:text-slate-200 font-mono">
              {metrics.activeWs} <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">bağlantı</span>
            </h3>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-center text-primary dark:text-emerald-400">
            <Wifi size={18} />
          </div>
        </div>

      </div>

      {/* Main Panel Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Active Calls List */}
        <div className="lg:col-span-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl p-4 shadow-sm min-h-[500px] transition-colors duration-300">
          <div className="border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-4">
            <h3 className="font-bold text-xs text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-2 uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping"></span>
              Aktif Arama Listesi
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-1.5">Gerçek zamanlı olarak Asterisk kanallarından çekilmektedir.</p>
          </div>

          {activeCalls.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-555">
              <ShieldAlert size={36} className="text-slate-300 dark:text-slate-700 mb-2 animate-bounce" />
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Aktif Görüşme Bulunmuyor</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-650 mt-1">Telefon hattı boşta. Arama yapıldığında listelenecektir.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2.5">
              {activeCalls.map((call) => (
                <button
                  key={call.id}
                  onClick={() => setSelectedCall(call)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex flex-col gap-2 ${
                    selectedCall?.id === call.id
                      ? "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/40 shadow-sm"
                      : "bg-slate-50/50 dark:bg-slate-950/40 border-slate-200/50 dark:border-slate-850/65 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100/50 dark:hover:bg-slate-955"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {call.caller_name ? `${call.caller_name} (${call.caller_number})` : call.caller_number}
                    </span>
                    <span className="text-[9px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-755 dark:text-purple-400 px-2 py-0.5 rounded border border-purple-200/50 dark:border-purple-900/50">
                      Yapay Zeka
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
                    <span>DID: {call.callee_number}</span>
                    <span>Kanal: {call.channel ? call.channel.split("/")[0] : "AudioSocket"}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Selected Call Real-time Console */}
        <div className="lg:col-span-2 flex flex-col bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm min-h-[500px] overflow-hidden transition-colors duration-300">
          
          {!selectedCall ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 dark:text-slate-500 text-center">
              <Bot size={48} className="text-slate-200 dark:text-slate-800 mb-3 animate-pulse" />
              <p className="text-xs font-bold text-slate-550 dark:text-slate-400">Canlı Arama Konsolu</p>
              <p className="text-[10px] text-slate-450 dark:text-slate-600 mt-1">İzlemek istediğiniz aktif bir aramayı soldaki listeden seçin.</p>
            </div>
          ) : (
            <>
              {/* Console Header */}
              <div className="p-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-primary/15 border border-purple-100 dark:border-purple-800/35 flex items-center justify-center text-primary dark:text-purple-400">
                    <Bot size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2 flex-wrap">
                      <span>Çağrı: {selectedCall.caller_name ? `${selectedCall.caller_name} (${selectedCall.caller_number})` : selectedCall.caller_number}</span>
                      {!selectedCall.caller_name && (
                        <button
                          type="button"
                          onClick={() => setShowAddContactModal(true)}
                          className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/35 text-primary dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40 rounded text-[9px] font-extrabold transition shrink-0"
                        >
                          Rehbere Kaydet
                        </button>
                      )}
                    </h4>
                    <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-xs">{selectedCall.id}</p>
                  </div>
                </div>

                {/* Call Sentiment pill */}
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold ${sentiment.bg} ${sentiment.color}`}>
                  {sentiment.icon}
                  <span>Müşteri Hali: {sentiment.type}</span>
                </div>
              </div>

              {/* Status Alert Messages */}
              {successMsg && (
                <div className="mx-4 mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                  <Activity size={14} className="shrink-0" />
                  <span className="font-semibold">{successMsg}</span>
                </div>
              )}
              {errorMsg && (
                <div className="mx-4 mt-3 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center gap-2 text-xs text-rose-700 dark:text-rose-400">
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="font-semibold">{errorMsg}</span>
                </div>
              )}

              {/* Console Action Bar */}
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/20 dark:bg-slate-950/20 flex flex-wrap gap-2.5">
                <button
                  onClick={handleChanSpy}
                  disabled={loadingSpy}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-[11px] font-bold shadow-md shadow-purple-500/10 transition duration-150"
                >
                  <Volume2 size={13} className="animate-bounce" />
                  <span>{loadingSpy ? "Başlatılıyor..." : "Canlı Dinle (WebRTC)"}</span>
                </button>

                <button
                  onClick={handleTransfer}
                  disabled={loadingTransfer}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[11px] font-bold shadow-sm transition duration-150"
                >
                  <PhoneForwarded size={13} />
                  <span>{loadingTransfer ? "Aktarılıyor..." : "Temsilciye Yönlendir"}</span>
                </button>
              </div>

              {/* Live Waveform visualizer (Pulsing micro-animation) */}
              <div className="px-5 py-3 border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-50/10 dark:bg-slate-950/10 flex items-center gap-4">
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Ses Genliği (Anlık):</span>
                <div className="flex items-center gap-[3px] h-6">
                  <span className="w-[3px] bg-primary rounded-full animate-[pulse_0.8s_infinite] h-2"></span>
                  <span className="w-[3px] bg-primary rounded-full animate-[pulse_0.5s_infinite] h-4"></span>
                  <span className="w-[3px] bg-purple-400 rounded-full animate-[pulse_0.7s_infinite] h-5"></span>
                  <span className="w-[3px] bg-primary rounded-full animate-[pulse_0.6s_infinite] h-3"></span>
                  <span className="w-[3px] bg-indigo-400 rounded-full animate-[pulse_0.4s_infinite] h-5"></span>
                  <span className="w-[3px] bg-primary rounded-full animate-[pulse_0.9s_infinite] h-2"></span>
                </div>
              </div>

              {/* Real-time Streaming Transcript Area */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/10 dark:bg-slate-950/10 max-h-[350px]">
                {transcripts.length === 0 ? (
                  <div className="text-center py-20 text-xs text-slate-400 dark:text-slate-500 font-medium">
                    {wsStatus === "connecting" ? "Bağlanıyor..." : "Konuşma bekleniyor..."}
                  </div>
                ) : (
                  transcripts.map((t, idx) => {
                    const isAI = t.speaker && (t.speaker.toLowerCase() === "ai" || t.speaker.toLowerCase() === "agent");
                    const isWhisper = t.speaker && t.speaker.toLowerCase() === "supervisor_whisper";
                    
                    if (isWhisper) {
                      return (
                        <div key={idx} className="flex flex-col items-center mx-auto max-w-[90%] my-2">
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-amber-500/20 text-primary dark:text-amber-400 rounded-full text-[9px] font-bold uppercase tracking-wider">
                            <Bot size={10} />
                            <span>SÜPERVİZÖR FISILTISI</span>
                          </div>
                          <div className="mt-1 px-4 py-2 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 text-amber-850 dark:text-amber-300/90 rounded-2xl text-[11px] leading-relaxed shadow-sm text-center italic font-semibold">
                            "{t.text}"
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        className={`flex gap-3 max-w-[85%] ${
                          isAI ? "mr-auto" : "ml-auto flex-row-reverse"
                        }`}
                      >
                        <div
                          className={`h-7 w-7 rounded-xl flex items-center justify-center shrink-0 border ${
                            isAI
                              ? "bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-800/40 text-primary dark:text-purple-400"
                              : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-350"
                          }`}
                        >
                          {isAI ? <Bot size={13} /> : <User size={13} />}
                        </div>
                        <div
                          className={`p-3 rounded-2xl text-[11px] leading-relaxed shadow-sm border ${
                            isAI
                              ? "bg-purple-50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/30 text-purple-750 dark:text-purple-350/90 rounded-tl-none"
                              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tr-none"
                          }`}
                        >
                          {t.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* AI Whisperer Input Box */}
              {hasWhisperPermission && (
                <form onSubmit={handleSendWhisper} className="px-4 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-primary/[0.02] dark:bg-primary/[0.01] flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 bg-primary rounded-full animate-ping"></span>
                    <span className="text-[10px] text-primary dark:text-amber-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
                      AI'a Fısılda (Canlı Prompt Müdahalesi)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Yapay zekanın bir sonraki cevabı için anlık yönlendirme yazın..."
                      value={whisperText}
                      onChange={(e) => setWhisperText(e.target.value)}
                      disabled={sendingWhisper}
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-xl text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500 font-semibold shadow-sm transition"
                    />
                    <button
                      type="submit"
                      disabled={sendingWhisper || !whisperText.trim()}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-450 hover:to-orange-450 text-white rounded-xl text-[11px] font-extrabold shadow-md shadow-amber-500/10 transition shrink-0 flex items-center gap-1 disabled:opacity-50"
                    >
                      <span>{sendingWhisper ? "İletiliyor..." : "Fısılda"}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Agent Call Notes Form */}
              <form onSubmit={handleSaveNotes} className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Temsilci Çağrı Notu</span>
                  {notesSuccess && (
                    <span className="text-[9px] text-primary dark:text-emerald-450 font-bold flex items-center gap-1">
                      <CheckCircle size={10} /> Not Kaydedildi
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <select
                      value={agentTopic}
                      onChange={(e) => setAgentTopic(e.target.value)}
                      required
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-xl text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-semibold"
                    >
                      <option value="">Konu Seçin...</option>
                      <option value="Destek">Destek / Teknik</option>
                      <option value="Satış">Satış / Sipariş</option>
                      <option value="Ödeme">Ödeme / Fatura</option>
                      <option value="Şikayet">Şikayet / İptal</option>
                      <option value="Bilgi">Bilgi Talebi</option>
                      <option value="Diğer">Diğer</option>
                    </select>
                  </div>
                  <div className="col-span-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="Çağrı ile ilgili notlarınızı yazın..."
                      value={agentNotes}
                      onChange={(e) => setAgentNotes(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-xl text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-semibold"
                    />
                    <button
                      type="submit"
                      disabled={savingNotes}
                      className="px-3.5 py-1.5 bg-primary hover:bg-primary text-white rounded-xl text-[11px] font-bold shadow-md shadow-purple-500/10 transition shrink-0"
                    >
                      {savingNotes ? "..." : "Kaydet"}
                    </button>
                  </div>
                </div>
              </form>
            </>
          )}

        </div>

      </div>

      <AddContactModal
        isOpen={showAddContactModal}
        onClose={() => setShowAddContactModal(false)}
        initialPhone={selectedCall?.caller_number || ""}
        backendHost={backendHost}
        onSaveSuccess={() => {
          // Instantly set caller_name locally for better responsiveness
          if (selectedCall) {
            setSelectedCall(prev => ({ ...prev, caller_name: "Yeni Rehber Kaydı" }));
          }
        }}
      />

    </div>
  );
}
