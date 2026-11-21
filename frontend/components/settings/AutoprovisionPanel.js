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
  FileCode,
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
  ChevronDown,
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
  const [userSipDevicesMap, setUserSipDevicesMap] = useState({});
  const [recentLogs, setRecentLogs] = useState([]);
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
  const [showScanModal, setShowScanModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
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
  const [selectedSipDeviceId, setSelectedSipDeviceId] = useState("");
  const [newSipDeviceName, setNewSipDeviceName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const templateDropdownRef = useRef(null);
  const templateSearchInputRef = useRef(null);
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

  useEffect(() => {
    const onOutside = (e) => {
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(e.target)) {
        setTemplateMenuOpen(false);
      }
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setTemplateMenuOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEsc);
    };
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
        if (dataDev.user_sip_devices && typeof dataDev.user_sip_devices === "object") {
          setUserSipDevicesMap(dataDev.user_sip_devices);
        }
        if (Array.isArray(dataDev.recent_logs)) {
          setRecentLogs(dataDev.recent_logs);
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

  const findBestTemplateIdForModel = (bVal, mVal, tplList = templates) => {
    const bLow = String(bVal || "").trim().toLowerCase();
    const mLow = String(mVal || "").trim().toLowerCase();
    if (!bLow || !mLow || !Array.isArray(tplList)) return "";
    // 1. Prefer user's custom template for this exact brand+model
    const exactCustom = tplList.find(
      (t) => !t.is_system && String(t.brand || "").trim().toLowerCase() === bLow && String(t.model || "").trim().toLowerCase() === mLow
    );
    if (exactCustom) return String(exactCustom.id);
    // 2. Otherwise auto-select official built-in system template for this exact brand+model
    const exactSystem = tplList.find(
      (t) => t.is_system && String(t.brand || "").trim().toLowerCase() === bLow && String(t.model || "").trim().toLowerCase() === mLow
    );
    if (exactSystem) return String(exactSystem.id);
    return "";
  };

  const handleMacInputChange = (val) => {
    setMacAddress(val);
    const detected = detectBrandFromMacInput(val);
    if (detected && detected !== brand) {
      setBrand(detected);
      const firstM = modelCatalog.find((m) => m.brand === detected);
      const nextModel = firstM ? firstM.model : model;
      if (firstM) setModel(nextModel);
      setTemplateId(findBestTemplateIdForModel(detected, nextModel));
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
        sip_device_id: selectedSipDeviceId || "",
        new_device_name: selectedSipDeviceId === "__CREATE_NEW__" ? newSipDeviceName.trim() : "",
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
      if (data.user_sip_devices && typeof data.user_sip_devices === "object") {
        setUserSipDevicesMap(data.user_sip_devices);
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
      if (data.user_sip_devices && typeof data.user_sip_devices === "object") {
        setUserSipDevicesMap(data.user_sip_devices);
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

  const getPhysicalDevicesForUser = (uid) => {
    if (!uid) return [];
    const uObj = users.find((u) => String(u.id) === String(uid) || String(u.extension) === String(uid));
    const direct = userSipDevicesMap[String(uid)];
    if (Array.isArray(direct) && direct.length > 0) return direct;
    if (uObj) {
      const byExt = userSipDevicesMap[String(uObj.extension || "")];
      if (Array.isArray(byExt) && byExt.length > 0) return byExt;
      // Direct fallback to user's own sip_devices from GET /api/settings/users (PostgreSQL)
      if (Array.isArray(uObj.sip_devices) && uObj.sip_devices.length > 0) {
        return uObj.sip_devices
          .filter((d) => d && ["desk_phone", "dect", "softphone"].includes(String(d.device_type || "").toLowerCase()))
          .map((d) => ({
            id: String(d.id || d.sip_username || ""),
            name: String(d.name || "Masa Telefonu"),
            device_type: String(d.device_type || "desk_phone"),
            sip_username: String(d.sip_username || ""),
            mac: String(d.mac || ""),
            brand: String(d.brand || ""),
            model: String(d.model || ""),
          }));
      }
    }
    return [];
  };

  const handleAssignedUserChange = (newUid, preferMac = "", preferDevId = "") => {
    setAssignedUserId(newUid);
    setNewSipDeviceName("");
    const phys = getPhysicalDevicesForUser(newUid);
    if (!phys.length) {
      setSelectedSipDeviceId("__CREATE_NEW__");
      return;
    }
    const cleanPreferMac = String(preferMac || "").replace(/[^a-fA-F0-9]/g, "").toLowerCase();
    if (preferDevId && phys.some((d) => String(d.id) === String(preferDevId))) {
      setSelectedSipDeviceId(String(preferDevId));
      return;
    }
    if (cleanPreferMac) {
      const byMac = phys.find((d) => String(d.mac || "").replace(/[^a-fA-F0-9]/g, "").toLowerCase() === cleanPreferMac);
      if (byMac) {
        setSelectedSipDeviceId(String(byMac.id));
        return;
      }
    }
    const firstEmpty = phys.find((d) => !String(d.mac || "").trim());
    if (firstEmpty) {
      setSelectedSipDeviceId(String(firstEmpty.id));
      return;
    }
    // All existing SIP slots already have a MAC -> default to creating a fresh 2nd SIP account!
    setSelectedSipDeviceId("__CREATE_NEW__");
  };

  const openAddModal = () => {
    setEditingOriginalMac("");
    setMacAddress("");
    setIpAddress("");
    setBrand("Yealink");
    setModel("T42S");
    setModelFilter("");
    setAssignedUserId("");
    setSelectedSipDeviceId("");
    setNewSipDeviceName("");
    setTemplateId(findBestTemplateIdForModel("Yealink", "T42S"));
    setTemplateMenuOpen(false);
    setTemplateSearch("");
    setConnectionMode(netDefaultMode || "lan");
    setShowModal(true);
  };

  const openEditModal = (dev) => {
    setEditingOriginalMac(dev.mac || "");
    setMacAddress(dev.mac || "");
    setIpAddress(dev.live_ip || dev.ip || "");
    const bVal = dev.brand || "Yealink";
    const mVal = dev.model || "T42S";
    setBrand(bVal);
    setModel(mVal);
    setModelFilter("");
    const uidVal = String(dev.assigned_user || dev.assigned_extension || "");
    handleAssignedUserChange(uidVal, dev.mac || "", dev.sip_device_id || "");
    setTemplateId(dev.template_id || findBestTemplateIdForModel(bVal, mVal));
    setTemplateMenuOpen(false);
    setTemplateSearch("");
    setConnectionMode(dev.connection_mode || "lan");
    setShowModal(true);
  };

  const handleSelectDiscovered = (dev) => {
    setEditingOriginalMac("");
    setMacAddress(dev.mac || "");
    setIpAddress(dev.ip || "");
    const bVal = dev.brand || "Yealink";
    const mVal = dev.model || "T42S";
    setBrand(bVal);
    setModel(mVal);
    setModelFilter("");
    setAssignedUserId("");
    setSelectedSipDeviceId("");
    setNewSipDeviceName("");
    setTemplateId(findBestTemplateIdForModel(bVal, mVal));
    setTemplateMenuOpen(false);
    setTemplateSearch("");
    setConnectionMode("lan");
    setShowScanModal(false);
    setShowModal(true);
  };

  const openScanModal = () => {
    setShowScanModal(true);
    scanNetwork();
  };

  const openLogsModal = () => {
    setShowLogsModal(true);
    fetchData();
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
              OTOPROVİZYON
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
            onClick={openScanModal}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 cursor-pointer"
            title="Ağdaki Yeni Cihazları Tara"
          >
            <Wifi size={15} className={scanning ? "animate-pulse" : ""} />
          </button>

          <button
            type="button"
            onClick={openLogsModal}
            className="relative p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all h-8 w-8 flex items-center justify-center shrink-0 cursor-pointer"
            title="Son Provizyon İstekleri (Canlı İzleme)"
          >
            <FileCode size={15} />
            {recentLogs.length > 0 && (
              <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${bg}`} />
            )}
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
                  Farklı Lokasyon / Uzak Şube (WAN — Zero-Touch / DHCP Option 66)
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-bold">
                  SIP: {netConfig.network?.wan_sip_host}:5060{netConfig.network?.sip_edge_active ? " • TCP (SIP Edge)" : ""}
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

      {/* Main Content: Full-Width Paired Devices List */}
      <div className="flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm">
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
                                {dev.sip_device_name ? `${dev.sip_device_name} • ` : ""}SIP: {dev.sip_username}
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

      {/* Network Scanner Popup Modal */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden border border-slate-200/70 dark:border-slate-700/70">
            <div className={`px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center ${bg} text-white shrink-0`}>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Wifi size={17} />
                Ağdaki Yeni Cihazları Tara
              </h3>
              <button
                type="button"
                onClick={() => setShowScanModal(false)}
                className="text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Yerel ağdaki eşleştirilmemiş IP telefonlar (Yealink, Grandstream, Fanvil, Cisco) taranır.
                </p>
                <button
                  type="button"
                  onClick={scanNetwork}
                  disabled={scanning}
                  className={`px-3.5 py-1.5 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 shrink-0 cursor-pointer`}
                >
                  <RefreshCw size={12} className={scanning ? "animate-spin" : ""} />
                  <span>{scanning ? "Taranıyor..." : "Tekrar Tara"}</span>
                </button>
              </div>

              {scanning ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                  <RefreshCw size={26} className={`animate-spin ${text}`} />
                  <span className="text-xs font-semibold">Yerel ağdaki IP telefonlar taranıyor...</span>
                </div>
              ) : scanResults.length > 0 ? (
                <div className="space-y-2.5">
                  {scanMessage && (
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{scanMessage}</p>
                  )}
                  {scanResults.map((dev, i) => (
                    <div
                      key={`${dev.mac || dev.ip}-${i}`}
                      className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:${border} transition-all`}
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                          <Smartphone size={13} className={text} />
                          <span>{dev.brand} {dev.model}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                            {String(dev.mac || "").toUpperCase()}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            {dev.ip || "-"}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectDiscovered(dev)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold shadow-sm shrink-0 cursor-pointer`}
                      >
                        <Plus size={13} />
                        <span>Listeye Ekle</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400 px-4 bg-slate-50/70 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <AlertTriangle size={24} className="text-amber-500 mb-2 opacity-80" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {scanMessage || "Yerel ağda yeni eşleştirilmemiş IP telefon bulunamadı."}
                  </p>
                  <p className="text-[11px] mt-1.5 leading-relaxed max-w-sm">
                    Telefon farklı bir VLAN veya uzak şubedeyse sağ üstteki <strong>+</strong> butonundan MAC adresini girerek doğrudan eşleştirebilirsiniz.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowScanModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Provisioning Request Logs Popup Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden border border-slate-200/70 dark:border-slate-700/70">
            <div className={`px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center ${bg} text-white shrink-0`}>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <FileCode size={17} />
                Son Provizyon İstekleri (Canlı İzleme)
              </h3>
              <button
                type="button"
                onClick={() => setShowLogsModal(false)}
                className="text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Masa telefonlarından provizyon sunucusuna ulaşan son HTTP/HTTPS dosya istekleri anlık listelenir.
                </p>
                <button
                  type="button"
                  onClick={fetchData}
                  disabled={loading}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${bg} ${hover} text-white text-xs font-bold shadow-sm shrink-0 cursor-pointer disabled:opacity-50`}
                >
                  <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                  <span>Yenile</span>
                </button>
              </div>

              {recentLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 bg-slate-50/70 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  Henüz telefonlardan gelen provizyon isteği kaydedilmedi. Telefondan <strong>Auto Provision</strong> veya DHCP Option 66 tetiklendiğinde istekler burada anlık görünür.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-2.5 px-3">Zaman</th>
                        <th className="py-2.5 px-3">Dosya</th>
                        <th className="py-2.5 px-3">Durum</th>
                        <th className="py-2.5 px-3">IP Adresi</th>
                        <th className="py-2.5 px-3">Açıklama</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLogs.map((lg, idx) => (
                        <tr
                          key={`${lg.timestamp}-${lg.filename}-${idx}`}
                          className="border-b last:border-b-0 border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                        >
                          <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                            {lg.timestamp}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {lg.filename}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-extrabold ${
                                lg.status_code === 200
                                  ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                                  : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                              }`}
                            >
                              {lg.status_code}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {lg.client_ip || "-"}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-600 dark:text-slate-300">
                            {lg.detail}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowLogsModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Device Assignment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden border border-slate-200/70 dark:border-slate-700/70">
            <div className={`px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center ${bg} text-white shrink-0`}>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Smartphone size={18} />
                {editingOriginalMac ? "Masa Telefonu Atamasını Düzenle" : "Yeni Masa Telefonu Eşleştir"}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-white/80 hover:text-white transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
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

              {/* Brand + Searchable Model (Auto-selects matching template!) */}
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
                      const nextModel = firstM ? firstM.model : model;
                      if (firstM) setModel(nextModel);
                      setTemplateId(findBestTemplateIdForModel(nb, nextModel));
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
                      onChange={(e) => {
                        const v = e.target.value;
                        setModelFilter(v);
                        const matchList = modelCatalog.filter(
                          (m) =>
                            m.brand.toLowerCase() === String(brand || "Yealink").toLowerCase() &&
                            (m.model.toLowerCase().includes(v.trim().toLowerCase()) ||
                              m.label.toLowerCase().includes(v.trim().toLowerCase()))
                        );
                        if (matchList.length === 1) {
                          setModel(matchList[0].model);
                          setTemplateId(findBestTemplateIdForModel(brand, matchList[0].model));
                        }
                      }}
                      placeholder="Model ara (örn: T42S)..."
                      className="w-full px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                    />
                    <select
                      value={model}
                      onChange={(e) => {
                        const nm = e.target.value;
                        setModel(nm);
                        setTemplateId(findBestTemplateIdForModel(brand, nm));
                      }}
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
                    onChange={(e) => handleAssignedUserChange(e.target.value, macAddress, "")}
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

              {/* Target SIP Device under Selected User (Always Visible — Multi-Phone Support!) */}
              {(() => {
                const userPhysDevices = assignedUserId ? getPhysicalDevicesForUser(assignedUserId) : [];
                const chosenSlot = userPhysDevices.find((d) => String(d.id) === String(selectedSipDeviceId));
                const cleanInputMac = String(macAddress || "").replace(/[^a-fA-F0-9]/g, "").toLowerCase();
                const chosenExistingMac = String(chosenSlot?.mac || "").replace(/[^a-fA-F0-9]/g, "").toLowerCase();
                const willOverwriteDifferentMac = Boolean(
                  chosenSlot && chosenExistingMac && cleanInputMac && chosenExistingMac !== cleanInputMac
                );
                return (
                  <div className="space-y-2 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                        Bağlanacak Masa Telefonu (SIP Cihazı)
                      </label>
                      {assignedUserId && (
                        <span className="text-[10px] font-bold text-slate-400">
                          {userPhysDevices.length} kayıtlı SIP cihazı
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Smartphone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <select
                        disabled={!assignedUserId}
                        value={assignedUserId ? selectedSipDeviceId : ""}
                        onChange={(e) => setSelectedSipDeviceId(e.target.value)}
                        className="w-full pl-8 pr-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:opacity-60"
                      >
                        {!assignedUserId ? (
                          <option value="">Önce yukarıdan kullanıcı / dahili seçiniz...</option>
                        ) : (
                          <>
                            {userPhysDevices.map((sd) => {
                              const hasMac = Boolean(String(sd.mac || "").trim());
                              return (
                                <option key={sd.id} value={String(sd.id)}>
                                  {sd.name} • SIP: {sd.sip_username} ({hasMac ? `MAC: ${sd.mac.toUpperCase()}` : "MAC Boş — Müsait"})
                                </option>
                              );
                            })}
                            <option value="__CREATE_NEW__">
                              + Bu Kullanıcıya Yeni Masa Telefonu (SIP Hesabı) Oluştur
                            </option>
                          </>
                        )}
                      </select>
                    </div>

                    {assignedUserId && selectedSipDeviceId === "__CREATE_NEW__" && (
                      <input
                        type="text"
                        value={newSipDeviceName}
                        onChange={(e) => setNewSipDeviceName(e.target.value)}
                        placeholder={`Yeni cihaz adı (örn: Ofis ${brand} ${model} veya Ev Telefonu)`}
                        className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                      />
                    )}

                    {willOverwriteDifferentMac && (
                      <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle size={12} className="shrink-0" />
                        <span>
                          Bu SIP hesabında mevcut <strong>{chosenSlot.mac.toUpperCase()}</strong> yerine yeni MAC atanacaktır. 2. telefon ekliyorsanız <strong>&quot;+ Yeni Masa Telefonu Oluştur&quot;</strong> seçin.
                        </span>
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Searchable & Auto-Matched Template Combobox */}
              <div className="relative" ref={templateDropdownRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Konfigürasyon Şablonu ({brand} {model})
                  </label>
                  {templateId && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      Modelle Eşleşti
                    </span>
                  )}
                </div>
                {(() => {
                  const selectedTplObj = templates.find((t) => String(t.id) === String(templateId));
                  const q = templateSearch.trim().toLowerCase();
                  const filterMatch = (t) =>
                    !q ||
                    String(t.name || "").toLowerCase().includes(q) ||
                    String(t.brand || "").toLowerCase().includes(q) ||
                    String(t.model || "").toLowerCase().includes(q);
                  const exactFiltered = groupedTemplatesForSelectedModel.exactMatch.filter(filterMatch);
                  const sameBrandFiltered = groupedTemplatesForSelectedModel.sameBrand.filter(filterMatch);
                  const otherFiltered = groupedTemplatesForSelectedModel.otherCustom.filter(filterMatch);

                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !templateMenuOpen;
                          setTemplateMenuOpen(next);
                          setTemplateSearch("");
                          if (next) setTimeout(() => templateSearchInputRef.current?.focus(), 20);
                        }}
                        className="w-full flex items-center justify-between gap-2 pl-3 pr-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/70 text-slate-900 dark:text-white transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <FileText size={14} className="text-slate-400 shrink-0" />
                          <span className="truncate">
                            {selectedTplObj
                              ? `${selectedTplObj.is_system ? "[Sistem]" : "[Özel]"} ${selectedTplObj.name}`
                              : `Otomatik (Nornia Akıllı Provizyon — ${brand} ${model})`}
                          </span>
                        </span>
                        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${templateMenuOpen ? "rotate-180" : ""}`} />
                      </button>

                      {templateMenuOpen && (
                        <div className="absolute left-0 right-0 mt-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl z-50 overflow-hidden">
                          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="relative">
                              <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
                              <input
                                ref={templateSearchInputRef}
                                type="text"
                                value={templateSearch}
                                onChange={(e) => setTemplateSearch(e.target.value)}
                                placeholder="Şablon ara... (örn: T42S, Özel, Yealink)"
                                className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none"
                              />
                              {templateSearch && (
                                <button
                                  type="button"
                                  onClick={() => setTemplateSearch("")}
                                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                  <X size={13} />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="max-h-60 overflow-y-auto p-1.5 space-y-1">
                            {/* Exact Match Section */}
                            {exactFiltered.length > 0 && (
                              <div>
                                <div className="px-2.5 py-1 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                                  ★ {brand} {model} İçin Eşleşen Şablonlar
                                </div>
                                {exactFiltered.map((t) => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => {
                                      setTemplateId(String(t.id));
                                      setTemplateMenuOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left text-xs font-bold transition cursor-pointer ${
                                      String(templateId) === String(t.id)
                                        ? `${lightBg} ${text}`
                                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    }`}
                                  >
                                    <span className="truncate">
                                      {t.is_system ? "[Sistem]" : "[Özel]"} {t.name}
                                    </span>
                                    {String(templateId) === String(t.id) && <Check size={13} className="shrink-0" />}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Automatic Smart Provisioning */}
                            {(!q || "otomatik nornia akilli provizyon".includes(q)) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTemplateId("");
                                  setTemplateMenuOpen(false);
                                }}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left text-xs font-bold transition cursor-pointer ${
                                  !templateId
                                    ? `${lightBg} ${text}`
                                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                              >
                                <span className="truncate">Otomatik (Nornia Akıllı Provizyon — {brand} {model})</span>
                                {!templateId && <Check size={13} className="shrink-0" />}
                              </button>
                            )}

                            {/* Same Brand Templates */}
                            {sameBrandFiltered.length > 0 && (
                              <div>
                                <div className="px-2.5 py-1 text-[10px] font-black uppercase text-slate-400">
                                  Diğer {brand} Şablonları ({sameBrandFiltered.length})
                                </div>
                                {sameBrandFiltered.map((t) => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => {
                                      setTemplateId(String(t.id));
                                      setTemplateMenuOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold transition cursor-pointer ${
                                      String(templateId) === String(t.id)
                                        ? `${lightBg} ${text}`
                                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    }`}
                                  >
                                    <span className="truncate">
                                      {t.is_system ? "[Sistem]" : "[Özel]"} {t.name}
                                    </span>
                                    {String(templateId) === String(t.id) && <Check size={13} className="shrink-0" />}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Other Custom Templates */}
                            {otherFiltered.length > 0 && (
                              <div>
                                <div className="px-2.5 py-1 text-[10px] font-black uppercase text-slate-400">
                                  Diğer Özel Şablonlar
                                </div>
                                {otherFiltered.map((t) => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => {
                                      setTemplateId(String(t.id));
                                      setTemplateMenuOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold transition cursor-pointer ${
                                      String(templateId) === String(t.id)
                                        ? `${lightBg} ${text}`
                                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    }`}
                                  >
                                    <span className="truncate">
                                      [Özel] {t.name} ({t.brand} {t.model})
                                    </span>
                                    {String(templateId) === String(t.id) && <Check size={13} className="shrink-0" />}
                                  </button>
                                ))}
                              </div>
                            )}

                            {exactFiltered.length === 0 && sameBrandFiltered.length === 0 && otherFiltered.length === 0 && q && (
                              <div className="px-3 py-4 text-center text-xs text-slate-400">
                                &quot;{templateSearch}&quot; ile eşleşen şablon bulunamadı.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
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
