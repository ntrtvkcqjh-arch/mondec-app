"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/supabase-store";
import { apiFetch } from "@/lib/api-client";
import { ClipboardCheck, X, CheckCircle, CornerDownRight, Calculator, RefreshCw, Lock, FileSearch, Sparkles } from "lucide-react";
import { PageHeader } from "./ui/PageHeader";

import tasksData from "@/lib/data/tasks_pool.json";

interface TaskLine { label: string; valeur: string; }
interface TaskErreur { ligne_index: number; description: string; reference_legale: string; correction: string; }
interface TaskDoc {
  id: string; type: string; branche: string; titre: string; client: string; niveau_min: number;
  contexte: string; lignes: TaskLine[]; erreurs: TaskErreur[];
  ecriture_correction: { debit_compte: string; credit_compte: string; montant: number; libelle: string } | null;
}
interface CorrigeAnomalie {
  titre: string;
  statut: "trouvée" | "manquée" | "fausse alerte";
  source: string;
  correction_expert: string;
  commentaire_perso: string;
}
interface TaskResult {
  score: number;
  erreurs_trouvees: TaskErreur[];
  erreurs_manquees: TaskErreur[];
  fausses_alertes: number[];
  note_score: number;
  note_score_claude: number | null;
  analyse_note: string | null;
  corrige_par_anomalie?: CorrigeAnomalie[];
  decisions_recap?: Array<{ ligne_index: number; description: string; decision: "corriger" | "refuser" | "valider_quand_meme"; impact_score: number; consequence: string }>;
  ecriture_eval: { ok: boolean; feedback: string } | null;
  feedback_general: string;
  impact_legitimite: number;
  xp_gagne: number;
}

type DecisionAnomalie = "corriger" | "refuser" | "valider_quand_meme";

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
  // Mode revue rapide : décision par anomalie
  const [showRevueRapide, setShowRevueRapide] = useState(false);
  const [decisionsAnomalies, setDecisionsAnomalies] = useState<Record<number, DecisionAnomalie>>({});

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
    setShowRevueRapide(false);
    setDecisionsAnomalies({});
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
          decisions_par_anomalie: decisionsAnomalies,
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

        // 🔗 LIAISON SUIVI FISCAL → TÂCHES : si on traitait une obligation pending,
        // on la marque comme déposée (uniquement si score >= 50, sinon pas validée)
        if (store.pending_obligation_id && store.pending_obligation_meta && data.score >= 50) {
          store.markObligationDeposee(
            store.pending_obligation_id,
            store.pending_obligation_meta.type,
            store.pending_obligation_meta.client
          );
          store.clearPendingObligation();
          // Notification visible
          setTimeout(() => alert(`✅ Obligation fiscale '${store.pending_obligation_meta?.type}' validée et déposée. Suivi Fiscal mis à jour.`), 100);
        } else if (store.pending_obligation_id && data.score < 50) {
          setTimeout(() => alert(`⚠ Score insuffisant (${data.score}/100) — l'obligation reste à traiter. Réessaye avec une meilleure analyse.`), 100);
        }

        // CASCADE — Si score < 50 (erreurs manquées importantes) → impact agent
        if (data.score < 50) {
          // Trouve l'agent qui a préparé le document (par nom client matching)
          const agent = store.agents.find((a) => {
            const dossiers = store.dossiers.filter((d) => d.agent_id === a.id);
            return dossiers.some((d) => d.client.toLowerCase().includes(active.client.toLowerCase().split(" ")[0]) || active.client.toLowerCase().includes(d.client.toLowerCase().split(" ")[0]));
          });
          if (agent) store.applyTaskErrorImpact(agent.id, data.score);
        }
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
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="TÂCHES"
        stats={[
          { value: pool.length, label: "documents à contrôler" },
          { value: completedTasks.size, label: "validés", tone: "default" },
          { value: pool.length - completedTasks.size, label: "restants", tone: pool.length - completedTasks.size > 0 ? "warning" : "default" },
        ]}
      />
      <div className="max-w-[1200px] mx-auto px-10 pb-16">

        {/* Banner liaison Suivi Fiscal → Tâches */}
        {store.pending_obligation_id && store.pending_obligation_meta && (
          <div className="bg-gradient-to-r from-[#007AFF]/10 to-[#5856D6]/10 dark:from-[#0A84FF]/15 dark:to-[#5E5CE6]/15 border border-[#007AFF]/30 dark:border-[#0A84FF]/40 rounded-[14px] p-3.5 mb-4 flex items-center gap-3">
            <div className="text-[22px]">📋</div>
            <div className="flex-1">
              <div className="text-[12px] font-semibold text-[#007AFF] dark:text-[#0A84FF] uppercase tracking-wider mb-0.5">Obligation fiscale à valider</div>
              <div className="text-[13px] text-[#1D1D1F] dark:text-white">
                Tu traites : <strong>{store.pending_obligation_meta.type}</strong> · {store.pending_obligation_meta.client}
              </div>
              <div className="text-[10px] text-[#86868B] dark:text-[#98989D] mt-0.5">
                Sélectionne la tâche correspondante ci-dessous. Si ton score ≥ 50/100, l'obligation passera automatiquement en "Déposée" dans Suivi Fiscal.
              </div>
            </div>
            <button
              onClick={() => store.clearPendingObligation()}
              className="text-[11px] px-2.5 py-1.5 rounded-[8px] bg-white dark:bg-[#2c2c2e] text-[#86868B] hover:text-[#FF3B30] dark:hover:text-[#FF453A]"
            >
              Annuler
            </button>
          </div>
        )}

        {/* Barre Validés/Total animée */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-[14px] p-3 border border-[#E5E5EA]/40 dark:border-[#38383a] mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Progression session</span>
            <span className="text-[14px] font-bold tabular-nums">
              <span className="text-[#34C759]">{completedTasks.size}</span>
              <span className="text-[#86868B]">/{pool.length}</span>
            </span>
          </div>
          <div className="h-[8px] bg-[#F5F5F7] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#34C759] to-[#007AFF] rounded-full transition-all duration-700"
              style={{ width: `${(completedTasks.size / Math.max(1, pool.length)) * 100}%` }} />
          </div>
          {completedTasks.size === pool.length && pool.length > 0 && (
            <div className="mt-2 text-[12px] font-semibold text-[#34C759] text-center animate-pulse">
              🎉 Session validée ! Tous les documents traités.
            </div>
          )}
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
                className={`w-full text-left rounded-[14px] p-4 border transition-all flex items-center gap-3 ${isDone ? "bg-[#34C759]/5 border-[#34C759]/20 cursor-default" : isLocked ? "bg-[#F5F5F7] border-[#E5E5EA]/30 dark:border-[#38383a] opacity-50 cursor-not-allowed" : "bg-white border-[#E5E5EA]/40 dark:border-[#38383a] hover:border-[#007AFF]/40 hover:shadow cursor-pointer"}`}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${branchColor}15` }}>
                  <ClipboardCheck size={18} style={{ color: branchColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-semibold text-[14px] text-[#1D1D1F] dark:text-white">{task.titre}</span>
                    {isDone && <span className="text-[9px] font-semibold text-[#34C759] bg-[#34C759]/10 px-1.5 py-0.5 rounded-full">VALIDÉ</span>}
                    {isLocked && <span className="text-[9px] font-medium text-[#86868B] flex items-center gap-0.5"><Lock size={9} /> Niveau {task.niveau_min}</span>}
                  </div>
                  <p className="text-[11px] text-[#86868B] truncate mb-1">{task.client} · {task.contexte}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md" style={{ backgroundColor: `${branchColor}15`, color: branchColor }}>{task.branche}</span>
                    <span className="text-[9px] text-[#86868B]">{task.erreurs.length} anomalie{task.erreurs.length > 1 ? "s" : ""} à détecter</span>
                    {task.ecriture_correction && <span className="text-[9px] text-[#007AFF] flex items-center gap-0.5"><Calculator size={9} /> Mini-jeu écriture</span>}
                  </div>
                  {/* Aperçu anomalies (intitulés) — sans révéler la correction */}
                  {!isDone && task.erreurs.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {task.erreurs.map((e: any, i: number) => (
                        <li key={i} className="text-[10px] text-[#86868B] dark:text-[#98989D] flex items-start gap-1">
                          <span className="text-[#FF9500]">⚠</span>
                          <span className="line-clamp-1">{e.description}</span>
                        </li>
                      ))}
                    </ul>
                  )}
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
            <div className="px-6 py-4 border-b border-[#E5E5EA]/40 dark:border-[#38383a] flex items-center justify-between bg-gradient-to-r from-[#007AFF]/5 to-[#5856D6]/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#007AFF] to-[#0040DD] flex items-center justify-center shadow-md">
                  <ClipboardCheck size={18} className="text-white" />
                </div>
                <div>
                  <div className="font-semibold text-[15px] text-[#1D1D1F] dark:text-white">{active.titre}</div>
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
                  <div className="bg-[#F5F5F7] dark:bg-[#2c2c2e] rounded-[12px] p-3 mb-4">
                    <div className="text-[10px] font-semibold text-[#007AFF] uppercase tracking-wider mb-1">Contexte</div>
                    <p className="text-[12px] text-[#1D1D1F] leading-relaxed">{active.contexte}</p>
                  </div>

                  <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">Document · clique les lignes suspectes</div>
                  <div className="bg-white border border-[#E5E5EA]/60 rounded-[12px] overflow-hidden mb-4">
                    {active.lignes.map((ligne, i) => {
                      const isFlagged = flagged.has(i);
                      return (
                        <button key={i} onClick={() => toggleLine(i)}
                          className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 border-b border-[#E5E5EA]/30 dark:border-[#38383a] last:border-0 transition-all ${isFlagged ? "bg-[#FF9500]/10 border-l-4 border-l-[#FF9500]" : "hover:bg-[#F5F5F7]"}`}>
                          <div className="flex items-start gap-2 min-w-0">
                            <span className={`text-[9px] tabular-nums font-mono ${isFlagged ? "text-[#FF9500]" : "text-[#c7c7cc]"} mt-0.5`}>L{i + 1}</span>
                            <span className={`text-[12px] ${isFlagged ? "text-[#1D1D1F] font-medium" : "text-[#3a3a3c]"}`}>{ligne.label}</span>
                          </div>
                          <span className={`text-[12px] font-mono tabular-nums shrink-0 ${isFlagged ? "text-[#FF9500] font-semibold" : "text-[#1D1D1F] dark:text-white"}`}>{ligne.valeur}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mb-4">
                    <div className="text-[10px] font-semibold text-[#86868B] dark:text-[#98989D] uppercase tracking-wider mb-1.5">Note de correction (cite les articles)</div>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="Ex : « L'amende de 450€ est non déductible (art. 39-2 CGI). À réintégrer extra-comptablement. »"
                      rows={3}
                      className="w-full text-[12px] p-3 border border-[#E5E5EA] dark:border-[#38383a] rounded-[10px] outline-none focus:border-[#007AFF] resize-none leading-relaxed bg-white dark:bg-[#2c2c2e] text-[#1D1D1F] dark:text-white" />
                  </div>

                  {/* MODE REVUE RAPIDE — actions directes par anomalie (alternative à la détection libre) */}
                  <div className="mb-4 border border-[#AF52DE]/30 dark:border-[#BF5AF2]/30 rounded-[12px] overflow-hidden">
                    <button
                      onClick={() => setShowRevueRapide(!showRevueRapide)}
                      className="w-full px-3 py-2 bg-gradient-to-r from-[#AF52DE]/8 to-[#5856D6]/8 dark:from-[#BF5AF2]/12 dark:to-[#5E5CE6]/12 flex items-center justify-between hover:from-[#AF52DE]/12 hover:to-[#5856D6]/12 transition-colors"
                    >
                      <span className="text-[11px] font-semibold text-[#AF52DE] dark:text-[#BF5AF2] flex items-center gap-1.5">
                        <Sparkles size={12} /> Mode revue rapide — décider par anomalie
                      </span>
                      <span className="text-[10px] text-[#86868B] dark:text-[#98989D]">{showRevueRapide ? "Masquer ▴" : "Afficher ▾"}</span>
                    </button>
                    {showRevueRapide && (
                      <div className="p-3 space-y-2 bg-white dark:bg-[#1c1c1e]">
                        <p className="text-[10px] text-[#86868B] dark:text-[#98989D] italic mb-2">
                          Pour chaque anomalie identifiée par le collaborateur, choisis ton action. C'est plus rapide que la note libre, et le score tient compte de chacune de tes décisions.
                        </p>
                        {active.erreurs.map((err, i) => {
                          const dec = decisionsAnomalies[err.ligne_index];
                          return (
                            <div key={i} className="bg-[#F5F5F7] dark:bg-[#2c2c2e] rounded-[10px] p-2.5">
                              <div className="text-[11px] font-medium text-[#1D1D1F] dark:text-white mb-0.5">
                                ⚠ L{err.ligne_index + 1} · {err.description}
                              </div>
                              <div className="text-[9px] text-[#86868B] dark:text-[#98989D] mb-1.5 italic">📖 {err.reference_legale}</div>
                              <div className="grid grid-cols-3 gap-1.5">
                                {[
                                  { id: "corriger" as const, label: "✓ Corriger", desc: "+15 score · pro", color: "bg-[#34C759]" },
                                  { id: "refuser" as const, label: "↩ Refuser", desc: "+10 · renvoyer", color: "bg-[#FF9500]" },
                                  { id: "valider_quand_meme" as const, label: "⚠ Valider", desc: "−25 · risque", color: "bg-[#FF3B30]" },
                                ].map((opt) => (
                                  <button
                                    key={opt.id}
                                    onClick={() => setDecisionsAnomalies({ ...decisionsAnomalies, [err.ligne_index]: opt.id })}
                                    className={`px-1.5 py-1.5 rounded-[8px] text-[10px] font-semibold transition-all flex flex-col items-center gap-0.5 ${
                                      dec === opt.id ? `${opt.color} text-white shadow-md` : "bg-white dark:bg-[#1c1c1e] text-[#3a3a3c] dark:text-[#d1d1d6] border border-[#E5E5EA] dark:border-[#38383a] hover:border-[#86868B]"
                                    }`}
                                  >
                                    <span>{opt.label}</span>
                                    <span className={`text-[8px] ${dec === opt.id ? "text-white/80" : "text-[#86868B] dark:text-[#98989D]"}`}>{opt.desc}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        {Object.keys(decisionsAnomalies).length === active.erreurs.length && active.erreurs.length > 0 && (
                          <div className="text-[10px] text-[#34C759] font-medium bg-[#34C759]/10 px-2 py-1 rounded">
                            ✓ Toutes les anomalies décidées — tu peux soumettre maintenant
                          </div>
                        )}
                      </div>
                    )}
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

                  <div className="bg-[#F5F5F7] dark:bg-[#2c2c2e] rounded-[12px] p-3">
                    <p className="text-[12px] text-[#1D1D1F] italic leading-relaxed">"{result.feedback_general}"</p>
                  </div>

                  {/* Récap des décisions du mode revue rapide */}
                  {result.decisions_recap && result.decisions_recap.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-[#AF52DE] dark:text-[#BF5AF2] uppercase tracking-wider mb-2">Tes décisions par anomalie</div>
                      <div className="space-y-1.5">
                        {result.decisions_recap.map((d, i) => {
                          const decStyle = d.decision === "corriger"
                            ? { bg: "bg-[#34C759]/8 dark:bg-[#30D158]/12", text: "text-[#248A3D] dark:text-[#30D158]", label: "✓ Corrigé" }
                            : d.decision === "refuser"
                              ? { bg: "bg-[#FF9500]/8 dark:bg-[#FF9F0A]/12", text: "text-[#C76A00] dark:text-[#FF9F0A]", label: "↩ Refusé" }
                              : { bg: "bg-[#FF3B30]/8 dark:bg-[#FF453A]/12", text: "text-[#FF3B30] dark:text-[#FF453A]", label: "⚠ Validé malgré tout" };
                          return (
                            <div key={i} className={`${decStyle.bg} rounded-[10px] px-3 py-2 flex items-center gap-2`}>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${decStyle.text} bg-white/60 dark:bg-black/30 shrink-0`}>{decStyle.label}</span>
                              <span className="text-[11px] text-[#1D1D1F] dark:text-[#d1d1d6] flex-1">L{d.ligne_index + 1} · {d.description}</span>
                              <span className={`text-[11px] font-semibold tabular-nums shrink-0 ${d.impact_score > 0 ? "text-[#34C759]" : "text-[#FF3B30]"}`}>
                                {d.impact_score > 0 ? "+" : ""}{d.impact_score}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {result.analyse_note && (
                    <div className="bg-gradient-to-br from-[#007AFF]/5 to-[#5856D6]/5 dark:from-[#0A84FF]/10 dark:to-[#5E5CE6]/10 border border-[#007AFF]/20 dark:border-[#0A84FF]/30 rounded-[12px] p-3">
                      <div className="flex items-start gap-2">
                        <Sparkles size={13} className="text-[#007AFF] dark:text-[#0A84FF] mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[10px] font-semibold text-[#007AFF] dark:text-[#0A84FF] uppercase tracking-wider mb-1">
                            Analyse de l'examinateur DEC {result.note_score_claude !== null && <span className="text-[#1D1D1F] dark:text-white">({result.note_score_claude}/20)</span>}
                          </div>
                          <p className="text-[12px] text-[#1D1D1F] dark:text-[#d1d1d6] leading-relaxed whitespace-pre-wrap">{result.analyse_note}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Corrigé détaillé par anomalie — comme un examinateur EC 50 ans d'expérience */}
                  {result.corrige_par_anomalie && result.corrige_par_anomalie.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-[#1D1D1F] dark:text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Sparkles size={11} className="text-[#AF52DE]" /> Corrigé détaillé par anomalie (examinateur DEC senior)
                      </div>
                      <div className="space-y-2">
                        {result.corrige_par_anomalie.map((c, i) => {
                          const statutStyle = c.statut === "trouvée"
                            ? { bg: "bg-[#34C759]/8 dark:bg-[#30D158]/12", border: "border-[#34C759]/30", text: "text-[#248A3D] dark:text-[#30D158]", emoji: "✓" }
                            : c.statut === "manquée"
                              ? { bg: "bg-[#FF3B30]/8 dark:bg-[#FF453A]/12", border: "border-[#FF3B30]/30", text: "text-[#FF3B30] dark:text-[#FF453A]", emoji: "✗" }
                              : { bg: "bg-[#FF9500]/8 dark:bg-[#FF9F0A]/12", border: "border-[#FF9500]/30", text: "text-[#C76A00] dark:text-[#FF9F0A]", emoji: "⚠" };
                          return (
                            <div key={i} className={`${statutStyle.bg} border ${statutStyle.border} rounded-[12px] p-3`}>
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <h5 className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white flex-1">{c.titre}</h5>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${statutStyle.text} bg-white/60 dark:bg-black/30 shrink-0`}>
                                  {statutStyle.emoji} {c.statut.toUpperCase()}
                                </span>
                              </div>
                              <div className="text-[10px] text-[#86868B] dark:text-[#98989D] mb-1.5 italic">
                                📖 Source : <span className="font-medium text-[#3a3a3c] dark:text-[#d1d1d6] not-italic">{c.source}</span>
                              </div>
                              <div className="mb-1.5">
                                <div className="text-[9px] font-bold text-[#86868B] dark:text-[#98989D] uppercase tracking-wider mb-0.5">Corrigé expert</div>
                                <p className="text-[11px] text-[#1D1D1F] dark:text-[#d1d1d6] leading-relaxed">{c.correction_expert}</p>
                              </div>
                              <div className="bg-white/50 dark:bg-black/20 rounded-md px-2 py-1.5">
                                <div className="text-[9px] font-bold text-[#86868B] dark:text-[#98989D] uppercase tracking-wider mb-0.5">Commentaire sur ta réponse</div>
                                <p className="text-[11px] text-[#3a3a3c] dark:text-[#d1d1d6] leading-relaxed italic">{c.commentaire_perso}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {result.erreurs_trouvees.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-[#34C759] uppercase tracking-wider mb-2">✓ Erreurs trouvées (+20 chacune)</div>
                      {result.erreurs_trouvees.map((e, i) => (
                        <div key={i} className="bg-[#34C759]/5 border border-[#34C759]/20 rounded-[10px] p-2.5 mb-1.5">
                          <p className="text-[12px] font-medium text-[#1D1D1F] dark:text-white">L{e.ligne_index + 1} · {e.description}</p>
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
                          <p className="text-[12px] font-medium text-[#1D1D1F] dark:text-white">L{e.ligne_index + 1} · {e.description}</p>
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
                      <p className="text-[12px] text-[#1D1D1F] dark:text-white">{result.ecriture_eval.feedback}</p>
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
            <div className="px-5 py-4 border-b border-[#E5E5EA]/40 dark:border-[#38383a] bg-gradient-to-r from-[#007AFF]/5 to-[#34C759]/5 flex items-center gap-2.5">
              <Calculator size={16} className="text-[#007AFF]" />
              <div>
                <h3 className="font-semibold text-[14px] text-[#1D1D1F] dark:text-white">Écriture de correction</h3>
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
            <div className="px-5 py-3 bg-[#fafafa] border-t border-[#E5E5EA]/40 dark:border-[#38383a] flex gap-2">
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
