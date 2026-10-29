import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Bot, RefreshCw, Search, User, ArrowLeft, Plus, AlertCircle, X, Check, CheckCheck, Trash2, Phone } from "lucide-react";
import { useTheme } from "../../../utils/theme";
import DictationButton from "../../common/DictationButton";
import ConfirmDeleteModal from "../../dashboard/ConfirmDeleteModal";

export default function AgentChatTab({ backendHost, currentUser, isVisible = true, openPeerRequest = null, onPeerOpened }) {
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
  const [systemUsers, setSystemUsers] = useState([]);
  const [internalRawMessages, setInternalRawMessages] = useState([]);
  const [startedInternalPeers, setStartedInternalPeers] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, mode: null, peerSession: null, messageObj: null });

  const messagesEndRef = useRef(null);
  const activeChatIdRef = useRef(activeChatId);
  const markingReadInFlightRef = useRef(false);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  const host = backendHost || (typeof window !== "undefined" ? window.location.host : "localhost:8000");
  const API_BASE = `${typeof window !== "undefined" ? window.location.protocol : "http:"}//${host}`;
  const WS_BASE = typeof window !== "undefined" && window.location.protocol === "https:" ? `wss://${host}` : `ws://${host}`;

  const myExt = String(currentUser?.extension || "").trim();
  const myId = String(currentUser?.id || "").trim();
  const mySenderKey = myExt || myId || "agent";

  const [seenConvMap, setSeenConvMap] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(`seen_chat_conv_${myExt || myId || "default"}`);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
    }
    return {};
  });

  const markConvSeen = (convId) => {
    if (!convId) return;
    const key = String(convId);
    const now = Date.now();
    setSeenConvMap((prev) => {
      const next = { ...prev, [key]: now };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`seen_chat_conv_${myExt || myId || "default"}`, JSON.stringify(next));
          localStorage.setItem(`seen_chat_ts_${myExt || "1000"}`, String(now));
        } catch (e) {}
      }
      return next;
    });
  };

  useEffect(() => {
    if (activeChatId && isVisible) {
      markConvSeen(activeChatId);
    }
  }, [activeChatId, customerMessages.length, internalRawMessages.length, isVisible]);

  // Fetch Real System Users & Internal Chat Messages
  const [brokenAvatars, setBrokenAvatars] = useState({});

  const resolveAvatarUrl = (rawAvatar) => {
    const val = String(rawAvatar || "").trim();
    if (!val || val === "null" || val === "undefined") return "";
    if (val.startsWith("/") && !val.startsWith("//")) {
      return `${API_BASE}${val}`;
    }
    return val;
  };

  const markAvatarBroken = (url) => {
    if (!url) return;
    setBrokenAvatars((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
  };

  const fetchInternalChatData = async () => {
    try {
      const reqHeaders = {};
      if (currentUser?.tenant_id) {
        reqHeaders["X-Tenant-ID"] = String(currentUser.tenant_id);
      }
      const [usersRes, chatRes] = await Promise.all([
        fetch(`${API_BASE}/api/settings/users`, { headers: reqHeaders }),
        fetch(`${API_BASE}/api/agent/chat?extension=${encodeURIComponent(myExt)}&user_id=${encodeURIComponent(myId)}&deliver=1`)
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const rawList = Array.isArray(usersData) ? usersData : (Array.isArray(usersData?.users) ? usersData.users : []);
        if (rawList.length >= 0) {
          const mappedUsers = rawList
            .filter(u => {
              if (myId && String(u.id) === myId) return false;
              if (myExt && u.extension && String(u.extension) === myExt) return false;
              return true;
            })
            .map(u => {
              const peerKey = String(u.extension || u.id);
              const isOnline = Boolean(u.web_online || u.is_registered || u.sip_status === "online");
              const roleLabel = u.role === "admin" ? "Yönetici" : u.role === "supervisor" ? "Süpervizör" : "Temsilci";
              return {
                id: peerKey,
                userId: String(u.id),
                extension: String(u.extension || ""),
                name: u.full_name || u.name || u.email || `Dahili ${u.extension || u.id}`,
                avatar: resolveAvatarUrl(u.avatar || u.avatar_url),
                role: u.extension ? `${roleLabel} (${u.extension})` : roleLabel,
                online: isOnline,
                status: isOnline ? "online" : "offline"
              };
            });
          setSystemUsers(mappedUsers);
        }
      }

      if (chatRes.ok) {
        const chatData = await chatRes.json();
        if (Array.isArray(chatData)) {
          setInternalRawMessages(chatData);
        }
      }
    } catch (err) {
      console.error("[AgentChatTab] Error fetching internal chat data:", err);
    }
  };

  // Build Internal Chat Sessions dynamically from real system users & messages
  const internalChatSessions = React.useMemo(() => {
    const myKeys = new Set([myExt, myId].filter(Boolean));

    return systemUsers
      .map(u => {
        const peerKeys = new Set([u.id, u.userId, u.extension].filter(Boolean));
        const convId = `internal-${u.id}`;

        const convMsgs = internalRawMessages
          .filter(m => {
            const s = String(m.sender_id || "");
            const r = String(m.receiver_id || "");
            return (myKeys.has(s) && peerKeys.has(r)) || (peerKeys.has(s) && myKeys.has(r));
          })
          .map(m => {
            const isAgent = myKeys.has(String(m.sender_id || ""));
            let timeStr = "";
            let msgMs = 0;
            if (m.timestamp) {
              try {
                let iso = String(m.timestamp);
                if (!iso.endsWith("Z") && !iso.includes("+") && !iso.includes("-", 10)) iso += "Z";
                const dt = new Date(iso);
                msgMs = dt.getTime();
                timeStr = dt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
              } catch (e) {}
            }
            const msgStatus = m.read_at
              ? "seen"
              : m.delivered_at
                ? "delivered"
                : (m.status === "seen" || m.status === "delivered" ? m.status : "sent");
            return {
              id: m.id,
              sender: isAgent ? "agent" : "customer",
              text: m.text,
              time: timeStr,
              timestamp: m.timestamp,
              msgMs,
              delivered_at: m.delivered_at || null,
              read_at: m.read_at || null,
              status: msgStatus
            };
          });

        const unreadCount =
          isVisible && chatTab === "internal" && String(activeChatId) === convId
            ? 0
            : convMsgs.filter(m => m.sender === "customer" && !m.read_at).length;

        const lastMsg = convMsgs.length > 0 ? convMsgs[convMsgs.length - 1] : null;
        return {
          id: convId,
          peerKey: u.id,
          userId: u.userId,
          extension: u.extension,
          customerName: u.name,
          avatar: u.avatar || "",
          role: u.role,
          platform: "İç Yazışma",
          unread: unreadCount,
          online: u.online,
          messages: convMsgs,
          lastTimestamp: lastMsg?.timestamp || null,
          isStarted: startedInternalPeers.includes(u.id) || convMsgs.length > 0
        };
      })
      .sort((a, b) => {
        if (a.lastTimestamp && b.lastTimestamp) {
          return new Date(b.lastTimestamp) - new Date(a.lastTimestamp);
        }
        if (a.lastTimestamp) return -1;
        if (b.lastTimestamp) return 1;
        if (a.online !== b.online) return a.online ? -1 : 1;
        return a.customerName.localeCompare(b.customerName, "tr");
      });
  }, [systemUsers, internalRawMessages, myExt, myId, startedInternalPeers, activeChatId, isVisible, chatTab]);

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
    fetchInternalChatData();

    const interval = setInterval(() => {
      fetchCustomerSessions(false);
      fetchInternalChatData();
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
  }, [host, chatTab, myExt, myId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [customerMessages, internalRawMessages, activeChatId]);

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

  // Filter Internal Sessions: show active/started conversations, or matching peers when searching
  const filteredInternalSessions = internalChatSessions.filter(session => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return session.customerName.toLowerCase().includes(q) || (session.extension || "").toLowerCase().includes(q);
    }
    return session.isStarted;
  });

  const requestDeleteInternalConversation = (session, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!session) return;
    setDeleteModal({
      isOpen: true,
      mode: "conversation",
      peerSession: session,
      messageObj: null
    });
  };

  const requestDeleteInternalMessage = (msgObj, session, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!msgObj || String(msgObj.id).startsWith("opt-")) return;
    setDeleteModal({
      isOpen: true,
      mode: "message",
      peerSession: session || null,
      messageObj: msgObj
    });
  };

  const handleConfirmDeleteInternal = async () => {
    const { mode, peerSession, messageObj } = deleteModal;
    setDeleteModal({ isOpen: false, mode: null, peerSession: null, messageObj: null });

    if (mode === "message" && messageObj) {
      const targetMsgId = messageObj.id;
      setInternalRawMessages(prev => prev.filter(m => String(m.id) !== String(targetMsgId)));
      try {
        await fetch(`${API_BASE}/api/agent/chat/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_extension: myExt,
            user_id: myId,
            message_id: targetMsgId
          })
        });
        fetchInternalChatData();
      } catch (err) {
        console.error("[AgentChatTab] Error deleting internal message:", err);
        setSendError("Mesaj silinemedi, lütfen tekrar deneyin.");
        fetchInternalChatData();
      }
      return;
    }

    if (mode === "conversation" && peerSession) {
      const myKeys = new Set([myExt, myId].filter(Boolean));
      const peerKeys = new Set([peerSession.peerKey, peerSession.userId, peerSession.extension].filter(Boolean));

      // Optimistically remove conversation & its messages ONLY from current user's local view
      setInternalRawMessages(prev =>
        prev.filter(m => {
          const s = String(m.sender_id || "");
          const r = String(m.receiver_id || "");
          const isBetween = (myKeys.has(s) && peerKeys.has(r)) || (peerKeys.has(s) && myKeys.has(r));
          return !isBetween;
        })
      );
      setStartedInternalPeers(prev => prev.filter(k => !peerKeys.has(String(k))));
      if (String(activeChatId) === String(peerSession.id)) {
        setActiveChatId(null);
      }

      try {
        await fetch(`${API_BASE}/api/agent/chat/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_extension: myExt,
            user_id: myId,
            peer_id: peerSession.peerKey,
            peer_user_id: peerSession.userId,
            peer_extension: peerSession.extension
          })
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("INTERNAL_CHAT_READ_SYNC", {
              detail: { peerKeys: Array.from(peerKeys) }
            })
          );
        }
        fetchInternalChatData();
      } catch (err) {
        console.error("[AgentChatTab] Error deleting internal conversation:", err);
        setSendError("Sohbet silinemedi, lütfen tekrar deneyin.");
        fetchInternalChatData();
      }
    }
  };

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
      // Internal Chat Send Logic via Backend API
      const textToSend = chatInput.trim();
      const targetChat = internalChatSessions.find(c => String(c.id) === String(activeChatId));
      const receiverId = targetChat?.peerKey || String(activeChatId).replace(/^internal-/, "");
      if (!receiverId) return;

      setSendError("");
      const optimisticMsg = {
        id: `opt-int-${Date.now()}`,
        sender_id: mySenderKey,
        receiver_id: receiverId,
        text: textToSend,
        timestamp: new Date().toISOString(),
        delivered_at: null,
        read_at: null,
        status: "sent"
      };
      setInternalRawMessages(prev => [...prev, optimisticMsg]);
      setChatInput("");

      try {
        const res = await fetch(`${API_BASE}/api/agent/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sender_id: mySenderKey,
            receiver_id: receiverId,
            text: textToSend
          })
        });
        if (res.ok) {
          fetchInternalChatData();
        } else {
          setSendError("İç yazışma mesajı gönderilemedi.");
          setInternalRawMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
        }
      } catch (err) {
        console.error("[AgentChatTab] Error sending internal chat message:", err);
        setSendError("Sunucu bağlantı hatası: Mesaj iletilemedi.");
        setInternalRawMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      }
    }
  };

  const handleStartInternalChat = (user) => {
    const peerKey = String(user.id);
    setStartedInternalPeers(prev => (prev.includes(peerKey) ? prev : [peerKey, ...prev]));
    setActiveChatId(`internal-${peerKey}`);
    setIsNewChatModalOpen(false);
  };

  // Find currently active chat object
  const selectedCustomerChat = apiCustomerSessions.find(c => String(c.id) === String(activeChatId));
  const selectedInternalChat = internalChatSessions.find(c => String(c.id) === String(activeChatId));

  // Open specific internal peer conversation when triggered from notification toast
  useEffect(() => {
    const openPeerBySenderId = (rawSenderId) => {
      const target = String(rawSenderId || "").trim();
      if (!target) return false;
      const matchedUser = systemUsers.find(
        u => u.id === target || u.userId === target || u.extension === target
      );
      if (!matchedUser && systemUsers.length === 0) {
        return false;
      }
      const peerKey = matchedUser ? String(matchedUser.id) : target;
      setChatTab("internal");
      setIsNewChatModalOpen(false);
      setStartedInternalPeers(prev => (prev.includes(peerKey) ? prev : [peerKey, ...prev]));
      setActiveChatId(`internal-${peerKey}`);
      return true;
    };

    if (openPeerRequest?.peerSenderId) {
      const opened = openPeerBySenderId(openPeerRequest.peerSenderId);
      if (opened && typeof onPeerOpened === "function") {
        onPeerOpened();
      }
    }

    const handleOpenPeerEvent = (e) => {
      if (e?.detail?.peerSenderId) {
        openPeerBySenderId(e.detail.peerSenderId);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("OPEN_INTERNAL_CHAT_PEER", handleOpenPeerEvent);
      return () => window.removeEventListener("OPEN_INTERNAL_CHAT_PEER", handleOpenPeerEvent);
    }
  }, [openPeerRequest, systemUsers, onPeerOpened]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isVisible && chatTab === "internal" && selectedInternalChat) {
      window.__ACTIVE_VISIBLE_INTERNAL_PEERS__ = [
        selectedInternalChat.peerKey,
        selectedInternalChat.userId,
        selectedInternalChat.extension
      ]
        .filter(Boolean)
        .map(String);
    } else {
      window.__ACTIVE_VISIBLE_INTERNAL_PEERS__ = [];
    }
    return () => {
      if (typeof window !== "undefined") {
        window.__ACTIVE_VISIBLE_INTERNAL_PEERS__ = [];
      }
    };
  }, [isVisible, chatTab, selectedInternalChat]);

  // Mark incoming internal messages as READ (2 blue ticks) only when recipient views the active conversation
  useEffect(() => {
    const tryMarkActiveInternalRead = async () => {
      if (!isVisible || chatTab !== "internal" || !selectedInternalChat) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

      const hasUnreadFromPeer = selectedInternalChat.messages.some(
        m => m.sender === "customer" && !m.read_at
      );
      if (!hasUnreadFromPeer || markingReadInFlightRef.current) return;

      markingReadInFlightRef.current = true;
      const nowIso = new Date().toISOString();
      const myKeys = new Set([myExt, myId].filter(Boolean));
      const peerKeys = new Set(
        [selectedInternalChat.peerKey, selectedInternalChat.userId, selectedInternalChat.extension].filter(Boolean)
      );

      // Optimistic local state update
      setInternalRawMessages(prev =>
        prev.map(m => {
          const s = String(m.sender_id || "");
          const r = String(m.receiver_id || "");
          if (peerKeys.has(s) && myKeys.has(r) && !m.read_at) {
            return {
              ...m,
              delivered_at: m.delivered_at || nowIso,
              read_at: nowIso,
              status: "seen"
            };
          }
          return m;
        })
      );

      try {
        await fetch(`${API_BASE}/api/agent/chat/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reader_extension: myExt,
            reader_user_id: myId,
            peer_id: selectedInternalChat.peerKey,
            peer_user_id: selectedInternalChat.userId,
            peer_extension: selectedInternalChat.extension
          })
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("INTERNAL_CHAT_READ_SYNC", {
              detail: {
                peerKeys: Array.from(peerKeys)
              }
            })
          );
        }
      } catch (err) {
        console.error("[AgentChatTab] Error marking internal chat read:", err);
      } finally {
        markingReadInFlightRef.current = false;
      }
    };

    tryMarkActiveInternalRead();

    if (typeof document !== "undefined") {
      const onVis = () => {
        if (document.visibilityState === "visible") {
          tryMarkActiveInternalRead();
        }
      };
      document.addEventListener("visibilitychange", onVis);
      return () => document.removeEventListener("visibilitychange", onVis);
    }
  }, [isVisible, chatTab, activeChatId, selectedInternalChat, API_BASE, myExt, myId]);

  const renderMessageTick = (status, size = 14) => {
    if (status === "seen") {
      return (
        <CheckCheck
          size={size + 1}
          strokeWidth={2.5}
          className="text-sky-500 dark:text-sky-400 shrink-0 inline-block"
          title="Okundu"
        />
      );
    }
    if (status === "delivered") {
      return (
        <CheckCheck
          size={size + 1}
          strokeWidth={2.3}
          className="text-slate-400 dark:text-slate-500 shrink-0 inline-block"
          title="İletildi (Kullanıcı çevrimiçi, bildirim iletildi)"
        />
      );
    }
    return (
      <Check
        size={size}
        strokeWidth={2.4}
        className="text-slate-400 dark:text-slate-500 shrink-0 inline-block"
        title="Gönderildi (Kullanıcı çevrimdışı)"
      />
    );
  };

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

  const isCustomerSessionUnread = (session) => {
    if (!session || !session.last_message_time) return false;
    if (String(activeChatId) === String(session.id)) return false;
    if (session.assigned_agent !== "human") return false;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const minSeenMs = Math.max(Number(seenConvMap[String(session.id)] || 0), todayStart.getTime());
    let iso = String(session.last_message_time);
    if (!iso.endsWith("Z") && !iso.includes("+") && !iso.includes("-", 10)) iso += "Z";
    const dt = new Date(iso).getTime();
    return !isNaN(dt) && dt > minSeenMs;
  };

  const totalUnreadCustomerCount = filteredCustomerSessions.filter(isCustomerSessionUnread).length;
  const totalUnreadInternalCount = internalChatSessions.reduce((acc, s) => acc + (Number(s.unread) || 0), 0);

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 p-6 flex flex-col">
      <div className="w-full h-full flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2.5">
            <MessageSquare size={22} className="text-rose-500" />
            Takım İçi Sohbet ve Bana Atananlar
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchCustomerSessions(true); fetchInternalChatData(); if (activeChatId && chatTab === "customer") fetchCustomerMessages(activeChatId, true); }}
              className="px-3 py-2 text-slate-500 hover:text-slate-800 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5 text-xs font-semibold"
              title="Yenile"
            >
              <RefreshCw size={14} className={loading.sessions ? "animate-spin" : ""} />
              Yenile
            </button>
          </div>
        </div>
        
        <div className={`flex-1 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm flex overflow-hidden`}>
          
          {/* Left Sidebar - Chat List */}
          <div className={`w-96 shrink-0 border-r ${borderLight} flex flex-col bg-slate-50/30 dark:bg-slate-900/20`}>
            {/* Nav Tabs */}
            <div className={`p-5 border-b ${borderLight} space-y-3.5`}>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800/90 p-1.5 rounded-2xl">
                <button
                  onClick={() => { setChatTab("customer"); setIsNewChatModalOpen(false); setActiveChatId(null); }}
                  className={`px-3 py-2.5 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    chatTab === "customer" 
                      ? `${bg} text-white shadow-sm` 
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  <span>Müşteri Sohbetleri</span>
                  {totalUnreadCustomerCount > 0 ? (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
                      {totalUnreadCustomerCount}
                    </span>
                  ) : filteredCustomerSessions.length > 0 ? (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${chatTab === "customer" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"}`}>
                      {filteredCustomerSessions.length}
                    </span>
                  ) : null}
                </button>
                <button
                  onClick={() => { setChatTab("internal"); setIsNewChatModalOpen(false); setActiveChatId(null); }}
                  className={`px-3 py-2.5 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    chatTab === "internal" 
                      ? `${bg} text-white shadow-sm` 
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  <span>İç Yazışma</span>
                  {totalUnreadInternalCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
                      {totalUnreadInternalCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Sub-filter Selector for Customer Chats */}
              {chatTab === "customer" && (
                <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl text-[11px] font-bold">
                  <button
                    onClick={() => setCustomerFilter("assigned")}
                    className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
                      customerFilter === "assigned"
                        ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    Bana Atananlar
                  </button>
                  <button
                    onClick={() => setCustomerFilter("all")}
                    className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
                      customerFilter === "all"
                        ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    Tüm Sohbetler (AI + Canlı)
                  </button>
                </div>
              )}

              {/* Search Field + Unified Add Button for Internal Chat */}
              <div className="flex items-center gap-2 pt-0.5">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder={chatTab === "customer" ? "İsim veya tel no ara..." : "Personel ara..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950/80 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary"
                  />
                </div>
                {chatTab === "internal" && (
                  <button
                    type="button"
                    onClick={() => setIsNewChatModalOpen((prev) => !prev)}
                    className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-colors shadow-sm"
                    title="Yeni İç Yazışma Başlat"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-4">
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
                        const isUnread = isCustomerSessionUnread(session);

                        return (
                          <button
                            key={session.id}
                            onClick={() => {
                              markConvSeen(session.id);
                              handleSelectCustomerChat(session);
                            }}
                            className={`w-full p-3 hover:bg-white dark:hover:bg-slate-800 border rounded-xl flex items-center justify-between gap-3 transition-colors text-left ${
                              isSelected 
                                ? "bg-white dark:bg-slate-800 border-rose-200 dark:border-rose-900/50 shadow-sm" 
                                : "bg-transparent border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-3 truncate min-w-0 flex-1">
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
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isUnread && (
                                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-500 text-white animate-pulse">
                                        Yeni
                                      </span>
                                    )}
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      {formatTime(session.last_message_time)}
                                    </span>
                                  </div>
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
                    filteredInternalSessions.length === 0 ? (
                      <div className="py-12 text-center text-xs font-medium text-slate-400 dark:text-slate-500 space-y-1">
                        <MessageSquare size={32} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                        <p className="font-bold text-slate-600 dark:text-slate-400">
                          {searchQuery.trim() ? "Eşleşen personel bulunamadı" : "Aktif iç yazışma bulunmuyor"}
                        </p>
                        <p className="text-[11px]">
                          {searchQuery.trim()
                            ? "Farklı bir isim veya dahili numarası deneyin."
                            : "Yeni bir görüşme başlatmak için üstteki (+) butonunu kullanabilirsiniz."}
                        </p>
                      </div>
                    ) : (
                      filteredInternalSessions.map((session) => {
                        const isSelected = String(activeChatId) === String(session.id);
                        const lastMsgObj = session.messages.length > 0 ? session.messages[session.messages.length - 1] : null;
                        return (
                          <div
                            key={session.id}
                            className={`group w-full p-2.5 hover:bg-white dark:hover:bg-slate-800 border rounded-xl flex items-center justify-between gap-2 transition-colors ${
                              isSelected 
                                ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm" 
                                : "bg-transparent border-transparent"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                markConvSeen(session.id);
                                setStartedInternalPeers(prev => (prev.includes(session.peerKey) ? prev : [session.peerKey, ...prev]));
                                setActiveChatId(session.id);
                              }}
                              className="flex items-center gap-3 truncate min-w-0 flex-1 text-left"
                            >
                              <div className="w-10 h-10 shrink-0 relative">
                                {session.avatar && !brokenAvatars[session.avatar] ? (
                                  <img
                                    src={session.avatar}
                                    alt={session.customerName}
                                    onError={() => markAvatarBroken(session.avatar)}
                                    className={`w-10 h-10 rounded-full object-cover bg-slate-100 dark:bg-slate-800 border ${
                                      isSelected ? border : "border-slate-200/70 dark:border-slate-700"
                                    }`}
                                  />
                                ) : (
                                  <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                      isSelected ? `${bg} text-white` : "bg-primary/10 text-primary dark:bg-primary/20"
                                    }`}
                                  >
                                    {session.customerName.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${session.online ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                              </div>
                              <div className="truncate min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className={`text-xs font-bold truncate ${isSelected ? "text-primary" : "text-slate-800 dark:text-white"}`}>
                                    {session.customerName}
                                  </p>
                                  {session.unread > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white shrink-0 animate-pulse">
                                      {session.unread}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5 min-w-0">
                                  {lastMsgObj && lastMsgObj.sender === "agent" && renderMessageTick(lastMsgObj.status, 12)}
                                  <p className="text-xs text-slate-450 dark:text-slate-500 truncate font-medium">
                                    {lastMsgObj ? lastMsgObj.text : "Mesaj yok..."}
                                  </p>
                                </div>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => requestDeleteInternalConversation(session, e)}
                              className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all ${
                                isSelected ? "opacity-80 hover:opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
                              }`}
                              title="Sohbeti Benden Sil"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })
                    )
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
                      <div className="w-10 h-10 shrink-0 relative">
                        {user.avatar && !brokenAvatars[user.avatar] ? (
                          <img
                            src={user.avatar}
                            alt={user.name}
                            onError={() => markAvatarBroken(user.avatar)}
                            className="w-10 h-10 rounded-full object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-sm">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
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
                    <div className="w-10 h-10 shrink-0 relative">
                      {(() => {
                        const headerAvatar =
                          chatTab === "internal"
                            ? selectedInternalChat?.avatar
                            : resolveAvatarUrl(selectedCustomerChat?.avatar || selectedCustomerChat?.sender_avatar);
                        const headerLabel =
                          chatTab === "customer"
                            ? (selectedCustomerChat?.sender_name || selectedCustomerChat?.sender_info || "M")
                            : (selectedInternalChat?.customerName || "T");
                        if (headerAvatar && !brokenAvatars[headerAvatar]) {
                          return (
                            <img
                              src={headerAvatar}
                              alt={headerLabel}
                              onError={() => markAvatarBroken(headerAvatar)}
                              className="w-10 h-10 rounded-full object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700"
                            />
                          );
                        }
                        return (
                          <div className="w-10 h-10 rounded-full bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 font-bold text-base">
                            {headerLabel.charAt(0).toUpperCase()}
                          </div>
                        );
                      })()}
                      {chatTab === "internal" && (
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${selectedInternalChat?.online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      )}
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
                          <span className={selectedInternalChat?.online ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-slate-400"}>
                            {selectedInternalChat?.online ? 'Çevrimiçi' : 'Çevrimdışı'}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Header Actions */}
                  {chatTab === "customer" ? (
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
                  ) : selectedInternalChat ? (
                    <div className="flex items-center gap-2">
                      {(() => {
                        const targetExt = String(
                          selectedInternalChat.extension ||
                            (/^\d+$/.test(String(selectedInternalChat.peerKey || "")) ? selectedInternalChat.peerKey : "")
                        ).trim();
                        return (
                          <button
                            type="button"
                            disabled={!targetExt}
                            onClick={() => {
                              if (!targetExt || typeof window === "undefined") return;
                              window.dispatchEvent(new CustomEvent("TRIGGER_CALL", { detail: targetExt }));
                            }}
                            className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-all shadow-sm border ${
                              targetExt
                                ? `${lightBg} ${text} ${borderLight} ${hover} hover:text-white cursor-pointer`
                                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                            }`}
                            title={
                              targetExt
                                ? `${selectedInternalChat.customerName} (${targetExt}) Dahilisini Ara`
                                : "Bu kullanıcının tanımlı dahili numarası bulunmuyor"
                            }
                          >
                            <Phone size={15} />
                          </button>
                        );
                      })()}
                    </div>
                  ) : null}
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
                    selectedInternalChat.messages.length === 0 ? (
                      <div className="py-12 text-center text-xs font-medium text-slate-400">
                        Bu sohbet için henüz mesaj bulunmuyor. İlk mesajı aşağıdan gönderebilirsiniz.
                      </div>
                    ) : (
                      selectedInternalChat.messages.map((m, idx) => {
                        const isAgent = m.sender === "agent";
                        const canDeleteSingleMsg = !String(m.id || "").startsWith("opt-");
                        return (
                          <div
                            key={m.id || idx}
                            className={`group flex flex-col max-w-[75%] ${
                              isAgent ? "ml-auto items-end" : "mr-auto items-start"
                            }`}
                          >
                            <div className={`flex items-center gap-1.5 ${isAgent ? "flex-row" : "flex-row-reverse"}`}>
                              {canDeleteSingleMsg && (
                                <button
                                  type="button"
                                  onClick={(e) => requestDeleteInternalMessage(m, selectedInternalChat, e)}
                                  className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                                  title="Bu mesajı benden sil"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                              <div
                                className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                                  isAgent
                                    ? `${bg} text-white rounded-tr-none`
                                    : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none"
                                }`}
                              >
                                {m.text}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 mt-1 px-1">
                              <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 tracking-wider">
                                {m.time}
                              </span>
                              {isAgent && renderMessageTick(m.status, 14)}
                            </div>
                          </div>
                        );
                      })
                    )
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
                  <form onSubmit={handleSendChatMessage} className="flex items-center gap-2.5">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Mesajınızı yazın veya mikrofon ile dikte edin..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-rose-500/50"
                      />
                    </div>
                    <DictationButton
                      value={chatInput}
                      onChange={setChatInput}
                      size="lg"
                      onError={(errMsg) => setSendError(errMsg)}
                    />
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

      {/* Per-User Internal Chat / Message Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, mode: null, peerSession: null, messageObj: null })}
        onConfirm={handleConfirmDeleteInternal}
        title={deleteModal.mode === "message" ? "Mesajı Benden Sil" : "İç Yazışmayı Sil"}
        message={
          deleteModal.mode === "message"
            ? "Bu mesajı silmek istediğinize emin misiniz? Mesaj yalnızca sizin ekranınızdan kaldırılacak, karşı tarafta görünmeye devam edecektir."
            : `${deleteModal.peerSession?.customerName || "Bu kişi"} ile olan sohbet geçmişini silmek istediğinize emin misiniz? Sohbet yalnızca sizin ekranınızdan silinecek, karşı tarafın sohbet geçmişine müdahale edilmeyecektir.`
        }
      />
    </div>
  );
}
