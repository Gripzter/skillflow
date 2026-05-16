import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

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

    const body = await req.json();
    const { game, opponentId, stake, opponentIsBot } = body;

    if (typeof game !== "string" || game.length === 0 || game.length > 50) {
      return json({ error: "INVALID_GAME" }, 400);
    }
    if (!Number.isInteger(stake) || stake < 50 || stake > 5000) {
      return json({ error: "INVALID_STAKE" }, 400);
    }
    if (typeof opponentIsBot !== "boolean") {
      return json({ error: "INVALID_OPPONENT_IS_BOT" }, 400);
    }
    if (
      !opponentIsBot &&
      (typeof opponentId !== "string" || !opponentId.match(/^[0-9a-f-]{36}$/))
    ) {
      return json({ error: "INVALID_OPPONENT_ID" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await admin.rpc("start_match", {
      p_game: game,
      p_player_a: user.id,
      p_player_b: opponentIsBot ? null : opponentId,
      p_stake_sp: stake,
      p_player_b_is_bot: opponentIsBot,
    });

    if (error) {
      console.error("[MATCH_START_FAIL]", { user: user.id, game, stake, error: error.message });
      return json({ error: error.message }, 400);
    }

    console.log("[MATCH_START_OK]", { user: user.id, game, stake, result: data });
    return json(data, 200);
  } catch (err) {
    console.error("[MATCH_START_THREW]", err);
    return json({ error: "INTERNAL" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
    },
  });
}
