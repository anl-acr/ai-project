import React, { useState, useEffect } from "react";
import { Keyboard, X, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";
import { useTheme } from "../../utils/theme";
import {
  SHORTCUT_ACTIONS_CATALOG,
  resolveEffectiveShortcutsMap,
  eventToShortcutCombo,
  formatComboLabel,
} from "../../utils/keyboardShortcuts";

export default function KeyboardShortcutsModal({
  isOpen,
  onClose,
  customShortcuts = {},
  onSaveShortcuts,
  embedded = false,
}) {
  const { bg, hover, text, border, lightBg, borderLight } = useTheme();
  const [capturingActionId, setCapturingActionId] = useState(null);
  const [conflictMsg, setConflictMsg] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);

  const effectiveMap = resolveEffectiveShortcutsMap(customShortcuts);

  useEffect(() => {
    if (!isOpen) {
      setCapturingActionId(null);
      setConflictMsg("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (!capturingActionId) {
        if (!embedded && e.key === "Escape") {
          onClose?.();
        }
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setCapturingActionId(null);
        setConflictMsg("");
        return;
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        const nextCustom = { ...customShortcuts, [capturingActionId]: "" };
        onSaveShortcuts?.(nextCustom);
        setCapturingActionId(null);
        setConflictMsg("");
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 2000);
        return;
      }

      const combo = eventToShortcutCombo(e);
      if (!combo) {
        setConflictMsg("Lütfen Alt, Ctrl veya Shift ile birlikte bir harf/rakam tuşuna basın.");
        return;
      }

      if (combo === "Ctrl+KeyK") {
        setConflictMsg("Ctrl + K global arama için ayrılmıştır. Başka bir kombinasyon seçin.");
        return;
      }

      const duplicateEntry = SHORTCUT_ACTIONS_CATALOG.find(
        (act) => act.id !== capturingActionId && effectiveMap[act.id] === combo
      );
      if (duplicateEntry) {
        setConflictMsg(
          `Bu tuş kombinasyonu "${duplicateEntry.label}" eyleminde kullanılıyor.`
        );
        return;
      }

      const nextCustom = { ...customShortcuts, [capturingActionId]: combo };
      onSaveShortcuts?.(nextCustom);
      setCapturingActionId(null);
      setConflictMsg("");
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, embedded, capturingActionId, customShortcuts, effectiveMap, onClose, onSaveShortcuts]);

  if (!isOpen) return null;

  const categories = Array.from(new Set(SHORTCUT_ACTIONS_CATALOG.map((a) => a.category)));

  const handleResetDefaults = () => {
    onSaveShortcuts?.({});
    setCapturingActionId(null);
    setConflictMsg("");
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const innerContent = (
    <>
      {/* Header */}
      <div
        className={
          embedded
            ? "flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800"
            : "px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-950/40"
        }
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${lightBg} ${text}`}>
            <Keyboard size={embedded ? 16 : 18} />
          </div>
          <div>
            <h3
              id="shortcuts-modal-title"
              className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider"
            >
              Klavye Kısayolları & Kişisel Tuş Atamaları
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Herhangi bir kısayol kutusuna tıklayıp kendi tuş kombinasyonunuzu atayabilirsiniz.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition cursor-pointer"
            title="Varsayılan Kısayollara Dön"
          >
            <RotateCcw size={12} />
            <span>Varsayılana Sıfırla</span>
          </button>
          {!embedded && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Status Banners */}
      {(conflictMsg || savedNotice) && (
        <div className={embedded ? "" : "px-6 pt-3"}>
          {conflictMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-[11px] font-semibold flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{conflictMsg}</span>
            </div>
          )}
          {!conflictMsg && savedNotice && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold flex items-center gap-2">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>Kişisel kısayol tercihiniz kaydedildi.</span>
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div className={embedded ? "space-y-4 pr-1" : "flex-1 overflow-y-auto p-6 space-y-5"}>
        {/* Built-in Fixed Shortcuts */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            Sistem Sabit Kısayolları
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              { label: "Global Hızlı Arama", keys: "Ctrl + K" },
              { label: "Kısayol Sekmesini Aç", keys: "?" },
              { label: "Açık Pencereyi Kapat", keys: "Esc" },
            ].map((s) => (
              <div
                key={s.label}
                className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2"
              >
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  {s.label}
                </span>
                <kbd className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-extrabold text-slate-700 dark:text-slate-200 shadow-sm">
                  {s.keys}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Customizable Shortcuts by Category */}
        {categories.map((cat) => (
          <div key={cat} className="space-y-2">
            <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              {cat}
            </h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
              {SHORTCUT_ACTIONS_CATALOG.filter((a) => a.category === cat).map((action) => {
                const isCapturing = capturingActionId === action.id;
                const combo = effectiveMap[action.id];

                return (
                  <div
                    key={action.id}
                    className="px-4 py-3 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {action.label}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {action.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setConflictMsg("");
                        setCapturingActionId(isCapturing ? null : action.id);
                      }}
                      title="Tıklayıp yeni tuş kombinasyonuna basın (Silmek için Backspace)"
                      className={`px-3 py-1.5 rounded-xl border text-[11px] font-mono font-extrabold shrink-0 transition cursor-pointer ${
                        isCapturing
                          ? `${bg} text-white border-transparent animate-pulse`
                          : `${lightBg} ${text} ${borderLight} hover:${border}`
                      }`}
                    >
                      {isCapturing ? "Tuşlara Basın..." : formatComboLabel(combo)}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  if (embedded) {
    return <div className="space-y-4 max-h-[62vh] overflow-y-auto pr-1">{innerContent}</div>;
  }

  return (
    <div
      onClick={() => {
        if (!capturingActionId) onClose?.();
      }}
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[175] flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[86vh]"
      >
        {innerContent}
      </div>
    </div>
  );
}
