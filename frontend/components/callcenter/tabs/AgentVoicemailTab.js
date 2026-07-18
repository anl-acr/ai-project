import React, { useState } from "react";
import { Voicemail, Play } from "lucide-react";
import { useTheme } from "../../../utils/theme";

export default function AgentVoicemailTab({ backendHost, currentUser }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  
  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Sesli Posta Kutusu</h2>
        <div className={`bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm p-12 text-center`}>
           <Voicemail size={32} className="mx-auto text-slate-400 mb-4" />
           <p className="text-slate-500">Sesli posta kutunuz boş.</p>
        </div>
      </div>
    </div>
  );
}
