// Vercel Function — receives Slack events (replies in channel) and stores them in KV
// Slack Bot must subscribe to: message.channels (or message.im, message.groups)
// Bot scopes needed: channels:history, chat:write (for reactions), users:read
import { kv } from "@vercel/kv";

export const config = { runtime: "edge" };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  if (req.method !== "POST")    return new Response("Method Not Allowed", { status: 405, headers: cors });

  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400, headers: cors }); }

  // 1. Slack URL verification (one-time during setup)
  if (body?.type === "url_verification") {
    return new Response(JSON.stringify({ challenge: body.challenge }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // 2. Real event
  if (body?.type === "event_callback" && body.event) {
    const ev = body.event;

    // Only process plain user messages — skip bot/system messages
    const isUserMessage =
      ev.type === "message" &&
      !ev.bot_id &&
      !ev.subtype &&
      ev.user &&
      ev.text;

    if (isUserMessage) {
      const reply = {
        id: ev.event_ts || ev.ts || Date.now().toString(),
        user: ev.user,
        text: ev.text,
        channel: ev.channel,
        ts: ev.ts,
        thread_ts: ev.thread_ts || null,
        at: Date.now(),
      };
      try {
        // Push to ordered list + set TTL 24h
        await kv.lpush("phddec:replies", JSON.stringify(reply));
        await kv.ltrim("phddec:replies", 0, 199); // keep last 200
        await kv.expire("phddec:replies", 86400);
      } catch (e) {
        console.error("KV write failed:", e);
      }
    }
  }

  // Always 200 OK to Slack within 3s (else retries)
  return new Response("ok", { status: 200, headers: cors });
}
