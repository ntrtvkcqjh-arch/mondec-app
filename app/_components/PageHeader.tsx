"use client";

import { ReactNode } from "react";

interface Props {
  chip: string;
  chipSecond?: string;
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  metadata?: string;
  emoji?: string;
}

/**
 * Header de page style PHDDEC — chip + grand titre + sous-titre + actions
 */
export function PageHeader({ chip, chipSecond, title, subtitle, rightSlot, metadata, emoji = "☼" }: Props) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 text-[11px] font-medium tracking-[0.12em] uppercase text-[#86868B] mb-3">
        <span>{emoji}</span><span>{chip}</span>
        {chipSecond && <><span>·</span><span>{chipSecond}</span></>}
      </div>
      <h2 className="text-[56px] font-semibold text-[#1D1D1F] tracking-[-0.04em] leading-[0.95] mb-2">{title}</h2>
      {subtitle && <p className="text-[14px] text-[#86868B]">{subtitle}</p>}
      {(rightSlot || metadata) && (
        <div className="flex items-center justify-between mt-5">
          <div>{rightSlot}</div>
          {metadata && <p className="text-[10px] text-[#86868B]">{metadata}</p>}
        </div>
      )}
    </div>
  );
}
