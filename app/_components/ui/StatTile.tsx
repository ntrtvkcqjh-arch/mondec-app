"use client";

interface Props {
  value: string | number;
  label: string;
  tone?: "default" | "info" | "success" | "warning" | "critical";
  hint?: string;
}

const toneColors: Record<NonNullable<Props["tone"]>, string> = {
  default: "text-[#111111] dark:text-white",
  info: "text-[#007AFF]",
  success: "text-[#34C759]",
  warning: "text-[#FF9500]",
  critical: "text-[#FF3B30]",
};

/**
 * Tuile de statistique standard Apple — comme les KPI iOS / Watch.
 * Fond blanc, ombre 4px, coins 24px, valeur géante, label sec.
 */
export function StatTile({ value, label, tone = "default", hint }: Props) {
  return (
    <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] px-6 py-5 min-w-[140px]">
      <div className={`text-[40px] font-semibold tabular-nums leading-none tracking-[-0.02em] ${toneColors[tone]}`}>
        {value}
      </div>
      <div className="mt-2 text-[12px] text-[#6b7280] dark:text-[#98989D] uppercase tracking-[0.06em] font-medium">
        {label}
      </div>
      {hint && <div className="mt-1 text-[11px] text-[#9ca3af] dark:text-[#86868B]">{hint}</div>}
    </div>
  );
}
