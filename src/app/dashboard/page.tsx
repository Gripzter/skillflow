"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import AppNavbar from "@/components/AppNavbar";
import Footer from "@/components/Footer";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import {
  getCurrentUser,
  getWalletBalance,
  getMatches,
  getTransactions,
  getLeaderboard,
  getPracticeMatches,
  getPracticeStats,
  logout as apiLogout,
} from "@/lib/api";
import type { StoredMatch } from "@/lib/matchmaking";
import type { StoredTransaction } from "@/lib/wallet";
import { type LeaderboardPlayer } from "@/lib/leaderboard-data";
import { buildLeaderboard } from "@/lib/leaderboard-seeding";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatCurrency(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function formatTimeAgo(createdAt: string) {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DashboardPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [username, setUsername] = useState("Player");
  const [isDevMode, setIsDevMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [balance, setBalance] = useState(0);
  const [matches, setMatches] = useState<StoredMatch[]>([]);
  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.push("/login");
          return;
        }
        setUsername(user.username);
        setIsDevMode(user.isDevMode ?? false);

        const [bal, matchList, txs, apiLeaderboard] = await Promise.all([
          getWalletBalance(),
          getMatches(),
          getTransactions(),
          getLeaderboard("total_earnings"),
        ]);
        setBalance(bal);
        setMatches(matchList as StoredMatch[]);
        setTransactions(txs);

        const basePlayers: LeaderboardPlayer[] =
          apiLeaderboard?.map((p) => ({
            ...p,
            isCurrentUser: p.username === user.username,
          })) ?? [];
        setLeaderboard(buildLeaderboard(basePlayers));

        // Practice mode data (local-only; no network)
        getPracticeMatches();
        getPracticeStats(user.username);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiLogout();
      showToast("Logged out successfully", "success");
      router.push("/login");
      router.refresh();
    } catch {
      showToast("Something went wrong", "error");
      setLoggingOut(false);
    }
  }

  const completedMatches = useMemo(
    () => matches.filter((m) => m.status === "completed" && !m.isPractice),
    [matches]
  );
  const totalMatches = completedMatches.length;
  const wins = completedMatches.filter((m) => m.winner === "player1").length;
  // Real-money win rate as raw percentage; UI will format to one decimal place
  const winRate = totalMatches ? (wins / totalMatches) * 100 : 0;

  const netEarnings = useMemo(() => {
    let income = 0;
    let outgo = 0;
    transactions.forEach((tx) => {
      if (tx.type === "match_win" || tx.type === "referral_bonus") income += tx.amount;
      if (tx.type === "match_entry" || tx.type === "platform_fee") outgo += tx.amount;
    });
    return income - outgo;
  }, [transactions]);

  const playerRank = useMemo(() => {
    const idx = leaderboard.findIndex((p) => p.isCurrentUser || p.username === username);
    return idx >= 0 ? idx + 1 : null;
  }, [leaderboard, username]);

  const recentActivity = useMemo(
    () => completedMatches.slice(0, 5),
    [completedMatches]
  );
  const greeting = getGreeting();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <svg
          className="h-10 w-10 animate-spin text-teal"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal pb-20 md:pb-0">
      {/* Ambient background effects (match wallet/play/leaderboard) */}
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <div
        className="pointer-events-none fixed -top-40 -left-32 h-72 w-72 rounded-full bg-teal-500/20 blur-[80px] opacity-40"
        aria-hidden
      />
      <div className="pointer-events-none fixed bottom-[-6rem] right-[-4rem] h-64 w-64 rounded-full bg-purple-500/25 blur-[65px] opacity-40" aria-hidden />

      <AppNavbar
        username={username}
        isDevMode={isDevMode}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        currentPage="dashboard"
      />
      <ModeToggleBarContent />

      <main className="relative mx-auto flex max-w-[1000px] flex-col gap-8 px-4 py-8 pb-24 md:px-6">
        {/* 1. Greeting + inline balance chip */}
        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              {greeting}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-100 md:text-3xl">
              {username}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-body-gray">
              <span className="mr-1 text-[10px] uppercase tracking-[0.16em] text-gray-500">
                Balance
              </span>
              <span className="font-medium text-gray-100">{formatCurrency(balance)}</span>
            </div>
          </div>
        </section>

        {/* 2. Hero stats card */}
        <section className="card-border rounded-card bg-card/80 px-4 py-4 sm:px-5 sm:py-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
                Win Rate
              </span>
              <span className="text-lg font-medium text-gray-50">
                {totalMatches > 0 ? `${winRate.toFixed(1)}%` : "0.0%"}
              </span>
              <span className="text-[11px] text-body-gray">Real-money matches</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
                Matches Played
              </span>
              <span className="text-lg font-medium text-gray-50">
                {totalMatches.toLocaleString()}
              </span>
              <span className="text-[11px] text-body-gray">Completed</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
                Net Earnings
              </span>
              <span
                className={`text-lg font-medium ${
                  netEarnings >= 0 ? "text-emerald-300" : "text-red-400"
                }`}
              >
                {formatCurrency(netEarnings)}
              </span>
              <span className="text-[11px] text-body-gray">Wins minus entries</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
                Rank
              </span>
              <span className="text-lg font-medium text-gray-50">
                {playerRank ? `#${playerRank.toLocaleString()}` : "—"}
              </span>
              <span className="text-[11px] text-body-gray">Global position</span>
            </div>
          </div>
        </section>

        {/* 3. Quick actions */}
        <section className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => router.push("/play")}
            className="group inline-flex items-center gap-2 rounded-card border border-white/10 bg-gradient-to-r from-teal/15 via-teal/5 to-transparent px-4 py-2.5 text-sm font-medium text-gray-50 transition-colors hover:border-teal hover:bg-teal/15"
          >
            <span className="text-base" aria-hidden>
              🎮
            </span>
            <span>Play Now</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/last-touch")}
            className="group inline-flex items-center gap-2 rounded-card border border-white/10 bg-gradient-to-r from-white/5 via-white/0 to-transparent px-4 py-2.5 text-sm font-medium text-gray-100 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            <span className="text-base" aria-hidden>
              📈
            </span>
            <span>Last Touch</span>
          </button>
        </section>

        {/* 4. Recent activity */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-100">Recent Matches</h2>
            <Link
              href="/profile"
              className="text-xs font-medium text-teal-300 hover:text-teal-200"
            >
              View all →
            </Link>
          </div>

          {recentActivity.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-sm text-body-gray">
              No completed matches yet. Start a match from the Play page to see your history here.
            </div>
          ) : (
            <div className="divide-y divide-white/5 rounded-lg border border-white/5 bg-black/20">
              {recentActivity.map((match) => {
                const isWin = match.winner === "player1";
                const isDraw = !match.winner;
                const resultLabel = isDraw ? "Draw" : isWin ? "Won" : "Lost";
                const resultColor = isDraw
                  ? "text-amber-300"
                  : isWin
                    ? "text-emerald-300"
                    : "text-red-400";
                const opponentName = match.player2?.username ?? "Opponent";

                return (
                  <div
                    key={match.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-gray-100">
                        {match.gameDisplayName} vs {opponentName}
                      </span>
                      <span className="text-[11px] text-body-gray">
                        {resultLabel} · {formatTimeAgo(match.createdAt)}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`text-xs font-semibold ${resultColor}`}>{resultLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
