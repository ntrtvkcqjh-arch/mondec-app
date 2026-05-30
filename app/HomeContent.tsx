"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/supabase-store";
import { supabase } from "@/lib/supabase";
import { apiFetch, hasUserApiKey } from "@/lib/api-client";

import { Sidebar, type Tab, CabinetLogo } from "./_components/Sidebar";
import { MessagesView } from "./_components/MessagesView";
import { MorningBriefingModal } from "./_components/MorningBriefingModal";
import { EveningRecapModal } from "./_components/EveningRecapModal";
import { CorrectionsView } from "./_components/CorrectionsView";
import { EquipeView } from "./_components/EquipeView";
import { AgendaView } from "./_components/AgendaView";
import { DossiersView } from "./_components/DossiersView";
import { TasksView } from "./_components/TasksView";
import { DecPrepView } from "./_components/DecPrepView";
import { SuiviFiscalView } from "./_components/SuiviFiscalView";
import { RhView } from "./_components/RhView";
import { ClaudeFloating } from "./_components/ClaudeFloating";
import { ApiKeyModal } from "./_components/ApiKeyModal";
import { ProspectsModal } from "./_components/ProspectsModal";
import { CascadeNotifications } from "./_components/CascadeNotifications";

export default function HomeContent() {
  const router = useRouter();
  const store = useGameStore();

  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [generatingEvents, setGeneratingEvents] = useState(false);
  const [showProspects, setShowProspects] = useState(false);

  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "error">("checking");
  const [apiStatusReason, setApiStatusReason] = useState("");
  const [apiStatusDetails, setApiStatusDetails] = useState<any>(null);
  const [showBriefing, setShowBriefing] = useState(false);
  const [showEveningRecap, setShowEveningRecap] = useState(false);

  // Briefing matinal : se déclenche à 8h30 (game-time) une seule fois par game_day
  useEffect(() => {
    if (!store.isAuthenticated || store.isLoading) return;
    if (typeof window === "undefined") return;
    if (store.agents.length === 0) return;
    // Fenêtre de déclenchement : 8h30 → 10h (au cas où le tick saute 8h30 exact)
    const minutesNow = store.game_hour * 60 + store.game_minute;
    if (minutesNow < 8 * 60 + 30 || minutesNow > 10 * 60) return;
    const lastBriefingDay = parseInt(localStorage.getItem("last_briefing_day") || "0");
    if (lastBriefingDay !== store.game_day) {
      setShowBriefing(true);
      localStorage.setItem("last_briefing_day", String(store.game_day));
    }
  }, [store.game_day, store.game_hour, store.game_minute, store.isAuthenticated, store.isLoading, store.agents.length]);

  // Récap fin de journée : 1x par game_day quand game_hour >= 18
  useEffect(() => {
    if (!store.isAuthenticated || store.isLoading) return;
    if (typeof window === "undefined") return;
    if (store.game_hour < 18) return;
    if (store.agents.length === 0) return;
    const lastRecapDay = parseInt(localStorage.getItem("last_evening_recap_day") || "0");
    if (lastRecapDay !== store.game_day) {
      setShowEveningRecap(true);
      localStorage.setItem("last_evening_recap_day", String(store.game_day));
    }
  }, [store.game_day, store.game_hour, store.isAuthenticated, store.isLoading, store.agents.length]);

  useEffect(() => {
    store.loadGameState();
    store.loadLocalPersistence();
  }, []);

  useEffect(() => {
    if (!store.isLoading && !store.isAuthenticated) router.push("/auth");
  }, [store.isLoading, store.isAuthenticated, router]);

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_OUT") router.push("/auth");
    });
    return () => sub.data.subscription.unsubscribe();
  }, [router]);

  // Horloge persistante
  useEffect(() => {
    if (!store.isAuthenticated || store.isLoading) return;
    store.syncClockFromTimestamp();
    const t = setInterval(() => store.syncClockFromTimestamp(), 1000);
    return () => clearInterval(t);
  }, [store.isAuthenticated, store.isLoading]);

  // Sprint 2 : 1-3 nouveaux prospects chaque jour
  useEffect(() => {
    if (!store.isAuthenticated || store.isLoading) return;
    if (store.last_prospect_day !== store.game_day && store.prospects_pending.length === 0) {
      store.generateProspects();
    }
  }, [store.game_day, store.isAuthenticated, store.isLoading]);

  // Ouvre le modal prospects UNIQUEMENT si le joueur n'a pas déjà fermé le batch du jour
  useEffect(() => {
    if (store.prospects_pending.length === 0) return;
    if (store.prospects_dismissed_for_day === store.game_day) return; // déjà fermé aujourd'hui
    setShowProspects(true);
  }, [store.prospects_pending.length, store.prospects_dismissed_for_day, store.game_day]);

  // Test santé API — poll rapide (30s) si erreur (utile après ajout de crédits),
  // poll lent (5min) si OK
  useEffect(() => {
    if (!store.isAuthenticated) return;
    function check() {
      apiFetch("/api/health").then((r) => r.json()).then((d) => {
        setApiStatus(d.ok ? "ok" : "error");
        setApiStatusReason(d.reason || "");
        setApiStatusDetails(d);
        if (!d.ok && d.needs_key && !hasUserApiKey()) setShowKeyModal(true);
      }).catch(() => {
        setApiStatus("error");
        setApiStatusReason("Réseau indisponible");
      });
    }
    check();
    const interval = apiStatus === "error" ? 30 * 1000 : 5 * 60 * 1000;
    const t = setInterval(check, interval);
    return () => clearInterval(t);
  }, [store.isAuthenticated, apiStatus]);

  // Génération autonome d'événements
  useEffect(() => {
    if (!store.isAuthenticated || store.isLoading) return;
    if (store.agents.length === 0) return;
    const unread = store.messages.filter((m) => !m.lu).length;
    if (unread >= 5) return;
    if (typeof window === "undefined") return;
    const lastGen = localStorage.getItem("lastEventGen");
    const now = Date.now();
    if (lastGen && now - parseInt(lastGen) < 3 * 60 * 1000) return;
    localStorage.setItem("lastEventGen", String(now));
    setGeneratingEvents(true);
    const agentsWithUnread = store.messages.filter((m) => !m.lu).map((m) => m.agent_id);
    apiFetch("/api/events", {
      method: "POST",
      body: JSON.stringify({
        agents: store.agents,
        game_state: {
          date: store.date_simulation, mood: store.mood_global,
          legitimite: store.legitimite, tresorerie: store.tresorerie,
          stress_global: store.stress_global, joursRestants: 16,
          hour: store.game_hour, minute: store.game_minute, day: store.game_day,
        },
        existing_subjects: store.messages.map((m) => m.sujet),
        agents_with_unread: agentsWithUnread,
      }),
    }).then((r) => r.json()).then((data) => {
      if (data.events && data.events.length) {
        for (let i = 0; i < data.events.length; i++) store.addNewMessage(data.events[i]);
      }
    }).catch(() => {}).finally(() => setGeneratingEvents(false));
  }, [store.isAuthenticated, store.isLoading, store.agents.length]);

  if (store.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7]">
        <div className="text-center space-y-4">
          <div className="inline-block animate-pulse"><CabinetLogo size={56} /></div>
          <p className="text-[#1D1D1F] text-[15px] font-medium tracking-tight">Cabinet DEC</p>
          <p className="text-[#86868B] text-[12px]">Chargement du cabinet…</p>
        </div>
      </div>
    );
  }

  const unreadCount = store.messages.filter((m) => !m.lu).length;
  const dossiersAlerte = store.dossiers.filter((d) => d.etat === "en_cours" || d.etat === "surveillance").length;
  const tasksDispos = 0;

  function handleStatusChange(status: "ok" | "error", reason: string, details: any) {
    setApiStatus(status);
    setApiStatusReason(reason);
    setApiStatusDetails(details);
  }

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Background : clair = gradient pastel iOS / sombre = noir Apple Dark Mode */}
      <div className="absolute inset-0 -z-10 transition-colors duration-500 dark:hidden" style={{
        background: "linear-gradient(135deg, #FFF1EC 0%, #FCE9F7 30%, #F0EAFF 60%, #E8F4FF 100%)"
      }} />
      <div className="absolute inset-0 -z-10 transition-colors duration-500 hidden dark:block" style={{
        background: "#000000"
      }} />
      {/* Subtle radial highlight en haut (style Apple.com Dark) */}
      <div className="absolute inset-0 -z-10 hidden dark:block pointer-events-none" style={{
        background: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(120,120,255,0.08) 0%, transparent 70%)"
      }} />
      <Sidebar
        activeTab={activeTab} setActiveTab={setActiveTab}
        unreadCount={unreadCount} dossiersAlerte={dossiersAlerte} tasksDispos={tasksDispos}
        onOpenKeyModal={() => setShowKeyModal(true)}
        onOpenClaudeChat={() => {
          // Le panel Claude se trouve dans ClaudeFloating ; on dispatch un event custom
          if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("open-claude-chat"));
        }}
        onTuteurAction={(action) => {
          if (action.type === "talk_agent" && action.agentId) {
            setActiveTab("messages");
            // Pré-sélectionne l'agent dans MessagesView via custom event
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("select-agent", { detail: { agentId: action.agentId } }));
            }
          } else if (action.type === "open_tab" && action.tab) {
            setActiveTab(action.tab as Tab);
          }
        }}
        apiStatus={apiStatus} apiStatusReason={apiStatusReason}
        generatingEvents={generatingEvents}
      />

      <div className="flex-1 flex overflow-hidden">
        {activeTab === "messages" && <MessagesView onOpenKeyModal={() => setShowKeyModal(true)} />}
        {activeTab === "equipe" && <EquipeView />}
        {activeTab === "agenda" && <AgendaView apiStatus={apiStatus} />}
        {activeTab === "tasks" && <TasksView />}
        {activeTab === "dossiers" && <DossiersView />}
        {activeTab === "fiscal" && <SuiviFiscalView />}
        {activeTab === "rh" && <RhView />}
        {activeTab === "dec" && <DecPrepView />}
        {activeTab === "corrections" && <CorrectionsView />}
      </div>

      <ApiKeyModal
        open={showKeyModal} onClose={() => setShowKeyModal(false)}
        onStatusChange={handleStatusChange}
        apiStatus={apiStatus} apiStatusReason={apiStatusReason}
        apiStatusDetails={apiStatusDetails}
      />

      <ClaudeFloating />
      <CascadeNotifications />

      {showProspects && <ProspectsModal onClose={() => { setShowProspects(false); store.dismissProspectsForDay(); }} />}
      {showBriefing && (
        <MorningBriefingModal
          onClose={() => setShowBriefing(false)}
          onNavigate={(tab, payload) => {
            setActiveTab(tab as Tab);
            if (payload?.agentId && typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("select-agent", { detail: { agentId: payload.agentId } }));
            }
          }}
        />
      )}
      {showEveningRecap && <EveningRecapModal onClose={() => setShowEveningRecap(false)} />}
    </div>
  );
}
