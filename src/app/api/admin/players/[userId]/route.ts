import { NextRequest } from "next/server";
import { jsonOk, requireAdmin, skToUsd } from "@/lib/admin-api";
import { countryFlag } from "@/lib/admin-intelligence";

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const userId = params.userId;

  const [
    { data: profile },
    { data: authUser },
    { data: geo },
    { data: deposits },
    { data: withdrawals },
    { data: transactions },
    { data: sessions },
    { data: notes },
    { data: flags },
    { data: adjustments },
    { data: wallet },
  ] = await Promise.all([
    admin.from("profiles").select("*").eq("id", userId).single(),
    admin.auth.admin.getUserById(userId),
    admin
      .from("geo_checks")
      .select("country")
      .eq("user_id", userId)
      .order("checked_at", { ascending: false })
      .limit(1),
    admin.from("transactions").select("amount").eq("user_id", userId).eq("type", "deposit"),
    admin.from("transactions").select("amount").eq("user_id", userId).eq("type", "withdrawal"),
    admin
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("player_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("admin_notes")
      .select("*")
      .eq("target_type", "player")
      .eq("target_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("cheat_flags")
      .select("*")
      .eq("player_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("admin_balance_adjustments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    admin.from("wallets").select("balance").eq("user_id", userId).maybeSingle(),
  ]);

  if (!profile) return jsonOk({ error: "Player not found" }, 404);

  const { data: matches } = await admin
    .from("matches")
    .select(
      "id, game_type, creator_game_id, stake_sp, stake_amount, state, status, created_at, winner_id, player1_id, player2_id, player_a, player_b, completed_at, settled_at, match_duration"
    )
    .or(`player1_id.eq.${userId},player2_id.eq.${userId},player_a.eq.${userId},player_b.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(100);

  const wins = (matches ?? []).filter((m) => m.winner_id === userId).length;
  const totalPlayed = matches?.length ?? 0;
  const totalWageredSK = (matches ?? []).reduce((s, m) => s + Number(m.stake_sp ?? m.stake_amount ?? 0), 0);
  const totalDepositedUSD = (deposits ?? []).reduce((s, d) => s + Number(d.amount), 0);
  const totalWithdrawnUSD = (withdrawals ?? []).reduce((s, w) => s + Math.abs(Number(w.amount)), 0);

  const opponentIds = new Set<string>();
  for (const m of matches ?? []) {
    for (const id of [m.player1_id, m.player2_id, m.player_a, m.player_b]) {
      if (id && id !== userId) opponentIds.add(id as string);
    }
  }
  const { data: opponents } = opponentIds.size
    ? await admin.from("profiles").select("id, username").in("id", Array.from(opponentIds))
    : { data: [] };
  const opponentMap = new Map((opponents ?? []).map((p) => [p.id, p.username]));

  const matchHistory = (matches ?? []).map((m) => {
    const stake = Number(m.stake_sp ?? m.stake_amount ?? 0);
    const won = m.winner_id === userId;
    const voided = m.status === "voided" || m.state === "voided";
    const oppId = [m.player1_id, m.player2_id, m.player_a, m.player_b].find((id) => id && id !== userId);
    return {
      id: m.id,
      date: m.created_at,
      game: m.creator_game_id ?? m.game_type,
      opponent: oppId ? opponentMap.get(oppId as string) ?? "bot" : "bot",
      entrySK: stake,
      result: voided ? "void" : won ? "won" : m.winner_id ? "lost" : "void",
      earningsSK: voided ? 0 : won ? stake : -stake,
      durationSec: m.match_duration,
      suspicious: false,
    };
  });

  const walletBalance = Number(wallet?.balance ?? 0);
  let runningBalance = walletBalance;
  const financialHistory = (transactions ?? []).map((t) => {
    const amt = Number(t.amount);
    const row = {
      id: t.id,
      date: t.created_at,
      type: t.type,
      amountUSD: t.type === "deposit" ? amt : -Math.abs(amt),
      status: "completed",
      transactionId: t.id,
      balanceAfterSK: runningBalance,
    };
    return row;
  });

  const sessionIps = new Set((sessions ?? []).map((s) => s.ip).filter(Boolean));
  const { data: otherSessions } = sessionIps.size
    ? await admin
        .from("player_sessions")
        .select("user_id, ip")
        .in("ip", Array.from(sessionIps) as string[])
        .neq("user_id", userId)
    : { data: [] };
  const sharedIpUsers = new Set((otherSessions ?? []).map((s) => s.user_id));

  return jsonOk({
    player: {
      id: profile.id,
      username: profile.username,
      email: authUser.user?.email ?? "—",
      banned: Boolean(profile.banned),
      suspicious: Boolean(profile.suspicious),
      country: geo?.[0]?.country ?? "—",
      countryFlag: countryFlag(geo?.[0]?.country as string ?? "—"),
      balanceSK: walletBalance,
      balanceUSD: skToUsd(walletBalance),
      totalMatches: Number(profile.total_matches ?? 0),
      wins,
      winRate: totalPlayed > 0 ? Math.round((wins / totalPlayed) * 1000) / 10 : 0,
      totalWageredSK,
      totalDepositedUSD,
      totalWithdrawnUSD,
      joinedAt: profile.created_at,
      lastActive: sessions?.[0]?.created_at ?? profile.created_at,
    },
    matchHistory,
    financialHistory,
    sessions: (sessions ?? []).map((s) => ({
      ...s,
      sharedIp: sharedIpUsers.size > 0,
    })),
    notes: notes ?? [],
    cheatAnalysis: {
      winRate: totalPlayed > 0 ? (wins / totalPlayed) * 100 : 0,
      platformAvgWinRate: 50,
      flags: flags ?? [],
      sharedIpCount: sharedIpUsers.size,
    },
    adjustments: adjustments ?? [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const body = (await req.json()) as {
    banned?: boolean;
    suspicious?: boolean;
  };

  const updates: Record<string, boolean> = {};
  if (body.banned !== undefined) updates.banned = body.banned;
  if (body.suspicious !== undefined) updates.suspicious = body.suspicious;

  const { error } = await admin.from("profiles").update(updates).eq("id", params.userId);
  if (error) return jsonOk({ error: error.message }, 400);

  if (body.banned) {
    await admin.auth.admin.signOut(params.userId, "global");
  }

  return jsonOk({ success: true });
}
