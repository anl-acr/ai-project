import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  FolderOpen,
  FileCode,
  FileText,
  HardDrive,
  Search,
  RefreshCw,
  Plus,
  Trash2,
  Download,
  Copy,
  Check,
  ChevronUp,
  ChevronDown,
  X,
  Cpu,
  Smartphone,
  ShieldCheck,
  Binary,
  Globe,
  Server,
} from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "Dinamik";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const CATEGORY_META = {
  system: { label: "Sistem XML", icon: FileCode, tone: "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300" },
  device_config: { label: "Cihaz Konfig", icon: Smartphone, tone: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300" },
  tftp_file: { label: "TFTP Dosyası", icon: FolderOpen, tone: "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300" },
  firmware: { label: "Firmware", icon: Cpu, tone: "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300" },
};

export default function TftpDirectoryTab({
  backendHost = "localhost:8000",
  getAuthHeaders,
  initialFilename = "",
  onInitialFilenameConsumed,
  onCountChange,
}) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();
  const API_BASE =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${backendHost}`
      : `http://${backendHost}`;

  const [files, setFiles] = useState([]);
  const [counts, setCounts] = useState({ total: 0, system: 0, device_config: 0, tftp_file: 0, firmware: 0 });
  const [tftpMeta, setTftpMeta] = useState({ path: "", port: 69 });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [banner, setBanner] = useState(null);

  // Directory filters
  const [listSearch, setListSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all"); // all | system | device_config | tftp_file | firmware

  // Selected file viewer state
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewMode, setPreviewMode] = useState("wan"); // wan | lan
  const [fileContentData, setFileContentData] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState("");
  const [copied, setCopied] = useState(false);

  // In-file search state
  const [inFileQuery, setInFileQuery] = useState("");
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  const matchRefs = useRef([]);
  const uploadInputRef = useRef(null);

  // Delete modal state
  const [deleteTargetFile, setDeleteTargetFile] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const flashBanner = (ok, msg) => {
    setBanner({ ok, text: msg });
    setTimeout(() => setBanner(null), 5000);
  };

  const fetchDirectory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/autoprovision/tftp-directory`, {
        headers: getAuthHeaders ? getAuthHeaders() : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data.files) ? data.files : [];
      setFiles(list);
      const nextCounts = data.counts || { total: list.length, system: 0, device_config: 0, tftp_file: 0, firmware: 0 };
      setCounts(nextCounts);
      setTftpMeta({ path: data.tftp_root_path || "", port: data.tftp_port || 69 });
      if (typeof onCountChange === "function") {
        onCountChange(nextCounts.total || list.length);
      }
      return list;
    } catch (err) {
      flashBanner(false, `TFTP dizini yüklenemedi: ${err.message}`);
      return [];
    } finally {
      setLoading(false);
    }
  }, [API_BASE, getAuthHeaders, onCountChange]);

  const loadFileContent = useCallback(
    async (fileItem, modeOverride = null) => {
      if (!fileItem) return;
      const effMode = modeOverride || (fileItem.connection_mode === "lan" ? "lan" : previewMode);
      setContentLoading(true);
      setContentError("");
      setActiveMatchIdx(0);
      try {
        const qs = new URLSearchParams({
          filename: fileItem.filename || "",
          category: fileItem.category || "",
          mac: fileItem.mac_hex || fileItem.mac || "",
          mode: effMode,
        });
        const res = await fetch(`${API_BASE}/api/settings/autoprovision/tftp-directory/content?${qs.toString()}`, {
          headers: getAuthHeaders ? getAuthHeaders() : {},
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.detail || `Dosya okunamadı (HTTP ${res.status})`);
        }
        setFileContentData(data);
      } catch (err) {
        setContentError(err.message || "Dosya içeriği okunamadı.");
        setFileContentData(null);
      } finally {
        setContentLoading(false);
      }
    },
    [API_BASE, getAuthHeaders, previewMode]
  );

  useEffect(() => {
    fetchDirectory().then((loadedList) => {
      if (!loadedList || loadedList.length === 0) return;
      if (initialFilename) {
        const match = loadedList.find(
          (f) => String(f.filename || "").toLowerCase() === String(initialFilename).toLowerCase()
        );
        if (match) {
          setSelectedFile(match);
          const m = match.connection_mode === "lan" ? "lan" : "wan";
          setPreviewMode(m);
          loadFileContent(match, m);
          if (typeof onInitialFilenameConsumed === "function") onInitialFilenameConsumed();
          return;
        }
      }
      // Auto-select XMLDefault.cnf.xml on first visit so user immediately sees useful content
      const defXml =
        loadedList.find((f) => String(f.filename || "").toLowerCase() === "xmldefault.cnf.xml") ||
        loadedList[0];
      if (defXml) {
        setSelectedFile(defXml);
        loadFileContent(defXml, "wan");
      }
    });
  }, []);

  // Respond if user jumped from Log tab to inspect a specific filename
  useEffect(() => {
    if (!initialFilename || files.length === 0) return;
    const match = files.find(
      (f) => String(f.filename || "").toLowerCase() === String(initialFilename).toLowerCase()
    );
    if (match) {
      setSelectedFile(match);
      const m = match.connection_mode === "lan" ? "lan" : "wan";
      setPreviewMode(m);
      loadFileContent(match, m);
      if (typeof onInitialFilenameConsumed === "function") onInitialFilenameConsumed();
    }
  }, [initialFilename, files, loadFileContent, onInitialFilenameConsumed]);

  const filteredFiles = useMemo(() => {
    const q = String(listSearch || "").trim().toLowerCase();
    return files.filter((f) => {
      if (catFilter !== "all") {
        if (catFilter === "tftp_fw") {
          if (f.category !== "tftp_file" && f.category !== "firmware") return false;
        } else if (f.category !== catFilter) {
          return false;
        }
      }
      if (!q) return true;
      const hay = [
        f.filename,
        f.mac,
        f.mac_hex,
        f.extension,
        f.brand,
        f.model,
        f.device_name,
        f.user_name,
        f.description,
        f.source_label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [files, listSearch, catFilter]);

  const handleSelectFile = (item) => {
    setSelectedFile(item);
    const nextMode = item.category === "device_config" && item.connection_mode === "lan" ? "lan" : "wan";
    setPreviewMode(nextMode);
    loadFileContent(item, nextMode);
  };

  const handleModeSwitch = (nextM) => {
    setPreviewMode(nextM);
    if (selectedFile) {
      loadFileContent(selectedFile, nextM);
    }
  };

  const handleUploadFiles = async (e) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      picked.forEach((f) => formData.append("files", f));
      const res = await fetch(`${API_BASE}/api/settings/autoprovision/tftp-directory/upload`, {
        method: "POST",
        headers: getAuthHeaders ? getAuthHeaders() : {},
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `Yükleme başarısız (HTTP ${res.status})`);
      }
      flashBanner(true, `${data.count || picked.length} dosya TFTP dizinine yüklendi.`);
      const freshList = await fetchDirectory();
      const firstName = data.uploaded?.[0]?.filename;
      if (firstName && Array.isArray(freshList)) {
        const uploadedItem = freshList.find((x) => x.filename === firstName);
        if (uploadedItem) {
          setSelectedFile(uploadedItem);
          loadFileContent(uploadedItem, previewMode);
        }
      }
    } catch (err) {
      flashBanner(false, err.message || "Dosya yükleme hatası.");
    } finally {
      setUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  const handleConfirmDeleteFile = async () => {
    if (!deleteTargetFile) return;
    setDeleting(true);
    try {
      const qs = new URLSearchParams({ filename: deleteTargetFile.filename });
      const res = await fetch(`${API_BASE}/api/settings/autoprovision/tftp-directory/file?${qs.toString()}`, {
        method: "DELETE",
        headers: getAuthHeaders ? getAuthHeaders() : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Dosya silinemedi.");
      }
      flashBanner(true, `${deleteTargetFile.filename} TFTP dizininden silindi.`);
      if (selectedFile?.id === deleteTargetFile.id) {
        setSelectedFile(null);
        setFileContentData(null);
      }
      setDeleteTargetFile(null);
      await fetchDirectory();
    } catch (err) {
      flashBanner(false, err.message || "Silme hatası.");
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadSelected = () => {
    if (!selectedFile) return;
    const qs = new URLSearchParams({
      filename: selectedFile.filename,
      category: selectedFile.category,
      mac: selectedFile.mac_hex || selectedFile.mac || "",
      mode: previewMode,
    });
    const url = `${API_BASE}/api/settings/autoprovision/tftp-directory/download?${qs.toString()}`;
    fetch(url, { headers: getAuthHeaders ? getAuthHeaders() : {} })
      .then((r) => {
        if (!r.ok) throw new Error("İndirme başarısız");
        return r.blob();
      })
      .then((blob) => {
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = selectedFile.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objUrl);
      })
      .catch((err) => flashBanner(false, err.message));
  };

  const handleCopyContent = () => {
    const txt = fileContentData?.content || "";
    if (!txt || typeof navigator === "undefined") return;
    navigator.clipboard?.writeText(txt).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // Parse lines & highlight in-file search matches
  const contentLines = useMemo(() => {
    if (!fileContentData || fileContentData.is_binary) return [];
    return String(fileContentData.content || "").split("\n");
  }, [fileContentData]);

  const matchPositions = useMemo(() => {
    const q = String(inFileQuery || "").trim().toLowerCase();
    if (!q || contentLines.length === 0) return [];
    const list = [];
    contentLines.forEach((line, lineIdx) => {
      const low = line.toLowerCase();
      let pos = 0;
      while (true) {
        const found = low.indexOf(q, pos);
        if (found === -1) break;
        list.push({ lineIdx, start: found, end: found + q.length });
        pos = found + q.length;
      }
    });
    return list;
  }, [contentLines, inFileQuery]);

  useEffect(() => {
    setActiveMatchIdx(0);
    matchRefs.current = [];
  }, [inFileQuery, fileContentData?.filename]);

  const scrollToMatch = useCallback((idx) => {
    const el = matchRefs.current[idx];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const jumpMatch = (delta) => {
    if (matchPositions.length === 0) return;
    const nextIdx = (activeMatchIdx + delta + matchPositions.length) % matchPositions.length;
    setActiveMatchIdx(nextIdx);
    setTimeout(() => scrollToMatch(nextIdx), 0);
  };

  const renderHighlightedLine = (lineText, lineIdx) => {
    const q = String(inFileQuery || "").trim();
    if (!q) return lineText || " ";
    const qLow = q.toLowerCase();
    const low = lineText.toLowerCase();
    if (!low.includes(qLow)) return lineText || " ";

    // Calculate starting global match index for this line
    let globalIdx = 0;
    for (let i = 0; i < matchPositions.length; i++) {
      if (matchPositions[i].lineIdx === lineIdx) {
        globalIdx = i;
        break;
      }
    }

    const parts = [];
    let cursor = 0;
    let localCount = 0;
    while (true) {
      const idx = low.indexOf(qLow, cursor);
      if (idx === -1) {
        parts.push(lineText.slice(cursor));
        break;
      }
      if (idx > cursor) parts.push(lineText.slice(cursor, idx));
      const thisGlobalIdx = globalIdx + localCount;
      const isActive = thisGlobalIdx === activeMatchIdx;
      parts.push(
        <mark
          key={`${lineIdx}-${idx}`}
          ref={(el) => {
            if (el) matchRefs.current[thisGlobalIdx] = el;
          }}
          className={
            isActive
              ? `${bg} text-white px-0.5 rounded font-bold ring-2 ring-amber-400`
              : "bg-amber-300/80 dark:bg-amber-500/40 text-slate-900 dark:text-amber-100 px-0.5 rounded"
          }
        >
          {lineText.slice(idx, idx + q.length)}
        </mark>
      );
      cursor = idx + q.length;
      localCount += 1;
    }
    return parts;
  };

  return (
    <div className="space-y-4">
      {banner && (
        <div
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between border ${
            banner.ok
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
          }`}
        >
          <span>{banner.text}</span>
          <button type="button" onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Directory Toolbar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl ${lightBg} ${text} border ${borderLight} flex items-center justify-center shrink-0`}>
            <FolderOpen size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                TFTP Kök Dizini &amp; Provizyon Dosyaları
              </h4>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${lightBg} ${text} border ${borderLight}`}>
                {counts.total} Dosya
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                UDP :{tftpMeta.port || 69}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              Cisco firmware (.loads, .sbn, .zz), XMLDefault.cnf.xml, dialplan.xml, TzDataCSV.csv ve oto-provizyon cihaz konfigürasyonları
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input
              type="text"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Dosya, MAC, dahili ara..."
              className={`w-56 text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
            />
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          <button
            type="button"
            onClick={fetchDirectory}
            disabled={loading}
            title="Dizini Yenile"
            className="h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>

          <input
            ref={uploadInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUploadFiles}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => uploadInputRef.current?.click()}
            title="TFTP Dizinine Dosya / Cisco Firmware Yükle (Çoklu Seçim Destekli)"
            className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all shadow-sm cursor-pointer disabled:opacity-60"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {[
          { id: "all", label: `Tümü (${counts.total})` },
          { id: "system", label: `Sistem XML (${counts.system})` },
          { id: "device_config", label: `Cihaz Konfig (${counts.device_config})` },
          { id: "tftp_fw", label: `TFTP & Firmware (${counts.tftp_file + counts.firmware})` },
        ].map((c) => {
          const active = catFilter === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCatFilter(c.id)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                active
                  ? `${bg} text-white border-transparent shadow-sm`
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Master-Detail Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: File List */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/60">
            <span className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Dosya Listesi ({filteredFiles.length})
            </span>
            {uploading && (
              <span className={`text-[10px] font-bold ${text} animate-pulse`}>Yükleniyor...</span>
            )}
          </div>

          <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
            {filteredFiles.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                Arama kriterine uyan dosya bulunamadı.
              </div>
            ) : (
              filteredFiles.map((item) => {
                const isSelected = selectedFile?.id === item.id;
                const meta = CATEGORY_META[item.category] || CATEGORY_META.tftp_file;
                const IconComp = item.is_text ? meta.icon : Binary;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectFile(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectFile(item);
                      }
                    }}
                    className={`px-3.5 py-2.5 flex items-start justify-between gap-2.5 transition-colors cursor-pointer ${
                      isSelected
                        ? `${lightBg} border-l-4 ${border}`
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-4 border-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div
                        className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? `${bg} text-white` : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        <IconComp size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-extrabold text-slate-900 dark:text-white truncate">
                            {item.filename}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${meta.tone}`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {item.description || item.source_label}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono flex-wrap">
                          <span>{formatBytes(item.size_bytes)}</span>
                          {item.mac && <span>• {item.mac}</span>}
                          {item.extension && <span>• Dahili {item.extension}</span>}
                          {item.updated_at && <span>• {item.updated_at}</span>}
                        </div>
                      </div>
                    </div>

                    {item.deletable && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTargetFile(item);
                        }}
                        title="Dosyayı TFTP Dizininden Sil"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: File Content Viewer + In-File Search */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          {!selectedFile ? (
            <div className="p-12 text-center space-y-2">
              <FileCode size={32} className="mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                İçeriğini görmek istediğiniz dosyayı soldaki dizinden seçin
              </p>
              <p className="text-[11px] text-slate-400">
                XMLDefault.cnf.xml, dialplan.xml, SEP&lt;MAC&gt;.cnf.xml veya yüklediğiniz tüm TFTP/firmware dosyalarını açıp içinde arama yapabilirsiniz.
              </p>
            </div>
          ) : (
            <>
              {/* Viewer Header */}
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {selectedFile.filename}
                    </span>
                    {fileContentData && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] font-bold">
                        {formatBytes(fileContentData.size_bytes)}
                        {!fileContentData.is_binary && ` • ${fileContentData.line_count} satır`}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                    {fileContentData?.source_path || `/tftp-root/${selectedFile.filename}`}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  {(selectedFile.category === "device_config" ||
                    String(selectedFile.filename || "").toLowerCase().includes("xmldefault")) && (
                    <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => handleModeSwitch("wan")}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-extrabold transition-colors cursor-pointer ${
                          previewMode === "wan"
                            ? `${bg} text-white`
                            : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        <Globe size={11} />
                        WAN
                      </button>
                      <button
                        type="button"
                        onClick={() => handleModeSwitch("lan")}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-extrabold transition-colors cursor-pointer ${
                          previewMode === "lan"
                            ? `${bg} text-white`
                            : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        <Server size={11} />
                        LAN
                      </button>
                    </div>
                  )}

                  {!fileContentData?.is_binary && fileContentData?.content && (
                    <button
                      type="button"
                      onClick={handleCopyContent}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      <span>{copied ? "Kopyalandı" : "Kopyala"}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadSelected}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg ${bg} ${hover} text-white text-[11px] font-bold transition-colors cursor-pointer`}
                  >
                    <Download size={12} />
                    <span>İndir</span>
                  </button>
                </div>
              </div>

              {/* In-File Search Toolbar (for text/XML/CFG/CSV files) */}
              {!fileContentData?.is_binary && (
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <input
                      type="text"
                      value={inFileQuery}
                      onChange={(e) => setInFileQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          jumpMatch(e.shiftKey ? -1 : 1);
                        }
                      }}
                      placeholder="Dosya içinde ara (örn: timeZone, 5160, processNodeName, loadInformation)..."
                      className={`w-full text-xs pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 ${ring}`}
                    />
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    {inFileQuery && (
                      <button
                        type="button"
                        onClick={() => setInFileQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        aria-label="Aramayı temizle"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {inFileQuery.trim() && (
                      <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums px-1.5">
                        {matchPositions.length > 0 ? `${activeMatchIdx + 1} / ${matchPositions.length}` : "0 eşleşme"}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={matchPositions.length === 0}
                      onClick={() => jumpMatch(-1)}
                      title="Önceki eşleşme (Shift+Enter)"
                      className="h-7 w-7 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={matchPositions.length === 0}
                      onClick={() => jumpMatch(1)}
                      title="Sonraki eşleşme (Enter)"
                      className="h-7 w-7 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Viewer Body */}
              <div className="max-h-[540px] overflow-auto bg-slate-950 text-slate-100">
                {contentLoading ? (
                  <div className="p-10 text-center text-xs text-slate-400 font-mono">
                    Dosya okunuyor...
                  </div>
                ) : contentError ? (
                  <div className="p-8 text-center text-xs text-rose-400 font-bold">
                    {contentError}
                  </div>
                ) : fileContentData?.is_binary ? (
                  <div className="p-8 text-center space-y-3 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                    <div className={`w-12 h-12 mx-auto rounded-2xl ${lightBg} ${text} flex items-center justify-center`}>
                      <HardDrive size={24} />
                    </div>
                    <h5 className="text-sm font-extrabold">{fileContentData.filename}</h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      Bu dosya ikili (binary) firmware veya paket dosyasıdır; doğrudan TFTP üzerinden telefonlara sunulur.
                    </p>
                    <div className="inline-flex flex-col gap-1 text-[11px] font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-left">
                      <div>Boyut: <span className="font-bold">{formatBytes(fileContentData.size_bytes)}</span></div>
                      <div>TFTP Yolu: <span className="font-bold">{fileContentData.filename}</span></div>
                      <div className="break-all">SHA-256: <span className="text-slate-500">{fileContentData.sha256}</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 font-mono text-[11px] leading-5">
                    {contentLines.map((line, idx) => (
                      <div
                        key={idx}
                        className="flex hover:bg-slate-900/80 rounded px-1"
                      >
                        <span className="w-10 shrink-0 select-none text-right pr-3 text-slate-500 tabular-nums">
                          {idx + 1}
                        </span>
                        <span className="whitespace-pre text-slate-100 flex-1">
                          {renderHighlightedLine(line, idx)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Custom Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTargetFile)}
        onClose={() => !deleting && setDeleteTargetFile(null)}
        onConfirm={handleConfirmDeleteFile}
        title="TFTP Dosyasını Sil"
        message={
          deleteTargetFile
            ? `"${deleteTargetFile.filename}" dosyasını TFTP dizininden kalıcı olarak silmek istediğinize emin misiniz?`
            : ""
        }
        loading={deleting}
      />
    </div>
  );
}
