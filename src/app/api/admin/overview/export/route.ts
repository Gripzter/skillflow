import { NextRequest } from "next/server";
import { jsonOk, requireAdmin, skToUsd } from "@/lib/admin-api";
import { revenueFromCreatorEarnedSK } from "@/lib/admin-intelligence";

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { count: matchCount },
    { data: earnings },
    { count: disputeCount },
    { data: wallets },
  ] = await Promise.all([
    admin
      .from("matches")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
    admin.from("creator_earnings").select("earned_sk").gte("created_at", todayStart.toISOString()),
    admin
      .from("disputes")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
    admin.from("wallets").select("balance"),
  ]);

  const revenueSK = (earnings ?? []).reduce(
    (s, e) => s + revenueFromCreatorEarnedSK(Number(e.earned_sk)),
    0
  );
  const poolSK = (wallets ?? []).reduce((s, w) => s + Number(w.balance ?? 0), 0);

  const rows = [
    ["metric", "value"],
    ["date", todayStart.toISOString().slice(0, 10)],
    ["matches_today", String(matchCount ?? 0)],
    ["revenue_sk", String(revenueSK)],
    ["revenue_usd", skToUsd(revenueSK).toFixed(2)],
    ["pool_balance_sk", String(poolSK)],
    ["disputes_today", String(disputeCount ?? 0)],
  ];

  const csv = rows.map((r) => r.join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="skillflow-daily-${todayStart.toISOString().slice(0, 10)}.csv"`,
    },
  });
}
