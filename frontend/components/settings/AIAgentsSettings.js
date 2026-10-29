import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  Plus, 
  Trash2, 
  Edit2,
  Cpu,
  Search,
  ArrowLeft, 
  Save, 
  Volume2, 
  Sliders, 
  Layers, 
  CheckCircle,
  HelpCircle,
  Play,
  Pause,
  RefreshCw,
  AlertTriangle,
  X,
  GitBranch,
  Headphones,
  Mic,
  MicOff,
  Shield,
  Sparkles,
  Radio,
  Database,
  Clock,
  PhoneForwarded,
  Activity
} from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import AIAgentScenarioEditor from "./AIAgentScenarioEditor";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";

export default function AIAgentsSettings({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [viewMode, setViewMode] = useState("list"); // list, edit, scenario
  const [editTab, setEditTab] = useState("general_prompt"); // general_prompt, voice_tts, ambient_test, barge_in_vad, llm_brain, behavior_guardrails
  const [selectedAgentForScenario, setSelectedAgentForScenario] = useState(null);
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

  // Form States for current agent
  const [agentId, setAgentId] = useState("");
  const [agentName, setAgentName] = useState("");
  const [roleTitle, setRoleTitle] = useState("Müşteri Temsilcisi");
  const [agentVoice, setAgentVoice] = useState("Aoede (Dişi - Türkçe / İngilizce)");
  const [agentTone, setAgentTone] = useState("normal"); // normal, calm, attractive, firm
  const [speakingRate, setSpeakingRate] = useState(1.0);
  const [agentProvider, setAgentProvider] = useState("google");
  const [sttProvider, setSttProvider] = useState("google");
  const [llmProvider, setLlmProvider] = useState("google");
  const [ttsProvider, setTtsProvider] = useState("google");
  const [allowedSttProviders, setAllowedSttProviders] = useState(["google", "deepgram", "openai", "elevenlabs"]);
  const [allowedTtsProviders, setAllowedTtsProviders] = useState(["google", "elevenlabs", "openai"]);
  const [allowedLlmProviders, setAllowedLlmProviders] = useState(["google", "elevenlabs", "openai", "anthropic", "groq"]);
  const [agentModel, setAgentModel] = useState("models/gemini-2.5-flash-native-audio-latest");
  const [agentTemperature, setAgentTemperature] = useState(0.7);
  const [agentMaxTokens, setAgentMaxTokens] = useState(300);
  const [agentInstruction, setAgentInstruction] = useState("");
  const [agentGreetingPrompt, setAgentGreetingPrompt] = useState("");
  const [farewellPrompt, setFarewellPrompt] = useState("");
  const [agentStatus, setAgentStatus] = useState("active");
  const [agentTransferTarget, setAgentTransferTarget] = useState("200");
  const [agentElevenLabsId, setAgentElevenLabsId] = useState("");
  const [elevenlabsVoiceId, setElevenlabsVoiceId] = useState("");
  const [elevenlabsStability, setElevenlabsStability] = useState(0.5);
  const [elevenlabsSimilarity, setElevenlabsSimilarity] = useState(0.75);
  const [elevenlabsStyle, setElevenlabsStyle] = useState(0.0);
  const [elevenlabsVoiceList, setElevenlabsVoiceList] = useState([]);

  // Ambient Background Noise States
  const [bgNoiseEnabled, setBgNoiseEnabled] = useState(false);
  const [bgNoiseType, setBgNoiseType] = useState("call_center");
  const [bgNoiseVolume, setBgNoiseVolume] = useState(0.15);
  const [bgNoiseMode, setBgNoiseMode] = useState("always"); // always, while_speaking, while_thinking

  // Barge-In & VAD Listening States
  const [bargeInEnabled, setBargeInEnabled] = useState(true);
  const [bargeInProtectGreeting, setBargeInProtectGreeting] = useState(false);
  const [bargeInThresholdAmp, setBargeInThresholdAmp] = useState(250);
  const [bargeInMinDurationMs, setBargeInMinDurationMs] = useState(200);
  const [vadSilenceTimeoutMs, setVadSilenceTimeoutMs] = useState(800);

  // Intelligence, Naturalness & Guardrail States
  const [useRagKb, setUseRagKb] = useState(true);
  const [allowDirectoryTransfer, setAllowDirectoryTransfer] = useState(true);
  const [humanFillersEnabled, setHumanFillersEnabled] = useState(true);
  const [backchannelEnabled, setBackchannelEnabled] = useState(true);
  const [silenceReminderEnabled, setSilenceReminderEnabled] = useState(true);
  const [silenceTimeoutSec, setSilenceTimeoutSec] = useState(8);
  const [maxSilenceRetries, setMaxSilenceRetries] = useState(2);
  const [maxCallDurationSec, setMaxCallDurationSec] = useState(600);
  const [abuseShieldEnabled, setAbuseShieldEnabled] = useState(true);
  const [autoEmotionTransfer, setAutoEmotionTransfer] = useState(true);

  // Live Customer CRM Integration States for AI Agent
  const [crmEnabled, setCrmEnabled] = useState(true);
  const [crmLookupLocalContacts, setCrmLookupLocalContacts] = useState(true);
  const [crmApiUrl, setCrmApiUrl] = useState("");
  const [crmApiMethod, setCrmApiMethod] = useState("GET");
  const [crmAuthType, setCrmAuthType] = useState("none");
  const [crmAuthHeaderName, setCrmAuthHeaderName] = useState("X-API-Key");
  const [crmAuthToken, setCrmAuthToken] = useState("");
  const [crmRequestBodyTemplate, setCrmRequestBodyTemplate] = useState("");
  const [crmPromptMapping, setCrmPromptMapping] = useState("");
  const [crmPostCallWebhookUrl, setCrmPostCallWebhookUrl] = useState("");
  const [crmTestPhone, setCrmTestPhone] = useState("05321234567");
  const [crmTesting, setCrmTesting] = useState(false);
  const [crmTestResult, setCrmTestResult] = useState(null);

  // TTS & Ambient Noise Testing Studio States
  const [testText, setTestText] = useState("Merhaba, ben yapay zeka temsilciniz. Size nasıl yardımcı olabilirim?");
  const [ttsLoading, setTtsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAmbientOnlyPlaying, setIsAmbientOnlyPlaying] = useState(false);
  const [audioInstance, setAudioInstance] = useState(null);
  const ambientCtxRef = useRef(null);
  const ambientGainRef = useRef(null);

  // Custom Delete Modal states
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const API_BASE = getApiBaseUrl(backendHost);

  const ALL_STT_PROVIDER_OPTIONS = [
    { id: "google", name: "Google Gemini STT (Multimodal Native)" },
    { id: "deepgram", name: "Deepgram Nova-2 (Ultra Düşük Gecikmeli STT)" },
    { id: "openai", name: "OpenAI Whisper (Yüksek Doğruluklu STT)" },
    { id: "elevenlabs", name: "ElevenLabs Scribe STT" }
  ];

  const ALL_LLM_PROVIDER_OPTIONS = [
    { id: "google", name: "Google Gemini (Multimodal Live)" },
    { id: "elevenlabs", name: "ElevenLabs (Conversational AI)" },
    { id: "openai", name: "OpenAI (GPT-4o / Realtime)" },
    { id: "anthropic", name: "Anthropic (Claude 3.5 Sonnet)" },
    { id: "groq", name: "Groq (Fast LLM)" }
  ];

  const ALL_TTS_PROVIDER_OPTIONS = [
    { id: "google", name: "Google Gemini Dahili Ses Motoru" },
    { id: "elevenlabs", name: "ElevenLabs TTS (Ses Kütüphanesi & Klonlanmış Ses)" },
    { id: "openai", name: "OpenAI TTS (Alloy / Nova / Shimmer)" }
  ];

  const STT_PROVIDER_OPTIONS = ALL_STT_PROVIDER_OPTIONS.filter((opt) =>
    !Array.isArray(allowedSttProviders) || allowedSttProviders.length === 0 || allowedSttProviders.includes(opt.id)
  );
  const TTS_PROVIDER_OPTIONS = ALL_TTS_PROVIDER_OPTIONS.filter((opt) =>
    !Array.isArray(allowedTtsProviders) || allowedTtsProviders.length === 0 || allowedTtsProviders.includes(opt.id)
  );
  const LLM_PROVIDER_OPTIONS = ALL_LLM_PROVIDER_OPTIONS.filter((opt) =>
    !Array.isArray(allowedLlmProviders) || allowedLlmProviders.length === 0 || allowedLlmProviders.includes(opt.id)
  );

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

  const AMBIENT_NOISE_OPTIONS = [
    {
      id: "call_center",
      title: "Çağrı Merkezi Ortamı",
      subtitle: "Gerçekçi operasyon katı uğultusu ve uzaktan gelen hafif temsilci sesleri",
      badge: "En Çok Tercih Edilen"
    },
    {
      id: "office_keyboard",
      title: "Kurumsal Ofis & Klavye Tuşlaması",
      subtitle: "Sakin ofis ambiyansı ve işlem yapılıyormuş hissi veren hafif klavye sesleri",
      badge: "Kurumsal"
    },
    {
      id: "cafe_lounge",
      title: "Kafe / Sosyal Ortam",
      subtitle: "Sıcak akustik mekan ambiyansı ve samimi arka plan dokusu",
      badge: "Samimi"
    },
    {
      id: "soft_rain",
      title: "Hafif Yağmur & Rahatlatıcı Doğa",
      subtitle: "Stresli veya şikayetçi müşterileri sakinleştiren yumuşak yağmur sesi",
      badge: "Sakinleştirici"
    },
    {
      id: "analog_warmth",
      title: "Klasik Santral / Analog Hat Dokusu",
      subtitle: "Dijital sessizlik hissini kıran sıcak analog telefon hattı frekansı",
      badge: "Klasik PBX"
    }
  ];

  const PERSONA_TEMPLATES = [
    {
      label: "Satış & Kampanya Temsilcisi",
      role: "Satış ve Müşteri İlişkileri Uzmanı",
      tone: "attractive",
      greeting: "Merhaba! Şirketimize hoş geldiniz, ben satış danışmanınız. Size özel kampanyalarımız ve ürünlerimiz hakkında nasıl yardımcı olabilirim?",
      farewell: "Tercihiniz için çok teşekkür eder, harika bir gün dilerim. Hoşça kalın!",
      instruction: "Sen enerjik, ikna kabiliyeti yüksek ve çözüm odaklı bir Satış Temsilcisisin. Müşterinin ihtiyacını hızlıca anla, ürün avantajlarını net ve akıcı cümlelerle anlat. Fiyat veya kampanya sorulduğunda Bilgi Bankasındaki güncel verileri paylaş ve müşteriyi randevuya veya satın almaya yönlendir."
    },
    {
      label: "Teknik Destek & Arıza Kayıt",
      role: "Kıdemli Teknik Destek Uzmanı",
      tone: "calm",
      greeting: "Merhaba, teknik destek hattımıza hoş geldiniz. Yaşadığınız sorunu çözmek için buradayım, lütfen bana kısaca durumu anlatır mısınız?",
      farewell: "Sorununuzun çözülmesine çok sevindim. Başka bir ihtiyacınız olursa her zaman buradayız, iyi günler dilerim.",
      instruction: "Sen sabırlı, analitik ve güven veren bir Teknik Destek Uzmanısın. Müşterinin yaşadığı teknik sorunu adım adım dinle, karmaşık terimler kullanmadan anlaşılır çözüm adımları sun. Eğer sorun uzaktan çözülemiyorsa arıza kaydı oluştur veya ilgili teknik dahiliye aktar."
    },
    {
      label: "Sekreterya & Randevu Asistanı",
      role: "Kurumsal Yönetici & Randevu Asistanı",
      tone: "normal",
      greeting: "Merhaba, kurumsal danışma ve randevu hattımıza hoş geldiniz. Randevu oluşturmak veya ilgili birime bağlanmak için size nasıl yardımcı olabilirim?",
      farewell: "Randevu detaylarınızı kaydettim. Sağlıklı ve güzel günler dilerim, hoşça kalın.",
      instruction: "Sen nazik, düzenli ve profesyonel bir Kurumsal Sekreter ve Randevu Asistanısın. Arayan kişinin adını, talebini ve uygun tarih/saat bilgisini alarak randevu kaydı oluştur. Belirli bir personeli veya dahiliyi sorarlarsa şirket rehberinden kontrol ederek doğrudan aktar."
    },
    {
      label: "Finans & Ödeme Hatırlatma",
      role: "Finans ve Müşteri Hesapları Uzmanı",
      tone: "firm",
      greeting: "Merhaba, finans ve müşteri hesapları biriminden arıyorum. Hesabınızla ilgili bilgilendirme yapmak için görüşebilir miyiz?",
      farewell: "Bilgilendirme ve iş birliğiniz için teşekkür eder, iyi günler dileriz.",
      instruction: "Sen kurumsal, net ve saygılı bir Finans Uzmanısın. Müşteriye vadesi gelen ödeme veya fatura detaylarını kibar ama kararlı bir dille ilet, ödeme sözü tarihini not al veya muhasebe birimine yönlendir."
    }
  ];

  // Stop any running Web Audio ambient synthesizer or HTMLAudioElement
  const stopAllTestAudio = () => {
    if (audioInstance) {
      try {
        audioInstance.pause();
        audioInstance.currentTime = 0;
      } catch (e) {}
      setAudioInstance(null);
    }
    if (ambientCtxRef.current) {
      try {
        ambientCtxRef.current.close();
      } catch (e) {}
      ambientCtxRef.current = null;
      ambientGainRef.current = null;
    }
    setIsPlaying(false);
    setIsAmbientOnlyPlaying(false);
  };

  useEffect(() => {
    return () => {
      stopAllTestAudio();
    };
  }, []);

  // Live update volume of running Web Audio ambient preview when slider moves
  useEffect(() => {
    if (ambientGainRef.current && ambientCtxRef.current) {
      try {
        ambientGainRef.current.gain.setTargetAtTime(
          Math.max(0.02, Math.min(0.8, bgNoiseVolume)),
          ambientCtxRef.current.currentTime,
          0.05
        );
      } catch (e) {}
    }
  }, [bgNoiseVolume]);

  // Synthesize realistic ambient noise in browser via Web Audio API (matches backend 8kHz PCM profiles)
  const startBrowserAmbientNoise = (noiseType, volumeLevel) => {
    try {
      if (ambientCtxRef.current) {
        try { ambientCtxRef.current.close(); } catch (e) {}
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      ambientCtxRef.current = ctx;

      const sampleRate = ctx.sampleRate;
      const durationSec = 6;
      const totalSamples = sampleRate * durationSec;
      const audioBuf = ctx.createBuffer(1, totalSamples, sampleRate);
      const channelData = audioBuf.getChannelData(0);

      let lpPrev = 0.0;
      let lp2Prev = 0.0;
      const clickPeriod = Math.floor(sampleRate * 0.17);
      const clickLen = Math.floor(sampleRate * 0.008);
      const dropPeriod = Math.floor(sampleRate * 0.12);
      const dropLen = Math.floor(sampleRate * 0.002);

      for (let i = 0; i < totalSamples; i++) {
        const t = i / sampleRate;
        const w = Math.random() * 2.0 - 1.0;
        let val = 0.0;

        if (noiseType === "call_center") {
          lpPrev = 0.94 * lpPrev + 0.06 * w;
          const mod = 0.65 + 0.35 * Math.sin(2.0 * Math.PI * 2.3 * t) * Math.cos(2.0 * Math.PI * 0.7 * t);
          const chatter = 0.18 * Math.sin(2.0 * Math.PI * (340.0 + 55.0 * Math.sin(t * 3.1)) * t) * Math.max(0.0, Math.sin(t * 5.7));
          val = lpPrev * mod * 1.4 + chatter * 0.25;
        } else if (noiseType === "office_keyboard") {
          lpPrev = 0.96 * lpPrev + 0.04 * w;
          const clickPhase = i % clickPeriod;
          const isClickActive = clickPhase < clickLen && Math.floor(i / clickPeriod) % 3 !== 0;
          const clickEnv = isClickActive ? Math.exp(-clickPhase / (clickLen * 0.25)) : 0.0;
          val = lpPrev * 0.55 + w * clickEnv * 0.85;
        } else if (noiseType === "cafe_lounge") {
          lpPrev = 0.91 * lpPrev + 0.09 * w;
          lp2Prev = 0.82 * lp2Prev + 0.18 * lpPrev;
          const lively = 0.7 + 0.3 * Math.sin(2.0 * Math.PI * 3.8 * t + Math.sin(t * 1.9));
          val = lp2Prev * lively * 1.5;
        } else if (noiseType === "soft_rain") {
          lpPrev = 0.86 * lpPrev + 0.14 * w;
          const droplet = (i % dropPeriod < dropLen) ? w * 0.6 : 0.0;
          val = lpPrev * 0.85 + droplet * 0.35;
        } else {
          // analog_warmth
          lpPrev = 0.95 * lpPrev + 0.05 * w;
          const hum = 0.18 * Math.sin(2.0 * Math.PI * 50.0 * t) + 0.09 * Math.sin(2.0 * Math.PI * 100.0 * t);
          val = lpPrev * 0.65 + hum * 0.6;
        }

        channelData[i] = Math.max(-0.95, Math.min(0.95, val));
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuf;
      source.loop = true;

      const gainNode = ctx.createGain();
      gainNode.gain.value = Math.max(0.02, Math.min(0.8, volumeLevel));
      ambientGainRef.current = gainNode;

      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
    } catch (err) {
      console.error("[Ambient Audio Preview Error]:", err);
    }
  };

  const handleToggleAmbientOnlyPreview = () => {
    if (isAmbientOnlyPlaying) {
      stopAllTestAudio();
      return;
    }
    stopAllTestAudio();
    setIsAmbientOnlyPlaying(true);
    startBrowserAmbientNoise(bgNoiseType, bgNoiseVolume);
  };

  const fetchProviders = () => {
    tenantFetch(`${API_BASE}/api/settings/ai-providers`)
      .then((res) => res.json())
      .then((data) => {
        if (data) setProviders(data);
      })
      .catch((err) => console.error("[AI-Providers] Load error:", err));
  };

  const fetchLicenseAllowedProviders = () => {
    tenantFetch(`${API_BASE}/api/settings/license/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (Array.isArray(data.allowed_stt_providers) && data.allowed_stt_providers.length > 0) {
            setAllowedSttProviders(data.allowed_stt_providers);
          } else {
            setAllowedSttProviders(["google", "deepgram", "openai", "elevenlabs"]);
          }
          if (Array.isArray(data.allowed_tts_providers) && data.allowed_tts_providers.length > 0) {
            setAllowedTtsProviders(data.allowed_tts_providers);
          } else {
            setAllowedTtsProviders(["google", "elevenlabs", "openai"]);
          }
          if (Array.isArray(data.allowed_llm_providers) && data.allowed_llm_providers.length > 0) {
            setAllowedLlmProviders(data.allowed_llm_providers);
          } else {
            setAllowedLlmProviders(["google", "elevenlabs", "openai", "anthropic", "groq"]);
          }
        }
      })
      .catch((err) => console.error("[License Allowed Providers] Load error:", err));
  };

  const fetchElevenLabsVoices = () => {
    tenantFetch(`${API_BASE}/api/settings/ai-providers/elevenlabs-voices`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.voices) setElevenlabsVoiceList(data.voices);
      })
      .catch((err) => console.error("[ElevenLabs-Voices] Load error:", err));
  };

  const fetchAgents = () => {
    setLoading(true);
    tenantFetch(`${API_BASE}/api/settings/ai-agents`)
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
    fetchLicenseAllowedProviders();
    const handleTenantChange = () => {
      fetchAgents();
      fetchProviders();
      fetchElevenLabsVoices();
      fetchLicenseAllowedProviders();
    };
    window.addEventListener("tenantChanged", handleTenantChange);
    return () => window.removeEventListener("tenantChanged", handleTenantChange);
  }, []);

  const handleCreateNewAgent = () => {
    stopAllTestAudio();
    setError("");
    const defaultStt = allowedSttProviders[0] || "google";
    const defaultTts = allowedTtsProviders[0] || "google";
    const defaultLlm = allowedLlmProviders[0] || "google";

    setAgentId(`agent-${Date.now()}`);
    setAgentName("Yeni Yapay Zeka Asistanı");
    setRoleTitle("Müşteri Temsilcisi");
    setAgentVoice("Aoede (Dişi - Türkçe / İngilizce)");
    setAgentTone("normal");
    setSpeakingRate(1.0);
    setSttProvider(defaultStt);
    setLlmProvider(defaultLlm);
    setTtsProvider(defaultTts);
    setAgentProvider(defaultLlm);
    setAgentModel(MODEL_OPTIONS[defaultLlm] ? MODEL_OPTIONS[defaultLlm][0] : "models/gemini-2.5-flash-native-audio-latest");
    setAgentTemperature(0.7);
    setAgentMaxTokens(300);
    setAgentInstruction("Sen yardımsever bir müşteri temsilcisisin.");
    setAgentGreetingPrompt("Merhaba, ben yeni yapay zeka temsilciniz. Size nasıl yardımcı olabilirim?");
    setFarewellPrompt("Aradığınız için teşekkür eder, iyi günler dilerim.");
    setAgentStatus("active");
    setAgentTransferTarget("200");
    setAgentElevenLabsId("");
    setElevenlabsVoiceId("");
    setElevenlabsStability(0.5);
    setElevenlabsSimilarity(0.75);
    setElevenlabsStyle(0.0);

    // Defaults for new tabs
    setBgNoiseEnabled(false);
    setBgNoiseType("call_center");
    setBgNoiseVolume(0.15);
    setBgNoiseMode("always");

    setBargeInEnabled(true);
    setBargeInProtectGreeting(false);
    setBargeInThresholdAmp(250);
    setBargeInMinDurationMs(200);
    setVadSilenceTimeoutMs(800);

    setUseRagKb(true);
    setAllowDirectoryTransfer(true);
    setHumanFillersEnabled(true);
    setBackchannelEnabled(true);
    setSilenceReminderEnabled(true);
    setSilenceTimeoutSec(8);
    setMaxSilenceRetries(2);
    setMaxCallDurationSec(600);
    setAbuseShieldEnabled(true);
    setAutoEmotionTransfer(true);

    setCrmEnabled(true);
    setCrmLookupLocalContacts(true);
    setCrmApiUrl("");
    setCrmApiMethod("GET");
    setCrmAuthType("none");
    setCrmAuthHeaderName("X-API-Key");
    setCrmAuthToken("");
    setCrmRequestBodyTemplate("");
    setCrmPromptMapping(
      "Müşteri CRM'de kayıtlıysa ismiyle hitap et. Aktif siparişi, randevusu veya açık destek talebi varsa önce bu bilgiyi paylaşarak görüşmeyi ilerlet. VIP müşteriyse öncelikli ve özenli davran, talebi çözülmezse doğrudan canlı temsilciye aktar."
    );
    setCrmPostCallWebhookUrl("");
    setCrmTestResult(null);

    setTestText("Merhaba, ben yeni yapay zeka temsilciniz. Size nasıl yardımcı olabilirim?");
    setEditTab("general_prompt");
    setViewMode("edit");
  };

  const handleEditAgent = (agent) => {
    stopAllTestAudio();
    setError("");
    setAgentId(agent.id);
    setAgentName(agent.name);
    setRoleTitle(agent.role_title || "Müşteri Temsilcisi");
    
    const rawStt = agent.stt_provider || "google";
    const rawLlm = agent.llm_provider || agent.provider || "google";
    const rawTts = agent.tts_provider || (agent.provider === "elevenlabs" || agent.elevenlabs_voice_id ? "elevenlabs" : "google");

    const resolvedStt = allowedSttProviders.includes(rawStt) ? rawStt : (allowedSttProviders[0] || "google");
    const resolvedLlm = allowedLlmProviders.includes(rawLlm) ? rawLlm : (allowedLlmProviders[0] || "google");
    const resolvedTts = allowedTtsProviders.includes(rawTts) ? rawTts : (allowedTtsProviders[0] || "google");

    setSttProvider(resolvedStt);
    setLlmProvider(resolvedLlm);
    setTtsProvider(resolvedTts);
    setAgentProvider(resolvedLlm);
    setAgentVoice(agent.voice || "Aoede (Dişi - Türkçe / İngilizce)");
    setAgentTone(agent.tone || "normal");
    setSpeakingRate(agent.speaking_rate !== undefined ? agent.speaking_rate : 1.0);
    setAgentModel(agent.model);
    setAgentTemperature(agent.temperature);
    setAgentMaxTokens(agent.max_tokens);
    setAgentInstruction(agent.system_instruction);
    setAgentGreetingPrompt(agent.greeting_prompt || "");
    setFarewellPrompt(agent.farewell_prompt || "");
    setAgentStatus(agent.status);
    setAgentTransferTarget(agent.transfer_target || "200");
    setAgentElevenLabsId(agent.elevenlabs_agent_id || "");
    setElevenlabsVoiceId(agent.elevenlabs_voice_id || "");
    setElevenlabsStability(agent.elevenlabs_stability !== undefined ? agent.elevenlabs_stability : 0.5);
    setElevenlabsSimilarity(agent.elevenlabs_similarity !== undefined ? agent.elevenlabs_similarity : 0.75);
    setElevenlabsStyle(agent.elevenlabs_style !== undefined ? agent.elevenlabs_style : 0.0);

    // Ambient Noise
    setBgNoiseEnabled(Boolean(agent.bg_noise_enabled));
    setBgNoiseType(agent.bg_noise_type || "call_center");
    setBgNoiseVolume(agent.bg_noise_volume !== undefined ? agent.bg_noise_volume : 0.15);
    setBgNoiseMode(agent.bg_noise_mode || "always");

    // Barge-in & VAD
    setBargeInEnabled(agent.barge_in_enabled !== undefined ? Boolean(agent.barge_in_enabled) : true);
    setBargeInProtectGreeting(Boolean(agent.barge_in_protect_greeting));
    setBargeInThresholdAmp(agent.barge_in_threshold_amp !== undefined ? agent.barge_in_threshold_amp : 250);
    setBargeInMinDurationMs(agent.barge_in_min_duration_ms !== undefined ? agent.barge_in_min_duration_ms : 200);
    setVadSilenceTimeoutMs(agent.vad_silence_timeout_ms !== undefined ? agent.vad_silence_timeout_ms : 800);

    // Intelligence & Guardrails
    setUseRagKb(agent.use_rag_kb !== undefined ? Boolean(agent.use_rag_kb) : true);
    setAllowDirectoryTransfer(agent.allow_directory_transfer !== undefined ? Boolean(agent.allow_directory_transfer) : true);
    setHumanFillersEnabled(agent.human_fillers_enabled !== undefined ? Boolean(agent.human_fillers_enabled) : true);
    setBackchannelEnabled(agent.backchannel_enabled !== undefined ? Boolean(agent.backchannel_enabled) : true);
    setSilenceReminderEnabled(agent.silence_reminder_enabled !== undefined ? Boolean(agent.silence_reminder_enabled) : true);
    setSilenceTimeoutSec(agent.silence_timeout_sec !== undefined ? agent.silence_timeout_sec : 8);
    setMaxSilenceRetries(agent.max_silence_retries !== undefined ? agent.max_silence_retries : 2);
    setMaxCallDurationSec(agent.max_call_duration_sec !== undefined ? agent.max_call_duration_sec : 600);
    setAbuseShieldEnabled(agent.abuse_shield_enabled !== undefined ? Boolean(agent.abuse_shield_enabled) : true);
    setAutoEmotionTransfer(agent.auto_emotion_transfer !== undefined ? Boolean(agent.auto_emotion_transfer) : true);

    // CRM Integration
    setCrmEnabled(agent.crm_enabled !== undefined ? Boolean(agent.crm_enabled) : true);
    setCrmLookupLocalContacts(agent.crm_lookup_local_contacts !== undefined ? Boolean(agent.crm_lookup_local_contacts) : true);
    setCrmApiUrl(agent.crm_api_url || "");
    setCrmApiMethod(agent.crm_api_method || "GET");
    setCrmAuthType(agent.crm_auth_type || "none");
    setCrmAuthHeaderName(agent.crm_auth_header_name || "X-API-Key");
    setCrmAuthToken(agent.crm_auth_token || "");
    setCrmRequestBodyTemplate(agent.crm_request_body_template || "");
    setCrmPromptMapping(agent.crm_prompt_mapping || "");
    setCrmPostCallWebhookUrl(agent.crm_post_call_webhook_url || "");
    setCrmTestResult(null);

    setTestText(agent.greeting_prompt || `Merhaba, ben yapay zeka temsilciniz ${agent.name}. Size nasıl yardımcı olabilirim?`);
    setEditTab("general_prompt");
    setViewMode("edit");
  };

  const handleSaveAgent = async () => {
    setError("");
    const aName = agentName.trim();

    if (!aName) {
      setError("Lütfen Yapay Zeka Asistanı Adı giriniz.");
      return;
    }

    const dupAgent = (agents || []).find(
      (a) => String(a.name || "").trim().toLowerCase() === aName.toLowerCase() && (!agentId || String(a.id) !== String(agentId))
    );
    if (dupAgent) {
      setError(`'${aName}' isimli Yapay Zeka Asistanı zaten mevcut. Lütfen farklı bir isim giriniz.`);
      return;
    }

    setLoading(true);

    const payload = {
      id: agentId,
      name: aName,
      role_title: roleTitle,
      voice: ttsProvider === "elevenlabs" ? (elevenlabsVoiceId || "ElevenLabs Custom Voice") : agentVoice,
      tone: agentTone,
      speaking_rate: parseFloat(speakingRate) || 1.0,
      provider: llmProvider,
      stt_provider: sttProvider,
      llm_provider: llmProvider,
      tts_provider: ttsProvider,
      model: agentModel,
      temperature: parseFloat(agentTemperature) || 0.7,
      max_tokens: parseInt(agentMaxTokens) || 300,
      system_instruction: agentInstruction,
      greeting_prompt: agentGreetingPrompt,
      farewell_prompt: farewellPrompt,
      status: agentStatus,
      transfer_target: agentTransferTarget,
      elevenlabs_agent_id: agentElevenLabsId,
      elevenlabs_voice_id: elevenlabsVoiceId,
      elevenlabs_stability: elevenlabsStability,
      elevenlabs_similarity: elevenlabsSimilarity,
      elevenlabs_style: elevenlabsStyle,
      bg_noise_enabled: bgNoiseEnabled,
      bg_noise_type: bgNoiseType,
      bg_noise_volume: parseFloat(bgNoiseVolume) || 0.15,
      bg_noise_mode: bgNoiseMode,
      barge_in_enabled: bargeInEnabled,
      barge_in_protect_greeting: bargeInProtectGreeting,
      barge_in_threshold_amp: parseInt(bargeInThresholdAmp) || 250,
      barge_in_min_duration_ms: parseInt(bargeInMinDurationMs) || 200,
      vad_silence_timeout_ms: parseInt(vadSilenceTimeoutMs) || 800,
      use_rag_kb: useRagKb,
      allow_directory_transfer: allowDirectoryTransfer,
      human_fillers_enabled: humanFillersEnabled,
      backchannel_enabled: backchannelEnabled,
      silence_reminder_enabled: silenceReminderEnabled,
      silence_timeout_sec: parseInt(silenceTimeoutSec) || 8,
      max_silence_retries: parseInt(maxSilenceRetries) || 2,
      max_call_duration_sec: parseInt(maxCallDurationSec) || 600,
      abuse_shield_enabled: abuseShieldEnabled,
      auto_emotion_transfer: autoEmotionTransfer,
      crm_enabled: crmEnabled,
      crm_lookup_local_contacts: crmLookupLocalContacts,
      crm_api_url: crmApiUrl.trim(),
      crm_api_method: crmApiMethod || "GET",
      crm_auth_type: crmAuthType || "none",
      crm_auth_header_name: crmAuthHeaderName || "X-API-Key",
      crm_auth_token: crmAuthToken || "",
      crm_request_body_template: crmRequestBodyTemplate || "",
      crm_prompt_mapping: crmPromptMapping || "",
      crm_post_call_webhook_url: crmPostCallWebhookUrl.trim()
    };

    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/ai-agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          stopAllTestAudio();
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
    stopAllTestAudio();
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

  // Perform TTS testing synthesis (optionally mixing ambient background noise)
  const handleTestTtsVoice = async (forceAmbientMix = false) => {
    if (!testText) return;

    if (isPlaying) {
      stopAllTestAudio();
      return;
    }

    stopAllTestAudio();
    setTtsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/ai-agents/tts-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: testText,
          voice: agentVoice,
          tone: agentTone,
          tts_provider: ttsProvider,
          elevenlabs_voice_id: elevenlabsVoiceId,
          speaking_rate: speakingRate
        })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        setAudioInstance(audio);
        setIsPlaying(true);

        if (bgNoiseEnabled || forceAmbientMix) {
          startBrowserAmbientNoise(bgNoiseType, bgNoiseVolume);
        }

        audio.play();
        audio.onended = () => {
          setTimeout(() => {
            stopAllTestAudio();
          }, 350);
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
      (agent.name || "").toLowerCase().includes(query) ||
      (agent.model || "").toLowerCase().includes(query) ||
      (agent.voice || "").toLowerCase().includes(query) ||
      (agent.system_instruction || "").toLowerCase().includes(query)
    );
  });

  if (viewMode === "scenario") {
    return (
      <AIAgentScenarioEditor
        agent={selectedAgentForScenario}
        backendHost={backendHost}
        onBack={() => {
          setViewMode("list");
          setSelectedAgentForScenario(null);
        }}
      />
    );
  }

  if (viewMode === "list") {
    return (
      <div className="flex flex-col gap-6 text-slate-800 dark:text-slate-100 w-full">
        {/* Header bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-50 dark:bg-primary/20 text-primary dark:text-purple-400 border border-purple-100 dark:border-purple-900/40 rounded-2xl">
                <Bot size={24} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Yapay Zeka Temsilcileri</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Sanal asistanlarınızın ses, ortam ambiyansı, söz kesme (barge-in) ve zeka davranışlarını yönetin.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Search Bar + Unified Red "+" Icon */}
          <div className="flex items-center justify-between">
            <div className="relative">
              <input
                type="text"
                placeholder="Temsilci ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-56 text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
              />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            <button
              onClick={handleCreateNewAgent}
              className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all shadow-sm"
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
            <div className="text-center py-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-slate-500 font-semibold text-xs flex flex-col items-center justify-center gap-3 shadow-sm w-full">
              <Bot size={36} className="text-slate-300 dark:text-slate-700 animate-pulse" />
              <p>Kayıtlı herhangi bir yapay zeka temsilcisi bulunamadı.</p>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500 text-xs w-full">
              Arama kriterine uygun yapay zeka temsilcisi bulunmuyor.
            </div>
          ) : (
            <div className="space-y-3.5 w-full">
              <div className="hidden sm:flex items-center justify-between px-4 py-2 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider select-none border-b border-slate-100 dark:border-slate-800/40 pb-2.5">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 text-center shrink-0">Avatar</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 items-center">
                    <div className="pl-1">Temsilci Adı / Durum</div>
                    <div className="pl-1">Zeka Modeli & Özellikler</div>
                    <div className="pl-1">Ses / Sistem Yönergesi</div>
                  </div>
                </div>
                <div className="w-24 text-right pr-4 shrink-0">İşlemler</div>
              </div>

              {filteredAgents.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => handleEditAgent(agent)}
                  className={`p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 hover:scale-[1.003] cursor-pointer w-full ${
                    agent.status !== "active" ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 text-primary shrink-0 flex items-center justify-center">
                      <Bot size={22} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 items-center">
                      <div>
                        <h4 className="font-bold text-xs text-slate-800 dark:text-white flex items-center gap-1.5 flex-wrap">
                          {agent.name}
                          <span
                            className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${
                              agent.status === "active"
                                ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/30"
                                : "bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-slate-800"
                            }`}
                          >
                            {agent.status === "active" ? "Aktif" : "Pasif"}
                          </span>
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                          {agent.role_title || "Müşteri Temsilcisi"}
                        </p>
                      </div>

                      <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Cpu size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{agent.model}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {agent.bg_noise_enabled && (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40 text-[9px] font-bold flex items-center gap-1">
                              <Headphones size={10} /> Ortam Sesi Açık
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border flex items-center gap-1 ${
                              agent.barge_in_enabled !== false
                                ? "bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 border-sky-200/60 dark:border-sky-800/40"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {agent.barge_in_enabled !== false ? <Mic size={10} /> : <MicOff size={10} />}
                            {agent.barge_in_enabled !== false ? "Söz Kesme: Açık" : "Söz Kesme: Kapalı"}
                          </span>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-1 min-w-0">
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

                  <div
                    className="flex items-center gap-4 justify-between sm:justify-end border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100 dark:border-slate-800/60"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedAgentForScenario(agent);
                          setViewMode("scenario");
                        }}
                        className="p-1.5 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-purple-200 dark:hover:border-purple-900/50"
                        title="Senaryo & Davranış Akış Editörü"
                      >
                        <GitBranch size={13} />
                      </button>
                      <button
                        onClick={() => handleEditAgent(agent)}
                        className="p-1.5 text-slate-400 hover:text-primary dark:hover:text-white rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-200"
                        title="Düzenle & Yapılandır"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={(e) => openDeleteModal(e, agent.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-rose-200"
                        title="Temsilciyi Sil"
                      >
                        <Trash2 size={13} />
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

  // TAB DEFINITIONS (Matching UserSettings.js sidebar tab layout)
  const EDIT_TABS = [
    {
      id: "general_prompt",
      label: "Kimlik & Sistem Talimatı",
      icon: Bot
    },
    {
      id: "voice_tts",
      label: "Ses Motoru (STT & TTS)",
      icon: Volume2
    },
    {
      id: "ambient_test",
      label: "Arka Plan Sesi & Test Stüdyosu",
      icon: Headphones
    },
    {
      id: "barge_in_vad",
      label: "Söz Kesme & Dinleme (VAD)",
      icon: Mic
    },
    {
      id: "llm_brain",
      label: "Zeka Motoru (LLM) & RAG",
      icon: Cpu
    },
    {
      id: "behavior_guardrails",
      label: "Konuşma Doğallığı & Güvenlik",
      icon: Shield
    },
    {
      id: "crm_integration",
      label: "Müşteri CRM Entegrasyonu",
      icon: Database
    }
  ];

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 w-full font-sans transition-colors duration-300 animate-in fade-in duration-200">
      {/* Top Header matching UserSettings.js */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleCancelEdit}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all"
            title="Listeye Geri Dön"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              {agentName || "Yapay Zeka Temsilcisi"}
              <span
                className={
                  "text-[10px] px-2 py-0.5 rounded-md font-bold uppercase " +
                  (agentStatus === "active"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700")
                }
              >
                {agentStatus === "active" ? "AKTİF" : "PASİF"}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Yapay zeka temsilcisinin kimlik, ses, arka plan ortam gürültüsü, söz kesme ve zeka ayarlarını sekmelerden yönetin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              stopAllTestAudio();
              setSelectedAgentForScenario({
                id: agentId,
                name: agentName,
                system_instruction: agentInstruction
              });
              setViewMode("scenario");
            }}
            className="px-3.5 py-2 rounded-xl border border-purple-200 dark:border-purple-800/60 bg-purple-50/70 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <GitBranch size={14} />
            <span>Görsel Senaryo Akışı</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAgent}
            disabled={loading}
            className={`px-5 py-2 ${bg} ${hover} text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md transition`}
          >
            <Save size={15} />
            <span>{loading ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 font-bold">
          <CheckCircle size={15} className="text-emerald-500" />
          <span>Temsilci ayarları başarıyla kaydedildi, listeye dönülüyor...</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError("")}
            className="p-1 text-rose-400 hover:text-rose-600 rounded-lg shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Container with Left Sidebar Tabs & Right Content Area (Identical to UserSettings.js) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[580px]">
        {/* Left Sidebar Navigation */}
        <div className="w-full md:w-64 bg-slate-50/50 dark:bg-slate-950/30 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800/60 p-4 shrink-0">
          <div className="space-y-1.5">
            <div className="px-3 py-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              Temsilci Yapılandırması
            </div>

            {EDIT_TABS.map((tab) => {
              const IconComp = tab.icon;
              const isActive = editTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setEditTab(tab.id)}
                  className={
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left " +
                    (isActive
                      ? "bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700"
                      : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")
                  }
                >
                  <IconComp size={15} className="shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Tab Content Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* TAB 1: KİMLİK & SİSTEM TALİMATI (PROMPT) */}
          {editTab === "general_prompt" && (
            <div className="max-w-3xl space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                    Kimlik Bilgileri & Sistem Talimatı (Prompt)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Yapay zeka temsilcinizin adını, unvanını, açılış/kapanış cümlelerini ve karakter anayasasını belirleyin.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Durum:</span>
                  <button
                    type="button"
                    onClick={() => setAgentStatus(agentStatus === "active" ? "inactive" : "active")}
                    className={
                      "px-3 py-1.5 rounded-xl text-xs font-extrabold transition border " +
                      (agentStatus === "active"
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700")
                    }
                  >
                    {agentStatus === "active" ? "● AKTİF" : "○ PASİF"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                    Temsilci Adı
                  </label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="Örn: Selin - Satış Asistanı"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-white font-bold focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                    Görev / Kurumsal Unvan
                  </label>
                  <input
                    type="text"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    placeholder="Örn: Kıdemli Müşteri Danışmanı"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-white font-bold focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                    Canlı Temsilci Aktarım Hedefi (Dahili/Kuyruk)
                  </label>
                  <input
                    type="text"
                    value={agentTransferTarget}
                    onChange={(e) => setAgentTransferTarget(e.target.value)}
                    placeholder="Örn: 200 veya 1000"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-white font-mono font-bold focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Quick Persona Templates */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
                  <Sparkles size={14} className={text} />
                  <span>Hazır Karakter Şablonları (Tek Tıkla Uygula)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PERSONA_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => {
                        setRoleTitle(tpl.role);
                        setAgentTone(tpl.tone);
                        setAgentGreetingPrompt(tpl.greeting);
                        setFarewellPrompt(tpl.farewell);
                        setAgentInstruction(tpl.instruction);
                        setTestText(tpl.greeting);
                      }}
                      className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-primary text-slate-700 dark:text-slate-200 transition shadow-sm"
                    >
                      + {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                    Çağrı Karşılama Cümlesi (İlk Söylenecek Metin)
                  </label>
                  <textarea
                    value={agentGreetingPrompt}
                    onChange={(e) => setAgentGreetingPrompt(e.target.value)}
                    rows={3}
                    placeholder="Örn: Merhaba, ben Selin. Size nasıl yardımcı olabilirim?"
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-white font-medium resize-none focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                    Veda & Kapanış Cümlesi (Görüşme Sonlanırken)
                  </label>
                  <textarea
                    value={farewellPrompt}
                    onChange={(e) => setFarewellPrompt(e.target.value)}
                    rows={3}
                    placeholder="Örn: Aradığınız için teşekkür eder, iyi günler dilerim."
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-white font-medium resize-none focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                  Temsilci Karakter ve Görev Talimatı (System Prompt)
                </label>
                <textarea
                  value={agentInstruction}
                  onChange={(e) => setAgentInstruction(e.target.value)}
                  rows={8}
                  placeholder="Yapay zekanın müşterilerle nasıl konuşacağını, hangi kurallara uyacağını ve hangi soruları yanıtlayacağını detaylıca yazın..."
                  className="w-full p-4 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-white font-medium leading-relaxed resize-none focus:outline-none focus:border-primary"
                />
                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                  <HelpCircle size={12} className="shrink-0" />
                  <span>
                    Sistem talimatları yapay zekanın anayasasıdır. Ayrıca üst bardaki <b>Görsel Senaryo Akışı</b> butonuyla diyagram tabanlı diyalog ağacı da tasarlayabilirsiniz.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SES MOTORU (STT & TTS) */}
          {editTab === "voice_tts" && (
            <div className="max-w-3xl space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                  Ses Motoru (STT & TTS) ve Konuşma Üslubu
                </h3>
                <p className="text-[11px] text-slate-400">
                  Lisansınızda tanımlı ses tanıma (STT), ses sentezleme (TTS) sağlayıcılarını, ses karakterini ve konuşma hızını yapılandırın.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                    Ses Tanıma Motoru (STT Sağlayıcısı)
                  </label>
                  <select
                    value={sttProvider}
                    onChange={(e) => setSttProvider(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                  >
                    {STT_PROVIDER_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                    Seslendirme Motoru (TTS Sağlayıcısı)
                  </label>
                  <select
                    value={ttsProvider}
                    onChange={(e) => setTtsProvider(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                  >
                    {TTS_PROVIDER_OPTIONS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {ttsProvider === "google" && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Gemini Multimodal Doğal Ses Karakteri
                  </label>
                  <select
                    value={agentVoice}
                    onChange={(e) => setAgentVoice(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                  >
                    {GEMINI_VOICE_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400">
                    💡 Gemini Live API düşük gecikmeli doğal Türkçe ve İngilizce ses karakteridir.
                  </p>
                </div>
              )}

              {ttsProvider === "elevenlabs" && (
                <div className="p-4 rounded-2xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-900/50 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-extrabold text-purple-700 dark:text-purple-300 mb-1.5">
                        ElevenLabs Ses Kütüphanesi
                      </label>
                      <select
                        value={elevenlabsVoiceId}
                        onChange={(e) => setElevenlabsVoiceId(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                      >
                        <option value="">Kütüphaneden Ses Seçin...</option>
                        {(elevenlabsVoiceList.length > 0 ? elevenlabsVoiceList : DEFAULT_ELEVENLABS_VOICES).map((v) => (
                          <option key={v.voice_id} value={v.voice_id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-extrabold text-purple-700 dark:text-purple-300 mb-1.5">
                        Özel / Klonlanmış Ses ID (Voice ID)
                      </label>
                      <input
                        type="text"
                        value={elevenlabsVoiceId}
                        onChange={(e) => setElevenlabsVoiceId(e.target.value)}
                        placeholder="Örn: EXAVITQu4vr4xnSDxMaL"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        <span>Kararlılık (Stability)</span>
                        <span className="font-mono text-purple-600">{elevenlabsStability}</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        value={elevenlabsStability}
                        onChange={(e) => setElevenlabsStability(parseFloat(e.target.value))}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        <span>Benzerlik (Similarity)</span>
                        <span className="font-mono text-purple-600">{elevenlabsSimilarity}</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        value={elevenlabsSimilarity}
                        onChange={(e) => setElevenlabsSimilarity(parseFloat(e.target.value))}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        <span>Vurgu Şiddeti (Style)</span>
                        <span className="font-mono text-purple-600">{elevenlabsStyle}</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        value={elevenlabsStyle}
                        onChange={(e) => setElevenlabsStyle(parseFloat(e.target.value))}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                    Konuşma Üslubu / Tonu
                  </label>
                  <select
                    value={agentTone}
                    onChange={(e) => setAgentTone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                  >
                    <option value="normal">Normal / Standart (Kibar & Profesyonel)</option>
                    <option value="calm">Sakin (Yavaş, Sabırlı & Rahatlatıcı)</option>
                    <option value="attractive">Çekici / Cana Yakın (Canlı & Sempatik)</option>
                    <option value="firm">Sert / Kararlı (Kısa, Ciddi & Otoriter)</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      Konuşma Hızı (Speaking Rate)
                    </label>
                    <span className="text-xs font-mono font-extrabold text-primary">{speakingRate.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.75"
                    max="1.35"
                    step="0.05"
                    value={speakingRate}
                    onChange={(e) => setSpeakingRate(parseFloat(e.target.value))}
                    className="w-full accent-rose-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold mt-1">
                    <button type="button" onClick={() => setSpeakingRate(0.85)} className="hover:text-slate-600">0.85x (Yavaş)</button>
                    <button type="button" onClick={() => setSpeakingRate(1.0)} className="hover:text-slate-600">1.00x (Normal)</button>
                    <button type="button" onClick={() => setSpeakingRate(1.15)} className="hover:text-slate-600">1.15x (Akıcı Hızlı)</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ARKA PLAN SESİ & SES TEST STÜDYOSU */}
          {editTab === "ambient_test" && (
            <div className="max-w-3xl space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Headphones size={17} className={text} />
                    <span>Arka Plan Ortam Gürültüsü & Canlı Ses Test Stüdyosu</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    AI temsilci konuşurken arkaya gerçekçi çağrı merkezi veya ofis ambiyansı ekleyin ve aşağıda metin yazarak hemen test edin.
                  </p>
                </div>

                {/* Toggle Switch for Ambient Noise */}
                <button
                  type="button"
                  onClick={() => setBgNoiseEnabled(!bgNoiseEnabled)}
                  className={
                    "px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 border shadow-sm " +
                    (bgNoiseEnabled
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700")
                  }
                >
                  <Radio size={14} className={bgNoiseEnabled ? "animate-pulse" : ""} />
                  <span>{bgNoiseEnabled ? "Ortam Gürültüsü: AÇIK" : "Ortam Gürültüsü: KAPALI"}</span>
                </button>
              </div>

              {/* Ambient Sound Presets Grid */}
              <div className="space-y-2.5">
                <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Ortam Gürültüsü Seçenekleri (Birden Fazla Ambiyans Profili)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {AMBIENT_NOISE_OPTIONS.map((opt) => {
                    const isSelected = bgNoiseType === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => {
                          setBgNoiseType(opt.id);
                          if (!bgNoiseEnabled) setBgNoiseEnabled(true);
                          if (isAmbientOnlyPlaying) {
                            startBrowserAmbientNoise(opt.id, bgNoiseVolume);
                          }
                        }}
                        className={
                          "p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-1.5 " +
                          (isSelected
                            ? `${lightBg} ${border} ring-2 ${ring}`
                            : "bg-slate-50/70 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300")
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                            <span
                              className={
                                "w-2.5 h-2.5 rounded-full " +
                                (isSelected ? bg : "bg-slate-300 dark:bg-slate-700")
                              }
                            />
                            {opt.title}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-white dark:bg-slate-800 text-slate-500 border border-slate-200/70 dark:border-slate-700">
                            {opt.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed pl-4">
                          {opt.subtitle}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Volume & Mode Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Arka Plan Gürültü Seviyesi (Ses Şiddeti)
                    </label>
                    <span className="text-xs font-mono font-extrabold text-primary">
                      %{Math.round(bgNoiseVolume * 100)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.50"
                    step="0.01"
                    value={bgNoiseVolume}
                    onChange={(e) => setBgNoiseVolume(parseFloat(e.target.value))}
                    className="w-full accent-rose-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold mt-1">
                    <span>%5 (Çok Hafif)</span>
                    <span>%15 (İdeal Çağrı Merkezi)</span>
                    <span>%50 (Yoğun Ortam)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Gürültü Çalışma Modu
                  </label>
                  <select
                    value={bgNoiseMode}
                    onChange={(e) => setBgNoiseMode(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                  >
                    <option value="always">Çağrı Boyunca Sürekli (En Gerçekçi - Önerilen)</option>
                    <option value="while_speaking">Sadece AI Temsilci Konuşurken</option>
                    <option value="while_thinking">Sadece AI Düşünürken / Yanıt Hazırlarken</option>
                  </select>
                </div>
              </div>

              {/* INTERACTIVE VOICE + AMBIENT NOISE TEST STUDIO */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white border border-slate-700 shadow-lg space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl ${bg} text-white`}>
                      <Volume2 size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
                        Canlı Ses & Arka Plan Gürültüsü Test Stüdyosu
                      </h4>
                      <p className="text-[10px] text-slate-300">
                        Aşağıya istediğiniz metni yazın; temsilcinin sesini seçtiğiniz arka plan gürültüsüyle birleştirilmiş olarak anında dinleyin.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleAmbientOnlyPreview}
                    className={
                      "px-3 py-1.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 border shrink-0 " +
                      (isAmbientOnlyPlaying
                        ? "bg-amber-500 text-slate-950 border-amber-400"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600")
                    }
                  >
                    {isAmbientOnlyPlaying ? <Pause size={12} /> : <Headphones size={12} />}
                    <span>
                      {isAmbientOnlyPlaying ? "Ortam Sesini Durdur" : "Sadece Ortam Gürültüsünü Dinle"}
                    </span>
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                      Test Edilecek Konuşma Metni
                    </label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setTestText("Merhaba, çağrı merkezimize hoş geldiniz. Kontrollerinizi hemen sağlıyorum, lütfen birkaç saniye hatta kalın.")
                        }
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                      >
                        Çağrı Merkezi Örneği
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setTestText("Randevu talebinizi sistemden kontrol ediyorum, klavyeden bilgilerinizi giriyorum, hemen onaylıyorum.")
                        }
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                      >
                        Ofis & Klavye Örneği
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    rows={3}
                    placeholder="Test etmek istediğiniz cümleyi buraya yazın..."
                    className="w-full p-3 rounded-xl bg-slate-950/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 resize-none font-medium"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                  <div className="text-[10px] text-slate-300 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>
                      Seçili Ambiyans:{" "}
                      <b className="text-white">
                        {AMBIENT_NOISE_OPTIONS.find((o) => o.id === bgNoiseType)?.title} (%{Math.round(bgNoiseVolume * 100)})
                      </b>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTestTtsVoice(true)}
                    disabled={ttsLoading}
                    className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition shadow-md text-white ${
                      isPlaying ? "bg-rose-700 hover:bg-rose-800" : `${bg} ${hover}`
                    }`}
                  >
                    {ttsLoading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Ses Sentezleniyor...</span>
                      </>
                    ) : isPlaying ? (
                      <>
                        <Pause size={14} />
                        <span>Testi Durdur</span>
                      </>
                    ) : (
                      <>
                        <Play size={14} />
                        <span>Sesi + Arka Plan Gürültüsünü Birlikte Test Et</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SÖZ KESME (BARGE-IN) & DİNLEME KONTROLÜ (VAD) */}
          {editTab === "barge_in_vad" && (
            <div className="max-w-3xl space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Mic size={17} className={text} />
                    <span>Söz Kesme (Barge-In) & Dinlemeye Geçiş Ayarları</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    AI temsilci telefonda konuşurken karşıdaki kişi araya girdiğinde (konuşmayı kestiğinde) AI'ın susup dinlemeye geçme davranışını yönetin.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setBargeInEnabled(!bargeInEnabled)}
                  className={
                    "px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 border shadow-sm " +
                    (bargeInEnabled
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700")
                  }
                >
                  {bargeInEnabled ? <Mic size={14} /> : <MicOff size={14} />}
                  <span>{bargeInEnabled ? "Söz Kesme (Barge-In): AÇIK" : "Söz Kesme (Barge-In): KAPALI"}</span>
                </button>
              </div>

              {/* Main Barge-In Explanation & Protect Greeting Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setBargeInEnabled(!bargeInEnabled)}
                  className={
                    "p-4 rounded-2xl border cursor-pointer transition-all space-y-1.5 " +
                    (bargeInEnabled
                      ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
                      : "bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800")
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                      Müşteri Araya Girdiğinde Dinlemeye Geç
                    </span>
                    <input
                      type="checkbox"
                      checked={bargeInEnabled}
                      onChange={(e) => setBargeInEnabled(e.target.checked)}
                      className="h-4 w-4 accent-emerald-600 rounded"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Açık olduğunda müşteri konuşmaya başlarsa AI temsilci cümlesini anında keser ve müşteriyi dinler. Kapatılırsa AI cümlesini bitirene kadar sözü kesilmez.
                  </p>
                </div>

                <div
                  onClick={() => setBargeInProtectGreeting(!bargeInProtectGreeting)}
                  className={
                    "p-4 rounded-2xl border cursor-pointer transition-all space-y-1.5 " +
                    (bargeInProtectGreeting
                      ? "bg-sky-50/40 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800/60"
                      : "bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800")
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                      İlk Karşılama Cümlesini Koru (Barge-In Koruması)
                    </span>
                    <input
                      type="checkbox"
                      checked={bargeInProtectGreeting}
                      onChange={(e) => setBargeInProtectGreeting(e.target.checked)}
                      className="h-4 w-4 accent-sky-600 rounded"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Çağrı ilk açıldığında hat gürültüsü veya müşterinin &ldquo;Alo&rdquo; demesi nedeniyle hoş geldiniz mesajının yarıda kesilmesini engeller.
                  </p>
                </div>
              </div>

              {/* Sensitivity & Timing Sliders */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 space-y-5">
                {/* Barge-in Amplitude Threshold */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <div>
                      <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                        Söz Kesme Ses Hassasiyet Eşiği (Genlik / Gürültü Filtresi)
                      </label>
                      <p className="text-[10px] text-slate-400">
                        Düşük değerlerde en ufak fısıltıda AI susar; yüksek değerlerde ise dış ortam gürültüsünü yoksayar ve sadece net insan sesinde susar.
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-extrabold text-primary">
                      {bargeInThresholdAmp} amp
                    </span>
                  </div>

                  <input
                    type="range"
                    min="100"
                    max="800"
                    step="25"
                    disabled={!bargeInEnabled}
                    value={bargeInThresholdAmp}
                    onChange={(e) => setBargeInThresholdAmp(parseInt(e.target.value))}
                    className="w-full accent-rose-600 cursor-pointer disabled:opacity-40"
                  />

                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setBargeInThresholdAmp(150)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-primary"
                    >
                      Yüksek Hassasiyet (150 - Sessiz Ortam)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBargeInThresholdAmp(250)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-primary"
                    >
                      Dengeli / Önerilen (250)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBargeInThresholdAmp(450)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-primary"
                    >
                      Gürültülü Ortam / Düşük Hassasiyet (450)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-slate-200/70 dark:border-slate-800">
                  {/* Minimum voice duration to trigger barge-in */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Minimum Söz Kesme Konuşma Süresi
                      </label>
                      <span className="text-xs font-mono font-extrabold text-primary">{bargeInMinDurationMs} ms</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="600"
                      step="100"
                      disabled={!bargeInEnabled}
                      value={bargeInMinDurationMs}
                      onChange={(e) => setBargeInMinDurationMs(parseInt(e.target.value))}
                      className="w-full accent-rose-600 cursor-pointer disabled:opacity-40"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Anlık öksürük veya kısa tıkırtıların AI konuşmasını kesmemesi için gereken minimum ses süresi.
                    </p>
                  </div>

                  {/* VAD Silence Timeout */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Müşteri Konuşma Bitişi Bekleme Süresi (VAD)
                      </label>
                      <span className="text-xs font-mono font-extrabold text-primary">{vadSilenceTimeoutMs} ms</span>
                    </div>
                    <input
                      type="range"
                      min="400"
                      max="1600"
                      step="100"
                      value={vadSilenceTimeoutMs}
                      onChange={(e) => setVadSilenceTimeoutMs(parseInt(e.target.value))}
                      className="w-full accent-rose-600 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Müşteri cümlesini bitirip sustuktan kaç milisaniye sonra AI temsilcinin cevaba başlayacağını belirler (Önerilen: 800 ms).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ZEKA MOTORU (LLM) & BİLGİ BANKASI (RAG) */}
          {editTab === "llm_brain" && (
            <div className="max-w-3xl space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                  Zeka Motoru (LLM), Bilgi Bankası (RAG) ve Rehber Entegrasyonu
                </h3>
                <p className="text-[11px] text-slate-400">
                  Yapay zekanın düşünme modelini, yaratıcılık oranını ve şirket bilgi bankası / dahili rehber erişim yetkilerini yönetin.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                    Zeka / LLM Sağlayıcısı
                  </label>
                  <select
                    value={llmProvider}
                    onChange={(e) => {
                      const newLlm = e.target.value;
                      setLlmProvider(newLlm);
                      setAgentProvider(newLlm);
                      setAgentModel(MODEL_OPTIONS[newLlm] ? MODEL_OPTIONS[newLlm][0] : MODEL_OPTIONS["google"][0]);
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                  >
                    {LLM_PROVIDER_OPTIONS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                    Büyük Dil Modeli (LLM)
                  </label>
                  <select
                    value={agentModel}
                    onChange={(e) => setAgentModel(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white"
                  >
                    {(MODEL_OPTIONS[llmProvider] || MODEL_OPTIONS["google"]).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Yaratıcılık & Esneklik (Temperature)
                    </label>
                    <span className="text-xs font-mono font-extrabold text-primary">{agentTemperature}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={agentTemperature}
                    onChange={(e) => setAgentTemperature(parseFloat(e.target.value))}
                    className="w-full accent-rose-600 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    0.2 = Kesin ve kuralcı yanıtlar, 0.7 = Doğal ve akıcı sohbet (Önerilen).
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Maksimum Yanıt Uzunluğu (Max Tokens)
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="4096"
                    value={agentMaxTokens}
                    onChange={(e) => setAgentMaxTokens(parseInt(e.target.value) || 300)}
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setUseRagKb(!useRagKb)}
                  className={
                    "p-4 rounded-2xl border cursor-pointer transition-all space-y-1.5 " +
                    (useRagKb
                      ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
                      : "bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800")
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                      <Database size={14} className="text-emerald-500" />
                      <span>Bilgi Bankası (RAG) & Katalog Erişimi</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={useRagKb}
                      onChange={(e) => setUseRagKb(e.target.checked)}
                      className="h-4 w-4 accent-emerald-600 rounded"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Açık olduğunda AI temsilci eğitim dökümanlarınızı, fiyat listelerinizi ve RAG medya/dosya kütüphanenizi kullanarak soruları yanıtlar.
                  </p>
                </div>

                <div
                  onClick={() => setAllowDirectoryTransfer(!allowDirectoryTransfer)}
                  className={
                    "p-4 rounded-2xl border cursor-pointer transition-all space-y-1.5 " +
                    (allowDirectoryTransfer
                      ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
                      : "bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800")
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                      <PhoneForwarded size={14} className="text-sky-500" />
                      <span>İsimle Dahili Personel Transferi</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={allowDirectoryTransfer}
                      onChange={(e) => setAllowDirectoryTransfer(e.target.checked)}
                      className="h-4 w-4 accent-emerald-600 rounded"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Müşteri &ldquo;Anıl Bey ile görüşebilir miyim?&rdquo; gibi bir personel ismi söylediğinde sistem kullanıcı rehberinden dahili numarayı bulup otomatik aktarır.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: KONUŞMA DOĞALLIĞI & GÜVENLİK SINIRLARI */}
          {editTab === "behavior_guardrails" && (
            <div className="max-w-3xl space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                  Konuşma Doğallığı, Sessizlik Yönetimi & Güvenlik Kalkanları
                </h3>
                <p className="text-[11px] text-slate-400">
                  Yapay zekanın robotik hissiyatını ortadan kaldıran insansı tepkileri, sessizlik hatırlatmalarını ve güvenlik sınırlarını yapılandırın.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setHumanFillersEnabled(!humanFillersEnabled)}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                      İnsansı Düşünme & Dolgu Kelimeleri
                    </span>
                    <input
                      type="checkbox"
                      checked={humanFillersEnabled}
                      onChange={(e) => setHumanFillersEnabled(e.target.checked)}
                      className="h-4 w-4 accent-emerald-600 rounded"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Veritabanı veya randevu sorgusu yaparken &ldquo;Hemen kontrol ediyorum...&rdquo;, &ldquo;Bir saniye lütfen...&rdquo; gibi doğal geçiş ifadeleri kullanır.
                  </p>
                </div>

                <div
                  onClick={() => setBackchannelEnabled(!backchannelEnabled)}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                      Empatik Onaylama (Active Backchanneling)
                    </span>
                    <input
                      type="checkbox"
                      checked={backchannelEnabled}
                      onChange={(e) => setBackchannelEnabled(e.target.checked)}
                      className="h-4 w-4 accent-emerald-600 rounded"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Müşterinin açıklamalarına doğrudan cevaba geçmeden önce &ldquo;Anlıyorum&rdquo;, &ldquo;Tabii ki&rdquo; gibi samimi onay ifadeleriyle başlar.
                  </p>
                </div>

                <div
                  onClick={() => setAbuseShieldEnabled(!abuseShieldEnabled)}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                      Küfür & Hakaret Kalkanı (Abuse Shield)
                    </span>
                    <input
                      type="checkbox"
                      checked={abuseShieldEnabled}
                      onChange={(e) => setAbuseShieldEnabled(e.target.checked)}
                      className="h-4 w-4 accent-rose-600 rounded"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Arayan kişi küfür veya hakaret ettiğinde görüşmeyi nazikçe sonlandırır ve numarayı otomatik kara listeye kaydeder.
                  </p>
                </div>

                <div
                  onClick={() => setAutoEmotionTransfer(!autoEmotionTransfer)}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                      Öfkeli Müşteri Otomatik Temsilci Devri
                    </span>
                    <input
                      type="checkbox"
                      checked={autoEmotionTransfer}
                      onChange={(e) => setAutoEmotionTransfer(e.target.checked)}
                      className="h-4 w-4 accent-amber-600 rounded"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Müşteri üst üste sinirli tepki verdiğinde sakinleştirici tona geçer ve talebi halinde vakit kaybetmeden canlı temsilciye aktarır.
                  </p>
                </div>
              </div>

              {/* Silence Reminder & Max Call Duration */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className={text} />
                    <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                      Sessizlik Hatırlatıcısı (&ldquo;Alo, orada mısınız?&rdquo;) & Çağrı Süresi Sınırı
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={silenceReminderEnabled}
                    onChange={(e) => setSilenceReminderEnabled(e.target.checked)}
                    className="h-4 w-4 accent-emerald-600 rounded"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Sessizlik Bekleme Süresi (Sn)
                    </label>
                    <input
                      type="number"
                      min="4"
                      max="30"
                      disabled={!silenceReminderEnabled}
                      value={silenceTimeoutSec}
                      onChange={(e) => setSilenceTimeoutSec(parseInt(e.target.value) || 8)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Maksimum Hatırlatma Tekrarı
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      disabled={!silenceReminderEnabled}
                      value={maxSilenceRetries}
                      onChange={(e) => setMaxSilenceRetries(parseInt(e.target.value) || 2)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Maks. Çağrı Süresi Limiti (Sn)
                    </label>
                    <input
                      type="number"
                      min="60"
                      max="3600"
                      step="30"
                      value={maxCallDurationSec}
                      onChange={(e) => setMaxCallDurationSec(parseInt(e.target.value) || 600)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: MÜŞTERİ CRM ENTEGRASYONU & ÇAĞRI İLERLETME */}
          {editTab === "crm_integration" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                    <Database size={16} className="text-indigo-500" />
                    <span>Canlı Müşteri CRM Bağlantısı & Akıllı Çağrı İlerletme</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Çağrı geldiğinde AI görüşüyorsa müşterinin CRM kartına bağlanıp verileri (ad, firma, segment, sipariş, randevu, özel not) çeker ve görüşmeyi bu verilere göre kişiselleştirerek ilerletir.
                  </p>
                </div>
                <label className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={crmEnabled}
                    onChange={(e) => setCrmEnabled(e.target.checked)}
                    className="h-4 w-4 accent-emerald-600 rounded"
                  />
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                    {crmEnabled ? "CRM Veri Çekme Aktif" : "CRM Bağlantısı Kapalı"}
                  </span>
                </label>
              </div>

              {/* 1. Local Contacts & Appointments Toggle */}
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-extrabold text-slate-800 dark:text-white">
                    Yerel Rehber & Randevu Veritabanını Otomatik Sorgula
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Arayan numaranın sistemdeki Rehber kartını (Ad Soyad, Firma, Etiket, Özel Notlar) ve aktif Randevu kayıtlarını çağrı başlangıcında AI hafızasına otomatik yükler.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={crmLookupLocalContacts}
                  onChange={(e) => setCrmLookupLocalContacts(e.target.checked)}
                  className="h-4 w-4 accent-emerald-600 rounded shrink-0"
                />
              </div>

              {/* 2. External Customer CRM REST API Connection */}
              <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 space-y-4">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                    Harici Müşteri CRM / ERP REST API Bağlantısı
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Kendi CRM/ERP yazılımınızdan arayan numaraya göre müşteri bilgisi, sipariş durumu, bakiye veya destek kaydı çekmek için API adresini tanımlayın.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      HTTP Metodu
                    </label>
                    <select
                      value={crmApiMethod}
                      onChange={(e) => setCrmApiMethod(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                    </select>
                  </div>
                  <div className="sm:col-span-9">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Müşteri CRM Sorgu Endpoint URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://crm.sirketiniz.com/api/v1/customer?phone={caller_clean}&call_id={call_id}"
                      value={crmApiUrl}
                      onChange={(e) => setCrmApiUrl(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 mr-1">URL Parametresi Ekle:</span>
                  {["{caller_clean}", "{caller}", "{last10}", "{call_id}", "{did}"].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setCrmApiUrl((prev) => (prev || "") + tag)}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-400"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Kimlik Doğrulama (Auth)
                    </label>
                    <select
                      value={crmAuthType}
                      onChange={(e) => setCrmAuthType(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    >
                      <option value="none">Doğrulama Yok</option>
                      <option value="bearer">Bearer Token (Authorization)</option>
                      <option value="api_key">Özel Header (API Key)</option>
                      <option value="basic">Basic Auth (kullanici:sifre)</option>
                    </select>
                  </div>

                  {crmAuthType === "api_key" && (
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Header Adı
                      </label>
                      <input
                        type="text"
                        placeholder="X-API-Key"
                        value={crmAuthHeaderName}
                        onChange={(e) => setCrmAuthHeaderName(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                      />
                    </div>
                  )}

                  {crmAuthType !== "none" && (
                    <div className={crmAuthType === "api_key" ? "sm:col-span-5" : "sm:col-span-8"}>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        API Token / Şifre
                      </label>
                      <input
                        type="password"
                        placeholder="CRM API gizli anahtarınızı giriniz..."
                        value={crmAuthToken}
                        onChange={(e) => setCrmAuthToken(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                      />
                    </div>
                  )}
                </div>

                {crmApiMethod === "POST" && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      POST JSON İstek Gövdesi (Opsiyonel Şablon)
                    </label>
                    <textarea
                      rows={2}
                      placeholder='{"phone": "{caller_clean}", "call_id": "{call_id}", "did": "{did}"}'
                      value={crmRequestBodyTemplate}
                      onChange={(e) => setCrmRequestBodyTemplate(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                )}

                {/* Live Test Button */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Test Arayan No (0532...)"
                    value={crmTestPhone}
                    onChange={(e) => setCrmTestPhone(e.target.value)}
                    className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono sm:w-56"
                  />
                  <button
                    type="button"
                    disabled={crmTesting}
                    onClick={async () => {
                      setCrmTesting(true);
                      setCrmTestResult(null);
                      try {
                        const res = await tenantFetch(`${API_BASE}/api/cti/test`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            caller: crmTestPhone || "05321234567",
                            call_id: "ai-test-call-01",
                            ai_agent_id: agentId,
                            custom_api_url: crmApiUrl,
                            custom_api_method: crmApiMethod,
                            custom_auth_type: crmAuthType,
                            custom_auth_header_name: crmAuthHeaderName,
                            custom_auth_token: crmAuthToken,
                            custom_request_body: crmRequestBodyTemplate
                          })
                        });
                        const data = await res.json();
                        setCrmTestResult(data);
                      } catch (err) {
                        setCrmTestResult({ status: "error", message: err.message });
                      } finally {
                        setCrmTesting(false);
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-extrabold bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center gap-1.5 transition"
                  >
                    <Play size={13} />
                    <span>{crmTesting ? "CRM Sorgulanıyor..." : "CRM Veri Çekmeyi Test Et"}</span>
                  </button>
                </div>

                {crmTestResult && (
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-44">
                    <pre>{JSON.stringify(crmTestResult, null, 2)}</pre>
                  </div>
                )}
              </div>

              {/* 3. CRM Data Progression Rules (How AI uses CRM data during the call) */}
              <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                      CRM Verisine Göre Çağrı İlerletme & Karar Talimatı
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      CRM'den dönen müşteri verilerine (segment, sipariş durumu, borç/bakiye, randevu vb.) göre yapay zekanın çağrıyı nasıl yönlendireceğini belirtin.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setCrmPromptMapping(
                          "1. Müşteri CRM'de kayıtlıysa ismiyle hitap ederek karşıla.\n2. Eğer aktif siparişi veya kargosu varsa doğrudan sipariş durumunu paylaş.\n3. Eğer VIP segmentindeyse öncelikli işlem yap ve talebi halinde bekletmeden canlı temsilciye aktar."
                        )
                      }
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50"
                    >
                      + E-Ticaret / Sipariş Şablonu
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCrmPromptMapping(
                          "1. Müşterinin CRM'deki yaklaşan randevusu varsa tarih ve saatini hatırlatarak onay veya değişiklik talebi olup olmadığını sor.\n2. Kayıtlı randevusu yoksa uygun saatleri sunarak yeni randevu oluştur."
                        )
                      }
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                    >
                      + Klinik / Randevu Şablonu
                    </button>
                  </div>
                </div>

                <textarea
                  rows={4}
                  placeholder="Örn: Müşteri CRM'de kayıtlıysa ismiyle hitap et. Eğer 'segment' alanı 'VIP' ise doğrudan özel temsilciye aktar; 'bakiye_borc' alanı varsa ödeme hatırlatması yap..."
                  value={crmPromptMapping}
                  onChange={(e) => setCrmPromptMapping(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs leading-relaxed"
                />
              </div>

              {/* 4. Post-Call CRM Webhook */}
              <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 space-y-2">
                <label className="block text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                  Çağrı Sonu CRM Webhook URL (Görüşme Özeti & Transkript Gönderimi)
                </label>
                <p className="text-[11px] text-slate-400">
                  AI görüşmesi tamamlandığında çağrı süresi, arayan numara ve konuşma dökümünü (transkript) CRM sisteminize otomatik POST eder.
                </p>
                <input
                  type="text"
                  placeholder="https://crm.sirketiniz.com/api/v1/call-webhook"
                  value={crmPostCallWebhookUrl}
                  onChange={(e) => setCrmPostCallWebhookUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
