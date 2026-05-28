import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/api-key";

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

  // Si une clé API est dispo, on demande à Claude un feedback narratif court
  let feedback_general = "";
  if (apiKey) {
    try {
      const prompt = `Tu es un examinateur DEC. Tu évalues la validation d'un document comptable.
DOCUMENT : ${task.titre} (${task.branche})
ERREURS PRÉSENTES : ${erreurs.length}
ERREURS TROUVÉES PAR LE JOUEUR : ${erreurs_trouvees.length}
ERREURS MANQUÉES : ${erreurs_manquees.length}
FAUSSES ALERTES : ${fausses_alertes.length}
DÉCISION : ${decision}
NOTE DE CORRECTION DU JOUEUR : "${note_correction || "(rien)"}"
SCORE FINAL : ${score}/100

Écris 1 phrase d'évaluation directe et pédagogique (max 25 mots, ton examinateur DEC). Pas d'introduction.`;
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 150,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (r.ok) {
        const d = await r.json();
        feedback_general = d.content?.[0]?.text?.trim() || "";
      }
    } catch {}
  }

  if (!feedback_general) {
    if (score >= 80) feedback_general = "Œil expert confirmé. Toutes les erreurs critiques relevées avec les bons textes.";
    else if (score >= 50) feedback_general = "Travail correct mais perfectible. Certaines erreurs ont été manquées.";
    else feedback_general = "Validation insuffisante. Erreurs importantes manquées — relire les textes applicables.";
  }

  return NextResponse.json({
    score,
    erreurs_trouvees,
    erreurs_manquees,
    fausses_alertes,
    note_score,
    ecriture_eval,
    feedback_general,
    impact_legitimite,
    xp_gagne,
  });
}
