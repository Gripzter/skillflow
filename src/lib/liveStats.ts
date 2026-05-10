import { createClient } from "@/lib/supabase/client";

interface LiveStats {
  playersOnline: number;
  matchesToday: number;
  skilliesInPlay: number;
  activeMatches: number;
}

/**
 * BLENDED STATS — combines real DB metrics with seeded baseline.
 *
 * For launch (low traffic), real numbers are tiny and would look dead.
 * We blend in a believable baseline that grows slowly over time.
 * When real traffic exceeds the baseline, real numbers dominate naturally.
 *
 * NEVER show "0" for any stat. Always show something believable.
 */
export async function fetchBlendedLiveStats(): Promise<LiveStats> {
  const supabase = createClient();

  // Calculate platform age in days since a fixed launch date
  const PLATFORM_LAUNCH_DATE = new Date("2026-05-01"); // adjust to actual launch
  const daysActive = Math.max(
    1,
    Math.floor((Date.now() - PLATFORM_LAUNCH_DATE.getTime()) / (1000 * 60 * 60 * 24))
  );

  // Baseline values that grow slowly each day — give the platform a believable trajectory
  // These numbers should feel "small platform on the rise" not "dead" or "huge"
  const baselinePlayersOnline = Math.floor(35 + daysActive * 2.3);
  const baselineMatchesToday = Math.floor(180 + daysActive * 12);
  const baselineSkilliesInPlay = Math.floor(8500 + daysActive * 380);
  const baselineActiveMatches = Math.floor(8 + daysActive * 0.4);

  // Real numbers from DB
  let realPlayersOnline = 0;
  let realMatchesToday = 0;
  let realSkilliesInPlay = 0;
  let realActiveMatches = 0;

  try {
    if (supabase) {
      // Players "online" = users who took an action in the last 5 minutes
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count: onlineCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("last_seen_at", fiveMinAgo);
      realPlayersOnline = onlineCount ?? 0;

      // Matches today
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      const { count: todayCount } = await supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfToday.toISOString());
      realMatchesToday = todayCount ?? 0;

      // Active matches right now
      const { count: activeCount } = await supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_progress");
      realActiveMatches = activeCount ?? 0;

      // Skillies in play = sum of bet_amount on active matches × 2 (both players)
      const { data: activeMatchData } = await supabase
        .from("matches")
        .select("bet_amount")
        .eq("status", "in_progress");
      realSkilliesInPlay = (activeMatchData ?? []).reduce(
        (sum, match) => sum + Number(match.bet_amount ?? 0) * 2,
        0
      );
    }
  } catch (error) {
    console.error("[LiveStats] DB fetch failed, using baseline only", error);
  }

  // Blend: take the larger of real vs baseline. As platform grows, real overtakes baseline naturally.
  return {
    playersOnline: Math.max(realPlayersOnline, baselinePlayersOnline),
    matchesToday: Math.max(realMatchesToday, baselineMatchesToday),
    skilliesInPlay: Math.max(realSkilliesInPlay, baselineSkilliesInPlay),
    activeMatches: Math.max(realActiveMatches, baselineActiveMatches),
  };
}

/**
 * Adds small natural fluctuation to a number for "live" feel between DB refreshes.
 * Used in the LiveStatsPanel component to make numbers tick subtly even when DB hasn't updated.
 */
export function applyJitter(baseValue: number, jitterPercent = 0.02): number {
  const jitter = baseValue * jitterPercent;
  const direction = Math.random() > 0.5 ? 1 : -1;
  const amount = Math.floor(Math.random() * jitter) * direction;
  return Math.max(1, baseValue + amount); // never go below 1
}

export type { LiveStats };
