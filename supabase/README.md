# PHDDEC × Slack Bridge — Supabase Edition

## 🚨 Cause de "Your URL didn't respond with the value of the challenge parameter"

Par défaut, **Supabase Edge Functions exigent un JWT** sur toutes les requêtes. Slack n'en envoie pas → Supabase renvoie 401 → Slack ne reçoit jamais le challenge.

**Solution : déployer avec `--no-verify-jwt`.**

---

## Setup complet (5 min)

### 1. Crée la table

Supabase Studio → **SQL Editor** → colle ceci → **Run** :

```sql
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
```

### 2. Installe & connecte le CLI Supabase

```bash
brew install supabase/tap/supabase    # ou : npm install -g supabase
cd phddec-app/supabase                 # depuis le repo cloné
supabase login                          # ouvre le navigateur
supabase link --project-ref TON_REF    # le REF = 20 char dans l'URL Supabase
```

> **Où trouver `TON_REF`** : Supabase Studio → Settings → General → "Reference ID".

### 3. Déploie les fonctions AVEC `--no-verify-jwt`

```bash
supabase functions deploy events --no-verify-jwt
supabase functions deploy replies --no-verify-jwt
```

⚠️ **Le flag `--no-verify-jwt` est ESSENTIEL.** Sans ça, Slack se prend un 401 et le challenge échoue.

### 4. Tes URLs sont maintenant

- **Events (Slack → toi)** : `https://TON_REF.supabase.co/functions/v1/events`
- **Replies (PHDDEC → toi)** : `https://TON_REF.supabase.co/functions/v1/replies`

### 5. Test rapide (sans Slack)

```bash
curl -X POST 'https://TON_REF.supabase.co/functions/v1/events' \
  -H 'Content-Type: application/json' \
  -d '{"type":"url_verification","challenge":"test123"}'
```

✅ Tu dois recevoir : `{"challenge":"test123"}`

❌ Si tu vois `{"code":401,...}` → JWT activé, redéploie avec `--no-verify-jwt`
❌ Si tu vois `404` → fonction pas déployée, vérifie `supabase functions list`
❌ Si tu vois `500` → bug code, lis les logs : `supabase functions logs events`

### 6. Configure Slack

- [api.slack.com/apps](https://api.slack.com/apps) → ton app `PHDDEC CORE`
- **Event Subscriptions** → toggle **Enable Events ON**
- **Request URL** → colle :
  ```
  https://TON_REF.supabase.co/functions/v1/events
  ```
- ✅ Le badge **"Verified"** s'affiche immédiatement
- **Subscribe to bot events** → ajoute :
  - `message.channels` (canaux publics)
  - `message.groups` (canaux privés)
  - `message.im` (DMs)
- **Save Changes**

- Menu de gauche → **OAuth & Permissions** → **Bot Token Scopes** → ajoute :
  - `channels:history`
  - `groups:history`
  - `im:history`

- En haut → **Reinstall to Workspace** → autorise

### 7. Connecte PHDDEC

Sur `/app/notifications-slack` → section **"Recevoir tes réponses Slack"** :

- **URL du pont** : `https://TON_REF.supabase.co/functions/v1`
  - ⚠️ Sans `/replies` ni `/events` à la fin — PHDDEC ajoute `/replies` tout seul.
- Clique **"Démarrer le polling (30s)"**

## Vérification end-to-end

1. Envoie un message test depuis PHDDEC (section "Tester un message agent")
2. Le message arrive dans Slack ✓
3. Réponds dans Slack : "OK"
4. Supabase Studio → **Edge Functions** → `events` → **Logs** → tu vois `POST → 200`
5. Supabase Studio → **Table Editor** → `slack_replies` → ta réponse y est
6. Attends max 30s OU clique "Poll maintenant" dans PHDDEC
7. Compteur "Réponses reçues" passe à 1 ✓

## Coûts

- Free tier Supabase : 500 MB DB · 50k requêtes Edge Functions/mois
- **Total : 0 €** pour usage personnel

## Variables d'environnement

Les Edge Functions Supabase ont automatiquement accès à :
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

Aucune config supplémentaire requise.
