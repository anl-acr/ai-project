import React, { useState, useEffect } from "react";
import { Smartphone, Search, Plus, Trash2, Edit2, X, RefreshCw, CheckCircle, AlertTriangle, Monitor, Tag, User, FileText } from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

export default function AutoprovisionPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  
  const [devices, setDevices] = useState([]);
  const [users, setUsers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [scanResults, setScanResults] = useState([]);
  const [deleteTargetMac, setDeleteTargetMac] = useState(null);

  // Form states
  const [macAddress, setMacAddress] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [templateId, setTemplateId] = useState("");

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const resDev = await fetch(`${API_BASE}/api/settings/autoprovision`);
      const dataDev = await resDev.json();
      if (Array.isArray(dataDev)) {
        setDevices(dataDev);
      } else if (dataDev.status === "success" && dataDev.devices) {
        setDevices(dataDev.devices);
      }

      const resUsers = await fetch(`${API_BASE}/api/settings/users`);
      const dataUsers = await resUsers.json();
      if (dataUsers) setUsers(dataUsers);

      const resTemplates = await fetch(`${API_BASE}/api/settings/autoprovision_templates`);
      const dataTemplates = await resTemplates.json();
      if (Array.isArray(dataTemplates)) {
        setTemplates(dataTemplates);
      } else if (dataTemplates.templates) {
        setTemplates(dataTemplates.templates);
      }
    } catch (err) {
      console.error("Veriler yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const scanNetwork = async () => {
    setScanning(true);
    setScanResults([]);
    try {
      const res = await fetch(`${API_BASE}/api/settings/autoprovision/scan`);
      const data = await res.json();
      if (data.status === "success") {
        setScanResults(data.discovered || []);
      }
    } catch (err) {
      console.error("Ağ taraması yapılamadı:", err);
    } finally {
      setScanning(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!macAddress.trim() || !assignedUserId) return;

    try {
      const payload = {
        mac: macAddress.trim().toLowerCase(),
        ip: ipAddress.trim(),
        brand: brand.trim(),
        model: model.trim(),
        assigned_user: assignedUserId,
        template_id: templateId,
        provision_date: new Date().toISOString()
      };

      const res = await fetch(`${API_BASE}/api/settings/autoprovision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          setDevices(data.devices);
        }
        setShowModal(false);
        setShowScanModal(false);
      }
    } catch (err) {
      console.error("Cihaz kaydedilemedi:", err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetMac) return;
    try {
      const res = await fetch(`${API_BASE}/api/settings/autoprovision/${deleteTargetMac}`, {
        method: "DELETE"
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          setDevices(data.devices);
        }
      }
    } catch (err) {
      console.error("Cihaz silinemedi:", err);
    } finally {
      setDeleteTargetMac(null);
    }
  };

  const openAddModal = () => {
    setMacAddress("");
    setIpAddress("");
    setBrand("");
    setModel("");
    setAssignedUserId("");
    setTemplateId("");
    setShowModal(true);
  };

  const openEditModal = (dev) => {
    setMacAddress(dev.mac || "");
    setIpAddress(dev.ip || "");
    setBrand(dev.brand || "");
    setModel(dev.model || "");
    setAssignedUserId(dev.assigned_user || "");
    setTemplateId(dev.template_id || "");
    setShowModal(true);
  };

  const handleSelectDiscovered = (dev) => {
    setMacAddress(dev.mac || "");
    setIpAddress(dev.ip || "");
    setBrand(dev.brand || "");
    setModel(dev.model || "");
    setAssignedUserId("");
    setTemplateId("");
    setShowModal(true);
  };

  const filteredDevices = devices.filter(d => 
    (d.mac && d.mac.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (d.brand && d.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (d.ip && d.ip.includes(searchQuery))
  );

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Header */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${lightBg} ${text} rounded-xl`}>
            <Smartphone size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">OTOPROVİZYON (AUTOPROVISIONING)</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Yerel ağdaki SIP telefonları otomatik bulun ve dahili abonelere atayın.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <input
              type="text"
              placeholder="Cihaz Ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-48 text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-550" />
          </div>
          <button
            onClick={openAddModal}
            title="Yeni Cihaz Ekle"
            className={`p-2 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center h-8 w-8 shrink-0`}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Side: List */}
        <div className="xl:col-span-8 flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={24} className={`animate-spin ${text}`} />
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-xs font-semibold">
            Kayıtlı cihaz bulunamadı. "Ağı Tara" veya "+" butonuna tıklayarak ekleyebilirsiniz.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-4 w-12 text-center">Durum</th>
                  <th className="py-2.5 px-4 text-xs font-semibold">MAC ADRESİ</th>
                  <th className="py-2.5 px-4 text-xs font-semibold">IP ADRESİ</th>
                  <th className="py-2.5 px-4 text-xs font-semibold">MARKA / MODEL</th>
                  <th className="py-2.5 px-4 text-xs font-semibold">ATANAN KULLANICI</th>
                  <th className="py-2.5 px-4 text-xs font-semibold text-right">İŞLEMLER</th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map((dev) => {
                  const assignedUser = users.find(u => u.id === dev.assigned_user || u.extension === dev.assigned_user);
                    return (
                      <tr key={dev.mac} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 text-center">
                          <div className={`w-2.5 h-2.5 rounded-full inline-block ${dev.status === "online" ? "bg-emerald-500 shadow-emerald-500/50" : "bg-slate-300 dark:bg-slate-600"} shadow-sm`} />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Monitor size={14} className="text-slate-400" />
                            <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">{dev.mac.toUpperCase()}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-md font-mono">
                            {dev.ip || "Bilinmiyor"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{dev.brand || "-"}</span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wide">{dev.model || "-"}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {assignedUser ? (
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                                {assignedUser.avatar ? (
                                  <img src={assignedUser.avatar} alt="avatar" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-500">
                                    {assignedUser.full_name?.charAt(0)}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{assignedUser.full_name}</span>
                                <span className="text-[10px] text-slate-500">Dahili: {assignedUser.extension}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Atanmamış</span>
                          )}
                        </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(dev)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteTargetMac(dev.mac);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Sil"
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

        {/* Right Side: Network Scanner */}
        <div className="xl:col-span-4 flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300 min-h-[400px]">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <RefreshCw size={14} className={`text-primary ${scanning ? "animate-spin" : ""}`} />
              Ağdaki Yeni Cihazlar
            </h4>
            <button
              onClick={scanNetwork}
              disabled={scanning}
              className={`px-3 py-1.5 ${bg} ${hover} text-white rounded-lg text-[10px] font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50`}
            >
              Ağı Tara
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-1">
            {scanning ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                <RefreshCw size={24} className={`animate-spin ${text}`} />
                <span className="text-xs font-semibold">Ağ taranıyor...</span>
              </div>
            ) : scanResults.length > 0 ? (
              <div className="space-y-3">
                {scanResults.map((dev, i) => (
                  <div key={i} className="flex flex-col p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all cursor-pointer group" onClick={() => handleSelectDiscovered(dev)}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                        <Smartphone size={12} className="text-slate-400" />
                        {dev.brand} {dev.model !== "Bilinmeyen Model" ? dev.model : ""}
                      </p>
                      <div className={`p-1 ${bg} text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity`}>
                        <Plus size={12} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-[10px] font-mono text-slate-500 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">{dev.mac.toUpperCase()}</p>
                      <p className="text-[10px] font-mono text-slate-400">{dev.ip}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                <AlertTriangle size={24} className="text-amber-500 mb-2 opacity-80" />
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Yeni cihaz bulunamadı.</p>
                <p className="text-[10px] mt-1">Ağı tekrar tarayabilirsiniz.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit/Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
            <div className={`px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center ${bg} text-white`}>
              <h3 className="font-bold flex items-center gap-2">
                <Smartphone size={18} />
                Cihaz Ataması Yapılandır
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 ml-1">MAC Adresi</label>
                <div className="relative">
                  <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={macAddress}
                    onChange={(e) => setMacAddress(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                    placeholder="00:15:65:xx:xx:xx"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 ml-1">Marka</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="Yealink, vs."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 ml-1">Model</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="T46U"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 ml-1">Atanacak Kullanıcı / Dahili</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={assignedUserId}
                    onChange={(e) => setAssignedUserId(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all appearance-none"
                    required
                  >
                    <option value="">Seçiniz...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.extension})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 ml-1">Konfigürasyon Şablonu</label>
                <div className="relative">
                  <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all appearance-none"
                  >
                    <option value="">Varsayılan (Şablon Yok)</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-sm font-medium rounded-xl text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 text-sm font-semibold rounded-xl text-white shadow-sm transition-all ${bg} ${hover} hover:-translate-y-0.5 flex items-center gap-2`}
                >
                  <CheckCircle size={16} />
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTargetMac && (
        <ConfirmDeleteModal
          title="Cihaz Atamasını Sil"
          message={`${deleteTargetMac} MAC adresli cihazın yapılandırmasını ve atamasını kaldırmak istediğinize emin misiniz?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTargetMac(null)}
        />
      )}
    </div>
  );
}
