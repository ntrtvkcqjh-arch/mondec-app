import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/api-key";

export const dynamic = "force-dynamic";

const TEST_MODELS = [
  "claude-3-haiku-20240307",
  "claude-3-5-haiku-20241022",
  "claude-3-5-haiku-latest",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-latest",
];

export async function GET(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      reason: "Clé API manquante — clique sur ⚙ pour la configurer",
      needs_key: true,
    });
  }

  // On essaye plusieurs modèles. Si au moins un marche, l'API marche.
  const attempts: { model: string; status: number; message: string }[] = [];

  for (const model of TEST_MODELS) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: [{ role: "user", content: "ping" }],
        }),
      });

      if (r.ok) {
        return NextResponse.json({ ok: true, status: 200, model_used: model });
      }

      // Récupérer le message d'erreur complet
      const errText = await r.text();
      let msg = errText.slice(0, 300);
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.message) msg = errJson.error.message;
      } catch {}

      attempts.push({ model, status: r.status, message: msg });

      // Si c'est un 401 (clé invalide) ou 403 (interdit), inutile de tester d'autres modèles
      if (r.status === 401 || r.status === 403) {
        return NextResponse.json({
          ok: false,
          status: r.status,
          reason: msg,
          attempts,
        });
      }
    } catch (e: any) {
      attempts.push({ model, status: 0, message: e?.message || "network error" });
    }
  }

  // Aucun modèle n'a marché — on renvoie tous les essais
  const lastAttempt = attempts[attempts.length - 1] || { model: "?", status: 0, message: "Aucune réponse" };
  return NextResponse.json({
    ok: false,
    status: lastAttempt.status,
    reason: `Aucun modèle Claude accessible. Dernière erreur (${lastAttempt.status}): ${lastAttempt.message}`,
    attempts,
  });
}
