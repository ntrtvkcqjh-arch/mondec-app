"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/supabase-store";
import { UserCog, X, MessageCircle, Sparkles, Star, AlertTriangle } from "lucide-react";
import { ClientFicheModal } from "./ClientFicheModal";
import { SectorTag } from "./SectorTag";
import { DossierChatModal } from "./DossierChatModal";
import { PageHeader } from "./ui/PageHeader";
import { Card } from "./ui/Card";
import { Section } from "./ui/Section";

export function DossiersView() {
  const store = useGameStore();
  const [filter, setFilter] = useState<"en_cours" | "surveillance" | "avance" | "cloture" | "perdu" | "tous">("en_cours");
  const [ficheId, setFicheId] = useState<string | null>(null);
  const [reassignDossierId, setReassignDossierId] = useState<string | null>(null);
  const [chatDossierId, setChatDossierId] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => store.recomputeAllDossierStatus(), 8000);
    return () => clearInterval(t);
  }, []);

  // CASCADE drama mauvaise affectation
  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = `drama_check_${store.game_day}_${Math.floor(store.game_minute / 30)}`;
    if (localStorage.getItem(flag)) return;
    localStorage.setItem(flag, "1");
    store.dossiers.forEach((d) => {
      if (d.etat !== "en_cours" && d.etat !== "surveillance") return;
      const incompat = store.computeIncompatibilites(d.id, d.agent_id);
      if (incompat.length >= 2) store.triggerBadAffectationDrama(d.id);
    });
  }, [store.dossiers.length, store.game_day, store.game_minute]);

  const enCours = store.dossiers.filter((d) => d.etat === "en_cours").length;
  const surveillance = store.dossiers.filter((d) => d.etat === "surveillance").length;
  const avances = store.dossiers.filter((d) => d.etat === "avance").length;
  const clotures = store.dossiers.filter((d) => d.etat === "cloture").length;
  const perdus = store.dossiers.filter((d) => d.etat === "perdu").length;
  const filtered = filter === "tous" ? store.dossiers : store.dossiers.filter((d) => d.etat === filter);

  const filters: { id: typeof filter; label: string; count: number }[] = [
    { id: "en_cours", label: "Actifs", count: enCours },
    { id: "surveillance", label: "Surveillance", count: surveillance },
    { id: "avance", label: "Avancés", count: avances },
    { id: "cloture", label: "Clôturés", count: clotures },
    { id: "perdu", label: "Perdus", count: perdus },
    { id: "tous", label: "Tous", count: store.dossiers.length },
  ];

  function phaseColor(p: string): string {
    switch (p) {
      case "P5": return "#FF3B30";
      case "P4": return "#FF9500";
      case "P3": return "#007AFF";
      case "P2": return "#34C759";
      default: return "#9ca3af";
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="DOSSIERS"
        stats={[
          { value: enCours, label: "dossiers actifs" },
          { value: surveillance, label: "en surveillance", tone: surveillance > 0 ? "warning" : "default" },
          { value: perdus, label: "perdus", tone: perdus > 0 ? "critical" : "default" },
        ]}
      />

      <div className="max-w-[1200px] mx-auto px-10 pb-16">
        {/* Filtres segmentés style iOS */}
        <div className="flex gap-1.5 mb-8 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3.5 py-2 rounded-full text-[12.5px] font-medium transition-all ${
                filter === f.id
                  ? "bg-[#111111] dark:bg-white text-white dark:text-[#111111]"
                  : "bg-white dark:bg-[#1c1c1e] text-[#3a3a3c] dark:text-[#d1d1d6] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.06)]"
              }`}
            >
              {f.label}
              <span className={`ml-1.5 tabular-nums ${filter === f.id ? "opacity-60" : "text-[#9ca3af]"}`}>{f.count}</span>
            </button>
          ))}
        </div>

        {/* Grille compacte : 4 colonnes desktop, 2 tablet, 1 mobile */}
        {filtered.length === 0 ? (
          <Card className="px-10 py-16 text-center">
            <p className="text-[14px] text-[#6b7280] dark:text-[#98989D]">Aucun dossier dans cette catégorie.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((d) => {
              const a = store.agents.find((x) => x.id === d.agent_id);
              const messagesAgent = store.messages.filter((m) => m.agent_id === d.agent_id && !m.repondu).length;
              const recoverable = d.etat === "perdu" && d.recoverable_until && new Date(d.recoverable_until) > new Date();
              const phaseCol = phaseColor(d.phase);
              return (
                <Card key={d.id} onClick={() => setFicheId(d.id)} className="p-5 flex flex-col gap-3">
                  {/* Header : client + VIP */}
                  <div className="flex items-start justify-between gap-2 min-h-[40px]">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[15px] font-semibold text-[#111111] dark:text-white tracking-[-0.01em] leading-tight">
                        {d.client}
                      </h3>
                      <p className="text-[11.5px] text-[#6b7280] dark:text-[#98989D] mt-0.5 line-clamp-1">{d.theme}</p>
                    </div>
                    {d.is_vip && (
                      <Star size={13} fill="#FF9500" className="text-[#FF9500] shrink-0 mt-1" />
                    )}
                  </div>

                  {/* Tag secteur compact */}
                  {d.secteur_categorie && (
                    <div><SectorTag categorie={d.secteur_categorie} size="sm" /></div>
                  )}

                  {/* Barre progression épurée */}
                  <div>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-[26px] font-semibold tabular-nums tracking-[-0.02em] text-[#111111] dark:text-white leading-none">
                        {d.progression}<span className="text-[14px] opacity-50">%</span>
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: phaseCol }}>
                        {d.phase}
                      </span>
                    </div>
                    <div className="h-[3px] bg-[#f1f1f3] dark:bg-[#2c2c2e] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${d.progression}%`, backgroundColor: phaseCol }} />
                    </div>
                  </div>

                  {/* Pied : collab + alertes */}
                  <div className="flex items-center justify-between text-[11.5px] mt-auto">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {a ? (
                        <>
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8.5px] font-semibold shrink-0" style={{ backgroundColor: a.avatar_color }}>
                            {a.initiales}
                          </div>
                          <span className="text-[#3a3a3c] dark:text-[#d1d1d6] truncate">{a.nom.split(" ")[0]}</span>
                        </>
                      ) : (
                        <span className="text-[#FF3B30] flex items-center gap-1"><AlertTriangle size={11} /> Non affecté</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[#6b7280] dark:text-[#98989D] shrink-0">
                      {messagesAgent > 0 && <span>{messagesAgent} msg</span>}
                      {d.etat === "surveillance" && <span className="text-[#FF9500] font-medium">⚠</span>}
                    </div>
                  </div>

                  {/* Actions discrètes au hover (apparaissent via opacity au hover de la card parent) */}
                  <div className="flex gap-1.5 -mb-1 -mx-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setReassignDossierId(d.id); }}
                      className="flex-1 px-2 py-1.5 rounded-[10px] bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[10.5px] text-[#3a3a3c] dark:text-[#d1d1d6] hover:bg-[#ebebed] dark:hover:bg-[#38383a] flex items-center justify-center gap-1 font-medium"
                    >
                      <UserCog size={10} /> Réaffecter
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setChatDossierId(d.id); }}
                      className="flex-1 px-2 py-1.5 rounded-[10px] bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[10.5px] text-[#3a3a3c] dark:text-[#d1d1d6] hover:bg-[#ebebed] dark:hover:bg-[#38383a] flex items-center justify-center gap-1 font-medium"
                    >
                      <MessageCircle size={10} /> Discuter
                    </button>
                    {recoverable && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const ok = store.attemptRecoverDossier(d.id);
                          if (!ok) alert("Tentative ratée — le client refuse de revenir.");
                        }}
                        className="px-2 py-1.5 rounded-[10px] bg-[#AF52DE]/10 text-[#AF52DE] hover:bg-[#AF52DE]/15 text-[10.5px] font-medium flex items-center gap-1"
                      >
                        <Sparkles size={10} /> Récup
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal fiche client */}
      {ficheId && (() => {
        const d = store.dossiers.find((x) => x.id === ficheId);
        if (!d) return null;
        return <ClientFicheModal dossier={d} onClose={() => setFicheId(null)} />;
      })()}

      {reassignDossierId && (() => {
        const d = store.dossiers.find((x) => x.id === reassignDossierId);
        if (!d) return null;
        return <ReassignModal dossier={d} onClose={() => setReassignDossierId(null)} />;
      })()}

      {chatDossierId && (() => {
        const d = store.dossiers.find((x) => x.id === chatDossierId);
        if (!d) return null;
        return <DossierChatModal dossier={d} onClose={() => setChatDossierId(null)} />;
      })()}
    </div>
  );
}

function ReassignModal({ dossier, onClose }: { dossier: any; onClose: () => void }) {
  const store = useGameStore();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [motif, setMotif] = useState<string>("");
  const currentAgent = store.agents.find((a) => a.id === dossier.agent_id);

  function handleSubmit() {
    if (!selectedAgentId) return alert("Sélectionne un collaborateur.");
    const res = store.reassignDossier(dossier.id, selectedAgentId, motif || undefined);
    if (!res.ok) return alert(res.reason || "Échec.");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[55] bg-black/30 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] w-full max-w-md overflow-hidden">
        <div className="px-7 pt-7 pb-5">
          <h3 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111111] dark:text-white">Réaffecter le dossier</h3>
          <p className="text-[13px] text-[#6b7280] dark:text-[#98989D] mt-1">{dossier.client}</p>
        </div>
        <div className="px-7 pb-5 space-y-4">
          {currentAgent && (
            <div className="bg-[#fafafa] dark:bg-[#2c2c2e] rounded-[14px] p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-semibold" style={{ backgroundColor: currentAgent.avatar_color }}>
                {currentAgent.initiales}
              </div>
              <div className="flex-1">
                <div className="text-[12px] font-semibold text-[#111111] dark:text-white">Actuellement : {currentAgent.nom}</div>
                <div className="text-[10px] text-[#6b7280] dark:text-[#98989D]">Stress {currentAgent.stress} · {store.dossiers.filter((d) => d.agent_id === currentAgent.id && d.etat === "en_cours").length} dossier(s)</div>
              </div>
            </div>
          )}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280] dark:text-[#98989D] block mb-1.5">Nouveau collaborateur</label>
            <select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)}
              className="w-full text-[13px] p-2.5 border border-[#e5e7eb] dark:border-[#38383a] rounded-[12px] outline-none focus:border-[#007AFF] bg-white dark:bg-[#2c2c2e] text-[#111111] dark:text-white">
              <option value="">— Choisir —</option>
              {store.agents.filter((a) => a.id !== dossier.agent_id).map((a) => {
                const charge = store.dossiers.filter((d) => d.agent_id === a.id && d.etat === "en_cours").length;
                return <option key={a.id} value={a.id}>{a.nom} ({a.filiere}) · {charge} dossier(s){charge >= 3 ? " ⚠" : ""}{a.stress > 70 ? " 🔥" : ""}</option>;
              })}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280] dark:text-[#98989D] block mb-1.5">Motif (optionnel)</label>
            <input type="text" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex : compétence fiscale requise"
              className="w-full text-[13px] p-2.5 border border-[#e5e7eb] dark:border-[#38383a] rounded-[12px] outline-none focus:border-[#007AFF] bg-white dark:bg-[#2c2c2e] text-[#111111] dark:text-white" />
          </div>
        </div>
        <div className="px-7 py-4 border-t border-[#f1f1f3] dark:border-[#2c2c2e] flex justify-end gap-2 bg-[#fafafa] dark:bg-[#161618]">
          <button onClick={onClose} className="px-4 py-2 text-[13px] rounded-[12px] bg-white dark:bg-[#2c2c2e] text-[#111111] dark:text-white border border-[#e5e7eb] dark:border-[#38383a]">Annuler</button>
          <button onClick={handleSubmit} disabled={!selectedAgentId}
            className={`px-5 py-2 text-[13px] font-semibold rounded-[12px] transition-all ${selectedAgentId ? "bg-[#007AFF] text-white shadow-[0_2px_8px_rgba(0,122,255,0.3)]" : "bg-[#e5e7eb] dark:bg-[#38383a] text-[#9ca3af] cursor-not-allowed"}`}>
            Réaffecter
          </button>
        </div>
      </div>
    </div>
  );
}
