import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseAuthClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
    error: userErr,
  } = await supabaseAuthClient.auth.getUser();
  if (userErr || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const matchId = typeof body.matchId === "string" ? body.matchId : "";
  const opponentId = typeof body.opponentId === "string" ? body.opponentId : null;
  const stake = body.stake;
  const opponentIsBot = body.opponentIsBot;

  if (!UUID_RE.test(matchId)) {
    return new Response("Invalid matchId", { status: 400 });
  }
  if (!Number.isInteger(stake) || stake < 50 || stake > 5000) {
    return new Response("Invalid stake", { status: 400 });
  }
  if (typeof opponentIsBot !== "boolean") {
    return new Response("Invalid opponentIsBot", { status: 400 });
  }
  if (!opponentIsBot && (!opponentId || !UUID_RE.test(opponentId))) {
    return new Response("Invalid opponentId", { status: 400 });
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { data, error } = await adminClient.rpc("escrow_match", {
    p_match_id: matchId,
    p_player_a: user.id,
    p_player_b: opponentId,
    p_stake_sp: stake,
    p_player_a_is_bot: false,
    p_player_b_is_bot: opponentIsBot,
  });

  if (error) {
    console.error("[ESCROW_FAIL]", { user: user.id, matchId, error });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
