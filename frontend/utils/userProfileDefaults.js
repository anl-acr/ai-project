export const DEFAULT_USER_PROFILES = [
  {
    id: "available",
    name: "Müsait",
    devices: ["desk_phone", "mobile_app", "web_phone", "pc_app"],
    timeout: 30,
    timeout_action: "voicemail",
    timeout_target: ""
  },
  {
    id: "away",
    name: "Dışarıda",
    devices: ["mobile_app"],
    timeout: 25,
    timeout_action: "external",
    timeout_target: ""
  },
  {
    id: "meeting",
    name: "Toplantı",
    devices: [],
    timeout: 15,
    timeout_action: "voicemail",
    timeout_target: ""
  },
  {
    id: "other",
    name: "Diğer",
    devices: ["web_phone"],
    timeout: 30,
    timeout_action: "none",
    timeout_target: ""
  }
];

export const RING_DEVICES_METADATA = [
  { id: "desk_phone", label: "Masa Telefonu", desc: "IP / SIP masa telefonu cihazı" },
  { id: "mobile_app", label: "Mobil Uygulama", desc: "iOS / Android mobil softphone" },
  { id: "web_phone", label: "Web Telefon", desc: "Tarayıcı içi WebRTC telefon" },
  { id: "pc_app", label: "PC Uygulaması", desc: "Masaüstü softphone uygulaması" }
];

export const normalizeUserProfiles = (rawProfiles) => {
  let parsed = rawProfiles;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch (e) {
      parsed = null;
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return DEFAULT_USER_PROFILES.map((p) => ({ ...p, devices: [...p.devices] }));
  }
  const byId = {};
  parsed.forEach((p) => {
    if (p && p.id) byId[p.id] = p;
  });
  return DEFAULT_USER_PROFILES.map((def) => {
    const ex = byId[def.id];
    if (!ex) return { ...def, devices: [...def.devices] };
    return {
      id: def.id,
      name: ex.name || def.name,
      devices: Array.isArray(ex.devices) ? [...ex.devices] : [...def.devices],
      timeout: ex.timeout !== undefined && ex.timeout !== null ? Number(ex.timeout) : def.timeout,
      timeout_action: ex.timeout_action || def.timeout_action,
      timeout_target: ex.timeout_target || ""
    };
  });
};
