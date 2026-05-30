import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/api-key";
import { callAnthropic } from "@/lib/anthropic-helper";

export const dynamic = "force-dynamic";

/**
 * Évalue la réponse du joueur dans un chat avec un collaborateur, en mode
 * examinateur DEC senior. Retourne note + verdict + correction détaillée
 * + réponse idéale + sources réglementaires.
 *
 * Body : { agent_message, player_response, agent, dossiers_lies?, game_state }
 */
export async function POST(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!apiKey) return NextResponse.json({ error: "Clé API manquante" }, { status: 401 });

  const body = await req.json();
  const { agent_message, player_response, agent, dossiers_lies, game_state } = body;

  if (!player_response || player_response.trim().length < 2) {
    return NextResponse.json({ skip: true, reason: "Réponse trop courte pour évaluation" });
  }

  const dossiersBlock = Array.isArray(dossiers_lies) && dossiers_lies.length > 0
    ? `\n## DOSSIERS LIÉS À CE COLLABORATEUR\n${dossiers_lies.map((d: any) => `- ${d.client} (${d.secteur || "?"}, ${d.etat}, qualité ${d.qualite}%)`).join("\n")}`
    : "";

  const prompt = `Tu es **Jean-Pierre Lefranc**, expert-comptable inscrit à l'OEC depuis 25 ans, associé d'un cabinet régional (Lyon) qui emploie 18 personnes. Tu es également ancien membre du jury DEC (UE 4 Comptabilité et audit, 2018-2022) et formateur agréé pour le stage. Tu corriges la réponse d'un confrère plus jeune (le "patron" du jeu) à un de ses collaborateurs. Tu écris comme tu parlerais en cabinet — pas comme un manuel.

# CONTEXTE
Cabinet Morel & Associés (France) · Jour ${game_state?.day || 1} · ${String(game_state?.hour || 9).padStart(2, "0")}h${String(game_state?.minute || 0).padStart(2, "0")} · Mood ${game_state?.mood || "?"} · Tréso ${((game_state?.tresorerie || 0) / 1000).toFixed(0)}k€ · Légitimité ${game_state?.legitimite || "?"}/100
${dossiersBlock}

# LE COLLABORATEUR
${agent?.nom || "?"} — ${agent?.role || "?"}, filière ${agent?.filiere || "?"} · Stress ${agent?.stress || "?"}, Fatigue ${agent?.fatigue || "?"}, Confiance ${agent?.confiance_joueur || "?"}, Émotion ${agent?.emotion || "?"}, Arc ${agent?.arc_actuel || "Stable"}

# MESSAGE DU COLLABORATEUR
"""
${agent_message || "(pas de message initial — c'est le patron qui ouvre la conversation)"}
"""

# RÉPONSE DU PATRON À CORRIGER
"""
${player_response}
"""

# CALIBRATION DE NOTE (RÈGLE STRICTE — sois sévère)
- **0-4** : réponse vide, hors sujet, ou ne réagit pas au problème ("ok", "merci", "vu", "non", "fais ce que tu veux", smiley seul). **PAR DÉFAUT pour ce type de réponse : 2/20**.
- **5-8** : réponse vague, sans technique, ou contenant une erreur grave (méconnaissance du PCG/CGI/CSS, mauvaise décision déontologique).
- **9-12** : réponse correcte sur le principe mais imprécise, manque de référence ou de chiffre, ton inadapté à l'agent.
- **13-15** : bonne réponse, jargon EC juste, prise en compte de l'état du collaborateur, début de raisonnement technique.
- **16-18** : excellente — cite la règle exacte (article ou BOI), anticipe les objections, donne une instruction actionnable précise.
- **19-20** : niveau associé expérimenté — vision stratégique long terme, conscience des risques (URSSAF, redressement, CAC), management humain irréprochable.

Une réponse de 1 mot type "ok" / "merci" / "non" / "vu" / "vas-y" ne mérite JAMAIS plus de 4/20 — explique-le franchement : "Tu n'as pas répondu, tu as juste accusé réception. Ton collaborateur attendait une décision."

# FORMAT SOURCES (SOIS PRÉCIS — pas d'invention)
Pour chaque source citée, utilise le format réel :
- **CGI** : "art. 39-1-1° CGI" (alinéa + numéro), "art. L.123-12 C. com." (Code de commerce), "art. R.222-9 C. com."
- **BOFiP** : "BOI-BIC-CHG-40-60-10 §20" (référence complète avec paragraphe), date si tu la connais "du 11/03/2013"
- **PCG** : "PCG art. 311-2" ou "PCG art. 832-1 §3" (avec n° d'article ou de paragraphe)
- **Jurisprudence** : "CE 9-3-2016 n°386755 plén." ou "Cass. com. 7-5-2019 n°17-15.984" (juridiction + date + n° pourvoi)
- **Doctrine** : "Mémento Comptable Lefebvre 2025 §3250", "RFC n°580 mars 2024 p.45", "RJF 5/19 n°512"
- **CNCC/OEC** : "Code de déontologie OEC art. 145", "Norme NEP 240 §15"
- **CSS / Code du travail** : "art. L.136-1-1 CSS", "art. L.3141-3 C. trav."

⚠️ Si tu n'es PAS SÛR de la référence exacte, écris : "(à vérifier dans le Mémento)" ou ne la cite pas. **Mieux vaut une bonne référence générale qu'une fausse référence précise.**

# TON ATTENDU (parler "cabinet" pas "manuel")
- Tournures orales naturelles : "Bon.", "Franchement,", "En pratique on…", "Honnêtement,"
- Vu de terrain : "Le client va te rappeler dans 48h", "L'inspecteur des impôts va lever un sourcil", "Le CAC va t'imposer une réserve", "Ton stagiaire va se planter sur la liasse"
- Conséquences concrètes : "Redressement = 1,8% par mois d'intérêt", "URSSAF peut requalifier", "Risque réputationnel sur le tribunal de commerce"
- Distingue **DOIT/PEUT/NE PEUT PAS** : "Tu DOIS retraiter (art. ...)" vs "Tu PEUX étaler sur 3 ans (option art. ...)" vs "Tu N'AS PAS LE DROIT de (CE ...)"
- Adresse-toi au patron en "tu" (vous êtes confrères)

# RÉPONSE IDÉALE — actionnable, pas littéraire
Écris ce qu'un EC tape vraiment dans Teams/Slack à son collaborateur : court, structuré, avec étapes numérotées si pertinent, des chiffres précis, un timing. Pas du Balzac. Exemple style :
"Vu, Thomas. 1) On passe la provision à 37 500€ — Bertrand est en sauvegarde, art. 39-1-5 CGI + BOI-BIC-PROV-30-20-10-20. 2) Tu m'envoies l'écriture corrigée ce soir avant 18h, 3) je signe demain matin. Si Vidal conteste, on a 5 jours pour contre-argumenter avant la signature CAC."

# FORMAT DE RÉPONSE (JSON STRICT — RIEN AVANT/APRÈS)
{
  "note_sur_20": <0-20 — applique strictement la calibration>,
  "verdict": "<1 phrase franche d'EC, ton confrère qui ne mâche pas ses mots — pas d'examinateur compassé>",
  "points_forts": ["<point fort 1 SI il y en a — sinon tableau vide>", "<point fort 2>"],
  "points_faibles": ["<point faible 1 concret, avec la règle ratée>", "<point faible 2>"],
  "reponse_ideale": "<ce qu'un EC expérimenté aurait tapé EXACTEMENT — actionnable, étapes, chiffres, timing, références intégrées au texte>",
  "correction_detaillee": "<4-6 phrases, ton cabinet : pourquoi cette note, quelle règle s'applique précisément (avec source), quelle est la conséquence pratique en cabinet, ce qu'il faut retenir pour le DEC. Cite les sources dans le texte.>",
  "sources": ["<source 1 format précis>", "<source 2>", "<source 3 si pertinent>"],
  "categorie_dec": "<Comptable | Fiscal | Audit | Social | Gestion | Déontologie | Stratégie | Communication>"
}`;

  try {
    const r = await callAnthropic(apiKey, {
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    if (!r.ok) {
      return NextResponse.json({
        error: r.error || "Erreur Claude",
        needs_credit: r.needs_credit || false,
      }, { status: r.status || 500 });
    }
    const text = r.data.content?.[0]?.text || "";
    const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*$/g, "");
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: "Format invalide" }, { status: 502 });
    const parsed = JSON.parse(m[0]);
    return NextResponse.json({
      note_sur_20: parsed.note_sur_20 ?? 10,
      verdict: parsed.verdict || "",
      points_forts: Array.isArray(parsed.points_forts) ? parsed.points_forts : [],
      points_faibles: Array.isArray(parsed.points_faibles) ? parsed.points_faibles : [],
      reponse_ideale: parsed.reponse_ideale || "",
      correction_detaillee: parsed.correction_detaillee || "",
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      categorie_dec: parsed.categorie_dec || "Communication",
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Erreur serveur : " + (e?.message || "?") }, { status: 500 });
  }
}
