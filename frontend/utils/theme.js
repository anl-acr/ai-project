import { useState, useEffect } from "react";

// Using dynamic CSS variables (bg-primary) defined in globals.css and tailwind.config.js
export function getThemeColor() {
  return "primary";
}

export function setThemeColor(color) {
  // Compatibility shim for older components. 
  // Actual theme is now managed by ThemeSettings.js using CSS variables.
}

export const SYSTEM_THEME_PRESETS = [
  { name: "İndigo", value: "99, 102, 241", hex: "#6366f1" },
  { name: "Kraliyet", value: "37, 99, 235", hex: "#2563eb" },
  { name: "Okyanus", value: "59, 130, 246", hex: "#3b82f6" },
  { name: "Deniz", value: "14, 165, 233", hex: "#0ea5e9" },
  { name: "Turkuaz", value: "6, 182, 212", hex: "#06b6d4" },
  { name: "Petrol", value: "13, 148, 136", hex: "#0d9488" },
  { name: "Zümrüt", value: "16, 185, 129", hex: "#10b981" },
  { name: "Orman", value: "21, 128, 61", hex: "#15803d" },
  { name: "Zeytin", value: "101, 163, 13", hex: "#65a30d" },
  { name: "Güneş", value: "245, 158, 11", hex: "#f59e0b" },
  { name: "Kehribar", value: "217, 119, 6", hex: "#d97706" },
  { name: "Mercan", value: "249, 115, 22", hex: "#f97316" },
  { name: "Turuncu", value: "234, 88, 12", hex: "#ea580c" },
  { name: "Kızılcık", value: "220, 38, 38", hex: "#dc2626" },
  { name: "Gül", value: "225, 29, 72", hex: "#e11d48" },
  { name: "Vişne", value: "190, 18, 60", hex: "#be123c" },
  { name: "Pembe", value: "236, 72, 153", hex: "#ec4899" },
  { name: "Fuşya", value: "217, 70, 239", hex: "#d946ef" },
  { name: "Ametist", value: "168, 85, 247", hex: "#a855f7" },
  { name: "Lavanta", value: "139, 92, 246", hex: "#8b5cf6" },
  { name: "Mürdüm", value: "126, 34, 206", hex: "#7e22ce" },
  { name: "Lacivert", value: "30, 58, 138", hex: "#1e3a8a" },
  { name: "Çikolata", value: "120, 53, 15", hex: "#78350f" },
  { name: "Antrasit", value: "51, 65, 85", hex: "#334155" },
  { name: "Siyah", value: "63, 63, 70", hex: "#3f3f46" },
  { name: "Gece", value: "15, 23, 42", hex: "#0f172a" }
];

export function hexToRgbString(hex) {
  const clean = String(hex || "").replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return `${r}, ${g}, ${b}`;
  } else if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return `${r}, ${g}, ${b}`;
  }
  return "99, 102, 241";
}

export function rgbStringToHex(rgbStr) {
  if (!rgbStr) return "#6366f1";
  const str = String(rgbStr).trim();
  if (str.startsWith("#")) {
    return str.length === 7 ? str.toLowerCase() : "#6366f1";
  }
  const parts = str.split(",").map((n) => parseInt(n.trim(), 10));
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
    const clamp = (v) => Math.max(0, Math.min(255, v));
    return (
      "#" +
      parts
        .map((v) => clamp(v).toString(16).padStart(2, "0"))
        .join("")
        .toLowerCase()
    );
  }
  return "#6366f1";
}

export function getSafeThemeColor(color) {
  if (!color) return "99, 102, 241";
  const str = String(color).trim();
  if (str.startsWith("#")) return hexToRgbString(str);
  if (str.includes(",")) {
    const parts = str.split(",").map((n) => parseInt(n.trim(), 10));
    if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
      return `${parts[0]}, ${parts[1]}, ${parts[2]}`;
    }
    return str;
  }
  const legacyMap = {
    "indigo": "99, 102, 241", "okyanus": "59, 130, 246", "blue": "59, 130, 246",
    "zümrüt": "16, 185, 129", "emerald": "16, 185, 129", "gül": "225, 29, 72",
    "rose": "225, 29, 72", "ametist": "168, 85, 247", "purple": "168, 85, 247",
    "gece": "15, 23, 42", "slate": "15, 23, 42", "güneş": "245, 158, 11",
    "amber": "245, 158, 11", "kızılcık": "220, 38, 38", "red": "220, 38, 38",
    "turkuaz": "6, 182, 212", "cyan": "6, 182, 212", "deniz": "14, 165, 233",
    "sky": "14, 165, 233", "lavanta": "139, 92, 246", "violet": "139, 92, 246",
    "vişne": "190, 18, 60", "turuncu": "234, 88, 12", "orange": "234, 88, 12",
    "orman": "21, 128, 61", "green": "21, 128, 61", "çikolata": "120, 53, 15",
    "siyah": "63, 63, 70"
  };
  return legacyMap[str.toLowerCase()] || "99, 102, 241";
}

export const VALID_UI_TEMPLATES = ["classic", "aurora", "bento", "linear", "oled"];

export const SYSTEM_UI_TEMPLATES = [
  {
    id: "classic",
    name: "AIDA Klasik",
    badge: "Varsayılan",
    desc: "Mevcut dengeli, sade ve hızlı AIDA kurumsal görünümü."
  },
  {
    id: "aurora",
    name: "Aurora Glass",
    badge: "Popüler",
    desc: "Buzlu cam paneller, yumuşak arka plan ışık geçişleri ve parlak kenarlar."
  },
  {
    id: "bento",
    name: "Soft Bento",
    badge: "Apple Tarzı",
    desc: "Yüzen ada menü, yuvarlatılmış geniş kartlar ve yumuşak derinlik gölgeleri."
  },
  {
    id: "linear",
    name: "Linear Crisp",
    badge: "Minimal",
    desc: "Keskin köşeler, gölgesiz net 1px çizgiler ve yüksek veri netliği."
  },
  {
    id: "oled",
    name: "Midnight OLED",
    badge: "Gece / Kontrast",
    desc: "Saf siyah (#04060b) zemin ve tema renginde hafif neon kenar ışıması.",
    autoDark: true
  }
];

export function normalizeUiTemplate(raw) {
  if (typeof raw === "string" && VALID_UI_TEMPLATES.includes(raw.trim())) {
    return raw.trim();
  }
  return "classic";
}

export function applyDocumentUiTemplate(templateId) {
  if (typeof document === "undefined") return;
  const normalized = normalizeUiTemplate(templateId);
  document.documentElement.setAttribute("data-ui-template", normalized);
  try {
    localStorage.setItem("aida_ui_template", normalized);
  } catch (e) {}
}

export function readDocumentUiTemplate() {
  if (typeof document === "undefined") return "classic";
  const attr = document.documentElement.getAttribute("data-ui-template");
  if (attr && VALID_UI_TEMPLATES.includes(attr)) {
    return attr;
  }
  try {
    const saved = localStorage.getItem("aida_ui_template");
    if (saved && VALID_UI_TEMPLATES.includes(saved)) {
      return saved;
    }
  } catch (e) {}
  return "classic";
}

export function useTheme() {
  const theme = {
    bg: "bg-primary",
    hover: "hover:bg-primary/90",
    text: "text-primary",
    border: "border-primary",
    ring: "focus:ring-primary/20",
    lightBg: "bg-primary/5 dark:bg-primary/10",
    lightText: "text-primary dark:text-primary",
    borderLight: "border-slate-200/80 dark:border-slate-800/80"
  };
  
  return {
    colorCode: "primary",
    theme,
    bg: theme.bg,
    hover: theme.hover,
    text: theme.text,
    border: theme.border,
    ring: theme.ring,
    lightBg: theme.lightBg,
    lightText: theme.lightText,
    borderLight: theme.borderLight
  };
}
