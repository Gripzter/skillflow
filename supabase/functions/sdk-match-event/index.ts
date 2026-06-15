import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-skillflow-game-id, x-skillflow-match-id, x-skillflow-timestamp, x-skillflow-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EventType = "init" | "start" | "report_winner" | "end";

interface RequestBody {
  event_type: EventType;
  game_id: string;
  match_id: string;
  timestamp: number;
  winnerId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const gameId = req.headers.get("X-SkillFlow-Game-Id") ?? "";
    const matchId = req.headers.get("X-SkillFlow-Match-Id") ?? "";
    const timestampHeader = req.headers.get("X-SkillFlow-Timestamp") ?? "";
    const signature = req.headers.get("X-SkillFlow-Signature") ?? "";

    if (!gameId || !matchId || !timestampHeader || !signature) {
      return json(
        {
          error: "MISSING_HEADERS",
          message: "Required headers: X-SkillFlow-Game-Id, X-SkillFlow-Match-Id, X-SkillFlow-Timestamp, X-SkillFlow-Signature",
        },
        400
      );
    }

    const timestamp = Number(timestampHeader);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return json({ error: "INVALID_TIMESTAMP", message: "X-SkillFlow-Timestamp must be a Unix epoch in seconds." }, 400);
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 300) {
      return json(
        { error: "TIMESTAMP_EXPIRED", message: "Request timestamp is too old or too far in the future (max 5 minutes)." },
        403
      );
    }

    const body = (await req.json()) as RequestBody;
    const eventType = body.event_type;

    if (!eventType || !["init", "start", "report_winner", "end"].includes(eventType)) {
      return json(
        { error: "INVALID_EVENT_TYPE", message: "event_type must be one of: init, start, report_winner, end" },
        400
      );
    }

    if (body.game_id && body.game_id !== gameId) {
      return json({ error: "GAME_ID_MISMATCH", message: "Body game_id does not match X-SkillFlow-Game-Id header." }, 400);
    }

    if (body.match_id && body.match_id !== matchId) {
      return json({ error: "MATCH_ID_MISMATCH", message: "Body match_id does not match X-SkillFlow-Match-Id header." }, 400);
    }

    // Dev/test matches — mock responses without DB
    if (matchId.startsWith("test_")) {
      return handleTestMatch(eventType, body);
    }

    if (!matchId.match(/^[0-9a-f-]{36}$/i)) {
      return json({ error: "INVALID_MATCH_ID", message: "match_id must be a UUID." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let data: unknown;
    let error: { message: string } | null = null;

    switch (eventType) {
      case "init":
        ({ data, error } = await admin.rpc("sdk_match_init", {
          p_game_id: gameId,
          p_match_id: matchId,
          p_timestamp: timestamp,
          p_hmac: signature,
        }));
        break;

      case "start":
        ({ data, error } = await admin.rpc("sdk_match_start", {
          p_game_id: gameId,
          p_match_id: matchId,
          p_timestamp: timestamp,
          p_hmac: signature,
        }));
        break;

      case "report_winner": {
        const winnerId = body.winnerId;
        if (typeof winnerId !== "string" || !winnerId.match(/^[0-9a-f-]{36}$/i)) {
          return json({ error: "INVALID_WINNER_ID", message: "winnerId must be a UUID." }, 400);
        }
        ({ data, error } = await admin.rpc("sdk_report_winner", {
          p_game_id: gameId,
          p_match_id: matchId,
          p_winner_id: winnerId,
          p_timestamp: timestamp,
          p_hmac: signature,
        }));
        break;
      }

      case "end":
        ({ data, error } = await admin.rpc("sdk_match_end", {
          p_game_id: gameId,
          p_match_id: matchId,
          p_timestamp: timestamp,
          p_hmac: signature,
        }));
        break;
    }

    if (error) {
      console.error("[SDK_MATCH_EVENT_FAIL]", { eventType, gameId, matchId, error: error.message });
      return json({ error: mapRpcError(error.message), message: error.message }, 400);
    }

    const eventTypeMap: Record<EventType, string> = {
      init: "match_init",
      start: "match_start",
      report_winner: "report_winner",
      end: "match_end",
    };

    const { error: logError } = await admin.from("match_events").insert({
      match_id: matchId,
      event_type: eventTypeMap[eventType],
      player_id: body.winnerId ?? null,
      payload: body as unknown as Record<string, unknown>,
      reaction_time_ms: null,
    });

    if (logError) {
      console.warn("[SDK_MATCH_EVENT_LOG]", logError.message);
    }

    console.log("[SDK_MATCH_EVENT_OK]", { eventType, gameId, matchId });
    return json(data, 200);
  } catch (err) {
    console.error("[SDK_MATCH_EVENT_THREW]", err);
    return json({ error: "INTERNAL", message: "An unexpected error occurred." }, 500);
  }
});

function handleTestMatch(eventType: EventType, body: RequestBody): Response {
  switch (eventType) {
    case "init":
      return json(
        {
          player1Id: "00000000-0000-4000-8000-000000000001",
          player2Id: "00000000-0000-4000-8000-000000000002",
          entrySK: 400,
          potSK: 800,
        },
        200
      );
    case "start":
      return json({ started: true, timeoutSeconds: 300 }, 200);
    case "report_winner":
      return json({ pending: true }, 200);
    case "end":
      return json({ winner: body.winnerId ?? "00000000-0000-4000-8000-000000000001", potSK: 800, rakeSK: 96, creatorEarnedSK: 19 }, 200);
    default:
      return json({ error: "INVALID_EVENT_TYPE" }, 400);
  }
}

function mapRpcError(message: string): string {
  if (message.includes("INVALID_HMAC")) return "INVALID_HMAC_SIGNATURE";
  if (message.includes("CALL_INIT_FIRST")) return "CALL_INIT_FIRST";
  if (message.includes("CALL_MATCH_START_FIRST")) return "CALL_MATCH_START_FIRST";
  if (message.includes("CALL_REPORT_WINNER_FIRST")) return "CALL_REPORT_WINNER_FIRST";
  if (message.includes("WINNER_ALREADY_REPORTED")) return "WINNER_ALREADY_REPORTED";
  if (message.includes("MATCH_VOIDED")) return "MATCH_VOIDED";
  if (message.includes("MATCH_ALREADY_STARTED")) return "MATCH_ALREADY_STARTED";
  if (message.includes("MATCH_ALREADY_SETTLED")) return "MATCH_ALREADY_SETTLED";
  if (message.includes("INVALID_GAME_ID")) return "INVALID_GAME_ID";
  if (message.includes("GAME_NOT_ACTIVE")) return "GAME_NOT_ACTIVE";
  if (message.includes("MATCH_NOT_FOUND")) return "MATCH_NOT_FOUND";
  return "SDK_ERROR";
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
    },
  });
}
