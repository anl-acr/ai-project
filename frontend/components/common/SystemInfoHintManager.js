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

const HELPER_CANDIDATE_SELECTOR =
  'p[class*="text-slate-4"], p[class*="text-slate-5"], div[class*="text-slate-4"], div[class*="text-slate-5"]';

const EMPTY_OR_SYSTEM_HEADING_RE =
  /^(henüz\b|kayıtlı .* bulun|yetkisiz|işlemi onayla|bu ekran geliştirme|anlamsal arama simülatörü|arama kriterine|sonuç bulun)/i;

const DYNAMIC_VALUE_PREFIX_RE =
  /^(çağrı id|call id|oturum id|id\s*:|ip\s*:|tarih\s*:|son güncelleme|versiyon|sürüm|\+?\d[\d\s()-]{6,}|https?:\/\/)/i;

const DATE_START_RE = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/;

const ALERT_COLOR_RE =
  /\b(?:bg|text|border)-(?:rose|red|amber|emerald|yellow)-(?:50|100|200|300|400|500|600|700|800|900|950)/;

let autoTipCounter = 0;

function yieldToMainThread() {
  if (typeof window !== "undefined" && "scheduler" in window && typeof window.scheduler?.yield === "function") {
    return window.scheduler.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

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
    const text = (banner.textContent || "").replace(/\s+/g, " ").trim();
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
  return (bannerEl.textContent || "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function enhanceCandidateElement(descEl) {
  if (!descEl || descEl.nodeType !== 1) return;
  if (descEl.getAttribute("data-aida-hint-collapsed") === "true") return;
  if (descEl.getAttribute("data-aida-hint-checked") === "true") return;
  descEl.setAttribute("data-aida-hint-checked", "true");

  if (!isExplanatoryNoteEl(descEl)) return;

  const titleEl = resolveTitleForDesc(descEl);
  if (!titleEl) return;

  const cleanTitle = extractCleanTitleText(titleEl);
  if (cleanTitle.length < 2 || cleanTitle.length > 130) return;
  if (EMPTY_OR_SYSTEM_HEADING_RE.test(cleanTitle)) return;

  const mountTarget = resolveMountTarget(titleEl);
  if (!mountTarget || mountTarget.closest("button, a")) return;

  // Check if an explicit InfoTooltip already exists on this title; if so, just collapse the duplicate note
  const existingExplicit =
    mountTarget.querySelector("[data-aida-explicit-info='true']") ||
    titleEl.parentElement?.querySelector(":scope > [data-aida-explicit-info='true']");
  if (existingExplicit) {
    descEl.setAttribute("data-aida-hint-collapsed", "true");
    return;
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

async function scanRootsForHints(roots, isCancelled) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.location.pathname === "/login") return;

  const uniqueCandidates = new Set();
  for (const root of roots) {
    if (!root || root.nodeType !== 1 || !root.isConnected) continue;
    if (root.matches?.(HELPER_CANDIDATE_SELECTOR)) {
      uniqueCandidates.add(root);
    }
    const found = root.querySelectorAll(HELPER_CANDIDATE_SELECTOR);
    for (let i = 0; i < found.length; i++) {
      const el = found[i];
      if (
        el.getAttribute("data-aida-hint-checked") !== "true" &&
        el.getAttribute("data-aida-hint-collapsed") !== "true"
      ) {
        uniqueCandidates.add(el);
      }
    }
  }

  let processed = 0;
  for (const descEl of uniqueCandidates) {
    if (isCancelled()) return;
    enhanceCandidateElement(descEl);
    processed++;
    if (processed % 40 === 0) {
      await yieldToMainThread();
    }
  }
}

export default function SystemInfoHintManager() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    let cancelled = false;
    let idleHandle = null;
    let timerHandle = null;
    const pendingRoots = new Set();

    const flushScan = () => {
      idleHandle = null;
      timerHandle = null;
      if (cancelled || pendingRoots.size === 0) return;
      const roots = pendingRoots.has(document.body) ? [document.body] : Array.from(pendingRoots);
      pendingRoots.clear();
      scanRootsForHints(roots, () => cancelled);
    };

    const scheduleScan = (rootEl) => {
      if (rootEl && rootEl.nodeType === 1) {
        pendingRoots.add(rootEl);
      }
      if (idleHandle !== null || timerHandle !== null) return;
      // Defer off the interaction's critical Next Paint frame so clicks render immediately
      timerHandle = window.setTimeout(() => {
        timerHandle = null;
        if (typeof window.requestIdleCallback === "function") {
          idleHandle = window.requestIdleCallback(flushScan, { timeout: 250 });
        } else {
          flushScan();
        }
      }, 60);
    };

    // Initial scan after hydration settles
    scheduleScan(document.body);

    const observer = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.type !== "childList" || !m.addedNodes || m.addedNodes.length === 0) continue;

        const targetEl = m.target && m.target.nodeType === 1 ? m.target : null;
        if (
          targetEl &&
          (targetEl.classList?.contains("aida-info-btn") ||
            targetEl.classList?.contains("aida-info-popover") ||
            targetEl.closest?.(".aida-info-popover, table, svg"))
        ) {
          continue;
        }

        for (let j = 0; j < m.addedNodes.length; j++) {
          const node = m.addedNodes[j];
          // Ignore pure text node updates (e.g. 1s call/break timers, counters)
          if (node.nodeType !== 1) continue;
          if (
            node.classList?.contains("aida-info-btn") ||
            node.classList?.contains("aida-info-popover") ||
            node.tagName === "SVG" ||
            node.tagName === "PATH"
          ) {
            continue;
          }
          scheduleScan(node);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      cancelled = true;
      if (timerHandle !== null) window.clearTimeout(timerHandle);
      if (idleHandle !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      observer.disconnect();
      closeInfoTooltipImmediate();
    };
  }, []);

  return <InfoTooltipLayer />;
}
