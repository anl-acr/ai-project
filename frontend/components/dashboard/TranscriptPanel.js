import React, { useState, useEffect, useRef } from "react";
import { Bot, MessageSquare, User, Save, History, FileText, Calendar, Check, AlertCircle, Phone, Play, Square, ArrowRight, Radio, PhoneOff } from "lucide-react";

export default function TranscriptPanel({ callId, backendHost = "localhost:8000" }) {
  // Demo Mode override
  const [isDemoCall, setIsDemoCall] = useState(false);
  const activeCallId = isDemoCall ? "demo-call-99" : callId;

  const [transcripts, setTranscripts] = useState([]);
  const [wsStatus, setWsStatus] = useState("disconnected"); // disconnected, connecting, connected
  const chatEndRef = useRef(null);

  // CRM & History State
  const [callDetails, setCallDetails] = useState(null);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [noteTopic, setNoteTopic] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [saveStatus, setSaveStatus] = useState(""); // "", "saving", "success", "error"
  const [expandedCallId, setExpandedCallId] = useState(null);

  // Call control states
  const [isHold, setIsHold] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [conferenceOpen, setConferenceOpen] = useState(false);
  const [conferenceTarget, setConferenceTarget] = useState("");

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  // Load initial transcripts or subscribe to WebSocket updates when activeCallId changes
  useEffect(() => {
    setIsHold(false);
    setTransferOpen(false);
    setConferenceOpen(false);
    setTransferTarget("");
    setConferenceTarget("");

    if (!activeCallId) {
      setTranscripts([]);
      setCallDetails(null);
      setCustomerHistory([]);
      setNoteTopic("");
      setNoteContent("");
      return;
    }

    // Skip network queries if we are inside a local demo call
    if (activeCallId === "demo-call-99") {
      return;
    }

    setTranscripts([]);
    setWsStatus("connecting");

    // 1. Fetch Call Details (contains caller number, start time, notes)
    fetch(`${API_BASE}/api/calls/${activeCallId}`)
      .then((res) => res.json())
      .then((data) => {
        setCallDetails(data);
        setNoteTopic(data.agent_topic || "");
        setNoteContent(data.agent_notes || "");

        // 2. Fetch past calls list to show caller history
        if (data.caller_number) {
          fetch(`${API_BASE}/api/calls`)
            .then((r) => r.json())
            .then((allCalls) => {
              if (Array.isArray(allCalls)) {
                // Filter history: same caller number, exclude the active call ID
                const history = allCalls.filter(
                  (c) => c.caller_number === data.caller_number && c.id !== activeCallId
                );
                setCustomerHistory(history);
              }
            })
            .catch((err) => console.error("[Transcript] Arama geçmişi alınamadı:", err));
        }
      })
      .catch((err) => console.error("[Transcript] Çağrı ayrıntıları alınamadı:", err));

    // 3. Fetch existing live transcripts
    fetch(`${API_BASE}/api/calls/${activeCallId}/transcripts`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTranscripts(data);
        }
      })
      .catch((err) => console.error("[Transcript] Eski transkriptler alınamadı:", err));

    // 4. Connect to FastAPI live WebSocket stream
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${backendHost}/ws/transcripts/${activeCallId}`;
    console.log(`[Transcript] WebSocket bağlantısı kuruluyor: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsStatus("connected");
      console.log("[Transcript] Canlı transkript akışı bağlandı.");
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
        console.error("[Transcript] WebSocket mesaj ayrıştırma hatası:", err);
      }
    };

    ws.onclose = () => {
      setWsStatus("disconnected");
      console.log("[Transcript] Canlı transkript akışı kapandı.");
    };

    return () => {
      ws.close();
    };
  }, [activeCallId, backendHost]);

  // Auto scroll to latest speech turn
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  const handleSaveNotes = async () => {
    if (!activeCallId) return;
    setSaveStatus("saving");

    // Local simulation for demo call notes
    if (activeCallId === "demo-call-99") {
      setTimeout(() => {
        setSaveStatus("success");
        setCallDetails(prev => prev ? { ...prev, agent_topic: noteTopic, agent_notes: noteContent } : null);
        setTimeout(() => setSaveStatus(""), 3000);
      }, 700);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/calls/${activeCallId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          topic: noteTopic,
          notes: noteContent
        })
      });
      if (res.ok) {
        setSaveStatus("success");
        // Update local call details state
        setCallDetails(prev => prev ? { ...prev, agent_topic: noteTopic, agent_notes: noteContent } : null);
        setTimeout(() => setSaveStatus(""), 3000);
      } else {
        setSaveStatus("error");
      }
    } catch (err) {
      console.error("[Transcript] Not kaydetme hatası:", err);
      setSaveStatus("error");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleString("tr-TR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const startDemoCall = () => {
    setIsDemoCall(true);
    setCallDetails({
      id: "demo-call-99",
      caller_number: "+90 532 123 45 67",
      start_time: new Date().toISOString(),
      agent_topic: "",
      agent_notes: ""
    });
    setCustomerHistory([
      {
        id: "demo-past-1",
        caller_number: "+90 532 123 45 67",
        start_time: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
        status: "completed",
        agent_topic: "İnternet Sinyal Kopması",
        agent_notes: "Müşteri modemin internet ışığının yanmadığını söyledi. Hat sinyali kontrol edildi, modem kapatılıp açtırıldı, bağlantı sağlandı.",
        summary: "Müşterinin internet sinyal kopma problemi modem yeniden başlatılarak giderildi."
      },
      {
        id: "demo-past-2",
        caller_number: "+90 532 123 45 67",
        start_time: new Date(Date.now() - 3600000 * 24).toISOString(), // yesterday
        status: "completed",
        agent_topic: "Tarife Fiyat Bilgisi",
        agent_notes: "Yeni sınırsız fiber paketler hakkında detaylı fiyat teklifi iletildi. Müşteri tarife yükseltmeyi düşünüyor.",
        summary: "Fiber tarife geçiş teklifi paylaşıldı."
      }
    ]);
    setTranscripts([
      { speaker: "customer", text: "İyi günler, Anıl Bey ile mi görüşüyorum?", timestamp: new Date(Date.now() - 15000).toISOString() },
      { speaker: "human", text: "Evet buyurun, Anıl Acar ben. Müşteri temsilcinizim, nasıl yardımcı olabilirim?", timestamp: new Date(Date.now() - 8000).toISOString() },
      { speaker: "customer", text: "Faturam bu ay normalin çok üstünde gelmiş, nedenini inceleyebilir misiniz?", timestamp: new Date().toISOString() }
    ]);
    setWsStatus("connected");
  };

  const exitDemoCall = () => {
    setIsDemoCall(false);
    setCallDetails(null);
    setCustomerHistory([]);
    setTranscripts([]);
    setWsStatus("disconnected");
  };

  if (!activeCallId) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 dark:text-slate-500 min-h-[420px] w-full shadow-sm transition-colors duration-300">
        <MessageSquare size={48} className="text-slate-350 dark:text-slate-700 mb-3 animate-pulse" />
        <p className="font-extrabold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wider">Aktif Görüşme Bulunmuyor</p>
        <p className="text-xs text-slate-455 dark:text-slate-500 mt-1.5 text-center max-w-sm leading-relaxed">
          Yapay zeka veya temsilci görüşmeye başladığında canlı transkript, not alma alanı ve müşteri geçmişi burada listelenecektir.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-800 dark:text-white shadow-sm w-full h-[620px] overflow-hidden transition-colors duration-300 animate-in fade-in duration-300">
      
      {/* Panel Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-950/50">
        <div className="flex items-center gap-2">
          <MessageSquare className="text-primary dark:text-emerald-400 animate-pulse" size={18} />
          <div>
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-350">Müşteri Çağrı Konsolu</h3>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">Çağrı ID: {activeCallId}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {isDemoCall && (
            <button
              onClick={exitDemoCall}
              className="px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-400 text-[8px] font-extrabold uppercase tracking-wide hover:bg-rose-100 transition-all shrink-0"
            >
              Simülasyonu Kapat
            </button>
          )}
          <div className="flex items-center gap-2 font-semibold">
            {wsStatus === "connected" && (
              <span className="flex items-center gap-1.5 text-[10px] text-primary dark:text-emerald-400 uppercase tracking-wide">
                <span className="h-1.5 w-1.5 rounded-full bg-primary dark:bg-emerald-450 animate-ping"></span>
                Canlı Bağlantı
              </span>
            )}
            {wsStatus === "connecting" && (
              <span className="text-[10px] text-primary dark:text-amber-455 animate-pulse uppercase tracking-wide">Bağlanıyor...</span>
            )}
            {wsStatus === "disconnected" && (
              <span className="text-[10px] text-slate-400 dark:text-slate-550 uppercase tracking-wide">Bağlantı Yok</span>
            )}
          </div>
        </div>
      </div>

      {/* Call Controls Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest">Çağrı Kontrolleri:</span>
          {isHold && (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-250/30 dark:border-amber-900/30 text-primary dark:text-amber-400 text-[8px] font-extrabold uppercase animate-pulse">
              Beklemede (Hold)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Hold/Resume Button */}
          <button
            onClick={() => {
              const nextHold = !isHold;
              setIsHold(nextHold);
              window.dispatchEvent(new CustomEvent("softphone-action", { detail: { type: "hold", active: nextHold } }));
            }}
            className={`px-3 py-1.5 rounded-xl border text-[10px] font-extrabold uppercase tracking-wide transition-all flex items-center gap-1.5 focus:outline-none ${
              isHold 
                ? "bg-primary border-amber-600 text-white shadow-sm" 
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm"
            }`}
          >
            {isHold ? <Play size={11} className="fill-white" /> : <Square size={11} />}
            <span>{isHold ? "Görüşmeye Devam Et" : "Beklemeye Al"}</span>
          </button>

          {/* Transfer Button */}
          <div className="relative">
            <button
              onClick={() => {
                setTransferOpen(!transferOpen);
                setConferenceOpen(false);
              }}
              className={`px-3 py-1.5 rounded-xl border text-[10px] font-extrabold uppercase tracking-wide transition-all flex items-center gap-1.5 focus:outline-none ${
                transferOpen
                  ? "bg-violet-50 dark:bg-violet-950/30 border-violet-300 dark:border-violet-850 text-violet-600 dark:text-violet-400"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm"
              }`}
            >
              <ArrowRight size={11} className={transferOpen ? "text-violet-500" : "text-slate-400"} />
              <span>Çağrı Aktar</span>
            </button>

            {transferOpen && (
              <div className="absolute right-0 mt-2 w-64 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-30 space-y-2.5 animate-in fade-in duration-100">
                <span className="text-[8px] font-extrabold text-slate-400 dark:text-slate-550 uppercase tracking-widest block">Hedef Dahili Numara</span>
                <input
                  type="text"
                  placeholder="Örn: 201, 202"
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 text-xs font-semibold focus:outline-none text-slate-800 dark:text-white"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if(!transferTarget) return;
                      window.dispatchEvent(new CustomEvent("softphone-action", {
                        detail: { type: "transfer", target: transferTarget, mode: "blind" }
                      }));
                      setTransferOpen(false);
                      setTransferTarget("");
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 text-[8px] font-black uppercase tracking-wider hover:opacity-90"
                  >
                    Kontrolsüz
                  </button>
                  <button
                    onClick={() => {
                      if(!transferTarget) return;
                      window.dispatchEvent(new CustomEvent("softphone-action", {
                        detail: { type: "transfer", target: transferTarget, mode: "attended" }
                      }));
                      setTransferOpen(false);
                      setTransferTarget("");
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[8px] font-black uppercase tracking-wider"
                  >
                    Kontrollü
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Conference Button */}
          <div className="relative">
            <button
              onClick={() => {
                setConferenceOpen(!conferenceOpen);
                setTransferOpen(false);
              }}
              className={`px-3 py-1.5 rounded-xl border text-[10px] font-extrabold uppercase tracking-wide transition-all flex items-center gap-1.5 focus:outline-none ${
                conferenceOpen
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-850 text-primary dark:text-emerald-400"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm"
              }`}
            >
              <Radio size={11} className={conferenceOpen ? "text-primary animate-pulse" : "text-slate-400"} />
              <span>Konferans</span>
            </button>

            {conferenceOpen && (
              <div className="absolute right-0 mt-2 w-64 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-30 space-y-2.5 animate-in fade-in duration-100">
                <span className="text-[8px] font-extrabold text-slate-400 dark:text-slate-550 uppercase tracking-widest block">Katılımcı Dahili No</span>
                <input
                  type="text"
                  placeholder="Örn: 202, 301"
                  value={conferenceTarget}
                  onChange={(e) => setConferenceTarget(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 text-xs font-semibold focus:outline-none text-slate-800 dark:text-white"
                />
                <button
                  onClick={() => {
                    if(!conferenceTarget) return;
                    window.dispatchEvent(new CustomEvent("softphone-action", {
                      detail: { type: "conference", target: conferenceTarget }
                    }));
                    setConferenceOpen(false);
                    setConferenceTarget("");
                  }}
                  className="w-full py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[8px] font-black uppercase tracking-wider"
                >
                  Konferansa Ekle (3-Way)
                </button>
              </div>
            )}
          </div>

          {/* Hangup Button */}
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent("softphone-action", { detail: { type: "hangup" } }));
            }}
            className="px-3 py-1.5 rounded-xl bg-primary hover:bg-rose-700 text-white text-[10px] font-extrabold uppercase tracking-wide transition-all flex items-center gap-1.5 focus:outline-none shadow-sm shadow-rose-500/10"
          >
            <PhoneOff size={11} />
            <span>Kapat</span>
          </button>
        </div>
      </div>

      {/* Main Content: Split layout (Left: Transcript, Right: CRM Side Panel) */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden h-full">
        
        {/* Left Column: Live Chat Transcript (60%) */}
        <div className="flex-1 flex flex-col p-4 border-r border-slate-100 dark:border-slate-800/60 h-full overflow-y-auto">
          
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-2 mb-3">
            <MessageSquare size={13} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Canlı Görüşme Metin Akışı</span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {transcripts.length === 0 && wsStatus === "connected" && (
              <div className="text-center py-20 text-slate-400 dark:text-slate-550 text-xs italic font-medium">
                Yapay zeka ses bekleniyor... Konuşma başladığında metin akışı burada görünecektir.
              </div>
            )}
            
            {transcripts.map((turn, index) => {
              const isAI = turn.speaker === "ai";
              const isCustomer = turn.speaker === "customer";
              const isHuman = turn.speaker === "human";
              const isWhisper = turn.speaker === "supervisor_whisper";

              if (isWhisper) {
                return (
                  <div key={index} className="flex flex-col items-center mx-auto max-w-[90%] my-3">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-amber-500/20 text-primary dark:text-amber-400 rounded-full text-[9px] font-bold uppercase tracking-wider shadow-sm">
                      <Radio size={10} className="animate-pulse" />
                      <span>SÜPERVİZÖR FISILTISI</span>
                    </div>
                    <div className="mt-1.5 px-4 py-2.5 bg-amber-50/40 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/20 text-amber-850 dark:text-amber-300 rounded-2xl text-[11px] leading-relaxed shadow-sm text-center italic font-semibold">
                      "{turn.text}"
                    </div>
                    <span className="text-[8px] text-slate-400 dark:text-slate-500 mt-1 font-semibold">
                      {turn.timestamp ? new Date(turn.timestamp).toLocaleTimeString("tr-TR") : ""}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={index}
                  className={`flex gap-2.5 max-w-[88%] ${
                    isCustomer ? "mr-auto flex-row" : "ml-auto flex-row-reverse"
                  }`}
                >
                  <div
                    className={`h-7.5 w-7.5 rounded-lg flex items-center justify-center shrink-0 border shadow-inner ${
                      isAI
                        ? "bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-800 text-primary dark:text-purple-400"
                        : isHuman
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800 text-primary dark:text-emerald-400"
                        : "bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-800 text-primary dark:text-blue-400"
                    }`}
                  >
                    {isAI ? <Bot size={13} /> : <User size={13} />}
                  </div>

                  <div className="flex flex-col">
                    <div
                      className={`px-3 py-2.5 rounded-2xl text-[11px] leading-relaxed border shadow-sm ${
                        isCustomer
                          ? "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-850 dark:text-slate-100 rounded-tl-none"
                          : isHuman
                          ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-350 rounded-tr-none"
                          : "bg-purple-50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/30 text-purple-850 dark:text-purple-350 rounded-tr-none"
                      }`}
                    >
                      <p className="font-extrabold text-[8px] mb-0.5 opacity-60 tracking-wider">
                        {isAI ? "YAPAY ZEKA" : isHuman ? "TEMSİLCİ" : "MÜŞTERİ"}
                      </p>
                      <p className="whitespace-pre-line font-medium leading-relaxed">{turn.text}</p>
                    </div>
                    <span className="text-[8px] text-slate-400 dark:text-slate-500 mt-1 px-1 self-end font-semibold">
                      {turn.timestamp ? new Date(turn.timestamp).toLocaleTimeString("tr-TR") : ""}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Right Column: Customer Card, Notes & Call History (40%) */}
        <div className="w-full lg:w-[320px] p-4 bg-slate-50/40 dark:bg-slate-950/20 h-full overflow-y-auto space-y-5 shrink-0 flex flex-col justify-start">
          
          {/* Section 1: Customer Call Details */}
          <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center gap-1.5 text-[9px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest pb-1 border-b border-slate-100 dark:border-slate-800/60">
              <User size={12} className="text-slate-400" />
              <span>Arayan Müşteri Kartı</span>
            </div>
            {callDetails ? (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 font-bold">TELEFON:</span>
                  <span className="text-[11px] font-extrabold text-slate-800 dark:text-white font-mono">
                    {callDetails.caller_number}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 font-bold">BAŞLANGIÇ:</span>
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                    {formatDate(callDetails.start_time)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-[10px] italic text-slate-450">Çağrı detayları alınıyor...</div>
            )}
          </div>

          {/* Section 2: Agent Call Notes Form */}
          <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800/60">
              <div className="flex items-center gap-1.5 text-[9px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest">
                <FileText size={12} className="text-slate-400" />
                <span>Görüşme Notu Kaydet</span>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[8px] font-extrabold text-slate-455 dark:text-slate-550 uppercase tracking-wider block mb-1">Görüşme Konusu</label>
                <input
                  type="text"
                  value={noteTopic}
                  onChange={(e) => setNoteTopic(e.target.value)}
                  placeholder="örn: İade Talebi, Fatura İtirazı"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 text-xs font-semibold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-[8px] font-extrabold text-slate-455 dark:text-slate-550 uppercase tracking-wider block mb-1">Çağrı Notları</label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Görüşme detaylarını buraya not alın..."
                  rows={3}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 text-xs font-medium text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <button
                onClick={handleSaveNotes}
                disabled={saveStatus === "saving"}
                className={`w-full py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all duration-300 border ${
                  saveStatus === "success"
                    ? "bg-emerald-50 border-emerald-200 text-primary dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30"
                    : saveStatus === "error"
                    ? "bg-rose-50 border-rose-200 text-primary dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30"
                    : "bg-slate-900 border-slate-800 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:border-slate-200 dark:hover:bg-slate-200"
                }`}
              >
                {saveStatus === "saving" ? (
                  <span className="h-3 w-3 border-2 border-slate-400 border-t-white rounded-full animate-spin"></span>
                ) : saveStatus === "success" ? (
                  <>
                    <Check size={12} />
                    <span>Kaydedildi!</span>
                  </>
                ) : saveStatus === "error" ? (
                  <>
                    <AlertCircle size={12} />
                    <span>Hata Oluştu</span>
                  </>
                ) : (
                  <>
                    <Save size={12} />
                    <span>Notları Kaydet</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Section 3: Previous Call History */}
          <div className="flex-1 flex flex-col space-y-2 overflow-hidden min-h-[160px]">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800/60">
              <div className="flex items-center gap-1.5 text-[9px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest">
                <History size={12} className="text-slate-400" />
                <span>Geçmiş Çağrılar</span>
              </div>
              <span className="px-1.5 py-0.5 rounded-md bg-slate-150 dark:bg-slate-850 text-[8px] font-bold text-slate-500">
                {customerHistory.length} Kayıt
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
              {customerHistory.length === 0 ? (
                <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-[10px] italic">
                  Bu numaraya ait geçmiş görüşme kaydı bulunmuyor. (İlk Arama)
                </div>
              ) : (
                customerHistory.map((pastCall) => {
                  const isExpanded = expandedCallId === pastCall.id;

                  return (
                    <div
                      key={pastCall.id}
                      className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 shadow-sm hover:border-slate-350 dark:hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-slate-450">
                          <Calendar size={10} />
                          <span className="text-[9px] font-bold">{formatDate(pastCall.start_time)}</span>
                        </div>
                        <span className={`px-1 rounded text-[7px] font-extrabold uppercase ${
                          pastCall.status === "completed"
                            ? "bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-400"
                            : "bg-amber-50 dark:bg-amber-950/20 text-primary dark:text-amber-455"
                        }`}>
                          {pastCall.status === "completed" ? "Tamamlandı" : "Aktarıldı"}
                        </span>
                      </div>

                      {/* Topic info */}
                      <p className="text-[10px] font-extrabold text-slate-800 dark:text-white flex items-center gap-1">
                        <FileText size={10} className="text-slate-400 shrink-0" />
                        <span className="truncate">Konu: {pastCall.agent_topic || "Girilmedi"}</span>
                      </p>

                      {/* Accordion toggle to inspect notes */}
                      <button
                        onClick={() => setExpandedCallId(isExpanded ? null : pastCall.id)}
                        className="text-[8px] font-black text-violet-500 dark:text-violet-400 uppercase tracking-wider hover:underline focus:outline-none flex items-center gap-0.5"
                      >
                        {isExpanded ? "Detayları Gizle" : "Notları & Özeti Gör"}
                      </button>

                      {isExpanded && (
                        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/60 text-[9px] space-y-1.5 text-slate-600 dark:text-slate-400 animate-in fade-in duration-200">
                          {pastCall.summary && (
                            <div className="p-1.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-800 rounded">
                              <span className="font-extrabold text-[8px] text-slate-400 block uppercase">AI Özeti</span>
                              <p className="italic font-medium leading-normal mt-0.5">{pastCall.summary}</p>
                            </div>
                          )}
                          <div>
                            <span className="font-extrabold text-[8px] text-slate-450 block uppercase">Temsilci Notu</span>
                            <p className="font-semibold leading-normal mt-0.5 bg-slate-50/50 dark:bg-slate-950/20 p-1.5 border border-slate-150 rounded whitespace-pre-wrap">
                              {pastCall.agent_notes || "Bu çağrıda temsilci notu kaydedilmemiş."}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
