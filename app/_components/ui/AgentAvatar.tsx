"use client";

interface Props {
  initials: string;
  color: string;
  emoji?: string;       // emoji visage automatique si non fourni
  agentId?: string;     // pour déterminisme du visage
  agentName?: string;   // pour déterminisme du visage
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  online?: boolean;     // pastille verte si en ligne
  showEmoji?: boolean;  // affiche l'emoji visage à la place des initiales
}

// 12 emojis visages variés (memoji-like)
const FACE_EMOJIS = [
  "👨‍💼", "👩‍💼", "🧑‍💼", "👨‍💻", "👩‍💻", "🧑‍💻",
  "👨🏽‍💼", "👩🏽‍💼", "👨🏾‍💼", "👩🏾‍💼", "👨🏻‍💻", "👩🏻‍💻",
];

function emojiFromId(id?: string, name?: string): string {
  const seed = (id || name || "?").split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return FACE_EMOJIS[seed % FACE_EMOJIS.length];
}

const SIZES = {
  xs: { box: "w-6 h-6", text: "text-[9px]", ring: "border-[1.5px]" },
  sm: { box: "w-8 h-8", text: "text-[10px]", ring: "border-2" },
  md: { box: "w-10 h-10", text: "text-[11px]", ring: "border-2" },
  lg: { box: "w-12 h-12", text: "text-[13px]", ring: "border-2" },
  xl: { box: "w-16 h-16", text: "text-[16px]", ring: "border-[3px]" },
};

/**
 * Avatar enrichi : cercle coloré + initiales OU emoji visage.
 * Optionnel : pastille verte si en ligne (style iMessage/Slack).
 */
export function AgentAvatar({ initials, color, emoji, agentId, agentName, size = "md", online, showEmoji = true }: Props) {
  const s = SIZES[size];
  const displayEmoji = emoji || emojiFromId(agentId, agentName);

  return (
    <div className="relative inline-block shrink-0">
      <div
        className={`${s.box} rounded-full flex items-center justify-center text-white font-semibold shadow-sm overflow-hidden`}
        style={{ backgroundColor: color }}
      >
        {showEmoji ? (
          <span className={size === "xs" ? "text-[12px]" : size === "sm" ? "text-[14px]" : size === "md" ? "text-[18px]" : size === "lg" ? "text-[22px]" : "text-[30px]"}>
            {displayEmoji}
          </span>
        ) : (
          <span className={s.text}>{initials}</span>
        )}
      </div>
      {online && (
        <div className={`absolute -bottom-0.5 -right-0.5 ${size === "xs" || size === "sm" ? "w-2 h-2" : "w-3 h-3"} rounded-full bg-[#34C759] ${s.ring} border-white dark:border-[#14141B]`} title="En ligne" />
      )}
    </div>
  );
}

/**
 * Pastille emoji pour un secteur d'activité client.
 * Permet de visualiser rapidement le type de client (commerce, industrie, etc.)
 */
const SECTOR_EMOJI: Record<string, string> = {
  Industrie: "🏭",
  Commerce: "🛍️",
  Restauration: "🍽️",
  Services: "💼",
  Artisanat: "🔧",
  Association: "🤝",
};

interface ClientLogoProps {
  client: string;
  secteur_categorie?: string;
  size?: "sm" | "md" | "lg";
}

/** Logo client : pastille colorée + emoji secteur + initiale du client */
export function ClientLogo({ client, secteur_categorie, size = "md" }: ClientLogoProps) {
  const emoji = secteur_categorie ? SECTOR_EMOJI[secteur_categorie] || "🏢" : "🏢";
  const initials = client.split(" ").filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "??";
  // Couleur déterministe basée sur le nom
  const seed = client.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const palette = ["#5B7CFA", "#22C09F", "#F0A53C", "#7E5BFA", "#E64A4A", "#3F5BCE"];
  const color = palette[seed % palette.length];
  const boxSize = size === "sm" ? "w-8 h-8 text-[14px]" : size === "lg" ? "w-12 h-12 text-[22px]" : "w-10 h-10 text-[18px]";
  return (
    <div className={`${boxSize} rounded-[12px] flex items-center justify-center shrink-0 shadow-sm`} style={{ background: `linear-gradient(135deg, ${color}22, ${color}44)`, border: `1px solid ${color}66` }}>
      <span>{emoji}</span>
    </div>
  );
}
