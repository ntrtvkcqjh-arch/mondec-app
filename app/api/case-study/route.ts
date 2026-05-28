import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/api-key";
import { callAnthropic } from "@/lib/anthropic-helper";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!apiKey) return NextResponse.json({ error: "Clé API manquante" }, { status: 401 });

  const { theme, player_level, hour, day, agent_context } = await req.json();

  const difficulteLabel = player_level <= 2 ? "Niveau 1 (débutant)" :
    player_level <= 4 ? "Niveau 2 (intermédiaire)" :
    player_level <= 6 ? "Niveau 3 (avancé)" :
    player_level <= 8 ? "Niveau 4 (expert junior)" : "Niveau 5 (expert DEC)";

  const systemPrompt = `Tu es un formateur DEC senior qui prépare un cas pratique terrain pour un expert-comptable en formation.

CONTEXTE :
- Thème : ${theme}
- Niveau du joueur : ${difficulteLabel} (XP level ${player_level}/10)
- Heure simulée : ${hour}h
- Jour ${day} de la simulation
${agent_context ? `- L'agent associé est ${agent_context.nom} (${agent_context.role}, filière ${agent_context.filiere})` : ""}

RÈGLES :
1. Le cas pratique doit être RÉALISTE (cabinet français, contexte PME ou ETI)
2. Adapter la difficulté : niveau 1 = saisie simple ; niveau 5 = consolidation, fusion, IFRS complexes
3. Donner des chiffres concrets, dates, références techniques (PCG, CRC, IS, TVA, etc.)
4. Énoncer un PROBLÈME précis avec une décision/calcul attendu
5. Ne PAS donner la réponse — juste l'énoncé

FORMAT JSON OBLIGATOIRE :
{
  "titre": "<5-8 mots, titre clair>",
  "client": "<nom fictif du client>",
  "contexte": "<2-3 phrases, situation du client>",
  "enonce": "<énoncé détaillé du problème, 4-8 phrases, chiffres précis>",
  "question": "<question explicite à laquelle le joueur doit répondre>",
  "xp_potentiel": <nombre 10-50 selon difficulté>,
  "criteres": ["<3-4 critères d'évaluation>"]
}`;

  try {
    const result = await callAnthropic(apiKey, {
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: "user", content: `Génère un cas pratique sur "${theme}" maintenant.` }],
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    const text = result.data.content?.[0]?.text || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "Parse error", raw: text }, { status: 500 });

    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (err: any) {
    return NextResponse.json({ error: "Erreur serveur", details: err?.message }, { status: 500 });
  }
}
