import React, { useState, useEffect, useRef } from "react";
import * as SIP from "sip.js";
import { Phone, PhoneOff, ShieldAlert, Wifi, WifiOff, MessageSquare, Send, X, Clock, ArrowRight, PhoneCall, Radio, Shield, Fingerprint, CheckCircle, AlertTriangle } from "lucide-react";
import { playRingtoneSound, stopRingtoneSound } from "../../utils/audioHelper";

export default function CallChatWidget({
  onActiveCall = () => {},
  backendHost = "localhost:8000",
  currentUser
}) {
  // Expanded/Collapsed State
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("phone"); // phone, traffic, chat

  // Dynamic WebRTC Config
  const [webrtcConfig, setWebrtcConfig] = useState(null);
  const agentExtension = webrtcConfig?.agentExtension || "";
  const password = webrtcConfig?.password || "";
  const asteriskWssUrl = webrtcConfig?.asteriskWssUrl || "";
  const API_BASE = typeof window !== "undefined" ? `${window.location.protocol}//${backendHost}` : `http://${backendHost}`;

  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchConfig = async () => {
      setIsLoadingConfig(true);
      try {
        let headers = { "Content-Type": "application/json" };
        if (currentUser && currentUser.id) {
          headers["X-User-ID"] = currentUser.id.toString();
        } else if (currentUser && currentUser.role === 'admin') {
          headers["X-User-ID"] = "admin";
        }

        const res = await fetch(`${API_BASE}/api/webrtc/config`, { headers });
        if (res.ok) {
          const config = await res.json();
          if (isMounted) setWebrtcConfig(config);
        } else {
          console.error("Failed to fetch WebRTC config");
        }
      } catch (err) {
        console.error("Error fetching WebRTC config:", err);
      } finally {
        if (isMounted) setIsLoadingConfig(false);
      }
    };
    fetchConfig();
    return () => { isMounted = false; };
  }, [API_BASE, currentUser]);

  // ----------------------------------------------------
  // 1. WebRTC Softphone States & References
  // ----------------------------------------------------
  const [registered, setRegistered] = useState(false);
  const [session, setSession] = useState(null);
  const [callStatus, setCallStatus] = useState("Idle"); // Idle, Ringing, InCall
  const [error, setError] = useState("");
  const [callDuration, setCallDuration] = useState(0);

  // Voice Biometric States
  const [biometricStatus, setBiometricStatus] = useState(null);
  const [savingVoiceprint, setSavingVoiceprint] = useState(false);

  const userAgentRef = useRef(null);
  const audioElRef = useRef(null);

  // Ringtone playback side-effect
  useEffect(() => {
    if (callStatus === "Ringing") {
      const selectedRingtone = typeof window !== "undefined" ? localStorage.getItem("ringtone") || "classic" : "classic";
      const ringtoneSpeaker = typeof window !== "undefined" ? localStorage.getItem("selected_ringtone_speaker") || null : null;
      playRingtoneSound(selectedRingtone, ringtoneSpeaker);
    } else {
      stopRingtoneSound();
    }
    return () => stopRingtoneSound();
  }, [callStatus]);

  // ----------------------------------------------------
  // 2. Active Call & Chat Traffic States
  // ----------------------------------------------------
  const [activeCalls, setActiveCalls] = useState([]);
  const [chatSessions, setChatSessions] = useState([
    {
      id: "chat-1",
      customerName: "Ahmet Yılmaz",
      platform: "WhatsApp",
      unread: 1,
      messages: [
        { sender: "customer", text: "Merhaba, Asterisk WebRTC bağlantı ayarlarında bir sorun yaşıyorum. Yardımcı olabilir misiniz?", time: "23:44" }
      ]
    },
    {
      id: "chat-2",
      customerName: "Elif Kaya",
      platform: "Telegram",
      unread: 2,
      messages: [
        { sender: "customer", text: "Yarın saat 14:00 için asistan Eda üzerinden randevu almıştım. Bunu teyit etmek istiyorum.", time: "23:40" }
      ]
    }
  ]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatInput, setChatInput] = useState("");
  
  // Internal Chat States
  const [chatTab, setChatTab] = useState("customer"); // "customer" | "internal"
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
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);

  // ----------------------------------------------------
  // WebRTC Softphone Call Duration Hook
  // ----------------------------------------------------
  useEffect(() => {
    let interval = null;
    if (callStatus === "InCall") {
      setCallDuration(0);
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStatus]);

  // ----------------------------------------------------
  // Live Voice Biyometrik Doğrulama & Deepfake Polling Hook
  // ----------------------------------------------------
  useEffect(() => {
    let bioInterval = null;
    
    if (callStatus === "InCall" && session) {
      const fetchBiometrics = async () => {
        try {
          // Get current active calls to resolve call ID
          const activeCallRes = await fetch(`${API_BASE}/api/calls/active`);
          if (!activeCallRes.ok) return;
          const activeCallData = await activeCallRes.json();
          
          // Match call involving our agent extension
          const currentCall = activeCallData.find(c => 
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
        } catch (err) {
          console.error("Biyometrik doğrulama yüklenirken hata:", err);
        }
      };
      
      fetchBiometrics();
      bioInterval = setInterval(fetchBiometrics, 2000);
    } else {
      setBiometricStatus(null);
    }
    
    return () => {
      if (bioInterval) clearInterval(bioInterval);
    };
  }, [callStatus, session, activeCalls, agentExtension]);

  const handleSaveVoiceprint = async () => {
    if (!biometricStatus || !biometricStatus.caller_number) return;
    setSavingVoiceprint(true);
    try {
      const res = await fetch(`${API_BASE}/api/contacts/${biometricStatus.caller_number}/voiceprint/register`, {
        method: "POST"
      });
      if (res.ok) {
        alert("Ses izi şifrelenip başarıyla kaydedildi!");
        // Instantly trigger re-check
        if (session) {
          const activeCallRes = await fetch(`${API_BASE}/api/calls/active`);
          if (activeCallRes.ok) {
            const activeCallData = await activeCallRes.json();
            const currentCall = activeCallData.find(c => 
              c.caller_number === agentExtension || 
              c.callee_number === agentExtension
            ) || activeCallData[0];
            if (currentCall) {
              const bioRes = await fetch(`${API_BASE}/api/calls/active/biometrics/${currentCall.id}`);
              if (bioRes.ok) {
                const bioData = await bioRes.json();
                setBiometricStatus(bioData);
              }
            }
          }
        }
      } else {
        const errData = await res.json();
        alert(errData.detail || "Ses izi kaydedilemedi.");
      }
    } catch (err) {
      console.error("Ses izi kaydetme hatası:", err);
    } finally {
      setSavingVoiceprint(false);
    }
  };

  // ----------------------------------------------------
  // SIP.js WebRTC Registration Hook
  // ----------------------------------------------------
  useEffect(() => {
    if (!webrtcConfig) return;
    const { asteriskWssUrl, agentExtension, password } = webrtcConfig;
    if (!asteriskWssUrl || !agentExtension) return;

    setError("");
    const wssServer = asteriskWssUrl;
    const hostOnly = wssServer.split('/')[2].split(':')[0];
    const uri = SIP.UserAgent.makeURI(`sip:${agentExtension}@${hostOnly}`);
    
    const transportOptions = {
      server: wssServer,
      traceSip: true
    };

    const resolvedViaHost = webrtcConfig.viaHost || hostOnly;
    const userAgentOptions = {
      uri: uri,
      contactURI: uri,
      transportOptions: transportOptions,
      viaHost: resolvedViaHost,
      contactName: agentExtension,
      authorizationUsername: agentExtension,
      authorizationPassword: password,
      displayName: `Temsilci ${agentExtension}`,
      hackIpInContact: true,
      delegate: {
        onInvite: (invite) => {
          console.log("[WebRTC] Gelen arama alindi!");
          setSession(invite);
          setCallStatus("Ringing");
          
          // Auto-expand widget and switch to phone tab when call arrives
          setIsOpen(true);
          setActiveTab("phone");
          
          const sipCallId = invite.request.callId; 
          onActiveCall(sipCallId);

          invite.stateChange.addListener((state) => {
            console.log(`[WebRTC] Arama Durumu degisti: ${state}`);
            if (state === SIP.SessionState.Established) {
              setCallStatus("InCall");
            } else if (state === SIP.SessionState.Terminated) {
              setCallStatus("Idle");
              setSession(null);
              onActiveCall(null);
            }
          });
        }
      }
    };

    const ua = new SIP.UserAgent(userAgentOptions);
    userAgentRef.current = ua;

    ua.transport.onDisconnect = (error) => {
      console.error("[WebRTC] Transport Disconnect:", error);
      if (error) {
        setError(`Asterisk 8088 Portuna Erişilemiyor (${error.message || 'Erişim Engellendi'})`);
      }
    };

    ua.start()
      .then(() => {
        const registererOptions = {};
        const registerer = new SIP.Registerer(ua, registererOptions);
        
        registerer.stateChange.addListener((state) => {
          console.log(`[WebRTC] SIP Registerer durumu: ${state}`);
          if (state === SIP.RegistererState.Registered) {
            setRegistered(true);
            setError("");
          } else {
            setRegistered(false);
          }
        });

        return registerer.register();
      })
      .catch((err) => {
        console.error("[WebRTC] Baglanti/Register hatasi:", err);
        setError(`WebRTC Bağlantı Hatası: ${err.message || 'Sunucu Yanıt Vermedi'}`);
        setRegistered(false);
      });

    return () => {
      if (userAgentRef.current) {
        userAgentRef.current.stop();
      }
    };
  }, [webrtcConfig]);

  // softphone action callbacks
  const answerCall = async () => {
    if (!session) return;
    try {
      const selectedMic = typeof window !== "undefined" ? localStorage.getItem("selected_mic") : null;
      const constraints = { 
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true, 
        video: false 
      };
      await session.accept({
        sessionDescriptionHandlerOptions: {
          constraints: constraints
        }
      });
      
      const peerConnection = session.sessionDescriptionHandler.peerConnection;
      if (peerConnection) {
        const selectedSpeaker = typeof window !== "undefined" ? localStorage.getItem("selected_speaker") : null;
        
        const receivers = peerConnection.getReceivers();
        receivers.forEach((receiver) => {
          if (receiver.track && receiver.track.kind === "audio") {
            const remoteStream = new MediaStream([receiver.track]);
            if (audioElRef.current) {
              if (selectedSpeaker && typeof audioElRef.current.setSinkId === "function") {
                audioElRef.current.setSinkId(selectedSpeaker).catch(e => console.warn("[WebRTC] setSinkId error:", e));
              }
              audioElRef.current.srcObject = remoteStream;
              audioElRef.current.play().catch(e => console.error("[WebRTC] Ses oynatılamadı:", e));
            }
          }
        });

        peerConnection.addEventListener("track", (event) => {
          if (event.track.kind === "audio" && audioElRef.current) {
            const remoteStream = new MediaStream([event.track]);
            if (selectedSpeaker && typeof audioElRef.current.setSinkId === "function") {
              audioElRef.current.setSinkId(selectedSpeaker).catch(e => console.warn("[WebRTC] setSinkId track error:", e));
            }
            audioElRef.current.srcObject = remoteStream;
            audioElRef.current.play().catch(e => console.error("[WebRTC] Ses oynatılamadı:", e));
          }
        });
      }
      setCallStatus("InCall");
    } catch (err) {
      console.error("[WebRTC] Arama cevaplama hatasi:", err);
      setError(`Arama cevaplanırken hata oluştu: ${err.message}`);
    }
  };

  const hangupCall = () => {
    if (!session) return;
    if (callStatus === "Ringing") {
      session.reject();
    } else {
      session.bye();
    }
    setCallStatus("Idle");
    setSession(null);
    onActiveCall(null);
  };

  // Handle action triggers from CRM panel
  useEffect(() => {
    const handleSoftphoneAction = (e) => {
      const { type, target, mode, active } = e.detail;
      console.log(`[Softphone] Arayüz aksiyonu alındı:`, type, target, mode, active);
      
      if (type === "hangup") {
        hangupCall();
      } else if (type === "hold") {
        if (!session) return;
        if (active) {
          session.hold().catch(err => console.error("[WebRTC] Bekletme hatası:", err));
        } else {
          session.unhold().catch(err => console.error("[WebRTC] Beklemeden çıkarma hatası:", err));
        }
      } else if (type === "transfer") {
        if (!session) return;
        if (mode === "blind") {
          try {
            const domain = asteriskWssUrl.split('/')[2].split(':')[0];
            const targetURI = SIP.UserAgent.makeURI(`sip:${target}@${domain}`);
            session.refer(targetURI);
            console.log(`[WebRTC] Kontrolsüz transfer tetiklendi: ${target}`);
          } catch (err) {
            console.error("[WebRTC] Transfer hatası:", err);
          }
        } else {
          // Attended transfer simulation
          session.hold().then(() => {
            console.log(`[WebRTC] Görüşerek transfer başlatıldı. Orijinal çağrı bekletmede. Yeni çağrı yapılıyor: ${target}`);
            // In attended transfer, the agent places the client on hold first
          }).catch(err => console.error("[WebRTC] Bekletme hatası:", err));
        }
      } else if (type === "conference") {
        console.log(`[WebRTC] Konferans odasına ${target} ekleniyor...`);
        // Conference trigger log/dispatch
      }
    };

    window.addEventListener("softphone-action", handleSoftphoneAction);
    return () => window.removeEventListener("softphone-action", handleSoftphoneAction);
  }, [session, callStatus]);

  // ----------------------------------------------------
  // Active Calls Polling
  // ----------------------------------------------------
  useEffect(() => {
    fetchActiveCalls();
    const interval = setInterval(fetchActiveCalls, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveCalls = () => {
    fetch(`${API_BASE}/api/calls/active`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setActiveCalls(data);
        }
      })
      .catch(err => console.error("Widget active calls fetch error:", err));
  };

  // ----------------------------------------------------
  // Chat Actions
  // ----------------------------------------------------
  const handleSendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChatId) return;

    const timeString = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    const newMsg = { sender: "agent", text: chatInput.trim(), time: timeString, status: "sent" };

    if (chatTab === "customer") {
      setChatSessions(prev =>
        prev.map(chat => {
          if (chat.id === activeChatId) {
            return { ...chat, messages: [...chat.messages, newMsg] };
          }
          return chat;
        })
      );
      setChatInput("");

      setTimeout(() => {
        const autoReply = { sender: "customer", text: "Teşekkürler, dönüşünüzü bekliyorum.", time: timeString };
        setChatSessions(prev =>
          prev.map(chat => {
            if (chat.id === activeChatId) {
              return { ...chat, messages: [...chat.messages, autoReply] };
            }
            return chat;
          })
        );
      }, 3000);
    } else {
      setInternalChatSessions(prev =>
        prev.map(chat => {
          if (chat.id === activeChatId) {
            return { ...chat, messages: [...chat.messages, newMsg] };
          }
          return chat;
        })
      );
      setChatInput("");

      // Simulate seen status
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

      // Simulate reply
      setTimeout(() => {
        const replyTime = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
        const autoReply = { sender: "customer", text: "Anlaşıldı, ilgileniyorum.", time: replyTime, status: "seen" };
        setInternalChatSessions(prev =>
          prev.map(chat => {
            if (chat.id === activeChatId) {
              return { ...chat, messages: [...chat.messages, autoReply] };
            }
            return chat;
          })
        );
      }, 4000);
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

  const getUnreadChatCount = () => {
    return chatSessions.reduce((acc, c) => acc + c.unread, 0);
  };

  const formatSeconds = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalTrafficCount = activeCalls.length + getUnreadChatCount();
  const selectedChat = chatTab === "customer" 
    ? chatSessions.find(c => c.id === activeChatId)
    : internalChatSessions.find(c => c.id === activeChatId);

  return (
    <div className="fixed bottom-6 right-6 z-[100] font-sans antialiased">
      
      {/* Hidden audio element to play remote call voice */}
      <audio ref={audioElRef} autoPlay style={{ display: "none" }} />

      {/* Unified Collapsed Pill Button */}
      {!isOpen && (
        <div
          onClick={() => !isLoadingConfig && setIsOpen(true)}
          className={`flex items-center gap-3 px-4.5 py-3 bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/85 rounded-full text-slate-800 dark:text-white shadow-xl ${isLoadingConfig ? 'cursor-wait opacity-70' : 'hover:bg-slate-50 dark:hover:bg-slate-800 hover:shadow-2xl cursor-pointer'} transition-all duration-300 select-none backdrop-blur-md font-bold text-xs`}
        >
          {/* Extension Status Dot */}
          <span className="relative flex h-2.5 w-2.5">
            {isLoadingConfig ? (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-300 dark:bg-slate-600 animate-pulse"></span>
            ) : registered ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            )}
          </span>
          
          {/* Label */}
          <span className="tracking-wide">
            {isLoadingConfig ? "Bağlanıyor..." : registered ? `Dahili ${agentExtension}` : `Dahili ${agentExtension || 'X'} (Bağlı Değil)`}
          </span>
        </div>
      )}

      {/* Expanded Widget Window */}
      {isOpen && (
        <div className="w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
          
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-rose-500 via-rose-600 to-pink-600 text-white flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {registered ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-300"></span>
                )}
              </span>
              <h4 className="font-extrabold text-xs tracking-wider uppercase">
                Temsilci Konsolu ({agentExtension})
              </h4>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Sub Navigation Tabs (3 Tabs) */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-[10px] font-extrabold uppercase tracking-wide">
            
            {/* Tab 1: Phone */}
            <button
              onClick={() => {
                setActiveTab("phone");
                setActiveChatId(null);
              }}
              className={`flex-1 py-3 text-center transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === "phone"
                  ? "text-primary dark:text-rose-450 border-rose-500"
                  : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-white"
              }`}
            >
              <Radio size={11} className={callStatus !== "Idle" ? "animate-pulse text-primary" : ""} />
              <span>Telefon</span>
            </button>

            {/* Tab 2: Active Calls */}
            <button
              onClick={() => {
                setActiveTab("traffic");
                setActiveChatId(null);
              }}
              className={`flex-1 py-3 text-center transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === "traffic"
                  ? "text-primary dark:text-rose-450 border-rose-500"
                  : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-white"
              }`}
            >
              <PhoneCall size={11} />
              <span>Çağrılar ({activeCalls.length})</span>
            </button>

            {/* Tab 3: Chat */}
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-3 text-center transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === "chat"
                  ? "text-primary dark:text-rose-450 border-rose-500"
                  : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-white"
              }`}
            >
              <MessageSquare size={11} />
              <span>Chat ({getUnreadChatCount()})</span>
            </button>
          </div>

          {/* Content Area */}
          <div className="h-80 overflow-y-auto p-5 bg-white dark:bg-slate-900">
            
            {/* ----------------------------------------------------
                TAB 1: TELEFON / SOFTPHONE
                ---------------------------------------------------- */}
            {activeTab === "phone" && (
              <div className="space-y-4">
                
                {/* Connection Banner */}
                <div className={`p-3 rounded-2xl border flex items-center justify-between ${
                  registered 
                    ? "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200/60 dark:border-emerald-900/40 text-primary dark:text-emerald-400"
                    : "bg-rose-50/50 dark:bg-rose-950/10 border-rose-200/60 dark:border-rose-900/40 text-primary dark:text-rose-455"
                }`}>
                  <div className="flex items-center gap-2">
                    {registered ? <Wifi size={14} /> : <WifiOff size={14} />}
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {registered ? "Asterisk WSS Kayıtlı" : "Bağlantı Kesildi"}
                    </span>
                  </div>
                  <span className="text-[10px] font-extrabold bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-100 dark:border-slate-750">
                    Hat {agentExtension}
                  </span>
                </div>

                {/* Main Call State Display */}
                <div className="p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-900 text-center">
                  
                  {callStatus === "Idle" && (
                    <div className="py-4 space-y-2">
                      <div className="h-11 w-11 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto text-slate-400">
                        <Phone size={18} />
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 text-xs font-extrabold uppercase tracking-wide">Hat Müsait</p>
                      <p className="text-[10px] text-slate-450 dark:text-slate-550">Yeni bir çağrı transferi bekleniyor...</p>
                    </div>
                  )}

                  {callStatus === "Ringing" && (
                    <div className="py-2 space-y-3">
                      <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm animate-bounce">
                        <PhoneCall size={20} className="animate-pulse" />
                      </div>
                      <div>
                        <p className="text-amber-600 dark:text-amber-400 font-extrabold text-xs uppercase tracking-widest">GELEN ÇAĞRI</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Çağrı kuyruğunuz çalıyor...</p>
                      </div>

                      {/* Ringing Accept / Reject Controls */}
                      <div className="flex justify-center gap-3 pt-2">
                        <button
                          onClick={answerCall}
                          className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold text-xs tracking-wide shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Phone size={13} /> Cevapla
                        </button>
                        <button
                          onClick={hangupCall}
                          className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs tracking-wide shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <PhoneOff size={13} /> Reddet
                        </button>
                      </div>
                    </div>
                  )}

                  {callStatus === "InCall" && (
                    <div className="py-2 space-y-4">
                      <div className="flex justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center animate-pulse shrink-0 shadow-sm">
                            <Phone size={18} />
                          </div>
                          <div className="text-left">
                            <p className="text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] uppercase tracking-wider mb-0.5">Görüşme Aktif</p>
                            <p className="text-xl font-black font-mono text-slate-800 dark:text-white leading-none">
                              {formatSeconds(callDuration)}
                            </p>
                          </div>
                        </div>

                        {/* InCall Hangup Button */}
                        <button
                          onClick={hangupCall}
                          className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-[11px] tracking-wide shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <PhoneOff size={12} /> Kapat
                        </button>
                      </div>

                      {/* Canlı Biyometrik Doğrulama & Deepfake Göstergeleri */}
                      {biometricStatus && biometricStatus.enabled && (
                        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-left animate-in fade-in duration-200 shadow-inner">
                          {/* Header */}
                          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-1 justify-between">
                            <span className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider flex items-center gap-1">
                              <Fingerprint size={12} className="text-primary" /> Biyometrik Güvenlik
                            </span>
                            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                          </div>

                          {biometricStatus.status === "verified" && (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5 text-primary dark:text-emerald-400">
                                <CheckCircle size={13} className="shrink-0" />
                                <span className="text-[10px] font-bold">Biyometrik Kimlik Doğrulandı</span>
                              </div>
                              
                              <div className="space-y-1">
                                <div className="flex justify-between text-[8px] font-extrabold text-slate-500">
                                  <span>Eşleşme Oranı (%{biometricStatus.match_confidence}):</span>
                                  <span className="text-emerald-650">{biometricStatus.matched_name}</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-primary h-1.5 rounded-full transition-all duration-500"
                                    style={{ width: `${biometricStatus.match_confidence}%` }}
                                  />
                                </div>
                              </div>
                              
                              <div className="flex justify-between items-center text-[8px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-wider pt-0.5">
                                <span>Deepfake Riski: %{biometricStatus.deepfake_risk}</span>
                                <span className="text-primary font-black">GÜVENLİ</span>
                              </div>
                            </div>
                          )}

                          {biometricStatus.status === "deepfake_alarm" && (
                            <div className="space-y-2 p-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-lg animate-pulse">
                              <div className="flex items-center gap-1.5 text-primary dark:text-rose-450">
                                <ShieldAlert size={13} className="shrink-0" />
                                <span className="text-[10px] font-extrabold uppercase tracking-wider">DEEPFAKE RİSK ALARMI!</span>
                              </div>
                              
                              <div className="space-y-1">
                                <div className="flex justify-between text-[8px] font-extrabold text-rose-650">
                                  <span>Deepfake Risk Seviyesi:</span>
                                  <span>%{biometricStatus.deepfake_risk}</span>
                                </div>
                                <div className="w-full bg-rose-100 dark:bg-rose-950 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-primary h-1.5 rounded-full transition-all duration-500"
                                    style={{ width: `${biometricStatus.deepfake_risk}%` }}
                                  />
                                </div>
                              </div>
                              
                              <div className="text-[8px] font-black text-primary bg-rose-100/50 dark:bg-rose-950/40 px-2 py-1 rounded text-center uppercase tracking-widest leading-normal">
                                Kimlik Teyit Protokolü Öneriliyor!
                              </div>
                            </div>
                          )}

                          {biometricStatus.status === "unknown" && (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5 text-primary">
                                <AlertTriangle size={13} className="shrink-0" />
                                <span className="text-[10px] font-bold">Kayıtlı Ses İzi Bulunamadı</span>
                              </div>
                              <p className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">Müşterinin kimliğini doğruladıktan sonra ses izini şifreleyerek veritabanına kaydedebilirsiniz.</p>
                              
                              <button
                                onClick={handleSaveVoiceprint}
                                disabled={savingVoiceprint}
                                className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/30 text-primary dark:text-indigo-455 border border-indigo-200/50 dark:border-indigo-900/30 rounded-xl text-[9px] font-extrabold transition flex items-center justify-center gap-1"
                              >
                                <Fingerprint size={11} /> {savingVoiceprint ? "Kaydediliyor..." : "Ses İzini Şifreli Kaydet"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* Error Banner */}
                {error && (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/25 border border-rose-200/50 dark:border-rose-900/30 rounded-2xl text-primary dark:text-rose-455 text-xs flex items-start gap-2.5">
                    <ShieldAlert size={15} className="shrink-0 mt-0.5 text-primary" />
                    <span className="font-semibold">{error}</span>
                  </div>
                )}

              </div>
            )}

            {/* ----------------------------------------------------
                TAB 2: AKTİF ÇAĞRILAR LİSTESİ
                ---------------------------------------------------- */}
            {activeTab === "traffic" && (
              <div className="h-full">
                {activeCalls.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-full text-slate-400">
                      <PhoneCall size={22} />
                    </div>
                    <div>
                      <p className="text-[11px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Aktif Çağrı Yok</p>
                      <p className="text-[9px] text-slate-450 mt-1">Şu anda santral üzerinde konuşan veya çalan başka bir hat bulunmuyor.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {activeCalls.map((call) => (
                      <div
                        key={call.id}
                        className="p-3.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-205 dark:border-slate-800/80 rounded-2xl flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-primary rounded-xl animate-pulse">
                            <PhoneCall size={13} />
                          </div>
                          <div>
                            <p className="text-[11px] font-extrabold text-slate-850 dark:text-white">
                              {call.caller_number || "Gizli Numara"}
                            </p>
                            <p className="text-[8px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                              Santral ID: {call.id.slice(0, 10)}...
                            </p>
                          </div>
                        </div>
                        <div className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/60 text-slate-500 rounded-lg">
                          <ArrowRight size={12} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ----------------------------------------------------
                TAB 3: CANLI CHAT SİMÜLATÖRÜ
                ---------------------------------------------------- */}
            {activeTab === "chat" && (
              <div className="h-full flex flex-col">
                
                {/* Chat Tabs */}
                {!activeChatId && (
                  <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl mb-3 shrink-0">
                    <button
                      onClick={() => setChatTab("customer")}
                      className={`flex-1 py-1.5 text-[9px] font-extrabold uppercase tracking-wider rounded-lg transition-colors ${
                        chatTab === "customer" 
                          ? "bg-white dark:bg-slate-700 text-primary shadow-sm" 
                          : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      Müşteri
                    </button>
                    <button
                      onClick={() => setChatTab("internal")}
                      className={`flex-1 py-1.5 text-[9px] font-extrabold uppercase tracking-wider rounded-lg transition-colors ${
                        chatTab === "internal" 
                          ? "bg-white dark:bg-slate-700 text-primary shadow-sm" 
                          : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      İç Yazışma
                    </button>
                  </div>
                )}

                {/* 1. Chat List View */}
                {!activeChatId && !isNewChatModalOpen && (
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-2">
                    {(chatTab === "customer" ? chatSessions : internalChatSessions).map((session) => (
                      <button
                        key={session.id}
                        onClick={() => {
                          setActiveChatId(session.id);
                          if (chatTab === "customer") {
                            setChatSessions(prev => prev.map(c => c.id === session.id ? { ...c, unread: 0 } : c));
                          } else {
                            setInternalChatSessions(prev => prev.map(c => c.id === session.id ? { ...c, unread: 0 } : c));
                          }
                        }}
                        className="w-full p-3 bg-slate-50/50 dark:bg-slate-950/10 hover:bg-slate-50 dark:hover:bg-slate-950/30 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl flex items-center justify-between gap-3 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 truncate">
                          <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary font-extrabold text-[10px] shrink-0 relative">
                            {session.customerName.charAt(0)}
                            {chatTab === "internal" && (
                              <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white dark:border-slate-900 ${session.online ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                            )}
                          </div>
                          <div className="truncate">
                            <p className="text-[11px] font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                              {session.customerName}
                              <span className={`px-1 py-0.5 rounded text-[7px] font-extrabold uppercase border ${
                                chatTab === "customer" 
                                  ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-450 border-emerald-200/30"
                                  : "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-200/30"
                              }`}>
                                {session.platform}
                              </span>
                            </p>
                            <p className="text-[9px] text-slate-450 dark:text-slate-500 truncate mt-0.5 font-medium">
                              {session.messages.length > 0 ? session.messages[session.messages.length - 1].text : "Mesaj yok..."}
                            </p>
                          </div>
                        </div>

                        {session.unread > 0 && (
                          <span className="h-4 w-4 bg-primary rounded-full flex items-center justify-center text-[8px] font-extrabold text-white shrink-0">
                            {session.unread}
                          </span>
                        )}
                      </button>
                    ))}

                    {/* New Chat Button (Internal Only) */}
                    {chatTab === "internal" && (
                      <button 
                        onClick={() => setIsNewChatModalOpen(true)}
                        className="w-full mt-2 p-2 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-bold text-slate-500 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                      >
                        <span className="text-lg leading-none">+</span> Yeni İç Yazışma
                      </button>
                    )}
                  </div>
                )}

                {/* New Chat Selection View */}
                {isNewChatModalOpen && !activeChatId && (
                  <div className="flex-1 flex flex-col h-full">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/60 mb-2 shrink-0">
                      <button
                        onClick={() => setIsNewChatModalOpen(false)}
                        className="text-[9px] font-extrabold text-slate-450 dark:text-slate-500 hover:text-slate-750 dark:hover:text-white uppercase tracking-wider flex items-center gap-1"
                      >
                        ← Geri
                      </button>
                      <span className="text-[9px] font-bold text-slate-500 truncate max-w-[120px]">Kişi Seç</span>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-2">
                      {systemUsers.map(user => (
                        <button
                          key={user.id}
                          onClick={() => handleStartInternalChat(user)}
                          className="w-full p-2.5 bg-slate-50/50 dark:bg-slate-950/10 hover:bg-slate-50 dark:hover:bg-slate-950/30 border border-slate-200/60 dark:border-slate-800/80 rounded-xl flex items-center gap-3 transition-colors text-left"
                        >
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-[9px] shrink-0 relative">
                            {user.name.charAt(0)}
                            <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white dark:border-slate-900 ${user.online ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-800 dark:text-white">{user.name}</p>
                            <p className="text-[8px] text-slate-450 dark:text-slate-500 uppercase tracking-wider">{user.role}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Chat Box Details */}
                {activeChatId && selectedChat && (
                  <div className="h-full flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/60 mb-2 shrink-0">
                      <button
                        onClick={() => setActiveChatId(null)}
                        className="text-[9px] font-extrabold text-slate-450 dark:text-slate-500 hover:text-slate-750 dark:hover:text-white uppercase tracking-wider flex items-center gap-1"
                      >
                        ← Listeye Dön
                      </button>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">{selectedChat.customerName}</span>
                        {chatTab === "internal" && (
                          <span className={`text-[7px] font-bold uppercase tracking-wider ${selectedChat.online ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {selectedChat.online ? 'Çevrimiçi' : 'Çevrimdışı'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 py-1">
                      {selectedChat.messages.map((m, idx) => (
                        <div
                          key={idx}
                          className={`flex flex-col max-w-[85%] ${
                            m.sender === "agent" ? "ml-auto items-end" : "mr-auto items-start"
                          }`}
                        >
                          <div
                            className={`p-2.5 rounded-2xl text-[10px] leading-relaxed font-semibold ${
                              m.sender === "agent"
                                ? "bg-primary text-white rounded-tr-none"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none"
                            }`}
                          >
                            {m.text}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-[7px] text-slate-450 font-bold tracking-wide uppercase">
                              {m.time}
                            </span>
                            {m.sender === "agent" && chatTab === "internal" && (
                              <span className={`text-[7px] font-bold ${m.status === 'seen' ? 'text-blue-500' : 'text-slate-400'}`}>
                                {m.status === 'seen' ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleSendChatMessage} className="flex items-center gap-1 pt-2 border-t border-slate-100 dark:border-slate-800/60 mt-2 shrink-0">
                      <button type="button" className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" title="Dosya Ekle">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                      </button>
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          placeholder="Mesajınızı yazın..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          className="w-full text-[10px] px-3 py-2 pr-8 rounded-xl border border-slate-205 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-850 dark:text-slate-100 focus:outline-none"
                        />
                        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" title="Emoji">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>
                        </button>
                      </div>
                      <button
                        type="submit"
                        disabled={!chatInput.trim()}
                        className="p-2 bg-primary hover:bg-primary/90 text-white rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50 transition-opacity"
                      >
                        <Send size={12} />
                      </button>
                    </form>

                  </div>
                )}

              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}
