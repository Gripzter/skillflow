import { NextRequest } from "next/server";
import { jsonOk, requireAdmin } from "@/lib/admin-api";

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const { data: flags } = await admin
    .from("cheat_flags")
    .select("*")
    .eq("reviewed", false)
    .order("created_at", { ascending: false })
    .limit(200);

  const playerIds = [...new Set((flags ?? []).map((f) => f.player_id as string))];
  const { data: profiles } = playerIds.length
    ? await admin.from("profiles").select("id, username, suspicious, banned").in("id", playerIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const flagCounts = new Map<string, number>();
  for (const f of flags ?? []) {
    const id = f.player_id as string;
    flagCounts.set(id, (flagCounts.get(id) ?? 0) + 1);
  }

  const suspiciousPlayers = playerIds.map((id) => {
    const count = flagCounts.get(id) ?? 0;
    const p = profileMap.get(id);
    const risk = count >= 5 ? "high" : count >= 2 ? "medium" : "low";
    const playerFlags = (flags ?? []).filter((f) => f.player_id === id);
    return {
      playerId: id,
      username: p?.username ?? "—",
      banned: Boolean(p?.banned),
      suspicious: Boolean(p?.suspicious),
      flagCount: count,
      risk,
      reasons: [...new Set(playerFlags.map((f) => f.flag_type as string))],
    };
  });

  const { data: sessions } = await admin
    .from("player_sessions")
    .select("user_id, ip")
    .not("ip", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000);

  const ipMap = new Map<string, string[]>();
  for (const s of sessions ?? []) {
    const ip = s.ip as string;
    const uid = s.user_id as string;
    if (!ipMap.has(ip)) ipMap.set(ip, []);
    const arr = ipMap.get(ip)!;
    if (!arr.includes(uid)) arr.push(uid);
  }

  const ipCollisions = [...ipMap.entries()]
    .filter(([, users]) => users.length > 1)
    .map(([ip, users]) => ({ ip, userIds: users, count: users.length }));

  const { data: recentMatches } = await admin
    .from("matches")
    .select("id, winner_id, creator_game_id, game_type, created_at, status, state")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(3000);

  const streaks: Array<{
    playerId: string;
    game: string;
    streak: number;
    startedAt: string;
  }> = [];

  const byPlayerGame = new Map<string, typeof recentMatches>();
  for (const m of recentMatches ?? []) {
    const wid = m.winner_id as string | null;
    if (!wid) continue;
    const game = (m.creator_game_id as string) || (m.game_type as string);
    const key = `${wid}:${game}`;
    if (!byPlayerGame.has(key)) byPlayerGame.set(key, []);
    byPlayerGame.get(key)!.push(m);
  }

  for (const [key, matches] of byPlayerGame) {
    let streak = 0;
    let startedAt = "";
    for (const m of matches ?? []) {
      if (m.winner_id === key.split(":")[0]) {
        streak++;
        startedAt = m.created_at as string;
      } else break;
    }
    if (streak >= 5) {
      const [playerId, game] = key.split(":");
      streaks.push({ playerId, game, streak, startedAt });
    }
  }

  streaks.sort((a, b) => b.streak - a.streak);

  const { data: fastEvents } = await admin
    .from("match_events")
    .select("match_id, reaction_time_ms, event_type, created_at")
    .not("reaction_time_ms", "is", null)
    .lt("reaction_time_ms", 150)
    .order("created_at", { ascending: false })
    .limit(50);

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: dailyEarnings } = await admin
    .from("creator_earnings")
    .select("earned_sk, created_at")
    .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());

  const byDay = new Map<string, number>();
  for (const e of dailyEarnings ?? []) {
    const day = (e.created_at as string).slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + Math.floor(Number(e.earned_sk) / 0.2) * 0.8);
  }
  const last7 = [...byDay.entries()].slice(-7).map(([, v]) => v);
  const avg7 = last7.length ? last7.reduce((a, b) => a + b, 0) / last7.length : 0;
  const today = new Date().toISOString().slice(0, 10);
  const todayRev = byDay.get(today) ?? 0;
  const revenueAnomaly = avg7 > 0 && todayRev < avg7 * 0.7;

  return jsonOk({
    suspiciousPlayers,
    ipCollisions,
    winStreaks: streaks.slice(0, 30),
    botMatches: fastEvents ?? [],
    anomalies: {
      revenueDrop: revenueAnomaly,
      revenueTodaySK: todayRev,
      revenueAvg7SK: Math.round(avg7),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const body = (await req.json()) as {
    action?: string;
    playerId?: string;
    flagIds?: string[];
  };

  if (body.action === "clear_flags" && body.playerId) {
    await admin
      .from("cheat_flags")
      .update({ reviewed: true })
      .eq("player_id", body.playerId)
      .eq("reviewed", false);
    await admin.from("profiles").update({ suspicious: false }).eq("id", body.playerId);
    return jsonOk({ success: true });
  }

  if (body.action === "flag_suspicious" && body.playerId) {
    await admin.from("profiles").update({ suspicious: true }).eq("id", body.playerId);
    return jsonOk({ success: true });
  }

  if (body.action === "ban" && body.playerId) {
    await admin.from("profiles").update({ banned: true }).eq("id", body.playerId);
    await admin.auth.admin.signOut(body.playerId, "global");
    return jsonOk({ success: true });
  }

  return jsonOk({ error: "Invalid action" }, 400);
}
