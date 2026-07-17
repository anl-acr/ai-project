import React from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle } from "lucide-react";

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Kaydı Sil",
  message = "Bu kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
}) {
  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 transition-all duration-300">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20">
          <h3 className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-wider">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-2xl animate-pulse">
            <AlertTriangle size={28} />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">İşlemi Onaylayın</h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              {message}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 pb-6 pt-2 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-bold border dark: dark: dark: hover: dark:hover: transition-all bg-slate-500 hover:bg-slate-600 text-white border-transparent"
          >Vazgeç</button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-sm shadow-rose-600/10"
          >
            Sil
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
