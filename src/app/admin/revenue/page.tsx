"use client";

import { useState, useMemo } from "react";
import RevenueChart from "@/components/admin/RevenueChart";
import type { RevenueDataPoint } from "@/components/admin/RevenueChart";

const PERIOD_LABELS = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" } as const;
type Period = keyof typeof PERIOD_LABELS;

function generateRevenueDays(days: number): RevenueDataPoint[] {
  const out: RevenueDataPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayOfWeek = d.getDay();
    const weekendBoost = dayOfWeek === 0 || dayOfWeek === 6 ? 1.2 : 1;
    const trend = 1 + (days - i) * 0.002;
    const amount = Math.round((250 + Math.random() * 600) * weekendBoost * trend * 100) / 100;
    out.push({
      date: d.toISOString().slice(0, 10),
      amount,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
  }
  return out;
}

const TOP_METRICS_FAKE = {
  today: { value: 847.2, change: 12.3 },
  week: { value: 4231.5, change: 8.7 },
  month: { value: 12847.3, change: 15.2 },
  allTime: { value: 67432.8, change: null },
};

const REVENUE_BY_GAME = [
  { name: "8 Ball Pool", pct: 38, value: 4882 },
  { name: "Chess", pct: 24, value: 3083 },
  { name: "Connect 4", pct: 16, value: 2056 },
  { name: "Reaction Duel", pct: 12, value: 1542 },
  { name: "CS2 External", pct: 10, value: 1284 },
];

const GAME_COLORS = ["#6366F1", "#8B5CF6", "#A855F7", "#EC4899", "#F59E0B"];

const REVENUE_BY_STAKE = [
  { range: "$1-$5", value: 2847, pct: 22 },
  { range: "$5-$10", value: 4231, pct: 33 },
  { range: "$10-$25", value: 3543, pct: 28 },
  { range: "$25-$50", value: 1456, pct: 11 },
  { range: "$50-$100", value: 770, pct: 6 },
];

const TOP_PLAYERS_FAKE = [
  { username: "PoolShark", matches: 421, totalWagered: 8420, feesGenerated: 252.6 },
  { username: "xKiller99", matches: 387, totalWagered: 7740, feesGenerated: 232.2 },
  { username: "ChessMaster", matches: 356, totalWagered: 7120, feesGenerated: 213.6 },
  { username: "SniperElite", matches: 298, totalWagered: 5960, feesGenerated: 178.8 },
  { username: "NoScope360", matches: 267, totalWagered: 5340, feesGenerated: 160.2 },
  { username: "EzWin", matches: 243, totalWagered: 4860, feesGenerated: 145.8 },
  { username: "TryHard_1", matches: 221, totalWagered: 4420, feesGenerated: 132.6 },
  { username: "CasualPro", matches: 198, totalWagered: 3960, feesGenerated: 118.8 },
  { username: "AcePlayer", matches: 176, totalWagered: 3520, feesGenerated: 105.6 },
  { username: "QuickDraw", matches: 154, totalWagered: 3080, feesGenerated: 92.4 },
];

export default function AdminRevenuePage() {
  const [period, setPeriod] = useState<Period>("daily");

  const chartData = useMemo(() => {
    const days = period === "daily" ? 90 : period === "weekly" ? 52 : 12;
    return generateRevenueDays(days);
  }, [period]);

  const chartLabel = period === "daily" ? "Revenue (Last 90 Days)" : period === "weekly" ? "Revenue by Week" : "Revenue by Month";

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Revenue Analytics</h1>

      {/* Top metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-admin-card p-5">
          <p className="text-sm text-admin-body">Today&apos;s Revenue</p>
          <p className="mt-1 text-2xl font-bold text-white">${TOP_METRICS_FAKE.today.value.toFixed(2)}</p>
          <p className="mt-1 text-xs text-admin-success">+{TOP_METRICS_FAKE.today.change}% vs yesterday</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-admin-card p-5">
          <p className="text-sm text-admin-body">This Week</p>
          <p className="mt-1 text-2xl font-bold text-white">${TOP_METRICS_FAKE.week.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          <p className="mt-1 text-xs text-admin-success">+{TOP_METRICS_FAKE.week.change}% vs last week</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-admin-card p-5">
          <p className="text-sm text-admin-body">This Month</p>
          <p className="mt-1 text-2xl font-bold text-white">${TOP_METRICS_FAKE.month.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          <p className="mt-1 text-xs text-admin-success">+{TOP_METRICS_FAKE.month.change}% vs last month</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-admin-card p-5">
          <p className="text-sm text-admin-body">All Time</p>
          <p className="mt-1 text-2xl font-bold text-white">${TOP_METRICS_FAKE.allTime.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Main chart */}
      <div className="rounded-xl border border-white/5 bg-admin-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">{chartLabel}</h2>
          <div className="flex gap-2">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  period === p ? "bg-admin-accent text-white" : "bg-white/5 text-admin-body hover:bg-white/10"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <RevenueChart
            data={chartData}
            showTotal={period === "daily"}
            totalLabel="Total this period"
            averageLabel="Average daily"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue by game - donut */}
        <div className="rounded-xl border border-white/5 bg-admin-card p-6">
          <h2 className="text-lg font-semibold text-white">Revenue Breakdown by Game</h2>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <div className="relative h-48 w-48 shrink-0">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                {REVENUE_BY_GAME.map((g, i) => {
                  const startDeg = REVENUE_BY_GAME.slice(0, i).reduce((s, x) => s + (x.pct / 100) * 360, 0);
                  const angle = (g.pct / 100) * 360;
                  const endDeg = startDeg + angle;
                  const x1 = 50 + 40 * Math.cos((startDeg * Math.PI) / 180);
                  const y1 = 50 + 40 * Math.sin((startDeg * Math.PI) / 180);
                  const x2 = 50 + 40 * Math.cos((endDeg * Math.PI) / 180);
                  const y2 = 50 + 40 * Math.sin((endDeg * Math.PI) / 180);
                  const large = angle > 180 ? 1 : 0;
                  const d = `M 50 50 L ${x1} ${y1} A 40 40 0 ${large} 1 ${x2} ${y2} Z`;
                  return (
                    <path key={g.name} d={d} fill={GAME_COLORS[i]} stroke="#12131A" strokeWidth={2} />
                  );
                })}
                <circle cx="50" cy="50" r="28" fill="#12131A" />
              </svg>
            </div>
            <ul className="space-y-2">
              {REVENUE_BY_GAME.map((g, i) => (
                <li key={g.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: GAME_COLORS[i] }}
                  />
                  <span className="text-white">{g.name}</span>
                  <span className="text-admin-body">{g.pct}% (${g.value.toLocaleString()})</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Revenue by stake tier */}
        <div className="rounded-xl border border-white/5 bg-admin-card p-6">
          <h2 className="text-lg font-semibold text-white">Revenue by Stake Tier</h2>
          <div className="mt-4 space-y-3">
            {REVENUE_BY_STAKE.map((t) => (
              <div key={t.range}>
                <div className="flex justify-between text-sm">
                  <span className="text-white">{t.range}</span>
                  <span className="text-admin-body">${t.value.toLocaleString()} ({t.pct}%)</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-admin-accent"
                    style={{ width: `${t.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top players by revenue */}
      <div className="rounded-xl border border-white/5 bg-admin-card p-6">
        <h2 className="text-lg font-semibold text-white">Top Players by Revenue Generated</h2>
        <p className="mt-1 text-sm text-admin-body">VIP players — they drive platform fees</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-admin-body">
                <th className="px-4 py-3 font-medium">Username</th>
                <th className="px-4 py-3 font-medium">Total Matches</th>
                <th className="px-4 py-3 font-medium">Total Wagered</th>
                <th className="px-4 py-3 font-medium">Fees Generated</th>
              </tr>
            </thead>
            <tbody>
              {TOP_PLAYERS_FAKE.map((p) => (
                <tr key={p.username} className="border-b border-white/5">
                  <td className="px-4 py-3 font-medium text-white">{p.username}</td>
                  <td className="px-4 py-3 text-admin-body">{p.matches}</td>
                  <td className="px-4 py-3 text-admin-body">${p.totalWagered.toLocaleString()}</td>
                  <td className="px-4 py-3 text-admin-success">${p.feesGenerated.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial summary */}
      <div className="rounded-xl border border-white/5 bg-admin-card p-6">
        <h2 className="text-lg font-semibold text-white">Financial Summary</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-white/5 p-4">
            <dt className="text-sm text-admin-body">Total Deposited (all users)</dt>
            <dd className="mt-1 text-xl font-bold text-white">$284,392.00</dd>
          </div>
          <div className="rounded-lg border border-white/5 p-4">
            <dt className="text-sm text-admin-body">Total Withdrawn</dt>
            <dd className="mt-1 text-xl font-bold text-white">$216,959.20</dd>
          </div>
          <div className="rounded-lg border border-white/5 p-4">
            <dt className="text-sm text-admin-body">Platform Balance</dt>
            <dd className="mt-1 text-xl font-bold text-white">$67,432.80</dd>
          </div>
          <div className="rounded-lg border border-white/5 p-4">
            <dt className="text-sm text-admin-body">Total Fees Collected</dt>
            <dd className="mt-1 text-xl font-bold text-admin-success">$67,432.80</dd>
          </div>
          <div className="rounded-lg border border-white/5 p-4">
            <dt className="text-sm text-admin-body">Average Fee per Match</dt>
            <dd className="mt-1 text-xl font-bold text-white">$1.52</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
