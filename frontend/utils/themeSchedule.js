export const DEFAULT_THEME_SCHEDULE = {
  mode: "manual", // "manual" | "system" | "schedule"
  darkStart: "19:00",
  darkEnd: "07:00",
};

export function parseHmToMinutes(hm, fallbackMinutes = 1140) {
  if (typeof hm !== "string") return fallbackMinutes;
  const parts = hm.trim().split(":");
  if (parts.length !== 2) return fallbackMinutes;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return fallbackMinutes;
  }
  return h * 60 + m;
}

export function isTimeWithinDarkWindow(darkStart = "19:00", darkEnd = "07:00", now = new Date()) {
  const startMin = parseHmToMinutes(darkStart, 19 * 60);
  const endMin = parseHmToMinutes(darkEnd, 7 * 60);
  const curMin = now.getHours() * 60 + now.getMinutes();

  if (startMin === endMin) {
    return false;
  }
  // Overnight window (e.g. 19:00 -> 07:00)
  if (startMin > endMin) {
    return curMin >= startMin || curMin < endMin;
  }
  // Same-day window (e.g. 00:30 -> 06:30)
  return curMin >= startMin && curMin < endMin;
}

export function resolveEffectiveDarkMode(autoThemeConfig, manualSavedTheme = "light") {
  const cfg = autoThemeConfig && typeof autoThemeConfig === "object" ? autoThemeConfig : DEFAULT_THEME_SCHEDULE;
  const mode = cfg.mode || "manual";

  if (mode === "schedule") {
    return isTimeWithinDarkWindow(cfg.darkStart || "19:00", cfg.darkEnd || "07:00");
  }
  if (mode === "system") {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return manualSavedTheme === "dark";
  }
  return manualSavedTheme === "dark";
}

export function applyDocumentDarkClass(isDark) {
  if (typeof document === "undefined") return;
  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute("content", isDark ? "dark" : "light");
  }
}
