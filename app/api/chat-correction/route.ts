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

  const prompt = `Tu es un **examinateur DEC senior**, expert-comptable diplômé avec 50 ans d'expérience en cabinet. Tu corriges la réponse du candidat à un message d'un collaborateur du cabinet.

# CONTEXTE DU CABINET
- Cabinet Morel & Associés (France)
- Date : Jour ${game_state?.day || 1} · ${String(game_state?.hour || 9).padStart(2, "0")}h${String(game_state?.minute || 0).padStart(2, "0")}
- Mood : ${game_state?.mood || "?"}
- Trésorerie : ${((game_state?.tresorerie || 0) / 1000).toFixed(0)}k€
- Légitimité du patron : ${game_state?.legitimite || "?"}/100
${dossiersBlock}

# LE COLLABORATEUR
- ${agent?.nom || "?"} (${agent?.role || "?"}, filière ${agent?.filiere || "?"})
- Stress : ${agent?.stress || "?"} · Fatigue : ${agent?.fatigue || "?"} · Confiance joueur : ${agent?.confiance_joueur || "?"}
- Émotion : ${agent?.emotion || "?"} · Arc narratif : ${agent?.arc_actuel || "Stable"}

# MESSAGE DU COLLABORATEUR (l'agent écrit ceci au patron)
"""
${agent_message || "(pas de message initial — c'est le patron qui ouvre la conversation)"}
"""

# RÉPONSE DU PATRON (à corriger)
"""
${player_response}
"""

# TA MISSION
Évalue la réponse du patron sous l'angle :
1. **Technicité comptable/fiscale** : références CGI/PCG/BOFiP/IFRS si pertinent, jargon EC précis
2. **Pertinence managériale** : adaptation à l'état émotionnel du collaborateur, fermeté/empathie équilibrées
3. **Décision stratégique** : la réponse fait-elle avancer le dossier/la situation ?
4. **Déontologie EC** : respect du code de déontologie (indépendance, conscience professionnelle, secret pro)

Sois critique mais juste. Si la réponse est correcte, dis-le. Si elle est faible, explique précisément pourquoi avec la règle ou la bonne pratique applicable.

# FORMAT DE RÉPONSE (JSON STRICT — aucun texte avant/après)
{
  "note_sur_20": <0-20>,
  "verdict": "<verdict bref en 1 phrase, ton sec d'examinateur>",
  "points_forts": ["<point fort 1>", "<point fort 2>"],
  "points_faibles": ["<point faible 1>", "<point faible 2>"],
  "reponse_ideale": "<3-5 phrases : ce qu'un EC expérimenté aurait répondu exactement à la place du patron, avec jargon précis, références techniques si pertinent, ton adapté à l'état du collaborateur>",
  "correction_detaillee": "<explication pédagogique 3-5 phrases : pourquoi la réponse du patron mérite cette note, ce qu'il faut retenir pour le DEC, quelle règle/article s'applique ici>",
  "sources": ["<source 1 : ex art. 39 CGI ou BOI-XX-XX-XX-X ou PCG art. XXX>", "<source 2 si pertinent>"],
  "categorie_dec": "<une des catégories DEC : Comptable | Fiscal | Audit | Social | Gestion | Déontologie | Stratégie | Communication>"
}`;

  try {
    const r = await callAnthropic(apiKey, {
      max_tokens: 1500,
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
