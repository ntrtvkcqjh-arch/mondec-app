"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/supabase-store";
import { supabase, signOut } from "@/lib/supabase";
import {
  Mail, Users, Calendar, FolderOpen, GraduationCap, Building2,
  Send, LogOut, ChevronRight, Zap, AlertTriangle, CheckCircle,
  Archive, CornerDownRight, Pencil, RefreshCw, TrendingUp, TrendingDown,
} from "lucide-react";

type Tab = "messages" | "equipe" | "agenda" | "dossiers" | "dec";
type SendPhase = "draft" | "picking" | "waiting" | "scoring";

interface GhostVersion { label: string; sublabel: string; text: string; color: string; }
interface Dilemme { id: string; titre: string; description: string; options: { id: string; label: string; cout_PA: number; consequence_differee: string }[]; }
interface ScoreResult {
  score_global: number;
  breakdown: { precision: number; redaction: number; deontologie: number; contexte: number; operationnel: number };
  feedback: string;
  points_forts: string[];
  axes_amelioration: string[];
  impact: { legitimite_delta: number; confiance_agent_delta: number };
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

function Clock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-mono text-sm text-[#1d1d1f] tabular-nums">{time}</span>;
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

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [phase, setPhase] = useState<SendPhase>("draft");
  const [ghostVersions, setGhostVersions] = useState<GhostVersion[] | null>(null);
  const [dilemme, setDilemme] = useState<Dilemme | null>(null);
  const [dilemmeResolu, setDilemmeResolu] = useState(false);
  const [generatingEvents, setGeneratingEvents] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [lastPlayerMessage, setLastPlayerMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const store = useGameStore();

  useEffect(() => { store.loadGameState(); }, []);

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
    fetch("/agents_config.json").then(r => r.json()).then(c => {
      if (c.dilemme_actif) setDilemme(c.dilemme_actif);
    }).catch(() => {});
  }, []);

  // Génération autonome des événements agents
  useEffect(() => {
    if (!store.isAuthenticated || store.isLoading || store.agents.length === 0) return;
    const unread = store.messages.filter(m => !m.lu).length;
    if (unread >= 5) return;
    const lastGen = typeof window !== "undefined" ? localStorage.getItem("lastEventGen") : null;
    const now = Date.now();
    if (lastGen && now - parseInt(lastGen) < 15 * 60 * 1000) return;
    localStorage.setItem("lastEventGen", now.toString());
    setGeneratingEvents(true);
    const agentsWithUnread = store.messages.filter(m => !m.lu).map(m => m.agent_id);
    fetch("/api/events", {
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [store.conversation_history, selectedAgent, ghostVersions, scoreResult]);

  const selectedMessage = store.messages.find((m) => m.agent_id === selectedAgent && !m.repondu)
    || store.messages.find((m) => m.agent_id === selectedAgent);
  const agent = store.agents.find((a) => a.id === selectedAgent);
  const unreadCount = store.messages.filter(m => !m.lu).length;

  function handleSelectAgent(agentId: string, messageId: string) {
    setSelectedAgent(agentId);
    setGhostVersions(null);
    setPhase("draft");
    setInputText("");
    setScoreResult(null);
    store.markMessageRead(messageId);
    store.loadConversations(agentId);
  }

  // Envoi direct (Enter) — toujours fonctionnel
  async function handleDirectSend() {
    if (!inputText.trim() || !agent || phase !== "draft") return;
    const text = inputText;
    setGhostVersions(null);
    setInputText("");
    await sendAndGetResponse(text);
  }

  // Ghost Writer optionnel (bouton ✨) — propose 3 versions avant envoi
  async function handleGhostDraft() {
    if (!inputText.trim() || !agent || phase !== "draft") return;
    const savedText = inputText;
    setPhase("picking");
    setGhostVersions(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "ghost",
          messages: [{ role: "user", content: savedText }],
          agent_context: { ...agent, sujet: selectedMessage?.sujet },
        }),
      });
      if (!res.ok) throw new Error("api_error");
      const data = await res.json();
      if (!data.content) throw new Error("no_content");
      const versions = parseGhostVersions(data.content);
      if (versions) { setGhostVersions(versions); }
      else { setPhase("draft"); setInputText(""); await sendAndGetResponse(savedText); }
    } catch {
      // GW échoue → envoi direct en fallback
      setPhase("draft");
      setInputText("");
      await sendAndGetResponse(savedText);
    }
  }

  async function handlePickVersion(text: string) {
    setGhostVersions(null);
    setPhase("draft");
    setInputText("");
    await sendAndGetResponse(text);
  }

  async function sendAndGetResponse(text: string) {
    if (!agent) return;
    const niveau = selectedMessage?.niveau || "N2";
    const cost = getPACost(niveau);
    if (cost > 0 && !store.spendPA(cost)) { alert("Pas assez de Points d'Action !"); setPhase("draft"); return; }
    setPhase("waiting");
    setLastPlayerMessage(text);
    setScoreResult(null);

    try {
      const history = store.conversation_history[agent.id] || [];
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "agent",
          messages: [...history, { role: "user", content: text }],
          agent_context: agent,
          game_state: { date: store.date_simulation, mood: store.mood_global, joursRestants: 16 },
        }),
      });

      const data = await res.json();

      if (data.content) {
        await store.addConversation(agent.id, "user", text);
        await store.addConversation(agent.id, "assistant", data.content);
        if (selectedMessage) await store.replyToMessage(selectedMessage.id, text);

        // Score IA en arrière-plan (non-bloquant)
        setPhase("scoring");
        fetch("/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            player_message: text,
            agent_original_message: selectedMessage?.contenu || "",
            agent_response: data.content,
            agent_context: agent,
          }),
        }).then(r => r.json()).then(scoreData => {
          if (scoreData.score_global !== undefined) {
            setScoreResult(scoreData);
            if (scoreData.impact?.legitimite_delta) {
              store.setResources({ legitimite: Math.max(0, Math.min(100, store.legitimite + scoreData.impact.legitimite_delta)) });
            }
          }
        }).catch(() => {}).finally(() => setPhase("draft"));
      } else {
        setPhase("draft");
      }
    } catch {
      setPhase("draft");
    }
  }

  function handleArchive(msgId: string) {
    store.markMessageRead(msgId);
    store.replyToMessage(msgId, "[archivé]");
  }

  function handleDilemme(optionId: string, coutPA: number) {
    if (coutPA > 0 && !store.spendPA(coutPA)) { alert("Pas assez de Points d'Action !"); return; }
    setDilemmeResolu(true);
  }

  if (store.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-[#0071e3] rounded-[18px] flex items-center justify-center mx-auto shadow-lg">
            <Building2 size={32} className="text-white" />
          </div>
          <p className="text-[#6e6e73] text-sm">Chargement du cabinet…</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: "messages" as Tab, icon: Mail, label: "Messages", badge: unreadCount },
    { id: "equipe" as Tab, icon: Users, label: "Équipe" },
    { id: "agenda" as Tab, icon: Calendar, label: "Agenda" },
    { id: "dossiers" as Tab, icon: FolderOpen, label: "Dossiers" },
    { id: "dec" as Tab, icon: GraduationCap, label: "DEC Prep" },
  ];

  return (
    <div className="flex h-screen bg-[#f5f5f7] overflow-hidden">

      {/* ── SIDEBAR ── */}
      <aside className="w-56 glass border-r border-[#d2d2d7]/50 flex flex-col z-10">
        <div className="px-4 py-5 border-b border-[#d2d2d7]/50">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 bg-[#0071e3] rounded-lg flex items-center justify-center">
              <Building2 size={16} className="text-white" />
            </div>
            <span className="font-semibold text-[15px] text-[#1d1d1f]">Cabinet DEC</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-[#6e6e73]">{store.date_simulation}</span>
            <Clock />
          </div>
          {generatingEvents && (
            <div className="flex items-center gap-1 mt-1.5">
              <RefreshCw size={9} className="text-[#0071e3] animate-spin" />
              <span className="text-[9px] text-[#6e6e73]">Agents actifs…</span>
            </div>
          )}
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map(({ id, icon: Icon, label, badge }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] transition-all ${activeTab === id ? "bg-[#0071e3] text-white shadow-sm" : "text-[#1d1d1f] hover:bg-black/5"}`}>
              <Icon size={16} />
              <span className="flex-1 text-left">{label}</span>
              {badge ? <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${activeTab === id ? "bg-white/20 text-white" : "bg-[#ff3b30] text-white"}`}>{badge}</span> : null}
            </button>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-[#d2d2d7]/50 space-y-2">
          <MiniStat label="Légitimité" value={store.legitimite} color="#0071e3" />
          <MiniStat label="Trésorerie" value={Math.min((store.tresorerie / 2000), 100)} color="#34c759" display={`${(store.tresorerie / 1000).toFixed(0)}k€`} />
          <MiniStat label="Réputation" value={store.reputation} color="#ff9f0a" />
          <MiniStat label="Stress" value={store.stress_global} color={store.stress_global > 70 ? "#ff3b30" : "#ff9f0a"} />
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-[#6e6e73]">Points d'Action</span>
            <div className="flex gap-1">
              {Array.from({ length: store.points_action_max }).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i < store.points_action ? "bg-[#0071e3]" : "bg-[#d2d2d7]"}`} />
              ))}
            </div>
          </div>
          <div className="text-center py-1 px-2 bg-[#f5f5f7] rounded-lg">
            <span className="text-[10px] font-medium text-[#6e6e73]">Mood : {store.mood_global}</span>
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
              <div className="px-3 py-3 border-b border-[#d2d2d7]/50">
                <input placeholder="Rechercher…"
                  className="w-full px-3 py-1.5 bg-[#e5e5ea] rounded-[10px] text-[13px] outline-none placeholder-[#8e8e93] text-[#1d1d1f]" />
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {store.messages.map((msg) => {
                  const a = store.agents.find((ag) => ag.id === msg.agent_id);
                  if (!a) return null;
                  const urgent = msg.delai_reponse_heures <= 6;
                  const isSelected = selectedAgent === msg.agent_id;
                  return (
                    <div key={msg.id}
                      onClick={() => handleSelectAgent(msg.agent_id, msg.id)}
                      className={`group mx-2 mb-1 p-3 rounded-[12px] cursor-pointer transition-all ${isSelected ? "bg-[#0071e3] text-white" : msg.lu ? "opacity-70 hover:bg-white/70" : "hover:bg-white/70"}`}>
                      <div className="flex items-start gap-2.5">
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-semibold" style={{ backgroundColor: a.avatar_color }}>
                            {a.initiales}
                          </div>
                          <div className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${isSelected ? "border-[#0071e3]" : "border-[#f5f5f7]"} ${getNiveauDot(msg.niveau)}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className={`text-[13px] font-semibold truncate ${isSelected ? "text-white" : "text-[#1d1d1f]"}`}>
                              {a.nom}
                              {!msg.lu && <span className="ml-1 w-1.5 h-1.5 inline-block rounded-full bg-[#0071e3] align-middle" />}
                            </span>
                            <span className={`text-[10px] shrink-0 ${urgent ? (isSelected ? "text-red-200" : "text-[#ff3b30]") : isSelected ? "text-white/60" : "text-[#8e8e93]"}`}>
                              {urgent ? `⚡ ${msg.delai_reponse_heures}h` : `${msg.delai_reponse_heures}h`}
                            </span>
                          </div>
                          <p className={`text-[12px] truncate mb-1 ${isSelected ? "text-white/80" : "text-[#6e6e73]"}`}>{msg.sujet}</p>
                          {/* Chips niveau + phase */}
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${
                              isSelected ? "bg-white/20 text-white" :
                              msg.niveau === "N5" ? "bg-[#ff3b30]/15 text-[#ff3b30]" :
                              msg.niveau === "N4" ? "bg-[#ff9f0a]/15 text-[#ff9f0a]" :
                              msg.niveau === "N3" ? "bg-[#ffd60a]/20 text-[#b07800]" :
                              "bg-[#0071e3]/10 text-[#0071e3]"}`}>
                              {msg.niveau}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${isSelected ? "bg-white/15 text-white" : "bg-[#f5f5f7] text-[#6e6e73]"}`}>
                              {msg.type}
                            </span>
                            {msg.phase && (
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${isSelected ? "bg-white/20 text-white" : getPhaseColor(msg.phase)}`}>
                                {msg.phase}
                              </span>
                            )}
                            {(msg.niveau === "N1" || msg.niveau === "N2") && !msg.repondu && !isSelected && (
                              <button onClick={(e) => { e.stopPropagation(); handleArchive(msg.id); }}
                                className="opacity-0 group-hover:opacity-100 ml-auto p-0.5 rounded hover:bg-black/10 transition-all">
                                <Archive size={11} className="text-[#6e6e73]" />
                              </button>
                            )}
                          </div>
                          {/* Barre d'urgence */}
                          <div className="mt-1.5 h-[2px] bg-[#e5e5ea] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${isSelected ? "bg-white/40" : getUrgencyBarColor(msg.niveau)}`}
                              style={{ width: getUrgencyWidth(msg.delai_reponse_heures) }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {store.messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-32 text-center px-4">
                    <p className="text-[12px] text-[#8e8e93]">Aucun message</p>
                    <p className="text-[10px] text-[#c7c7cc] mt-1">Les agents écrivent…</p>
                  </div>
                )}
              </div>
            </div>

            {/* Zone conversation */}
            <main className="flex-1 flex flex-col bg-white/60">
              {agent ? (
                <>
                  <header className="px-6 py-3.5 glass border-b border-[#d2d2d7]/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{ backgroundColor: agent.avatar_color }}>
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

                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                    {/* Dilemme actif */}
                    {dilemme && !dilemmeResolu && (
                      <div className="bg-[#fff3cd] border border-[#ffc107]/30 rounded-[16px] p-4">
                        <div className="flex items-start gap-2 mb-3">
                          <AlertTriangle size={16} className="text-[#ff9f0a] mt-0.5 shrink-0" />
                          <div>
                            <p className="font-semibold text-[13px] text-[#1d1d1f]">Dilemme : {dilemme.titre}</p>
                            <p className="text-[12px] text-[#6e6e73] mt-0.5">{dilemme.description}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {dilemme.options.map((opt) => (
                            <button key={opt.id} onClick={() => handleDilemme(opt.id, opt.cout_PA)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-[10px] text-[12px] font-medium text-[#1d1d1f] border border-[#d2d2d7]/50 hover:bg-[#0071e3] hover:text-white hover:border-transparent transition-all shadow-sm">
                              {opt.label}
                              {opt.cout_PA > 0 && <span className="text-[10px] opacity-60">−{opt.cout_PA} PA</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Message initial de l'agent */}
                    {selectedMessage && (
                      <div className="flex gap-3 max-w-[78%]">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0 mt-1" style={{ backgroundColor: agent.avatar_color }}>
                          {agent.initiales}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-medium text-[#1d1d1f]">{agent.nom}</span>
                            <span className="text-[10px] text-[#8e8e93]">il y a {selectedMessage.delai_reponse_heures}h</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                              selectedMessage.niveau === "N5" ? "bg-[#ff3b30]/10 text-[#ff3b30]" :
                              selectedMessage.niveau === "N4" ? "bg-[#ff9f0a]/10 text-[#ff9f0a]" :
                              selectedMessage.niveau === "N3" ? "bg-[#ffd60a]/15 text-[#b07800]" :
                              "bg-[#0071e3]/10 text-[#0071e3]"}`}>
                              {getNiveauLabel(selectedMessage.niveau)}
                            </span>
                            {selectedMessage.phase && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${getPhaseColor(selectedMessage.phase)}`}>
                                {selectedMessage.phase}
                              </span>
                            )}
                          </div>
                          <div className="bg-white rounded-[18px] rounded-tl-[6px] px-4 py-3 shadow-[0_1px_8px_rgba(0,0,0,0.08)] border border-[#d2d2d7]/30">
                            <p className="text-[13px] text-[#1d1d1f] leading-relaxed">{selectedMessage.contenu}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Historique conversation */}
                    {(store.conversation_history[agent.id] || []).map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "gap-3 max-w-[78%]"}`}>
                        {msg.role === "assistant" && (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0 mt-1" style={{ backgroundColor: agent.avatar_color }}>
                            {agent.initiales}
                          </div>
                        )}
                        <div className={`px-4 py-3 rounded-[18px] text-[13px] leading-relaxed whitespace-pre-wrap max-w-[75%] ${
                          msg.role === "user"
                            ? "bg-[#0071e3] text-white rounded-br-[6px]"
                            : "bg-white text-[#1d1d1f] rounded-tl-[6px] shadow-[0_1px_8px_rgba(0,0,0,0.08)] border border-[#d2d2d7]/30"
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}

                    {/* Indicateur "agent répond..." */}
                    {(phase === "waiting" || phase === "scoring") && (
                      <div className="flex gap-3 max-w-[78%]">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0" style={{ backgroundColor: agent.avatar_color }}>
                          {agent.initiales}
                        </div>
                        <div className="bg-white rounded-[18px] rounded-tl-[6px] px-4 py-3 shadow-[0_1px_8px_rgba(0,0,0,0.08)] border border-[#d2d2d7]/30">
                          {phase === "scoring" ? (
                            <span className="text-[12px] text-[#6e6e73] flex items-center gap-1.5">
                              <Zap size={11} className="text-[#0071e3]" /> Ghost Writer note ta réponse…
                            </span>
                          ) : (
                            <div className="flex gap-1 items-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#8e8e93] animate-bounce" style={{ animationDelay: "0ms" }} />
                              <div className="w-1.5 h-1.5 rounded-full bg-[#8e8e93] animate-bounce" style={{ animationDelay: "150ms" }} />
                              <div className="w-1.5 h-1.5 rounded-full bg-[#8e8e93] animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Score IA */}
                    {scoreResult && (
                      <ScoreCard score={scoreResult} playerMessage={lastPlayerMessage} onClose={() => setScoreResult(null)} />
                    )}

                    {/* Ghost Writer — 3 versions */}
                    {ghostVersions && phase === "picking" && (
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

                    <div ref={messagesEndRef} />
                  </div>

                  {/* Zone de saisie */}
                  <div className="px-6 py-3 glass border-t border-[#d2d2d7]/50">
                    {phase === "picking" && !ghostVersions && (
                      <div className="flex items-center gap-2 mb-2 text-[11px] text-[#6e6e73]">
                        <RefreshCw size={11} className="animate-spin text-[#0071e3]" />
                        Ghost Writer analyse ton brouillon…
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <div className={`flex-1 bg-white border rounded-[14px] px-4 py-2.5 shadow-sm transition-all ${
                        phase === "waiting" || phase === "scoring" ? "border-[#d2d2d7]/40 opacity-60" : "border-[#d2d2d7]/80"
                      }`}>
                        <textarea
                          value={inputText}
                          onChange={(e) => {
                            if (phase === "waiting" || phase === "scoring") return;
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
                          disabled={phase === "waiting" || phase === "scoring"}
                          placeholder={
                            phase === "waiting" ? `${agent.nom} rédige sa réponse…` :
                            phase === "scoring" ? "Évaluation en cours…" :
                            phase === "picking" ? "Choisis une version Ghost Writer ci-dessus, ou continue à écrire…" :
                            `Répondre à ${agent.nom}… (↵ Envoyer · ✨ Ghost Writer)`
                          }
                          rows={1}
                          className="w-full text-[13px] text-[#1d1d1f] placeholder-[#8e8e93] outline-none resize-none leading-relaxed bg-transparent disabled:cursor-not-allowed"
                          style={{ minHeight: "20px" }}
                        />
                      </div>
                      {/* Bouton Ghost Writer */}
                      <button
                        onClick={handleGhostDraft}
                        disabled={phase !== "draft" || !inputText.trim()}
                        title="Ghost Writer — 3 versions corrigées"
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 border ${
                          phase === "draft" && inputText.trim()
                            ? "border-[#0071e3]/30 bg-[#0071e3]/5 text-[#0071e3] hover:bg-[#0071e3]/10"
                            : "border-[#e5e5ea] bg-white text-[#c7c7cc] cursor-not-allowed"}`}>
                        <Zap size={14} />
                      </button>
                      {/* Bouton Envoyer */}
                      <button
                        onClick={handleDirectSend}
                        disabled={phase !== "draft" || !inputText.trim()}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm shrink-0 ${
                          phase === "draft" && inputText.trim()
                            ? "bg-[#0071e3] hover:bg-[#0077ed] text-white"
                            : "bg-[#e5e5ea] text-[#8e8e93] cursor-not-allowed"}`}>
                        {phase === "waiting" || phase === "scoring" ? (
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
            <h2 className="text-[22px] font-bold text-[#1d1d1f] mb-1">Équipe</h2>
            <p className="text-[13px] text-[#6e6e73] mb-5">{store.agents.length} collaborateurs · Cabinet Morel & Associés</p>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {store.agents.map((a) => (
                <div key={a.id} className="bg-white rounded-[18px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-[#d2d2d7]/30">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold" style={{ backgroundColor: a.avatar_color }}>
                      {a.initiales}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[14px] text-[#1d1d1f] truncate">{a.nom}</div>
                      <div className="text-[11px] text-[#6e6e73] truncate">{a.role}</div>
                      <EmotionChip emotion={(a as any).emotion || "Stable"} small />
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
            <h2 className="text-[22px] font-bold text-[#1d1d1f] mb-1">Agenda</h2>
            <p className="text-[13px] text-[#6e6e73] mb-5">Mai — Juin 2026 · Campagne Bilan & AG</p>
            <div className="max-w-lg space-y-3">
              <div className="bg-[#ff3b30]/5 border border-[#ff3b30]/20 rounded-[16px] p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={15} className="text-[#ff3b30]" />
                  <span className="font-semibold text-[14px] text-[#1d1d1f]">Boss Fight — Clôture bilan</span>
                  <span className="ml-auto text-[12px] font-bold text-[#ff3b30]">J-16</span>
                </div>
                <p className="text-[12px] text-[#6e6e73]">Signature bilan Vidal Industrie · RDV demain 10h avec Naïma</p>
              </div>
              <div className="bg-white rounded-[16px] p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] border border-[#d2d2d7]/30">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle size={15} className="text-[#34c759]" />
                  <span className="font-semibold text-[14px] text-[#1d1d1f]">Déclarations IS</span>
                  <span className="ml-auto text-[12px] text-[#34c759] font-medium">Demain matin</span>
                </div>
                <p className="text-[12px] text-[#6e6e73]">Dossier Martin SARL — Thomas attend validation taux acompte IS</p>
              </div>
              <div className="bg-white rounded-[16px] p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] border border-[#d2d2d7]/30">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar size={15} className="text-[#0071e3]" />
                  <span className="font-semibold text-[14px] text-[#1d1d1f]">AG Groupe Dubois</span>
                  <span className="ml-auto text-[12px] text-[#6e6e73]">Juin 2026</span>
                </div>
                <p className="text-[12px] text-[#6e6e73]">Écart de conversion 340k€ non résolu · Samuel en attente</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "dossiers" && (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="text-[22px] font-bold text-[#1d1d1f] mb-1">Dossiers actifs</h2>
            <p className="text-[13px] text-[#6e6e73] mb-5">Pipeline P1 → P5</p>
            <div className="space-y-2">
              {store.agents.flatMap((a) =>
                ((a as any).dossiers_actifs ?? []).map((d: string, i: number) => (
                  <div key={`${a.id}-${i}`} className="bg-white rounded-[14px] px-4 py-3 shadow-[0_1px_8px_rgba(0,0,0,0.05)] border border-[#d2d2d7]/30 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0" style={{ backgroundColor: a.avatar_color }}>
                      {a.initiales}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1d1d1f] truncate">{d}</p>
                      <p className="text-[11px] text-[#6e6e73]">{a.nom} · {a.filiere}</p>
                    </div>
                    <ChevronRight size={14} className="text-[#c7c7cc] shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "dec" && (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="text-[22px] font-bold text-[#1d1d1f] mb-1">DEC Prep</h2>
            <p className="text-[13px] text-[#6e6e73] mb-5">Préparation Diplôme d'Expertise Comptable</p>
            <div className="max-w-lg space-y-3">
              <div className="bg-[#0071e3]/5 border border-[#0071e3]/20 rounded-[16px] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <GraduationCap size={15} className="text-[#0071e3]" />
                  <span className="font-semibold text-[14px] text-[#1d1d1f]">Prochain QCM blanc</span>
                  <span className="ml-auto text-[12px] font-semibold text-[#0071e3]">Vendredi 29 mai</span>
                </div>
                <p className="text-[12px] text-[#6e6e73] mb-3">Thème : <strong>Consolidation & IFRS</strong> · 45 min chrono · Jury virtuel</p>
                <div className="flex gap-2 flex-wrap">
                  {["Samuel Dubois", "Naïma Bensaid", "Thomas Lefèvre"].map(j => (
                    <span key={j} className="text-[10px] px-2 py-0.5 bg-white rounded-full border border-[#d2d2d7]/50 text-[#6e6e73]">{j}</span>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-[16px] p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] border border-[#d2d2d7]/30">
                <p className="font-semibold text-[13px] text-[#1d1d1f] mb-3">Grille d'évaluation Ghost Writer</p>
                <div className="space-y-2">
                  {[["Précision technique", 30, "#0071e3"],["Rédaction professionnelle", 20, "#34c759"],["Déontologie", 20, "#ff9f0a"],["Contexte & empathie", 15, "#bf5af2"],["Opérationnel", 15, "#ff3b30"]].map(([label, pts, color]) => (
                    <div key={label as string} className="flex items-center gap-3">
                      <span className="text-[11px] text-[#6e6e73] w-40">{label as string}</span>
                      <div className="flex-1 h-[4px] bg-[#f5f5f7] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(pts as number)}%`, backgroundColor: color as string }} />
                      </div>
                      <span className="text-[11px] font-semibold text-[#3a3a3c] w-6 text-right">{pts as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
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
      {/* Header */}
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

      {/* Barres de score */}
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

      {/* Feedback avec analogie */}
      <div className="bg-[#f5f5f7] rounded-[12px] p-3 mb-2.5">
        <div className="flex items-start gap-2">
          <Zap size={12} className="text-[#0071e3] mt-0.5 shrink-0" />
          <p className="text-[12px] text-[#3a3a3c] leading-relaxed italic">{score.feedback}</p>
        </div>
      </div>

      {/* Points forts + Axes */}
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
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
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
