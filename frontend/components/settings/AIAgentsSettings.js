import React, { useState, useEffect } from "react";
import { 
  Bot, 
  Plus, 
  Trash2, 
  Edit, 
  Edit2,
  Cpu,
  Search,
  ArrowLeft, 
  Save, 
  Volume2, 
  Sliders, 
  FileText, 
  Layers, 
  CheckCircle,
  HelpCircle,
  Play,
  Pause,
  RefreshCw,
  AlertTriangle,
  X
} from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

export default function AIAgentsSettings({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight, colorCode } = useTheme();
  const [activeTab, setActiveTab] = useState("agents"); // agents, api
  const [viewMode, setViewMode] = useState("list"); // list, edit
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);


  // API Providers States
  const [providers, setProviders] = useState({
    google_api_key: "",
    openai_api_key: "",
    anthropic_api_key: "",
    groq_api_key: ""
  });
  const [apiSaveSuccess, setApiSaveSuccess] = useState(false);

  // Form States for current agent
  const [agentId, setAgentId] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentVoice, setAgentVoice] = useState("Aoede (Dişi - Türkçe / İngilizce)");
  const [agentTone, setAgentTone] = useState("normal"); // normal, calm, attractive, firm
  const [agentProvider, setAgentProvider] = useState("google");
  const [llmProvider, setLlmProvider] = useState("google");
  const [ttsProvider, setTtsProvider] = useState("google");
  const [agentModel, setAgentModel] = useState("models/gemini-2.5-flash-native-audio-latest");
  const [agentTemperature, setAgentTemperature] = useState(0.7);
  const [agentMaxTokens, setAgentMaxTokens] = useState(300);
  const [agentInstruction, setAgentInstruction] = useState("");
  const [agentGreetingPrompt, setAgentGreetingPrompt] = useState("");
  const [agentStatus, setAgentStatus] = useState("active");
  const [agentTransferTarget, setAgentTransferTarget] = useState("200");
  const [agentElevenLabsId, setAgentElevenLabsId] = useState("");
  const [elevenlabsVoiceId, setElevenlabsVoiceId] = useState("");
  const [elevenlabsStability, setElevenlabsStability] = useState(0.5);
  const [elevenlabsSimilarity, setElevenlabsSimilarity] = useState(0.75);
  const [elevenlabsStyle, setElevenlabsStyle] = useState(0.0);
  const [elevenlabsVoiceList, setElevenlabsVoiceList] = useState([]);

  // TTS Voice Testing states
  const [testText, setTestText] = useState("Merhaba, ben yapay zeka temsilciniz. Size nasıl yardımcı olabilirim?");
  const [ttsLoading, setTtsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioInstance, setAudioInstance] = useState(null);

  // Custom Delete Modal states
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  // LLM Provider options
  const LLM_PROVIDER_OPTIONS = [
    { id: "google", name: "Google Gemini (Multimodal Live)" },
    { id: "elevenlabs", name: "ElevenLabs (Conversational AI)" },
    { id: "openai", name: "OpenAI (GPT-4o / Realtime)" },
    { id: "anthropic", name: "Anthropic (Claude 3.5 Sonnet)" },
    { id: "groq", name: "Groq (Fast LLM)" }
  ];

  // TTS Provider options
  const TTS_PROVIDER_OPTIONS = [
    { id: "google", name: "Google Gemini Dahili Ses Motoru" },
    { id: "elevenlabs", name: "ElevenLabs TTS (Ses Kütüphanesi & Klonlanmış Ses)" }
  ];

  // Gemini Prebuilt Voice options
  const GEMINI_VOICE_OPTIONS = [
    "Aoede (Dişi - Türkçe / İngilizce)",
    "Puck (Erkek - Dinamik)",
    "Charon (Erkek - Tok & Resmi)",
    "Kore (Dişi - Yumuşak)",
    "Fenrir (Erkek - Derin)"
  ];

  const MODEL_OPTIONS = {
    google: [
      "models/gemini-2.5-flash-native-audio-latest",
      "gemini-2.0-flash-exp",
      "gemini-1.5-flash",
      "gemini-1.5-pro"
    ],
    openai: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo"
    ],
    anthropic: [
      "claude-3-5-sonnet-20240620",
      "claude-3-haiku-20240307"
    ],
    groq: [
      "llama3-8b-8192",
      "llama3-70b-8192",
      "mixtral-8x7b-32768"
    ],
    elevenlabs: [
      "eleven_convai_agent",
      "eleven_multilingual_v2",
      "eleven_turbo_v2_5",
      "eleven_flash_v2_5"
    ]
  };

  const DEFAULT_ELEVENLABS_VOICES = [
    { voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel (Female - Conversational)" },
    { voice_id: "AZnzlk1XvdvUeBnXmlld", name: "Domi (Female - Energetic)" },
    { voice_id: "EXAVITQu4vr4xnSDxMaL", name: "Bella (Female - Professional)" },
    { voice_id: "ErXwobaYiN019PkySvjV", name: "Antoni (Male - Professional)" },
    { voice_id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli (Female - Emotional)" },
    { voice_id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh (Male - Deep & Trustworthy)" },
    { voice_id: "VR6AewLTigWG4xSOukaG", name: "Arnold (Male - Authoritative)" },
    { voice_id: "pNInz6obpgDQGcFmaJgB", name: "Adam (Male - Conversational)" },
    { voice_id: "yoZ06aGfZXsp3F3Dfd0g", name: "Sam (Male - Dynamic)" },
    { voice_id: "JBFqnCBsd6RMkjVDRZzb", name: "George (Male - Warm & Friendly)" }
  ];

  const fetchProviders = () => {
    fetch(`${API_BASE}/api/settings/ai-providers`)
      .then((res) => res.json())
      .then((data) => {
        if (data) setProviders(data);
      })
      .catch((err) => console.error("[AI-Providers] Load error:", err));
  };

  const fetchElevenLabsVoices = () => {
    fetch(`${API_BASE}/api/settings/ai-providers/elevenlabs-voices`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.voices) setElevenlabsVoiceList(data.voices);
      })
      .catch((err) => console.error("[ElevenLabs-Voices] Load error:", err));
  };

  const fetchAgents = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/settings/ai-agents`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setAgents(data);
      })
      .catch((err) => console.error("[AI-Agents] Load error:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAgents();
    fetchProviders();
    fetchElevenLabsVoices();
  }, []);

  const handleCreateNewAgent = () => {
    setError("");
    setAgentId(`agent-${Date.now()}`);
    setAgentName("Yeni Yapay Zeka Asistanı");
    setAgentVoice("Aoede (Dişi - Türkçe / İngilizce)");
    setAgentTone("normal");
    setLlmProvider("google");
    setTtsProvider("google");
    setAgentProvider("google");
    setAgentModel("models/gemini-2.5-flash-native-audio-latest");
    setAgentTemperature(0.7);
    setAgentMaxTokens(300);
    setAgentInstruction("Sen yardımsever bir müşteri temsilcisisin.");
    setAgentGreetingPrompt("Merhaba, ben yeni yapay zeka temsilciniz. Size nasıl yardımcı olabilirim?");
    setAgentStatus("active");
    setAgentTransferTarget("200");
    setAgentElevenLabsId("");
    setElevenlabsVoiceId("");
    setElevenlabsStability(0.5);
    setElevenlabsSimilarity(0.75);
    setElevenlabsStyle(0.0);
    setTestText("Merhaba, ben yeni yapay zeka temsilciniz. Size nasıl yardımcı olabilirim?");
    
    setViewMode("edit");
  };

  const handleEditAgent = (agent) => {
    setError("");
    setAgentId(agent.id);
    setAgentName(agent.name);
    
    const resolvedLlm = agent.llm_provider || agent.provider || "google";
    const resolvedTts = agent.tts_provider || (agent.provider === "elevenlabs" || agent.elevenlabs_voice_id ? "elevenlabs" : "google");

    setLlmProvider(resolvedLlm);
    setTtsProvider(resolvedTts);
    setAgentProvider(resolvedLlm);
    setAgentVoice(agent.voice || "Aoede (Dişi - Türkçe / İngilizce)");
    setAgentTone(agent.tone || "normal");
    setAgentModel(agent.model);
    setAgentTemperature(agent.temperature);
    setAgentMaxTokens(agent.max_tokens);
    setAgentInstruction(agent.system_instruction);
    setAgentGreetingPrompt(agent.greeting_prompt || "");
    setAgentStatus(agent.status);
    setAgentTransferTarget(agent.transfer_target || "200");
    setAgentElevenLabsId(agent.elevenlabs_agent_id || "");
    setElevenlabsVoiceId(agent.elevenlabs_voice_id || "");
    setElevenlabsStability(agent.elevenlabs_stability !== undefined ? agent.elevenlabs_stability : 0.5);
    setElevenlabsSimilarity(agent.elevenlabs_similarity !== undefined ? agent.elevenlabs_similarity : 0.75);
    setElevenlabsStyle(agent.elevenlabs_style !== undefined ? agent.elevenlabs_style : 0.0);
    
    // Set matching voice test sentence
    setTestText(agent.greeting_prompt || `Merhaba, ben yapay zeka temsilciniz ${agent.name}. Size nasıl yardımcı olabilirim?`);

    setViewMode("edit");
  };

  const handleSaveAgent = async () => {
    setError("");
    const aName = agentName.trim();

    if (!aName) {
      setError("Lütfen Yapay Zeka Asistanı Adı giriniz.");
      return;
    }

    // Client-side duplicate check for Agent Name
    const dupAgent = (agents || []).find(
      a => String(a.name || "").trim().toLowerCase() === aName.toLowerCase() && (!agentId || String(a.id) !== String(agentId))
    );
    if (dupAgent) {
      setError(`'${aName}' isimli Yapay Zeka Asistanı zaten mevcut. Lütfen farklı bir isim giriniz.`);
      return;
    }

    setLoading(true);

    const payload = {
      id: agentId,
      name: aName,
      voice: ttsProvider === "elevenlabs" ? (elevenlabsVoiceId || "ElevenLabs Custom Voice") : agentVoice,
      tone: agentTone,
      provider: llmProvider,
      llm_provider: llmProvider,
      tts_provider: ttsProvider,
      model: agentModel,
      temperature: parseFloat(agentTemperature) || 0.7,
      max_tokens: parseInt(agentMaxTokens) || 300,
      system_instruction: agentInstruction,
      greeting_prompt: agentGreetingPrompt,
      status: agentStatus,
      transfer_target: agentTransferTarget,
      elevenlabs_agent_id: agentElevenLabsId,
      elevenlabs_voice_id: elevenlabsVoiceId,
      elevenlabs_stability: elevenlabsStability,
      elevenlabs_similarity: elevenlabsSimilarity,
      elevenlabs_style: elevenlabsStyle
    };

    try {
      const res = await fetch(`${API_BASE}/api/settings/ai-agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          setViewMode("list");
          fetchAgents();
        }, 1200);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.detail || "Yapay zeka asistanı kaydedilirken hata oluştu.");
      }
    } catch (err) {
      console.error("[AI-Agents] Save error:", err);
      setError("Bağlantı hatası oluştu. Lütfen tekrar deneyiniz.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setError("");
    // Stop audio if playing
    if (audioInstance) {
      audioInstance.pause();
      setIsPlaying(false);
    }
    setViewMode("list");
    fetchAgents();
  };


  const handleSaveProviders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/ai-providers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(providers)
      });
      if (res.ok) {
        setApiSaveSuccess(true);
        setTimeout(() => setApiSaveSuccess(false), 2000);
      }
    } catch (err) {
      console.error("[AI-Providers] Save error:", err);
    } finally {
      setLoading(false);
    }
  };



  const openDeleteModal = (e, id) => {
    e.stopPropagation();
    setDeleteTargetId(id);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await fetch(`${API_BASE}/api/settings/ai-agents/${deleteTargetId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchAgents();
      }
    } catch (err) {
      console.error("[AI-Agents] Delete error:", err);
    } finally {
      setIsDeleteModalOpen(false);
      setDeleteTargetId(null);
    }
  };

  // Perform TTS testing synthesis
  const handleTestTtsVoice = async () => {
    if (!testText) return;

    // If audio is already playing, stop it
    if (isPlaying && audioInstance) {
      audioInstance.pause();
      setIsPlaying(false);
      return;
    }

    setTtsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/ai-agents/tts-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: testText, voice: agentVoice, tone: agentTone })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        
        setAudioInstance(audio);
        setIsPlaying(true);
        
        audio.play();
        audio.onended = () => {
          setIsPlaying(false);
        };
      } else {
        console.error("[TTS] Test error response");
      }
    } catch (err) {
      console.error("[TTS] Test synthesis failed:", err);
    } finally {
      setTtsLoading(false);
    }
  };

  const filteredAgents = agents.filter((agent) => {
    const query = searchQuery.toLowerCase();
    return (
      agent.name.toLowerCase().includes(query) ||
      agent.model.toLowerCase().includes(query) ||
      agent.voice.toLowerCase().includes(query) ||
      agent.system_instruction.toLowerCase().includes(query)
    );
  });

  if (viewMode === "list") {
    return (
      <div className="flex flex-col gap-6 text-slate-800 dark:text-slate-100 w-full">
        
        {/* Header bar and Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-50 dark:bg-primary/20 text-primary dark:text-purple-400 border border-purple-100 dark:border-purple-900/40 rounded-2xl">
                <Bot size={24} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Yapay Zeka Temsilcileri</h2>
                <p className="text-xs text-slate-505 dark:text-slate-400 font-medium">Sanal asistanlarınızı ve API anahtarlarınızı yönetin.</p>
              </div>
            </div>
          </div>
        </div>
          <div className="flex flex-col gap-4">
            {/* Search Bar + "+" Icon Wrapper */}
            <div className="flex items-center justify-between">
              <div className="relative">
              <input
                type="text"
                placeholder="Temsilci ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-48 text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} dark:focus:ring-rose-400/25 transition-all`}
              />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-550" />
            </div>

            <button
              onClick={handleCreateNewAgent}
              className={`p-2 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center h-8 w-8 shrink-0`}
              title="Yeni Temsilci Ekle"
            >
              <Plus size={16} />
            </button>
          </div>

        {/* Agents Grid List */}
        {loading && agents.length === 0 ? (
          <div className="text-center py-20 text-slate-400 dark:text-slate-500 font-bold text-xs animate-pulse">
            Temsilci listesi yükleniyor...
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl text-slate-505 dark:text-slate-450 font-semibold text-xs flex flex-col items-center justify-center gap-3 shadow-sm w-full">
            <Bot size={36} className="text-slate-300 dark:text-slate-700 animate-pulse" />
            <p>Kayıtlı herhangi bir yapay zeka temsilcisi bulunamadı.</p>
            <button
              onClick={handleCreateNewAgent}
              className="mt-2 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-primary dark:text-rose-400 border border-rose-100 rounded-xl text-[10px] font-bold transition"
            >
              İlk Sanal Asistanı Oluştur
            </button>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-slate-105 dark:border-slate-800 rounded-2xl text-slate-505 dark:text-slate-450 text-xs w-full">
            Arama kriterine uygun yapay zeka temsilcisi bulunmuyor.
          </div>
        ) : (
          <div className="space-y-3.5 w-full">
            {/* Column Header Row */}
            <div className="hidden sm:flex items-center justify-between px-4 py-2 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider select-none border-b border-slate-100 dark:border-slate-800/40 pb-2.5">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 text-center shrink-0">Avatar</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 items-center">
                  <div className="pl-1">Temsilci Adı / Durum</div>
                  <div className="pl-1">Model / Sıcaklık (Temp)</div>
                  <div className="pl-1">Ses / Sistem Yönergesi</div>
                </div>
              </div>
              <div className="w-24 text-right pr-4 shrink-0">İşlemler</div>
            </div>

            {filteredAgents.map((agent) => (
              <div 
                key={agent.id}
                className={`p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 hover:scale-[1.005] w-full ${
                  agent.status !== "active" ? "opacity-60" : ""
                }`}
              >
                {/* Left Side: Icon & Details */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 text-primary dark:text-rose-400 shrink-0 flex items-center justify-center">
                    <Bot size={22} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 items-center">
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                        {agent.name}
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${
                          agent.status === "active"
                            ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/30"
                            : "bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-slate-800"
                        }`}>
                          {agent.status === "active" ? "Aktif" : "Pasif"}
                        </span>
                      </h4>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">ID: {agent.id}</p>
                    </div>

                    <div className="text-[10px] text-slate-505 dark:text-slate-400 space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <Cpu size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{agent.model}</span>
                      </div>
                      <div className="text-[9px] text-slate-400 dark:text-slate-500">
                        Sıcaklık (Temp): <span className="font-mono">{agent.temperature}</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-505 dark:text-slate-400 space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <Volume2 size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{agent.voice}</span>
                      </div>
                      <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate italic" title={agent.system_instruction}>
                        {agent.system_instruction}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Actions */}
                <div className="flex items-center gap-4 justify-between sm:justify-end border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditAgent(agent)}
                      className="p-1.5 text-slate-450 hover:text-primary dark:hover:text-white rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-200"
                      title="Düzenle & Yapılandır"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={(e) => openDeleteModal(e, agent.id)}
                      className="p-1.5 text-slate-450 hover:text-primary dark:hover:text-primary rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-250"
                      title="Temsilciyi Sil"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
          </div>

        <ConfirmDeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setDeleteTargetId(null);
          }}
          onConfirm={handleConfirmDelete}
          title="Yapay Zeka Temsilcisini Sil"
          message="Bu yapay zeka sanal temsilci profilini silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        />

      </div>
    );
  }

  // Standard Page-Integrated Edit View (Keep sidebar and header visible!)
  return (
    <div className="flex flex-col gap-6 text-slate-800 dark:text-slate-100 w-full font-sans transition-colors duration-300 animate-in fade-in duration-200">
      
      {/* Editor subheader toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleCancelEdit}
            className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-800 transition"
            title="Listeye Geri Dön"
          >
            <ArrowLeft size={14} />
          </button>
          
          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800" />

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Temsilci İsmi Yazın"
              className="px-3 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-bold text-slate-850 dark:text-white focus:outline-none focus:border-indigo-500 w-56 shadow-inner"
            />
            <select
              value={agentStatus}
              onChange={(e) => setAgentStatus(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-[10px] font-bold text-slate-655 dark:text-slate-400 focus:outline-none"
            >
              <option value="active">AKTİF</option>
              <option value="inactive">PASİF</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveAgent}
            disabled={loading}
            className={`px-4 py-1.5 ${bg} ${hover} text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition duration-205 uppercase tracking-wider`}
          >
            <Save size={13} /> {loading ? "Kaydediliyor..." : "Temsilciyi Kaydet"}
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-800/40 rounded-xl text-emerald-750 dark:text-emerald-350 text-xs flex items-center gap-1.5 font-bold transition-all animate-in fade-in duration-200">
          <CheckCircle size={14} className="text-primary" />
          <span>Temsilci ayarları başarıyla kaydedildi, listeye dönülüyor.</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-between gap-3 transition-all animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError("")}
            className="p-1 text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 transition-colors rounded-lg shrink-0"
            title="Kapat"
          >
            <X size={14} />
          </button>
        </div>
      )}


      {/* Editor Grid */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Column 1 - Voice Profiles (TTS) */}
        <div className="md:col-span-1 flex flex-col gap-6">
          
          {/* Voice select card */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <Volume2 size={16} className="text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">TTS Ses Profili Seçimi</h3>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Seslendirme Motoru (TTS Provider)</label>
              <select
                value={ttsProvider}
                onChange={(e) => setTtsProvider(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-bold"
              >
                {TTS_PROVIDER_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {ttsProvider === "google" && (
              <div className="flex flex-col gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Gemini Dahili Ses Karakteri</label>
                <select
                  value={agentVoice}
                  onChange={(e) => setAgentVoice(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-bold"
                >
                  {GEMINI_VOICE_OPTIONS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold leading-normal pt-1">
                  💡 Gemini Multimodal Live API dahili Türkçe/İngilizce ses karakteridir.
                </p>
              </div>
            )}

            {ttsProvider === "elevenlabs" && (
              <div className="flex flex-col gap-3 pt-3.5 border-t border-purple-100 dark:border-purple-900/40">
                
                {/* ElevenLabs Premade Voices Dropdown */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-purple-600 dark:text-purple-400 font-extrabold uppercase tracking-wider">
                    ElevenLabs Kütüphane Sesleri (Premade & Account Voices)
                  </label>
                  <select
                    value={elevenlabsVoiceId}
                    onChange={(e) => setElevenlabsVoiceId(e.target.value)}
                    className="px-3 py-2 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Aşağıdaki Ses Kütüphanesinden Seçin...</option>
                    {(elevenlabsVoiceList.length > 0 ? elevenlabsVoiceList : DEFAULT_ELEVENLABS_VOICES).map((v) => (
                      <option key={v.voice_id} value={v.voice_id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[9px] text-purple-600/80 dark:text-purple-300/80 font-semibold leading-normal pt-1">
                    💡 ElevenLabs <span className="font-bold underline">Multilingual v2</span> yapay zeka modeli sayesinde tüm sesler Türkçe metinleri doğal akıcılıkla seslendirir.
                  </p>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-purple-600 dark:text-purple-400 font-extrabold uppercase tracking-wider">
                    Özel / Klonlanmış Ses ID (Voice ID)
                  </label>
                  <input
                    type="text"
                    value={elevenlabsVoiceId}
                    onChange={(e) => setElevenlabsVoiceId(e.target.value)}
                    placeholder="Örn: EXAVITQu4vr4xnSDxMaL"
                    className="px-3 py-2 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-[9px] text-slate-400 dark:text-slate-500">
                    Yukarıdaki listeden seçebilir veya ElevenLabs &gt; Voice Lab paneli özel Voice ID'sini yazabilirsiniz.
                  </p>
                </div>

                {/* Stability */}
                <div className="flex flex-col gap-1 pt-1">
                  <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase">
                    <span>Ses Kararlılığı / Sıcaklık (Stability)</span>
                    <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">{elevenlabsStability}</span>
                  </div>
                  <input
                    type="range" min="0.0" max="1.0" step="0.05"
                    value={elevenlabsStability}
                    onChange={(e) => setElevenlabsStability(parseFloat(e.target.value))}
                    className="accent-purple-600 h-6 cursor-pointer"
                  />
                </div>

                {/* Similarity */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase">
                    <span>Klon Benzerlik Oranı (Similarity Boost)</span>
                    <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">{elevenlabsSimilarity}</span>
                  </div>
                  <input
                    type="range" min="0.0" max="1.0" step="0.05"
                    value={elevenlabsSimilarity}
                    onChange={(e) => setElevenlabsSimilarity(parseFloat(e.target.value))}
                    className="accent-purple-600 h-6 cursor-pointer"
                  />
                </div>

                {/* Style */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase">
                    <span>Duygu / Vurgu Şiddeti (Style Exaggeration)</span>
                    <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">{elevenlabsStyle}</span>
                  </div>
                  <input
                    type="range" min="0.0" max="1.0" step="0.05"
                    value={elevenlabsStyle}
                    onChange={(e) => setElevenlabsStyle(parseFloat(e.target.value))}
                    className="accent-purple-600 h-6 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Speaking Tone Selector */}
            <div className="flex flex-col gap-1.5 pt-3.5 border-t border-slate-100 dark:border-slate-800/60">
              <label className="text-[10px] text-slate-400 dark:text-slate-505 font-bold uppercase tracking-wider">Konuşma Profili / Tonu</label>
              <select
                value={agentTone}
                onChange={(e) => setAgentTone(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-755 dark:text-slate-350 focus:outline-none focus:border-indigo-500 font-bold"
              >
                <option value="normal">Normal / Standart (Kibar & Profesyonel)</option>
                <option value="calm">Sakin (Yavaş, Sabırlı & Rahatlatıcı)</option>
                <option value="attractive">Çekici / Cana Yakın (Canlı & Sempatik)</option>
                <option value="firm">Sert / Kararlı (Kısa, Ciddi & Otoriter)</option>
              </select>
            </div>

            <div className="text-[9px] text-slate-405 dark:text-slate-500 font-semibold leading-relaxed p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-150 dark:border-slate-800">
              Not: Seçtiğiniz konuşma tonu, yapay zekanın cümle uzunluğu, kelime seçimleri ve hitap tarzını otomatik olarak şekillendirir.
            </div>
          </div>

          {/* Test TTS Voice Player Card */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <Volume2 size={16} className="text-pink-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Temsilci Sesini Test Et</h3>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-slate-400 dark:text-slate-505 font-bold uppercase tracking-wider">Test Seslendirme Metni</label>
              <textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                rows={3}
                placeholder="Ses motorunu test etmek için bir cümle girin..."
                className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-805 dark:text-slate-250 focus:outline-none focus:border-pink-500 resize-none font-medium"
              />
              
              <button
                type="button"
                onClick={handleTestTtsVoice}
                disabled={ttsLoading}
                className={`py-2 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition shadow-sm text-white ${
                  isPlaying 
                    ? "bg-slate-700 hover:bg-slate-800" 
                    : `${bg} ${hover}`
                }`}
              >
                {ttsLoading ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Sentezleniyor...</span>
                  </>
                ) : isPlaying ? (
                  <>
                    <Pause size={13} />
                    <span>Sesi Durdur</span>
                  </>
                ) : (
                  <>
                    <Play size={13} />
                    <span>Sesi Sentezle & Oynat</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* Column 2 - Model Parameters */}
        <div className="md:col-span-1 flex flex-col gap-6">
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <Sliders size={16} className="text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Model Parametreleri</h3>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Zeka / LLM Sağlayıcısı (LLM Provider)</label>
              <select
                value={llmProvider}
                onChange={(e) => {
                  const newLlm = e.target.value;
                  setLlmProvider(newLlm);
                  setAgentProvider(newLlm);
                  setAgentModel(MODEL_OPTIONS[newLlm] ? MODEL_OPTIONS[newLlm][0] : MODEL_OPTIONS["google"][0]);
                }}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-bold"
              >
                {LLM_PROVIDER_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 pt-3.5 border-t border-slate-100 dark:border-slate-800/60">
              <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Büyük Dil Modeli (LLM)</label>
              <select
                value={agentModel}
                onChange={(e) => setAgentModel(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-mono font-bold"
              >
                {(MODEL_OPTIONS[llmProvider] || MODEL_OPTIONS["google"]).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {llmProvider === "elevenlabs" && (
              <div className="flex flex-col gap-1.5 pt-3 border-t border-purple-100 dark:border-purple-900/40">
                <label className="text-[10px] text-purple-600 dark:text-purple-400 font-extrabold uppercase tracking-wider">ElevenLabs Agent ID (ConvAI)</label>
                <input
                  type="text"
                  value={agentElevenLabsId}
                  onChange={(e) => setAgentElevenLabsId(e.target.value)}
                  placeholder="Örn: agent_xyz1234567890"
                  className="px-3 py-2 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:border-purple-500"
                />
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                  ElevenLabs paneli &gt; Conversational AI sekmesindeki Ajan ID'si.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-505 font-bold uppercase tracking-wider">
                <span>Yaratıcılık (Temperature)</span>
                <span className="font-mono text-primary dark:text-primary font-bold">{agentTemperature}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={agentTemperature}
                onChange={(e) => setAgentTemperature(parseFloat(e.target.value))}
                className="accent-purple-600 cursor-pointer h-8"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Maksimum Token Limiti</label>
              <input
                type="number"
                min="50"
                max="1500"
                value={agentMaxTokens}
                onChange={(e) => setAgentMaxTokens(parseInt(e.target.value) || 300)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-mono font-bold"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Canlı Temsilci Aktarım Hedefi</label>
              <input
                type="text"
                placeholder="200"
                value={agentTransferTarget}
                onChange={(e) => setAgentTransferTarget(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-205 focus:outline-none focus:border-purple-500 font-mono font-bold"
              />
              <span className="text-[9px] text-slate-450 dark:text-slate-500 font-semibold leading-normal">
                Duygu yönetimi kapsamında veya müşteri talep ettiğinde çağrının aktarılacağı dahili numara veya kuyruk ID'si.
              </span>
            </div>
          </div>
        </div>

        {/* Column 3 - Prompt Guidance */}
        <div className="md:col-span-1 flex flex-col gap-6">
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm space-y-4 flex-1 h-full min-h-[360px]">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <Layers size={16} className="text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Sistem Talimatı (Prompt)</h3>
            </div>

            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Temsilci Karakter Talimatı</label>
              <textarea
                value={agentInstruction}
                onChange={(e) => setAgentInstruction(e.target.value)}
                placeholder="Örn: Sen sesli çağrı alan bir satış temsilcisisin. Karşındaki müşteriye kibar davranmalı, ürünler hakkında bilgi vermeli..."
                required
                className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200/85 dark:border-slate-800 rounded-2xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed font-semibold font-sans resize-none h-[220px]"
              />
            </div>

            <div className="flex flex-col gap-1.5 flex-1 mt-4">
              <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Çağrı Karşılama Metni</label>
              <textarea
                value={agentGreetingPrompt}
                onChange={(e) => setAgentGreetingPrompt(e.target.value)}
                placeholder="Örn: Merhaba, ben Anıl. Size nasıl yardımcı olabilirim?"
                className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/85 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed font-semibold font-sans resize-none h-[80px]"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-start gap-2 text-[9px] text-slate-455 dark:text-slate-500 leading-normal">
              <HelpCircle size={12} className="text-slate-400 mt-0.5 shrink-0" />
              <span>
                Sistem talimatları yapay zekanın anayasasıdır. Karşılama metni ise çağrı başladığında doğrudan söyleyeceği ilk cümledir.
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
