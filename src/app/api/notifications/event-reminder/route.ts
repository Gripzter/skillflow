import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createNotification } from "@/lib/notifications";

/** Idempotent 15-minute Last Touch reminder for joined players. */
export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { sessionId?: string } | null;
  const sessionId = body?.sessionId;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const { data: session } = await admin
    .from("last_touch_sessions")
    .select("id, scheduled_start_at, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session || session.status !== "upcoming") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { data: joined } = await admin
    .from("last_touch_players")
    .select("id")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!joined) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const startsAt = new Date(session.scheduled_start_at).getTime();
  const minutesUntil = (startsAt - Date.now()) / 60000;
  if (minutesUntil > 16 || minutesUntil < 14) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const type = `event_reminder:${sessionId}`;
  const { data: existing } = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", type)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  await createNotification(admin, {
    userId: user.id,
    type,
    message: "Last Touch starts in 15 minutes.",
  });

  return NextResponse.json({ ok: true });
}
