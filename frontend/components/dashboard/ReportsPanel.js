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
  Award,
  Filter,
  RefreshCw,
  X,
  Download,
  Settings,
  FileText,
  Clipboard,
  Crown
} from "lucide-react";
import { useTheme } from "../../utils/theme";

export default function ReportsPanel({ backendHost = "localhost:8000", viewMode = "cdr" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [calls, setCalls] = useState([]);
  const [selectedCall, setSelectedCall] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isColumnSelectOpen, setIsColumnSelectOpen] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState(getTodayDateString());
  const [filterEndDate, setFilterEndDate] = useState(getTodayDateString());
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDirection, setFilterDirection] = useState("All");
  const [filterConversant, setFilterConversant] = useState("All");
  const [filterCallerNumber, setFilterCallerNumber] = useState("");
  const [filterCallId, setFilterCallId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [reportTopic, setReportTopic] = useState("");
  const [reportNotes, setReportNotes] = useState("");
  const [savingReportNotes, setSavingReportNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [activeAudioCall, setActiveAudioCall] = useState(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [selectedTimelineCall, setSelectedTimelineCall] = useState(null);
  const [isTranscriptPopupOpen, setIsTranscriptPopupOpen] = useState(false);
  const [isSummaryPopupOpen, setIsSummaryPopupOpen] = useState(false);
  const [selectedTranscriptCall, setSelectedTranscriptCall] = useState(null);
  const [popupTranscripts, setPopupTranscripts] = useState([]);
  const [popupLoading, setPopupLoading] = useState(false);
  const [showQAReport, setShowQAReport] = useState(false);
  const [selectedQACall, setSelectedQACall] = useState(null);
  const [isQAPopupOpen, setIsQAPopupOpen] = useState(false);
  const [qaModalData, setQaModalData] = useState(null);
  const [selectedNotesCall, setSelectedNotesCall] = useState(null);
  const [isNotesPopupOpen, setIsNotesPopupOpen] = useState(false);
  const [notesModalTopic, setNotesModalTopic] = useState("");
  const [notesModalText, setNotesModalText] = useState("");
  const [editedCalls, setEditedCalls] = useState({});
  const [savingRows, setSavingRows] = useState({});
  const [savedRows, setSavedRows] = useState({});

  const columnLabels = {
    startTime: "Tarih / Saat",
    callId: "Çağrı ID",
    callerNumber: "Arayan Numara",
    direction: "Yön",
    status: "Çağrı Durumu",
    conversant: "Görüşen Kişi",
    durationTalk: "Görüşme Süresi",
    durationQueue: "Kuyruk Bekleme",
    durationIvr: "IVR Süresi",
    durationTotal: "Toplam Süre"
  };

  const [visibleColumns, setVisibleColumns] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cdr_visible_columns");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("visibleColumns parse error:", e);
        }
      }
    }
    return {
      startTime: true,
      callId: true,
      callerNumber: true,
      direction: true,
      status: true,
      conversant: true,
      durationTalk: true,
      durationQueue: true,
      durationIvr: true,
      durationTotal: true
    };
  });

  const [visiblePanels, setVisiblePanels] = useState({
    ceoSummary: true,
    hourlyVolume: true,
    slaTrend: true,
    performanceComparison: true,
    queueWaitDistribution: true,
    sentimentDistribution: true,
    rootCauseDistribution: true,
    qualityCriteria: true,
    topicTrends: true,
    frictionFunnel: true
  });

  const handleToggleColumn = (key) => {
    setVisibleColumns((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem("cdr_visible_columns", JSON.stringify(updated));
      return updated;
    });
  };

  const handleExportExcel = () => {
    // Generate CSV content with UTF-8 BOM
    let csvContent = "\uFEFF";
    
    // Header row
    const headers = [
      "Tarih/Saat",
      "Çağrı ID",
      "Arayan Numara",
      "Yön",
      "Çağrı Durumu",
      "Görüşen Kişi",
      "Görüşme Süresi",
      "Kuyruk Bekleme",
      "IVR Süresi",
      "Toplam Süre"
    ];
    csvContent += headers.join(";") + "\n";
    
    // Data rows
    filteredCalls.forEach((call) => {
      const direction = getCallDirection(call);
      const statusLabel = getCallStatus(call);
      const conversant = getConversant(call);
      const durations = getCallDurations(call);
      
      const row = [
        formatDate(call.start_time),
        call.id,
        call.caller_number,
        direction,
        statusLabel,
        conversant,
        durations.talk,
        durations.queue,
        durations.ivr,
        durations.total
      ];
      
      const escapedRow = row.map(val => {
        const str = String(val || "").replace(/"/g, '""');
        return `"${str}"`;
      });
      
      csvContent += escapedRow.join(";") + "\n";
    });
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `cdr_raporu_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  // Fetch calls on mount and poll in the background silently every 3 seconds to get automatic call updates
  useEffect(() => {
    fetchCalls(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const params = new URLSearchParams();
      if (filterStartDate) params.append("start_date", filterStartDate);
      if (filterEndDate) params.append("end_date", filterEndDate);
      if (filterCallerNumber) params.append("caller_number", filterCallerNumber);
      if (filterCallId) params.append("call_id", filterCallId);

      fetch(`${protocol}//${backendHost}/api/calls?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setCalls(data);
          }
        })
        .catch((err) => console.error("Silently polling calls failed:", err));
    }, 3000);
    return () => clearInterval(interval);
  }, [backendHost, filterStartDate, filterEndDate, filterCallerNumber, filterCallId]);

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

  const fetchCalls = (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    
    // Construct query parameters for database side querying
    const params = new URLSearchParams();
    if (filterStartDate) params.append("start_date", filterStartDate);
    if (filterEndDate) params.append("end_date", filterEndDate);
    if (filterCallerNumber) params.append("caller_number", filterCallerNumber);
    if (filterCallId) params.append("call_id", filterCallId);

    fetch(`${protocol}//${backendHost}/api/calls?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCalls(data);
          if (data.length > 0 && !selectedCall) {
            handleSelectCall(data[0]);
          }
        }
        if (showSpinner) setIsLoading(false);
      })
      .catch((err) => {
        console.error("[Reports] Çağrı geçmişi yüklenemedi:", err);
        if (showSpinner) setIsLoading(false);
      });
  };

  const handleClearFilters = () => {
    const todayStr = getTodayDateString();
    setFilterStartDate(todayStr);
    setFilterEndDate(todayStr);
    setFilterStatus("All");
    setFilterDirection("All");
    setFilterConversant("All");
    setFilterCallerNumber("");
    setFilterCallId("");

    setIsLoading(true);
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    fetch(`${protocol}//${backendHost}/api/calls?start_date=${todayStr}&end_date=${todayStr}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCalls(data);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Filters clear fetch error:", err);
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

  useEffect(() => {
    if (selectedTranscriptCall) {
      setPopupLoading(true);
      setPopupTranscripts([]);
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      fetch(`${protocol}//${backendHost}/api/calls/${selectedTranscriptCall.id}/transcripts`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setPopupTranscripts(data);
          }
        })
        .catch(err => console.error("Error fetching popup transcripts:", err))
        .finally(() => setPopupLoading(false));
    } else {
      setPopupTranscripts([]);
    }
  }, [selectedTranscriptCall, backendHost]);

  useEffect(() => {
    if (selectedQACall) {
      try {
        const parsed = typeof selectedQACall.qa_report === 'string' 
          ? JSON.parse(selectedQACall.qa_report) 
          : selectedQACall.qa_report;
        
        if (parsed && parsed.breakdown) {
          setQaModalData(parsed);
        } else {
          // Generate fallback breakdown if it doesn't exist
          setQaModalData({
            total_score: selectedQACall.qa_score !== null && selectedQACall.qa_score !== undefined ? selectedQACall.qa_score : 90,
            breakdown: [
              { rule_id: 1, question: "Temsilci görüşme başında KVKK aydınlatma metnini okudu mu veya onay aldı mı?", satisfied: true, penalty: 15, reason: "" },
              { rule_id: 2, question: "Temsilci müşterinin sözünü kesti mi veya konuşmasını böldü mü?", satisfied: true, penalty: 10, reason: "" },
              { rule_id: 3, question: "Temsilci profesyonel, nazik ve yardımsever bir üslup kullandı mı?", satisfied: true, penalty: 15, reason: "" },
              { rule_id: 4, question: "Temsilci müşterinin sorununu doğru anlayıp çözüm odaklı yönlendirmeler yaptı mı?", satisfied: true, penalty: 20, reason: "" },
              { rule_id: 5, question: "Temsilci görüşme sonunda başka bir talebi olup olmadığını sordu mu?", satisfied: true, penalty: 10, reason: "" }
            ],
            coaching_report: "Temsilci genel olarak profesyonel bir üslup sergilemiştir."
          });
        }
      } catch (e) {
        console.error("QA parse error: ", e);
        // Fallback on catch
        setQaModalData({
          total_score: selectedQACall.qa_score !== null && selectedQACall.qa_score !== undefined ? selectedQACall.qa_score : 90,
          breakdown: [
            { rule_id: 1, question: "Temsilci görüşme başında KVKK aydınlatma metnini okudu mu veya onay aldı mı?", satisfied: true, penalty: 15, reason: "" },
            { rule_id: 2, question: "Temsilci müşterinin sözünü kesti mi veya konuşmasını böldü mü?", satisfied: true, penalty: 10, reason: "" },
            { rule_id: 3, question: "Temsilci profesyonel, nazik ve yardımsever bir üslup kullandı mı?", satisfied: true, penalty: 15, reason: "" },
            { rule_id: 4, question: "Temsilci müşterinin sorununu doğru anlayıp çözüm odaklı yönlendirmeler yaptı mı?", satisfied: true, penalty: 20, reason: "" },
            { rule_id: 5, question: "Temsilci görüşme sonunda başka bir talebi olup olmadığını sordu mu?", satisfied: true, penalty: 10, reason: "" }
          ],
          coaching_report: "Temsilci genel olarak profesyonel bir üslup sergilemiştir."
        });
      }
    } else {
      setQaModalData(null);
    }
  }, [selectedQACall]);

  useEffect(() => {
    if (selectedNotesCall) {
      setNotesModalTopic(selectedNotesCall.agent_topic || "");
      setNotesModalText(selectedNotesCall.agent_notes || "");
    } else {
      setNotesModalTopic("");
      setNotesModalText("");
    }
  }, [selectedNotesCall]);

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

  const getCallDurations = (call) => {
    if (!call) return { talk: "0:00", queue: "0:00", ivr: "0:00", total: "0:00" };
    let totalSeconds = 0;
    if (call.end_time) {
      totalSeconds = Math.max(0, Math.floor((new Date(call.end_time) - new Date(call.start_time)) / 1000));
    } else {
      totalSeconds = Math.max(0, Math.floor((new Date() - new Date(call.start_time)) / 1000));
    }

    if (totalSeconds === 0) {
      return { talk: "0:00", queue: "0:00", ivr: "0:00", total: "0:00" };
    }

    const formatSecs = (secs) => {
      const mins = Math.floor(secs / 60);
      const remainingSecs = secs % 60;
      return `${mins}:${remainingSecs.toString().padStart(2, "0")}`;
    };

    // If the call failed, there is no talk time
    const status = getCallStatus(call);
    if (status === "Başarısız") {
      return { 
        talk: "0:00", 
        queue: "0:00", 
        ivr: formatSecs(totalSeconds), // Entire time was just IVR/Ringing
        total: formatSecs(totalSeconds) 
      };
    }

    // Deterministic split based on call.id hash for mock effect on successful calls
    const safeId = String(call.id || "");
    let ivrSeconds = safeId.length > 0 ? (safeId.charCodeAt(0) % 20) + 10 : 15; // 10 to 29 seconds
    let queueSeconds = safeId.length > 1 ? ((safeId.charCodeAt(1) % 2 === 0) ? 0 : (safeId.charCodeAt(1) % 35) + 5) : 0; // 0 or 5 to 39 seconds

    // Adjust if totalSeconds is too short
    if (ivrSeconds + queueSeconds >= totalSeconds) {
      ivrSeconds = Math.floor(totalSeconds * 0.3);
      queueSeconds = Math.floor(totalSeconds * 0.2);
    }

    const talkSeconds = totalSeconds - ivrSeconds - queueSeconds;

    return {
      talk: formatSecs(talkSeconds),
      queue: formatSecs(queueSeconds),
      ivr: formatSecs(ivrSeconds),
      total: formatSecs(totalSeconds)
    };
  };

  const getConversant = (call) => {
    if (!call) return "";
    const safeId = String(call.id || "");
    if (call.status === "transferred") {
      return safeId.length > 2 && safeId.charCodeAt(2) % 2 === 0 ? "Ahmet Yılmaz (Agent)" : "Merve Kaya (Agent)";
    }
    
    const direction = getCallDirection(call);
    if (direction === "Gelen" || direction === "Giden (AI)") {
      return "AI Agent Ece";
    }
    
    return "Merve Kaya (Agent)";
  };

  const getCallDirection = (call) => {
    if (!call) return "";
    const caller = String(call.caller_number || "");
    const callee = String(call.callee_number || "");
    
    // If caller number is a standard long phone number, it is an inbound call from outside.
    if (caller.length >= 10 || caller.startsWith("+")) {
      return "Gelen";
    }
    
    // If caller is an internal extension (e.g. 1000, 1001) and callee is external, it's outbound.
    if (callee.length >= 10 || callee.startsWith("+")) {
      // Assuming 1000 or similar is AI extension
      if (caller === "1000" || caller.toLowerCase() === "ai") return "Giden (AI)";
      return "Giden (Temsilci)";
    }
    
    // Default fallback
    return "Gelen";
  };

  const getCallStatus = (call) => {
    if (!call) return "Başarısız";
    const st = call.status ? String(call.status).toLowerCase() : "";
    
    // Check actual DB status
    if (st === "blocked" || st === "failed" || st === "no answer" || st === "no_answer" || st === "busy" || st === "canceled" || st === "missed") {
      return "Başarısız";
    }
    
    // Also if the call is "completed" but there's no recording and it's extremely short (e.g. less than 5 seconds),
    // it likely dropped before connection was established, so consider it failed.
    const end = call.end_time ? new Date(call.end_time) : new Date();
    const start = new Date(call.start_time);
    const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
    
    if (totalSeconds <= 5 && !call.recording_path && (st === "completed" || st === "in_progress")) {
      return "Başarısız";
    }

    return "Başarılı";
  };

  const getCallFlowTimeline = (call) => {
    if (!call) return [];

    const timeline = [];
    const baseTime = new Date(call.start_time || new Date());
    const direction = getCallDirection(call);
    const statusLabel = getCallStatus(call);
    const conversant = getConversant(call);

    const formatOffsetTime = (secs) => {
      const t = new Date(baseTime.getTime() + secs * 1000);
      return t.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    };

    if (direction === "Gelen") {
      // Step 1: Call Entry
      timeline.push({
        time: formatOffsetTime(0),
        title: "Dış Hat (DID) Çağrı Girişi",
        description: `+902129000101 numaralı dış hat üzerinden ${call.caller_number} araması sisteme giriş yaptı.`,
        status: "info"
      });

      // Step 2: Time Condition
      timeline.push({
        time: formatOffsetTime(2),
        title: "Çalışma Saatleri Kontrolü",
        description: "Zaman Kuralı (Hafta İçi Mesai Saatleri) kontrol edildi. Koşul sağlandı, Karşılama Menüsüne yönlendiriliyor.",
        status: "success"
      });

      // Step 3: IVR Welcome
      timeline.push({
        time: formatOffsetTime(4),
        title: "IVR Karşılama Anonsu",
        description: "IVR Ana Menü seslendirmesi başladı: 'welcome_greeting.wav' (Türkçe).",
        status: "info"
      });

      // Step 4: IVR Input
      timeline.push({
        time: formatOffsetTime(10),
        title: "IVR Tuşlama Algılandı",
        description: "Müşteri '1' (Destek / Müşteri Temsilcisi) tuşlamasını gerçekleştirdi.",
        status: "success"
      });

      // Step 5: Queue routing
      timeline.push({
        time: formatOffsetTime(12),
        title: "Kuyruğa Yönlendirildi",
        description: "Müşteri Hizmetleri Sırasına (Destek_Kuyrugu - 900) giriş yaptı. Sıradaki Pozisyon: 1.",
        status: "info"
      });

      if (statusLabel === "Başarılı") {
        if (conversant === "Ahmet Yılmaz (Agent)") {
          // ring Kaya first (unanswered) then Ahmet (answered)
          timeline.push({
            time: formatOffsetTime(15),
            title: "Temsilci Çaldırılıyor (Yanıt Yok)",
            description: "Merve Kaya (Dahili: 202) çaldırılıyor...",
            status: "warning"
          });
          timeline.push({
            time: formatOffsetTime(25),
            title: "Temsilci Yanıt Vermedi",
            description: "Merve Kaya (Dahili: 202) çağrıya yanıt vermedi. Süre aşımı (10 sn). Çağrı kuyrukta sıradaki boş temsilciye aktarılıyor.",
            status: "warning"
          });
          timeline.push({
            time: formatOffsetTime(27),
            title: "Temsilci Çaldırılıyor",
            description: "Ahmet Yılmaz (Dahili: 200) çaldırılıyor...",
            status: "info"
          });
          timeline.push({
            time: formatOffsetTime(35),
            title: "Çağrı Yanıtlandı",
            description: "Ahmet Yılmaz (Dahili: 200) çağrıyı yanıtladı. Görüşme başladı.",
            status: "success"
          });
        } else if (conversant === "Merve Kaya (Agent)") {
          // ring Ahmet first (unanswered) then Merve (answered)
          timeline.push({
            time: formatOffsetTime(15),
            title: "Temsilci Çaldırılıyor (Yanıt Yok)",
            description: "Ahmet Yılmaz (Dahili: 200) çaldırılıyor...",
            status: "warning"
          });
          timeline.push({
            time: formatOffsetTime(25),
            title: "Temsilci Yanıt Vermedi",
            description: "Ahmet Yılmaz (Dahili: 200) çağrıya yanıt vermedi. Süre aşımı (10 sn). Çağrı kuyrukta sıradaki boş temsilciye aktarılıyor.",
            status: "warning"
          });
          timeline.push({
            time: formatOffsetTime(27),
            title: "Temsilci Çaldırılıyor",
            description: "Merve Kaya (Dahili: 202) çaldırılıyor...",
            status: "info"
          });
          timeline.push({
            time: formatOffsetTime(32),
            title: "Çağrı Yanıtlandı",
            description: "Merve Kaya (Dahili: 202) çağrıyı yanıtladı. Görüşme başladı.",
            status: "success"
          });
        } else {
          // AI Asistan
          timeline.push({
            time: formatOffsetTime(14),
            title: "AI Kanalına Aktarım",
            description: "Yapay Zeka Müşteri Asistanı (AI_Asistan - Dahili: 999) kanalına aktarım yapıldı.",
            status: "info"
          });
          timeline.push({
            time: formatOffsetTime(15),
            title: "Çağrı Yanıtlandı (AI)",
            description: "AI Asistan çağrıyı yanıtladı. Ses sentezleme ve LLM kanalı kuruldu.",
            status: "success"
          });
        }

        // Final hangup
        const durSeconds = call.duration || 60;
        timeline.push({
          time: formatOffsetTime(durSeconds),
          title: "Çağrı Kapatıldı (Normal)",
          description: "Görüşme iki tarafça normal şekilde sonlandırıldı. Çağrı durumu: Başarılı.",
          status: "success"
        });
      } else {
        // Failed
        timeline.push({
          time: formatOffsetTime(15),
          title: "Temsilci Çaldırılıyor (Yanıt Yok)",
          description: "Ahmet Yılmaz (Dahili: 200) çaldırılıyor...",
          status: "warning"
        });
        timeline.push({
          time: formatOffsetTime(25),
          title: "Temsilci Yanıt Vermedi",
          description: "Ahmet Yılmaz (Dahili: 200) çağrıya yanıt vermedi. Süre aşımı.",
          status: "warning"
        });
        timeline.push({
          time: formatOffsetTime(27),
          title: "Temsilci Çaldırılıyor (Yanıt Yok)",
          description: "Merve Kaya (Dahili: 202) çaldırılıyor...",
          status: "warning"
        });
        timeline.push({
          time: formatOffsetTime(37),
          title: "Temsilci Yanıt Vermedi",
          description: "Merve Kaya (Dahili: 202) çağrıya yanıt vermedi. Süre aşımı.",
          status: "warning"
        });
        timeline.push({
          time: formatOffsetTime(45),
          title: "Müşteri Çağrıyı Sonlandırdı",
          description: "Kuyrukta bekleme esnasında müşteri telefonu kapattı (Abandoned Call).",
          status: "error"
        });
        timeline.push({
          time: formatOffsetTime(46),
          title: "Çağrı Sonlandırıldı (Başarısız)",
          description: "Çağrı hiçbir temsilci veya AI kanalına bağlanamadan sonlandırıldı.",
          status: "error"
        });
      }
    } else {
      // Outbound calls: Giden (AI), Giden (Temsilci), Giden (Dialer)
      let callerDesc = "";
      if (direction === "Giden (AI)") {
        callerDesc = "AI Asistan (Dahili: 999)";
      } else if (direction === "Giden (Temsilci)") {
        callerDesc = "Ahmet Yılmaz (Dahili: 200)";
      } else {
        callerDesc = "Otomatik Dış Arama Motoru (Dialer)";
      }

      timeline.push({
        time: formatOffsetTime(0),
        title: "Dış Arama Başlatıldı",
        description: `${callerDesc} tarafından ${call.caller_number} numarasına doğru arama başlatıldı.`,
        status: "info"
      });

      timeline.push({
        time: formatOffsetTime(1),
        title: "Dış Hat (Trunk) Seçimi",
        description: "Dış hat çıkış kuralı eşleşti. Seçilen Hat: TurkTelekom_SIP_Trunk.",
        status: "success"
      });

      timeline.push({
        time: formatOffsetTime(3),
        title: "Hedef Çaldırılıyor",
        description: "Karşı tarafın telefonu çaldırılıyor...",
        status: "info"
      });

      if (statusLabel === "Başarılı") {
        timeline.push({
          time: formatOffsetTime(10),
          title: "Hedef Çağrıyı Yanıtladı",
          description: `Karşı taraf (${call.caller_number}) çağrıya yanıt verdi. Görüşme başladı.`,
          status: "success"
        });

        const durSeconds = call.duration || 60;
        timeline.push({
          time: formatOffsetTime(durSeconds),
          title: "Çağrı Kapatıldı",
          description: "Arama sonlandırıldı. Arama durumu: Başarılı.",
          status: "success"
        });
      } else {
        timeline.push({
          time: formatOffsetTime(25),
          title: "Hedef Yanıt Vermedi",
          description: `Karşı taraf (${call.caller_number}) aramaya yanıt vermedi veya hat meşgule düştü.`,
          status: "error"
        });
        timeline.push({
          time: formatOffsetTime(26),
          title: "Çağrı Kapatıldı",
          description: "Arama sonlandırıldı. Arama durumu: Başarısız (Cevapsız).",
          status: "error"
        });
      }
    }

    return timeline;
  };

  const filteredCalls = calls.filter((c) => {
    // 1. Caller Number Filter
    if (filterCallerNumber && !c.caller_number?.toLowerCase().includes(filterCallerNumber.toLowerCase())) {
      return false;
    }

    // 2. Call ID Filter
    if (filterCallId && !c.id?.toLowerCase().includes(filterCallId.toLowerCase())) {
      return false;
    }

    // 3. Direction Filter
    if (filterDirection !== "All") {
      const dir = getCallDirection(c);
      if (dir !== filterDirection) return false;
    }

    // 4. Status Filter
    if (filterStatus !== "All") {
      const statusLabel = getCallStatus(c);
      if (statusLabel !== filterStatus) return false;
    }

    // 5. Conversant Filter
    if (filterConversant !== "All") {
      const conversant = getConversant(c);
      if (conversant !== filterConversant) return false;
    }

    // 6. Date Range Filter
    if (c.start_time) {
      const callDateStr = c.start_time.endsWith("Z") ? c.start_time : c.start_time + "Z";
      const callDate = new Date(callDateStr);
      if (filterStartDate) {
        const start = new Date(filterStartDate.length <= 10 ? filterStartDate + "T00:00:00" : filterStartDate);
        if (callDate < start) return false;
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate.length <= 10 ? filterEndDate + "T23:59:59.999" : filterEndDate);
        if (callDate > end) return false;
      }
    }

    return true;
  });

  const getChartData = () => {
    let total = filteredCalls.length;
    let successful = 0;
    let failed = 0;
    let slaCompliantCount = 0;
    let missedCount = 0;
    
    let directionCounts = { "Gelen": 0, "Giden (AI)": 0, "Giden (Temsilci)": 0, "Giden (Dialer)": 0 };
    let agentCounts = { "AI Asistan": 0, "Ahmet Yılmaz (Agent)": 0, "Merve Kaya (Agent)": 0 };
    
    // Hourly distribution for Gelen vs Cevaplanan
    let hourlyIncoming = Array(24).fill(0);
    let hourlyAnswered = Array(24).fill(0);
    let hourlySlaCompliant = Array(24).fill(0);
    let hourlyTotal = Array(24).fill(0);
    
    // Queue wait times distribution buckets
    let wait_0_10 = 0;
    let wait_10_30 = 0;
    let wait_30_60 = 0;
    let wait_60_plus = 0;

    // Sentiment distribution
    let sentimentMutlu = 0;
    let sentimentNotr = 0;
    let sentimentSinirli = 0;

    // Topic distribution
    let topicCounts = { "Kargo & Teslimat": 0, "İade & Değişim": 0, "Fatura & Ödeme": 0, "Bilgi Edinme": 0, "Destek & Sorun": 0 };

    // AI vs Human details
    let aiTalkSeconds = 0;
    let aiCount = 0;
    let aiSuccess = 0;
    let humanTalkSeconds = 0;
    let humanCount = 0;
    let humanSuccess = 0;

    let totalTalkSeconds = 0;
    
    filteredCalls.forEach((call) => {
      // Success/Failed
      const statusLabel = getCallStatus(call);
      if (statusLabel === "Başarılı") {
        successful++;
      } else {
        failed++;
        missedCount++;
      }
      
      // Direction
      const direction = getCallDirection(call);
      if (directionCounts[direction] !== undefined) directionCounts[direction]++;
      
      // Conversant
      const conversant = getConversant(call);
      if (agentCounts[conversant] !== undefined) agentCounts[conversant]++;
      
      // Durations parsing
      const parsedDur = getCallDurations(call);
      let talkSecs = 0;
      let queueSecs = 0;
      
      const talkParts = parsedDur.talk.split(":");
      if (talkParts.length === 2) {
        talkSecs = parseInt(talkParts[0]) * 60 + parseInt(talkParts[1]);
        totalTalkSeconds += talkSecs;
      }
      
      const queueParts = parsedDur.queue.split(":");
      if (queueParts.length === 2) {
        queueSecs = parseInt(queueParts[0]) * 60 + parseInt(queueParts[1]);
      }

      // SLA Compliance check (Queue wait < 20s)
      const isSlaCompliant = queueSecs <= 20 && statusLabel === "Başarılı";
      if (isSlaCompliant) {
        slaCompliantCount++;
      }

      // Queue wait buckets
      if (queueSecs <= 10) wait_0_10++;
      else if (queueSecs <= 30) wait_10_30++;
      else if (queueSecs <= 60) wait_30_60++;
      else wait_60_plus++;

      // Sentiment tally
      const sent = call.sentiment || "Nötr";
      if (sent === "Pozitif" || sent === "Memnun" || sent === "Olumlu") sentimentMutlu++;
      else if (sent === "Negatif" || sent === "Öfkeli" || sent === "Kızgın" || sent === "Olumsuz") sentimentSinirli++;
      else sentimentNotr++;

      // Topic tally
      const topic = call.agent_topic || "";
      if (topic.includes("Kargo") || topic.includes("Teslim")) topicCounts["Kargo & Teslimat"]++;
      else if (topic.includes("İade") || topic.includes("Değişim")) topicCounts["İade & Değişim"]++;
      else if (topic.includes("Fatura") || topic.includes("Ödeme") || topic.includes("Borç")) topicCounts["Fatura & Ödeme"]++;
      else if (topic.includes("Bilgi") || topic.includes("Soru")) topicCounts["Bilgi Edinme"]++;
      else topicCounts["Destek & Sorun"]++;

      // AI vs Human performance splits
      const isAI = conversant === "AI Asistan";
      if (isAI) {
        aiCount++;
        aiTalkSeconds += talkSecs;
        if (statusLabel === "Başarılı") aiSuccess++;
      } else {
        humanCount++;
        humanTalkSeconds += talkSecs;
        if (statusLabel === "Başarılı") humanSuccess++;
      }

      // Hourly stats
      if (call.start_time) {
        const dateObj = new Date(call.start_time);
        const hour = dateObj.getHours();
        if (hour >= 0 && hour < 24) {
          hourlyIncoming[hour]++;
          hourlyTotal[hour]++;
          if (statusLabel === "Başarılı") {
            hourlyAnswered[hour]++;
          }
          if (isSlaCompliant) {
            hourlySlaCompliant[hour]++;
          }
        }
      }
    });

    const avgTalkSeconds = total > 0 ? Math.round(totalTalkSeconds / total) : 0;
    const formatSecondsToMinSec = (secs) => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}d ${s}s`;
    };

    // Calculate AI vs Human AHT (Avg Handle Time) and FCR rates
    const aiAHT = aiCount > 0 ? Math.round(aiTalkSeconds / aiCount) : 0;
    const humanAHT = humanCount > 0 ? Math.round(humanTalkSeconds / humanCount) : 0;
    const aiFCR = aiCount > 0 ? Math.round((aiSuccess / aiCount) * 100) : 0;
    const humanFCR = humanCount > 0 ? Math.round((humanSuccess / humanCount) * 100) : 0;

    // Generate dynamic CEO Summary paragraph
    const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;
    const slaRate = total > 0 ? Math.round((slaCompliantCount / total) * 100) : 0;
    
    let ceoSummary = `Bugün sistem üzerinden toplam ${total} çağrı gerçekleştirildi. Çağrıların %${successRate}'si başarıyla sonlandırılırken, genel SLA uyum oranımız %${slaRate} seviyesinde gerçekleşti. Yapay zeka asistanımız (AI Agent) tek başına tüm trafiğin %${total > 0 ? Math.round((aiCount / total) * 100) : 0}'ini üstlenerek %${aiFCR} ilk aramada çözüm (FCR) başarısı gösterdi ve insan temsilcilerin çağrı yükünü önemli ölçüde hafifletti. En yoğun çağrı konusu ${Object.keys(topicCounts).reduce((a, b) => topicCounts[a] > topicCounts[b] ? a : b)} olarak öne çıkarken, görüşmelerdeki genel memnuniyet düzeyi olumlu seyretmektedir.`;

    return {
      total,
      successful,
      failed,
      missedCount,
      successRate,
      slaRate,
      directionCounts,
      agentCounts,
      hourlyIncoming,
      hourlyAnswered,
      hourlySlaCompliant,
      hourlyTotal,
      hourlyData: hourlyIncoming,
      avgTalkTime: formatSecondsToMinSec(avgTalkSeconds),
      totalTalkTime: formatSecondsToMinSec(totalTalkSeconds),
      waitBuckets: { wait_0_10, wait_10_30, wait_30_60, wait_60_plus },
      sentimentDistribution: { mutlu: sentimentMutlu, notr: sentimentNotr, sinirli: sentimentSinirli },
      topicCounts,
      aiStats: { aht: aiAHT, fcr: aiFCR },
      humanStats: { aht: humanAHT, fcr: humanFCR },
      ceoSummary
    };
  };

  const chartData = getChartData();
  
  // Calculate SVG paths
  const maxCount = Math.max(...chartData.hourlyData, 1);
  const hourlyDataPoints = chartData.hourlyData.map((count, hour) => {
    const x = 40 + (hour * (500 - 80)) / 23;
    const y = 130 - (count * (130 - 20)) / maxCount;
    return { x, y, count, hour };
  });

  const linePath = hourlyDataPoints.map((pt, idx) => `${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ");
  const areaPath = `${linePath} L 460 130 L 40 130 Z`;
  const hourlyLabels = hourlyDataPoints.filter((pt) => pt.hour % 3 === 0);

  const handleSaveRowNotes = async (callId) => {
    const editState = editedCalls[callId] || {};
    const callObj = calls.find((c) => c.id === callId);
    if (!callObj) return;

    const topicToSave = editState.topic !== undefined ? editState.topic : (callObj.agent_topic || "");
    const notesToSave = editState.notes !== undefined ? editState.notes : (callObj.agent_notes || "");

    setSavingRows((prev) => ({ ...prev, [callId]: true }));
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/calls/${callId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topicToSave, notes: notesToSave })
      });
      if (res.ok) {
        // Update local calls state
        setCalls((prev) =>
          prev.map((c) =>
            c.id === callId
              ? { ...c, agent_topic: topicToSave, agent_notes: notesToSave }
              : c
          )
        );
        // Show success indicator
        setSavedRows((prev) => ({ ...prev, [callId]: true }));
        setTimeout(() => {
          setSavedRows((prev) => ({ ...prev, [callId]: false }));
        }, 3000);
      }
    } catch (err) {
      console.error("Not kaydedilemedi:", err);
    } finally {
      setSavingRows((prev) => ({ ...prev, [callId]: false }));
    }
  };

  const handleInputChange = (callId, field, value) => {
    setEditedCalls((prev) => ({
      ...prev,
      [callId]: {
        ...prev[callId],
        [field]: value
      }
    }));
  };

  const isCdrMode = viewMode === "cdr";
  const isNotesMode = viewMode === "notes";
  const isAudioMode = viewMode === "audio";
  const isTranscriptsMode = viewMode === "transcripts";
  const isSentimentMode = viewMode === "sentiment";
  const isQAMode = viewMode === "qa";
  const isPanoMode = viewMode === "pano";
  const isFullWidthMode = isCdrMode || isNotesMode || isAudioMode || isTranscriptsMode || isSentimentMode || isQAMode || isPanoMode;

  return (
    <div className="w-full h-[calc(100vh-12rem)] flex gap-6 text-slate-800 dark:text-slate-100">
      {/* Left side / Table container */}
      <div className={`${isFullWidthMode ? "flex-1" : "w-80 shrink-0"} bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-sm transition-colors duration-300`}>
        {/* Search Header (Without Refresh Button) */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-955/30 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {viewMode === "cdr" ? "CDR Raporu" :
               viewMode === "notes" ? "Temsilci Notları" :
               viewMode === "audio" ? "Ses Kayıtları" :
               viewMode === "transcripts" ? "Görüşme Transkriptleri" :
               viewMode === "sentiment" ? "Duygu Analizleri" :
               viewMode === "qa" ? "Kalite Raporları" : 
               viewMode === "pano" ? "Analiz ve KPI Panosu" : "Çağrı Raporları"}
            </h3>
            <div className="flex items-center gap-2 relative">
              {/* Charts Toggle Button (Only for CDR table view) */}
              {isCdrMode && (
                <button 
                  onClick={() => {
                    setShowCharts(!showCharts);
                    setIsColumnSelectOpen(false);
                  }}
                  className={`flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-xl border font-bold cursor-pointer transition-all duration-200 ${
                    showCharts
                      ? "bg-primary hover:bg-primary/90 text-white border-purple-600 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <Clock size={10} />
                  <span>{showCharts ? "Tabloyu Göster" : "Grafik"}</span>
                </button>
              )}

              {/* Columns Toggle Checklist (Only for CDR/Audio/Transcript/Sentiment/QA/Notes table views and when table is active) */}
              {(isCdrMode || isAudioMode || isTranscriptsMode || isSentimentMode || isQAMode || isNotesMode) && !showCharts && (
                <div className="relative">
                  <button 
                    onClick={() => setIsColumnSelectOpen(!isColumnSelectOpen)}
                    className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-xl border font-bold bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 transition cursor-pointer"
                  >
                    <Settings size={10} />
                    <span>Sütunlar</span>
                  </button>
                  {isColumnSelectOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 shadow-xl z-30 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
                      <h4 className="font-bold text-[9px] text-slate-400 dark:text-slate-555 uppercase tracking-wider mb-1">Görünür Sütunlar</h4>
                      {Object.keys(visibleColumns).map((key) => (
                        <label key={key} className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-350 cursor-pointer select-none">
                          <input 
                            type="checkbox"
                            checked={visibleColumns[key]}
                            onChange={() => handleToggleColumn(key)}
                            className="rounded border-slate-300 text-primary focus:ring-purple-500"
                          />
                          <span>{columnLabels[key]}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Excel Export Button */}
              {!isPanoMode && (
                <button 
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-xl border font-bold bg-emerald-50 dark:bg-primary/20 text-primary dark:text-emerald-450 border-emerald-100 dark:border-emerald-800/40 hover:bg-primary hover:text-white transition cursor-pointer"
                >
                  <Download size={10} />
                  <span>Excel'e Aktar</span>
                </button>
              )}

              {/* Columns / Panels Toggle Checklist for Pano Mode */}
              {isPanoMode && (
                <div className="relative">
                  <button 
                    onClick={() => setIsColumnSelectOpen(!isColumnSelectOpen)}
                    className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-xl border font-bold bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 transition cursor-pointer"
                  >
                    <Settings size={10} />
                    <span>Pencereler</span>
                  </button>
                  {isColumnSelectOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 shadow-xl z-30 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
                      <h4 className="font-bold text-[9px] text-slate-400 dark:text-slate-555 uppercase tracking-wider mb-1">Görünür Pencereler</h4>
                      {Object.keys(visiblePanels).map((key) => {
                        const panelLabels = {
                          ceoSummary: "CEO Yönetici Özeti",
                          hourlyVolume: "Saatlik Çağrı Yoğunluğu",
                          slaTrend: "SLA Uyum Trendi",
                          performanceComparison: "AI vs. İnsan Performansı",
                          queueWaitDistribution: "Kuyruk Terk Süresi",
                          sentimentDistribution: "Müşteri Duygu Dağılımı",
                          rootCauseDistribution: "Çağrı Kök Neden Dağılımı",
                          qualityCriteria: "AI & Temsilci Kalite Kriterleri",
                          topicTrends: "Konu Trendleri (Kelime Bulutu)",
                          frictionFunnel: "Müşteri Çile Noktaları"
                        };
                        return (
                          <label key={key} className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-350 cursor-pointer select-none">
                            <input 
                              type="checkbox"
                              checked={visiblePanels[key]}
                              onChange={() => setVisiblePanels(prev => ({ ...prev, [key]: !prev[key] }))}
                              className="rounded border-slate-300 text-primary focus:ring-purple-500"
                            />
                            <span>{panelLabels[key]}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Filter Button */}
              <button 
                onClick={() => setIsFilterOpen(true)}
                className={`flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-xl border font-bold cursor-pointer transition-all duration-200 ${
                  filterStartDate || filterEndDate || filterStatus !== "All" || filterDirection !== "All" || filterConversant !== "All" || filterCallerNumber || filterCallId
                    ? `${bg} ${hover} text-white ${border} shadow-sm`
                    : `${lightBg} ${text} ${borderLight} ${hover} hover:text-white`
                }`}
              >
                <Filter size={10} />
                <span>Filtrele</span>
              </button>
            </div>
          </div>
        </div>

        {/* Call Flow Timeline Popup Modal */}
        {isTimelineOpen && selectedTimelineCall && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto flex flex-col gap-4 animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 bg-purple-50 dark:bg-primary/20 text-primary dark:text-purple-400 rounded-xl flex items-center justify-center shrink-0">
                    <Search size={16} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">Detaylı Arama Akışı</h3>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Çağrı Yönlendirme Zaman Çizelgesi</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsTimelineOpen(false);
                    setSelectedTimelineCall(null);
                  }}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Call Summary Panel */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/50 dark:bg-slate-955/20 border border-slate-100 dark:border-slate-850 rounded-2xl">
                <div>
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Arayan Numara</p>
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{selectedTimelineCall.caller_number}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Çağrı Yönü / Durum</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {getCallDirection(selectedTimelineCall)} | <span className={getCallStatus(selectedTimelineCall) === "Başarılı" ? "text-primary" : "text-primary"}>{getCallStatus(selectedTimelineCall)}</span>
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Benzersiz Çağrı ID</p>
                  <p className="text-[10px] font-mono font-bold text-slate-550 dark:text-slate-400 mt-0.5">{selectedTimelineCall.id}</p>
                </div>
              </div>

              {/* Timeline Container */}
              <div className="flex-1 flex flex-col gap-4 mt-2 pr-1">
                {getCallFlowTimeline(selectedTimelineCall).map((step, idx) => {
                  const circleColor = step.status === "success" ? "bg-primary text-white" :
                                      step.status === "warning" ? "bg-primary text-white" :
                                      step.status === "error" ? "bg-primary text-white" : "bg-primary text-white";
                  return (
                    <div key={idx} className="flex gap-3 relative">
                      {/* Timeline line connector */}
                      {idx !== getCallFlowTimeline(selectedTimelineCall).length - 1 && (
                        <div className="absolute left-[13px] top-[24px] bottom-[-20px] w-0.5 bg-slate-100 dark:bg-slate-800"></div>
                      )}
                      
                      {/* Left icon circle */}
                      <div className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold ${circleColor} shadow-sm z-10 font-mono`}>
                        {idx + 1}
                      </div>

                      {/* Right content box */}
                      <div className="flex-1 flex flex-col gap-0.5">
                        <div className="flex justify-between items-baseline gap-2">
                          <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">{step.title}</h4>
                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 font-mono shrink-0">{step.time}</span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Full Transcript Dialogue Popup Modal */}
        {isTranscriptPopupOpen && selectedTranscriptCall && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto flex flex-col gap-4 animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 bg-purple-50 dark:bg-primary/20 text-primary dark:text-purple-400 rounded-xl flex items-center justify-center shrink-0">
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 font-bold">Görüşme Metni</h3>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Call Transcript Dialogue</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsTranscriptPopupOpen(false);
                    setSelectedTranscriptCall(null);
                  }}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Call Summary Panel */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/50 dark:bg-slate-955/20 border border-slate-100 dark:border-slate-850 rounded-2xl">
                <div>
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Arayan Numara</p>
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{selectedTranscriptCall.caller_number}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Çağrı Yönü / Durum</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {getCallDirection(selectedTranscriptCall)} | <span className={getCallStatus(selectedTranscriptCall) === "Başarılı" ? "text-primary" : "text-primary"}>{getCallStatus(selectedTranscriptCall)}</span>
                  </p>
                </div>
              </div>

              {/* Dialogue Transcript Turns */}
              <div className="flex-1 overflow-y-auto max-h-[50vh] pr-1 space-y-4">
                {popupLoading ? (
                  <div className="text-center py-12 text-xs text-slate-400 dark:text-slate-500 animate-pulse font-semibold">
                    Yükleniyor...
                  </div>
                ) : popupTranscripts.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400 dark:text-slate-500 font-semibold">
                    Görüşmeye ait transkript bulunmamaktadır.
                  </div>
                ) : (
                  popupTranscripts.map((turn, index) => {
                    const isCustomer = turn.speaker === "customer";
                    const isHuman = turn.speaker === "agent";
                    
                    return (
                      <div key={index} className={`flex ${isCustomer ? "justify-start" : "justify-end"} w-full animate-in fade-in slide-in-from-bottom-2 duration-150`}>
                        <div className={`flex flex-col max-w-[85%] ${isCustomer ? "items-start" : "items-end"}`}>
                          <div
                            className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed border font-semibold shadow-sm ${
                              isCustomer
                                ? "bg-slate-50 dark:bg-slate-955 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tr-none"
                                : isHuman
                                ? "bg-emerald-50 dark:bg-emerald-955 border-emerald-100 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-100 rounded-tl-none"
                                : "bg-purple-50 dark:bg-purple-955 border-purple-100 dark:border-purple-900/50 text-purple-800 dark:text-purple-100 rounded-tl-none"
                            }`}
                          >
                            <p className="font-bold text-[9px] mb-1 opacity-70 tracking-wider">
                              {turn.speaker === "ai" ? "YAPAY ZEKA" : isHuman ? "MÜŞTERİ TEMSİLCİSİ" : "MÜŞTERİ"}
                            </p>
                            <p className="whitespace-pre-line font-medium">{turn.text}</p>
                          </div>
                          <span className="text-[8px] text-slate-400 dark:text-slate-500 mt-1 px-2 font-mono">
                            {formatDate(turn.timestamp)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* AI Summary Popup Modal */}
        {isSummaryPopupOpen && selectedTranscriptCall && (
          <div className="fixed inset-0 bg-slate-955/65 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto flex flex-col gap-4 animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 bg-purple-50 dark:bg-primary/20 text-primary dark:text-purple-400 rounded-xl flex items-center justify-center shrink-0">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 font-bold">Görüşme Özet Detayı</h3>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Call Artificial Intelligence Summary</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsSummaryPopupOpen(false);
                    setSelectedTranscriptCall(null);
                  }}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Call Summary Panel */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/50 dark:bg-slate-955/20 border border-slate-100 dark:border-slate-850 rounded-2xl">
                <div>
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Arayan Numara</p>
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{selectedTranscriptCall.caller_number}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Çağrı Yönü / Durum</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {getCallDirection(selectedTranscriptCall)} | <span className={getCallStatus(selectedTranscriptCall) === "Başarılı" ? "text-primary" : "text-primary"}>{getCallStatus(selectedTranscriptCall)}</span>
                  </p>
                </div>
              </div>

              {/* Summary Text Area */}
              <div className="p-5 bg-purple-50/40 dark:bg-purple-900/10 border border-purple-100/50 dark:border-purple-900/20 rounded-2xl text-xs text-slate-700 dark:text-purple-300 leading-relaxed font-semibold">
                <span className="font-bold text-primary dark:text-purple-400 block mb-2 text-[10px] uppercase tracking-wider">Müşteri Temsilcisi / Yapay Zeka Özeti:</span>
                <p className="whitespace-pre-line text-[11px] font-medium leading-relaxed">
                  {selectedTranscriptCall.summary || "Bu görüşmeye ait yapay zeka özeti bulunmamaktadır."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* QA Details and Editing Popup Modal */}
        {isQAPopupOpen && selectedQACall && qaModalData && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col gap-4 animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 bg-indigo-50 dark:bg-primary/20 text-primary dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">Kalite Değerlendirme Analizi</h3>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Automated QA & Evaluation Correction</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsQAPopupOpen(false);
                    setSelectedQACall(null);
                    setQaModalData(null);
                  }}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Call QA Overview Panel */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50/50 dark:bg-slate-955/20 border border-slate-100 dark:border-slate-850 rounded-2xl">
                <div>
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Arayan / Temsilci</p>
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedQACall.caller_number} / {getConversant(selectedQACall)}
                  </p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tarih / Saat</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {formatDate(selectedQACall.start_time)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Güncel Kalite Puanı</p>
                  <p className="text-sm font-black text-primary dark:text-indigo-400 mt-0.5">
                    {qaModalData.total_score} / 100
                  </p>
                </div>
              </div>

              {/* QA Questions and Toggles List */}
              <div className="flex-1 overflow-y-auto max-h-[45vh] pr-1 space-y-4">
                {qaModalData.breakdown && qaModalData.breakdown.map((rule, idx) => {
                  return (
                    <div key={rule.rule_id || idx} className="p-4 bg-slate-50/30 dark:bg-slate-850/35 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col gap-3">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <p className="text-[11px] font-black text-slate-800 dark:text-slate-200 leading-relaxed">
                            {rule.question}
                          </p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                            Ağırlık: <span className="text-primary font-extrabold">-{rule.penalty || 10} Puan</span>
                          </p>
                        </div>
                        
                        {/* Radio Selection Option */}
                        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-1.5 rounded-xl shadow-sm shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const updatedBreakdown = [...qaModalData.breakdown];
                              updatedBreakdown[idx] = {
                                ...rule,
                                satisfied: true
                              };
                              // Recalculate score
                              const totalPenalty = updatedBreakdown.reduce((sum, r) => sum + (r.satisfied ? 0 : (r.penalty || 10)), 0);
                              const newScore = Math.max(0, 100 - totalPenalty);
                              setQaModalData({
                                ...qaModalData,
                                breakdown: updatedBreakdown,
                                total_score: newScore
                              });
                            }}
                            className={`px-3 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                              rule.satisfied
                                ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-450 border border-emerald-100/50"
                                : "text-slate-400 dark:text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            Evet (Uyumlu)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedBreakdown = [...qaModalData.breakdown];
                              updatedBreakdown[idx] = {
                                ...rule,
                                satisfied: false
                              };
                              // Recalculate score
                              const totalPenalty = updatedBreakdown.reduce((sum, r) => sum + (r.satisfied ? 0 : (r.penalty || 10)), 0);
                              const newScore = Math.max(0, 100 - totalPenalty);
                              setQaModalData({
                                ...qaModalData,
                                breakdown: updatedBreakdown,
                                total_score: newScore
                              });
                            }}
                            className={`px-3 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                              !rule.satisfied
                                ? "bg-rose-50 dark:bg-rose-955/20 text-primary dark:text-rose-455 border border-rose-100/50"
                                : "text-slate-400 dark:text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            Hayır (Uyumsuz)
                          </button>
                        </div>
                      </div>

                      {/* Discompliance Reason Text Area */}
                      {!rule.satisfied && (
                        <div className="animate-in slide-in-from-top-2 duration-200">
                          <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Uyumsuzluk Nedeni / Açıklama
                          </label>
                          <textarea
                            value={rule.reason || ""}
                            onChange={(e) => {
                              const updatedBreakdown = [...qaModalData.breakdown];
                              updatedBreakdown[idx] = {
                                ...rule,
                                reason: e.target.value
                              };
                              setQaModalData({
                                ...qaModalData,
                                breakdown: updatedBreakdown
                              });
                            }}
                            placeholder="Uyumsuzluk nedenini buraya detaylandırın..."
                            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition"
                            rows={2}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Coaching Feedback Input */}
              <div>
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">
                  Yapıcı Koçluk Tavsiyesi / Notlar
                </label>
                <textarea
                  value={qaModalData.coaching_report || ""}
                  onChange={(e) => {
                    setQaModalData({
                      ...qaModalData,
                      coaching_report: e.target.value
                    });
                  }}
                  placeholder="Müşteri temsilcisi gelişimi için yapıcı tavsiyelerinizi girin..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-955/20 text-slate-800 dark:text-slate-150 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  rows={2}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    setIsQAPopupOpen(false);
                    setSelectedQACall(null);
                    setQaModalData(null);
                  }}
                  className="px-4 py-2 border dark: dark: font-bold rounded-xl hover: dark:hover: transition cursor-pointer bg-slate-500 hover:bg-slate-600 text-white"
                >Vazgeç</button>
                <button
                  onClick={async () => {
                    try {
                      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
                      const res = await fetch(`${protocol}//${backendHost}/api/calls/${selectedQACall.id}/qa`, {
                        method: "PUT",
                        headers: {
                          "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                          qa_score: qaModalData.total_score,
                          qa_report: JSON.stringify(qaModalData)
                        })
                      });
                      
                      if (res.ok) {
                        // Update local calls list immediately
                        setCalls(prev => prev.map(c => {
                          if (c.id === selectedQACall.id) {
                            return {
                              ...c,
                              qa_score: qaModalData.total_score,
                              qa_report: JSON.stringify(qaModalData)
                            };
                          }
                          return c;
                        }));
                        
                        setIsQAPopupOpen(false);
                        setSelectedQACall(null);
                        setQaModalData(null);
                      } else {
                        alert("Kalite değerlendirmesi kaydedilirken hata oluştu.");
                      }
                    } catch (err) {
                      console.error("Save QA error: ", err);
                      alert("Bağlantı hatası sebebiyle kalite değerlendirmesi kaydedilemedi.");
                    }
                  }}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm hover:shadow active:scale-98"
                >
                  Değerlendirmeyi Kaydet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Representative Notes & Topic Editing Popup Modal */}
        {isNotesPopupOpen && selectedNotesCall && (
          <div className="fixed inset-0 bg-slate-955/65 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col gap-4 animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 bg-purple-50 dark:bg-primary/20 text-primary dark:text-purple-400 rounded-xl flex items-center justify-center shrink-0">
                    <Clipboard size={16} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">Temsilci Notu ve Konusu</h3>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Representative Note & Subject Correction</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsNotesPopupOpen(false);
                    setSelectedNotesCall(null);
                  }}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Call Summary Panel */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/50 dark:bg-slate-955/20 border border-slate-100 dark:border-slate-850 rounded-2xl">
                <div>
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Arayan Numara</p>
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{selectedNotesCall.caller_number}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Çağrı ID</p>
                  <p className="text-xs font-mono text-slate-700 dark:text-slate-350 mt-0.5 select-all">{selectedNotesCall.id}</p>
                </div>
              </div>

              {/* Topic Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-wider">Görüşme Konusu (Kategori)</label>
                <select
                  value={notesModalTopic}
                  onChange={(e) => setNotesModalTopic(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-850 dark:text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500 font-bold transition"
                >
                  <option value="">Seçilmedi</option>
                  <option value="Destek">Destek</option>
                  <option value="Satış">Satış</option>
                  <option value="Bilgi Talebi">Bilgi Talebi</option>
                  <option value="Şikayet">Şikayet</option>
                  <option value="Ödeme">Ödeme</option>
                  <option value="Diğer">Diğer</option>
                </select>
                
                {notesModalTopic === "Diğer" && (
                  <input
                    type="text"
                    placeholder="Lütfen özel bir konu başlığı yazın..."
                    className="w-full text-xs p-2.5 mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 font-semibold animate-in slide-in-from-top-2 duration-150"
                    onChange={(e) => setNotesModalTopic(e.target.value)}
                  />
                )}
              </div>

              {/* Note Text Area */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-wider">Temsilci Notu</label>
                <textarea
                  value={notesModalText}
                  onChange={(e) => setNotesModalText(e.target.value)}
                  placeholder="Görüşme detaylarını buraya not alın..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-955/20 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition leading-relaxed font-medium"
                  rows={4}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    setIsNotesPopupOpen(false);
                    setSelectedNotesCall(null);
                  }}
                  className="px-4 py-2 border dark: dark: font-bold rounded-xl hover: dark:hover: transition cursor-pointer bg-slate-500 hover:bg-slate-600 text-white"
                >Vazgeç</button>
                <button
                  onClick={async () => {
                    try {
                      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
                      const res = await fetch(`${protocol}//${backendHost}/api/calls/${selectedNotesCall.id}/notes`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ topic: notesModalTopic, notes: notesModalText })
                      });
                      
                      if (res.ok) {
                        // Update local calls state
                        setCalls((prev) =>
                          prev.map((c) =>
                            c.id === selectedNotesCall.id
                              ? { ...c, agent_topic: notesModalTopic, agent_notes: notesModalText }
                              : c
                          )
                        );
                        setIsNotesPopupOpen(false);
                        setSelectedNotesCall(null);
                      } else {
                        alert("Not kaydedilirken hata oluştu.");
                      }
                    } catch (err) {
                      console.error("Save Notes error: ", err);
                      alert("Bağlantı hatası sebebiyle not kaydedilemedi.");
                    }
                  }}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm hover:shadow active:scale-98"
                >
                  Notu Kaydet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Popup (Popup/Modal Filter Options) */}
        {isFilterOpen && (
          <div className="fixed inset-0 bg-slate-955/65 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-850 rounded-3xl p-6 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col gap-4 animate-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-150 dark:border-slate-800">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Filter size={16} className="text-primary" />
                  <span>Detaylı Filtreleme</span>
                </h3>
                <button 
                  onClick={() => setIsFilterOpen(false)}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="grid grid-cols-2 gap-4">
                {/* Date range */}
                <div className="col-span-2 grid grid-cols-2 gap-3 bg-slate-50/50 dark:bg-slate-955/20 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-450 dark:text-slate-555 uppercase tracking-wider">Başlangıç Tarihi</label>
                    <input
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:border-purple-500 font-semibold"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-450 dark:text-slate-555 uppercase tracking-wider">Bitiş Tarihi</label>
                    <input
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:border-purple-500 font-semibold"
                    />
                  </div>
                </div>

                {/* Call Direction */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-wider">Yön</label>
                  <select
                    value={filterDirection}
                    onChange={(e) => setFilterDirection(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-slate-100 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500 font-bold"
                  >
                    <option value="All">Tümü (Yön)</option>
                    <option value="Gelen">Gelen</option>
                    <option value="Giden (AI)">Giden (AI)</option>
                    <option value="Giden (Temsilci)">Giden (Temsilci)</option>
                    <option value="Giden (Dialer)">Giden (Dialer)</option>
                  </select>
                </div>

                {/* Call Status */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-wider">Çağrı Durumu</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-slate-100 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500 font-bold"
                  >
                    <option value="All">Tümü (Durum)</option>
                    <option value="Başarılı">Başarılı</option>
                    <option value="Başarısız">Başarısız</option>
                  </select>
                </div>

                {/* Conversant */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-wider">Görüşen Kişi</label>
                  <select
                    value={filterConversant}
                    onChange={(e) => setFilterConversant(e.target.value)}
                    className="w-full bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-slate-100 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500 font-bold"
                  >
                    <option value="All">Tümü (Görüşen)</option>
                    <option value="AI Asistan">AI Asistan</option>
                    <option value="Ahmet Yılmaz (Agent)">Ahmet Yılmaz (Agent)</option>
                    <option value="Merve Kaya (Agent)">Merve Kaya (Agent)</option>
                  </select>
                </div>

                {/* Caller Number */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-wider">Numara Ara</label>
                  <input
                    type="text"
                    placeholder="örn. 0532..."
                    value={filterCallerNumber}
                    onChange={(e) => setFilterCallerNumber(e.target.value)}
                    className="w-full bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500 font-semibold"
                  />
                </div>

                {/* Call ID Filter */}
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-wider">Çağrı ID</label>
                  <input
                    type="text"
                    placeholder="ID Ara..."
                    value={filterCallId}
                    onChange={(e) => setFilterCallId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-purple-500 font-semibold"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-150 dark:border-slate-800">
                <button
                  onClick={handleClearFilters}
                  className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-550 dark:text-slate-350 border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Filtreleri Temizle
                </button>
                <button
                  onClick={() => {
                    fetchCalls(true);
                    setIsFilterOpen(false);
                  }}
                  className="flex-1 py-2 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                >
                  Uygula
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scroll area */}
        {isFullWidthMode ? (
          <div className="flex-1 overflow-auto scrollbar-thin flex flex-col">
            {isLoading ? (
              <div className="text-center py-12 text-xs text-slate-400 dark:text-slate-500 animate-pulse font-semibold">
                Arama kayıtları yükleniyor...
              </div>
            ) : (filteredCalls.length === 0 && !isPanoMode) ? (
              <div className="text-center py-12 text-xs text-slate-400 dark:text-slate-550 font-semibold">
                Kayıt bulunamadı.
              </div>
            ) : (isPanoMode || (showCharts && isCdrMode)) ? (
              /* High-Fidelity Interactive Analytics Dashboard View */
              <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6 scrollbar-thin bg-slate-50/30 dark:bg-slate-900/10 animate-in fade-in duration-200">
                
                {/* Upper Section: Stats Widget / Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                  {/* Card 1: Toplam Çağrı */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col gap-1 hover:scale-102 transition duration-200">
                    <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Toplam Çağrı</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{chartData.total}</span>
                      <span className="text-[10px] text-slate-400 font-bold">Adet</span>
                    </div>
                  </div>
                  {/* Card 2: AI FCR Çözüm Oranı */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col gap-1 hover:scale-102 transition duration-200">
                    <span className="text-[9px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-wider">AI Çözüm Oranı (FCR)</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-primary dark:text-emerald-400">%{chartData.aiStats.fcr}</span>
                    </div>
                  </div>
                  {/* Card 3: SLA Uyum Oranı */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col gap-1 hover:scale-102 transition duration-200">
                    <span className="text-[9px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-wider">SLA Uyum Oranı</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-primary dark:text-indigo-400">%{chartData.slaRate}</span>
                    </div>
                  </div>
                  {/* Card 4: Kaçan Çağrılar */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col gap-1 hover:scale-102 transition duration-200">
                    <span className="text-[9px] font-extrabold text-slate-455 dark:text-slate-500 uppercase tracking-wider">Kaçan Çağrılar</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-primary dark:text-rose-455">{chartData.missedCount}</span>
                      <span className="text-[10px] text-slate-400 font-bold">Adet</span>
                    </div>
                  </div>
                  {/* Card 5: Ort. Konuşma Süresi */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col gap-1 hover:scale-102 transition duration-200">
                    <span className="text-[9px] font-extrabold text-slate-455 dark:text-slate-500 uppercase tracking-wider">Ort. Görüşme Süresi</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-xl font-black text-primary dark:text-purple-400">{chartData.avgTalkTime}</span>
                    </div>
                  </div>
                  {/* Card 6: Toplam Konuşma */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col gap-1 hover:scale-102 transition duration-200">
                    <span className="text-[9px] font-extrabold text-slate-455 dark:text-slate-500 uppercase tracking-wider">Toplam Konuşma</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-xl font-black text-primary dark:text-blue-400">{chartData.totalTalkTime}</span>
                    </div>
                  </div>
                </div>

                {/* CEO Özet (Executive Summary) Quote Block */}
                {visiblePanels.ceoSummary && (
                  <div className="bg-gradient-to-r from-purple-500/10 via-purple-600/5 to-transparent dark:from-purple-950/20 p-5 rounded-3xl border border-purple-100/80 dark:border-purple-900/35 shadow-sm flex flex-col gap-2 relative overflow-hidden backdrop-blur-md">
                    <div className="absolute right-4 top-4 text-purple-200 dark:text-purple-800/25 pointer-events-none">
                      <Crown size={64} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Crown size={14} className="text-primary dark:text-purple-400" />
                      <h4 className="font-extrabold text-xs text-purple-750 dark:text-purple-400 uppercase tracking-wider">CEO Yönetici Özeti (AI Analizi)</h4>
                    </div>
                    <blockquote className="text-xs text-slate-650 dark:text-slate-350 leading-relaxed font-semibold italic pl-3 border-l-2 border-purple-500 mt-2 max-w-4xl whitespace-pre-line">
                      "{chartData.ceoSummary}"
                    </blockquote>
                  </div>
                )}

                {/* Middle Section: Main Operations and Live Traffic Charts */}
                {(visiblePanels.hourlyVolume || visiblePanels.slaTrend) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Chart A: Saatlik Çağrı Yoğunluğu (Incoming vs Answered Line Chart) */}
                    {visiblePanels.hourlyVolume && (
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                          <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-350 uppercase tracking-wider">Saatlik Çağrı Yoğunluğu</h4>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-primary">
                              <span className="h-2 w-2 rounded-full bg-primary" />
                              <span>Gelen</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-primary">
                              <span className="h-2 w-2 rounded-full bg-primary" />
                              <span>Cevaplanan</span>
                            </div>
                          </div>
                        </div>
                        <div className="h-44 w-full flex items-center justify-center">
                          {/* SVG Line Chart */}
                          <svg viewBox="0 0 460 150" className="w-full h-full overflow-visible">
                            {/* Grid lines */}
                            {[30, 60, 90, 120].map((yVal, i) => (
                              <line key={i} x1="30" y1={yVal} x2="450" y2={yVal} stroke="#e2e8f0" strokeDasharray="3 3" className="dark:stroke-slate-800/80" />
                            ))}
                            
                            {/* Dynamic Path Calculations */}
                            {(() => {
                              const pointsIncoming = chartData.hourlyIncoming.map((val, hour) => {
                                const x = 35 + (hour * 17.5);
                                const maxVal = Math.max(...chartData.hourlyIncoming, ...chartData.hourlyAnswered, 5);
                                const y = 130 - (val / maxVal) * 100;
                                return { x, y, val };
                              });

                              const pointsAnswered = chartData.hourlyAnswered.map((val, hour) => {
                                const x = 35 + (hour * 17.5);
                                const maxVal = Math.max(...chartData.hourlyIncoming, ...chartData.hourlyAnswered, 5);
                                const y = 130 - (val / maxVal) * 100;
                                return { x, y, val };
                              });

                              const incomingLine = pointsIncoming.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                              const answeredLine = pointsAnswered.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

                              return (
                                <>
                                  {/* Incoming Line */}
                                  <path d={incomingLine} fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" />
                                  {/* Answered Line */}
                                  <path d={answeredLine} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />

                                  {/* X Axis Labels */}
                                  {pointsIncoming.filter((_, idx) => idx % 3 === 0).map((pt, idx) => (
                                    <text key={idx} x={pt.x} y="145" textAnchor="middle" className="text-[8px] font-bold fill-slate-400 dark:fill-slate-500 font-mono">
                                      {String(idx * 3).padStart(2, '0')}:00
                                    </text>
                                  ))}

                                  {/* Dots for hover */}
                                  {pointsIncoming.map((pt, i) => pt.val > 0 && (
                                    <g key={`in-${i}`} className="group cursor-pointer">
                                      <circle cx={pt.x} cy={pt.y} r="3" className="fill-purple-600 stroke-white dark:stroke-slate-900 stroke-2" />
                                      <title>{i}:00 | Gelen: {pt.val} Çağrı</title>
                                    </g>
                                  ))}
                                </>
                              );
                            })()}
                          </svg>
                        </div>
                      </div>
                    )}

                    {/* Chart B: SLA Compliance Trend (Line Chart) */}
                    {visiblePanels.slaTrend && (
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                          <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-350 uppercase tracking-wider">SLA Uyum Trendi</h4>
                          <div className="text-[9px] font-bold text-primary">Hedef: %85</div>
                        </div>
                        <div className="h-44 w-full flex items-center justify-center">
                          {/* SVG Line Chart */}
                          <svg viewBox="0 0 460 150" className="w-full h-full overflow-visible">
                            {/* Target line %85 */}
                            <line x1="30" y1="45" x2="450" y2="45" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 2" />
                            <text x="35" y="38" textAnchor="start" className="text-[8px] font-extrabold fill-rose-500 uppercase tracking-wider">SLA Hedefi (%85)</text>

                            {/* Grid lines */}
                            {[30, 60, 90, 120].map((yVal, i) => (
                              <line key={i} x1="30" y1={yVal} x2="450" y2={yVal} stroke="#e2e8f0" strokeDasharray="3 3" className="dark:stroke-slate-800/80" />
                            ))}

                            {(() => {
                              const points = chartData.hourlySlaCompliant.map((val, hour) => {
                                const x = 35 + (hour * 17.5);
                                const totalHr = chartData.hourlyTotal[hour];
                                const rate = totalHr > 0 ? (val / totalHr) * 100 : 0; // Default to 0% if no calls are present
                                const y = 130 - (rate / 100) * 100;
                                return { x, y, rate, hour };
                              });

                              const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

                              return (
                                <>
                                  <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
                                  {points.filter((_, idx) => idx % 3 === 0).map((pt, idx) => (
                                    <text key={idx} x={pt.x} y="145" textAnchor="middle" className="text-[8px] font-bold fill-slate-400 dark:fill-slate-500 font-mono">
                                      {String(idx * 3).padStart(2, '0')}:00
                                    </text>
                                  ))}
                                  {points.map((pt, i) => (
                                    <g key={`sla-${i}`} className="group cursor-pointer">
                                      <circle cx={pt.x} cy={pt.y} r="3" className="fill-indigo-600 stroke-white dark:stroke-slate-900 stroke-2" />
                                      <title>{pt.hour}:00 | SLA Uyum: %{Math.round(pt.rate)}</title>
                                    </g>
                                  ))}
                                </>
                              );
                            })()}
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Performans & Bekleme Süresi Dağılımları */}
                {(visiblePanels.performanceComparison || visiblePanels.queueWaitDistribution) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* AI vs. İnsan Performansı (Side-by-side Bar Chart) */}
                    {visiblePanels.performanceComparison && (
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col gap-4">
                        <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-355 uppercase tracking-wider">AI vs. İnsan Performansı</h4>
                        <div className="flex flex-col gap-5 justify-center py-2">
                          {/* Metric 1: Ortalama Çağrı Süresi (AHT) */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-baseline">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ortalama Çağrı Süresi (AHT)</span>
                              <div className="flex gap-4 text-[9px] font-black uppercase">
                                <span className="text-primary">AI: {chartData.aiStats.aht}sn</span>
                                <span className="text-slate-500">İnsan: {chartData.humanStats.aht}sn</span>
                              </div>
                            </div>
                            <div className="h-6 w-full bg-slate-50 dark:bg-slate-955 rounded-xl overflow-hidden flex p-1 border border-slate-150 dark:border-slate-850">
                              <div 
                                style={{ width: `${(chartData.aiStats.aht / (chartData.aiStats.aht + chartData.humanStats.aht || 1)) * 100}%` }}
                                className="bg-primary rounded-lg flex items-center justify-center text-[9px] font-black text-white transition-all overflow-hidden"
                              >
                                {chartData.aiStats.aht > 0 && "AI"}
                              </div>
                              <div 
                                style={{ width: `${(chartData.humanStats.aht / (chartData.aiStats.aht + chartData.humanStats.aht || 1)) * 100}%` }}
                                className="bg-slate-300 dark:bg-slate-700 rounded-lg flex items-center justify-center text-[9px] font-black text-slate-800 dark:text-slate-200 transition-all ml-1 overflow-hidden"
                              >
                                {chartData.humanStats.aht > 0 && "İnsan"}
                              </div>
                            </div>
                          </div>

                          {/* Metric 2: İlk Çağrıda Çözüm (FCR) Oranı */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-baseline">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">İlk Aramada Çözüm (FCR) Oranı</span>
                              <div className="flex gap-4 text-[9px] font-black uppercase">
                                <span className="text-primary">AI: %{chartData.aiStats.fcr}</span>
                                <span className="text-slate-500">İnsan: %{chartData.humanStats.fcr}</span>
                              </div>
                            </div>
                            <div className="h-6 w-full bg-slate-50 dark:bg-slate-955 rounded-xl overflow-hidden flex p-1 border border-slate-150 dark:border-slate-850">
                              <div 
                                style={{ width: `${chartData.aiStats.fcr}%` }}
                                className="bg-primary rounded-lg flex items-center justify-center text-[9px] font-black text-white transition-all overflow-hidden"
                              >
                                {chartData.aiStats.fcr > 0 && `AI (%${chartData.aiStats.fcr})`}
                              </div>
                              <div 
                                style={{ width: `${chartData.humanStats.fcr}%` }}
                                className="bg-slate-400 dark:bg-slate-700 rounded-lg flex items-center justify-center text-[9px] font-black text-white transition-all ml-1 overflow-hidden"
                              >
                                {chartData.humanStats.fcr > 0 && `İnsan (%${chartData.humanStats.fcr})`}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Kuyruk Terk Süreleri (Yatay Bar) */}
                    {visiblePanels.queueWaitDistribution && (
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col gap-4">
                        <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-355 uppercase tracking-wider">Kuyruk Terk Süresi Dağılımı</h4>
                        <div className="flex flex-col gap-3.5">
                          {(() => {
                            const totalW = chartData.waitBuckets.wait_0_10 + chartData.waitBuckets.wait_10_30 + chartData.waitBuckets.wait_30_60 + chartData.waitBuckets.wait_60_plus || 1;
                            const pct_1 = Math.round((chartData.waitBuckets.wait_0_10 / totalW) * 100);
                            const pct_2 = Math.round((chartData.waitBuckets.wait_10_30 / totalW) * 100);
                            const pct_3 = Math.round((chartData.waitBuckets.wait_30_60 / totalW) * 100);
                            const pct_4 = Math.round((chartData.waitBuckets.wait_60_plus / totalW) * 100);

                            return (
                              <>
                                {/* Bucket 1 */}
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] font-bold">
                                    <span className="text-slate-650 dark:text-slate-400">0 - 10 Saniye</span>
                                    <span className="text-slate-800 dark:text-slate-200">{chartData.waitBuckets.wait_0_10} Adet (%{pct_1})</span>
                                  </div>
                                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-955 rounded-full overflow-hidden">
                                    <div style={{ width: `${pct_1}%` }} className="h-full bg-primary rounded-full transition-all" />
                                  </div>
                                </div>
                                {/* Bucket 2 */}
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] font-bold">
                                    <span className="text-slate-650 dark:text-slate-400">10 - 30 Saniye</span>
                                    <span className="text-slate-800 dark:text-slate-200">{chartData.waitBuckets.wait_10_30} Adet (%{pct_2})</span>
                                  </div>
                                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-955 rounded-full overflow-hidden">
                                    <div style={{ width: `${pct_2}%` }} className="h-full bg-primary rounded-full transition-all" />
                                  </div>
                                </div>
                                {/* Bucket 3 */}
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] font-bold">
                                    <span className="text-slate-650 dark:text-slate-400">30 - 60 Saniye</span>
                                    <span className="text-slate-800 dark:text-slate-200">{chartData.waitBuckets.wait_30_60} Adet (%{pct_3})</span>
                                  </div>
                                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-955 rounded-full overflow-hidden">
                                    <div style={{ width: `${pct_3}%` }} className="h-full bg-orange-500 rounded-full transition-all" />
                                  </div>
                                </div>
                                {/* Bucket 4 */}
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] font-bold">
                                    <span className="text-slate-650 dark:text-slate-400">+60 Saniye</span>
                                    <span className="text-slate-800 dark:text-slate-200">{chartData.waitBuckets.wait_60_plus} Adet (%{pct_4})</span>
                                  </div>
                                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-955 rounded-full overflow-hidden">
                                    <div style={{ width: `${pct_4}%` }} className="h-full bg-primary rounded-full transition-all" />
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Section: AI & Quality Analytics */}
                {(visiblePanels.sentimentDistribution || visiblePanels.rootCauseDistribution || visiblePanels.qualityCriteria) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Sentiment Donut Chart */}
                    {visiblePanels.sentimentDistribution && (
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col gap-4">
                        <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-350 uppercase tracking-wider">Müşteri Duygu Durum Dağılımı</h4>
                        <div className="flex flex-col items-center justify-center gap-4">
                          {(() => {
                            const totalS = chartData.sentimentDistribution.mutlu + chartData.sentimentDistribution.notr + chartData.sentimentDistribution.sinirli || 1;
                            const pctMutlu = Math.round((chartData.sentimentDistribution.mutlu / totalS) * 100);
                            const pctNotr = Math.round((chartData.sentimentDistribution.notr / totalS) * 100);
                            const pctSinirli = Math.round((chartData.sentimentDistribution.sinirli / totalS) * 100);

                            return (
                              <>
                                <div className="relative flex items-center justify-center">
                                  <svg viewBox="0 0 100 100" className="w-32 h-32">
                                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#10b981" strokeWidth="10" strokeDasharray={`${pctMutlu} ${100 - pctMutlu}`} strokeDashoffset="25" pathLength="100" />
                                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#6b7280" strokeWidth="10" strokeDasharray={`${pctNotr} ${100 - pctNotr}`} strokeDashoffset={25 - pctMutlu} pathLength="100" />
                                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#ef4444" strokeWidth="10" strokeDasharray={`${pctSinirli} ${100 - pctSinirli}`} strokeDashoffset={25 - pctMutlu - pctNotr} pathLength="100" />
                                  </svg>
                                  <div className="absolute flex flex-col items-center justify-center">
                                    <span className="text-xs font-black text-slate-400 dark:text-slate-550 uppercase">Duygu</span>
                                    <span className="text-lg font-black text-primary">%{pctMutlu} Pozitif</span>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 w-full text-center mt-2">
                                  <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-2 rounded-xl border border-emerald-100/60 dark:border-emerald-900/30">
                                    <p className="text-[14px] font-black text-primary dark:text-emerald-400">%{pctMutlu}</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Mutlu</p>
                                  </div>
                                  <div className="bg-slate-50/50 dark:bg-slate-955 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                                    <p className="text-[14px] font-black text-slate-655 dark:text-slate-400">%{pctNotr}</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Nötr</p>
                                  </div>
                                  <div className="bg-rose-50/50 dark:bg-rose-955/20 p-2 rounded-xl border border-rose-100/60 dark:border-rose-900/30">
                                    <p className="text-[14px] font-black text-primary dark:text-rose-455">%{pctSinirli}</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Sinirli</p>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Call Topic / Root Causes */}
                    {visiblePanels.rootCauseDistribution && (
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col gap-4">
                        <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-350 uppercase tracking-wider">Çağrı Kök Neden Dağılımı</h4>
                        <div className="flex flex-col gap-3 py-1">
                          {Object.keys(chartData.topicCounts).map((topic, i) => {
                            const count = chartData.topicCounts[topic];
                            const colors = ["bg-primary", "bg-primary", "bg-primary", "bg-primary", "bg-primary"];
                            const textColors = ["text-primary", "text-primary", "text-primary", "text-primary", "text-primary"];
                            const bgColors = ["bg-purple-50/40 dark:bg-purple-950/20", "bg-indigo-50/40 dark:bg-indigo-950/20", "bg-emerald-50/40 dark:bg-emerald-950/20", "bg-amber-50/40 dark:bg-amber-955/20", "bg-rose-50/40 dark:bg-rose-955/20"];
                            
                            return (
                              <div key={topic} className={`flex items-center justify-between p-2 rounded-xl ${bgColors[i]}`}>
                                <div className="flex items-center gap-2">
                                  <span className={`h-2.5 w-2.5 rounded-full ${colors[i]}`} />
                                  <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">{topic}</span>
                                </div>
                                <span className={`text-xs font-black ${textColors[i]}`}>{count} Çağrı</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Radar Quality Score Criteria Split (Multi-Bar Visual Representation) */}
                    {visiblePanels.qualityCriteria && (
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col gap-4">
                        <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-350 uppercase tracking-wider">AI & Temsilci Kalite Kriterleri</h4>
                        <div className="flex flex-col gap-3.5">
                          {/* KVKK */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                              <span>KVKK Aydınlatma Uyumu</span>
                              <span className="text-primary dark:text-purple-400">%94</span>
                            </div>
                            <div className="h-2 w-full bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-full overflow-hidden">
                              <div className="h-full w-[94%] bg-primary rounded-full" />
                            </div>
                          </div>
                          {/* Interruption */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                              <span>Söz Kesmeme Uyumu</span>
                              <span className="text-purple-655 dark:text-purple-400">%88</span>
                            </div>
                            <div className="h-2 w-full bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-full overflow-hidden">
                              <div className="h-full w-[88%] bg-primary rounded-full" />
                            </div>
                          </div>
                          {/* Üslup */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                              <span>Nezaket ve Profesyonel Üslup</span>
                              <span className="text-primary dark:text-purple-400">%96</span>
                            </div>
                            <div className="h-2 w-full bg-slate-50 dark:bg-slate-955 border border-slate-150 dark:border-slate-850 rounded-full overflow-hidden">
                              <div className="h-full w-[96%] bg-primary rounded-full" />
                            </div>
                          </div>
                          {/* Ürün Bilgisi */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                              <span>Ürün & Süreç Bilgisi</span>
                              <span className="text-purple-655 dark:text-purple-400">%82</span>
                            </div>
                            <div className="h-2 w-full bg-slate-50 dark:bg-slate-955 border border-slate-150 dark:border-slate-850 rounded-full overflow-hidden">
                              <div className="h-full w-[82%] bg-primary rounded-full" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Innovative Visuals: Word Cloud & Customer Friction Funnel */}
                {(visiblePanels.topicTrends || visiblePanels.frictionFunnel) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Konu Trendleri Word Cloud (Kelime Bulutu) */}
                    {visiblePanels.topicTrends && (
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col gap-4">
                        <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-355 uppercase tracking-wider">Konu Trendleri (Kelime Bulutu)</h4>
                        <div className="h-44 bg-slate-50/45 dark:bg-slate-955/20 border border-slate-100 dark:border-slate-850 rounded-2xl p-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-4 relative overflow-hidden">
                          <span className="text-3xl font-black text-primary dark:text-purple-400 animate-pulse">Kargo Gecikti</span>
                          <span className="text-2xl font-extrabold text-primary dark:text-indigo-400">İade Talebi</span>
                          <span className="text-xl font-bold text-slate-755 dark:text-slate-200">Fatura Hatası</span>
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">AI Agent</span>
                          <span className="text-sm font-semibold text-primary">Sözleşme Onayı</span>
                          <span className="text-lg font-bold text-primary">Üyelik İptali</span>
                          <span className="text-xs font-semibold text-primary">Kurye Şikayeti</span>
                          <span className="text-2xl font-black text-primary">Ödeme Hatası</span>
                          <span className="text-xs font-bold text-slate-500">Kampanyalar</span>
                          <span className="text-sm font-semibold text-indigo-400">Yeni Sipariş</span>
                        </div>
                      </div>
                    )}

                    {/* Customer Friction Funnel (Huni Grafiği) */}
                    {visiblePanels.frictionFunnel && (
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col gap-4">
                        <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-355 uppercase tracking-wider">Müşteri Çile Noktaları (Friction Funnel)</h4>
                        <div className="flex flex-col gap-3 py-1">
                          {/* Step 1 */}
                          <div className="flex items-center gap-3">
                            <span className="w-20 text-[10px] font-extrabold text-slate-500 uppercase text-right">IVR Giriş</span>
                            <div className="flex-1 h-7 bg-primary/90 text-white rounded-lg flex items-center justify-between px-3 text-[10px] font-black tracking-wide shadow-sm">
                              <span>1000 Kişi</span>
                              <span>%100</span>
                            </div>
                          </div>
                          {/* Step 2 */}
                          <div className="flex items-center gap-3">
                            <span className="w-20 text-[10px] font-extrabold text-slate-500 uppercase text-right">Menü Tuşlama</span>
                            <div className="flex-1 h-7 bg-primary/80 text-white rounded-lg flex items-center justify-between px-3 text-[10px] font-black tracking-wide shadow-sm" style={{ marginRight: "10%" }}>
                              <span>600 Kişi</span>
                              <span>%60</span>
                            </div>
                          </div>
                          {/* Step 3 */}
                          <div className="flex items-center gap-3">
                            <span className="w-20 text-[10px] font-extrabold text-slate-500 uppercase text-right">AI Bağlantısı</span>
                            <div className="flex-1 h-7 bg-purple-400/70 text-white rounded-lg flex items-center justify-between px-3 text-[10px] font-black tracking-wide shadow-sm" style={{ marginRight: "20%" }}>
                              <span>300 Kişi</span>
                              <span>%30</span>
                            </div>
                          </div>
                          {/* Step 4 */}
                          <div className="flex items-center gap-3">
                            <span className="w-20 text-[10px] font-extrabold text-slate-500 uppercase text-right">Terk (Drop)</span>
                            <div className="flex-1 h-7 bg-primary/80 text-white rounded-lg flex items-center justify-between px-3 text-[10px] font-black tracking-wide shadow-sm" style={{ marginRight: "35%" }}>
                              <span>100 Kişi</span>
                              <span>%10</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            ) : (isCdrMode || isAudioMode || isTranscriptsMode || isSentimentMode || isQAMode || isNotesMode) ? (
              /* CDR, Audio, Transcripts, Sentiment, QA & Notes Table Mode */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-955/20 sticky top-0 backdrop-blur-sm z-10">
                      {visibleColumns.startTime && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Tarih / Saat</th>}
                      {visibleColumns.callId && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Çağrı ID</th>}
                      {visibleColumns.callerNumber && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Arayan Numara</th>}
                      {visibleColumns.direction && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Yön</th>}
                      {visibleColumns.status && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Çağrı Durumu</th>}
                      {visibleColumns.conversant && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Görüşen Kişi</th>}
                      {visibleColumns.durationTalk && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Görüşme Süresi</th>}
                      {visibleColumns.durationQueue && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Kuyruk Bekleme</th>}
                      {visibleColumns.durationIvr && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">IVR Süresi</th>}
                      {visibleColumns.durationTotal && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Toplam Süre</th>}
                      {isAudioMode && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Ses Kaydı</th>}
                      {isTranscriptsMode && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 text-center">İçerik</th>}
                      {isSentimentMode && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 text-center">Duygu Durumu</th>}
                      {isQAMode && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 text-center">Kalite Puanı</th>}
                      {isNotesMode && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 text-center">Temsilci Notu</th>}
                      {!isTranscriptsMode && !isSentimentMode && !isQAMode && !isNotesMode && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 text-center">Detay</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredCalls.map((call) => {
                      const durations = getCallDurations(call);
                      const conversant = getConversant(call);
                      const direction = getCallDirection(call);
                      const statusLabel = getCallStatus(call);

                      return (
                        <tr key={call.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-850/30 transition duration-150">
                          {/* Tarih / Saat */}
                          {visibleColumns.startTime && (
                            <td className="p-4 text-xs text-slate-700 dark:text-slate-350 font-medium">
                              {formatDate(call.start_time)}
                            </td>
                          )}
                          {/* Çağrı ID */}
                          {visibleColumns.callId && (
                            <td className="p-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                              {call.id}
                            </td>
                          )}
                          {/* Arayan Numara */}
                          {visibleColumns.callerNumber && (
                            <td className="p-4 text-xs font-bold text-slate-800 dark:text-slate-200">
                              <div className="flex items-center gap-2">
                                <Phone size={12} className="text-slate-400" />
                                <span>{call.caller_number}</span>
                              </div>
                            </td>
                          )}
                          {/* Yön */}
                          {visibleColumns.direction && (
                            <td className="p-4 text-xs">
                              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                                direction === "Gelen"
                                  ? "bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 border-teal-100 dark:border-teal-900/30"
                                  : direction === "Giden (AI)"
                                  ? "bg-purple-50 dark:bg-purple-955/20 text-primary dark:text-purple-400 border-purple-100 dark:border-purple-900/30"
                                  : direction === "Giden (Temsilci)"
                                  ? "bg-blue-50 dark:bg-blue-955/20 text-primary dark:text-blue-400 border-blue-100 dark:border-blue-900/30"
                                  : "bg-amber-50 dark:bg-amber-955/20 text-primary dark:text-amber-400 border-amber-100 dark:border-amber-900/30"
                              }`}>
                                {direction}
                              </span>
                            </td>
                          )}
                          {/* Çağrı Durumu */}
                          {visibleColumns.status && (
                            <td className="p-4 text-xs">
                              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                                statusLabel === "Başarılı"
                                  ? "bg-emerald-50 dark:bg-emerald-955/20 text-primary dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30"
                                  : "bg-rose-50 dark:bg-rose-955/20 text-primary dark:text-rose-400 border-rose-100 dark:border-rose-900/30"
                              }`}>
                                {statusLabel}
                              </span>
                            </td>
                          )}
                          {/* Görüşen Kişi */}
                          {visibleColumns.conversant && (
                            <td className="p-4 text-xs">
                              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                                conversant === "AI Asistan" 
                                  ? "bg-purple-50 dark:bg-purple-950/30 text-primary dark:text-purple-405 border border-purple-100 dark:border-purple-900/30"
                                  : "bg-blue-50 dark:bg-blue-950/30 text-primary dark:text-blue-400 border border-blue-100 dark:border-blue-900/30"
                              }`}>
                                {conversant}
                              </span>
                            </td>
                          )}
                          {/* Görüşme Süresi */}
                          {visibleColumns.durationTalk && (
                            <td className="p-4 text-xs text-slate-600 dark:text-slate-400 font-medium">
                              {durations.talk}
                            </td>
                          )}
                          {/* Kuyruk Bekleme Süresi */}
                          {visibleColumns.durationQueue && (
                            <td className="p-4 text-xs text-slate-600 dark:text-slate-400 font-medium">
                              {durations.queue}
                            </td>
                          )}
                          {/* IVR Süresi */}
                          {visibleColumns.durationIvr && (
                            <td className="p-4 text-xs text-slate-600 dark:text-slate-400 font-medium">
                              {durations.ivr}
                            </td>
                          )}
                          {/* Toplam Süre */}
                          {visibleColumns.durationTotal && (
                            <td className="p-4 text-xs text-slate-800 dark:text-slate-200 font-bold">
                              {durations.total}
                            </td>
                          )}
                          {/* Ses Kaydı Oynatıcı Column */}
                          {isAudioMode && (
                            <td className="p-4 text-xs">
                              {call.recording_path ? (
                                <button
                                  onClick={() => setActiveAudioCall(call)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold text-[10px] cursor-pointer transition-all ${
                                    activeAudioCall?.id === call.id
                                      ? `${bg} ${border} text-white shadow-sm`
                                      : `${lightBg} ${text} ${borderLight} ${hover} hover:text-white`
                                  }`}
                                >
                                  <Play size={10} />
                                  <span>{activeAudioCall?.id === call.id ? "Oynatılıyor" : "Dinle"}</span>
                                </button>
                              ) : (
                                <span className="text-slate-400 italic">Kayıt Yok</span>
                              )}
                            </td>
                          )}
                          {/* Detay/Akış Magnifier Column */}
                          {!isTranscriptsMode && !isSentimentMode && !isQAMode && !isNotesMode && (
                            <td className="p-4 text-xs text-center animate-in fade-in duration-100">
                              <button
                                onClick={() => {
                                  setSelectedTimelineCall(call);
                                  setIsTimelineOpen(true);
                                }}
                                className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-primary dark:text-purple-400 border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer hover:scale-105 active:scale-95 duration-150 inline-flex items-center justify-center shadow-sm"
                                title="Arama Akış Detayını Görüntüle"
                              >
                                <Search size={12} />
                              </button>
                            </td>
                          )}
                          {/* Transcript/Summary Action Buttons (Only for Transcripts view mode) */}
                          {isTranscriptsMode && (
                            <td className="p-4 text-xs text-center animate-in fade-in duration-100">
                              <div className="flex items-center justify-center gap-1.5 font-bold">
                                <button
                                  onClick={() => {
                                    setSelectedTranscriptCall(call);
                                    setIsTranscriptPopupOpen(true);
                                  }}
                                  className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-primary dark:text-primary border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer hover:scale-105 active:scale-95 duration-150 inline-flex items-center justify-center shadow-sm"
                                  title="Görüşme Metnini Görüntüle"
                                >
                                  <MessageSquare size={12} />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedTranscriptCall(call);
                                    setIsSummaryPopupOpen(true);
                                  }}
                                  className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-primary dark:text-purple-455 border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer hover:scale-105 active:scale-95 duration-150 inline-flex items-center justify-center shadow-sm"
                                  title="Görüşme Özetini Görüntüle"
                                >
                                  <FileText size={12} />
                                </button>
                              </div>
                            </td>
                          )}
                          {/* Duygu Durumu Column (Only for Sentiment view mode) */}
                          {isSentimentMode && (
                            <td className="p-4 text-xs text-center animate-in fade-in duration-100">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold border tracking-wide inline-block shadow-sm ${
                                call.sentiment === "Pozitif" || call.sentiment === "Memnun" || call.sentiment === "Mutlu"
                                  ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30"
                                  : call.sentiment === "Negatif" || call.sentiment === "Öfkeli" || call.sentiment === "Olumsuz" || call.sentiment === "Kızgın"
                                  ? "bg-rose-50 dark:bg-rose-955/20 text-primary dark:text-rose-455 border-rose-100 dark:border-rose-900/30"
                                  : call.sentiment === "Şüpheli"
                                  ? "bg-amber-50 dark:bg-amber-955/20 text-primary dark:text-amber-455 border-amber-100 dark:border-amber-900/30"
                                  : "bg-slate-50 dark:bg-slate-955 text-slate-650 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                              }`}>
                                {call.sentiment || "Nötr"}
                              </span>
                            </td>
                          )}
                          {/* Kalite Değerlendirme Column (Only for QA view mode) */}
                          {isQAMode && (
                            <td className="p-4 text-xs text-center animate-in fade-in duration-100">
                              <div className="flex items-center justify-center gap-2">
                                <span className={`px-2.5 py-1 rounded-xl text-[11px] font-black border tracking-wide shadow-sm ${
                                  (call.qa_score !== null && call.qa_score !== undefined ? call.qa_score : 90) >= 80
                                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-455 border-emerald-100 dark:border-emerald-900/30"
                                    : (call.qa_score !== null && call.qa_score !== undefined ? call.qa_score : 90) >= 50
                                    ? "bg-amber-50 dark:bg-amber-955/20 text-primary dark:text-amber-455 border-amber-100 dark:border-amber-900/30"
                                    : "bg-rose-50 dark:bg-rose-955/20 text-primary dark:text-rose-455 border-rose-100 dark:border-rose-900/30"
                                }`}>
                                  {call.qa_score !== null && call.qa_score !== undefined ? call.qa_score : 90} / 100
                                </span>
                                <button
                                  onClick={() => {
                                    setSelectedQACall(call);
                                    setIsQAPopupOpen(true);
                                  }}
                                  className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-primary dark:text-purple-400 border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer hover:scale-105 active:scale-95 duration-150 inline-flex items-center justify-center shadow-sm"
                                  title="Kalite Değerlendirme Detaylarını Görüntüle / Düzenle"
                                >
                                  <Search size={12} />
                                </button>
                              </div>
                            </td>
                          )}
                          {/* Temsilci Notu Column (Only for Notes view mode) */}
                          {isNotesMode && (
                            <td className="p-4 text-xs text-center animate-in fade-in duration-100">
                              <button
                                onClick={() => {
                                  setSelectedNotesCall(call);
                                  setIsNotesPopupOpen(true);
                                }}
                                className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-primary dark:text-purple-400 border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer hover:scale-105 active:scale-95 duration-150 inline-flex items-center justify-center shadow-sm"
                                title="Temsilci Notu ve Konusunu Görüntüle / Düzenle"
                              >
                                <Clipboard size={12} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : (
          /* Original List Scroll Mode for other views */
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 scrollbar-thin">
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
                        ? "bg-purple-50/50 dark:bg-primary/10 border-l-2 border-purple-500" 
                        : "hover:bg-slate-50/50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="space-y-1 min-w-0 pr-2">
                      <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5 flex-wrap">
                        <Phone size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
                        <span>{call.caller_number}</span>
                        
                        {viewMode === "sentiment" && call.sentiment && (
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border tracking-wide shrink-0 ${
                            call.sentiment === "Pozitif" || call.sentiment === "Memnun"
                              ? "bg-emerald-50 dark:bg-emerald-900/20 text-primary dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30"
                              : call.sentiment === "Öfkeli" || call.sentiment === "Olumsuz"
                              ? "bg-rose-50 dark:bg-rose-900/20 text-primary dark:text-rose-400 border-rose-100 dark:border-rose-900/30 animate-pulse"
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
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-indigo-50 dark:bg-indigo-900/20 text-primary border border-indigo-100 dark:border-indigo-900/30">
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
                          ? "bg-emerald-50 dark:bg-primary/15 text-primary dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/10"
                          : call.status === "transferred"
                          ? "bg-amber-50 dark:bg-primary/15 text-primary dark:text-amber-400 border border-amber-100 dark:border-amber-500/10"
                          : "bg-blue-50 dark:bg-primary/15 text-primary dark:text-blue-400 border border-blue-100 dark:border-blue-500/10 animate-pulse"
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
        )}
      </div>

      {/* Right side: Selected Call Details & View Mode Specific Content */}
      {!isFullWidthMode && (
        <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-sm transition-colors duration-300">
          {selectedCall ? (
            <>
              {/* Header Details */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Phone className="text-primary dark:text-purple-400" size={16} />
                      <span>{selectedCall.caller_number} ile Görüşme Detayları</span>
                      
                      {viewMode === "sentiment" && selectedCall.sentiment && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border tracking-wide ${
                          selectedCall.sentiment === "Pozitif" || selectedCall.sentiment === "Memnun"
                            ? "bg-emerald-50 dark:bg-emerald-900/20 text-primary dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/30"
                            : selectedCall.sentiment === "Öfkeli" || selectedCall.sentiment === "Olumsuz"
                            ? "bg-rose-50 dark:bg-rose-900/20 text-primary dark:text-rose-300 border-rose-100 dark:border-rose-900/30"
                            : "bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800"
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
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/30 rounded-xl text-xs text-purple-800 dark:text-purple-300 leading-relaxed font-semibold">
                    <span className="font-bold text-primary dark:text-purple-400 block mb-1">Görüşme Özeti (Yapay Zeka):</span>
                    {selectedCall.summary}
                  </div>
                )}

                {/* QA Quality Evaluation Report (show in QA mode) */}
                {viewMode === "qa" && selectedCall.qa_score !== undefined && selectedCall.qa_score !== null && (
                  <div className="border border-indigo-100/40 dark:border-indigo-900/30 rounded-xl overflow-hidden shadow-sm">
                    <div className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50/40 dark:bg-indigo-900/10 text-xs font-bold text-primary dark:text-indigo-400">
                      <div className="flex items-center gap-2">
                        <Award size={16} className="text-primary" />
                        <span>Kalite Puanı: <strong className="text-primary dark:text-indigo-300 text-sm ml-1">{selectedCall.qa_score} / 100</strong></span>
                      </div>
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-900 border-t border-indigo-100/50 dark:border-indigo-900/20 text-xs space-y-3.5 leading-relaxed max-h-[220px] overflow-y-auto">
                      {selectedCall.qa_report && selectedCall.qa_report.includes("coaching_report") ? (
                        (() => {
                          try {
                            const qaObj = JSON.parse(selectedCall.qa_report);
                            return (
                              <>
                                <div className="p-3 bg-indigo-50/30 dark:bg-indigo-900/15 border border-indigo-100/40 dark:border-indigo-900/30 rounded-xl">
                                  <strong className="text-primary dark:text-indigo-400 block mb-1 font-bold">Yapıcı Koçluk Raporu:</strong>
                                  <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{qaObj.coaching_report}</p>
                                </div>

                                {qaObj.breakdown && qaObj.breakdown.length > 0 && (
                                  <div className="space-y-2">
                                    <strong className="text-slate-700 dark:text-slate-300 block font-bold mb-1">Kural Değerlendirme Detayları:</strong>
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                                      {qaObj.breakdown.map((item, idx) => (
                                        <div key={idx} className="p-3 flex items-start justify-between gap-4 bg-slate-50/20 dark:bg-slate-900/10">
                                          <div className="space-y-1">
                                            <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{item.question}</p>
                                            {!item.satisfied && item.reason && (
                                              <p className="text-[10px] text-primary font-medium font-mono">{item.reason}</p>
                                            )}
                                          </div>
                                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 uppercase tracking-wide ${
                                            item.satisfied 
                                              ? "bg-emerald-50 dark:bg-emerald-900/20 text-primary border border-emerald-100/50" 
                                              : "bg-rose-50 dark:bg-rose-900/20 text-primary border border-rose-100/50"
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
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col gap-3 shadow-inner">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-purple-50 dark:bg-primary/20 border border-purple-100 dark:border-purple-800/40 flex items-center justify-center text-primary dark:text-purple-400 shrink-0">
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
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col gap-2 shadow-inner">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Temsilci Çağrı Notu & Konusu</span>
                      {notesSaved && (
                        <span className="text-[9px] text-primary dark:text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle size={10} /> Not Kaydedildi!
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <select
                          value={reportTopic}
                          onChange={(e) => setReportTopic(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-semibold"
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
                          className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-semibold"
                        />
                        <button
                          onClick={handleSaveReportNotes}
                          disabled={savingReportNotes}
                          className="px-3.5 py-1.5 bg-primary hover:bg-primary text-white rounded-xl text-xs font-bold shadow-md shadow-purple-500/10 transition shrink-0 cursor-pointer"
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
                <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/30 dark:bg-slate-900/10 scrollbar-thin">
                  {transcripts.length === 0 ? (
                    <div className="text-center py-20 text-xs text-slate-400 dark:text-slate-500 font-semibold">
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
                                ? "bg-purple-50 dark:bg-primary/30 text-primary dark:text-purple-400 border-purple-100 dark:border-purple-800"
                                : isHuman
                                ? "bg-emerald-50 dark:bg-primary/30 text-primary dark:text-emerald-450 border-emerald-100 dark:border-emerald-800"
                                : "bg-blue-50 dark:bg-primary/30 text-primary dark:text-blue-450 border-blue-100 dark:border-blue-800"
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
                            <span className="text-[9px] text-slate-400 dark:text-slate-555 mt-1 px-2 self-end font-medium">
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
      )}
      {/* Floating Audio Player Sticky Tray */}
      {isAudioMode && activeAudioCall && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-2xl z-50 flex items-center justify-between gap-4 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-purple-50 dark:bg-primary/20 text-primary dark:text-purple-400 flex items-center justify-center shrink-0">
              <Phone size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{activeAudioCall.caller_number} ile Görüşme</p>
              <p className="text-[9px] text-slate-450 dark:text-slate-500 font-mono mt-0.5">ID: {activeAudioCall.id.slice(0, 12)}...</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-3">
            <audio 
              src={`${window.location.protocol}//${backendHost}${activeAudioCall.recording_path}`} 
              controls 
              autoPlay
              className="w-full h-8 accent-purple-600"
            />
          </div>
          <button 
            onClick={() => setActiveAudioCall(null)}
            className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl transition cursor-pointer shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
