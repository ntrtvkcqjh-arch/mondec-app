import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/api-key";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TEST_MODELS = [
  "claude-haiku-4-5",
  "claude-haiku-4-5-20251001",
  "claude-3-5-haiku-20241022",
  "claude-3-haiku-20240307",
  "claude-3-5-sonnet-20241022",
  "claude-sonnet-4-5",
  "claude-3-5-haiku-latest",
];

function noCacheHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
  };
}

export async function GET(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, reason: "Clé API manquante — clique sur ⚙ pour la configurer", needs_key: true },
      { headers: noCacheHeaders() }
    );
  }

  const attempts: { model: string; status: number; message: string }[] = [];
  let firstAuthError: { status: number; message: string } | null = null;

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
        return NextResponse.json(
          { ok: true, status: 200, model_used: model, attempts_count: attempts.length + 1 },
          { headers: noCacheHeaders() }
        );
      }

      const errText = await r.text();
      let msg = errText.slice(0, 300);
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.message) msg = errJson.error.message;
      } catch {}

      attempts.push({ model, status: r.status, message: msg });

      // 401/403 = problème de clé/permission, inutile de continuer
      if (r.status === 401 || r.status === 403) {
        if (!firstAuthError) firstAuthError = { status: r.status, message: msg };
        break;
      }
    } catch (e: any) {
      attempts.push({ model, status: 0, message: e?.message || "network error" });
    }
  }

  if (firstAuthError) {
    return NextResponse.json(
      {
        ok: false,
        status: firstAuthError.status,
        reason: firstAuthError.message,
        attempts,
        diagnostic: firstAuthError.status === 401
          ? "Clé API invalide ou révoquée"
          : "Clé API sans accès aux modèles Claude (vérifier Workspaces sur console.anthropic.com)",
      },
      { headers: noCacheHeaders() }
    );
  }

  const last = attempts[attempts.length - 1] || { model: "?", status: 0, message: "Aucune réponse" };

  // Si TOUS les essais sont 404 → c'est un compte sans crédit (cas le plus fréquent)
  const all404 = attempts.length > 0 && attempts.every(a => a.status === 404);

  let diagnostic = "Aucun modèle accessible — voir détails par essai ci-dessous";
  let needs_credit = false;

  if (all404) {
    diagnostic = "Compte Anthropic sans crédit — l'API renvoie 404 sur tous les modèles. Charge ton compte avec 5$ minimum sur console.anthropic.com/settings/billing puis re-teste.";
    needs_credit = true;
  } else if (last.status === 429) {
    diagnostic = "Quota dépassé ou crédit épuisé — recharger sur console.anthropic.com/settings/billing";
    needs_credit = true;
  } else if (last.status === 404) {
    diagnostic = "Aucun modèle Claude n'est accessible avec cette clé — probablement compte sans crédit";
    needs_credit = true;
  }

  return NextResponse.json(
    {
      ok: false,
      status: last.status,
      reason: last.message,
      attempts,
      diagnostic,
      needs_credit,
    },
    { headers: noCacheHeaders() }
  );
}
