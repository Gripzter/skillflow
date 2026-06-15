import { NextRequest } from "next/server";
import {
  calcMatchEconomics,
  jsonOk,
  matchRakeSK,
  requireAdmin,
  resolveAdminMatchStatus,
  resolvePlayerLabel,
  resolveWinnerLabel,
  skToUsd,
} from "@/lib/admin-api";
import { getPlatformHealth, healthLevel, revenueFromCreatorEarnedSK } from "@/lib/admin-intelligence";

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const sixtyMinAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400_000);

  const [
    { data: todayEarnings },
    { data: monthEarnings },
    { data: hourEarnings },
    { data: inProgressMatches },
    { data: recentSessions },
    { count: openDisputes },
    { count: suspendedCreators },
    { count: totalMatches },
    { data: recentMatches },
    { data: weekEarnings },
    { data: prevWeekEarnings },
    { data: todayMatches },
    { data: weekMatches },
    platformHealth,
  ] = await Promise.all([
    admin.from("creator_earnings").select("earned_sk").gte("created_at", todayStart.toISOString()),
    admin.from("creator_earnings").select("earned_sk").gte("created_at", monthStart.toISOString()),
    admin.from("creator_earnings").select("earned_sk").gte("created_at", sixtyMinAgo.toISOString()),
    admin
      .from("matches")
      .select("id")
      .eq("status", "in_progress")
      .eq("state", "active"),
    admin
      .from("player_sessions")
      .select("user_id")
      .gte("created_at", fiveMinAgo.toISOString()),
    admin
      .from("disputes")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "under_review"]),
    admin
      .from("creator_games")
      .select("*", { count: "exact", head: true })
      .eq("status", "suspended"),
    admin.from("matches").select("*", { count: "exact", head: true }),
    admin
      .from("matches")
      .select(
        "id, game_type, creator_game_id, player1_id, player2_id, player_a, player_b, stake_sp, stake_amount, state, status, sdk_phase, winner_id, created_at, completed_at, settled_at"
      )
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("creator_earnings")
      .select("earned_sk, created_at")
      .gte("created_at", sevenDaysAgo.toISOString()),
    admin
      .from("creator_earnings")
      .select("earned_sk, created_at")
      .gte("created_at", fourteenDaysAgo.toISOString())
      .lt("created_at", sevenDaysAgo.toISOString()),
    admin
      .from("matches")
      .select("id, creator_game_id, game_type, stake_sp")
      .gte("created_at", todayStart.toISOString()),
    admin
      .from("matches")
      .select("id, stake_sp, status, state, created_at")
      .gte("created_at", sevenDaysAgo.toISOString()),
    getPlatformHealth(admin),
  ]);

  const todayCreatorSK = todayEarnings?.reduce((s, r) => s + Number(r.earned_sk), 0) ?? 0;
  const monthCreatorSK = monthEarnings?.reduce((s, r) => s + Number(r.earned_sk), 0) ?? 0;
  const hourCreatorSK = hourEarnings?.reduce((s, r) => s + Number(r.earned_sk), 0) ?? 0;

  const todaySkillflowSK = revenueFromCreatorEarnedSK(todayCreatorSK);
  const monthSkillflowSK = revenueFromCreatorEarnedSK(monthCreatorSK);
  const hourSkillflowSK = revenueFromCreatorEarnedSK(hourCreatorSK);

  const onlinePlayerIds = new Set((recentSessions ?? []).map((s) => s.user_id as string));

  const playerIds = new Set<string>();
  for (const m of recentMatches ?? []) {
    for (const id of [m.player1_id, m.player2_id, m.player_a, m.player_b, m.winner_id]) {
      if (id) playerIds.add(id as string);
    }
  }

  const { data: profiles } = playerIds.size
    ? await admin.from("profiles").select("id, username").in("id", Array.from(playerIds))
    : { data: [] };

  const { data: creatorGames } = await admin.from("creator_games").select("game_id, game_name");

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));
  const gameMap = new Map((creatorGames ?? []).map((g) => [g.game_id, g.game_name]));

  const liveFeed = (recentMatches ?? []).map((m) => {
    const stake = Number(m.stake_sp ?? m.stake_amount ?? 0);
    const p1Id = (m.player1_id ?? m.player_a) as string | null;
    const p2Id = (m.player2_id ?? m.player_b) as string | null;
    const status = resolveAdminMatchStatus(m);
    const winnerId = m.winner_id as string | null;
    return {
      id: m.id,
      gameName:
        (m.creator_game_id ? gameMap.get(m.creator_game_id as string) : null) ?? m.game_type,
      player1: resolvePlayerLabel(p1Id, profileMap),
      player2: resolvePlayerLabel(p2Id, profileMap),
      entrySK: stake,
      potSK: stake * 2,
      status,
      winner: resolveWinnerLabel(winnerId, status, profileMap),
      timestamp: m.completed_at ?? m.settled_at ?? m.created_at,
    };
  });

  const revenueByDay: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    revenueByDay[d.toISOString().slice(0, 10)] = 0;
  }
  for (const row of weekEarnings ?? []) {
    const key = (row.created_at as string).slice(0, 10);
    if (key in revenueByDay) {
      revenueByDay[key] += revenueFromCreatorEarnedSK(Number(row.earned_sk));
    }
  }

  const revenueChart = Object.entries(revenueByDay).map(([date, skillflowNetSK]) => ({
    date,
    label: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
    skillflowNetSK,
    skillflowNetUSD: skToUsd(skillflowNetSK),
  }));

  const gameMatchCounts: Record<string, number> = {};
  const gameRevenue: Record<string, number> = {};
  for (const m of todayMatches ?? []) {
    const key = (m.creator_game_id as string) || (m.game_type as string) || "unknown";
    gameMatchCounts[key] = (gameMatchCounts[key] ?? 0) + 1;
    gameRevenue[key] = (gameRevenue[key] ?? 0) + calcMatchEconomics(Number(m.stake_sp ?? 0)).skillflowNetSK;
  }

  const topGamesByMatches = Object.entries(gameMatchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({ game: gameMap.get(key) ?? key, count }));

  const topGamesByRevenue = Object.entries(gameRevenue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, sk]) => ({
      game: gameMap.get(key) ?? key,
      skillflowNetSK: sk,
      skillflowNetUSD: skToUsd(sk),
    }));

  const weekMatchCount = weekMatches?.length ?? 0;
  const avgDailyMatches = weekMatchCount / 7;
  const avgNetPerMatch =
    weekMatchCount > 0
      ? (weekEarnings ?? []).reduce((s, r) => s + revenueFromCreatorEarnedSK(Number(r.earned_sk)), 0) /
        weekMatchCount
      : 0;

  const projectedMonthlySK = Math.floor(avgDailyMatches * 30 * avgNetPerMatch);
  const projectedAnnualSK = projectedMonthlySK * 12;

  const thisWeekRev = Object.values(revenueByDay).reduce((a, b) => a + b, 0);
  const prevWeekRev = (prevWeekEarnings ?? []).reduce(
    (s, r) => s + revenueFromCreatorEarnedSK(Number(r.earned_sk)),
    0
  );
  const variancePct =
    prevWeekRev > 0 ? Math.round(((thisWeekRev - prevWeekRev) / prevWeekRev) * 100) : 0;

  return jsonOk({
    realTime: {
      matchesInProgress: inProgressMatches?.length ?? 0,
      playersOnline: onlinePlayerIds.size,
      revenueLast60MinSK: hourSkillflowSK,
      revenueLast60MinUSD: skToUsd(hourSkillflowSK),
      openDisputes: openDisputes ?? 0,
      suspendedCreators: suspendedCreators ?? 0,
    },
    stats: {
      revenueTodaySK: todaySkillflowSK,
      revenueTodayUSD: skToUsd(todaySkillflowSK),
      revenueMonthSK: monthSkillflowSK,
      revenueMonthUSD: skToUsd(monthSkillflowSK),
      activePlayers: onlinePlayerIds.size,
      totalMatches: totalMatches ?? 0,
    },
    forecast: {
      projectedMonthlySK,
      projectedMonthlyUSD: skToUsd(projectedMonthlySK),
      projectedAnnualSK,
      projectedAnnualUSD: skToUsd(projectedAnnualSK),
      variancePct,
      varianceLabel: variancePct >= 0 ? `↑ ${variancePct}% vs last week` : `↓ ${Math.abs(variancePct)}% vs last week`,
    },
    platformHealth: {
      completionRate: platformHealth.completionRate,
      completionLevel: healthLevel(platformHealth.completionRate, 85, 70),
      avgDurationMin: platformHealth.avgDurationMin,
      durationLevel: healthLevel(platformHealth.avgDurationMin, 8, 12, true),
      voidRate: platformHealth.voidRate,
      voidLevel: healthLevel(platformHealth.voidRate, 10, 20, true),
      cheatFlagRate: platformHealth.cheatFlagRate,
      cheatLevel: healthLevel(platformHealth.cheatFlagRate, 2, 5, true),
    },
    liveFeed,
    health: { revenueChart, topGamesByMatches, topGamesByRevenue },
  });
}
