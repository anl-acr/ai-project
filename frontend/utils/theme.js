import { useState, useEffect } from "react";

// Using dynamic CSS variables (bg-primary) defined in globals.css and tailwind.config.js
export function getThemeColor() {
  return "primary";
}

export function setThemeColor(color) {
  // Compatibility shim for older components. 
  // Actual theme is now managed by ThemeSettings.js using CSS variables.
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
