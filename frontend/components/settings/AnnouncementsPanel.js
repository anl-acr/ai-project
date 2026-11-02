import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Search, Volume2, Info, X, Check, FileAudio, PlayCircle, StopCircle, Download, Play, Square, Edit2, Bot, Sparkles, Music, ShieldCheck, RotateCcw } from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";
import { createPortal } from "react-dom";

const ANNOUNCEMENT_CATEGORIES = [
  {
    id: "system",
    urlSlug: "sistem-anonslari",
    label: "Sistem Anonsları",
    shortBadge: "Sistem Anonsu",
    icon: ShieldCheck,
    addTitle: "Yeni Sistem Anonsu Ekle",
    searchPlaceholder: "Sistem anonsu ara...",
    emptyTitle: "Kayıtlı sistem anonsu bulunamadı.",
    emptyDesc: "Santral durum, meşgul, aktarım ve anket sistem seslerini buradan yönetebilirsiniz."
  },
  {
    id: "moh",
    urlSlug: "bekleme-muzikleri",
    label: "Bekleme Müzikleri",
    shortBadge: "Bekleme Müziği",
    icon: Music,
    addTitle: "Yeni Bekleme Müziği Ekle",
    searchPlaceholder: "Bekleme müziği ara...",
    emptyTitle: "Özel bekleme müziği yüklenmedi.",
    emptyDesc: "Kuyruklarda varsayılan sistem bekleme müziği (default) çalmaktadır. Kendi bekletme müziğinizi yüklemek için sağ üstteki '+' butonunu kullanın."
  },
  {
    id: "announcement",
    urlSlug: "ozel-anonslar",
    label: "Özel Anonslar",
    shortBadge: "Özel Anons",
    icon: Sparkles,
    addTitle: "Yeni Özel Anons Ekle",
    searchPlaceholder: "Özel anons ara...",
    emptyTitle: "Kayıtlı özel anons bulunamadı.",
    emptyDesc: "IVR menü, karşılama ve kuyruk bilgilendirme anonsları eklemek için sağ üstteki '+' butonunu kullanın."
  }
];

const normalizeCategoryType = (rawType) => {
  const v = String(rawType || "").trim().toLowerCase();
  if (v === "moh" || v === "music" || v === "hold_music") return "moh";
  if (v === "system" || v === "sistem") return "system";
  return "announcement";
};

const GEMINI_VOICE_OPTIONS = [
  "Aoede (Dişi - Türkçe / İngilizce)",
  "Kore (Dişi - Yumuşak)",
  "tr-TR-EmelNeural (Emel - Doğal Türkçe Kadın)",
  "Puck (Erkek - Dinamik)",
  "Charon (Erkek - Tok & Resmi)",
  "Fenrir (Erkek - Derin)",
  "tr-TR-AhmetNeural (Ahmet - Doğal Türkçe Erkek)",
  "Sophia (Female - English)",
  "John (Male - English)"
];

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

export default function AnnouncementsPanel({ backendHost = "localhost:8000", userPermissions }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const canWrite = !Array.isArray(userPermissions) || userPermissions.includes("announcements:write");
  const canDelete = !Array.isArray(userPermissions) || userPermissions.includes("announcements:delete");
  
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryTab, setCategoryTab] = useState("system");
  const categoryTabRefs = useRef([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  
  const [showModal, setShowModal] = useState(false);
  const [editingAnn, setEditingAnn] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [newAnnName, setNewAnnName] = useState("");
  const [annType, setAnnType] = useState("announcement"); // system | moh | announcement
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [durations, setDurations] = useState({});
  const audioRef = useRef(null);

  const [activeTab, setActiveTab] = useState("upload");
  const [ttsText, setTtsText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [modalError, setModalError] = useState("");

  // AI Agent & Voice Selection States for TTS
  const [aiAgents, setAiAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [ttsProvider, setTtsProvider] = useState("google");
  const [ttsVoice, setTtsVoice] = useState("Aoede (Dişi - Türkçe / İngilizce)");
  const [ttsTone, setTtsTone] = useState("normal");
  const [ttsSpeakingRate, setTtsSpeakingRate] = useState(1.0);
  const [elevenlabsVoiceId, setElevenlabsVoiceId] = useState("");
  const [elevenlabsStability, setElevenlabsStability] = useState(0.5);
  const [elevenlabsSimilarity, setElevenlabsSimilarity] = useState(0.75);
  const [elevenlabsStyle, setElevenlabsStyle] = useState(0.0);
  const [elevenlabsVoiceList, setElevenlabsVoiceList] = useState([]);

  // Modal TTS Preview States
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewAudioRef = useRef(null);

  const API_BASE = getApiBaseUrl(backendHost);

  const formatDuration = (sec) => {
    const num = Number(sec);
    if (!num || isNaN(num) || !isFinite(num) || num <= 0) return "00:00";
    const total = Math.max(1, Math.round(num));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const sub = params.get("subtab");
      if (sub) {
        const matched = ANNOUNCEMENT_CATEGORIES.find(
          (c) => c.urlSlug === sub || c.id === sub
        );
        if (matched) setCategoryTab(matched.id);
      }
    }
    fetchAnnouncements();
    fetchAiAgentsAndVoices();
    const handleTenantChange = () => {
      fetchAnnouncements();
      fetchAiAgentsAndVoices();
    };
    window.addEventListener("tenantChanged", handleTenantChange);
    return () => {
      window.removeEventListener("tenantChanged", handleTenantChange);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      stopPreviewAudio();
    };
  }, []);

  const selectCategoryTab = (catId, focusIdx = null) => {
    setCategoryTab(catId);
    if (typeof window !== "undefined") {
      try {
        const catObj = ANNOUNCEMENT_CATEGORIES.find((c) => c.id === catId);
        const url = new URL(window.location.href);
        if (catObj?.urlSlug) {
          url.searchParams.set("subtab", catObj.urlSlug);
          window.history.replaceState({}, "", url.toString());
        }
      } catch (e) {}
    }
    if (focusIdx !== null && categoryTabRefs.current[focusIdx]) {
      categoryTabRefs.current[focusIdx].focus();
    }
  };

  const handleCategoryTabKeyDown = (e, idx) => {
    const total = ANNOUNCEMENT_CATEGORIES.length;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = (idx + 1) % total;
      selectCategoryTab(ANNOUNCEMENT_CATEGORIES[next].id, next);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = (idx - 1 + total) % total;
      selectCategoryTab(ANNOUNCEMENT_CATEGORIES[prev].id, prev);
    } else if (e.key === "Home") {
      e.preventDefault();
      selectCategoryTab(ANNOUNCEMENT_CATEGORIES[0].id, 0);
    } else if (e.key === "End") {
      e.preventDefault();
      selectCategoryTab(ANNOUNCEMENT_CATEGORIES[total - 1].id, total - 1);
    }
  };

  const fetchAiAgentsAndVoices = async () => {
    try {
      const [agRes, elRes] = await Promise.all([
        tenantFetch(`${API_BASE}/api/settings/ai-agents`),
        tenantFetch(`${API_BASE}/api/settings/ai-providers/elevenlabs-voices`)
      ]);
      if (agRes.ok) {
        const agData = await agRes.json();
        setAiAgents(Array.isArray(agData) ? agData : (agData?.agents || []));
      }
      if (elRes.ok) {
        const elData = await elRes.json();
        if (Array.isArray(elData?.voices) && elData.voices.length > 0) {
          setElevenlabsVoiceList(elData.voices);
        }
      }
    } catch (err) {
      console.error("AI Temsilcileri ve ses listesi yüklenemedi", err);
    }
  };

  const stopPreviewAudio = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
    }
    setIsPreviewPlaying(false);
  };

  const handleSelectAiAgent = (agentIdVal) => {
    setSelectedAgentId(agentIdVal);
    if (!agentIdVal) return;
    const found = aiAgents.find((a) => String(a.id) === String(agentIdVal));
    if (!found) return;
    const resolvedProvider = found.tts_provider || (found.provider === "elevenlabs" || found.elevenlabs_voice_id ? "elevenlabs" : "google");
    setTtsProvider(resolvedProvider);
    if (found.voice) setTtsVoice(found.voice);
    if (found.tone) setTtsTone(found.tone);
    if (found.speaking_rate) setTtsSpeakingRate(Number(found.speaking_rate) || 1.0);
    if (found.elevenlabs_voice_id) setElevenlabsVoiceId(found.elevenlabs_voice_id);
    if (found.elevenlabs_stability !== undefined) setElevenlabsStability(Number(found.elevenlabs_stability));
    if (found.elevenlabs_similarity !== undefined) setElevenlabsSimilarity(Number(found.elevenlabs_similarity));
    if (found.elevenlabs_style !== undefined) setElevenlabsStyle(Number(found.elevenlabs_style));
  };

  const handlePreviewTts = async () => {
    if (!ttsText.trim()) return;
    if (isPreviewPlaying) {
      stopPreviewAudio();
      return;
    }
    stopPreviewAudio();
    setIsPreviewLoading(true);
    setModalError("");
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/ai-agents/tts-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: ttsText.trim(),
          voice: ttsVoice,
          tone: ttsTone,
          tts_provider: ttsProvider,
          speaking_rate: ttsSpeakingRate,
          elevenlabs_voice_id: elevenlabsVoiceId,
          elevenlabs_stability: elevenlabsStability,
          elevenlabs_similarity: elevenlabsSimilarity,
          elevenlabs_style: elevenlabsStyle
        })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        previewAudioRef.current = audio;
        setIsPreviewPlaying(true);
        audio.onended = () => {
          URL.revokeObjectURL(url);
          setIsPreviewPlaying(false);
          previewAudioRef.current = null;
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          setIsPreviewPlaying(false);
          previewAudioRef.current = null;
        };
        await audio.play();
      } else {
        const errData = await res.json().catch(() => ({}));
        setModalError(errData?.detail || "Ses ön izlemesi oluşturulamadı.");
      }
    } catch (err) {
      console.error("TTS ön izleme hatası:", err);
      setModalError("Ses ön izlemesi sırasında bağlantı hatası oluştu.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Preload durations in browser for any announcement missing backend duration
  useEffect(() => {
    if (!announcements || announcements.length === 0) return;
    announcements.forEach((ann) => {
      if (!ann?.id || !ann?.filename) return;
      if (ann.duration && ann.duration > 0) {
        setDurations((prev) => (prev[ann.id] ? prev : { ...prev, [ann.id]: ann.duration }));
        return;
      }
      const probe = new Audio();
      probe.preload = "metadata";
      const ver = ann.updated_at || ann.created_at || "1";
      probe.src = `${API_BASE}/api/uploads/announcements/${ann.filename}?v=${ver}`;
      probe.onloadedmetadata = () => {
        if (probe.duration && isFinite(probe.duration) && probe.duration > 0) {
          setDurations((prev) => ({ ...prev, [ann.id]: probe.duration }));
        }
      };
    });
  }, [announcements, API_BASE]);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/announcements`);
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data || []);
        const durMap = {};
        (data || []).forEach((a) => {
          if (a?.id && a?.duration > 0) {
            durMap[a.id] = a.duration;
          }
        });
        if (Object.keys(durMap).length > 0) {
          setDurations((prev) => ({ ...prev, ...durMap }));
        }
      }
    } catch (err) {
      console.error("Anonslar yüklenemedi", err);
    }
    setLoading(false);
  };

  const resetModal = () => {
    stopPreviewAudio();
    setShowModal(false);
    setEditingAnn(null);
    setNewAnnName("");
    setAnnType("announcement");
    setSelectedFile(null);
    setTtsText("");
    setSelectedAgentId("");
    setTtsProvider("google");
    setTtsVoice("Aoede (Dişi - Türkçe / İngilizce)");
    setTtsTone("normal");
    setTtsSpeakingRate(1.0);
    setElevenlabsVoiceId("");
    setElevenlabsStability(0.5);
    setElevenlabsSimilarity(0.75);
    setElevenlabsStyle(0.0);
    setModalError("");
    setActiveTab("upload");
  };

  const openCreateModal = () => {
    if (!canWrite) return;
    stopPreviewAudio();
    setEditingAnn(null);
    setNewAnnName("");
    const initialCat = normalizeCategoryType(categoryTab);
    setAnnType(initialCat);
    setSelectedFile(null);
    setTtsText("");
    setSelectedAgentId("");
    setTtsProvider("google");
    setTtsVoice("Aoede (Dişi - Türkçe / İngilizce)");
    setTtsTone("normal");
    setTtsSpeakingRate(1.0);
    setElevenlabsVoiceId("");
    setElevenlabsStability(0.5);
    setElevenlabsSimilarity(0.75);
    setElevenlabsStyle(0.0);
    setModalError("");
    setActiveTab("upload");
    setShowModal(true);
  };

  const openEditModal = (ann) => {
    if (!canWrite) return;
    stopPreviewAudio();
    if (playingId === ann.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingId(null);
      setCurrentTime(0);
    }
    setEditingAnn(ann);
    setNewAnnName(ann.name || ann.original_filename || "");
    setAnnType(ann.is_builtin ? "system" : normalizeCategoryType(ann.type));
    setSelectedFile(null);
    setTtsText(ann.text || "");
    setSelectedAgentId(ann.agent_id || "");
    setTtsProvider(ann.tts_provider || "google");
    setTtsVoice(ann.voice || "Aoede (Dişi - Türkçe / İngilizce)");
    setTtsTone(ann.tone || "normal");
    setTtsSpeakingRate(Number(ann.speaking_rate) || 1.0);
    setElevenlabsVoiceId(ann.elevenlabs_voice_id || "");
    setElevenlabsStability(ann.elevenlabs_stability !== undefined ? Number(ann.elevenlabs_stability) : 0.5);
    setElevenlabsSimilarity(ann.elevenlabs_similarity !== undefined ? Number(ann.elevenlabs_similarity) : 0.75);
    setElevenlabsStyle(ann.elevenlabs_style !== undefined ? Number(ann.elevenlabs_style) : 0.0);
    setModalError("");
    setActiveTab(ann.text || ann.source === "tts" ? "tts" : "upload");
    setShowModal(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!newAnnName.trim()) return;
    if (!editingAnn && !selectedFile) return;
    
    setIsUploading(true);
    setModalError("");
    try {
      let res;
      if (editingAnn && !selectedFile) {
        res = await tenantFetch(`${API_BASE}/api/settings/announcements/${editingAnn.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: newAnnName.trim(),
            type: annType
          })
        });
      } else {
        const formData = new FormData();
        formData.append("name", newAnnName.trim());
        formData.append("type", annType);
        if (editingAnn?.id) {
          formData.append("announcement_id", editingAnn.id);
        }
        formData.append("file", selectedFile);
        
        res = await tenantFetch(`${API_BASE}/api/settings/announcements`, {
          method: "POST",
          body: formData
        });
      }
      
      if (res.ok) {
        selectCategoryTab(normalizeCategoryType(annType));
        resetModal();
        fetchAnnouncements();
      } else {
        const errorData = await res.json().catch(() => ({}));
        setModalError(errorData?.detail || "Anons kaydedilirken bir hata oluştu.");
      }
    } catch (err) {
      console.error("Yükleme hatası", err);
      setModalError("Sunucuya bağlanılamadı.");
    }
    setIsUploading(false);
  };

  const handleTTSUpload = async (e) => {
    e.preventDefault();
    if (!newAnnName.trim() || !ttsText.trim()) return;

    stopPreviewAudio();
    setIsGenerating(true);
    setModalError("");
    try {
      const payload = {
        name: newAnnName.trim(),
        type: annType,
        text: ttsText.trim(),
        agent_id: selectedAgentId,
        tts_provider: ttsProvider,
        voice: ttsVoice,
        tone: ttsTone,
        speaking_rate: ttsSpeakingRate,
        elevenlabs_voice_id: elevenlabsVoiceId,
        elevenlabs_stability: elevenlabsStability,
        elevenlabs_similarity: elevenlabsSimilarity,
        elevenlabs_style: elevenlabsStyle
      };
      if (editingAnn?.id) {
        payload.id = editingAnn.id;
      }

      const res = await tenantFetch(`${API_BASE}/api/settings/announcements/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const savedData = await res.json().catch(() => ({}));
        if (savedData?.announcement?.id && savedData?.announcement?.duration > 0) {
          setDurations((prev) => ({
            ...prev,
            [savedData.announcement.id]: savedData.announcement.duration
          }));
        }
        selectCategoryTab(normalizeCategoryType(annType));
        resetModal();
        fetchAnnouncements();
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error("TTS Yükleme hatası", errorData);
        setModalError(errorData?.detail || "TTS ses sentezi sırasında bir hata oluştu.");
      }
    } catch (err) {
      console.error("TTS Yükleme hatası", err);
      setModalError("Sunucuya bağlanılamadı.");
    }
    setIsGenerating(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/announcements/${deleteTarget.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setDeleteTarget(null);
        fetchAnnouncements();
      }
    } catch (err) {
      console.error("Silme hatası", err);
    }
  };

  const playAudio = (ann) => {
    if (!audioRef.current) return;
    if (playingId === ann.id) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingId(null);
      setCurrentTime(0);
    } else {
      audioRef.current.pause();
      const ver = `${ann.updated_at || ann.created_at || "1"}_${Date.now()}`;
      const audioUrl = `${API_BASE}/api/uploads/announcements/${ann.filename}?v=${ver}`;
      audioRef.current.src = audioUrl;
      audioRef.current.load();
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      setPlayingId(ann.id);

      audioRef.current.onloadedmetadata = () => {
        if (audioRef.current && audioRef.current.duration && isFinite(audioRef.current.duration)) {
          setDurations((prev) => ({ ...prev, [ann.id]: audioRef.current.duration }));
        }
      };
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime || 0);
        }
      };
      audioRef.current.onended = () => {
        setPlayingId(null);
        setCurrentTime(0);
      };
      audioRef.current.onerror = (e) => {
        console.error("Audio playback error", e);
        setPlayingId(null);
        setCurrentTime(0);
      };

      audioRef.current.play().catch((e) => {
        console.error("Audio playback error", e);
        setPlayingId(null);
        setCurrentTime(0);
      });
    }
  };

  const handleDownload = async (ann) => {
    try {
      const cacheBust = ann.updated_at || ann.created_at || "1";
      const response = await fetch(`${API_BASE}/api/uploads/announcements/${ann.filename}?v=${cacheBust}`);

      if (!response.ok) throw new Error("Dosya bulunamadı");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      const ext = (ann.filename || "").split(".").pop() || "mp3";
      const downloadName = ann.name ? (ann.name.toLowerCase().endsWith(`.${ext}`) ? ann.name : `${ann.name}.${ext}`) : (ann.original_filename || ann.filename);
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("İndirme hatası:", error);
    }
  };

  const countsByCategory = {
    system: (announcements || []).filter((a) => normalizeCategoryType(a?.type) === "system").length,
    moh: (announcements || []).filter((a) => normalizeCategoryType(a?.type) === "moh").length,
    announcement: (announcements || []).filter((a) => normalizeCategoryType(a?.type) === "announcement").length
  };

  const activeCategoryMeta =
    ANNOUNCEMENT_CATEGORIES.find((c) => c.id === categoryTab) || ANNOUNCEMENT_CATEGORIES[0];

  const filteredAnnouncements = (announcements || []).filter((a) => {
    if (normalizeCategoryType(a?.type) !== categoryTab) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(a?.name || "").toLowerCase().includes(q) ||
      String(a?.description || "").toLowerCase().includes(q) ||
      String(a?.text || "").toLowerCase().includes(q) ||
      String(a?.original_filename || "").toLowerCase().includes(q) ||
      String(a?.filename || "").toLowerCase().includes(q)
    );
  });

  const formatCreatedAt = (val) => {
    if (!val) return "";
    const num = Number(val);
    if (!isNaN(num) && num > 1000000000) {
      return new Date(num > 100000000000 ? num : num * 1000).toLocaleDateString('tr-TR');
    }
    const d = new Date(val);
    return !isNaN(d.getTime()) ? d.toLocaleDateString('tr-TR') : String(val);
  };

  const waveformBars = [2,4,3,6,5,8,4,3,7,9,5,4,8,10,7,5,4,6,8,5,4,3,2,4,5,7,4,3,5,6,4,3,2,1,2,1,3,4,6,5,8,4,3,5,6,7,5,4,3,5,2,4,3,6];

  return (
    <div className="w-full space-y-5">
      <audio ref={audioRef} className="hidden" preload="none" />
      {/* Header, Category Tabs, Search & Add Action */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 ${lightBg} ${text} rounded-xl`}>
              <Volume2 size={20} aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-850 dark:text-white uppercase tracking-wider">Anons &amp; Medya Yönetimi</h3>
              <p className="text-[10px] text-slate-505 dark:text-slate-400 mt-0.5 font-medium">
                Santral sistem anonslarını, bekleme müziklerini (MoH) ve özel IVR karşılama anonslarını sekmelerden yönetin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:flex-initial">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={14} className="text-slate-400" aria-hidden="true" />
              </div>
              <input
                type="text"
                aria-label={activeCategoryMeta.searchPlaceholder}
                placeholder={activeCategoryMeta.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full sm:w-64 pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Aramayı temizle"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {canWrite && (
              <button
                type="button"
                onClick={openCreateModal}
                title={activeCategoryMeta.addTitle}
                aria-label={activeCategoryMeta.addTitle}
                className="rounded-xl h-8 w-8 flex items-center justify-center shrink-0 bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs: Sistem Anonsları | Bekleme Müzikleri | Özel Anonslar */}
        <div
          role="tablist"
          aria-label="Anons Kategorileri"
          className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80"
        >
          {ANNOUNCEMENT_CATEGORIES.map((cat, idx) => {
            const IconComp = cat.icon;
            const isSelected = categoryTab === cat.id;
            const count = countsByCategory[cat.id] || 0;
            return (
              <button
                key={cat.id}
                ref={(el) => {
                  categoryTabRefs.current[idx] = el;
                }}
                id={`ann-tab-${cat.id}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={`ann-panel-${cat.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => selectCategoryTab(cat.id)}
                onKeyDown={(e) => handleCategoryTabKeyDown(e, idx)}
                className={
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 " +
                  ring +
                  " " +
                  (isSelected
                    ? `${bg} text-white border-transparent shadow-sm`
                    : "bg-slate-50/80 dark:bg-slate-950/50 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80")
                }
              >
                <IconComp size={14} aria-hidden="true" />
                <span>{cat.label}</span>
                <span
                  className={
                    "px-2 py-0.5 rounded-full text-[10px] font-extrabold " +
                    (isSelected
                      ? "bg-white/20 text-white"
                      : `${lightBg} ${text}`)
                  }
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Announcements List */}
      <div
        id={`ann-panel-${categoryTab}`}
        role="tabpanel"
        aria-labelledby={`ann-tab-${categoryTab}`}
        className="min-h-[400px]"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm">
            <div className={`w-8 h-8 rounded-full border-2 ${border} border-t-transparent animate-spin`} />
            <p className="text-xs text-slate-500 mt-4 font-medium animate-pulse">Anonslar yükleniyor...</p>
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 px-6 text-center text-slate-500 dark:text-slate-400 space-y-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm">
            <div className={`p-4 rounded-full ${lightBg} ${text}`}>
              {categoryTab === "moh" ? <Music size={32} /> : categoryTab === "system" ? <ShieldCheck size={32} /> : <Volume2 size={32} />}
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{activeCategoryMeta.emptyTitle}</p>
            <p className="text-[11px] text-slate-400 max-w-md">{activeCategoryMeta.emptyDesc}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAnnouncements.map((ann) => {
              const normType = normalizeCategoryType(ann.type);
              const displayName = ann.name || ann.original_filename || ann.filename;
              const isTtsItem = Boolean(ann.text || ann.source === "tts" || /^tts_[0-9a-f]{6,}/i.test(ann.original_filename || ""));
              const subFileLabel = !isTtsItem && ann.original_filename && ann.original_filename !== displayName ? ann.original_filename : "";
              const totalDur = durations[ann.id] || ann.duration || 0;
              const isPlayingThis = playingId === ann.id;
              const progressRatio = isPlayingThis && totalDur > 0 ? Math.min(1, currentTime / totalDur) : 0;
              const shortVoiceLabel = ann.voice ? String(ann.voice).split("(")[0].trim() : "";
              const RowIcon = normType === "moh" ? Music : normType === "system" ? ShieldCheck : FileAudio;
              const typeBadgeLabel =
                normType === "moh"
                  ? "Bekleme Müziği"
                  : normType === "system"
                  ? ann.is_builtin
                    ? ann.is_customized
                      ? "Özelleştirilmiş Sistem Sesi"
                      : "Varsayılan Sistem Sesi"
                    : "Sistem Anonsu"
                  : "Özel Anons";

              return (
              <div key={ann.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-[24px] p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md transition-all shadow-sm">
                
                <div className="flex items-center gap-4 min-w-0 sm:w-[40%] shrink-0">
                  <div className={`w-14 h-14 rounded-[18px] ${lightBg} flex items-center justify-center shrink-0`}>
                    <RowIcon size={25} className={text} aria-hidden="true" />
                  </div>
                  <div className="flex flex-col min-w-0 pr-2">
                    <h4 className="font-bold text-[14px] text-slate-800 dark:text-white truncate" title={displayName}>
                      {displayName}
                    </h4>
                    {ann.text ? (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 italic" title={ann.text}>
                        &ldquo;{ann.text}&rdquo;
                      </p>
                    ) : ann.description ? (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5" title={ann.description}>
                        {ann.description}
                      </p>
                    ) : null}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span
                        className={
                          "text-[10px] px-2 py-0.5 rounded-full font-bold border " +
                          (normType === "moh"
                            ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/70 dark:border-amber-800/60"
                            : `${lightBg} ${text} ${borderLight}`)
                        }
                      >
                        {typeBadgeLabel}
                      </span>
                      {isTtsItem && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          TTS{shortVoiceLabel ? ` • ${shortVoiceLabel}` : ""}
                        </span>
                      )}
                      {subFileLabel && (
                        <>
                          <span className={`text-[11px] font-bold ${text} truncate max-w-[140px]`} title={subFileLabel}>{subFileLabel}</span>
                          {ann.created_at ? <span className="text-slate-300 dark:text-slate-700 shrink-0">•</span> : null}
                        </>
                      )}
                      {ann.created_at ? (
                        <span className="text-[11px] text-slate-500 font-medium tracking-wide shrink-0">{formatCreatedAt(ann.created_at)}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 flex-1 min-w-0 pb-2 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => playAudio(ann)}
                    aria-label={isPlayingThis ? `${displayName} durdur` : `${displayName} dinle`}
                    className={`w-[42px] h-[42px] rounded-full flex items-center justify-center shrink-0 shadow-md transition-transform active:scale-95 cursor-pointer ${bg} text-white`}
                    title={isPlayingThis ? "Durdur" : "Dinle"}
                  >
                    {isPlayingThis ? <Square size={16} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
                  </button>
                  
                  <div className="hidden sm:flex items-center justify-between h-8 flex-1 min-w-0 mx-2" aria-hidden="true">
                    {waveformBars.map((h, i) => {
                      const barRatio = i / waveformBars.length;
                      const isActiveBar = isPlayingThis && (totalDur <= 0 || barRatio <= progressRatio);
                      return (
                        <div 
                          key={i} 
                          className={`w-1 mx-[1px] rounded-full ${bg} transition-all duration-150`} 
                          style={{ height: `${h * 10}%`, opacity: isActiveBar ? 0.9 : 0.25 }} 
                        />
                      );
                    })}
                  </div>
                  
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className={`text-[11px] font-bold ${text} font-mono tracking-wider opacity-90`}>
                      {isPlayingThis
                        ? `${formatDuration(currentTime)} / ${totalDur > 0 ? formatDuration(totalDur) : (ann.duration_formatted || "00:00")}`
                        : (totalDur > 0 ? formatDuration(totalDur) : (ann.duration_formatted || "00:00"))}
                    </span>
                    <Volume2 size={16} className={`${text} opacity-80`} aria-hidden="true" />
                  </div>
                </div>
                
                <div className="flex items-center gap-1 sm:border-l border-slate-100 dark:border-slate-800 sm:pl-4 shrink-0 justify-end">
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => openEditModal(ann)}
                      aria-label={`${displayName} düzenle`}
                      className={`p-2.5 text-slate-400 hover:${text} hover:${lightBg} rounded-xl transition-colors cursor-pointer`}
                      title={ann.is_builtin ? "Sistem Sesini Özelleştir / Düzenle" : "Düzenle"}
                    >
                      <Edit2 size={18} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDownload(ann)}
                    aria-label={`${displayName} indir`}
                    className={`p-2.5 text-slate-400 hover:${text} hover:${lightBg} rounded-xl transition-colors cursor-pointer`}
                    title="Ses Dosyasını İndir"
                  >
                    <Download size={18} />
                  </button>
                  {canDelete && (!ann.is_builtin || ann.is_customized) && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(ann)}
                      aria-label={ann.is_builtin ? `${displayName} varsayılana sıfırla` : `${displayName} sil`}
                      className="p-2.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-colors cursor-pointer"
                      title={ann.is_builtin ? "Varsayılan Sistem Sesine Sıfırla" : "Sil"}
                    >
                      {ann.is_builtin ? <RotateCcw size={18} /> : <Trash2 size={18} />}
                    </button>
                  )}
                </div>

              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload / Edit Modal (Spacious max-w-4xl Layout) */}
      {showModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="ann-modal-title">
          <div className="w-full max-w-4xl max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <div>
                <h3 id="ann-modal-title" className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                  {editingAnn ? <Edit2 size={18} className={text} /> : <Volume2 size={18} className={text} />}
                  {editingAnn
                    ? editingAnn.is_builtin
                      ? "Sistem Anonsunu Özelleştir"
                      : "Kaydı Düzenle"
                    : activeCategoryMeta.addTitle}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Ses dosyası yükleyin veya Yapay Zeka Temsilcisi sesleriyle doğal Türkçe anons oluşturun.
                </p>
              </div>
              <button
                type="button"
                onClick={resetModal}
                aria-label="Pencereyi kapat"
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Main Body with Left Sidebar Navigation */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Sidebar */}
              <div className="w-60 bg-slate-50/50 dark:bg-slate-950/30 border-r border-slate-100 dark:border-slate-800/60 p-4 shrink-0 overflow-y-auto">
                <nav className="space-y-1.5" aria-label="Ekleme Yöntemi">
                  <button
                    type="button"
                    onClick={() => {
                      stopPreviewAudio();
                      setActiveTab("upload");
                    }}
                    className={"w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer " + (activeTab === 'upload' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                  >
                    <Volume2 size={16} /> Dosya Yükle
                  </button>
                  {annType !== "moh" && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("tts")}
                      className={"w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer " + (activeTab === 'tts' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}
                    >
                      <Bot size={16} /> Yapay Zeka Seslendirme (TTS)
                    </button>
                  )}
                </nav>
              </div>

              {/* Right Content */}
              <div className="flex-1 overflow-y-auto">
                <form onSubmit={activeTab === "upload" ? handleUpload : handleTTSUpload} className="p-6 sm:p-7 space-y-6">
              
                  {modalError && (
                    <div role="alert" className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold">
                      {modalError}
                    </div>
                  )}

                  {/* Ortak Alan: Medya Adı & Kategori Sekmesi */}
                  <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 grid grid-cols-1 sm:grid-cols-5 gap-5 items-start">
                    <div className="sm:col-span-3">
                      <label htmlFor="ann-name-input" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Medya / Anons Adı
                      </label>
                      <input
                        id="ann-name-input"
                        name="name"
                        type="text"
                        required
                        placeholder={
                          annType === "moh"
                            ? "Örn: Kurumsal Bekleme Müziği, Klasik Piyano..."
                            : annType === "system"
                            ? "Örn: Mesai Dışı Sistem Uyarısı, Hatalı Tuşlama..."
                            : "Örn: Karşılama Anonsu, Kampanya Bilgilendirme..."
                        }
                        value={newAnnName}
                        onChange={(e) => setNewAnnName(e.target.value)}
                        className={`w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
                      />
                    </div>

                    <fieldset className="sm:col-span-2" disabled={Boolean(editingAnn?.is_builtin)}>
                      <legend className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                        Anons Sekmesi / Kategori
                      </legend>
                      <div className="flex flex-col gap-1.5">
                        {ANNOUNCEMENT_CATEGORIES.map((opt) => (
                          <label
                            key={opt.id}
                            className={`flex items-center gap-2 ${editingAnn?.is_builtin ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            <input
                              type="radio"
                              name="announcement_category"
                              value={opt.id}
                              checked={annType === opt.id}
                              onChange={(e) => {
                                const nextType = e.target.value;
                                setAnnType(nextType);
                                if (nextType === "moh" && activeTab === "tts") {
                                  stopPreviewAudio();
                                  setActiveTab("upload");
                                }
                              }}
                              className="accent-primary"
                            />
                            <span className="text-xs text-slate-700 dark:text-slate-300 font-bold">{opt.shortBadge}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </div>

                  {activeTab === "upload" ? (
                    <div className="space-y-5">
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex items-start gap-3">
                        <Info size={16} className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <h5 className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-0.5">Asterisk Uyumlu Ses Formatı</h5>
                          <p className="text-[11px] text-amber-700/80 dark:text-amber-500/80 leading-relaxed font-medium">
                            Yüklediğiniz WAV veya MP3 dosyası santralin hatasız oynatabilmesi için otomatik olarak <strong>WAV, 8000Hz, 16-bit, Mono</strong> formatına dönüştürülür.
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                          Ses Dosyası {editingAnn && <span className="text-slate-400 font-normal">(Değiştirmek istemiyorsanız boş bırakabilirsiniz)</span>}
                        </label>
                        <label className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${selectedFile ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-slate-300 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800/80'}`}>
                          <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                            {selectedFile ? (
                              <>
                                <FileAudio className="w-10 h-10 mb-3 text-emerald-500" />
                                <p className="mb-1 text-sm font-bold text-slate-700 dark:text-slate-200">{selectedFile.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-10 h-10 mb-3 text-slate-400" />
                                <p className="mb-1 text-xs text-slate-600 dark:text-slate-300">
                                  <span className="font-bold">Dosya seçmek için tıklayın</span> veya sürükleyip bırakın
                                </p>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                  {editingAnn ? `Mevcut Dosya: ${editingAnn.name || editingAnn.original_filename}` : "WAV veya MP3 (Maksimum 10MB)"}
                                </p>
                              </>
                            )}
                          </div>
                          <input type="file" className="hidden" accept=".wav,.mp3" onChange={handleFileChange} required={activeTab === "upload" && !editingAnn} />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* AI Temsilci & Ses Motoru Seçim Kartı */}
                      <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 space-y-4">
                        <div className="border-b border-slate-200/60 dark:border-slate-800 pb-3 flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                              <Bot size={15} className={text} />
                              AI Temsilci & Ses Karakteri Seçimi
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Hazır bir Yapay Zeka Temsilcinizin ses profilini seçin veya ses karakterini, tonunu ve hızını aşağıdan özelleştirin.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* AI Temsilci Seçimi */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                              Yapay Zeka Temsilcisi (Hızlı Profil Seçimi)
                            </label>
                            <select
                              value={selectedAgentId}
                              onChange={(e) => handleSelectAiAgent(e.target.value)}
                              className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                            >
                              <option value="">Manuel Ses Seçimi (Özel Ayar)</option>
                              {aiAgents.map((ag) => (
                                <option key={ag.id} value={ag.id}>
                                  🤖 {ag.name} ({ag.voice ? String(ag.voice).split("(")[0].trim() : "Varsayılan Ses"})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Seslendirme Motoru (TTS Sağlayıcısı) */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                              Seslendirme Motoru (TTS Sağlayıcısı)
                            </label>
                            <select
                              value={ttsProvider}
                              onChange={(e) => setTtsProvider(e.target.value)}
                              className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                            >
                              <option value="google">Google Gemini & Neural Doğal Ses Motoru</option>
                              <option value="elevenlabs">ElevenLabs TTS (Ses Kütüphanesi & Klonlanmış Ses)</option>
                            </select>
                          </div>
                        </div>

                        {ttsProvider === "google" ? (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                              Doğal Ses Karakteri
                            </label>
                            <select
                              value={ttsVoice}
                              onChange={(e) => setTtsVoice(e.target.value)}
                              className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
                            >
                              {GEMINI_VOICE_OPTIONS.map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-900/50 space-y-4">
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

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
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

                        {/* Konuşma Üslubu & Konuşma Hızı */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                              Konuşma Üslubu / Tonu
                            </label>
                            <select
                              value={ttsTone}
                              onChange={(e) => setTtsTone(e.target.value)}
                              className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
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
                              <span className={`text-xs font-mono font-extrabold ${text}`}>{ttsSpeakingRate.toFixed(2)}x</span>
                            </div>
                            <input
                              type="range"
                              min="0.75"
                              max="1.35"
                              step="0.05"
                              value={ttsSpeakingRate}
                              onChange={(e) => setTtsSpeakingRate(parseFloat(e.target.value))}
                              className="w-full accent-rose-600 cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1">
                              <button type="button" onClick={() => setTtsSpeakingRate(0.85)} className="hover:text-slate-600 dark:hover:text-slate-200">0.85x (Yavaş)</button>
                              <button type="button" onClick={() => setTtsSpeakingRate(1.0)} className="hover:text-slate-600 dark:hover:text-slate-200">1.00x (Normal)</button>
                              <button type="button" onClick={() => setTtsSpeakingRate(1.15)} className="hover:text-slate-600 dark:hover:text-slate-200">1.15x (Akıcı Hızlı)</button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Okunacak Metin & Ön İzleme */}
                      <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <label className="block text-xs font-bold text-slate-800 dark:text-white">Okunacak Anons Metni</label>
                            <p className="text-[11px] text-slate-500">
                              Santralin müşteriye okumasını istediğiniz karşılama veya bilgilendirme metnini yazın.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handlePreviewTts}
                            disabled={!ttsText.trim() || isPreviewLoading}
                            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-sm shrink-0 disabled:opacity-50 ${
                              isPreviewPlaying
                                ? "bg-rose-600 hover:bg-rose-500 text-white"
                                : `bg-white dark:bg-slate-800 ${text} border ${borderLight} hover:shadow`
                            }`}
                          >
                            {isPreviewLoading ? (
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                            ) : isPreviewPlaying ? (
                              <Square size={13} fill="currentColor" />
                            ) : (
                              <Play size={13} fill="currentColor" />
                            )}
                            <span>{isPreviewPlaying ? "Ön İzlemeyi Durdur" : "Sesi Dinle / Ön İzle"}</span>
                          </button>
                        </div>

                        <textarea
                          required={activeTab === "tts"}
                          placeholder="Örn: Aida test sistemine hoşgeldiniz. Dahili numarayı biliyorsanız lütfen tuşlayınız, bilmiyorsanız lütfen hatta kalınız..."
                          value={ttsText}
                          onChange={(e) => setTtsText(e.target.value)}
                          rows={4}
                          className={`w-full text-sm px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all resize-none leading-relaxed`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={resetModal}
                      className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm shadow-rose-500/20 transition-all cursor-pointer"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="submit"
                      disabled={(activeTab === "upload" && ((!selectedFile && !editingAnn) || !newAnnName.trim() || isUploading)) || (activeTab === "tts" && (!ttsText.trim() || !newAnnName.trim() || isGenerating))}
                      className={`px-7 py-2.5 rounded-xl text-white text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${bg} ${hover}`}
                    >
                      {isUploading || isGenerating ? (
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      ) : (
                        <>
                          <Check size={14} />
                          {editingAnn ? "Güncelle" : (activeTab === "upload" ? "Yükle" : "Anonsu Oluştur")}
                        </>
                      )}
                    </button>
                  </div>

                </form>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete / Factory Reset Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={deleteTarget?.is_builtin ? "Varsayılan Sistem Sesine Sıfırla" : "Kaydı Sil"}
        message={
          deleteTarget?.is_builtin
            ? `"${deleteTarget?.name || ""}" için yüklediğiniz özelleştirmeyi kaldırıp fabrika çıkışlı varsayılan Türkçe sistem anonsuna dönmek istediğinize emin misiniz?`
            : "Bu ses kaydını kalıcı olarak silmek istediğinize emin misiniz? Eğer bu kayıt aktif bir kuyruk veya çağrı akışında kullanılıyorsa ilgili kural varsayılan sese dönebilir."
        }
      />
    </div>
  );
}
