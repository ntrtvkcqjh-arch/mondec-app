"use client";

import { useState, useMemo, useEffect } from "react";
import { useGameStore } from "@/lib/supabase-store";
import { BarChart3, Calendar, AlertTriangle, X, ChevronRight, CheckCircle, Sparkles } from "lucide-react";

type DetailedStatut = "Brouillon" | "En cours" | "À valider" | "Déposée" | "En retard" | "Relance client";

interface Obligation {
  id: string;
  client: string;
  type: "TVA" | "IS" | "Liasse" | "CVAE" | "CFE";
  echeance_jour: number; // game_day cible
  echeance_label: string; // ex "TVA mai 2026 → 20 juin 2026"
  echeance_date_label: string; // ex "20 juin 2026"
  collaborateur_id: string;
  progression: number;
  competence_requise: string;
  statut: "ok" | "j7" | "j3" | "j1" | "retard";
  statut_detaille: DetailedStatut;
}

const TYPES_OBLIGATIONS: { type: Obligation["type"]; competence: string; couleur: string; label_suffix: string }[] = [
  { type: "TVA", competence: "Comptable/Social", couleur: "#007AFF", label_suffix: "TVA mensuelle" },
  { type: "IS", competence: "Fiscal", couleur: "#FF9500", label_suffix: "Acompte IS" },
  { type: "Liasse", competence: "Comptable", couleur: "#34C759", label_suffix: "Liasse fiscale" },
  { type: "CVAE", competence: "Comptable/Fiscal", couleur: "#AF52DE", label_suffix: "CVAE" },
  { type: "CFE", competence: "Fiscal", couleur: "#5856D6", label_suffix: "CFE" },
];

// Convertit un game_day en date réelle (départ : 14 mai 2026 = game_day 1).
function gameJourToDate(gameDay: number): Date {
  const start = new Date(2026, 4, 14); // mois 0-indexé : 4 = mai
  start.setDate(start.getDate() + gameDay - 1);
  return start;
}
function formatRealDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
function formatRealDateShort(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function dayOfWeekFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { weekday: "long" });
}

// Détermine le statut détaillé "métier" à partir de la progression + urgence
function computeDetailedStatut(progression: number, statut: Obligation["statut"]): DetailedStatut {
  if (statut === "retard") return "En retard";
  if (progression >= 100) return "Déposée";
  if (progression >= 80) return "À valider";
  if (progression >= 40) return "En cours";
  return "Brouillon";
}

const STATUT_DETAILLE_STYLE: Record<DetailedStatut, { bg: string; text: string; emoji: string }> = {
  "Brouillon":      { bg: "bg-[#86868B]/10 dark:bg-white/10",   text: "text-[#3a3a3c] dark:text-[#98989D]", emoji: "📝" },
  "En cours":       { bg: "bg-[#007AFF]/12 dark:bg-[#0A84FF]/20", text: "text-[#007AFF] dark:text-[#0A84FF]", emoji: "⚙️" },
  "À valider":      { bg: "bg-[#FF9500]/15 dark:bg-[#FF9F0A]/22", text: "text-[#C76A00] dark:text-[#FF9F0A]", emoji: "✋" },
  "Déposée":        { bg: "bg-[#34C759]/15 dark:bg-[#30D158]/22", text: "text-[#248A3D] dark:text-[#30D158]", emoji: "✓" },
  "En retard":      { bg: "bg-[#FF3B30]/15 dark:bg-[#FF453A]/22", text: "text-[#FF3B30] dark:text-[#FF453A]", emoji: "⚠️" },
  "Relance client": { bg: "bg-[#AF52DE]/12 dark:bg-[#BF5AF2]/20", text: "text-[#8334B8] dark:text-[#BF5AF2]", emoji: "📞" },
};

export function SuiviFiscalView() {
  const store = useGameStore();
  const [view, setView] = useState<"liste" | "calendrier" | "alertes">("liste");
  const [activeObligation, setActiveObligation] = useState<Obligation | null>(null);
  const [showAffectation, setShowAffectation] = useState<string | null>(null); // client id

  // Génère les obligations dynamiquement à partir des dossiers actifs
  const obligations: Obligation[] = useMemo(() => {
    const list: Obligation[] = [];
    const clientsUniques = Array.from(new Set(store.dossiers.map((d) => d.client)));
    clientsUniques.forEach((client, ci) => {
      const dossier = store.dossiers.find((d) => d.client === client);
      const baseAgent = dossier?.agent_id || store.agents[0]?.id || "";
      TYPES_OBLIGATIONS.forEach((t, ti) => {
        // Variation des échéances pour rendre l'affichage intéressant
        const offset = (ci * 7 + ti * 3) % 30;
        const echJourRelative = offset - 5; // jours restants par rapport à game_day
        const deadlineGameDay = store.game_day + echJourRelative;
        const realDate = gameJourToDate(deadlineGameDay);
        const obligationId = `${client}_${t.type}`;
        const isDeposee = !!store.fiscal_validations?.[obligationId];

        let statut: Obligation["statut"];
        if (isDeposee) statut = "ok"; // déposée = pas d'urgence
        else if (echJourRelative < 0) statut = "retard";
        else if (echJourRelative <= 1) statut = "j1";
        else if (echJourRelative <= 3) statut = "j3";
        else if (echJourRelative <= 7) statut = "j7";
        else statut = "ok";

        const progression = isDeposee
          ? 100
          : statut === "ok"
          ? 30 + Math.floor(Math.random() * 50)
          : statut === "retard"
          ? 50
          : 60 + Math.floor(Math.random() * 30);

        list.push({
          id: obligationId,
          client,
          type: t.type,
          echeance_jour: deadlineGameDay,
          echeance_label: `${t.label_suffix} → ${formatRealDate(realDate)}`,
          echeance_date_label: formatRealDate(realDate),
          collaborateur_id: baseAgent,
          progression,
          competence_requise: t.competence,
          statut,
          statut_detaille: isDeposee ? "Déposée" : computeDetailedStatut(progression, statut),
        });
      });
    });
    return list;
  }, [store.dossiers, store.agents, store.game_day, store.fiscal_validations]);

  // Group by client
  const parClient: Record<string, Obligation[]> = {};
  obligations.forEach((o) => {
    if (!parClient[o.client]) parClient[o.client] = [];
    parClient[o.client].push(o);
  });

  const retards = obligations.filter((o) => o.statut === "retard");
  const alertesJ1 = obligations.filter((o) => o.statut === "j1");
  const alertesJ3 = obligations.filter((o) => o.statut === "j3");

  // CASCADE — Déclenchement automatique des retards
  useEffect(() => {
    if (typeof window === "undefined") return;
    retards.forEach((o) => {
      const flag = `retard_${o.id}_${store.game_day}`;
      const previousCount = parseInt(localStorage.getItem(`retard_count_${o.id}`) || "0");
      if (!localStorage.getItem(flag)) {
        localStorage.setItem(flag, "1");
        const newCount = previousCount + 1;
        localStorage.setItem(`retard_count_${o.id}`, String(newCount));
        const niveau = Math.min(3, newCount) as 1 | 2 | 3;
        store.triggerRetardCascade(o.client, o.type, niveau);
      }
    });
  }, [retards.length, store.game_day]);

  // CASCADE — Détection surcharge agents
  useEffect(() => {
    const agentsAvecObligations: Record<string, number> = {};
    obligations.forEach((o) => {
      if (!o.collaborateur_id) return;
      agentsAvecObligations[o.collaborateur_id] = (agentsAvecObligations[o.collaborateur_id] || 0) + 1;
    });
    Object.entries(agentsAvecObligations).forEach(([agentId, count]) => {
      if (count >= 4) {
        const flag = `surcharge_${agentId}_${store.game_day}`;
        if (typeof window !== "undefined" && !localStorage.getItem(flag)) {
          localStorage.setItem(flag, "1");
          store.triggerSurchargeAgent(agentId);
        }
      }
    });
  }, [obligations.length, store.game_day]);

  function getStatutColor(s: Obligation["statut"]) {
    switch (s) {
      case "ok": return { bg: "bg-[#34C759]/15", text: "text-[#34C759]", border: "border-[#34C759]" };
      case "j7": return { bg: "bg-[#FFCC00]/15", text: "text-[#B07800]", border: "border-[#FFCC00]" };
      case "j3": return { bg: "bg-[#FF9500]/15", text: "text-[#FF9500]", border: "border-[#FF9500]" };
      case "j1": return { bg: "bg-[#FF3B30]/15", text: "text-[#FF3B30]", border: "border-[#FF3B30]" };
      case "retard": return { bg: "bg-[#FF3B30]/25", text: "text-white", border: "border-[#FF3B30]" };
    }
  }

  function getStatutLabel(s: Obligation["statut"]) {
    switch (s) {
      case "ok": return "🟢 OK";
      case "j7": return "🟡 J-7";
      case "j3": return "🟠 J-3";
      case "j1": return "🔴 J-1";
      case "retard": return "❌ RETARD";
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium tracking-[0.12em] uppercase text-[#86868B] mb-3">
              <span>☼</span><span>Calendrier</span><span>·</span><span>Obligations 12 mois</span>
            </div>
            <h2 className="text-[56px] font-semibold text-[#1D1D1F] dark:text-white tracking-[-0.04em] leading-[0.95]">Suivi Fiscal.</h2>
            <p className="text-[14px] text-[#86868B] mt-2">Obligations sur 12 mois · Affectation par collaborateur</p>
          </div>
          <div className="flex gap-1 bg-[#F5F5F7] dark:bg-[#2c2c2e] p-1 rounded-[10px]">
            <button onClick={() => setView("liste")}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-[7px] transition-all flex items-center gap-1 ${view === "liste" ? "bg-white text-[#1D1D1F] shadow-sm" : "text-[#86868B]"}`}>
              <BarChart3 size={11} /> Liste
            </button>
            <button onClick={() => setView("calendrier")}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-[7px] transition-all flex items-center gap-1 ${view === "calendrier" ? "bg-white text-[#1D1D1F] shadow-sm" : "text-[#86868B]"}`}>
              <Calendar size={11} /> Calendrier
            </button>
            <button onClick={() => setView("alertes")}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-[7px] transition-all flex items-center gap-1 ${view === "alertes" ? "bg-white text-[#1D1D1F] shadow-sm" : "text-[#86868B]"}`}>
              <AlertTriangle size={11} /> Alertes
              {(retards.length + alertesJ1.length) > 0 && (
                <span className="text-[9px] bg-[#FF3B30] text-white rounded-full px-1.5 py-0.5">{retards.length + alertesJ1.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* Bandeau alertes globales */}
        {(retards.length > 0 || alertesJ1.length > 0) && (
          <div className="bg-gradient-to-r from-[#FF3B30]/10 to-[#FF9500]/10 border border-[#FF3B30]/30 rounded-[14px] p-3 mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-[#FF3B30]" />
              <span className="font-semibold text-[13px] text-[#1D1D1F] dark:text-white">Attention</span>
              <span className="text-[12px] text-[#86868B]">
                {retards.length > 0 && <span className="text-[#FF3B30] font-medium">{retards.length} retard{retards.length > 1 ? "s" : ""}</span>}
                {retards.length > 0 && alertesJ1.length > 0 && " · "}
                {alertesJ1.length > 0 && <span className="text-[#FF3B30]">{alertesJ1.length} échéance{alertesJ1.length > 1 ? "s" : ""} demain</span>}
              </span>
            </div>
          </div>
        )}

        {/* VUE LISTE */}
        {view === "liste" && (
          <div className="space-y-3">
            {Object.entries(parClient).map(([client, obs]) => {
              const a = store.agents.find((x) => x.id === obs[0].collaborateur_id);
              return (
                <div key={client} className="bg-white rounded-[16px] border border-[#E5E5EA]/40 dark:border-[#38383a] overflow-hidden">
                  <div className="px-4 py-3 bg-gradient-to-r from-[#F5F5F7] to-white border-b border-[#E5E5EA]/40 dark:border-[#38383a] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-[#1D1D1F] dark:text-white">🏢 {client}</span>
                      {a && (
                        <span className="flex items-center gap-1 text-[10px] text-[#86868B]">
                          <span>Géré par</span>
                          <div className="w-4 h-4 rounded-full text-white text-[8px] flex items-center justify-center font-semibold" style={{ backgroundColor: a.avatar_color }}>{a.initiales}</div>
                          <span>{a.nom}</span>
                        </span>
                      )}
                    </div>
                    <button onClick={() => setShowAffectation(client)}
                      className="text-[11px] px-2.5 py-1 rounded-[8px] bg-[#007AFF]/10 text-[#007AFF] hover:bg-[#007AFF]/15 font-medium transition-all">
                      ⚡ Affecter
                    </button>
                  </div>
                  <table className="w-full">
                    <thead className="bg-[#F5F5F7]/50 dark:bg-[#2c2c2e]/50">
                      <tr className="text-[10px] text-[#86868B] dark:text-[#98989D] uppercase tracking-wider">
                        <th className="text-left px-4 py-2">Obligation</th>
                        <th className="text-left px-2 py-2">Échéance réelle</th>
                        <th className="text-left px-2 py-2">Statut</th>
                        <th className="text-left px-2 py-2">Urgence</th>
                        <th className="text-left px-2 py-2">Collaborateur</th>
                        <th className="text-right px-2 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {obs.map((o) => {
                        const colla = store.agents.find((x) => x.id === o.collaborateur_id);
                        const c = getStatutColor(o.statut);
                        const sd = STATUT_DETAILLE_STYLE[o.statut_detaille];
                        return (
                          <tr key={o.id} onClick={() => setActiveObligation(o)}
                            className="border-t border-[#E5E5EA]/30 dark:border-[#38383a] hover:bg-[#F5F5F7]/40 dark:hover:bg-[#2c2c2e]/40 cursor-pointer">
                            <td className="px-4 py-2.5 text-[12px] font-medium text-[#1D1D1F] dark:text-white">{o.type}</td>
                            <td className="px-2 py-2.5 text-[11px] text-[#3a3a3c] dark:text-[#d1d1d6] tabular-nums">{o.echeance_date_label}</td>
                            <td className="px-2 py-2.5">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${sd.bg} ${sd.text}`}>
                                <span>{sd.emoji}</span> {o.statut_detaille}
                              </span>
                            </td>
                            <td className="px-2 py-2.5">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${c.bg} ${c.text}`}>
                                {getStatutLabel(o.statut)}
                              </span>
                            </td>
                            <td className="px-2 py-2.5 text-[11px] text-[#86868B] dark:text-[#98989D]">
                              {colla ? colla.nom.split(" ")[0] : "—"}
                            </td>
                            <td className="px-2 py-2.5 text-right">
                              {o.statut_detaille !== "Déposée" ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); store.markObligationDeposee(o.id, o.type, o.client); }}
                                  className="text-[10px] font-semibold px-2 py-1 rounded-[8px] bg-[#34C759]/10 dark:bg-[#30D158]/15 text-[#248A3D] dark:text-[#30D158] hover:bg-[#34C759]/20 dark:hover:bg-[#30D158]/25"
                                  title="Marquer comme déposée"
                                >
                                  ✓ Déposer
                                </button>
                              ) : (
                                <span className="text-[10px] text-[#34C759]">
                                  Validée J{store.fiscal_validations?.[o.id]?.game_day || "?"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
            {Object.keys(parClient).length === 0 && (
              <div className="text-center py-12 text-[#86868B]">
                <BarChart3 size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-[13px]">Aucune obligation fiscale active</p>
              </div>
            )}
          </div>
        )}

        {/* VUE CALENDRIER HEATMAP */}
        {view === "calendrier" && (
          <div className="bg-white rounded-[16px] border border-[#E5E5EA]/40 dark:border-[#38383a] overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] text-[#86868B]">
                  <th className="text-left px-3 py-2 sticky left-0 bg-white z-10">Client / Obligation</th>
                  {["JAN", "FÉV", "MAR", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"].map((m) => (
                    <th key={m} className="px-2 py-2 text-center min-w-[40px]">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(parClient).map(([client, obs]) => (
                  <>
                    <tr key={client} className="bg-[#F5F5F7]/40">
                      <td className="px-3 py-1.5 text-[11px] font-semibold text-[#1D1D1F] sticky left-0 bg-[#F5F5F7]/40">🏢 {client}</td>
                      <td colSpan={12}></td>
                    </tr>
                    {obs.slice(0, 3).map((o) => {
                      const colla = store.agents.find((x) => x.id === o.collaborateur_id);
                      return (
                        <tr key={o.id} className="border-t border-[#E5E5EA]/30 dark:border-[#38383a]">
                          <td className="px-3 py-1.5 text-[10px] text-[#3a3a3c] sticky left-0 bg-white pl-6">{o.type}</td>
                          {Array.from({ length: 12 }).map((_, monthIdx) => {
                            const monthsAhead = monthIdx + 1;
                            const obligationMonth = (Math.floor(o.echeance_jour / 30) + 4) % 12; // approx
                            const isThis = monthIdx === obligationMonth;
                            return (
                              <td key={monthIdx} className="text-center p-1">
                                {isThis ? (
                                  <div className={`mx-auto w-8 h-6 rounded flex items-center justify-center text-[9px] font-semibold ${getStatutColor(o.statut).bg} ${getStatutColor(o.statut).text}`}
                                    title={`${o.type} · ${getStatutLabel(o.statut)} · ${colla ? colla.nom : "?"}`}>
                                    {o.statut === "ok" ? "✓" : o.statut === "retard" ? "✗" : "•"}
                                  </div>
                                ) : (
                                  <div className="mx-auto w-8 h-6 rounded bg-[#F5F5F7]/30" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-[#E5E5EA]/30 dark:border-[#38383a] space-y-2 text-[10px] text-[#86868B] dark:text-[#98989D]">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-semibold">Légende statut :</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-[#34C759]/15" /> OK / Déposée</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-[#FFCC00]/15" /> J-7 (à anticiper)</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-[#FF9500]/15" /> J-3 (boucler)</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-[#FF3B30]/15" /> J-1 (déposer aujourd'hui)</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-[#FF3B30]/25" /> RETARD (pénalités)</span>
              </div>
              <div className="border-t border-[#E5E5EA]/40 dark:border-[#38383a] pt-2">
                <div className="font-semibold mb-1">Calendrier fiscal réel français — cadences à connaître :</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0.5">
                  <span>• <strong>TVA mensuelle</strong> : déposer le <strong>20 du mois suivant</strong> (régime réel normal)</span>
                  <span>• <strong>TVA trimestrielle</strong> : 20 avril, 20 juillet, 20 octobre, 20 janvier</span>
                  <span>• <strong>IS — acomptes</strong> : 15 mars, 15 juin, 15 septembre, 15 décembre</span>
                  <span>• <strong>IS — solde</strong> : 15 mai (clôture 31/12) ou 4 mois après clôture</span>
                  <span>• <strong>Liasse fiscale 2065</strong> : 2ème jour ouvré suivant le 1er mai (clôture 31/12)</span>
                  <span>• <strong>CVAE</strong> : déclaration 1330-CVAE-SD le 2ème jour ouvré après le 1er mai</span>
                  <span>• <strong>CFE</strong> : solde au 15 décembre · acompte au 15 juin si > 3 000 €</span>
                  <span>• <strong>DSN mensuelle</strong> : 5 du mois pour les +50 salariés, 15 sinon</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VUE ALERTES */}
        {view === "alertes" && (
          <div className="space-y-2">
            {[...retards, ...alertesJ1, ...alertesJ3].map((o) => {
              const colla = store.agents.find((x) => x.id === o.collaborateur_id);
              const c = getStatutColor(o.statut);
              return (
                <div key={o.id} className={`bg-white rounded-[12px] p-3 border-l-4 ${c.border} border-r border-t border-b border-[#E5E5EA]/40 dark:border-[#38383a] flex items-center gap-3`}>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${c.bg} ${c.text}`}>{getStatutLabel(o.statut)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white">{o.type} — {o.client}</div>
                    <div className="text-[11px] text-[#86868B] dark:text-[#98989D]">Échéance {o.echeance_date_label} · {colla ? colla.nom : "Non affecté"}</div>
                  </div>
                  <button onClick={() => setShowAffectation(o.client)}
                    className="text-[11px] px-2.5 py-1 rounded-[8px] bg-[#007AFF]/10 text-[#007AFF] hover:bg-[#007AFF]/15 font-medium">
                    Réassigner
                  </button>
                </div>
              );
            })}
            {(retards.length + alertesJ1.length + alertesJ3.length) === 0 && (
              <div className="text-center py-12 text-[#86868B]">
                <CheckCircle size={32} className="mx-auto mb-2 text-[#34C759] opacity-60" />
                <p className="text-[13px]">Aucune alerte · Tout est à jour</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal affectation */}
      {showAffectation && (
        <AffectationModal client={showAffectation} obligations={parClient[showAffectation] || []} onClose={() => setShowAffectation(null)} />
      )}
    </div>
  );
}

function AffectationModal({ client, obligations, onClose }: { client: string; obligations: Obligation[]; onClose: () => void }) {
  const store = useGameStore();
  const [affectations, setAffectations] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    obligations.forEach((o) => { init[o.id] = o.collaborateur_id; });
    return init;
  });

  function getAgentCharge(agentId: string) {
    return obligations.filter((o) => affectations[o.id] === agentId).length;
  }

  function getIncompatibilites(agentId: string): string[] {
    const a = store.agents.find((x) => x.id === agentId);
    if (!a) return [];
    const warnings: string[] = [];
    if (a.stress > 75) warnings.push(`Stress élevé (${a.stress})`);
    if (a.fatigue > 75) warnings.push(`Fatigue élevée (${a.fatigue})`);
    if (a.confiance_joueur < 40) warnings.push(`Confiance basse (${a.confiance_joueur})`);
    if (getAgentCharge(agentId) >= 3) warnings.push(`Déjà ${getAgentCharge(agentId)} obligations affectées`);
    return warnings;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-[#E5E5EA]/40 dark:border-[#38383a] bg-gradient-to-r from-[#007AFF]/5 to-[#5856D6]/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#007AFF] to-[#0040DD] flex items-center justify-center shadow-md">
              <BarChart3 size={15} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-[15px] text-[#1D1D1F] dark:text-white">Affectation — {client}</h3>
              <p className="text-[11px] text-[#86868B]">{obligations.length} obligation{obligations.length > 1 ? "s" : ""} à répartir</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] flex items-center justify-center">
            <X size={14} className="text-[#86868B]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {obligations.map((o) => {
            const t = TYPES_OBLIGATIONS.find((tt) => tt.type === o.type);
            return (
              <div key={o.id} className="bg-[#F5F5F7]/50 rounded-[12px] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white">{o.type}</span>
                  <span className="text-[10px] text-[#86868B]">Compétence : {t?.competence || "—"}</span>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ml-auto ${o.statut === "retard" ? "bg-[#FF3B30]/15 text-[#FF3B30]" : o.statut === "j1" ? "bg-[#FF3B30]/10 text-[#FF3B30]" : "bg-[#34C759]/10 text-[#34C759]"}`}>
                    {o.echeance_date_label}
                  </span>
                </div>
                <select value={affectations[o.id]} onChange={(e) => setAffectations({ ...affectations, [o.id]: e.target.value })}
                  className="w-full text-[12px] p-2 border border-[#E5E5EA] rounded-[8px] outline-none focus:border-[#007AFF] bg-white">
                  <option value="">— Non affecté —</option>
                  {store.agents.map((a) => {
                    const warns = getIncompatibilites(a.id);
                    return (
                      <option key={a.id} value={a.id}>
                        {a.nom} ({a.filiere}) {warns.length > 0 ? ` ⚠ ${warns.join(", ")}` : ""}
                      </option>
                    );
                  })}
                </select>
                {affectations[o.id] && getIncompatibilites(affectations[o.id]).length > 0 && (
                  <div className="mt-1.5 text-[10px] text-[#FF9500] bg-[#FF9500]/8 px-2 py-1 rounded flex items-center gap-1">
                    <AlertTriangle size={9} /> {getIncompatibilites(affectations[o.id]).join(" · ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-6 py-3 bg-[#fafafa] border-t border-[#E5E5EA]/40 dark:border-[#38383a] flex items-center gap-2">
          <button className="px-3 py-2 text-[12px] rounded-[10px] bg-[#AF52DE]/10 text-[#AF52DE] hover:bg-[#AF52DE]/15 font-medium transition-all flex items-center gap-1">
            <Sparkles size={11} /> Laisser Claude choisir
          </button>
          <button onClick={onClose}
            className="ml-auto px-3 py-2 text-[12px] rounded-[10px] bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E5E5EA]">
            Annuler
          </button>
          <button onClick={onClose}
            className="px-4 py-2 text-[12px] font-medium rounded-[10px] bg-gradient-to-br from-[#007AFF] to-[#0040DD] text-white shadow-md hover:shadow-lg">
            Valider les affectations
          </button>
        </div>
      </div>
    </div>
  );
}
