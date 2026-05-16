"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import LoadingRing from "@/components/LoadingRing";

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

interface QuarterRow {
  key: string; // "2025-Q1"
  label: string; // "Q1 2025 (Jan–Mar)"
  deposits: number;
  depositCount: number;
  withdrawals: number;
  matchFees: number;
  matchCount: number;
  stripeFees: number;
  withdrawalFees: number;
  netRevenue: number;
}

const QUARTER_MONTHS: Record<number, { q: number; label: string }> = {
  0: { q: 1, label: "Jan–Mar" }, 1: { q: 1, label: "Jan–Mar" }, 2: { q: 1, label: "Jan–Mar" },
  3: { q: 2, label: "Apr–Jun" }, 4: { q: 2, label: "Apr–Jun" }, 5: { q: 2, label: "Apr–Jun" },
  6: { q: 3, label: "Jul–Sep" }, 7: { q: 3, label: "Jul–Sep" }, 8: { q: 3, label: "Jul–Sep" },
  9: { q: 4, label: "Oct–Dec" }, 10: { q: 4, label: "Oct–Dec" }, 11: { q: 4, label: "Oct–Dec" },
};

function quarterKey(iso: string): string {
  const d = new Date(iso);
  const { q } = QUARTER_MONTHS[d.getMonth()];
  return `${d.getFullYear()}-Q${q}`;
}

function buildQuarters(txRows: TxRow[], matchFees: MatchFeeRow[]): QuarterRow[] {
  const map = new Map<string, QuarterRow>();

  function ensure(key: string, iso: string): QuarterRow {
    if (!map.has(key)) {
      const d = new Date(iso);
      const { q, label } = QUARTER_MONTHS[d.getMonth()];
      map.set(key, {
        key,
        label: `Q${q} ${d.getFullYear()} (${label})`,
        deposits: 0, depositCount: 0, withdrawals: 0,
        matchFees: 0, matchCount: 0,
        stripeFees: 0, withdrawalFees: 0, netRevenue: 0,
      });
    }
    return map.get(key)!;
  }

  txRows.forEach((t) => {
    const row = ensure(quarterKey(t.created_at), t.created_at);
    if (t.type === "deposit" && t.amount > 0) {
      row.deposits += t.amount;
      row.depositCount += 1;
    } else if (t.type === "withdrawal") {
      row.withdrawals += Math.abs(t.amount);
    }
  });

  matchFees.forEach((m) => {
    const row = ensure(quarterKey(m.created_at), m.created_at);
    row.matchFees += m.platform_fee || 0;
    row.matchCount += 1;
  });

  // Compute derived fees
  map.forEach((row) => {
    row.stripeFees = row.deposits * 0.029 + row.depositCount * 0.3;
    row.withdrawalFees = row.withdrawals * 0.0025;
    row.netRevenue = row.matchFees - row.stripeFees - row.withdrawalFees;
  });

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function downloadCSV(rows: QuarterRow[], year: number) {
  const header = [
    "Quarter",
    "Deposits ($)",
    "Deposit Transactions",
    "Withdrawals ($)",
    "Match Fees ($)",
    "Match Count",
    "Stripe Fees est. ($)",
    "Withdrawal Fees est. ($)",
    "Net Revenue ($)",
  ].join(",");

  const lines = rows.map((r) =>
    [
      r.label,
      r.deposits.toFixed(2),
      r.depositCount,
      r.withdrawals.toFixed(2),
      r.matchFees.toFixed(2),
      r.matchCount,
      r.stripeFees.toFixed(2),
      r.withdrawalFees.toFixed(2),
      r.netRevenue.toFixed(2),
    ].join(",")
  );

  // Yearly totals
  const totals = rows.reduce(
    (acc, r) => {
      acc.deposits += r.deposits;
      acc.depositCount += r.depositCount;
      acc.withdrawals += r.withdrawals;
      acc.matchFees += r.matchFees;
      acc.matchCount += r.matchCount;
      acc.stripeFees += r.stripeFees;
      acc.withdrawalFees += r.withdrawalFees;
      acc.netRevenue += r.netRevenue;
      return acc;
    },
    { deposits: 0, depositCount: 0, withdrawals: 0, matchFees: 0, matchCount: 0, stripeFees: 0, withdrawalFees: 0, netRevenue: 0 }
  );
  lines.push(
    [
      `TOTAL ${year}`,
      totals.deposits.toFixed(2),
      totals.depositCount,
      totals.withdrawals.toFixed(2),
      totals.matchFees.toFixed(2),
      totals.matchCount,
      totals.stripeFees.toFixed(2),
      totals.withdrawalFees.toFixed(2),
      totals.netRevenue.toFixed(2),
    ].join(",")
  );

  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `skillflow-tax-${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminTaxPage() {
  const [txRows, setTxRows] = useState<TxRow[]>([]);
  const [matchFees, setMatchFees] = useState<MatchFeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  const availableYears = useMemo(() => {
    const thisYear = new Date().getFullYear();
    return Array.from({ length: 4 }, (_, i) => thisYear - i);
  }, []);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) { setLoading(false); return; }
      const [{ data: tx }, { data: mf }] = await Promise.all([
        supabase.from("transactions").select("type, amount, created_at").order("created_at"),
        supabase.from("matches").select("platform_fee, stake_amount, created_at").eq("status", "completed").order("created_at"),
      ]);
      setTxRows(tx ?? []);
      setMatchFees(mf ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const allQuarters = useMemo(() => buildQuarters(txRows, matchFees), [txRows, matchFees]);

  const yearQuarters = useMemo(
    () => allQuarters.filter((q) => q.key.startsWith(String(year))),
    [allQuarters, year]
  );

  const yearTotals = useMemo(
    () =>
      yearQuarters.reduce(
        (acc, r) => ({
          deposits: acc.deposits + r.deposits,
          withdrawals: acc.withdrawals + r.withdrawals,
          matchFees: acc.matchFees + r.matchFees,
          stripeFees: acc.stripeFees + r.stripeFees,
          withdrawalFees: acc.withdrawalFees + r.withdrawalFees,
          netRevenue: acc.netRevenue + r.netRevenue,
          matchCount: acc.matchCount + r.matchCount,
        }),
        { deposits: 0, withdrawals: 0, matchFees: 0, stripeFees: 0, withdrawalFees: 0, netRevenue: 0, matchCount: 0 }
      ),
    [yearQuarters]
  );

  if (loading) {
    return <LoadingRing />;
  }

  const tdCls = "px-4 py-3 text-right text-[#9CA3AF]";
  const thCls = "px-4 py-3 text-right text-xs font-medium text-[#9CA3AF]";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Tax Report</h1>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-admin-card px-3 py-2 text-sm text-white focus:border-[#FFFF00] focus:outline-none"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => downloadCSV(yearQuarters, year)}
            disabled={yearQuarters.length === 0}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "#FFFF00" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v7M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Year summary cards */}
      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {[
          { label: "Total Deposits", val: yearTotals.deposits, color: "text-green-400" },
          { label: "Total Withdrawals", val: yearTotals.withdrawals, color: "text-red-400" },
          { label: "Match Fees Earned", val: yearTotals.matchFees, color: "text-[#FFFF00]" },
          { label: "Stripe Fees (est.)", val: yearTotals.stripeFees, color: "text-yellow-400" },
          { label: "Withdrawal Fees (est.)", val: yearTotals.withdrawalFees, color: "text-yellow-400" },
          { label: `Net Revenue ${year}`, val: yearTotals.netRevenue, color: yearTotals.netRevenue >= 0 ? "text-green-400" : "text-red-400" },
          { label: "Total Matches", val: yearTotals.matchCount, color: "text-white", isCount: true },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-white/5 bg-admin-card p-5">
            <p className="text-xs font-medium text-[#9CA3AF]">{c.label}</p>
            <p className={`mt-2 text-xl font-bold ${c.color}`}>
              {c.isCount
                ? c.val.toLocaleString()
                : `$${Math.abs(c.val as number).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
        ))}
      </div>

      {/* Quarterly breakdown table */}
      {yearQuarters.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-admin-card p-12 text-center">
          <p className="text-[#9CA3AF]">No data for {year}.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 bg-admin-card">
          <div className="border-b border-white/5 px-6 py-4">
            <h2 className="text-base font-semibold text-white">
              Quarterly Breakdown — {year}
            </h2>
            <p className="mt-0.5 text-xs text-[#6B7280]">
              Stripe fees are estimated at 2.9% + $0.30/deposit. Payout fees at 0.25%.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#9CA3AF]">Quarter</th>
                  <th className={thCls}>Deposits</th>
                  <th className={thCls}>Withdrawals</th>
                  <th className={thCls}>Match Fees</th>
                  <th className={thCls}>Match Count</th>
                  <th className={thCls}>Stripe Fees (est.)</th>
                  <th className={thCls}>Payout Fees (est.)</th>
                  <th className={thCls}>Net Revenue</th>
                </tr>
              </thead>
              <tbody>
                {yearQuarters.map((q) => (
                  <tr key={q.key} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 font-medium text-white">{q.label}</td>
                    <td className={tdCls}>${q.deposits.toFixed(2)}</td>
                    <td className={tdCls}>${q.withdrawals.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-[#FFFF00]">${q.matchFees.toFixed(2)}</td>
                    <td className={tdCls}>{q.matchCount}</td>
                    <td className="px-4 py-3 text-right text-yellow-400">${q.stripeFees.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-yellow-400">${q.withdrawalFees.toFixed(2)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${q.netRevenue >= 0 ? "text-green-400" : "text-red-400"}`}>
                      ${q.netRevenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="border-t border-white/10 bg-white/[0.02]">
                  <td className="px-4 py-3 font-bold text-white">Total {year}</td>
                  <td className={`${tdCls} font-semibold text-white`}>${yearTotals.deposits.toFixed(2)}</td>
                  <td className={`${tdCls} font-semibold text-white`}>${yearTotals.withdrawals.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#FFFF00]">${yearTotals.matchFees.toFixed(2)}</td>
                  <td className={`${tdCls} font-semibold text-white`}>{yearTotals.matchCount}</td>
                  <td className="px-4 py-3 text-right font-semibold text-yellow-400">${yearTotals.stripeFees.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-yellow-400">${yearTotals.withdrawalFees.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${yearTotals.netRevenue >= 0 ? "text-green-400" : "text-red-400"}`}>
                    ${yearTotals.netRevenue.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tax disclaimer */}
      <div className="rounded-xl border border-white/5 bg-admin-card p-6">
        <h3 className="text-sm font-semibold text-white">Notes</h3>
        <ul className="mt-3 space-y-1.5 text-xs text-[#9CA3AF]">
          <li>• <strong className="text-white">Net Revenue</strong> = Match Fees − Estimated Stripe Fees − Estimated Payout Fees. This is gross platform income before any other expenses.</li>
          <li>• <strong className="text-white">Stripe Fees</strong> are estimated at 2.9% + $0.30 per deposit transaction. Actual fees may vary by card type and country.</li>
          <li>• <strong className="text-white">Payout Fees</strong> are estimated at 0.25% of withdrawal amount (Stripe Connect standard payout fee).</li>
          <li>• This report is for informational purposes. Consult a tax professional for official tax filing obligations.</li>
        </ul>
      </div>
    </div>
  );
}
