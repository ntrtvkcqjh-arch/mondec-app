import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/api-key";
import { callAnthropic } from "@/lib/anthropic-helper";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!apiKey) return NextResponse.json({ error: "Clé API manquante" }, { status: 401 });

  const { theme, titre_slot, type_slot, player_level, hour, day, agent_context } = await req.json();

  const difficulteLabel = player_level <= 2 ? "Niveau 1 (débutant)" :
    player_level <= 4 ? "Niveau 2 (intermédiaire)" :
    player_level <= 6 ? "Niveau 3 (avancé)" :
    player_level <= 8 ? "Niveau 4 (expert junior)" : "Niveau 5 (expert DEC)";

  const typeLabel: Record<string, string> = {
    briefing: "briefing matinal d'équipe — synthèse stratégique",
    cas_pratique: "cas pratique technique pur DEC",
    rdv_client: "RDV client — arbitrage technique et relationnel",
    mediation: "médiation managériale d'un conflit interne — déontologie + RH",
    validation: "validation technique d'un document préparé par un collaborateur",
    debrief: "debrief de fin de journée — synthèse opérationnelle et priorisation",
  };

  const systemPrompt = `Tu es un formateur DEC senior qui prépare un cas pratique terrain pour un expert-comptable en formation.

CONTEXTE PRÉCIS DU SLOT AGENDA :
- Créneau : "${titre_slot || theme}"
- Type d'exercice : ${typeLabel[type_slot] || "cas pratique technique"}
- Thème détaillé : ${theme}
- Niveau du joueur : ${difficulteLabel} (XP level ${player_level}/10)
- Heure simulée : ${hour}h, Jour ${day} de la simulation
${agent_context ? `- Agent associé : ${agent_context.nom} (${agent_context.role}, filière ${agent_context.filiere}). Tu peux le mentionner.` : ""}

⚠️ RÈGLE ABSOLUE : le cas pratique généré doit OBLIGATOIREMENT porter sur le thème détaillé ci-dessus.
NE DÉVIE PAS du sujet. Si le slot dit "Acompte IS", génère un cas sur l'acompte IS, pas autre chose.
Si le slot dit "Médiation conflit", génère un cas de gestion RH/conflit, pas un cas technique.

RÈGLES TECHNIQUES :
1. Cas RÉALISTE (cabinet français, PME/ETI)
2. Adapter difficulté : niveau 1 = simple ; niveau 5 = IFRS, fusion, consolidation
3. Donner des chiffres concrets, dates, références (PCG, CRC, IS, TVA, art. CGI)
4. Pour briefing/debrief/médiation : la question peut être qualitative (méthodologie, choix)
5. Pour cas_pratique/rdv_client/validation : la question doit avoir un calcul ou une décision technique précise
6. Ne PAS donner la réponse — juste l'énoncé

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
