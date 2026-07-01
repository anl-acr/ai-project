import React, { useState } from "react";
import Head from "next/head";
import { 
  Bot, 
  Database, 
  MessageSquare, 
  Phone, 
  Sliders, 
  Smartphone, 
  Sparkles, 
  Activity, 
  TrendingUp, 
  Layers,
  FileText,
  Calendar
} from "lucide-react";

import dynamic from "next/dynamic";

// Import custom components (with SSR disabled for WebRTC phone client)
const WebRTCIstemci = dynamic(
  () => import("../components/phone/WebRTCIstemci"),
  { ssr: false }
);
import TranscriptPanel from "../components/dashboard/TranscriptPanel";
import PBXSettings from "../components/settings/PBXSettings";
import ChannelSettings from "../components/settings/ChannelSettings";
import KnowledgeBase from "../components/settings/KnowledgeBase";
import RuleEditor from "../components/settings/RuleEditor";
import ReportsPanel from "../components/dashboard/ReportsPanel";
import CalendarPanel from "../components/dashboard/CalendarPanel";
import LiveDashboardPanel from "../components/dashboard/LiveDashboardPanel";

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, call-center, pbx-settings, channel-settings, rag-kb, rule-editor
  const [activeCallId, setActiveCallId] = useState(null);

  const backendHost = "localhost:8000";

  React.useEffect(() => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const sendLog = (level, args) => {
      const message = args.map(arg => {
        if (typeof arg === "object") {
          try { return JSON.stringify(arg); } catch(e) { return String(arg); }
        }
        return String(arg);
      }).join(" ");

      fetch(`http://${backendHost}/api/client-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, message })
      }).catch(() => {});
    };

    console.log = (...args) => {
      originalLog(...args);
      sendLog("log", args);
    };
    console.warn = (...args) => {
      originalWarn(...args);
      sendLog("warn", args);
    };
    console.error = (...args) => {
      originalError(...args);
      sendLog("error", args);
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
      <Head>
        <title>Omnichannel AI Call Center Admin Panel</title>
        <meta name="description" content="AI PBX and Social Messaging dashboard" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4 shrink-0">
        <div className="flex items-center gap-2 px-2 py-4 mb-6 border-b border-slate-800">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
            <Bot size={20} className="animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              COMMUNITY AI
            </h1>
            <p className="text-[10px] text-slate-500 font-medium">OMNICHANNEL PBX</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === "dashboard"
                ? "bg-violet-600/20 text-violet-400 border border-violet-800/40"
                : "text-slate-400 hover:text-white hover:bg-slate-850"
            }`}
          >
            <Activity size={16} className="text-violet-400" />
            <span>Gerçek Zamanlı Pano</span>
          </button>

          <button
            onClick={() => setActiveTab("call-center")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === "call-center"
                ? "bg-purple-600/20 text-purple-400 border border-purple-800/40"
                : "text-slate-400 hover:text-white hover:bg-slate-850"
            }`}
          >
            <Phone size={16} />
            <span>Temsilci Çağrı Paneli</span>
          </button>

          <button
            onClick={() => setActiveTab("pbx-settings")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === "pbx-settings"
                ? "bg-rose-600/20 text-rose-400 border border-rose-800/40"
                : "text-slate-400 hover:text-white hover:bg-slate-850"
            }`}
          >
            <Layers size={16} />
            <span>Santral Entegrasyonu</span>
          </button>

          <button
            onClick={() => setActiveTab("channel-settings")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === "channel-settings"
                ? "bg-pink-600/20 text-pink-400 border border-pink-800/40"
                : "text-slate-400 hover:text-white hover:bg-slate-850"
            }`}
          >
            <Smartphone size={16} />
            <span>Kanal Entegrasyonları</span>
          </button>

          <button
            onClick={() => setActiveTab("rag-kb")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === "rag-kb"
                ? "bg-blue-600/20 text-blue-400 border border-blue-800/40"
                : "text-slate-400 hover:text-white hover:bg-slate-850"
            }`}
          >
            <Database size={16} />
            <span>Bilgi Bankası (RAG)</span>
          </button>

          <button
            onClick={() => setActiveTab("rule-editor")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === "rule-editor"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-800/40"
                : "text-slate-400 hover:text-white hover:bg-slate-850"
            }`}
          >
            <Sliders size={16} />
            <span>Kural & Senaryo Editörü</span>
          </button>

          <button
            onClick={() => setActiveTab("reports")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === "reports"
                ? "bg-emerald-600/20 text-emerald-400 border border-emerald-800/40"
                : "text-slate-400 hover:text-white hover:bg-slate-850"
            }`}
          >
            <FileText size={16} />
            <span>Çağrı Raporları & Analiz</span>
          </button>

          <button
            onClick={() => setActiveTab("calendar")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === "calendar"
                ? "bg-amber-600/20 text-amber-400 border border-amber-800/40"
                : "text-slate-400 hover:text-white hover:bg-slate-850"
            }`}
          >
            <Calendar size={16} />
            <span>Randevu Takvimi</span>
          </button>
        </nav>

        {/* Footer info */}
        <div className="border-t border-slate-800 pt-4 text-[10px] text-slate-500 space-y-1">
          <p className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            Sistem Çevrimiçi
          </p>
          <p>Local PBX: 127.0.0.1:9092</p>
          <p>Version 1.0.0 (On-Premise)</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        
        {/* Top Header Navbar */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-950/40 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <span className="text-slate-500 font-medium text-xs tracking-wider">AKTİF İŞLEMLER</span>
            <div className="h-4 w-[1px] bg-slate-800"></div>
            {activeCallId ? (
              <span className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping"></span>
                Görüşme Aktif (ID: {activeCallId})
              </span>
            ) : (
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-600"></span>
                Arama Bekleniyor
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
            <div className="flex items-center gap-1.5">
              <Activity size={14} className="text-purple-400" />
              <span>Asterisk: <b className="text-emerald-400 font-bold">AMI OK</b></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-indigo-400 animate-pulse" />
              <span>Gemini: <b className="text-emerald-400 font-bold">Live API OK</b></span>
            </div>
          </div>
        </header>

        {/* Dynamic View Panel */}
        <div className="flex-1 p-8 overflow-y-auto flex justify-center">
          {activeTab === "call-center" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-6xl">
              <div className="lg:col-span-1 flex flex-col gap-6">
                {/* Stats Info Widget */}
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                  <h4 className="font-bold text-xs mb-3 flex items-center gap-2">
                    <TrendingUp size={14} className="text-purple-400" />
                    Bugünkü Çağrı İstatistikleri
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-850">
                      <p className="text-xs text-slate-500">Yapay Zeka</p>
                      <p className="text-lg font-bold text-white mt-1">24</p>
                    </div>
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-850">
                      <p className="text-xs text-slate-500">Temsilciye</p>
                      <p className="text-lg font-bold text-amber-400 mt-1">5</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transcript view Panel (2/3 width) */}
              <div className="lg:col-span-2">
                <TranscriptPanel callId={activeCallId} backendHost={backendHost} />
              </div>
            </div>
          )}

          {activeTab === "pbx-settings" && (
            <PBXSettings backendHost={backendHost} />
          )}

          {activeTab === "channel-settings" && (
            <ChannelSettings backendHost={backendHost} />
          )}

          {activeTab === "rag-kb" && (
            <KnowledgeBase backendHost={backendHost} />
          )}

          {activeTab === "rule-editor" && (
            <RuleEditor backendHost={backendHost} />
          )}

          {activeTab === "reports" && (
            <ReportsPanel backendHost={backendHost} />
          )}

          {activeTab === "calendar" && (
            <CalendarPanel backendHost={backendHost} />
          )}

          {activeTab === "dashboard" && (
            <LiveDashboardPanel backendHost={backendHost} />
          )}
        </div>

        {/* Floating WebRTC Phone client widget */}
        <div className="fixed bottom-6 right-6 z-50 shadow-2xl">
          <WebRTCIstemci 
            agentExtension="200" 
            password="temsilci_sifre_321" 
            asteriskWssUrl="wss://localhost:8089/ws"
            onActiveCall={(callId) => setActiveCallId(callId)}
          />
        </div>
      </main>
    </div>
  );
}
