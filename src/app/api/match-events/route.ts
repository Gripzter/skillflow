import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_EVENT_TYPES = new Set([
  "match_start",
  "player_move",
  "match_end",
  "player_disconnect",
  "rematch_offered",
]);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      matchId?: string;
      eventType?: string;
      playerId?: string;
      payload?: Record<string, unknown>;
      reactionTimeMs?: number;
    };

    const matchId = body.matchId;
    const eventType = body.eventType;

    if (!matchId || !UUID_RE.test(matchId)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (!eventType || !ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ ok: false }, { status: 503 });
    }

    const playerId =
      body.playerId && UUID_RE.test(body.playerId) ? body.playerId : null;

    const reactionTimeMs =
      typeof body.reactionTimeMs === "number" && Number.isFinite(body.reactionTimeMs)
        ? Math.max(0, Math.round(body.reactionTimeMs))
        : null;

    const { error } = await admin.from("match_events").insert({
      match_id: matchId,
      event_type: eventType,
      player_id: playerId,
      payload: body.payload ?? {},
      reaction_time_ms: reactionTimeMs,
    });

    if (error) {
      console.error("[match-events] insert failed:", error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[match-events] unexpected error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
