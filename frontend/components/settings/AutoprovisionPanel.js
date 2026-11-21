import React, { useState, useEffect, useRef } from "react";
import { Smartphone, Search, Plus, Trash2, Edit2, X, RefreshCw, CheckCircle, AlertTriangle, Monitor, Tag, User, FileText, Download, Upload, Copy, Check, Globe, Network, Server, Settings, Save } from "lucide-react";
import * as XLSX from "xlsx";
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
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  
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
  const [connectionMode, setConnectionMode] = useState("lan");

  // LAN / WAN Provisioning Network Config states
  const [netConfig, setNetConfig] = useState(null);
  const [showNetEditor, setShowNetEditor] = useState(false);
  const [netLocalIp, setNetLocalIp] = useState("");
  const [netLocalPort, setNetLocalPort] = useState("8000");
  const [netLocalScheme, setNetLocalScheme] = useState("http");
  const [netWanSipHost, setNetWanSipHost] = useState("");
  const [netWanProvBase, setNetWanProvBase] = useState("");
  const [netDefaultMode, setNetDefaultMode] = useState("lan");
  const [netSaving, setNetSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");

  const copyWithFeedback = (val, key) => {
    if (!val || typeof navigator === "undefined") return;
    navigator.clipboard?.writeText(val).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  };

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

      try {
        const resNet = await fetch(`${API_BASE}/api/settings/autoprovision/network`);
        if (resNet.ok) {
          const dataNet = await resNet.json();
          setNetConfig(dataNet);
          const n = dataNet.network || {};
          setNetLocalIp(n.configured_local_ip || n.local_ip || "");
          setNetLocalPort(String(n.local_port || 8000));
          setNetLocalScheme(n.local_scheme || "http");
          setNetWanSipHost(n.configured_wan_sip_host || n.wan_sip_host || "");
          setNetWanProvBase(n.configured_wan_prov_base || n.wan_prov_base || "");
          setNetDefaultMode(n.default_mode || "lan");
        }
      } catch (eNet) {}
    } catch (err) {
      console.error("Veriler yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNetworkConfig = async () => {
    setNetSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/autoprovision/network`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          local_ip: netLocalIp.trim(),
          local_port: parseInt(netLocalPort, 10) || 8000,
          local_scheme: netLocalScheme,
          wan_sip_host: netWanSipHost.trim(),
          wan_prov_base: netWanProvBase.trim(),
          default_mode: netDefaultMode
        })
      });
      if (res.ok) {
        const d = await res.json();
        setNetConfig(d);
        setShowNetEditor(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setError("Ağ ayarları kaydedilemedi.");
      setTimeout(() => setError(null), 3500);
    } finally {
      setNetSaving(false);
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
        connection_mode: connectionMode || "lan",
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

  const handleExportExcel = () => {
    const data = devices.map(dev => {
      const assignedUser = users.find(u => u.id === dev.assigned_user || u.extension === dev.assigned_user);
      const tmpl = templates.find(t => String(t.id) === String(dev.template_id));
      return {
        "MAC Adresi": dev.mac || "",
        "IP Adresi": dev.ip || "",
        "Marka": dev.brand || "",
        "Model": dev.model || "",
        "Atanan Kullanıcı": assignedUser ? `${assignedUser.full_name} (${assignedUser.extension})` : (dev.assigned_user || ""),
        "Şablon": tmpl ? tmpl.name : (dev.template_id || "")
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "OtoProvizyon");
    XLSX.writeFile(workbook, "OtoProvizyon.xlsx");
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      setLoading(true);
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        for (const row of data) {
          const macVal = String(row["MAC Adresi"] || row["MAC"] || "").trim().toLowerCase();
          if (!macVal) continue;
          const ipVal = String(row["IP Adresi"] || row["IP"] || "").trim();
          const brandVal = String(row["Marka"] || "").trim();
          const modelVal = String(row["Model"] || "").trim();
          const userRaw = String(row["Atanan Kullanıcı"] || "").trim();
          const tmplRaw = String(row["Şablon"] || "").trim();

          let resolvedUserId = userRaw;
          if (userRaw) {
            const foundUser = users.find(u =>
              String(u.id) === userRaw ||
              String(u.extension) === userRaw ||
              (u.full_name && u.full_name.toLowerCase() === userRaw.toLowerCase()) ||
              (`${u.full_name} (${u.extension})`).toLowerCase() === userRaw.toLowerCase()
            );
            if (foundUser) resolvedUserId = foundUser.id;
          }

          let resolvedTmplId = tmplRaw;
          if (tmplRaw) {
            const foundTmpl = templates.find(t =>
              String(t.id) === tmplRaw ||
              (t.name && t.name.toLowerCase() === tmplRaw.toLowerCase())
            );
            if (foundTmpl) resolvedTmplId = foundTmpl.id;
          }

          await fetch(`${API_BASE}/api/settings/autoprovision`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mac: macVal,
              ip: ipVal,
              brand: brandVal,
              model: modelVal,
              assigned_user: resolvedUserId,
              template_id: resolvedTmplId,
              provision_date: new Date().toISOString()
            })
          });
        }

        setError(null);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 4000);
        await fetchData();
      } catch (err) {
        console.error("Excel import error:", err);
        setError("Excel dosyası okunurken bir hata oluştu.");
        setTimeout(() => setError(null), 4000);
      } finally {
        setLoading(false);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsBinaryString(file);
  };

  const openAddModal = () => {
    setMacAddress("");
    setIpAddress("");
    setBrand("");
    setModel("");
    setAssignedUserId("");
    setTemplateId("");
    setConnectionMode(netDefaultMode || "lan");
    setShowModal(true);
  };

  const openEditModal = (dev) => {
    setMacAddress(dev.mac || "");
    setIpAddress(dev.ip || "");
    setBrand(dev.brand || "");
    setModel(dev.model || "");
    setAssignedUserId(dev.assigned_user || "");
    setTemplateId(dev.template_id || "");
    setConnectionMode(dev.connection_mode || "lan");
    setShowModal(true);
  };

  const handleSelectDiscovered = (dev) => {
    setMacAddress(dev.mac || "");
    setIpAddress(dev.ip || "");
    setBrand(dev.brand || "");
    setModel(dev.model || "");
    setAssignedUserId("");
    setTemplateId("");
    setConnectionMode("lan");
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

          <input 
            type="file" 
            accept=".xlsx, .xls" 
            ref={fileInputRef}
            className="hidden" 
            onChange={handleImportExcel}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50"
            title="Excel'den İçe Aktar (Import)"
          >
            <Upload size={16} />
          </button>

          <button
            onClick={handleExportExcel}
            className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 border border-transparent hover:border-blue-200 dark:hover:border-blue-800/50"
            title="Excel'e Dışa Aktar (Export)"
          >
            <Download size={16} />
          </button>

          <button
            onClick={openAddModal}
            title="Yeni Cihaz Ekle"
            className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all shadow-sm"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* LAN / WAN Provisioning Server URL & Local IP Card */}
      {netConfig && (
        <div className={`p-5 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl ${lightBg} ${text} border ${borderLight} flex items-center justify-center shrink-0`}>
                <Network size={18} />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Provizyon Sunucu Adresleri (LAN / WAN &amp; DHCP Option 66)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Santral ile aynı lokasyondaki masa telefonları tünelsiz doğrudan Yerel IP ({netConfig.network?.local_ip}) üzerinden provizyon ve SIP kaydı alır.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowNetEditor((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              <Settings size={13} />
              <span>{showNetEditor ? "Ayarları Gizle" : "Yerel IP / Ağ Ayarları"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {/* LAN Box */}
            <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-800 dark:text-emerald-300">
                  <Server size={13} />
                  Aynı Lokasyon (LAN — Tünelsiz / DHCP Option 66)
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">
                  SIP: {netConfig.network?.local_ip}:5060
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={netConfig.lan_prov_url || ""}
                  className="flex-1 text-[11px] font-mono px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 text-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => copyWithFeedback(netConfig.lan_prov_url, "lan-url")}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors cursor-pointer shrink-0"
                >
                  {copiedKey === "lan-url" ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedKey === "lan-url" ? "Kopyalandı" : "Kopyala"}</span>
                </button>
              </div>
            </div>

            {/* WAN Box */}
            <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                  <Globe size={13} />
                  Farklı Lokasyon / Uzak Şube (WAN)
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-bold">
                  SIP: {netConfig.network?.wan_sip_host}:5060
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={netConfig.wan_prov_url || ""}
                  className="flex-1 text-[11px] font-mono px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => copyWithFeedback(netConfig.wan_prov_url, "wan-url")}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg ${bg} ${hover} text-white text-[11px] font-bold transition-colors cursor-pointer shrink-0`}
                >
                  {copiedKey === "wan-url" ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedKey === "wan-url" ? "Kopyalandı" : "Kopyala"}</span>
                </button>
              </div>
            </div>
          </div>

          {showNetEditor && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Santral Yerel IP (Oto: {netConfig.network?.detected_local_ip})
                </label>
                <input
                  type="text"
                  value={netLocalIp}
                  onChange={(e) => setNetLocalIp(e.target.value)}
                  placeholder={netConfig.network?.detected_local_ip || "172.20.5.252"}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Yerel Port &amp; Protokol</label>
                <div className="flex gap-1.5">
                  <select
                    value={netLocalScheme}
                    onChange={(e) => setNetLocalScheme(e.target.value)}
                    className="w-20 px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  >
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                  </select>
                  <input
                    type="number"
                    value={netLocalPort}
                    onChange={(e) => setNetLocalPort(e.target.value)}
                    className="flex-1 min-w-0 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Dış (WAN) SIP Sunucusu</label>
                <input
                  type="text"
                  value={netWanSipHost}
                  onChange={(e) => setNetWanSipHost(e.target.value)}
                  placeholder={netConfig.network?.nat_extern_ip || "Dış IP / Domain"}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Varsayılan Cihaz Modu</label>
                <select
                  value={netDefaultMode}
                  onChange={(e) => setNetDefaultMode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100"
                >
                  <option value="lan">Aynı Lokasyon (LAN)</option>
                  <option value="auto">Otomatik Algıla (Auto)</option>
                  <option value="wan">Uzak Şube (WAN)</option>
                </select>
              </div>
              <div>
                <button
                  type="button"
                  disabled={netSaving}
                  onClick={handleSaveNetworkConfig}
                  className={`w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold shadow-sm cursor-pointer disabled:opacity-50`}
                >
                  <Save size={13} />
                  <span>{netSaving ? "Kaydediliyor..." : "Ağ Ayarını Kaydet"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/15 border border-emerald-200/50 dark:border-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
          <CheckCircle size={15} />
          <span>Cihazlar başarıyla içe aktarıldı ve kaydedildi.</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/15 border border-rose-200/50 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
          <AlertTriangle size={15} />
          <span>{error}</span>
        </div>
      )}

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
                  <th className="py-2.5 px-4 text-xs font-semibold">AĞ MODU</th>
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
                          {(() => {
                            const cm = String(dev.connection_mode || "lan").toLowerCase();
                            if (cm === "wan") {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-extrabold">
                                  <Globe size={11} /> WAN
                                </span>
                              );
                            }
                            if (cm === "auto") {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-extrabold">
                                  <Network size={11} /> OTO
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-extrabold">
                                <Server size={11} /> LAN
                              </span>
                            );
                          })()}
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
                        <div className="flex items-center justify-end gap-1.5">
                          {netConfig?.token && dev.mac && (
                            <a
                              href={`${API_BASE}/api/prov/${netConfig.token}/${String(dev.connection_mode || "lan").toLowerCase() === "wan" ? "wan" : "lan"}/${String(dev.mac).replace(/[^a-fA-F0-9]/g, "").toLowerCase()}.cfg`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors"
                              title="Provizyon Config Dosyasını Önizle / İndir"
                            >
                              <Download size={14} />
                            </a>
                          )}
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

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 ml-1">
                  Bağlantı Lokasyonu (Ağ Modu)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "lan", label: "Aynı Ofis (LAN)", desc: "Local IP • Tünelsiz" },
                    { id: "wan", label: "Uzak Şube (WAN)", desc: "Dış IP • NAT" },
                    { id: "auto", label: "Otomatik", desc: "IP'ye göre seç" }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setConnectionMode(opt.id)}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        connectionMode === opt.id
                          ? `${lightBg} ${border} ${text}`
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <div className="text-[11px] font-extrabold">{opt.label}</div>
                      <div className="text-[9px] opacity-75 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-500/20 transition-all cursor-pointer"
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
