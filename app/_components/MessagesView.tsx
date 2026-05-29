"use client";

import { useState, useRef, useEffect } from "react";
import { useGameStore } from "@/lib/supabase-store";
import { apiFetch } from "@/lib/api-client";
import { Send, Zap, AlertTriangle, X, RefreshCw, Mail } from "lucide-react";

interface Props {
  onOpenKeyModal: () => void;
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

interface UrgenceBadge {
  emoji: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  rowBg: string;
}

function getUrgenceBadge(heures: number): UrgenceBadge {
  if (heures <= 0) {
    return { emoji: "🔴", label: "RETARD", color: "text-white", bg: "bg-[#FF3B30]", border: "border-l-[#FF3B30]", rowBg: "bg-[#FF3B30]/8" };
  }
  if (heures <= 24) {
    return { emoji: "🟠", label: "J-1", color: "text-white", bg: "bg-[#FF9500]", border: "border-l-[#FF9500]", rowBg: "bg-[#FF9500]/5" };
  }
  if (heures <= 72) {
    return { emoji: "🟡", label: "J-3", color: "text-[#A35900]", bg: "bg-[#FFCC00]", border: "border-l-[#FFCC00]", rowBg: "" };
  }
  return { emoji: "🔵", label: "COURANT", color: "text-white", bg: "bg-[#007AFF]", border: "border-l-[#007AFF]", rowBg: "" };
}

function getNiveauLabel(n: string) {
  switch (n) {
    case "N1": return "Info"; case "N2": return "Question";
    case "N3": return "Décision"; case "N4": return "Problème"; case "N5": return "Crise";
    default: return n;
  }
}

function getPACost(n: string) {
  if (n === "N3" || n === "N4") return 1;
  if (n === "N5") return 2;
  return 0;
}

export function MessagesView({ onOpenKeyModal }: Props) {
  const store = useGameStore();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [apiError, setApiError] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const agent = store.agents.find((a) => a.id === selectedAgent);

  // Conversations groupées par agent
  const conversationsByAgent: Array<{ agent: any; messages: any[]; lastMsg: any; unread: number; pendingMsg: any | undefined }> = [];
  {
    const map = new Map<string, any>();
    for (let i = 0; i < store.messages.length; i++) {
      const m = store.messages[i];
      const a = store.agents.find((x) => x.id === m.agent_id);
      if (!a) continue;
      let existing = map.get(m.agent_id);
      if (existing) {
        existing.messages.push(m);
        if (!m.lu) existing.unread += 1;
        if (new Date(m.timestamp).getTime() > new Date(existing.lastMsg.timestamp).getTime()) existing.lastMsg = m;
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
    const arr = Array.from(map.values());
    arr.sort((a, b) => new Date(b.lastMsg.timestamp).getTime() - new Date(a.lastMsg.timestamp).getTime());
    for (let i = 0; i < arr.length; i++) conversationsByAgent.push(arr[i]);
  }

  // Scroll local au conteneur
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [store.conversation_history, selectedAgent]);

  function handleSelectAgent(agentId: string) {
    setSelectedAgent(agentId);
    setInputText("");
    setApiError("");
    const toRead = store.messages.filter((m) => m.agent_id === agentId && !m.lu);
    for (let i = 0; i < toRead.length; i++) store.markMessageRead(toRead[i].id);
    store.loadConversations(agentId);
  }

  async function handleSend() {
    const text = inputText.trim();
    console.log("[CHAT] handleSend déclenché", { text, hasAgent: !!agent, sending });
    if (!text || !agent || sending) {
      console.log("[CHAT] Abort:", !text ? "text vide" : !agent ? "pas d'agent" : "déjà en sending");
      return;
    }
    setInputText("");
    setSending(true);
    setApiError("");

    const niveau = agent ? (store.messages.find((m) => m.agent_id === agent.id && !m.repondu)?.niveau || "N2") : "N2";
    const cost = getPACost(niveau);
    console.log("[CHAT] PA cost:", cost, "PA dispo:", store.points_action);
    if (cost > 0 && !store.spendPA(cost)) {
      setApiError(`Pas assez de Points d'Action (${store.points_action}/${store.points_action_max}) — repos requis. Coût pour ${niveau}: ${cost} PA.`);
      setSending(false);
      return;
    }

    const currentHistory = store.conversation_history[agent.id] || [];
    const userMsg = { role: "user" as const, content: text };
    console.log("[CHAT] Envoi à l'API…", { agent: agent.nom, historyLength: currentHistory.length });

    useGameStore.setState((s) => ({
      conversation_history: {
        ...s.conversation_history,
        [agent.id]: [...(s.conversation_history[agent.id] || []), userMsg],
      },
    }));

    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          mode: "agent",
          messages: [...currentHistory, userMsg],
          agent_context: agent,
          game_state: {
            date: store.date_simulation,
            mood: store.mood_global,
            hour: store.game_hour,
            minute: store.game_minute,
            day: store.game_day,
            player_level: store.player_level,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData?.error || `HTTP ${res.status}`;
        if (typeof errMsg === "string" && (errMsg.includes("model:") || errMsg.toLowerCase().includes("credit") || res.status === 404)) {
          setApiError("Compte Anthropic sans crédit — ouvre ⚙ pour charger ton compte");
        } else {
          setApiError(`${errMsg}`);
        }
        return;
      }

      const data = await res.json();
      console.log("[CHAT] Réponse reçue:", { hasContent: !!data.content, hasError: !!data.error });
      if (data.error) {
        setApiError(typeof data.error === "string" && data.error.includes("model:") ? "Compte sans crédit — ouvre ⚙" : `${data.error}`);
        return;
      }
      if (!data.content) {
        setApiError("Réponse vide — réessaye");
        return;
      }
      console.log("[CHAT] Contenu agent reçu, mise à jour conversation_history");

      useGameStore.setState((s) => ({
        conversation_history: {
          ...s.conversation_history,
          [agent.id]: [
            ...(s.conversation_history[agent.id] || []),
            { role: "assistant" as const, content: data.content },
          ],
        },
      }));

      if (store.user_id) {
        store.addConversation(agent.id, "user", text).catch(() => {});
        store.addConversation(agent.id, "assistant", data.content).catch(() => {});
      }
      const pending = store.messages.find((m) => m.agent_id === agent.id && !m.repondu);
      if (pending) store.replyToMessage(pending.id, text).catch(() => {});
    } catch (err: any) {
      setApiError("Erreur réseau — " + (err?.message || "inconnue"));
    } finally {
      setSending(false);
    }
  }

  const unreadCount = store.messages.filter((m) => !m.lu).length;

  return (
    <>
      {/* Liste conversations */}
      <div className="w-72 bg-white/60 dark:bg-[#141416] backdrop-blur-xl border-r border-[#E5E5EA] dark:border-[#2A2A2E] flex flex-col">
        <div className="px-3 py-3 border-b border-[#E5E5EA]/40 dark:border-[#2A2A2E] flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white">Messagerie</h3>
          <span className="text-[10px] text-[#86868B]">{conversationsByAgent.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {conversationsByAgent.map((conv) => {
            const a = conv.agent;
            const isSelected = selectedAgent === a.id;
            const display = conv.pendingMsg || conv.lastMsg;
            return (
              <div key={a.id}
                onClick={() => handleSelectAgent(a.id)}
                className={`group mx-2 mb-1 p-3 rounded-[14px] cursor-pointer transition-all border-l-4 ${isSelected ? "bg-gradient-to-r from-[#007AFF] to-[#0a84ff] text-white shadow-md border-l-transparent" : `${conv.pendingMsg ? getUrgenceBadge(conv.pendingMsg.delai_reponse_heures).border + " " + getUrgenceBadge(conv.pendingMsg.delai_reponse_heures).rowBg : "border-l-transparent"} ${conv.unread === 0 ? "opacity-75 hover:bg-white/80" : "hover:bg-white/80"}`}`}>
                <div className="flex items-start gap-2.5">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shadow-sm" style={{ backgroundColor: a.avatar_color }}>
                      {a.initiales}
                    </div>
                    {a.statut === "En ligne" && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#34C759] border-2 border-white" title="En ligne — réponse rapide possible" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5 gap-1">
                      <span className={`text-[13px] font-semibold truncate ${isSelected ? "text-white" : "text-[#1D1D1F]"}`}>
                        {a.nom}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {conv.pendingMsg && !isSelected && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${getUrgenceBadge(conv.pendingMsg.delai_reponse_heures).bg} ${getUrgenceBadge(conv.pendingMsg.delai_reponse_heures).color}`}>
                            {getUrgenceBadge(conv.pendingMsg.delai_reponse_heures).label}
                          </span>
                        )}
                        {conv.unread > 0 && !isSelected && (
                          <span className="text-[9px] font-bold text-white bg-[#007AFF] rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center">{conv.unread}</span>
                        )}
                      </div>
                    </div>
                    <p className={`text-[12px] truncate mb-1 ${isSelected ? "text-white/80" : "text-[#86868B]"}`}>
                      {display.sujet}
                    </p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {conv.pendingMsg && (
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${isSelected ? "bg-white/20 text-white" : "bg-[#007AFF]/10 text-[#007AFF]"}`}>
                          {conv.pendingMsg.niveau}
                        </span>
                      )}
                      {conv.pendingMsg && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${isSelected ? "bg-white/15 text-white" : "bg-[#F5F5F7] text-[#86868B]"}`}>
                          ⏰ {conv.pendingMsg.delai_reponse_heures}h
                        </span>
                      )}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${isSelected ? "bg-white/15 text-white" : "bg-[#f5f5f7] text-[#86868B]"}`}>
                        {conv.messages.length} msg
                      </span>
                      {!conv.pendingMsg && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${isSelected ? "bg-white/15 text-white" : "bg-[#34C759]/10 text-[#34C759]"}`}>
                          ✓ À jour
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
              <p className="text-[12px] text-[#86868B]">Aucune conversation</p>
              <p className="text-[10px] text-[#c7c7cc] mt-1">Les agents écrivent…</p>
            </div>
          )}
        </div>
      </div>

      {/* Zone conversation */}
      <main className="flex-1 flex flex-col bg-white/40 dark:bg-[#0F0F10]">
        {agent ? (
          <>
            <header className="px-7 py-4 bg-white/75 dark:bg-[#141416]/75 backdrop-blur-2xl border-b border-[#E5E5EA]/70 dark:border-[#2A2A2E] flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.10)]" style={{ backgroundColor: agent.avatar_color }}>
                  {agent.initiales}
                </div>
                <div>
                  <h2 className="font-semibold text-[16px] text-[#1D1D1F] dark:text-white tracking-[-0.01em]">{agent.nom}</h2>
                  <p className="text-[12px] text-[#86868B] mt-0.5">{agent.role} · {agent.filiere}</p>
                </div>
              </div>
              <div className="flex items-center gap-5">
                <div className="text-center">
                  <div className={`text-[13px] font-semibold ${agent.stress > 70 ? "text-[#FF3B30]" : "text-[#86868B]"}`}>{agent.stress}</div>
                  <div className="text-[10px] text-[#86868B]">Stress</div>
                </div>
                <div className="text-center">
                  <div className={`text-[13px] font-semibold ${agent.confiance_joueur > 70 ? "text-[#34C759]" : "text-[#86868B]"}`}>{agent.confiance_joueur}</div>
                  <div className="text-[10px] text-[#86868B]">Confiance</div>
                </div>
              </div>
            </header>

            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {store.messages
                .filter((m) => m.agent_id === agent.id)
                .slice()
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                .map((m) => (
                  <div key={m.id} className="flex gap-3 max-w-[78%]">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0 mt-1" style={{ backgroundColor: agent.avatar_color }}>
                      {agent.initiales}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[11px] font-medium text-[#1D1D1F]">{agent.nom}</span>
                        <span className="text-[10px] text-[#86868B]">{new Date(m.timestamp).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                          m.niveau === "N5" ? "bg-[#FF3B30]/10 text-[#FF3B30]" :
                          m.niveau === "N4" ? "bg-[#FF9500]/10 text-[#FF9500]" :
                          m.niveau === "N3" ? "bg-[#ffd60a]/15 text-[#b07800]" :
                          "bg-[#007AFF]/10 text-[#007AFF]"}`}>
                          {getNiveauLabel(m.niveau)}
                        </span>
                        {m.repondu && <span className="text-[9px] text-[#34C759]">✓ traité</span>}
                      </div>
                      <div className="bg-[#E9E9EB] dark:bg-[#2A2A2E] rounded-[20px] rounded-tl-[6px] px-[14px] py-[9px]">
                        <p className="text-[14px] text-[#1D1D1F] dark:text-white leading-[1.4] whitespace-pre-wrap">{m.contenu}</p>
                      </div>
                    </div>
                  </div>
                ))}

              {(store.conversation_history[agent.id] || []).map((msg, i) => (
                <div key={`conv_${i}`} className={`flex ${msg.role === "user" ? "justify-end" : "gap-3 max-w-[78%]"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0 mt-1" style={{ backgroundColor: agent.avatar_color }}>
                      {agent.initiales}
                    </div>
                  )}
                  <div className={`px-[14px] py-[9px] rounded-[20px] text-[14px] leading-[1.4] whitespace-pre-wrap max-w-[75%] ${
                    msg.role === "user"
                      ? "bg-[#007AFF] text-white rounded-br-[6px] shadow-[0_1px_2px_rgba(0,122,255,0.25)]"
                      : "bg-[#E9E9EB] dark:bg-[#2A2A2E] text-[#1D1D1F] dark:text-white rounded-tl-[6px]"
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
                  <div className="bg-[#E9E9EB] dark:bg-[#2A2A2E] rounded-[20px] rounded-tl-[6px] px-[14px] py-[9px]">
                    <div className="flex gap-1 items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#86868B] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#86868B] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#86868B] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-white/70 dark:bg-[#141416]/70 backdrop-blur-xl border-t border-[#E5E5EA]/50 dark:border-[#2A2A2E]">
              {apiError && (
                <div className="flex items-center gap-2 mb-2 text-[11px] text-[#FF3B30] bg-[#FF3B30]/5 border border-[#FF3B30]/15 rounded-lg px-2 py-1.5">
                  <AlertTriangle size={11} className="shrink-0" />
                  <span className="flex-1">{apiError}</span>
                  {(apiError.includes("⚙") || apiError.toLowerCase().includes("crédit")) && (
                    <button onClick={onOpenKeyModal}
                      className="px-2 py-0.5 bg-[#FF3B30] text-white rounded-md text-[10px] font-semibold hover:bg-[#dc2626] transition-all">
                      Configurer ⚙
                    </button>
                  )}
                  <button onClick={() => setApiError("")} className="opacity-60 hover:opacity-100 shrink-0"><X size={11} /></button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <div className={`flex-1 bg-white dark:bg-[#1A1A1C] border rounded-[14px] px-4 py-2.5 shadow-sm transition-all ${sending ? "border-[#E5E5EA]/40 dark:border-[#2A2A2E]/40 opacity-60" : "border-[#E5E5EA]/80 dark:border-[#2A2A2E]"}`}>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                    disabled={sending}
                    placeholder={sending ? `${agent.nom} rédige sa réponse…` : `Répondre à ${agent.nom}…`}
                    rows={1}
                    className="w-full text-[13px] text-[#1D1D1F] dark:text-white placeholder-[#86868B] outline-none resize-none leading-relaxed bg-transparent disabled:cursor-not-allowed"
                    style={{ minHeight: "20px" }}
                  />
                </div>
                <button onClick={handleSend} disabled={sending || !inputText.trim()}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm shrink-0 ${!sending && inputText.trim() ? "bg-[#007AFF] hover:bg-[#0080FF] text-white" : "bg-[#E5E5EA] text-[#86868B] cursor-not-allowed"}`}>
                  {sending ? <div className="w-3 h-3 border-2 border-[#86868B] border-t-transparent rounded-full animate-spin" /> : <Send size={15} />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-[#F5F5F7] rounded-[20px] flex items-center justify-center mx-auto">
                <Mail size={28} className="text-[#86868B]" />
              </div>
              <p className="text-[15px] font-semibold text-[#1D1D1F]">Sélectionne une conversation</p>
              <p className="text-[13px] text-[#86868B]">{unreadCount} message{unreadCount > 1 ? "s" : ""} non lu{unreadCount > 1 ? "s" : ""}</p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
