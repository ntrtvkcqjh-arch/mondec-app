// Supabase Edge Function — returns stored Slack replies for PHDDEC polling.
// Also deploy with JWT verification DISABLED.
// PHDDEC will hit: https://<project>.supabase.co/functions/v1/slack-replies?since=<timestamp>

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, x-client-info, apikey",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const sinceMs = Number(url.searchParams.get("since") || 0);
  const sinceIso = sinceMs > 0 ? new Date(sinceMs).toISOString() : new Date(0).toISOString();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data, error } = await supabase
      .from("slack_replies")
      .select("*")
      .gt("at", sinceIso)
      .order("at", { ascending: true })
      .limit(100);

    if (error) throw error;

    const replies = (data ?? []).map((r: any) => ({
      id: r.id,
      user: r.user_id,
      text: r.text,
      channel: r.channel,
      ts: r.ts,
      thread_ts: r.thread_ts,
      at: new Date(r.at).getTime(),
    }));

    return new Response(JSON.stringify({ replies, serverTime: Date.now() }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, replies: [], serverTime: Date.now() }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
