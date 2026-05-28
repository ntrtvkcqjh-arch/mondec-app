import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/api-key";

export const dynamic = "force-dynamic";

interface Etape {
  numero: number;
  label: string;
  points_max: number;
  consigne: string;
  mots_cles_attendus: string[];
}

interface MissionEtapeReponse {
  numero: number;
  texte: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { mission, reponses }: { mission: any; reponses: MissionEtapeReponse[] } = body;
  const apiKey = getApiKey(req);

  const etapes: Etape[] = mission?.etapes || [];

  // Évaluation par étape (mots-clés)
  const detail: Array<{
    numero: number;
    label: string;
    points_obtenus: number;
    points_max: number;
    mots_cles_trouves: number;
    mots_cles_total: number;
    feedback: string;
    correction_style: string | null;
  }> = [];

  let total = 0;
  let total_max = 0;

  for (const etape of etapes) {
    const rep = reponses.find(r => r.numero === etape.numero);
    const txt = (rep?.texte || "").toLowerCase();
    const motsCles = etape.mots_cles_attendus || [];
    const hits = motsCles.filter(m => txt.includes(m.toLowerCase())).length;

    // Score : ratio mots-clés trouvés × points_max, avec malus si texte trop court
    const ratio = motsCles.length > 0 ? hits / motsCles.length : 0;
    let points = ratio * etape.points_max;

    // Bonus longueur (rédaction étoffée)
    if (txt.length > 200) points += 0.5;
    if (txt.length > 500) points += 0.5;
    if (txt.length < 50) points = Math.min(points, etape.points_max * 0.4); // pénalité texte vide

    points = Math.max(0, Math.min(etape.points_max, points));

    let feedback = "";
    if (points >= etape.points_max * 0.85) feedback = "Méthode DEC bien appliquée. Vocabulaire technique présent.";
    else if (points >= etape.points_max * 0.6) feedback = `Bonnes pistes mais quelques mots-clés manquants (${hits}/${motsCles.length}).`;
    else if (points >= etape.points_max * 0.4) feedback = `Réponse partielle. Manquent : ${motsCles.filter(m => !txt.includes(m.toLowerCase())).slice(0, 3).join(", ")}.`;
    else feedback = `Insuffisant. Vocabulaire DEC absent. Termes attendus : ${motsCles.slice(0, 5).join(", ")}.`;

    // Correction de style si réponse contient des tournures non-EC
    const tournures = [
      { mauvais: "je pense que", bon: "il apparaît que" },
      { mauvais: "c'est mal", bon: "la procédure ne permet pas de garantir" },
      { mauvais: "le client a triché", bon: "des écarts significatifs ont été identifiés" },
      { mauvais: "j'ai vu", bon: "j'ai constaté lors de ma mission" },
      { mauvais: "il faut faire", bon: "je recommande à la direction de procéder à" },
      { mauvais: "c'est faux", bon: "ne reflète pas la réalité économique" },
    ];
    const corrections: string[] = [];
    tournures.forEach(t => {
      if (txt.includes(t.mauvais)) corrections.push(`« ${t.mauvais} » → « ${t.bon} »`);
    });
    const correction_style = corrections.length > 0 ? corrections.join(" · ") : null;

    detail.push({
      numero: etape.numero,
      label: etape.label,
      points_obtenus: Math.round(points * 10) / 10,
      points_max: etape.points_max,
      mots_cles_trouves: hits,
      mots_cles_total: motsCles.length,
      feedback,
      correction_style,
    });

    total += points;
    total_max += etape.points_max;
  }

  const score_pct = Math.round((total / Math.max(1, total_max)) * 100);
  const score_20 = Math.round((total / Math.max(1, total_max)) * 20 * 10) / 10;

  // Impacts gameplay (mission = coefficient 3)
  let impact_legitimite = 0;
  if (score_pct >= 80) impact_legitimite = 12;
  else if (score_pct >= 60) impact_legitimite = 6;
  else if (score_pct >= 40) impact_legitimite = 0;
  else impact_legitimite = -10;

  const xp_gagne = Math.round(score_pct / 2);

  // Synthèse Claude
  let synthese = "";
  if (apiKey) {
    try {
      const etapesFaibles = detail.filter(d => d.points_obtenus < d.points_max * 0.5).map(d => d.label);
      const prompt = `Examinateur DEC mission "${mission.titre}". Score global ${score_20}/20.
Étapes faibles : ${etapesFaibles.join(", ") || "aucune"}.
Synthèse 2 phrases max (40 mots), ton examinateur. Pas d'intro.`;
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
    if (score_pct >= 80) synthese = "Mission maîtrisée. Méthode DEC bien appliquée, opinion fondée.";
    else if (score_pct >= 60) synthese = "Travail correct mais perfectible. Soigne la rédaction sur les étapes faibles.";
    else if (score_pct >= 40) synthese = "Méthode partielle. Reprends les NEP et le vocabulaire EC.";
    else synthese = "Niveau insuffisant pour valider la mission. Reprends étape par étape.";
  }

  return NextResponse.json({
    score_pct,
    score_20,
    total: Math.round(total * 10) / 10,
    total_max,
    detail,
    impact_legitimite,
    xp_gagne,
    synthese,
  });
}
