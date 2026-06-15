import type { SupabaseClient } from "@supabase/supabase-js";
import { calcMatchEconomics, resolveAdminMatchStatus, SKILLFLOW_RAKE_SHARE } from "./admin-api";

export function countryFlag(code: string): string {
  if (!code || code === "—" || code.length !== 2) return "🌐";
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    ...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function healthLevel(value: number, green: number, yellow: number, invert = false): "green" | "yellow" | "red" {
  if (invert) {
    if (value <= green) return "green";
    if (value <= yellow) return "yellow";
    return "red";
  }
  if (value >= green) return "green";
  if (value >= yellow) return "yellow";
  return "red";
}

export async function getPlatformHealth(admin: SupabaseClient) {
  const { data: matches } = await admin
    .from("matches")
    .select("status, state, stake_sp, created_at, completed_at, settled_at, match_duration, sdk_phase")
    .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
    .limit(5000);

  const rows = matches ?? [];
  const total = rows.length || 1;
  const completed = rows.filter((m) => resolveAdminMatchStatus(m) === "completed").length;
  const voided = rows.filter((m) => resolveAdminMatchStatus(m) === "voided").length;

  const durations = rows
    .map((m) => {
      if (m.match_duration != null) return Number(m.match_duration);
      const end = m.completed_at ?? m.settled_at;
      if (!end || !m.created_at) return null;
      return (new Date(end).getTime() - new Date(m.created_at).getTime()) / 1000;
    })
    .filter((d): d is number => d != null);

  const avgDurationSec =
    durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  const { count: flagCount } = await admin
    .from("cheat_flags")
    .select("*", { count: "exact", head: true })
    .eq("reviewed", false);

  const cheatRate = ((flagCount ?? 0) / total) * 100;

  return {
    completionRate: (completed / total) * 100,
    avgDurationMin: avgDurationSec / 60,
    voidRate: (voided / total) * 100,
    cheatFlagRate: cheatRate,
  };
}

export async function computeSuspiciousMatchFlags(
  admin: SupabaseClient,
  matchIds: string[]
): Promise<Map<string, string[]>> {
  const flags = new Map<string, string[]>();
  if (!matchIds.length) return flags;

  const { data: matches } = await admin
    .from("matches")
    .select(
      "id, stake_sp, stake_amount, created_at, completed_at, settled_at, match_duration, winner_id, player1_id, player2_id, player_a, player_b, creator_game_id, game_type, status, state, sdk_phase"
    )
    .in("id", matchIds);

  for (const m of matches ?? []) {
    const reasons: string[] = [];
    const stake = Number(m.stake_sp ?? m.stake_amount ?? 0);
    const end = m.completed_at ?? m.settled_at;
    let durationSec: number | null = null;
    if (m.match_duration != null) durationSec = Number(m.match_duration);
    else if (end && m.created_at) {
      durationSec = (new Date(end).getTime() - new Date(m.created_at).getTime()) / 1000;
    }
    if (durationSec != null && durationSec < 3) reasons.push("duration_under_3s");
    if (stake * 2 > 10000) reasons.push("pot_over_10000_sk");
    if (reasons.length) flags.set(m.id as string, reasons);
  }

  return flags;
}

export function skillflowNetFromStake(stakeSp: number): number {
  return calcMatchEconomics(stakeSp).skillflowNetSK;
}

export function revenueFromCreatorEarnedSK(earnedSk: number): number {
  const rake = Math.floor(Number(earnedSk) / 0.2);
  return Math.floor(rake * SKILLFLOW_RAKE_SHARE);
}
