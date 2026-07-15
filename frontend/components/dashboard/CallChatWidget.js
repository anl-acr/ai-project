import React, { useState, useEffect, useRef } from "react";
import * as SIP from "sip.js";
import { Phone, PhoneOff, ShieldAlert, Wifi, WifiOff, MessageSquare, Send, X, Clock, ArrowRight, PhoneCall, Radio, Shield, Fingerprint, CheckCircle, AlertTriangle } from "lucide-react";
import { playRingtoneSound, stopRingtoneSound } from "../../utils/audioHelper";

export default function CallChatWidget({
  agentExtension = "200",
  password = "temsilci_sifre_321",
  asteriskWssUrl = "wss://localhost:8089/ws",
  onActiveCall = () => {},
  backendHost = "localhost:8000"
}) {
  // Expanded/Collapsed State
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("phone"); // phone, traffic, chat

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

  const API_BASE = typeof window !== "undefined" ? `${window.location.protocol}//${backendHost}` : `http://${backendHost}`;

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
    if (!asteriskWssUrl || !agentExtension) return;

    setError("");
    const wssServer = asteriskWssUrl;
    const uri = SIP.UserAgent.makeURI(`sip:${agentExtension}@${wssServer.split('/')[2]}`);
    
    const transportOptions = {
      server: wssServer,
      traceSip: true
    };

    const userAgentOptions = {
      uri: uri,
      transportOptions: transportOptions,
      contactName: agentExtension,
      authorizationUsername: agentExtension,
      authorizationPassword: password,
      displayName: `Temsilci ${agentExtension}`,
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

    ua.start()
      .then(() => {
        const registererOptions = {};
        const registerer = new SIP.Registerer(ua, registererOptions);
        
        registerer.stateChange.addListener((state) => {
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
        setError("Asterisk WebRTC sunucusuna bağlanılamadı.");
        setRegistered(false);
      });

    return () => {
      if (userAgentRef.current) {
        userAgentRef.current.stop();
      }
    };
  }, [agentExtension, password, asteriskWssUrl]);

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
    const newMsg = { sender: "agent", text: chatInput.trim(), time: timeString };

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
    }, 1500);
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
  const selectedChat = chatSessions.find(c => c.id === activeChatId);

  return (
    <div className="fixed bottom-6 right-6 z-[100] font-sans antialiased">
      
      {/* Hidden audio element to play remote call voice */}
      <audio ref={audioElRef} autoPlay style={{ display: "none" }} />

      {/* Unified Collapsed Pill Button */}
      {!isOpen && (
        <div
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-3 px-4.5 py-3 bg-white/90 dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800/85 rounded-full text-slate-800 dark:text-white shadow-xl hover:shadow-2xl cursor-pointer transition-all duration-300 select-none backdrop-blur-md font-bold text-xs"
        >
          {/* Extension Status Dot */}
          <span className="relative flex h-2.5 w-2.5">
            {registered ? (
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
            {registered ? `Dahili ${agentExtension}` : `Dahili ${agentExtension} (Bağlı Değil)`}
          </span>

          {/* Traffic Badges */}
          {totalTrafficCount > 0 && (
            <>
              <div className="w-[1px] h-3.5 bg-slate-200 dark:bg-slate-800" />
              <div className="flex items-center gap-1.5 text-[10px] text-primary font-extrabold animate-pulse">
                {activeCalls.length > 0 ? (
                  <PhoneCall size={11} className="animate-bounce" />
                ) : (
                  <MessageSquare size={11} />
                )}
                <span>{totalTrafficCount} Trafik</span>
              </div>
            </>
          )}
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
                      <div className="h-12 w-12 rounded-full bg-amber-50 dark:bg-amber-950/20 border border-amber-250 text-primary flex items-center justify-center mx-auto animate-bounce">
                        <PhoneCall size={20} className="animate-pulse" />
                      </div>
                      <div>
                        <p className="text-primary dark:text-amber-400 font-extrabold text-xs uppercase tracking-widest">YAPAY ZEKADAN AKTARIM</p>
                        <p className="text-[10px] text-slate-450 dark:text-slate-400 mt-1">Çağrı kuyruğunuz çalıyor...</p>
                      </div>

                      {/* Ringing Accept / Reject Controls */}
                      <div className="flex justify-center gap-3 pt-2">
                        <button
                          onClick={answerCall}
                          className="flex-1 py-2.5 bg-primary hover:bg-primary text-white rounded-xl font-bold text-xs tracking-wide shadow-md shadow-emerald-600/10 flex items-center justify-center gap-1.5"
                        >
                          <Phone size={13} /> Cevapla
                        </button>
                        <button
                          onClick={hangupCall}
                          className="flex-1 py-2.5 bg-primary hover:bg-primary text-white rounded-xl font-bold text-xs tracking-wide shadow-md shadow-rose-600/10 flex items-center justify-center gap-1.5"
                        >
                          <PhoneOff size={13} /> Reddet
                        </button>
                      </div>
                    </div>
                  )}

                  {callStatus === "InCall" && (
                    <div className="py-2 space-y-4">
                      <div className="flex justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 text-primary flex items-center justify-center animate-pulse shrink-0">
                            <Phone size={18} />
                          </div>
                          <div className="text-left">
                            <p className="text-emerald-650 dark:text-emerald-450 font-extrabold text-[10px] uppercase tracking-wider">Görüşme Aktif</p>
                            <p className="text-lg font-black font-mono text-slate-800 dark:text-white">
                              {formatSeconds(callDuration)}
                            </p>
                          </div>
                        </div>

                        {/* InCall Hangup Button */}
                        <button
                          onClick={hangupCall}
                          className="px-3.5 py-2 bg-primary hover:bg-primary text-white rounded-xl font-bold text-[10px] tracking-wide shadow-md shadow-rose-600/10 flex items-center justify-center gap-1.5"
                        >
                          <PhoneOff size={11} /> Kapat
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
              <div className="h-full">
                
                {/* 1. Chat List View */}
                {!activeChatId && (
                  <div className="space-y-2">
                    {chatSessions.map((session) => (
                      <button
                        key={session.id}
                        onClick={() => {
                          setActiveChatId(session.id);
                          setChatSessions(prev =>
                            prev.map(c => c.id === session.id ? { ...c, unread: 0 } : c)
                          );
                        }}
                        className="w-full p-3 bg-slate-50/50 dark:bg-slate-950/10 hover:bg-slate-50 dark:hover:bg-slate-950/30 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl flex items-center justify-between gap-3 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 truncate">
                          <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary font-extrabold text-[10px] shrink-0">
                            {session.customerName.charAt(0)}
                          </div>
                          <div className="truncate">
                            <p className="text-[11px] font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                              {session.customerName}
                              <span className="px-1 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-450 border border-emerald-200/30 text-[7px] font-extrabold uppercase">
                                {session.platform}
                              </span>
                            </p>
                            <p className="text-[9px] text-slate-450 dark:text-slate-500 truncate mt-0.5 font-medium">
                              {session.messages[session.messages.length - 1].text}
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
                  </div>
                )}

                {/* 2. Chat Box Details */}
                {activeChatId && selectedChat && (
                  <div className="h-full flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/60 mb-2">
                      <button
                        onClick={() => setActiveChatId(null)}
                        className="text-[9px] font-extrabold text-slate-450 dark:text-slate-500 hover:text-slate-750 dark:hover:text-white uppercase tracking-wider flex items-center gap-1"
                      >
                        ← Sohbet Listesi
                      </button>
                      <span className="text-[9px] font-bold text-slate-500 truncate max-w-[120px]">{selectedChat.customerName}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 py-1 max-h-[170px]">
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
                          <span className="text-[7px] text-slate-450 mt-1 font-bold tracking-wide uppercase">
                            {m.time}
                          </span>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleSendChatMessage} className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 mt-2 shrink-0">
                      <input
                        type="text"
                        placeholder="Mesajınızı yazın..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="flex-1 text-[10px] px-3 py-2 rounded-xl border border-slate-205 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-850 dark:text-slate-100 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="p-2 bg-primary hover:bg-primary text-white rounded-xl flex items-center justify-center shrink-0"
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
