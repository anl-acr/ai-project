import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Singleton controller so at most ONE info tooltip is visible across the entire app
const tooltipListeners = new Set();
let activeTooltipState = null;
let closeTimer = null;
let openTimer = null;
let lastGlobalScrollAt = 0;
let scrollGuardInstalled = false;

function ensureScrollGuard() {
  if (typeof window === "undefined" || scrollGuardInstalled) return;
  scrollGuardInstalled = true;
  window.addEventListener(
    "scroll",
    () => {
      lastGlobalScrollAt = Date.now();
      if (openTimer) {
        clearTimeout(openTimer);
        openTimer = null;
      }
      if (activeTooltipState !== null) {
        closeInfoTooltipImmediate();
      }
    },
    { capture: true, passive: true }
  );
}

function notifyTooltipListeners() {
  tooltipListeners.forEach((fn) => {
    try {
      fn(activeTooltipState);
    } catch (_e) {}
  });
}

export function cancelOpenInfoTooltip() {
  if (openTimer) {
    clearTimeout(openTimer);
    openTimer = null;
  }
}

export function cancelCloseInfoTooltip() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

export function closeInfoTooltipImmediate() {
  cancelOpenInfoTooltip();
  cancelCloseInfoTooltip();
  if (activeTooltipState !== null) {
    activeTooltipState = null;
    notifyTooltipListeners();
  }
}

export function scheduleCloseInfoTooltip(delayMs = 130) {
  cancelOpenInfoTooltip();
  cancelCloseInfoTooltip();
  closeTimer = setTimeout(() => {
    activeTooltipState = null;
    notifyTooltipListeners();
  }, delayMs);
}

export function openInfoTooltip({ anchorEl, title = "", text = "", details = "", id = "aida-global-info-tip", immediate = false }) {
  ensureScrollGuard();
  if (!anchorEl || !text) return;
  if (!immediate && Date.now() - lastGlobalScrollAt < 220) return;
  cancelOpenInfoTooltip();
  cancelCloseInfoTooltip();

  const commitOpen = () => {
    openTimer = null;
    if (!immediate && Date.now() - lastGlobalScrollAt < 220) return;
    if (!anchorEl || !document.body.contains(anchorEl)) return;
    activeTooltipState = {
      anchorEl,
      title: String(title || "").trim(),
      text: String(text || "").trim(),
      details: String(details || "").trim(),
      id
    };
    notifyTooltipListeners();
  };

  if (immediate || activeTooltipState !== null) {
    commitOpen();
  } else {
    openTimer = setTimeout(commitOpen, 110);
  }
}

export function toggleInfoTooltip(payload) {
  if (activeTooltipState && activeTooltipState.anchorEl === payload.anchorEl) {
    closeInfoTooltipImmediate();
  } else {
    openInfoTooltip({ ...payload, immediate: true });
  }
}

/**
 * Shared Top-Layer Popover renderer mounted once at the application root.
 * Uses the native Popover API (`popover="manual"` + `showPopover()`) so tooltips promote
 * into the browser Top Layer above all `overflow: hidden` containers and modals, while
 * satisfying WCAG 1.4.13 (Hoverable, Escape-Dismissible, Persistent) across all browsers.
 */
export function InfoTooltipLayer() {
  const [tip, setTip] = useState(null);
  const [coords, setCoords] = useState({ top: -9999, left: -9999, placement: "top", arrowX: 24 });
  const popoverRef = useRef(null);

  useEffect(() => {
    ensureScrollGuard();
    const listener = (next) => setTip(next);
    tooltipListeners.add(listener);
    return () => {
      tooltipListeners.delete(listener);
    };
  }, []);

  // WCAG 1.4.13 Dismissible: Escape closes tooltip without moving focus
  useEffect(() => {
    if (!tip) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        closeInfoTooltipImmediate();
      }
    };
    const onPointerDownOutside = (e) => {
      const pop = popoverRef.current;
      if (pop && pop.contains(e.target)) return;
      if (tip.anchorEl && tip.anchorEl.contains(e.target)) return;
      closeInfoTooltipImmediate();
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDownOutside, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDownOutside, true);
    };
  }, [tip]);

  // Promote into Top Layer via Popover API and compute viewport-collision-safe position
  useEffect(() => {
    const popEl = popoverRef.current;
    if (!popEl) return;

    if (!tip || !tip.anchorEl || !document.body.contains(tip.anchorEl)) {
      try {
        if (typeof popEl.hidePopover === "function" && popEl.matches(":popover-open")) {
          popEl.hidePopover();
        }
      } catch (_e) {}
      return;
    }

    try {
      if (typeof popEl.showPopover === "function" && !popEl.matches(":popover-open")) {
        popEl.showPopover();
      }
    } catch (_e) {}

    const updatePosition = () => {
      if (!tip.anchorEl || !document.body.contains(tip.anchorEl)) {
        closeInfoTooltipImmediate();
        return;
      }
      const rect = tip.anchorEl.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        closeInfoTooltipImmediate();
        return;
      }

      const popRect = popEl.getBoundingClientRect();
      const popW = popRect.width || 300;
      const popH = popRect.height || 76;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const gap = 10;
      const margin = 12;

      const anchorCenterX = rect.left + rect.width / 2;
      let placement = "top";
      let top = rect.top - popH - gap;

      if (top < margin && vh - rect.bottom > popH + margin) {
        placement = "bottom";
        top = rect.bottom + gap;
      } else if (top < margin) {
        placement = "bottom";
        top = Math.max(margin, rect.bottom + gap);
      }

      let left = anchorCenterX - popW / 2;
      left = Math.max(margin, Math.min(vw - popW - margin, left));
      const arrowX = Math.max(14, Math.min(popW - 14, anchorCenterX - left));

      setCoords({ top, left, placement, arrowX });
    };

    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
    };
  }, [tip]);

  if (typeof document === "undefined") return null;

  const isVisible = Boolean(tip && tip.text);

  return createPortal(
    <div
      ref={popoverRef}
      id={tip?.id || "aida-global-info-tip"}
      {...{ popover: "manual" }}
      role="tooltip"
      aria-hidden={!isVisible}
      onMouseEnter={cancelCloseInfoTooltip}
      onMouseLeave={() => scheduleCloseInfoTooltip(120)}
      style={{
        position: "fixed",
        inset: "auto",
        margin: 0,
        top: isVisible ? `${coords.top}px` : "-9999px",
        left: isVisible ? `${coords.left}px` : "-9999px",
        opacity: isVisible && coords.top > -9000 ? 1 : 0,
        pointerEvents: isVisible ? "auto" : "none"
      }}
      className="aida-info-popover z-[99999] w-max max-w-[min(340px,calc(100vw-24px))] rounded-xl bg-slate-900 dark:bg-slate-800 text-slate-100 border border-slate-700/80 shadow-2xl px-3.5 py-2.5 text-left transition-opacity duration-150"
    >
      <div className="space-y-1.5">
        {tip?.title && (
          <div className="text-[11px] font-extrabold text-white tracking-tight border-b border-slate-700/70 pb-1">
            {tip.title}
          </div>
        )}
        <p className="text-[11px] leading-relaxed font-medium text-slate-200 whitespace-pre-line">
          {tip?.text || ""}
        </p>
        {tip?.details && (
          <div className="pt-1.5 mt-1 border-t border-slate-700/70 text-[10px] leading-relaxed text-slate-300 whitespace-pre-line">
            {tip.details}
          </div>
        )}
      </div>

      {/* Directional Arrow */}
      <span
        aria-hidden="true"
        style={{ left: `${coords.arrowX}px` }}
        className={
          "pointer-events-none absolute -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-slate-900 dark:bg-slate-800 border-slate-700/80 " +
          (coords.placement === "top"
            ? "-bottom-[5px] border-r border-b"
            : "-top-[5px] border-l border-t")
        }
      />
    </div>,
    document.body
  );
}

/**
 * Explicit "i" info badge button for feature titles, section headers, and form labels.
 * Uses the unified singleton InfoTooltipLayer with scroll-guard & hover-intent delay
 * so scrolling inside modals never triggers Top-Layer popover promotions or GPU blur thrashing.
 */
export default function InfoTooltip({ text, title = "", details = "", className = "" }) {
  const reactId = useId();
  const safeId = `aida-tip-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const btnRef = useRef(null);

  if (!text) return null;

  const ariaLabel = title ? `${title} hakkında bilgi` : "Özellik açıklaması";

  const handleOpen = () => {
    if (!btnRef.current) return;
    openInfoTooltip({
      anchorEl: btnRef.current,
      title,
      text,
      details,
      id: safeId
    });
  };

  return (
    <button
      ref={btnRef}
      type="button"
      data-aida-explicit-info="true"
      aria-label={ariaLabel}
      onMouseEnter={handleOpen}
      onMouseLeave={() => scheduleCloseInfoTooltip(130)}
      onFocus={handleOpen}
      onBlur={() => scheduleCloseInfoTooltip(80)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!btnRef.current) return;
        toggleInfoTooltip({
          anchorEl: btnRef.current,
          title,
          text,
          details,
          id: safeId
        });
      }}
      className={`aida-info-btn ${className}`}
    >
      <span aria-hidden="true" className="aida-info-glyph">i</span>
    </button>
  );
}
