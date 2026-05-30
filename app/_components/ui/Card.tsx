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
 * Card standard Apple :
 *  - Fond blanc pur
 *  - AUCUN contour
 *  - Ombre 4px très subtile
 *  - Coins 24px (style iOS card)
 *  - Hover : lift + shadow plus marquée (si interactive)
 */
export function Card({ children, onClick, className = "", interactive, ...drag }: Props) {
  const isClickable = !!onClick || interactive;
  return (
    <div
      onClick={onClick}
      {...drag}
      className={`bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] ${
        isClickable
          ? "cursor-pointer transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)] hover:-translate-y-[1px]"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
