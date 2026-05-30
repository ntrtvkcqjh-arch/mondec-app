import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/api-key";
import { callAnthropic } from "@/lib/anthropic-helper";
import { getToneInstructions } from "@/lib/tone-helper";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!apiKey) return NextResponse.json({ error: "Clé API manquante" }, { status: 401 });

  const { case_study, player_response, player_level } = await req.json();

  const tone = getToneInstructions(player_level || 1, { role: "examinateur" });
  const systemPrompt = `${tone.systemBlock}

Tu es un correcteur DEC senior.

CAS PRATIQUE PROPOSÉ AU JOUEUR :
- Titre : ${case_study?.titre}
- Client : ${case_study?.client}
- Énoncé : ${case_study?.enonce}
- Question : ${case_study?.question}
- Critères d'évaluation : ${(case_study?.criteres || []).join(", ")}

RÉPONSE DU JOUEUR (niveau ${player_level}/10) :
"${player_response}"

CONSIGNE :
Corrige cette réponse de manière constructive. Commence par une analogie vivante, puis donne le score et le feedback technique.

FORMAT JSON OBLIGATOIRE :
{
  "score": <0-100>,
  "verdict": "Excellent|Bien|Satisfaisant|À retravailler|Insuffisant",
  "analogie": "<1 phrase analogie vivante>",
  "correction": "<2-3 phrases — la réponse technique correcte>",
  "points_forts": ["<1-2 points concrets>"],
  "axes_amelioration": ["<1-2 suggestions actionnables>"],
  "xp_gagne": <entier 0 à xp_potentiel selon qualité>,
  "impact_legitimite": <-3 à +5>,
  "impact_stress": <-5 à +3>
}`;

  try {
    const result = await callAnthropic(apiKey, {
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: "Corrige cette réponse maintenant." }],
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
