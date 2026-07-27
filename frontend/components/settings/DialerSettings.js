import React, { useState, useEffect } from "react";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Upload, 
  Settings, 
  Users, 
  Activity, 
  Save, 
  CheckCircle, 
  HelpCircle, 
  Clock, 
  Sliders, 
  PhoneCall, 
  ListFilter,
  FileText,
  AlertCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Edit2,
  X,
  Search
} from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl } from "../../utils/apiHost";

const InfoTooltip = ({ text }) => {
  return (
    <div className="group relative inline-block ml-1 cursor-help text-slate-400 dark:text-slate-550 hover:text-primary dark:hover:text-blue-400 transition-colors">
      <HelpCircle size={12} className="inline-block align-middle" />
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-52 p-2.5 bg-slate-950/95 dark:bg-slate-900 border border-slate-800 rounded-xl shadow-2xl text-[10px] text-slate-200 dark:text-slate-350 font-semibold normal-case leading-relaxed text-center z-50 transition-all duration-200">
        {text}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-950/95 dark:border-t-slate-900"></div>
      </div>
    </div>
  );
};

export default function DialerSettings({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  
  const [campaigns, setCampaigns] = useState([]);
  const [trunks, setTrunks] = useState([]);
  const [aiAgents, setAiAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Active selected campaign for monitoring / upload
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  // Modals & Errors
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });
  const [campaignError, setCampaignError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Form Fields for Campaign Create/Edit
  const [editingId, setEditingId] = useState(null);
  const [formCampaign, setFormCampaign] = useState({
    name: "",
    enabled: true,
    dial_mode: "progressive",
    concurrent_calls: 5,
    retry_count: 3,
    retry_interval_minutes: 15,
    route_destination_type: "ai",
    route_destination: "Sales_AI",
    outbound_trunk_id: 1,
    allowed_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    allowed_hours_start: "09:00",
    allowed_hours_end: "18:00"
  });

  // Manual list upload input
  const [uploadInput, setUploadInput] = useState("");

  const API_BASE = getApiBaseUrl(backendHost);

  // Auto-dismiss campaignError after 5 seconds
  useEffect(() => {
    if (campaignError) {
      const timer = setTimeout(() => {
        setCampaignError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [campaignError]);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/dialer/campaigns`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
        if (data.length > 0 && !selectedCampaignId) {
          setSelectedCampaignId(data[0].id);
        }
      }
    } catch (err) {
      console.error("[Dialer] Kampanyalar yuklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();

    // Fetch trunks
    fetch(`${API_BASE}/api/settings/trunks`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTrunks(data);
      })
      .catch((err) => console.error("[Dialer] Trunks hatasi:", err));

    // Fetch AI Agents
    fetch(`${API_BASE}/api/settings/ai-agents`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setAiAgents(data);
      })
      .catch((err) => console.error("[Dialer] AI Agents hatasi:", err));
  }, [backendHost]);

  // Handle open modal to create campaign
  const handleOpenCreateModal = () => {
    setCampaignError("");
    setEditingId(null);
    setFormCampaign({
      name: "",
      enabled: true,
      dial_mode: "progressive",
      concurrent_calls: 5,
      retry_count: 3,
      retry_interval_minutes: 15,
      route_destination_type: "ai",
      route_destination: aiAgents[0]?.name || "Sales_AI",
      outbound_trunk_id: trunks[0]?.id || 1,
      allowed_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      allowed_hours_start: "09:00",
      allowed_hours_end: "18:00"
    });
    setShowCampaignModal(true);
  };

  // Handle open modal to edit campaign
  const handleOpenEditModal = (c) => {
    setCampaignError("");
    setEditingId(c.id);
    setFormCampaign({
      name: c.name || "",
      enabled: c.enabled !== false,
      dial_mode: c.dial_mode || "progressive",
      concurrent_calls: c.concurrent_calls || 5,
      retry_count: c.retry_count || 3,
      retry_interval_minutes: c.retry_interval_minutes || 15,
      route_destination_type: c.route_destination_type || "ai",
      route_destination: c.route_destination || "Sales_AI",
      outbound_trunk_id: c.outbound_trunk_id || 1,
      allowed_days: c.allowed_days || ["monday", "tuesday", "wednesday", "thursday", "friday"],
      allowed_hours_start: c.allowed_hours_start || "09:00",
      allowed_hours_end: c.allowed_hours_end || "18:00"
    });
    setShowCampaignModal(true);
  };

  // Save Campaign (Create or Edit)
  const handleSaveCampaign = async (e) => {
    e.preventDefault();
    setCampaignError("");

    if (!formCampaign.name || !formCampaign.name.trim()) {
      setCampaignError("Lütfen Dış Arama Kampanyası Adı giriniz.");
      return;
    }

    const cName = formCampaign.name.trim();

    // Client-side duplicate check for Campaign Name
    const dupCampaign = (campaigns || []).find(
      c => String(c.name || "").trim().toLowerCase() === cName.toLowerCase() && (!editingId || String(c.id) !== String(editingId))
    );
    if (dupCampaign) {
      setCampaignError(`'${cName}' isimli Dış Arama Kampanyası zaten mevcut. Lütfen farklı bir isim giriniz.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/dialer/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formCampaign,
          id: editingId,
          name: cName
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.campaigns) setCampaigns(data.campaigns);
        setShowCampaignModal(false);
        fetchCampaigns();
      } else {
        const errData = await res.json().catch(() => ({}));
        setCampaignError(errData.detail || "Kampanya kaydedilirken hata oluştu.");
      }
    } catch (err) {
      console.error("[Dialer] Save campaign error:", err);
      setCampaignError("Bağlantı hatası oluştu. Lütfen tekrar deneyiniz.");
    } finally {
      setLoading(false);
    }
  };

  // Delete Campaign
  const handleDeleteCampaign = async () => {
    if (!deleteConfirm.id) return;
    try {
      const res = await fetch(`${API_BASE}/api/settings/dialer/campaigns/${deleteConfirm.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
        if (selectedCampaignId === deleteConfirm.id) {
          setSelectedCampaignId(data.campaigns?.[0]?.id || null);
        }
      }
    } catch (err) {
      console.error("[Dialer] Delete error:", err);
    } finally {
      setDeleteConfirm({ show: false, id: null });
    }
  };

  // Campaign Control (Start / Pause / Reset)
  const handleControlCampaign = async (cId, action) => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/dialer/campaigns/${cId}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.campaigns) setCampaigns(data.campaigns);
      }
    } catch (err) {
      console.error("[Dialer] Control error:", err);
    }
  };

  // Upload List to Campaign
  const handleUploadList = async (e) => {
    e.preventDefault();
    if (!uploadInput.trim() || !selectedCampaignId) return;
    try {
      const res = await fetch(`${API_BASE}/api/settings/dialer/campaigns/${selectedCampaignId}/upload-list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numbers: uploadInput })
      });
      if (res.ok) {
        const data = await res.json();
        setUploadSuccess(true);
        setUploadMessage(data.message);
        setUploadInput("");
        if (data.campaigns) setCampaigns(data.campaigns);
        setShowUploadModal(false);
        setTimeout(() => setUploadSuccess(false), 4000);
      }
    } catch (err) {
      console.error("[Dialer] Upload error:", err);
    }
  };

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId) || campaigns[0];

  const filteredCampaigns = campaigns.filter(c =>
    String(c.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 text-slate-800 dark:text-slate-100 w-full">
      
      {/* Title & Actions Header Card */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${lightBg} ${text} rounded-xl`}>
            <PhoneCall size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">DIŞ ARAMA (OUTBOUND DIALER) KAMPANYALARI</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Otomatik dış arama kampanyalarının oluşturulması, mod yönetimi, liste yükleme ve canlı takibi.
            </p>
          </div>
        </div>

        {/* Search + Unified Red Plus Button */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Kampanya Ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-48 text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
            />
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 shadow-md shadow-rose-600/20 transition-colors"
            title="Yeni Dış Arama Kampanyası Ekle"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {uploadSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle size={14} />
          <span>{uploadMessage}</span>
        </div>
      )}

      {/* Campaigns Table List (Row View matching Users) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
        {filteredCampaigns.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle size={36} className="mx-auto text-slate-400 mb-2" />
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Henüz kaydedilmiş bir dış arama kampanyası bulunmuyor.</p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-3 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition"
            >
              <Plus size={14} /> Yeni Kampanya Oluştur
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Durum</th>
                  <th className="py-3 px-4">Kampanya Adı</th>
                  <th className="py-3 px-4">Mod / Hat</th>
                  <th className="py-3 px-4">Hedef Yönlendirme</th>
                  <th className="py-3 px-4">İlerleme</th>
                  <th className="py-3 px-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {filteredCampaigns.map((c) => {
                  const records = c.records || [];
                  const total = records.length;
                  const answered = records.filter(r => r.status === "Answered").length;
                  const pending = records.filter(r => r.status === "Pending").length;
                  const progressPct = total > 0 ? Math.round(((total - pending) / total) * 100) : 0;
                  const trunkObj = trunks.find(t => t.id === c.outbound_trunk_id);

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-850/40 transition-colors"
                    >
                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 ${
                          c.status === "running"
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                            : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.status === "running" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                          {c.status === "running" ? "ÇALIŞIYOR" : "DURDURULDU"}
                        </span>
                      </td>

                      {/* Campaign Name */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-800 dark:text-white">
                        {c.name}
                      </td>

                      {/* Mode & Trunk */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase">
                          {c.dial_mode} DIALER
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                          {trunkObj ? trunkObj.trunk_name : `Hat #${c.outbound_trunk_id}`} ({c.concurrent_calls} Eşzamanlı)
                        </div>
                      </td>

                      {/* Route Destination */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md text-[10px] font-bold uppercase mr-1.5">
                          {c.route_destination_type === "ai" ? "AI Asistan" : c.route_destination_type === "queue" ? "Kuyruk" : "Dahili"}
                        </span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {c.route_destination}
                        </span>
                      </td>

                      {/* Progress Bar & Stats */}
                      <td className="py-3.5 px-4 min-w-[200px]">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                          <span>%{progressPct} ({total - pending}/{total})</span>
                          <span className="text-[9px] font-normal text-slate-400">Yanıtlanan: {answered}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-rose-500 h-full transition-all duration-300 rounded-full"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {c.status === "running" ? (
                            <button
                              onClick={() => handleControlCampaign(c.id, "pause")}
                              className="p-1.5 bg-amber-50 dark:bg-amber-950/30 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                              title="Kampanyayı Durdur"
                            >
                              <Pause size={14} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleControlCampaign(c.id, "start")}
                              className="p-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                              title="Kampanyayı Başlat"
                            >
                              <Play size={14} />
                            </button>
                          )}

                          <button
                            onClick={() => handleControlCampaign(c.id, "reset")}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
                            title="İlerlemeyi Sıfırla"
                          >
                            <RotateCcw size={14} />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedCampaignId(c.id);
                              setShowUploadModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors"
                            title="Numara Listesi Yükle"
                          >
                            <Upload size={14} />
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(c)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors"
                            title="Kampanya Ayarlarını Düzenle"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            onClick={() => setDeleteConfirm({ show: true, id: c.id })}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                            title="Kampanyayı Sil"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Campaign Modal */}
      {showCampaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">
                {editingId ? "DIŞ ARAMA KAMPANYASINI DÜZENLE" : "YENİ DIŞ ARAMA KAMPANYASI"}
              </h3>
              <button
                onClick={() => setShowCampaignModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Native Red Error Banner */}
            {campaignError && (
              <div className="mx-4 mt-3 p-3 bg-rose-50 dark:bg-rose-950/15 border border-rose-200/50 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-between animate-in fade-in duration-200 shrink-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0 text-rose-500" />
                  <span>{campaignError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCampaignError("")}
                  className="p-1 text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 transition-colors rounded-lg shrink-0"
                  title="Kapat"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <form onSubmit={handleSaveCampaign} className="p-5 overflow-y-auto space-y-4">
              {/* Campaign Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Kampanya Adı</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Satış Arama Kampanyası"
                  value={formCampaign.name}
                  onChange={(e) => setFormCampaign(prev => ({ ...prev, name: e.target.value }))}
                  className={`px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
                />
              </div>

              {/* Mode & Trunk */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center">
                    Arama Modu
                    <InfoTooltip text="Progressive: Temsilci boştaysa arar. Predictive: Tahminleme yapar. Power: Sabit hızda arar." />
                  </label>
                  <select
                    value={formCampaign.dial_mode}
                    onChange={(e) => setFormCampaign(prev => ({ ...prev, dial_mode: e.target.value }))}
                    className={`px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
                  >
                    <option value="progressive">Progressive (Temsilciye Duyarlı)</option>
                    <option value="predictive">Predictive (Yapay Zeka Tahminli)</option>
                    <option value="power">Power Dialer (Sabit Hızlı Arama)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                    Arama Çıkış Hattı (Trunk)
                  </label>
                  <select
                    value={formCampaign.outbound_trunk_id}
                    onChange={(e) => setFormCampaign(prev => ({ ...prev, outbound_trunk_id: parseInt(e.target.value) || 1 }))}
                    className={`px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
                  >
                    {trunks.map(t => (
                      <option key={t.id} value={t.id}>{t.trunk_name} ({t.did_number})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Concurrent & Retries */}
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Eşzamanlı Arama Limiti</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formCampaign.concurrent_calls}
                    onChange={(e) => setFormCampaign(prev => ({ ...prev, concurrent_calls: parseInt(e.target.value) || 1 }))}
                    className={`px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Tekrar Arama Denemesi</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formCampaign.retry_count}
                    onChange={(e) => setFormCampaign(prev => ({ ...prev, retry_count: parseInt(e.target.value) || 1 }))}
                    className={`px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Tekrar Aralığı (Dakika)</label>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={formCampaign.retry_interval_minutes}
                    onChange={(e) => setFormCampaign(prev => ({ ...prev, retry_interval_minutes: parseInt(e.target.value) || 5 }))}
                    className={`px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
                  />
                </div>
              </div>

              {/* Destination Routing */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Çağrı Yanıtlandığında Hedef</label>
                  <select
                    value={formCampaign.route_destination_type}
                    onChange={(e) => setFormCampaign(prev => ({ ...prev, route_destination_type: e.target.value }))}
                    className={`px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
                  >
                    <option value="ai">Yapay Zeka Asistanı (AI)</option>
                    <option value="extension">Temsilci Dahili Numarası</option>
                    <option value="queue">Kuyruk (ACD Queue)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Hedef Seçimi</label>
                  {formCampaign.route_destination_type === "ai" ? (
                    <select
                      value={formCampaign.route_destination}
                      onChange={(e) => setFormCampaign(prev => ({ ...prev, route_destination: e.target.value }))}
                      className={`px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
                    >
                      {aiAgents.map(a => (
                        <option key={a.id || a.name} value={a.name}>{a.name} ({a.role || 'Asistan'})</option>
                      ))}
                      {aiAgents.length === 0 && <option value="Sales_AI">Sales_AI (Satış Asistanı)</option>}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Örn: 200 veya Queue_1000"
                      value={formCampaign.route_destination}
                      onChange={(e) => setFormCampaign(prev => ({ ...prev, route_destination: e.target.value }))}
                      className={`px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
                    />
                  )}
                </div>
              </div>

              {/* Working Hours */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Başlangıç Saati</label>
                  <input
                    type="time"
                    value={formCampaign.allowed_hours_start}
                    onChange={(e) => setFormCampaign(prev => ({ ...prev, allowed_hours_start: e.target.value }))}
                    className={`px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Bitiş Saati</label>
                  <input
                    type="time"
                    value={formCampaign.allowed_hours_end}
                    onChange={(e) => setFormCampaign(prev => ({ ...prev, allowed_hours_end: e.target.value }))}
                    className={`px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCampaignModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-4 py-2 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-600/15`}
                >
                  {loading ? "Kaydediliyor..." : "Kampanyayı Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Numbers Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Upload size={16} className="text-rose-500" />
                <span>Telefon Listesi Yükle ({selectedCampaign?.name})</span>
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUploadList} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Telefon Numaraları (Her satıra bir numara veya "Numara, İsim")
                </label>
                <textarea
                  rows={8}
                  required
                  placeholder={"05321002030, Ahmet Yılmaz\n05332003040, Mehmet Demir\n05553004050"}
                  value={uploadInput}
                  onChange={(e) => setUploadInput(e.target.value)}
                  className={`w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} font-mono`}
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition`}
                >
                  Numaraları Listeye Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: null })}
        onConfirm={handleDeleteCampaign}
        title="Kampanyayı Sil"
        message="Bu Dış Arama Kampanyasını ve kampanya listesindeki tüm arama verilerini silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
      />
    </div>
  );
}
