"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/supabase-store";
import { signOut } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Mail, Users, Calendar, FolderOpen, GraduationCap, ClipboardCheck, LogOut, Settings, Trophy, Clock as ClockIcon, RefreshCw, Key, BarChart3, UserPlus, Sun, Moon, Monitor, RotateCcw, BookOpen, Grid3x3 } from "lucide-react";
import { ClaudeTuteur } from "./ClaudeTuteur";
import { useTheme } from "./ThemeProvider";

export type Tab = "messages" | "equipe" | "agenda" | "tasks" | "dossiers" | "affectations" | "fiscal" | "rh" | "dec" | "corrections";

interface Props {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  unreadCount: number;
  dossiersAlerte: number;
  tasksDispos: number;
  onOpenKeyModal: () => void;
  onOpenClaudeChat?: () => void;
  onTuteurAction?: (action: { type: "talk_agent" | "open_tab"; agentId?: string; tab?: string }) => void;
  apiStatus: "checking" | "ok" | "error";
  apiStatusReason: string;
  generatingEvents: boolean;
}

export function CabinetLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#007AFF" />
          <stop offset="0.5" stopColor="#5856D6" />
          <stop offset="1" stopColor="#AF52DE" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#lg1)" />
      <path d="M8 8.5h7.5c3.59 0 6.5 2.91 6.5 6.5v2c0 3.59-2.91 6.5-6.5 6.5H8V8.5z" stroke="white" strokeWidth="2" strokeLinejoin="round" fill="none" opacity="0.95" />
      <circle cx="11.5" cy="16" r="1.2" fill="white" />
    </svg>
  );
}

// Couleurs pastel pour les bulles de nav (style PHDDEC)
const navColors: Record<Tab, { bg: string; ring: string; text: string }> = {
  messages: { bg: "bg-[#FFE5DC]", ring: "ring-[#FFB59B]", text: "text-[#D2691E]" },
  equipe: { bg: "bg-[#E0F2E9]", ring: "ring-[#7BC9A0]", text: "text-[#1B7A4B]" },
  agenda: { bg: "bg-[#E5EFFF]", ring: "ring-[#7FA8E8]", text: "text-[#2456A8]" },
  tasks: { bg: "bg-[#FFF4DB]", ring: "ring-[#FFD478]", text: "text-[#A07000]" },
  dossiers: { bg: "bg-[#F0E6FF]", ring: "ring-[#B698E8]", text: "text-[#6A38A8]" },
  affectations: { bg: "bg-[#FFEFD6]", ring: "ring-[#FFC97A]", text: "text-[#995500]" },
  fiscal: { bg: "bg-[#E0EAFF]", ring: "ring-[#7B9AE8]", text: "text-[#2440A0]" },
  rh: { bg: "bg-[#FFE5F0]", ring: "ring-[#E89BC4]", text: "text-[#A02868]" },
  dec: { bg: "bg-[#E8F4F8]", ring: "ring-[#7BC4D4]", text: "text-[#1F6A82]" },
  corrections: { bg: "bg-[#F0E6FF]", ring: "ring-[#AF52DE]", text: "text-[#6A38A8]" },
};

export function Sidebar(props: Props) {
  const router = useRouter();
  const store = useGameStore();
  const { theme, setTheme } = useTheme();

  const navItems: { id: Tab; icon: any; label: string; badge?: number }[] = [
    { id: "messages", icon: Mail, label: "Messagerie", badge: props.unreadCount },
    { id: "equipe", icon: Users, label: "Équipe" },
    { id: "agenda", icon: Calendar, label: "Agenda" },
    { id: "tasks", icon: ClipboardCheck, label: "Tâches", badge: props.tasksDispos },
    { id: "dossiers", icon: FolderOpen, label: "Dossiers", badge: props.dossiersAlerte },
    { id: "affectations", icon: Grid3x3, label: "Affectations" },
    { id: "fiscal", icon: BarChart3, label: "Suivi Fiscal" },
    { id: "rh", icon: UserPlus, label: "RH" },
    { id: "dec", icon: GraduationCap, label: "DEC Prep" },
    { id: "corrections", icon: BookOpen, label: "Corrections", badge: store.chat_corrections.filter((c) => c.game_day === store.game_day).length },
  ];

  function handleLogout() {
    signOut();
    router.push("/auth");
  }

  return (
    <aside className="w-[280px] bg-white/40 dark:bg-[#1c1c1e]/85 backdrop-blur-3xl border-r border-white/60 dark:border-[#38383a]/60 flex flex-col z-10 shadow-[1px_0_24px_rgba(0,0,0,0.04)]">
      {/* Header logo */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 rounded-[14px] bg-white/80 dark:bg-[#2c2c2e] backdrop-blur flex items-center justify-center shadow-sm">
            <CabinetLogo size={26} />
          </div>
          <div>
            <div className="font-semibold text-[16px] text-[#1D1D1F] dark:text-white leading-tight tracking-[-0.01em]">Cabinet DEC</div>
            <div className="text-[11px] text-[#86868B] dark:text-[#a0a0a5] tracking-tight">Morel &amp; Associés</div>
          </div>
        </div>
      </div>

      {/* Navigation principale */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = props.activeTab === item.id;
          const colors = navColors[item.id];
          return (
            <button
              key={item.id}
              onClick={() => props.setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-[14px] text-[14px] transition-all group ${
                isActive ? "bg-white/80 dark:bg-[#2c2c2e] shadow-sm" : "hover:bg-white/40 dark:hover:bg-[#2c2c2e]/60"
              }`}
            >
              <div className={`w-8 h-8 rounded-[10px] ${colors.bg} ${isActive ? "ring-2 " + colors.ring : ""} flex items-center justify-center shrink-0 transition-all`}>
                <Icon size={15} className={colors.text} />
              </div>
              <span className={`flex-1 text-left font-medium ${isActive ? "text-[#1D1D1F] dark:text-white" : "text-[#3a3a3c] dark:text-[#d0d0d5]"}`}>{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center ${isActive ? "bg-[#1D1D1F] text-white" : "bg-[#FF3B30] text-white"}`}>
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Niveau joueur + XP — compact, sous la nav */}
      <div className="px-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FF9500] to-[#FF3B30] flex items-center justify-center shadow-sm">
            <Trophy size={12} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-[#1D1D1F] dark:text-white">Niveau {store.player_level}</div>
            <div className="mt-1 h-[3px] bg-[#E5E5EA] dark:bg-[#2c2c2e] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#FF9500] to-[#FF3B30] rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (store.player_xp / store.xp_to_next) * 100)}%` }} />
            </div>
          </div>
          <span className="text-[10px] text-[#86868B] dark:text-[#a0a0a5] tabular-nums">{store.player_xp}/{store.xp_to_next}</span>
        </div>
      </div>

      {/* Claude Tuteur — bulle contextuelle */}
      <ClaudeTuteur onOpenChat={props.onOpenClaudeChat || (() => {})} onQuickAction={props.onTuteurAction} />

      {/* Section APPARENCE (style PHDDEC) */}
      <div className="px-4 py-3 border-t border-white/60 dark:border-[#38383a]">
        <div className="text-[10px] font-bold text-[#86868B] dark:text-[#a0a0a5] uppercase tracking-[0.1em] mb-2">Apparence</div>
        <div className="flex items-center gap-1 bg-white/60 dark:bg-[#1c1c1e] backdrop-blur rounded-full p-1">
          {[
            { id: "light" as const, icon: Sun, label: "Clair" },
            { id: "auto" as const, icon: Monitor, label: "Auto" },
            { id: "dark" as const, icon: Moon, label: "Sombre" },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = theme === t.id;
            return (
              <button key={t.id} onClick={() => setTheme(t.id)}
                title={t.label}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-full transition-all ${
                  isActive ? "bg-white dark:bg-[#3a3a3c] shadow-sm" : "hover:bg-white/40 dark:hover:bg-[#2c2c2e]"
                }`}>
                <Icon size={13} className={isActive ? "text-[#1D1D1F] dark:text-white" : "text-[#86868B] dark:text-[#a0a0a5]"} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Profil utilisateur */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-3 bg-white/60 dark:bg-[#1c1c1e] backdrop-blur rounded-[16px] p-2.5 border border-white/80 dark:border-[#38383a]">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1D1D1F] to-[#3a3a3c] dark:from-white dark:to-[#d0d0d5] flex items-center justify-center font-bold text-[14px] text-white dark:text-[#1D1D1F]">
            M
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white truncate">Toi</div>
            <div className="text-[10px] text-[#86868B] dark:text-[#a0a0a5] truncate">Expert-comptable associé</div>
          </div>
          <button
            onClick={() => {
              if (confirm("⚠️ Réinitialiser le jeu ?\n\nToutes tes données seront supprimées : dossiers, agents, messages, conversations, scores. Tu repars de zéro.\n\nContinuer ?")) {
                store.resetGame();
              }
            }}
            title="Réinitialiser le jeu (repartir de zéro)"
            className="w-7 h-7 rounded-full bg-white dark:bg-[#2c2c2e] hover:bg-[#FF9500]/10 dark:hover:bg-[#FF9500]/20 flex items-center justify-center transition-colors group">
            <RotateCcw size={12} className="text-[#86868B] dark:text-[#a0a0a5] group-hover:text-[#FF9500]" />
          </button>
          <button onClick={handleLogout} className="w-7 h-7 rounded-full bg-white dark:bg-[#2c2c2e] hover:bg-[#FF3B30]/10 dark:hover:bg-[#FF3B30]/20 flex items-center justify-center transition-colors group">
            <LogOut size={12} className="text-[#86868B] dark:text-[#a0a0a5] group-hover:text-[#FF3B30]" />
          </button>
        </div>
      </div>

    </aside>
  );
}
