# PHDDEC × Slack Bridge

Pont serveur minimal qui permet à PHDDEC de **recevoir** tes réponses Slack.

## Déploiement en 5 minutes

### 1. Crée un compte Vercel
- Va sur [vercel.com/signup](https://vercel.com/signup) → "Continue with GitHub" (gratuit)

### 2. Déploie ce dossier
- Dans Vercel, clique **"Add New… → Project"**
- Importe ton repo `phddec-app` ou crée un nouveau repo séparé avec juste ce dossier
- **Root Directory** → `slack-bridge`
- **Framework Preset** → "Other"
- Clique **Deploy**

### 3. Active Vercel KV (stockage gratuit)
- Dans ton projet Vercel → onglet **Storage** → **Create Database** → **KV**
- Choisis un nom (ex: `phddec-replies`) → **Create**
- Clique **Connect Project** → sélectionne ce projet → **Connect**
- Les variables `KV_REST_API_URL` et `KV_REST_API_TOKEN` sont injectées automatiquement
- Redéploie (Settings → Deployments → Redeploy le dernier)

### 4. Récupère ton URL Vercel
- Onglet **Domains** → copie l'URL `https://ton-projet.vercel.app`

### 5. Configure Slack pour pointer vers ce pont
- Va sur [api.slack.com/apps](https://api.slack.com/apps) → ton app `PHDDEC CORE`
- **Event Subscriptions** → toggle **Enable Events** ON
- **Request URL** → colle `https://ton-projet.vercel.app/api/events`
  - Slack envoie un challenge → ce serveur répond automatiquement → ✓ vert
- **Subscribe to bot events** → ajoute :
  - `message.channels` (messages dans canaux publics)
  - `message.groups` (messages dans canaux privés)
  - `message.im` (DM)
- **Save Changes**
- **OAuth & Permissions** → ajoute scopes :
  - `channels:history`
  - `groups:history`
  - `im:history`
- **Install to Workspace** → autorise

### 6. Branche PHDDEC sur le pont
- Va sur ta page PHDDEC `/app/notifications-slack`
- Section "Bot Slack avancé" → colle ton URL Vercel dans **URL backend (events)**
  - Format : `https://ton-projet.vercel.app/api` (sans `/events` à la fin)
- Active le toggle **"Poller les réponses"**

## Comment ça marche

```
[Tu réponds dans Slack]
        ↓
[Slack envoie l'event à /api/events]
        ↓
[Vercel stocke dans KV]
        ↓
[PHDDEC poll /api/replies toutes les 30s]
        ↓
[PHDDEC attribue la réponse à l'agent en attente]
```

## Endpoints

- `POST /api/events` — reçoit les événements Slack (à configurer comme Request URL Slack)
- `GET /api/replies?since=<timestamp>` — retourne les réponses depuis un timestamp donné

## Sécurité

- Les données restent 24h max dans KV puis sont auto-supprimées (TTL)
- CORS ouvert (`*`) pour que ton navigateur puisse poller — c'est OK car aucune donnée sensible n'est exposée et tu peux restreindre à ton domaine PHDDEC si tu veux

## Coûts

- Vercel : free tier (100GB bande passante/mois, largement suffisant)
- Vercel KV : free tier (30k commandes/mois, plus que suffisant pour des replies Slack)
- Total : **0 €** tant que tu restes dans les limites gratuites

## Dépannage

**Slack dit "Your URL didn't respond with the value of the challenge parameter"**
→ Le déploiement n'est pas fini ou KV pas connecté. Refais le step 3.

**Les replies n'arrivent pas dans PHDDEC**
→ Ouvre `https://ton-projet.vercel.app/api/replies` directement dans ton navigateur. Tu devrais voir `{"replies":[…]}`. Si vide après un message dans Slack, vérifie les logs Vercel (Deployments → Logs).
