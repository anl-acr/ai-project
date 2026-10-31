import React, { useState, useEffect, useCallback } from "react";
import {
  Cpu,
  Server,
  HardDrive,
  ShieldCheck,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Download,
  Terminal,
  Copy,
  Check,
  Sparkles,
  FileAudio,
  FileText,
  Award,
  MessageSquare,
  Database,
  GitBranch,
  Cable,
  Volume2,
  Lock,
  ChevronDown,
  ChevronUp,
  Zap,
  PhoneCall,
  BarChart3,
  Sliders,
} from "lucide-react";
import { useTheme } from "../../utils/theme";

const TASK_CATALOG = [
  {
    id: "call_transcription",
    title: "Çağrı Ses Kaydı Transkripti (.wav → Metin)",
    desc: "İnsan temsilci görüşmeleri bittikten sonra ses kayıtlarını arka planda metne döker.",
    savingBadge: "En Yüksek Tasarruf",
    icon: FileAudio,
    providers: [
      { value: "local_whisper", label: "Yerel / Harici Whisper (Sıfır Token)" },
      { value: "gemini", label: "Google Gemini Multimodal" },
      { value: "groq_whisper", label: "Groq Cloud Whisper" },
      { value: "openai_whisper", label: "OpenAI Whisper API" },
    ],
    defaultModelsByProvider: {
      local_whisper: ["base", "tiny", "small"],
      gemini: ["gemini-2.5-flash", "gemini-2.0-flash"],
      groq_whisper: ["whisper-large-v3-turbo", "whisper-large-v3"],
      openai_whisper: ["whisper-1"],
    },
  },
  {
    id: "call_summary_sentiment",
    title: "Çağrı Özetleme & Duygu Analizi",
    desc: "Raporlardaki 2-3 cümlelik çağrı özetini ve müşteri duygu durumunu (Pozitif/Nötr/Öfkeli) çıkarır.",
    savingBadge: "Yüksek Tasarruf",
    icon: Sparkles,
    providers: [
      { value: "ollama", label: "Yerel / Harici LLM (Ollama - Sıfır Token)" },
      { value: "gemini", label: "Google Gemini" },
      { value: "groq", label: "Groq Cloud" },
      { value: "openai", label: "OpenAI" },
      { value: "anthropic", label: "Anthropic Claude" },
    ],
    defaultModelsByProvider: {
      ollama: ["qwen2.5:1.5b", "qwen2.5:3b", "llama3.2:3b"],
      gemini: ["gemini-2.5-flash", "gemini-2.0-flash"],
      groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
      openai: ["gpt-4o-mini", "gpt-4o"],
      anthropic: ["claude-3-5-haiku-latest"],
    },
  },
  {
    id: "call_qa_scoring",
    title: "Sesli Çağrı Kalite Kontrol (Auto-QA & Koçluk)",
    desc: "Görüşme transkriptini kalite kurallarına göre 100 üzerinden puanlar ve koçluk raporu yazar.",
    savingBadge: "Yüksek Tasarruf",
    icon: Award,
    providers: [
      { value: "ollama", label: "Yerel / Harici LLM (Ollama - Sıfır Token)" },
      { value: "gemini", label: "Google Gemini" },
      { value: "groq", label: "Groq Cloud" },
      { value: "openai", label: "OpenAI" },
      { value: "anthropic", label: "Anthropic Claude" },
    ],
    defaultModelsByProvider: {
      ollama: ["qwen2.5:1.5b", "qwen2.5:3b", "llama3.2:3b"],
      gemini: ["gemini-2.5-flash", "gemini-2.0-flash"],
      groq: ["llama-3.3-70b-versatile"],
      openai: ["gpt-4o-mini"],
      anthropic: ["claude-3-5-haiku-latest"],
    },
  },
  {
    id: "chat_qa_scoring",
    title: "Yazılı Sohbet Kalite Kontrol (Chat Auto-QA)",
    desc: "Kapanan WhatsApp / Omnichannel yazılı sohbetlerini kalite kriterlerine göre puanlar.",
    savingBadge: "Orta Tasarruf",
    icon: MessageSquare,
    providers: [
      { value: "ollama", label: "Yerel / Harici LLM (Ollama - Sıfır Token)" },
      { value: "gemini", label: "Google Gemini" },
      { value: "groq", label: "Groq Cloud" },
      { value: "openai", label: "OpenAI" },
      { value: "anthropic", label: "Anthropic Claude" },
    ],
    defaultModelsByProvider: {
      ollama: ["qwen2.5:1.5b", "qwen2.5:3b"],
      gemini: ["gemini-2.5-flash"],
      groq: ["llama-3.3-70b-versatile"],
      openai: ["gpt-4o-mini"],
      anthropic: ["claude-3-5-haiku-latest"],
    },
  },
  {
    id: "rag_embeddings",
    title: "Bilgi Bankası (RAG) Doküman Vektörleme (768d)",
    desc: "PDF, Web sitesi ve metinleri PostgreSQL pgvector veritabanı için 768 boyutlu vektöre çevirir.",
    savingBadge: "Sıfır Token Uygun",
    icon: Database,
    providers: [
      { value: "ollama", label: "Yerel / Harici Ollama Embedding (nomic-embed-text)" },
      { value: "gemini", label: "Google Gemini Embedding" },
      { value: "openai", label: "OpenAI Embedding (768d)" },
    ],
    defaultModelsByProvider: {
      ollama: ["nomic-embed-text"],
      gemini: ["models/gemini-embedding-001"],
      openai: ["text-embedding-3-small"],
    },
  },
  {
    id: "rag_knowledge_synthesis",
    title: "Mobil Aktarım Fısıltı & Ön-Özet Sentezi",
    desc: "Çağrı GSM cep telefonuna aktarılırken temsilciye okunacak 10 kelimelik hızlı özeti hazırlar.",
    savingBadge: "Düşük/Orta",
    icon: FileText,
    providers: [
      { value: "ollama", label: "Yerel / Harici LLM (Ollama)" },
      { value: "gemini", label: "Google Gemini" },
      { value: "groq", label: "Groq Cloud" },
      { value: "openai", label: "OpenAI" },
    ],
    defaultModelsByProvider: {
      ollama: ["qwen2.5:1.5b", "qwen2.5:3b"],
      gemini: ["gemini-2.5-flash"],
      groq: ["llama-3.1-8b-instant"],
      openai: ["gpt-4o-mini"],
    },
  },
  {
    id: "scenario_generator",
    title: "Görsel Çağrı Senaryosu Üretici (NLP → Akış)",
    desc: "Doğal dilde yazılan senaryo tarifini görsel IVR / AI düğümlerine dönüştürür.",
    savingBadge: "İsteğe Bağlı",
    icon: GitBranch,
    providers: [
      { value: "gemini", label: "Google Gemini (Karmaşık JSON İçin Önerilen)" },
      { value: "ollama", label: "Yerel / Harici LLM (Ollama)" },
      { value: "openai", label: "OpenAI" },
      { value: "groq", label: "Groq Cloud" },
      { value: "anthropic", label: "Anthropic Claude" },
    ],
    defaultModelsByProvider: {
      gemini: ["gemini-2.5-flash", "gemini-2.0-flash"],
      ollama: ["qwen2.5:3b", "qwen2.5:1.5b"],
      openai: ["gpt-4o-mini", "gpt-4o"],
      groq: ["llama-3.3-70b-versatile"],
      anthropic: ["claude-3-5-haiku-latest"],
    },
  },
  {
    id: "api_wizard_assistant",
    title: "Evrensel API & Webhook Sihirbazı Asistanı",
    desc: "Yönetim panelinde cURL ve CRM entegrasyon sorularını yanıtlayan teknik yardımcı.",
    savingBadge: "İsteğe Bağlı",
    icon: Cable,
    providers: [
      { value: "ollama", label: "Yerel / Harici LLM (Ollama)" },
      { value: "gemini", label: "Google Gemini" },
      { value: "openai", label: "OpenAI" },
      { value: "groq", label: "Groq Cloud" },
      { value: "anthropic", label: "Anthropic Claude" },
    ],
    defaultModelsByProvider: {
      ollama: ["qwen2.5:1.5b", "qwen2.5:3b"],
      gemini: ["gemini-2.5-flash"],
      openai: ["gpt-4o-mini"],
      groq: ["llama-3.3-70b-versatile"],
      anthropic: ["claude-3-5-haiku-latest"],
    },
  },
  {
    id: "custom_report_generator",
    title: "Özel Rapor Üretici (NLP → Rapor)",
    desc: "Doğal dilde veya sesli dikte ile tarif edilen analiz isteğini özel rapor sorgusuna ve grafiğe dönüştürür.",
    savingBadge: "Yerel / Cloud Seçilebilir",
    icon: BarChart3,
    providers: [
      { value: "gemini", label: "Google Gemini (Önerilen)" },
      { value: "ollama", label: "Yerel / Harici LLM (Ollama - Sıfır Token)" },
      { value: "openai", label: "OpenAI" },
      { value: "groq", label: "Groq Cloud" },
      { value: "anthropic", label: "Anthropic Claude" },
    ],
    defaultModelsByProvider: {
      gemini: ["gemini-2.5-flash", "gemini-2.0-flash"],
      ollama: ["qwen2.5:3b", "qwen2.5:1.5b", "llama3.2:3b"],
      openai: ["gpt-4o-mini", "gpt-4o"],
      groq: ["llama-3.3-70b-versatile"],
      anthropic: ["claude-3-5-haiku-latest"],
    },
  },
  {
    id: "pbx_config_assistant",
    title: "AI Konfigürasyon Asistanı",
    desc: "Doğal dil ve sesli dikte komutlarıyla dahili, kuyruk, konferans, yönlendirme ve kural taslak planı hazırlar.",
    savingBadge: "Yerel / Cloud Seçilebilir",
    icon: Sliders,
    providers: [
      { value: "gemini", label: "Google Gemini (Karmaşık Planlama İçin Önerilen)" },
      { value: "ollama", label: "Yerel / Harici LLM (Ollama - Sıfır Token)" },
      { value: "openai", label: "OpenAI" },
      { value: "groq", label: "Groq Cloud" },
      { value: "anthropic", label: "Anthropic Claude" },
    ],
    defaultModelsByProvider: {
      gemini: ["gemini-2.5-flash", "gemini-2.0-flash"],
      ollama: ["qwen2.5:3b", "qwen2.5:1.5b", "llama3.2:3b"],
      openai: ["gpt-4o-mini", "gpt-4o"],
      groq: ["llama-3.3-70b-versatile"],
      anthropic: ["claude-3-5-haiku-latest"],
    },
  },
  {
    id: "announcement_tts",
    title: "Santral Karşılama & IVR Anons Ses Üretici",
    desc: "Metinden sabit santral karşılama ve bekleme müziği anonsu (.wav) üretir.",
    savingBadge: "Ücretsiz Neural Mevcut",
    icon: Volume2,
    providers: [
      { value: "edge_tts", label: "Microsoft Edge Neural TTS (Ücretsiz / Sıfır Token)" },
      { value: "gemini", label: "Google Gemini 2.5 Native TTS" },
      { value: "elevenlabs", label: "ElevenLabs Multilingual v2" },
    ],
    defaultModelsByProvider: {
      edge_tts: ["tr-TR-EmelNeural", "tr-TR-AhmetNeural", "en-US-AriaNeural"],
      gemini: ["Aoede (Dişi - Türkçe / İngilizce)", "Kore (Dişi - Enerjik)", "Charon (Erkek - Kurumsal)"],
      elevenlabs: ["EXAVITQu4vr4xnSDxMaL"],
    },
  },
];

export default function AITaskRoutingSettings() {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();

  const [canRead, setCanRead] = useState(true);
  const [canWrite, setCanWrite] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [statusData, setStatusData] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [pingLoading, setPingLoading] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  const [pullModelName, setPullModelName] = useState("qwen2.5:1.5b");
  const [pullLoading, setPullLoading] = useState(false);
  const [pullMessage, setPullMessage] = useState(null);

  const [taskTestState, setTaskTestState] = useState({});
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState("");

  const [config, setConfig] = useState({
    ollama_base_url: "http://127.0.0.1:11434",
    ollama_api_key: "",
    whisper_mode: "local_python",
    whisper_remote_url: "http://127.0.0.1:8090",
    whisper_remote_api_key: "",
    whisper_model_size: "base",
    max_cpu_threads: 2,
    sequential_queue_enabled: true,
    auto_unload_ram: true,
    pause_during_active_calls: true,
    max_call_wait_seconds: 180,
    cloud_fallback_enabled: true,
    fallback_provider: "gemini",
    fallback_model: "gemini-2.5-flash",
    request_timeout_seconds: 90,
    tasks: {},
  });

  const getTenantHeaders = () => {
    const headers = { "Content-Type": "application/json" };
    if (typeof window !== "undefined") {
      const t = localStorage.getItem("selected_tenant_id") || sessionStorage.getItem("selected_tenant_id");
      if (t) headers["X-Tenant-ID"] = t;
    }
    return headers;
  };

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/settings/ai-task-routing/status", { headers: getTenantHeaders() });
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
      }
    } catch (err) {
      console.error("AI router status error:", err);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        // Resolve role permissions
        const savedUserId =
          typeof window !== "undefined"
            ? localStorage.getItem("current_user_id") || sessionStorage.getItem("current_user_id")
            : "admin";
        if (savedUserId && savedUserId !== "admin") {
          const [uRes, rRes] = await Promise.all([
            fetch("/api/settings/users", { headers: getTenantHeaders() }).catch(() => null),
            fetch("/api/settings/roles", { headers: getTenantHeaders() }).catch(() => null),
          ]);
          if (uRes?.ok && rRes?.ok) {
            const users = await uRes.json();
            const roles = await rRes.json();
            const me = (Array.isArray(users) ? users : []).find(
              (u) => String(u.id) === String(savedUserId) || String(u.extension) === String(savedUserId)
            );
            if (me && me.role !== "admin" && me.role !== "superadmin") {
              const roleObj = (Array.isArray(roles) ? roles : []).find((r) => r.role_code === me.role);
              const perms = roleObj?.permissions || [];
              setCanRead(perms.includes("ai_task_routing:read") || perms.includes("ai_task_routing:write"));
              setCanWrite(perms.includes("ai_task_routing:write"));
            }
          }
        }

        const cfgRes = await fetch("/api/settings/ai-task-routing", { headers: getTenantHeaders() });
        if (cfgRes.ok) {
          const cfgData = await cfgRes.json();
          setConfig((prev) => ({ ...prev, ...cfgData, tasks: { ...(prev.tasks || {}), ...(cfgData.tasks || {}) } }));
        }
        await fetchStatus();
      } catch (e) {
        setErrorMessage("Ayarlar yüklenirken bağlantı hatası oluştu.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [fetchStatus]);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setSaveMessage("");
    setErrorMessage("");
    try {
      const res = await fetch("/api/settings/ai-task-routing", {
        method: "POST",
        headers: getTenantHeaders(),
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setSaveMessage(data.message || "Ayarlar kaydedildi.");
        if (data.config) setConfig(data.config);
        fetchStatus();
        setTimeout(() => setSaveMessage(""), 4000);
      } else {
        setErrorMessage(data.detail || data.message || "Kaydetme başarısız oldu.");
      }
    } catch (err) {
      setErrorMessage("Sunucu ile iletişim kurulamadı.");
    } finally {
      setSaving(false);
    }
  };

  const handlePingOllama = async () => {
    setPingLoading(true);
    setPingResult(null);
    try {
      const firstInstalled = statusData?.ollama?.models?.[0]?.name || "qwen2.5:1.5b";
      const res = await fetch("/api/settings/ai-task-routing/test", {
        method: "POST",
        headers: getTenantHeaders(),
        body: JSON.stringify({
          mode: "ollama_ping",
          model: firstInstalled,
          config,
        }),
      });
      const data = await res.json();
      setPingResult(data);
      fetchStatus();
    } catch (err) {
      setPingResult({ status: "error", message: String(err) });
    } finally {
      setPingLoading(false);
    }
  };

  const handlePullModel = async (targetModel) => {
    const mName = (targetModel || pullModelName || "").trim();
    if (!mName || !canWrite) return;
    setPullLoading(true);
    setPullMessage({ type: "info", text: `'${mName}' modeli Ollama sunucusuna indiriliyor, lütfen bekleyin...` });
    try {
      const res = await fetch("/api/settings/ai-task-routing/pull-model", {
        method: "POST",
        headers: getTenantHeaders(),
        body: JSON.stringify({
          model: mName,
          ollama_base_url: config.ollama_base_url,
          ollama_api_key: config.ollama_api_key,
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setPullMessage({ type: "success", text: data.message });
        fetchStatus();
      } else {
        setPullMessage({ type: "error", text: data.message || "Model indirilemedi." });
      }
    } catch (err) {
      setPullMessage({ type: "error", text: "Bağlantı zaman aşımı veya sunucu hatası." });
    } finally {
      setPullLoading(false);
    }
  };

  const handleTestTask = async (taskId) => {
    setTaskTestState((prev) => ({ ...prev, [taskId]: { loading: true, result: null } }));
    try {
      // Save current selection first if writable so backend tests exact UI selection
      if (canWrite) {
        await fetch("/api/settings/ai-task-routing", {
          method: "POST",
          headers: getTenantHeaders(),
          body: JSON.stringify(config),
        });
      }
      const res = await fetch("/api/settings/ai-task-routing/test", {
        method: "POST",
        headers: getTenantHeaders(),
        body: JSON.stringify({ mode: "task", task_id: taskId }),
      });
      const data = await res.json();
      setTaskTestState((prev) => ({ ...prev, [taskId]: { loading: false, result: data } }));
      fetchStatus();
    } catch (err) {
      setTaskTestState((prev) => ({
        ...prev,
        [taskId]: { loading: false, result: { status: "error", message: String(err) } },
      }));
    }
  };

  const updateTaskField = (taskId, field, value) => {
    setConfig((prev) => {
      const prevTask = prev.tasks?.[taskId] || { provider: "gemini", model: "gemini-2.5-flash", enabled: true };
      let nextModel = prevTask.model;
      if (field === "provider") {
        const meta = TASK_CATALOG.find((t) => t.id === taskId);
        const defaults = meta?.defaultModelsByProvider?.[value] || [];
        if (value === "ollama" && statusData?.ollama?.models?.length > 0 && taskId !== "rag_embeddings") {
          const nonEmbed = statusData.ollama.models.find((m) => !m.name.includes("embed"));
          nextModel = nonEmbed ? nonEmbed.name : defaults[0] || "qwen2.5:1.5b";
        } else if (defaults.length > 0) {
          nextModel = defaults[0];
        }
      }
      return {
        ...prev,
        tasks: {
          ...(prev.tasks || {}),
          [taskId]: {
            ...prevTask,
            [field]: value,
            ...(field === "provider" ? { model: nextModel } : {}),
          },
        },
      };
    });
  };

  const applyRecommendedZeroTokenPreset = () => {
    if (!canWrite) return;
    const preferredOllama =
      statusData?.ollama?.models?.find((m) => !m.name.includes("embed"))?.name ||
      (statusData?.hardware?.is_low_ram_host ? "qwen2.5:1.5b" : "qwen2.5:3b");

    setConfig((prev) => ({
      ...prev,
      tasks: {
        ...(prev.tasks || {}),
        call_transcription: { provider: "local_whisper", model: prev.whisper_model_size || "base", enabled: true },
        call_summary_sentiment: { provider: "ollama", model: preferredOllama, enabled: true },
        call_qa_scoring: { provider: "ollama", model: preferredOllama, enabled: true },
        chat_qa_scoring: { provider: "ollama", model: preferredOllama, enabled: true },
        rag_embeddings: { provider: "ollama", model: "nomic-embed-text", enabled: true },
        rag_knowledge_synthesis: { provider: "ollama", model: preferredOllama, enabled: true },
        scenario_generator: { provider: "gemini", model: "gemini-2.5-flash", enabled: true },
        api_wizard_assistant: { provider: "ollama", model: preferredOllama, enabled: true },
        announcement_tts: { provider: "edge_tts", model: "tr-TR-EmelNeural", enabled: true },
      },
    }));
  };

  const applyAllCloudPreset = () => {
    if (!canWrite) return;
    setConfig((prev) => ({
      ...prev,
      tasks: {
        ...(prev.tasks || {}),
        call_transcription: { provider: "gemini", model: "gemini-2.5-flash", enabled: true },
        call_summary_sentiment: { provider: "gemini", model: "gemini-2.5-flash", enabled: true },
        call_qa_scoring: { provider: "gemini", model: "gemini-2.5-flash", enabled: true },
        chat_qa_scoring: { provider: "gemini", model: "gemini-2.5-flash", enabled: true },
        rag_embeddings: { provider: "gemini", model: "models/gemini-embedding-001", enabled: true },
        rag_knowledge_synthesis: { provider: "gemini", model: "gemini-2.5-flash", enabled: true },
        scenario_generator: { provider: "gemini", model: "gemini-2.5-flash", enabled: true },
        api_wizard_assistant: { provider: "gemini", model: "gemini-2.5-flash", enabled: true },
        announcement_tts: { provider: "edge_tts", model: "tr-TR-EmelNeural", enabled: true },
      },
    }));
  };

  const copyCommand = (cmd, key) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(cmd);
      setCopiedCmd(key);
      setTimeout(() => setCopiedCmd(""), 2000);
    }
  };

  if (!canRead) {
    return (
      <div className={`p-8 rounded-2xl bg-white dark:bg-slate-900 border ${borderLight} text-center space-y-2`}>
        <Lock size={28} className="mx-auto text-slate-400" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Yetkisiz Erişim</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          AI Görev & Model Yönlendirme ayarlarını görüntülemek için <code>ai_task_routing:read</code> yetkisi gereklidir.
        </p>
      </div>
    );
  }

  const hw = statusData?.hardware || { cpu_cores: 4, ram_total_gb: 4, ram_available_gb: 2, is_low_ram_host: true };
  const ollamaInfo = statusData?.ollama || { online: false, models: [] };
  const whisperInfo = statusData?.whisper || { faster_whisper_installed: false };
  const rStats = statusData?.runtime_stats || {};
  const isRemoteIp =
    config.ollama_base_url &&
    !config.ollama_base_url.includes("127.0.0.1") &&
    !config.ollama_base_url.includes("localhost");

  return (
    <form onSubmit={handleSave} className="w-full space-y-6">
      {/* Header Banner */}
      <div className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border ${borderLight} shadow-sm`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className={`p-2 rounded-xl ${lightBg} ${text}`}>
                <Cpu size={18} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                AI Görev & Model Yönlendirme Merkezi (Token Maliyet Optimizasyonu)
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${lightBg} ${text}`}>
                Hibrit Yerel + Bulut AI
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-3xl">
              Gerçek zamanlı hız gerektirmeyen arka plan görevlerini (Çağrı Transkripti, Özet, Duygu Analizi, Auto-QA, RAG Vektörleme) kendi sunucunuzdaki veya harici bir IP adresindeki ücretsiz Yerel AI modellerine yönlendirerek bulut token giderlerinizi sıfıra yaklaştırın.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchStatus}
              disabled={statusLoading}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border ${borderLight} text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 transition`}
            >
              <RefreshCw size={14} className={statusLoading ? "animate-spin" : ""} />
              Durumu Yenile
            </button>
            {canWrite && (
              <button
                type="submit"
                disabled={saving}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white ${bg} ${hover} shadow-sm flex items-center gap-1.5 transition disabled:opacity-50`}
              >
                <CheckCircle2 size={14} />
                {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
              </button>
            )}
          </div>
        </div>

        {/* Scope Clarification Note */}
        <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-start gap-2.5 text-[11px] text-slate-600 dark:text-slate-300">
          <ShieldCheck size={15} className={`${text} shrink-0 mt-0.5`} />
          <div>
            <strong>Gerçek Zamanlı Ses Koruma Notu:</strong> Canlı Sesli AI Temsilci (Voice AI), WhatsApp Canlı Chatbot ve Canlı Simültane Tercüman milisaniyelik tepki süresi gerektirdiği için bu listeden bağımsızdır ve kendi ekranlarından yönetilmeye devam eder.
          </div>
        </div>

        {saveMessage && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 size={15} />
            {saveMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertTriangle size={15} />
            {errorMessage}
          </div>
        )}
      </div>

      {/* Live Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border ${borderLight} shadow-sm space-y-1.5`}>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Sunucu Kaynağı</span>
            <HardDrive size={15} className={text} />
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            {hw.cpu_cores} vCPU • {hw.ram_total_gb} GB RAM
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Boş RAM: {hw.ram_available_gb} GB</span>
            {hw.is_low_ram_host && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
                4GB Koruma Modu
              </span>
            )}
          </div>
        </div>

        <div className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border ${borderLight} shadow-sm space-y-1.5`}>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Ollama LLM Motoru</span>
            <Server size={15} className={ollamaInfo.online ? "text-emerald-500" : "text-slate-400"} />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                ollamaInfo.online ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
              }`}
            />
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {ollamaInfo.online ? "Çevrimiçi (Hazır)" : "Henüz Kurulu Değil / Kapalı"}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {isRemoteIp ? `Harici Sunucu: ${config.ollama_base_url}` : "Yerel Sunucu (127.0.0.1)"} •{" "}
            {ollamaInfo.models?.length || 0} model
          </div>
        </div>

        <div className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border ${borderLight} shadow-sm space-y-1.5`}>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Tek Sıralı Kuyruk & Çağrı Kalkanı</span>
            <PhoneCall size={15} className={text} />
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            {rStats.active_task
              ? `İşleniyor: ${rStats.active_task}`
              : `Boşta (Sırada: ${rStats.queue_waiting || 0})`}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Aktif Çağrı: {statusData?.active_pbx_calls || 0} kanal{" "}
            {rStats.paused_for_active_call ? "• (Çağrı Bitimi Bekleniyor)" : ""}
          </div>
        </div>

        <div className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border ${borderLight} shadow-sm space-y-1.5`}>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Yerel AI Tasarruf Sayacı</span>
            <Zap size={15} className={text} />
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            ~{(rStats.estimated_saved_tokens || 0).toLocaleString("tr-TR")} Token
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Yerel İşlem: {rStats.total_local_jobs || 0} • Bulut Yedekleme: {rStats.total_cloud_fallbacks || 0}
          </div>
        </div>
      </div>

      {/* Connection & Hardware Protection Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: Ollama & Whisper IP / Server Configuration */}
        <fieldset
          disabled={!canWrite}
          className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border ${borderLight} shadow-sm space-y-4`}
        >
          <legend className="text-sm font-bold text-slate-900 dark:text-white px-1 flex items-center gap-2">
            <Server size={16} className={text} />
            1. Yerel veya Harici AI Sunucu Bağlantısı (IP Desteği)
          </legend>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ollama / OpenAI-Uyumlu AI Sunucu Adresi (IP veya URL)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="ollama_base_url"
                  value={config.ollama_base_url || ""}
                  onChange={(e) => setConfig({ ...config, ollama_base_url: e.target.value })}
                  placeholder="http://127.0.0.1:11434 veya http://192.168.1.50:11434"
                  className={`flex-1 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border ${borderLight} text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                />
                <button
                  type="button"
                  onClick={handlePingOllama}
                  disabled={pingLoading}
                  className={`px-3 py-2 rounded-xl text-xs font-bold text-white ${bg} ${hover} flex items-center gap-1.5 shrink-0`}
                >
                  <Play size={13} />
                  {pingLoading ? "Test..." : "Bağlantıyı Test Et"}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Aynı sunucu için <code>http://127.0.0.1:11434</code>, ileride ayrı bir AI sunucusu kurduğunuzda ise <code>http://SUNUCU_IP:11434</code> yazmanız yeterlidir.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Harici AI Sunucu API Anahtarı (İsteğe Bağlı Bearer Token)
              </label>
              <input
                type="password"
                name="ollama_api_key"
                value={config.ollama_api_key || ""}
                onChange={(e) => setConfig({ ...config, ollama_api_key: e.target.value })}
                placeholder="Yerel kullanımda boş bırakabilirsiniz"
                className={`w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border ${borderLight} text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
              />
            </div>

            {pingResult && (
              <div
                className={`p-3 rounded-xl text-xs border ${
                  pingResult.status === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300"
                    : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300"
                }`}
              >
                {pingResult.status === "success" ? (
                  <div>
                    <strong>Bağlantı Başarılı ({pingResult.latency_ms} ms - {pingResult.model_used}):</strong>{" "}
                    {pingResult.preview}
                  </div>
                ) : (
                  <div>
                    <strong>Bağlantı Kurulamadı:</strong> {pingResult.message}
                  </div>
                )}
              </div>
            )}

            {/* Quick Model Puller */}
            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Sunucudaki Ollama Modelleri ({ollamaInfo.models?.length || 0})
                </span>
                <span className="text-[11px] text-slate-500">
                  4 GB RAM için önerilen: <strong>qwen2.5:1.5b</strong> (~980 MB)
                </span>
              </div>

              {ollamaInfo.models?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {ollamaInfo.models.map((m) => (
                    <span
                      key={m.name}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${lightBg} ${text} border ${borderLight}`}
                    >
                      {m.name} {m.size_gb ? `(${m.size_gb} GB)` : ""}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { id: "qwen2.5:1.5b", label: "qwen2.5:1.5b İndir (4GB RAM Önerilen)" },
                  { id: "nomic-embed-text", label: "nomic-embed-text İndir (RAG Vektör)" },
                  { id: "qwen2.5:3b", label: "qwen2.5:3b İndir (8GB+ RAM)" },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={pullLoading || !ollamaInfo.online}
                    onClick={() => handlePullModel(preset.id)}
                    title={ollamaInfo.online ? `${preset.id} modelini indir` : "Önce sunucunuza Ollama kurun"}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border ${borderLight} text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 disabled:opacity-40`}
                  >
                    <Download size={12} />
                    {preset.label}
                  </button>
                ))}
              </div>

              {pullMessage && (
                <div
                  className={`p-2.5 rounded-xl text-[11px] font-medium ${
                    pullMessage.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                      : pullMessage.type === "error"
                      ? "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {pullMessage.text}
                </div>
              )}
            </div>

            {/* Whisper STT Settings */}
            <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Çağrı Kaydı Whisper (STT) Çalışma Modu
                </label>
                <span className="text-[11px] text-slate-500">
                  {whisperInfo.faster_whisper_installed
                    ? "✓ faster-whisper kurulu"
                    : "Sunucuda faster-whisper henüz kurulu değil"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer ${
                    config.whisper_mode === "local_python"
                      ? `${border} ${lightBg} font-bold text-slate-900 dark:text-white`
                      : `${borderLight} text-slate-600 dark:text-slate-400`
                  }`}
                >
                  <input
                    type="radio"
                    name="whisper_mode"
                    value="local_python"
                    checked={config.whisper_mode === "local_python"}
                    onChange={() => setConfig({ ...config, whisper_mode: "local_python" })}
                  />
                  <span>Bu Sunucuda (faster-whisper int8)</span>
                </label>
                <label
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer ${
                    config.whisper_mode === "remote_http"
                      ? `${border} ${lightBg} font-bold text-slate-900 dark:text-white`
                      : `${borderLight} text-slate-600 dark:text-slate-400`
                  }`}
                >
                  <input
                    type="radio"
                    name="whisper_mode"
                    value="remote_http"
                    checked={config.whisper_mode === "remote_http"}
                    onChange={() => setConfig({ ...config, whisper_mode: "remote_http" })}
                  />
                  <span>Harici Whisper Sunucu IP'si</span>
                </label>
              </div>

              {config.whisper_mode === "remote_http" ? (
                <input
                  type="text"
                  name="whisper_remote_url"
                  value={config.whisper_remote_url || ""}
                  onChange={(e) => setConfig({ ...config, whisper_remote_url: e.target.value })}
                  placeholder="http://192.168.1.50:8090"
                  className={`w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border ${borderLight} text-slate-900 dark:text-white`}
                />
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Whisper Model Boyutu:</span>
                  {["tiny", "base", "small"].map((sz) => (
                    <label key={sz} className="flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="whisper_model_size"
                        value={sz}
                        checked={config.whisper_model_size === sz}
                        onChange={() => setConfig({ ...config, whisper_model_size: sz })}
                      />
                      <span>
                        {sz} {sz === "base" ? "(~180MB Önerilen)" : sz === "tiny" ? "(~120MB)" : "(~480MB)"}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </fieldset>

        {/* Right: 4 vCPU / 4 GB RAM Protection Guardrails */}
        <fieldset
          disabled={!canWrite}
          className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border ${borderLight} shadow-sm space-y-4`}
        >
          <legend className="text-sm font-bold text-slate-900 dark:text-white px-1 flex items-center gap-2">
            <ShieldCheck size={16} className={text} />
            2. Donanım & Santral Koruma Kalkanları (4 CPU / 4 GB RAM)
          </legend>

          <div className="space-y-3.5">
            {/* Max CPU Threads */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-white">
                  Maksimum CPU Çekirdek Sınırı (Asterisk Ses Koruması)
                </label>
                <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${lightBg} ${text}`}>
                  En Fazla {config.max_cpu_threads} Çekirdek
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={Math.max(4, hw.cpu_cores || 4)}
                value={config.max_cpu_threads || 2}
                onChange={(e) => setConfig({ ...config, max_cpu_threads: Number(e.target.value) })}
                className="w-full accent-current"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                4 vCPU sunucuda <strong>2 çekirdek</strong> seçildiğinde kalan 2 çekirdek tamamen Asterisk ses paketlerine, PostgreSQL ve Web arayüzüne ayrılır; çağrılarda ses kesilmesi yaşanmaz.
              </p>
            </div>

            {/* Sequential Queue Toggle */}
            <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-white">
                  Tek Sıralı İş Kuyruğu (Single-Worker FIFO • Concurrency = 1)
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Aynı anda 10 çağrı kapansa bile yerel AI işlerini tek tek sıraya dizer; iki modeli asla aynı anda RAM'e yüklemez.
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(config.sequential_queue_enabled)}
                onChange={(e) => setConfig({ ...config, sequential_queue_enabled: e.target.checked })}
                className="mt-1 h-4 w-4 rounded"
              />
            </label>

            {/* Auto Unload RAM Toggle */}
            <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-white">
                  İşlem Bitince RAM'i Anında Boşalt (keep_alive = 0)
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  4 GB RAM'li sunucuda özet veya transkript bittiği saniye modeli RAM'den siler; boşta RAM tüketimi 0 MB olur.
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(config.auto_unload_ram)}
                onChange={(e) => setConfig({ ...config, auto_unload_ram: e.target.checked })}
                className="mt-1 h-4 w-4 rounded"
              />
            </label>

            {/* Pause During Active Calls Toggle */}
            <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-white">
                  Aktif Telefon Görüşmesi Varken Yerel İşleri Beklet
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Santralde canlı görüşme sürerken yerel (127.0.0.1) CPU işlerini bekletir, hat boşalınca çalıştırır. (Harici sunucu IP'si girildiğinde otomatik olarak beklemeden çalışır.)
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(config.pause_during_active_calls)}
                onChange={(e) => setConfig({ ...config, pause_during_active_calls: e.target.checked })}
                className="mt-1 h-4 w-4 rounded"
              />
            </label>

            {/* Cloud Auto-Fallback Toggle */}
            <div className="p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2">
              <label className="flex items-start justify-between gap-3 cursor-pointer">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-white">
                    Yerel AI Cevap Vermezse Bulut AI'a Otomatik Yedekle (Failover)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Yerel AI servisi kapalıysa veya zaman aşımına uğrarsa görev kesintiye uğramaz, yedek bulut modeli devreye girer.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(config.cloud_fallback_enabled)}
                  onChange={(e) => setConfig({ ...config, cloud_fallback_enabled: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded"
                />
              </label>
            </div>
          </div>
        </fieldset>
      </div>

      {/* Task Routing Matrix */}
      <div className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border ${borderLight} shadow-sm space-y-4`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles size={16} className={text} />
              3. Görev Bazlı AI Seçim Tablosu (9 Arka Plan & Yardımcı Görev)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Her görev için dilediğiniz sağlayıcıyı ve modeli bağımsız olarak seçip sağdaki <strong>Test</strong> butonuyla anında deneyebilirsiniz.
            </p>
          </div>

          {canWrite && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={applyRecommendedZeroTokenPreset}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold ${lightBg} ${text} border ${borderLight} hover:opacity-90 transition`}
              >
                ⚡ Önerilen Sıfır-Token (Yerel AI) Şablonunu Uygula
              </button>
              <button
                type="button"
                onClick={applyAllCloudPreset}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${borderLight} text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition`}
              >
                Tümünü Bulut (Gemini) Yap
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-10 text-center text-xs text-slate-500">Yükleniyor...</div>
        ) : (
          <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
            {TASK_CATALOG.map((item) => {
              const IconComp = item.icon;
              const currentTask = config.tasks?.[item.id] || {
                provider: item.providers[0].value,
                model: item.defaultModelsByProvider[item.providers[0].value]?.[0] || "",
              };
              const selectedProv = currentTask.provider || item.providers[0].value;
              const baseSuggestions = item.defaultModelsByProvider[selectedProv] || [];
              const dynamicOllamaNames =
                selectedProv === "ollama" && ollamaInfo.models?.length > 0
                  ? ollamaInfo.models.map((m) => m.name)
                  : [];
              const modelOptions = Array.from(new Set([...dynamicOllamaNames, ...baseSuggestions]));
              const datalistId = `models-${item.id}`;
              const tState = taskTestState[item.id];
              const isZeroToken = ["ollama", "local_whisper", "edge_tts"].includes(selectedProv);

              return (
                <div key={item.id} className="py-4 first:pt-2 last:pb-1 space-y-2">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                    {/* Task Info */}
                    <div className="lg:col-span-5 flex items-start gap-3">
                      <div className={`p-2 rounded-xl ${lightBg} ${text} shrink-0 mt-0.5`}>
                        <IconComp size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isZeroToken
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {isZeroToken ? "0 Token (Ücretsiz)" : item.savingBadge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          {item.desc}
                        </p>
                      </div>
                    </div>

                    {/* Provider Selector */}
                    <div className="lg:col-span-3">
                      <select
                        aria-label={`${item.title} Sağlayıcı`}
                        disabled={!canWrite}
                        value={selectedProv}
                        onChange={(e) => updateTaskField(item.id, "provider", e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border ${borderLight} text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                      >
                        {item.providers.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Model Input with Datalist */}
                    <div className="lg:col-span-3">
                      <input
                        type="text"
                        list={datalistId}
                        aria-label={`${item.title} Model`}
                        disabled={!canWrite}
                        value={currentTask.model || ""}
                        onChange={(e) => updateTaskField(item.id, "model", e.target.value)}
                        placeholder="Model adı..."
                        className={`w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border ${borderLight} text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                      />
                      <datalist id={datalistId}>
                        {modelOptions.map((mOpt) => (
                          <option key={mOpt} value={mOpt} />
                        ))}
                      </datalist>
                    </div>

                    {/* Test Button */}
                    <div className="lg:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleTestTask(item.id)}
                        disabled={tState?.loading}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border ${borderLight} text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 transition`}
                        title="Bu görevi seçili modelle canlı test et"
                      >
                        <Play size={12} />
                        {tState?.loading ? "..." : "Test"}
                      </button>
                    </div>
                  </div>

                  {tState?.result && (
                    <div
                      className={`ml-0 lg:ml-11 p-2.5 rounded-xl text-[11px] border ${
                        tState.result.status === "success"
                          ? "bg-emerald-50/80 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300"
                          : "bg-rose-50/80 dark:bg-rose-950/25 border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300"
                      }`}
                    >
                      {tState.result.status === "success" ? (
                        <div>
                          <strong>
                            ✓ Başarılı ({tState.result.latency_ms} ms • {tState.result.provider_used}/
                            {tState.result.model_used}
                            {tState.result.fallback_used ? " - Bulut Yedek Devrede" : ""}):
                          </strong>{" "}
                          {tState.result.preview}
                        </div>
                      ) : (
                        <div>
                          <strong>✕ Hata ({tState.result.latency_ms || 0} ms):</strong> {tState.result.message}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Collapsible Server Installation Guide (Zero Local Install, Direct Server Setup) */}
      <div className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border ${borderLight} shadow-sm`}>
        <button
          type="button"
          onClick={() => setShowInstallGuide(!showInstallGuide)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${lightBg} ${text}`}>
              <Terminal size={16} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                4. Sunucu Kurulum Komutları (Ubuntu / Debian Linux İçin Tek Komut Scripti)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Yerel AI servislerini doğrudan kendi santral sunucunuza veya harici bir AI sunucusuna kurmak için tıklayın.
              </p>
            </div>
          </div>
          {showInstallGuide ? (
            <ChevronUp size={18} className="text-slate-400" />
          ) : (
            <ChevronDown size={18} className="text-slate-400" />
          )}
        </button>

        {showInstallGuide && (
          <div className="mt-4 pt-4 border-t border-slate-200/70 dark:border-slate-800 space-y-4 text-xs">
            <div className="space-y-1.5">
              <div className="font-bold text-slate-800 dark:text-white">
                Seçenek A: Mevcut Santral Sunucusuna Kurulum (4 vCPU / 4 GB RAM Korumalı Mod - 127.0.0.1)
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ollama servisini <code>OLLAMA_MAX_LOADED_MODELS=1</code> ve <code>OLLAMA_NUM_PARALLEL=1</code> sınırlarıyla kurar, <code>qwen2.5:1.5b</code> (~980 MB), <code>nomic-embed-text</code> ve <code>faster-whisper</code> paketlerini hazırlar:
              </p>
              <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px]">
                <code className="overflow-x-auto">
                  cd /opt/ai-project && sudo bash scripts/install_local_ai_server.sh local
                </code>
                <button
                  type="button"
                  onClick={() =>
                    copyCommand("cd /opt/ai-project && sudo bash scripts/install_local_ai_server.sh local", "local")
                  }
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0"
                  title="Komutu Kopyala"
                >
                  {copiedCmd === "local" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="font-bold text-slate-800 dark:text-white">
                Seçenek B: İleride Harici Bir AI Sunucusuna Kurulum (Ağ Üzerinden IP ile Bağlantı)
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ayrı bir CPU/GPU sunucusunda Ollama'yı <code>0.0.0.0:11434</code> portundan dış bağlantıya açar. Kurulumdan sonra yukarıdaki kutuya o sunucunun IP adresini (<code>http://SUNUCU_IP:11434</code>) yazmanız yeterlidir:
              </p>
              <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px]">
                <code className="overflow-x-auto">
                  sudo bash scripts/install_local_ai_server.sh remote
                </code>
                <button
                  type="button"
                  onClick={() => copyCommand("sudo bash scripts/install_local_ai_server.sh remote", "remote")}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0"
                  title="Komutu Kopyala"
                >
                  {copiedCmd === "remote" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
