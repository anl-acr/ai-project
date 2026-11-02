import React, { useState, useEffect, useRef } from "react";
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
  ExternalLink,
  BookOpen,
  Save,
  X
} from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, getActiveTenantId, tenantFetch } from "../../utils/apiHost";

const KB_TABS = [
  {
    id: "sources",
    label: "Veri Kaynakları",
    icon: Database
  },
  {
    id: "ingest",
    label: "Veri Ekleme (Web / PDF / SSS)",
    icon: Upload
  },
  {
    id: "media",
    label: "AI Medya & Katalog",
    icon: FolderOpen
  },
  {
    id: "search_test",
    label: "Vektör Arama Testi",
    icon: Search
  },
  {
    id: "tuning",
    label: "RAG Motoru & Parametreler",
    icon: Sliders
  }
];

const MANUAL_FAQ_TEMPLATES = [
  {
    label: "Çalışma Saatleri & Tatiller",
    title: "SSS - Çalışma Saatleri",
    text: "Şirketimiz hafta içi Pazartesi - Cuma günleri 09:00 - 18:00 saatleri arasında hizmet vermektedir. Cumartesi, Pazar ve resmi tatillerde teknik acil destek hattımız aktiftir."
  },
  {
    label: "İade & Değişim Politikası",
    title: "SSS - İade ve Değişim Koşulları",
    text: "Satın alınan ürün veya hizmetlerde 14 gün içerisinde koşulsuz iade ve değişim hakkı bulunmaktadır. İade talebi için fatura numarası ile müşteri temsilcimize başvurabilirsiniz."
  },
  {
    label: "Şirket Adresi & Ulaşım",
    title: "SSS - İletişim ve Adres Bilgileri",
    text: "Merkez ofisimiz İstanbul Maslak Teknoloji Kampüsü'nde yer almaktadır. Metro İTÜ-Ayazağa durağından 5 dakikalık yürüme mesafesindedir, misafir otoparkımız mevcuttur."
  },
  {
    label: "Fiyatlandırma & Kampanya",
    title: "SSS - Güncel Paket ve Fiyatlar",
    text: "Yıllık kurumsal aboneliklerde %20 indirim ve ücretsiz kurulum desteği sunulmaktadır. Detaylı teklif için satış birimimiz aynı gün içinde dönüş sağlar."
  }
];

function inferSourceKind(name = "") {
  const lower = String(name || "").toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    return "web";
  }
  if (lower.endsWith(".pdf")) {
    return "pdf";
  }
  return "manual";
}

export default function KnowledgeBase({
  backendHost = "localhost:8000",
  userPermissions = ["*"]
}) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();

  const hasPerm = (code) => {
    if (!Array.isArray(userPermissions)) return true;
    return userPermissions.includes("*") || userPermissions.includes(code);
  };
  const canWrite = hasPerm("rag_kb:write");
  const canDelete = hasPerm("rag_kb:delete");

  const [activeKbTab, setActiveKbTab] = useState("sources");
  const tabButtonRefs = useRef({});

  // Sources filter states
  const [sourceFilterQuery, setSourceFilterQuery] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("ALL"); // ALL, web, pdf, manual

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
  const [loading, setLoading] = useState({
    sources: false,
    upload: false,
    crawl: false,
    search: false,
    saveParams: false,
    manual: false,
    media: false
  });
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

  // Auto-dismiss status banner after 6s
  useEffect(() => {
    if (!status.message) return;
    const timer = setTimeout(() => {
      setStatus({ type: "", message: "" });
    }, 6000);
    return () => clearTimeout(timer);
  }, [status]);

  // Fetch indexed sources list
  const fetchSources = () => {
    const activeTenantId = getActiveTenantId();
    setLoading((prev) => ({ ...prev, sources: true }));
    tenantFetch(`${API_BASE}/api/rag/sources?tenant_id=${encodeURIComponent(activeTenantId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSources(data);
      })
      .catch((err) => console.error("[RAG] Kaynak listesi alinamadi:", err))
      .finally(() => setLoading((prev) => ({ ...prev, sources: false })));
  };

  // Fetch AI Shareable Media Library
  const fetchMediaLibrary = () => {
    const activeTenantId = getActiveTenantId();
    tenantFetch(`${API_BASE}/api/rag/media?tenant_id=${encodeURIComponent(activeTenantId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setMediaItems(data);
      })
      .catch((err) => console.error("[RAG] Medya kutuphanesi alinamadi:", err));
  };

  // Fetch tuning parameters
  const fetchParams = () => {
    const activeTenantId = getActiveTenantId();
    tenantFetch(`${API_BASE}/api/settings/rag?tenant_id=${encodeURIComponent(activeTenantId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === "object") {
          setRagParams((prev) => ({ ...prev, ...data }));
        }
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

    const handleSwitchSubtab = (e) => {
      const requested = e?.detail?.subTab;
      if (requested && KB_TABS.some((t) => t.id === requested)) {
        setActiveKbTab(requested);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("tenantChanged", handleTenantChange);
      window.addEventListener("SWITCH_KB_SUBTAB", handleSwitchSubtab);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("tenantChanged", handleTenantChange);
        window.removeEventListener("SWITCH_KB_SUBTAB", handleSwitchSubtab);
      }
    };
  }, []);

  // Accessible keyboard navigation for vertical/horizontal ARIA tablist
  const handleTabKeyDown = (e, idx) => {
    let nextIdx = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      nextIdx = (idx + 1) % KB_TABS.length;
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      nextIdx = (idx - 1 + KB_TABS.length) % KB_TABS.length;
    } else if (e.key === "Home") {
      nextIdx = 0;
    } else if (e.key === "End") {
      nextIdx = KB_TABS.length - 1;
    }
    if (nextIdx !== null) {
      e.preventDefault();
      const nextTab = KB_TABS[nextIdx];
      setActiveKbTab(nextTab.id);
      const nextBtn = tabButtonRefs.current[nextTab.id];
      if (nextBtn) nextBtn.focus();
    }
  };

  // Handle URL crawling submit
  const handleCrawlUrl = async (e) => {
    e.preventDefault();
    if (!urlInput || !canWrite) return;

    setLoading((prev) => ({ ...prev, crawl: true }));
    setStatus({ type: "", message: "" });

    try {
      const res = await tenantFetch(`${API_BASE}/api/rag/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput })
      });
      const data = await res.json();

      if (res.ok) {
        setStatus({ type: "success", message: "Web sitesi başarıyla tarandı ve bilgi bankasına indekslendi!" });
        setUrlInput("");
        fetchSources();
      } else {
        setStatus({ type: "error", message: data.detail || "Web sitesi taraması başarısız oldu." });
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
    if (!pdfFile || !canWrite) return;

    setLoading((prev) => ({ ...prev, upload: true }));
    setStatus({ type: "", message: "" });

    const formData = new FormData();
    formData.append("file", pdfFile);

    try {
      const res = await tenantFetch(`${API_BASE}/api/rag/upload-pdf`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (res.ok) {
        setStatus({ type: "success", message: `"${pdfFile.name}" PDF dökümanı başarıyla indekslendi!` });
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
    if (!manualTitle || !manualText || !canWrite) return;

    setLoading((prev) => ({ ...prev, manual: true }));
    setStatus({ type: "", message: "" });

    try {
      const res = await tenantFetch(`${API_BASE}/api/rag/manual`, {
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
    if (e && e.preventDefault) e.preventDefault();
    if (!canWrite) return;

    setLoading((prev) => ({ ...prev, saveParams: true }));
    setStatus({ type: "", message: "" });

    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/rag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ragParams)
      });
      const data = await res.json();

      if (res.ok) {
        setStatus({
          type: "success",
          message: "RAG motoru parametreleri başarıyla kaydedildi! Yeni yüklemeler ve sorgular bu ayarlarla işlenecektir."
        });
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
      const res = await tenantFetch(`${API_BASE}/api/rag/search?query=${encodeURIComponent(queryStr)}`);
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
    if (!searchQuery.trim()) return;
    performSearch(searchQuery.trim());
  };

  const handleQuickSearch = (queryStr) => {
    setSearchQuery(queryStr);
    performSearch(queryStr);
  };

  // Handle source deletion triggers
  const triggerDeleteSource = (name) => {
    if (!canDelete) return;
    setDeleteTargetName(name);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetName || !canDelete) return;
    try {
      const res = await tenantFetch(`${API_BASE}/api/rag/sources?name=${encodeURIComponent(deleteTargetName)}`, {
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
    if (!mediaTitle || !mediaDesc || !mediaFile || !canWrite) return;

    setLoading((prev) => ({ ...prev, media: true }));
    setStatus({ type: "", message: "" });

    const activeTenantId = getActiveTenantId();
    const formData = new FormData();
    formData.append("title", mediaTitle);
    formData.append("description", mediaDesc);
    formData.append("file", mediaFile);
    formData.append("also_index_pdf", alsoIndexPdf ? "true" : "false");

    try {
      const res = await tenantFetch(`${API_BASE}/api/rag/media?tenant_id=${encodeURIComponent(activeTenantId)}`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({
          type: "success",
          message: `"${mediaTitle}" AI Medya Kütüphanesine eklendi! Yapay zeka artık WhatsApp, Telegram ve E-Posta üzerinden bu dosyayı otomatik gönderebilir.`
        });
        const uploadedWasPdf = mediaFile.name.toLowerCase().endsWith(".pdf");
        setMediaTitle("");
        setMediaDesc("");
        setMediaFile(null);
        fetchMediaLibrary();
        if (alsoIndexPdf && uploadedWasPdf) {
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
    if (!canDelete) return;
    setDeleteMediaTarget(item);
    setIsDeleteMediaModalOpen(true);
  };

  const handleConfirmDeleteMedia = async () => {
    if (!deleteMediaTarget || !canDelete) return;
    const activeTenantId = getActiveTenantId();
    try {
      const res = await tenantFetch(
        `${API_BASE}/api/rag/media/${deleteMediaTarget.id}?tenant_id=${encodeURIComponent(activeTenantId)}`,
        { method: "DELETE" }
      );
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

  const filteredSources = sources.filter((src) => {
    const nameStr = String(src?.name || "");
    const kind = inferSourceKind(nameStr);
    if (sourceTypeFilter !== "ALL" && kind !== sourceTypeFilter) {
      return false;
    }
    if (sourceFilterQuery.trim()) {
      return nameStr.toLowerCase().includes(sourceFilterQuery.trim().toLowerCase());
    }
    return true;
  });

  const webCount = sources.filter((s) => inferSourceKind(s?.name) === "web").length;
  const pdfCount = sources.filter((s) => inferSourceKind(s?.name) === "pdf").length;
  const manualCount = sources.filter((s) => inferSourceKind(s?.name) === "manual").length;

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 w-full font-sans transition-colors duration-300 animate-in fade-in duration-200">
      {/* Top Header matching AIAgentsSettings.js */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 ${lightBg} ${text} border ${borderLight} rounded-2xl shrink-0`}>
            <Database size={24} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
              <span>Bilgi Bankası (RAG) & Medya Yönetimi</span>
              <span className="inline-flex items-center gap-1.5 text-[10px] bg-slate-100/80 dark:bg-slate-900 px-2.5 py-0.5 rounded-full border border-slate-200/70 dark:border-slate-800 font-bold uppercase tracking-wider text-slate-500">
                <span className={`h-2 w-2 ${bg} rounded-full animate-pulse`} />
                pgvector Aktif
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Yapay zekanın çağrılarda kullanacağı dökümanları, web sitelerini, medya kataloglarını ve vektör arama parametrelerini sekmelerden yönetin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden xl:flex items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 px-3 py-1.5 rounded-xl">
            <span>Kaynak: <strong className="text-slate-800 dark:text-slate-100 font-mono">{sources.length}</strong></span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span>Medya: <strong className="text-slate-800 dark:text-slate-100 font-mono">{mediaItems.length}</strong></span>
          </div>

          {canWrite && activeKbTab !== "ingest" && (
            <button
              type="button"
              onClick={() => setActiveKbTab("ingest")}
              className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              title="Yeni Veri Kaynağı Ekle"
              aria-label="Yeni Veri Kaynağı Ekle"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {status.message && (
        <div
          role={status.type === "error" ? "alert" : "status"}
          className={`p-3 border rounded-xl flex items-center justify-between gap-3 text-xs font-bold ${
            status.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/20 border-rose-200/50 dark:border-rose-900/30 text-rose-600 dark:text-rose-400"
          }`}
        >
          <div className="flex items-center gap-2">
            {status.type === "success" ? (
              <CheckCircle size={15} className="text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle size={15} className="text-rose-500 shrink-0" />
            )}
            <span>{status.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatus({ type: "", message: "" })}
            aria-label="Bildirimi kapat"
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Split Container with Left Sidebar Tabs & Right Content Area (Matching AIAgentsSettings.js) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[580px]">
        {/* Left Sidebar Navigation */}
        <div className="w-full md:w-64 bg-slate-50/50 dark:bg-slate-950/30 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800/60 p-4 shrink-0 flex flex-col justify-between gap-4">
          <div
            role="tablist"
            aria-label="Bilgi Bankası Bölümleri"
            className="space-y-1.5"
          >
            <div className="px-3 py-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              Bilgi Bankası Yapılandırması
            </div>

            {KB_TABS.map((tab, idx) => {
              const IconComp = tab.icon;
              const isActive = activeKbTab === tab.id;
              const badgeCount =
                tab.id === "sources"
                  ? sources.length
                  : tab.id === "media"
                  ? mediaItems.length
                  : null;

              return (
                <button
                  key={tab.id}
                  ref={(el) => {
                    tabButtonRefs.current[tab.id] = el;
                  }}
                  id={`kb-tab-${tab.id}`}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  aria-controls={`kb-panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  onClick={() => setActiveKbTab(tab.id)}
                  className={
                    "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left focus-visible:outline-none focus-visible:ring-2 " +
                    ring +
                    " " +
                    (isActive
                      ? "bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700"
                      : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")
                  }
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <IconComp size={15} className="shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </span>
                  {badgeCount !== null && (
                    <span
                      className={
                        "px-1.5 py-0.5 rounded-md text-[10px] font-mono font-extrabold shrink-0 " +
                        (isActive
                          ? `${lightBg} ${text}`
                          : "bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400")
                      }
                    >
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Compact Vector Summary Box at Bottom of Left Sidebar */}
          <div className="hidden md:flex flex-col gap-2 p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/80 text-[10px]">
            <div className="flex items-center justify-between font-extrabold text-slate-600 dark:text-slate-300">
              <span>Aktif İndeks Özeti</span>
              <Sparkles size={12} className={text} />
            </div>
            <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
              <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                <div className="font-mono font-extrabold text-xs text-slate-800 dark:text-slate-100">{webCount}</div>
                <div className="text-[9px] text-slate-400 font-semibold">Web</div>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                <div className="font-mono font-extrabold text-xs text-slate-800 dark:text-slate-100">{pdfCount}</div>
                <div className="text-[9px] text-slate-400 font-semibold">PDF</div>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                <div className="font-mono font-extrabold text-xs text-slate-800 dark:text-slate-100">{manualCount}</div>
                <div className="text-[9px] text-slate-400 font-semibold">SSS</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Tab Content Area */}
        <div
          id={`kb-panel-${activeKbTab}`}
          role="tabpanel"
          aria-labelledby={`kb-tab-${activeKbTab}`}
          className="flex-1 p-6 overflow-y-auto"
        >
          {/* TAB 1: VERİ KAYNAKLARI (INDEXED SOURCES) */}
          {activeKbTab === "sources" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                    İndekslenmiş Veri Kaynakları
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Yapay zeka temsilcilerinizin aktif olarak cevap üretirken kullandığı web sayfaları, PDF dökümanları ve SSS kayıtları.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={fetchSources}
                    disabled={loading.sources}
                    className={`p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                    title="Kaynak Listesini Yenile"
                    aria-label="Kaynak Listesini Yenile"
                  >
                    <RefreshCw size={14} className={loading.sources ? "animate-spin" : ""} />
                  </button>

                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => setActiveKbTab("ingest")}
                      className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      title="Yeni Veri Kaynağı Ekle"
                      aria-label="Yeni Veri Kaynağı Ekle"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative w-full sm:w-64">
                  <label htmlFor="kb-source-filter" className="sr-only">
                    Veri kaynaklarında ara
                  </label>
                  <input
                    id="kb-source-filter"
                    type="text"
                    placeholder="Kaynak adı veya URL ara..."
                    value={sourceFilterQuery}
                    onChange={(e) => setSourceFilterQuery(e.target.value)}
                    className={`w-full text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 ${ring} focus:border-primary transition-all`}
                  />
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: "ALL", label: `Tümü (${sources.length})` },
                    { id: "web", label: `Web URL (${webCount})` },
                    { id: "pdf", label: `PDF (${pdfCount})` },
                    { id: "manual", label: `Manuel / SSS (${manualCount})` }
                  ].map((pill) => {
                    const active = sourceTypeFilter === pill.id;
                    return (
                      <button
                        key={pill.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSourceTypeFilter(pill.id)}
                        className={
                          "px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition border focus-visible:outline-none focus-visible:ring-2 " +
                          ring +
                          " " +
                          (active
                            ? `${lightBg} ${text} ${borderLight}`
                            : "bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200/70 dark:border-slate-800 hover:text-slate-700 dark:hover:text-slate-200")
                        }
                      >
                        {pill.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sources Table or Empty State */}
              {sources.length === 0 ? (
                <div className="py-16 px-6 text-center bg-slate-50/60 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3">
                  <Database size={32} className="text-slate-300 dark:text-slate-700" />
                  <div>
                    <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                      Henüz indekslenmiş döküman veya web sitesi bulunmuyor
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-md">
                      Web sitenizi taratarak, PDF yükleyerek veya sıkça sorulan soruları manuel ekleyerek yapay zeka temsilcilerinizi eğitebilirsiniz.
                    </p>
                  </div>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => setActiveKbTab("ingest")}
                      className={`mt-1 px-4 py-2 ${bg} ${hover} text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                    >
                      <Upload size={14} />
                      <span>Veri Ekleme Sekmesine Geç</span>
                    </button>
                  )}
                </div>
              ) : filteredSources.length === 0 ? (
                <div className="p-10 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500 text-xs font-semibold">
                  Arama veya filtre kriterine uygun veri kaynağı bulunamadı.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200/70 dark:border-slate-800 rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <caption className="sr-only">İndekslenmiş Bilgi Bankası Veri Kaynakları</caption>
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider bg-slate-50/80 dark:bg-slate-950/60 text-[10px]">
                        <th scope="col" className="py-3 px-4">Tür</th>
                        <th scope="col" className="py-3 px-4">Kaynak Adı / URL</th>
                        <th scope="col" className="py-3 px-4 text-right">Durum</th>
                        {canDelete && (
                          <th scope="col" className="py-3 px-4 text-center w-20">İşlem</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSources.map((src, index) => {
                        const kind = inferSourceKind(src.name);
                        const KindIcon = kind === "web" ? Globe : kind === "pdf" ? FileText : BookOpen;
                        const kindLabel = kind === "web" ? "Web URL" : kind === "pdf" ? "PDF" : "Manuel / SSS";

                        return (
                          <tr
                            key={`${src.name}-${index}`}
                            className="border-b last:border-b-0 border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/70 dark:hover:bg-slate-950/40 text-slate-700 dark:text-slate-200 font-medium transition-colors"
                          >
                            <td className="py-3 px-4 whitespace-nowrap w-32">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold ${lightBg} ${text} border ${borderLight}`}>
                                <KindIcon size={12} className="shrink-0" />
                                <span>{kindLabel}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-700 dark:text-slate-200 max-w-md truncate" title={src.name}>
                              {src.name}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-900/40">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                İndekslendi
                              </span>
                            </td>
                            {canDelete && (
                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => triggerDeleteSource(src.name)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                                  title="Kaynağı İndeksten Sil"
                                  aria-label={`${src.name} kaynağını sil`}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VERİ EKLEME & ÖĞRETME (WEB / PDF / MANUAL FAQ) */}
          {activeKbTab === "ingest" && (
            <div className="max-w-4xl space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                  Bilgi Bankasına Yeni Veri Öğretme
                </h3>
                <p className="text-[11px] text-slate-400">
                  Web sayfalarını tarayın, kurumsal PDF dökümanları yükleyin veya sıkça sorulan soruları doğrudan metin olarak indeksleyin.
                </p>
              </div>

              {!canWrite ? (
                <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>Bu rol profilinde Bilgi Bankasına yeni veri ekleme (`rag_kb:write`) yetkisi bulunmuyor.</span>
                </div>
              ) : (
                <>
                  {/* Top Row: Web Crawler + PDF Upload */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Web Site Crawling Card */}
                    <div className="flex flex-col justify-between p-5 bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl">
                      <div>
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className={`p-2 rounded-xl ${lightBg} ${text} border ${borderLight}`}>
                            <Globe size={16} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                              Web Sitesi Tarama (URL Crawler)
                            </h4>
                            <p className="text-[10px] text-slate-400 font-medium">
                              Kurumsal sayfa veya SSS bağlantısını otomatik okuyup vektörleştirir.
                            </p>
                          </div>
                        </div>

                        <form onSubmit={handleCrawlUrl} className="space-y-3 mt-4">
                          <div>
                            <label
                              htmlFor="kb-crawl-url"
                              className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5"
                            >
                              Taranacak Web Adresi (URL)
                            </label>
                            <div className="flex gap-2">
                              <input
                                id="kb-crawl-url"
                                type="url"
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                placeholder="https://firmamiz.com/sikca-sorulan-sorular"
                                required
                                className={`flex-1 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-medium focus-visible:outline-none focus-visible:ring-2 ${ring} focus:border-primary`}
                              />
                              <button
                                type="submit"
                                disabled={loading.crawl}
                                className={`px-4 py-2 ${bg} ${hover} disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                              >
                                {loading.crawl ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                                <span>Tara</span>
                              </button>
                            </div>
                          </div>
                        </form>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60">
                        SSL sertifikası farklı olan dahili ve harici kurumsal sayfalar güvenli şekilde desteklenir.
                      </p>
                    </div>

                    {/* PDF Upload Card */}
                    <div className="flex flex-col justify-between p-5 bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl">
                      <div>
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className={`p-2 rounded-xl ${lightBg} ${text} border ${borderLight}`}>
                            <FileText size={16} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                              PDF Döküman Yükleme
                            </h4>
                            <p className="text-[10px] text-slate-400 font-medium">
                              Kullanım kılavuzu, sözleşme, fiyat listesi veya eğitim dökümanlarını yükleyin.
                            </p>
                          </div>
                        </div>

                        <form onSubmit={handleUploadPdf} className="space-y-3 mt-4">
                          <div>
                            <label
                              htmlFor="kb-pdf-upload"
                              className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5"
                            >
                              PDF Belgesi Seçin
                            </label>
                            <div className="flex gap-2 items-center">
                              <label
                                htmlFor="kb-pdf-upload"
                                className="flex-1 flex items-center justify-between px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 cursor-pointer hover:border-primary transition font-medium overflow-hidden"
                              >
                                <span className="truncate mr-2">
                                  {pdfFile ? pdfFile.name : "Bilgisayardan PDF dosyası seçin..."}
                                </span>
                                <Upload size={14} className="text-slate-400 shrink-0" />
                                <input
                                  id="kb-pdf-upload"
                                  type="file"
                                  accept=".pdf"
                                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                                  className="sr-only"
                                  required
                                />
                              </label>
                              <button
                                type="submit"
                                disabled={loading.upload || !pdfFile}
                                className={`px-4 py-2 ${bg} ${hover} disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                              >
                                {loading.upload ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                                <span>Yükle</span>
                              </button>
                            </div>
                          </div>
                        </form>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60">
                        Sayfa metinleri otomatik ayrıştırılarak aktif RAG chunk boyutuna göre indekslenir.
                      </p>
                    </div>
                  </div>

                  {/* Full-Width Manual Knowledge / FAQ Card */}
                  <div className="p-5 bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${lightBg} ${text} border ${borderLight}`}>
                          <BookOpen size={16} />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                            Manuel Bilgi & Kurumsal SSS Öğretme
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Döküman yüklemeden yapay zekanın bilmesini istediğiniz kuralları, kampanya ve yanıtları doğrudan yazın.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Quick FAQ Templates (matching AIAgentsSettings Persona Templates) */}
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 space-y-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-600 dark:text-slate-300">
                        <Sparkles size={13} className={text} />
                        <span>Hazır Bilgi Şablonları (Tek Tıkla Doldur)</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {MANUAL_FAQ_TEMPLATES.map((tpl) => (
                          <button
                            key={tpl.label}
                            type="button"
                            onClick={() => {
                              setManualTitle(tpl.title);
                              setManualText(tpl.text);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-primary text-slate-700 dark:text-slate-200 transition focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                          >
                            + {tpl.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <form onSubmit={handleManualSubmit} className="space-y-4">
                      <div>
                        <label
                          htmlFor="kb-manual-title"
                          className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5"
                        >
                          Konu Başlığı / Etiket
                        </label>
                        <input
                          id="kb-manual-title"
                          type="text"
                          value={manualTitle}
                          onChange={(e) => setManualTitle(e.target.value)}
                          placeholder="Örn: SSS - Kargo ve Teslimat Süreleri"
                          required
                          className={`w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-bold focus-visible:outline-none focus-visible:ring-2 ${ring} focus:border-primary`}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="kb-manual-text"
                          className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5"
                        >
                          Öğretilecek Detaylı Bilgi Metni
                        </label>
                        <textarea
                          id="kb-manual-text"
                          value={manualText}
                          onChange={(e) => setManualText(e.target.value)}
                          rows={5}
                          placeholder="Yapay zekanın müşteriye aktaracağı doğru ve güncel bilgiyi detaylıca yazın..."
                          required
                          className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-medium leading-relaxed focus-visible:outline-none focus-visible:ring-2 ${ring} focus:border-primary`}
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={loading.manual}
                          className={`px-5 py-2.5 ${bg} ${hover} disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                        >
                          {loading.manual ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                          <span>Bilgiyi Bilgi Bankasına İndeksle</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: AI MEDYA & KATALOG KÜTÜPHANESİ */}
          {activeKbTab === "media" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                    <span>AI Medya & Katalog Kütüphanesi</span>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      WhatsApp • Telegram • E-Posta
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Müşteri sohbet sırasında katalog, fiyat listesi, broşür, görsel veya video istediğinde yapay zeka buradaki dosyaları otomatik gönderir.
                  </p>
                </div>

                <span className="text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 px-3 py-1.5 rounded-xl font-bold text-slate-500 font-mono">
                  Kayıtlı Medya: {mediaItems.length}
                </span>
              </div>

              {/* Add Media Form */}
              {canWrite && (
                <form
                  onSubmit={handleAddMedia}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3.5 bg-slate-50/70 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800"
                >
                  <div className="md:col-span-3 flex flex-col gap-1.5">
                    <label
                      htmlFor="kb-media-title"
                      className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider"
                    >
                      Dosya / Katalog Adı
                    </label>
                    <input
                      id="kb-media-title"
                      type="text"
                      value={mediaTitle}
                      onChange={(e) => setMediaTitle(e.target.value)}
                      placeholder="Örn: 2026 Fiyat Kataloğu"
                      required
                      className={`px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-semibold focus-visible:outline-none focus-visible:ring-2 ${ring} focus:border-primary`}
                    />
                  </div>

                  <div className="md:col-span-5 flex flex-col gap-1.5">
                    <label
                      htmlFor="kb-media-desc"
                      className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider"
                    >
                      AI Gönderim Koşulu (Ne Zaman Gönderilsin?)
                    </label>
                    <input
                      id="kb-media-desc"
                      type="text"
                      value={mediaDesc}
                      onChange={(e) => setMediaDesc(e.target.value)}
                      placeholder="Örn: Müşteri fiyat listesi, katalog veya broşür sorduğunda gönder"
                      required
                      className={`px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-medium focus-visible:outline-none focus-visible:ring-2 ${ring} focus:border-primary`}
                    />
                  </div>

                  <div className="md:col-span-4 flex flex-col gap-1.5">
                    <label
                      htmlFor="kb-media-file"
                      className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider"
                    >
                      Medya Dosyası (PDF, Görsel, Video, Ses)
                    </label>
                    <div className="flex gap-2 items-center">
                      <label
                        htmlFor="kb-media-file"
                        className="flex-1 flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:border-primary transition font-medium overflow-hidden"
                      >
                        <span className="truncate mr-2">{mediaFile ? mediaFile.name : "Dosya seçin..."}</span>
                        <Upload size={14} className="text-slate-400 shrink-0" />
                        <input
                          id="kb-media-file"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp,.mp4,.mp3,.wav,.ogg,.doc,.docx,.xls,.xlsx"
                          onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                          className="sr-only"
                          required
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={loading.media}
                        title="Medya Kütüphanesine Ekle"
                        aria-label="Medya Kütüphanesine Ekle"
                        className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        {loading.media ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Quick Condition Templates & PDF Index Toggle */}
                  <div className="md:col-span-12 flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                        Hızlı Koşul:
                      </span>
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
                          className={`px-2.5 py-1 bg-white dark:bg-slate-900 hover:border-primary text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 rounded-lg text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                        >
                          + {tpl.replace("Müşteri ", "").replace(" istediğinde gönder", "")}
                        </button>
                      ))}
                    </div>

                    {mediaFile && mediaFile.name.toLowerCase().endsWith(".pdf") && (
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 font-semibold cursor-pointer">
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
              )}

              {/* Media Items Table */}
              {mediaItems.length === 0 ? (
                <div className="py-14 px-6 text-center bg-slate-50/60 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2">
                  <FolderOpen size={30} className="text-slate-300 dark:text-slate-700" />
                  <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                    Henüz paylaşılabilir medya veya katalog eklenmedi
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-md">
                    Yukarıdaki formdan PDF katalog, fiyat listesi, ürün görseli veya tanıtım videosu ekleyerek yapay zekanın omnichannel kanallarda dosya paylaşmasını sağlayabilirsiniz.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200/70 dark:border-slate-800 rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <caption className="sr-only">AI Medya ve Katalog Kütüphanesi Dosyaları</caption>
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider bg-slate-50/80 dark:bg-slate-950/60 text-[10px]">
                        <th scope="col" className="py-3 px-4">Tür & Başlık</th>
                        <th scope="col" className="py-3 px-4">AI Gönderim Koşulu</th>
                        <th scope="col" className="py-3 px-4">Dosya Bağlantısı</th>
                        {canDelete && (
                          <th scope="col" className="py-3 px-4 text-center w-20">İşlem</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {mediaItems.map((item) => {
                        const mType = item.media_type || "document";
                        return (
                          <tr
                            key={item.id}
                            className="border-b last:border-b-0 border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/70 dark:hover:bg-slate-950/40 text-slate-700 dark:text-slate-300 font-medium transition-colors"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <span className={`p-2 rounded-xl ${lightBg} ${text} border ${borderLight} shrink-0`}>
                                  {mType === "image" ? (
                                    <ImageIcon size={14} />
                                  ) : mType === "video" ? (
                                    <Film size={14} />
                                  ) : mType === "audio" ? (
                                    <Music size={14} />
                                  ) : (
                                    <FileText size={14} />
                                  )}
                                </span>
                                <div>
                                  <div className="font-bold text-xs text-slate-800 dark:text-slate-100">{item.title}</div>
                                  <div className="text-[9px] text-slate-400 font-mono uppercase">{mType}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 max-w-sm">
                              {item.description}
                            </td>
                            <td className="py-3 px-4">
                              <a
                                href={item.url?.startsWith("http") ? item.url : `${API_BASE}${item.url}`}
                                target="_blank"
                                rel="noreferrer"
                                className={`inline-flex items-center gap-1 text-[11px] font-mono ${text} hover:underline truncate max-w-[180px] focus-visible:outline-none focus-visible:ring-2 ${ring} rounded`}
                                title={item.filename}
                              >
                                <span className="truncate">{item.filename}</span>
                                <ExternalLink size={12} className="shrink-0" />
                              </a>
                            </td>
                            {canDelete && (
                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => triggerDeleteMedia(item)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                                  title="Medyayı Sil"
                                  aria-label={`${item.title} medyasını sil`}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: VEKTÖR ARAMA & TEST STÜDYOSU */}
          {activeKbTab === "search_test" && (
            <div className="max-w-3xl space-y-5 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span>Vektör Arama & Test Stüdyosu</span>
                  <Sparkles size={14} className={`${text} animate-pulse`} />
                </h3>
                <p className="text-[11px] text-slate-400">
                  Müşterinin sorabileceği cümleleri yazarak veritabanından hangi bilgi parçalarının (similarity chunks) eşleştiğini canlı test edin.
                </p>
              </div>

              <form onSubmit={handleSearchTest} className="space-y-3">
                <label
                  htmlFor="kb-vector-query"
                  className="block text-[11px] font-bold text-slate-600 dark:text-slate-400"
                >
                  Test Edilecek Müşteri Sorusu veya Anahtar İfade
                </label>
                <div className="flex gap-2.5">
                  <input
                    id="kb-vector-query"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Örn: Hafta sonu çalışma saatleriniz nedir?"
                    required
                    className={`flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-medium focus-visible:outline-none focus-visible:ring-2 ${ring} focus:border-primary`}
                  />
                  <button
                    type="submit"
                    disabled={loading.search}
                    className={`px-5 py-2.5 ${bg} ${hover} disabled:opacity-50 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shrink-0 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                  >
                    {loading.search ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                    <span>Sorgula</span>
                  </button>
                </div>
              </form>

              {/* Quick Query Templates */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  Hızlı Sorgu Şablonları:
                </span>
                {[
                  "Çalışma saatleri",
                  "İletişim adresi",
                  "Kurulum adımları",
                  "Fiyat ve kampanya koşulları"
                ].map((qTpl) => (
                  <button
                    key={qTpl}
                    type="button"
                    onClick={() => handleQuickSearch(qTpl)}
                    className={`px-3 py-1 bg-slate-50 dark:bg-slate-950 hover:border-primary text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 rounded-xl text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                  >
                    {qTpl}
                  </button>
                ))}
              </div>

              {/* Matching Results Console */}
              <div className="flex flex-col bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 min-h-[300px]">
                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2 mb-3">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider">
                    Eşleşen Benzer Metin Parçaları (Top-{ragParams.top_k} Chunks • Eşik: %{Math.round((ragParams.similarity_threshold || 0.5) * 100)})
                  </span>
                </div>

                {searchResults ? (
                  <div className="text-xs text-slate-700 dark:text-slate-200 font-mono leading-relaxed max-h-[380px] overflow-y-auto whitespace-pre-line select-text pr-1.5">
                    {searchResults}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 py-10 px-4">
                    <Sparkles size={26} className="text-slate-300 dark:text-slate-700 mb-2" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Anlamsal Arama Simülatörü Hazır
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-md leading-relaxed">
                      Sorguladığınız ifadeye göre vektör veritabanından en yakın anlam eşleşmeleri burada listelenir.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/70 flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                <HelpCircle size={14} className={`${text} mt-0.5 shrink-0`} />
                <span>
                  Yapay zeka temsilcisi sesli çağrı veya WhatsApp/Omnichannel görüşmesi sırasında soru aldığında burada test ettiğiniz anlamsal aramayı çalıştırır ve eşleşen kaynak metinlerine dayanarak yanıt verir.
                </span>
              </div>
            </div>
          )}

          {/* TAB 5: RAG MOTORU & PARAMETRELER (TUNING) */}
          {activeKbTab === "tuning" && (
            <form onSubmit={handleSaveParams} className="max-w-3xl space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                    RAG İndeksleme & Arama Parametreleri (Tuning)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Metin parçalama boyutlarını, çakışma oranlarını ve vektör benzerlik hassasiyetini optimize edin.
                  </p>
                </div>

                {canWrite && (
                  <button
                    type="submit"
                    disabled={loading.saveParams}
                    className={`px-4 py-2 ${bg} ${hover} disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition shrink-0 focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                  >
                    {loading.saveParams ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>Değişiklikleri Kaydet</span>
                  </button>
                )}
              </div>

              {/* Quick Tuning Presets */}
              {canWrite && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
                    <Sliders size={14} className={text} />
                    <span>Hazır Optimizasyon Profilleri</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      {
                        label: "Dengeli Varsayılan (Önerilen)",
                        params: { chunk_size: 800, chunk_overlap: 100, top_k: 3, similarity_threshold: 0.5 }
                      },
                      {
                        label: "Kısa ve Net SSS Yanıtları",
                        params: { chunk_size: 450, chunk_overlap: 60, top_k: 4, similarity_threshold: 0.6 }
                      },
                      {
                        label: "Uzun Teknik Kılavuz & Sözleşme",
                        params: { chunk_size: 1400, chunk_overlap: 200, top_k: 5, similarity_threshold: 0.45 }
                      }
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setRagParams(preset.params)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-primary text-slate-700 dark:text-slate-200 transition shadow-sm focus-visible:outline-none focus-visible:ring-2 ${ring}`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <label
                    htmlFor="kb-chunk-size"
                    className="block text-xs font-extrabold text-slate-700 dark:text-slate-200"
                  >
                    Metin Bölme Boyutu (Chunk Size)
                  </label>
                  <p className="text-[10px] text-slate-400">
                    Yüklenen dökümanların kaç karakterlik anlam bloklarına bölüneceğini belirler (100 - 5000).
                  </p>
                  <input
                    id="kb-chunk-size"
                    type="number"
                    disabled={!canWrite}
                    value={ragParams.chunk_size}
                    onChange={(e) =>
                      setRagParams((prev) => ({ ...prev, chunk_size: parseInt(e.target.value, 10) || 800 }))
                    }
                    required
                    min="100"
                    max="5000"
                    className={`w-full mt-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-mono font-bold focus-visible:outline-none focus-visible:ring-2 ${ring} focus:border-primary`}
                  />
                </div>

                <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <label
                    htmlFor="kb-chunk-overlap"
                    className="block text-xs font-extrabold text-slate-700 dark:text-slate-200"
                  >
                    Bölme Çakışma Oranı (Chunk Overlap)
                  </label>
                  <p className="text-[10px] text-slate-400">
                    Ardışık metin parçaları arasında cümle bütünlüğünü korumak için bırakılan ortak karakter sayısı.
                  </p>
                  <input
                    id="kb-chunk-overlap"
                    type="number"
                    disabled={!canWrite}
                    value={ragParams.chunk_overlap}
                    onChange={(e) =>
                      setRagParams((prev) => ({ ...prev, chunk_overlap: parseInt(e.target.value, 10) ?? 100 }))
                    }
                    required
                    min="0"
                    max="1000"
                    className={`w-full mt-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-mono font-bold focus-visible:outline-none focus-visible:ring-2 ${ring} focus:border-primary`}
                  />
                </div>

                <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <label
                    htmlFor="kb-top-k"
                    className="block text-xs font-extrabold text-slate-700 dark:text-slate-200"
                  >
                    Eşleşme Sayısı (Top K)
                  </label>
                  <p className="text-[10px] text-slate-400">
                    Her sorguda yapay zeka bağlamına eklenecek en alakalı maksimum metin parçası adedi (1 - 20).
                  </p>
                  <input
                    id="kb-top-k"
                    type="number"
                    disabled={!canWrite}
                    value={ragParams.top_k}
                    onChange={(e) =>
                      setRagParams((prev) => ({ ...prev, top_k: parseInt(e.target.value, 10) || 3 }))
                    }
                    required
                    min="1"
                    max="20"
                    className={`w-full mt-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-mono font-bold focus-visible:outline-none focus-visible:ring-2 ${ring} focus:border-primary`}
                  />
                </div>

                <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="kb-sim-threshold"
                      className="block text-xs font-extrabold text-slate-700 dark:text-slate-200"
                    >
                      Asgari Benzerlik Eşiği
                    </label>
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-mono font-extrabold ${lightBg} ${text}`}>
                      %{Math.round((ragParams.similarity_threshold || 0.5) * 100)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Alakasız sonuçları elemek için gereken minimum kosinüs benzerlik skoru.
                  </p>
                  <div className="pt-3">
                    <input
                      id="kb-sim-threshold"
                      type="range"
                      disabled={!canWrite}
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={ragParams.similarity_threshold}
                      onChange={(e) =>
                        setRagParams((prev) => ({
                          ...prev,
                          similarity_threshold: parseFloat(e.target.value) || 0.5
                        }))
                      }
                      className="w-full appearance-none bg-slate-200 dark:bg-slate-700 h-2 rounded-lg accent-primary cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] font-mono text-slate-400 mt-1">
                      <span>%10 (Esnek)</span>
                      <span>%50 (Dengeli)</span>
                      <span>%100 (Birebir)</span>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}
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
