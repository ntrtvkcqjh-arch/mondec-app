"use client";

import { ReactNode } from "react";

interface Props {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Section avec titre minimal style Mail Apple :
 *  - Titre uppercase petit (tracking large)
 *  - Compteur optionnel
 *  - Séparateur horizontal subtil
 */
export function Section({ title, count, action, children }: Props) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-3 px-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280] dark:text-[#98989D]">
          {title}
        </h3>
        {count !== undefined && (
          <span className="text-[11px] text-[#9ca3af] dark:text-[#6b7280] tabular-nums">{count}</span>
        )}
        <div className="flex-1 h-[1px] bg-[#f1f1f3] dark:bg-[#2c2c2e]" />
        {action}
      </div>
      {children}
    </section>
  );
}
