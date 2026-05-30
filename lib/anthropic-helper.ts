/**
 * Helper serveur pour appeler l'API Anthropic en essayant plusieurs modèles
 * en cascade. Si un modèle renvoie 404 (non accessible) on essaye le suivant.
 * Si 401/403 (clé invalide) ou 400 "credit balance is too low" → on arrête.
 *
 * IMPORTANT : ordre = du plus récent au plus ancien, pour que les nouveaux
 * comptes (qui n'ont accès qu'aux modèles récents) trouvent immédiatement
 * un modèle compatible. claude-3-haiku-20240307 est retiré pour les nouveaux
 * comptes, on le garde en dernier secours pour les anciens.
 */

const MODEL_CASCADE = [
  "claude-haiku-4-5",
  "claude-haiku-4-5-20251001",
  "claude-3-5-haiku-latest",
  "claude-3-5-haiku-20241022",
  "claude-sonnet-4-5",
  "claude-3-5-sonnet-20241022",
  "claude-3-haiku-20240307",
];

export interface AnthropicResult {
  ok: boolean;
  data?: any;
  status?: number;
  error?: string;
  model_used?: string;
  needs_credit?: boolean;
  attempts?: { model: string; status: number; message: string }[];
}

function isCreditError(msg: string, status: number): boolean {
  const low = (msg || "").toLowerCase();
  return (
    status === 429 ||
    low.includes("credit balance") ||
    low.includes("insufficient") ||
    low.includes("quota")
  );
}

export async function callAnthropic(
  apiKey: string,
  payload: { max_tokens: number; system?: string; messages: any[] }
): Promise<AnthropicResult> {
  const attempts: { model: string; status: number; message: string }[] = [];
  let lastError = "Aucun modèle accessible";
  let lastStatus = 0;

  for (const model of MODEL_CASCADE) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ ...payload, model }),
      });

      if (r.ok) {
        const data = await r.json();
        return { ok: true, data, model_used: model, attempts };
      }

      const errText = await r.text();
      let msg = errText.slice(0, 300);
      try {
        const j = JSON.parse(errText);
        if (j.error?.message) msg = j.error.message;
      } catch {}
      attempts.push({ model, status: r.status, message: msg });
      lastError = msg;
      lastStatus = r.status;

      // 401/403 = problème de clé → arrêt immédiat
      if (r.status === 401 || r.status === 403) {
        return { ok: false, status: r.status, error: msg, attempts };
      }
      // Erreur de crédit explicite → arrêt immédiat
      if (isCreditError(msg, r.status)) {
        return { ok: false, status: r.status, error: msg, needs_credit: true, attempts };
      }
      // 404/400 (modèle indisponible) → on essaye le suivant
    } catch (e: any) {
      attempts.push({ model, status: 0, message: e?.message || "network error" });
      lastError = e?.message || "Erreur réseau";
      lastStatus = 0;
    }
  }

  // Tous les modèles ont échoué — on n'a vu QUE des 404 = compte sans accès à aucun modèle
  // (peut être : sans crédit, ou clé restreinte sur Workspaces vides)
  const all404 = attempts.length > 0 && attempts.every((a) => a.status === 404);
  return {
    ok: false,
    status: lastStatus,
    error: lastError,
    needs_credit: all404,
    attempts,
  };
}
