import React, { useState, useEffect } from "react";
import { Users, Search, Plus, Trash2, Edit2, CheckCircle, HeadphonesIcon, ShieldAlert } from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import QueueEditModal from "./QueueEditModal";
import { useTheme } from "../../utils/theme";

export default function AcdQueuesPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [success, setSuccess] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });
  const [allUsers, setAllUsers] = useState([]);

  const apiHost = backendHost;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const usersRes = await fetch(`${window.location.protocol}//${apiHost}/api/settings/users`);
        let usersData = [];
        if (usersRes.ok) usersData = await usersRes.json();
        setAllUsers(usersData);

        const queuesRes = await fetch(`${window.location.protocol}//${apiHost}/api/settings/queues`);
        if (queuesRes.ok) {
          const queuesData = await queuesRes.json();
          // Map real names for members and supervisors
          const enrichedQueues = queuesData.map(q => {
            const mList = (q.queueMembers || []).map(qm => {
              const u = usersData.find(x => x.id === qm.user_id);
              return u ? u.full_name : "Bilinmeyen Kullanıcı";
            });
            const sList = (q.supervisors || []).map(sid => {
              const u = usersData.find(x => x.id === sid);
              return u ? u.full_name : "Bilinmeyen Yönetici";
            });
            return {
              ...q,
              members_count: mList.length,
              members_list: mList,
              supervisors_count: sList.length,
              supervisors_list: sList
            };
          });
          setQueues(enrichedQueues);
        }
      } catch (err) {
        console.error("Data fetch error:", err);
      }
    };
    fetchData();
  }, []);

  const handleSaveQueue = async (updatedQueue) => {
    let newQueues;
    if (selectedQueue) {
      // Editing existing
      newQueues = queues.map(q => q.id === updatedQueue.id ? updatedQueue : q);
    } else {
      // Adding new
      newQueues = [...queues, { ...updatedQueue, id: Date.now() }]; // Use proper ID generator in backend but this is sent to save_roles
    }
    
    try {
      const res = await fetch(`${window.location.protocol}//${apiHost}/api/settings/queues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newQueues)
      });
      if (res.ok) {
        const data = await res.json();
        // Re-enrich with names
        const enrichedQueues = data.queues.map(q => {
          const mList = (q.queueMembers || []).map(qm => {
            const u = allUsers.find(x => x.id === qm.user_id);
            return u ? u.full_name : "Bilinmeyen Kullanıcı";
          });
          const sList = (q.supervisors || []).map(sid => {
            const u = allUsers.find(x => x.id === sid);
            return u ? u.full_name : "Bilinmeyen Yönetici";
          });
          return {
            ...q,
            members_count: mList.length,
            members_list: mList,
            supervisors_count: sList.length,
            supervisors_list: sList
          };
        });
        setQueues(enrichedQueues);
      }
    } catch (err) {
      console.error("Queue save error:", err);
    }
    setShowModal(false);
    setSelectedQueue(null);
  };

  const filteredQueues = queues.filter((q) => {
    const query = searchQuery.toLowerCase();
    return (
      q.name?.toLowerCase().includes(query) ||
      q.extension?.toLowerCase().includes(query)
    );
  });

  const strategyLabels = {
    ringall: "Tümünü Çaldır",
    leastrecent: "En Son Çağrı Alan",
    fewestcalls: "En Az Çağrı Yanıtlayan",
    random: "Rastgele",
    rrmemory: "Sıralı Hafızalı"
  };

  return (
    <div className="w-full space-y-6">
      {/* Header and Search & Add Action */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${lightBg} ${text} rounded-xl`}>
            <HeadphonesIcon size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-850 dark:text-white uppercase tracking-wider">ACD KUYRUK YÖNETİMİ</h3>
            <p className="text-[10px] text-slate-505 dark:text-slate-400 mt-0.5 font-medium">
              Çağrı merkezi destek ve satış kuyrukları, temsilci atamaları ve dağıtım stratejilerini yönetin.
            </p>
          </div>
        </div>

        {/* Search Bar + "+" Icon Wrapper */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <input
              type="text"
              placeholder="Kuyruk ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-48 text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
            />
            <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-555`} />
          </div>

          <button
            onClick={() => {
              setSelectedQueue(null);
              setShowModal(true);
            }}
            className={`p-2 ${bg} ${hover} text-white rounded-xl font-bold transition-all shadow-sm flex items-center justify-center h-8 w-8 shrink-0`}
            title="Yeni Kuyruk Ekle"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Status Bar */}
      {success && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/15 border border-emerald-200/50 dark:border-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-pulse">
          <CheckCircle size={14} /> Değişiklikler başarıyla kaydedildi!
        </div>
      )}

      {/* Queues List */}
      {loading ? (
        <div className="text-center py-10 text-xs text-slate-500">Kuyruk listesi yükleniyor...</div>
      ) : filteredQueues.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-slate-500 text-xs">
          Arama kriterine uygun veya kayıtlı kuyruk bulunmuyor.
        </div>
      ) : (
        <div className="space-y-3.5 w-full">
          {/* Column Header Row */}
          <div className="hidden sm:flex items-center justify-between px-4 py-2 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider select-none border-b border-slate-100 dark:border-slate-800/40 pb-2.5">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-12 text-center shrink-0">ID</div>
              <div className="grid grid-cols-12 gap-4 flex-1 items-center">
                <div className="col-span-4">Kuyruk Adı / No</div>
                <div className="col-span-3">Strateji</div>
                <div className="col-span-5">Üyeler & Yöneticiler</div>
              </div>
            </div>
            <div className="w-24 text-right shrink-0">İşlem</div>
          </div>

          {filteredQueues.map((q, index) => (
            <div
              key={q.id}
              className={`p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 hover:scale-[1.005] relative hover:z-50 w-full ${
                !q.is_active ? "opacity-60" : ""
              }`}
            >
              {/* Left Side */}
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 flex items-center justify-center shrink-0">
                  <span 
                    onClick={() => { setSelectedQueue(q); setShowModal(true); }}
                    className="text-[10px] font-black text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-blue-400 font-mono tracking-wider cursor-pointer transition-colors"
                    title="Kuyruğu Düzenle"
                  >
                    {q.extension}
                  </span>
                </div>
                
                <div className="grid grid-cols-12 gap-4 flex-1 items-center">
                  <div className="col-span-4">
                    <h4 
                      onClick={() => { setSelectedQueue(q); setShowModal(true); }}
                      className="font-bold text-xs text-slate-800 dark:text-white truncate cursor-pointer hover:text-primary dark:hover:text-blue-400 transition-colors"
                      title="Kuyruğu Düzenle"
                    >
                      {q.name}
                    </h4>
                  </div>
                  
                  <div className="col-span-3 text-[10px] text-slate-500 dark:text-slate-400 font-bold truncate">
                    {strategyLabels[q.strategy] || q.strategy}
                  </div>

                  <div className="col-span-5 flex items-center gap-4">
                    {/* Temsilciler */}
                    <div className="text-[10px] text-slate-500 dark:text-slate-450 flex items-center gap-2 group relative">
                      <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-bold shrink-0">
                        <Users size={10} /> Temsilciler:
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-extrabold text-slate-700 dark:text-slate-300 text-[9px] shrink-0 cursor-help">
                        {q.members_count || 0} Kişi
                      </span>
                      
                      {/* Tooltip for Members */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-[10px] rounded-lg shadow-xl z-20 pointer-events-none">
                        <p className="font-bold border-b border-slate-200 dark:border-slate-700 pb-1 mb-1">Temsilciler</p>
                        <ul className="space-y-0.5">
                          {q.members_list?.length > 0 ? q.members_list.map((m, i) => <li key={i}>• {m}</li>) : <li className="text-slate-500">Kayıtlı temsilci yok.</li>}
                        </ul>
                      </div>
                    </div>

                    {/* Yöneticiler */}
                    <div className="text-[10px] text-slate-500 dark:text-slate-450 flex items-center gap-2 group relative">
                      <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-bold shrink-0">
                        <ShieldAlert size={10} /> Yöneticiler:
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 font-extrabold text-amber-600 dark:text-amber-400 text-[9px] shrink-0 cursor-help">
                        {q.supervisors_count || 0} Kişi
                      </span>

                      {/* Tooltip for Supervisors */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-[10px] rounded-lg shadow-xl z-20 pointer-events-none">
                        <p className="font-bold text-amber-600 dark:text-amber-400 border-b border-slate-200 dark:border-slate-700 pb-1 mb-1">Yöneticiler</p>
                        <ul className="space-y-0.5">
                          {q.supervisors_list?.length > 0 ? q.supervisors_list.map((m, i) => <li key={i}>• {m}</li>) : <li className="text-slate-500">Kayıtlı yönetici yok.</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Actions */}
              <div className="flex items-center gap-2 justify-between sm:justify-end border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100 dark:border-slate-800/60 w-24 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedQueue(q);
                      setShowModal(true);
                    }}
                    className="p-1.5 text-slate-450 hover:text-slate-700 dark:hover:text-white rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-200"
                    title="Düzenle"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ show: true, id: q.id })}
                    className="p-1.5 text-slate-450 hover:text-rose-500 dark:hover:text-rose-400 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-rose-200"
                    title="Kuyruğu Sil"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <QueueEditModal 
        isOpen={showModal} 
        onClose={() => {
          setShowModal(false);
          setSelectedQueue(null);
        }} 
        onSave={handleSaveQueue}
        queueData={selectedQueue}
        allQueues={queues}
        API_BASE={`${window.location.protocol}//${apiHost}`}
      />

      {/* DELETE MODAL PLACEHOLDER */}
      {deleteConfirm.show && (
        <ConfirmDeleteModal 
            onConfirm={() => setDeleteConfirm({ show: false, id: null })} 
            onCancel={() => setDeleteConfirm({ show: false, id: null })} 
            title="Kuyruğu Sil"
            message="Bu kuyruğu silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        />
      )}
    </div>
  );
}
