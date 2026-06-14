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

function matchDurationSec(m: {
  created_at?: string;
  completed_at?: string | null;
  settled_at?: string | null;
  match_duration?: number | null;
}): number | null {
  if (m.match_duration != null) return Number(m.match_duration);
  const end = m.completed_at ?? m.settled_at;
  if (!end || !m.created_at) return null;
  return Math.max(0, (new Date(end).getTime() - new Date(m.created_at).getTime()) / 1000);
}

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const status = searchParams.get("status");
  const game = searchParams.get("game");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const minPot = Number(searchParams.get("minPot") ?? 0);

  let query = admin
    .from("matches")
    .select(
      "id, game_type, creator_game_id, player1_id, player2_id, player_a, player_b, stake_sp, stake_amount, state, status, sdk_phase, winner_id, created_at, completed_at, settled_at, match_duration",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00.000Z`);
  if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);
  if (game && game !== "all") {
    query = query.or(`creator_game_id.eq.${game},game_type.eq.${game}`);
  }

  const { data: rawMatches, count, error } = await query.range(from, to);
  if (error) return jsonOk({ error: error.message }, 500);

  const playerIds = new Set<string>();
  for (const m of rawMatches ?? []) {
    for (const id of [m.player1_id, m.player2_id, m.player_a, m.player_b, m.winner_id]) {
      if (id) playerIds.add(id as string);
    }
  }

  const [{ data: profiles }, { data: creatorGames }, { data: earnings }] = await Promise.all([
    playerIds.size
      ? admin.from("profiles").select("id, username").in("id", Array.from(playerIds))
      : Promise.resolve({ data: [] }),
    admin.from("creator_games").select("game_id, game_name"),
    admin
      .from("creator_earnings")
      .select("match_id, earned_sk")
      .in(
        "match_id",
        (rawMatches ?? []).map((m) => m.id as string)
      ),
  ]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));
  const gameMap = new Map((creatorGames ?? []).map((g) => [g.game_id, g.game_name]));
  const earningMap = new Map((earnings ?? []).map((e) => [e.match_id, Number(e.earned_sk)]));

  const winStreaks: Record<string, Record<string, number>> = {};

  let rows = (rawMatches ?? []).map((m) => {
    const stake = Number(m.stake_sp ?? m.stake_amount ?? 0);
    const econ = calcMatchEconomics(stake);
    const creatorCutSK = earningMap.get(m.id as string) ?? econ.creatorCutSK;
    const skillflowNetSK =
      creatorCutSK > 0 ? Math.floor(creatorCutSK / 0.2) - creatorCutSK : econ.skillflowNetSK;
    const st = matchStatus(m);
    const durationSec = matchDurationSec(m);
    const gameKey = (m.creator_game_id as string) || (m.game_type as string);
    const winnerId = m.winner_id as string | null;

    if (winnerId && st === "completed") {
      if (!winStreaks[winnerId]) winStreaks[winnerId] = {};
      winStreaks[winnerId][gameKey] = (winStreaks[winnerId][gameKey] ?? 0) + 1;
    } else if (winnerId && winStreaks[winnerId]) {
      winStreaks[winnerId][gameKey] = 0;
    }

    const suspicious =
      (durationSec !== null && durationSec < 3) ||
      stake * 2 > 10000 ||
      false;

    return {
      id: m.id,
      idShort: truncateId(m.id as string),
      game: gameMap.get(m.creator_game_id as string) ?? m.game_type,
      player1: profileMap.get((m.player1_id ?? m.player_a) as string) ?? "—",
      player2: profileMap.get((m.player2_id ?? m.player_b) as string) ?? "—",
      entrySK: stake,
      potSK: econ.potSK,
      rakeSK: econ.rakeSK,
      creatorCutSK,
      skillflowNetSK,
      skillflowNetUSD: skToUsd(skillflowNetSK),
      winner: winnerId ? profileMap.get(winnerId) ?? "—" : "—",
      winnerId,
      status: st,
      durationSec,
      timestamp: m.completed_at ?? m.settled_at ?? m.created_at,
      suspicious,
      suspiciousReasons: [
        durationSec !== null && durationSec < 3 ? "duration_under_3s" : null,
        stake * 2 > 10000 ? "pot_over_10000_sk" : null,
      ].filter(Boolean),
    };
  });

  for (const row of rows) {
    if (row.winnerId && row.status === "completed") {
      const gameKey =
        (rawMatches?.find((m) => m.id === row.id)?.creator_game_id as string) ||
        (rawMatches?.find((m) => m.id === row.id)?.game_type as string);
      const streak = winStreaks[row.winnerId]?.[gameKey] ?? 0;
      if (streak >= 10) {
        row.suspicious = true;
        row.suspiciousReasons.push("win_streak_10_plus");
      }
    }
  }

  if (status && status !== "all") {
    rows = rows.filter((r) => r.status === status);
  }
  if (minPot > 0) {
    rows = rows.filter((r) => r.potSK >= minPot);
  }

  return jsonOk({
    matches: rows,
    pagination: { page, pageSize, total: count ?? rows.length },
  });
}
