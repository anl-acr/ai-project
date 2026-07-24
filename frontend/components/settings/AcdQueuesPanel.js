import React, { useState, useEffect, useRef } from "react";
import { Users, Search, Plus, Trash2, Edit2, CheckCircle, HeadphonesIcon, ShieldAlert, X, Settings, Download, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import QueueEditModal from "./QueueEditModal";
import { useTheme } from "../../utils/theme";

export default function AcdQueuesPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });
  const [allUsers, setAllUsers] = useState([]);

  const [isColumnSelectOpen, setIsColumnSelectOpen] = useState(false);
  const columnLabels = {
    extension: "Kuyruk Adı / No",
    strategy: "Strateji",
    members: "Üyeler & Yöneticiler"
  };

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem("acdQueuesPanelColumns");
    if (saved) return JSON.parse(saved);
    return { extension: true, strategy: true, members: true };
  });

  const handleToggleColumn = (col) => {
    setVisibleColumns(prev => {
      const updated = { ...prev, [col]: !prev[col] };
      localStorage.setItem("acdQueuesPanelColumns", JSON.stringify(updated));
      return updated;
    });
  };

  const apiHost = backendHost;

  const fetchData = async () => {
    try {
      const usersRes = await fetch(`${window.location.protocol}//${apiHost}/api/settings/users`);
      let usersData = [];
      let usersList = [];
      if (usersRes.ok) {
        const rawUsers = await usersRes.json();
        usersList = Array.isArray(rawUsers) ? rawUsers : (rawUsers?.users || []);
      }
      setAllUsers(usersList);

      const queuesRes = await fetch(`${window.location.protocol}//${apiHost}/api/settings/queues`);
      if (queuesRes.ok) {
        const rawQueues = await queuesRes.json();
        const queuesList = Array.isArray(rawQueues) ? rawQueues : (rawQueues?.queues || []);
        // Map real names for members and supervisors
        const enrichedQueues = queuesList.map(q => {
          const mList = (q.queueMembers || []).map(qm => {
            const u = usersList.find(x => x.id === qm.user_id);
            return u ? u.full_name : "Bilinmeyen Kullanıcı";
          });
          const sList = (q.supervisors || []).map(sid => {
            const u = usersList.find(x => x.id === sid);
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

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveQueue = async (updatedQueue) => {
    let newQueues;
    const safeQueues = Array.isArray(queues) ? queues : [];
    if (selectedQueue) {
      // Editing existing
      newQueues = safeQueues.map(q => q.id === updatedQueue.id ? updatedQueue : q);
    } else {
      // Adding new
      const nextId = safeQueues.length > 0 ? Math.max(...safeQueues.map(q => q.id || 0)) + 1 : 1;
      newQueues = [...safeQueues, { ...updatedQueue, id: nextId }];
    }
    
    try {
      const res = await fetch(`${window.location.protocol}//${apiHost}/api/settings/queues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newQueues)
      });
      if (res.ok) {
        const data = await res.json();
        const resQueues = Array.isArray(data?.queues) ? data.queues : (Array.isArray(data) ? data : newQueues);
        // Re-enrich with names
        const enrichedQueues = resQueues.map(q => {
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

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    const newQueues = queues.filter(q => q.id !== deleteConfirm.id);
    try {
      const res = await fetch(`${window.location.protocol}//${apiHost}/api/settings/queues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newQueues)
      });
      if (res.ok) {
        setQueues(newQueues);
      }
    } catch (err) {
      console.error("Queue delete error:", err);
    }
    setDeleteConfirm({ show: false, id: null });
  };

  const strategyLabels = {
    ringall: "Tümünü Çaldır",
    leastrecent: "En Son Çağrı Alan",
    fewestcalls: "En Az Çağrı Yanıtlayan",
    random: "Rastgele",
    rrmemory: "Sırayla (Hafızalı)",
    linear: "Doğrusal Sıra"
  };

  const fileInputRef = useRef(null);

  const handleExportExcel = () => {
    const data = queues.map(q => ({
      "Kuyruk No": q.extension || "",
      "Kuyruk Adı": q.name || "",
      "Strateji": strategyLabels[q.strategy] || q.strategy || "",
      "Aktif": q.is_active ? "Evet" : "Hayır",
      "Sıra Anonsu": q.announce_position ? "Evet" : "Hayır",
      "Müzik Sınıfı": q.music_on_hold || "",
      "Temsilciler": q.members_list ? q.members_list.join(", ") : "",
      "Yöneticiler": q.supervisors_list ? q.supervisors_list.join(", ") : ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kuyruklar");
    XLSX.writeFile(workbook, "Kuyruklar.xlsx");
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      setLoading(true);
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        let newQueues = [...queues];
        let nextId = queues.length > 0 ? Math.max(...queues.map(q => q.id || 0)) + 1 : 1;

        for (const row of data) {
          const extension = String(row["Kuyruk No"] || "").trim();
          const name = String(row["Kuyruk Adı"] || "").trim();
          if (!extension && !name) continue;

          // Strategy lookup
          let strategy = "ringall";
          const stratName = String(row["Strateji"] || "").trim().toLowerCase();
          const foundStrat = Object.entries(strategyLabels).find(([k, v]) => v.toLowerCase() === stratName || k.toLowerCase() === stratName);
          if (foundStrat) strategy = foundStrat[0];

          // Members parsing
          const membersNames = String(row["Temsilciler"] || "").split(",").map(s => s.trim()).filter(s => s);
          const queueMembers = membersNames.map(mName => {
             const u = allUsers.find(x => x.full_name.toLowerCase() === mName.toLowerCase());
             if (u) return { user_id: u.id, penalty: 0 };
             return null;
          }).filter(x => x !== null);

          // Supervisors parsing
          const supervisorsNames = String(row["Yöneticiler"] || "").split(",").map(s => s.trim()).filter(s => s);
          const supervisors = supervisorsNames.map(sName => {
             const u = allUsers.find(x => x.full_name.toLowerCase() === sName.toLowerCase());
             if (u) return u.id;
             return null;
          }).filter(x => x !== null);

          const payload = {
             extension: extension,
             name: name,
             strategy: strategy,
             is_active: row["Aktif"] === "Evet",
             announce_position: row["Sıra Anonsu"] === "Evet",
             music_on_hold: String(row["Müzik Sınıfı"] || "default"),
             queueMembers: queueMembers,
             supervisors: supervisors
          };

          const existingIndex = newQueues.findIndex(q => (q.extension && String(q.extension) === extension) || (q.name && q.name.toLowerCase() === name.toLowerCase()));
          
          if (existingIndex >= 0) {
             newQueues[existingIndex] = { ...newQueues[existingIndex], ...payload };
          } else {
             newQueues.push({ ...payload, id: nextId });
             nextId++;
          }
        }

        const res = await fetch(`${window.location.protocol}//${apiHost}/api/settings/queues`, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify(newQueues)
        });

        if (res.ok) {
           setError(null);
           setSuccess(true);
           setTimeout(() => setSuccess(false), 5000);
           await fetchData();
        } else {
           setError("Kuyruklar kaydedilirken hata oluştu.");
           setTimeout(() => setError(null), 3000);
        }
      } catch (err) {
        console.error("Excel import error:", err);
        setError("Excel dosyası okunurken bir hata oluştu.");
        setTimeout(() => setError(null), 3000);
      } finally {
        setLoading(false);
      }
      
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsBinaryString(file);
  };

  const filteredQueues = queues.filter((q) => {
    const query = searchQuery.toLowerCase();
    return (
      q.name?.toLowerCase().includes(query) ||
      q.extension?.toLowerCase().includes(query)
    );
  });

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

        {/* Search Bar + Excel + Settings + "+" Icon Wrapper */}
        <div className="flex items-center gap-2.5">
          {isSearchOpen || searchQuery ? (
            <div className="relative animate-in fade-in zoom-in-95 duration-200">
              <input
                autoFocus
                type="text"
                placeholder="Kuyruk ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => {
                  if (!searchQuery) setIsSearchOpen(false);
                }}
                className={`w-48 text-xs pl-8 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
              />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-555" />
              <button 
                onClick={() => { setSearchQuery(""); setIsSearchOpen(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              title="Ara"
            >
              <Search size={16} />
            </button>
          )}

          <input 
            type="file" 
            accept=".xlsx, .xls" 
            ref={fileInputRef}
            className="hidden" 
            onChange={handleImportExcel}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50"
            title="Excel'den İçe Aktar (Import)"
          >
            <Upload size={16} />
          </button>

          <button
            onClick={handleExportExcel}
            className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 border border-transparent hover:border-blue-200 dark:hover:border-blue-800/50"
            title="Excel'e Dışa Aktar (Export)"
          >
            <Download size={16} />
          </button>

          <div className="relative">
            <button
              onClick={() => setIsColumnSelectOpen(!isColumnSelectOpen)}
              className={`p-2 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 border ${isColumnSelectOpen ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}
              title="Sütunlar"
            >
              <Settings size={16} />
            </button>
            {isColumnSelectOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 shadow-xl z-30 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-150">
                <h4 className="font-bold text-[9px] text-slate-400 dark:text-slate-555 uppercase tracking-wider mb-1 px-1">Görünür Sütunlar</h4>
                {Object.keys(columnLabels).map((key) => (
                  <label key={key} className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-350 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/50 p-1.5 rounded-lg transition-colors">
                    <input 
                      type="checkbox"
                      checked={visibleColumns[key]}
                      onChange={() => handleToggleColumn(key)}
                      className="rounded border-slate-300 text-primary focus:ring-primary/50"
                    />
                    <span>{columnLabels[key]}</span>
                  </label>
                ))}
              </div>
            )}
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
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-12 text-center shrink-0 min-w-0">ID</div>
              {visibleColumns.extension && <div className="min-w-0" style={{ flex: '4 4 0%' }}>Kuyruk Adı / No</div>}
              {visibleColumns.strategy && <div className="min-w-0" style={{ flex: '3 3 0%' }}>Strateji</div>}
              {visibleColumns.members && <div className="min-w-0" style={{ flex: '5 5 0%' }}>Üyeler & Yöneticiler</div>}
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
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-12 flex items-center justify-center shrink-0 min-w-0">
                  <span 
                    onClick={() => { setSelectedQueue(q); setShowModal(true); }}
                    className="text-[10px] font-black text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-blue-400 font-mono tracking-wider cursor-pointer transition-colors"
                    title="Kuyruğu Düzenle"
                  >
                    {q.extension}
                  </span>
                </div>
                
                {visibleColumns.extension && (
                  <div className="min-w-0" style={{ flex: '4 4 0%' }}>
                    <h4 
                      onClick={() => { setSelectedQueue(q); setShowModal(true); }}
                      className="font-bold text-xs text-slate-800 dark:text-white truncate cursor-pointer hover:text-primary dark:hover:text-blue-400 transition-colors"
                      title="Kuyruğu Düzenle"
                    >
                      {q.name}
                    </h4>
                  </div>
                )}
                  
                {visibleColumns.strategy && (
                  <div className="min-w-0 text-[10px] text-slate-500 dark:text-slate-400 font-bold truncate" style={{ flex: '3 3 0%' }}>
                    {strategyLabels[q.strategy] || q.strategy}
                  </div>
                )}

                {visibleColumns.members && (
                  <div className="min-w-0 flex items-center gap-4" style={{ flex: '5 5 0%' }}>
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
                )}
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
            isOpen={true}
            onConfirm={handleDeleteConfirm} 
            onClose={() => setDeleteConfirm({ show: false, id: null })} 
            title="Kuyruğu Sil"
            message="Bu kuyruğu silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        />
      )}
    </div>
  );
}
