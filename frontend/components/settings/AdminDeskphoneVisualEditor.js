import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  Search,
  Sparkles,
  Lock,
  Wand2,
  Sliders,
  RotateCcw,
  Zap,
  Power,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import DeskphoneVisualSimulator, {
  DSS_KEY_TYPES,
  SOFTKEY_TYPES,
} from "../callcenter/tabs/DeskphoneVisualSimulator";

const FALLBACK_MODEL_SPECS = {
  "yealink:t31p": { brand: "Yealink", model: "T31P", screen: "mono", layout: "left_only", dss_per_page: 2, dss_pages: 1, max_dss: 2, soft_keys: 4, expansion_model: "", max_expansions: 0 },
  "yealink:t31g": { brand: "Yealink", model: "T31G", screen: "mono", layout: "left_only", dss_per_page: 2, dss_pages: 1, max_dss: 2, soft_keys: 4, expansion_model: "", max_expansions: 0 },
  "yealink:t33g": { brand: "Yealink", model: "T33G", screen: "color", layout: "left_only", dss_per_page: 4, dss_pages: 3, max_dss: 12, soft_keys: 4, expansion_model: "", max_expansions: 0 },
  "yealink:t42s": { brand: "Yealink", model: "T42S", screen: "mono", layout: "split", dss_per_page: 6, dss_pages: 1, max_dss: 6, soft_keys: 4, expansion_model: "", max_expansions: 0 },
  "yealink:t43u": { brand: "Yealink", model: "T43U", screen: "mono", layout: "split", dss_per_page: 8, dss_pages: 3, max_dss: 21, soft_keys: 4, expansion_model: "EXP43", max_expansions: 3 },
  "yealink:t46u": { brand: "Yealink", model: "T46U", screen: "color", layout: "split", dss_per_page: 10, dss_pages: 3, max_dss: 27, soft_keys: 4, expansion_model: "EXP43", max_expansions: 3 },
  "yealink:t46s": { brand: "Yealink", model: "T46S", screen: "color", layout: "split", dss_per_page: 10, dss_pages: 3, max_dss: 27, soft_keys: 4, expansion_model: "EXP40", max_expansions: 3 },
  "yealink:t48u": { brand: "Yealink", model: "T48U", screen: "touch", layout: "touch_grid", dss_per_page: 10, dss_pages: 3, max_dss: 29, soft_keys: 4, expansion_model: "EXP43", max_expansions: 3 },
  "yealink:t53w": { brand: "Yealink", model: "T53W", screen: "mono", layout: "split", dss_per_page: 8, dss_pages: 3, max_dss: 21, soft_keys: 4, expansion_model: "EXP50", max_expansions: 3 },
  "yealink:t54w": { brand: "Yealink", model: "T54W", screen: "color", layout: "split", dss_per_page: 10, dss_pages: 3, max_dss: 27, soft_keys: 4, expansion_model: "EXP50", max_expansions: 3 },
  "yealink:t57w": { brand: "Yealink", model: "T57W", screen: "touch", layout: "touch_grid", dss_per_page: 10, dss_pages: 3, max_dss: 29, soft_keys: 4, expansion_model: "EXP50", max_expansions: 3 },
  "yealink:t58w": { brand: "Yealink", model: "T58W", screen: "touch", layout: "touch_grid", dss_per_page: 10, dss_pages: 3, max_dss: 27, soft_keys: 4, expansion_model: "EXP50", max_expansions: 3 },
  "grandstream:grp2612": { brand: "Grandstream", model: "GRP2612", screen: "color", layout: "left_only", dss_per_page: 4, dss_pages: 4, max_dss: 16, soft_keys: 4, expansion_model: "", max_expansions: 0 },
  "grandstream:grp2614": { brand: "Grandstream", model: "GRP2614", screen: "dual_screen", layout: "side_mpk", dss_per_page: 8, dss_pages: 3, max_dss: 24, soft_keys: 4, expansion_model: "", max_expansions: 0 },
  "grandstream:grp2615": { brand: "Grandstream", model: "GRP2615", screen: "color", layout: "split", dss_per_page: 10, dss_pages: 4, max_dss: 40, soft_keys: 4, expansion_model: "GBX20", max_expansions: 4 },
  "grandstream:grp2616": { brand: "Grandstream", model: "GRP2616", screen: "dual_screen", layout: "side_mpk", dss_per_page: 12, dss_pages: 4, max_dss: 48, soft_keys: 4, expansion_model: "GBX20", max_expansions: 4 },
  "fanvil:x3u": { brand: "Fanvil", model: "X3U", screen: "color", layout: "left_only", dss_per_page: 3, dss_pages: 2, max_dss: 6, soft_keys: 4, expansion_model: "", max_expansions: 0 },
  "fanvil:x4u": { brand: "Fanvil", model: "X4U", screen: "dual_screen", layout: "side_mpk", dss_per_page: 6, dss_pages: 5, max_dss: 30, soft_keys: 4, expansion_model: "", max_expansions: 0 },
  "fanvil:x5u": { brand: "Fanvil", model: "X5U", screen: "dual_screen", layout: "side_mpk", dss_per_page: 6, dss_pages: 5, max_dss: 30, soft_keys: 4, expansion_model: "", max_expansions: 0 },
  "fanvil:x6u": { brand: "Fanvil", model: "X6U", screen: "dual_screen", layout: "side_mpk", dss_per_page: 12, dss_pages: 5, max_dss: 60, soft_keys: 4, expansion_model: "", max_expansions: 0 },
  "fanvil:v64": { brand: "Fanvil", model: "V64", screen: "color", layout: "split", dss_per_page: 8, dss_pages: 3, max_dss: 21, soft_keys: 4, expansion_model: "", max_expansions: 0 },
  "fanvil:v65": { brand: "Fanvil", model: "V65", screen: "color", layout: "split", dss_per_page: 10, dss_pages: 5, max_dss: 45, soft_keys: 4, expansion_model: "", max_expansions: 0 },
};

const DEFAULT_SOFTKEYS = [
  { key_index: 1, type: "history", label: "Geçmiş", value: "" },
  { key_index: 2, type: "directory", label: "Rehber", value: "" },
  { key_index: 3, type: "forward", label: "Yönlendir", value: "" },
  { key_index: 4, type: "menu", label: "Menü", value: "" },
];

function normalizeDssArray(ext, maxKeys, existing = []) {
  const count = Math.max(2, Math.min(96, Number(maxKeys || 12)));
  const byIdx = new Map();
  (existing || []).forEach((k, i) => {
    if (!k || typeof k !== "object") return;
    const idx = Number(k.key_index || k.key || i + 1);
    if (idx >= 1) byIdx.set(idx, k);
  });

  return Array.from({ length: count }, (_, i) => {
    const keyIndex = i + 1;
    const found = byIdx.get(keyIndex);
    if (keyIndex === 1) {
      const rawLbl = found && found.type === "line" && found.label ? String(found.label).trim() : "";
      const isLegacyHat = rawLbl.toLowerCase() === `hat ${ext}`.toLowerCase();
      const customLbl = rawLbl && !isLegacyHat ? rawLbl : String(ext || "1000");
      return {
        key: 1,
        key_index: 1,
        type: "line",
        label: customLbl,
        label_mode: "custom",
        value: String(ext || ""),
        pickup_code: "*8",
        extension: "*8",
        locked: true,
      };
    }
    if (found) {
      const pCode = found.pickup_code || found.extension || "*8";
      return {
        key: keyIndex,
        key_index: keyIndex,
        type: found.type || "none",
        label: found.label || "",
        label_mode: found.label_mode || (found.label ? "custom" : "auto"),
        value: found.value || "",
        pickup_code: pCode,
        extension: pCode,
      };
    }
    return {
      key: keyIndex,
      key_index: keyIndex,
      type: "none",
      label: "",
      label_mode: "auto",
      value: "",
      pickup_code: "*8",
      extension: "*8",
    };
  });
}

function normalizeSoftKeys(existing = []) {
  return DEFAULT_SOFTKEYS.map((def) => {
    const found = (existing || []).find((s) => Number(s.key_index || s.key) === def.key_index);
    return found ? { ...def, ...found, key_index: def.key_index } : def;
  });
}

function normalizeExpKeys(totalKeys = 60, existing = []) {
  const byIdx = new Map();
  (existing || []).forEach((k, i) => {
    if (k && typeof k === "object") {
      const idx = Number(k.key_index || k.key || i + 1);
      if (idx >= 1) byIdx.set(idx, k);
    }
  });
  return Array.from({ length: totalKeys }, (_, i) => {
    const idx = i + 1;
    const found = byIdx.get(idx);
    if (found) {
      const pCode = found.pickup_code || found.extension || "*8";
      return {
        key: idx,
        key_index: idx,
        type: found.type || "none",
        label: found.label || "",
        label_mode: found.label_mode || "auto",
        value: found.value || "",
        pickup_code: pCode,
        extension: pCode,
      };
    }
    return {
      key: idx,
      key_index: idx,
      type: "none",
      label: "",
      label_mode: "auto",
      value: "",
      pickup_code: "*8",
      extension: "*8",
    };
  });
}

export default function AdminDeskphoneVisualEditor({
  inspectDraft,
  setInspectDraft,
  extension = "",
  userId = null,
  fullName = "",
  users = [],
  departments = [],
  safeFetch,
  isOnline = false,
  onSyncedDraft,
}) {
  const { bg, hover, text, border, lightBg, borderLight } = useTheme();

  const rawBrand = String(inspectDraft?.brand || "").trim();
  const rawModel = String(inspectDraft?.model || "").trim();
  const hasPhoneModel = Boolean(rawBrand && rawModel);
  const brand = rawBrand || "Yealink";
  const model = rawModel || "T46U";
  const sipUsername = inspectDraft?.sip_username || "";

  const [modelCatalog, setModelCatalog] = useState([]);
  const [expansionCatalog, setExpansionCatalog] = useState({});
  const [selectedKey, setSelectedKey] = useState({ category: "dss", index: 2 });
  const [activeDssPage, setActiveDssPage] = useState(1);
  const [activeExpModuleIndex, setActiveExpModuleIndex] = useState(1);
  const [activeExpPage, setActiveExpPage] = useState(1);
  const [dirSearch, setDirSearch] = useState("");
  const [deleteModConfirmIdx, setDeleteModConfirmIdx] = useState(null);
  const [autoFillModalModIdx, setAutoFillModalModIdx] = useState(null);
  const [autoFillDept, setAutoFillDept] = useState("__ALL__");
  const [pushingMode, setPushingMode] = useState("");
  const [pushBanner, setPushBanner] = useState(null);
  const [activeCallPrompt, setActiveCallPrompt] = useState(null);

  // Fetch exact hardware model & expansion catalog from backend
  useEffect(() => {
    let active = true;
    if (!safeFetch || !extension) return undefined;
    const qs = sipUsername ? `?sip_username=${encodeURIComponent(sipUsername)}` : "";
    safeFetch(`/api/agent/deskphone/${encodeURIComponent(String(extension).trim())}${qs}`)
      .then((res) => (res && res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (Array.isArray(data.model_catalog)) setModelCatalog(data.model_catalog);
        if (data.expansion_catalog && typeof data.expansion_catalog === "object") {
          setExpansionCatalog(data.expansion_catalog);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [safeFetch, extension, sipUsername]);

  const activeModelSpec = useMemo(() => {
    const bLow = String(brand || "Yealink").trim().toLowerCase();
    const mLow = String(model || "T46U").trim().toLowerCase();
    const fromApi =
      modelCatalog.find((c) => c.brand.toLowerCase() === bLow && c.model.toLowerCase() === mLow) ||
      modelCatalog.find((c) => c.brand.toLowerCase() === bLow && mLow.includes(c.model.toLowerCase()));
    if (fromApi) return fromApi;

    const fbExact = FALLBACK_MODEL_SPECS[`${bLow}:${mLow}`];
    if (fbExact) return fbExact;

    const fbBrand = Object.values(FALLBACK_MODEL_SPECS).find((s) => s.brand.toLowerCase() === bLow);
    return (
      fbBrand || {
        brand,
        model,
        screen: "color",
        layout: "split",
        dss_per_page: 10,
        dss_pages: 3,
        max_dss: 27,
        soft_keys: 4,
        expansion_model: "",
        max_expansions: 0,
      }
    );
  }, [modelCatalog, brand, model]);

  const extNameMap = useMemo(() => {
    const map = {};
    (users || []).forEach((u) => {
      if (u && u.extension) {
        map[String(u.extension).trim()] = u.full_name || u.name || String(u.extension);
      }
    });
    return map;
  }, [users]);

  const deptNameById = useMemo(() => {
    const m = {};
    (departments || []).forEach((d) => {
      if (d && d.id !== undefined) m[String(d.id)] = d.name || "";
    });
    return m;
  }, [departments]);

  const directoryUsers = useMemo(() => {
    return (users || [])
      .filter((u) => u && u.extension && u.is_active !== false)
      .map((u) => ({
        extension: String(u.extension).trim(),
        name: u.full_name || u.name || String(u.extension),
        department: u.department_name || deptNameById[String(u.department_id || "")] || "",
      }))
      .sort((a, b) => a.extension.localeCompare(b.extension, undefined, { numeric: true }));
  }, [users, deptNameById]);

  const directoryDepts = useMemo(() => {
    const s = new Set();
    directoryUsers.forEach((u) => {
      if (u.department) s.add(u.department);
    });
    return Array.from(s).sort();
  }, [directoryUsers]);

  const filteredDirectory = useMemo(() => {
    const q = dirSearch.trim().toLowerCase();
    return directoryUsers.filter(
      (u) =>
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.extension.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q)
    );
  }, [directoryUsers, dirSearch]);

  const dssKeys = useMemo(
    () => normalizeDssArray(extension, activeModelSpec.max_dss, inspectDraft?.dss_keys || []),
    [extension, activeModelSpec.max_dss, inspectDraft?.dss_keys]
  );

  const softKeys = useMemo(
    () => normalizeSoftKeys(inspectDraft?.soft_keys || []),
    [inspectDraft?.soft_keys]
  );

  const expansionModules = useMemo(() => {
    const rawMods = Array.isArray(inspectDraft?.expansion_modules) ? inspectDraft.expansion_modules : [];
    return rawMods.map((mod, idx) => {
      const mModel = mod.model || activeModelSpec.expansion_model || "EXP43";
      const total = expansionCatalog[mModel]?.total_keys || 60;
      return {
        module_index: Number(mod.module_index || idx + 1),
        model: mModel,
        keys: normalizeExpKeys(total, mod.keys || []),
      };
    });
  }, [inspectDraft?.expansion_modules, activeModelSpec.expansion_model, expansionCatalog]);

  const commitDssKeys = useCallback(
    (nextDss) => {
      setInspectDraft((prev) => (prev ? { ...prev, dss_keys: nextDss } : prev));
    },
    [setInspectDraft]
  );

  const commitSoftKeys = useCallback(
    (nextSoft) => {
      setInspectDraft((prev) => (prev ? { ...prev, soft_keys: nextSoft } : prev));
    },
    [setInspectDraft]
  );

  const commitExpansionModules = useCallback(
    (nextMods) => {
      setInspectDraft((prev) => (prev ? { ...prev, expansion_modules: nextMods } : prev));
    },
    [setInspectDraft]
  );

  const currentEditingItem = useMemo(() => {
    if (selectedKey.category === "soft") {
      return softKeys.find((s) => s.key_index === selectedKey.index) || softKeys[0];
    }
    if (selectedKey.category === "exp") {
      const mod = expansionModules.find((m) => m.module_index === selectedKey.moduleIndex);
      return mod?.keys.find((k) => k.key_index === selectedKey.index) || null;
    }
    return dssKeys.find((k) => k.key_index === selectedKey.index) || dssKeys[0];
  }, [selectedKey, dssKeys, softKeys, expansionModules]);

  const isPrimaryLineLocked = selectedKey.category === "dss" && Number(selectedKey.index) === 1;
  const editingTypeMeta = DSS_KEY_TYPES.find((t) => t.id === currentEditingItem?.type);
  const isTargetExtInDirectory = Boolean(
    currentEditingItem?.value && extNameMap[String(currentEditingItem.value).trim()]
  );

  const updateCurrentKeyField = useCallback(
    (field, val) => {
      if (selectedKey.category === "dss" && Number(selectedKey.index) === 1 && field !== "label") {
        return;
      }

      if (selectedKey.category === "soft") {
        const nextSoft = softKeys.map((s) => {
          if (s.key_index !== selectedKey.index) return s;
          const next = { ...s, [field]: val };
          if (field === "type") {
            const meta = SOFTKEY_TYPES.find((t) => t.id === val);
            if (meta) next.label = meta.defaultLabel;
          }
          return next;
        });
        commitSoftKeys(nextSoft);
        return;
      }

      const patchKeyItem = (item) => {
        const next = { ...item, [field]: val };
        if (field === "pickup_code") next.extension = val;
        if (field === "type") {
          if (val === "none") {
            next.label = "";
            next.value = "";
            next.label_mode = "auto";
          } else if (val === "line") {
            next.value = String(extension || "");
            next.label = next.label || String(extension || "Hat 1");
            next.label_mode = "custom";
          } else if (val === "voicemail") {
            next.value = "*97";
            next.label = next.label || "Sesli Posta";
            next.label_mode = "custom";
          } else if (val === "dnd") {
            next.value = "";
            next.label = next.label || "DND";
            next.label_mode = "custom";
          } else if (val === "pickup") {
            next.value = "*8";
            next.label = next.label || "Çağrı Çek";
            next.label_mode = "custom";
          } else if (val === "hold") {
            next.label = next.label || "Beklet";
            next.label_mode = "custom";
          } else if (val === "conference") {
            next.label = next.label || "Konferans";
            next.label_mode = "custom";
          }
        }
        if (field === "value" && next.label_mode === "auto") {
          const cleanExt = String(val || "").trim();
          if (extNameMap[cleanExt]) {
            next.label = extNameMap[cleanExt];
          }
        }
        if (field === "label_mode" && val === "auto") {
          const cleanExt = String(next.value || "").trim();
          if (extNameMap[cleanExt]) {
            next.label = extNameMap[cleanExt];
          }
        }
        return next;
      };

      if (selectedKey.category === "exp") {
        const nextMods = expansionModules.map((m) =>
          m.module_index === selectedKey.moduleIndex
            ? { ...m, keys: m.keys.map((k) => (k.key_index === selectedKey.index ? patchKeyItem(k) : k)) }
            : m
        );
        commitExpansionModules(nextMods);
        return;
      }

      const nextDss = dssKeys.map((k) => (k.key_index === selectedKey.index ? patchKeyItem(k) : k));
      commitDssKeys(nextDss);
    },
    [
      selectedKey,
      softKeys,
      dssKeys,
      expansionModules,
      extension,
      extNameMap,
      commitDssKeys,
      commitSoftKeys,
      commitExpansionModules,
    ]
  );

  const assignDirectoryUserToCurrentKey = useCallback(
    (dirUser) => {
      if (!dirUser || isPrimaryLineLocked) return;
      const targetExt = String(dirUser.extension || "");
      const targetName = dirUser.name || targetExt;

      const patchDir = (k) => ({
        ...k,
        type: k.type === "none" || k.type === "line" ? "blf" : k.type,
        value: targetExt,
        label: targetName,
        label_mode: "auto",
        pickup_code: k.pickup_code || "*8",
        extension: k.pickup_code || "*8",
      });

      if (selectedKey.category === "exp") {
        const nextMods = expansionModules.map((m) =>
          m.module_index === selectedKey.moduleIndex
            ? { ...m, keys: m.keys.map((k) => (k.key_index === selectedKey.index ? patchDir(k) : k)) }
            : m
        );
        commitExpansionModules(nextMods);
      } else if (selectedKey.category === "dss") {
        const nextDss = dssKeys.map((k) => (k.key_index === selectedKey.index ? patchDir(k) : k));
        commitDssKeys(nextDss);
      }
    },
    [selectedKey, isPrimaryLineLocked, dssKeys, expansionModules, commitDssKeys, commitExpansionModules]
  );

  const handleAutoFillMainPhoneBlf = () => {
    const peers = directoryUsers.filter((u) => String(u.extension) !== String(extension).trim());
    let pIdx = 0;
    const nextDss = dssKeys.map((k) => {
      if (k.key_index === 1) return k; // Keep T1 locked primary line
      if (pIdx < peers.length) {
        const peer = peers[pIdx++];
        return {
          ...k,
          type: "blf",
          value: peer.extension,
          label: peer.name,
          label_mode: "auto",
          pickup_code: "*8",
          extension: "*8",
        };
      }
      return {
        ...k,
        type: "none",
        value: "",
        label: "",
        label_mode: "auto",
      };
    });
    commitDssKeys(nextDss);
  };

  const handleClearAllMainBlf = () => {
    const nextDss = dssKeys.map((k) =>
      k.key_index === 1
        ? k
        : { ...k, type: "none", value: "", label: "", label_mode: "auto" }
    );
    commitDssKeys(nextDss);
  };

  const handleAddExpansionModule = () => {
    const maxExp = Number(activeModelSpec.max_expansions || 0);
    if (maxExp <= 0 || expansionModules.length >= maxExp) return;
    const expModel = activeModelSpec.expansion_model || "EXP43";
    const totalKeys = expansionCatalog[expModel]?.total_keys || 60;
    const nextIdx = expansionModules.length + 1;
    const newMod = {
      module_index: nextIdx,
      model: expModel,
      keys: normalizeExpKeys(totalKeys, []),
    };
    commitExpansionModules([...expansionModules, newMod]);
    setActiveExpModuleIndex(nextIdx);
    setActiveExpPage(1);
    setSelectedKey({ category: "exp", moduleIndex: nextIdx, index: 1 });
  };

  const handleConfirmDeleteExpansionModule = () => {
    if (deleteModConfirmIdx == null) return;
    const remaining = expansionModules
      .filter((m) => m.module_index !== deleteModConfirmIdx)
      .map((m, i) => ({ ...m, module_index: i + 1 }));
    commitExpansionModules(remaining);
    setDeleteModConfirmIdx(null);
    if (selectedKey.category === "exp") {
      setSelectedKey({ category: "dss", index: Math.min(2, dssKeys.length) });
    }
    setActiveExpModuleIndex(1);
    setActiveExpPage(1);
  };

  const handleConfirmAutoFillExpansion = () => {
    if (autoFillModalModIdx == null) return;
    const pool = directoryUsers.filter(
      (u) =>
        String(u.extension) !== String(extension).trim() &&
        (autoFillDept === "__ALL__" || u.department === autoFillDept)
    );
    const nextMods = expansionModules.map((m) => {
      if (m.module_index !== autoFillModalModIdx) return m;
      const newKeys = m.keys.map((k, idx) => {
        if (idx < pool.length) {
          return {
            ...k,
            type: "blf",
            value: pool[idx].extension,
            label: pool[idx].name,
            label_mode: "auto",
            pickup_code: "*8",
            extension: "*8",
          };
        }
        return k;
      });
      return { ...m, keys: newKeys };
    });
    commitExpansionModules(nextMods);
    setAutoFillModalModIdx(null);
  };

  const handlePushToPhone = async (applyMode = "check_sync", forceOnCall = false) => {
    if (!safeFetch || !extension) {
      setPushBanner({ ok: false, message: "Dahili numara tanımlı olmadığı için cihaza gönderilemedi." });
      return;
    }
    setPushingMode(applyMode);
    setPushBanner(null);
    setActiveCallPrompt(null);
    try {
      const cleanExpModules = expansionModules.map((m) => ({
        module_index: m.module_index,
        model: m.model,
        keys: (m.keys || []).filter((k) => k.type !== "none"),
      }));
      const res = await safeFetch(`/api/agent/deskphone/${encodeURIComponent(String(extension).trim())}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extension: String(extension).trim(),
          user_id: userId,
          device_id: inspectDraft?.id,
          sip_username: sipUsername,
          brand: rawBrand,
          model: rawModel,
          dss_keys: dssKeys,
          soft_keys: softKeys,
          expansion_modules: cleanExpModules,
          phone_prefs: inspectDraft?.phone_prefs || {},
          apply_mode: applyMode,
          force_reboot_on_call: forceOnCall,
        }),
      });
      const rawText = await res.text();
      let data = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error(res.ok ? "Sunucudan geçersiz yanıt alındı." : `HTTP ${res.status}`);
      }
      if (!res.ok) throw new Error(data.detail || "Ayarlar cihaza gönderilemedi.");

      if (data.status === "active_call_warning") {
        setActiveCallPrompt({ applyMode, message: data.message });
        return;
      }

      const updatedDraft = {
        ...inspectDraft,
        brand: rawBrand,
        model: rawModel,
        dss_keys: dssKeys,
        soft_keys: softKeys,
        expansion_modules: expansionModules,
      };
      if (typeof onSyncedDraft === "function") {
        onSyncedDraft(updatedDraft);
      }
      setPushBanner({
        ok: data.notified !== false,
        message: data.message || "BLF tuşları kaydedildi ve telefona gönderildi.",
      });
    } catch (err) {
      setPushBanner({ ok: false, message: err?.message || "Telefona gönderilirken hata oluştu." });
    } finally {
      setPushingMode("");
    }
  };

  return (
    <div className="space-y-4">
      {!hasPhoneModel ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/40 p-8 text-center space-y-2.5">
          <div className={`w-11 h-11 rounded-2xl mx-auto flex items-center justify-center border ${borderLight} ${lightBg} ${text}`}>
            <Sliders size={20} />
          </div>
          <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
            Telefon Marka / Modeli Henüz Eşleştirilmedi
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
            Bu SIP cihazına henüz <strong>Oto Provizyon</strong> üzerinden fiziksel bir IP telefon atanmamış.{" "}
            <strong>Santral → Oto Provizyon</strong> ekranından cihazı bu SIP hesabıyla eşleştirdiğinizde (veya{" "}
            <strong>Cihaz &amp; Ağ Detayları</strong> sekmesinden marka/model seçtiğinizde) ilgili telefonun gerçek görselli canlı BLF tasarımcısı otomatik açılır.
          </p>
        </div>
      ) : (
      <>
      {/* Compact Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${borderLight} ${lightBg} ${text}`}>
            <Sliders size={12} />
            {brand} {model}
          </span>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            • {activeModelSpec.max_dss} DSS Tuşu
            {activeModelSpec.max_expansions > 0 ? ` • ${activeModelSpec.expansion_model} (×${activeModelSpec.max_expansions})` : ""}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={Boolean(pushingMode)}
            onClick={handleClearAllMainBlf}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
            title="Ana telefonun T2..Tson tuşlarını temizle (T1 kilitli kalır)"
          >
            <RotateCcw size={12} />
            <span>Temizle</span>
          </button>
          <button
            type="button"
            disabled={Boolean(pushingMode)}
            onClick={handleAutoFillMainPhoneBlf}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
            title="Sistemdeki dahilileri sırayla otomatik BLF olarak doldur"
          >
            <Wand2 size={12} />
            <span>Otomatik BLF</span>
          </button>
          <button
            type="button"
            disabled={Boolean(pushingMode)}
            onClick={() => handlePushToPhone("check_sync", false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-extrabold border border-emerald-300 dark:border-emerald-700/70 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition cursor-pointer disabled:opacity-50"
            title="BLF tuşlarını kaydet ve telefonu yeniden başlatmadan anında gönder (SIP Check-Sync)"
          >
            {pushingMode === "check_sync" ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
            <span>{pushingMode === "check_sync" ? "Gönderiliyor..." : "Hızlı Uygula"}</span>
          </button>
          <button
            type="button"
            disabled={Boolean(pushingMode)}
            onClick={() => handlePushToPhone("reboot", false)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-extrabold text-white ${bg} ${hover} shadow-sm transition cursor-pointer disabled:opacity-50`}
            title="BLF tuşlarını kaydet, telefona gönder ve cihazı yeniden başlat (SIP Reboot)"
          >
            {pushingMode === "reboot" ? <RefreshCw size={12} className="animate-spin" /> : <Power size={12} />}
            <span>{pushingMode === "reboot" ? "Gönderiliyor..." : "Telefona Gönder & Yeniden Başlat"}</span>
          </button>
        </div>
      </div>

      {/* Push Delivery Status Banner */}
      {pushBanner && (
        <div
          className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold ${
            pushBanner.ok
              ? "bg-emerald-50 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-200"
              : "bg-amber-50 dark:bg-amber-950/35 border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-200"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {pushBanner.ok ? <CheckCircle size={14} className="shrink-0 text-emerald-500" /> : <AlertTriangle size={14} className="shrink-0 text-amber-500" />}
            <span className="leading-snug">{pushBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setPushBanner(null)}
            className="text-[11px] opacity-70 hover:opacity-100 shrink-0 cursor-pointer"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Active Call Confirmation Banner before Reboot */}
      {activeCallPrompt && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-xs font-bold text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={14} className="shrink-0 text-amber-500" />
            <span>{activeCallPrompt.message}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveCallPrompt(null)}
              className="px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 text-[11px] font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => handlePushToPhone(activeCallPrompt.applyMode, true)}
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-extrabold cursor-pointer"
            >
              Yine de Yeniden Başlat
            </button>
          </div>
        </div>
      )}

      {/* Main Visual Phone Designer + Key Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT 7 COLS: Exact same model-accurate visual phone simulator */}
        <div className="lg:col-span-7">
          <DeskphoneVisualSimulator
            brand={brand}
            model={model}
            modelSpec={activeModelSpec}
            ext={extension || "1000"}
            fullName={fullName || `Dahili ${extension || "1000"}`}
            dssKeys={dssKeys}
            softKeys={softKeys}
            expansionModules={expansionModules}
            expansionCatalog={expansionCatalog}
            phonePrefs={inspectDraft?.phone_prefs || {}}
            extNameMap={extNameMap}
            selectedKey={selectedKey}
            onSelectKey={(sel) => setSelectedKey(sel)}
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
            liveOnline={isOnline}
          />
        </div>

        {/* RIGHT 5 COLS: Interactive Key Inspector */}
        <div className={`lg:col-span-5 rounded-2xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden ${borderLight}`}>
          <div className="p-4 space-y-3.5">
            {currentEditingItem && (
              <>
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {selectedKey.category === "soft"
                        ? `Ekran Altı Softkey • F${selectedKey.index}`
                        : selectedKey.category === "exp"
                        ? `Meşguliyet Modülü #${selectedKey.moduleIndex} • Tuş ${selectedKey.index}`
                        : `Ana Telefon DSS Tuşu • Tuş ${selectedKey.index}`}
                    </div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-white mt-0.5 truncate">
                      {selectedKey.category === "soft"
                        ? currentEditingItem.label || `Alt Tuş ${selectedKey.index}`
                        : currentEditingItem.label || editingTypeMeta?.name || "Boş Tuş"}
                    </h3>
                  </div>

                  {selectedKey.category !== "soft" && currentEditingItem.type !== "none" && !isPrimaryLineLocked && (
                    <button
                      type="button"
                      onClick={() => updateCurrentKeyField("type", "none")}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition cursor-pointer shrink-0"
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
                  <div className="p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/25 text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed flex items-start gap-2">
                    <Lock size={13} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span>
                      <strong>T1 (Ana Hat)</strong> kullanıcının dahili hattıdır (<span className="font-mono font-bold">{extension}</span>). Silinemez; yalnızca ekran etiketi özelleştirilebilir.
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
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {editingTypeMeta.desc}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Target Value */}
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
                      placeholder="Örn: 1005 veya 0532..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                )}

                {/* Screen Label with Auto / Manual toggle */}
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
                      <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                        <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 truncate">
                          {extNameMap[String(currentEditingItem.value).trim()]}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                          Santralden Canlı
                        </span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={currentEditingItem.label || ""}
                        onChange={(e) => updateCurrentKeyField("label", e.target.value)}
                        placeholder={
                          isTargetExtInDirectory
                            ? `Özel isim yazın (Santral: ${extNameMap[String(currentEditingItem.value).trim()]})`
                            : "Ekranda görünecek isim (Örn: Satış)"
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

                {/* BLF Call Pickup Prefix */}
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

                {/* 1-Click Directory Assignment */}
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
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
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
                            className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-left transition cursor-pointer ${
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
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Auto-Fill Expansion Module Modal */}
      {autoFillModalModIdx != null && (
        <div className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${lightBg} ${text}`}>
                <Wand2 size={17} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 dark:text-white">
                  Modül #{autoFillModalModIdx} — Rehberden Otomatik BLF Doldur
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Seçilen departmandaki dahililer sırayla modül tuşlarına atanır.
                </p>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1.5">
                Departman Filtresi
              </label>
              <select
                value={autoFillDept}
                onChange={(e) => setAutoFillDept(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
              >
                <option value="__ALL__">Tüm Şirket Dahilileri ({directoryUsers.length})</option>
                {directoryDepts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAutoFillModalModIdx(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmAutoFillExpansion}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold text-white ${bg} hover:opacity-90 cursor-pointer`}
              >
                Otomatik Doldur
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal for Sidecar Module */}
      <ConfirmDeleteModal
        isOpen={deleteModConfirmIdx != null}
        onClose={() => setDeleteModConfirmIdx(null)}
        onConfirm={handleConfirmDeleteExpansionModule}
        title="Meşguliyet Modülünü Kaldır"
        message={`Meşguliyet Modülü #${deleteModConfirmIdx || 1} ve üzerindeki tuş atamalarını kaldırmak istediğinize emin misiniz?`}
      />
      </>
      )}
    </div>
  );
}
