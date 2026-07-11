import React, { useState, useEffect } from "react";
import { 
  Bot, 
  Plus, 
  Trash2, 
  Edit, 
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
  RefreshCw
} from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";

export default function AIAgentsSettings({ backendHost = "localhost:8000" }) {
  const [viewMode, setViewMode] = useState("list"); // list, edit
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form States for current agent
  const [agentId, setAgentId] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentVoice, setAgentVoice] = useState("Dilara (Türkçe - Dişi - Premium)");
  const [agentTone, setAgentTone] = useState("normal"); // normal, calm, attractive, firm
  const [agentModel, setAgentModel] = useState("gemini-1.5-flash");
  const [agentTemperature, setAgentTemperature] = useState(0.7);
  const [agentMaxTokens, setAgentMaxTokens] = useState(300);
  const [agentInstruction, setAgentInstruction] = useState("");
  const [agentStatus, setAgentStatus] = useState("active");
  const [agentTransferTarget, setAgentTransferTarget] = useState("200");

  // TTS Voice Testing states
  const [testText, setTestText] = useState("Merhaba, ben yapay zeka temsilciniz Dilara. Size nasıl yardımcı olabilirim?");
  const [ttsLoading, setTtsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioInstance, setAudioInstance] = useState(null);

  // Custom Delete Modal states
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  // Voice options
  const VOICE_OPTIONS = [
    "Dilara (Türkçe - Dişi - Premium)",
    "Ahmet (Türkçe - Erkek - Premium)",
    "Eser (Türkçe - Erkek - Standart)",
    "Selin (Türkçe - Dişi - Standart)",
    "Sophia (English - Female)",
    "John (English - Male)"
  ];

  // Model options
  const MODEL_OPTIONS = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.0-flash"
  ];

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
  }, []);

  const handleCreateNewAgent = () => {
    setAgentId(`agent-${Date.now()}`);
    setAgentName("Yeni Yapay Zeka Asistanı");
    setAgentVoice("Dilara (Türkçe - Dişi - Premium)");
    setAgentTone("normal");
    setAgentModel("gemini-1.5-flash");
    setAgentTemperature(0.7);
    setAgentMaxTokens(300);
    setAgentInstruction("Sen yardımsever bir müşteri temsilcisisin.");
    setAgentStatus("active");
    setAgentTransferTarget("200");
    setTestText("Merhaba, ben yeni yapay zeka temsilciniz. Size nasıl yardımcı olabilirim?");
    
    setViewMode("edit");
  };

  const handleEditAgent = (agent) => {
    setAgentId(agent.id);
    setAgentName(agent.name);
    setAgentVoice(agent.voice);
    setAgentTone(agent.tone || "normal");
    setAgentModel(agent.model);
    setAgentTemperature(agent.temperature);
    setAgentMaxTokens(agent.max_tokens);
    setAgentInstruction(agent.system_instruction);
    setAgentStatus(agent.status);
    setAgentTransferTarget(agent.transfer_target || "200");
    
    // Set matching voice test sentence
    const nameMatch = agent.voice.split(" ")[0];
    setTestText(`Merhaba, ben yapay zeka temsilciniz ${nameMatch}. Size nasıl yardımcı olabilirim?`);

    setViewMode("edit");
  };

  const handleSaveAgent = async () => {
    if (!agentName) return;
    setLoading(true);

    const payload = {
      id: agentId,
      name: agentName,
      voice: agentVoice,
      tone: agentTone,
      model: agentModel,
      temperature: parseFloat(agentTemperature) || 0.7,
      max_tokens: parseInt(agentMaxTokens) || 300,
      system_instruction: agentInstruction,
      status: agentStatus,
      transfer_target: agentTransferTarget
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
      }
    } catch (err) {
      console.error("[AI-Agents] Save error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    // Stop audio if playing
    if (audioInstance) {
      audioInstance.pause();
      setIsPlaying(false);
    }
    setViewMode("list");
    fetchAgents();
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

  if (viewMode === "list") {
    return (
      <div className="flex flex-col gap-6 text-slate-800 dark:text-slate-100 max-w-6xl w-full">
        
        {/* Header bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 dark:bg-purple-600/20 text-purple-650 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40 rounded-2xl">
              <Bot size={24} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Yapay Zeka Temsilcileri (AI Agents)</h2>
              <p className="text-xs text-slate-505 dark:text-slate-400 font-medium">
                Text-to-Speech ses profilleri, LLM modelleri ve sistem yönergeleriyle çalışan sanal asistanlarınızı yapılandırın.
              </p>
            </div>
          </div>

          <button
            onClick={handleCreateNewAgent}
            className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition duration-200 uppercase tracking-wider animate-in fade-in"
          >
            <Plus size={14} /> Yeni Temsilci Ekle
          </button>
        </div>

        {/* Agents Grid List */}
        {loading && agents.length === 0 ? (
          <div className="text-center py-20 text-slate-400 dark:text-slate-500 font-bold text-xs animate-pulse">
            Temsilci listesi yükleniyor...
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl text-slate-505 dark:text-slate-450 font-semibold text-xs flex flex-col items-center justify-center gap-3 shadow-sm">
            <Bot size={36} className="text-slate-300 dark:text-slate-700 animate-pulse" />
            <p>Kayıtlı herhangi bir yapay zeka temsilcisi bulunamadı.</p>
            <button
              onClick={handleCreateNewAgent}
              className="mt-2 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 rounded-xl text-[10px] font-bold transition"
            >
              İlk Sanal Asistanı Oluştur
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {agents.map((agent) => (
              <div 
                key={agent.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition duration-200 animate-in fade-in"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                      agent.status === "active"
                        ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/30"
                        : "bg-slate-50 dark:bg-slate-900 text-slate-550 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                    }`}>
                      {agent.status === "active" ? "Aktif" : "Pasif"}
                    </span>
                    <div className="text-[10px] text-slate-400 font-mono">ID: {agent.id}</div>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-sm text-slate-850 dark:text-white leading-snug">{agent.name}</h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-1">
                      Model: <span className="font-mono text-slate-700 dark:text-slate-350">{agent.model}</span> | 
                      Temp: <span className="font-mono text-slate-700 dark:text-slate-350">{agent.temperature}</span>
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-505 dark:text-slate-400 font-semibold">
                      <Volume2 size={12} className="text-slate-400" />
                      <span>
                        Ses: {agent.voice} ({
                          agent.tone === "calm" ? "Sakin" :
                          agent.tone === "attractive" ? "Çekici" :
                          agent.tone === "firm" ? "Sert" : "Normal"
                        })
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5 text-[10px] text-slate-400 dark:text-slate-505 leading-normal italic line-clamp-2">
                      <FileText size={12} className="text-slate-400 mt-0.5 shrink-0" />
                      <span>{agent.system_instruction}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-850">
                  <button
                    onClick={() => handleEditAgent(agent)}
                    className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/25 text-indigo-650 dark:text-indigo-400 border border-indigo-100/60 dark:border-indigo-900/30 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <Edit size={12} /> Düzenle & Yapılandır
                  </button>
                  
                  <button
                    onClick={(e) => openDeleteModal(e, agent.id)}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-transparent hover:border-rose-100/50 rounded-xl transition"
                    title="Temsilciyi Sil"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

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
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition duration-205 uppercase tracking-wider"
          >
            <Save size={13} /> {loading ? "Kaydediliyor..." : "Temsilciyi Kaydet"}
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-800/40 rounded-xl text-emerald-750 dark:text-emerald-350 text-xs flex items-center gap-1.5 font-bold transition-all animate-in fade-in duration-200">
          <CheckCircle size={14} className="text-emerald-500" />
          <span>Temsilci ayarları başarıyla kaydedildi, listeye dönülüyor.</span>
        </div>
      )}

      {/* Editor Grid */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Column 1 - Voice Profiles (TTS) & Core AI Settings */}
        <div className="md:col-span-1 flex flex-col gap-6">
          
          {/* Voice select card */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <Volume2 size={16} className="text-indigo-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">TTS Ses Profili Seçimi</h3>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-400 dark:text-slate-505 font-bold uppercase tracking-wider">Ses Karakteri</label>
              <select
                value={agentVoice}
                onChange={(e) => setAgentVoice(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-750 dark:text-slate-350 focus:outline-none focus:border-indigo-500 font-bold"
              >
                {VOICE_OPTIONS.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

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
                className={`py-2 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition shadow-sm ${
                  isPlaying 
                    ? "bg-rose-500 hover:bg-rose-600 text-white" 
                    : "bg-pink-600 hover:bg-pink-700 text-white"
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
              <Sliders size={16} className="text-purple-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Model Parametreleri</h3>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Büyük Dil Modeli (LLM)</label>
              <select
                value={agentModel}
                onChange={(e) => setAgentModel(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-755 dark:text-slate-350 focus:outline-none focus:border-indigo-500 font-mono font-bold"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-505 font-bold uppercase tracking-wider">
                <span>Yaratıcılık (Temperature)</span>
                <span className="font-mono text-purple-650 dark:text-purple-450 font-bold">{agentTemperature}</span>
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
              <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Maksimum Token Limiti</label>
              <input
                type="number"
                min="50"
                max="1500"
                value={agentMaxTokens}
                onChange={(e) => setAgentMaxTokens(parseInt(e.target.value) || 300)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-205 focus:outline-none focus:border-purple-500 font-mono font-bold"
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
              <Layers size={16} className="text-emerald-500" />
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

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-start gap-2 text-[9px] text-slate-455 dark:text-slate-500 leading-normal">
              <HelpCircle size={12} className="text-slate-400 mt-0.5 shrink-0" />
              <span>
                Sistem talimatları yapay zekanın anayasasıdır. Her görüşmede buradaki karakter yönergelerine sadık kalır.
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
