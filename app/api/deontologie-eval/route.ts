import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/api-key";

export const dynamic = "force-dynamic";

interface Question {
  id: string;
  type: string;
  question: string;
  options?: string[];
  correct?: number[];
  correct_mots_cles?: string[];
  explication: string;
  theme: string;
  categorie: string;
}

interface Reponse {
  question_id: string;
  selected?: number[];
  texte?: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { questions, reponses }: { questions: Question[]; reponses: Reponse[] } = body;

  const apiKey = getApiKey(req);

  const detail: Array<{
    question_id: string;
    question: string;
    type: string;
    theme: string;
    points_obtenus: number;
    points_max: number;
    is_correct: boolean;
    explication: string;
    feedback: string;
  }> = [];

  let total_points = 0;
  let total_max = 0;

  for (const q of questions) {
    const rep = reponses.find(r => r.question_id === q.id);
    let points = 0;
    const max = 1;
    let is_correct = false;
    let feedback = "Pas de réponse";

    if (rep) {
      if (q.type === "qcm_simple" || q.type === "vrai_faux") {
        // Une seule bonne réponse
        const correctSet = new Set(q.correct || []);
        const selectedSet = new Set(rep.selected || []);
        is_correct = correctSet.size === selectedSet.size && [...correctSet].every(c => selectedSet.has(c));
        points = is_correct ? 1 : 0;
        feedback = is_correct ? "Correct" : `Mauvaise réponse. ${q.explication}`;
      } else if (q.type === "qcm_multiple") {
        // Plusieurs bonnes réponses : score partiel possible
        const correctSet = new Set(q.correct || []);
        const selectedSet = new Set(rep.selected || []);
        const truePositives = [...selectedSet].filter(s => correctSet.has(s)).length;
        const falsePositives = [...selectedSet].filter(s => !correctSet.has(s)).length;
        const falseNegatives = [...correctSet].filter(c => !selectedSet.has(c)).length;
        // Score = (TP - FP) / total bonnes, plancher 0
        const raw = (truePositives - falsePositives) / Math.max(1, correctSet.size);
        points = Math.max(0, Math.min(1, raw));
        is_correct = points >= 0.99;
        feedback = is_correct
          ? "Toutes les bonnes réponses cochées"
          : falseNegatives > 0
          ? `Réponse incomplète (${falseNegatives} bonne(s) réponse(s) manquée(s)). ${q.explication}`
          : `${falsePositives} fausse(s) coche(s). ${q.explication}`;
      } else if (q.type === "qrc") {
        // QRC : on regarde présence des mots clés dans la réponse texte
        const txt = (rep.texte || "").toLowerCase();
        const motsCles = q.correct_mots_cles || [];
        const hits = motsCles.filter(m => txt.includes(m.toLowerCase())).length;
        const requis = Math.ceil(motsCles.length * 0.4); // 40% des mots clés
        points = Math.min(1, hits / Math.max(1, requis));
        is_correct = points >= 0.7;
        feedback = is_correct
          ? `Très bien (${hits} mot(s) clé(s) identifiés sur ${motsCles.length})`
          : `Réponse incomplète : ${hits}/${motsCles.length} mots clés. ${q.explication}`;
      }
    } else {
      feedback = `Non répondu. ${q.explication}`;
    }

    total_points += points;
    total_max += max;
    detail.push({
      question_id: q.id,
      question: q.question,
      type: q.type,
      theme: q.theme,
      points_obtenus: points,
      points_max: max,
      is_correct,
      explication: q.explication,
      feedback,
    });
  }

  const score_20 = Math.round((total_points / Math.max(1, total_max)) * 20 * 10) / 10;
  const pct = Math.round((total_points / Math.max(1, total_max)) * 100);

  // Impact gameplay selon ton cahier des charges
  let impact_legitimite = 0;
  let badge: string | null = null;
  if (score_20 >= 18) { impact_legitimite = 8; badge = "Déontologue d'or"; }
  else if (score_20 >= 14) impact_legitimite = 5;
  else if (score_20 >= 10) impact_legitimite = 2;
  else if (score_20 >= 8) impact_legitimite = -3;
  else if (score_20 < 6) impact_legitimite = -15;

  const xp_gagne = Math.round(score_20 * 3);

  // Synthèse Claude si dispo
  let synthese = "";
  if (apiKey) {
    try {
      const themesEchoues = detail.filter(d => !d.is_correct).map(d => d.theme);
      const themesEchecsUniques = Array.from(new Set(themesEchoues));
      const prompt = `Examinateur DEC déontologie. Synthèse 2 phrases (max 40 mots) du score ${score_20}/20.
Thèmes faibles : ${themesEchecsUniques.join(", ") || "aucun"}.
Style direct, examinateur. Pas d'intro.`;
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (r.ok) {
        const d = await r.json();
        synthese = d.content?.[0]?.text?.trim() || "";
      }
    } catch {}
  }

  if (!synthese) {
    if (score_20 >= 18) synthese = "Excellence déontologique confirmée. Tu maîtrises le code OEC et la NEP. Tu signerais sans risque demain.";
    else if (score_20 >= 14) synthese = "Bon socle déontologique. Quelques approximations à corriger sur les détails procéduraux.";
    else if (score_20 >= 10) synthese = "Bases présentes mais fragiles. Révise les articles clés et les seuils chiffrés.";
    else synthese = "Niveau insuffisant pour un EC associé. Reprends les fondamentaux : ordonnance 1945, NEP, code de déontologie.";
  }

  return NextResponse.json({
    score_20,
    pct,
    total_points: Math.round(total_points * 10) / 10,
    total_max,
    detail,
    impact_legitimite,
    badge,
    xp_gagne,
    synthese,
  });
}
