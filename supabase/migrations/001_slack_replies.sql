-- PHDDEC × Slack bridge — stockage des réponses Slack
-- À exécuter dans Supabase Studio → SQL Editor

CREATE TABLE IF NOT EXISTS public.slack_replies (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  text        TEXT NOT NULL,
  channel     TEXT,
  ts          TEXT,
  thread_ts   TEXT,
  at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slack_replies_at ON public.slack_replies(at DESC);

-- Auto-cleanup: garde 7 jours d'historique max
-- (les Edge Functions n'ont pas accès à pg_cron par défaut, donc cleanup manuel possible)
-- DELETE FROM slack_replies WHERE at < NOW() - INTERVAL '7 days';

-- Pas de RLS — les Edge Functions utilisent le SERVICE_ROLE_KEY qui bypass RLS
-- (alternative : ajouter RLS et policies si tu veux limiter l'accès)
