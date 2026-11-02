import React, { useEffect } from "react";
import {
  InfoTooltipLayer,
  openInfoTooltip,
  scheduleCloseInfoTooltip,
  toggleInfoTooltip,
  closeInfoTooltipImmediate
} from "./InfoTooltip";

const EXCLUDED_ANCESTOR_SELECTOR = [
  "[data-no-info-collapse='true']",
  ".aida-info-popover",
  ".aida-native-hint-popover",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "ul",
  "ol",
  "pre",
  "code",
  "button",
  "a",
  "nav",
  "[role='alert']",
  "[role='status']",
  "[role='log']",
  "[role='listbox']",
  "[role='menu']",
  ".cursor-pointer",
  ".border-dashed",
  ".text-center"
].join(",");

const EMPTY_OR_SYSTEM_HEADING_RE =
  /^(henüz\b|kayıtlı .* bulun|yetkisiz|işlemi onayla|bu ekran geliştirme|anlamsal arama simülatörü|arama kriterine|sonuç bulun)/i;

const DYNAMIC_VALUE_PREFIX_RE =
  /^(çağrı id|call id|oturum id|id\s*:|ip\s*:|tarih\s*:|son güncelleme|versiyon|sürüm|\+?\d[\d\s()-]{6,}|https?:\/\/)/i;

const DATE_START_RE = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/;

const ALERT_COLOR_RE =
  /\b(?:bg|text|border)-(?:rose|red|amber|emerald|yellow)-(?:50|100|200|300|400|500|600|700|800|900|950)/;

let autoTipCounter = 0;

function hasMutedHelperClasses(el) {
  const cls = typeof el.className === "string" ? el.className : "";
  if (!cls) return false;
  if (ALERT_COLOR_RE.test(cls)) return false;

  const hasSmallText =
    cls.includes("text-[9px]") ||
    cls.includes("text-[10px]") ||
    cls.includes("text-[11px]") ||
    cls.includes("text-xs");
  if (!hasSmallText) return false;

  const hasMutedColor =
    cls.includes("text-slate-400") ||
    cls.includes("text-slate-450") ||
    cls.includes("text-slate-500") ||
    cls.includes("text-slate-505");

  return hasMutedColor;
}

function isExplanatoryNoteEl(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName;
  if (tag !== "P" && tag !== "DIV") return false;
  if (tag === "DIV" && el.children.length > 0) return false;
  if (!hasMutedHelperClasses(el)) return false;
  if (el.closest(EXCLUDED_ANCESTOR_SELECTOR)) return false;

  const parentCls = typeof el.parentElement?.className === "string" ? el.parentElement.className : "";
  if (ALERT_COLOR_RE.test(parentCls)) return false;

  if (el.querySelector("button, input, select, textarea, a[href]")) return false;

  const rawText = (el.textContent || "").replace(/\s+/g, " ").trim();
  if (rawText.length < 24 || rawText.length > 600) return false;

  const words = rawText.split(/\s+/).filter(Boolean);
  if (words.length < 4) return false;

  if (DYNAMIC_VALUE_PREFIX_RE.test(rawText) || DATE_START_RE.test(rawText)) {
    return false;
  }

  return true;
}

function isCandidateTitleEl(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.closest("button, a")) return false;
  const tag = el.tagName;
  if (tag === "LABEL" && el.querySelector("input, select, textarea")) {
    return false;
  }
  if (["H1", "H2", "H3", "H4", "H5", "LABEL"].includes(tag)) {
    return true;
  }
  if (tag === "DIV" || tag === "SPAN") {
    const cls = typeof el.className === "string" ? el.className : "";
    if (/\bfont-(?:bold|extrabold|semibold)\b/.test(cls) && !el.querySelector("input, select, textarea")) {
      return true;
    }
  }
  return false;
}

function extractCleanTitleText(titleEl) {
  if (!titleEl) return "";
  const clone = titleEl.cloneNode(true);
  clone
    .querySelectorAll(".aida-info-btn, [data-aida-explicit-info], svg, button")
    .forEach((n) => n.remove());
  // Also strip small status pills inside headings if titleEl has multiple children
  clone.querySelectorAll("span.rounded-full, span.rounded-md, span.uppercase.border").forEach((pill) => {
    if ((pill.textContent || "").trim().length <= 24) {
      pill.remove();
    }
  });
  return (clone.textContent || "").replace(/\s+/g, " ").trim();
}

function resolveTitleForDesc(descEl) {
  const prev = descEl.previousElementSibling;
  if (prev) {
    if (isCandidateTitleEl(prev)) {
      return prev;
    }
    const prevCls = typeof prev.className === "string" ? prev.className : "";
    if (prev.tagName === "DIV" && prevCls.includes("flex")) {
      const innerHeading = prev.querySelector("h1, h2, h3, h4, h5, label");
      if (innerHeading && isCandidateTitleEl(innerHeading)) {
        return innerHeading;
      }
      const firstChild = prev.firstElementChild;
      if (firstChild && isCandidateTitleEl(firstChild)) {
        return firstChild;
      }
      const innerBold = prev.querySelector(
        "span[class*='font-bold'], span[class*='font-extrabold'], span[class*='font-semibold'], div[class*='font-bold'], div[class*='font-extrabold']"
      );
      if (innerBold && isCandidateTitleEl(innerBold)) {
        return innerBold;
      }
    }
  }

  // Form field wrapper: <label> -> <input/select/range> -> helper <p> at the bottom
  const parent = descEl.parentElement;
  if (
    parent &&
    parent.lastElementChild === descEl &&
    parent.children.length >= 2 &&
    parent.children.length <= 4
  ) {
    const first = parent.firstElementChild;
    if (first && first !== descEl) {
      if (first.tagName === "LABEL" && isCandidateTitleEl(first)) {
        return first;
      }
      const firstCls = typeof first.className === "string" ? first.className : "";
      if (first.tagName === "DIV" && firstCls.includes("flex")) {
        const innerLabel = first.querySelector("label, h4, h5");
        if (innerLabel && isCandidateTitleEl(innerLabel)) {
          return innerLabel;
        }
      }
    }
  }

  return null;
}

function resolveMountTarget(titleEl) {
  const cls = typeof titleEl.className === "string" ? titleEl.className : "";
  if (cls.includes("justify-between") && titleEl.firstElementChild) {
    const firstTag = titleEl.firstElementChild.tagName;
    if (firstTag === "SPAN" || firstTag === "DIV" || firstTag === "LABEL") {
      return titleEl.firstElementChild;
    }
  }
  return titleEl;
}

function findMergeableHelpBanner(titleEl, descEl) {
  const card = titleEl.closest(".rounded-2xl, .rounded-3xl");
  if (!card) return null;
  // Only merge when this title belongs to the card's primary header area
  const helpIcons = card.querySelectorAll("svg.lucide-help-circle");
  for (const icon of helpIcons) {
    if (icon.closest(".aida-info-btn")) continue;
    const banner = icon.closest("div.flex");
    if (!banner || banner === descEl || banner.contains(titleEl)) continue;
    if (banner.closest(EXCLUDED_ANCESTOR_SELECTOR)) continue;
    if (banner.querySelector("button, input, select, textarea, a[href]")) continue;
    const bannerCls = typeof banner.className === "string" ? banner.className : "";
    if (ALERT_COLOR_RE.test(bannerCls)) continue;
    const text = (banner.innerText || banner.textContent || "").trim();
    if (text.length >= 25 && text.length <= 900) {
      return banner;
    }
  }
  return null;
}

function formatBannerDetails(bannerEl) {
  if (!bannerEl) return "";
  const items = Array.from(bannerEl.querySelectorAll("li"))
    .map((li) => `• ${(li.textContent || "").replace(/\s+/g, " ").trim()}`)
    .filter((s) => s.length > 2);
  if (items.length > 0) {
    return `Nasıl Çalışır?\n${items.join("\n")}`;
  }
  return (bannerEl.innerText || bannerEl.textContent || "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function scanAndEnhanceHints() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.location.pathname === "/login") return;

  const candidates = document.body.querySelectorAll("p, div");
  for (let i = 0; i < candidates.length; i++) {
    const descEl = candidates[i];
    if (descEl.getAttribute("data-aida-hint-collapsed") === "true") continue;
    if (!isExplanatoryNoteEl(descEl)) continue;

    const titleEl = resolveTitleForDesc(descEl);
    if (!titleEl) continue;

    const cleanTitle = extractCleanTitleText(titleEl);
    if (cleanTitle.length < 2 || cleanTitle.length > 130) continue;
    if (EMPTY_OR_SYSTEM_HEADING_RE.test(cleanTitle)) continue;

    const mountTarget = resolveMountTarget(titleEl);
    if (!mountTarget || mountTarget.closest("button, a")) continue;

    // Check if an explicit InfoTooltip already exists on this title; if so, just collapse the duplicate note
    const existingExplicit =
      mountTarget.querySelector("[data-aida-explicit-info='true']") ||
      titleEl.parentElement?.querySelector(":scope > [data-aida-explicit-info='true']");
    if (existingExplicit) {
      descEl.setAttribute("data-aida-hint-collapsed", "true");
      continue;
    }

    // Optional: check for a non-interactive HelpCircle / "Nasıl Çalışır?" box in the same setting card
    const helpBannerEl = findMergeableHelpBanner(titleEl, descEl);

    // Reuse existing auto button on mountTarget if already attached
    let btn = mountTarget.querySelector(":scope > button[data-aida-auto-info='true']");
    if (!btn) {
      const tipId = `aida-auto-tip-${++autoTipCounter}`;
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "aida-info-btn";
      btn.setAttribute("data-aida-auto-info", "true");
      btn.setAttribute("aria-label", `${cleanTitle} hakkında bilgi`);

      const glyph = document.createElement("span");
      glyph.className = "aida-info-glyph";
      glyph.setAttribute("aria-hidden", "true");
      glyph.textContent = "i";
      btn.appendChild(glyph);

      const getPayload = () => {
        const currentTitle = extractCleanTitleText(titleEl) || cleanTitle;
        const currentText = (btn.__aidaDescEl?.textContent || "").replace(/\s+/g, " ").trim();
        const currentDetails = btn.__aidaBannerEl ? formatBannerDetails(btn.__aidaBannerEl) : "";
        return {
          anchorEl: btn,
          title: currentTitle,
          text: currentText,
          details: currentDetails,
          id: tipId
        };
      };

      btn.addEventListener("mouseenter", () => {
        openInfoTooltip(getPayload());
      });
      btn.addEventListener("mouseleave", () => {
        scheduleCloseInfoTooltip(130);
      });
      btn.addEventListener("focus", () => {
        openInfoTooltip(getPayload());
      });
      btn.addEventListener("blur", () => {
        scheduleCloseInfoTooltip(80);
      });
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleInfoTooltip(getPayload());
      });

      mountTarget.appendChild(btn);
    }

    btn.__aidaDescEl = descEl;
    if (helpBannerEl) {
      btn.__aidaBannerEl = helpBannerEl;
      helpBannerEl.setAttribute("data-aida-hint-collapsed", "true");
    }
    descEl.setAttribute("data-aida-hint-collapsed", "true");
  }
}

export default function SystemInfoHintManager() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    let rafId = null;
    const scheduleScan = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        scanAndEnhanceHints();
      });
    };

    // Initial scan right after hydration settles
    const initTimer = window.setTimeout(scheduleScan, 40);

    const observer = new MutationObserver((mutations) => {
      let hasRelevantChange = false;
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.type === "attributes") {
          if (m.attributeName === "data-aida-hint-collapsed") continue;
        }
        const targetEl = m.target && m.target.nodeType === 1 ? m.target : null;
        if (
          targetEl &&
          (targetEl.classList?.contains("aida-info-btn") ||
            targetEl.classList?.contains("aida-info-popover") ||
            targetEl.closest?.(".aida-info-popover"))
        ) {
          continue;
        }
        if (m.addedNodes && m.addedNodes.length > 0) {
          const allInternal = Array.from(m.addedNodes).every(
            (n) =>
              n.nodeType === 1 &&
              (n.classList?.contains("aida-info-btn") || n.classList?.contains("aida-info-popover"))
          );
          if (allInternal) continue;
        }
        hasRelevantChange = true;
        break;
      }
      if (hasRelevantChange) {
        scheduleScan();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      window.clearTimeout(initTimer);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      observer.disconnect();
      closeInfoTooltipImmediate();
    };
  }, []);

  return <InfoTooltipLayer />;
}
