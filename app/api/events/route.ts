import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/api-key";
import { callAnthropic } from "@/lib/anthropic-helper";

export async function POST(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!apiKey) return NextResponse.json({ events: [] });

  const { agents, game_state, existing_subjects, agents_with_unread } = await req.json();

  const systemPrompt = `Tu es le moteur narratif autonome d'un cabinet d'expertise comptable (simulation stratégique).

CABINET : Cabinet Morel & Associés
DATE SIMULÉE : ${game_state?.date || "14 mai 2026"}
HEURE JEU : ${String(game_state?.hour ?? 9).padStart(2, "0")}h${String(game_state?.minute ?? 0).padStart(2, "0")} (jour ${game_state?.day || 1})
MOOD : ${game_state?.mood || "Sous Pression"}
RESSOURCES : Légitimité ${game_state?.legitimite}/100 · Trésorerie ${((game_state?.tresorerie || 0) / 1000).toFixed(0)}k€ · Stress global ${game_state?.stress_global}/100
BOSS : Clôture bilan 30/06/2026 (J-${game_state?.joursRestants || 16})

ADAPTE LE TIMING DU MESSAGE À L'HEURE :
- Matin (8h-12h) : urgences clients, briefings, démarrages dossiers
- Midi (12h-14h) : courts, plutôt informationnels (pause)
- Après-midi (14h-17h) : décisions, validations, conflits internes
- Fin de journée (17h-19h) : récap, alertes deadline, dossiers à signer demain

AGENTS (état actuel) :
${(agents || []).map((a: any) =>
  `- ${a.nom} [${a.id}] | ${a.role} | ${a.filiere} | Stress:${a.stress} Fatigue:${a.fatigue} Confiance:${a.confiance_joueur} Émotion:${a.emotion} Arc:${a.arc_actuel}`
).join("\n")}

AGENTS AVEC MESSAGE NON-LU (ne pas regénérer) :
${(agents_with_unread || []).join(", ") || "aucun"}

SUJETS EXISTANTS (ne pas dupliquer) :
${(existing_subjects || []).slice(0, 8).join(" | ") || "aucun"}

---

Génère 1 à 2 nouveaux messages autonomes d'agents.

PRIORITÉS :
1. Agents en arc Rupture (Hugo Bernard) — risque de départ
2. Agents en arc Trahison (Sophie Morel) — secret révélé possible
3. Agents en arc Crise (Léa Garnier) — escalade drama
4. Agents avec stress>70 — erreurs, demandes, tensions
5. Situations liées à la campagne Bilan (J-${game_state?.joursRestants || 16} avant deadline)

NIVEAUX :
- N1 : information simple, 0 PA, aucune urgence (ex: confirmation d'une tâche terminée)
- N2 : question technique, 0 PA (ex: doute sur un traitement fiscal)
- N3 : décision ou conflit, 1 PA, 12-24h (ex: recrutement à valider, drama)
- N4 : problème urgent, 1 PA, 6h (ex: erreur découverte, risque client)
- N5 : crise, 2 PA, 1h (rare — démission imminente, faute professionnelle, inspection)

AUTONOMIE : Les agents agissent SEULS. Le message doit annoncer ce qu'ils ont déjà fait ou vont faire, pas demander la permission (sauf cas critique N4/N5).

Jargon comptable français authentique obligatoire (PCG, IS, TVA, liasse, provision, CAC, DSN, bilan, etc.)

Réponds UNIQUEMENT en JSON valide, rien d'autre :
{
  "events": [
    {
      "agent_id": "id_exact_de_l_agent",
      "niveau": "N1|N2|N3|N4|N5",
      "type": "Information|Question|Decision|Probleme|Crise|RH|Drama|Audit|Conge",
      "sujet": "titre court max 60 caractères",
      "contenu": "message complet 2-3 paragraphes style mail pro comptable authentique",
      "delai_reponse_heures": 12
    }
  ]
}`;

  try {
    const result = await callAnthropic(apiKey, {
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: "Génère les événements autonomes maintenant." }],
    });
    if (!result.ok) return NextResponse.json({ events: [] });
    const text = result.data.content?.[0]?.text || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ events: [] });

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ events: [] });
  }
}
