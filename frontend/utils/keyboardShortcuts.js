export const SHORTCUT_ACTIONS_CATALOG = [
  {
    id: "answer_call",
    category: "Çağrı Kontrolü",
    label: "Gelen Çağrıyı Yanıtla",
    description: "Çalan Web Telefon çağrısını fareye dokunmadan anında açar.",
    defaultCombo: "Alt+KeyA",
  },
  {
    id: "hangup_call",
    category: "Çağrı Kontrolü",
    label: "Aktif Çağrıyı Kapat / Reddet",
    description: "Görüşmedeki veya çalan çağrıyı sonlandırır.",
    defaultCombo: "Alt+KeyH",
  },
  {
    id: "toggle_mute",
    category: "Çağrı Kontrolü",
    label: "Mikrofonu Sustur / Sesi Aç",
    description: "Aktif görüşmede mikrofonunuzu sessize alır veya geri açar.",
    defaultCombo: "Alt+KeyM",
  },
  {
    id: "toggle_hold",
    category: "Çağrı Kontrolü",
    label: "Çağrıyı Beklemeye Al / Devam Et",
    description: "Müşteriyi bekleme müziğine alır veya görüşmeye geri döner.",
    defaultCombo: "Alt+KeyP",
  },
  {
    id: "status_available",
    category: "Durum & Mola",
    label: "Durum: Müsait (Çağrıya Hazır)",
    description: "Temsilci profilinizi anında Müsait durumuna geçirir.",
    defaultCombo: "Alt+Digit1",
  },
  {
    id: "status_away",
    category: "Durum & Mola",
    label: "Durum: Kısa Mola / Uzakta",
    description: "Temsilci profilinizi hızlıca Mola / Uzakta durumuna alır.",
    defaultCombo: "Alt+Digit2",
  },
  {
    id: "status_meeting",
    category: "Durum & Mola",
    label: "Durum: Toplantıda / Meşgul",
    description: "Temsilci profilinizi Toplantıda / Rahatsız Etmeyin moduna alır.",
    defaultCombo: "Alt+Digit3",
  },
  {
    id: "open_webphone",
    category: "Hızlı Gezinme",
    label: "Web Telefon Ekranını Aç",
    description: "Hangi ekranda olursanız olun Çağrı Paneli > Web Telefon sekmesine geçer.",
    defaultCombo: "Alt+KeyW",
  },
  {
    id: "open_notifications",
    category: "Hızlı Gezinme",
    label: "Canlı Bildirim Merkezini Aç / Kapat",
    description: "Üst bardaki bildirim çekmecesini açar veya kapatır.",
    defaultCombo: "Alt+KeyN",
  },
  {
    id: "open_customer_360",
    category: "Hızlı Gezinme",
    label: "Aktif Arayanın Müşteri 360° Kartını Aç",
    description: "Görüşmedeki veya son arayan numaranın 360° müşteri geçmişini açar.",
    defaultCombo: "Alt+KeyC",
  },
];

export function resolveEffectiveShortcutsMap(customMap = {}) {
  const result = {};
  for (const item of SHORTCUT_ACTIONS_CATALOG) {
    const customVal = customMap && typeof customMap[item.id] === "string" ? customMap[item.id].trim() : "";
    result[item.id] = customVal !== undefined && customMap && Object.prototype.hasOwnProperty.call(customMap, item.id)
      ? customVal
      : item.defaultCombo;
  }
  return result;
}

export function eventToShortcutCombo(e) {
  if (!e || !e.code) return "";
  const ignoredCodes = new Set([
    "ShiftLeft",
    "ShiftRight",
    "ControlLeft",
    "ControlRight",
    "AltLeft",
    "AltRight",
    "MetaLeft",
    "MetaRight",
  ]);
  if (ignoredCodes.has(e.code)) return "";

  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  // Require at least one modifier key so normal typing never collides
  if (parts.length === 0) return "";

  parts.push(e.code);
  return parts.join("+");
}

export function formatComboLabel(combo) {
  if (!combo) return "Atanmadı";
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform || "");
  return combo
    .split("+")
    .map((part) => {
      if (part === "Alt") return isMac ? "⌥ Opt" : "Alt";
      if (part === "Ctrl") return isMac ? "⌘/⌃" : "Ctrl";
      if (part === "Shift") return "Shift";
      if (part.startsWith("Key")) return part.slice(3).toUpperCase();
      if (part.startsWith("Digit")) return part.slice(5);
      return part;
    })
    .join(" + ");
}

export function isEditableTarget(target) {
  if (!target || typeof target !== "object") return false;
  const tag = (target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  return false;
}
