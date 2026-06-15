import { NextRequest } from "next/server";
import {
  calcMatchEconomics,
  jsonOk,
  requireAdmin,
  resolveAdminMatchStatus,
  resolvePlayerLabel,
  resolveWinnerLabel,
  skToUsd,
  truncateId,
} from "@/lib/admin-api";
import { computeSuspiciousMatchFlags } from "@/lib/admin-intelligence";

export async function GET(
  req: NextRequest,
  { params }: { params: { matchId: string } }
) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const matchId = params.matchId;

  const { data: match, error } = await admin
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();

  if (error || !match) return jsonOk({ error: "Match not found" }, 404);

  const playerIds = [
    match.player1_id,
    match.player2_id,
    match.player_a,
    match.player_b,
    match.winner_id,
  ].filter(Boolean) as string[];

  const [{ data: profiles }, { data: creatorGames }, { data: events }, { data: sdkLog }, { data: disputes }] =
    await Promise.all([
      playerIds.length
        ? admin.from("profiles").select("id, username").in("id", playerIds)
        : Promise.resolve({ data: [] }),
      match.creator_game_id
        ? admin.from("creator_games").select("game_id, game_name").eq("game_id", match.creator_game_id)
        : Promise.resolve({ data: [] }),
      admin
        .from("match_events")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true }),
      admin
        .from("sdk_match_log")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true }),
      admin.from("disputes").select("*").eq("match_id", matchId),
    ]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));
  const stake = Number(match.stake_sp ?? match.stake_amount ?? 0);
  const econ = calcMatchEconomics(stake);
  const status = resolveAdminMatchStatus(match);
  const flagMap = await computeSuspiciousMatchFlags(admin, [matchId]);
  const suspiciousReasons = flagMap.get(matchId) ?? [];

  const timeline = [
    ...(events ?? []).map((e) => ({
      id: e.id,
      source: "match_events" as const,
      eventType: e.event_type,
      playerId: e.player_id,
      playerName: e.player_id ? profileMap.get(e.player_id as string) ?? "—" : null,
      payload: e.payload,
      reactionTimeMs: e.reaction_time_ms,
      createdAt: e.created_at,
    })),
    ...(sdkLog ?? []).map((e) => ({
      id: e.id,
      source: "sdk_match_log" as const,
      eventType: e.event_type,
      playerId: null,
      playerName: null,
      payload: e.payload,
      reactionTimeMs: null,
      createdAt: e.created_at,
    })),
  ].sort(
    (a, b) => new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime()
  );

  const end = match.completed_at ?? match.settled_at;
  let durationSec: number | null = null;
  if (match.match_duration != null) durationSec = Number(match.match_duration);
  else if (end && match.created_at) {
    durationSec = (new Date(end).getTime() - new Date(match.created_at).getTime()) / 1000;
  }

  return jsonOk({
    match: {
      id: match.id,
      idShort: truncateId(match.id as string),
      game: creatorGames?.[0]?.game_name ?? match.game_type,
      gameId: match.creator_game_id ?? match.game_type,
      player1Id: match.player1_id ?? match.player_a,
      player2Id: match.player2_id ?? match.player_b,
      player1: resolvePlayerLabel((match.player1_id ?? match.player_a) as string, profileMap),
      player2: resolvePlayerLabel((match.player2_id ?? match.player_b) as string, profileMap),
      entrySK: stake,
      potSK: econ.potSK,
      rakeSK: econ.rakeSK,
      creatorCutSK: econ.creatorCutSK,
      skillflowNetSK: econ.skillflowNetSK,
      skillflowNetUSD: skToUsd(econ.skillflowNetSK),
      winner: resolveWinnerLabel(match.winner_id as string | null, status, profileMap),
      winnerId: match.winner_id,
      status,
      durationSec,
      createdAt: match.created_at,
      completedAt: match.completed_at ?? match.settled_at,
      suspicious: suspiciousReasons.length > 0,
      suspiciousReasons,
      hasEventData: timeline.length > 0,
    },
    timeline,
    disputes: disputes ?? [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { matchId: string } }
) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin, userId } = ctx;

  const body = (await req.json()) as {
    action?: string;
    disputeId?: string;
    resolution?: string;
    resolutionNote?: string;
    refundPlayer?: "player1" | "player2";
  };

  if (body.action === "void") {
    const { error } = await admin.rpc("void_match", {
      p_match_id: params.matchId,
      p_reason: "admin_void",
    });
    if (error) return jsonOk({ error: error.message }, 400);
    await admin.from("matches").update({ status: "voided" }).eq("id", params.matchId);
    return jsonOk({ success: true });
  }

  if (body.action === "resolve_dispute" && body.disputeId && body.resolutionNote) {
    await admin
      .from("disputes")
      .update({
        status: "resolved",
        resolution: body.resolution,
        resolution_note: body.resolutionNote,
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", body.disputeId);
    return jsonOk({ success: true });
  }

  return jsonOk({ error: "Invalid action" }, 400);
}
