import React, { useState, useEffect } from "react";
import { X, Settings, Volume2, Users, ChevronRight, ChevronLeft, Check, Search, PhoneCall, Music, AlertCircle, AlertTriangle, PhoneForwarded, Bot, Shield, Clock } from "lucide-react";
import { createPortal } from "react-dom";
import { useTheme } from "../../utils/theme";
import { tenantFetch } from "../../utils/apiHost";

export default function QueueEditModal({ isOpen, onClose, onSave, queueData = null, allQueues = [], API_BASE }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  
  const [activeTab, setActiveTab] = useState("general");
  const [memberView, setMemberView] = useState("agents"); // 'agents' or 'supervisors'
  const [error, setError] = useState(null);

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
  const [searchTargetQuery, setSearchTargetQuery] = useState("");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  // State: Form Data
  const [formData, setFormData] = useState({
    extension: "",
    name: "",
    strategy: "ringall",
    max_calls: 0,
    ring_time: 15,
    acw_time: 5,
    
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

    notify_missed_calls: false
  });

  // State for Members & Supervisors
  const [allUsers, setAllUsers] = useState([]);
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

      if (queueData) {
        setFormData(prev => ({ ...prev, ...queueData }));
        
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
          join_announcement_enabled: false, join_announcement: "",
          periodic_announcement_enabled: false, periodic_announcement: "",
          hold_music_class: "default",
          position_announcement_enabled: false, position_announcement_interval: 60,
          estimated_hold_time_enabled: false, estimated_hold_time_interval: 60,
          ivr_routes: {
            "1": { type: "", target: "" }, "2": { type: "", target: "" }, "3": { type: "", target: "" },
            "4": { type: "", target: "" }, "5": { type: "", target: "" }, "6": { type: "", target: "" },
            "7": { type: "", target: "" }, "8": { type: "", target: "" }, "9": { type: "", target: "" },
            "0": { type: "", target: "" }, "*": { type: "", target: "" }, "#": { type: "", target: "" }
          },
          all_busy_routing_enabled: false,
          all_busy_destination_type: "",
          all_busy_destination_target: "",
          notify_missed_calls: false
        });
        setQueueMembers([]);
        setSupervisors([]);
      }
    }
  }, [isOpen, queueData]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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

    if (onSave) {
      onSave(
        {
          ...formData,
          extension: extStr,
          name: qName,
          queueMembers,
          supervisors
        },
        (errMsg) => setError(errMsg)
      );
    } else {
      onClose();
    }
  };

  const resolveAnnouncementVal = (val) => {
    if (!val) return "";
    const valStr = String(val).trim();
    const found = (announcementsList || []).find(a => 
      String(a.id) === valStr || 
      String(a.filename) === valStr || 
      String(a.name) === valStr || 
      String(a.original_filename) === valStr
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
        label: a.name || a.original_filename || a.filename || String(a.id)
      }));
    }
    return [];
  };

  const renderTabs = () => (
    <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 p-4 pb-0 overflow-x-auto custom-scrollbar">
      <button 
        onClick={() => setActiveTab("general")}
        className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${activeTab === 'general' ? 'border-primary text-primary dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
      >
        <Settings size={14} /> Genel
      </button>
      <button 
        onClick={() => setActiveTab("announcements")}
        className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${activeTab === 'announcements' ? 'border-primary text-primary dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
      >
        <Volume2 size={14} /> Anons & Bekleme
      </button>
      <button 
        onClick={() => setActiveTab("ivr")}
        className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${activeTab === 'ivr' ? 'border-primary text-primary dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
      >
        <Volume2 size={14} /> Periyodik Anons
      </button>
      <button 
        onClick={() => setActiveTab("members")}
        className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${activeTab === 'members' ? 'border-primary text-primary dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
      >
        <Users size={14} /> Üyeler & Yöneticiler
      </button>
      <button 
        onClick={() => setActiveTab("busy_routing")}
        className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${activeTab === 'busy_routing' ? 'border-primary text-primary dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
      >
        <Bot size={14} /> Tüm Agent'lar Meşgul
      </button>
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
        <input type="number" name="acw_time" value={formData.acw_time} onChange={handleChange} className={`w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`} />
        <p className="text-[10px] text-slate-500 mt-1">Çağrı sonrası toparlanma süresi (After Call Work).</p>
      </div>
    </div>
  );

  const renderAnnouncementsTab = () => (
    <div className="grid grid-cols-2 gap-8 p-6 animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-y-auto max-h-[60vh]">
      <div className="space-y-6">
        {/* Giriş Anonsu */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">Giriş Anonsu</h4>
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
                className={`w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}
              >
                <option value="">Anons Seçin...</option>
                {formData.join_announcement && !announcementsList.some(a => String(a.id) === String(formData.join_announcement) || String(a.name) === String(formData.join_announcement) || String(a.filename) === String(formData.join_announcement)) && (
                  <option value={formData.join_announcement}>{formData.join_announcement} (Kayıtlı Anons)</option>
                )}
                {announcementsList.map(a => (
                  <option key={a.id || a.filename || a.name} value={a.id}>{a.name || a.original_filename || a.filename}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Maksimum Bekleme Süresi & Yönlendirme */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/60 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <Clock size={14} className={text} /> Maksimum Bekleme Süresi (Timeout)
              </h4>
              <p className="text-[10px] text-slate-500">Müşteri maksimum bekleme süresini aştığında yapılacak yönlendirmeyi ayarlayın.</p>
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
            <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Maksimum Bekleme Süresi (Saniye)
                </label>
                <input 
                  type="number" 
                  name="max_wait_time" 
                  value={formData.max_wait_time || 120} 
                  onChange={handleChange} 
                  placeholder="Örn: 120"
                  className={`w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  1. Hedef Tipi Seçin
                </label>
                <select
                  name="max_wait_destination_type"
                  value={formData.max_wait_destination_type || ""}
                  onChange={(e) => {
                    handleChange(e);
                    setFormData(prev => ({ ...prev, max_wait_destination_target: "" }));
                  }}
                  className={`w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all font-medium`}
                >
                  <option value="">İşlem Yok (Kapat)</option>
                  <option value="user">👤 Dahiliye Aktar</option>
                  <option value="queue">👥 Başka Kuyruğa Aktar</option>
                  <option value="call_flow">🔀 Çağrı Akışına Aktar</option>
                  <option value="ai_agent">🤖 AI Temsilciye Aktar</option>
                  <option value="announcement">🔊 Anons Çal / Kapat</option>
                </select>
              </div>

              {formData.max_wait_destination_type && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    2. Hedef Seçin
                  </label>
                  <select
                    name="max_wait_destination_target"
                    value={formData.max_wait_destination_target || ""}
                    onChange={handleChange}
                    className={`w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all font-medium`}
                  >
                    <option value="">Seçiniz...</option>
                    {getMaxWaitTargets().map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Bekleme Müziği */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/60">
          <h4 className="text-xs font-bold text-slate-800 dark:text-white mb-1">Bekleme Müziği Sınıfı</h4>
          <p className="text-[10px] text-slate-500 mb-3">Müşteri beklerken çalacak arka plan müziği.</p>
          <select name="hold_music_class" value={formData.hold_music_class} onChange={handleChange} className={`w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}>
            {holdMusicClasses.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Sıra & Bekleme Süresi Anonsları */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/60 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">Sıra Numarası Anonsu</h4>
              <p className="text-[10px] text-slate-500">Müşteriye sırasını bildir.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" name="position_announcement_enabled" checked={formData.position_announcement_enabled} onChange={handleChange} className="sr-only peer" />
              <div className={`w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:${bg}`}></div>
            </label>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-700/50 pt-3">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">Tahmini Bekleme Süresi</h4>
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
              <p className="text-[11px] text-slate-500 mt-0.5">Bekleme sırasında belirli aralıklarla çalacak anonsu açın ve ses kaydını seçin.</p>
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
                <option value="">Anons Seçin...</option>
                {formData.periodic_announcement && !announcementsList.some(a => String(a.id) === String(formData.periodic_announcement) || String(a.name) === String(formData.periodic_announcement) || String(a.filename) === String(formData.periodic_announcement)) && (
                  <option value={formData.periodic_announcement}>{formData.periodic_announcement} (Kayıtlı Anons)</option>
                )}
                {announcementsList.map(a => (
                  <option key={a.id || a.filename || a.name} value={a.id}>{a.name || a.original_filename || a.filename}</option>
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
                      onChange={(e) => handleIvrChange(digit, 'type', e.target.value)}
                      className={`w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 ${ring} text-slate-800 dark:text-white transition-all`}
                    >
                      <option value="">İşlem Yok</option>
                      <option value="user">Dahiliye Aktar</option>
                      <option value="queue">Kuyruğa Aktar</option>
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

  const renderMembersTab = () => {
    // Combine Human Users and AI Agents
    const combinedAvailable = [
      ...allUsers.map(u => ({ ...u, is_ai: false })),
      ...aiAgentsList.map(a => ({
        id: `ai_${a.id}`,
        ai_id: a.id,
        full_name: `🤖 ${a.name} (${a.model || 'AI'})`,
        extension: `AI Agent`,
        role: "ai_agent",
        is_ai: true,
        avatar: "https://cdn-icons-png.flaticon.com/512/4712/4712035.png"
      }))
    ];

    // Filter unassigned members
    const unassignedMembers = combinedAvailable.filter(u => 
      !queueMembers.find(qm => qm.user_id === u.id || qm.user_id === u.ai_id)
    );

    const filteredUnassigned = unassignedMembers.filter(u =>
      !memberSearchQuery || 
      u.full_name.toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
      String(u.extension).toLowerCase().includes(memberSearchQuery.toLowerCase())
    );

    // Supervisor lists
    const eligibleSupervisors = allUsers.filter(u => (u.role === "supervisor" || u.role === "admin") && !supervisors.includes(u.id));
    const selectedSupervisors = allUsers.filter(u => supervisors.includes(u.id));

    const toggleMember = (user) => {
      const targetId = user.ai_id || user.id;
      const exists = queueMembers.find(qm => qm.user_id === targetId || qm.user_id === user.id);
      if (exists) {
        setQueueMembers(prev => prev.filter(qm => qm.user_id !== targetId && qm.user_id !== user.id));
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
      setQueueMembers(prev => prev.map(qm => qm.user_id === userId ? { ...qm, type: newType } : qm));
    };

    const updateMemberPriority = (userId, newPriority) => {
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
            Kuyruk Temsilcileri (İnsan & AI)
          </button>
          <button 
            onClick={() => setMemberView("supervisors")}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${memberView === 'supervisors' ? `${bg} text-white shadow-sm` : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
          >
            Kuyruk Yöneticileri (Supervisors)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden p-6 pb-2">
          {/* Sol: Tüm Kullanıcılar ve AI Temsilcileri */}
          <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 flex flex-col gap-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                {memberView === "agents" ? "Sistemdeki Kullanıcılar & AI Temsilcileri" : "Yönetici Adayları"}
              </h4>

              {memberView === "agents" && (
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Temsilci ara..."
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
                    u.is_ai ? "bg-purple-50/60 dark:bg-purple-950/20 border-purple-200/50 dark:border-purple-900/40" : ""
                  }`}
                >
                  {u.is_ai ? (
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <Bot size={18} />
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
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">
                      {u.is_ai ? "Yapay Zeka Temsilcisi" : `${getRoleLabel(u.role)} • Dahili: ${u.extension}`}
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
                // Find in allUsers or aiAgentsList
                const user = allUsers.find(x => x.id === qm.user_id);
                const ai = aiAgentsList.find(x => x.id === qm.user_id);
                const name = user ? user.full_name : (ai ? `🤖 ${ai.name}` : `Üye #${qm.user_id}`);
                const isAi = !!ai || !!qm.is_ai;

                return (
                  <div key={qm.user_id} className={`flex flex-col p-2.5 rounded-xl border shadow-sm transition-all group ${
                    isAi 
                      ? "bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/40" 
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isAi ? (
                          <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                            <Bot size={16} />
                          </div>
                        ) : (
                          <img src={user?.avatar || `https://ui-avatars.com/api/?name=${name}&background=random`} alt="" className="w-7 h-7 rounded-lg bg-slate-200 shrink-0" />
                        )}

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{name}</p>
                          <span className="text-[10px] text-slate-400">
                            {isAi ? "Yapay Zeka Temsilcisi" : `Dahili: ${user?.extension || '-'}`}
                          </span>
                        </div>
                      </div>

                      <button onClick={() => toggleMember({ id: qm.user_id, ai_id: qm.user_id, is_ai: isAi })} className="w-6 h-6 rounded-md hover:bg-rose-50 hover:text-rose-500 text-slate-300 flex items-center justify-center transition-all shrink-0">
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
        label: a.name || a.original_filename || a.filename || String(a.id)
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
                    value={formData.all_busy_destination_target || ""}
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
            <p className="text-xs text-slate-500 font-medium">ACD kuyruk konfigürasyonu, üye atamaları ve meşgule düşüş kuralları</p>
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

        {/* Tabs */}
        <div className="bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          {renderTabs()}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-white dark:bg-slate-900">
          {activeTab === "general" && renderGeneralTab()}
          {activeTab === "announcements" && renderAnnouncementsTab()}
          {activeTab === "ivr" && renderIvrTab()}
          {activeTab === "members" && renderMembersTab()}
          {activeTab === "busy_routing" && renderBusyRoutingTab()}
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

      </div>
    </div>,
    document.body
  );
}
