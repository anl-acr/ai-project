import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Bot, User, Shield, HelpCircle, RefreshCw, AlertCircle, FileText, X, Award, ChevronDown, ChevronUp, Megaphone, CheckCircle, Upload } from "lucide-react";
import AddContactModal from "./AddContactModal";

export default function OmnichannelPanel({ backendHost = "localhost:8000" }) {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState({ sessions: false, messages: false });
  const [actionLoading, setActionLoading] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [cannedResponses, setCannedResponses] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCannedPopover, setShowCannedPopover] = useState(false);
  const [showQAReport, setShowQAReport] = useState(false);

  // Broadcast Campaign Modal State
  const [broadcastTarget, setBroadcastTarget] = useState("all_contacts");
  const [broadcastNumbers, setBroadcastNumbers] = useState("");
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastMediaUrl, setBroadcastMediaUrl] = useState("");
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);

  // Simulator Form State
  const [simChannel, setSimChannel] = useState("whatsapp");
  const [simSender, setSimSender] = useState("+905554443322");
  const [simText, setSimText] = useState("");
  const [simLoading, setSimLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);

  const API_BASE = `${window.location.protocol}//${backendHost}`;
  const WS_BASE = window.location.protocol === "https:" ? `wss://${backendHost}` : `ws://${backendHost}`;

  useEffect(() => {
    const fetchCanned = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/canned-responses`);
        if (res.ok) {
          const data = await res.json();
          setCannedResponses(data);
        }
      } catch (err) {
        console.error("Error fetching canned responses:", err);
      }
    };
    fetchCanned();
  }, [backendHost]);

  // Fetch all chat sessions
  const fetchSessions = async (showSpinner = false) => {
    if (showSpinner) setLoading(prev => ({ ...prev, sessions: true }));
    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error("[Omnichannel] Error loading sessions:", err);
    } finally {
      if (showSpinner) setLoading(prev => ({ ...prev, sessions: false }));
    }
  };

  // Fetch messages for a specific session
  const fetchMessages = async (sessionId, showSpinner = false) => {
    if (!sessionId) return;
    if (showSpinner) setLoading(prev => ({ ...prev, messages: true }));
    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats/${sessionId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => {
          // Avoid unnecessary re-renders if length & last message match
          if (prev.length === data.length && prev.length > 0 && prev[prev.length - 1].id === data[data.length - 1].id) {
            return prev;
          }
          return data;
        });
      }
    } catch (err) {
      console.error("[Omnichannel] Error loading messages:", err);
    } finally {
      if (showSpinner) setLoading(prev => ({ ...prev, messages: false }));
    }
  };

  const activeSessionRef = useRef(activeSession);
  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  // Silent auto-refresh polling (every 3 seconds) + WebSocket hybrid sync
  useEffect(() => {
    fetchSessions(true);

    const interval = setInterval(() => {
      fetchSessions(false);
      if (activeSessionRef.current && activeSessionRef.current.id) {
        fetchMessages(activeSessionRef.current.id, false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [backendHost]);

  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout = null;

    const connectWebSocket = () => {
      const wsUrl = `${WS_BASE}/ws/omnichannel`;
      console.log(`[Omnichannel WS] Connecting to: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[Omnichannel WS] Connected successfully.");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("[Omnichannel WS] Event received:", data);

          if (data.type === "message") {
            const newMsg = data.message;
            
            // Append message if it belongs to currently active session
            if (activeSessionRef.current && String(activeSessionRef.current.id) === String(newMsg.session_id)) {
              setMessages(prev => {
                if (prev.some(m => String(m.id) === String(newMsg.id))) return prev;
                return [...prev, newMsg];
              });
            }

            // Also update session list preview dynamically
            setSessions(prev => {
              const idx = prev.findIndex(s => String(s.id) === String(newMsg.session_id));
              if (idx > -1) {
                const next = [...prev];
                next[idx] = {
                  ...next[idx],
                  last_message_text: newMsg.text,
                  last_message_time: newMsg.timestamp
                };
                return next.sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));
              }
              return prev;
            });

          } else if (data.type === "session_update") {
            const updatedSess = data.session;
            setSessions(prev => {
              const idx = prev.findIndex(s => String(s.id) === String(updatedSess.id));
              if (idx > -1) {
                const next = [...prev];
                next[idx] = { ...next[idx], ...updatedSess };
                return next.sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));
              } else {
                return [updatedSess, ...prev];
              }
            });
            
            // Update active session details dynamically
            if (activeSessionRef.current && String(activeSessionRef.current.id) === String(updatedSess.id)) {
              setActiveSession(prev => ({ ...prev, ...updatedSess }));
            }
          } else if (data.type === "takeover_changed") {
            const { session_id, assigned_agent } = data;
            setSessions(prev => 
              prev.map(s => String(s.id) === String(session_id) ? { ...s, assigned_agent } : s)
            );
            if (activeSessionRef.current && String(activeSessionRef.current.id) === String(session_id)) {
              setActiveSession(prev => ({ ...prev, assigned_agent }));
            }
          }
        } catch (err) {
          console.error("[Omnichannel WS] Error parsing message:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("[Omnichannel WS] Socket error:", err);
      };

      ws.onclose = () => {
        console.log("[Omnichannel WS] Connection closed.");
        if (isMounted) {
          reconnectTimeout = setTimeout(() => {
            console.log("[Omnichannel WS] Reconnecting...");
            connectWebSocket();
          }, 3000);
        }
      };
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, [backendHost]);

  // Scroll to bottom when message log updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectSession = (session) => {
    setActiveSession(session);
    fetchMessages(session.id, true);
  };

  // Send manual representative reply
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeSession) return;

    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats/${activeSession.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText })
      });
      if (res.ok) {
        setInputText("");
      }
    } catch (err) {
      console.error("[Omnichannel] Error sending message:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Human Takeover action
  const handleTakeover = async () => {
    if (!activeSession) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats/${activeSession.id}/takeover`, {
        method: "POST"
      });
      if (res.ok) {
        // Status will be updated via websocket event
      }
    } catch (err) {
      console.error("[Omnichannel] Takeover error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Return control back to AI
  const handleTransferToAI = async () => {
    if (!activeSession) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats/${activeSession.id}/transfer_to_ai`, {
        method: "POST"
      });
      if (res.ok) {
        // Status will be updated via websocket event
      }
    } catch (err) {
      console.error("[Omnichannel] Transfer to AI error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Trigger Mock simulation
  const handleSimulate = async (e) => {
    e.preventDefault();
    if (!simText.trim()) return;

    setSimLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: simChannel,
          sender_info: simSender,
          text: simText
        })
      });
      if (res.ok) {
        setSimText("");
        fetchSessions();
      }
    } catch (err) {
      console.error("[Omnichannel] Simulation error:", err);
    } finally {
      setSimLoading(false);
    }
  };

  // Handle Bulk WhatsApp Campaign Broadcast
  const handleStartBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;

    let recipientList = [];
    if (broadcastTarget === "all_contacts") {
      recipientList = ["all_contacts"];
    } else {
      recipientList = broadcastNumbers
        .split(/[\n,]+/)
        .map(n => n.trim())
        .filter(n => n.length >= 10);
    }

    if (recipientList.length === 0) {
      alert("Lütfen en az bir alıcı numarası girin.");
      return;
    }

    setBroadcastLoading(true);
    setBroadcastResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/whatsapp/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: recipientList,
          text: broadcastText,
          media_url: broadcastMediaUrl || null
        })
      });
      const data = await res.json();
      if (res.ok) {
        setBroadcastResult(data);
        fetchSessions(false);
      } else {
        alert(`Hata: ${data.detail || "Kampanya başlatılamadı"}`);
      }
    } catch (err) {
      console.error("[Broadcast Error]", err);
      alert("Kampanya mesajı gönderilirken bir sunucu hatası oluştu.");
    } finally {
      setBroadcastLoading(false);
    }
  };

  // CSV / TXT File Import Handler
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result || "";
        const lines = content.split(/[\r\n,;]+/);
        const extracted = [];
        for (let line of lines) {
          const digits = line.replace(/[^\d+]/g, "").trim();
          if (digits.length >= 10) {
            extracted.push(digits);
          }
        }
        const uniqueNumbers = Array.from(new Set(extracted));
        if (uniqueNumbers.length > 0) {
          setBroadcastNumbers(prev => {
            const existing = prev ? prev.split("\n").map(s => s.trim()).filter(Boolean) : [];
            const merged = Array.from(new Set([...existing, ...uniqueNumbers]));
            return merged.join("\n");
          });
          alert(`✅ ${uniqueNumbers.length} adet telefon numarası dosyadan başarıyla içe aktarıldı!`);
        } else {
          alert("⚠️ Seçilen dosyada geçerli telefon numarası bulunamadı.");
        }
      } catch (err) {
        console.error("Error reading file:", err);
        alert("Dosya okunurken bir hata oluştu.");
      }
    };
    reader.readAsText(file);
  };

  // Helper to render channel badges styled nicely
  const renderChannelBadge = (channel) => {
    switch (channel.toLowerCase()) {
      case "whatsapp":
        return <span className="px-2 py-0.5 text-[9px] bg-primary/10 text-primary border border-emerald-500/20 rounded-md font-bold uppercase tracking-wider">WhatsApp</span>;
      case "instagram":
        return <span className="px-2 py-0.5 text-[9px] bg-pink-500/10 text-pink-500 border border-pink-500/20 rounded-md font-bold uppercase tracking-wider">Instagram</span>;
      case "telegram":
        return <span className="px-2 py-0.5 text-[9px] bg-sky-500/10 text-sky-500 border border-sky-500/20 rounded-md font-bold uppercase tracking-wider">Telegram</span>;
      case "facebook":
        return <span className="px-2 py-0.5 text-[9px] bg-primary/10 text-primary border border-blue-600/20 rounded-md font-bold uppercase tracking-wider">Facebook</span>;
      case "mail":
        return <span className="px-2 py-0.5 text-[9px] bg-primary/10 text-primary border border-indigo-500/20 rounded-md font-bold uppercase tracking-wider">Mail</span>;
      default:
        return <span className="px-2 py-0.5 text-[9px] bg-slate-500/10 text-slate-500 border border-slate-500/20 rounded-md font-bold uppercase tracking-wider">{channel}</span>;
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-slate-200/85 dark:border-slate-800/80 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
            <MessageSquare size={22} className="text-primary" />
            Ortak Gelen Kutusu (Omnichannel)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            WhatsApp, Instagram, Telegram, Facebook ve Mail kanallarını tek bir sohbet ekranında yönetin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setBroadcastResult(null);
              setShowBroadcastModal(true);
            }}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
          >
            <Megaphone size={15} /> Toplu WhatsApp Gönder
          </button>
          <button
            onClick={() => fetchSessions(true)}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl transition duration-200 text-slate-500 dark:text-slate-400"
          >
            <RefreshCw size={15} className={loading.sessions ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

        {/* 1. Left Session List (25% width on large screens) */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm h-[600px] flex flex-col transition-colors duration-300">
          <div className="p-4 border-b border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/20">
            <h3 className="text-xs font-bold text-slate-850 dark:text-slate-200 uppercase tracking-wider">Aktif Sohbetler</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-850">
            {loading.sessions && sessions.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 font-bold animate-pulse">Sohbetler yükleniyor...</div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 dark:text-slate-550 font-bold">Aktif sohbet bulunmuyor.</div>
            ) : (
              sessions.map((session) => {
                const isActive = activeSession && activeSession.id === session.id;
                return (
                  <div
                    key={session.id}
                    onClick={() => selectSession(session)}
                    className={`p-4 cursor-pointer transition text-left flex flex-col gap-2.5 relative ${
                      isActive 
                        ? "bg-purple-50/40 dark:bg-purple-950/15 border-l-[3px] border-purple-500" 
                        : "hover:bg-slate-50 dark:hover:bg-slate-850/50 border-l-[3px] border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate max-w-[65%]">
                        {session.sender_name ? `${session.sender_name} (${session.sender_info})` : session.sender_info}
                      </span>
                      {renderChannelBadge(session.channel)}
                    </div>
                    
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-semibold">
                      {session.last_message_text || "Mesaj yok"}
                    </p>

                    <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-550 mt-0.5">
                      <div className="flex items-center gap-1.5">
                        <span>
                          {new Date(session.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {session.qa_score !== undefined && session.qa_score !== null && (
                          <span className="px-1 py-0.2 rounded text-[7px] font-extrabold bg-indigo-50 dark:bg-indigo-950/20 text-primary border border-indigo-100 dark:border-indigo-900/35">
                            QA: {session.qa_score}
                          </span>
                        )}
                      </div>
                      {session.assigned_agent === "ai" ? (
                        <span className="flex items-center gap-1 text-primary dark:text-purple-400 font-bold">
                          <Bot size={10} /> AI Yanıtlıyor
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-primary dark:text-primary font-bold">
                          <User size={10} /> Temsilcide
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 2. Middle Message Thread (50% width on large screens) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm h-[600px] flex flex-col transition-colors duration-300">
          {activeSession ? (
            <>
              {/* Active Header */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shrink-0"></div>
                  <div className="text-left">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white leading-none flex items-center gap-2 flex-wrap">
                      <span>{activeSession.sender_name ? `${activeSession.sender_name} (${activeSession.sender_info})` : activeSession.sender_info}</span>
                      {!activeSession.sender_name && (
                        <button
                          type="button"
                          onClick={() => setShowAddContactModal(true)}
                          className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/35 text-primary dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40 rounded text-[9px] font-extrabold transition shrink-0"
                        >
                          Rehbere Kaydet
                        </button>
                      )}
                    </h4>
                    <span className="text-[9px] text-slate-400 dark:text-slate-550 font-bold tracking-wide mt-1 block">
                      Kanal: {activeSession.channel.toUpperCase()}
                    </span>
                  </div>
                </div>
                
                {/* Agent Control status */}
                <div>
                  {activeSession.assigned_agent === "ai" ? (
                    <span className="px-2.5 py-1 bg-primary/10 text-primary dark:text-purple-400 border border-purple-500/20 rounded-full text-[10px] font-extrabold flex items-center gap-1">
                      <Bot size={11} /> AI Modu
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-primary/10 text-amber-650 dark:text-amber-400 border border-amber-500/20 rounded-full text-[10px] font-extrabold flex items-center gap-1 animate-pulse">
                      <User size={11} /> Temsilci Modu
                    </span>
                  )}
                </div>
              </div>

              {/* Messages Container */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/30 dark:bg-slate-950/5">
                {loading.messages ? (
                  <div className="text-center py-12 text-xs text-slate-400 font-bold animate-pulse">Mesajlar yükleniyor...</div>
                ) : (
                  messages.map((msg) => {
                    const isCustomer = msg.direction === "inbound";
                    const isAi = msg.sender === "ai";
                    
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col max-w-[80%] ${
                          isCustomer ? "mr-auto text-left items-start" : "ml-auto text-right items-end"
                        }`}
                      >
                        {/* Sender Label */}
                        <span className="text-[9px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider mb-1 px-1">
                          {isCustomer ? "Müşteri" : isAi ? "🤖 Yapay Zeka Temsilcisi" : "👤 Temsilci"}
                        </span>
                        
                        {/* Bubble */}
                        <div
                          className={`p-3.5 rounded-2xl text-xs leading-relaxed font-semibold ${
                            isCustomer
                              ? "bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-750 text-slate-850 dark:text-slate-200 rounded-tl-none shadow-sm"
                              : isAi
                              ? "bg-primary text-white rounded-tr-none shadow-sm"
                              : "bg-primary text-white rounded-tr-none shadow-sm"
                          }`}
                        >
                          {msg.text}
                        </div>
                        
                        {/* Time */}
                        <span className="text-[8px] text-slate-400 dark:text-slate-550 mt-1 px-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Canned Responses Autocomplete Suggestions */}
              {showSuggestions && cannedResponses.filter(r => r.shortcut.toLowerCase().startsWith(inputText.toLowerCase())).length > 0 && (
                <div className="mx-4 p-1.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xl max-h-40 overflow-y-auto z-10 flex flex-col gap-0.5 text-left">
                  <div className="px-2.5 py-1 text-[9px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider border-b border-slate-100 dark:border-slate-850">
                    Kısayol Önerileri
                  </div>
                  {cannedResponses.filter(r => r.shortcut.toLowerCase().startsWith(inputText.toLowerCase())).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setInputText(item.content);
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/20 transition flex items-center justify-between gap-4"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-mono font-bold text-primary dark:text-purple-400">{item.shortcut}</span>
                        <span className="text-[10px] text-slate-450 dark:text-slate-500 font-semibold">{item.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-555 dark:text-slate-400 truncate max-w-xs">{item.content}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Send Form */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 dark:border-slate-850 flex gap-2 items-center">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInputText(val);
                    if (val.startsWith("/")) {
                      setShowSuggestions(true);
                    } else {
                      setShowSuggestions(false);
                    }
                  }}
                  placeholder={
                    activeSession.assigned_agent === "ai"
                      ? "Canlı sohbet yapay zekada. Mesaj göndermek için 'Sohbeti Devral' butonuna basın..."
                      : "Müşteriye yanıt yazın... (Şablonlar için / yazın)"
                  }
                  disabled={activeSession.assigned_agent === "ai" || actionLoading}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-purple-500 disabled:opacity-55 disabled:cursor-not-allowed dark:text-slate-200"
                />

                <div className="relative flex items-center shrink-0">
                  <button
                    type="button"
                    disabled={activeSession.assigned_agent === "ai" || actionLoading}
                    onClick={() => {
                      setShowCannedPopover(!showCannedPopover);
                      setShowSuggestions(false);
                    }}
                    className={`p-2 rounded-xl border transition hover:bg-slate-55/65 dark:hover:bg-slate-850 disabled:opacity-45 ${
                      showCannedPopover 
                        ? "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/25 text-primary dark:text-purple-400" 
                        : "border-slate-200 dark:border-slate-805 bg-slate-50/50 dark:bg-slate-950/40 text-slate-400"
                    }`}
                    title="Hızlı Cevaplar"
                  >
                    <FileText size={15} />
                  </button>
                  
                  {/* Canned Responses Popover Panel */}
                  {showCannedPopover && (
                    <div className="absolute bottom-12 right-0 w-64 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-25 flex flex-col max-h-60 animate-in slide-in-from-bottom-2 duration-150 text-left">
                      <div className="p-3 border-b border-slate-100 dark:border-slate-850 bg-slate-50/40 dark:bg-slate-950/20 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-800 dark:text-white uppercase tracking-wider">Hızlı Cevap Seçin</span>
                        <button type="button" onClick={() => setShowCannedPopover(false)} className="text-slate-400 hover:text-slate-600">
                          <X size={12} />
                        </button>
                      </div>
                      <div className="overflow-y-auto p-1.5 divide-y divide-slate-100 dark:divide-slate-850">
                        {cannedResponses.length === 0 ? (
                          <div className="p-4 text-center text-[10px] text-slate-400 font-bold">Tanımlı hızlı cevap bulunamadı.</div>
                        ) : (
                          cannedResponses.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setInputText(item.content);
                                setShowCannedPopover(false);
                              }}
                              className="w-full text-left p-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/20 transition flex flex-col gap-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono font-bold text-primary dark:text-purple-400">{item.shortcut}</span>
                                <span className="text-[9px] font-bold text-slate-450 dark:text-slate-550">{item.title}</span>
                              </div>
                              <span className="text-[10px] text-slate-550 dark:text-slate-400 truncate w-full">{item.content}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={activeSession.assigned_agent === "ai" || !inputText.trim() || actionLoading}
                  className="p-2.5 bg-primary hover:bg-primary text-white rounded-xl text-xs font-bold transition disabled:opacity-55 flex items-center justify-center shrink-0"
                >
                  <Send size={14} />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="p-4 bg-purple-50 dark:bg-purple-950/20 text-primary dark:text-purple-400 border border-purple-100 dark:border-purple-900/40 rounded-3xl mb-3">
                <MessageSquare size={32} />
              </div>
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Görüşme Seçilmedi</h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[280px] leading-relaxed font-semibold mt-1">
                Lütfen sol taraftaki aktif sohbet listesinden bir görüşme seçin veya sağdaki simülatörden yeni bir mesaj oluşturun.
              </p>
            </div>
          )}
        </div>

        {/* 3. Right Control Box & Simulator (25% width on large screens) */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Action Panel */}
          {activeSession && (
            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm text-left transition-colors duration-300">
              <h3 className="text-xs font-extrabold text-slate-850 dark:text-slate-200 uppercase tracking-wider mb-4">Müdahale Kontrolü</h3>
              
              <div className="space-y-4">
                {activeSession.assigned_agent === "ai" ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100/50 dark:border-purple-900/30 rounded-2xl flex gap-2">
                      <HelpCircle size={15} className="text-primary shrink-0 mt-0.5" />
                      <p className="text-[10px] text-purple-700 dark:text-purple-400 font-semibold leading-normal">
                        Bu sohbet şu anda yapay zeka tarafından yanıtlanıyor. Temsilcinin müdahale etmesi gerekiyorsa sohbeti devralabilirsiniz.
                      </p>
                    </div>
                    <button
                      onClick={handleTakeover}
                      disabled={actionLoading}
                      className="w-full py-2.5 bg-primary hover:bg-primary text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-amber-500/10"
                    >
                      <User size={14} /> Sohbeti Devral
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-amber-50/50 dark:bg-amber-900/15 border border-amber-200/40 dark:border-amber-900/30 rounded-2xl flex gap-2">
                      <AlertCircle size={15} className="text-primary shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold leading-normal">
                        Sohbet kontrolü temsilcide. Yapay zeka asistanı şu anda sessizde. İşi tamamladıktan sonra kontrolü geri verebilirsiniz.
                      </p>
                    </div>
                    <button
                      onClick={handleTransferToAI}
                      disabled={actionLoading}
                      className="w-full py-2.5 bg-primary hover:bg-primary text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-purple-500/10"
                    >
                      <Bot size={14} /> Sohbeti AI'a Aktar
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* QA Quality Evaluation Card */}
          {activeSession && activeSession.qa_score !== undefined && activeSession.qa_score !== null && (
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm text-left transition-colors duration-300 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-850 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Award size={15} className="text-primary" />
                  <span>Sohbet QA Skoru</span>
                </h3>
                <span className="text-sm font-extrabold text-primary dark:text-indigo-400">{activeSession.qa_score} / 100</span>
              </div>

              {activeSession.qa_report && (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowQAReport(!showQAReport)}
                    className="w-full flex items-center justify-between py-1 px-2 border border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-bold text-slate-550 focus:outline-none"
                  >
                    <span>Detaylı Kriterler</span>
                    {showQAReport ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>

                  {showQAReport && (
                    <div className="text-[10px] space-y-2 border-t border-slate-50 dark:border-slate-850 pt-2 leading-relaxed">
                      {(() => {
                        try {
                          const qaObj = JSON.parse(activeSession.qa_report);
                          return (
                            <>
                              <div className="p-2.5 bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100/30 dark:border-indigo-900/20 rounded-xl">
                                <strong className="text-primary dark:text-indigo-400 block mb-1">Koçluk Tavsiyesi:</strong>
                                <p className="text-slate-600 dark:text-slate-400 font-medium">{qaObj.coaching_report}</p>
                              </div>

                              {qaObj.breakdown && qaObj.breakdown.length > 0 && (
                                <div className="space-y-1.5">
                                  <strong className="text-slate-700 dark:text-slate-350 block">Uyum Tablosu:</strong>
                                  <div className="divide-y divide-slate-100 dark:divide-slate-850 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                                    {qaObj.breakdown.map((item, idx) => (
                                      <div key={idx} className="p-2 flex items-start justify-between gap-3 bg-slate-50/20 dark:bg-slate-950/5">
                                        <div className="space-y-0.5">
                                          <p className="font-bold text-slate-800 dark:text-slate-300 text-[10px]">{item.question}</p>
                                          {!item.satisfied && item.reason && (
                                            <p className="text-[9px] text-primary font-mono">{item.reason}</p>
                                          )}
                                        </div>
                                        <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold shrink-0 uppercase tracking-wide ${
                                          item.satisfied 
                                            ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary" 
                                            : "bg-rose-50 dark:bg-rose-950/20 text-primary"
                                        }`}>
                                          {item.satisfied ? "OK" : `-${item.penalty}`}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        } catch (e) {
                          return <p className="text-slate-500 font-medium">{activeSession.qa_report}</p>;
                        }
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Message Simulator Box */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm text-left transition-colors duration-300">
            <h3 className="text-xs font-extrabold text-slate-850 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Shield size={14} className="text-primary" /> Mesaj Simülatörü
            </h3>

            <form onSubmit={handleSimulate} className="space-y-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Kanal Seçimi</label>
                <select
                  value={simChannel}
                  onChange={(e) => setSimChannel(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                  <option value="telegram">Telegram</option>
                  <option value="facebook">Facebook</option>
                  <option value="mail">Mail</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Gönderen Bilgisi</label>
                <input
                  type="text"
                  value={simSender}
                  onChange={(e) => setSimSender(e.target.value)}
                  required
                  placeholder="+905554443322 veya user@mail.com"
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none font-mono"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Müşteri Mesajı</label>
                <textarea
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  required
                  rows={3}
                  placeholder="Simüle edilecek müşteri mesajı..."
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={simLoading || !simText.trim()}
                className="w-full py-2.5 bg-primary hover:bg-primary disabled:bg-primary text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                {simLoading ? "Simüle ediliyor..." : "Mesaj Simüle Et"}
              </button>
            </form>
          </div>

        </div>

      </div>
      <AddContactModal
        isOpen={showAddContactModal}
        onClose={() => setShowAddContactModal(false)}
        initialPhone={activeSession?.channel !== "mail" ? activeSession?.sender_info : ""}
        initialEmail={activeSession?.channel === "mail" ? activeSession?.sender_info : ""}
        backendHost={backendHost}
        onSaveSuccess={() => {
          if (activeSession) {
            setActiveSession(prev => ({ ...prev, sender_name: "Yeni Rehber Kaydı" }));
          }
          fetchSessions();
        }}
      />

      {/* Toplu WhatsApp Gönderim & Kampanya Modalı */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
              <div className="flex items-center gap-2">
                <Megaphone size={18} className="text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Toplu WhatsApp Duyurusu & Kampanya</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBroadcastModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleStartBroadcast} className="p-6 space-y-4 text-left">
              <div>
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">Hedef Kitle</label>
                <select
                  value={broadcastTarget}
                  onChange={(e) => setBroadcastTarget(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="all_contacts">Rehberdeki Tüm Kayıtlı Kişiler</option>
                  <option value="custom">Özel Numaralar Listesi (CSV / Manuel)</option>
                </select>
              </div>

              {broadcastTarget === "custom" && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Telefon Numaraları</label>
                    <label className="cursor-pointer px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 border border-emerald-200/60 dark:border-emerald-800/50 rounded-lg text-[10px] font-bold text-emerald-700 dark:text-emerald-400 transition flex items-center gap-1">
                      <Upload size={11} />
                      <span>CSV / TXT Dosyası Seç</span>
                      <input
                        type="file"
                        accept=".csv,.txt,.xlsx,.xls"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <textarea
                    value={broadcastNumbers}
                    onChange={(e) => setBroadcastNumbers(e.target.value)}
                    placeholder="Her satıra bir numara yazın veya yukarıdan CSV/TXT dosyası seçin (Örn: +905554443322)"
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                  {broadcastNumbers && (
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold block mt-1">
                      Toplam {broadcastNumbers.split("\n").filter(n => n.trim().length >= 10).length} geçerli alıcı numarası tespit edildi.
                    </span>
                  )}
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">Kampanya Mesajı</label>
                <textarea
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  required
                  placeholder="Gönderilecek kampanya veya duyuru metnini yazın..."
                  rows={4}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">Medya veya PDF Katalog URL (Opsiyonel)</label>
                <input
                  type="text"
                  value={broadcastMediaUrl}
                  onChange={(e) => setBroadcastMediaUrl(e.target.value)}
                  placeholder="https://example.com/katalog.pdf veya gorsel.jpg"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>

              {broadcastResult && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-xs flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} />
                    <span>Kampanya tamamlandı!</span>
                  </div>
                  <div className="font-bold">
                    Başarılı: {broadcastResult.successful} / Toplam: {broadcastResult.total}
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Kapat
                </button>
                <button
                  type="submit"
                  disabled={broadcastLoading || !broadcastText.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send size={14} />
                  {broadcastLoading ? "Gönderiliyor..." : "Kampanyayı Başlat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
