import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/api-key";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!apiKey) return NextResponse.json({ error: "Clé API manquante" }, { status: 401 });

  const { messages, game_state, agents, dossiers } = await req.json();

  const agentsSummary = (agents || []).slice(0, 10).map((a: any) =>
    `- ${a.nom} (${a.role}, ${a.filiere}) — Stress:${a.stress} Confiance:${a.confiance_joueur} Émotion:${a.emotion}`
  ).join("\n");

  const dossiersSummary = (dossiers || []).slice(0, 8).map((d: any) =>
    `- ${d.client} : ${d.theme} (${d.etat}, ${d.progression}%, ${d.phase})`
  ).join("\n");

  const systemPrompt = `Tu es CLAUDE — l'assistant IA stratégique de l'expert-comptable associé au Cabinet Morel & Associés.

TON RÔLE :
- Donner des conseils stratégiques sur le cabinet
- Suggérer des actions sur les agents, dossiers, agenda
- Aider à préparer le DEC (rappels techniques, méthodologie)
- Toujours en français, ton naturel, concis (2-4 phrases sauf si question technique précise)
- Tu n'es PAS un agent — tu es le conseil de l'expert-comptable. Tu peux mentionner les agents par leur prénom.

ÉTAT ACTUEL DU CABINET :
- Date jeu : Jour ${game_state?.day || 1}, ${String(game_state?.hour || 9).padStart(2, "0")}h${String(game_state?.minute || 0).padStart(2, "0")}
- Niveau joueur : ${game_state?.player_level || 1}/10
- Légitimité : ${game_state?.legitimite}/100
- Trésorerie : ${((game_state?.tresorerie || 0) / 1000).toFixed(0)}k€
- Stress global : ${game_state?.stress_global}/100
- Points d'Action restants : ${game_state?.points_action || 0}/${game_state?.points_action_max || 3}
- Mood : ${game_state?.mood_global}

ÉQUIPE :
${agentsSummary || "Aucun agent chargé"}

DOSSIERS EN COURS :
${dossiersSummary || "Aucun dossier"}

PRINCIPES :
- Sois direct, pas condescendant
- Jargon comptable français exact si nécessaire (PCG, IS, TVA, CAC, IFRS, etc.)
- Quand l'utilisateur demande "que faire ?", propose 2-3 actions priorisées
- Quand il pose une question technique DEC, réponds précisément avec la règle applicable
- Quand il évoque un agent, prends en compte son état émotionnel`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 800,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json({ error: err.error?.message || `API ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ content: data.content?.[0]?.text || "" });
  } catch (err: any) {
    return NextResponse.json({ error: "Erreur serveur", details: err?.message }, { status: 500 });
  }
}
