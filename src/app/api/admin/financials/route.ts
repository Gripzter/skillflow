import { NextRequest } from "next/server";
import { jsonOk, requireAdmin, skToUsd, SKILLIES_PER_USD } from "@/lib/admin-api";

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const [{ data: profiles }, { data: earnings }, { data: deposits }, { data: withdrawals }] =
    await Promise.all([
      admin.from("profiles").select("balance_sp"),
      admin.from("creator_earnings").select("earned_sk, earned_usd, paid_out, creator_id, created_at"),
      admin.from("transactions").select("amount, created_at").eq("type", "deposit"),
      admin.from("transactions").select("amount, created_at").eq("type", "withdrawal"),
    ]);

  const poolBalanceSK = (profiles ?? []).reduce((s, p) => s + Number(p.balance_sp ?? 0), 0);
  const totalDepositedUSD = (deposits ?? []).reduce((s, d) => s + Number(d.amount), 0);
  const totalWithdrawnUSD = (withdrawals ?? []).reduce(
    (s, w) => s + Math.abs(Number(w.amount)),
    0
  );

  const totalCreatorEarnedSK = (earnings ?? []).reduce((s, e) => s + Number(e.earned_sk), 0);
  const totalRakeSK = Math.floor(totalCreatorEarnedSK / 0.2);
  const pendingCreatorUSD = (earnings ?? [])
    .filter((e) => !e.paid_out)
    .reduce((s, e) => s + Number(e.earned_usd), 0);
  const paidCreatorUSD = (earnings ?? [])
    .filter((e) => e.paid_out)
    .reduce((s, e) => s + Number(e.earned_usd), 0);

  const xsollaFeesUSD = totalDepositedUSD * 0.05;
  const skillflowNetUSD = skToUsd(Math.floor(totalRakeSK * 0.8)) - paidCreatorUSD;

  const monthlyMap = new Map<
    string,
    { deposits: number; withdrawals: number; creatorPayouts: number }
  >();

  for (const d of deposits ?? []) {
    const key = (d.created_at as string).slice(0, 7);
    const row = monthlyMap.get(key) ?? { deposits: 0, withdrawals: 0, creatorPayouts: 0 };
    row.deposits += Number(d.amount);
    monthlyMap.set(key, row);
  }
  for (const w of withdrawals ?? []) {
    const key = (w.created_at as string).slice(0, 7);
    const row = monthlyMap.get(key) ?? { deposits: 0, withdrawals: 0, creatorPayouts: 0 };
    row.withdrawals += Math.abs(Number(w.amount));
    monthlyMap.set(key, row);
  }
  for (const e of earnings ?? []) {
    if (!e.paid_out) continue;
    const key = (e.created_at as string).slice(0, 7);
    const row = monthlyMap.get(key) ?? { deposits: 0, withdrawals: 0, creatorPayouts: 0 };
    row.creatorPayouts += Number(e.earned_usd);
    monthlyMap.set(key, row);
  }

  const monthlyPnL = Array.from(monthlyMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, row]) => {
      const rakeUSD = row.deposits * 0.12 * 0.8;
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

  return jsonOk({
    summary: {
      poolBalanceSK,
      poolBalanceUSD: skToUsd(poolBalanceSK),
      totalDepositedUSD,
      totalWithdrawnUSD,
      totalRakeSK,
      totalRakeUSD: skToUsd(totalRakeSK),
      pendingCreatorPayoutsUSD: pendingCreatorUSD,
      paidCreatorPayoutsUSD: paidCreatorUSD,
      xsollaFeesUSD,
      netPlatformRevenueUSD: skillflowNetUSD,
    },
    monthlyPnL,
    pendingPayouts,
  });
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const body = (await req.json()) as { creatorId?: string; action?: string };
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
