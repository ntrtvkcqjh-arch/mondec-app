import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/api-key";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      reason: "Clé API manquante — clique sur ⚙ pour la configurer",
      needs_key: true,
    });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 10,
        messages: [{ role: "user", content: "ping" }],
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      return NextResponse.json({
        ok: false,
        status: r.status,
        reason: `API Anthropic répond ${r.status}`,
        details: errText.slice(0, 200),
      });
    }

    return NextResponse.json({ ok: true, status: 200, model: "claude-3-5-haiku" });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      reason: "Erreur réseau vers Anthropic",
      details: e?.message || String(e),
    });
  }
}
