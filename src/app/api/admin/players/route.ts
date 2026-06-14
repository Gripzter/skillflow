import { NextRequest } from "next/server";
import { jsonOk, requireAdmin, skToUsd, SKILLIES_PER_USD } from "@/lib/admin-api";

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
      "id, username, balance_sp, total_matches, banned, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) return jsonOk({ error: error.message }, 500);

  const userIds = (profiles ?? []).map((p) => p.id as string);

  const [{ data: authData }, { data: geoRows }, { data: deposits }, { data: withdrawals }] =
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

  let rows = (profiles ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    email: emailMap.get(p.id as string) ?? "—",
    joinedAt: p.created_at,
    totalMatches: Number(p.total_matches ?? 0),
    totalDepositedUSD: depositMap.get(p.id as string) ?? 0,
    totalWithdrawnUSD: withdrawalMap.get(p.id as string) ?? 0,
    balanceSK: Number(p.balance_sp ?? 0),
    balanceUSD: skToUsd(Number(p.balance_sp ?? 0)),
    country: countryMap.get(p.id as string) ?? "—",
    banned: Boolean(p.banned),
  }));

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
