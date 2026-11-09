export const DEFAULT_PROFILE_FORWARDING = {
  forwarding_always: { active: false, type: "internal", target: "" },
  forwarding_busy: { active: false, type: "internal", target: "" },
  forwarding_no_answer: { active: false, type: "internal", target: "" }
};

export const DEFAULT_USER_PROFILES = [
  {
    id: "available",
    name: "Müsait",
    digit: "1",
    devices: ["desk_phone", "mobile_app", "web_phone", "pc_app"],
    timeout: 30,
    timeout_action: "none",
    timeout_target: "",
    forwarding_always: { active: false, type: "internal", target: "" },
    forwarding_busy: { active: false, type: "internal", target: "" },
    forwarding_no_answer: { active: false, type: "internal", target: "" }
  },
  {
    id: "away",
    name: "Dışarıda",
    digit: "2",
    devices: ["mobile_app"],
    timeout: 25,
    timeout_action: "none",
    timeout_target: "",
    forwarding_always: { active: false, type: "internal", target: "" },
    forwarding_busy: { active: false, type: "internal", target: "" },
    forwarding_no_answer: { active: false, type: "internal", target: "" }
  },
  {
    id: "meeting",
    name: "Toplantı",
    digit: "3",
    devices: [],
    timeout: 15,
    timeout_action: "none",
    timeout_target: "",
    forwarding_always: { active: false, type: "internal", target: "" },
    forwarding_busy: { active: false, type: "internal", target: "" },
    forwarding_no_answer: { active: false, type: "internal", target: "" }
  },
  {
    id: "other",
    name: "Diğer",
    digit: "4",
    devices: ["web_phone"],
    timeout: 30,
    timeout_action: "none",
    timeout_target: "",
    forwarding_always: { active: false, type: "internal", target: "" },
    forwarding_busy: { active: false, type: "internal", target: "" },
    forwarding_no_answer: { active: false, type: "internal", target: "" }
  }
];

export const RING_DEVICES_METADATA = [
  { id: "desk_phone", label: "Masa Telefonu", desc: "IP / SIP masa telefonu cihazı" },
  { id: "mobile_app", label: "Mobil Uygulama", desc: "iOS / Android mobil softphone" },
  { id: "web_phone", label: "Web Telefon", desc: "Tarayıcı içi WebRTC telefon" },
  { id: "pc_app", label: "PC Uygulaması", desc: "Masaüstü softphone uygulaması" }
];

const normalizeForwardingRuleObj = (rawRule) => {
  let obj = rawRule;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch (e) {
      obj = null;
    }
  }
  if (!obj || typeof obj !== "object") {
    return { active: false, type: "internal", target: "" };
  }
  const target = String(obj.target || obj.number || obj.destination || "").trim();
  return {
    active: Boolean(obj.active && target),
    type: obj.type === "external" ? "external" : "internal",
    target
  };
};

export const normalizeUserProfiles = (rawProfiles, fallbackUser = null) => {
  let parsed = rawProfiles;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch (e) {
      parsed = null;
    }
  }
  const activeProfId = fallbackUser?.active_profile || "available";
  const fbAlways = fallbackUser?.forwarding_always ? normalizeForwardingRuleObj(fallbackUser.forwarding_always) : null;
  const fbBusy = fallbackUser?.forwarding_busy ? normalizeForwardingRuleObj(fallbackUser.forwarding_busy) : null;
  const fbNoAns = fallbackUser?.forwarding_no_answer ? normalizeForwardingRuleObj(fallbackUser.forwarding_no_answer) : null;

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return DEFAULT_USER_PROFILES.map((p) => {
      const isSeedTarget = p.id === activeProfId;
      return {
        ...p,
        devices: [...p.devices],
        forwarding_always: isSeedTarget && fbAlways ? { ...fbAlways } : { ...DEFAULT_PROFILE_FORWARDING.forwarding_always },
        forwarding_busy: isSeedTarget && fbBusy ? { ...fbBusy } : { ...DEFAULT_PROFILE_FORWARDING.forwarding_busy },
        forwarding_no_answer: isSeedTarget && fbNoAns ? { ...fbNoAns } : { ...DEFAULT_PROFILE_FORWARDING.forwarding_no_answer }
      };
    });
  }
  const byId = {};
  parsed.forEach((p) => {
    if (p && p.id) byId[p.id] = p;
  });
  return DEFAULT_USER_PROFILES.map((def) => {
    const ex = byId[def.id];
    const isSeedTarget = def.id === activeProfId;
    if (!ex) {
      return {
        ...def,
        devices: [...def.devices],
        forwarding_always: isSeedTarget && fbAlways ? { ...fbAlways } : { ...DEFAULT_PROFILE_FORWARDING.forwarding_always },
        forwarding_busy: isSeedTarget && fbBusy ? { ...fbBusy } : { ...DEFAULT_PROFILE_FORWARDING.forwarding_busy },
        forwarding_no_answer: isSeedTarget && fbNoAns ? { ...fbNoAns } : { ...DEFAULT_PROFILE_FORWARDING.forwarding_no_answer }
      };
    }
    const cleanDigit =
      ex.digit !== undefined && ex.digit !== null && String(ex.digit).trim() !== ""
        ? String(ex.digit).replace(/[^0-9]/g, "").slice(0, 2) || def.digit
        : def.digit;

    const hasOwnForwarding =
      ex.forwarding_always !== undefined ||
      ex.forwarding_busy !== undefined ||
      ex.forwarding_no_answer !== undefined;

    let resolvedNoAns = hasOwnForwarding
      ? normalizeForwardingRuleObj(ex.forwarding_no_answer)
      : isSeedTarget && fbNoAns
        ? { ...fbNoAns }
        : { ...DEFAULT_PROFILE_FORWARDING.forwarding_no_answer };

    if (
      !resolvedNoAns.active &&
      (ex.timeout_action === "internal" || ex.timeout_action === "external") &&
      ex.timeout_target
    ) {
      resolvedNoAns = {
        active: true,
        type: ex.timeout_action,
        target: String(ex.timeout_target).trim()
      };
    }

    return {
      id: def.id,
      name: ex.name || def.name,
      digit: cleanDigit,
      devices: Array.isArray(ex.devices) ? [...ex.devices] : [...def.devices],
      timeout: ex.timeout !== undefined && ex.timeout !== null ? Number(ex.timeout) : def.timeout,
      timeout_action: ex.timeout_action || def.timeout_action,
      timeout_target: ex.timeout_target || "",
      forwarding_always: hasOwnForwarding
        ? normalizeForwardingRuleObj(ex.forwarding_always)
        : isSeedTarget && fbAlways
          ? { ...fbAlways }
          : { ...DEFAULT_PROFILE_FORWARDING.forwarding_always },
      forwarding_busy: hasOwnForwarding
        ? normalizeForwardingRuleObj(ex.forwarding_busy)
        : isSeedTarget && fbBusy
          ? { ...fbBusy }
          : { ...DEFAULT_PROFILE_FORWARDING.forwarding_busy },
      forwarding_no_answer: resolvedNoAns
    };
  });
};
