import React, { useState, useEffect, useRef } from "react";
import { Bot, MessageSquare, User } from "lucide-react";

export default function TranscriptPanel({ callId, backendHost = "localhost:8000" }) {
  const [transcripts, setTranscripts] = useState([]);
  const [wsStatus, setWsStatus] = useState("disconnected"); // disconnected, connecting, connected
  const chatEndRef = useRef(null);

  // Load initial transcripts or subscribe to WebSocket updates when callId changes
  useEffect(() => {
    if (!callId) {
      setTranscripts([]);
      return;
    }

    setTranscripts([]);
    setWsStatus("connecting");

    // Fetch existing historical transcript first
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    fetch(`${protocol}//${backendHost}/api/calls/${callId}/transcripts`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTranscripts(data);
        }
      })
      .catch((err) => console.error("[Transcript] Eski transkriptler alinamadi:", err));

    // Connect to FastAPI live WebSocket stream
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${backendHost}/ws/transcripts/${callId}`;
    console.log(`[Transcript] WebSocket baglantisi kuruluyor: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsStatus("connected");
      console.log("[Transcript] Canlı transkript akışı bağlandı.");
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "transcript") {
          setTranscripts((prev) => [
            ...prev,
            {
              speaker: message.speaker,
              text: message.text,
              timestamp: new Date().toISOString()
            }
          ]);
        }
      } catch (err) {
        console.error("[Transcript] WebSocket mesaj ayrıştırma hatası:", err);
      }
    };

    ws.onclose = () => {
      setWsStatus("disconnected");
      console.log("[Transcript] Canlı transkript akışı kapandı.");
    };

    return () => {
      ws.close();
    };
  }, [callId, backendHost]);

  // Auto scroll to latest speech turn
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  if (!callId) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 min-h-[400px] w-full">
        <MessageSquare size={48} className="text-slate-600 mb-3 animate-pulse" />
        <p className="font-medium text-sm">Aktif Görüşme Bulunmuyor</p>
        <p className="text-xs text-slate-600 mt-1">Yapay zeka veya temsilci görüşmeye başladığında transkript burada listelenecektir.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-2xl text-white shadow-lg w-full h-[600px]">
      {/* Panel Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <MessageSquare className="text-emerald-400" size={20} />
          <div>
            <h3 className="font-semibold text-sm">Canlı Görüşme Transkripti</h3>
            <p className="text-[10px] text-slate-500 font-mono">Çağrı ID: {callId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {wsStatus === "connected" && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
              Canlı Akış Aktif
            </span>
          )}
          {wsStatus === "connecting" && (
            <span className="text-xs text-amber-400 animate-pulse">Bağlanıyor...</span>
          )}
          {wsStatus === "disconnected" && (
            <span className="text-xs text-slate-500">Bağlantı Yok</span>
          )}
        </div>
      </div>

      {/* Transcript Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
        {transcripts.length === 0 && wsStatus === "connected" && (
          <div className="text-center py-10 text-slate-500 text-xs">
            Yapay zeka ses bekleniyor... Konuşma başladığında canlı transkript buraya akacaktır.
          </div>
        )}
        
        {transcripts.map((turn, index) => {
          const isAI = turn.speaker === "ai";
          const isCustomer = turn.speaker === "customer";
          const isHuman = turn.speaker === "human";

          return (
            <div
              key={index}
              className={`flex gap-3 max-w-[85%] ${
                isCustomer ? "mr-auto flex-row" : "ml-auto flex-row-reverse"
              }`}
            >
              {/* Avatar Icon */}
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-md ${
                  isAI
                    ? "bg-purple-600/30 text-purple-400 border border-purple-800"
                    : isHuman
                    ? "bg-emerald-600/30 text-emerald-400 border border-emerald-800"
                    : "bg-blue-600/30 text-blue-400 border border-blue-800"
                }`}
              >
                {isAI ? <Bot size={16} /> : <User size={16} />}
              </div>

              {/* Message Content Bubble */}
              <div className="flex flex-col">
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed border ${
                    isCustomer
                      ? "bg-slate-950/60 border-slate-800 text-slate-100 rounded-tl-none"
                      : isHuman
                      ? "bg-emerald-950/40 border-emerald-900/50 text-emerald-100 rounded-tr-none"
                      : "bg-purple-950/40 border-purple-900/50 text-purple-100 rounded-tr-none"
                  }`}
                >
                  <p className="font-semibold text-[10px] mb-1 opacity-70 tracking-wide">
                    {isAI ? "YAPAY ZEKA" : isHuman ? "MÜŞTERİ TEMSİLCİSİ" : "MÜŞTERİ"}
                  </p>
                  <p className="whitespace-pre-line">{turn.text}</p>
                </div>
                <span className="text-[9px] text-slate-500 mt-1 px-2 self-end">
                  {turn.timestamp ? new Date(turn.timestamp).toLocaleTimeString() : ""}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>
    </div>
  );
}
