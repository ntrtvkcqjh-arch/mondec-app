"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/supabase-store";
import { UserCog, X, MessageCircle, Sparkles, Star, AlertTriangle, UserPlus, Briefcase, Building2, TrendingUp } from "lucide-react";
import { ClientFicheModal } from "./ClientFicheModal";
import { SectorTag } from "./SectorTag";
import { DossierChatModal } from "./DossierChatModal";
import { PageHeader } from "./ui/PageHeader";
import { Card } from "./ui/Card";
import { Section } from "./ui/Section";
import { AgentAvatar, ClientLogo } from "./ui/AgentAvatar";

type DossierFilter = "prospects" | "en_cours" | "surveillance" | "avance" | "cloture" | "perdu" | "tous";

export function DossiersView() {
  const store = useGameStore();
  const [filter, setFilter] = useState<DossierFilter>("en_cours");
  const [ficheId, setFicheId] = useState<string | null>(null);
  const [reassignDossierId, setReassignDossierId] = useState<string | null>(null);
  const [chatDossierId, setChatDossierId] = useState<string | null>(null);
  const [acceptProspectId, setAcceptProspectId] = useState<string | null>(null);
  // Quand on n'a pas de dossier mais des prospects, on switch automatiquement
  // sur l'onglet Prospects pour que la joueuse les voie
  useEffect(() => {
    if (store.dossiers.length === 0 && store.prospects_pending.length > 0 && filter === "en_cours") {
      setFilter("prospects");
    }
  }, [store.dossiers.length, store.prospects_pending.length]);

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

  const prospectsCount = store.prospects_pending.length;
  const filters: { id: DossierFilter; label: string; count: number; highlight?: boolean }[] = [
    { id: "prospects", label: "📨 Prospects", count: prospectsCount, highlight: prospectsCount > 0 },
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
                  ? f.highlight
                    ? "bg-gradient-to-br from-[#FF9500] to-[#FF3B30] text-white shadow-md"
                    : "bg-[#111111] dark:bg-white text-white dark:text-[#111111]"
                  : f.highlight
                    ? "bg-[#FF9500]/15 text-[#C76A00] dark:text-[#FF9F0A] ring-1 ring-[#FF9500]/30 hover:bg-[#FF9500]/25"
                    : "bg-white dark:bg-[#1c1c1e] text-[#3a3a3c] dark:text-[#d1d1d6] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.06)]"
              }`}
            >
              {f.label}
              <span className={`ml-1.5 tabular-nums ${filter === f.id ? "opacity-60" : f.highlight ? "" : "text-[#9ca3af]"}`}>{f.count}</span>
            </button>
          ))}
        </div>

        {/* === MODE PROSPECTS : grille de prospects en attente avec bouton Accepter === */}
        {filter === "prospects" && (
          <>
            {store.prospects_pending.length === 0 ? (
              <Card className="px-10 py-16 text-center">
                <div className="text-[36px] mb-2">📨</div>
                <p className="text-[14px] font-medium text-[#1D1D1F] dark:text-white mb-1">Aucun prospect en attente</p>
                <p className="text-[12px] text-[#6b7280] dark:text-[#98989D]">De nouveaux prospects arrivent chaque jour selon la saisonnalité.</p>
              </Card>
            ) : (
              <>
                <div className="bg-gradient-to-r from-[#FF9500]/8 to-[#FF3B30]/8 border border-[#FF9500]/20 rounded-[14px] p-3.5 mb-5 flex items-center gap-3">
                  <div className="text-[22px]">📨</div>
                  <div className="flex-1">
                    <div className="text-[12px] font-semibold text-[#C76A00] dark:text-[#FF9F0A] uppercase tracking-wider mb-0.5">
                      {store.prospects_pending.length} prospect{store.prospects_pending.length > 1 ? "s" : ""} en attente
                    </div>
                    <div className="text-[12px] text-[#3a3a3c] dark:text-[#d1d1d6]">
                      Étudie chaque profil et accepte ceux qui correspondent à ton équipe.
                      {store.agents.length === 0 && <span className="ml-1 text-[#FF3B30] font-medium">⚠ Recrute au moins 1 collaborateur avant d'accepter.</span>}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {store.prospects_pending.map((p) => {
                    const profilColor = p.profil_relationnel >= 70 ? "#FF3B30" : p.profil_relationnel >= 40 ? "#FF9500" : "#34C759";
                    const profilLabel = p.profil_relationnel >= 70 ? "Exigeant" : p.profil_relationnel >= 40 ? "Standard" : "Patient";
                    const rentaColor = p.rentabilite >= 70 ? "#34C759" : p.rentabilite >= 40 ? "#FF9500" : "#FF3B30";
                    return (
                      <Card key={p.id} className="p-5 flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-[12px] bg-gradient-to-br from-[#5B7CFA] to-[#3F5BCE] flex items-center justify-center text-white shadow-sm shrink-0">
                            <Building2 size={20} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-[14px] font-semibold text-[#111111] dark:text-white tracking-[-0.01em] leading-tight">{p.client}</h3>
                            <p className="text-[11px] text-[#6b7280] dark:text-[#98989D] mt-0.5 line-clamp-1">{p.secteur} · {p.forme_juridique}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-[8px] px-2 py-1.5">
                            <div className="text-[9px] text-[#86868B] uppercase tracking-wider">CA</div>
                            <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white">{(p.ca / 1000).toFixed(0)} k€</div>
                          </div>
                          <div className="bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-[8px] px-2 py-1.5">
                            <div className="text-[9px] text-[#86868B] uppercase tracking-wider">Effectif</div>
                            <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white">{p.effectif}</div>
                          </div>
                          <div className="bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-[8px] px-2 py-1.5">
                            <div className="text-[9px] text-[#86868B] uppercase tracking-wider">Profil</div>
                            <div className="text-[12px] font-semibold" style={{ color: profilColor }}>{profilLabel}</div>
                          </div>
                          <div className="bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-[8px] px-2 py-1.5">
                            <div className="text-[9px] text-[#86868B] uppercase tracking-wider">Rentabilité</div>
                            <div className="text-[12px] font-semibold flex items-center gap-1" style={{ color: rentaColor }}>
                              <TrendingUp size={11} /> {p.rentabilite}/100
                            </div>
                          </div>
                        </div>
                        <div className="text-[10px] text-[#6b7280] dark:text-[#98989D] leading-relaxed">
                          <strong>Honoraires :</strong> {(p.honoraires_annuels / 1000).toFixed(1)} k€/an · 25 % d'acompte = {((p.honoraires_annuels * 0.25) / 1000).toFixed(1)} k€ à la signature
                        </div>
                        {p.specialites_requises.length > 0 && (
                          <div className="text-[10px]">
                            <span className="text-[#86868B]">Spécialités attendues :</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {p.specialites_requises.slice(0, 3).map((s) => (
                                <span key={s} className="px-1.5 py-0.5 rounded bg-[#007AFF]/10 text-[#007AFF] dark:text-[#0A84FF] text-[9.5px]">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex gap-1.5 mt-auto pt-1">
                          <button
                            onClick={() => store.refuseProspect(p.id)}
                            className="px-3 py-1.5 rounded-[10px] bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[11px] text-[#86868B] hover:text-[#FF3B30] dark:hover:text-[#FF453A] font-medium"
                          >
                            Refuser
                          </button>
                          <button
                            onClick={() => setAcceptProspectId(p.id)}
                            disabled={store.agents.length === 0}
                            className={`flex-1 px-3 py-1.5 rounded-[10px] text-[11px] font-semibold flex items-center justify-center gap-1.5 ${
                              store.agents.length === 0
                                ? "bg-[#E5E5EA] dark:bg-[#38383a] text-[#86868B] cursor-not-allowed"
                                : "bg-gradient-to-br from-[#34C759] to-[#007AFF] text-white shadow-sm hover:shadow"
                            }`}
                          >
                            <UserPlus size={11} /> {store.agents.length === 0 ? "Recrute d'abord" : "Accepter & affecter"}
                          </button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* Grille compacte : 4 colonnes desktop, 2 tablet, 1 mobile */}
        {filter !== "prospects" && (filtered.length === 0 ? (
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
                  {/* Header : logo client + nom + VIP */}
                  <div className="flex items-start gap-3 min-h-[40px]">
                    <ClientLogo client={d.client} secteur_categorie={d.secteur_categorie} size="md" />
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
                          <AgentAvatar initials={a.initiales} color={a.avatar_color} agentId={a.id} agentName={a.nom} size="xs" online={a.statut === "En ligne"} />
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
        ))}
      </div>

      {/* Modal d'affectation prospect → choisir un agent */}
      {acceptProspectId && (() => {
        const prospect = store.prospects_pending.find((p) => p.id === acceptProspectId);
        if (!prospect) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}>
            <div className="bg-white dark:bg-[#1c1c1e] rounded-[18px] p-6 max-w-[480px] w-full shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[16px] font-semibold text-[#1D1D1F] dark:text-white">Affecter {prospect.client}</h3>
                <button onClick={() => setAcceptProspectId(null)} className="text-[#86868B] hover:text-[#FF3B30]">
                  <X size={16} />
                </button>
              </div>
              <p className="text-[12px] text-[#86868B] dark:text-[#98989D] mb-4">
                Choisis le collaborateur qui va prendre en charge ce dossier.
              </p>
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {store.agents.map((a) => {
                  const charge = store.dossiers.filter((d) => d.agent_id === a.id && d.etat === "en_cours").length;
                  return (
                    <button
                      key={a.id}
                      onClick={() => {
                        store.acceptProspect(prospect.id, a.id);
                        setAcceptProspectId(null);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-[12px] bg-[#FAFAFB] dark:bg-[#2c2c2e] hover:bg-[#5B7CFA]/10 dark:hover:bg-[#5B7CFA]/20 transition-all text-left"
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shadow-sm" style={{ backgroundColor: a.avatar_color }}>
                        {a.initiales}
                      </div>
                      <div className="flex-1">
                        <div className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white">{a.nom}</div>
                        <div className="text-[10px] text-[#86868B] dark:text-[#98989D]">{a.role} · {a.filiere}</div>
                      </div>
                      <div className="text-right text-[10px] text-[#86868B] dark:text-[#98989D]">
                        <div>{charge} dossier{charge > 1 ? "s" : ""}</div>
                        <div className={a.stress > 70 ? "text-[#FF3B30]" : a.stress > 50 ? "text-[#FF9500]" : "text-[#34C759]"}>Stress {a.stress}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

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
