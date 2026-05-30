"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/supabase-store";
import { FolderOpen, Sparkles, RefreshCw } from "lucide-react";
import { ClientFicheModal } from "./ClientFicheModal";

function getPhaseColor(phase: string | null) {
  switch (phase) {
    case "P5": return "bg-[#FF3B30]/15 text-[#FF3B30]";
    case "P4": return "bg-[#FF9500]/15 text-[#FF9500]";
    case "P3": return "bg-[#007AFF]/15 text-[#007AFF]";
    case "P2": return "bg-[#34C759]/15 text-[#34C759]";
    default: return "bg-[#86868B]/15 text-[#86868B]";
  }
}

function DossierStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white px-3 py-2 rounded-[12px] border border-[#E5E5EA]/40 dark:border-[#38383a] text-center min-w-[78px] shadow-sm">
      <div className="text-[18px] font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[10px] text-[#86868B]">{label}</div>
    </div>
  );
}

export function DossiersView() {
  const store = useGameStore();
  const [filter, setFilter] = useState<"en_cours" | "surveillance" | "avance" | "cloture" | "perdu" | "tous">("en_cours");
  const [ficheId, setFicheId] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => store.recomputeAllDossierStatus(), 8000);
    return () => clearInterval(t);
  }, []);

  // CASCADE — Détection drama mauvaise affectation (toutes les 2 min jeu)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = `drama_check_${store.game_day}_${Math.floor(store.game_minute / 30)}`;
    if (localStorage.getItem(flag)) return;
    localStorage.setItem(flag, "1");

    store.dossiers.forEach((d) => {
      if (d.etat !== "en_cours" && d.etat !== "surveillance") return;
      const incompat = store.computeIncompatibilites(d.id, d.agent_id);
      if (incompat.length >= 2) {
        store.triggerBadAffectationDrama(d.id);
      }
    });
  }, [store.dossiers.length, store.game_day, store.game_minute]);

  const enCours = store.dossiers.filter((d) => d.etat === "en_cours").length;
  const surveillance = store.dossiers.filter((d) => d.etat === "surveillance").length;
  const avances = store.dossiers.filter((d) => d.etat === "avance").length;
  const clotures = store.dossiers.filter((d) => d.etat === "cloture").length;
  const perdus = store.dossiers.filter((d) => d.etat === "perdu").length;

  const filtered = filter === "tous" ? store.dossiers : store.dossiers.filter((d) => d.etat === filter);

  const statusMeta: any = {
    en_cours: { label: "EN COURS", color: "#007AFF", bg: "bg-[#007AFF]/15", border: "border-[#E5E5EA]/40 dark:border-[#38383a]" },
    surveillance: { label: "SURVEILLANCE", color: "#FF9500", bg: "bg-[#FF9500]/15", border: "border-[#FF9500]/30" },
    avance: { label: "AVANCÉ", color: "#34C759", bg: "bg-[#34C759]/15", border: "border-[#34C759]/30" },
    cloture: { label: "CLÔTURÉ", color: "#86868B", bg: "bg-[#86868B]/15", border: "border-[#86868B]/30" },
    perdu: { label: "PERDU", color: "#FF3B30", bg: "bg-[#FF3B30]/15", border: "border-[#FF3B30]/30" },
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium tracking-[0.12em] uppercase text-[#86868B] mb-3">
              <span>☼</span><span>Portefeuille</span><span>·</span><span>Fiches clients</span>
            </div>
            <h2 className="text-[56px] font-semibold text-[#1D1D1F] dark:text-white tracking-[-0.04em] leading-[0.95]">Dossiers.</h2>
            <p className="text-[14px] text-[#86868B] mt-2">Aperçu temps réel · Les statuts évoluent selon ton travail</p>
          </div>
          <div className="flex gap-1.5">
            <DossierStat label="En cours" value={enCours} color="#007AFF" />
            <DossierStat label="Surveille" value={surveillance} color="#FF9500" />
            <DossierStat label="Avancés" value={avances} color="#34C759" />
            <DossierStat label="Clôturés" value={clotures} color="#86868B" />
            <DossierStat label="Perdus" value={perdus} color="#FF3B30" />
          </div>
        </div>

        <div className="flex gap-1.5 mb-4 bg-[#F5F5F7] dark:bg-[#2c2c2e] p-1 rounded-[12px] inline-flex flex-wrap">
          {(["en_cours", "surveillance", "avance", "cloture", "perdu", "tous"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-[8px] transition-all ${filter === f ? "bg-white text-[#1D1D1F] shadow-sm" : "text-[#86868B] hover:text-[#1D1D1F] dark:text-white"}`}>
              {f === "en_cours" ? "En cours" : f === "surveillance" ? "Surveillance" : f === "avance" ? "Avancés" : f === "cloture" ? "Clôturés" : f === "perdu" ? "Perdus" : "Tous"}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.map((d) => {
            const a = store.agents.find((x) => x.id === d.agent_id);
            const meta = statusMeta[d.etat];
            const recoverable = d.etat === "perdu" && d.recoverable_until && new Date(d.recoverable_until) > new Date();

            return (
              <div key={d.id} onClick={() => setFicheId(d.id)} className={`bg-white dark:bg-[#1c1c1e] rounded-[14px] p-4 border transition-all cursor-pointer ${meta.border} ${d.is_vip ? "ring-2 ring-[#AF52DE]/30" : ""} ${
                d.etat === "avance" ? "bg-[#34C759]/5" :
                d.etat === "perdu" ? "bg-[#FF3B30]/5 opacity-80" :
                d.etat === "surveillance" ? "bg-[#FF9500]/5" :
                d.etat === "cloture" ? "bg-[#86868B]/5" :
                "hover:shadow-md"
              }`}>
                <div className="flex items-start gap-3">
                  {a && (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0 shadow-sm" style={{ backgroundColor: a.avatar_color }}>
                      {a.initiales}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-[14px] text-[#1D1D1F] dark:text-white">{d.client}</span>
                      {d.is_vip && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-gradient-to-r from-[#AF52DE] to-[#5856D6] text-white">⭐ VIP</span>}
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${getPhaseColor(d.phase)}`}>{d.phase}</span>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ml-auto ${meta.bg}`} style={{ color: meta.color }}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#86868B] mb-2">{d.theme} · échéance {d.echeance_heure} · {d.cas_traites} cas traité{d.cas_traites > 1 ? "s" : ""}</p>

                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-[#86868B] w-14">Progression</span>
                        <div className="flex-1 h-[4px] bg-[#E5E5EA] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${d.progression}%`, backgroundColor: meta.color }} />
                        </div>
                        <span className="text-[9px] font-semibold tabular-nums w-7 text-right" style={{ color: meta.color }}>{d.progression}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-[#86868B] w-14">Qualité</span>
                        <div className="flex-1 h-[4px] bg-[#E5E5EA] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${d.qualite}%`, backgroundColor: d.qualite >= 70 ? "#34C759" : d.qualite >= 50 ? "#FF9500" : "#FF3B30" }} />
                        </div>
                        <span className="text-[9px] font-semibold tabular-nums w-7 text-right" style={{ color: d.qualite >= 70 ? "#34C759" : d.qualite >= 50 ? "#FF9500" : "#FF3B30" }}>{d.qualite}%</span>
                      </div>
                    </div>

                    {d.signaux_alerte.length > 0 && d.etat !== "perdu" && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {d.signaux_alerte.map((s, i) => {
                          const labels: Record<string, string> = {
                            agent_burnout: "⚠ Agent en burn-out",
                            confiance_basse: "⚠ Confiance basse",
                            agent_rupture: "⚠ Risque départ agent",
                            retard_critique: "⚠ Retard J+5",
                            cabinet_crise: "⚠ Mood Crise",
                          };
                          return (
                            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#FF9500]/10 text-[#FF9500] font-medium">
                              {labels[s] || s}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {d.etat === "perdu" && d.cause_perte && (
                      <div className="bg-[#FF3B30]/8 border border-[#FF3B30]/15 rounded-[8px] p-2 mb-2">
                        <p className="text-[10px] text-[#FF3B30] font-medium">Cause : {d.cause_perte}</p>
                        {recoverable && (
                          <p className="text-[9px] text-[#86868B] mt-0.5">Récupération possible jusqu'au {new Date(d.recoverable_until!).toLocaleDateString("fr-FR")}</p>
                        )}
                      </div>
                    )}

                    {(d.etat === "en_cours" || d.etat === "surveillance") && (
                      <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-[#86868B]">
                        <RefreshCw size={9} className="animate-spin" style={{ animationDuration: "3s" }} />
                        <span>
                          {d.etat === "surveillance"
                            ? "Statut surveillé · agis sur l'agent ou réponds vite avant que le client ne parte"
                            : a ? `${a.nom.split(" ")[0]} travaille en autonomie — réponds aux messages pour accélérer` : "Avancement automatique"}
                        </span>
                      </div>
                    )}

                    {recoverable && (
                      <div className="mt-2.5">
                        <button onClick={(e) => {
                            e.stopPropagation();
                            const ok = store.attemptRecoverDossier(d.id);
                            if (!ok) alert("Tentative ratée. Le client refuse de revenir.");
                          }}
                          className="text-[11px] px-2.5 py-1 rounded-[8px] bg-gradient-to-r from-[#AF52DE]/15 to-[#007AFF]/15 text-[#AF52DE] hover:from-[#AF52DE]/25 hover:to-[#007AFF]/25 font-semibold transition-all flex items-center gap-1">
                          <Sparkles size={11} /> Tentative récupération (1h · honoraires ×1,5)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-[#86868B]">
              <FolderOpen size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-[13px]">Aucun dossier dans cette catégorie</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal fiche client détaillée */}
      {ficheId && (() => {
        const d = store.dossiers.find((x) => x.id === ficheId);
        if (!d) return null;
        return <ClientFicheModal dossier={d} onClose={() => setFicheId(null)} />;
      })()}
    </div>
  );
}
