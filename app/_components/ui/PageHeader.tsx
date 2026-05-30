"use client";

interface Props {
  title: string; // ex : "DOSSIERS"
  stats: Array<{ value: string | number; label: string; tone?: "default" | "warning" | "critical" }>;
}

/**
 * Header unique pour toutes les vues — grammaire visuelle PHDDEC :
 *  - Titre énorme uppercase avec point coloré accent (#5B7CFA)
 *  - Sous-titre = chiffres clés, ton sec, scannable en 1 seconde
 *  - Même placement, même taille, même respiration partout
 */
export function PageHeader({ title, stats }: Props) {
  return (
    <header className="pt-12 pb-8 px-10 max-w-[1200px] mx-auto fade-up">
      <h1 className="display-num text-[64px] font-semibold leading-[0.9]" style={{ color: "var(--mdec-text)" }}>
        {title}<span style={{ color: "var(--mdec-accent)" }}>.</span>
      </h1>
      <div className="mt-5 flex items-center gap-x-7 gap-y-1 flex-wrap text-[14px]">
        {stats.map((s, i) => (
          <div key={i} className="flex items-baseline gap-1.5">
            <span className={`font-semibold tabular-nums ${
              s.tone === "critical" ? "text-[var(--mdec-rose)]" :
              s.tone === "warning" ? "text-[var(--mdec-amber)]" :
              ""
            }`} style={s.tone === "critical" || s.tone === "warning" ? undefined : { color: "var(--mdec-text)" }}>
              {s.value}
            </span>
            <span style={{ color: "var(--mdec-text-3)" }}>{s.label}</span>
            {i < stats.length - 1 && <span className="ml-7" style={{ color: "var(--mdec-text-4)" }}>·</span>}
          </div>
        ))}
      </div>
    </header>
  );
}
