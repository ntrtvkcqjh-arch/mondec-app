import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/api-key";
import { callAnthropic } from "@/lib/anthropic-helper";

export const dynamic = "force-dynamic";

interface TaskErreur {
  ligne_index: number;
  description: string;
  reference_legale: string;
  correction: string;
}

export async function POST(req: NextRequest) {
  const apiKey = getApiKey(req);
  const body = await req.json();
  const {
    task,
    decision, // "valider" | "refuser" | "deleguer"
    lignes_signalees, // array of line indexes the player flagged
    note_correction,
    ecriture_proposee, // { debit_compte, credit_compte, montant, libelle }
  } = body;

  const erreurs: TaskErreur[] = task?.erreurs || [];
  const indicesErreursReelles = new Set<number>(erreurs.map((e) => e.ligne_index));
  const indicesSignales = new Set<number>(lignes_signalees || []);

  // Évaluation déterministe (toujours fonctionnelle)
  const erreurs_trouvees: TaskErreur[] = [];
  const erreurs_manquees: TaskErreur[] = [];
  const fausses_alertes: number[] = [];

  erreurs.forEach((e) => {
    if (indicesSignales.has(e.ligne_index)) erreurs_trouvees.push(e);
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

  // Bonus / malus selon la décision
  if (decision === "valider" && erreurs.length > 0) score -= 25; // a validé un doc avec erreurs
  if (decision === "refuser" && erreurs.length === 0) score -= 15; // a refusé un doc OK
  if (decision === "refuser" && erreurs.length > 0) score += 10; // bonne décision
  if (decision === "deleguer") score += 0; // neutre

  // Évaluation écriture si fournie
  let ecriture_eval: { ok: boolean; feedback: string } | null = null;
  if (decision === "refuser" && ecriture_proposee && task?.ecriture_correction) {
    const ec = task.ecriture_correction;
    const debitOk = String(ecriture_proposee.debit_compte || "").trim().startsWith(String(ec.debit_compte).substring(0, 2));
    const creditOk = String(ecriture_proposee.credit_compte || "").trim().startsWith(String(ec.credit_compte).substring(0, 2));
    const montantOk = Math.abs((Number(ecriture_proposee.montant) || 0) - ec.montant) < ec.montant * 0.1;
    const allOk = debitOk && creditOk && montantOk;
    ecriture_eval = {
      ok: allOk,
      feedback: allOk
        ? `Écriture correcte. Référence : ${ec.debit_compte} / ${ec.credit_compte} pour ${ec.montant}€. Libellé : "${ec.libelle}"`
        : `Écriture imprécise. Réponse attendue : Débit ${ec.debit_compte} / Crédit ${ec.credit_compte} / ${ec.montant}€ / "${ec.libelle}"`,
    };
    if (allOk) score += 5;
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

      const prompt = `Tu es un **examinateur DEC senior**, 50 ans d'expérience en cabinet d'expertise comptable français. Tu corriges la copie d'un candidat sur un document comptable.

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
- Indique si le candidat l'a "trouvée" (ligne signalée + mentionnée correctement dans sa note), "manquée" (non signalée OU mal traitée), ou si la ligne signalée est une "fausse alerte" (ligne flaguée sans erreur).
- Cite la source réglementaire EXACTE (article CGI, PCG, BOFiP, IFRS, BOI-numéro, etc.) — comme un vrai EC le ferait.
- Donne la correction expert : raisonnement complet, écriture comptable si pertinent, jurisprudence ou doctrine si applicable.
- Commente la performance du candidat sur ce point précis (ce qu'il a bien vu / mal compris / oublié).

Note la note rédigée sur 20 selon : qualité des références citées, vocabulaire EC, rigueur du raisonnement, complétude.

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
    ecriture_eval,
    feedback_general,
    impact_legitimite,
    xp_gagne,
  });
}
