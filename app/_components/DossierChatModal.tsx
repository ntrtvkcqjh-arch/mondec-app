"use client";

import { useState, useEffect, useRef } from "react";
import { useGameStore } from "@/lib/supabase-store";
import { apiFetch } from "@/lib/api-client";
import type { Dossier } from "@/lib/supabase-store";
import { X, Send, Sparkles, AlertTriangle, RefreshCw } from "lucide-react";
import { SectorTag } from "./SectorTag";

interface Props {
  dossier: Dossier;
  onClose: () => void;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

const STORAGE_KEY = "dossier_chats_v1"; // map<dossier_id, Msg[]>

function loadHistory(dossierId: string): Msg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw);
    return Array.isArray(all?.[dossierId]) ? all[dossierId] : [];
  } catch {
    return [];
  }
}

function saveHistory(dossierId: string, msgs: Msg[]) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[dossierId] = msgs.slice(-50); // keep last 50 messages
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

/**
 * Mini-chat dédié à un dossier client. Sophie/Thomas/agent en contexte du dossier.
 * Garde l'historique en localStorage par dossier_id pour la traçabilité.
 */
export function DossierChatModal({ dossier, onClose }: Props) {
  const store = useGameStore();
  const agent = store.agents.find((a) => a.id === dossier.agent_id);
  const [history, setHistory] = useState<Msg[]>(() => loadHistory(dossier.id));
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  async function send(promptOverride?: string) {
    const text = (promptOverride ?? input).trim();
    if (!text || sending) return;
    if (!promptOverride) setInput("");
    setError("");

    const userMsg: Msg = { role: "user", content: text, ts: Date.now() };
    const newHistory = [...history, userMsg];
    setHistory(newHistory);
    saveHistory(dossier.id, newHistory);
    setSending(true);

    try {
      // On utilise /api/claude (tuteur) avec un contexte enrichi du dossier
      const dossierContext = `
# CONVERSATION FOCALISÉE SUR LE DOSSIER : ${dossier.client}
Tu réponds en t'aidant des données ci-dessous. Reste **concentré sur ce dossier précis** — pas de digression sur les autres clients du cabinet sauf si pertinent.

## FICHE DOSSIER
- Client : ${dossier.client}
- Secteur : ${dossier.secteur || "?"} (${dossier.secteur_categorie || "?"})
- CA : ${((dossier.ca || 0) / 1000000).toFixed(1)}M€ · Effectif : ${dossier.effectif || "?"} · Forme : ${dossier.forme_juridique || "?"}
- Régime TVA : ${dossier.regime_tva || "?"}
- VIP : ${dossier.is_vip ? "Oui ⭐" : "Non"}
- Honoraires/an : ${((dossier.honoraires_annuels || 0) / 1000).toFixed(0)}k€
- Anciennéte : ${dossier.anciennete_annees || 0} ans

## ÉTAT DU DOSSIER
- Phase : ${dossier.phase} (${dossier.progression}% avancé)
- État : ${dossier.etat}
- Qualité : ${dossier.qualite}%
- Satisfaction client : ${dossier.satisfaction || "?"}%
- Signaux d'alerte : ${dossier.signaux_alerte.join(", ") || "aucun"}
${dossier.cause_perte ? `- Cause perte : ${dossier.cause_perte}` : ""}

## COLLABORATEUR AFFECTÉ
${agent ? `${agent.nom} (${agent.role}, filière ${agent.filiere}) — stress ${agent.stress}, confiance ${agent.confiance_joueur}, émotion ${agent.emotion}` : "Aucun"}

## CRITÈRES CLIENT
- Profil relationnel : ${dossier.profil_relationnel || "?"}/100 (0=patient, 100=exigeant)
- Complexité comptable : ${dossier.complexite_comptable || "?"}/100
- Rentabilité : ${dossier.rentabilite || "?"}/100
- Réactivité demandée : ${dossier.reactivite_demandee || "?"}/100
- Tolérance erreurs : ${dossier.tolerance_erreurs || "?"}/100
- Spécialités requises : ${(dossier.specialites_requises || []).join(", ") || "Aucune"}

## QUESTION DU PATRON
${text}

Réponds en **3-5 phrases max**, ton coach expérimenté qui connaît ce dossier par cœur. Cite des chiffres précis du dossier dans ta réponse. Propose UNE action concrète à la fin si pertinent.`;

      const r = await apiFetch("/api/claude", {
        method: "POST",
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
          game_state: {
            day: store.game_day, hour: store.game_hour, minute: store.game_minute,
            player_level: store.player_level, legitimite: store.legitimite,
            tresorerie: store.tresorerie, mood_global: store.mood_global,
            dossier_focus_id: dossier.id,
            dossier_focus_context: dossierContext,
          },
          agents: agent ? [agent] : [],
          dossiers: [dossier],
        }),
      });

      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        if (errData?.needs_credit) setError("Compte Anthropic sans crédit — ouvre ⚙");
        else setError(errData?.error || `HTTP ${r.status}`);
        return;
      }
      const d = await r.json();
      if (d.content) {
        const assistantMsg: Msg = { role: "assistant", content: d.content, ts: Date.now() };
        const updated = [...newHistory, assistantMsg];
        setHistory(updated);
        saveHistory(dossier.id, updated);
      } else if (d.error) {
        setError(d.diagnostic || d.error);
      }
    } catch (e: any) {
      setError("Erreur réseau : " + (e?.message || "inconnue"));
    } finally {
      setSending(false);
    }
  }

  function clearHistory() {
    if (!confirm("Effacer toute la conversation de ce dossier ?")) return;
    setHistory([]);
    saveHistory(dossier.id, []);
  }

  return (
    <div className="fixed inset-0 z-[55] bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] shadow-2xl dark:shadow-black/60 w-full max-w-2xl h-[80vh] overflow-hidden flex flex-col border border-transparent dark:border-[#38383a]/60">
        <div className="px-5 py-3 border-b border-[#E5E5EA]/40 dark:border-[#38383a]/60 bg-gradient-to-r from-[#007AFF] via-[#5856D6] to-[#AF52DE]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                <Sparkles size={17} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-[15px] text-white tracking-tight flex items-center gap-2">
                  Conversation : {dossier.client}
                  {dossier.secteur_categorie && <SectorTag categorie={dossier.secteur_categorie} size="sm" />}
                </h3>
                <p className="text-[11px] text-white/80">{agent ? `Avec ${agent.nom.split(" ")[0]} · ${dossier.phase} · ${dossier.progression}% · qualité ${dossier.qualite}%` : "Aucun collaborateur"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button onClick={clearHistory} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center" title="Effacer la conversation">
                  <RefreshCw size={12} className="text-white" />
                </button>
              )}
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center">
                <X size={14} className="text-white" />
              </button>
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#fafafa] dark:bg-black">
          {history.length === 0 && (
            <div className="text-center py-8">
              <Sparkles size={24} className="text-[#007AFF] mx-auto mb-2" />
              <p className="text-[12px] text-[#1D1D1F] dark:text-white font-medium mb-1">Discutons de {dossier.client}</p>
              <p className="text-[11px] text-[#86868B] dark:text-[#98989D] leading-relaxed max-w-sm mx-auto">
                Je connais ce dossier par cœur. Pose-moi tes questions : stratégie, risques, qualité, équipe affectée…
              </p>
              <div className="mt-3 flex flex-col gap-1.5 max-w-xs mx-auto">
                {[
                  "Quels sont les risques sur ce dossier ?",
                  "Faut-il renforcer la qualité ?",
                  "Le collaborateur est-il adapté ?",
                  "Que faire pour clôturer rapidement ?",
                ].map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="text-[11px] text-[#007AFF] dark:text-[#0A84FF] bg-[#007AFF]/8 dark:bg-[#0A84FF]/15 hover:bg-[#007AFF]/15 px-2.5 py-1.5 rounded-full transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {history.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-[14px] text-[12px] leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-gradient-to-br from-[#007AFF] to-[#0040DD] text-white rounded-br-[4px] shadow-sm"
                  : "bg-white dark:bg-[#1c1c1e] text-[#1D1D1F] dark:text-white rounded-tl-[4px] border border-[#E5E5EA]/40 dark:border-[#38383a]"
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex">
              <div className="bg-white dark:bg-[#1c1c1e] rounded-[14px] rounded-tl-[4px] px-3 py-2 flex gap-1 border border-[#E5E5EA]/40 dark:border-[#38383a]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#86868B] animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[#86868B] animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[#86868B] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="px-4 py-1.5 bg-[#FF3B30]/8 dark:bg-[#FF453A]/15 border-t border-[#FF3B30]/15 text-[11px] text-[#FF3B30] flex items-center gap-1.5">
            <AlertTriangle size={11} /> {error}
          </div>
        )}

        <div className="px-4 py-3 border-t border-[#E5E5EA]/40 dark:border-[#38383a]/60 bg-white dark:bg-[#1c1c1e]">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              disabled={sending}
              placeholder={`Pose ta question sur ${dossier.client}…`}
              className="flex-1 text-[12px] px-3 py-2 bg-[#F5F5F7] dark:bg-[#2c2c2e] dark:text-white rounded-full outline-none placeholder-[#86868B] disabled:opacity-60"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || sending}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${
                input.trim() && !sending
                  ? "bg-gradient-to-br from-[#007AFF] to-[#0040DD] text-white shadow-sm"
                  : "bg-[#E5E5EA] dark:bg-[#38383a] text-[#86868B] cursor-not-allowed"
              }`}
            >
              <Send size={13} />
            </button>
          </div>
          <p className="text-[9px] text-[#86868B] dark:text-[#98989D] mt-1 text-center">
            Conversation persistée localement · {history.length} message{history.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
