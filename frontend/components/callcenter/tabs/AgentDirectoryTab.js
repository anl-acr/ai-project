import React, { useState, useEffect } from "react";
import { Users, Search, Phone, Building2, User, PhoneCall, GitBranch, LayoutGrid } from "lucide-react";
import { useTheme } from "../../../utils/theme";

import { getApiBaseUrl } from "../../../utils/apiHost";

export default function AgentDirectoryTab({ backendHost, currentUser }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDirectory();
  }, [backendHost]);

  const fetchDirectory = async () => {
    try {
      setLoading(true);
      const apiBase = getApiBaseUrl(backendHost);
      
      // Fetch data
      const [usersRes, contactsRes, queuesRes, workflowsRes] = await Promise.all([
        fetch(`${apiBase}/api/settings/users`),
        fetch(`${apiBase}/api/contacts`),
        fetch(`${apiBase}/api/settings/queues`),
        fetch(`${apiBase}/api/settings/call-flow/workflows`)
      ]);
      
      const usersData = usersRes.ok ? await usersRes.json() : [];
      const contactsData = contactsRes.ok ? await contactsRes.json() : [];
      const queuesData = queuesRes.ok ? await queuesRes.json() : [];
      const workflowsData = workflowsRes.ok ? await workflowsRes.json() : [];
      
      // Map and merge
      const formattedUsers = (Array.isArray(usersData) ? usersData : (usersData?.users || [])).map(u => ({
        id: `user_${u.id}`,
        name: u.full_name || u.username,
        number: u.extension,
        subtitle: u.role === 'admin' ? "Yönetici" : "Dahili Kullanıcı",
        type: "internal",
        avatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name || u.username)}&background=random`
      }));

      const formattedContacts = (Array.isArray(contactsData) ? contactsData : []).map(c => ({
        id: `contact_${c.id}`,
        name: `${c.first_name} ${c.last_name}`,
        number: c.phone_number,
        subtitle: c.company || c.group || "Dış Rehber",
        type: "external",
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(c.first_name + ' ' + c.last_name)}&background=random`
      }));

      const formattedQueues = (Array.isArray(queuesData) ? queuesData : (queuesData?.queues || [])).map(q => ({
        id: `queue_${q.id}`,
        name: q.name,
        number: q.extension,
        subtitle: "Çağrı Kuyruğu",
        type: "queue",
        icon: <Users size={20} className="text-purple-500" />
      }));

      const formattedWorkflows = (Array.isArray(workflowsData) ? workflowsData : (workflowsData?.workflows || [])).map(w => ({
        id: `wf_${w.id}`,
        name: w.name,
        number: w.id, // e.g. "wf-1"
        subtitle: "Çağrı Akışı (IVR)",
        type: "workflow",
        icon: <GitBranch size={20} className="text-cyan-500" />
      }));

      // Sort alphabetically by name
      const merged = [...formattedUsers, ...formattedContacts, ...formattedQueues, ...formattedWorkflows]
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      
      setDirectory(merged);
    } catch (error) {
      console.error("Rehber yüklenirken hata oluştu:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDirectory = directory.filter(item => {
    if (!searchQuery) return true; // Boş olduğunda tüm rehberi göster
    const q = searchQuery.toLowerCase();
    return (
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.number && item.number.toLowerCase().includes(q)) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  });


  const triggerCall = (number) => {
    alert(`Aranıyor: ${number}\n\nNot: Gerçek çağrı entegrasyonu MVP aşamasında henüz aktif değildir.`);
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case "internal":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 uppercase tracking-wider">Dahili</span>;
      case "external":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 uppercase tracking-wider">Harici</span>;
      case "queue":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20 uppercase tracking-wider">Kuyruk</span>;
      case "workflow":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-500/20 uppercase tracking-wider">Akış</span>;
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Şirket Rehberi</h2>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Kişi, kuyruk veya numara ara..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-4 py-2.5 rounded-xl border ${borderLight} bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 ${ring} shadow-sm transition-all text-slate-900 dark:text-white`} 
            />
          </div>
        </div>
        
        <div className={`bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm overflow-hidden min-h-[400px]`}>
          {loading ? (
             <div className="flex flex-col items-center justify-center p-20">
               <div className="w-8 h-8 border-4 border-slate-200 border-t-rose-500 rounded-full animate-spin mb-4"></div>
               <p className="text-slate-500 font-medium">Veriler yükleniyor...</p>
             </div>
          ) : !searchQuery ? (
             <div className="flex flex-col items-center justify-center p-20 text-center">
               <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                 <Search size={28} className="text-slate-400" />
               </div>
               <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">Arama Yapın</h3>
               <p className="text-slate-500 max-w-sm mx-auto text-sm">
                 Rehberdeki kişileri, departmanları, çağrı kuyruklarını veya akışları bulmak için yukarıdaki arama kutusunu kullanın.
               </p>
             </div>
          ) : filteredDirectory.length === 0 ? (
             <div className="flex flex-col items-center justify-center p-20 text-center">
               <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                 <LayoutGrid size={28} className="text-slate-400" />
               </div>
               <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">Kayıt Bulunamadı</h3>
               <p className="text-slate-500 max-w-sm mx-auto text-sm">
                 "{searchQuery}" aramasıyla eşleşen bir kişi, kuyruk veya akış bulunamadı.
               </p>
             </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredDirectory.map((contact) => (
                <div key={contact.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-950/30 transition-colors group">
                  <div className="flex items-center gap-4">
                    {contact.avatar ? (
                      <img 
                        src={contact.avatar} 
                        alt={contact.name} 
                        className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shadow-sm flex items-center justify-center">
                        {contact.icon}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-800 dark:text-white leading-tight">{contact.name}</h4>
                        {getTypeBadge(contact.type)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {contact.number}
                        </p>
                        <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline-block">
                          • {contact.subtitle}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => triggerCall(contact.number)}
                    className="h-10 w-10 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white dark:bg-emerald-950/30 dark:hover:bg-emerald-500 dark:text-emerald-400 dark:hover:text-white transition-all shadow-sm opacity-100 md:opacity-0 group-hover:opacity-100"
                    title="Ara"
                  >
                    <Phone size={18} className={contact.type === "internal" || contact.type === "external" ? "" : "fill-current"} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
