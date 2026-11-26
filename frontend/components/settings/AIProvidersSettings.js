import React, { useState, useEffect } from "react";
import { CheckCircle, Save, Key, Activity, RefreshCw, AlertTriangle } from "lucide-react";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";
import { useTheme } from "../../utils/theme";

export default function AIProvidersSettings({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();
  const [providers, setProviders] = useState({
    google_api_key: "",
    openai_api_key: "",
    anthropic_api_key: "",
    groq_api_key: "",
    elevenlabs_api_key: "",
    deepgram_api_key: "",
    cartesia_api_key: "",
  });
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testingRealtime, setTestingRealtime] = useState(false);
  const [probeResults, setProbeResults] = useState(null);

  const API_BASE = getApiBaseUrl(backendHost);

  useEffect(() => {
    fetchProviders();
    const handleTenantChange = () => fetchProviders();
    window.addEventListener("tenantChanged", handleTenantChange);
    return () => window.removeEventListener("tenantChanged", handleTenantChange);
  }, []);

  const fetchProviders = async () => {
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/ai-providers`);
      if (res.ok) {
        const data = await res.json();
        setProviders((prev) => ({ ...prev, ...(data || {}) }));
      }
    } catch (e) {
      console.error("Failed to load AI providers", e);
    }
  };

  const handleSaveProviders = async () => {
    setLoading(true);
    setSaveSuccess(false);
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/ai-providers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(providers),
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

  const handleTestRealtimeEngines = async () => {
    setTestingRealtime(true);
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/ai-providers/test-realtime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(providers),
      });
      if (res.ok) {
        const data = await res.json();
        setProbeResults(data?.engines || null);
      }
    } catch (e) {
      console.error("Realtime voice engine probe error:", e);
    } finally {
      setTestingRealtime(false);
    }
  };

  const inputCls = `w-full text-sm px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 ${ring}`;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm w-full animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${lightBg} ${text} border ${borderLight}`}>
            <Key size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              Yapay Zeka &amp; Çoklu Realtime Ses Motoru API Anahtarları
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gemini Live, OpenAI Realtime, Deepgram Nova-3 STT, Cartesia Sonic 2 ve ElevenLabs Flash anahtarlarını buradan tanımlayıp canlı gecikmelerini test edin.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleTestRealtimeEngines}
          disabled={testingRealtime}
          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
        >
          {testingRealtime ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} className={text} />}
          <span>Realtime Motorları Test Et</span>
        </button>
      </div>

      {saveSuccess && (
        <div className={`flex items-center gap-2 my-4 p-3 rounded-xl border text-xs font-semibold ${lightBg} ${borderLight} ${text}`}>
          <CheckCircle size={16} /> Ayarlar başarıyla kaydedildi!
        </div>
      )}

      {probeResults && (
        <div className="my-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {[
            { id: "gemini_live", label: "Gemini Live" },
            { id: "openai_realtime", label: "OpenAI Realtime" },
            { id: "deepgram", label: "Deepgram Nova-3" },
            { id: "cartesia", label: "Cartesia Sonic 2" },
            { id: "elevenlabs", label: "ElevenLabs Flash" },
          ].map((item) => {
            const st = probeResults[item.id] || { status: "unconfigured", detail: "Tanımsız" };
            const isOk = st.status === "ok";
            const isErr = st.status === "error";
            return (
              <div
                key={item.id}
                className={`p-3 rounded-xl border text-xs ${
                  isOk
                    ? `${lightBg} ${borderLight}`
                    : isErr
                    ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60"
                    : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between gap-1 font-extrabold text-slate-800 dark:text-white">
                  <span>{item.label}</span>
                  {isOk ? (
                    <span className={`font-mono text-[10px] ${text}`}>{st.latency_ms} ms</span>
                  ) : isErr ? (
                    <AlertTriangle size={13} className="text-rose-500" />
                  ) : (
                    <span className="text-[10px] text-slate-400">Pasif</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate" title={st.detail}>
                  {st.detail}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Google (Gemini Live) API Key
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={providers.google_api_key || ""}
            onChange={(e) => setProviders({ ...providers, google_api_key: e.target.value })}
            className={inputCls}
            placeholder="AIza... (Gemini Multimodal Live & RAG)"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            OpenAI (Realtime API &amp; GPT-4o) API Key
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={providers.openai_api_key || ""}
            onChange={(e) => setProviders({ ...providers, openai_api_key: e.target.value })}
            className={inputCls}
            placeholder="sk-... (gpt-4o-realtime-preview & failover)"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Deepgram (Nova-3 Streaming STT) API Key
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={providers.deepgram_api_key || ""}
            onChange={(e) => setProviders({ ...providers, deepgram_api_key: e.target.value })}
            className={inputCls}
            placeholder="Deepgram API anahtarı (8kHz canlı telefon STT)"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Cartesia (Sonic 2 Ultra-Low Latency TTS) API Key
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={providers.cartesia_api_key || ""}
            onChange={(e) => setProviders({ ...providers, cartesia_api_key: e.target.value })}
            className={inputCls}
            placeholder="Cartesia API anahtarı (40-90ms 8kHz streaming TTS)"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            ElevenLabs (Flash v2.5 Streaming TTS) API Key
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={providers.elevenlabs_api_key || ""}
            onChange={(e) => setProviders({ ...providers, elevenlabs_api_key: e.target.value })}
            className={inputCls}
            placeholder="sk_... (ElevenLabs TTS & Failover)"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Groq (Ultra-Hızlı Llama 3.3 LLM) API Key
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={providers.groq_api_key || ""}
            onChange={(e) => setProviders({ ...providers, groq_api_key: e.target.value })}
            className={inputCls}
            placeholder="gsk_... (Deepgram+Cartesia hattında sub-200ms LLM)"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Anthropic (Claude) API Key
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={providers.anthropic_api_key || ""}
            onChange={(e) => setProviders({ ...providers, anthropic_api_key: e.target.value })}
            className={inputCls}
            placeholder="sk-ant-... (Opsiyonel metin/QA analiz)"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={handleSaveProviders}
          disabled={loading}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white ${bg} ${hover} shadow-md transition-all cursor-pointer disabled:opacity-50`}
        >
          <Save size={16} />
          {loading ? "Kaydediliyor..." : "API Ayarlarını Kaydet"}
        </button>
      </div>
    </div>
  );
}
