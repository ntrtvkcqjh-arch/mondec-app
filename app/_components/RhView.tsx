"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/supabase-store";
import { UserPlus, Award, CheckCircle, X, Briefcase, FileText, Calendar as CalendarIcon, Users, Sparkles } from "lucide-react";

import cvData from "@/lib/data/cv_pool.json";

interface Candidat {
  id: string; nom: string; age: number; poste_vise: string; experience_annees: number;
  competence_pct: number; specialites: string[]; salaire_demande: number;
  disponibilite: string; trait_dominant: string; filiere: string;
  notes_sophie: string; score_match: number;
}

interface Recrutement {
  id: string; poste: string; raison: string; budget: number;
  urgence: "haute" | "moyenne" | "basse"; deadline_jour: number;
  candidats_recus: number; entretiens_planifies: number;
}

export function RhView() {
  const store = useGameStore();
  const candidats: Candidat[] = (cvData as any).candidats || [];
  const recrutements: Recrutement[] = (cvData as any).recrutements_actifs || [];
  const [activeCV, setActiveCV] = useState<Candidat | null>(null);
  const [tab, setTab] = useState<"sophie" | "cv" | "recrutements">("sophie");
  const [reportValidated, setReportValidated] = useState(false);

  const sophie = store.agents.find((a) => a.role && a.role.toLowerCase().includes("rh"));

  function handleEmbauche(c: Candidat) {
    if (store.tresorerie < c.salaire_demande * 3) {
      alert(`Budget insuffisant. Il faut au moins ${(c.salaire_demande * 3 / 1000).toFixed(0)}k€ de trésorerie (3 mois de salaire de sécurité).`);
      return;
    }
    store.setResources({
      tresorerie: store.tresorerie - c.salaire_demande * 3,
      reputation: Math.min(100, store.reputation + 5),
    });
    // CASCADE : Ajoute l'agent à l'équipe + message N1 de Sophie
    store.hireFromCV(c);
    store.applyEmbaucheBonus(c.nom);
    alert(`✅ ${c.nom} embauché(e) ! L'équipe a été notifiée. +5 Réputation · +3 Légitimité · −5 stress équipe · −${(c.salaire_demande * 3 / 1000).toFixed(0)}k€ trésorerie`);
    setActiveCV(null);
  }

  function handleEntretien(c: Candidat) {
    if (store.points_action < 1) {
      alert("1 Point d'Action requis pour l'entretien.");
      return;
    }
    store.spendPA(1);
    alert(`Entretien avec ${c.nom} planifié. Sophie te fera un retour demain.`);
  }

  function handleValiderReport() {
    if (reportValidated) return;
    store.setResources({ legitimite: Math.min(100, store.legitimite + 5) });
    setReportValidated(true);
    alert("Compte-rendu validé · +5 Légitimité");
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-5">
          <div className="flex items-center gap-2 text-[11px] font-medium tracking-[0.12em] uppercase text-[#86868B] mb-3">
            <span>☼</span><span>Talents</span><span>·</span><span>Recrutement</span>
          </div>
          <h2 className="text-[56px] font-semibold text-[#1D1D1F] dark:text-white tracking-[-0.04em] leading-[0.95]">RH.</h2>
          <p className="text-[14px] text-[#86868B] mt-2">Compte-rendu Sophie · CV · Gestion des talents</p>
        </div>

        {/* Tabs internes */}
        <div className="flex gap-1.5 mb-4 bg-[#F5F5F7] dark:bg-[#1F1F22] p-1 rounded-[10px] inline-flex">
          {[
            { id: "sophie", label: "📊 Compte-rendu Sophie" },
            { id: "cv", label: `📄 CV à l'étude (${candidats.length})` },
            { id: "recrutements", label: `💼 Recrutements (${recrutements.length})` },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-[8px] transition-all ${tab === t.id ? "bg-white text-[#1D1D1F] shadow-sm" : "text-[#86868B]"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB SOPHIE */}
        {tab === "sophie" && (
          <div className="space-y-3">
            {/* Carte Sophie */}
            {sophie && (
              <div className="bg-gradient-to-br from-[#AF52DE]/8 to-[#5856D6]/8 border border-[#AF52DE]/20 rounded-[18px] p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-[15px] font-bold shadow-md" style={{ backgroundColor: sophie.avatar_color }}>
                    {sophie.initiales}
                  </div>
                  <div>
                    <h3 className="font-bold text-[16px] text-[#1D1D1F] tracking-tight">{sophie.nom}</h3>
                    <p className="text-[12px] text-[#86868B]">{sophie.role} · Stress {sophie.stress} · Confiance {sophie.confiance_joueur}</p>
                  </div>
                </div>
                <p className="text-[12px] text-[#3a3a3c] italic leading-relaxed">
                  "Salut chef, voici ton compte-rendu hebdo. Tout n'est pas rose mais je gère."
                </p>
              </div>
            )}

            {/* Compte-rendu */}
            <div className="bg-white dark:bg-[#1A1A1C] rounded-[18px] p-5 border border-[#E5E5EA]/40 dark:border-[#2A2A2E]">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={14} className="text-[#AF52DE]" />
                <span className="font-semibold text-[14px] text-[#1D1D1F] dark:text-white">Compte-rendu semaine · Jour {store.game_day}</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 pb-3 border-b border-[#F5F5F7]">
                  <div className="text-[20px]">📊</div>
                  <div className="flex-1">
                    <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white">Turnover</div>
                    <div className="text-[11px] text-[#86868B]">
                      {store.agents.filter((a: any) => a.arc_actuel === "Rupture").length === 0
                        ? "0 départ · équipe stable cette semaine"
                        : `⚠ ${store.agents.filter((a: any) => a.arc_actuel === "Rupture").length} risque(s) de départ`}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 pb-3 border-b border-[#F5F5F7]">
                  <div className="text-[20px]">⚠️</div>
                  <div className="flex-1">
                    <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white">Alertes en détresse</div>
                    {store.agents.filter((a) => a.stress > 70 || a.fatigue > 70).slice(0, 3).map((a) => (
                      <div key={a.id} className="text-[11px] text-[#86868B]">
                        • <span className="text-[#FF3B30] font-medium">{a.nom}</span> (Stress {a.stress}) — recommande entretien
                      </div>
                    ))}
                    {store.agents.filter((a) => a.stress > 70 || a.fatigue > 70).length === 0 && (
                      <div className="text-[11px] text-[#34C759]">Aucune alerte critique</div>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 pb-3 border-b border-[#F5F5F7]">
                  <div className="text-[20px]">🎓</div>
                  <div className="flex-1">
                    <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white">Formations</div>
                    <div className="text-[11px] text-[#86868B]">
                      {store.agents.filter((a) => a.fatigue < 50).length} demande(s) en attente · budget formation OK
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 pb-3 border-b border-[#F5F5F7]">
                  <div className="text-[20px]">💰</div>
                  <div className="flex-1">
                    <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white">Budget RH</div>
                    <div className="text-[11px] text-[#86868B]">
                      {(store.tresorerie / 1000).toFixed(0)}k€ disponible · Salaires mensuels estimés : {(store.agents.length * 4.5).toFixed(0)}k€
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="text-[20px]">📈</div>
                  <div className="flex-1">
                    <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white">Recrutement</div>
                    <div className="text-[11px] text-[#86868B]">
                      {recrutements.length} poste{recrutements.length > 1 ? "s" : ""} ouvert{recrutements.length > 1 ? "s" : ""} · {candidats.length} CV à étudier
                    </div>
                  </div>
                </div>
              </div>

              <button onClick={handleValiderReport} disabled={reportValidated}
                className={`mt-4 w-full py-2.5 rounded-[10px] text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 ${reportValidated ? "bg-[#34C759]/15 text-[#34C759] cursor-default" : "bg-gradient-to-br from-[#AF52DE] to-[#5856D6] text-white shadow-md hover:shadow-lg"}`}>
                {reportValidated ? <><CheckCircle size={13} /> Compte-rendu validé · +5 Légitimité</> : "Valider le compte-rendu · +5 Légitimité"}
              </button>
            </div>
          </div>
        )}

        {/* TAB CV */}
        {tab === "cv" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {candidats.map((c) => (
              <div key={c.id} className="bg-white dark:bg-[#1A1A1C] rounded-[16px] p-4 border border-[#E5E5EA]/40 dark:border-[#2A2A2E] hover:shadow-md transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#AF52DE] to-[#5856D6] flex items-center justify-center text-white font-bold text-[14px] shadow-sm shrink-0">
                    {c.nom.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[14px] text-[#1D1D1F] dark:text-white">{c.nom}</div>
                    <div className="text-[11px] text-[#86868B]">{c.age} ans · {c.poste_vise}</div>
                    <div className="text-[10px] text-[#86868B] mt-0.5">{c.experience_annees} ans d'exp · {c.disponibilite}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[18px] font-bold tabular-nums" style={{ color: c.score_match >= 80 ? "#34C759" : c.score_match >= 60 ? "#FF9500" : "#FF3B30" }}>{c.score_match}</div>
                    <div className="text-[9px] text-[#86868B]">match</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#86868B] w-20">Compétence</span>
                    <div className="flex-1 h-[3px] bg-[#E5E5EA] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${c.competence_pct}%`, backgroundColor: "#007AFF" }} />
                    </div>
                    <span className="text-[10px] text-[#86868B] w-6 text-right">{c.competence_pct}</span>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  {c.specialites.slice(0, 3).map((s, i) => (
                    <span key={i} className="text-[9px] bg-[#007AFF]/8 text-[#007AFF] px-1.5 py-0.5 rounded-md font-medium">{s}</span>
                  ))}
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-[#F5F5F7] flex items-center justify-between text-[11px]">
                  <span className="text-[#86868B]">Salaire : <span className="font-semibold text-[#1D1D1F] dark:text-white">{(c.salaire_demande / 1000).toFixed(0)}k€</span></span>
                  <button onClick={() => setActiveCV(c)}
                    className="px-2.5 py-1 rounded-[8px] bg-[#007AFF]/10 text-[#007AFF] hover:bg-[#007AFF]/15 font-medium text-[11px]">
                    Voir CV
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB RECRUTEMENTS */}
        {tab === "recrutements" && (
          <div className="space-y-3">
            {recrutements.map((r) => (
              <div key={r.id} className="bg-white dark:bg-[#1A1A1C] rounded-[16px] p-4 border border-[#E5E5EA]/40 dark:border-[#2A2A2E]">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[#FF9500] to-[#FF3B30] flex items-center justify-center shadow-sm">
                    <Briefcase size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-semibold text-[14px] text-[#1D1D1F] dark:text-white">{r.poste}</span>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${r.urgence === "haute" ? "bg-[#FF3B30]/15 text-[#FF3B30]" : r.urgence === "moyenne" ? "bg-[#FF9500]/15 text-[#FF9500]" : "bg-[#86868B]/15 text-[#86868B]"}`}>
                        Urgence {r.urgence}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#86868B]">{r.raison}</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-[11px]">
                  <div className="bg-[#F5F5F7] rounded-[8px] p-2">
                    <div className="text-[#86868B] text-[9px]">Budget</div>
                    <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white">{(r.budget / 1000).toFixed(0)}k€</div>
                  </div>
                  <div className="bg-[#F5F5F7] rounded-[8px] p-2">
                    <div className="text-[#86868B] text-[9px]">CV reçus</div>
                    <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white">{r.candidats_recus}</div>
                  </div>
                  <div className="bg-[#F5F5F7] rounded-[8px] p-2">
                    <div className="text-[#86868B] text-[9px]">Entretiens</div>
                    <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white">{r.entretiens_planifies}</div>
                  </div>
                  <div className="bg-[#F5F5F7] rounded-[8px] p-2">
                    <div className="text-[#86868B] text-[9px]">Deadline</div>
                    <div className="text-[12px] font-semibold text-[#FF9500]">J+{r.deadline_jour}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal CV */}
      {activeCV && (
        <CVModal candidat={activeCV} onClose={() => setActiveCV(null)} onEmbauche={() => handleEmbauche(activeCV)} onEntretien={() => handleEntretien(activeCV)} />
      )}
    </div>
  );
}

function CVModal({ candidat: c, onClose, onEmbauche, onEntretien }: { candidat: Candidat; onClose: () => void; onEmbauche: () => void; onEntretien: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[22px] shadow-2xl w-full max-w-xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-[#E5E5EA]/40 dark:border-[#2A2A2E] bg-gradient-to-r from-[#AF52DE]/5 to-[#5856D6]/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#AF52DE] to-[#5856D6] flex items-center justify-center text-white font-bold text-[14px] shadow-md">
              {c.nom.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <h3 className="font-bold text-[16px] text-[#1D1D1F] tracking-tight">{c.nom}</h3>
              <p className="text-[12px] text-[#86868B]">{c.age} ans · {c.poste_vise}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] flex items-center justify-center">
            <X size={14} className="text-[#86868B]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="bg-[#F5F5F7] rounded-[10px] p-2.5 text-center">
              <div className="text-[18px] font-bold tabular-nums" style={{ color: c.score_match >= 80 ? "#34C759" : c.score_match >= 60 ? "#FF9500" : "#FF3B30" }}>{c.score_match}</div>
              <div className="text-[#86868B] text-[9px]">Match cabinet</div>
            </div>
            <div className="bg-[#F5F5F7] rounded-[10px] p-2.5 text-center">
              <div className="text-[18px] font-bold text-[#007AFF] tabular-nums">{c.competence_pct}</div>
              <div className="text-[#86868B] text-[9px]">Compétence</div>
            </div>
            <div className="bg-[#F5F5F7] rounded-[10px] p-2.5 text-center">
              <div className="text-[18px] font-bold text-[#1D1D1F] tabular-nums">{c.experience_annees}</div>
              <div className="text-[#86868B] text-[9px]">Ans d'exp</div>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">Spécialités</div>
            <div className="flex flex-wrap gap-1">
              {c.specialites.map((s, i) => (
                <span key={i} className="text-[11px] bg-[#007AFF]/8 text-[#007AFF] px-2 py-0.5 rounded-md font-medium">{s}</span>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">Profil</div>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="bg-[#F5F5F7] rounded-[10px] p-2.5">
                <div className="text-[#86868B] text-[9px] uppercase">Trait dominant</div>
                <div className="font-semibold text-[#1D1D1F] dark:text-white">{c.trait_dominant}</div>
              </div>
              <div className="bg-[#F5F5F7] rounded-[10px] p-2.5">
                <div className="text-[#86868B] text-[9px] uppercase">Filière</div>
                <div className="font-semibold text-[#1D1D1F] dark:text-white">{c.filiere}</div>
              </div>
              <div className="bg-[#F5F5F7] rounded-[10px] p-2.5">
                <div className="text-[#86868B] text-[9px] uppercase">Salaire demandé</div>
                <div className="font-semibold text-[#1D1D1F] dark:text-white">{(c.salaire_demande / 1000).toFixed(0)}k€/an</div>
              </div>
              <div className="bg-[#F5F5F7] rounded-[10px] p-2.5">
                <div className="text-[#86868B] text-[9px] uppercase">Disponibilité</div>
                <div className="font-semibold text-[#1D1D1F] dark:text-white">{c.disponibilite}</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#AF52DE]/8 to-[#5856D6]/8 border border-[#AF52DE]/20 rounded-[12px] p-3">
            <div className="flex items-start gap-2">
              <div className="text-[20px]">💬</div>
              <div>
                <div className="text-[10px] font-semibold text-[#AF52DE] uppercase tracking-wider mb-1">Notes de Sophie</div>
                <p className="text-[12px] text-[#1D1D1F] italic leading-relaxed">"{c.notes_sophie}"</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-[#fafafa] border-t border-[#E5E5EA]/40 dark:border-[#2A2A2E] flex items-center gap-2">
          <button onClick={onClose}
            className="px-3 py-2 text-[12px] rounded-[10px] bg-[#FF3B30]/10 text-[#FF3B30] hover:bg-[#FF3B30]/15 font-medium transition-all">
            Refuser
          </button>
          <button onClick={onEntretien}
            className="ml-auto px-3 py-2 text-[12px] rounded-[10px] bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E5E5EA] font-medium transition-all flex items-center gap-1">
            🎤 Entretien (1 PA)
          </button>
          <button onClick={onEmbauche}
            className="px-4 py-2 text-[12px] font-semibold rounded-[10px] bg-gradient-to-br from-[#34C759] to-[#007AFF] text-white shadow-md hover:shadow-lg flex items-center gap-1.5">
            <CheckCircle size={11} /> Embaucher
          </button>
        </div>
      </div>
    </div>
  );
}
