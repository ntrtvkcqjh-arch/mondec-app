// Supabase Edge Function — receives Slack Events API callbacks.
// IMPORTANT: deploy with JWT verification DISABLED (see README).
// Slack will hit: https://<project>.supabase.co/functions/v1/slack-events

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, x-client-info, apikey",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400, headers: corsHeaders });
  }

  // 1. URL verification — MUST return challenge within 3s, exact field
  if (body?.type === "url_verification" && body.challenge) {
    return new Response(JSON.stringify({ challenge: body.challenge }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Real event — message from user
  if (body?.type === "event_callback" && body.event) {
    const ev = body.event;
    const isUserMessage =
      ev.type === "message" &&
      !ev.bot_id &&
      !ev.subtype &&
      ev.user &&
      ev.text;

    if (isUserMessage) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        await supabase.from("slack_replies").upsert({
          id: ev.event_ts || ev.ts || String(Date.now()),
          user_id: ev.user,
          text: ev.text,
          channel: ev.channel,
          ts: ev.ts,
          thread_ts: ev.thread_ts || null,
        }, { onConflict: "id" });
      } catch (e) {
        console.error("DB write failed:", e);
      }
    }
  }

  // Always 200 to Slack within 3s (else it retries)
  return new Response("ok", { status: 200, headers: corsHeaders });
});
