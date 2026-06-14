import { NextRequest } from "next/server";
import { jsonOk, requireAdmin, skToUsd } from "@/lib/admin-api";
import { getCreatorEmailByUserId, sendCreatorEmail } from "@/lib/send-creator-email";

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "all";
  const search = (searchParams.get("search") ?? "").trim().toLowerCase();

  let query = admin
    .from("creator_games")
    .select(
      "id, creator_id, game_name, game_id, status, total_matches, total_earned_sk, revenue_share_pct, created_at"
    )
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data: games, error } = await query;
  if (error) return jsonOk({ error: error.message }, 500);

  const creatorIds = Array.from(new Set((games ?? []).map((g) => g.creator_id as string)));

  const [{ data: profiles }, { data: authData }] = await Promise.all([
    creatorIds.length
      ? admin.from("profiles").select("id, username").in("id", creatorIds)
      : Promise.resolve({ data: [] }),
    creatorIds.length
      ? admin.auth.admin.listUsers({ perPage: 1000 })
      : Promise.resolve({ data: { users: [] } }),
  ]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));
  const emailMap = new Map(
    (authData?.users ?? []).map((u) => [u.id, u.email ?? ""])
  );

  let rows = (games ?? []).map((g) => ({
    id: g.id,
    creatorId: g.creator_id,
    creatorName: profileMap.get(g.creator_id as string) ?? "—",
    email: emailMap.get(g.creator_id as string) ?? "—",
    gameName: g.game_name,
    gameId: g.game_id,
    status: g.status,
    totalMatches: g.total_matches,
    totalEarnedSK: Number(g.total_earned_sk),
    totalEarnedUSD: skToUsd(Number(g.total_earned_sk)),
    revenueSharePct: Number(g.revenue_share_pct),
    joinedAt: g.created_at,
  }));

  if (search) {
    rows = rows.filter(
      (r) =>
        r.creatorName.toLowerCase().includes(search) ||
        r.gameName.toLowerCase().includes(search) ||
        r.gameId.toLowerCase().includes(search) ||
        r.email.toLowerCase().includes(search)
    );
  }

  return jsonOk({ creators: rows });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const body = (await req.json()) as {
    gameId?: string;
    status?: string;
    revenueSharePct?: number;
  };

  if (!body.gameId) {
    return jsonOk({ error: "gameId required" }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (body.status) updates.status = body.status;
  if (body.revenueSharePct !== undefined) {
    updates.revenue_share_pct = Math.min(30, Math.max(20, body.revenueSharePct));
  }

  const { data: existing } = await admin
    .from("creator_games")
    .select("status, creator_id, game_name")
    .eq("game_id", body.gameId)
    .single();

  const { data, error } = await admin
    .from("creator_games")
    .update(updates)
    .eq("game_id", body.gameId)
    .select("*")
    .single();

  if (error) return jsonOk({ error: error.message }, 400);

  if (body.status === "active" && existing?.status === "pending" && data) {
    const email = await getCreatorEmailByUserId(data.creator_id as string);
    if (email) {
      void sendCreatorEmail({
        type: "approved",
        to: email,
        gameName: data.game_name as string,
      });
    }
  }

  return jsonOk({ game: data });
}
