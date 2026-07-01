import React, { useState, useEffect } from "react";
import { Database, FileText, Globe, Search, Send, Upload, CheckCircle, AlertTriangle } from "lucide-react";

export default function KnowledgeBase({ backendHost = "localhost:8000" }) {
  const [urlInput, setUrlInput] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState({ upload: false, crawl: false, search: false });
  const [sources, setSources] = useState([]);

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  // Fetch indexed sources list
  const fetchSources = () => {
    fetch(`${API_BASE}/api/rag/sources`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSources(data);
      })
      .catch((err) => console.error("[RAG] Kaynak listesi alinamadi:", err));
  };

  useEffect(() => {
    fetchSources();
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

  // Handle Vector Search Test query
  const handleSearchTest = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;

    setLoading((prev) => ({ ...prev, search: true }));
    setSearchResults("");

    try {
      const res = await fetch(`${API_BASE}/api/rag/search?query=${encodeURIComponent(searchQuery)}`);
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

  return (
    <div className="flex flex-col gap-6 text-white max-w-4xl w-full">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-purple-600/20 text-purple-400 border border-purple-800 rounded-2xl">
          <Database size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold">Bilgi Bankası (RAG) Kurulumu</h2>
          <p className="text-sm text-slate-400">Yapay zekanın cevaplayacağı PDF kılavuzları ve web sitesi linklerini yerel veritabanına indeksleyin.</p>
        </div>
      </div>

      {/* Forms Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Web Site Crawling Card */}
        <div className="flex flex-col p-5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="text-blue-400" size={18} />
            <h3 className="font-semibold text-sm">Web Sitesi Tarama (Crawl)</h3>
          </div>
          <form onSubmit={handleCrawlUrl} className="flex flex-col gap-3">
            <label className="text-xs text-slate-400">Taranacak URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://firmamiz.com/sss"
                required
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={loading.crawl}
                className="flex items-center justify-center p-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 transition rounded-xl"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[10px] text-slate-500">Site içeriği indirilip metin parçaları pgvector veritabanına eklenecektir.</p>
          </form>
        </div>

        {/* PDF Upload Card */}
        <div className="flex flex-col p-5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="text-emerald-400" size={18} />
            <h3 className="font-semibold text-sm">PDF Dosya Yükleme</h3>
          </div>
          <form onSubmit={handleUploadPdf} className="flex flex-col gap-3">
            <label className="text-xs text-slate-400">PDF Belgesi Seç</label>
            <div className="flex gap-2 items-center">
              <label className="flex-1 flex items-center justify-between px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-400 cursor-pointer hover:border-slate-700 transition">
                <span>{pdfFile ? pdfFile.name : "Dosya seçilmedi..."}</span>
                <Upload size={16} className="text-slate-500" />
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
                className="flex items-center justify-center p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 transition rounded-xl h-10 w-10 shrink-0"
              >
                <Upload size={16} />
              </button>
            </div>
            <p className="text-[10px] text-slate-500">Yüklenen PDF yerel olarak parse edilerek anlam vektörleri üretilecektir.</p>
          </form>
        </div>
      </div>

      {/* Feedback Status */}
      {status.message && (
        <div className={`p-3 border rounded-xl flex items-center gap-2 text-sm ${
          status.type === "success" 
            ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
            : "bg-rose-950/40 border-rose-800 text-rose-300"
        }`}>
          {status.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{status.message}</span>
        </div>
      )}

      {/* Index Vector Search Test */}
      <div className="flex flex-col p-5 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
          <Search className="text-purple-400" size={18} />
          <h3 className="font-semibold text-sm">Vektör Arama Testi</h3>
        </div>
        <form onSubmit={handleSearchTest} className="flex gap-2 mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Yapay zekanın hafızasında aratmak istediğiniz soruyu yazın..."
            required
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={loading.search}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 transition rounded-xl font-medium text-sm flex items-center gap-2 shrink-0"
          >
            {loading.search ? "Aranıyor..." : "Ara"}
          </button>
        </form>
        {searchResults && (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-mono max-h-[150px] overflow-y-auto">
            <p className="font-semibold text-slate-500 mb-1 border-b border-slate-900 pb-1">Veritabanından Eşleşen Chunk Sonucu:</p>
            <p className="whitespace-pre-line leading-relaxed">{searchResults}</p>
          </div>
        )}
      </div>

      {/* Sources List */}
      <div className="flex flex-col p-5 bg-slate-900 border border-slate-800 rounded-2xl">
        <h3 className="font-semibold text-sm mb-3">İndekslenmiş Veri Kaynakları</h3>
        {sources.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">Henüz indekslenmiş döküman veya web sitesi bulunmuyor.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2">Kaynak Adı / URL</th>
                  <th className="py-2 text-right">Durum</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((src, index) => (
                  <tr key={index} className="border-b border-slate-800/50 hover:bg-slate-950/20">
                    <td className="py-2.5 font-mono text-slate-300">{src.name}</td>
                    <td className="py-2.5 text-right text-emerald-400 font-semibold">İndekslendi</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
