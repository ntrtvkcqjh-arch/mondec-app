"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/supabase-store";
import { apiFetch } from "@/lib/api-client";
import { Flame, Trophy, Users, GraduationCap, Briefcase, MessageSquare, CheckCircle, Target, Coffee, Lock, ChevronRight, X, RefreshCw, Sparkles, Zap } from "lucide-react";

import agendaData from "@/lib/data/agenda.json";
import casesData from "@/lib/data/cases_pool.json";

type SlotType = "briefing" | "cas_pratique" | "rdv_client" | "mediation" | "validation" | "debrief" | "pause";

interface AgendaSlot {
  heure: string;
  type: SlotType;
  titre: string;
  theme: string;
  agent_id?: string;
  duree_min: number;
  xp_max: number;
  niveau_requis: number;
  case_id?: string;
}

interface CaseStudy {
  titre: string;
  client: string;
  contexte: string;
  enonce: string;
  question: string;
  xp_potentiel: number;
  criteres: string[];
}

interface Correction {
  score: number;
  verdict: string;
  analogie: string;
  correction: string;
  points_forts: string[];
  axes_amelioration: string[];
  xp_gagne: number;
  impact_legitimite: number;
  impact_stress: number;
}

function getSlotIcon(type: SlotType) {
  switch (type) {
    case "briefing": return Users;
    case "cas_pratique": return GraduationCap;
    case "rdv_client": return Briefcase;
    case "mediation": return MessageSquare;
    case "validation": return CheckCircle;
    case "debrief": return Target;
    case "pause": return Coffee;
  }
}

function getSlotColor(type: SlotType) {
  switch (type) {
    case "cas_pratique": return "#007AFF";
    case "rdv_client": return "#AF52DE";
    case "mediation": return "#FF9500";
    case "validation": return "#34C759";
    case "briefing": return "#5856D6";
    case "debrief": return "#64D2FF";
    case "pause": return "#86868B";
  }
}

function timeToMinutes(t: string) {
  const parts = t.split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

export function AgendaView({ apiStatus }: { apiStatus: "checking" | "ok" | "error" }) {
  const store = useGameStore();
  const slots: AgendaSlot[] = (agendaData as any).slots_quotidiens || [];
  const casesPool: any[] = (casesData as any).cases || [];
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [activeSlot, setActiveSlot] = useState<AgendaSlot | null>(null);
  const [activeCase, setActiveCase] = useState<CaseStudy | null>(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [correction, setCorrection] = useState<Correction | null>(null);

  function fallbackCase(slot: AgendaSlot): CaseStudy | null {
    if (!casesPool.length) return null;
    if (slot.case_id) {
      const exact = casesPool.find((c: any) => c.case_id === slot.case_id);
      if (exact) {
        return {
          titre: exact.titre, client: exact.client, contexte: exact.contexte,
          enonce: exact.enonce, question: exact.question,
          xp_potentiel: exact.xp_potentiel, criteres: exact.criteres,
        };
      }
    }
    const stopwords = new Set(["et", "le", "la", "les", "des", "du", "de", "un", "une", "à", "sur", "pour"]);
    const themeKeywords = slot.theme.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && !stopwords.has(w));
    const matching = casesPool.filter((c: any) =>
      c.niveau_min <= store.player_level &&
      c.themes.some((t: string) => themeKeywords.some((k) => t.toLowerCase().includes(k) || k.includes(t.toLowerCase())))
    );
    const pool = matching.length ? matching : casesPool.filter((c: any) => c.niveau_min <= store.player_level);
    if (!pool.length) return null;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    return {
      titre: chosen.titre, client: chosen.client, contexte: chosen.contexte,
      enonce: chosen.enonce, question: chosen.question,
      xp_potentiel: chosen.xp_potentiel, criteres: chosen.criteres,
    };
  }

  function fallbackCorrection(text: string): Correction {
    const txt = text.toLowerCase();
    const jargon = ["pcg", "crc", "ifrs", "ias", "bofip", "cgi", "art.", "tva", "csg", "dsn"];
    const jargonCount = jargon.filter((k) => txt.includes(k)).length;
    const lengthScore = Math.min(40, Math.floor(text.length / 8));
    const score = Math.min(95, 30 + lengthScore + jargonCount * 10);
    return {
      score,
      verdict: score >= 75 ? "Bien" : score >= 50 ? "Satisfaisant" : "À retravailler",
      analogie: "Comme un cuisinier qui dresse une assiette sans goûter — la forme y est, vérifie maintenant le fond.",
      correction: "L'IA correctrice est indisponible. Compare ta réponse avec la grille des critères.",
      points_forts: jargonCount > 0 ? [`${jargonCount} référence(s) technique(s)`] : ["Réponse rédigée"],
      axes_amelioration: jargonCount === 0 ? ["Cite des articles précis"] : ["Détaille le calcul"],
      xp_gagne: Math.floor(score / 4),
      impact_legitimite: score >= 70 ? 2 : score >= 50 ? 0 : -1,
      impact_stress: score >= 70 ? -2 : 1,
    };
  }

  async function openSlot(slot: AgendaSlot) {
    if (slot.type === "pause") return;
    if (store.player_level < slot.niveau_requis) {
      alert(`Niveau ${slot.niveau_requis} requis (tu es niveau ${store.player_level})`);
      return;
    }
    setActiveSlot(slot);
    setActiveCase(null);
    setResponse("");
    setCorrection(null);
    setCaseLoading(true);

    if (apiStatus === "error" && slot.case_id) {
      const fb = fallbackCase(slot);
      if (fb) { setActiveCase(fb); setCaseLoading(false); return; }
    }

    try {
      const a = slot.agent_id ? store.agents.find((x) => x.id === slot.agent_id) : null;
      const res = await apiFetch("/api/case-study", {
        method: "POST",
        body: JSON.stringify({
          theme: slot.theme, titre_slot: slot.titre, type_slot: slot.type,
          player_level: store.player_level, hour: store.game_hour, day: store.game_day,
          agent_context: a,
        }),
      });
      const data = await res.json();
      if (data.titre) setActiveCase(data);
      else {
        const fb = fallbackCase(slot);
        if (fb) setActiveCase(fb);
        else { alert("Impossible de générer le cas pratique."); setActiveSlot(null); }
      }
    } catch (err) {
      const fb = fallbackCase(slot);
      if (fb) setActiveCase(fb);
      else { alert("Erreur réseau."); setActiveSlot(null); }
    } finally { setCaseLoading(false); }
  }

  async function submit() {
    if (!activeCase || !response.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/correct", {
        method: "POST",
        body: JSON.stringify({ case_study: activeCase, player_response: response, player_level: store.player_level }),
      });
      const data = await res.json();
      const result: Correction = data.score !== undefined ? data : fallbackCorrection(response);
      setCorrection(result);
      store.addXP(result.xp_gagne || 0);
      if (result.impact_legitimite) {
        store.setResources({ legitimite: Math.max(0, Math.min(100, store.legitimite + result.impact_legitimite)) });
      }
      if (result.impact_stress) {
        store.setResources({ stress_global: Math.max(0, Math.min(100, store.stress_global + result.impact_stress)) });
      }
      if (activeSlot) {
        setCompleted((prev) => { const next = new Set(prev); next.add(activeSlot.heure); return next; });
        if (activeSlot.agent_id) store.applyOutcome(activeSlot.agent_id, result.score);
      }
    } catch (err) {
      const result = fallbackCorrection(response);
      setCorrection(result);
      store.addXP(result.xp_gagne || 0);
    } finally { setSubmitting(false); }
  }

  function close() {
    setActiveSlot(null);
    setActiveCase(null);
    setResponse("");
    setCorrection(null);
  }

  const gameMinutes = store.game_hour * 60 + store.game_minute;
  const nonPauseSlots = slots.filter((s) => s.type !== "pause");

  return (
    <div className="flex-1 overflow-y-auto px-8 py-10">
      <div className="max-w-3xl mx-auto">
        {/* Header chip + grand titre + actions (style PHDDEC) */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-[11px] font-medium tracking-[0.12em] uppercase text-[#86868B] mb-3">
            <span>☼</span><span>Éphéméride</span><span>·</span><span>Core Briefing</span>
          </div>
          <h2 className="text-[60px] font-semibold text-[#1D1D1F] dark:text-white tracking-[-0.04em] leading-[0.95] mb-3">Aujourd'hui.</h2>
          <p className="text-[14px] text-[#86868B]">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <div className="flex items-center gap-3 mt-5">
            <button className="px-4 py-2 bg-[#1D1D1F] hover:bg-[#3a3a3c] text-white rounded-full text-[13px] font-medium flex items-center gap-2 transition-colors">
              <RefreshCw size={13} /> Régénérer
            </button>
            <button className="px-4 py-2 bg-white border border-[#E5E5EA] hover:bg-[#F5F5F7] text-[#1D1D1F] rounded-full text-[13px] font-medium flex items-center gap-2 transition-colors">
              <Sparkles size={13} /> Envoyer Slack
            </button>
            <div className="ml-auto text-right">
              <div className="text-[11px] text-[#86868B]">Cas pratiques validés</div>
              <div className="text-[22px] font-bold text-[#34C759] tabular-nums">{completed.size}/{nonPauseSlots.length}</div>
            </div>
          </div>
          <p className="text-[10px] text-[#86868B] mt-3 text-right">Généré à {String(store.game_hour).padStart(2, "0")}:{String(store.game_minute).padStart(2, "0")} · Jour {store.game_day}</p>
        </div>

        <div className="bg-gradient-to-br from-[#FF3B30]/8 to-[#FF9500]/8 border border-[#FF3B30]/20 rounded-[18px] p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Flame size={16} className="text-[#FF3B30]" />
            <span className="font-semibold text-[14px] text-[#1D1D1F] dark:text-white">Boss Fight — Clôture bilan 30/06</span>
            <span className="ml-auto text-[13px] font-bold text-[#FF3B30]">J-16</span>
          </div>
          <p className="text-[12px] text-[#86868B]">Signature bilan Vidal Industrie · Provision risque client en suspens</p>
        </div>

        <div className="relative">
          <div className="absolute left-[68px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-[#E5E5EA]/0 via-[#E5E5EA] to-[#E5E5EA]/0" />

          {/* Ligne "Maintenant" qui se déplace avec l'heure jeu */}
          {(() => {
            const startMin = 8 * 60;
            const endMin = 19 * 60;
            const currentMin = store.game_hour * 60 + store.game_minute;
            if (currentMin < startMin || currentMin > endMin) return null;
            const slotsBefore = slots.filter((s) => {
              const sMin = timeToMinutes(s.heure);
              return sMin <= currentMin;
            }).length;
            const offsetPx = slotsBefore * 84 + 30; // approximation hauteur slot
            return (
              <div className="absolute left-[64px] right-0 z-10 pointer-events-none" style={{ top: `${offsetPx}px` }}>
                <div className="relative flex items-center">
                  <div className="w-3 h-3 rounded-full bg-[#007AFF] shadow-[0_0_8px_rgba(0,122,255,0.6)] animate-pulse" />
                  <div className="flex-1 h-[2px] bg-[#007AFF]/40" />
                  <span className="ml-2 text-[10px] font-bold text-[#007AFF] bg-white/80 backdrop-blur px-2 py-0.5 rounded-full shadow-sm border border-[#007AFF]/30">
                    Maintenant · {String(store.game_hour).padStart(2, "0")}:{String(store.game_minute).padStart(2, "0")}
                  </span>
                </div>
              </div>
            );
          })()}

          <div className="space-y-2">
            {slots.map((slot) => {
              const slotMin = timeToMinutes(slot.heure);
              const isPast = gameMinutes > slotMin + slot.duree_min;
              const isActive = gameMinutes >= slotMin && gameMinutes <= slotMin + slot.duree_min;
              const isFuture = gameMinutes < slotMin;
              const isCompleted = completed.has(slot.heure);
              const Icon = getSlotIcon(slot.type);
              const color = getSlotColor(slot.type);
              const isLocked = store.player_level < slot.niveau_requis;
              const canOpen = !isFuture && !isCompleted && slot.type !== "pause" && !isLocked;
              const agent = slot.agent_id ? store.agents.find((a) => a.id === slot.agent_id) : null;

              return (
                <div key={slot.heure} className="flex items-start gap-3 relative">
                  <div className="w-14 text-right pt-3 shrink-0">
                    <div className={`text-[13px] font-mono font-semibold tabular-nums ${isActive ? "text-[#007AFF]" : isFuture ? "text-[#c7c7cc]" : "text-[#1D1D1F] dark:text-white"}`}>
                      {slot.heure}
                    </div>
                    <div className="text-[9px] text-[#86868B]">{slot.duree_min}min</div>
                  </div>

                  <div className="relative shrink-0 pt-3">
                    <div className={`w-4 h-4 rounded-full border-2 transition-all ${isCompleted ? "bg-[#34C759] border-[#34C759]" : isActive ? "border-[#007AFF] bg-white animate-pulse" : isPast ? "bg-[#E5E5EA] border-[#E5E5EA]" : "border-[#c7c7cc] bg-white"}`}>
                      {isCompleted && <CheckCircle size={10} className="text-white -mt-px -ml-px" />}
                    </div>
                  </div>

                  <button onClick={() => canOpen && openSlot(slot)} disabled={!canOpen}
                    className={`flex-1 text-left rounded-[14px] p-3 border transition-all ${isCompleted ? "bg-[#34C759]/5 border-[#34C759]/20" : isActive ? "bg-white border-[#007AFF]/40 shadow-md hover:shadow-lg cursor-pointer" : isFuture ? "bg-white/40 border-[#E5E5EA]/30 dark:border-[#2A2A2E] opacity-60" : isLocked ? "bg-[#F5F5F7] border-[#E5E5EA]/30 dark:border-[#2A2A2E] opacity-50 cursor-not-allowed" : "bg-white border-[#E5E5EA]/40 dark:border-[#2A2A2E] hover:border-[#007AFF]/40 hover:shadow cursor-pointer"}`}>
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15` }}>
                        <Icon size={14} style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="font-semibold text-[13px] text-[#1D1D1F] dark:text-white">{slot.titre}</span>
                          {isCompleted && <span className="text-[9px] font-medium text-[#34C759]">✓ Validé</span>}
                          {isActive && !isCompleted && <span className="text-[9px] font-semibold text-[#007AFF] bg-[#007AFF]/10 px-1.5 py-0.5 rounded-full animate-pulse">EN COURS</span>}
                          {isLocked && <span className="text-[9px] font-medium text-[#86868B] flex items-center gap-0.5"><Lock size={9} /> Niveau {slot.niveau_requis}</span>}
                        </div>
                        <p className="text-[11px] text-[#86868B] truncate">{slot.theme}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {agent && (
                            <span className="flex items-center gap-1 text-[10px] text-[#86868B]">
                              <div className="w-3 h-3 rounded-full text-white text-[7px] flex items-center justify-center font-semibold" style={{ backgroundColor: agent.avatar_color }}>{agent.initiales[0]}</div>
                              {agent.nom}
                            </span>
                          )}
                          {slot.xp_max > 0 && <span className="text-[9px] font-medium text-[#FF9500] flex items-center gap-0.5"><Trophy size={9} /> +{slot.xp_max} XP</span>}
                          <span className="text-[9px] text-[#86868B] ml-auto capitalize">{slot.type.replace("_", " ")}</span>
                        </div>
                      </div>
                      {canOpen && !isCompleted && <ChevronRight size={14} className="text-[#c7c7cc] mt-2" />}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal cas pratique */}
      {activeSlot && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#E5E5EA]/40 dark:border-[#2A2A2E] flex items-center justify-between bg-gradient-to-r from-[#007AFF]/5 to-[#5856D6]/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#007AFF] to-[#0040DD] flex items-center justify-center shadow-md">
                  <GraduationCap size={18} className="text-white" />
                </div>
                <div>
                  <div className="font-semibold text-[15px] text-[#1D1D1F] dark:text-white">{activeSlot.titre}</div>
                  <div className="text-[11px] text-[#86868B]">{activeSlot.heure} · {activeSlot.duree_min}min · +{activeSlot.xp_max} XP max</div>
                </div>
              </div>
              <button onClick={close} className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] flex items-center justify-center">
                <X size={14} className="text-[#86868B]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {caseLoading && (
                <div className="text-center py-12">
                  <RefreshCw size={28} className="text-[#007AFF] animate-spin mx-auto mb-3" />
                  <p className="text-[13px] text-[#86868B]">Génération du cas pratique…</p>
                </div>
              )}

              {activeCase && !correction && (
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] font-semibold text-[#007AFF] uppercase tracking-wider mb-1">Client</div>
                    <div className="text-[15px] font-bold text-[#1D1D1F] dark:text-white">{activeCase.client}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-1">Contexte</div>
                    <p className="text-[13px] text-[#1D1D1F] leading-relaxed">{activeCase.contexte}</p>
                  </div>
                  <div className="bg-[#F5F5F7] rounded-[12px] p-4">
                    <div className="text-[10px] font-semibold text-[#1D1D1F] uppercase tracking-wider mb-2">Énoncé</div>
                    <p className="text-[13px] text-[#1D1D1F] leading-relaxed whitespace-pre-wrap">{activeCase.enonce}</p>
                  </div>
                  <div className="bg-[#007AFF]/5 border border-[#007AFF]/20 rounded-[12px] p-4">
                    <div className="text-[10px] font-semibold text-[#007AFF] uppercase tracking-wider mb-1">Question</div>
                    <p className="text-[14px] font-medium text-[#1D1D1F] leading-relaxed">{activeCase.question}</p>
                  </div>
                  <div>
                    <textarea
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                      placeholder="Ta réponse… (sois précis, cite les références techniques)"
                      rows={6}
                      className="w-full text-[13px] p-3 border border-[#E5E5EA] rounded-[12px] outline-none focus:border-[#007AFF] resize-none leading-relaxed"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-[#86868B]">Critères : {activeCase.criteres.join(" · ")}</span>
                      <button onClick={submit} disabled={!response.trim() || submitting}
                        className={`px-4 py-2 rounded-[10px] text-[13px] font-medium transition-all ${response.trim() && !submitting ? "bg-gradient-to-br from-[#007AFF] to-[#0040DD] text-white shadow-md" : "bg-[#E5E5EA] text-[#86868B] cursor-not-allowed"}`}>
                        {submitting ? "Correction…" : "Soumettre"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {correction && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="inline-flex flex-col items-center bg-gradient-to-br from-[#007AFF]/5 to-[#34C759]/5 rounded-[16px] p-5">
                      <div className="text-[56px] font-bold tabular-nums leading-none" style={{ color: correction.score >= 75 ? "#34C759" : correction.score >= 50 ? "#FF9500" : "#FF3B30" }}>
                        {correction.score}
                      </div>
                      <div className="text-[13px] font-medium text-[#1D1D1F] mt-1">{correction.verdict}</div>
                      <div className="text-[11px] text-[#007AFF] mt-1 flex items-center gap-1">
                        <Sparkles size={11} /> +{correction.xp_gagne} XP
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#F5F5F7] dark:bg-[#1F1F22] rounded-[12px] p-3 flex gap-2 items-start">
                    <Zap size={14} className="text-[#007AFF] mt-0.5 shrink-0" />
                    <p className="text-[13px] text-[#1D1D1F] italic leading-relaxed">{correction.analogie}</p>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-[#007AFF] uppercase tracking-wider mb-2">Correction</div>
                    <p className="text-[13px] text-[#1D1D1F] leading-relaxed">{correction.correction}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-semibold text-[#34C759] uppercase tracking-wider mb-1.5">Points forts</div>
                      {correction.points_forts.map((p, i) => (
                        <p key={i} className="text-[12px] text-[#1D1D1F] flex gap-1.5 items-start mb-1"><span className="text-[#34C759] font-bold mt-0.5">✓</span>{p}</p>
                      ))}
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-[#007AFF] uppercase tracking-wider mb-1.5">À améliorer</div>
                      {correction.axes_amelioration.map((p, i) => (
                        <p key={i} className="text-[12px] text-[#1D1D1F] flex gap-1.5 items-start mb-1"><span className="text-[#007AFF] font-bold mt-0.5">→</span>{p}</p>
                      ))}
                    </div>
                  </div>
                  <button onClick={close} className="w-full py-2.5 rounded-[10px] bg-gradient-to-br from-[#007AFF] to-[#0040DD] text-white font-medium text-[13px] shadow-md">
                    Terminer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
