"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/supabase-store";
import { Mail, AlertTriangle, X, Zap, Users, Briefcase } from "lucide-react";

interface Notif {
  id: string;
  emoji: string;
  title: string;
  description: string;
  type: "info" | "warning" | "danger" | "success";
  timestamp: number;
}

/**
 * Surveille le store et affiche des toasts en bas à droite quand
 * des cascades inter-onglets se déclenchent.
 */
export function CascadeNotifications() {
  const store = useGameStore();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [lastMessageCount, setLastMessageCount] = useState(store.messages.length);
  const [lastAgentCount, setLastAgentCount] = useState(store.agents.length);

  // Détecte les nouveaux messages auto (Suivi Fiscal → Messagerie)
  useEffect(() => {
    const currentCount = store.messages.length;
    if (currentCount > lastMessageCount && lastMessageCount > 0) {
      // Trouve les messages récents non-lus
      const recent = store.messages
        .filter((m) => !m.lu)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, currentCount - lastMessageCount);

      recent.forEach((msg, i) => {
        const agent = store.agents.find((a) => a.id === msg.agent_id);
        if (!agent) return;
        const isDanger = msg.niveau === "N5" || msg.sujet.includes("PERDU") || msg.sujet.includes("Mise en demeure");
        const isWarning = msg.niveau === "N4" || msg.sujet.includes("⚠");
        const notif: Notif = {
          id: `msg_${msg.id}_${i}`,
          emoji: msg.sujet.match(/^(\p{Emoji}|⚠|🎉|💥|📛|🎭)/u)?.[0] || "📩",
          title: `${agent.nom.split(" ")[0]} : ${msg.sujet.replace(/^(\p{Emoji}|⚠|🎉|💥|📛|🎭)\s*/u, "")}`,
          description: msg.contenu.substring(0, 80) + "…",
          type: isDanger ? "danger" : isWarning ? "warning" : "info",
          timestamp: Date.now(),
        };
        setNotifs((prev) => [notif, ...prev].slice(0, 4));
      });
    }
    setLastMessageCount(currentCount);
  }, [store.messages.length]);

  // Détecte les nouveaux agents (RH → Équipe)
  useEffect(() => {
    if (store.agents.length > lastAgentCount && lastAgentCount > 0) {
      const newest = store.agents[store.agents.length - 1];
      const notif: Notif = {
        id: `new_agent_${newest.id}`,
        emoji: "🎉",
        title: `${newest.nom} a rejoint l'équipe`,
        description: `${newest.role} · ${newest.filiere}. Bienvenue !`,
        type: "success",
        timestamp: Date.now(),
      };
      setNotifs((prev) => [notif, ...prev].slice(0, 4));
    }
    setLastAgentCount(store.agents.length);
  }, [store.agents.length]);

  // Auto-dismiss après 8 secondes
  useEffect(() => {
    if (notifs.length === 0) return;
    const t = setTimeout(() => {
      setNotifs((prev) => prev.filter((n) => Date.now() - n.timestamp < 8000));
    }, 1000);
    return () => clearTimeout(t);
  }, [notifs]);

  function dismissNotif(id: string) {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  }

  if (notifs.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-5 z-40 flex flex-col gap-2 max-w-[340px] pointer-events-none">
      {notifs.map((n) => {
        const colorMap = {
          info: { bg: "bg-[#007AFF]", border: "border-[#007AFF]/30", text: "text-[#007AFF]" },
          warning: { bg: "bg-[#FF9500]", border: "border-[#FF9500]/30", text: "text-[#FF9500]" },
          danger: { bg: "bg-[#FF3B30]", border: "border-[#FF3B30]/30", text: "text-[#FF3B30]" },
          success: { bg: "bg-[#34C759]", border: "border-[#34C759]/30", text: "text-[#34C759]" },
        };
        const c = colorMap[n.type];

        return (
          <div key={n.id} className={`bg-white dark:bg-[#1c1c1e] border ${c.border} dark:border-[#38383a]/60 rounded-[14px] p-3 shadow-xl dark:shadow-black/40 pointer-events-auto animate-in slide-in-from-right duration-500 backdrop-blur-xl`}>
            <div className="flex items-start gap-2.5">
              <div className={`w-8 h-8 rounded-full ${c.bg} flex items-center justify-center shrink-0 text-white text-[14px]`}>
                {n.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white leading-snug">{n.title}</h4>
                  <button onClick={() => dismissNotif(n.id)} className="shrink-0 -mt-0.5 -mr-0.5 w-4 h-4 rounded-full bg-[#F5F5F7] dark:bg-[#2c2c2e] hover:bg-[#E5E5EA] dark:hover:bg-[#38383a] flex items-center justify-center">
                    <X size={9} className="text-[#86868B] dark:text-[#98989D]" />
                  </button>
                </div>
                <p className="text-[10px] text-[#86868B] dark:text-[#98989D] mt-1 leading-relaxed line-clamp-2">{n.description}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
