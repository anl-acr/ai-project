import React, { useState, useEffect, useRef } from "react";
import TranscriptPanel from "../../dashboard/TranscriptPanel";
import AgentSessionCard from "../../phone/AgentSessionCard";
import { Phone, PhoneOff, Mic, MicOff, Pause, Play, Volume2 } from "lucide-react";
import { useTheme } from "../../../utils/theme";
import * as SIP from "sip.js";

export default function AgentWebphoneTab({ backendHost, currentUser, activeCallId, pendingDial, setPendingDial }) {
  const { borderLight } = useTheme();
  const [dialNumber, setDialNumber] = useState("");
  const [callStatus, setCallStatus] = useState("Idle"); // Idle, Calling, InCall
  const [webrtcConfig, setWebrtcConfig] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);

  const userAgentRef = useRef(null);
  const sessionRef = useRef(null);
  const audioElRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;
    const fetchConfig = async () => {
      try {
        const protocol = window.location.protocol;
        const res = await fetch(`${protocol}//${backendHost}/api/webrtc/config`, {
          headers: { "X-User-ID": currentUser.id.toString() }
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
    
    const userAgentOptions = {
      uri,
      transportOptions: { server: asteriskWssUrl, traceSip: false },
      contactName: agentExtension,
      authorizationUsername: agentExtension,
      authorizationPassword: password,
      displayName: `Temsilci ${agentExtension}`,
      hackIpInContact: true,
    };

    const ua = new SIP.UserAgent(userAgentOptions);
    userAgentRef.current = ua;

    ua.start()
      .then(() => {
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

  const handleDial = (num) => setDialNumber(prev => prev + num);
  
  const handleCall = async (targetNum = dialNumber) => {
    if (!targetNum || !userAgentRef.current || !webrtcConfig) return;
    setCallStatus("Calling");

    const hostOnly = webrtcConfig.asteriskWssUrl.split('/')[2].split(':')[0];
    const targetURI = SIP.UserAgent.makeURI(`sip:${targetNum}@${hostOnly}`);
    const inviter = new SIP.Inviter(userAgentRef.current, targetURI, {
      sessionDescriptionHandlerOptions: {
        constraints: { audio: true, video: false }
      }
    });

    sessionRef.current = inviter;

    inviter.stateChange.addListener((state) => {
      if (state === SIP.SessionState.Established) {
        setCallStatus("InCall");
        
        const peerConnection = inviter.sessionDescriptionHandler.peerConnection;
        if (peerConnection) {
          peerConnection.addEventListener("track", (event) => {
            if (event.track.kind === "audio" && audioElRef.current) {
              const remoteStream = new MediaStream([event.track]);
              audioElRef.current.srcObject = remoteStream;
              audioElRef.current.play().catch(e => console.error(e));
            }
          });
          const receivers = peerConnection.getReceivers();
          receivers.forEach((receiver) => {
            if (receiver.track && receiver.track.kind === "audio") {
              const remoteStream = new MediaStream([receiver.track]);
              if (audioElRef.current) {
                audioElRef.current.srcObject = remoteStream;
                audioElRef.current.play().catch(e => console.error(e));
              }
            }
          });
        }
      } else if (state === SIP.SessionState.Terminated) {
        setCallStatus("Idle");
        sessionRef.current = null;
      }
    });

    try {
      await inviter.invite();
    } catch (err) {
      console.error("Arama başlatılamadı:", err);
      setCallStatus("Idle");
    }
  };

  const handleHangup = () => {
    if (sessionRef.current) {
      if (callStatus === "Calling") {
        sessionRef.current.cancel();
      } else {
        sessionRef.current.bye();
      }
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
      setIsMuted(!isMuted);
    }
  };

  const toggleHold = () => {
    // Basic hold simulation (in a real scenario, re-INVITE with sendonly/recvonly is needed)
    if (!sessionRef.current) return;
    const pc = sessionRef.current.sessionDescriptionHandler?.peerConnection;
    if (pc) {
      pc.getSenders().forEach(sender => {
        if (sender.track && sender.track.kind === 'audio') {
          sender.track.enabled = isOnHold;
        }
      });
      setIsOnHold(!isOnHold);
    }
  };

  useEffect(() => {
    if (pendingDial && isRegistered && callStatus === "Idle") {
      setDialNumber(pendingDial);
      const numToDial = pendingDial;
      setPendingDial(null);
      // Wait a tiny bit for state to settle, then call
      setTimeout(() => handleCall(numToDial), 100);
    }
  }, [pendingDial, isRegistered, callStatus]);

  return (
    <div className="w-full h-full p-4 lg:p-6 overflow-hidden flex flex-col">
      <audio ref={audioElRef} autoPlay style={{ display: "none" }} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        
        {/* Left Column: Phone Controls & Session */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6 h-full overflow-y-auto hide-scrollbar pb-6">
          
          <div className="w-full shrink-0 animate-in fade-in slide-in-from-left-4 duration-500">
            <AgentSessionCard backendHost={backendHost} currentUser={currentUser} />
          </div>
          
          {/* Enhanced Dialpad */}
          <div className={`p-6 bg-white dark:bg-slate-900 border ${borderLight} rounded-3xl shadow-xl shadow-slate-200/40 dark:shadow-slate-900/40 flex flex-col items-center shrink-0 animate-in fade-in slide-in-from-left-4 duration-700`}>
            {/* Status Display */}
            <div className="text-center mb-6 w-full">
              <p className={`text-[10px] font-extrabold uppercase tracking-widest ${callStatus !== 'Idle' ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`}>
                {callStatus === "InCall" ? "Görüşme Aktif" : callStatus === "Calling" ? "Aranıyor..." : "Hat Müsait"}
              </p>
              <div className="mt-1 flex items-center justify-center">
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
                 onClick={handleCall}
                 disabled={callStatus !== "Idle"}
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
                     {isOnHold ? <Pause size={32} /> : <Phone size={32} className={callStatus === 'Calling' ? 'animate-bounce' : ''} />}
                   </div>
                   
                   <h2 className="text-4xl md:text-5xl font-extrabold text-slate-800 dark:text-white tracking-widest mb-3 drop-shadow-sm dark:drop-shadow-lg font-mono">
                     {dialNumber}
                   </h2>
                   
                   <div className="flex items-center gap-3">
                     <span className="relative flex h-3 w-3">
                       <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${callStatus === 'InCall' ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400'}`}></span>
                       <span className={`relative inline-flex rounded-full h-3 w-3 ${callStatus === 'InCall' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                     </span>
                     <p className={`font-semibold tracking-widest uppercase text-sm ${callStatus === 'InCall' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                       {callStatus === 'InCall' ? (isOnHold ? 'Beklemede' : `Görüşme Aktif - ${formatDuration(callDuration)}`) : 'Aranıyor...'}
                     </p>
                   </div>
                   
                   {/* Call Controls */}
                   <div className="flex items-center gap-6 mt-10">
                     <button onClick={toggleMute} className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all hover:scale-110 ${isMuted ? 'bg-rose-100 border-rose-300 text-rose-500 dark:bg-rose-500/20 dark:border-rose-500/50 dark:text-rose-400' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10'}`}>
                       {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                     </button>
                     <button onClick={toggleHold} className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all hover:scale-110 ${isOnHold ? 'bg-amber-100 border-amber-300 text-amber-600 dark:bg-amber-500/20 dark:border-amber-500/50 dark:text-amber-400' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10'}`}>
                       {isOnHold ? <Play size={22} /> : <Pause size={22} />}
                     </button>
                     <button onClick={handleHangup} className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 hover:from-rose-600 hover:to-rose-800 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all hover:scale-110 group">
                       <PhoneOff size={28} className="group-hover:scale-110 transition-transform" />
                     </button>
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
    </div>
  );
}
