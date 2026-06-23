import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
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

    const result = data as {
      status?: string;
      winner_id?: string | null;
      caller_won?: boolean;
      payout?: number;
    };

    if (result.status === "settled") {
      const { data: match } = await admin
        .from("matches")
        .select(
          "qr_match_id, player1_id, player2_id, player_a, player_b, player1_username, player2_username, stake_sp, stake_amount, winner_payout, platform_fee"
        )
        .eq("id", matchId)
        .maybeSingle();

      if (match?.qr_match_id) {
        const player1Id = (match.player1_id ?? match.player_a) as string | null;
        const player2Id = (match.player2_id ?? match.player_b) as string | null;
        const stake = Number(match.stake_sp ?? match.stake_amount ?? 0);
        const winnerPayout = Number(
          match.winner_payout ?? Math.max(0, stake * 2 - Number(match.platform_fee ?? 0))
        );

        const notifyPlayer = async (
          playerId: string | null,
          opponentName: string | null,
          won: boolean
        ) => {
          if (!playerId) return;
          const amount = won ? winnerPayout : stake;
          const verb = won ? "won" : "lost";
          await admin.from("notifications").insert({
            user_id: playerId,
            type: `qr_match_result:${matchId}`,
            message: `You ${verb} ${amount} SK against ${opponentName ?? "your opponent"}.`,
          });
        };

        await notifyPlayer(
          player1Id,
          match.player2_username as string | null,
          result.winner_id === player1Id
        );
        await notifyPlayer(
          player2Id,
          match.player1_username as string | null,
          result.winner_id === player2Id
        );
      }
    }

    return json(data, 200);
  } catch (err) {
    console.error("[MATCH_FINISH_THREW]", err);
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
