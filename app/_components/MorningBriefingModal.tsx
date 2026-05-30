"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/supabase-store";
import { X, ChevronRight, Sunrise } from "lucide-react";

interface Props {
  onClose: () => void;
  onNavigate: (tab: "messages" | "equipe" | "agenda" | "tasks" | "dossiers" | "fiscal" | "rh" | "dec", payload?: any) => void;
}

interface Priority {
  level: "haute" | "moyenne" | "basse";
  emoji: string;
  source: string;
  text: string;
  action: { tab: Props["onNavigate"] extends (t: infer T, p?: any) => any ? T : never; agentId?: string; label: string };
}

/**
 * Tableau de bord matinal : agrège les priorités cross-onglets pour aider
 * l'expert-comptable à savoir par où commencer la journée.
 * S'affiche en début de journée (1 fois par game_day).
 */
export function MorningBriefingModal({ onClose, onNavigate }: Props) {
  const store = useGameStore();

  // Calcule les priorités à partir de l'état du cabinet
  const priorities: Priority[] = [];

  // 1. Messages urgents (N5 / N4 / retards)
  const urgentMessages = store.messages.filter((m) => !m.repondu && (m.niveau === "N5" || m.delai_reponse_heures <= 6));
  urgentMessages.slice(0, 2).forEach((m) => {
    const agent = store.agents.find((a) => a.id === m.agent_id);
    priorities.push({
      level: "haute",
      emoji: m.niveau === "N5" ? "🚨" : "🔴",
      source: "Messagerie",
      text: `${agent?.nom.split(" ")[0] || "?"} : ${m.sujet}`,
      action: { tab: "messages", agentId: m.agent_id, label: "Répondre" },
    });
  });

  // 2. Agents au bord du burn-out
  const burnouts = store.agents.filter((a) => a.stress > 80 || a.fatigue > 80);
  burnouts.slice(0, 2).forEach((a) => {
    priorities.push({
      level: "haute",
      emoji: "🔥",
      source: "Équipe",
      text: `${a.nom} — stress ${a.stress}, fatigue ${a.fatigue}`,
      action: { tab: "messages", agentId: a.id, label: "Parler" },
    });
  });

  // 3. Arc Rupture (départ imminent)
  const ruptures = store.agents.filter((a: any) => a.arc_actuel === "Rupture");
  ruptures.forEach((a) => {
    priorities.push({
      level: "haute",
      emoji: "💼",
      source: "Équipe",
      text: `${a.nom} envisage de partir`,
      action: { tab: "messages", agentId: a.id, label: "Entretien" },
    });
  });

  // 4. Prospects en attente
  if (store.prospects_pending.length > 0) {
    priorities.push({
      level: "moyenne",
      emoji: "🎉",
      source: "Nouveaux clients",
      text: `${store.prospects_pending.length} prospect${store.prospects_pending.length > 1 ? "s" : ""} en attente`,
      action: { tab: "dossiers", label: "Voir" },
    });
  }

  // 5. Trésorerie basse
  if (store.tresorerie < 30000) {
    priorities.push({
      level: "moyenne",
      emoji: "💰",
      source: "Finance",
      text: `Trésorerie basse : ${(store.tresorerie / 1000).toFixed(0)}k€`,
      action: { tab: "rh", label: "Vérifier RH" },
    });
  }

  // 6. Dossiers en surveillance / perdus récents
  const dossiersAlertes = store.dossiers.filter((d) => d.etat === "surveillance" || d.signaux_alerte.length > 0);
  if (dossiersAlertes.length > 0) {
    priorities.push({
      level: "moyenne",
      emoji: "📁",
      source: "Dossiers",
      text: `${dossiersAlertes.length} dossier${dossiersAlertes.length > 1 ? "s" : ""} en surveillance`,
      action: { tab: "dossiers", label: "Voir" },
    });
  }

  // 7. DEC du jour pas fait
  if (!store.dec_today_deonto && !store.dec_today_mission) {
    priorities.push({
      level: "basse",
      emoji: "🎓",
      source: "DEC Prep",
      text: `Module DEC du jour pas encore fait — streak ${store.dec_streak}j`,
      action: { tab: "dec", label: "Commencer" },
    });
  }

  // Tri par priorité
  const orderedPriorities = priorities.sort((a, b) => {
    const order = { haute: 0, moyenne: 1, basse: 2 };
    return order[a.level] - order[b.level];
  }).slice(0, 8);

  const date = new Date();
  date.setDate(new Date(2026, 4, 14).getDate() + store.game_day - 1);
  date.setMonth(4);
  date.setFullYear(2026);
  const dateLabel = date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="fixed inset-0 z-[55] bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] shadow-2xl dark:shadow-black/60 w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col border border-transparent dark:border-[#38383a]/60">
        <div className="px-6 py-4 border-b border-[#E5E5EA]/40 dark:border-[#38383a]/60 bg-gradient-to-r from-[#FF9500]/8 via-[#FFCC00]/8 to-[#007AFF]/8 dark:from-[#FF9F0A]/12 dark:via-[#FFD60A]/12 dark:to-[#0A84FF]/12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#FF9500] to-[#FF3B30] flex items-center justify-center shadow-md">
                <Sunrise size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-[17px] text-[#1D1D1F] dark:text-white tracking-tight">Briefing matinal</h3>
                <p className="text-[12px] text-[#86868B] dark:text-[#98989D] capitalize">{dateLabel}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/80 dark:bg-[#2c2c2e] hover:bg-white dark:hover:bg-[#38383a] flex items-center justify-center">
              <X size={14} className="text-[#86868B] dark:text-[#98989D]" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {orderedPriorities.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-[40px] mb-2">☕</div>
              <p className="text-[13px] text-[#86868B] dark:text-[#98989D]">Aucune urgence ce matin. Profite-en pour traiter les dossiers de fond.</p>
            </div>
          ) : (
            <>
              <p className="text-[12px] text-[#86868B] dark:text-[#98989D] mb-3">
                Voici les {orderedPriorities.length} point{orderedPriorities.length > 1 ? "s" : ""} à traiter ce matin, classé{orderedPriorities.length > 1 ? "s" : ""} par priorité.
              </p>
              <div className="space-y-1.5">
                {orderedPriorities.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => { onNavigate(p.action.tab, { agentId: p.action.agentId }); onClose(); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-[12px] text-left transition-all hover:translate-x-0.5 border ${
                      p.level === "haute" ? "bg-[#FF3B30]/5 dark:bg-[#FF3B30]/10 border-[#FF3B30]/20"
                      : p.level === "moyenne" ? "bg-[#FF9500]/5 dark:bg-[#FF9500]/10 border-[#FF9500]/20"
                      : "bg-[#007AFF]/5 dark:bg-[#0A84FF]/10 border-[#007AFF]/20"
                    }`}
                  >
                    <div className="text-[20px] shrink-0">{p.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B] dark:text-[#98989D]">{p.source}</div>
                      <div className="text-[12px] font-medium text-[#1D1D1F] dark:text-white truncate">{p.text}</div>
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-[8px] flex items-center gap-1 shrink-0 ${
                      p.level === "haute" ? "bg-[#FF3B30] text-white"
                      : p.level === "moyenne" ? "bg-[#FF9500] text-white"
                      : "bg-[#007AFF] text-white"
                    }`}>
                      {p.action.label} <ChevronRight size={11} />
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-3 bg-[#fafafa] dark:bg-[#161618] border-t border-[#E5E5EA]/40 dark:border-[#38383a]/60 flex items-center justify-between">
          <p className="text-[11px] text-[#86868B] dark:text-[#98989D]">
            Tu as <span className="font-semibold text-[#1D1D1F] dark:text-white">{Math.floor((store.temps_disponible_min ?? 480) / 60)}h{String((store.temps_disponible_min ?? 480) % 60).padStart(2, "0")}</span> de temps disponible aujourd'hui.
          </p>
          <button onClick={onClose} className="px-4 py-2 text-[12px] font-medium rounded-[10px] bg-gradient-to-br from-[#007AFF] to-[#0040DD] text-white shadow-md hover:shadow-lg">
            Commencer la journée
          </button>
        </div>
      </div>
    </div>
  );
}
