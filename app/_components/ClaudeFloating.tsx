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

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    console.log("[CLAUDE] send() déclenché", { text, sending });
    if (!text || sending) return;
    if (!overrideText) setInput("");
    setError("");
    store.addClaudeMessage({ role: "user", content: text });
    setSending(true);
    try {
      const history = store.claude_history;
      // Contexte cabinet enrichi pour Claude tuteur — agrège ce qu'un manager voit
      const unreadCount = store.messages.filter((m) => !m.lu).length;
      const stressedAgents = store.agents.filter((a) => a.stress > 70).map((a) => ({ nom: a.nom, stress: a.stress, role: a.role }));
      const burnoutAgents = store.agents.filter((a) => a.stress > 80 || a.fatigue > 80).map((a) => ({ nom: a.nom, stress: a.stress, fatigue: a.fatigue }));
      const ruptureAgents = store.agents.filter((a: any) => a.arc_actuel === "Rupture").map((a) => a.nom);
      const dossierStats = {
        total: store.dossiers.length,
        en_cours: store.dossiers.filter((d) => d.etat === "en_cours").length,
        avance: store.dossiers.filter((d) => d.etat === "avance").length,
        perdu: store.dossiers.filter((d) => d.etat === "perdu").length,
        vip: store.dossiers.filter((d) => d.is_vip).length,
      };
      console.log("[CLAUDE] Envoi à /api/claude…");
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
            unread_messages: unreadCount,
            stressed_agents: stressedAgents,
            burnout_agents: burnoutAgents,
            rupture_agents: ruptureAgents,
            dossier_stats: dossierStats,
            prospects_pending: store.prospects_pending.length,
            dec_streak: store.dec_streak,
          },
          agents: store.agents,
          dossiers: store.dossiers,
        }),
      });
      console.log("[CLAUDE] Status HTTP:", res.status);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData?.error || `HTTP ${res.status}`;
        console.error("[CLAUDE] Erreur:", msg);
        if (errData?.needs_credit) {
          setError(errData?.diagnostic || "Compte Anthropic sans crédit — recharge sur console.anthropic.com/settings/billing");
        } else if (res.status === 401) {
          setError("Clé API invalide ou révoquée — ouvre ⚙");
        } else {
          setError(msg);
        }
        return;
      }
      const data = await res.json();
      console.log("[CLAUDE] Réponse OK", { hasContent: !!data.content });
      if (data.error) { setError(data.diagnostic || data.error); return; }
      if (data.content) store.addClaudeMessage({ role: "assistant", content: data.content });
    } catch (err: any) {
      console.error("[CLAUDE] Exception:", err);
      setError("Erreur réseau : " + (err?.message || "inconnue"));
    } finally { setSending(false); }
  }

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open ? (
        <div className="bg-white dark:bg-[#1c1c1e] rounded-[18px] shadow-2xl w-[380px] h-[500px] flex flex-col border border-[#E5E5EA]/40 dark:border-[#38383a] overflow-hidden">
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
                <p className="text-[12px] text-[#1D1D1F] dark:text-white font-medium mb-1">Bonjour 👋</p>
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
                    : "bg-[#F5F5F7] dark:bg-[#2c2c2e] text-[#1D1D1F] dark:text-white rounded-tl-[4px]"
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

          {/* Raccourcis rapides — actions structurantes (hybride boutons + écriture libre) */}
          <div className="px-3 pt-2 pb-1 border-t border-[#E5E5EA]/40 dark:border-[#38383a] flex gap-1 overflow-x-auto">
            {[
              { label: "📊 État des lieux", prompt: "Fais-moi un récap synthétique : dossiers en retard, stress équipe, trésorerie et 3 priorités à traiter aujourd'hui." },
              { label: "⚠️ Risques fiscaux", prompt: "Liste les 3 principaux risques fiscaux actuels sur les dossiers actifs avec recommandation." },
              { label: "👥 Qui va mal ?", prompt: "Qui dans l'équipe va mal aujourd'hui (stress / fatigue / loyauté) et que dois-je faire ?" },
              { label: "💰 Trésorerie", prompt: "Quelle est ma trésorerie disponible, mes engagements RH et le solde libre ?" },
            ].map((s) => (
              <button key={s.label} onClick={() => send(s.prompt)} disabled={sending}
                className="text-[10px] whitespace-nowrap text-[#007AFF] dark:text-[#0A84FF] bg-[#007AFF]/8 dark:bg-[#0A84FF]/15 hover:bg-[#007AFF]/15 dark:hover:bg-[#0A84FF]/25 px-2 py-1 rounded-full transition-colors disabled:opacity-50">
                {s.label}
              </button>
            ))}
          </div>
          <div className="px-3 pb-2">
            <div className="flex gap-2">
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }}}
                disabled={sending} placeholder="Ou écris librement à Claude…"
                className="flex-1 text-[12px] px-3 py-2 bg-[#F5F5F7] dark:bg-[#2c2c2e] dark:text-white rounded-full outline-none placeholder-[#86868B] disabled:opacity-60" />
              <button onClick={() => send()} disabled={!input.trim() || sending}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${input.trim() && !sending ? "bg-gradient-to-br from-[#007AFF] to-[#0040DD] text-white shadow-sm" : "bg-[#E5E5EA] dark:bg-[#38383a] text-[#86868B] cursor-not-allowed"}`}>
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
