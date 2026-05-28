"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/supabase-store";
import { supabase, signOut } from "@/lib/supabase";
import {
  Mail, Users, Calendar, FolderOpen, GraduationCap,
  Building2, Send, Clock, MessageSquare, LogOut, TrendingUp, AlertTriangle,
} from "lucide-react";

type Tab = "cabinet" | "messages" | "equipe" | "agenda" | "dossiers" | "dec";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("cabinet");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const store = useGameStore();

  useEffect(() => {
    store.loadGameState();
  }, []);

  useEffect(() => {
    if (!store.isLoading && !store.isAuthenticated) {
      router.push("/auth");
    }
  }, [store.isLoading, store.isAuthenticated, router]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.push("/auth");
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const selectedMessage = store.messages.find((m) => m.agent_id === selectedAgent);
  const agent = store.agents.find((a) => a.id === selectedAgent);

  async function handleSelectAgent(agentId: string, messageId: string) {
    setSelectedAgent(agentId);
    store.markMessageRead(messageId);
    store.loadConversations(agentId);
  }

  async function handleSend() {
    if (!inputText.trim() || !agent) return;
    const niveau = selectedMessage?.niveau || "N2";
    let cost = 0;
    if (niveau === "N3" || niveau === "N4") cost = 1;
    if (niveau === "N5") cost = 2;
    if (cost > 0 && !store.spendPA(cost)) { alert("Pas assez de Points d'Action !"); return; }
    setLoading(true);
    const history = store.conversation_history[agent.id] || [];
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [...history, { role: "user", content: inputText }], agent_context: agent }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.content) {
      store.addConversation(agent.id, "user", inputText);
      store.addConversation(agent.id, "assistant", data.content);
      store.replyToMessage(selectedMessage?.id || "", inputText);
      setInputText("");
    }
  }

  function getNiveauColor(n: string) {
    switch (n) {
      case "N1": return "bg-gray-200 text-gray-700";
      case "N2": return "bg-blue-100 text-blue-700";
      case "N3": return "bg-yellow-100 text-yellow-700";
      case "N4": return "bg-orange-100 text-orange-700";
      case "N5": return "bg-red-100 text-red-700";
      default: return "bg-gray-100";
    }
  }

  function getPhaseColor(p: string | null) {
    if (!p) return "";
    if (p === "P5") return "text-red-600 font-bold";
    if (p === "P4") return "text-orange-600 font-semibold";
    if (p === "P3") return "text-yellow-600";
    return "text-gray-500";
  }

  if (store.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Building2 size={48} className="mx-auto mb-4 text-indigo-600 animate-pulse" />
          <p className="text-gray-500 text-sm">Chargement du cabinet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Building2 size={20} /> Cabinet DEC
          </h1>
          <p className="text-xs text-gray-500 mt-1">{store.date_simulation}</p>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          <SidebarItem icon={<Building2 size={18} />} label="Cabinet" active={activeTab === "cabinet"} onClick={() => setActiveTab("cabinet")} />
          <SidebarItem icon={<Mail size={18} />} label="Messages" active={activeTab === "messages"} onClick={() => setActiveTab("messages")} badge={store.messages.filter(m => !m.lu).length} />
          <SidebarItem icon={<Users size={18} />} label="Équipe" active={activeTab === "equipe"} onClick={() => setActiveTab("equipe")} />
          <SidebarItem icon={<Calendar size={18} />} label="Agenda" active={activeTab === "agenda"} onClick={() => setActiveTab("agenda")} />
          <SidebarItem icon={<FolderOpen size={18} />} label="Dossiers" active={activeTab === "dossiers"} onClick={() => setActiveTab("dossiers")} />
          <SidebarItem icon={<GraduationCap size={18} />} label="DEC Prep" active={activeTab === "dec"} onClick={() => setActiveTab("dec")} />
        </nav>

        <div className="p-4 border-t bg-gray-50">
          <div className="space-y-2 text-xs">
            <ResourceBar label="Légitimité" value={store.legitimite} color="bg-indigo-500" />
            <ResourceBar label="Trésorerie" value={store.tresorerie / 2000} max={100} color="bg-emerald-500" display={`${(store.tresorerie / 1000).toFixed(0)}k€`} />
            <ResourceBar label="Réputation" value={store.reputation} color="bg-amber-500" />
            <ResourceBar label="Stress" value={store.stress_global} color="bg-rose-500" />
            <div className="flex items-center justify-between pt-2 font-semibold">
              <span>Points d&apos;Action</span>
              <span className={store.points_action === 0 ? "text-red-600" : "text-indigo-600"}>
                {store.points_action}/{store.points_action_max}
              </span>
            </div>
          </div>
          <div className="mt-3 px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded text-center font-medium">
            Mood : {store.mood_global}
          </div>
          <button onClick={() => { signOut(); router.push("/auth"); }}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* CONTENU PRINCIPAL */}
      <div className="flex-1 flex overflow-hidden">
        {/* VUE CABINET / MESSAGES */}
        {(activeTab === "cabinet" || activeTab === "messages") && (
          <>
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
              <div className="p-3 border-b">
                <input type="text" placeholder="Rechercher..." className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-200" />
              </div>
              <div className="flex-1 overflow-y-auto">
                {store.messages.map((msg) => {
                  const a = store.agents.find((ag) => ag.id === msg.agent_id);
                  if (!a) return null;
                  return (
                    <div key={msg.id} onClick={() => { handleSelectAgent(msg.agent_id, msg.id); setActiveTab("cabinet"); }}
                      className={`p-3 border-b cursor-pointer hover:bg-gray-50 transition-colors ${selectedAgent === msg.agent_id ? "bg-indigo-50" : ""} ${!msg.lu ? "border-l-4 border-l-indigo-500" : ""}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: a.avatar_color }}>
                          {a.initiales}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-sm text-gray-900 truncate">{a.nom}</h3>
                            <span className="text-xs text-gray-400">{msg.delai_reponse_heures}h</span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{msg.sujet}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getNiveauColor(msg.niveau)}`}>{msg.niveau}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{msg.type}</span>
                            {msg.phase && <span className={`text-[10px] font-medium ${getPhaseColor(msg.phase)}`}>{msg.phase}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <main className="flex-1 flex flex-col bg-white">
              {agent ? (
                <>
                  <header className="px-6 py-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: agent.avatar_color }}>{agent.initiales}</div>
                      <div>
                        <h2 className="font-bold text-gray-900">{agent.nom}</h2>
                        <p className="text-xs text-gray-500">{agent.role} · {agent.filiere} · {agent.niveau}</p>
                      </div>
                      <span className="ml-4 text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">{agent.statut}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Stress: {agent.stress}</span>
                      <span>Fatigue: {agent.fatigue}</span>
                      <span>Confiance: {agent.confiance_joueur}</span>
                    </div>
                  </header>

                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {selectedMessage && (
                      <div className="bg-gray-50 rounded-2xl p-4 max-w-2xl">
                        <span className="text-xs font-semibold text-gray-500">Envoyé il y a {selectedMessage.delai_reponse_heures}h</span>
                        <div className="flex gap-3 mt-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: agent.avatar_color }}>{agent.initiales}</div>
                          <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-800 leading-relaxed">{selectedMessage.contenu}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {(store.conversation_history[agent.id] || []).map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-2xl px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-indigo-600 text-white rounded-tr-none" : "bg-gray-100 text-gray-800 rounded-tl-none"}`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 border-t bg-gray-50">
                    <div className="flex items-center gap-2">
                      <input value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        placeholder="Rédiger une ébauche... (l'IA proposera 3 versions corrigées)"
                        className="flex-1 px-4 py-3 bg-white border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-200" />
                      <button onClick={handleSend} disabled={loading || !inputText.trim()}
                        className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        {loading ? <Clock size={18} className="animate-spin" /> : <Send size={18} />}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                      <MessageSquare size={10} /> Coût : {selectedMessage?.niveau === "N5" ? "2 PA" : selectedMessage?.niveau === "N3" || selectedMessage?.niveau === "N4" ? "1 PA" : "0 PA"}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <div className="text-center"><Mail size={48} className="mx-auto mb-4 opacity-50" /><p>Sélectionne un message pour commencer</p></div>
                </div>
              )}
            </main>
          </>
        )}

        {/* VUE ÉQUIPE */}
        {activeTab === "equipe" && (
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Équipe — {store.agents.length} collaborateurs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {store.agents.map((a) => (
                <div key={a.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: a.avatar_color }}>{a.initiales}</div>
                    <div>
                      <h3 className="font-bold text-gray-900">{a.nom}</h3>
                      <p className="text-xs text-gray-500">{a.role}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${a.statut === "En ligne" ? "bg-green-100 text-green-700" : a.statut === "Occupé" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
                        {a.statut}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <MiniBar label="Stress" value={a.stress} color={a.stress > 70 ? "bg-red-500" : "bg-orange-400"} />
                    <MiniBar label="Fatigue" value={a.fatigue} color={a.fatigue > 70 ? "bg-red-500" : "bg-yellow-400"} />
                    <MiniBar label="Confiance" value={a.confiance_joueur} color="bg-indigo-500" />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px]">
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full">{a.filiere}</span>
                    <span className="text-gray-500 italic">{a.emotion}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VUE AGENDA */}
        {activeTab === "agenda" && (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-400">
              <Calendar size={56} className="mx-auto mb-4 opacity-40" />
              <p className="text-lg font-semibold">Agenda</p>
              <p className="text-sm mt-1">Prochaine échéance : Clôture bilan — J-16</p>
              <div className="mt-6 px-6 py-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium">
                ⚠️ Boss Fight — Campagne Bilan & AG — Mai/Juin 2026
              </div>
            </div>
          </div>
        )}

        {/* VUE DOSSIERS */}
        {activeTab === "dossiers" && (
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Dossiers actifs</h2>
            <div className="space-y-3">
              {store.agents.flatMap((a) =>
                (a as any).dossiers_actifs?.map((d: string, i: number) => (
                  <div key={`${a.id}-${i}`} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: a.avatar_color }}>{a.initiales}</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{d}</p>
                      <p className="text-xs text-gray-400">{a.nom} · {a.filiere}</p>
                    </div>
                    <TrendingUp size={16} className="text-gray-300" />
                  </div>
                )) ?? []
              )}
            </div>
          </div>
        )}

        {/* VUE DEC PREP */}
        {activeTab === "dec" && (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-400">
              <GraduationCap size={56} className="mx-auto mb-4 opacity-40" />
              <p className="text-lg font-semibold">DEC Prep</p>
              <p className="text-sm mt-1 text-gray-500">QCM blanc disponible chaque vendredi</p>
              <div className="mt-6 px-6 py-4 bg-indigo-50 text-indigo-700 rounded-xl text-sm">
                Prochain QCM : <strong>vendredi 29 mai 2026</strong><br />
                Thème : Consolidation & IFRS
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick, badge }: {
  icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void; badge?: number;
}) {
  return (
    <div onClick={onClick} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${active ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-600 hover:bg-gray-100"}`}>
      {icon}
      <span className="flex-1">{label}</span>
      {badge ? <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{badge}</span> : null}
    </div>
  );
}

function ResourceBar({ label, value, max = 100, color, display }: { label: string; value: number; max?: number; color: string; display?: string; }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex justify-between mb-0.5"><span>{label}</span><span className="font-medium">{display || value}</span></div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string; }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-gray-500">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="w-6 text-right text-gray-600">{value}</span>
    </div>
  );
}
