import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/api-key";

export async function POST(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!apiKey) return NextResponse.json({ error: "Clé API manquante" }, { status: 401 });

  const { player_message, agent_original_message, agent_response, agent_context } = await req.json();

  const systemPrompt = `Tu es un jury d'évaluation DEC (Diplôme d'Expertise Comptable).
Tu notes la réponse d'un expert-comptable en formation à un message de son collaborateur.

CONTEXTE AGENT :
- ${agent_context?.nom} (${agent_context?.role}, ${agent_context?.filiere})
- Niveau : ${agent_context?.niveau}
- Message original de l'agent : "${agent_original_message}"
- Réponse du joueur : "${player_message}"

CRITÈRES D'ÉVALUATION :
- PRÉCISION (30pts) : exactitude technique comptable/fiscale/juridique. Références PCG, CRC, IS, TVA, IFRS correctes.
- RÉDACTION (20pts) : ton professionnel EC, clarté, concision, formulation adaptée au niveau hiérarchique.
- DÉONTOLOGIE (20pts) : respect du secret professionnel, indépendance, normes CNCC/OEC.
- CONTEXTE (15pts) : compréhension de l'état émotionnel de l'agent, de son niveau de stress, de la situation.
- OPÉRATIONNEL (15pts) : décision claire, action concrète, délai précisé si nécessaire.

CONSIGNE OBLIGATOIRE pour le champ "feedback" :
- Commence TOUJOURS par une analogie vivante (ex: "Tu as répondu comme un pilote de chasse qui...", "C'est comme un chef de cuisine qui...")
- Puis 1-2 phrases d'analyse précise
- Maximum 3 phrases au total
- Sois direct, pas condescendant

Réponds UNIQUEMENT en JSON valide :
{
  "score_global": <0-100>,
  "breakdown": {
    "precision": <0-30>,
    "redaction": <0-20>,
    "deontologie": <0-20>,
    "contexte": <0-15>,
    "operationnel": <0-15>
  },
  "feedback": "<analogie + analyse en 3 phrases max>",
  "points_forts": ["<max 2 éléments concrets>"],
  "axes_amelioration": ["<1-2 suggestions précises et actionnables>"],
  "impact": {
    "legitimite_delta": <entier entre -5 et +5>,
    "confiance_agent_delta": <entier entre -5 et +5>
  }
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
        model: "claude-3-5-haiku-latest",
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: "user", content: "Évalue cette réponse maintenant." }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "Parse error" }, { status: 500 });

    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
