import { NextRequest } from "next/server";
import { jsonOk, requireAdmin, truncateId } from "@/lib/admin-api";

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: recentQr },
    { data: pendingPayouts },
    { count: totalCreated },
    { count: totalAccepted },
    { count: anonWins },
    { count: anonClaims },
  ] = await Promise.all([
    admin
      .from("qr_matches")
      .select(
        "id, game, stake_sk, status, host_user_id, opponent_user_id, opponent_is_anonymous, winner_user_id, winner_is_anonymous, created_at, completed_at, match_id"
      )
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("anonymous_pending_payouts")
      .select("id, amount_sk, created_at, expires_at, claimed, claimed_at, qr_match_id, anonymous_session_token")
      .order("created_at", { ascending: false })
      .limit(50),
    admin.from("qr_matches").select("id", { count: "exact", head: true }),
    admin
      .from("qr_matches")
      .select("id", { count: "exact", head: true })
      .in("status", ["accepted", "in_progress", "completed"]),
    admin
      .from("qr_matches")
      .select("id", { count: "exact", head: true })
      .eq("winner_is_anonymous", true),
    admin
      .from("anonymous_pending_payouts")
      .select("id", { count: "exact", head: true })
      .eq("claimed", true),
  ]);

  const hostIds = new Set<string>();
  const oppIds = new Set<string>();
  for (const row of recentQr ?? []) {
    if (row.host_user_id) hostIds.add(row.host_user_id as string);
    if (row.opponent_user_id) oppIds.add(row.opponent_user_id as string);
    if (row.winner_user_id) oppIds.add(row.winner_user_id as string);
  }

  const { data: profiles } = hostIds.size
    ? await admin
        .from("profiles")
        .select("id, username")
        .in("id", Array.from(new Set([...hostIds, ...oppIds])))
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));

  const matches = (recentQr ?? []).map((row) => {
    const host = profileMap.get(row.host_user_id as string) ?? "unknown";
    let opponent = "anonymous";
    if (!row.opponent_is_anonymous && row.opponent_user_id) {
      opponent = profileMap.get(row.opponent_user_id as string) ?? "unknown";
    }
    let outcome = "—";
    if (row.status === "completed") {
      if (row.winner_is_anonymous) outcome = "anonymous win";
      else if (row.winner_user_id) {
        outcome = profileMap.get(row.winner_user_id as string) === host ? "host win" : "opponent win";
      }
    }
    return {
      id: row.id as string,
      idShort: truncateId(row.id as string),
      host,
      game: row.game as string,
      stakeSK: row.stake_sk as number,
      status: row.status as string,
      opponent,
      outcome,
      createdAt: row.created_at as string,
    };
  });

  const payouts = (pendingPayouts ?? []).map((p) => {
    const expiresAt = new Date(p.expires_at as string).getTime();
    const daysLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
    return {
      id: p.id as string,
      amountSK: p.amount_sk as number,
      createdAt: p.created_at as string,
      expiresAt: p.expires_at as string,
      daysUntilExpiry: daysLeft,
      claimed: p.claimed as boolean,
      claimedAt: p.claimed_at as string | null,
    };
  });

  const acceptRate =
    totalCreated && totalCreated > 0 ? Math.round(((totalAccepted ?? 0) / totalCreated) * 100) : 0;
  const conversionRate =
    anonWins && anonWins > 0 ? Math.round(((anonClaims ?? 0) / anonWins) * 100) : 0;

  return jsonOk({
    matches,
    payouts,
    stats: {
      totalCreated: totalCreated ?? 0,
      acceptRate,
      anonymousWinToSignupRate: conversionRate,
    },
  });
}
