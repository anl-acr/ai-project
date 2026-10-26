import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  PhoneCall, 
  Save, 
  CheckCircle, 
  Server, 
  HardDrive, 
  Network, 
  Cable, 
  Plus, 
  Trash2, 
  Edit2,
  X, 
  ArrowRight,
  HelpCircle,
  Fingerprint,
  Search,
  Shield,
  AlertTriangle,
  Download,
  Upload,
  Settings,
  Sliders,
  FileCode2,
  RefreshCw,
  Copy,
  Check,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import * as XLSX from "xlsx";

import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

const SYSTEM_CODECS = [
  { id: "alaw", label: "G.711 A-Law (alaw)" },
  { id: "ulaw", label: "G.711 µ-Law (ulaw)" },
  { id: "g722", label: "G.722 HD Geniş Bant (g722)" },
  { id: "g729", label: "G.729 Düşük Bant (g729)" },
  { id: "opus", label: "Opus Yüksek Kalite (opus)" },
  { id: "gsm", label: "GSM (gsm)" },
  { id: "ilbc", label: "iLBC (ilbc)" },
  { id: "h264", label: "H.264 Video (h264)" },
  { id: "vp8", label: "VP8 Video (vp8)" }
];

const DEFAULT_SIP_HEADERS = {
  inbound_caller_header: "default",
  inbound_callee_header: "default",
  outbound_from_user: "default",
  outbound_from_user_custom: "",
  outbound_from_name: "ext_name",
  outbound_from_name_custom: "",
  outbound_diversion: "none",
  outbound_diversion_custom: "",
  outbound_rpid: "none",
  outbound_rpid_custom: "",
  outbound_pai: "none",
  outbound_pai_custom: "",
  outbound_ppi: "none",
  outbound_ppi_custom: "",
  user_agent: "AIDA-PBX",
  realm: "asterisk",
  maxptime: 20
};

const MAXPTIME_OPTIONS = Array.from({ length: 29 }, (_, idx) => (idx + 2) * 10); // 20, 30, 40, ..., 300

function generateSipUsernameStr() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  let res = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
  ];
  for (let i = 3; i < 8; i++) {
    res.push(all[Math.floor(Math.random() * all.length)]);
  }
  return res.sort(() => Math.random() - 0.5).join("");
}

function generateSipPasswordStr() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const specials = "!@#$%^&*_-+=";
  const all = upper + lower + digits + specials;
  let pass = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    specials[Math.floor(Math.random() * specials.length)],
  ];
  for (let i = 4; i < 16; i++) {
    pass.push(all[Math.floor(Math.random() * all.length)]);
  }
  return pass.sort(() => Math.random() - 0.5).join("");
}

function CodecDualListBox({ selectedIds = [], onChange, theme }) {
  const [leftSelected, setLeftSelected] = useState([]);
  const [rightSelected, setRightSelected] = useState([]);

  const availableItems = SYSTEM_CODECS.filter((item) => !selectedIds.includes(item.id));
  const selectedItems = selectedIds
    .map((id) => SYSTEM_CODECS.find((item) => item.id === id) || { id, label: id })
    .filter(Boolean);

  const toggleLeft = (id) => {
    setLeftSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleRight = (id) => {
    setRightSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const moveRight = () => {
    if (!leftSelected.length) return;
    const next = [...selectedIds, ...leftSelected.filter((id) => !selectedIds.includes(id))];
    onChange(next);
    setLeftSelected([]);
  };

  const moveLeft = () => {
    if (!rightSelected.length) return;
    const next = selectedIds.filter((id) => !rightSelected.includes(id));
    onChange(next);
    setRightSelected([]);
  };

  const moveUp = () => {
    if (rightSelected.length !== 1) return;
    const id = rightSelected[0];
    const idx = selectedIds.indexOf(id);
    if (idx <= 0) return;
    const next = [...selectedIds];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  };

  const moveDown = () => {
    if (rightSelected.length !== 1) return;
    const id = rightSelected[0];
    const idx = selectedIds.indexOf(id);
    if (idx === -1 || idx >= selectedIds.length - 1) return;
    const next = [...selectedIds];
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-11 gap-2 items-center">
        {/* Left Box: Available Codecs */}
        <div className="col-span-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/60 dark:bg-slate-950/60 overflow-hidden flex flex-col h-56">
          <div className="px-3 py-2 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-100/70 dark:bg-slate-900/70 flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Müsait Kodekler</span>
            <span>{availableItems.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {availableItems.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[11px] text-slate-400 italic px-2 text-center">
                Tüm kodekler seçildi
              </div>
            ) : (
              availableItems.map((item) => {
                const isSel = leftSelected.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleLeft(item.id)}
                    onDoubleClick={() => {
                      if (!selectedIds.includes(item.id)) onChange([...selectedIds, item.id]);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all flex items-center justify-between select-none ${
                      isSel
                        ? `${theme.lightBg} ${theme.text} font-bold border ${theme.borderLight}`
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center Controls */}
        <div className="col-span-1 flex flex-col items-center justify-center gap-2">
          <button
            type="button"
            onClick={moveRight}
            disabled={!leftSelected.length}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 transition-all"
            title="Seçilenleri Ekle"
          >
            <ChevronRight size={15} />
          </button>
          <button
            type="button"
            onClick={moveLeft}
            disabled={!rightSelected.length}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 transition-all"
            title="Seçilenleri Çıkar"
          >
            <ChevronLeft size={15} />
          </button>
          <div className="h-2" />
          <button
            type="button"
            onClick={moveUp}
            disabled={rightSelected.length !== 1}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 transition-all"
            title="Önceliği Yukarı Taşı"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={moveDown}
            disabled={rightSelected.length !== 1}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 transition-all"
            title="Önceliği Aşağı Taşı"
          >
            <ChevronDown size={14} />
          </button>
        </div>

        {/* Right Box: Selected Codecs */}
        <div className="col-span-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/60 dark:bg-slate-950/60 overflow-hidden flex flex-col h-56">
          <div className="px-3 py-2 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-100/70 dark:bg-slate-900/70 flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Seçili Kodekler (Öncelik Sıralı)</span>
            <span>{selectedItems.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {selectedItems.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[11px] text-slate-400 italic px-2 text-center">
                Seçili kodek yok (Varsayılan alaw, ulaw kullanılır)
              </div>
            ) : (
              selectedItems.map((item, idx) => {
                const isSel = rightSelected.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleRight(item.id)}
                    onDoubleClick={() => {
                      onChange(selectedIds.filter((id) => id !== item.id));
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all flex items-center justify-between select-none ${
                      isSel
                        ? `${theme.lightBg} ${theme.text} font-bold border ${theme.borderLight}`
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <span className="truncate">
                      <span className="text-[10px] font-mono opacity-60 mr-1.5">{idx + 1}.</span>
                      {item.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PBXSettings({ viewMode = "pbx", backendHost = "localhost:8000" }) {
  const theme = useTheme();
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight, colorCode } = theme;
  // PBX & AMI Config States
  const [settings, setSettings] = useState({
    ami_host: "127.0.0.1",
    ami_port: 5038,
    ami_user: "",
    ami_secret: "",
    webrtc_wss_url: "wss://127.0.0.1:8089/ws",
    nas_mount_path: "/mnt/nas/ai-recordings",
    auto_whisper_enabled: true,
    force_tls: false,
    force_srtp: false
  });

  const [trunks, setTrunks] = useState([]);
  const [trunkStatuses, setTrunkStatuses] = useState({});
  const [pbxSuccess, setPbxSuccess] = useState(false);
  const [loading, setLoading] = useState({ pbx: false, trunks: false });
  const [trunkError, setTrunkError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (trunkError) {
      const timer = setTimeout(() => {
        setTrunkError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [trunkError]);


  // Voice Biometric Settings States
  const [bioEnabled, setBioEnabled] = useState(true);
  const [bioThreshold, setBioThreshold] = useState(80);
  const [bioAutoBlacklist, setBioAutoBlacklist] = useState(false);
  const [savingBioSettings, setSavingBioSettings] = useState(false);

  // Popup Modal States
  const [showModal, setShowModal] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState("general"); // general, advanced, sip_headers
  const [showTrunkPassword, setShowTrunkPassword] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const getDefaultNewTrunk = () => ({
    trunk_type: "register", // register, peer, account
    trunk_name: "",
    host: "",
    username: "",
    password: "",
    port: 5060,
    did_number: "",
    protocol: "udp", // udp, tcp, tls
    greeting_prompt: "",
    transfer_target_type: "extension",
    transfer_target: "200",
    codec: "alaw,ulaw,g722,g729",
    codecs: ["alaw", "ulaw", "g722", "g729"],
    call_limit_enabled: false,
    call_limit_direction: "both", // both, outbound, inbound
    max_channels: 30,
    is_active: true,
    sip_headers: { ...DEFAULT_SIP_HEADERS }
  });

  const [newTrunk, setNewTrunk] = useState(getDefaultNewTrunk);

  const [searchQuery, setSearchQuery] = useState("");

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  // Fetch configs on mount
  const fetchPbxSettings = () => {
    fetch(`${API_BASE}/api/settings/pbx`)
      .then((res) => res.json())
      .then((data) => {
        if (data) setSettings(data);
      })
      .catch((err) => console.error("[PBX] Ayarlar yuklenemedi:", err));
  };

  const fetchTrunks = () => {
    const activeTenantId = typeof window !== "undefined" ? (localStorage.getItem("active_tenant_id") || "tenant-default") : "tenant-default";
    fetch(`${API_BASE}/api/settings/trunks`, {
      headers: { "X-Tenant-ID": activeTenantId }
    })
      .then((res) => res.json())
      .then((data) => {
        setTrunks(Array.isArray(data) ? data : (data?.trunks || []));
      })
      .catch((err) => console.error("[Trunks] Listelenemedi:", err));
  };

  const fetchTrunkStatuses = () => {
    fetch(`${API_BASE}/api/settings/trunks/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data) setTrunkStatuses(data);
      })
      .catch((err) => console.error("[Trunks] Durumlar alinamadi:", err));
  };

  useEffect(() => {
    fetchPbxSettings();
    fetchTrunks();
    fetchTrunkStatuses();
    fetchBioSettings();

    const interval = setInterval(fetchTrunkStatuses, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchBioSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/voice-biometrics`);
      if (res.ok) {
        const data = await res.json();
        setBioEnabled(data.enabled);
        setBioThreshold(data.deepfake_threshold);
        setBioAutoBlacklist(data.auto_blacklist);
      }
    } catch (err) {
      console.error("Biyometrik ayarlar yükleme hatası:", err);
    }
  };

  const saveBiometricsSettings = async () => {
    setSavingBioSettings(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/voice-biometrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: bioEnabled,
          deepfake_threshold: bioThreshold,
          auto_blacklist: bioAutoBlacklist
        })
      });
      if (res.ok) {
        setPbxSuccess(true);
        setTimeout(() => setPbxSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Biyometrik ayarlar kaydedilemedi:", err);
    } finally {
      setSavingBioSettings(false);
    }
  };

  const handlePbxChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleNewTrunkChange = (e) => {
    const { name, value } = e.target;
    setNewTrunk((prev) => ({ ...prev, [name]: value }));
  };

  const handleSipHeaderChange = (key, value) => {
    setNewTrunk((prev) => ({
      ...prev,
      sip_headers: {
        ...DEFAULT_SIP_HEADERS,
        ...(prev.sip_headers || {}),
        [key]: value
      }
    }));
  };

  const handleTrunkTypeChange = (typeVal) => {
    setNewTrunk((prev) => {
      const updated = { ...prev, trunk_type: typeVal };
      if (typeVal === "account") {
        if (!updated.username) updated.username = generateSipUsernameStr();
        if (!updated.password) updated.password = generateSipPasswordStr();
      }
      return updated;
    });
  };

  const copyToClipboard = (textVal, fieldKey) => {
    if (!textVal) return;
    navigator.clipboard.writeText(textVal);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const parseCodecsArray = (trunkObj) => {
    if (Array.isArray(trunkObj?.codecs) && trunkObj.codecs.length > 0) {
      return trunkObj.codecs.map((c) => String(c).toLowerCase().trim()).filter(Boolean);
    }
    const rawStr = String(trunkObj?.codec || "alaw,ulaw,g722,g729");
    if (rawStr.toUpperCase() === "G711") return ["alaw", "ulaw"];
    if (rawStr.toUpperCase() === "G729") return ["g729", "alaw", "ulaw"];
    if (rawStr.toUpperCase() === "G722") return ["g722", "alaw", "ulaw"];
    if (rawStr.toUpperCase() === "OPUS") return ["opus", "g722", "alaw", "ulaw"];
    const parts = rawStr
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return parts.length > 0 ? parts : ["alaw", "ulaw", "g722", "g729"];
  };

  const handlePbxSave = async (e) => {
    e.preventDefault();
    setLoading((prev) => ({ ...prev, pbx: true }));
    setPbxSuccess(false);

    try {
      const res = await fetch(`${API_BASE}/api/settings/pbx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setPbxSuccess(true);
        setTimeout(() => setPbxSuccess(false), 3000);
      }
    } catch (err) {
      console.error("[PBX] Kayit hatasi:", err);
    } finally {
      setLoading((prev) => ({ ...prev, pbx: false }));
    }
  };

  // Add / Update Trunk Submit
  const handleAddTrunk = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setTrunkError("");

    if (!newTrunk.trunk_name || !newTrunk.trunk_name.trim()) {
      setTrunkError("Lütfen dış hat ismini giriniz.");
      setActiveModalTab("general");
      return;
    }

    const tName = newTrunk.trunk_name.trim();
    const tType = (newTrunk.trunk_type || "register").toLowerCase();

    if ((tType === "register" || tType === "peer") && (!newTrunk.host || !String(newTrunk.host).trim())) {
      setTrunkError("Lütfen Host IP adresini veya sunucu adresini giriniz.");
      setActiveModalTab("general");
      return;
    }

    if (tType === "register" && (!newTrunk.username || !String(newTrunk.username).trim())) {
      setTrunkError("Register tipi dış hat için Kullanıcı Adı zorunludur.");
      setActiveModalTab("general");
      return;
    }

    if (tType === "account" && (!newTrunk.username || !String(newTrunk.username).trim())) {
      setTrunkError("Account tipi dış hat için Kullanıcı Adı zorunludur.");
      setActiveModalTab("general");
      return;
    }

    // Client-side duplicate check by Trunk Name
    const dupTrunk = (trunks || []).find(
      (t) =>
        String(t.trunk_name || "").trim().toLowerCase() === tName.toLowerCase() &&
        (!newTrunk.id || String(t.id) !== String(newTrunk.id))
    );
    if (dupTrunk) {
      setTrunkError(`'${tName}' isimli Dış Hat (Trunk) zaten mevcut. Lütfen farklı bir isim giriniz.`);
      setActiveModalTab("general");
      return;
    }

    const normalizedCodecs =
      Array.isArray(newTrunk.codecs) && newTrunk.codecs.length > 0
        ? newTrunk.codecs
        : ["alaw", "ulaw", "g722", "g729"];

    const payload = {
      ...newTrunk,
      trunk_name: tName,
      trunk_type: tType,
      host: tType === "account" ? (newTrunk.host || "dynamic") : String(newTrunk.host || "").trim(),
      port: Number(newTrunk.port) || 5060,
      protocol: (newTrunk.protocol || "udp").toLowerCase(),
      codecs: normalizedCodecs,
      codec: normalizedCodecs.join(","),
      call_limit_enabled: Boolean(newTrunk.call_limit_enabled),
      call_limit_direction: newTrunk.call_limit_direction || "both",
      max_channels: Number(newTrunk.max_channels) || 30,
      sip_headers: {
        ...DEFAULT_SIP_HEADERS,
        ...(newTrunk.sip_headers || {}),
        maxptime: Number(newTrunk.sip_headers?.maxptime) || 20
      }
    };

    setLoading((prev) => ({ ...prev, trunks: true }));

    try {
      const url = `${API_BASE}/api/settings/trunks`;
      const activeTenantId =
        typeof window !== "undefined" ? localStorage.getItem("active_tenant_id") || "tenant-default" : "tenant-default";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": localStorage.getItem("current_user_id") || "admin",
          "X-Tenant-ID": activeTenantId
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        closeModal();
        if (data.trunks) {
          setTrunks(data.trunks);
        } else {
          fetchTrunks();
        }
        fetchTrunkStatuses();
      } else {
        setTrunkError(data.detail || "Dış hat kaydedilirken bir hata oluştu.");
      }
    } catch (err) {
      console.error("[Trunks] Ekleme/Guncelleme hatasi:", err);
      setTrunkError("Bağlantı hatası oluştu. Lütfen tekrar deneyiniz.");
    } finally {
      setLoading((prev) => ({ ...prev, trunks: false }));
    }
  };

  const closeModal = () => {
    setTrunkError("");
    setShowModal(false);
    setActiveModalTab("general");
    setShowTrunkPassword(false);
    setNewTrunk(getDefaultNewTrunk());
  };

  const openAddTrunkModal = () => {
    setTrunkError("");
    setActiveModalTab("general");
    setShowTrunkPassword(false);
    setNewTrunk(getDefaultNewTrunk());
    setShowModal(true);
  };

  const handleEditTrunk = (t) => {
    setTrunkError("");
    const parsedCodecs = parseCodecsArray(t);
    let parsedHeaders = { ...DEFAULT_SIP_HEADERS };
    if (t.sip_headers && typeof t.sip_headers === "object") {
      parsedHeaders = { ...DEFAULT_SIP_HEADERS, ...t.sip_headers };
    } else if (typeof t.sip_headers === "string" && t.sip_headers.trim()) {
      try {
        parsedHeaders = { ...DEFAULT_SIP_HEADERS, ...JSON.parse(t.sip_headers) };
      } catch (e) {}
    }

    setNewTrunk({
      ...getDefaultNewTrunk(),
      ...t,
      trunk_type: (t.trunk_type || "register").toLowerCase(),
      protocol: (t.protocol || "udp").toLowerCase(),
      port: t.port || 5060,
      codecs: parsedCodecs,
      codec: parsedCodecs.join(","),
      call_limit_enabled: Boolean(t.call_limit_enabled),
      call_limit_direction: t.call_limit_direction || "both",
      max_channels: t.max_channels || 30,
      is_active: t.is_active !== false,
      sip_headers: parsedHeaders
    });
    setActiveModalTab("general");
    setShowTrunkPassword(false);
    setShowModal(true);
  };


  // Delete Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });

  // Trigger Delete Confirmation Modal
  const handleDeleteTrunk = (id) => {
    setDeleteConfirm({ show: true, id: id });
  };

  // Actual Delete Execution
  const executeDeleteTrunk = async () => {
    const id = deleteConfirm.id;
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/api/settings/trunks/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setDeleteConfirm({ show: false, id: null });
        fetchTrunks();
      }
    } catch (err) {
      console.error("[Trunks] Silme hatasi:", err);
    }
  };

  const fileInputRef = useRef(null);

  const handleExportExcel = () => {
    const data = trunks.map(t => ({
      "Hat Adı": t.trunk_name || "",
      "Tür": t.trunk_type || "register",
      "Protokol": t.protocol || "udp",
      "Sunucu (Host)": t.host || "",
      "Port": t.port || 5060,
      "Kullanıcı Adı": t.username || "",
      "Şifre": t.password || "",
      "Caller ID (DID)": t.did_number || "",
      "Codec": Array.isArray(t.codecs) ? t.codecs.join(",") : (t.codec || "alaw,ulaw,g722,g729"),
      "Aktif": t.is_active !== false ? "Evet" : "Hayır"
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "DisHatlar");
    XLSX.writeFile(workbook, "Dis_Hatlar.xlsx");
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      setLoading(prev => ({ ...prev, trunks: true }));
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        for (const row of data) {
          const trunk_name = String(row["Hat Adı"] || row["Trunk Adı"] || "").trim();
          if (!trunk_name) continue;
          const rawType = String(row["Tür"] || "register").trim().toLowerCase();
          const trunk_type = ["register", "peer", "account"].includes(rawType) ? rawType : "register";
          const rawProto = String(row["Protokol"] || "udp").trim().toLowerCase();
          const protocol = ["udp", "tcp", "tls"].includes(rawProto) ? rawProto : "udp";
          const host = String(row["Sunucu (Host)"] || row["Host"] || "").trim();
          const port = parseInt(row["Port"], 10) || 5060;
          const username = String(row["Kullanıcı Adı"] || "").trim();
          const password = String(row["Şifre"] || "").trim();
          const did_number = String(row["Caller ID (DID)"] || row["DID"] || "").trim();
          const codec = String(row["Codec"] || "alaw,ulaw,g722,g729").trim();
          const is_active = String(row["Aktif"] || "Evet").trim().toLowerCase() !== "hayır";

          const existing = trunks.find(t => t.trunk_name && t.trunk_name.toLowerCase() === trunk_name.toLowerCase());

          await fetch(`${API_BASE}/api/settings/trunks`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-User-ID": localStorage.getItem("current_user_id") || "admin"
            },
            body: JSON.stringify({
              id: existing ? existing.id : undefined,
              trunk_name,
              trunk_type,
              protocol,
              host,
              port,
              username,
              password,
              did_number,
              codec,
              is_active,
              transfer_target_type: existing ? (existing.transfer_target_type || "extension") : "extension",
              transfer_target: existing ? (existing.transfer_target || "200") : "200"
            })
          });
        }

        fetchTrunks();
      } catch (err) {
        console.error("[Trunks] Excel import error:", err);
      } finally {
        setLoading(prev => ({ ...prev, trunks: false }));
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsBinaryString(file);
  };

  const filteredTrunks = trunks.filter((t) => {
    const query = searchQuery.toLowerCase();
    return (
      (t.trunk_name && t.trunk_name.toLowerCase().includes(query)) ||
      (t.did_number && t.did_number.toLowerCase().includes(query)) ||
      (t.host && t.host.toLowerCase().includes(query)) ||
      (t.username && t.username.toLowerCase().includes(query))
    );
  });

  const OUTBOUND_FROM_USER_OPTIONS = [
    { value: "default", label: "Varsayılan" },
    { value: "ext_number", label: "İç Hat Arayan No" },
    { value: "trunk_username", label: "Dış Hat Kullanıcı Adı" },
    { value: "trunk_did", label: "Hat Görünen Numara" },
    { value: "ext_callerid", label: "İç Hattaki Görünen Numarası" },
    { value: "outbound_rule_cid", label: "Giden Arama Kuralı Numarası" },
    { value: "orig_caller", label: "İlk Arayan No" },
    { value: "custom", label: "Özel" }
  ];

  const OUTBOUND_FROM_NAME_OPTIONS = [
    { value: "ext_name", label: "İç Hat Arayan No Adı" },
    { value: "trunk_name", label: "Hat Görünen No Adı" },
    { value: "orig_caller_name", label: "İlk Arayan Adı" },
    { value: "custom", label: "Özel" }
  ];

  const OUTBOUND_IDENTITY_HEADER_OPTIONS = [
    { value: "none", label: "Yok" },
    { value: "ext_number", label: "İç Hat Arayan No" },
    { value: "trunk_username", label: "Dış Hat Kullanıcı Adı" },
    { value: "trunk_did", label: "Hat Görünen Numara" },
    { value: "outbound_route_cid", label: "Giden Rota Görünen Numara" },
    { value: "orig_caller", label: "İlk Arayan No" },
    { value: "custom", label: "Özel" }
  ];

  return (
    <div className="flex flex-col gap-8 text-slate-800 dark:text-slate-100 w-full">
      {/* Title */}
      {viewMode === "trunks" ? (
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-955/20 text-primary rounded-xl">
              <Cable size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">DIŞ HAT ENTEGRASYONU (SIP TRUNKS)</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Operatör dış hat (SIP Trunk) tanımlarını, PJSIP parametrelerini, kodek ve SIP başlıklarını yapılandırın.
              </p>
            </div>
          </div>

          {/* Search Bar + "+" Icon Wrapper */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <input
                type="text"
                placeholder="Hat ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-48 text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} dark:focus:ring-rose-400/25 transition-all`}
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
              onClick={openAddTrunkModal}
              className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 transition-all shadow-sm"
              title="Yeni Dış Hat Ekle"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className={`p-3 ${lightBg} ${text} border ${borderLight} rounded-2xl`}>
            <PhoneCall size={24} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Asterisk Santral Entegrasyonu
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Yapay zekanın çağrı alması için sunucu ve Asterisk Manager Interface (AMI) bağlantı yollarını yönetin.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Side: PBX & AMI Configuration */}
        {viewMode === "pbx" && (
          <div className="lg:col-span-5 flex flex-col gap-6">
            <form onSubmit={handlePbxSave} className="flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl gap-4 shadow-sm transition-colors duration-300">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3">
                <Server size={16} className="text-primary dark:text-rose-455" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350">Sunucu & AMI Ayarları</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider">AMI Host</label>
                  <input
                    type="text"
                    name="ami_host"
                    value={settings.ami_host}
                    onChange={handlePbxChange}
                    required
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider">AMI Port</label>
                  <input
                    type="number"
                    name="ami_port"
                    value={settings.ami_port}
                    onChange={handlePbxChange}
                    required
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider">AMI Kullanıcı</label>
                  <input
                    type="text"
                    name="ami_user"
                    value={settings.ami_user}
                    onChange={handlePbxChange}
                    required
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider">AMI Şifre</label>
                  <input
                    type="password"
                    name="ami_secret"
                    value={settings.ami_secret}
                    onChange={handlePbxChange}
                    required
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider">WebRTC (WSS) URL</label>
                <input
                  type="text"
                  name="webrtc_wss_url"
                  value={settings.webrtc_wss_url}
                  onChange={handlePbxChange}
                  required
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider">NAS Kayıt Dizin Yolu</label>
                <input
                  type="text"
                  name="nas_mount_path"
                  value={settings.nas_mount_path}
                  onChange={handlePbxChange}
                  required
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>
              <div className="mt-4 border-t border-slate-100 dark:border-slate-800/60 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={16} className="text-primary dark:text-rose-455" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350">SIP Güvenliği</h3>
                </div>
                
                <div className="flex flex-col gap-3">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Sadece TLS Bağlantılarına İzin Ver</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">SIP sinyalleşmesini şifreler. Tüm cihazların TLS desteklemesi gerekir.</p>
                    </div>
                    <div className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${settings.force_tls ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`}>
                      <div className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${settings.force_tls ? "translate-x-4.5" : "translate-x-0"}`}></div>
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={settings.force_tls}
                      onChange={(e) => setSettings({...settings, force_tls: e.target.checked})}
                    />
                  </label>
                  
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">SRTP Ses Şifrelemeyi Zorunlu Kıl</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">Ses paketlerini uçtan uca şifreler. Ağ dinlemelerine karşı korur.</p>
                    </div>
                    <div className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${settings.force_srtp ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`}>
                      <div className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${settings.force_srtp ? "translate-x-4.5" : "translate-x-0"}`}></div>
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={settings.force_srtp}
                      onChange={(e) => setSettings({...settings, force_srtp: e.target.checked})}
                    />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading.pbx}
                className={`mt-2 py-2.5 ${bg} ${hover} disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition duration-205`}
              >
                <Save size={14} /> {loading.pbx ? "Kaydediliyor..." : "AMI ve Santral Ayarlarını Kaydet"}
              </button>

              {pbxSuccess && (
                <div className="mt-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-350 text-[10px] flex items-center gap-1.5 font-semibold">
                  <CheckCircle size={12} />
                  <span>Santral bağlantı ayarları güncellendi.</span>
                </div>
              )}
            </form>
          </div>
        )}

        {/* Right Side: SIP Trunks List & Add Action */}
        {viewMode === "trunks" && (
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm transition-colors duration-300">
              
              {/* List Table */}
              {trunks.length === 0 ? (
                <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-xs font-semibold">
                  Kayıtlı dış hat bağlantısı bulunmuyor. Sağ üstteki "+" butonuna basarak yeni bir SIP hattı bağlayabilirsiniz.
                </div>
              ) : filteredTrunks.length === 0 ? (
                <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-xs font-semibold">
                  Arama kriterine uygun kayıtlı dış hat bulunamadı.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                        <th className="py-2.5 w-16 text-center">Durum</th>
                        <th className="py-2.5">Hat Adı</th>
                        <th className="py-2.5">Dış Hat Tipi</th>
                        <th className="py-2.5">Taşıma</th>
                        <th className="py-2.5">Host / Kullanıcı</th>
                        <th className="py-2.5">Görünür Numara</th>
                        <th className="py-2.5 text-center">Çağrı Kısıtlama</th>
                        <th className="py-2.5">Kodekler</th>
                        <th className="py-2.5 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTrunks.map((t) => {
                        const isActive = t.is_active !== false;
                        const status = isActive ? (trunkStatuses[t.id] || "inactive") : "passive";
                        const tType = (t.trunk_type || "register").toLowerCase();
                        const codecList = parseCodecsArray(t);
                        return (
                          <tr key={t.id} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/40 dark:hover:bg-slate-950/20 transition-colors">
                            <td className="py-3 text-center">
                              <div className="flex items-center justify-center">
                                <span className="relative flex h-2 w-2">
                                  {(status === "registered" || status === "active") && (
                                    <>
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-lg shadow-emerald-500/50" title="Kayıtlı (Aktif)"></span>
                                    </>
                                  )}
                                  {status === "trying" && (
                                    <>
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 shadow-lg shadow-amber-500/50" title="Deneniyor"></span>
                                    </>
                                  )}
                                  {status === "inactive" && (
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-lg shadow-rose-500/50" title="Bağlantı Yok"></span>
                                  )}
                                  {status === "passive" && (
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400 dark:bg-slate-600 shadow-lg shadow-slate-500/50" title="Pasif (Devre Dışı)"></span>
                                  )}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 font-bold text-slate-800 dark:text-white">{t.trunk_name}</td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                tType === "register"
                                  ? "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800/30"
                                  : tType === "account"
                                  ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30"
                                  : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/30"
                              }`}>
                                {tType === "register" ? "REGISTER" : tType === "account" ? "ACCOUNT" : "PEER"}
                              </span>
                            </td>
                            <td className="py-3 uppercase font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              {(t.protocol || "udp").toUpperCase()}
                            </td>
                            <td className="py-3 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                              {tType === "account" ? (
                                <span title="Account Kullanıcı Adı">{t.username || "-"}</span>
                              ) : (
                                <span>{t.host}:{t.port || 5060}</span>
                              )}
                            </td>
                            <td className="py-3 font-mono text-slate-800 dark:text-slate-200">{t.did_number || "-"}</td>
                            <td className="py-3 text-center">
                              {t.call_limit_enabled ? (
                                <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/50 text-[10px] font-bold">
                                  {t.max_channels || 30} Kanal ({t.call_limit_direction === "outbound" ? "Giden" : t.call_limit_direction === "inbound" ? "Gelen" : "Giden/Gelen"})
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Limitsiz ({t.max_channels || 30})</span>
                              )}
                            </td>
                            <td className="py-3 font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300">
                              {codecList.slice(0, 4).join(", ")}
                              {codecList.length > 4 ? ` +${codecList.length - 4}` : ""}
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleEditTrunk(t)}
                                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-blue-450 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                  title="Düzenle"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteTrunk(t.id)}
                                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition"
                                  title="Sil"
                                >
                                  <Trash2 size={13} />
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
          </div>
        )}
      </div>

      {/* POPUP MODAL: Left-Tabbed SIP Trunk Configuration Modal */}
      {mounted && showModal && createPortal(
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`p-2 ${lightBg} ${text} rounded-xl`}>
                  <Cable size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                    {newTrunk.id ? `Dış Hat Düzenle: ${newTrunk.trunk_name}` : "Yeni Dış Hat (SIP Trunk) Tanımla"}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Tüm teknik parametreler kaydedildiği anda Asterisk PJSIP ve Dialplan motoruna birebir işlenir
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error Banner */}
            {trunkError && (
              <div className="mx-6 mt-4 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{trunkError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTrunkError("")}
                  className="p-1 text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 rounded-lg"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Modal Body with Left Vertical Tabs */}
            <form onSubmit={handleAddTrunk} className="flex flex-1 overflow-hidden">
              {/* Left Sidebar Navigation */}
              <div className="w-56 border-r border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-3 flex flex-col gap-1.5 shrink-0 overflow-y-auto">
                {[
                  { id: "general", label: "Genel", desc: "Tip, Host, Kimlik & Taşıma", icon: Settings },
                  { id: "advanced", label: "Gelişmiş", desc: "Kodek & Çağrı Kısıtlama", icon: Sliders },
                  { id: "sip_headers", label: "SIP Başlıkları", desc: "Gelen/Giden PJSIP Başlıkları", icon: FileCode2 }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = activeModalTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveModalTab(tab.id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                        active
                          ? `${bg} text-white font-bold shadow-sm`
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <Icon size={15} className="shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs leading-tight truncate">{tab.label}</div>
                        <div className={`text-[9px] truncate mt-0.5 ${active ? "text-white/80" : "text-slate-400 dark:text-slate-500"}`}>
                          {tab.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Content Area */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                
                {/* TAB 1: GENEL */}
                {activeModalTab === "general" && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">
                          Genel Dış Hat Bilgileri
                        </h5>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Dış hat bağlantı tipini (Register, Peer veya Account) ve temel iletişim parametrelerini belirleyin.
                        </p>
                      </div>

                      {/* Aktif / Pasif Switch */}
                      <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Durum: {newTrunk.is_active !== false ? "Aktif" : "Pasif"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setNewTrunk((prev) => ({ ...prev, is_active: prev.is_active === false ? true : false }))}
                          className={`transition-colors ${newTrunk.is_active !== false ? "text-emerald-500" : "text-slate-400"}`}
                          title="Aktif / Pasif Değiştir"
                        >
                          {newTrunk.is_active !== false ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                        </button>
                      </div>
                    </div>

                    {/* İsim & Dış Hat Tipi */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">
                          İsim *
                        </label>
                        <input
                          type="text"
                          name="trunk_name"
                          value={newTrunk.trunk_name}
                          onChange={handleNewTrunkChange}
                          placeholder="Örn: Operator_Trunk"
                          className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">
                          Dış Hat Tipi *
                        </label>
                        <select
                          name="trunk_type"
                          value={newTrunk.trunk_type || "register"}
                          onChange={(e) => handleTrunkTypeChange(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white font-semibold focus:outline-none focus:border-primary"
                        >
                          <option value="register">Register (Operatöre Kayıt Olan Hat)</option>
                          <option value="peer">Peer (IP Tabanlı Doğrudan Bağlantı)</option>
                          <option value="account">Account (Santrala Kayıt Olan Dış Cihaz/Hat)</option>
                        </select>
                      </div>
                    </div>

                    {/* CONDITIONAL FIELDS BY TRUNK TYPE */}
                    {newTrunk.trunk_type === "register" && (
                      <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-4">
                        <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                          Register Bağlantı Parametreleri
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                              Host IP *
                            </label>
                            <input
                              type="text"
                              name="host"
                              value={newTrunk.host || ""}
                              onChange={handleNewTrunkChange}
                              placeholder="Örn: sip.operator.com veya 185.x.x.x"
                              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                              Port *
                            </label>
                            <input
                              type="number"
                              name="port"
                              value={newTrunk.port ?? 5060}
                              onChange={handleNewTrunkChange}
                              placeholder="5060"
                              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                              Kullanıcı Adı *
                            </label>
                            <input
                              type="text"
                              name="username"
                              value={newTrunk.username || ""}
                              onChange={handleNewTrunkChange}
                              placeholder="Operatör SIP Kullanıcı Adı"
                              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                              Parola (SIP Şifresi)
                            </label>
                            <div className="relative flex items-center">
                              <input
                                type={showTrunkPassword ? "text" : "password"}
                                name="password"
                                value={newTrunk.password || ""}
                                onChange={handleNewTrunkChange}
                                placeholder="Operatör SIP Şifresi"
                                className="w-full pl-3 pr-10 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                              />
                              <button
                                type="button"
                                onClick={() => setShowTrunkPassword((v) => !v)}
                                className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                title={showTrunkPassword ? "Gizle" : "Göster"}
                              >
                                {showTrunkPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                              Taşıma (Transport) *
                            </label>
                            <select
                              name="protocol"
                              value={(newTrunk.protocol || "udp").toLowerCase()}
                              onChange={handleNewTrunkChange}
                              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                            >
                              <option value="udp">UDP</option>
                              <option value="tcp">TCP</option>
                              <option value="tls">TLS</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                              Görünür Numara (DID / Caller ID)
                            </label>
                            <input
                              type="text"
                              name="did_number"
                              value={newTrunk.did_number || ""}
                              onChange={handleNewTrunkChange}
                              placeholder="Örn: 908503607390"
                              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {newTrunk.trunk_type === "peer" && (
                      <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-4">
                        <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                          Peer Bağlantı Parametreleri
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                              Host IP *
                            </label>
                            <input
                              type="text"
                              name="host"
                              value={newTrunk.host || ""}
                              onChange={handleNewTrunkChange}
                              placeholder="Örn: 195.x.x.x veya sip.peer.com"
                              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                              Port *
                            </label>
                            <input
                              type="number"
                              name="port"
                              value={newTrunk.port ?? 5060}
                              onChange={handleNewTrunkChange}
                              placeholder="5060"
                              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                              Taşıma (Transport) *
                            </label>
                            <select
                              name="protocol"
                              value={(newTrunk.protocol || "udp").toLowerCase()}
                              onChange={handleNewTrunkChange}
                              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                            >
                              <option value="udp">UDP</option>
                              <option value="tcp">TCP</option>
                              <option value="tls">TLS</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                              Görünür Numara (Opsiyonel DID / Caller ID)
                            </label>
                            <input
                              type="text"
                              name="did_number"
                              value={newTrunk.did_number || ""}
                              onChange={handleNewTrunkChange}
                              placeholder="Örn: 908503607390"
                              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {newTrunk.trunk_type === "account" && (
                      <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-4">
                        <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                          Account Bağlantı Parametreleri (Santrala Kayıt Olacak Dış Hat / Gateway)
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Auto-generated SIP Username with Refresh + Copy */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                              Kullanıcı Adı *
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                name="username"
                                value={newTrunk.username || ""}
                                onChange={handleNewTrunkChange}
                                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                              />
                              <button
                                type="button"
                                onClick={() => copyToClipboard(newTrunk.username, "account_user")}
                                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition shrink-0"
                                title="Kullanıcı Adını Kopyala"
                              >
                                {copiedField === "account_user" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewTrunk((prev) => ({ ...prev, username: generateSipUsernameStr() }))}
                                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition shrink-0"
                                title="Yeni Kullanıcı Adı Oluştur"
                              >
                                <RefreshCw size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Transport */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                              Taşıma (Transport) *
                            </label>
                            <select
                              name="protocol"
                              value={(newTrunk.protocol || "udp").toLowerCase()}
                              onChange={handleNewTrunkChange}
                              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                            >
                              <option value="udp">UDP</option>
                              <option value="tcp">TCP</option>
                              <option value="tls">TLS</option>
                            </select>
                          </div>

                          {/* Auto-generated SIP Password with Show/Hide + Refresh + Copy */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                              Parola *
                            </label>
                            <div className="flex items-center gap-1.5">
                              <div className="relative flex-1">
                                <input
                                  type={showTrunkPassword ? "text" : "password"}
                                  name="password"
                                  value={newTrunk.password || ""}
                                  onChange={handleNewTrunkChange}
                                  className="w-full pl-3 pr-8 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowTrunkPassword((v) => !v)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                  title={showTrunkPassword ? "Gizle" : "Göster"}
                                >
                                  {showTrunkPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(newTrunk.password, "account_pass")}
                                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition shrink-0"
                                title="Parolayı Kopyala"
                              >
                                {copiedField === "account_pass" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewTrunk((prev) => ({ ...prev, password: generateSipPasswordStr() }))}
                                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition shrink-0"
                                title="Yeni Parola Oluştur"
                              >
                                <RefreshCw size={14} />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                              Görünür Numara (Opsiyonel DID / Caller ID)
                            </label>
                            <input
                              type="text"
                              name="did_number"
                              value={newTrunk.did_number || ""}
                              onChange={handleNewTrunkChange}
                              placeholder="Örn: 908503607390"
                              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: GELİŞMİŞ */}
                {activeModalTab === "advanced" && (
                  <div className="space-y-6">
                    {/* Kodek Ayarları */}
                    <div className="space-y-3">
                      <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
                        <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">
                          Kodek Ayarları
                        </h5>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Sol listedeki sistem kodeklerinden kullanmak istediklerinizi sağ tarafa aktarın ve öncelik sırasını belirleyin.
                        </p>
                      </div>

                      <CodecDualListBox
                        selectedIds={Array.isArray(newTrunk.codecs) ? newTrunk.codecs : parseCodecsArray(newTrunk)}
                        onChange={(nextCodecs) =>
                          setNewTrunk((prev) => ({
                            ...prev,
                            codecs: nextCodecs,
                            codec: nextCodecs.join(",")
                          }))
                        }
                        theme={theme}
                      />
                    </div>

                    {/* Çağrı Kısıtlama */}
                    <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">
                            Çağrı Kısıtlama
                          </h5>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Bu dış hat üzerinden geçebilecek maksimum eş zamanlı çağrı kapasitesini sınırlandırın (Asterisk GROUP_COUNT).
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {newTrunk.call_limit_enabled ? "Aktif" : "Pasif"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setNewTrunk((prev) => ({ ...prev, call_limit_enabled: !prev.call_limit_enabled }))
                            }
                            className={`transition-colors ${newTrunk.call_limit_enabled ? "text-emerald-500" : "text-slate-400"}`}
                          >
                            {newTrunk.call_limit_enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                        <div>
                          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                            Giden / Gelen Arama Yönü
                          </label>
                          <select
                            value={newTrunk.call_limit_direction || "both"}
                            onChange={(e) =>
                              setNewTrunk((prev) => ({ ...prev, call_limit_direction: e.target.value }))
                            }
                            disabled={!newTrunk.call_limit_enabled}
                            className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white disabled:opacity-50"
                          >
                            <option value="both">Giden ve Gelen Arama</option>
                            <option value="outbound">Sadece Giden Arama</option>
                            <option value="inbound">Sadece Gelen Arama</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                            Maksimum Eş Zamanlı Çağrı
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="1000"
                            name="max_channels"
                            value={newTrunk.max_channels ?? 30}
                            onChange={handleNewTrunkChange}
                            disabled={!newTrunk.call_limit_enabled}
                            className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: SIP BAŞLIKLARI */}
                {activeModalTab === "sip_headers" && (
                  <div className="space-y-6">
                    {/* Alt Başlık 1: Gelen Parametreler */}
                    <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-4">
                      <div className="border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
                        <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">
                          Gelen Parametreler
                        </h5>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Operatörden gelen çağrılarda Arayan (Caller) ve Aranan (Callee/DID) numaranın hangi SIP başlığından okunacağını seçin.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                            Arayan Numara
                          </label>
                          <select
                            value={newTrunk.sip_headers?.inbound_caller_header || "default"}
                            onChange={(e) => handleSipHeaderChange("inbound_caller_header", e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                          >
                            <option value="default">Sistem Ayarı (Varsayılan)</option>
                            <option value="from">From</option>
                            <option value="contact">Contact</option>
                            <option value="rpid">Remote-Party-ID</option>
                            <option value="pai">P-Asserted-Identity</option>
                            <option value="ppi">P-Preferred-Identity</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                            Aranan Numara
                          </label>
                          <select
                            value={newTrunk.sip_headers?.inbound_callee_header || "default"}
                            onChange={(e) => handleSipHeaderChange("inbound_callee_header", e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                          >
                            <option value="default">Sistem Ayarı (Varsayılan)</option>
                            <option value="to">To</option>
                            <option value="invite">INVITE</option>
                            <option value="diversion">Diversion</option>
                            <option value="p_called_party_id">P-Called-Party-ID</option>
                            <option value="rpid">Remote-Party-ID</option>
                            <option value="pai">P-Asserted-Identity</option>
                            <option value="ppi">P-Preferred-Identity</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Alt Başlık 2: Giden Parametreler */}
                    <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-4">
                      <div className="border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
                        <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">
                          Giden Parametreler
                        </h5>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Dış hata gönderilen INVITE paketlerindeki From, Diversion, RPID, PAI ve PPI başlık değerlerini yapılandırın.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 1. Kullanıcı Bölümünden */}
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-slate-500 uppercase block">
                            Kullanıcı Bölümünden
                          </label>
                          <select
                            value={newTrunk.sip_headers?.outbound_from_user || "default"}
                            onChange={(e) => handleSipHeaderChange("outbound_from_user", e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                          >
                            {OUTBOUND_FROM_USER_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {newTrunk.sip_headers?.outbound_from_user === "custom" && (
                            <input
                              type="text"
                              value={newTrunk.sip_headers?.outbound_from_user_custom || ""}
                              onChange={(e) => handleSipHeaderChange("outbound_from_user_custom", e.target.value)}
                              placeholder="Özel kullanıcı değeri giriniz..."
                              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                            />
                          )}
                        </div>

                        {/* 2. Görünen Ad Bölümünden */}
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-slate-500 uppercase block">
                            Görünen Ad Bölümünden
                          </label>
                          <select
                            value={newTrunk.sip_headers?.outbound_from_name || "ext_name"}
                            onChange={(e) => handleSipHeaderChange("outbound_from_name", e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                          >
                            {OUTBOUND_FROM_NAME_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {newTrunk.sip_headers?.outbound_from_name === "custom" && (
                            <input
                              type="text"
                              value={newTrunk.sip_headers?.outbound_from_name_custom || ""}
                              onChange={(e) => handleSipHeaderChange("outbound_from_name_custom", e.target.value)}
                              placeholder="Özel görünen ad giriniz..."
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                            />
                          )}
                        </div>

                        {/* 3. Diversion */}
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-slate-500 uppercase block">
                            Diversion
                          </label>
                          <select
                            value={newTrunk.sip_headers?.outbound_diversion || "none"}
                            onChange={(e) => handleSipHeaderChange("outbound_diversion", e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                          >
                            {OUTBOUND_IDENTITY_HEADER_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {newTrunk.sip_headers?.outbound_diversion === "custom" && (
                            <input
                              type="text"
                              value={newTrunk.sip_headers?.outbound_diversion_custom || ""}
                              onChange={(e) => handleSipHeaderChange("outbound_diversion_custom", e.target.value)}
                              placeholder="Özel Diversion değeri giriniz..."
                              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                            />
                          )}
                        </div>

                        {/* 4. Remote-Party-ID */}
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-slate-500 uppercase block">
                            Remote-Party-ID
                          </label>
                          <select
                            value={newTrunk.sip_headers?.outbound_rpid || "none"}
                            onChange={(e) => handleSipHeaderChange("outbound_rpid", e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                          >
                            {OUTBOUND_IDENTITY_HEADER_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {newTrunk.sip_headers?.outbound_rpid === "custom" && (
                            <input
                              type="text"
                              value={newTrunk.sip_headers?.outbound_rpid_custom || ""}
                              onChange={(e) => handleSipHeaderChange("outbound_rpid_custom", e.target.value)}
                              placeholder="Özel Remote-Party-ID değeri giriniz..."
                              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                            />
                          )}
                        </div>

                        {/* 5. P-Asserted-Identity */}
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-slate-500 uppercase block">
                            P-Asserted-Identity
                          </label>
                          <select
                            value={newTrunk.sip_headers?.outbound_pai || "none"}
                            onChange={(e) => handleSipHeaderChange("outbound_pai", e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                          >
                            {OUTBOUND_IDENTITY_HEADER_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {newTrunk.sip_headers?.outbound_pai === "custom" && (
                            <input
                              type="text"
                              value={newTrunk.sip_headers?.outbound_pai_custom || ""}
                              onChange={(e) => handleSipHeaderChange("outbound_pai_custom", e.target.value)}
                              placeholder="Özel P-Asserted-Identity değeri giriniz..."
                              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                            />
                          )}
                        </div>

                        {/* 6. P-Preferred-Identity */}
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-slate-500 uppercase block">
                            P-Preferred-Identity
                          </label>
                          <select
                            value={newTrunk.sip_headers?.outbound_ppi || "none"}
                            onChange={(e) => handleSipHeaderChange("outbound_ppi", e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                          >
                            {OUTBOUND_IDENTITY_HEADER_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {newTrunk.sip_headers?.outbound_ppi === "custom" && (
                            <input
                              type="text"
                              value={newTrunk.sip_headers?.outbound_ppi_custom || ""}
                              onChange={(e) => handleSipHeaderChange("outbound_ppi_custom", e.target.value)}
                              placeholder="Özel P-Preferred-Identity değeri giriniz..."
                              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Alt Başlık 3: Diğer Ayarlar */}
                    <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-4">
                      <div className="border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
                        <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">
                          Diğer Ayarlar
                        </h5>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          SIP User-Agent, kimlik doğrulama Realm alanı ve RTP paketleme süresi (Maxptime) parametreleri.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                            User-Agent
                          </label>
                          <input
                            type="text"
                            value={newTrunk.sip_headers?.user_agent ?? "AIDA-PBX"}
                            onChange={(e) => handleSipHeaderChange("user_agent", e.target.value)}
                            placeholder="Örn: AIDA-PBX"
                            className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                            Realm
                          </label>
                          <input
                            type="text"
                            value={newTrunk.sip_headers?.realm ?? "asterisk"}
                            onChange={(e) => handleSipHeaderChange("realm", e.target.value)}
                            placeholder="Örn: asterisk"
                            className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                            Maxptime
                          </label>
                          <select
                            value={Number(newTrunk.sip_headers?.maxptime) || 20}
                            onChange={(e) => handleSipHeaderChange("maxptime", Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                          >
                            {MAXPTIME_OPTIONS.map((val) => (
                              <option key={val} value={val}>
                                {val}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={loading.trunks}
                    className={`flex items-center gap-1.5 px-5 py-2 ${bg} ${hover} text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50`}
                  >
                    <Save size={14} />
                    {loading.trunks ? "Kaydediliyor..." : newTrunk.id ? "Değişiklikleri Kaydet" : "Dış Hattı Oluştur"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: null })}
        onConfirm={executeDeleteTrunk}
        title="Bağlantıyı Sil"
        message="Bu dış hat bağlantısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
      />
    </div>
  );
}
