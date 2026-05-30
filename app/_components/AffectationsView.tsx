"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/supabase-store";
import type { Dossier } from "@/lib/supabase-store";
import { AlertTriangle, GripVertical } from "lucide-react";
import { SectorTag } from "./SectorTag";
import { PageHeader } from "./ui/PageHeader";
import { AgentAvatar, ClientLogo } from "./ui/AgentAvatar";

/**
 * Vue Affectations — kanban carré PHDDEC :
 *  - 1 colonne par collaborateur, cartes draggables empilées
 *  - Drag-and-drop d'une carte vers une autre colonne = reassignDossier
 *  - Style PHDDEC : surfaces blanches, ombre légère, accent bleu, tints
 */
export function AffectationsView() {
  const store = useGameStore();
  const [draggedDossier, setDraggedDossier] = useState<string | null>(null);
  const [dragOverAgent, setDragOverAgent] = useState<string | null>(null);

  const dossiersActifs = store.dossiers.filter((d) => d.etat === "en_cours" || d.etat === "surveillance" || d.etat === "avance");
  const orphans = dossiersActifs.filter((d) => !store.agents.find((a) => a.id === d.agent_id));

  const parAgent: Record<string, Dossier[]> = {};
  store.agents.forEach((a) => { parAgent[a.id] = []; });
  dossiersActifs.forEach((d) => {
    if (parAgent[d.agent_id]) parAgent[d.agent_id].push(d);
  });

  // Capacité théorique selon niveau
  function capaciteOf(a: any): number {
    if (a.niveau === "Manager" || a.niveau === "Directeur") return 6;
    if (a.niveau && a.niveau.includes("Stagiaire")) return 2;
    return 4;
  }

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
  function handleDragLeave() { setDragOverAgent(null); }
  function handleDrop(e: React.DragEvent, newAgentId: string) {
    e.preventDefault();
    const dossierId = e.dataTransfer.getData("text/plain") || draggedDossier;
    if (!dossierId) return;
    const dossier = store.dossiers.find((d) => d.id === dossierId);
    if (!dossier || dossier.agent_id === newAgentId) { setDraggedDossier(null); setDragOverAgent(null); return; }
    const res = store.reassignDossier(dossierId, newAgentId);
    if (!res.ok) alert(res.reason || "Réaffectation impossible");
    setDraggedDossier(null);
    setDragOverAgent(null);
  }

  function phaseColor(p: string): string {
    switch (p) { case "P5": return "var(--mdec-rose)"; case "P4": return "var(--mdec-amber)"; case "P3": return "var(--mdec-accent)"; case "P2": return "var(--mdec-mint)"; default: return "var(--mdec-text-3)"; }
  }
  function chargeColor(charge: number, capacite: number): string {
    const ratio = charge / capacite;
    if (ratio >= 1) return "var(--mdec-rose)";
    if (ratio >= 0.75) return "var(--mdec-amber)";
    return "var(--mdec-mint)";
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="AFFECTATIONS"
        stats={[
          { value: store.agents.length, label: "collaborateurs" },
          { value: dossiersActifs.length, label: "dossiers actifs" },
          { value: orphans.length, label: "orphelins", tone: orphans.length > 0 ? "critical" : "default" },
        ]}
      />

      <div className="max-w-[1400px] mx-auto px-10 pb-16">
        <p className="text-[12px] mb-6" style={{ color: "var(--mdec-text-3)" }}>
          Glisse une carte d'un collaborateur à l'autre pour réaffecter · Les messages et l'impact stress sont gérés automatiquement
        </p>

        {/* Kanban : 1 colonne par collab — grille carrée */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {store.agents.map((a) => {
            const dossiers = parAgent[a.id] || [];
            const charge = dossiers.length;
            const capacite = capaciteOf(a);
            const isOver = dragOverAgent === a.id;
            const stressed = a.stress > 70;
            const col = chargeColor(charge, capacite);
            return (
              <div
                key={a.id}
                onDragOver={(e) => handleDragOver(e, a.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, a.id)}
                className={`surface-card rounded-[24px] min-h-[260px] flex flex-col transition-all ${
                  isOver ? "scale-[1.01]" : ""
                }`}
                style={isOver ? { borderColor: "var(--mdec-accent)", boxShadow: "0 0 0 2px var(--mdec-accent-soft)" } : {}}
              >
                {/* Header colonne agent */}
                <div className="px-4 py-3 border-b" style={{ borderColor: "var(--mdec-border)" }}>
                  <div className="flex items-center gap-2.5">
                    <AgentAvatar initials={a.initiales} color={a.avatar_color} agentId={a.id} agentName={a.nom} size="md" online={a.statut === "En ligne"} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate" style={{ color: "var(--mdec-text)" }}>{a.nom.split(" ")[0]} {a.nom.split(" ")[1]?.[0] || ""}.</div>
                      <div className="text-[10px] truncate" style={{ color: "var(--mdec-text-3)" }}>{a.filiere}</div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white tabular-nums" style={{ backgroundColor: col }}>
                        {charge}/{capacite}
                      </span>
                      {stressed && <span className="text-[9px]">🔥</span>}
                    </div>
                  </div>
                  {/* Mini-barre charge */}
                  <div className="mt-2 h-[3px] rounded-full overflow-hidden" style={{ background: "var(--mdec-active)" }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (charge / capacite) * 100)}%`, backgroundColor: col }} />
                  </div>
                </div>

                {/* Liste cartes dossier */}
                <div className="flex-1 p-2 space-y-1.5 overflow-y-auto max-h-[360px]">
                  {dossiers.length === 0 ? (
                    <div className="text-center py-10 text-[10.5px] italic" style={{ color: "var(--mdec-text-3)" }}>
                      {isOver ? "Déposer ici ↓" : "Aucun dossier"}
                    </div>
                  ) : (
                    dossiers.map((d) => (
                      <div
                        key={d.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, d.id)}
                        className={`rounded-[12px] p-2.5 cursor-move transition-all hover:shadow-md ${
                          draggedDossier === d.id ? "opacity-50 scale-95" : ""
                        }`}
                        style={{
                          background: "var(--mdec-active)",
                          borderLeft: `3px solid ${phaseColor(d.phase)}`,
                        }}
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical size={11} className="mt-0.5 shrink-0" style={{ color: "var(--mdec-text-4)" }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11.5px] font-semibold truncate" style={{ color: "var(--mdec-text)" }}>{d.client}</span>
                              {d.is_vip && <span className="text-[9px]" title="VIP">⭐</span>}
                            </div>
                            {d.secteur_categorie && <SectorTag categorie={d.secteur_categorie} size="sm" />}
                            <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                              <span className="font-semibold tabular-nums" style={{ color: phaseColor(d.phase) }}>{d.phase}</span>
                              <span style={{ color: "var(--mdec-text-3)" }}>·</span>
                              <span style={{ color: "var(--mdec-text-3)" }}>{d.progression}%</span>
                              <span style={{ color: "var(--mdec-text-3)" }}>·</span>
                              <span style={{ color: d.qualite >= 70 ? "var(--mdec-mint)" : d.qualite >= 50 ? "var(--mdec-amber)" : "var(--mdec-rose)" }}>
                                Q{d.qualite}
                              </span>
                              {d.etat === "surveillance" && <span className="ml-auto text-[9px] font-bold" style={{ color: "var(--mdec-amber)" }}>⚠</span>}
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

          {/* Colonne Orphelins */}
          {orphans.length > 0 && (
            <div
              className="rounded-[24px] border-2 border-dashed min-h-[260px] flex flex-col"
              style={{ borderColor: "var(--mdec-rose)", background: "var(--mdec-rose-soft)" }}
            >
              <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(230,74,74,0.2)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--mdec-rose)" }}>
                    <AlertTriangle size={17} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold" style={{ color: "var(--mdec-rose)" }}>Orphelins</div>
                    <div className="text-[10px]" style={{ color: "var(--mdec-text-3)" }}>À ré-attribuer</div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "var(--mdec-rose)" }}>
                    {orphans.length}
                  </span>
                </div>
              </div>
              <div className="flex-1 p-2 space-y-1.5 overflow-y-auto max-h-[360px]">
                {orphans.map((d) => (
                  <div
                    key={d.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, d.id)}
                    className="rounded-[12px] p-2.5 cursor-move hover:shadow-md"
                    style={{ background: "var(--mdec-surface)", borderLeft: `3px solid var(--mdec-rose)` }}
                  >
                    <div className="flex items-center gap-1.5">
                      <GripVertical size={11} style={{ color: "var(--mdec-rose)" }} />
                      <span className="text-[11.5px] font-semibold" style={{ color: "var(--mdec-text)" }}>{d.client}</span>
                    </div>
                    <div className="text-[10px] mt-0.5 italic" style={{ color: "var(--mdec-text-3)" }}>
                      Agent parti — drag vers un collab
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[11px]" style={{ color: "var(--mdec-text-3)" }}>
          Phase : <span className="font-semibold" style={{ color: "var(--mdec-mint)" }}>P2</span> Traitement ·
          <span className="font-semibold ml-2" style={{ color: "var(--mdec-accent)" }}>P3</span> Contrôle ·
          <span className="font-semibold ml-2" style={{ color: "var(--mdec-amber)" }}>P4</span> Validation ·
          <span className="font-semibold ml-2" style={{ color: "var(--mdec-rose)" }}>P5</span> Clôture
        </p>
      </div>
    </div>
  );
}
