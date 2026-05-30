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

type ConvFilter = "tous" | "nouveaux" | "non_lus" | "sans_reponse" | "anciens";

/**
 * Analyse le message du joueur et détecte une intention forte (licencier, former,
 * récompenser, réaffecter). Demande confirmation pour les actions destructives,
 * puis exécute via le store. Affiche un toast/alert pour confirmer l'exécution.
 */
function detectAndExecuteIntent(text: string, agent: any, store: ReturnType<typeof useGameStore>) {
  const lower = text.toLowerCase().trim();

  // === LICENCIEMENT ===
  // Patterns : "tu es viré", "je te vire", "tu pars", "je te licencie", "dégage", "fait tes valises"
  const firePatterns = [
    /\btu\s+es\s+vir[ée]\b/,
    /\bje\s+te\s+vire\b/,
    /\btu\s+pars\b/,
    /\bje\s+te\s+licenci[ée]?\b/,
    /\bd[ée]gage\b/,
    /\bfait?s?\s+tes\s+valises\b/,
    /\bquitte\s+le\s+cabinet\b/,
    /\btu\s+n'es?\s+plus\s+ici\b/,
    /\btu\s+es\s+licenci[ée]\b/,
  ];
  if (firePatterns.some((p) => p.test(lower))) {
    const confirmed = confirm(
      `⚠️ Tu viens de dire à ${agent.nom} qu'il/elle est licencié(e).\n\n` +
      `Cela va :\n` +
      `• Le retirer définitivement de l'équipe\n` +
      `• Réaffecter ses ${store.dossiers.filter((d: any) => d.agent_id === agent.id).length} dossier(s)\n` +
      `• Impacter la légitimité (-5) et le stress équipe (+5)\n\n` +
      `Confirmer le licenciement ?`
    );
    if (confirmed) {
      const motif = lower.match(/\b(parce\s+qu[e']|car|à\s+cause\s+de)\s+(.{5,100})/)?.[2] || "Décision du patron";
      const res = store.fireAgent(agent.id, motif.trim().slice(0, 100), "licencie");
      if (res.ok) {
        alert(`✅ ${agent.nom} a quitté le cabinet. Ses dossiers ont été réaffectés. Sophie a envoyé un message de confirmation.`);
      }
    } else {
      alert(`Action annulée. ${agent.nom} reste dans l'équipe.`);
    }
    return;
  }

  // === FORMATION ===
  const trainPatterns = [
    /\b(je\s+t['e]\s+autorise|tu\s+peux)\s+(une\s+|la\s+)?formation\b/,
    /\bj[e']?\s+(t['e]?\s+)?envoie\s+en\s+formation\b/,
    /\bje\s+te\s+forme\b/,
  ];
  if (trainPatterns.some((p) => p.test(lower))) {
    const res = store.trainAgent(agent.id);
    if (res.ok) {
      alert(`🎓 Formation de ${agent.nom.split(" ")[0]} programmée (3h + 3k€).`);
    } else {
      alert(`Formation impossible : ${res.reason}`);
    }
    return;
  }

  // === RÉCOMPENSE ===
  const rewardPatterns = [
    /\b(je\s+te|tu\s+as)\s+(une\s+)?prime\b/,
    /\bch[èe]que.cadeau\b/,
    /\bje\s+te\s+r[ée]compense\b/,
    /\bbravo\s+pour\s+ton\s+travail/,
    /\btu\s+(as|a)\s+m[ée]rit[ée]\b/,
  ];
  if (rewardPatterns.some((p) => p.test(lower))) {
    const res = store.rewardAgent(agent.id);
    if (res.ok) {
      alert(`💝 ${agent.nom.split(" ")[0]} récompensé(e) (chèque-cadeau 500€).`);
    }
    return;
  }
}

/**
 * Détecte et exécute un envoi de mail demandé par le patron à un agent.
 * Le marqueur émis par l'API chat est :
 *   [[MAIL_TO=<Nom>|SUJET=<sujet>|CORPS=<corps>]]
 * Cette fonction parse, déduit le type de destinataire (agent / client / external),
 * crée le mail via store.sendMail, et renvoie le texte nettoyé pour affichage.
 */
export function extractAndExecuteMailMarker(
  rawContent: string,
  sender: any, // agent qui envoie
  store: ReturnType<typeof useGameStore>
): string {
  const re = /\[\[MAIL_TO=([^|]+?)\|SUJET=([^|]+?)\|CORPS=([^\]]+?)\]\]/i;
  const match = rawContent.match(re);
  if (!match) return rawContent;
  const [, destRaw, sujet, corps] = match;
  const dest = destRaw.trim();
  const destLower = dest.toLowerCase();

  // 1) Cherche un agent (par nom complet ou prénom)
  const agentDest = store.agents.find((a) =>
    a.nom.toLowerCase() === destLower ||
    a.nom.toLowerCase().split(" ")[0] === destLower ||
    destLower.includes(a.nom.toLowerCase().split(" ")[0])
  );
  // 2) Sinon cherche un client (dossier)
  const dossierDest = !agentDest ? store.dossiers.find((d) =>
    d.client.toLowerCase().includes(destLower) ||
    destLower.includes(d.client.toLowerCase().split(" ")[0])
  ) : null;

  const senderAgent = sender;
  const fromContact = {
    type: "agent" as const,
    id: senderAgent.id,
    name: senderAgent.nom,
    email: `${senderAgent.nom.toLowerCase().replace(/\s+/g, ".")}@cabinet-morel.fr`,
  };

  let toContact: any;
  if (agentDest) {
    toContact = {
      type: "agent" as const,
      id: agentDest.id,
      name: agentDest.nom,
      email: `${agentDest.nom.toLowerCase().replace(/\s+/g, ".")}@cabinet-morel.fr`,
    };
  } else if (dossierDest) {
    const slug = dossierDest.client.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
    toContact = {
      type: "client" as const,
      id: dossierDest.id,
      name: `Direction ${dossierDest.client}`,
      email: `direction@${slug}.fr`,
    };
  } else {
    toContact = {
      type: "external" as const,
      name: dest,
      email: `${dest.toLowerCase().replace(/\s+/g, ".")}@externe.fr`,
    };
  }

  store.sendMail({
    to: [toContact],
    cc: [],
    subject: sujet.trim(),
    body: `${corps.trim()}\n\n— ${senderAgent.nom}\nCabinet Morel & Associés`,
  });

  // Affiche le mail dans le chat sans le marqueur brut
  const cleaned = rawContent.replace(re, `📧 *Mail envoyé à ${toContact.name} — sujet : "${sujet.trim()}"*`).trim();
  return cleaned;
}

/**
 * Détecte si un message de l'agent demande explicitement un entretien physique
 * (face à face, RDV, point en privé…). Utilisé pour proposer un bouton "Aller
 * en entretien" directement depuis la conversation.
 */
export function isInterviewRequest(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  const patterns = [
    /\bentretien\b/,
    /\b(en\s+)?face[\s-]?à[\s-]?face\b/,
    /\b(prendre|fixer|caler|avoir|organiser)\s+(un\s+)?(rdv|rendez[\s-]?vous|point)\b/,
    /\bse\s+voir\b/,
    /\bon\s+(peut|pourrait|devrait|doit)\s+se\s+voir\b/,
    /\bon\s+en\s+parle\s+(en\s+)?(face|tête|direct|live)\b/,
    /\bj['e]\s*aimerais\s+(qu['e]\s*on|te?)\s+(voir|parler|discuter|rencontrer)\b/,
    /\bil\s+faut\s+(qu['e]\s*on|que\s+(nous|l'on))\s+se\s+voir\b/,
    /\bpoint\s+(en\s+)?(privé|face|individuel)\b/,
    /\bréunion\s+individuelle\b/,
    /\bbesoin\s+d['e]?\s*un\s+(entretien|temps\s+avec)\b/,
  ];
  return patterns.some((p) => p.test(lower));
}

/**
 * Déclenche l'ouverture de l'onglet Entretien pré-rempli avec l'agent
 * sélectionné et un brief résumant la conversation récente. Le brief est
 * stocké en localStorage pour que EntretiensView le récupère au montage.
 */
export function openInterviewWithAgent(agentId: string, contextSummary: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("pending_entretien", JSON.stringify({
      agent_id: agentId,
      context: contextSummary,
      ts: Date.now(),
    }));
  } catch {}
  window.dispatchEvent(new CustomEvent("switch-tab", { detail: { tab: "entretiens" } }));
  // Petit retard pour laisser EntretiensView se monter
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent("open-pending-entretien"));
  }, 100);
}

// Détermine la "fraîcheur" d'un message à partir de son timestamp réel
function getMessageAge(timestamp: string): { isNew: boolean; isRecent: boolean; isOld: boolean; ageLabel: string } {
  const ts = new Date(timestamp).getTime();
  const now = Date.now();
  const ageHours = (now - ts) / (1000 * 60 * 60);
  if (ageHours < 24) {
    const h = Math.floor(ageHours);
    const min = Math.floor((ageHours - h) * 60);
    const label = h < 1 ? `${min}min` : `${h}h${String(min).padStart(2, "0")}`;
    return { isNew: true, isRecent: false, isOld: false, ageLabel: `il y a ${label}` };
  }
  if (ageHours < 72) {
    return { isNew: false, isRecent: true, isOld: false, ageLabel: `il y a ${Math.floor(ageHours / 24)}j` };
  }
  const days = Math.floor(ageHours / 24);
  return { isNew: false, isRecent: false, isOld: true, ageLabel: days < 30 ? `il y a ${days}j` : `il y a +${Math.floor(days / 30)}m` };
}

export function MessagesView({ onOpenKeyModal }: Props) {
  const store = useGameStore();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [apiError, setApiError] = useState("");
  const [apiNeedsCredit, setApiNeedsCredit] = useState(false);
  const [retesting, setRetesting] = useState(false);
  const [convFilter, setConvFilter] = useState<ConvFilter>("tous");
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Re-test la clé via /api/health et efface la bannière si OK
  async function handleRetest() {
    if (retesting) return;
    setRetesting(true);
    try {
      const r = await apiFetch("/api/health");
      const d = await r.json();
      if (d.ok) {
        setApiError("");
        setApiNeedsCredit(false);
      } else {
        setApiError(d.diagnostic || d.reason || "Échec re-test");
        setApiNeedsCredit(!!d.needs_credit);
      }
    } catch (e: any) {
      setApiError("Erreur réseau pendant re-test : " + (e?.message || "inconnue"));
    } finally {
      setRetesting(false);
    }
  }

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

  // Écoute les événements du tuteur (clic "Parler à X →")
  useEffect(() => {
    function handler(e: any) {
      const id = e?.detail?.agentId;
      if (id && store.agents.some((a) => a.id === id)) {
        handleSelectAgent(id);
      }
    }
    if (typeof window !== "undefined") {
      window.addEventListener("select-agent", handler as any);
      return () => window.removeEventListener("select-agent", handler as any);
    }
  }, [store.agents.length]);

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

    // Chat illimité — plus de limite de PA pour envoyer des messages
    // (les PA restent utilisables pour les actions stratégiques : Former, Récupération, etc.)

    // Mémoire enrichie : on construit l'historique pour Claude en injectant TOUS
    // les messages que l'agent t'a envoyés (depuis store.messages[]) comme des
    // tours "assistant". Sinon Claude ne voit pas ce que l'agent t'a dit en premier
    // et te répond comme s'il découvrait la conversation.
    const agentInitialMessages = store.messages
      .filter((m) => m.agent_id === agent.id)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((m) => ({
        role: "assistant" as const,
        content: `[${m.niveau} · ${m.sujet}]\n${m.contenu}${m.reponse_joueur ? `\n\n— Tu as répondu à ce moment-là : "${m.reponse_joueur}"` : ""}`,
      }));

    const storedHistory = store.conversation_history[agent.id] || [];
    // Dedoublonnage : si un message initial a déjà été ajouté à storedHistory, ne pas le ré-injecter
    const initialSubjects = new Set(storedHistory.map((m) => m.content.slice(0, 80)));
    const initialToInject = agentInitialMessages.filter((m) => !initialSubjects.has(m.content.slice(0, 80)));

    const fullHistory = [...initialToInject, ...storedHistory];
    const userMsg = { role: "user" as const, content: text };
    console.log("[CHAT] Envoi à l'API…", { agent: agent.nom, initialMsgs: initialToInject.length, storedMsgs: storedHistory.length });

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
          messages: [...fullHistory, userMsg],
          agent_context: agent,
          game_state: {
            date: store.date_simulation,
            mood: store.mood_global,
            hour: store.game_hour,
            minute: store.game_minute,
            day: store.game_day,
            player_level: store.player_level,
            // Contexte enrichi : dossiers de l'agent, satisfaction, etc.
            agent_dossiers: store.dossiers.filter((d) => d.agent_id === agent.id).map((d) => ({
              client: d.client, etat: d.etat, progression: d.progression, phase: d.phase, qualite: d.qualite,
            })),
            agent_history_recent: (store.agent_player_history[agent.id] || []).slice(0, 5),
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const serverDiagnostic = errData?.diagnostic;
        const serverError = errData?.error;
        const serverNeedsCredit = !!errData?.needs_credit;
        setApiNeedsCredit(serverNeedsCredit);
        if (serverNeedsCredit) {
          setApiError(serverDiagnostic || "Compte Anthropic sans crédit ou sans accès aux modèles — vérifie console.anthropic.com/settings/billing");
        } else if (res.status === 401) {
          setApiError("Clé API invalide ou révoquée — ouvre ⚙ pour la corriger");
        } else {
          setApiError(`${serverError || `HTTP ${res.status}`}`);
        }
        return;
      }

      const data = await res.json();
      console.log("[CHAT] Réponse reçue:", { hasContent: !!data.content, hasError: !!data.error, model: data.model_used });
      if (data.error) {
        setApiNeedsCredit(!!data.needs_credit);
        setApiError(data.diagnostic || `${data.error}`);
        return;
      }
      // Succès : on efface tout état d'erreur précédent
      setApiNeedsCredit(false);
      if (!data.content) {
        setApiError("Réponse vide — réessaye");
        return;
      }
      console.log("[CHAT] Contenu agent reçu, mise à jour conversation_history");

      // 📧 Si la réponse contient un marqueur d'envoi de mail, on l'exécute
      const cleanedContent = extractAndExecuteMailMarker(data.content, agent, store);

      useGameStore.setState((s) => ({
        conversation_history: {
          ...s.conversation_history,
          [agent.id]: [
            ...(s.conversation_history[agent.id] || []),
            { role: "assistant" as const, content: cleanedContent },
          ],
        },
      }));

      if (store.user_id) {
        store.addConversation(agent.id, "user", text).catch(() => {});
        store.addConversation(agent.id, "assistant", data.content).catch(() => {});
      }
      // Marque TOUS les messages pending de cet agent comme répondus (pas juste le 1er)
      // — quand le joueur engage la conversation, il traite l'ensemble des sujets en attente
      const allPending = store.messages.filter((m) => m.agent_id === agent.id && !m.repondu);
      for (const p of allPending) {
        store.replyToMessage(p.id, text).catch(() => {});
      }

      // 🔥 DÉTECTION D'INTENTIONS — analyse le message du joueur pour déclencher des actions réelles
      detectAndExecuteIntent(text, agent, store);

      // 📖 CORRECTION EXAMINATEUR DEC — appel async pour évaluer la réponse du joueur
      const agentMessage = allPending[0]?.contenu || "(le patron a ouvert la conversation)";
      apiFetch("/api/chat-correction", {
        method: "POST",
        body: JSON.stringify({
          agent_message: agentMessage,
          player_response: text,
          agent,
          dossiers_lies: store.dossiers.filter((d) => d.agent_id === agent.id),
          game_state: {
            day: store.game_day, hour: store.game_hour, minute: store.game_minute,
            mood: store.mood_global, tresorerie: store.tresorerie, legitimite: store.legitimite,
          },
        }),
      })
        .then((r) => r.json())
        .then((corr) => {
          if (corr?.skip) return;
          if (corr?.note_sur_20 === undefined) return;
          store.addChatCorrection({
            game_day: store.game_day,
            game_hour: store.game_hour,
            game_minute: store.game_minute,
            date_iso: new Date().toISOString(),
            agent_id: agent.id,
            agent_nom: agent.nom,
            agent_role: agent.role,
            agent_message: agentMessage,
            player_response: text,
            note_sur_20: corr.note_sur_20,
            verdict: corr.verdict || "",
            points_forts: corr.points_forts || [],
            points_faibles: corr.points_faibles || [],
            reponse_ideale: corr.reponse_ideale || "",
            correction_detaillee: corr.correction_detaillee || "",
            sources: corr.sources || [],
            categorie_dec: corr.categorie_dec || "Communication",
          });
        })
        .catch((e) => console.warn("[CHAT] Correction failed:", e));
    } catch (err: any) {
      setApiError("Erreur réseau — " + (err?.message || "inconnue"));
    } finally {
      setSending(false);
    }
  }

  const unreadCount = store.messages.filter((m) => !m.lu).length;

  // Compteurs par filtre (pour les pills)
  const counts = {
    tous: conversationsByAgent.length,
    nouveaux: conversationsByAgent.filter((c) => c.unread > 0 && getMessageAge(c.lastMsg.timestamp).isNew).length,
    non_lus: conversationsByAgent.filter((c) => c.unread > 0).length,
    sans_reponse: conversationsByAgent.filter((c) => !!c.pendingMsg).length,
    anciens: conversationsByAgent.filter((c) => getMessageAge(c.lastMsg.timestamp).isOld).length,
  };

  // Filtre actif
  const filteredConvs = conversationsByAgent.filter((conv) => {
    const age = getMessageAge(conv.lastMsg.timestamp);
    if (convFilter === "nouveaux") return conv.unread > 0 && age.isNew;
    if (convFilter === "non_lus") return conv.unread > 0;
    if (convFilter === "sans_reponse") return !!conv.pendingMsg;
    if (convFilter === "anciens") return age.isOld;
    return true;
  });

  return (
    <>
      {/* Liste conversations */}
      <div className="w-72 bg-white/60 dark:bg-[#1c1c1e] backdrop-blur-xl border-r border-[#E5E5EA] dark:border-[#38383a] flex flex-col">
        <div className="px-3 py-3 border-b border-[#E5E5EA]/40 dark:border-[#38383a] flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white">Messagerie</h3>
          <span className="text-[10px] text-[#86868B]">{filteredConvs.length}/{conversationsByAgent.length}</span>
        </div>

        {/* Filtre conversations : pills horizontales */}
        <div className="px-2 py-2 border-b border-[#E5E5EA]/40 dark:border-[#38383a] flex gap-1 overflow-x-auto scrollbar-hide">
          {([
            { id: "tous", label: "Tous", emoji: "💬" },
            { id: "nouveaux", label: "Nouveaux", emoji: "🆕" },
            { id: "non_lus", label: "Non lus", emoji: "•" },
            { id: "sans_reponse", label: "À traiter", emoji: "✋" },
            { id: "anciens", label: "Anciens", emoji: "🗄" },
          ] as Array<{ id: ConvFilter; label: string; emoji: string }>).map((f) => {
            const active = convFilter === f.id;
            const count = counts[f.id];
            return (
              <button
                key={f.id}
                onClick={() => setConvFilter(f.id)}
                className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold transition-all flex items-center gap-1 ${
                  active
                    ? "bg-gradient-to-r from-[#007AFF] to-[#0a84ff] text-white shadow-sm"
                    : "bg-[#F5F5F7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#d1d1d6] hover:bg-[#E5E5EA] dark:hover:bg-[#38383a]"
                }`}
                title={`Filtrer : ${f.label} (${count})`}
              >
                <span>{f.emoji}</span>
                <span>{f.label}</span>
                {count > 0 && (
                  <span className={`tabular-nums ${active ? "text-white/80" : "text-[#86868B] dark:text-[#98989D]"}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {filteredConvs.length === 0 && (
            <div className="text-center py-12 px-4">
              <p className="text-[11px] text-[#86868B] dark:text-[#98989D]">Aucune conversation dans ce filtre.</p>
              {convFilter !== "tous" && (
                <button onClick={() => setConvFilter("tous")} className="mt-2 text-[10px] text-[#007AFF] dark:text-[#0A84FF] hover:underline">
                  Voir toutes →
                </button>
              )}
            </div>
          )}
          {filteredConvs.map((conv) => {
            const a = conv.agent;
            const isSelected = selectedAgent === a.id;
            const display = conv.pendingMsg || conv.lastMsg;
            const age = getMessageAge(conv.lastMsg.timestamp);
            const isFresh = conv.unread > 0 && age.isNew; // nouveau + non lu = pastille NOUVEAU
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
                      <span className={`text-[13px] font-semibold truncate ${isSelected ? "text-white" : "text-[#1D1D1F] dark:text-white"}`}>
                        {a.nom}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {isFresh && !isSelected && (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-gradient-to-r from-[#FF3B30] to-[#FF9500] text-white shadow-sm animate-pulse">
                            🆕 NOUVEAU
                          </span>
                        )}
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
                    <p className={`text-[12px] truncate mb-1 ${isSelected ? "text-white/80" : "text-[#86868B] dark:text-[#98989D]"}`}>
                      {display.sujet}
                    </p>
                    {/* Indicateur d'ancienneté (toujours visible) */}
                    <div className={`text-[9px] mb-1 ${isSelected ? "text-white/70" : age.isNew ? "text-[#34C759] font-semibold" : age.isOld ? "text-[#86868B] italic" : "text-[#86868B] dark:text-[#98989D]"}`}>
                      {age.isNew ? "🟢" : age.isRecent ? "🟡" : "⚫"} {age.ageLabel}
                    </div>
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
      <main className="flex-1 flex flex-col bg-white/40 dark:bg-black">
        {agent ? (
          <>
            <header className="px-7 py-4 bg-white/75 dark:bg-[#1c1c1e]/75 backdrop-blur-2xl border-b border-[#E5E5EA]/70 dark:border-[#38383a] flex items-center justify-between">
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
                      <div className="bg-[#E9E9EB] dark:bg-[#2c2c2e] rounded-[20px] rounded-tl-[6px] px-[14px] py-[9px]">
                        <p className="text-[14px] text-[#1D1D1F] dark:text-white leading-[1.4] whitespace-pre-wrap">{m.contenu}</p>
                      </div>
                      {isInterviewRequest(m.contenu) && (
                        <button
                          onClick={() => {
                            const recent = (store.conversation_history[agent.id] || []).slice(-6)
                              .map((c) => `${c.role === "user" ? "PATRON" : agent.nom.split(" ")[0]} : ${c.content}`).join("\n\n");
                            const summary = `Contexte : suite au message « ${m.sujet} » :\n\n${m.contenu}\n\n${recent ? "Échanges récents :\n" + recent : ""}`;
                            openInterviewWithAgent(agent.id, summary);
                          }}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-gradient-to-br from-[#FF9500] to-[#FF3B30] text-white text-[11px] font-semibold shadow-sm hover:shadow-md transition-all"
                        >
                          🤝 Convoquer en entretien
                        </button>
                      )}
                    </div>
                  </div>
                ))}

              {(store.conversation_history[agent.id] || []).map((msg, i) => {
                // Pour chaque message du joueur, on cherche la correction la plus proche en date
                let matchedCorr: any = null;
                if (msg.role === "user") {
                  matchedCorr = store.chat_corrections.find(
                    (c) => c.agent_id === agent.id && c.player_response === msg.content
                  );
                }
                return (
                  <div key={`conv_${i}`}>
                    <div className={`flex ${msg.role === "user" ? "justify-end" : "gap-3 max-w-[78%]"}`}>
                      {msg.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0 mt-1" style={{ backgroundColor: agent.avatar_color }}>
                          {agent.initiales}
                        </div>
                      )}
                      <div className={`px-[14px] py-[9px] rounded-[20px] text-[14px] leading-[1.4] whitespace-pre-wrap max-w-[75%] ${
                        msg.role === "user"
                          ? "bg-[#007AFF] text-white rounded-br-[6px] shadow-[0_1px_2px_rgba(0,122,255,0.25)]"
                          : "bg-[#E9E9EB] dark:bg-[#2c2c2e] text-[#1D1D1F] dark:text-white rounded-tl-[6px]"
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                    {/* Bouton entretien sous une réponse d'agent qui en demande un */}
                    {msg.role === "assistant" && isInterviewRequest(msg.content) && (
                      <div className="flex gap-3 max-w-[78%] mt-1 ml-11">
                        <button
                          onClick={() => {
                            const recent = (store.conversation_history[agent.id] || []).slice(-8)
                              .map((c) => `${c.role === "user" ? "PATRON" : agent.nom.split(" ")[0]} : ${c.content}`).join("\n\n");
                            const summary = `Contexte : demande d'entretien évoquée dans le chat.\n\nÉchanges récents :\n${recent}`;
                            openInterviewWithAgent(agent.id, summary);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-gradient-to-br from-[#FF9500] to-[#FF3B30] text-white text-[11px] font-semibold shadow-sm hover:shadow-md transition-all"
                        >
                          🤝 Convoquer en entretien
                        </button>
                      </div>
                    )}
                    {/* Correction inline sous la réponse du joueur (si dispo) */}
                    {matchedCorr && (
                      <div className="flex justify-end mt-1">
                        <CorrectionInlineCard correction={matchedCorr} />
                      </div>
                    )}
                  </div>
                );
              })}

              {sending && (
                <div className="flex gap-3 max-w-[78%]">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0" style={{ backgroundColor: agent.avatar_color }}>
                    {agent.initiales}
                  </div>
                  <div className="bg-[#E9E9EB] dark:bg-[#2c2c2e] rounded-[20px] rounded-tl-[6px] px-[14px] py-[9px]">
                    <div className="flex gap-1 items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#86868B] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#86868B] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#86868B] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-white/70 dark:bg-[#1c1c1e]/70 backdrop-blur-xl border-t border-[#E5E5EA]/50 dark:border-[#38383a]">
              {apiError && (
                <div className="flex items-center gap-2 mb-2 text-[11px] text-[#FF3B30] bg-[#FF3B30]/5 dark:bg-[#FF3B30]/10 border border-[#FF3B30]/15 dark:border-[#FF3B30]/25 rounded-lg px-2 py-1.5">
                  <AlertTriangle size={11} className="shrink-0" />
                  <span className="flex-1">{apiError}</span>
                  <button
                    onClick={handleRetest}
                    disabled={retesting}
                    title="Re-tester l'API (utile après avoir ajouté des crédits)"
                    className="px-2 py-0.5 bg-white dark:bg-[#2c2c2e] border border-[#FF3B30]/30 text-[#FF3B30] rounded-md text-[10px] font-semibold hover:bg-[#FF3B30]/10 dark:hover:bg-[#FF3B30]/15 transition-all flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw size={10} className={retesting ? "animate-spin" : ""} /> {retesting ? "Test…" : "Re-tester"}
                  </button>
                  {(apiNeedsCredit || apiError.includes("⚙") || apiError.toLowerCase().includes("crédit") || apiError.toLowerCase().includes("clé")) && (
                    <button onClick={onOpenKeyModal}
                      className="px-2 py-0.5 bg-[#FF3B30] text-white rounded-md text-[10px] font-semibold hover:bg-[#dc2626] transition-all">
                      Configurer ⚙
                    </button>
                  )}
                  <button onClick={() => { setApiError(""); setApiNeedsCredit(false); }} className="opacity-60 hover:opacity-100 shrink-0"><X size={11} /></button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <div className={`flex-1 bg-white dark:bg-[#1c1c1e] border rounded-[14px] px-4 py-2.5 shadow-sm transition-all ${sending ? "border-[#E5E5EA]/40 dark:border-[#38383a]/40 opacity-60" : "border-[#E5E5EA]/80 dark:border-[#38383a]"}`}>
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

/** Mini-carte inline qui affiche la note + verdict d'une correction sous la réponse joueur,
 *  dépliable pour voir la correction expert détaillée. */
function CorrectionInlineCard({ correction }: { correction: any }) {
  const [open, setOpen] = useState(false);
  const note = correction.note_sur_20;
  const color = note >= 16 ? "#34C759" : note >= 12 ? "#007AFF" : note >= 8 ? "#FF9500" : "#FF3B30";
  return (
    <div className="max-w-[75%] w-full">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left bg-gradient-to-r from-[#AF52DE]/8 to-[#5856D6]/8 dark:from-[#BF5AF2]/15 dark:to-[#5E5CE6]/15 border border-[#AF52DE]/20 dark:border-[#BF5AF2]/30 rounded-[12px] px-3 py-2 hover:from-[#AF52DE]/12 hover:to-[#5856D6]/12 transition-all"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#AF52DE] dark:text-[#BF5AF2]">📖 Examinateur DEC</span>
          <span className="text-[14px] font-bold tabular-nums leading-none ml-auto" style={{ color }}>{note}<span className="text-[10px] opacity-60">/20</span></span>
          <span className="text-[10px] text-[#86868B] dark:text-[#98989D]">{open ? "▴" : "▾"}</span>
        </div>
        {correction.verdict && (
          <div className={`text-[11px] text-[#3a3a3c] dark:text-[#d1d1d6] italic mt-1 ${open ? "" : "line-clamp-1"}`}>
            "{correction.verdict}"
          </div>
        )}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 bg-white dark:bg-[#1c1c1e] border border-[#E5E5EA]/40 dark:border-[#38383a] rounded-[12px] p-3">
          {correction.correction_detaillee && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#86868B] dark:text-[#98989D] mb-0.5">Correction de l'examinateur</div>
              <p className="text-[11px] text-[#1D1D1F] dark:text-[#d1d1d6] leading-relaxed">{correction.correction_detaillee}</p>
            </div>
          )}
          {correction.reponse_ideale && (
            <div className="bg-[#34C759]/5 dark:bg-[#30D158]/12 rounded-[8px] p-2">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#248A3D] dark:text-[#30D158] mb-0.5">Réponse idéale</div>
              <p className="text-[11px] text-[#1D1D1F] dark:text-[#d1d1d6] italic">"{correction.reponse_ideale}"</p>
            </div>
          )}
          {correction.sources?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {correction.sources.map((s: string, i: number) => (
                <span key={i} className="text-[9px] bg-[#86868B]/10 dark:bg-white/10 text-[#3a3a3c] dark:text-[#d1d1d6] px-1.5 py-0.5 rounded-md font-mono">{s}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
