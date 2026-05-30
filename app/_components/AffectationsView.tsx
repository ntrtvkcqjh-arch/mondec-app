"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/supabase-store";
import type { Dossier, Agent } from "@/lib/supabase-store";
import { Users, AlertTriangle, GripVertical } from "lucide-react";
import { SectorTag } from "./SectorTag";

/**
 * Vue Affectations : kanban drag-and-drop des dossiers par agent.
 * Drag d'une carte dossier sur une autre colonne agent → reassignDossier
 * avec cascade complète (messages, stress, history).
 */
export function AffectationsView() {
  const store = useGameStore();
  const [draggedDossier, setDraggedDossier] = useState<string | null>(null);
  const [dragOverAgent, setDragOverAgent] = useState<string | null>(null);

  // Dossiers actifs uniquement (en_cours / surveillance / avance)
  const dossiersActifs = store.dossiers.filter((d) => d.etat === "en_cours" || d.etat === "surveillance" || d.etat === "avance");

  // Groupe par agent
  const parAgent: Record<string, Dossier[]> = {};
  store.agents.forEach((a) => { parAgent[a.id] = []; });
  dossiersActifs.forEach((d) => {
    if (parAgent[d.agent_id]) parAgent[d.agent_id].push(d);
    // sinon dossier orphelin (agent supprimé) — ignoré ici
  });

  // Dossiers orphelins (agent licencié non encore réassigné)
  const orphans = dossiersActifs.filter((d) => !store.agents.find((a) => a.id === d.agent_id));

  function handleDragStart(e: React.DragEvent, dossierId: string) {
    setDraggedDossier(dossierId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dossierId);
  }

  function handleDragOver(e: React.DragEvent, agentId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverAgent !== agentId) setDragOverAgent(agentId);
  }

  function handleDragLeave() {
    setDragOverAgent(null);
  }

  function handleDrop(e: React.DragEvent, newAgentId: string) {
    e.preventDefault();
    const dossierId = e.dataTransfer.getData("text/plain") || draggedDossier;
    if (!dossierId) return;
    const dossier = store.dossiers.find((d) => d.id === dossierId);
    if (!dossier) return;
    if (dossier.agent_id === newAgentId) {
      setDraggedDossier(null);
      setDragOverAgent(null);
      return; // déjà affecté
    }
    const res = store.reassignDossier(dossierId, newAgentId);
    if (!res.ok) alert(res.reason || "Réaffectation impossible");
    setDraggedDossier(null);
    setDragOverAgent(null);
  }

  function getAgentChargeColor(charge: number): string {
    if (charge >= 4) return "#FF3B30";
    if (charge >= 3) return "#FF9500";
    return "#34C759";
  }

  function getPhaseColor(phase: string): string {
    switch (phase) {
      case "P5": return "#FF3B30";
      case "P4": return "#FF9500";
      case "P3": return "#007AFF";
      case "P2": return "#34C759";
      default: return "#86868B";
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-10">
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-[11px] font-medium tracking-[0.12em] uppercase text-[#86868B] mb-3">
            <span>🧩</span><span>Gestion d'équipe</span><span>·</span><span>Drag &amp; drop</span>
          </div>
          <h2 className="text-[56px] font-semibold text-[#1D1D1F] dark:text-white tracking-[-0.04em] leading-[0.95]">Affectations.</h2>
          <p className="text-[14px] text-[#86868B] dark:text-[#98989D] mt-2">
            Glisse une carte dossier vers un autre collaborateur pour réaffecter. Les messages et l'impact stress sont gérés automatiquement.
          </p>
        </div>

        {/* Bandeau stats */}
        <div className="mb-5 bg-white dark:bg-[#1c1c1e] border border-[#E5E5EA]/40 dark:border-[#38383a] rounded-[14px] px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px]">
          <div className="flex items-center gap-1.5">
            <Users size={13} className="text-[#86868B] dark:text-[#98989D]" />
            <span className="text-[#86868B] dark:text-[#98989D]">{store.agents.length} collaborateur{store.agents.length > 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#86868B] dark:text-[#98989D]">📁 {dossiersActifs.length} dossier{dossiersActifs.length > 1 ? "s" : ""} actif{dossiersActifs.length > 1 ? "s" : ""}</span>
          </div>
          {orphans.length > 0 && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-[#FF3B30]" />
              <span className="text-[#FF3B30] font-semibold">{orphans.length} orphelin{orphans.length > 1 ? "s" : ""} (agent parti)</span>
            </div>
          )}
          <div className="ml-auto text-[10px] text-[#86868B] dark:text-[#98989D] italic">
            💡 Astuce : tu peux aussi déposer un dossier sur la colonne "Non affectés"
          </div>
        </div>

        {/* Kanban */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {store.agents.map((a) => {
            const dossiers = parAgent[a.id] || [];
            const charge = dossiers.length;
            const chargeColor = getAgentChargeColor(charge);
            const isOver = dragOverAgent === a.id;
            const stressed = a.stress > 70;
            return (
              <div
                key={a.id}
                onDragOver={(e) => handleDragOver(e, a.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, a.id)}
                className={`bg-white dark:bg-[#1c1c1e] rounded-[16px] border-2 transition-all min-h-[200px] flex flex-col ${
                  isOver
                    ? "border-[#007AFF] dark:border-[#0A84FF] bg-[#007AFF]/5 dark:bg-[#0A84FF]/15 shadow-lg scale-[1.01]"
                    : "border-[#E5E5EA]/40 dark:border-[#38383a]"
                }`}
              >
                {/* Header colonne agent */}
                <div className="px-3 py-3 border-b border-[#E5E5EA]/40 dark:border-[#38383a]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-semibold shrink-0 shadow-sm" style={{ backgroundColor: a.avatar_color }}>
                      {a.initiales}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white truncate">{a.nom}</div>
                      <div className="text-[10px] text-[#86868B] dark:text-[#98989D] truncate">{a.role} · {a.filiere}</div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: chargeColor }}>
                        {charge} dossier{charge !== 1 ? "s" : ""}
                      </span>
                      {stressed && <span className="text-[8px] font-semibold text-[#FF3B30]">🔥 stress {a.stress}</span>}
                    </div>
                  </div>
                </div>

                {/* Liste dossiers */}
                <div className="flex-1 p-2 space-y-1.5 overflow-y-auto max-h-[400px]">
                  {dossiers.length === 0 ? (
                    <div className="text-center py-8 text-[10px] text-[#86868B] dark:text-[#98989D] italic">
                      {isOver ? "Déposer ici ↓" : "Aucun dossier — déposer une carte ici"}
                    </div>
                  ) : (
                    dossiers.map((d) => (
                      <div
                        key={d.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, d.id)}
                        className={`bg-white dark:bg-[#2c2c2e] border border-[#E5E5EA] dark:border-[#38383a]/80 rounded-[10px] p-2.5 cursor-move hover:shadow-md hover:border-[#007AFF]/50 dark:hover:border-[#0A84FF]/50 transition-all ${
                          draggedDossier === d.id ? "opacity-50 scale-95" : ""
                        }`}
                        style={{ borderLeft: `3px solid ${getPhaseColor(d.phase)}` }}
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical size={11} className="text-[#86868B] dark:text-[#98989D] mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                              <span className="text-[11px] font-semibold text-[#1D1D1F] dark:text-white truncate">{d.client}</span>
                              {d.is_vip && <span className="text-[8px] font-bold px-1 py-0 rounded bg-gradient-to-r from-[#AF52DE] to-[#5856D6] text-white">⭐</span>}
                            </div>
                            {d.secteur_categorie && <SectorTag categorie={d.secteur_categorie} size="sm" />}
                            <div className="flex items-center gap-1.5 mt-1 text-[9px]">
                              <span className="font-semibold tabular-nums" style={{ color: getPhaseColor(d.phase) }}>{d.phase}</span>
                              <span className="text-[#86868B] dark:text-[#98989D]">·</span>
                              <span className="text-[#86868B] dark:text-[#98989D]">{d.progression}%</span>
                              <span className="text-[#86868B] dark:text-[#98989D]">·</span>
                              <span className={d.qualite >= 70 ? "text-[#34C759]" : d.qualite >= 50 ? "text-[#FF9500]" : "text-[#FF3B30]"}>
                                Q {d.qualite}%
                              </span>
                              {d.etat === "surveillance" && <span className="text-[8px] font-bold text-[#FF9500] uppercase ml-auto">⚠ surveillé</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {/* Colonne Non affectés (pour dossiers orphelins suite à un licenciement) */}
          {orphans.length > 0 && (
            <div className="bg-[#FF3B30]/5 dark:bg-[#FF453A]/12 rounded-[16px] border-2 border-dashed border-[#FF3B30]/30 dark:border-[#FF453A]/40 min-h-[200px] flex flex-col">
              <div className="px-3 py-3 border-b border-[#FF3B30]/20 dark:border-[#FF453A]/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-[#FF3B30]/20 flex items-center justify-center shrink-0">
                    <AlertTriangle size={17} className="text-[#FF3B30]" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-[#FF3B30]">Dossiers orphelins</div>
                    <div className="text-[10px] text-[#86868B] dark:text-[#98989D]">À ré-attribuer rapidement</div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF3B30] text-white">
                    {orphans.length}
                  </span>
                </div>
              </div>
              <div className="flex-1 p-2 space-y-1.5">
                {orphans.map((d) => (
                  <div
                    key={d.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, d.id)}
                    className="bg-white dark:bg-[#2c2c2e] border border-[#FF3B30]/30 rounded-[10px] p-2.5 cursor-move hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-1.5">
                      <GripVertical size={11} className="text-[#FF3B30]" />
                      <span className="text-[11px] font-semibold text-[#1D1D1F] dark:text-white">{d.client}</span>
                    </div>
                    <div className="text-[9px] text-[#86868B] dark:text-[#98989D] mt-0.5 italic">
                      Agent parti — drag vers un autre collaborateur
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Hint en bas */}
        <div className="mt-6 text-center text-[11px] text-[#86868B] dark:text-[#98989D]">
          Légende phase : <span className="text-[#34C759] font-semibold">P2</span> Traitement · <span className="text-[#007AFF] font-semibold">P3</span> Contrôle · <span className="text-[#FF9500] font-semibold">P4</span> Validation · <span className="text-[#FF3B30] font-semibold">P5</span> Clôture
        </div>
      </div>
    </div>
  );
}
