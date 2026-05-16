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
  const winnerId = typeof body.winnerId === "string" ? body.winnerId : null;
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
  const gameResult = body.gameResult ?? null;

  if (!UUID_RE.test(matchId)) {
    return new Response("Invalid matchId", { status: 400 });
  }
  if (winnerId !== null && !UUID_RE.test(winnerId)) {
    return new Response("Invalid winnerId", { status: 400 });
  }
  if (idempotencyKey.length < 16 || idempotencyKey.length > 160) {
    return new Response("Invalid idempotencyKey", { status: 400 });
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { data: match, error: matchErr } = await adminClient
    .from("matches")
    .select("id, player1_id, player2_id, player_a, player_b")
    .eq("id", matchId)
    .single();

  if (matchErr || !match) {
    return new Response("Match not found", { status: 404 });
  }

  const participantIds = [match.player_a, match.player_b, match.player1_id, match.player2_id].filter(
    (id): id is string => typeof id === "string"
  );
  if (!participantIds.includes(user.id)) {
    return new Response("Forbidden", { status: 403 });
  }

  console.log("[MATCH_SETTLE_REQUEST]", {
    user: user.id,
    matchId,
    winnerId,
    gameResult,
  });

  const { data, error } = await adminClient.rpc("settle_match", {
    p_match_id: matchId,
    p_winner_id: winnerId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error("[SETTLE_FAIL]", { user: user.id, matchId, error });
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
