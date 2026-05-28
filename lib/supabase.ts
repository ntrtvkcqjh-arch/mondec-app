import { createClient } from "@supabase/supabase-js";

const FALLBACK_URL = "https://vgqpqtrrpwftbyeljspi.supabase.co";
const FALLBACK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZncXBxdHJycHdmdGJ5ZWxqc3BpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NzkwMDAsImV4cCI6MjA5NTU1NTAwMH0.QKVVj35TMDQvmJilKo_3EyIqc6HoAXcpvLoEHXyto5w";

function isValidHttpsUrl(u: string | undefined | null): boolean {
  if (!u || typeof u !== "string") return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" && parsed.host.length > 0;
  } catch {
    return false;
  }
}

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Si l'env var est invalide ou vide, on utilise le fallback hardcodé (évite le crash au build)
const supabaseUrl = isValidHttpsUrl(envUrl) ? (envUrl as string) : FALLBACK_URL;
const supabaseAnonKey = envKey && envKey.length > 20 ? envKey : FALLBACK_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
}

export async function signOut() {
  await supabase.auth.signOut();
}
