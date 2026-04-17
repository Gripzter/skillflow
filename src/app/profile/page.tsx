"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppNavbar from "@/components/AppNavbar";
import Footer from "@/components/Footer";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import { getCurrentUser, getMatches, getTransactions, getPracticeStats, logout as apiLogout } from "@/lib/api";
import { usePlayMode } from "@/contexts/PlayModeContext";
import type { StoredMatch } from "@/lib/api";
import type { StoredTransaction } from "@/lib/wallet";
import VelocityLoader from "@/components/VelocityLoader";

const RATING_RANKS = [
  { name: "Bronze", min: 0, max: 1199 },
  { name: "Silver", min: 1200, max: 1599 },
  { name: "Gold", min: 1600, max: 1999 },
  { name: "Diamond", min: 2000, max: 9999 },
] as const;

function getRank(rating: number): string {
  const r = RATING_RANKS.find((x) => rating >= x.min && rating <= x.max);
  return r?.name ?? "Bronze";
}

const GAME_TABS = [
  { id: "all", label: "All Games" },
  { id: "8-ball-pool", label: "8 Ball Pool" },
  { id: "chess", label: "Chess" },
] as const;

const ACHIEVEMENTS = [
  { id: "first_blood", title: "First Blood", desc: "Win your first match", check: (ctx: ProfileStats) => ctx.totalWins >= 1 },
  { id: "on_fire", title: "On Fire", desc: "Win 3 matches in a row", check: (ctx: ProfileStats) => ctx.bestStreak >= 3 },
  { id: "high_roller", title: "High Roller", desc: "Play a $50+ stake match", check: (ctx: ProfileStats) => ctx.maxStake >= 50 },
  { id: "sharpshooter", title: "Sharpshooter", desc: "Win 10 matches total", check: (ctx: ProfileStats) => ctx.totalWins >= 10 },
  { id: "champion", title: "Champion", desc: "Reach Gold rating", check: (ctx: ProfileStats) => ctx.rating >= 1600 },
  { id: "speed_demon", title: "Speed Demon", desc: "Win a match in under 2 minutes", check: () => false },
  { id: "pool_shark", title: "Pool Shark", desc: "Win 10 8-ball pool matches", check: (ctx: ProfileStats) => ctx.poolWins >= 10 },
  { id: "grandmaster", title: "Grandmaster", desc: "Win 10 chess matches", check: (ctx: ProfileStats) => ctx.chessWins >= 10 },
  { id: "diamond", title: "Diamond Player", desc: "Reach Diamond rating", check: (ctx: ProfileStats) => ctx.rating >= 2000 },
] as const;

interface ProfileStats {
  matches: StoredMatch[];
  completed: StoredMatch[];
  totalWins: number;
  totalLosses: number;
  winRate: number;
  totalEarnings: number;
  currentStreak: number;
  bestStreak: number;
  rating: number;
  maxStake: number;
  poolWins: number;
  chessWins: number;
  transactions: StoredTransaction[];
}

function computeProfileStats(
  matches: StoredMatch[],
  transactions: StoredTransaction[],
  myUsername: string
): ProfileStats {
  const completed = matches.filter((m) => m.status === "completed");
  const sorted = [...completed].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const isPlayer1 = (m: StoredMatch) => m.player1.username === myUsername;
  const won = (m: StoredMatch) => m.winner === "player1" && isPlayer1(m) || m.winner === "player2" && !isPlayer1(m);
  const totalWins = completed.filter(won).length;
  const totalLosses = completed.length - totalWins;
  // Store win rate as a numeric percentage with one decimal place
  const winRate = completed.length ? Math.round((totalWins / completed.length) * 1000) / 10 : 0;
  const matchWinSum = transactions.filter((t) => t.type === "match_win").reduce((s, t) => s + t.amount, 0);
  const matchEntrySum = transactions.filter((t) => t.type === "match_entry").reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalEarnings = matchWinSum - matchEntrySum;
  let currentStreak = 0;
  let bestStreak = 0;
  for (const m of sorted) {
    if (won(m)) {
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  const rating = Math.max(100, Math.min(2500, 1000 + (totalWins - totalLosses) * 25));
  const maxStake = completed.length ? Math.max(...completed.map((m) => m.stakeAmount)) : 0;
  const poolWins = completed.filter((m) => m.gameType === "8-ball-pool" && won(m)).length;
  const chessWins = completed.filter((m) => m.gameType === "chess" && won(m)).length;
  return {
    matches,
    completed,
    totalWins,
    totalLosses,
    winRate,
    totalEarnings,
    currentStreak: sorted.length && won(sorted[0]) ? currentStreak : 0,
    bestStreak,
    rating,
    maxStake,
    poolWins,
    chessWins,
    transactions,
  };
}

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  if (days < 7) return `${days} day${days !== 1 ? "s" : ""} ago`;
  return d.toLocaleDateString();
}

function fakeDuration(): string {
  const mins = 3 + Math.floor(Math.random() * 6);
  return `${mins} min`;
}

export default function ProfilePage() {
  const router = useRouter();
  const { isPractice } = usePlayMode();
  const [username, setUsername] = useState<string>("Player");
  const [memberSince, setMemberSince] = useState<string>("February 2026");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [matches, setMatches] = useState<StoredMatch[]>([]);
  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);
  const [practiceStats, setPracticeStats] = useState({ practiceMatchesPlayed: 0, practiceWins: 0, practiceWinRate: 0 });
  const [gameTab, setGameTab] = useState<string>("all");
  const [showAllMatches, setShowAllMatches] = useState(false);

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
        if ("created_at" in user && user.created_at) {
          setMemberSince(new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }));
        }
        const [matchList, txs] = await Promise.all([getMatches(), getTransactions()]);
        setMatches(matchList);
        setTransactions(txs);
        setPracticeStats(getPracticeStats(user.username));
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const stats = useMemo(
    () => computeProfileStats(matches, transactions, username),
    [matches, transactions, username]
  );
  const rank = getRank(stats.rating);

  const filteredByGame =
    gameTab === "all"
      ? stats.completed
      : stats.completed.filter((m) => m.gameType === gameTab);
  const gameStats = useMemo(() => {
    const list = filteredByGame;
    const isPlayer1 = (m: StoredMatch) => m.player1.username === username;
    const won = (m: StoredMatch) => (m.winner === "player1" && isPlayer1(m)) || (m.winner === "player2" && !isPlayer1(m));
    const wins = list.filter(won).length;
    const stakes = list.map((m) => m.stakeAmount);
    const maxWon = Math.max(0, ...transactions.filter((t) => t.type === "match_win").map((t) => t.amount));
    const stakeCounts: Record<number, number> = {};
    stakes.forEach((s) => {
      stakeCounts[s] = (stakeCounts[s] ?? 0) + 1;
    });
    const favoriteStake =
      Object.keys(stakeCounts).length > 0
        ? Number(Object.entries(stakeCounts).sort((a, b) => b[1] - a[1])[0][0])
        : 0;
    const avgDuration = list.length ? 3 + Math.random() * 5 : 0;
    const winRate = list.length ? Math.round((wins / list.length) * 1000) / 10 : 0;
    return {
      played: list.length,
      wins,
      winRate,
      avgDuration: list.length ? `${avgDuration.toFixed(1)} min` : "—",
      highestStakeWon: maxWon,
      favoriteStake,
    };
  }, [filteredByGame, username, transactions]);

  const completedSorted = useMemo(
    () => [...stats.completed].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [stats.completed]
  );
  const displayedMatches = showAllMatches ? completedSorted : completedSorted.slice(0, 10);
  const ratingHistoryPoints = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    let r = 1000;
    const sorted = [...stats.completed].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    pts.push({ x: 0, y: r });
    sorted.forEach((m, i) => {
      const isP1 = m.player1.username === username;
      const won = (m.winner === "player1" && isP1) || (m.winner === "player2" && !isP1);
      r = Math.max(100, Math.min(2500, r + (won ? 25 : -25)));
      pts.push({ x: i + 1, y: r });
    });
    if (pts.length === 1) {
      for (let i = 1; i <= 5; i++) pts.push({ x: i, y: 1000 + (Math.random() - 0.5) * 80 });
    }
    return pts;
  }, [stats.completed, username]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiLogout();
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return <VelocityLoader />;
  }

  const isPlayer1 = (m: StoredMatch) => m.player1.username === username;
  const matchWon = (m: StoredMatch) => (m.winner === "player1" && isPlayer1(m)) || (m.winner === "player2" && !isPlayer1(m));
  const getOpponent = (m: StoredMatch) => (isPlayer1(m) ? m.player2 : m.player1);
  const getWinnings = (m: StoredMatch) => {
    if (matchWon(m)) return m.winnerPayout;
    return -m.stakeAmount;
  };

  const chartMin = Math.min(900, ...ratingHistoryPoints.map((p) => p.y)) - 50;
  const chartMax = Math.max(1100, ...ratingHistoryPoints.map((p) => p.y)) + 50;
  const chartW = 600;
  const chartH = 200;
  const pad = { left: 40, right: 20, top: 20, bottom: 30 };
  const innerW = chartW - pad.left - pad.right;
  const innerH = chartH - pad.top - pad.bottom;

  return (
    <div className="min-h-screen bg-charcoal pb-20 md:pb-0">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username={username}
        isDevMode={isDevMode}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        currentPage="profile"
      />
      <ModeToggleBarContent />

      <main className="mx-auto max-w-[1200px] px-4 pt-6 pb-24 sm:px-6 lg:px-8 md:pt-8 md:pb-12">
        {/* Section 1: Profile header */}
        <section
          className="animate-fade-in overflow-hidden rounded-card border border-white/10 bg-gradient-to-br from-[#0E0E12] via-[#1A1A22] to-[#0E0E12]"
          style={{
            backgroundImage: isPractice
              ? "linear-gradient(135deg, rgba(168,85,247,0.07) 0%, transparent 50%, rgba(192,132,252,0.06) 100%)"
              : "linear-gradient(135deg, rgba(255,94,0,0.06) 0%, transparent 50%, rgba(255,122,46,0.05) 100%)",
          }}
        >
          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div
                className={`h-20 w-20 shrink-0 rounded-full bg-gradient-to-br p-0.5 ring-2 ring-white/10 ${
                  isPractice ? "from-purple-500/50 to-fuchsia-500/40" : "from-teal/60 to-[rgba(255,122,46,0.8)]"
                }`}
              >
                <div className="flex h-full w-full items-center justify-center rounded-full bg-charcoal">
                  <span className="text-3xl font-bold text-white">{username.charAt(0).toUpperCase()}</span>
                </div>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-white sm:text-3xl">{username}</h1>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      isPractice ? "bg-purple-500/20 text-purple-300" : "bg-teal/20 text-teal"
                    }`}
                  >
                    Level 1
                  </span>
                </div>
                <p className="mt-1 text-sm text-body-gray">Joined {memberSince}</p>
                <p className="mt-2 flex items-center gap-1.5 text-lg font-semibold text-white">
                  {stats.rating} Rating
                  <span className="rounded bg-white/10 px-2 py-0.5 text-sm font-medium text-body-gray">{rank}</span>
                </p>
              </div>
            </div>
            <Link
              href="/settings"
              className="shrink-0 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              Edit Profile
            </Link>
          </div>
        </section>

        {/* Section 2: Stats overview */}
        <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Total Matches", value: stats.matches.length },
            { label: "Win Rate", value: `${stats.winRate.toFixed(1)}%` },
            { label: "Total Earnings", value: `$${stats.totalEarnings >= 0 ? "" : "-"}${Math.abs(stats.totalEarnings).toFixed(2)}` },
            { label: "Win Streak", value: stats.bestStreak },
          ].map((card, i) => (
            <div
              key={card.label}
              className="card-border animate-fade-in rounded-card bg-card p-5"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <p className="mt-2 text-xs text-body-gray">{card.label}</p>
              <p className="mt-1 text-2xl font-bold text-white">{card.value}</p>
            </div>
          ))}
        </section>

        {/* Practice Stats */}
        <section className="mt-8 animate-fade-in rounded-card border border-purple-500/20 bg-purple-500/5 p-6">
          <h2 className="text-lg font-bold text-purple-300">Practice Stats</h2>
          <p className="mt-1 text-xs text-body-gray">Free play — no money involved</p>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-xs text-body-gray">Practice Matches</p>
              <p className="mt-1 text-xl font-bold text-white">{practiceStats.practiceMatchesPlayed}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-xs text-body-gray">Practice Wins</p>
              <p className="mt-1 text-xl font-bold text-white">{practiceStats.practiceWins}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-xs text-body-gray">Practice Win Rate</p>
              <p className="mt-1 text-xl font-bold text-purple-400">
                {practiceStats.practiceWinRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: Game stats */}
        <section className="mt-10 animate-fade-in">
          <h2 className="text-xl font-bold text-white">Competitive Game Stats</h2>
          <div className="mt-3 flex gap-1 rounded-lg bg-white/5 p-1">
            {GAME_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setGameTab(tab.id)}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  gameTab === tab.id
                    ? isPractice
                      ? "bg-purple-500/20 text-purple-300"
                      : "bg-teal/20 text-teal"
                    : "text-body-gray hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "Matches played", value: gameStats.played },
              { label: "Win rate", value: `${gameStats.winRate.toFixed(1)}%` },
              { label: "Avg. duration", value: gameStats.avgDuration },
              { label: "Highest stake won", value: `$${gameStats.highestStakeWon.toFixed(2)}` },
              { label: "Favorite stake", value: `$${gameStats.favoriteStake.toFixed(2)}` },
            ].map((item) => (
              <div key={item.label} className="card-border rounded-lg bg-card p-4">
                <p className="text-xs text-body-gray">{item.label}</p>
                <p className="mt-1 text-lg font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Match history */}
        <section className="mt-10 animate-fade-in">
          <h2 className="text-xl font-bold text-white">Match History</h2>
          {stats.completed.length === 0 ? (
            <div className="card-border mt-4 rounded-card bg-card p-12 text-center">
              <p className="text-body-gray">No matches yet. Start playing to build your history!</p>
              <Link
                href="/play"
                className={`mt-4 inline-block rounded-lg px-4 py-2 font-medium text-charcoal ${
                  isPractice
                    ? "bg-purple-500 hover:shadow-[0_0_18px_rgba(139,92,246,0.45)]"
                    : "bg-teal hover:shadow-teal-glow"
                }`}
              >
                Find a match
              </Link>
            </div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-sm text-body-gray">
                      <th className="pb-3 pr-4 font-medium">Game</th>
                      <th className="pb-3 pr-4 font-medium">Opponent</th>
                      <th className="pb-3 pr-4 font-medium">Result</th>
                      <th className="pb-3 pr-4 font-medium">Stake</th>
                      <th className="pb-3 pr-4 font-medium">Winnings</th>
                      <th className="pb-3 pr-4 font-medium">Date</th>
                      <th className="pb-3 font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedMatches.map((m) => {
                      const opp = getOpponent(m);
                      const winnings = getWinnings(m);
                      return (
                        <tr key={m.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                          <td className="py-3 pr-4">
                            <span className="font-medium text-white">{m.gameDisplayName}</span>
                          </td>
                          <td className="py-3 pr-4 text-body-gray">
                            {opp.username} <span className="text-xs">({opp.rating})</span>
                          </td>
                          <td className="py-3 pr-4">
                            {matchWon(m) ? (
                              <span
                                className={`rounded px-2 py-0.5 text-xs font-medium ${
                                  isPractice ? "bg-purple-500/20 text-purple-300" : "bg-teal/20 text-teal"
                                }`}
                              >
                                Won
                              </span>
                            ) : (
                              <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">Lost</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-body-gray">${m.stakeAmount.toFixed(2)}</td>
                          <td className={`py-3 pr-4 font-medium ${winnings >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {winnings >= 0 ? "+" : ""}${winnings.toFixed(2)}
                          </td>
                          <td className="py-3 pr-4 text-body-gray">{formatRelative(m.createdAt)}</td>
                          <td className="py-3 text-body-gray">{fakeDuration()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Mobile: compact cards */}
              <div className="mt-4 flex flex-col gap-3 md:hidden">
                {displayedMatches.map((m) => {
                  const opp = getOpponent(m);
                  const winnings = getWinnings(m);
                  return (
                    <div key={m.id} className="card-border rounded-card bg-card p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-white">{m.gameDisplayName}</span>
                        {matchWon(m) ? (
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-medium ${
                              isPractice ? "bg-purple-500/20 text-purple-300" : "bg-teal/20 text-teal"
                            }`}
                          >
                            Won
                          </span>
                        ) : (
                          <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">Lost</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-body-gray">vs {opp.username} ({opp.rating})</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                        <span className="text-body-gray">${m.stakeAmount.toFixed(2)} stake</span>
                        <span className={winnings >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {winnings >= 0 ? "+" : ""}${winnings.toFixed(2)}
                        </span>
                        <span className="text-body-gray">{formatRelative(m.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {stats.completed.length > 10 && (
                <button
                  type="button"
                  onClick={() => setShowAllMatches(!showAllMatches)}
                  className="mt-4 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
                >
                  {showAllMatches ? "Show less" : "View all"}
                </button>
              )}
            </>
          )}
        </section>

        {/* Section 5: Achievements */}
        <section className="mt-10 animate-fade-in">
          <h2 className="text-xl font-bold text-white">Achievements</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
            {ACHIEVEMENTS.map((a) => {
              const unlocked = a.check(stats);
              return (
                <div
                  key={a.id}
                  className={`card-border rounded-card p-4 transition-all ${
                    unlocked
                      ? isPractice
                        ? "border-purple-500/40 bg-card shadow-[0_0_20px_rgba(139,92,246,0.16)]"
                        : "border-steel-blue bg-card shadow-[0_0_20px_rgba(42,58,92,0.4)]"
                      : "border-white/10 bg-card/80 opacity-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{a.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{a.title}</p>
                      <p className="mt-0.5 text-xs text-body-gray">{a.desc}</p>
                      {!unlocked && (
                        <p className="mt-2 flex items-center gap-1 text-xs text-body-gray">
                          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                          Locked
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 6: Rating history */}
        <section className="mt-10 animate-fade-in">
          <h2 className="text-xl font-bold text-white">Rating History</h2>
          <div className="card-border mt-4 overflow-hidden rounded-card bg-card p-4">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full max-w-full" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="ratingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FF5E00" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#FF5E00" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Grid */}
              {[0, 1, 2, 3, 4].map((i) => (
                <line
                  key={`h-${i}`}
                  x1={pad.left}
                  y1={pad.top + (i / 4) * innerH}
                  x2={chartW - pad.right}
                  y2={pad.top + (i / 4) * innerH}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1"
                />
              ))}
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <line
                  key={`v-${i}`}
                  x1={pad.left + (i / 5) * innerW}
                  y1={pad.top}
                  x2={pad.left + (i / 5) * innerW}
                  y2={chartH - pad.bottom}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1"
                />
              ))}
              {/* Area + line */}
              {ratingHistoryPoints.length >= 2 && (
                <>
                  <path
                    d={
                      ratingHistoryPoints
                        .map((p, i) => {
                          const x = pad.left + (p.x / Math.max(1, ratingHistoryPoints.length - 1)) * innerW;
                          const y = pad.top + innerH - ((p.y - chartMin) / (chartMax - chartMin)) * innerH;
                          return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                        })
                        .join(" ") +
                      ` L ${pad.left + innerW} ${chartH - pad.bottom} L ${pad.left} ${chartH - pad.bottom} Z`
                    }
                    fill="url(#ratingGradient)"
                  />
                    <polyline
                    points={ratingHistoryPoints
                      .map((p, i) => {
                        const x = pad.left + (p.x / Math.max(1, ratingHistoryPoints.length - 1)) * innerW;
                        const y = pad.top + innerH - ((p.y - chartMin) / (chartMax - chartMin)) * innerH;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke="#FF5E00"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}
              {ratingHistoryPoints.length === 1 && (
                <line
                  x1={pad.left}
                  y1={pad.top + innerH / 2}
                  x2={chartW - pad.right}
                  y2={pad.top + innerH / 2}
                  stroke="#FF5E00"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              )}
            </svg>
            <div className="mt-2 flex justify-between text-xs text-body-gray">
              <span>Past matches</span>
              <span>{chartMin} – {chartMax} rating</span>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
