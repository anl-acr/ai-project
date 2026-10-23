import React, { useState, useEffect, useRef } from "react";
import TranscriptPanel from "../../dashboard/TranscriptPanel";
import AgentSessionCard from "../../phone/AgentSessionCard";
import { Phone, PhoneOff, Mic, MicOff, Pause, Play, Volume2, UserPlus, UserCheck, User, X } from "lucide-react";
import { useTheme } from "../../../utils/theme";
import * as SIP from "sip.js";
import { findContactByPhone } from "../../../utils/contactUtils";

export default function AgentWebphoneTab({ backendHost, currentUser, activeCallId, pendingDial, setPendingDial }) {
  const { borderLight } = useTheme();
  const [dialNumber, setDialNumber] = useState("");
  const [callStatus, setCallStatus] = useState("Idle"); // Idle, Calling, InCall
  const [webrtcConfig, setWebrtcConfig] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [callNotification, setCallNotification] = useState(null);

  // Contacts & Add Contact Modal State
  const [contacts, setContacts] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [newContact, setNewContact] = useState({ firstName: "", lastName: "", email: "" });
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState("");

  const userAgentRef = useRef(null);
  const sessionRef = useRef(null);
  const audioElRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!callNotification) return;
    const t = setTimeout(() => setCallNotification(null), 5000);
    return () => clearTimeout(t);
  }, [callNotification]);

  const attachRemoteAudio = (sessionObj) => {
    const peerConnection = sessionObj?.sessionDescriptionHandler?.peerConnection;
    if (!peerConnection) return;
    const selectedSpeaker = typeof window !== "undefined" ? localStorage.getItem("selected_speaker") : null;

    const bindTrack = (track) => {
      if (track && track.kind === "audio" && audioElRef.current) {
        const remoteStream = new MediaStream([track]);
        if (selectedSpeaker && typeof audioElRef.current.setSinkId === "function") {
          audioElRef.current.setSinkId(selectedSpeaker).catch(() => {});
        }
        audioElRef.current.srcObject = remoteStream;
        audioElRef.current.play().catch((e) => console.error(e));
      }
    };

    peerConnection.addEventListener("track", (event) => {
      bindTrack(event.track);
    });
    peerConnection.getReceivers().forEach((receiver) => {
      bindTrack(receiver.track);
    });
  };

  // Fetch system contacts & directory
  const fetchContactsAndDirectory = async () => {
    try {
      const protocol = window.location.protocol;
      const [contactsRes, dirRes] = await Promise.all([
        fetch(`${protocol}//${backendHost}/api/contacts`),
        fetch(`${protocol}//${backendHost}/api/agent/directory`)
      ]);
      if (contactsRes.ok) {
        const cData = await contactsRes.json();
        setContacts(cData);
      }
      if (dirRes.ok) {
        const dData = await dirRes.json();
        setDirectory(dData);
      }
    } catch (err) {
      console.error("Rehber verileri alınamadı:", err);
    }
  };

  useEffect(() => {
    fetchContactsAndDirectory();
    const handleContactsUpdated = () => fetchContactsAndDirectory();
    window.addEventListener("CONTACTS_UPDATED", handleContactsUpdated);
    return () => window.removeEventListener("CONTACTS_UPDATED", handleContactsUpdated);
  }, [backendHost]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchConfig = async () => {
      try {
        const protocol = window.location.protocol;
        const queryParams = new URLSearchParams();
        if (currentUser.id) queryParams.set("user_id", currentUser.id.toString());
        if (currentUser.extension) queryParams.set("extension", currentUser.extension.toString());
        const res = await fetch(`${protocol}//${backendHost}/api/webrtc/config?${queryParams.toString()}`, {
          headers: { "X-User-ID": (currentUser.id || currentUser.extension || "").toString() }
        });
        if (res.ok) {
          const data = await res.json();
          setWebrtcConfig(data);
        }
      } catch (err) {
        console.error("WebRTC Config alınamadı:", err);
      }
    };
    fetchConfig();
  }, [currentUser, backendHost]);

  useEffect(() => {
    if (!webrtcConfig) return;
    const { asteriskWssUrl, agentExtension, password } = webrtcConfig;
    if (!asteriskWssUrl || !agentExtension) return;

    const hostOnly = asteriskWssUrl.split('/')[2].split(':')[0];
    const uri = SIP.UserAgent.makeURI(`sip:${agentExtension}@${hostOnly}`);
    
    const resolvedViaHost = webrtcConfig.viaHost || hostOnly;
    const userAgentOptions = {
      uri,
      contactURI: uri,
      transportOptions: { server: asteriskWssUrl, traceSip: false },
      viaHost: resolvedViaHost,
      contactName: agentExtension,
      authorizationUsername: agentExtension,
      authorizationPassword: password,
      displayName: `Temsilci ${agentExtension}`,
      hackIpInContact: true,
      delegate: {
        onInvite: (invite) => {
          const callerNum = invite?.remoteIdentity?.uri?.user || "Bilinmeyen";
          sessionRef.current = invite;
          setDialNumber(callerNum);
          setCallStatus("Ringing");
          setCallNotification(null);
          window.dispatchEvent(new CustomEvent("INCOMING_WEBPHONE_CALL", { detail: callerNum }));

          invite.stateChange.addListener((state) => {
            if (state === SIP.SessionState.Established) {
              setCallStatus("InCall");
              attachRemoteAudio(invite);
            } else if (state === SIP.SessionState.Terminated) {
              setCallStatus("Idle");
              sessionRef.current = null;
            }
          });
        }
      }
    };

    const ua = new SIP.UserAgent(userAgentOptions);
    userAgentRef.current = ua;

    if (ua.transport) {
      const originalOnMessage = ua.transport.onMessage;
      ua.transport.onMessage = (message) => {
        if (typeof message === "string" && message.includes("SIP/2.0 200 OK") && message.includes("REGISTER")) {
          console.log("[WebRTC] Asterisk REGISTER 200 OK alındı! Hat Müsait / Online!");
          setIsRegistered(true);
        }
        if (originalOnMessage) {
          originalOnMessage.call(ua.transport, message);
        }
      };
    }

    ua.start()
      .then(() => {
        setIsRegistered(true);
        const registerer = new SIP.Registerer(ua);
        return registerer.register();
      })
      .then(() => {
        setIsRegistered(true);
      })
      .catch((err) => console.error("WebRTC Başlatma/Register hatası:", err));

    return () => {
      if (userAgentRef.current) userAgentRef.current.stop();
    };
  }, [webrtcConfig]);

  useEffect(() => {
    let interval;
    if (callStatus === "InCall") {
      interval = setInterval(() => setCallDuration(p => p + 1), 1000);
    } else {
      setCallDuration(0);
      setIsMuted(false);
      setIsOnHold(false);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const recordWebphoneTimelineEvent = (actionType, detail) => {
    try {
      const protocol = window.location.protocol;
      const ext = webrtcConfig?.agentExtension || currentUser?.extension || "1000";
      const uid = currentUser?.id || ext;
      fetch(`${protocol}//${backendHost}/api/agent/timeline-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: uid,
          extension: ext,
          action_type: actionType,
          detail: detail || ""
        })
      }).catch(() => {});
    } catch (e) {}
  };

  const handleDial = (num) => setDialNumber(prev => prev + num);
  
  const handleAnswerCall = async () => {
    if (!sessionRef.current || callStatus !== "Ringing") return;
    try {
      await sessionRef.current.accept({
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false }
        }
      });
      attachRemoteAudio(sessionRef.current);
      setCallStatus("InCall");
    } catch (err) {
      console.error("Arama cevaplanamadı:", err);
      setCallNotification({
        type: "error",
        message: "Çağrı yanıtlanamadı. Lütfen mikrofon izinlerinizi kontrol edin."
      });
    }
  };

  const handleCall = async (targetNum = dialNumber) => {
    const cleanTarget = String(targetNum || "").replace(/[^0-9*#+]/g, "");
    if (!cleanTarget) return;
    if (!userAgentRef.current || !webrtcConfig) {
      setCallNotification({
        type: "error",
        message: "WebPhone bağlantısı hazırlanıyor, lütfen birkaç saniye sonra tekrar deneyin."
      });
      return;
    }
    setCallNotification(null);
    setDialNumber(cleanTarget);
    setCallStatus("Calling");
    if (String(cleanTarget).startsWith("*8") || String(cleanTarget).startsWith("**")) {
      const pickupLbl = String(cleanTarget).startsWith("*8") ? "Grup Çağrı Toplama (*8)" : `Hedefli Çağrı Toplama (${cleanTarget})`;
      recordWebphoneTimelineEvent("call_pickup", pickupLbl);
    }

    const hostOnly = webrtcConfig.asteriskWssUrl.split('/')[2].split(':')[0];
    const targetURI = SIP.UserAgent.makeURI(`sip:${cleanTarget}@${hostOnly}`);
    const inviter = new SIP.Inviter(userAgentRef.current, targetURI, {
      sessionDescriptionHandlerOptions: {
        constraints: { audio: true, video: false }
      }
    });

    sessionRef.current = inviter;

    inviter.stateChange.addListener((state) => {
      if (state === SIP.SessionState.Established) {
        setCallStatus("InCall");
        attachRemoteAudio(inviter);
      } else if (state === SIP.SessionState.Terminated) {
        setCallStatus("Idle");
        sessionRef.current = null;
      }
    });

    try {
      await inviter.invite({
        requestDelegate: {
          onReject: (response) => {
            const code = response?.message?.statusCode;
            if (code === 486 || code === 600) {
              setCallNotification({
                type: "error",
                message: `Aranan numara (${cleanTarget}) şu anda meşgul.`
              });
            } else if (code === 480 || code === 503 || code === 404) {
              setCallNotification({
                type: "error",
                message: `Aranan dahili veya numara (${cleanTarget}) şu anda çevrimdışı veya ulaşılamıyor.`
              });
            } else if (code === 403 || code === 603) {
              setCallNotification({
                type: "error",
                message: `Arama reddedildi veya bu numarayı (${cleanTarget}) arama yetkiniz bulunmuyor.`
              });
            }
          }
        }
      });
    } catch (err) {
      console.error("Arama başlatılamadı:", err);
      setCallStatus("Idle");
      setCallNotification({
        type: "error",
        message: "Arama başlatılamadı. Lütfen mikrofon izninizi ve bağlantınızı kontrol edin."
      });
    }
  };

  const handleHangup = () => {
    if (sessionRef.current) {
      try {
        if (callStatus === "Calling") {
          sessionRef.current.cancel();
        } else if (callStatus === "Ringing") {
          sessionRef.current.reject();
        } else {
          sessionRef.current.bye();
        }
      } catch (e) {}
    }
    setCallStatus("Idle");
    setDialNumber("");
  };

  const toggleMute = () => {
    if (!sessionRef.current) return;
    const pc = sessionRef.current.sessionDescriptionHandler?.peerConnection;
    if (pc) {
      pc.getSenders().forEach(sender => {
        if (sender.track && sender.track.kind === 'audio') {
          sender.track.enabled = isMuted;
        }
      });
      if (!isMuted) {
        recordWebphoneTimelineEvent("call_mute", dialNumber ? `${dialNumber} görüşmesinde mikrofon kapatıldı` : "Görüşmede mikrofon kapatıldı");
      }
      setIsMuted(!isMuted);
    }
  };

  const toggleHold = () => {
    if (!sessionRef.current) return;
    const pc = sessionRef.current.sessionDescriptionHandler?.peerConnection;
    if (pc) {
      pc.getSenders().forEach(sender => {
        if (sender.track && sender.track.kind === 'audio') {
          sender.track.enabled = isOnHold;
        }
      });
      if (!isOnHold) {
        recordWebphoneTimelineEvent("call_hold", dialNumber ? `${dialNumber} beklemeye alındı` : "Görüşme beklemeye alındı");
      } else {
        recordWebphoneTimelineEvent("call_unhold", dialNumber ? `${dialNumber} beklemeden alındı` : "Beklemeden geri dönüldü");
      }
      setIsOnHold(!isOnHold);
    }
  };

  const handleSaveContact = async () => {
    if (!newContact.firstName.trim() || !newContact.lastName.trim()) {
      setContactError("Lütfen Ad ve Soyad alanlarını doldurun.");
      return;
    }
    setSavingContact(true);
    setContactError("");
    try {
      const protocol = window.location.protocol;
      const res = await fetch(`${protocol}//${backendHost}/api/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: newContact.firstName.trim(),
          last_name: newContact.lastName.trim(),
          phone_number: dialNumber.trim(),
          email: newContact.email.trim() || null
        })
      });
      if (res.ok) {
        await fetchContactsAndDirectory();
        window.dispatchEvent(new CustomEvent('CONTACTS_UPDATED'));
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

  useEffect(() => {
    if (pendingDial) {
      setDialNumber(String(pendingDial));
      if (isRegistered && callStatus === "Idle") {
        const numToDial = String(pendingDial);
        setPendingDial(null);
        setTimeout(() => handleCall(numToDial), 100);
      }
    }
  }, [pendingDial, isRegistered, callStatus]);

  const matchedContact = findContactByPhone(dialNumber, contacts, directory);

  return (
    <div className="w-full h-full p-4 lg:p-6 overflow-hidden flex flex-col relative">
      <audio ref={audioElRef} autoPlay style={{ display: "none" }} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        
        {/* Left Column: Phone Controls & Session */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6 h-full overflow-y-auto hide-scrollbar pb-6">
          
          <div className="w-full shrink-0 animate-in fade-in slide-in-from-left-4 duration-500">
            <AgentSessionCard backendHost={backendHost} currentUser={currentUser} />
          </div>
          
          {/* Enhanced Dialpad */}
          <div className={`p-6 bg-white dark:bg-slate-900 border ${borderLight} rounded-3xl shadow-xl shadow-slate-200/40 dark:shadow-slate-900/40 flex flex-col items-center shrink-0 animate-in fade-in slide-in-from-left-4 duration-700`}>
            {callNotification && (
              <div className="w-full mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-start justify-between gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <span>{callNotification.message}</span>
                <button
                  type="button"
                  onClick={() => setCallNotification(null)}
                  className="text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Status Display */}
            <div className="text-center mb-6 w-full">
              <p className={`text-[10px] font-extrabold uppercase tracking-widest ${callStatus !== 'Idle' ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`}>
                {callStatus === "InCall" ? "Görüşme Aktif" : callStatus === "Calling" ? "Aranıyor..." : callStatus === "Ringing" ? "Gelen Çağrı..." : "Hat Müsait"}
              </p>
              <div className="mt-1 flex flex-col items-center justify-center">
                <input 
                  ref={inputRef}
                  type="text"
                  value={dialNumber}
                  onChange={(e) => setDialNumber(e.target.value.replace(/[^0-9*#+]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && callStatus === 'Idle' && handleCall()}
                  placeholder="Numara Girin..."
                  disabled={callStatus !== 'Idle'}
                  className="w-full text-center text-2xl font-mono font-bold tracking-widest text-slate-800 dark:text-white bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-300 dark:placeholder:text-slate-700 h-10 disabled:opacity-80"
                  autoFocus
                />
                {matchedContact && (
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center justify-center gap-1.5 animate-in fade-in">
                    <UserCheck size={14} />
                    {matchedContact.displayName}
                  </p>
                )}
              </div>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-5 w-full px-2">
               {[1,2,3,4,5,6,7,8,9,"*",0,"#"].map(num => (
                  <button 
                    key={num} 
                    onClick={() => {
                      handleDial(num);
                      inputRef.current?.focus();
                    }}
                    disabled={callStatus !== "Idle"}
                    className={`w-14 h-14 mx-auto rounded-full bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-lg font-bold text-slate-700 dark:text-slate-200 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm border ${borderLight} hover:shadow-md disabled:opacity-50 disabled:pointer-events-none`}
                  >
                    {num}
                  </button>
               ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-6 mt-8 w-full">
               <button 
                 onClick={() => (callStatus === "Ringing" ? handleAnswerCall() : handleCall())}
                 disabled={callStatus !== "Idle" && callStatus !== "Ringing"}
                 className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 disabled:opacity-50 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95"
               >
                 <Phone size={24} className="fill-current" />
               </button>
               
               {callStatus !== "Idle" && (
                 <button 
                   onClick={handleHangup}
                   className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 hover:from-rose-600 hover:to-rose-800 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all hover:scale-105 active:scale-95 animate-in zoom-in"
                 >
                   <PhoneOff size={22} className="fill-current" />
                 </button>
               )}
            </div>
          </div>

        </div>

        {/* Right Column: Active Transcripts & Logs / Call Panel */}
        <div className="lg:col-span-8 xl:col-span-9 h-full flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-700 delay-100">
           
           {callStatus !== "Idle" ? (
             <div className="flex flex-col h-full gap-6">
               {/* Sleek Active Call Panel */}
               <div className="p-8 bg-gradient-to-br from-white via-slate-50 to-white dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-xl dark:shadow-2xl flex flex-col items-center justify-center relative overflow-hidden shrink-0 min-h-[280px]">
                 
                 {/* Pulsing Background when active */}
                 <div className={`absolute inset-0 bg-emerald-500/10 ${callStatus === 'InCall' ? 'animate-pulse' : 'animate-none'}`}></div>
                 
                 {/* Dynamic rings */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-emerald-500/20 rounded-full animate-ping duration-[3000ms]"></div>
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-emerald-500/30 rounded-full animate-ping duration-[2000ms] delay-300"></div>

                 <div className="relative z-10 flex flex-col items-center w-full">
                   <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-md dark:shadow-xl transition-all duration-500 ${callStatus === 'InCall' ? 'bg-emerald-100 border-2 border-emerald-400 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-amber-100 border-2 border-amber-400 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400'}`}>
                     {isOnHold ? <Pause size={32} /> : <Phone size={32} className={callStatus === 'Calling' || callStatus === 'Ringing' ? 'animate-bounce' : ''} />}
                   </div>
                   
                   {matchedContact ? (
                     <div className="flex flex-col items-center text-center">
                       <div className="flex items-center gap-1.5 mb-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-extrabold tracking-wide shadow-sm">
                         <UserCheck size={14} />
                         <span>Rehberde Kayıtlı</span>
                       </div>
                       <h2 className="text-3xl md:text-4xl font-extrabold text-slate-800 dark:text-white tracking-wide mb-1">
                         {matchedContact.displayName}
                       </h2>
                       <p className="text-xl font-mono font-semibold text-slate-500 dark:text-slate-400 tracking-widest mb-3">
                         {dialNumber}
                       </p>
                     </div>
                   ) : (
                     <div className="flex flex-col items-center text-center">
                       <h2 className="text-4xl md:text-5xl font-extrabold text-slate-800 dark:text-white tracking-widest mb-2 font-mono drop-shadow-sm dark:drop-shadow-lg">
                         {dialNumber}
                       </h2>
                       <button
                         onClick={() => {
                           setNewContact({ firstName: "", lastName: "", email: "" });
                           setContactError("");
                           setIsAddContactOpen(true);
                         }}
                         title="Kişiyi Rehbere Kaydet"
                         className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition-all shrink-0 cursor-pointer"
                       >
                         <UserPlus size={15} />
                         Rehbere Kaydet
                       </button>
                     </div>
                   )}
                   
                   <div className="flex items-center gap-3 mt-2">
                     <span className="relative flex h-3 w-3">
                       <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${callStatus === 'InCall' ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400'}`}></span>
                       <span className={`relative inline-flex rounded-full h-3 w-3 ${callStatus === 'InCall' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                     </span>
                     <p className={`font-semibold tracking-widest uppercase text-sm ${callStatus === 'InCall' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                       {callStatus === 'InCall' ? (isOnHold ? 'Beklemede' : `Görüşme Aktif - ${formatDuration(callDuration)}`) : callStatus === 'Ringing' ? 'Gelen Çağrı...' : 'Aranıyor...'}
                     </p>
                   </div>
                   
                   {/* Call Controls */}
                   <div className="flex items-center gap-6 mt-10">
                     {callStatus === "Ringing" ? (
                       <>
                         <button onClick={handleAnswerCall} className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-all hover:scale-110 group" title="Yanıtla">
                           <Phone size={28} className="fill-current group-hover:scale-110 transition-transform" />
                         </button>
                         <button onClick={handleHangup} className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 hover:from-rose-600 hover:to-rose-800 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all hover:scale-110 group" title="Reddet">
                           <PhoneOff size={28} className="group-hover:scale-110 transition-transform" />
                         </button>
                       </>
                     ) : (
                       <>
                         <button onClick={toggleMute} className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all hover:scale-110 ${isMuted ? 'bg-rose-100 border-rose-300 text-rose-500 dark:bg-rose-500/20 dark:border-rose-500/50 dark:text-rose-400' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10'}`}>
                           {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                         </button>
                         <button onClick={toggleHold} className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all hover:scale-110 ${isOnHold ? 'bg-amber-100 border-amber-300 text-amber-600 dark:bg-amber-500/20 dark:border-amber-500/50 dark:text-amber-400' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10'}`}>
                           {isOnHold ? <Play size={22} /> : <Pause size={22} />}
                         </button>
                         <button onClick={handleHangup} className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 hover:from-rose-600 hover:to-rose-800 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all hover:scale-110 group">
                           <PhoneOff size={28} className="group-hover:scale-110 transition-transform" />
                         </button>
                       </>
                     )}
                   </div>
                 </div>
               </div>
               
               {/* Transcript Panel shrinks to fill remaining space */}
               <div className="flex-1 overflow-hidden">
                 <TranscriptPanel callId={activeCallId} backendHost={backendHost} />
               </div>
             </div>
           ) : (
             <TranscriptPanel callId={activeCallId} backendHost={backendHost} />
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
              <button onClick={() => setIsAddContactOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">
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
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Telefon Numarası</label>
                <input type="text" value={dialNumber} disabled className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-mono font-bold border border-slate-200 dark:border-slate-700" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Ad *</label>
                  <input type="text" value={newContact.firstName} onChange={e => setNewContact({...newContact, firstName: e.target.value})} placeholder="Örn: Ahmet" className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-sm border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500" autoFocus />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Soyad *</label>
                  <input type="text" value={newContact.lastName} onChange={e => setNewContact({...newContact, lastName: e.target.value})} placeholder="Örn: Yılmaz" className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-sm border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">E-posta (İsteğe Bağlı)</label>
                <input type="email" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} placeholder="ahmet@ornek.com" className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-sm border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setIsAddContactOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors">
                Vazgeç
              </button>
              <button onClick={handleSaveContact} disabled={savingContact} className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50">
                {savingContact ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

