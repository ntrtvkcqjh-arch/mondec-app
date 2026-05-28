import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, agent_context } = body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Clé API Claude non configurée" },
        { status: 500 }
      );
    }

    const systemPrompt = `
Tu es le moteur narratif d'un cabinet d'expertise comptable française.
Le joueur est l'expert-comptable associé. Tu joues le rôle des agents salariés.

CONTEXTE DE L'AGENT :
- Nom : ${agent_context?.nom || "Agent"}
- Rôle : ${agent_context?.role || "Collaborateur"}
- Filière : ${agent_context?.filiere || "Comptable"}
- Niveau : ${agent_context?.niveau || "Collaborateur"}
- Émotion : ${agent_context?.emotion || "Stable"}
- Stress : ${agent_context?.stress || 50}/100
- Fatigue : ${agent_context?.fatigue || 50}/100
- Confiance envers le joueur : ${agent_context?.confiance_joueur || 50}/100

RÈGLES :
1. Réponds comme l'agent, pas comme une IA.
2. Sois court (2-3 paragraphes max).
3. Utilise le jargon comptable français (PCG, TVA, IS, liasse fiscale, etc.).
4. Sois autonome : annonce ce que tu as déjà fait ou vas faire.
5. Sois imparfait si stress>70 ou fatigue>70.
6. Référence la date simulée (14 mai 2026) et les échéances fiscales.
7. Si le joueur envoie une ébauche, propose 3 versions corrigées : Standard, Ferme, Pédagogue.
`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error?.message || "Erreur API Claude" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ content: data.content[0].text });
  } catch (error) {
    console.error("Erreur API chat:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
