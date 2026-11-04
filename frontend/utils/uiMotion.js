import React, { useEffect, useRef, useState } from "react";

export const VALID_UI_MOTION_MODES = ["fluid", "minimal", "off"];

export function normalizeUiMotionMode(raw) {
  if (typeof raw === "string" && VALID_UI_MOTION_MODES.includes(raw)) {
    return raw;
  }
  return "fluid";
}

export function getEffectiveMotionMode(preferredMode = "fluid") {
  const mode = normalizeUiMotionMode(preferredMode);
  if (typeof window === "undefined") return mode;
  if (mode === "off") return "off";
  try {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return "off";
    }
  } catch (e) {}
  return mode;
}

export function applyDocumentMotionMode(mode) {
  if (typeof document === "undefined") return;
  const normalized = normalizeUiMotionMode(mode);
  document.documentElement.setAttribute("data-ui-motion", normalized);
  try {
    localStorage.setItem("aida_ui_motion_mode", normalized);
  } catch (e) {}
}

export function readDocumentMotionMode() {
  if (typeof document === "undefined") return "fluid";
  const attr = document.documentElement.getAttribute("data-ui-motion");
  if (attr && VALID_UI_MOTION_MODES.includes(attr)) {
    return attr;
  }
  try {
    const saved = localStorage.getItem("aida_ui_motion_mode");
    if (saved && VALID_UI_MOTION_MODES.includes(saved)) {
      return saved;
    }
  } catch (e) {}
  return "fluid";
}

/**
 * Runs an element-scoped View Transition on a container subtree when supported,
 * keeping fixed headers, WebRTC banners, and [popover] elements interactive on top.
 */
export function runStageViewTransition(stageEl, updateDOM, motionMode = "fluid") {
  const effective = getEffectiveMotionMode(motionMode);
  if (
    effective !== "fluid" ||
    typeof Element === "undefined" ||
    !stageEl ||
    !("startViewTransition" in Element.prototype)
  ) {
    updateDOM();
    return;
  }

  try {
    const transition = stageEl.startViewTransition(() => {
      updateDOM();
    });
    if (transition && transition.ready && typeof transition.ready.catch === "function") {
      transition.ready.catch(() => {});
    }
  } catch (e) {
    updateDOM();
  }
}

let cachedSupportsSiblingIndex = null;
function supportsCssSiblingIndex() {
  if (cachedSupportsSiblingIndex !== null) return cachedSupportsSiblingIndex;
  if (typeof window === "undefined" || !window.CSS || typeof window.CSS.supports !== "function") {
    cachedSupportsSiblingIndex = false;
    return false;
  }
  try {
    cachedSupportsSiblingIndex = window.CSS.supports("animation-delay: calc(sibling-index() * 0.1s)");
  } catch (e) {
    cachedSupportsSiblingIndex = false;
  }
  return cachedSupportsSiblingIndex;
}

/**
 * Automatically decorates newly revealed screen content (KPI grids, cards, tables,
 * and progress/chart bars) with GPU-composited staggered entry animations.
 */
export function decorateStageSubtreeForMotion(rootEl) {
  if (!rootEl || typeof window === "undefined") return;
  const effective = getEffectiveMotionMode(readDocumentMotionMode());
  if (effective === "off") return;

  const needsSiblingIndexVar = !supportsCssSiblingIndex();

  try {
    // 1. Decorate multi-card grids & top-level section stacks for staggered cascade
    const grids = rootEl.querySelectorAll(".grid");
    grids.forEach((grid, gIdx) => {
      if (gIdx > 8) return; // Cap per screen for zero overhead
      if (grid.closest("[popover], [role='dialog'], .aida-no-stagger")) return;
      const children = Array.from(grid.children).filter(
        (ch) => ch.nodeType === 1 && !ch.classList.contains("fixed")
      );
      if (children.length < 2 || children.length > 16) return;
      grid.classList.add("aida-stagger-grid");
      if (needsSiblingIndexVar) {
        children.forEach((child, idx) => {
          child.style.setProperty("--sibling-index", String(Math.min(idx + 1, 10)));
        });
      }
    });

    // 2. Decorate horizontal percentage fill bars inside progress tracks
    const widthBars = rootEl.querySelectorAll('div[style*="width"]');
    widthBars.forEach((bar, bIdx) => {
      if (bIdx > 40) return;
      if (bar.dataset.aidaBarAnimated === "1") return;
      const parent = bar.parentElement;
      if (!parent) return;
      const pCls = typeof parent.className === "string" ? parent.className : "";
      const bCls = typeof bar.className === "string" ? bar.className : "";
      const looksLikeTrack =
        (pCls.includes("overflow-hidden") && (pCls.includes("rounded-full") || pCls.includes("h-1") || pCls.includes("h-2") || pCls.includes("h-3") || pCls.includes("h-4") || pCls.includes("h-5") || pCls.includes("h-6"))) ||
        bCls.includes("bg-gradient-to-r");
      if (looksLikeTrack && !bCls.includes("aida-chart-bar-x")) {
        bar.dataset.aidaBarAnimated = "1";
        bar.classList.add("aida-chart-bar-x");
      }
    });

    // 3. Decorate vertical column chart bars (height percentage bars)
    const heightBars = rootEl.querySelectorAll('div[style*="height"]');
    heightBars.forEach((bar, hIdx) => {
      if (hIdx > 48) return;
      if (bar.dataset.aidaBarAnimated === "1") return;
      const inlineH = bar.style?.height || "";
      if (!inlineH.endsWith("%")) return;
      const bCls = typeof bar.className === "string" ? bar.className : "";
      if (
        (bCls.includes("rounded-t") || bCls.includes("bg-primary") || bCls.includes("bg-emerald") || bCls.includes("bg-indigo") || bCls.includes("bg-purple") || bCls.includes("bg-rose") || bCls.includes("bg-amber") || bCls.includes("bg-blue")) &&
        !bCls.includes("aida-chart-bar-y")
      ) {
        bar.dataset.aidaBarAnimated = "1";
        bar.classList.add("aida-chart-bar-y");
      }
    });
  } catch (e) {}
}

/**
 * React hook that triggers smooth GPU reveal & child stagger whenever `triggerKey` changes
 * (including lazy-loaded panels arriving asynchronously via next/dynamic or API fetches).
 */
export function useStageRevealObserver(containerRef, triggerKey) {
  useEffect(() => {
    const el = containerRef?.current;
    if (!el || typeof window === "undefined") return;

    const mode = getEffectiveMotionMode(readDocumentMotionMode());
    if (mode === "off") return;

    // Retrigger stage entry animation cleanly on the compositor
    el.classList.remove("aida-stage-active");
    const raf1 = window.requestAnimationFrame(() => {
      el.classList.add("aida-stage-active");
      decorateStageSubtreeForMotion(el);
    });

    // Also watch briefly (900ms) for lazy dynamic chunks or fast API data renders to decorate new grids/bars
    let observer = null;
    let stopTimer = null;
    if (typeof MutationObserver !== "undefined") {
      let pendingRaf = null;
      observer = new MutationObserver(() => {
        if (pendingRaf) return;
        pendingRaf = window.requestAnimationFrame(() => {
          pendingRaf = null;
          decorateStageSubtreeForMotion(el);
        });
      });
      observer.observe(el, { childList: true, subtree: true });
      stopTimer = window.setTimeout(() => {
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      }, 1100);
    }

    return () => {
      window.cancelAnimationFrame(raf1);
      if (observer) observer.disconnect();
      if (stopTimer) window.clearTimeout(stopTimer);
    };
  }, [containerRef, triggerKey]);
}

/**
 * Smoothly animates a numeric KPI counter (or formatted metric string like "%94", "12 / 15", "148")
 * using requestAnimationFrame without layout thrashing.
 */
export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 420,
  className = "",
}) {
  const numericTarget = typeof value === "number" ? value : Number(value);
  const isPureNumber = Number.isFinite(numericTarget) && value !== "" && value !== null && typeof value !== "boolean";

  const [displayVal, setDisplayVal] = useState(() => (isPureNumber ? numericTarget : value));
  const prevNumericRef = useRef(null);

  useEffect(() => {
    if (!isPureNumber) {
      setDisplayVal(value);
      return;
    }

    const mode = getEffectiveMotionMode(readDocumentMotionMode());
    if (mode === "off") {
      prevNumericRef.current = numericTarget;
      setDisplayVal(numericTarget);
      return;
    }

    const effectiveDuration = mode === "minimal" ? Math.min(180, duration) : duration;
    const fromVal = prevNumericRef.current !== null ? prevNumericRef.current : 0;
    prevNumericRef.current = numericTarget;

    if (fromVal === numericTarget) {
      setDisplayVal(numericTarget);
      return;
    }

    let rafId = null;
    let startTs = null;

    const step = (ts) => {
      if (startTs === null) startTs = ts;
      const elapsed = ts - startTs;
      const progress = Math.min(1, elapsed / effectiveDuration);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = fromVal + (numericTarget - fromVal) * eased;
      setDisplayVal(current);
      if (progress < 1) {
        rafId = window.requestAnimationFrame(step);
      } else {
        setDisplayVal(numericTarget);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [numericTarget, isPureNumber, value, duration]);

  if (!isPureNumber) {
    return <span className={className}>{prefix}{value}{suffix}</span>;
  }

  const formatted =
    decimals > 0
      ? Number(displayVal).toFixed(decimals)
      : String(Math.round(Number(displayVal)));

  return (
    <span className={`tabular-nums ${className}`.trim()}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/**
 * Smart wrapper for KPI strings that may contain "%85", "14 / 20", "142", or "₺1.250"
 * Animates leading numeric value while preserving prefixes/suffixes intact.
 */
export function AnimatedMetricText({ value, duration = 420, className = "" }) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const decimals = Number.isInteger(value) ? 0 : 1;
    return <AnimatedNumber value={value} decimals={decimals} duration={duration} className={className} />;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    // Match optional prefix (% or ₺ or #), number (int or float), and optional short suffix (without time colons or multiple numbers like dates)
    const match = trimmed.match(/^([%₺$#+-]?\s*)(\d+(?:\.\d+)?)(\s*(?:%|Adet|Kuyruk|Üye|dk|sn|sa|puan)?)$/i);
    if (match) {
      const prefix = match[1] || "";
      const numStr = match[2];
      const suffix = match[3] || "";
      const num = Number(numStr);
      const decimals = numStr.includes(".") ? (numStr.split(".")[1]?.length || 1) : 0;
      if (Number.isFinite(num)) {
        return (
          <AnimatedNumber
            value={num}
            prefix={prefix}
            suffix={suffix}
            decimals={decimals}
            duration={duration}
            className={className}
          />
        );
      }
    }
  }

  return <span className={className}>{value}</span>;
}

/**
 * GPU-composited Shimmer Skeleton shown while lazy chunks or initial API payloads load.
 */
export function PanelShimmerSkeleton({ variant = "default" }) {
  if (variant === "cards") {
    return (
      <div className="w-full space-y-4 py-2 aida-panel-enter" aria-busy="true" aria-label="İçerik yükleniyor">
        <div className="h-12 w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-3.5 flex items-center justify-between overflow-hidden relative aida-shimmer-surface">
          <div className="h-3.5 w-44 rounded-lg bg-slate-200/80 dark:bg-slate-800" />
          <div className="h-7 w-24 rounded-xl bg-slate-200/70 dark:bg-slate-800" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4 space-y-3 relative overflow-hidden aida-shimmer-surface"
            >
              <div className="h-3 w-28 rounded-md bg-slate-200/80 dark:bg-slate-800" />
              <div className="h-6 w-20 rounded-lg bg-slate-200/90 dark:bg-slate-800" />
              <div className="h-2.5 w-3/4 rounded-md bg-slate-100 dark:bg-slate-800/70" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className="w-full space-y-4 py-1 aida-panel-enter" aria-busy="true" aria-label="Tablo verileri yükleniyor">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4 flex flex-col justify-between relative overflow-hidden aida-shimmer-surface"
            >
              <div className="h-2.5 w-20 rounded bg-slate-200/80 dark:bg-slate-800" />
              <div className="h-5 w-16 rounded-lg bg-slate-200/90 dark:bg-slate-800" />
              <div className="h-2 w-24 rounded bg-slate-100 dark:bg-slate-800/70" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4 space-y-3 relative overflow-hidden aida-shimmer-surface">
          <div className="h-8 w-full rounded-xl bg-slate-100 dark:bg-slate-800/80" />
          {[1, 2, 3, 4, 5].map((r) => (
            <div key={r} className="h-9 w-full rounded-xl bg-slate-50 dark:bg-slate-800/40" />
          ))}
        </div>
      </div>
    );
  }

  // Default / Dashboard full view skeleton
  return (
    <div className="w-full space-y-5 py-2 aida-panel-enter" aria-busy="true" aria-label="Ekran hazırlanıyor">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-5 w-52 rounded-lg bg-slate-200/80 dark:bg-slate-800 relative overflow-hidden aida-shimmer-surface" />
          <div className="h-3 w-72 rounded-md bg-slate-200/60 dark:bg-slate-800/70 relative overflow-hidden aida-shimmer-surface" />
        </div>
        <div className="h-9 w-32 rounded-xl bg-slate-200/70 dark:bg-slate-800 relative overflow-hidden aida-shimmer-surface" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((k) => (
          <div
            key={k}
            className="h-24 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4 flex flex-col justify-between relative overflow-hidden aida-shimmer-surface"
          >
            <div className="h-2.5 w-24 rounded bg-slate-200/80 dark:bg-slate-800" />
            <div className="h-6 w-16 rounded-lg bg-slate-200/90 dark:bg-slate-800" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-64 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 space-y-4 relative overflow-hidden aida-shimmer-surface">
          <div className="h-3.5 w-40 rounded bg-slate-200/80 dark:bg-slate-800" />
          <div className="h-44 w-full rounded-2xl bg-slate-100/80 dark:bg-slate-800/50" />
        </div>
        <div className="h-64 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 space-y-3 relative overflow-hidden aida-shimmer-surface">
          <div className="h-3.5 w-32 rounded bg-slate-200/80 dark:bg-slate-800" />
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="h-9 w-full rounded-xl bg-slate-100/80 dark:bg-slate-800/50" />
          ))}
        </div>
      </div>
    </div>
  );
}
