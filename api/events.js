// Vercel Edge Function — handles Slack URL verification only
export const config = { runtime: "edge" };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors });

  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400, headers: cors }); }

  if (body?.type === "url_verification") {
    return new Response(JSON.stringify({ challenge: body.challenge }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response("ok", { status: 200, headers: cors });
}
