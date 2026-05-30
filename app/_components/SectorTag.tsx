"use client";

// Tag coloré pour la catégorie d'activité d'une entreprise.
// Reprend la convention iOS : pastille + label, couleurs cohérentes par secteur.

type Categorie = "Industrie" | "Commerce" | "Restauration" | "Services" | "Artisanat" | "Association" | string;

const COLORS: Record<string, { bg: string; text: string; emoji: string }> = {
  Industrie:    { bg: "bg-[#5856D6]/12 dark:bg-[#5E5CE6]/20",  text: "text-[#5856D6] dark:text-[#5E5CE6]", emoji: "🏭" },
  Commerce:     { bg: "bg-[#34C759]/12 dark:bg-[#30D158]/20",  text: "text-[#248A3D] dark:text-[#30D158]", emoji: "🛍️" },
  Restauration: { bg: "bg-[#FF9500]/12 dark:bg-[#FF9F0A]/20",  text: "text-[#C76A00] dark:text-[#FF9F0A]", emoji: "🍽️" },
  Services:     { bg: "bg-[#007AFF]/12 dark:bg-[#0A84FF]/20",  text: "text-[#007AFF] dark:text-[#0A84FF]", emoji: "💼" },
  Artisanat:    { bg: "bg-[#AF52DE]/12 dark:bg-[#BF5AF2]/20",  text: "text-[#8334B8] dark:text-[#BF5AF2]", emoji: "🔧" },
  Association:  { bg: "bg-[#FF2D55]/12 dark:bg-[#FF375F]/20",  text: "text-[#C9244C] dark:text-[#FF375F]", emoji: "🤝" },
};

const FALLBACK = { bg: "bg-[#86868B]/12 dark:bg-white/10", text: "text-[#3a3a3c] dark:text-[#98989D]", emoji: "🏢" };

export function SectorTag({ categorie, size = "md" }: { categorie?: Categorie; size?: "sm" | "md" }) {
  if (!categorie) return null;
  const c = COLORS[categorie] || FALLBACK;
  const sizing = size === "sm"
    ? "text-[9px] px-1.5 py-[2px] gap-1"
    : "text-[10px] px-2 py-[3px] gap-1";
  return (
    <span className={`inline-flex items-center ${sizing} rounded-md font-semibold ${c.bg} ${c.text}`}>
      <span className="leading-none">{c.emoji}</span>
      <span className="leading-none">{categorie}</span>
    </span>
  );
}
