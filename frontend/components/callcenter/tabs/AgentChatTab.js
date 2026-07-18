import React, { useState, useEffect } from "react";
import { MessageSquare, Send } from "lucide-react";
import { useTheme } from "../../../utils/theme";

export default function AgentChatTab({ backendHost, currentUser }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  
  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 p-6 flex flex-col items-center">
      <div className="max-w-5xl w-full h-full flex flex-col space-y-4">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Takım İçi Sohbet</h2>
        <div className={`flex-1 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm p-4 flex items-center justify-center`}>
           <div className="text-center">
             <MessageSquare size={32} className="mx-auto text-slate-400 mb-4" />
             <p className="text-slate-500">Sohbet bağlantısı kuruluyor...</p>
           </div>
        </div>
      </div>
    </div>
  );
}
