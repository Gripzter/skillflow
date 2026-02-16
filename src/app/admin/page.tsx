"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getMatches } from "@/lib/matchmaking";
import type { StoredMatch } from "@/lib/matchmaking";
import StatCard from "@/components/admin/StatCard";
import RevenueChart from "@/components/admin/RevenueChart";
import type { RevenueDataPoint } from "@/components/admin/RevenueChart";

// Fake totals (replace with real aggregates later)
const FAKE_TOTAL_USERS = 1247;
const FAKE_USERS_TODAY = 23;
const FAKE_TOTAL_MATCHES = 8432;
const FAKE_MATCHES_TODAY = 156;
const FAKE_TOTAL_REVENUE = 12847.3;
const FAKE_REVENUE_TODAY = 847.2;
const FAKE_TOTAL_WAGERED = 428243;
const FAKE_WAGERED_TODAY = 28430;

function generateRevenue30Days(): RevenueDataPoint[] {
  const out: RevenueDataPoint[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const base = 200 + (29 - i) * 15 + Math.random() * 800;
    const amount = Math.round(base * 100) / 100;
    out.push({
      date: d.toISOString().slice(0, 10),
      amount,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
  }
  return out;
}

function timeAgo(iso: string): string {
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`;
  return `${Math.floor(sec / 86400)} days ago`;
}

const TOP_GAMES_FAKE = [
  { name: "8 Ball Pool", matches: 3421, pct: 40.6 },
  { name: "Chess", matches: 2156, pct: 25.6 },
  { name: "Connect 4", matches: 1543, pct: 18.3 },
  { name: "Reaction Duel", matches: 876, pct: 10.4 },
  { name: "CS2 (External)", matches: 436, pct: 5.1 },
];

const USER_GROWTH_FAKE = [42, 28, 55, 31, 48, 39, 52];

const ALERTS_FAKE = [
  { severity: "danger" as const, msg: "3 disputes awaiting resolution", href: "/admin/disputes" },
  { severity: "warning" as const, msg: "User 'xKiller99' reported for suspicious activity", href: null },
  { severity: "success" as const, msg: "Daily backup completed successfully", href: null },
  { severity: "warning" as const, msg: "High traffic detected — 342 concurrent users", href: null },
];

export default function AdminOverviewPage() {
  const [matches, setMatches] = useState<StoredMatch[]>([]);
  const [revenueData] = useState(() => generateRevenue30Days());

  useEffect(() => {
    setMatches(getMatches());
  }, []);

  const recentMatches = useMemo(() => {
    const withStatus = matches.slice(0, 20).map((m) => ({
      ...m,
      displayStatus: m.status as "completed" | "in_progress" | "disputed",
    }));
    while (withStatus.length < 10) {
      const d = new Date(Date.now() - withStatus.length * 3600000);
      withStatus.push({
        id: `fake-${withStatus.length}`,
        gameType: "8-ball-pool",
        gameDisplayName: "8 Ball Pool",
        player1: { username: "Player1", rating: 1000, winRate: 50, matchesPlayed: 10 },
        player2: { username: "Player2", rating: 1000, winRate: 50, matchesPlayed: 10 },
        stakeAmount: 5 + Math.random() * 45,
        platformFee: 0.45,
        totalPot: 20,
        winnerPayout: 19.55,
        status: "completed",
        winner: "player1",
        createdAt: d.toISOString(),
        displayStatus: "completed" as const,
      } as StoredMatch & { displayStatus: "completed" | "in_progress" | "disputed" });
    }
    return withStatus
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [matches]);

  const totalRevenueFromData = revenueData.reduce((s, d) => s + d.amount, 0);
  const avgDaily = revenueData.length ? totalRevenueFromData / revenueData.length : 0;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Admin Overview</h1>

      {/* Key metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={FAKE_TOTAL_USERS.toLocaleString()}
          subtitle={`+${FAKE_USERS_TODAY} today`}
          trend="up"
          icon="👥"
        />
        <StatCard
          title="Total Matches"
          value={FAKE_TOTAL_MATCHES.toLocaleString()}
          subtitle={`+${FAKE_MATCHES_TODAY} today`}
          trend="up"
          icon="🎮"
        />
        <StatCard
          title="Total Revenue (Platform Fees)"
          value={`$${FAKE_TOTAL_REVENUE.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          subtitle={`+$${FAKE_REVENUE_TODAY.toFixed(2)} today`}
          trend="up"
          icon="💰"
        />
        <StatCard
          title="Total Wagered"
          value={`$${FAKE_TOTAL_WAGERED.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          subtitle={`+$${FAKE_WAGERED_TODAY.toLocaleString()} today`}
          trend="up"
          icon="📊"
        />
      </div>

      {/* Revenue chart */}
      <div className="rounded-xl border border-white/5 bg-admin-card p-6">
        <h2 className="text-lg font-semibold text-white">Revenue (Last 30 Days)</h2>
        <div className="mt-4">
          <RevenueChart
            data={revenueData}
            totalValue={totalRevenueFromData}
            averageValue={avgDaily}
            totalLabel="Total this month"
            averageLabel="Average daily"
          />
        </div>
      </div>

      {/* Recent Matches + Platform Health */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-admin-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recent Matches</h2>
            <Link href="/admin/matches" className="text-sm text-admin-accent hover:underline">
              View All →
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {recentMatches.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-sm"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    m.displayStatus === "completed"
                      ? "bg-admin-success"
                      : m.displayStatus === "in_progress"
                        ? "bg-admin-warning"
                        : "bg-admin-danger"
                  }`}
                />
                <span className="text-admin-body">{m.gameDisplayName}</span>
                <span className="text-white">
                  {m.player1.username} vs {m.player2.username}
                </span>
                <span className="text-admin-body">${m.stakeAmount.toFixed(2)}</span>
                <span className="text-admin-body">
                  {m.status === "completed" && m.winner
                    ? `Winner: ${m.winner === "player1" ? m.player1.username : m.player2.username}`
                    : m.status}
                </span>
                <span className="text-admin-success">Fee ${m.platformFee.toFixed(2)}</span>
                <span className="ml-auto text-admin-body">{timeAgo(m.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-white/5 bg-admin-card p-6">
          <h2 className="text-lg font-semibold text-white">Platform Health</h2>
          <dl className="mt-4 space-y-3">
            {[
              ["Active Users (24h)", "342", "success"],
              ["Matches Today", "156", "neutral"],
              ["Average Match Duration", "4.2 min", "neutral"],
              ["Disputes Open", "3", "danger"],
              ["Dispute Rate", "0.8%", "neutral"],
              ["Average Stake", "$8.50", "neutral"],
              ["Most Popular Game", "8 Ball Pool (42%)", "neutral"],
              ["Server Uptime", "99.97%", "success"],
            ].map(([label, value, type]) => (
              <div key={label} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                <span className="flex items-center gap-2 text-admin-body">
                  {type === "success" && <span className="h-2 w-2 rounded-full bg-admin-success" />}
                  {type === "danger" && <span className="h-2 w-2 rounded-full bg-admin-danger" />}
                  {label}
                </span>
                <span className="font-medium text-white">{value}</span>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Top Games + User Growth */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-admin-card p-6">
          <h2 className="text-lg font-semibold text-white">Top Games (by matches)</h2>
          <div className="mt-4 space-y-3">
            {TOP_GAMES_FAKE.map((g) => (
              <div key={g.name}>
                <div className="flex justify-between text-sm">
                  <span className="text-white">{g.name}</span>
                  <span className="text-admin-body">
                    {g.matches.toLocaleString()} matches ({g.pct}%)
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-admin-accent"
                    style={{ width: `${g.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-admin-card p-6">
          <h2 className="text-lg font-semibold text-white">User Growth (Last 7 Days)</h2>
          <div className="mt-4 flex items-end justify-between gap-2" style={{ height: "160px" }}>
            {USER_GROWTH_FAKE.map((val, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs text-admin-body">{val}</span>
                <div
                  className="w-full rounded-t bg-admin-accent transition-all"
                  style={{ height: `${(val / 60) * 140}px`, minHeight: "8px" }}
                />
                <span className="text-[10px] text-admin-body">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="rounded-xl border border-white/5 bg-admin-card p-6">
        <h2 className="text-lg font-semibold text-white">Alerts & Notifications</h2>
        <ul className="mt-4 space-y-2">
          {ALERTS_FAKE.map((a, i) => (
            <li key={i} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/5 px-4 py-2 text-sm">
              <span
                className={
                  a.severity === "danger"
                    ? "text-admin-danger"
                    : a.severity === "warning"
                      ? "text-admin-warning"
                      : "text-admin-success"
                }
              >
                {a.severity === "danger" ? "🔴" : a.severity === "warning" ? "🟡" : "🟢"}
              </span>
              <span className="text-admin-body">{a.msg}</span>
              {a.href && (
                <Link href={a.href} className="ml-auto text-admin-accent hover:underline">
                  Resolve
                </Link>
              )}
              <span className="text-admin-body text-xs">
                {new Date(Date.now() - i * 3600000).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
