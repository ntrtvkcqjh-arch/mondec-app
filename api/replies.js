// Vercel Function — exposes stored Slack replies for PHDDEC polling
import { kv } from "@vercel/kv";

export const config = { runtime: "edge" };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  if (req.method !== "GET")     return new Response("Method Not Allowed", { status: 405, headers: cors });

  const url = new URL(req.url);
  const since = Number(url.searchParams.get("since") || 0);

  try {
    const raw = await kv.lrange("phddec:replies", 0, -1);
    const replies = raw
      .map(s => { try { return JSON.parse(s); } catch { return null; } })
      .filter(r => r && r.at > since)
      .sort((a, b) => a.at - b.at);

    return new Response(JSON.stringify({ replies, serverTime: Date.now() }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, replies: [], serverTime: Date.now() }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
}
