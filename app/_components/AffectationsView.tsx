"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/supabase-store";
import type { Dossier } from "@/lib/supabase-store";
import { AlertTriangle, GripVertical, UserCog } from "lucide-react";
import { SectorTag } from "./SectorTag";
import { PageHeader } from "./ui/PageHeader";
import { Card } from "./ui/Card";
import { Drawer } from "./ui/Drawer";

/**
 * Vue Affectations — minimaliste Apple :
 *  - Liste verticale des collaborateurs avec barre de charge
 *  - Clic sur un collab → drawer latéral avec ses dossiers + drag & drop
 */
export function AffectationsView() {
  const store = useGameStore();
  const [openAgentId, setOpenAgentId] = useState<string | null>(null);
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

  const openAgent = openAgentId ? store.agents.find((a) => a.id === openAgentId) : null;
  const openDossiers = openAgent ? parAgent[openAgent.id] || [] : [];

  function phaseColor(p: string): string {
    switch (p) { case "P5": return "#FF3B30"; case "P4": return "#FF9500"; case "P3": return "#007AFF"; case "P2": return "#34C759"; default: return "#9ca3af"; }
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

      <div className="max-w-[1200px] mx-auto px-10 pb-16">
        {/* Hint */}
        <p className="text-[12px] text-[#6b7280] dark:text-[#98989D] mb-6">
          Clique sur un collaborateur pour voir ses dossiers · Glisse-dépose une carte pour réaffecter
        </p>

        {/* Liste collab avec barres de charge */}
        <Card className="overflow-hidden">
          {store.agents.map((a, idx) => {
            const charge = (parAgent[a.id] || []).length;
            const capacite = capaciteOf(a);
            const ratio = Math.min(100, (charge / capacite) * 100);
            const color = ratio >= 100 ? "#FF3B30" : ratio >= 75 ? "#FF9500" : "#34C759";
            const isOver = dragOverAgent === a.id;
            return (
              <div
                key={a.id}
                onClick={() => setOpenAgentId(a.id)}
                onDragOver={(e) => handleDragOver(e, a.id)}
                onDrop={(e) => handleDrop(e, a.id)}
                className={`px-5 py-4 flex items-center gap-4 cursor-pointer transition-colors ${
                  idx !== store.agents.length - 1 ? "border-b border-[#f1f1f3] dark:border-[#2c2c2e]" : ""
                } ${isOver ? "bg-[#007AFF]/8 dark:bg-[#0A84FF]/15" : "hover:bg-[#fafafa] dark:hover:bg-[#2c2c2e]/50"}`}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shadow-sm shrink-0" style={{ backgroundColor: a.avatar_color }}>
                  {a.initiales}
                </div>
                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[1.5fr_2.5fr_auto] gap-4 md:items-center">
                  {/* Nom + role */}
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-[#111111] dark:text-white truncate">{a.nom}</div>
                    <div className="text-[11px] text-[#6b7280] dark:text-[#98989D] truncate">{a.role} · {a.filiere}</div>
                  </div>
                  {/* Barre de charge */}
                  <div>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-[11px] text-[#6b7280] dark:text-[#98989D]">Charge</span>
                      <span className="text-[12px] font-semibold tabular-nums" style={{ color }}>{charge}<span className="text-[#9ca3af] dark:text-[#6b7280]">/{capacite}</span></span>
                    </div>
                    <div className="h-[6px] bg-[#f1f1f3] dark:bg-[#2c2c2e] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${ratio}%`, backgroundColor: color }} />
                    </div>
                  </div>
                  {/* Stress indicator */}
                  <div className="hidden md:flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-[#6b7280] dark:text-[#98989D]">Stress</div>
                      <div className={`text-[14px] font-semibold tabular-nums ${a.stress > 70 ? "text-[#FF3B30]" : a.stress > 50 ? "text-[#FF9500]" : "text-[#34C759]"}`}>{a.stress}</div>
                    </div>
                    <div className="text-[#9ca3af] dark:text-[#6b7280] text-[18px]">›</div>
                  </div>
                </div>
              </div>
            );
          })}
        </Card>

        {/* Orphelins en bas si présents */}
        {orphans.length > 0 && (
          <Card className="mt-6 p-5 border-2 border-dashed border-[#FF3B30]/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-[#FF3B30]/15 flex items-center justify-center">
                <AlertTriangle size={15} className="text-[#FF3B30]" />
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-[#FF3B30]">Dossiers orphelins</div>
                <div className="text-[11px] text-[#6b7280] dark:text-[#98989D]">{orphans.length} dossier(s) sans collaborateur — glisse-les vers une ligne</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {orphans.map((d) => (
                <div key={d.id} draggable onDragStart={(e) => handleDragStart(e, d.id)}
                  className="bg-white dark:bg-[#2c2c2e] rounded-[12px] p-3 cursor-move hover:shadow-md transition-shadow flex items-center gap-2"
                  style={{ borderLeft: `3px solid ${phaseColor(d.phase)}` }}>
                  <GripVertical size={12} className="text-[#9ca3af]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[#111111] dark:text-white truncate">{d.client}</div>
                    <div className="text-[10px] text-[#6b7280] dark:text-[#98989D]">{d.phase} · {d.progression}%</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Drawer détails collaborateur */}
      <Drawer
        open={!!openAgent}
        onClose={() => setOpenAgentId(null)}
        title={openAgent ? openAgent.nom : ""}
        subtitle={openAgent ? `${openAgent.role} · ${openAgent.filiere} · ${openDossiers.length} dossier(s)` : ""}
        width="md"
      >
        {openAgent && (
          <>
            {/* Stats inline */}
            <div className="flex items-baseline gap-x-6 gap-y-2 flex-wrap mb-6 text-[13px]">
              <div><span className="font-semibold tabular-nums text-[#111111] dark:text-white">{openAgent.stress}</span> <span className="text-[11px] text-[#6b7280] dark:text-[#98989D]">stress</span></div>
              <div><span className="font-semibold tabular-nums text-[#111111] dark:text-white">{openAgent.confiance_joueur}</span> <span className="text-[11px] text-[#6b7280] dark:text-[#98989D]">confiance</span></div>
              <div><span className="font-semibold tabular-nums text-[#111111] dark:text-white">{openAgent.loyaute}</span> <span className="text-[11px] text-[#6b7280] dark:text-[#98989D]">loyauté</span></div>
              <div><span className="font-semibold tabular-nums text-[#111111] dark:text-white">{openAgent.fatigue}</span> <span className="text-[11px] text-[#6b7280] dark:text-[#98989D]">fatigue</span></div>
            </div>

            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6b7280] dark:text-[#98989D] mb-3">
              Ses dossiers
            </div>
            {openDossiers.length === 0 ? (
              <div className="text-center py-12 bg-[#fafafa] dark:bg-[#2c2c2e] rounded-[16px]">
                <p className="text-[12px] text-[#6b7280] dark:text-[#98989D]">Aucun dossier affecté.</p>
                <p className="text-[11px] text-[#9ca3af] dark:text-[#6b7280] mt-1">Glisse une carte depuis un autre collaborateur.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {openDossiers.map((d) => (
                  <div key={d.id} draggable onDragStart={(e) => handleDragStart(e, d.id)}
                    className="bg-[#fafafa] dark:bg-[#2c2c2e] rounded-[14px] p-3 cursor-move hover:bg-[#f1f1f3] dark:hover:bg-[#38383a] transition-colors"
                    style={{ borderLeft: `3px solid ${phaseColor(d.phase)}` }}>
                    <div className="flex items-center gap-2 mb-1">
                      <GripVertical size={11} className="text-[#9ca3af]" />
                      <span className="text-[13px] font-semibold text-[#111111] dark:text-white truncate flex-1">{d.client}</span>
                      {d.is_vip && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gradient-to-r from-[#AF52DE] to-[#5856D6] text-white">⭐</span>}
                    </div>
                    <div className="ml-5 text-[11px] text-[#6b7280] dark:text-[#98989D] line-clamp-1">{d.theme}</div>
                    <div className="ml-5 flex items-center gap-3 mt-1 text-[11px]">
                      <span className="font-semibold tabular-nums" style={{ color: phaseColor(d.phase) }}>{d.phase}</span>
                      <span className="text-[#9ca3af] dark:text-[#6b7280]">{d.progression}%</span>
                      <span className={d.qualite >= 70 ? "text-[#34C759]" : d.qualite >= 50 ? "text-[#FF9500]" : "text-[#FF3B30]"}>Q {d.qualite}%</span>
                      {d.secteur_categorie && <SectorTag categorie={d.secteur_categorie} size="sm" />}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 text-[11px] text-[#6b7280] dark:text-[#98989D] italic">
              💡 Pour réaffecter un dossier à un autre collaborateur, ferme ce panneau et glisse-le directement sur sa ligne dans la liste.
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}
