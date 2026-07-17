import { useState, useEffect } from "react";

// Using dynamic CSS variables (bg-primary) defined in globals.css and tailwind.config.js
export function getThemeColor() {
  return "primary";
}

export function setThemeColor(color) {
  // Compatibility shim for older components. 
  // Actual theme is now managed by ThemeSettings.js using CSS variables.
}

export function getSafeThemeColor(color) {
  if (!color) return "99, 102, 241";
  if (color.includes(",")) return color;
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
  return legacyMap[color.toLowerCase()] || "99, 102, 241";
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
    borderLight: "border-primary/20 dark:border-primary/30"
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
