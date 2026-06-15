import { NextRequest } from "next/server";
import {
  calcMatchEconomics,
  jsonOk,
  requireAdmin,
  skToUsd,
  truncateId,
} from "@/lib/admin-api";

function matchStatus(m: {
  state?: string | null;
  status?: string | null;
  sdk_phase?: string | null;
}): string {
  if (m.state === "voided" || m.sdk_phase === "voided") return "voided";
  if (m.state === "settled" || m.status === "completed") return "completed";
  return "in_progress";
}

export async function GET(
  req: NextRequest,
  { params }: { params: { gameId: string } }
) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const gameId = decodeURIComponent(params.gameId);
  const page = Math.max(1, Number(new URL(req.url).searchParams.get("page") ?? 1));
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: game, error: gameError } = await admin
    .from("creator_games")
    .select("*")
    .eq("game_id", gameId)
    .single();

  if (gameError || !game) {
    return jsonOk({ error: "Game not found" }, 404);
  }

  const [{ data: profile }, { data: authUser }] = await Promise.all([
    admin.from("profiles").select("id, username").eq("id", game.creator_id).single(),
    admin.auth.admin.getUserById(game.creator_id as string),
  ]);

  const since = new Date();
  since.setDate(since.getDate() - 29);
  since.setHours(0, 0, 0, 0);

  const { data: earnings } = await admin
    .from("creator_earnings")
    .select("earned_sk, created_at")
    .eq("game_id", gameId)
    .gte("created_at", since.toISOString());

  const dailyMap: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    dailyMap[d.toISOString().slice(0, 10)] = 0;
  }
  for (const row of earnings ?? []) {
    const key = (row.created_at as string).slice(0, 10);
    if (key in dailyMap) dailyMap[key] += Number(row.earned_sk);
  }

  const earningsChart = Object.entries(dailyMap).map(([date, earnedSK]) => ({
    date,
    label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    earnedSK,
    earnedUSD: skToUsd(earnedSK),
  }));

  const { data: matches, count } = await admin
    .from("matches")
    .select(
      "id, stake_sp, state, status, sdk_phase, winner_id, created_at, completed_at, settled_at, match_duration",
      { count: "exact" }
    )
    .eq("creator_game_id", gameId)
    .order("created_at", { ascending: false })
    .range(from, to);

  const { data: allGameMatches } = await admin
    .from("matches")
    .select("status, state, sdk_phase, created_at, completed_at, settled_at, match_duration")
    .eq("creator_game_id", gameId)
    .limit(2000);

  const totalGame = allGameMatches?.length ?? 0;
  const completedGame =
    allGameMatches?.filter((m) => m.status === "completed" || m.state === "settled").length ?? 0;
  const voidedGame =
    allGameMatches?.filter((m) => m.status === "voided" || m.state === "voided").length ?? 0;
  const durations = (allGameMatches ?? [])
    .map((m) => {
      if (m.match_duration != null) return Number(m.match_duration);
      const end = m.completed_at ?? m.settled_at;
      if (!end || !m.created_at) return null;
      return (new Date(end).getTime() - new Date(m.created_at).getTime()) / 1000;
    })
    .filter((d): d is number => d != null);
  const avgDurationMin =
    durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length / 60 : 0;
  const voidRate = totalGame > 0 ? (voidedGame / totalGame) * 100 : 0;

  const [{ data: keyRotations }, { data: notes }] = await Promise.all([
    admin
      .from("creator_api_key_rotations")
      .select("*")
      .eq("game_id", gameId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("admin_notes")
      .select("*")
      .eq("target_type", "game")
      .eq("target_id", gameId)
      .order("created_at", { ascending: false }),
  ]);

  const lastKey4 = keyRotations?.[0]?.key_last4 ?? "••••";

  const matchRows = (matches ?? []).map((m) => {
    const stake = Number(m.stake_sp ?? 0);
    const econ = calcMatchEconomics(stake);
    return {
      matchId: m.id,
      matchIdShort: truncateId(m.id as string),
      entrySK: stake,
      potSK: econ.potSK,
      status: matchStatus(m),
      timestamp: m.completed_at ?? m.settled_at ?? m.created_at,
    };
  });

  return jsonOk({
    game: {
      ...game,
      creatorName: profile?.username ?? "—",
      creatorEmail: authUser.user?.email ?? "—",
      totalEarnedUSD: skToUsd(Number(game.total_earned_sk)),
      apiKeyMasked: `sk_live_••••${lastKey4}`,
    },
    gameHealth: {
      completionRate: totalGame > 0 ? (completedGame / totalGame) * 100 : 0,
      avgDurationMin,
      voidRate,
      investigate: voidRate > 15,
    },
    keyRotations: keyRotations ?? [],
    notes: notes ?? [],
    earningsChart,
    matches: matchRows,
    pagination: { page, pageSize, total: count ?? 0 },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { gameId: string } }
) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const gameId = decodeURIComponent(params.gameId);
  const body = (await req.json()) as { status?: string; revenueSharePct?: number };

  const updates: Record<string, unknown> = {};
  if (body.status) updates.status = body.status;
  if (body.revenueSharePct !== undefined) {
    updates.revenue_share_pct = Math.min(30, Math.max(20, body.revenueSharePct));
  }

  const { data, error } = await admin
    .from("creator_games")
    .update(updates)
    .eq("game_id", gameId)
    .select("*")
    .single();

  if (error) return jsonOk({ error: error.message }, 400);
  return jsonOk({ game: data });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { gameId: string } }
) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const gameId = decodeURIComponent(params.gameId);
  const body = (await req.json()) as { action?: string };

  if (body.action !== "regenerate_key") {
    return jsonOk({ error: "Invalid action" }, 400);
  }

  const { data, error } = await admin.rpc("admin_regenerate_creator_api_key", {
    p_game_id: gameId,
  });

  if (error) return jsonOk({ error: error.message }, 400);

  const apiKey = data as string;
  await admin.from("creator_api_key_rotations").insert({
    game_id: gameId,
    rotated_by: ctx.userId,
    key_last4: apiKey.slice(-4),
  });

  return jsonOk({ apiKey });
}
