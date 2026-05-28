"use client";

const KEY_STORAGE = "user_anthropic_key";

export function getUserApiKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setUserApiKey(key: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY_STORAGE, key.trim());
  } catch {}
}

export function clearUserApiKey() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY_STORAGE);
  } catch {}
}

export function hasUserApiKey(): boolean {
  const k = getUserApiKey();
  return !!(k && k.startsWith("sk-ant-") && k.length > 30);
}

/**
 * Wrapper de fetch qui injecte automatiquement la clé API utilisateur
 * dans le header X-User-API-Key si elle est définie en localStorage.
 */
export async function apiFetch(url: string, options: RequestInit = {}) {
  const userKey = getUserApiKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (userKey) headers["X-User-API-Key"] = userKey;
  return fetch(url, { ...options, headers });
}
