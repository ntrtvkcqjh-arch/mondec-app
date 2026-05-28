// Vercel Edge Function — proxies Slack conversations.history directly (no database needed)
// Requires env vars: SLACK_BOT_TOKEN, SLACK_CHANNEL_ID
export const config = { runtime: "edge" };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405, headers: cors });

  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_ID;

  if (!token || !channel) {
    return new Response(JSON.stringify({ error: "SLACK_BOT_TOKEN ou SLACK_CHANNEL_ID manquant", replies: [], serverTime: Date.now() }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const since = Number(url.searchParams.get("since") || 0);

  const slackUrl = new URL("https://slack.com/api/conversations.history");
  slackUrl.searchParams.set("channel", channel);
  slackUrl.searchParams.set("limit", "50");
  if (since > 0) slackUrl.searchParams.set("oldest", String(since / 1000));

  try {
    const resp = await fetch(slackUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await resp.json();

    if (!data.ok) {
      return new Response(JSON.stringify({ error: data.error, replies: [], serverTime: Date.now() }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const replies = (data.messages || [])
      .filter(m => !m.bot_id && !m.subtype && m.user && m.text)
      .map(m => ({
        id: m.ts,
        user: m.user,
        text: m.text,
        channel,
        ts: m.ts,
        thread_ts: m.thread_ts || null,
        at: Math.round(parseFloat(m.ts) * 1000),
      }))
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
