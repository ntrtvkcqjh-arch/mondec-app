"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/supabase-store";
import { Sparkles, X } from "lucide-react";

interface Props {
  onOpenChat: () => void;
  onQuickAction?: (action: { type: "talk_agent" | "open_tab"; agentId?: string; tab?: string }) => void;
}

interface Conseil {
  text: string;
  priority: "haute" | "moyenne" | "basse";
  emoji: string;
  quickAction?: { label: string; type: "talk_agent" | "open_tab"; agentId?: string; tab?: string };
}

export function ClaudeTuteur({ onOpenChat, onQuickAction }: Props) {
  const store = useGameStore();
  const [conseil, setConseil] = useState<Conseil | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Génère un conseil contextuel selon l'état du cabinet
  useEffect(() => {
    if (dismissed) return;
    const conseils: Conseil[] = [];

    // Détecte retards urgents
    const unreadUrgent = store.messages.filter((m) => !m.lu && m.delai_reponse_heures <= 6).length;
    if (unreadUrgent > 0) {
      conseils.push({
        text: `${unreadUrgent} message${unreadUrgent > 1 ? "s" : ""} urgent${unreadUrgent > 1 ? "s" : ""} à traiter avant l'échéance.`,
        priority: "haute",
        emoji: "🔴",
      });
    }

    // Détecte agent en burn-out
    const burnoutAgents = store.agents.filter((a) => a.stress > 80 || a.fatigue > 80);
    if (burnoutAgents.length > 0) {
      const a = burnoutAgents[0];
      conseils.push({
        text: `${a.nom.split(" ")[0]} est au bord du burn-out. Un "Parler" rapide pourrait éviter le pire.`,
        priority: "haute",
        emoji: "🔥",
      });
    }

    // Détecte arc Rupture — countdown réel basé sur dernière action positive
    const ruptures = store.agents.filter((a: any) => a.arc_actuel === "Rupture");
    if (ruptures.length > 0) {
      const a = ruptures[0];
      const history = store.agent_player_history[a.id] || [];
      const lastPositiveDay = history
        .filter((h) => h.impact && h.impact.includes("+"))
        .reduce((max, h) => Math.max(max, h.day), 0);
      const daysSinceCare = lastPositiveDay > 0 ? store.game_day - lastPositiveDay : 5;
      const countdown = Math.max(1, 5 - daysSinceCare);
      conseils.push({
        text: `${a.nom.split(" ")[0]} donnera sa préavis dans ${countdown} jour${countdown > 1 ? "s" : ""} si tu n'agis pas. Un entretien rapide peut tout changer.`,
        priority: "haute",
        emoji: "💼",
        quickAction: { label: `Parler à ${a.nom.split(" ")[0]} →`, type: "talk_agent", agentId: a.id },
      });
    }

    // Trésorerie basse
    if (store.tresorerie < 30000) {
      conseils.push({
        text: `Trésorerie basse (${(store.tresorerie / 1000).toFixed(0)}k€). Évite les formations cette semaine.`,
        priority: "moyenne",
        emoji: "💰",
      });
    }

    // Légitimité basse
    if (store.legitimite < 40) {
      conseils.push({
        text: `Légitimité fragile (${store.legitimite}/100). Une bonne tâche validée te referait remonter.`,
        priority: "moyenne",
        emoji: "⚖️",
      });
    }

    // Prospects en attente
    if (store.prospects_pending.length > 0) {
      conseils.push({
        text: `${store.prospects_pending.length} prospect${store.prospects_pending.length > 1 ? "s" : ""} attend${store.prospects_pending.length === 1 ? "" : "ent"} ta réponse. Honoraires en jeu.`,
        priority: "moyenne",
        emoji: "🎉",
      });
    }

    // DEC du jour pas fait
    if (!store.dec_today_deonto && !store.dec_today_mission && store.game_hour < 17) {
      conseils.push({
        text: `Tu n'as pas encore fait ton module DEC du jour. Streak en danger !`,
        priority: "basse",
        emoji: "🎓",
        quickAction: { label: "Ouvrir DEC Prep →", type: "open_tab", tab: "dec" },
      });
    }

    // Trier par priorité et prendre le premier
    conseils.sort((a, b) => {
      const order = { haute: 0, moyenne: 1, basse: 2 };
      return order[a.priority] - order[b.priority];
    });

    setConseil(conseils[0] || null);
  }, [store.messages, store.agents, store.tresorerie, store.legitimite, store.prospects_pending.length, store.points_action, store.dec_today_deonto, store.dec_today_mission, store.game_hour, dismissed]);

  // Réactiver le tuteur tous les 30 minutes jeu
  useEffect(() => {
    if (store.game_minute % 30 === 0) setDismissed(false);
  }, [store.game_minute]);

  if (!conseil || dismissed) return null;

  const priorityColor = conseil.priority === "haute" ? "border-[#FF3B30]/40 bg-[#FF3B30]/8 dark:bg-[#FF3B30]/12" : conseil.priority === "moyenne" ? "border-[#FF9500]/40 bg-[#FF9500]/8 dark:bg-[#FF9500]/12" : "border-[#007AFF]/40 bg-[#007AFF]/8 dark:bg-[#007AFF]/12";

  return (
    <div className={`mx-3 mb-2 p-2.5 rounded-[12px] border ${priorityColor} relative`}>
      <button onClick={() => setDismissed(true)} className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center">
        <X size={9} className="text-[#86868B] dark:text-[#98989D]" />
      </button>
      <div className="flex items-start gap-2 pr-4">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#007AFF] via-[#5856D6] to-[#AF52DE] flex items-center justify-center shrink-0">
          <Sparkles size={11} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold text-[#1D1D1F] dark:text-white mb-0.5 flex items-center gap-1">
            <span>Claude tuteur</span>
            <span className="w-1 h-1 rounded-full bg-[#34C759] animate-pulse" />
          </div>
          <p className="text-[10px] text-[#3a3a3c] dark:text-[#98989D] leading-snug">
            <span className="mr-1">{conseil.emoji}</span>{conseil.text}
          </p>
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            {conseil.quickAction && onQuickAction && (
              <button
                onClick={() => onQuickAction(conseil.quickAction!)}
                className="text-[10px] text-white bg-[#007AFF] dark:bg-[#0A84FF] hover:bg-[#0066d4] dark:hover:bg-[#0070e0] px-2 py-0.5 rounded-md font-semibold transition-all"
              >
                {conseil.quickAction.label}
              </button>
            )}
            <button onClick={onOpenChat} className="text-[10px] text-[#007AFF] dark:text-[#0A84FF] hover:underline font-medium">
              Demander conseil →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
