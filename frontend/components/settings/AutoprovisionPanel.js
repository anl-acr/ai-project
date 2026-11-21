import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Smartphone,
  Search,
  Plus,
  Trash2,
  Edit2,
  X,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Monitor,
  Tag,
  User,
  FileText,
  Download,
  Upload,
  Copy,
  Check,
  Globe,
  Network,
  Server,
  Settings,
  Save,
  Zap,
  Power,
  Wifi,
} from "lucide-react";
import * as XLSX from "xlsx";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

const OUI_BRAND_MAP = {
  "00:15:65": "Yealink",
  "80:5e:c0": "Yealink",
  "80:5e:0c": "Yealink",
  "24:9a:d8": "Yealink",
  "c4:fc:e4": "Yealink",
  "00:0b:82": "Grandstream",
  "c0:74:ad": "Grandstream",
  "ec:74:d7": "Grandstream",
  "0c:38:3e": "Fanvil",
  "00:a8:59": "Fanvil",
  "d0:7a:b5": "Fanvil",
  "00:0e:08": "Cisco",
  "68:bc:0c": "Cisco",
  "00:1b:d4": "Cisco",
};

function detectBrandFromMacInput(rawMac) {
  const hex = String(rawMac || "").replace(/[^a-fA-F0-9]/g, "").toLowerCase();
  if (hex.length < 6) return "";
  const oui = `${hex.slice(0, 2)}:${hex.slice(2, 4)}:${hex.slice(4, 6)}`;
  return OUI_BRAND_MAP[oui] || "";
}

export default function AutoprovisionPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();

  const [devices, setDevices] = useState([]);
  const [modelCatalog, setModelCatalog] = useState([]);
  const [users, setUsers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notifyingMac, setNotifyingMac] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [banner, setBanner] = useState(null); // { ok: boolean, text: string }
  const fileInputRef = useRef(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingOriginalMac, setEditingOriginalMac] = useState("");
  const [scanResults, setScanResults] = useState([]);
  const [deleteTargetMac, setDeleteTargetMac] = useState(null);

  // Form states
  const [macAddress, setMacAddress] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [brand, setBrand] = useState("Yealink");
  const [model, setModel] = useState("T42S");
  const [modelFilter, setModelFilter] = useState("");
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

  const API_BASE =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${backendHost}`
      : `http://${backendHost}`;

  const flashBanner = (ok, msg) => {
    setBanner({ ok, text: msg });
    setTimeout(() => setBanner(null), 5000);
  };

  const copyWithFeedback = (val, key) => {
    if (!val || typeof navigator === "undefined") return;
    navigator.clipboard?.writeText(val).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resDev, resUsers, resTemplates, resNet] = await Promise.all([
        fetch(`${API_BASE}/api/settings/autoprovision`),
        fetch(`${API_BASE}/api/settings/users`),
        fetch(`${API_BASE}/api/settings/autoprovision_templates`),
        fetch(`${API_BASE}/api/settings/autoprovision/network`).catch(() => null),
      ]);

      if (resDev.ok) {
        const dataDev = await resDev.json();
        if (Array.isArray(dataDev)) {
          setDevices(dataDev);
        } else if (dataDev.devices) {
          setDevices(dataDev.devices);
        }
        if (Array.isArray(dataDev.model_catalog)) {
          setModelCatalog(dataDev.model_catalog);
        }
      }

      if (resUsers.ok) {
        const dataUsers = await resUsers.json();
        if (Array.isArray(dataUsers)) setUsers(dataUsers);
      }

      if (resTemplates.ok) {
        const dataTemplates = await resTemplates.json();
        if (Array.isArray(dataTemplates)) {
          setTemplates(dataTemplates);
        } else if (dataTemplates.templates) {
          setTemplates(dataTemplates.templates);
        }
      }

      if (resNet && resNet.ok) {
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
    } catch (err) {
      console.error("Oto-provizyon verileri yüklenemedi:", err);
      flashBanner(false, "Veriler yüklenirken bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const brandList = useMemo(() => {
    const order = ["Yealink", "Grandstream", "Fanvil", "Cisco"];
    const found = new Set(modelCatalog.map((m) => m.brand));
    return order.filter((b) => found.size === 0 || found.has(b));
  }, [modelCatalog]);

  const modelsForSelectedBrand = useMemo(() => {
    const list = modelCatalog.filter((m) => m.brand.toLowerCase() === String(brand || "Yealink").toLowerCase());
    const q = modelFilter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => m.model.toLowerCase().includes(q) || m.label.toLowerCase().includes(q));
  }, [modelCatalog, brand, modelFilter]);

  const groupedTemplatesForSelectedModel = useMemo(() => {
    const bLow = String(brand || "").trim().toLowerCase();
    const mLow = String(model || "").trim().toLowerCase();
    const exactMatch = [];
    const sameBrand = [];
    const otherCustom = [];
    templates.forEach((t) => {
      const tb = String(t.brand || "").trim().toLowerCase();
      const tm = String(t.model || "").trim().toLowerCase();
      if (tb === bLow && tm && tm === mLow) {
        exactMatch.push(t);
      } else if (tb === bLow) {
        sameBrand.push(t);
      } else if (!t.is_system) {
        otherCustom.push(t);
      }
    });
    return { exactMatch, sameBrand, otherCustom };
  }, [templates, brand, model]);

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
          default_mode: netDefaultMode,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setNetConfig(d);
        setShowNetEditor(false);
        flashBanner(true, "Provizyon ağ ve yerel IP ayarları kaydedildi.");
      } else {
        flashBanner(false, "Ağ ayarları kaydedilemedi.");
      }
    } catch (err) {
      flashBanner(false, "Ağ ayarları kaydedilemedi.");
    } finally {
      setNetSaving(false);
    }
  };

  const scanNetwork = async () => {
    setScanning(true);
    setScanResults([]);
    setScanMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/settings/autoprovision/scan`);
      const data = await res.json();
      if (data.status === "success") {
        setScanResults(data.discovered || []);
        setScanMessage(data.message || "");
      }
    } catch (err) {
      setScanMessage("Ağ taraması sırasında hata oluştu.");
    } finally {
      setScanning(false);
    }
  };

  const handleMacInputChange = (val) => {
    setMacAddress(val);
    const detected = detectBrandFromMacInput(val);
    if (detected && detected !== brand) {
      setBrand(detected);
      const firstM = modelCatalog.find((m) => m.brand === detected);
      if (firstM) setModel(firstM.model);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!macAddress.trim() || !assignedUserId) {
      flashBanner(false, "MAC adresi ve atanacak kullanıcı seçimi zorunludur.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        mac: macAddress.trim().toLowerCase(),
        ip: ipAddress.trim(),
        brand: (brand || "Yealink").trim(),
        model: (model || "T42S").trim(),
        assigned_user: assignedUserId,
        template_id: templateId,
        connection_mode: connectionMode || "lan",
        provision_date: new Date().toISOString(),
      };

      const res = await fetch(`${API_BASE}/api/settings/autoprovision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const rawText = await res.text();
      let data = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch (eParse) {
        throw new Error(`Sunucu hatası (HTTP ${res.status})`);
      }
      if (!res.ok || data.status === "error") {
        throw new Error(data.detail || data.message || "Cihaz kaydedilemedi.");
      }

      if (Array.isArray(data.devices)) {
        setDevices(data.devices);
      } else {
        await fetchData();
      }
      setShowModal(false);
      flashBanner(true, data.message || "Cihaz kaydedildi ve dahili ile eşleştirildi.");
    } catch (err) {
      flashBanner(false, err.message || "Cihaz kaydedilirken hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetMac) return;
    try {
      const res = await fetch(`${API_BASE}/api/settings/autoprovision/${encodeURIComponent(deleteTargetMac)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Cihaz silinemedi.");
      if (Array.isArray(data.devices)) {
        setDevices(data.devices);
      } else {
        await fetchData();
      }
      flashBanner(true, data.message || "Cihaz ataması kaldırıldı.");
    } catch (err) {
      flashBanner(false, err.message || "Cihaz silinemedi.");
    } finally {
      setDeleteTargetMac(null);
    }
  };

  const handleDeviceNotify = async (dev, reboot = false) => {
    if (!dev?.mac) return;
    setNotifyingMac(`${dev.mac}:${reboot ? "reboot" : "sync"}`);
    try {
      const res = await fetch(`${API_BASE}/api/settings/autoprovision/${encodeURIComponent(dev.mac)}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reboot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Bildirim gönderilemedi.");
      flashBanner(Boolean(data.notified), data.message || "Komut iletildi.");
    } catch (err) {
      flashBanner(false, err.message || "Komut gönderilirken hata oluştu.");
    } finally {
      setNotifyingMac("");
    }
  };

  const handleExportExcel = () => {
    const data = devices.map((dev) => {
      const assignedUser = users.find(
        (u) => String(u.id) === String(dev.assigned_user) || String(u.extension) === String(dev.assigned_extension || dev.assigned_user)
      );
      const tmpl = templates.find((t) => String(t.id) === String(dev.template_id));
      return {
        "MAC Adresi": (dev.mac || "").toUpperCase(),
        "IP Adresi": dev.live_ip || dev.ip || "",
        Marka: dev.brand || "",
        Model: dev.model || "",
        "Ağ Modu": (dev.connection_mode || "lan").toUpperCase(),
        "Atanan Kullanıcı": assignedUser ? `${assignedUser.full_name} (${assignedUser.extension})` : dev.assigned_extension || "",
        Şablon: tmpl ? tmpl.name : "",
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
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);
        let importedCount = 0;

        for (const row of rows) {
          const macVal = String(row["MAC Adresi"] || row["MAC"] || "").trim().toLowerCase();
          if (!macVal) continue;
          const userRaw = String(row["Atanan Kullanıcı"] || "").trim();
          let resolvedUserId = userRaw;
          if (userRaw) {
            const foundUser = users.find(
              (u) =>
                String(u.id) === userRaw ||
                String(u.extension) === userRaw ||
                (u.full_name && u.full_name.toLowerCase() === userRaw.toLowerCase()) ||
                `${u.full_name} (${u.extension})`.toLowerCase() === userRaw.toLowerCase()
            );
            if (foundUser) resolvedUserId = String(foundUser.id);
          }
          if (!resolvedUserId) continue;

          const tmplRaw = String(row["Şablon"] || "").trim();
          const foundTmpl = tmplRaw
            ? templates.find((t) => String(t.id) === tmplRaw || (t.name && t.name.toLowerCase() === tmplRaw.toLowerCase()))
            : null;

          const r = await fetch(`${API_BASE}/api/settings/autoprovision`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mac: macVal,
              ip: String(row["IP Adresi"] || row["IP"] || "").trim(),
              brand: String(row["Marka"] || "").trim(),
              model: String(row["Model"] || "").trim(),
              connection_mode: String(row["Ağ Modu"] || "lan").trim().toLowerCase(),
              assigned_user: resolvedUserId,
              template_id: foundTmpl ? foundTmpl.id : "",
              provision_date: new Date().toISOString(),
            }),
          });
          if (r.ok) importedCount += 1;
        }

        await fetchData();
        flashBanner(true, `${importedCount} cihaz Excel'den başarıyla içe aktarıldı ve eşleştirildi.`);
      } catch (err) {
        flashBanner(false, "Excel dosyası okunurken bir hata oluştu.");
      } finally {
        setLoading(false);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsBinaryString(file);
  };

  const openAddModal = () => {
    setEditingOriginalMac("");
    setMacAddress("");
    setIpAddress("");
    setBrand("Yealink");
    setModel("T42S");
    setModelFilter("");
    setAssignedUserId("");
    setTemplateId("");
    setConnectionMode(netDefaultMode || "lan");
    setShowModal(true);
  };

  const openEditModal = (dev) => {
    setEditingOriginalMac(dev.mac || "");
    setMacAddress(dev.mac || "");
    setIpAddress(dev.live_ip || dev.ip || "");
    setBrand(dev.brand || "Yealink");
    setModel(dev.model || "T42S");
    setModelFilter("");
    setAssignedUserId(String(dev.assigned_user || dev.assigned_extension || ""));
    setTemplateId(dev.template_id || "");
    setConnectionMode(dev.connection_mode || "lan");
    setShowModal(true);
  };

  const handleSelectDiscovered = (dev) => {
    setEditingOriginalMac("");
    setMacAddress(dev.mac || "");
    setIpAddress(dev.ip || "");
    setBrand(dev.brand || "Yealink");
    setModel(dev.model || "T42S");
    setModelFilter("");
    setAssignedUserId("");
    setTemplateId("");
    setConnectionMode("lan");
    setShowModal(true);
  };

  const filteredDevices = devices.filter((d) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (d.mac && d.mac.toLowerCase().includes(q)) ||
      (d.brand && d.brand.toLowerCase().includes(q)) ||
      (d.model && d.model.toLowerCase().includes(q)) ||
      (d.live_ip && d.live_ip.includes(q)) ||
      (d.ip && d.ip.includes(q)) ||
      (d.assigned_user_name && d.assigned_user_name.toLowerCase().includes(q)) ||
      (d.assigned_extension && String(d.assigned_extension).includes(q))
    );
  });

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Header */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${lightBg} ${text} rounded-xl`}>
            <Smartphone size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">
              OTOPROVİZYON (AUTOPROVISIONING)
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Fiziksel IP telefonların MAC adresini dahili abonelere eşleştirin; Kullanıcı SIP ayarları ve Masa Telefonum ekranıyla otomatik senkronize olur.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative">
            <input
              type="text"
              placeholder="MAC, Dahili, İsim, Model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-52 text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} transition-all`}
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          <button
            type="button"
            onClick={fetchData}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 cursor-pointer"
            title="Canlı Durumu Yenile"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>

          <input type="file" accept=".xlsx, .xls" ref={fileInputRef} className="hidden" onChange={handleImportExcel} />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 cursor-pointer"
            title="Excel'den İçe Aktar (Import)"
          >
            <Upload size={16} />
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 cursor-pointer"
            title="Excel'e Dışa Aktar (Export)"
          >
            <Download size={16} />
          </button>

          <button
            type="button"
            onClick={openAddModal}
            title="Yeni Masa Telefonu Eşleştir"
            className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all shadow-sm cursor-pointer"
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
                    className="w-20 px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                  </select>
                  <input
                    type="number"
                    value={netLocalPort}
                    onChange={(e) => setNetLocalPort(e.target.value)}
                    className="flex-1 min-w-0 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
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

      {/* Feedback Banner */}
      {banner && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
            banner.ok
              ? "bg-emerald-50 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/25 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.ok ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
            <span>{banner.text}</span>
          </div>
          <button type="button" onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Side: Paired Devices List */}
        <div className="xl:col-span-8 flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={24} className={`animate-spin ${text}`} />
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-xs font-semibold">
              Kayıtlı masa telefonu bulunamadı. Sağ üstteki <strong>&quot;+&quot;</strong> butonuna tıklayarak MAC adresini dahiliye eşleştirebilir veya <strong>&quot;Ağı Tara&quot;</strong> ile bulabilirsiniz.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-12 text-center">Durum</th>
                    <th className="py-2.5 px-3 text-[11px] font-semibold">MAC / ENDPOINT</th>
                    <th className="py-2.5 px-3 text-[11px] font-semibold">IP / SON PROVİZYON</th>
                    <th className="py-2.5 px-3 text-[11px] font-semibold">MARKA / MODEL</th>
                    <th className="py-2.5 px-3 text-[11px] font-semibold">AĞ</th>
                    <th className="py-2.5 px-3 text-[11px] font-semibold">ATANAN KULLANICI</th>
                    <th className="py-2.5 px-3 text-[11px] font-semibold text-right">İŞLEMLER</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.map((dev) => {
                    const assignedUser = users.find(
                      (u) =>
                        String(u.id) === String(dev.assigned_user) ||
                        (dev.assigned_extension && String(u.extension) === String(dev.assigned_extension))
                    );
                    const isOnline = dev.status === "online";
                    const displayIp = dev.live_ip || dev.ip || "";
                    const provFname =
                      dev.prov_filename || `${String(dev.mac || "").replace(/[^a-fA-F0-9]/g, "").toLowerCase()}.cfg`;
                    const provModePath = String(dev.connection_mode || "lan").toLowerCase() === "wan" ? "wan" : "lan";

                    return (
                      <tr
                        key={dev.mac}
                        className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3 px-3 text-center">
                          <div
                            title={
                              isOnline
                                ? `Çevrimiçi (${displayIp}${dev.rtt_ms ? ` • ${dev.rtt_ms}` : ""})`
                                : "Çevrimdışı (SIP kaydı bekleniyor)"
                            }
                            className={`w-2.5 h-2.5 rounded-full inline-block ${
                              isOnline
                                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"
                                : "bg-slate-300 dark:bg-slate-600"
                            }`}
                          />
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <Monitor size={13} className="text-slate-400 shrink-0" />
                              <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                                {String(dev.mac || "").toUpperCase()}
                              </span>
                            </div>
                            {dev.sip_username && (
                              <span className="text-[10px] font-mono text-slate-400 pl-5">
                                SIP: {dev.sip_username}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md w-fit">
                              {displayIp || "Bekleniyor"}
                            </span>
                            {dev.last_provisioned_at && (
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                Çekildi: {dev.last_provisioned_at}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{dev.brand || "-"}</span>
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                              {dev.model || "-"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {(() => {
                            const cm = String(dev.connection_mode || "lan").toLowerCase();
                            if (cm === "wan") {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-extrabold">
                                  <Globe size={10} /> WAN
                                </span>
                              );
                            }
                            if (cm === "auto") {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-extrabold">
                                  <Network size={10} /> OTO
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-extrabold">
                                <Server size={10} /> LAN
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-3">
                          {assignedUser || dev.assigned_extension ? (
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                {assignedUser?.avatar ? (
                                  <img src={assignedUser.avatar} alt="avatar" className="w-full h-full object-cover" />
                                ) : (
                                  (assignedUser?.full_name || dev.assigned_user_name || "?").charAt(0)
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                  {assignedUser?.full_name || dev.assigned_user_name || "Kullanıcı"}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  Dahili: {assignedUser?.extension || dev.assigned_extension}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Atanmamış</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              disabled={Boolean(notifyingMac)}
                              onClick={() => handleDeviceNotify(dev, false)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                              title="Hızlı Senkronizasyon (SIP Check-Sync)"
                            >
                              <Zap size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(notifyingMac)}
                              onClick={() => handleDeviceNotify(dev, true)}
                              className="p-1.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                              title="Telefonu Yeniden Başlat (SIP Reboot)"
                            >
                              <Power size={14} />
                            </button>
                            {netConfig?.token && dev.mac && (
                              <a
                                href={`${API_BASE}/api/prov/${netConfig.token}/${provModePath}/${provFname}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors"
                                title={`Provizyon Dosyasını Önizle / İndir (${provFname})`}
                              >
                                <Download size={14} />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditModal(dev)}
                              className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                              title="Düzenle"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTargetMac(dev.mac)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
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

        {/* Right Side: Real LAN Network Scanner */}
        <div className="xl:col-span-4 flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm min-h-[380px]">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Wifi size={14} className={text} />
              Ağdaki Yeni Cihazlar
            </h4>
            <button
              type="button"
              onClick={scanNetwork}
              disabled={scanning}
              className={`px-3 py-1.5 ${bg} ${hover} text-white rounded-lg text-[10px] font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer`}
            >
              <RefreshCw size={11} className={scanning ? "animate-spin" : ""} />
              <span>{scanning ? "Taranıyor..." : "Ağı Tara"}</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {scanning ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                <RefreshCw size={24} className={`animate-spin ${text}`} />
                <span className="text-xs font-semibold">Yerel ağdaki IP telefonlar taranıyor...</span>
              </div>
            ) : scanResults.length > 0 ? (
              <div className="space-y-2.5">
                {scanMessage && (
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-2">{scanMessage}</p>
                )}
                {scanResults.map((dev, i) => (
                  <div
                    key={i}
                    className={`flex flex-col p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 hover:${border} transition-all cursor-pointer group`}
                    onClick={() => handleSelectDiscovered(dev)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                        <Smartphone size={12} className="text-slate-400" />
                        {dev.brand} {dev.model}
                      </p>
                      <div className={`p-1 ${bg} text-white rounded-md`}>
                        <Plus size={12} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-[10px] font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {String(dev.mac || "").toUpperCase()}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400">{dev.ip}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400 px-3">
                <AlertTriangle size={24} className="text-amber-500 mb-2 opacity-80" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {scanMessage || "Henüz yeni cihaz bulunamadı."}
                </p>
                <p className="text-[10px] mt-1.5 leading-relaxed">
                  Telefon santralle aynı VLAN&apos;daysa <strong>Ağı Tara</strong> ile bulunur; farklı VLAN/şubedeyse üstteki <strong>+</strong> butonuyla MAC adresini yazıp eşleştirebilirsiniz.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit Device Assignment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200/70 dark:border-slate-700/70">
            <div className={`px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center ${bg} text-white`}>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Smartphone size={18} />
                {editingOriginalMac ? "Masa Telefonu Atamasını Düzenle" : "Yeni Masa Telefonu Eşleştir"}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-white/80 hover:text-white transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* MAC + Optional IP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    MAC Adresi <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={macAddress}
                      onChange={(e) => handleMacInputChange(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                      placeholder="80:5E:C0:XX:XX:XX"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    IP Adresi <span className="text-[10px] font-normal text-slate-400">(Opsiyonel)</span>
                  </label>
                  <input
                    type="text"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                    placeholder="Bağlanınca otomatik dolar"
                  />
                </div>
              </div>

              {/* Brand + Searchable Model */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Marka</label>
                  <select
                    value={brand}
                    onChange={(e) => {
                      const nb = e.target.value;
                      setBrand(nb);
                      setModelFilter("");
                      const firstM = modelCatalog.find((m) => m.brand === nb);
                      if (firstM) setModel(firstM.model);
                    }}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {brandList.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Model</label>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={modelFilter}
                      onChange={(e) => setModelFilter(e.target.value)}
                      placeholder="Model filtrele (örn: T42S)..."
                      className="w-full px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                    />
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      {modelsForSelectedBrand.length > 0 ? (
                        modelsForSelectedBrand.map((m) => (
                          <option key={m.model} value={m.model}>
                            {m.model} ({m.max_dss} DSS{m.max_expansions > 0 ? ` • ${m.expansion_model}` : ""})
                          </option>
                        ))
                      ) : (
                        <option value={model || "T42S"}>{model || "T42S"}</option>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* Assigned User */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Atanacak Kullanıcı / Dahili <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={assignedUserId}
                    onChange={(e) => setAssignedUserId(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  >
                    <option value="">Kullanıcı / Dahili Seçiniz...</option>
                    {users
                      .filter((u) => u.extension)
                      .map((u) => (
                        <option key={u.id} value={String(u.id)}>
                          Dahili {u.extension} — {u.full_name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Template (Filtered & Grouped by Selected Brand + Model) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Konfigürasyon Şablonu ({brand} {model})
                </label>
                <div className="relative">
                  <FileText size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">Otomatik (Nornia Akıllı Provizyon — {brand} {model})</option>
                    {groupedTemplatesForSelectedModel.exactMatch.length > 0 && (
                      <optgroup label={`★ ${brand} ${model} İçin Şablonlar`}>
                        {groupedTemplatesForSelectedModel.exactMatch.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.is_system ? `[Sistem] ${t.name}` : `[Özel] ${t.name}`}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {groupedTemplatesForSelectedModel.sameBrand.length > 0 && (
                      <optgroup label={`Diğer ${brand} Şablonları`}>
                        {groupedTemplatesForSelectedModel.sameBrand.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.is_system ? `[Sistem] ${t.name}` : `[Özel] ${t.name}`}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {groupedTemplatesForSelectedModel.otherCustom.length > 0 && (
                      <optgroup label="Diğer Özel Şablonlar">
                        {groupedTemplatesForSelectedModel.otherCustom.map((t) => (
                          <option key={t.id} value={t.id}>
                            [Özel] {t.name} ({t.brand} {t.model})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>

              {/* Connection Mode */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                  Bağlantı Lokasyonu (Ağ Modu)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "lan", label: "Aynı Ofis (LAN)", desc: "Local IP • Tünelsiz" },
                    { id: "wan", label: "Uzak Şube (WAN)", desc: "Dış IP • NAT" },
                    { id: "auto", label: "Otomatik", desc: "IP'ye göre seç" },
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

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`px-5 py-2 text-xs font-extrabold rounded-xl text-white shadow-sm transition-all ${bg} ${hover} flex items-center gap-1.5 cursor-pointer disabled:opacity-50`}
                >
                  <CheckCircle size={14} />
                  <span>{saving ? "Kaydediliyor..." : "Kaydet & Eşleştir"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal (with isOpen & onClose!) */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTargetMac)}
        title="Cihaz Atamasını Sil"
        message={`${String(deleteTargetMac || "").toUpperCase()} MAC adresli masa telefonunun eşleştirmesini kaldırmak istediğinize emin misiniz?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTargetMac(null)}
      />
    </div>
  );
}
