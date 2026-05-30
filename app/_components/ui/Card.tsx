"use client";

import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  interactive?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

/**
 * Card standard PHDDEC :
 *  - background: var(--mdec-surface) — blanc en clair, #14141B en dark
 *  - border 1px subtile : rgba(0,0,0,.06) ou rgba(255,255,255,.08)
 *  - shadow double couche : 0 1px 2px + 0 8px 24px (très léger)
 *  - rounded 24px
 *  - hover : shadow renforcée + border-strong
 */
export function Card({ children, onClick, className = "", interactive, ...drag }: Props) {
  const isClickable = !!onClick || interactive;
  return (
    <div
      onClick={onClick}
      {...drag}
      className={`surface-card rounded-[24px] ${
        isClickable ? "surface-card-hover lift press cursor-pointer" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
