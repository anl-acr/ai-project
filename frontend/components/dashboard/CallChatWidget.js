import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Phone,
  PhoneOff,
  ShieldAlert,
  Wifi,
  WifiOff,
  X,
  PhoneCall,
  Radio,
  Fingerprint,
  CheckCircle,
  AlertTriangle,
  Mic,
  MicOff,
  Pause,
  Play,
  PhoneForwarded,
  UserPlus,
  Grid,
  Maximize2,
  Minimize2,
  Bell,
  BellRing,
  Search,
  Users,
  Delete,
  PhoneIncoming
} from "lucide-react";
import { findContactByPhone, maskPhoneLast4 } from "../../utils/contactUtils";
import { webphoneManager } from "../../utils/webphoneManager";
import LiveTranslatorPanel from "../phone/LiveTranslatorPanel";
import { useTheme } from "../../utils/theme";

function generateCallFaviconDataUrl(bgColor = "#10b981", ringColor = "#ffffff") {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Outer glow ring
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fillStyle = bgColor;
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = ringColor;
    ctx.stroke();

    // Phone receiver icon symbol in center
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✆", 32, 34);

    return canvas.toDataURL("image/png");
  } catch (e) {
    return null;
  }
}

export default function CallChatWidget({
  onActiveCall = () => {},
  backendHost = "localhost:8000",
  currentUser
}) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();

  const [contacts, setContacts] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [rolePermissions, setRolePermissions] = useState(null);

  // Expanded/Collapsed State
  const [isOpen, setIsOpen] = useState(false);

  // Sub-panels inside Mini Softphone during active call or idle
  const [activeSubPanel, setActiveSubPanel] = useState(null); // null | "keypad" | "transfer" | "new_line"
  const [transferSearch, setTransferSearch] = useState("");
  const [transferTarget, setTransferTarget] = useState("");
  const [newLineTarget, setNewLineTarget] = useState("");
  const [idleSearch, setIdleSearch] = useState("");
  const [showIdleKeypad, setShowIdleKeypad] = useState(false);

  // Desktop Notification Permission State
  const [notifPermission, setNotifPermission] = useState(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "unsupported";
  });

  // Shared WebPhone Manager State
  const [wpState, setWpState] = useState(() => webphoneManager.getState());
  const {
    isLoadingConfig,
    webrtcConfig,
    registered,
    callStatus,
    dialNumber,
    remoteNumber,
    remoteDisplayName,
    callDuration,
    isMuted,
    isOnHold,
    error,
    activeSipCallId,
    isWebphoneScreenActive,
    lines = [],
    activeLineId,
    isConferenceActive,
    attendedTransferPending,
    groupRingingCalls = []
  } = wpState;

  const agentExtension = webrtcConfig?.agentExtension || currentUser?.extension || "";
  const API_BASE =
    typeof window !== "undefined" ? `${window.location.protocol}//${backendHost}` : `http://${backendHost}`;

  // Refs for Desktop Notifications & Tab Title / Favicon
  const activeDesktopNotifRef = useRef(null);
  const groupDesktopNotifRef = useRef(null);
  const originalTitleRef = useRef(null);
  const originalFaviconRef = useRef(null);
  const titleFlashTimerRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.role) return;
    fetch(`${API_BASE}/api/settings/roles`)
      .then((r) => (r.ok ? r.json() : []))
      .then((roles) => {
        if (Array.isArray(roles)) {
          const matched = roles.find((item) => item.id === currentUser.role);
          if (matched && Array.isArray(matched.permissions)) {
            setRolePermissions(matched.permissions);
          }
        }
      })
      .catch(() => {});
  }, [currentUser?.role, API_BASE]);

  const hasWebphoneSubPerms =
    Array.isArray(rolePermissions) &&
    rolePermissions.some((p) => p.startsWith("call_panel:webphone_") || p === "call_panel:listen_records");
  const canRejectCall =
    currentUser?.role === "admin" && !hasWebphoneSubPerms
      ? true
      : !hasWebphoneSubPerms
      ? true
      : rolePermissions.includes("call_panel:webphone_reject");
  const canTransfer =
    currentUser?.role === "admin" && !hasWebphoneSubPerms
      ? true
      : !hasWebphoneSubPerms
      ? true
      : rolePermissions.includes("call_panel:webphone_transfer");
  const canConference =
    currentUser?.role === "admin" && !hasWebphoneSubPerms
      ? true
      : !hasWebphoneSubPerms
      ? true
      : rolePermissions.includes("call_panel:webphone_conference");
  const maskPhoneNumbers = Array.isArray(rolePermissions) && rolePermissions.includes("call_panel:webphone_mask_number");
  const isRoleAdmin = String(currentUser?.role || "").toLowerCase() === "admin";
  const canLiveTranslate =
    isRoleAdmin ||
    Boolean(
      Array.isArray(rolePermissions) &&
        (rolePermissions.includes("call_panel:live_translation") ||
          rolePermissions.includes("live_translator:access") ||
          rolePermissions.includes("live_translator"))
    );
  const canVoiceInterpret =
    isRoleAdmin ||
    Boolean(
      Array.isArray(rolePermissions) &&
        (rolePermissions.includes("call_panel:voice_interpreter") ||
          rolePermissions.includes("live_translator:access") ||
          rolePermissions.includes("live_translator"))
    );

  // Voice Biometric States
  const [biometricStatus, setBiometricStatus] = useState(null);
  const [savingVoiceprint, setSavingVoiceprint] = useState(false);

  const prevCallStatusRef = useRef(callStatus);
  const prevWebphoneScreenRef = useRef(isWebphoneScreenActive);

  useEffect(() => {
    const unsub = webphoneManager.subscribe((state) => {
      setWpState({ ...state });
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (backendHost || currentUser) {
      webphoneManager.init({ backendHost, currentUser });
    }
  }, [backendHost, currentUser]);

  // Request Desktop Notification permission on first user interaction if still "default"
  const requestDesktopNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    } catch (e) {}
  };

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setNotifPermission(Notification.permission);
    if (Notification.permission === "default") {
      const handleFirstInteraction = () => {
        if (Notification.permission === "default") {
          Notification.requestPermission()
            .then((p) => setNotifPermission(p))
            .catch(() => {});
        }
        window.removeEventListener("click", handleFirstInteraction);
      };
      window.addEventListener("click", handleFirstInteraction, { once: true });
      return () => window.removeEventListener("click", handleFirstInteraction);
    }
  }, []);

  // Notify parent when activeSipCallId changes
  useEffect(() => {
    onActiveCall(activeSipCallId || null);
  }, [activeSipCallId]);

  // Reset sub-panels when call returns to Idle
  useEffect(() => {
    if (callStatus === "Idle") {
      setActiveSubPanel(null);
      setTransferTarget("");
      setTransferSearch("");
      setNewLineTarget("");
    }
  }, [callStatus]);

  // Seamless transition between WebPhone screen and Floating Mini Softphone during active calls
  useEffect(() => {
    const wasIdle = prevCallStatusRef.current === "Idle";
    const isNowActive = callStatus !== "Idle";
    const wasOnWebphone = prevWebphoneScreenRef.current;
    const isNowOnWebphone = isWebphoneScreenActive;

    // 1. If a call starts/arrives while NOT on the WebPhone screen -> open Mini Softphone
    if (wasIdle && isNowActive && !isNowOnWebphone) {
      setIsOpen(true);
    }
    // 2. If user switches AWAY from WebPhone screen while a call is active -> open Mini Softphone immediately
    else if (isNowActive && wasOnWebphone && !isNowOnWebphone) {
      setIsOpen(true);
    }
    // 3. If user switches BACK to WebPhone screen while a call is active -> collapse Mini Softphone
    else if (isNowActive && !wasOnWebphone && isNowOnWebphone) {
      setIsOpen(false);
    }

    prevCallStatusRef.current = callStatus;
    prevWebphoneScreenRef.current = isWebphoneScreenActive;
  }, [callStatus, isWebphoneScreenActive]);

  // Auto-Focus Mini Softphone when user returns to browser tab during an active or ringing call
  useEffect(() => {
    const handleTabReturnFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const st = webphoneManager.getState();
      const hasActiveOrRinging =
        st.callStatus !== "Idle" || (Array.isArray(st.groupRingingCalls) && st.groupRingingCalls.length > 0);
      if (hasActiveOrRinging && !st.isWebphoneScreenActive) {
        setIsOpen(true);
      }
    };
    window.addEventListener("focus", handleTabReturnFocus);
    document.addEventListener("visibilitychange", handleTabReturnFocus);
    return () => {
      window.removeEventListener("focus", handleTabReturnFocus);
      document.removeEventListener("visibilitychange", handleTabReturnFocus);
    };
  }, []);

  // Open popup visually & show OS Desktop Notification when a phone in the subscriber group starts ringing
  useEffect(() => {
    const handleGroupRinging = (e) => {
      const list = e?.detail;
      if (Array.isArray(list) && list.length > 0) {
        if (!webphoneManager.getState().isWebphoneScreenActive) {
          setIsOpen(true);
        }
        const first = list[0];
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            if (groupDesktopNotifRef.current) {
              groupDesktopNotifRef.current.close();
            }
            const callerStr = first.caller_name
              ? `${first.caller_name} (${first.caller_number || ""})`
              : first.caller_number || "Bilinmeyen Numara";
            const notif = new Notification(`🔔 Grubunuzda Çağrı Var (Dahili ${first.ringing_extension})`, {
              body: `Arayan: ${callerStr}\nÇağrıyı ekranınızdan çekebilirsiniz.`,
              tag: `aida-group-ring-${first.ringing_extension}`,
              requireInteraction: true
            });
            notif.onclick = () => {
              try {
                window.focus();
                setIsOpen(true);
                notif.close();
              } catch (err) {}
            };
            groupDesktopNotifRef.current = notif;
          } catch (err) {}
        }
      }
    };
    window.addEventListener("GROUP_CALL_RINGING", handleGroupRinging);
    return () => window.removeEventListener("GROUP_CALL_RINGING", handleGroupRinging);
  }, []);

  // Close group ringing desktop notification when groupRingingCalls empties
  useEffect(() => {
    if ((!Array.isArray(groupRingingCalls) || groupRingingCalls.length === 0) && groupDesktopNotifRef.current) {
      try {
        groupDesktopNotifRef.current.close();
      } catch (e) {}
      groupDesktopNotifRef.current = null;
    }
  }, [groupRingingCalls]);

  // Fetch contacts and internal directory
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const [contactsRes, dirRes] = await Promise.all([
          fetch(`${API_BASE}/api/contacts`),
          fetch(`${API_BASE}/api/agent/directory?t=${Date.now()}`)
        ]);
        if (contactsRes.ok) {
          const cData = await contactsRes.json();
          setContacts(Array.isArray(cData) ? cData : []);
        }
        if (dirRes.ok) {
          const dData = await dirRes.json();
          setDirectory(Array.isArray(dData) ? dData : []);
        }
      } catch (err) {}
    };
    fetchContacts();
    const timer = setInterval(fetchContacts, 5000);
    window.addEventListener("CONTACTS_UPDATED", fetchContacts);
    return () => {
      clearInterval(timer);
      window.removeEventListener("CONTACTS_UPDATED", fetchContacts);
    };
  }, [API_BASE]);

  const formatSeconds = (sec) => {
    const mins = Math.floor((sec || 0) / 60);
    const secs = (sec || 0) % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const callerNum = remoteNumber || dialNumber || "";
  const rawSipName = (remoteDisplayName || "").replace(/^"|"$/g, "").trim();
  const matchedCaller = callerNum ? findContactByPhone(callerNum, contacts, directory) : null;
  const callerDisplayName =
    matchedCaller?.displayName || (rawSipName && rawSipName !== callerNum ? rawSipName : "");
  const callerAvatar = matchedCaller?.avatar_url || matchedCaller?.avatar || null;
  const displayCallerNum = maskPhoneLast4(callerNum, maskPhoneNumbers);
  const callerSummaryLabel = callerDisplayName
    ? `${callerDisplayName} (${displayCallerNum || callerNum})`
    : displayCallerNum || callerNum || "Bilinmeyen Numara";

  // Native OS Desktop Notification for Incoming Calls (Ringing)
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (callStatus === "Ringing") {
      if (Notification.permission === "granted") {
        try {
          if (activeDesktopNotifRef.current) {
            activeDesktopNotifRef.current.close();
          }
          const notif = new Notification(`📞 Gelen Çağrı: ${callerDisplayName || displayCallerNum || "Bilinmeyen"}`, {
            body: `${
              callerDisplayName && displayCallerNum ? `Numara: ${displayCallerNum}\n` : ""
            }Dahili ${agentExtension} hattınıza çağrı geliyor. Pencereyi öne getirmek için tıklayın.`,
            tag: "aida-incoming-call",
            requireInteraction: true
          });
          notif.onclick = () => {
            try {
              window.focus();
              setIsOpen(true);
              window.dispatchEvent(new CustomEvent("OPEN_FULL_WEBPHONE"));
              notif.close();
            } catch (e) {}
          };
          activeDesktopNotifRef.current = notif;
        } catch (e) {}
      }
    } else {
      if (activeDesktopNotifRef.current) {
        try {
          activeDesktopNotifRef.current.close();
        } catch (e) {}
        activeDesktopNotifRef.current = null;
      }
    }
  }, [callStatus, callerDisplayName, displayCallerNum, agentExtension]);

  // Flashing Tab Title & Dynamic Favicon for Ringing / Calling / InCall
  useEffect(() => {
    if (typeof document === "undefined") return;

    if (!originalTitleRef.current) {
      originalTitleRef.current = document.title || "AIDA — Kurumsal İletişim Platformu";
    }
    const existingIconEl = document.querySelector("link[rel*='icon']");
    if (existingIconEl && originalFaviconRef.current === null) {
      originalFaviconRef.current = existingIconEl.getAttribute("href") || "/favicon.ico";
    }

    const setFaviconHref = (href) => {
      if (!href) return;
      let link = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = href;
    };

    if (titleFlashTimerRef.current) {
      clearInterval(titleFlashTimerRef.current);
      titleFlashTimerRef.current = null;
    }

    const shortCaller = callerDisplayName || displayCallerNum || "Bilinmeyen";

    if (callStatus === "Ringing") {
      let toggle = false;
      const redIcon = generateCallFaviconDataUrl("#e11d48", "#fde047");
      const amberIcon = generateCallFaviconDataUrl("#f59e0b", "#ffffff");
      const updateRingingTitle = () => {
        toggle = !toggle;
        document.title = toggle
          ? `🔴 📞 GELEN ÇAĞRI: ${shortCaller}`
          : `⚠️ YANIT BEKLİYOR! (${shortCaller})`;
        setFaviconHref(toggle ? redIcon : amberIcon);
      };
      updateRingingTitle();
      titleFlashTimerRef.current = setInterval(updateRingingTitle, 750);
    } else if (callStatus === "Calling") {
      document.title = `🟠 📞 Aranıyor: ${shortCaller}`;
      const amberIcon = generateCallFaviconDataUrl("#f59e0b", "#ffffff");
      setFaviconHref(amberIcon);
    } else if (callStatus === "InCall") {
      document.title = `🟢 [${formatSeconds(callDuration)}] Görüşmede: ${shortCaller}`;
      const greenIcon = generateCallFaviconDataUrl("#10b981", "#ffffff");
      setFaviconHref(greenIcon);
    } else {
      if (originalTitleRef.current) {
        document.title = originalTitleRef.current;
      }
      if (originalFaviconRef.current) {
        setFaviconHref(originalFaviconRef.current);
      }
    }

    return () => {
      if (titleFlashTimerRef.current) {
        clearInterval(titleFlashTimerRef.current);
        titleFlashTimerRef.current = null;
      }
    };
  }, [callStatus, callDuration, callerDisplayName, displayCallerNum]);

  // Live Voice Biometric & Deepfake Polling Hook
  useEffect(() => {
    let bioInterval = null;
    if (callStatus === "InCall") {
      const fetchBiometrics = async () => {
        try {
          const activeCallRes = await fetch(`${API_BASE}/api/calls/active`);
          if (!activeCallRes.ok) return;
          const activeCallData = await activeCallRes.json();
          const currentCall =
            activeCallData.find(
              (c) =>
                c.caller_number === agentExtension ||
                c.callee_number === agentExtension ||
                c.channel?.toLowerCase().includes(`sip/${agentExtension}`)
            ) || activeCallData[0];

          if (currentCall) {
            const bioRes = await fetch(`${API_BASE}/api/calls/active/biometrics/${currentCall.id}`);
            if (bioRes.ok) {
              const bioData = await bioRes.json();
              setBiometricStatus(bioData);
            }
          }
        } catch (err) {}
      };
      fetchBiometrics();
      bioInterval = setInterval(fetchBiometrics, 2500);
    } else {
      setBiometricStatus(null);
    }
    return () => {
      if (bioInterval) clearInterval(bioInterval);
    };
  }, [callStatus, agentExtension, API_BASE]);

  const handleSaveVoiceprint = async () => {
    if (!biometricStatus || !biometricStatus.caller_number) return;
    setSavingVoiceprint(true);
    try {
      await fetch(`${API_BASE}/api/contacts/${biometricStatus.caller_number}/voiceprint/register`, {
        method: "POST"
      });
    } catch (err) {
    } finally {
      setSavingVoiceprint(false);
    }
  };

  // Softphone actions
  const answerCall = () => webphoneManager.answerCall();
  const hangupCall = () => {
    webphoneManager.hangupCall();
    onActiveCall(null);
  };
  const toggleMute = () => webphoneManager.toggleMute();
  const toggleHold = () => webphoneManager.toggleHold();

  const handleOpenFullScreenWebphone = () => {
    window.dispatchEvent(new CustomEvent("OPEN_FULL_WEBPHONE"));
    setIsOpen(false);
  };

  const handleDtmfPress = (digit) => {
    if (callStatus === "InCall") {
      webphoneManager.sendDtmf(digit);
    } else {
      webphoneManager.setDialNumber((webphoneManager.getState().dialNumber || "") + String(digit));
    }
  };

  const handleStartCallFromWidget = (targetNum) => {
    const clean = String(targetNum || dialNumber || "").trim();
    if (!clean) return;
    const match = findContactByPhone(clean, contacts, directory);
    webphoneManager.makeCall(clean, { displayName: match?.displayName || "" });
  };

  const handleBlindTransfer = async (targetNum = transferTarget) => {
    const clean = String(targetNum || "").trim();
    if (!clean) return;
    const match = findContactByPhone(clean, contacts, directory);
    await webphoneManager.blindTransfer(clean, match?.displayName || "");
    setActiveSubPanel(null);
    setTransferTarget("");
  };

  const handleAttendedTransfer = async (targetNum = transferTarget) => {
    const clean = String(targetNum || "").trim();
    if (!clean) return;
    const match = findContactByPhone(clean, contacts, directory);
    await webphoneManager.startAttendedTransfer(clean, match?.displayName || "");
    setActiveSubPanel(null);
    setTransferTarget("");
  };

  const handleStartSecondLine = async (autoConf = false) => {
    const clean = String(newLineTarget || "").trim();
    if (!clean) return;
    const match = findContactByPhone(clean, contacts, directory);
    if (autoConf) {
      await webphoneManager.addParticipantToConference(clean, match?.displayName || "");
    } else {
      await webphoneManager.makeCall(clean, { displayName: match?.displayName || "" });
    }
    setActiveSubPanel(null);
    setNewLineTarget("");
  };

  // Handle action triggers from external panels
  useEffect(() => {
    const handleSoftphoneAction = (e) => {
      const { type, target, mode } = e.detail;
      if (type === "hangup") {
        hangupCall();
      } else if (type === "hold") {
        webphoneManager.toggleHold();
      } else if (type === "transfer") {
        if (mode === "blind") {
          webphoneManager.blindTransfer(target);
        } else if (mode === "complete") {
          webphoneManager.completeAttendedTransfer();
        } else {
          webphoneManager.startAttendedTransfer(target);
        }
      } else if (type === "conference") {
        if (target) {
          webphoneManager.addParticipantToConference(target);
        } else {
          webphoneManager.startConference();
        }
      }
    };
    window.addEventListener("softphone-action", handleSoftphoneAction);
    return () => window.removeEventListener("softphone-action", handleSoftphoneAction);
  }, []);

  // Combined internal users + contacts for Transfer & Idle Quick Dial
  const combinedDirectoryList = useMemo(() => {
    const internals = (Array.isArray(directory) ? directory : [])
      .filter((d) => d.type === "user" && String(d.extension) !== String(agentExtension))
      .map((d) => ({
        id: `int-${d.extension}`,
        name: d.full_name || d.name || `Dahili ${d.extension}`,
        number: String(d.extension || ""),
        isInternal: true,
        callState: d.call_state || (d.is_registered ? "online" : "offline")
      }));
    const externals = (Array.isArray(contacts) ? contacts : []).slice(0, 25).map((c) => ({
      id: `ext-${c.id}`,
      name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.phone_number,
      number: String(c.phone_number || ""),
      isInternal: false,
      callState: null
    }));
    return [...internals, ...externals];
  }, [directory, contacts, agentExtension]);

  const filteredTransferList = useMemo(() => {
    const q = (transferSearch || transferTarget || "").toLowerCase().trim();
    if (!q) return combinedDirectoryList.slice(0, 8);
    return combinedDirectoryList
      .filter((item) => item.name.toLowerCase().includes(q) || item.number.toLowerCase().includes(q))
      .slice(0, 8);
  }, [combinedDirectoryList, transferSearch, transferTarget]);

  const filteredIdleList = useMemo(() => {
    const q = (idleSearch || dialNumber || "").toLowerCase().trim();
    if (!q) return combinedDirectoryList.slice(0, 6);
    return combinedDirectoryList
      .filter((item) => item.name.toLowerCase().includes(q) || item.number.toLowerCase().includes(q))
      .slice(0, 6);
  }, [combinedDirectoryList, idleSearch, dialNumber]);

  const isCallActive = callStatus !== "Idle";

  return (
    <div className="fixed bottom-5 right-5 z-[9999] font-sans antialiased">
      {/* =====================================================================
          1. COLLAPSED MODE: Interactive Live Call Bar OR Idle Status Pill
         ===================================================================== */}
      {!isOpen && (
        <div>
          {isCallActive ? (
            /* Active / Ringing Call Interactive Mini Bar */
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md transition-all duration-300 ${
                callStatus === "Ringing"
                  ? "bg-amber-500/95 text-white border-amber-300 ring-4 ring-amber-500/30 animate-pulse"
                  : "bg-slate-900/95 dark:bg-slate-900/95 text-white border-emerald-500/50 ring-2 ring-emerald-500/20"
              }`}
            >
              <div
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-3 cursor-pointer pr-2 min-w-[160px] max-w-[260px]"
                title="Mini Softphone Penceresini Aç"
              >
                <span className="relative flex h-3 w-3 shrink-0">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      callStatus === "Ringing" ? "bg-white" : "bg-emerald-400"
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-3 w-3 ${
                      callStatus === "Ringing" ? "bg-white" : "bg-emerald-500"
                    }`}
                  />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-90">
                      {callStatus === "Ringing"
                        ? "Gelen Çağrı"
                        : callStatus === "Calling"
                        ? "Aranıyor..."
                        : isOnHold
                        ? "Beklemede"
                        : "Görüşmede"}
                    </span>
                    {callStatus === "InCall" && (
                      <span className="font-mono text-xs font-black bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded">
                        {formatSeconds(callDuration)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-extrabold truncate">{callerSummaryLabel}</p>
                </div>
              </div>

              {/* Quick Inline Action Buttons on Collapsed Bar */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-white/20">
                {callStatus === "Ringing" ? (
                  <>
                    <button
                      type="button"
                      onClick={answerCall}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-xs flex items-center gap-1 shadow-md"
                      title="Çağrıyı Cevapla"
                    >
                      <Phone size={13} className="fill-current" />
                      Cevapla
                    </button>
                    {canRejectCall && (
                      <button
                        type="button"
                        onClick={hangupCall}
                        className="p-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-md"
                        title="Çağrıyı Reddet"
                      >
                        <PhoneOff size={14} />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {callStatus === "InCall" && (
                      <>
                        <button
                          type="button"
                          onClick={toggleMute}
                          className={`p-1.5 rounded-xl transition-colors ${
                            isMuted ? "bg-rose-500 text-white" : "bg-white/10 hover:bg-white/20 text-white"
                          }`}
                          title={isMuted ? "Mikrofonu Aç" : "Mikrofonu Kapat"}
                        >
                          {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={toggleHold}
                          className={`p-1.5 rounded-xl transition-colors ${
                            isOnHold ? "bg-amber-500 text-white" : "bg-white/10 hover:bg-white/20 text-white"
                          }`}
                          title={isOnHold ? "Görüşmeye Devam Et" : "Beklemeye Al"}
                        >
                          {isOnHold ? <Play size={14} /> : <Pause size={14} />}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={hangupCall}
                      className="p-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-md"
                      title="Çağrıyı Kapat"
                    >
                      <PhoneOff size={14} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(true)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white ml-0.5"
                  title="Mini Softphone Penceresini Aç"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            </div>
          ) : (
            /* Idle Pill Button */
            <div
              onClick={() => !isLoadingConfig && setIsOpen(true)}
              className={`flex items-center gap-3 px-4 py-2.5 bg-white/95 dark:bg-slate-900/95 border ${borderLight} rounded-full text-slate-800 dark:text-white shadow-xl ${
                isLoadingConfig
                  ? "cursor-wait opacity-70"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800 hover:shadow-2xl cursor-pointer"
              } transition-all duration-300 select-none backdrop-blur-md font-bold text-xs`}
            >
              <span className="relative flex h-2.5 w-2.5">
                {isLoadingConfig ? (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-300 dark:bg-slate-600 animate-pulse" />
                ) : groupRingingCalls.length > 0 ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                  </>
                ) : registered ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                )}
              </span>

              <span className="tracking-wide">
                {isLoadingConfig
                  ? "Bağlanıyor..."
                  : groupRingingCalls.length > 0
                  ? `Grubunda Çağrı Var (Dahili ${groupRingingCalls[0].ringing_extension})`
                  : registered
                  ? `WebPhone • Dahili ${agentExtension}`
                  : `Dahili ${agentExtension || "X"} (Bağlı Değil)`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          2. EXPANDED MODE: Full-Featured Mini Softphone Window
         ===================================================================== */}
      {isOpen && (
        <div
          className={`w-[390px] sm:w-[410px] max-h-[85vh] bg-white dark:bg-slate-900 border ${borderLight} rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 animate-in fade-in slide-in-from-bottom-4`}
        >
          {/* Header */}
          <div className={`px-4 py-3 ${bg} text-white flex items-center justify-between shadow-sm shrink-0`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                {registered ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-300" />
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-300" />
                )}
              </span>
              <div className="truncate">
                <h4 className="font-extrabold text-xs tracking-wider uppercase truncate">
                  Mini Softphone • Dahili {agentExtension}
                </h4>
                <p className="text-[10px] text-white/80 font-medium truncate">
                  {callStatus === "Ringing"
                    ? "Gelen Çağrı Bekliyor..."
                    : callStatus === "Calling"
                    ? "Çağrı Başlatılıyor..."
                    : callStatus === "InCall"
                    ? `Aktif Görüşme (${formatSeconds(callDuration)})`
                    : registered
                    ? "Santrale Bağlı (Hazır)"
                    : "Bağlantı Bekleniyor"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {notifPermission === "default" && (
                <button
                  type="button"
                  onClick={requestDesktopNotificationPermission}
                  className="p-1.5 text-white/85 hover:text-white rounded-xl hover:bg-white/15 transition-colors"
                  title="Masaüstü Çağrı Bildirimlerini Etkinleştir"
                >
                  <Bell size={14} />
                </button>
              )}
              {notifPermission === "granted" && (
                <span
                  className="p-1.5 text-emerald-200/90"
                  title="Masaüstü Çağrı Bildirimleri Açık"
                >
                  <BellRing size={13} />
                </span>
              )}
              <button
                type="button"
                onClick={handleOpenFullScreenWebphone}
                className="px-2 py-1 text-[10px] font-extrabold bg-white/15 hover:bg-white/25 text-white rounded-xl flex items-center gap-1 transition-colors"
                title="Tam Ekran Çağrı Paneline Git"
              >
                <Maximize2 size={12} />
                <span>Tam Ekran</span>
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-white/80 hover:text-white rounded-xl hover:bg-white/15 transition-colors"
                title="Küçült"
              >
                <Minimize2 size={15} />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-white dark:bg-slate-900">
            {/* Group Ringing Visual Alert (Pickup) */}
            {Array.isArray(groupRingingCalls) && groupRingingCalls.length > 0 && (
              <div className="space-y-2">
                {groupRingingCalls.map((rc) => {
                  const rcCallerMasked = maskPhoneLast4(rc.caller_number || "Bilinmeyen", maskPhoneNumbers);
                  const rcCallerDisplay = rc.caller_name
                    ? `${rc.caller_name} (${rcCallerMasked})`
                    : rcCallerMasked || "Bilinmeyen Numara";
                  return (
                    <div
                      key={`${rc.ringing_extension}_${rc.caller_number}`}
                      className="p-3 rounded-2xl border-2 border-amber-400 dark:border-amber-500 bg-amber-50/90 dark:bg-amber-950/40 shadow-sm space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <PhoneIncoming size={14} className="text-amber-600 animate-bounce" />
                          <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                            Grubunda Çağrı Var (Dahili {rc.ringing_extension})
                          </span>
                        </div>
                        {rc.group_name && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 truncate">
                            {rc.group_name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 truncate">
                        Arayan: {rcCallerDisplay}
                      </p>
                      <button
                        type="button"
                        onClick={() => webphoneManager.pickupGroupCall(rc)}
                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                      >
                        <Phone size={13} /> Çağrıyı Çek ({rc.ringing_extension})
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Multi-line switcher when 2+ lines exist */}
            {Array.isArray(lines) && lines.length > 1 && (
              <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500">
                    Aktif Hatlar ({lines.length})
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => webphoneManager.swapLines()}
                      className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-200"
                    >
                      Hat Değiştir
                    </button>
                    {canTransfer && (
                      <button
                        type="button"
                        onClick={() => webphoneManager.completeAttendedTransfer()}
                        className="px-2 py-0.5 rounded-lg bg-violet-600 text-[10px] font-bold text-white"
                      >
                        Birleştir & Aktar
                      </button>
                    )}
                    {canConference && (
                      <button
                        type="button"
                        onClick={() =>
                          isConferenceActive
                            ? webphoneManager.stopConference()
                            : webphoneManager.startConference()
                        }
                        className="px-2 py-0.5 rounded-lg bg-emerald-600 text-[10px] font-bold text-white"
                      >
                        {isConferenceActive ? "Konf. Ayır" : "Konferans"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {lines.map((l) => (
                    <div
                      key={l.id}
                      onClick={() => webphoneManager.switchLine(l.id)}
                      className={`cursor-pointer px-2.5 py-1.5 rounded-xl border text-xs flex items-center justify-between ${
                        l.id === activeLineId
                          ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 font-bold text-slate-800 dark:text-white"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <span className="truncate">
                        Hat {l.lineNumber}: {l.remoteDisplayName || l.remoteNumber}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                        {isConferenceActive ? "Konf." : l.isOnHold ? "Beklemede" : "Aktif"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ==============================================================
                STATE A: ACTIVE / RINGING / CALLING CALL VIEW
               ============================================================== */}
            {callStatus !== "Idle" ? (
              <div className="space-y-3">
                {/* Caller Card */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/70 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {callerAvatar ? (
                        <img
                          src={callerAvatar}
                          alt={callerDisplayName || displayCallerNum}
                          className={`h-12 w-12 rounded-2xl object-cover border-2 shrink-0 shadow-sm ${
                            callStatus === "Ringing"
                              ? "border-amber-400 animate-bounce"
                              : "border-emerald-400"
                          }`}
                        />
                      ) : (
                        <div
                          className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                            callStatus === "Ringing"
                              ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 animate-bounce"
                              : callStatus === "Calling"
                              ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 animate-pulse"
                              : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          <PhoneCall size={20} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            callStatus === "Ringing"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                              : callStatus === "Calling"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                              : isOnHold
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                          }`}
                        >
                          {callStatus === "Ringing"
                            ? "Gelen Çağrı"
                            : callStatus === "Calling"
                            ? "Aranıyor..."
                            : isOnHold
                            ? "Beklemede"
                            : "Görüşme Aktif"}
                        </span>
                        <p className="text-sm font-black text-slate-800 dark:text-white truncate mt-1">
                          {callerDisplayName || displayCallerNum || "Bilinmeyen Numara"}
                        </p>
                        {callerDisplayName && displayCallerNum && (
                          <p className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                            {displayCallerNum}
                          </p>
                        )}
                      </div>
                    </div>

                    {callStatus === "InCall" && (
                      <div className="text-right shrink-0">
                        <span className="font-mono text-lg font-black text-slate-800 dark:text-white bg-white dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                          {formatSeconds(callDuration)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Ringing Controls */}
                  {callStatus === "Ringing" && (
                    <div className="flex gap-2.5 mt-4">
                      <button
                        type="button"
                        onClick={answerCall}
                        className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-extrabold text-xs shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Phone size={14} className="fill-current" /> Cevapla
                      </button>
                      {canRejectCall && (
                        <button
                          type="button"
                          onClick={hangupCall}
                          className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-extrabold text-xs shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <PhoneOff size={14} /> Reddet
                        </button>
                      )}
                    </div>
                  )}

                  {/* Calling Controls */}
                  {callStatus === "Calling" && (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={hangupCall}
                        className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-extrabold text-xs shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <PhoneOff size={14} /> Aramayı İptal Et
                      </button>
                    </div>
                  )}

                  {/* Active Call 6-Button Action Grid */}
                  {callStatus === "InCall" && (
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <button
                        type="button"
                        onClick={toggleMute}
                        className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                          isMuted
                            ? "bg-rose-500 text-white border-rose-500 shadow-sm"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
                        <span>{isMuted ? "Sesi Aç" : "Sessiz"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={toggleHold}
                        className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                          isOnHold
                            ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {isOnHold ? <Play size={15} /> : <Pause size={15} />}
                        <span>{isOnHold ? "Devam Et" : "Beklet"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveSubPanel(activeSubPanel === "keypad" ? null : "keypad")}
                        className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                          activeSubPanel === "keypad"
                            ? `${bg} text-white border-transparent shadow-sm`
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Grid size={15} />
                        <span>Tuşlar</span>
                      </button>

                      {canTransfer && (
                        <button
                          type="button"
                          onClick={() => setActiveSubPanel(activeSubPanel === "transfer" ? null : "transfer")}
                          className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                            activeSubPanel === "transfer"
                              ? `${bg} text-white border-transparent shadow-sm`
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          <PhoneForwarded size={15} />
                          <span>Aktar</span>
                        </button>
                      )}

                      {canConference && (
                        <button
                          type="button"
                          onClick={() => setActiveSubPanel(activeSubPanel === "new_line" ? null : "new_line")}
                          className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                            activeSubPanel === "new_line"
                              ? `${bg} text-white border-transparent shadow-sm`
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          <UserPlus size={15} />
                          <span>+ Hat / Konf</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={hangupCall}
                        className="py-2 px-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-extrabold flex flex-col items-center justify-center gap-1 shadow-sm transition-all"
                      >
                        <PhoneOff size={15} />
                        <span>Kapat</span>
                      </button>
                    </div>
                  )}

                  {/* Expandable Sub-Panel 1: DTMF Keypad */}
                  {activeSubPanel === "keypad" && callStatus === "InCall" && (
                    <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-800">
                      <div className="grid grid-cols-3 gap-1.5">
                        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => handleDtmfPress(d)}
                            className="py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 font-mono font-extrabold text-sm text-slate-800 dark:text-white active:scale-95 transition-all"
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expandable Sub-Panel 2: Call Transfer (Blind & Attended + Directory Picker) */}
                  {activeSubPanel === "transfer" && callStatus === "InCall" && (
                    <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-800 space-y-2.5">
                      <input
                        type="text"
                        value={transferTarget}
                        onChange={(e) => {
                          setTransferTarget(e.target.value);
                          setTransferSearch(e.target.value);
                        }}
                        placeholder="Dahili veya numara yazın / seçin..."
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!transferTarget.trim()}
                          onClick={() => handleBlindTransfer(transferTarget)}
                          className={`flex-1 py-2 rounded-xl ${bg} ${hover} disabled:opacity-40 text-white text-[11px] font-extrabold transition-all`}
                        >
                          Doğrudan Aktar
                        </button>
                        <button
                          type="button"
                          disabled={!transferTarget.trim()}
                          onClick={() => handleAttendedTransfer(transferTarget)}
                          className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[11px] font-extrabold transition-all"
                        >
                          Danışmalı Aktar
                        </button>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                        {filteredTransferList.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => setTransferTarget(item.number)}
                            className="cursor-pointer px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {item.isInternal && (
                                <span
                                  className={`h-2 w-2 rounded-full shrink-0 ${
                                    item.callState === "ringing"
                                      ? "bg-amber-500 animate-pulse"
                                      : item.callState === "busy"
                                      ? "bg-rose-500"
                                      : item.callState === "online"
                                      ? "bg-emerald-500"
                                      : "bg-slate-400"
                                  }`}
                                />
                              )}
                              <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                                {item.name}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-slate-400 shrink-0 ml-2">
                              {item.number}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expandable Sub-Panel 3: Add Line / Conference */}
                  {activeSubPanel === "new_line" && callStatus === "InCall" && (
                    <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-800 space-y-2">
                      <input
                        type="text"
                        value={newLineTarget}
                        onChange={(e) => setNewLineTarget(e.target.value)}
                        placeholder="2. hat için numara veya dahili..."
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!newLineTarget.trim()}
                          onClick={() => handleStartSecondLine(false)}
                          className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-[11px] font-extrabold transition-all"
                        >
                          2. Hattı Ara
                        </button>
                        <button
                          type="button"
                          disabled={!newLineTarget.trim()}
                          onClick={() => handleStartSecondLine(true)}
                          className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-extrabold transition-all"
                        >
                          Ara & Konferans Yap
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Voice Biometrics Status */}
                  {biometricStatus && biometricStatus.enabled && callStatus === "InCall" && (
                    <div className="mt-3 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Fingerprint size={11} className={text} /> Biyometrik Güvenlik
                        </span>
                        {biometricStatus.status === "verified" && (
                          <span className="text-[9px] font-extrabold text-emerald-600 flex items-center gap-1">
                            <CheckCircle size={11} /> Doğrulandı (%{biometricStatus.match_confidence})
                          </span>
                        )}
                        {biometricStatus.status === "deepfake_alarm" && (
                          <span className="text-[9px] font-extrabold text-rose-600 flex items-center gap-1 animate-pulse">
                            <ShieldAlert size={11} /> Deepfake Riski (%{biometricStatus.deepfake_risk})
                          </span>
                        )}
                      </div>
                      {biometricStatus.status === "unknown" && (
                        <button
                          type="button"
                          onClick={handleSaveVoiceprint}
                          disabled={savingVoiceprint}
                          className={`w-full py-1 ${lightBg} ${text} rounded-lg text-[9px] font-extrabold flex items-center justify-center gap-1`}
                        >
                          <Fingerprint size={10} />
                          {savingVoiceprint ? "Kaydediliyor..." : "Müşteri Ses İzini Kaydet"}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Live Translator & Voice Interpreter inside Mini Softphone */}
                {(canLiveTranslate || canVoiceInterpret) && (
                  <LiveTranslatorPanel
                    backendHost={backendHost}
                    callId={activeSipCallId}
                    callStatus={callStatus}
                    canLiveTranslate={canLiveTranslate}
                    canVoiceInterpret={canVoiceInterpret}
                    isActiveInstance={!isWebphoneScreenActive}
                  />
                )}
              </div>
            ) : (
              /* ==============================================================
                  STATE B: IDLE QUICK DIAL & DIRECTORY VIEW
                 ============================================================== */
              <div className="space-y-3">
                {/* Quick Number Input & Call Button */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2">
                    <input
                      type="text"
                      value={dialNumber}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^0-9*#+]/g, "");
                        webphoneManager.setDialNumber(clean);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && dialNumber && handleStartCallFromWidget(dialNumber)}
                      placeholder="Numara veya dahili ara..."
                      className="w-full text-sm font-mono font-extrabold text-slate-800 dark:text-white bg-transparent focus:outline-none"
                    />
                    {dialNumber && (
                      <button
                        type="button"
                        onClick={() => webphoneManager.setDialNumber(dialNumber.slice(0, -1))}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                        title="Sil"
                      >
                        <Delete size={15} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowIdleKeypad(!showIdleKeypad)}
                    className={`p-2.5 rounded-2xl border transition-colors ${
                      showIdleKeypad
                        ? `${bg} text-white border-transparent`
                        : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                    title="Tuş Takımını Göster/Gizle"
                  >
                    <Grid size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={!dialNumber}
                    onClick={() => handleStartCallFromWidget(dialNumber)}
                    className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all"
                  >
                    <Phone size={14} className="fill-current" />
                    Ara
                  </button>
                </div>

                {/* Toggleable Mini Keypad in Idle Mode */}
                {showIdleKeypad && (
                  <div className="grid grid-cols-3 gap-1.5 p-2.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/70 dark:border-slate-800">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleDtmfPress(d)}
                        className="py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 font-mono font-extrabold text-sm text-slate-800 dark:text-white active:scale-95 transition-all"
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}

                {/* Quick Directory & Contacts Search */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Users size={12} /> Hızlı Rehber & Dahililer
                    </span>
                  </div>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={idleSearch}
                      onChange={(e) => setIdleSearch(e.target.value)}
                      placeholder="Kişi veya dahili filtrele..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {filteredIdleList.map((item) => (
                      <div
                        key={item.id}
                        className="p-2 rounded-xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="relative h-7 w-7 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[11px] font-extrabold text-slate-700 dark:text-slate-200 shrink-0">
                            {item.name.charAt(0).toUpperCase()}
                            {item.isInternal && (
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                                  item.callState === "ringing"
                                    ? "bg-amber-500 animate-pulse"
                                    : item.callState === "busy"
                                    ? "bg-rose-500"
                                    : item.callState === "online"
                                    ? "bg-emerald-500"
                                    : "bg-slate-400"
                                }`}
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                {item.name}
                              </p>
                              {item.isInternal && (
                                <span
                                  className={`px-1.5 py-0.2 rounded-full text-[8px] font-bold border ${
                                    item.callState === "ringing"
                                      ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
                                      : item.callState === "busy"
                                      ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200 dark:border-rose-500/20"
                                      : item.callState === "online"
                                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                                  }`}
                                >
                                  {item.callState === "ringing"
                                    ? "Çalıyor"
                                    : item.callState === "busy"
                                    ? "Meşgul"
                                    : item.callState === "online"
                                    ? "Bağlı"
                                    : "Aktif Değil"}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-mono text-slate-400">
                              {item.isInternal ? `Dahili ${item.number}` : item.number}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            webphoneManager.setDialNumber(item.number);
                            handleStartCallFromWidget(item.number);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl ${bg} ${hover} text-white text-[10px] font-extrabold flex items-center gap-1 shrink-0`}
                        >
                          <Phone size={11} className="fill-current" />
                          Ara
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/25 border border-rose-200/50 dark:border-rose-900/30 rounded-2xl text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                <span className="font-semibold">{error}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
