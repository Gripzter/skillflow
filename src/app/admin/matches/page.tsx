"use client";

import { Fragment, useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import ChessReplayViewer from "@/components/admin/ChessReplayViewer";
import LoadingRing from "@/components/LoadingRing";

interface MatchRow {
  id: string;
  game_type: string;
  player1_id: string | null;
  player2_id: string | null;
  player1_username?: string | null;
  player2_username?: string | null;
  player1Name: string;
  player2Name: string;
  stake_amount: number;
  platform_fee: number;
  total_pot: number;
  winner_payout: number;
  status: string;
  result: string | null;
  created_at: string;
  bot_difficulty: string | null;
  move_log: Array<{
    player_id: string;
    action: Record<string, unknown>;
    timestamp_ms: number;
  }> | null;
}

type DateRange = "today" | "week" | "month" | "all";
type StakeRange = "all" | "low" | "mid" | "high" | "vhigh";

const GAMES = ["all", "chess", "checkers", "connect-four", "pool", "memory", "reaction", "spelling", "last-touch"];
const STATUSES = ["all", "completed", "in_progress", "waiting", "draw"];
const DATE_LABELS: Record<DateRange, string> = { today: "Today", week: "This Week", month: "This Month", all: "All Time" };
const STAKE_LABELS: Record<StakeRange, string> = { all: "Any Stake", low: "$1–$5", mid: "$5–$25", high: "$25–$100", vhigh: "$100+" };

function gameLabel(s: string) {
  const m: Record<string, string> = {
    chess: "Chess", checkers: "Checkers", "connect-four": "Connect 4", "connect-4": "Connect 4",
    pool: "8-Ball Pool", memory: "Memory", reaction: "Reaction", spelling: "Spelling", "last-touch": "Last Touch",
    "memory-match": "Memory Match", "reaction-duel": "Reaction Duel", "spelling-bee": "Spelling Bee", "typing-race": "Typing Race",
  };
  return m[s] ?? s;
}

function outcomeLabel(m: MatchRow): string {
  if (!m.result) return "—";
  if (m.result === "draw") return "Draw";
  const winnerName = m.result === "player1_win" ? m.player1Name : m.player2Name;
  return `${winnerName} wins`;
}

const PER_PAGE = 25;

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState("all");
  const [status, setStatus] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [stakeRange, setStakeRange] = useState<StakeRange>("all");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) { setLoading(false); return; }

      const { data: raw, error } = await supabase
        .from("matches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000);

      if (error) {
        console.error("[AdminMatches] Failed to load matches:", error);
        setLoading(false);
        return;
      }

      if (!raw || raw.length === 0) { setLoading(false); return; }

      // Collect player IDs
      const pids = Array.from(new Set(raw.flatMap((m) => [m.player1_id, m.player2_id].filter(Boolean))));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", pids);
      const profileMap = new Map(profiles?.map((p) => [p.id, p.username]) ?? []);

      setMatches(
        raw.map((m) => ({
          ...(m as MatchRow),
          player1Name:
            (m.player1_username as string | null) ||
            (m.player1_id ? profileMap.get(m.player1_id) : null) ||
            "Player 1",
          player2Name: m.player2_id
            ? ((m.player2_username as string | null) || profileMap.get(m.player2_id) || "Player 2")
            : `Bot (${m.bot_difficulty ?? "?"})`,
        }))
      );
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    return matches.filter((m) => {
      if (game !== "all" && m.game_type !== game) return false;
      if (status !== "all" && m.status !== status) return false;
      if (dateRange === "today") {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        if (new Date(m.created_at).getTime() < start.getTime()) return false;
      } else if (dateRange === "week" && now - new Date(m.created_at).getTime() > 7 * 86400_000) return false;
      else if (dateRange === "month" && now - new Date(m.created_at).getTime() > 30 * 86400_000) return false;
      if (stakeRange !== "all") {
        const s = m.stake_amount;
        if (stakeRange === "low" && (s < 1 || s >= 5)) return false;
        if (stakeRange === "mid" && (s < 5 || s >= 25)) return false;
        if (stakeRange === "high" && (s < 25 || s >= 100)) return false;
        if (stakeRange === "vhigh" && s < 100) return false;
      }
      return true;
    });
  }, [matches, game, status, dateRange, stakeRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const curPage = Math.min(page, totalPages - 1);
  const pageMatches = filtered.slice(curPage * PER_PAGE, (curPage + 1) * PER_PAGE);

  const stats = useMemo(() => ({
    total: filtered.length,
    completed: filtered.filter((m) => m.status === "completed").length,
    inProgress: filtered.filter((m) => m.status === "in_progress").length,
    fees: filtered.filter((m) => m.status === "completed").reduce((s, m) => s + (m.platform_fee || 0), 0),
  }), [filtered]);

  const selectCls = "rounded-lg border border-white/10 bg-admin-card px-3 py-2 text-sm text-white focus:border-[#FFFF00] focus:outline-none";

  if (loading) {
    return <LoadingRing />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Matches</h1>

      {/* Quick stats */}
      <div className="flex flex-wrap gap-6 rounded-xl border border-white/5 bg-admin-card px-6 py-4 text-sm">
        <span className="text-[#9CA3AF]">Showing <strong className="text-white">{filtered.length}</strong></span>
        <span className="text-[#9CA3AF]">Completed <strong className="text-white">{stats.completed}</strong></span>
        <span className="text-[#9CA3AF]">In Progress <strong className="text-yellow-400">{stats.inProgress}</strong></span>
        <span className="text-[#9CA3AF]">Fees <strong className="text-admin-success">${stats.fees.toFixed(2)}</strong></span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={game} onChange={(e) => { setGame(e.target.value); setPage(0); }} className={selectCls}>
          {GAMES.map((g) => <option key={g} value={g}>{g === "all" ? "All Games" : gameLabel(g)}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className={selectCls}>
          {STATUSES.map((s) => <option key={s} value={s}>{s === "all" ? "All Statuses" : s}</option>)}
        </select>
        <select value={dateRange} onChange={(e) => { setDateRange(e.target.value as DateRange); setPage(0); }} className={selectCls}>
          {(Object.keys(DATE_LABELS) as DateRange[]).map((k) => <option key={k} value={k}>{DATE_LABELS[k]}</option>)}
        </select>
        <select value={stakeRange} onChange={(e) => { setStakeRange(e.target.value as StakeRange); setPage(0); }} className={selectCls}>
          {(Object.keys(STAKE_LABELS) as StakeRange[]).map((k) => <option key={k} value={k}>{STAKE_LABELS[k]}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/5 bg-admin-card">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 text-[#9CA3AF]">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Game</th>
              <th className="px-4 py-3 font-medium">Player 1</th>
              <th className="px-4 py-3 font-medium">Player 2</th>
              <th className="px-4 py-3 font-medium">Stake</th>
              <th className="px-4 py-3 font-medium">Fee</th>
              <th className="px-4 py-3 font-medium">Outcome</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {pageMatches.map((m) => (
              <Fragment key={m.id}>
                <tr
                  className="cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
                  onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-[#9CA3AF]">{m.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-white">{gameLabel(m.game_type)}</td>
                  <td className="px-4 py-3 text-[#9CA3AF]">{m.player1Name}</td>
                  <td className="px-4 py-3 text-[#9CA3AF]">{m.player2Name}</td>
                  <td className="px-4 py-3 text-[#9CA3AF]">${(m.stake_amount || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-admin-success">${(m.platform_fee || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-[#9CA3AF]">{outcomeLabel(m)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.status === "completed" ? "bg-green-500/10 text-green-400"
                      : m.status === "in_progress" ? "bg-yellow-500/10 text-yellow-400"
                      : "bg-white/5 text-[#9CA3AF]"
                    }`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#9CA3AF]">
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                </tr>
                {expandedId === m.id && (
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <td colSpan={9} className="px-6 py-4">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                        <div>
                          <p className="text-xs text-[#6B7280]">Match ID</p>
                          <p className="mt-0.5 font-mono text-xs text-white">{m.id}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#6B7280]">Total Pot</p>
                          <p className="mt-0.5 text-white">${(m.total_pot || 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#6B7280]">Winner Payout</p>
                          <p className="mt-0.5 text-admin-success">${(m.winner_payout || 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#6B7280]">Bot Difficulty</p>
                          <p className="mt-0.5 text-white capitalize">{m.bot_difficulty ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#6B7280]">Move Log Entries</p>
                          <p className="mt-0.5 text-white">{Array.isArray(m.move_log) ? m.move_log.length : 0}</p>
                        </div>
                      </div>
                      {m.game_type === "chess" && Array.isArray(m.move_log) && m.move_log.length > 0 && (
                        <div className="mt-4">
                          <p className="mb-2 text-xs font-medium text-[#9CA3AF]">Replay (Admin only)</p>
                          <ChessReplayViewer moveLog={m.move_log} />
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {pageMatches.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-[#9CA3AF]">
                  No matches match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-[#9CA3AF]">
        <span>
          {filtered.length === 0 ? "No results"
            : `${curPage * PER_PAGE + 1}–${Math.min((curPage + 1) * PER_PAGE, filtered.length)} of ${filtered.length}`}
        </span>
        <div className="flex gap-2">
          <button type="button" disabled={curPage === 0} onClick={() => setPage((p) => p - 1)}
            className="rounded border border-white/10 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-30 hover:bg-white/5">
            ← Prev
          </button>
          <button type="button" disabled={curPage >= totalPages - 1} onClick={() => setPage((p) => p + 1)}
            className="rounded border border-white/10 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-30 hover:bg-white/5">
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
