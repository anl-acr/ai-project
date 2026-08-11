import React, { useState, useEffect } from "react";
import { History, Phone, PhoneIncoming, PhoneOutgoing, Clock, CheckCircle2, XCircle, Play, X, Headphones, User } from "lucide-react";
import { useTheme } from "../../../utils/theme";
import { findContactByPhone } from "../../../utils/contactUtils";

export default function AgentHistoryTab({ backendHost, currentUser }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [calls, setCalls] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeAudio, setActiveAudio] = useState(null);

  const fetchData = async () => {
    try {
      const protocol = window.location.protocol;
      
      // Fetch calls, contacts, and directory in parallel
      const [callsRes, contactsRes, dirRes] = await Promise.all([
        fetch(`${protocol}//${backendHost}/api/calls`),
        fetch(`${protocol}//${backendHost}/api/contacts`),
        fetch(`${protocol}//${backendHost}/api/agent/directory`)
      ]);

      let loadedCalls = [];
      if (callsRes.ok) {
        const data = await callsRes.json();
        const ext = currentUser?.extension || "1000";
        loadedCalls = data.filter(c => c.caller_number === ext || c.callee_number === ext);
      }

      if (contactsRes.ok) {
        const contactsData = await contactsRes.json();
        setContacts(contactsData);
      }

      if (dirRes.ok) {
        const dirData = await dirRes.json();
        setDirectory(dirData);
      }

      setCalls(loadedCalls);
    } catch (err) {
      console.error("Failed to load history tab data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Listen for contacts update event
    const handleContactsUpdated = () => fetchData();
    window.addEventListener('CONTACTS_UPDATED', handleContactsUpdated);
    return () => window.removeEventListener('CONTACTS_UPDATED', handleContactsUpdated);
  }, [backendHost, currentUser]);

  const formatDuration = (secs, startTime, endTime) => {
    let totalSecs = secs;
    if (!totalSecs && startTime && endTime) {
      totalSecs = Math.max(0, Math.floor((new Date(endTime) - new Date(startTime)) / 1000));
    }
    
    if (!totalSecs || totalSecs <= 0) return "0sn";
    const m = Math.floor(totalSecs / 60);
    const s = Math.floor(totalSecs % 60);
    return m > 0 ? `${m}dk ${s}sn` : `${s}sn`;
  };

  const translateStatus = (status) => {
    if (!status) return "Bilinmeyen";
    const s = status.toLowerCase();
    if (s === "completed" || s === "answered") return "Tamamlandı";
    if (s === "in_progress") return "Aktif";
    if (s === "blocked") return "Engellendi";
    if (s === "busy") return "Meşgul";
    if (s === "no_answer" || s === "no answer" || s === "noanswer" || s === "unanswered") return "Yanıtlanmadı";
    if (s === "cancelled" || s === "cancel") return "İptal Edildi";
    if (s === "failed") return "Başarısız";
    return status.toUpperCase();
  };

  const triggerCall = (number) => {
    window.dispatchEvent(new CustomEvent('TRIGGER_CALL', { detail: number }));
  };

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Kişisel Çağrı Geçmişim</h2>
        
        {loading ? (
          <div className={`bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm p-12 text-center`}>
             <History size={32} className="mx-auto text-slate-400 mb-4 animate-bounce" />
             <p className="text-slate-500 font-medium">Çağrı geçmişi yükleniyor...</p>
          </div>
        ) : calls.length === 0 ? (
          <div className={`bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm p-12 text-center animate-in fade-in`}>
             <History size={32} className="mx-auto text-slate-400 mb-4" />
             <p className="text-slate-500 font-medium">Henüz bir çağrı geçmişiniz bulunmuyor.</p>
          </div>
        ) : (
          <div className={`bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm overflow-hidden animate-in fade-in`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="p-4 font-bold">Tarih</th>
                    <th className="p-4 font-bold">Yön</th>
                    <th className="p-4 font-bold">Numara / İsim</th>
                    <th className="p-4 font-bold">Durum</th>
                    <th className="p-4 font-bold">Süre</th>
                    <th className="p-4 font-bold text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {calls.map((call, idx) => {
                    const ext = currentUser?.extension || "1000";
                    const isOutbound = call.caller_number === ext;
                    const contactNumber = isOutbound ? call.callee_number : call.caller_number;
                    const matchedContact = findContactByPhone(contactNumber, contacts, directory);
                    
                    return (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 text-sm text-slate-600 dark:text-slate-300">
                          {new Date(call.start_time + (call.start_time.endsWith('Z') ? '' : 'Z')).toLocaleString("tr-TR")}
                        </td>
                        <td className="p-4">
                          <div className={`flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded-md w-max ${isOutbound ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                            {isOutbound ? <PhoneOutgoing size={12} /> : <PhoneIncoming size={12} />}
                            {isOutbound ? "GİDEN" : "GELEN"}
                          </div>
                        </td>
                        <td className="p-4">
                          {matchedContact ? (
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                                <User size={13} className="text-slate-400 shrink-0" />
                                {matchedContact.displayName}
                              </span>
                              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                                {contactNumber}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200">
                              {contactNumber}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className={`flex items-center gap-1.5 text-xs font-bold uppercase ${call.status === 'completed' || call.status === 'answered' || call.status === 'in_progress' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {call.status === 'completed' || call.status === 'answered' || call.status === 'in_progress' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                            {translateStatus(call.status)}
                          </div>
                        </td>
                        <td className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-1.5 w-max">
                            <Clock size={14} /> {formatDuration(call.duration, call.start_time, call.end_time)}
                          </div>
                        </td>
                        <td className="p-4">
                           <div className="flex items-center justify-end gap-2">
                             <button 
                               onClick={() => triggerCall(contactNumber)}
                               className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors shrink-0"
                               title="Tekrar Ara"
                             >
                               <Phone size={14} />
                             </button>
                             <button 
                             onClick={() => setActiveAudio(call)}
                             className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${activeAudio?.id === call.id ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : !call.recording_path ? 'bg-slate-100 text-slate-400 dark:bg-slate-800/50 dark:text-slate-600 cursor-not-allowed' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                             title={call.recording_path ? "Ses Kaydını Dinle" : "Ses kaydı bulunamadı"}
                             disabled={!call.recording_path}
                           >
                             {activeAudio?.id === call.id ? <Headphones size={14} className="animate-pulse" /> : <Play size={14} />}
                           </button>
                           </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Floating Audio Player */}
      {activeAudio && activeAudio.recording_path && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-950 border border-slate-700 dark:border-slate-800 shadow-2xl rounded-2xl p-4 w-[400px] z-50 flex flex-col gap-3 animate-in slide-in-from-bottom-10 fade-in duration-300`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center shrink-0">
                <Headphones size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-white tracking-wide truncate">
                  Görüşme Kaydı ({activeAudio.caller_number === currentUser?.extension ? activeAudio.callee_number : activeAudio.caller_number})
                </p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{new Date(activeAudio.start_time + (activeAudio.start_time.endsWith('Z') ? '' : 'Z')).toLocaleString("tr-TR")}</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveAudio(null)}
              className="h-8 w-8 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full flex items-center justify-center transition-colors shrink-0"
              title="Kapat"
            >
              <X size={16} />
            </button>
          </div>
          
          <audio 
            src={`${window.location.protocol}//${backendHost}${activeAudio.recording_path}`} 
            controls 
            autoPlay 
            className="w-full h-8 outline-none [&::-webkit-media-controls-panel]:bg-slate-800 [&::-webkit-media-controls-panel]:text-white" 
          />
        </div>
      )}
    </div>
  );
}

