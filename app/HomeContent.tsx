"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/supabase-store";
import { supabase } from "@/lib/supabase";
import { apiFetch, hasUserApiKey } from "@/lib/api-client";

import { Sidebar, type Tab, CabinetLogo } from "./_components/Sidebar";
import { MessagesView } from "./_components/MessagesView";
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

  // Sprint 2 : Nouveaux prospects tous les 3 jours
  useEffect(() => {
    if (!store.isAuthenticated || store.isLoading) return;
    if (store.game_day >= store.last_prospect_day + 3 && store.prospects_pending.length === 0) {
      store.generateProspects();
    }
  }, [store.game_day, store.isAuthenticated, store.isLoading]);

  // Ouvre le modal prospects dès qu'il y a des prospects en attente
  useEffect(() => {
    if (store.prospects_pending.length > 0) setShowProspects(true);
  }, [store.prospects_pending.length]);

  // Test santé API
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
    const t = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [store.isAuthenticated]);

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
    <div className="flex h-screen bg-[#F2F2F7] overflow-hidden">
      <Sidebar
        activeTab={activeTab} setActiveTab={setActiveTab}
        unreadCount={unreadCount} dossiersAlerte={dossiersAlerte} tasksDispos={tasksDispos}
        onOpenKeyModal={() => setShowKeyModal(true)}
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
      </div>

      <ApiKeyModal
        open={showKeyModal} onClose={() => setShowKeyModal(false)}
        onStatusChange={handleStatusChange}
        apiStatus={apiStatus} apiStatusReason={apiStatusReason}
        apiStatusDetails={apiStatusDetails}
      />

      <ClaudeFloating />

      {showProspects && <ProspectsModal onClose={() => setShowProspects(false)} />}
    </div>
  );
}
