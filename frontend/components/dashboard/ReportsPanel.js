import React, { useState, useEffect } from "react";
import { 
  Phone, 
  Clock, 
  MessageSquare, 
  Play, 
  Search, 
  Bot, 
  User, 
  ShieldAlert, 
  Calendar as CalendarIcon,
  ChevronRight
} from "lucide-react";

export default function ReportsPanel({ backendHost = "localhost:8000" }) {
  const [calls, setCalls] = useState([]);
  const [selectedCall, setSelectedCall] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all calls on mount
  useEffect(() => {
    fetchCalls();
  }, []);

  const fetchCalls = () => {
    setIsLoading(true);
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    fetch(`${protocol}//${backendHost}/api/calls`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCalls(data);
          if (data.length > 0) {
            handleSelectCall(data[0]);
          }
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("[Reports] Çağrı geçmişi yüklenemedi:", err);
        setIsLoading(false);
      });
  };

  const handleSelectCall = (call) => {
    setSelectedCall(call);
    setTranscripts([]);
    
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    fetch(`${protocol}//${backendHost}/api/calls/${call.id}/transcripts`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTranscripts(data);
        }
      })
      .catch((err) => console.error("[Reports] Görüşme detayları yüklenemedi:", err));
  };

  const formatDuration = (start, end) => {
    if (!end) return "Aktif";
    const durationMs = new Date(end) - new Date(start);
    const totalSecs = Math.max(0, Math.floor(durationMs / 1000));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    let cleanDateStr = dateStr;
    // naive ISO string datetimes returned from FastAPI in UTC need "Z" suffix
    if (!dateStr.endsWith("Z") && !dateStr.includes("+") && !dateStr.includes("GMT")) {
      cleanDateStr = dateStr + "Z";
    }
    const date = new Date(cleanDateStr);
    return date.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  const filteredCalls = calls.filter((c) =>
    c.caller_number?.includes(searchTerm) || 
    c.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full max-w-6xl h-[calc(100vh-12rem)] flex gap-6">
      {/* Left side: Call Logs List */}
      <div className="w-80 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shrink-0 shadow-lg">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/30 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm tracking-wide">Çağrı Raporları</h3>
            <button 
              onClick={fetchCalls}
              className="text-[10px] bg-purple-600/20 text-purple-400 border border-purple-800/40 hover:bg-purple-600 hover:text-white px-2 py-1 rounded-lg transition"
            >
              Yenile
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
            <input
              type="text"
              placeholder="Numara veya Arama ID Ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-purple-600 transition"
            />
          </div>
        </div>

        {/* List scroll area */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-850">
          {isLoading ? (
            <div className="text-center py-10 text-xs text-slate-500 animate-pulse">
              Arama kayıtları yükleniyor...
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              Kayıt bulunamadı.
            </div>
          ) : (
            filteredCalls.map((call) => {
              const isSelected = selectedCall?.id === call.id;
              return (
                <button
                  key={call.id}
                  onClick={() => handleSelectCall(call)}
                  className={`w-full text-left p-4 flex items-center justify-between transition ${
                    isSelected 
                      ? "bg-purple-600/10 border-l-2 border-purple-500" 
                      : "hover:bg-slate-850"
                  }`}
                >
                  <div className="space-y-1 min-w-0 pr-2">
                    <p className="font-semibold text-xs text-slate-200 truncate flex items-center gap-1.5">
                      <Phone size={12} className="text-slate-500" />
                      {call.caller_number}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">
                      ID: {call.id.slice(0, 8)}...
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {formatDate(call.start_time)}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      call.status === "completed"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/10"
                        : call.status === "transferred"
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/10"
                        : "bg-blue-500/15 text-blue-400 border border-blue-500/10 animate-pulse"
                    }`}>
                      {call.status === "completed" ? "Bitti" : call.status === "transferred" ? "Aktarıldı" : "Aktif"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                      <Clock size={10} />
                      {formatDuration(call.start_time, call.end_time)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right side: Selected Call Details & Transcript */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-lg">
        {selectedCall ? (
          <>
            {/* Header Details */}
            <div className="p-5 border-b border-slate-800 bg-slate-950/40 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <Phone className="text-purple-400" size={16} />
                    {selectedCall.caller_number} ile Görüşme Raporu
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-1">Çağrı Benzersiz ID: {selectedCall.id}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500">Tarih / Saat</p>
                    <p className="text-xs font-semibold text-slate-300 mt-0.5">{formatDate(selectedCall.start_time)}</p>
                  </div>
                  <div className="h-6 w-[1px] bg-slate-800"></div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500">Görüşme Süresi</p>
                    <p className="text-xs font-semibold text-slate-300 mt-0.5">{formatDuration(selectedCall.start_time, selectedCall.end_time)}</p>
                  </div>
                </div>
              </div>

              {/* Call Summary (if exists) */}
              {selectedCall.summary && (
                <div className="p-3 bg-purple-950/20 border border-purple-900/35 rounded-xl text-xs text-purple-300/90 leading-relaxed">
                  <span className="font-bold text-purple-400 block mb-1">Görüşme Özeti (Yapay Zeka):</span>
                  {selectedCall.summary}
                </div>
              )}

              {/* Call Recording Player */}
              {selectedCall.recording_path && (
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4 mt-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-purple-600/20 border border-purple-800/40 flex items-center justify-center text-purple-400 shrink-0">
                      <Play size={14} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-200">Görüşme Ses Kaydı</p>
                      <p className="text-[9px] text-slate-500 font-mono">Tip: Asterisk WAV</p>
                    </div>
                  </div>
                  <audio 
                    src={`${window.location.protocol}//${backendHost}${selectedCall.recording_path}`} 
                    controls 
                    className="h-8 max-w-[240px] filter invert opacity-80 hover:opacity-100 transition"
                  />
                </div>
              )}
            </div>

            {/* Transcript Scroll Area */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-950/10">
              {transcripts.length === 0 ? (
                <div className="text-center py-20 text-xs text-slate-500">
                  Bu çağrı için transkript kaydı bulunamadı.
                </div>
              ) : (
                transcripts.map((turn, index) => {
                  const isAI = turn.speaker === "ai" || turn.speaker === "agent";
                  const isCustomer = turn.speaker === "customer" || turn.speaker === "user";
                  const isHuman = turn.speaker === "human";

                  return (
                    <div
                      key={turn.id || index}
                      className={`flex gap-3 max-w-[85%] ${
                        isCustomer ? "ml-auto flex-row-reverse" : "mr-auto flex-row"
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
                              ? "bg-slate-950/60 border-slate-800 text-slate-100 rounded-tr-none"
                              : isHuman
                              ? "bg-emerald-950/40 border-emerald-900/50 text-emerald-100 rounded-tl-none"
                              : "bg-purple-950/40 border-purple-900/50 text-purple-100 rounded-tl-none"
                          }`}
                        >
                          <p className="font-semibold text-[10px] mb-1 opacity-70 tracking-wide">
                            {isAI ? "YAPAY ZEKA" : isHuman ? "MÜŞTERİ TEMSİLCİSİ" : "MÜŞTERİ"}
                          </p>
                          <p className="whitespace-pre-line">{turn.text}</p>
                        </div>
                        <span className="text-[9px] text-slate-500 mt-1 px-2 self-end">
                          {formatDate(turn.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8">
            <MessageSquare size={48} className="text-slate-700 mb-3" />
            <p className="text-sm font-medium">Görüntülenecek Görüşme Seçin</p>
            <p className="text-xs text-slate-600 mt-1">Sol menüden çağrı detaylarını incelemek için bir görüşme seçebilirsiniz.</p>
          </div>
        )}
      </div>
    </div>
  );
}
