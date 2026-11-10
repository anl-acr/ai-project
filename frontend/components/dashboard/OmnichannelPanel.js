import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Send,
  Bot,
  User,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  FileText,
  X,
  Award,
  Megaphone,
  CheckCircle,
  Upload,
  Search,
  Paperclip,
  Image,
  Video,
  Mic,
  Download,
  Mail,
  Plus,
  Check,
  RotateCcw,
  Trash2,
  UserPlus,
  Phone,
  Ban,
  CornerDownRight,
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import AddContactModal from "./AddContactModal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import DictationButton from "../common/DictationButton";
import {
  isEmailChannel,
  EmailMessageCard,
  formatSessionPreviewText,
  extractReplySubjectFromMessages,
  extractMediaTags,
  renderLinkifiedPlainText,
  formatEmailFullDateTime,
} from "../../utils/emailFormatter";

function NativeModalDialog({ isOpen, onClose, labelledBy, maxWidthClass = "max-w-lg", children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (isOpen) {
      if (!el.open) {
        try {
          el.showModal();
        } catch (e) {
          // already open
        }
      }
    } else if (el.open) {
      el.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      onClose={(e) => {
        e.currentTarget.returnValue = "";
        if (isOpen) onClose();
      }}
      className={`m-auto w-[calc(100%-2rem)] ${maxWidthClass} p-0 bg-transparent border-0 outline-none [&:modal]:overscroll-contain backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm backdrop:overflow-hidden backdrop:overscroll-contain`}
    >
      {isOpen ? children : null}
    </dialog>
  );
}

function parseUtcTimestampMs(ts) {
  if (!ts) return 0;
  let iso = String(ts);
  if (!iso.endsWith("Z") && !iso.includes("+") && !iso.includes("-", 10)) {
    iso += "Z";
  }
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

const DEFAULT_SIDEBAR_WIDTH = 340;
const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 680;
const MIN_THREAD_WIDTH = 360;

export default function OmnichannelPanel({ backendHost = "localhost:8000" }) {
  const { bg, text, border, lightBg, borderLight } = useTheme();

  // Resizable Conversation List Sidebar State
  const workspaceRef = useRef(null);
  const sidebarDragStateRef = useRef({ startX: 0, startWidth: DEFAULT_SIDEBAR_WIDTH });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = Number(localStorage.getItem("omnichannel_sidebar_width"));
        if (Number.isFinite(saved) && saved >= MIN_SIDEBAR_WIDTH && saved <= MAX_SIDEBAR_WIDTH) {
          return saved;
        }
      } catch (e) {}
    }
    return DEFAULT_SIDEBAR_WIDTH;
  });

  const clampSidebarWidth = (nextWidth) => {
    let maxAllowed = MAX_SIDEBAR_WIDTH;
    if (workspaceRef.current) {
      const containerWidth = workspaceRef.current.getBoundingClientRect().width;
      if (containerWidth > MIN_SIDEBAR_WIDTH + MIN_THREAD_WIDTH + 24) {
        maxAllowed = Math.min(MAX_SIDEBAR_WIDTH, Math.floor(containerWidth - MIN_THREAD_WIDTH - 24));
      }
    }
    return Math.max(MIN_SIDEBAR_WIDTH, Math.min(Math.round(nextWidth), maxAllowed));
  };

  const updateSidebarWidth = (nextWidth) => {
    const clamped = clampSidebarWidth(nextWidth);
    setSidebarWidth(clamped);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("omnichannel_sidebar_width", String(clamped));
      } catch (e) {}
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleViewportResize = () => {
      setSidebarWidth((prev) => clampSidebarWidth(prev));
    };
    window.addEventListener("resize", handleViewportResize);
    return () => window.removeEventListener("resize", handleViewportResize);
  }, []);

  const handleSidebarResizePointerDown = (e) => {
    if (e.button !== 0) return;
    sidebarDragStateRef.current = {
      startX: e.clientX,
      startWidth: sidebarWidth,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsResizingSidebar(true);
  };

  const handleSidebarResizePointerMove = (e) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const deltaX = e.clientX - sidebarDragStateRef.current.startX;
    updateSidebarWidth(sidebarDragStateRef.current.startWidth + deltaX);
  };

  const handleSidebarResizeLostCapture = () => {
    setIsResizingSidebar(false);
  };

  const handleSidebarResizeKeyDown = (e) => {
    const step = e.shiftKey ? 40 : 15;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      updateSidebarWidth(sidebarWidth - step);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      updateSidebarWidth(sidebarWidth + step);
    } else if (e.key === "Home") {
      e.preventDefault();
      updateSidebarWidth(MIN_SIDEBAR_WIDTH);
    } else if (e.key === "End") {
      e.preventDefault();
      updateSidebarWidth(MAX_SIDEBAR_WIDTH);
    }
  };

  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [replySubjectOverride, setReplySubjectOverride] = useState("");
  const [replyCc, setReplyCc] = useState("");
  const [replyBcc, setReplyBcc] = useState("");

  // Filters & Unread Tracking
  const [statusFilter, setStatusFilter] = useState("active"); // "active" | "waiting_human" | "ai" | "closed"
  const [channelFilter, setChannelFilter] = useState("all"); // "all" | "whatsapp" | "email" | "instagram" | "telegram" | "facebook"
  const [searchQuery, setSearchQuery] = useState("");
  const [seenSessionMap, setSeenSessionMap] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("omnichannel_seen_map");
        if (raw) return JSON.parse(raw);
      } catch (e) {}
    }
    return {};
  });

  const [loading, setLoading] = useState({ sessions: false, messages: false });
  const [actionLoading, setActionLoading] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [cannedResponses, setCannedResponses] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const [contactsList, setContactsList] = useState([]);
  const [channelSettings, setChannelSettings] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCannedPopover, setShowCannedPopover] = useState(false);
  const [showAssignPopover, setShowAssignPopover] = useState(false);

  // QA Report Modal
  const [showQAReport, setShowQAReport] = useState(false);
  const [qaData, setQaData] = useState({ loading: false, score: null, report: "" });

  // Delete & Blacklist Modals
  const [deleteTargetSession, setDeleteTargetSession] = useState(null);
  const [blacklistModal, setBlacklistModal] = useState({ isOpen: false, reason: "Omnichannel üzerinden engellendi", loading: false, error: "" });

  // Compose New Message / Email Modal
  const [composeModal, setComposeModal] = useState({
    isOpen: false,
    channel: "email",
    whatsappMode: "single", // "single" | "bulk"
    recipient: "",
    subject: "",
    cc: "",
    bcc: "",
    text: "",
    attachedFile: null,
    uploading: false,
    submitting: false,
    error: "",
  });
  const composeFileInputRef = useRef(null);

  // Forward Email Modal
  const [forwardModal, setForwardModal] = useState({
    isOpen: false,
    messageId: null,
    toEmail: "",
    cc: "",
    bcc: "",
    subject: "",
    bodyText: "",
    mediaUrl: null,
    mediaFilename: null,
    submitting: false,
    error: "",
  });

  const [sendError, setSendError] = useState("");
  const [statusBanner, setStatusBanner] = useState("");
  const [attachedFile, setAttachedFile] = useState(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const mediaFileInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  // WhatsApp HSM Template Modal State
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateParamValues, setTemplateParamValues] = useState([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [templateSuccess, setTemplateSuccess] = useState("");

  // Broadcast Campaign Modal State
  const [broadcastTarget, setBroadcastTarget] = useState("all_contacts");
  const [broadcastNumbers, setBroadcastNumbers] = useState("");
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastMediaUrl, setBroadcastMediaUrl] = useState("");
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);
  const [broadcastError, setBroadcastError] = useState(null);
  const [csvImportNotice, setCsvImportNotice] = useState("");

  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);

  const API_BASE = `${window.location.protocol}//${backendHost}`;
  const WS_BASE = window.location.protocol === "https:" ? `wss://${backendHost}` : `ws://${backendHost}`;

  const markSessionSeen = (sessionId, timestampVal = null) => {
    if (!sessionId) return;
    const seenMs = Math.max(Date.now(), parseUtcTimestampMs(timestampVal) + 1000);
    setSeenSessionMap((prev) => {
      const next = { ...prev, [String(sessionId)]: seenMs };
      try {
        localStorage.setItem("omnichannel_seen_map", JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const isSessionUnread = (session) => {
    if (!session || !session.last_message_time) return false;
    if (activeSession && String(activeSession.id) === String(session.id)) return false;
    if (session.status === "closed") return false;
    const isInboundTurn =
      session.last_message_direction === "inbound" || session.last_message_sender === "customer";
    if (!isInboundTurn) return false;
    const lastMs = parseUtcTimestampMs(session.last_message_time);
    const seenMs = Number(seenSessionMap[String(session.id)] || 0);
    // Only highlight messages newer than seen timestamp (or arrived within last 48h if never opened)
    const minWindow = seenMs > 0 ? seenMs : Date.now() - 48 * 3600 * 1000;
    return lastMs > minWindow;
  };

  const safeFormatTime = (ts) => {
    if (!ts) return "";
    try {
      let isoString = String(ts);
      if (!isoString.endsWith("Z") && !isoString.includes("+") && !isoString.includes("-", 10)) {
        isoString += "Z";
      }
      return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  };

  useEffect(() => {
    const fetchInitialSupportData = async () => {
      try {
        const [resCanned, resUsers, resContacts, resChannels] = await Promise.all([
          fetch(`${API_BASE}/api/canned-responses`).catch(() => null),
          fetch(`${API_BASE}/api/settings/users`).catch(() => null),
          fetch(`${API_BASE}/api/contacts`).catch(() => null),
          fetch(`${API_BASE}/api/settings/channels?t=${Date.now()}`, { cache: "no-store" }).catch(() => null),
        ]);
        if (resCanned && resCanned.ok) {
          setCannedResponses(await resCanned.json());
        }
        if (resUsers && resUsers.ok) {
          const uData = await resUsers.json();
          const uArr = Array.isArray(uData) ? uData : uData.users || [];
          setSystemUsers(uArr.filter((u) => u && u.is_active !== false));
        }
        if (resContacts && resContacts.ok) {
          const cData = await resContacts.json();
          setContactsList(Array.isArray(cData) ? cData : []);
        }
        if (resChannels && resChannels.ok) {
          const chData = await resChannels.json();
          if (chData && typeof chData === "object") {
            setChannelSettings(chData);
          }
        }
      } catch (err) {
        console.error("[Omnichannel] Error fetching initial support data:", err);
      }
    };
    fetchInitialSupportData();
  }, [backendHost]);

  useEffect(() => {
    if (showTemplateModal) {
      const fetchTemplates = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/omnichannel/whatsapp/templates`);
          if (res.ok) {
            const data = await res.json();
            const tpls = data.templates || [];
            setAvailableTemplates(tpls);
            if (tpls.length > 0) {
              setSelectedTemplate(tpls[0]);
              setTemplateParamValues(new Array(tpls[0].parameters?.length || 0).fill(""));
            }
          }
        } catch (err) {
          console.error("[Omnichannel] Error fetching templates:", err);
        }
      };
      fetchTemplates();
    }
  }, [showTemplateModal, backendHost]);

  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl);
    setTemplateParamValues(new Array(tpl.parameters?.length || 0).fill(""));
    setTemplateError("");
    setTemplateSuccess("");
  };

  const handleSendTemplateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTemplate || !activeSession) return;

    setTemplateLoading(true);
    setTemplateError("");
    setTemplateSuccess("");

    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/whatsapp/send-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_phone: activeSession.sender_info,
          template_name: selectedTemplate.name || selectedTemplate.id,
          language_code: selectedTemplate.language || "tr",
          parameters: templateParamValues,
          session_id: activeSession.id,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTemplateSuccess("Meta Şablon Mesajı (HSM) başarıyla müşteriye gönderildi!");
        setTimeout(() => {
          setShowTemplateModal(false);
          setTemplateSuccess("");
          fetchMessages(activeSession.id, true);
        }, 1500);
      } else {
        setTemplateError(data.detail || "Şablon mesajı gönderilemedi.");
      }
    } catch (err) {
      console.error("[Omnichannel] Error sending template:", err);
      setTemplateError("Sunucu bağlantı hatası.");
    } finally {
      setTemplateLoading(false);
    }
  };

  const fetchSessions = async (showSpinner = false) => {
    if (showSpinner) setLoading((prev) => ({ ...prev, sessions: true }));
    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (activeSessionRef.current) {
          const refreshedActive = data.find((s) => String(s.id) === String(activeSessionRef.current.id));
          if (refreshedActive) {
            setActiveSession((prev) => (prev ? { ...prev, ...refreshedActive } : prev));
          }
        }
      }
    } catch (err) {
      console.error("[Omnichannel] Error loading sessions:", err);
    } finally {
      if (showSpinner) setLoading((prev) => ({ ...prev, sessions: false }));
    }
  };

  const fetchMessages = async (sessionId, showSpinner = false) => {
    if (!sessionId) return;
    if (showSpinner) setLoading((prev) => ({ ...prev, messages: true }));
    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats/${sessionId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          if (prev.length === data.length && prev.length > 0 && prev[prev.length - 1].id === data[data.length - 1].id) {
            return prev;
          }
          return data;
        });
      }
    } catch (err) {
      console.error("[Omnichannel] Error loading messages:", err);
    } finally {
      if (showSpinner) setLoading((prev) => ({ ...prev, messages: false }));
    }
  };

  const activeSessionRef = useRef(activeSession);
  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

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
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "message") {
            const newMsg = data.message;

            if (activeSessionRef.current && String(activeSessionRef.current.id) === String(newMsg.session_id)) {
              setMessages((prev) => {
                if (prev.some((m) => String(m.id) === String(newMsg.id))) return prev;
                return [...prev, newMsg];
              });
              markSessionSeen(newMsg.session_id, newMsg.timestamp);
            }

            setSessions((prev) => {
              const idx = prev.findIndex((s) => String(s.id) === String(newMsg.session_id));
              if (idx > -1) {
                const next = [...prev];
                next[idx] = {
                  ...next[idx],
                  last_message_text: newMsg.text,
                  last_message_time: newMsg.timestamp,
                  last_message_direction: newMsg.direction,
                  last_message_sender: newMsg.sender,
                };
                return next.sort((a, b) => parseUtcTimestampMs(b.last_message_time) - parseUtcTimestampMs(a.last_message_time));
              }
              return prev;
            });
          } else if (data.type === "session_update") {
            const updatedSess = data.session;
            setSessions((prev) => {
              const idx = prev.findIndex((s) => String(s.id) === String(updatedSess.id));
              if (idx > -1) {
                const next = [...prev];
                next[idx] = { ...next[idx], ...updatedSess };
                return next.sort((a, b) => parseUtcTimestampMs(b.last_message_time) - parseUtcTimestampMs(a.last_message_time));
              }
              return [updatedSess, ...prev];
            });

            if (activeSessionRef.current && String(activeSessionRef.current.id) === String(updatedSess.id)) {
              setActiveSession((prev) => ({ ...prev, ...updatedSess }));
              markSessionSeen(updatedSess.id, updatedSess.last_message_time);
            }
          } else if (data.type === "takeover_changed") {
            const { session_id, assigned_agent, assigned_user } = data;
            setSessions((prev) =>
              prev.map((s) => (String(s.id) === String(session_id) ? { ...s, assigned_agent, assigned_user } : s))
            );
            if (activeSessionRef.current && String(activeSessionRef.current.id) === String(session_id)) {
              setActiveSession((prev) => ({ ...prev, assigned_agent, assigned_user }));
            }
          } else if (data.type === "session_deleted") {
            const deletedId = String(data.session_id || "");
            setSessions((prev) => prev.filter((s) => String(s.id) !== deletedId));
            if (activeSessionRef.current && String(activeSessionRef.current.id) === deletedId) {
              setActiveSession(null);
              setMessages([]);
            }
          }
        } catch (err) {
          console.error("[Omnichannel WS] Error parsing message:", err);
        }
      };

      ws.onclose = () => {
        if (isMounted) {
          reconnectTimeout = setTimeout(() => {
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectSession = (session) => {
    setActiveSession(session);
    markSessionSeen(session.id, session.last_message_time);
    setAttachedFile(null);
    setReplySubjectOverride("");
    setReplyCc("");
    setReplyBcc("");
    setSendError("");
    setStatusBanner("");
    setShowAssignPopover(false);
    setIsDraggingFile(false);
    dragCounterRef.current = 0;
    fetchMessages(session.id, true);
  };

  const getCurrentActorLabel = () => {
    const uid =
      localStorage.getItem("current_user_name") ||
      sessionStorage.getItem("current_user_name") ||
      localStorage.getItem("current_user_id") ||
      sessionStorage.getItem("current_user_id") ||
      "";
    if (!uid) return "Temsilci";
    const matched = systemUsers.find(
      (u) =>
        String(u.id) === String(uid) ||
        String(u.extension) === String(uid) ||
        String(u.email) === String(uid)
    );
    return matched?.full_name || matched?.name || uid;
  };

  // Send manual representative reply
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!inputText.trim() && !attachedFile) || !activeSession) return;

    const emailChan = isEmailChannel(activeSession.channel);
    const computedSubject = emailChan
      ? (replySubjectOverride.trim() || extractReplySubjectFromMessages(messages) || "AIDA Müşteri Hizmetleri Yanıtı")
      : null;

    setActionLoading(true);
    setSendError("");
    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats/${activeSession.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          media_url: attachedFile?.url || null,
          media_type: attachedFile?.media_type || null,
          media_filename: attachedFile?.filename || null,
          subject: computedSubject,
          cc: emailChan && replyCc.trim() ? replyCc.trim() : null,
          bcc: emailChan && replyBcc.trim() ? replyBcc.trim() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.detail || data.message || "Mesaj iletilemedi.");
      } else if (
        data.status === "warning" ||
        data.status === "error" ||
        data.dispatch?.status === "error" ||
        data.dispatch?.status === "dry_run"
      ) {
        setSendError(
          data.message || data.dispatch?.detail || data.dispatch?.message || "Mesaj veritabanına kaydedildi ancak dış kanala gönderilemedi."
        );
      } else {
        setInputText("");
        setAttachedFile(null);
        setReplyCc("");
        setReplyBcc("");
        setReplySubjectOverride("");
        markSessionSeen(activeSession.id);
      }
    } catch (err) {
      console.error("[Omnichannel] Error sending message:", err);
      setSendError("Sunucu bağlantı hatası: Mesaj iletilemedi.");
    } finally {
      setActionLoading(false);
    }
  };

  const uploadMediaFile = async (file, forComposeModal = false) => {
    if (!file) return;

    if (forComposeModal) {
      setComposeModal((prev) => ({ ...prev, uploading: true, error: "" }));
    } else {
      setUploadingMedia(true);
      setSendError("");
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats/upload-media`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        const uploadedObj = {
          url: data.url,
          media_type: data.media_type,
          filename: data.filename,
        };
        if (forComposeModal) {
          setComposeModal((prev) => ({ ...prev, attachedFile: uploadedObj }));
        } else {
          setAttachedFile(uploadedObj);
        }
      } else {
        const errTxt = data.detail || "Dosya yüklenirken bir hata oluştu.";
        if (forComposeModal) {
          setComposeModal((prev) => ({ ...prev, error: errTxt }));
        } else {
          setSendError(errTxt);
        }
      }
    } catch (err) {
      console.error("[Media Upload Error]", err);
      if (forComposeModal) {
        setComposeModal((prev) => ({ ...prev, error: "Dosya sunucuya yüklenemedi." }));
      } else {
        setSendError("Dosya sunucuya yüklenemedi.");
      }
    } finally {
      if (forComposeModal) {
        setComposeModal((prev) => ({ ...prev, uploading: false }));
      } else {
        setUploadingMedia(false);
      }
    }
  };

  const handleMediaUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadMediaFile(file, false);
    if (e.target) e.target.value = "";
  };

  const handleChatDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeSession) return;
    dragCounterRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDraggingFile(true);
    }
  };

  const handleChatDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeSession) return;
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingFile(false);
    }
  };

  const handleChatDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleChatDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingFile(false);
    if (!activeSession) return;

    if (activeSession.assigned_agent === "ai") {
      setSendError("Dosya göndermek için önce sağ üstteki 'Sohbeti Devral' butonuna basınız.");
      return;
    }

    const droppedFiles = e.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length > 0) {
      await uploadMediaFile(droppedFiles[0], false);
    }
  };

  const handleChatPaste = async (e) => {
    if (!activeSession || activeSession.assigned_agent === "ai") return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "file") {
        const pastedFile = items[i].getAsFile();
        if (pastedFile) {
          e.preventDefault();
          await uploadMediaFile(pastedFile, false);
          break;
        }
      }
    }
  };

  const renderMessageContent = (msg) => {
    const msgText = msg.text || "";
    const isOutbound = msg.direction !== "inbound";
    const { cleanedText, attachments } = extractMediaTags(msgText, API_BASE);

    if (attachments.length === 0) {
      return (
        <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-left block">
          {renderLinkifiedPlainText(msgText, isOutbound)}
        </span>
      );
    }

    return (
      <div className="space-y-2 text-left">
        {attachments.map((att, idx) => (
          <React.Fragment key={idx}>
            {att.mediaType === "image" && (
              <a href={att.mediaUrl} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={att.mediaUrl}
                  alt={att.filename}
                  className="max-w-xs max-h-60 rounded-xl border border-slate-200/50 dark:border-slate-700 shadow-sm hover:opacity-95 transition my-1 object-cover"
                />
              </a>
            )}
            {att.mediaType === "video" && (
              <video
                src={att.mediaUrl}
                controls
                className="max-w-xs max-h-60 rounded-xl border border-slate-200/50 dark:border-slate-700 my-1"
              />
            )}
            {att.mediaType === "audio" && <audio src={att.mediaUrl} controls className="max-w-xs my-1" />}
            {att.mediaType === "document" && (
              <a
                href={att.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="flex items-center gap-2 p-2.5 bg-slate-100/90 dark:bg-slate-900/90 rounded-xl text-xs font-bold text-primary border border-slate-200 dark:border-slate-700 hover:bg-slate-200/70 transition my-1"
              >
                <FileText size={18} className="shrink-0" />
                <span className="truncate max-w-[180px]">{att.filename}</span>
                <Download size={14} className="shrink-0 ml-auto text-slate-400" />
              </a>
            )}
          </React.Fragment>
        ))}
        {cleanedText && (
          <p className="mt-1 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {renderLinkifiedPlainText(cleanedText, isOutbound)}
          </p>
        )}
      </div>
    );
  };

  // Human Takeover action
  const handleTakeover = async () => {
    if (!activeSession) return;
    const sessionId = activeSession.id;
    const activeUserName = getCurrentActorLabel();

    setActiveSession((prev) => (prev ? { ...prev, assigned_agent: "human", assigned_user: activeUserName } : prev));
    setSessions((prev) =>
      prev.map((s) => (String(s.id) === String(sessionId) ? { ...s, assigned_agent: "human", assigned_user: activeUserName } : s))
    );

    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats/${sessionId}/takeover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_user: activeUserName }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const assignedName = data.assigned_user || activeUserName;
        setActiveSession((prev) => (prev ? { ...prev, assigned_agent: "human", assigned_user: assignedName } : prev));
        setSessions((prev) =>
          prev.map((s) => (String(s.id) === String(sessionId) ? { ...s, assigned_agent: "human", assigned_user: assignedName } : s))
        );
        fetchMessages(sessionId, false);
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
    const sessionId = activeSession.id;

    setActiveSession((prev) => (prev ? { ...prev, assigned_agent: "ai", assigned_user: null } : prev));
    setSessions((prev) =>
      prev.map((s) => (String(s.id) === String(sessionId) ? { ...s, assigned_agent: "ai", assigned_user: null } : s))
    );

    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats/${sessionId}/transfer_to_ai`, {
        method: "POST",
      });
      if (res.ok) {
        fetchMessages(sessionId, false);
      }
    } catch (err) {
      console.error("[Omnichannel] Transfer to AI error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Assign conversation to a specific team member
  const handleAssignToAgent = async (userObj) => {
    if (!activeSession || !userObj) return;
    const targetName = userObj.full_name || userObj.name || userObj.email || `Dahili ${userObj.extension}`;
    const sessionId = activeSession.id;
    setShowAssignPopover(false);
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats/${sessionId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigned_user: targetName,
          assigned_ext: userObj.extension || null,
        }),
      });
      if (res.ok) {
        setActiveSession((prev) =>
          prev ? { ...prev, assigned_agent: "human", assigned_user: targetName, status: "active" } : prev
        );
        setSessions((prev) =>
          prev.map((s) =>
            String(s.id) === String(sessionId)
              ? { ...s, assigned_agent: "human", assigned_user: targetName, status: "active" }
              : s
          )
        );
        setStatusBanner(`Görüşme ${targetName} temsilcisine atandı.`);
        fetchMessages(sessionId, false);
      }
    } catch (err) {
      console.error("[Omnichannel] Assign error:", err);
      setSendError("Temsilci atama işlemi başarısız oldu.");
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Closed / Active Status
  const handleToggleSessionStatus = async () => {
    if (!activeSession) return;
    const sessionId = activeSession.id;
    const nextStatus = activeSession.status === "closed" ? "active" : "closed";
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats/${sessionId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setActiveSession((prev) => (prev ? { ...prev, status: nextStatus } : prev));
        setSessions((prev) => prev.map((s) => (String(s.id) === String(sessionId) ? { ...s, status: nextStatus } : s)));
        setStatusBanner(
          nextStatus === "closed"
            ? "Görüşme çözüldü olarak kapatıldı ve Çözüldü sekmesine taşındı."
            : "Görüşme yeniden aktif hale getirildi."
        );
        fetchMessages(sessionId, false);
      }
    } catch (err) {
      console.error("[Omnichannel] Status toggle error:", err);
      setSendError("Görüşme durumu güncellenemedi.");
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Conversation (confirmed via ConfirmDeleteModal)
  const handleConfirmDeleteSession = async () => {
    if (!deleteTargetSession) return;
    const targetId = deleteTargetSession.id;
    setDeleteTargetSession(null);
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats/${targetId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => String(s.id) !== String(targetId)));
        if (activeSession && String(activeSession.id) === String(targetId)) {
          setActiveSession(null);
          setMessages([]);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setSendError(err.detail || "Görüşme silinemedi.");
      }
    } catch (err) {
      console.error("[Omnichannel] Delete error:", err);
      setSendError("Sunucu hatası: Görüşme silinemedi.");
    } finally {
      setActionLoading(false);
    }
  };

  // Open QA Coaching Report Modal
  const handleOpenQAReport = async () => {
    if (!activeSession) return;
    setShowQAReport(true);
    setQaData({ loading: true, score: activeSession.qa_score ?? null, report: "" });
    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats/${activeSession.id}/qa`);
      if (res.ok) {
        const data = await res.json();
        setQaData({
          loading: false,
          score: data.qa_score ?? activeSession.qa_score ?? null,
          report: data.qa_report || "",
        });
      } else {
        setQaData({ loading: false, score: activeSession.qa_score ?? null, report: "" });
      }
    } catch (err) {
      setQaData({ loading: false, score: activeSession.qa_score ?? null, report: "" });
    }
  };

  // Confirm Blacklist Sender
  const handleConfirmBlacklist = async (e) => {
    e.preventDefault();
    if (!activeSession) return;
    const isMail = isEmailChannel(activeSession.channel);
    setBlacklistModal((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const res = await fetch(`${API_BASE}/api/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: isMail ? "email" : "phone",
          value: activeSession.sender_info,
          reason: blacklistModal.reason || "Omnichannel üzerinden engellendi",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBlacklistModal({ isOpen: false, reason: "Omnichannel üzerinden engellendi", loading: false, error: "" });
        setStatusBanner(`${activeSession.sender_info} kara listeye eklendi.`);
      } else {
        setBlacklistModal((prev) => ({
          ...prev,
          loading: false,
          error: data.detail || "Kara listeye eklenemedi.",
        }));
      }
    } catch (err) {
      setBlacklistModal((prev) => ({ ...prev, loading: false, error: "Sunucu bağlantı hatası." }));
    }
  };

  // Open Compose New Modal
  const openComposeModal = (defaultChannel = "email", defaultWhatsappMode = "single") => {
    setBroadcastResult(null);
    setBroadcastError(null);
    setCsvImportNotice("");
    setComposeModal({
      isOpen: true,
      channel: defaultChannel,
      whatsappMode: defaultWhatsappMode,
      recipient: "",
      subject: "",
      cc: "",
      bcc: "",
      text: "",
      attachedFile: null,
      uploading: false,
      submitting: false,
      error: "",
    });
  };

  const handleComposeSubmit = async (e) => {
    e.preventDefault();
    if (composeModal.channel === "whatsapp" && composeModal.whatsappMode === "bulk") {
      await handleStartBroadcast(e);
      return;
    }
    if (!composeModal.recipient.trim()) {
      setComposeModal((prev) => ({ ...prev, error: "Lütfen alıcı bilgisini giriniz." }));
      return;
    }
    if (!composeModal.text.trim() && !composeModal.attachedFile) {
      setComposeModal((prev) => ({ ...prev, error: "Lütfen mesaj içeriği yazınız veya dosya ekleyiniz." }));
      return;
    }

    setComposeModal((prev) => ({ ...prev, submitting: true, error: "" }));
    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats/compose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: composeModal.channel,
          recipient: composeModal.recipient.trim(),
          subject: composeModal.channel === "email" ? composeModal.subject.trim() : null,
          cc: composeModal.channel === "email" && composeModal.cc.trim() ? composeModal.cc.trim() : null,
          bcc: composeModal.channel === "email" && composeModal.bcc.trim() ? composeModal.bcc.trim() : null,
          text: composeModal.text,
          media_url: composeModal.attachedFile?.url || null,
          media_type: composeModal.attachedFile?.media_type || null,
          media_filename: composeModal.attachedFile?.filename || null,
          assigned_user: getCurrentActorLabel(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setComposeModal((prev) => ({
          ...prev,
          submitting: false,
          error: data.detail || "İleti gönderilemedi.",
        }));
        return;
      }

      setComposeModal((prev) => ({ ...prev, isOpen: false, submitting: false }));
      setStatusFilter("active");
      await fetchSessions(false);
      if (data.session) {
        selectSession(data.session);
      }
    } catch (err) {
      setComposeModal((prev) => ({
        ...prev,
        submitting: false,
        error: "Sunucu bağlantı hatası: İleti gönderilemedi.",
      }));
    }
  };

  // Open Forward Email Modal from an EmailMessageCard
  const handleOpenForwardModal = (msgObj, parsedEmail, effectiveSubject) => {
    const cleanSubj = effectiveSubject || parsedEmail.subject || "İletilen E-Posta";
    const fwdSubj = /^(?:fwd|ilet|fw)\s*:/i.test(cleanSubj) ? cleanSubj : `Fwd: ${cleanSubj}`;
    const origSender =
      msgObj.direction === "inbound"
        ? activeSession?.sender_name
          ? `${activeSession.sender_name} <${activeSession.sender_info}>`
          : activeSession?.sender_info || ""
        : activeSession?.recipient_info || "AIDA Destek";
    const origDate = formatEmailFullDateTime(msgObj.timestamp);
    const firstAtt = parsedEmail.attachments?.[0] || null;
    const relativeMediaUrl = firstAtt?.mediaUrl
      ? firstAtt.mediaUrl.replace(API_BASE, "")
      : null;

    const quotedBlock = [
      "",
      "",
      "---------- İletilen İleti (Forwarded Message) ----------",
      `Kimden: ${origSender}`,
      `Tarih: ${origDate}`,
      `Konu: ${cleanSubj}`,
      "",
      parsedEmail.mainBody || "",
    ].join("\n");

    setForwardModal({
      isOpen: true,
      messageId: msgObj.id,
      toEmail: "",
      cc: "",
      bcc: "",
      subject: fwdSubj,
      bodyText: quotedBlock,
      mediaUrl: relativeMediaUrl,
      mediaFilename: firstAtt?.filename || null,
      submitting: false,
      error: "",
    });
  };

  const handleForwardSubmit = async (e) => {
    e.preventDefault();
    if (!activeSession) return;
    if (!forwardModal.toEmail.trim() || !forwardModal.toEmail.includes("@")) {
      setForwardModal((prev) => ({ ...prev, error: "Lütfen geçerli bir hedef e-posta adresi giriniz." }));
      return;
    }
    setForwardModal((prev) => ({ ...prev, submitting: true, error: "" }));
    try {
      const res = await fetch(`${API_BASE}/api/omnichannel/chats/${activeSession.id}/forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: forwardModal.messageId,
          to_email: forwardModal.toEmail.trim(),
          cc: forwardModal.cc.trim() || null,
          bcc: forwardModal.bcc.trim() || null,
          subject: forwardModal.subject.trim() || "Fwd: İletilen E-Posta",
          body_text: forwardModal.bodyText,
          media_url: forwardModal.mediaUrl,
          media_filename: forwardModal.mediaFilename,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setForwardModal((prev) => ({ ...prev, submitting: false, error: data.detail || "E-posta iletilemedi." }));
        return;
      }
      setForwardModal((prev) => ({ ...prev, isOpen: false, submitting: false }));
      setStatusBanner(`E-posta ${forwardModal.toEmail.trim()} adresine başarıyla iletildi.`);
      fetchMessages(activeSession.id, false);
    } catch (err) {
      setForwardModal((prev) => ({ ...prev, submitting: false, error: "Sunucu bağlantı hatası." }));
    }
  };

  // Handle Bulk WhatsApp Campaign Broadcast
  const handleStartBroadcast = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!broadcastText.trim()) {
      setBroadcastError("Lütfen gönderilecek kampanya veya duyuru metnini yazın.");
      return;
    }

    let recipientList = [];
    if (broadcastTarget === "all_contacts") {
      recipientList = ["all_contacts"];
    } else {
      recipientList = broadcastNumbers
        .split(/[\n,]+/)
        .map((n) => n.trim())
        .filter((n) => n.length >= 10);
    }

    if (recipientList.length === 0) {
      setBroadcastError("Lütfen en az bir geçerli alıcı numarası girin.");
      return;
    }

    setBroadcastLoading(true);
    setBroadcastResult(null);
    setBroadcastError(null);

    try {
      const effectiveMediaUrl = composeModal.attachedFile?.url || broadcastMediaUrl || null;
      const res = await fetch(`${API_BASE}/api/omnichannel/whatsapp/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: recipientList,
          text: broadcastText,
          media_url: effectiveMediaUrl,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBroadcastResult(data);
        fetchSessions(false);
      } else {
        setBroadcastError(data.detail || "Kampanya mesajı gönderilirken bir hata oluştu.");
      }
    } catch (err) {
      console.error("[Broadcast Error]", err);
      setBroadcastError("Sunucu ile bağlantı kurulamadı. Lütfen ağ bağlantınızı ve servis durumunu kontrol ediniz.");
    } finally {
      setBroadcastLoading(false);
    }
  };

  // CSV / TXT File Import Handler
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvImportNotice("");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result || "";
        const lines = content.split(/[\r\n,;]+/);
        const extracted = [];
        for (const line of lines) {
          const digits = line.replace(/[^\d+]/g, "").trim();
          if (digits.length >= 10) {
            extracted.push(digits);
          }
        }
        const uniqueNumbers = Array.from(new Set(extracted));
        if (uniqueNumbers.length > 0) {
          setBroadcastNumbers((prev) => {
            const existing = prev ? prev.split("\n").map((s) => s.trim()).filter(Boolean) : [];
            const merged = Array.from(new Set([...existing, ...uniqueNumbers]));
            return merged.join("\n");
          });
          setCsvImportNotice(`${uniqueNumbers.length} adet telefon numarası dosyadan başarıyla içe aktarıldı.`);
        } else {
          setBroadcastError("Seçilen dosyada geçerli telefon numarası bulunamadı.");
        }
      } catch (err) {
        console.error("Error reading file:", err);
        setBroadcastError("Dosya okunurken bir hata oluştu.");
      }
    };
    reader.readAsText(file);
  };

  const renderChannelBadge = (channel) => {
    switch ((channel || "").toLowerCase()) {
      case "whatsapp":
        return (
          <span className="px-2 py-0.5 text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-md font-bold uppercase tracking-wider shrink-0">
            WhatsApp
          </span>
        );
      case "instagram":
        return (
          <span className="px-2 py-0.5 text-[9px] bg-pink-500/10 text-pink-500 border border-pink-500/20 rounded-md font-bold uppercase tracking-wider shrink-0">
            Instagram
          </span>
        );
      case "telegram":
        return (
          <span className="px-2 py-0.5 text-[9px] bg-sky-500/10 text-sky-500 border border-sky-500/20 rounded-md font-bold uppercase tracking-wider shrink-0">
            Telegram
          </span>
        );
      case "facebook":
        return (
          <span className="px-2 py-0.5 text-[9px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-md font-bold uppercase tracking-wider shrink-0">
            Facebook
          </span>
        );
      case "mail":
      case "email":
        return (
          <span className="px-2 py-0.5 text-[9px] bg-primary/10 text-primary border border-primary/25 rounded-md font-bold uppercase tracking-wider inline-flex items-center gap-1 shrink-0">
            <Mail size={10} /> E-Posta
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[9px] bg-slate-500/10 text-slate-500 border border-slate-500/20 rounded-md font-bold uppercase tracking-wider shrink-0">
            {channel}
          </span>
        );
    }
  };

  // Compute counts & filtered sessions
  const matchesChannelFilter = (s, chKey) => {
    if (chKey === "all") return true;
    const ch = String(s.channel || "").toLowerCase();
    if (chKey === "email") return ch === "email" || ch === "mail";
    return ch === chKey;
  };

  const matchesStatusFilter = (s, stKey) => {
    const isClosed = s.status === "closed";
    if (stKey === "closed") return isClosed;
    if (isClosed) return false;
    if (stKey === "waiting_human") return s.assigned_agent === "human";
    if (stKey === "ai") return s.assigned_agent === "ai";
    return true; // "active"
  };

  const matchesSearchQuery = (session) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = session.sender_name && session.sender_name.toLowerCase().includes(q);
    const infoMatch = session.sender_info && session.sender_info.toLowerCase().includes(q);
    const cleanPhone = session.sender_info ? session.sender_info.replace(/\D/g, "") : "";
    const qDigits = q.replace(/\D/g, "");
    const phoneDigitsMatch = qDigits.length >= 2 && cleanPhone.includes(qDigits);
    const previewText = formatSessionPreviewText(session.last_message_text, session.channel).toLowerCase();
    const lastMsgMatch =
      (session.last_message_text && session.last_message_text.toLowerCase().includes(q)) || previewText.includes(q);
    const lineMatch = session.recipient_info && session.recipient_info.toLowerCase().includes(q);
    const assigneeMatch = session.assigned_user && session.assigned_user.toLowerCase().includes(q);
    return nameMatch || infoMatch || phoneDigitsMatch || lastMsgMatch || lineMatch || assigneeMatch;
  };

  const statusCounts = {
    active: sessions.filter((s) => matchesStatusFilter(s, "active") && matchesChannelFilter(s, channelFilter)).length,
    waiting_human: sessions.filter((s) => matchesStatusFilter(s, "waiting_human") && matchesChannelFilter(s, channelFilter)).length,
    ai: sessions.filter((s) => matchesStatusFilter(s, "ai") && matchesChannelFilter(s, channelFilter)).length,
    closed: sessions.filter((s) => matchesStatusFilter(s, "closed") && matchesChannelFilter(s, channelFilter)).length,
  };

  const totalUnreadCount = sessions.filter(isSessionUnread).length;

  const filteredSessions = sessions.filter(
    (s) => matchesStatusFilter(s, statusFilter) && matchesChannelFilter(s, channelFilter) && matchesSearchQuery(s)
  );

  const isChannelConnected = (chId) => {
    if (chId === "all") return true;
    if (chId === "whatsapp") {
      if (channelSettings === null) return true;
      return Boolean(
        (channelSettings?.whatsapp_token && String(channelSettings.whatsapp_token).trim()) ||
          (channelSettings?.whatsapp_phone_number_id && String(channelSettings.whatsapp_phone_number_id).trim()) ||
          (Array.isArray(channelSettings?.whatsapp_accounts) && channelSettings.whatsapp_accounts.length > 0) ||
          sessions.some((s) => matchesChannelFilter(s, "whatsapp"))
      );
    }
    if (chId === "email") {
      if (channelSettings === null) return true;
      return Boolean(
        (channelSettings?.email_smtp_user && String(channelSettings.email_smtp_user).trim()) ||
          sessions.some((s) => matchesChannelFilter(s, "email"))
      );
    }
    if (chId === "instagram") {
      return Boolean(channelSettings?.instagram_token && String(channelSettings.instagram_token).trim());
    }
    if (chId === "telegram") {
      return Boolean(channelSettings?.telegram_token && String(channelSettings.telegram_token).trim());
    }
    if (chId === "facebook") {
      return Boolean(channelSettings?.facebook_token && String(channelSettings.facebook_token).trim());
    }
    return false;
  };

  const CHANNEL_PILLS = [
    { id: "all", label: "Tümü" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "email", label: "E-Posta" },
    { id: "instagram", label: "Instagram" },
    { id: "telegram", label: "Telegram" },
    { id: "facebook", label: "Facebook" },
  ].filter((pill) => isChannelConnected(pill.id));

  const activeChannelLabels = CHANNEL_PILLS.filter((p) => p.id !== "all").map((p) => p.label);
  const channelSubtitleText =
    activeChannelLabels.length > 1
      ? `${activeChannelLabels.slice(0, -1).join(", ")} ve ${activeChannelLabels[activeChannelLabels.length - 1]} kanallarını tek merkezden filtreleyin, atayın ve yanıtlayın.`
      : activeChannelLabels.length === 1
        ? `${activeChannelLabels[0]} kanalını tek merkezden filtreleyin, atayın ve yanıtlayın.`
        : "Bağlı iletişim kanallarınızı tek merkezden filtreleyin, atayın ve yanıtlayın.";

  const activeCallDigits =
    activeSession && !isEmailChannel(activeSession.channel)
      ? String(activeSession.sender_info || "").replace(/[^\d+]/g, "")
      : "";

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-slate-200/85 dark:border-slate-800/80 pb-5 gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
            <MessageSquare size={22} className="text-primary" />
            <span>Ortak Gelen Kutusu (Omnichannel)</span>
            {totalUnreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white animate-pulse">
                {totalUnreadCount} Yeni
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {channelSubtitleText}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Unified Add Button Design Rule */}
          <button
            type="button"
            onClick={() => openComposeModal("email", "single")}
            title="Yeni E-Posta / WhatsApp İletisi Başlat"
            className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition shadow-sm cursor-pointer"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Main Resizable Split Workspace */}
      <div
        ref={workspaceRef}
        style={{ "--omnichannel-sidebar-w": `${sidebarWidth}px` }}
        className="flex flex-col lg:flex-row items-stretch gap-6 lg:gap-0"
      >
        {/* 1. Left Session List */}
        <div
          className={`w-full lg:w-[var(--omnichannel-sidebar-w)] lg:shrink-0 bg-white dark:bg-slate-900 border ${
            isResizingSidebar ? "border-r-primary dark:border-r-primary border-slate-200/80 dark:border-slate-800" : "border-slate-200/80 dark:border-slate-800"
          } rounded-3xl overflow-hidden shadow-sm h-[660px] flex flex-col transition-colors duration-300 relative`}
        >
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-2.5">
            {/* Status Filter Segmented Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/60 dark:bg-slate-800/90 rounded-xl text-[10px] font-bold">
              {[
                { id: "active", label: "Aktif", count: statusCounts.active },
                { id: "waiting_human", label: "Temsilci", count: statusCounts.waiting_human },
                { id: "ai", label: "AI", count: statusCounts.ai },
                { id: "closed", label: "Çözüldü", count: statusCounts.closed },
              ].map((tab) => {
                const active = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`py-1.5 px-1 rounded-lg transition flex flex-col items-center justify-center leading-tight cursor-pointer ${
                      active
                        ? `${bg} text-white shadow-sm`
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[9px] font-extrabold ${active ? "text-white/90" : "text-slate-400"}`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Channel Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
              {CHANNEL_PILLS.map((pill) => {
                const isSelected = channelFilter === pill.id;
                const count = sessions.filter(
                  (s) => matchesStatusFilter(s, statusFilter) && matchesChannelFilter(s, pill.id)
                ).length;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setChannelFilter(pill.id)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap border transition cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? `${lightBg} ${text} ${borderLight}`
                        : "bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    <span>{pill.label}</span>
                    {count > 0 && <span className="opacity-75">({count})</span>}
                  </button>
                );
              })}
            </div>

            {/* Search Input Box */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <label htmlFor="omnichannel-session-search" className="sr-only">
                Görüşmelerde ara
              </label>
              <input
                id="omnichannel-session-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="İsim, e-posta, konu veya tel no ara..."
                className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Aramayı Temizle"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {loading.sessions && sessions.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 font-bold animate-pulse">Sohbetler yükleniyor...</div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-12 px-4 text-xs text-slate-400 dark:text-slate-500 font-medium space-y-2">
                <p>
                  {searchQuery
                    ? `"${searchQuery}" aramasına uygun görüşme bulunamadı.`
                    : statusFilter === "closed"
                      ? "Çözülmüş / kapatılmış görüşme bulunmuyor."
                      : "Seçili filtrede görüşme bulunmuyor."}
                </p>
                {(channelFilter !== "all" || statusFilter !== "active" || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setChannelFilter("all");
                      setStatusFilter("active");
                      setSearchQuery("");
                    }}
                    className="text-[11px] font-bold text-primary underline underline-offset-2 cursor-pointer"
                  >
                    Filtreleri Sıfırla
                  </button>
                )}
              </div>
            ) : (
              filteredSessions.map((session) => {
                const isActive = activeSession && String(activeSession.id) === String(session.id);
                const unread = isSessionUnread(session);
                const isClosed = session.status === "closed";

                return (
                  <div
                    key={session.id}
                    onClick={() => selectSession(session)}
                    className={`p-3.5 cursor-pointer transition text-left flex flex-col gap-2 relative ${
                      isActive
                        ? `${lightBg} border-l-[3px] ${border} shadow-sm`
                        : unread
                          ? "bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 border-l-[3px] border-primary"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/60 border-l-[3px] border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 max-w-[68%]">
                        {unread && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" />}
                        <span
                          className={`text-xs truncate ${
                            unread
                              ? "font-black text-slate-950 dark:text-white"
                              : "font-extrabold text-slate-800 dark:text-slate-100"
                          }`}
                        >
                          {session.sender_name ? `${session.sender_name} (${session.sender_info})` : session.sender_info}
                        </span>
                      </div>
                      {renderChannelBadge(session.channel)}
                    </div>

                    {session.recipient_info && (
                      <span className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md self-start truncate max-w-full">
                        {session.recipient_info}
                      </span>
                    )}

                    <p
                      className={`text-[11px] truncate ${
                        unread
                          ? "text-slate-900 dark:text-white font-bold"
                          : "text-slate-500 dark:text-slate-400 font-medium"
                      }`}
                    >
                      {formatSessionPreviewText(session.last_message_text, session.channel)}
                    </p>

                    <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 gap-2">
                      <div className="flex items-center gap-1.5">
                        <span>{safeFormatTime(session.last_message_time)}</span>
                        {session.qa_score !== undefined && session.qa_score !== null && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            QA: {session.qa_score}
                          </span>
                        )}
                        {isClosed && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Çözüldü
                          </span>
                        )}
                      </div>
                      {session.assigned_agent === "ai" ? (
                        <span className="flex items-center gap-1 text-primary font-bold truncate">
                          <Bot size={10} /> AI Yanıtlıyor
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold truncate max-w-[120px]">
                          <User size={10} className="shrink-0" />
                          <span className="truncate">{session.assigned_user || "Temsilcide"}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Vertical Edge Resize Handle (Splitter) */}
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label="Görüşme listesi genişliğini değiştir (Sol ve sağ ok tuşlarını kullanın)"
          aria-valuemin={MIN_SIDEBAR_WIDTH}
          aria-valuemax={MAX_SIDEBAR_WIDTH}
          aria-valuenow={sidebarWidth}
          title="Görüşme listesi genişliğini değiştirmek için kenardan sürükleyin (Sıfırlamak için çift tıklayın)"
          onPointerDown={handleSidebarResizePointerDown}
          onPointerMove={handleSidebarResizePointerMove}
          onLostPointerCapture={handleSidebarResizeLostCapture}
          onKeyDown={handleSidebarResizeKeyDown}
          onDoubleClick={() => updateSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
          style={{ WebkitUserSelect: "none", userSelect: "none", touchAction: "pan-y" }}
          className={`hidden lg:flex w-6 shrink-0 items-center justify-center cursor-col-resize group relative z-20 before:content-[''] before:absolute before:inset-y-0 before:-left-2 before:-right-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-xl ${
            isResizingSidebar ? "cursor-grabbing" : ""
          }`}
        >
          <div
            className={`w-1.5 h-20 rounded-full transition-all duration-150 flex flex-col items-center justify-center gap-1 ${
              isResizingSidebar
                ? `${bg} h-32 shadow-sm`
                : "bg-slate-200/90 dark:bg-slate-800 group-hover:bg-primary/80 group-focus-visible:bg-primary group-hover:h-28"
            }`}
          >
            <span className="w-0.5 h-0.5 rounded-full bg-white/90 dark:bg-slate-400" />
            <span className="w-0.5 h-0.5 rounded-full bg-white/90 dark:bg-slate-400" />
            <span className="w-0.5 h-0.5 rounded-full bg-white/90 dark:bg-slate-400" />
          </div>
        </div>

        {/* 2. Right Message Thread */}
        <div
          onDragEnter={handleChatDragEnter}
          onDragLeave={handleChatDragLeave}
          onDragOver={handleChatDragOver}
          onDrop={handleChatDrop}
          className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm h-[660px] flex flex-col transition-colors duration-300 relative"
        >
          {/* Drag & Drop File Overlay */}
          {isDraggingFile && activeSession && (
            <div className="absolute inset-0 z-40 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-150 pointer-events-none">
              <div className="w-full h-full border-2 border-dashed border-primary rounded-2xl bg-primary/10 flex flex-col items-center justify-center text-center p-6 gap-3">
                <div className="w-16 h-16 rounded-3xl bg-primary/20 border border-primary/40 flex items-center justify-center text-white animate-bounce">
                  <Upload size={32} />
                </div>
                <h4 className="text-base font-extrabold text-white tracking-wide">Dosyayı Göndermek İçin Buraya Bırakın</h4>
                <p className="text-xs text-slate-300 font-medium max-w-xs">
                  Görsel (JPG, PNG), Video (MP4), Ses veya Belge (PDF, DOCX, XLSX) dosyalarınızı doğrudan görüşmeye sürükleyip bırakabilirsiniz.
                </p>
              </div>
            </div>
          )}

          {activeSession ? (
            <>
              {/* Active Header */}
              <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      activeSession.status === "closed" ? "bg-slate-400" : "bg-emerald-500 animate-pulse"
                    }`}
                  />
                  <div className="text-left min-w-0">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white leading-none flex items-center gap-1.5 flex-wrap">
                      <span className="truncate max-w-[260px]">
                        {activeSession.sender_name
                          ? `${activeSession.sender_name} (${activeSession.sender_info})`
                          : activeSession.sender_info}
                      </span>
                      {!activeSession.sender_name && (
                        <button
                          type="button"
                          onClick={() => setShowAddContactModal(true)}
                          className="px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded text-[9px] font-extrabold transition shrink-0 cursor-pointer"
                        >
                          Rehbere Kaydet
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("OPEN_CUSTOMER_360", {
                              detail: {
                                phone: activeSession.sender_info,
                                name: activeSession.sender_name || "",
                              },
                            })
                          )
                        }
                        title="Müşteri 360° Tüm Kanal Geçmişi"
                        className="px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded text-[9px] font-extrabold transition shrink-0 cursor-pointer"
                      >
                        360° Kart
                      </button>
                      {activeSession.status === "closed" && (
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 rounded text-[9px] font-extrabold">
                          Çözüldü
                        </span>
                      )}
                    </h4>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wide mt-1 block">
                      Kanal: {isEmailChannel(activeSession.channel) ? "E-POSTA" : activeSession.channel.toUpperCase()}
                      {activeSession.recipient_info ? ` • Hat: ${activeSession.recipient_info}` : ""}
                      {activeSession.assigned_user ? ` • Sorumlu: ${activeSession.assigned_user}` : ""}
                    </span>
                  </div>
                </div>

                {/* Agent Control & Quick Actions Toolbar */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {activeSession.assigned_agent === "ai" ? (
                    <button
                      type="button"
                      onClick={handleTakeover}
                      disabled={actionLoading}
                      className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1 shadow-sm disabled:opacity-50 cursor-pointer"
                      title="Görüşmeyi kendinize devralın"
                    >
                      <User size={12} /> Sohbeti Devral
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleTransferToAI}
                      disabled={actionLoading}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1 shadow-sm disabled:opacity-50 cursor-pointer"
                      title="Görüşmeyi Yapay Zekaya geri devredin"
                    >
                      <Bot size={12} /> AI'a Aktar
                    </button>
                  )}

                  {/* Assign to Specific Team Member Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowAssignPopover((prev) => !prev)}
                      disabled={actionLoading}
                      className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                      title="Başka bir temsilciye ata / yönlendir"
                    >
                      <UserPlus size={12} className="text-primary" />
                      <span>Temsilciye Ata</span>
                    </button>
                    {showAssignPopover && (
                      <div className="absolute right-0 top-10 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-30 overflow-hidden text-left animate-in fade-in duration-150">
                        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/40">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                            Temsilci Seçin
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowAssignPopover(false)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-100 dark:divide-slate-800">
                          {systemUsers.length === 0 ? (
                            <div className="p-3 text-[11px] text-slate-400 text-center">Aktif temsilci bulunamadı.</div>
                          ) : (
                            systemUsers.map((u) => {
                              const uLabel = u.full_name || u.name || u.email || `Dahili ${u.extension}`;
                              const isCurrent = activeSession.assigned_user === uLabel;
                              return (
                                <button
                                  key={u.id || u.extension}
                                  type="button"
                                  onClick={() => handleAssignToAgent(u)}
                                  className="w-full px-2.5 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2 text-xs transition cursor-pointer"
                                >
                                  <div className="min-w-0 text-left">
                                    <div className="font-bold text-slate-800 dark:text-slate-100 truncate">{uLabel}</div>
                                    {u.extension && (
                                      <div className="text-[10px] text-slate-400">Dahili: {u.extension}</div>
                                    )}
                                  </div>
                                  {isCurrent && <Check size={13} className="text-emerald-500 shrink-0" />}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {activeSession.channel.toLowerCase() === "whatsapp" && (
                    <button
                      type="button"
                      onClick={() => setShowTemplateModal(true)}
                      className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                      title="Meta Onaylı Şablon Mesajı Gönder (24h Dışı İletişim)"
                    >
                      <FileText size={12} /> HSM
                    </button>
                  )}

                  {/* Resolve / Reopen Button */}
                  <button
                    type="button"
                    onClick={handleToggleSessionStatus}
                    disabled={actionLoading}
                    title={
                      activeSession.status === "closed"
                        ? "Görüşmeyi Yeniden Aktif Et"
                        : "Görüşmeyi Çözüldü Olarak Kapat"
                    }
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                      activeSession.status === "closed"
                        ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/25"
                        : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/25"
                    }`}
                  >
                    {activeSession.status === "closed" ? (
                      <>
                        <RotateCcw size={12} /> Yeniden Aç
                      </>
                    ) : (
                      <>
                        <Check size={12} /> Çözüldü
                      </>
                    )}
                  </button>

                  {/* QA Report Button */}
                  <button
                    type="button"
                    onClick={handleOpenQAReport}
                    title="Otomatik Kalite Değerlendirme (QA) Raporu"
                    className="p-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/25 transition flex items-center gap-1 text-[10px] font-extrabold cursor-pointer"
                  >
                    <Award size={13} />
                    {activeSession.qa_score !== null && activeSession.qa_score !== undefined && (
                      <span>{activeSession.qa_score}</span>
                    )}
                  </button>

                  {/* Call via WebPhone if phone number */}
                  {activeCallDigits.length >= 3 && (
                    <button
                      type="button"
                      onClick={() =>
                        window.dispatchEvent(new CustomEvent("TRIGGER_CALL", { detail: activeCallDigits }))
                      }
                      title={`${activeCallDigits} numarasını Web Telefondan Ara`}
                      className="p-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-600 hover:text-emerald-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                    >
                      <Phone size={13} />
                    </button>
                  )}

                  {/* Blacklist Sender */}
                  <button
                    type="button"
                    onClick={() =>
                      setBlacklistModal({
                        isOpen: true,
                        reason: "Omnichannel üzerinden engellendi",
                        loading: false,
                        error: "",
                      })
                    }
                    title="Göndericiyi Engelle (Kara Listeye Al)"
                    className="p-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                  >
                    <Ban size={13} />
                  </button>

                  {/* Delete Session (Custom Delete Confirmation Modal) */}
                  <button
                    type="button"
                    onClick={() => setDeleteTargetSession(activeSession)}
                    title="Görüşmeyi Kalıcı Olarak Sil"
                    className="p-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {statusBanner && (
                <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200/70 dark:border-emerald-900/50 text-xs text-emerald-700 dark:text-emerald-400 flex items-center justify-between font-semibold">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={14} className="shrink-0" />
                    <span>{statusBanner}</span>
                  </div>
                  <button type="button" onClick={() => setStatusBanner("")} className="text-emerald-500 hover:text-emerald-700">
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* Messages Container */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/30 dark:bg-slate-950/5">
                {loading.messages ? (
                  <div className="text-center py-12 text-xs text-slate-400 font-bold animate-pulse">Mesajlar yükleniyor...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400 font-medium">Bu görüşmede henüz mesaj kaydı yok.</div>
                ) : (
                  (() => {
                    const emailMode = isEmailChannel(activeSession.channel);
                    const fallbackEmailSubject = emailMode ? extractReplySubjectFromMessages(messages) : "";

                    return messages.map((msg) => {
                      // System audit/status messages rendered as centered timeline pills
                      if (msg.sender === "system") {
                        return (
                          <div key={msg.id} className="flex justify-center my-2">
                            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700 flex items-center gap-1.5">
                              <span>{msg.text}</span>
                              <span className="opacity-60">• {safeFormatTime(msg.timestamp)}</span>
                            </span>
                          </div>
                        );
                      }

                      if (emailMode || /^E-Posta Konusu\s*:/i.test(msg.text || "")) {
                        return (
                          <EmailMessageCard
                            key={msg.id}
                            msg={msg}
                            session={activeSession}
                            apiBase={API_BASE}
                            fallbackSubject={fallbackEmailSubject}
                            onForward={handleOpenForwardModal}
                          />
                        );
                      }

                      const isCustomer = msg.direction === "inbound";
                      const isAi = msg.sender === "ai";

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col max-w-[80%] ${
                            isCustomer ? "mr-auto text-left items-start" : "ml-auto text-right items-end"
                          }`}
                        >
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1 px-1">
                            {isCustomer ? "Müşteri" : isAi ? "🤖 Yapay Zeka Temsilcisi" : "👤 Temsilci"}
                          </span>

                          <div
                            className={`p-3.5 rounded-2xl text-xs leading-relaxed font-semibold ${
                              isCustomer
                                ? "bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none shadow-sm"
                                : "bg-primary text-white rounded-tr-none shadow-sm"
                            }`}
                          >
                            {renderMessageContent(msg)}
                          </div>

                          <span className="text-[8px] text-slate-400 dark:text-slate-500 mt-1 px-1">
                            {safeFormatTime(msg.timestamp)}
                          </span>
                        </div>
                      );
                    });
                  })()
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Attached File Preview Pill */}
              {attachedFile && (
                <div className="mx-4 my-2 p-2.5 bg-primary/5 dark:bg-primary/10 border border-primary/25 rounded-2xl flex items-center justify-between text-xs animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 min-w-0">
                    {attachedFile.media_type === "image" && <Image size={16} className="text-primary shrink-0" />}
                    {attachedFile.media_type === "video" && <Video size={16} className="text-primary shrink-0" />}
                    {attachedFile.media_type === "audio" && <Mic size={16} className="text-amber-500 shrink-0" />}
                    {attachedFile.media_type === "document" && <FileText size={16} className="text-primary shrink-0" />}
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[240px]">
                      {attachedFile.filename}
                    </span>
                    <span className="text-[9px] uppercase px-1.5 py-0.5 bg-primary/15 text-primary rounded-md font-extrabold shrink-0">
                      {attachedFile.media_type}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedFile(null)}
                    className="p-1 text-slate-400 hover:text-rose-500 transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Hidden File Input */}
              <input
                type="file"
                ref={mediaFileInputRef}
                onChange={handleMediaUpload}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
                className="hidden"
              />

              {/* Canned Responses Autocomplete Suggestions */}
              {showSuggestions &&
                cannedResponses.filter((r) => r.shortcut.toLowerCase().startsWith(inputText.toLowerCase())).length > 0 && (
                  <div className="mx-4 p-1.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xl max-h-40 overflow-y-auto z-10 flex flex-col gap-0.5 text-left">
                    <div className="px-2.5 py-1 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      Kısayol Önerileri
                    </div>
                    {cannedResponses
                      .filter((r) => r.shortcut.toLowerCase().startsWith(inputText.toLowerCase()))
                      .map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setInputText(item.content);
                            setShowSuggestions(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-between gap-4"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] font-mono font-bold text-primary">{item.shortcut}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{item.title}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-xs">{item.content}</span>
                        </button>
                      ))}
                  </div>
                )}

              {sendError && (
                <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 border-t border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-400 flex items-center justify-between font-medium">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-rose-500" />
                    <span>{sendError}</span>
                  </div>
                  <button type="button" onClick={() => setSendError("")} className="text-rose-400 hover:text-rose-600">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Send Form */}
              <form onSubmit={handleSendMessage} className="p-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                {isEmailChannel(activeSession.channel) && (
                  <details className="group rounded-xl bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                    <summary className="px-3 py-1.5 cursor-pointer list-none flex items-center justify-between gap-2 select-none">
                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                        <Mail size={12} className="text-primary shrink-0" />
                        <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0">Yanıt Konusu:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {replySubjectOverride.trim() ||
                            extractReplySubjectFromMessages(messages) ||
                            "AIDA Müşteri Hizmetleri Yanıtı"}
                        </span>
                        {(replyCc.trim() || replyBcc.trim()) && (
                          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-extrabold shrink-0">
                            CC/BCC Aktif
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-primary shrink-0">Konu &amp; CC/BCC Düzenle</span>
                    </summary>
                    <div className="px-3 pb-2.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label htmlFor="reply-email-subject" className="block text-[9px] font-bold uppercase text-slate-400 mb-0.5">
                          Konu Başlığı
                        </label>
                        <input
                          id="reply-email-subject"
                          type="text"
                          value={replySubjectOverride}
                          onChange={(e) => setReplySubjectOverride(e.target.value)}
                          placeholder={extractReplySubjectFromMessages(messages) || "Re: Konu"}
                          className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="reply-email-cc" className="block text-[9px] font-bold uppercase text-slate-400 mb-0.5">
                          CC (Bilgi)
                        </label>
                        <input
                          id="reply-email-cc"
                          type="text"
                          value={replyCc}
                          onChange={(e) => setReplyCc(e.target.value)}
                          placeholder="ornek@firma.com, ..."
                          className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="reply-email-bcc" className="block text-[9px] font-bold uppercase text-slate-400 mb-0.5">
                          BCC (Gizli)
                        </label>
                        <input
                          id="reply-email-bcc"
                          type="text"
                          value={replyBcc}
                          onChange={(e) => setReplyBcc(e.target.value)}
                          placeholder="arsiv@firma.com"
                          className="w-full px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  </details>
                )}

                <div className="flex gap-2 items-end">
                  <button
                    type="button"
                    disabled={activeSession.assigned_agent === "ai" || actionLoading || uploadingMedia}
                    onClick={() => mediaFileInputRef.current?.click()}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition disabled:opacity-45 shrink-0"
                    title="Görsel, Video veya Belge Yükle"
                  >
                    <Paperclip size={15} className={uploadingMedia ? "animate-spin text-primary" : ""} />
                  </button>

                  <label htmlFor="omnichannel-reply-input" className="sr-only">
                    Yanıt mesajı
                  </label>
                  {isEmailChannel(activeSession.channel) ? (
                    <textarea
                      id="omnichannel-reply-input"
                      rows={2}
                      value={inputText}
                      onPaste={handleChatPaste}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.form?.requestSubmit();
                        }
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInputText(val);
                        setShowSuggestions(val.startsWith("/"));
                      }}
                      placeholder={
                        activeSession.assigned_agent === "ai"
                          ? "E-posta yanıtı yapay zekada. Yanıt yazmak için sağ üstten 'Sohbeti Devral' butonuna basın..."
                          : "E-posta yanıtınızı yazın (Alt satır için Enter, hızlı gönderim için Ctrl+Enter, şablonlar için / yazın)..."
                      }
                      disabled={activeSession.assigned_agent === "ai" || actionLoading}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs leading-relaxed resize-y min-h-[56px] max-h-36 focus:outline-none focus:border-primary disabled:opacity-55 disabled:cursor-not-allowed text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  ) : (
                    <input
                      id="omnichannel-reply-input"
                      type="text"
                      value={inputText}
                      onPaste={handleChatPaste}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInputText(val);
                        setShowSuggestions(val.startsWith("/"));
                      }}
                      placeholder={
                        activeSession.assigned_agent === "ai"
                          ? "Canlı sohbet yapay zekada. Mesaj göndermek için 'Sohbeti Devral' butonuna basın..."
                          : "Müşteriye yanıt yazın, mikrofonla dikte edin veya dosya sürükleyip bırakın... (Şablonlar için / yazın)"
                      }
                      disabled={activeSession.assigned_agent === "ai" || actionLoading}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-primary disabled:opacity-55 disabled:cursor-not-allowed text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  )}

                  <DictationButton
                    value={inputText}
                    onChange={(val) => {
                      setInputText(val);
                      setShowSuggestions(val.startsWith("/"));
                    }}
                    disabled={activeSession.assigned_agent === "ai" || actionLoading}
                    size="md"
                    onError={(errMsg) => setSendError(errMsg)}
                  />

                  <div className="relative flex items-center shrink-0">
                    <button
                      type="button"
                      disabled={activeSession.assigned_agent === "ai" || actionLoading}
                      onClick={() => {
                        setShowCannedPopover(!showCannedPopover);
                        setShowSuggestions(false);
                      }}
                      className={`p-2 rounded-xl border transition hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-45 ${
                        showCannedPopover
                          ? `${borderLight} ${lightBg} ${text}`
                          : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-slate-400"
                      }`}
                      title="Hızlı Cevaplar"
                    >
                      <FileText size={15} />
                    </button>

                    {showCannedPopover && (
                      <div className="absolute bottom-12 right-0 w-64 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-25 flex flex-col max-h-60 animate-in slide-in-from-bottom-2 duration-150 text-left">
                        <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                            Hızlı Cevap Seçin
                          </span>
                          <button type="button" onClick={() => setShowCannedPopover(false)} className="text-slate-400 hover:text-slate-600">
                            <X size={12} />
                          </button>
                        </div>
                        <div className="overflow-y-auto p-1.5 divide-y divide-slate-100 dark:divide-slate-800">
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
                                className="w-full text-left p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition flex flex-col gap-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono font-bold text-primary">{item.shortcut}</span>
                                  <span className="text-[9px] font-bold text-slate-400">{item.title}</span>
                                </div>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate w-full">{item.content}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={activeSession.assigned_agent === "ai" || (!inputText.trim() && !attachedFile) || actionLoading}
                    className="p-2.5 bg-primary hover:opacity-90 text-white rounded-xl text-xs font-bold transition disabled:opacity-55 flex items-center justify-center shrink-0"
                    title="Yanıt Gönder"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className={`p-4 ${lightBg} ${text} border ${borderLight} rounded-3xl mb-3`}>
                <MessageSquare size={32} />
              </div>
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Görüşme Seçilmedi</h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[300px] leading-relaxed font-semibold mt-1">
                Sol taraftaki listeden bir görüşme seçin veya sağ üstteki (+) butonuyla yeni bir e-posta / WhatsApp iletisi başlatın.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={showAddContactModal}
        onClose={() => setShowAddContactModal(false)}
        initialPhone={!isEmailChannel(activeSession?.channel) ? activeSession?.sender_info : ""}
        initialEmail={isEmailChannel(activeSession?.channel) ? activeSession?.sender_info : ""}
        backendHost={backendHost}
        onSaveSuccess={() => {
          if (activeSession) {
            setActiveSession((prev) => ({ ...prev, sender_name: "Yeni Rehber Kaydı" }));
          }
          fetchSessions();
        }}
      />

      {/* Custom Delete Confirmation Modal Rule */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTargetSession)}
        onClose={() => setDeleteTargetSession(null)}
        onConfirm={handleConfirmDeleteSession}
        title="Görüşmeyi Sil"
        message={
          deleteTargetSession
            ? `"${deleteTargetSession.sender_name || deleteTargetSession.sender_info}" görüşmesini ve tüm mesaj geçmişini kalıcı olarak silmek istediğinize emin misiniz?`
            : "Bu görüşmeyi silmek istediğinize emin misiniz?"
        }
      />

      {/* Compose New Email / WhatsApp Modal (Native <dialog>) */}
      <NativeModalDialog
        isOpen={composeModal.isOpen}
        onClose={() => setComposeModal((prev) => ({ ...prev, isOpen: false }))}
        labelledBy="compose-omnichannel-title"
        maxWidthClass="max-w-xl"
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-left">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-950/30">
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-primary" />
              <h3 id="compose-omnichannel-title" className="text-sm font-bold text-slate-900 dark:text-white">
                Yeni İleti Başlat
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setComposeModal((prev) => ({ ...prev, isOpen: false }))}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Kapat"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleComposeSubmit} className="p-5 space-y-3.5">
            {/* Channel Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setComposeModal((prev) => ({ ...prev, channel: "email", error: "" }))}
                className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  composeModal.channel === "email"
                    ? `${bg} text-white shadow-sm`
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                <Mail size={14} /> Yeni E-Posta Gönder
              </button>
              <button
                type="button"
                onClick={() => setComposeModal((prev) => ({ ...prev, channel: "whatsapp", error: "" }))}
                className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  composeModal.channel === "whatsapp"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                <MessageSquare size={14} /> Yeni WhatsApp Mesajı
              </button>
            </div>

            {/* WhatsApp Single vs Bulk Sub-Toggle */}
            {composeModal.channel === "whatsapp" && (
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/50 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setBroadcastError(null);
                    setComposeModal((prev) => ({ ...prev, whatsappMode: "single", error: "" }));
                  }}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    composeModal.whatsappMode !== "bulk"
                      ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs border border-emerald-200/60 dark:border-emerald-800/50"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <MessageSquare size={13} /> Tekil Mesaj Gönder
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBroadcastResult(null);
                    setBroadcastError(null);
                    setComposeModal((prev) => ({ ...prev, whatsappMode: "bulk", error: "" }));
                  }}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    composeModal.whatsappMode === "bulk"
                      ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs border border-emerald-200/60 dark:border-emerald-800/50"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <Megaphone size={13} /> Toplu Mesaj / Kampanya
                </button>
              </div>
            )}

            {composeModal.channel === "whatsapp" && composeModal.whatsappMode === "bulk" ? (
              <>
                <div>
                  <label htmlFor="bc-target" className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">
                    Hedef Kitle
                  </label>
                  <select
                    id="bc-target"
                    value={broadcastTarget}
                    onChange={(e) => setBroadcastTarget(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                  >
                    <option value="all_contacts" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                      Rehberdeki Tüm Kayıtlı Kişiler
                    </option>
                    <option value="custom" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                      Özel Numaralar Listesi (CSV / Manuel)
                    </option>
                  </select>
                </div>

                {broadcastTarget === "custom" && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="bc-numbers" className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Telefon Numaraları *
                      </label>
                      <label className="cursor-pointer px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 border border-emerald-200/60 dark:border-emerald-800/50 rounded-lg text-[10px] font-bold text-emerald-700 dark:text-emerald-400 transition flex items-center gap-1">
                        <Upload size={11} />
                        <span>CSV / TXT Dosyası Seç</span>
                        <input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                      </label>
                    </div>
                    <textarea
                      id="bc-numbers"
                      value={broadcastNumbers}
                      onChange={(e) => setBroadcastNumbers(e.target.value)}
                      placeholder="Her satıra bir numara yazın veya yukarıdan CSV/TXT dosyası seçin (Örn: +905554443322)"
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    {csvImportNotice && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block mt-1">
                        {csvImportNotice}
                      </span>
                    )}
                    {broadcastNumbers && (
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold block mt-1">
                        Toplam {broadcastNumbers.split(/[\n,]+/).filter((n) => n.trim().length >= 10).length} geçerli alıcı numarası tespit edildi.
                      </span>
                    )}
                  </div>
                )}

                <div>
                  <label htmlFor="bc-text" className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">
                    Kampanya / Duyuru Mesajı *
                  </label>
                  <textarea
                    id="bc-text"
                    value={broadcastText}
                    onChange={(e) => setBroadcastText(e.target.value)}
                    required
                    placeholder="Gönderilecek kampanya veya duyuru metnini yazın..."
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <label htmlFor="bc-media" className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">
                    Medya veya PDF Katalog URL (Opsiyonel)
                  </label>
                  <input
                    id="bc-media"
                    type="text"
                    value={broadcastMediaUrl}
                    onChange={(e) => setBroadcastMediaUrl(e.target.value)}
                    placeholder="https://example.com/katalog.pdf veya aşağıdan Ek Dosya seçin"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                {/* Attachment Row */}
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="file"
                    ref={composeFileInputRef}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) await uploadMediaFile(f, true);
                      if (e.target) e.target.value = "";
                    }}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={composeModal.uploading}
                    onClick={() => composeFileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Paperclip size={13} className={composeModal.uploading ? "animate-spin text-primary" : "text-primary"} />
                    <span>{composeModal.uploading ? "Yükleniyor..." : "Ek Dosya Ekle"}</span>
                  </button>

                  {composeModal.attachedFile && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold truncate max-w-[260px]">
                      <FileText size={13} className="shrink-0" />
                      <span className="truncate">{composeModal.attachedFile.filename}</span>
                      <button
                        type="button"
                        onClick={() => setComposeModal((prev) => ({ ...prev, attachedFile: null }))}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {broadcastError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs flex items-start gap-2 text-rose-700 dark:text-rose-400">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium">{broadcastError}</div>
                  </div>
                )}

                {broadcastResult && (
                  <div
                    className={`p-3 rounded-xl text-xs flex flex-col gap-1 ${
                      broadcastResult.successful > 0 && broadcastResult.failed === 0
                        ? "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                        : broadcastResult.successful > 0
                          ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-400"
                          : "bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <div className="flex items-center gap-2">
                        {broadcastResult.successful > 0 ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                        <span>
                          {broadcastResult.successful > 0 && broadcastResult.failed === 0
                            ? "Kampanya Başarıyla Tamamlandı!"
                            : broadcastResult.successful > 0
                              ? "Kampanya Kısmen Tamamlandı"
                              : "Kampanya Mesajları İletilemedi!"}
                        </span>
                      </div>
                      <span>
                        Başarılı: {broadcastResult.successful} / Toplam: {broadcastResult.total}
                      </span>
                    </div>
                    {broadcastResult.successful === 0 && (
                      <p className="text-[11px] opacity-90 mt-1">
                        Mesajlar WhatsApp API servisine iletilemedi. Lütfen <strong>Sistem Ayarları &gt; Kanal Ayarları</strong> sekmesinden WhatsApp Token ve Phone Number ID bilgilerinizi kontrol ediniz.
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setComposeModal((prev) => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Kapat
                  </button>
                  <button
                    type="submit"
                    disabled={broadcastLoading || composeModal.uploading || !broadcastText.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Send size={13} />
                    <span>{broadcastLoading ? "Gönderiliyor..." : "Kampanyayı Başlat"}</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Quick Contact Picker + Recipient */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="compose-recipient" className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      {composeModal.channel === "email" ? "Alıcı E-Posta Adresi *" : "Alıcı Telefon Numarası *"}
                    </label>
                    <input
                      id="compose-recipient"
                      type="text"
                      autoFocus
                      required
                      value={composeModal.recipient}
                      onChange={(e) => setComposeModal((prev) => ({ ...prev, recipient: e.target.value }))}
                      placeholder={composeModal.channel === "email" ? "musteri@firma.com" : "+905554443322"}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="compose-contact-pick" className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Rehberden Hızlı Seç (Opsiyonel)
                    </label>
                    <select
                      id="compose-contact-pick"
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) setComposeModal((prev) => ({ ...prev, recipient: val }));
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                    >
                      <option value="">Kayıtlı kişi seçin...</option>
                      {contactsList
                        .filter((c) => (composeModal.channel === "email" ? Boolean(c.email) : Boolean(c.phone_number)))
                        .map((c) => {
                          const val = composeModal.channel === "email" ? c.email : c.phone_number;
                          const fullName = `${c.first_name || ""} ${c.last_name || ""}`.trim();
                          return (
                            <option key={c.id} value={val}>
                              {fullName} ({val})
                            </option>
                          );
                        })}
                    </select>
                  </div>
                </div>

                {composeModal.channel === "email" && (
                  <>
                    <div>
                      <label htmlFor="compose-subject" className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        E-Posta Konusu *
                      </label>
                      <input
                        id="compose-subject"
                        type="text"
                        required
                        value={composeModal.subject}
                        onChange={(e) => setComposeModal((prev) => ({ ...prev, subject: e.target.value }))}
                        placeholder="Örn: Teklif ve Hizmet Bilgilendirmesi"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                      />
                    </div>

                    <details className="rounded-xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800 px-3 py-2">
                      <summary className="text-[11px] font-bold text-primary cursor-pointer select-none">
                        CC / BCC Alıcıları Ekle (Opsiyonel)
                      </summary>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
                        <div>
                          <label htmlFor="compose-cc" className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">
                            CC (Bilgi)
                          </label>
                          <input
                            id="compose-cc"
                            type="text"
                            value={composeModal.cc}
                            onChange={(e) => setComposeModal((prev) => ({ ...prev, cc: e.target.value }))}
                            placeholder="ekip@firma.com"
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label htmlFor="compose-bcc" className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">
                            BCC (Gizli)
                          </label>
                          <input
                            id="compose-bcc"
                            type="text"
                            value={composeModal.bcc}
                            onChange={(e) => setComposeModal((prev) => ({ ...prev, bcc: e.target.value }))}
                            placeholder="arsiv@firma.com"
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                    </details>
                  </>
                )}

                <div>
                  <label htmlFor="compose-body" className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    İleti İçeriği *
                  </label>
                  <textarea
                    id="compose-body"
                    rows={5}
                    value={composeModal.text}
                    onChange={(e) => setComposeModal((prev) => ({ ...prev, text: e.target.value }))}
                    placeholder="Mesajınızı buraya yazın..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs leading-relaxed text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Attachment Row */}
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="file"
                    ref={composeFileInputRef}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) await uploadMediaFile(f, true);
                      if (e.target) e.target.value = "";
                    }}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={composeModal.uploading}
                    onClick={() => composeFileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Paperclip size={13} className={composeModal.uploading ? "animate-spin text-primary" : "text-primary"} />
                    <span>{composeModal.uploading ? "Yükleniyor..." : "Ek Dosya Ekle"}</span>
                  </button>

                  {composeModal.attachedFile && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold truncate max-w-[260px]">
                      <FileText size={13} className="shrink-0" />
                      <span className="truncate">{composeModal.attachedFile.filename}</span>
                      <button
                        type="button"
                        onClick={() => setComposeModal((prev) => ({ ...prev, attachedFile: null }))}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {composeModal.error && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2 font-medium">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{composeModal.error}</span>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setComposeModal((prev) => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={composeModal.submitting || composeModal.uploading}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:opacity-90 text-white flex items-center gap-1.5 disabled:opacity-50 shadow-sm cursor-pointer"
                  >
                    <Send size={13} />
                    <span>{composeModal.submitting ? "Gönderiliyor..." : "Gönder"}</span>
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </NativeModalDialog>

      {/* Forward Email Modal (Native <dialog>) */}
      <NativeModalDialog
        isOpen={forwardModal.isOpen}
        onClose={() => setForwardModal((prev) => ({ ...prev, isOpen: false }))}
        labelledBy="forward-email-title"
        maxWidthClass="max-w-xl"
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-left">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-950/30">
            <div className="flex items-center gap-2">
              <CornerDownRight size={18} className="text-primary" />
              <h3 id="forward-email-title" className="text-sm font-bold text-slate-900 dark:text-white">
                E-Postayı Başka Adrese İlet (Forward)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setForwardModal((prev) => ({ ...prev, isOpen: false }))}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Kapat"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleForwardSubmit} className="p-5 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="fwd-to" className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Hedef E-Posta Adresi *
                </label>
                <input
                  id="fwd-to"
                  type="text"
                  autoFocus
                  required
                  value={forwardModal.toEmail}
                  onChange={(e) => setForwardModal((prev) => ({ ...prev, toEmail: e.target.value }))}
                  placeholder="muhasebe@firma.com"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="fwd-cc" className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  CC (Opsiyonel)
                </label>
                <input
                  id="fwd-cc"
                  type="text"
                  value={forwardModal.cc}
                  onChange={(e) => setForwardModal((prev) => ({ ...prev, cc: e.target.value }))}
                  placeholder="yonetici@firma.com"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label htmlFor="fwd-subject" className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Konu
              </label>
              <input
                id="fwd-subject"
                type="text"
                value={forwardModal.subject}
                onChange={(e) => setForwardModal((prev) => ({ ...prev, subject: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label htmlFor="fwd-body" className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Üst Not &amp; İletilen E-Posta Metni
              </label>
              <textarea
                id="fwd-body"
                rows={7}
                value={forwardModal.bodyText}
                onChange={(e) => setForwardModal((prev) => ({ ...prev, bodyText: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs leading-relaxed text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
              />
            </div>

            {forwardModal.mediaFilename && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold">
                <FileText size={14} />
                <span>Orijinal ek dosya da iletilecek: {forwardModal.mediaFilename}</span>
              </div>
            )}

            {forwardModal.error && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2 font-medium">
                <AlertCircle size={15} className="shrink-0" />
                <span>{forwardModal.error}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setForwardModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={forwardModal.submitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:opacity-90 text-white flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
              >
                <Send size={13} />
                <span>{forwardModal.submitting ? "İletiliyor..." : "E-Postayı İlet"}</span>
              </button>
            </div>
          </form>
        </div>
      </NativeModalDialog>

      {/* QA Coaching Report Modal (Native <dialog>) */}
      <NativeModalDialog
        isOpen={showQAReport}
        onClose={() => setShowQAReport(false)}
        labelledBy="qa-report-modal-title"
        maxWidthClass="max-w-lg"
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-left">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-950/30">
            <div className="flex items-center gap-2">
              <Award size={18} className="text-amber-500" />
              <h3 id="qa-report-modal-title" className="text-sm font-bold text-slate-900 dark:text-white">
                Otomatik Kalite &amp; Koçluk Raporu (QA)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowQAReport(false)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Kapat"
            >
              <X size={16} />
            </button>
          </div>
          <div className="p-5 space-y-4">
            {qaData.loading ? (
              <div className="py-8 text-center text-xs text-slate-400 font-bold animate-pulse">QA raporu yükleniyor...</div>
            ) : qaData.score === null && !qaData.report ? (
              <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <p className="font-bold">Bu görüşme için henüz QA değerlendirmesi oluşturulmamış.</p>
                <p className="text-[11px] text-slate-400">Temsilci veya AI yanıtlarından sonra kalite puanı otomatik hesaplanır.</p>
              </div>
            ) : (
              <>
                {qaData.score !== null && (
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Toplam Kalite Puanı</span>
                    <span className="text-lg font-black text-amber-600 dark:text-amber-400">{qaData.score} / 100</span>
                  </div>
                )}
                {qaData.report && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap max-h-72 overflow-y-auto">
                    {qaData.report}
                  </div>
                )}
              </>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => setShowQAReport(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      </NativeModalDialog>

      {/* Blacklist Sender Confirmation Modal (Native <dialog>) */}
      <NativeModalDialog
        isOpen={blacklistModal.isOpen}
        onClose={() => setBlacklistModal((prev) => ({ ...prev, isOpen: false }))}
        labelledBy="blacklist-sender-title"
        maxWidthClass="max-w-md"
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-left">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-950/30">
            <div className="flex items-center gap-2">
              <Ban size={17} className="text-rose-500" />
              <h3 id="blacklist-sender-title" className="text-sm font-bold text-slate-900 dark:text-white">
                Göndericiyi Kara Listeye Al
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setBlacklistModal((prev) => ({ ...prev, isOpen: false }))}
              className="p-1 text-slate-400 hover:text-slate-600"
              aria-label="Kapat"
            >
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleConfirmBlacklist} className="p-5 space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong>{activeSession?.sender_info}</strong> adresini/numarasını engellemek üzeresiniz. Kara listeye alınan göndericilerden gelen iletiler otomatik reddedilir.
            </p>
            <div>
              <label htmlFor="bl-reason" className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Engelleme Nedeni
              </label>
              <input
                id="bl-reason"
                type="text"
                value={blacklistModal.reason}
                onChange={(e) => setBlacklistModal((prev) => ({ ...prev, reason: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>
            {blacklistModal.error && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-400">
                {blacklistModal.error}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setBlacklistModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={blacklistModal.loading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50"
              >
                {blacklistModal.loading ? "Engelleniyor..." : "Kara Listeye Ekle"}
              </button>
            </div>
          </form>
        </div>
      </NativeModalDialog>

      {/* WhatsApp HSM Template Message Modal */}
      <NativeModalDialog
        isOpen={Boolean(showTemplateModal && activeSession)}
        onClose={() => setShowTemplateModal(false)}
        labelledBy="hsm-template-modal-title"
        maxWidthClass="max-w-lg"
      >
        {activeSession && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full p-6 shadow-2xl text-left">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 id="hsm-template-modal-title" className="text-sm font-bold text-slate-900 dark:text-white">
                    Meta Onaylı Şablon Mesajı (HSM)
                  </h3>
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                    24 saatlik müşteri iletişim penceresi dışında mesaj başlatın
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                aria-label="Kapat"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendTemplateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">
                  Müşteri Telefon Numarası
                </label>
                <input
                  type="text"
                  readOnly
                  value={activeSession.sender_info}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">
                  Şablon Seçin
                </label>
                <select
                  value={selectedTemplate?.id || selectedTemplate?.name || ""}
                  onChange={(e) => {
                    const tpl = availableTemplates.find((t) => (t.id || t.name) === e.target.value);
                    if (tpl) handleSelectTemplate(tpl);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary font-semibold"
                >
                  {availableTemplates.map((t) => (
                    <option key={t.id || t.name} value={t.id || t.name} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                      {t.display_name || t.name} ({t.category || "UTILITY"})
                    </option>
                  ))}
                </select>
              </div>

              {selectedTemplate && (
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500">
                    <span>Canlı Şablon Önizleme</span>
                    <span className="uppercase text-primary">{selectedTemplate.language || "tr"}</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 font-medium leading-relaxed bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    {(() => {
                      let preview = selectedTemplate.body_text || selectedTemplate.name;
                      (selectedTemplate.parameters || []).forEach((_, idx) => {
                        const val = templateParamValues[idx] || `{{${idx + 1}}}`;
                        preview = preview.replace(`{{${idx + 1}}}`, val);
                      });
                      return preview;
                    })()}
                  </p>
                </div>
              )}

              {selectedTemplate && selectedTemplate.parameters && selectedTemplate.parameters.length > 0 && (
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Şablon Parametreleri
                  </label>
                  {selectedTemplate.parameters.map((paramLabel, idx) => (
                    <div key={idx}>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                        {paramLabel} <span className="text-primary">({`{{${idx + 1}}}`})</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={templateParamValues[idx] || ""}
                        onChange={(e) => {
                          const newVals = [...templateParamValues];
                          newVals[idx] = e.target.value;
                          setTemplateParamValues(newVals);
                        }}
                        placeholder={`${paramLabel} değerini giriniz...`}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                  ))}
                </div>
              )}

              {templateError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs flex items-center gap-2 text-rose-700 dark:text-rose-400">
                  <AlertCircle size={16} className="shrink-0" />
                  <span className="font-medium">{templateError}</span>
                </div>
              )}

              {templateSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle size={16} className="shrink-0" />
                  <span className="font-medium">{templateSuccess}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={templateLoading || !selectedTemplate}
                  className="px-4 py-2 bg-primary hover:opacity-90 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  <Send size={14} />
                  {templateLoading ? "Gönderiliyor..." : "Şablonu Gönder (HSM)"}
                </button>
              </div>
            </form>
          </div>
        )}
      </NativeModalDialog>
    </div>
  );
}
