import type { SupabaseClient } from "@supabase/supabase-js";

export interface LastTouchSession {
  id: string;
  scheduled_start_at: string; // ISO
  status: "upcoming" | "live" | "completed";
  prize_pool: number;
  entry_fee: number;
  created_at: string;
}

// Three fixed UTC hours: 02:00, 14:00, 20:00
const SCHEDULE_HOURS_UTC = [2, 14, 20];

/** Returns the next N scheduled start times (UTC) after now */
export function getNextScheduledTimes(count = 3): Date[] {
  const now = new Date();
  const results: Date[] = [];
  for (let dayOffset = 0; dayOffset <= 3 && results.length < count; dayOffset++) {
    for (const hour of SCHEDULE_HOURS_UTC) {
      if (results.length >= count) break;
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, hour, 0, 0, 0)
      );
      if (d > now) results.push(d);
    }
  }
  return results;
}

/** Ensure at least `count` upcoming sessions exist in the DB */
export async function ensureUpcomingSessions(
  supabase: SupabaseClient,
  count = 3
): Promise<void> {
  const { data: existing } = await supabase
    .from("last_touch_sessions")
    .select("scheduled_start_at")
    .eq("status", "upcoming")
    .order("scheduled_start_at", { ascending: true });

  const existingMs = new Set(
    (existing ?? []).map((r: { scheduled_start_at: string }) => new Date(r.scheduled_start_at).getTime())
  );

  const needed = getNextScheduledTimes(count).filter((d) => !existingMs.has(d.getTime()));
  if (needed.length === 0) return;

  await supabase.from("last_touch_sessions").insert(
    needed.map((d) => ({
      scheduled_start_at: d.toISOString(),
      status: "upcoming",
      prize_pool: 0,
      entry_fee: 1,
    }))
  );
}

/** Fetch the next upcoming or live session */
export async function fetchActiveSession(
  supabase: SupabaseClient
): Promise<LastTouchSession | null> {
  const { data: upcoming } = await supabase
    .from("last_touch_sessions")
    .select("*")
    .eq("status", "upcoming")
    .order("scheduled_start_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (upcoming) return upcoming as LastTouchSession;

  const { data: live } = await supabase
    .from("last_touch_sessions")
    .select("*")
    .eq("status", "live")
    .order("scheduled_start_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (live as LastTouchSession) ?? null;
}

/** Join a session (inserts player row; DB trigger updates prize_pool) */
export async function joinSession(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  username: string
): Promise<{ alreadyJoined: boolean; error: string | null }> {
  const { data: existing } = await supabase
    .from("last_touch_players")
    .select("id")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return { alreadyJoined: true, error: null };

  const { error } = await supabase
    .from("last_touch_players")
    .insert({ session_id: sessionId, user_id: userId, username, status: "alive" });

  if (error) return { alreadyJoined: false, error: error.message };
  return { alreadyJoined: false, error: null };
}

/** Check if a user is already in a session */
export async function isUserJoined(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("last_touch_players")
    .select("id")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  return data != null;
}

/** Transition session upcoming → live (idempotent) */
export async function markSessionLive(
  supabase: SupabaseClient,
  sessionId: string
): Promise<void> {
  await supabase
    .from("last_touch_sessions")
    .update({ status: "live" })
    .eq("id", sessionId)
    .eq("status", "upcoming");
}

/** Transition session → completed */
export async function markSessionCompleted(
  supabase: SupabaseClient,
  sessionId: string
): Promise<void> {
  await supabase
    .from("last_touch_sessions")
    .update({ status: "completed" })
    .eq("id", sessionId);
}

