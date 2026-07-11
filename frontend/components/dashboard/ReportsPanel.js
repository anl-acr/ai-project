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
  ChevronRight,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Award
} from "lucide-react";

export default function ReportsPanel({ backendHost = "localhost:8000", viewMode = "cdr" }) {
  const [calls, setCalls] = useState([]);
  const [selectedCall, setSelectedCall] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [reportTopic, setReportTopic] = useState("");
  const [reportNotes, setReportNotes] = useState("");
  const [savingReportNotes, setSavingReportNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [showQAReport, setShowQAReport] = useState(false);

  // Fetch all calls on mount
  useEffect(() => {
    fetchCalls();
  }, []);

  // Sync selectedCall notes and topic in ReportsPanel
  useEffect(() => {
    if (selectedCall) {
      setReportTopic(selectedCall.agent_topic || "");
      setReportNotes(selectedCall.agent_notes || "");
    } else {
      setReportTopic("");
      setReportNotes("");
    }
  }, [selectedCall]);

  const handleSaveReportNotes = async () => {
    if (!selectedCall) return;
    setSavingReportNotes(true);
    setNotesSaved(false);
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/calls/${selectedCall.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: reportTopic, notes: reportNotes })
      });
      if (res.ok) {
        setNotesSaved(true);
        // Update local calls state
        setCalls((prev) => 
          prev.map((c) => 
            c.id === selectedCall.id 
              ? { ...c, agent_topic: reportTopic, agent_notes: reportNotes } 
              : c
          )
        );
        setSelectedCall((prev) => 
          prev ? { ...prev, agent_topic: reportTopic, agent_notes: reportNotes } : null
        );
        setTimeout(() => setNotesSaved(false), 3000);
      }
    } catch (err) {
      console.error("Not kaydedilemedi:", err);
    } finally {
      setSavingReportNotes(false);
    }
  };

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
    <div className="w-full max-w-6xl h-[calc(100vh-12rem)] flex gap-6 text-slate-800 dark:text-slate-100">
      {/* Left side: Call Logs List */}
      <div className="w-80 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden shrink-0 shadow-sm transition-colors duration-300">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {viewMode === "cdr" ? "CDR Kayıtları" :
               viewMode === "audio" ? "Ses Kayıtları" :
               viewMode === "transcripts" ? "Görüşme Transkriptleri" :
               viewMode === "sentiment" ? "Duygu Analizleri" :
               viewMode === "qa" ? "Kalite Raporları" : "Çağrı Raporları"}
            </h3>
            <button 
              onClick={fetchCalls}
              className="text-[10px] bg-purple-50 dark:bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800/40 hover:bg-purple-600 hover:text-white px-2.5 py-1 rounded-lg transition font-bold cursor-pointer"
            >
              Yenile
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" size={14} />
            <input
              type="text"
              placeholder="Numara veya Arama ID Ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-purple-500 transition font-medium"
            />
          </div>
        </div>

        {/* List scroll area */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-850 scrollbar-thin">
          {isLoading ? (
            <div className="text-center py-12 text-xs text-slate-400 dark:text-slate-500 animate-pulse font-semibold">
              Arama kayıtları yükleniyor...
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400 dark:text-slate-500 font-semibold">
              Kayıt bulunamadı.
            </div>
          ) : (
            filteredCalls.map((call) => {
              const isSelected = selectedCall?.id === call.id;
              return (
                <button
                  key={call.id}
                  onClick={() => handleSelectCall(call)}
                  className={`w-full text-left p-4 flex items-center justify-between transition cursor-pointer ${
                    isSelected 
                      ? "bg-purple-50/50 dark:bg-purple-600/10 border-l-2 border-purple-500" 
                      : "hover:bg-slate-50/50 dark:hover:bg-slate-850"
                  }`}
                >
                  <div className="space-y-1 min-w-0 pr-2">
                    <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5 flex-wrap">
                      <Phone size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
                      <span>{call.caller_number}</span>
                      
                      {viewMode === "sentiment" && call.sentiment && (
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border tracking-wide shrink-0 ${
                          call.sentiment === "Pozitif" || call.sentiment === "Memnun"
                            ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border-emerald-100 dark:border-emerald-900/35"
                            : call.sentiment === "Öfkeli" || call.sentiment === "Olumsuz"
                            ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-455 border-rose-100 dark:border-rose-900/35 animate-pulse"
                            : "bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                        }`}>
                          {call.sentiment}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono truncate">
                        ID: {call.id.slice(0, 8)}...
                      </p>
                      {viewMode === "qa" && call.qa_score !== undefined && call.qa_score !== null && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 border border-indigo-100 dark:border-indigo-900/30">
                          QA: {call.qa_score} Puan
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                      {formatDate(call.start_time)}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      call.status === "completed"
                        ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/10"
                        : call.status === "transferred"
                        ? "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/10"
                        : "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/10 animate-pulse"
                    }`}>
                      {call.status === "completed" ? "Bitti" : call.status === "transferred" ? "Aktarıldı" : "Aktif"}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
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

      {/* Right side: Selected Call Details & View Mode Specific Content */}
      <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-sm transition-colors duration-300">
        {selectedCall ? (
          <>
            {/* Header Details */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Phone className="text-purple-650 dark:text-purple-400" size={16} />
                    <span>{selectedCall.caller_number} ile Görüşme Detayları</span>
                    
                    {viewMode === "sentiment" && selectedCall.sentiment && (
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border tracking-wide ${
                        selectedCall.sentiment === "Pozitif" || selectedCall.sentiment === "Memnun"
                          ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/30"
                          : selectedCall.sentiment === "Öfkeli" || selectedCall.sentiment === "Olumsuz"
                          ? "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-900/30"
                          : "bg-slate-50 dark:bg-slate-900 text-slate-655 dark:text-slate-450 border-slate-200 dark:border-slate-800"
                      }`}>
                        Duygu Durumu: {selectedCall.sentiment}
                      </span>
                    )}
                  </h3>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-1">Çağrı ID: {selectedCall.id}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Tarih / Saat</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">{formatDate(selectedCall.start_time)}</p>
                  </div>
                  <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Süre</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">{formatDuration(selectedCall.start_time, selectedCall.end_time)}</p>
                  </div>
                </div>
              </div>

              {/* Call Summary (if exists, show in Sentiment and CDR modes) */}
              {["sentiment", "cdr"].includes(viewMode) && selectedCall.summary && (
                <div className="p-3 bg-purple-50 dark:bg-purple-955/20 border border-purple-100 dark:border-purple-900/35 rounded-xl text-xs text-purple-800 dark:text-purple-300 leading-relaxed font-semibold">
                  <span className="font-bold text-purple-600 dark:text-purple-400 block mb-1">Görüşme Özeti (Yapay Zeka):</span>
                  {selectedCall.summary}
                </div>
              )}

              {/* QA Quality Evaluation Report (show in QA mode) */}
              {viewMode === "qa" && selectedCall.qa_score !== undefined && selectedCall.qa_score !== null && (
                <div className="border border-indigo-150/40 dark:border-indigo-900/30 rounded-xl overflow-hidden shadow-sm">
                  <div className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50/40 dark:bg-indigo-950/10 text-xs font-bold text-indigo-750 dark:text-indigo-400">
                    <div className="flex items-center gap-2">
                      <Award size={16} className="text-indigo-500" />
                      <span>Kalite Puanı: <strong className="text-indigo-600 dark:text-indigo-300 text-sm ml-1">{selectedCall.qa_score} / 100</strong></span>
                    </div>
                  </div>
                  <div className="p-4 bg-white dark:bg-slate-900 border-t border-indigo-100/50 dark:border-indigo-900/20 text-xs space-y-3.5 leading-relaxed max-h-[220px] overflow-y-auto">
                    {selectedCall.qa_report && selectedCall.qa_report.includes("coaching_report") ? (
                      (() => {
                        try {
                          const qaObj = JSON.parse(selectedCall.qa_report);
                          return (
                            <>
                              <div className="p-3 bg-indigo-50/30 dark:bg-indigo-950/15 border border-indigo-100/40 dark:border-indigo-900/30 rounded-xl">
                                <strong className="text-indigo-600 dark:text-indigo-400 block mb-1 font-bold">Yapıcı Koçluk Raporu:</strong>
                                <p className="text-slate-600 dark:text-slate-350 font-medium leading-relaxed">{qaObj.coaching_report}</p>
                              </div>

                              {qaObj.breakdown && qaObj.breakdown.length > 0 && (
                                <div className="space-y-2">
                                  <strong className="text-slate-700 dark:text-slate-300 block font-bold mb-1">Kural Değerlendirme Detayları:</strong>
                                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                                    {qaObj.breakdown.map((item, idx) => (
                                      <div key={idx} className="p-3 flex items-start justify-between gap-4 bg-slate-50/20 dark:bg-slate-955/10">
                                        <div className="space-y-1">
                                          <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{item.question}</p>
                                          {!item.satisfied && item.reason && (
                                            <p className="text-[10px] text-rose-600 font-medium font-mono">{item.reason}</p>
                                          )}
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 uppercase tracking-wide ${
                                          item.satisfied 
                                            ? "bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 border border-emerald-100/50" 
                                            : "bg-rose-50 dark:bg-rose-955/20 text-rose-600 border border-rose-100/50"
                                        }`}>
                                          {item.satisfied ? "Uyumlu" : `-${item.penalty} Puan`}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        } catch (e) {
                          return <p className="text-slate-500">{selectedCall.qa_report}</p>;
                        }
                      })()
                    ) : (
                      <p className="text-slate-500 font-semibold">{selectedCall.qa_report}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Call Recording Player (show in Audio mode) */}
              {viewMode === "audio" && selectedCall.recording_path && (
                <div className="p-4 bg-slate-50 dark:bg-slate-955/60 border border-slate-200 dark:border-slate-850 rounded-xl flex flex-col gap-3 shadow-inner">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-purple-50 dark:bg-purple-600/20 border border-purple-100 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                      <Play size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Çağrı Ses Kayıt Oynatıcısı</p>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">Tür: Asterisk PCM/WAV (16-bit Mono 8kHz)</p>
                    </div>
                  </div>
                  <audio 
                    src={`${window.location.protocol}//${backendHost}${selectedCall.recording_path}`} 
                    controls 
                    className="w-full h-9 mt-1 opacity-90 hover:opacity-100 dark:filter dark:invert transition"
                  />
                </div>
              )}

              {/* Agent Call Notes Form (show in CDR mode) */}
              {viewMode === "cdr" && (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col gap-2 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider">Temsilci Çağrı Notu & Konusu</span>
                    {notesSaved && (
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle size={10} /> Not Kaydedildi!
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <select
                        value={reportTopic}
                        onChange={(e) => setReportTopic(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-semibold"
                      >
                        <option value="">Konu Seçin...</option>
                        <option value="Destek">Destek / Teknik</option>
                        <option value="Satış">Satış / Sipariş</option>
                        <option value="Ödeme">Ödeme / Fatura</option>
                        <option value="Şikayet">Şikayet / İptal</option>
                        <option value="Bilgi">Bilgi Talebi</option>
                        <option value="Diğer">Diğer</option>
                      </select>
                    </div>
                    <div className="col-span-2 flex gap-2">
                      <input
                        type="text"
                        placeholder="Temsilci çağrı notu yazın..."
                        value={reportNotes}
                        onChange={(e) => setReportNotes(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-semibold"
                      />
                      <button
                        onClick={handleSaveReportNotes}
                        disabled={savingReportNotes}
                        className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-500/10 transition shrink-0 cursor-pointer"
                      >
                        {savingReportNotes ? "..." : "Kaydet"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Transcript Scroll Area (show in Transcripts mode) */}
            {viewMode === "transcripts" && (
              <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/30 dark:bg-slate-950/10 scrollbar-thin">
                {transcripts.length === 0 ? (
                  <div className="text-center py-20 text-xs text-slate-400 dark:text-slate-555 font-semibold">
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
                          className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${
                            isAI
                              ? "bg-purple-50 dark:bg-purple-600/30 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-800"
                              : isHuman
                              ? "bg-emerald-50 dark:bg-emerald-600/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800"
                              : "bg-blue-50 dark:bg-blue-600/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800"
                          }`}
                        >
                          {isAI ? <Bot size={16} /> : <User size={16} />}
                        </div>

                        {/* Message Content Bubble */}
                        <div className="flex flex-col">
                          <div
                            className={`px-4 py-3 rounded-2xl text-xs leading-relaxed border font-semibold shadow-sm ${
                              isCustomer
                                ? "bg-slate-50 dark:bg-slate-955 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tr-none"
                                : isHuman
                                ? "bg-emerald-50 dark:bg-emerald-955 border-emerald-100 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-100 rounded-tl-none"
                                : "bg-purple-50 dark:bg-purple-955 border-purple-100 dark:border-purple-900/50 text-purple-800 dark:text-purple-100 rounded-tl-none"
                            }`}
                          >
                            <p className="font-bold text-[9px] mb-1 opacity-70 tracking-wider">
                              {isAI ? "YAPAY ZEKA" : isHuman ? "MÜŞTERİ TEMSİLCİSİ" : "MÜŞTERİ"}
                            </p>
                            <p className="whitespace-pre-line">{turn.text}</p>
                          </div>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 px-2 self-end font-medium">
                            {formatDate(turn.timestamp)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Other modes empty transcript placeholder/summary banner */}
            {viewMode !== "transcripts" && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-8 bg-slate-50/10 dark:bg-slate-955/5">
                <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-wider">Görüşme Rapor Detayları</p>
                <p className="text-[9px] text-slate-500 dark:text-slate-500 mt-1 text-center font-semibold max-w-xs leading-relaxed">
                  {viewMode === "cdr" ? "Çağrı CDR kayıtları ve temsilci notları yukarıda gösterilmektedir." :
                   viewMode === "audio" ? "Görüşmeye ait ses kaydını dinlemek için yukarıdaki oynatıcıyı kullanın." :
                   viewMode === "sentiment" ? "Çağrıya ait müşteri duygu durumu analizi ve görüşme özeti yukarıda belirtilmiştir." :
                   viewMode === "qa" ? "Yapay zeka tarafından gerçekleştirilen kalite puanlaması ve değerlendirme ayrıntıları yukarıda sunulmuştur." : ""}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-550 p-8">
            <MessageSquare size={48} className="text-slate-205 dark:text-slate-700 mb-3" />
            <p className="text-sm font-bold">Görüntülenecek Görüşme Seçin</p>
            <p className="text-xs text-slate-450 dark:text-slate-600 mt-1 font-medium">Sol menüden çağrı detaylarını incelemek için bir görüşme seçebilirsiniz.</p>
          </div>
        )}
      </div>
    </div>
  );
}
