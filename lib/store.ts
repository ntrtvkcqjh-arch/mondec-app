"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

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
}

export interface Message {
  id: string;
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
}

export interface GameState {
  legitimite: number;
  tresorerie: number;
  reputation: number;
  stress_global: number;
  points_action: number;
  points_action_max: number;
  date_simulation: string;
  mood_global: string;
  agents: Agent[];
  messages: Message[];
  conversation_history: Record<string, {role: string; content: string}[]>;

  setResources: (res: Partial<Pick<GameState, "legitimite" | "tresorerie" | "reputation" | "stress_global" | "points_action">>) => void;
  markMessageRead: (id: string) => void;
  replyToMessage: (id: string, reply: string) => void;
  spendPA: (amount: number) => boolean;
  addConversation: (agentId: string, role: "user" | "assistant", content: string) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      legitimite: 72,
      tresorerie: 145000,
      reputation: 68,
      stress_global: 61,
      points_action: 3,
      points_action_max: 3,
      date_simulation: "14 mai 2026",
      mood_global: "Sous Pression",
      agents: [],
      messages: [],
      conversation_history: {},

      setResources: (res) => set((state) => ({ ...state, ...res })),

      markMessageRead: (id) =>
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, lu: true } : m
          ),
        })),

      replyToMessage: (id, _reply) =>
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, repondu: true } : m
          ),
        })),

      spendPA: (amount) => {
        const state = get();
        if (state.points_action >= amount) {
          set({ points_action: state.points_action - amount });
          return true;
        }
        return false;
      },

      addConversation: (agentId, role, content) =>
        set((state) => ({
          conversation_history: {
            ...state.conversation_history,
            [agentId]: [
              ...(state.conversation_history[agentId] || []),
              { role, content },
            ].slice(-10),
          },
        })),
    }),
    {
      name: "cabinet-dec-storage",
    }
  )
);
