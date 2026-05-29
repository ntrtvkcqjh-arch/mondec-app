"use client";

import { useState, useEffect, useRef } from "react";
import { useGameStore } from "@/lib/supabase-store";
import { apiFetch } from "@/lib/api-client";
import { Sparkles, X, Send, AlertTriangle } from "lucide-react";

export function ClaudeFloating() {
  const store = useGameStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [store.claude_history, open]);

  // Écouter l'event custom pour ouvrir le chat depuis le ClaudeTuteur
  useEffect(() => {
    function handleOpen() { setOpen(true); }
    if (typeof window !== "undefined") {
      window.addEventListener("open-claude-chat", handleOpen);
      return () => window.removeEventListener("open-claude-chat", handleOpen);
    }
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setError("");
    store.addClaudeMessage({ role: "user", content: text });
    setSending(true);
    try {
      const history = store.claude_history;
      const res = await apiFetch("/api/claude", {
        method: "POST",
        body: JSON.stringify({
          messages: [...history, { role: "user", content: text }],
          game_state: {
            day: store.game_day, hour: store.game_hour, minute: store.game_minute,
            player_level: store.player_level, legitimite: store.legitimite,
            tresorerie: store.tresorerie, stress_global: store.stress_global,
            points_action: store.points_action, points_action_max: store.points_action_max,
            mood_global: store.mood_global,
          },
          agents: store.agents,
          dossiers: store.dossiers,
        }),
      });
      if (!res.ok) { setError(`Erreur ${res.status}`); return; }
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      if (data.content) store.addClaudeMessage({ role: "assistant", content: data.content });
    } catch { setError("Erreur réseau"); }
    finally { setSending(false); }
  }

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open ? (
        <div className="bg-white rounded-[18px] shadow-2xl w-[380px] h-[500px] flex flex-col border border-[#E5E5EA]/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E5EA]/40 bg-gradient-to-r from-[#007AFF] to-[#5856D6] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                <Sparkles size={13} className="text-white" />
              </div>
              <div>
                <div className="font-semibold text-[13px] text-white">Claude</div>
                <div className="text-[10px] text-white/70">Conseil stratégique cabinet</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
              <X size={13} className="text-white" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {store.claude_history.length === 0 && (
              <div className="text-center py-6 px-2">
                <Sparkles size={24} className="text-[#007AFF] mx-auto mb-2" />
                <p className="text-[12px] text-[#1D1D1F] font-medium mb-1">Bonjour 👋</p>
                <p className="text-[11px] text-[#86868B] leading-relaxed">Je suis Claude. Je vois tout le cabinet en temps réel. Demande-moi des conseils.</p>
                <div className="mt-3 flex flex-col gap-1.5">
                  {["Que faire en priorité ?", "État du cabinet ?", "Rappel sur les IFRS"].map((s) => (
                    <button key={s} onClick={() => setInput(s)}
                      className="text-[11px] text-[#007AFF] bg-[#007AFF]/8 hover:bg-[#007AFF]/12 px-2.5 py-1 rounded-full transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {store.claude_history.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-[14px] text-[12px] leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-gradient-to-br from-[#007AFF] to-[#0040DD] text-white rounded-br-[4px]"
                    : "bg-[#F5F5F7] text-[#1D1D1F] rounded-tl-[4px]"
                }`}>{m.content}</div>
              </div>
            ))}
            {sending && (
              <div className="flex">
                <div className="bg-[#F5F5F7] rounded-[14px] rounded-tl-[4px] px-3 py-2 flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#86868B] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#86868B] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#86868B] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {error && (
            <div className="px-3 py-1.5 bg-[#FF3B30]/8 border-t border-[#FF3B30]/15 text-[11px] text-[#FF3B30] flex items-center gap-1.5">
              <AlertTriangle size={11} /> {error}
            </div>
          )}

          <div className="px-3 py-2 border-t border-[#E5E5EA]/40">
            <div className="flex gap-2">
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }}}
                disabled={sending} placeholder="Demande à Claude…"
                className="flex-1 text-[12px] px-3 py-2 bg-[#F5F5F7] rounded-full outline-none placeholder-[#86868B] disabled:opacity-60" />
              <button onClick={send} disabled={!input.trim() || sending}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${input.trim() && !sending ? "bg-gradient-to-br from-[#007AFF] to-[#0040DD] text-white shadow-sm" : "bg-[#E5E5EA] text-[#86868B] cursor-not-allowed"}`}>
                <Send size={12} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-[#007AFF] via-[#5856D6] to-[#AF52DE] shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center group">
          <Sparkles size={22} className="text-white group-hover:rotate-12 transition-transform" />
        </button>
      )}
    </div>
  );
}
