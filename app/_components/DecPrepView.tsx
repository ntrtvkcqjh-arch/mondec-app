"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/supabase-store";
import { apiFetch } from "@/lib/api-client";
import { Trophy, Sparkles, Flame, Award, FileSearch, RefreshCw, ChevronRight, Lock, CheckCircle, X, Clock as ClockIcon } from "lucide-react";

// IMPORTS STATIQUES — garantit que les pools sont disponibles dès le 1er render
import deontologieData from "@/lib/data/deontologie_pool.json";
import missionsData from "@/lib/data/missions_pool.json";

interface DeontoQuestion {
  id: string; categorie: "EC" | "CAC"; theme: string; type: string; question: string;
  options?: string[]; correct?: number[]; correct_mots_cles?: string[]; explication: string;
}
interface MissionEtape {
  numero: number; label: string; points_max: number; consigne: string; mots_cles_attendus: string[];
}
interface Mission {
  id: string; theme: string; difficulte: number; titre: string; client: string; contexte: string;
  etapes: MissionEtape[];
}

export function DecPrepView() {
  const store = useGameStore();
  const deontoPool: DeontoQuestion[] = (deontologieData as any).questions || [];
  const missionsPool: Mission[] = (missionsData as any).missions || [];

  const [activeDeonto, setActiveDeonto] = useState<DeontoQuestion[] | null>(null);
  const [deontoReponses, setDeontoReponses] = useState<Record<string, { selected?: number[]; texte?: string }>>({});
  const [deontoIndex, setDeontoIndex] = useState(0);
  const [deontoSubmitting, setDeontoSubmitting] = useState(false);
  const [deontoResult, setDeontoResult] = useState<any>(null);

  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [missionReponses, setMissionReponses] = useState<Record<number, string>>({});
  const [missionEtape, setMissionEtape] = useState(0);
  const [missionSubmitting, setMissionSubmitting] = useState(false);
  const [missionResult, setMissionResult] = useState<any>(null);

  useEffect(() => { store.checkDecRollover(); }, [store.game_day]);

  function startDeonto() {
    if (deontoPool.length === 0) { alert("Questions en cours de chargement…"); return; }
    const recent = new Set(store.dec_completed_deonto_ids.slice(-40));
    const ec = deontoPool.filter((q) => q.categorie === "EC" && !recent.has(q.id));
    const cac = deontoPool.filter((q) => q.categorie === "CAC" && !recent.has(q.id));
    const ecFb = deontoPool.filter((q) => q.categorie === "EC");
    const cacFb = deontoPool.filter((q) => q.categorie === "CAC");
    function pick(p: DeontoQuestion[], fb: DeontoQuestion[], n: number) {
      const arr = (p.length >= n ? p : fb).slice().sort(() => Math.random() - 0.5);
      return arr.slice(0, n);
    }
    const sel = [...pick(ec, ecFb, 10), ...pick(cac, cacFb, 10)].sort(() => Math.random() - 0.5);
    setActiveDeonto(sel);
    setDeontoReponses({});
    setDeontoIndex(0);
    setDeontoResult(null);
  }

  function toggleDeontoOpt(qid: string, idx: number, multiple: boolean) {
    setDeontoReponses((prev) => {
      const cur = prev[qid]?.selected || [];
      const next = multiple ? (cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx]) : [idx];
      return { ...prev, [qid]: { ...prev[qid], selected: next } };
    });
  }

  function setDeontoText(qid: string, txt: string) {
    setDeontoReponses((prev) => ({ ...prev, [qid]: { ...prev[qid], texte: txt } }));
  }

  async function submitDeonto() {
    if (!activeDeonto || deontoSubmitting) return;
    setDeontoSubmitting(true);
    try {
      const reponses = activeDeonto.map((q) => ({
        question_id: q.id, selected: deontoReponses[q.id]?.selected, texte: deontoReponses[q.id]?.texte,
      }));
      const res = await apiFetch("/api/deontologie-eval", {
        method: "POST", body: JSON.stringify({ questions: activeDeonto, reponses }),
      });
      const data = await res.json();
      if (data.score_20 !== undefined) {
        setDeontoResult(data);
        store.addXP(data.xp_gagne || 0);
        if (data.impact_legitimite) {
          store.setResources({ legitimite: Math.max(0, Math.min(100, store.legitimite + data.impact_legitimite)) });
        }
        if (data.badge) store.addBadge(data.badge);
        store.markDeontoCompleted(activeDeonto.map((q) => q.id));
      } else alert("Erreur évaluation.");
    } catch { alert("Erreur réseau."); }
    finally { setDeontoSubmitting(false); }
  }

  function startMission(m: Mission) {
    setActiveMission(m);
    setMissionReponses({});
    setMissionEtape(0);
    setMissionResult(null);
  }

  async function submitMission() {
    if (!activeMission || missionSubmitting) return;
    setMissionSubmitting(true);
    try {
      const reponses = activeMission.etapes.map((e) => ({ numero: e.numero, texte: missionReponses[e.numero] || "" }));
      const res = await apiFetch("/api/mission-eval", {
        method: "POST", body: JSON.stringify({ mission: activeMission, reponses }),
      });
      const data = await res.json();
      if (data.score_pct !== undefined) {
        setMissionResult(data);
        store.addXP(data.xp_gagne || 0);
        if (data.impact_legitimite) {
          store.setResources({ legitimite: Math.max(0, Math.min(100, store.legitimite + data.impact_legitimite)) });
        }
        store.markMissionCompleted(activeMission.id);
      } else alert("Erreur évaluation.");
    } catch { alert("Erreur réseau."); }
    finally { setMissionSubmitting(false); }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="text-[32px] font-semibold text-[#1D1D1F] tracking-[-0.022em] leading-tight">DEC Prep</h2>
            <p className="text-[13px] text-[#86868B] mt-1">Niveau {store.player_level}/10 · {store.player_xp} XP · {store.dec_badges.length} badge{store.dec_badges.length > 1 ? "s" : ""}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <Flame size={14} className="text-[#FF9500]" />
              <span className="text-[22px] font-bold text-[#FF9500] tabular-nums">{store.dec_streak}</span>
            </div>
            <div className="text-[10px] text-[#86868B]">jours consécutifs</div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-[#007AFF]/8 to-[#5856D6]/8 border border-[#007AFF]/15 rounded-[16px] p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <ClockIcon size={14} className="text-[#007AFF]" />
            <span className="font-semibold text-[13px] text-[#1D1D1F]">Aujourd'hui · Jour {store.game_day}</span>
            <span className="ml-auto text-[11px] text-[#86868B]">{(store.dec_today_deonto ? 1 : 0) + (store.dec_today_mission ? 1 : 0)}/2 modules</span>
          </div>
          <p className="text-[12px] text-[#3a3a3c] leading-relaxed">
            Objectif : <strong>1 Déontologie + 1 Révision</strong> par jour. Pas de chrono — à ton rythme. Streak +1 par jour où tu valides au moins l'un des deux.
          </p>
        </div>

        {/* Module Déontologie */}
        <div className={`bg-white rounded-[18px] border-2 transition-all mb-3 ${store.dec_today_deonto ? "border-[#34C759]/40 bg-[#34C759]/5" : "border-[#E5E5EA]/40 hover:border-[#007AFF]/30 hover:shadow-md"}`}>
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0 bg-gradient-to-br from-[#007AFF] to-[#5856D6] shadow-md">
                <Award size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-[15px] text-[#1D1D1F]">Épreuve 1 — Déontologie</h3>
                  {store.dec_today_deonto && <span className="text-[9px] font-semibold text-[#34C759] bg-[#34C759]/10 px-1.5 py-0.5 rounded-full">✓ FAIT</span>}
                </div>
                <p className="text-[12px] text-[#86868B] leading-relaxed">
                  <strong>QCM 20 questions</strong> · 10 EC + 10 CAC · Exercice profession, éthique, contrôle qualité, responsabilité.
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[10px] text-[#007AFF] bg-[#007AFF]/10 px-1.5 py-0.5 rounded-md font-medium">+8 Lég si 18/20</span>
                  <span className="text-[10px] text-[#86868B] ml-auto">{deontoPool.length} questions au catalogue</span>
                </div>
              </div>
            </div>
            <button onClick={startDeonto} disabled={deontoPool.length === 0}
              className={`mt-3 w-full py-2.5 rounded-[12px] text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 ${deontoPool.length === 0 ? "bg-[#E5E5EA] text-[#86868B] cursor-not-allowed" : store.dec_today_deonto ? "bg-[#34C759]/15 text-[#34C759] hover:bg-[#34C759]/20" : "bg-gradient-to-br from-[#007AFF] to-[#0040DD] text-white shadow-md hover:shadow-lg"}`}>
              {store.dec_today_deonto ? <><RefreshCw size={13} /> Refaire (entraînement)</> : <><Sparkles size={13} /> Commencer le QCM du jour</>}
            </button>
          </div>
        </div>

        {/* Module Mission */}
        <div className={`bg-white rounded-[18px] border-2 transition-all mb-3 ${store.dec_today_mission ? "border-[#34C759]/40 bg-[#34C759]/5" : "border-[#E5E5EA]/40"}`}>
          <div className="p-4">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0 bg-gradient-to-br from-[#AF52DE] to-[#5856D6] shadow-md">
                <FileSearch size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-[15px] text-[#1D1D1F]">Épreuve 2 — Révision (Mission)</h3>
                  {store.dec_today_mission && <span className="text-[9px] font-semibold text-[#34C759] bg-[#34C759]/10 px-1.5 py-0.5 rounded-full">✓ FAIT</span>}
                </div>
                <p className="text-[12px] text-[#86868B] leading-relaxed">
                  <strong>Cas pratique 5 étapes</strong> : Acceptation · Planification · Contrôle interne · Procédures · Conclusion.
                </p>
              </div>
            </div>
            <div className="space-y-1.5 mt-3">
              {missionsPool.map((m) => {
                const done = store.dec_completed_mission_ids.includes(m.id);
                const locked = m.difficulte > Math.max(2, Math.floor(store.player_level / 2) + 2);
                return (
                  <button key={m.id} onClick={() => !locked && startMission(m)} disabled={locked}
                    className={`w-full text-left rounded-[10px] p-2.5 border transition-all flex items-center gap-2.5 ${done ? "bg-[#34C759]/5 border-[#34C759]/20" : locked ? "bg-[#F5F5F7] border-[#E5E5EA]/30 opacity-50 cursor-not-allowed" : "bg-white border-[#E5E5EA]/40 hover:border-[#AF52DE]/40 hover:shadow-sm"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[12px] font-medium text-[#1D1D1F] truncate">{m.titre}</span>
                        {done && <span className="text-[9px] text-[#34C759]">✓</span>}
                        {locked && <Lock size={9} className="text-[#86868B]" />}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#86868B]">
                        <span>{m.theme}</span><span>·</span><span>{"⭐".repeat(m.difficulte)}</span>
                      </div>
                    </div>
                    {!locked && !done && <ChevronRight size={12} className="text-[#c7c7cc]" />}
                  </button>
                );
              })}
              {missionsPool.length === 0 && <p className="text-[11px] text-[#86868B] text-center py-4">Chargement…</p>}
            </div>
          </div>
        </div>

        {store.dec_badges.length > 0 && (
          <div className="bg-white rounded-[14px] p-3 border border-[#E5E5EA]/40">
            <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">🏆 Badges</div>
            <div className="flex flex-wrap gap-1.5">
              {store.dec_badges.map((b) => (
                <span key={b} className="text-[11px] font-medium text-[#FF9500] bg-gradient-to-br from-[#FF9500]/15 to-[#FF3B30]/15 px-2.5 py-1 rounded-full">{b}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal Déontologie */}
      {activeDeonto && (
        <DeontoModal questions={activeDeonto} reponses={deontoReponses} index={deontoIndex} setIndex={setDeontoIndex}
          toggle={toggleDeontoOpt} setText={setDeontoText} result={deontoResult} submitting={deontoSubmitting}
          onSubmit={submitDeonto} onClose={() => { setActiveDeonto(null); setDeontoResult(null); setDeontoIndex(0); }} />
      )}

      {/* Modal Mission */}
      {activeMission && (
        <MissionModal mission={activeMission} reponses={missionReponses} setReponses={setMissionReponses}
          etape={missionEtape} setEtape={setMissionEtape} result={missionResult} submitting={missionSubmitting}
          onSubmit={submitMission} onClose={() => { setActiveMission(null); setMissionResult(null); setMissionEtape(0); }} />
      )}
    </div>
  );
}

function DeontoModal({ questions, reponses, index, setIndex, toggle, setText, result, submitting, onSubmit, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-[#E5E5EA]/40 flex items-center justify-between bg-gradient-to-r from-[#007AFF]/5 to-[#5856D6]/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#007AFF] to-[#0040DD] flex items-center justify-center shadow-md">
              <Award size={18} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-[15px] text-[#1D1D1F]">Déontologie — QCM du jour</div>
              <div className="text-[11px] text-[#86868B]">{result ? "Résultat" : `Question ${index + 1} / ${questions.length}`}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] flex items-center justify-center"><X size={14} className="text-[#86868B]" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!result && (() => {
            const q = questions[index];
            if (!q) return null;
            const rep = reponses[q.id];
            const isMulti = q.type === "qcm_multiple";
            return (
              <div className="space-y-4">
                <div className="h-[3px] bg-[#E5E5EA] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#007AFF] to-[#5856D6] transition-all" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#007AFF]/10 text-[#007AFF]">{q.categorie}</span>
                  <span className="text-[10px] font-medium text-[#86868B]">{q.theme}</span>
                  <span className="text-[10px] text-[#86868B] ml-auto">{q.type === "qcm_simple" ? "QCM" : q.type === "qcm_multiple" ? "QCM multiple" : q.type === "vrai_faux" ? "Vrai/Faux" : "Réponse courte"}</span>
                </div>
                <p className="text-[14px] text-[#1D1D1F] leading-relaxed font-medium">{q.question}</p>

                {q.type === "qrc" ? (
                  <textarea value={rep?.texte || ""} onChange={(e) => setText(q.id, e.target.value)} rows={4}
                    placeholder="Ta réponse (cite les références, articles, normes…)"
                    className="w-full text-[13px] p-3 border border-[#E5E5EA] rounded-[12px] outline-none focus:border-[#007AFF] resize-none leading-relaxed" />
                ) : (
                  <div className="space-y-1.5">
                    {(q.options || []).map((opt: string, i: number) => {
                      const selected = (rep?.selected || []).includes(i);
                      return (
                        <button key={i} onClick={() => toggle(q.id, i, isMulti)}
                          className={`w-full text-left px-3 py-2.5 rounded-[10px] border-2 transition-all flex items-start gap-2.5 ${selected ? "border-[#007AFF] bg-[#007AFF]/5" : "border-[#E5E5EA]/60 hover:border-[#007AFF]/40 hover:bg-[#F5F5F7]"}`}>
                          <div className={`w-5 h-5 ${isMulti ? "rounded-[4px]" : "rounded-full"} border-2 flex items-center justify-center shrink-0 mt-0.5 ${selected ? "border-[#007AFF] bg-[#007AFF]" : "border-[#c7c7cc]"}`}>
                            {selected && <CheckCircle size={10} className="text-white" />}
                          </div>
                          <span className="text-[13px] text-[#1D1D1F]">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {isMulti && <p className="text-[10px] text-[#86868B] italic">Plusieurs réponses possibles</p>}
              </div>
            );
          })()}

          {result && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="inline-flex flex-col items-center bg-gradient-to-br from-[#007AFF]/5 to-[#34C759]/5 rounded-[16px] p-5">
                  <div className="text-[56px] font-bold tabular-nums leading-none" style={{ color: result.score_20 >= 14 ? "#34C759" : result.score_20 >= 10 ? "#FF9500" : "#FF3B30" }}>
                    {result.score_20}<span className="text-[24px] text-[#86868B]">/20</span>
                  </div>
                  <div className="text-[12px] text-[#86868B] mt-1">{result.pct}% de réussite</div>
                  {result.badge && <div className="mt-2 text-[12px] font-bold text-[#FF9500] bg-gradient-to-br from-[#FF9500]/15 to-[#FF3B30]/15 px-3 py-1 rounded-full">🏆 {result.badge}</div>}
                  <div className="flex items-center gap-3 text-[11px] mt-2">
                    <span className="text-[#34C759]">+{result.xp_gagne} XP</span>
                    <span className={result.impact_legitimite > 0 ? "text-[#34C759]" : result.impact_legitimite < 0 ? "text-[#FF3B30]" : "text-[#86868B]"}>
                      {result.impact_legitimite > 0 ? "+" : ""}{result.impact_legitimite} Légitimité
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-[#F5F5F7] rounded-[12px] p-3">
                <p className="text-[12px] text-[#1D1D1F] italic leading-relaxed">"{result.synthese}"</p>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">Détail</div>
                <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                  {result.detail.map((d: any, i: number) => (
                    <details key={d.question_id} className={`rounded-[10px] border p-2.5 ${d.is_correct ? "border-[#34C759]/30 bg-[#34C759]/5" : "border-[#FF3B30]/30 bg-[#FF3B30]/5"}`}>
                      <summary className="cursor-pointer flex items-center gap-2 text-[11px] font-medium">
                        <span className={d.is_correct ? "text-[#34C759]" : "text-[#FF3B30]"}>{d.is_correct ? "✓" : "✗"} Q{i + 1}</span>
                        <span className="text-[#3a3a3c] truncate flex-1">{d.question}</span>
                        <span className="text-[10px] text-[#86868B]">{d.points_obtenus.toFixed(1)}/{d.points_max}</span>
                      </summary>
                      <div className="mt-2 space-y-1">
                        <p className="text-[11px] text-[#86868B]">{d.feedback}</p>
                        <p className="text-[10px] text-[#3a3a3c] italic bg-white/70 rounded p-1.5">{d.explication}</p>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
              <button onClick={onClose} className="w-full py-2.5 rounded-[10px] bg-gradient-to-br from-[#007AFF] to-[#0040DD] text-white font-medium text-[13px] shadow-md">Terminer</button>
            </div>
          )}
        </div>

        {!result && (
          <div className="px-5 py-3 bg-[#fafafa] border-t border-[#E5E5EA]/40 flex items-center gap-2">
            <button onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}
              className="px-3 py-1.5 text-[12px] rounded-[8px] bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E5E5EA] disabled:opacity-40 disabled:cursor-not-allowed">← Précédent</button>
            <span className="text-[11px] text-[#86868B] mx-auto tabular-nums">{Object.keys(reponses).length}/{questions.length} répondues</span>
            {index < questions.length - 1 ? (
              <button onClick={() => setIndex(index + 1)} className="px-3 py-1.5 text-[12px] rounded-[8px] bg-[#007AFF] text-white">Suivant →</button>
            ) : (
              <button onClick={onSubmit} disabled={submitting}
                className="px-4 py-1.5 text-[12px] font-semibold rounded-[8px] bg-gradient-to-br from-[#34C759] to-[#007AFF] text-white shadow-md flex items-center gap-1.5">
                {submitting ? <><RefreshCw size={11} className="animate-spin" /> Correction…</> : <><CheckCircle size={11} /> Valider</>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MissionModal({ mission, reponses, setReponses, etape, setEtape, result, submitting, onSubmit, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-[#E5E5EA]/40 flex items-center justify-between bg-gradient-to-r from-[#AF52DE]/5 to-[#5856D6]/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#AF52DE] to-[#5856D6] flex items-center justify-center shadow-md">
              <FileSearch size={18} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-[15px] text-[#1D1D1F]">{mission.titre}</div>
              <div className="text-[11px] text-[#86868B]">{result ? "Résultat" : `${mission.client} · Étape ${etape + 1} / ${mission.etapes.length}`}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] flex items-center justify-center"><X size={14} className="text-[#86868B]" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!result && (() => {
            const e = mission.etapes[etape];
            if (!e) return null;
            return (
              <div className="space-y-4">
                {etape === 0 && (
                  <div className="bg-[#F5F5F7] rounded-[12px] p-3">
                    <div className="text-[10px] font-semibold text-[#AF52DE] uppercase tracking-wider mb-1">Contexte</div>
                    <p className="text-[12px] text-[#1D1D1F] leading-relaxed">{mission.contexte}</p>
                  </div>
                )}
                <div className="h-[3px] bg-[#E5E5EA] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#AF52DE] to-[#5856D6] transition-all" style={{ width: `${((etape + 1) / mission.etapes.length) * 100}%` }} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-md bg-gradient-to-r from-[#AF52DE] to-[#5856D6]">ÉTAPE {e.numero}</span>
                  <span className="text-[13px] font-semibold text-[#1D1D1F]">{e.label}</span>
                  <span className="text-[10px] text-[#86868B] ml-auto">/{e.points_max} points</span>
                </div>
                <div className="bg-[#AF52DE]/5 border border-[#AF52DE]/20 rounded-[10px] p-3">
                  <p className="text-[13px] text-[#1D1D1F] leading-relaxed">{e.consigne}</p>
                </div>
                <textarea value={reponses[e.numero] || ""} onChange={(ev) => setReponses({ ...reponses, [e.numero]: ev.target.value })}
                  rows={8} placeholder="Ta réponse — style EC (cite NEP, articles, normes…)"
                  className="w-full text-[13px] p-3 border border-[#E5E5EA] rounded-[12px] outline-none focus:border-[#AF52DE] resize-none leading-relaxed" />
                <div className="text-[10px] text-[#86868B] bg-[#F5F5F7] rounded p-2">
                  💡 <strong>Méthode DEC</strong> : « je constate », « je recommande à la direction », « il apparaît que ». Évite « je pense », « c'est mal ».
                </div>
              </div>
            );
          })()}

          {result && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="inline-flex flex-col items-center bg-gradient-to-br from-[#AF52DE]/5 to-[#34C759]/5 rounded-[16px] p-5">
                  <div className="text-[56px] font-bold tabular-nums leading-none" style={{ color: result.score_pct >= 75 ? "#34C759" : result.score_pct >= 50 ? "#FF9500" : "#FF3B30" }}>
                    {result.score_20}<span className="text-[24px] text-[#86868B]">/20</span>
                  </div>
                  <div className="text-[12px] text-[#86868B] mt-1">{result.score_pct}% · {result.total.toFixed(1)}/{result.total_max}</div>
                  <div className="flex items-center gap-3 text-[11px] mt-2">
                    <span className="text-[#34C759]">+{result.xp_gagne} XP</span>
                    <span className={result.impact_legitimite > 0 ? "text-[#34C759]" : result.impact_legitimite < 0 ? "text-[#FF3B30]" : "text-[#86868B]"}>
                      {result.impact_legitimite > 0 ? "+" : ""}{result.impact_legitimite} Légitimité
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-[#F5F5F7] rounded-[12px] p-3">
                <p className="text-[12px] text-[#1D1D1F] italic leading-relaxed">"{result.synthese}"</p>
              </div>
              <div className="space-y-2">
                {result.detail.map((d: any) => (
                  <div key={d.numero} className={`rounded-[12px] border p-3 ${d.points_obtenus >= d.points_max * 0.7 ? "border-[#34C759]/30 bg-[#34C759]/5" : d.points_obtenus >= d.points_max * 0.4 ? "border-[#FF9500]/30 bg-[#FF9500]/5" : "border-[#FF3B30]/30 bg-[#FF3B30]/5"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold text-white px-1.5 py-0.5 rounded bg-gradient-to-r from-[#AF52DE] to-[#5856D6]">É{d.numero}</span>
                      <span className="text-[12px] font-semibold text-[#1D1D1F]">{d.label}</span>
                      <span className="text-[11px] font-mono tabular-nums ml-auto">{d.points_obtenus.toFixed(1)} / {d.points_max} pts</span>
                    </div>
                    <p className="text-[11px] text-[#3a3a3c] leading-relaxed">{d.feedback}</p>
                    {d.correction_style && (
                      <div className="mt-1.5 bg-white/80 rounded-md p-2 border border-[#007AFF]/20">
                        <p className="text-[9px] font-semibold text-[#007AFF] uppercase tracking-wider mb-0.5">Correction style EC</p>
                        <p className="text-[11px] text-[#3a3a3c]">{d.correction_style}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={onClose} className="w-full py-2.5 rounded-[10px] bg-gradient-to-br from-[#AF52DE] to-[#0040DD] text-white font-medium text-[13px] shadow-md">Terminer</button>
            </div>
          )}
        </div>

        {!result && (
          <div className="px-5 py-3 bg-[#fafafa] border-t border-[#E5E5EA]/40 flex items-center gap-2">
            <button onClick={() => setEtape(Math.max(0, etape - 1))} disabled={etape === 0}
              className="px-3 py-1.5 text-[12px] rounded-[8px] bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E5E5EA] disabled:opacity-40">← Précédent</button>
            <span className="text-[11px] text-[#86868B] mx-auto tabular-nums">Étape {etape + 1}/{mission.etapes.length}</span>
            {etape < mission.etapes.length - 1 ? (
              <button onClick={() => setEtape(etape + 1)} className="px-3 py-1.5 text-[12px] rounded-[8px] bg-[#AF52DE] text-white">Suivant →</button>
            ) : (
              <button onClick={onSubmit} disabled={submitting}
                className="px-4 py-1.5 text-[12px] font-semibold rounded-[8px] bg-gradient-to-br from-[#AF52DE] to-[#0040DD] text-white shadow-md flex items-center gap-1.5">
                {submitting ? <><RefreshCw size={11} className="animate-spin" /> Évaluation…</> : <><CheckCircle size={11} /> Soumettre</>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
