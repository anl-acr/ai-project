import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Phone,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Users,
  Sliders,
  Download,
  RotateCcw,
  Sparkles,
  Check,
  X,
  Volume2,
  Monitor,
  Power,
  Zap,
  Copy,
  FileCode2,
  Layers,
  Search,
  Wand2,
  Headphones,
  Wifi,
  WifiOff,
  Play,
  Lock,
} from "lucide-react";
import { useTheme } from "../../../utils/theme";
import ConfirmDeleteModal from "../../dashboard/ConfirmDeleteModal";
import DeskphoneVisualSimulator, {
  DSS_KEY_TYPES,
  SOFTKEY_TYPES,
} from "./DeskphoneVisualSimulator";

const DEFAULT_PHONE_PREFS = {
  ringtone: "Ring1.wav",
  ring_volume: 6,
  handset_volume: 7,
  speaker_volume: 6,
  headset_volume: 7,
  call_waiting: true,
  call_waiting_tone: true,
  auto_answer: false,
  intercom_mute: false,
  headset_mode: "rj9",
  language: "Turkish",
  time_format: "24",
  date_format: "DD.MM.YYYY",
  backlight_active: 8,
  backlight_inactive: 2,
  backlight_timeout: 60,
  screensaver_wait: 300,
  screen_label: "",
  missed_call_led: true,
  mwi_led: true,
  dnd_default: false,
};

const RINGTONE_OPTIONS = [
  { id: "Ring1.wav", label: "Zil 1 — Klasik Kurumsal", freqs: [523, 659] },
  { id: "Ring2.wav", label: "Zil 2 — Yumuşak Çift Ton", freqs: [440, 554] },
  { id: "Ring3.wav", label: "Zil 3 — Modern Ofis", freqs: [587, 784] },
  { id: "Ring4.wav", label: "Zil 4 — Hızlı Çınlama", freqs: [659, 880] },
  { id: "Ring5.wav", label: "Zil 5 — Melodik Arpej", freqs: [523, 659, 784] },
  { id: "Ring6.wav", label: "Zil 6 — Minimal Dijital", freqs: [740, 587] },
  { id: "Ring7.wav", label: "Zil 7 — Klasik Ahize", freqs: [480, 620] },
  { id: "Ring8.wav", label: "Zil 8 — Yüksek Öncelik", freqs: [880, 988] },
];

function playRingtonePreview(freqs = [523, 659]) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now + i * 0.16);
      gain.gain.setValueAtTime(0.08, now + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.16 + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + 0.16);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch (e) {}
}

function buildDssArray(ext, maxKeys, existing = []) {
  const count = Math.max(2, Math.min(96, Number(maxKeys || 12)));
  const byIdx = new Map();
  (existing || []).forEach((k) => {
    if (k && k.key_index) byIdx.set(Number(k.key_index), k);
  });
  return Array.from({ length: count }, (_, i) => {
    const keyIndex = i + 1;
    const found = byIdx.get(keyIndex);
    if (keyIndex === 1) {
      const customLbl = found && found.type === "line" && found.label ? found.label : `Hat ${ext}`;
      return { key_index: 1, type: "line", label: customLbl, label_mode: "custom", value: String(ext), pickup_code: "*8", locked: true };
    }
    if (found) {
      return {
        key_index: keyIndex,
        type: found.type || "none",
        label: found.label || "",
        label_mode: found.label_mode || (found.label ? "custom" : "auto"),
        value: found.value || "",
        pickup_code: found.pickup_code || "*8",
      };
    }
    if (keyIndex === 2 && count >= 4) {
      return { key_index: 2, type: "line", label: `Hat ${ext} (2)`, label_mode: "custom", value: String(ext), pickup_code: "*8" };
    }
    if (keyIndex === 3 && count >= 4) {
      return { key_index: 3, type: "dnd", label: "Rahatsız Etme", label_mode: "custom", value: "", pickup_code: "*8" };
    }
    if (keyIndex === 4 && count >= 4) {
      return { key_index: 4, type: "voicemail", label: "Sesli Posta", label_mode: "custom", value: "*97", pickup_code: "*8" };
    }
    return { key_index: keyIndex, type: "none", label: "", label_mode: "auto", value: "", pickup_code: "*8" };
  });
}

function buildSoftKeys(existing = []) {
  const defaults = [
    { key_index: 1, type: "history", label: "Geçmiş", value: "" },
    { key_index: 2, type: "directory", label: "Rehber", value: "" },
    { key_index: 3, type: "dnd", label: "DND", value: "" },
    { key_index: 4, type: "transfer", label: "Aktar", value: "" },
  ];
  return defaults.map((def) => {
    const found = (existing || []).find((s) => Number(s.key_index) === def.key_index);
    return found ? { ...def, ...found } : def;
  });
}

function buildExpansionKeys(totalKeys = 60, existing = []) {
  const byIdx = new Map();
  (existing || []).forEach((k) => {
    if (k && k.key_index) byIdx.set(Number(k.key_index), k);
  });
  return Array.from({ length: totalKeys }, (_, i) => {
    const idx = i + 1;
    const found = byIdx.get(idx);
    if (found) {
      return {
        key_index: idx,
        type: found.type || "none",
        label: found.label || "",
        label_mode: found.label_mode || "auto",
        value: found.value || "",
        pickup_code: found.pickup_code || "*8",
      };
    }
    return { key_index: idx, type: "none", label: "", label_mode: "auto", value: "", pickup_code: "*8" };
  });
}

export default function AgentDeskphoneTab({ backendHost, currentUser }) {
  const { bg, hover, text, border, lightBg, borderLight } = useTheme();
  const ext = String(currentUser?.extension || "1000").trim();
  const fullName = currentUser?.full_name || currentUser?.username || `Dahili ${ext}`;

  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState(""); // "" | "reboot" | "check_sync" | "save_only"
  const [banner, setBanner] = useState(null);
  const [hasProvisionedDevice, setHasProvisionedDevice] = useState(false);

  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [modelCatalog, setModelCatalog] = useState([]);
  const [expansionCatalog, setExpansionCatalog] = useState({});
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [extNameMap, setExtNameMap] = useState({});
  const [speedDials, setSpeedDials] = useState([]);

  // Active device editable state
  const [brand, setBrand] = useState("Yealink");
  const [model, setModel] = useState("T46U");
  const [sipUsername, setSipUsername] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [configVersion, setConfigVersion] = useState(1);
  const [liveStatus, setLiveStatus] = useState({ online: false, ip: "", rtt_ms: "", user_agent: "", on_active_call: false });
  const [provUrls, setProvUrls] = useState({ active: "", lan: "", wan: "", effective_mode: "lan", pbx_host: "" });
  const [lastProvisionedAt, setLastProvisionedAt] = useState("");
  const [lastProvisionedIp, setLastProvisionedIp] = useState("");

  const [dssKeys, setDssKeys] = useState(() => buildDssArray(ext, 27));
  const [softKeys, setSoftKeys] = useState(() => buildSoftKeys());
  const [expansionModules, setExpansionModules] = useState([]);
  const [phonePrefs, setPhonePrefs] = useState(() => ({ ...DEFAULT_PHONE_PREFS }));

  // Navigation & selection
  const [inspectorTab, setInspectorTab] = useState("keys"); // keys | audio | display | info
  const [selectedKey, setSelectedKey] = useState({ category: "dss", index: 2 }); // category: dss | soft | exp
  const [activeDssPage, setActiveDssPage] = useState(1);
  const [activeExpModuleIndex, setActiveExpModuleIndex] = useState(1);
  const [activeExpPage, setActiveExpPage] = useState(1);
  const [dirSearch, setDirSearch] = useState("");
  const [copiedUrlKey, setCopiedUrlKey] = useState("");

  // Modals & Live Reboot Progress Tracker
  const [activeCallWarning, setActiveCallWarning] = useState(null); // { applyMode, message }
  const [deleteModConfirmIdx, setDeleteModConfirmIdx] = useState(null);
  const [autoFillModalModIdx, setAutoFillModalModIdx] = useState(null);
  const [autoFillDept, setAutoFillDept] = useState("__ALL__");
  const [cfgPreviewModal, setCfgPreviewModal] = useState(null); // { filename, content }
  const [rebootTracker, setRebootTracker] = useState(null); // { step: 1..4, mode, baselineProvAt, startedAt, note }
  const pollRef = useRef(null);

  const getApiBase = useCallback(() => {
    const host = backendHost || (typeof window !== "undefined" ? window.location.host : "localhost:8000");
    const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
    return `${protocol}//${host}`;
  }, [backendHost]);

  const activeModelSpec = useMemo(() => {
    const mLow = String(model || "T46U").toLowerCase();
    const bLow = String(brand || "Yealink").toLowerCase();
    return (
      modelCatalog.find((c) => c.brand.toLowerCase() === bLow && c.model.toLowerCase() === mLow) ||
      modelCatalog.find((c) => c.brand.toLowerCase() === bLow) || {
        brand,
        model,
        label: `${brand} ${model}`,
        screen: "color",
        layout: "split",
        dss_per_page: 10,
        dss_pages: 3,
        max_dss: 27,
        soft_keys: 4,
        expansion_model: "EXP43",
        max_expansions: 3,
      }
    );
  }, [modelCatalog, brand, model]);

  const brandsGrouped = useMemo(() => {
    const groups = { Yealink: [], Grandstream: [], Fanvil: [], Cisco: [] };
    modelCatalog.forEach((m) => {
      if (groups[m.brand]) groups[m.brand].push(m);
    });
    return groups;
  }, [modelCatalog]);

  const departments = useMemo(() => {
    const set = new Set();
    directoryUsers.forEach((u) => {
      if (u.department) set.add(u.department);
    });
    return Array.from(set).sort();
  }, [directoryUsers]);

  const applyDeviceToState = useCallback(
    (dev, catalogList, expCat) => {
      if (!dev) return;
      const dBrand = dev.brand || "Yealink";
      const dModel = dev.model || "T46U";
      const spec =
        (catalogList || []).find((c) => c.brand.toLowerCase() === dBrand.toLowerCase() && c.model.toLowerCase() === dModel.toLowerCase()) ||
        { max_dss: 27 };

      setSelectedDeviceId(String(dev.id || dev.sip_username || ""));
      setBrand(dBrand);
      setModel(dModel);
      setSipUsername(String(dev.sip_username || ""));
      setMacAddress(String(dev.mac || ""));
      setConfigVersion(Number(dev.config_version || 1));
      setLiveStatus(dev.live_status || { online: false, ip: dev.ip || "", rtt_ms: "", user_agent: "", on_active_call: false });
      setProvUrls(dev.prov_urls || { active: "", lan: "", wan: "", effective_mode: "lan", pbx_host: "" });
      setLastProvisionedAt(String(dev.last_provisioned_at || ""));
      setLastProvisionedIp(String(dev.last_provisioned_ip || ""));
      setDssKeys(buildDssArray(ext, spec.max_dss || 27, dev.dss_keys || []));
      setSoftKeys(buildSoftKeys(dev.soft_keys || []));
      setPhonePrefs({ ...DEFAULT_PHONE_PREFS, ...(dev.phone_prefs || {}) });

      const mods = (Array.isArray(dev.expansion_modules) ? dev.expansion_modules : []).map((mod, idx) => {
        const eSpec = (expCat || {})[mod.model] || { total_keys: 60 };
        return {
          module_index: Number(mod.module_index || idx + 1),
          model: mod.model || "EXP43",
          keys: buildExpansionKeys(eSpec.total_keys || 60, mod.keys || []),
        };
      });
      setExpansionModules(mods);
      setActiveExpModuleIndex(mods[0]?.module_index || 1);
      setActiveDssPage(1);
      setActiveExpPage(1);
      setSelectedKey({ category: "dss", index: 2 });
    },
    [ext]
  );

  const fetchDeskphoneConfig = useCallback(
    async (targetDeviceId = "") => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (currentUser?.id) params.set("user_id", String(currentUser.id));
        if (targetDeviceId) params.set("device_id", String(targetDeviceId));
        const qs = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`${getApiBase()}/api/agent/deskphone/${encodeURIComponent(ext)}${qs}`);
        if (res.ok) {
          const data = await res.json();
          setHasProvisionedDevice(Boolean(data.has_provisioned_device));
          const cat = Array.isArray(data.model_catalog) ? data.model_catalog : [];
          const eCat = data.expansion_catalog && typeof data.expansion_catalog === "object" ? data.expansion_catalog : {};
          setModelCatalog(cat);
          setExpansionCatalog(eCat);
          setDevices(Array.isArray(data.devices) ? data.devices : []);
          setDirectoryUsers(Array.isArray(data.directory_users) ? data.directory_users : []);
          setExtNameMap(data.ext_name_map && typeof data.ext_name_map === "object" ? data.ext_name_map : {});
          setSpeedDials(Array.isArray(data.speed_dials) ? data.speed_dials : []);
          if (data.provisioned_device) {
            applyDeviceToState(data.provisioned_device, cat, eCat);
          }
        }
      } catch (err) {
        console.error("Masa telefonu ayarları yüklenemedi:", err);
      } finally {
        setLoading(false);
      }
    },
    [ext, currentUser?.id, getApiBase, applyDeviceToState]
  );

  useEffect(() => {
    fetchDeskphoneConfig();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchDeskphoneConfig]);

  // Live Reboot/Check-Sync Polling Tracker
  const startRebootTracking = useCallback(
    (mode, baselineProvAt) => {
      if (pollRef.current) clearInterval(pollRef.current);
      const startedAt = Date.now();
      setRebootTracker({
        step: 2,
        mode,
        baselineProvAt: baselineProvAt || "",
        startedAt,
        note: mode === "reboot" ? "Telefon yeniden başlatılıyor, yeni provizyon dosyasını çekmesi bekleniyor..." : "Hızlı senkronizasyon gönderildi, telefonun ayarları çekmesi bekleniyor...",
      });

      pollRef.current = setInterval(async () => {
        const elapsed = Date.now() - startedAt;
        if (elapsed > 95000) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setRebootTracker((prev) =>
            prev
              ? {
                  ...prev,
                  step: 3,
                  note: "Bekleme süresi doldu. Telefon açıldığında yeni provizyon dosyasını otomatik çekecektir.",
                }
              : null
          );
          return;
        }
        try {
          const qs = new URLSearchParams();
          if (currentUser?.id) qs.set("user_id", String(currentUser.id));
          if (selectedDeviceId) qs.set("device_id", selectedDeviceId);
          const r = await fetch(`${getApiBase()}/api/agent/deskphone/${encodeURIComponent(ext)}/status?${qs.toString()}`);
          if (!r.ok) return;
          const st = await r.json();
          setLiveStatus({
            online: Boolean(st.online),
            ip: st.ip || "",
            rtt_ms: st.rtt_ms || "",
            user_agent: st.user_agent || "",
            on_active_call: Boolean(st.on_active_call),
          });
          if (st.last_provisioned_at) setLastProvisionedAt(st.last_provisioned_at);
          if (st.last_provisioned_ip) setLastProvisionedIp(st.last_provisioned_ip);

          const fetchedNewCfg = Boolean(st.last_provisioned_at && st.last_provisioned_at !== baselineProvAt);
          if (fetchedNewCfg && st.online) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setRebootTracker({
              step: 4,
              mode,
              baselineProvAt,
              startedAt,
              note: `Telefon yeni ayarları çekti (${st.last_provisioned_at}) ve hatta bağlandı (${st.ip || "LAN"})!`,
            });
          } else if (fetchedNewCfg) {
            setRebootTracker((prev) =>
              prev ? { ...prev, step: 3, note: "Yeni provizyon dosyası telefona indirildi; SIP kaydı (REGISTER) bekleniyor..." } : null
            );
          }
        } catch (e) {}
      }, 3000);
    },
    [ext, currentUser?.id, selectedDeviceId, getApiBase]
  );

  // Switch model -> resize dssKeys array cleanly preserving existing keys
  const handleModelChange = (newBrand, newModel) => {
    setBrand(newBrand);
    setModel(newModel);
    const spec = modelCatalog.find((c) => c.brand === newBrand && c.model === newModel);
    if (spec) {
      setDssKeys((prev) => buildDssArray(ext, spec.max_dss || 12, prev));
      setActiveDssPage(1);
      // Trim expansion modules if new model supports fewer
      const maxE = Number(spec.max_expansions || 0);
      setExpansionModules((prev) => {
        if (maxE === 0) return [];
        const expModelName = spec.expansion_model || "EXP43";
        const expSpec = expansionCatalog[expModelName] || { total_keys: 60 };
        return prev.slice(0, maxE).map((m, idx) => ({
          ...m,
          module_index: idx + 1,
          model: expModelName,
          keys: buildExpansionKeys(expSpec.total_keys || 60, m.keys),
        }));
      });
    }
  };

  // Currently selected key object (DSS, Softkey, or Expansion Module key)
  const currentEditingItem = useMemo(() => {
    if (selectedKey.category === "soft") {
      return softKeys.find((s) => Number(s.key_index) === Number(selectedKey.index)) || softKeys[0];
    }
    if (selectedKey.category === "exp") {
      const mod = expansionModules.find((m) => Number(m.module_index) === Number(selectedKey.moduleIndex));
      return mod?.keys?.find((k) => Number(k.key_index) === Number(selectedKey.index)) || null;
    }
    return dssKeys.find((k) => Number(k.key_index) === Number(selectedKey.index)) || dssKeys[0];
  }, [selectedKey, dssKeys, softKeys, expansionModules]);

  const updateKeyObject = (k, field, val) => {
    const updated = { ...k, [field]: val };
    if (field === "type") {
      if (val === "line") {
        updated.label = `Hat ${ext}`;
        updated.label_mode = "custom";
        updated.value = String(ext);
      } else if (val === "dnd") {
        updated.label = "Rahatsız Etme";
        updated.label_mode = "custom";
        updated.value = "";
      } else if (val === "voicemail") {
        updated.label = "Sesli Posta";
        updated.label_mode = "custom";
        updated.value = "*97";
      } else if (val === "hold") {
        updated.label = "Beklet";
        updated.label_mode = "custom";
        updated.value = "";
      } else if (val === "pickup") {
        updated.label = "Çağrı Çek";
        updated.label_mode = "custom";
        updated.value = "*8";
      } else if (val === "conference") {
        updated.label = "Konferans";
        updated.label_mode = "custom";
        updated.value = "";
      } else if (val === "park") {
        updated.label = "Park 700";
        updated.label_mode = "custom";
        updated.value = updated.value || "700";
      } else if (val === "none") {
        updated.label = "";
        updated.label_mode = "auto";
        updated.value = "";
      } else if (val === "blf" || val === "speed_dial" || val === "transfer" || val === "intercom" || val === "forward") {
        // Default to dynamic auto-name when targeting an extension
        if (!updated.label_mode) updated.label_mode = "auto";
        if (updated.label_mode === "auto" && updated.value && extNameMap[String(updated.value).trim()]) {
          updated.label = extNameMap[String(updated.value).trim()];
        }
      }
    } else if (field === "value") {
      const cleanV = String(val || "").trim();
      if (updated.label_mode === "auto" && cleanV && extNameMap[cleanV]) {
        updated.label = extNameMap[cleanV];
      }
    } else if (field === "label") {
      // Typing a manual label switches to custom mode
      updated.label_mode = "custom";
    } else if (field === "label_mode") {
      if (val === "auto") {
        const cleanV = String(updated.value || "").trim();
        if (cleanV && extNameMap[cleanV]) {
          updated.label = extNameMap[cleanV];
        }
      }
    }
    return updated;
  };

  const isPrimaryLineLocked =
    selectedKey.category === "dss" && Number(selectedKey.index) === 1;

  const updateCurrentKeyField = (field, val) => {
    if (isPrimaryLineLocked && field !== "label") {
      return;
    }
    if (selectedKey.category === "soft") {
      setSoftKeys((prev) =>
        prev.map((s) => {
          if (Number(s.key_index) !== Number(selectedKey.index)) return s;
          const u = { ...s, [field]: val };
          if (field === "type") {
            const meta = SOFTKEY_TYPES.find((t) => t.id === val);
            if (meta) u.label = meta.defaultLabel;
          }
          return u;
        })
      );
      return;
    }
    if (selectedKey.category === "exp") {
      setExpansionModules((prev) =>
        prev.map((mod) => {
          if (Number(mod.module_index) !== Number(selectedKey.moduleIndex)) return mod;
          return {
            ...mod,
            keys: (mod.keys || []).map((k) =>
              Number(k.key_index) === Number(selectedKey.index) ? updateKeyObject(k, field, val) : k
            ),
          };
        })
      );
      return;
    }
    setDssKeys((prev) =>
      prev.map((k) => (Number(k.key_index) === Number(selectedKey.index) ? updateKeyObject(k, field, val) : k))
    );
  };

  const assignDirectoryUserToCurrentKey = (dirUser) => {
    if (!dirUser || isPrimaryLineLocked) return;
    const isBlfOrTarget = ["blf", "speed_dial", "transfer", "intercom", "forward"].includes(currentEditingItem?.type);
    const nextType = isBlfOrTarget ? currentEditingItem.type : "blf";

    const applyFn = (k) => ({
      ...k,
      type: nextType,
      value: dirUser.extension,
      label: dirUser.name,
      label_mode: "auto", // Automatically linked to live PBX name!
      pickup_code: k.pickup_code || "*8",
    });

    if (selectedKey.category === "exp") {
      setExpansionModules((prev) =>
        prev.map((mod) =>
          Number(mod.module_index) !== Number(selectedKey.moduleIndex)
            ? mod
            : {
                ...mod,
                keys: (mod.keys || []).map((k) => (Number(k.key_index) === Number(selectedKey.index) ? applyFn(k) : k)),
              }
        )
      );
    } else if (selectedKey.category === "dss") {
      setDssKeys((prev) =>
        prev.map((k) => (Number(k.key_index) === Number(selectedKey.index) ? applyFn(k) : k))
      );
    }
  };

  const handleAddExpansionModule = () => {
    const maxE = Number(activeModelSpec?.max_expansions || 0);
    if (maxE <= 0 || expansionModules.length >= maxE) return;
    const modModel = activeModelSpec.expansion_model || "EXP43";
    const expSpec = expansionCatalog[modModel] || { total_keys: 60 };
    const nextIdx = expansionModules.length + 1;
    const newMod = {
      module_index: nextIdx,
      model: modModel,
      keys: buildExpansionKeys(expSpec.total_keys || 60, []),
    };
    setExpansionModules((prev) => [...prev, newMod]);
    setActiveExpModuleIndex(nextIdx);
    setActiveExpPage(1);
    setSelectedKey({ category: "exp", moduleIndex: nextIdx, index: 1 });
    setInspectorTab("keys");
  };

  const handleConfirmDeleteExpansionModule = () => {
    if (deleteModConfirmIdx === null) return;
    setExpansionModules((prev) => {
      const remaining = prev
        .filter((m) => Number(m.module_index) !== Number(deleteModConfirmIdx))
        .map((m, idx) => ({ ...m, module_index: idx + 1 }));
      setActiveExpModuleIndex(remaining[0]?.module_index || 1);
      return remaining;
    });
    if (selectedKey.category === "exp") {
      setSelectedKey({ category: "dss", index: 1 });
    }
    setDeleteModConfirmIdx(null);
  };

  const handleExecuteAutoFillModule = () => {
    if (!autoFillModalModIdx) return;
    const pool = directoryUsers.filter((u) => {
      if (u.extension === ext) return false;
      if (autoFillDept !== "__ALL__" && u.department !== autoFillDept) return false;
      return true;
    });

    setExpansionModules((prev) =>
      prev.map((mod) => {
        if (Number(mod.module_index) !== Number(autoFillModalModIdx)) return mod;
        const total = (mod.keys || []).length || 60;
        const filledKeys = Array.from({ length: total }, (_, i) => {
          const u = pool[i];
          if (u) {
            return {
              key_index: i + 1,
              type: "blf",
              label: u.name,
              label_mode: "auto",
              value: u.extension,
              pickup_code: "*8",
            };
          }
          return { key_index: i + 1, type: "none", label: "", label_mode: "auto", value: "", pickup_code: "*8" };
        });
        return { ...mod, keys: filledKeys };
      })
    );
    setBanner({
      ok: true,
      message: `Modül #${autoFillModalModIdx} içine ${pool.length} dahili "Otomatik Santral İsmi" modunda BLF olarak dolduruldu. "Telefona Gönder & Yeniden Başlat" ile cihaza aktarabilirsiniz.`,
    });
    setAutoFillModalModIdx(null);
  };

  const handleSaveAndApply = async (applyMode = "reboot", forceOnCall = false) => {
    setSavingMode(applyMode);
    setBanner(null);
    const baselineProvAt = lastProvisionedAt;
    try {
      // Strip empty unassigned expansion keys only for cleanliness? Keep non-none keys + all configured keys
      const cleanExpModules = expansionModules.map((m) => ({
        module_index: m.module_index,
        model: m.model,
        keys: (m.keys || []).filter((k) => k.type !== "none"),
      }));
      const res = await fetch(`${getApiBase()}/api/agent/deskphone/${encodeURIComponent(ext)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": String(currentUser?.username || ext),
        },
        body: JSON.stringify({
          extension: ext,
          user_id: currentUser?.id,
          device_id: selectedDeviceId,
          sip_username: sipUsername,
          brand,
          model,
          dss_keys: dssKeys,
          soft_keys: softKeys,
          expansion_modules: cleanExpModules,
          phone_prefs: phonePrefs,
          apply_mode: applyMode,
          force_reboot_on_call: forceOnCall,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Masa telefonu ayarları kaydedilemedi.");

      if (data.status === "active_call_warning") {
        setActiveCallWarning({ applyMode, message: data.message });
        return;
      }

      if (data.config_version) setConfigVersion(Number(data.config_version));
      setBanner({
        ok: true,
        message: data.message || "Ayarlar kaydedildi ve cihaza iletildi.",
      });

      if ((applyMode === "reboot" || applyMode === "check_sync") && data.notified) {
        startRebootTracking(applyMode, baselineProvAt);
      }
    } catch (err) {
      setBanner({
        ok: false,
        message: err.message || "Masa telefonu ayarları gönderilirken hata oluştu.",
      });
    } finally {
      setSavingMode("");
    }
  };

  const handleOpenCfgPreview = async () => {
    try {
      const qs = new URLSearchParams({ preview: "true" });
      if (selectedDeviceId) qs.set("device_id", selectedDeviceId);
      const r = await fetch(`${getApiBase()}/api/agent/deskphone/${encodeURIComponent(ext)}/config-file?${qs.toString()}`);
      if (r.ok) {
        const d = await r.json();
        setCfgPreviewModal({ filename: d.filename, content: d.content });
      }
    } catch (e) {}
  };

  const handleDownloadConfig = () => {
    const qs = selectedDeviceId ? `?device_id=${encodeURIComponent(selectedDeviceId)}` : "";
    window.open(`${getApiBase()}/api/agent/deskphone/${encodeURIComponent(ext)}/config-file${qs}`, "_blank");
  };

  const handleCopyText = (key, val) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedUrlKey(key);
    setTimeout(() => setCopiedUrlKey(""), 1800);
  };

  const handleResetDefaults = () => {
    setDssKeys(buildDssArray(ext, activeModelSpec?.max_dss || 27, []));
    setSoftKeys(buildSoftKeys([]));
    setPhonePrefs({ ...DEFAULT_PHONE_PREFS });
    setBanner({
      ok: true,
      message: "Tuş dizilimi ve telefon tercihleri varsayılan ayarlara döndürüldü. Telefona göndermek için kaydet butonunu kullanın.",
    });
  };

  const filteredDirectory = useMemo(() => {
    const q = dirSearch.trim().toLowerCase();
    if (!q) return directoryUsers;
    return directoryUsers.filter(
      (u) =>
        u.extension.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        (u.department || "").toLowerCase().includes(q)
    );
  }, [directoryUsers, dirSearch]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center p-10">
        <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
          <RefreshCw size={24} className="animate-spin text-primary" />
          <span className="text-xs font-bold">Masa telefonu ve otoprovizyon bağlantısı yükleniyor...</span>
        </div>
      </div>
    );
  }

  if (!hasProvisionedDevice) {
    return (
      <div className="h-full w-full flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-7 text-center shadow-sm space-y-4">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
            <AlertCircle size={28} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
              Tanımlı Fiziksel Masa Telefonunuz Bulunmamaktadır
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Dahili hattınıza (<span className="font-mono font-bold text-slate-900 dark:text-white">{ext}</span>) bağlı bir{" "}
              <span className="font-bold">Oto-Provizyon / Fiziksel SIP Masa Telefonu</span> bulunamadı. Sistem yöneticiniz kullanıcı ayarlarından fiziksel IP telefonunuzu tanımladığında bu ekrandan canlı olarak yönetebilirsiniz.
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => fetchDeskphoneConfig()}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold text-white shadow-sm transition cursor-pointer ${bg} ${hover}`}
            >
              <RefreshCw size={14} />
              <span>Tekrar Kontrol Et</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const editingTypeMeta =
    selectedKey.category !== "soft" && currentEditingItem
      ? DSS_KEY_TYPES.find((t) => t.id === currentEditingItem.type) || DSS_KEY_TYPES[DSS_KEY_TYPES.length - 1]
      : null;

  const isTargetExtInDirectory = Boolean(
    currentEditingItem?.value && extNameMap[String(currentEditingItem.value).trim()]
  );

  return (
    <div className="h-full w-full overflow-y-auto p-4 lg:p-5 space-y-4">
      {/* ================================================================ */}
      {/* TOP HEADER & ACTION BAR                                          */}
      {/* ================================================================ */}
      <div className={`rounded-2xl border p-4 bg-white dark:bg-slate-900 shadow-sm space-y-3 ${borderLight}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${lightBg} ${text}`}>
              <Phone size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-black text-slate-800 dark:text-white">
                  Masa Telefonum — Canlı Görsel Tasarımcı
                </h2>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                  Dahili {ext}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${
                    liveStatus.online
                      ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {liveStatus.online ? <Wifi size={10} /> : <WifiOff size={10} />}
                  {liveStatus.online
                    ? `Bağlı${liveStatus.ip ? ` (${liveStatus.ip})` : ""}${liveStatus.rtt_ms ? ` • ${liveStatus.rtt_ms}` : ""}`
                    : "Çevrimdışı"}
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  v{configVersion}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                BLF, Hızlı Arama, Meşguliyet Modülleri (1–4 adet), Softkey, Zil Sesi ve Ekran ayarlarını görsel olarak düzenleyip tek tıkla telefonunuza gönderin.
              </p>
            </div>
          </div>

          {/* Primary & Secondary Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
              title="Varsayılan Ayarlara Sıfırla"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Sıfırla</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCfgPreview}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
              title="Güncel Oto-Provizyon Kodunu Önizle"
            >
              <FileCode2 size={13} />
              <span className="hidden sm:inline">Kod Önizle</span>
            </button>

            <button
              type="button"
              disabled={Boolean(savingMode)}
              onClick={() => handleSaveAndApply("check_sync", false)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 transition cursor-pointer disabled:opacity-50"
              title="Telefonu kapatıp açmadan hızlı senkronizasyon (SIP Check-Sync) gönder"
            >
              <Zap size={13} className="text-amber-500" />
              <span>{savingMode === "check_sync" ? "Gönderiliyor..." : "Hızlı Uygula"}</span>
            </button>

            <button
              type="button"
              disabled={Boolean(savingMode)}
              onClick={() => handleSaveAndApply("reboot", false)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold text-white shadow-md transition cursor-pointer disabled:opacity-50 ${bg} ${hover}`}
              title="Oto-provizyon kodunu güncelle ve telefona Reboot komutu gönder; cihaz yeni ayarlarla açılsın"
            >
              <Power size={14} />
              <span>
                {savingMode === "reboot"
                  ? "Telefona Gönderiliyor..."
                  : "Telefona Gönder & Yeniden Başlat"}
              </span>
            </button>
          </div>
        </div>

        {/* Device & Model Selector Row */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {devices.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Cihaz:</span>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => {
                    const found = devices.find((d) => String(d.id || d.sip_username) === e.target.value);
                    if (found) applyDeviceToState(found, modelCatalog, expansionCatalog);
                  }}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
                >
                  {devices.map((d) => (
                    <option key={d.id || d.sip_username} value={String(d.id || d.sip_username)}>
                      {d.name || d.sip_username} ({d.brand} {d.model})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Telefon Modeli:</span>
              <select
                value={`${brand}::${model}`}
                onChange={(e) => {
                  const [nb, nm] = e.target.value.split("::");
                  handleModelChange(nb, nm);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white max-w-[320px]"
              >
                {Object.entries(brandsGrouped).map(([bName, items]) =>
                  items.length > 0 ? (
                    <optgroup key={bName} label={`── ${bName} (${items.length} Model) ──`}>
                      {items.map((item) => (
                        <option key={`${item.brand}::${item.model}`} value={`${item.brand}::${item.model}`}>
                          {item.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : null
                )}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            {macAddress && (
              <span className="font-mono">
                MAC: <strong className="text-slate-700 dark:text-slate-200">{macAddress}</strong>
              </span>
            )}
            {sipUsername && (
              <span className="font-mono">
                Endpoint: <strong className="text-slate-700 dark:text-slate-200">{sipUsername}</strong>
              </span>
            )}
            {lastProvisionedAt && (
              <span>
                Son Provizyon: <strong className="text-emerald-600 dark:text-emerald-400">{lastProvisionedAt}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 ${
            banner.ok
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.ok ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
            <span>{banner.message}</span>
          </div>
          <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 4-Step Live Reboot & Provisioning Progress Bar */}
      {rebootTracker && (
        <div className="rounded-2xl border border-sky-200 dark:border-sky-800/60 bg-sky-50/70 dark:bg-sky-950/25 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-sky-900 dark:text-sky-200">
              {rebootTracker.step < 4 ? (
                <RefreshCw size={14} className="animate-spin text-sky-500" />
              ) : (
                <CheckCircle2 size={15} className="text-emerald-500" />
              )}
              <span>Canlı Provizyon & Yeniden Başlatma Takibi</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (pollRef.current) clearInterval(pollRef.current);
                setRebootTracker(null);
              }}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { idx: 1, label: "1. Ayarlar & .CFG Güncellendi" },
              { idx: 2, label: rebootTracker.mode === "reboot" ? "2. SIP Reboot Gönderildi" : "2. Check-Sync Gönderildi" },
              { idx: 3, label: "3. Telefon Yeni Ayarı Çekiyor" },
              { idx: 4, label: "4. Açıldı & Hatta Bağlandı" },
            ].map((st) => {
              const done = rebootTracker.step >= st.idx;
              const active = rebootTracker.step === st.idx && rebootTracker.step < 4;
              return (
                <div
                  key={st.idx}
                  className={`px-3 py-2 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 ${
                    done
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                      : active
                      ? "bg-sky-500/15 border-sky-400 text-sky-800 dark:text-sky-200 animate-pulse"
                      : "bg-white/60 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-400"
                  }`}
                >
                  {done ? <Check size={12} className="shrink-0" /> : <span className="w-2 h-2 rounded-full bg-current opacity-50 shrink-0" />}
                  <span className="truncate">{st.label}</span>
                </div>
              );
            })}
          </div>
          <div className="text-[11px] font-semibold text-sky-800 dark:text-sky-300">{rebootTracker.note}</div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MAIN STUDIO WORKSPACE: LEFT VISUAL SIMULATOR | RIGHT INSPECTOR   */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* LEFT 7-8 COLS: MODEL-ACCURATE VISUAL HARDWARE SIMULATOR + SIDECARS */}
        <div className="xl:col-span-7 2xl:col-span-8">
          <DeskphoneVisualSimulator
            brand={brand}
            model={model}
            modelSpec={activeModelSpec}
            ext={ext}
            fullName={fullName}
            dssKeys={dssKeys}
            softKeys={softKeys}
            expansionModules={expansionModules}
            expansionCatalog={expansionCatalog}
            phonePrefs={phonePrefs}
            extNameMap={extNameMap}
            selectedKey={selectedKey}
            onSelectKey={(sel) => {
              setSelectedKey(sel);
              setInspectorTab("keys");
            }}
            activeDssPage={activeDssPage}
            onChangeDssPage={setActiveDssPage}
            activeExpModuleIndex={activeExpModuleIndex}
            onChangeExpModuleIndex={setActiveExpModuleIndex}
            activeExpPage={activeExpPage}
            onChangeExpPage={setActiveExpPage}
            onAddExpansionModule={handleAddExpansionModule}
            onRequestDeleteExpansionModule={(mIdx) => setDeleteModConfirmIdx(mIdx)}
            onOpenAutoFillModal={(mIdx) => {
              setAutoFillDept("__ALL__");
              setAutoFillModalModIdx(mIdx);
            }}
            liveOnline={liveStatus.online}
          />
        </div>

        {/* RIGHT 5-4 COLS: 4-TAB STUDIO INSPECTOR */}
        <div className={`xl:col-span-5 2xl:col-span-4 rounded-2xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden ${borderLight}`}>
          {/* Inspector Tabs */}
          <div className="grid grid-cols-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-1.5 gap-1">
            {[
              { id: "keys", label: "Tuşlar", icon: Sliders },
              { id: "audio", label: "Ses & Zil", icon: Volume2 },
              { id: "display", label: "Ekran", icon: Monitor },
              { id: "info", label: "Provizyon", icon: FileCode2 },
            ].map((t) => {
              const Icon = t.icon;
              const isAct = inspectorTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setInspectorTab(t.id)}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-[11px] font-extrabold transition cursor-pointer ${
                    isAct
                      ? `${bg} text-white shadow-sm`
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon size={13} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-4 space-y-4">
            {/* ========================================================== */}
            {/* TAB 1: SELECTED KEY / BLF / SOFTKEY / EXPANSION INSPECTOR  */}
            {/* ========================================================== */}
            {inspectorTab === "keys" && currentEditingItem && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {selectedKey.category === "soft"
                        ? `Ekran Altı Softkey • F${selectedKey.index}`
                        : selectedKey.category === "exp"
                        ? `Meşguliyet Modülü #${selectedKey.moduleIndex} • Tuş ${selectedKey.index}`
                        : `Ana Telefon DSS Tuşu • Tuş ${selectedKey.index}`}
                    </div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-white mt-0.5">
                      {selectedKey.category === "soft"
                        ? currentEditingItem.label || `Alt Tuş ${selectedKey.index}`
                        : currentEditingItem.label || editingTypeMeta?.name || "Boş Tuş"}
                    </h3>
                  </div>

                  {selectedKey.category !== "soft" && currentEditingItem.type !== "none" && !isPrimaryLineLocked && (
                    <button
                      type="button"
                      onClick={() => updateCurrentKeyField("type", "none")}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition cursor-pointer"
                    >
                      Temizle
                    </button>
                  )}

                  {isPrimaryLineLocked && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shrink-0">
                      <Lock size={11} />
                      Kilitli Ana Hat
                    </span>
                  )}
                </div>

                {isPrimaryLineLocked && (
                  <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/25 text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed flex items-start gap-2">
                    <Lock size={14} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span>
                      <strong>T1 (Ana Hat / Line 1)</strong> telefonunuzun aktif dahili hattıdır (<span className="font-mono font-bold">{ext}</span>). Arama ve çağrı bekletme işlevlerinin bozulmaması için silinemez veya başka bir işleve dönüştürülemez; yalnızca aşağıdan ekranda görünecek hat etiketini özelleştirebilirsiniz.
                    </span>
                  </div>
                )}

                {/* Key Function Type */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
                    Tuş İşlevi
                  </label>
                  {selectedKey.category === "soft" ? (
                    <select
                      value={currentEditingItem.type}
                      onChange={(e) => updateCurrentKeyField("type", e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
                    >
                      {SOFTKEY_TYPES.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <select
                        disabled={isPrimaryLineLocked}
                        value={currentEditingItem.type}
                        onChange={(e) => updateCurrentKeyField("type", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {DSS_KEY_TYPES.map((dt) => (
                          <option key={dt.id} value={dt.id}>
                            {dt.name}
                          </option>
                        ))}
                      </select>
                      {editingTypeMeta && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {editingTypeMeta.desc}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Target Value (Extension / Number / Park Slot) */}
                {(selectedKey.category === "soft"
                  ? ["speed_dial", "forward", "transfer"].includes(currentEditingItem.type)
                  : editingTypeMeta?.needsTarget || currentEditingItem.type === "line") && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
                      Hedef Dahili / Numara / Değer
                    </label>
                    <input
                      type="text"
                      disabled={isPrimaryLineLocked}
                      value={currentEditingItem.value || ""}
                      onChange={(e) => updateCurrentKeyField("value", e.target.value)}
                      placeholder="Örn: 1000 veya 0532..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                )}

                {/* DYNAMIC AUTO-NAME vs MANUAL LABEL SELECTOR (KEY FEATURE!) */}
                {selectedKey.category !== "soft" && currentEditingItem.type !== "none" && (
                  <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                        Ekran Etiketi (İsim)
                      </label>
                      {editingTypeMeta?.supportsAutoName && (
                        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                          <button
                            type="button"
                            onClick={() => updateCurrentKeyField("label_mode", "auto")}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold cursor-pointer transition ${
                              currentEditingItem.label_mode === "auto"
                                ? "bg-emerald-600 text-white"
                                : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                            }`}
                          >
                            <Sparkles size={10} />
                            Otomatik
                          </button>
                          <button
                            type="button"
                            onClick={() => updateCurrentKeyField("label_mode", "custom")}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold cursor-pointer transition ${
                              currentEditingItem.label_mode !== "auto"
                                ? `${bg} text-white`
                                : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                            }`}
                          >
                            Manuel
                          </button>
                        </div>
                      )}
                    </div>

                    {currentEditingItem.label_mode === "auto" && isTargetExtInDirectory ? (
                      <div className="space-y-1.5">
                        <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                          <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                            {extNameMap[String(currentEditingItem.value).trim()]}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            Santralden Canlı
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          <strong className="text-emerald-600 dark:text-emerald-400">Dinamik İsim Aktif:</strong> Dahili{" "}
                          <span className="font-mono font-bold">{currentEditingItem.value}</span> ismi santralde değiştiğinde, telefon yeniden başladığında ekrandaki isim de otomatik güncellenir.
                        </p>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={currentEditingItem.label || ""}
                        onChange={(e) => updateCurrentKeyField("label", e.target.value)}
                        placeholder={
                          isTargetExtInDirectory
                            ? `Özel isim yazın (Santraldeki isim: ${extNameMap[String(currentEditingItem.value).trim()]})`
                            : "Ekranda görünecek isim (Örn: Satış / Ahmet)"
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white"
                      />
                    )}
                  </div>
                )}

                {selectedKey.category === "soft" && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
                      Alt Tuş Etiketi
                    </label>
                    <input
                      type="text"
                      value={currentEditingItem.label || ""}
                      onChange={(e) => updateCurrentKeyField("label", e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                )}

                {/* BLF Call Pickup Code */}
                {selectedKey.category !== "soft" && currentEditingItem.type === "blf" && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
                      Çağrı Çekme (Pickup) Ön Kodu
                    </label>
                    <input
                      type="text"
                      value={currentEditingItem.pickup_code || "*8"}
                      onChange={(e) => updateCurrentKeyField("pickup_code", e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                )}

                {/* 1-Click Directory Picker (Auto-fills Extension + Dynamic Auto-Name!) */}
                {selectedKey.category !== "soft" && !isPrimaryLineLocked && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <Users size={13} className={text} />
                        Rehberden Tek Tıkla Ata (Otomatik İsimli)
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">{filteredDirectory.length} dahili</span>
                    </div>
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={dirSearch}
                        onChange={(e) => setDirSearch(e.target.value)}
                        placeholder="İsim, dahili veya departman ara..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
                      />
                    </div>
                    <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                      {filteredDirectory.map((du) => {
                        const isPicked = String(currentEditingItem.value) === String(du.extension);
                        return (
                          <button
                            key={du.extension}
                            type="button"
                            onClick={() => assignDirectoryUserToCurrentKey(du)}
                            className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border text-left transition cursor-pointer ${
                              isPicked
                                ? `${lightBg} ${border} ${text}`
                                : "border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-800 dark:text-white truncate">{du.name}</div>
                              {du.department && (
                                <div className="text-[10px] text-slate-400 truncate">{du.department}</div>
                              )}
                            </div>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-extrabold text-slate-700 dark:text-slate-200 shrink-0">
                              {du.extension}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {speedDials.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-1.5">Kurumsal Hızlı Aramalar</div>
                        <div className="flex flex-wrap gap-1.5">
                          {speedDials.slice(0, 8).map((sd, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                updateCurrentKeyField("type", "speed_dial");
                                updateCurrentKeyField("value", sd.number || sd.target || "");
                                updateCurrentKeyField("label", sd.name || sd.label || sd.number || "");
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                              {sd.name || sd.label}: {sd.number || sd.target}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================== */}
            {/* TAB 2: AUDIO, RINGTONE, VOLUME & HEADSET PREFERENCES       */}
            {/* ========================================================== */}
            {inspectorTab === "audio" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                    Zil Sesi Melodisi
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={phonePrefs.ringtone}
                      onChange={(e) => setPhonePrefs((p) => ({ ...p, ringtone: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
                    >
                      {RINGTONE_OPTIONS.map((rt) => (
                        <option key={rt.id} value={rt.id}>
                          {rt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const found = RINGTONE_OPTIONS.find((r) => r.id === phonePrefs.ringtone);
                        playRingtonePreview(found?.freqs || [523, 659]);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                      title="Melodiyi Dinle"
                    >
                      <Play size={12} />
                      Dinle
                    </button>
                  </div>
                </div>

                {/* Volume Sliders */}
                <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-950/30">
                  {[
                    { key: "ring_volume", label: "Zil Sesi Seviyesi", min: 0, max: 10 },
                    { key: "handset_volume", label: "Ahize Ses Seviyesi", min: 1, max: 10 },
                    { key: "speaker_volume", label: "Hoparlör Ses Seviyesi", min: 1, max: 10 },
                    { key: "headset_volume", label: "Kulaklık Ses Seviyesi", min: 1, max: 10 },
                  ].map((v) => (
                    <div key={v.key} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-600 dark:text-slate-300">{v.label}</span>
                        <span className={`font-mono font-extrabold ${text}`}>{phonePrefs[v.key]} / 10</span>
                      </div>
                      <input
                        type="range"
                        min={v.min}
                        max={v.max}
                        value={phonePrefs[v.key]}
                        onChange={(e) => setPhonePrefs((p) => ({ ...p, [v.key]: Number(e.target.value) }))}
                        className="w-full accent-primary cursor-pointer"
                      />
                    </div>
                  ))}
                </div>

                {/* Headset Mode */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Headphones size={13} className={text} />
                    Kulaklık Modu (Öncelik)
                  </label>
                  <select
                    value={phonePrefs.headset_mode}
                    onChange={(e) => setPhonePrefs((p) => ({ ...p, headset_mode: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
                  >
                    <option value="rj9">Standart Kablolu Kulaklık (RJ9)</option>
                    <option value="ehs">Kablosuz EHS Kulaklık (Öncelikli)</option>
                    <option value="usb">USB Kulaklık (Öncelikli)</option>
                    <option value="bluetooth">Bluetooth Kulaklık (Öncelikli)</option>
                  </select>
                </div>

                {/* Audio Behavior Toggles */}
                <div className="space-y-2">
                  {[
                    { key: "call_waiting", title: "Çağrı Bekletme (Call Waiting)", desc: "Görüşmedeyken 2. çağrının düşmesine izin ver" },
                    { key: "call_waiting_tone", title: "Çağrı Bekletme Uyarı Sesi", desc: "2. çağrı geldiğinde ahizede bip sesi çal" },
                    { key: "auto_answer", title: "Otomatik Yanıtlama (Auto-Answer)", desc: "Gelen çağrıları otomatik hoparlör/kulaklıkla aç" },
                    { key: "intercom_mute", title: "Intercom Sessiz Açılma", desc: "Dahili anons geldiğinde mikrofonu kapalı başlat" },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 cursor-pointer"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-white">{item.title}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{item.desc}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(phonePrefs[item.key])}
                        onChange={(e) => setPhonePrefs((p) => ({ ...p, [item.key]: e.target.checked }))}
                        className="h-4 w-4 rounded accent-primary cursor-pointer shrink-0"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ========================================================== */}
            {/* TAB 3: DISPLAY, BACKLIGHT, CLOCK & LED PREFERENCES         */}
            {/* ========================================================== */}
            {inspectorTab === "display" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                    Özel Ekran Karşılama Etiketi (Üst Bar)
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={phonePrefs.screen_label || ""}
                    onChange={(e) => setPhonePrefs((p) => ({ ...p, screen_label: e.target.value }))}
                    placeholder={`${ext} • ${fullName}`}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">Telefon Dili</label>
                    <select
                      value={phonePrefs.language}
                      onChange={(e) => setPhonePrefs((p) => ({ ...p, language: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
                    >
                      <option value="Turkish">Türkçe</option>
                      <option value="English">English</option>
                      <option value="German">Deutsch</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">Saat Formatı</label>
                    <select
                      value={phonePrefs.time_format}
                      onChange={(e) => setPhonePrefs((p) => ({ ...p, time_format: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
                    >
                      <option value="24">24 Saat (14:30)</option>
                      <option value="12">12 Saat (02:30 PM)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">Tarih Formatı</label>
                    <select
                      value={phonePrefs.date_format}
                      onChange={(e) => setPhonePrefs((p) => ({ ...p, date_format: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
                    >
                      <option value="DD.MM.YYYY">GG.AA.YYYY</option>
                      <option value="DD/MM/YYYY">GG/AA/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-AA-GG</option>
                      <option value="MM/DD/YYYY">AA/GG/YYYY</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">Işık Kapanma</label>
                    <select
                      value={phonePrefs.backlight_timeout}
                      onChange={(e) => setPhonePrefs((p) => ({ ...p, backlight_timeout: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
                    >
                      <option value={0}>Sürekli Açık</option>
                      <option value={15}>15 Saniye</option>
                      <option value={30}>30 Saniye</option>
                      <option value={60}>1 Dakika</option>
                      <option value={300}>5 Dakika</option>
                    </select>
                  </div>
                </div>

                {/* Backlight sliders */}
                <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-950/30">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-600 dark:text-slate-300">Aktif Ekran Parlaklığı (Canlı Önizlenir)</span>
                      <span className={`font-mono font-extrabold ${text}`}>{phonePrefs.backlight_active * 10}%</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={phonePrefs.backlight_active}
                      onChange={(e) => setPhonePrefs((p) => ({ ...p, backlight_active: Number(e.target.value) }))}
                      className="w-full accent-primary cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-600 dark:text-slate-300">Bekleme (Idle) Parlaklığı</span>
                      <span className={`font-mono font-extrabold ${text}`}>{phonePrefs.backlight_inactive * 10}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={phonePrefs.backlight_inactive}
                      onChange={(e) => setPhonePrefs((p) => ({ ...p, backlight_inactive: Number(e.target.value) }))}
                      className="w-full accent-primary cursor-pointer"
                    />
                  </div>
                </div>

                {/* LED & DND Toggles */}
                <div className="space-y-2">
                  {[
                    { key: "missed_call_led", title: "Cevapsız Çağrı Işığı (LED)", desc: "Cevapsız çağrı varken kırmızı LED yanıp sönsün" },
                    { key: "mwi_led", title: "Sesli Posta (MWI) Işığı", desc: "Yeni sesli mesaj varken LED bildirim versin" },
                    { key: "dnd_default", title: "Açılışta Rahatsız Etmeyin (DND)", desc: "Telefon açıldığında varsayılan DND aktif başlasın" },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 cursor-pointer"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-white">{item.title}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{item.desc}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(phonePrefs[item.key])}
                        onChange={(e) => setPhonePrefs((p) => ({ ...p, [item.key]: e.target.checked }))}
                        className="h-4 w-4 rounded accent-primary cursor-pointer shrink-0"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ========================================================== */}
            {/* TAB 4: PROVISIONING URLS & LIVE DEVICE DETAILS             */}
            {/* ========================================================== */}
            {inspectorTab === "info" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Marka / Model:</span>
                    <strong className="text-slate-800 dark:text-white">{brand} {model}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">PJSIP Endpoint:</span>
                    <strong className="font-mono text-slate-800 dark:text-white">{sipUsername || ext}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">MAC Adresi:</span>
                    <strong className="font-mono text-slate-800 dark:text-white">{macAddress || "—"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ağ Modu / SIP Sunucu:</span>
                    <strong className="font-mono text-slate-800 dark:text-white">
                      {String(provUrls.effective_mode || "lan").toUpperCase()} • {provUrls.pbx_host || "—"}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Son Provizyon Çekimi:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {lastProvisionedAt || "Henüz çekilmedi"} {lastProvisionedIp ? `(${lastProvisionedIp})` : ""}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Takılı Meşguliyet Modülü:</span>
                    <strong className="text-slate-800 dark:text-white">
                      {expansionModules.length} adet ({expansionModules.map((m) => m.model).join(", ") || "Yok"})
                    </strong>
                  </div>
                </div>

                {/* Copyable Provisioning URLs */}
                {[
                  { key: "active", label: "Aktif Oto-Provizyon URL'si", val: provUrls.active },
                  { key: "lan", label: "Yerel Ağ (LAN / DHCP Option 66) URL", val: provUrls.lan },
                  { key: "wan", label: "Uzak Ağ (WAN / Dış IP) URL", val: provUrls.wan },
                ]
                  .filter((u) => u.val)
                  .map((u) => (
                    <div key={u.key} className="space-y-1">
                      <div className="text-[10px] font-black uppercase text-slate-400">{u.label}</div>
                      <div className="flex items-center gap-1.5">
                        <input
                          readOnly
                          value={u.val}
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopyText(u.key, u.val)}
                          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 cursor-pointer"
                          title="Kopyala"
                        >
                          {copiedUrlKey === u.key ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>
                  ))}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleOpenCfgPreview}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <FileCode2 size={14} />
                    <span>Kodu İncele</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadConfig}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Download size={14} />
                    <span>.CFG / .XML İndir</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* ACTIVE CALL SAFETY WARNING MODAL (NEVER BROWSER confirm())       */}
      {/* ================================================================ */}
      {activeCallWarning && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">
                  Aktif Görüşme Tespit Edildi
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {activeCallWarning.message}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveCallWarning(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveCallWarning(null);
                  handleSaveAndApply("save_only", false);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
              >
                Sadece Kaydet (Reboot Yapma)
              </button>
              <button
                type="button"
                onClick={() => {
                  const m = activeCallWarning.applyMode;
                  setActiveCallWarning(null);
                  handleSaveAndApply(m, true);
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold cursor-pointer"
              >
                Yine de Yeniden Başlat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* AUTO-FILL EXPANSION MODULE MODAL                                 */}
      {/* ================================================================ */}
      {autoFillModalModIdx !== null && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wand2 size={18} className="text-emerald-500" />
                <h3 className="text-sm font-black text-slate-800 dark:text-white">
                  Modül #{autoFillModalModIdx} — Otomatik BLF Doldurma
                </h3>
              </div>
              <button onClick={() => setAutoFillModalModIdx(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Seçtiğiniz departmandaki (veya tüm santraldeki) dahililer bu meşguliyet modülünün tuşlarına{" "}
              <strong className="text-emerald-600 dark:text-emerald-400">Otomatik Santral İsimli BLF</strong> olarak sırayla atanır.
            </p>
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300">Kaynak Seçimi</label>
              <select
                value={autoFillDept}
                onChange={(e) => setAutoFillDept(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
              >
                <option value="__ALL__">Tüm Santral Dahilileri ({directoryUsers.filter((u) => u.extension !== ext).length} kişi)</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    Departman: {d} ({directoryUsers.filter((u) => u.department === d && u.extension !== ext).length} kişi)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAutoFillModalModIdx(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleExecuteAutoFillModule}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold text-white cursor-pointer ${bg} ${hover}`}
              >
                Modülü Otomatik Doldur
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* LIVE PROVISIONING CODE (.CFG / .XML) PREVIEW MODAL               */}
      {/* ================================================================ */}
      {cfgPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileCode2 size={16} className={text} />
                <span className="text-sm font-black text-slate-800 dark:text-white">
                  Canlı Oto-Provizyon Çıktısı — <span className="font-mono">{cfgPreviewModal.filename}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyText("preview_cfg", cfgPreviewModal.content)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {copiedUrlKey === "preview_cfg" ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  Kopyala
                </button>
                <button
                  type="button"
                  onClick={handleDownloadConfig}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white cursor-pointer ${bg} ${hover}`}
                >
                  <Download size={13} />
                  İndir
                </button>
                <button onClick={() => setCfgPreviewModal(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={16} />
                </button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto p-4 bg-slate-950 text-emerald-300 text-[11px] font-mono leading-relaxed">
              {cfgPreviewModal.content}
            </pre>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal for Expansion Module Removal */}
      <ConfirmDeleteModal
        isOpen={deleteModConfirmIdx !== null}
        title="Meşguliyet Modülünü Kaldır"
        message={`Modül #${deleteModConfirmIdx} ve üzerindeki tüm tuş tanımları kaldırılacak. Onaylıyor musunuz?`}
        onConfirm={handleConfirmDeleteExpansionModule}
        onClose={() => setDeleteModConfirmIdx(null)}
      />
    </div>
  );
}
