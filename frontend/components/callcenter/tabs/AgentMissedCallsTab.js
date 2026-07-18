import React, { useState, useEffect } from "react";
import { PhoneMissed, PhoneCall } from "lucide-react";
import { useTheme } from "../../../utils/theme";

export default function AgentMissedCallsTab({ backendHost, currentUser }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [calls, setCalls] = useState([]);
  
  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Kuyruk - Kayıp Çağrılar</h2>
        <div className={`bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm p-12 text-center`}>
           <PhoneMissed size={32} className="mx-auto text-slate-400 mb-4" />
           <p className="text-slate-500">Bugün kuyrukta kayıp çağrı bulunmuyor.</p>
        </div>
      </div>
    </div>
  );
}
