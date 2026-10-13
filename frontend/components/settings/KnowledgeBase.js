import React, { useState, useEffect } from "react";
import { 
  Database, 
  FileText, 
  Globe, 
  Search, 
  Send, 
  Upload, 
  CheckCircle, 
  AlertTriangle, 
  Trash2, 
  Sliders, 
  Plus,
  RefreshCw,
  Sparkles,
  HelpCircle,
  FolderOpen,
  Image as ImageIcon,
  Film,
  Music,
  ExternalLink
} from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl } from "../../utils/apiHost";

export default function KnowledgeBase({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  // Upload and Crawl inputs
  const [urlInput, setUrlInput] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  
  // Manual Entry inputs
  const [manualTitle, setManualTitle] = useState("");
  const [manualText, setManualText] = useState("");
  
  // Tuning parameters inputs
  const [ragParams, setRagParams] = useState({
    chunk_size: 800,
    chunk_overlap: 100,
    top_k: 3,
    similarity_threshold: 0.5
  });

  // Search test inputs
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState("");
  
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState({ upload: false, crawl: false, search: false, saveParams: false, manual: false, media: false });
  const [sources, setSources] = useState([]);

  // AI Shareable Media Library states
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaTitle, setMediaTitle] = useState("");
  const [mediaDesc, setMediaDesc] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [alsoIndexPdf, setAlsoIndexPdf] = useState(true);
  const [deleteMediaTarget, setDeleteMediaTarget] = useState(null);
  const [isDeleteMediaModalOpen, setIsDeleteMediaModalOpen] = useState(false);
  
  // Delete Modal states
  const [deleteTargetName, setDeleteTargetName] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const API_BASE = getApiBaseUrl(backendHost);


  // Fetch indexed sources list
  const fetchSources = () => {
    const activeTenantId = typeof window !== "undefined" ? (localStorage.getItem("active_tenant_id") || "tenant-default") : "tenant-default";
    fetch(`${API_BASE}/api/rag/sources?tenant_id=${activeTenantId}`, {
      headers: { "X-Tenant-ID": activeTenantId }
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSources(data);
      })
      .catch((err) => console.error("[RAG] Kaynak listesi alinamadi:", err));
  };

  // Fetch AI Shareable Media Library
  const fetchMediaLibrary = () => {
    const activeTenantId = typeof window !== "undefined" ? (localStorage.getItem("active_tenant_id") || "tenant-default") : "tenant-default";
    fetch(`${API_BASE}/api/rag/media?tenant_id=${activeTenantId}`, {
      headers: { "X-Tenant-ID": activeTenantId }
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setMediaItems(data);
      })
      .catch((err) => console.error("[RAG] Medya kutuphanesi alinamadi:", err));
  };

  // Fetch tuning parameters
  const fetchParams = () => {
    const activeTenantId = typeof window !== "undefined" ? (localStorage.getItem("active_tenant_id") || "tenant-default") : "tenant-default";
    fetch(`${API_BASE}/api/settings/rag?tenant_id=${activeTenantId}`, {
      headers: { "X-Tenant-ID": activeTenantId }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data) setRagParams(data);
      })
      .catch((err) => console.error("[RAG] Parametreler alinamadi:", err));
  };

  useEffect(() => {
    fetchSources();
    fetchParams();
    fetchMediaLibrary();

    const handleTenantChange = () => {
      fetchSources();
      fetchParams();
      fetchMediaLibrary();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("tenantChanged", handleTenantChange);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("tenantChanged", handleTenantChange);
      }
    };
  }, []);

  // Handle URL crawling submit
  const handleCrawlUrl = async (e) => {
    e.preventDefault();
    if (!urlInput) return;
    
    setLoading((prev) => ({ ...prev, crawl: true }));
    setStatus({ type: "", message: "" });

    try {
      const res = await fetch(`${API_BASE}/api/rag/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput })
      });
      const data = await res.json();
      
      if (res.ok) {
        setStatus({ type: "success", message: "Web sitesi başarıyla tarandı ve indekslendi!" });
        setUrlInput("");
        fetchSources();
      } else {
        setStatus({ type: "error", message: data.detail || "Tarama başarısız oldu." });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Ağ hatası oluştu." });
    } finally {
      setLoading((prev) => ({ ...prev, crawl: false }));
    }
  };

  // Handle PDF file upload submit
  const handleUploadPdf = async (e) => {
    e.preventDefault();
    if (!pdfFile) return;

    setLoading((prev) => ({ ...prev, upload: true }));
    setStatus({ type: "", message: "" });

    const formData = new FormData();
    formData.append("file", pdfFile);

    try {
      const res = await fetch(`${API_BASE}/api/rag/upload-pdf`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (res.ok) {
        setStatus({ type: "success", message: "PDF dökümanı başarıyla indekslendi!" });
        setPdfFile(null);
        fetchSources();
      } else {
        setStatus({ type: "error", message: data.detail || "PDF yükleme başarısız oldu." });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Ağ hatası oluştu." });
    } finally {
      setLoading((prev) => ({ ...prev, upload: false }));
    }
  };

  // Handle manual text indexing submit
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualTitle || !manualText) return;

    setLoading((prev) => ({ ...prev, manual: true }));
    setStatus({ type: "", message: "" });

    try {
      const res = await fetch(`${API_BASE}/api/rag/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: manualTitle, text: manualText })
      });
      const data = await res.json();

      if (res.ok) {
        setStatus({ type: "success", message: `"${manualTitle}" başlıklı bilgi başarıyla indekslendi!` });
        setManualTitle("");
        setManualText("");
        fetchSources();
      } else {
        setStatus({ type: "error", message: data.detail || "Manuel veri indeksleme başarısız oldu." });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Ağ hatası oluştu." });
    } finally {
      setLoading((prev) => ({ ...prev, manual: false }));
    }
  };

  // Handle tuning params save submit
  const handleSaveParams = async (e) => {
    e.preventDefault();
    setLoading((prev) => ({ ...prev, saveParams: true }));
    setStatus({ type: "", message: "" });

    try {
      const res = await fetch(`${API_BASE}/api/settings/rag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ragParams)
      });
      const data = await res.json();

      if (res.ok) {
        setStatus({ type: "success", message: "RAG ayarları başarıyla kaydedildi! Yeni yüklemeler bu parametrelerle işlenecektir." });
      } else {
        setStatus({ type: "error", message: data.detail || "Parametre kaydetme başarısız." });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Ağ hatası oluştu." });
    } finally {
      setLoading((prev) => ({ ...prev, saveParams: false }));
    }
  };

  // Handle Vector Search Test query
  const performSearch = async (queryStr) => {
    setLoading((prev) => ({ ...prev, search: true }));
    setSearchResults("");

    try {
      const res = await fetch(`${API_BASE}/api/rag/search?query=${encodeURIComponent(queryStr)}`);
      const data = await res.json();
      if (res.ok) {
        setSearchResults(data.results || "Eşleşen sonuç bulunamadı.");
      } else {
        setSearchResults("Arama sorgusu başarısız oldu.");
      }
    } catch (err) {
      setSearchResults("Bağlantı hatası.");
    } finally {
      setLoading((prev) => ({ ...prev, search: false }));
    }
  };

  const handleSearchTest = (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    performSearch(searchQuery);
  };

  const handleQuickSearch = (queryStr) => {
    setSearchQuery(queryStr);
    performSearch(queryStr);
  };

  // Handle source deletion triggers
  const triggerDeleteSource = (name) => {
    setDeleteTargetName(name);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetName) return;
    try {
      const res = await fetch(`${API_BASE}/api/rag/sources?name=${encodeURIComponent(deleteTargetName)}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: "success", message: `"${deleteTargetName}" bilgi bankasından temizlendi.` });
        fetchSources();
      } else {
        setStatus({ type: "error", message: data.detail || "Kaynak silinemedi." });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Ağ hatası oluştu." });
    } finally {
      setIsDeleteModalOpen(false);
      setDeleteTargetName(null);
    }
  };

  // Handle adding a shareable AI media item
  const handleAddMedia = async (e) => {
    e.preventDefault();
    if (!mediaTitle || !mediaDesc || !mediaFile) return;

    setLoading((prev) => ({ ...prev, media: true }));
    setStatus({ type: "", message: "" });

    const activeTenantId = typeof window !== "undefined" ? (localStorage.getItem("active_tenant_id") || "tenant-default") : "tenant-default";
    const formData = new FormData();
    formData.append("title", mediaTitle);
    formData.append("description", mediaDesc);
    formData.append("file", mediaFile);
    formData.append("also_index_pdf", alsoIndexPdf ? "true" : "false");

    try {
      const res = await fetch(`${API_BASE}/api/rag/media?tenant_id=${activeTenantId}`, {
        method: "POST",
        headers: { "X-Tenant-ID": activeTenantId },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({
          type: "success",
          message: `"${mediaTitle}" AI Medya Kütüphanesine eklendi! Yapay zeka artık WhatsApp, Telegram ve E-Posta üzerinden bu dosyayı otomatik gönderebilir.`
        });
        setMediaTitle("");
        setMediaDesc("");
        setMediaFile(null);
        fetchMediaLibrary();
        if (alsoIndexPdf && mediaFile.name.toLowerCase().endsWith(".pdf")) {
          fetchSources();
        }
      } else {
        setStatus({ type: "error", message: data.detail || "Medya yüklenemedi." });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Ağ hatası oluştu." });
    } finally {
      setLoading((prev) => ({ ...prev, media: false }));
    }
  };

  const triggerDeleteMedia = (item) => {
    setDeleteMediaTarget(item);
    setIsDeleteMediaModalOpen(true);
  };

  const handleConfirmDeleteMedia = async () => {
    if (!deleteMediaTarget) return;
    const activeTenantId = typeof window !== "undefined" ? (localStorage.getItem("active_tenant_id") || "tenant-default") : "tenant-default";
    try {
      const res = await fetch(`${API_BASE}/api/rag/media/${deleteMediaTarget.id}?tenant_id=${activeTenantId}`, {
        method: "DELETE",
        headers: { "X-Tenant-ID": activeTenantId }
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: "success", message: `"${deleteMediaTarget.title}" medya kütüphanesinden silindi.` });
        fetchMediaLibrary();
      } else {
        setStatus({ type: "error", message: data.detail || "Medya silinemedi." });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Ağ hatası oluştu." });
    } finally {
      setIsDeleteMediaModalOpen(false);
      setDeleteMediaTarget(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-slate-800 dark:text-slate-100 w-full font-sans transition-colors duration-300">
      
      {/* Page Title */}
      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-50 dark:bg-primary/20 text-primary dark:text-purple-400 border border-purple-100 dark:border-purple-900/40 rounded-2xl">
            <Database size={24} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Bilgi Bankası (RAG) Kurulumu & Yönetimi</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Yapay zekanın çağrılarda kullanacağı dökümanları, web sitelerini ve omnichannel kanallarda göndereceği medya/katalog dosyalarını yönetin.
            </p>
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="flex items-center gap-2 text-[10px] bg-slate-100/60 dark:bg-slate-900 px-3 py-1.5 rounded-full border border-slate-200/65 dark:border-slate-800/80 font-bold uppercase tracking-wider text-slate-500">
          <span className="h-2 w-2 bg-primary rounded-full animate-pulse"></span>
          Vector DB: pgvector (active)
        </div>
      </div>

      {/* Main Responsive Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full items-start">
        
        {/* Left Span (2/3 width) - Parameters, Inputs & Source List */}
        <div className="lg:col-span-2 flex flex-col gap-6 w-full">
          
          {/* RAG Parameters Tuning Card */}
          <div className="flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <Sliders className="text-primary dark:text-indigo-400" size={18} />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">RAG İndeksleme ve Arama Parametreleri (Tuning)</h3>
            </div>
            
            <form onSubmit={handleSaveParams} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Metin Bölme Boyutu (Chunk Size)</label>
                <input
                  type="number"
                  value={ragParams.chunk_size}
                  onChange={(e) => setRagParams((prev) => ({ ...prev, chunk_size: parseInt(e.target.value) || 800 }))}
                  required
                  min="100"
                  max="5000"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-mono font-bold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Bölme Çakışma Oranı (Chunk Overlap)</label>
                <input
                  type="number"
                  value={ragParams.chunk_overlap}
                  onChange={(e) => setRagParams((prev) => ({ ...prev, chunk_overlap: parseInt(e.target.value) || 100 }))}
                  required
                  min="0"
                  max="1000"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-mono font-bold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Eşleşme Sayısı (Top K)</label>
                <input
                  type="number"
                  value={ragParams.top_k}
                  onChange={(e) => setRagParams((prev) => ({ ...prev, top_k: parseInt(e.target.value) || 3 }))}
                  required
                  min="1"
                  max="20"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-mono font-bold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider flex justify-between">
                  <span>Asgari Benzerlik Eşiği</span>
                  <span className="font-mono font-bold text-primary dark:text-indigo-400">{Math.round(ragParams.similarity_threshold * 100)}%</span>
                </label>
                <div className="flex gap-2 items-center h-9">
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={ragParams.similarity_threshold}
                    onChange={(e) => setRagParams((prev) => ({ ...prev, similarity_threshold: parseFloat(e.target.value) || 0.5 }))}
                    className="w-full appearance-none bg-slate-200 dark:bg-slate-700 h-1.5 rounded-lg accent-primary"
                  />
                  <button
                    type="submit"
                    disabled={loading.saveParams}
                    className={`px-3 py-2 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition flex items-center justify-center shrink-0 shadow-sm`}
                  >
                    {loading.saveParams ? <RefreshCw size={12} className="animate-spin" /> : "Kaydet"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Forms Section Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Web Site Crawling Card */}
            <div className="flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800/60 pb-3">
                <Globe className="text-primary dark:text-blue-400" size={18} />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-330">Web Sitesi Tarama</h3>
              </div>
              <form onSubmit={handleCrawlUrl} className="flex flex-col gap-3 h-full justify-between">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-slate-450 dark:text-slate-505 font-bold uppercase tracking-wider">Taranacak URL</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://firmamiz.com/sss"
                      required
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                    />
                    <button
                      type="submit"
                      disabled={loading.crawl}
                      className={`flex items-center justify-center p-2.5 ${bg} ${hover} disabled:opacity-50 text-white transition rounded-xl shadow-sm`}
                    >
                      {loading.crawl ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-505 font-medium mt-3">Site içeriği taranarak pgvector veri tabanına eklenecektir.</p>
              </form>
            </div>

            {/* PDF Upload Card */}
            <div className="flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800/60 pb-3">
                <FileText className="text-primary dark:text-emerald-400" size={18} />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-330">PDF Dosya Yükleme</h3>
              </div>
              <form onSubmit={handleUploadPdf} className="flex flex-col gap-3 h-full justify-between">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-slate-455 dark:text-slate-505 font-bold uppercase tracking-wider">PDF Belgesi Seç</label>
                  <div className="flex gap-2 items-center">
                    <label className="flex-1 flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-505 dark:text-slate-450 cursor-pointer hover:border-slate-350 dark:hover:border-slate-700 transition font-medium overflow-hidden">
                      <span className="truncate mr-2">{pdfFile ? pdfFile.name : "Dosya seçilmedi..."}</span>
                      <Upload size={14} className="text-slate-400 dark:text-slate-505 shrink-0" />
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setPdfFile(e.target.files[0])}
                        className="hidden"
                        required
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={loading.upload}
                      className={`flex items-center justify-center p-2.5 ${bg} ${hover} disabled:opacity-50 text-white transition rounded-xl h-9 w-9 shrink-0 shadow-sm`}
                    >
                      {loading.upload ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-505 font-medium mt-3">PDF dökümanı parse edilerek anlam vektörleri üretilecektir.</p>
              </form>
            </div>

            {/* Manual Data Snippet Card */}
            <div className="flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800/60 pb-3">
                <Plus className="text-primary dark:text-rose-450" size={18} />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Manuel Bilgi / SSS Ekle</h3>
              </div>
              <form onSubmit={handleManualSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <input
                    type="text"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="Konu Başlığı (Örn: SSS - Kargo)"
                    required
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-250 focus:outline-none focus:border-rose-500 font-bold"
                  />
                  <textarea
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    rows={1}
                    placeholder="Yapay zekanın bilmesini istediğiniz detayı yazın..."
                    required
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-250 focus:outline-none focus:border-rose-500 resize-none font-medium"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading.manual}
                  className="py-1.5 bg-primary hover:bg-primary disabled:bg-rose-700 text-white rounded-xl text-[10px] font-extrabold flex items-center justify-center gap-1 transition shadow-sm"
                >
                  {loading.manual ? <RefreshCw size={11} className="animate-spin" /> : <Send size={11} />} Bilgiyi İndeksle
                </button>
              </form>
            </div>

          </div>

          {/* Feedback Status */}
          {status.message && (
            <div className={`p-3.5 border rounded-2xl flex items-center gap-2 text-xs font-semibold ${
              status.type === "success" 
                ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-355"
                : "bg-rose-50 dark:bg-rose-950/20 border-rose-200/50 dark:border-rose-900/30 text-rose-700 dark:text-rose-350"
            }`}>
              {status.type === "success" ? <CheckCircle size={15} className="text-primary" /> : <AlertTriangle size={15} className="text-primary" />}
              <span>{status.message}</span>
            </div>
          )}

          {/* AI Shareable Media & Catalog Library Section */}
          <div className="flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="text-primary" size={18} />
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    AI Medya & Katalog Kütüphanesi (Otomatik Dosya Gönderimi)
                    <span className="px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      WhatsApp • Telegram • Mail
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                    Müşteri sohbet sırasında katalog, fiyat listesi, broşür, görsel veya video istediğinde yapay zeka buradaki dosyaları otomatik olarak gönderir.
                  </p>
                </div>
              </div>
              <span className="text-[10px] bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 px-2.5 py-1 rounded-lg font-bold text-slate-500 font-mono">
                Kayıtlı Medya: {mediaItems.length}
              </span>
            </div>

            {/* Add Media Form */}
            <form onSubmit={handleAddMedia} className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50/70 dark:bg-slate-950/50 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800/80 mb-4">
              <div className="md:col-span-3 flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Dosya / Katalog Adı</label>
                <input
                  type="text"
                  value={mediaTitle}
                  onChange={(e) => setMediaTitle(e.target.value)}
                  placeholder="Örn: 2026 Fiyat Kataloğu"
                  required
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary font-semibold"
                />
              </div>

              <div className="md:col-span-5 flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">AI Gönderim Koşulu (Ne Zaman Gönderilsin?)</label>
                <input
                  type="text"
                  value={mediaDesc}
                  onChange={(e) => setMediaDesc(e.target.value)}
                  placeholder="Örn: Müşteri fiyat listesi, katalog veya broşür sorduğunda gönder"
                  required
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary font-medium"
                />
              </div>

              <div className="md:col-span-4 flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Medya Dosyası (PDF, Görsel, Video, Ses)</label>
                <div className="flex gap-2 items-center">
                  <label className="flex-1 flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition font-medium overflow-hidden">
                    <span className="truncate mr-2">{mediaFile ? mediaFile.name : "Dosya seçin..."}</span>
                    <Upload size={14} className="text-slate-400 shrink-0" />
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.mp4,.mp3,.wav,.ogg,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => setMediaFile(e.target.files[0])}
                      className="hidden"
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={loading.media}
                    title="Kütüphaneye Ekle"
                    className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition shadow-sm"
                  >
                    {loading.media ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={16} />}
                  </button>
                </div>
              </div>

              {/* Quick Condition Templates & PDF Index Toggle */}
              <div className="md:col-span-12 flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase">Hızlı Koşul:</span>
                  {[
                    "Müşteri fiyat listesi veya katalog istediğinde gönder",
                    "Müşteri ürün görseli veya örnek fotoğraf istediğinde gönder",
                    "Müşteri tanıtım videosu veya kurulum videosu istediğinde gönder",
                    "Müşteri konum krokisi veya teknik şartname istediğinde gönder"
                  ].map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setMediaDesc(tpl)}
                      className="px-2 py-0.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/70 dark:border-slate-800 rounded-md text-[9px] font-medium transition"
                    >
                      {tpl.replace("Müşteri ", "").replace(" istediğinde gönder", "")}
                    </button>
                  ))}
                </div>

                {mediaFile && mediaFile.name.toLowerCase().endsWith(".pdf") && (
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alsoIndexPdf}
                      onChange={(e) => setAlsoIndexPdf(e.target.checked)}
                      className="rounded accent-primary"
                    />
                    <span>PDF içindeki metinleri de Bilgi Bankasına (RAG) indeksle</span>
                  </label>
                )}
              </div>
            </form>

            {/* Media Items Table */}
            {mediaItems.length === 0 ? (
              <p className="text-xs text-slate-450 dark:text-slate-500 text-center py-5 font-semibold">
                Henüz paylaşılabilir medya veya katalog eklenmedi. Yukarıdaki formdan PDF katalog, fiyat listesi, görsel veya video ekleyebilirsiniz.
              </p>
            ) : (
              <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider sticky top-0 bg-white dark:bg-slate-900 z-10 py-2">
                      <th className="py-2.5">Tür & Başlık</th>
                      <th className="py-2.5">AI Gönderim Koşulu</th>
                      <th className="py-2.5">Dosya</th>
                      <th className="py-2.5 text-center w-20">Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mediaItems.map((item) => {
                      const mType = item.media_type || "document";
                      return (
                        <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-950/20 text-slate-700 dark:text-slate-300 font-medium">
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-primary shrink-0">
                                {mType === "image" ? <ImageIcon size={14} /> : mType === "video" ? <Film size={14} /> : mType === "audio" ? <Music size={14} /> : <FileText size={14} />}
                              </span>
                              <div>
                                <div className="font-bold text-xs text-slate-800 dark:text-slate-100">{item.title}</div>
                                <div className="text-[9px] text-slate-400 font-mono uppercase">{mType}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 pr-3 text-[11px] text-slate-600 dark:text-slate-400 max-w-xs">
                            {item.description}
                          </td>
                          <td className="py-2.5 pr-3">
                            <a
                              href={item.url?.startsWith("http") ? item.url : `${API_BASE}${item.url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-mono text-primary hover:underline truncate max-w-[160px]"
                              title={item.filename}
                            >
                              <span className="truncate">{item.filename}</span>
                              <ExternalLink size={11} className="shrink-0" />
                            </a>
                          </td>
                          <td className="py-2.5 text-center">
                            <button
                              onClick={() => triggerDeleteMedia(item)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition"
                              title="Medyayı Sil"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sources List Table */}
          <div className="flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">İndekslenmiş Veri Kaynakları</h3>
              <span className="text-[10px] bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 px-2.5 py-1 rounded-lg font-bold text-slate-500 font-mono">
                Toplam Kaynak: {sources.length}
              </span>
            </div>
            
            {sources.length === 0 ? (
              <p className="text-xs text-slate-450 dark:text-slate-500 text-center py-6 font-semibold">Henüz indekslenmiş döküman veya web sitesi bulunmuyor.</p>
            ) : (
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider sticky top-0 bg-white dark:bg-slate-900 z-10 py-2">
                      <th className="py-2.5">Kaynak Adı / URL</th>
                      <th className="py-2.5 text-right pr-6">Durum</th>
                      <th className="py-2.5 text-center w-20">Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((src, index) => (
                      <tr key={index} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-950/20 text-slate-655 dark:text-slate-300 font-medium">
                        <td className="py-3 font-mono text-[10px] text-slate-550 dark:text-slate-300 truncate max-w-sm" title={src.name}>
                          {src.name}
                        </td>
                        <td className="py-3 text-right pr-6">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full border border-emerald-100/50 dark:border-emerald-900/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                            İndekslendi
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <button
                            onClick={() => triggerDeleteSource(src.name)}
                            className="p-1.5 text-slate-400 hover:text-primary hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-transparent rounded-lg transition"
                            title="Kaynağı İndeksten Sil"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Right Span (1/3 width) - Semantic Search Playground */}
        <div className="lg:col-span-1 flex flex-col gap-6 w-full">
          
          <div className="flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300 min-h-[580px]">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <Search className="text-primary dark:text-purple-400" size={18} />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
                Vektör Arama Testi
                <Sparkles size={11} className="text-primary animate-pulse" />
              </h3>
            </div>
            
            <form onSubmit={handleSearchTest} className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Öğretilen bilgileri sorgulayın..."
                required
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-medium shadow-inner"
              />
              <button
                type="submit"
                disabled={loading.search}
                className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-white transition rounded-xl font-bold text-xs flex items-center justify-center shrink-0 shadow-sm"
              >
                {loading.search ? <RefreshCw size={13} className="animate-spin" /> : "Sorgula"}
              </button>
            </form>

            {/* Quick suggestions templates */}
            <div className="mb-4">
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block mb-2">Hızlı Sorgu Şablonları</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleQuickSearch("Çalışma saatleri")}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-purple-50 dark:bg-slate-950/60 dark:hover:bg-purple-950/20 text-slate-600 dark:text-slate-400 hover:text-primary border border-slate-200/60 dark:border-slate-800/80 rounded-lg text-[9px] font-semibold transition"
                >
                  Çalışma Saatleri
                </button>
                <button
                  onClick={() => handleQuickSearch("İletişim adresi")}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-purple-50 dark:bg-slate-950/60 dark:hover:bg-purple-950/20 text-slate-600 dark:text-slate-400 hover:text-primary border border-slate-200/60 dark:border-slate-800/80 rounded-lg text-[9px] font-semibold transition"
                >
                  İletişim Adresi
                </button>
                <button
                  onClick={() => handleQuickSearch("Kurulum adımları")}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-purple-50 dark:bg-slate-950/60 dark:hover:bg-purple-950/20 text-slate-600 dark:text-slate-400 hover:text-primary border border-slate-200/60 dark:border-slate-800/80 rounded-lg text-[9px] font-semibold transition"
                >
                  Kurulum Kılavuzu
                </button>
              </div>
            </div>

            {/* Matching Results Console */}
            <div className="flex-1 flex flex-col justify-start bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-850 rounded-xl p-3.5 shadow-inner">
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block mb-2 border-b border-slate-200/60 dark:border-slate-800/80 pb-1">
                Eşleşen Benzer Metin Parçaları (Chunks)
              </span>

              {searchResults ? (
                <div className="text-[10px] text-slate-700 dark:text-slate-300 font-mono leading-relaxed max-h-[360px] overflow-y-auto whitespace-pre-line select-text pr-1.5">
                  {searchResults}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 p-6">
                  <Sparkles size={24} className="text-slate-300 dark:text-slate-700 mb-2 animate-bounce" />
                  <p className="text-[10px] font-semibold leading-relaxed">
                    Sorguladığınız kelimelere göre veritabanından en yakın anlam eşleşmeleri (similarity chunks) burada listelenecektir.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-start gap-1.5 text-[9px] text-slate-450 dark:text-slate-500 leading-relaxed font-semibold">
              <HelpCircle size={12} className="text-slate-400 mt-0.5 shrink-0" />
              <span>Yapay zeka asistanı, çağrı sırasında bir soru aldığında yukarıda test ettiğiniz anlamsal aramayı yapar ve eşleşen bilgiyi kullanarak cevap üretir.</span>
            </div>

          </div>

        </div>

      </div>

      {/* Custom Delete Confirmation Modal for RAG Sources */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteTargetName(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Veri Kaynağını Sil"
        message={`"${deleteTargetName}" kaynağını ve buna ait tüm indekslenmiş anlam vektörü chunk'larını silmek istediğinize emin misiniz? Yapay zeka artık bu verilere erişemez.`}
      />

      {/* Custom Delete Confirmation Modal for AI Media Items */}
      <ConfirmDeleteModal
        isOpen={isDeleteMediaModalOpen}
        onClose={() => {
          setIsDeleteMediaModalOpen(false);
          setDeleteMediaTarget(null);
        }}
        onConfirm={handleConfirmDeleteMedia}
        title="Medya Dosyasını Sil"
        message={`"${deleteMediaTarget?.title}" dosyasını AI Medya Kütüphanesinden silmek istediğinize emin misiniz? Yapay zeka artık bu dosyayı müşterilere gönderemeyecektir.`}
      />

    </div>
  );
}
