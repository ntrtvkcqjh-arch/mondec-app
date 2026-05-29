"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/supabase-store";
import { apiFetch } from "@/lib/api-client";
import { ClipboardCheck, X, CheckCircle, CornerDownRight, Calculator, RefreshCw, Lock, FileSearch, Sparkles } from "lucide-react";

import tasksData from "@/lib/data/tasks_pool.json";

interface TaskLine { label: string; valeur: string; }
interface TaskErreur { ligne_index: number; description: string; reference_legale: string; correction: string; }
interface TaskDoc {
  id: string; type: string; branche: string; titre: string; client: string; niveau_min: number;
  contexte: string; lignes: TaskLine[]; erreurs: TaskErreur[];
  ecriture_correction: { debit_compte: string; credit_compte: string; montant: number; libelle: string } | null;
}
interface TaskResult {
  score: number;
  erreurs_trouvees: TaskErreur[];
  erreurs_manquees: TaskErreur[];
  fausses_alertes: number[];
  note_score: number;
  note_score_claude: number | null;
  analyse_note: string | null;
  ecriture_eval: { ok: boolean; feedback: string } | null;
  feedback_general: string;
  impact_legitimite: number;
  xp_gagne: number;
}

export function TasksView() {
  const store = useGameStore();
  const pool: TaskDoc[] = (tasksData as any).tasks || [];
  const [active, setActive] = useState<TaskDoc | null>(null);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TaskResult | null>(null);
  const [showEcriture, setShowEcriture] = useState(false);
  const [eDebit, setEDebit] = useState("");
  const [eCredit, setECredit] = useState("");
  const [eMontant, setEMontant] = useState("");
  const [eLibelle, setELibelle] = useState("");

  function open(task: TaskDoc) {
    if (store.player_level < task.niveau_min) {
      alert(`Niveau ${task.niveau_min} requis (tu es niveau ${store.player_level})`);
      return;
    }
    setActive(task);
    setFlagged(new Set());
    setNote("");
    setResult(null);
    setEDebit(""); setECredit(""); setEMontant(""); setELibelle("");
  }

  function toggleLine(idx: number) {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function submit(decision: "valider" | "refuser" | "deleguer") {
    if (!active || submitting) return;
    if (decision === "refuser" && active.ecriture_correction && !eDebit) {
      setShowEcriture(true);
      return;
    }
    setSubmitting(true);
    try {
      const ecriture = decision === "refuser" && active.ecriture_correction ? {
        debit_compte: eDebit, credit_compte: eCredit,
        montant: Number(eMontant) || 0, libelle: eLibelle,
      } : null;

      const res = await apiFetch("/api/task-eval", {
        method: "POST",
        body: JSON.stringify({
          task: active, decision,
          lignes_signalees: Array.from(flagged),
          note_correction: note,
          ecriture_proposee: ecriture,
        }),
      });
      const data = await res.json();
      if (data.score !== undefined) {
        setResult(data);
        store.addXP(data.xp_gagne || 0);
        if (data.impact_legitimite) {
          store.setResources({ legitimite: Math.max(0, Math.min(100, store.legitimite + data.impact_legitimite)) });
        }
        store.markTaskCompleted(active.id);
      } else alert("Erreur évaluation.");
    } catch { alert("Erreur réseau."); }
    finally { setSubmitting(false); setShowEcriture(false); }
  }

  function close() {
    setActive(null);
    setResult(null);
    setShowEcriture(false);
  }

  const completedTasks = new Set(store.completed_tasks);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="text-[32px] font-semibold text-[#1D1D1F] tracking-[-0.022em] leading-tight">Tâches — Validation pédagogique</h2>
            <p className="text-[13px] text-[#86868B] mt-1">Documents préparés par l'équipe à contrôler. Détecte les erreurs DEC.</p>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-[#86868B]">Validés / Total</div>
            <div className="text-[22px] font-bold text-[#34C759] tabular-nums">{completedTasks.size}/{pool.length}</div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-[#007AFF]/8 to-[#5856D6]/8 border border-[#007AFF]/15 rounded-[14px] p-3 mb-4">
          <div className="flex items-start gap-2">
            <FileSearch size={14} className="text-[#007AFF] mt-0.5 shrink-0" />
            <p className="text-[12px] text-[#1D1D1F] leading-relaxed">
              <strong>Examinateur DEC :</strong> identifie les erreurs cachées, ajoute une note de correction (cite les articles), puis Valider / Refuser / Déléguer.
              <span className="text-[#007AFF] font-medium ml-1">+20 par erreur trouvée · −30 par manquée · +10 Légitimité si &gt;80%.</span>
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {pool.map((task) => {
            const isLocked = store.player_level < task.niveau_min;
            const isDone = completedTasks.has(task.id);
            const branchColor = task.branche === "Comptable" ? "#007AFF" : task.branche === "Fiscal" ? "#FF9500" : task.branche === "Audit & IFRS" ? "#AF52DE" : task.branche === "Social" ? "#34C759" : "#86868B";
            return (
              <button key={task.id} onClick={() => !isLocked && !isDone && open(task)} disabled={isLocked || isDone}
                className={`w-full text-left rounded-[14px] p-4 border transition-all flex items-center gap-3 ${isDone ? "bg-[#34C759]/5 border-[#34C759]/20 cursor-default" : isLocked ? "bg-[#F5F5F7] border-[#E5E5EA]/30 opacity-50 cursor-not-allowed" : "bg-white border-[#E5E5EA]/40 hover:border-[#007AFF]/40 hover:shadow cursor-pointer"}`}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${branchColor}15` }}>
                  <ClipboardCheck size={18} style={{ color: branchColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-semibold text-[14px] text-[#1D1D1F]">{task.titre}</span>
                    {isDone && <span className="text-[9px] font-semibold text-[#34C759] bg-[#34C759]/10 px-1.5 py-0.5 rounded-full">VALIDÉ</span>}
                    {isLocked && <span className="text-[9px] font-medium text-[#86868B] flex items-center gap-0.5"><Lock size={9} /> Niveau {task.niveau_min}</span>}
                  </div>
                  <p className="text-[11px] text-[#86868B] truncate mb-1">{task.client} · {task.contexte}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md" style={{ backgroundColor: `${branchColor}15`, color: branchColor }}>{task.branche}</span>
                    <span className="text-[9px] text-[#86868B]">{task.erreurs.length} erreur{task.erreurs.length > 1 ? "s" : ""}</span>
                    {task.ecriture_correction && <span className="text-[9px] text-[#007AFF] flex items-center gap-0.5"><Calculator size={9} /> Mini-jeu écriture</span>}
                  </div>
                </div>
              </button>
            );
          })}
          {pool.length === 0 && (
            <div className="text-center py-12 text-[#86868B]">
              <ClipboardCheck size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-[13px]">Chargement des documents…</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal task */}
      {active && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#E5E5EA]/40 flex items-center justify-between bg-gradient-to-r from-[#007AFF]/5 to-[#5856D6]/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#007AFF] to-[#0040DD] flex items-center justify-center shadow-md">
                  <ClipboardCheck size={18} className="text-white" />
                </div>
                <div>
                  <div className="font-semibold text-[15px] text-[#1D1D1F]">{active.titre}</div>
                  <div className="text-[11px] text-[#86868B]">{active.client} · Branche {active.branche}</div>
                </div>
              </div>
              <button onClick={close} className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] flex items-center justify-center">
                <X size={14} className="text-[#86868B]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {!result && (
                <>
                  <div className="bg-[#F5F5F7] rounded-[12px] p-3 mb-4">
                    <div className="text-[10px] font-semibold text-[#007AFF] uppercase tracking-wider mb-1">Contexte</div>
                    <p className="text-[12px] text-[#1D1D1F] leading-relaxed">{active.contexte}</p>
                  </div>

                  <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">Document · clique les lignes suspectes</div>
                  <div className="bg-white border border-[#E5E5EA]/60 rounded-[12px] overflow-hidden mb-4">
                    {active.lignes.map((ligne, i) => {
                      const isFlagged = flagged.has(i);
                      return (
                        <button key={i} onClick={() => toggleLine(i)}
                          className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 border-b border-[#E5E5EA]/30 last:border-0 transition-all ${isFlagged ? "bg-[#FF9500]/10 border-l-4 border-l-[#FF9500]" : "hover:bg-[#F5F5F7]"}`}>
                          <div className="flex items-start gap-2 min-w-0">
                            <span className={`text-[9px] tabular-nums font-mono ${isFlagged ? "text-[#FF9500]" : "text-[#c7c7cc]"} mt-0.5`}>L{i + 1}</span>
                            <span className={`text-[12px] ${isFlagged ? "text-[#1D1D1F] font-medium" : "text-[#3a3a3c]"}`}>{ligne.label}</span>
                          </div>
                          <span className={`text-[12px] font-mono tabular-nums shrink-0 ${isFlagged ? "text-[#FF9500] font-semibold" : "text-[#1D1D1F]"}`}>{ligne.valeur}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mb-4">
                    <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">Note de correction (cite les articles)</div>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="Ex : « L'amende de 450€ est non déductible (art. 39-2 CGI). À réintégrer extra-comptablement. »"
                      rows={3}
                      className="w-full text-[12px] p-3 border border-[#E5E5EA] rounded-[10px] outline-none focus:border-[#007AFF] resize-none leading-relaxed" />
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => submit("valider")} disabled={submitting}
                      className="flex-1 py-2.5 rounded-[10px] bg-[#34C759]/10 text-[#34C759] hover:bg-[#34C759]/15 font-medium text-[12px] transition-all flex items-center justify-center gap-1.5">
                      <CheckCircle size={13} /> Valider
                    </button>
                    <button onClick={() => submit("refuser")} disabled={submitting}
                      className="flex-1 py-2.5 rounded-[10px] bg-[#FF3B30]/10 text-[#FF3B30] hover:bg-[#FF3B30]/15 font-medium text-[12px] transition-all flex items-center justify-center gap-1.5">
                      <X size={13} /> Refuser avec correction
                    </button>
                    <button onClick={() => submit("deleguer")} disabled={submitting}
                      className="flex-1 py-2.5 rounded-[10px] bg-[#86868B]/10 text-[#86868B] hover:bg-[#86868B]/15 font-medium text-[12px] transition-all flex items-center justify-center gap-1.5">
                      <CornerDownRight size={13} /> Déléguer
                    </button>
                  </div>
                </>
              )}

              {result && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="inline-flex flex-col items-center bg-gradient-to-br from-[#007AFF]/5 to-[#34C759]/5 rounded-[16px] p-5">
                      <div className="text-[56px] font-bold tabular-nums leading-none" style={{ color: result.score >= 80 ? "#34C759" : result.score >= 50 ? "#FF9500" : "#FF3B30" }}>
                        {result.score}
                      </div>
                      <div className="text-[13px] font-medium text-[#1D1D1F] mt-1">Score Examinateur DEC</div>
                      <div className="flex items-center gap-3 text-[11px] mt-2">
                        <span className="text-[#34C759]">+{result.xp_gagne} XP</span>
                        {result.impact_legitimite !== 0 && (
                          <span className={result.impact_legitimite > 0 ? "text-[#34C759]" : "text-[#FF3B30]"}>
                            {result.impact_legitimite > 0 ? "+" : ""}{result.impact_legitimite} Légitimité
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#F5F5F7] rounded-[12px] p-3">
                    <p className="text-[12px] text-[#1D1D1F] italic leading-relaxed">"{result.feedback_general}"</p>
                  </div>

                  {result.analyse_note && (
                    <div className="bg-gradient-to-br from-[#007AFF]/5 to-[#5856D6]/5 border border-[#007AFF]/20 rounded-[12px] p-3">
                      <div className="flex items-start gap-2">
                        <Sparkles size={13} className="text-[#007AFF] mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[10px] font-semibold text-[#007AFF] uppercase tracking-wider mb-1">
                            Analyse critique {result.note_score_claude !== null && <span className="text-[#1D1D1F]">({result.note_score_claude}/20)</span>}
                          </div>
                          <p className="text-[12px] text-[#1D1D1F] leading-relaxed whitespace-pre-wrap">{result.analyse_note}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {result.erreurs_trouvees.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-[#34C759] uppercase tracking-wider mb-2">✓ Erreurs trouvées (+20 chacune)</div>
                      {result.erreurs_trouvees.map((e, i) => (
                        <div key={i} className="bg-[#34C759]/5 border border-[#34C759]/20 rounded-[10px] p-2.5 mb-1.5">
                          <p className="text-[12px] font-medium text-[#1D1D1F]">L{e.ligne_index + 1} · {e.description}</p>
                          <p className="text-[10px] text-[#86868B] mt-0.5">{e.reference_legale}</p>
                          <p className="text-[11px] text-[#3a3a3c] mt-1 leading-relaxed">{e.correction}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.erreurs_manquees.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-[#FF3B30] uppercase tracking-wider mb-2">✗ Erreurs manquées (−30 chacune)</div>
                      {result.erreurs_manquees.map((e, i) => (
                        <div key={i} className="bg-[#FF3B30]/5 border border-[#FF3B30]/20 rounded-[10px] p-2.5 mb-1.5">
                          <p className="text-[12px] font-medium text-[#1D1D1F]">L{e.ligne_index + 1} · {e.description}</p>
                          <p className="text-[10px] text-[#86868B] mt-0.5">{e.reference_legale}</p>
                          <p className="text-[11px] text-[#3a3a3c] mt-1 leading-relaxed">{e.correction}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.fausses_alertes.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-[#FF9500] uppercase tracking-wider mb-2">⚠ Fausses alertes (−10 chacune)</div>
                      <p className="text-[11px] text-[#86868B]">Lignes : {result.fausses_alertes.map((i) => `L${i + 1}`).join(", ")}</p>
                    </div>
                  )}

                  {result.ecriture_eval && (
                    <div className={`rounded-[12px] p-3 ${result.ecriture_eval.ok ? "bg-[#34C759]/5 border border-[#34C759]/20" : "bg-[#FF3B30]/5 border border-[#FF3B30]/20"}`}>
                      <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: result.ecriture_eval.ok ? "#34C759" : "#FF3B30" }}>
                        Écriture comptable {result.ecriture_eval.ok ? "validée ✓" : "à revoir ✗"}
                      </div>
                      <p className="text-[12px] text-[#1D1D1F]">{result.ecriture_eval.feedback}</p>
                    </div>
                  )}

                  <button onClick={close}
                    className="w-full py-2.5 rounded-[10px] bg-gradient-to-br from-[#007AFF] to-[#0040DD] text-white font-medium text-[13px] shadow-md">
                    Terminer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal écriture comptable */}
      {showEcriture && active?.ecriture_correction && (
        <div className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E5EA]/40 bg-gradient-to-r from-[#007AFF]/5 to-[#34C759]/5 flex items-center gap-2.5">
              <Calculator size={16} className="text-[#007AFF]" />
              <div>
                <h3 className="font-semibold text-[14px] text-[#1D1D1F]">Écriture de correction</h3>
                <p className="text-[11px] text-[#86868B]">Propose l'écriture comptable de régularisation</p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block mb-1">Compte Débit</label>
                  <input value={eDebit} onChange={(e) => setEDebit(e.target.value)} placeholder="Ex : 658"
                    className="w-full text-[13px] p-2 border border-[#E5E5EA] rounded-[8px] outline-none focus:border-[#007AFF] font-mono tabular-nums" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block mb-1">Compte Crédit</label>
                  <input value={eCredit} onChange={(e) => setECredit(e.target.value)} placeholder="Ex : 707"
                    className="w-full text-[13px] p-2 border border-[#E5E5EA] rounded-[8px] outline-none focus:border-[#007AFF] font-mono tabular-nums" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block mb-1">Montant (€)</label>
                <input value={eMontant} onChange={(e) => setEMontant(e.target.value)} type="number" placeholder="Ex : 1770"
                  className="w-full text-[13px] p-2 border border-[#E5E5EA] rounded-[8px] outline-none focus:border-[#007AFF] tabular-nums" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block mb-1">Libellé</label>
                <input value={eLibelle} onChange={(e) => setELibelle(e.target.value)} placeholder="Ex : Réintégration extra-comptable"
                  className="w-full text-[13px] p-2 border border-[#E5E5EA] rounded-[8px] outline-none focus:border-[#007AFF]" />
              </div>
              <p className="text-[10px] text-[#86868B]">Bonus : +5 Légitimité si parfaite · −10 si imprécise</p>
            </div>
            <div className="px-5 py-3 bg-[#fafafa] border-t border-[#E5E5EA]/40 flex gap-2">
              <button onClick={() => setShowEcriture(false)}
                className="px-3 py-2 text-[12px] rounded-[10px] bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E5E5EA]">Annuler</button>
              <button onClick={() => submit("refuser")} disabled={!eDebit || !eCredit || !eMontant || submitting}
                className={`ml-auto px-4 py-2 text-[12px] font-medium rounded-[10px] transition-all flex items-center gap-1.5 ${eDebit && eCredit && eMontant && !submitting ? "bg-gradient-to-br from-[#007AFF] to-[#0040DD] text-white shadow-md" : "bg-[#E5E5EA] text-[#86868B] cursor-not-allowed"}`}>
                {submitting ? <><RefreshCw size={11} className="animate-spin" /> Évaluation…</> : "Soumettre"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
