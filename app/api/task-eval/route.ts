import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/api-key";
import { callAnthropic } from "@/lib/anthropic-helper";
import { getToneInstructions } from "@/lib/tone-helper";

export const dynamic = "force-dynamic";

interface TaskErreur {
  ligne_index: number;
  description: string;
  reference_legale: string;
  correction: string;
}

type DecisionAnomalie = "corriger" | "refuser" | "valider_quand_meme";

export async function POST(req: NextRequest) {
  const apiKey = getApiKey(req);
  const body = await req.json();
  const {
    task,
    decision, // "valider" | "refuser" | "deleguer"
    lignes_signalees, // array of line indexes the player flagged
    note_correction,
    ecriture_proposee, // { debit_compte, credit_compte, montant, libelle }
    decisions_par_anomalie, // Record<ligne_index, DecisionAnomalie> — mode revue rapide
    player_level, // niveau de la joueuse (1-10) pour adaptation du ton
  } = body;

  const erreurs: TaskErreur[] = task?.erreurs || [];
  const indicesErreursReelles = new Set<number>(erreurs.map((e) => e.ligne_index));
  const indicesSignales = new Set<number>(lignes_signalees || []);
  const decisionsAnomalies: Record<number, DecisionAnomalie> = decisions_par_anomalie || {};

  // Évaluation déterministe (toujours fonctionnelle)
  const erreurs_trouvees: TaskErreur[] = [];
  const erreurs_manquees: TaskErreur[] = [];
  const fausses_alertes: number[] = [];

  erreurs.forEach((e) => {
    // Une anomalie est "trouvée" si la ligne est flaggée OU si elle a une décision (revue rapide)
    const hasDecision = decisionsAnomalies[e.ligne_index] !== undefined;
    if (indicesSignales.has(e.ligne_index) || hasDecision) erreurs_trouvees.push(e);
    else erreurs_manquees.push(e);
  });
  indicesSignales.forEach((idx) => {
    if (!indicesErreursReelles.has(idx)) fausses_alertes.push(idx);
  });

  // Calcul score
  let score = 50;
  score += erreurs_trouvees.length * 20;
  score -= erreurs_manquees.length * 30;
  score -= fausses_alertes.length * 10;

  // Mode revue rapide : impact par décision/anomalie
  // - Corriger : +15 (geste expert, on règle direct)
  // - Refuser : +10 (on renvoie au collaborateur, formation)
  // - Valider malgré tout : -25 (risque fiscal pris en connaissance de cause)
  let decisions_recap: Array<{ ligne_index: number; description: string; decision: DecisionAnomalie; impact_score: number; consequence: string }> = [];
  Object.entries(decisionsAnomalies).forEach(([ligneIdxStr, dec]) => {
    const ligneIdx = parseInt(ligneIdxStr);
    const err = erreurs.find((e) => e.ligne_index === ligneIdx);
    if (!err) return;
    let impact = 0;
    let consequence = "";
    if (dec === "corriger") { impact = 15; consequence = "Tu as corrigé direct — pro mais coûte de ton temps."; }
    else if (dec === "refuser") { impact = 10; consequence = "Renvoyé au collaborateur — il apprend, mais retard de 24h."; }
    else if (dec === "valider_quand_meme") { impact = -25; consequence = "⚠ Risque fiscal pris en connaissance de cause."; }
    score += impact;
    decisions_recap.push({ ligne_index: ligneIdx, description: err.description, decision: dec, impact_score: impact, consequence });
  });

  // Bonus / malus selon la décision globale
  if (decision === "valider" && erreurs.length > 0) score -= 25; // a validé un doc avec erreurs
  if (decision === "refuser" && erreurs.length === 0) score -= 15; // a refusé un doc OK
  if (decision === "refuser" && erreurs.length > 0) score += 10; // bonne décision
  if (decision === "deleguer") score += 0; // neutre

  // Évaluation écriture si fournie. Tolérance élargie :
  //  - racine compte (2 premiers chiffres) OK (44/65/70/40…)
  //  - comptes alternatifs valides acceptés (ex : 658 OU 707 pour reg. TVA)
  //  - montant ± 10%
  //  - coquilles de saisie (8 chiffres ≈ même montant) tolérées comme "imprécision"
  let ecriture_eval: { ok: boolean; feedback: string } | null = null;
  if (decision === "refuser" && ecriture_proposee && task?.ecriture_correction) {
    const ec = task.ecriture_correction;
    const VALID_ALTS: Record<string, string[]> = {
      // Pour redressement TVA collectée
      "707": ["707", "658", "7588", "777"],
      "658": ["658", "707", "7588", "777"],
      // TVA à décaisser / collectée
      "44571": ["44571", "4457", "44551"],
      "4457": ["4457", "44571", "44551"],
      // Autres comptes de produits / charges génériques
      "606": ["606", "607", "608"],
      "401": ["401", "404"],
      "411": ["411", "416", "418"],
    };
    function compteMatch(saisi: string, attendu: string): boolean {
      const s = String(saisi || "").trim();
      const a = String(attendu).trim();
      if (!s) return false;
      // Racine 2 chiffres
      if (s.substring(0, 2) === a.substring(0, 2)) return true;
      // Alternatives reconnues
      const alts = VALID_ALTS[a];
      if (alts && alts.some((alt) => s.startsWith(alt.substring(0, 3)))) return true;
      return false;
    }
    const debitOk = compteMatch(ecriture_proposee.debit_compte, ec.debit_compte);
    const creditOk = compteMatch(ecriture_proposee.credit_compte, ec.credit_compte);
    const saisi = Number(ecriture_proposee.montant) || 0;
    const ecart = Math.abs(saisi - ec.montant);
    const montantOk = ecart < ec.montant * 0.1;
    // Détection coquille : montants très proches mais pas exacts (ex 4580 vs 4850)
    const isCoquille = !montantOk && ecart < ec.montant * 0.2 && saisi.toString().length === ec.montant.toString().length;
    const allOk = debitOk && creditOk && (montantOk || isCoquille);
    ecriture_eval = {
      ok: allOk,
      feedback: allOk
        ? (isCoquille
          ? `Écriture validée avec réserve : raisonnement correct mais coquille de saisie (${saisi} → ${ec.montant}). Comptes ${ec.debit_compte} / ${ec.credit_compte} acceptés.`
          : `Écriture correcte. Référence : ${ec.debit_compte} / ${ec.credit_compte} pour ${ec.montant}€. Libellé : "${ec.libelle}"`)
        : `Écriture imprécise. Réponse attendue : Débit ${ec.debit_compte} / Crédit ${ec.credit_compte} / ${ec.montant}€ / "${ec.libelle}"`,
    };
    if (allOk && !isCoquille) score += 5;
    else if (isCoquille) score += 2;
    else score -= 10;
  }

  score = Math.max(0, Math.min(100, score));

  // Note du texte de correction si fournie
  let note_score = 0;
  if (note_correction && note_correction.length > 30) {
    const txt = note_correction.toLowerCase();
    const refs = ["cgi", "pcg", "ifrs", "ias", "crc", "bofip", "art.", "article"];
    const hits = refs.filter(r => txt.includes(r)).length;
    note_score = Math.min(20, hits * 5 + Math.floor(note_correction.length / 50));
  }
  score = Math.min(100, score + note_score);

  // Impacts
  const impact_legitimite = score >= 80 ? 10 : score < 50 ? -15 : 0;
  const xp_gagne = Math.round(score / 5) + erreurs_trouvees.length * 5;

  // Si une clé API dispo, Claude lit vraiment la note du joueur ET donne un corrigé
  // détaillé par anomalie comme un examinateur DEC senior.
  let feedback_general = "";
  let analyse_note: string | null = null;
  let note_score_claude: number | null = null;
  // Corrigé détaillé par anomalie : pour chaque erreur, ce que le candidat a vu/loupé + correction expert
  let corrige_par_anomalie: Array<{
    titre: string;
    statut: "trouvée" | "manquée" | "fausse alerte";
    source: string;
    correction_expert: string;
    commentaire_perso: string;
  }> = [];

  if (apiKey && (note_correction?.length > 0 || (lignes_signalees || []).length > 0 || decision)) {
    try {
      const erreursRecap = erreurs.map(e =>
        `L${e.ligne_index + 1} — ${e.description} | Source : ${e.reference_legale} | Correction officielle : ${e.correction}`
      ).join("\n");
      const lignesDocument = (task.lignes || []).map((l: any, i: number) =>
        `L${i + 1} : ${l.label} = ${l.valeur}`
      ).join("\n");
      const lignesFlaggees = (lignes_signalees || []).map((i: number) => `L${i + 1}`).join(", ") || "Aucune";

      const tone = getToneInstructions(player_level || 1, { role: "examinateur" });
      const prompt = `${tone.systemBlock}

Tu es un **examinateur DEC senior**, 50 ans d'expérience en cabinet d'expertise comptable français. Tu corriges la copie d'un candidat sur un document comptable.

# DOCUMENT EXAMINÉ
Titre : ${task.titre}
Branche : ${task.branche}
Contexte : ${task.contexte}

# LIGNES DU DOCUMENT
${lignesDocument}

# ANOMALIES OBJECTIVES À DÉTECTER (vérité terrain)
${erreursRecap || "Aucune anomalie — le document est correct."}

# CE QU'A FAIT LE CANDIDAT
- Lignes signalées : ${lignesFlaggees}
- Décision : ${decision || "Aucune"}
- Note rédigée :
"""
${note_correction || "(le candidat n'a pas rédigé de note)"}
"""
- Écriture proposée : ${ecriture_proposee ? JSON.stringify(ecriture_proposee) : "Aucune"}

# TA MISSION
Tu produis un corrigé DÉTAILLÉ. Pour chaque anomalie objective listée ci-dessus :

⚠️ RÈGLE DE NOTATION CLÉ — LIRE LA NOTE DU CANDIDAT :
- Une anomalie est "trouvée" si :
  1. Le candidat a signalé la ligne, OU
  2. Sa NOTE rédigée mentionne explicitement la nature du problème (même sans terme exact),
     OU encore explique le bon raisonnement même imparfaitement.
- Une note explicative est TOUJOURS un PLUS, jamais une faute en elle-même.
- Si le candidat propose un compte alternatif valide (ex : 658 au lieu de 707 pour
  un redressement de TVA collectée), considère l'écriture comme CORRECTE et explique
  juste pourquoi un compte est préférable — NE compte PAS ça comme erreur.
- Si le calcul du candidat est juste (montant ± 5% du correct) mais transcrit avec
  une coquille (4 580 au lieu de 4 850), signale-le comme "imprécision de saisie",
  pas comme "erreur de raisonnement".
- "manquée" = vraiment ni signalée ni évoquée dans la note.
- "fausse alerte" = ligne flaggée alors qu'AUCUNE erreur n'existe ET que la note ne
  justifie pas pourquoi le candidat a flaggé.

Cite la source réglementaire EXACTE (article CGI, PCG, BOFiP, IFRS, BOI-numéro, etc.).
Donne la correction expert : raisonnement complet, écriture comptable si pertinent, jurisprudence ou doctrine si applicable.
Commente la performance du candidat sur ce point précis (ce qu'il a bien vu / mal compris / oublié).

Note la note rédigée sur 20 selon : qualité des références citées, vocabulaire EC, rigueur du raisonnement, complétude.
Si la note explique correctement le sujet et cite des sources : minimum 14/20.
Si elle propose une alternative valide même non standard : minimum 16/20.

# FORMAT DE RÉPONSE (JSON STRICT, rien d'autre)
{
  "note_sur_20": <nombre 0-20>,
  "synthese": "<verdict examinateur en 1 phrase, max 25 mots, ton sec et professionnel>",
  "analyse_detaillee": "<3-6 phrases : ton expert qui pèse les forces/faiblesses, cite les vraies références, donne un conseil pour progresser>",
  "corrige_par_anomalie": [
    {
      "titre": "<intitulé court de l'anomalie>",
      "statut": "trouvée" | "manquée" | "fausse alerte",
      "source": "<référence légale exacte : art. X CGI ou BOI-... ou PCG art. ...>",
      "correction_expert": "<correction complète comme un EC chevronné l'écrirait, 2-4 phrases>",
      "commentaire_perso": "<ce que le candidat a bien fait ou loupé sur ce point, 1-2 phrases>"
    }
  ]
}`;

      const r = await callAnthropic(apiKey, {
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });
      if (r.ok) {
        const text = r.data.content?.[0]?.text || "";
        // Extraction robuste : enlève les éventuels backticks ```json ... ```
        const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*$/g, "");
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            const parsed = JSON.parse(m[0]);
            analyse_note = parsed.analyse_detaillee || null;
            feedback_general = parsed.synthese || "";
            if (Array.isArray(parsed.corrige_par_anomalie)) {
              corrige_par_anomalie = parsed.corrige_par_anomalie;
            }
            if (typeof parsed.note_sur_20 === "number") {
              note_score_claude = parsed.note_sur_20;
              // Remplace le score_note déterministe par celui de Claude (plus juste)
              score = score - note_score; // retire l'ancien bonus
              score = Math.min(100, Math.max(0, score + note_score_claude));
            }
          } catch (e) {
            console.error("[task-eval] JSON parse failed:", e);
          }
        } else {
          console.error("[task-eval] No JSON in response");
        }
      }
    } catch (e) {
      console.error("[task-eval] Claude call failed:", e);
    }
  }

  if (!feedback_general) {
    if (score >= 80) feedback_general = "Œil expert confirmé. Erreurs critiques relevées avec les bons textes.";
    else if (score >= 50) feedback_general = "Travail correct mais perfectible. Certaines erreurs manquées.";
    else feedback_general = "Validation insuffisante. Erreurs importantes manquées — relire les textes applicables.";
  }

  return NextResponse.json({
    score,
    erreurs_trouvees,
    erreurs_manquees,
    fausses_alertes,
    note_score,
    note_score_claude,
    analyse_note,
    corrige_par_anomalie,
    decisions_recap,
    ecriture_eval,
    feedback_general,
    impact_legitimite,
    xp_gagne,
  });
}
