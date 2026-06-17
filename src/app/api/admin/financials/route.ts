import { NextRequest } from "next/server";
import { jsonOk, matchRakeSK, requireAdmin, skToUsd, usdToSk } from "@/lib/admin-api";

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const [{ data: wallets }, { data: earnings }, { data: deposits }, { data: withdrawals }, { data: completedMatches }, { data: settings }] =
    await Promise.all([
      admin.from("wallets").select("balance"),
      admin.from("creator_earnings").select("earned_sk, earned_usd, paid_out, creator_id, created_at"),
      admin.from("transactions").select("amount, created_at").eq("type", "deposit"),
      admin.from("transactions").select("amount, created_at").eq("type", "withdrawal"),
      admin
        .from("matches")
        .select("rake_amount, stake_sp, completed_at, settled_at, created_at")
        .eq("status", "completed"),
      admin.from("platform_settings").select("value").eq("key", "fixed_costs_usd").maybeSingle(),
    ]);

  const poolBalanceSK = (wallets ?? []).reduce((s, w) => s + Number(w.balance ?? 0), 0);
  const totalDepositedUSD = (deposits ?? []).reduce((s, d) => s + Number(d.amount), 0);
  const totalWithdrawnUSD = (withdrawals ?? []).reduce(
    (s, w) => s + Math.abs(Number(w.amount)),
    0
  );

  const totalRakeSK = (completedMatches ?? []).reduce((s, m) => s + matchRakeSK(m), 0);
  const pendingCreatorUSD = (earnings ?? [])
    .filter((e) => !e.paid_out)
    .reduce((s, e) => s + Number(e.earned_usd), 0);
  const paidCreatorUSD = (earnings ?? [])
    .filter((e) => e.paid_out)
    .reduce((s, e) => s + Number(e.earned_usd), 0);

  const xsollaFeesUSD = totalDepositedUSD * 0.05;
  const totalRakeUSD = skToUsd(totalRakeSK);
  const netPlatformRevenueUSD = totalRakeUSD - paidCreatorUSD;

  const monthlyMap = new Map<
    string,
    { deposits: number; withdrawals: number; creatorPayouts: number; rakeSK: number }
  >();

  for (const d of deposits ?? []) {
    const key = (d.created_at as string).slice(0, 7);
    const row = monthlyMap.get(key) ?? { deposits: 0, withdrawals: 0, creatorPayouts: 0, rakeSK: 0 };
    row.deposits += Number(d.amount);
    monthlyMap.set(key, row);
  }
  for (const w of withdrawals ?? []) {
    const key = (w.created_at as string).slice(0, 7);
    const row = monthlyMap.get(key) ?? { deposits: 0, withdrawals: 0, creatorPayouts: 0, rakeSK: 0 };
    row.withdrawals += Math.abs(Number(w.amount));
    monthlyMap.set(key, row);
  }
  for (const e of earnings ?? []) {
    if (!e.paid_out) continue;
    const key = (e.created_at as string).slice(0, 7);
    const row = monthlyMap.get(key) ?? { deposits: 0, withdrawals: 0, creatorPayouts: 0, rakeSK: 0 };
    row.creatorPayouts += Number(e.earned_usd);
    monthlyMap.set(key, row);
  }
  for (const m of completedMatches ?? []) {
    const ts = (m.completed_at ?? m.settled_at ?? m.created_at) as string;
    const key = ts.slice(0, 7);
    const row = monthlyMap.get(key) ?? { deposits: 0, withdrawals: 0, creatorPayouts: 0, rakeSK: 0 };
    row.rakeSK += matchRakeSK(m);
    monthlyMap.set(key, row);
  }

  const monthlyPnL = Array.from(monthlyMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, row]) => {
      const rakeUSD = skToUsd(row.rakeSK);
      const xsolla = row.deposits * 0.05;
      const net = rakeUSD - row.creatorPayouts - xsolla;
      return {
        month,
        depositsUSD: row.deposits,
        withdrawalsUSD: row.withdrawals,
        rakeUSD,
        creatorPayoutsUSD: row.creatorPayouts,
        xsollaFeesUSD: xsolla,
        netRevenueUSD: net,
      };
    });

  const pendingByCreator = new Map<string, { earnedUSD: number; earnedSK: number }>();
  for (const e of earnings ?? []) {
    if (e.paid_out) continue;
    const key = e.creator_id as string;
    const row = pendingByCreator.get(key) ?? { earnedUSD: 0, earnedSK: 0 };
    row.earnedUSD += Number(e.earned_usd);
    row.earnedSK += Number(e.earned_sk);
    pendingByCreator.set(key, row);
  }

  const creatorIds = Array.from(pendingByCreator.keys());
  const { data: creatorProfiles } = creatorIds.length
    ? await admin.from("profiles").select("id, username").in("id", creatorIds)
    : { data: [] };
  const nameMap = new Map((creatorProfiles ?? []).map((p) => [p.id, p.username]));

  const pendingPayouts = creatorIds.map((id) => ({
    creatorId: id,
    creatorName: nameMap.get(id) ?? "—",
    pendingUSD: pendingByCreator.get(id)!.earnedUSD,
    pendingSK: pendingByCreator.get(id)!.earnedSK,
  }));

  const profilesBalanceSK = poolBalanceSK;
  const expectedPoolSK = usdToSk(totalDepositedUSD - totalWithdrawnUSD);
  const poolDeltaSK = profilesBalanceSK - expectedPoolSK;
  const poolDeltaPct =
    expectedPoolSK > 0 ? Math.round((poolDeltaSK / expectedPoolSK) * 1000) / 10 : 0;
  const poolHealthLevel =
    Math.abs(poolDeltaPct) <= 2 ? "green" : Math.abs(poolDeltaPct) <= 10 ? "yellow" : "red";

  const fixedCostsUSD = Number(settings?.value ?? 0);

  const dailyMap = new Map<string, number>();
  const today = new Date();
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dailyMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const m of completedMatches ?? []) {
    const ts = (m.completed_at ?? m.settled_at ?? m.created_at) as string;
    const day = ts.slice(0, 10);
    if (!dailyMap.has(day)) continue;
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + skToUsd(matchRakeSK(m)));
  }
  const dailyRevenue30 = Array.from(dailyMap.entries()).map(([date, revenueUSD]) => ({
    date,
    label: date.slice(5),
    revenueUSD,
    amount: revenueUSD,
  }));

  return jsonOk({
    summary: {
      poolBalanceSK,
      poolBalanceUSD: skToUsd(poolBalanceSK),
      totalDepositedUSD,
      totalWithdrawnUSD,
      totalRakeSK,
      totalRakeUSD,
      pendingCreatorPayoutsUSD: pendingCreatorUSD,
      paidCreatorPayoutsUSD: paidCreatorUSD,
      xsollaFeesUSD,
      netPlatformRevenueUSD,
    },
    poolHealth: {
      profilesBalanceSK,
      profilesBalanceUSD: skToUsd(profilesBalanceSK),
      expectedPoolSK,
      expectedPoolUSD: skToUsd(expectedPoolSK),
      deltaSK: poolDeltaSK,
      deltaUSD: skToUsd(poolDeltaSK),
      deltaPct: poolDeltaPct,
      level: poolHealthLevel,
    },
    dailyRevenue30,
    fixedCostsUSD,
    monthlyPnL,
    pendingPayouts,
  });
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const body = (await req.json()) as { creatorId?: string; action?: string };
  if (body.action === "pay_all") {
    const { error } = await admin
      .from("creator_earnings")
      .update({ paid_out: true })
      .eq("paid_out", false);
    if (error) return jsonOk({ error: error.message }, 400);
    return jsonOk({ success: true });
  }

  if (body.action !== "mark_paid" || !body.creatorId) {
    return jsonOk({ error: "Invalid request" }, 400);
  }

  const { error } = await admin
    .from("creator_earnings")
    .update({ paid_out: true })
    .eq("creator_id", body.creatorId)
    .eq("paid_out", false);

  if (error) return jsonOk({ error: error.message }, 400);
  return jsonOk({ success: true });
}
