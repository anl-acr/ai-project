import React, { useState, useEffect } from "react";
import { X, Settings, Volume2, Users, ChevronRight, ChevronLeft, Check, Search, PhoneCall, Music, AlertCircle, PhoneForwarded } from "lucide-react";
import { createPortal } from "react-dom";
import { useTheme } from "../../utils/theme";

export default function QueueEditModal({ isOpen, onClose, onSave, queueData = null, allQueues = [], API_BASE }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  
  const [activeTab, setActiveTab] = useState("general");
  const [memberView, setMemberView] = useState("agents"); // 'agents' or 'supervisors'
  
  // Dummy Data for dropdowns
  const strategies = [
    { value: "ringall", label: "Tümünü Çaldır (Ringall)" },
    { value: "leastrecent", label: "En Son Çağrı Alan (Least Recent)" },
    { value: "fewestcalls", label: "En Az Çağrı Yanıtlayan (Fewest Calls)" },
    { value: "random", label: "Rastgele (Random)" },
    { value: "rrmemory", label: "Sıralı Hafızalı (RR Memory)" }
  ];
  const holdMusicClasses = ["default", "classical", "pop", "custom_holiday"];
  
  const [announcementsList, setAnnouncementsList] = useState([]);

  // State: Tab 1 (General)
  const [formData, setFormData] = useState({
    extension: "",
    name: "",
    strategy: "ringall",
    max_calls: 0,
    ring_time: 15,
    acw_time: 5,
    
    // State: Tab 2 (Announcements)
    join_announcement_enabled: false,
    join_announcement: "",
    periodic_announcement_enabled: false,
    periodic_announcement: "",
    hold_music_class: "default",
    position_announcement_enabled: false,
    position_announcement_interval: 60,
    estimated_hold_time_enabled: false,
    estimated_hold_time_interval: 60,

    // State: Tab 4 (IVR Routing)
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

    // State: Tab 3 (Members & Supervisors)
    notify_missed_calls: false
  });

  // State for Members (Transfer List)
  const [allUsers, setAllUsers] = useState([]);
  const [queueMembers, setQueueMembers] = useState([]); // { user_id, type: 'dynamic' | 'static' }
  const [supervisors, setSupervisors] = useState([]);
  const [systemRoles, setSystemRoles] = useState([]);

  useEffect(() => {
    if (isOpen) {
      // Fetch users
      const fetchUsers = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/settings/users`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
          });
          if (res.ok) {
            const data = await res.json();
            setAllUsers(data || []);
          }
        } catch (err) {
          console.error("Users fetch error:", err);
        }
      };
      fetchUsers();

      // Fetch roles (if needed) or keep dummy if no API exists
      setSystemRoles([
        { role_code: "admin", role_name: "Sistem Yöneticisi" },
        { role_code: "supervisor", role_name: "Takım Lideri" },
        { role_code: "agent", role_name: "Müşteri Temsilcisi" },
      ]);

      // Fetch announcements
      const fetchAnnouncements = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/settings/announcements`, {
            headers: {
              "Authorization": `Bearer ${localStorage.getItem("token")}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            setAnnouncementsList(data || []);
          }
        } catch (err) {
          console.error("Announcements fetch error:", err);
        }
      };
      fetchAnnouncements();

      if (queueData) {
        setFormData(prev => ({ ...prev, ...queueData }));
        setQueueMembers(queueData.queueMembers || []);
        setSupervisors(queueData.supervisors || []);
      } else {
        // Reset form for new queue
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
          notify_missed_calls: false
        });
        setQueueMembers([]);
        setSupervisors([]);
      }
    }
  }, [isOpen, queueData]);

  const fetchUsersAndRoles = async () => {
    try {
      const resUsers = await fetch(`${API_BASE}/api/settings/users`);
      const dataUsers = await resUsers.json();
      if (dataUsers) setAllUsers(dataUsers);

      const resRoles = await fetch(`${API_BASE}/api/settings/roles`);
      const dataRoles = await resRoles.json();
      if (dataRoles) setSystemRoles(dataRoles);
    } catch (err) {
      console.error(`Kullanıcılar veya Roller yüklenemedi:`, err);
    }
  };

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = () => {
    // Validate Extension (Numbering Plan mock validation for frontend)
    const ext = parseInt(formData.extension);
    if (isNaN(ext) || ext < 2000 || ext > 2999) {
      alert("Kuyruk numarası 2000 - 2999 aralığında olmalıdır.");
      return;
    }
    
    if (onSave) {
      onSave({
        ...formData,
        queueMembers,
        supervisors
      });
    } else {
      onClose();
    }
  };

  const renderTabs = () => (
    <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 p-4 pb-0">
      <button 
        onClick={() => setActiveTab("general")}
        className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'general' ? 'border-primary text-primary dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
      >
        <Settings size={14} /> Genel
      </button>
      <button 
        onClick={() => setActiveTab("announcements")}
        className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'announcements' ? 'border-primary text-primary dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
      >
        <Volume2 size={14} /> Anons & Bekleme
      </button>
      <button 
        onClick={() => setActiveTab("ivr")}
        className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'ivr' ? 'border-primary text-primary dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
      >
        <PhoneForwarded size={14} /> IVR (Tuşlama)
      </button>
      <button 
        onClick={() => setActiveTab("members")}
        className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'members' ? 'border-primary text-primary dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
      >
        <Users size={14} /> Üyeler & Yöneticiler
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
              <select name="join_announcement" value={formData.join_announcement} onChange={handleChange} className={`w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}>
                <option value="">Anons Seçin...</option>
                {announcementsList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Sıra Anonsu */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">Sıra Anonsu Okuma</h4>
              <p className="text-[10px] text-slate-500">Müşteriye sıradaki pozisyonunu bildirir.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" name="position_announcement_enabled" checked={formData.position_announcement_enabled} onChange={handleChange} className="sr-only peer" />
              <div className={`w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:${bg}`}></div>
            </label>
          </div>
          {formData.position_announcement_enabled && (
            <div className="flex items-center gap-3 mt-2">
              <input type="number" name="position_announcement_interval" value={formData.position_announcement_interval} onChange={handleChange} className={`w-20 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`} />
              <span className="text-xs font-bold text-slate-500">saniyede bir tekrarla</span>
            </div>
          )}
        </div>

        {/* Ortalama Bekleme Süresi */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">Ortalama Bekleme Süresi</h4>
              <p className="text-[10px] text-slate-500">Müşteriye tahmini bekleme süresini bildirir.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" name="estimated_hold_time_enabled" checked={formData.estimated_hold_time_enabled} onChange={handleChange} className="sr-only peer" />
              <div className={`w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:${bg}`}></div>
            </label>
          </div>
          {formData.estimated_hold_time_enabled && (
            <div className="flex items-center gap-3 mt-2">
              <input type="number" name="estimated_hold_time_interval" value={formData.estimated_hold_time_interval} onChange={handleChange} className={`w-20 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`} />
              <span className="text-xs font-bold text-slate-500">saniyede bir tekrarla</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Bekleme Müziği */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/60">
          <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-1">
            <Music size={14} className={text} /> Bekleme Müziği Sınıfı
          </h4>
          <p className="text-[10px] text-slate-500 mb-3">Müşteri sıradayken çalınacak müzik kategorisi.</p>
          <select name="hold_music_class" value={formData.hold_music_class} onChange={handleChange} className={`w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all capitalize`}>
            {holdMusicClasses.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
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
          ...prev.ivr_routes[digit],
          [field]: value
        }
      }
    }));
  };

  const renderIvrTab = () => {
    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

    return (
      <div className="flex flex-col h-[60vh] animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* Header toggle */}
        <div className="p-4 px-6 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">Periyodik Anons & Yönlendirme (IVR)</h4>
            <p className="text-[10px] text-slate-500">Müşteriye sıradayken anons okutup tuşlama ile yönlendirin.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input type="checkbox" name="periodic_announcement_enabled" checked={formData.periodic_announcement_enabled} onChange={handleChange} className="sr-only peer" />
            <div className={`w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:${bg}`}></div>
          </label>
        </div>

        {formData.periodic_announcement_enabled ? (
          <div className="p-6 overflow-y-auto space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Dinletilecek Anons</label>
              <select name="periodic_announcement" value={formData.periodic_announcement} onChange={handleChange} className={`w-full max-w-sm text-sm px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${ring} text-slate-800 dark:text-white transition-all`}>
                <option value="">Anons Seçin...</option>
                {announcementsList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {digits.map(digit => {
                const route = formData.ivr_routes[digit];
                return (
                  <div key={digit} className="flex flex-col gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/20 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-600">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-md ${lightBg} ${text} text-xs font-black flex items-center justify-center shrink-0 shadow-inner`}>
                        {digit}
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tuşu İçin İşlem</span>
                    </div>
                    <div className="flex-1 space-y-2">
                      <select 
                        value={route.type} 
                        onChange={(e) => handleIvrChange(digit, 'type', e.target.value)}
                        className={`w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 ${ring} text-slate-700 dark:text-slate-300 transition-all`}
                      >
                        <option value="">Seçiniz (İşlem Yok)...</option>
                        <option value="return_queue">Kuyruğa Geri Dön</option>
                        <option value="extension">Dahili Numaraya Aktar</option>
                        <option value="queue">Başka Kuyruğa Aktar</option>
                      </select>

                      {route.type === "extension" && (
                        <select 
                          value={route.target} 
                          onChange={(e) => handleIvrChange(digit, 'target', e.target.value)}
                          className={`w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 ${ring} text-slate-700 dark:text-slate-300 transition-all`}
                        >
                          <option value="">Dahili Seçin...</option>
                          {allUsers.map(u => <option key={u.id} value={u.extension}>{u.full_name} ({u.extension})</option>)}
                        </select>
                      )}

                      {route.type === "queue" && (
                        <select 
                          value={route.target} 
                          onChange={(e) => handleIvrChange(digit, 'target', e.target.value)}
                          className={`w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 ${ring} text-slate-700 dark:text-slate-300 transition-all`}
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
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-400 dark:text-slate-600">
            <PhoneForwarded size={48} className="mb-4 opacity-50" />
            <p className="text-sm font-bold">IVR Özelliği Kapalı</p>
            <p className="text-xs mt-1 text-center max-w-sm">Müşterilerinize beklerken anons dinletmek ve tuşlama ile yönlendirmek için özelliği yukarıdan aktif edebilirsiniz.</p>
          </div>
        )}
      </div>
    );
  };

  const getRoleLabel = (roleCode) => {
    const r = systemRoles.find(x => x.role_code === roleCode);
    return r ? r.name : roleCode;
  };

  const renderMembersTab = () => {
    // Member lists
    const unassignedMembers = allUsers.filter(u => !queueMembers.find(qm => qm.user_id === u.id));
    
    // Supervisor lists
    const eligibleSupervisors = allUsers.filter(u => (u.role === "supervisor" || u.role === "admin") && !supervisors.includes(u.id));
    const selectedSupervisors = allUsers.filter(u => supervisors.includes(u.id));

    const toggleMember = (user) => {
      const exists = queueMembers.find(qm => qm.user_id === user.id);
      if (exists) {
        setQueueMembers(prev => prev.filter(qm => qm.user_id !== user.id));
      } else {
        setQueueMembers(prev => [...prev, { user_id: user.id, type: 'dynamic' }]);
      }
    };

    const updateMemberType = (userId, newType) => {
      setQueueMembers(prev => prev.map(qm => qm.user_id === userId ? { ...qm, type: newType } : qm));
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
        
        {/* Sub-Tabs for Members vs Supervisors */}
        <div className="flex p-4 px-6 gap-2 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
          <button 
            onClick={() => setMemberView("agents")}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${memberView === 'agents' ? `${bg} text-white shadow-sm` : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
          >
            Kuyruk Temsilcileri
          </button>
          <button 
            onClick={() => setMemberView("supervisors")}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${memberView === 'supervisors' ? `${bg} text-white shadow-sm` : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
          >
            Kuyruk Yöneticileri (Supervisors)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden p-6 pb-2">
          {/* Sol: Tüm Kullanıcılar */}
          <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                {memberView === "agents" ? "Sistemdeki Kullanıcılar" : "Yönetici Adayları"}
              </h4>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {(memberView === "agents" ? unassignedMembers : eligibleSupervisors).map(u => (
                <div key={u.id} onClick={() => memberView === "agents" ? toggleMember(u) : toggleSupervisor(u)} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                  <img src={u.avatar || `https://ui-avatars.com/api/?name=${u.full_name}&background=random`} alt="" className="w-8 h-8 rounded-lg bg-slate-200 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{u.full_name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{getRoleLabel(u.role)} • {u.extension}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 shrink-0" />
                </div>
              ))}
              {(memberView === "agents" ? unassignedMembers : eligibleSupervisors).length === 0 && <div className="p-4 text-center text-xs text-slate-400">Atanabilecek kullanıcı kalmadı.</div>}
            </div>
          </div>

          {/* Sağ: Seçili Kullanıcılar */}
          <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                {memberView === "agents" ? "Kuyruk Üyeleri" : "Kuyruk Yöneticileri"}
              </h4>
              <span className={`px-2 py-0.5 rounded-lg ${lightBg} ${text} text-[10px] font-bold`}>
                {memberView === "agents" ? queueMembers.length : supervisors.length} Seçili
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              
              {memberView === "agents" && queueMembers.map(qm => {
                const u = allUsers.find(x => x.id === qm.user_id);
                if(!u) return null;
                return (
                  <div key={u.id} className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm transition-all group">
                    <img src={u.avatar || `https://ui-avatars.com/api/?name=${u.full_name}&background=random`} alt="" className="w-8 h-8 rounded-lg bg-slate-200 shrink-0 cursor-pointer" onClick={() => toggleMember(u)} title="Çıkar" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{u.full_name}</p>
                      <select 
                        value={qm.type} 
                        onChange={(e) => updateMemberType(qm.user_id, e.target.value)}
                        className={`mt-1 w-full text-[10px] px-1.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-1 ${ring} text-slate-600 dark:text-slate-300`}
                      >
                        <option value="dynamic">Dinamik (Login olduğunda çağrı alır)</option>
                        <option value="static">Statik (Her zaman çağrı alır)</option>
                      </select>
                    </div>
                    <button onClick={() => toggleMember(u)} className="w-6 h-6 rounded-md hover:bg-rose-50 hover:text-rose-500 text-slate-300 flex items-center justify-center transition-all shrink-0">
                      <X size={12} />
                    </button>
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
            <p className="text-xs text-slate-500 font-medium">ACD kuyruk konfigürasyonu ve üye atamaları</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
            <X size={18} />
          </button>
        </div>

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
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm">
            Vazgeç
          </button>
          <button onClick={handleSave} className={`px-5 py-2.5 text-xs font-bold text-white ${bg} ${hover} rounded-xl shadow-sm transition-all flex items-center gap-2`}>
            <Check size={14} /> {queueData ? "Değişiklikleri Kaydet" : "Kuyruğu Oluştur"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
