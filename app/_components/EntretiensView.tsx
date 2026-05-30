"use client";

import { useState, useEffect, useRef } from "react";
import { useGameStore } from "@/lib/supabase-store";
import { apiFetch } from "@/lib/api-client";
import { Briefcase, Clock, Send, X, CheckCircle, AlertTriangle, Sparkles, BookOpen, Play, Pause } from "lucide-react";
import { PageHeader } from "./ui/PageHeader";
import { extractAndExecuteMailMarker } from "./MessagesView";

type DureeEntretien = 5 | 15 | 30 | 45;
type Phase = "list" | "planning" | "session" | "decision" | "correction";

interface Msg {
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
}

interface DecisionOption {
  id: string;
  label: string;
  description: string;
  impact: { confiance?: number; loyaute?: number; stress?: number; tresorerie?: number; legitimite?: number };
  details: string;
}

export function EntretiensView() {
  const store = useGameStore();
  const [phase, setPhase] = useState<Phase>("list");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [duree, setDuree] = useState<DureeEntretien>(30);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [paused, setPaused] = useState(false);
  const [history, setHistory] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [decision, setDecision] = useState<DecisionOption | null>(null);
  const [correction, setCorrection] = useState<any>(null);
  const [loadingCorrection, setLoadingCorrection] = useState(false);
  // Contexte transmis depuis Messagerie/Mail ("Convoquer en entretien")
  const [preContext, setPreContext] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const agent = store.agents.find((a) => a.id === selectedAgentId);

  // 🤝 Écoute l'event d'ouverture pré-remplie depuis Messagerie / Mail
  useEffect(() => {
    function handlePendingEntretien() {
      if (typeof window === "undefined") return;
      try {
        const raw = localStorage.getItem("pending_entretien");
        if (!raw) return;
        const data = JSON.parse(raw);
        // Vérifie validité (moins de 5 minutes)
        if (Date.now() - (data.ts || 0) > 5 * 60 * 1000) {
          localStorage.removeItem("pending_entretien");
          return;
        }
        if (data.agent_id) {
          setSelectedAgentId(data.agent_id);
          setPreContext(data.context || null);
          setPhase("planning");
          setDuree(30);
        }
        localStorage.removeItem("pending_entretien");
      } catch {}
    }
    // Déclenché à l'arrivée + check immédiat (au cas où l'event est passé avant le mount)
    handlePendingEntretien();
    window.addEventListener("open-pending-entretien", handlePendingEntretien);
    return () => window.removeEventListener("open-pending-entretien", handlePendingEntretien);
  }, []);

  // Recommande les agents qui devraient avoir un entretien
  const recommandes = store.agents
    .map((a) => {
      let reasons: string[] = [];
      let priority = 0;
      if ((a as any).arc_actuel === "Rupture") { reasons.push("⚠ Arc Rupture — risque de départ"); priority += 100; }
      if ((a as any).arc_actuel === "Trahison") { reasons.push("⚠ Arc Trahison"); priority += 80; }
      if (a.stress > 70) { reasons.push(`🔥 Stress ${a.stress}`); priority += 50; }
      if (a.fatigue > 70) { reasons.push(`😴 Fatigue ${a.fatigue}`); priority += 30; }
      if (a.confiance_joueur < 40) { reasons.push(`📉 Confiance basse (${a.confiance_joueur})`); priority += 40; }
      if (a.loyaute < 30) { reasons.push(`💔 Loyauté faible (${a.loyaute})`); priority += 60; }
      return { agent: a, reasons, priority };
    })
    .filter((x) => x.reasons.length > 0)
    .sort((a, b) => b.priority - a.priority);

  // Chronomètre
  useEffect(() => {
    if (phase !== "session") return;
    if (paused) return;
    if (secondsLeft <= 0) {
      // Fin du temps → passe en décision
      setPhase("decision");
      return;
    }
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [phase, secondsLeft, paused]);

  // Scroll chat
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  function startPlanning(agentId: string) {
    setSelectedAgentId(agentId);
    setPhase("planning");
    setDuree(30);
  }

  function launchSession() {
    setSecondsLeft(duree * 60);
    setPaused(false);
    setPhase("session");
    // Message d'ouverture de l'agent
    if (agent) {
      const initialMsgs: Msg[] = [];
      // Si pré-contexte (vient d'un chat ou mail), on l'injecte en SYSTEM puis
      // l'agent ouvre la conversation en y faisant explicitement référence
      if (preContext) {
        initialMsgs.push({
          role: "system",
          content: `[Brief automatique pour l'entretien — issu de la conversation préalable]\n${preContext}`,
          ts: Date.now(),
        });
        initialMsgs.push({
          role: "assistant",
          content: `(${agent.nom.split(" ")[0]} s'assoit, dossier en main) Merci de m'avoir convoqué chef. Je crois qu'on doit prolonger ce qu'on s'est dit. Je suis prêt à entrer dans le détail si tu veux.`,
          ts: Date.now() + 1,
        });
      } else {
        initialMsgs.push({
          role: "assistant",
          content: `(${agent.nom.split(" ")[0]} arrive, s'assoit) Bonjour chef. Vous vouliez me voir ? J'avoue je ne sais pas trop pourquoi vous m'avez convoqué. Qu'est-ce que vous voulez qu'on aborde ?`,
          ts: Date.now(),
        });
      }
      setHistory(initialMsgs);
    }
  }

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending || !agent) return;
    if (!text) setInput("");
    const userMsg: Msg = { role: "user", content, ts: Date.now() };
    const newHistory = [...history, userMsg];
    setHistory(newHistory);
    setSending(true);

    try {
      // On envoie le brief system comme prefix du premier user message pour que
      // l'API chat (qui n'accepte que user/assistant) en tienne compte
      const systemBriefs = newHistory.filter((m) => m.role === "system").map((m) => m.content);
      const dialog = newHistory.filter((m) => m.role !== "system");
      const messagesForApi = dialog.map((m, idx) => {
        if (idx === 0 && m.role === "user" && systemBriefs.length > 0) {
          return { role: m.role, content: `[BRIEF CONTEXTE — utilise-le pour ta réponse]\n${systemBriefs.join("\n\n")}\n\n[MESSAGE PATRON]\n${m.content}` };
        }
        return { role: m.role, content: m.content };
      });

      const r = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          mode: "agent",
          messages: messagesForApi,
          agent_context: agent,
          game_state: {
            date: store.date_simulation,
            mood: store.mood_global,
            hour: store.game_hour,
            minute: store.game_minute,
            day: store.game_day,
            player_level: store.player_level,
            entretien_context: `ENTRETIEN INDIVIDUEL EN COURS — Durée prévue : ${duree} min. Contexte : ${agent.nom} a été convoqué(e) par le patron pour un entretien. Tu dois te comporter comme dans un vrai entretien : authentique, parle de tes vrais soucis (stress ${agent.stress}, fatigue ${agent.fatigue}, ${(agent as any).arc_actuel === "Rupture" ? "tu envisages sérieusement de partir" : "tu écoutes"}), ouvre-toi progressivement si le patron est empathique, te ferme s'il est froid.`,
          },
        }),
      });
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        const errMsg = errData?.error || `HTTP ${r.status}`;
        setHistory([...newHistory, { role: "assistant", content: `(L'agent semble distrait) Désolé, je n'ai pas suivi… (Erreur : ${errMsg})`, ts: Date.now() }]);
        return;
      }
      const d = await r.json();
      if (d.content) {
        // 📧 Exécute un éventuel envoi de mail demandé en entretien
        const cleaned = extractAndExecuteMailMarker(d.content, agent, store);
        setHistory([...newHistory, { role: "assistant", content: cleaned, ts: Date.now() }]);
      }
    } catch (e: any) {
      setHistory([...newHistory, { role: "assistant", content: `(Silence gêné) Erreur réseau : ${e?.message || "inconnue"}`, ts: Date.now() }]);
    } finally {
      setSending(false);
    }
  }

  function endSession() {
    setPhase("decision");
  }

  // Options de décision (génériques mais adaptées à l'arc)
  function getDecisionOptions(): DecisionOption[] {
    if (!agent) return [];
    const opts: DecisionOption[] = [
      {
        id: "augmenter",
        label: "💰 Augmentation salariale",
        description: "Validation d'une augmentation (+5% brut)",
        impact: { confiance: 12, loyaute: 15, stress: -10, tresorerie: -2000, legitimite: -2 },
        details: "L'augmentation rassure et fidélise — coût immédiat sur la trésorerie. Léger impact négatif sur ta légitimité (peut être perçu comme acheter la paix).",
      },
      {
        id: "formation",
        label: "🎓 Plan de formation",
        description: "Inscription à une formation DEC sur 3 mois",
        impact: { confiance: 8, loyaute: 8, stress: -5, tresorerie: -3500, legitimite: 3 },
        details: "Investissement long terme. Signal positif : 'je crois en toi'. Bonne pratique RH.",
      },
      {
        id: "delegation",
        label: "🎯 Délégation responsabilités",
        description: "Confier un dossier client important + autonomie",
        impact: { confiance: 10, loyaute: 6, stress: 5, legitimite: 2 },
        details: "Montre la confiance mais ajoute du stress court terme. Excellent pour les ambitieux.",
      },
      {
        id: "conges",
        label: "🌴 Congés exceptionnels",
        description: "3 jours de congé immédiats",
        impact: { confiance: 5, loyaute: 3, stress: -25, tresorerie: -800, legitimite: -3 },
        details: "Décompresser maintenant. Risque : perçu comme cadeau si pas justifié. Mauvais signal d'autorité.",
      },
      {
        id: "rien",
        label: "🤷 Aucune action (statu quo)",
        description: "L'entretien suffit, on attend",
        impact: { confiance: -3, loyaute: -2, stress: 3 },
        details: "Si l'agent attendait vraiment quelque chose, ne rien faire = déception. Acceptable si la conversation a déjà résolu le sujet.",
      },
      {
        id: "recadrer",
        label: "⚠️ Recadrage ferme",
        description: "Lettre d'avertissement avec objectifs précis",
        impact: { confiance: -8, loyaute: -5, stress: 15, legitimite: 5 },
        details: "Pour Ambitieux/Rigide qui ont dépassé les bornes. Risque démission. Renforce ton autorité.",
      },
      {
        id: "licencier",
        label: "🚪 Licenciement",
        description: "Rupture du contrat — départ effectif sous 48h, dossiers transférés",
        impact: { confiance: -20, loyaute: -20, stress: 30, legitimite: -5, tresorerie: -8000 },
        details: "Décision lourde : coût indemnités, impact équipe (peur +10), légitimité −5 (pression sur l'autorité). À réserver aux fautes graves ou inadéquation totale.",
      },
    ];
    return opts;
  }

  function applyDecision(opt: DecisionOption) {
    setDecision(opt);
    if (!agent) return;

    // Cas spécial : LICENCIEMENT — on déclenche fireAgent (cascade complète)
    if (opt.id === "licencier") {
      // Coût indemnités + cascade
      if (opt.impact.tresorerie) {
        store.setResources({
          tresorerie: store.tresorerie + (opt.impact.tresorerie || 0),
          legitimite: Math.max(0, Math.min(100, store.legitimite + (opt.impact.legitimite || 0))),
        });
      }
      const motif = `Licenciement décidé en entretien (durée ${duree}min). Dossiers réaffectés.`;
      store.fireAgent(agent.id, motif, "licencie");
      // Trace dans l'historique des corrections + bascule sur la phase correction
      fetchCorrection(opt);
      setPhase("correction");
      return;
    }

    // Applique les impacts
    store.updateAgent(agent.id, {
      confiance_joueur: Math.max(0, Math.min(100, agent.confiance_joueur + (opt.impact.confiance || 0))),
      loyaute: Math.max(0, Math.min(100, agent.loyaute + (opt.impact.loyaute || 0))),
      stress: Math.max(0, Math.min(100, agent.stress + (opt.impact.stress || 0))),
    });
    if (opt.impact.tresorerie || opt.impact.legitimite) {
      store.setResources({
        tresorerie: store.tresorerie + (opt.impact.tresorerie || 0),
        legitimite: Math.max(0, Math.min(100, store.legitimite + (opt.impact.legitimite || 0))),
      });
    }
    // Trace dans l'historique de l'agent — visible dans Équipe + Entretiens
    const impactBits: string[] = [];
    if (opt.impact.confiance) impactBits.push(`${opt.impact.confiance > 0 ? "+" : ""}${opt.impact.confiance} Conf`);
    if (opt.impact.loyaute) impactBits.push(`${opt.impact.loyaute > 0 ? "+" : ""}${opt.impact.loyaute} Loy`);
    if (opt.impact.stress) impactBits.push(`${opt.impact.stress > 0 ? "+" : ""}${opt.impact.stress} Str`);
    if (opt.impact.tresorerie) impactBits.push(`${opt.impact.tresorerie > 0 ? "+" : ""}${(opt.impact.tresorerie / 1000).toFixed(1)}k€`);
    useGameStore.setState((s) => ({
      agent_player_history: {
        ...s.agent_player_history,
        [agent.id]: [
          { day: s.game_day, hour: s.game_hour, event: `Entretien (${duree}min) — ${opt.label}`, impact: impactBits.join(" · ") },
          ...(s.agent_player_history[agent.id] || []),
        ].slice(0, 30),
      },
    }));
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("agent_player_history", JSON.stringify(useGameStore.getState().agent_player_history));
      } catch {}
    }
    // Recompute stress immédiatement après l'entretien (charge / état)
    setTimeout(() => store.recomputeAgentStress(), 100);
    // Demande la correction examinateur
    fetchCorrection(opt);
    setPhase("correction");
  }

  async function fetchCorrection(opt: DecisionOption) {
    if (!agent) return;
    setLoadingCorrection(true);
    try {
      const transcript = history.map((m) => `${m.role === "user" ? "PATRON" : agent.nom.split(" ")[0]} : ${m.content}`).join("\n\n");
      const r = await apiFetch("/api/chat-correction", {
        method: "POST",
        body: JSON.stringify({
          agent_message: `ENTRETIEN INDIVIDUEL (${duree} min). Transcript complet :\n\n${transcript}`,
          player_response: `Décision finale : ${opt.label} — ${opt.description}`,
          agent,
          dossiers_lies: store.dossiers.filter((d) => d.agent_id === agent.id),
          game_state: {
            day: store.game_day, hour: store.game_hour, minute: store.game_minute,
            mood: store.mood_global, tresorerie: store.tresorerie, legitimite: store.legitimite,
          },
        }),
      });
      const d = await r.json();
      if (d?.note_sur_20 !== undefined) {
        setCorrection(d);
        // Sauve aussi dans l'historique des corrections
        store.addChatCorrection({
          game_day: store.game_day,
          game_hour: store.game_hour,
          game_minute: store.game_minute,
          date_iso: new Date().toISOString(),
          agent_id: agent.id,
          agent_nom: agent.nom,
          agent_role: agent.role,
          agent_message: `[ENTRETIEN] Transcript : ${history.length} messages`,
          player_response: `Décision : ${opt.label}`,
          note_sur_20: d.note_sur_20,
          verdict: d.verdict || "",
          points_forts: d.points_forts || [],
          points_faibles: d.points_faibles || [],
          reponse_ideale: d.reponse_ideale || "",
          correction_detaillee: d.correction_detaillee || "",
          sources: d.sources || [],
          categorie_dec: "Management",
        });
      }
    } catch (e) {
      console.error("[Entretien] correction failed:", e);
    } finally {
      setLoadingCorrection(false);
    }
  }

  function reset() {
    setPhase("list");
    setSelectedAgentId(null);
    setHistory([]);
    setDecision(null);
    setCorrection(null);
    setSecondsLeft(0);
  }

  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const timerColor = secondsLeft < 60 ? "#FF3B30" : secondsLeft < 300 ? "#FF9500" : "#34C759";

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="ENTRETIENS"
        stats={[
          { value: store.agents.length, label: "collaborateurs" },
          { value: recommandes.length, label: "recommandés", tone: recommandes.length > 0 ? "warning" : "default" },
        ]}
      />
      <div className="max-w-[1200px] mx-auto px-10 pb-16">

        {/* PHASE : LIST */}
        {phase === "list" && (
          <>
            {recommandes.length > 0 && (
              <div className="mb-5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#FF3B30] mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={11} /> Recommandés en priorité
                </div>
                <div className="space-y-2">
                  {recommandes.map(({ agent: a, reasons, priority }) => {
                    const lastEntretien = (store.agent_player_history[a.id] || []).find((h) => h.event.startsWith("Entretien"));
                    return (
                      <div key={a.id} className="bg-white dark:bg-[#1c1c1e] border-l-4 border-[#FF3B30] rounded-[12px] p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-semibold" style={{ backgroundColor: a.avatar_color }}>
                          {a.initiales}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white">{a.nom}</div>
                          <div className="text-[10px] text-[#86868B] dark:text-[#98989D]">{reasons.join(" · ")}</div>
                          {lastEntretien && (
                            <div className="text-[10px] mt-0.5 italic" style={{ color: "var(--mdec-accent)" }}>
                              Dernière décision (J{lastEntretien.day}) : {lastEntretien.event.replace("Entretien", "")}
                            </div>
                          )}
                        </div>
                        <button onClick={() => startPlanning(a.id)}
                          className="px-3 py-1.5 text-[11px] font-semibold rounded-[10px] bg-gradient-to-br from-[#FF3B30] to-[#FF9500] text-white shadow-sm hover:shadow-md">
                          Convoquer à nouveau
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B] dark:text-[#98989D] mb-2">Tous les collaborateurs</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {store.agents.map((a) => (
                  <div key={a.id} className="bg-white dark:bg-[#1c1c1e] rounded-[12px] p-3 border border-[#E5E5EA]/40 dark:border-[#38383a] flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[10px] font-semibold" style={{ backgroundColor: a.avatar_color }}>
                      {a.initiales}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white truncate">{a.nom}</div>
                      <div className="text-[10px] text-[#86868B] dark:text-[#98989D] truncate">{a.role}</div>
                    </div>
                    <button onClick={() => startPlanning(a.id)}
                      className="px-2.5 py-1 text-[10px] rounded-[8px] bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 text-[#007AFF] dark:text-[#0A84FF] hover:bg-[#007AFF]/20 font-semibold">
                      Convoquer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* PHASE : PLANNING */}
        {phase === "planning" && agent && (
          <div className="bg-white dark:bg-[#1c1c1e] rounded-[18px] p-6 border border-[#E5E5EA]/40 dark:border-[#38383a]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-[14px] font-bold shadow-md" style={{ backgroundColor: agent.avatar_color }}>
                {agent.initiales}
              </div>
              <div>
                <h3 className="text-[18px] font-semibold text-[#1D1D1F] dark:text-white">Convoquer {agent.nom}</h3>
                <p className="text-[12px] text-[#86868B] dark:text-[#98989D]">{agent.role} · stress {agent.stress} · confiance {agent.confiance_joueur}</p>
              </div>
            </div>
            {preContext && (
              <div className="mb-4 bg-gradient-to-br from-[#FF9500]/8 to-[#FF3B30]/8 border-l-4 border-[#FF9500] rounded-[12px] p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#C76A00] dark:text-[#FF9F0A] mb-1.5 flex items-center gap-1.5">
                  🤝 Brief depuis la conversation
                </div>
                <pre className="text-[11px] text-[#3a3a3c] dark:text-[#d1d1d6] whitespace-pre-wrap font-sans leading-relaxed">{preContext.slice(0, 600)}{preContext.length > 600 ? "…" : ""}</pre>
                <p className="text-[10px] text-[#86868B] dark:text-[#98989D] mt-2 italic">
                  L'agent reprendra explicitement ce contexte à l'ouverture de l'entretien.
                </p>
              </div>
            )}
            <div className="mb-4">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B] dark:text-[#98989D] block mb-2">Durée prévue</label>
              <div className="grid grid-cols-4 gap-2">
                {([5, 15, 30, 45] as DureeEntretien[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuree(d)}
                    className={`py-2.5 rounded-[12px] text-[13px] font-semibold transition-all ${
                      duree === d
                        ? "bg-gradient-to-br from-[#5B7CFA] to-[#3F5BCE] text-white shadow-md"
                        : "bg-[#F5F5F7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#d1d1d6] hover:bg-[#E5E5EA] dark:hover:bg-[#38383a]"
                    }`}
                  >
                    {d} min
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#86868B] dark:text-[#98989D] mt-2 italic">
                Durée réelle du chrono. À la fin du temps imparti, l'entretien passe automatiquement en phase Décision.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={reset} className="flex-1 py-2.5 rounded-[10px] bg-[#F5F5F7] dark:bg-[#2c2c2e] text-[#1D1D1F] dark:text-white text-[12px]">
                Annuler
              </button>
              <button onClick={launchSession} className="flex-1 py-2.5 rounded-[10px] bg-gradient-to-br from-[#34C759] to-[#007AFF] text-white text-[12px] font-semibold shadow-md flex items-center justify-center gap-1.5">
                <Play size={12} /> Démarrer l'entretien
              </button>
            </div>
          </div>
        )}

        {/* PHASE : SESSION */}
        {phase === "session" && agent && (
          <div className="bg-white dark:bg-[#1c1c1e] rounded-[18px] border border-[#E5E5EA]/40 dark:border-[#38383a] overflow-hidden flex flex-col" style={{ height: "70vh" }}>
            <div className="px-5 py-3 border-b border-[#E5E5EA]/40 dark:border-[#38383a] flex items-center justify-between bg-gradient-to-r from-[#F5F5F7] to-white dark:from-[#161618] dark:to-[#1c1c1e]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shadow-sm" style={{ backgroundColor: agent.avatar_color }}>
                  {agent.initiales}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white">{agent.nom}</div>
                  <div className="text-[10px] text-[#86868B] dark:text-[#98989D]">Entretien individuel · {duree} min</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPaused(!paused)} title={paused ? "Reprendre" : "Pause"}
                  className="w-8 h-8 rounded-full bg-[#F5F5F7] dark:bg-[#2c2c2e] flex items-center justify-center">
                  {paused ? <Play size={12} className="text-[#34C759]" /> : <Pause size={12} className="text-[#FF9500]" />}
                </button>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: `${timerColor}15`, color: timerColor }}>
                  <Clock size={12} />
                  <span className="font-mono text-[14px] font-bold tabular-nums">{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>
                </div>
                <button onClick={endSession} className="px-3 py-1.5 text-[11px] rounded-full bg-[#FF3B30]/10 text-[#FF3B30] hover:bg-[#FF3B30]/20 font-semibold">
                  Terminer
                </button>
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#fafafa] dark:bg-black">
              {history.map((m, i) => {
                // Message SYSTEM (brief auto) = bandeau centré, pas de bulle chat
                if (m.role === "system") {
                  return (
                    <div key={i} className="my-2 mx-4 bg-[#FFEFD6] dark:bg-[#3a2a1c] border-l-2 border-[#FF9500] rounded-[10px] px-3 py-2">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-[#C76A00] dark:text-[#FF9F0A] mb-1">Brief</div>
                      <pre className="text-[11px] text-[#3a3a3c] dark:text-[#d1d1d6] whitespace-pre-wrap font-sans leading-snug">{m.content}</pre>
                    </div>
                  );
                }
                return (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "gap-2"}`}>
                    {m.role === "assistant" && agent && (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-semibold shrink-0 mt-1" style={{ backgroundColor: agent.avatar_color }}>
                        {agent.initiales}
                      </div>
                    )}
                    <div className={`max-w-[78%] px-3 py-2 rounded-[14px] text-[12px] leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-[#007AFF] text-white rounded-br-[4px]"
                        : "bg-white dark:bg-[#1c1c1e] text-[#1D1D1F] dark:text-white rounded-tl-[4px] border border-[#E5E5EA]/40 dark:border-[#38383a]"
                    }`}>
                      {m.content}
                    </div>
                  </div>
                );
              })}
              {sending && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-semibold shrink-0 mt-1" style={{ backgroundColor: agent.avatar_color }}>{agent.initiales}</div>
                  <div className="bg-white dark:bg-[#1c1c1e] rounded-[14px] rounded-tl-[4px] px-3 py-2 flex gap-1 border border-[#E5E5EA]/40 dark:border-[#38383a]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#86868B] animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#86868B] animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#86868B] animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-[#E5E5EA]/40 dark:border-[#38383a] bg-white dark:bg-[#1c1c1e]">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Continue l'entretien…"
                  disabled={sending}
                  className="flex-1 text-[12px] px-3 py-2 bg-[#F5F5F7] dark:bg-[#2c2c2e] dark:text-white rounded-full outline-none placeholder-[#86868B] disabled:opacity-50"
                />
                <button onClick={() => sendMessage()} disabled={!input.trim() || sending}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    input.trim() && !sending ? "bg-gradient-to-br from-[#5B7CFA] to-[#3F5BCE] text-white shadow-sm" : "bg-[#E5E5EA] dark:bg-[#38383a] text-[#86868B] cursor-not-allowed"
                  }`}>
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PHASE : DECISION */}
        {phase === "decision" && agent && (
          <div className="bg-white dark:bg-[#1c1c1e] rounded-[18px] p-6 border border-[#E5E5EA]/40 dark:border-[#38383a]">
            <h3 className="text-[18px] font-semibold text-[#1D1D1F] dark:text-white mb-1">Quelle décision prends-tu ?</h3>
            <p className="text-[12px] text-[#86868B] dark:text-[#98989D] mb-5">
              Suite à ton entretien avec {agent.nom}, choisis l'action concrète. Chaque option a un impact différent.
            </p>
            <div className="space-y-2">
              {getDecisionOptions().map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => applyDecision(opt)}
                  className="w-full text-left bg-[#F5F5F7] dark:bg-[#2c2c2e] hover:bg-[#E5E5EA] dark:hover:bg-[#38383a] rounded-[12px] p-3 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white">{opt.label}</div>
                      <div className="text-[11px] text-[#86868B] dark:text-[#98989D] mt-0.5">{opt.description}</div>
                      <div className="text-[10px] text-[#3a3a3c] dark:text-[#d1d1d6] mt-1.5 italic">{opt.details}</div>
                    </div>
                    <div className="flex flex-col gap-0.5 items-end shrink-0 text-[9px]">
                      {opt.impact.confiance !== undefined && <span className={opt.impact.confiance > 0 ? "text-[#34C759]" : "text-[#FF3B30]"}>{opt.impact.confiance > 0 ? "+" : ""}{opt.impact.confiance} Conf</span>}
                      {opt.impact.loyaute !== undefined && <span className={opt.impact.loyaute > 0 ? "text-[#34C759]" : "text-[#FF3B30]"}>{opt.impact.loyaute > 0 ? "+" : ""}{opt.impact.loyaute} Loy</span>}
                      {opt.impact.stress !== undefined && <span className={opt.impact.stress < 0 ? "text-[#34C759]" : "text-[#FF9500]"}>{opt.impact.stress > 0 ? "+" : ""}{opt.impact.stress} Str</span>}
                      {opt.impact.tresorerie !== undefined && <span className="text-[#86868B]">{opt.impact.tresorerie > 0 ? "+" : ""}{(opt.impact.tresorerie / 1000).toFixed(1)}k€</span>}
                      {opt.impact.legitimite !== undefined && <span className={opt.impact.legitimite > 0 ? "text-[#34C759]" : "text-[#FF3B30]"}>{opt.impact.legitimite > 0 ? "+" : ""}{opt.impact.legitimite} Lég</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PHASE : CORRECTION */}
        {phase === "correction" && decision && agent && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-[#34C759]/8 to-[#007AFF]/8 dark:from-[#30D158]/15 dark:to-[#0A84FF]/15 border border-[#34C759]/30 rounded-[16px] p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={18} className="text-[#34C759]" />
                <div className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white">Entretien terminé</div>
              </div>
              <p className="text-[12px] text-[#3a3a3c] dark:text-[#d1d1d6]">
                Tu as choisi : <strong>{decision.label}</strong>. {decision.details}
              </p>
            </div>

            {loadingCorrection && (
              <div className="bg-white dark:bg-[#1c1c1e] rounded-[14px] p-4 border border-[#E5E5EA]/40 dark:border-[#38383a] flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#86868B] animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-[#86868B] animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-[#86868B] animate-bounce" style={{ animationDelay: "300ms" }} />
                <span className="text-[11px] text-[#86868B]">L'examinateur DEC analyse ton entretien…</span>
              </div>
            )}

            {correction && (
              <div className="bg-white dark:bg-[#1c1c1e] rounded-[16px] p-5 border border-[#AF52DE]/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-14 h-14 rounded-[12px] flex flex-col items-center justify-center bg-gradient-to-br from-[#AF52DE]/15 to-[#5856D6]/15">
                    <div className="text-[22px] font-bold tabular-nums leading-none" style={{ color: correction.note_sur_20 >= 14 ? "#34C759" : correction.note_sur_20 >= 10 ? "#FF9500" : "#FF3B30" }}>
                      {correction.note_sur_20}
                    </div>
                    <div className="text-[9px] uppercase tracking-wider opacity-60">/20</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#AF52DE]">Note de l'examinateur</div>
                    <div className="text-[14px] font-semibold text-[#1D1D1F] dark:text-white mt-0.5">"{correction.verdict}"</div>
                  </div>
                </div>
                {correction.correction_detaillee && (
                  <div className="mb-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#86868B] dark:text-[#98989D] mb-1">Analyse</div>
                    <p className="text-[12px] text-[#1D1D1F] dark:text-[#d1d1d6] leading-relaxed">{correction.correction_detaillee}</p>
                  </div>
                )}
                {correction.points_faibles?.length > 0 && (
                  <div className="mb-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#FF3B30] mb-1">À améliorer</div>
                    <ul className="text-[11px] text-[#1D1D1F] dark:text-[#d1d1d6] space-y-0.5">
                      {correction.points_faibles.map((p: string, i: number) => <li key={i}>• {p}</li>)}
                    </ul>
                  </div>
                )}
                {correction.reponse_ideale && (
                  <div className="bg-[#34C759]/5 dark:bg-[#30D158]/10 rounded-[10px] p-3 mb-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#248A3D] dark:text-[#30D158] mb-1 flex items-center gap-1.5">
                      <BookOpen size={11} /> Ce qu'aurait fait un EC senior
                    </div>
                    <p className="text-[12px] text-[#1D1D1F] dark:text-[#d1d1d6] italic">"{correction.reponse_ideale}"</p>
                  </div>
                )}
                {correction.sources?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868B] dark:text-[#98989D] mr-1">📖 Sources :</span>
                    {correction.sources.map((s: string, i: number) => (
                      <span key={i} className="text-[10px] bg-[#86868B]/10 dark:bg-white/10 text-[#3a3a3c] dark:text-[#d1d1d6] px-2 py-0.5 rounded-md font-mono">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button onClick={reset} className="w-full py-3 rounded-[12px] bg-gradient-to-br from-[#5B7CFA] to-[#3F5BCE] text-white text-[13px] font-semibold shadow-md hover:shadow-lg">
              Terminer & retourner à la liste
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
