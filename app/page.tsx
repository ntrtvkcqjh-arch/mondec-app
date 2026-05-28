"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useGameStore, Dossier } from "@/lib/supabase-store";
import { supabase, signOut } from "@/lib/supabase";
import { apiFetch, getUserApiKey, setUserApiKey, clearUserApiKey, hasUserApiKey } from "@/lib/api-client";
import {
  Mail, Users, Calendar, FolderOpen, GraduationCap, Building2,
  Send, LogOut, ChevronRight, Zap, AlertTriangle, CheckCircle,
  Archive, CornerDownRight, Pencil, RefreshCw, TrendingUp, TrendingDown,
  Sparkles, Clock as ClockIcon, Trophy, X, Coffee, Briefcase, MessageSquare,
  Award, Flame, Target, ChevronUp, Settings, Key, ExternalLink,
  ClipboardCheck, FileSearch, Calculator, Lock, Unlock,
} from "lucide-react";

type Tab = "messages" | "equipe" | "agenda" | "tasks" | "dossiers" | "dec";

interface TaskLine { label: string; valeur: string; }
interface TaskErreur { ligne_index: number; description: string; reference_legale: string; correction: string; }
interface TaskDoc {
  id: string;
  type: string;
  branche: string;
  titre: string;
  client: string;
  niveau_min: number;
  contexte: string;
  lignes: TaskLine[];
  erreurs: TaskErreur[];
  ecriture_correction: { debit_compte: string; credit_compte: string; montant: number; libelle: string; } | null;
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

interface GhostVersion { label: string; sublabel: string; text: string; color: string; }
interface ScoreResult {
  score_global: number;
  breakdown: { precision: number; redaction: number; deontologie: number; contexte: number; operationnel: number };
  feedback: string;
  points_forts: string[];
  axes_amelioration: string[];
  impact: { legitimite_delta: number; confiance_agent_delta: number };
}
interface AgendaSlot {
  heure: string;
  type: "briefing" | "cas_pratique" | "rdv_client" | "mediation" | "validation" | "debrief" | "pause";
  titre: string;
  theme: string;
  agent_id?: string;
  duree_min: number;
  xp_max: number;
  niveau_requis: number;
}
interface DeontoQuestion {
  id: string;
  categorie: "EC" | "CAC";
  theme: string;
  type: "qcm_simple" | "qcm_multiple" | "qrc" | "vrai_faux";
  question: string;
  options?: string[];
  correct?: number[];
  correct_mots_cles?: string[];
  explication: string;
}
interface DeontoResult {
  score_20: number;
  pct: number;
  total_points: number;
  total_max: number;
  detail: Array<{ question_id: string; question: string; type: string; theme: string; points_obtenus: number; points_max: number; is_correct: boolean; explication: string; feedback: string; }>;
  impact_legitimite: number;
  badge: string | null;
  xp_gagne: number;
  synthese: string;
}
interface MissionEtape {
  numero: number;
  label: string;
  points_max: number;
  consigne: string;
  mots_cles_attendus: string[];
}
interface Mission {
  id: string;
  theme: string;
  difficulte: number;
  titre: string;
  client: string;
  contexte: string;
  etapes: MissionEtape[];
}
interface MissionResult {
  score_pct: number;
  score_20: number;
  total: number;
  total_max: number;
  detail: Array<{ numero: number; label: string; points_obtenus: number; points_max: number; mots_cles_trouves: number; mots_cles_total: number; feedback: string; correction_style: string | null; }>;
  impact_legitimite: number;
  xp_gagne: number;
  synthese: string;
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

function parseGhostVersions(content: string): GhostVersion[] | null {
  const defs = [
    { label: "Standard", sublabel: "Professionnel & neutre", color: "border-blue-200 bg-blue-50/50" },
    { label: "Ferme", sublabel: "Autoritaire & direct", color: "border-orange-200 bg-orange-50/50" },
    { label: "Pédagogue", sublabel: "Explicatif & formateur", color: "border-green-200 bg-green-50/50" },
  ];
  const result: GhostVersion[] = [];
  for (let i = 0; i < defs.length; i++) {
    const { label, sublabel, color } = defs[i];
    const nextLabel = defs[i + 1]?.label;
    const re = new RegExp(
      `Version\\s+${label}[^\\n]*\\n([\\s\\S]*?)${nextLabel ? `(?=Version\\s+${nextLabel})` : "\\s*$"}`, "i"
    );
    const m = content.match(re);
    if (!m) return null;
    result.push({ label, sublabel, text: m[1].trim(), color });
  }
  return result;
}

function RealClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-mono text-[11px] text-[#8e8e93] tabular-nums">{time}</span>;
}

function getNiveauDot(n: string) {
  switch (n) {
    case "N1": return "bg-gray-400";
    case "N2": return "bg-blue-500";
    case "N3": return "bg-yellow-500";
    case "N4": return "bg-orange-500";
    case "N5": return "bg-red-500 animate-pulse";
    default: return "bg-gray-300";
  }
}

function getNiveauLabel(n: string) {
  switch (n) {
    case "N1": return "Info"; case "N2": return "Question";
    case "N3": return "Décision"; case "N4": return "Problème"; case "N5": return "Crise";
    default: return n;
  }
}

function getUrgencyBarColor(n: string) {
  switch (n) {
    case "N5": return "bg-[#ff3b30]";
    case "N4": return "bg-[#ff9f0a]";
    case "N3": return "bg-[#ffd60a]";
    case "N2": return "bg-[#34c759]";
    default: return "bg-[#8e8e93]";
  }
}

function getUrgencyWidth(heures: number) {
  if (heures <= 1) return "100%";
  if (heures <= 6) return "85%";
  if (heures <= 12) return "60%";
  if (heures <= 24) return "40%";
  return "20%";
}

function getPhaseColor(phase: string | null) {
  switch (phase) {
    case "P5": return "bg-[#ff3b30]/15 text-[#ff3b30]";
    case "P4": return "bg-[#ff9f0a]/15 text-[#ff9f0a]";
    case "P3": return "bg-[#0071e3]/15 text-[#0071e3]";
    case "P2": return "bg-[#34c759]/15 text-[#34c759]";
    default: return "bg-[#8e8e93]/15 text-[#8e8e93]";
  }
}

function getPACost(n: string) {
  if (n === "N3" || n === "N4") return 1;
  if (n === "N5") return 2;
  return 0;
}

function getSlotIcon(type: AgendaSlot["type"]) {
  switch (type) {
    case "briefing": return Users;
    case "cas_pratique": return GraduationCap;
    case "rdv_client": return Briefcase;
    case "mediation": return MessageSquare;
    case "validation": return CheckCircle;
    case "debrief": return Target;
    case "pause": return Coffee;
    default: return Calendar;
  }
}

function getSlotColor(type: AgendaSlot["type"]) {
  switch (type) {
    case "cas_pratique": return "#0071e3";
    case "rdv_client": return "#bf5af2";
    case "mediation": return "#ff9f0a";
    case "validation": return "#34c759";
    case "briefing": return "#5e5ce6";
    case "debrief": return "#64d2ff";
    case "pause": return "#8e8e93";
    default: return "#8e8e93";
  }
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [ghostVersions, setGhostVersions] = useState<GhostVersion[] | null>(null);
  const [gwLoading, setGwLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [generatingEvents, setGeneratingEvents] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [lastPlayerMessage, setLastPlayerMessage] = useState("");

  // Agenda + cas pratique
  const [agendaSlots, setAgendaSlots] = useState<AgendaSlot[]>([]);
  const [completedSlots, setCompletedSlots] = useState<Set<string>>(new Set());
  const [activeSlot, setActiveSlot] = useState<AgendaSlot | null>(null);
  const [activeCase, setActiveCase] = useState<CaseStudy | null>(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [caseResponse, setCaseResponse] = useState("");
  const [caseSubmitting, setCaseSubmitting] = useState(false);
  const [caseCorrection, setCaseCorrection] = useState<Correction | null>(null);

  // Dossiers filter (5 statuts auto)
  const [dossiersFilter, setDossiersFilter] = useState<"en_cours" | "surveillance" | "avance" | "cloture" | "perdu" | "tous">("en_cours");

  // Claude assistant panel
  const [claudeOpen, setClaudeOpen] = useState(false);
  const [claudeInput, setClaudeInput] = useState("");
  const [claudeSending, setClaudeSending] = useState(false);
  const [claudeError, setClaudeError] = useState("");

  // Statut API (vérifie qu'Anthropic répond)
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "error">("checking");
  const [apiStatusReason, setApiStatusReason] = useState("");
  const [apiStatusDetails, setApiStatusDetails] = useState<{ status?: number; attempts?: Array<{ model: string; status: number; message: string }>; diagnostic?: string; needs_credit?: boolean } | null>(null);

  // Modal configuration clé API utilisateur
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keySaving, setKeySaving] = useState(false);

  // DEC Prep modules
  const [deontoPool, setDeontoPool] = useState<DeontoQuestion[]>([]);
  const [missionsPool, setMissionsPool] = useState<Mission[]>([]);
  // Déontologie session
  const [activeDeonto, setActiveDeonto] = useState<DeontoQuestion[] | null>(null);
  const [deontoReponses, setDeontoReponses] = useState<Record<string, { selected?: number[]; texte?: string }>>({});
  const [deontoIndex, setDeontoIndex] = useState(0);
  const [deontoSubmitting, setDeontoSubmitting] = useState(false);
  const [deontoResult, setDeontoResult] = useState<DeontoResult | null>(null);
  // Mission session
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [missionReponses, setMissionReponses] = useState<Record<number, string>>({});
  const [missionEtapeIndex, setMissionEtapeIndex] = useState(0);
  const [missionSubmitting, setMissionSubmitting] = useState(false);
  const [missionResult, setMissionResult] = useState<MissionResult | null>(null);

  // Tasks (validation pédagogique) — persistance via store/localStorage
  const [tasksPool, setTasksPool] = useState<TaskDoc[]>([]);
  const completedTasks = new Set(store.completed_tasks);
  const [activeTask, setActiveTask] = useState<TaskDoc | null>(null);
  const [taskFlaggedLines, setTaskFlaggedLines] = useState<Set<number>>(new Set());
  const [taskNote, setTaskNote] = useState("");
  const [taskDecision, setTaskDecision] = useState<"valider" | "refuser" | "deleguer" | null>(null);
  const [taskResult, setTaskResult] = useState<TaskResult | null>(null);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [showEcritureModal, setShowEcritureModal] = useState(false);
  const [ecritureDebit, setEcritureDebit] = useState("");
  const [ecritureCredit, setEcritureCredit] = useState("");
  const [ecritureMontant, setEcritureMontant] = useState("");
  const [ecritureLibelle, setEcritureLibelle] = useState("");

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const claudeContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const store = useGameStore();

  useEffect(() => {
    store.loadGameState();
    store.loadLocalPersistence();
  }, []);

  useEffect(() => {
    if (!store.isLoading && !store.isAuthenticated) router.push("/auth");
  }, [store.isLoading, store.isAuthenticated, router]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_OUT") router.push("/auth");
    });
    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    fetch("/agenda.json").then(r => r.json()).then(d => setAgendaSlots(d.slots_quotidiens || [])).catch(() => {});
    fetch("/tasks_pool.json").then(r => r.json()).then(d => setTasksPool(d.tasks || [])).catch(() => {});
    fetch("/deontologie_pool.json").then(r => r.json()).then(d => setDeontoPool(d.questions || [])).catch(() => {});
    fetch("/missions_pool.json").then(r => r.json()).then(d => setMissionsPool(d.missions || [])).catch(() => {});
  }, []);

  // Reset DEC drapeaux du jour quand on change de jour
  useEffect(() => {
    store.checkDecRollover();
  }, [store.game_day]);

  // Auto-progression des deadlines fiscales par les agents autonomes
  // (toutes les 8 secondes réelles ≈ 4 minutes jeu)
  useEffect(() => {
    if (!store.isAuthenticated || store.isLoading) return;
    const t = setInterval(() => {
      store.autoAdvanceDeadlines();
      store.checkOverdueDeadlines();
      store.recomputeAllDossierStatus();
    }, 8000);
    return () => clearInterval(t);
  }, [store.isAuthenticated, store.isLoading]);

  // Test santé API au démarrage (et toutes les 5 min)
  useEffect(() => {
    if (!store.isAuthenticated) return;
    const check = () => {
      apiFetch("/api/health").then(r => r.json()).then(d => {
        console.log("[HEALTH]", d);
        setApiStatus(d.ok ? "ok" : "error");
        setApiStatusReason(d.reason || "");
        setApiStatusDetails({ status: d.status, attempts: d.attempts, diagnostic: d.diagnostic, needs_credit: d.needs_credit });
        if (!d.ok && d.needs_key && !hasUserApiKey()) {
          setShowKeyModal(true);
        }
      }).catch(() => { setApiStatus("error"); setApiStatusReason("Réseau indisponible"); });
    };
    check();
    const t = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [store.isAuthenticated]);

  async function saveApiKey() {
    if (!keyInput.trim()) return;
    setKeySaving(true);
    setUserApiKey(keyInput.trim());
    try {
      const r = await apiFetch("/api/health");
      const d = await r.json();
      console.log("[HEALTH/save]", d);
      if (d.ok) {
        setApiStatus("ok");
        setApiStatusReason("");
        setApiStatusDetails(null);
        setShowKeyModal(false);
      } else {
        setApiStatus("error");
        setApiStatusReason(d.reason || "Clé invalide");
        setApiStatusDetails({ status: d.status, attempts: d.attempts, diagnostic: d.diagnostic, needs_credit: d.needs_credit });
      }
    } catch (err: any) {
      setApiStatus("error");
      setApiStatusReason("Erreur réseau : " + (err?.message || "?"));
    } finally {
      setKeySaving(false);
    }
  }

  // Horloge de jeu — 2 secondes réelles = 1 minute jeu (journée 8h-19h ≈ 22 min réelles)
  useEffect(() => {
    if (!store.isAuthenticated || store.isLoading) return;
    const t = setInterval(() => store.tickClock(1), 2000);
    return () => clearInterval(t);
  }, [store.isAuthenticated, store.isLoading]);

  // Auto-relances agents : un agent inactif peut spontanément envoyer un message
  // à chaque heure pile du jeu
  useEffect(() => {
    if (!store.isAuthenticated || store.isLoading || store.agents.length === 0) return;
    if (store.game_minute !== 0) return;
    if (store.game_hour < 8 || store.game_hour > 18) return;

    // À chaque heure pile, on déclenche un événement narratif
    const lastTrigger = typeof window !== "undefined" ? localStorage.getItem(`hourTrigger_${store.game_day}_${store.game_hour}`) : null;
    if (lastTrigger) return;
    if (typeof window !== "undefined") localStorage.setItem(`hourTrigger_${store.game_day}_${store.game_hour}`, "1");

    // Slot d'agenda à cette heure ?
    const matchingSlot = agendaSlots.find(s => {
      const [h, m] = s.heure.split(":").map(Number);
      return h === store.game_hour && m === 0;
    });
    if (matchingSlot && matchingSlot.agent_id && matchingSlot.type !== "pause") {
      const a = store.agents.find(x => x.id === matchingSlot.agent_id);
      if (a) {
        store.addNewMessage({
          agent_id: a.id,
          niveau: matchingSlot.type === "rdv_client" || matchingSlot.type === "validation" ? "N3" : "N2",
          type: matchingSlot.type === "mediation" ? "Drama" : "Question",
          sujet: `${matchingSlot.titre} (${matchingSlot.heure})`,
          contenu: `${a.nom.split(" ")[0]}: c'est l'heure de notre créneau "${matchingSlot.titre}". Thème : ${matchingSlot.theme}. Tu peux ouvrir le slot dans l'agenda pour le cas pratique, sinon dis-moi par ici comment tu veux qu'on aborde le sujet.`,
          delai_reponse_heures: matchingSlot.duree_min <= 30 ? 1 : 3,
        });
      }
    } else {
      // Pas de slot → relance aléatoire par un agent random
      const candidats = store.agents.filter(a => a.confiance_joueur > 30 && (a.stress < 80 || Math.random() > 0.7));
      if (candidats.length && Math.random() < 0.7) {
        const a = candidats[Math.floor(Math.random() * candidats.length)];
        const sujets: Record<string, { sujet: string; contenu: string; niveau: string; type: string }[]> = {
          Comptable: [
            { sujet: "Saisie banque — doublon possible", contenu: "Je viens de tomber sur une écriture qui semble passée deux fois sur le rapprochement bancaire de Petit SARL. Est-ce que je passe une OD de régularisation ou tu veux vérifier d'abord ?", niveau: "N2", type: "Question" },
            { sujet: "Délais TVA mensuelle", contenu: "Petit rappel : la TVA mensuelle est à déposer dans 3 jours. J'ai préparé les déclarations CA3 pour 4 clients, validation rapide stp.", niveau: "N3", type: "Decision" },
          ],
          Fiscal: [
            { sujet: "Taux IS — interrogation client", contenu: "Le client Martin me demande si on peut bénéficier du taux réduit IS 15% sur 42 500€ même avec 2 associés à 50/50. Je confirme oui (CA < 10M€ et capital libéré 100%), je réponds ?", niveau: "N2", type: "Question" },
            { sujet: "Acompte IS — calendrier", contenu: "Acompte IS du 15/06 à préparer. J'ai 6 dossiers concernés. Je lance les calculs ou tu veux qu'on en parle ?", niveau: "N2", type: "Question" },
          ],
          "Audit & IFRS": [
            { sujet: "Revue analytique Dubois", contenu: "Revue analytique terminée sur Groupe Dubois. Deux écarts significatifs sur la marge brute (+18%) et les charges externes (+22%). On creuse ?", niveau: "N3", type: "Question" },
          ],
          Social: [
            { sujet: "DSN — anomalie URSSAF", contenu: "URSSAF a retourné un rejet sur la DSN d'avril pour Yacine, code 47. Je corrige et je redépose ou tu veux qu'on vérifie ensemble ?", niveau: "N2", type: "Question" },
          ],
          RH: [
            { sujet: "Entretiens annuels Q2", contenu: "Les entretiens annuels Q2 doivent démarrer la semaine prochaine. Tu valides la grille d'évaluation actuelle ou on l'adapte ?", niveau: "N2", type: "Question" },
          ],
        };
        const pool = sujets[a.filiere] || sujets.Comptable;
        const choix = pool[Math.floor(Math.random() * pool.length)];
        store.addNewMessage({
          agent_id: a.id,
          niveau: choix.niveau,
          type: choix.type,
          sujet: choix.sujet,
          contenu: choix.contenu,
          delai_reponse_heures: 6,
        });
      }
    }
  }, [store.game_hour, store.game_minute, store.game_day]);

  // Auto-progression dossiers : à 18h chaque jour, résolution probabiliste
  useEffect(() => {
    if (store.game_hour === 18 && store.game_minute === 0) {
      store.dossiers.filter(d => d.etat === "en_cours").forEach((d) => {
        const luck = Math.random() * 100;
        const seuil = d.progression + (store.player_level * 3);
        if (luck < seuil - 20) store.winDossier(d.id);
        else if (luck > seuil + 50) store.loseDossier(d.id);
      });
    }
  }, [store.game_hour, store.game_minute]);

  // Génération autonome des événements
  useEffect(() => {
    if (!store.isAuthenticated || store.isLoading || store.agents.length === 0) return;
    const unread = store.messages.filter(m => !m.lu).length;
    if (unread >= 5) return;
    const lastGen = typeof window !== "undefined" ? localStorage.getItem("lastEventGen") : null;
    const now = Date.now();
    if (lastGen && now - parseInt(lastGen) < 3 * 60 * 1000) return;
    localStorage.setItem("lastEventGen", now.toString());
    setGeneratingEvents(true);
    const agentsWithUnread = store.messages.filter(m => !m.lu).map(m => m.agent_id);
    apiFetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agents: store.agents,
        game_state: { date: store.date_simulation, mood: store.mood_global, legitimite: store.legitimite, tresorerie: store.tresorerie, stress_global: store.stress_global, joursRestants: 16 },
        existing_subjects: store.messages.map(m => m.sujet),
        agents_with_unread: agentsWithUnread,
      }),
    }).then(r => r.json()).then(data => {
      if (data.events?.length) data.events.forEach((e: any) => store.addNewMessage(e));
    }).catch(() => {}).finally(() => setGeneratingEvents(false));
  }, [store.isAuthenticated, store.isLoading, store.agents.length]);

  // Scroll local au conteneur de messages — n'affecte pas la fenêtre principale
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [store.conversation_history, selectedAgent, ghostVersions, scoreResult]);

  useEffect(() => {
    const el = claudeContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [store.claude_history, claudeOpen]);

  const selectedMessage = store.messages.find((m) => m.agent_id === selectedAgent && !m.repondu)
    || store.messages.find((m) => m.agent_id === selectedAgent);
  const agent = store.agents.find((a) => a.id === selectedAgent);
  const unreadCount = store.messages.filter(m => !m.lu).length;

  // Groupe les messages par agent (1 entrée par agent = 1 conversation continue)
  const conversationsByAgent = (() => {
    const map = new Map<string, { agent: any; messages: typeof store.messages; lastMsg: typeof store.messages[0]; unread: number; pendingMsg: typeof store.messages[0] | undefined }>();
    for (const m of store.messages) {
      const a = store.agents.find((x) => x.id === m.agent_id);
      if (!a) continue;
      const existing = map.get(m.agent_id);
      if (existing) {
        existing.messages.push(m);
        if (!m.lu) existing.unread += 1;
        // Le "dernier" message = celui avec le timestamp le plus récent
        if (new Date(m.timestamp).getTime() > new Date(existing.lastMsg.timestamp).getTime()) {
          existing.lastMsg = m;
        }
        if (!m.repondu && !existing.pendingMsg) existing.pendingMsg = m;
      } else {
        map.set(m.agent_id, {
          agent: a,
          messages: [m],
          lastMsg: m,
          unread: m.lu ? 0 : 1,
          pendingMsg: !m.repondu ? m : undefined,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      new Date(b.lastMsg.timestamp).getTime() - new Date(a.lastMsg.timestamp).getTime()
    );
  })();

  const gameMinutes = store.game_hour * 60 + store.game_minute;
  const dossiersEnCours = store.dossiers.filter(d => d.etat === "en_cours").length;
  const dossiersSurveillance = store.dossiers.filter(d => d.etat === "surveillance").length;
  const dossiersAvances = store.dossiers.filter(d => d.etat === "avance").length;
  const dossiersClotures = store.dossiers.filter(d => d.etat === "cloture").length;
  const dossiersPerdus = store.dossiers.filter(d => d.etat === "perdu").length;

  function handleSelectAgent(agentId: string, messageId: string) {
    setSelectedAgent(agentId);
    setGhostVersions(null);
    setInputText("");
    setScoreResult(null);
    setApiError("");
    // Marque TOUS les messages non-lus de cet agent comme lus (conversation unique)
    store.messages.filter(m => m.agent_id === agentId && !m.lu).forEach(m => {
      store.markMessageRead(m.id);
    });
    store.loadConversations(agentId);
  }

  function handleDirectSend() {
    if (!inputText.trim() || !agent || sending) return;
    const text = inputText.trim();
    setInputText("");
    sendMessage(text);
  }

  async function handleGhostDraft() {
    if (!inputText.trim() || !agent || sending || gwLoading) return;
    const savedText = inputText.trim();
    setGwLoading(true);
    setGhostVersions(null);
    setApiError("");
    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "ghost",
          messages: [{ role: "user", content: savedText }],
          agent_context: { ...agent, sujet: selectedMessage?.sujet },
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      if (!data.content) throw new Error("no_content");
      const versions = parseGhostVersions(data.content);
      if (versions) {
        setGhostVersions(versions);
      } else {
        setInputText("");
        sendMessage(savedText);
      }
    } catch (err: any) {
      setApiError(`Ghost Writer indisponible — envoi direct`);
      setInputText("");
      sendMessage(savedText);
    } finally {
      setGwLoading(false);
    }
  }

  function handlePickVersion(text: string) {
    setGhostVersions(null);
    setInputText("");
    sendMessage(text);
  }

  async function sendMessage(text: string) {
    if (!agent || sending) return;
    const a = agent;
    const niveau = selectedMessage?.niveau || "N2";
    const cost = getPACost(niveau);
    if (cost > 0 && !store.spendPA(cost)) {
      setApiError("Pas assez de Points d'Action — repos requis.");
      return;
    }

    setSending(true);
    setApiError("");
    setScoreResult(null);
    setLastPlayerMessage(text);

    const currentHistory = store.conversation_history[a.id] || [];
    const userMsg = { role: "user" as const, content: text };

    // Optimistic update — UI réagit immédiatement
    useGameStore.setState((s) => ({
      conversation_history: {
        ...s.conversation_history,
        [a.id]: [...(s.conversation_history[a.id] || []), userMsg],
      },
    }));

    try {
      console.log("[CHAT] Envoi message à", a.nom, ":", text.slice(0, 50));
      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "agent",
          messages: [...currentHistory, userMsg],
          agent_context: a,
          game_state: {
            date: store.date_simulation,
            mood: store.mood_global,
            joursRestants: 16,
            hour: store.game_hour,
            minute: store.game_minute,
            day: store.game_day,
            player_level: store.player_level,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("[CHAT] HTTP error", res.status, errText);
        setApiError(`Erreur ${res.status} — ${errText.slice(0, 100)}`);
        return;
      }

      const data = await res.json();
      console.log("[CHAT] Réponse reçue:", data.content?.slice(0, 50) || "(vide)");

      if (data.error) {
        setApiError(`API: ${data.error}`);
        return;
      }
      if (!data.content) {
        setApiError("Réponse vide — réessaye");
        return;
      }

      useGameStore.setState((s) => ({
        conversation_history: {
          ...s.conversation_history,
          [a.id]: [
            ...(s.conversation_history[a.id] || []),
            { role: "assistant" as const, content: data.content },
          ],
        },
      }));

      if (store.user_id) {
        store.addConversation(a.id, "user", text).catch(() => {});
        store.addConversation(a.id, "assistant", data.content).catch(() => {});
      }
      if (selectedMessage) store.replyToMessage(selectedMessage.id, text).catch(() => {});

      // Score en arrière-plan
      apiFetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_message: text,
          agent_original_message: selectedMessage?.contenu || "",
          agent_response: data.content,
          agent_context: a,
        }),
      }).then(r => r.json()).then(scoreData => {
        if (scoreData.score_global !== undefined) {
          setScoreResult(scoreData);
          if (scoreData.impact?.legitimite_delta) {
            store.setResources({ legitimite: Math.max(0, Math.min(100, store.legitimite + scoreData.impact.legitimite_delta)) });
          }
          const xpGain = Math.round(scoreData.score_global / 5);
          store.addXP(xpGain);
          // Effet en chaîne : agent gagne/perd confiance + dossier lié avance
          store.applyOutcome(a.id, scoreData.score_global);
        }
      }).catch(() => {});
    } catch (err: any) {
      console.error("[CHAT] Exception:", err);
      setApiError(`Erreur réseau — ${err?.message || "inconnue"}`);
    } finally {
      setSending(false);
    }
  }

  function handleArchive(msgId: string) {
    store.markMessageRead(msgId);
    store.replyToMessage(msgId, "[archivé]");
  }

  // Pool de cas pratiques (fallback si IA hors ligne)
  const [casesPool, setCasesPool] = useState<any[]>([]);
  useEffect(() => {
    fetch("/cases_pool.json").then(r => r.json()).then(d => setCasesPool(d.cases || [])).catch(() => {});
  }, []);

  function fallbackCase(slot: AgendaSlot): CaseStudy | null {
    if (!casesPool.length) return null;
    // Filtrer par niveau requis et thème proche
    const themeKeywords = slot.theme.toLowerCase().split(/\s+/);
    const matching = casesPool.filter(c =>
      c.niveau_min <= store.player_level &&
      c.themes.some((t: string) => themeKeywords.some(k => t.toLowerCase().includes(k) || k.includes(t.toLowerCase())))
    );
    const pool = matching.length ? matching : casesPool.filter(c => c.niveau_min <= store.player_level);
    if (!pool.length) return null;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    return {
      titre: chosen.titre,
      client: chosen.client,
      contexte: chosen.contexte,
      enonce: chosen.enonce,
      question: chosen.question,
      xp_potentiel: chosen.xp_potentiel,
      criteres: chosen.criteres,
    };
  }

  function fallbackCorrection(playerResponse: string): Correction {
    // Auto-correction simple basée sur la longueur et la présence de jargon
    const txt = playerResponse.toLowerCase();
    const jargonKeys = ["pcg", "crc", "ifrs", "ias", "bofip", "cgi", "art.", "article", "tva", "is ", "csg", "dsn", "deb"];
    const jargonCount = jargonKeys.filter(k => txt.includes(k)).length;
    const lengthScore = Math.min(40, Math.floor(playerResponse.length / 8));
    const jargonScore = jargonCount * 10;
    const score = Math.min(95, 30 + lengthScore + jargonScore);
    return {
      score,
      verdict: score >= 75 ? "Bien" : score >= 50 ? "Satisfaisant" : "À retravailler",
      analogie: "Comme un cuisinier qui dresse une assiette sans goûter — la forme y est, vérifie maintenant le fond.",
      correction: "L'IA correctrice est temporairement hors ligne. Compare ta réponse avec la correction officielle ci-dessus et ajuste si besoin.",
      points_forts: jargonCount > 0 ? [`Utilisation de termes techniques (${jargonCount} référence(s))`] : ["Réponse rédigée"],
      axes_amelioration: jargonCount === 0 ? ["Cite des articles précis (CGI, PCG, IFRS…)"] : ["Détaille davantage le calcul"],
      xp_gagne: Math.floor(score / 4),
      impact_legitimite: score >= 70 ? 2 : score >= 50 ? 0 : -1,
      impact_stress: score >= 70 ? -2 : 1,
    };
  }

  // Cas pratique
  async function openCasePratique(slot: AgendaSlot) {
    if (slot.type === "pause") return;
    if (store.player_level < slot.niveau_requis) {
      alert(`Niveau ${slot.niveau_requis} requis (tu es niveau ${store.player_level})`);
      return;
    }
    setActiveSlot(slot);
    setActiveCase(null);
    setCaseResponse("");
    setCaseCorrection(null);
    setCaseLoading(true);
    try {
      const a = slot.agent_id ? store.agents.find(x => x.id === slot.agent_id) : null;
      const res = await apiFetch("/api/case-study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: slot.theme,
          player_level: store.player_level,
          hour: store.game_hour,
          day: store.game_day,
          agent_context: a,
        }),
      });
      const data = await res.json();
      if (data.titre) {
        setActiveCase(data);
      } else {
        // Fallback : utiliser un cas pré-écrit
        const fb = fallbackCase(slot);
        if (fb) setActiveCase(fb);
        else {
          alert("Impossible de générer le cas pratique. Vérifie ta clé API ⚙.");
          setActiveSlot(null);
        }
      }
    } catch (err) {
      const fb = fallbackCase(slot);
      if (fb) setActiveCase(fb);
      else {
        alert("Erreur réseau — réessaye dans un instant.");
        setActiveSlot(null);
      }
    } finally {
      setCaseLoading(false);
    }
  }

  async function submitCaseResponse() {
    if (!activeCase || !caseResponse.trim() || caseSubmitting) return;
    setCaseSubmitting(true);
    try {
      const res = await apiFetch("/api/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_study: activeCase,
          player_response: caseResponse,
          player_level: store.player_level,
        }),
      });
      const data = await res.json();
      const result: Correction = data.score !== undefined ? data : fallbackCorrection(caseResponse);
      setCaseCorrection(result);
      store.addXP(result.xp_gagne || 0);
      if (result.impact_legitimite) {
        store.setResources({ legitimite: Math.max(0, Math.min(100, store.legitimite + result.impact_legitimite)) });
      }
      if (result.impact_stress) {
        store.setResources({ stress_global: Math.max(0, Math.min(100, store.stress_global + result.impact_stress)) });
      }
      if (activeSlot) {
        setCompletedSlots(prev => new Set(prev).add(activeSlot.heure));
        if (activeSlot.agent_id) {
          store.applyOutcome(activeSlot.agent_id, result.score);
        }
      }
    } catch (err) {
      const result = fallbackCorrection(caseResponse);
      setCaseCorrection(result);
      store.addXP(result.xp_gagne || 0);
      if (activeSlot) {
        setCompletedSlots(prev => new Set(prev).add(activeSlot.heure));
        if (activeSlot.agent_id) store.applyOutcome(activeSlot.agent_id, result.score);
      }
    } finally {
      setCaseSubmitting(false);
    }
  }

  function closeCasePratique() {
    setActiveSlot(null);
    setActiveCase(null);
    setCaseResponse("");
    setCaseCorrection(null);
  }

  // Tasks (validation pédagogique)
  function openTask(task: TaskDoc) {
    if (store.player_level < task.niveau_min) {
      alert(`Niveau ${task.niveau_min} requis (tu es niveau ${store.player_level})`);
      return;
    }
    setActiveTask(task);
    setTaskFlaggedLines(new Set());
    setTaskNote("");
    setTaskDecision(null);
    setTaskResult(null);
    setEcritureDebit(""); setEcritureCredit(""); setEcritureMontant(""); setEcritureLibelle("");
  }

  function toggleTaskLine(idx: number) {
    setTaskFlaggedLines(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function submitTask(decision: "valider" | "refuser" | "deleguer") {
    if (!activeTask || taskSubmitting) return;
    setTaskDecision(decision);

    // Si refuser et qu'il y a une écriture, ouvrir le mini-jeu d'abord
    if (decision === "refuser" && activeTask.ecriture_correction && !ecritureDebit) {
      setShowEcritureModal(true);
      return;
    }

    setTaskSubmitting(true);
    try {
      const ecriture_proposee = decision === "refuser" && activeTask.ecriture_correction ? {
        debit_compte: ecritureDebit,
        credit_compte: ecritureCredit,
        montant: Number(ecritureMontant) || 0,
        libelle: ecritureLibelle,
      } : null;

      const res = await apiFetch("/api/task-eval", {
        method: "POST",
        body: JSON.stringify({
          task: activeTask,
          decision,
          lignes_signalees: Array.from(taskFlaggedLines),
          note_correction: taskNote,
          ecriture_proposee,
        }),
      });
      const data = await res.json();
      if (data.score !== undefined) {
        setTaskResult(data);
        store.addXP(data.xp_gagne || 0);
        if (data.impact_legitimite) {
          store.setResources({ legitimite: Math.max(0, Math.min(100, store.legitimite + data.impact_legitimite)) });
        }
        store.markTaskCompleted(activeTask.id);
        // Si la branche est associée à une deadline fiscale, on la fait avancer
        const matchingDeadline = store.fiscal_deadlines.find(d => d.filiere_responsable === activeTask.branche);
        if (matchingDeadline && data.score >= 60) {
          store.advanceDeadline(matchingDeadline.id, data.score >= 80 ? 15 : 8);
        }
        // Si un dossier est lié au client de la task, on update qualité + cas_traites
        const linkedDossier = store.dossiers.find(d => activeTask.client.toLowerCase().includes(d.client.toLowerCase().split(" ")[0]) || d.client.toLowerCase().includes(activeTask.client.toLowerCase().split(" ")[0]));
        if (linkedDossier) {
          useGameStore.setState((s) => ({
            dossiers: s.dossiers.map(x => x.id === linkedDossier.id ? {
              ...x,
              cas_traites: x.cas_traites + 1,
              qualite: Math.min(100, Math.round((x.qualite * x.cas_traites + data.score) / (x.cas_traites + 1))),
              progression: Math.min(100, x.progression + (data.score >= 80 ? 15 : data.score >= 60 ? 8 : 3)),
            } : x),
          }));
        }
        // Recompute statuts après modif
        store.recomputeAllDossierStatus();
      } else {
        alert("Erreur d'évaluation. Réessaye.");
      }
    } catch (err) {
      alert("Erreur réseau.");
    } finally {
      setTaskSubmitting(false);
      setShowEcritureModal(false);
    }
  }

  function closeTask() {
    setActiveTask(null);
    setTaskResult(null);
    setShowEcritureModal(false);
  }

  // ── DÉONTOLOGIE ────────────────────────────────────────────────────────
  function startDeonto() {
    if (deontoPool.length === 0) { alert("Questions en cours de chargement…"); return; }
    // Pioche 20 questions (10 EC + 10 CAC si possible), en évitant les récentes
    const recent = new Set(store.dec_completed_deonto_ids.slice(-40));
    const ec = deontoPool.filter(q => q.categorie === "EC" && !recent.has(q.id));
    const cac = deontoPool.filter(q => q.categorie === "CAC" && !recent.has(q.id));
    const ecFallback = deontoPool.filter(q => q.categorie === "EC");
    const cacFallback = deontoPool.filter(q => q.categorie === "CAC");
    const pickFrom = (pool: DeontoQuestion[], fallback: DeontoQuestion[], n: number) => {
      const arr = (pool.length >= n ? pool : fallback).slice().sort(() => Math.random() - 0.5);
      return arr.slice(0, n);
    };
    const selected = [...pickFrom(ec, ecFallback, 10), ...pickFrom(cac, cacFallback, 10)].sort(() => Math.random() - 0.5);
    setActiveDeonto(selected);
    setDeontoReponses({});
    setDeontoIndex(0);
    setDeontoResult(null);
  }

  function toggleDeontoOption(qid: string, idx: number, multiple: boolean) {
    setDeontoReponses(prev => {
      const current = prev[qid]?.selected || [];
      let next: number[];
      if (multiple) {
        next = current.includes(idx) ? current.filter(x => x !== idx) : [...current, idx];
      } else {
        next = [idx];
      }
      return { ...prev, [qid]: { ...prev[qid], selected: next } };
    });
  }

  function setDeontoText(qid: string, txt: string) {
    setDeontoReponses(prev => ({ ...prev, [qid]: { ...prev[qid], texte: txt } }));
  }

  async function submitDeonto() {
    if (!activeDeonto || deontoSubmitting) return;
    setDeontoSubmitting(true);
    try {
      const reponses = activeDeonto.map(q => ({
        question_id: q.id,
        selected: deontoReponses[q.id]?.selected,
        texte: deontoReponses[q.id]?.texte,
      }));
      const res = await apiFetch("/api/deontologie-eval", {
        method: "POST",
        body: JSON.stringify({ questions: activeDeonto, reponses }),
      });
      const data = await res.json();
      if (data.score_20 !== undefined) {
        setDeontoResult(data);
        store.addXP(data.xp_gagne || 0);
        if (data.impact_legitimite) {
          store.setResources({ legitimite: Math.max(0, Math.min(100, store.legitimite + data.impact_legitimite)) });
        }
        if (data.badge) store.addBadge(data.badge);
        store.markDeontoCompleted(activeDeonto.map(q => q.id));
      } else {
        alert("Erreur évaluation déontologie.");
      }
    } catch (e) {
      alert("Erreur réseau.");
    } finally {
      setDeontoSubmitting(false);
    }
  }

  function closeDeonto() {
    setActiveDeonto(null);
    setDeontoResult(null);
    setDeontoIndex(0);
  }

  // ── MISSION ────────────────────────────────────────────────────────────
  function startMission(mission: Mission) {
    setActiveMission(mission);
    setMissionReponses({});
    setMissionEtapeIndex(0);
    setMissionResult(null);
  }

  function setMissionText(numero: number, txt: string) {
    setMissionReponses(prev => ({ ...prev, [numero]: txt }));
  }

  async function submitMission() {
    if (!activeMission || missionSubmitting) return;
    setMissionSubmitting(true);
    try {
      const reponses = activeMission.etapes.map(e => ({ numero: e.numero, texte: missionReponses[e.numero] || "" }));
      const res = await apiFetch("/api/mission-eval", {
        method: "POST",
        body: JSON.stringify({ mission: activeMission, reponses }),
      });
      const data = await res.json();
      if (data.score_pct !== undefined) {
        setMissionResult(data);
        store.addXP(data.xp_gagne || 0);
        if (data.impact_legitimite) {
          store.setResources({ legitimite: Math.max(0, Math.min(100, store.legitimite + data.impact_legitimite)) });
        }
        store.markMissionCompleted(activeMission.id);
      } else {
        alert("Erreur évaluation mission.");
      }
    } catch (e) {
      alert("Erreur réseau.");
    } finally {
      setMissionSubmitting(false);
    }
  }

  function closeMission() {
    setActiveMission(null);
    setMissionResult(null);
    setMissionEtapeIndex(0);
  }

  // Claude assistant
  async function sendToClaude() {
    const text = claudeInput.trim();
    if (!text || claudeSending) return;
    setClaudeInput("");
    setClaudeError("");
    store.addClaudeMessage({ role: "user", content: text });
    setClaudeSending(true);
    try {
      const history = store.claude_history;
      const res = await apiFetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...history, { role: "user", content: text }],
          game_state: {
            day: store.game_day,
            hour: store.game_hour,
            minute: store.game_minute,
            player_level: store.player_level,
            legitimite: store.legitimite,
            tresorerie: store.tresorerie,
            stress_global: store.stress_global,
            points_action: store.points_action,
            points_action_max: store.points_action_max,
            mood_global: store.mood_global,
          },
          agents: store.agents,
          dossiers: store.dossiers,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        setClaudeError(`Erreur ${res.status}`);
        console.error("[CLAUDE]", t);
        return;
      }
      const data = await res.json();
      if (data.error) { setClaudeError(data.error); return; }
      if (data.content) store.addClaudeMessage({ role: "assistant", content: data.content });
    } catch (err: any) {
      setClaudeError("Erreur réseau");
    } finally {
      setClaudeSending(false);
    }
  }

  if (store.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#f5f5f7] to-[#e5e5ea]">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-gradient-to-br from-[#0071e3] to-[#0040a3] rounded-[18px] flex items-center justify-center mx-auto shadow-xl">
            <Building2 size={32} className="text-white" />
          </div>
          <p className="text-[#6e6e73] text-sm">Chargement du cabinet…</p>
        </div>
      </div>
    );
  }

  const tasksDispos = tasksPool.filter(t => !completedTasks.has(t.id) && store.player_level >= t.niveau_min).length;

  const navItems = [
    { id: "messages" as Tab, icon: Mail, label: "Messages", badge: unreadCount },
    { id: "equipe" as Tab, icon: Users, label: "Équipe" },
    { id: "agenda" as Tab, icon: Calendar, label: "Agenda" },
    { id: "tasks" as Tab, icon: ClipboardCheck, label: "Tâches", badge: tasksDispos },
    { id: "dossiers" as Tab, icon: FolderOpen, label: "Dossiers", badge: dossiersEnCours + dossiersSurveillance },
    { id: "dec" as Tab, icon: GraduationCap, label: "DEC Prep" },
  ];

  const filteredDossiers = dossiersFilter === "tous"
    ? store.dossiers
    : store.dossiers.filter(d => d.etat === dossiersFilter);

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#f5f5f7] via-[#fafafa] to-[#eeeef0] overflow-hidden">

      {/* ── SIDEBAR ── */}
      <aside className="w-60 glass border-r border-[#d2d2d7]/50 flex flex-col z-10">
        <div className="px-4 py-4 border-b border-[#d2d2d7]/40">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-gradient-to-br from-[#0071e3] to-[#0040a3] rounded-[10px] flex items-center justify-center shadow-md">
              <Building2 size={18} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-[14px] text-[#1d1d1f] leading-tight">Cabinet DEC</div>
              <div className="text-[10px] text-[#8e8e93]">Morel & Associés</div>
            </div>
          </div>

          {/* Horloge JEU */}
          <div className="mt-3 bg-gradient-to-r from-[#0071e3]/10 to-[#5e5ce6]/10 rounded-[10px] p-2.5 border border-[#0071e3]/15">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ClockIcon size={11} className="text-[#0071e3]" />
                <span className="text-[10px] font-medium text-[#0071e3] uppercase tracking-wide">Jour {store.game_day}</span>
              </div>
              <RealClock />
            </div>
            <div className="font-mono text-[24px] font-bold text-[#1d1d1f] tabular-nums leading-none mt-1">
              {String(store.game_hour).padStart(2, "0")}:{String(store.game_minute).padStart(2, "0")}
            </div>
            <div className="text-[9px] text-[#8e8e93] mt-0.5">{store.date_simulation}</div>
          </div>

          {/* Niveau joueur */}
          <div className="mt-2.5 bg-white/70 rounded-[10px] p-2.5 border border-[#d2d2d7]/40">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Trophy size={11} className="text-[#ff9f0a]" />
                <span className="text-[10px] font-semibold text-[#1d1d1f] uppercase">Niveau {store.player_level}</span>
              </div>
              <span className="text-[10px] text-[#6e6e73] tabular-nums">{store.player_xp}/{store.xp_to_next} XP</span>
            </div>
            <div className="h-[5px] bg-[#e5e5ea] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#ff9f0a] to-[#ff3b30] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (store.player_xp / store.xp_to_next) * 100)}%` }} />
            </div>
          </div>

          {/* Statut API */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5" title={apiStatusReason}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                apiStatus === "ok" ? "bg-[#34c759] animate-pulse" :
                apiStatus === "error" ? "bg-[#ff3b30]" :
                "bg-[#ff9f0a]"
              }`} />
              <span className={`text-[9px] font-medium ${
                apiStatus === "ok" ? "text-[#34c759]" :
                apiStatus === "error" ? "text-[#ff3b30]" :
                "text-[#ff9f0a]"
              }`}>
                {apiStatus === "ok" ? "IA Claude connectée" :
                 apiStatus === "error" ? "IA hors ligne" :
                 "Vérification…"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {generatingEvents && <RefreshCw size={9} className="text-[#0071e3] animate-spin" />}
              <button onClick={() => { setKeyInput(getUserApiKey() || ""); setShowKeyModal(true); }}
                title="Configurer ma clé API"
                className="p-0.5 rounded hover:bg-black/10 transition-all">
                <Settings size={11} className="text-[#6e6e73]" />
              </button>
            </div>
          </div>

          {apiStatus === "error" && (
            <button onClick={() => { setKeyInput(getUserApiKey() || ""); setShowKeyModal(true); }}
              className="mt-1.5 w-full text-left text-[9px] text-[#ff3b30] bg-[#ff3b30]/5 border border-[#ff3b30]/15 hover:bg-[#ff3b30]/10 rounded-md px-1.5 py-1 leading-tight transition-all flex items-center gap-1">
              <Key size={9} className="shrink-0" />
              <span className="flex-1 truncate">{apiStatusReason || "Configurer ma clé API"}</span>
            </button>
          )}
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map(({ id, icon: Icon, label, badge }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] transition-all ${activeTab === id ? "bg-gradient-to-r from-[#0071e3] to-[#0a84ff] text-white shadow-md" : "text-[#1d1d1f] hover:bg-black/5"}`}>
              <Icon size={16} />
              <span className="flex-1 text-left">{label}</span>
              {badge ? <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${activeTab === id ? "bg-white/25 text-white" : "bg-[#ff3b30] text-white"}`}>{badge}</span> : null}
            </button>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-[#d2d2d7]/40 space-y-2">
          <MiniStat label="Légitimité" value={store.legitimite} color="#0071e3" />
          <MiniStat label="Trésorerie" value={Math.min((store.tresorerie / 2000), 100)} color="#34c759" display={`${(store.tresorerie / 1000).toFixed(0)}k€`} />
          <MiniStat label="Réputation" value={store.reputation} color="#ff9f0a" />
          <MiniStat label="Stress" value={store.stress_global} color={store.stress_global > 70 ? "#ff3b30" : "#ff9f0a"} />
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-[#6e6e73]">Points d'Action</span>
            <div className="flex gap-1">
              {Array.from({ length: store.points_action_max }).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all ${i < store.points_action ? "bg-gradient-to-br from-[#0071e3] to-[#0040a3]" : "bg-[#d2d2d7]"}`} />
              ))}
            </div>
          </div>
          <div className="text-center py-1 px-2 bg-[#f5f5f7] rounded-lg">
            <span className="text-[10px] font-medium text-[#6e6e73]">Mood · {store.mood_global}</span>
          </div>

          {/* Calendrier fiscal — Échéances */}
          <div className="pt-2 mt-1 border-t border-[#d2d2d7]/30 space-y-1.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] font-semibold text-[#6e6e73] uppercase tracking-wider">Échéances fiscales</span>
              <Flame size={9} className="text-[#ff9f0a]" />
            </div>
            {store.fiscal_deadlines.map((d) => {
              const color = d.progression >= 80 ? "#34c759" : d.progression >= 50 ? "#ff9f0a" : "#ff3b30";
              const isBoss = d.campagne === "Bilan";
              const locked = d.depend_de && (store.fiscal_deadlines.find(x => x.id === d.depend_de)?.progression || 0) < 80;
              return (
                <div key={d.id} className={`${isBoss ? "bg-gradient-to-r from-[#ff3b30]/5 to-[#ff9f0a]/5 border border-[#ff3b30]/15 rounded-md p-1.5" : ""}`}>
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className={`text-[9px] truncate ${isBoss ? "font-semibold text-[#1d1d1f]" : "text-[#3a3a3c]"}`} title={d.label}>
                      {locked && <Lock size={7} className="inline mr-0.5 text-[#8e8e93]" />}
                      {d.label}
                    </span>
                    <span className="text-[8px] text-[#8e8e93] tabular-nums shrink-0">{d.echeance_label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-[3px] bg-[#e5e5ea] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${d.progression}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-[9px] font-medium tabular-nums w-7 text-right" style={{ color }}>
                      {Math.round(d.progression)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={() => { signOut(); router.push("/auth"); }}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-[#6e6e73] hover:text-[#ff3b30] transition-colors rounded-lg hover:bg-[#ff3b30]/5">
            <LogOut size={12} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* ── CONTENU ── */}
      <div className="flex-1 flex overflow-hidden">

        {activeTab === "messages" && (
          <>
            {/* Liste messages */}
            <div className="w-72 glass border-r border-[#d2d2d7]/50 flex flex-col">
              <div className="px-3 py-3 border-b border-[#d2d2d7]/40 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-[#1d1d1f]">Messagerie</h3>
                <span className="text-[10px] text-[#8e8e93]">{store.messages.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {conversationsByAgent.map(({ agent: a, lastMsg, unread, pendingMsg, messages }) => {
                  const display = pendingMsg || lastMsg;
                  const urgent = pendingMsg && pendingMsg.delai_reponse_heures <= 6;
                  const isSelected = selectedAgent === a.id;
                  return (
                    <div key={a.id}
                      onClick={() => handleSelectAgent(a.id, display.id)}
                      className={`group mx-2 mb-1 p-3 rounded-[14px] cursor-pointer transition-all ${isSelected ? "bg-gradient-to-r from-[#0071e3] to-[#0a84ff] text-white shadow-md" : unread === 0 ? "opacity-75 hover:bg-white/80" : "hover:bg-white/80"}`}>
                      <div className="flex items-start gap-2.5">
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shadow-sm" style={{ backgroundColor: a.avatar_color }}>
                            {a.initiales}
                          </div>
                          {pendingMsg && (
                            <div className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${isSelected ? "border-[#0071e3]" : "border-[#f5f5f7]"} ${getNiveauDot(pendingMsg.niveau)}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5 gap-1">
                            <span className={`text-[13px] font-semibold truncate ${isSelected ? "text-white" : "text-[#1d1d1f]"}`}>
                              {a.nom}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {unread > 0 && !isSelected && (
                                <span className="text-[9px] font-bold text-white bg-[#0071e3] rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center">{unread}</span>
                              )}
                              {urgent && (
                                <span className={`text-[10px] ${isSelected ? "text-red-200" : "text-[#ff3b30]"}`}>⚡ {pendingMsg!.delai_reponse_heures}h</span>
                              )}
                            </div>
                          </div>
                          <p className={`text-[12px] truncate mb-1 ${isSelected ? "text-white/80" : "text-[#6e6e73]"}`}>
                            {display.sujet}
                          </p>
                          <div className="flex items-center gap-1 flex-wrap">
                            {pendingMsg && (
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${
                                isSelected ? "bg-white/20 text-white" :
                                pendingMsg.niveau === "N5" ? "bg-[#ff3b30]/15 text-[#ff3b30]" :
                                pendingMsg.niveau === "N4" ? "bg-[#ff9f0a]/15 text-[#ff9f0a]" :
                                pendingMsg.niveau === "N3" ? "bg-[#ffd60a]/20 text-[#b07800]" :
                                "bg-[#0071e3]/10 text-[#0071e3]"}`}>
                                {pendingMsg.niveau}
                              </span>
                            )}
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${isSelected ? "bg-white/15 text-white" : "bg-[#f5f5f7] text-[#6e6e73]"}`}>
                              {messages.length} message{messages.length > 1 ? "s" : ""}
                            </span>
                            {!pendingMsg && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${isSelected ? "bg-white/15 text-white" : "bg-[#34c759]/10 text-[#34c759]"}`}>
                                À jour
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {conversationsByAgent.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-32 text-center px-4">
                    <p className="text-[12px] text-[#8e8e93]">Aucune conversation</p>
                    <p className="text-[10px] text-[#c7c7cc] mt-1">Les agents écrivent…</p>
                  </div>
                )}
              </div>
            </div>

            {/* Zone conversation */}
            <main className="flex-1 flex flex-col bg-white/40">
              {agent ? (
                <>
                  <header className="px-6 py-3.5 glass border-b border-[#d2d2d7]/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shadow-sm" style={{ backgroundColor: agent.avatar_color }}>
                        {agent.initiales}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-semibold text-[15px] text-[#1d1d1f]">{agent.nom}</h2>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            agent.statut === "En ligne" ? "bg-[#34c759]/15 text-[#34c759]" :
                            agent.statut === "Occupé" ? "bg-[#ff9f0a]/15 text-[#ff9f0a]" :
                            "bg-[#8e8e93]/15 text-[#8e8e93]"}`}>
                            {agent.statut}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#6e6e73]">{agent.role} · {agent.filiere}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <EmotionChip emotion={(agent as any).emotion || "Stable"} />
                      <StatChip label="Stress" value={agent.stress} warn={70} />
                      <StatChip label="Confiance" value={agent.confiance_joueur} invert />
                    </div>
                  </header>

                  <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                    {/* TOUS les messages reçus de l'agent, classés du + ancien au + récent */}
                    {store.messages
                      .filter(m => m.agent_id === agent.id)
                      .slice()
                      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                      .map((m) => (
                        <div key={m.id} className="flex gap-3 max-w-[78%]">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0 mt-1" style={{ backgroundColor: agent.avatar_color }}>
                            {agent.initiales}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-[11px] font-medium text-[#1d1d1f]">{agent.nom}</span>
                              <span className="text-[10px] text-[#8e8e93]">{new Date(m.timestamp).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                                m.niveau === "N5" ? "bg-[#ff3b30]/10 text-[#ff3b30]" :
                                m.niveau === "N4" ? "bg-[#ff9f0a]/10 text-[#ff9f0a]" :
                                m.niveau === "N3" ? "bg-[#ffd60a]/15 text-[#b07800]" :
                                "bg-[#0071e3]/10 text-[#0071e3]"}`}>
                                {getNiveauLabel(m.niveau)}
                              </span>
                              {m.phase && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${getPhaseColor(m.phase)}`}>
                                  {m.phase}
                                </span>
                              )}
                              {m.repondu && <span className="text-[9px] text-[#34c759]">✓ traité</span>}
                            </div>
                            <div className="bg-white rounded-[18px] rounded-tl-[6px] px-4 py-3 shadow-[0_1px_8px_rgba(0,0,0,0.08)] border border-[#d2d2d7]/30">
                              <p className="text-[13px] text-[#1d1d1f] leading-relaxed whitespace-pre-wrap">{m.contenu}</p>
                            </div>
                          </div>
                        </div>
                      ))}

                    {(store.conversation_history[agent.id] || []).map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "gap-3 max-w-[78%]"}`}>
                        {msg.role === "assistant" && (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0 mt-1" style={{ backgroundColor: agent.avatar_color }}>
                            {agent.initiales}
                          </div>
                        )}
                        <div className={`px-4 py-3 rounded-[18px] text-[13px] leading-relaxed whitespace-pre-wrap max-w-[75%] ${
                          msg.role === "user"
                            ? "bg-gradient-to-br from-[#0071e3] to-[#0a84ff] text-white rounded-br-[6px] shadow-md"
                            : "bg-white text-[#1d1d1f] rounded-tl-[6px] shadow-[0_1px_8px_rgba(0,0,0,0.08)] border border-[#d2d2d7]/30"
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}

                    {sending && (
                      <div className="flex gap-3 max-w-[78%]">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0" style={{ backgroundColor: agent.avatar_color }}>
                          {agent.initiales}
                        </div>
                        <div className="bg-white rounded-[18px] rounded-tl-[6px] px-4 py-3 shadow-[0_1px_8px_rgba(0,0,0,0.08)] border border-[#d2d2d7]/30">
                          <div className="flex gap-1 items-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#8e8e93] animate-bounce" style={{ animationDelay: "0ms" }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-[#8e8e93] animate-bounce" style={{ animationDelay: "150ms" }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-[#8e8e93] animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {scoreResult && (
                      <ScoreCard score={scoreResult} playerMessage={lastPlayerMessage} onClose={() => setScoreResult(null)} />
                    )}

                    {ghostVersions && !sending && (
                      <div className="space-y-2 py-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider flex items-center gap-1.5">
                            <Zap size={11} className="text-[#0071e3]" /> Ghost Writer — Choisis une version
                          </p>
                          <button onClick={handleDirectSend}
                            className="text-[10px] text-[#8e8e93] hover:text-[#ff3b30] flex items-center gap-1 transition-colors">
                            <Pencil size={10} /> Envoyer mon brouillon
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {ghostVersions.map((v) => (
                            <button key={v.label} onClick={() => handlePickVersion(v.text)}
                              className={`text-left p-3 rounded-[14px] border-2 ${v.color} hover:border-[#0071e3] hover:bg-[#0071e3]/5 transition-all group`}>
                              <div className="font-semibold text-[12px] text-[#1d1d1f] mb-0.5">{v.label}</div>
                              <div className="text-[10px] text-[#6e6e73] mb-1.5">{v.sublabel}</div>
                              <div className="text-[11px] text-[#3a3a3c] line-clamp-4">{v.text}</div>
                              <div className="flex items-center gap-1 mt-2 text-[10px] text-[#0071e3] opacity-0 group-hover:opacity-100 transition-opacity">
                                <CornerDownRight size={10} /> Utiliser
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>

                  <div className="px-6 py-3 glass border-t border-[#d2d2d7]/50">
                    {gwLoading && (
                      <div className="flex items-center gap-2 mb-2 text-[11px] text-[#6e6e73]">
                        <RefreshCw size={11} className="animate-spin text-[#0071e3]" />
                        Ghost Writer analyse ton brouillon…
                      </div>
                    )}
                    {apiError && (
                      <div className="flex items-center gap-2 mb-2 text-[11px] text-[#ff3b30] bg-[#ff3b30]/5 border border-[#ff3b30]/15 rounded-lg px-2 py-1">
                        <AlertTriangle size={11} /> {apiError}
                        <button onClick={() => setApiError("")} className="ml-auto opacity-60 hover:opacity-100"><X size={11} /></button>
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <div className={`flex-1 bg-white border rounded-[14px] px-4 py-2.5 shadow-sm transition-all ${
                        sending ? "border-[#d2d2d7]/40 opacity-60" : "border-[#d2d2d7]/80"
                      }`}>
                        <textarea
                          value={inputText}
                          onChange={(e) => {
                            if (sending) return;
                            setInputText(e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleDirectSend();
                            }
                          }}
                          disabled={sending}
                          placeholder={
                            sending ? `${agent.nom} rédige sa réponse…` :
                            ghostVersions ? "Choisis une version Ghost Writer ci-dessus, ou continue à écrire…" :
                            `Répondre à ${agent.nom}…  (↵ Envoyer · ✨ Ghost Writer)`
                          }
                          rows={1}
                          className="w-full text-[13px] text-[#1d1d1f] placeholder-[#8e8e93] outline-none resize-none leading-relaxed bg-transparent disabled:cursor-not-allowed"
                          style={{ minHeight: "20px" }}
                        />
                      </div>
                      <button
                        onClick={handleGhostDraft}
                        disabled={sending || gwLoading || !inputText.trim()}
                        title="Ghost Writer — 3 versions corrigées"
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 border ${
                          !sending && !gwLoading && inputText.trim()
                            ? "border-[#0071e3]/30 bg-[#0071e3]/5 text-[#0071e3] hover:bg-[#0071e3]/10"
                            : "border-[#e5e5ea] bg-white text-[#c7c7cc] cursor-not-allowed"}`}>
                        {gwLoading ? <div className="w-3 h-3 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin" /> : <Zap size={14} />}
                      </button>
                      <button
                        onClick={handleDirectSend}
                        disabled={sending || !inputText.trim()}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm shrink-0 ${
                          !sending && inputText.trim()
                            ? "bg-gradient-to-br from-[#0071e3] to-[#0040a3] hover:from-[#0077ed] hover:to-[#0050b3] text-white"
                            : "bg-[#e5e5ea] text-[#8e8e93] cursor-not-allowed"}`}>
                        {sending ? (
                          <div className="w-3 h-3 border-2 border-[#8e8e93] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Send size={15} />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-2 px-1">
                      <span className="text-[9px] text-[#8e8e93]">↵ Envoyer · <Zap size={8} className="inline" /> Ghost Writer · ⇧↵ Ligne</span>
                      <div className="flex gap-2 ml-auto">
                        {[["Précision","30%"],["Rédaction","20%"],["Déonto","20%"]].map(([l,p]) => (
                          <span key={l} className="text-[9px] text-[#c7c7cc]"><span className="text-[#8e8e93]">{l}</span> {p}</span>
                        ))}
                        {getPACost(selectedMessage?.niveau || "N1") > 0 && (
                          <span className="text-[10px] font-medium text-[#ff9f0a]">−{getPACost(selectedMessage?.niveau || "N1")} PA</span>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-[#f5f5f7] rounded-[20px] flex items-center justify-center mx-auto">
                      <Mail size={28} className="text-[#8e8e93]" />
                    </div>
                    <p className="text-[15px] font-semibold text-[#1d1d1f]">Sélectionne un message</p>
                    <p className="text-[13px] text-[#6e6e73]">{unreadCount} message{unreadCount > 1 ? "s" : ""} non lu{unreadCount > 1 ? "s" : ""}</p>
                  </div>
                </div>
              )}
            </main>
          </>
        )}

        {activeTab === "equipe" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-end justify-between mb-5">
              <div>
                <h2 className="text-[26px] font-bold text-[#1d1d1f] mb-1 tracking-tight">Équipe</h2>
                <p className="text-[13px] text-[#6e6e73]">{store.agents.length} collaborateurs · Cabinet Morel & Associés</p>
              </div>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {store.agents.map((a) => (
                <div key={a.id} className="bg-white rounded-[18px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-[#d2d2d7]/30 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold shadow-sm" style={{ backgroundColor: a.avatar_color }}>
                      {a.initiales}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[14px] text-[#1d1d1f] truncate">{a.nom}</div>
                      <div className="text-[11px] text-[#6e6e73] truncate">{a.role}</div>
                      <div className="mt-1"><EmotionChip emotion={(a as any).emotion || "Stable"} small /></div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <AgentBar label="Stress" value={a.stress} warn={70} />
                    <AgentBar label="Fatigue" value={a.fatigue} warn={70} />
                    <AgentBar label="Confiance" value={a.confiance_joueur} invert />
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#f5f5f7] flex items-center justify-between">
                    <span className="text-[10px] text-[#8e8e93] bg-[#f5f5f7] px-2 py-0.5 rounded-full">{a.filiere}</span>
                    <span className={`text-[10px] font-medium ${a.statut === "En ligne" ? "text-[#34c759]" : a.statut === "Occupé" ? "text-[#ff9f0a]" : "text-[#8e8e93]"}`}>{a.statut}</span>
                  </div>
                  {(a as any).arc_actuel && (a as any).arc_actuel !== "Stable" && (
                    <div className="mt-1.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                        (a as any).arc_actuel === "Rupture" ? "bg-[#ff3b30]/10 text-[#ff3b30]" :
                        (a as any).arc_actuel === "Trahison" ? "bg-[#ff9f0a]/10 text-[#ff9f0a]" :
                        (a as any).arc_actuel === "Crise" ? "bg-[#ff3b30]/10 text-[#ff3b30]" :
                        "bg-[#0071e3]/10 text-[#0071e3]"}`}>
                        Arc : {(a as any).arc_actuel}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "agenda" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-end justify-between mb-5">
                <div>
                  <h2 className="text-[26px] font-bold text-[#1d1d1f] mb-1 tracking-tight">Agenda du jour</h2>
                  <p className="text-[13px] text-[#6e6e73]">Jour {store.game_day} · {String(store.game_hour).padStart(2, "0")}:{String(store.game_minute).padStart(2, "0")} · Campagne Bilan & AG</p>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-[#8e8e93]">Cas pratiques validés</div>
                  <div className="text-[22px] font-bold text-[#34c759] tabular-nums">{completedSlots.size}/{agendaSlots.filter(s => s.type !== "pause").length}</div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#ff3b30]/8 to-[#ff9f0a]/8 border border-[#ff3b30]/20 rounded-[18px] p-4 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Flame size={16} className="text-[#ff3b30]" />
                  <span className="font-semibold text-[14px] text-[#1d1d1f]">Boss Fight — Clôture bilan 30/06</span>
                  <span className="ml-auto text-[13px] font-bold text-[#ff3b30]">J-16</span>
                </div>
                <p className="text-[12px] text-[#6e6e73]">Signature bilan Vidal Industrie · Provision risque client en suspens</p>
              </div>

              <div className="relative">
                <div className="absolute left-[68px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-[#d2d2d7]/0 via-[#d2d2d7] to-[#d2d2d7]/0" />
                <div className="space-y-2">
                  {agendaSlots.map((slot) => {
                    const slotMin = timeToMinutes(slot.heure);
                    const isPast = gameMinutes > slotMin + slot.duree_min;
                    const isActive = gameMinutes >= slotMin && gameMinutes <= slotMin + slot.duree_min;
                    const isFuture = gameMinutes < slotMin;
                    const isCompleted = completedSlots.has(slot.heure);
                    const Icon = getSlotIcon(slot.type);
                    const color = getSlotColor(slot.type);
                    const isLocked = store.player_level < slot.niveau_requis;
                    const canOpen = !isFuture && !isCompleted && slot.type !== "pause" && !isLocked;
                    const agent = slot.agent_id ? store.agents.find(a => a.id === slot.agent_id) : null;

                    return (
                      <div key={slot.heure} className="flex items-start gap-3 relative">
                        <div className="w-14 text-right pt-3 shrink-0">
                          <div className={`text-[13px] font-mono font-semibold tabular-nums ${isActive ? "text-[#0071e3]" : isFuture ? "text-[#c7c7cc]" : "text-[#1d1d1f]"}`}>
                            {slot.heure}
                          </div>
                          <div className="text-[9px] text-[#8e8e93]">{slot.duree_min}min</div>
                        </div>

                        <div className="relative shrink-0 pt-3">
                          <div className={`w-4 h-4 rounded-full border-2 transition-all ${
                            isCompleted ? "bg-[#34c759] border-[#34c759]" :
                            isActive ? "border-[#0071e3] bg-white animate-pulse" :
                            isPast ? "bg-[#e5e5ea] border-[#e5e5ea]" :
                            "border-[#c7c7cc] bg-white"
                          }`}>
                            {isCompleted && <CheckCircle size={10} className="text-white -mt-px -ml-px" />}
                          </div>
                        </div>

                        <button
                          onClick={() => canOpen && openCasePratique(slot)}
                          disabled={!canOpen}
                          className={`flex-1 text-left rounded-[14px] p-3 border transition-all ${
                            isCompleted ? "bg-[#34c759]/5 border-[#34c759]/20" :
                            isActive ? "bg-white border-[#0071e3]/40 shadow-md hover:shadow-lg cursor-pointer" :
                            isFuture ? "bg-white/40 border-[#d2d2d7]/30 opacity-60" :
                            isLocked ? "bg-[#f5f5f7] border-[#d2d2d7]/30 opacity-50 cursor-not-allowed" :
                            "bg-white border-[#d2d2d7]/40 hover:border-[#0071e3]/40 hover:shadow cursor-pointer"
                          }`}>
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15` }}>
                              <Icon size={14} style={{ color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-semibold text-[13px] text-[#1d1d1f]">{slot.titre}</span>
                                {isCompleted && <span className="text-[9px] font-medium text-[#34c759]">✓ Validé</span>}
                                {isActive && !isCompleted && <span className="text-[9px] font-semibold text-[#0071e3] bg-[#0071e3]/10 px-1.5 py-0.5 rounded-full animate-pulse">EN COURS</span>}
                                {isLocked && <span className="text-[9px] font-medium text-[#8e8e93]">🔒 Niveau {slot.niveau_requis}</span>}
                              </div>
                              <p className="text-[11px] text-[#6e6e73] truncate">{slot.theme}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                {agent && (
                                  <span className="flex items-center gap-1 text-[10px] text-[#8e8e93]">
                                    <div className="w-3 h-3 rounded-full text-white text-[7px] flex items-center justify-center font-semibold" style={{ backgroundColor: agent.avatar_color }}>
                                      {agent.initiales[0]}
                                    </div>
                                    {agent.nom}
                                  </span>
                                )}
                                {slot.xp_max > 0 && (
                                  <span className="text-[9px] font-medium text-[#ff9f0a] flex items-center gap-0.5">
                                    <Trophy size={9} /> +{slot.xp_max} XP max
                                  </span>
                                )}
                                <span className="text-[9px] text-[#8e8e93] ml-auto capitalize">{slot.type.replace("_", " ")}</span>
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
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-end justify-between mb-5">
                <div>
                  <h2 className="text-[26px] font-bold text-[#1d1d1f] mb-1 tracking-tight">Tâches — Validation pédagogique</h2>
                  <p className="text-[13px] text-[#6e6e73]">Documents préparés par l'équipe à contrôler. Détecte les erreurs DEC.</p>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-[#8e8e93]">Validés / Total</div>
                  <div className="text-[22px] font-bold text-[#34c759] tabular-nums">{completedTasks.size}/{tasksPool.length}</div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-[#0071e3]/8 to-[#5e5ce6]/8 border border-[#0071e3]/15 rounded-[14px] p-3 mb-4">
                <div className="flex items-start gap-2">
                  <FileSearch size={14} className="text-[#0071e3] mt-0.5 shrink-0" />
                  <p className="text-[12px] text-[#1d1d1f] leading-relaxed">
                    <strong>Examinateur DEC :</strong> tu dois identifier les erreurs cachées dans chaque document, ajouter une note de correction (cite les articles), puis décider Valider / Refuser / Déléguer.
                    <span className="text-[#0071e3] font-medium ml-1">+20 par erreur trouvée · −30 par erreur manquée · +10 Légitimité si score &gt;80%.</span>
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {tasksPool.map((task) => {
                  const isLocked = store.player_level < task.niveau_min;
                  const isDone = completedTasks.has(task.id);
                  const branchColor = task.branche === "Comptable" ? "#0071e3" : task.branche === "Fiscal" ? "#ff9f0a" : task.branche === "Audit & IFRS" ? "#bf5af2" : task.branche === "Social" ? "#34c759" : "#8e8e93";
                  return (
                    <button key={task.id}
                      onClick={() => !isLocked && !isDone && openTask(task)}
                      disabled={isLocked || isDone}
                      className={`w-full text-left rounded-[14px] p-4 border transition-all flex items-center gap-3 ${
                        isDone ? "bg-[#34c759]/5 border-[#34c759]/20 cursor-default" :
                        isLocked ? "bg-[#f5f5f7] border-[#d2d2d7]/30 opacity-50 cursor-not-allowed" :
                        "bg-white border-[#d2d2d7]/40 hover:border-[#0071e3]/40 hover:shadow cursor-pointer"
                      }`}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${branchColor}15` }}>
                        <ClipboardCheck size={18} style={{ color: branchColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-[14px] text-[#1d1d1f]">{task.titre}</span>
                          {isDone && <span className="text-[9px] font-semibold text-[#34c759] bg-[#34c759]/10 px-1.5 py-0.5 rounded-full">VALIDÉ</span>}
                          {isLocked && <span className="text-[9px] font-medium text-[#8e8e93] flex items-center gap-0.5"><Lock size={9} /> Niveau {task.niveau_min}</span>}
                        </div>
                        <p className="text-[11px] text-[#6e6e73] truncate mb-1">{task.client} · {task.contexte}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md" style={{ backgroundColor: `${branchColor}15`, color: branchColor }}>{task.branche}</span>
                          <span className="text-[9px] text-[#8e8e93]">{task.erreurs.length} erreur{task.erreurs.length > 1 ? "s" : ""} possible{task.erreurs.length > 1 ? "s" : ""}</span>
                          {task.ecriture_correction && <span className="text-[9px] text-[#0071e3] flex items-center gap-0.5"><Calculator size={9} /> Mini-jeu écriture</span>}
                        </div>
                      </div>
                      {!isLocked && !isDone && <ChevronRight size={14} className="text-[#c7c7cc] shrink-0" />}
                    </button>
                  );
                })}
                {tasksPool.length === 0 && (
                  <div className="text-center py-12 text-[#8e8e93]">
                    <ClipboardCheck size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-[13px]">Chargement des documents…</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "dossiers" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-end justify-between mb-4">
                <div>
                  <h2 className="text-[26px] font-bold text-[#1d1d1f] mb-1 tracking-tight">Dossiers clients</h2>
                  <p className="text-[13px] text-[#6e6e73]">Aperçu en temps réel · Les statuts évoluent selon ton travail et l'autonomie des agents</p>
                </div>
                <div className="flex gap-1.5">
                  <DossierStat label="En cours" value={dossiersEnCours} color="#0071e3" />
                  <DossierStat label="Surveille" value={dossiersSurveillance} color="#ff9f0a" />
                  <DossierStat label="Avancés" value={dossiersAvances} color="#34c759" />
                  <DossierStat label="Clôturés" value={dossiersClotures} color="#8e8e93" />
                  <DossierStat label="Perdus" value={dossiersPerdus} color="#ff3b30" />
                </div>
              </div>

              <div className="flex gap-1.5 mb-4 bg-[#f5f5f7] p-1 rounded-[12px] inline-flex flex-wrap">
                {(["en_cours", "surveillance", "avance", "cloture", "perdu", "tous"] as const).map(f => (
                  <button key={f} onClick={() => setDossiersFilter(f)}
                    className={`px-3 py-1.5 text-[12px] font-medium rounded-[8px] transition-all ${
                      dossiersFilter === f ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#6e6e73] hover:text-[#1d1d1f]"
                    }`}>
                    {f === "en_cours" ? "En cours" : f === "surveillance" ? "Surveillance" : f === "avance" ? "Avancés" : f === "cloture" ? "Clôturés" : f === "perdu" ? "Perdus" : "Tous"}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {filteredDossiers.map((d) => {
                  const a = store.agents.find(x => x.id === d.agent_id);
                  const statusMeta: Record<typeof d.etat, { label: string; color: string; bg: string; border: string }> = {
                    en_cours: { label: "EN COURS", color: "#0071e3", bg: "bg-[#0071e3]/15", border: "border-[#d2d2d7]/40" },
                    surveillance: { label: "EN SURVEILLANCE", color: "#ff9f0a", bg: "bg-[#ff9f0a]/15", border: "border-[#ff9f0a]/30" },
                    avance: { label: "AVANCÉ", color: "#34c759", bg: "bg-[#34c759]/15", border: "border-[#34c759]/30" },
                    cloture: { label: "CLÔTURÉ", color: "#8e8e93", bg: "bg-[#8e8e93]/15", border: "border-[#8e8e93]/30" },
                    perdu: { label: "PERDU", color: "#ff3b30", bg: "bg-[#ff3b30]/15", border: "border-[#ff3b30]/30" },
                  };
                  const meta = statusMeta[d.etat];
                  const recoverable = d.etat === "perdu" && d.recoverable_until && new Date(d.recoverable_until) > new Date();

                  return (
                    <div key={d.id} className={`bg-white rounded-[14px] p-4 border transition-all ${meta.border} ${d.is_vip ? "ring-2 ring-[#bf5af2]/30" : ""} ${
                      d.etat === "avance" ? "bg-[#34c759]/5" :
                      d.etat === "perdu" ? "bg-[#ff3b30]/5 opacity-80" :
                      d.etat === "surveillance" ? "bg-[#ff9f0a]/5" :
                      d.etat === "cloture" ? "bg-[#8e8e93]/5" :
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
                            <span className="font-semibold text-[14px] text-[#1d1d1f]">{d.client}</span>
                            {d.is_vip && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-gradient-to-r from-[#bf5af2] to-[#5e5ce6] text-white">⭐ VIP</span>
                            )}
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${getPhaseColor(d.phase)}`}>{d.phase}</span>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ml-auto ${meta.bg}`} style={{ color: meta.color }}>
                              {meta.label}
                            </span>
                          </div>
                          <p className="text-[12px] text-[#6e6e73] mb-2">{d.theme} · échéance {d.echeance_heure} · {d.cas_traites} cas traité{d.cas_traites > 1 ? "s" : ""}</p>

                          {/* Progression + Qualité côte à côte */}
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-[#8e8e93] w-14">Progression</span>
                              <div className="flex-1 h-[4px] bg-[#e5e5ea] rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{
                                  width: `${d.progression}%`,
                                  backgroundColor: meta.color,
                                }} />
                              </div>
                              <span className="text-[9px] font-semibold tabular-nums w-7 text-right" style={{ color: meta.color }}>{d.progression}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-[#8e8e93] w-14">Qualité</span>
                              <div className="flex-1 h-[4px] bg-[#e5e5ea] rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{
                                  width: `${d.qualite}%`,
                                  backgroundColor: d.qualite >= 70 ? "#34c759" : d.qualite >= 50 ? "#ff9f0a" : "#ff3b30",
                                }} />
                              </div>
                              <span className="text-[9px] font-semibold tabular-nums w-7 text-right" style={{ color: d.qualite >= 70 ? "#34c759" : d.qualite >= 50 ? "#ff9f0a" : "#ff3b30" }}>{d.qualite}%</span>
                            </div>
                          </div>

                          {/* Signaux d'alerte */}
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
                                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#ff9f0a]/10 text-[#ff9f0a] font-medium">
                                    {labels[s] || s}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Cause de la perte */}
                          {d.etat === "perdu" && d.cause_perte && (
                            <div className="bg-[#ff3b30]/8 border border-[#ff3b30]/15 rounded-[8px] p-2 mb-2">
                              <p className="text-[10px] text-[#ff3b30] font-medium">Cause : {d.cause_perte}</p>
                              {recoverable && (
                                <p className="text-[9px] text-[#6e6e73] mt-0.5">
                                  Récupération possible jusqu'au {new Date(d.recoverable_until!).toLocaleDateString("fr-FR")}
                                </p>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-3 text-[9px] text-[#8e8e93]">
                            <span>Gagné : <span className="text-[#34c759] font-medium">+{d.impact.legitimite * (d.is_vip ? 3 : 1)} Lég · +{((d.impact.tresorerie * (d.is_vip ? 3 : 1)) / 1000).toFixed(0)}k€</span></span>
                            <span>Perdu : <span className="text-[#ff3b30] font-medium">−{d.impact.reputation * (d.is_vip ? 3 : 1)} Rép · −{((d.impact.tresorerie * (d.is_vip ? 3 : 1)) / 2 / 1000).toFixed(1)}k€</span></span>
                          </div>

                          {/* Aperçu — indicateur narratif (pas d'action manuelle) */}
                          {(d.etat === "en_cours" || d.etat === "surveillance") && (
                            <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-[#8e8e93]">
                              <RefreshCw size={9} className="animate-spin" style={{ animationDuration: "3s" }} />
                              <span>
                                {d.etat === "surveillance"
                                  ? "Statut surveillé · agis sur l'agent ou réponds vite avant que le client ne parte"
                                  : a ? `${a.nom.split(" ")[0]} travaille de façon autonome — réponds aux messages pour accélérer` : "Avancement automatique"}
                              </span>
                            </div>
                          )}

                          {/* Seule action stratégique restante : tentative de récupération */}
                          {recoverable && (
                            <div className="mt-2.5">
                              <button onClick={() => {
                                  const ok = store.attemptRecoverDossier(d.id);
                                  if (!ok && store.points_action < 2) alert("Il te faut 2 PA pour tenter une récupération.");
                                  else if (!ok) alert("Tentative ratée. Le client refuse de revenir.");
                                }}
                                className="text-[11px] px-2.5 py-1 rounded-[8px] bg-gradient-to-r from-[#bf5af2]/15 to-[#0071e3]/15 text-[#bf5af2] hover:from-[#bf5af2]/25 hover:to-[#0071e3]/25 font-semibold transition-all flex items-center gap-1">
                                <Sparkles size={11} /> Tentative de récupération (2 PA · honoraires ×1,5)
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredDossiers.length === 0 && (
                  <div className="text-center py-12 text-[#8e8e93]">
                    <FolderOpen size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-[13px]">Aucun dossier dans cette catégorie</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "dec" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-end justify-between mb-5">
                <div>
                  <h2 className="text-[26px] font-bold text-[#1d1d1f] mb-1 tracking-tight">DEC Prep</h2>
                  <p className="text-[13px] text-[#6e6e73]">Niveau {store.player_level}/10 · {store.player_xp} XP · {store.dec_badges.length} badge{store.dec_badges.length > 1 ? "s" : ""}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end">
                    <Flame size={14} className="text-[#ff9f0a]" />
                    <span className="text-[22px] font-bold text-[#ff9f0a] tabular-nums">{store.dec_streak}</span>
                  </div>
                  <div className="text-[10px] text-[#6e6e73]">jours consécutifs</div>
                </div>
              </div>

              {/* Statut du jour */}
              <div className="bg-gradient-to-r from-[#0071e3]/8 to-[#5e5ce6]/8 border border-[#0071e3]/15 rounded-[16px] p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <ClockIcon size={14} className="text-[#0071e3]" />
                  <span className="font-semibold text-[13px] text-[#1d1d1f]">Aujourd'hui · Jour {store.game_day}</span>
                  <span className="ml-auto text-[11px] text-[#6e6e73]">
                    {(store.dec_today_deonto ? 1 : 0) + (store.dec_today_mission ? 1 : 0)}/2 modules complétés
                  </span>
                </div>
                <p className="text-[12px] text-[#3a3a3c] leading-relaxed">
                  L'objectif est simple : <strong>1 module Déontologie et 1 module Révision par jour</strong>. Pas de chronomètre, tu vas à ton rythme. Streak +1 par jour où tu valides au moins l'un des deux.
                </p>
              </div>

              {/* MODULE 1 — DÉONTOLOGIE */}
              <div className={`bg-white rounded-[18px] border-2 transition-all mb-3 overflow-hidden ${store.dec_today_deonto ? "border-[#34c759]/40 bg-[#34c759]/5" : "border-[#d2d2d7]/40 hover:border-[#0071e3]/30 hover:shadow-md"}`}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0 bg-gradient-to-br from-[#0071e3] to-[#5e5ce6] shadow-md">
                      <Award size={22} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-[15px] text-[#1d1d1f]">Épreuve 1 — Déontologie</h3>
                        {store.dec_today_deonto && (
                          <span className="text-[9px] font-semibold text-[#34c759] bg-[#34c759]/10 px-1.5 py-0.5 rounded-full">✓ FAIT AUJOURD'HUI</span>
                        )}
                      </div>
                      <p className="text-[12px] text-[#6e6e73] leading-relaxed">
                        <strong>QCM 20 questions</strong> · 10 EC + 10 CAC · Thèmes : exercice profession, éthique, contrôle qualité, responsabilité.
                        Inspiré du QCM réel de l'examen DEC à 10h30.
                      </p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-[10px] text-[#0071e3] bg-[#0071e3]/10 px-1.5 py-0.5 rounded-md font-medium">+8 Lég si 18/20</span>
                        <span className="text-[10px] text-[#ff9f0a] bg-[#ff9f0a]/10 px-1.5 py-0.5 rounded-md font-medium">+5 Lég si 14/20</span>
                        <span className="text-[10px] text-[#ff3b30] bg-[#ff3b30]/10 px-1.5 py-0.5 rounded-md font-medium">−15 Lég si &lt;6/20</span>
                        <span className="text-[10px] text-[#6e6e73] ml-auto">{deontoPool.length} questions au catalogue</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={startDeonto} disabled={deontoPool.length === 0}
                    className={`mt-3 w-full py-2.5 rounded-[12px] text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      deontoPool.length === 0 ? "bg-[#e5e5ea] text-[#8e8e93] cursor-not-allowed" :
                      store.dec_today_deonto ? "bg-[#34c759]/15 text-[#34c759] hover:bg-[#34c759]/20" :
                      "bg-gradient-to-br from-[#0071e3] to-[#0040a3] text-white shadow-md hover:shadow-lg"
                    }`}>
                    {store.dec_today_deonto ? <><RefreshCw size={13} /> Refaire le QCM (entraînement)</> : <><Sparkles size={13} /> Commencer le QCM du jour</>}
                  </button>
                </div>
              </div>

              {/* MODULE 2 — RÉVISION (MISSIONS) */}
              <div className={`bg-white rounded-[18px] border-2 transition-all mb-3 overflow-hidden ${store.dec_today_mission ? "border-[#34c759]/40 bg-[#34c759]/5" : "border-[#d2d2d7]/40"}`}>
                <div className="p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0 bg-gradient-to-br from-[#bf5af2] to-[#5e5ce6] shadow-md">
                      <FileSearch size={22} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-[15px] text-[#1d1d1f]">Épreuve 2 — Révision (Mission complète)</h3>
                        {store.dec_today_mission && (
                          <span className="text-[9px] font-semibold text-[#34c759] bg-[#34c759]/10 px-1.5 py-0.5 rounded-full">✓ FAIT AUJOURD'HUI</span>
                        )}
                      </div>
                      <p className="text-[12px] text-[#6e6e73] leading-relaxed">
                        <strong>Cas pratique 5 étapes</strong> : Acceptation · Planification · Contrôle interne · Procédures · Conclusion.
                        Méthode de rédaction DEC corrigée à chaque étape.
                      </p>
                    </div>
                  </div>

                  {/* Liste des missions */}
                  <div className="space-y-1.5 mt-3">
                    {missionsPool.map((m) => {
                      const done = store.dec_completed_mission_ids.includes(m.id);
                      const locked = m.difficulte > Math.max(2, Math.floor(store.player_level / 2) + 2);
                      return (
                        <button key={m.id} onClick={() => !locked && startMission(m)} disabled={locked}
                          className={`w-full text-left rounded-[10px] p-2.5 border transition-all flex items-center gap-2.5 ${
                            done ? "bg-[#34c759]/5 border-[#34c759]/20" :
                            locked ? "bg-[#f5f5f7] border-[#d2d2d7]/30 opacity-50 cursor-not-allowed" :
                            "bg-white border-[#d2d2d7]/40 hover:border-[#bf5af2]/40 hover:shadow-sm"
                          }`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[12px] font-medium text-[#1d1d1f] truncate">{m.titre}</span>
                              {done && <span className="text-[9px] text-[#34c759]">✓</span>}
                              {locked && <Lock size={9} className="text-[#8e8e93]" />}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#8e8e93]">
                              <span>{m.theme}</span>
                              <span>·</span>
                              <span>{"⭐".repeat(m.difficulte)}</span>
                            </div>
                          </div>
                          {!locked && !done && <ChevronRight size={12} className="text-[#c7c7cc]" />}
                        </button>
                      );
                    })}
                    {missionsPool.length === 0 && (
                      <p className="text-[11px] text-[#8e8e93] text-center py-4">Missions en cours de chargement…</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Badges */}
              {store.dec_badges.length > 0 && (
                <div className="bg-white rounded-[14px] p-3 border border-[#d2d2d7]/40 mb-3">
                  <div className="text-[10px] font-semibold text-[#8e8e93] uppercase tracking-wider mb-2">🏆 Badges débloqués</div>
                  <div className="flex flex-wrap gap-1.5">
                    {store.dec_badges.map((b) => (
                      <span key={b} className="text-[11px] font-medium text-[#ff9f0a] bg-gradient-to-br from-[#ff9f0a]/15 to-[#ff3b30]/15 px-2.5 py-1 rounded-full">{b}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Grille évaluation Ghost Writer */}
              <div className="bg-white rounded-[14px] p-4 border border-[#d2d2d7]/30">
                <p className="font-semibold text-[12px] text-[#1d1d1f] mb-2.5">Grille Ghost Writer (réponses aux agents)</p>
                <div className="space-y-1.5">
                  {[["Précision technique", 30, "#0071e3"],["Rédaction professionnelle", 20, "#34c759"],["Déontologie", 20, "#ff9f0a"],["Contexte & empathie", 15, "#bf5af2"],["Opérationnel", 15, "#ff3b30"]].map(([label, pts, color]) => (
                    <div key={label as string} className="flex items-center gap-3">
                      <span className="text-[10px] text-[#6e6e73] w-36">{label as string}</span>
                      <div className="flex-1 h-[3px] bg-[#f5f5f7] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(pts as number)}%`, backgroundColor: color as string }} />
                      </div>
                      <span className="text-[10px] font-semibold text-[#3a3a3c] w-6 text-right">{pts as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── MODAL CAS PRATIQUE ── */}
      {activeSlot && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#d2d2d7]/40 flex items-center justify-between bg-gradient-to-r from-[#0071e3]/5 to-[#5e5ce6]/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0071e3] to-[#0040a3] flex items-center justify-center shadow-md">
                  <GraduationCap size={18} className="text-white" />
                </div>
                <div>
                  <div className="font-semibold text-[15px] text-[#1d1d1f]">{activeSlot.titre}</div>
                  <div className="text-[11px] text-[#6e6e73]">{activeSlot.heure} · {activeSlot.duree_min}min · +{activeSlot.xp_max} XP max</div>
                </div>
              </div>
              <button onClick={closeCasePratique} className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] flex items-center justify-center transition-colors">
                <X size={14} className="text-[#6e6e73]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {caseLoading && (
                <div className="text-center py-12">
                  <RefreshCw size={28} className="text-[#0071e3] animate-spin mx-auto mb-3" />
                  <p className="text-[13px] text-[#6e6e73]">Génération du cas pratique…</p>
                </div>
              )}

              {activeCase && !caseCorrection && (
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] font-semibold text-[#0071e3] uppercase tracking-wider mb-1">Client</div>
                    <div className="text-[15px] font-bold text-[#1d1d1f]">{activeCase.client}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-[#8e8e93] uppercase tracking-wider mb-1">Contexte</div>
                    <p className="text-[13px] text-[#1d1d1f] leading-relaxed">{activeCase.contexte}</p>
                  </div>
                  <div className="bg-[#f5f5f7] rounded-[12px] p-4">
                    <div className="text-[10px] font-semibold text-[#1d1d1f] uppercase tracking-wider mb-2">Énoncé</div>
                    <p className="text-[13px] text-[#1d1d1f] leading-relaxed whitespace-pre-wrap">{activeCase.enonce}</p>
                  </div>
                  <div className="bg-[#0071e3]/5 border border-[#0071e3]/20 rounded-[12px] p-4">
                    <div className="text-[10px] font-semibold text-[#0071e3] uppercase tracking-wider mb-1">Question</div>
                    <p className="text-[14px] font-medium text-[#1d1d1f] leading-relaxed">{activeCase.question}</p>
                  </div>
                  <div>
                    <textarea
                      value={caseResponse}
                      onChange={(e) => setCaseResponse(e.target.value)}
                      placeholder="Ta réponse… (sois précis, cite les références techniques)"
                      rows={6}
                      className="w-full text-[13px] p-3 border border-[#d2d2d7] rounded-[12px] outline-none focus:border-[#0071e3] resize-none leading-relaxed"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-[#8e8e93]">Critères : {activeCase.criteres.join(" · ")}</span>
                      <button onClick={submitCaseResponse} disabled={!caseResponse.trim() || caseSubmitting}
                        className={`px-4 py-2 rounded-[10px] text-[13px] font-medium transition-all ${
                          caseResponse.trim() && !caseSubmitting
                            ? "bg-gradient-to-br from-[#0071e3] to-[#0040a3] text-white shadow-md hover:shadow-lg"
                            : "bg-[#e5e5ea] text-[#8e8e93] cursor-not-allowed"
                        }`}>
                        {caseSubmitting ? "Correction…" : "Soumettre ma réponse"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {caseCorrection && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="inline-flex flex-col items-center bg-gradient-to-br from-[#0071e3]/5 to-[#34c759]/5 rounded-[16px] p-5">
                      <div className="text-[56px] font-bold tabular-nums leading-none" style={{
                        color: caseCorrection.score >= 75 ? "#34c759" : caseCorrection.score >= 50 ? "#ff9f0a" : "#ff3b30"
                      }}>
                        {caseCorrection.score}
                      </div>
                      <div className="text-[13px] font-medium text-[#1d1d1f] mt-1">{caseCorrection.verdict}</div>
                      <div className="text-[11px] text-[#0071e3] mt-1 flex items-center gap-1">
                        <Sparkles size={11} /> +{caseCorrection.xp_gagne} XP
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#f5f5f7] rounded-[12px] p-3 flex gap-2 items-start">
                    <Zap size={14} className="text-[#0071e3] mt-0.5 shrink-0" />
                    <p className="text-[13px] text-[#1d1d1f] italic leading-relaxed">{caseCorrection.analogie}</p>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-[#0071e3] uppercase tracking-wider mb-2">Correction</div>
                    <p className="text-[13px] text-[#1d1d1f] leading-relaxed">{caseCorrection.correction}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-semibold text-[#34c759] uppercase tracking-wider mb-1.5">Points forts</div>
                      {caseCorrection.points_forts.map((p, i) => (
                        <p key={i} className="text-[12px] text-[#1d1d1f] flex gap-1.5 items-start mb-1">
                          <span className="text-[#34c759] font-bold mt-0.5">✓</span>{p}
                        </p>
                      ))}
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-[#0071e3] uppercase tracking-wider mb-1.5">À améliorer</div>
                      {caseCorrection.axes_amelioration.map((p, i) => (
                        <p key={i} className="text-[12px] text-[#1d1d1f] flex gap-1.5 items-start mb-1">
                          <span className="text-[#0071e3] font-bold mt-0.5">→</span>{p}
                        </p>
                      ))}
                    </div>
                  </div>
                  <button onClick={closeCasePratique}
                    className="w-full py-2.5 rounded-[10px] bg-gradient-to-br from-[#0071e3] to-[#0040a3] text-white font-medium text-[13px] shadow-md hover:shadow-lg transition-all">
                    Terminer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DÉONTOLOGIE (QCM 20 questions) ── */}
      {activeDeonto && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#d2d2d7]/40 flex items-center justify-between bg-gradient-to-r from-[#0071e3]/5 to-[#5e5ce6]/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0071e3] to-[#0040a3] flex items-center justify-center shadow-md">
                  <Award size={18} className="text-white" />
                </div>
                <div>
                  <div className="font-semibold text-[15px] text-[#1d1d1f]">Déontologie — QCM du jour</div>
                  <div className="text-[11px] text-[#6e6e73]">
                    {deontoResult ? "Résultat" : `Question ${deontoIndex + 1} / ${activeDeonto.length}`}
                  </div>
                </div>
              </div>
              <button onClick={closeDeonto} className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] flex items-center justify-center">
                <X size={14} className="text-[#6e6e73]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {!deontoResult && (() => {
                const q = activeDeonto[deontoIndex];
                if (!q) return null;
                const rep = deontoReponses[q.id];
                const isMulti = q.type === "qcm_multiple";
                return (
                  <div className="space-y-4">
                    {/* Progress bar */}
                    <div className="h-[3px] bg-[#e5e5ea] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#0071e3] to-[#5e5ce6] transition-all" style={{ width: `${((deontoIndex + 1) / activeDeonto.length) * 100}%` }} />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#0071e3]/10 text-[#0071e3]">{q.categorie}</span>
                      <span className="text-[10px] font-medium text-[#6e6e73]">{q.theme}</span>
                      <span className="text-[10px] text-[#8e8e93] ml-auto">
                        {q.type === "qcm_simple" ? "QCM simple" : q.type === "qcm_multiple" ? "QCM multiple" : q.type === "vrai_faux" ? "Vrai/Faux" : "Réponse courte"}
                      </span>
                    </div>

                    <p className="text-[14px] text-[#1d1d1f] leading-relaxed font-medium">{q.question}</p>

                    {q.type === "qrc" ? (
                      <textarea
                        value={rep?.texte || ""}
                        onChange={(e) => setDeontoText(q.id, e.target.value)}
                        rows={4}
                        placeholder="Ta réponse (cite les références, articles, normes…)"
                        className="w-full text-[13px] p-3 border border-[#d2d2d7] rounded-[12px] outline-none focus:border-[#0071e3] resize-none leading-relaxed"
                      />
                    ) : (
                      <div className="space-y-1.5">
                        {(q.options || []).map((opt, i) => {
                          const selected = (rep?.selected || []).includes(i);
                          return (
                            <button key={i} onClick={() => toggleDeontoOption(q.id, i, isMulti)}
                              className={`w-full text-left px-3 py-2.5 rounded-[10px] border-2 transition-all flex items-start gap-2.5 ${
                                selected ? "border-[#0071e3] bg-[#0071e3]/5" : "border-[#d2d2d7]/60 hover:border-[#0071e3]/40 hover:bg-[#f5f5f7]"
                              }`}>
                              <div className={`w-5 h-5 rounded-${isMulti ? "[4px]" : "full"} border-2 flex items-center justify-center shrink-0 mt-0.5 ${selected ? "border-[#0071e3] bg-[#0071e3]" : "border-[#c7c7cc]"}`}>
                                {selected && <CheckCircle size={10} className="text-white" />}
                              </div>
                              <span className="text-[13px] text-[#1d1d1f]">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {isMulti && <p className="text-[10px] text-[#8e8e93] italic">Plusieurs réponses possibles</p>}
                  </div>
                );
              })()}

              {deontoResult && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="inline-flex flex-col items-center bg-gradient-to-br from-[#0071e3]/5 to-[#34c759]/5 rounded-[16px] p-5">
                      <div className="text-[56px] font-bold tabular-nums leading-none" style={{
                        color: deontoResult.score_20 >= 14 ? "#34c759" : deontoResult.score_20 >= 10 ? "#ff9f0a" : "#ff3b30"
                      }}>
                        {deontoResult.score_20}<span className="text-[24px] text-[#6e6e73]">/20</span>
                      </div>
                      <div className="text-[12px] text-[#6e6e73] mt-1">{deontoResult.pct}% de réussite</div>
                      {deontoResult.badge && (
                        <div className="mt-2 text-[12px] font-bold text-[#ff9f0a] bg-gradient-to-br from-[#ff9f0a]/15 to-[#ff3b30]/15 px-3 py-1 rounded-full">
                          🏆 {deontoResult.badge}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-[11px] mt-2">
                        <span className="text-[#34c759]">+{deontoResult.xp_gagne} XP</span>
                        <span className={deontoResult.impact_legitimite > 0 ? "text-[#34c759]" : deontoResult.impact_legitimite < 0 ? "text-[#ff3b30]" : "text-[#6e6e73]"}>
                          {deontoResult.impact_legitimite > 0 ? "+" : ""}{deontoResult.impact_legitimite} Légitimité
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#f5f5f7] rounded-[12px] p-3">
                    <p className="text-[12px] text-[#1d1d1f] italic leading-relaxed">"{deontoResult.synthese}"</p>
                  </div>

                  <div>
                    <div className="text-[10px] font-semibold text-[#8e8e93] uppercase tracking-wider mb-2">Détail question par question</div>
                    <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                      {deontoResult.detail.map((d, i) => (
                        <details key={d.question_id} className={`rounded-[10px] border p-2.5 ${d.is_correct ? "border-[#34c759]/30 bg-[#34c759]/5" : "border-[#ff3b30]/30 bg-[#ff3b30]/5"}`}>
                          <summary className="cursor-pointer flex items-center gap-2 text-[11px] font-medium">
                            <span className={d.is_correct ? "text-[#34c759]" : "text-[#ff3b30]"}>
                              {d.is_correct ? "✓" : "✗"} Q{i + 1}
                            </span>
                            <span className="text-[#3a3a3c] truncate flex-1">{d.question}</span>
                            <span className="text-[10px] text-[#8e8e93]">{d.points_obtenus.toFixed(1)}/{d.points_max}</span>
                          </summary>
                          <div className="mt-2 space-y-1">
                            <p className="text-[11px] text-[#6e6e73]">{d.feedback}</p>
                            <p className="text-[10px] text-[#3a3a3c] italic bg-white/70 rounded p-1.5">{d.explication}</p>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>

                  <button onClick={closeDeonto}
                    className="w-full py-2.5 rounded-[10px] bg-gradient-to-br from-[#0071e3] to-[#0040a3] text-white font-medium text-[13px] shadow-md">
                    Terminer
                  </button>
                </div>
              )}
            </div>

            {!deontoResult && (
              <div className="px-5 py-3 bg-[#fafafa] border-t border-[#d2d2d7]/40 flex items-center gap-2">
                <button onClick={() => setDeontoIndex(Math.max(0, deontoIndex - 1))} disabled={deontoIndex === 0}
                  className="px-3 py-1.5 text-[12px] rounded-[8px] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea] disabled:opacity-40 disabled:cursor-not-allowed">
                  ← Précédent
                </button>
                <span className="text-[11px] text-[#8e8e93] mx-auto tabular-nums">
                  {Object.keys(deontoReponses).length} / {activeDeonto.length} répondues
                </span>
                {deontoIndex < activeDeonto.length - 1 ? (
                  <button onClick={() => setDeontoIndex(deontoIndex + 1)}
                    className="px-3 py-1.5 text-[12px] rounded-[8px] bg-[#0071e3] text-white">
                    Suivant →
                  </button>
                ) : (
                  <button onClick={submitDeonto} disabled={deontoSubmitting}
                    className="px-4 py-1.5 text-[12px] font-semibold rounded-[8px] bg-gradient-to-br from-[#34c759] to-[#0071e3] text-white shadow-md flex items-center gap-1.5">
                    {deontoSubmitting ? <><RefreshCw size={11} className="animate-spin" /> Correction…</> : <><CheckCircle size={11} /> Valider mes 20 réponses</>}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL MISSION (5 étapes) ── */}
      {activeMission && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#d2d2d7]/40 flex items-center justify-between bg-gradient-to-r from-[#bf5af2]/5 to-[#5e5ce6]/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#bf5af2] to-[#5e5ce6] flex items-center justify-center shadow-md">
                  <FileSearch size={18} className="text-white" />
                </div>
                <div>
                  <div className="font-semibold text-[15px] text-[#1d1d1f]">{activeMission.titre}</div>
                  <div className="text-[11px] text-[#6e6e73]">
                    {missionResult ? "Résultat" : `${activeMission.client} · Étape ${missionEtapeIndex + 1} / ${activeMission.etapes.length}`}
                  </div>
                </div>
              </div>
              <button onClick={closeMission} className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] flex items-center justify-center">
                <X size={14} className="text-[#6e6e73]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {!missionResult && (() => {
                const etape = activeMission.etapes[missionEtapeIndex];
                if (!etape) return null;
                return (
                  <div className="space-y-4">
                    {missionEtapeIndex === 0 && (
                      <div className="bg-[#f5f5f7] rounded-[12px] p-3">
                        <div className="text-[10px] font-semibold text-[#bf5af2] uppercase tracking-wider mb-1">Contexte</div>
                        <p className="text-[12px] text-[#1d1d1f] leading-relaxed">{activeMission.contexte}</p>
                      </div>
                    )}

                    <div className="h-[3px] bg-[#e5e5ea] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#bf5af2] to-[#5e5ce6] transition-all" style={{ width: `${((missionEtapeIndex + 1) / activeMission.etapes.length) * 100}%` }} />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-md bg-gradient-to-r from-[#bf5af2] to-[#5e5ce6]">ÉTAPE {etape.numero}</span>
                      <span className="text-[13px] font-semibold text-[#1d1d1f]">{etape.label}</span>
                      <span className="text-[10px] text-[#8e8e93] ml-auto">/{etape.points_max} points</span>
                    </div>

                    <div className="bg-[#bf5af2]/5 border border-[#bf5af2]/20 rounded-[10px] p-3">
                      <p className="text-[13px] text-[#1d1d1f] leading-relaxed">{etape.consigne}</p>
                    </div>

                    <textarea
                      value={missionReponses[etape.numero] || ""}
                      onChange={(e) => setMissionText(etape.numero, e.target.value)}
                      rows={8}
                      placeholder="Ta réponse — style EC (cite les NEP, normes, articles…). Évite les tournures familières."
                      className="w-full text-[13px] p-3 border border-[#d2d2d7] rounded-[12px] outline-none focus:border-[#bf5af2] resize-none leading-relaxed"
                    />

                    <div className="text-[10px] text-[#8e8e93] bg-[#f5f5f7] rounded p-2">
                      💡 <strong>Méthode DEC</strong> : « je constate », « je recommande à la direction », « il apparaît que », « ne permet pas de garantir ». Évite « je pense », « c'est mal », « j'ai vu ».
                    </div>
                  </div>
                );
              })()}

              {missionResult && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="inline-flex flex-col items-center bg-gradient-to-br from-[#bf5af2]/5 to-[#34c759]/5 rounded-[16px] p-5">
                      <div className="text-[56px] font-bold tabular-nums leading-none" style={{
                        color: missionResult.score_pct >= 75 ? "#34c759" : missionResult.score_pct >= 50 ? "#ff9f0a" : "#ff3b30"
                      }}>
                        {missionResult.score_20}<span className="text-[24px] text-[#6e6e73]">/20</span>
                      </div>
                      <div className="text-[12px] text-[#6e6e73] mt-1">{missionResult.score_pct}% · {missionResult.total.toFixed(1)}/{missionResult.total_max} points</div>
                      <div className="flex items-center gap-3 text-[11px] mt-2">
                        <span className="text-[#34c759]">+{missionResult.xp_gagne} XP</span>
                        <span className={missionResult.impact_legitimite > 0 ? "text-[#34c759]" : missionResult.impact_legitimite < 0 ? "text-[#ff3b30]" : "text-[#6e6e73]"}>
                          {missionResult.impact_legitimite > 0 ? "+" : ""}{missionResult.impact_legitimite} Légitimité
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#f5f5f7] rounded-[12px] p-3">
                    <p className="text-[12px] text-[#1d1d1f] italic leading-relaxed">"{missionResult.synthese}"</p>
                  </div>

                  <div className="space-y-2">
                    {missionResult.detail.map((d) => (
                      <div key={d.numero} className={`rounded-[12px] border p-3 ${d.points_obtenus >= d.points_max * 0.7 ? "border-[#34c759]/30 bg-[#34c759]/5" : d.points_obtenus >= d.points_max * 0.4 ? "border-[#ff9f0a]/30 bg-[#ff9f0a]/5" : "border-[#ff3b30]/30 bg-[#ff3b30]/5"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold text-white px-1.5 py-0.5 rounded bg-gradient-to-r from-[#bf5af2] to-[#5e5ce6]">É{d.numero}</span>
                          <span className="text-[12px] font-semibold text-[#1d1d1f]">{d.label}</span>
                          <span className="text-[11px] font-mono tabular-nums ml-auto">{d.points_obtenus.toFixed(1)} / {d.points_max} pts</span>
                        </div>
                        <p className="text-[11px] text-[#3a3a3c] leading-relaxed">{d.feedback}</p>
                        <p className="text-[10px] text-[#8e8e93] mt-1">Vocabulaire DEC : {d.mots_cles_trouves}/{d.mots_cles_total} termes attendus</p>
                        {d.correction_style && (
                          <div className="mt-1.5 bg-white/80 rounded-md p-2 border border-[#0071e3]/20">
                            <p className="text-[9px] font-semibold text-[#0071e3] uppercase tracking-wider mb-0.5">Correction style EC</p>
                            <p className="text-[11px] text-[#3a3a3c]">{d.correction_style}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <button onClick={closeMission}
                    className="w-full py-2.5 rounded-[10px] bg-gradient-to-br from-[#bf5af2] to-[#0040a3] text-white font-medium text-[13px] shadow-md">
                    Terminer
                  </button>
                </div>
              )}
            </div>

            {!missionResult && (
              <div className="px-5 py-3 bg-[#fafafa] border-t border-[#d2d2d7]/40 flex items-center gap-2">
                <button onClick={() => setMissionEtapeIndex(Math.max(0, missionEtapeIndex - 1))} disabled={missionEtapeIndex === 0}
                  className="px-3 py-1.5 text-[12px] rounded-[8px] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea] disabled:opacity-40">
                  ← Précédent
                </button>
                <span className="text-[11px] text-[#8e8e93] mx-auto tabular-nums">
                  Étape {missionEtapeIndex + 1}/{activeMission.etapes.length}
                </span>
                {missionEtapeIndex < activeMission.etapes.length - 1 ? (
                  <button onClick={() => setMissionEtapeIndex(missionEtapeIndex + 1)}
                    className="px-3 py-1.5 text-[12px] rounded-[8px] bg-[#bf5af2] text-white">
                    Suivant →
                  </button>
                ) : (
                  <button onClick={submitMission} disabled={missionSubmitting}
                    className="px-4 py-1.5 text-[12px] font-semibold rounded-[8px] bg-gradient-to-br from-[#bf5af2] to-[#0040a3] text-white shadow-md flex items-center gap-1.5">
                    {missionSubmitting ? <><RefreshCw size={11} className="animate-spin" /> Évaluation…</> : <><CheckCircle size={11} /> Soumettre la mission</>}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL TASK (validation pédagogique) ── */}
      {activeTask && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#d2d2d7]/40 flex items-center justify-between bg-gradient-to-r from-[#0071e3]/5 to-[#5e5ce6]/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0071e3] to-[#0040a3] flex items-center justify-center shadow-md">
                  <ClipboardCheck size={18} className="text-white" />
                </div>
                <div>
                  <div className="font-semibold text-[15px] text-[#1d1d1f]">{activeTask.titre}</div>
                  <div className="text-[11px] text-[#6e6e73]">{activeTask.client} · Branche {activeTask.branche}</div>
                </div>
              </div>
              <button onClick={closeTask} className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] flex items-center justify-center transition-colors">
                <X size={14} className="text-[#6e6e73]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {!taskResult && (
                <>
                  <div className="bg-[#f5f5f7] rounded-[12px] p-3 mb-4">
                    <div className="text-[10px] font-semibold text-[#0071e3] uppercase tracking-wider mb-1">Contexte</div>
                    <p className="text-[12px] text-[#1d1d1f] leading-relaxed">{activeTask.contexte}</p>
                  </div>

                  <div className="text-[10px] font-semibold text-[#8e8e93] uppercase tracking-wider mb-2">
                    Document · clique sur les lignes suspectes
                  </div>
                  <div className="bg-white border border-[#d2d2d7]/60 rounded-[12px] overflow-hidden mb-4">
                    {activeTask.lignes.map((ligne, i) => {
                      const flagged = taskFlaggedLines.has(i);
                      return (
                        <button key={i} onClick={() => toggleTaskLine(i)}
                          className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 border-b border-[#d2d2d7]/30 last:border-0 transition-all ${
                            flagged ? "bg-[#ff9f0a]/10 border-l-4 border-l-[#ff9f0a]" : "hover:bg-[#f5f5f7]"
                          }`}>
                          <div className="flex items-start gap-2 min-w-0">
                            <span className={`text-[9px] tabular-nums font-mono ${flagged ? "text-[#ff9f0a]" : "text-[#c7c7cc]"} mt-0.5`}>L{i + 1}</span>
                            <span className={`text-[12px] ${flagged ? "text-[#1d1d1f] font-medium" : "text-[#3a3a3c]"}`}>{ligne.label}</span>
                          </div>
                          <span className={`text-[12px] font-mono tabular-nums shrink-0 ${flagged ? "text-[#ff9f0a] font-semibold" : "text-[#1d1d1f]"}`}>{ligne.valeur}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mb-4">
                    <div className="text-[10px] font-semibold text-[#8e8e93] uppercase tracking-wider mb-1.5">
                      Note de correction (optionnelle, +20 pts si précise)
                    </div>
                    <textarea
                      value={taskNote}
                      onChange={(e) => setTaskNote(e.target.value)}
                      placeholder="Ex : « L'amende de 450€ est non déductible (art. 39-2 CGI). À réintégrer extra-comptablement. »"
                      rows={3}
                      className="w-full text-[12px] p-3 border border-[#d2d2d7] rounded-[10px] outline-none focus:border-[#0071e3] resize-none leading-relaxed"
                    />
                    <p className="text-[9px] text-[#8e8e93] mt-1">Cite les articles (CGI, PCG, IFRS, BOFiP…) pour maximiser ton score.</p>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => submitTask("valider")} disabled={taskSubmitting}
                      className="flex-1 py-2.5 rounded-[10px] bg-[#34c759]/10 text-[#34c759] hover:bg-[#34c759]/15 font-medium text-[12px] transition-all flex items-center justify-center gap-1.5">
                      <CheckCircle size={13} /> Valider
                    </button>
                    <button onClick={() => submitTask("refuser")} disabled={taskSubmitting}
                      className="flex-1 py-2.5 rounded-[10px] bg-[#ff3b30]/10 text-[#ff3b30] hover:bg-[#ff3b30]/15 font-medium text-[12px] transition-all flex items-center justify-center gap-1.5">
                      <X size={13} /> Refuser avec correction
                    </button>
                    <button onClick={() => submitTask("deleguer")} disabled={taskSubmitting}
                      className="flex-1 py-2.5 rounded-[10px] bg-[#8e8e93]/10 text-[#6e6e73] hover:bg-[#8e8e93]/15 font-medium text-[12px] transition-all flex items-center justify-center gap-1.5">
                      <CornerDownRight size={13} /> Déléguer
                    </button>
                  </div>
                </>
              )}

              {taskResult && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="inline-flex flex-col items-center bg-gradient-to-br from-[#0071e3]/5 to-[#34c759]/5 rounded-[16px] p-5">
                      <div className="text-[56px] font-bold tabular-nums leading-none" style={{
                        color: taskResult.score >= 80 ? "#34c759" : taskResult.score >= 50 ? "#ff9f0a" : "#ff3b30"
                      }}>
                        {taskResult.score}
                      </div>
                      <div className="text-[13px] font-medium text-[#1d1d1f] mt-1">Score Examinateur DEC</div>
                      <div className="flex items-center gap-3 text-[11px] mt-2">
                        <span className="text-[#34c759]">+{taskResult.xp_gagne} XP</span>
                        {taskResult.impact_legitimite !== 0 && (
                          <span className={taskResult.impact_legitimite > 0 ? "text-[#34c759]" : "text-[#ff3b30]"}>
                            {taskResult.impact_legitimite > 0 ? "+" : ""}{taskResult.impact_legitimite} Légitimité
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#f5f5f7] rounded-[12px] p-3">
                    <p className="text-[12px] text-[#1d1d1f] italic leading-relaxed">"{taskResult.feedback_general}"</p>
                  </div>

                  {/* Analyse détaillée Claude de la note rédigée par le joueur */}
                  {taskResult.analyse_note && (
                    <div className="bg-gradient-to-br from-[#0071e3]/5 to-[#5e5ce6]/5 border border-[#0071e3]/20 rounded-[12px] p-3">
                      <div className="flex items-start gap-2">
                        <Sparkles size={13} className="text-[#0071e3] mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[10px] font-semibold text-[#0071e3] uppercase tracking-wider mb-1">
                            Analyse critique de ta note rédigée {taskResult.note_score_claude !== null && <span className="text-[#1d1d1f]">({taskResult.note_score_claude}/20)</span>}
                          </div>
                          <p className="text-[12px] text-[#1d1d1f] leading-relaxed whitespace-pre-wrap">{taskResult.analyse_note}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {taskResult.erreurs_trouvees.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-[#34c759] uppercase tracking-wider mb-2">✓ Erreurs trouvées (+20 chacune)</div>
                      {taskResult.erreurs_trouvees.map((e, i) => (
                        <div key={i} className="bg-[#34c759]/5 border border-[#34c759]/20 rounded-[10px] p-2.5 mb-1.5">
                          <p className="text-[12px] font-medium text-[#1d1d1f]">L{e.ligne_index + 1} · {e.description}</p>
                          <p className="text-[10px] text-[#6e6e73] mt-0.5">{e.reference_legale}</p>
                          <p className="text-[11px] text-[#3a3a3c] mt-1 leading-relaxed">{e.correction}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {taskResult.erreurs_manquees.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-[#ff3b30] uppercase tracking-wider mb-2">✗ Erreurs manquées (−30 chacune)</div>
                      {taskResult.erreurs_manquees.map((e, i) => (
                        <div key={i} className="bg-[#ff3b30]/5 border border-[#ff3b30]/20 rounded-[10px] p-2.5 mb-1.5">
                          <p className="text-[12px] font-medium text-[#1d1d1f]">L{e.ligne_index + 1} · {e.description}</p>
                          <p className="text-[10px] text-[#6e6e73] mt-0.5">{e.reference_legale}</p>
                          <p className="text-[11px] text-[#3a3a3c] mt-1 leading-relaxed">{e.correction}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {taskResult.fausses_alertes.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-[#ff9f0a] uppercase tracking-wider mb-2">⚠ Fausses alertes (−10 chacune)</div>
                      <p className="text-[11px] text-[#6e6e73]">Lignes signalées à tort : {taskResult.fausses_alertes.map(i => `L${i + 1}`).join(", ")}</p>
                    </div>
                  )}

                  {taskResult.ecriture_eval && (
                    <div className={`rounded-[12px] p-3 ${taskResult.ecriture_eval.ok ? "bg-[#34c759]/5 border border-[#34c759]/20" : "bg-[#ff3b30]/5 border border-[#ff3b30]/20"}`}>
                      <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: taskResult.ecriture_eval.ok ? "#34c759" : "#ff3b30" }}>
                        Écriture comptable {taskResult.ecriture_eval.ok ? "validée ✓" : "à revoir ✗"}
                      </div>
                      <p className="text-[12px] text-[#1d1d1f]">{taskResult.ecriture_eval.feedback}</p>
                    </div>
                  )}

                  <button onClick={closeTask}
                    className="w-full py-2.5 rounded-[10px] bg-gradient-to-br from-[#0071e3] to-[#0040a3] text-white font-medium text-[13px] shadow-md hover:shadow-lg transition-all">
                    Terminer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ÉCRITURE COMPTABLE (mini-jeu) ── */}
      {showEcritureModal && activeTask?.ecriture_correction && (
        <div className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-[#d2d2d7]/40 bg-gradient-to-r from-[#0071e3]/5 to-[#34c759]/5 flex items-center gap-2.5">
              <Calculator size={16} className="text-[#0071e3]" />
              <div>
                <h3 className="font-semibold text-[14px] text-[#1d1d1f]">Écriture de correction</h3>
                <p className="text-[11px] text-[#6e6e73]">Propose l'écriture comptable de la régularisation</p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-[#6e6e73] uppercase tracking-wider block mb-1">Compte Débit</label>
                  <input value={ecritureDebit} onChange={e => setEcritureDebit(e.target.value)}
                    placeholder="Ex : 658"
                    className="w-full text-[13px] p-2 border border-[#d2d2d7] rounded-[8px] outline-none focus:border-[#0071e3] font-mono tabular-nums" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-[#6e6e73] uppercase tracking-wider block mb-1">Compte Crédit</label>
                  <input value={ecritureCredit} onChange={e => setEcritureCredit(e.target.value)}
                    placeholder="Ex : 707"
                    className="w-full text-[13px] p-2 border border-[#d2d2d7] rounded-[8px] outline-none focus:border-[#0071e3] font-mono tabular-nums" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#6e6e73] uppercase tracking-wider block mb-1">Montant (€)</label>
                <input value={ecritureMontant} onChange={e => setEcritureMontant(e.target.value)} type="number"
                  placeholder="Ex : 1770"
                  className="w-full text-[13px] p-2 border border-[#d2d2d7] rounded-[8px] outline-none focus:border-[#0071e3] tabular-nums" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[#6e6e73] uppercase tracking-wider block mb-1">Libellé</label>
                <input value={ecritureLibelle} onChange={e => setEcritureLibelle(e.target.value)}
                  placeholder="Ex : Réintégration extra-comptable"
                  className="w-full text-[13px] p-2 border border-[#d2d2d7] rounded-[8px] outline-none focus:border-[#0071e3]" />
              </div>
              <p className="text-[10px] text-[#8e8e93] leading-relaxed">
                Bonus : +5 Légitimité si écriture parfaite · −10 si imprécise (ton équipe doit refaire = coût trésorerie)
              </p>
            </div>
            <div className="px-5 py-3 bg-[#fafafa] border-t border-[#d2d2d7]/40 flex gap-2">
              <button onClick={() => setShowEcritureModal(false)}
                className="px-3 py-2 text-[12px] rounded-[10px] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea] transition-all">
                Annuler
              </button>
              <button onClick={() => submitTask("refuser")} disabled={!ecritureDebit || !ecritureCredit || !ecritureMontant || taskSubmitting}
                className={`ml-auto px-4 py-2 text-[12px] font-medium rounded-[10px] transition-all flex items-center gap-1.5 ${
                  ecritureDebit && ecritureCredit && ecritureMontant && !taskSubmitting
                    ? "bg-gradient-to-br from-[#0071e3] to-[#0040a3] text-white shadow-md"
                    : "bg-[#e5e5ea] text-[#8e8e93] cursor-not-allowed"
                }`}>
                {taskSubmitting ? <><RefreshCw size={11} className="animate-spin" /> Évaluation…</> : "Soumettre"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIGURATION CLÉ API ── */}
      {showKeyModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[22px] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-[#d2d2d7]/40 bg-gradient-to-r from-[#0071e3]/5 to-[#5e5ce6]/5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0071e3] to-[#0040a3] flex items-center justify-center shadow-md">
                  <Key size={15} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[15px] text-[#1d1d1f]">Connecter Claude</h3>
                  <p className="text-[11px] text-[#6e6e73]">Active les agents IA pour ce navigateur</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-[12px] text-[#3a3a3c] leading-relaxed">
                Si la clé serveur n'est pas configurée (Vercel), tu peux mettre ta propre clé Anthropic ici.
                Elle est stockée uniquement dans <strong>ton navigateur</strong> (localStorage) et ne quitte ton appareil que pour appeler l'API Anthropic via ce site.
              </p>
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] text-[#0071e3] hover:underline">
                Obtenir une clé sur console.anthropic.com <ExternalLink size={11} />
              </a>
              <div>
                <input
                  type="password"
                  autoFocus
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveApiKey(); }}
                  placeholder="sk-ant-api03-..."
                  className="w-full text-[12px] p-3 border border-[#d2d2d7] rounded-[12px] outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 font-mono"
                />
                <p className="text-[10px] text-[#8e8e93] mt-1.5">
                  Format attendu : <code className="bg-[#f5f5f7] px-1 rounded">sk-ant-...</code>
                </p>
              </div>

              {apiStatusDetails?.needs_credit && (
                <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener noreferrer"
                  className="block bg-gradient-to-br from-[#0071e3] to-[#5e5ce6] text-white rounded-[14px] p-3.5 shadow-md hover:shadow-lg transition-all">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={14} />
                    <span className="font-semibold text-[13px]">Charger ton compte Anthropic</span>
                    <ExternalLink size={11} className="ml-auto" />
                  </div>
                  <p className="text-[11px] text-white/85 leading-relaxed">
                    Ton compte fonctionne mais n'a pas encore de crédit. Ajoute <strong>5$ minimum</strong> sur console.anthropic.com → Settings → Billing, puis reviens cliquer <strong>Re-tester</strong>.
                  </p>
                </a>
              )}

              {apiStatus === "error" && apiStatusReason && (
                <div className="text-[11px] text-[#ff3b30] bg-[#ff3b30]/5 border border-[#ff3b30]/15 rounded-[10px] p-2.5 max-h-[280px] overflow-y-auto">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <div className="flex-1">
                      {apiStatusDetails?.status ? (
                        <div className="font-semibold mb-1">Erreur HTTP {apiStatusDetails.status}</div>
                      ) : null}
                      <div className="break-words whitespace-pre-wrap leading-relaxed">{apiStatusReason}</div>
                      {apiStatusDetails?.diagnostic && (
                        <div className="mt-1.5 text-[#1d1d1f] font-medium bg-white/70 rounded px-2 py-1">
                          💡 {apiStatusDetails.diagnostic}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Détails par modèle testé */}
                  {apiStatusDetails?.attempts && apiStatusDetails.attempts.length > 0 && (
                    <details className="mt-2 text-[#6e6e73]">
                      <summary className="cursor-pointer text-[10px] uppercase tracking-wider font-semibold">Détails techniques ({apiStatusDetails.attempts.length} modèles testés)</summary>
                      <div className="mt-1.5 space-y-1 font-mono text-[10px]">
                        {apiStatusDetails.attempts.map((a, i) => (
                          <div key={i} className="bg-white/50 rounded p-1.5">
                            <div className="text-[#1d1d1f]">{a.model}</div>
                            <div className="text-[#ff3b30]">[{a.status}] {a.message}</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Hints contextuels */}
                  <div className="mt-2 space-y-1.5">
                    {(apiStatusReason.toLowerCase().includes("credit") || apiStatusReason.toLowerCase().includes("balance") || apiStatusReason.toLowerCase().includes("billing")) && (
                      <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[#0071e3] hover:underline">
                        <ExternalLink size={10} /> Recharger mon compte Anthropic (5$ minimum)
                      </a>
                    )}
                    {apiStatusDetails?.status === 401 && (
                      <div className="text-[#6e6e73]">⚠ <strong>Clé invalide</strong>. Vérifie qu'elle commence par <code className="bg-[#f5f5f7] px-1 rounded">sk-ant-api03-</code> et qu'elle n'a pas été révoquée.</div>
                    )}
                    {apiStatusDetails?.status === 403 && (
                      <div className="text-[#6e6e73]">⚠ <strong>Accès refusé</strong>. Ta clé n'a pas les droits sur ces modèles. Vérifie Workspaces sur console.anthropic.com.</div>
                    )}
                    {apiStatusDetails?.status === 429 && (
                      <div className="text-[#6e6e73]">⚠ <strong>Quota dépassé</strong>. Tu as épuisé ton crédit ou dépassé la limite. Recharge ou attends.</div>
                    )}
                    {apiStatusDetails?.status === 404 && (
                      <div className="text-[#6e6e73]">⚠ <strong>Modèle introuvable</strong>. Aucun modèle Claude n'est accessible avec cette clé.</div>
                    )}
                    {apiStatusDetails?.status === 400 && (
                      <div className="text-[#6e6e73]">⚠ <strong>Requête invalide</strong>. Probablement un problème de format de clé ou de modèle.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-3.5 bg-[#fafafa] border-t border-[#d2d2d7]/40 flex items-center gap-2 flex-wrap">
              {hasUserApiKey() && (
                <button onClick={() => { clearUserApiKey(); setKeyInput(""); setApiStatus("checking"); setApiStatusReason(""); setApiStatusDetails(null); }}
                  className="px-3 py-2 text-[12px] rounded-[10px] bg-[#ff3b30]/10 text-[#ff3b30] hover:bg-[#ff3b30]/15 font-medium transition-all">
                  Supprimer
                </button>
              )}
              <button onClick={saveApiKey} disabled={keySaving}
                title="Re-tester la clé actuelle sans rien changer"
                className="px-3 py-2 text-[12px] rounded-[10px] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea] transition-all flex items-center gap-1.5">
                <RefreshCw size={11} className={keySaving ? "animate-spin" : ""} /> Re-tester
              </button>
              <button onClick={() => setShowKeyModal(false)}
                className="ml-auto px-3 py-2 text-[12px] rounded-[10px] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea] transition-all">
                Annuler
              </button>
              <button onClick={saveApiKey} disabled={!keyInput.trim() || keySaving}
                className={`px-4 py-2 text-[12px] font-medium rounded-[10px] transition-all flex items-center gap-1.5 ${
                  keyInput.trim() && !keySaving
                    ? "bg-gradient-to-br from-[#0071e3] to-[#0040a3] text-white shadow-md hover:shadow-lg"
                    : "bg-[#e5e5ea] text-[#8e8e93] cursor-not-allowed"
                }`}>
                {keySaving ? <><RefreshCw size={11} className="animate-spin" /> Test…</> : "Tester et enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CLAUDE ASSISTANT FLOTTANT ── */}
      <div className="fixed bottom-5 right-5 z-40">
        {claudeOpen ? (
          <div className="bg-white rounded-[18px] shadow-2xl w-[380px] h-[500px] flex flex-col border border-[#d2d2d7]/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-[#d2d2d7]/40 bg-gradient-to-r from-[#0071e3] to-[#5e5ce6] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                  <Sparkles size={13} className="text-white" />
                </div>
                <div>
                  <div className="font-semibold text-[13px] text-white">Claude</div>
                  <div className="text-[10px] text-white/70">Conseil stratégique cabinet</div>
                </div>
              </div>
              <button onClick={() => setClaudeOpen(false)} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                <X size={13} className="text-white" />
              </button>
            </div>

            <div ref={claudeContainerRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {store.claude_history.length === 0 && (
                <div className="text-center py-6 px-2">
                  <Sparkles size={24} className="text-[#0071e3] mx-auto mb-2" />
                  <p className="text-[12px] text-[#1d1d1f] font-medium mb-1">Bonjour 👋</p>
                  <p className="text-[11px] text-[#6e6e73] leading-relaxed">Je suis Claude. Je vois tout le cabinet en temps réel. Demande-moi des conseils sur les agents, dossiers, agenda, ou un rappel technique DEC.</p>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {["Que faire en priorité ?", "État du cabinet ?", "Rappel sur les IFRS"].map(s => (
                      <button key={s} onClick={() => { setClaudeInput(s); }}
                        className="text-[11px] text-[#0071e3] bg-[#0071e3]/8 hover:bg-[#0071e3]/12 px-2.5 py-1 rounded-full transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {store.claude_history.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-[14px] text-[12px] leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-gradient-to-br from-[#0071e3] to-[#0040a3] text-white rounded-br-[4px]"
                      : "bg-[#f5f5f7] text-[#1d1d1f] rounded-tl-[4px]"
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {claudeSending && (
                <div className="flex">
                  <div className="bg-[#f5f5f7] rounded-[14px] rounded-tl-[4px] px-3 py-2 flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#8e8e93] animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#8e8e93] animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#8e8e93] animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
            </div>

            {claudeError && (
              <div className="px-3 py-1.5 bg-[#ff3b30]/8 border-t border-[#ff3b30]/15 text-[11px] text-[#ff3b30] flex items-center gap-1.5">
                <AlertTriangle size={11} /> {claudeError}
              </div>
            )}

            <div className="px-3 py-2 border-t border-[#d2d2d7]/40">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={claudeInput}
                  onChange={(e) => setClaudeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendToClaude(); }}}
                  disabled={claudeSending}
                  placeholder="Demande à Claude…"
                  className="flex-1 text-[12px] px-3 py-2 bg-[#f5f5f7] rounded-full outline-none placeholder-[#8e8e93] disabled:opacity-60"
                />
                <button onClick={sendToClaude} disabled={!claudeInput.trim() || claudeSending}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    claudeInput.trim() && !claudeSending
                      ? "bg-gradient-to-br from-[#0071e3] to-[#0040a3] text-white shadow-sm"
                      : "bg-[#e5e5ea] text-[#8e8e93] cursor-not-allowed"
                  }`}>
                  <Send size={12} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => setClaudeOpen(true)}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0071e3] via-[#5e5ce6] to-[#bf5af2] shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center group">
            <Sparkles size={22} className="text-white group-hover:rotate-12 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Score Card ──────────────────────────────────────────────────────────────
function ScoreCard({ score, playerMessage, onClose }: { score: ScoreResult; playerMessage: string; onClose: () => void }) {
  const color = score.score_global >= 80 ? "#34c759" : score.score_global >= 60 ? "#ff9f0a" : "#ff3b30";
  const grade = score.score_global >= 80 ? "Excellent" : score.score_global >= 70 ? "Bien" : score.score_global >= 60 ? "Satisfaisant" : score.score_global >= 50 ? "À améliorer" : "Insuffisant";
  const bars = [
    { label: "Précision", val: score.breakdown.precision, max: 30 },
    { label: "Rédaction", val: score.breakdown.redaction, max: 20 },
    { label: "Déontologie", val: score.breakdown.deontologie, max: 20 },
    { label: "Contexte", val: score.breakdown.contexte, max: 15 },
    { label: "Opérationnel", val: score.breakdown.operationnel, max: 15 },
  ];

  return (
    <div className="bg-white rounded-[18px] border border-[#d2d2d7]/40 shadow-[0_4px_24px_rgba(0,0,0,0.10)] p-4 my-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-[16px] shadow-sm" style={{ backgroundColor: color }}>
            {score.score_global}
          </div>
          <div>
            <p className="font-semibold text-[14px] text-[#1d1d1f]">Évaluation Ghost Writer DEC</p>
            <p className="text-[11px] font-medium" style={{ color }}>{grade}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {score.impact.legitimite_delta !== 0 && (
            <span className={`flex items-center gap-0.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${score.impact.legitimite_delta > 0 ? "bg-[#34c759]/10 text-[#34c759]" : "bg-[#ff3b30]/10 text-[#ff3b30]"}`}>
              {score.impact.legitimite_delta > 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
              {score.impact.legitimite_delta > 0 ? "+" : ""}{score.impact.legitimite_delta} Légitimité
            </span>
          )}
          <button onClick={onClose} className="w-6 h-6 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#6e6e73] hover:bg-[#e5e5ea] transition-colors text-[14px] font-medium">×</button>
        </div>
      </div>

      <div className="space-y-1.5 mb-3">
        {bars.map(b => (
          <div key={b.label} className="flex items-center gap-2">
            <span className="text-[10px] text-[#6e6e73] w-22 shrink-0">{b.label}</span>
            <div className="flex-1 h-[4px] bg-[#f5f5f7] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${(b.val / b.max) * 100}%`, backgroundColor: (b.val / b.max) >= 0.8 ? "#34c759" : (b.val / b.max) >= 0.6 ? "#ff9f0a" : "#ff3b30" }} />
            </div>
            <span className="text-[10px] font-semibold text-[#3a3a3c] w-8 text-right">{b.val}/{b.max}</span>
          </div>
        ))}
      </div>

      <div className="bg-[#f5f5f7] rounded-[12px] p-3 mb-2.5">
        <div className="flex items-start gap-2">
          <Zap size={12} className="text-[#0071e3] mt-0.5 shrink-0" />
          <p className="text-[12px] text-[#3a3a3c] leading-relaxed italic">{score.feedback}</p>
        </div>
      </div>

      <div className="flex gap-3">
        {score.points_forts?.length > 0 && (
          <div className="flex-1">
            <p className="text-[9px] font-semibold text-[#8e8e93] uppercase tracking-wider mb-1.5">Points forts</p>
            <div className="space-y-1">
              {score.points_forts.map(p => (
                <p key={p} className="text-[11px] text-[#3a3a3c] flex gap-1.5 items-start">
                  <span className="text-[#34c759] font-bold mt-0.5">✓</span>{p}
                </p>
              ))}
            </div>
          </div>
        )}
        {score.axes_amelioration?.length > 0 && (
          <div className="flex-1">
            <p className="text-[9px] font-semibold text-[#8e8e93] uppercase tracking-wider mb-1.5">À améliorer</p>
            <div className="space-y-1">
              {score.axes_amelioration.map(a => (
                <p key={a} className="text-[11px] text-[#3a3a3c] flex gap-1.5 items-start">
                  <span className="text-[#0071e3] font-bold mt-0.5">→</span>{a}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Composants UI ────────────────────────────────────────────────────────────
function MiniStat({ label, value, color, display }: { label: string; value: number; color: string; display?: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-[#6e6e73]">{label}</span>
        <span className="font-medium text-[#3a3a3c]">{display || Math.round(value)}</span>
      </div>
      <div className="h-[3px] bg-[#e5e5ea] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function AgentBar({ label, value, warn, invert }: { label: string; value: number; warn?: number; invert?: boolean }) {
  const bad = warn ? value > warn : false;
  const good = invert && value > 70;
  const color = bad ? "#ff3b30" : good ? "#34c759" : "#0071e3";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[#8e8e93] w-14">{label}</span>
      <div className="flex-1 h-[3px] bg-[#e5e5ea] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] text-[#8e8e93] w-5 text-right">{value}</span>
    </div>
  );
}

function StatChip({ label, value, warn, invert }: { label: string; value: number; warn?: number; invert?: boolean }) {
  const bad = warn && value > warn;
  const color = bad ? "text-[#ff3b30]" : invert && value > 70 ? "text-[#34c759]" : "text-[#6e6e73]";
  return (
    <div className="text-center">
      <div className={`text-[13px] font-semibold ${color}`}>{value}</div>
      <div className="text-[10px] text-[#8e8e93]">{label}</div>
    </div>
  );
}

function EmotionChip({ emotion, small }: { emotion: string; small?: boolean }) {
  const map: Record<string, string> = {
    "Stable": "bg-[#34c759]/10 text-[#34c759]",
    "Concentré": "bg-[#0071e3]/10 text-[#0071e3]",
    "Anxieux": "bg-[#ff9f0a]/10 text-[#ff9f0a]",
    "Frustré": "bg-[#ff3b30]/10 text-[#ff3b30]",
    "Euphorique": "bg-[#bf5af2]/10 text-[#bf5af2]",
    "Surmené": "bg-[#ff3b30]/10 text-[#ff3b30]",
    "Distant": "bg-[#8e8e93]/10 text-[#8e8e93]",
    "En conflit": "bg-[#ff3b30]/10 text-[#ff3b30]",
  };
  const cls = map[emotion] || "bg-[#e5e5ea] text-[#6e6e73]";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded-md font-medium ${small ? "text-[9px]" : "text-[11px]"} ${cls}`}>
      {emotion}
    </span>
  );
}

function DossierStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white px-3 py-2 rounded-[12px] border border-[#d2d2d7]/40 text-center min-w-[78px] shadow-sm">
      <div className="text-[18px] font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[10px] text-[#6e6e73]">{label}</div>
    </div>
  );
}
