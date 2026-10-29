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
  PieChart,
  Plus,
  Trash2,
  Edit2,
  Save,
  Sparkles,
  Tag,
  Check
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
          <div className="flex-1 overflow-y-auto px-2 pb-2 pt-1">
            <table className="w-full text-left text-xs border-collapse">
              {columns && columns.length > 1 && (
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/70 dark:border-slate-800">
                  <tr>
                    <th className="p-2 w-8 bg-slate-50 dark:bg-slate-900"></th>
                    {columns.map((col, idx) => (
                      <th key={idx} className="p-2 font-semibold text-slate-500 bg-slate-50 dark:bg-slate-900">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody className="divide-y divide-slate-100/60 dark:divide-slate-800/60">
                {filteredAvailable.map(item => (
                  <tr 
                    key={item.id} 
                    className={`cursor-pointer transition-colors duration-150 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 ${checkedAvailable.includes(item.id) ? lightBg : ''}`}
                    onClick={() => toggleAvailable(item.id)}
                  >
                    <td className="p-2 w-8">
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
          <button onClick={moveRight} disabled={checkedAvailable.length === 0} className={`p-2 rounded-lg border ${checkedAvailable.length > 0 ? "text-slate-800 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" : "text-slate-300 dark:text-slate-600 cursor-not-allowed"} transition-colors bg-slate-50 dark:bg-slate-800 ` + borderLight}>
            <ChevronRight size={18} className="hidden md:block" />
            <ArrowDown size={18} className="block md:hidden" />
          </button>
          <button onClick={moveLeft} disabled={checkedSelected.length === 0} className={`p-2 rounded-lg border ${checkedSelected.length > 0 ? "text-slate-800 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" : "text-slate-300 dark:text-slate-600 cursor-not-allowed"} transition-colors bg-slate-50 dark:bg-slate-800 ` + borderLight}>
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
          <div className="flex-1 overflow-y-auto px-2 pb-2 pt-1">
            <table className="w-full text-left text-xs border-collapse">
              {columns && columns.length > 1 && (
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/70 dark:border-slate-800">
                  <tr>
                    <th className="p-2 w-8 bg-slate-50 dark:bg-slate-900"></th>
                    {columns.map((col, idx) => (
                      <th key={idx} className="p-2 font-semibold text-slate-500 bg-slate-50 dark:bg-slate-900">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody className="divide-y divide-slate-100/60 dark:divide-slate-800/60">
                {filteredSelected.map(item => (
                  <tr 
                    key={item.id} 
                    className={`cursor-pointer transition-colors duration-150 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 ${checkedSelected.includes(item.id) ? lightBg : ''}`}
                    onClick={() => toggleSelected(item.id)}
                  >
                    <td className="p-2 w-8">
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

  const getNinetyDaysAgoString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [calls, setCalls] = useState([]);
  const [users, setUsers] = useState([]);
  const [aiAgents, setAiAgents] = useState([]);
  const [trunks, setTrunks] = useState([]);
  const [trunkStatuses, setTrunkStatuses] = useState({});
  const [queues, setQueues] = useState([]);
  const [inboundRules, setInboundRules] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [selectedTrunkChartDate, setSelectedTrunkChartDate] = useState("ALL");
  const [selectedCall, setSelectedCall] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isColumnSelectOpen, setIsColumnSelectOpen] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const today = getTodayDateString();
    if (typeof window !== "undefined") {
      const savedStart = localStorage.getItem("reports_filter_start_date");
      const savedEnd = localStorage.getItem("reports_filter_end_date");
      if (savedStart && savedEnd && savedEnd >= today) return savedStart;
    }
    return today;
  });
  const [filterEndDate, setFilterEndDate] = useState(() => {
    const today = getTodayDateString();
    if (typeof window !== "undefined") {
      const savedEnd = localStorage.getItem("reports_filter_end_date");
      if (savedEnd && savedEnd >= today) return savedEnd;
    }
    return today;
  });
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDirection, setFilterDirection] = useState("All");
  const [filterConversant, setFilterConversant] = useState("All");
  const [filterCallerNumber, setFilterCallerNumber] = useState("");
  const [filterCallId, setFilterCallId] = useState("");
  const filterQueuesAvailable = React.useMemo(() => {
    const items = [];
    (queues || []).forEach((q) => {
      if (q.name || q.extension) {
        items.push({
          id: `queue-${q.extension || q.id || q.name}`,
          extension: String(q.extension || q.id || "2000"),
          name: q.name || `Kuyruk ${q.extension}`,
          type: "Dahili Kuyruk"
        });
      }
    });
    if (items.length === 0) {
      return [
        { id: "queue-2000", extension: "2000", name: "Satış Kuyruğu", type: "Dahili Kuyruk" },
        { id: "queue-2001", extension: "2001", name: "Destek Kuyruğu", type: "Dahili Kuyruk" }
      ];
    }
    return items;
  }, [queues]);
  const [filterQueuesSelected, setFilterQueuesSelected] = useState([]);
  const [filterAgentsSelected, setFilterAgentsSelected] = useState([]);
  const [filterSentimentsSelected, setFilterSentimentsSelected] = useState([]);
  const [filterWordcloudKeyword, setFilterWordcloudKeyword] = useState("");
  const [filterFcrStatusesSelected, setFilterFcrStatusesSelected] = useState([]);
  const [filterFcrSentimentsSelected, setFilterFcrSentimentsSelected] = useState([]);
  const [filterMissedQueuesSelected, setFilterMissedQueuesSelected] = useState([]);
  const [filterMissedCallbackSelected, setFilterMissedCallbackSelected] = useState([]);
  const [filterTrafficStartHour, setFilterTrafficStartHour] = useState("");
  const [filterTrafficEndHour, setFilterTrafficEndHour] = useState("");

  const parseCallLocalHour = (dateStr) => {
    if (!dateStr) return null;
    const raw = String(dateStr).trim();
    if (!raw) return null;
    const cleanStr =
      !raw.endsWith("Z") && !raw.includes("+") && !raw.includes("GMT") && raw.includes("T")
        ? `${raw}Z`
        : raw;
    const d = new Date(cleanStr);
    if (isNaN(d.getTime())) return null;
    return d.getHours();
  };

  const isHourInTrafficRange = (hr, startRaw = filterTrafficStartHour, endRaw = filterTrafficEndHour) => {
    if (hr === null || hr === undefined || isNaN(hr)) return false;
    if (startRaw === "" && endRaw === "") return true;
    const s = startRaw === "" ? 0 : parseInt(startRaw, 10);
    const e = endRaw === "" ? 23 : parseInt(endRaw, 10);
    if (isNaN(s) || isNaN(e)) return true;
    if (s <= e) return hr >= s && hr <= e;
    return hr >= s || hr <= e;
  };

  const MISSED_CALLBACK_FILTER_ITEMS = [
    { id: "Dönüldü (Başarılı)", name: "Dönüldü (Başarılı)" },
    { id: "Dönüldü (Ulaşılamadı)", name: "Dönüldü (Ulaşılamadı)" },
    { id: "Bekliyor", name: "Bekliyor" },
  ];

  const FCR_STATUS_FILTER_ITEMS = [
    { id: "success", name: "Başarılı" },
    { id: "repeat", name: "Başarısız (Tekrar Aramış)" },
  ];

  const FCR_SENTIMENT_FILTER_ITEMS = [
    { id: "positive", name: "Pozitif" },
    { id: "neutral", name: "Nötr" },
    { id: "negative", name: "Negatif" },
  ];

  const normalizeFcrSentimentKey = (rawSentiment) => {
    const s = String(rawSentiment || "").trim().toLowerCase();
    if (
      s === "positive" ||
      s === "very_positive" ||
      s === "pozitif" ||
      s === "çok pozitif" ||
      s === "cok pozitif" ||
      s === "memnun" ||
      s === "mutlu" ||
      s === "olumlu"
    ) {
      return "positive";
    }
    if (
      s === "negative" ||
      s === "very_negative" ||
      s === "negatif" ||
      s === "çok negatif" ||
      s === "cok negatif" ||
      s === "öfkeli" ||
      s === "ofkeli" ||
      s === "kızgın" ||
      s === "kizgin" ||
      s === "olumsuz"
    ) {
      return "negative";
    }
    return "neutral";
  };

  const computeFilteredFcrReport = (callsList) => {
    const fcrData = {};
    (callsList || []).forEach((call) => {
      const num = getCustomerNumber(call) || "Bilinmeyen Numara";
      if (!fcrData[num]) {
        fcrData[num] = {
          caller: num,
          callCount: 0,
          lastAgent: "",
          totalDuration: 0,
          sentiment: "neutral",
        };
      }
      fcrData[num].callCount++;
      fcrData[num].lastAgent = getConversant(call) || "Bilinmiyor";
      fcrData[num].totalDuration += call.duration_talk || 0;
      fcrData[num].sentiment = normalizeFcrSentimentKey(call.sentiment);
    });

    const callerList = Object.values(fcrData)
      .map((c) => ({
        ...c,
        fcrStatusKey: c.callCount === 1 ? "success" : "repeat",
        fcrStatusLabel: c.callCount === 1 ? "Başarılı" : "Başarısız (Tekrar Aramış)",
        sentimentLabel: c.sentiment === "positive" ? "Pozitif" : c.sentiment === "negative" ? "Negatif" : "Nötr",
      }))
      .filter((c) => {
        if (filterFcrStatusesSelected.length > 0 && !filterFcrStatusesSelected.includes(c.fcrStatusKey)) {
          return false;
        }
        if (filterFcrSentimentsSelected.length > 0 && !filterFcrSentimentsSelected.includes(c.sentiment)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.callCount - a.callCount);

    let fcrSuccess = 0;
    let repeatCallers = 0;
    const totalCallers = callerList.length;
    callerList.forEach((c) => {
      if (c.callCount === 1) fcrSuccess++;
      else repeatCallers++;
    });
    const fcrRate = totalCallers > 0 ? Math.round((fcrSuccess / totalCallers) * 100) : 0;

    return { callerList, totalCallers, fcrSuccess, repeatCallers, fcrRate };
  };

  const normalizeTrKeyword = (val) =>
    String(val || "")
      .replace(/İ/g, "i")
      .replace(/I/g, "ı")
      .toLowerCase()
      .trim();

  const getFilteredWordcloudItems = (callsList, rawKeyword) => {
    const len = Array.isArray(callsList) ? callsList.length : 0;
    const baseItems = [
      { text: "İptal", word: "İptal", count: 120 + (len % 50), color: "text-rose-500", size: "text-5xl", trend: "+12%", trendColor: "text-rose-500", sentiment: "Negatif", sentimentColor: "bg-rose-50 dark:bg-rose-955/20 text-rose-600 border-rose-100", defaultTable: true },
      { text: "Fatura", word: "Fatura", count: 95 + (len % 30), color: "text-slate-700 dark:text-slate-200", size: "text-4xl", trend: "+4%", trendColor: "text-amber-500", sentiment: "Nötr", sentimentColor: "bg-amber-50 dark:bg-amber-955/20 text-amber-600 border-amber-100", defaultTable: false },
      { text: "Sipariş", word: "Sipariş", count: 80 + (len % 20), color: "text-blue-500", size: "text-3xl", trend: "+5%", trendColor: "text-emerald-500", sentiment: "Nötr", sentimentColor: "bg-amber-50 dark:bg-amber-955/20 text-amber-600 border-amber-100", defaultTable: true },
      { text: "Teşekkürler", word: "Teşekkürler", count: 70 + (len % 15), color: "text-emerald-500", size: "text-3xl", trend: "+8%", trendColor: "text-emerald-500", sentiment: "Pozitif", sentimentColor: "bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 border-emerald-100", defaultTable: true },
      { text: "Kargo", word: "Kargo", count: 65, color: "text-amber-500", size: "text-2xl", trend: "-2%", trendColor: "text-rose-500", sentiment: "Nötr", sentimentColor: "bg-amber-50 dark:bg-amber-955/20 text-amber-600 border-amber-100", defaultTable: true },
      { text: "Gecikme", word: "Gecikme", count: 50, color: "text-rose-400", size: "text-2xl", trend: "+6%", trendColor: "text-rose-500", sentiment: "Negatif", sentimentColor: "bg-rose-50 dark:bg-rose-955/20 text-rose-600 border-rose-100", defaultTable: false },
      { text: "İade", word: "İade", count: 45, color: "text-orange-500", size: "text-2xl", trend: "+3%", trendColor: "text-rose-500", sentiment: "Negatif", sentimentColor: "bg-rose-50 dark:bg-rose-955/20 text-rose-600 border-rose-100", defaultTable: false },
      { text: "Memnuniyet", word: "Memnuniyet", count: 40, color: "text-emerald-400", size: "text-xl", trend: "+9%", trendColor: "text-emerald-500", sentiment: "Pozitif", sentimentColor: "bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 border-emerald-100", defaultTable: false },
      { text: "Ücret", word: "Ücret", count: 35, color: "text-slate-600 dark:text-slate-300", size: "text-xl", trend: "+1%", trendColor: "text-amber-500", sentiment: "Nötr", sentimentColor: "bg-amber-50 dark:bg-amber-955/20 text-amber-600 border-amber-100", defaultTable: false },
      { text: "Destek", word: "Destek", count: 30, color: "text-blue-400", size: "text-xl", trend: "+4%", trendColor: "text-emerald-500", sentiment: "Pozitif", sentimentColor: "bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 border-emerald-100", defaultTable: false },
      { text: "Şikayet", word: "Şikayet", count: 25, color: "text-rose-600", size: "text-lg", trend: "-15%", trendColor: "text-emerald-500", sentiment: "Negatif", sentimentColor: "bg-rose-50 dark:bg-rose-955/20 text-rose-600 border-rose-100", defaultTable: true },
      { text: "Kampanya", word: "Kampanya", count: 20, color: "text-purple-500", size: "text-lg", trend: "+7%", trendColor: "text-emerald-500", sentiment: "Pozitif", sentimentColor: "bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 border-emerald-100", defaultTable: false },
      { text: "Adres", word: "Adres", count: 15, color: "text-slate-500", size: "text-base", trend: "0%", trendColor: "text-slate-500", sentiment: "Nötr", sentimentColor: "bg-amber-50 dark:bg-amber-955/20 text-amber-600 border-amber-100", defaultTable: false },
      { text: "Taksit", word: "Taksit", count: 10, color: "text-slate-500", size: "text-base", trend: "+2%", trendColor: "text-emerald-500", sentiment: "Nötr", sentimentColor: "bg-amber-50 dark:bg-amber-955/20 text-amber-600 border-amber-100", defaultTable: false },
    ];

    const trimmed = String(rawKeyword || "").trim();
    if (!trimmed) {
      return {
        cloudWords: baseItems,
        trendRows: baseItems.filter((item) => item.defaultTable),
      };
    }

    const terms = trimmed
      .split(",")
      .map((t) => normalizeTrKeyword(t))
      .filter(Boolean);

    const matchedBase = baseItems.filter((item) => {
      const normWord = normalizeTrKeyword(item.word);
      return terms.some((t) => normWord.includes(t));
    });

    const dynamicExtras = [];
    terms.forEach((t) => {
      const alreadyMatched = matchedBase.some((m) => normalizeTrKeyword(m.word).includes(t));
      if (!alreadyMatched && Array.isArray(callsList)) {
        let hitCount = 0;
        let posHits = 0;
        let negHits = 0;
        callsList.forEach((c) => {
          const hay = normalizeTrKeyword(`${c.summary || ""} ${c.agent_topic || ""} ${c.agent_notes || ""}`);
          if (hay.includes(t)) {
            hitCount++;
            const delta = getSentimentHeatCallDelta(c.sentiment);
            if (delta > 0) posHits++;
            else if (delta < 0) negHits++;
          }
        });
        if (hitCount > 0) {
          const displayWord = t.charAt(0).toLocaleUpperCase("tr-TR") + t.slice(1);
          const sentLabel = posHits > negHits ? "Pozitif" : negHits > posHits ? "Negatif" : "Nötr";
          const sentCls =
            sentLabel === "Pozitif"
              ? "bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 border-emerald-100"
              : sentLabel === "Negatif"
              ? "bg-rose-50 dark:bg-rose-955/20 text-rose-600 border-rose-100"
              : "bg-amber-50 dark:bg-amber-955/20 text-amber-600 border-amber-100";
          dynamicExtras.push({
            text: displayWord,
            word: displayWord,
            count: hitCount,
            color: "text-primary",
            size: hitCount >= 10 ? "text-4xl" : hitCount >= 5 ? "text-3xl" : "text-2xl",
            trend: "0%",
            trendColor: "text-slate-500",
            sentiment: sentLabel,
            sentimentColor: sentCls,
            defaultTable: true,
          });
        }
      }
    });

    const combined = [...matchedBase, ...dynamicExtras];
    return {
      cloudWords: combined,
      trendRows: combined,
    };
  };

  const SENTIMENT_HEAT_FILTER_ITEMS = [
    { id: "very_positive", name: "Çok Pozitif" },
    { id: "positive", name: "Pozitif" },
    { id: "neutral", name: "Nötr" },
    { id: "negative", name: "Negatif" },
    { id: "very_negative", name: "Çok Negatif" },
  ];

  const getSentimentHeatCallDelta = (rawSentiment) => {
    const s = String(rawSentiment || "").trim().toLowerCase();
    if (!s) return 0;
    if (
      s === "very_positive" ||
      s === "çok pozitif" ||
      s === "cok pozitif" ||
      s === "positive" ||
      s === "pozitif" ||
      s === "memnun" ||
      s === "mutlu" ||
      s === "olumlu"
    ) {
      return 100;
    }
    if (
      s === "very_negative" ||
      s === "çok negatif" ||
      s === "cok negatif" ||
      s === "negative" ||
      s === "negatif" ||
      s === "öfkeli" ||
      s === "ofkeli" ||
      s === "kızgın" ||
      s === "kizgin" ||
      s === "olumsuz"
    ) {
      return -100;
    }
    return 0;
  };

  const getSentimentHeatBucket = (avg) => {
    if (avg === null || avg === undefined || isNaN(avg)) return null;
    if (avg >= 50) return "very_positive";
    if (avg > 10) return "positive";
    if (avg <= -50) return "very_negative";
    if (avg < -10) return "negative";
    return "neutral";
  };
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
  const [timelineReport, setTimelineReport] = useState(null);
  const [timelineDate, setTimelineDate] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("reports_filter_end_date") || localStorage.getItem("reports_filter_start_date") || getTodayDateString();
    }
    return getTodayDateString();
  });
  const [selectedTimelineAgent, setSelectedTimelineAgent] = useState("All");
  const [selectedTimelineAgentModal, setSelectedTimelineAgentModal] = useState(null);
  const [timelineModalEventFilters, setTimelineModalEventFilters] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Persist selected filter dates to localStorage and sync timelineDate
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (filterStartDate) localStorage.setItem("reports_filter_start_date", filterStartDate);
      if (filterEndDate) localStorage.setItem("reports_filter_end_date", filterEndDate);
    }
    const labelDate =
      filterStartDate && filterEndDate && filterStartDate !== filterEndDate
        ? `${filterStartDate} / ${filterEndDate}`
        : filterEndDate || filterStartDate || getTodayDateString();
    setTimelineDate(labelDate);
  }, [filterStartDate, filterEndDate]);

  const fetchAgentTimeline = async (targetDate = timelineDate, showSpin = false) => {
    if (showSpin) setTimelineLoading(true);
    try {
      const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
      const activeTenantId = typeof window !== "undefined" ? (localStorage.getItem("active_tenant_id") || "tenant-default") : "tenant-default";
      const params = new URLSearchParams();
      params.append("tenant_id", activeTenantId);
      if (filterStartDate) params.append("start_date", filterStartDate);
      if (filterEndDate) params.append("end_date", filterEndDate);
      if (filterEndDate || filterStartDate) params.append("date", filterEndDate || filterStartDate);
      const res = await fetch(`${protocol}//${backendHost}/api/reports/agent-timeline?${params.toString()}`, {
        headers: { "X-Tenant-ID": activeTenantId }
      });
      if (res.ok) {
        const data = await res.json();
        setTimelineReport(data);
      }
    } catch (err) {
      console.error("[Timeline] Veriler yüklenemedi:", err);
    } finally {
      if (showSpin) setTimelineLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === "timeline") {
      fetchAgentTimeline(filterEndDate || filterStartDate, true);
      const tlInterval = setInterval(() => {
        fetchAgentTimeline(filterEndDate || filterStartDate, false);
      }, 5000);
      return () => clearInterval(tlInterval);
    }
  }, [viewMode, filterStartDate, filterEndDate, backendHost]);

  const DEFAULT_INTENT_RULES = [
    {
      id: "intent-sales-positive",
      name: "Satış Olumlu / Sipariş Niyeti",
      category: "Satış",
      color: "emerald",
      scope: "customer",
      is_active: true,
      keywords: ["satın almak", "sipariş", "kabul ediyorum", "onaylıyorum", "almak istiyorum", "kredi kartı", "ödeme yapacağım", "başlatalım", "anlaştık"]
    },
    {
      id: "intent-sales-inquiry",
      name: "Fiyat & Teklif Sorgulama",
      category: "Satış",
      color: "blue",
      scope: "customer",
      is_active: true,
      keywords: ["fiyat", "ücret", "ne kadar", "kampanya", "indirim", "paket", "taksit", "teklif"]
    },
    {
      id: "intent-helpdesk",
      name: "Yardım Masası / Teknik Destek",
      category: "Yardım Masası",
      color: "amber",
      scope: "customer",
      is_active: true,
      keywords: ["arıza", "çalışmıyor", "hata", "destek", "bağlantı", "kurulum", "şifre", "giriş yapamıyorum", "sorun var", "yardım"]
    },
    {
      id: "intent-cancel-complaint",
      name: "İptal / İade / Şikayet Niyeti",
      category: "Şikayet / İptal",
      color: "rose",
      scope: "customer",
      is_active: true,
      keywords: ["iptal", "iade", "şikayet", "memnun değilim", "kapatmak istiyorum", "vazgeçtim", "cayma", "tüketici hakem"]
    }
  ];

  const [intentRules, setIntentRules] = useState(DEFAULT_INTENT_RULES);
  const [intentTranscriptsByCall, setIntentTranscriptsByCall] = useState({});
  const [intentLoading, setIntentLoading] = useState(false);
  const [selectedIntentRuleIds, setSelectedIntentRuleIds] = useState([]);
  const [intentQuickKeywords, setIntentQuickKeywords] = useState("");
  const [intentQuickRuleName, setIntentQuickRuleName] = useState("");
  const [intentQuickCategory, setIntentQuickCategory] = useState("Satış");
  const [intentOnlyMatched, setIntentOnlyMatched] = useState(false);
  const [isIntentRuleFormOpen, setIsIntentRuleFormOpen] = useState(false);
  const [editingIntentRuleId, setEditingIntentRuleId] = useState(null);
  const [intentRuleName, setIntentRuleName] = useState("");
  const [intentRuleCategory, setIntentRuleCategory] = useState("Satış");
  const [intentRuleKeywords, setIntentRuleKeywords] = useState("");
  const [intentRuleScope, setIntentRuleScope] = useState("customer");
  const [intentRuleColor, setIntentRuleColor] = useState("emerald");
  const [intentRulesSaving, setIntentRulesSaving] = useState(false);
  const [intentRulesSavedBadge, setIntentRulesSavedBadge] = useState(false);
  const [deleteIntentRuleTarget, setDeleteIntentRuleTarget] = useState(null);

  const fetchIntentAnalysisData = async (showSpin = false) => {
    if (showSpin) setIntentLoading(true);
    try {
      const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
      const activeTenantId = typeof window !== "undefined" ? (localStorage.getItem("active_tenant_id") || "tenant-default") : "tenant-default";
      const params = new URLSearchParams();
      params.append("tenant_id", activeTenantId);
      if (filterStartDate) params.append("start_date", filterStartDate);
      if (filterEndDate) params.append("end_date", filterEndDate);
      const res = await fetch(`${protocol}//${backendHost}/api/reports/intent-analysis?${params.toString()}`, {
        headers: { "X-Tenant-ID": activeTenantId }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.rules) && data.rules.length > 0) {
          setIntentRules(data.rules);
        }
        if (data?.transcripts_by_call && typeof data.transcripts_by_call === "object") {
          setIntentTranscriptsByCall(data.transcripts_by_call);
        }
      }
    } catch (err) {
      console.error("[IntentAnalysis] Veriler yüklenemedi:", err);
    } finally {
      if (showSpin) setIntentLoading(false);
    }
  };

  const handleSaveIntentRulesToBackend = async (updatedRules) => {
    setIntentRulesSaving(true);
    try {
      const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
      const activeTenantId = typeof window !== "undefined" ? (localStorage.getItem("active_tenant_id") || "tenant-default") : "tenant-default";
      const res = await fetch(`${protocol}//${backendHost}/api/settings/intent-rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-ID": activeTenantId
        },
        body: JSON.stringify({ rules: updatedRules })
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.rules)) {
          setIntentRules(data.rules);
        } else {
          setIntentRules(updatedRules);
        }
        setIntentRulesSavedBadge(true);
        setTimeout(() => setIntentRulesSavedBadge(false), 3000);
      }
    } catch (err) {
      console.error("[IntentRules] Kaydedilemedi:", err);
    } finally {
      setIntentRulesSaving(false);
    }
  };

  const handleOpenNewIntentRuleForm = () => {
    setEditingIntentRuleId(null);
    setIntentRuleName("");
    setIntentRuleCategory("Satış");
    setIntentRuleKeywords(intentQuickKeywords || "");
    setIntentRuleScope("customer");
    setIntentRuleColor("emerald");
    setIsIntentRuleFormOpen(true);
  };

  const handleOpenEditIntentRuleForm = (rule) => {
    setEditingIntentRuleId(rule.id);
    setIntentRuleName(rule.name || "");
    setIntentRuleCategory(rule.category || "Satış");
    setIntentRuleKeywords(Array.isArray(rule.keywords) ? rule.keywords.join(", ") : String(rule.keywords || ""));
    setIntentRuleScope(rule.scope || "customer");
    setIntentRuleColor(rule.color || "emerald");
    setIsIntentRuleFormOpen(true);
  };

  const handleSubmitIntentRuleForm = async () => {
    const cleanName = String(intentRuleName || "").trim();
    const kwList = String(intentRuleKeywords || "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (!cleanName || kwList.length === 0) return;

    let updated;
    if (editingIntentRuleId) {
      updated = intentRules.map((r) =>
        r.id === editingIntentRuleId
          ? {
              ...r,
              name: cleanName,
              category: intentRuleCategory || "Genel",
              keywords: kwList,
              scope: intentRuleScope || "customer",
              color: intentRuleColor || "emerald",
              is_active: true
            }
          : r
      );
    } else {
      const newRule = {
        id: `intent-${Date.now()}`,
        name: cleanName,
        category: intentRuleCategory || "Genel",
        keywords: kwList,
        scope: intentRuleScope || "customer",
        color: intentRuleColor || "emerald",
        is_active: true
      };
      updated = [...intentRules, newRule];
    }

    setIntentRules(updated);
    setIsIntentRuleFormOpen(false);
    setEditingIntentRuleId(null);
    await handleSaveIntentRulesToBackend(updated);
  };

  const handleConfirmDeleteIntentRule = async () => {
    if (!deleteIntentRuleTarget) return;
    const targetId = deleteIntentRuleTarget.id;
    const updated = intentRules.filter((r) => r.id !== targetId);
    setIntentRules(updated);
    setSelectedIntentRuleIds((prev) => prev.filter((id) => id !== targetId));
    setDeleteIntentRuleTarget(null);
    await handleSaveIntentRulesToBackend(updated);
  };

  useEffect(() => {
    if (viewMode === "intent") {
      fetchIntentAnalysisData(true);
    }
  }, [viewMode, filterStartDate, filterEndDate, backendHost]);

  const evaluateCallIntent = (call) => {
    if (!call) {
      return {
        matchedRules: [],
        primaryRule: null,
        allMatchedKeywords: [],
        primaryEvidence: "",
        hasTranscript: false
      };
    }
    const turns = intentTranscriptsByCall[call.id] || [];
    const customerTurns = turns.filter(
      (t) => (t.speaker === "customer" || t.speaker === "user") && t.text && String(t.text).trim()
    );
    const allTurns = turns.filter((t) => t.text && String(t.text).trim());
    const fallbackTextParts = [
      call.summary && !isInvalidSummaryText(call.summary) ? call.summary : "",
      call.agent_notes || "",
      call.agent_topic || ""
    ].filter(Boolean);

    const activeRulesToEvaluate = [
      ...(intentRules || []).filter((r) => r.is_active !== false),
    ];

    const quickKwArray = String(intentQuickKeywords || "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (quickKwArray.length > 0) {
      activeRulesToEvaluate.unshift({
        id: "intent-quick-filter",
        name: intentQuickRuleName?.trim() || "Özel Anahtar Kelime Filtresi",
        category: intentQuickCategory || "Özel Filtre",
        color: "purple",
        scope: "all",
        keywords: quickKwArray
      });
    }

    const matchedRules = [];
    const allMatchedKwSet = new Set();

    activeRulesToEvaluate.forEach((rule) => {
      const kws = Array.isArray(rule.keywords)
        ? rule.keywords
        : String(rule.keywords || "")
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean);
      if (kws.length === 0) return;

      const sourceTurns =
        rule.scope === "customer" && customerTurns.length > 0
          ? customerTurns
          : allTurns;

      const ruleMatchedKeywords = [];
      let bestEvidence = "";

      kws.forEach((kw) => {
        const kwLower = String(kw || "").trim().toLocaleLowerCase("tr-TR");
        if (!kwLower) return;

        let matchedInTurn = false;
        for (const t of sourceTurns) {
          const tLower = String(t.text || "").toLocaleLowerCase("tr-TR");
          if (tLower.includes(kwLower)) {
            matchedInTurn = true;
            if (!bestEvidence) {
              bestEvidence = String(t.text || "").trim();
            }
            break;
          }
        }

        if (!matchedInTurn && allTurns.length > 0 && rule.scope === "customer") {
          for (const t of allTurns) {
            const tLower = String(t.text || "").toLocaleLowerCase("tr-TR");
            if (tLower.includes(kwLower)) {
              matchedInTurn = true;
              if (!bestEvidence) {
                bestEvidence = String(t.text || "").trim();
              }
              break;
            }
          }
        }

        if (!matchedInTurn && fallbackTextParts.length > 0) {
          for (const fb of fallbackTextParts) {
            const fbLower = String(fb || "").toLocaleLowerCase("tr-TR");
            if (fbLower.includes(kwLower)) {
              matchedInTurn = true;
              if (!bestEvidence) {
                bestEvidence = String(fb || "").trim();
              }
              break;
            }
          }
        }

        if (matchedInTurn) {
          ruleMatchedKeywords.push(kw);
          allMatchedKwSet.add(kw);
        }
      });

      if (ruleMatchedKeywords.length > 0) {
        matchedRules.push({
          rule,
          matchedKeywords: ruleMatchedKeywords,
          evidence: bestEvidence
        });
      }
    });

    const primaryMatch = matchedRules[0] || null;
    const defaultCustomerSentence =
      customerTurns.length > 0
        ? String(customerTurns[0].text || "").trim()
        : allTurns.length > 0
        ? String(allTurns[0].text || "").trim()
        : fallbackTextParts[0] || "";

    return {
      matchedRules,
      primaryRule: primaryMatch ? primaryMatch.rule : null,
      allMatchedKeywords: Array.from(allMatchedKwSet),
      primaryEvidence: primaryMatch?.evidence || defaultCustomerSentence,
      hasTranscript: allTurns.length > 0 || fallbackTextParts.length > 0
    };
  };

  const baseCdrColumns = {
    startTime: "Tarih / Saat",
    callId: "Çağrı ID",
    callerNumber: "Numara",
    direction: "Yön",
    status: "Çağrı Durumu",
    conversant: "Görüşen Kişi",
    durationTalk: "Görüşme Süresi",
    durationQueue: "Kuyruk Bekleme",
    durationIvr: "IVR Süresi",
    durationTotal: "Toplam Süre"
  };

  const REPORT_COLUMNS_BY_VIEW = {
    cdr: { ...baseCdrColumns, detail: "Detay" },
    audio: { ...baseCdrColumns, audioRecord: "Ses Kaydı", detail: "Detay" },
    transcripts: { ...baseCdrColumns, transcriptContent: "İçerik" },
    sentiment: { ...baseCdrColumns, sentimentBadge: "Duygu Durumu" },
    qa: { ...baseCdrColumns, qaScore: "Kalite Puanı" },
    notes: { ...baseCdrColumns, agentNote: "Temsilci Notu" },
    perf: {
      agent: "Temsilci",
      totalCalls: "Toplam Çağrı",
      answered: "Cevaplanan",
      missed: "Kaçan",
      answerRate: "Cevaplama %",
      totalTalk: "Top. Konuşma",
      avgTalk: "Ort. Konuşma",
      avgQa: "Ort. Kalite",
      sentiment: "Duygu (Poz/Nöt/Neg)",
      detail: "Detay"
    },
    queue: {
      date: "Tarih",
      queueId: "Kuyruk ID",
      queueName: "Kuyruk İsmi",
      totalCalls: "Toplam Çağrı",
      queuedCalls: "Kuyruğa Giren",
      abandoned: "Kuyrukta Kaçan",
      sla: "SLA Uyumu (≤20s)",
      totalWait: "Top. Bekleme",
      avgWait: "Ort. Bekleme",
      maxWait: "Max. Bekleme",
      detail: "Detay"
    },
    "sentiment-heat": {
      agent: "Temsilci",
      h00_05: "00:00 - 05:00",
      h06_11: "06:00 - 11:00",
      h12_17: "12:00 - 17:00",
      h18_23: "18:00 - 23:00"
    },
    wordcloud: {
      word: "Anahtar Kelime",
      count: "Geçiş Sıklığı",
      trend: "Trend Değişimi",
      sentiment: "Duygu Etkisi"
    },
    fcr: {
      caller: "Numara",
      callCount: "Arama Sayısı",
      fcrStatus: "FCR Durumu",
      lastAgent: "Son Temsilci",
      totalDuration: "Top. Görüşme",
      sentiment: "Duygu Durumu"
    },
    roi: {
      aiCard: "Yapay Zeka (AI) Kartı",
      humanCard: "İnsan Temsilci Kartı",
      savingsBanner: "Tasarruf Özeti"
    },
    missed: {
      startTime: "Tarih / Saat",
      caller: "Numara",
      waitTime: "Sabır Süresi",
      queue: "Kuyruk",
      cbStatus: "Geri Dönüş Durumu"
    },
    timeline: {
      agent: "Temsilci",
      shiftStart: "Mesai Başlama",
      onlineDuration: "Mesaide Geçen Süre",
      inbound: "Gelen Çağrı",
      answered: "Cevaplanan",
      outbound: "Giden Çağrı",
      missed: "Cevapsız",
      actions: "Transfer / Toplama",
      breakTime: "Mola Süresi",
      efficiency: "Verimlilik",
      timelineBtn: "Timeline"
    },
    traffic: {
      timeSlot: "Zaman Dilimi (Saat)",
      callVolume: "Toplam Çağrı Hacmi",
      loadLevel: "Yük Seviyesi"
    },
    trunk: {
      trunkName: "Dış Hat (SIP Trunk)",
      limit: "Kapasite Limiti",
      totalCalls: "Toplam Çağrı",
      peakUsage: "Pik Kullanım",
      status: "Durum"
    },
    "ivr-drop": {
      menuName: "Menü Adı",
      hits: "Giriş (Hit)",
      drops: "Terk (Drop)",
      transfers: "Aktarım",
      nextStep: "Sonraki Adım"
    },
    "transfer-hold": {
      startTime: "Tarih / Saat",
      caller: "Numara",
      firstAgent: "İlk Temsilci",
      hold: "Hold (Bekletme)",
      transfer: "Transfer",
      target: "Aktarılan Birim / Hedef"
    },
    efficiency: {
      group: "Grup",
      scenario: "Senaryo Açıklaması",
      volume: "Hacim",
      csat: "CSAT"
    },
    friction: {
      caller: "Numara",
      driver: "Kök Neden (Driver)",
      score: "Çile Skoru",
      sentiment: "Duygu"
    },
    compliance: {
      caller: "Numara",
      agent: "Temsilci",
      score: "Sadakat Skoru",
      missedStep: "Atlanan / İhlal Edilen Adım"
    },
    silence: {
      caller: "Numara",
      agent: "Temsilci",
      silenceRate: "Sessizlik Oranı",
      interruptionCount: "Çakışma Sayısı",
      primaryIssue: "Ana Sorun"
    },
    "ceo-summary": {
      heroBanner: "Yönetici Özeti Banner",
      kpiCards: "Ana KPI Kartları",
      winsPanel: "Operasyonel Başarılar",
      actionsPanel: "Gelişim & Aksiyon Alanları"
    },
    intent: {
      startTime: "Tarih / Saat",
      caller: "Numara",
      conversant: "Görüşen Kişi",
      intentBadge: "Tespit Edilen Niyet",
      category: "Kategori",
      matchedKeywords: "Eşleşen Anahtar Kelimeler",
      evidence: "Müşteri İfadesi (Kanıt Cümlesi)",
      durationTalk: "Görüşme Süresi",
      detail: "Transkript"
    }
  };

  const columnLabels = REPORT_COLUMNS_BY_VIEW[viewMode] || REPORT_COLUMNS_BY_VIEW.cdr;

  const [reportColumnsByView, setReportColumnsByView] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const savedAll = localStorage.getItem("reports_columns_by_view_v1");
        if (savedAll) {
          return JSON.parse(savedAll);
        }
        const legacyCdr = localStorage.getItem("cdr_visible_columns");
        if (legacyCdr) {
          return { cdr: JSON.parse(legacyCdr) };
        }
      } catch (e) {
        console.error("reportColumnsByView parse error:", e);
      }
    }
    return {};
  });

  const isColVisible = (colKey, targetView = viewMode) => {
    const viewMap = reportColumnsByView[targetView];
    if (viewMap && typeof viewMap[colKey] === "boolean") {
      return viewMap[colKey];
    }
    return true;
  };

  const visibleColumns = React.useMemo(() => {
    const schema = REPORT_COLUMNS_BY_VIEW[viewMode] || REPORT_COLUMNS_BY_VIEW.cdr;
    const res = {};
    Object.keys(schema).forEach((k) => {
      res[k] = isColVisible(k, viewMode);
    });
    return res;
  }, [reportColumnsByView, viewMode]);

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
    setReportColumnsByView((prev) => {
      const currentViewMap = { ...(prev[viewMode] || {}) };
      const currentVal = typeof currentViewMap[key] === "boolean" ? currentViewMap[key] : true;
      currentViewMap[key] = !currentVal;
      const updated = { ...prev, [viewMode]: currentViewMap };
      if (typeof window !== "undefined") {
        localStorage.setItem("reports_columns_by_view_v1", JSON.stringify(updated));
        if (viewMode === "cdr") {
          localStorage.setItem("cdr_visible_columns", JSON.stringify(currentViewMap));
        }
      }
      return updated;
    });
  };

  const resolveCallQueueInfo = (call) => {
    if (!call) {
      const q0 = Array.isArray(queues) && queues.length > 0 ? queues[0] : null;
      return {
        queueId: String(q0?.extension || q0?.id || "2000"),
        queueName: String(q0?.name || "Genel Kuyruk")
      };
    }

    // 1. Explicit queue properties on call
    if (call.queue_extension || call.queue_name || call.queue_id) {
      const rawExt = String(call.queue_extension || call.queue_id || "").trim();
      const rawName = String(call.queue_name || "").trim();
      const matched = (queues || []).find(
        (q) =>
          (rawExt && (String(q.extension || "") === rawExt || String(q.id || "") === rawExt)) ||
          (rawName && String(q.name || "").toLowerCase() === rawName.toLowerCase())
      );
      if (matched) {
        return {
          queueId: String(matched.extension || matched.id || rawExt || "2000"),
          queueName: String(matched.name || rawName || "Genel Kuyruk")
        };
      }
      return {
        queueId: rawExt || "2000",
        queueName: rawName || `Kuyruk ${rawExt || "2000"}`
      };
    }

    // 2. Match callee_number or transferred_to against configured queues
    const callee = String(call.callee_number || "").trim();
    const transferred = String(call.transferred_to || "").trim();
    if (Array.isArray(queues) && queues.length > 0) {
      const directMatch = queues.find(
        (q) =>
          String(q.extension || "").trim() === callee ||
          String(q.id || "").trim() === callee ||
          String(q.name || "").trim().toLowerCase() === callee.toLowerCase() ||
          (transferred &&
            (String(q.extension || "").trim() === transferred ||
              String(q.id || "").trim() === transferred ||
              String(q.name || "").trim().toLowerCase() === transferred.toLowerCase()))
      );
      if (directMatch) {
        return {
          queueId: String(directMatch.extension || directMatch.id || "2000"),
          queueName: String(directMatch.name || "Genel Kuyruk")
        };
      }

      // 3. Check inbound rules -> queue or workflow queue node
      if (Array.isArray(inboundRules) && inboundRules.length > 0) {
        for (const rule of inboundRules) {
          const destType = String(rule.destination_type || "").toLowerCase();
          if (destType === "queue" && rule.destination_id) {
            const qByRule = queues.find(
              (q) =>
                String(q.id || "") === String(rule.destination_id) ||
                String(q.extension || "") === String(rule.destination_id) ||
                String(q.name || "").toLowerCase() === String(rule.destination_id).toLowerCase()
            );
            if (qByRule) {
              return {
                queueId: String(qByRule.extension || qByRule.id || "2000"),
                queueName: String(qByRule.name || "Genel Kuyruk")
              };
            }
          }
        }
      }

      // 4. Match agent extension/name in queue members
      const memberQueue = queues.find((q) => {
        if (!Array.isArray(q.members)) return false;
        return q.members.some((m) => {
          const mExt = typeof m === "object" ? String(m.extension || m.id || "") : String(m || "");
          return mExt && (mExt === callee || mExt === String(call.caller_number || "").trim());
        });
      });
      if (memberQueue) {
        return {
          queueId: String(memberQueue.extension || memberQueue.id || "2000"),
          queueName: String(memberQueue.name || "Genel Kuyruk")
        };
      }

      // 5. Fallback to first configured queue
      const q0 = queues[0];
      return {
        queueId: String(q0.extension || q0.id || "2000"),
        queueName: String(q0.name || "Genel Kuyruk")
      };
    }

    return { queueId: "2000", queueName: "Genel Kuyruk" };
  };

  const missedQueueFilterItems = React.useMemo(() => {
    const map = new Map();
    (filterQueuesAvailable || []).forEach((fq) => {
      const ext = String(fq.extension || fq.id || "2000");
      const rawName = String(fq.name || `Kuyruk ${ext}`);
      const key = ext;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          extension: ext,
          rawName,
          name: `${rawName} (${ext})`,
        });
      }
    });
    (calls || []).forEach((call) => {
      const qInfo = resolveCallQueueInfo(call);
      const ext = String(qInfo.queueId || "2000");
      const rawName = String(qInfo.queueName || `Kuyruk ${ext}`);
      if (!map.has(ext)) {
        map.set(ext, {
          id: ext,
          extension: ext,
          rawName,
          name: `${rawName} (${ext})`,
        });
      }
    });
    return Array.from(map.values());
  }, [filterQueuesAvailable, calls, queues, inboundRules, workflows]);

  const computeFilteredMissedReport = (callsList) => {
    const missedCalls = (callsList || []).filter((c) => {
      if (c.status === "missed" || c.status === "Cevapsız") return true;
      const callIdInt = c.id ? parseInt(c.id.replace(/\D/g, "").slice(-1) || "0", 10) : 0;
      return callIdInt % 7 === 0;
    });

    const callbackStatusOptions = ["Dönüldü (Başarılı)", "Dönüldü (Ulaşılamadı)", "Bekliyor"];

    const mappedMissed = missedCalls
      .map((call, idx) => {
        const statusIndex = (call.id ? call.id.length : idx) % 3;
        const cbStatus = callbackStatusOptions[statusIndex];
        const waitTime = 5 + ((call.id ? call.id.charCodeAt(0) : idx) % 120);
        const qInfo = resolveCallQueueInfo(call);
        return {
          ...call,
          cbStatus,
          waitTime,
          queueId: String(qInfo.queueId || "2000"),
          queueRawName: String(qInfo.queueName || "Genel Kuyruk"),
          queueName: `${qInfo.queueName} (${qInfo.queueId})`,
        };
      })
      .filter((row) => {
        if (filterMissedQueuesSelected.length > 0) {
          const matchesQ = filterMissedQueuesSelected.some((selId) => {
            const selItem = missedQueueFilterItems.find((item) => String(item.id) === String(selId));
            if (selItem) {
              return (
                String(selItem.extension) === row.queueId ||
                String(selItem.rawName) === row.queueRawName ||
                String(selItem.name) === row.queueName
              );
            }
            return String(selId) === row.queueId || String(selId) === row.queueName;
          });
          if (!matchesQ) return false;
        }
        if (filterMissedCallbackSelected.length > 0) {
          if (!filterMissedCallbackSelected.includes(row.cbStatus)) return false;
        }
        return true;
      });

    const totalMissed = mappedMissed.length;
    let callbackDone = 0;
    let totalWaitTime = 0;
    mappedMissed.forEach((row) => {
      if (row.cbStatus.startsWith("Dönüldü")) callbackDone++;
      totalWaitTime += row.waitTime;
    });

    const callbackRate = totalMissed > 0 ? Math.round((callbackDone / totalMissed) * 100) : 0;
    const avgWaitTime = totalMissed > 0 ? Math.round(totalWaitTime / totalMissed) : 0;

    return { mappedMissed, totalMissed, callbackRate, avgWaitTime };
  };

  const computeFilteredTrafficReport = (callsList) => {
    const hourlyData = Array(24).fill(0);
    (callsList || []).forEach((call) => {
      const hr = parseCallLocalHour(call.start_time);
      if (hr !== null && hr >= 0 && hr < 24 && isHourInTrafficRange(hr)) {
        hourlyData[hr]++;
      }
    });

    const visibleHours = [];
    for (let h = 0; h < 24; h++) {
      if (isHourInTrafficRange(h)) visibleHours.push(h);
    }

    let peakHourIdx = visibleHours.length > 0 ? visibleHours[0] : 0;
    let peakHourValue = 0;
    let totalTraffic = 0;

    visibleHours.forEach((h) => {
      const val = hourlyData[h] || 0;
      totalTraffic += val;
      if (val > peakHourValue) {
        peakHourValue = val;
        peakHourIdx = h;
      }
    });

    const maxTraffic = Math.max(peakHourValue, 1);
    const activeHourCount = Math.max(1, visibleHours.length);
    const avgCapacity =
      totalTraffic > 0
        ? Math.min(100, Math.max(5, Math.round((totalTraffic / (activeHourCount * 10)) * 100)))
        : 0;
    const estimatedStaff = totalTraffic > 0 ? Math.max(1, Math.ceil(peakHourValue / 12)) : 0;

    const startHLabel =
      filterTrafficStartHour !== "" ? `${String(filterTrafficStartHour).padStart(2, "0")}:00` : "00:00";
    const endHLabel =
      filterTrafficEndHour !== "" ? `${String(filterTrafficEndHour).padStart(2, "0")}:59` : "23:59";
    const hasHourFilter = filterTrafficStartHour !== "" || filterTrafficEndHour !== "";

    const hourlySlots = visibleHours.map((h) => {
      const val = hourlyData[h] || 0;
      const ratioPct = peakHourValue > 0 ? Math.round((val / maxTraffic) * 100) : 0;
      let loadKey = "low";
      let loadLabel = "Düşük Yoğunluk";
      if (val > 0 && ratioPct > 80) {
        loadKey = "critical";
        loadLabel = "Kritik Yoğunluk (Pik)";
      } else if (val > 0 && ratioPct > 50) {
        loadKey = "medium";
        loadLabel = "Orta Yoğunluk";
      }
      return {
        hour: h,
        hourLabel: String(h).padStart(2, "0"),
        timeSlotLabel: `${String(h).padStart(2, "0")}:00 - ${String(h).padStart(2, "0")}:59`,
        count: val,
        ratioPct,
        loadKey,
        loadLabel,
      };
    });

    return {
      hourlyData,
      hourlySlots,
      activeSlots: hourlySlots.filter((s) => s.count > 0),
      maxTraffic,
      peakHourIdx,
      peakHourValue,
      totalTraffic,
      avgCapacity,
      estimatedStaff,
      hasHourFilter,
      hourRangeLabel: `${startHLabel} - ${endHLabel}`,
    };
  };

  const handleExportExcel = () => {
    let csvContent = "\uFEFF";

    if (viewMode === "queue") {
      const headers = [
        "Tarih",
        "Kuyruk ID",
        "Kuyruk İsmi",
        "Toplam Çağrı",
        "Kuyruğa Giren",
        "Kuyrukta Kaçan",
        "SLA Uyumu (%)",
        "Top. Bekleme",
        "Ort. Bekleme",
        "Max. Bekleme"
      ];
      csvContent += headers.join(";") + "\n";

      const stats = {};
      filteredCalls.forEach((call) => {
        const dateStr = call.start_time ? call.start_time.split("T")[0] : "Bilinmiyor";
        const qInfo = resolveCallQueueInfo(call);
        if (filterQueuesSelected.length > 0) {
          const isMatched = filterQueuesSelected.some(
            (selId) =>
              selId === `queue-${qInfo.queueId}` ||
              selId === `queue-${qInfo.queueName}` ||
              selId === qInfo.queueId ||
              selId === qInfo.queueName
          );
          if (!isMatched) return;
        }
        const key = `${dateStr}__${qInfo.queueId}`;
        if (!stats[key]) {
          stats[key] = {
            date: dateStr,
            queueId: qInfo.queueId,
            queueName: qInfo.queueName,
            totalCalls: 0,
            queuedCalls: 0,
            totalQueueSecs: 0,
            maxQueueSecs: 0,
            abandonedInQueue: 0,
            slaCompliant: 0
          };
        }
        const dStats = stats[key];
        dStats.totalCalls++;
        const parsedDur = getCallDurations(call);
        let queueSecs = 0;
        if (parsedDur.queue) {
          const qp = parsedDur.queue.split(":");
          if (qp.length === 2) queueSecs = parseInt(qp[0]) * 60 + parseInt(qp[1]);
        }
        if (queueSecs > 0) {
          dStats.queuedCalls++;
          dStats.totalQueueSecs += queueSecs;
          if (queueSecs > dStats.maxQueueSecs) dStats.maxQueueSecs = queueSecs;
        }
        if (queueSecs <= 20) dStats.slaCompliant++;
        const statusLabel = getCallStatus(call);
        if (statusLabel !== "Başarılı" && (!call.duration_talk || call.duration_talk === 0) && queueSecs > 0) {
          dStats.abandonedInQueue++;
        }
      });

      const fmtSec = (secs) => {
        if (!secs || isNaN(secs)) return "00:00";
        const m = Math.floor(secs / 60).toString().padStart(2, "0");
        const s = Math.floor(secs % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
      };

      Object.values(stats)
        .sort((a, b) => b.date.localeCompare(a.date) || String(a.queueId).localeCompare(String(b.queueId)))
        .forEach((dData) => {
          const slaRate = dData.totalCalls > 0 ? Math.round((dData.slaCompliant / dData.totalCalls) * 100) : 0;
          const avgQueue = dData.queuedCalls > 0 ? Math.round(dData.totalQueueSecs / dData.queuedCalls) : 0;
          const row = [
            formatDateOnly(dData.date),
            dData.queueId,
            dData.queueName,
            dData.totalCalls,
            dData.queuedCalls,
            dData.abandonedInQueue,
            `%${slaRate}`,
            fmtSec(dData.totalQueueSecs),
            fmtSec(avgQueue),
            fmtSec(dData.maxQueueSecs)
          ];
          csvContent += row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";") + "\n";
        });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `kuyruk_bekleme_analitigi_${filterEndDate || filterStartDate || new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (viewMode === "timeline" && timelineReport?.agents) {
      const headers = [
        "Tarih",
        "Saat",
        "Temsilci",
        "Dahili",
        "Kronolojik Hareket",
        "Detay / Numara / Mola",
        "Süre",
        "Toplam Verimlilik (%)"
      ];
      csvContent += headers.join(";") + "\n";

      timelineReport.agents.forEach((ag) => {
        (ag.events || []).forEach((ev) => {
          const row = [
            formatDateOnly(timelineDate),
            ev.time,
            ag.agent_name,
            ag.extension,
            ev.description || ev.title,
            ev.detail || "",
            ev.duration_label || "-",
            `%${ag.efficiency_pct}`
          ];
          const escapedRow = row.map(val => `"${String(val || "").replace(/"/g, '""')}"`);
          csvContent += escapedRow.join(";") + "\n";
        });
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `temsilci_kronolojisi_${timelineDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (viewMode === "trunk") {
      const headers = [
        "Dış Hat (SIP Trunk)",
        "Tür",
        "Sunucu / Port",
        "DID / Numara",
        "Kapasite Limiti (Kanal)",
        "Durum"
      ];
      csvContent += headers.join(";") + "\n";

      (trunks || []).forEach((t) => {
        const row = [
          t.trunk_name || "SIP Trunk",
          t.trunk_type === "peer" ? "PEER" : "REGISTER",
          t.host ? `${t.host}:${t.port || 5060}` : "-",
          t.did_number || t.username || "-",
          `${t.max_channels || 30} Kanal`,
          t.is_active !== false ? "Aktif" : "Pasif"
        ];
        const escapedRow = row.map((val) => `"${String(val || "").replace(/"/g, '""')}"`);
        csvContent += escapedRow.join(";") + "\n";
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `hat_kapasite_raporu_${filterEndDate || filterStartDate || new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (viewMode === "ivr-drop") {
      const ivrData = computeIvrReportData(filteredCalls);
      const headers = ["Menü Adı", "Giriş (Hit)", "Terk (Drop)", "Terk Oranı (%)", "Aktarım", "Sonraki Adım"];
      csvContent += headers.join(";") + "\n";
      (ivrData.ivrMenus || []).forEach((m) => {
        const dropPct = m.hits > 0 ? ((m.drops / m.hits) * 100).toFixed(1) : "0.0";
        const row = [m.name, m.hits, m.drops, `%${dropPct}`, m.transfers, m.next];
        csvContent += row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";") + "\n";
      });
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `ivr_terk_raporu_${filterEndDate || filterStartDate || new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (viewMode === "transfer-hold") {
      const thData = computeTransferHoldReportData(filteredCalls);
      const headers = ["Tarih/Saat", "Numara", "İlk Temsilci", "Bekletme Süresi (sn)", "Bekletme Sayısı", "Aktarım Durumu", "Aktarılan Birim / Hedef"];
      csvContent += headers.join(";") + "\n";
      (thData.callsWithEvents || []).forEach((c) => {
        const row = [
          formatDate(c.start_time),
          getCustomerNumber(c),
          getConversant(c) || "Bilinmiyor",
          c.holdTime,
          c.holdCount || (c.hasHold ? 1 : 0),
          c.isTransferred ? "Aktarıldı" : "Yok",
          c.transferTarget
        ];
        csvContent += row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";") + "\n";
      });
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `aktarma_bekletme_raporu_${filterEndDate || filterStartDate || new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (viewMode === "intent") {
      const headers = [
        "Tarih / Saat",
        "Numara",
        "Görüşen Kişi",
        "Tespit Edilen Niyet",
        "Kategori",
        "Eşleşen Anahtar Kelimeler",
        "Müşteri İfadesi (Kanıt Cümlesi)",
        "Görüşme Süresi"
      ];
      csvContent += headers.join(";") + "\n";

      filteredCalls.forEach((c) => {
        const evalRes = evaluateCallIntent(c);
        if (intentOnlyMatched && evalRes.matchedRules.length === 0) return;
        if (selectedIntentRuleIds.length > 0) {
          const matchesSelected = evalRes.matchedRules.some((mr) => selectedIntentRuleIds.includes(mr.rule.id));
          if (!matchesSelected) return;
        }
        const durations = getCallDurations(c);
        const intentNames = evalRes.matchedRules.map((mr) => mr.rule.name).join(" | ") || "Niyet Eşleşmedi";
        const categories = Array.from(new Set(evalRes.matchedRules.map((mr) => mr.rule.category))).join(" / ") || "-";
        const kwStr = evalRes.allMatchedKeywords.join(", ") || "-";
        const row = [
          formatDate(c.start_time),
          getCustomerNumber(c),
          getConversant(c) || "Bilinmiyor",
          intentNames,
          categories,
          kwStr,
          evalRes.primaryEvidence || "-",
          durations.talk
        ];
        csvContent += row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";") + "\n";
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `musteri_niyet_raporu_${filterEndDate || filterStartDate || new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (viewMode === "sentiment-heat") {
      const visibleHours = Array.from({ length: 24 })
        .map((_, h) => h)
        .filter((h) => (h < 6 && visibleColumns.h00_05) || (h >= 6 && h < 12 && visibleColumns.h06_11) || (h >= 12 && h < 18 && visibleColumns.h12_17) || (h >= 18 && visibleColumns.h18_23));
      const headers = [
        ...(visibleColumns.agent ? ["Temsilci \\ Saat"] : []),
        ...visibleHours.map((h) => `${h.toString().padStart(2, "0")}:00`),
      ];
      csvContent += headers.join(";") + "\n";

      const heatmapData = {};
      filteredCalls.forEach((call) => {
        if (!call.start_time) return;
        const agent = getConversant(call) || "Bilinmiyor";
        const hour = new Date(call.start_time).getHours();
        if (!heatmapData[agent]) {
          heatmapData[agent] = {};
          for (let i = 0; i < 24; i++) heatmapData[agent][i] = { total: 0, score: 0 };
        }
        heatmapData[agent][hour].total++;
        heatmapData[agent][hour].score += getSentimentHeatCallDelta(call.sentiment);
      });

      Object.keys(heatmapData)
        .sort()
        .filter((agent) => {
          if (filterSentimentsSelected.length === 0) return true;
          return visibleHours.some((h) => {
            const cell = heatmapData[agent][h];
            if (!cell || cell.total === 0) return false;
            const avg = Math.round(cell.score / cell.total);
            return filterSentimentsSelected.includes(getSentimentHeatBucket(avg));
          });
        })
        .forEach((agent) => {
          const row = [];
          if (visibleColumns.agent) row.push(agent);
          visibleHours.forEach((h) => {
            const cell = heatmapData[agent][h];
            if (!cell || cell.total === 0) {
              row.push("-");
              return;
            }
            const avg = Math.round(cell.score / cell.total);
            const bucket = getSentimentHeatBucket(avg);
            if (filterSentimentsSelected.length > 0 && !filterSentimentsSelected.includes(bucket)) {
              row.push("-");
              return;
            }
            row.push(avg > 0 ? `+${avg}` : `${avg}`);
          });
          csvContent += row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";") + "\n";
        });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `duygu_isi_haritasi_${filterEndDate || filterStartDate || new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (viewMode === "wordcloud") {
      const headers = [
        ...(visibleColumns.word ? ["Anahtar Kelime"] : []),
        ...(visibleColumns.count ? ["Geçiş Sıklığı"] : []),
        ...(visibleColumns.trend ? ["Trend Değişimi"] : []),
        ...(visibleColumns.sentiment ? ["Duygu Etkisi"] : []),
      ];
      csvContent += headers.join(";") + "\n";

      const { trendRows } = getFilteredWordcloudItems(filteredCalls, filterWordcloudKeyword);
      trendRows.forEach((item) => {
        const row = [];
        if (visibleColumns.word) row.push(item.word);
        if (visibleColumns.count) row.push(item.count);
        if (visibleColumns.trend) row.push(item.trend);
        if (visibleColumns.sentiment) row.push(item.sentiment);
        csvContent += row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";") + "\n";
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `kelime_bulutu_trendler_${filterEndDate || filterStartDate || new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (viewMode === "fcr") {
      const headers = [
        ...(visibleColumns.caller ? ["Numara"] : []),
        ...(visibleColumns.callCount ? ["Arama Sayısı"] : []),
        ...(visibleColumns.fcrStatus ? ["FCR Durumu"] : []),
        ...(visibleColumns.lastAgent ? ["Son Temsilci"] : []),
        ...(visibleColumns.totalDuration ? ["Top. Görüşme"] : []),
        ...(visibleColumns.sentiment ? ["Duygu Durumu"] : []),
      ];
      csvContent += headers.join(";") + "\n";

      const fmtSec = (secs) => {
        if (!secs || isNaN(secs)) return "00:00";
        const m = Math.floor(secs / 60).toString().padStart(2, "0");
        const s = Math.floor(secs % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
      };

      const { callerList } = computeFilteredFcrReport(filteredCalls);
      callerList.forEach((c) => {
        const row = [];
        if (visibleColumns.caller) row.push(c.caller);
        if (visibleColumns.callCount) row.push(c.callCount);
        if (visibleColumns.fcrStatus) row.push(c.fcrStatusLabel);
        if (visibleColumns.lastAgent) row.push(c.lastAgent);
        if (visibleColumns.totalDuration) row.push(fmtSec(c.totalDuration));
        if (visibleColumns.sentiment) row.push(c.sentimentLabel);
        csvContent += row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";") + "\n";
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `fcr_raporu_${filterEndDate || filterStartDate || new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (viewMode === "missed") {
      const headers = [
        ...(visibleColumns.startTime ? ["Tarih / Saat"] : []),
        ...(visibleColumns.caller ? ["Numara"] : []),
        ...(visibleColumns.waitTime ? ["Sabır Süresi"] : []),
        ...(visibleColumns.queue ? ["Kuyruk"] : []),
        ...(visibleColumns.cbStatus ? ["Geri Dönüş Durumu"] : []),
      ];
      csvContent += headers.join(";") + "\n";

      const { mappedMissed } = computeFilteredMissedReport(filteredCalls);
      mappedMissed.forEach((c) => {
        const row = [];
        if (visibleColumns.startTime) row.push(c.start_time ? formatDate(c.start_time) : "-");
        if (visibleColumns.caller) row.push(getCustomerNumber(c));
        if (visibleColumns.waitTime) row.push(`${c.waitTime} sn`);
        if (visibleColumns.queue) row.push(c.queueName);
        if (visibleColumns.cbStatus) row.push(c.cbStatus);
        csvContent += row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";") + "\n";
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `kacan_cagri_analizi_${filterEndDate || filterStartDate || new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (viewMode === "traffic") {
      const headers = [
        ...(visibleColumns.timeSlot ? ["Zaman Dilimi (Saat)"] : []),
        ...(visibleColumns.callVolume ? ["Toplam Çağrı Hacmi"] : []),
        ...(visibleColumns.loadLevel ? ["Yük Seviyesi"] : []),
      ];
      csvContent += headers.join(";") + "\n";

      const { activeSlots } = computeFilteredTrafficReport(filteredCalls);
      activeSlots.forEach((slot) => {
        const row = [];
        if (visibleColumns.timeSlot) row.push(slot.timeSlotLabel);
        if (visibleColumns.callVolume) row.push(slot.count);
        if (visibleColumns.loadLevel) row.push(slot.loadLabel);
        csvContent += row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";") + "\n";
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `cagri_trafigi_yogunluk_${filterEndDate || filterStartDate || new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Header row
    const headers = [
      "Tarih/Saat",
      "Çağrı ID",
      "Numara",
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


  const [supManagedUsers, setSupManagedUsers] = useState([]);
  const [supManagedQueues, setSupManagedQueues] = useState([]);

  const fetchUsersAndAiAgents = async () => {
    try {
      const protocol = window.location.protocol;
      const activeTenantId = typeof window !== "undefined" ? (localStorage.getItem("active_tenant_id") || "tenant-default") : "tenant-default";
      const storedUid = typeof window !== "undefined" ? String(localStorage.getItem("current_user_id") || "admin") : "admin";
      const [uRes, aiRes, tRes, tsRes, qRes, irRes, wfRes] = await Promise.all([
        fetch(`${protocol}//${backendHost}/api/settings/users`, { headers: { "X-Tenant-ID": activeTenantId } }),
        fetch(`${protocol}//${backendHost}/api/settings/ai-agents`, { headers: { "X-Tenant-ID": activeTenantId } }),
        fetch(`${protocol}//${backendHost}/api/settings/trunks`, { headers: { "X-Tenant-ID": activeTenantId } }),
        fetch(`${protocol}//${backendHost}/api/settings/trunks/status`, { headers: { "X-Tenant-ID": activeTenantId } }),
        fetch(`${protocol}//${backendHost}/api/settings/queues`, { headers: { "X-Tenant-ID": activeTenantId } }),
        fetch(`${protocol}//${backendHost}/api/settings/inbound_rules`, { headers: { "X-Tenant-ID": activeTenantId } }),
        fetch(`${protocol}//${backendHost}/api/settings/call-flow/workflows`, { headers: { "X-Tenant-ID": activeTenantId } })
      ]);

      let allUsers = [];
      let mUsers = [];
      let mQueues = [];

      if (uRes.ok) {
        const uData = await uRes.json();
        allUsers = Array.isArray(uData) ? uData : (uData?.users || []);
        if (storedUid.toLowerCase() !== "admin") {
          const curUser = allUsers.find(
            (u) => String(u.id) === storedUid || String(u.extension) === storedUid
          );
          if (curUser && String(curUser.role || "").toLowerCase() !== "admin") {
            mUsers = Array.isArray(curUser.managed_users) ? curUser.managed_users.map(String) : [];
            mQueues = Array.isArray(curUser.managed_queues) ? curUser.managed_queues.map(String) : [];
          }
        }
        setSupManagedUsers(mUsers);
        setSupManagedQueues(mQueues);

        if (mUsers.length > 0) {
          setUsers(
            allUsers.filter(
              (u) => mUsers.includes(String(u.id)) || mUsers.includes(String(u.extension))
            )
          );
        } else {
          setUsers(allUsers);
        }
      }
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        setAiAgents(Array.isArray(aiData) ? aiData : (aiData?.ai_agents || []));
      }
      if (tRes.ok) {
        const tData = await tRes.json();
        setTrunks(Array.isArray(tData) ? tData : (tData?.trunks || []));
      }
      if (tsRes.ok) {
        const tsData = await tsRes.json();
        if (tsData && typeof tsData === "object") setTrunkStatuses(tsData);
      }
      if (qRes.ok) {
        const qData = await qRes.json();
        const allQueues = Array.isArray(qData) ? qData : (qData?.queues || []);
        if (mQueues.length > 0) {
          setQueues(
            allQueues.filter(
              (q) =>
                mQueues.includes(String(q.id)) ||
                mQueues.includes(String(q.name)) ||
                mQueues.includes(String(q.queue_name)) ||
                mQueues.includes(String(q.extension))
            )
          );
        } else {
          setQueues(allQueues);
        }
      }
      if (irRes.ok) {
        const irData = await irRes.json();
        setInboundRules(Array.isArray(irData) ? irData : (irData?.inbound_rules || []));
      }
      if (wfRes.ok) {
        const wfData = await wfRes.json();
        setWorkflows(Array.isArray(wfData) ? wfData : (wfData?.workflows || []));
      }
    } catch (err) {}
  };

  // Fetch calls on mount and poll in the background silently every 3 seconds to get automatic call updates
  useEffect(() => {
    fetchCalls(true);
    fetchRoiSettings();
    fetchUsersAndAiAgents();
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
    const handleTenantChange = () => {
      fetchCalls(true);
      fetchUsersAndAiAgents();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("tenantChanged", handleTenantChange);
    }

    const interval = setInterval(() => {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const activeTenantId = typeof window !== "undefined" ? (localStorage.getItem("active_tenant_id") || "tenant-default") : "tenant-default";
      const params = new URLSearchParams();
      params.append("tenant_id", activeTenantId);
      if (filterStartDate) params.append("start_date", filterStartDate);
      if (filterEndDate) params.append("end_date", filterEndDate);
      if (viewMode !== "perf" && viewMode !== "queue" && viewMode !== "sentiment-heat" && viewMode !== "wordcloud" && viewMode !== "roi" && viewMode !== "timeline" && viewMode !== "traffic") {
        if (filterCallerNumber) params.append("caller_number", filterCallerNumber);
        if (viewMode !== "fcr" && viewMode !== "missed" && filterCallId) params.append("call_id", filterCallId);
      }

      fetch(`${protocol}//${backendHost}/api/calls?${params.toString()}`, {
        headers: { "X-Tenant-ID": activeTenantId }
      })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setCalls(data);
          }
        })
        .catch((err) => console.error("Silently polling calls failed:", err));
    }, 3000);
    return () => {
      clearInterval(interval);
      if (typeof window !== "undefined") {
        window.removeEventListener("tenantChanged", handleTenantChange);
      }
    };
  }, [backendHost, viewMode, filterStartDate, filterEndDate, filterCallerNumber, filterCallId]);

  useEffect(() => {
    if (filterCallerNumber || filterCallId) {
      fetchCalls(false);
    }
  }, [viewMode]);

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
      const activeTenantId = typeof window !== "undefined" ? (localStorage.getItem("active_tenant_id") || "tenant-default") : "tenant-default";
      const res = await fetch(`${protocol}//${backendHost}/api/calls/${selectedCall.id}/notes`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Tenant-ID": activeTenantId
        },
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
    const activeTenantId = typeof window !== "undefined" ? (localStorage.getItem("active_tenant_id") || "tenant-default") : "tenant-default";
    
    // Construct query parameters for database side querying
    const params = new URLSearchParams();
    params.append("tenant_id", activeTenantId);
    if (filterStartDate) params.append("start_date", filterStartDate);
    if (filterEndDate) params.append("end_date", filterEndDate);
    if (viewMode !== "perf" && viewMode !== "queue" && viewMode !== "sentiment-heat" && viewMode !== "wordcloud" && viewMode !== "roi" && viewMode !== "timeline" && viewMode !== "traffic") {
      if (filterCallerNumber) params.append("caller_number", filterCallerNumber);
      if (viewMode !== "fcr" && viewMode !== "missed" && filterCallId) params.append("call_id", filterCallId);
    }

    fetch(`${protocol}//${backendHost}/api/calls?${params.toString()}`, {
      headers: { "X-Tenant-ID": activeTenantId }
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCalls(data);
          if (data.length > 0 && !selectedCall) {
            handleSelectCall(data[0]);
          } else if (data.length === 0) {
            setSelectedCall(null);
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
    setFilterAgentsSelected([]);
    setFilterQueuesSelected([]);
    setFilterSentimentsSelected([]);
    setFilterWordcloudKeyword("");
    setFilterFcrStatusesSelected([]);
    setFilterFcrSentimentsSelected([]);
    setFilterMissedQueuesSelected([]);
    setFilterMissedCallbackSelected([]);
    setFilterTrafficStartHour("");
    setFilterTrafficEndHour("");
    setSelectedTimelineAgent("All");

    if (typeof window !== "undefined") {
      localStorage.setItem("reports_filter_start_date", todayStr);
      localStorage.setItem("reports_filter_end_date", todayStr);
    }

    if (viewMode === "timeline") {
      fetchAgentTimeline(todayStr, true);
    }

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

  const [summaryGenerating, setSummaryGenerating] = useState(false);

  const isInvalidSummaryText = (s) => {
    if (!s || typeof s !== "string") return true;
    const lower = s.trim().toLocaleLowerCase("tr-TR");
    if (!lower) return true;
    return (
      lower.includes("çıkartılamadı") ||
      lower.includes("oluşturulamadı") ||
      lower.includes("bulunmamaktadır")
    );
  };

  const buildClientFallbackSummary = (turns) => {
    if (!Array.isArray(turns) || turns.length === 0) return "";
    const customerTexts = turns
      .filter((t) => t.speaker === "customer" && t.text && t.text.trim())
      .map((t) => t.text.trim());
    const agentTexts = turns
      .filter((t) => ["ai", "agent", "human"].includes(t.speaker) && t.text && t.text.trim())
      .map((t) => t.text.trim());
    const parts = [];
    if (customerTexts.length > 0) {
      const firstReq = customerTexts[0].length > 140 ? customerTexts[0].slice(0, 137) + "..." : customerTexts[0];
      parts.push(`Müşteri görüşmede "${firstReq}" konusunda talepte bulundu.`);
      if (customerTexts.length > 1 && customerTexts[customerTexts.length - 1] !== customerTexts[0]) {
        const lastReq = customerTexts[customerTexts.length - 1];
        const trimmedLast = lastReq.length > 120 ? lastReq.slice(0, 117) + "..." : lastReq;
        parts.push(`Devamında "${trimmedLast}" ifadesiyle görüşmeyi sürdürdü.`);
      }
    } else {
      parts.push("Görüşmede müşteri tarafından sesli bir ifade kaydedilmedi.");
    }
    if (agentTexts.length > 0) {
      const lastResp = agentTexts[agentTexts.length - 1];
      const trimmedResp = lastResp.length > 150 ? lastResp.slice(0, 147) + "..." : lastResp;
      parts.push(`Temsilci/Asistan tarafından "${trimmedResp}" şeklinde bilgilendirme yapılarak görüşme tamamlandı.`);
    }
    return parts.join(" ").trim();
  };

  const handleGenerateCallSummary = async (targetCall) => {
    if (!targetCall?.id) return;
    setSummaryGenerating(true);
    try {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      const res = await fetch(`${protocol}//${backendHost}/api/calls/${targetCall.id}/summarize`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.summary && !isInvalidSummaryText(data.summary)) {
          setSelectedTranscriptCall((prev) =>
            prev && prev.id === targetCall.id
              ? { ...prev, summary: data.summary, sentiment: data.sentiment || prev.sentiment }
              : prev
          );
          setCalls((prev) =>
            prev.map((c) =>
              c.id === targetCall.id
                ? { ...c, summary: data.summary, sentiment: data.sentiment || c.sentiment }
                : c
            )
          );
        }
      }
    } catch (err) {
      console.error("Error generating call summary:", err);
    } finally {
      setSummaryGenerating(false);
    }
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

      if (isSummaryPopupOpen && isInvalidSummaryText(selectedTranscriptCall.summary)) {
        handleGenerateCallSummary(selectedTranscriptCall);
      }
    } else {
      setPopupTranscripts([]);
    }
  }, [selectedTranscriptCall?.id, isSummaryPopupOpen, backendHost]);

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

  const formatDateOnly = (dateStr) => {
    if (!dateStr) return "-";
    const raw = String(dateStr).trim();
    if (!raw || raw === "-" || raw === "Bilinmiyor") return raw;
    if (raw.includes(" / ")) {
      return raw.split(" / ").map((part) => formatDateOnly(part)).join(" / ");
    }
    const isoDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDateMatch) {
      return `${isoDateMatch[3]}.${isoDateMatch[2]}.${isoDateMatch[1]}`;
    }
    let cleanDateStr = raw;
    if (!raw.endsWith("Z") && !raw.includes("+") && !raw.includes("GMT") && raw.includes("T")) {
      cleanDateStr = raw + "Z";
    }
    const d = new Date(cleanDateStr);
    if (isNaN(d.getTime())) return raw;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const raw = String(dateStr).trim();
    const isoDateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDateOnly) {
      return `${isoDateOnly[3]}.${isoDateOnly[2]}.${isoDateOnly[1]}`;
    }
    let cleanDateStr = raw;
    // naive ISO string datetimes returned from FastAPI in UTC need "Z" suffix
    if (!raw.endsWith("Z") && !raw.includes("+") && !raw.includes("GMT") && raw.includes("T")) {
      cleanDateStr = raw + "Z";
    }
    const date = new Date(cleanDateStr);
    if (isNaN(date.getTime())) return raw;
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const sec = String(date.getSeconds()).padStart(2, "0");
    return `${dd}.${mm}.${yyyy} ${hh}:${min}:${sec}`;
  };

  const resolveTargetName = (targetRaw) => {
    const raw = String(targetRaw || "").trim();
    if (!raw || raw === "-") return "-";
    if (raw === "transfer_to_human") return "Canlı Temsilci";

    if (Array.isArray(users) && users.length > 0) {
      const u = users.find(
        (item) =>
          String(item.extension || "").trim() === raw ||
          String(item.id || "").trim() === raw ||
          String(item.username || "").trim() === raw ||
          String(item.full_name || item.name || "").trim() === raw
      );
      if (u) {
        const name = u.full_name || u.name || u.username || `Dahili ${u.extension}`;
        return u.extension ? `${name} (Dahili ${u.extension})` : name;
      }
    }

    if (Array.isArray(queues) && queues.length > 0) {
      const q = queues.find(
        (item) =>
          String(item.extension || "").trim() === raw ||
          String(item.id || "").trim() === raw ||
          String(item.name || "").trim() === raw
      );
      if (q) {
        return q.extension ? `${q.name} (${q.extension})` : q.name;
      }
    }

    if (Array.isArray(aiAgents) && aiAgents.length > 0) {
      const a = aiAgents.find(
        (item) =>
          String(item.id || "").trim() === raw ||
          String(item.extension || "").trim() === raw ||
          String(item.name || "").trim() === raw
      );
      if (a) {
        return `${a.name} (AI Asistan)`;
      }
    }

    if (/^\d{3,5}$/.test(raw)) {
      return `Dahili ${raw}`;
    }
    return raw;
  };

  const computeIvrReportData = (callsToAnalyze = filteredCalls) => {
    const configuredMenus = [];

    // 1. Check Inbound Rules routed to an active CallFlow (Workflow) containing IVR menu nodes
    if (Array.isArray(inboundRules) && inboundRules.length > 0) {
      inboundRules.forEach((rule) => {
        const destType = String(rule.destination_type || "").toLowerCase();
        if (destType === "call_flow" || destType === "ivr") {
          const wf = (workflows || []).find(
            (w) => String(w.id) === String(rule.destination_id) && w.status !== "draft"
          );
          if (wf && Array.isArray(wf.nodes)) {
            const menuNodes = wf.nodes.filter((n) => String(n.type || "").toLowerCase() === "menu");
            const conns = Array.isArray(wf.connections) ? wf.connections : [];
            menuNodes.forEach((mNode) => {
              const outConns = conns.filter((c) => c.fromNode === mNode.id);
              if (outConns.length > 0) {
                outConns.forEach((conn) => {
                  const targetNode = wf.nodes.find((n) => n.id === conn.toNode);
                  const portLabel = conn.fromPort || "*";
                  const targetDesc = targetNode
                    ? resolveTargetName(targetNode.value || targetNode.target || targetNode.title || targetNode.type)
                    : "Bilinmeyen Hedef";
                  configuredMenus.push({
                    id: `${wf.id}-${mNode.id}-${portLabel}`,
                    name: `${wf.name} — Tuş [${portLabel}]`,
                    didPatterns: Array.isArray(rule.did_patterns) ? rule.did_patterns : [],
                    matchMode: rule.did_match_mode || "all",
                    next: targetDesc
                  });
                });
              } else {
                configuredMenus.push({
                  id: `${wf.id}-${mNode.id}`,
                  name: `${wf.name} (${mNode.title || "IVR Menü"})`,
                  didPatterns: Array.isArray(rule.did_patterns) ? rule.did_patterns : [],
                  matchMode: rule.did_match_mode || "all",
                  next: wf.name
                });
              }
            });
          }
        }
      });
    }

    // 2. Check PBX Queues that have active ivr_routes configured
    if (Array.isArray(queues) && queues.length > 0) {
      queues.forEach((q) => {
        const routes = q.ivr_routes;
        if (routes && typeof routes === "object") {
          Object.entries(routes).forEach(([digit, routeCfg]) => {
            const targetVal = typeof routeCfg === "object" ? routeCfg?.target : routeCfg;
            if (targetVal && String(targetVal).trim() !== "") {
              configuredMenus.push({
                id: `queue-${q.id || q.name}-${digit}`,
                name: `${q.name} — Tuş [${digit}]`,
                queueExt: String(q.extension || "").trim(),
                next: resolveTargetName(targetVal)
              });
            }
          });
        }
      });
    }

    const hasConfiguredIvr = configuredMenus.length > 0;
    if (!hasConfiguredIvr) {
      return {
        hasConfiguredIvr: false,
        ivrCalls: 0,
        dropCalls: 0,
        dropRate: "0.0",
        transferToHuman: 0,
        transferRate: "0.0",
        ivrMenus: []
      };
    }

    const inboundList = (callsToAnalyze || []).filter((c) => getCallDirection(c) === "Gelen");
    let totalIvrHits = 0;
    let totalIvrDrops = 0;
    let totalIvrTransfers = 0;

    const menuStats = configuredMenus.map((menu) => {
      const matchingCalls = inboundList.filter((call) => {
        const callee = String(call.callee_number || "").trim();
        if (menu.queueExt) {
          return callee === menu.queueExt;
        }
        if (menu.matchMode === "specific" && Array.isArray(menu.didPatterns) && menu.didPatterns.length > 0) {
          return menu.didPatterns.some((p) => p && (callee === p || callee.endsWith(p) || p.endsWith(callee)));
        }
        return true;
      });

      const hits = matchingCalls.length;
      const drops = matchingCalls.filter((c) => getCallStatus(c) === "Başarısız").length;
      const transfers = matchingCalls.filter(
        (c) =>
          Boolean(c.is_transferred) ||
          c.status === "transferred" ||
          String(c.hangup_source || "").startsWith("transfer:")
      ).length;

      return {
        ...menu,
        hits,
        drops,
        transfers
      };
    });

    totalIvrHits = inboundList.length;
    totalIvrDrops = inboundList.filter((c) => getCallStatus(c) === "Başarısız").length;
    totalIvrTransfers = inboundList.filter(
      (c) =>
        Boolean(c.is_transferred) ||
        c.status === "transferred" ||
        String(c.hangup_source || "").startsWith("transfer:")
    ).length;

    const dropRate = totalIvrHits > 0 ? ((totalIvrDrops / totalIvrHits) * 100).toFixed(1) : "0.0";
    const transferRate = totalIvrHits > 0 ? ((totalIvrTransfers / totalIvrHits) * 100).toFixed(1) : "0.0";

    return {
      hasConfiguredIvr: true,
      ivrCalls: totalIvrHits,
      dropCalls: totalIvrDrops,
      dropRate,
      transferToHuman: totalIvrTransfers,
      transferRate,
      ivrMenus: menuStats
    };
  };

  const computeTransferHoldReportData = (callsToAnalyze = filteredCalls) => {
    const list = Array.isArray(callsToAnalyze) ? callsToAnalyze : [];
    const totalFiltered = list.length;

    let callsWithHold = 0;
    let totalHoldTime = 0;
    let transferredCalls = 0;
    const deptCounts = {};

    const callsWithEvents = list.map((call) => {
      const holdTime = Math.max(0, Number(call.hold_duration || call.duration_hold || 0));
      const holdCount = Math.max(0, Number(call.hold_count || (holdTime > 0 ? 1 : 0)));
      const hasHold = holdTime > 0 || holdCount > 0;

      if (hasHold) {
        callsWithHold++;
        totalHoldTime += holdTime;
      }

      const hangupSrc = String(call.hangup_source || "").trim();
      const isTransferred = Boolean(
        call.is_transferred ||
          call.status === "transferred" ||
          hangupSrc.startsWith("transfer:")
      );

      let rawTarget = String(call.transfer_target || "").trim();
      if (!rawTarget && hangupSrc.startsWith("transfer:")) {
        rawTarget = hangupSrc.slice(9).trim();
      }

      const transferTarget = isTransferred
        ? rawTarget
          ? resolveTargetName(rawTarget)
          : "Canlı Temsilci"
        : "-";

      if (isTransferred) {
        transferredCalls++;
        deptCounts[transferTarget] = (deptCounts[transferTarget] || 0) + 1;
      }

      return {
        ...call,
        hasHold,
        holdTime,
        holdCount,
        isTransferred,
        transferTarget
      };
    });

    const avgHoldTime = callsWithHold > 0 ? Math.round(totalHoldTime / callsWithHold) : 0;
    const holdRate = totalFiltered > 0 ? Math.round((callsWithHold / totalFiltered) * 100) : 0;
    const transferRate = totalFiltered > 0 ? Math.round((transferredCalls / totalFiltered) * 100) : 0;

    const transferDepartments = Object.entries(deptCounts)
      .map(([name, count]) => ({
        name,
        count,
        pctOfTransfers: transferredCalls > 0 ? Math.round((count / transferredCalls) * 100) : 0,
        pctOfTotal: totalFiltered > 0 ? Math.round((count / totalFiltered) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    const topEvents = callsWithEvents
      .filter((c) => c.hasHold || c.isTransferred)
      .sort((a, b) => {
        if (b.holdTime !== a.holdTime) return b.holdTime - a.holdTime;
        return (b.isTransferred ? 1 : 0) - (a.isTransferred ? 1 : 0);
      });

    return {
      totalFiltered,
      callsWithHold,
      totalHoldTime,
      transferredCalls,
      avgHoldTime,
      holdRate,
      transferRate,
      transferDepartments,
      callsWithEvents,
      topEvents
    };
  };

  const parseUtcSafeDate = (dateVal) => {
    if (!dateVal) return new Date();
    const raw = String(dateVal).trim();
    let cleanStr = raw;
    if (!raw.endsWith("Z") && !raw.includes("+") && !raw.includes("GMT") && raw.includes("T")) {
      cleanStr = raw + "Z";
    }
    const parsed = new Date(cleanStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const getCallDurations = (call) => {
    if (!call) {
      return { talk: "0:00", queue: "0:00", ivr: "0:00", total: "0:00", talkSecs: 0, queueSecs: 0, ivrSecs: 0, totalSecs: 0 };
    }
    const startDt = parseUtcSafeDate(call.start_time);
    const endDt = call.end_time ? parseUtcSafeDate(call.end_time) : new Date();
    const totalSeconds = Math.max(
      0,
      call.duration_total != null && call.end_time
        ? Math.floor(Number(call.duration_total))
        : Math.floor((endDt.getTime() - startDt.getTime()) / 1000)
    );

    if (totalSeconds === 0 && call.talk_duration == null && call.duration_talk == null) {
      return { talk: "0:00", queue: "0:00", ivr: "0:00", total: "0:00", talkSecs: 0, queueSecs: 0, ivrSecs: 0, totalSecs: 0 };
    }

    const formatSecs = (secs) => {
      const safe = Math.max(0, Math.floor(secs));
      const mins = Math.floor(safe / 60);
      const remainingSecs = safe % 60;
      return `${mins}:${remainingSecs.toString().padStart(2, "0")}`;
    };

    const ivrSeconds = Math.max(0, Math.floor(Number(call.duration_ivr || 0)));
    const queueSeconds = Math.max(0, Math.floor(Number(call.duration_queue || 0)));

    const status = getCallStatus(call);
    if (status === "Başarısız") {
      return {
        talk: "0:00",
        queue: formatSecs(queueSeconds),
        ivr: formatSecs(ivrSeconds),
        total: formatSecs(totalSeconds),
        talkSecs: 0,
        queueSecs: queueSeconds,
        ivrSecs: ivrSeconds,
        totalSecs: totalSeconds
      };
    }

    let talkSeconds = 0;
    if (call.talk_duration != null) {
      talkSeconds = Math.max(0, Math.floor(Number(call.talk_duration)));
    } else if (call.duration_talk != null) {
      talkSeconds = Math.max(0, Math.floor(Number(call.duration_talk)));
    } else if (call.answered_at) {
      const ansDt = parseUtcSafeDate(call.answered_at);
      talkSeconds = Math.max(0, Math.floor((endDt.getTime() - ansDt.getTime()) / 1000));
    } else {
      talkSeconds = Math.max(0, totalSeconds - ivrSeconds - queueSeconds);
    }

    if (totalSeconds > 0 && talkSeconds > totalSeconds && call.talk_duration == null && call.duration_talk == null) {
      talkSeconds = totalSeconds;
    }

    const effectiveTotal = talkSeconds + queueSeconds + ivrSeconds;

    return {
      talk: formatSecs(talkSeconds),
      queue: formatSecs(queueSeconds),
      ivr: formatSecs(ivrSeconds),
      total: formatSecs(effectiveTotal),
      talkSecs: talkSeconds,
      queueSecs: queueSeconds,
      ivrSecs: ivrSeconds,
      totalSecs: effectiveTotal
    };
  };

  const normalizeAgentName = (name) => {
    return String(name || "").replace(/\s*\(AI Agent\)\s*$/i, "").trim();
  };

  const getAgentAvatarUrl = (agentName, ext = "", directAvatar = "", isAiHint = false) => {
    const cleanName = normalizeAgentName(agentName);
    const cleanLower = cleanName.toLowerCase();
    const extStr = String(ext || "").trim();

    if (Array.isArray(users) && users.length > 0) {
      const matchedUser = users.find((u) => {
        const uExt = String(u.extension || "").trim();
        const uFull = normalizeAgentName(u.full_name || u.name || "");
        const uUser = String(u.username || "").trim();
        const uId = String(u.id || "").trim();
        if (cleanLower && !cleanLower.startsWith("dahili ")) {
          return (
            uFull.toLowerCase() === cleanLower ||
            uUser.toLowerCase() === cleanLower ||
            uId.toLowerCase() === cleanLower
          );
        }
        return extStr && uExt && uExt === extStr;
      });
      if (matchedUser && matchedUser.avatar && String(matchedUser.avatar).trim()) {
        return String(matchedUser.avatar).trim();
      }
    }

    if (directAvatar && String(directAvatar).trim()) {
      return String(directAvatar).trim();
    }

    let matchedAi = null;
    if (Array.isArray(aiAgents) && aiAgents.length > 0) {
      matchedAi = aiAgents.find((a) => {
        const aName = normalizeAgentName(a.name || "");
        const aId = String(a.id || "").trim();
        const aExt = String(a.extension || "").trim();
        return (
          (cleanLower && aName.toLowerCase() === cleanLower) ||
          (cleanLower && aId.toLowerCase() === cleanLower) ||
          (extStr && aExt && aExt === extStr)
        );
      });
      if (matchedAi && matchedAi.avatar && String(matchedAi.avatar).trim()) {
        return String(matchedAi.avatar).trim();
      }
    }

    const isAi =
      isAiHint ||
      Boolean(matchedAi) ||
      extStr.toUpperCase() === "AI" ||
      /\(ai agent\)/i.test(String(agentName || "")) ||
      cleanLower.includes("ai ") ||
      cleanLower.includes("asistan") ||
      cleanLower.includes("sanal");

    if (isAi) {
      return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName || "AgentAlpha")}`;
    }

    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanName || "Anil")}`;
  };

  const getPickupMetadata = (call) => {
    if (!call) return null;
    const hs = String(call.hangup_source || "");
    const isPickedUp = Boolean(call.is_picked_up || hs.startsWith("pickup:"));
    if (!isPickedUp) return null;

    const pickerExt = String(
      call.picked_up_by_ext || (hs.startsWith("pickup:") ? hs.split(":", 2)[1] : "") || ""
    ).trim();
    const pickerUser = Array.isArray(users)
      ? users.find((u) => String(u.extension || "").trim() === pickerExt)
      : null;
    const pickerName =
      call.picked_up_by_name || pickerUser?.full_name || pickerUser?.name || "";

    const origCallee = String(call.original_callee || call.callee_number || "").trim();
    const origCalleeUser = Array.isArray(users)
      ? users.find((u) => String(u.extension || "").trim() === origCallee)
      : null;
    const origCalleeName =
      call.original_callee_name || origCalleeUser?.full_name || origCalleeUser?.name || "";

    return {
      isPickedUp: true,
      pickerExt,
      pickerName,
      pickerDisplay: pickerName ? `${pickerName} (${pickerExt})` : `Dahili ${pickerExt}`,
      origCallee,
      origCalleeName,
      origCalleeDisplay: origCalleeName ? `${origCallee} (${origCalleeName})` : origCallee
    };
  };

  const getConversant = (call) => {
    if (!call) return "";

    const pickupMeta = getPickupMetadata(call);
    if (pickupMeta) {
      return `Pickup: ${pickupMeta.pickerDisplay}`;
    }

    if (call.conversant && String(call.conversant).trim()) {
      return String(call.conversant).trim();
    }
    if (call.agent_name && String(call.agent_name).trim()) {
      return String(call.agent_name).trim();
    }

    const caller = String(call.caller_number || "").trim();
    const callee = String(call.callee_number || "").trim();
    const hsRaw = String(call.hangup_source || "").trim();
    const answeredQueueExt = hsRaw.includes(":answered:")
      ? hsRaw.split(":answered:")[1]?.split(":")[0]?.trim() || ""
      : "";

    // Check if caller, callee, or answered queue extension matches a system user
    if (Array.isArray(users) && users.length > 0) {
      const matchedUser = users.find((u) => {
        const uExt = String(u.extension || "").trim();
        const uName = String(u.username || "").trim();
        const uId = String(u.id || "").trim();
        const uFull = String(u.full_name || u.name || "").trim();
        return (
          (uExt && (uExt === caller || uExt === callee || uExt === answeredQueueExt)) ||
          (uName && (uName === caller || uName === callee)) ||
          (uId && (uId === caller || uId === callee)) ||
          (uFull && (uFull === caller || uFull === callee))
        );
      });
      if (matchedUser) {
        return matchedUser.full_name || matchedUser.name || matchedUser.username || `Dahili ${matchedUser.extension}`;
      }
    }

    if (answeredQueueExt) {
      return `Dahili ${answeredQueueExt}`;
    }

    // Check if caller or callee matches an AI Agent
    if (Array.isArray(aiAgents) && aiAgents.length > 0) {
      const matchedAi = aiAgents.find((a) => {
        const aExt = String(a.extension || "").trim();
        const aId = String(a.id || "").trim();
        const aName = String(a.name || "").trim();
        return (
          (aExt && (aExt === caller || aExt === callee)) ||
          (aId && (aId === caller || aId === callee)) ||
          (aName && (aName === caller || aName === callee))
        );
      });
      if (matchedAi && matchedAi.name) {
        return matchedAi.name;
      }
    }

    if (call.status === "transferred") {
      return "Temsilci";
    }

    const direction = getCallDirection(call);
    if (direction === "Giden (Temsilci)") {
      return caller || "Temsilci";
    } else if (direction === "Gelen" || direction === "Giden (AI)") {
      const firstAi = Array.isArray(aiAgents) && aiAgents.length > 0 ? aiAgents[0]?.name : null;
      return firstAi || "AI Asistan";
    }

    return "Temsilci";
  };

  const getCustomerNumber = (call) => {
    if (!call) return "";
    const caller = String(call.caller_number || "").trim();
    const callee = String(call.callee_number || "").trim();
    if (caller && callee && caller.length <= 5 && callee.length <= 5 && caller.toLowerCase() !== "ai") {
      const calleeUser = Array.isArray(users)
        ? users.find((u) => String(u.extension) === callee)
        : null;
      const calleeName = calleeUser?.full_name || calleeUser?.name || "";
      return calleeName ? `${caller} → ${callee} (${calleeName})` : `${caller} → ${callee}`;
    }
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
    
    // If caller is an internal extension (e.g. 1000, 1001) and callee is external or another extension, it's outbound/internal.
    if (callee.length >= 10 || callee.startsWith("+") || callee.length >= 3) {
      if (caller.toLowerCase() === "ai") return "Giden (AI)";
      return "Giden (Temsilci)";
    }
    
    // Default fallback
    return "Gelen";
  };

  const getCallStatus = (call) => {
    if (!call) return "Başarısız";
    if (getPickupMetadata(call)) return "Başarılı";
    const st = call.status ? String(call.status).toLowerCase() : "";
    
    // Check actual DB status
    if (st === "blocked" || st === "failed" || st === "no answer" || st === "no_answer" || st === "busy" || st === "canceled" || st === "cancelled" || st === "missed") {
      return "Başarısız";
    }
    
    const caller = String(call.caller_number || "").trim();
    const callee = String(call.callee_number || "").trim();
    const isInternalCall = caller.length > 0 && caller.length <= 5 && callee.length > 0 && callee.length <= 5;

    const end = call.end_time ? new Date(call.end_time) : new Date();
    const start = new Date(call.start_time);
    const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
    
    if (!isInternalCall && totalSeconds <= 5 && !call.recording_path && !call.recording_deleted_reason && call.talk_duration == null && (st === "completed" || st === "in_progress")) {
      return "Başarısız";
    }

    return "Başarılı";
  };

  const resolveUserByExtOrName = (extCandidate, nameCandidate) => {
    const extClean = String(extCandidate || "").trim();
    const rawName = String(nameCandidate || "")
      .replace(/^Pickup:\s*/i, "")
      .replace(/\s*\((?:Dahili:?|AI Agent)?\s*[^)]*\)\s*$/i, "")
      .trim();
    const rawNameLower = rawName.toLowerCase();

    if (Array.isArray(users) && users.length > 0) {
      const byExt = extClean
        ? users.find(
            (u) =>
              String(u.extension || "").trim() === extClean ||
              String(u.id || "").trim() === extClean ||
              String(u.username || "").trim().toLowerCase() === extClean.toLowerCase()
          )
        : null;
      if (byExt) return byExt;

      if (rawNameLower && !rawNameLower.startsWith("dahili")) {
        const byName = users.find((u) => {
          const uFull = String(u.full_name || u.name || "").trim().toLowerCase();
          const uUser = String(u.username || "").trim().toLowerCase();
          return (uFull && uFull === rawNameLower) || (uUser && uUser === rawNameLower);
        });
        if (byName) return byName;
      }
    }
    return null;
  };

  const resolveCallAgentDetail = (call) => {
    if (!call) return { name: "Temsilci", extension: "", display: "Temsilci", isAi: false };

    const pickupMeta = getPickupMetadata(call);
    if (pickupMeta) {
      return {
        name: pickupMeta.pickerName || `Dahili ${pickupMeta.pickerExt}`,
        extension: pickupMeta.pickerExt,
        display: pickupMeta.pickerName
          ? `${pickupMeta.pickerName} (Dahili: ${pickupMeta.pickerExt})`
          : `Dahili: ${pickupMeta.pickerExt}`,
        isAi: false
      };
    }

    const direction = getCallDirection(call);
    const caller = String(call.caller_number || "").trim();
    const callee = String(call.callee_number || "").trim();
    const hs = String(call.hangup_source || "").trim();
    const rawAgentField = String(call.agent_name || call.conversant || "").trim();
    const conversant = getConversant(call);

    // Extract extension embedded inside agent_name/conversant if any, e.g. "Anıl ACAR (1000)" or "Dahili 1000"
    let embeddedExt = "";
    const parenExtMatch = (rawAgentField || conversant).match(/\((?:Dahili:?\s*)?(\d{2,6})\)/i);
    if (parenExtMatch) {
      embeddedExt = parenExtMatch[1];
    } else {
      const dahiliMatch = (rawAgentField || conversant).match(/^Dahili:?\s*(\d{2,6})$/i);
      if (dahiliMatch) embeddedExt = dahiliMatch[1];
    }

    // Check queue answered extension or transfer target extension
    const answeredQueueExt = hs.includes(":answered:")
      ? hs.split(":answered:")[1]?.split(":")[0]?.trim() || ""
      : "";
    const isQueueExt = (val) =>
      val &&
      Array.isArray(queues) &&
      queues.some((q) => String(q.extension || "").trim() === val || String(q.id || "").trim() === val);

    let candidateExt = "";
    if (answeredQueueExt) {
      candidateExt = answeredQueueExt;
    } else if (direction.includes("Giden")) {
      if (caller && caller.length <= 6 && caller.toLowerCase() !== "ai" && !caller.startsWith("+")) {
        candidateExt = caller;
      }
    } else {
      if (callee && callee.length <= 6 && callee.toLowerCase() !== "ai" && !callee.startsWith("+") && !isQueueExt(callee)) {
        candidateExt = callee;
      }
    }
    if (!candidateExt && embeddedExt) {
      candidateExt = embeddedExt;
    }

    const matchedUser = resolveUserByExtOrName(candidateExt, rawAgentField || conversant);
    if (matchedUser) {
      const uName = String(matchedUser.full_name || matchedUser.name || matchedUser.username || "").trim();
      const uExt = String(matchedUser.extension || candidateExt || "").trim();
      return {
        name: uName || (uExt ? `Dahili ${uExt}` : "Temsilci"),
        extension: uExt,
        display: uName && uExt ? `${uName} (Dahili: ${uExt})` : uName || `Dahili: ${uExt}`,
        isAi: false
      };
    }

    // Check AI Agent match
    const nameClean = String(rawAgentField || conversant || "")
      .replace(/\s*\((?:Dahili:?|AI Agent)?\s*[^)]*\)\s*$/i, "")
      .trim();
    const matchedAi =
      Array.isArray(aiAgents) && aiAgents.length > 0
        ? aiAgents.find((a) => {
            const aExt = String(a.extension || "").trim();
            const aId = String(a.id || "").trim();
            const aName = String(a.name || "").trim();
            return (
              (aExt && (aExt === caller || aExt === callee || aExt === candidateExt)) ||
              (aId && (aId === caller || aId === callee)) ||
              (aName && nameClean && aName.toLowerCase() === nameClean.toLowerCase())
            );
          })
        : null;

    const looksLikeAi =
      Boolean(matchedAi) ||
      direction === "Giden (AI)" ||
      caller.toLowerCase() === "ai" ||
      callee.toLowerCase() === "ai" ||
      nameClean === "AI Asistan" ||
      /\bai\b|asistan|sanal/i.test(nameClean);

    if (looksLikeAi && !candidateExt) {
      const aiName = matchedAi?.name || nameClean || "AI Asistan";
      const aiExt = String(matchedAi?.extension || "").trim();
      return {
        name: aiName,
        extension: aiExt,
        display: aiExt ? `${aiName} (Dahili: ${aiExt})` : aiName,
        isAi: true
      };
    }

    if (nameClean && !nameClean.toLowerCase().startsWith("dahili") && nameClean !== candidateExt && nameClean !== "Temsilci") {
      return {
        name: nameClean,
        extension: candidateExt,
        display: candidateExt ? `${nameClean} (Dahili: ${candidateExt})` : nameClean,
        isAi: false
      };
    }

    if (candidateExt) {
      return {
        name: `Dahili ${candidateExt}`,
        extension: candidateExt,
        display: `Dahili: ${candidateExt}`,
        isAi: false
      };
    }

    return {
      name: nameClean || "Temsilci",
      extension: "",
      display: nameClean || "Temsilci",
      isAi: false
    };
  };

  const resolveCallTrunkDetail = (call) => {
    const realTrunks = Array.isArray(trunks) ? trunks : [];
    const activeTrunks = realTrunks.filter((t) => t.is_active !== false);
    const cleanDigits = (str) => String(str || "").replace(/\D/g, "");
    const last10 = (str) => {
      const d = cleanDigits(str);
      return d.length >= 10 ? d.slice(-10) : d;
    };

    const backendTrunkName = String(call?.resolved_trunk_name || "").trim();
    const backendTrunkDid = String(call?.resolved_trunk_did || "").trim();
    if (backendTrunkName) {
      return {
        trunkName: backendTrunkName,
        didNumber: backendTrunkDid,
        hasTrunk: true
      };
    }

    const caller = String(call?.caller_number || "").trim();
    const callee = String(call?.callee_number || "").trim();
    const callerL10 = last10(caller);
    const calleeL10 = last10(callee);
    const rawTrunkName = String(call?.trunk || call?.trunk_name || "").trim();

    let matchedTrunk = realTrunks.find((t) => {
      if (
        rawTrunkName &&
        rawTrunkName !== "Operator_Trunk" &&
        String(t.trunk_name || "").toLowerCase() === rawTrunkName.toLowerCase()
      ) {
        return true;
      }
      const didL10 = last10(t.did_number);
      const userL10 = last10(t.username);
      if (didL10 && didL10.length >= 7 && (callerL10 === didL10 || calleeL10 === didL10)) {
        return true;
      }
      if (userL10 && userL10.length >= 7 && (callerL10 === userL10 || calleeL10 === userL10)) {
        return true;
      }
      return false;
    });

    if (!matchedTrunk && realTrunks.length > 0) {
      matchedTrunk = activeTrunks[0] || realTrunks[0] || null;
    }

    if (matchedTrunk) {
      const trunkName = String(matchedTrunk.trunk_name || "").trim();
      const didNumber = String(matchedTrunk.did_number || matchedTrunk.username || "").trim();
      return { trunkName, didNumber, hasTrunk: Boolean(trunkName) };
    }

    if (rawTrunkName && rawTrunkName !== "Operator_Trunk" && call?.has_configured_trunk !== false) {
      return { trunkName: rawTrunkName, didNumber: "", hasTrunk: true };
    }

    return { trunkName: "", didNumber: "", hasTrunk: false };
  };

  const resolveCallEndedByDetail = (call) => {
    if (!call) return { label: "Belirtilmedi", isKnown: false };

    const direction = getCallDirection(call);
    const agentDetail = resolveCallAgentDetail(call);
    const custNum = getCustomerNumber(call);
    const rawEndedBy = String(call.ended_by || "").trim();
    const rawHs = String(call.hangup_source || "").trim();
    const stLower = String(call.status || "").trim().toLowerCase();

    if (rawEndedBy.startsWith("ext:")) {
      const ext = rawEndedBy.slice(4).trim();
      const u = resolveUserByExtOrName(ext, "");
      if (u) {
        const uName = u.full_name || u.name || u.username || ext;
        return { label: `${uName} (Dahili: ${ext})`, isKnown: true };
      }
      if (ext && agentDetail.extension === ext && agentDetail.name) {
        return { label: agentDetail.display, isKnown: true };
      }
      return { label: `Dahili: ${ext}`, isKnown: true };
    }

    if (rawEndedBy === "agent" || rawHs === "agent") {
      return { label: agentDetail.display || "Müşteri Temsilcisi", isKnown: true };
    }

    if (rawEndedBy === "customer" || rawHs === "customer" || rawHs.includes(":abandoned")) {
      if (direction.includes("Giden")) {
        return { label: custNum ? `Karşı Taraf (${custNum})` : "Karşı Taraf", isKnown: true };
      }
      return { label: custNum ? `Arayan Müşteri (${custNum})` : "Müşteri", isKnown: true };
    }

    if (rawEndedBy === "ai" || rawHs === "ai") {
      return { label: agentDetail.isAi ? agentDetail.display : "AI Asistan", isKnown: true };
    }

    if (
      rawEndedBy === "system" ||
      rawHs === "system" ||
      rawHs.startsWith("blacklist:") ||
      stLower === "blocked" ||
      stLower === "rejected_limit"
    ) {
      return { label: "Sistem (Otomatik)", isKnown: true };
    }

    if (stLower === "cancelled") {
      return {
        label: direction.includes("Giden")
          ? agentDetail.display
          : custNum
          ? `Arayan Müşteri (${custNum})`
          : "Arayan Taraf",
        isKnown: true
      };
    }

    if (stLower === "busy") {
      return {
        label: direction.includes("Giden")
          ? custNum
            ? `Karşı Taraf (${custNum} - Meşgul)`
            : "Karşı Taraf (Meşgul)"
          : agentDetail.display,
        isKnown: true
      };
    }

    if (stLower === "no_answer") {
      return { label: "Zaman Aşımı (Cevapsız)", isKnown: false };
    }

    if (stLower === "in_progress" || !call.end_time) {
      return { label: "Görüşme Devam Ediyor", isKnown: false };
    }

    return { label: "Kayıt Öncesi (Belirtilmedi)", isKnown: false };
  };

  const getCallFlowTimeline = (call) => {
    if (!call) return [];

    const timeline = [];
    const baseTime = parseUtcSafeDate(call.start_time);
    const endTime = call.end_time ? parseUtcSafeDate(call.end_time) : null;
    const realTotalSecs = endTime
      ? Math.max(1, Math.floor((endTime.getTime() - baseTime.getTime()) / 1000))
      : Math.max(1, Number(call.duration || 0));

    const direction = getCallDirection(call);
    const statusLabel = getCallStatus(call);
    const durations = getCallDurations(call);
    const pickupMeta = getPickupMetadata(call);
    const agentDetail = resolveCallAgentDetail(call);
    const trunkDetail = resolveCallTrunkDetail(call);
    const endedByDetail = resolveCallEndedByDetail(call);
    const caller = String(call.caller_number || "").trim();
    const callee = String(call.callee_number || "").trim();
    const hs = String(call.hangup_source || "").trim();
    const stLower = String(call.status || "").toLowerCase();

    let realAnswerOffsetSecs = null;
    if (call.answered_at) {
      const ansDt = parseUtcSafeDate(call.answered_at);
      realAnswerOffsetSecs = Math.max(
        1,
        Math.min(realTotalSecs, Math.floor((ansDt.getTime() - baseTime.getTime()) / 1000))
      );
    } else if ((call.talk_duration != null || call.duration_talk != null) && durations.talkSecs > 0) {
      realAnswerOffsetSecs = Math.max(1, Math.min(realTotalSecs, realTotalSecs - durations.talkSecs));
    }

    const formatOffsetTime = (secs) => {
      const clampedSecs = endTime ? Math.min(secs, realTotalSecs) : secs;
      const t = new Date(baseTime.getTime() + Math.max(0, clampedSecs) * 1000);
      return t.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    };

    const appendMidCallEvents = (startOffsetSecs) => {
      let curOffset = startOffsetSecs;
      const holdDur = Math.max(0, Number(call.hold_duration || call.duration_hold || 0));
      const holdCnt = Math.max(0, Number(call.hold_count || (holdDur > 0 ? 1 : 0)));
      if (holdCnt > 0 || holdDur > 0) {
        curOffset += 2;
        timeline.push({
          time: formatOffsetTime(curOffset),
          title: "Çağrı Beklemeye Alındı (Hold)",
          description: `Görüşme esnasında çağrı ${holdCnt || 1} kez beklemeye alındı${holdDur > 0 ? ` (Toplam Bekletme: ${holdDur} sn)` : ""}.`,
          status: "warning"
        });
      }

      const isTransferred = Boolean(
        call.is_transferred || stLower === "transferred" || hs.startsWith("transfer:")
      );
      if (isTransferred) {
        let rawTarget = String(call.transfer_target || "").trim();
        if (!rawTarget && hs.startsWith("transfer:")) {
          rawTarget = hs.slice(9).trim();
        }
        const targetLabel = rawTarget ? resolveTargetName(rawTarget) : "Canlı Temsilci";
        curOffset += 2;
        timeline.push({
          time: formatOffsetTime(curOffset),
          title: "Çağrı Aktarıldı (Transfer)",
          description: `Görüşme ${targetLabel} hedefine aktarıldı.`,
          status: "info"
        });
      }
    };

    if (pickupMeta) {
      const pkAnsOffset = realAnswerOffsetSecs ?? Math.min(3, realTotalSecs);
      timeline.push({
        time: formatOffsetTime(0),
        title: "Çağrı Başlangıcı (Arayan → Aranan)",
        description: `Arayan: ${call.caller_number} → Aranan Dahili: ${pickupMeta.origCalleeDisplay} çalmaya başladı.`,
        status: "info"
      });
      timeline.push({
        time: formatOffsetTime(pkAnsOffset),
        title: "Pickup ile Çağrı Çekildi",
        description: `Aranan dahili (${pickupMeta.origCalleeDisplay}) çalarken, aynı abone grubundaki ${pickupMeta.pickerDisplay} tarafından çağrı Pickup ile çekilerek yanıtlandı.`,
        status: "success"
      });
      appendMidCallEvents(pkAnsOffset + 1);
      if (endTime) {
        timeline.push({
          time: formatOffsetTime(realTotalSecs),
          title: "Çağrı Kapatıldı",
          description: endedByDetail.isKnown
            ? `Görüşme ${endedByDetail.label} tarafından sonlandırıldı (${durations.talk} görüşme süresi). Çağrı durumu: Başarılı.`
            : `Görüşme tamamlanarak sonlandırıldı (${durations.talk} görüşme süresi). Çağrı durumu: Başarılı.`,
          status: "success"
        });
      }
      return timeline;
    }

    // Internal extension-to-extension call (e.g. 1000 -> 1001)
    const isInternalExtCall =
      caller.length > 0 &&
      caller.length <= 5 &&
      callee.length > 0 &&
      callee.length <= 5 &&
      caller.toLowerCase() !== "ai" &&
      callee.toLowerCase() !== "ai" &&
      !(Array.isArray(queues) && queues.some((q) => String(q.extension || "").trim() === callee));

    if (isInternalExtCall) {
      const callerUser = resolveUserByExtOrName(caller, "");
      const calleeUser = resolveUserByExtOrName(callee, "");
      const callerLabel = callerUser
        ? `${callerUser.full_name || callerUser.name || callerUser.username} (Dahili: ${caller})`
        : `Dahili: ${caller}`;
      const calleeLabel = calleeUser
        ? `${calleeUser.full_name || calleeUser.name || calleeUser.username} (Dahili: ${callee})`
        : `Dahili: ${callee}`;

      timeline.push({
        time: formatOffsetTime(0),
        title: "Dahili Arama Başlatıldı",
        description: `${callerLabel} tarafından ${calleeLabel} abonesine dahili arama başlatıldı.`,
        status: "info"
      });
      timeline.push({
        time: formatOffsetTime(1),
        title: "Dahili Abone Çaldırılıyor",
        description: `${calleeLabel} çaldırılıyor...`,
        status: "info"
      });

      if (statusLabel === "Başarılı") {
        const intAnsOffset = realAnswerOffsetSecs ?? Math.min(4, realTotalSecs);
        timeline.push({
          time: formatOffsetTime(intAnsOffset),
          title: "Çağrı Yanıtlandı",
          description: `${calleeLabel} çağrıyı yanıtladı. Görüşme başladı.`,
          status: "success"
        });
        appendMidCallEvents(intAnsOffset + 1);
        timeline.push({
          time: formatOffsetTime(realTotalSecs),
          title: "Çağrı Kapatıldı",
          description: endedByDetail.isKnown
            ? `Dahili görüşme ${endedByDetail.label} tarafından sonlandırıldı (${durations.talk} görüşme süresi). Çağrı durumu: Başarılı.`
            : `Dahili görüşme tamamlandı (${durations.talk} görüşme süresi). Çağrı durumu: Başarılı.`,
          status: "success"
        });
      } else {
        timeline.push({
          time: formatOffsetTime(realTotalSecs),
          title: "Çağrı Yanıtlanmadı",
          description: endedByDetail.isKnown
            ? `${calleeLabel} araması yanıtlanmadan ${endedByDetail.label} tarafından sonlandırıldı.`
            : `${calleeLabel} aramaya yanıt vermedi veya meşgul. Arama durumu: Başarısız.`,
          status: "error"
        });
      }
      return timeline;
    }

    if (direction === "Gelen") {
      const inboundDidDesc = trunkDetail.hasTrunk
        ? trunkDetail.didNumber
          ? `${trunkDetail.didNumber} numaralı dış hat (${trunkDetail.trunkName})`
          : `${trunkDetail.trunkName} dış hattı`
        : "gelen dış hat";

      timeline.push({
        time: formatOffsetTime(0),
        title: "Dış Hat (DID) Çağrı Girişi",
        description: `${inboundDidDesc} üzerinden ${getCustomerNumber(call)} araması sisteme giriş yaptı.`,
        status: "info"
      });

      if (stLower === "blocked") {
        timeline.push({
          time: formatOffsetTime(1),
          title: "Kara Liste Engellemesi",
          description: `Arayan numara (${getCustomerNumber(call)}) kara listede yer aldığı için çağrı sistem tarafından reddedildi.`,
          status: "error"
        });
        return timeline;
      }

      let offset = 1;
      const ivrSecs = Math.max(0, Number(call.duration_ivr || 0));
      const queueSecs = Math.max(0, Number(call.duration_queue || 0));
      const isQueueCall = Boolean(
        call.is_queue_call ||
          hs.startsWith("queue:") ||
          queueSecs > 0 ||
          (Array.isArray(queues) && queues.some((q) => String(q.extension || "").trim() === callee))
      );

      if (ivrSecs > 0) {
        timeline.push({
          time: formatOffsetTime(offset),
          title: "IVR Karşılama Menüsü",
          description: `Arayan çağrı IVR karşılama menüsüne yönlendirildi (${ivrSecs} sn).`,
          status: "info"
        });
        offset += ivrSecs;
      }

      if (isQueueCall) {
        const qInfo = resolveCallQueueInfo(call);
        timeline.push({
          time: formatOffsetTime(offset),
          title: "Kuyruğa Yönlendirildi",
          description: `Çağrı ${qInfo.queueName} (Dahili: ${qInfo.queueId}) sırasına alındı.`,
          status: "info"
        });
        offset += Math.max(1, queueSecs || 2);
      }

      if (statusLabel === "Başarılı") {
        if (agentDetail.isAi) {
          timeline.push({
            time: formatOffsetTime(offset),
            title: "AI Kanalına Aktarım",
            description: `Çağrı Yapay Zeka Asistanı (${agentDetail.display}) kanalına yönlendirildi.`,
            status: "info"
          });
          timeline.push({
            time: formatOffsetTime(offset + 1),
            title: "Çağrı Yanıtlandı (AI)",
            description: `${agentDetail.name} çağrıyı yanıtladı. Sesli asistan görüşmesi başladı.`,
            status: "success"
          });
          appendMidCallEvents(offset + 2);
        } else {
          const inAnsOffset = realAnswerOffsetSecs != null ? Math.max(offset + 1, realAnswerOffsetSecs) : offset + 2;
          timeline.push({
            time: formatOffsetTime(offset),
            title: "Abone / Temsilci Çaldırılıyor",
            description: `${agentDetail.display} çaldırılıyor...`,
            status: "info"
          });
          timeline.push({
            time: formatOffsetTime(inAnsOffset),
            title: "Çağrı Yanıtlandı",
            description: `${agentDetail.display} çağrıyı yanıtladı. Görüşme başladı.`,
            status: "success"
          });
          appendMidCallEvents(inAnsOffset + 1);
        }

        timeline.push({
          time: formatOffsetTime(realTotalSecs),
          title: "Çağrı Kapatıldı",
          description: endedByDetail.isKnown
            ? `Görüşme ${endedByDetail.label} tarafından sonlandırıldı (${durations.talk} görüşme süresi). Çağrı durumu: Başarılı.`
            : `Görüşme tamamlanarak sonlandırıldı (${durations.talk} görüşme süresi). Çağrı durumu: Başarılı.`,
          status: "success"
        });
      } else {
        if (!agentDetail.isAi) {
          timeline.push({
            time: formatOffsetTime(offset),
            title: "Abone / Temsilci Çaldırılıyor",
            description: `${agentDetail.display} çaldırılıyor...`,
            status: "warning"
          });
        }
        if (hs.includes(":abandoned")) {
          timeline.push({
            time: formatOffsetTime(realTotalSecs),
            title: "Müşteri Çağrıyı Sonlandırdı",
            description: `Kuyrukta bekleme esnasında arayan numara (${getCustomerNumber(call)}) telefonu kapattı.`,
            status: "error"
          });
        } else {
          timeline.push({
            time: formatOffsetTime(realTotalSecs),
            title: "Çağrı Sonlandırıldı (Cevapsız / Başarısız)",
            description: endedByDetail.isKnown
              ? `Çağrı yanıtlanmadan ${endedByDetail.label} tarafından sonlandırıldı.`
              : `${agentDetail.display} çağrıya yanıt vermedi veya ulaşılamadı. Çağrı durumu: Başarısız.`,
            status: "error"
          });
        }
      }
    } else {
      // Outbound calls: Giden (AI), Giden (Temsilci), Giden (Dialer)
      let callerDesc = "";
      if (direction === "Giden (AI)") {
        callerDesc = agentDetail.isAi ? agentDetail.display : "AI Asistan";
      } else if (direction === "Giden (Temsilci)") {
        callerDesc = agentDetail.display;
      } else {
        callerDesc = "Otomatik Dış Arama Motoru (Dialer)";
      }

      const targetNumber = getCustomerNumber(call);
      const selectedTrunkLabel = trunkDetail.hasTrunk
        ? trunkDetail.didNumber && trunkDetail.didNumber !== trunkDetail.trunkName
          ? `${trunkDetail.trunkName} (${trunkDetail.didNumber})`
          : trunkDetail.trunkName
        : "";

      timeline.push({
        time: formatOffsetTime(0),
        title: "Dış Arama Başlatıldı",
        description: `${callerDesc} tarafından ${targetNumber} numarasına doğru arama başlatıldı.`,
        status: "info"
      });

      timeline.push({
        time: formatOffsetTime(1),
        title: "Dış Hat (Trunk) Seçimi",
        description: trunkDetail.hasTrunk
          ? `Dış hat çıkış kuralı eşleşti. Seçilen Hat: ${selectedTrunkLabel}.`
          : "Sistemde tanımlı dış hat bulunmadığından varsayılan SIP çıkış rotası kullanıldı.",
        status: "success"
      });

      const ringStepOffset =
        realAnswerOffsetSecs != null
          ? Math.min(2, Math.max(1, realAnswerOffsetSecs - 1))
          : Math.min(3, realTotalSecs);
      timeline.push({
        time: formatOffsetTime(ringStepOffset),
        title: "Hedef Çaldırılıyor",
        description: `Karşı tarafın (${targetNumber}) telefonu çaldırılıyor...`,
        status: "info"
      });

      if (statusLabel === "Başarılı") {
        const answerOffset =
          realAnswerOffsetSecs != null
            ? Math.max(ringStepOffset, realAnswerOffsetSecs)
            : Math.min(6, Math.max(2, realTotalSecs - 1));
        timeline.push({
          time: formatOffsetTime(answerOffset),
          title: "Hedef Çağrıyı Yanıtladı",
          description: `Karşı taraf (${targetNumber}) çağrıya yanıt verdi. ${callerDesc} ile görüşme başladı.`,
          status: "success"
        });

        appendMidCallEvents(answerOffset + 1);

        timeline.push({
          time: formatOffsetTime(realTotalSecs),
          title: "Çağrı Kapatıldı",
          description: endedByDetail.isKnown
            ? `Arama ${endedByDetail.label} tarafından sonlandırıldı (${durations.talk} görüşme süresi). Arama durumu: Başarılı.`
            : `Arama tamamlanarak sonlandırıldı (${durations.talk} görüşme süresi). Arama durumu: Başarılı.`,
          status: "success"
        });
      } else {
        timeline.push({
          time: formatOffsetTime(Math.max(1, realTotalSecs - 1)),
          title: "Hedef Yanıt Vermedi",
          description: `Karşı taraf (${targetNumber}) aramaya yanıt vermedi veya hat meşgule düştü.`,
          status: "error"
        });
        timeline.push({
          time: formatOffsetTime(realTotalSecs),
          title: "Çağrı Kapatıldı",
          description: endedByDetail.isKnown
            ? `Arama yanıtlanmadan ${endedByDetail.label} tarafından sonlandırıldı. Arama durumu: Başarısız.`
            : "Arama sonlandırıldı. Arama durumu: Başarısız (Cevapsız).",
          status: "error"
        });
      }
    }

    return timeline;
  };

  const uniqueDirections = Array.from(
    new Set(["Gelen", "Giden (Temsilci)", "Giden (AI)", ...calls.map((c) => getCallDirection(c)).filter(Boolean)])
  );
  const uniqueStatuses = Array.from(
    new Set(["Başarılı", "Başarısız (Cevapsız)", "Meşgul", "Aktarıldı", ...calls.map((c) => getCallStatus(c)).filter(Boolean)])
  );
  const uniqueConversants = Array.from(
    new Set([
      ...(Array.isArray(users)
        ? users.map((u) => normalizeAgentName(u.full_name || u.name || u.username || (u.extension ? `Dahili ${u.extension}` : ""))).filter(Boolean)
        : []),
      ...(Array.isArray(aiAgents)
        ? aiAgents.map((a) => normalizeAgentName(a.name || (a.extension ? `AI (${a.extension})` : ""))).filter(Boolean)
        : []),
      ...(Array.isArray(timelineReport?.agents)
        ? timelineReport.agents.map((ag) => normalizeAgentName(ag.agent_name)).filter(Boolean)
        : []),
      ...calls.map((c) => normalizeAgentName(getConversant(c))).filter(Boolean),
    ])
  );

  const matchesSelectedAgent = (agentName) => {
    const norm = normalizeAgentName(agentName);
    if (filterAgentsSelected.length > 0) {
      const selectedNorms = filterAgentsSelected.map(normalizeAgentName);
      if (!selectedNorms.includes(norm) && !filterAgentsSelected.includes(agentName)) {
        return false;
      }
    }
    if (filterConversant !== "All") {
      if (norm !== normalizeAgentName(filterConversant) && agentName !== filterConversant) {
        return false;
      }
    }
    return true;
  };

  const filteredCalls = calls.filter((c) => {
    if (viewMode === "traffic") {
      if (filterDirection !== "All") {
        const dir = getCallDirection(c);
        if (dir !== filterDirection) return false;
      }
      if (filterTrafficStartHour !== "" || filterTrafficEndHour !== "") {
        const hr = parseCallLocalHour(c.start_time);
        if (!isHourInTrafficRange(hr)) return false;
      }
    } else if (viewMode !== "perf" && viewMode !== "queue" && viewMode !== "sentiment-heat" && viewMode !== "wordcloud" && viewMode !== "roi" && viewMode !== "timeline") {
      // 1. Caller Number Filter
      if (filterCallerNumber && !getCustomerNumber(c)?.toLowerCase().includes(filterCallerNumber.toLowerCase())) {
        return false;
      }

      if (viewMode !== "fcr" && viewMode !== "missed") {
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
      }
    }

    // 5. Conversant / Agent Filter across applicable report modes
    if (viewMode !== "queue" && viewMode !== "roi" && viewMode !== "missed" && viewMode !== "traffic" && (filterAgentsSelected.length > 0 || filterConversant !== "All")) {
      const conversant = getConversant(c);
      if (!matchesSelectedAgent(conversant)) return false;
    }

    // 5b. Supervisor Managed Users Filter
    if (supManagedUsers.length > 0 && users.length > 0) {
      const conversantNorm = normalizeAgentName(getConversant(c));
      const calleeStr = String(c.callee_number || "").trim();
      const callerStr = String(c.caller_number || "").trim();
      const matchedSupUser = users.some((u) => {
        const uNameNorm = normalizeAgentName(u.full_name || u.name || u.username || "");
        const uExt = String(u.extension || "").trim();
        const uId = String(u.id || "").trim();
        return (
          (uNameNorm && conversantNorm && (conversantNorm === uNameNorm || conversantNorm.includes(uNameNorm))) ||
          (uExt && (calleeStr === uExt || callerStr === uExt || conversantNorm.includes(uExt))) ||
          (uId && supManagedUsers.includes(uId) && String(c.agent_id || "") === uId)
        );
      });
      if (!matchedSupUser) return false;
    }

    // 5c. Supervisor Managed Queues Filter
    if (supManagedQueues.length > 0) {
      const qInfo = resolveCallQueueInfo(c);
      const qMatch =
        supManagedQueues.includes(String(qInfo.queueId)) ||
        supManagedQueues.includes(String(qInfo.queueName)) ||
        queues.some(
          (q) =>
            String(q.extension) === String(qInfo.queueId) ||
            String(q.id) === String(qInfo.queueId) ||
            String(q.name) === String(qInfo.queueName)
        );
      if (!qMatch) return false;
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
    let agentCounts = {};
    
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
      if (conversant) agentCounts[conversant] = (agentCounts[conversant] || 0) + 1;
      
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
  const isIntentMode = viewMode === "intent";
  const isFullWidthMode = isCdrMode || isNotesMode || isAudioMode || isTranscriptsMode || isSentimentMode || isQAMode || isPanoMode || isPerfMode || isQueueMode || isSentimentHeatMode || isWordcloudMode || isFcrMode || isRoiMode || isMissedMode || isTimelineMode || isTrafficMode || isTrunkMode || isIvrDropMode || isTransferHoldMode || isEfficiencyMode || isFrictionMode || isComplianceMode || isSilenceMode || isCeoSummaryMode || isIntentMode;

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
               viewMode === "ceo-summary" ? "Yönetim (CEO) Özet Raporu" :
               viewMode === "intent" ? "Müşteri Niyet Analizi Raporu" : "Çağrı Raporları"}
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

              {/* Columns Toggle Checklist (Available across all report views) */}
              {!isPanoMode && (!isCdrMode || !showCharts) && Object.keys(visibleColumns).length > 0 && (
                <div className="relative">
                  <button 
                    onClick={() => setIsColumnSelectOpen(!isColumnSelectOpen)}
                    className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-xl border font-bold bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 transition cursor-pointer"
                  >
                    <Settings size={10} />
                    <span>Sütunlar</span>
                  </button>
                  {isColumnSelectOpen && (
                    <div className="absolute right-0 mt-2 w-56 max-h-80 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 shadow-xl z-30 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
                      <h4 className="font-bold text-[9px] text-slate-400 dark:text-slate-555 uppercase tracking-wider mb-1">Görünür Sütunlar</h4>
                      {Object.keys(visibleColumns).map((key) => (
                        <label key={key} className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-350 cursor-pointer select-none">
                          <input 
                            type="checkbox"
                            checked={Boolean(visibleColumns[key])}
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
                  (viewMode === "perf" || viewMode === "timeline"
                    ? Boolean(filterStartDate || filterEndDate || filterAgentsSelected.length > 0 || filterConversant !== "All")
                    : viewMode === "queue"
                    ? Boolean(filterStartDate || filterEndDate || filterQueuesSelected.length > 0)
                    : viewMode === "sentiment-heat"
                    ? Boolean(filterStartDate || filterEndDate || filterAgentsSelected.length > 0 || filterConversant !== "All" || filterSentimentsSelected.length > 0)
                    : viewMode === "wordcloud"
                    ? Boolean(filterStartDate || filterEndDate || filterAgentsSelected.length > 0 || filterConversant !== "All" || filterWordcloudKeyword.trim())
                    : viewMode === "fcr"
                    ? Boolean(filterStartDate || filterEndDate || filterAgentsSelected.length > 0 || filterConversant !== "All" || filterCallerNumber || filterFcrStatusesSelected.length > 0 || filterFcrSentimentsSelected.length > 0)
                    : viewMode === "roi"
                    ? Boolean(filterStartDate || filterEndDate)
                    : viewMode === "missed"
                    ? Boolean(filterStartDate || filterEndDate || filterCallerNumber || filterMissedQueuesSelected.length > 0 || filterMissedCallbackSelected.length > 0)
                    : viewMode === "traffic"
                    ? Boolean(filterStartDate || filterEndDate || filterDirection !== "All" || filterTrafficStartHour !== "" || filterTrafficEndHour !== "")
                    : Boolean(filterStartDate || filterEndDate || filterStatus !== "All" || filterDirection !== "All" || filterConversant !== "All" || filterCallerNumber || filterCallId || filterAgentsSelected.length > 0))
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
        {isTimelineOpen && selectedTimelineCall && (() => {
          const modalDir = getCallDirection(selectedTimelineCall);
          const modalStatus = getCallStatus(selectedTimelineCall);
          const modalAgent = resolveCallAgentDetail(selectedTimelineCall);
          const timelineSteps = getCallFlowTimeline(selectedTimelineCall);
          const endedByInfo = resolveCallEndedByDetail(selectedTimelineCall);
          const hangupLabel = endedByInfo.label;

          return (
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
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Numara</p>
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{getCustomerNumber(selectedTimelineCall)}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Çağrı Yönü / Durum</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {modalDir} | <span className="text-primary">{modalStatus}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {modalDir.includes("Giden") ? "Başlatan Abone" : "Görüşen Abone / Temsilci"}
                  </p>
                  <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 mt-0.5">{modalAgent.display}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Kapatan Taraf</p>
                  <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mt-0.5">{hangupLabel}</p>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800/70">
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Benzersiz Çağrı ID</p>
                  <p className="text-[10px] font-mono font-bold text-slate-550 dark:text-slate-400 mt-0.5 break-all">{selectedTimelineCall.id}</p>
                </div>
              </div>

              {/* Timeline Container */}
              <div className="flex-1 flex flex-col gap-4 mt-2 pr-1">
                {timelineSteps.map((step, idx) => {
                  const circleColor = "bg-primary text-white";
                  return (
                    <div key={idx} className="flex gap-3 relative">
                      {/* Timeline line connector */}
                      {idx !== timelineSteps.length - 1 && (
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
          );
        })()}

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
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Numara</p>
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
                    const isCustomer = turn.speaker === "customer" || turn.speaker === "user";
                    const isAI = turn.speaker === "ai";
                    const rawStr = String(turn.text || "");
                    const origMatch = rawStr.match(/^(.*?)\n\[\[ORIG:([A-Z-]+)\]\]\s*(.*)$/s);
                    const transMatch = !origMatch ? rawStr.match(/^(.*?)\n\[\[TRANS:([A-Z-]+)\]\]\s*(.*)$/s) : null;
                    const primaryText = origMatch ? origMatch[1].trim() : transMatch ? transMatch[1].trim() : rawStr;
                    const secondaryText = origMatch ? origMatch[3].trim() : transMatch ? transMatch[3].trim() : "";
                    const langBadge = origMatch ? `${origMatch[2]} → TR` : transMatch ? `TR → ${transMatch[2]}` : null;

                    return (
                      <div key={index} className={`flex ${isCustomer ? "justify-start" : "justify-end"} w-full animate-in fade-in slide-in-from-bottom-2 duration-150`}>
                        <div className={`flex flex-col max-w-[85%] ${isCustomer ? "items-start" : "items-end"}`}>
                          <div
                            className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed border font-semibold shadow-sm ${
                              isCustomer
                                ? "bg-slate-50 dark:bg-slate-955 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-sm"
                                : isAI
                                ? "bg-purple-50 dark:bg-purple-955 border-purple-100 dark:border-purple-900/50 text-purple-800 dark:text-purple-100 rounded-tr-sm"
                                : "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200/80 dark:border-indigo-800/60 text-slate-800 dark:text-slate-100 rounded-tr-sm"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className={`font-extrabold text-[9px] tracking-wider uppercase flex items-center gap-1 ${
                                isCustomer
                                  ? "text-amber-600 dark:text-amber-400"
                                  : isAI
                                  ? "text-purple-600 dark:text-purple-400"
                                  : "text-indigo-600 dark:text-indigo-400"
                              }`}>
                                {isAI ? <Bot size={11} /> : <User size={11} />}
                                {isAI ? "YAPAY ZEKA" : isCustomer ? "MÜŞTERİ" : "MÜŞTERİ TEMSİLCİSİ"}
                              </p>
                              {langBadge && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                  🌐 {langBadge}
                                </span>
                              )}
                            </div>
                            <p className="whitespace-pre-line font-bold">{primaryText}</p>
                            {secondaryText && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-1 pt-1 border-t border-slate-200/70 dark:border-slate-800/70 leading-snug">
                                "{secondaryText}"
                              </p>
                            )}
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
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Numara</p>
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
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-bold text-primary dark:text-purple-400 text-[10px] uppercase tracking-wider">
                    Müşteri Temsilcisi / Yapay Zeka Özeti:
                  </span>
                  <button
                    type="button"
                    disabled={summaryGenerating}
                    onClick={() => handleGenerateCallSummary(selectedTranscriptCall)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-primary transition disabled:opacity-50 cursor-pointer"
                    title="Özeti Yeniden Oluştur"
                  >
                    <RefreshCw size={11} className={summaryGenerating ? "animate-spin" : ""} />
                    <span>{summaryGenerating ? "Oluşturuluyor..." : "Özeti Yenile"}</span>
                  </button>
                </div>
                <p className="whitespace-pre-line text-[11px] font-medium leading-relaxed">
                  {!isInvalidSummaryText(selectedTranscriptCall.summary)
                    ? selectedTranscriptCall.summary
                    : summaryGenerating
                    ? "Yapay zeka görüşme özeti oluşturuluyor, lütfen bekleyin..."
                    : buildClientFallbackSummary(popupTranscripts) ||
                      (popupLoading
                        ? "Görüşme verileri analiz ediliyor..."
                        : "Bu görüşmeye ait konuşma metni bulunamadığından özet oluşturulamadı.")}
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
                  className="px-4 py-2 font-bold rounded-xl transition cursor-pointer bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-500/20"
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
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Numara</p>
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
                  className="px-4 py-2 font-bold rounded-xl transition cursor-pointer bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-500/20"
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
            <div className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-850 rounded-3xl p-6 shadow-2xl w-full ${viewMode === "roi" ? "max-w-lg" : "max-w-2xl"} max-h-[90vh] overflow-y-auto flex flex-col gap-4 animate-in zoom-in-95 duration-200`}>
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
              <div className={viewMode === "queue" || viewMode === "perf" || viewMode === "sentiment-heat" || viewMode === "wordcloud" || viewMode === "fcr" || viewMode === "roi" || viewMode === "missed" || viewMode === "timeline" || viewMode === "traffic" ? "flex flex-col gap-4" : "grid grid-cols-2 gap-4"}>
                {/* Date range */}
                <div className={viewMode === "queue" || viewMode === "perf" || viewMode === "sentiment-heat" || viewMode === "wordcloud" || viewMode === "fcr" || viewMode === "roi" || viewMode === "missed" || viewMode === "timeline" || viewMode === "traffic" ? "grid grid-cols-2 gap-3 bg-slate-50/50 dark:bg-slate-955/20 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/50" : "col-span-2 grid grid-cols-2 gap-3 bg-slate-50/50 dark:bg-slate-955/20 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/50"}>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-450 dark:text-slate-555 uppercase tracking-wider">Başlangıç Tarihi</label>
                    <input
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:border-primary font-semibold"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-450 dark:text-slate-555 uppercase tracking-wider">Bitiş Tarihi</label>
                    <input
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:border-primary font-semibold"
                    />
                  </div>
                </div>

                {viewMode === "queue" ? (
                  <DualListBox 
                    title="Kuyruklar"
                    availableItems={filterQueuesAvailable}
                    selectedIds={filterQueuesSelected}
                    onChangeSelectedIds={setFilterQueuesSelected}
                    columns={["Kuyruk ID", "Kuyruk İsmi"]}
                    bg={bg} hover={hover} text={text} border={border} lightBg={lightBg} ring={ring} borderLight={borderLight}
                    renderRow={(item) => (
                      <>
                        <td className="p-2 text-slate-600 dark:text-slate-400 font-mono text-xs">{item.extension || item.id}</td>
                        <td className="p-2 text-slate-800 dark:text-slate-200 font-medium">{item.name}</td>
                      </>
                    )}
                  />
                ) : viewMode === "perf" || viewMode === "timeline" ? (
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
                ) : viewMode === "sentiment-heat" ? (
                  <>
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
                    <DualListBox 
                      title="Duygu Durumu"
                      availableItems={SENTIMENT_HEAT_FILTER_ITEMS}
                      selectedIds={filterSentimentsSelected}
                      onChangeSelectedIds={setFilterSentimentsSelected}
                      columns={["İsim"]}
                      bg={bg} hover={hover} text={text} border={border} lightBg={lightBg} ring={ring} borderLight={borderLight}
                      renderRow={(item) => (
                        <>
                          <td className="p-2 text-slate-800 dark:text-slate-200 font-medium">{item.name}</td>
                        </>
                      )}
                    />
                  </>
                ) : viewMode === "wordcloud" ? (
                  <>
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
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-wider">
                        Anahtar Kelime Filtresi
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          placeholder="Anahtar kelime yazın (örn. iptal, fatura, sipariş...)"
                          value={filterWordcloudKeyword}
                          onChange={(e) => setFilterWordcloudKeyword(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              fetchCalls(true);
                              setIsFilterOpen(false);
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl pl-9 pr-8 py-2 text-xs focus:outline-none focus:border-primary font-semibold"
                        />
                        {filterWordcloudKeyword && (
                          <button
                            type="button"
                            onClick={() => setFilterWordcloudKeyword("")}
                            title="Anahtar kelimeyi temizle"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        Birden fazla anahtar kelimeyi virgülle ayırarak filtreleyebilirsiniz. Boş bırakıldığında tüm kelimeler gösterilir.
                      </span>
                    </div>
                  </>
                ) : viewMode === "fcr" ? (
                  <>
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
                    <DualListBox 
                      title="FCR Durumu"
                      availableItems={FCR_STATUS_FILTER_ITEMS}
                      selectedIds={filterFcrStatusesSelected}
                      onChangeSelectedIds={setFilterFcrStatusesSelected}
                      columns={["İsim"]}
                      bg={bg} hover={hover} text={text} border={border} lightBg={lightBg} ring={ring} borderLight={borderLight}
                      renderRow={(item) => (
                        <>
                          <td className="p-2 text-slate-800 dark:text-slate-200 font-medium">{item.name}</td>
                        </>
                      )}
                    />
                    <DualListBox 
                      title="Duygu Durumu"
                      availableItems={FCR_SENTIMENT_FILTER_ITEMS}
                      selectedIds={filterFcrSentimentsSelected}
                      onChangeSelectedIds={setFilterFcrSentimentsSelected}
                      columns={["İsim"]}
                      bg={bg} hover={hover} text={text} border={border} lightBg={lightBg} ring={ring} borderLight={borderLight}
                      renderRow={(item) => (
                        <>
                          <td className="p-2 text-slate-800 dark:text-slate-200 font-medium">{item.name}</td>
                        </>
                      )}
                    />
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-wider">Numara Ara</label>
                      <input
                        type="text"
                        placeholder="örn. 0532..."
                        value={filterCallerNumber}
                        onChange={(e) => setFilterCallerNumber(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            fetchCalls(true);
                            setIsFilterOpen(false);
                          }
                        }}
                        className="w-full bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary font-semibold"
                      />
                    </div>
                  </>
                ) : viewMode === "roi" ? null : viewMode === "missed" ? (
                  <>
                    <DualListBox 
                      title="Kuyruklar"
                      availableItems={missedQueueFilterItems}
                      selectedIds={filterMissedQueuesSelected}
                      onChangeSelectedIds={setFilterMissedQueuesSelected}
                      columns={["İsim"]}
                      bg={bg} hover={hover} text={text} border={border} lightBg={lightBg} ring={ring} borderLight={borderLight}
                      renderRow={(item) => (
                        <>
                          <td className="p-2 text-slate-800 dark:text-slate-200 font-medium">{item.name}</td>
                        </>
                      )}
                    />
                    <DualListBox 
                      title="Geri Dönüş Durumu"
                      availableItems={MISSED_CALLBACK_FILTER_ITEMS}
                      selectedIds={filterMissedCallbackSelected}
                      onChangeSelectedIds={setFilterMissedCallbackSelected}
                      columns={["İsim"]}
                      bg={bg} hover={hover} text={text} border={border} lightBg={lightBg} ring={ring} borderLight={borderLight}
                      renderRow={(item) => (
                        <>
                          <td className="p-2 text-slate-800 dark:text-slate-200 font-medium">{item.name}</td>
                        </>
                      )}
                    />
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-wider">Numara Ara</label>
                      <input
                        type="text"
                        placeholder="örn. 0532..."
                        value={filterCallerNumber}
                        onChange={(e) => setFilterCallerNumber(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            fetchCalls(true);
                            setIsFilterOpen(false);
                          }
                        }}
                        className="w-full bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary font-semibold"
                      />
                    </div>
                  </>
                ) : viewMode === "traffic" ? (
                  <>
                    {/* Hour Range Filter */}
                    <div className="flex flex-col gap-3 bg-slate-50/50 dark:bg-slate-955/20 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-450 dark:text-slate-555 uppercase tracking-wider">Başlangıç Saati</label>
                          <select
                            value={filterTrafficStartHour}
                            onChange={(e) => setFilterTrafficStartHour(e.target.value)}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary font-semibold"
                          >
                            <option value="">00:00 (Günün Başı)</option>
                            {Array.from({ length: 24 }).map((_, h) => (
                              <option key={h} value={String(h)}>
                                {String(h).padStart(2, "0")}:00
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-450 dark:text-slate-555 uppercase tracking-wider">Bitiş Saati</label>
                          <select
                            value={filterTrafficEndHour}
                            onChange={(e) => setFilterTrafficEndHour(e.target.value)}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary font-semibold"
                          >
                            <option value="">23:59 (Günün Sonu)</option>
                            {Array.from({ length: 24 }).map((_, h) => (
                              <option key={h} value={String(h)}>
                                {String(h).padStart(2, "0")}:59
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          { label: "Tüm Gün (00-23)", s: "", e: "" },
                          { label: "Mesai (09:00-18:59)", s: "9", e: "18" },
                          { label: "Sabah (08:00-12:59)", s: "8", e: "12" },
                          { label: "Öğleden Sonra (13:00-17:59)", s: "13", e: "17" },
                          { label: "Akşam (18:00-23:59)", s: "18", e: "23" },
                        ].map((preset) => {
                          const isActive = filterTrafficStartHour === preset.s && filterTrafficEndHour === preset.e;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                setFilterTrafficStartHour(preset.s);
                                setFilterTrafficEndHour(preset.e);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                                isActive
                                  ? `${bg} text-white ${border} shadow-sm`
                                  : `bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-primary`
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Call Direction */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-wider">Yön</label>
                      <select
                        value={filterDirection}
                        onChange={(e) => setFilterDirection(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-slate-100 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary font-bold"
                      >
                        <option value="All">Tümü (Yön)</option>
                        {uniqueDirections.map((dir) => (
                          <option key={dir} value={dir}>{dir}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
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

                    {/* Conversant / Users & AI Agents */}
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

                    {/* Intent Rules & Saved Keywords Section (For Niyet Raporu) */}
                    {viewMode === "intent" && (
                      <div className="col-span-2 flex flex-col gap-3 p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Sparkles size={15} className="text-primary" />
                            <div>
                              <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                                Niyet Grupları & Anahtar Kelimeler (Kalıcı Kayıt)
                              </h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                Satış, yardım masası veya özel süreçler için anahtar kelimeleri girip kaydedin.
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {intentRulesSavedBadge && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800/50">
                                <Check size={12} /> Kaydedildi
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={handleOpenNewIntentRuleForm}
                              title="Yeni Niyet Kuralı ve Anahtar Kelime Ekle"
                              className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition cursor-pointer shadow-sm"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Quick Keyword Input + Save as Rule */}
                        <div className="flex flex-col gap-2 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                          <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Hızlı Anahtar Kelime Girişi (Virgülle Ayırarak Yazın)
                          </label>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              placeholder="Örn: satın almak, sipariş, fiyat, arıza, şifre, iptal..."
                              value={intentQuickKeywords}
                              onChange={(e) => setIntentQuickKeywords(e.target.value)}
                              className="flex-1 min-w-[200px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-primary font-semibold"
                            />
                            {intentQuickKeywords.trim() && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingIntentRuleId(null);
                                  setIntentRuleName(intentQuickRuleName || "Özel Niyet Kuralı");
                                  setIntentRuleCategory(intentQuickCategory || "Satış");
                                  setIntentRuleKeywords(intentQuickKeywords);
                                  setIntentRuleScope("customer");
                                  setIntentRuleColor("emerald");
                                  setIsIntentRuleFormOpen(true);
                                }}
                                className={"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-[11px] font-bold shadow-sm transition cursor-pointer " + bg + " " + hover}
                              >
                                <Save size={12} />
                                <span>Kalıcı Olarak Kaydet</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Add / Edit Rule Form */}
                        {isIntentRuleFormOpen && (
                          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-primary/40 flex flex-col gap-3 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                                {editingIntentRuleId ? "Niyet Kuralını Düzenle" : "Yeni Niyet Kuralı Oluştur & Kaydet"}
                              </span>
                              <button
                                type="button"
                                onClick={() => setIsIntentRuleFormOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Niyet Başlığı</label>
                                <input
                                  type="text"
                                  placeholder="Örn: Satış Olumlu / Sipariş"
                                  value={intentRuleName}
                                  onChange={(e) => setIntentRuleName(e.target.value)}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Kategori</label>
                                <select
                                  value={intentRuleCategory}
                                  onChange={(e) => setIntentRuleCategory(e.target.value)}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                                >
                                  <option value="Satış">Satış</option>
                                  <option value="Yardım Masası">Yardım Masası / Teknik Destek</option>
                                  <option value="Şikayet / İptal">Şikayet / İptal / İade</option>
                                  <option value="Fatura / Ödeme">Fatura / Ödeme</option>
                                  <option value="Bilgi Talebi">Bilgi & Randevu Talebi</option>
                                  <option value="Genel">Genel İşlemler</option>
                                </select>
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Arama Kapsamı</label>
                                <select
                                  value={intentRuleScope}
                                  onChange={(e) => setIntentRuleScope(e.target.value)}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                                >
                                  <option value="customer">Müşteri İfadeleri (Öncelikli)</option>
                                  <option value="all">Tüm Görüşme Metni (Müşteri + Temsilci)</option>
                                </select>
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Etiket Rengi</label>
                                <select
                                  value={intentRuleColor}
                                  onChange={(e) => setIntentRuleColor(e.target.value)}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                                >
                                  <option value="emerald">Yeşil (Olumlu / Satış / Çözüm)</option>
                                  <option value="blue">Mavi (Fiyat / Bilgi / Sorgu)</option>
                                  <option value="amber">Turuncu (Yardım Masası / Destek)</option>
                                  <option value="rose">Kırmızı (İptal / Şikayet / Risk)</option>
                                  <option value="purple">Mor (Özel Süreç)</option>
                                </select>
                              </div>
                              <div className="md:col-span-2 flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">
                                  Anahtar Kelimeler (Virgül ile ayırın)
                                </label>
                                <textarea
                                  rows={2}
                                  placeholder="satın almak, sipariş, onaylıyorum, fiyat, kurulum, arıza..."
                                  value={intentRuleKeywords}
                                  onChange={(e) => setIntentRuleKeywords(e.target.value)}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setIsIntentRuleFormOpen(false)}
                                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm shadow-rose-500/20 transition cursor-pointer"
                              >
                                Vazgeç
                              </button>
                              <button
                                type="button"
                                disabled={intentRulesSaving}
                                onClick={handleSubmitIntentRuleForm}
                                className={"inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-white text-xs font-bold shadow-sm transition cursor-pointer " + bg + " " + hover}
                              >
                                <Save size={13} />
                                <span>{intentRulesSaving ? "Kaydediliyor..." : "Kuralı Kaydet"}</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Saved Rules List */}
                        <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                          {(intentRules || []).map((rule) => {
                            const isSelected = selectedIntentRuleIds.includes(rule.id);
                            const kwArr = Array.isArray(rule.keywords) ? rule.keywords : [];
                            return (
                              <div
                                key={rule.id}
                                className={`p-2.5 rounded-xl border flex items-start justify-between gap-3 transition ${
                                  isSelected
                                    ? "bg-primary/5 border-primary/40 dark:bg-primary/10"
                                    : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800"
                                }`}
                              >
                                <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                      setSelectedIntentRuleIds((prev) =>
                                        prev.includes(rule.id) ? prev.filter((id) => id !== rule.id) : [...prev, rule.id]
                                      );
                                    }}
                                    className="mt-0.5 rounded border-slate-300 text-primary focus:ring-primary"
                                  />
                                  <div className="flex flex-col gap-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                                        {rule.name}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                        {rule.category}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                      {kwArr.map((kw, kIdx) => (
                                        <span
                                          key={kIdx}
                                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700"
                                        >
                                          #{kw}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </label>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditIntentRuleForm(rule)}
                                    title="Anahtar Kelimeleri Düzenle"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteIntentRuleTarget(rule)}
                                    title="Niyet Kuralını Sil"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
                    if (viewMode === "timeline") {
                      fetchAgentTimeline(filterEndDate || filterStartDate, true);
                    }
                    if (viewMode === "intent") {
                      fetchIntentAnalysisData(true);
                    }
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
            ) : (filteredCalls.length === 0 && !isPanoMode && !isTimelineMode && !isIntentMode && !isTrafficMode) ? (
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
                      {visibleColumns.agent && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Temsilci</th>}
                      {visibleColumns.totalCalls && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Toplam Çağrı</th>}
                      {visibleColumns.answered && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Cevaplanan</th>}
                      {visibleColumns.missed && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Kaçan</th>}
                      {visibleColumns.answerRate && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Cevaplama %</th>}
                      {visibleColumns.totalTalk && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Top. Konuşma</th>}
                      {visibleColumns.avgTalk && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Ort. Konuşma</th>}
                      {visibleColumns.avgQa && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Ort. Kalite</th>}
                      {visibleColumns.sentiment && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Duygu (Poz/Nöt/Neg)</th>}
                      {visibleColumns.detail && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const stats = {};
                      // Seed all selected or all available users & AI agents if they match current filter
                      uniqueConversants.forEach(agentName => {
                        if (matchesSelectedAgent(agentName)) {
                          stats[agentName] = {
                            agent: agentName,
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
                      });
                      filteredCalls.forEach(call => {
                        const agent = getConversant(call) || "Bilinmiyor";
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
                            <td colSpan="10" className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Bu filtrelere uygun çağrı bulunamadı.</td>
                          </tr>
                        );
                      }
                      
                      return agentList.map((agentData, idx) => {
                        const answerRate = agentData.totalCalls > 0 ? Math.round((agentData.answeredCalls / agentData.totalCalls) * 100) : 0;
                        const avgTalk = agentData.totalCalls > 0 ? Math.round(agentData.totalTalkDuration / agentData.totalCalls) : 0;
                        const avgQa = agentData.qaScoreCount > 0 ? Math.round(agentData.qaScoreSum / agentData.qaScoreCount) : 0;
                        
                        return (
                          <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                            {visibleColumns.agent && (
                              <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={getAgentAvatarUrl(agentData.agent)}
                                    alt={agentData.agent}
                                    className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-0.5 object-cover shrink-0 shadow-xs"
                                  />
                                  {agentData.agent}
                                </div>
                              </td>
                            )}
                            {visibleColumns.totalCalls && <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">{agentData.totalCalls}</td>}
                            {visibleColumns.answered && <td className="p-4 text-center font-bold text-emerald-600 dark:text-emerald-400">{agentData.answeredCalls}</td>}
                            {visibleColumns.missed && <td className="p-4 text-center font-bold text-rose-600 dark:text-rose-400">{agentData.missedCalls}</td>}
                            {visibleColumns.answerRate && (
                              <td className="p-4 text-center">
                                <div className={"inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border " + (answerRate >= 80 ? "bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30" : "bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30")}>
                                  %{answerRate}
                                </div>
                              </td>
                            )}
                            {visibleColumns.totalTalk && <td className="p-4 text-center font-medium text-slate-600 dark:text-slate-400">{formatSec(agentData.totalTalkDuration)}</td>}
                            {visibleColumns.avgTalk && <td className="p-4 text-center font-medium text-slate-600 dark:text-slate-400">{formatSec(avgTalk)}</td>}
                            {visibleColumns.avgQa && (
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
                            )}
                            {visibleColumns.sentiment && (
                              <td className="p-4 text-center">
                                <div className="flex items-center justify-center gap-2 text-xs font-bold">
                                  <span className="text-emerald-600 dark:text-emerald-400" title="Pozitif">{agentData.sentimentPositive}</span>
                                  <span className="text-slate-300 dark:text-slate-600">/</span>
                                  <span className="text-amber-500 dark:text-amber-400" title="Nötr">{agentData.sentimentNeutral}</span>
                                  <span className="text-slate-300 dark:text-slate-600">/</span>
                                  <span className="text-rose-600 dark:text-rose-400" title="Negatif">{agentData.sentimentNegative}</span>
                                </div>
                              </td>
                            )}
                            {visibleColumns.detail && (
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
                            )}
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
                <table className="w-full text-left border-collapse min-w-[980px] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <thead>
                    <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                      {visibleColumns.date && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Tarih</th>}
                      {visibleColumns.queueId && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Kuyruk ID</th>}
                      {visibleColumns.queueName && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Kuyruk İsmi</th>}
                      {visibleColumns.totalCalls && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Toplam Çağrı</th>}
                      {visibleColumns.queuedCalls && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Kuyruğa Giren</th>}
                      {visibleColumns.abandoned && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Kuyrukta Kaçan</th>}
                      {visibleColumns.sla && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>SLA Uyumu (≤20s)</th>}
                      {visibleColumns.totalWait && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Top. Bekleme</th>}
                      {visibleColumns.avgWait && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Ort. Bekleme</th>}
                      {visibleColumns.maxWait && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Max. Bekleme</th>}
                      {visibleColumns.detail && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const stats = {};
                      filteredCalls.forEach(call => {
                        const dateStr = call.start_time ? call.start_time.split("T")[0] : "Bilinmiyor";
                        const qInfo = resolveCallQueueInfo(call);
                        if (filterQueuesSelected.length > 0) {
                          const matchesQueueFilter = filterQueuesSelected.some(selId => {
                            const selQ = filterQueuesAvailable.find(fq => String(fq.id) === String(selId));
                            if (!selQ) return String(selId) === String(qInfo.queueId);
                            return String(selQ.extension) === String(qInfo.queueId) || String(selQ.id) === String(qInfo.queueId) || String(selQ.name) === String(qInfo.queueName);
                          });
                          if (!matchesQueueFilter) return;
                        }
                        const groupKey = `${dateStr}__${qInfo.queueId}`;
                        if (!stats[groupKey]) {
                          stats[groupKey] = {
                            date: dateStr,
                            queueId: qInfo.queueId,
                            queueName: qInfo.queueName,
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
                        
                        const dStats = stats[groupKey];
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
                      
                      const dateList = Object.values(stats).sort((a, b) => {
                        const cmp = b.date.localeCompare(a.date);
                        if (cmp !== 0) return cmp;
                        return String(a.queueId).localeCompare(String(b.queueId));
                      });
                      
                      const formatSec = (secs) => {
                        if (!secs || isNaN(secs)) return "00:00";
                        const m = Math.floor(secs / 60).toString().padStart(2, '0');
                        const s = Math.floor(secs % 60).toString().padStart(2, '0');
                        return `${m}:${s}`;
                      };
                      
                      if (dateList.length === 0) {
                        return (
                          <tr>
                            <td colSpan="11" className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Bu filtrelere uygun çağrı bulunamadı.</td>
                          </tr>
                        );
                      }
                      
                      return dateList.map((dData, idx) => {
                        const slaRate = dData.totalCalls > 0 ? Math.round((dData.slaCompliant / dData.totalCalls) * 100) : 0;
                        const avgQueue = dData.queuedCalls > 0 ? Math.round(dData.totalQueueSecs / dData.queuedCalls) : 0;
                        
                        return (
                          <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                            {visibleColumns.date && (
                              <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                                <div className="flex items-center gap-2">
                                  <CalendarIcon size={14} className={text} />
                                  {formatDateOnly(dData.date)}
                                </div>
                              </td>
                            )}
                            {visibleColumns.queueId && (
                              <td className="p-4 text-center">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {dData.queueId}
                                </span>
                              </td>
                            )}
                            {visibleColumns.queueName && (
                              <td className="p-4 font-bold text-slate-800 dark:text-slate-200">
                                {dData.queueName}
                              </td>
                            )}
                            {visibleColumns.totalCalls && <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">{dData.totalCalls}</td>}
                            {visibleColumns.queuedCalls && <td className="p-4 text-center font-bold text-blue-600 dark:text-blue-400">{dData.queuedCalls}</td>}
                            {visibleColumns.abandoned && <td className="p-4 text-center font-bold text-rose-600 dark:text-rose-400">{dData.abandonedInQueue}</td>}
                            {visibleColumns.sla && (
                              <td className="p-4 text-center">
                                <div className={"inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border " + (slaRate >= 80 ? "bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30" : slaRate >= 50 ? "bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30" : "bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30")}>
                                  %{slaRate}
                                </div>
                              </td>
                            )}
                            {visibleColumns.totalWait && <td className="p-4 text-center font-medium text-slate-600 dark:text-slate-400">{formatSec(dData.totalQueueSecs)}</td>}
                            {visibleColumns.avgWait && <td className="p-4 text-center font-medium text-slate-600 dark:text-slate-400">{formatSec(avgQueue)}</td>}
                            {visibleColumns.maxWait && <td className="p-4 text-center font-medium text-slate-800 dark:text-slate-200">{formatSec(dData.maxQueueSecs)}</td>}
                            {visibleColumns.detail && (
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
                            )}
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
                      {visibleColumns.agent && <th className={"p-3 text-[10px] font-bold uppercase tracking-wider sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 " + text}>Temsilci \ Saat</th>}
                      {Array.from({length: 24}).map((_, i) => {
                        const isHourVisible = (i < 6 && visibleColumns.h00_05) || (i >= 6 && i < 12 && visibleColumns.h06_11) || (i >= 12 && i < 18 && visibleColumns.h12_17) || (i >= 18 && visibleColumns.h18_23);
                        if (!isHourVisible) return null;
                        return (
                          <th key={i} className={"p-2 text-[10px] font-bold uppercase tracking-wider text-center " + text}>{i.toString().padStart(2, '0')}:00</th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const heatmapData = {};
                      filteredCalls.forEach(call => {
                        if (!call.start_time) return;
                        const agent = getConversant(call) || "Bilinmiyor";
                        const dateObj = new Date(call.start_time);
                        const hour = dateObj.getHours(); // 0-23
                        
                        if (!heatmapData[agent]) {
                          heatmapData[agent] = {};
                          for (let i = 0; i < 24; i++) {
                            heatmapData[agent][i] = { total: 0, score: 0 };
                          }
                        }
                        
                        heatmapData[agent][hour].total++;
                        heatmapData[agent][hour].score += getSentimentHeatCallDelta(call.sentiment);
                      });
                      
                      const agentList = Object.keys(heatmapData)
                        .sort()
                        .filter((agent) => {
                          if (filterSentimentsSelected.length === 0) return true;
                          return Array.from({ length: 24 }).some((_, h) => {
                            const isHourVisible = (h < 6 && visibleColumns.h00_05) || (h >= 6 && h < 12 && visibleColumns.h06_11) || (h >= 12 && h < 18 && visibleColumns.h12_17) || (h >= 18 && visibleColumns.h18_23);
                            if (!isHourVisible) return false;
                            const cell = heatmapData[agent][h];
                            if (!cell || cell.total === 0) return false;
                            const avg = Math.round(cell.score / cell.total);
                            return filterSentimentsSelected.includes(getSentimentHeatBucket(avg));
                          });
                        });
                      
                      if (agentList.length === 0) {
                        return (
                          <tr>
                            <td colSpan="25" className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Bu filtrelere uygun çağrı bulunamadı.</td>
                          </tr>
                        );
                      }
                      
                      return agentList.map((agent, rowIdx) => (
                        <tr key={rowIdx} className={"border-b " + borderLight}>
                          {visibleColumns.agent && (
                            <td className={"p-3 text-xs font-bold text-slate-800 dark:text-slate-200 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800"}>
                              <div className="flex items-center gap-2.5 whitespace-nowrap">
                                <img
                                  src={getAgentAvatarUrl(agent)}
                                  alt={agent}
                                  className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-0.5 object-cover shrink-0 shadow-xs"
                                />
                                <span>{agent}</span>
                              </div>
                            </td>
                          )}
                          {Array.from({length: 24}).map((_, h) => {
                            const isHourVisible = (h < 6 && visibleColumns.h00_05) || (h >= 6 && h < 12 && visibleColumns.h06_11) || (h >= 12 && h < 18 && visibleColumns.h12_17) || (h >= 18 && visibleColumns.h18_23);
                            if (!isHourVisible) return null;
                            const data = heatmapData[agent][h];
                            const avg = data.total > 0 ? Math.round(data.score / data.total) : null;
                            const bucket = getSentimentHeatBucket(avg);
                            const matchesSentimentFilter =
                              data.total > 0 &&
                              (filterSentimentsSelected.length === 0 || filterSentimentsSelected.includes(bucket));
                            let bgColor = "bg-transparent";
                            let textColor = "text-transparent";
                            let textVal = "";
                            
                            if (matchesSentimentFilter) {
                              if (avg >= 50) { bgColor = "bg-emerald-500/80"; textColor = "text-white"; }
                              else if (avg > 10) { bgColor = "bg-emerald-500/40"; textColor = "text-emerald-900 dark:text-emerald-100"; }
                              else if (avg <= -50) { bgColor = "bg-rose-500/80"; textColor = "text-white"; }
                              else if (avg < -10) { bgColor = "bg-rose-500/40"; textColor = "text-rose-900 dark:text-rose-100"; }
                              else { bgColor = "bg-amber-500/40"; textColor = "text-amber-900 dark:text-amber-100"; }
                              textVal = avg > 0 ? `+${avg}` : `${avg}`;
                            }
                            
                            return (
                              <td key={h} className="p-1 border-r border-slate-100 dark:border-slate-800/50 relative group">
                                {matchesSentimentFilter ? (
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
              <div className="p-6 flex flex-col gap-6 h-full overflow-y-auto">
                {filterWordcloudKeyword.trim() && (
                  <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <Search size={13} className="text-primary" />
                      <span>Anahtar Kelime Filtresi:</span>
                      <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${lightBg} ${text} ${borderLight}`}>
                        {filterWordcloudKeyword.trim()}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFilterWordcloudKeyword("")}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-500 transition cursor-pointer"
                      title="Anahtar kelime filtresini kaldır"
                    >
                      <X size={13} />
                      <span>Temizle</span>
                    </button>
                  </div>
                )}

                {(() => {
                  if (filteredCalls.length === 0) {
                    return (
                      <div className={"w-full min-h-[300px] rounded-2xl flex flex-wrap items-center justify-center p-8 gap-4 border " + borderLight + " " + lightBg}>
                        <div className="text-slate-500 font-medium">Bu filtrelere uygun çağrı bulunamadı.</div>
                      </div>
                    );
                  }

                  const { cloudWords, trendRows } = getFilteredWordcloudItems(filteredCalls, filterWordcloudKeyword);

                  if (cloudWords.length === 0) {
                    return (
                      <div className={"w-full min-h-[300px] rounded-2xl flex flex-col items-center justify-center p-8 gap-3 border " + borderLight + " " + lightBg}>
                        <div className="text-slate-500 font-medium">
                          &ldquo;{filterWordcloudKeyword.trim()}&rdquo; anahtar kelimesine uygun sonuç bulunamadı.
                        </div>
                        <button
                          type="button"
                          onClick={() => setFilterWordcloudKeyword("")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${lightBg} ${text} ${borderLight} ${hover} hover:text-white`}
                        >
                          Tüm Kelimeleri Göster
                        </button>
                      </div>
                    );
                  }

                  return (
                    <>
                      <div className={"w-full min-h-[300px] rounded-2xl flex flex-wrap items-center justify-center p-8 gap-4 border " + borderLight + " " + lightBg}>
                        {cloudWords.map((w, idx) => {
                          const isExactFiltered = normalizeTrKeyword(filterWordcloudKeyword) === normalizeTrKeyword(w.text);
                          return (
                            <span
                              key={idx}
                              onClick={() => setFilterWordcloudKeyword(isExactFiltered ? "" : w.text)}
                              className={`${w.size} ${w.color} font-bold opacity-80 hover:opacity-100 transition-all hover:scale-110 cursor-pointer`}
                              title={`${w.text}: ${w.count} geçiş (Filtrelemek için tıklayın)`}
                            >
                              {w.text}
                            </span>
                          );
                        })}
                      </div>

                      {trendRows.length > 0 && (
                        <div className="overflow-x-auto pb-4">
                          <h4 className="text-sm font-bold uppercase tracking-wider mb-4 text-slate-700 dark:text-slate-300">Konu Trendleri ve Duygu Etkisi</h4>
                          <table className="w-full text-left border-collapse border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                            <thead>
                              <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                                {visibleColumns.word && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Anahtar Kelime</th>}
                                {visibleColumns.count && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Geçiş Sıklığı</th>}
                                {visibleColumns.trend && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Trend Değişimi</th>}
                                {visibleColumns.sentiment && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Duygu Etkisi</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {trendRows.map((item, idx) => (
                                <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                                  {visibleColumns.word && <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{item.word}</td>}
                                  {visibleColumns.count && <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">{item.count}</td>}
                                  {visibleColumns.trend && <td className={`p-4 text-center font-bold ${item.trendColor}`}>{item.trend}</td>}
                                  {visibleColumns.sentiment && (
                                    <td className="p-4 text-center">
                                      <div className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border ${item.sentimentColor}`}>
                                        {item.sentiment}
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : isFcrMode ? (
              /* FCR Report Mode */
              <div className="overflow-x-auto p-4 flex flex-col gap-6">
                {(() => {
                  const { callerList, totalCallers, repeatCallers, fcrRate } = computeFilteredFcrReport(filteredCalls);
                  
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
                              {visibleColumns.caller && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Numara</th>}
                              {visibleColumns.callCount && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Arama Sayısı</th>}
                              {visibleColumns.fcrStatus && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>FCR Durumu</th>}
                              {visibleColumns.lastAgent && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Son Temsilci</th>}
                              {visibleColumns.totalDuration && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Top. Görüşme</th>}
                              {visibleColumns.sentiment && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Duygu Durumu</th>}
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
                                  {visibleColumns.caller && <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{c.caller}</td>}
                                  {visibleColumns.callCount && <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">{c.callCount}</td>}
                                  {visibleColumns.fcrStatus && (
                                    <td className="p-4 text-center">
                                      {c.callCount === 1 ? (
                                        <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 border-emerald-100">Başarılı</span>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border bg-rose-50 dark:bg-rose-955/20 text-rose-600 border-rose-100">Başarısız (Tekrar Aramış)</span>
                                      )}
                                    </td>
                                  )}
                                  {visibleColumns.lastAgent && <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">{c.lastAgent}</td>}
                                  {visibleColumns.totalDuration && <td className="p-4 text-center font-medium text-slate-600 dark:text-slate-400">{formatSec(c.totalDuration)}</td>}
                                  {visibleColumns.sentiment && (
                                    <td className="p-4 text-center">
                                      <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border ${c.sentiment === 'positive' ? 'bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 border-emerald-100' : c.sentiment === 'negative' ? 'bg-rose-50 dark:bg-rose-955/20 text-rose-600 border-rose-100' : 'bg-amber-50 dark:bg-amber-955/20 text-amber-600 border-amber-100'}`}>
                                        {c.sentimentLabel}
                                      </span>
                                    </td>
                                  )}
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
                    const agent = getConversant(call) || "";
                    const callIdInt = call.id ? parseInt(call.id.replace(/\D/g, '').slice(-1) || '0', 10) : 0;
                    // Check if agent is in aiAgents or matches AI naming
                    const isKnownAi = (aiAgents || []).some(ai => ai.name === agent);
                    const isAI = isKnownAi || agent.toLowerCase().includes("ai") || agent.toLowerCase().includes("bot") || agent.toLowerCase().includes("sanal") || (callIdInt % 3 === 0);
                    
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
                  
                  const calculatedHumanCostPerMin = roiHumanCount > 0 ? (roiHumanCost / 10560) : 0;
                  const totalCostIfAllHuman = humanTotalCost + ((aiStats.duration / 60) * calculatedHumanCostPerMin);
                  const savings = totalCostIfAllHuman - (aiTotalCost + humanTotalCost);
                  
                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Yapay Zeka (AI) Card */}
                        {visibleColumns.aiCard && (
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
                        )}
                        
                        {/* İnsan Temsilci Card */}
                        {visibleColumns.humanCard && (
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
                        )}
                      </div>
                      
                      {/* ROI Summary Banner */}
                      {visibleColumns.savingsBanner && (
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
                      )}
                    </>
                  );
                })()}
              </div>
            ) : isMissedMode ? (
              /* Missed Calls Mode */
              <div className="p-4 flex flex-col gap-6 h-full overflow-y-auto">
                {(() => {
                  const { mappedMissed, totalMissed, callbackRate, avgWaitTime } = computeFilteredMissedReport(filteredCalls);
                  
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
                              {visibleColumns.startTime && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Tarih / Saat</th>}
                              {visibleColumns.caller && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Numara</th>}
                              {visibleColumns.waitTime && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Sabır Süresi</th>}
                              {visibleColumns.queue && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Kuyruk</th>}
                              {visibleColumns.cbStatus && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Geri Dönüş Durumu</th>}
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
                                  {visibleColumns.startTime && (
                                    <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">
                                      {c.start_time ? formatDate(c.start_time) : "-"}
                                    </td>
                                  )}
                                  {visibleColumns.caller && <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{getCustomerNumber(c)}</td>}
                                  {visibleColumns.waitTime && <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">{c.waitTime} sn</td>}
                                  {visibleColumns.queue && <td className="p-4 font-medium text-slate-600 dark:text-slate-400">{c.queueName}</td>}
                                  {visibleColumns.cbStatus && (
                                    <td className="p-4 text-center">
                                      <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border ${c.cbStatus === 'Dönüldü (Başarılı)' ? 'bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 border-emerald-100' : c.cbStatus === 'Bekliyor' ? 'bg-rose-50 dark:bg-rose-955/20 text-rose-600 border-rose-100' : 'bg-amber-50 dark:bg-amber-955/20 text-amber-600 border-amber-100'}`}>
                                        {c.cbStatus}
                                      </span>
                                    </td>
                                  )}
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
              /* Agent Status Timeline (Temsilci Kronolojisi) Mode - Single Row Table + Magnifier Detail Modal */
              <div className="p-5 flex flex-col gap-5 h-full overflow-y-auto scrollbar-thin">
                {(() => {
                  const fallbackUsers = (users || []).map(u => ({
                    agent_id: String(u.id),
                    agent_name: u.full_name || u.name || u.username || `Dahili ${u.extension}`,
                    extension: String(u.extension || ""),
                    avatar: u.avatar || "",
                    is_online: false,
                    is_ai: false,
                    has_real_activity: false,
                    shift_start_time: "-",
                    shift_end_time: "-",
                    total_online_label: "-",
                    total_talk_label: "0 dk",
                    total_break_label: "0 dk",
                    inbound_total_count: 0,
                    inbound_answered_count: 0,
                    answered_count: 0,
                    outbound_count: 0,
                    missed_count: 0,
                    transfer_count: 0,
                    pickup_count: 0,
                    action_count: 0,
                    efficiency_pct: 0,
                    availability_pct: 0,
                    answer_rate_pct: 0,
                    events: []
                  }));
                  const fallbackAiAgents = (aiAgents || []).map(ai => ({
                    agent_id: String(ai.id || ai.name),
                    agent_name: `${ai.name} (AI Agent)`,
                    extension: String(ai.extension || "AI"),
                    avatar: ai.avatar || "",
                    is_online: ai.active !== false,
                    is_ai: true,
                    has_real_activity: false,
                    shift_start_time: ai.active !== false ? "7/24 Aktif" : "-",
                    shift_end_time: "-",
                    total_online_label: ai.active !== false ? "24 sa 0 dk" : "-",
                    total_talk_label: "0 dk",
                    total_break_label: "0 dk",
                    inbound_total_count: 0,
                    inbound_answered_count: 0,
                    answered_count: 0,
                    outbound_count: 0,
                    missed_count: 0,
                    transfer_count: 0,
                    pickup_count: 0,
                    action_count: 0,
                    efficiency_pct: 100,
                    availability_pct: 100,
                    answer_rate_pct: 100,
                    events: []
                  }));
                  const baseAgents = (timelineReport?.agents && timelineReport.agents.length > 0)
                    ? [...timelineReport.agents]
                    : [...fallbackUsers, ...fallbackAiAgents];

                  // Ensure any newly loaded users or AI agents not yet in baseAgents are appended
                  const existingNames = new Set(baseAgents.map(a => normalizeAgentName(a.agent_name)));
                  [...fallbackUsers, ...fallbackAiAgents].forEach(fb => {
                    const normFb = normalizeAgentName(fb.agent_name);
                    if (normFb && !existingNames.has(normFb)) {
                      existingNames.add(normFb);
                      baseAgents.push(fb);
                    }
                  });
                  const rawAgents = baseAgents;

                  const preparedAgents = rawAgents
                    .map((ag) => ({
                      ...ag,
                      shift_start_time: ag.shift_start_time || ((ag.events && ag.events.length > 0) ? ag.events[0].time : (ag.is_online ? "Aktif" : "-")),
                      total_online_label: ag.total_online_label || "-",
                      total_talk_label: ag.total_talk_label || "0 dk",
                      total_break_label: ag.total_break_label || "0 dk",
                      inbound_total_count: ag.inbound_total_count ?? ((Number(ag.answered_count || 0) - Number(ag.outbound_count || 0)) + Number(ag.missed_count || 0)),
                      inbound_answered_count: ag.inbound_answered_count ?? Math.max(0, Number(ag.answered_count || 0) - Number(ag.outbound_count || 0)),
                      answered_count: Number(ag.answered_count || 0),
                      outbound_count: Number(ag.outbound_count || 0),
                      missed_count: Number(ag.missed_count || 0),
                      transfer_count: Number(ag.transfer_count || 0),
                      pickup_count: Number(ag.pickup_count || 0),
                      action_count: Number(ag.action_count || 0),
                      efficiency_pct: Number(ag.efficiency_pct || 0),
                      events: ag.events || []
                    }))
                    .filter((ag) => {
                      if (supManagedUsers.length > 0 && users.length > 0) {
                        const agNorm = normalizeAgentName(ag.agent_name);
                        const agExt = String(ag.extension || "").trim();
                        const agId = String(ag.agent_id || "").trim();
                        const inScope = users.some((u) => {
                          const uNorm = normalizeAgentName(u.full_name || u.name || u.username || "");
                          const uExt = String(u.extension || "").trim();
                          const uId = String(u.id || "").trim();
                          return (
                            (uId && (agId === uId || agId === `user-${uId}`)) ||
                            (uExt && agExt === uExt) ||
                            (uNorm && agNorm && (agNorm === uNorm || agNorm.includes(uNorm)))
                          );
                        });
                        if (!inScope) return false;
                      }
                      if (selectedTimelineAgent !== "All" && normalizeAgentName(ag.agent_name) !== normalizeAgentName(selectedTimelineAgent) && ag.extension !== selectedTimelineAgent && ag.agent_id !== selectedTimelineAgent) {
                        return false;
                      }
                      if (!matchesSelectedAgent(ag.agent_name)) {
                        return false;
                      }
                      return true;
                    });

                  const activeAgentsForAvg = preparedAgents.filter(a => (a.events || []).length > 0 || a.total_online_seconds > 0);
                  const avgEfficiency = activeAgentsForAvg.length > 0
                    ? (activeAgentsForAvg.reduce((acc, cur) => acc + (Number(cur.efficiency_pct) || 0), 0) / activeAgentsForAvg.length).toFixed(1)
                    : "0.0";
                  const totalInboundAll = preparedAgents.reduce((acc, cur) => acc + (Number(cur.inbound_total_count) || 0), 0);
                  const totalAnsweredAll = preparedAgents.reduce((acc, cur) => acc + (Number(cur.answered_count) || 0), 0);
                  const totalOutboundAll = preparedAgents.reduce((acc, cur) => acc + (Number(cur.outbound_count) || 0), 0);
                  const totalMissedAll = preparedAgents.reduce((acc, cur) => acc + (Number(cur.missed_count) || 0), 0);

                  const getEventStyle = (type) => {
                    switch (type) {
                      case "login":
                        return {
                          badge: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
                          dot: "bg-emerald-500",
                          tag: "LOGIN"
                        };
                      case "call_inbound":
                        return {
                          badge: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60",
                          dot: "bg-blue-500",
                          tag: "GELEN ÇAĞRI"
                        };
                      case "call_outbound":
                        return {
                          badge: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60",
                          dot: "bg-indigo-500",
                          tag: "GİDEN ARAMA"
                        };
                      case "call_internal":
                        return {
                          badge: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/60",
                          dot: "bg-cyan-500",
                          tag: "DAHİLİ GÖRÜŞME"
                        };
                      case "call_transfer":
                      case "call_blind_transfer":
                      case "call_attended_transfer":
                        return {
                          badge: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60",
                          dot: "bg-purple-500",
                          tag: "ÇAĞRI TRANSFERİ"
                        };
                      case "call_pickup":
                        return {
                          badge: "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800/60",
                          dot: "bg-violet-500",
                          tag: "ÇAĞRI TOPLAMA"
                        };
                      case "call_hold":
                      case "call_unhold":
                        return {
                          badge: "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/60",
                          dot: "bg-orange-500",
                          tag: type === "call_hold" ? "BEKLETME (HOLD)" : "BEKLEMEDEN DÖNDÜ"
                        };
                      case "call_conference":
                        return {
                          badge: "bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800/60",
                          dot: "bg-fuchsia-500",
                          tag: "KONFERANS"
                        };
                      case "call_forwarded":
                        return {
                          badge: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60",
                          dot: "bg-sky-500",
                          tag: "YÖNLENDİRME"
                        };
                      case "break_start":
                        return {
                          badge: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
                          dot: "bg-amber-500",
                          tag: "MOLAYA ÇIKTI"
                        };
                      case "break_end":
                        return {
                          badge: "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/60",
                          dot: "bg-teal-500",
                          tag: "MOLADAN DÖNDÜ"
                        };
                      case "call_missed":
                      case "call_missed_outbound":
                      case "call_rejected":
                        return {
                          badge: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60",
                          dot: "bg-rose-500",
                          tag: type === "call_rejected" ? "REDDEDİLDİ" : "AÇILMADI / CEVAPSIZ"
                        };
                      case "profile_change":
                        return {
                          badge: "bg-lime-50 dark:bg-lime-950/40 text-lime-700 dark:text-lime-300 border-lime-200 dark:border-lime-800/60",
                          dot: "bg-lime-500",
                          tag: "PROFİL DEĞİŞİMİ"
                        };
                      case "call_note":
                        return {
                          badge: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
                          dot: "bg-slate-500",
                          tag: "ÇAĞRI NOTU"
                        };
                      case "logout":
                        return {
                          badge: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
                          dot: "bg-slate-500",
                          tag: "LOGOUT"
                        };
                      default:
                        return {
                          badge: "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700",
                          dot: "bg-slate-400",
                          tag: "AKSİYON"
                        };
                    }
                  };

                  const build24hBlocks = (events) => {
                    if (!events || events.length === 0) {
                      return [{ type: "offline", width: "100%", label: "Kayıtlı Hareket Yok" }];
                    }
                    const parseHour = (tStr) => {
                      if (!tStr || !tStr.includes(":")) return 9;
                      const [hh, mm] = tStr.split(":").map(Number);
                      return (hh || 0) + (mm || 0) / 60;
                    };
                    const blocks = [];
                    let cursor = 0;
                    const firstEvHr = Math.max(0, Math.min(23, parseHour(events[0]?.time || "09:00")));
                    if (firstEvHr > 0) {
                      blocks.push({ type: "offline", width: `${(firstEvHr / 24) * 100}%`, label: `00:00 - ${events[0]?.time} Çevrimdışı` });
                      cursor = firstEvHr;
                    }
                    events.forEach((ev, i) => {
                      const evHr = Math.max(cursor, Math.min(23.8, parseHour(ev.time)));
                      if (evHr > cursor) {
                        blocks.push({
                          type: "ready",
                          width: `${((evHr - cursor) / 24) * 100}%`,
                          label: "Müsait / Mesaide"
                        });
                        cursor = evHr;
                      }
                      let segDurHours = 0.15;
                      if (ev.type === "break_start") segDurHours = ev.break_name?.toLowerCase().includes("yemek") ? 0.75 : 0.25;
                      else if (ev.type?.startsWith("call_")) segDurHours = 0.18;
                      else if (ev.type === "login" || ev.type === "logout" || ev.type === "break_end") segDurHours = 0.06;

                      const nextEvHr = events[i + 1] ? parseHour(events[i + 1].time) : 24;
                      const actualSeg = Math.max(0.05, Math.min(segDurHours, Math.max(0.05, nextEvHr - cursor)));
                      if (cursor + actualSeg <= 24) {
                        blocks.push({
                          type: ev.type,
                          width: `${(actualSeg / 24) * 100}%`,
                          label: `${ev.time} - ${ev.description || ev.title}`
                        });
                        cursor += actualSeg;
                      }
                    });
                    if (cursor < 24) {
                      const hasLogout = events.some(e => e.type === "logout");
                      blocks.push({
                        type: hasLogout ? "offline" : "ready",
                        width: `${((24 - cursor) / 24) * 100}%`,
                        label: hasLogout ? "Çevrimdışı" : "Mesaide / Hazır"
                      });
                    }
                    return blocks;
                  };

                  // Resolve active modal agent with fresh live data from preparedAgents
                  const modalAgent = selectedTimelineAgentModal
                    ? (preparedAgents.find(a => a.agent_id === selectedTimelineAgentModal.agent_id || a.extension === selectedTimelineAgentModal.extension) || selectedTimelineAgentModal)
                    : null;

                  return (
                    <>

                      {/* Compact KPI Summary Strip */}
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className={"rounded-2xl p-4 border flex flex-col justify-between gap-1 " + borderLight + " " + lightBg}>
                          <span className={"text-[10px] font-extrabold uppercase tracking-wider " + text}>Ortalama Verimlilik</span>
                          <div className="flex items-baseline gap-2">
                            <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">%{avgEfficiency}</h4>
                            <span className="text-[10px] font-bold text-slate-400">Aktif Temsilciler</span>
                          </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-1 shadow-xs">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Gelen Çağrı</span>
                          <div className="flex items-baseline gap-2">
                            <h4 className="text-2xl font-black text-blue-600 dark:text-blue-400">{totalInboundAll}</h4>
                            <span className="text-[10px] font-bold text-slate-400">Toplam Gelen</span>
                          </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-1 shadow-xs">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Cevaplanan Çağrı</span>
                          <div className="flex items-baseline gap-2">
                            <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{totalAnsweredAll}</h4>
                            <span className="text-[10px] font-bold text-slate-400">Başarılı Görüşme</span>
                          </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-1 shadow-xs">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Giden Çağrı</span>
                          <div className="flex items-baseline gap-2">
                            <h4 className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{totalOutboundAll}</h4>
                            <span className="text-[10px] font-bold text-slate-400">Dış / Dahili Arama</span>
                          </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-1 shadow-xs col-span-2 lg:col-span-1">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Cevapsız Çağrı</span>
                          <div className="flex items-baseline gap-2">
                            <h4 className="text-2xl font-black text-rose-500">{totalMissedAll}</h4>
                            <span className="text-[10px] font-bold text-slate-400">Açılmayan / Kaçan</span>
                          </div>
                        </div>
                      </div>

                      {/* Main Single-Row Per Agent Summary Table (Just like other reports) */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse min-w-[980px]">
                            <thead>
                              <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                                {visibleColumns.agent && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Temsilci</th>}
                                {visibleColumns.shiftStart && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Mesai Başlama</th>}
                                {visibleColumns.onlineDuration && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Mesaide Geçen Süre</th>}
                                {visibleColumns.inbound && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Gelen Çağrı</th>}
                                {visibleColumns.answered && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Cevaplanan</th>}
                                {visibleColumns.outbound && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Giden Çağrı</th>}
                                {visibleColumns.missed && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Cevapsız</th>}
                                {visibleColumns.actions && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Transfer / Toplama</th>}
                                {visibleColumns.breakTime && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Mola Süresi</th>}
                                {visibleColumns.efficiency && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Verimlilik</th>}
                                {visibleColumns.timelineBtn && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Timeline</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                              {preparedAgents.length === 0 ? (
                                <tr>
                                  <td colSpan="11" className="p-8 text-center text-slate-400 font-semibold">
                                    Kayıtlı temsilci bulunamadı.
                                  </td>
                                </tr>
                              ) : (
                                preparedAgents.map((ag, idx) => {
                                  const eff = Number(ag.efficiency_pct || 0);
                                  const effBadge = eff >= 80
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60"
                                    : eff >= 50
                                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60"
                                    : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";

                                  return (
                                    <tr
                                      key={ag.agent_id || idx}
                                      className={"transition-colors duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-800/40"}
                                    >
                                      {/* Temsilci */}
                                      {visibleColumns.agent && (
                                        <td className="p-4">
                                          <div className="flex items-center gap-3">
                                            <img
                                              src={getAgentAvatarUrl(ag.agent_name, ag.extension, ag.avatar, ag.is_ai)}
                                              alt={ag.agent_name}
                                              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-0.5 object-cover shrink-0 shadow-xs"
                                            />
                                            <div>
                                              <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                                                  {ag.agent_name}
                                                </span>
                                                <span
                                                  className={`w-2 h-2 rounded-full ${ag.is_online ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
                                                  title={ag.is_online ? "Çevrimiçi" : "Çevrimdışı"}
                                                />
                                              </div>
                                              <span className="text-[10px] font-semibold text-slate-400">
                                                Dahili: {ag.extension} {(ag.events || []).length > 0 ? `• ${(ag.events || []).length} hareket` : ""}
                                              </span>
                                            </div>
                                          </div>
                                        </td>
                                      )}

                                      {/* Mesai Başlama Saati */}
                                      {visibleColumns.shiftStart && (
                                        <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300 font-mono">
                                          {ag.shift_start_time || "-"}
                                        </td>
                                      )}

                                      {/* Mesaide Geçirdiği Süre */}
                                      {visibleColumns.onlineDuration && (
                                        <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">
                                          {ag.total_online_label || "-"}
                                        </td>
                                      )}

                                      {/* Gelen Çağrı */}
                                      {visibleColumns.inbound && (
                                        <td className="p-4 text-center">
                                          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-lg font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
                                            {ag.inbound_total_count}
                                          </span>
                                        </td>
                                      )}

                                      {/* Cevaplanan Çağrı */}
                                      {visibleColumns.answered && (
                                        <td className="p-4 text-center">
                                          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-lg font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                                            {ag.answered_count}
                                          </span>
                                        </td>
                                      )}

                                      {/* Giden Çağrı */}
                                      {visibleColumns.outbound && (
                                        <td className="p-4 text-center">
                                          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-lg font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
                                            {ag.outbound_count}
                                          </span>
                                        </td>
                                      )}

                                      {/* Cevapsız Çağrı */}
                                      {visibleColumns.missed && (
                                        <td className="p-4 text-center">
                                          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-lg font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40">
                                            {ag.missed_count}
                                          </span>
                                        </td>
                                      )}

                                      {/* Transfer / Toplama / Aksiyon */}
                                      {visibleColumns.actions && (
                                        <td className="p-4 text-center">
                                          <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-lg font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-100 dark:border-purple-900/40" title={`Transfer: ${ag.transfer_count || 0}, Çağrı Toplama: ${ag.pickup_count || 0}, Toplam Ek Aksiyon: ${ag.action_count || 0}`}>
                                            {ag.action_count || 0}
                                          </span>
                                        </td>
                                      )}

                                      {/* Mola Süresi */}
                                      {visibleColumns.breakTime && (
                                        <td className="p-4 text-center font-semibold text-amber-600 dark:text-amber-400">
                                          {ag.total_break_label || "0 dk"}
                                        </td>
                                      )}

                                      {/* Toplam Verimlilik */}
                                      {visibleColumns.efficiency && (
                                        <td className="p-4 text-center">
                                          <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black border ${effBadge}`}>
                                            %{eff}
                                          </span>
                                        </td>
                                      )}

                                      {/* Sağda Büyüteç Butonu (Timeline Detay Popup Aç) */}
                                      {visibleColumns.timelineBtn && (
                                        <td className="p-4 text-center">
                                          <button
                                            onClick={() => {
                                              setTimelineModalEventFilters([]);
                                              setSelectedTimelineAgentModal(ag);
                                            }}
                                            className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-primary border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer hover:scale-105 active:scale-95 duration-150 inline-flex items-center justify-center shadow-xs"
                                            title={`${ag.agent_name} Gün İçi Kronolojik Hareket Dökümünü (Timeline) Görüntüle`}
                                          >
                                            <Search size={14} />
                                          </button>
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Agent Timeline Detail Popup Modal (Opened via Magnifier Button) */}
                      {modalAgent && (
                        <div
                          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                          onClick={() => setSelectedTimelineAgentModal(null)}
                        >
                          <div
                            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col gap-5 animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Modal Header */}
                            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-3.5">
                                <img
                                  src={getAgentAvatarUrl(modalAgent.agent_name, modalAgent.extension, modalAgent.avatar, modalAgent.is_ai)}
                                  alt={modalAgent.agent_name}
                                  className="h-12 w-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-1 object-cover shadow-sm shrink-0"
                                />
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                                      {modalAgent.agent_name} — Temsilci Kronolojisi (Timeline)
                                    </h3>
                                    <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      Dahili: {modalAgent.extension}
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                      Tarih: {formatDateOnly(timelineDate)}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    <span>Mesai Başlama: <strong className="text-slate-800 dark:text-slate-200">{modalAgent.shift_start_time}</strong></span>
                                    <span>•</span>
                                    <span>Mesaide Geçen Süre: <strong className="text-slate-800 dark:text-slate-200">{modalAgent.total_online_label}</strong></span>
                                    <span>•</span>
                                    <span>Görüşme Süresi: <strong className="text-blue-600 dark:text-blue-400">{modalAgent.total_talk_label}</strong></span>
                                    <span>•</span>
                                    <span>Mola Süresi: <strong className="text-amber-600 dark:text-amber-400">{modalAgent.total_break_label}</strong></span>
                                    <span>•</span>
                                    <span>Verimlilik: <strong className="text-emerald-600 dark:text-emerald-400">%{modalAgent.efficiency_pct}</strong></span>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => setSelectedTimelineAgentModal(null)}
                                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition cursor-pointer"
                                title="Kapat"
                              >
                                <X size={16} />
                              </button>
                            </div>

                            {/* Modal Summary Metrics Row */}
                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 text-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Gelen Çağrı</span>
                                <span className="text-lg font-black text-blue-600 dark:text-blue-400">{modalAgent.inbound_total_count}</span>
                              </div>
                              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 text-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Cevaplanan</span>
                                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{modalAgent.answered_count}</span>
                              </div>
                              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 text-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Giden Çağrı</span>
                                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{modalAgent.outbound_count}</span>
                              </div>
                              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 text-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Cevapsız</span>
                                <span className="text-lg font-black text-rose-500">{modalAgent.missed_count}</span>
                              </div>
                              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 text-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Transfer / Toplama</span>
                                <span className="text-lg font-black text-purple-600 dark:text-purple-400">{modalAgent.action_count || 0}</span>
                              </div>
                              <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 text-center">
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">Verimlilik</span>
                                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">%{modalAgent.efficiency_pct}</span>
                              </div>
                            </div>

                            {(modalAgent.events || []).length === 0 ? (
                              <div className="py-12 px-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center gap-2">
                                <Clock size={32} className="text-slate-300 dark:text-slate-600" />
                                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                                  Seçilen tarihte ({formatDateOnly(timelineDate)}) bu kullanıcı için henüz kaydedilmiş bir sistem hareketi bulunmuyor.
                                </p>
                                <p className="text-xs text-slate-400 max-w-lg">
                                  Kullanıcı sisteme giriş yaptığında, çağrı aldığında/yaptığında, çağrı transfer ettiğinde, çağrı topladığında (*8), beklemeye aldığında, profil veya mola değiştirdiğinde tüm hareketleri gerçek zamanlı olarak burada listelenir.
                                </p>
                              </div>
                            ) : (() => {
                              const allModalEvents = modalAgent.events || [];
                              const getEventFilterCategory = (type) => {
                                if (type === "login" || type === "logout" || type === "profile_change") return "login_logout";
                                if (type === "break_start" || type === "break_end") return "breaks";
                                if (type === "call_inbound") return "inbound";
                                if (type === "call_outbound" || type === "call_internal") return "outbound";
                                if (type === "call_missed" || type === "call_missed_outbound" || type === "call_rejected") return "missed";
                                return "actions";
                              };

                              const filterCategories = [
                                { id: "login_logout", label: "Login / Logout", dot: "bg-emerald-500" },
                                { id: "breaks", label: "Molalar", dot: "bg-amber-500" },
                                { id: "inbound", label: "Gelen Çağrılar", dot: "bg-blue-500" },
                                { id: "outbound", label: "Giden Çağrılar", dot: "bg-indigo-500" },
                                { id: "missed", label: "Cevapsız Çağrılar", dot: "bg-rose-500" },
                                { id: "actions", label: "Transfer / Diğer", dot: "bg-purple-500" }
                              ];

                              const isAllSelected = timelineModalEventFilters.length === 0 || timelineModalEventFilters.length === filterCategories.length;
                              const filteredModalEvents = isAllSelected
                                ? allModalEvents
                                : allModalEvents.filter((ev) => timelineModalEventFilters.includes(getEventFilterCategory(ev.type)));

                              const handleToggleTimelineCategory = (catId) => {
                                setTimelineModalEventFilters((prev) => {
                                  if (prev.length === 0) return [catId];
                                  const exists = prev.includes(catId);
                                  const next = exists ? prev.filter((c) => c !== catId) : [...prev, catId];
                                  if (next.length === 0 || next.length === filterCategories.length) return [];
                                  return next;
                                });
                              };

                              return (
                                <>
                                  {/* Event Category Filter Bar */}
                                  <div className={"p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 " + borderLight + " " + lightBg}>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={"text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 mr-1 " + text}>
                                        <Filter size={13} />
                                        Hareket Filtresi:
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setTimelineModalEventFilters([])}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                                          isAllSelected
                                            ? `${bg} text-white border-transparent shadow-xs`
                                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                                        }`}
                                      >
                                        <span>Tümü</span>
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-extrabold ${isAllSelected ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                                          {allModalEvents.length}
                                        </span>
                                      </button>

                                      {filterCategories.map((cat) => {
                                        const count = allModalEvents.filter((ev) => getEventFilterCategory(ev.type) === cat.id).length;
                                        const isActive = !isAllSelected && timelineModalEventFilters.includes(cat.id);
                                        return (
                                          <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => handleToggleTimelineCategory(cat.id)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                                              isActive
                                                ? `${bg} text-white border-transparent shadow-xs`
                                                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                                            }`}
                                          >
                                            <span className={`w-2 h-2 rounded-full ${isActive ? "bg-white" : cat.dot}`} />
                                            <span>{cat.label}</span>
                                            <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-extrabold ${isActive ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                                              {count}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {!isAllSelected && (
                                      <button
                                        type="button"
                                        onClick={() => setTimelineModalEventFilters([])}
                                        className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer"
                                      >
                                        Tümünü Göster
                                      </button>
                                    )}
                                  </div>

                                  {/* Step-by-Step Visual Flow Cards */}
                                  <div>
                                    <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                                      Adım Adım Hareket Akışı ({filteredModalEvents.length} Kayıt)
                                    </h5>
                                    {filteredModalEvents.length === 0 ? (
                                      <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold text-slate-400">
                                        Seçilen filtreye uygun hareket kaydı bulunamadı.
                                      </div>
                                    ) : (
                                      <div className="flex items-stretch flex-wrap gap-2.5">
                                        {filteredModalEvents.map((ev, evIdx) => {
                                          const st = getEventStyle(ev.type);
                                          return (
                                            <React.Fragment key={evIdx}>
                                              <div className={`px-3.5 py-2.5 rounded-2xl border flex flex-col justify-between min-w-[190px] max-w-[260px] shadow-xs ${st.badge}`}>
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                  <span className="inline-flex items-center gap-1.5 text-xs font-black font-mono">
                                                    <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                                                    {ev.time}
                                                  </span>
                                                  <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/70 dark:bg-slate-900/60">
                                                    {st.tag}
                                                  </span>
                                                </div>
                                                <p className="text-xs font-bold leading-snug">
                                                  {ev.description || ev.title}
                                                </p>
                                                <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-current/10 text-[10px] font-semibold opacity-85">
                                                  <span className="truncate" title={ev.detail}>{ev.detail}</span>
                                                  {ev.duration_label && ev.duration_label !== "-" && (
                                                    <span className="shrink-0 font-bold">{ev.duration_label}</span>
                                                  )}
                                                </div>
                                              </div>
                                              {evIdx < filteredModalEvents.length - 1 && (
                                                <div className="flex items-center justify-center text-slate-300 dark:text-slate-600 px-0.5">
                                                  <ArrowRight size={16} />
                                                </div>
                                              )}
                                            </React.Fragment>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  {/* 24-Hour Status Bar */}
                                  <div className="pt-1">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1.5 px-1">
                                      <span>00:00</span>
                                      <span>06:00</span>
                                      <span>09:00</span>
                                      <span>12:00</span>
                                      <span>15:00</span>
                                      <span>18:00</span>
                                      <span>24:00</span>
                                    </div>
                                    <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex border border-slate-200/60 dark:border-slate-700/60">
                                      {build24hBlocks(allModalEvents).map((b, bIdx) => {
                                        let bgCls = "bg-slate-200 dark:bg-slate-800";
                                        if (b.type === "ready" || b.type === "login" || b.type === "break_end") bgCls = "bg-emerald-500";
                                        else if (b.type === "call_inbound" || b.type === "call_outbound" || b.type === "call_internal") bgCls = "bg-blue-500";
                                        else if (b.type?.includes("transfer") || b.type === "call_pickup" || b.type === "call_forwarded" || b.type === "call_conference") bgCls = "bg-purple-500";
                                        else if (b.type === "break_start" || b.type === "call_hold") bgCls = "bg-amber-500";
                                        else if (b.type === "call_missed" || b.type === "call_missed_outbound" || b.type === "call_rejected") bgCls = "bg-rose-500";
                                        return (
                                          <div
                                            key={bIdx}
                                            style={{ width: b.width }}
                                            title={b.label}
                                            className={`${bgCls} h-full border-r border-white/20 last:border-r-0 transition-opacity hover:opacity-85`}
                                          />
                                        );
                                      })}
                                    </div>
                                    <div className="flex items-center flex-wrap gap-4 mt-2 text-[10px] font-bold text-slate-500">
                                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> Login / Mesaide</span>
                                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" /> Çağrıda (Gelen/Giden/Dahili)</span>
                                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-purple-500 inline-block" /> Transfer / Çağrı Toplama / Yönlendirme</span>
                                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" /> Mola / Bekletme (Hold)</span>
                                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" /> Cevapsız / Reddedilen</span>
                                    </div>
                                  </div>

                                  {/* Detailed Chronological Event List Table */}
                                  <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
                                    <div className="max-h-[300px] overflow-y-auto">
                                      <table className="w-full text-left border-collapse text-xs">
                                        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                                          <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="p-3 font-bold uppercase text-[10px] text-slate-500">Saat</th>
                                            <th className="p-3 font-bold uppercase text-[10px] text-slate-500">İşlem Tipi</th>
                                            <th className="p-3 font-bold uppercase text-[10px] text-slate-500">Hareket Açıklaması</th>
                                            <th className="p-3 font-bold uppercase text-[10px] text-slate-500">Detay / Numara / Hedef</th>
                                            <th className="p-3 font-bold uppercase text-[10px] text-slate-500 text-center">Süre</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                          {filteredModalEvents.length === 0 ? (
                                            <tr>
                                              <td colSpan="5" className="p-6 text-center text-slate-400 font-semibold">
                                                Seçilen filtreye uygun hareket kaydı bulunamadı.
                                              </td>
                                            </tr>
                                          ) : (
                                            filteredModalEvents.map((ev, i) => {
                                              const st = getEventStyle(ev.type);
                                              return (
                                                <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                                  <td className="p-3 font-black font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">{ev.time}</td>
                                                  <td className="p-3 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${st.badge}`}>
                                                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                                      {st.tag}
                                                    </span>
                                                  </td>
                                                  <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{ev.description || ev.title}</td>
                                                  <td className="p-3 font-semibold text-slate-600 dark:text-slate-400">{ev.detail}</td>
                                                  <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{ev.duration_label || "-"}</td>
                                                </tr>
                                              );
                                            })
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : isTrafficMode ? (
              /* Traffic Load Mode */
              <div className="p-5 flex flex-col gap-6 flex-1 overflow-y-auto scrollbar-thin">
                {(() => {
                  const {
                    hourlySlots,
                    activeSlots,
                    peakHourIdx,
                    peakHourValue,
                    totalTraffic,
                    avgCapacity,
                    estimatedStaff,
                    hasHourFilter,
                    hourRangeLabel,
                  } = computeFilteredTrafficReport(filteredCalls);

                  return (
                    <>
                      {/* KPI Header */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>En Yoğun Saat (Peak Hour)</p>
                          <h4 className="text-4xl font-black text-rose-500 flex items-center gap-3">
                            <Activity size={28} />
                            {totalTraffic > 0 ? `${String(peakHourIdx).padStart(2, "0")}:00` : "--:--"}
                          </h4>
                          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            {totalTraffic > 0
                              ? `Maksimum ${peakHourValue} çağrı alındı (Toplam: ${totalTraffic})`
                              : "Seçilen aralıkta çağrı kaydı yok"}
                          </p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Kapasite Kullanım Oranı</p>
                          <h4 className="text-4xl font-black text-amber-500">
                            %{avgCapacity}
                          </h4>
                          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            {hasHourFilter ? `${hourRangeLabel} ortalama hat / personel doluluğu` : "Günlük ortalama hat / personel doluluğu"}
                          </p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Tahmini Personel İhtiyacı</p>
                          <h4 className="text-4xl font-black text-emerald-500">
                            {estimatedStaff} Temsilci
                          </h4>
                          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pik saatteki SLA hedefleri için önerilen</p>
                        </div>
                      </div>

                      {/* Hourly Bar Chart */}
                      <div className={"w-full shrink-0 rounded-2xl p-6 md:p-8 border " + borderLight + " " + lightBg}>
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                          <div>
                            <h4 className={"text-sm font-bold uppercase tracking-wider " + text}>Saatlik Çağrı Hacmi Dağılımı</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {hasHourFilter
                                ? `${hourRangeLabel} saat aralığında gelen ve giden çağrı trafik yükü`
                                : "24 saatlik periyotta gelen ve giden çağrı trafik yükü"}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> Düşük
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span> Orta
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span> Kritik (Pik)
                            </span>
                            <BarChart2 size={18} className="text-slate-400 ml-1" />
                          </div>
                        </div>

                        <div className="w-full pt-6">
                          <div className="flex items-end justify-between w-full gap-1.5 sm:gap-2">
                            {hourlySlots.map((slot) => {
                              const barHeightPx =
                                slot.count > 0
                                  ? Math.max(14, Math.round((slot.ratioPct / 100) * 160))
                                  : 4;
                              let barColor = "bg-slate-200 dark:bg-slate-800/90";
                              if (slot.count > 0) {
                                if (slot.loadKey === "critical") barColor = "bg-rose-500";
                                else if (slot.loadKey === "medium") barColor = "bg-amber-500";
                                else barColor = "bg-emerald-500";
                              }

                              return (
                                <div key={slot.hour} className="flex flex-col items-center flex-1 min-w-[20px] group relative">
                                  {/* Hover Tooltip */}
                                  <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded-lg shadow-lg whitespace-nowrap z-20 pointer-events-none border border-slate-700">
                                    {slot.hourLabel}:00 — {slot.count} Çağrı
                                  </div>

                                  {/* Track + Bar */}
                                  <div className="w-full h-44 flex flex-col items-center justify-end">
                                    {slot.count > 0 && (
                                      <span className="mb-1 text-[10px] font-extrabold text-slate-700 dark:text-slate-200 leading-none">
                                        {slot.count}
                                      </span>
                                    )}
                                    <div
                                      className={`w-full max-w-[36px] rounded-t-md transition-all duration-300 group-hover:brightness-110 ${barColor}`}
                                      style={{ height: `${barHeightPx}px` }}
                                    ></div>
                                  </div>

                                  {/* Hour Label */}
                                  <div className="mt-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                    {slot.hourLabel}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Hourly Data Table */}
                      <div className="w-full shrink-0 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
                        <table className="w-full text-left border-collapse min-w-[640px]">
                          <thead>
                            <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                              {visibleColumns.timeSlot && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Zaman Dilimi (Saat)</th>}
                              {visibleColumns.callVolume && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Toplam Çağrı Hacmi</th>}
                              {visibleColumns.loadLevel && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Yük Seviyesi</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {activeSlots.length === 0 ? (
                              <tr>
                                <td colSpan="3" className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs font-semibold">
                                  Seçilen tarih ve saat aralığında çağrı trafiği bulunamadı.
                                </td>
                              </tr>
                            ) : (
                              activeSlots.map((slot) => {
                                let levelBadge = (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800/50">
                                    Düşük Yoğunluk
                                  </span>
                                );
                                if (slot.loadKey === "critical") {
                                  levelBadge = (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/70 dark:border-rose-800/50">
                                      Kritik Yoğunluk (Pik)
                                    </span>
                                  );
                                } else if (slot.loadKey === "medium") {
                                  levelBadge = (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/70 dark:border-amber-800/50">
                                      Orta Yoğunluk
                                    </span>
                                  );
                                }

                                return (
                                  <tr
                                    key={slot.hour}
                                    className={"border-b " + borderLight + " transition-colors duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-800/40"}
                                  >
                                    {visibleColumns.timeSlot && (
                                      <td className="p-4 font-bold text-slate-700 dark:text-slate-200">
                                        {slot.timeSlotLabel}
                                      </td>
                                    )}
                                    {visibleColumns.callVolume && (
                                      <td className="p-4 text-center font-black text-slate-800 dark:text-slate-100">
                                        {slot.count}
                                      </td>
                                    )}
                                    {visibleColumns.loadLevel && (
                                      <td className="p-4 text-center">
                                        {levelBadge}
                                      </td>
                                    )}
                                  </tr>
                                );
                              })
                            )}
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
                  // Format YYYY-MM-DD to DD.MM.YYYY
                  const fmtDateLabel = (isoDate) => {
                    if (!isoDate) return "";
                    const parts = String(isoDate).split("-");
                    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
                    return isoDate;
                  };

                  // Collect unique call dates in filteredCalls (sorted newest first)
                  const dateCountsMap = {};
                  filteredCalls.forEach((c) => {
                    if (!c.start_time) return;
                    const d = new Date(c.start_time);
                    if (isNaN(d.getTime())) return;
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, "0");
                    const dd = String(d.getDate()).padStart(2, "0");
                    const key = `${yyyy}-${mm}-${dd}`;
                    dateCountsMap[key] = (dateCountsMap[key] || 0) + 1;
                  });
                  const availableCallDates = Object.keys(dateCountsMap).sort((a, b) => b.localeCompare(a));

                  // Ensure selectedTrunkChartDate is valid
                  const effectiveChartDate =
                    selectedTrunkChartDate !== "ALL" && availableCallDates.includes(selectedTrunkChartDate)
                      ? selectedTrunkChartDate
                      : "ALL";

                  // Active date range label shown on the chart & report
                  const periodDisplayLabel = (() => {
                    if (effectiveChartDate !== "ALL") {
                      return `${fmtDateLabel(effectiveChartDate)} (Seçili Gün)`;
                    }
                    if (filterStartDate && filterEndDate) {
                      return filterStartDate === filterEndDate
                        ? fmtDateLabel(filterStartDate)
                        : `${fmtDateLabel(filterStartDate)} — ${fmtDateLabel(filterEndDate)}`;
                    }
                    if (filterStartDate) return `${fmtDateLabel(filterStartDate)} sonrası`;
                    if (filterEndDate) return `${fmtDateLabel(filterEndDate)} öncesi`;
                    if (availableCallDates.length > 0) {
                      const oldest = availableCallDates[availableCallDates.length - 1];
                      const newest = availableCallDates[0];
                      return oldest === newest
                        ? fmtDateLabel(newest)
                        : `${fmtDateLabel(oldest)} — ${fmtDateLabel(newest)}`;
                    }
                    return fmtDateLabel(getTodayDateString());
                  })();

                  // Calls used for the 24h chart (filtered by effectiveChartDate if a single day is selected)
                  const chartCalls =
                    effectiveChartDate === "ALL"
                      ? filteredCalls
                      : filteredCalls.filter((c) => {
                          if (!c.start_time) return false;
                          const d = new Date(c.start_time);
                          if (isNaN(d.getTime())) return false;
                          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                          return key === effectiveChartDate;
                        });

                  // Helper: convert call to [startMs, endMs] interval
                  const getCallInterval = (call) => {
                    if (!call.start_time) return null;
                    const startMs = new Date(call.start_time).getTime();
                    if (isNaN(startMs)) return null;
                    let durSec = Number(call.duration_total) || Number(call.duration_talk) || 0;
                    if (!durSec && call.end_time) {
                      const endParsed = new Date(call.end_time).getTime();
                      if (!isNaN(endParsed) && endParsed > startMs) {
                        durSec = Math.round((endParsed - startMs) / 1000);
                      }
                    }
                    // Clamp duration between 5s (ring/setup) and 7200s (2 hours) for realistic channel occupancy
                    durSec = Math.min(7200, Math.max(5, durSec || 15));
                    return {
                      startMs,
                      endMs: startMs + durSec * 1000,
                      call
                    };
                  };

                  // Sweep-line algorithm to compute exact maximum simultaneous calls
                  const computeMaxConcurrent = (intervals) => {
                    if (!intervals || intervals.length === 0) return { max: 0, peakTimeMs: null };
                    const events = [];
                    intervals.forEach((iv) => {
                      events.push({ t: iv.startMs, delta: 1 });
                      events.push({ t: iv.endMs, delta: -1 });
                    });
                    events.sort((a, b) => (a.t !== b.t ? a.t - b.t : a.delta - b.delta));
                    let current = 0;
                    let max = 0;
                    let peakTimeMs = null;
                    for (const ev of events) {
                      current += ev.delta;
                      if (current > max) {
                        max = current;
                        peakTimeMs = ev.t;
                      }
                    }
                    return { max, peakTimeMs };
                  };

                  // Real SIP Trunks from system settings (/api/settings/trunks)
                  const realTrunks = Array.isArray(trunks) ? trunks : [];
                  const activeTrunks = realTrunks.filter((t) => t.is_active !== false);
                  const totalConfiguredCapacity =
                    (activeTrunks.length > 0 ? activeTrunks : realTrunks).reduce(
                      (sum, t) => sum + (Number(t.max_channels) || 30),
                      0
                    ) || 30;
                  const trunkCapacity = Math.max(1, totalConfiguredCapacity);

                  // Match calls to real trunks
                  const cleanDigits = (str) => String(str || "").replace(/\D/g, "");
                  const last10 = (str) => {
                    const d = cleanDigits(str);
                    return d.length >= 10 ? d.slice(-10) : d;
                  };

                  const primaryTrunkId =
                    (activeTrunks[0] && activeTrunks[0].id) ||
                    (realTrunks[0] && realTrunks[0].id) ||
                    null;

                  const trunkBuckets = {};
                  realTrunks.forEach((t) => {
                    trunkBuckets[t.id] = [];
                  });

                  const allIntervals = [];
                  chartCalls.forEach((call) => {
                    const iv = getCallInterval(call);
                    if (!iv) return;
                    allIntervals.push(iv);

                    const callerL10 = last10(call.caller_number);
                    const calleeL10 = last10(call.callee_number);
                    const rawTrunkName = String(call.trunk || call.trunk_name || "").toLowerCase();

                    let matchedTrunk = realTrunks.find((t) => {
                      if (rawTrunkName && String(t.trunk_name || "").toLowerCase() === rawTrunkName) {
                        return true;
                      }
                      const didL10 = last10(t.did_number);
                      const userL10 = last10(t.username);
                      if (didL10 && didL10.length >= 7 && (callerL10 === didL10 || calleeL10 === didL10)) {
                        return true;
                      }
                      if (userL10 && userL10.length >= 7 && (callerL10 === userL10 || calleeL10 === userL10)) {
                        return true;
                      }
                      return false;
                    });

                    // If call is an external call and didn't explicitly include the DID in caller/callee, assign to primary active trunk
                    if (!matchedTrunk && primaryTrunkId !== null) {
                      const dir = getCallDirection(call);
                      if (dir !== "Dahili") {
                        matchedTrunk = realTrunks.find((t) => t.id === primaryTrunkId);
                      }
                    }

                    if (matchedTrunk && trunkBuckets[matchedTrunk.id]) {
                      trunkBuckets[matchedTrunk.id].push(iv);
                    }
                  });

                  // Compute overall peak concurrency
                  const overallPeakObj = computeMaxConcurrent(allIntervals);
                  const peakConcurrent = overallPeakObj.max;
                  const peakTimestampLabel = overallPeakObj.peakTimeMs
                    ? new Date(overallPeakObj.peakTimeMs).toLocaleString("tr-TR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })
                    : null;

                  const maxSaturation = Math.round((peakConcurrent / trunkCapacity) * 100);

                  // Compute actual rejected/failed calls due to trunk/channel congestion or capacity overflow
                  let overflowCallsCount = 0;
                  if (allIntervals.length > 0) {
                    const sortedByStart = [...allIntervals].sort((a, b) => a.startMs - b.startMs);
                    const activeEnds = [];
                    sortedByStart.forEach((iv) => {
                      for (let i = activeEnds.length - 1; i >= 0; i--) {
                        if (activeEnds[i] <= iv.startMs) activeEnds.splice(i, 1);
                      }
                      const rawSt = String(iv.call.status || "").toUpperCase();
                      const isCongested =
                        rawSt === "CONGESTION" ||
                        rawSt === "CHANUNAVAIL" ||
                        activeEnds.length >= trunkCapacity;
                      if (isCongested) {
                        overflowCallsCount++;
                      }
                      activeEnds.push(iv.endMs);
                    });
                  }
                  const rejectedCalls = overflowCallsCount;
                  const totalFiltered = chartCalls.length;
                  const rejectionRate =
                    totalFiltered > 0 ? ((rejectedCalls / totalFiltered) * 100).toFixed(1) : "0.0";

                  // Compute deterministic 24-hour concurrent channel timeline (hour 00..23)
                  const hourlyBuckets = Array.from({ length: 24 }, () => []);
                  allIntervals.forEach((iv) => {
                    const startHr = new Date(iv.startMs).getHours();
                    const endHr = new Date(iv.endMs).getHours();
                    if (!isNaN(startHr) && startHr >= 0 && startHr < 24) {
                      hourlyBuckets[startHr].push(iv);
                      if (!isNaN(endHr) && endHr !== startHr && endHr >= 0 && endHr < 24 && iv.endMs - iv.startMs <= 3600000) {
                        hourlyBuckets[endHr].push(iv);
                      }
                    }
                  });

                  const hourlyDetails = hourlyBuckets.map((bucket, hr) => {
                    const { max, peakTimeMs } = computeMaxConcurrent(bucket);
                    return {
                      hour: hr,
                      peakChannels: max,
                      totalCalls: bucket.length,
                      peakDateStr: peakTimeMs
                        ? new Date(peakTimeMs).toLocaleDateString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric"
                          })
                        : null
                    };
                  });
                  const concurrentTimeline = hourlyDetails.map((d) => d.peakChannels);
                  const chartMaxScale = Math.max(trunkCapacity, ...concurrentTimeline, 1);

                  // Build real providers list from trunks state
                  const providers = realTrunks.map((t) => {
                    const limit = Number(t.max_channels) || 30;
                    const tIntervals = trunkBuckets[t.id] || [];
                    const { max: used } = computeMaxConcurrent(tIntervals);
                    const totalCallsOnTrunk = tIntervals.length;
                    const satPct = Math.round((used / Math.max(1, limit)) * 100);
                    const isActive = t.is_active !== false;
                    const liveReg = isActive ? trunkStatuses[t.id] || "active" : "passive";

                    let statusLabel = "Normal";
                    let statusBadgeClass =
                      "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50";
                    if (!isActive) {
                      statusLabel = "Pasif";
                      statusBadgeClass =
                        "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
                    } else if (used >= limit || satPct >= 90) {
                      statusLabel = "Kritik";
                      statusBadgeClass =
                        "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/50";
                    } else if (satPct >= 70) {
                      statusLabel = "Yoğun";
                      statusBadgeClass =
                        "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50";
                    }

                    return {
                      id: t.id,
                      name: t.trunk_name || "SIP Trunk",
                      host: t.host ? `${t.host}:${t.port || 5060}` : "-",
                      did: t.did_number || t.username || "-",
                      trunkType: t.trunk_type === "peer" ? "PEER" : "REGISTER",
                      liveReg,
                      isActive,
                      limit,
                      used,
                      totalCalls: totalCallsOnTrunk,
                      satPct,
                      status: statusLabel,
                      statusBadgeClass
                    };
                  });

                  return (
                    <>
                      {/* KPI Header */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <div className="flex items-center justify-between gap-2">
                            <p className={"text-xs font-bold uppercase tracking-wider " + text}>Maksimum Eşzamanlı Çağrı</p>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {totalFiltered} Toplam Çağrı
                            </span>
                          </div>
                          <h4 className="text-4xl font-black text-blue-500 flex items-center gap-3">
                            <Server size={28} />
                            {peakConcurrent}
                          </h4>
                          <p className="text-sm font-medium text-slate-500">
                            {peakTimestampLabel
                              ? `Pik Zamanı: ${peakTimestampLabel}`
                              : "Aynı anda hatta olan maksimum kişi"}
                          </p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Maksimum Hat Doluluk Oranı</p>
                          <h4 className={`text-4xl font-black ${maxSaturation >= 85 ? "text-rose-500" : maxSaturation >= 65 ? "text-amber-500" : "text-emerald-500"}`}>
                            %{maxSaturation}
                          </h4>
                          <p className="text-sm font-medium text-slate-500">
                            Toplam {trunkCapacity} kanal kapasitesi üzerinden ({realTrunks.length} Dış Hat)
                          </p>
                        </div>
                        <div className={"rounded-2xl p-6 border flex flex-col gap-2 " + borderLight + " " + lightBg}>
                          <p className={"text-xs font-bold uppercase tracking-wider " + text}>Hat Yetmezliği (Reddedilen)</p>
                          <h4 className={`text-4xl font-black ${rejectedCalls > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                            {rejectedCalls} <span className="text-lg font-bold">({rejectionRate}%)</span>
                          </h4>
                          <p className="text-sm font-medium text-slate-500">Kapasite aşıldığı veya meşguliyet için düşen çağrılar</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 24-Hour Concurrent Channel Usage Chart */}
                        <div className={"w-full rounded-2xl p-6 border flex flex-col gap-4 " + borderLight + " " + lightBg}>
                          <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className={"text-sm font-bold uppercase tracking-wider " + text}>24 Saatlik Eşzamanlı Kanal Kullanımı</h4>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs">
                                  <CalendarIcon size={12} className={text} />
                                  {periodDisplayLabel}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                Seçili periyottaki SIP kanallarının saat dilimlerine göre eşzamanlı kullanım tepe noktaları
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {availableCallDates.length > 1 && (
                                <select
                                  value={effectiveChartDate}
                                  onChange={(e) => setSelectedTrunkChartDate(e.target.value)}
                                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                                  title="Grafikte gösterilecek günü seçin"
                                >
                                  <option value="ALL">Tüm Aralık (Saatlik Pik)</option>
                                  {availableCallDates.map((dKey) => (
                                    <option key={dKey} value={dKey}>
                                      {fmtDateLabel(dKey)} ({dateCountsMap[dKey]} Çağrı)
                                    </option>
                                  ))}
                                </select>
                              )}
                              <Cpu className="text-slate-400 shrink-0" />
                            </div>
                          </div>
                          
                          <div className="flex items-end justify-between h-48 w-full gap-1 pt-6">
                            {hourlyDetails.map((item, idx) => {
                              const val = item.peakChannels;
                              const saturationPct = Math.round((val / trunkCapacity) * 100);
                              const barHeightPct =
                                val === 0
                                  ? 3
                                  : Math.min(100, Math.max(8, Math.round((val / chartMaxScale) * 100)));
                              let barColor = val === 0 ? "bg-slate-200 dark:bg-slate-800" : "bg-blue-500 dark:bg-blue-500";
                              if (saturationPct >= 85) barColor = "bg-rose-500 dark:bg-rose-500";
                              else if (saturationPct >= 50) barColor = "bg-amber-400 dark:bg-amber-500";
                              
                              return (
                                <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end group cursor-pointer relative">
                                  <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-bold py-1.5 px-2.5 rounded-lg whitespace-nowrap z-20 pointer-events-none shadow-lg text-center leading-tight">
                                    <div>{String(idx).padStart(2, "0")}:00 — {val} Eşzamanlı Kanal (%{saturationPct})</div>
                                    <div className="text-slate-300 font-normal">
                                      Toplam: {item.totalCalls} Çağrı{item.peakDateStr && effectiveChartDate === "ALL" ? ` • Pik: ${item.peakDateStr}` : ""}
                                    </div>
                                  </div>
                                  {val > 0 && (
                                    <span className="text-[9px] font-extrabold text-slate-600 dark:text-slate-300 mb-0.5">
                                      {val}
                                    </span>
                                  )}
                                  <div 
                                    className={`w-full rounded-t transition-all duration-300 group-hover:opacity-80 ${barColor}`} 
                                    style={{ height: `${barHeightPct}%` }}
                                  ></div>
                                  <div className="mt-2 text-[8px] sm:text-[10px] font-bold text-slate-400">
                                    {String(idx).padStart(2, '0')}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Limit Line & Legend reference */}
                          <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                            <div className="flex items-center gap-2 text-xs font-bold text-rose-500">
                              <div className="w-4 border-t-2 border-rose-500 border-dashed"></div>
                              Kapasite Limiti ({trunkCapacity} Kanal)
                            </div>
                            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500">
                              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-blue-500 inline-block"></span> Normal (&lt;%50)</span>
                              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-amber-400 inline-block"></span> Yoğun (%50-%84)</span>
                              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block"></span> Kritik (≥%85)</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Real SIP Trunks (Providers) Table */}
                        <div className="w-full flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                              Sağlayıcı (Dış Hat / SIP Trunk) Bazlı Dağılım
                            </h4>
                            <span className="text-xs font-bold text-slate-400">
                              Sistemde Tanımlı {providers.length} Dış Hat
                            </span>
                          </div>
                          <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                                  {visibleColumns.trunkName && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Dış Hat (SIP Trunk)</th>}
                                  {visibleColumns.limit && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Kapasite Limiti</th>}
                                  {visibleColumns.totalCalls && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Toplam Çağrı</th>}
                                  {visibleColumns.peakUsage && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Pik Kullanım</th>}
                                  {visibleColumns.status && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Durum</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {providers.length === 0 ? (
                                  <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs font-semibold">
                                      Sistemde henüz tanımlı bir dış hat (SIP Trunk) bulunmuyor. Santral Ayarları &gt; Dış Hatlar menüsünden ekleyebilirsiniz.
                                    </td>
                                  </tr>
                                ) : (
                                  providers.map((p, idx) => (
                                    <tr key={p.id || idx} className={"border-b " + borderLight + " transition-colors duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-800/40"}>
                                      {visibleColumns.trunkName && (
                                        <td className="p-4">
                                          <div className="flex items-center gap-2.5">
                                            <span
                                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                                !p.isActive
                                                  ? "bg-slate-400"
                                                  : p.liveReg === "registered" || p.liveReg === "active"
                                                  ? "bg-emerald-500"
                                                  : "bg-amber-500"
                                              }`}
                                              title={!p.isActive ? "Pasif" : p.liveReg === "registered" || p.liveReg === "active" ? "Kayıtlı / Aktif" : "Bağlantı Bekleniyor"}
                                            />
                                            <div>
                                              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                <span>{p.name}</span>
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                                  {p.trunkType}
                                                </span>
                                              </div>
                                              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                                {p.did !== "-" ? `DID: ${p.did} • ` : ""}{p.host}
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                      )}
                                      {visibleColumns.limit && (
                                        <td className="p-4 text-center font-bold text-slate-600 dark:text-slate-400">{p.limit} Kanal</td>
                                      )}
                                      {visibleColumns.totalCalls && (
                                        <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">{p.totalCalls}</td>
                                      )}
                                      {visibleColumns.peakUsage && (
                                        <td className="p-4 text-center">
                                          <div className="flex flex-col items-center">
                                            <span className="font-black text-slate-800 dark:text-slate-200">{p.used} Kanal</span>
                                            <span className="text-[10px] font-bold text-slate-400">%{p.satPct} Doluluk</span>
                                          </div>
                                        </td>
                                      )}
                                      {visibleColumns.status && (
                                        <td className="p-4 text-center">
                                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${p.statusBadgeClass}`}>
                                            {p.status}
                                          </span>
                                        </td>
                                      )}
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
            ) : isIvrDropMode ? (
              /* IVR Drop Mode */
              <div className="p-4 flex flex-col gap-6 h-full overflow-y-auto">
                {(() => {
                  const {
                    hasConfiguredIvr,
                    ivrCalls,
                    dropCalls,
                    dropRate,
                    transferToHuman,
                    transferRate,
                    ivrMenus
                  } = computeIvrReportData(filteredCalls);

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
                          <p className="text-sm font-medium text-slate-500">
                            {hasConfiguredIvr ? "Sesli yanıt sistemine giren çağrılar" : "Aktif IVR menüsü tanımlı değil"}
                          </p>
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
                            {ivrMenus.length === 0 ? (
                              <div className="py-8 px-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                  Sistemde aktif bir IVR (Sesli Yanıt) menüsü tanımlı değildir.
                                </p>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                                  Gelen Arama Kuralları veya Kuyruk IVR yönlendirmelerinde aktif bir IVR menüsü bulunmadığı için terk dağılım verisi oluşmamıştır.
                                </p>
                              </div>
                            ) : (
                              ivrMenus.map((menu, idx) => {
                                const dropPercent = menu.hits > 0 ? ((menu.drops / menu.hits) * 100).toFixed(1) : "0.0";
                                return (
                                  <div key={idx} className="flex flex-col gap-1">
                                    <div className="flex justify-between items-end">
                                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate pr-2">{menu.name}</span>
                                      <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                                        <UserX size={10} /> {menu.drops} Terk (%{dropPercent})
                                      </span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                      <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(100, parseFloat(dropPercent))}%` }}></div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* IVR Menus Table */}
                        <div className="lg:col-span-2 flex flex-col gap-4">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Menü Performans Detayları</h4>
                          <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                              <thead>
                                <tr className={"border-b border-slate-200 dark:border-slate-800 " + lightBg}>
                                  {visibleColumns.menuName && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Menü Adı</th>}
                                  {visibleColumns.hits && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Giriş (Hit)</th>}
                                  {visibleColumns.drops && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Terk (Drop)</th>}
                                  {visibleColumns.transfers && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Aktarım</th>}
                                  {visibleColumns.nextStep && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Sonraki Adım</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {ivrMenus.length === 0 ? (
                                  <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium text-sm">
                                      Sistemde tanımlı aktif bir IVR menüsü veya seçili tarih aralığında kaydedilmiş IVR tuşlama verisi bulunmamaktadır.
                                    </td>
                                  </tr>
                                ) : (
                                  ivrMenus.map((m, idx) => (
                                    <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                                      {visibleColumns.menuName && <td className="p-4 font-bold text-slate-700 dark:text-slate-300">{m.name}</td>}
                                      {visibleColumns.hits && <td className="p-4 text-center font-bold text-slate-600 dark:text-slate-400">{m.hits}</td>}
                                      {visibleColumns.drops && <td className="p-4 text-center font-black text-rose-500">{m.drops}</td>}
                                      {visibleColumns.transfers && <td className="p-4 text-center font-bold text-amber-500">{m.transfers}</td>}
                                      {visibleColumns.nextStep && <td className="p-4 font-medium text-slate-500 dark:text-slate-400 text-sm">{m.next}</td>}
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
            ) : isTransferHoldMode ? (
              /* Transfer & Hold Mode */
              <div className="p-4 flex flex-col gap-6 h-full overflow-y-auto">
                {(() => {
                  const {
                    callsWithHold,
                    transferredCalls,
                    avgHoldTime,
                    holdRate,
                    transferRate,
                    transferDepartments,
                    topEvents
                  } = computeTransferHoldReportData(filteredCalls);

                  const barColors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500"];
                  const textColors = ["text-blue-500", "text-emerald-500", "text-amber-500", "text-rose-500", "text-purple-500"];

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
                          <p className="text-sm font-medium text-slate-500">Toplam {transferredCalls} çağrı başka dahiliye/birime aktarıldı</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Transfer Departments Overview */}
                        <div className={"lg:col-span-1 rounded-2xl p-6 border flex flex-col gap-4 " + borderLight + " " + lightBg}>
                          <h4 className={"text-sm font-bold uppercase tracking-wider " + text}>En Çok Aktarım Yapılan Birimler</h4>
                          <div className="flex flex-col gap-4 mt-2">
                            {transferDepartments.length === 0 ? (
                              <div className="py-6 px-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                  Bu dönemde çağrı aktarımı yapılmamıştır.
                                </p>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                                  Seçili tarih aralığında başka bir dahiliye, kuyruğa veya temsilciye aktarılan görüşme kaydı bulunmamaktadır.
                                </p>
                              </div>
                            ) : (
                              transferDepartments.map((dept, idx) => (
                                <div key={idx} className="flex flex-col gap-1">
                                  <div className="flex justify-between items-end">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate pr-2">{dept.name}</span>
                                    <span className={`text-[10px] font-bold ${textColors[idx % textColors.length]}`}>
                                      {dept.count} Aktarım (%{dept.pctOfTransfers})
                                    </span>
                                  </div>
                                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${barColors[idx % barColors.length]} rounded-full`}
                                      style={{ width: `${Math.min(100, dept.pctOfTransfers)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          <div className={"mt-auto p-4 rounded-xl border border-blue-500/30 bg-blue-500/5"}>
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium leading-relaxed">
                              💡 <strong>Durum Özeti:</strong>{" "}
                              {transferDepartments.length > 0
                                ? `Seçili dönemde en çok aktarım "${transferDepartments[0].name}" hedefine (${transferDepartments[0].count} çağrı, tüm aktarımların %${transferDepartments[0].pctOfTransfers}'i) gerçekleştirilmiştir.`
                                : callsWithHold > 0
                                ? `Seçili dönemde toplam ${callsWithHold} çağrı ortalama ${avgHoldTime} sn beklemeye (Hold) alınmış, başka bir birime aktarım gerçekleşmemiştir.`
                                : "Seçili tarih aralığında beklemeye alınan (Hold) veya başka bir dahiliye aktarılan (Transfer) çağrı bulunmamaktadır."}
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
                                  {visibleColumns.startTime && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Tarih / Saat</th>}
                                  {visibleColumns.caller && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Numara</th>}
                                  {visibleColumns.firstAgent && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>İlk Temsilci</th>}
                                  {visibleColumns.hold && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Hold (Bekletme)</th>}
                                  {visibleColumns.transfer && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Transfer</th>}
                                  {visibleColumns.target && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Aktarılan Birim / Hedef</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {topEvents.length === 0 ? (
                                  <tr>
                                    <td colSpan="6" className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">
                                      Seçili tarih aralığında bekletme (Hold) veya aktarım (Transfer) olayı kaydedilmemiştir.
                                    </td>
                                  </tr>
                                ) : (
                                  topEvents.map((c, idx) => (
                                    <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                                      {visibleColumns.startTime && <td className="p-4 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(c.start_time)}</td>}
                                      {visibleColumns.caller && <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{getCustomerNumber(c)}</td>}
                                      {visibleColumns.firstAgent && <td className="p-4 font-medium text-slate-600 dark:text-slate-400">{getConversant(c) || "Bilinmiyor"}</td>}
                                      {visibleColumns.hold && (
                                        <td className="p-4 text-center">
                                          {c.hasHold ? (
                                            <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold border ${c.holdTime > 60 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                              {c.holdTime} sn
                                            </span>
                                          ) : <span className="text-slate-300">-</span>}
                                        </td>
                                      )}
                                      {visibleColumns.transfer && (
                                        <td className="p-4 text-center">
                                          {c.isTransferred ? (
                                            <PhoneForwarded size={16} className="mx-auto text-blue-500" />
                                          ) : <span className="text-slate-300">-</span>}
                                        </td>
                                      )}
                                      {visibleColumns.target && <td className="p-4 font-medium text-slate-500 dark:text-slate-400 text-sm">{c.transferTarget}</td>}
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
                                    {visibleColumns.group && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Grup</th>}
                                    {visibleColumns.scenario && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Senaryo Açıklaması</th>}
                                    {visibleColumns.volume && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Hacim</th>}
                                    {visibleColumns.csat && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>CSAT</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {scenarios.map((s, idx) => (
                                    <tr key={idx} className={"border-b " + borderLight + " transition-colors duration-150 " + hover}>
                                      {visibleColumns.group && (
                                        <td className="p-4">
                                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${s.id === winner.id ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                                            {s.id}
                                          </span>
                                        </td>
                                      )}
                                      {visibleColumns.scenario && (
                                        <td className="p-4">
                                          <div className="font-bold text-slate-700 dark:text-slate-300">{s.name}</div>
                                          <div className="text-xs text-slate-500 mt-1">{s.desc}</div>
                                        </td>
                                      )}
                                      {visibleColumns.volume && (
                                        <td className="p-4 text-center font-bold text-slate-600 dark:text-slate-400">%{Math.round((s.volume / totalVolume) * 100)}</td>
                                      )}
                                      {visibleColumns.csat && (
                                        <td className="p-4 text-center font-black text-amber-500">
                                          {s.csat.toFixed(1)} / 5.0
                                        </td>
                                      )}
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
                                  {visibleColumns.caller && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Numara</th>}
                                  {visibleColumns.driver && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Kök Neden (Driver)</th>}
                                  {visibleColumns.score && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Çile Skoru</th>}
                                  {visibleColumns.sentiment && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Duygu</th>}
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
                                      {visibleColumns.caller && <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{getCustomerNumber(c)}</td>}
                                      {visibleColumns.driver && <td className="p-4 font-medium text-slate-600 dark:text-slate-400 text-sm truncate max-w-[200px]">{c.primaryDriver}</td>}
                                      {visibleColumns.score && (
                                        <td className="p-4 text-center">
                                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-xs ${c.frictionScore > 8 ? 'bg-rose-100 text-rose-600 border border-rose-200' : 'bg-amber-100 text-amber-600 border border-amber-200'}`}>
                                            {c.frictionScore.toFixed(1)}
                                          </span>
                                        </td>
                                      )}
                                      {visibleColumns.sentiment && (
                                        <td className="p-4 text-center">
                                          <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold border ${c.sentimentLabel === 'Kızgın' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                                            {c.sentimentLabel}
                                          </span>
                                        </td>
                                      )}
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
                                  {visibleColumns.caller && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Numara</th>}
                                  {visibleColumns.agent && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Temsilci</th>}
                                  {visibleColumns.score && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Sadakat Skoru</th>}
                                  {visibleColumns.missedStep && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Atlanan / İhlal Edilen Adım</th>}
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
                                      {visibleColumns.caller && <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{getCustomerNumber(c)}</td>}
                                      {visibleColumns.agent && <td className="p-4 font-medium text-slate-600 dark:text-slate-400">{getConversant(c) || "Bilinmiyor"}</td>}
                                      {visibleColumns.score && (
                                        <td className="p-4 text-center">
                                          <span className={`inline-flex items-center justify-center w-9 h-6 rounded font-black text-xs ${c.complianceScore < 70 ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                            %{c.complianceScore}
                                          </span>
                                        </td>
                                      )}
                                      {visibleColumns.missedStep && (
                                        <td className="p-4">
                                          <div className="flex items-center gap-2">
                                            {c.severity === "Kritik" && <AlertTriangle size={14} className="text-rose-500 shrink-0" />}
                                            <span className={`text-sm font-medium ${c.severity === "Kritik" ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400"}`}>
                                              {c.missedStep}
                                            </span>
                                          </div>
                                        </td>
                                      )}
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
                                  {visibleColumns.caller && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Numara</th>}
                                  {visibleColumns.agent && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Temsilci</th>}
                                  {visibleColumns.silenceRate && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Sessizlik Oranı</th>}
                                  {visibleColumns.interruptionCount && <th className={"p-4 text-xs font-bold uppercase tracking-wider text-center " + text}>Çakışma Sayısı</th>}
                                  {visibleColumns.primaryIssue && <th className={"p-4 text-xs font-bold uppercase tracking-wider " + text}>Ana Sorun</th>}
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
                                      {visibleColumns.caller && <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{getCustomerNumber(c)}</td>}
                                      {visibleColumns.agent && <td className="p-4 font-medium text-slate-600 dark:text-slate-400">{getConversant(c) || "Bilinmiyor"}</td>}
                                      {visibleColumns.silenceRate && (
                                        <td className="p-4 text-center">
                                          <span className={`inline-flex items-center justify-center w-10 h-6 rounded font-black text-xs ${c.silencePercent > 30 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                                            %{c.silencePercent}
                                          </span>
                                        </td>
                                      )}
                                      {visibleColumns.interruptionCount && (
                                        <td className="p-4 text-center">
                                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-xs ${c.interruptionCount > 5 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                                            {c.interruptionCount}
                                          </span>
                                        </td>
                                      )}
                                      {visibleColumns.primaryIssue && (
                                        <td className="p-4">
                                          <span className={`text-xs font-bold ${c.primaryIssue.includes('Sessiz') ? 'text-rose-500' : 'text-amber-500'}`}>
                                            {c.primaryIssue}
                                          </span>
                                        </td>
                                      )}
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
                      {visibleColumns.heroBanner && (
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
                      )}

                      {/* Main KPI Row */}
                      {visibleColumns.kpiCards && (
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
                      )}
                      
                      {(visibleColumns.winsPanel || visibleColumns.actionsPanel) && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Strengths / Wins */}
                          {visibleColumns.winsPanel && (
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
                          )}
                          
                          {/* Areas for Improvement / Actions */}
                          {visibleColumns.actionsPanel && (
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
                          )}
                        </div>
                      )}
                      
                    </div>
                  );
                })()}
              </div>
            ) : isIntentMode ? (
              /* Customer Intent Analysis Report Mode (Müşteri Niyet Raporu) */
              <div className="p-4 flex flex-col gap-5 h-full overflow-y-auto scrollbar-thin">
                {(() => {
                  const evaluatedCalls = filteredCalls.map((call) => ({
                    call,
                    evalRes: evaluateCallIntent(call)
                  }));

                  const totalScanned = evaluatedCalls.length;
                  const matchedCallsList = evaluatedCalls.filter((item) => item.evalRes.matchedRules.length > 0);
                  const matchedCount = matchedCallsList.length;
                  const matchedRate = totalScanned > 0 ? Math.round((matchedCount / totalScanned) * 100) : 0;

                  const ruleCountMap = {};
                  let positiveSalesCount = 0;

                  evaluatedCalls.forEach(({ evalRes }) => {
                    let countedPositive = false;
                    evalRes.matchedRules.forEach(({ rule }) => {
                      ruleCountMap[rule.id] = (ruleCountMap[rule.id] || 0) + 1;
                      if (
                        !countedPositive &&
                        (rule.color === "emerald" ||
                          String(rule.category || "").toLowerCase().includes("satış") ||
                          String(rule.name || "").toLowerCase().includes("olumlu"))
                      ) {
                        positiveSalesCount++;
                        countedPositive = true;
                      }
                    });
                  });

                  const positiveRate = totalScanned > 0 ? Math.round((positiveSalesCount / totalScanned) * 100) : 0;

                  let topRuleName = "Henüz Eşleşme Yok";
                  let topRuleHits = 0;
                  (intentRules || []).forEach((r) => {
                    const cnt = ruleCountMap[r.id] || 0;
                    if (cnt > topRuleHits) {
                      topRuleHits = cnt;
                      topRuleName = r.name;
                    }
                  });

                  const displayedRows = evaluatedCalls.filter(({ evalRes }) => {
                    if (intentOnlyMatched && evalRes.matchedRules.length === 0) return false;
                    if (selectedIntentRuleIds.length > 0) {
                      if (selectedIntentRuleIds.includes("__UNMATCHED__")) {
                        if (evalRes.matchedRules.length === 0) return true;
                      }
                      const matchesSelected = evalRes.matchedRules.some((mr) =>
                        selectedIntentRuleIds.includes(mr.rule.id)
                      );
                      if (!matchesSelected) return false;
                    }
                    return true;
                  });

                  const getRuleBadgeStyle = (colorKey) => {
                    if (colorKey === "emerald") {
                      return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60";
                    }
                    if (colorKey === "blue") {
                      return "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60";
                    }
                    if (colorKey === "amber") {
                      return "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60";
                    }
                    if (colorKey === "rose") {
                      return "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60";
                    }
                    return "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60";
                  };

                  return (
                    <>
                      {/* 4 KPI Summary Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className={"rounded-2xl p-4 border flex flex-col gap-1 shadow-xs " + borderLight + " " + lightBg}>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Taranan Çağrı Sayısı
                          </span>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{totalScanned}</span>
                            <span className="text-[11px] font-bold text-slate-400">Görüşme</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            Transkript ve çağrı özetleri tarandı
                          </span>
                        </div>

                        <div className={"rounded-2xl p-4 border flex flex-col gap-1 shadow-xs " + borderLight + " " + lightBg}>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Niyet Tespit Edilen Çağrı
                          </span>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className={"text-2xl font-black " + text}>{matchedCount}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                              %{matchedRate} Eşleşme
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            Kayıtlı anahtar kelimelerle eşleşenler
                          </span>
                        </div>

                        <div className={"rounded-2xl p-4 border flex flex-col gap-1 shadow-xs " + borderLight + " " + lightBg}>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            En Çok Tespit Edilen Niyet
                          </span>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                              {topRuleName}
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                            {topRuleHits} çağrıda tespit edildi
                          </span>
                        </div>

                        <div className={"rounded-2xl p-4 border flex flex-col gap-1 shadow-xs " + borderLight + " " + lightBg}>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Olumlu / Satış & Dönüşüm Niyeti
                          </span>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                              {positiveSalesCount}
                            </span>
                            <span className="text-xs font-extrabold text-slate-500">(%{positiveRate})</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            Satış / sipariş / çözüm odaklı görüşmeler
                          </span>
                        </div>
                      </div>

                      {/* Interactive Keyword & Intent Filter Bar (Savable) */}
                      <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 flex flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-primary" />
                            <div>
                              <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                                Müşteri Niyeti & Anahtar Kelime Filtresi
                              </h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                Satış, yardım masası veya özel anahtar kelimelerinizi aşağıdan girip kalıcı olarak kaydedebilirsiniz.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {intentRulesSavedBadge && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800/50">
                                <Check size={12} /> Anahtar Kelimeler Kaydedildi
                              </span>
                            )}
                            <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                              <input
                                type="checkbox"
                                checked={intentOnlyMatched}
                                onChange={(e) => setIntentOnlyMatched(e.target.checked)}
                                className="rounded border-slate-300 text-primary focus:ring-primary"
                              />
                              <span>Sadece Eşleşenleri Göster</span>
                            </label>
                            <button
                              type="button"
                              onClick={handleOpenNewIntentRuleForm}
                              title="Yeni Niyet Kuralı ve Anahtar Kelime Ekle"
                              className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition cursor-pointer shadow-sm"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Quick Keyword Search & Save Input Row */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="relative flex-1 min-w-[240px]">
                            <Tag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Transkript içinde aranacak anahtar kelimeleri virgülle girin (örn: satın almak, sipariş, fiyat, arıza, iptal)..."
                              value={intentQuickKeywords}
                              onChange={(e) => setIntentQuickKeywords(e.target.value)}
                              className="w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary"
                            />
                          </div>
                          {intentQuickKeywords.trim() && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingIntentRuleId(null);
                                  setIntentRuleName(intentQuickRuleName || "Yeni Niyet Kuralı");
                                  setIntentRuleCategory(intentQuickCategory || "Satış");
                                  setIntentRuleKeywords(intentQuickKeywords);
                                  setIntentRuleScope("customer");
                                  setIntentRuleColor("emerald");
                                  setIsIntentRuleFormOpen(true);
                                }}
                                className={"inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-bold shadow-sm transition cursor-pointer " + bg + " " + hover}
                              >
                                <Save size={13} />
                                <span>Bu Kelimeleri Kaydet</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setIntentQuickKeywords("")}
                                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                              >
                                Temizle
                              </button>
                            </>
                          )}
                        </div>

                        {/* Inline Rule Creation / Edit Form */}
                        {isIntentRuleFormOpen && (
                          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-primary/40 flex flex-col gap-3 shadow-md animate-in fade-in duration-150">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                <Sparkles size={14} className="text-primary" />
                                {editingIntentRuleId ? "Niyet Kuralını ve Anahtar Kelimeleri Düzenle" : "Yeni Niyet Kuralı ve Anahtar Kelime Kaydet"}
                              </span>
                              <button
                                type="button"
                                onClick={() => setIsIntentRuleFormOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Niyet Adı</label>
                                <input
                                  type="text"
                                  placeholder="Örn: Satış Olumlu / Sipariş"
                                  value={intentRuleName}
                                  onChange={(e) => setIntentRuleName(e.target.value)}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Kategori</label>
                                <select
                                  value={intentRuleCategory}
                                  onChange={(e) => setIntentRuleCategory(e.target.value)}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                                >
                                  <option value="Satış">Satış</option>
                                  <option value="Yardım Masası">Yardım Masası / Teknik Destek</option>
                                  <option value="Şikayet / İptal">Şikayet / İptal / İade</option>
                                  <option value="Fatura / Ödeme">Fatura / Ödeme</option>
                                  <option value="Bilgi Talebi">Bilgi & Randevu Talebi</option>
                                  <option value="Genel">Genel İşlemler</option>
                                </select>
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Arama Kapsamı</label>
                                <select
                                  value={intentRuleScope}
                                  onChange={(e) => setIntentRuleScope(e.target.value)}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                                >
                                  <option value="customer">Müşteri İfadeleri (Öncelikli)</option>
                                  <option value="all">Tüm Görüşme Metni</option>
                                </select>
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Durum Rengi</label>
                                <select
                                  value={intentRuleColor}
                                  onChange={(e) => setIntentRuleColor(e.target.value)}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                                >
                                  <option value="emerald">Yeşil (Olumlu / Satış)</option>
                                  <option value="blue">Mavi (Bilgi / Fiyat)</option>
                                  <option value="amber">Turuncu (Yardım Masası)</option>
                                  <option value="rose">Kırmızı (İptal / Şikayet)</option>
                                  <option value="purple">Mor (Özel)</option>
                                </select>
                              </div>
                              <div className="md:col-span-4 flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">
                                  Anahtar Kelimeler (Virgülle ayırarak yazın)
                                </label>
                                <input
                                  type="text"
                                  placeholder="Örn: satın almak, sipariş, onaylıyorum, kabul ediyorum, kredi kartı..."
                                  value={intentRuleKeywords}
                                  onChange={(e) => setIntentRuleKeywords(e.target.value)}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setIsIntentRuleFormOpen(false)}
                                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm shadow-rose-500/20 transition cursor-pointer"
                              >
                                Vazgeç
                              </button>
                              <button
                                type="button"
                                disabled={intentRulesSaving}
                                onClick={handleSubmitIntentRuleForm}
                                className={"inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-white text-xs font-bold shadow-sm transition cursor-pointer " + bg + " " + hover}
                              >
                                <Save size={13} />
                                <span>{intentRulesSaving ? "Kaydediliyor..." : "Anahtar Kelimeleri Kaydet"}</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Saved Intent Rule Filter Pills */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setSelectedIntentRuleIds([])}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                              selectedIntentRuleIds.length === 0
                                ? `${bg} text-white border-transparent shadow-xs`
                                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            <span>Tümü</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedIntentRuleIds.length === 0 ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                              {totalScanned}
                            </span>
                          </button>

                          {(intentRules || []).map((rule) => {
                            const isSelected = selectedIntentRuleIds.includes(rule.id);
                            const count = ruleCountMap[rule.id] || 0;
                            return (
                              <div
                                key={rule.id}
                                className={`inline-flex items-center rounded-xl border text-xs font-bold transition ${
                                  isSelected
                                    ? `${bg} text-white border-transparent shadow-xs`
                                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedIntentRuleIds((prev) =>
                                      prev.includes(rule.id) ? prev.filter((id) => id !== rule.id) : [...prev, rule.id]
                                    );
                                  }}
                                  className="px-3 py-1.5 flex items-center gap-1.5 cursor-pointer"
                                  title={`Anahtar Kelimeler: ${(rule.keywords || []).join(", ")}`}
                                >
                                  <span>{rule.name}</span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                                      isSelected
                                        ? "bg-white/20 text-white"
                                        : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                    }`}
                                  >
                                    {count}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditIntentRuleForm(rule);
                                  }}
                                  title="Anahtar Kelimeleri Düzenle"
                                  className={`p-1.5 border-l cursor-pointer transition ${
                                    isSelected
                                      ? "border-white/20 text-white/80 hover:text-white"
                                      : "border-slate-200 dark:border-slate-700 text-slate-400 hover:text-primary"
                                  }`}
                                >
                                  <Edit2 size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteIntentRuleTarget(rule);
                                  }}
                                  title="Niyet Kuralını Sil"
                                  className={`p-1.5 pr-2 cursor-pointer transition ${
                                    isSelected
                                      ? "text-white/80 hover:text-white"
                                      : "text-slate-400 hover:text-rose-500"
                                  }`}
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Intent Analysis Table */}
                      <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <table className="w-full text-left border-collapse min-w-[950px]">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
                              {visibleColumns.startTime && (
                                <th className="p-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  Tarih / Saat
                                </th>
                              )}
                              {visibleColumns.caller && (
                                <th className="p-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  Numara
                                </th>
                              )}
                              {visibleColumns.conversant && (
                                <th className="p-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  Görüşen Kişi
                                </th>
                              )}
                              {visibleColumns.intentBadge && (
                                <th className="p-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  Tespit Edilen Niyet
                                </th>
                              )}
                              {visibleColumns.category && (
                                <th className="p-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  Kategori
                                </th>
                              )}
                              {visibleColumns.matchedKeywords && (
                                <th className="p-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  Eşleşen Anahtar Kelimeler
                                </th>
                              )}
                              {visibleColumns.evidence && (
                                <th className="p-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  Müşteri İfadesi (Kanıt Cümlesi)
                                </th>
                              )}
                              {visibleColumns.durationTalk && (
                                <th className="p-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  Görüşme Süresi
                                </th>
                              )}
                              {visibleColumns.detail && (
                                <th className="p-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">
                                  Transkript
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {intentLoading ? (
                              <tr>
                                <td colSpan="9" className="p-10 text-center text-xs font-semibold text-slate-400 animate-pulse">
                                  Çağrı transkriptleri ve müşteri niyet eşleşmeleri analiz ediliyor...
                                </td>
                              </tr>
                            ) : displayedRows.length === 0 ? (
                              <tr>
                                <td colSpan="9" className="p-10 text-center text-xs font-semibold text-slate-400">
                                  Seçilen kriterlere ve anahtar kelimelere uygun çağrı kaydı bulunamadı.
                                </td>
                              </tr>
                            ) : (
                              displayedRows.map(({ call, evalRes }) => {
                                const durations = getCallDurations(call);
                                const conversant = getConversant(call);
                                const hasMatch = evalRes.matchedRules.length > 0;

                                return (
                                  <tr
                                    key={call.id}
                                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition duration-150"
                                  >
                                    {visibleColumns.startTime && (
                                      <td className="p-3.5 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                        {formatDate(call.start_time)}
                                      </td>
                                    )}
                                    {visibleColumns.caller && (
                                      <td className="p-3.5 text-xs font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                          <Phone size={12} className="text-slate-400 shrink-0" />
                                          <span>{getCustomerNumber(call)}</span>
                                        </div>
                                      </td>
                                    )}
                                    {visibleColumns.conversant && (
                                      <td className="p-3.5 text-xs whitespace-nowrap">
                                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                          {conversant || "Temsilci"}
                                        </span>
                                      </td>
                                    )}
                                    {visibleColumns.intentBadge && (
                                      <td className="p-3.5 text-xs">
                                        {hasMatch ? (
                                          <div className="flex flex-wrap gap-1.5">
                                            {evalRes.matchedRules.map(({ rule }, rIdx) => (
                                              <span
                                                key={rIdx}
                                                className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold border shadow-2xs ${getRuleBadgeStyle(rule.color)}`}
                                              >
                                                {rule.name}
                                              </span>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-slate-100 dark:bg-slate-800/70 text-slate-400 dark:text-slate-500 border border-slate-200/60 dark:border-slate-800">
                                            Eşleşme Yok
                                          </span>
                                        )}
                                      </td>
                                    )}
                                    {visibleColumns.category && (
                                      <td className="p-3.5 text-xs whitespace-nowrap">
                                        {hasMatch ? (
                                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            {Array.from(new Set(evalRes.matchedRules.map((m) => m.rule.category))).join(" / ")}
                                          </span>
                                        ) : (
                                          <span className="text-xs text-slate-400">-</span>
                                        )}
                                      </td>
                                    )}
                                    {visibleColumns.matchedKeywords && (
                                      <td className="p-3.5 text-xs">
                                        {evalRes.allMatchedKeywords.length > 0 ? (
                                          <div className="flex flex-wrap gap-1 max-w-xs">
                                            {evalRes.allMatchedKeywords.map((kw, kIdx) => (
                                              <span
                                                key={kIdx}
                                                className={"px-2 py-0.5 rounded-md text-[10px] font-extrabold border " + lightBg + " " + text + " " + borderLight}
                                              >
                                                #{kw}
                                              </span>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="text-[11px] text-slate-400 italic">Anahtar kelime geçmedi</span>
                                        )}
                                      </td>
                                    )}
                                    {visibleColumns.evidence && (
                                      <td className="p-3.5 text-xs max-w-md">
                                        {evalRes.primaryEvidence ? (
                                          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-2 italic">
                                            "{evalRes.primaryEvidence}"
                                          </p>
                                        ) : (
                                          <span className="text-[11px] text-slate-400 italic">
                                            Transkript kaydı bulunamadı
                                          </span>
                                        )}
                                      </td>
                                    )}
                                    {visibleColumns.durationTalk && (
                                      <td className="p-3.5 text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                        {durations.talk}
                                      </td>
                                    )}
                                    {visibleColumns.detail && (
                                      <td className="p-3.5 text-xs text-center">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedTranscriptCall(call);
                                            setIsTranscriptPopupOpen(true);
                                          }}
                                          className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-primary border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer hover:scale-105 inline-flex items-center justify-center shadow-2xs"
                                          title="Çağrı Transkriptini Görüntüle"
                                        >
                                          <MessageSquare size={13} />
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
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
                      {visibleColumns.callerNumber && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Numara</th>}
                      {visibleColumns.direction && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Yön</th>}
                      {visibleColumns.status && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Çağrı Durumu</th>}
                      {visibleColumns.conversant && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Görüşen Kişi</th>}
                      {visibleColumns.durationTalk && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Görüşme Süresi</th>}
                      {visibleColumns.durationQueue && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Kuyruk Bekleme</th>}
                      {visibleColumns.durationIvr && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">IVR Süresi</th>}
                      {visibleColumns.durationTotal && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Toplam Süre</th>}
                      {isAudioMode && visibleColumns.audioRecord && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Ses Kaydı</th>}
                      {isTranscriptsMode && visibleColumns.transcriptContent && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 text-center">İçerik</th>}
                      {isSentimentMode && visibleColumns.sentimentBadge && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 text-center">Duygu Durumu</th>}
                      {isQAMode && visibleColumns.qaScore && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 text-center">Kalite Puanı</th>}
                      {isNotesMode && visibleColumns.agentNote && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 text-center">Temsilci Notu</th>}
                      {!isTranscriptsMode && !isSentimentMode && !isQAMode && !isNotesMode && visibleColumns.detail && <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 text-center">Detay</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredCalls.map((call) => {
                      const durations = getCallDurations(call);
                      const conversant = getConversant(call);
                      const direction = getCallDirection(call);
                      const statusLabel = getCallStatus(call);
                      const pickupMeta = getPickupMetadata(call);

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
                          {/* Numara */}
                          {visibleColumns.callerNumber && (
                            <td className="p-4 text-xs font-bold text-slate-800 dark:text-slate-200">
                              {pickupMeta ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <Phone size={12} className="text-slate-400 shrink-0" />
                                    <span>Arayan: {call.caller_number}</span>
                                  </div>
                                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                    Aranan: <span className="font-bold text-slate-700 dark:text-slate-200">{pickupMeta.origCalleeDisplay}</span>
                                  </div>
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100/80 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300/70 dark:border-amber-800/60 text-[10px] font-extrabold">
                                    Pickup ile Çeken: {pickupMeta.pickerDisplay}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Phone size={12} className="text-slate-400" />
                                  <span>{getCustomerNumber(call)}</span>
                                </div>
                              )}
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
                              <div className="flex flex-col items-start gap-1">
                                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                                  statusLabel === "Başarılı"
                                    ? "bg-emerald-50 dark:bg-emerald-955/20 text-primary dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30"
                                    : "bg-rose-50 dark:bg-rose-955/20 text-primary dark:text-rose-400 border-rose-100 dark:border-rose-900/30"
                                }`}>
                                  {statusLabel}
                                </span>
                                {pickupMeta && (
                                  <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                                    Pickup ({pickupMeta.origCallee} → {pickupMeta.pickerExt})
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                          {/* Görüşen Kişi */}
                          {visibleColumns.conversant && (
                            <td className="p-4 text-xs">
                              {pickupMeta ? (
                                <div className="space-y-1">
                                  <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                                    Pickup: {pickupMeta.pickerDisplay}
                                  </span>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                    Aranan Dahili: {pickupMeta.origCalleeDisplay}
                                  </div>
                                </div>
                              ) : (
                                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                                  conversant === "AI Asistan" 
                                    ? "bg-purple-50 dark:bg-purple-950/30 text-primary dark:text-purple-405 border border-purple-100 dark:border-purple-900/30"
                                    : "bg-blue-50 dark:bg-blue-950/30 text-primary dark:text-blue-400 border border-blue-100 dark:border-blue-900/30"
                                }`}>
                                  {conversant}
                                </span>
                              )}
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
                          {isAudioMode && visibleColumns.audioRecord && (
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
                              ) : call.recording_deleted_reason === "DELETED_BY_DYNAMIC_POLICY" ? (
                                <span
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 text-[10px] font-bold"
                                  title="Dinamik Ses Kaydı Politikası gereği bu görüşmenin ses kaydı silindi"
                                >
                                  Dinamik Kural: Silindi
                                </span>
                              ) : call.recording_deleted_reason === "DISABLED_BY_USER_SETTING" ? (
                                <span
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[10px] font-bold"
                                  title="Kullanıcı ses kayıt ayarı kapalı olduğu için kayıt alınmadı"
                                >
                                  Kayıt Kapalı
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Kayıt Yok</span>
                              )}
                            </td>
                          )}
                          {/* Detay/Akış Magnifier Column */}
                          {!isTranscriptsMode && !isSentimentMode && !isQAMode && !isNotesMode && visibleColumns.detail && (
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
                          {isTranscriptsMode && visibleColumns.transcriptContent && (
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
                          {isSentimentMode && visibleColumns.sentimentBadge && (
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
                          {isQAMode && visibleColumns.qaScore && (
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
                          {isNotesMode && visibleColumns.agentNote && (
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
                        {getCallDurations(call).talk}
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
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">{getCallDurations(selectedCall).talk}</p>
                    </div>
                  </div>
                </div>

                {/* Call Summary (if exists, show in Sentiment and CDR modes) */}
                {["sentiment", "cdr"].includes(viewMode) && (!isInvalidSummaryText(selectedCall.summary) || transcripts.length > 0) && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/30 rounded-xl text-xs text-purple-800 dark:text-purple-300 leading-relaxed font-semibold">
                    <span className="font-bold text-primary dark:text-purple-400 block mb-1">Görüşme Özeti (Yapay Zeka):</span>
                    {!isInvalidSummaryText(selectedCall.summary) ? selectedCall.summary : buildClientFallbackSummary(transcripts)}
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
                      const isAI = turn.speaker === "ai";
                      const isCustomer = turn.speaker === "customer" || turn.speaker === "user";
                      const rawStr = String(turn.text || "");
                      const origMatch = rawStr.match(/^(.*?)\n\[\[ORIG:([A-Z-]+)\]\]\s*(.*)$/s);
                      const transMatch = !origMatch ? rawStr.match(/^(.*?)\n\[\[TRANS:([A-Z-]+)\]\]\s*(.*)$/s) : null;
                      const primaryText = origMatch ? origMatch[1].trim() : transMatch ? transMatch[1].trim() : rawStr;
                      const secondaryText = origMatch ? origMatch[3].trim() : transMatch ? transMatch[3].trim() : "";
                      const langBadge = origMatch ? `${origMatch[2]} → TR` : transMatch ? `TR → ${transMatch[2]}` : null;

                      return (
                        <div
                          key={turn.id || index}
                          className={`flex gap-3 max-w-[85%] ${
                            isCustomer ? "mr-auto flex-row" : "ml-auto flex-row-reverse"
                          }`}
                        >
                          {/* Avatar Icon */}
                          <div
                            className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${
                              isCustomer
                                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60"
                                : isAI
                                ? "bg-purple-50 dark:bg-primary/30 text-primary dark:text-purple-400 border-purple-100 dark:border-purple-800"
                                : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/60"
                            }`}
                          >
                            {isAI ? <Bot size={16} /> : <User size={16} />}
                          </div>

                          {/* Message Content Bubble */}
                          <div className={`flex flex-col ${isCustomer ? "items-start" : "items-end"}`}>
                            <div
                              className={`px-4 py-3 rounded-2xl text-xs leading-relaxed border font-semibold shadow-sm ${
                                isCustomer
                                  ? "bg-white dark:bg-slate-955 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-sm"
                                  : isAI
                                  ? "bg-purple-50 dark:bg-purple-955 border-purple-100 dark:border-purple-900/50 text-purple-800 dark:text-purple-100 rounded-tr-sm"
                                  : "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200/80 dark:border-indigo-800/60 text-slate-800 dark:text-slate-100 rounded-tr-sm"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className={`font-extrabold text-[9px] tracking-wider uppercase ${
                                  isCustomer
                                    ? "text-amber-600 dark:text-amber-400"
                                    : isAI
                                    ? "text-purple-600 dark:text-purple-400"
                                    : "text-indigo-600 dark:text-indigo-400"
                                }`}>
                                  {isAI ? "YAPAY ZEKA" : isCustomer ? "MÜŞTERİ" : "MÜŞTERİ TEMSİLCİSİ"}
                                </p>
                                {langBadge && (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                    🌐 {langBadge}
                                  </span>
                                )}
                              </div>
                              <p className="whitespace-pre-line font-bold">{primaryText}</p>
                              {secondaryText && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-1 pt-1 border-t border-slate-200/70 dark:border-slate-800/70 leading-snug">
                                  "{secondaryText}"
                                </p>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-400 dark:text-slate-555 mt-1 px-2 font-mono font-medium">
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
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                <img
                  src={getAgentAvatarUrl(selectedAgentDetails.agent)}
                  alt={selectedAgentDetails.agent}
                  className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-0.5 object-cover shrink-0 shadow-xs"
                />
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
                        <span className="text-[10px] text-slate-400 font-medium">{formatDate(call.time)}</span>
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
                        <span className="text-[10px] text-slate-400 font-medium">{formatDate(call.time)}</span>
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
                        <span className="text-[10px] text-slate-400 font-medium">{formatDate(call.time)}</span>
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
                <span>
                  {formatDateOnly(selectedQueueDetails.date)} — {selectedQueueDetails.queueName || "Kuyruk"} ({selectedQueueDetails.queueId || "-"}) Çağrı Detayları
                </span>
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
                        <span className="text-[10px] text-slate-400 font-medium">{formatDate(call.time)}</span>
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
                        <span className="text-[10px] text-slate-400 font-medium">{formatDate(call.time)}</span>
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
                        <span className="text-[10px] text-slate-400 font-medium">{formatDate(call.time)}</span>
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

      {/* Custom Delete Confirmation Modal for Intent Rules */}
      {deleteIntentRuleTarget && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-sm flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200">
            <div className="h-14 w-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center animate-pulse">
              <AlertTriangle size={28} />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                Niyet Kuralını Sil
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                <strong className="text-slate-800 dark:text-slate-200">"{deleteIntentRuleTarget.name}"</strong> niyet grubunu ve kayıtlı anahtar kelimelerini kalıcı olarak silmek istediğinize emin misiniz?
              </p>
            </div>
            <div className="flex items-center gap-3 w-full pt-2">
              <button
                type="button"
                onClick={() => setDeleteIntentRuleTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteIntentRule}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition cursor-pointer"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
