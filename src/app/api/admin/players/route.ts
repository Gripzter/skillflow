import { NextRequest } from "next/server";
import { jsonOk, requireAdmin, skToUsd, SKILLIES_PER_USD } from "@/lib/admin-api";
import { countryFlag } from "@/lib/admin-intelligence";

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") ?? "").trim().toLowerCase();
  const country = searchParams.get("country");
  const banned = searchParams.get("banned");
  const minBalance = Number(searchParams.get("minBalance") ?? 0);
  const minMatches = Number(searchParams.get("minMatches") ?? 0);

  const { data: profiles, error } = await admin
    .from("profiles")
    .select(
      "id, username, balance_sp, total_matches, banned, suspicious, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) return jsonOk({ error: error.message }, 500);

  const userIds = (profiles ?? []).map((p) => p.id as string);

  const [{ data: authData }, { data: geoRows }, { data: deposits }, { data: withdrawals }, { data: flags }, { data: sessions }] =
    await Promise.all([
      admin.auth.admin.listUsers({ perPage: 1000 }),
      userIds.length
        ? admin
            .from("geo_checks")
            .select("user_id, country")
            .in("user_id", userIds)
            .order("checked_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      admin.from("transactions").select("user_id, amount").eq("type", "deposit"),
      admin.from("transactions").select("user_id, amount").eq("type", "withdrawal"),
      userIds.length
        ? admin.from("cheat_flags").select("player_id").eq("reviewed", false).in("player_id", userIds)
        : Promise.resolve({ data: [] }),
      userIds.length
        ? admin
            .from("player_sessions")
            .select("user_id, created_at")
            .in("user_id", userIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

  const emailMap = new Map((authData?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const countryMap = new Map<string, string>();
  for (const g of geoRows ?? []) {
    if (!countryMap.has(g.user_id as string) && g.country) {
      countryMap.set(g.user_id as string, g.country as string);
    }
  }

  const depositMap = new Map<string, number>();
  for (const d of deposits ?? []) {
    depositMap.set(
      d.user_id as string,
      (depositMap.get(d.user_id as string) ?? 0) + Number(d.amount)
    );
  }
  const withdrawalMap = new Map<string, number>();
  for (const w of withdrawals ?? []) {
    withdrawalMap.set(
      w.user_id as string,
      (withdrawalMap.get(w.user_id as string) ?? 0) + Math.abs(Number(w.amount))
    );
  }

  const flaggedSet = new Set((flags ?? []).map((f) => f.player_id as string));
  const lastActiveMap = new Map<string, string>();
  for (const s of sessions ?? []) {
    if (!lastActiveMap.has(s.user_id as string)) {
      lastActiveMap.set(s.user_id as string, s.created_at as string);
    }
  }

  const { data: userMatches } = userIds.length
    ? await admin
        .from("matches")
        .select("player1_id, player2_id, player_a, player_b, winner_id, stake_sp, stake_amount")
        .or(
          userIds
            .slice(0, 50)
            .flatMap((id) => [
              `player1_id.eq.${id}`,
              `player2_id.eq.${id}`,
              `player_a.eq.${id}`,
              `player_b.eq.${id}`,
            ])
            .join(",")
        )
        .limit(5000)
    : { data: [] };

  const wagerMap = new Map<string, number>();
  const winMap = new Map<string, number>();
  const playedMap = new Map<string, number>();
  for (const m of userMatches ?? []) {
    for (const id of [m.player1_id, m.player2_id, m.player_a, m.player_b]) {
      if (!id) continue;
      const uid = id as string;
      wagerMap.set(uid, (wagerMap.get(uid) ?? 0) + Number(m.stake_sp ?? m.stake_amount ?? 0));
      playedMap.set(uid, (playedMap.get(uid) ?? 0) + 1);
      if (m.winner_id === uid) winMap.set(uid, (winMap.get(uid) ?? 0) + 1);
    }
  }

  let rows = (profiles ?? []).map((p) => {
    const id = p.id as string;
    const played = playedMap.get(id) ?? Number(p.total_matches ?? 0);
    const wins = winMap.get(id) ?? 0;
    const country = countryMap.get(id) ?? "—";
    return {
      id: p.id,
      username: p.username,
      email: emailMap.get(id) ?? "—",
      joinedAt: p.created_at,
      totalMatches: Number(p.total_matches ?? 0),
      totalDepositedUSD: depositMap.get(id) ?? 0,
      totalWithdrawnUSD: withdrawalMap.get(id) ?? 0,
      balanceSK: Number(p.balance_sp ?? 0),
      balanceUSD: skToUsd(Number(p.balance_sp ?? 0)),
      country,
      countryFlag: countryFlag(country),
      lastActive: lastActiveMap.get(id) ?? p.created_at,
      winRate: played > 0 ? Math.round((wins / played) * 1000) / 10 : 0,
      totalWageredSK: wagerMap.get(id) ?? 0,
      suspicious: flaggedSet.has(id) || Boolean(p.suspicious),
      banned: Boolean(p.banned),
    };
  });

  if (search) {
    rows = rows.filter(
      (r) =>
        r.username.toLowerCase().includes(search) ||
        r.email.toLowerCase().includes(search)
    );
  }
  if (country && country !== "all") {
    rows = rows.filter((r) => r.country === country);
  }
  if (banned === "true") rows = rows.filter((r) => r.banned);
  if (banned === "false") rows = rows.filter((r) => !r.banned);
  if (minBalance > 0) rows = rows.filter((r) => r.balanceSK >= minBalance);
  if (minMatches > 0) rows = rows.filter((r) => r.totalMatches >= minMatches);

  return jsonOk({ players: rows });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const body = (await req.json()) as { userId?: string; banned?: boolean };
  if (!body.userId || body.banned === undefined) {
    return jsonOk({ error: "userId and banned required" }, 400);
  }

  const { error } = await admin
    .from("profiles")
    .update({ banned: body.banned })
    .eq("id", body.userId);

  if (error) return jsonOk({ error: error.message }, 400);

  if (body.banned) {
    await admin.auth.admin.signOut(body.userId, "global");
  }

  return jsonOk({ success: true });
}
