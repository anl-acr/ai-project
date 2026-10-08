import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Bot, RefreshCw, Search, User, ArrowLeft, Plus, AlertCircle, X } from "lucide-react";
import { useTheme } from "../../../utils/theme";

export default function AgentChatTab({ backendHost, currentUser }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();

  // Primary Tab State: "customer" (Müşteri Sohbetleri) | "internal" (İç Yazışma)
  const [chatTab, setChatTab] = useState("customer");
  
  // Customer Sub-filter State: "assigned" (Bana Atananlar) | "all" (Tüm Sohbetler)
  const [customerFilter, setCustomerFilter] = useState("assigned");
  
  // Omnichannel Customer Chat States
  const [apiCustomerSessions, setApiCustomerSessions] = useState([]);
  const [customerMessages, setCustomerMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState({ sessions: false, messages: false });
  
  // Active Chat & Messaging Input
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [sendError, setSendError] = useState("");
  
  // Internal Chat States
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [internalChatSessions, setInternalChatSessions] = useState([
    {
      id: "internal-1",
      customerName: "Sistem Yöneticisi",
      platform: "İç Yazışma",
      unread: 0,
      online: true,
      messages: [
        { sender: "customer", text: "Merhaba, bugünkü yoğunluk hakkında bir rapor hazırlayabilir misiniz?", time: "09:30", status: "seen" },
        { sender: "agent", text: "Tabii ki, öğleden sonra iletiyorum.", time: "09:35", status: "seen" }
      ]
    }
  ]);

  const [systemUsers, setSystemUsers] = useState([
    { id: "u1", name: "Sistem Yöneticisi", role: "Yönetici", online: true },
    { id: "u2", name: "Ayşe Yılmaz", role: "Takım Lideri", online: true },
    { id: "u3", name: "Mehmet Demir", role: "Temsilci", online: false },
    { id: "u4", name: "Canan Şahin", role: "Teknik Destek", online: true }
  ]);

  const messagesEndRef = useRef(null);
  const activeChatIdRef = useRef(activeChatId);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  const host = backendHost || (typeof window !== "undefined" ? window.location.host : "localhost:8000");
  const API_BASE = `${typeof window !== "undefined" ? window.location.protocol : "http:"}//${host}`;
  const WS_BASE = typeof window !== "undefined" && window.location.protocol === "https:" ? `wss://${host}` : `ws://${host}`;

  // Fetch Omnichannel Customer Sessions from Backend
  const fetchCustomerSessions = async (showSpinner = false) => {
    if (showSpinner) setLoading(prev => ({ ...prev, sessions: true }));
    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats`);
      if (res.ok) {
        const data = await res.json();
        setApiCustomerSessions(data);
      }
    } catch (err) {
      console.error("[AgentChatTab] Error fetching customer sessions:", err);
    } finally {
      if (showSpinner) setLoading(prev => ({ ...prev, sessions: false }));
    }
  };

  // Fetch Messages for Selected Customer Session
  const fetchCustomerMessages = async (sessionId, showSpinner = false) => {
    if (!sessionId) return;
    if (showSpinner) setLoading(prev => ({ ...prev, messages: true }));
    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats/${sessionId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setCustomerMessages(data);
      }
    } catch (err) {
      console.error("[AgentChatTab] Error fetching messages:", err);
    } finally {
      if (showSpinner) setLoading(prev => ({ ...prev, messages: false }));
    }
  };

  // Polling & Real-time WebSocket Hybrid Listener
  useEffect(() => {
    fetchCustomerSessions(true);

    const interval = setInterval(() => {
      fetchCustomerSessions(false);
      if (activeChatIdRef.current && chatTab === "customer") {
        fetchCustomerMessages(activeChatIdRef.current, false);
      }
    }, 3000);

    let ws = null;
    try {
      const wsUrl = `${WS_BASE}/ws/omnichannel`;
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "message") {
            const newMsg = data.message;
            if (activeChatIdRef.current && String(activeChatIdRef.current) === String(newMsg.session_id)) {
              setCustomerMessages(prev => {
                if (prev.some(m => String(m.id) === String(newMsg.id))) return prev;
                return [...prev, newMsg];
              });
            }
            setApiCustomerSessions(prev => {
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
            setApiCustomerSessions(prev => {
              const idx = prev.findIndex(s => String(s.id) === String(updatedSess.id));
              if (idx > -1) {
                const next = [...prev];
                next[idx] = { ...next[idx], ...updatedSess };
                return next.sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));
              } else {
                return [updatedSess, ...prev];
              }
            });
          } else if (data.type === "takeover_changed") {
            const { session_id, assigned_agent, assigned_user } = data;
            setApiCustomerSessions(prev =>
              prev.map(s => String(s.id) === String(session_id) ? { ...s, assigned_agent, assigned_user } : s)
            );
            fetchCustomerSessions(false);
          }
        } catch (e) {
          // Silent JSON parse error fallback
        }
      };
    } catch (wsErr) {
      console.error("[AgentChatTab] WebSocket connection error:", wsErr);
    }

    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, [host, chatTab]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [customerMessages, activeChatId]);

  // Filter Customer Sessions assigned to logged-in Representative or All
  const filteredCustomerSessions = apiCustomerSessions.filter(session => {
    if (customerFilter === "assigned") {
      const isHuman = session.assigned_agent === "human";
      if (!isHuman) return false;

      const currentUserFullName = (currentUser?.full_name || "").toLowerCase().trim();
      const currentUsername = (currentUser?.username || "").toLowerCase().trim();
      const assignedUser = (session.assigned_user || "").toLowerCase().trim();
      const isAdmin = currentUser?.role === "admin" || currentUsername === "admin";

      const isAssignedToMe = !assignedUser || 
        assignedUser === currentUserFullName || 
        assignedUser === currentUsername ||
        isAdmin;

      if (!isAssignedToMe) return false;
    }

    // Search query filter (Name, Phone/Info, or Last Message)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = (session.sender_name || "").toLowerCase().includes(q);
      const phoneMatch = (session.sender_info || "").toLowerCase().includes(q);
      const textMatch = (session.last_message_text || "").toLowerCase().includes(q);
      return nameMatch || phoneMatch || textMatch;
    }

    return true;
  });

  // Filter Internal Sessions by Search Query
  const filteredInternalSessions = internalChatSessions.filter(session => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return session.customerName.toLowerCase().includes(q);
  });

  // Handle Select Session
  const handleSelectCustomerChat = (session) => {
    setActiveChatId(session.id);
    fetchCustomerMessages(session.id, true);
  };

  // Human Takeover action
  const handleTakeover = async (sessionId) => {
    if (!sessionId) return;
    const activeUser = currentUser?.full_name || currentUser?.username || "Temsilci";

    // Immediate Optimistic State Update
    setApiCustomerSessions(prev =>
      prev.map(s => String(s.id) === String(sessionId) ? { ...s, assigned_agent: "human", assigned_user: activeUser } : s)
    );

    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats/${sessionId}/takeover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_user: activeUser })
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const assignedName = data.assigned_user || activeUser;
        setApiCustomerSessions(prev =>
          prev.map(s => String(s.id) === String(sessionId) ? { ...s, assigned_agent: "human", assigned_user: assignedName } : s)
        );
        fetchCustomerMessages(sessionId, false);
      }
    } catch (err) {
      console.error("[AgentChatTab] Takeover error:", err);
    }
  };

  // Transfer Customer Chat back to AI Assistant
  const handleTransferToAI = async (sessionId) => {
    if (!sessionId) return;

    // Immediate Optimistic State Update
    setApiCustomerSessions(prev =>
      prev.map(s => String(s.id) === String(sessionId) ? { ...s, assigned_agent: "ai", assigned_user: null } : s)
    );

    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats/${sessionId}/transfer_to_ai`, {
        method: "POST"
      });
      if (res.ok) {
        fetchCustomerMessages(sessionId, false);
      }
    } catch (err) {
      console.error("[AgentChatTab] Error transferring session back to AI:", err);
    }
  };

  // Handle Send Message
  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChatId) return;

    if (chatTab === "customer") {
      const textToSend = chatInput.trim();
      setSendError("");

      // Optimistic message append
      const optimisticMsg = {
        id: `opt-${Date.now()}`,
        session_id: activeChatId,
        sender: "human",
        direction: "outbound",
        text: textToSend,
        timestamp: new Date().toISOString()
      };
      setCustomerMessages(prev => [...prev, optimisticMsg]);

      try {
        const res = await fetch(`${API_BASE}/api/omnichannel/chats/${activeChatId}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textToSend })
        });
        const data = await res.json();
        if (!res.ok) {
          setSendError(data.detail || data.message || "Mesaj iletilemedi.");
          setCustomerMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
        } else if (data.status === "warning" || data.status === "error" || data.dispatch?.status === "error" || data.dispatch?.status === "dry_run") {
          setSendError(data.message || data.dispatch?.detail || data.dispatch?.message || "Mesaj veritabanına kaydedildi ancak dış kanala iletilemedi.");
        } else {
          setChatInput("");
          fetchCustomerMessages(activeChatId, false);
          fetchCustomerSessions(false);
        }
      } catch (err) {
        console.error("[AgentChatTab] Error sending omnichannel message:", err);
        setSendError("Sunucu bağlantı hatası: Mesaj iletilemedi.");
        setCustomerMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      }
    } else {
      // Internal Chat Send Logic
      const timeString = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
      const newMsg = { sender: "agent", text: chatInput.trim(), time: timeString, status: "sent" };

      setInternalChatSessions(prev =>
        prev.map(chat => {
          if (chat.id === activeChatId) {
            return { ...chat, messages: [...chat.messages, newMsg] };
          }
          return chat;
        })
      );
      setChatInput("");

      setTimeout(() => {
        setInternalChatSessions(prev =>
          prev.map(chat => {
            if (chat.id === activeChatId) {
              const updatedMessages = chat.messages.map(m => m.sender === "agent" ? { ...m, status: "seen" } : m);
              return { ...chat, messages: updatedMessages };
            }
            return chat;
          })
        );
      }, 1500);
    }
  };

  const handleStartInternalChat = (user) => {
    const existingChat = internalChatSessions.find(c => c.customerName === user.name);
    if (existingChat) {
      setActiveChatId(existingChat.id);
    } else {
      const newChatId = `internal-${Date.now()}`;
      setInternalChatSessions(prev => [
        {
          id: newChatId,
          customerName: user.name,
          platform: "İç Yazışma",
          unread: 0,
          online: user.online,
          messages: []
        },
        ...prev
      ]);
      setActiveChatId(newChatId);
    }
    setIsNewChatModalOpen(false);
  };

  // Find currently active chat object
  const selectedCustomerChat = apiCustomerSessions.find(c => String(c.id) === String(activeChatId));
  const selectedInternalChat = internalChatSessions.find(c => String(c.id) === String(activeChatId));

  const formatTime = (ts) => {
    if (!ts) return "";
    try {
      let isoString = String(ts);
      if (!isoString.endsWith("Z") && !isoString.includes("+") && !isoString.includes("-", 10)) {
        isoString += "Z";
      }
      return new Date(isoString).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  };

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 p-6 flex flex-col items-center">
      <div className="max-w-6xl w-full h-full flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <MessageSquare size={22} className="text-rose-500" />
            Takım İçi Sohbet ve Bana Atananlar
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchCustomerSessions(true); if (activeChatId) fetchCustomerMessages(activeChatId, true); }}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-sm flex items-center gap-1 text-xs font-semibold"
              title="Yenile"
            >
              <RefreshCw size={14} className={loading.sessions ? "animate-spin" : ""} />
              Yenile
            </button>
          </div>
        </div>
        
        <div className={`flex-1 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm flex overflow-hidden`}>
          
          {/* Left Sidebar - Chat List */}
          <div className={`w-80 shrink-0 border-r ${borderLight} flex flex-col bg-slate-50/30 dark:bg-slate-900/20`}>
            {/* Nav Tabs */}
            <div className={`p-4 border-b ${borderLight} space-y-3`}>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => { setChatTab("customer"); setIsNewChatModalOpen(false); setActiveChatId(null); }}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                    chatTab === "customer" 
                      ? `${bg} text-white shadow-sm` 
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  <span>Müşteri Sohbetleri</span>
                  {filteredCustomerSessions.length > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${chatTab === "customer" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"}`}>
                      {filteredCustomerSessions.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { setChatTab("internal"); setIsNewChatModalOpen(false); setActiveChatId(null); }}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${
                    chatTab === "internal" 
                      ? `${bg} text-white shadow-sm` 
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  İç Yazışma
                </button>
              </div>

              {/* Sub-filter Selector for Customer Chats */}
              {chatTab === "customer" && (
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-[11px] font-bold">
                  <button
                    onClick={() => setCustomerFilter("assigned")}
                    className={`flex-1 py-1.5 rounded-lg transition-colors ${
                      customerFilter === "assigned"
                        ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    Bana Atananlar
                  </button>
                  <button
                    onClick={() => setCustomerFilter("all")}
                    className={`flex-1 py-1.5 rounded-lg transition-colors ${
                      customerFilter === "all"
                        ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    Tüm Sohbetler (AI + Canlı)
                  </button>
                </div>
              )}

              {/* Search Field */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={chatTab === "customer" ? "İsim veya tel no ara..." : "Personel ara..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-rose-500/50"
                />
              </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-3">
              {!isNewChatModalOpen ? (
                <div className="space-y-2">
                  {chatTab === "customer" ? (
                    loading.sessions ? (
                      <div className="py-12 text-center text-xs font-medium text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
                        <RefreshCw size={18} className="animate-spin text-rose-500" />
                        Sohbetler yükleniyor...
                      </div>
                    ) : filteredCustomerSessions.length === 0 ? (
                      <div className="py-12 text-center text-xs font-medium text-slate-400 dark:text-slate-500 space-y-1">
                        <MessageSquare size={32} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                        <p className="font-bold text-slate-600 dark:text-slate-400">
                          {customerFilter === "assigned" ? "Atanmış sohbet bulunmuyor" : "Sohbet bulunmuyor"}
                        </p>
                        <p className="text-[11px]">
                          {customerFilter === "assigned" 
                            ? "Canlı sohbet devraldığınızda burada listelenir veya 'Tüm Sohbetler' seçeneğine geçebilirsiniz."
                            : "Henüz başlatılmış sohbet bulunmuyor."
                          }
                        </p>
                      </div>
                    ) : (
                      filteredCustomerSessions.map((session) => {
                        const isSelected = String(activeChatId) === String(session.id);
                        const displayName = session.sender_name || session.sender_info || "Müşteri";
                        const isAi = session.assigned_agent === "ai";

                        return (
                          <button
                            key={session.id}
                            onClick={() => handleSelectCustomerChat(session)}
                            className={`w-full p-3 hover:bg-white dark:hover:bg-slate-800 border rounded-xl flex items-center justify-between gap-3 transition-colors text-left ${
                              isSelected 
                                ? "bg-white dark:bg-slate-800 border-rose-200 dark:border-rose-900/50 shadow-sm" 
                                : "bg-transparent border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-3 truncate min-w-0">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 relative ${
                                isSelected ? `${bg} text-white` : isAi ? "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20" : "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20"
                              }`}>
                                {displayName.charAt(0).toUpperCase()}
                              </div>
                              <div className="truncate min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <p className={`text-xs font-bold truncate ${isSelected ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-white"}`}>
                                    {displayName}
                                  </p>
                                  <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                                    {formatTime(session.last_message_time)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase border ${
                                    isAi 
                                      ? "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-200/30"
                                      : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/30"
                                  }`}>
                                    {isAi ? "🤖 AI" : session.channel || "WhatsApp"}
                                  </span>
                                  <p className="text-xs text-slate-450 dark:text-slate-400 truncate font-normal flex-1">
                                    {session.last_message_text || "Mesaj yok..."}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )
                  ) : (
                    /* Internal Chat List */
                    filteredInternalSessions.map((session) => {
                      const isSelected = String(activeChatId) === String(session.id);
                      return (
                        <button
                          key={session.id}
                          onClick={() => setActiveChatId(session.id)}
                          className={`w-full p-3 hover:bg-white dark:hover:bg-slate-800 border rounded-xl flex items-center justify-between gap-3 transition-colors text-left ${
                            isSelected 
                              ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm" 
                              : "bg-transparent border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-3 truncate">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 relative ${
                               isSelected ? `${bg} text-white` : "bg-primary/10 text-primary dark:bg-primary/20"
                            }`}>
                              {session.customerName.charAt(0)}
                              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${session.online ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                            </div>
                            <div className="truncate">
                              <p className={`text-xs font-bold flex items-center gap-2 ${isSelected ? "text-primary" : "text-slate-800 dark:text-white"}`}>
                                {session.customerName}
                              </p>
                              <p className="text-xs text-slate-450 dark:text-slate-500 truncate mt-0.5 font-medium">
                                {session.messages.length > 0 ? session.messages[session.messages.length - 1].text : "Mesaj yok..."}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                  
                  {chatTab === "internal" && (
                    <button 
                      onClick={() => setIsNewChatModalOpen(true)}
                      className={`w-full mt-4 p-3 border-2 border-dashed ${borderLight} rounded-xl text-xs font-bold text-slate-500 hover:text-primary hover:border-primary/50 transition-all flex items-center justify-center gap-2`}
                    >
                      <span className="text-base leading-none">+</span> Yeni İç Yazışma
                    </button>
                  )}
                </div>
              ) : (
                /* Start New Internal Chat Selection */
                <div className="flex flex-col h-full space-y-2">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-2">
                    <button
                      onClick={() => setIsNewChatModalOpen(false)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1"
                    >
                      <ArrowLeft size={14} /> Geri
                    </button>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Kişi Seç</span>
                  </div>
                  {systemUsers.map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleStartInternalChat(user)}
                      className="w-full p-3 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-xl flex items-center gap-3 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-sm shrink-0 relative">
                        {user.name.charAt(0)}
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${user.online ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-white">{user.name}</p>
                        <p className="text-[11px] text-slate-450 dark:text-slate-500">{user.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Area - Chat Detail View */}
          <div className="flex-1 flex flex-col bg-white dark:bg-slate-900/50">
            {activeChatId && (chatTab === "customer" ? selectedCustomerChat : selectedInternalChat) ? (
              <>
                {/* Chat Header */}
                <div className={`h-16 shrink-0 border-b ${borderLight} px-6 flex items-center justify-between bg-white dark:bg-slate-900`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 font-bold text-base relative">
                      {chatTab === "customer" 
                        ? (selectedCustomerChat?.sender_name || selectedCustomerChat?.sender_info || "M").charAt(0).toUpperCase()
                        : selectedInternalChat?.customerName.charAt(0).toUpperCase()
                      }
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        {chatTab === "customer" 
                          ? (selectedCustomerChat?.sender_name || selectedCustomerChat?.sender_info || "Müşteri")
                          : selectedInternalChat?.customerName
                        }
                        {chatTab === "customer" && selectedCustomerChat?.sender_info && selectedCustomerChat?.sender_name && (
                          <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
                            ({selectedCustomerChat.sender_info})
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        {chatTab === "customer" ? (
                          <>
                            <span className="uppercase font-bold text-emerald-600 dark:text-emerald-400">{selectedCustomerChat?.channel}</span>
                            <span>•</span>
                            <span className="text-slate-400">
                              {selectedCustomerChat?.assigned_agent === "human"
                                ? `👤 Temsilci: ${selectedCustomerChat?.assigned_user || currentUser?.full_name || currentUser?.username || "Ben"}`
                                : "🤖 Yapay Zeka Asistanı"
                              }
                            </span>
                          </>
                        ) : (
                          selectedInternalChat?.online ? 'Çevrimiçi' : 'Çevrimdışı'
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Header Actions */}
                  {chatTab === "customer" && (
                    <div className="flex items-center gap-2">
                      {selectedCustomerChat?.assigned_agent === "human" ? (
                        <button
                          onClick={() => handleTransferToAI(selectedCustomerChat.id)}
                          className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                          title="Sohbeti Yapay Zeka Asistanına geri devret"
                        >
                          <Bot size={14} />
                          AI'ya Devret
                        </button>
                      ) : (
                        <button
                          onClick={() => handleTakeover(selectedCustomerChat.id)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                          title="Sohbeti temsilci olarak devral"
                        >
                          <User size={14} />
                          Sohbeti Devral
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 dark:bg-slate-950/20">
                  {chatTab === "customer" ? (
                    loading.messages ? (
                      <div className="py-12 text-center text-xs font-medium text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
                        <RefreshCw size={18} className="animate-spin text-rose-500" />
                        Mesajlar yükleniyor...
                      </div>
                    ) : customerMessages.length === 0 ? (
                      <div className="py-12 text-center text-xs font-medium text-slate-400">
                        Bu sohbet için henüz mesaj bulunmuyor.
                      </div>
                    ) : (
                      customerMessages.map((m, idx) => {
                        const isAgent = m.sender === "human" || m.sender === "agent" || m.direction === "outbound";
                        const isAI = m.sender === "ai";
                        const isSystem = m.sender === "system";

                        if (isSystem) {
                          return (
                            <div key={m.id || idx} className="flex justify-center my-4">
                              <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-500 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest border border-amber-200 dark:border-amber-800/50 flex items-center gap-2">
                                <Bot size={12} />
                                {m.text}
                              </span>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={m.id || idx}
                            className={`flex flex-col max-w-[75%] ${
                              isAgent ? "ml-auto items-end" : "mr-auto items-start"
                            }`}
                          >
                            {isAI && (
                              <span className="text-[10px] font-bold text-indigo-500 mb-1 ml-1 flex items-center gap-1 uppercase tracking-wider">
                                <Bot size={12} />
                                Yapay Zeka Asistanı
                              </span>
                            )}
                            <div
                              className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                                isAgent
                                  ? `${bg} text-white rounded-tr-none`
                                  : isAI
                                    ? "bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 text-slate-800 dark:text-slate-200 rounded-tl-none"
                                    : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none"
                              }`}
                            >
                              {m.text}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 px-1">
                              <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 tracking-wider">
                                {formatTime(m.timestamp)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )
                  ) : (
                    /* Internal Chat Messages */
                    selectedInternalChat.messages.map((m, idx) => {
                      const isAgent = m.sender === "agent";
                      return (
                        <div
                          key={idx}
                          className={`flex flex-col max-w-[75%] ${
                            isAgent ? "ml-auto items-end" : "mr-auto items-start"
                          }`}
                        >
                          <div
                            className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                              isAgent
                                ? `${bg} text-white rounded-tr-none`
                                : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none"
                            }`}
                          >
                            {m.text}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 px-1">
                            <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 tracking-wider">
                              {m.time}
                            </span>
                            {isAgent && (
                              <span className={`text-[10px] font-bold ${m.status === 'seen' ? 'text-blue-500' : 'text-slate-400'}`}>
                                {m.status === 'seen' ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className={`p-4 bg-white dark:bg-slate-900 border-t ${borderLight} shrink-0`}>
                  {sendError && (
                    <div className="mb-3 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-400 rounded-xl flex items-center justify-between font-medium">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={15} className="shrink-0 text-rose-500" />
                        <span>{sendError}</span>
                      </div>
                      <button type="button" onClick={() => setSendError("")} className="text-rose-400 hover:text-rose-600">
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  <form onSubmit={handleSendChatMessage} className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Mesajınızı yazın..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-rose-500/50"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className={`p-3 ${bg} hover:opacity-90 text-white rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50 transition-opacity shadow-sm`}
                      title="Mesaj Gönder"
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                <MessageSquare size={48} className="mb-4 opacity-40 text-rose-500" />
                <p className="text-base font-bold text-slate-600 dark:text-slate-400">Görüntülemek için bir sohbet seçin</p>
                <p className="text-xs mt-1 text-slate-400">Sol listeden bir konuşmaya tıklayın.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
