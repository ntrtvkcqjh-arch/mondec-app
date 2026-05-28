import { NextRequest } from "next/server";

/**
 * Résout la clé API Anthropic à utiliser pour une requête.
 * Priorité :
 * 1. Header X-User-API-Key (clé fournie par l'utilisateur, stockée en localStorage)
 * 2. Variable d'environnement ANTHROPIC_API_KEY (config Vercel)
 */
export function getApiKey(req: NextRequest): string | null {
  const userKey = req.headers.get("X-User-API-Key");
  if (userKey && userKey.startsWith("sk-ant-") && userKey.length > 30) {
    return userKey;
  }
  return process.env.ANTHROPIC_API_KEY || null;
}
