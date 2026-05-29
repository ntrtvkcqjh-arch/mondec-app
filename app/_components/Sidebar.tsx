"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/supabase-store";
import { signOut } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Mail, Users, Calendar, FolderOpen, GraduationCap, ClipboardCheck, LogOut, Settings, Trophy, Clock as ClockIcon, RefreshCw, Key, BarChart3, UserPlus } from "lucide-react";
import { apiFetch, getUserApiKey, hasUserApiKey } from "@/lib/api-client";

export type Tab = "messages" | "equipe" | "agenda" | "tasks" | "dossiers" | "fiscal" | "rh" | "dec";

interface Props {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  unreadCount: number;
  dossiersAlerte: number;
  tasksDispos: number;
  onOpenKeyModal: () => void;
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

function RealClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    function update() { setTime(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })); }
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-mono text-[11px] text-[#86868B] tabular-nums">{time}</span>;
}

function MiniStat({ label, value, color, display }: { label: string; value: number; color: string; display?: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-[#86868B]">{label}</span>
        <span className="font-medium text-[#3a3a3c]">{display || Math.round(value)}</span>
      </div>
      <div className="h-[3px] bg-[#E5E5EA] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function Sidebar(props: Props) {
  const router = useRouter();
  const store = useGameStore();

  const navItems = [
    { id: "messages" as Tab, icon: Mail, label: "Messages", badge: props.unreadCount },
    { id: "equipe" as Tab, icon: Users, label: "Équipe" },
    { id: "agenda" as Tab, icon: Calendar, label: "Agenda" },
    { id: "tasks" as Tab, icon: ClipboardCheck, label: "Tâches", badge: props.tasksDispos },
    { id: "dossiers" as Tab, icon: FolderOpen, label: "Dossiers", badge: props.dossiersAlerte },
    { id: "fiscal" as Tab, icon: BarChart3, label: "Suivi Fiscal" },
    { id: "rh" as Tab, icon: UserPlus, label: "RH" },
    { id: "dec" as Tab, icon: GraduationCap, label: "DEC Prep" },
  ];

  function handleLogout() {
    signOut();
    router.push("/auth");
  }

  return (
    <aside className="w-[248px] bg-white/80 backdrop-blur-2xl border-r border-[#E5E5EA] flex flex-col z-10 shadow-[1px_0_0_rgba(0,0,0,0.04)]">
      <div className="px-5 pt-5 pb-4 border-b border-[#E5E5EA]/60">
        <div className="flex items-center gap-3 mb-3">
          <CabinetLogo size={36} />
          <div>
            <div className="font-semibold text-[15px] text-[#1D1D1F] leading-tight tracking-[-0.01em]">Cabinet DEC</div>
            <div className="text-[11px] text-[#86868B] tracking-tight">Morel &amp; Associés</div>
          </div>
        </div>

        {/* Horloge JEU */}
        <div className="mt-3 bg-gradient-to-r from-[#007AFF]/10 to-[#5e5ce6]/10 rounded-[10px] p-2.5 border border-[#007AFF]/15">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ClockIcon size={11} className="text-[#007AFF]" />
              <span className="text-[10px] font-medium text-[#007AFF] uppercase tracking-wide">Jour {store.game_day}</span>
            </div>
            <RealClock />
          </div>
          <div className="font-mono text-[24px] font-bold text-[#1D1D1F] tabular-nums leading-none mt-1">
            {String(store.game_hour).padStart(2, "0")}:{String(store.game_minute).padStart(2, "0")}
          </div>
          <div className="text-[9px] text-[#86868B] mt-0.5">{store.date_simulation}</div>
        </div>

        {/* Niveau joueur */}
        <div className="mt-2.5 bg-white/70 rounded-[10px] p-2.5 border border-[#E5E5EA]/40">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Trophy size={11} className="text-[#FF9500]" />
              <span className="text-[10px] font-semibold text-[#1D1D1F] uppercase">Niveau {store.player_level}</span>
            </div>
            <span className="text-[10px] text-[#86868B] tabular-nums">{store.player_xp}/{store.xp_to_next} XP</span>
          </div>
          <div className="h-[5px] bg-[#E5E5EA] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#FF9500] to-[#FF3B30] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (store.player_xp / store.xp_to_next) * 100)}%` }} />
          </div>
        </div>

        {/* Statut API */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${
              props.apiStatus === "ok" ? "bg-[#34C759] animate-pulse" :
              props.apiStatus === "error" ? "bg-[#FF3B30]" :
              "bg-[#FF9500]"
            }`} />
            <span className={`text-[9px] font-medium ${
              props.apiStatus === "ok" ? "text-[#34C759]" :
              props.apiStatus === "error" ? "text-[#FF3B30]" :
              "text-[#FF9500]"
            }`}>
              {props.apiStatus === "ok" ? "IA Claude connectée" : props.apiStatus === "error" ? "IA hors ligne" : "Vérification…"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {props.generatingEvents && <RefreshCw size={9} className="text-[#007AFF] animate-spin" />}
            <button onClick={props.onOpenKeyModal} title="Configurer ma clé API"
              className="p-0.5 rounded hover:bg-black/10 transition-all">
              <Settings size={11} className="text-[#86868B]" />
            </button>
          </div>
        </div>

        {props.apiStatus === "error" && (
          <button onClick={props.onOpenKeyModal}
            className="mt-1.5 w-full text-left text-[9px] text-[#FF3B30] bg-[#FF3B30]/5 border border-[#FF3B30]/15 hover:bg-[#FF3B30]/10 rounded-md px-1.5 py-1 leading-tight transition-all flex items-center gap-1">
            <Key size={9} className="shrink-0" />
            <span className="flex-1 truncate">{props.apiStatusReason || "Configurer ma clé API"}</span>
          </button>
        )}
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} onClick={() => props.setActiveTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] transition-all ${props.activeTab === item.id ? "bg-gradient-to-r from-[#007AFF] to-[#0a84ff] text-white shadow-md" : "text-[#1D1D1F] hover:bg-black/5"}`}>
              <Icon size={16} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge ? <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${props.activeTab === item.id ? "bg-white/25 text-white" : "bg-[#FF3B30] text-white"}`}>{item.badge}</span> : null}
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-[#E5E5EA]/40 space-y-2">
        <MiniStat label="Légitimité" value={store.legitimite} color="#007AFF" />
        <MiniStat label="Trésorerie" value={Math.min((store.tresorerie / 2000), 100)} color="#34C759" display={`${(store.tresorerie / 1000).toFixed(0)}k€`} />
        <MiniStat label="Réputation" value={store.reputation} color="#FF9500" />
        <MiniStat label="Stress" value={store.stress_global} color={store.stress_global > 70 ? "#FF3B30" : "#FF9500"} />
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-[#86868B]">Points d'Action</span>
          <div className="flex gap-1">
            {Array.from({ length: store.points_action_max }).map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-all ${i < store.points_action ? "bg-[#007AFF]" : "bg-[#E5E5EA]"}`} />
            ))}
          </div>
        </div>
        <div className="text-center py-1 px-2 bg-[#F5F5F7] rounded-lg">
          <span className="text-[10px] font-medium text-[#86868B]">Mood · {store.mood_global}</span>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-[#86868B] hover:text-[#FF3B30] transition-colors rounded-lg hover:bg-[#FF3B30]/5">
          <LogOut size={12} /> Déconnexion
        </button>
      </div>
    </aside>
  );
}
