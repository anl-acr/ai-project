import React, { useState, useEffect, useRef } from "react";
import { X, Settings, Volume2, Users, ChevronRight, ChevronLeft, Check, Search, PhoneCall, Music, AlertCircle, AlertTriangle, PhoneForwarded, Bot, Shield, Clock, Shuffle, Repeat, BarChart2, HelpCircle, Star, Plus, Trash2, Play, Square, Sparkles, RefreshCw } from "lucide-react";
import { createPortal } from "react-dom";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";
import { tenantFetch } from "../../utils/apiHost";

const DEFAULT_SURVEY_QUESTION = {
  id: "q_1",
  title: "1. Soru (Genel Memnuniyet)",
  question_text: "Görüşmemizi değerlendirmek için lütfen 1 ile 5 arasında bir puan tuşlayınız.",
  announcement_id: "",
  voice: "tr-TR-EmelNeural",
  mode: "tts"
};

export default function QueueEditModal({ isOpen, onClose, onSave, queueData = null, allQueues = [], API_BASE }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  
  const [activeTab, setActiveTab] = useState("general");
  const [memberView, setMemberView] = useState("agents"); // 'agents' or 'supervisors'
  const [error, setError] = useState(null);

  // Survey TTS & Multi-Question States
  const [generatingTtsKey, setGeneratingTtsKey] = useState(null);
  const [ttsSuccessKey, setTtsSuccessKey] = useState(null);
  const [playingAudioKey, setPlayingAudioKey] = useState(null);
  const [deleteQuestionIdx, setDeleteQuestionIdx] = useState(null);
  const [thankYouMode, setThankYouMode] = useState("tts");
  const surveyAudioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (surveyAudioRef.current) {
        surveyAudioRef.current.pause();
        surveyAudioRef.current = null;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    setError(null);
  }, [isOpen, queueData]);

  // Dropdown strategies
  const strategies = [
    { value: "ringall", label: "Tümünü Çaldır (Ringall)" },
    { value: "leastrecent", label: "En Son Çağrı Alan (Least Recent)" },
    { value: "fewestcalls", label: "En Az Çağrı Yanıtlayan (Fewest Calls)" },
    { value: "random", label: "Rastgele (Random)" },
    { value: "rrmemory", label: "Sıralı Hafızalı (RR Memory)" }
  ];
  const holdMusicClasses = ["default", "classical", "pop", "custom_holiday"];
  
  const [announcementsList, setAnnouncementsList] = useState([]);
  const [aiAgentsList, setAiAgentsList] = useState([]);
  const [callFlowsList, setCallFlowsList] = useState([]);
  const [trunksList, setTrunksList] = useState([]);
  const [searchTargetQuery, setSearchTargetQuery] = useState("");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [newDispositionCode, setNewDispositionCode] = useState("");

  const DEFAULT_DISPOSITION_CODES = [
    "Satış Yapıldı",
    "Bilgi Verildi",
    "Tekrar Aranacak",
    "Teknik Destek",
    "İptal / Şikayet"
  ];

  // State: Form Data
  const [formData, setFormData] = useState({
    extension: "",
    name: "",
    strategy: "ringall",
    max_calls: 0,
    ring_time: 15,
    acw_time: 5,
    max_concurrent_breaks: 0,
    disposition_codes: DEFAULT_DISPOSITION_CODES,
    
    // State: Announcements
    join_announcement_enabled: false,
    join_announcement: "",
    periodic_announcement_enabled: false,
    periodic_announcement: "",
    hold_music_class: "default",
    position_announcement_enabled: false,
    position_announcement_interval: 60,
    estimated_hold_time_enabled: false,
    estimated_hold_time_interval: 60,

    // Max Wait Time Fallback Routing
    max_wait_time_enabled: false,
    max_wait_time: 120,
    max_wait_destination_type: "",
    max_wait_destination_target: "",

    // State: IVR Routing
    ivr_routes: {
      "1": { type: "", target: "" },
      "2": { type: "", target: "" },
      "3": { type: "", target: "" },
      "4": { type: "", target: "" },
      "5": { type: "", target: "" },
      "6": { type: "", target: "" },
      "7": { type: "", target: "" },
      "8": { type: "", target: "" },
      "9": { type: "", target: "" },
      "0": { type: "", target: "" },
      "*": { type: "", target: "" },
      "#": { type: "", target: "" }
    },

    // All Busy Fallback Routing
    all_busy_routing_enabled: false,
    all_busy_destination_type: "",
    all_busy_destination_target: "",

    notify_missed_calls: false,

    // Per-Queue Smart Callback (Otomatik Geri Arama)
    smart_callback_enabled: false,
    smart_callback_max_wait_seconds: 60,
    smart_callback_queue_threshold: 3,
    smart_callback_max_retries: 3,
    smart_callback_retry_interval: 60,
    smart_callback_priority_level: "high",
    smart_callback_outbound_trunk_id: 1,
    smart_callback_missed_call_auto: true,

    // Per-Queue Post-Call Satisfaction Survey (Memnuniyet Anketi)
    survey_enabled: false,
    survey_scale: "1-5",
    survey_question_announcement: "",
    survey_thank_you_announcement: "",
    survey_thank_you_text: "Değerlendirmeniz için teşekkür eder, iyi günler dileriz.",
    survey_thank_you_voice: "tr-TR-EmelNeural",
    survey_questions: [{ ...DEFAULT_SURVEY_QUESTION }],
    survey_timeout_sec: 10,
    survey_low_score_threshold: 2,

    // Per-Queue Automatic Break (Otomatik Mola / RONA & Bağlantı Kopma)
    auto_pause_missed_enabled: false,
    auto_pause_missed_count: 1,
    auto_pause_disconnect_enabled: false,
    auto_pause_disconnect_grace_sec: 15,
    auto_pause_reconnect_mode: "manual",
    auto_pause_notify_user: true,
    auto_pause_notify_channels: "both"
  });

  // State for Members & Supervisors
  const [allUsers, setAllUsers] = useState([]);
  const [subscriberGroupsList, setSubscriberGroupsList] = useState([]);
  const [queueMembers, setQueueMembers] = useState([]); // { user_id, type: 'dynamic' | 'static', priority: 1, is_ai: boolean }
  const [supervisors, setSupervisors] = useState([]);
  const [systemRoles, setSystemRoles] = useState([]);

  useEffect(() => {
    if (isOpen) {
      // Fetch users
      const fetchUsers = async () => {
        try {
          const res = await tenantFetch(`${API_BASE}/api/settings/users`);
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data?.users || []);
            setAllUsers(list);
          }
        } catch (err) {
          console.error("Users fetch error:", err);
        }
      };
      fetchUsers();

      // Fetch Subscriber Groups
      const fetchSubscriberGroups = async () => {
        try {
          const res = await tenantFetch(`${API_BASE}/api/settings/subscriber_groups`);
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data?.subscriber_groups || []);
            setSubscriberGroupsList(list);
          }
        } catch (err) {
          console.error("Subscriber groups fetch error:", err);
        }
      };
      fetchSubscriberGroups();

      // Fetch AI Agents
      const fetchAiAgents = async () => {
        try {
          const res = await tenantFetch(`${API_BASE}/api/settings/ai-agents`);
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data?.agents || []);
            setAiAgentsList(list);
          }
        } catch (err) {
          console.error("AI agents fetch error:", err);
        }
      };
      fetchAiAgents();

      // Fetch Call Flows / Workflows
      const fetchCallFlows = async () => {
        try {
          const res = await tenantFetch(`${API_BASE}/api/settings/call-flow/workflows`);
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data?.workflows || []);
            setCallFlowsList(list);
          }
        } catch (err) {
          console.error("Call flows fetch error:", err);
        }
      };
      fetchCallFlows();

      // System roles
      setSystemRoles([
        { role_code: "admin", role_name: "Sistem Yöneticisi" },
        { role_code: "supervisor", role_name: "Takım Lideri" },
        { role_code: "agent", role_name: "Müşteri Temsilcisi" },
      ]);

      // Fetch announcements
      const fetchAnnouncements = async () => {
        try {
          const res = await tenantFetch(`${API_BASE}/api/settings/announcements`);
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data?.announcements || []);
            setAnnouncementsList(list);
          }
        } catch (err) {
          console.error("Announcements fetch error:", err);
        }
      };
      fetchAnnouncements();

      // Fetch Trunks for Outbound Smart Callback
      const fetchTrunks = async () => {
        try {
          const res = await tenantFetch(`${API_BASE}/api/settings/trunks`);
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data?.trunks || []);
            setTrunksList(list);
          }
        } catch (err) {
          console.error("Trunks fetch error:", err);
        }
      };
      fetchTrunks();

      if (queueData) {
        const existingQuestions =
          Array.isArray(queueData.survey_questions) && queueData.survey_questions.length > 0
            ? queueData.survey_questions.map((q, idx) => ({
                id: q.id || `q_${idx + 1}`,
                title: q.title || `${idx + 1}. Soru`,
                question_text:
                  q.question_text ||
                  "Görüşmemizi değerlendirmek için lütfen 1 ile 5 arasında bir puan tuşlayınız.",
                announcement_id: q.announcement_id || q.announcement || "",
                voice: q.voice || "tr-TR-EmelNeural",
                mode: q.mode || "tts"
              }))
            : [
                {
                  ...DEFAULT_SURVEY_QUESTION,
                  announcement_id: queueData.survey_question_announcement || ""
                }
              ];

        setFormData(prev => ({
          ...prev,
          max_concurrent_breaks: 0,
          disposition_codes: DEFAULT_DISPOSITION_CODES,
          smart_callback_enabled: false,
          smart_callback_max_wait_seconds: 60,
          smart_callback_queue_threshold: 3,
          smart_callback_max_retries: 3,
          smart_callback_retry_interval: 60,
          smart_callback_priority_level: "high",
          smart_callback_outbound_trunk_id: 1,
          smart_callback_missed_call_auto: true,
          survey_enabled: false,
          survey_scale: "1-5",
          survey_question_announcement: "",
          survey_thank_you_announcement: "",
          survey_thank_you_text: "Değerlendirmeniz için teşekkür eder, iyi günler dileriz.",
          survey_thank_you_voice: "tr-TR-EmelNeural",
          survey_timeout_sec: 10,
          survey_low_score_threshold: 2,
          auto_pause_missed_enabled: false,
          auto_pause_missed_count: 1,
          auto_pause_disconnect_enabled: false,
          auto_pause_disconnect_grace_sec: 15,
          auto_pause_reconnect_mode: "manual",
          auto_pause_notify_user: true,
          auto_pause_notify_channels: "both",
          ...queueData,
          survey_questions: existingQuestions,
          survey_thank_you_text:
            queueData.survey_thank_you_text ||
            "Değerlendirmeniz için teşekkür eder, iyi günler dileriz.",
          survey_thank_you_voice: queueData.survey_thank_you_voice || "tr-TR-EmelNeural",
          disposition_codes: Array.isArray(queueData.disposition_codes) && queueData.disposition_codes.length > 0
            ? queueData.disposition_codes
            : DEFAULT_DISPOSITION_CODES
        }));
        
        // Ensure queueMembers have priority attribute
        const normalizedMembers = (queueData.queueMembers || []).map(qm => ({
          ...qm,
          priority: qm.priority || 1,
          type: qm.type || 'dynamic'
        }));
        setQueueMembers(normalizedMembers);
        setSupervisors(queueData.supervisors || []);
      } else {
        // Reset form
        setFormData({
          extension: "", name: "", strategy: "ringall", max_calls: 0, ring_time: 15, acw_time: 5,
          max_concurrent_breaks: 0, disposition_codes: DEFAULT_DISPOSITION_CODES,
          join_announcement_enabled: false, join_announcement: "",
          periodic_announcement_enabled: false, periodic_announcement: "",
          hold_music_class: "default",
          position_announcement_enabled: false, position_announcement_interval: 60,
          estimated_hold_time_enabled: false, estimated_hold_time_interval: 60,
          max_wait_time_enabled: false, max_wait_time: 120,
          max_wait_destination_type: "", max_wait_destination_target: "",
          ivr_routes: {
            "1": { type: "", target: "" }, "2": { type: "", target: "" }, "3": { type: "", target: "" },
            "4": { type: "", target: "" }, "5": { type: "", target: "" }, "6": { type: "", target: "" },
            "7": { type: "", target: "" }, "8": { type: "", target: "" }, "9": { type: "", target: "" },
            "0": { type: "", target: "" }, "*": { type: "", target: "" }, "#": { type: "", target: "" }
          },
          all_busy_routing_enabled: false,
          all_busy_destination_type: "",
          all_busy_destination_target: "",
          notify_missed_calls: false,
          smart_callback_enabled: false,
          smart_callback_max_wait_seconds: 60,
          smart_callback_queue_threshold: 3,
          smart_callback_max_retries: 3,
          smart_callback_retry_interval: 60,
          smart_callback_priority_level: "high",
          smart_callback_outbound_trunk_id: 1,
          smart_callback_missed_call_auto: true,
          survey_enabled: false,
          survey_scale: "1-5",
          survey_question_announcement: "",
          survey_thank_you_announcement: "",
          survey_thank_you_text: "Değerlendirmeniz için teşekkür eder, iyi günler dileriz.",
          survey_thank_you_voice: "tr-TR-EmelNeural",
          survey_questions: [{ ...DEFAULT_SURVEY_QUESTION }],
          survey_timeout_sec: 10,
          survey_low_score_threshold: 2,
          auto_pause_missed_enabled: false,
          auto_pause_missed_count: 1,
          auto_pause_disconnect_enabled: false,
          auto_pause_disconnect_grace_sec: 15,
          auto_pause_reconnect_mode: "manual",
          auto_pause_notify_user: true,
          auto_pause_notify_channels: "both"
        });
        setQueueMembers([]);
        setSupervisors([]);
      }
    }
  }, [isOpen, queueData]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' && value !== '' ? parseInt(value) || 0 : value)
    }));
  };

  const handleSave = () => {
    setError(null);
    if (!formData.name || !formData.name.trim()) {
      setError("Lütfen kuyruk adını giriniz.");
      return;
    }
    const ext = parseInt(formData.extension);
    if (isNaN(ext) || ext <= 0) {
      setError("Lütfen geçerli bir kuyruk dahili numarası giriniz.");
      return;
    }

    const extStr = String(ext).trim();
    const qName = formData.name.trim();

    // Check duplicate extension
    const dupExtQueue = (allQueues || []).find(
      q => String(q.extension || q.queue_number || "").trim() === extStr && (!queueData || q.id !== queueData.id)
    );
    if (dupExtQueue) {
      setError(`Bu kuyruk numarası (${extStr}) zaten '${dupExtQueue.name || 'Kuyruk'}' tarafından kullanılıyor.`);
      return;
    }

    // Check duplicate name
    const dupNameQueue = (allQueues || []).find(
      q => String(q.name || "").trim().toLowerCase() === qName.toLowerCase() && (!queueData || q.id !== queueData.id)
    );
    if (dupNameQueue) {
      setError(`'${qName}' isimli bir kuyruk zaten mevcut. Lütfen farklı bir isim giriniz.`);
      return;
    }

    const normalizedQuestions = Array.isArray(formData.survey_questions) && formData.survey_questions.length > 0
      ? formData.survey_questions
      : [{ ...DEFAULT_SURVEY_QUESTION }];

    const firstAnnId = normalizedQuestions[0]?.announcement_id || formData.survey_question_announcement || "";

    if (onSave) {
      onSave(
        {
          ...formData,
          extension: extStr,
          name: qName,
          survey_questions: normalizedQuestions,
          survey_question_announcement: firstAnnId,
          queueMembers,
          supervisors
        },
        (errMsg) => setError(errMsg)
      );
    } else {
      onClose();
    }
  };

  const formatAnnouncementLabel = (a) => {
    if (!a) return "";
    const nameStr = String(a.name || "").trim();
    const origStr = String(a.original_filename || a.filename || "").trim();
    const typeTag = a.type === "moh" ? "🎵 Bekletme Müziği" : "🔊 Anons";
    if (nameStr && origStr && nameStr.toLowerCase() !== origStr.toLowerCase() && `${nameStr}.wav`.toLowerCase() !== origStr.toLowerCase() && `${nameStr}.mp3`.toLowerCase() !== origStr.toLowerCase()) {
      return `${nameStr} (${origStr}) • ${typeTag}`;
    }
    return `${origStr || nameStr || a.id} • ${typeTag}`;
  };

  const resolveAnnouncementVal = (val) => {
    if (!val) return "";
    const valStr = String(val).trim();
    const found = (announcementsList || []).find(a => 
      String(a.id) === valStr || 
      String(a.filename) === valStr || 
      String(a.name).trim() === valStr || 
      String(a.original_filename).trim() === valStr
    );
    return found ? String(found.id) : valStr;
  };

  const getMaxWaitTargets = () => {
    const type = formData.max_wait_destination_type;
    if (type === "user") {
      return allUsers.map(u => ({ id: String(u.extension || u.id), label: `${u.full_name} (Dahili: ${u.extension})` }));
    } else if (type === "queue") {
      return (allQueues || []).filter(q => !queueData || q.id !== queueData.id).map(q => ({ id: String(q.extension), label: `${q.name} (${q.extension})` }));
    } else if (type === "call_flow") {
      return (callFlowsList || []).map(cf => ({ id: String(cf.id), label: cf.name || `Akış #${cf.id}` }));
    } else if (type === "ai_agent") {
      return (aiAgentsList || []).map(a => ({ id: String(a.id), label: `🤖 ${a.name} (${a.model || 'AI'})` }));
    } else if (type === "announcement") {
      return (announcementsList || []).map(a => ({
        id: String(a.id || a.filename || a.name),
        label: formatAnnouncementLabel(a)
      }));
    }
    return [];
  };

  const renderSidebarTabs = () => (
    <div className="w-64 bg-slate-50/50 dark:bg-slate-950/30 border-r border-slate-100 dark:border-slate-800/60 p-4 shrink-0 overflow-y-auto">
      <nav className="space-y-1">
        <button 
          type="button"
          onClick={() => setActiveTab("general")}
          className={"w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all " + (activeTab === 'general' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
        >
          <Settings size={16} /> Genel
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab("announcements")}
          className={"w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all " + (activeTab === 'announcements' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
        >
          <Volume2 size={16} /> Anons & Bekleme
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab("max_wait_time")}
          className={"w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all " + (activeTab === 'max_wait_time' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
        >
          <Clock size={16} /> Maksimum Bekleme Süresi
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab("ivr")}
          className={"w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all " + (activeTab === 'ivr' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
        >
          <PhoneForwarded size={16} /> Periyodik Anons
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab("members")}
          className={"w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all " + (activeTab === 'members' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
        >
          <Users size={16} /> Üyeler & Yöneticiler
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab("busy_routing")}
          className={"w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all " + (activeTab === 'busy_routing' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
        >
          <Bot size={16} /> Tüm Agent'lar Meşgul
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab("smart_callback")}
          className={"w-full flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl text-xs font-bold transition-all " + (activeTab === 'smart_callback' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
        >
          <span className="flex items-center gap-3">
            <Shuffle size={16} /> Otomatik Geri Arama
          </span>
          {formData.smart_callback_enabled && (
            <span className={"w-2 h-2 rounded-full " + bg + " shrink-0"} title="Otomatik Geri Arama Aktif" />
          )}
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab("survey")}
          className={"w-full flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl text-xs font-bold transition-all " + (activeTab === 'survey' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
        >
          <span className="flex items-center gap-3">
            <Star size={16} /> Memnuniyet Anketi
          </span>
          {formData.survey_enabled && (
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Memnuniyet Anketi Aktif" />
          )}
        </button>
      </nav>
    </div>
  );

  const renderGeneralTab = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6 p-6 animate-in fade-in slide-in-from-bottom-2 duration-300 items-start">
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Kuyruk Numarası</label>
        <input type="number" name="extension" value={formData.extension} onChange={handleChange} placeholder="Örn: 2000" className={`w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`} />
        <p className="text-[10px] text-slate-500 mt-1">Numara Planına göre 2000-2999 aralığında olmalıdır.</p>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Maksimum Çağrı Sayısı</label>
        <input type="number" name="max_calls" value={formData.max_calls} onChange={handleChange} className={`w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`} />
        <p className="text-[10px] text-slate-500 mt-1">Kuyrukta bekleyebilecek max çağrı sayısı (0 = sınırsız).</p>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Kuyruk İsmi</label>
        <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Örn: Satis_Kuyrugu" className={`w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`} />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Çalma Süresi (Sn)</label>
        <input type="number" name="ring_time" value={formData.ring_time} onChange={handleChange} className={`w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`} />
        <p className="text-[10px] text-slate-500 mt-1">Bir temsilcinin telefonu en fazla kaç saniye çalsın?</p>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Çalma Düzeni (Strategy)</label>
        <select name="strategy" value={formData.strategy} onChange={handleChange} className={`w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}>
          {strategies.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">ACW Süresi (Sn)</label>
        <input type="number" min={0} name="acw_time" value={formData.acw_time} onChange={handleChange} className={`w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`} />
        <p className="text-[10px] text-slate-500 mt-1">Çağrı sonrası işlem/not alma süresi (After Call Work). 0 = Kapalı.</p>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Aynı Anda Maks. Moladaki Temsilci</label>
        <input type="number" min={0} name="max_concurrent_breaks" value={formData.max_concurrent_breaks ?? 0} onChange={handleChange} className={`w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`} />
        <p className="text-[10px] text-slate-500 mt-1">Bu kuyrukta aynı anda en fazla kaç temsilci molaya çıkabilir? (0 = Sınırsız)</p>
      </div>

      <div className="md:col-span-2 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-white">Çağrı Sonuç Kodları (Disposition / Wrap-Up Codes)</label>
            <p className="text-[10px] text-slate-500 mt-0.5">Temsilcilerin görüşme sonunda veya ACW süresinde tek tıkla seçebileceği çağrı sonuç etiketleri.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newDispositionCode}
              onChange={(e) => setNewDispositionCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const val = newDispositionCode.trim();
                  if (val && !(formData.disposition_codes || []).includes(val)) {
                    setFormData(prev => ({
                      ...prev,
                      disposition_codes: [...(prev.disposition_codes || []), val]
                    }));
                    setNewDispositionCode("");
                  }
                }
              }}
              placeholder="Yeni sonuç kodu ekle..."
              className={`text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
            />
            <button
              type="button"
              onClick={() => {
                const val = newDispositionCode.trim();
                if (val && !(formData.disposition_codes || []).includes(val)) {
                  setFormData(prev => ({
                    ...prev,
                    disposition_codes: [...(prev.disposition_codes || []), val]
                  }));
                  setNewDispositionCode("");
                }
              }}
              title="Yeni Sonuç Kodu Ekle"
              className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all shadow-sm"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(formData.disposition_codes || []).map((code, idx) => (
            <span
              key={`${code}-${idx}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold ${lightBg} ${text} border ${borderLight}`}
            >
              <span>{code}</span>
              <button
                type="button"
                onClick={() =>
                  setFormData(prev => ({
                    ...prev,
                    disposition_codes: (prev.disposition_codes || []).filter((_, i) => i !== idx)
                  }))
                }
                className="hover:opacity-75"
                title="Kaldır"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {(!formData.disposition_codes || formData.disposition_codes.length === 0) && (
            <span className="text-[11px] text-slate-400 italic">Henüz çağrı sonuç kodu tanımlanmadı.</span>
          )}
        </div>
      </div>

      {/* Otomatik Mola (Auto-Pause / RONA) & Temsilci Bildirim Kuralları */}
      <div className="md:col-span-2 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-700 dark:bg-slate-400" />
              <label className="text-xs font-bold text-slate-800 dark:text-white">
                Otomatik Mola (Auto-Pause / RONA) & Temsilci Bildirim Kuralları
              </label>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Temsilci çağrı kaçırdığında veya WebPhone/SIP bağlantısı koptuğunda otomatik molaya alınır, yeni çağrı gönderilmez ve canlı izleme panelinde antrasit/siyah renkte işaretlenir.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Çağrı Kaçırmada Otomatik Mola (RONA) */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/70 space-y-3">
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-white">Çağrı Kaçırmada Otomatik Mola (RONA)</div>
                <div className="text-[10px] text-slate-500">Temsilci çalan çağrıyı açmazsa veya reddederse otomatik molaya al.</div>
              </div>
              <input
                type="checkbox"
                name="auto_pause_missed_enabled"
                checked={Boolean(formData.auto_pause_missed_enabled)}
                onChange={handleChange}
                className="w-4 h-4 rounded accent-slate-800 cursor-pointer shrink-0"
              />
            </label>

            {formData.auto_pause_missed_enabled && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Üst Üste Kaçırılan Çağrı Limiti
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    name="auto_pause_missed_count"
                    value={formData.auto_pause_missed_count ?? 1}
                    onChange={handleChange}
                    className={`w-24 text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                  />
                  <span className="text-[10px] text-slate-500">çağrı cevapsız kalırsa &quot;Otomatik Mola (Çağrı Kaçırma)&quot; başlatılır.</span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Bağlantı Koptuğunda Otomatik Mola */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/70 space-y-3">
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-white">Bağlantı Koptuğunda Otomatik Mola</div>
                <div className="text-[10px] text-slate-500">WebPhone / SIP bağlantısı koptuğunda temsilciyi otomatik molaya al.</div>
              </div>
              <input
                type="checkbox"
                name="auto_pause_disconnect_enabled"
                checked={Boolean(formData.auto_pause_disconnect_enabled)}
                onChange={handleChange}
                className="w-4 h-4 rounded accent-slate-800 cursor-pointer shrink-0"
              />
            </label>

            {formData.auto_pause_disconnect_enabled && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Kopma Tolerans Süresi (Sn)
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={120}
                    name="auto_pause_disconnect_grace_sec"
                    value={formData.auto_pause_disconnect_grace_sec ?? 15}
                    onChange={handleChange}
                    className={`w-full text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                  />
                  <span className="text-[9px] text-slate-400">Anlık sayfa yenilemelerini tolere eder.</span>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Bağlantı Geldiğinde Davranış
                  </label>
                  <select
                    name="auto_pause_reconnect_mode"
                    value={formData.auto_pause_reconnect_mode || "manual"}
                    onChange={handleChange}
                    className={`w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                  >
                    <option value="manual">Molada Kalsın (Manuel Müsait)</option>
                    <option value="auto">Otomatik Müsait&apos;e Döndür</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Otomatik Molaya Düşen Temsilciye Bildirim (E-Posta & WhatsApp) */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              name="auto_pause_notify_user"
              checked={Boolean(formData.auto_pause_notify_user ?? true)}
              onChange={handleChange}
              className="w-4 h-4 rounded accent-slate-800 cursor-pointer shrink-0"
            />
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-white">
                Otomatik Molaya Düşen Temsilciye Bildirim Gönder (E-Posta / WhatsApp)
              </div>
              <div className="text-[10px] text-slate-500">
                Temsilcinin haberi olmayabileceği durumlar için kullanıcı profilindeki E-Posta ve GSM/WhatsApp numarasına anında uyarı iletilir.
              </div>
            </div>
          </label>

          {Boolean(formData.auto_pause_notify_user ?? true) && (
            <div className="shrink-0">
              <select
                name="auto_pause_notify_channels"
                value={formData.auto_pause_notify_channels || "both"}
                onChange={handleChange}
                className={`text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white font-semibold focus:outline-none focus:ring-2 ${ring}`}
              >
                <option value="both">WhatsApp + E-Posta</option>
                <option value="whatsapp">Sadece WhatsApp</option>
                <option value="email">Sadece E-Posta</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderAnnouncementsTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-y-auto max-h-[60vh]">
      {/* Sol Kolon: Karşılama & Müzik Ayarları */}
      <div className="space-y-6">
        {/* Giriş Anonsu */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <Volume2 size={14} className={text} /> Giriş Anonsu
              </h4>
              <p className="text-[10px] text-slate-500">Kuyruğa çağrı girdiğinde çalınacak anons.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" name="join_announcement_enabled" checked={formData.join_announcement_enabled} onChange={handleChange} className="sr-only peer" />
              <div className={`w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:${bg}`}></div>
            </label>
          </div>
          {formData.join_announcement_enabled && (
            <div className="mt-3">
              <select 
                name="join_announcement" 
                value={resolveAnnouncementVal(formData.join_announcement)} 
                onChange={handleChange} 
                className={`w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all font-medium`}
              >
                <option value="">Anons Yönetimi'nden Seçin...</option>
                {formData.join_announcement && !announcementsList.some(a => String(a.id) === String(resolveAnnouncementVal(formData.join_announcement))) && (
                  <option value={formData.join_announcement}>{formData.join_announcement} (Kayıtlı Anons)</option>
                )}
                {announcementsList.map(a => (
                  <option key={a.id || a.filename || a.name} value={a.id}>{formatAnnouncementLabel(a)}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Bekleme Müziği (Anons Yönetimi / Medya Yönetimi Entegreli) */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/60">
          <h4 className="text-xs font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-1.5">
            <Music size={14} className={text} /> Bekleme Müziği / Medya Seçimi
          </h4>
          <p className="text-[10px] text-slate-500 mb-3">Müşteri beklerken Anons Yönetimi'ndeki ses veya bekletme müziklerinden çalacak medya.</p>
          <select
            name="hold_music_class"
            value={resolveAnnouncementVal(formData.hold_music_class) || "default"}
            onChange={handleChange}
            className={`w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all font-medium`}
          >
            <option value="default">Varsayılan Sistem Bekleme Müziği (default)</option>
            {formData.hold_music_class && formData.hold_music_class !== "default" && !announcementsList.some(a => String(a.id) === String(resolveAnnouncementVal(formData.hold_music_class))) && (
              <option value={formData.hold_music_class}>{formData.hold_music_class}</option>
            )}
            {announcementsList.map(a => (
              <option key={a.id || a.filename || a.name} value={a.id}>
                {formatAnnouncementLabel(a)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sağ Kolon: Otomatik Bilgilendirme Anonsları */}
      <div className="space-y-6">
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/60 space-y-4">
          <div className="border-b border-slate-200/60 dark:border-slate-700/60 pb-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <PhoneCall size={14} className={text} /> Otomatik Bekleme Bilgilendirmeleri
            </h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Çağrı sırasındaki otomatik durum anonslarını yönetin.</p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div>
              <h5 className="text-xs font-bold text-slate-800 dark:text-white">Sıra Numarası Anonsu</h5>
              <p className="text-[10px] text-slate-500">Müşteriye sırasını bildir.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" name="position_announcement_enabled" checked={formData.position_announcement_enabled} onChange={handleChange} className="sr-only peer" />
              <div className={`w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:${bg}`}></div>
            </label>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-700/50 pt-3">
            <div>
              <h5 className="text-xs font-bold text-slate-800 dark:text-white">Tahmini Bekleme Süresi</h5>
              <p className="text-[10px] text-slate-500">Tahmini bekleme süresini bildir.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" name="estimated_hold_time_enabled" checked={formData.estimated_hold_time_enabled} onChange={handleChange} className="sr-only peer" />
              <div className={`w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:${bg}`}></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMaxWaitTimeTab = () => (
    <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-y-auto max-h-[60vh]">
      {/* Switch Header */}
      <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Clock size={16} className={text} />
            Maksimum Bekleme Süresi & Düşüş (Timeout) Yönlendirmesi
          </h4>
          <p className="text-[10px] text-slate-500 mt-0.5">Müşteri kuyrukta belirlenen maksimum bekleme süresini aştığında otomatik olarak seçilen hedefe aktarılır.</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input 
            type="checkbox" 
            name="max_wait_time_enabled" 
            checked={formData.max_wait_time_enabled || false} 
            onChange={handleChange} 
            className="sr-only peer" 
          />
          <div className={`w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:${bg}`}></div>
        </label>
      </div>

      {formData.max_wait_time_enabled && (
        <div className="space-y-6 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Maksimum Bekleme Süresi (Saniye)
            </label>
            <input 
              type="number" 
              name="max_wait_time" 
              value={formData.max_wait_time || 120} 
              onChange={handleChange} 
              placeholder="Örn: 120"
              className={`w-full max-w-xs text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all font-semibold`}
            />
            <p className="text-[10px] text-slate-500 mt-1">Çağrının kuyrukta bekletileceği maksimum süre. Süre dolduğunda aşağıdaki hedef çalışır.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            {/* 1. Hedef Türü */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                1. Hedef Tipi Seçin
              </label>
              <select
                name="max_wait_destination_type"
                value={formData.max_wait_destination_type || ""}
                onChange={(e) => {
                  handleChange(e);
                  setFormData(prev => ({ ...prev, max_wait_destination_target: "" }));
                }}
                className={`w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all font-medium`}
              >
                <option value="">İşlem Yok (Kapat)</option>
                <option value="user">👤 Dahiliye Aktar</option>
                <option value="queue">👥 Başka Kuyruğa Aktar</option>
                <option value="call_flow">🔀 Çağrı Akışına Aktar</option>
                <option value="ai_agent">🤖 AI Temsilciye Aktar</option>
                <option value="announcement">🔊 Anons Çal / Kapat</option>
              </select>
            </div>

            {/* 2. Hedef Seçin */}
            {formData.max_wait_destination_type && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  2. Hedef Seçin
                </label>
                <select
                  name="max_wait_destination_target"
                  value={formData.max_wait_destination_type === "announcement" ? resolveAnnouncementVal(formData.max_wait_destination_target) : (formData.max_wait_destination_target || "")}
                  onChange={handleChange}
                  className={`w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all font-medium`}
                >
                  <option value="">Seçiniz...</option>
                  {getMaxWaitTargets().map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const handleIvrChange = (digit, field, value) => {
    setFormData(prev => ({
      ...prev,
      ivr_routes: {
        ...prev.ivr_routes,
        [digit]: {
          ...(prev.ivr_routes?.[digit] || { type: "", target: "" }),
          [field]: value
        }
      }
    }));
  };

  const renderIvrTab = () => {
    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "*", "#"];
    return (
      <div className="p-6 animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-y-auto max-h-[60vh] space-y-6">
        {/* Periyodik Anons Aç/Kapat & Ses Kaydı Seçimi */}
        <div className="p-5 bg-slate-50/70 dark:bg-slate-800/30 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Volume2 size={15} className={text} /> Periyodik Anons Ayarları
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Bekleme sırasında belirli aralıklarla çalacak anonsu açın ve Anons Yönetimi'nden ses kaydını seçin.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" name="periodic_announcement_enabled" checked={formData.periodic_announcement_enabled} onChange={handleChange} className="sr-only peer" />
              <div className={`w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:${bg}`}></div>
            </label>
          </div>
          
          {formData.periodic_announcement_enabled && (
            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Periyodik Anons Ses Kaydı</label>
              <select 
                name="periodic_announcement" 
                value={resolveAnnouncementVal(formData.periodic_announcement)} 
                onChange={handleChange} 
                className={`w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all font-medium`}
              >
                <option value="">Anons Yönetimi'nden Seçin...</option>
                {formData.periodic_announcement && !announcementsList.some(a => String(a.id) === String(resolveAnnouncementVal(formData.periodic_announcement))) && (
                  <option value={formData.periodic_announcement}>{formData.periodic_announcement} (Kayıtlı Anons)</option>
                )}
                {announcementsList.map(a => (
                  <option key={a.id || a.filename || a.name} value={a.id}>{formatAnnouncementLabel(a)}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Anons Sırasında Tuşlama Yönlendirmeleri */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <PhoneForwarded size={15} className={text} /> Anons Sırasında IVR Tuşlama Seçenekleri
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Müşteri periyodik anons dinlerken bir tuşa basarsa yapılacak yönlendirmeyi belirleyin.</p>
            </div>
            {!formData.periodic_announcement_enabled && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg font-semibold border border-amber-200/80 dark:border-amber-800/80">
                Tuşlamaları seçmek için yukarıdan Periyodik Anons'u açın
              </span>
            )}
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-all duration-300 ${!formData.periodic_announcement_enabled ? 'opacity-40 pointer-events-none filter blur-[0.3px]' : ''}`}>
            {digits.map(digit => {
              const route = formData.ivr_routes?.[digit] || { type: "", target: "" };
              return (
                <div key={digit} className="p-3.5 bg-slate-50/50 dark:bg-slate-800/20 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex flex-col justify-between space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-xl ${lightBg} ${text} font-black text-xs flex items-center justify-center shrink-0`}>
                      {digit}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-white">Tuşu</span>
                  </div>
                  
                  <div className="space-y-2">
                    <select 
                      value={route.type} 
                      onChange={(e) => {
                        handleIvrChange(digit, 'type', e.target.value);
                        handleIvrChange(digit, 'target', '');
                      }}
                      className={`w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 ${ring} text-slate-800 dark:text-white transition-all`}
                    >
                      <option value="">İşlem Yok</option>
                      <option value="user">Dahiliye Aktar</option>
                      <option value="queue">Kuyruğa Aktar</option>
                      <option value="announcement">Anons Çal</option>
                      <option value="call_flow">Çağrı Akışına Aktar</option>
                      <option value="ai_agent">AI Temsilciye Aktar</option>
                    </select>

                    {route.type === "user" && (
                      <select 
                        value={route.target} 
                        onChange={(e) => handleIvrChange(digit, 'target', e.target.value)}
                        className={`w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 ${ring} text-slate-800 dark:text-white transition-all`}
                      >
                        <option value="">Dahili Seçin...</option>
                        {allUsers.map(u => <option key={u.id} value={u.extension}>{u.full_name} ({u.extension})</option>)}
                      </select>
                    )}

                    {route.type === "queue" && (
                      <select 
                        value={route.target} 
                        onChange={(e) => handleIvrChange(digit, 'target', e.target.value)}
                        className={`w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 ${ring} text-slate-800 dark:text-white transition-all`}
                      >
                        <option value="">Kuyruk Seçin...</option>
                        {(allQueues || []).map(q => <option key={q.id} value={q.extension}>{q.name} ({q.extension})</option>)}
                      </select>
                    )}

                    {route.type === "announcement" && (
                      <select 
                        value={resolveAnnouncementVal(route.target)} 
                        onChange={(e) => handleIvrChange(digit, 'target', e.target.value)}
                        className={`w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 ${ring} text-slate-800 dark:text-white transition-all`}
                      >
                        <option value="">Anons Seçin...</option>
                        {announcementsList.map(a => <option key={a.id || a.filename || a.name} value={a.id}>{formatAnnouncementLabel(a)}</option>)}
                      </select>
                    )}

                    {route.type === "call_flow" && (
                      <select 
                        value={route.target} 
                        onChange={(e) => handleIvrChange(digit, 'target', e.target.value)}
                        className={`w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 ${ring} text-slate-800 dark:text-white transition-all`}
                      >
                        <option value="">Çağrı Akışı Seçin...</option>
                        {(callFlowsList || []).map(cf => <option key={cf.id} value={cf.id}>{cf.name || `Akış #${cf.id}`}</option>)}
                      </select>
                    )}

                    {route.type === "ai_agent" && (
                      <select 
                        value={route.target} 
                        onChange={(e) => handleIvrChange(digit, 'target', e.target.value)}
                        className={`w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 ${ring} text-slate-800 dark:text-white transition-all`}
                      >
                        <option value="">AI Temsilci Seçin...</option>
                        {(aiAgentsList || []).map(a => <option key={a.id} value={a.id}>🤖 {a.name} ({a.model || 'AI'})</option>)}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const getRoleLabel = (roleCode) => {
    const r = systemRoles.find(x => x.role_code === roleCode);
    return r ? r.name : roleCode;
  };

  const getGroupMemberUserIds = (group, usersList = allUsers) => {
    const rawExts = group?.extensions || group?.members || [];
    const matchedIds = [];
    rawExts.forEach(val => {
      const u = (usersList || []).find(
        usr => usr.id === val || String(usr.id) === String(val) || String(usr.extension) === String(val)
      );
      if (u && !matchedIds.includes(u.id)) {
        matchedIds.push(u.id);
      }
    });
    return matchedIds;
  };

  const renderMembersTab = () => {
    // Combine Subscriber Groups, Human Users, and AI Agents
    const combinedAvailable = [
      ...(subscriberGroupsList || []).map(g => {
        const memberUserIds = getGroupMemberUserIds(g, allUsers);
        return {
          id: `group_${g.id}`,
          group_id: g.id,
          full_name: g.name,
          extension: `Abone Grubu (${memberUserIds.length} Abone)`,
          role: "subscriber_group",
          is_subscriber_group: true,
          is_ai: false,
          memberUserIds
        };
      }),
      ...allUsers.map(u => ({ ...u, is_ai: false, is_subscriber_group: false })),
      ...aiAgentsList.map(a => ({
        id: `ai_${a.id}`,
        ai_id: a.id,
        full_name: `🤖 ${a.name} (${a.model || 'AI'})`,
        extension: `AI Agent`,
        role: "ai_agent",
        is_ai: true,
        is_subscriber_group: false,
        avatar: "https://cdn-icons-png.flaticon.com/512/4712/4712035.png"
      }))
    ];

    // Filter unassigned members
    const unassignedMembers = combinedAvailable.filter(u => 
      !queueMembers.find(qm => String(qm.user_id) === String(u.id) || (u.ai_id && String(qm.user_id) === String(u.ai_id)))
    );

    const filteredUnassigned = unassignedMembers.filter(u =>
      !memberSearchQuery || 
      String(u.full_name || "").toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
      String(u.extension || "").toLowerCase().includes(memberSearchQuery.toLowerCase())
    );

    // Supervisor lists
    const eligibleSupervisors = allUsers.filter(u => (u.role === "supervisor" || u.role === "admin") && !supervisors.includes(u.id));
    const selectedSupervisors = allUsers.filter(u => supervisors.includes(u.id));

    const toggleMember = (user) => {
      const targetId = user.ai_id || user.id;
      const isSubGroup = !!user.is_subscriber_group || String(targetId || "").startsWith("group_");

      if (isSubGroup) {
        const grpKey = String(targetId);
        const grpId = grpKey.replace("group_", "");
        const grpObj = (subscriberGroupsList || []).find(g => String(g.id) === grpId);
        const memberUserIds = user.memberUserIds || (grpObj ? getGroupMemberUserIds(grpObj, allUsers) : []);
        const exists = queueMembers.some(qm => String(qm.user_id) === grpKey);

        if (exists) {
          // Abone grubu çıkarıldığında hem grubu hem de içindeki kullanıcıları (başka seçili grupta değillerse) çıkar
          setQueueMembers(prev => {
            const remainingGroupKeys = prev
              .map(qm => String(qm.user_id))
              .filter(uid => uid.startsWith("group_") && uid !== grpKey);
            const protectedUserIds = new Set();
            remainingGroupKeys.forEach(rk => {
              const otherGid = rk.replace("group_", "");
              const otherGrp = (subscriberGroupsList || []).find(g => String(g.id) === otherGid);
              if (otherGrp) {
                getGroupMemberUserIds(otherGrp, allUsers).forEach(uid => protectedUserIds.add(String(uid)));
              }
            });
            return prev.filter(qm => {
              const qid = String(qm.user_id);
              if (qid === grpKey) return false;
              if (memberUserIds.some(uid => String(uid) === qid) && !protectedUserIds.has(qid)) return false;
              return true;
            });
          });
        } else {
          // Abone grubu eklendiğinde hem abone grubunu hem de içindeki tüm user'ları ekle
          setQueueMembers(prev => {
            const next = [...prev];
            if (!next.some(qm => String(qm.user_id) === grpKey)) {
              next.push({
                user_id: grpKey,
                type: 'dynamic',
                is_ai: false,
                is_subscriber_group: true,
                priority: 1
              });
            }
            memberUserIds.forEach(uid => {
              if (!next.some(qm => String(qm.user_id) === String(uid))) {
                next.push({
                  user_id: uid,
                  type: 'dynamic',
                  is_ai: false,
                  priority: 1
                });
              }
            });
            return next;
          });
        }
        return;
      }

      const exists = queueMembers.find(qm => String(qm.user_id) === String(targetId) || String(qm.user_id) === String(user.id));
      if (exists) {
        setQueueMembers(prev => prev.filter(qm => String(qm.user_id) !== String(targetId) && String(qm.user_id) !== String(user.id)));
      } else {
        setQueueMembers(prev => [...prev, { 
          user_id: targetId, 
          type: 'dynamic', 
          is_ai: !!user.is_ai,
          priority: 1 
        }]);
      }
    };

    const updateMemberType = (userId, newType) => {
      if (String(userId).startsWith("group_")) {
        const grpId = String(userId).replace("group_", "");
        const grpObj = (subscriberGroupsList || []).find(g => String(g.id) === grpId);
        const memberIds = grpObj ? getGroupMemberUserIds(grpObj, allUsers).map(String) : [];
        setQueueMembers(prev => prev.map(qm => (String(qm.user_id) === String(userId) || memberIds.includes(String(qm.user_id))) ? { ...qm, type: newType } : qm));
        return;
      }
      setQueueMembers(prev => prev.map(qm => qm.user_id === userId ? { ...qm, type: newType } : qm));
    };

    const updateMemberPriority = (userId, newPriority) => {
      if (String(userId).startsWith("group_")) {
        const grpId = String(userId).replace("group_", "");
        const grpObj = (subscriberGroupsList || []).find(g => String(g.id) === grpId);
        const memberIds = grpObj ? getGroupMemberUserIds(grpObj, allUsers).map(String) : [];
        setQueueMembers(prev => prev.map(qm => (String(qm.user_id) === String(userId) || memberIds.includes(String(qm.user_id))) ? { ...qm, priority: newPriority } : qm));
        return;
      }
      setQueueMembers(prev => prev.map(qm => qm.user_id === userId ? { ...qm, priority: newPriority } : qm));
    };

    const toggleSupervisor = (user) => {
      const exists = supervisors.includes(user.id);
      if (exists) {
        setSupervisors(prev => prev.filter(id => id !== user.id));
      } else {
        setSupervisors(prev => [...prev, user.id]);
      }
    };

    return (
      <div className="flex flex-col h-[60vh] animate-in fade-in slide-in-from-bottom-2 duration-300">
        
        {/* Sub-Tabs */}
        <div className="flex p-4 px-6 gap-2 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
          <button 
            onClick={() => setMemberView("agents")}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${memberView === 'agents' ? `${bg} text-white shadow-sm` : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
          >
            Kuyruk Temsilcileri (İnsan, Abone Grubu & AI)
          </button>
          <button 
            onClick={() => setMemberView("supervisors")}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${memberView === 'supervisors' ? `${bg} text-white shadow-sm` : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
          >
            Kuyruk Yöneticileri (Supervisors)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden p-6 pb-2">
          {/* Sol: Tüm Kullanıcılar, Abone Grupları ve AI Temsilcileri */}
          <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 flex flex-col gap-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                {memberView === "agents" ? "Kullanıcılar, Abone Grupları & AI Temsilcileri" : "Yönetici Adayları"}
              </h4>

              {memberView === "agents" && (
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Temsilci veya abone grubu ara..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {(memberView === "agents" ? filteredUnassigned : eligibleSupervisors).map(u => (
                <div 
                  key={u.id} 
                  onClick={() => memberView === "agents" ? toggleMember(u) : toggleSupervisor(u)} 
                  className={`flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 ${
                    u.is_ai
                      ? "bg-purple-50/60 dark:bg-purple-950/20 border-purple-200/50 dark:border-purple-900/40"
                      : u.is_subscriber_group
                        ? `${lightBg} border ${borderLight}`
                        : ""
                  }`}
                >
                  {u.is_ai ? (
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <Bot size={18} />
                    </div>
                  ) : u.is_subscriber_group ? (
                    <div className={`w-8 h-8 rounded-lg ${lightBg} ${text} flex items-center justify-center shrink-0 border ${borderLight}`}>
                      <Users size={16} />
                    </div>
                  ) : (
                    <img src={u.avatar || `https://ui-avatars.com/api/?name=${u.full_name}&background=random`} alt="" className="w-8 h-8 rounded-lg bg-slate-200 shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{u.full_name}</p>
                      {u.is_ai && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                          AI Temsilci
                        </span>
                      )}
                      {u.is_subscriber_group && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${lightBg} ${text} border ${borderLight}`}>
                          Abone Grubu
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">
                      {u.is_ai
                        ? "Yapay Zeka Temsilcisi"
                        : u.is_subscriber_group
                          ? `${(u.memberUserIds || []).length} Abone`
                          : `${getRoleLabel(u.role)} • Dahili: ${u.extension}`}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 shrink-0" />
                </div>
              ))}
              {(memberView === "agents" ? filteredUnassigned : eligibleSupervisors).length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400">Atanabilecek üye bulunamadı.</div>
              )}
            </div>
          </div>

          {/* Sağ: Seçili Kullanıcılar */}
          <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                {memberView === "agents" ? "Kuyruk Üyeleri & Öncelikler" : "Kuyruk Yöneticileri"}
              </h4>
              <span className={`px-2 py-0.5 rounded-lg ${lightBg} ${text} text-[10px] font-bold`}>
                {memberView === "agents" ? queueMembers.length : supervisors.length} Seçili
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
              {memberView === "agents" && queueMembers.map(qm => {
                const isSubGroup = !!qm.is_subscriber_group || String(qm.user_id || "").startsWith("group_");
                const grpId = isSubGroup ? String(qm.user_id).replace("group_", "") : null;
                const grpObj = isSubGroup ? (subscriberGroupsList || []).find(g => String(g.id) === grpId) : null;
                const grpMemberIds = grpObj ? getGroupMemberUserIds(grpObj, allUsers) : [];

                const user = !isSubGroup ? allUsers.find(x => String(x.id) === String(qm.user_id)) : null;
                const ai = !isSubGroup ? aiAgentsList.find(x => String(x.id) === String(qm.user_id)) : null;
                const name = isSubGroup
                  ? (grpObj ? grpObj.name : `Abone Grubu #${grpId}`)
                  : (user ? user.full_name : (ai ? `🤖 ${ai.name}` : `Üye #${qm.user_id}`));
                const isAi = !!ai || !!qm.is_ai;

                return (
                  <div key={qm.user_id} className={`flex flex-col p-2.5 rounded-xl border shadow-sm transition-all group ${
                    isSubGroup
                      ? `${lightBg} border ${borderLight}`
                      : isAi 
                        ? "bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/40" 
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isSubGroup ? (
                          <div className={`w-7 h-7 rounded-lg ${lightBg} ${text} border ${borderLight} flex items-center justify-center shrink-0`}>
                            <Users size={15} />
                          </div>
                        ) : isAi ? (
                          <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                            <Bot size={16} />
                          </div>
                        ) : (
                          <img src={user?.avatar || `https://ui-avatars.com/api/?name=${name}&background=random`} alt="" className="w-7 h-7 rounded-lg bg-slate-200 shrink-0" />
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{name}</p>
                            {isSubGroup && (
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${lightBg} ${text} border ${borderLight}`}>
                                Abone Grubu
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {isSubGroup
                              ? `${grpMemberIds.length} Abone (Grup çıkarıldığında üyeleri de çıkarılır)`
                              : isAi
                                ? "Yapay Zeka Temsilcisi"
                                : `Dahili: ${user?.extension || '-'}`}
                          </span>
                        </div>
                      </div>

                      <button onClick={() => toggleMember({ id: qm.user_id, ai_id: qm.user_id, is_ai: isAi, is_subscriber_group: isSubGroup, memberUserIds: grpMemberIds })} className="w-6 h-6 rounded-md hover:bg-rose-50 hover:text-rose-500 text-slate-300 flex items-center justify-center transition-all shrink-0" title={isSubGroup ? "Abone Grubunu ve Üyelerini Çıkar" : "Çıkar"}>
                        <X size={13} />
                      </button>
                    </div>

                    {/* Type & Priority Controls */}
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Üye Tipi</label>
                        <select 
                          value={qm.type || 'dynamic'} 
                          onChange={(e) => updateMemberType(qm.user_id, e.target.value)}
                          className="w-full text-[10px] px-1.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none"
                        >
                          <option value="dynamic">Dinamik</option>
                          <option value="static">Statik</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Öncelik Puanı</label>
                        <select 
                          value={qm.priority || 1} 
                          onChange={(e) => updateMemberPriority(qm.user_id, parseInt(e.target.value))}
                          className="w-full text-[10px] px-1.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/40 font-bold text-emerald-700 dark:text-emerald-400 focus:outline-none"
                        >
                          <option value={1}>⭐ Öncelik 1 (Yüksek)</option>
                          <option value={2}>🔹 Öncelik 2 (Orta)</option>
                          <option value={3}>🔸 Öncelik 3 (Düşük)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}

              {memberView === "supervisors" && selectedSupervisors.map(u => (
                <div key={u.id} className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm transition-all group">
                  <img src={u.avatar || `https://ui-avatars.com/api/?name=${u.full_name}&background=random`} alt="" className="w-8 h-8 rounded-lg bg-slate-200 shrink-0 cursor-pointer" onClick={() => toggleSupervisor(u)} title="Çıkar" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{u.full_name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{getRoleLabel(u.role)} • {u.extension}</p>
                  </div>
                  <button onClick={() => toggleSupervisor(u)} className="w-6 h-6 rounded-md hover:bg-rose-50 hover:text-rose-500 text-slate-300 flex items-center justify-center transition-all shrink-0">
                    <X size={12} />
                  </button>
                </div>
              ))}

              {(memberView === "agents" && queueMembers.length === 0) && <div className="p-4 text-center text-xs text-slate-400">Kuyruğa henüz üye eklenmedi.</div>}
              {(memberView === "supervisors" && supervisors.length === 0) && <div className="p-4 text-center text-xs text-slate-400">Kuyruğa henüz yönetici atanmadı.</div>}
            </div>
          </div>
        </div>

        {/* Bildirim Ayarı */}
        <div className="p-6 pt-2 shrink-0">
          <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/60 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-rose-50 text-rose-500 dark:bg-rose-950/30 dark:text-rose-400`}>
                <AlertCircle size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">Cevapsız Çağrıları Yöneticiye Bildir</h4>
                <p className="text-[10px] text-slate-500">Kuyrukta kapanan ve cevaplanamayan çağrılar seçili yöneticilere bildirilir.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" name="notify_missed_calls" checked={formData.notify_missed_calls} onChange={handleChange} className="sr-only peer" />
              <div className={`w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:${bg}`}></div>
            </label>
          </div>
        </div>
      </div>
    );
  };

  const renderBusyRoutingTab = () => {
    // Target options generator
    let targets = [];
    const type = formData.all_busy_destination_type;

    if (type === "user") {
      targets = allUsers.map(u => ({ id: String(u.extension || u.id), label: `${u.full_name} (Dahili: ${u.extension})` }));
    } else if (type === "queue") {
      targets = (allQueues || []).filter(q => !queueData || q.id !== queueData.id).map(q => ({ id: String(q.extension), label: `${q.name} (${q.extension})` }));
    } else if (type === "call_flow") {
      targets = (callFlowsList || []).map(cf => ({ id: String(cf.id), label: cf.name || `Akış #${cf.id}` }));
    } else if (type === "ai_agent") {
      targets = (aiAgentsList || []).map(a => ({ id: String(a.id), label: `🤖 ${a.name} (${a.model || 'AI'})` }));
    } else if (type === "announcement") {
      targets = (announcementsList || []).map(a => ({
        id: String(a.id || a.filename || a.name),
        label: formatAnnouncementLabel(a)
      }));
    }

    const filteredTargets = targets.filter(t => 
      !searchTargetQuery || t.label.toLowerCase().includes(searchTargetQuery.toLowerCase()) || t.id.toLowerCase().includes(searchTargetQuery.toLowerCase())
    );

    return (
      <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-y-auto max-h-[60vh]">
        {/* Switch Header */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Bot size={16} className={text} />
              Tüm Agent'lar Meşgul İse Düşüş (Fallback) Yönlendirmesi
            </h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Kuyruktaki tüm temsilciler meşgule düştüğünde çağrıyı otomatik olarak seçilen hedefe aktarın.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input 
              type="checkbox" 
              name="all_busy_routing_enabled" 
              checked={formData.all_busy_routing_enabled || false} 
              onChange={handleChange} 
              className="sr-only peer" 
            />
            <div className={`w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:${bg}`}></div>
          </label>
        </div>

        {formData.all_busy_routing_enabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            {/* 1. Açılır Liste: Hedef Türü */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                1. Hedef Tipi Seçin
              </label>
              <select
                name="all_busy_destination_type"
                value={formData.all_busy_destination_type || ""}
                onChange={(e) => {
                  handleChange(e);
                  setFormData(prev => ({ ...prev, all_busy_destination_target: "" }));
                }}
                className={`w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}
              >
                <option value="">Hedef Tipi Seçiniz...</option>
                <option value="user">Kullanıcı / Dahili</option>
                <option value="queue">Başka Bir Kuyruk</option>
                <option value="call_flow">Arama Akışı (Call Flow)</option>
                <option value="ai_agent">Yapay Zeka (AI) Temsilcisi</option>
                <option value="mobile_transfer">Mobil Numaraya Transfer (GSM)</option>
                <option value="announcement">Anons Çal</option>
                <option value="voicemail">Sesli Mesaj</option>
                <option value="hangup">Çağrıyı Kapat</option>
              </select>
            </div>

            {/* 2. Açılır Liste (Arama Kutusuna Sahip Spesifik Hedef Seçici) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                2. Spesifik Hedef Seçin (Aramalı)
              </label>
              
              {["hangup"].includes(type) ? (
                <div className="p-2.5 bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 text-xs rounded-xl border border-slate-200 dark:border-slate-700">
                  Çağrı meşgule düştüğünde otomatik olarak kapatılacaktır.
                </div>
              ) : type === "mobile_transfer" ? (
                <input
                  type="text"
                  name="all_busy_destination_target"
                  placeholder="GSM Cep Telefonu Numarası Girin (Örn: 05321234567)"
                  value={formData.all_busy_destination_target || ""}
                  onChange={handleChange}
                  className={`w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}
                />
              ) : (
                <div className="space-y-2">
                  {/* Search Bar inside target selector */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Listede hızlı ara..."
                      value={searchTargetQuery}
                      onChange={(e) => setSearchTargetQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <select
                    name="all_busy_destination_target"
                    value={type === "announcement" ? resolveAnnouncementVal(formData.all_busy_destination_target) : (formData.all_busy_destination_target || "")}
                    onChange={handleChange}
                    size={Math.min(6, Math.max(3, filteredTargets.length + 1))}
                    className={`w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all custom-scrollbar`}
                  >
                    <option value="">-- Hedef Seçiniz --</option>
                    {filteredTargets.map(t => (
                      <option key={t.id} value={t.id} className="py-1 px-2 hover:bg-indigo-50 dark:hover:bg-indigo-950">
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSmartCallbackTab = () => {
    const isEnabled = !!formData.smart_callback_enabled;
    return (
      <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-y-auto max-h-[60vh]">
        {/* Ana Aç/Kapat Başlığı */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Shuffle size={16} className={text} />
              Kuyruk Bazlı Otomatik Geri Arama (Smart Callback)
            </h4>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Bu kuyruğa ait kayıp çağrıları ve bekleyen müşterileri, kuyruk temsilcileri müsait olduğunda otomatik olarak geri arayın.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              name="smart_callback_enabled"
              checked={isEnabled}
              onChange={handleChange}
              className="sr-only peer"
            />
            <div className={`w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:${bg}`}></div>
          </label>
        </div>

        {/* Geri Arama Kuralları ve Kayıp Çağrı Yönetimi */}
        <div className={`space-y-5 transition-all duration-200 ${!isEnabled ? "opacity-50 pointer-events-none" : ""}`}>
          {/* Kayıp Çağrı Otomatik Geri Arama Anahtarı */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <h5 className="text-xs font-bold text-slate-800 dark:text-white">
                Kuyruktaki Kayıp / Cevapsız Çağrıları Otomatik Geri Ara
              </h5>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Müşteri bu kuyrukta beklerken telefonu kapattığında (kayıp çağrı) veya maksimum bekleme süresini aştığında otomatik geri arama listesine alınır.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                name="smart_callback_missed_call_auto"
                checked={formData.smart_callback_missed_call_auto !== false}
                onChange={handleChange}
                disabled={!isEnabled}
                className="sr-only peer"
              />
              <div className={`w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:${bg}`}></div>
            </label>
          </div>

          {/* Parametreler Grid */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Clock size={12} className={text} />
                  Eşik Bekleme Süresi (Saniye)
                </label>
                <input
                  type="number"
                  name="smart_callback_max_wait_seconds"
                  value={formData.smart_callback_max_wait_seconds ?? 60}
                  onChange={handleChange}
                  disabled={!isEnabled}
                  min="5"
                  className={`w-full px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring} font-mono`}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Bu kuyrukta bekleme süresi belirtilen saniyeyi aşarsa geri arama devreye girer.
                </p>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <BarChart2 size={12} className={text} />
                  Eşik Kuyruk Boyutu (Kişi)
                </label>
                <input
                  type="number"
                  name="smart_callback_queue_threshold"
                  value={formData.smart_callback_queue_threshold ?? 3}
                  onChange={handleChange}
                  disabled={!isEnabled}
                  min="1"
                  className={`w-full px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring} font-mono`}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Kuyrukta bekleyen aktif kişi sayısı bu sınıra ulaştığında geri arama teklif edilir.
                </p>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Repeat size={12} className={text} />
                  Maksimum Deneme Sayısı
                </label>
                <input
                  type="number"
                  name="smart_callback_max_retries"
                  value={formData.smart_callback_max_retries ?? 3}
                  onChange={handleChange}
                  disabled={!isEnabled}
                  min="1"
                  max="10"
                  className={`w-full px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring} font-mono`}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Geri aramada müşteri yanıt vermezse sistemin en fazla kaç kez tekrar arayacağını belirler.
                </p>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Clock size={12} className={text} />
                  Tekrar Arama Aralığı (Saniye)
                </label>
                <input
                  type="number"
                  name="smart_callback_retry_interval"
                  value={formData.smart_callback_retry_interval ?? 60}
                  onChange={handleChange}
                  disabled={!isEnabled}
                  min="15"
                  className={`w-full px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring} font-mono`}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Başarısız geri arama denemeleri arasında beklenecek süre (sn).
                </p>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  Kuyruk Öncelik Derecesi
                </label>
                <select
                  name="smart_callback_priority_level"
                  value={formData.smart_callback_priority_level || "high"}
                  onChange={handleChange}
                  disabled={!isEnabled}
                  className={`w-full px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                >
                  <option value="high">Yüksek (Temsilciye ilk sırada iletilir)</option>
                  <option value="medium">Orta</option>
                  <option value="low">Düşük</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Bu kuyruğun kayıp çağrılarının temsilcilere hangi öncelikle dağıtılacağını belirler.
                </p>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  Geri Arama İçin Kullanılacak Dış Hat
                </label>
                <select
                  name="smart_callback_outbound_trunk_id"
                  value={formData.smart_callback_outbound_trunk_id || 1}
                  onChange={handleChange}
                  disabled={!isEnabled}
                  className={`w-full px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                >
                  {trunksList.length === 0 ? (
                    <option value={1}>Varsayılan Dış Hat (Operator Trunk)</option>
                  ) : (
                    trunksList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.trunk_name || t.name || `Trunk #${t.id}`} {t.did_number ? `(${t.did_number})` : ""}
                      </option>
                    ))
                  )}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Bu kuyruğa ait geri aramaların başlatılacağı operatör dış hattı (Trunk).
                </p>
              </div>
            </div>
          </div>

          {/* Bilgi Kutusu */}
          <div className="p-4 bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/70 dark:border-slate-800 rounded-2xl space-y-2.5">
            <h5 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <HelpCircle size={14} className={text} />
              Bu Kuyruk İçin Otomatik Geri Arama Nasıl Çalışır?
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              <div className="flex gap-2">
                <span className={`font-extrabold ${text}`}>1.</span>
                <p>Müşteri bu kuyruğu aradığında kayıp çağrı oluşursa veya bekleme eşiği aşılırsa çağrı bu kuyruğun geri arama listesine kaydedilir.</p>
              </div>
              <div className="flex gap-2">
                <span className={`font-extrabold ${text}`}>2.</span>
                <p>Yalnızca bu kuyruğa atanmış olan temsilcilerden biri <strong>Müsait (Available)</strong> durumuna geçtiğinde sistem önce temsilciyi arar ve yanıtladığında müşteriyi dış hattan arayarak köprüler.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleAddSurveyQuestion = () => {
    setFormData(prev => {
      const current = Array.isArray(prev.survey_questions) && prev.survey_questions.length > 0
        ? prev.survey_questions
        : [{ ...DEFAULT_SURVEY_QUESTION }];
      const nextNum = current.length + 1;
      return {
        ...prev,
        survey_questions: [
          ...current,
          {
            id: `q_${Date.now()}_${nextNum}`,
            title: `${nextNum}. Soru`,
            question_text: `${nextNum}. sorumuz için lütfen 1 ile 5 arasında bir puan tuşlayınız.`,
            announcement_id: "",
            voice: "tr-TR-EmelNeural",
            mode: "tts"
          }
        ]
      };
    });
  };

  const handleUpdateSurveyQuestion = (idx, field, value) => {
    setFormData(prev => {
      const current = Array.isArray(prev.survey_questions) && prev.survey_questions.length > 0
        ? [...prev.survey_questions]
        : [{ ...DEFAULT_SURVEY_QUESTION }];
      if (!current[idx]) return prev;
      current[idx] = { ...current[idx], [field]: value };
      const updated = { ...prev, survey_questions: current };
      if (idx === 0 && field === "announcement_id") {
        updated.survey_question_announcement = value;
      }
      return updated;
    });
  };

  const handleConfirmDeleteSurveyQuestion = () => {
    if (deleteQuestionIdx === null) return;
    setFormData(prev => {
      const current = Array.isArray(prev.survey_questions) ? [...prev.survey_questions] : [];
      if (current.length <= 1) return prev;
      const filtered = current.filter((_, i) => i !== deleteQuestionIdx);
      return {
        ...prev,
        survey_questions: filtered,
        survey_question_announcement: filtered[0]?.announcement_id || ""
      };
    });
    setDeleteQuestionIdx(null);
  };

  const handlePlaySurveyAnnouncement = (annIdOrVal, playKey) => {
    if (playingAudioKey === playKey) {
      if (surveyAudioRef.current) {
        surveyAudioRef.current.pause();
        surveyAudioRef.current = null;
      }
      setPlayingAudioKey(null);
      return;
    }

    if (surveyAudioRef.current) {
      surveyAudioRef.current.pause();
      surveyAudioRef.current = null;
    }

    const resolvedId = resolveAnnouncementVal(annIdOrVal);
    const annObj = (announcementsList || []).find(
      a => String(a.id) === String(resolvedId) || String(a.filename) === String(annIdOrVal)
    );
    if (!annObj || !annObj.filename) {
      setError("Dinlenecek ses dosyası bulunamadı. Lütfen önce 'TTS ile Anonsu Güncelle' butonuna basınız.");
      return;
    }

    const audioUrl = `${API_BASE}/api/uploads/announcements/${annObj.filename}?t=${annObj.updated_at || Date.now()}`;
    const audio = new Audio(audioUrl);
    audio.onended = () => setPlayingAudioKey(null);
    audio.onerror = () => setPlayingAudioKey(null);
    audio.play().catch(() => setPlayingAudioKey(null));
    surveyAudioRef.current = audio;
    setPlayingAudioKey(playKey);
  };

  const handleGenerateSurveyTts = async ({ targetType, questionIndex = 0 }) => {
    setError(null);
    const queueLabel = (formData.name || formData.extension || "Kuyruk").trim();

    if (targetType === "question") {
      const questions = Array.isArray(formData.survey_questions) && formData.survey_questions.length > 0
        ? formData.survey_questions
        : [{ ...DEFAULT_SURVEY_QUESTION }];
      const q = questions[questionIndex];
      if (!q || !String(q.question_text || "").trim()) {
        setError("Lütfen seslendirilecek soru metnini giriniz.");
        return;
      }

      const key = `q_${questionIndex}`;
      setGeneratingTtsKey(key);
      try {
        const res = await tenantFetch(`${API_BASE}/api/settings/announcements/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: q.announcement_id || undefined,
            name: `Anket_${queueLabel}_Soru_${questionIndex + 1}`,
            type: "announcement",
            text: String(q.question_text).trim(),
            voice: q.voice || "tr-TR-EmelNeural"
          })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "TTS ses dosyası oluşturulamadı.");
        }
        const data = await res.json();
        const createdAnn = data.announcement;
        if (createdAnn && createdAnn.id) {
          setAnnouncementsList(prev => {
            const exists = prev.some(a => String(a.id) === String(createdAnn.id));
            return exists
              ? prev.map(a => (String(a.id) === String(createdAnn.id) ? createdAnn : a))
              : [...prev, createdAnn];
          });
          handleUpdateSurveyQuestion(questionIndex, "announcement_id", createdAnn.id);
          setTtsSuccessKey(key);
          setTimeout(() => setTtsSuccessKey(prevKey => (prevKey === key ? null : prevKey)), 3500);
        }
      } catch (err) {
        setError(err.message || "TTS anonsu güncellenirken hata oluştu.");
      } finally {
        setGeneratingTtsKey(null);
      }
    } else if (targetType === "thankyou") {
      const tyText = String(formData.survey_thank_you_text || "").trim();
      if (!tyText) {
        setError("Lütfen seslendirilecek teşekkür anons metnini giriniz.");
        return;
      }
      const key = "thankyou";
      setGeneratingTtsKey(key);
      try {
        const res = await tenantFetch(`${API_BASE}/api/settings/announcements/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: formData.survey_thank_you_announcement || undefined,
            name: `Anket_${queueLabel}_Tesekkur`,
            type: "announcement",
            text: tyText,
            voice: formData.survey_thank_you_voice || "tr-TR-EmelNeural"
          })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "TTS teşekkür anonsu oluşturulamadı.");
        }
        const data = await res.json();
        const createdAnn = data.announcement;
        if (createdAnn && createdAnn.id) {
          setAnnouncementsList(prev => {
            const exists = prev.some(a => String(a.id) === String(createdAnn.id));
            return exists
              ? prev.map(a => (String(a.id) === String(createdAnn.id) ? createdAnn : a))
              : [...prev, createdAnn];
          });
          setFormData(prev => ({
            ...prev,
            survey_thank_you_announcement: createdAnn.id
          }));
          setTtsSuccessKey(key);
          setTimeout(() => setTtsSuccessKey(prevKey => (prevKey === key ? null : prevKey)), 3500);
        }
      } catch (err) {
        setError(err.message || "Teşekkür TTS anonsu güncellenirken hata oluştu.");
      } finally {
        setGeneratingTtsKey(null);
      }
    }
  };

  const renderSurveyTab = () => {
    const isEnabled = !!formData.survey_enabled;
    const questions =
      Array.isArray(formData.survey_questions) && formData.survey_questions.length > 0
        ? formData.survey_questions
        : [{ ...DEFAULT_SURVEY_QUESTION }];

    return (
      <div className="p-6 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-y-auto max-h-[65vh]">
        {/* Aktifleştirme Başlığı */}
        <div className="p-4 bg-slate-50/60 dark:bg-slate-800/30 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Star size={16} className="text-amber-500 fill-amber-500" />
              Çağrı Sonu Memnuniyet Anketi (CSAT)
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Temsilci görüşmeyi sonlandırdığında müşteri hattı kapanmaz; otomatik olarak sesli memnuniyet anketi soruları sırayla dinletilir ve tuşlanan puanlar (DTMF) kaydedilir.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              name="survey_enabled"
              checked={isEnabled}
              onChange={handleChange}
              className="sr-only peer"
            />
            <div className={"w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:" + bg}></div>
          </label>
        </div>

        <div className={"space-y-5 transition-all duration-300 " + (!isEnabled ? "opacity-45 pointer-events-none select-none" : "")}>
          {/* Anket Parametreleri */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Star size={12} className="text-amber-500" />
                  Puanlama Ölçeği
                </label>
                <select
                  name="survey_scale"
                  value={formData.survey_scale || "1-5"}
                  onChange={handleChange}
                  disabled={!isEnabled}
                  className={"w-full px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 " + ring}
                >
                  <option value="1-5">1 - 5 Yıldız (Standart CSAT)</option>
                  <option value="1-10">1 - 10 Puan (NPS Ölçeği)</option>
                  <option value="1-2">1 - 2 (Evet / Hayır)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Müşterinin telefon tuşlarıyla verebileceği puan aralığı.
                </p>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Clock size={12} className={text} />
                  Tuşlama Süresi (Saniye)
                </label>
                <input
                  type="number"
                  name="survey_timeout_sec"
                  value={formData.survey_timeout_sec ?? 10}
                  onChange={handleChange}
                  disabled={!isEnabled}
                  min="3"
                  max="30"
                  className={"w-full px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 " + ring + " font-mono"}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Her soru anonsundan sonra tuşlama için beklenecek süre.
                </p>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <AlertCircle size={12} className="text-rose-500" />
                  Düşük Puan (Kritik) Eşiği
                </label>
                <input
                  type="number"
                  name="survey_low_score_threshold"
                  value={formData.survey_low_score_threshold ?? 2}
                  onChange={handleChange}
                  disabled={!isEnabled}
                  min="1"
                  max="5"
                  className={"w-full px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 " + ring + " font-mono"}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Bu puan ve altındaki oylar raporlarda "Düşük Memnuniyet" olarak işaretlenir.
                </p>
              </div>
            </div>
          </div>

          {/* Çoklu Anket Soruları ve TTS Seslendirme Bölümü */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h5 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Volume2 size={15} className={text} />
                  Anket Soruları &amp; Doğrudan TTS Anons Güncelleme
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${lightBg} ${text}`}>
                    {questions.length} Soru
                  </span>
                </h5>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Sağdaki <strong>+</strong> butonuna basarak istediğiniz kadar anket sorusu ekleyebilir ve metni yazıp <strong>TTS ile Anonsu Güncelle</strong> diyerek anında seslendirebilirsiniz.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddSurveyQuestion}
                disabled={!isEnabled}
                title="Yeni Anket Sorusu Ekle"
                className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all shadow-sm cursor-pointer"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {questions.map((q, idx) => {
                const qKey = `q_${idx}`;
                const qMode = q.mode || "tts";
                const isGeneratingThis = generatingTtsKey === qKey;
                const isSuccessThis = ttsSuccessKey === qKey;
                const isPlayingThis = playingAudioKey === qKey;
                const resolvedAnnId = resolveAnnouncementVal(q.announcement_id);

                return (
                  <div
                    key={q.id || idx}
                    className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-3 transition-all"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-white ${bg} shrink-0`}>
                          {idx + 1}. SORU
                        </span>
                        <input
                          type="text"
                          value={q.title || ""}
                          onChange={(e) => handleUpdateSurveyQuestion(idx, "title", e.target.value)}
                          placeholder={`${idx + 1}. Soru Başlığı (Örn: Temsilci Memnuniyeti)`}
                          className={`flex-1 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="inline-flex rounded-xl p-0.5 bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => handleUpdateSurveyQuestion(idx, "mode", "tts")}
                            className={
                              "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 " +
                              (qMode === "tts"
                                ? "bg-white dark:bg-slate-900 " + text + " shadow-sm"
                                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")
                            }
                          >
                            <Sparkles size={11} /> TTS ile Anons
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateSurveyQuestion(idx, "mode", "file")}
                            className={
                              "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 " +
                              (qMode === "file"
                                ? "bg-white dark:bg-slate-900 " + text + " shadow-sm"
                                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")
                            }
                          >
                            <Volume2 size={11} /> Ses Dosyası Seç
                          </button>
                        </div>

                        {questions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setDeleteQuestionIdx(idx)}
                            title="Soruyu Sil"
                            className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {qMode === "tts" ? (
                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                            Müşteriye Okunacak Soru Anons Metni (TTS)
                          </label>
                          <textarea
                            rows={2}
                            value={q.question_text || ""}
                            onChange={(e) => handleUpdateSurveyQuestion(idx, "question_text", e.target.value)}
                            placeholder="Örn: Görüşmemizi değerlendirmek için lütfen 1 ile 5 arasında bir puan tuşlayınız."
                            className={`w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={q.voice || "tr-TR-EmelNeural"}
                              onChange={(e) => handleUpdateSurveyQuestion(idx, "voice", e.target.value)}
                              className={`text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 ${ring}`}
                            >
                              <option value="tr-TR-EmelNeural">👩 Kadın Sesi (Emel Neural - Doğal)</option>
                              <option value="tr-TR-AhmetNeural">👨 Erkek Sesi (Ahmet Neural - Kurumsal)</option>
                            </select>

                            {resolvedAnnId && (
                              <button
                                type="button"
                                onClick={() => handlePlaySurveyAnnouncement(resolvedAnnId, qKey)}
                                className={
                                  "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer " +
                                  (isPlayingThis
                                    ? "bg-rose-600 text-white border-rose-600"
                                    : `bg-white dark:bg-slate-900 ${text} ${borderLight} hover:opacity-85`)
                                }
                                title="Oluşturulan Anonsu Dinle"
                              >
                                {isPlayingThis ? <Square size={11} /> : <Play size={11} />}
                                {isPlayingThis ? "Durdur" : "Anonsu Dinle"}
                              </button>
                            )}

                            {isSuccessThis && (
                              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in">
                                <Check size={13} /> TTS Anonsu Güncellendi!
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleGenerateSurveyTts({ targetType: "question", questionIndex: idx })}
                            disabled={isGeneratingThis}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition-all cursor-pointer ${bg} ${hover} disabled:opacity-50`}
                          >
                            {isGeneratingThis ? (
                              <>
                                <RefreshCw size={12} className="animate-spin" />
                                Seslendiriliyor...
                              </>
                            ) : (
                              <>
                                <Sparkles size={12} />
                                {resolvedAnnId ? "TTS ile Anonsu Güncelle" : "TTS ile Anons Oluştur"}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Kayıtlı Anons Ses Dosyası Seçin
                        </label>
                        <div className="flex items-center gap-2">
                          <select
                            value={resolvedAnnId}
                            onChange={(e) => handleUpdateSurveyQuestion(idx, "announcement_id", e.target.value)}
                            className={`flex-1 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                          >
                            <option value="">Varsayılan Türkçe Anket Sorusu (1'den 5'e Puanlayın)</option>
                            {announcementsList.map(a => (
                              <option key={a.id || a.filename || a.name} value={a.id}>
                                {formatAnnouncementLabel(a)}
                              </option>
                            ))}
                          </select>

                          {resolvedAnnId && (
                            <button
                              type="button"
                              onClick={() => handlePlaySurveyAnnouncement(resolvedAnnId, qKey)}
                              className={
                                "px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border shrink-0 transition-all cursor-pointer " +
                                (isPlayingThis
                                  ? "bg-rose-600 text-white border-rose-600"
                                  : `bg-white dark:bg-slate-900 ${text} ${borderLight}`)
                              }
                            >
                              {isPlayingThis ? <Square size={11} /> : <Play size={11} />}
                              {isPlayingThis ? "Durdur" : "Dinle"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Teşekkür Anonsu (Tuşlama Sonrası) - TTS & Ses Dosyası Seçimi */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h5 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Volume2 size={14} className={text} />
                  Teşekkür Anonsu (Anket Tuşlaması Sonrası)
                </h5>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Müşteri soruları yanıtladıktan sonra hat kapanmadan hemen önce dinletilecek kapanış mesajı.
                </p>
              </div>

              <div className="inline-flex rounded-xl p-0.5 bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setThankYouMode("tts")}
                  className={
                    "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 " +
                    (thankYouMode === "tts"
                      ? "bg-white dark:bg-slate-900 " + text + " shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")
                  }
                >
                  <Sparkles size={11} /> TTS ile Anons
                </button>
                <button
                  type="button"
                  onClick={() => setThankYouMode("file")}
                  className={
                    "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 " +
                    (thankYouMode === "file"
                      ? "bg-white dark:bg-slate-900 " + text + " shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")
                  }
                >
                  <Volume2 size={11} /> Ses Dosyası Seç
                </button>
              </div>
            </div>

            {thankYouMode === "tts" ? (
              <div className="space-y-2.5 pt-1">
                <textarea
                  rows={2}
                  name="survey_thank_you_text"
                  value={formData.survey_thank_you_text || ""}
                  onChange={handleChange}
                  placeholder="Örn: Değerlendirmeniz için teşekkür eder, iyi günler dileriz."
                  className={`w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <select
                      name="survey_thank_you_voice"
                      value={formData.survey_thank_you_voice || "tr-TR-EmelNeural"}
                      onChange={handleChange}
                      className={`text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 ${ring}`}
                    >
                      <option value="tr-TR-EmelNeural">👩 Kadın Sesi (Emel Neural - Doğal)</option>
                      <option value="tr-TR-AhmetNeural">👨 Erkek Sesi (Ahmet Neural - Kurumsal)</option>
                    </select>

                    {resolveAnnouncementVal(formData.survey_thank_you_announcement) && (
                      <button
                        type="button"
                        onClick={() => handlePlaySurveyAnnouncement(formData.survey_thank_you_announcement, "thankyou")}
                        className={
                          "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer " +
                          (playingAudioKey === "thankyou"
                            ? "bg-rose-600 text-white border-rose-600"
                            : `bg-white dark:bg-slate-900 ${text} ${borderLight}`)
                        }
                      >
                        {playingAudioKey === "thankyou" ? <Square size={11} /> : <Play size={11} />}
                        {playingAudioKey === "thankyou" ? "Durdur" : "Anonsu Dinle"}
                      </button>
                    )}

                    {ttsSuccessKey === "thankyou" && (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in">
                        <Check size={13} /> Teşekkür Anonsu Güncellendi!
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleGenerateSurveyTts({ targetType: "thankyou" })}
                    disabled={generatingTtsKey === "thankyou"}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition-all cursor-pointer ${bg} ${hover} disabled:opacity-50`}
                  >
                    {generatingTtsKey === "thankyou" ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        Seslendiriliyor...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} />
                        {resolveAnnouncementVal(formData.survey_thank_you_announcement)
                          ? "TTS ile Anonsu Güncelle"
                          : "TTS ile Anons Oluştur"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-1">
                <select
                  name="survey_thank_you_announcement"
                  value={resolveAnnouncementVal(formData.survey_thank_you_announcement)}
                  onChange={handleChange}
                  disabled={!isEnabled}
                  className={"flex-1 px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 " + ring}
                >
                  <option value="">Varsayılan Türkçe Teşekkür Anonsu</option>
                  {announcementsList.map(a => (
                    <option key={a.id || a.filename || a.name} value={a.id}>
                      {formatAnnouncementLabel(a)}
                    </option>
                  ))}
                </select>
                {resolveAnnouncementVal(formData.survey_thank_you_announcement) && (
                  <button
                    type="button"
                    onClick={() => handlePlaySurveyAnnouncement(formData.survey_thank_you_announcement, "thankyou")}
                    className={
                      "px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border shrink-0 transition-all cursor-pointer " +
                      (playingAudioKey === "thankyou"
                        ? "bg-rose-600 text-white border-rose-600"
                        : `bg-white dark:bg-slate-900 ${text} ${borderLight}`)
                    }
                  >
                    {playingAudioKey === "thankyou" ? <Square size={11} /> : <Play size={11} />}
                    {playingAudioKey === "thankyou" ? "Durdur" : "Dinle"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bilgi Kutusu */}
          <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/50 rounded-2xl space-y-2.5">
            <h5 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <HelpCircle size={14} className="text-amber-500" />
              Memnuniyet Anketi Nasıl Çalışır ve Raporlanır?
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              <div className="flex gap-2">
                <span className="font-extrabold text-amber-600 dark:text-amber-400">1.</span>
                <p>Müşteriyle görüşen temsilci çağrıyı sonlandırdığında müşteri hattı otomatik olarak ankete aktarılır ve eklediğiniz tüm sorular sırasıyla dinletilir.</p>
              </div>
              <div className="flex gap-2">
                <span className="font-extrabold text-amber-600 dark:text-amber-400">2.</span>
                <p>Müşterinin her soruya tuşladığı puanlar; kuyruk, temsilci, arayan numara ve ses kaydı ile eşleştirilerek <strong>Çağrı Raporları &amp; Analiz &gt; Anket Raporları</strong> ekranına anlık yansır.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 transition-all duration-300">
      <div className="w-full max-w-4xl h-[85vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <div>
            <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <PhoneCall size={18} className={text} />
              {queueData ? "Kuyruk Düzenle" : "Yeni Kuyruk Ekle"}
            </h2>
            <p className="text-xs text-slate-500 font-medium">ACD kuyruk konfigürasyonu, üye atamaları, otomatik geri arama ve memnuniyet anketi kuralları</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-3 p-3 bg-rose-50 dark:bg-rose-950/15 border border-rose-200/50 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-between animate-in fade-in duration-200 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="p-1 text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 transition-colors rounded-lg shrink-0"
              title="Kapat"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Main Body with Left Sidebar Navigation */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar Tabs */}
          {renderSidebarTabs()}

          {/* Right Content Area */}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900">
            {activeTab === "general" && renderGeneralTab()}
            {activeTab === "announcements" && renderAnnouncementsTab()}
            {activeTab === "max_wait_time" && renderMaxWaitTimeTab()}
            {activeTab === "ivr" && renderIvrTab()}
            {activeTab === "members" && renderMembersTab()}
            {activeTab === "busy_routing" && renderBusyRoutingTab()}
            {activeTab === "smart_callback" && renderSmartCallbackTab()}
            {activeTab === "survey" && renderSurveyTab()}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end gap-3 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
          >
            Vazgeç
          </button>
          <button 
            type="button" 
            onClick={handleSave} 
            className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg shadow-indigo-500/20 ${bg} ${hover} transition-all flex items-center gap-2`}
          >
            <Check size={14} /> Kaydet
          </button>
        </div>

        <ConfirmDeleteModal
          isOpen={deleteQuestionIdx !== null}
          onClose={() => setDeleteQuestionIdx(null)}
          onConfirm={handleConfirmDeleteSurveyQuestion}
          title="Anket Sorusunu Sil"
          message={`${deleteQuestionIdx !== null ? deleteQuestionIdx + 1 : ""}. anket sorusunu silmek istediğinize emin misiniz?`}
        />
      </div>
    </div>,
    document.body
  );
}
