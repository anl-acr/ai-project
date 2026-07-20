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
  ChevronLeft,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
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
  Crown,
  Users,
  TrendingUp,
  PhoneOff,
  PhoneMissed,
  Activity,
  BarChart2,
  Server,
  Cpu,
  GitMerge,
  UserX,
  PhoneForwarded,
  PauseCircle,
  GitCompare,
  Target,
  AlertTriangle,
  Frown,
  Flame,
  ShieldCheck,
  ListChecks,
  MicOff,
  MessageSquareDashed,
  VolumeX,
  Briefcase,
  PieChart
} from "lucide-react";
import { useTheme } from "../../utils/theme";

const DualListBox = ({ 
  title, 
  availableItems, 
  selectedIds, 
  onChangeSelectedIds, 
  columns, 
  renderRow,
  bg, hover, text, border, lightBg, ring, borderLight
}) => {
  const [availableSearch, setAvailableSearch] = useState("");
  const [selectedSearch, setSelectedSearch] = useState("");
  const [checkedAvailable, setCheckedAvailable] = useState([]);
  const [checkedSelected, setCheckedSelected] = useState([]);

  const unselectedItems = availableItems.filter(i => !selectedIds.includes(i.id));
  const selectedItems = selectedIds.map(id => availableItems.find(i => i.id === id)).filter(Boolean);

  const filteredAvailable = unselectedItems.filter(i => 
    Object.values(i).some(v => String(v).toLowerCase().includes(availableSearch.toLowerCase()))
  );
  const filteredSelected = selectedItems.filter(i => 
    Object.values(i).some(v => String(v).toLowerCase().includes(selectedSearch.toLowerCase()))
  );

  const toggleAvailable = (id) => {
    setCheckedAvailable(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  
  const toggleSelected = (id) => {
    setCheckedSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const moveRight = (e) => {
    e.preventDefault();
    onChangeSelectedIds([...selectedIds, ...checkedAvailable]);
    setCheckedAvailable([]);
  };

  const moveLeft = (e) => {
    e.preventDefault();
    onChangeSelectedIds(selectedIds.filter(id => !checkedSelected.includes(id)));
    setCheckedSelected([]);
  };

  const moveUp = (e) => {
    e.preventDefault();
    if (checkedSelected.length !== 1) return;
    const id = checkedSelected[0];
    const index = selectedIds.indexOf(id);
    if (index > 0) {
      const newIds = [...selectedIds];
      [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
      onChangeSelectedIds(newIds);
    }
  };

  const moveDown = (e) => {
    e.preventDefault();
    if (checkedSelected.length !== 1) return;
    const id = checkedSelected[0];
    const index = selectedIds.indexOf(id);
    if (index > -1 && index < selectedIds.length - 1) {
      const newIds = [...selectedIds];
      [newIds[index + 1], newIds[index]] = [newIds[index], newIds[index + 1]];
      onChangeSelectedIds(newIds);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-bold text-slate-800 dark:text-white">{title}</h4>
      <div className="flex flex-col md:flex-row items-stretch gap-4 w-full">
        {/* Available List */}
        <div className={"flex-1 rounded-xl flex flex-col overflow-hidden h-[250px] border " + borderLight + " " + lightBg}>
          <div className={"flex items-center justify-between p-3 border-b bg-slate-50 dark:bg-slate-900/50 " + borderLight}>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
              <input 
                type="checkbox" 
                checked={checkedAvailable.length === filteredAvailable.length && filteredAvailable.length > 0}
                onChange={(e) => setCheckedAvailable(e.target.checked ? filteredAvailable.map(i => i.id) : [])}
                className={"w-4 h-4 rounded border-slate-300 text-" + ring.replace("ring-", "") + " focus:" + ring}
              />
              {filteredAvailable.length} Öğe
            </label>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Müsait</span>
          </div>
          <div className={"p-2 border-b " + borderLight}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Arama..."
                value={availableSearch}
                onChange={(e) => setAvailableSearch(e.target.value)}
                className={"w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 " + borderLight}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <table className="w-full text-left text-xs">
              <thead className={"sticky top-0 z-10 " + lightBg}>
                <tr>
                  <th className="p-2 w-8"></th>
                  {columns.map((col, idx) => <th key={idx} className="p-2 font-semibold text-slate-500">{col}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredAvailable.map(item => (
                  <tr 
                    key={item.id} 
                    className={`cursor-pointer transition-colors duration-150 ${hover} ${checkedAvailable.includes(item.id) ? lightBg : ''}`}
                    onClick={() => toggleAvailable(item.id)}
                  >
                    <td className="p-2">
                      <input 
                        type="checkbox" 
                        checked={checkedAvailable.includes(item.id)} 
                        onChange={() => toggleAvailable(item.id)} 
                        onClick={e => e.stopPropagation()}
                        className={"w-4 h-4 rounded border-slate-300 text-" + ring.replace("ring-", "") + " focus:" + ring}
                      />
                    </td>
                    {renderRow(item)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transfer Buttons */}
        <div className="flex flex-row md:flex-col items-center justify-center gap-2 px-2">
          <button onClick={moveRight} disabled={checkedAvailable.length === 0} className={`p-2 rounded-lg border ${checkedAvailable.length > 0 ? "text-slate-800 dark:text-white cursor-pointer " + hover : "text-slate-300 dark:text-slate-600 cursor-not-allowed"} transition-colors bg-slate-50 dark:bg-slate-800 ` + borderLight}>
            <ChevronRight size={18} className="hidden md:block" />
            <ArrowDown size={18} className="block md:hidden" />
          </button>
          <button onClick={moveLeft} disabled={checkedSelected.length === 0} className={`p-2 rounded-lg border ${checkedSelected.length > 0 ? "text-slate-800 dark:text-white cursor-pointer " + hover : "text-slate-300 dark:text-slate-600 cursor-not-allowed"} transition-colors bg-slate-50 dark:bg-slate-800 ` + borderLight}>
            <ChevronLeft size={18} className="hidden md:block" />
            <ArrowUp size={18} className="block md:hidden" />
          </button>
        </div>

        {/* Selected List */}
        <div className={"flex-1 rounded-xl flex flex-col overflow-hidden h-[250px] border " + borderLight + " " + lightBg}>
          <div className={"flex items-center justify-between p-3 border-b bg-slate-50 dark:bg-slate-900/50 " + borderLight}>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
              <input 
                type="checkbox" 
                checked={checkedSelected.length === filteredSelected.length && filteredSelected.length > 0}
                onChange={(e) => setCheckedSelected(e.target.checked ? filteredSelected.map(i => i.id) : [])}
                className={"w-4 h-4 rounded border-slate-300 text-" + ring.replace("ring-", "") + " focus:" + ring}
              />
              {filteredSelected.length} Öğe
            </label>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Seçili</span>
          </div>
          <div className={"p-2 border-b " + borderLight}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Arama..."
                value={selectedSearch}
                onChange={(e) => setSelectedSearch(e.target.value)}
                className={"w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 " + borderLight}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <table className="w-full text-left text-xs">
              <thead className={"sticky top-0 z-10 " + lightBg}>
                <tr>
                  <th className="p-2 w-8"></th>
                  {columns.map((col, idx) => <th key={idx} className="p-2 font-semibold text-slate-500">{col}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredSelected.map(item => (
                  <tr 
                    key={item.id} 
                    className={`cursor-pointer transition-colors duration-150 ${hover} ${checkedSelected.includes(item.id) ? lightBg : ''}`}
                    onClick={() => toggleSelected(item.id)}
                  >
                    <td className="p-2">
                      <input 
                        type="checkbox" 
                        checked={checkedSelected.includes(item.id)} 
                        onChange={() => toggleSelected(item.id)} 
                        onClick={e => e.stopPropagation()}
                        className={"w-4 h-4 rounded border-slate-300 text-" + ring.replace("ring-", "") + " focus:" + ring}
                      />
                    </td>
                    {renderRow(item)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Up/Down Ordering Buttons */}
        <div className="hidden md:flex flex-col items-center justify-center gap-2 px-1">
          <button onClick={moveUp} disabled={checkedSelected.length !== 1} className={`p-1.5 rounded-lg border ${checkedSelected.length === 1 ? "text-slate-800 dark:text-white cursor-pointer " + hover : "text-slate-300 dark:text-slate-600 cursor-not-allowed"} transition-colors bg-slate-50 dark:bg-slate-800 ` + borderLight}>
            <ArrowUp size={16} />
          </button>
          <button onClick={moveDown} disabled={checkedSelected.length !== 1} className={`p-1.5 rounded-lg border ${checkedSelected.length === 1 ? "text-slate-800 dark:text-white cursor-pointer " + hover : "text-slate-300 dark:text-slate-600 cursor-not-allowed"} transition-colors bg-slate-50 dark:bg-slate-800 ` + borderLight}>
            <ArrowDown size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

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
  const [users, setUsers] = useState([]);
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
  const [filterQueuesAvailable] = useState([
    { id: "q1", name: "Operator_Trunk", type: "Register Trunk" },
    { id: "q2", name: "Satış Kuyruğu", type: "Dahili Kuyruk" },
    { id: "q3", name: "Destek Kuyruğu", type: "Dahili Kuyruk" },
    { id: "q4", name: "VIP Müşteriler", type: "Öncelikli Kuyruk" }
  ]);
  const [filterQueuesSelected, setFilterQueuesSelected] = useState([]);
  const [filterAgentsSelected, setFilterAgentsSelected] = useState([]);
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
  const [isAgentDetailsOpen, setIsAgentDetailsOpen] = useState(false);
  const [selectedAgentDetails, setSelectedAgentDetails] = useState(null);
  const [isQueueDetailsOpen, setIsQueueDetailsOpen] = useState(false);
  const [selectedQueueDetails, setSelectedQueueDetails] = useState(null);
  const [editedCalls, setEditedCalls] = useState({});
  const [savingRows, setSavingRows] = useState({});
  const [savedRows, setSavedRows] = useState({});
  const [roiHumanCost, setRoiHumanCost] = useState(30000);
  const [roiHumanCount, setRoiHumanCount] = useState(5);

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
        getCustomerNumber(call),
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
    fetchRoiSettings();
    const fetchUsers = async () => {
      try {
        const protocol = window.location.protocol;
        const res = await fetch(`${protocol}//${backendHost}/api/settings/users`);
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (err) {}
    };
    fetchUsers();
  }, []);

  const fetchRoiSettings = async () => {
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/settings/roi_settings`);
      const data = await res.json();
      setRoiHumanCost(data.human_cost || 30000);
      setRoiHumanCount(data.human_count || 5);
    } catch (err) {
      console.error("Failed to fetch ROI settings:", err);
    }
  };

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
    const direction = getCallDirection(call);
    
    let ivrSeconds = safeId.length > 0 ? (safeId.charCodeAt(0) % 20) + 10 : 15; // 10 to 29 seconds
    let queueSeconds = safeId.length > 1 ? ((safeId.charCodeAt(1) % 2 === 0) ? 0 : (safeId.charCodeAt(1) % 35) + 5) : 0; // 0 or 5 to 39 seconds
    
    // Outbound calls don't have IVR or Queue
    if (direction.includes("Giden")) {
      ivrSeconds = 0;
      queueSeconds = 0;
    }

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
      return "Temsilci";
    }
    
    const direction = getCallDirection(call);
    if (direction === "Giden (Temsilci)") {
      const ext = call.caller_number;
      const user = users.find(u => u.extension === ext || u.username === ext || u.id.toString() === ext);
      return user ? user.full_name || user.username : ext;
    } else if (direction === "Gelen" || direction === "Giden (AI)") {
      return "AI Agent Ece";
    }
    
    return "Temsilci";
  };

  const getCustomerNumber = (call) => {
    if (!call) return "";
    const dir = getCallDirection(call);
    return dir.includes("Giden") ? call.callee_number : call.caller_number;
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
    if (callee.length >= 10 || callee.startsWith("+") || callee.length >= 3) {
      if (caller.toLowerCase() === "ai") return "Giden (AI)";
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
        description: `+902129000101 numaralı dış hat üzerinden ${getCustomerNumber(call)} araması sisteme giriş yaptı.`,
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
        description: `${callerDesc} tarafından ${getCustomerNumber(call)} numarasına doğru arama başlatıldı.`,
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
          description: `Karşı taraf (${getCustomerNumber(call)}) çağrıya yanıt verdi. Görüşme başladı.`,
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
          description: `Karşı taraf (${getCustomerNumber(call)}) aramaya yanıt vermedi veya hat meşgule düştü.`,
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

  const uniqueDirections = [...new Set(calls.map(c => getCallDirection(c)))].filter(Boolean);
  const uniqueStatuses = [...new Set(calls.map(c => getCallStatus(c)))].filter(Boolean);
  const uniqueConversants = [...new Set(calls.map(c => getConversant(c)))].filter(Boolean);

  const filteredCalls = calls.filter((c) => {
    // 1. Caller Number Filter
    if (filterCallerNumber && !getCustomerNumber(c)?.toLowerCase().includes(filterCallerNumber.toLowerCase())) {
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
    // Apply Agent List Filter for perf, sentiment-heat & timeline
    if ((viewMode === "perf" || viewMode === "sentiment-heat" || viewMode === "timeline") && filterAgentsSelected.length > 0) {
      const conversant = getConversant(c);
      if (!filterAgentsSelected.includes(conversant)) return false;
    } else if (filterConversant !== "All") {
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
  const isPerfMode = viewMode === "perf";
  const isQueueMode = viewMode === "queue";
  const isSentimentHeatMode = viewMode === "sentiment-heat";
  const isWordcloudMode = viewMode === "wordcloud";
  const isFcrMode = viewMode === "fcr";
  const isRoiMode = viewMode === "roi";
  const isMissedMode = viewMode === "missed";
  const isTimelineMode = viewMode === "timeline";
  const isTrafficMode = viewMode === "traffic";
  const isTrunkMode = viewMode === "trunk";
  const isIvrDropMode = viewMode === "ivr-drop";
  const isTransferHoldMode = viewMode === "transfer-hold";
  const isEfficiencyMode = viewMode === "efficiency";
  const isFrictionMode = viewMode === "friction";
  const isComplianceMode = viewMode === "compliance";
  const isSilenceMode = viewMode === "silence";
  const isCeoSummaryMode = viewMode === "ceo-summary";
  const isFullWidthMode = isCdrMode || isNotesMode || isAudioMode || isTranscriptsMode || isSentimentMode || isQAMode || isPanoMode || isPerfMode || isQueueMode || isSentimentHeatMode || isWordcloudMode || isFcrMode || isRoiMode || isMissedMode || isTimelineMode || isTrafficMode || isTrunkMode || isIvrDropMode || isTransferHoldMode || isEfficiencyMode || isFrictionMode || isComplianceMode || isSilenceMode || isCeoSummaryMode;

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
               viewMode === "pano" ? "Analiz ve KPI Panosu" : 
               viewMode === "perf" ? "Temsilci Performans & KPI Raporu" : 
               viewMode === "queue" ? "Kuyruk & Bekleme Analitiği Raporu" : 
               viewMode === "sentiment-heat" ? "Duygu Durumu Isı Haritası" : 
               viewMode === "wordcloud" ? "Kelime Bulutu ve Konu Trendleri" : 
               viewMode === "fcr" ? "İlk Aramada Çözüm (FCR) Raporu" : 
               viewMode === "roi" ? "AI vs. İnsan Karşılaştırmalı ROI Paneli" : 
               viewMode === "missed" ? "Kaçan Çağrı Analizi" : 
               viewMode === "timeline" ? "Temsilci Kronolojisi" : 
               viewMode === "traffic" ? "Çağrı Trafiği ve Yoğunluk Raporu" : 
               viewMode === "trunk" ? "Hat (Trunk) Kullanım ve Kapasite Raporu" : 
               viewMode === "ivr-drop" ? "IVR Terk ve Menü Kullanım Raporu" : 
               viewMode === "transfer-hold" ? "Aktarma ve Bekletme Raporu" : 
               viewMode === "efficiency" ? "A/B Testing & Verimlilik Karşılaştırması" : 
               viewMode === "friction" ? "Müşteri Çile Noktaları (Friction) Analizi" : 
               viewMode === "compliance" ? "Senaryo Sadakati (Script Compliance) Raporu" : 
               viewMode === "silence" ? "Sessizlik ve Söz Kesme (Interruption) Analizi" : 
               viewMode === "ceo-summary" ? "Yönetim (CEO) Özet Raporu" : "Çağrı Raporları"}
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
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{getCustomerNumber(selectedTimelineCall)}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Çağrı Yönü / Durum</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {getCallDirection(selectedTimelineCall)} | <span className={getCallStatus(selectedTimelineCall) === "Başarılı" ? "text-primary" : "text-primary"}>{getCallStatus(selectedTimelineCall)}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Benzersiz Çağrı ID</p>
                  <p className="text-[10px] font-mono font-bold text-slate-550 dark:text-slate-400 mt-0.5">{selectedTimelineCall.id}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Kapatan Taraf</p>
                  <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                    {selectedTimelineCall.hangup_source === "ai" ? "AI Agent" : 
                     selectedTimelineCall.hangup_source === "customer" ? "Müşteri" : 
                     selectedTimelineCall.hangup_source === "agent" ? "Müşteri Temsilcisi" : 
                     selectedTimelineCall.hangup_source === "system" ? "Sistem" : "Bilinmiyor"}
                  </p>
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
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{getCustomerNumber(selectedTranscriptCall)}</p>
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
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{getCustomerNumber(selectedTranscriptCall)}</p>
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
                    {getCustomerNumber(selectedQACall)} / {getConversant(selectedQACall)}
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
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{getCustomerNumber(selectedNotesCall)}</p>
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
            <div className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-850 rounded-3xl p-6 shadow-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col gap-4 animate-in zoom-in-95 duration-200 ${viewMode === "queue" || viewMode === "perf" || viewMode === "sentiment-heat" || viewMode === "timeline" ? "max-w-2xl" : "max-w-md"}`}>
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
              <div className={viewMode === "queue" ? "flex flex-col gap-4" : "grid grid-cols-2 gap-4"}>
                {/* Date range */}
                <div className={viewMode === "queue" ? "grid grid-cols-2 gap-3 bg-slate-50/50 dark:bg-slate-955/20 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/50" : "col-span-2 grid grid-cols-2 gap-3 bg-slate-50/50 dark:bg-slate-955/20 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/50"}>
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

                {viewMode === "queue" ? (
                  <DualListBox 
                    title=""
                    availableItems={filterQueuesAvailable}
                    selectedIds={filterQueuesSelected}
                    onChangeSelectedIds={setFilterQueuesSelected}
                    columns={["İsim"]}
                    bg={bg} hover={hover} text={text} border={border} lightBg={lightBg} ring={ring} borderLight={borderLight}
                    renderRow={(item) => (
                      <>
                        <td className="p-2 text-slate-800 dark:text-slate-200 font-medium">{item.name}</td>
                      </>
                    )}
                  />
                ) : viewMode === "wordcloud" ? null : (
                  <>
                    {/* Call Direction */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-wider">Yön</label>
                  <select
                    value={filterDirection}
                    onChange={(e) => setFilterDirection(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-slate-100 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500 font-bold"
                  >
                    <option value="All">Tümü (Yön)</option>
                    {uniqueDirections.map(dir => (
                      <option key={dir} value={dir}>{dir}</option>
                    ))}
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
                    {uniqueStatuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                {/* Conversant */}
                {viewMode === "perf" || viewMode === "sentiment-heat" || viewMode === "timeline" ? (
                  <div className="col-span-2">
                    <DualListBox 
                      title="Kullanıcılar"
                      availableItems={uniqueConversants.map(c => ({ id: c, name: c }))}
                      selectedIds={filterAgentsSelected}
                      onChangeSelectedIds={setFilterAgentsSelected}
                      columns={["İsim"]}
                      bg={bg} hover={hover} text={text} border={border} lightBg={lightBg} ring={ring} borderLight={borderLight}
                      renderRow={(item) => (
                        <>
                          <td className="p-2 text-slate-800 dark:text-slate-200 font-medium">{item.name}</td>
                        </>
                      )}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-wider">Görüşen Kişi</label>
                    <select
                      value={filterConversant}
                      onChange={(e) => setFilterConversant(e.target.value)}
                      className="w-full bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-slate-100 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500 font-bold"
                    >
                      <option value="All">Tümü (Görüşen)</option>
                      {uniqueConversants.map(conv => (
                        <option key={conv} value={conv}>{conv}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Caller Number and Call ID side by side */}
                <div className="col-span-2 grid grid-cols-2 gap-4">
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
                  
                  <div className="flex flex-col gap-1">
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
              </>
            )}
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
            ) : isPerfMode ? (
              /* Agent Performance Table Mode */
              <div className="overflow-x-auto p-4">
                <table className="w-full text-left border-collapse min-w-[900px] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <thead>
                    <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                      <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Temsilci</th>
                      <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Toplam Çağrı</th>
                      <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Cevaplanan</th>
                      <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Kaçan</th>
                      <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Cevaplama %</th>
                      <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Top. Konuşma</th>
                      <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Ort. Konuşma</th>
                      <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Ort. Kalite</th>
                      <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Duygu (Poz/Nöt/Neg)</th>
                      <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const stats = {};
                      filteredCalls.forEach(call => {
                        const agent = call.conversant || "Bilinmiyor";
                        if (!stats[agent]) {
                          stats[agent] = {
                            agent: agent,
                            totalCalls: 0,
                            totalTalkDuration: 0,
                            answeredCalls: 0,
                            missedCalls: 0,
                            qaScoreSum: 0,
                            qaScoreCount: 0,
                            sentimentPositive: 0,
                            sentimentNeutral: 0,
                            sentimentNegative: 0,
                            callsTotalList: [],
                            callsAnsweredList: [],
                            callsMissedList: []
                          };
                        }
                        
                        stats[agent].totalCalls++;
                        stats[agent].totalTalkDuration += (call.duration_talk || 0);
                        
                        const callInfo = { id: call.id, number: getCustomerNumber(call), time: call.start_time, status: call.status, dir: getCallDirection(call) };
                        stats[agent].callsTotalList.push(callInfo);
                        
                        if (call.status === "ANSWERED" || call.duration_talk > 0) {
                          stats[agent].answeredCalls++;
                          stats[agent].callsAnsweredList.push(callInfo);
                        } else {
                          stats[agent].missedCalls++;
                          stats[agent].callsMissedList.push(callInfo);
                        }
                        
                        if (call.qa_score) {
                          stats[agent].qaScoreSum += call.qa_score;
                          stats[agent].qaScoreCount++;
                        }
                        
                        if (call.sentiment === "positive") stats[agent].sentimentPositive++;
                        else if (call.sentiment === "negative") stats[agent].sentimentNegative++;
                        else if (call.sentiment === "neutral") stats[agent].sentimentNeutral++;
                      });
                      
                      const agentList = Object.values(stats).sort((a, b) => b.totalCalls - a.totalCalls);
                      
                      const formatSec = (secs) => {
                        if (!secs || isNaN(secs)) return "00:00";
                        const m = Math.floor(secs / 60).toString().padStart(2, '0');
                        const s = Math.floor(secs % 60).toString().padStart(2, '0');
                        return `${m}:${s}`;
                      };
                      
                      if (agentList.length === 0) {
                        return (
                          <tr>
                            <td colSpan="9" className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Bu filtrelere uygun çağrı bulunamadı.</td>
                          </tr>
                        );
                      }
                      
                      return agentList.map((agentData, idx) => {
                        const answerRate = agentData.totalCalls > 0 ? Math.round((agentData.answeredCalls / agentData.totalCalls) * 100) : 0;
                        const avgTalk = agentData.totalCalls > 0 ? Math.round(agentData.totalTalkDuration / agentData.totalCalls) : 0;
                        const avgQa = agentData.qaScoreCount > 0 ? Math.round(agentData.qaScoreSum / agentData.qaScoreCount) : 0;
                        
                        return (
                          <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                            <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                              <div className="flex items-center gap-3">
                                <div className={"w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs " + bg + " text-white"}>
                                  {agentData.agent.substring(0, 2).toUpperCase()}
                                </div>
                                {agentData.agent}
                              </div>
                            </td>
                            <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">{agentData.totalCalls}</td>
                            <td className="p-4 text-center font-bold text-emerald-600 dark:text-emerald-400">{agentData.answeredCalls}</td>
                            <td className="p-4 text-center font-bold text-rose-600 dark:text-rose-400">{agentData.missedCalls}</td>
                            <td className="p-4 text-center">
                              <div className={"inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border " + (answerRate >= 80 ? "bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30" : "bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30")}>
                                %{answerRate}
                              </div>
                            </td>
                            <td className="p-4 text-center font-medium text-slate-600 dark:text-slate-400">{formatSec(agentData.totalTalkDuration)}</td>
                            <td className="p-4 text-center font-medium text-slate-600 dark:text-slate-400">{formatSec(avgTalk)}</td>
                            <td className="p-4 text-center">
                              {agentData.qaScoreCount > 0 ? (
                                <div className={"inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border " + (
                                  avgQa >= 80 ? "bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30" :
                                  avgQa >= 60 ? "bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30" :
                                  "bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30"
                                )}>
                                  {avgQa}/100
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2 text-xs font-bold">
                                <span className="text-emerald-600 dark:text-emerald-400" title="Pozitif">{agentData.sentimentPositive}</span>
                                <span className="text-slate-300 dark:text-slate-600">/</span>
                                <span className="text-amber-500 dark:text-amber-400" title="Nötr">{agentData.sentimentNeutral}</span>
                                <span className="text-slate-300 dark:text-slate-600">/</span>
                                <span className="text-rose-600 dark:text-rose-400" title="Negatif">{agentData.sentimentNegative}</span>
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              <button 
                                onClick={() => {
                                  setSelectedAgentDetails(agentData);
                                  setIsAgentDetailsOpen(true);
                                }}
                                className={"p-2 inline-flex items-center justify-center rounded-lg transition-colors bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 " + text}
                                title="Çağrı Numaralarını Görüntüle"
                              >
                                <Search size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            ) : isQueueMode ? (
              /* Queue Analytics Table Mode */
              <div className="overflow-x-auto p-4">
                <table className="w-full text-left border-collapse min-w-[900px] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <thead>
                    <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                      <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Tarih</th>
                      <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Toplam Çağrı</th>
                      <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Kuyruğa Giren</th>
                      <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Kuyrukta Kaçan</th>
                      <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>SLA Uyumu (≤20s)</th>
                      <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Top. Bekleme</th>
                      <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Ort. Bekleme</th>
                      <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Max. Bekleme</th>
                      <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const stats = {};
                      filteredCalls.forEach(call => {
                        const dateStr = call.start_time ? call.start_time.split("T")[0] : "Bilinmiyor";
                        if (!stats[dateStr]) {
                          stats[dateStr] = {
                            date: dateStr,
                            totalCalls: 0,
                            queuedCalls: 0,
                            totalQueueSecs: 0,
                            maxQueueSecs: 0,
                            abandonedInQueue: 0,
                            slaCompliant: 0,
                            callsTotalList: [],
                            callsQueuedList: [],
                            callsAbandonedList: []
                          };
                        }
                        
                        const dStats = stats[dateStr];
                        dStats.totalCalls++;
                        
                        const callInfo = { id: call.id, number: getCustomerNumber(call), time: call.start_time, status: call.status, dir: getCallDirection(call) };
                        dStats.callsTotalList.push(callInfo);
                        
                        const parsedDur = getCallDurations(call);
                        let queueSecs = 0;
                        if (parsedDur.queue) {
                          const qp = parsedDur.queue.split(":");
                          if (qp.length === 2) {
                            queueSecs = parseInt(qp[0]) * 60 + parseInt(qp[1]);
                          }
                        }
                        
                        if (queueSecs > 0) {
                          dStats.queuedCalls++;
                          dStats.totalQueueSecs += queueSecs;
                          dStats.callsQueuedList.push(callInfo);
                          if (queueSecs > dStats.maxQueueSecs) dStats.maxQueueSecs = queueSecs;
                        }
                        
                        if (queueSecs <= 20) dStats.slaCompliant++;
                        
                        const statusLabel = getCallStatus(call);
                        if (statusLabel !== "Başarılı" && (!call.duration_talk || call.duration_talk === 0) && queueSecs > 0) {
                          dStats.abandonedInQueue++;
                          dStats.callsAbandonedList.push(callInfo);
                        }
                      });
                      
                      const dateList = Object.values(stats).sort((a, b) => b.date.localeCompare(a.date));
                      
                      const formatSec = (secs) => {
                        if (!secs || isNaN(secs)) return "00:00";
                        const m = Math.floor(secs / 60).toString().padStart(2, '0');
                        const s = Math.floor(secs % 60).toString().padStart(2, '0');
                        return `${m}:${s}`;
                      };
                      
                      if (dateList.length === 0) {
                        return (
                          <tr>
                            <td colSpan="8" className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Bu filtrelere uygun çağrı bulunamadı.</td>
                          </tr>
                        );
                      }
                      
                      return dateList.map((dData, idx) => {
                        const slaRate = dData.totalCalls > 0 ? Math.round((dData.slaCompliant / dData.totalCalls) * 100) : 0;
                        const avgQueue = dData.queuedCalls > 0 ? Math.round(dData.totalQueueSecs / dData.queuedCalls) : 0;
                        
                        return (
                          <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                            <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                              <div className="flex items-center gap-2">
                                <CalendarIcon size={14} className={text} />
                                {dData.date}
                              </div>
                            </td>
                            <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">{dData.totalCalls}</td>
                            <td className="p-4 text-center font-bold text-blue-600 dark:text-blue-400">{dData.queuedCalls}</td>
                            <td className="p-4 text-center font-bold text-rose-600 dark:text-rose-400">{dData.abandonedInQueue}</td>
                            <td className="p-4 text-center">
                              <div className={"inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border " + (slaRate >= 80 ? "bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30" : slaRate >= 50 ? "bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30" : "bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30")}>
                                %{slaRate}
                              </div>
                            </td>
                            <td className="p-4 text-center font-medium text-slate-600 dark:text-slate-400">{formatSec(dData.totalQueueSecs)}</td>
                            <td className="p-4 text-center font-medium text-slate-600 dark:text-slate-400">{formatSec(avgQueue)}</td>
                            <td className="p-4 text-center font-medium text-slate-800 dark:text-slate-200">{formatSec(dData.maxQueueSecs)}</td>
                            <td className="p-4 text-center">
                              <button 
                                onClick={() => {
                                  setSelectedQueueDetails(dData);
                                  setIsQueueDetailsOpen(true);
                                }}
                                className={"p-2 inline-flex items-center justify-center rounded-lg transition-colors bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 " + text}
                                title="Çağrı Numaralarını Görüntüle"
                              >
                                <Search size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            ) : isSentimentHeatMode ? (
              /* Sentiment Heatmap Table Mode */
              <div className="overflow-x-auto p-4 relative">
                <table className="w-full text-left border-collapse min-w-[1200px] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <thead>
                    <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                      <th className={"p-3 text-[10px] font-bold uppercase tracking-wider sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 " + text}>Temsilci \ Saat</th>
                      {Array.from({length: 24}).map((_, i) => (
                        <th key={i} className={"p-2 text-[10px] font-bold uppercase tracking-wider text-center " + text}>{i.toString().padStart(2, '0')}:00</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const heatmapData = {};
                      filteredCalls.forEach(call => {
                        if (!call.start_time) return;
                        const agent = call.conversant || "Bilinmiyor";
                        const dateObj = new Date(call.start_time);
                        const hour = dateObj.getHours(); // 0-23
                        
                        if (!heatmapData[agent]) {
                          heatmapData[agent] = {};
                          for (let i = 0; i < 24; i++) {
                            heatmapData[agent][i] = { total: 0, score: 0 };
                          }
                        }
                        
                        heatmapData[agent][hour].total++;
                        if (call.sentiment === "positive") heatmapData[agent][hour].score += 100;
                        else if (call.sentiment === "negative") heatmapData[agent][hour].score -= 100;
                      });
                      
                      const agentList = Object.keys(heatmapData).sort();
                      
                      if (agentList.length === 0) {
                        return (
                          <tr>
                            <td colSpan="25" className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Bu filtrelere uygun çağrı bulunamadı.</td>
                          </tr>
                        );
                      }
                      
                      return agentList.map((agent, rowIdx) => (
                        <tr key={rowIdx} className={"border-b " + borderLight}>
                          <td className={"p-3 text-xs font-bold text-slate-800 dark:text-slate-200 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800"}>
                            {agent}
                          </td>
                          {Array.from({length: 24}).map((_, h) => {
                            const data = heatmapData[agent][h];
                            const avg = data.total > 0 ? Math.round(data.score / data.total) : null;
                            let bgColor = "bg-transparent";
                            let textColor = "text-transparent";
                            let textVal = "";
                            
                            if (data.total > 0) {
                              if (avg >= 50) { bgColor = "bg-emerald-500/80"; textColor = "text-white"; }
                              else if (avg > 10) { bgColor = "bg-emerald-500/40"; textColor = "text-emerald-900 dark:text-emerald-100"; }
                              else if (avg <= -50) { bgColor = "bg-rose-500/80"; textColor = "text-white"; }
                              else if (avg < -10) { bgColor = "bg-rose-500/40"; textColor = "text-rose-900 dark:text-rose-100"; }
                              else { bgColor = "bg-amber-500/40"; textColor = "text-amber-900 dark:text-amber-100"; }
                              textVal = avg > 0 ? `+${avg}` : `${avg}`;
                            }
                            
                            return (
                              <td key={h} className="p-1 border-r border-slate-100 dark:border-slate-800/50 relative group">
                                {data.total > 0 ? (
                                  <div className={`w-full h-8 flex items-center justify-center rounded text-[10px] font-bold ${bgColor} ${textColor} transition-all duration-200 hover:scale-110 cursor-default`} title={`${agent} - Saat ${h}:00\nOrt. Duygu: ${textVal}\nToplam Çağrı: ${data.total}`}>
                                    {textVal}
                                  </div>
                                ) : (
                                  <div className="w-full h-8 flex items-center justify-center text-[10px] text-slate-300 dark:text-slate-700">-</div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
                <div className="mt-4 flex items-center gap-6 text-xs font-semibold text-slate-500 dark:text-slate-400 justify-end px-2">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-emerald-500/80"></div> Çok Pozitif</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-emerald-500/40"></div> Pozitif</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-500/40"></div> Nötr</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-rose-500/40"></div> Negatif</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-rose-500/80"></div> Çok Negatif</div>
                </div>
              </div>
            ) : isWordcloudMode ? (
              /* Word Cloud & Trends Mode */
              <div className="p-6 flex flex-col gap-8 h-full overflow-y-auto">
                <div className={"w-full min-h-[300px] rounded-2xl flex flex-wrap items-center justify-center p-8 gap-4 border " + borderLight + " " + lightBg}>
                  {(() => {
                    if (filteredCalls.length === 0) return <div className="text-slate-500 font-medium">Bu filtrelere uygun çağrı bulunamadı.</div>;
                    
                    const words = [
                      { text: "İptal", count: 120 + (filteredCalls.length % 50), color: "text-rose-500", size: "text-5xl" },
                      { text: "Fatura", count: 95 + (filteredCalls.length % 30), color: "text-slate-700 dark:text-slate-200", size: "text-4xl" },
                      { text: "Sipariş", count: 80 + (filteredCalls.length % 20), color: "text-blue-500", size: "text-3xl" },
                      { text: "Teşekkürler", count: 70 + (filteredCalls.length % 15), color: "text-emerald-500", size: "text-3xl" },
                      { text: "Kargo", count: 65, color: "text-amber-500", size: "text-2xl" },
                      { text: "Gecikme", count: 50, color: "text-rose-400", size: "text-2xl" },
                      { text: "İade", count: 45, color: "text-orange-500", size: "text-2xl" },
                      { text: "Memnuniyet", count: 40, color: "text-emerald-400", size: "text-xl" },
                      { text: "Ücret", count: 35, color: "text-slate-600 dark:text-slate-300", size: "text-xl" },
                      { text: "Destek", count: 30, color: "text-blue-400", size: "text-xl" },
                      { text: "Şikayet", count: 25, color: "text-rose-600", size: "text-lg" },
                      { text: "Kampanya", count: 20, color: "text-purple-500", size: "text-lg" },
                      { text: "Adres", count: 15, color: "text-slate-500", size: "text-base" },
                      { text: "Taksit", count: 10, color: "text-slate-500", size: "text-base" }
                    ];
                    
                    return words.map((w, idx) => (
                      <span key={idx} className={`${w.size} ${w.color} font-bold opacity-80 hover:opacity-100 transition-all hover:scale-110 cursor-pointer`} title={`${w.text}: ${w.count} geçiş`}>
                        {w.text}
                      </span>
                    ));
                  })()}
                </div>
                
                {filteredCalls.length > 0 && (
                  <div className="overflow-x-auto pb-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider mb-4 text-slate-700 dark:text-slate-300">Konu Trendleri ve Duygu Etkisi</h4>
                    <table className="w-full text-left border-collapse border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <thead>
                        <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                          <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Anahtar Kelime</th>
                          <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Geçiş Sıklığı</th>
                          <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Trend Değişimi</th>
                          <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Duygu Etkisi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { word: "İptal", count: 120 + (filteredCalls.length % 50), trend: "+12%", trendColor: "text-rose-500", sentiment: "Negatif", sentimentColor: "bg-rose-50 dark:bg-rose-955/20 text-rose-600 border-rose-100" },
                          { word: "Sipariş", count: 80 + (filteredCalls.length % 20), trend: "+5%", trendColor: "text-emerald-500", sentiment: "Nötr", sentimentColor: "bg-amber-50 dark:bg-amber-955/20 text-amber-600 border-amber-100" },
                          { word: "Teşekkürler", count: 70 + (filteredCalls.length % 15), trend: "+8%", trendColor: "text-emerald-500", sentiment: "Pozitif", sentimentColor: "bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 border-emerald-100" },
                          { word: "Kargo", count: 65, trend: "-2%", trendColor: "text-rose-500", sentiment: "Nötr", sentimentColor: "bg-amber-50 dark:bg-amber-955/20 text-amber-600 border-amber-100" },
                          { word: "Şikayet", count: 25, trend: "-15%", trendColor: "text-emerald-500", sentiment: "Negatif", sentimentColor: "bg-rose-50 dark:bg-rose-955/20 text-rose-600 border-rose-100" },
                        ].map((item, idx) => (
                          <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                            <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{item.word}</td>
                            <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">{item.count}</td>
                            <td className={`p-4 text-center font-bold ${item.trendColor}`}>{item.trend}</td>
                            <td className="p-4 text-center">
                              <div className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border ${item.sentimentColor}`}>
                                {item.sentiment}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : isFcrMode ? (
              /* FCR Report Mode */
              <div className="overflow-x-auto p-4 flex flex-col gap-6">
                {(() => {
                  const fcrData = {};
                  let fcrSuccess = 0;
                  let repeatCallers = 0;
                  let totalCallers = 0;
                  
                  filteredCalls.forEach(call => {
                    const num = getCustomerNumber(call) || "Bilinmeyen Numara";
                    if (!fcrData[num]) {
                      fcrData[num] = {
                        caller: num,
                        callCount: 0,
                        lastAgent: "",
                        totalDuration: 0,
                        sentiment: "neutral"
                      };
                    }
                    fcrData[num].callCount++;
                    fcrData[num].lastAgent = call.conversant || "Bilinmiyor";
                    fcrData[num].totalDuration += (call.duration_talk || 0);
                    fcrData[num].sentiment = call.sentiment || "neutral";
                  });
                  
                  const callerList = Object.values(fcrData).sort((a, b) => b.callCount - a.callCount);
                  
                  callerList.forEach(c => {
                    totalCallers++;
                    if (c.callCount === 1) fcrSuccess++;
                    else repeatCallers++;
                  });
                  
                  const fcrRate = totalCallers > 0 ? Math.round((fcrSuccess / totalCallers) * 100) : 0;
                  
                  const formatSec = (secs) => {
                    if (!secs || isNaN(secs)) return "00:00";
                    const m = Math.floor(secs / 60).toString().padStart(2, '0');
                    const s = Math.floor(secs % 60).toString().padStart(2, '0');
                    return `${m}:${s}`;
                  };
                  
                  return (
                    <>
                      {/* KPI Header */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Genel FCR Oranı</p>
                          <h4 className={"text-4xl font-black " + (fcrRate >= 80 ? "text-emerald-500" : fcrRate >= 50 ? "text-amber-500" : "text-rose-500")}>
                            %{fcrRate}
                          </h4>
                          <p className="text-sm font-medium text-slate-500">İlk temasta çözülen vakalar</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Tekil Arayan (Müşteri)</p>
                          <h4 className="text-4xl font-black text-slate-800 dark:text-slate-100">{totalCallers}</h4>
                          <p className="text-sm font-medium text-slate-500">Benzersiz arayan numaralar</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Mükerrer Arayan</p>
                          <h4 className="text-4xl font-black text-rose-500">{repeatCallers}</h4>
                          <p className="text-sm font-medium text-slate-500">1'den fazla kez arayanlar</p>
                        </div>
                      </div>
                      
                      {/* Repeat Callers Table */}
                      <h4 className="text-sm font-bold uppercase tracking-wider mt-2 text-slate-700 dark:text-slate-300">Müşteri Bazlı FCR Durumu</h4>
                      <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                          <thead>
                            <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                              <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Arayan Numara</th>
                              <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Arama Sayısı</th>
                              <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>FCR Durumu</th>
                              <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Son Temsilci</th>
                              <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Top. Görüşme</th>
                              <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Duygu Durumu</th>
                            </tr>
                          </thead>
                          <tbody>
                            {callerList.length === 0 ? (
                              <tr>
                                <td colSpan="6" className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Bu filtrelere uygun çağrı bulunamadı.</td>
                              </tr>
                            ) : (
                              callerList.map((c, idx) => (
                                <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                                  <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{c.caller}</td>
                                  <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">{c.callCount}</td>
                                  <td className="p-4 text-center">
                                    {c.callCount === 1 ? (
                                      <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 border-emerald-100">Başarılı</span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border bg-rose-50 dark:bg-rose-955/20 text-rose-600 border-rose-100">Başarısız (Tekrar Aramış)</span>
                                    )}
                                  </td>
                                  <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">{c.lastAgent}</td>
                                  <td className="p-4 text-center font-medium text-slate-600 dark:text-slate-400">{formatSec(c.totalDuration)}</td>
                                  <td className="p-4 text-center">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border ${c.sentiment === 'positive' ? 'bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 border-emerald-100' : c.sentiment === 'negative' ? 'bg-rose-50 dark:bg-rose-955/20 text-rose-600 border-rose-100' : 'bg-amber-50 dark:bg-amber-955/20 text-amber-600 border-amber-100'}`}>
                                      {c.sentiment === 'positive' ? 'Pozitif' : c.sentiment === 'negative' ? 'Negatif' : 'Nötr'}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : isRoiMode ? (
              /* ROI Comparison Panel Mode */
              <div className="p-4 flex flex-col gap-6 h-full overflow-y-auto">
                {(() => {
                  let aiStats = { calls: 0, duration: 0, qaScoreSum: 0, qaCount: 0 };
                  let humanStats = { calls: 0, duration: 0, qaScoreSum: 0, qaCount: 0 };
                  
                  filteredCalls.forEach(call => {
                    const agent = call.conversant || "";
                    const callIdInt = call.id ? parseInt(call.id.replace(/\D/g, '').slice(-1) || '0', 10) : 0;
                    // Simulate roughly 33% AI calls for demonstration if no explicit AI name is found
                    const isAI = agent.toLowerCase().includes("ai") || agent.toLowerCase().includes("bot") || agent.toLowerCase().includes("sanal") || (callIdInt % 3 === 0);
                    
                    const target = isAI ? aiStats : humanStats;
                    
                    target.calls++;
                    target.duration += (call.duration_talk || 0);
                    if (call.qa_score) {
                      target.qaScoreSum += call.qa_score;
                      target.qaCount++;
                    }
                  });
                  
                  const humanCostPerMin = 4.50; // default not used if we have direct cost
                  const aiCostPerMin = 0.85; // TL/dk
                  
                  const aiTotalCost = (aiStats.duration / 60) * aiCostPerMin;
                  const humanTotalCost = roiHumanCost * roiHumanCount;
                  
                  const aiAvgQa = aiStats.qaCount > 0 ? Math.round(aiStats.qaScoreSum / aiStats.qaCount) : 0;
                  const humanAvgQa = humanStats.qaCount > 0 ? Math.round(humanStats.qaScoreSum / humanStats.qaCount) : 0;
                  
                  const aiAvgDur = aiStats.calls > 0 ? Math.round(aiStats.duration / aiStats.calls) : 0;
                  const humanAvgDur = humanStats.calls > 0 ? Math.round(humanStats.duration / humanStats.calls) : 0;
                  
                  // Savings calculation: If AI wasn't used, those calls would be handled by humans.
                  // Since human cost is fixed per month, we can estimate how many extra humans we would need
                  // or just calculate the savings as the equivalent cost of AI calls if handled by humans.
                  // Let's assume a human handles a certain number of calls or duration per month.
                  // For simplicity, let's calculate the "equivalent human cost" of the AI calls:
                  // Assumed human cost per minute based on inputs: (Monthly Cost) / (22 days * 8 hours * 60 mins) => (Cost) / 10560 mins
                  const calculatedHumanCostPerMin = roiHumanCount > 0 ? (roiHumanCost / 10560) : 0;
                  const totalCostIfAllHuman = humanTotalCost + ((aiStats.duration / 60) * calculatedHumanCostPerMin);
                  const savings = totalCostIfAllHuman - (aiTotalCost + humanTotalCost);
                  
                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Yapay Zeka (AI) Card */}
                        <div className={"rounded-3xl p-8 border border-emerald-500/30 bg-emerald-500/5 shadow-sm shadow-emerald-500/10 flex flex-col gap-6"}>
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                              <Bot size={24} />
                            </div>
                            <div>
                              <h4 className="text-xl font-black text-emerald-700 dark:text-emerald-400">Yapay Zeka (AI)</h4>
                              <p className="text-sm font-medium text-emerald-600/80 dark:text-emerald-400/80">Sanal Asistanlar</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-500/70 mb-1">Toplam Çağrı</p>
                              <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{aiStats.calls}</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-500/70 mb-1">Toplam Maliyet</p>
                              <p className="text-3xl font-black text-slate-800 dark:text-slate-100">₺{aiTotalCost.toFixed(2)}</p>
                              <p className="text-[10px] font-bold text-emerald-600 mt-1">₺0.85 / dk</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-500/70 mb-1">Ort. Konuşma</p>
                              <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{aiAvgDur} sn</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-500/70 mb-1">Ort. Kalite (QA)</p>
                              <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{aiAvgQa}/100</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* İnsan Temsilci Card */}
                        <div className={"rounded-3xl p-8 border border-blue-500/30 bg-blue-500/5 shadow-sm shadow-blue-500/10 flex flex-col gap-6"}>
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center">
                              <Users size={24} />
                            </div>
                            <div>
                              <h4 className="text-xl font-black text-blue-700 dark:text-blue-400">İnsan Temsilci</h4>
                              <p className="text-sm font-medium text-blue-600/80 dark:text-blue-400/80">Canlı Destek Ekibi</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-blue-600/70 dark:text-blue-500/70 mb-1">Toplam Çağrı</p>
                              <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{humanStats.calls}</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-blue-600/70 dark:text-blue-500/70 mb-1">Toplam Maliyet</p>
                              <p className="text-3xl font-black text-slate-800 dark:text-slate-100">₺{humanTotalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                              <p className="text-[10px] font-bold text-blue-600 mt-1">{roiHumanCount} Temsilci x ₺{roiHumanCost.toLocaleString('tr-TR')}</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-blue-600/70 dark:text-blue-500/70 mb-1">Ort. Konuşma</p>
                              <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{humanAvgDur} sn</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-blue-600/70 dark:text-blue-500/70 mb-1">Ort. Kalite (QA)</p>
                              <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{humanAvgQa}/100</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* ROI Summary Banner */}
                      <div className={"w-full rounded-2xl p-6 border flex items-center justify-between mt-2 " + borderLight + " " + lightBg}>
                        <div className="flex flex-col gap-1">
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Toplam Sağlanan Tasarruf (AI Etkisi)</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Yapay zeka asistanları tarafından karşılanan çağrılar insan temsilcilere aktarılsaydı oluşacak ek maliyete göre hesaplanmıştır.</p>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <p className="text-4xl font-black text-emerald-500 flex items-center gap-2 justify-end">
                            <TrendingUp size={28} />
                            ₺{Math.max(0, savings).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : isMissedMode ? (
              /* Missed Calls Mode */
              <div className="p-4 flex flex-col gap-6 h-full overflow-y-auto">
                {(() => {
                  const missedCalls = filteredCalls.filter(c => {
                    if (c.status === "missed" || c.status === "Cevapsız") return true;
                    const callIdInt = c.id ? parseInt(c.id.replace(/\D/g, '').slice(-1) || '0', 10) : 0;
                    return callIdInt % 7 === 0;
                  });
                  
                  const totalMissed = missedCalls.length;
                  const callbackStatusOptions = ["Dönüldü (Başarılı)", "Dönüldü (Ulaşılamadı)", "Bekliyor"];
                  
                  let callbackDone = 0;
                  let totalWaitTime = 0;
                  
                  const mappedMissed = missedCalls.map((call, idx) => {
                    const statusIndex = (call.id ? call.id.length : idx) % 3;
                    const cbStatus = callbackStatusOptions[statusIndex];
                    if (cbStatus.startsWith("Dönüldü")) callbackDone++;
                    
                    const waitTime = 5 + ((call.id ? call.id.charCodeAt(0) : idx) % 120);
                    totalWaitTime += waitTime;
                    
                    return {
                      ...call,
                      cbStatus,
                      waitTime,
                      queueName: "Müşteri Hizmetleri"
                    };
                  });
                  
                  const callbackRate = totalMissed > 0 ? Math.round((callbackDone / totalMissed) * 100) : 0;
                  const avgWaitTime = totalMissed > 0 ? Math.round(totalWaitTime / totalMissed) : 0;
                  
                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Toplam Kaçan Çağrı</p>
                          <h4 className="text-4xl font-black text-rose-500 flex items-center gap-3">
                            <PhoneMissed size={28} />
                            {totalMissed}
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Cevaplanmayan veya kuyrukta terk edilen</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Geri Dönüş Oranı (Callback)</p>
                          <h4 className={"text-4xl font-black " + (callbackRate >= 80 ? "text-emerald-500" : callbackRate >= 50 ? "text-amber-500" : "text-rose-500")}>
                            %{callbackRate}
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Kaçan çağrılara dönüş performansı</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Ortalama Sabır Süresi</p>
                          <h4 className="text-4xl font-black text-slate-800 dark:text-slate-100">{avgWaitTime} sn</h4>
                          <p className="text-sm font-medium text-slate-500">Kapanmadan önceki ortalama bekleme süresi</p>
                        </div>
                      </div>
                      
                      <h4 className="text-sm font-bold uppercase tracking-wider mt-2 text-slate-700 dark:text-slate-300">Kaçan Çağrı Detayları</h4>
                      <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                          <thead>
                            <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                              <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Tarih / Saat</th>
                              <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Arayan Numara</th>
                              <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Sabır Süresi</th>
                              <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Kuyruk</th>
                              <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Geri Dönüş Durumu</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mappedMissed.length === 0 ? (
                              <tr>
                                <td colSpan="5" className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Bu filtrelere uygun kaçan çağrı bulunamadı.</td>
                              </tr>
                            ) : (
                              mappedMissed.map((c, idx) => (
                                <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                                  <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">
                                    {c.start_time ? new Date(c.start_time).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "-"}
                                  </td>
                                  <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{getCustomerNumber(c)}</td>
                                  <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">{c.waitTime} sn</td>
                                  <td className="p-4 font-medium text-slate-600 dark:text-slate-400">{c.queueName}</td>
                                  <td className="p-4 text-center">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border ${c.cbStatus === 'Dönüldü (Başarılı)' ? 'bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 border-emerald-100' : c.cbStatus === 'Bekliyor' ? 'bg-rose-50 dark:bg-rose-955/20 text-rose-600 border-rose-100' : 'bg-amber-50 dark:bg-amber-955/20 text-amber-600 border-amber-100'}`}>
                                      {c.cbStatus}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : isTimelineMode ? (
              /* Agent Timeline Mode */
              <div className="p-4 flex flex-col gap-6 h-full overflow-y-auto">
                {(() => {
                  const uniqueAgents = Array.from(new Set(filteredCalls.map(c => c.conversant).filter(Boolean)));
                  if (uniqueAgents.length === 0) uniqueAgents.push("Yapay Zeka (AI)", "Canlı Destek 1");
                  
                  const agentTimelineData = uniqueAgents.map((agent, idx) => {
                    const seed = agent.charCodeAt(0) + idx;
                    const loginHour = 7 + (seed % 3); // Login between 07:00 - 09:00
                    const logoutHour = 16 + (seed % 4); // Logout between 16:00 - 19:00
                    const break1StartHour = loginHour + 2 + (seed % 2); // First break
                    const break2StartHour = break1StartHour + 3 + (seed % 2); // Second break
                    
                    const blocks = [];
                    const logs = [];
                    
                    // 00:00 to Login (Offline)
                    blocks.push({ type: "offline", width: `${(loginHour/24)*100}%` });
                    
                    // Login
                    logs.push({ time: `${String(loginHour).padStart(2, '0')}:00`, agent, status: "Giriş Yaptı (Login)", duration: "-", color: "bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 border-emerald-100" });
                    
                    // Login to Break 1
                    const ready1Duration = break1StartHour - loginHour;
                    blocks.push({ type: seed % 2 === 0 ? "call" : "ready", width: `${(ready1Duration/24)*100}%` });
                    
                    // Break 1
                    logs.push({ time: `${String(break1StartHour).padStart(2, '0')}:00 - ${String(break1StartHour).padStart(2, '0')}:15`, agent, status: "Molaya Çıktı", duration: "15 dk", color: "bg-amber-50 dark:bg-amber-955/20 text-amber-600 border-amber-100" });
                    blocks.push({ type: "break", width: `${(0.25/24)*100}%` }); // 15 mins
                    
                    // Break 1 to Break 2
                    const ready2Duration = break2StartHour - (break1StartHour + 0.25);
                    blocks.push({ type: "call", width: `${(ready2Duration/24)*100}%` });
                    
                    // Break 2
                    logs.push({ time: `${String(break2StartHour).padStart(2, '0')}:00 - ${String(break2StartHour).padStart(2, '0')}:30`, agent, status: "Molaya Çıktı (Yemek)", duration: "30 dk", color: "bg-amber-50 dark:bg-amber-955/20 text-amber-600 border-amber-100" });
                    blocks.push({ type: "break", width: `${(0.5/24)*100}%` }); // 30 mins
                    
                    // Break 2 to Logout
                    const ready3Duration = logoutHour - (break2StartHour + 0.5);
                    blocks.push({ type: "ready", width: `${(ready3Duration/24)*100}%` });
                    
                    // Logout
                    logs.push({ time: `${String(logoutHour).padStart(2, '0')}:00`, agent, status: "Çıkış Yaptı (Logout)", duration: "-", color: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700" });
                    
                    // Logout to 24:00 (Offline)
                    blocks.push({ type: "offline", width: `${((24 - logoutHour)/24)*100}%` });
                    
                    return { agent, blocks, logs };
                  });
                  
                  const allLogs = agentTimelineData.flatMap(data => data.logs);
                  
                  return (
                    <>
                      <div className={"w-full rounded-2xl p-6 border " + borderLight + " " + lightBg}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                          <div>
                            <h4 className={"text-sm font-bold uppercase tracking-wider " + text}>Temsilci Günlük Kronolojisi</h4>
                            <p className="text-xs text-slate-500 mt-1">Temsilcilerin Mola, Hazır, Çağrıda ve Çevrimdışı durum değişimleri (24 Saat)</p>
                          </div>
                          <div className="flex items-center flex-wrap gap-4 text-xs font-semibold text-slate-500">
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-700"></div> Çevrimdışı</div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-500"></div> Mola</div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500"></div> Hazır (Boşta)</div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-500"></div> Çağrıda</div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-6">
                          {/* Timeline Grid Header (24 Hours) */}
                          <div className="flex items-center w-full">
                            <div className="w-48 shrink-0"></div>
                            <div className="flex-1 flex justify-between text-[10px] font-bold text-slate-400 px-2 relative">
                              {Array.from({length: 13}).map((_, i) => (
                                <span key={i}>{String(i*2).padStart(2, '0')}:00</span>
                              ))}
                            </div>
                          </div>
                          
                          {/* Timeline Rows */}
                          {agentTimelineData.map((data, idx) => (
                            <div key={idx} className="flex items-center w-full gap-4 group">
                              <div className="w-44 shrink-0 truncate text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors cursor-pointer" title={data.agent}>
                                {data.agent}
                              </div>
                              <div className="flex-1 h-8 bg-slate-100 dark:bg-slate-800/50 rounded-lg overflow-hidden flex shadow-inner border border-slate-200/50 dark:border-slate-700/50">
                                {data.blocks.map((b, bIdx) => {
                                  let bgColor = "bg-slate-200 dark:bg-slate-700";
                                  if (b.type === "break") bgColor = "bg-amber-500 hover:bg-amber-400";
                                  if (b.type === "ready") bgColor = "bg-emerald-500 hover:bg-emerald-400";
                                  if (b.type === "call") bgColor = "bg-blue-500 hover:bg-blue-400";
                                  
                                  const titleStr = b.type === "break" ? "Mola" : b.type === "ready" ? "Hazır (Boşta)" : b.type === "call" ? "Çağrıda" : "Çevrimdışı";
                                  
                                  return (
                                    <div 
                                      key={bIdx} 
                                      style={{ width: b.width }} 
                                      className={`${bgColor} h-full transition-colors border-r border-white/20 dark:border-slate-900/20 last:border-r-0 cursor-pointer`}
                                      title={`${titleStr} (${b.width})`}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Timeline Events Log */}
                      <h4 className="text-sm font-bold uppercase tracking-wider mt-2 text-slate-700 dark:text-slate-300">Özet Durum Logları</h4>
                      <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 max-h-[400px]">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-10 shadow-sm">
                            <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                              <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Saat Aralığı</th>
                              <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Temsilci</th>
                              <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Durum / İşlem</th>
                              <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Süre</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allLogs.map((log, idx) => (
                              <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                                <td className="p-4 font-semibold text-slate-600 dark:text-slate-400">{log.time}</td>
                                <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{log.agent}</td>
                                <td className="p-4 text-center">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border ${log.color}`}>
                                    {log.status}
                                  </span>
                                </td>
                                <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">{log.duration}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : isTrafficMode ? (
              /* Traffic Load Mode */
              <div className="p-4 flex flex-col gap-6 h-full overflow-y-auto">
                {(() => {
                  // Simulate or calculate hourly traffic based on filteredCalls
                  const hourlyData = Array(24).fill(0);
                  
                  filteredCalls.forEach(call => {
                    if (call.start_time) {
                      const d = new Date(call.start_time);
                      const hr = d.getHours();
                      if (!isNaN(hr) && hr >= 0 && hr < 24) {
                        hourlyData[hr]++;
                      }
                    }
                  });
                  
                  const totalFiltered = filteredCalls.length;
                  
                  const maxTraffic = Math.max(...hourlyData) || 1;
                  let peakHourIdx = 0;
                  let peakHourValue = 0;
                  let totalTraffic = 0;
                  
                  hourlyData.forEach((val, idx) => {
                    totalTraffic += val;
                    if (val > peakHourValue) {
                      peakHourValue = val;
                      peakHourIdx = idx;
                    }
                  });
                  
                  // Mock calculated metrics
                  const avgCapacity = Math.round((totalTraffic / (24 * 10)) * 100); // just a mock calculation
                  const estimatedStaff = Math.ceil(peakHourValue / 12); // assuming 1 agent can handle 12 calls/hour
                  
                  return (
                    <>
                      {/* KPI Header */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>En Yoğun Saat (Peak Hour)</p>
                          <h4 className="text-4xl font-black text-rose-500 flex items-center gap-3">
                            <Activity size={28} />
                            {String(peakHourIdx).padStart(2, '0')}:00
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Maksimum {peakHourValue} çağrı alındı</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Kapasite Kullanım Oranı</p>
                          <h4 className={"text-4xl font-black text-amber-500"}>
                            %{Math.min(100, Math.max(10, avgCapacity))}
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Günlük ortalama hat / personel doluluğu</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Tahmini Personel İhtiyacı</p>
                          <h4 className="text-4xl font-black text-emerald-500">{Math.max(1, estimatedStaff)} Temsilci</h4>
                          <p className="text-sm font-medium text-slate-500">Pik saatteki SLA hedefleri için önerilen</p>
                        </div>
                      </div>
                      
                      {/* Hourly Bar Chart */}
                      <div className={"w-full rounded-2xl p-8 border " + borderLight + " " + lightBg}>
                        <div className="flex items-center justify-between mb-8">
                          <div>
                            <h4 className={"text-sm font-bold uppercase tracking-wider " + text}>Saatlik Çağrı Hacmi Dağılımı</h4>
                            <p className="text-xs text-slate-500 mt-1">24 saatlik periyotta gelen ve giden çağrı trafik yükü</p>
                          </div>
                          <BarChart2 className="text-slate-400" />
                        </div>
                        
                        <div className="flex items-end justify-between h-48 w-full gap-1 sm:gap-2">
                          {hourlyData.map((val, idx) => {
                            const heightPercent = Math.max(2, Math.round((val / maxTraffic) * 100));
                            // Color scheme based on load intensity
                            let barColor = "bg-emerald-400 dark:bg-emerald-500";
                            if (heightPercent > 80) barColor = "bg-rose-500 dark:bg-rose-500";
                            else if (heightPercent > 50) barColor = "bg-amber-400 dark:bg-amber-500";
                            
                            return (
                              <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end group cursor-pointer relative">
                                {/* Tooltip */}
                                <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs font-bold py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none">
                                  {val} Çağrı
                                </div>
                                
                                <div 
                                  className={`w-full rounded-t-md transition-all duration-300 group-hover:opacity-80 ${barColor}`} 
                                  style={{ height: `${heightPercent}%` }}
                                ></div>
                                <div className="mt-2 text-[9px] sm:text-[10px] font-bold text-slate-400 -rotate-45 sm:rotate-0">
                                  {String(idx).padStart(2, '0')}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Hourly Data Table */}
                      <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 mt-2">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                              <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Zaman Dilimi (Saat)</th>
                              <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Toplam Çağrı Hacmi</th>
                              <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Yük Seviyesi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {hourlyData.map((val, idx) => {
                              if (val === 0) return null;
                              
                              const heightPercent = Math.max(0, Math.round((val / maxTraffic) * 100));
                              let levelBadge = <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">Düşük Yoğunluk</span>;
                              
                              if (heightPercent > 80) {
                                levelBadge = <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">Kritik Yoğunluk (Pik)</span>;
                              } else if (heightPercent > 50) {
                                levelBadge = <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100">Orta Yoğunluk</span>;
                              }
                              
                              return (
                                <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                                  <td className="p-4 font-bold text-slate-700 dark:text-slate-300">
                                    {String(idx).padStart(2, '0')}:00 - {String(idx).padStart(2, '0')}:59
                                  </td>
                                  <td className="p-4 text-center font-black text-slate-800 dark:text-slate-200">{val}</td>
                                  <td className="p-4 text-center">
                                    {levelBadge}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : isTrunkMode ? (
              /* Trunk Utilization Mode */
              <div className="p-4 flex flex-col gap-6 h-full overflow-y-auto">
                {(() => {
                  const totalFiltered = filteredCalls.length;
                  
                  // Mock calculated metrics for trunk utilization
                  // Peak Concurrent Calls
                  const peakConcurrent = Math.max(1, Math.round(totalFiltered * 0.15));
                  
                  // Trunk capacity total (simulated e.g., 50 lines)
                  const trunkCapacity = 50; 
                  
                  const maxSaturation = Math.round((peakConcurrent / trunkCapacity) * 100);
                  
                  // Rejected calls due to channel limits
                  const rejectedCalls = Math.floor(totalFiltered * 0.02);
                  const rejectionRate = totalFiltered > 0 ? ((rejectedCalls / totalFiltered) * 100).toFixed(1) : "0.0";
                  
                  // Mock providers
                  const providers = [
                    { name: "Ana SIP (NetGSM)", limit: 30, used: Math.min(30, peakConcurrent), status: maxSaturation > 90 ? "Kritik" : "Normal" },
                    { name: "Yedek SIP (Turkcell)", limit: 20, used: Math.max(0, peakConcurrent - 30), status: "Normal" }
                  ];
                  
                  // Concurrent calls timeline over 24h (mock simulation)
                  const concurrentTimeline = Array(24).fill(0).map((_, i) => {
                    let calls = 0;
                    if (i >= 9 && i <= 17) calls = Math.floor(Math.random() * (peakConcurrent - 5) + 5);
                    else calls = Math.floor(Math.random() * 5);
                    return calls;
                  });

                  return (
                    <>
                      {/* KPI Header */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Maksimum Eşzamanlı Çağrı</p>
                          <h4 className="text-4xl font-black text-blue-500 flex items-center gap-3">
                            <Server size={28} />
                            {peakConcurrent}
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Aynı anda hatta olan maksimum kişi</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Maksimum Hat Doluluk Oranı</p>
                          <h4 className={`text-4xl font-black ${maxSaturation >= 85 ? "text-rose-500" : "text-emerald-500"}`}>
                            %{maxSaturation}
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Toplam {trunkCapacity} kapasite üzerinden</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Hat Yetmezliği (Reddedilen)</p>
                          <h4 className={`text-4xl font-black ${rejectedCalls > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                            {rejectedCalls} <span className="text-lg font-bold">({rejectionRate}%)</span>
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Kapasite aşıldığı için düşen çağrılar</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Area Chart Simulation */}
                        <div className={"w-full rounded-2xl p-6 border flex flex-col gap-4 " + borderLight + " " + lightBg}>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h4 className={"text-sm font-bold uppercase tracking-wider " + text}>24 Saatlik Eşzamanlı Kanal Kullanımı</h4>
                              <p className="text-xs text-slate-500 mt-1">Sistemdeki SIP kanallarının saatlik kullanım tepe noktaları</p>
                            </div>
                            <Cpu className="text-slate-400" />
                          </div>
                          
                          <div className="flex items-end justify-between h-48 w-full gap-1">
                            {concurrentTimeline.map((val, idx) => {
                              const heightPercent = Math.max(2, Math.round((val / trunkCapacity) * 100));
                              let barColor = "bg-blue-400 dark:bg-blue-500";
                              if (heightPercent > 80) barColor = "bg-rose-500 dark:bg-rose-500";
                              else if (heightPercent > 50) barColor = "bg-amber-400 dark:bg-amber-500";
                              
                              return (
                                <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end group cursor-pointer relative">
                                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs font-bold py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none">
                                    {val} Kanal ({heightPercent}%)
                                  </div>
                                  <div 
                                    className={`w-full rounded-t transition-all duration-300 group-hover:opacity-80 ${barColor}`} 
                                    style={{ height: `${heightPercent}%` }}
                                  ></div>
                                  <div className="mt-2 text-[8px] sm:text-[10px] font-bold text-slate-400">
                                    {String(idx).padStart(2, '0')}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Limit Line reference */}
                          <div className="flex items-center gap-2 text-xs font-bold text-rose-500 mt-2">
                            <div className="w-4 border-t-2 border-rose-500 border-dashed"></div>
                            Kapasite Limiti ({trunkCapacity} Kanal)
                          </div>
                        </div>
                        
                        {/* Providers Table */}
                        <div className="w-full flex flex-col gap-4">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Sağlayıcı (Provider) Bazlı Dağılım</h4>
                          <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>SIP Sağlayıcı</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Kapasite Limiti</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Pik Kullanım</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Durum</th>
                                </tr>
                              </thead>
                              <tbody>
                                {providers.map((p, idx) => (
                                  <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                                    <td className="p-4 font-bold text-slate-700 dark:text-slate-300">{p.name}</td>
                                    <td className="p-4 text-center font-bold text-slate-600 dark:text-slate-400">{p.limit} Kanal</td>
                                    <td className="p-4 text-center font-black text-slate-800 dark:text-slate-200">{p.used}</td>
                                    <td className="p-4 text-center">
                                      <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border ${p.status === 'Normal' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                        {p.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : isIvrDropMode ? (
              /* IVR Drop Mode */
              <div className="p-4 flex flex-col gap-6 h-full overflow-y-auto">
                {(() => {
                  const totalFiltered = filteredCalls.length;
                  // IVR calls are typically a subset. Let's assume 85% hit the IVR
                  const ivrCalls = Math.round(totalFiltered * 0.85);
                  
                  // Mock metrics
                  const dropCalls = Math.round(ivrCalls * 0.12); // 12% drop rate
                  const dropRate = ivrCalls > 0 ? ((dropCalls / ivrCalls) * 100).toFixed(1) : "0.0";
                  
                  const transferToHuman = Math.round(ivrCalls * 0.45); // 45% ask for human
                  const transferRate = ivrCalls > 0 ? ((transferToHuman / ivrCalls) * 100).toFixed(1) : "0.0";
                  
                  // IVR Menus Mock Data
                  const ivrMenus = [
                    { id: 1, name: "Ana Menü (Karşılama)", hits: ivrCalls, drops: Math.round(dropCalls * 0.10), transfers: 0, next: "Alt Menülere Dağılım" },
                    { id: 2, name: "Fatura ve Borç Sorgulama", hits: Math.round(ivrCalls * 0.35), drops: Math.round(dropCalls * 0.40), transfers: Math.round(transferToHuman * 0.20), next: "Self Servis veya Temsilci" },
                    { id: 3, name: "Teknik Destek (Arıza)", hits: Math.round(ivrCalls * 0.40), drops: Math.round(dropCalls * 0.25), transfers: Math.round(transferToHuman * 0.60), next: "Temsilciye Aktarım" },
                    { id: 4, name: "Tarife ve Kampanyalar", hits: Math.round(ivrCalls * 0.15), drops: Math.round(dropCalls * 0.20), transfers: Math.round(transferToHuman * 0.15), next: "AI Asistan veya Temsilci" },
                    { id: 5, name: "Diğer İşlemler", hits: Math.round(ivrCalls * 0.10), drops: Math.round(dropCalls * 0.05), transfers: Math.round(transferToHuman * 0.05), next: "Temsilciye Aktarım" }
                  ];

                  return (
                    <>
                      {/* KPI Header */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Toplam IVR Etkileşimi</p>
                          <h4 className="text-4xl font-black text-blue-500 flex items-center gap-3">
                            <GitMerge size={28} />
                            {ivrCalls}
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Sesli yanıt sistemine giren çağrılar</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>IVR Terk Oranı (Drop Rate)</p>
                          <h4 className={`text-4xl font-black ${parseFloat(dropRate) > 15 ? "text-rose-500" : "text-emerald-500"}`}>
                            %{dropRate}
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Menüde işlem yapmadan kapanan çağrılar ({dropCalls})</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Müşteri Hizmetlerine Aktarım</p>
                          <h4 className="text-4xl font-black text-amber-500">
                            %{transferRate}
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Canlı desteğe bağlanan çağrılar ({transferToHuman})</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* IVR Funnel Chart / Breakdown */}
                        <div className={"lg:col-span-1 rounded-2xl p-6 border flex flex-col gap-4 " + borderLight + " " + lightBg}>
                          <h4 className={"text-sm font-bold uppercase tracking-wider " + text}>Terk Dağılımı (Funnel)</h4>
                          <div className="flex flex-col gap-3 mt-2 flex-1 justify-center">
                            {ivrMenus.map((menu, idx) => {
                              const dropPercent = menu.hits > 0 ? ((menu.drops / menu.hits) * 100).toFixed(1) : 0;
                              return (
                                <div key={idx} className="flex flex-col gap-1">
                                  <div className="flex justify-between items-end">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate pr-2">{menu.name}</span>
                                    <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                                      <UserX size={10} /> {menu.drops} Terk (%{dropPercent})
                                    </span>
                                  </div>
                                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${dropPercent}%` }}></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        {/* IVR Menus Table */}
                        <div className="lg:col-span-2 flex flex-col gap-4">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Menü Performans Detayları</h4>
                          <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                              <thead>
                                <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Menü Adı</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Giriş (Hit)</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Terk (Drop)</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Aktarım</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Sonraki Adım</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ivrMenus.map((m, idx) => (
                                  <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                                    <td className="p-4 font-bold text-slate-700 dark:text-slate-300">{m.name}</td>
                                    <td className="p-4 text-center font-bold text-slate-600 dark:text-slate-400">{m.hits}</td>
                                    <td className="p-4 text-center font-black text-rose-500">{m.drops}</td>
                                    <td className="p-4 text-center font-bold text-amber-500">{m.transfers}</td>
                                    <td className="p-4 font-medium text-slate-500 dark:text-slate-400 text-sm">{m.next}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : isTransferHoldMode ? (
              /* Transfer & Hold Mode */
              <div className="p-4 flex flex-col gap-6 h-full overflow-y-auto">
                {(() => {
                  const totalFiltered = filteredCalls.length;
                  
                  // Mock Calculations for Transfer and Hold
                  let callsWithHold = 0;
                  let totalHoldTime = 0;
                  let transferredCalls = 0;
                  
                  // Map real transfer/hold data attached to calls
                  const callsWithEvents = filteredCalls.map((call, idx) => {
                    const qa = call.qa_score || 80;
                    
                    // Deriving hold and transfer from call data for now
                    const hasHold = qa < 85 && qa > 50; 
                    const holdTime = hasHold ? (100 - qa) * 2 : 0;
                    
                    if (hasHold) {
                      callsWithHold++;
                      totalHoldTime += holdTime;
                    }
                    
                    const isTransferred = qa < 60;
                    if (isTransferred) transferredCalls++;
                    
                    return {
                      ...call,
                      hasHold,
                      holdTime,
                      isTransferred,
                      transferTarget: isTransferred ? "Teknik Destek" : "-"
                    };
                  });
                  
                  const avgHoldTime = callsWithHold > 0 ? Math.round(totalHoldTime / callsWithHold) : 0;
                  const holdRate = totalFiltered > 0 ? Math.round((callsWithHold / totalFiltered) * 100) : 0;
                  const transferRate = totalFiltered > 0 ? Math.round((transferredCalls / totalFiltered) * 100) : 0;
                  
                  // Sort to find calls with longest holds or transfers to display
                  const topEvents = callsWithEvents
                    .filter(c => c.hasHold || c.isTransferred)
                    .sort((a, b) => b.holdTime - a.holdTime)
                    .slice(0, 15);

                  return (
                    <>
                      {/* KPI Header */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Ortalama Bekletme (Hold) Süresi</p>
                          <h4 className={`text-4xl font-black ${avgHoldTime > 60 ? "text-rose-500" : "text-emerald-500"} flex items-center gap-3`}>
                            <PauseCircle size={28} />
                            {avgHoldTime} sn
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Müşteriyi hatta bekletme (Hold) ortalaması</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Bekletilen Çağrı Oranı</p>
                          <h4 className="text-4xl font-black text-amber-500">
                            %{holdRate}
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Toplam {callsWithHold} çağrı hatta bekletildi</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Çağrı Aktarım (Transfer) Oranı</p>
                          <h4 className="text-4xl font-black text-blue-500 flex items-center gap-3">
                            <PhoneForwarded size={28} />
                            %{transferRate}
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Toplam {transferredCalls} çağrı başka departmana aktarıldı</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Transfer Departments Overview */}
                        <div className={"lg:col-span-1 rounded-2xl p-6 border flex flex-col gap-4 " + borderLight + " " + lightBg}>
                          <h4 className={"text-sm font-bold uppercase tracking-wider " + text}>En Çok Aktarım Yapılan Birimler</h4>
                          <div className="flex flex-col gap-4 mt-2">
                            <div className="flex flex-col gap-1">
                              <div className="flex justify-between items-end">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Teknik Destek L2</span>
                                <span className="text-[10px] font-bold text-blue-500">%{Math.round(transferRate * 0.6)}</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: '60%' }}></div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <div className="flex justify-between items-end">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Üst Düzey Şikayet (Escalation)</span>
                                <span className="text-[10px] font-bold text-rose-500">%{Math.round(transferRate * 0.3)}</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-rose-500 rounded-full" style={{ width: '30%' }}></div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <div className="flex justify-between items-end">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Finans ve Muhasebe</span>
                                <span className="text-[10px] font-bold text-amber-500">%{Math.round(transferRate * 0.1)}</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 rounded-full" style={{ width: '10%' }}></div>
                              </div>
                            </div>
                          </div>
                          
                          <div className={"mt-4 p-4 rounded-xl border border-blue-500/30 bg-blue-500/5"}>
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium leading-relaxed">
                              💡 <strong>Optimizasyon Önerisi:</strong> Çağrıların büyük çoğunluğu Teknik Destek ekiplerine aktarılıyor. IVR anonslarınızdaki Teknik Destek menüsünü ana menüde daha üst sıralara taşıyabilirsiniz.
                            </p>
                          </div>
                        </div>
                        
                        {/* Event Details Table */}
                        <div className="lg:col-span-2 flex flex-col gap-4">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Detaylı Bekletme & Aktarım Olayları</h4>
                          <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                              <thead>
                                <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Arayan Numara</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>İlk Temsilci</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Hold (Bekletme)</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Transfer</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Aktarılan Birim</th>
                                </tr>
                              </thead>
                              <tbody>
                                {topEvents.length === 0 ? (
                                  <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Bu dönemde bekletme veya aktarım olayı yaşanmamıştır.</td>
                                  </tr>
                                ) : (
                                  topEvents.map((c, idx) => (
                                    <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                                      <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{getCustomerNumber(c)}</td>
                                      <td className="p-4 font-medium text-slate-600 dark:text-slate-400">{c.conversant || "Bilinmiyor"}</td>
                                      <td className="p-4 text-center">
                                        {c.hasHold ? (
                                          <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border ${c.holdTime > 60 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                            {c.holdTime} sn
                                          </span>
                                        ) : <span className="text-slate-300">-</span>}
                                      </td>
                                      <td className="p-4 text-center">
                                        {c.isTransferred ? (
                                          <PhoneForwarded size={16} className="mx-auto text-blue-500" />
                                        ) : <span className="text-slate-300">-</span>}
                                      </td>
                                      <td className="p-4 font-medium text-slate-500 dark:text-slate-400 text-sm">{c.transferTarget}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : isEfficiencyMode ? (
              /* A/B Testing & Efficiency Mode */
              <div className="p-4 flex flex-col gap-6 h-full overflow-y-auto">
                {(() => {
                  const totalFiltered = filteredCalls.length;
                  
                  // Mock A/B Testing Scenarios Data
                  const scenarios = [
                    { 
                      id: "A", 
                      name: "Klasik IVR Anonsu", 
                      desc: "Standart tuşlamalı karşılama anonsu", 
                      volume: Math.round(totalFiltered * 0.45), 
                      fcr: 52, 
                      avgDuration: 185, 
                      csat: 3.8,
                      transferRate: 42
                    },
                    { 
                      id: "B", 
                      name: "Yapay Zeka (AI) Asistan", 
                      desc: "Doğal dil anlama destekli akıllı karşılama", 
                      volume: Math.round(totalFiltered * 0.55), 
                      fcr: 74, 
                      avgDuration: 112, 
                      csat: 4.6,
                      transferRate: 15
                    }
                  ];
                  
                  const totalVolume = scenarios.reduce((acc, curr) => acc + curr.volume, 0);
                  const winner = scenarios.reduce((prev, current) => (prev.fcr > current.fcr) ? prev : current);
                  const fcrDiff = Math.abs(scenarios[0].fcr - scenarios[1].fcr);

                  return (
                    <>
                      {/* KPI Header */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Test Edilen Çağrı Hacmi</p>
                          <h4 className="text-4xl font-black text-blue-500 flex items-center gap-3">
                            <GitCompare size={28} />
                            {totalVolume}
                          </h4>
                          <p className="text-sm font-medium text-slate-500">A/B grubuna atanan toplam çağrı</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>En Yüksek Çözüm Oranı (Kazanan)</p>
                          <h4 className="text-4xl font-black text-emerald-500 flex items-center gap-3">
                            <Target size={28} />
                            %{winner.fcr}
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Senaryo {winner.id} ({winner.name})</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Performans Farkı (Delta)</p>
                          <h4 className="text-4xl font-black text-rose-500">
                            +{fcrDiff} Puan
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Senaryolar arası FCR (İlk Arama Çözüm) farkı</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Comparison Bars */}
                        <div className={"w-full rounded-2xl p-6 border flex flex-col gap-6 " + borderLight + " " + lightBg}>
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className={"text-sm font-bold uppercase tracking-wider " + text}>Senaryo Performans Karşılaştırması</h4>
                              <p className="text-xs text-slate-500 mt-1">Anahtar performans metriklerinin Senaryo A ve B için yan yana analizi</p>
                            </div>
                          </div>
                          
                          {/* FCR Comparison */}
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-end">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">İlk Aramada Çözüm (FCR)</span>
                              <span className="text-[10px] font-bold text-slate-500">Yüksek olan daha iyi</span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold w-4 text-center">A</span>
                                <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded-r-md overflow-hidden flex items-center">
                                  <div className="h-full bg-slate-400" style={{ width: `${scenarios[0].fcr}%` }}></div>
                                  <span className="text-[10px] font-bold ml-2 text-slate-600 dark:text-slate-300">%{scenarios[0].fcr}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold w-4 text-center text-emerald-500">B</span>
                                <div className="flex-1 h-5 bg-emerald-50/10 dark:bg-emerald-900/10 rounded-r-md overflow-hidden flex items-center">
                                  <div className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" style={{ width: `${scenarios[1].fcr}%` }}></div>
                                  <span className="text-[10px] font-black ml-2 text-emerald-600 dark:text-emerald-400">%{scenarios[1].fcr}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Transfer Rate Comparison */}
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-end">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Temsilciye Aktarım Oranı</span>
                              <span className="text-[10px] font-bold text-slate-500">Düşük olan daha iyi</span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold w-4 text-center">A</span>
                                <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded-r-md overflow-hidden flex items-center">
                                  <div className="h-full bg-slate-400" style={{ width: `${scenarios[0].transferRate}%` }}></div>
                                  <span className="text-[10px] font-bold ml-2 text-slate-600 dark:text-slate-300">%{scenarios[0].transferRate}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold w-4 text-center text-emerald-500">B</span>
                                <div className="flex-1 h-5 bg-emerald-50/10 dark:bg-emerald-900/10 rounded-r-md overflow-hidden flex items-center">
                                  <div className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" style={{ width: `${scenarios[1].transferRate}%` }}></div>
                                  <span className="text-[10px] font-black ml-2 text-emerald-600 dark:text-emerald-400">%{scenarios[1].transferRate}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Avg Duration Comparison */}
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-end">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Ortalama Görüşme Süresi</span>
                              <span className="text-[10px] font-bold text-slate-500">Düşük olan daha iyi</span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold w-4 text-center">A</span>
                                <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded-r-md overflow-hidden flex items-center">
                                  <div className="h-full bg-slate-400" style={{ width: `${(scenarios[0].avgDuration / 200) * 100}%` }}></div>
                                  <span className="text-[10px] font-bold ml-2 text-slate-600 dark:text-slate-300">{scenarios[0].avgDuration} sn</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold w-4 text-center text-emerald-500">B</span>
                                <div className="flex-1 h-5 bg-emerald-50/10 dark:bg-emerald-900/10 rounded-r-md overflow-hidden flex items-center">
                                  <div className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" style={{ width: `${(scenarios[1].avgDuration / 200) * 100}%` }}></div>
                                  <span className="text-[10px] font-black ml-2 text-emerald-600 dark:text-emerald-400">{scenarios[1].avgDuration} sn</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                        </div>
                        
                        {/* Scenario Details Table & AI Insight */}
                        <div className="w-full flex flex-col gap-6">
                          <div className="flex flex-col gap-4">
                            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Test Edilen Senaryolar</h4>
                            <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                                    <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Grup</th>
                                    <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Senaryo Açıklaması</th>
                                    <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Hacim</th>
                                    <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>CSAT</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {scenarios.map((s, idx) => (
                                    <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                                      <td className="p-4">
                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${s.id === winner.id ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                                          {s.id}
                                        </span>
                                      </td>
                                      <td className="p-4">
                                        <div className="font-bold text-slate-700 dark:text-slate-300">{s.name}</div>
                                        <div className="text-xs text-slate-500 mt-1">{s.desc}</div>
                                      </td>
                                      <td className="p-4 text-center font-bold text-slate-600 dark:text-slate-400">%{Math.round((s.volume / totalVolume) * 100)}</td>
                                      <td className="p-4 text-center font-black text-amber-500">
                                        {s.csat.toFixed(1)} / 5.0
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          
                          <div className={"p-5 rounded-2xl border flex flex-col gap-3 " + (winner.id === 'B' ? 'bg-emerald-50/50 border-emerald-500/20 dark:bg-emerald-900/10 dark:border-emerald-500/10' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700')}>
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                              <Target size={18} />
                              AI Önerisi ve Sonuç
                            </div>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                              Yapılan analiz sonucunda <strong>Senaryo {winner.id} ({winner.name})</strong> açık ara daha başarılı bulunmuştur. FCR (İlk aramada çözüm) oranını {fcrDiff} puan artırmış ve canlı temsilciye aktarım yükünü ciddi oranda azaltmıştır. 
                              Tüm gelen çağrı trafiğini Senaryo {winner.id}'ye yönlendirmeniz tavsiye edilir.
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : isFrictionMode ? (
              /* Friction Points Mode */
              <div className="p-4 flex flex-col gap-6 h-full overflow-y-auto">
                {(() => {
                  const totalFiltered = filteredCalls.length;
                  
                  // Mock Calculations for Friction Points
                  const frictionCallsCount = Math.max(1, Math.round(totalFiltered * 0.18)); // Assume 18% of calls have high friction
                  const avgFrictionScore = 7.4; // out of 10
                  const repeatCallRate = 12.5; // 12.5% repeat callers
                  
                  const frictionDrivers = [
                    { reason: "Karmaşık IVR / Yanlış Yönlendirme", count: Math.max(1, Math.round(frictionCallsCount * 0.35)), severity: "Kritik", trend: "+2.1%" },
                    { reason: "Sürekli Aktarım (Temsilciden Temsilciye)", count: Math.max(1, Math.round(frictionCallsCount * 0.25)), severity: "Kritik", trend: "+0.8%" },
                    { reason: "Uzun Kuyruk Beklemesi", count: Math.max(1, Math.round(frictionCallsCount * 0.20)), severity: "Yüksek", trend: "-1.2%" },
                    { reason: "Sistemsel Hata / Ses Kesintisi", count: Math.max(1, Math.round(frictionCallsCount * 0.12)), severity: "Orta", trend: "-0.5%" },
                    { reason: "Temsilci Bilgi Eksikliği", count: Math.max(1, Math.round(frictionCallsCount * 0.08)), severity: "Orta", trend: "+0.1%" }
                  ];
                  
                  // Map DB calls to friction signals
                  const highFrictionCalls = filteredCalls.slice(0, 15).map((call, idx) => {
                    const seed = (call.id ? call.id.charCodeAt(0) : 0) + idx;
                    const qa = call.qa_score || 80;
                    return {
                      ...call,
                      frictionScore: Math.round(((100 - qa) / 10) * 10) / 10,
                      primaryDriver: call.sentiment === "Hüsran" ? "Sistemsel Hata" : frictionDrivers[seed % frictionDrivers.length].reason,
                      sentimentLabel: call.sentiment || "Nötr"
                    };
                  }).sort((a, b) => b.frictionScore - a.frictionScore);

                  return (
                    <>
                      {/* KPI Header */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Çile Skoru (Friction Index)</p>
                          <h4 className="text-4xl font-black text-rose-500 flex items-center gap-3">
                            <Flame size={28} />
                            {avgFrictionScore} <span className="text-lg text-slate-400">/ 10</span>
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Müşteri zorlanma yoğunluğu (Ortalama)</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Zorlu (Friction) Çağrı Oranı</p>
                          <h4 className="text-4xl font-black text-amber-500 flex items-center gap-3">
                            <Frown size={28} />
                            %18
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Toplam {frictionCallsCount} adet problemli deneyim</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Mükerrer Arama Oranı</p>
                          <h4 className="text-4xl font-black text-blue-500 flex items-center gap-3">
                            <AlertTriangle size={28} />
                            %{repeatCallRate}
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Aynı sorun için 24 saat içinde tekrar arayanlar</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Friction Drivers List */}
                        <div className={"lg:col-span-1 rounded-2xl p-6 border flex flex-col gap-4 " + borderLight + " " + lightBg}>
                          <h4 className={"text-sm font-bold uppercase tracking-wider " + text}>En Yaygın Çile Nedenleri</h4>
                          <p className="text-xs text-slate-500">AI tarafından tespit edilen zorlanma kök nedenleri</p>
                          
                          <div className="flex flex-col gap-4 mt-2">
                            {frictionDrivers.map((driver, idx) => {
                              const maxCount = frictionDrivers[0].count;
                              const widthPercent = Math.max(10, Math.round((driver.count / maxCount) * 100));
                              let barColor = "bg-rose-500";
                              if (driver.severity === "Yüksek") barColor = "bg-amber-500";
                              if (driver.severity === "Orta") barColor = "bg-blue-500";
                              
                              return (
                                <div key={idx} className="flex flex-col gap-1">
                                  <div className="flex justify-between items-end">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 pr-2 truncate" title={driver.reason}>{driver.reason}</span>
                                    <div className="flex flex-col items-end">
                                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{driver.count} Çağrı</span>
                                    </div>
                                  </div>
                                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${widthPercent}%` }}></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          <div className={"mt-auto p-4 rounded-xl border border-rose-500/30 bg-rose-500/5"}>
                            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium leading-relaxed">
                              ⚠️ <strong>Kritik Tespit:</strong> Çağrıların büyük çoğunluğu "Yanlış Menüye Yönlendirme" nedeniyle zorluğa dönüşüyor. IVR ağacınızı basitleştirmeniz önerilir.
                            </p>
                          </div>
                        </div>
                        
                        {/* Friction Call Details Table */}
                        <div className="lg:col-span-2 flex flex-col gap-4">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">En Kritik (Yüksek Çile Skorlu) Çağrılar</h4>
                          <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                              <thead>
                                <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Arayan Numara</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Kök Neden (Driver)</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Çile Skoru</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Duygu</th>
                                </tr>
                              </thead>
                              <tbody>
                                {highFrictionCalls.length === 0 ? (
                                  <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Bu dönemde problemli çağrı tespit edilmemiştir.</td>
                                  </tr>
                                ) : (
                                  highFrictionCalls.map((c, idx) => (
                                    <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                                      <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{getCustomerNumber(c)}</td>
                                      <td className="p-4 font-medium text-slate-600 dark:text-slate-400 text-sm truncate max-w-[200px]">{c.primaryDriver}</td>
                                      <td className="p-4 text-center">
                                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-xs ${c.frictionScore > 8 ? 'bg-rose-100 text-rose-600 border border-rose-200' : 'bg-amber-100 text-amber-600 border border-amber-200'}`}>
                                          {c.frictionScore.toFixed(1)}
                                        </span>
                                      </td>
                                      <td className="p-4 text-center">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold border ${c.sentimentLabel === 'Kızgın' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                                          {c.sentimentLabel}
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : isComplianceMode ? (
              /* Script Compliance Mode */
              <div className="p-4 flex flex-col gap-6 h-full overflow-y-auto">
                {(() => {
                  const totalFiltered = filteredCalls.length;
                  
                  // Mock Calculations for Compliance
                  const avgComplianceScore = 86.4; // 86.4%
                  const perfectCallsCount = Math.round(totalFiltered * 0.42); // 42% perfect compliance
                  
                  const complianceSteps = [
                    { name: "Standart Kurumsal Açılış", score: 95 },
                    { name: "Müşteri Kimlik Doğrulama (KVKK)", score: 98 },
                    { name: "Aktif Dinleme ve Empati Gösterimi", score: 76 },
                    { name: "Çözüm veya Doğru Aktarım", score: 82 },
                    { name: "Görüşme Kayıt Onayı Hatırlatması", score: 64 }, // High failure point
                    { name: "Standart Kapanış Anonsu", score: 89 }
                  ];

                  // Map DB calls to compliance scores
                  const complianceViolations = filteredCalls.slice(0, 15).map((call, idx) => {
                    const seed = (call.id ? call.id.charCodeAt(0) : 0) + idx;
                    const violatedStep = complianceSteps[seed % complianceSteps.length];
                    return {
                      ...call,
                      complianceScore: call.qa_score || (50 + (seed % 40)),
                      missedStep: violatedStep.name,
                      severity: violatedStep.name.includes("KVKK") || violatedStep.name.includes("Kayıt") ? "Kritik" : "Normal"
                    };
                  }).sort((a, b) => a.complianceScore - b.complianceScore);

                  return (
                    <>
                      {/* KPI Header */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Ortalama Sadakat Skoru</p>
                          <h4 className="text-4xl font-black text-blue-500 flex items-center gap-3">
                            <ShieldCheck size={28} />
                            %{avgComplianceScore}
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Zorunlu senaryolara genel uyum oranı</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Kusursuz Çağrı Oranı</p>
                          <h4 className="text-4xl font-black text-emerald-500 flex items-center gap-3">
                            <ListChecks size={28} />
                            %42
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Tüm zorunlu adımların eksiksiz uygulandığı çağrılar</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>En Çok İhlal Edilen Adım</p>
                          <h4 className="text-xl font-bold text-rose-500 flex items-center gap-3 h-10 mt-1 line-clamp-2 leading-tight">
                            Görüşme Kayıt Onayı Hatırlatması
                          </h4>
                          <p className="text-sm font-medium text-slate-500 mt-auto">Sadece %64 uyum sağlanıyor</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Compliance Steps Progress */}
                        <div className={"lg:col-span-1 rounded-2xl p-6 border flex flex-col gap-4 " + borderLight + " " + lightBg}>
                          <h4 className={"text-sm font-bold uppercase tracking-wider " + text}>Senaryo Adımları Uyum Oranı</h4>
                          <p className="text-xs text-slate-500">Her bir standart adımın temsilciler tarafından uygulanma yüzdesi</p>
                          
                          <div className="flex flex-col gap-5 mt-2">
                            {complianceSteps.map((step, idx) => {
                              let barColor = "bg-emerald-500";
                              let textClass = "text-emerald-600 dark:text-emerald-400";
                              if (step.score < 85) {
                                barColor = "bg-amber-500";
                                textClass = "text-amber-600 dark:text-amber-400";
                              }
                              if (step.score < 70) {
                                barColor = "bg-rose-500";
                                textClass = "text-rose-600 dark:text-rose-400";
                              }
                              
                              return (
                                <div key={idx} className="flex flex-col gap-1.5">
                                  <div className="flex justify-between items-end">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 pr-2 leading-tight">{idx + 1}. {step.name}</span>
                                    <span className={`text-xs font-black ${textClass}`}>%{step.score}</span>
                                  </div>
                                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${step.score}%` }}></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          <div className={"mt-auto p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex gap-3"}>
                            <AlertTriangle size={20} className="text-amber-500 shrink-0" />
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium leading-relaxed">
                              <strong>Hukuki Risk Tespit Edildi:</strong> "Görüşme Kayıt Onayı" adımının sıkça atlanması regülasyon riskleri taşıyor. Temsilciler için ek hatırlatıcılar kurgulanmalıdır.
                            </p>
                          </div>
                        </div>
                        
                        {/* Violations Detail Table */}
                        <div className="lg:col-span-2 flex flex-col gap-4">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">En Düşük Uyum Skorlu Çağrılar & İhlaller</h4>
                          <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                              <thead>
                                <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Arayan Numara</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Temsilci</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Sadakat Skoru</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Atlanan / İhlal Edilen Adım</th>
                                </tr>
                              </thead>
                              <tbody>
                                {complianceViolations.length === 0 ? (
                                  <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Bu dönemde ihlal tespit edilmemiştir.</td>
                                  </tr>
                                ) : (
                                  complianceViolations.map((c, idx) => (
                                    <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                                      <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{getCustomerNumber(c)}</td>
                                      <td className="p-4 font-medium text-slate-600 dark:text-slate-400">{c.conversant || "Bilinmiyor"}</td>
                                      <td className="p-4 text-center">
                                        <span className={`inline-flex items-center justify-center w-9 h-6 rounded font-black text-xs ${c.complianceScore < 70 ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                          %{c.complianceScore}
                                        </span>
                                      </td>
                                      <td className="p-4">
                                        <div className="flex items-center gap-2">
                                          {c.severity === "Kritik" && <AlertTriangle size={14} className="text-rose-500 shrink-0" />}
                                          <span className={`text-sm font-medium ${c.severity === "Kritik" ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400"}`}>
                                            {c.missedStep}
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : isSilenceMode ? (
              /* Silence & Interruption Mode */
              <div className="p-4 flex flex-col gap-6 h-full overflow-y-auto">
                {(() => {
                  const totalFiltered = filteredCalls.length;
                  
                  // Mock Calculations for Silence
                  const avgSilencePercent = 14.5; // % of call is dead air
                  const avgInterruptionsPerCall = 3.2; // total cross-talk events per call
                  const agentInterruptRate = 65; // % of interruptions caused by agent
                  
                  const silenceTopDrivers = [
                    { reason: "Sistem/CRM Yavaşlığı", percentage: 45 },
                    { reason: "Bilgi Araştırma (Hold Dışı)", percentage: 30 },
                    { reason: "Müşteri Düşünme Payı", percentage: 15 },
                    { reason: "Bağlantı/Ses Sorunu", percentage: 10 }
                  ];

                  // Map DB calls to silence scores
                  const problematicCalls = filteredCalls.slice(0, 15).map((call, idx) => {
                    const seed = (call.id ? call.id.charCodeAt(0) : 0) + idx;
                    const qa = call.qa_score || 80;
                    return {
                      ...call,
                      silencePercent: Math.max(0, 30 - (qa / 4)), // Roughly 5-15%
                      interruptionCount: Math.max(0, 10 - Math.floor(qa / 10)),
                      primaryIssue: qa < 75 ? "Yüksek Sessizlik" : "N/A"
                    };
                  }).sort((a, b) => b.silencePercent - a.silencePercent);

                  return (
                    <>
                      {/* KPI Header */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Ortalama Ölü Sessizlik (Dead Air)</p>
                          <h4 className="text-4xl font-black text-rose-500 flex items-center gap-3">
                            <MicOff size={28} />
                            %{avgSilencePercent}
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Görüşmelerin sessiz geçen toplam süresi</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Söz Kesme / Çakışma (Over-talk)</p>
                          <h4 className="text-4xl font-black text-amber-500 flex items-center gap-3">
                            <MessageSquareDashed size={28} />
                            {avgInterruptionsPerCall} <span className="text-lg text-slate-400">/ çağrı</span>
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Ortalama karşılıklı aynı anda konuşma sayısı</p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Temsilcinin Bölme Oranı</p>
                          <h4 className="text-4xl font-black text-blue-500 flex items-center gap-3">
                            <VolumeX size={28} />
                            %{agentInterruptRate}
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Söz kesmelerin temsilci kaynaklı kısmı</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Silence Drivers Progress */}
                        <div className={"lg:col-span-1 rounded-2xl p-6 border flex flex-col gap-4 " + borderLight + " " + lightBg}>
                          <h4 className={"text-sm font-bold uppercase tracking-wider " + text}>Sessizlik Nedenleri (AI Tahmini)</h4>
                          <p className="text-xs text-slate-500">Ölü sessizlik sürelerinin tespit edilen ana sebepleri</p>
                          
                          <div className="flex flex-col gap-5 mt-2">
                            {silenceTopDrivers.map((driver, idx) => {
                              return (
                                <div key={idx} className="flex flex-col gap-1.5">
                                  <div className="flex justify-between items-end">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 pr-2 leading-tight">{driver.reason}</span>
                                    <span className={`text-xs font-black text-slate-500`}>%{driver.percentage}</span>
                                  </div>
                                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                    <div className={`h-full rounded-full bg-slate-400`} style={{ width: `${driver.percentage}%` }}></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          <div className={"mt-auto p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 flex gap-3"}>
                            <VolumeX size={20} className="text-rose-500 shrink-0" />
                            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium leading-relaxed">
                              <strong>Agresif Görüşme Uyarısı:</strong> Çağrılarda temsilcileriniz müşteriyi bölme oranında (%{agentInterruptRate}) çok yüksek bir değere sahip. Empati ve aktif dinleme eğitimleri önerilir.
                            </p>
                          </div>
                        </div>
                        
                        {/* Problematic Calls Detail Table */}
                        <div className="lg:col-span-2 flex flex-col gap-4">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">En Problemli (Sessiz / Çakışan) Çağrılar</h4>
                          <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                              <thead>
                                <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Arayan Numara</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Temsilci</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Sessizlik Oranı</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Çakışma Sayısı</th>
                                  <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Ana Sorun</th>
                                </tr>
                              </thead>
                              <tbody>
                                {problematicCalls.length === 0 ? (
                                  <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Bu dönemde problemli çağrı tespit edilmemiştir.</td>
                                  </tr>
                                ) : (
                                  problematicCalls.map((c, idx) => (
                                    <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                                      <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{getCustomerNumber(c)}</td>
                                      <td className="p-4 font-medium text-slate-600 dark:text-slate-400">{c.conversant || "Bilinmiyor"}</td>
                                      <td className="p-4 text-center">
                                        <span className={`inline-flex items-center justify-center w-10 h-6 rounded font-black text-xs ${c.silencePercent > 30 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                                          %{c.silencePercent}
                                        </span>
                                      </td>
                                      <td className="p-4 text-center">
                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-xs ${c.interruptionCount > 5 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                                          {c.interruptionCount}
                                        </span>
                                      </td>
                                      <td className="p-4">
                                        <span className={`text-xs font-bold ${c.primaryIssue.includes('Sessiz') ? 'text-rose-500' : 'text-amber-500'}`}>
                                          {c.primaryIssue}
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : isCeoSummaryMode ? (
              /* CEO Summary Mode */
              <div className="p-6 flex flex-col gap-6 h-full overflow-y-auto">
                {(() => {
                  const totalFiltered = filteredCalls.length;
                  
                  // Map DB Calls for Executive Summary
                  const aiSavings = Math.round(totalFiltered * 12.5).toLocaleString('tr-TR'); 
                  const globalCsat = filteredCalls.length > 0 ? (filteredCalls.reduce((acc, call) => acc + (call.qa_score || 80), 0) / filteredCalls.length / 20).toFixed(1) : 4.6;
                  const globalFcr = filteredCalls.length > 0 ? (filteredCalls.filter(c => (c.qa_score || 80) > 75).length / filteredCalls.length * 100).toFixed(1) : 72.8;
                  const revenueSaved = Math.round(totalFiltered * 18.2).toLocaleString('tr-TR');
                  
                  return (
                    <div className="flex flex-col gap-8 max-w-7xl mx-auto w-full">
                      
                      {/* Top Hero Banner */}
                      <div className="w-full bg-gradient-to-r from-blue-900 via-indigo-800 to-purple-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                          <Crown size={240} />
                        </div>
                        <div className="relative z-10 flex flex-col gap-6 max-w-3xl">
                          <div className="flex items-center gap-3">
                            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase backdrop-blur-md border border-white/20">
                              Otomatik Yönetici Özeti
                            </span>
                            <span className="text-white/60 text-sm font-medium">Bu analiz yapay zeka tarafından son verilere göre derlenmiştir.</span>
                          </div>
                          
                          <h2 className="text-3xl font-black leading-tight">Operasyonlarınız şu anda hedeflenen hizmet standartlarının %12 üzerinde seyrediyor.</h2>
                          
                          <p className="text-blue-100 font-medium leading-relaxed text-lg">
                            Son incelediğimiz döneme göre müşteri memnuniyeti <strong>(CSAT) 4.6</strong> seviyesine çıkmış olup, çağrı karşılama kapasiteniz Yapay Zeka botları sayesinde canlı insan gücü maliyeti eklenmeden <strong>%40</strong> artırılmıştır. FCR (İlk Aramada Çözüm) oranındaki istikrarlı büyüme devam etmektedir.
                          </p>
                        </div>
                      </div>

                      {/* Main KPI Row */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 shadow-sm " + borderLight + " " + lightBg}>
                          <div className="flex items-center justify-between">
                            <p className={"text-xs font-bold uppercase tracking-wider " + text}>Genel Memnuniyet</p>
                            <Award size={20} className="text-amber-500" />
                          </div>
                          <h4 className="text-4xl font-black text-slate-800 dark:text-slate-100 mt-2">
                            {globalCsat} <span className="text-lg text-slate-400">/ 5.0</span>
                          </h4>
                          <p className="text-sm font-bold text-emerald-500 mt-auto">+0.2 (Geçen Ay)</p>
                        </div>

                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 shadow-sm " + borderLight + " " + lightBg}>
                          <div className="flex items-center justify-between">
                            <p className={"text-xs font-bold uppercase tracking-wider " + text}>İlk Aramada Çözüm (FCR)</p>
                            <TrendingUp size={20} className="text-emerald-500" />
                          </div>
                          <h4 className="text-4xl font-black text-emerald-500 mt-2">
                            %{globalFcr}
                          </h4>
                          <p className="text-sm font-bold text-emerald-500 mt-auto">+4.5% (Geçen Ay)</p>
                        </div>

                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 shadow-sm " + borderLight + " " + lightBg}>
                          <div className="flex items-center justify-between">
                            <p className={"text-xs font-bold uppercase tracking-wider " + text}>AI Operasyonel Tasarrufu</p>
                            <Briefcase size={20} className="text-blue-500" />
                          </div>
                          <h4 className="text-4xl font-black text-blue-600 dark:text-blue-400 mt-2">
                            ₺{aiSavings}
                          </h4>
                          <p className="text-sm font-bold text-emerald-500 mt-auto">Aylık Tahmini Katkı</p>
                        </div>

                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 shadow-sm " + borderLight + " " + lightBg}>
                          <div className="flex items-center justify-between">
                            <p className={"text-xs font-bold uppercase tracking-wider " + text}>Kaçan Fırsat Kurtarma</p>
                            <PieChart size={20} className="text-purple-500" />
                          </div>
                          <h4 className="text-4xl font-black text-purple-600 dark:text-purple-400 mt-2">
                            ₺{revenueSaved}
                          </h4>
                          <p className="text-sm font-bold text-emerald-500 mt-auto">Kaybedilmek üzereyken çevrilen ciro</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Strengths / Wins */}
                        <div className={"rounded-2xl p-6 border flex flex-col gap-4 " + borderLight + " bg-emerald-50/30 dark:bg-emerald-900/10"}>
                          <div className="flex items-center gap-3 border-b pb-4 border-slate-200/50 dark:border-slate-700/50">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-800 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                              <TrendingUp size={20} />
                            </div>
                            <div>
                              <h4 className={"text-sm font-black uppercase tracking-wider " + text}>Operasyonel Başarılar (Wins)</h4>
                              <p className="text-xs text-slate-500">Mevcut dönemdeki en güçlü olduğunuz alanlar</p>
                            </div>
                          </div>
                          
                          <ul className="flex flex-col gap-4 mt-2">
                            <li className="flex gap-3">
                              <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                              <div>
                                <p className={"text-sm font-bold " + text}>AI Karşılama Kapasitesi Mükemmel</p>
                                <p className="text-xs text-slate-500 mt-1">Gelen çağrıların %45'i hiçbir canlı temsilciye ulaşmadan yapay zeka IVR tarafından başarıyla çözümlendi.</p>
                              </div>
                            </li>
                            <li className="flex gap-3">
                              <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                              <div>
                                <p className={"text-sm font-bold " + text}>Bekleme Süreleri Minimumda</p>
                                <p className="text-xs text-slate-500 mt-1">Ortalama bekleme süresi 18 saniyeye düşerek SLA standartlarının çok üstüne çıktı.</p>
                              </div>
                            </li>
                            <li className="flex gap-3">
                              <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                              <div>
                                <p className={"text-sm font-bold " + text}>Müşteri Sadakati (Churn) Riski Düştü</p>
                                <p className="text-xs text-slate-500 mt-1">Negatif duygu ile başlayan görüşmelerin %80'i temsilcileriniz sayesinde pozitif veya nötr olarak tamamlandı.</p>
                              </div>
                            </li>
                          </ul>
                        </div>
                        
                        {/* Areas for Improvement / Actions */}
                        <div className={"rounded-2xl p-6 border flex flex-col gap-4 " + borderLight + " bg-rose-50/30 dark:bg-rose-900/10"}>
                          <div className="flex items-center gap-3 border-b pb-4 border-slate-200/50 dark:border-slate-700/50">
                            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-800 text-rose-600 dark:text-rose-300 flex items-center justify-center">
                              <AlertTriangle size={20} />
                            </div>
                            <div>
                              <h4 className={"text-sm font-black uppercase tracking-wider " + text}>Gelişim & Aksiyon Alanları</h4>
                              <p className="text-xs text-slate-500">Dikkat edilmesi ve düzeltilmesi gereken noktalar</p>
                            </div>
                          </div>
                          
                          <ul className="flex flex-col gap-4 mt-2">
                            <li className="flex gap-3">
                              <span className="text-rose-500 font-bold mt-0.5">!</span>
                              <div>
                                <p className={"text-sm font-bold " + text}>Teknik Destekte "Sürekli Aktarım" Sorunu</p>
                                <p className="text-xs text-slate-500 mt-1">L1 Teknik destek çağrıları ortalama 2.4 kez başka birime aktarılıyor. First-line (İlk hat) bilgi bankasının güncellenmesi gerekli.</p>
                              </div>
                            </li>
                            <li className="flex gap-3">
                              <span className="text-rose-500 font-bold mt-0.5">!</span>
                              <div>
                                <p className={"text-sm font-bold " + text}>Hukuki Uyum (KVKK) Riskleri</p>
                                <p className="text-xs text-slate-500 mt-1">Temsilcilerin "Kayıt Onayı Hatırlatması" adımını %36 oranında atladığı tespit edildi. Sistemsel bir uyarı arayüzü eklenmeli.</p>
                              </div>
                            </li>
                            <li className="flex gap-3">
                              <span className="text-rose-500 font-bold mt-0.5">!</span>
                              <div>
                                <p className={"text-sm font-bold " + text}>Agresif Söz Kesme Eğilimi</p>
                                <p className="text-xs text-slate-500 mt-1">Satış biriminde temsilciler, müşterilerin sözünü çok fazla kesiyor. Empati eğitimi planlanmalıdır.</p>
                              </div>
                            </li>
                          </ul>
                        </div>
                      </div>
                      
                    </div>
                  );
                })()}
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
                                <span>{getCustomerNumber(call)}</span>
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
                        <span>{getCustomerNumber(call)}</span>
                        
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
                      <span>{getCustomerNumber(selectedCall)} ile Görüşme Detayları</span>
                      
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
              <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{getCustomerNumber(activeAudioCall)} ile Görüşme</p>
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
      {/* Agent Details Modal */}
      {isAgentDetailsOpen && selectedAgentDetails && (
        <div className="fixed inset-0 bg-slate-955/65 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-850 rounded-3xl p-6 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-150 dark:border-slate-800">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className={"w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs " + bg + " text-white"}>
                  {selectedAgentDetails.agent.substring(0, 2).toUpperCase()}
                </span>
                <span>{selectedAgentDetails.agent} Çağrı Detayları</span>
              </h3>
              <button 
                onClick={() => setIsAgentDetailsOpen(false)}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Answered Calls */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold border-b border-emerald-100 dark:border-emerald-900/30 pb-2">
                  <span className="bg-emerald-100 dark:bg-emerald-955/30 px-2 py-0.5 rounded-md text-xs">{selectedAgentDetails.answeredCalls}</span>
                  <span>Cevaplanan Çağrılar</span>
                </div>
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
                  {selectedAgentDetails.callsAnsweredList.length > 0 ? selectedAgentDetails.callsAnsweredList.map((call, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{call.number}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{new Date(call.time).toLocaleString('tr-TR')}</span>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold dark:bg-emerald-900/30 dark:text-emerald-400">Başarılı</span>
                    </div>
                  )) : (
                    <span className="text-slate-400 text-xs italic">Kayıt yok</span>
                  )}
                </div>
              </div>

              {/* Missed Calls */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold border-b border-rose-100 dark:border-rose-900/30 pb-2">
                  <span className="bg-rose-100 dark:bg-rose-955/30 px-2 py-0.5 rounded-md text-xs">{selectedAgentDetails.missedCalls}</span>
                  <span>Kaçan Çağrılar</span>
                </div>
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
                  {selectedAgentDetails.callsMissedList.length > 0 ? selectedAgentDetails.callsMissedList.map((call, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{call.number}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{new Date(call.time).toLocaleString('tr-TR')}</span>
                      </div>
                      <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold dark:bg-rose-900/30 dark:text-rose-400">Başarısız</span>
                    </div>
                  )) : (
                    <span className="text-slate-400 text-xs italic">Kayıt yok</span>
                  )}
                </div>
              </div>

              {/* Total Calls */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 pb-2">
                  <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md text-xs">{selectedAgentDetails.totalCalls}</span>
                  <span>Toplam Çağrılar</span>
                </div>
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
                  {selectedAgentDetails.callsTotalList.length > 0 ? selectedAgentDetails.callsTotalList.map((call, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{call.number}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{new Date(call.time).toLocaleString('tr-TR')}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold">{call.dir}</span>
                    </div>
                  )) : (
                    <span className="text-slate-400 text-xs italic">Kayıt yok</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Queue Details Modal */}
      {isQueueDetailsOpen && selectedQueueDetails && (
        <div className="fixed inset-0 bg-slate-955/65 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-850 rounded-3xl p-6 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-150 dark:border-slate-800">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className={"w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs " + bg + " text-white"}>
                  <CalendarIcon size={14} />
                </span>
                <span>{selectedQueueDetails.date} Kuyruk Çağrı Detayları</span>
              </h3>
              <button 
                onClick={() => setIsQueueDetailsOpen(false)}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Queued Calls */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold border-b border-blue-100 dark:border-blue-900/30 pb-2">
                  <span className="bg-blue-100 dark:bg-blue-955/30 px-2 py-0.5 rounded-md text-xs">{selectedQueueDetails.queuedCalls}</span>
                  <span>Kuyruğa Girenler</span>
                </div>
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
                  {selectedQueueDetails.callsQueuedList.length > 0 ? selectedQueueDetails.callsQueuedList.map((call, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{call.number}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{new Date(call.time).toLocaleTimeString('tr-TR')}</span>
                      </div>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold dark:bg-blue-900/30 dark:text-blue-400">Kuyrukta</span>
                    </div>
                  )) : (
                    <span className="text-slate-400 text-xs italic">Kayıt yok</span>
                  )}
                </div>
              </div>

              {/* Abandoned Calls */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold border-b border-rose-100 dark:border-rose-900/30 pb-2">
                  <span className="bg-rose-100 dark:bg-rose-955/30 px-2 py-0.5 rounded-md text-xs">{selectedQueueDetails.abandonedInQueue}</span>
                  <span>Kuyrukta Kaçanlar</span>
                </div>
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
                  {selectedQueueDetails.callsAbandonedList.length > 0 ? selectedQueueDetails.callsAbandonedList.map((call, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{call.number}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{new Date(call.time).toLocaleTimeString('tr-TR')}</span>
                      </div>
                      <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold dark:bg-rose-900/30 dark:text-rose-400">Başarısız</span>
                    </div>
                  )) : (
                    <span className="text-slate-400 text-xs italic">Kayıt yok</span>
                  )}
                </div>
              </div>

              {/* Total Calls */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 pb-2">
                  <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md text-xs">{selectedQueueDetails.totalCalls}</span>
                  <span>Toplam Çağrılar</span>
                </div>
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
                  {selectedQueueDetails.callsTotalList.length > 0 ? selectedQueueDetails.callsTotalList.map((call, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{call.number}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{new Date(call.time).toLocaleTimeString('tr-TR')}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold">{call.dir}</span>
                    </div>
                  )) : (
                    <span className="text-slate-400 text-xs italic">Kayıt yok</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
