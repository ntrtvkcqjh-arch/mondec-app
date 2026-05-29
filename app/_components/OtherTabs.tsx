"use client";

import { useGameStore } from "@/lib/supabase-store";
import { Calendar, FolderOpen, GraduationCap, ClipboardCheck, Users, Trophy, Sparkles, Flame } from "lucide-react";

function getPhaseColor(phase: string | null) {
  switch (phase) {
    case "P5": return "bg-[#FF3B30]/15 text-[#FF3B30]";
    case "P4": return "bg-[#FF9500]/15 text-[#FF9500]";
    case "P3": return "bg-[#007AFF]/15 text-[#007AFF]";
    case "P2": return "bg-[#34C759]/15 text-[#34C759]";
    default: return "bg-[#86868B]/15 text-[#86868B]";
  }
}

export function EquipeView() {
  const store = useGameStore();
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-5">
          <h2 className="text-[32px] font-semibold text-[#1D1D1F] tracking-[-0.022em] leading-tight">Équipe</h2>
          <p className="text-[13px] text-[#86868B] mt-1">{store.agents.length} collaborateurs · Cabinet Morel &amp; Associés</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {store.agents.map((a) => (
            <div key={a.id} className="bg-white rounded-[18px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-[#E5E5EA]/30 hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-all">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold shadow-sm shrink-0" style={{ backgroundColor: a.avatar_color }}>
                  {a.initiales}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[14px] text-[#1D1D1F] truncate">{a.nom}</div>
                  <div className="text-[11px] text-[#86868B] truncate">{a.role}</div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium inline-block mt-1 ${
                    a.emotion === "Stable" ? "bg-[#34C759]/10 text-[#34C759]" :
                    a.emotion === "Concentré" ? "bg-[#007AFF]/10 text-[#007AFF]" :
                    a.emotion === "Anxieux" ? "bg-[#FF9500]/10 text-[#FF9500]" :
                    a.emotion === "Frustré" ? "bg-[#FF3B30]/10 text-[#FF3B30]" :
                    a.emotion === "Surmené" ? "bg-[#FF3B30]/10 text-[#FF3B30]" :
                    "bg-[#E5E5EA] text-[#86868B]"
                  }`}>
                    {a.emotion}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#86868B] w-14">Stress</span>
                  <div className="flex-1 h-[3px] bg-[#E5E5EA] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${a.stress}%`, backgroundColor: a.stress > 70 ? "#FF3B30" : "#007AFF" }} />
                  </div>
                  <span className="text-[10px] text-[#86868B] w-5 text-right">{a.stress}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#86868B] w-14">Fatigue</span>
                  <div className="flex-1 h-[3px] bg-[#E5E5EA] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${a.fatigue}%`, backgroundColor: a.fatigue > 70 ? "#FF3B30" : "#007AFF" }} />
                  </div>
                  <span className="text-[10px] text-[#86868B] w-5 text-right">{a.fatigue}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#86868B] w-14">Confiance</span>
                  <div className="flex-1 h-[3px] bg-[#E5E5EA] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${a.confiance_joueur}%`, backgroundColor: a.confiance_joueur > 70 ? "#34C759" : "#007AFF" }} />
                  </div>
                  <span className="text-[10px] text-[#86868B] w-5 text-right">{a.confiance_joueur}</span>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-[#F5F5F7] flex items-center justify-between">
                <span className="text-[10px] text-[#86868B] bg-[#F5F5F7] px-2 py-0.5 rounded-full">{a.filiere}</span>
                <span className={`text-[10px] font-medium ${a.statut === "En ligne" ? "text-[#34C759]" : a.statut === "Occupé" ? "text-[#FF9500]" : "text-[#86868B]"}`}>{a.statut}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AgendaView() {
  const store = useGameStore();
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-5">
          <h2 className="text-[32px] font-semibold text-[#1D1D1F] tracking-[-0.022em] leading-tight">Agenda du jour</h2>
          <p className="text-[13px] text-[#86868B] mt-1">Jour {store.game_day} · {String(store.game_hour).padStart(2, "0")}:{String(store.game_minute).padStart(2, "0")} · Campagne Bilan &amp; AG</p>
        </div>

        <div className="bg-gradient-to-br from-[#FF3B30]/8 to-[#FF9500]/8 border border-[#FF3B30]/20 rounded-[18px] p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Flame size={16} className="text-[#FF3B30]" />
            <span className="font-semibold text-[14px] text-[#1D1D1F]">Boss Fight — Clôture bilan 30/06</span>
            <span className="ml-auto text-[13px] font-bold text-[#FF3B30]">J-16</span>
          </div>
          <p className="text-[12px] text-[#86868B]">Signature bilan Vidal Industrie · Provision risque client en suspens</p>
        </div>

        <div className="space-y-2">
          {[
            { h: "08:30", titre: "Briefing matinal équipe", duree: "30min" },
            { h: "09:30", titre: "Calcul acompte IS — Martin SARL", duree: "45min" },
            { h: "10:30", titre: "RDV client Vidal Industrie", duree: "60min" },
            { h: "11:30", titre: "Traitement écart de conversion IFRS", duree: "45min" },
            { h: "12:30", titre: "Pause déjeuner", duree: "60min" },
            { h: "14:00", titre: "Liasse fiscale — petite SARL", duree: "45min" },
            { h: "15:00", titre: "Médiation conflit Hugo / Amélie", duree: "45min" },
            { h: "16:00", titre: "Provision risque — méthodologie", duree: "45min" },
            { h: "17:00", titre: "Validation bilan Petit", duree: "30min" },
            { h: "18:00", titre: "Debrief fin de journée", duree: "30min" },
          ].map((slot) => (
            <div key={slot.h} className="bg-white rounded-[14px] p-3 border border-[#E5E5EA]/40 flex items-center gap-3">
              <div className="w-14 text-right shrink-0">
                <div className="text-[13px] font-mono font-semibold tabular-nums text-[#1D1D1F]">{slot.h}</div>
                <div className="text-[9px] text-[#86868B]">{slot.duree}</div>
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-[#1D1D1F]">{slot.titre}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DossiersView() {
  const store = useGameStore();
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-5">
          <h2 className="text-[32px] font-semibold text-[#1D1D1F] tracking-[-0.022em] leading-tight">Dossiers clients</h2>
          <p className="text-[13px] text-[#86868B] mt-1">Aperçu en temps réel · Les statuts évoluent selon ton travail</p>
        </div>

        <div className="space-y-2">
          {store.dossiers.map((d) => {
            const a = store.agents.find((x) => x.id === d.agent_id);
            return (
              <div key={d.id} className="bg-white rounded-[14px] p-4 border border-[#E5E5EA]/40">
                <div className="flex items-start gap-3">
                  {a && (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0 shadow-sm" style={{ backgroundColor: a.avatar_color }}>
                      {a.initiales}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[14px] text-[#1D1D1F]">{d.client}</span>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${getPhaseColor(d.phase)}`}>{d.phase}</span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md ml-auto bg-[#007AFF]/15 text-[#007AFF]">
                        {d.etat === "en_cours" ? "EN COURS" : d.etat === "avance" ? "AVANCÉ" : d.etat === "cloture" ? "CLÔTURÉ" : d.etat === "perdu" ? "PERDU" : "SURVEILLANCE"}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#86868B] mb-2">{d.theme}</p>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] text-[#86868B] w-16">Progression</span>
                      <div className="flex-1 h-[4px] bg-[#E5E5EA] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${d.progression}%`, backgroundColor: "#007AFF" }} />
                      </div>
                      <span className="text-[10px] font-semibold text-[#3a3a3c] tabular-nums w-8 text-right">{d.progression}%</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {store.dossiers.length === 0 && (
            <div className="text-center py-12 text-[#86868B]">
              <FolderOpen size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-[13px]">Aucun dossier actif</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TasksView() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-5">
          <h2 className="text-[32px] font-semibold text-[#1D1D1F] tracking-[-0.022em] leading-tight">Tâches</h2>
          <p className="text-[13px] text-[#86868B] mt-1">Documents à valider — fonctionnalité en cours de stabilisation</p>
        </div>
        <div className="bg-white rounded-[18px] p-6 border border-[#E5E5EA]/40 text-center">
          <ClipboardCheck size={32} className="text-[#86868B] mx-auto mb-2 opacity-50" />
          <p className="text-[13px] text-[#86868B]">Module en cours de stabilisation.</p>
          <p className="text-[11px] text-[#86868B] mt-1">Sera réintégré dans le prochain build.</p>
        </div>
      </div>
    </div>
  );
}

export function DecPrepView() {
  const store = useGameStore();
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-5">
          <h2 className="text-[32px] font-semibold text-[#1D1D1F] tracking-[-0.022em] leading-tight">DEC Prep</h2>
          <p className="text-[13px] text-[#86868B] mt-1">Niveau {store.player_level}/10 · {store.player_xp} XP</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gradient-to-br from-[#FF9500]/10 to-[#FF3B30]/10 border border-[#FF9500]/20 rounded-[16px] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trophy size={16} className="text-[#FF9500]" />
              <span className="font-semibold text-[13px] text-[#1D1D1F]">Niveau actuel</span>
            </div>
            <div className="text-[36px] font-bold text-[#1D1D1F] tabular-nums leading-none">{store.player_level}</div>
            <div className="text-[11px] text-[#86868B] mt-1">{store.xp_to_next - store.player_xp} XP avant niveau {store.player_level + 1}</div>
          </div>
          <div className="bg-gradient-to-br from-[#007AFF]/10 to-[#5856D6]/10 border border-[#007AFF]/20 rounded-[16px] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-[#007AFF]" />
              <span className="font-semibold text-[13px] text-[#1D1D1F]">Total XP</span>
            </div>
            <div className="text-[36px] font-bold text-[#1D1D1F] tabular-nums leading-none">{store.player_xp}</div>
            <div className="text-[11px] text-[#86868B] mt-1">Gagné en répondant aux agents</div>
          </div>
        </div>

        <div className="bg-white rounded-[16px] p-4 shadow-sm border border-[#E5E5EA]/30">
          <p className="font-semibold text-[13px] text-[#1D1D1F] mb-3">Modules DEC</p>
          <p className="text-[12px] text-[#86868B]">QCM Déontologie + 6 missions cas pratiques en cours de stabilisation. Sera réintégré dans le prochain build.</p>
        </div>
      </div>
    </div>
  );
}
