"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: "sm" | "md" | "lg";
  footer?: ReactNode;
}

/**
 * Drawer latéral qui glisse depuis la droite — style Mail Apple / Linear.
 * Backdrop noir/15 (très subtil), animation slide-in 250ms, ESC pour fermer.
 */
export function Drawer({ open, onClose, title, subtitle, children, width = "md", footer }: Props) {
  // ESC pour fermer
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widthCls = width === "sm" ? "max-w-[420px]" : width === "lg" ? "max-w-[720px]" : "max-w-[560px]";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop subtil */}
      <div
        className="absolute inset-0 bg-black/15 dark:bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className={`relative w-full ${widthCls} bg-white dark:bg-[#1c1c1e] shadow-[-12px_0_48px_rgba(0,0,0,0.08)] dark:shadow-[-12px_0_48px_rgba(0,0,0,0.6)] flex flex-col animate-in slide-in-from-right duration-250`}>
        {/* Header */}
        <header className="px-7 pt-8 pb-5 border-b border-[#f1f1f3] dark:border-[#2c2c2e]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-[26px] font-semibold tracking-[-0.025em] leading-tight text-[#111111] dark:text-white">{title}</h2>
              {subtitle && <p className="mt-1 text-[13px] text-[#6b7280] dark:text-[#98989D]">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] hover:bg-[#ebebed] dark:hover:bg-[#38383a] flex items-center justify-center shrink-0 transition-colors"
              aria-label="Fermer"
            >
              <X size={15} className="text-[#6b7280] dark:text-[#98989D]" />
            </button>
          </div>
        </header>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-6">
          {children}
        </div>
        {/* Footer optionnel */}
        {footer && (
          <footer className="px-7 py-4 border-t border-[#f1f1f3] dark:border-[#2c2c2e] bg-[#fafafa] dark:bg-[#161618]">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
