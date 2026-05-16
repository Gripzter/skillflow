"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import RevenueChart from "@/components/admin/RevenueChart";
import type { RevenueDataPoint } from "@/components/admin/RevenueChart";
import LoadingRing from "@/components/LoadingRing";

type Period = "daily" | "weekly" | "monthly";

interface RevSummary {
  deposits: number;
  withdrawals: number;
  matchFees: number;
  withdrawalFees: number;
  stripeFees: number;
  netProfit: number;
}

interface TxRow {
  type: string;
  amount: number;
  created_at: string;
}

interface MatchFeeRow {
  platform_fee: number;
  stake_amount: number;
  created_at: string;
}

function bucketDate(iso: string, period: Period): string {
  const d = new Date(iso);
  if (period === "daily") return d.toISOString().slice(0, 10);
  if (period === "weekly") {
    // ISO week start (Monday)
    const day = d.getDay() || 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - day + 1);
    return monday.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 7); // YYYY-MM
}

function bucketLabel(key: string, period: Period): string {
  if (period === "monthly") {
    const [y, m] = key.split("-");
    return new Date(+y, +m - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  const d = new Date(key + "T00:00:00");
  if (period === "weekly") return `Wk ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildChartData(matchFees: MatchFeeRow[], period: Period): RevenueDataPoint[] {
  const byBucket: Record<string, number> = {};
  matchFees.forEach((m) => {
    const key = bucketDate(m.created_at, period);
    byBucket[key] = (byBucket[key] || 0) + (m.platform_fee || 0);
  });

  const sorted = Object.entries(byBucket).sort(([a], [b]) => a.localeCompare(b));
  return sorted.map(([key, amount]) => ({
    date: key,
    amount: Math.round(amount * 100) / 100,
    label: bucketLabel(key, period),
  }));
}

export default function AdminRevenuePage() {
  const [period, setPeriod] = useState<Period>("daily");
  const [loading, setLoading] = useState(true);
  const [txRows, setTxRows] = useState<TxRow[]>([]);
  const [matchFees, setMatchFees] = useState<MatchFeeRow[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) { setLoading(false); return; }

      const [{ data: txData }, { data: mData }] = await Promise.all([
        supabase
          .from("transactions")
          .select("type, amount, created_at")
          .order("created_at"),
        supabase
          .from("matches")
          .select("platform_fee, stake_amount, created_at")
          .eq("status", "completed")
          .order("created_at"),
      ]);

      setTxRows(txData ?? []);
      setMatchFees(mData ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const summary = useMemo((): RevSummary => {
    const deposits = txRows
      .filter((t) => t.type === "deposit" && t.amount > 0)
      .reduce((s, t) => s + t.amount, 0);

    const withdrawals = txRows
      .filter((t) => t.type === "withdrawal")
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    const matchFeesTotal = matchFees.reduce((s, m) => s + (m.platform_fee || 0), 0);

    // Stripe deposit fees: 2.9% + $0.30 per deposit transaction
    const depositTxCount = txRows.filter((t) => t.type === "deposit" && t.amount > 0).length;
    const stripeFees = deposits * 0.029 + depositTxCount * 0.3;

    // Withdrawal payout fees: ~0.25% (Stripe Connect)
    const withdrawalFees = withdrawals * 0.0025;

    const netProfit = matchFeesTotal - stripeFees - withdrawalFees;

    return {
      deposits,
      withdrawals,
      matchFees: matchFeesTotal,
      withdrawalFees,
      stripeFees,
      netProfit,
    };
  }, [txRows, matchFees]);

  const chartData = useMemo(() => buildChartData(matchFees, period), [matchFees, period]);

  if (loading) {
    return <LoadingRing />;
  }

  const statCards = [
    {
      label: "Total Deposits",
      value: summary.deposits,
      color: "text-green-400",
      hint: "Sum of all user deposits",
    },
    {
      label: "Total Withdrawals",
      value: summary.withdrawals,
      color: "text-red-400",
      hint: "Sum of all user withdrawals",
    },
    {
      label: "Match Fees (Platform)",
      value: summary.matchFees,
      color: "text-[#FFFF00]",
      hint: "5% cut from completed matches",
    },
    {
      label: "Stripe Fees (est.)",
      value: summary.stripeFees,
      color: "text-yellow-400",
      hint: "2.9% + $0.30 per deposit",
    },
    {
      label: "Withdrawal Fees (est.)",
      value: summary.withdrawalFees,
      color: "text-yellow-400",
      hint: "~0.25% Stripe Connect payout",
    },
    {
      label: "Net Profit",
      value: summary.netProfit,
      color: summary.netProfit >= 0 ? "text-green-400" : "text-red-400",
      hint: "Match fees − Stripe fees − payout fees",
    },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Revenue</h1>

      {/* Summary stat cards */}
      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((c) => (
          <div key={c.label} className="rounded-xl border border-white/5 bg-admin-card p-5">
            <p className="text-xs font-medium text-[#9CA3AF]">{c.label}</p>
            <p className={`mt-2 text-xl font-bold ${c.color}`}>
              ${Math.abs(c.value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-[10px] text-[#6B7280]">{c.hint}</p>
          </div>
        ))}
      </div>

      {/* Line chart */}
      <div className="rounded-xl border border-white/5 bg-admin-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">Platform Revenue (Match Fees)</h2>
          <div className="flex gap-2">
            {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  period === p
                    ? "text-white"
                    : "bg-white/5 text-[#9CA3AF] hover:bg-white/10"
                }`}
                style={period === p ? { background: "#FFFF00", color: "#0E0E12" } : {}}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          {chartData.length > 0 ? (
            <RevenueChart
              data={chartData}
              totalLabel="Total this period"
              averageLabel="Average"
              color="#FFFF00"
            />
          ) : (
            <p className="py-8 text-center text-sm text-[#9CA3AF]">No data yet.</p>
          )}
        </div>
      </div>

      {/* Transaction breakdown table */}
      <div className="rounded-xl border border-white/5 bg-admin-card p-6">
        <h2 className="text-lg font-semibold text-white">Transaction Breakdown</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[#9CA3AF]">
                <th className="pb-3 pr-8 font-medium">Category</th>
                <th className="pb-3 pr-8 font-medium text-right">Count</th>
                <th className="pb-3 pr-8 font-medium text-right">Total Amount</th>
                <th className="pb-3 font-medium text-right">Avg per tx</th>
              </tr>
            </thead>
            <tbody>
              {["deposit", "withdrawal", "match_entry", "match_win", "match_refund"].map((type) => {
                const rows = txRows.filter((t) => t.type === type);
                const total = rows.reduce((s, t) => s + Math.abs(t.amount), 0);
                const avg = rows.length ? total / rows.length : 0;
                return (
                  <tr key={type} className="border-b border-white/5 last:border-0">
                    <td className="py-3 pr-8 font-medium capitalize text-white">
                      {type.replace(/_/g, " ")}
                    </td>
                    <td className="py-3 pr-8 text-right text-[#9CA3AF]">{rows.length}</td>
                    <td className="py-3 pr-8 text-right text-[#9CA3AF]">
                      ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 text-right text-[#9CA3AF]">
                      ${avg.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
