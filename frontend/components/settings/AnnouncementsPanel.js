import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Search, Volume2, Info, X, Check, FileAudio, PlayCircle, StopCircle, Download, Play, Square } from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl } from "../../utils/apiHost";
import { createPortal } from "react-dom";

export default function AnnouncementsPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  
  const [showModal, setShowModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newAnnName, setNewAnnName] = useState("");
  const [annType, setAnnType] = useState("announcement"); // announcement | moh
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  const [activeTab, setActiveTab] = useState("upload");
  const [ttsText, setTtsText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const API_BASE = getApiBaseUrl(backendHost);


  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/announcements`);
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data || []);
      }
    } catch (err) {
      console.error("Anonslar yüklenemedi", err);
    }
    setLoading(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!newAnnName || !selectedFile) return;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("name", newAnnName);
      formData.append("type", annType);
      formData.append("file", selectedFile);
      
      const res = await fetch(`${API_BASE}/api/settings/announcements`, {
        method: "POST",
        body: formData
      });
      
      if (res.ok) {
        setShowModal(false);
        setNewAnnName("");
        setSelectedFile(null);
        fetchAnnouncements();
      }
    } catch (err) {
      console.error("Yükleme hatası", err);
    }
    setIsUploading(false);
  };

  const handleTTSUpload = async (e) => {
    e.preventDefault();
    if (!newAnnName || !ttsText) return;

    setIsGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/announcements/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: newAnnName,
          type: annType,
          text: ttsText
        })
      });

      if (res.ok) {
        setShowModal(false);
        setNewAnnName("");
        setAnnType("announcement");
        setTtsText("");
        setActiveTab("upload");
        fetchAnnouncements();
      } else {
        const errorData = await res.json();
        console.error("TTS Yükleme hatası", errorData);
      }
    } catch (err) {
      console.error("TTS Yükleme hatası", err);
    }
    setIsGenerating(false);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await fetch(`${API_BASE}/api/settings/announcements/${deleteTargetId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setAnnouncements(prev => prev.filter(a => a.id !== deleteTargetId));
        setDeleteTargetId(null);
      }
    } catch (err) {
      console.error("Silme hatası", err);
    }
  };

  const playAudio = (ann) => {
    if (playingId === ann.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingId(ann.id);
      // Wait for React to render audio element
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch(e => {
            console.error("Audio playback error", e);
            setPlayingId(null);
          });
          audioRef.current.onended = () => {
            setPlayingId(null);
          };
        }
      }, 50);
    }
  };

  const handleDownload = async (ann) => {
    try {
      const response = await fetch(`${API_BASE}/uploads/announcements/${ann.filename}`);
      if (!response.ok) throw new Error("Dosya bulunamadı");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = ann.original_filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("İndirme hatası:", error);
    }
  };

  const filteredAnnouncements = announcements.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full space-y-6">
      {/* Header and Search & Add Action */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${lightBg} ${text} rounded-xl`}>
            <Volume2 size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-850 dark:text-white uppercase tracking-wider">Medya Yönetimi</h3>
            <p className="text-[10px] text-slate-505 dark:text-slate-400 mt-0.5 font-medium">
              PBX karşılama anonsları ve Bekletme Müziklerini (MoH) yönetin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={14} className="text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Anons Ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-800 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={12} />
              </button>
            )}
          </div>
          
          <button
            onClick={() => setShowModal(true)}
            title="Yeni Anons Ekle"
            className={`rounded-xl h-8 w-8 flex items-center justify-center shrink-0 ${bg} ${hover} text-white transition-colors`}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Announcements List */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm">
            <div className={`w-8 h-8 rounded-full border-2 ${border} border-t-transparent animate-spin`} />
            <p className="text-xs text-slate-500 mt-4 font-medium animate-pulse">Anonslar yükleniyor...</p>
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 dark:text-slate-400 space-y-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm">
            <div className={`p-4 rounded-full ${lightBg} ${text}`}>
              <Volume2 size={32} />
            </div>
            <p className="text-sm font-bold">Kayıtlı anons bulunamadı.</p>
            <p className="text-[10px] text-slate-400">Yeni bir anons eklemek için sağ üstteki '+' butonunu kullanın.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAnnouncements.map((ann) => (
              <div key={ann.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-[24px] p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md transition-all shadow-sm">
                
                <div className="flex items-center gap-4 min-w-0 sm:w-[35%] shrink-0">
                  <div className={`w-14 h-14 rounded-[18px] ${lightBg} flex items-center justify-center shrink-0`}>
                    <FileAudio size={26} className={text} />
                  </div>
                  <div className="flex flex-col min-w-0 pr-2">
                    <h4 className="font-bold text-[14px] text-slate-800 dark:text-white truncate" title={ann.original_filename || ann.name}>
                      {ann.original_filename || ann.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${ann.type === 'moh' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                        {ann.type === 'moh' ? 'Bekletme Müziği' : 'Anons'}
                      </span>
                      <span className={`text-[11px] font-bold ${text} truncate max-w-[100px]`} title={ann.name}>{ann.name}</span>
                      <span className="text-slate-300 dark:text-slate-700 shrink-0">•</span>
                      <span className="text-[11px] text-slate-500 font-medium tracking-wide shrink-0">{new Date(ann.created_at * 1000).toLocaleDateString('tr-TR')}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 flex-1 min-w-0 pb-2 sm:pb-0">
                  <button 
                    onClick={() => playAudio(ann)}
                    className={`w-[42px] h-[42px] rounded-full flex items-center justify-center shrink-0 shadow-md transition-transform active:scale-95 ${bg} text-white`}
                  >
                    {playingId === ann.id ? <Square size={16} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
                  </button>
                  
                  <div className="hidden sm:flex items-center justify-between h-8 flex-1 min-w-0 mx-2">
                    {[2,4,3,6,5,8,4,3,7,9,5,4,8,10,7,5,4,6,8,5,4,3,2,4,5,7,4,3,5,6,4,3,2,1,2,1,3,4,6,5,8,4,3,5,6,7,5,4,3,5,2,4,3,6].map((h, i) => (
                      <div 
                        key={i} 
                        className={`w-1 mx-[1px] rounded-full ${bg} transition-all duration-300`} 
                        style={{ height: `${h * 10}%`, opacity: playingId === ann.id ? 0.8 : 0.25 }} 
                      />
                    ))}
                  </div>
                  
                  <div className="hidden sm:flex items-center gap-3 shrink-0">
                    <span className={`text-[11px] font-bold ${text} font-mono tracking-wider opacity-80`}>00:00</span>
                    <Volume2 size={16} className={`${text} opacity-80`} />
                  </div>
                </div>
                
                <div className="flex items-center gap-1 sm:border-l border-slate-100 dark:border-slate-800 sm:pl-4 shrink-0 justify-end">
                  <button
                    onClick={() => handleDownload(ann)}
                    className={`p-2.5 text-slate-400 hover:${text} hover:${lightBg} rounded-xl transition-colors`}
                    title="Anonsu İndir"
                  >
                    <Download size={18} />
                  </button>
                  <button
                    onClick={() => setDeleteTargetId(ann.id)}
                    className="p-2.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-colors"
                    title="Anonsu Sil"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                
                {playingId === ann.id && (
                  <audio ref={audioRef} src={`${API_BASE}/uploads/announcements/${ann.filename}`} className="hidden" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
              <h3 className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Volume2 size={16} className={text} />
                Yeni Medya Yükle
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setNewAnnName("");
                  setAnnType("announcement");
                  setSelectedFile(null);
                  setTtsText("");
                  setActiveTab("upload");
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex px-6 pt-4 border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 ${
                  activeTab === "upload" 
                    ? `border-${bg.split('-')[1] || 'primary'}-500 ${text}` 
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
                onClick={() => setActiveTab("upload")}
              >
                Dosya Yükle
              </button>
              <button
                type="button"
                className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 ${
                  activeTab === "tts" 
                    ? `border-${bg.split('-')[1] || 'primary'}-500 ${text}` 
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
                onClick={() => setActiveTab("tts")}
              >
                Metinden Sese (TTS)
              </button>
            </div>

            <form onSubmit={activeTab === "upload" ? handleUpload : handleTTSUpload} className="p-6 space-y-6">
              
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 flex items-start gap-3">
                <Info size={16} className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-[11px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-1">Asterisk Uyumlu Ses Formatı</h5>
                  <p className="text-[10px] text-amber-700/80 dark:text-amber-500/80 leading-relaxed font-medium">
                    Santralin anonsu hatasız oynatabilmesi için yükleyeceğiniz dosyanın <strong>WAV, 8000Hz, 16-bit, Mono</strong> formatında olması gerekmektedir. Farklı formatlar görüşme esnasında çalmayabilir.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-2">Medya Tipi</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="announcement" checked={annType === "announcement"} onChange={(e) => setAnnType(e.target.value)} className={`text-${bg.split('-')[1] || 'primary'}-600 focus:ring-${bg.split('-')[1] || 'primary'}-500`} />
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-bold">Anons</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="moh" checked={annType === "moh"} onChange={(e) => setAnnType(e.target.value)} className={`text-${bg.split('-')[1] || 'primary'}-600 focus:ring-${bg.split('-')[1] || 'primary'}-500`} />
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-bold">Bekletme Müziği (MoH)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-2">Medya Adı</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Mesai Dışı Karşılama"
                  value={newAnnName}
                  onChange={(e) => setNewAnnName(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-800 transition-all"
                />
              </div>

              {activeTab === "upload" ? (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-2">Ses Dosyası</label>
                  <div className="w-full flex items-center justify-center w-full">
                      <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all ${selectedFile ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-slate-300 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800/80'}`}>
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              {selectedFile ? (
                                  <>
                                    <FileAudio className="w-8 h-8 mb-3 text-emerald-500" />
                                    <p className="mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">{selectedFile.name}</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                                  </>
                              ) : (
                                  <>
                                    <Volume2 className="w-8 h-8 mb-3 text-slate-400" />
                                    <p className="mb-1 text-xs text-slate-500 dark:text-slate-400"><span className="font-bold">Yüklemek için tıklayın</span> veya sürükleyip bırakın</p>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500">WAV veya MP3 (MAX. 10MB)</p>
                                  </>
                              )}
                          </div>
                          <input type="file" className="hidden" accept=".wav,.mp3" onChange={handleFileChange} required={activeTab === "upload"} />
                      </label>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-2">Okunacak Metin</label>
                  <textarea
                    required={activeTab === "tts"}
                    placeholder="Sistemin okumasını istediğiniz metni buraya yazın..."
                    value={ttsText}
                    onChange={(e) => setTtsText(e.target.value)}
                    rows={4}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-800 transition-all resize-none"
                  />
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setNewAnnName("");
                    setAnnType("announcement");
                    setSelectedFile(null);
                    setTtsText("");
                    setActiveTab("upload");
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={(activeTab === "upload" && (!selectedFile || !newAnnName || isUploading)) || (activeTab === "tts" && (!ttsText || !newAnnName || isGenerating))}
                  className={`flex-1 py-2.5 rounded-xl text-white text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${bg} ${hover}`}
                >
                  {isUploading || isGenerating ? (
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <>
                      <Check size={14} />
                      {activeTab === "upload" ? "Yükle" : "Oluştur"}
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        title="Anonsu Sil"
        message="Bu anons dosyasını kalıcı olarak silmek istediğinize emin misiniz? Eğer bu anons şu anda bir PBX kuralında kullanılıyorsa çağrılar boşluğa düşebilir!"
      />
    </div>
  );
}
