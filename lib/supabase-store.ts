"use client";

import { create } from "zustand";
import { supabase, getCurrentUser } from "./supabase";

export interface Agent {
  id: string;
  nom: string;
  initiales: string;
  avatar_color: string;
  statut: string;
  role: string;
  filiere: string;
  niveau: string;
  emotion: string;
  stress: number;
  fatigue: number;
  confiance_joueur: number;
  respect: number;
  peur: number;
  loyaute: number;
}

export interface Message {
  id: string;
  message_id: string;
  agent_id: string;
  niveau: string;
  type: string;
  phase: string | null;
  sujet: string;
  contenu: string;
  delai_reponse_heures: number;
  timestamp: string;
  lu: boolean;
  repondu: boolean;
  reponse_joueur: string | null;
}

export interface Dossier {
  id: string;
  client: string;
  theme: string;
  agent_id: string;
  // 5 statuts auto-calculés
  etat: "en_cours" | "surveillance" | "avance" | "cloture" | "perdu";
  progression: number;
  phase: "P1" | "P2" | "P3" | "P4" | "P5";
  echeance_heure: string;
  impact: {
    legitimite: number;
    reputation: number;
    tresorerie: number;
    stress: number;
  };
  // Enrichissements
  qualite: number;
  client_satisfait: boolean;
  signaux_alerte: string[];
  is_vip: boolean;
  recoverable_until: string | null;
  cause_perte: string | null;
  cas_traites: number;
  created_game_day?: number; // pour période de grâce + calculs progression

  // === FICHE CLIENT (Sprint 2) ===
  // Caractéristiques générales
  secteur?: string;
  secteur_categorie?: "Industrie" | "Commerce" | "Restauration" | "Services" | "Artisanat" | "Association";
  ca?: number; // chiffre d'affaires en €
  effectif?: number;
  regime_tva?: "Mensuel" | "Trimestriel" | "Annuel" | "Franchise";
  forme_juridique?: "SARL" | "SAS" | "SA" | "EURL" | "SCI" | "Association";
  anciennete_annees?: number;

  // 5 critères aléatoires (0-100)
  profil_relationnel?: number; // 0=Patient, 100=Exigeant
  complexite_comptable?: number; // 0=Simple, 100=Très complexe
  rentabilite?: number; // 0=Faible marge, 100=Très rentable
  reactivite_demandee?: number; // 0=Détendu, 100=Urgences fréquentes
  tolerance_erreurs?: number; // 0=Aucune tolérance, 100=Indulgent

  // Spécialités techniques requises (3-5)
  specialites_requises?: string[];

  // Économique
  honoraires_annuels?: number;
  satisfaction?: number; // 0-100
}

export interface NouveauProspect {
  id: string;
  client: string;
  secteur: string;
  secteur_categorie?: "Industrie" | "Commerce" | "Restauration" | "Services" | "Artisanat" | "Association";
  ca: number;
  effectif: number;
  regime_tva: "Mensuel" | "Trimestriel" | "Annuel" | "Franchise";
  forme_juridique: "SARL" | "SAS" | "SA" | "EURL" | "SCI" | "Association";
  profil_relationnel: number;
  complexite_comptable: number;
  rentabilite: number;
  reactivite_demandee: number;
  tolerance_erreurs: number;
  specialites_requises: string[];
  honoraires_annuels: number;
}

export interface ClaudeMsg {
  role: "user" | "assistant";
  content: string;
}

/** Contact mail (client, agent, ou soi) */
export interface MailContact {
  type: "client" | "agent" | "self" | "external";
  id?: string; // dossier_id pour client, agent_id pour agent
  name: string;
  email: string;
}

/** Un email du jeu — formel, avec To/CC, relances auto, impacts relation */
export interface Email {
  id: string;
  direction: "in" | "out"; // reçu ou envoyé par le joueur
  from: MailContact;
  to: MailContact[];
  cc: MailContact[];
  subject: string;
  body: string;
  date_iso: string;
  game_day: number;
  game_hour: number;
  read: boolean;
  replied: boolean;
  relance_count: number;
  parent_id?: string; // si c'est une relance ou réponse à un autre mail
  expected_cc_ids?: string[]; // ids des contacts qui auraient dû être en CC (pour scoring relation)
}

/** Un ancien collaborateur ayant quitté le cabinet (démission ou licenciement) */
export interface FormerAgent {
  id: string;
  nom: string;
  initiales: string;
  avatar_color: string;
  role: string;
  filiere: string;
  departure_game_day: number;
  departure_date_iso: string;
  motif: string; // "Licencié par le patron" | "Démission" | "Burn-out" | ...
  motif_type: "licencie" | "demission" | "burnout" | "fin_contrat";
  final_confiance: number;
  final_loyaute: number;
  dossiers_transferes_a: { dossier: string; nouvel_agent: string }[];
  duree_cabinet_jours: number;
}

/** Une correction d'examinateur DEC sur une réponse du joueur dans le chat */
export interface ChatCorrection {
  id: string;
  game_day: number;
  game_hour: number;
  game_minute: number;
  date_iso: string;
  agent_id: string;
  agent_nom: string;
  agent_role: string;
  agent_message: string;
  player_response: string;
  note_sur_20: number;
  verdict: string;
  points_forts: string[];
  points_faibles: string[];
  reponse_ideale: string;
  correction_detaillee: string;
  sources: string[];
  categorie_dec: string;
}

export interface FiscalDeadline {
  id: string;
  label: string;
  echeance_label: string;
  echeance_day: number;
  echeance_month: number;
  progression: number;
  filiere_responsable: string;
  depend_de: string | null;
  cout_retard: number;
  campagne: "IR" | "Bilan" | "Rentree" | "Prep" | "Mensuel";
}

export interface GameState {
  user_id: string | null;
  legitimite: number;
  tresorerie: number;
  reputation: number;
  stress_global: number;
  points_action: number; // @legacy : conservé pour compat, plus utilisé pour bloquer le chat
  points_action_max: number;
  // Système Temps : 8h/jour = 480 minutes. Reset à minuit (game_day rollover)
  temps_disponible_min: number;
  temps_disponible_max: number;
  heures_sup_cumul: number; // si on dépasse, on accumule le retard
  date_simulation: string;
  mood_global: string;

  // Horloge jeu — temps simulé qui avance (persistant via timestamp réel)
  game_hour: number;
  game_minute: number;
  game_day: number;
  game_start_timestamp: number; // Timestamp réel du démarrage de la simulation

  // Niveau joueur — progression XP
  player_level: number;
  player_xp: number;
  xp_to_next: number;

  // DEC Prep — engagement quotidien
  dec_streak: number;
  dec_last_day: number;
  dec_today_deonto: boolean;
  dec_today_mission: boolean;
  dec_completed_deonto_ids: string[];
  dec_completed_mission_ids: string[];
  dec_badges: string[];

  // Tasks (validation pédagogique) — persistant
  completed_tasks: string[];

  // Équipe : actions joueur → agent
  agent_cooldowns: Record<string, Record<string, number>>;
  agent_player_history: Record<string, { day: number; hour: number; event: string; impact?: string }[]>;
  team_health: number;

  // Sprint 2 : Nouveaux prospects
  prospects_pending: NouveauProspect[];
  last_prospect_day: number;
  prospects_dismissed_for_day: number; // jour où le joueur a fermé le modal sans tout traiter

  // Sprint 4 : Historique fiscal (validations déposées par obligation_id)
  fiscal_validations: Record<string, { game_day: number; date_iso: string; type: string; client: string }>;

  // Sprint 5 : Corrections du chat (examinateur DEC) — historique
  chat_corrections: ChatCorrection[];

  // Sprint 5 : Anciens collaborateurs (démissions / licenciements)
  former_agents: FormerAgent[];

  // Sprint 6 : RH — tracking des recrutements
  filled_positions: string[]; // ids des recrutements pourvus
  hired_candidates: string[]; // ids des CV embauchés

  // Sprint 7 : Système Mail (distinct de la Messagerie)
  mails: Email[];
  last_mail_check_iso: string | null; // pour générer les relances auto

  // Sprint 8 : Lien Suivi Fiscal ↔ Tâches — obligation en cours de traitement
  pending_obligation_id: string | null;
  pending_obligation_meta: { type: string; client: string } | null;

  // Sprint 9 : Mode de démarrage (zéro / prêt)
  start_mode: "zero" | "ready" | null;
  start_mode_chosen: boolean; // true une fois que la joueuse a fait son choix

  // Sprint 9 : CVs reçus dynamiquement (par cascade démission/burn-out + saisons)
  dynamic_cvs: any[]; // candidats fictifs ajoutés après le démarrage
  last_seasonal_cv_day: number;

  agents: Agent[];
  messages: Message[];
  dossiers: Dossier[];
  fiscal_deadlines: FiscalDeadline[];
  conversation_history: Record<string, { role: string; content: string }[]>;
  claude_history: ClaudeMsg[];
  isLoading: boolean;
  isAuthenticated: boolean;

  setUser: (userId: string | null) => void;
  loadGameState: () => Promise<void>;
  saveGameState: () => Promise<void>;
  setResources: (res: Partial<Pick<GameState, "legitimite" | "tresorerie" | "reputation" | "stress_global" | "points_action">>) => void;
  markMessageRead: (id: string) => Promise<void>;
  replyToMessage: (id: string, reply: string) => Promise<void>;
  spendPA: (amount: number) => boolean;
  /** Dépense X minutes du temps disponible + (optionnel) X€ de trésorerie.
   *  Si pas assez de temps → heures supplémentaires (stress équipe +20). */
  spendTime: (minutes: number, cashCost?: number) => { ok: boolean; reason?: string; overtime?: boolean };
  addConversation: (agentId: string, role: "user" | "assistant", content: string) => Promise<void>;
  loadConversations: (agentId: string) => Promise<void>;
  addNewMessage: (event: { agent_id: string; niveau: string; type: string; sujet: string; contenu: string; delai_reponse_heures: number }) => Promise<void>;

  // Horloge
  tickClock: (minutes: number) => void;
  syncClockFromTimestamp: () => void;

  // XP / Niveau
  addXP: (amount: number) => void;

  // Dossiers
  setDossiers: (d: Dossier[]) => void;
  winDossier: (id: string) => void;
  loseDossier: (id: string) => void;
  advanceDossier: (id: string, amount: number) => void;
  /** Réaffecte un dossier d'un agent à un autre + cascade d'événements internes. */
  reassignDossier: (dossierId: string, newAgentId: string, motif?: string) => { ok: boolean; reason?: string };

  // Claude
  addClaudeMessage: (msg: ClaudeMsg) => void;
  clearClaude: () => void;

  // Corrélations cross-systèmes
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  recomputeMood: () => void;
  applyOutcome: (agentId: string, score: number) => void;

  // Calendrier fiscal
  advanceDeadline: (id: string, amount: number) => void;
  autoAdvanceDeadlines: () => void;
  checkOverdueDeadlines: () => void;

  // Dossiers : enrichissements
  recomputeAllDossierStatus: () => void;
  attemptRecoverDossier: (id: string) => boolean;
  toggleVIP: (id: string) => void;

  // DEC Prep
  markDeontoCompleted: (questionIds: string[]) => void;
  markMissionCompleted: (missionId: string) => void;
  addBadge: (badge: string) => void;
  checkDecRollover: () => void;

  // Tasks
  markTaskCompleted: (taskId: string) => void;
  loadLocalPersistence: () => void;

  // Équipe : actions
  talkAgent: (agentId: string) => { ok: boolean; reason?: string };
  rewardAgent: (agentId: string) => { ok: boolean; reason?: string };
  reprimandAgent: (agentId: string) => { ok: boolean; reason?: string };
  trainAgent: (agentId: string) => { ok: boolean; reason?: string };
  recomputeTeamHealth: () => void;
  /** Recalcule le stress de chaque agent selon sa charge réelle de dossiers
   *  + exigence des clients. Appelée régulièrement et après toute modif dossiers. */
  recomputeAgentStress: () => void;

  // Sprint 2 : Prospects + Dossiers enrichis
  generateProspects: () => void;
  acceptProspect: (id: string, agentId: string) => void;
  refuseProspect: (id: string) => void;
  dismissProspectsForDay: () => void;

  // Sprint 4 : Marquer obligation fiscale comme déposée + historique
  markObligationDeposee: (obligationId: string, type: string, client: string) => void;

  // Sprint 5 : Ajouter une correction du chat à l'historique
  addChatCorrection: (correction: Omit<ChatCorrection, "id">) => void;
  clearChatCorrections: () => void;

  // Sprint 5 : Licencier / faire partir un collaborateur (avec cascade)
  fireAgent: (agentId: string, motif: string, motifType?: FormerAgent["motif_type"]) => { ok: boolean; reason?: string };

  // Sprint 6 : Recrutement — marque un candidat embauché + poste pourvu
  markCandidateHired: (candidatId: string, positionId: string | null) => void;

  // Sprint 8 : Lien Suivi Fiscal → Tâches
  setPendingObligation: (id: string, type: string, client: string) => void;
  clearPendingObligation: () => void;

  // Sprint 9 : Choix de scénario de démarrage
  setStartMode: (mode: "zero" | "ready") => void;
  generateSeasonalCV: () => void; // appelé chaque jour : ajoute 0-2 CV selon saison
  pushUrgentCVsAfterDeparture: (n?: number) => void; // cascade fireAgent → recrut. urgent

  // Sprint 7 : Système Mail
  sendMail: (payload: { to: MailContact[]; cc: MailContact[]; subject: string; body: string; parent_id?: string; expected_cc_ids?: string[] }) => void;
  receiveMail: (payload: { from: MailContact; to?: MailContact[]; cc?: MailContact[]; subject: string; body: string; expected_cc_ids?: string[] }) => void;
  markMailRead: (id: string) => void;
  deleteMail: (id: string) => void;
  generateInitialMails: () => void;
  checkAndGenerateRelances: () => void;

  // Reset complet du jeu (localStorage + Supabase user data)
  resetGame: () => Promise<void>;
  computeIncompatibilites: (dossierId: string, agentId: string) => string[];

  // Sprint 4 : Cohérence inter-onglets
  triggerRetardCascade: (client: string, typeObligation: string, niveauRetard: 1 | 2 | 3) => void;
  triggerSurchargeAgent: (agentId: string) => void;
  triggerBadAffectationDrama: (dossierId: string) => void;
  hireFromCV: (candidat: any) => void;
  applyTaskErrorImpact: (agentId: string, scoreMissed: number) => void;
  applyEmbaucheBonus: (nomNouveau: string) => void;
}

const xpForLevel = (level: number) => 100 + level * 50;

function persistDec(s: any) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("dec_state", JSON.stringify({
      deonto: s.dec_completed_deonto_ids,
      mission: s.dec_completed_mission_ids,
      badges: s.dec_badges,
      streak: s.dec_streak,
      last_day: s.dec_last_day,
      today_deonto: s.dec_today_deonto,
      today_mission: s.dec_today_mission,
      today_day: s.game_day, // jour de référence pour today_*
    }));
  } catch {}
}

function persistProspects(s: any) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("prospects_state", JSON.stringify({
      pending: s.prospects_pending,
      last_day: s.last_prospect_day,
      dismissed_for_day: s.prospects_dismissed_for_day || 0,
    }));
  } catch {}
}

/** Persiste la liste complète des dossiers dans localStorage (les seed Supabase
 *  sont remplacés par cette source dès que le joueur a modifié quelque chose). */
function persistDossiers(s: any) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("dossiers_state", JSON.stringify(s.dossiers));
  } catch {}
}

/** Persiste l'état des agents (stress, fatigue, confiance, emotion, arc…)
 *  + history + cooldowns. Fix le bug 'tout se reset au refresh'. */
function persistAgents(s: any) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("agents_state", JSON.stringify(s.agents));
    localStorage.setItem("agent_player_history", JSON.stringify(s.agent_player_history || {}));
    localStorage.setItem("agent_cooldowns", JSON.stringify(s.agent_cooldowns || {}));
  } catch {}
}

/** Persiste la liste des messages (statut lu / répondu) en localStorage.
 *  Survit au refresh même si Supabase n'a pas eu le temps de synchroniser. */
function persistMessages(s: any) {
  if (typeof window === "undefined") return;
  try {
    // Stocke uniquement les 100 derniers messages pour éviter explosion localStorage
    const last = (s.messages || []).slice(0, 100);
    localStorage.setItem("messages_state", JSON.stringify(last));
  } catch {}
}

/** Persiste le système Temps (compteur quotidien + heures sup) */
function persistTime(s: any) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("time_state", JSON.stringify({
      temps_disponible_min: s.temps_disponible_min,
      temps_disponible_max: s.temps_disponible_max,
      heures_sup_cumul: s.heures_sup_cumul,
      time_day: s.game_day, // jour de référence : si on change de jour, on reset
    }));
  } catch {}
}

/** Persiste l'état global du joueur (ressources + horloge) en plus de Supabase
 *  pour résister au refresh même sans connexion. */
function persistPlayerState(s: any) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("player_state", JSON.stringify({
      legitimite: s.legitimite,
      tresorerie: s.tresorerie,
      reputation: s.reputation,
      stress_global: s.stress_global,
      mood_global: s.mood_global,
      player_level: s.player_level,
      player_xp: s.player_xp,
      xp_to_next: s.xp_to_next,
      team_health: s.team_health,
    }));
  } catch {}
}

export const useGameStore = create<GameState>((set, get) => ({
  user_id: null,
  legitimite: 72,
  tresorerie: 145000,
  reputation: 68,
  stress_global: 61,
  points_action: 3,
  points_action_max: 3,
  temps_disponible_min: 480, // 8h
  temps_disponible_max: 480,
  heures_sup_cumul: 0,
  date_simulation: "14 mai 2026",
  mood_global: "Sous Pression",

  game_hour: 9,
  game_minute: 0,
  game_day: 1,
  game_start_timestamp: 0,

  player_level: 1,
  player_xp: 0,
  xp_to_next: 100,

  dec_streak: 0,
  dec_last_day: 0,
  dec_today_deonto: false,
  dec_today_mission: false,
  dec_completed_deonto_ids: [],
  dec_completed_mission_ids: [],
  dec_badges: [],

  completed_tasks: [],

  agent_cooldowns: {},
  agent_player_history: {},
  team_health: 60,

  prospects_pending: [],
  last_prospect_day: 0,
  prospects_dismissed_for_day: 0,
  fiscal_validations: {},
  chat_corrections: [],
  former_agents: [],
  filled_positions: [],
  hired_candidates: [],
  mails: [],
  last_mail_check_iso: null,
  pending_obligation_id: null,
  pending_obligation_meta: null,
  start_mode: null,
  start_mode_chosen: false,
  dynamic_cvs: [],
  last_seasonal_cv_day: 0,

  agents: [],
  messages: [],
  dossiers: [],
  fiscal_deadlines: [
    { id: "dsn_mai", label: "DSN mensuelle", echeance_label: "5 mai", echeance_day: 5, echeance_month: 5, progression: 85, filiere_responsable: "Social", depend_de: null, cout_retard: 1500, campagne: "Mensuel" },
    { id: "is_acompte", label: "Acompte IS", echeance_label: "15 mai", echeance_day: 15, echeance_month: 5, progression: 60, filiere_responsable: "Fiscal", depend_de: null, cout_retard: 5000, campagne: "Mensuel" },
    { id: "tva_mai", label: "TVA mensuelle", echeance_label: "20 mai", echeance_day: 20, echeance_month: 5, progression: 75, filiere_responsable: "Fiscal", depend_de: null, cout_retard: 3000, campagne: "Mensuel" },
    { id: "bilan_juin", label: "Bilan + AG (Boss)", echeance_label: "30 juin", echeance_day: 30, echeance_month: 6, progression: 32, filiere_responsable: "Audit & IFRS", depend_de: "tva_mai", cout_retard: 30000, campagne: "Bilan" },
  ],
  conversation_history: {},
  claude_history: [],
  isLoading: true,
  isAuthenticated: false,

  setUser: (userId) => set({ user_id: userId, isAuthenticated: !!userId }),

  loadGameState: async () => {
    const user = await getCurrentUser();
    if (!user) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    set({ user_id: user.id, isAuthenticated: true, isLoading: true });

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profile) {
      set({
        legitimite: profile.legitimite,
        tresorerie: profile.tresorerie,
        reputation: profile.reputation,
        stress_global: profile.stress_global,
        points_action: profile.points_action,
        points_action_max: profile.points_action_max,
        date_simulation: profile.date_simulation,
        mood_global: profile.mood_global,
      });
    } else {
      await supabase.from("profiles").insert({ user_id: user.id });
    }

    const { data: existingAgents } = await supabase
      .from("agents_state")
      .select("agent_id")
      .eq("user_id", user.id)
      .limit(1);

    // Si le joueur a choisi "Cabinet de zéro", on bypasse le seed et on charge vide
    let startModeStored: string | null = null;
    try { startModeStored = typeof window !== "undefined" ? localStorage.getItem("start_mode") : null; } catch {}
    if (startModeStored === "zero") {
      set({
        agents: [],
        dossiers: [],
        start_mode: "zero",
        start_mode_chosen: true,
        isLoading: false,
      });
      return;
    }

    if (!existingAgents || existingAgents.length === 0) {
      try {
        const res = await fetch("/agents_config.json");
        const config = await res.json();

        await supabase.from("agents_state").insert(
          config.agents.map((a: any) => ({
            user_id: user.id,
            agent_id: a.id,
            nom: a.nom,
            initiales: a.initiales,
            avatar_color: a.avatar_color,
            statut: a.statut,
            role: a.role,
            filiere: a.filiere,
            niveau: a.niveau,
            trait_dominant: a.trait_dominant,
            competence_technique: a.competence_technique,
            emotion: a.emotion,
            stress: a.stress,
            fatigue: a.fatigue,
            confiance_joueur: a.confiance_joueur,
            respect: a.respect,
            peur: a.peur,
            loyaute: a.loyaute,
            arc_actuel: a.arc_actuel,
            secret: a.secret,
            dossiers_actifs: a.dossiers_actifs,
          }))
        );

        await supabase.from("messages").insert(
          config.messages_en_attente.map((m: any) => ({
            user_id: user.id,
            message_id: m.id,
            agent_id: m.agent_id,
            niveau: m.niveau,
            type: m.type,
            phase: m.phase || null,
            sujet: m.sujet,
            contenu: m.contenu,
            delai_reponse_heures: m.delai_reponse_heures,
            timestamp: m.timestamp,
            lu: false,
            repondu: false,
          }))
        );
      } catch (err) {
        console.error("[Store] Erreur seed initial :", err);
      }
    }

    const { data: agentsData } = await supabase
      .from("agents_state")
      .select("*")
      .eq("user_id", user.id);

    if (agentsData && agentsData.length > 0) {
      set({ agents: agentsData.map((a) => ({ ...a, id: a.agent_id })) });

      // Seed dossiers enrichis avec caractéristiques aléatoires
      const dossiers: Dossier[] = [];
      // Pool de secteurs réalistes — chaque secteur a une catégorie (utilisée pour les tags)
      const SECTEURS_DETAILS = [
        { nom: "Mécanique de précision", categorie: "Industrie" },
        { nom: "Fabrication de luminaires", categorie: "Industrie" },
        { nom: "Importation articles de pêche", categorie: "Industrie" },
        { nom: "Boulangerie artisanale", categorie: "Commerce" },
        { nom: "Cave à vins", categorie: "Commerce" },
        { nom: "Fleuriste", categorie: "Commerce" },
        { nom: "Brasserie traditionnelle", categorie: "Restauration" },
        { nom: "Restaurant gastronomique", categorie: "Restauration" },
        { nom: "Traiteur événementiel", categorie: "Restauration" },
        { nom: "Agence web / SaaS", categorie: "Services" },
        { nom: "Agence immobilière", categorie: "Services" },
        { nom: "Cabinet d'architecture", categorie: "Services" },
        { nom: "Plomberie chauffage", categorie: "Artisanat" },
        { nom: "Électricité bâtiment", categorie: "Artisanat" },
        { nom: "Menuiserie", categorie: "Artisanat" },
        { nom: "Association médico-sociale", categorie: "Association" },
        { nom: "Club sportif amateur", categorie: "Association" },
      ];
      const SPECIALITES_POOL = ["TVA intracommunautaire", "Fiscalité internationale", "IFRS / Consolidation", "Provisions techniques", "Paie complexe (DSN)", "CIR R&D", "TVA restauration", "Immobilier / SCPI", "Comptabilité simple", "Association / Mécénat"];
      const FORMES: any[] = ["SARL", "SAS", "SA", "EURL", "SCI", "Association"];
      const REGIMES: any[] = ["Mensuel", "Trimestriel", "Annuel", "Franchise"];

      function pickRandom<T>(arr: T[], n: number): T[] {
        const shuffled = arr.slice().sort(() => Math.random() - 0.5);
        return shuffled.slice(0, n);
      }

      // Filtre défensif : exclut tout ce qui n'est PAS un dossier client (drama RH,
      // recrutement interne, demandes de congé, médiation). Cet onglet est dédié
      // aux VRAIS dossiers d'entreprises clientes.
      function isClientDossier(label: string): boolean {
        const lower = (label || "").toLowerCase();
        const internalKeywords = [
          "drama",
          "conflit hugo",
          "conflit amélie",
          "conflit avec amélie",
          "médiation",
          "recrutement manager",
          "recrutement collaborateur",
          "entretien annuel",
          "entretiens annuel",
          "demande de congé",
          "demande congé",
          "réunion équipe",
          "réunion interne",
          "formation interne",
        ];
        return !internalKeywords.some((k) => lower.includes(k));
      }

      // Détecte si une chaîne ressemble à un VRAI nom d'entreprise (SARL/SAS/SA/EURL/SCI/Établissements/
      // Boulangerie/Brasserie/Cabinet/Atelier/Agence/Restaurant/Menuiserie/Cave/Fleuriste/Association/Club)
      function looksLikeCompanyName(s: string): boolean {
        const lower = s.toLowerCase().trim();
        const companyKeywords = [
          "sarl", "sas ", "sa ", " sa", "eurl", "sci", "scs", "scop",
          "établissements", "etablissements", "boulangerie", "brasserie", "cabinet",
          "atelier", "agence", "restaurant", "menuiserie", "cave", "fleuriste",
          "traiteur", "association", "club", "groupe", "société", "societe",
          "industries", "industrie", "conseil", "service", "consulting",
        ];
        return companyKeywords.some((k) => lower.includes(k));
      }

      // 1) D'abord on seed les dossiers explicitement nommés dans agents_config
      agentsData.forEach((a: any) => {
        (a.dossiers_actifs || []).forEach((d: string, i: number) => {
          if (!isClientDossier(d)) {
            console.log("[Store] Item RH/interne ignoré dans Dossiers :", d);
            return;
          }
          let [client, theme] = d.includes(" - ") ? d.split(" - ") : [d, "Dossier"];
          if (theme && looksLikeCompanyName(theme) && !looksLikeCompanyName(client)) {
            const swap = client; client = theme; theme = swap;
          }
          const sec = SECTEURS_DETAILS[Math.floor(Math.random() * SECTEURS_DETAILS.length)];
          dossiers.push({
            id: `${a.agent_id}_d${i}`,
            client: client.trim(),
            theme: theme.trim(),
            agent_id: a.agent_id,
            etat: "en_cours",
            progression: 30 + Math.floor(Math.random() * 50),
            phase: ["P2", "P3", "P4"][Math.floor(Math.random() * 3)] as "P2" | "P3" | "P4",
            echeance_heure: `${10 + Math.floor(Math.random() * 7)}:00`,
            impact: {
              legitimite: 2 + Math.floor(Math.random() * 5),
              reputation: 1 + Math.floor(Math.random() * 4),
              tresorerie: 2000 + Math.floor(Math.random() * 8000),
              stress: 3 + Math.floor(Math.random() * 6),
            },
            qualite: 60,
            client_satisfait: true,
            signaux_alerte: [],
            is_vip: false,
            recoverable_until: null,
            cause_perte: null,
            cas_traites: 0,
            secteur: sec.nom,
            secteur_categorie: sec.categorie as any,
            ca: 200000 + Math.floor(Math.random() * 4800000),
            effectif: 3 + Math.floor(Math.random() * 80),
            regime_tva: REGIMES[Math.floor(Math.random() * REGIMES.length)],
            forme_juridique: FORMES[Math.floor(Math.random() * FORMES.length)],
            anciennete_annees: 1 + Math.floor(Math.random() * 15),
            profil_relationnel: 30 + Math.floor(Math.random() * 70),
            complexite_comptable: 20 + Math.floor(Math.random() * 80),
            rentabilite: 30 + Math.floor(Math.random() * 60),
            reactivite_demandee: 20 + Math.floor(Math.random() * 80),
            tolerance_erreurs: 20 + Math.floor(Math.random() * 70),
            specialites_requises: pickRandom(SPECIALITES_POOL, 3 + Math.floor(Math.random() * 3)),
            honoraires_annuels: 15000 + Math.floor(Math.random() * 60000),
            satisfaction: 70 + Math.floor(Math.random() * 25),
            created_game_day: 1, // dossiers d'origine, créés avant le démarrage
          } as any);
        });
      });

      // 2) SEED RICHE : si on a moins de 5 dossiers par agent, on complète
      // avec des clients du pool ENTREPRISES_POOL (max 8 par agent)
      const ENTREPRISES_POOL = [
        { client: "Établissements Moreau & Fils", secteur: "Mécanique de précision", categorie: "Industrie", forme: "SARL" },
        { client: "Atelier Lumière", secteur: "Fabrication de luminaires", categorie: "Industrie", forme: "SAS" },
        { client: "Nordic Pêche", secteur: "Importation articles de pêche", categorie: "Industrie", forme: "SARL" },
        { client: "Boulangerie Maison Lefèvre", secteur: "Boulangerie artisanale", categorie: "Commerce", forme: "EURL" },
        { client: "Cave à vins Les Tonneliers", secteur: "Cave à vins", categorie: "Commerce", forme: "SARL" },
        { client: "Fleuriste Vert Tige", secteur: "Fleuriste", categorie: "Commerce", forme: "EURL" },
        { client: "Brasserie Le Commerce", secteur: "Brasserie traditionnelle", categorie: "Restauration", forme: "SARL" },
        { client: "Restaurant Délice", secteur: "Restaurant gastronomique", categorie: "Restauration", forme: "SAS" },
        { client: "Traiteur Saveurs d'Antan", secteur: "Traiteur événementiel", categorie: "Restauration", forme: "SARL" },
        { client: "Agence Web Pixel", secteur: "Agence web / SaaS", categorie: "Services", forme: "SAS" },
        { client: "SAS ImmoConseil", secteur: "Agence immobilière", categorie: "Services", forme: "SAS" },
        { client: "Cabinet d'architecture Ligne Pure", secteur: "Cabinet d'architecture", categorie: "Services", forme: "SARL" },
        { client: "SARL Dupont Plomberie", secteur: "Plomberie chauffage", categorie: "Artisanat", forme: "SARL" },
        { client: "Électricité Générale Petit", secteur: "Électricité bâtiment", categorie: "Artisanat", forme: "EURL" },
        { client: "Menuiserie Bernard", secteur: "Menuiserie", categorie: "Artisanat", forme: "SARL" },
        { client: "Association Les Petits Pas", secteur: "Association médico-sociale", categorie: "Association", forme: "Association" },
        { client: "Club Sportif Athlé 93", secteur: "Club sportif amateur", categorie: "Association", forme: "Association" },
        { client: "SAS Vidal Industries", secteur: "Métallurgie", categorie: "Industrie", forme: "SAS" },
        { client: "Groupe Dubois Industries", secteur: "Industrie pharmaceutique", categorie: "Industrie", forme: "SA" },
        { client: "SARL Petit Plomberie", secteur: "Plomberie chauffage", categorie: "Artisanat", forme: "SARL" },
        { client: "EURL Dupont Conseil", secteur: "Conseil aux entreprises", categorie: "Services", forme: "EURL" },
        { client: "Café des Sports", secteur: "Bar restaurant", categorie: "Restauration", forme: "SARL" },
        { client: "Pharmacie du Marché", secteur: "Pharmacie", categorie: "Commerce", forme: "SARL" },
        { client: "Auto-École Liberté", secteur: "Auto-école", categorie: "Services", forme: "EURL" },
        { client: "Garage Mécanique Plus", secteur: "Garage automobile", categorie: "Artisanat", forme: "SARL" },
        { client: "SCI Immobilière du Parc", secteur: "Société civile immobilière", categorie: "Services", forme: "SCI" },
      ];
      const usedClients = new Set(dossiers.map((d) => d.client));
      const availableEntreprises = ENTREPRISES_POOL.filter((e) => !usedClients.has(e.client));

      agentsData.forEach((a: any, agentIdx: number) => {
        const currentCharge = dossiers.filter((d) => d.agent_id === a.agent_id).length;
        const target = a.niveau === "Manager" || a.niveau === "Directeur" ? 7 : a.niveau?.includes("Stagiaire") ? 3 : 5;
        const toAdd = Math.max(0, target - currentCharge);
        for (let i = 0; i < toAdd; i++) {
          if (availableEntreprises.length === 0) break;
          // Pick par index pseudo-déterministe pour répartir les types
          const idx = (agentIdx * 7 + i * 3) % availableEntreprises.length;
          const ent = availableEntreprises.splice(idx, 1)[0];
          const themes = [
            "Tenue comptable mensuelle",
            "Préparation bilan",
            "Déclaration TVA",
            "Acompte IS",
            "Liasse fiscale",
            "Paie & DSN mensuelle",
            "Conseil fiscal optimisation",
            "Audit légal annuel",
            "Établissement comptes annuels",
            "Suivi trésorerie & prévisionnel",
          ];
          const theme = themes[(agentIdx + i) % themes.length];
          const phasesPossibles: ("P2" | "P3" | "P4" | "P5")[] = ["P2", "P3", "P4", "P5"];
          const phase = phasesPossibles[Math.floor(Math.random() * phasesPossibles.length)];
          // Progression cohérente avec la phase
          const baseProgress = phase === "P2" ? 25 : phase === "P3" ? 50 : phase === "P4" ? 75 : 90;
          dossiers.push({
            id: `seed_${a.agent_id}_${i}_${Date.now()}`,
            client: ent.client,
            theme,
            agent_id: a.agent_id,
            etat: "en_cours",
            progression: baseProgress + Math.floor(Math.random() * 10),
            phase,
            echeance_heure: `${10 + Math.floor(Math.random() * 7)}:00`,
            impact: {
              legitimite: 2 + Math.floor(Math.random() * 5),
              reputation: 1 + Math.floor(Math.random() * 4),
              tresorerie: 3000 + Math.floor(Math.random() * 12000),
              stress: 2 + Math.floor(Math.random() * 5),
            },
            qualite: 65 + Math.floor(Math.random() * 25),
            client_satisfait: true,
            signaux_alerte: [],
            is_vip: Math.random() < 0.15, // 15% VIP
            recoverable_until: null,
            cause_perte: null,
            cas_traites: 0,
            secteur: ent.secteur,
            secteur_categorie: ent.categorie as any,
            ca: 200000 + Math.floor(Math.random() * 4800000),
            effectif: 3 + Math.floor(Math.random() * 80),
            regime_tva: REGIMES[Math.floor(Math.random() * REGIMES.length)],
            forme_juridique: ent.forme as any,
            anciennete_annees: 1 + Math.floor(Math.random() * 15),
            profil_relationnel: 30 + Math.floor(Math.random() * 70),
            complexite_comptable: 20 + Math.floor(Math.random() * 80),
            rentabilite: 40 + Math.floor(Math.random() * 50),
            reactivite_demandee: 20 + Math.floor(Math.random() * 60),
            tolerance_erreurs: 30 + Math.floor(Math.random() * 60),
            specialites_requises: pickRandom(SPECIALITES_POOL, 2 + Math.floor(Math.random() * 3)),
            honoraires_annuels: 12000 + Math.floor(Math.random() * 50000),
            satisfaction: 70 + Math.floor(Math.random() * 25),
            created_game_day: 1,
          } as any);
        }
      });

      // Marquer quelques dossiers VIP supplémentaires
      const eligibles = dossiers.filter((d) => !d.is_vip && d.honoraires_annuels && d.honoraires_annuels > 40000);
      eligibles.slice(0, 3).forEach((d) => { d.is_vip = true; });

      set({ dossiers });
    }

    const { data: messagesData } = await supabase
      .from("messages")
      .select("*")
      .eq("user_id", user.id)
      .order("timestamp", { ascending: false });

    if (messagesData) {
      set({ messages: messagesData.map((m) => ({ ...m, id: m.message_id })) });
    }

    set({ isLoading: false });
  },

  saveGameState: async () => {
    const state = get();
    if (!state.user_id) return;

    await supabase.from("profiles").upsert({
      user_id: state.user_id,
      legitimite: state.legitimite,
      tresorerie: state.tresorerie,
      reputation: state.reputation,
      stress_global: state.stress_global,
      points_action: state.points_action,
      points_action_max: state.points_action_max,
      date_simulation: state.date_simulation,
      mood_global: state.mood_global,
      updated_at: new Date().toISOString(),
    });
  },

  setResources: (res) => {
    set((state) => ({ ...state, ...res }));
    get().saveGameState();
    persistPlayerState(get());
  },

  markMessageRead: async (id) => {
    const state = get();
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, lu: true } : m
      ),
    }));
    persistMessages(get());
    if (!state.user_id) return;
    await supabase
      .from("messages")
      .update({ lu: true })
      .eq("message_id", id)
      .eq("user_id", state.user_id);
  },

  replyToMessage: async (id, reply) => {
    const state = get();
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, repondu: true, lu: true, reponse_joueur: reply } : m
      ),
    }));
    persistMessages(get());
    if (!state.user_id) return;
    await supabase
      .from("messages")
      .update({ repondu: true, lu: true, reponse_joueur: reply })
      .eq("message_id", id)
      .eq("user_id", state.user_id);
    get().saveGameState();
  },

  spendPA: (amount) => {
    const state = get();
    if (state.points_action >= amount) {
      set({ points_action: state.points_action - amount });
      get().saveGameState();
      return true;
    }
    return false;
  },

  /** Système Temps : ressource principale du cabinet.
   *  - Si assez de temps : on déduit, on touche éventuellement la trésorerie.
   *  - Si pas assez de temps : on accepte mais en mode "heures sup" → stress équipe +20.
   *  - Si pas assez d'argent : refus net.
   */
  spendTime: (minutes, cashCost = 0) => {
    const state = get();
    if (cashCost > state.tresorerie) {
      return { ok: false, reason: `Trésorerie insuffisante (besoin de ${cashCost / 1000}k€, dispo ${(state.tresorerie / 1000).toFixed(1)}k€)` };
    }

    const overtime = minutes > state.temps_disponible_min;
    const newTime = Math.max(0, state.temps_disponible_min - minutes);
    const overflowMinutes = overtime ? minutes - state.temps_disponible_min : 0;

    set((s) => ({
      temps_disponible_min: newTime,
      tresorerie: s.tresorerie - cashCost,
      heures_sup_cumul: s.heures_sup_cumul + overflowMinutes,
      // Si heures sup : +20 stress global et propagation à chaque agent (+5)
      stress_global: overtime ? Math.min(100, s.stress_global + 20) : s.stress_global,
      agents: overtime
        ? s.agents.map((a) => ({ ...a, stress: Math.min(100, a.stress + 5) }))
        : s.agents,
    }));
    get().saveGameState();
    persistTime(get());
    persistPlayerState(get());
    if (overtime) persistAgents(get()); // les agents ont pris +5 stress
    return { ok: true, overtime };
  },

  addConversation: async (agentId, role, content) => {
    const state = get();
    if (!state.user_id) return;

    try {
      await supabase.from("conversations").insert({
        user_id: state.user_id,
        agent_id: agentId,
        role,
        content,
      });
    } catch (err) {
      console.error("[Store] Save conversation failed:", err);
    }
  },

  loadConversations: async (agentId) => {
    const state = get();
    if (!state.user_id) return;

    const { data } = await supabase
      .from("conversations")
      .select("role, content, created_at")
      .eq("user_id", state.user_id)
      .eq("agent_id", agentId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (data) {
      set((state) => ({
        conversation_history: {
          ...state.conversation_history,
          [agentId]: data.map((d) => ({ role: d.role, content: d.content })),
        },
      }));
    }
  },

  addNewMessage: async (event) => {
    const state = get();

    // Anti-doublon : si un message non-répondu avec un sujet similaire existe déjà
    // pour cet agent, on ne le réinjecte pas
    const normSubject = event.sujet.toLowerCase().trim();
    const dup = state.messages.find(
      (m) => m.agent_id === event.agent_id && !m.repondu && m.sujet.toLowerCase().trim() === normSubject
    );
    if (dup) {
      console.log("[Store] Doublon évité :", event.sujet);
      return;
    }

    // Dedup soft : si > 80% de similarité avec un sujet récent (24h), on skippe aussi
    const recentSubjects = state.messages
      .filter((m) => m.agent_id === event.agent_id && !m.repondu)
      .map((m) => m.sujet.toLowerCase());
    const tooSimilar = recentSubjects.some((s) => {
      const shorter = s.length < normSubject.length ? s : normSubject;
      const longer = s.length < normSubject.length ? normSubject : s;
      return longer.includes(shorter) && shorter.length > 8;
    });
    if (tooSimilar) {
      console.log("[Store] Sujet trop similaire évité :", event.sujet);
      return;
    }

    const messageId = `msg_auto_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const newMsg: Message = {
      id: messageId,
      message_id: messageId,
      agent_id: event.agent_id,
      niveau: event.niveau,
      type: event.type,
      phase: null,
      sujet: event.sujet,
      contenu: event.contenu,
      delai_reponse_heures: event.delai_reponse_heures,
      timestamp: new Date().toISOString(),
      lu: false,
      repondu: false,
      reponse_joueur: null,
    };

    set((state) => ({ messages: [newMsg, ...state.messages] }));
    persistMessages(get());

    if (!state.user_id) return;
    try {
      await supabase.from("messages").insert({
        user_id: state.user_id,
        message_id: messageId,
        agent_id: event.agent_id,
        niveau: event.niveau,
        type: event.type,
        phase: null,
        sujet: event.sujet,
        contenu: event.contenu,
        delai_reponse_heures: event.delai_reponse_heures,
        timestamp: new Date().toISOString(),
        lu: false,
        repondu: false,
      });
    } catch (err) {
      console.error("[Store] Insert new message failed:", err);
    }
  },

  tickClock: (minutes) => {
    set((state) => {
      let totalMinutes = state.game_hour * 60 + state.game_minute + minutes;
      let day = state.game_day;
      if (totalMinutes >= 19 * 60) {
        day += 1;
        totalMinutes = 8 * 60;
        return {
          game_hour: 8,
          game_minute: 0,
          game_day: day,
          points_action: state.points_action_max,
        };
      }
      if (totalMinutes < 8 * 60) totalMinutes = 8 * 60;
      return {
        game_hour: Math.floor(totalMinutes / 60),
        game_minute: totalMinutes % 60,
      };
    });
  },

  /**
   * Horloge persistante basée sur le temps réel.
   * Stocke un timestamp de "démarrage de la simulation" en localStorage.
   * À chaque tick (ou refresh), recalcule où on en est :
   *   - 1 seconde réelle = 1 minute jeu (rapide)
   *   - Journée jeu 8h-19h = 11h = 660 min jeu = 11 min réelles
   *   - Après 19h, passage au jour suivant 8h
   * Même après refresh, l'horloge reflète le temps réel écoulé.
   */
  syncClockFromTimestamp: () => {
    if (typeof window === "undefined") return;
    let startTs = 0;
    try {
      const stored = localStorage.getItem("game_start_ts");
      if (stored) startTs = parseInt(stored);
    } catch {}

    if (!startTs || isNaN(startTs)) {
      // Première fois : on initialise au moment réel du démarrage
      startTs = Date.now();
      try { localStorage.setItem("game_start_ts", String(startTs)); } catch {}
    }

    // ⏰ HORLOGE TEMPS RÉEL : on suit l'heure réelle de l'utilisateur
    // game_day = nombre de jours réels depuis le 1er lancement (+ 1)
    // game_hour/minute = heure réelle
    const now = new Date();
    const startDate = new Date(startTs);

    // Comparaison des jours civils (pas des 24h écoulées) pour matcher minuit local
    const startMidnight = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const day = Math.floor((nowMidnight - startMidnight) / (24 * 60 * 60 * 1000)) + 1;

    const hour = now.getHours();
    const minute = now.getMinutes();

    set((state) => {
      // Si on change de jour civil → reset Temps disponible + heures sup
      const isNewDay = day > state.game_day;
      return {
        game_hour: hour,
        game_minute: minute,
        game_day: day,
        game_start_timestamp: startTs,
        ...(isNewDay ? {
          points_action: state.points_action_max,
          temps_disponible_min: state.temps_disponible_max,
          heures_sup_cumul: 0,
        } : {}),
      };
    });
  },

  addXP: (amount) => {
    set((state) => {
      let newXP = state.player_xp + amount;
      let level = state.player_level;
      let toNext = state.xp_to_next;
      while (newXP >= toNext) {
        newXP -= toNext;
        level += 1;
        toNext = xpForLevel(level);
      }
      return { player_xp: newXP, player_level: level, xp_to_next: toNext };
    });
  },

  setDossiers: (d) => set({ dossiers: d }),

  reassignDossier: (dossierId, newAgentId, motif) => {
    const state = get();
    const dossier = state.dossiers.find((d) => d.id === dossierId);
    if (!dossier) return { ok: false, reason: "Dossier introuvable" };
    if (dossier.agent_id === newAgentId) return { ok: false, reason: "Déjà affecté à cet agent" };
    const oldAgent = state.agents.find((a) => a.id === dossier.agent_id);
    const newAgent = state.agents.find((a) => a.id === newAgentId);
    if (!newAgent) return { ok: false, reason: "Nouvel agent introuvable" };

    // 1. Update le dossier
    set((s) => ({
      dossiers: s.dossiers.map((d) =>
        d.id === dossierId ? { ...d, agent_id: newAgentId } : d
      ),
    }));
    persistDossiers(get());

    // 2. Cascade émotionnelle :
    // - Ancien agent : soulagement (-5 stress, -2 fatigue) si charge > 3, sinon micro -2 stress
    // - Nouveau agent : prise en charge (+5 stress, +3 fatigue) — la charge le pèse
    const oldCharge = state.dossiers.filter((d) => d.agent_id === dossier.agent_id && d.etat === "en_cours").length;
    const newCharge = state.dossiers.filter((d) => d.agent_id === newAgentId && d.etat === "en_cours").length;

    set((s) => ({
      agents: s.agents.map((a) => {
        if (a.id === dossier.agent_id) {
          return {
            ...a,
            stress: Math.max(0, a.stress - (oldCharge >= 3 ? 5 : 2)),
            fatigue: Math.max(0, a.fatigue - 2),
          };
        }
        if (a.id === newAgentId) {
          return {
            ...a,
            stress: Math.min(100, a.stress + (newCharge >= 3 ? 8 : 5)),
            fatigue: Math.min(100, a.fatigue + 3),
          };
        }
        return a;
      }),
    }));

    // 3. Messages : pas d'auto-OK. Le nouvel agent ne parle que s'il a un problème
    //   (surcharge, stress élevé, ou burn-out déclaré). L'ancien agent reste silencieux.
    const motifText = motif ? ` Motif : ${motif}.` : "";
    const newAgentStress = newAgent.stress;
    const newAgentFatigue = newAgent.fatigue;
    const isOverloaded = newCharge >= 5 || newAgentStress >= 60 || newAgentFatigue >= 60;
    const isBurnoutRisk = newAgentStress >= 80 || newAgentFatigue >= 80;

    // 3a. RISQUE DÉMISSION : si agent en burn-out (stress>80 OU fatigue>80) et qu'on lui
    //   refile encore un dossier → 50% qu'il démissionne dans la foulée.
    if (isBurnoutRisk && Math.random() < 0.5) {
      // On reannule la réaffectation côté agent : le dossier reste affecté (audit trail),
      // puis on déclenche fireAgent en mode démission. Les dossiers seront re-transférés.
      const demissionMotif = `Burn-out confirmé — refus du dossier ${dossier.client} (stress ${newAgentStress}, fatigue ${newAgentFatigue}).`;
      // Mail de démission émotionnel (avant qu'on le retire)
      get().addNewMessage({
        agent_id: newAgent.id,
        niveau: "N5",
        type: "Crise",
        sujet: `🚨 Démission — je ne tiens plus`,
        contenu: `Chef, je suis désolé mais je ne peux plus. Quand tu m'as réaffecté ${dossier.client}, c'était la goutte d'eau. Stress ${newAgentStress}/100, fatigue ${newAgentFatigue}/100 — je suis cuit. Je remets ma démission avec effet immédiat. J'ai besoin de souffler. Merci pour tout, sincèrement.`,
        delai_reponse_heures: 1,
      });
      // Déclenche la démission après un micro-tick pour que le message soit visible
      setTimeout(() => get().fireAgent(newAgent.id, demissionMotif, "burnout"), 100);
      get().saveGameState();
      return { ok: true, reason: "Démission burn-out déclenchée" };
    }

    // 3b. Si surchargé sans burn-out : il pousse une alerte "j'aimerais en parler"
    if (isOverloaded) {
      get().addNewMessage({
        agent_id: newAgent.id,
        niveau: "N3",
        type: "Décision",
        sujet: `⚠️ Affectation ${dossier.client} — je ne suis pas OK`,
        contenu: `Chef, j'ai bien reçu le dossier ${dossier.client} mais je ne le sens pas. J'ai déjà ${newCharge} dossiers en cours, stress à ${newAgentStress}/100. Je préfère qu'on en parle avant que je m'engage : soit on rééchelonne, soit on bascule ce dossier à quelqu'un d'autre.${motifText}`,
        delai_reponse_heures: 12,
      });
    }
    // 3c. Sinon : SILENCE — pas de message auto. L'ancien agent ne dit rien non plus.
    void motifText; void oldAgent;

    // 4. History pour les 2 agents
    set((s) => ({
      agent_player_history: {
        ...s.agent_player_history,
        ...(oldAgent ? {
          [oldAgent.id]: [
            { day: s.game_day, hour: s.game_hour, event: `Dossier ${dossier.client} transféré vers ${newAgent.nom.split(" ")[0]}`, impact: "−5 Stress · soulagement" },
            ...(s.agent_player_history[oldAgent.id] || []),
          ].slice(0, 20),
        } : {}),
        [newAgent.id]: [
          { day: s.game_day, hour: s.game_hour, event: `Reçoit dossier ${dossier.client} (depuis ${oldAgent?.nom.split(" ")[0] || "?"})`, impact: "+5 Stress · charge" },
          ...(s.agent_player_history[newAgent.id] || []),
        ].slice(0, 20),
      },
    }));

    get().recomputeTeamHealth();
    get().recomputeMood();
    get().saveGameState();
    return { ok: true };
  },

  winDossier: (id) => {
    const state = get();
    const d = state.dossiers.find((x) => x.id === id);
    if (!d || (d.etat !== "en_cours" && d.etat !== "surveillance")) return;
    const agent = state.agents.find((a) => a.id === d.agent_id);
    const multiplier = d.is_vip ? 3 : 1;

    // Statut final selon la qualité
    const finalStatus: "avance" | "cloture" = d.qualite >= 70 && d.client_satisfait ? "avance" : "cloture";

    set((s) => ({
      dossiers: s.dossiers.map((x) =>
        x.id === id ? { ...x, etat: finalStatus, progression: 100 } : x
      ),
      legitimite: Math.min(100, s.legitimite + d.impact.legitimite * multiplier),
      reputation: Math.min(100, s.reputation + d.impact.reputation * multiplier),
      tresorerie: s.tresorerie + d.impact.tresorerie * multiplier,
      stress_global: Math.max(0, s.stress_global - Math.floor(d.impact.stress / 2)),
    }));

    // Message N1 auto "Dossier clôturé" de l'agent associé
    if (agent) {
      get().addNewMessage({
        agent_id: agent.id,
        niveau: "N1",
        type: "Information",
        sujet: `✓ Dossier clôturé — ${d.client}`,
        contenu: `Bonne nouvelle, on a clôturé le dossier ${d.client} (${d.theme}). Le client est satisfait, facturation envoyée. Honoraires +${(d.impact.tresorerie/1000).toFixed(1)}k€ encaissés ce jour. Beau travail collectif.`,
        delai_reponse_heures: 24,
      });
      // +confiance + -stress agent qui a porté le dossier
      get().updateAgent(agent.id, {
        confiance_joueur: Math.min(100, agent.confiance_joueur + 5),
        stress: Math.max(0, agent.stress - 8),
      });
    }
    get().addXP(20);
    get().recomputeMood();
    get().saveGameState();
    persistDossiers(get());
  },

  loseDossier: (id) => {
    const state = get();
    const d = state.dossiers.find((x) => x.id === id);
    if (!d || d.etat === "perdu" || d.etat === "avance" || d.etat === "cloture") return;
    const agent = state.agents.find((a) => a.id === d.agent_id);
    const multiplier = d.is_vip ? 3 : 1;

    // Cause narrative de la perte
    let cause = "Client mécontent";
    if (d.signaux_alerte.includes("agent_burnout")) cause = "Agent en burn-out — dossier bloqué";
    else if (d.signaux_alerte.includes("drama_interne")) cause = "Conflit interne — dossier bloqué";
    else if (d.signaux_alerte.includes("retard_critique")) cause = "Retard critique";
    else if (d.signaux_alerte.includes("client_panique")) cause = "Concurrence — client parti";

    // Recoverable pendant 30 jours (jeu)
    const recoverDate = new Date();
    recoverDate.setDate(recoverDate.getDate() + 30);

    set((s) => ({
      dossiers: s.dossiers.map((x) =>
        x.id === id ? { ...x, etat: "perdu" as const, progression: 0, cause_perte: cause, recoverable_until: recoverDate.toISOString() } : x
      ),
      legitimite: Math.max(0, s.legitimite - d.impact.legitimite * multiplier),
      reputation: Math.max(0, s.reputation - d.impact.reputation * multiplier),
      tresorerie: Math.max(0, s.tresorerie - Math.floor(d.impact.tresorerie / 2) * multiplier),
      stress_global: Math.min(100, s.stress_global + d.impact.stress),
    }));

    // Message N4 auto "Dossier perdu"
    if (agent) {
      get().addNewMessage({
        agent_id: agent.id,
        niveau: "N4",
        type: "Probleme",
        sujet: `⚠ Dossier perdu — ${d.client}`,
        contenu: `Le client ${d.client} part chez le concurrent. On perd ${(d.impact.tresorerie/2/1000).toFixed(1)}k€ d'honoraires et −${d.impact.reputation} de réputation. Faut-il qu'on fasse un debrief équipe demain matin ?`,
        delai_reponse_heures: 12,
      });
      get().updateAgent(agent.id, {
        confiance_joueur: Math.max(0, agent.confiance_joueur - 3),
        stress: Math.min(100, agent.stress + 6),
      });
    }
    get().recomputeMood();
    get().saveGameState();
    persistDossiers(get());
  },

  advanceDossier: (id, amount) => {
    set((state) => ({
      dossiers: state.dossiers.map((x) =>
        x.id === id ? { ...x, progression: Math.min(100, x.progression + amount) } : x
      ),
    }));
  },

  addClaudeMessage: (msg) => {
    set((state) => ({ claude_history: [...state.claude_history, msg].slice(-30) }));
  },

  clearClaude: () => set({ claude_history: [] }),

  updateAgent: (id, patch) => {
    set((state) => ({
      agents: state.agents.map((a) => a.id === id ? { ...a, ...patch } : a),
    }));
  },

  recomputeMood: () => {
    set((state) => {
      const stressMoyen = state.agents.length > 0
        ? state.agents.reduce((s, a) => s + a.stress, 0) / state.agents.length
        : 50;
      const score = (state.legitimite * 0.3) + ((100 - stressMoyen) * 0.3) + (state.reputation * 0.2) + (Math.min(100, state.tresorerie / 2000) * 0.2);

      let mood = "Sous Pression";
      if (score >= 80) mood = "Euphorique";
      else if (score >= 65) mood = "Serein";
      else if (score >= 50) mood = "Tendu";
      else if (score >= 35) mood = "Sous Pression";
      else mood = "En Crise";

      return { mood_global: mood, stress_global: Math.round(stressMoyen) };
    });
  },

  applyOutcome: (agentId, score) => {
    const state = get();
    const agent = state.agents.find((a) => a.id === agentId);
    if (!agent) return;

    if (score >= 75) {
      get().updateAgent(agentId, {
        confiance_joueur: Math.min(100, agent.confiance_joueur + 4),
        stress: Math.max(0, agent.stress - 3),
        respect: Math.min(100, agent.respect + 2),
      });
      // Avance le dossier lié à cet agent
      const dossier = state.dossiers.find((d) => d.agent_id === agentId && d.etat === "en_cours");
      if (dossier) {
        get().advanceDossier(dossier.id, 12);
      }
      // Avance aussi la deadline fiscale de sa filière
      const deadline = state.fiscal_deadlines.find((d) => d.filiere_responsable === agent.filiere && d.progression < 100);
      if (deadline) get().advanceDeadline(deadline.id, 5);
    } else if (score >= 55) {
      get().updateAgent(agentId, {
        confiance_joueur: Math.min(100, agent.confiance_joueur + 1),
        stress: Math.max(0, agent.stress - 1),
      });
    } else if (score < 40) {
      get().updateAgent(agentId, {
        confiance_joueur: Math.max(0, agent.confiance_joueur - 4),
        stress: Math.min(100, agent.stress + 5),
      });
    }
    get().recomputeMood();
  },

  advanceDeadline: (id, amount) => {
    set((state) => ({
      fiscal_deadlines: state.fiscal_deadlines.map((d) =>
        d.id === id ? { ...d, progression: Math.min(100, d.progression + amount) } : d
      ),
    }));
  },

  // Auto-progression : chaque agent autonome fait avancer la deadline de sa filière
  // selon son grade, son stress, sa confiance et sa loyauté
  autoAdvanceDeadlines: () => {
    const state = get();
    const updates: Record<string, number> = {};

    state.agents.forEach((agent) => {
      if (agent.stress > 85) return; // burn-out = pas d'avancement
      let contribution = 0;
      const niveau = (agent as any).niveau || "Collaborateur";
      if (niveau === "Directeur") contribution = 2.5;
      else if (niveau === "Manager") contribution = 2.0;
      else if (niveau === "Collaborateur") contribution = 1.2;
      else contribution = 0.6; // Stagiaire

      // Modulation par stress (haut stress = moins efficace)
      if (agent.stress > 70) contribution *= 0.5;
      // Modulation par confiance (faible confiance = ne bosse pas autant)
      if (agent.confiance_joueur < 40) contribution *= 0.6;
      // Modulation par fatigue
      if (agent.fatigue > 70) contribution *= 0.7;

      // Trouve la deadline correspondante (par filière)
      const deadlines = state.fiscal_deadlines.filter(
        (d) => d.filiere_responsable === agent.filiere && d.progression < 100
      );
      deadlines.forEach((d) => {
        // Si la deadline dépend d'une autre, seulement la moitié de la contribution tant que la dépendance n'est pas finie
        if (d.depend_de) {
          const dep = state.fiscal_deadlines.find((x) => x.id === d.depend_de);
          if (dep && dep.progression < 80) {
            updates[d.id] = (updates[d.id] || 0) + contribution * 0.3;
          } else {
            updates[d.id] = (updates[d.id] || 0) + contribution;
          }
        } else {
          updates[d.id] = (updates[d.id] || 0) + contribution;
        }
      });
    });

    set((state) => ({
      fiscal_deadlines: state.fiscal_deadlines.map((d) =>
        updates[d.id]
          ? { ...d, progression: Math.min(100, d.progression + updates[d.id]) }
          : d
      ),
    }));
  },

  checkOverdueDeadlines: () => {
    const state = get();
    // Pour chaque deadline non finie dont la date est passée, appliquer la pénalité une fois
    const day = state.game_day;
    state.fiscal_deadlines.forEach((d) => {
      // Approximation : on simule que day=1 → 14 mai, donc day-1 = +jours
      const baseDay = 14 + (day - 1);
      const isOverdue = (d.echeance_month === 5 && baseDay > d.echeance_day) || (d.echeance_month < 5);
      if (isOverdue && d.progression < 100) {
        // Pénalité unique : appliquée une fois par jour
        const flag = `overdue_${d.id}_d${day}`;
        if (typeof window !== "undefined" && !localStorage.getItem(flag)) {
          localStorage.setItem(flag, "1");
          set((s) => ({
            tresorerie: Math.max(0, s.tresorerie - d.cout_retard),
            stress_global: Math.min(100, s.stress_global + 5),
            reputation: Math.max(0, s.reputation - 3),
          }));
          // Message N4 auto
          const responsable = state.agents.find((a) => a.filiere === d.filiere_responsable);
          if (responsable) {
            get().addNewMessage({
              agent_id: responsable.id,
              niveau: "N4",
              type: "Probleme",
              sujet: `⚠ Échéance dépassée — ${d.label}`,
              contenu: `${responsable.nom.split(" ")[0]}: on a dépassé l'échéance ${d.echeance_label} pour ${d.label}. Pénalité ${(d.cout_retard / 1000).toFixed(1)}k€ encaissée. On rattrape comment ?`,
              delai_reponse_heures: 6,
            });
          }
        }
      }
    });
  },

  // Recalcule statut + signaux d'alerte de tous les dossiers
  // Auto-finalise (avance/cloture/perdu) selon progression, qualité et signaux
  recomputeAllDossierStatus: () => {
    const state = get();
    const toFinalize: { id: string; outcome: "win" | "lose" }[] = [];

    set((s) => ({
      dossiers: s.dossiers.map((d) => {
        // Dossiers déjà terminés : on ne touche plus
        if (d.etat === "avance" || d.etat === "cloture" || d.etat === "perdu") return d;

        // 🛡️ PÉRIODE DE GRÂCE pour les dossiers récents (créés depuis < 3 game_days)
        // On ne déclenche aucune cascade négative pour leur laisser le temps de démarrer
        const dossierAge = s.game_day - ((d as any).created_game_day || 1);
        const isFresh = dossierAge < 3;
        if (isFresh) {
          // Juste un statut clean, sans signaux
          return { ...d, signaux_alerte: [], etat: "en_cours" as const, client_satisfait: true };
        }

        const agent = s.agents.find((a) => a.id === d.agent_id);
        const signaux: string[] = [];

        if (agent) {
          if (agent.fatigue > 85 || agent.stress > 90) signaux.push("agent_burnout");
          if (agent.confiance_joueur < 30) signaux.push("confiance_basse");
          if ((agent as any).arc_actuel === "Rupture") signaux.push("agent_rupture");
        }

        // Progression attendue : démarre à 20% après la signature, +5%/jour à partir de J+3
        const expectedProgress = Math.min(95, 20 + Math.max(0, dossierAge - 3) * 5);
        if (d.progression < expectedProgress - 25) signaux.push("retard_critique");
        if (s.mood_global === "En Crise") signaux.push("cabinet_crise");

        const client_satisfait = d.qualite >= 50 && signaux.length < 2;

        // Auto-finalisation #1 : progression atteinte → clôture automatique
        if (d.progression >= 100) {
          toFinalize.push({ id: d.id, outcome: "win" });
          return d;
        }

        // Auto-finalisation #2 : perte probabiliste (drastiquement réduite pour ne plus
        // perdre les dossiers fraîchement créés ou en début de phase)
        // Seuil minimum : dossier doit être en P3+ (Contrôle ou plus avancé)
        const phaseNum = parseInt(d.phase?.replace("P", "") || "1");
        if (phaseNum >= 3) {
          if (signaux.length >= 3 && Math.random() < 0.04) {
            toFinalize.push({ id: d.id, outcome: "lose" });
            return d;
          }
          if (signaux.length >= 2 && Math.random() < 0.015) {
            toFinalize.push({ id: d.id, outcome: "lose" });
            return d;
          }
        }

        // 📈 PROGRESSION NATURELLE : +1% par tick si tout va bien (au moins 1 fois par jour de jeu)
        const naturalProgress = signaux.length === 0 && d.qualite >= 60 ? Math.min(100, d.progression + 1) : d.progression;

        // Statut dynamique
        let etat: Dossier["etat"] = "en_cours";
        if (signaux.length >= 2 || (signaux.length >= 1 && d.progression < 40)) etat = "surveillance";

        return { ...d, signaux_alerte: signaux, client_satisfait, etat, progression: naturalProgress };
      }),
    }));

    // Déclenche les finalisations en dehors du set pour éviter récursion
    toFinalize.forEach((f) => {
      if (f.outcome === "win") get().winDossier(f.id);
      else get().loseDossier(f.id);
    });
    // Persiste après chaque tick si modifs
    persistDossiers(get());
  },

  attemptRecoverDossier: (id) => {
    const state = get();
    const d = state.dossiers.find((x) => x.id === id);
    if (!d || d.etat !== "perdu" || !d.recoverable_until) return false;
    if (new Date(d.recoverable_until) < new Date()) return false; // Trop tard

    // Coût : 1h (60 min) pour rappeler, négocier, reprendre le dossier
    const t = get().spendTime(60, 0);
    if (!t.ok) return false;

    // Récupération : 60% chance, modulée par niveau joueur et confiance moyenne agents
    const baseChance = 0.4 + state.player_level * 0.05;
    const success = Math.random() < baseChance;

    if (success) {
      set((s) => ({
        dossiers: s.dossiers.map((x) =>
          x.id === id ? { ...x, etat: "avance" as const, progression: 100, cause_perte: null, recoverable_until: null } : x
        ),
        // Récupération exceptionnelle : honoraires x1.5
        tresorerie: s.tresorerie + Math.floor(d.impact.tresorerie * 1.5),
        legitimite: Math.min(100, s.legitimite + 10),
        reputation: Math.min(100, s.reputation + 5),
      }));
      // Message N1 auto de succès
      const agent = state.agents.find((a) => a.id === d.agent_id);
      if (agent) {
        get().addNewMessage({
          agent_id: agent.id,
          niveau: "N1",
          type: "Information",
          sujet: `🎯 Récupération réussie — ${d.client}`,
          contenu: `${agent.nom.split(" ")[0]}: ${d.client} revient chez nous ! Honoraires +50% sur cette mission. Beau coup de pression dans les négos.`,
          delai_reponse_heures: 24,
        });
      }
      get().addXP(30);
      return true;
    } else {
      // Échec : -3 légitimité
      set((s) => ({ legitimite: Math.max(0, s.legitimite - 3) }));
      return false;
    }
  },

  toggleVIP: (id) => {
    const state = get();
    const d = state.dossiers.find((x) => x.id === id);
    if (!d) return;
    const vipCount = state.dossiers.filter(x => x.is_vip).length;
    if (!d.is_vip && vipCount >= 3) return;
    set((s) => ({
      dossiers: s.dossiers.map((x) => x.id === id ? { ...x, is_vip: !x.is_vip } : x),
    }));
  },

  // ── SPRINT 2 : Prospects + Incompatibilités ─────────────────────────────
  generateProspects: () => {
    const state = get();
    // Max 1 batch par jour. Pas de re-génération si déjà en attente ou déjà vu aujourd'hui.
    if (state.last_prospect_day === state.game_day) return;
    if (state.prospects_pending.length > 0) return;

    // Pool d'entreprises crédibles avec secteur + catégorie + forme suggérée
    const ENTREPRISES_POOL = [
      { client: "Établissements Moreau & Fils", secteur: "Mécanique de précision", categorie: "Industrie", forme: "SARL" },
      { client: "Atelier Lumière", secteur: "Fabrication de luminaires", categorie: "Industrie", forme: "SAS" },
      { client: "Nordic Pêche", secteur: "Importation articles de pêche", categorie: "Industrie", forme: "SARL" },
      { client: "Boulangerie Maison Lefèvre", secteur: "Boulangerie artisanale", categorie: "Commerce", forme: "EURL" },
      { client: "Cave à vins Les Tonneliers", secteur: "Cave à vins", categorie: "Commerce", forme: "SARL" },
      { client: "Fleuriste Vert Tige", secteur: "Fleuriste", categorie: "Commerce", forme: "EURL" },
      { client: "Brasserie Le Commerce", secteur: "Brasserie traditionnelle", categorie: "Restauration", forme: "SARL" },
      { client: "Restaurant Délice", secteur: "Restaurant gastronomique", categorie: "Restauration", forme: "SAS" },
      { client: "Traiteur Saveurs d'Antan", secteur: "Traiteur événementiel", categorie: "Restauration", forme: "SARL" },
      { client: "Agence Web Pixel", secteur: "Agence web / SaaS", categorie: "Services", forme: "SAS" },
      { client: "SAS ImmoConseil", secteur: "Agence immobilière", categorie: "Services", forme: "SAS" },
      { client: "Cabinet d'architecture Ligne Pure", secteur: "Cabinet d'architecture", categorie: "Services", forme: "SARL" },
      { client: "SARL Dupont Plomberie", secteur: "Plomberie chauffage", categorie: "Artisanat", forme: "SARL" },
      { client: "Électricité Générale Petit", secteur: "Électricité bâtiment", categorie: "Artisanat", forme: "EURL" },
      { client: "Menuiserie Bernard", secteur: "Menuiserie", categorie: "Artisanat", forme: "SARL" },
      { client: "Association Les Petits Pas", secteur: "Association médico-sociale", categorie: "Association", forme: "Association" },
      { client: "Club Sportif Athlé 93", secteur: "Club sportif amateur", categorie: "Association", forme: "Association" },
    ];
    const SPECIALITES = ["TVA intracommunautaire", "Fiscalité internationale", "IFRS / Consolidation", "Provisions techniques", "Paie complexe (DSN)", "CIR R&D", "TVA restauration", "Immobilier / SCPI", "Comptabilité simple"];
    const REGIMES: any[] = ["Mensuel", "Trimestriel", "Annuel"];

    function pickRandom<T>(arr: T[], n: number): T[] {
      return arr.slice().sort(() => Math.random() - 0.5).slice(0, n);
    }

    // 1, 2 ou 3 prospects au hasard chaque jour, sans doublon dans le batch
    const count = 1 + Math.floor(Math.random() * 3);
    const choisis = pickRandom(ENTREPRISES_POOL, count);
    const newProspects: NouveauProspect[] = choisis.map((ent, i) => {
      return {
        id: `prospect_${state.game_day}_${i}_${Date.now()}`,
        client: ent.client,
        secteur: ent.secteur,
        secteur_categorie: ent.categorie as any,
        ca: 200000 + Math.floor(Math.random() * 4800000),
        effectif: 3 + Math.floor(Math.random() * 80),
        regime_tva: REGIMES[Math.floor(Math.random() * REGIMES.length)],
        forme_juridique: ent.forme as any,
        profil_relationnel: 30 + Math.floor(Math.random() * 70),
        complexite_comptable: 20 + Math.floor(Math.random() * 80),
        rentabilite: 30 + Math.floor(Math.random() * 60),
        reactivite_demandee: 20 + Math.floor(Math.random() * 80),
        tolerance_erreurs: 20 + Math.floor(Math.random() * 70),
        specialites_requises: pickRandom(SPECIALITES, 3 + Math.floor(Math.random() * 3)),
        honoraires_annuels: 15000 + Math.floor(Math.random() * 60000),
      };
    });

    set({ prospects_pending: newProspects, last_prospect_day: state.game_day });
    persistProspects(get());
  },

  dismissProspectsForDay: () => {
    const state = get();
    set({ prospects_dismissed_for_day: state.game_day });
    persistProspects(get());
  },

  resetGame: async () => {
    if (typeof window === "undefined") return;
    const state = get();

    // 1. Purge tout le localStorage du jeu (préserve la clé Anthropic + le thème)
    const keysToPurge = [
      "game_start_ts",
      "dossiers_state",
      "prospects_state",
      "fiscal_validations",
      "agents_state",
      "agent_player_history",
      "agent_cooldowns",
      "player_state",
      "time_state",
      "messages_state",
      "dec_state",
      "completed_tasks",
      "last_briefing_day",
      "last_evening_recap_day",
      "lastEventGen",
      "dossier_chats_v1",
      "chat_corrections",
      "former_agents",
      "hired_candidates",
      "filled_positions",
      "mails_state",
      // Sprint 9 : choix de scénario + CVs dynamiques (sinon le modal ne réapparaît pas)
      "start_mode",
      "dynamic_cvs",
      "pending_entretien",
    ];
    // Aussi purger toutes les clés dynamiques de tracking (retard_X, drama_check_X, etc.)
    const allKeys = Object.keys(localStorage);
    for (const k of allKeys) {
      if (k.startsWith("retard_") || k.startsWith("drama_check_") || k.startsWith("surcharge_")) {
        try { localStorage.removeItem(k); } catch {}
      }
    }
    for (const k of keysToPurge) {
      try { localStorage.removeItem(k); } catch {}
    }

    // 2. Purge Supabase si user connecté (messages, conversations, agents_state)
    //    → indispensable pour que le modal "Choix de scénario" se rejoue proprement
    if (state.user_id) {
      try {
        await Promise.all([
          supabase.from("messages").delete().eq("user_id", state.user_id),
          supabase.from("conversations").delete().eq("user_id", state.user_id),
          supabase.from("agents_state").delete().eq("user_id", state.user_id),
        ]);
      } catch (e) {
        console.warn("[Reset] Erreur purge Supabase :", e);
      }
    }

    // 3. Reset in-memory de TOUT ce qui pourrait persister malgré le reload
    //    (prospects, mails, messages, corrections, former agents, etc.)
    set({
      start_mode: null,
      start_mode_chosen: false,
      dynamic_cvs: [],
      agents: [],
      dossiers: [],
      prospects_pending: [],
      last_prospect_day: 0,
      prospects_dismissed_for_day: 0,
      mails: [],
      messages: [],
      chat_corrections: [],
      former_agents: [],
      hired_candidates: [],
      filled_positions: [],
      fiscal_validations: {},
      completed_tasks: [],
      agent_player_history: {},
      agent_cooldowns: {},
      pending_obligation_id: null,
      pending_obligation_meta: null,
    });

    // 4. Reload de la page : tout repart from scratch + le modal de choix s'affiche
    if (typeof window !== "undefined") window.location.reload();
  },

  markCandidateHired: (candidatId, positionId) => {
    set((s) => ({
      hired_candidates: s.hired_candidates.includes(candidatId)
        ? s.hired_candidates
        : [...s.hired_candidates, candidatId],
      filled_positions: positionId && !s.filled_positions.includes(positionId)
        ? [...s.filled_positions, positionId]
        : s.filled_positions,
    }));
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("hired_candidates", JSON.stringify(get().hired_candidates));
        localStorage.setItem("filled_positions", JSON.stringify(get().filled_positions));
      } catch {}
    }
  },

  markObligationDeposee: (obligationId, type, client) => {
    const state = get();
    set({
      fiscal_validations: {
        ...state.fiscal_validations,
        [obligationId]: {
          game_day: state.game_day,
          date_iso: new Date().toISOString(),
          type,
          client,
        },
      },
    });
    // Persiste en localStorage
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("fiscal_validations", JSON.stringify(get().fiscal_validations));
      } catch {}
    }
    // Micro-bonus : -1 stress global, +1 légitimité
    set((s) => ({
      stress_global: Math.max(0, s.stress_global - 1),
      legitimite: Math.min(100, s.legitimite + 1),
    }));
  },

  addChatCorrection: (correction) => {
    const id = `corr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    set((s) => ({
      chat_corrections: [{ ...correction, id }, ...s.chat_corrections].slice(0, 300), // garde 300 max
    }));
    // Persiste en localStorage
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("chat_corrections", JSON.stringify(get().chat_corrections));
      } catch {}
    }
  },

  clearChatCorrections: () => {
    set({ chat_corrections: [] });
    if (typeof window !== "undefined") {
      try { localStorage.removeItem("chat_corrections"); } catch {}
    }
  },

  setPendingObligation: (id, type, client) => {
    set({ pending_obligation_id: id, pending_obligation_meta: { type, client } });
  },

  clearPendingObligation: () => {
    set({ pending_obligation_id: null, pending_obligation_meta: null });
  },

  sendMail: (payload) => {
    const state = get();
    const newMail: Email = {
      id: `mail_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      direction: "out",
      from: { type: "self", name: "Toi", email: "associe@cabinet-morel.fr" },
      to: payload.to,
      cc: payload.cc,
      subject: payload.subject,
      body: payload.body,
      date_iso: new Date().toISOString(),
      game_day: state.game_day,
      game_hour: state.game_hour,
      read: true,
      replied: false,
      relance_count: 0,
      parent_id: payload.parent_id,
      expected_cc_ids: payload.expected_cc_ids,
    };
    set((s) => ({ mails: [newMail, ...s.mails].slice(0, 200) }));

    let parent: any = null;
    // Si c'est une réponse à un mail, marque le parent comme répondu + applique impact CC
    if (payload.parent_id) {
      parent = state.mails.find((m) => m.id === payload.parent_id);
      if (parent) {
        // Impact relation : si on a oublié de mettre en CC les bons agents/clients → -confiance
        const ccIdsSent = new Set(payload.cc.map((c) => c.id).filter(Boolean) as string[]);
        const expected = parent.expected_cc_ids || [];
        const missed = expected.filter((id: string) => !ccIdsSent.has(id));
        if (missed.length > 0) {
          set((s) => ({
            agents: s.agents.map((a) =>
              missed.includes(a.id) ? { ...a, confiance_joueur: Math.max(0, a.confiance_joueur - 3) } : a
            ),
          }));
        }
        // Marque parent répondu
        set((s) => ({
          mails: s.mails.map((m) => m.id === parent.id ? { ...m, replied: true, read: true } : m),
        }));
      }
    }

    if (typeof window !== "undefined") {
      try { localStorage.setItem("mails_state", JSON.stringify(get().mails)); } catch {}
    }

    // 📬 RÉPONSE AUTO du destinataire (parent ou destinataire principal) après un délai réaliste
    // Si tu réponds à un client → il te répond. Si tu écris à un agent → il te répond.
    // Délai : urgent < 1h, normal 1-24h, info plusieurs jours selon mots-clés
    const primaryRecipient = payload.to[0] || parent?.from;
    if (primaryRecipient && primaryRecipient.type !== "self") {
      const lowerBody = (payload.body + " " + payload.subject).toLowerCase();
      const urgent = /\b(urgent|asap|imm[ée]diat|tout de suite|aujourd'hui|maintenant)\b/.test(lowerBody);
      const longTerm = /\b(plus tard|le mois prochain|d'ici (?:\d+|un|deux|trois) mois|fin de mois|trimestre)\b/.test(lowerBody);
      let delayMs: number;
      if (urgent) delayMs = 30 * 60 * 1000 + Math.random() * 30 * 60 * 1000;          // 30 min - 1h
      else if (longTerm) delayMs = 7 * 24 * 60 * 60 * 1000 + Math.random() * 14 * 24 * 60 * 60 * 1000; // 7-21 jours
      else delayMs = 2 * 60 * 60 * 1000 + Math.random() * 22 * 60 * 60 * 1000;        // 2-24h

      // En mode dev / simulation rapide, on raccourcit drastiquement pour qu'on voie le retour
      // (le user veut un feedback rapide pendant le jeu, pas attendre 1 mois réel)
      const accelFactor = 1 / 120; // 1 min réelle = 2h game
      const realDelayMs = Math.max(15000, delayMs * accelFactor); // au moins 15s réelles

      const replyContext = parent
        ? `Re: ${parent.subject.replace(/^(Re:|\[Relance \d+\])\s*/g, "")}`
        : `Re: ${payload.subject}`;

      // Génère le contenu de la réponse selon le contexte
      const isClient = primaryRecipient.type === "client";
      const senderShort = primaryRecipient.name.split(" ")[1] || primaryRecipient.name;
      const accuse = urgent
        ? `Bien reçu votre mail urgent, je vais regarder ça immédiatement.`
        : longTerm
          ? `Bien noté, on a le temps. Je reviens vers vous d'ici quelques semaines.`
          : `Merci pour votre retour, c'est bien noté.`;
      const followUp = isClient
        ? (urgent
            ? `Je transmets directement à votre interlocuteur dans le cabinet. Vous aurez une réponse technique d'ici la fin de journée.`
            : `Nous revenons vers vous d'ici peu avec les éléments demandés.`)
        : (urgent
            ? `Je m'y mets tout de suite chef, je te tiens au courant dans l'heure.`
            : `OK chef, c'est noté. Je te fais un point ${urgent ? "ce soir" : "demain ou après-demain"}.`);
      const body = `${accuse}\n\n${followUp}\n\n${isClient ? "Cordialement,\n" + primaryRecipient.name : senderShort}`;

      setTimeout(() => {
        const stillExists = get().mails.find((m) => m.id === newMail.id);
        if (!stillExists) return;
        get().receiveMail({
          from: primaryRecipient,
          subject: replyContext,
          body,
        });
      }, realDelayMs);
    }
  },

  receiveMail: (payload) => {
    const state = get();
    const newMail: Email = {
      id: `mail_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      direction: "in",
      from: payload.from,
      to: payload.to || [{ type: "self", name: "Toi", email: "associe@cabinet-morel.fr" }],
      cc: payload.cc || [],
      subject: payload.subject,
      body: payload.body,
      date_iso: new Date().toISOString(),
      game_day: state.game_day,
      game_hour: state.game_hour,
      read: false,
      replied: false,
      relance_count: 0,
      expected_cc_ids: payload.expected_cc_ids,
    };
    set((s) => ({ mails: [newMail, ...s.mails].slice(0, 200) }));
    if (typeof window !== "undefined") {
      try { localStorage.setItem("mails_state", JSON.stringify(get().mails)); } catch {}
    }
  },

  markMailRead: (id) => {
    set((s) => ({ mails: s.mails.map((m) => m.id === id ? { ...m, read: true } : m) }));
    if (typeof window !== "undefined") {
      try { localStorage.setItem("mails_state", JSON.stringify(get().mails)); } catch {}
    }
  },

  deleteMail: (id) => {
    set((s) => ({ mails: s.mails.filter((m) => m.id !== id) }));
    if (typeof window !== "undefined") {
      try { localStorage.setItem("mails_state", JSON.stringify(get().mails)); } catch {}
    }
  },

  generateInitialMails: () => {
    const state = get();
    if (state.mails.length > 0) return; // déjà des mails

    // Génère 3-4 mails initiaux de clients
    const dossiersActifs = state.dossiers.filter((d) => d.etat === "en_cours" || d.etat === "surveillance");
    const samples = dossiersActifs.slice(0, 4);
    samples.forEach((d, idx) => {
      const agent = state.agents.find((a) => a.id === d.agent_id);
      const emailSlug = d.client.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
      setTimeout(() => {
        get().receiveMail({
          from: { type: "client", id: d.id, name: `Direction ${d.client}`, email: `direction@${emailSlug}.fr` },
          subject: idx === 0 ? `Demande de point sur notre dossier` :
                   idx === 1 ? `Question urgente — déclaration TVA` :
                   idx === 2 ? `Confirmation de notre RDV` :
                              `Documents complémentaires à transmettre`,
          body: idx === 0
            ? `Bonjour,\n\nJe me permets de vous solliciter pour faire le point sur l'avancement de notre dossier. Pourriez-vous me confirmer la date de signature du bilan ?\n\nNous avons également besoin de précisions sur la provision Bertrand — le commissaire aux comptes nous a contactés directement.\n\nMerci de me tenir informé(e).\n\nCordialement,\nLa Direction`
            : idx === 1
              ? `Bonjour,\n\nNotre déclaration de TVA de mai 2026 est en attente. Le délai approche et nous n'avons pas reçu votre validation.\n\nPouvez-vous traiter ce point en priorité ? L'inspecteur des impôts nous a déjà contactés une fois ce trimestre.\n\nBien à vous,\nDirection financière`
              : idx === 2
                ? `Bonjour,\n\nJe confirme notre rendez-vous de signature du bilan prévu dans les prochains jours. Pouvez-vous me confirmer l'heure exacte et m'envoyer la liasse définitive à l'avance pour préparation ?\n\nMerci,\nGérance`
                : `Bonjour,\n\nVoici les éléments complémentaires que vous m'avez demandés : facture Bertrand SAS, contrat de prestation, et attestation bancaire.\n\nMerci de bien vouloir les intégrer au dossier de clôture.\n\nCordialement`,
          expected_cc_ids: agent ? [agent.id] : [],
        });
      }, idx * 100); // étale les timestamps
    });

    // 1 mail d'un salarié
    if (state.agents.length > 0) {
      const a = state.agents[0];
      setTimeout(() => {
        get().receiveMail({
          from: { type: "agent", id: a.id, name: a.nom, email: `${a.nom.toLowerCase().replace(/\s+/g, ".")}@cabinet-morel.fr` },
          subject: "Point organisation semaine",
          body: `Bonjour chef,\n\nJ'aimerais qu'on fasse un point sur la répartition de mes dossiers cette semaine. Avec le bilan de Vidal qui arrive, je vais avoir besoin de soulager mon planning.\n\nSerait-il possible de me dégager un créneau cette semaine ?\n\nMerci,\n${a.nom.split(" ")[0]}`,
        });
      }, samples.length * 100);
    }

    set({ last_mail_check_iso: new Date().toISOString() });
  },

  checkAndGenerateRelances: () => {
    const state = get();
    const now = Date.now();
    const lastCheck = state.last_mail_check_iso ? new Date(state.last_mail_check_iso).getTime() : 0;
    // Check max 1x toutes les 5 min réelles
    if (now - lastCheck < 5 * 60 * 1000) return;

    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
    state.mails.forEach((m) => {
      if (m.direction !== "in" || m.replied) return;
      if (m.relance_count >= 2) return; // max 2 relances
      const sentAt = new Date(m.date_iso).getTime();
      const since = now - sentAt;
      const expectedRelances = Math.floor(since / TWO_DAYS_MS);
      if (expectedRelances > m.relance_count) {
        // Génère une relance
        const isClient = m.from.type === "client";
        get().receiveMail({
          from: m.from,
          subject: `[Relance ${m.relance_count + 1}] ${m.subject}`,
          body: isClient
            ? `Bonjour,\n\nJe me permets de revenir vers vous concernant mon précédent message resté sans réponse depuis ${m.relance_count + 1 === 1 ? "2 jours" : "plusieurs jours"}.\n\n${m.relance_count >= 1 ? "Je commence à m'inquiéter — pouvez-vous me confirmer la prise en charge ?" : "Pouvez-vous me confirmer la bonne réception et me dire quand vous comptez traiter ce point ?"}\n\nCordialement,\n${m.from.name}`
            : `Re,\n\nJe relance sur mon mail précédent. Tu as eu l'occasion d'y jeter un œil ?\n\nÇa devient urgent.\n\n${m.from.name.split(" ")[0]}`,
          expected_cc_ids: m.expected_cc_ids,
        });
        // Incrémente le compteur sur l'original
        set((s) => ({
          mails: s.mails.map((mm) => mm.id === m.id ? { ...mm, relance_count: mm.relance_count + 1 } : mm),
        }));
      }
    });

    set({ last_mail_check_iso: new Date().toISOString() });
    if (typeof window !== "undefined") {
      try { localStorage.setItem("mails_state", JSON.stringify(get().mails)); } catch {}
    }
  },

  fireAgent: (agentId, motif, motifType = "licencie") => {
    const state = get();
    const agent = state.agents.find((a) => a.id === agentId);
    if (!agent) return { ok: false, reason: "Agent introuvable" };

    // 1. Réaffecte automatiquement ses dossiers : on cherche un autre agent de la même filière
    // (idéalement Manager), sinon le premier collaborateur dispo
    const sameFiliereAgents = state.agents.filter((a) => a.id !== agentId && a.filiere === agent.filiere);
    const manager = sameFiliereAgents.find((a) => (a.role || "").toLowerCase().includes("manager"));
    const fallback = manager || sameFiliereAgents[0] || state.agents.find((a) => a.id !== agentId);

    const sesDossiers = state.dossiers.filter((d) => d.agent_id === agentId && d.etat !== "perdu" && d.etat !== "cloture");
    const dossiers_transferes_a: { dossier: string; nouvel_agent: string }[] = [];

    if (fallback) {
      sesDossiers.forEach((d) => {
        dossiers_transferes_a.push({ dossier: d.client, nouvel_agent: fallback.nom });
      });
      set((s) => ({
        dossiers: s.dossiers.map((d) =>
          d.agent_id === agentId && d.etat !== "perdu" && d.etat !== "cloture"
            ? { ...d, agent_id: fallback.id }
            : d
        ),
      }));
    }

    // 2. Calcul de la durée passée au cabinet (game_day - 1 par défaut, on n'a pas de date d'embauche)
    const dureeJours = state.game_day; // approximation : tous les agents seedés sont là depuis le J1

    // 3. Ajoute aux anciens collaborateurs
    const formerAgent: FormerAgent = {
      id: agentId,
      nom: agent.nom,
      initiales: agent.initiales,
      avatar_color: agent.avatar_color,
      role: agent.role,
      filiere: agent.filiere,
      departure_game_day: state.game_day,
      departure_date_iso: new Date().toISOString(),
      motif,
      motif_type: motifType,
      final_confiance: agent.confiance_joueur,
      final_loyaute: agent.loyaute,
      dossiers_transferes_a,
      duree_cabinet_jours: dureeJours,
    };

    // 4. Retire l'agent de la liste active
    set((s) => ({
      agents: s.agents.filter((a) => a.id !== agentId),
      former_agents: [formerAgent, ...s.former_agents],
      // Cascade émotionnelle sur le reste de l'équipe selon le motif
      // Licenciement = légitimité -5, stress équipe +5 (peur), peur +10
      // Démission = légitimité -3, stress équipe +3, peur +5
      // Burn-out = légitimité -10 (n'a pas vu venir), stress équipe +8
      legitimite: Math.max(0, s.legitimite + (motifType === "burnout" ? -10 : motifType === "licencie" ? -5 : -3)),
    }));

    // Propagation aux autres agents
    set((s) => ({
      agents: s.agents.map((a) => ({
        ...a,
        stress: Math.min(100, a.stress + (motifType === "burnout" ? 8 : motifType === "licencie" ? 5 : 3)),
        peur: Math.min(100, a.peur + (motifType === "licencie" ? 10 : 5)),
      })),
    }));

    // 5. Message N1 collectif (Sophie RH) annonçant le départ
    const sophie = state.agents.find((a) => (a.role || "").toLowerCase().includes("rh"));
    if (sophie && sophie.id !== agentId) {
      const motifTxt = motifType === "licencie"
        ? "à la suite de la décision du patron"
        : motifType === "demission"
          ? "à sa propre demande"
          : motifType === "burnout"
            ? "pour raisons de santé (arrêt maladie longue durée)"
            : "à l'issue de son contrat";
      get().addNewMessage({
        agent_id: sophie.id,
        niveau: "N1",
        type: "Information",
        sujet: `📤 Départ de ${agent.nom.split(" ")[0]}`,
        contenu: `Sophie : ${agent.nom} quitte le cabinet ${motifTxt}. Motif : ${motif}. ${dossiers_transferes_a.length > 0 ? `J'ai transféré ses ${dossiers_transferes_a.length} dossier${dossiers_transferes_a.length > 1 ? "s" : ""} à ${fallback?.nom.split(" ")[0]}.` : "Aucun dossier à transférer."} Je m'occupe de l'attestation Pôle Emploi et du solde de tout compte.`,
        delai_reponse_heures: 48,
      });
    }

    // 6. Persistance
    persistAgents(get());
    persistDossiers(get());
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("former_agents", JSON.stringify(get().former_agents));
      } catch {}
    }
    get().recomputeTeamHealth();
    get().recomputeMood();
    get().saveGameState();

    // 7. PAS DE GAME OVER — si la cabinet se vide, on déclenche un recrutement
    //    urgent automatique (3 CVs spontanés + mail système).
    const newAgentCount = get().agents.length;
    if (newAgentCount <= 1) {
      get().pushUrgentCVsAfterDeparture(3);
    }

    return { ok: true };
  },

  // ════════════════════════════════════════════════════════════════
  //  SPRINT 9 — Mode de démarrage + CVs dynamiques + cascade fire
  // ════════════════════════════════════════════════════════════════

  setStartMode: (mode) => {
    set({ start_mode: mode, start_mode_chosen: true });
    if (typeof window !== "undefined") {
      try { localStorage.setItem("start_mode", mode); } catch {}
    }
    if (mode === "zero") {
      // Vide l'équipe + dossiers, donne un fonds de roulement de 500 k€
      // → permet de recruter 4-6 collaborateurs (3 mois de salaire d'avance)
      set({
        agents: [],
        dossiers: [],
        tresorerie: 500000,         // fonds de roulement de démarrage
        legitimite: 30,             // jeune cabinet, faible légitimité
        reputation: 25,             // peu connu
        stress_global: 20,          // calme initial
        player_level: 1,
        team_health: 100,
      });
      persistAgents(get());
      persistDossiers(get());
      persistPlayerState(get());
      // Génère 20 CVs initiaux (tout le pool) pour pouvoir recruter sereinement
      // → couvre toutes les filières + 4 profils RH
      get().pushUrgentCVsAfterDeparture(20);
    }
    // mode "ready" : on garde l'état seedé par défaut
  },

  /**
   * Pousse N candidats spontanés dans dynamic_cvs.
   * Utilisé après un départ d'agent OU au démarrage mode zéro.
   * Pool de 20 candidats variés couvrant toutes les filières + 4 profils RH.
   */
  pushUrgentCVsAfterDeparture: (n = 3) => {
    const POOL = [
      // === COMPTABLES (5) ===
      { nom: "Léa Marchand", age: 26, poste_vise: "Collaborateur Comptable", experience_annees: 3, competence_pct: 65, specialites: ["Tenue comptable", "DSN", "TVA"], salaire_demande: 34000, filiere: "Comptable", trait_dominant: "Loyal", notes_sophie: "Spontanée — disponibilité immédiate.", score_match: 72 },
      { nom: "Inès Faure", age: 27, poste_vise: "Collaboratrice Comptable", experience_annees: 3, competence_pct: 60, specialites: ["Tenue", "Lettrage", "TVA"], salaire_demande: 32000, filiere: "Comptable", trait_dominant: "Loyal", notes_sophie: "Profil junior fiable.", score_match: 68 },
      { nom: "Antoine Rossi", age: 41, poste_vise: "Chef de mission Comptable", experience_annees: 17, competence_pct: 88, specialites: ["Révision", "Bilan", "Liasse 2065", "Annexes"], salaire_demande: 58000, filiere: "Comptable", trait_dominant: "Rigide", notes_sophie: "Très expérimenté — exige autonomie.", score_match: 90 },
      { nom: "Sara Bouchard", age: 29, poste_vise: "Collaboratrice Comptable", experience_annees: 5, competence_pct: 72, specialites: ["TVA", "DSN", "Révision", "Sage"], salaire_demande: 38000, filiere: "Comptable", trait_dominant: "Créatif", notes_sophie: "Bonne maîtrise outils — polyvalente.", score_match: 75 },
      { nom: "Jules Mercier", age: 23, poste_vise: "Stagiaire Comptable", experience_annees: 1, competence_pct: 45, specialites: ["Saisie", "Lettrage", "Stage DCG"], salaire_demande: 22000, filiere: "Comptable", trait_dominant: "Empathique", notes_sophie: "Tout jeune — à former.", score_match: 55 },

      // === FISCAUX (4) ===
      { nom: "Karim Sefa", age: 31, poste_vise: "Manager Fiscal", experience_annees: 8, competence_pct: 84, specialites: ["IS", "CGI avancé", "Contentieux"], salaire_demande: 52000, filiere: "Fiscal", trait_dominant: "Rigide", notes_sophie: "Ex Cabinet Big4 — solide.", score_match: 88 },
      { nom: "Hugo Vasseur", age: 35, poste_vise: "Chef de mission Fiscal", experience_annees: 10, competence_pct: 78, specialites: ["TVA intracom.", "Optimisation IS", "Contrôles fiscaux"], salaire_demande: 48000, filiere: "Fiscal", trait_dominant: "Rigide", notes_sophie: "Profil opérationnel.", score_match: 82 },
      { nom: "Nadia El Amrani", age: 33, poste_vise: "Manager Fiscal International", experience_annees: 9, competence_pct: 86, specialites: ["Fiscalité internationale", "Prix de transfert", "BEPS"], salaire_demande: 62000, filiere: "Fiscal", trait_dominant: "Ambitieux", notes_sophie: "Profil rare — clients grands comptes.", score_match: 92 },
      { nom: "Clément Riou", age: 26, poste_vise: "Collaborateur Fiscal", experience_annees: 3, competence_pct: 68, specialites: ["TVA", "IS", "CFE/CVAE"], salaire_demande: 36000, filiere: "Fiscal", trait_dominant: "Créatif", notes_sophie: "Bon potentiel — formé à Toulouse.", score_match: 74 },

      // === AUDIT & IFRS (4) ===
      { nom: "Manon Dupré", age: 24, poste_vise: "Stagiaire DEC", experience_annees: 0, competence_pct: 40, specialites: ["Stage 3e année DEC"], salaire_demande: 24000, filiere: "Audit & IFRS", trait_dominant: "Créatif", notes_sophie: "Très motivée — formera bien.", score_match: 65 },
      { nom: "Thomas Régnier", age: 38, poste_vise: "Directeur Audit", experience_annees: 14, competence_pct: 92, specialites: ["IFRS", "Consolidation", "CAC"], salaire_demande: 75000, filiere: "Audit & IFRS", trait_dominant: "Ambitieux", notes_sophie: "Profil senior — coûteux mais expert.", score_match: 95 },
      { nom: "Mathilde Leroy", age: 30, poste_vise: "Manager Audit", experience_annees: 7, competence_pct: 80, specialites: ["NEP", "CAC", "Révision IFRS"], salaire_demande: 50000, filiere: "Audit & IFRS", trait_dominant: "Loyal", notes_sophie: "Très solide en NEP.", score_match: 86 },
      { nom: "Erwan Le Bras", age: 25, poste_vise: "Auditeur Junior", experience_annees: 2, competence_pct: 55, specialites: ["Audit légal", "Mémorisation NEP"], salaire_demande: 30000, filiere: "Audit & IFRS", trait_dominant: "Rigide", notes_sophie: "Sortie DSCG — appliqué.", score_match: 68 },

      // === SOCIAL & PAIE (3) ===
      { nom: "Aïcha Bensaïd", age: 28, poste_vise: "Collaborateur Social", experience_annees: 4, competence_pct: 70, specialites: ["Paie", "DSN", "Droit social"], salaire_demande: 36000, filiere: "Social", trait_dominant: "Empathique", notes_sophie: "Très demandée — saisir vite.", score_match: 80 },
      { nom: "Pierre Caillaux", age: 37, poste_vise: "Manager Social", experience_annees: 12, competence_pct: 85, specialites: ["Paie complexe", "Conventions collectives", "DSN", "URSSAF"], salaire_demande: 54000, filiere: "Social", trait_dominant: "Rigide", notes_sophie: "Connaît toutes les conventions.", score_match: 89 },
      { nom: "Yasmine Daher", age: 26, poste_vise: "Gestionnaire Paie", experience_annees: 3, competence_pct: 62, specialites: ["Paie Silae", "DSN", "Soldes de tout compte"], salaire_demande: 33000, filiere: "Social", trait_dominant: "Loyal", notes_sophie: "Solide opérationnelle paie.", score_match: 72 },

      // === RH (4 — important pour le mode zéro) ===
      { nom: "Camille Rocheteau", age: 32, poste_vise: "Responsable RH", experience_annees: 8, competence_pct: 82, specialites: ["Recrutement", "Droit du travail", "Formation", "Conduite d'entretiens"], salaire_demande: 48000, filiere: "RH", trait_dominant: "Empathique", notes_sophie: "Profil RH expert cabinet libéral.", score_match: 88 },
      { nom: "Olivier Schmidt", age: 45, poste_vise: "Directeur RH", experience_annees: 20, competence_pct: 91, specialites: ["Stratégie RH", "Talent management", "Médiation", "GPEC"], salaire_demande: 78000, filiere: "RH", trait_dominant: "Ambitieux", notes_sophie: "Profil DRH senior — référence cabinet.", score_match: 94 },
      { nom: "Léna Vidal", age: 27, poste_vise: "Chargée de recrutement RH", experience_annees: 4, competence_pct: 72, specialites: ["Sourcing", "Entretiens", "Onboarding"], salaire_demande: 36000, filiere: "RH", trait_dominant: "Créatif", notes_sophie: "Très active sur LinkedIn — sourcing efficace.", score_match: 78 },
      { nom: "Bertrand Aubert", age: 38, poste_vise: "Responsable Formation & RH", experience_annees: 13, competence_pct: 84, specialites: ["Plan formation", "Droit du travail", "Médiation", "DSN"], salaire_demande: 56000, filiere: "RH", trait_dominant: "Loyal", notes_sophie: "Mix formation/RH/social — polyvalent.", score_match: 86 },
    ];

    const existingIds = new Set(get().dynamic_cvs.map((c: any) => c.id));
    const newCVs: any[] = [];
    // Tire SANS DOUBLON dans le pool : on shuffle puis on prend n premiers
    const shuffled = [...POOL].sort(() => Math.random() - 0.5);
    for (let i = 0; i < n && i < shuffled.length; i++) {
      const base = shuffled[i];
      const id = `dyn_cv_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`;
      if (existingIds.has(id)) continue;
      newCVs.push({
        ...base,
        id,
        disponibilite: "Immédiate",
        arrived_game_day: get().game_day,
      });
    }
    set((s) => ({ dynamic_cvs: [...newCVs, ...s.dynamic_cvs].slice(0, 40) }));
    if (typeof window !== "undefined") {
      try { localStorage.setItem("dynamic_cvs", JSON.stringify(get().dynamic_cvs)); } catch {}
    }

    // Message N1 de Sophie (RH) annonçant l'arrivée des CVs
    const sophie = get().agents.find((a) => (a.role || "").toLowerCase().includes("rh"));
    if (sophie) {
      get().addNewMessage({
        agent_id: sophie.id,
        niveau: "N3",
        type: "RH",
        sujet: `📨 ${newCVs.length} nouveau(x) CV reçus`,
        contenu: `Chef, suite à la situation, j'ai poussé un appel à candidatures express. ${newCVs.length} CV qualifiés sont arrivés ce matin. Je te les ai mis dans l'onglet RH — à toi de voir qui tu veux rencontrer en priorité. Disponibilités immédiates pour la plupart.`,
        delai_reponse_heures: 24,
      });
    }
  },

  /**
   * Génère 0-2 CVs spontanés selon le mois en cours.
   * Pics : janvier-mars (rentrée fiscale) et septembre.
   * Appelé une fois par jour de jeu via HomeContent.
   */
  generateSeasonalCV: () => {
    const state = get();
    if (state.last_seasonal_cv_day === state.game_day) return;
    // Date réelle approximative basée sur game_day (départ : 14 mai 2026)
    const start = new Date(2026, 4, 14);
    start.setDate(start.getDate() + state.game_day - 1);
    const month = start.getMonth() + 1; // 1-12
    let intensity: "haute" | "moyenne" | "basse" = "basse";
    if (month >= 1 && month <= 3) intensity = "haute";    // rentrée fiscale
    else if (month === 9) intensity = "haute";             // rentrée scolaire
    else if (month === 5 || month === 6 || month === 11) intensity = "moyenne";
    else intensity = "basse";

    const proba = intensity === "haute" ? 0.7 : intensity === "moyenne" ? 0.35 : 0.12;
    const roll = Math.random();
    set({ last_seasonal_cv_day: state.game_day });
    if (roll > proba) return; // pas de CV ce jour

    const count = intensity === "haute" ? (Math.random() < 0.4 ? 2 : 1) : 1;
    get().pushUrgentCVsAfterDeparture(count);
  },


  acceptProspect: (id, agentId) => {
    const state = get();
    const prospect = state.prospects_pending.find((p) => p.id === id);
    if (!prospect) return;
    // Acompte signature : 25% des honoraires annuels versés à la signature de la lettre de mission
    const acompte = Math.floor(prospect.honoraires_annuels * 0.25);
    const newDossier: Dossier = {
      id: `dos_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      client: prospect.client,
      theme: `Mission complète — ${prospect.secteur}`,
      agent_id: agentId,
      etat: "en_cours",
      progression: 20, // démarre à 20% (lettre de mission signée, dossier permanent ouvert)
      phase: "P1",
      echeance_heure: "12:00",
      impact: {
        legitimite: 3 + Math.floor(prospect.rentabilite / 25),
        reputation: 2 + Math.floor(prospect.rentabilite / 30),
        tresorerie: prospect.honoraires_annuels - acompte, // reste à toucher à la clôture
        stress: 3 + Math.floor(prospect.complexite_comptable / 20),
      },
      qualite: 70,
      client_satisfait: true,
      signaux_alerte: [],
      is_vip: prospect.rentabilite > 80,
      recoverable_until: null,
      cause_perte: null,
      cas_traites: 0,
      secteur: prospect.secteur,
      secteur_categorie: prospect.secteur_categorie,
      ca: prospect.ca,
      effectif: prospect.effectif,
      regime_tva: prospect.regime_tva,
      forme_juridique: prospect.forme_juridique,
      anciennete_annees: 0,
      profil_relationnel: prospect.profil_relationnel,
      complexite_comptable: prospect.complexite_comptable,
      rentabilite: prospect.rentabilite,
      reactivite_demandee: prospect.reactivite_demandee,
      tolerance_erreurs: prospect.tolerance_erreurs,
      specialites_requises: prospect.specialites_requises,
      honoraires_annuels: prospect.honoraires_annuels,
      satisfaction: 75,
      created_game_day: state.game_day, // pour période de grâce dans recomputeAllDossierStatus
    } as any;

    // CASCADE FINANCIÈRE IMMÉDIATE : trésorerie + réputation + légitimité
    set((s) => ({
      dossiers: [...s.dossiers, newDossier],
      prospects_pending: s.prospects_pending.filter((p) => p.id !== id),
      reputation: Math.min(100, s.reputation + 3),
      legitimite: Math.min(100, s.legitimite + 2),
      tresorerie: s.tresorerie + acompte, // 💰 ACOMPTE IMMÉDIAT
    }));
    persistProspects(get());
    persistDossiers(get());
    persistPlayerState(get());
    get().saveGameState();

    // Pas d'auto-OK : le collaborateur ne notifie le patron QUE s'il est surchargé.
    const newAgent = get().agents.find((a) => a.id === agentId);
    if (newAgent) {
      const charge = get().dossiers.filter((d) => d.agent_id === agentId && d.etat === "en_cours").length;
      const surcharge = charge >= 5 || newAgent.stress >= 60 || newAgent.fatigue >= 60;
      if (surcharge) {
        get().addNewMessage({
          agent_id: newAgent.id,
          niveau: "N3",
          type: "Décision",
          sujet: `⚠️ ${prospect.client} — charge à discuter`,
          contenu: `Chef, j'ai bien reçu ${prospect.client} (${prospect.secteur}). Mais j'ai déjà ${charge} dossiers actifs, stress ${newAgent.stress}/100. Je préfère qu'on en parle : soit on étale la prise en charge, soit on confie ce dossier à un collègue moins chargé.`,
          delai_reponse_heures: 12,
        });
      }
    }

    // Recompute stress agent (charge dossiers a augmenté)
    setTimeout(() => get().recomputeAgentStress(), 100);
  },

  refuseProspect: (id) => {
    set((s) => ({
      prospects_pending: s.prospects_pending.filter((p) => p.id !== id),
    }));
    persistProspects(get());
  },

  // ── SPRINT 4 : Cohérences inter-onglets ─────────────────────────────
  /**
   * Quand une obligation fiscale est en retard, cascade :
   * Niveau 1 (1er retard) : Mail client mécontent + agent stress +10
   * Niveau 2 (2ème retard) : Mise en demeure + agent stress +15 + réputation -3
   * Niveau 3 (3ème retard) : Client perdu + agent stress +25 + trésorerie -15k€
   */
  triggerRetardCascade: (client, typeObligation, niveauRetard) => {
    const state = get();
    const dossier = state.dossiers.find((d) => d.client === client);
    if (!dossier) return;
    const agent = state.agents.find((a) => a.id === dossier.agent_id);
    if (!agent) return;

    if (niveauRetard === 1) {
      get().addNewMessage({
        agent_id: agent.id,
        niveau: "N3",
        type: "Probleme",
        sujet: `⚠ Client mécontent — ${client}`,
        contenu: `Le client ${client} vient de m'appeler. Il est mécontent du retard sur ${typeObligation}. Il faut absolument que je rattrape cette semaine. Désolé chef.`,
        delai_reponse_heures: 24,
      });
      get().updateAgent(agent.id, {
        stress: Math.min(100, agent.stress + 10),
      });
      set((s) => ({ reputation: Math.max(0, s.reputation - 3) }));
    } else if (niveauRetard === 2) {
      get().addNewMessage({
        agent_id: agent.id,
        niveau: "N4",
        type: "Crise",
        sujet: `📛 Mise en demeure — ${client}`,
        contenu: `Le client ${client} a envoyé une mise en demeure suite au 2ème retard sur ${typeObligation}. Ses avocats menacent de rompre le contrat. On a 48h pour réagir.`,
        delai_reponse_heures: 12,
      });
      get().updateAgent(agent.id, {
        stress: Math.min(100, agent.stress + 15),
        confiance_joueur: Math.max(0, agent.confiance_joueur - 5),
      });
      set((s) => ({ reputation: Math.max(0, s.reputation - 8) }));
    } else {
      // Niveau 3 : client perdu
      get().addNewMessage({
        agent_id: agent.id,
        niveau: "N5",
        type: "Crise",
        sujet: `💥 Client ${client} PERDU`,
        contenu: `Catastrophe. Le client ${client} a rompu le contrat suite au 3ème retard. Perte ${(dossier.honoraires_annuels || 15000).toLocaleString("fr-FR")}€/an. Toute l'équipe est démoralisée.`,
        delai_reponse_heures: 6,
      });
      get().updateAgent(agent.id, {
        stress: Math.min(100, agent.stress + 25),
        confiance_joueur: Math.max(0, agent.confiance_joueur - 15),
      });
      // Marque le dossier comme perdu (cascade dossier)
      set((s) => ({
        dossiers: s.dossiers.map((d) => d.id === dossier.id ? {
          ...d, etat: "perdu" as const, progression: 0,
          cause_perte: "3 retards successifs sur obligations fiscales",
          recoverable_until: null,
        } : d),
        tresorerie: Math.max(0, s.tresorerie - 15000),
        reputation: Math.max(0, s.reputation - 15),
        stress_global: Math.min(100, s.stress_global + 10),
      }));
    }
    get().recomputeMood();
  },

  /**
   * Agent surchargé (>3 dossiers actifs) → ajout d'un signal sur ses dossiers
   * + tentative auto de Drama si stress très élevé
   */
  triggerSurchargeAgent: (agentId) => {
    const state = get();
    const agent = state.agents.find((a) => a.id === agentId);
    if (!agent) return;
    const dossiers = state.dossiers.filter((d) => d.agent_id === agentId && d.etat === "en_cours");
    if (dossiers.length < 3) return;

    // Ajoute signal surcharge sur tous les dossiers
    set((s) => ({
      dossiers: s.dossiers.map((d) => d.agent_id === agentId && d.etat === "en_cours" ? {
        ...d,
        signaux_alerte: Array.from(new Set([...d.signaux_alerte, "agent_surcharge"])),
        etat: d.etat === "en_cours" ? ("surveillance" as const) : d.etat,
      } : d),
    }));

    // Si stress >80 → message N4 demandant retrait d'un dossier
    if (agent.stress > 80) {
      const dossierToDrop = dossiers[dossiers.length - 1];
      get().addNewMessage({
        agent_id: agent.id,
        niveau: "N4",
        type: "Probleme",
        sujet: `⚠ Demande retrait dossier — ${dossierToDrop.client}`,
        contenu: `Chef, je n'en peux plus. J'ai ${dossiers.length} dossiers actifs et je suis à ${agent.stress} de stress. Je te demande de réassigner ${dossierToDrop.client} à quelqu'un d'autre, sinon je vais faire des erreurs.`,
        delai_reponse_heures: 12,
      });
    }
  },

  /**
   * Mauvaise affectation détectée → génère un drama d'équipe
   * Conditions : incompat critique (stagiaire sur dossier complexe, etc.)
   */
  triggerBadAffectationDrama: (dossierId) => {
    const state = get();
    const d = state.dossiers.find((x) => x.id === dossierId);
    if (!d) return;
    const agent = state.agents.find((a) => a.id === d.agent_id);
    if (!agent) return;

    const incompatibilites = get().computeIncompatibilites(dossierId, agent.id);
    if (incompatibilites.length < 2) return;

    // Drama : autre agent compétent vient se plaindre
    const competentAgent = state.agents.find((a) =>
      a.id !== agent.id &&
      a.filiere === (d.specialites_requises || []).join(" ").includes("Fiscal") ? "Fiscal" : a.filiere
    );

    if (competentAgent && Math.random() < 0.3) {
      get().addNewMessage({
        agent_id: competentAgent.id,
        niveau: "N3",
        type: "Drama",
        sujet: `🎭 Désaccord sur affectation ${d.client}`,
        contenu: `Chef, je trouve étrange que ${agent.nom.split(" ")[0]} soit sur le dossier ${d.client} alors que c'est clairement de mon domaine. ${incompatibilites[0]}. Tu peux y jeter un œil ?`,
        delai_reponse_heures: 24,
      });
    }
  },

  /**
   * Embauche depuis un CV : ajoute un nouvel agent à l'équipe
   */
  hireFromCV: (candidat) => {
    const state = get();
    const initiales = candidat.nom.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
    const colors = ["#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#007AFF", "#5856D6", "#AF52DE"];
    const color = colors[state.agents.length % colors.length];

    const newAgent: Agent = {
      id: `agent_${Date.now()}`,
      nom: candidat.nom,
      initiales,
      avatar_color: color,
      statut: "En ligne",
      role: candidat.poste_vise,
      filiere: candidat.filiere,
      niveau: candidat.poste_vise.includes("Manager") || candidat.poste_vise.includes("Directrice") ? "Manager" : candidat.poste_vise.includes("Stagiaire") ? "Stagiaire DEC" : "Collaborateur",
      emotion: "Euphorique",
      stress: 30,
      fatigue: 20,
      confiance_joueur: 70,
      respect: 60,
      peur: 20,
      loyaute: 65,
    } as Agent;

    set((s) => ({ agents: [...s.agents, newAgent] }));
    persistAgents(get());

    // Marque le candidat comme embauché (+ pourvoit la position correspondante si match)
    get().markCandidateHired(candidat.id, null);

    // Message de bienvenue de l'équipe (par Sophie RH)
    const sophie = state.agents.find((a) => a.role.toLowerCase().includes("rh"));
    if (sophie) {
      get().addNewMessage({
        agent_id: sophie.id,
        niveau: "N1",
        type: "Information",
        sujet: `🎉 ${candidat.nom} a rejoint l'équipe`,
        contenu: `Chef, j'ai finalisé l'embauche de ${candidat.nom} comme ${candidat.poste_vise}. Salaire fixé à ${(candidat.salaire_demande / 1000).toFixed(0)}k€. L'équipe est ravie d'avoir un renfort sur ${candidat.filiere}. Il/elle prend ses fonctions dès demain.`,
        delai_reponse_heures: 48,
      });
    }
    get().recomputeTeamHealth();
  },

  /**
   * Erreur manquée dans Tâches → impact agent porteur
   */
  applyTaskErrorImpact: (agentId, scoreMissed) => {
    const state = get();
    const agent = state.agents.find((a) => a.id === agentId);
    if (!agent) return;

    set((s) => ({
      legitimite: Math.max(0, s.legitimite - 5),
      agents: s.agents.map((a) => a.id === agentId ? {
        ...a,
        confiance_joueur: Math.max(0, a.confiance_joueur - 3),
        stress: Math.min(100, a.stress + 5),
      } : a),
    }));
  },

  /**
   * Bonus moral après embauche réussie
   */
  applyEmbaucheBonus: (nomNouveau) => {
    set((s) => ({
      legitimite: Math.min(100, s.legitimite + 3),
      // Reduction stress équipe (-5 chacun)
      agents: s.agents.map((a) => ({ ...a, stress: Math.max(0, a.stress - 5) })),
    }));
  },

  computeIncompatibilites: (dossierId, agentId) => {
    const state = get();
    const d = state.dossiers.find((x) => x.id === dossierId);
    const a = state.agents.find((x) => x.id === agentId);
    if (!d || !a) return [];

    const warnings: string[] = [];

    // Incompatibilité humeur/relation
    if ((d.profil_relationnel || 0) > 75 && a.stress > 70) {
      warnings.push(`Client exigeant + ${a.nom.split(" ")[0]} déjà stressé → risque craquage`);
    }
    if ((d.profil_relationnel || 0) > 75 && (a as any).trait_dominant === "Anxieux") {
      warnings.push(`Client exigeant + agent anxieux → fragile`);
    }
    if ((d.tolerance_erreurs || 100) < 40 && (a as any).niveau && (a as any).niveau.includes("Stagiaire")) {
      warnings.push(`Client très peu tolérant + stagiaire → risque très élevé`);
    }

    // Incompatibilité compétence (charge)
    const chargeAgent = state.dossiers.filter((x) => x.agent_id === a.id && x.etat === "en_cours").length;
    if (chargeAgent >= 3) {
      warnings.push(`${a.nom.split(" ")[0]} a déjà ${chargeAgent} dossiers actifs (surcharge)`);
    }

    // Incompatibilité spécialités
    const agentSpecs: string[] = (a as any).competences_DEC || [];
    const requises = d.specialites_requises || [];
    const match = requises.filter((r) => agentSpecs.some((s) => s.toLowerCase().includes(r.toLowerCase().split(" ")[0]) || r.toLowerCase().includes(s.toLowerCase().split(" ")[0])));
    if (requises.length > 0 && match.length === 0) {
      warnings.push(`Aucune spécialité requise dans son profil (${requises.slice(0, 2).join(", ")}…)`);
    }

    // Confiance basse
    if (a.confiance_joueur < 35) {
      warnings.push(`Confiance basse (${a.confiance_joueur}) → motivation réduite`);
    }

    return warnings;
  },

  // ── DEC PREP ────────────────────────────────────────────────────────────
  markDeontoCompleted: (questionIds) => {
    set((s) => ({
      dec_today_deonto: true,
      dec_completed_deonto_ids: Array.from(new Set([...s.dec_completed_deonto_ids, ...questionIds])).slice(-200),
    }));
    const s = get();
    if (s.dec_today_mission && s.dec_last_day !== s.game_day) {
      set({ dec_streak: s.dec_streak + 1, dec_last_day: s.game_day });
    }
    persistDec(get());
  },

  markMissionCompleted: (missionId) => {
    set((s) => ({
      dec_today_mission: true,
      dec_completed_mission_ids: Array.from(new Set([...s.dec_completed_mission_ids, missionId])),
    }));
    const s = get();
    if (s.dec_today_deonto && s.dec_last_day !== s.game_day) {
      set({ dec_streak: s.dec_streak + 1, dec_last_day: s.game_day });
    }
    persistDec(get());
  },

  addBadge: (badge) => {
    set((s) => ({
      dec_badges: s.dec_badges.includes(badge) ? s.dec_badges : [...s.dec_badges, badge],
    }));
    persistDec(get());
  },

  markTaskCompleted: (taskId) => {
    set((s) => {
      const next = Array.from(new Set([...s.completed_tasks, taskId]));
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("completed_tasks", JSON.stringify(next));
        }
      } catch {}
      return { completed_tasks: next };
    });
  },

  loadLocalPersistence: () => {
    if (typeof window === "undefined") return;
    try {
      const tasks = localStorage.getItem("completed_tasks");
      if (tasks) {
        const arr = JSON.parse(tasks);
        if (Array.isArray(arr)) set({ completed_tasks: arr });
      }
      const dec = localStorage.getItem("dec_state");
      if (dec) {
        const d = JSON.parse(dec);
        set((s) => {
          // today_* ne sont valides que si on est le même jour qu'à la sauvegarde
          const sameDay = typeof d.today_day === "number" && d.today_day === s.game_day;
          return {
            dec_completed_deonto_ids: d.deonto || s.dec_completed_deonto_ids,
            dec_completed_mission_ids: d.mission || s.dec_completed_mission_ids,
            dec_badges: d.badges || s.dec_badges,
            dec_streak: d.streak ?? s.dec_streak,
            dec_last_day: d.last_day ?? s.dec_last_day,
            dec_today_deonto: sameDay ? !!d.today_deonto : s.dec_today_deonto,
            dec_today_mission: sameDay ? !!d.today_mission : s.dec_today_mission,
          };
        });
      }
      // Sprint 2 : restaure aussi les prospects (last_prospect_day + pending + dismissed)
      const prospects = localStorage.getItem("prospects_state");
      if (prospects) {
        const p = JSON.parse(prospects);
        set((s) => ({
          prospects_pending: Array.isArray(p.pending) ? p.pending : s.prospects_pending,
          last_prospect_day: typeof p.last_day === "number" ? p.last_day : s.last_prospect_day,
          prospects_dismissed_for_day: typeof p.dismissed_for_day === "number" ? p.dismissed_for_day : s.prospects_dismissed_for_day,
        }));
      }
      // Restaure la liste des dossiers (override le seed Supabase si modifié par le joueur).
      // Filtre défensif : nettoie les anciens états contenant des items RH/internes.
      const dossiers = localStorage.getItem("dossiers_state");
      if (dossiers) {
        const arr = JSON.parse(dossiers);
        if (Array.isArray(arr) && arr.length > 0) {
          const cleaned = arr.filter((d: any) => {
            const lower = (d?.client || "").toLowerCase();
            const internalKeywords = ["drama", "conflit hugo", "conflit amélie", "conflit avec amélie", "médiation", "recrutement manager", "recrutement collaborateur", "entretien annuel", "demande de congé", "réunion interne", "formation interne"];
            return !internalKeywords.some((k) => lower.includes(k));
          });
          set({ dossiers: cleaned });
          if (cleaned.length !== arr.length) {
            // Réécrit localStorage purgé
            try { localStorage.setItem("dossiers_state", JSON.stringify(cleaned)); } catch {}
          }
        }
      }
      // Restaure l'historique des validations fiscales
      const fiscalVal = localStorage.getItem("fiscal_validations");
      if (fiscalVal) {
        const obj = JSON.parse(fiscalVal);
        if (obj && typeof obj === "object") set({ fiscal_validations: obj });
      }

      // Restaure l'historique des corrections chat (examinateur DEC)
      const corrections = localStorage.getItem("chat_corrections");
      if (corrections) {
        const arr = JSON.parse(corrections);
        if (Array.isArray(arr)) set({ chat_corrections: arr });
      }
      // Restaure la liste des anciens collaborateurs
      const formers = localStorage.getItem("former_agents");
      if (formers) {
        const arr = JSON.parse(formers);
        if (Array.isArray(arr)) set({ former_agents: arr });
      }
      // Restaure les recrutements RH (postes pourvus + candidats embauchés)
      const hired = localStorage.getItem("hired_candidates");
      if (hired) {
        const arr = JSON.parse(hired);
        if (Array.isArray(arr)) set({ hired_candidates: arr });
      }
      const filled = localStorage.getItem("filled_positions");
      if (filled) {
        const arr = JSON.parse(filled);
        if (Array.isArray(arr)) set({ filled_positions: arr });
      }
      // Restaure la boîte mail
      const mailsStored = localStorage.getItem("mails_state");
      if (mailsStored) {
        const arr = JSON.parse(mailsStored);
        if (Array.isArray(arr)) set({ mails: arr });
      }

      // Restaure l'état complet des agents (stress, fatigue, confiance, emotion, arc)
      const agentsStored = localStorage.getItem("agents_state");
      if (agentsStored) {
        const arr = JSON.parse(agentsStored);
        if (Array.isArray(arr) && arr.length > 0) set({ agents: arr });
      }
      const historyStored = localStorage.getItem("agent_player_history");
      if (historyStored) {
        const obj = JSON.parse(historyStored);
        if (obj && typeof obj === "object") set({ agent_player_history: obj });
      }
      const cdStored = localStorage.getItem("agent_cooldowns");
      if (cdStored) {
        const obj = JSON.parse(cdStored);
        if (obj && typeof obj === "object") set({ agent_cooldowns: obj });
      }

      // Restaure les ressources joueur (fallback offline-first quand Supabase tarde)
      const playerStored = localStorage.getItem("player_state");
      if (playerStored) {
        const p = JSON.parse(playerStored);
        set((s) => ({
          legitimite: typeof p.legitimite === "number" ? p.legitimite : s.legitimite,
          tresorerie: typeof p.tresorerie === "number" ? p.tresorerie : s.tresorerie,
          reputation: typeof p.reputation === "number" ? p.reputation : s.reputation,
          stress_global: typeof p.stress_global === "number" ? p.stress_global : s.stress_global,
          mood_global: p.mood_global || s.mood_global,
          player_level: typeof p.player_level === "number" ? p.player_level : s.player_level,
          player_xp: typeof p.player_xp === "number" ? p.player_xp : s.player_xp,
          xp_to_next: typeof p.xp_to_next === "number" ? p.xp_to_next : s.xp_to_next,
          team_health: typeof p.team_health === "number" ? p.team_health : s.team_health,
        }));
      }

      // Restaure les messages (avec leur statut lu/répondu actualisé)
      const msgsStored = localStorage.getItem("messages_state");
      if (msgsStored) {
        const arr = JSON.parse(msgsStored);
        if (Array.isArray(arr) && arr.length > 0) {
          // Merge : si Supabase a chargé des messages, on prend l'état localStorage pour
          // chaque message connu (statut lu/repondu plus à jour). Sinon on prend la liste localStorage.
          set((s) => {
            if (s.messages.length === 0) return { messages: arr };
            const localMap = new Map<string, any>(arr.map((m: any) => [m.id, m]));
            const merged = s.messages.map((m) => {
              const localVersion = localMap.get(m.id);
              if (!localVersion) return m;
              // Préfère localStorage si plus à jour sur lu/répondu
              return {
                ...m,
                lu: m.lu || localVersion.lu,
                repondu: m.repondu || localVersion.repondu,
                reponse_joueur: m.reponse_joueur || localVersion.reponse_joueur,
              };
            });
            // Ajoute les messages présents en local mais pas dans Supabase
            const knownIds = new Set(s.messages.map((m) => m.id));
            const onlyLocal = arr.filter((m: any) => !knownIds.has(m.id));
            return { messages: [...onlyLocal, ...merged] };
          });
        }
      }

      // Restaure mode de démarrage + CVs dynamiques
      const startMode = localStorage.getItem("start_mode");
      if (startMode === "zero" || startMode === "ready") {
        set({ start_mode: startMode, start_mode_chosen: true });
      }
      const dynCVs = localStorage.getItem("dynamic_cvs");
      if (dynCVs) {
        try {
          const arr = JSON.parse(dynCVs);
          if (Array.isArray(arr)) set({ dynamic_cvs: arr });
        } catch {}
      }

      // Restaure le compteur Temps (mais le reset si on a changé de game_day)
      const timeStored = localStorage.getItem("time_state");
      if (timeStored) {
        const t = JSON.parse(timeStored);
        set((s) => {
          const sameDay = t.time_day === s.game_day;
          return {
            temps_disponible_min: sameDay && typeof t.temps_disponible_min === "number" ? t.temps_disponible_min : s.temps_disponible_max,
            temps_disponible_max: typeof t.temps_disponible_max === "number" ? t.temps_disponible_max : s.temps_disponible_max,
            heures_sup_cumul: sameDay && typeof t.heures_sup_cumul === "number" ? t.heures_sup_cumul : 0,
          };
        });
      }
    } catch (e) {
      console.warn("[Store] loadLocalPersistence failed:", e);
    }
  },

  talkAgent: (agentId) => {
    const state = get();
    const agent = state.agents.find((a) => a.id === agentId);
    if (!agent) return { ok: false, reason: "Agent introuvable" };
    const cd = state.agent_cooldowns[agentId]?.talk;
    if (cd && state.game_day < cd) return { ok: false, reason: `Disponible au jour ${cd}` };

    // Coût : 5 minutes de ton temps, pas d'argent
    const t = get().spendTime(5, 0);
    if (!t.ok) return { ok: false, reason: t.reason };

    set((s) => ({
      agents: s.agents.map((a) => a.id === agentId ? {
        ...a,
        confiance_joueur: Math.min(100, a.confiance_joueur + 3),
        respect: Math.min(100, a.respect + 1),
        stress: Math.max(0, a.stress - 2),
      } : a),
      agent_cooldowns: { ...s.agent_cooldowns, [agentId]: { ...s.agent_cooldowns[agentId], talk: s.game_day + 1 } },
      agent_player_history: {
        ...s.agent_player_history,
        [agentId]: [{ day: s.game_day, hour: s.game_hour, event: "Échange informel (5min)", impact: "+3 Confiance · −2 Stress" }, ...(s.agent_player_history[agentId] || [])].slice(0, 20),
      },
    }));
    get().recomputeTeamHealth();
    persistAgents(get());
    return { ok: true };
  },

  rewardAgent: (agentId) => {
    const state = get();
    const agent = state.agents.find((a) => a.id === agentId);
    if (!agent) return { ok: false, reason: "Agent introuvable" };
    const cd = state.agent_cooldowns[agentId]?.reward;
    if (cd && state.game_day < cd) return { ok: false, reason: `Récompense déjà donnée — re-disponible jour ${cd}` };

    // Coût : 10 min (signer le chèque-cadeau, l'annoncer) + 500€ chèque cadeau
    const t = get().spendTime(10, 500);
    if (!t.ok) return { ok: false, reason: t.reason };

    set((s) => ({
      agents: s.agents.map((a) => a.id === agentId ? {
        ...a,
        confiance_joueur: Math.min(100, a.confiance_joueur + 7),
        loyaute: Math.min(100, a.loyaute + 5),
        stress: Math.max(0, a.stress - 5),
        emotion: "Euphorique",
      } : a),
      legitimite: Math.min(100, s.legitimite + 2),
      agent_cooldowns: { ...s.agent_cooldowns, [agentId]: { ...s.agent_cooldowns[agentId], reward: s.game_day + 7 } },
      agent_player_history: {
        ...s.agent_player_history,
        [agentId]: [{ day: s.game_day, hour: s.game_hour, event: "Récompense (chèque-cadeau)", impact: "+7 Confiance · +5 Loyauté · +2 Légitimité · −500€" }, ...(s.agent_player_history[agentId] || [])].slice(0, 20),
      },
    }));
    get().recomputeTeamHealth();
    persistAgents(get());
    return { ok: true };
  },

  reprimandAgent: (agentId) => {
    const state = get();
    const agent = state.agents.find((a) => a.id === agentId);
    if (!agent) return { ok: false, reason: "Agent introuvable" };
    const cd = state.agent_cooldowns[agentId]?.reprimand;
    if (cd && state.game_day < cd) return { ok: false, reason: `Disponible au jour ${cd}` };

    // Si déjà bas confiance + Trait fier → risque démission
    const risqueDemission = agent.confiance_joueur < 30 && (agent as any).trait_dominant === "Ambitieux";

    // Coût : 10 min (entretien sec), pas d'argent — conséquences purement relationnelles
    const t = get().spendTime(10, 0);
    if (!t.ok) return { ok: false, reason: t.reason };

    set((s) => ({
      agents: s.agents.map((a) => a.id === agentId ? {
        ...a,
        confiance_joueur: Math.max(0, a.confiance_joueur - 6),
        peur: Math.min(100, a.peur + 10),
        stress: Math.min(100, a.stress + 5),
        emotion: "Frustré",
      } : a),
      legitimite: Math.min(100, s.legitimite + 1),
      agent_cooldowns: { ...s.agent_cooldowns, [agentId]: { ...s.agent_cooldowns[agentId], reprimand: s.game_day + 3 } },
      agent_player_history: {
        ...s.agent_player_history,
        [agentId]: [{ day: s.game_day, hour: s.game_hour, event: "Réprimande (10min)", impact: risqueDemission ? "⚠ RISQUE DÉMISSION · −6 Confiance · +10 Peur" : "−6 Confiance · +10 Peur · +5 Stress" }, ...(s.agent_player_history[agentId] || [])].slice(0, 20),
      },
    }));
    get().recomputeTeamHealth();
    persistAgents(get());
    return { ok: true };
  },

  trainAgent: (agentId) => {
    const state = get();
    const agent = state.agents.find((a) => a.id === agentId);
    if (!agent) return { ok: false, reason: "Agent introuvable" };
    const cd = state.agent_cooldowns[agentId]?.train;
    if (cd && state.game_day < cd) return { ok: false, reason: `Formation suivante au jour ${cd}` };

    // Coût : 3h (180 min) pour libérer un créneau + 3k€ frais formation
    const t = get().spendTime(180, 3000);
    if (!t.ok) return { ok: false, reason: t.reason };

    set((s) => ({
      agents: s.agents.map((a) => a.id === agentId ? {
        ...a,
        confiance_joueur: Math.min(100, a.confiance_joueur + 4),
        loyaute: Math.min(100, a.loyaute + 3),
        fatigue: Math.max(0, a.fatigue - 15),
        stress: Math.max(0, a.stress - 10),
        emotion: "Concentré",
      } : a),
      agent_cooldowns: { ...s.agent_cooldowns, [agentId]: { ...s.agent_cooldowns[agentId], train: s.game_day + 10 } },
      agent_player_history: {
        ...s.agent_player_history,
        [agentId]: [{ day: s.game_day, hour: s.game_hour, event: "Formation (3h)", impact: "−15 Fatigue · −10 Stress · +4 Confiance · −3k€" + (t.overtime ? " · ⚠ heures sup" : "") }, ...(s.agent_player_history[agentId] || [])].slice(0, 20),
      },
    }));
    get().recomputeTeamHealth();
    get().saveGameState();
    persistAgents(get());
    persistTime(get());
    return { ok: true };
  },

  recomputeTeamHealth: () => {
    set((state) => {
      if (state.agents.length === 0) return state;
      const avgConfiance = state.agents.reduce((s, a) => s + a.confiance_joueur, 0) / state.agents.length;
      const avgStress = state.agents.reduce((s, a) => s + a.stress, 0) / state.agents.length;
      const avgFatigue = state.agents.reduce((s, a) => s + a.fatigue, 0) / state.agents.length;
      const avgLoyaute = state.agents.reduce((s, a) => s + a.loyaute, 0) / state.agents.length;
      const health = Math.round((avgConfiance + (100 - avgStress) + (100 - avgFatigue) + avgLoyaute) / 4);
      // Seuil critique : <50 → mood "En Crise"
      const mood = health < 50 && state.mood_global !== "En Crise" ? "En Crise" : state.mood_global;
      return { team_health: health, mood_global: mood };
    });
  },

  recomputeAgentStress: () => {
    // Stress dynamique basé sur la VRAIE charge de chaque agent.
    // Base = 15 (état serein). Modifs additives selon dossiers actifs uniquement.
    set((state) => {
      const dossiersByAgent: Record<string, any[]> = {};
      state.dossiers.forEach((d) => {
        if (d.etat !== "en_cours" && d.etat !== "surveillance") return;
        if (!dossiersByAgent[d.agent_id]) dossiersByAgent[d.agent_id] = [];
        dossiersByAgent[d.agent_id].push(d);
      });

      return {
        agents: state.agents.map((a) => {
          const ses = dossiersByAgent[a.id] || [];
          const charge = ses.length;
          // Calcul stress cible
          let target = 15; // base sereine
          // Charge : 3 dossiers = OK (+5), 4 = chargé (+15), 5+ = surchargé (+25-30)
          if (charge >= 3) target += (charge - 2) * 10;
          // Exigence client
          target += ses.filter((d) => (d.profil_relationnel || 0) > 70).length * 5;
          target += ses.filter((d) => (d.complexite_comptable || 0) > 70).length * 5;
          target += ses.filter((d) => (d.reactivite_demandee || 0) > 70).length * 5;
          // Surveillance / signaux alerte
          target += ses.filter((d) => d.etat === "surveillance").length * 8;
          target += ses.reduce((s, d) => s + (d.signaux_alerte?.length || 0) * 3, 0);
          // Bonus tolérance : agent expérimenté résiste mieux
          if ((a as any).competence_technique >= 4) target -= 5;
          if ((a as any).niveau === "Manager" || (a as any).niveau === "Directeur") target -= 3;
          // Lissage : on rapproche progressivement (50% du delta) pour éviter sauts brusques
          target = Math.max(5, Math.min(100, target));
          const newStress = Math.round(a.stress + (target - a.stress) * 0.5);
          // Émotion auto selon nouveau stress
          let newEmotion = a.emotion;
          if (newStress > 80) newEmotion = "Surmené";
          else if (newStress > 60 && (a as any).trait_dominant === "Anxieux") newEmotion = "Anxieux";
          else if (newStress < 25) newEmotion = a.emotion === "Surmené" || a.emotion === "Anxieux" ? "Stable" : a.emotion;
          return { ...a, stress: newStress, emotion: newEmotion };
        }),
      };
    });
    persistAgents(get());
  },

  // Réinitialise les drapeaux du jour quand on change de jour de jeu
  checkDecRollover: () => {
    set((s) => {
      if (s.dec_last_day !== s.game_day && (s.dec_today_deonto || s.dec_today_mission)) {
        // Si on a sauté un jour sans rien faire → streak reset
        const skipped = s.game_day - s.dec_last_day > 1;
        return {
          dec_today_deonto: false,
          dec_today_mission: false,
          dec_streak: skipped ? 0 : s.dec_streak,
        };
      }
      return {} as any;
    });
  },
}));
