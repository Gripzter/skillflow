import { NextRequest } from "next/server";
import {
  calcMatchEconomics,
  jsonOk,
  requireAdmin,
  resolveAdminMatchStatus,
  resolvePlayerLabel,
  resolveWinnerLabel,
  SKILLIES_PER_USD,
  skToUsd,
} from "@/lib/admin-api";

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000);

  const [
    { data: todayEarnings },
    { data: monthEarnings },
    { data: activeMatches },
    { count: totalMatches },
    { data: recentMatches },
    { data: weekEarnings },
    { data: todayMatches },
  ] = await Promise.all([
    admin
      .from("creator_earnings")
      .select("earned_sk")
      .gte("created_at", todayStart.toISOString()),
    admin
      .from("creator_earnings")
      .select("earned_sk")
      .gte("created_at", monthStart.toISOString()),
    admin
      .from("matches")
      .select("player_a, player_b, player1_id, player2_id")
      .gte("created_at", tenMinAgo.toISOString())
      .in("state", ["active"])
      .limit(500),
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
      .from("matches")
      .select("id, creator_game_id, game_type, stake_sp")
      .gte("created_at", todayStart.toISOString()),
  ]);

  const todayCreatorSK =
    todayEarnings?.reduce((s, r) => s + Number(r.earned_sk), 0) ?? 0;
  const monthCreatorSK =
    monthEarnings?.reduce((s, r) => s + Number(r.earned_sk), 0) ?? 0;

  const todayRakeSK = Math.floor((todayCreatorSK / 0.2) || 0);
  const monthRakeSK = Math.floor((monthCreatorSK / 0.2) || 0);
  const todaySkillflowSK = Math.floor(todayRakeSK * 0.8);
  const monthSkillflowSK = Math.floor(monthRakeSK * 0.8);

  const activePlayerIds = new Set<string>();
  for (const m of activeMatches ?? []) {
    for (const id of [m.player_a, m.player_b, m.player1_id, m.player2_id]) {
      if (id) activePlayerIds.add(id as string);
    }
  }

  const playerIds = new Set<string>();
  for (const m of recentMatches ?? []) {
    for (const id of [m.player1_id, m.player2_id, m.player_a, m.player_b, m.winner_id]) {
      if (id) playerIds.add(id as string);
    }
  }

  const { data: profiles } = playerIds.size
    ? await admin.from("profiles").select("id, username").in("id", Array.from(playerIds))
    : { data: [] };

  const { data: creatorGames } = await admin
    .from("creator_games")
    .select("game_id, game_name");

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
        (m.creator_game_id ? gameMap.get(m.creator_game_id as string) : null) ??
        m.game_type,
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
      const rake = Math.floor(Number(row.earned_sk) / 0.2);
      revenueByDay[key] += Math.floor(rake * 0.8);
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
    const key =
      (m.creator_game_id as string) || (m.game_type as string) || "unknown";
    gameMatchCounts[key] = (gameMatchCounts[key] ?? 0) + 1;
    const { skillflowNetSK } = calcMatchEconomics(Number(m.stake_sp ?? 0));
    gameRevenue[key] = (gameRevenue[key] ?? 0) + skillflowNetSK;
  }

  const topGamesByMatches = Object.entries(gameMatchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({
      game: gameMap.get(key) ?? key,
      count,
    }));

  const topGamesByRevenue = Object.entries(gameRevenue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, sk]) => ({
      game: gameMap.get(key) ?? key,
      skillflowNetSK: sk,
      skillflowNetUSD: skToUsd(sk),
    }));

  return jsonOk({
    stats: {
      revenueTodaySK: todaySkillflowSK,
      revenueTodayUSD: skToUsd(todaySkillflowSK),
      revenueMonthSK: monthSkillflowSK,
      revenueMonthUSD: skToUsd(monthSkillflowSK),
      activePlayers: activePlayerIds.size,
      totalMatches: totalMatches ?? 0,
    },
    liveFeed,
    health: {
      revenueChart,
      topGamesByMatches,
      topGamesByRevenue,
    },
  });
}
