-- ============================================================
-- SCHEMA SUPABASE — CABINET DEC
-- ============================================================
-- Exécute ce script dans l'éditeur SQL de Supabase
-- https://supabase.com/dashboard → SQL Editor → New query

-- Table : progression du joueur
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  legitimite INTEGER DEFAULT 72,
  tresorerie INTEGER DEFAULT 145000,
  reputation INTEGER DEFAULT 68,
  stress_global INTEGER DEFAULT 61,
  points_action INTEGER DEFAULT 3,
  points_action_max INTEGER DEFAULT 3,
  date_simulation TEXT DEFAULT '14 mai 2026',
  mood_global TEXT DEFAULT 'Sous Pression',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table : état des agents (persistant entre sessions)
CREATE TABLE IF NOT EXISTS agents_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  nom TEXT,
  initiales TEXT,
  avatar_color TEXT,
  statut TEXT DEFAULT 'En ligne',
  role TEXT,
  filiere TEXT,
  niveau TEXT,
  trait_dominant TEXT,
  competence_technique INTEGER,
  emotion TEXT DEFAULT 'Stable',
  stress INTEGER DEFAULT 50,
  fatigue INTEGER DEFAULT 50,
  confiance_joueur INTEGER DEFAULT 50,
  respect INTEGER DEFAULT 50,
  peur INTEGER DEFAULT 20,
  loyaute INTEGER DEFAULT 60,
  arc_actuel TEXT DEFAULT 'Apprentissage',
  secret TEXT,
  dossiers_actifs TEXT[],
  UNIQUE(user_id, agent_id)
);

-- Table : messages (inbox)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  niveau TEXT,
  type TEXT,
  phase TEXT,
  sujet TEXT,
  contenu TEXT,
  delai_reponse_heures INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  lu BOOLEAN DEFAULT false,
  repondu BOOLEAN DEFAULT false,
  reponse_joueur TEXT,
  UNIQUE(user_id, message_id)
);

-- Table : historique des conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  role TEXT CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table : résultats QCM DEC
CREATE TABLE IF NOT EXISTS qcm_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date_qcm DATE DEFAULT CURRENT_DATE,
  score INTEGER,
  duree_seconds INTEGER,
  theme TEXT,
  jury TEXT[],
  reponses JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table : événements / dilemmes résolus
CREATE TABLE IF NOT EXISTS events_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT,
  event_id TEXT,
  choix TEXT,
  effets JSONB,
  consequence_differee TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- POLITIQUES RLS (Row Level Security) — OBLIGATOIRE
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE qcm_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE events_history ENABLE ROW LEVEL SECURITY;

-- Politique : chaque utilisateur ne voit que SES données
CREATE POLICY "Users can only access their own profiles"
  ON profiles FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own agents"
  ON agents_state FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own messages"
  ON messages FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own conversations"
  ON conversations FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own qcm"
  ON qcm_results FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own events"
  ON events_history FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- INDEX pour performance
-- ============================================================
CREATE INDEX idx_agents_user ON agents_state(user_id);
CREATE INDEX idx_messages_user ON messages(user_id);
CREATE INDEX idx_conversations_user_agent ON conversations(user_id, agent_id);
CREATE INDEX idx_qcm_user ON qcm_results(user_id);
