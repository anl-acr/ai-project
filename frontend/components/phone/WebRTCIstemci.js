import React, { useState, useEffect, useRef } from "react";
import * as SIP from "sip.js";
import { Phone, PhoneOff, ShieldAlert, Wifi, WifiOff, Minimize2 } from "lucide-react";

export default function WebRTCIstemci({ agentExtension, password, asteriskWssUrl, onActiveCall }) {
  const [registered, setRegistered] = useState(false);
  const [session, setSession] = useState(null);
  const [callStatus, setCallStatus] = useState("Idle"); // Idle, Ringing, InCall
  const [error, setError] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  const userAgentRef = useRef(null);
  const audioElRef = useRef(null);

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
    const uri = SIP.UserAgent.makeURI(`sip:${agentExtension}@${asteriskWssUrl.split('/')[2]}`);
    
    const transportOptions = {
      server: asteriskWssUrl,
      traceSip: true
    };

    const userAgentOptions = {
      uri: uri,
      transportOptions: transportOptions,
      contactName: agentExtension,
      authorizationUsername: agentExtension,
      authorizationPassword: password,
      displayName: `Temsilci ${agentExtension}`,
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
        className="flex items-center gap-3 px-4 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-full text-white shadow-2xl cursor-pointer transition-all duration-200 select-none"
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
        <Phone size={14} className={registered ? "text-emerald-400" : "text-rose-400"} />
        <span className="text-xs font-semibold">
          {registered ? `Dahili ${agentExtension} (Çevrimiçi)` : `Dahili ${agentExtension} (Çevrimdışı)`}
        </span>
      </div>
    );
  }

  // Render Expanded Card Dialer
  return (
    <div className="flex flex-col p-4 bg-slate-900 border border-slate-800 rounded-2xl text-white shadow-2xl w-full max-w-sm transition-all duration-200">
      {/* Header Status */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
        <h3 className="font-semibold text-sm">Telefon Arayüzü</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[10px]">
            {registered ? (
              <span className="flex items-center text-emerald-400 gap-1 font-semibold">
                <Wifi size={10} /> Bağlı
              </span>
            ) : (
              <span className="flex items-center text-rose-400 gap-1 font-semibold">
                <WifiOff size={10} /> Bağlanamadı
              </span>
            )}
          </div>
          <button 
            onClick={() => setIsCollapsed(true)}
            className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-1 rounded-lg transition"
            title="Küçült"
          >
            <Minimize2 size={14} />
          </button>
        </div>
      </div>

      {/* Hidden audio element to play remote call voice */}
      <audio ref={audioElRef} autoPlay style={{ display: "none" }} />

      {/* Call Dialog */}
      <div className="flex flex-col items-center justify-center py-6 bg-slate-950 rounded-xl mb-4 border border-slate-800">
        {callStatus === "Idle" && (
          <div className="text-center">
            <p className="text-slate-400 text-sm">Arama bekleniyor...</p>
            <p className="text-xs text-slate-600 mt-1">Sinyalizasyon Aktif</p>
          </div>
        )}

        {callStatus === "Ringing" && (
          <div className="text-center animate-pulse">
            <p className="text-amber-400 font-bold text-lg">YAPAY ZEKADAN ÇAĞRI TRANSFERİ!</p>
            <p className="text-sm text-slate-300 mt-1">Gelen Çağrı Alınıyor...</p>
          </div>
        )}

        {callStatus === "InCall" && (
          <div className="text-center">
            <p className="text-emerald-400 font-bold text-lg">GÖRÜŞME AKTİF</p>
            <p className="text-xs text-slate-400 mt-1">Müşteri ile WebRTC Ses Hattı Açık</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4">
        {callStatus === "Ringing" && (
          <button
            onClick={answerCall}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 transition rounded-xl font-medium"
          >
            <Phone size={18} /> Cevapla
          </button>
        )}
        
        {callStatus !== "Idle" && (
          <button
            onClick={hangupCall}
            className="flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 transition rounded-xl font-medium"
          >
            <PhoneOff size={18} /> {callStatus === "Ringing" ? "Reddet" : "Kapat"}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 p-2 bg-rose-950/50 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <ShieldAlert size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
