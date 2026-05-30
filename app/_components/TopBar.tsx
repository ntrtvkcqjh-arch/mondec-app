"use client";

import { useGameStore } from "@/lib/supabase-store";
import { Sparkles, Coffee, Briefcase, Moon, Sunrise } from "lucide-react";

interface Props {
  apiStatus: "checking" | "ok" | "error";
}

/**
 * Barre de statut style macOS menubar — sticky en haut.
 * Affiche : date complète, horloge XL, mood, ressources clés.
 * Très minimaliste, beaucoup d'air. Frosted backdrop.
 */
export function TopBar({ apiStatus }: Props) {
  const store = useGameStore();

  // Date réelle calculée depuis game_day (départ 14 mai 2026)
  const today = new Date(2026, 4, 14);
  today.setDate(today.getDate() + store.game_day - 1);
  const dateLabel = today.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Icône période de la journée
  const PeriodIcon =
    store.game_hour < 7 ? Moon :
    store.game_hour < 12 ? Sunrise :
    store.game_hour < 14 ? Coffee :
    store.game_hour < 19 ? Briefcase :
    Moon;

  // Temps formaté
  const tempsMin = store.temps_disponible_min ?? 480;
  const tempsMax = store.temps_disponible_max ?? 480;
  const tempsH = Math.floor(tempsMin / 60);
  const tempsM = tempsMin % 60;
  const tempsRatio = Math.max(0, tempsMin / tempsMax);
  const overtime = (store.heures_sup_cumul ?? 0) > 0;
  const tempsColor =
    overtime ? "#FF3B30" :
    tempsRatio < 0.15 ? "#FF3B30" :
    tempsRatio < 0.4 ? "#FF9500" :
    "#34C759";

  return (
    <header className="sticky top-0 z-20 backdrop-blur-2xl bg-white/70 dark:bg-black/40 border-b border-[#E5E5EA]/40 dark:border-[#38383a]/40">
      <div className="px-6 h-[52px] flex items-center gap-6">
        {/* Gauche : Période + Date */}
        <div className="flex items-center gap-2.5 min-w-0">
          <PeriodIcon size={14} className="text-[#86868B] dark:text-[#98989D] shrink-0" />
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[12px] font-medium text-[#86868B] dark:text-[#98989D] uppercase tracking-[0.08em]">
              Jour {store.game_day}
            </span>
            <span className="text-[12px] text-[#1D1D1F] dark:text-white capitalize truncate">
              {dateLabel}
            </span>
          </div>
        </div>

        {/* Centre : Horloge XL */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[20px] font-semibold text-[#1D1D1F] dark:text-white tabular-nums tracking-tight leading-none">
              {String(store.game_hour).padStart(2, "0")}:{String(store.game_minute).padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Droite : Indicateurs (mood, tréso, temps, IA) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mood pill */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5F5F7] dark:bg-[#2c2c2e]">
            <div className={`w-1.5 h-1.5 rounded-full ${
              store.mood_global === "Crise" ? "bg-[#FF3B30] animate-pulse" :
              store.mood_global === "Sous Pression" ? "bg-[#FF9500]" :
              store.mood_global === "Stable" ? "bg-[#34C759]" :
              "bg-[#86868B]"
            }`} />
            <span className="text-[11px] font-medium text-[#1D1D1F] dark:text-white">
              {store.mood_global}
            </span>
          </div>

          {/* Trésorerie */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5F5F7] dark:bg-[#2c2c2e]">
            <span className="text-[11px] text-[#86868B] dark:text-[#98989D]">€</span>
            <span className="text-[11px] font-semibold text-[#1D1D1F] dark:text-white tabular-nums">
              {(store.tresorerie / 1000).toFixed(0)}k
            </span>
          </div>

          {/* Temps disponible (mini barre) */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#F5F5F7] dark:bg-[#2c2c2e]" title={overtime ? "Heures supplémentaires" : "Temps disponible"}>
            <span className="text-[11px] font-mono font-semibold tabular-nums" style={{ color: tempsColor }}>
              {tempsH}h{String(tempsM).padStart(2, "0")}
            </span>
            <div className="w-12 h-[3px] bg-[#E5E5EA] dark:bg-[#38383a] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${tempsRatio * 100}%`, backgroundColor: tempsColor }} />
            </div>
            {overtime && (
              <span className="text-[9px] font-bold text-[#FF3B30] uppercase tracking-wider">SUP</span>
            )}
          </div>

          {/* Statut IA Claude */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5F5F7] dark:bg-[#2c2c2e]" title={`IA Claude ${apiStatus === "ok" ? "connectée" : apiStatus === "error" ? "hors ligne" : "vérification"}`}>
            <Sparkles size={11} className={
              apiStatus === "ok" ? "text-[#34C759]" :
              apiStatus === "error" ? "text-[#FF3B30]" :
              "text-[#FF9500]"
            } />
            <div className={`w-1.5 h-1.5 rounded-full ${
              apiStatus === "ok" ? "bg-[#34C759] animate-pulse" :
              apiStatus === "error" ? "bg-[#FF3B30]" :
              "bg-[#FF9500]"
            }`} />
          </div>
        </div>
      </div>
    </header>
  );
}
