import { NextRequest } from "next/server";
import { jsonOk, requireAdmin, skToUsd } from "@/lib/admin-api";

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const userId = params.userId;

  const [{ data: profile }, { data: authUser }, { data: matches }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", userId).single(),
    admin.auth.admin.getUserById(userId),
    admin
      .from("matches")
      .select("id, game_type, stake_sp, state, status, created_at, winner_id")
      .or(`player1_id.eq.${userId},player2_id.eq.${userId},player_a.eq.${userId},player_b.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!profile) return jsonOk({ error: "Player not found" }, 404);

  const wins = (matches ?? []).filter((m) => m.winner_id === userId).length;

  return jsonOk({
    player: {
      id: profile.id,
      username: profile.username,
      email: authUser.user?.email ?? "—",
      banned: Boolean(profile.banned),
      balanceSK: Number(profile.balance_sp ?? 0),
      balanceUSD: skToUsd(Number(profile.balance_sp ?? 0)),
      totalMatches: Number(profile.total_matches ?? 0),
      wins,
      joinedAt: profile.created_at,
    },
    recentMatches: matches ?? [],
  });
}
