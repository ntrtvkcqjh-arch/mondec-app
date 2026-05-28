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
  etat: "en_cours" | "alerte" | "gagne" | "perdu";
  progression: number;
  phase: "P1" | "P2" | "P3" | "P4" | "P5";
  echeance_heure: string;
  impact: {
    legitimite: number;
    reputation: number;
    tresorerie: number;
    stress: number;
  };
}

export interface ClaudeMsg {
  role: "user" | "assistant";
  content: string;
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

  agents: Agent[];
  messages: Message[];
  dossiers: Dossier[];
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
}

const xpForLevel = (level: number) => 100 + level * 50;

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

  agents: [],
  messages: [],
  dossiers: [],
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
          });
        });
      });
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
    set((state) => {
      const d = state.dossiers.find((x) => x.id === id);
      if (!d || d.etat !== "en_cours") return state;
      const updated = state.dossiers.map((x) =>
        x.id === id ? { ...x, etat: "gagne" as const, progression: 100 } : x
      );
      return {
        dossiers: updated,
        legitimite: Math.min(100, state.legitimite + d.impact.legitimite),
        reputation: Math.min(100, state.reputation + d.impact.reputation),
        tresorerie: state.tresorerie + d.impact.tresorerie,
        stress_global: Math.max(0, state.stress_global - Math.floor(d.impact.stress / 2)),
      };
    });
    get().saveGameState();
  },

  loseDossier: (id) => {
    set((state) => {
      const d = state.dossiers.find((x) => x.id === id);
      if (!d || d.etat !== "en_cours") return state;
      const updated = state.dossiers.map((x) =>
        x.id === id ? { ...x, etat: "perdu" as const, progression: 0 } : x
      );
      return {
        dossiers: updated,
        legitimite: Math.max(0, state.legitimite - d.impact.legitimite),
        reputation: Math.max(0, state.reputation - d.impact.reputation),
        tresorerie: Math.max(0, state.tresorerie - Math.floor(d.impact.tresorerie / 2)),
        stress_global: Math.min(100, state.stress_global + d.impact.stress),
      };
    });
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
}));
