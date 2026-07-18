import React, { useState } from "react";
import TranscriptPanel from "../../dashboard/TranscriptPanel";
import AgentSessionCard from "../../phone/AgentSessionCard";
import { Phone, Delete } from "lucide-react";
import { useTheme } from "../../../utils/theme";

export default function AgentWebphoneTab({ backendHost, currentUser, activeCallId }) {
  const { bg, text, borderLight } = useTheme();
  const [dialNumber, setDialNumber] = useState("");

  const handleDial = (num) => setDialNumber(prev => prev + num);
  const handleDelete = () => setDialNumber(prev => prev.slice(0, -1));
  const handleCall = () => {
    if(!dialNumber) return;
    alert(`Aranıyor: ${dialNumber}`);
  };

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 p-6 overflow-y-auto">
      <div className="w-full h-full">
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 flex flex-col gap-6">
            
            {/* Dialpad */}
            <div className={`p-6 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm flex flex-col items-center`}>
              <div className={`w-full bg-slate-50 dark:bg-slate-800/50 border ${borderLight} rounded-xl p-3 mb-6 flex items-center justify-between`}>
                <input 
                  type="text" 
                  value={dialNumber} 
                  readOnly 
                  className="bg-transparent text-2xl font-bold text-center text-slate-800 dark:text-slate-100 w-full outline-none" 
                  placeholder="Numara"
                />
                {dialNumber && (
                  <button onClick={handleDelete} className="text-slate-400 hover:text-rose-500 transition-colors p-1">
                    <Delete size={20} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4 w-full px-2">
                 {[1,2,3,4,5,6,7,8,9,"*",0,"#"].map(num => (
                    <button key={num} onClick={() => handleDial(num)} className={`h-14 rounded-full bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-xl font-bold text-slate-700 dark:text-slate-200 transition-all border ${borderLight} active:scale-95`}>
                      {num}
                    </button>
                 ))}
              </div>
              <button onClick={handleCall} className={`w-full mt-6 py-4 rounded-xl flex items-center justify-center gap-3 text-white font-bold text-lg shadow-lg shadow-emerald-500/20 bg-emerald-500 hover:bg-emerald-600 transition-all active:scale-95`}>
                 <Phone size={22} className="fill-current" /> Ara
              </button>
            </div>
            
          </div>
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="flex justify-end w-full">
              <div className="w-full lg:w-96 shrink-0">
                <AgentSessionCard backendHost={backendHost} currentUser={currentUser} />
              </div>
            </div>
            <TranscriptPanel callId={activeCallId} backendHost={backendHost} />
          </div>
        </div>
      </div>
    </div>
  );
}
