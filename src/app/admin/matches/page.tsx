"use client";

import { Fragment, useEffect, useState, useMemo } from "react";
import { getMatches } from "@/lib/matchmaking";
import type { StoredMatch } from "@/lib/matchmaking";

type MatchStatus = "in_progress" | "completed" | "disputed" | "cancelled";
type DateRange = "today" | "week" | "month" | "all";
type StakeRange = "all" | "1-5" | "5-25" | "25-100" | "100+";

type MatchRow = Omit<StoredMatch, "status"> & {
  status: MatchStatus;
  duration?: number;
  completedAt?: string;
};

const GAME_OPTIONS = ["All", "8 Ball Pool", "Chess", "Connect 4", "Reaction Duel", "CS2"];
const STATUS_OPTIONS: MatchStatus[] = ["in_progress", "completed", "disputed", "cancelled"];

function padMatches(matches: StoredMatch[]): MatchRow[] {
  const rows: MatchRow[] = matches.map((m) => ({
    ...m,
    status: m.status as MatchStatus,
    duration: 2 + Math.floor(Math.random() * 8),
    completedAt: m.status === "completed" ? m.createdAt : undefined,
  }));
  const gameTypes = ["8-ball-pool", "chess", "connect-4", "reaction-duel"];
  const gameNames = ["8 Ball Pool", "Chess", "Connect 4", "Reaction Duel"];
  while (rows.length < 20 + matches.length) {
    const i = rows.length % gameTypes.length;
    const d = new Date(Date.now() - rows.length * 1800000);
    rows.push({
      id: `fake-m-${rows.length}`,
      gameType: gameTypes[i],
      gameDisplayName: gameNames[i],
      player1: { username: "PlayerA", rating: 1000, winRate: 50, matchesPlayed: 20 },
      player2: { username: "PlayerB", rating: 1000, winRate: 50, matchesPlayed: 20 },
      stakeAmount: [2, 10, 50, 150][rows.length % 4],
      platformFee: 0.6,
      totalPot: 20,
      winnerPayout: 19.4,
      status: rows.length % 10 === 0 ? "disputed" : rows.length % 5 === 0 ? "in_progress" : "completed",
      winner: "player1",
      createdAt: d.toISOString(),
      duration: 3 + (rows.length % 5),
      completedAt: d.toISOString(),
    });
  }
  return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [gameFilter, setGameFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<MatchStatus | "all">("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [stakeRange, setStakeRange] = useState<StakeRange>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const raw = getMatches();
    setMatches(padMatches(raw));
  }, []);

  const filtered = useMemo(() => {
    let list = matches;
    if (gameFilter !== "All") {
      list = list.filter((m) => m.gameDisplayName === gameFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((m) => m.status === statusFilter);
    }
    const now = Date.now();
    if (dateRange === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      list = list.filter((m) => new Date(m.createdAt).getTime() >= start.getTime());
    } else if (dateRange === "week") {
      list = list.filter((m) => now - new Date(m.createdAt).getTime() < 7 * 86400000);
    } else if (dateRange === "month") {
      list = list.filter((m) => now - new Date(m.createdAt).getTime() < 30 * 86400000);
    }
    if (stakeRange !== "all") {
      const [lo, hi] =
        stakeRange === "1-5"
          ? [1, 5]
          : stakeRange === "5-25"
            ? [5, 25]
            : stakeRange === "25-100"
              ? [25, 100]
              : [100, 1e9];
      list = list.filter((m) => m.stakeAmount >= lo && m.stakeAmount < hi);
    }
    return list;
  }, [matches, gameFilter, statusFilter, dateRange, stakeRange]);

  const stats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const completedToday = matches.filter(
      (m) => m.status === "completed" && new Date(m.createdAt).getTime() >= todayStart.getTime()
    ).length;
    const revenueToday = completedToday * 0.5; // approximate
    return {
      total: matches.length,
      inProgress: matches.filter((m) => m.status === "in_progress").length,
      completedToday,
      disputes: matches.filter((m) => m.status === "disputed").length,
      revenueToday: matches
        .filter((m) => m.status === "completed" && new Date(m.createdAt).getTime() >= todayStart.getTime())
        .reduce((s, m) => s + m.platformFee, 0),
    };
  }, [matches]);

  const statusColor = (s: MatchStatus) =>
    s === "completed"
      ? "bg-admin-success"
      : s === "in_progress"
        ? "bg-admin-warning"
        : s === "disputed"
          ? "bg-admin-danger"
          : "bg-admin-body";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Match Management</h1>

      <div className="flex flex-wrap gap-4 rounded-xl border border-white/5 bg-admin-card p-4">
        <span className="text-admin-body">Total Matches: <strong className="text-white">{stats.total}</strong></span>
        <span className="text-admin-body">In Progress: <strong className="text-admin-warning">{stats.inProgress}</strong></span>
        <span className="text-admin-body">Completed Today: <strong className="text-white">{stats.completedToday}</strong></span>
        <span className="text-admin-body">Disputes: <strong className="text-admin-danger">{stats.disputes}</strong></span>
        <span className="text-admin-body">Revenue Today: <strong className="text-admin-success">${stats.revenueToday.toFixed(2)}</strong></span>
      </div>

      <div className="flex flex-wrap gap-4">
        <select
          value={gameFilter}
          onChange={(e) => setGameFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-admin-accent focus:outline-none"
        >
          {GAME_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as MatchStatus | "all")}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-admin-accent focus:outline-none"
        >
          <option value="all">All</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as DateRange)}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-admin-accent focus:outline-none"
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="all">All Time</option>
        </select>
        <select
          value={stakeRange}
          onChange={(e) => setStakeRange(e.target.value as StakeRange)}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-admin-accent focus:outline-none"
        >
          <option value="all">All</option>
          <option value="1-5">$1-$5</option>
          <option value="5-25">$5-$25</option>
          <option value="25-100">$25-$100</option>
          <option value="100+">$100+</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/5 bg-admin-card">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-admin-body">
              <th className="px-4 py-3 font-medium">Match ID</th>
              <th className="px-4 py-3 font-medium">Game</th>
              <th className="px-4 py-3 font-medium">Player 1</th>
              <th className="px-4 py-3 font-medium">Player 2</th>
              <th className="px-4 py-3 font-medium">Stake</th>
              <th className="px-4 py-3 font-medium">Pot</th>
              <th className="px-4 py-3 font-medium">Fee</th>
              <th className="px-4 py-3 font-medium">Winner</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <Fragment key={m.id}>
                <tr
                  key={m.id}
                  className="cursor-pointer border-b border-white/5 hover:bg-white/5"
                  onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                >
                  <td className="px-4 py-3 font-mono text-admin-body">{m.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-white">{m.gameDisplayName}</td>
                  <td className="px-4 py-3 text-admin-body">{m.player1.username}</td>
                  <td className="px-4 py-3 text-admin-body">{m.player2.username}</td>
                  <td className="px-4 py-3 text-admin-body">${m.stakeAmount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-admin-body">${m.totalPot.toFixed(2)}</td>
                  <td className="px-4 py-3 text-admin-success">${m.platformFee.toFixed(2)}</td>
                  <td className="px-4 py-3 text-admin-body">
                    {m.winner ? (m.winner === "player1" ? m.player1.username : m.player2.username) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block h-2 w-2 rounded-full ${statusColor(m.status)}`} />
                    <span className="ml-2 text-admin-body">{m.status}</span>
                  </td>
                  <td className="px-4 py-3 text-admin-body">{m.duration ?? "—"} min</td>
                  <td className="px-4 py-3 text-admin-body">{new Date(m.createdAt).toLocaleString()}</td>
                </tr>
                {expandedId === m.id && (
                  <tr key={`${m.id}-exp`} className="border-b border-white/10 bg-white/5">
                    <td colSpan={11} className="px-4 py-4">
                      <div className="space-y-4">
                        <pre className="overflow-auto rounded bg-admin-bg p-3 text-xs text-admin-body">
                          {JSON.stringify(m, null, 2)}
                        </pre>
                        <p className="text-admin-body">Connection logs: (placeholder)</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="rounded bg-admin-accent px-3 py-1.5 text-sm text-white"
                            onClick={(e) => { e.stopPropagation(); alert("Override result"); }}
                          >
                            Override Result
                          </button>
                          <button
                            type="button"
                            className="rounded bg-admin-warning/20 px-3 py-1.5 text-sm text-admin-warning"
                            onClick={(e) => { e.stopPropagation(); alert("Refund match"); }}
                          >
                            Refund Match
                          </button>
                          <button
                            type="button"
                            className="rounded border border-admin-danger px-3 py-1.5 text-sm text-admin-danger"
                            onClick={(e) => { e.stopPropagation(); alert("Cancel match"); }}
                          >
                            Cancel Match
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
