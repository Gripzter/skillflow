"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import AppNavbar from "@/components/AppNavbar";
import Footer from "@/components/Footer";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import { usePlayMode } from "@/contexts/PlayModeContext";
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

const QUICK_GAMES = [
  {
    slug: "chess",
    name: "Chess",
    emoji: "♟️",
    gradient: "from-amber-500/20 to-rose-500/20",
  },
  {
    slug: "connect-4",
    name: "Connect 4",
    emoji: "🔴",
    gradient: "from-red-500/30 to-amber-400/30",
  },
  {
    slug: "reaction-duel",
    name: "Reaction Duel",
    emoji: "⚡",
    gradient: "from-orange-500/30 to-red-500/30",
  },
] as const;

const GAME_EMOJI: Record<string, string> = {
  "8-ball-pool": "🎱",
  chess: "♟️",
  "connect-4": "🔴",
  "reaction-duel": "⚡",
  "memory-match": "🧠",
  "spelling-bee": "🐝",
};

export default function DashboardPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { isPractice } = usePlayMode();

  const [username, setUsername] = useState("Player");
  const [isDevMode, setIsDevMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [balance, setBalance] = useState(0);
  const [matches, setMatches] = useState<StoredMatch[]>([]);
  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [quickGameStats, setQuickGameStats] = useState<
    { playersOnline: number }[]
  >([]);

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

  useEffect(() => {
    // Lightweight, non-authoritative "players online" numbers for quick play row
    setQuickGameStats(
      QUICK_GAMES.map(() => ({
        playersOnline: 50 + Math.floor(Math.random() * 451),
      }))
    );
  }, []);

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
        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
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

        {/* 2. Featured game banner – Last Touch */}
        <section className="animate-fade-in" style={{ animationDelay: "80ms" }}>
          <Link
            href="/last-touch"
            className="group relative block overflow-hidden rounded-2xl border-2 border-teal/40 bg-gradient-to-br from-teal/10 via-purple-500/10 to-teal/10 p-6 shadow-[0_0_40px_rgba(0,229,199,0.12)] transition-all duration-300 hover:border-teal/70 hover:shadow-[0_0_70px_rgba(0,229,199,0.25)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-teal/5 to-purple-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-200/80">
                  Featured Event
                </p>
                <h2 className="bg-gradient-to-r from-teal to-purple-500 bg-clip-text text-2xl font-extrabold text-transparent">
                  LAST TOUCH
                </h2>
                <p className="mt-1 text-sm text-body-gray">
                  Hold your ground. Win the pot.
                </p>
                <p className="mt-2 text-xs text-teal">
                  Massive prize pool • Last finger standing wins
                </p>
              </div>
              <div className="flex items-center gap-5">
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-body-gray">
                    Current Prize Pool
                  </p>
                  <p className="mt-1 text-xl font-semibold text-white">$1,247</p>
                </div>
                <span className="rounded-xl bg-teal px-5 py-2.5 text-sm font-semibold text-charcoal shadow-[0_0_22px_rgba(0,229,199,0.5)] transition-transform duration-150 group-hover:-translate-y-0.5">
                  Join Now
                </span>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-teal/25 blur-3xl" />
          </Link>
        </section>

        {/* 3. Quick Play – Jump back in */}
        <section
          className="flex flex-col gap-3 animate-fade-in"
          style={{ animationDelay: "140ms" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-100">
              Jump Back In
            </h2>
            <span className="text-[11px] text-body-gray">
              One tap to play
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {QUICK_GAMES.map((game, index) => {
              const stats = quickGameStats[index];
              const playersOnline = stats?.playersOnline ?? 0;
              const accentClasses = isPractice
                ? "hover:border-purple-500/40 hover:shadow-[0_0_28px_rgba(168,85,247,0.35)]"
                : "hover:border-teal/60 hover:shadow-[0_0_28px_rgba(0,229,199,0.35)]";

              return (
                <button
                  key={game.slug}
                  type="button"
                  onClick={() => router.push(`/play/${game.slug}`)}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-card border border-white/10 bg-card px-4 py-3 text-left text-sm text-gray-100 transition-all duration-200 hover:-translate-y-0.5 ${accentClasses}`}
                  style={{ animationDelay: `${160 + index * 60}ms` }}
                >
                  <div
                    className={`pointer-events-none absolute inset-0 rounded-card bg-gradient-to-br ${game.gradient} opacity-40`}
                    aria-hidden
                  />
                  <div className="relative flex items-center gap-2">
                    <span className="text-lg" aria-hidden>
                      {game.emoji}
                    </span>
                    <span className="font-semibold">{game.name}</span>
                  </div>
                  <div className="relative mt-2 flex items-center justify-between text-[11px] text-body-gray">
                    <span>{playersOnline.toLocaleString()} online</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isPractice
                          ? "bg-purple-500/25 text-purple-100"
                          : "bg-teal/25 text-teal"
                      }`}
                    >
                      Play
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 4. Stats row */}
        <section
          className="animate-fade-in"
          style={{ animationDelay: "220ms" }}
        >
          <div className="card-border rounded-card border-teal/25 bg-card/80 px-4 py-4 shadow-[0_0_30px_rgba(0,229,199,0.08)] sm:px-5 sm:py-4">
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
          </div>
        </section>

        {/* 5. Recent matches */}
        <section
          className="flex flex-col gap-3 animate-fade-in"
          style={{ animationDelay: "260ms" }}
        >
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
                const emoji = GAME_EMOJI[match.gameType] ?? "🎮";

                return (
                  <div
                    key={match.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="shrink-0 text-lg" aria-hidden>
                        {emoji}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-gray-100">
                          {match.gameDisplayName} vs {opponentName}
                        </span>
                      <span className="text-[11px] text-body-gray">
                        {resultLabel} · {formatTimeAgo(match.createdAt)}
                      </span>
                      </div>
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
