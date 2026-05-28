import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key manquante" }, { status: 500 });

  const { case_study, player_response, player_level } = await req.json();

  const systemPrompt = `Tu es un correcteur DEC senior.

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
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: "Corrige cette réponse maintenant." }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `API ${response.status}`, details: err }, { status: 500 });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "Parse error", raw: text }, { status: 500 });

    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (err: any) {
    return NextResponse.json({ error: "Erreur serveur", details: err?.message }, { status: 500 });
  }
}
