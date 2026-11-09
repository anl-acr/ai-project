import React, { useState, useEffect, useRef } from "react";
import LiveTranslatorPanel from "../../phone/LiveTranslatorPanel";
import {
  Phone,
  PhoneOff,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Mic,
  MicOff,
  Pause,
  Play,
  UserPlus,
  UserCheck,
  X,
  ArrowRight,
  ArrowLeftRight,
  Radio,
  GitMerge,
  PhoneForwarded,
  Users,
  Languages,
  Delete,
  Clock,
  Tag,
  Check,
  Search,
  Save,
  ExternalLink,
  Building2,
  Calendar,
  Database,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Volume2,
  Loader2
} from "lucide-react";
import { useTheme } from "../../../utils/theme";
import { findContactByPhone, maskPhoneLast4 } from "../../../utils/contactUtils";
import { webphoneManager } from "../../../utils/webphoneManager";
import { getNoiseModeLabel } from "../../../utils/noiseSuppressionEngine";

const DEFAULT_DISPOSITIONS = [
  "Satış Yapıldı",
  "Bilgi Verildi",
  "Tekrar Aranacak",
  "Teknik Destek",
  "İptal / Şikayet"
];

export default function AgentWebphoneTab({
  backendHost,
  currentUser,
  activeCallId,
  pendingDial,
  setPendingDial,
  isWebphoneScreenActive = true,
  callPanelPerms = {}
}) {
  const { bg, hover, text, border, lightBg, borderLight } = useTheme();
  const [wpState, setWpState] = useState(() => webphoneManager.getState());
  const myExt = String(currentUser?.extension || "1000");

  const canSaveContact = callPanelPerms.canSaveContact !== false;
  const canTransfer = callPanelPerms.canTransfer !== false;
  const canConference = callPanelPerms.canConference !== false;
  const canRejectCall = callPanelPerms.canRejectCall !== false;
  const canCtiScreenPop = callPanelPerms.canCtiScreenPop !== false;
  const canLiveTranslate = Boolean(callPanelPerms.canLiveTranslate || callPanelPerms.canViewTranscripts !== false);
  const canVoiceInterpret = Boolean(callPanelPerms.canVoiceInterpret);
  const canPauseRecording = Boolean(callPanelPerms.canPauseRecording);
  const canAiNoteAssistant = callPanelPerms.canAiNoteAssistant !== false;
  const hasAnyTranslatorPerm = canLiveTranslate || canVoiceInterpret;
  const maskPhoneNumbers = Boolean(callPanelPerms.maskPhoneNumbers);
  const userCtiConfig = webphoneManager.resolveUserCtiConfig();

  // In-Call Transfer, Conference & Live Translator Popovers/Panels
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [conferenceOpen, setConferenceOpen] = useState(false);
  const [conferenceTarget, setConferenceTarget] = useState("");
  const [isTranslatorOpen, setIsTranslatorOpen] = useState(true);
  const [newCallInput, setNewCallInput] = useState("");
  const [isNewCallOpen, setIsNewCallOpen] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordingPauseBusy, setRecordingPauseBusy] = useState(false);

  // Contacts, Directory & Recent Calls State
  const [contacts, setContacts] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [recentCalls, setRecentCalls] = useState([]);
  const [quickSearch, setQuickSearch] = useState("");
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [newContact, setNewContact] = useState({ firstName: "", lastName: "", email: "" });
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState("");

  // Quick Disposition & In-Call / Post-Call ACW Note State
  const [dispositionCodes, setDispositionCodes] = useState(DEFAULT_DISPOSITIONS);
  const [defaultAcwSeconds, setDefaultAcwSeconds] = useState(20);
  const [selectedDisposition, setSelectedDisposition] = useState("");
  const [callNote, setCallNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [isDictatingNote, setIsDictatingNote] = useState(false);
  const [aiNoteLoading, setAiNoteLoading] = useState(false);
  const [aiNoteSuggestion, setAiNoteSuggestion] = useState(null);
  const [aiNoteError, setAiNoteError] = useState("");
  const [acwWrapUp, setAcwWrapUp] = useState({
    active: false,
    remaining: 0,
    callId: null,
    remoteNumber: "",
    displayName: "",
    queueName: "",
    duration: 0,
    isInternal: false
  });

  const inputRef = useRef(null);
  const noteInputRef = useRef(null);
  const backspaceHoldTimeoutRef = useRef(null);
  const backspaceHoldIntervalRef = useRef(null);
  const noteDictationRecRef = useRef(null);
  const callTranscriptTurnsRef = useRef([]);
  const lastActiveCallSnapshotRef = useRef(null);
  const prevCallStatusRef = useRef("Idle");
  const autoAiTriggeredForCallRef = useRef(null);

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

  useEffect(() => {
    webphoneManager.setWebphoneScreenActive(Boolean(isWebphoneScreenActive));
    return () => {
      webphoneManager.setWebphoneScreenActive(false);
    };
  }, [isWebphoneScreenActive]);

  // Fetch system contacts, directory & recent calls
  const fetchContactsAndDirectory = async () => {
    try {
      const protocol = window.location.protocol;
      const [contactsRes, dirRes, callsRes, queuesRes] = await Promise.all([
        fetch(`${protocol}//${backendHost}/api/contacts`),
        fetch(`${protocol}//${backendHost}/api/agent/directory`),
        fetch(`${protocol}//${backendHost}/api/calls?extension=${encodeURIComponent(myExt)}&limit=25`),
        fetch(`${protocol}//${backendHost}/api/settings/queues`)
      ]);
      if (contactsRes.ok) {
        const cData = await contactsRes.json();
        setContacts(Array.isArray(cData) ? cData : []);
      }
      if (dirRes.ok) {
        const dData = await dirRes.json();
        setDirectory(Array.isArray(dData) ? dData : []);
      }
      if (callsRes.ok) {
        const clData = await callsRes.json();
        if (Array.isArray(clData)) {
          const personalCalls = clData.filter((c) => {
            const hs = String(c.hangup_source || "");
            const isQueue = Boolean(c.is_queue_call || hs.startsWith("queue:"));
            if (isQueue && c.caller_number !== myExt) {
              return hs.includes(`:answered:${myExt}`);
            }
            return true;
          });
          setRecentCalls(personalCalls.slice(0, 8));
        }
      }
      if (queuesRes.ok) {
        const qData = await queuesRes.json();
        const list = Array.isArray(qData) ? qData : qData?.queues || [];
        const codes = new Set();
        let resolvedAcw = 20;
        let hasPos = false;
        list.forEach((q) => {
          const qAcw = Number(q.acw_time);
          if (Number.isFinite(qAcw) && qAcw > 0) {
            if (!hasPos || qAcw > resolvedAcw) {
              resolvedAcw = qAcw;
              hasPos = true;
            }
          }
          if (Array.isArray(q.disposition_codes)) {
            q.disposition_codes.forEach((c) => {
              if (c && String(c).trim()) codes.add(String(c).trim());
            });
          }
        });
        if (resolvedAcw > 0 && resolvedAcw <= 5) {
          resolvedAcw = 20;
        }
        setDefaultAcwSeconds(resolvedAcw);
        if (codes.size > 0) setDispositionCodes(Array.from(codes));
      }
    } catch (err) {
      console.error("Rehber verileri alınamadı:", err);
    }
  };

  useEffect(() => {
    fetchContactsAndDirectory();
    const handleContactsUpdated = () => fetchContactsAndDirectory();
    window.addEventListener("CONTACTS_UPDATED", handleContactsUpdated);
    return () => {
      window.removeEventListener("CONTACTS_UPDATED", handleContactsUpdated);
    };
  }, [backendHost]);

  useEffect(() => {
    if (!isWebphoneScreenActive) return;
    const pollDir = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const protocol = window.location.protocol;
        const dirRes = await fetch(`${protocol}//${backendHost}/api/agent/directory?t=${Date.now()}`);
        if (dirRes.ok) {
          const dirData = await dirRes.json();
          setDirectory(Array.isArray(dirData) ? dirData : []);
        }
      } catch (e) {}
    };
    pollDir();
    const dirTimer = setInterval(pollDir, 5000);
    return () => clearInterval(dirTimer);
  }, [backendHost, isWebphoneScreenActive]);

  const {
    dialNumber,
    remoteNumber,
    remoteDisplayName,
    queueName,
    callStatus,
    registered: isRegistered,
    callDuration,
    isMuted,
    isOnHold,
    callNotification,
    lines = [],
    activeLineId,
    isConferenceActive,
    attendedTransferPending,
    noiseSuppressionMode = "ai"
  } = wpState;

  const cycleNoiseMode = () => {
    webphoneManager.cycleNoiseSuppressionMode();
  };

  // Real-time Microphone (Hardware) & Speaker (Incoming Customer RTP) smooth level bars
  const [audioLevels, setAudioLevels] = useState({ micLevel: 0, speakerLevel: 0 });

  useEffect(() => {
    if (!isWebphoneScreenActive || (callStatus !== "InCall" && callStatus !== "Calling")) {
      setAudioLevels((prev) =>
        prev.micLevel === 0 && prev.speakerLevel === 0 ? prev : { micLevel: 0, speakerLevel: 0 }
      );
      return;
    }
    const meterTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const next = webphoneManager.sampleActiveCallAudioLevels();
      setAudioLevels((prev) => {
        if (prev.micLevel === next.micLevel && prev.speakerLevel === next.speakerLevel) {
          return prev;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(meterTimer);
  }, [isWebphoneScreenActive, callStatus, activeLineId, isConferenceActive, noiseSuppressionMode]);

  // Capture live conversation turns during call for AI Note Assistant
  useEffect(() => {
    const onLiveTurn = (e) => {
      const spk = e?.detail?.speaker || "customer";
      const txt = String(e?.detail?.text || "").trim();
      if (!txt) return;
      const arr = callTranscriptTurnsRef.current || [];
      if (arr.length === 0 || arr[arr.length - 1]?.text !== txt) {
        callTranscriptTurnsRef.current = [...arr.slice(-39), { speaker: spk, text: txt }];
      }
    };
    const onAcwSync = (e) => {
      const isAct = Boolean(e?.detail?.active);
      const rem = Number(e?.detail?.remaining || 0);
      if (isAct && rem > 0) {
        setAcwWrapUp((prev) => {
          if (prev.active) {
            return { ...prev, remaining: rem };
          }
          const snap = lastActiveCallSnapshotRef.current || {};
          return {
            active: true,
            remaining: rem,
            callId: prev.callId || snap.callId || activeCallId || null,
            remoteNumber: prev.remoteNumber || snap.remoteNumber || "",
            displayName: prev.displayName || snap.displayName || "",
            queueName: prev.queueName || snap.queueName || "",
            duration: prev.duration || snap.duration || 0,
            isInternal: Boolean(prev.isInternal || snap.isInternal)
          };
        });
      } else if (!isAct && e?.detail?.explicitEnd) {
        setAcwWrapUp((prev) => (prev.active ? { ...prev, active: false, remaining: 0 } : prev));
      }
    };
    const onDispSync = (e) => {
      if (e?.detail?.code) {
        setSelectedDisposition(e.detail.code);
      }
    };
    window.addEventListener("LIVE_TRANSLATION_TURN", onLiveTurn);
    window.addEventListener("AGENT_ACW_STATE", onAcwSync);
    window.addEventListener("CALL_DISPOSITION_SELECTED", onDispSync);
    return () => {
      window.removeEventListener("LIVE_TRANSLATION_TURN", onLiveTurn);
      window.removeEventListener("AGENT_ACW_STATE", onAcwSync);
      window.removeEventListener("CALL_DISPOSITION_SELECTED", onDispSync);
    };
  }, []);

  // Local fallback ACW countdown timer so Post-Call Note Card stays visible for ACW duration even for non-queue calls
  useEffect(() => {
    if (!acwWrapUp.active || callStatus !== "Idle") return;
    const timer = setInterval(() => {
      setAcwWrapUp((prev) => {
        if (!prev.active) {
          clearInterval(timer);
          return prev;
        }
        if (prev.remaining <= 1) {
          clearInterval(timer);
          if (typeof window !== "undefined") {
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent("FINISH_AGENT_ACW"));
            }, 0);
          }
          return { ...prev, active: false, remaining: 0 };
        }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [acwWrapUp.active, callStatus]);

  const stopNoteDictation = () => {
    if (noteDictationRecRef.current) {
      try {
        noteDictationRecRef.current.onresult = null;
        noteDictationRecRef.current.onerror = null;
        noteDictationRecRef.current.onend = null;
        noteDictationRecRef.current.stop();
      } catch (e) {}
      noteDictationRecRef.current = null;
    }
    setIsDictatingNote(false);
  };

  const toggleNoteDictation = () => {
    if (isDictatingNote) {
      stopNoteDictation();
      return;
    }
    if (typeof window === "undefined") return;
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setCallNotification({
        type: "error",
        message: "Tarayıcınız sesli dikte (Web Speech API) özelliğini desteklemiyor."
      });
      return;
    }
    try {
      const rec = new SpeechRec();
      rec.lang = "tr-TR";
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (event) => {
        let added = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            added += (event.results[i][0]?.transcript || "") + " ";
          }
        }
        const clean = added.trim();
        if (clean) {
          setCallNote((prev) => {
            const p = String(prev || "").trim();
            return p ? `${p} ${clean}` : clean;
          });
        }
      };
      rec.onerror = () => {
        setIsDictatingNote(false);
        noteDictationRecRef.current = null;
      };
      rec.onend = () => {
        setIsDictatingNote(false);
        noteDictationRecRef.current = null;
      };
      noteDictationRecRef.current = rec;
      rec.start();
      setIsDictatingNote(true);
      noteInputRef.current?.focus();
    } catch (e) {
      setIsDictatingNote(false);
    }
  };

  useEffect(() => {
    return () => stopNoteDictation();
  }, []);

  const handleGenerateAiNote = async (overrideCallId = null, opts = {}) => {
    if (!canAiNoteAssistant || aiNoteLoading) return;
    const targetCallId = overrideCallId || activeCallId || acwWrapUp.callId || lastActiveCallSnapshotRef.current?.callId;
    const snap = lastActiveCallSnapshotRef.current || {};
    setAiNoteLoading(true);
    setAiNoteError("");
    try {
      const protocol = window.location.protocol;
      const uid =
        (typeof window !== "undefined" &&
          (sessionStorage.getItem("current_user_id") || localStorage.getItem("current_user_id"))) ||
        currentUser?.id ||
        myExt;
      const tId =
        (typeof window !== "undefined" &&
          (localStorage.getItem("selected_tenant_id") || sessionStorage.getItem("selected_tenant_id"))) ||
        "";
      const headers = {
        "Content-Type": "application/json",
        "X-User-ID": String(uid)
      };
      if (tId) headers["X-Tenant-ID"] = tId;

      const res = await fetch(`${protocol}//${backendHost}/api/calls/generate-ai-note`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          call_id: targetCallId || "",
          caller_number: remoteNumber || acwWrapUp.remoteNumber || snap.remoteNumber || "",
          caller_name: snap.displayName || acwWrapUp.displayName || "",
          transcript_turns: callTranscriptTurnsRef.current || [],
          disposition_codes: dispositionCodes
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!opts.auto) {
          setAiNoteError(data?.detail || "AI not önerisi alınamadı.");
        }
        return;
      }
      if (data.status === "empty") {
        if (!opts.auto) {
          setAiNoteError(data.message || "Henüz konuşma metni algılanmadı.");
        }
        return;
      }
      if (data.suggested_note || data.suggested_disposition) {
        const suggestionObj = {
          note: data.suggested_note || "",
          disposition: data.suggested_disposition || "",
          keyPoints: Array.isArray(data.key_points) ? data.key_points : [],
          provider: data.provider_used || "ai",
          model: data.model_used || ""
        };
        setAiNoteSuggestion(suggestionObj);
        if (data.suggested_note) {
          setCallNote((prev) => (String(prev || "").trim() ? prev : data.suggested_note));
        }
        if (data.suggested_disposition && !selectedDisposition) {
          setSelectedDisposition(data.suggested_disposition);
        }
      }
    } catch (err) {
      if (!opts.auto) {
        setAiNoteError("AI Not Asistanı bağlantı hatası.");
      }
    } finally {
      setAiNoteLoading(false);
    }
  };

  useEffect(() => {
    if (callStatus !== "InCall") {
      setIsRecordingPaused(false);
      setRecordingPauseBusy(false);
    }

    // When a NEW call begins (Ringing or Calling or new InCall), clear previous post-call ACW wrap-up
    if (
      (callStatus === "Calling" || callStatus === "Ringing" || callStatus === "InCall") &&
      prevCallStatusRef.current === "Idle"
    ) {
      setAcwWrapUp({
        active: false,
        remaining: 0,
        callId: null,
        remoteNumber: "",
        displayName: "",
        queueName: "",
        duration: 0,
        isInternal: false
      });
      setSelectedDisposition("");
      setCallNote("");
      setNoteSaved(false);
      setAiNoteSuggestion(null);
      setAiNoteError("");
      callTranscriptTurnsRef.current = [];
    }

    // Transition from InCall -> Idle: Enter Post-Call ACW Note & Disposition Wrap-Up Mode
    if (prevCallStatusRef.current === "InCall" && callStatus === "Idle" && lines.length === 0) {
      setTransferOpen(false);
      setConferenceOpen(false);
      setIsNewCallOpen(false);
      setTransferTarget("");
      setConferenceTarget("");
      setNewCallInput("");
      fetchContactsAndDirectory();

      const snap = lastActiveCallSnapshotRef.current || {};
      const wrapSecs = defaultAcwSeconds > 0 ? defaultAcwSeconds : 20;
      const endedCallId = snap.callId || activeCallId || null;
      setAcwWrapUp({
        active: true,
        remaining: wrapSecs,
        callId: endedCallId,
        remoteNumber: snap.remoteNumber || "",
        displayName: snap.displayName || "",
        queueName: snap.queueName || "",
        duration: snap.duration || 0,
        isInternal: Boolean(snap.isInternal)
      });

      if (
        canAiNoteAssistant &&
        endedCallId !== autoAiTriggeredForCallRef.current &&
        ((callTranscriptTurnsRef.current && callTranscriptTurnsRef.current.length > 0) || endedCallId)
      ) {
        autoAiTriggeredForCallRef.current = endedCallId || `call_${Date.now()}`;
        setTimeout(() => {
          handleGenerateAiNote(endedCallId, { auto: true });
        }, 350);
      }
    } else if (callStatus === "Idle" && lines.length === 0 && !acwWrapUp.active) {
      setTransferOpen(false);
      setConferenceOpen(false);
      setIsNewCallOpen(false);
      setTransferTarget("");
      setConferenceTarget("");
      setNewCallInput("");
    }

    prevCallStatusRef.current = callStatus;
  }, [callStatus, lines.length, defaultAcwSeconds, canAiNoteAssistant, activeCallId]);

  const toggleRecordingPause = async () => {
    if (!canPauseRecording || callStatus !== "InCall" || recordingPauseBusy) return;
    setRecordingPauseBusy(true);
    try {
      const protocol = window.location.protocol;
      const uid =
        (typeof window !== "undefined" &&
          (sessionStorage.getItem("current_user_id") || localStorage.getItem("current_user_id"))) ||
        currentUser?.id ||
        myExt;
      const res = await fetch(`${protocol}//${backendHost}/api/calls/recording/pause`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": String(uid)
        },
        body: JSON.stringify({
          extension: myExt,
          call_id: activeCallId || undefined,
          paused: !isRecordingPaused
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status !== "error") {
        const nextState = typeof data.paused === "boolean" ? data.paused : !isRecordingPaused;
        setIsRecordingPaused(nextState);
        setCallNotification(
          nextState
            ? "Ses kaydı geçici olarak maskeleniyor (KVKK / Kart Bilgisi)"
            : "Ses kaydı tekrar devam ediyor"
        );
      } else {
        setCallNotification(data?.detail || data?.message || "Ses kaydı durumu değiştirilemedi");
      }
    } catch (err) {
      setCallNotification("Ses kaydı kontrol bağlantı hatası");
    } finally {
      setRecordingPauseBusy(false);
    }
  };

  const setDialNumber = (val) => {
    if (typeof val === "function") {
      const next = val(webphoneManager.getState().dialNumber);
      webphoneManager.setDialNumber(next);
    } else {
      webphoneManager.setDialNumber(val);
    }
  };

  const setCallNotification = (notif) => {
    webphoneManager.setCallNotification(notif);
  };

  const formatDuration = (secs) => {
    const m = Math.floor((secs || 0) / 60).toString().padStart(2, "0");
    const s = ((secs || 0) % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleDial = (num) => {
    webphoneManager.setDialNumber((webphoneManager.getState().dialNumber || "") + String(num));
  };

  const handleBackspace = () => {
    const curr = String(webphoneManager.getState().dialNumber || "");
    if (curr.length > 0) {
      webphoneManager.setDialNumber(curr.slice(0, -1));
    }
  };

  const stopBackspaceHold = () => {
    if (backspaceHoldTimeoutRef.current) {
      clearTimeout(backspaceHoldTimeoutRef.current);
      backspaceHoldTimeoutRef.current = null;
    }
    if (backspaceHoldIntervalRef.current) {
      clearInterval(backspaceHoldIntervalRef.current);
      backspaceHoldIntervalRef.current = null;
    }
  };

  const startBackspaceHold = (e) => {
    if (e && e.button !== undefined && e.button !== 0) return;
    stopBackspaceHold();
    handleBackspace();
    backspaceHoldTimeoutRef.current = setTimeout(() => {
      backspaceHoldIntervalRef.current = setInterval(() => {
        const curr = String(webphoneManager.getState().dialNumber || "");
        if (!curr) {
          stopBackspaceHold();
          return;
        }
        webphoneManager.setDialNumber(curr.slice(0, -1));
      }, 65);
    }, 320);
  };

  useEffect(() => {
    return () => stopBackspaceHold();
  }, []);

  const handleAnswerCall = (lineId = null) => {
    webphoneManager.answerCall(lineId);
  };

  const handleCall = (targetNum = dialNumber) => {
    const clean = String(targetNum || "").trim();
    if (!clean) return;
    const match = findContactByPhone(clean, contacts, directory);
    webphoneManager.makeCall(clean, { displayName: match?.displayName || "" });
  };

  const handleHangup = (lineId = null) => {
    webphoneManager.hangupCall(lineId);
    if (lines.length <= 1) {
      webphoneManager.setDialNumber("");
    }
  };

  const toggleMute = () => {
    webphoneManager.toggleMute();
  };

  const toggleHold = () => {
    webphoneManager.toggleHold();
  };

  const handleFinishAcwWrapUp = () => {
    stopNoteDictation();
    setAcwWrapUp((prev) => ({ ...prev, active: false, remaining: 0 }));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("FINISH_AGENT_ACW"));
    }
  };

  const handleSaveCallDispositionAndNote = async (codeOverride = null, opts = {}) => {
    const topicToSave = codeOverride !== null ? codeOverride : selectedDisposition;
    if (codeOverride !== null) {
      setSelectedDisposition(codeOverride);
    }
    const targetCallId =
      activeCallId || acwWrapUp.callId || lastActiveCallSnapshotRef.current?.callId || null;

    if (typeof window !== "undefined" && topicToSave) {
      window.dispatchEvent(
        new CustomEvent("CALL_DISPOSITION_SELECTED", { detail: { code: topicToSave, callId: targetCallId } })
      );
    }

    if (!targetCallId) {
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2500);
      if (opts?.finishAcw) {
        handleFinishAcwWrapUp();
      }
      return;
    }
    try {
      const protocol = window.location.protocol;
      await fetch(`${protocol}//${backendHost}/api/calls/${targetCallId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topicToSave,
          notes: callNote
        })
      });
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2500);
      fetchContactsAndDirectory();
      if (opts?.finishAcw) {
        handleFinishAcwWrapUp();
      }
    } catch (e) {
      console.error("Not kaydedilemedi:", e);
    }
  };

  const handleSaveContact = async () => {
    if (!newContact.firstName.trim() || !newContact.lastName.trim()) {
      setContactError("Lütfen Ad ve Soyad alanlarını doldurun.");
      return;
    }
    setSavingContact(true);
    setContactError("");
    const phoneToSave = (remoteNumber || dialNumber || "").trim();
    try {
      const protocol = window.location.protocol;
      const res = await fetch(`${protocol}//${backendHost}/api/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: newContact.firstName.trim(),
          last_name: newContact.lastName.trim(),
          phone_number: phoneToSave,
          email: newContact.email.trim() || null
        })
      });
      if (res.ok) {
        await fetchContactsAndDirectory();
        window.dispatchEvent(new CustomEvent("CONTACTS_UPDATED"));
        setIsAddContactOpen(false);
      } else {
        const errData = await res.json();
        setContactError(errData.detail || "Kayıt eklenirken bir hata oluştu.");
      }
    } catch (err) {
      console.error("Contact save error:", err);
      setContactError("Bağlantı hatası oluştu.");
    } finally {
      setSavingContact(false);
    }
  };

  // Support dialing from Rehber / Hızlı Arama even while already in a call (automatically opens 2nd line)
  useEffect(() => {
    if (pendingDial) {
      const numToDial = String(pendingDial);
      webphoneManager.setDialNumber(numToDial);
      if (isRegistered) {
        setPendingDial(null);
        const match = findContactByPhone(numToDial, contacts, directory);
        setTimeout(() => webphoneManager.makeCall(numToDial, { displayName: match?.displayName || "" }), 80);
      }
    }
  }, [pendingDial, isRegistered]);

  const activePhoneNum = callStatus !== "Idle" ? (remoteNumber || dialNumber) : dialNumber;
  const matchedContact = findContactByPhone(activePhoneNum, contacts, directory);
  const resolvedDisplayName =
    matchedContact?.displayName || (remoteDisplayName && remoteDisplayName !== activePhoneNum ? remoteDisplayName : "");
  const resolvedIsInternal = Boolean(
    matchedContact?.isInternal || (activePhoneNum && String(activePhoneNum).length <= 5 && resolvedDisplayName)
  );
  const displayPhoneNum =
    callStatus !== "Idle" && maskPhoneNumbers ? maskPhoneLast4(activePhoneNum, true) : activePhoneNum;

  useEffect(() => {
    if (callStatus === "InCall" || callStatus === "Calling" || callStatus === "Ringing") {
      lastActiveCallSnapshotRef.current = {
        callId: activeCallId || lastActiveCallSnapshotRef.current?.callId || null,
        remoteNumber: activePhoneNum || "",
        displayName: resolvedDisplayName || "",
        queueName: queueName || "",
        duration: callDuration || 0,
        isInternal: resolvedIsInternal
      };
    }
  }, [callStatus, activeCallId, activePhoneNum, resolvedDisplayName, queueName, callDuration, resolvedIsInternal]);

  const inCallLinesCount = lines.filter((l) => l.callStatus === "InCall").length;
  const hasMultipleLines = lines.length >= 2;

  const resolveLineLabel = (line) => {
    const m = findContactByPhone(line.remoteNumber, contacts, directory);
    const name = m?.displayName || line.remoteDisplayName || "";
    const num = maskPhoneNumbers ? maskPhoneLast4(line.remoteNumber, true) : line.remoteNumber;
    const qName = line.queueName || "";
    return { name, num, qName };
  };

  // Filtered directory + contacts for idle quick-dial panel
  const combinedQuickDirectory = [
    ...directory
      .filter((d) => d.type === "user" && d.extension !== String(currentUser?.extension))
      .map((d) => ({
        id: `dir-${d.extension}`,
        name: d.full_name || d.name || `Dahili ${d.extension}`,
        number: String(d.extension),
        isInternal: true,
        isOnline: Boolean(d.is_registered),
        callState: d.call_state || (d.is_registered ? "online" : "offline")
      })),
    ...contacts.slice(0, 15).map((c) => ({
      id: `cnt-${c.id}`,
      name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.phone_number,
      number: String(c.phone_number || ""),
      isInternal: false,
      isOnline: false,
      callState: null
    }))
  ].filter((item) => {
    if (!quickSearch.trim()) return true;
    const q = quickSearch.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.number.toLowerCase().includes(q);
  });

  return (
    <div className="w-full h-full p-4 lg:p-6 overflow-hidden flex flex-col relative">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        {/* Left Column: Sleek Dialpad */}
        <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-4 h-full overflow-y-auto hide-scrollbar">
          <div
            className={`p-5 bg-white dark:bg-slate-900 border ${borderLight} rounded-3xl shadow-sm flex flex-col items-center justify-between flex-1`}
          >
            {callNotification && (
              <div
                className={`w-full mb-3 p-3 rounded-2xl border text-xs font-semibold flex items-start justify-between gap-2 animate-in fade-in duration-200 ${
                  callNotification.type === "info"
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300"
                    : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400"
                }`}
              >
                <span>{callNotification.message}</span>
                <button
                  type="button"
                  onClick={() => setCallNotification(null)}
                  className="opacity-70 hover:opacity-100 shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Digital Number Screen with Backspace */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      callStatus !== "Idle"
                        ? "bg-emerald-500 animate-pulse"
                        : isRegistered
                        ? "bg-emerald-500"
                        : "bg-rose-500"
                    }`}
                  />
                  {isConferenceActive
                    ? `Konferans (${lines.length} Hat)`
                    : callStatus === "InCall"
                    ? "Görüşme Aktif"
                    : callStatus === "Calling"
                    ? "Aranıyor..."
                    : callStatus === "Ringing"
                    ? "Gelen Çağrı..."
                    : isRegistered
                    ? `Web Telefon Hazır (${currentUser?.extension || "1000"})`
                    : "Bağlantı Bekleniyor"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cycleNoiseMode}
                    title={`Gürültü Engelleme: ${getNoiseModeLabel(noiseSuppressionMode)} (Değiştirmek için tıklayın)`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-extrabold uppercase tracking-wide transition-all ${
                      noiseSuppressionMode === "ai"
                        ? `${lightBg} ${text} ${borderLight}`
                        : noiseSuppressionMode === "standard"
                        ? "bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                        : "bg-slate-50 border-slate-200/70 text-slate-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-500"
                    }`}
                  >
                    <Sparkles size={10} />
                    <span>
                      {noiseSuppressionMode === "ai"
                        ? "AI Ses"
                        : noiseSuppressionMode === "standard"
                        ? "Standart"
                        : "Ham Ses"}
                    </span>
                  </button>
                  {dialNumber && (
                    <button
                      type="button"
                      onClick={() => setDialNumber("")}
                      className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                      Temizle
                    </button>
                  )}
                </div>
              </div>

              <div className="relative flex items-center bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl px-3.5 py-2.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={dialNumber}
                  onChange={(e) => setDialNumber(e.target.value.replace(/[^0-9*#+]/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && dialNumber && handleCall(dialNumber)}
                  placeholder={callStatus !== "Idle" ? "2. Hat İçin Numara..." : "Numara veya Dahili..."}
                  className="w-full text-center text-xl font-mono font-extrabold tracking-wider text-slate-800 dark:text-white bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-400 dark:placeholder:text-slate-600 placeholder:font-sans placeholder:text-sm placeholder:font-semibold"
                  autoFocus
                />
                {dialNumber && (
                  <button
                    type="button"
                    onMouseDown={startBackspaceHold}
                    onMouseUp={stopBackspaceHold}
                    onMouseLeave={stopBackspaceHold}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      startBackspaceHold();
                    }}
                    onTouchEnd={stopBackspaceHold}
                    onTouchCancel={stopBackspaceHold}
                    onClick={(e) => {
                      if (e.detail === 0) handleBackspace();
                    }}
                    title="Sil (Basılı tutarak hızlı silin)"
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors shrink-0 select-none"
                  >
                    <Delete size={18} />
                  </button>
                )}
              </div>

              {matchedContact && dialNumber && (
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center justify-center gap-1">
                  <UserCheck size={13} />
                  {matchedContact.displayName}
                </p>
              )}
            </div>

            {/* Keypad Grid */}
            <div className="grid grid-cols-3 gap-3.5 w-full my-4 px-2">
              {[
                { digit: "1", sub: "" },
                { digit: "2", sub: "ABC" },
                { digit: "3", sub: "DEF" },
                { digit: "4", sub: "GHI" },
                { digit: "5", sub: "JKL" },
                { digit: "6", sub: "MNO" },
                { digit: "7", sub: "PQRS" },
                { digit: "8", sub: "TUV" },
                { digit: "9", sub: "WXYZ" },
                { digit: "*", sub: "" },
                { digit: "0", sub: "+" },
                { digit: "#", sub: "" }
              ].map(({ digit, sub }) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => {
                    handleDial(digit);
                    inputRef.current?.focus();
                  }}
                  className={`h-14 rounded-2xl bg-slate-50/90 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 flex flex-col items-center justify-center transition-all duration-150 active:scale-95 border ${borderLight}`}
                >
                  <span className="text-lg font-extrabold text-slate-800 dark:text-slate-100 leading-none">
                    {digit}
                  </span>
                  {sub && (
                    <span className="text-[8px] font-bold tracking-widest text-slate-400 dark:text-slate-500 mt-0.5">
                      {sub}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Primary Call Button */}
            <div className="w-full pt-1">
              <button
                type="button"
                onClick={() => (callStatus === "Ringing" ? handleAnswerCall() : handleCall(dialNumber))}
                disabled={!dialNumber && callStatus !== "Ringing"}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-45 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all active:scale-98"
              >
                <Phone size={18} className="fill-current" />
                <span>
                  {callStatus === "Ringing"
                    ? "Gelen Çağrıyı Yanıtla"
                    : callStatus !== "Idle"
                    ? "Yeni Hat Ara"
                    : "Çağrı Başlat"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Active Call Workspace OR Idle Quick-Access Workspace */}
        <div className="lg:col-span-8 xl:col-span-8 h-full flex flex-col gap-4 overflow-hidden">
          {/* Group Ringing Visual Alert Banner */}
          {Array.isArray(wpState.groupRingingCalls) && wpState.groupRingingCalls.length > 0 && (
            <div className="shrink-0 space-y-2">
              {wpState.groupRingingCalls.map((rc) => {
                const rcCallerMasked = maskPhoneLast4(rc.caller_number || "Bilinmeyen", maskPhoneNumbers);
                const rcCallerDisplay = rc.caller_name
                  ? `${rc.caller_name} (${rcCallerMasked})`
                  : rcCallerMasked || "Bilinmeyen Numara";
                return (
                  <div
                    key={`${rc.ringing_extension}_${rc.caller_number}`}
                    className="p-4 rounded-2xl border-2 border-amber-400 dark:border-amber-500/80 bg-amber-50/90 dark:bg-amber-950/40 shadow-md flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                        <PhoneIncoming size={18} className="animate-bounce" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500 text-white">
                            Grubunda Çağrı Var
                          </span>
                          {rc.group_name && (
                            <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                              • {rc.group_name}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 text-xs">
                          <span className="text-slate-700 dark:text-slate-200">
                            <strong>Çalan Dahili:</strong> {rc.ringing_extension}
                          </span>
                          <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                            {rcCallerDisplay}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => webphoneManager.pickupGroupCall(rc)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-xs flex items-center gap-1.5 shrink-0"
                    >
                      <Phone size={14} />
                      Çağrıyı Çek ({rc.ringing_extension})
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {callStatus === "Idle" ? (
            /* IDLE STATE WORKSPACE: Post-Call ACW Wrap-Up Card (if active) + Recent Calls & Quick Directory */
            <div className="flex flex-col gap-4 h-full overflow-hidden">
              {acwWrapUp.active && (
                <div
                  className={`p-5 bg-white dark:bg-slate-900 border-2 ${border} rounded-3xl shadow-md flex flex-col gap-3.5 shrink-0 animate-in fade-in slide-in-from-top-2 duration-200`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl ${lightBg} ${text} flex items-center justify-center shrink-0`}>
                        <Clock size={22} className="animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${bg} text-white`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                            Çağrı Sonrası İşlem (ACW) • {formatDuration(acwWrapUp.remaining)}
                          </span>
                          {acwWrapUp.queueName && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${lightBg} ${text} ${borderLight}`}>
                              Kuyruk: {acwWrapUp.queueName}
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-slate-400">
                            Görüşme Süresi: {formatDuration(acwWrapUp.duration)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                            {acwWrapUp.displayName || (maskPhoneNumbers ? maskPhoneLast4(acwWrapUp.remoteNumber, true) : acwWrapUp.remoteNumber) || "Son Görüşme"}
                          </h3>
                          {acwWrapUp.displayName && acwWrapUp.remoteNumber && (
                            <span className="text-xs font-mono font-semibold text-slate-400">
                              {maskPhoneNumbers ? maskPhoneLast4(acwWrapUp.remoteNumber, true) : acwWrapUp.remoteNumber}
                            </span>
                          )}
                          {!maskPhoneNumbers && acwWrapUp.remoteNumber && (
                            <button
                              type="button"
                              onClick={() =>
                                window.dispatchEvent(
                                  new CustomEvent("OPEN_CUSTOMER_360", {
                                    detail: {
                                      phone: acwWrapUp.remoteNumber,
                                      name: acwWrapUp.displayName || ""
                                    }
                                  })
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold transition-all cursor-pointer"
                            >
                              <Sparkles size={11} />
                              360° Kart
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleFinishAcwWrapUp}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white text-xs font-bold flex items-center gap-1 transition-all"
                      title="Not yazmadan ACW süresini bitir ve Müsait duruma geç"
                    >
                      <X size={14} />
                      ACW Kapat
                    </button>
                  </div>

                  {/* Shared Disposition, AI Note Assistant & Dictation Note Bar in Post-Call ACW Mode */}
                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase flex items-center gap-1 mr-1">
                          <Tag size={11} />
                          Sonuç Kodu:
                        </span>
                        {dispositionCodes.map((code) => (
                          <button
                            key={code}
                            type="button"
                            onClick={() => handleSaveCallDispositionAndNote(code)}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                              selectedDisposition === code
                                ? `${bg} text-white ${border}`
                                : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                            }`}
                          >
                            {code}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        {canAiNoteAssistant && (
                          <button
                            type="button"
                            onClick={() => handleGenerateAiNote(acwWrapUp.callId)}
                            disabled={aiNoteLoading}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold border flex items-center gap-1.5 transition-all cursor-pointer ${lightBg} ${text} ${borderLight} disabled:opacity-50`}
                            title="Görüşme konuşmalarından yapay zeka ile otomatik not ve sonuç kodu çıkar"
                          >
                            {aiNoteLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            <span>{aiNoteLoading ? "AI Not Çıkarıyor..." : "AI Not Çıkar"}</span>
                          </button>
                        )}
                        {noteSaved && (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Check size={13} />
                            Kaydedildi
                          </span>
                        )}
                      </div>
                    </div>

                    {aiNoteError && (
                      <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center justify-between gap-2">
                        <span>{aiNoteError}</span>
                        <button type="button" onClick={() => setAiNoteError("")} className="opacity-70 hover:opacity-100">
                          <X size={12} />
                        </button>
                      </div>
                    )}

                    {aiNoteSuggestion?.note && (
                      <div className={`p-2.5 rounded-xl border ${borderLight} ${lightBg} flex flex-wrap items-center justify-between gap-2`}>
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <Sparkles size={14} className={`${text} shrink-0 mt-0.5`} />
                          <div className="text-xs text-slate-700 dark:text-slate-200 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                              <span className={`text-[10px] font-extrabold uppercase ${text}`}>AI Not Önerisi</span>
                              {aiNoteSuggestion.provider && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-white/80 dark:bg-slate-900/80 text-slate-500 border border-slate-200/70 dark:border-slate-700">
                                  {aiNoteSuggestion.provider.toUpperCase()} {aiNoteSuggestion.model ? `• ${aiNoteSuggestion.model}` : ""}
                                </span>
                              )}
                            </div>
                            <p className="font-medium leading-snug">{aiNoteSuggestion.note}</p>
                          </div>
                        </div>
                        {callNote !== aiNoteSuggestion.note && (
                          <button
                            type="button"
                            onClick={() => {
                              setCallNote(aiNoteSuggestion.note);
                              if (aiNoteSuggestion.disposition) {
                                setSelectedDisposition(aiNoteSuggestion.disposition);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg ${bg} ${hover} text-white text-[10px] font-extrabold shrink-0`}
                          >
                            Not Alanına Uygula
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 flex items-center">
                        <input
                          ref={noteInputRef}
                          type="text"
                          value={callNote}
                          onChange={(e) => setCallNote(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveCallDispositionAndNote(null, { finishAcw: true })}
                          placeholder="Çağrı sonrası görüşme notunu yazın veya mikrofonla dikte edin..."
                          className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 text-xs font-medium text-slate-800 dark:text-white focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={toggleNoteDictation}
                          title={isDictatingNote ? "Sesli Dikteyi Durdur" : "Sesle Not Yaz (Dikte - Türkçe)"}
                          className={`absolute right-1.5 h-7 w-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                            isDictatingNote
                              ? "bg-rose-600 text-white animate-pulse shadow-xs"
                              : "bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {isDictatingNote ? <MicOff size={14} /> : <Mic size={14} />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveCallDispositionAndNote()}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all"
                      >
                        <Save size={13} />
                        Kaydet
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveCallDispositionAndNote(null, { finishAcw: true })}
                        className={`px-3.5 py-2.5 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold flex items-center gap-1.5 shrink-0 shadow-xs transition-all`}
                        title="Notu kaydet ve ACW süresini tamamlayıp Müsait duruma geç"
                      >
                        <Check size={14} />
                        Kaydet &amp; Müsait Ol
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1 overflow-hidden">
              {/* Recent Calls Card */}
              <div
                className={`p-5 bg-white dark:bg-slate-900 border ${borderLight} rounded-3xl shadow-sm flex flex-col overflow-hidden`}
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${lightBg} ${text}`}>
                      <Clock size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">
                        Son Görüşmeler
                      </h3>
                      <p className="text-[10px] text-slate-400">Tek tıkla numarayı tekrar arayın</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {recentCalls.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-10 text-slate-400 text-xs">
                      Henüz kayıtlı görüşme geçmişi bulunmuyor.
                    </div>
                  ) : (
                    recentCalls.map((c) => {
                      const isOutbound = c.caller_number === myExt && c.callee_number && c.callee_number !== myExt;
                      const rawNum = isOutbound
                        ? c.callee_number
                        : c.caller_number || c.callee_number || "";
                      const m = findContactByPhone(rawNum, contacts, directory);
                      const shownNum = maskPhoneNumbers ? maskPhoneLast4(rawNum, true) : rawNum;
                      const stLower = String(c.status || "").toLowerCase();
                      const isMissed =
                        stLower === "missed" ||
                        stLower === "no_answer" ||
                        stLower === "busy" ||
                        stLower === "cancelled" ||
                        stLower === "failed" ||
                        stLower === "blocked" ||
                        stLower === "rejected_limit";
                      const isDirectMissed = !isOutbound && isMissed && !c.is_queue_call;
                      const outboundFailedLabel =
                        isOutbound && isMissed
                          ? stLower === "busy"
                            ? "Meşgul"
                            : stLower === "cancelled"
                            ? "İptal"
                            : stLower === "failed" || stLower === "blocked" || stLower === "rejected_limit"
                            ? "Başarısız"
                            : "Yanıtsız"
                          : "";
                      const talkSecs = !isMissed
                        ? Math.max(0, Number(c.talk_duration ?? c.duration_talk ?? 0) || 0)
                        : 0;
                      const rawTime = String(c.start_time || "");
                      const utcTimeStr = rawTime
                        ? /[Zz]|[+-]\d{2}:?\d{2}$/.test(rawTime)
                          ? rawTime
                          : `${rawTime}Z`
                        : "";
                      return (
                        <div
                          key={c.id}
                          className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                            isDirectMissed
                              ? "bg-rose-50/70 dark:bg-rose-950/25 border-rose-200/90 dark:border-rose-800/60 hover:border-rose-300 dark:hover:border-rose-700"
                              : "bg-slate-50/80 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`relative h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                                isMissed
                                  ? "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                                  : `${lightBg} ${text}`
                              }`}
                            >
                              {isMissed ? (
                                <PhoneMissed size={15} />
                              ) : isOutbound ? (
                                <PhoneOutgoing size={15} />
                              ) : (
                                <PhoneIncoming size={15} />
                              )}
                              {isDirectMissed && (
                                <span
                                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse"
                                  title="Doğrudan Cevapsız Çağrı"
                                />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p
                                  className={`text-xs font-extrabold truncate ${
                                    isDirectMissed
                                      ? "text-rose-700 dark:text-rose-300"
                                      : "text-slate-800 dark:text-white"
                                  }`}
                                >
                                  {m?.displayName || (!isOutbound && c.caller_name) || shownNum || "Bilinmeyen"}
                                </p>
                                {isDirectMissed && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                    Cevapsız
                                  </span>
                                )}
                                {outboundFailedLabel && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70 shrink-0">
                                    {outboundFailedLabel}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                                <span>{shownNum}</span>
                                {utcTimeStr && (
                                  <span>
                                    •{" "}
                                    {new Date(utcTimeStr).toLocaleTimeString("tr-TR", {
                                      timeZone: "Europe/Istanbul",
                                      hour: "2-digit",
                                      minute: "2-digit"
                                    })}
                                  </span>
                                )}
                                {talkSecs > 0 && <span>• {formatDuration(talkSecs)}</span>}
                              </div>
                            </div>
                          </div>

                          {rawNum && (
                            <button
                              type="button"
                              onClick={() => {
                                setDialNumber(rawNum);
                                handleCall(rawNum);
                              }}
                              className={`h-8 px-3 rounded-xl ${bg} ${hover} text-white text-[11px] font-bold flex items-center gap-1.5 shrink-0 transition-all`}
                              title="Hemen Ara"
                            >
                              <Phone size={12} className="fill-current" />
                              Ara
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Quick Internal Directory & Contacts Card */}
              <div
                className={`p-5 bg-white dark:bg-slate-900 border ${borderLight} rounded-3xl shadow-sm flex flex-col overflow-hidden`}
              >
                <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${lightBg} ${text}`}>
                      <Users size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">
                        Hızlı Rehber &amp; Dahililer
                      </h3>
                      <p className="text-[10px] text-slate-400">Dahili aboneler ve kayıtlı kişiler</p>
                    </div>
                  </div>
                </div>

                <div className="relative mb-3">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={quickSearch}
                    onChange={(e) => setQuickSearch(e.target.value)}
                    placeholder="İsim veya numara ara..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none"
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {combinedQuickDirectory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-10 text-slate-400 text-xs">
                      Eşleşen kişi veya dahili bulunamadı.
                    </div>
                  ) : (
                    combinedQuickDirectory.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative h-8 w-8 rounded-xl bg-slate-200/80 dark:bg-slate-700 flex items-center justify-center text-xs font-extrabold text-slate-700 dark:text-slate-200 shrink-0">
                            {item.name.charAt(0).toUpperCase()}
                            {item.isInternal && (
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                                  item.callState === "ringing"
                                    ? "bg-amber-500 animate-pulse"
                                    : item.callState === "busy"
                                    ? "bg-rose-500"
                                    : item.callState === "online" || item.isOnline
                                    ? "bg-emerald-500"
                                    : "bg-slate-400"
                                }`}
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{item.name}</p>
                              {item.isInternal && (
                                <span
                                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold border ${
                                    item.callState === "ringing"
                                      ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
                                      : item.callState === "busy"
                                      ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200 dark:border-rose-500/20"
                                      : item.callState === "online" || item.isOnline
                                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                                  }`}
                                >
                                  {item.callState === "ringing"
                                    ? "Çalıyor"
                                    : item.callState === "busy"
                                    ? "Meşgul"
                                    : item.callState === "online" || item.isOnline
                                    ? "Bağlı (Müsait)"
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
                            setDialNumber(item.number);
                            handleCall(item.number);
                          }}
                          className={`h-8 px-3 rounded-xl ${bg} ${hover} text-white text-[11px] font-bold flex items-center gap-1.5 shrink-0 transition-all`}
                        >
                          <Phone size={12} className="fill-current" />
                          Ara
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              </div>
            </div>
          ) : (
            /* ACTIVE CALL WORKSPACE */
            <div className="flex flex-col h-full gap-3.5 overflow-y-auto">
              {/* Show Multi-Line Bar ONLY when 2+ lines exist or "+ Yeni Hat" is toggled */}
              {(hasMultipleLines || isNewCallOpen) && (
                <div
                  className={`p-3.5 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm flex flex-col gap-3 shrink-0`}
                >
                  {hasMultipleLines && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Aktif Hatlar ({lines.length})
                        </span>
                        {isConferenceActive && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                            <Radio size={12} className="animate-pulse" />
                            Konferans Birleştirildi
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => webphoneManager.swapLines()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                        >
                          <ArrowLeftRight size={14} />
                          Hat Değiştir
                        </button>

                        {canTransfer && (
                          <button
                            type="button"
                            onClick={() => webphoneManager.completeAttendedTransfer()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white"
                          >
                            <PhoneForwarded size={14} />
                            Transferi Tamamla
                          </button>
                        )}

                        {inCallLinesCount >= 2 && canConference && (
                          <button
                            type="button"
                            onClick={() =>
                              isConferenceActive ? webphoneManager.stopConference() : webphoneManager.startConference()
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white ${
                              isConferenceActive ? "bg-amber-600" : "bg-emerald-600"
                            }`}
                          >
                            <GitMerge size={14} />
                            {isConferenceActive ? "Konferansı Ayır" : "Konferansta Birleştir"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {isNewCallOpen && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newCallInput}
                        onChange={(e) => setNewCallInput(e.target.value.replace(/[^0-9*#+]/g, ""))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newCallInput.trim()) {
                            handleCall(newCallInput.trim());
                            setNewCallInput("");
                            setIsNewCallOpen(false);
                          }
                        }}
                        placeholder="2. hat için dahili veya telefon numarası girin..."
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newCallInput.trim()) return;
                          handleCall(newCallInput.trim());
                          setNewCallInput("");
                          setIsNewCallOpen(false);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        <Phone size={13} />
                        Ara
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsNewCallOpen(false)}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}

                  {hasMultipleLines && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {lines.map((line) => {
                        const isSelected = line.id === activeLineId;
                        const { name, num, qName } = resolveLineLabel(line);
                        return (
                          <div
                            key={line.id}
                            onClick={() => webphoneManager.switchLine(line.id)}
                            className={`cursor-pointer p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                              isSelected
                                ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                                : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40"
                            }`}
                          >
                            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-extrabold text-slate-500">
                                Hat {line.lineNumber}
                              </span>
                              {qName && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${lightBg} ${text} border ${borderLight}`}>
                                  {qName}
                                </span>
                              )}
                              <span className="font-bold text-xs text-slate-800 dark:text-white truncate">
                                {name ? `${name} (${num})` : num}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHangup(line.id);
                              }}
                              className="h-7 w-7 rounded-lg bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white flex items-center justify-center"
                            >
                              <PhoneOff size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Main Active Call Card */}
              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between gap-4 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Caller Info */}
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 ${
                        callStatus === "InCall"
                          ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                          : "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                      }`}
                    >
                      <Phone
                        size={24}
                        className={callStatus === "Calling" || callStatus === "Ringing" ? "animate-bounce" : ""}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            callStatus === "InCall"
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                              : "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current animate-ping" />
                          {callStatus === "InCall"
                            ? isOnHold
                              ? "Beklemede"
                              : `Görüşme Aktif • ${formatDuration(callDuration)}`
                            : callStatus === "Ringing"
                            ? "Gelen Çağrı..."
                            : "Aranıyor..."}
                        </span>
                        {queueName && (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${lightBg} ${text} ${borderLight}`}
                          >
                            Kuyruk: {queueName}
                          </span>
                        )}
                        {callStatus === "InCall" && isRecordingPaused && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 animate-pulse">
                            <ShieldAlert size={12} />
                            KVKK: Ses Kaydı Maskeleniyor
                          </span>
                        )}
                        {resolvedDisplayName && (
                          <span className="text-[10px] font-bold text-slate-400">
                            {resolvedIsInternal ? "Dahili Abone" : "Kayıtlı Kişi"}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-wide">
                          {resolvedDisplayName
                            ? resolvedDisplayName
                            : queueName
                            ? `${displayPhoneNum} • ${queueName}`
                            : displayPhoneNum}
                        </h2>
                        {resolvedDisplayName && (
                          <span className="text-sm font-mono font-semibold text-slate-400">
                            {queueName ? `${displayPhoneNum} • ${queueName}` : displayPhoneNum}
                          </span>
                        )}
                        {!resolvedDisplayName && canSaveContact && (
                          <button
                            type="button"
                            onClick={() => {
                              setNewContact({ firstName: "", lastName: "", email: "" });
                              setContactError("");
                              setIsAddContactOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-all"
                          >
                            <UserPlus size={13} />
                            Rehbere Ekle
                          </button>
                        )}
                        {!maskPhoneNumbers && remoteNumber && (
                          <button
                            type="button"
                            onClick={() =>
                              window.dispatchEvent(
                                new CustomEvent("OPEN_CUSTOMER_360", {
                                  detail: { phone: remoteNumber, name: resolvedDisplayName || "" },
                                })
                              )
                            }
                            title="Müşteri 360° Tüm Kanal Geçmişini Aç (Alt+C)"
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border ${lightBg} ${text} ${borderLight} text-[11px] font-extrabold transition-all cursor-pointer`}
                          >
                            <span>360° Kart</span>
                          </button>
                        )}
                        {canCtiScreenPop && userCtiConfig?.enabled !== false && userCtiConfig?.screen_pop_url && (
                          <button
                            type="button"
                            onClick={() => webphoneManager.triggerCtiScreenPop(null, "manual", true)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg ${bg} ${hover} text-white text-[11px] font-bold shadow-sm transition-all`}
                            title="Müşteri CRM ekranını yeni sekmede aç"
                          >
                            <ExternalLink size={13} />
                            {userCtiConfig.crm_name ? `${userCtiConfig.crm_name} Aç (2. Sekme)` : "Müşteri CRM Aç (2. Sekme)"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Call Control Buttons */}
                  <div className="flex flex-wrap items-center gap-2.5 relative">
                    {callStatus === "Ringing" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAnswerCall()}
                          className="h-11 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20"
                        >
                          <Phone size={16} className="fill-current" />
                          Yanıtla
                        </button>
                        {canRejectCall && (
                          <button
                            type="button"
                            onClick={() => handleHangup()}
                            className="h-11 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-rose-500/20"
                          >
                            <PhoneOff size={16} />
                            Reddet
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={toggleMute}
                          title={isMuted ? "Sesi Aç" : "Sessize Al"}
                          className={`h-11 w-11 rounded-2xl border flex items-center justify-center transition-all ${
                            isMuted
                              ? "bg-rose-100 border-rose-300 text-rose-600 dark:bg-rose-500/20 dark:border-rose-500/50 dark:text-rose-400"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                        </button>

                        <button
                          type="button"
                          onClick={toggleHold}
                          title={isOnHold ? "Devam Et" : "Beklemeye Al"}
                          className={`h-11 w-11 rounded-2xl border flex items-center justify-center transition-all ${
                            isOnHold
                              ? "bg-amber-100 border-amber-300 text-amber-600 dark:bg-amber-500/20 dark:border-amber-500/50 dark:text-amber-400"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {isOnHold ? <Play size={18} /> : <Pause size={18} />}
                        </button>

                        <button
                          type="button"
                          onClick={cycleNoiseMode}
                          title={`Gürültü Engelleme: ${getNoiseModeLabel(noiseSuppressionMode)} (Çağrıda Canlı Değiştir)`}
                          className={`h-11 px-3 rounded-2xl border flex items-center gap-1.5 justify-center text-[10px] font-extrabold uppercase tracking-wide transition-all ${
                            noiseSuppressionMode === "ai"
                              ? `${lightBg} ${text} ${borderLight}`
                              : noiseSuppressionMode === "standard"
                              ? "bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                              : "bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-500"
                          }`}
                        >
                          <Sparkles size={16} />
                          <span className="hidden sm:inline">
                            {noiseSuppressionMode === "ai"
                              ? "AI Ses"
                              : noiseSuppressionMode === "standard"
                              ? "Standart"
                              : "Ham"}
                          </span>
                        </button>

                        {callStatus === "InCall" && canPauseRecording && (
                          <button
                            type="button"
                            onClick={toggleRecordingPause}
                            disabled={recordingPauseBusy}
                            title={
                              isRecordingPaused
                                ? "Ses Kaydına Devam Et (Maskelemeyi Bitir)"
                                : "KVKK & Kredi Kartı Bilgisi İçin Ses Kaydını Duraklat"
                            }
                            className={`h-11 px-3 rounded-2xl border flex items-center gap-1.5 justify-center text-[10px] font-extrabold uppercase tracking-wide transition-all disabled:opacity-50 ${
                              isRecordingPaused
                                ? "bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-500/20 dark:border-amber-500/50 dark:text-amber-300 animate-pulse"
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                            }`}
                          >
                            {isRecordingPaused ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
                            <span className="hidden sm:inline">
                              {isRecordingPaused ? "Kaydı Sürdür" : "Kaydı Duraklat"}
                            </span>
                          </button>
                        )}

                        {/* Transfer Button */}
                        {callStatus === "InCall" && canTransfer && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setTransferOpen((p) => !p);
                                setConferenceOpen(false);
                              }}
                              title="Çağrı Transferi"
                              className={`h-11 w-11 rounded-2xl border flex items-center justify-center transition-all ${
                                transferOpen
                                  ? "bg-violet-100 border-violet-300 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400"
                                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                              }`}
                            >
                              <ArrowRight size={18} />
                            </button>
                            {transferOpen && (
                              <div className="absolute right-0 top-13 w-72 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-30 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase">
                                    Çağrı Transferi
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setTransferOpen(false)}
                                    className="text-slate-400 hover:text-slate-600"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Hedef Dahili veya No (Örn: 1001)"
                                  value={transferTarget}
                                  onChange={(e) => setTransferTarget(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none"
                                />
                                <div className="grid grid-cols-1 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!transferTarget.trim()) return;
                                      const m = findContactByPhone(transferTarget.trim(), contacts, directory);
                                      webphoneManager.blindTransfer(transferTarget.trim(), m?.displayName || "");
                                      setTransferOpen(false);
                                      setTransferTarget("");
                                    }}
                                    className="w-full py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                                  >
                                    <ArrowRight size={14} />
                                    Kontrolsüz Transfer
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!transferTarget.trim()) return;
                                      const m = findContactByPhone(transferTarget.trim(), contacts, directory);
                                      webphoneManager.startAttendedTransfer(
                                        transferTarget.trim(),
                                        m?.displayName || ""
                                      );
                                      setTransferOpen(false);
                                      setTransferTarget("");
                                    }}
                                    className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                                  >
                                    <PhoneForwarded size={14} />
                                    Kontrollü Transfer
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Conference Button */}
                        {callStatus === "InCall" && canConference && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setConferenceOpen((p) => !p);
                                setTransferOpen(false);
                              }}
                              title="Konferans Görüşmesi"
                              className={`h-11 w-11 rounded-2xl border flex items-center justify-center transition-all ${
                                conferenceOpen || isConferenceActive
                                  ? "bg-emerald-100 border-emerald-300 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                              }`}
                            >
                              <Radio size={18} />
                            </button>
                            {conferenceOpen && (
                              <div className="absolute right-0 top-13 w-72 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-30 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase">
                                    Konferans Yönetimi
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setConferenceOpen(false)}
                                    className="text-slate-400 hover:text-slate-600"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Katılımcı Dahili veya No (Örn: 1002)"
                                  value={conferenceTarget}
                                  onChange={(e) => setConferenceTarget(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!conferenceTarget.trim()) return;
                                    const m = findContactByPhone(conferenceTarget.trim(), contacts, directory);
                                    webphoneManager.addParticipantToConference(
                                      conferenceTarget.trim(),
                                      m?.displayName || ""
                                    );
                                    setConferenceOpen(false);
                                    setConferenceTarget("");
                                  }}
                                  className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                                >
                                  <UserPlus size={14} />
                                  Ara &amp; Konferansa Ekle
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Add 2nd Line Button */}
                        <button
                          type="button"
                          onClick={() => setIsNewCallOpen((p) => !p)}
                          title="Yeni Çağrı / 2. Hat Ekle"
                          className={`h-11 w-11 rounded-2xl border flex items-center justify-center transition-all ${
                            isNewCallOpen
                              ? `${lightBg} ${text} ${borderLight}`
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                          }`}
                        >
                          <PhoneCall size={18} />
                        </button>

                        {/* Live Translator Toggle Button */}
                        {hasAnyTranslatorPerm && (
                          <button
                            type="button"
                            onClick={() => setIsTranslatorOpen((p) => !p)}
                            title="Canlı Konuşma & Çeviri Akışı"
                            className={`h-11 w-11 rounded-2xl border flex items-center justify-center transition-all ${
                              isTranslatorOpen
                                ? `${bg} text-white border-transparent shadow-sm`
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                            }`}
                          >
                            <Languages size={18} />
                          </button>
                        )}

                        {/* Single Clean Hangup Button */}
                        <button
                          type="button"
                          onClick={() => handleHangup()}
                          title="Çağrıyı Sonlandır"
                          className="h-11 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-rose-500/20 transition-all"
                        >
                          <PhoneOff size={16} />
                          <span>Kapat</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Live Hardware Microphone & Incoming Customer RTP Speaker Smooth Level Bars */}
                {(callStatus === "InCall" || callStatus === "Calling") && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-3.5 py-2.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                    {/* Microphone Bar (Direct Hardware Input) */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-5 w-5 rounded-lg flex items-center justify-center transition-colors ${
                              audioLevels.micLevel > 2
                                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                                : "bg-slate-200/70 text-slate-500 dark:bg-slate-700/70 dark:text-slate-400"
                            }`}
                          >
                            <Mic size={12} />
                          </span>
                          <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                            Mikrofon
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            (Donanım)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isMuted && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                              WebPhone Sessizde
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-mono font-extrabold ${
                              audioLevels.micLevel > 2
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-slate-400"
                            }`}
                          >
                            {audioLevels.micLevel}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-700/60 overflow-hidden p-0.5">
                        <div
                          className="h-full rounded-full transition-all duration-75 ease-out bg-gradient-to-r from-emerald-400 via-emerald-500 to-amber-400"
                          style={{
                            width: `${
                              audioLevels.micLevel > 0 ? Math.max(4, audioLevels.micLevel) : 0
                            }%`
                          }}
                        />
                      </div>
                    </div>

                    {/* Speaker Bar (Incoming Customer RTP Stream - Independent of OS/Headset Volume) */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-5 w-5 rounded-lg flex items-center justify-center transition-colors ${
                              audioLevels.speakerLevel > 2
                                ? "bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400"
                                : "bg-slate-200/70 text-slate-500 dark:bg-slate-700/70 dark:text-slate-400"
                            }`}
                          >
                            <Volume2 size={12} />
                          </span>
                          <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                            Hoparlör
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            (Müşteri Sesi)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isOnHold && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                              Beklemede
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-mono font-extrabold ${
                              audioLevels.speakerLevel > 2
                                ? "text-sky-600 dark:text-sky-400"
                                : "text-slate-400"
                            }`}
                          >
                            {audioLevels.speakerLevel}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-700/60 overflow-hidden p-0.5">
                        <div
                          className="h-full rounded-full transition-all duration-75 ease-out bg-gradient-to-r from-sky-400 via-emerald-500 to-amber-400"
                          style={{
                            width: `${
                              audioLevels.speakerLevel > 0 ? Math.max(4, audioLevels.speakerLevel) : 0
                            }%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Live CTI Customer CRM Card */}
                {canCtiScreenPop &&
                  (wpState.ctiCustomerInfo?.local_contact ||
                    wpState.ctiCustomerInfo?.customer_summary?.name ||
                    wpState.ctiCustomerInfo?.external_crm ||
                    (wpState.ctiCustomerInfo?.upcoming_appointments || []).length > 0) && (
                    <div className={`p-3.5 rounded-2xl border ${borderLight} ${lightBg} flex flex-wrap items-center justify-between gap-3`}>
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`p-2 rounded-xl bg-white dark:bg-slate-900 ${text} shadow-xs shrink-0`}>
                          <Database size={16} />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Canlı CRM Müşteri Kartı
                            </span>
                            {wpState.ctiCustomerInfo?.customer_summary?.segment && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${bg} text-white`}>
                                {wpState.ctiCustomerInfo.customer_summary.segment}
                              </span>
                            )}
                            {wpState.ctiCustomerInfo?.customer_summary?.company && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                <Building2 size={12} />
                                {wpState.ctiCustomerInfo.customer_summary.company}
                              </span>
                            )}
                          </div>
                          {wpState.ctiCustomerInfo?.customer_summary?.notes && (
                            <p className="text-xs text-slate-700 dark:text-slate-200 font-medium">
                              Not: {wpState.ctiCustomerInfo.customer_summary.notes}
                            </p>
                          )}
                          {(wpState.ctiCustomerInfo?.upcoming_appointments || []).length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                              {wpState.ctiCustomerInfo.upcoming_appointments.map((apt, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200"
                                >
                                  <Calendar size={11} className={text} />
                                  Randevu: {apt.date} {apt.time} ({apt.status})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {userCtiConfig?.screen_pop_url && (
                        <button
                          type="button"
                          onClick={() => webphoneManager.triggerCtiScreenPop(null, "manual", true)}
                          className={`px-3 py-1.5 rounded-xl ${bg} ${hover} text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs`}
                        >
                          <ExternalLink size={13} />
                          CRM&apos;de Görüntüle
                        </button>
                      )}
                    </div>
                  )}

                {/* Integrated Quick Disposition & Call Note Bar */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase flex items-center gap-1 mr-1">
                        <Tag size={11} />
                        Sonuç Kodu:
                      </span>
                      {dispositionCodes.map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => handleSaveCallDispositionAndNote(code)}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                            selectedDisposition === code
                              ? `${bg} text-white ${border}`
                              : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                          }`}
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      {canAiNoteAssistant && (
                        <button
                          type="button"
                          onClick={() => handleGenerateAiNote(activeCallId)}
                          disabled={aiNoteLoading}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold border flex items-center gap-1.5 transition-all cursor-pointer ${lightBg} ${text} ${borderLight} disabled:opacity-50`}
                          title="Görüşme konuşmalarından yapay zeka ile otomatik not ve sonuç kodu çıkar"
                        >
                          {aiNoteLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                          <span>{aiNoteLoading ? "AI Not Çıkarıyor..." : "AI Not Çıkar"}</span>
                        </button>
                      )}
                      {noteSaved && (
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check size={13} />
                          Kaydedildi
                        </span>
                      )}
                    </div>
                  </div>

                  {aiNoteError && (
                    <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center justify-between gap-2">
                      <span>{aiNoteError}</span>
                      <button type="button" onClick={() => setAiNoteError("")} className="opacity-70 hover:opacity-100">
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  {aiNoteSuggestion?.note && (
                    <div className={`p-2.5 rounded-xl border ${borderLight} ${lightBg} flex flex-wrap items-center justify-between gap-2`}>
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <Sparkles size={14} className={`${text} shrink-0 mt-0.5`} />
                        <div className="text-xs text-slate-700 dark:text-slate-200 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <span className={`text-[10px] font-extrabold uppercase ${text}`}>AI Not Önerisi</span>
                            {aiNoteSuggestion.provider && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-white/80 dark:bg-slate-900/80 text-slate-500 border border-slate-200/70 dark:border-slate-700">
                                {aiNoteSuggestion.provider.toUpperCase()} {aiNoteSuggestion.model ? `• ${aiNoteSuggestion.model}` : ""}
                              </span>
                            )}
                          </div>
                          <p className="font-medium leading-snug">{aiNoteSuggestion.note}</p>
                        </div>
                      </div>
                      {callNote !== aiNoteSuggestion.note && (
                        <button
                          type="button"
                          onClick={() => {
                            setCallNote(aiNoteSuggestion.note);
                            if (aiNoteSuggestion.disposition) {
                              setSelectedDisposition(aiNoteSuggestion.disposition);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg ${bg} ${hover} text-white text-[10px] font-extrabold shrink-0`}
                        >
                          Not Alanına Uygula
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 flex items-center">
                      <input
                        ref={noteInputRef}
                        type="text"
                        value={callNote}
                        onChange={(e) => setCallNote(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveCallDispositionAndNote()}
                        placeholder="Görüşme ile ilgili kısa not ekleyin veya mikrofonla dikte edin..."
                        className="w-full pl-3.5 pr-10 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 text-xs font-medium text-slate-800 dark:text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={toggleNoteDictation}
                        title={isDictatingNote ? "Sesli Dikteyi Durdur" : "Sesle Not Yaz (Dikte - Türkçe)"}
                        className={`absolute right-1.5 h-7 w-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                          isDictatingNote
                            ? "bg-rose-600 text-white animate-pulse shadow-xs"
                            : "bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {isDictatingNote ? <MicOff size={14} /> : <Mic size={14} />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveCallDispositionAndNote()}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all"
                    >
                      <Save size={13} />
                      Kaydet
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Translator Chat Panel (Toggled from the call control bar button, or hidden background VAD for AI Note Assistant) */}
              {(hasAnyTranslatorPerm || canAiNoteAssistant) && (
                <div className={hasAnyTranslatorPerm && isTranslatorOpen ? "flex-1 min-h-[240px]" : "hidden"}>
                  <LiveTranslatorPanel
                    backendHost={backendHost}
                    callId={activeCallId}
                    callStatus={callStatus}
                    canLiveTranslate={canLiveTranslate || canAiNoteAssistant}
                    canVoiceInterpret={canVoiceInterpret}
                    isActiveInstance={Boolean(isWebphoneScreenActive)}
                    onClose={() => setIsTranslatorOpen(false)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* In-Call Add Contact Modal */}
      {isAddContactOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-slate-800 dark:text-white font-bold">
                <div className="p-2 bg-rose-100 dark:bg-rose-950/40 text-rose-600 rounded-xl">
                  <UserPlus size={18} />
                </div>
                <span>Rehbere Kişi Ekle</span>
              </div>
              <button
                onClick={() => setIsAddContactOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {contactError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-medium">
                {contactError}
              </div>
            )}

            <div className="space-y-3 text-left">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Telefon Numarası
                </label>
                <input
                  type="text"
                  value={displayPhoneNum || dialNumber}
                  disabled
                  className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-mono font-bold border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Ad *</label>
                  <input
                    type="text"
                    value={newContact.firstName}
                    onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })}
                    placeholder="Örn: Ahmet"
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-sm border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Soyad *</label>
                  <input
                    type="text"
                    value={newContact.lastName}
                    onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })}
                    placeholder="Örn: Yılmaz"
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-sm border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  E-posta (İsteğe Bağlı)
                </label>
                <input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="ahmet@ornek.com"
                  className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-sm border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsAddContactOpen(false)}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-sm shadow-rose-500/20 transition-all cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={handleSaveContact}
                disabled={savingContact}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingContact ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
