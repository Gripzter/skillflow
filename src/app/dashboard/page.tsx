"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/components/Toast";
import AppNavbar from "@/components/AppNavbar";
import Footer from "@/components/Footer";
import Skeleton from "@/components/Skeleton";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import LoadingRing from "@/components/LoadingRing";
import RankBadge from "@/components/RankBadge";
import RankProgressBar from "@/components/RankProgressBar";
import FoundersReward from "@/components/FoundersReward";
import WaitlistOverlay from "@/components/launch/WaitlistOverlay";
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
import {
  IS_SWEEPSTAKES_LAUNCH,
  WAITLIST_UNLOCKED_KEY,
} from "@/constants/economy";
import { formatCurrency } from "@/lib/formatCurrency";
import { getUserSPData, type UserSpData } from "@/lib/skillpoints";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
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
    gradient: "from-amber-500/20 to-rose-500/20",
  },
  {
    slug: "connect-4",
    name: "Connect 4",
    gradient: "from-red-500/30 to-amber-400/30",
  },
  {
    slug: "reaction-duel",
    name: "Reaction Duel",
    gradient: "from-orange-500/30 to-red-500/30",
  },
] as const;

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
  const [practiceMatches, setPracticeMatches] = useState<StoredMatch[]>([]);
  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [quickGameStats, setQuickGameStats] = useState<
    { playersOnline: number }[]
  >([]);
  const [waitlistUnlocked, setWaitlistUnlocked] = useState(!IS_SWEEPSTAKES_LAUNCH);
  const [spData, setSpData] = useState<UserSpData>({
    lifetimeSp: 1000,
    balanceSp: 1000,
    rankTier: "bronze",
  });

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

        const [bal, matchList, txs, apiLeaderboard, userSpData] = await Promise.all([
          getWalletBalance(),
          getMatches(),
          getTransactions(),
          getLeaderboard("total_earnings"),
          getUserSPData(user.id),
        ]);
        setBalance(bal);
        setMatches(matchList as StoredMatch[]);
        setTransactions(txs);
        if (userSpData) {
          setSpData(userSpData);
        }

        const basePlayers: LeaderboardPlayer[] =
          apiLeaderboard?.map((p) => ({
            ...p,
            isCurrentUser: p.username === user.username,
          })) ?? [];
        setLeaderboard(buildLeaderboard(basePlayers));

        // Practice mode data (local-only; no network)
        const pm = getPracticeMatches();
        setPracticeMatches(pm.map((m) => ({ ...(m as unknown as StoredMatch), isPractice: true })));
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

  useEffect(() => {
    if (!IS_SWEEPSTAKES_LAUNCH) return;
    const unlocked = window.localStorage.getItem(WAITLIST_UNLOCKED_KEY) === "true";
    setWaitlistUnlocked(unlocked);
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

  const completedMatchesAll = useMemo(() => {
    const realCompleted = matches.filter((m) => m.status === "completed");
    const practiceCompleted = practiceMatches.filter((m) => m.status === "completed");
    return [...realCompleted, ...practiceCompleted];
  }, [matches, practiceMatches]);

  const totalMatches = completedMatchesAll.length;
  const wins = completedMatchesAll.filter((m) => {
    if (!m.winner) return false;
    const userIsPlayer1 = m.player1.username === username;
    return (m.winner === "player1" && userIsPlayer1) || (m.winner === "player2" && !userIsPlayer1);
  }).length;

  // Win rate across practice + real-money (net earnings remains real-money only)
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

  const recentActivity = useMemo(() => {
    return [...completedMatchesAll]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [completedMatchesAll]);
  const greeting = getGreeting();
  const dashboardLocked = IS_SWEEPSTAKES_LAUNCH && !waitlistUnlocked;
  const isLoading = loading;

  if (loading) {
    return <LoadingRing />;
  }

  return (
    <div className="min-h-screen bg-charcoal pb-20 md:pb-0">
      {dashboardLocked ? (
        <WaitlistOverlay onUnlock={() => setWaitlistUnlocked(true)} />
      ) : null}
      <div className={dashboardLocked ? "pointer-events-none select-none blur-[2px]" : ""}>
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
            <Skeleton isLoading={isLoading} className="inline-block rounded-md">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                {greeting}
              </p>
            </Skeleton>
            <Skeleton isLoading={isLoading} className="mt-1 inline-block rounded-lg">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-100 md:text-3xl">
                {username}
              </h1>
            </Skeleton>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-body-gray">
              <span className="mr-1 text-[10px] uppercase tracking-[0.16em] text-gray-500">
                Balance
              </span>
              <Skeleton as="span" isLoading={isLoading} className="inline-block rounded-md">
                <span className="font-medium text-gray-100">{formatCurrency(balance)}</span>
              </Skeleton>
            </div>
          </div>
        </section>

        <section className="animate-fade-in rounded-card border border-white/10 bg-card/70 p-5" style={{ animationDelay: "40ms" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-body-gray">
                Skill Rank
              </p>
              <RankBadge tier={spData.rankTier} size="large" />
            </div>
            <p className="text-sm font-medium text-white">
              SP Balance: <span className="text-teal">{spData.balanceSp.toLocaleString()}</span>
            </p>
          </div>
          <div className="mt-4">
            <RankProgressBar lifetimeSp={spData.lifetimeSp} currentTier={spData.rankTier} />
          </div>
        </section>

        <section className="animate-fade-in" style={{ animationDelay: "60ms" }}>
          <FoundersReward lifetimeSp={spData.lifetimeSp} currentTier={spData.rankTier} />
        </section>

        {/* 2. Featured game banner – Last Touch */}
        <section className="animate-fade-in" style={{ animationDelay: "80ms" }}>
          <Link
            href="/last-touch"
            className="group relative block overflow-hidden rounded-2xl border-2 border-steel-blue bg-black/40 p-6 shadow-[0_0_40px_rgba(42,58,92,0.4)] transition-all duration-300 hover:border-steel-blue-bright hover:shadow-[0_0_70px_rgba(42,58,92,0.6)]"
          >
            <Image
              src="/games/lasttouch.jpg"
              alt="Last Touch arena background"
              fill
              className="object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-transparent lg:from-black/80 lg:via-black/50" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Skeleton isLoading={isLoading} className="inline-block rounded-md">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-200/80">
                    Featured Event
                  </p>
                </Skeleton>
                <Skeleton isLoading={isLoading} className="inline-block rounded-lg">
                  <h2 className="bg-gradient-to-r from-teal to-purple-500 bg-clip-text text-2xl font-extrabold text-transparent">
                    LAST TOUCH
                  </h2>
                </Skeleton>
                <Skeleton isLoading={isLoading} className="mt-1 inline-block rounded-md">
                  <p className="text-sm text-body-gray">
                    Hold your ground. Win the pot.
                  </p>
                </Skeleton>
                <Skeleton isLoading={isLoading} className="mt-2 inline-block rounded-md">
                  <p className="text-xs text-teal">
                    Massive prize pool • Last finger standing wins
                  </p>
                </Skeleton>
              </div>
              <div className="flex items-center gap-5">
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-body-gray">
                    Current Prize Pool
                  </p>
                  <Skeleton isLoading={isLoading} className="mt-1 inline-block rounded-lg">
                    <p className="text-xl font-semibold text-white">
                      {formatCurrency(1247)}
                    </p>
                  </Skeleton>
                </div>
                <Skeleton isLoading={isLoading} className="rounded-xl">
                  <span className="rounded-xl bg-teal px-5 py-2.5 text-sm font-semibold text-charcoal shadow-[0_0_22px_rgba(255,94,0,0.6)] transition-transform duration-150 group-hover:-translate-y-0.5">
                    Join Now
                  </span>
                </Skeleton>
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
                : "hover:border-steel-blue-bright hover:shadow-[0_0_28px_rgba(42,58,92,0.6)]";

              return (
                <button
                  key={game.slug}
                  type="button"
                  onClick={() => router.push(`/play/${game.slug}`)}
                  disabled={isLoading}
                  className={`group relative flex h-[120px] flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-card text-left text-sm text-gray-100 transition-all duration-200 hover:-translate-y-0.5 ${accentClasses}`}
                  style={{ animationDelay: `${160 + index * 60}ms` }}
                >
                  <Image
                    src={
                      game.slug === "chess"
                        ? "/games/chess.jpg"
                        : game.slug === "connect-4"
                        ? "/games/connect4.jpg"
                        : "/games/reaction.jpg"
                    }
                    alt={`${game.name} background`}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-transparent lg:from-black/80 lg:via-black/50" />
                  <div className="relative z-10 flex h-full flex-col justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Skeleton isLoading={isLoading} className="rounded-md">
                        <span className="font-semibold">{game.name}</span>
                      </Skeleton>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-body-gray">
                      <Skeleton isLoading={isLoading} className="rounded-md">
                        <span>{playersOnline.toLocaleString()} online</span>
                      </Skeleton>
                      <Skeleton isLoading={isLoading} className="rounded-full">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            isPractice
                              ? "bg-purple-500/25 text-purple-100"
                              : "bg-teal/25 text-teal"
                          }`}
                        >
                          Play
                        </span>
                      </Skeleton>
                    </div>
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
          <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <div className="flex gap-3 sm:grid sm:grid-cols-4">
            {/* Win Rate */}
            <div
              className={`card-border relative min-w-[172px] overflow-hidden rounded-card bg-card/80 px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_26px_rgba(42,58,92,0.5)] sm:min-w-0 ${
                totalMatches > 0 && winRate >= 50
                  ? "border-emerald-400/40"
                  : totalMatches > 0
                  ? "border-red-500/40"
                  : "border-white/10"
              }`}
            >
              <div
                className={`pointer-events-none absolute inset-0 rounded-card bg-gradient-to-br opacity-30 ${
                  totalMatches > 0 && winRate >= 50
                    ? "from-emerald-500/40 via-teal/20 to-transparent"
                  : totalMatches > 0
                    ? "from-red-500/40 via-amber-500/20 to-transparent"
                    : "from-white/10 to-transparent"
                }`}
                aria-hidden
              />
              <div className="pointer-events-none absolute -right-4 -top-4 h-10 w-10 rounded-full bg-emerald-400/15 blur-xl" />
              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
                    Win Rate
                  </span>
                </div>
                <p className="mt-1 text-lg font-semibold text-gray-50">
                  <Skeleton as="span" isLoading={isLoading} className="inline-block rounded-md">
                    {totalMatches > 0 ? `${winRate.toFixed(1)}%` : "0.0%"}
                  </Skeleton>
                </p>
                <p className="mt-0.5 text-[11px] text-body-gray">Real-money matches</p>
              </div>
            </div>

            {/* Matches Played */}
            <div className="card-border relative min-w-[172px] overflow-hidden rounded-card border-white/10 bg-card/80 px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_26px_rgba(148,163,184,0.35)] sm:min-w-0">
              <div className="pointer-events-none absolute inset-0 rounded-card bg-gradient-to-br from-white/10 via-slate-700/10 to-transparent opacity-30" />
              <div className="pointer-events-none absolute -right-5 -top-5 h-10 w-10 rounded-full bg-slate-400/20 blur-xl" />
              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
                    Matches
                  </span>
                </div>
                <p className="mt-1 text-lg font-semibold text-gray-50">
                  <Skeleton as="span" isLoading={isLoading} className="inline-block rounded-md">
                    {totalMatches.toLocaleString()}
                  </Skeleton>
                </p>
                <p className="mt-0.5 text-[11px] text-body-gray">Completed games</p>
              </div>
            </div>

            {/* Net Earnings */}
            <div className="card-border relative min-w-[172px] overflow-hidden rounded-card border-emerald-400/40 bg-card/80 px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_26px_rgba(42,58,92,0.5)] sm:min-w-0">
              <div className="pointer-events-none absolute inset-0 rounded-card bg-gradient-to-br from-teal/30 via-emerald-500/10 to-transparent opacity-40" />
              <div className="pointer-events-none absolute -right-6 -top-6 h-12 w-12 rounded-full bg-emerald-400/25 blur-xl" />
              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
                    Net Earnings
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span
                    className={`text-lg font-semibold ${
                      netEarnings >= 0 ? "text-emerald-300" : "text-red-400"
                    }`}
                  >
                    <Skeleton as="span" isLoading={isLoading} className="inline-block rounded-md">
                      {formatCurrency(netEarnings)}
                    </Skeleton>
                  </span>
                  {netEarnings > 0 && (
                    <span className="text-[10px] text-emerald-300">
                      ↑
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-body-gray">Wins minus entries</p>
              </div>
            </div>

            {/* Rank */}
            <div className="card-border relative min-w-[172px] overflow-hidden rounded-card border-amber-400/40 bg-card/80 px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_26px_rgba(251,191,36,0.35)] sm:min-w-0">
              <div className="pointer-events-none absolute inset-0 rounded-card bg-gradient-to-br from-amber-500/25 via-purple-500/15 to-transparent opacity-40" />
              <div className="pointer-events-none absolute -right-5 -top-5 h-11 w-11 rounded-full bg-amber-300/25 blur-xl" />
              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
                    Rank
                  </span>
                </div>
                <p className="mt-1 text-lg font-semibold text-gray-50">
                  <Skeleton as="span" isLoading={isLoading} className="inline-block rounded-md">
                    {playerRank ? `#${playerRank.toLocaleString()}` : "Unranked"}
                  </Skeleton>
                </p>
                <p className="mt-0.5 text-[11px] text-body-gray">
                  {playerRank ? "Global position" : "Play 10 matches to rank"}
                </p>
              </div>
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

          {isLoading ? (
            <div className="divide-y divide-white/5 rounded-lg border border-white/5 bg-black/20">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`loading-row-${index}`} className="px-4 py-3">
                  <Skeleton className="h-4 w-1/2 rounded-md" />
                  <Skeleton className="mt-2 h-3 w-1/3 rounded-md" />
                </div>
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-sm text-body-gray">
              No completed matches yet. Start a match from the Play page to see your history here.
            </div>
          ) : (
            <div className="divide-y divide-white/5 rounded-lg border border-white/5 bg-black/20">
              {recentActivity.map((match) => {
                const userIsPlayer1 = match.player1?.username === username;
                const isDraw = !match.winner;
                const isWin =
                  !isDraw && ((match.winner === "player1" && userIsPlayer1) || (match.winner === "player2" && !userIsPlayer1));
                const resultLabel = isDraw ? "Draw" : isWin ? "Won" : "Lost";
                const resultColor = isDraw
                  ? "text-amber-300"
                  : isWin
                    ? "text-emerald-300"
                    : "text-red-400";
                const opponentName = userIsPlayer1 ? match.player2?.username ?? "Opponent" : match.player1?.username ?? "Opponent";
                const gameImageSrc =
                  match.gameType === "chess"
                    ? "/games/chess.jpg"
                    : match.gameType === "connect-4"
                    ? "/games/connect4.jpg"
                    : match.gameType === "reaction-duel"
                    ? "/games/reaction.jpg"
                    : match.gameType === "spelling-bee"
                    ? "/games/spelling.jpg"
                    : match.gameType === "8-ball-pool"
                    ? "/games/pool.jpg"
                    : undefined;
                const borderColorClass = isDraw
                  ? "border-l-amber-400/60"
                  : isWin
                    ? "border-l-emerald-400/70"
                    : "border-l-red-400/70";
                const stake = match.stakeAmount ?? 0;
                const delta =
                  isDraw ? 0 : isWin ? (match.winnerPayout ?? 0) : -stake;
                const deltaPrefix = delta > 0 ? "+" : delta < 0 ? "-" : "";
                const deltaAbs = Math.abs(delta);

                return (
                  <div
                    key={match.id}
                    className={`relative flex items-center justify-between gap-3 border-l-2 px-4 py-3 text-sm transition-colors duration-150 hover:bg-white/5 ${borderColorClass}`}
                  >
                    {gameImageSrc && (
                      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-10">
                        <Image
                          src={gameImageSrc}
                          alt={`${match.gameDisplayName} background`}
                          fill
                          className="object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-l from-black via-transparent to-transparent" />
                      </div>
                    )}
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-gray-100">
                          {match.gameDisplayName} vs {opponentName}
                        </span>
                      <span className="text-[11px] text-body-gray">
                        {resultLabel}
                        {delta !== 0 && <> · {deltaPrefix}{formatCurrency(deltaAbs)}</>}
                        {" · "}
                        {formatTimeAgo(match.createdAt)}
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
      <div className="border-t border-transparent bg-gradient-to-r from-teal/30 via-teal/10 to-transparent">
        <div className="opacity-80">
          <Footer />
        </div>
      </div>
      </div>
    </div>
  );
}
