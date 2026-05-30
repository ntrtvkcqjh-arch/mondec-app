import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/api-key";
import { callAnthropic } from "@/lib/anthropic-helper";
import { getToneInstructions } from "@/lib/tone-helper";

export const dynamic = "force-dynamic";

/**
 * Génère une RÉPONSE CONTEXTUELLE à un mail envoyé par le joueur.
 * Prend en compte :
 *   - Le thread complet (toutes les itérations du mail)
 *   - Le profil du destinataire (agent ou client)
 *   - Le niveau du joueur (adaptation du ton)
 *   - Le contexte gameplay (dossiers liés, état du destinataire)
 *
 * Retourne UN seul mail avec subject + body, prêt à insérer dans la boîte.
 */
export async function POST(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!apiKey) return NextResponse.json({ skip: true, reason: "Pas de clé API" });

  const body = await req.json();
  const {
    thread,           // [{ from_name, from_type, subject, body, date_iso, direction }]
    recipient,        // { type: 'agent'|'client'|'external', name, email, id?, profile_summary? }
    player_level,
    last_player_mail, // { subject, body }
    agent_context,    // si recipient = agent : { stress, fatigue, confiance_joueur, role, filiere, dossiers }
    client_context,   // si recipient = client : { dossier_client, secteur, profil_relationnel, complexite, satisfaction }
  } = body;

  if (!last_player_mail || !recipient) {
    return NextResponse.json({ skip: true, reason: "Données mail manquantes" });
  }

  // Construction du thread résumé (5 derniers échanges max)
  const threadSummary = Array.isArray(thread)
    ? thread.slice(-5).map((m: any, i: number) =>
        `[${i + 1}] ${m.direction === "out" ? "PATRON" : m.from_name} — Sujet : "${m.subject}"\n${m.body?.slice(0, 400) || ""}\n`
      ).join("\n---\n")
    : "(pas d'historique)";

  // Bloc contextuel selon le destinataire
  const recipientBlock = recipient.type === "agent" && agent_context
    ? `# TU ES ${recipient.name.toUpperCase()}
- Rôle : ${agent_context.role || "Collaborateur"} (${agent_context.filiere || "Comptable"})
- État : stress ${agent_context.stress ?? 50}/100, fatigue ${agent_context.fatigue ?? 50}/100, confiance patron ${agent_context.confiance_joueur ?? 50}/100
- Tu réponds par mail PRO interne. Ton : adapté à l'expert-comptable cabinet français.
- Si confiance basse (< 40) : réponse minimaliste, distante.
- Si stress haut (> 70) : phrases courtes, parfois sec.
- Si fatigue haute (> 70) : oublis d'infos, ton terne.
- Tu peux faire référence à tes dossiers : ${(agent_context.dossiers || []).map((d: any) => d.client).slice(0, 4).join(", ") || "aucun listé"}.`
    : recipient.type === "client" && client_context
    ? `# TU ES LE CLIENT : ${recipient.name}
- Société : ${client_context.dossier_client || recipient.name}
- Secteur : ${client_context.secteur || "PME générale"}
- Profil relationnel : ${client_context.profil_relationnel >= 70 ? "EXIGEANT (impatient, formel)" : client_context.profil_relationnel >= 40 ? "Standard (cordial mais ferme)" : "Patient (cordial, accommodant)"}
- Complexité comptable du dossier : ${client_context.complexite ?? 50}/100
- Satisfaction actuelle : ${client_context.satisfaction ?? 70}/100
- Tu réponds en CLIENT : tu ne maîtrises pas forcément la technique comptable, tu parles de TON business et de TES préoccupations. Tu peux poser des questions naïves, exprimer de l'inquiétude, demander des délais ou rappeler une échéance.
- Si satisfaction basse (< 50) : ton sec, allusions à changer de cabinet.
- Si profil exigeant : tu rappelles ce que tu attends, tu insistes sur les délais.`
    : `# TU ES UN CONTACT EXTERNE : ${recipient.name}
- Tu réponds de manière neutre et professionnelle. Tu peux être administration fiscale, banque, fournisseur, partenaire.`;

  const tone = getToneInstructions(player_level || 1, { role: recipient.type === "client" ? "client" : "agent" });

  const systemPrompt = `${tone.systemBlock}

${recipientBlock}

# RÈGLES DE RÉPONSE MAIL — CRUCIAL
1. Tu réponds DIRECTEMENT et SPÉCIFIQUEMENT à ce que le patron vient d'écrire dans son mail.
2. Tu lis le mail du patron mot pour mot. Si une question est posée, tu y réponds.
3. Si le patron donne une consigne, tu confirmes que tu l'as bien comprise et tu indiques quand tu la mettras en œuvre.
4. Tu fais référence à au moins UN élément précis du mail du patron (chiffre, nom de client, date, action mentionnée) — preuve que tu as lu.
5. Tu cites le thread précédent si pertinent ("Comme je te l'avais indiqué dans mon mail du …").
6. Format mail PROFESSIONNEL : 4-8 lignes max, salutation courte, signature.
7. PAS de méta ("Voici ma réponse..."), pas de "En tant que..." — tu ES le destinataire.
8. Jargon EC français correct (PCG, IS, TVA, liasse, provision, CAC, DSN, bilan).

# THREAD DU MAIL
${threadSummary}

# DERNIER MAIL DU PATRON (à qui tu réponds)
Sujet : ${last_player_mail.subject}
Corps :
"""
${last_player_mail.body}
"""

# TA TÂCHE
Génère ta réponse au patron en mail formel. Sujet préfixé "Re: " du sujet patron.
Format JSON STRICT :
{
  "subject": "Re: <sujet original>",
  "body": "<corps complet du mail, 4-8 lignes>"
}`;

  try {
    const result = await callAnthropic(apiKey, {
      max_tokens: 800,
      messages: [{ role: "user", content: systemPrompt }],
    });
    if (!result.ok) return NextResponse.json({ skip: true, error: result.error });

    const text = result.data.content?.[0]?.text || "";
    const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*$/g, "");
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ skip: true, error: "Parse error", raw: text });

    const parsed = JSON.parse(match[0]);
    return NextResponse.json({
      subject: parsed.subject || `Re: ${last_player_mail.subject}`,
      body: parsed.body || "(Réponse vide)",
    });
  } catch (err: any) {
    return NextResponse.json({ skip: true, error: err?.message });
  }
}
