/**
 * Helper serveur pour appeler l'API Anthropic en essayant plusieurs modèles
 * en cascade. Si un modèle renvoie 404 (non accessible), on essaye le suivant.
 * Si 401/403 (clé invalide/interdite) on arrête immédiatement.
 */

const MODEL_CASCADE = [
  "claude-3-haiku-20240307",
  "claude-3-5-haiku-20241022",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-latest",
];

export interface AnthropicResult {
  ok: boolean;
  data?: any;
  status?: number;
  error?: string;
  model_used?: string;
}

export async function callAnthropic(
  apiKey: string,
  payload: { max_tokens: number; system?: string; messages: any[] }
): Promise<AnthropicResult> {
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
        return { ok: true, data, model_used: model };
      }

      const errText = await r.text();
      let msg = errText.slice(0, 200);
      try {
        const j = JSON.parse(errText);
        if (j.error?.message) msg = j.error.message;
      } catch {}
      lastError = msg;
      lastStatus = r.status;

      // 401/403 = problème de clé, inutile de continuer
      if (r.status === 401 || r.status === 403) {
        return { ok: false, status: r.status, error: msg };
      }
      // 404/400 → on essaye le modèle suivant
    } catch (e: any) {
      lastError = e?.message || "Erreur réseau";
      lastStatus = 0;
    }
  }

  return { ok: false, status: lastStatus, error: lastError };
}
