import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userErr,
    } = await authClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { matchId, winnerId, idempotencyKey, gameResult } = await req.json();

    if (typeof matchId !== "string" || !matchId.match(/^[0-9a-f-]{36}$/)) {
      return json({ error: "INVALID_MATCH_ID" }, 400);
    }
    if (
      typeof idempotencyKey !== "string" ||
      idempotencyKey.length < 16 ||
      idempotencyKey.length > 128
    ) {
      return json({ error: "INVALID_IDEMPOTENCY_KEY" }, 400);
    }
    if (winnerId !== null && (typeof winnerId !== "string" || !winnerId.match(/^[0-9a-f-]{36}$/))) {
      return json({ error: "INVALID_WINNER_ID" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("[MATCH_FINISH_REQUEST]", {
      caller: user.id,
      matchId,
      winnerId,
      gameResult,
    });

    const { data, error } = await admin.rpc("finish_match", {
      p_match_id: matchId,
      p_winner_id: winnerId,
      p_caller_id: user.id,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      console.error("[MATCH_FINISH_FAIL]", { caller: user.id, matchId, error: error.message });
      return json({ error: error.message }, 400);
    }

    console.log("[MATCH_FINISH_OK]", { caller: user.id, matchId, result: data });
    return json(data, 200);
  } catch (err) {
    console.error("[MATCH_FINISH_THREW]", err);
    return json({ error: "INTERNAL" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
