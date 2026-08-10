import React, { useState, useEffect, useRef } from "react";
import * as SIP from "sip.js";
import { Phone, PhoneOff, ShieldAlert, Wifi, WifiOff, Minimize2 } from "lucide-react";

export default function WebRTCIstemci({ agentExtension, password, asteriskWssUrl, onActiveCall }) {
  const [registered, setRegistered] = useState(false);
  const [session, setSession] = useState(null);
  const [callStatus, setCallStatus] = useState("Idle"); // Idle, Ringing, InCall
  const [error, setError] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  const [callDuration, setCallDuration] = useState(0);
  
  const userAgentRef = useRef(null);
  const audioElRef = useRef(null);

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

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto expand when call ringing or active, auto collapse when call ends (Idle)
  useEffect(() => {
    if (callStatus === "Ringing" || callStatus === "InCall") {
      setIsCollapsed(false);
    } else if (callStatus === "Idle") {
      setIsCollapsed(true);
    }
  }, [callStatus]);

  // Initialize and register to Asterisk WebRTC WSS Gateway
  useEffect(() => {
    if (!asteriskWssUrl || !agentExtension) return;

    setError("");
    const hostOnly = asteriskWssUrl.split('/')[2].split(':')[0];
    const uri = SIP.UserAgent.makeURI(`sip:${agentExtension}@${hostOnly}`);
    
    const transportOptions = {
      server: asteriskWssUrl,
      traceSip: true
    };

    const userAgentOptions = {
      uri: uri,
      transportOptions: transportOptions,
      viaHost: hostOnly,
      contactName: agentExtension,
      authorizationUsername: agentExtension,
      authorizationPassword: password,
      displayName: `Temsilci ${agentExtension}`,
      hackIpInContact: true,
      // Request media permissions for microphone
      delegate: {
        onInvite: (invite) => {
          console.log("[WebRTC] Gelen arama alindi!");
          setSession(invite);
          setCallStatus("Ringing");
          
          // Get call unique ID from SIP headers (Asterisk passes UNIQUEID in headers)
          const sipCallId = invite.request.callId; 
          // Notify parent dashboard that a call has arrived
          onActiveCall(sipCallId);

          // Listen for session state changes (answered, hung up)
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

    // Start UA and register
    ua.start()
      .then(() => {
        const registererOptions = {};
        const registerer = new SIP.Registerer(ua, registererOptions);
        
        // Track state change of registrar to accurately update registration state in UI
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

  // Answer Incoming Call
  const answerCall = async () => {
    if (!session) return;
    
    try {
      const constraints = { audio: true, video: false };
      
      // Accept invite with audio media constraints first (this creates the sessionDescriptionHandler)
      await session.accept({
        sessionDescriptionHandlerOptions: {
          constraints: constraints
        }
      });
      
      // Now sessionDescriptionHandler is guaranteed to exist
      const peerConnection = session.sessionDescriptionHandler.peerConnection;
      if (peerConnection) {
        console.log(`[WebRTC] PeerConnection Olusturuldu. Ilk Durum: ${peerConnection.connectionState}, ICE Durumu: ${peerConnection.iceConnectionState}`);
        
        peerConnection.addEventListener("connectionstatechange", () => {
          console.log(`[WebRTC] PeerConnection Durumu degisti: ${peerConnection.connectionState}`);
        });

        peerConnection.addEventListener("iceconnectionstatechange", () => {
          console.log(`[WebRTC] ICE Baglanti Durumu degisti: ${peerConnection.iceConnectionState}`);
        });

        // 1. Hook up already received tracks (to prevent missing events fired before/during accept)
        const receivers = peerConnection.getReceivers();
        console.log(`[WebRTC] Mevcut alici (receiver) sayisi: ${receivers.length}`);
        receivers.forEach((receiver) => {
          if (receiver.track && receiver.track.kind === "audio") {
            console.log("[WebRTC] Mevcut ses akışı (receiver) bulundu ve bağlandı.");
            const remoteStream = new MediaStream([receiver.track]);
            if (audioElRef.current) {
              audioElRef.current.srcObject = remoteStream;
              audioElRef.current.play().catch(e => console.error("[WebRTC] Mevcut ses oynatılamadı:", e));
            }
          }
        });

        // 2. Listen for future tracks
        peerConnection.addEventListener("track", (event) => {
          if (event.track.kind === "audio" && audioElRef.current) {
            console.log("[WebRTC] Karşı tarafın yeni ses akışı bağlandı.");
            const remoteStream = new MediaStream([event.track]);
            audioElRef.current.srcObject = remoteStream;
            audioElRef.current.play().catch(e => console.error("[WebRTC] Yeni ses oynatılamadı:", e));
          }
        });
      }
      
      setCallStatus("InCall");
    } catch (err) {
      console.error("[WebRTC] Arama cevaplama hatasi:", err);
      if (err) {
        console.error(`[WebRTC] Hata Detayları - İsim: ${err.name}, Mesaj: ${err.message}, Stack: ${err.stack}`);
      }
      setError(`Arama cevaplanırken WebRTC hatası oluştu: ${err ? err.message : "Bilinmeyen hata"}`);
    }
  };

  // Reject / Hang up Call
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

  // Render Collapsed Pill Button
  if (isCollapsed) {
    return (
      <div 
        onClick={() => setIsCollapsed(false)}
        className="flex items-center gap-3 px-4 py-2.5 bg-white/90 dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200/80 dark:border-slate-800/80 rounded-full text-slate-800 dark:text-white shadow-xl hover:shadow-2xl cursor-pointer transition-all duration-300 select-none backdrop-blur-md"
      >
        <span className="relative flex h-2 w-2">
          {registered ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          )}
        </span>
        <Phone size={14} className={registered ? "text-primary dark:text-emerald-400" : "text-primary dark:text-rose-450"} />
        <span className="text-xs font-bold tracking-wide">
          {registered ? `Dahili ${agentExtension}` : `Dahili ${agentExtension} (Bağlı Değil)`}
        </span>
      </div>
    );
  }

  // Render Expanded Card Dialer
  return (
    <div className="flex flex-col p-5 bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl text-slate-800 dark:text-white shadow-2xl w-full max-w-sm transition-all duration-300 backdrop-blur-lg">
      {/* Header Status */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800/60 pb-3">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">Telefon Modülü</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[10px]">
            {registered ? (
              <span className="flex items-center text-primary dark:text-emerald-400 gap-1 font-bold">
                <Wifi size={10} /> ÇEVRİMİÇİ
              </span>
            ) : (
              <span className="flex items-center text-primary dark:text-rose-400 gap-1 font-bold">
                <WifiOff size={10} /> BAĞLANTI YOK
              </span>
            )}
          </div>
          <button 
            onClick={() => setIsCollapsed(true)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-lg transition"
            title="Küçült"
          >
            <Minimize2 size={13} />
          </button>
        </div>
      </div>

      {/* Hidden audio element to play remote call voice */}
      <audio ref={audioElRef} autoPlay style={{ display: "none" }} />

      {/* Call Dialog */}
      <div className="flex flex-col items-center justify-center py-6 bg-slate-50 dark:bg-slate-950 rounded-xl mb-4 border border-slate-200/60 dark:border-slate-900">
        {callStatus === "Idle" && (
          <div className="text-center py-2">
            <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 flex items-center justify-center mx-auto mb-2 text-slate-400">
              <Phone size={16} />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Yeni çağrı bekleniyor...</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1 uppercase tracking-wider font-bold">Hat Müsait</p>
          </div>
        )}

        {callStatus === "Ringing" && (
          <div className="text-center py-2 animate-pulse">
            <div className="h-12 w-12 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-center justify-center mx-auto mb-3 text-primary dark:text-amber-400 animate-bounce">
              <Phone size={20} className="animate-spin" />
            </div>
            <p className="text-primary dark:text-amber-400 font-extrabold text-sm tracking-wide uppercase">Yapay Zekadan Aktarım!</p>
            <p className="text-xs text-slate-500 dark:text-slate-350 mt-1.5 font-medium">Gelen Çağrı Alınıyor...</p>
          </div>
        )}

        {callStatus === "InCall" && (
          <div className="text-center py-2">
            <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-250 dark:border-emerald-900/50 flex items-center justify-center mx-auto mb-2 text-primary dark:text-emerald-400">
              <Phone size={20} className="animate-pulse" />
            </div>
            <p className="text-primary dark:text-emerald-400 font-extrabold text-base tracking-wide uppercase">Görüşme Aktif</p>
            <p className="text-xl font-bold font-mono text-slate-800 dark:text-slate-200 mt-1.5">
              {formatDuration(callDuration)}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider font-bold">Müşteri Ses Kanalı Açık</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-3">
        {callStatus === "Ringing" && (
          <button
            onClick={answerCall}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary active:bg-emerald-700 text-white transition rounded-xl font-semibold text-xs tracking-wide shadow-lg shadow-emerald-500/20"
          >
            <Phone size={14} /> Cevapla
          </button>
        )}
        
        {callStatus !== "Idle" && (
          <button
            onClick={hangupCall}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary active:bg-rose-700 text-white transition rounded-xl font-semibold text-xs tracking-wide shadow-lg shadow-rose-500/20"
          >
            <PhoneOff size={14} /> {callStatus === "Ringing" ? "Reddet" : "Kapat"}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 rounded-xl text-primary dark:text-rose-300 text-xs flex items-start gap-2">
          <ShieldAlert size={14} className="shrink-0 mt-0.5" />
          <span className="font-medium">{error}</span>
        </div>
      )}
    </div>
  );
}
