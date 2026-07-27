import React, { useState, useEffect } from "react";
import { CheckCircle, Save, Key, Eye, EyeOff } from "lucide-react";
import { getApiBaseUrl } from "../../utils/apiHost";

export default function AIProvidersSettings({ backendHost = "localhost:8000" }) {
  const [providers, setProviders] = useState({
    google_api_key: "",
    openai_api_key: "",
    anthropic_api_key: "",
    groq_api_key: "",
    elevenlabs_api_key: ""
  });
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showKeys, setShowKeys] = useState({});

  const API_BASE = getApiBaseUrl(backendHost);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/ai-providers`);
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
      }
    } catch (e) {
      console.error("Failed to load AI providers", e);
    }
  };

  const handleSaveProviders = async () => {
    setLoading(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`${API_BASE}/api/settings/ai-providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(providers)
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error("Failed to save AI providers", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm w-full animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
          <Key size={18} />
        </div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Yapay Zeka API Anahtarları</h3>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 pl-12">Temsilcilerinizi çalıştırabileceğiniz yapay zeka altyapılarına ait API anahtarlarını (API Keys) buradan tanımlayın.</p>
      
      {saveSuccess && (
        <div className="flex items-center gap-2 mb-6 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400 text-xs font-semibold ml-12">
          <CheckCircle size={16} /> Ayarlar başarıyla kaydedildi!
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 ml-12">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Google (Gemini) API Key</label>
          <input 
            type="password" 
            value={providers.google_api_key} 
            onChange={e => setProviders({...providers, google_api_key: e.target.value})}
            className="w-full text-sm px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-purple-500"
            placeholder="AIzaSy..."
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">OpenAI API Key</label>
          <input 
            type="password" 
            value={providers.openai_api_key} 
            onChange={e => setProviders({...providers, openai_api_key: e.target.value})}
            className="w-full text-sm px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-purple-500"
            placeholder="sk-proj-..."
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Anthropic API Key</label>
          <input 
            type="password" 
            value={providers.anthropic_api_key} 
            onChange={e => setProviders({...providers, anthropic_api_key: e.target.value})}
            className="w-full text-sm px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-purple-500"
            placeholder="sk-ant-..."
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Groq API Key</label>
          <input 
            type="password" 
            value={providers.groq_api_key} 
            onChange={e => setProviders({...providers, groq_api_key: e.target.value})}
            className="w-full text-sm px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-purple-500"
            placeholder="gsk_..."
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">ElevenLabs API Key</label>
          <input 
            type="password" 
            value={providers.elevenlabs_api_key} 
            onChange={e => setProviders({...providers, elevenlabs_api_key: e.target.value})}
            className="w-full text-sm px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-purple-500"
            placeholder="sk_..."
          />
        </div>
      </div>
      
      <div className="mt-6 flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800 ml-12">
        <button
          onClick={handleSaveProviders}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 shadow-md transition-all"
        >
          <Save size={16} />
          {loading ? "Kaydediliyor..." : "API Ayarlarını Kaydet"}
        </button>
      </div>
    </div>
  );
}
