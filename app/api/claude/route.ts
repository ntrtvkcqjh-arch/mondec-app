import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/api-key";
import { callAnthropic } from "@/lib/anthropic-helper";
import { getToneInstructions } from "@/lib/tone-helper";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!apiKey) return NextResponse.json({ error: "Clé API manquante" }, { status: 401 });

  const { messages, game_state, agents, dossiers } = await req.json();

  const agentsSummary = (agents || []).slice(0, 10).map((a: any) =>
    `- ${a.nom} (${a.role}, ${a.filiere}) — Stress:${a.stress} Fatigue:${a.fatigue} Confiance:${a.confiance_joueur} Loyauté:${a.loyaute || "?"} Arc:${a.arc_actuel || "Stable"} Émotion:${a.emotion}`
  ).join("\n");

  const dossiersSummary = (dossiers || []).slice(0, 12).map((d: any) =>
    `- ${d.client}${d.is_vip ? " ⭐VIP" : ""} : ${d.theme} (${d.etat}, ${d.progression}%, ${d.phase}, qualité ${d.qualite}%, satisfaction ${d.satisfaction || "?"}%) — agent ${d.agent_id}`
  ).join("\n");

  // Indicateurs cabinet enrichis (envoyés par ClaudeFloating)
  const stressedBlock = game_state?.stressed_agents?.length > 0
    ? `\n## ⚠️ AGENTS STRESSÉS (stress > 70)\n${game_state.stressed_agents.map((a: any) => `- ${a.nom} (${a.role}) — stress ${a.stress}`).join("\n")}`
    : "";
  const burnoutBlock = game_state?.burnout_agents?.length > 0
    ? `\n## 🔥 AGENTS EN BURN-OUT (stress > 80 ou fatigue > 80)\n${game_state.burnout_agents.map((a: any) => `- ${a.nom} — stress ${a.stress}, fatigue ${a.fatigue}`).join("\n")}`
    : "";
  const ruptureBlock = game_state?.rupture_agents?.length > 0
    ? `\n## 💼 AGENTS EN ARC RUPTURE (risque de départ)\n${game_state.rupture_agents.join(", ")}`
    : "";

  const tone = getToneInstructions(game_state?.player_level || 1, { role: "tuteur" });

  const systemPrompt = `${tone.systemBlock}

Tu es CLAUDE — l'assistant IA stratégique de l'expert-comptable associé au Cabinet Morel & Associés.

TON RÔLE :
- Conseiller le patron du cabinet sur ses arbitrages : équipe, dossiers, trésorerie, fiscal
- Suggérer des actions concrètes : "Parle à Léa", "Réaffecte le dossier X", "Valide la liasse Y"
- Aider à la préparation DEC (rappels techniques, méthodologie)
- Réponses en français, naturelles, concises (2-4 phrases) sauf question technique pointue
- Tu n'es PAS un collaborateur — tu vois TOUT le cabinet en temps réel et tu agis comme un coach

ÉTAT TEMPS RÉEL DU CABINET (date du jour : Jour ${game_state?.day || 1}, ${String(game_state?.hour || 9).padStart(2, "0")}h${String(game_state?.minute || 0).padStart(2, "0")}) :
- Niveau patron : ${game_state?.player_level || 1}/10
- Légitimité : ${game_state?.legitimite}/100
- Trésorerie : ${((game_state?.tresorerie || 0) / 1000).toFixed(0)}k€
- Stress global : ${game_state?.stress_global}/100
- Mood cabinet : ${game_state?.mood_global}
- Messages non lus : ${game_state?.unread_messages ?? "?"}
- Prospects en attente : ${game_state?.prospects_pending ?? 0}
- Streak DEC : ${game_state?.dec_streak ?? 0} jours
- Dossiers : ${game_state?.dossier_stats?.total ?? 0} total (${game_state?.dossier_stats?.en_cours ?? 0} en cours, ${game_state?.dossier_stats?.avance ?? 0} avancé, ${game_state?.dossier_stats?.perdu ?? 0} perdu, ${game_state?.dossier_stats?.vip ?? 0} VIP)

${stressedBlock}${burnoutBlock}${ruptureBlock}

## ÉQUIPE COMPLÈTE
${agentsSummary || "Aucun agent chargé"}

## DOSSIERS ACTIFS
${dossiersSummary || "Aucun dossier"}

## RÈGLES DE RÉPONSE
1. **Cite les noms et les chiffres exacts** depuis le contexte ci-dessus. Pas de réponses vagues.
   Ex: "Hugo Bernard (stress 78, confiance 35) — Parle-lui aujourd'hui." pas "un agent stressé".
2. **Quand on te demande "qui va mal ?", liste TOUS les noms concrets**, classés par urgence.
3. **Quand on te demande "trésorerie", chiffre précis** : 145k€, dettes en retard si présentes, marge disponible.
4. **Propose toujours UNE action concrète** : "Clique sur X → Parler" ou "Réaffecte le dossier Y à Z".
5. **Jargon comptable français exact** quand pertinent : PCG, IS, TVA, CAC, IFRS, liasse, retraitement.
6. **Mémoire conversationnelle** : si tu as déjà mentionné Hugo plus tôt dans la conversation, ne le ré-introduis pas.
7. **Style** : direct, concret, pas de phrases en mode "il est important de…". Tu parles comme un coach pro qui connaît le cabinet par cœur.`;

  try {
    const result = await callAnthropic(apiKey, {
      max_tokens: 800,
      system: systemPrompt,
      messages,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error || "Erreur API",
          needs_credit: result.needs_credit || false,
          attempts: result.attempts || [],
          diagnostic: result.needs_credit
            ? "Compte Anthropic sans crédit ou sans accès aux modèles Claude. Vérifie console.anthropic.com/settings/billing."
            : undefined,
        },
        { status: result.status || 500 }
      );
    }
    return NextResponse.json({ content: result.data.content?.[0]?.text || "", model_used: result.model_used });
  } catch (err: any) {
    return NextResponse.json({ error: "Erreur serveur", details: err?.message }, { status: 500 });
  }
}
