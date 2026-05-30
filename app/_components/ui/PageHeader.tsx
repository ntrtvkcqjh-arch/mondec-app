"use client";

interface Props {
  title: string; // ex : "DOSSIERS"
  stats: Array<{ value: string | number; label: string; tone?: "default" | "warning" | "critical" }>;
}

/**
 * Header unique pour toutes les vues. Grammaire visuelle Apple :
 *  - Titre énorme uppercase avec point final
 *  - Sous-titre = chiffres clés, ton sec, scannable en 1 seconde
 *  - Même placement, même taille, même respiration partout
 */
export function PageHeader({ title, stats }: Props) {
  return (
    <header className="pt-12 pb-8 px-10 max-w-[1200px] mx-auto">
      <h1 className="text-[64px] font-semibold tracking-[-0.045em] leading-[0.9] text-[#111111] dark:text-white">
        {title}<span className="text-[#007AFF]">.</span>
      </h1>
      <div className="mt-5 flex items-center gap-x-7 gap-y-1 flex-wrap text-[14px]">
        {stats.map((s, i) => (
          <div key={i} className="flex items-baseline gap-1.5">
            <span className={`font-semibold tabular-nums ${
              s.tone === "critical" ? "text-[#FF3B30]" :
              s.tone === "warning" ? "text-[#FF9500]" :
              "text-[#111111] dark:text-white"
            }`}>
              {s.value}
            </span>
            <span className="text-[#6b7280] dark:text-[#98989D]">{s.label}</span>
            {i < stats.length - 1 && <span className="text-[#d1d5db] dark:text-[#3a3a3c] ml-7">·</span>}
          </div>
        ))}
      </div>
    </header>
  );
}
