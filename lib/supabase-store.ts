"use client";

import { create } from "zustand";
import { supabase, getCurrentUser } from "./supabase";

export interface Agent {
  id: string;
  nom: string;
  initiales: string;
  avatar_color: string;
  statut: string;
  role: string;
  filiere: string;
  niveau: string;
  emotion: string;
  stress: number;
  fatigue: number;
  confiance_joueur: number;
  respect: number;
  peur: number;
  loyaute: number;
}

export interface Message {
  id: string;
  message_id: string;
  agent_id: string;
  niveau: string;
  type: string;
  phase: string | null;
  sujet: string;
  contenu: string;
  delai_reponse_heures: number;
  timestamp: string;
  lu: boolean;
  repondu: boolean;
  reponse_joueur: string | null;
}

export interface Dossier {
  id: string;
  client: string;
  theme: string;
  agent_id: string;
  // 5 statuts auto-calculés
  etat: "en_cours" | "surveillance" | "avance" | "cloture" | "perdu";
  progression: number;
  phase: "P1" | "P2" | "P3" | "P4" | "P5";
  echeance_heure: string;
  impact: {
    legitimite: number;
    reputation: number;
    tresorerie: number;
    stress: number;
  };
  // Enrichissements
  qualite: number; // 0-100, basée sur les tâches validées + score
  client_satisfait: boolean;
  signaux_alerte: string[]; // ex: ["agent_burnout", "retard_J5", "drama_interne"]
  is_vip: boolean; // dossiers stratégiques (max 3) → impact réputation x3
  recoverable_until: string | null; // ISO date jusqu'à laquelle on peut tenter récupération (30 jours)
  cause_perte: string | null; // raison narrative si "perdu"
  cas_traites: number; // nombre de tâches validées sur ce dossier
}

export interface ClaudeMsg {
  role: "user" | "assistant";
  content: string;
}

export interface FiscalDeadline {
  id: string;
  label: string;
  echeance_label: string;
  echeance_day: number;
  echeance_month: number;
  progression: number;
  filiere_responsable: string;
  depend_de: string | null;
  cout_retard: number;
  campagne: "IR" | "Bilan" | "Rentree" | "Prep" | "Mensuel";
}

export interface GameState {
  user_id: string | null;
  legitimite: number;
  tresorerie: number;
  reputation: number;
  stress_global: number;
  points_action: number;
  points_action_max: number;
  date_simulation: string;
  mood_global: string;

  // Horloge jeu — temps simulé qui avance
  game_hour: number;
  game_minute: number;
  game_day: number;

  // Niveau joueur — progression XP
  player_level: number;
  player_xp: number;
  xp_to_next: number;

  // DEC Prep — engagement quotidien
  dec_streak: number;
  dec_last_day: number;
  dec_today_deonto: boolean;
  dec_today_mission: boolean;
  dec_completed_deonto_ids: string[];
  dec_completed_mission_ids: string[];
  dec_badges: string[];

  // Tasks (validation pédagogique) — persistant
  completed_tasks: string[];

  // Équipe : actions joueur → agent
  agent_cooldowns: Record<string, Record<string, number>>; // agent_id → action → game_day jusque-là
  agent_player_history: Record<string, { day: number; hour: number; event: string; impact?: string }[]>;
  team_health: number;

  agents: Agent[];
  messages: Message[];
  dossiers: Dossier[];
  fiscal_deadlines: FiscalDeadline[];
  conversation_history: Record<string, { role: string; content: string }[]>;
  claude_history: ClaudeMsg[];
  isLoading: boolean;
  isAuthenticated: boolean;

  setUser: (userId: string | null) => void;
  loadGameState: () => Promise<void>;
  saveGameState: () => Promise<void>;
  setResources: (res: Partial<Pick<GameState, "legitimite" | "tresorerie" | "reputation" | "stress_global" | "points_action">>) => void;
  markMessageRead: (id: string) => Promise<void>;
  replyToMessage: (id: string, reply: string) => Promise<void>;
  spendPA: (amount: number) => boolean;
  addConversation: (agentId: string, role: "user" | "assistant", content: string) => Promise<void>;
  loadConversations: (agentId: string) => Promise<void>;
  addNewMessage: (event: { agent_id: string; niveau: string; type: string; sujet: string; contenu: string; delai_reponse_heures: number }) => Promise<void>;

  // Horloge
  tickClock: (minutes: number) => void;

  // XP / Niveau
  addXP: (amount: number) => void;

  // Dossiers
  setDossiers: (d: Dossier[]) => void;
  winDossier: (id: string) => void;
  loseDossier: (id: string) => void;
  advanceDossier: (id: string, amount: number) => void;

  // Claude
  addClaudeMessage: (msg: ClaudeMsg) => void;
  clearClaude: () => void;

  // Corrélations cross-systèmes
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  recomputeMood: () => void;
  applyOutcome: (agentId: string, score: number) => void;

  // Calendrier fiscal
  advanceDeadline: (id: string, amount: number) => void;
  autoAdvanceDeadlines: () => void;
  checkOverdueDeadlines: () => void;

  // Dossiers : enrichissements
  recomputeAllDossierStatus: () => void;
  attemptRecoverDossier: (id: string) => boolean;
  toggleVIP: (id: string) => void;

  // DEC Prep
  markDeontoCompleted: (questionIds: string[]) => void;
  markMissionCompleted: (missionId: string) => void;
  addBadge: (badge: string) => void;
  checkDecRollover: () => void;

  // Tasks
  markTaskCompleted: (taskId: string) => void;
  loadLocalPersistence: () => void;

  // Équipe : actions
  talkAgent: (agentId: string) => { ok: boolean; reason?: string };
  rewardAgent: (agentId: string) => { ok: boolean; reason?: string };
  reprimandAgent: (agentId: string) => { ok: boolean; reason?: string };
  trainAgent: (agentId: string) => { ok: boolean; reason?: string };
  recomputeTeamHealth: () => void;
}

const xpForLevel = (level: number) => 100 + level * 50;

function persistDec(s: any) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("dec_state", JSON.stringify({
      deonto: s.dec_completed_deonto_ids,
      mission: s.dec_completed_mission_ids,
      badges: s.dec_badges,
      streak: s.dec_streak,
      last_day: s.dec_last_day,
    }));
  } catch {}
}

export const useGameStore = create<GameState>((set, get) => ({
  user_id: null,
  legitimite: 72,
  tresorerie: 145000,
  reputation: 68,
  stress_global: 61,
  points_action: 3,
  points_action_max: 3,
  date_simulation: "14 mai 2026",
  mood_global: "Sous Pression",

  game_hour: 9,
  game_minute: 0,
  game_day: 1,

  player_level: 1,
  player_xp: 0,
  xp_to_next: 100,

  dec_streak: 0,
  dec_last_day: 0,
  dec_today_deonto: false,
  dec_today_mission: false,
  dec_completed_deonto_ids: [],
  dec_completed_mission_ids: [],
  dec_badges: [],

  completed_tasks: [],

  agent_cooldowns: {},
  agent_player_history: {},
  team_health: 60,

  agents: [],
  messages: [],
  dossiers: [],
  fiscal_deadlines: [
    { id: "dsn_mai", label: "DSN mensuelle", echeance_label: "5 mai", echeance_day: 5, echeance_month: 5, progression: 85, filiere_responsable: "Social", depend_de: null, cout_retard: 1500, campagne: "Mensuel" },
    { id: "is_acompte", label: "Acompte IS", echeance_label: "15 mai", echeance_day: 15, echeance_month: 5, progression: 60, filiere_responsable: "Fiscal", depend_de: null, cout_retard: 5000, campagne: "Mensuel" },
    { id: "tva_mai", label: "TVA mensuelle", echeance_label: "20 mai", echeance_day: 20, echeance_month: 5, progression: 75, filiere_responsable: "Fiscal", depend_de: null, cout_retard: 3000, campagne: "Mensuel" },
    { id: "bilan_juin", label: "Bilan + AG (Boss)", echeance_label: "30 juin", echeance_day: 30, echeance_month: 6, progression: 32, filiere_responsable: "Audit & IFRS", depend_de: "tva_mai", cout_retard: 30000, campagne: "Bilan" },
  ],
  conversation_history: {},
  claude_history: [],
  isLoading: true,
  isAuthenticated: false,

  setUser: (userId) => set({ user_id: userId, isAuthenticated: !!userId }),

  loadGameState: async () => {
    const user = await getCurrentUser();
    if (!user) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    set({ user_id: user.id, isAuthenticated: true, isLoading: true });

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profile) {
      set({
        legitimite: profile.legitimite,
        tresorerie: profile.tresorerie,
        reputation: profile.reputation,
        stress_global: profile.stress_global,
        points_action: profile.points_action,
        points_action_max: profile.points_action_max,
        date_simulation: profile.date_simulation,
        mood_global: profile.mood_global,
      });
    } else {
      await supabase.from("profiles").insert({ user_id: user.id });
    }

    const { data: existingAgents } = await supabase
      .from("agents_state")
      .select("agent_id")
      .eq("user_id", user.id)
      .limit(1);

    if (!existingAgents || existingAgents.length === 0) {
      try {
        const res = await fetch("/agents_config.json");
        const config = await res.json();

        await supabase.from("agents_state").insert(
          config.agents.map((a: any) => ({
            user_id: user.id,
            agent_id: a.id,
            nom: a.nom,
            initiales: a.initiales,
            avatar_color: a.avatar_color,
            statut: a.statut,
            role: a.role,
            filiere: a.filiere,
            niveau: a.niveau,
            trait_dominant: a.trait_dominant,
            competence_technique: a.competence_technique,
            emotion: a.emotion,
            stress: a.stress,
            fatigue: a.fatigue,
            confiance_joueur: a.confiance_joueur,
            respect: a.respect,
            peur: a.peur,
            loyaute: a.loyaute,
            arc_actuel: a.arc_actuel,
            secret: a.secret,
            dossiers_actifs: a.dossiers_actifs,
          }))
        );

        await supabase.from("messages").insert(
          config.messages_en_attente.map((m: any) => ({
            user_id: user.id,
            message_id: m.id,
            agent_id: m.agent_id,
            niveau: m.niveau,
            type: m.type,
            phase: m.phase || null,
            sujet: m.sujet,
            contenu: m.contenu,
            delai_reponse_heures: m.delai_reponse_heures,
            timestamp: m.timestamp,
            lu: false,
            repondu: false,
          }))
        );
      } catch (err) {
        console.error("[Store] Erreur seed initial :", err);
      }
    }

    const { data: agentsData } = await supabase
      .from("agents_state")
      .select("*")
      .eq("user_id", user.id);

    if (agentsData && agentsData.length > 0) {
      set({ agents: agentsData.map((a) => ({ ...a, id: a.agent_id })) });

      // Seed dossiers dynamiques à partir des dossiers_actifs des agents
      const dossiers: Dossier[] = [];
      agentsData.forEach((a: any) => {
        (a.dossiers_actifs || []).forEach((d: string, i: number) => {
          const [client, theme] = d.includes(" - ") ? d.split(" - ") : [d, "Dossier"];
          dossiers.push({
            id: `${a.agent_id}_d${i}`,
            client: client.trim(),
            theme: theme.trim(),
            agent_id: a.agent_id,
            etat: "en_cours",
            progression: 30 + Math.floor(Math.random() * 50),
            phase: ["P2", "P3", "P4"][Math.floor(Math.random() * 3)] as "P2" | "P3" | "P4",
            echeance_heure: `${10 + Math.floor(Math.random() * 7)}:00`,
            impact: {
              legitimite: 2 + Math.floor(Math.random() * 5),
              reputation: 1 + Math.floor(Math.random() * 4),
              tresorerie: 2000 + Math.floor(Math.random() * 8000),
              stress: 3 + Math.floor(Math.random() * 6),
            },
            qualite: 60,
            client_satisfait: true,
            signaux_alerte: [],
            is_vip: false,
            recoverable_until: null,
            cause_perte: null,
            cas_traites: 0,
          });
        });
      });
      // Marquer 2 dossiers en VIP (impact x3) — les premiers ou les dossiers importants
      if (dossiers.length > 0) dossiers[0].is_vip = true;
      if (dossiers.length > 3) dossiers[3].is_vip = true;
      set({ dossiers });
    }

    const { data: messagesData } = await supabase
      .from("messages")
      .select("*")
      .eq("user_id", user.id)
      .order("timestamp", { ascending: false });

    if (messagesData) {
      set({ messages: messagesData.map((m) => ({ ...m, id: m.message_id })) });
    }

    set({ isLoading: false });
  },

  saveGameState: async () => {
    const state = get();
    if (!state.user_id) return;

    await supabase.from("profiles").upsert({
      user_id: state.user_id,
      legitimite: state.legitimite,
      tresorerie: state.tresorerie,
      reputation: state.reputation,
      stress_global: state.stress_global,
      points_action: state.points_action,
      points_action_max: state.points_action_max,
      date_simulation: state.date_simulation,
      mood_global: state.mood_global,
      updated_at: new Date().toISOString(),
    });
  },

  setResources: (res) => {
    set((state) => ({ ...state, ...res }));
    get().saveGameState();
  },

  markMessageRead: async (id) => {
    const state = get();
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, lu: true } : m
      ),
    }));
    if (!state.user_id) return;
    await supabase
      .from("messages")
      .update({ lu: true })
      .eq("message_id", id)
      .eq("user_id", state.user_id);
  },

  replyToMessage: async (id, reply) => {
    const state = get();
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, repondu: true, reponse_joueur: reply } : m
      ),
    }));
    if (!state.user_id) return;
    await supabase
      .from("messages")
      .update({ repondu: true, reponse_joueur: reply })
      .eq("message_id", id)
      .eq("user_id", state.user_id);
    get().saveGameState();
  },

  spendPA: (amount) => {
    const state = get();
    if (state.points_action >= amount) {
      set({ points_action: state.points_action - amount });
      get().saveGameState();
      return true;
    }
    return false;
  },

  addConversation: async (agentId, role, content) => {
    const state = get();
    if (!state.user_id) return;

    try {
      await supabase.from("conversations").insert({
        user_id: state.user_id,
        agent_id: agentId,
        role,
        content,
      });
    } catch (err) {
      console.error("[Store] Save conversation failed:", err);
    }
  },

  loadConversations: async (agentId) => {
    const state = get();
    if (!state.user_id) return;

    const { data } = await supabase
      .from("conversations")
      .select("role, content, created_at")
      .eq("user_id", state.user_id)
      .eq("agent_id", agentId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (data) {
      set((state) => ({
        conversation_history: {
          ...state.conversation_history,
          [agentId]: data.map((d) => ({ role: d.role, content: d.content })),
        },
      }));
    }
  },

  addNewMessage: async (event) => {
    const state = get();

    // Anti-doublon : si un message non-répondu avec un sujet similaire existe déjà
    // pour cet agent, on ne le réinjecte pas
    const normSubject = event.sujet.toLowerCase().trim();
    const dup = state.messages.find(
      (m) => m.agent_id === event.agent_id && !m.repondu && m.sujet.toLowerCase().trim() === normSubject
    );
    if (dup) {
      console.log("[Store] Doublon évité :", event.sujet);
      return;
    }

    // Dedup soft : si > 80% de similarité avec un sujet récent (24h), on skippe aussi
    const recentSubjects = state.messages
      .filter((m) => m.agent_id === event.agent_id && !m.repondu)
      .map((m) => m.sujet.toLowerCase());
    const tooSimilar = recentSubjects.some((s) => {
      const shorter = s.length < normSubject.length ? s : normSubject;
      const longer = s.length < normSubject.length ? normSubject : s;
      return longer.includes(shorter) && shorter.length > 8;
    });
    if (tooSimilar) {
      console.log("[Store] Sujet trop similaire évité :", event.sujet);
      return;
    }

    const messageId = `msg_auto_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const newMsg: Message = {
      id: messageId,
      message_id: messageId,
      agent_id: event.agent_id,
      niveau: event.niveau,
      type: event.type,
      phase: null,
      sujet: event.sujet,
      contenu: event.contenu,
      delai_reponse_heures: event.delai_reponse_heures,
      timestamp: new Date().toISOString(),
      lu: false,
      repondu: false,
      reponse_joueur: null,
    };

    set((state) => ({ messages: [newMsg, ...state.messages] }));

    if (!state.user_id) return;
    try {
      await supabase.from("messages").insert({
        user_id: state.user_id,
        message_id: messageId,
        agent_id: event.agent_id,
        niveau: event.niveau,
        type: event.type,
        phase: null,
        sujet: event.sujet,
        contenu: event.contenu,
        delai_reponse_heures: event.delai_reponse_heures,
        timestamp: new Date().toISOString(),
        lu: false,
        repondu: false,
      });
    } catch (err) {
      console.error("[Store] Insert new message failed:", err);
    }
  },

  tickClock: (minutes) => {
    set((state) => {
      let totalMinutes = state.game_hour * 60 + state.game_minute + minutes;
      let day = state.game_day;
      // Journée 8h–19h. Au-delà → jour suivant 8h.
      if (totalMinutes >= 19 * 60) {
        day += 1;
        totalMinutes = 8 * 60;
        return {
          game_hour: 8,
          game_minute: 0,
          game_day: day,
          points_action: state.points_action_max,
        };
      }
      if (totalMinutes < 8 * 60) totalMinutes = 8 * 60;
      return {
        game_hour: Math.floor(totalMinutes / 60),
        game_minute: totalMinutes % 60,
      };
    });
  },

  addXP: (amount) => {
    set((state) => {
      let newXP = state.player_xp + amount;
      let level = state.player_level;
      let toNext = state.xp_to_next;
      while (newXP >= toNext) {
        newXP -= toNext;
        level += 1;
        toNext = xpForLevel(level);
      }
      return { player_xp: newXP, player_level: level, xp_to_next: toNext };
    });
  },

  setDossiers: (d) => set({ dossiers: d }),

  winDossier: (id) => {
    const state = get();
    const d = state.dossiers.find((x) => x.id === id);
    if (!d || (d.etat !== "en_cours" && d.etat !== "surveillance")) return;
    const agent = state.agents.find((a) => a.id === d.agent_id);
    const multiplier = d.is_vip ? 3 : 1;

    // Statut final selon la qualité
    const finalStatus: "avance" | "cloture" = d.qualite >= 70 && d.client_satisfait ? "avance" : "cloture";

    set((s) => ({
      dossiers: s.dossiers.map((x) =>
        x.id === id ? { ...x, etat: finalStatus, progression: 100 } : x
      ),
      legitimite: Math.min(100, s.legitimite + d.impact.legitimite * multiplier),
      reputation: Math.min(100, s.reputation + d.impact.reputation * multiplier),
      tresorerie: s.tresorerie + d.impact.tresorerie * multiplier,
      stress_global: Math.max(0, s.stress_global - Math.floor(d.impact.stress / 2)),
    }));

    // Message N1 auto "Dossier clôturé" de l'agent associé
    if (agent) {
      get().addNewMessage({
        agent_id: agent.id,
        niveau: "N1",
        type: "Information",
        sujet: `✓ Dossier clôturé — ${d.client}`,
        contenu: `Bonne nouvelle, on a clôturé le dossier ${d.client} (${d.theme}). Le client est satisfait, facturation envoyée. Honoraires +${(d.impact.tresorerie/1000).toFixed(1)}k€ encaissés ce jour. Beau travail collectif.`,
        delai_reponse_heures: 24,
      });
      // +confiance + -stress agent qui a porté le dossier
      get().updateAgent(agent.id, {
        confiance_joueur: Math.min(100, agent.confiance_joueur + 5),
        stress: Math.max(0, agent.stress - 8),
      });
    }
    get().addXP(20);
    get().recomputeMood();
    get().saveGameState();
  },

  loseDossier: (id) => {
    const state = get();
    const d = state.dossiers.find((x) => x.id === id);
    if (!d || d.etat === "perdu" || d.etat === "avance" || d.etat === "cloture") return;
    const agent = state.agents.find((a) => a.id === d.agent_id);
    const multiplier = d.is_vip ? 3 : 1;

    // Cause narrative de la perte
    let cause = "Client mécontent";
    if (d.signaux_alerte.includes("agent_burnout")) cause = "Agent en burn-out — dossier bloqué";
    else if (d.signaux_alerte.includes("drama_interne")) cause = "Conflit interne — dossier bloqué";
    else if (d.signaux_alerte.includes("retard_critique")) cause = "Retard critique";
    else if (d.signaux_alerte.includes("client_panique")) cause = "Concurrence — client parti";

    // Recoverable pendant 30 jours (jeu)
    const recoverDate = new Date();
    recoverDate.setDate(recoverDate.getDate() + 30);

    set((s) => ({
      dossiers: s.dossiers.map((x) =>
        x.id === id ? { ...x, etat: "perdu" as const, progression: 0, cause_perte: cause, recoverable_until: recoverDate.toISOString() } : x
      ),
      legitimite: Math.max(0, s.legitimite - d.impact.legitimite * multiplier),
      reputation: Math.max(0, s.reputation - d.impact.reputation * multiplier),
      tresorerie: Math.max(0, s.tresorerie - Math.floor(d.impact.tresorerie / 2) * multiplier),
      stress_global: Math.min(100, s.stress_global + d.impact.stress),
    }));

    // Message N4 auto "Dossier perdu"
    if (agent) {
      get().addNewMessage({
        agent_id: agent.id,
        niveau: "N4",
        type: "Probleme",
        sujet: `⚠ Dossier perdu — ${d.client}`,
        contenu: `Le client ${d.client} part chez le concurrent. On perd ${(d.impact.tresorerie/2/1000).toFixed(1)}k€ d'honoraires et −${d.impact.reputation} de réputation. Faut-il qu'on fasse un debrief équipe demain matin ?`,
        delai_reponse_heures: 12,
      });
      get().updateAgent(agent.id, {
        confiance_joueur: Math.max(0, agent.confiance_joueur - 3),
        stress: Math.min(100, agent.stress + 6),
      });
    }
    get().recomputeMood();
    get().saveGameState();
  },

  advanceDossier: (id, amount) => {
    set((state) => ({
      dossiers: state.dossiers.map((x) =>
        x.id === id ? { ...x, progression: Math.min(100, x.progression + amount) } : x
      ),
    }));
  },

  addClaudeMessage: (msg) => {
    set((state) => ({ claude_history: [...state.claude_history, msg].slice(-30) }));
  },

  clearClaude: () => set({ claude_history: [] }),

  updateAgent: (id, patch) => {
    set((state) => ({
      agents: state.agents.map((a) => a.id === id ? { ...a, ...patch } : a),
    }));
  },

  recomputeMood: () => {
    set((state) => {
      const stressMoyen = state.agents.length > 0
        ? state.agents.reduce((s, a) => s + a.stress, 0) / state.agents.length
        : 50;
      const score = (state.legitimite * 0.3) + ((100 - stressMoyen) * 0.3) + (state.reputation * 0.2) + (Math.min(100, state.tresorerie / 2000) * 0.2);

      let mood = "Sous Pression";
      if (score >= 80) mood = "Euphorique";
      else if (score >= 65) mood = "Serein";
      else if (score >= 50) mood = "Tendu";
      else if (score >= 35) mood = "Sous Pression";
      else mood = "En Crise";

      return { mood_global: mood, stress_global: Math.round(stressMoyen) };
    });
  },

  applyOutcome: (agentId, score) => {
    const state = get();
    const agent = state.agents.find((a) => a.id === agentId);
    if (!agent) return;

    if (score >= 75) {
      get().updateAgent(agentId, {
        confiance_joueur: Math.min(100, agent.confiance_joueur + 4),
        stress: Math.max(0, agent.stress - 3),
        respect: Math.min(100, agent.respect + 2),
      });
      // Avance le dossier lié à cet agent
      const dossier = state.dossiers.find((d) => d.agent_id === agentId && d.etat === "en_cours");
      if (dossier) {
        get().advanceDossier(dossier.id, 12);
      }
      // Avance aussi la deadline fiscale de sa filière
      const deadline = state.fiscal_deadlines.find((d) => d.filiere_responsable === agent.filiere && d.progression < 100);
      if (deadline) get().advanceDeadline(deadline.id, 5);
    } else if (score >= 55) {
      get().updateAgent(agentId, {
        confiance_joueur: Math.min(100, agent.confiance_joueur + 1),
        stress: Math.max(0, agent.stress - 1),
      });
    } else if (score < 40) {
      get().updateAgent(agentId, {
        confiance_joueur: Math.max(0, agent.confiance_joueur - 4),
        stress: Math.min(100, agent.stress + 5),
      });
    }
    get().recomputeMood();
  },

  advanceDeadline: (id, amount) => {
    set((state) => ({
      fiscal_deadlines: state.fiscal_deadlines.map((d) =>
        d.id === id ? { ...d, progression: Math.min(100, d.progression + amount) } : d
      ),
    }));
  },

  // Auto-progression : chaque agent autonome fait avancer la deadline de sa filière
  // selon son grade, son stress, sa confiance et sa loyauté
  autoAdvanceDeadlines: () => {
    const state = get();
    const updates: Record<string, number> = {};

    state.agents.forEach((agent) => {
      if (agent.stress > 85) return; // burn-out = pas d'avancement
      let contribution = 0;
      const niveau = (agent as any).niveau || "Collaborateur";
      if (niveau === "Directeur") contribution = 2.5;
      else if (niveau === "Manager") contribution = 2.0;
      else if (niveau === "Collaborateur") contribution = 1.2;
      else contribution = 0.6; // Stagiaire

      // Modulation par stress (haut stress = moins efficace)
      if (agent.stress > 70) contribution *= 0.5;
      // Modulation par confiance (faible confiance = ne bosse pas autant)
      if (agent.confiance_joueur < 40) contribution *= 0.6;
      // Modulation par fatigue
      if (agent.fatigue > 70) contribution *= 0.7;

      // Trouve la deadline correspondante (par filière)
      const deadlines = state.fiscal_deadlines.filter(
        (d) => d.filiere_responsable === agent.filiere && d.progression < 100
      );
      deadlines.forEach((d) => {
        // Si la deadline dépend d'une autre, seulement la moitié de la contribution tant que la dépendance n'est pas finie
        if (d.depend_de) {
          const dep = state.fiscal_deadlines.find((x) => x.id === d.depend_de);
          if (dep && dep.progression < 80) {
            updates[d.id] = (updates[d.id] || 0) + contribution * 0.3;
          } else {
            updates[d.id] = (updates[d.id] || 0) + contribution;
          }
        } else {
          updates[d.id] = (updates[d.id] || 0) + contribution;
        }
      });
    });

    set((state) => ({
      fiscal_deadlines: state.fiscal_deadlines.map((d) =>
        updates[d.id]
          ? { ...d, progression: Math.min(100, d.progression + updates[d.id]) }
          : d
      ),
    }));
  },

  checkOverdueDeadlines: () => {
    const state = get();
    // Pour chaque deadline non finie dont la date est passée, appliquer la pénalité une fois
    const day = state.game_day;
    state.fiscal_deadlines.forEach((d) => {
      // Approximation : on simule que day=1 → 14 mai, donc day-1 = +jours
      const baseDay = 14 + (day - 1);
      const isOverdue = (d.echeance_month === 5 && baseDay > d.echeance_day) || (d.echeance_month < 5);
      if (isOverdue && d.progression < 100) {
        // Pénalité unique : appliquée une fois par jour
        const flag = `overdue_${d.id}_d${day}`;
        if (typeof window !== "undefined" && !localStorage.getItem(flag)) {
          localStorage.setItem(flag, "1");
          set((s) => ({
            tresorerie: Math.max(0, s.tresorerie - d.cout_retard),
            stress_global: Math.min(100, s.stress_global + 5),
            reputation: Math.max(0, s.reputation - 3),
          }));
          // Message N4 auto
          const responsable = state.agents.find((a) => a.filiere === d.filiere_responsable);
          if (responsable) {
            get().addNewMessage({
              agent_id: responsable.id,
              niveau: "N4",
              type: "Probleme",
              sujet: `⚠ Échéance dépassée — ${d.label}`,
              contenu: `${responsable.nom.split(" ")[0]}: on a dépassé l'échéance ${d.echeance_label} pour ${d.label}. Pénalité ${(d.cout_retard / 1000).toFixed(1)}k€ encaissée. On rattrape comment ?`,
              delai_reponse_heures: 6,
            });
          }
        }
      }
    });
  },

  // Recalcule statut + signaux d'alerte de tous les dossiers
  // Auto-finalise (avance/cloture/perdu) selon progression, qualité et signaux
  recomputeAllDossierStatus: () => {
    const state = get();
    const toFinalize: { id: string; outcome: "win" | "lose" }[] = [];

    set((s) => ({
      dossiers: s.dossiers.map((d) => {
        // Dossiers déjà terminés : on ne touche plus
        if (d.etat === "avance" || d.etat === "cloture" || d.etat === "perdu") return d;

        const agent = s.agents.find((a) => a.id === d.agent_id);
        const signaux: string[] = [];

        if (agent) {
          if (agent.fatigue > 85 || agent.stress > 90) signaux.push("agent_burnout");
          if (agent.confiance_joueur < 30) signaux.push("confiance_basse");
          if ((agent as any).arc_actuel === "Rupture") signaux.push("agent_rupture");
        }

        const expectedProgress = Math.min(95, 30 + s.game_day * 5);
        if (d.progression < expectedProgress - 20) signaux.push("retard_critique");
        if (s.mood_global === "En Crise") signaux.push("cabinet_crise");

        const client_satisfait = d.qualite >= 50 && signaux.length < 2;

        // Auto-finalisation #1 : progression atteinte → clôture automatique
        if (d.progression >= 100) {
          toFinalize.push({ id: d.id, outcome: "win" });
          return d;
        }

        // Auto-finalisation #2 : perte probabiliste si plusieurs signaux non gérés
        // (3% par tick avec 2 signaux, 8% avec 3+)
        if (signaux.length >= 3 && Math.random() < 0.08) {
          toFinalize.push({ id: d.id, outcome: "lose" });
          return d;
        }
        if (signaux.length >= 2 && Math.random() < 0.03) {
          toFinalize.push({ id: d.id, outcome: "lose" });
          return d;
        }

        // Statut dynamique sinon
        let etat: Dossier["etat"] = "en_cours";
        if (signaux.length >= 2 || (signaux.length >= 1 && d.progression < 50)) etat = "surveillance";

        return { ...d, signaux_alerte: signaux, client_satisfait, etat };
      }),
    }));

    // Déclenche les finalisations en dehors du set pour éviter récursion
    toFinalize.forEach((f) => {
      if (f.outcome === "win") get().winDossier(f.id);
      else get().loseDossier(f.id);
    });
  },

  attemptRecoverDossier: (id) => {
    const state = get();
    const d = state.dossiers.find((x) => x.id === id);
    if (!d || d.etat !== "perdu" || !d.recoverable_until) return false;
    if (new Date(d.recoverable_until) < new Date()) return false; // Trop tard
    if (state.points_action < 2) return false;

    // Récupération : 60% chance, modulée par niveau joueur et confiance moyenne agents
    const baseChance = 0.4 + state.player_level * 0.05;
    const success = Math.random() < baseChance;

    set((s) => ({ points_action: s.points_action - 2 }));

    if (success) {
      set((s) => ({
        dossiers: s.dossiers.map((x) =>
          x.id === id ? { ...x, etat: "avance" as const, progression: 100, cause_perte: null, recoverable_until: null } : x
        ),
        // Récupération exceptionnelle : honoraires x1.5
        tresorerie: s.tresorerie + Math.floor(d.impact.tresorerie * 1.5),
        legitimite: Math.min(100, s.legitimite + 10),
        reputation: Math.min(100, s.reputation + 5),
      }));
      // Message N1 auto de succès
      const agent = state.agents.find((a) => a.id === d.agent_id);
      if (agent) {
        get().addNewMessage({
          agent_id: agent.id,
          niveau: "N1",
          type: "Information",
          sujet: `🎯 Récupération réussie — ${d.client}`,
          contenu: `${agent.nom.split(" ")[0]}: ${d.client} revient chez nous ! Honoraires +50% sur cette mission. Beau coup de pression dans les négos.`,
          delai_reponse_heures: 24,
        });
      }
      get().addXP(30);
      return true;
    } else {
      // Échec : -3 légitimité
      set((s) => ({ legitimite: Math.max(0, s.legitimite - 3) }));
      return false;
    }
  },

  toggleVIP: (id) => {
    const state = get();
    const d = state.dossiers.find((x) => x.id === id);
    if (!d) return;
    const vipCount = state.dossiers.filter(x => x.is_vip).length;
    if (!d.is_vip && vipCount >= 3) return; // Max 3 VIP
    set((s) => ({
      dossiers: s.dossiers.map((x) => x.id === id ? { ...x, is_vip: !x.is_vip } : x),
    }));
  },

  // ── DEC PREP ────────────────────────────────────────────────────────────
  markDeontoCompleted: (questionIds) => {
    set((s) => ({
      dec_today_deonto: true,
      dec_completed_deonto_ids: Array.from(new Set([...s.dec_completed_deonto_ids, ...questionIds])).slice(-200),
    }));
    const s = get();
    if (s.dec_today_mission && s.dec_last_day !== s.game_day) {
      set({ dec_streak: s.dec_streak + 1, dec_last_day: s.game_day });
    }
    persistDec(get());
  },

  markMissionCompleted: (missionId) => {
    set((s) => ({
      dec_today_mission: true,
      dec_completed_mission_ids: Array.from(new Set([...s.dec_completed_mission_ids, missionId])),
    }));
    const s = get();
    if (s.dec_today_deonto && s.dec_last_day !== s.game_day) {
      set({ dec_streak: s.dec_streak + 1, dec_last_day: s.game_day });
    }
    persistDec(get());
  },

  addBadge: (badge) => {
    set((s) => ({
      dec_badges: s.dec_badges.includes(badge) ? s.dec_badges : [...s.dec_badges, badge],
    }));
    persistDec(get());
  },

  markTaskCompleted: (taskId) => {
    set((s) => {
      const next = Array.from(new Set([...s.completed_tasks, taskId]));
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("completed_tasks", JSON.stringify(next));
        }
      } catch {}
      return { completed_tasks: next };
    });
  },

  loadLocalPersistence: () => {
    if (typeof window === "undefined") return;
    try {
      const tasks = localStorage.getItem("completed_tasks");
      if (tasks) {
        const arr = JSON.parse(tasks);
        if (Array.isArray(arr)) set({ completed_tasks: arr });
      }
      const dec = localStorage.getItem("dec_state");
      if (dec) {
        const d = JSON.parse(dec);
        set((s) => ({
          dec_completed_deonto_ids: d.deonto || s.dec_completed_deonto_ids,
          dec_completed_mission_ids: d.mission || s.dec_completed_mission_ids,
          dec_badges: d.badges || s.dec_badges,
          dec_streak: d.streak ?? s.dec_streak,
          dec_last_day: d.last_day ?? s.dec_last_day,
        }));
      }
    } catch (e) {
      console.warn("[Store] loadLocalPersistence failed:", e);
    }
  },

  talkAgent: (agentId) => {
    const state = get();
    const agent = state.agents.find((a) => a.id === agentId);
    if (!agent) return { ok: false, reason: "Agent introuvable" };
    const cd = state.agent_cooldowns[agentId]?.talk;
    if (cd && state.game_day < cd) return { ok: false, reason: `Disponible au jour ${cd}` };

    set((s) => ({
      agents: s.agents.map((a) => a.id === agentId ? {
        ...a,
        confiance_joueur: Math.min(100, a.confiance_joueur + 3),
        respect: Math.min(100, a.respect + 1),
        stress: Math.max(0, a.stress - 2),
      } : a),
      agent_cooldowns: { ...s.agent_cooldowns, [agentId]: { ...s.agent_cooldowns[agentId], talk: s.game_day + 1 } },
      agent_player_history: {
        ...s.agent_player_history,
        [agentId]: [{ day: s.game_day, hour: s.game_hour, event: "Échange informel", impact: "+3 Confiance · −2 Stress" }, ...(s.agent_player_history[agentId] || [])].slice(0, 20),
      },
    }));
    get().recomputeTeamHealth();
    return { ok: true };
  },

  rewardAgent: (agentId) => {
    const state = get();
    const agent = state.agents.find((a) => a.id === agentId);
    if (!agent) return { ok: false, reason: "Agent introuvable" };
    const cd = state.agent_cooldowns[agentId]?.reward;
    if (cd && state.game_day < cd) return { ok: false, reason: `Récompense déjà donnée — re-disponible jour ${cd}` };

    set((s) => ({
      agents: s.agents.map((a) => a.id === agentId ? {
        ...a,
        confiance_joueur: Math.min(100, a.confiance_joueur + 7),
        loyaute: Math.min(100, a.loyaute + 5),
        stress: Math.max(0, a.stress - 5),
        emotion: "Euphorique",
      } : a),
      legitimite: Math.min(100, s.legitimite + 2),
      agent_cooldowns: { ...s.agent_cooldowns, [agentId]: { ...s.agent_cooldowns[agentId], reward: s.game_day + 7 } },
      agent_player_history: {
        ...s.agent_player_history,
        [agentId]: [{ day: s.game_day, hour: s.game_hour, event: "Récompense (prime/reconnaissance)", impact: "+7 Confiance · +5 Loyauté · +2 Légitimité" }, ...(s.agent_player_history[agentId] || [])].slice(0, 20),
      },
    }));
    get().recomputeTeamHealth();
    return { ok: true };
  },

  reprimandAgent: (agentId) => {
    const state = get();
    const agent = state.agents.find((a) => a.id === agentId);
    if (!agent) return { ok: false, reason: "Agent introuvable" };
    const cd = state.agent_cooldowns[agentId]?.reprimand;
    if (cd && state.game_day < cd) return { ok: false, reason: `Disponible au jour ${cd}` };

    // Si déjà bas confiance + Trait fier → risque démission
    const risqueDemission = agent.confiance_joueur < 30 && (agent as any).trait_dominant === "Ambitieux";

    set((s) => ({
      agents: s.agents.map((a) => a.id === agentId ? {
        ...a,
        confiance_joueur: Math.max(0, a.confiance_joueur - 6),
        peur: Math.min(100, a.peur + 10),
        stress: Math.min(100, a.stress + 5),
        emotion: "Frustré",
      } : a),
      legitimite: Math.min(100, s.legitimite + 1),
      agent_cooldowns: { ...s.agent_cooldowns, [agentId]: { ...s.agent_cooldowns[agentId], reprimand: s.game_day + 3 } },
      agent_player_history: {
        ...s.agent_player_history,
        [agentId]: [{ day: s.game_day, hour: s.game_hour, event: "Réprimande", impact: risqueDemission ? "⚠ RISQUE DÉMISSION · −6 Confiance · +10 Peur" : "−6 Confiance · +10 Peur · +5 Stress" }, ...(s.agent_player_history[agentId] || [])].slice(0, 20),
      },
    }));
    get().recomputeTeamHealth();
    return { ok: true };
  },

  trainAgent: (agentId) => {
    const state = get();
    const agent = state.agents.find((a) => a.id === agentId);
    if (!agent) return { ok: false, reason: "Agent introuvable" };
    if (state.points_action < 1) return { ok: false, reason: "1 PA requis" };
    if (state.tresorerie < 3000) return { ok: false, reason: "3 000 € requis" };
    const cd = state.agent_cooldowns[agentId]?.train;
    if (cd && state.game_day < cd) return { ok: false, reason: `Formation suivante au jour ${cd}` };

    set((s) => ({
      points_action: s.points_action - 1,
      tresorerie: s.tresorerie - 3000,
      agents: s.agents.map((a) => a.id === agentId ? {
        ...a,
        confiance_joueur: Math.min(100, a.confiance_joueur + 4),
        loyaute: Math.min(100, a.loyaute + 3),
        fatigue: Math.max(0, a.fatigue - 15),
        stress: Math.max(0, a.stress - 10),
        emotion: "Concentré",
      } : a),
      agent_cooldowns: { ...s.agent_cooldowns, [agentId]: { ...s.agent_cooldowns[agentId], train: s.game_day + 10 } },
      agent_player_history: {
        ...s.agent_player_history,
        [agentId]: [{ day: s.game_day, hour: s.game_hour, event: "Formation 1 journée", impact: "−15 Fatigue · −10 Stress · +4 Confiance · −3k€" }, ...(s.agent_player_history[agentId] || [])].slice(0, 20),
      },
    }));
    get().recomputeTeamHealth();
    get().saveGameState();
    return { ok: true };
  },

  recomputeTeamHealth: () => {
    set((state) => {
      if (state.agents.length === 0) return state;
      const avgConfiance = state.agents.reduce((s, a) => s + a.confiance_joueur, 0) / state.agents.length;
      const avgStress = state.agents.reduce((s, a) => s + a.stress, 0) / state.agents.length;
      const avgFatigue = state.agents.reduce((s, a) => s + a.fatigue, 0) / state.agents.length;
      const avgLoyaute = state.agents.reduce((s, a) => s + a.loyaute, 0) / state.agents.length;
      const health = Math.round((avgConfiance + (100 - avgStress) + (100 - avgFatigue) + avgLoyaute) / 4);
      // Seuil critique : <50 → mood "En Crise"
      const mood = health < 50 && state.mood_global !== "En Crise" ? "En Crise" : state.mood_global;
      return { team_health: health, mood_global: mood };
    });
  },

  // Réinitialise les drapeaux du jour quand on change de jour de jeu
  checkDecRollover: () => {
    set((s) => {
      if (s.dec_last_day !== s.game_day && (s.dec_today_deonto || s.dec_today_mission)) {
        // Si on a sauté un jour sans rien faire → streak reset
        const skipped = s.game_day - s.dec_last_day > 1;
        return {
          dec_today_deonto: false,
          dec_today_mission: false,
          dec_streak: skipped ? 0 : s.dec_streak,
        };
      }
      return {} as any;
    });
  },
}));
