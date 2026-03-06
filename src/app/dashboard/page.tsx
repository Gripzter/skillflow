"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import AppNavbar from "@/components/AppNavbar";
import Footer from "@/components/Footer";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import { useGeo } from "@/contexts/GeoContext";
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
import type { PracticeMatch } from "@/lib/practice-matches";
import type { StoredTransaction } from "@/lib/wallet";
import { type LeaderboardPlayer } from "@/lib/leaderboard-data";
import { buildLeaderboard } from "@/lib/leaderboard-seeding";

type GameConfig = {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  tag: string;
};

const GAME_CONFIGS: GameConfig[] = [
  { slug: "8-ball-pool", name: "8 Ball Pool", emoji: "🎱", color: "#10B981", tag: "Popular" },
  { slug: "chess", name: "Chess", emoji: "♟️", color: "#8B5CF6", tag: "Classic" },
  { slug: "connect-4", name: "Connect 4", emoji: "🔴", color: "#F59E0B", tag: "Quick" },
  { slug: "reaction-duel", name: "Reaction Duel", emoji: "⚡", color: "#EF4444", tag: "Fast" },
  { slug: "spelling-bee", name: "Spelling Bee", emoji: "🐝", color: "#F97316", tag: "New" },
];

const STAKE_OPTIONS = [1, 2, 5, 10, 25] as const;

const announcements = [
  {
    id: 1,
    icon: "🎁",
    text: "Invite a friend and you BOTH get $5 bonus!",
    action: "Share Link →",
    link: "/referrals",
    bgGradient: "linear-gradient(135deg, rgba(249,115,22,0.1), rgba(245,158,11,0.05))",
    borderColor: "rgba(249,115,22,0.2)",
    accentColor: "#F97316",
  },
  {
    id: 2,
    icon: "🐝",
    text: "Spelling Bee — Can you spell 'floccinaucinihilipilification' for $50?",
    action: "Play Now →",
    link: "/play/spelling-bee",
    bgGradient: "linear-gradient(135deg, rgba(234,179,8,0.1), rgba(245,158,11,0.05))",
    borderColor: "rgba(234,179,8,0.2)",
    accentColor: "#EAB308",
  },
  {
    id: 3,
    icon: "⚡",
    text: "Reaction Duel — Test your reflexes. Fastest finger wins real cash!",
    action: "Play Now →",
    link: "/play/reaction-duel",
    bgGradient: "linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.05))",
    borderColor: "rgba(239,68,68,0.2)",
    accentColor: "#EF4444",
  },
  {
    id: 4,
    icon: "♟️",
    text: "Chess Masters — $25 stake matches now live. Prove your rating.",
    action: "Play Now →",
    link: "/play/chess",
    bgGradient: "linear-gradient(135deg, rgba(139,92,246,0.1), rgba(139,92,246,0.05))",
    borderColor: "rgba(139,92,246,0.2)",
    accentColor: "#8B5CF6",
  },
  {
    id: 5,
    icon: "🔥",
    text: "New to SkillFlow? Deposit $10+ and get a free practice session!",
    action: "Deposit →",
    link: "/wallet/deposit",
    bgGradient: "linear-gradient(135deg, rgba(0,229,199,0.1), rgba(0,229,199,0.05))",
    borderColor: "rgba(0,229,199,0.2)",
    accentColor: "#00E5C7",
  },
] as const;

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
  const { isRestricted } = useGeo();
  const { isPractice, setMode } = usePlayMode();

  const [username, setUsername] = useState("Player");
  const [userId, setUserId] = useState<string | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [balance, setBalance] = useState(0);
  const [matches, setMatches] = useState<StoredMatch[]>([]);
  const [practiceMatches, setPracticeMatches] = useState<PracticeMatch[]>([]);
  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [selectedStake, setSelectedStake] = useState<number>(5);
  const [onlineCount] = useState(() => 1200 + Math.floor(Math.random() * 1800)); // TODO: replace with real online count
  const [currentAnnouncement, setCurrentAnnouncement] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isAnnouncementHovered, setIsAnnouncementHovered] = useState(false);
  const [practiceStats, setPracticeStats] = useState({
    practiceMatchesPlayed: 0,
    practiceWins: 0,
    practiceWinRate: 0,
  });
  const [practiceDifficulty, setPracticeDifficulty] = useState<Record<string, "easy" | "medium" | "hard">>(() => {
    const initial: Record<string, "easy" | "medium" | "hard"> = {};
    GAME_CONFIGS.forEach((g) => {
      initial[g.slug] = "medium";
    });
    return initial;
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
        setUserId(user.id);
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
        setPracticeMatches(getPracticeMatches());
        setPracticeStats(getPracticeStats(user.username));
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
  const completedPracticeMatches = useMemo(
    () => practiceMatches.filter((m) => m.status === "completed"),
    [practiceMatches]
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
  const recentPracticeActivity = useMemo(
    () => completedPracticeMatches.slice(0, 5),
    [completedPracticeMatches]
  );

  const payoutForStake = useMemo(() => {
    const pot = selectedStake * 2;
    const fee = pot * 0.05;
    return pot - fee;
  }, [selectedStake]);

  const greeting = getGreeting();
  const playerNumber = playerRank ?? 1847;

  function handleQuickMatch() {
    // For now, send to play hub; TODO: wire to random game matchmaking.
    router.push("/play");
  }

  function handleQuickPractice() {
    const randomIndex = Math.floor(Math.random() * GAME_CONFIGS.length);
    const game = GAME_CONFIGS[randomIndex];
    router.push(`/play/${game.slug}?practice=1&difficulty=medium`);
  }

  useEffect(() => {
    if (isAnnouncementHovered) return;
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentAnnouncement((prev) => (prev + 1) % announcements.length);
        setIsTransitioning(false);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, [isAnnouncementHovered]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <svg
          className={`h-10 w-10 animate-spin ${
            isPractice ? "text-purple-400" : "text-teal"
          }`}
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
        className={`pointer-events-none fixed -top-40 -left-32 h-72 w-72 rounded-full blur-[80px] opacity-40 ${
          isPractice ? "bg-purple-500/25" : "bg-teal-500/20"
        }`}
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

      <main className="relative mx-auto max-w-7xl px-4 py-6 pb-24 md:px-6 space-y-6">
        {/* Top bar */}
        <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              {greeting}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-gray-100 md:text-3xl">
                {username}
              </h1>
              <span className="text-sm text-gray-400">#{playerNumber}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                isPractice
                  ? "border border-purple-500/30 bg-purple-500/10 text-purple-200"
                  : "border border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isPractice ? "bg-purple-400" : "bg-emerald-400"
                  }`}
                />
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    isPractice ? "bg-purple-400" : "bg-emerald-400"
                  }`}
                />
              </span>
              <span>{onlineCount.toLocaleString()} online</span>
            </div>
            {!isPractice && (
              <button
                type="button"
                onClick={() => router.push("/wallet")}
                className="pressable inline-flex items-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-charcoal shadow-teal-glow transition-transform hover:-translate-y-0.5"
              >
                <span role="img" aria-hidden>
                  💰
                </span>
                <span>{formatCurrency(balance)}</span>
              </button>
            )}
          </div>
        </section>

        {/* Rotating announcement banner */}
        {announcements.length > 0 && (
          <section
            className="mt-1"
            onMouseEnter={() => setIsAnnouncementHovered(true)}
            onMouseLeave={() => setIsAnnouncementHovered(false)}
          >
            {(() => {
              const announcement = announcements[currentAnnouncement];
              return (
                <div
                  className="mb-2 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.01]"
                  onClick={() => router.push(announcement.link)}
                  style={{
                    background: announcement.bgGradient,
                    border: `1px solid ${announcement.borderColor}`,
                  }}
                >
                  <div
                    className={`flex items-center justify-between px-4 py-3 transition-opacity duration-300 ${
                      isTransitioning ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
                    }`}
                    style={{ transition: "opacity 0.3s, transform 0.3s" }}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex-shrink-0 text-lg" aria-hidden>
                        {announcement.icon}
                      </span>
                      <p className="truncate text-sm font-medium text-gray-200">
                        {announcement.text}
                      </p>
                    </div>
                    <span
                      className="ml-3 hidden flex-shrink-0 text-xs font-bold sm:inline"
                      style={{ color: announcement.accentColor }}
                    >
                      {announcement.action}
                    </span>
                  </div>
                  <div className="flex justify-center gap-1.5 pb-2">
                    {announcements.map((_, i) => (
                      <div
                        key={i}
                        className="h-1 rounded-full transition-all duration-300"
                        style={{
                          width: i === currentAnnouncement ? "16px" : "4px",
                          background:
                            i === currentAnnouncement
                              ? announcement.accentColor
                              : "rgba(255,255,255,0.15)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        {/* Quick stats row */}
        {isPractice ? (
          <section className="grid grid-cols-3 gap-3">
            {/* Practice Win Rate */}
            <div className="card-border relative overflow-hidden rounded-card bg-card backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5">
              <div className="absolute right-[-40px] top-[-40px] h-32 w-32 rounded-full bg-purple-400/15 blur-3xl" aria-hidden />
              <div className="relative p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                    📊 Practice Win Rate
                  </span>
                  <span className="text-[10px] text-gray-400">vs Bot</span>
                </div>
                <p className="mt-2 text-xl font-bold text-white md:text-2xl">
                  {practiceStats.practiceMatchesPlayed > 0
                    ? `${practiceStats.practiceWinRate.toFixed(1)}%`
                    : "0.0%"}
                </p>
                <p className="mt-1 text-[11px] text-gray-400">Safe space to improve.</p>
              </div>
            </div>

            {/* Practice Matches */}
            <div className="card-border relative overflow-hidden rounded-card bg-card backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5">
              <div className="absolute right-[-40px] top-[-40px] h-32 w-32 rounded-full bg-blue-500/15 blur-3xl" aria-hidden />
              <div className="relative p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                    🎮 Practice Matches
                  </span>
                  <span className="text-[10px] text-gray-400">Total played</span>
                </div>
                <p className="mt-2 text-xl font-bold text-white md:text-2xl">
                  {practiceStats.practiceMatchesPlayed}
                </p>
                <p className="mt-1 text-[11px] text-gray-400">No money, just reps.</p>
              </div>
            </div>

            {/* Rank (global) */}
            <div className="card-border relative overflow-hidden rounded-card bg-card backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5">
              <div className="absolute right-[-40px] top-[-40px] h-32 w-32 rounded-full bg-amber-400/20 blur-3xl" aria-hidden />
              <div className="relative p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                    🏆 Rank
                  </span>
                  <span className="text-[10px] text-gray-400">Global</span>
                </div>
                <p className="mt-2 text-xl font-bold text-amber-300 md:text-2xl">
                  {playerRank ? `#${playerRank.toLocaleString()}` : "-"}
                </p>
                <p className="mt-1 text-[11px] text-gray-400">Aim for the money ladder.</p>
              </div>
            </div>
          </section>
        ) : (
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {/* Win Rate */}
            <div className="card-border relative overflow-hidden rounded-card bg-card backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5">
              <div
                className={`absolute right-[-40px] top-[-40px] h-32 w-32 rounded-full blur-3xl ${
                  isPractice ? "bg-purple-500/15" : "bg-teal-400/10"
                }`}
                aria-hidden
              />
              <div className="relative p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                    📊 Win Rate
                  </span>
                  <span className="text-[10px] text-gray-400">Last 30 days</span>
                </div>
                <p className="mt-2 text-xl font-bold text-white md:text-2xl">
                  {totalMatches > 0 ? `${winRate.toFixed(1)}%` : "0.0%"}
                </p>
                <p className="mt-1 text-[11px] text-gray-400">Keep climbing the leaderboard.</p>
              </div>
            </div>

            {/* Matches */}
            <div className="card-border relative overflow-hidden rounded-card bg-card backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5">
              <div className="absolute right-[-40px] top-[-40px] h-32 w-32 rounded-full bg-purple-500/15 blur-3xl" aria-hidden />
              <div className="relative p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                    🎮 Matches
                  </span>
                  <span className="text-[10px] text-gray-400">Total played</span>
                </div>
                <p className="mt-2 text-xl font-bold text-white md:text-2xl">{totalMatches}</p>
                <p className="mt-1 text-[11px] text-gray-400">Experience makes champions.</p>
              </div>
            </div>

            {/* Earnings */}
            <div className="card-border relative overflow-hidden rounded-card bg-card backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5">
              <div className="absolute right-[-40px] top-[-40px] h-32 w-32 rounded-full bg-emerald-500/15 blur-3xl" aria-hidden />
              <div className="relative p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                    💰 Earnings
                  </span>
                  <span className="text-[10px] text-gray-400">Net profit</span>
                </div>
                <p className={`mt-2 text-xl font-bold md:text-2xl ${netEarnings >= 0 ? "text-emerald-300" : "text-red-400"}`}>
                  {formatCurrency(netEarnings)}
                </p>
                <p className="mt-1 text-[11px] text-gray-400">Across your real money matches.</p>
              </div>
            </div>

            {/* Rank */}
            <div className="card-border relative overflow-hidden rounded-card bg-card backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5">
              <div className="absolute right-[-40px] top-[-40px] h-32 w-32 rounded-full bg-amber-400/20 blur-3xl" aria-hidden />
              <div className="relative p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                    🏆 Rank
                  </span>
                  <span className="text-[10px] text-gray-400">Global</span>
                </div>
                <p className="mt-2 text-xl font-bold text-amber-300 md:text-2xl">
                  {playerRank ? `#${playerRank.toLocaleString()}` : "-"}
                </p>
                <p className="mt-1 text-[11px] text-gray-400">Climb the global ladder.</p>
              </div>
            </div>
          </section>
        )}

        {/* Main grid */}
        <section className="grid gap-6 lg:grid-cols-3">
          {/* Left: games + recent activity */}
          <div className="space-y-6 lg:col-span-2">
            {/* Choose Your Arena / Practice Arena */}
            <div className="card-border flex flex-col gap-3 rounded-card bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-white">
                    {isPractice ? "Practice Arena" : "Choose Your Arena"}
                  </h2>
                  <p className="text-xs text-body-gray">
                    {isPractice
                      ? "Play friendly matches vs bot opponents — no money involved."
                      : "Pick a game, set your stake, dominate."}
                  </p>
                </div>
                {!isPractice && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/5 px-1.5 py-1 text-[11px] text-body-gray sm:mt-0">
                    {STAKE_OPTIONS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setSelectedStake(amount)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          selectedStake === amount
                            ? "bg-teal-400/20 text-teal-200 border border-teal-400/60"
                            : "text-body-gray hover:text-white border border-transparent"
                        }`}
                      >
                        ${amount}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Game cards */}
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                {GAME_CONFIGS.map((game) => {
                  const playerCount = 50 + Math.floor(Math.random() * 350);
                  const canPlayReal = !isPractice && !isRestricted;
                  const difficulty = practiceDifficulty[game.slug] ?? "medium";
                  const difficultyLabel =
                    difficulty === "easy" ? "Easy" : difficulty === "hard" ? "Hard" : "Medium";
                  const handleCardClick = () => {
                    if (isPractice) {
                      const level = practiceDifficulty[game.slug] ?? "medium";
                      router.push(`/play/${game.slug}?practice=1&difficulty=${level}`);
                    } else {
                      router.push(`/play/${game.slug}`);
                    }
                  };
                  return (
                    <button
                      key={game.slug}
                      type="button"
                      onClick={handleCardClick}
                      className="group card-border flex w-full items-center gap-4 rounded-card bg-card px-4 py-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--game-color)]"
                      style={{
                        // per-card accent via CSS variable
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore
                        "--game-color": game.color,
                      }}
                    >
                      {/* Left emoji box */}
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-xl text-xl font-semibold"
                        style={{ backgroundColor: `${game.color}26` }}
                      >
                        <span aria-hidden>{game.emoji}</span>
                      </div>
                      {/* Middle content */}
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">{game.name}</p>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{ backgroundColor: `${game.color}33`, color: game.color }}
                          >
                            {game.tag}
                          </span>
                        </div>
                        {isPractice ? (
                          <>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-body-gray">
                              <span className="inline-flex items-center gap-1">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                                  <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-400" />
                                </span>
                                {playerCount} practicing • vs Bot ({difficultyLabel})
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-body-gray">
                              {(["easy", "medium", "hard"] as const).map((level) => {
                                const label =
                                  level === "easy" ? "Easy" : level === "hard" ? "Hard" : "Medium";
                                const isActive = difficulty === level;
                                return (
                                  <button
                                    key={level}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPracticeDifficulty((prev) => ({
                                        ...prev,
                                        [game.slug]: level,
                                      }));
                                    }}
                                    className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                                      isActive
                                        ? "bg-purple-500/80 text-white"
                                        : "bg-white/5 text-body-gray hover:bg-white/10 hover:text-white"
                                    }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-body-gray">
                            <span className="inline-flex items-center gap-1">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                              </span>
                              {playerCount} playing
                            </span>
                            <span className="hidden text-body-gray sm:inline">•</span>
                            <span className="text-emerald-300">
                              Win {formatCurrency(payoutForStake)}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Right play button */}
                      <div>
                        <span
                          className="inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-gray-200 transition-colors group-hover:border-transparent group-hover:bg-white group-hover:text-slate-900"
                        >
                          {isPractice ? "Play vs Bot" : canPlayReal ? "Play" : "Practice"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recent activity */}
            <div className="card-border rounded-card bg-card p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
                {!isPractice && (
                  <Link href="/profile" className="text-xs font-medium text-teal-300 hover:text-teal-200">
                    View history →
                  </Link>
                )}
              </div>
              {(isPractice ? recentPracticeActivity.length === 0 : recentActivity.length === 0) ? (
                <div className="mt-6 flex flex-col items-center justify-center gap-2 py-6 text-sm text-body-gray">
                  <span className="text-3xl" aria-hidden>
                    🎯
                  </span>
                  <p>No {isPractice ? "practice" : "real money"} matches yet.</p>
                  <button
                    type="button"
                    onClick={() => router.push("/play")}
                    className={`mt-2 rounded-full px-4 py-2 text-xs font-semibold text-charcoal ${
                      isPractice
                        ? "bg-purple-500 hover:shadow-[0_0_18px_rgba(139,92,246,0.45)]"
                        : "bg-teal hover:shadow-teal-glow"
                    }`}
                  >
                    {isPractice ? "Start practicing" : "Play now"}
                  </button>
                </div>
              ) : (
                <div className="mt-4 divide-y divide-white/5">
                  {(isPractice ? recentPracticeActivity : recentActivity).map((match) => {
                    const isWin = match.winner === "player1";
                    const color = isWin ? "text-emerald-400" : "text-red-400";
                    const bgIcon = isWin ? "bg-emerald-500/15" : "bg-red-500/15";
                    const icon = isWin ? "✓" : "✕";
                    return (
                      <div
                        key={match.id}
                        className="flex items-center justify-between gap-3 py-3 text-sm text-body-gray transition-colors hover:bg-white/5"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-md ${bgIcon}`}>
                            <span className={color}>{icon}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-white">
                              {match.gameDisplayName} vs {match.player2.username}
                            </span>
                            <span className="text-[11px] text-body-gray">
                              {formatTimeAgo(match.createdAt)}{isPractice ? " · Practice" : ""}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-bold ${color}`}>
                            {isWin ? "✓ Won" : "✕ Lost"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Wallet card (real money only) */}
            {!isPractice && (
              <div className="card-border relative overflow-hidden rounded-card bg-card p-4 sm:p-5">
              <div className="absolute inset-0 rounded-card border-2 border-transparent bg-gradient-to-r from-teal/20 via-transparent to-purple/20 opacity-60" />
                <div className="relative flex flex-col gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-200/80">
                      Your Balance
                    </p>
                    <p className="mt-2 text-3xl font-bold text-white">
                      {formatCurrency(balance)}
                    </p>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => router.push("/wallet/deposit")}
                      className="flex-1 rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-charcoal shadow-teal-glow transition hover:shadow-teal-glow-lg"
                    >
                      Deposit
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/wallet/withdraw")}
                      className="flex-1 rounded-lg border border-white/30 bg-transparent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5"
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
              </div>
            )
            }

            {/* Leaderboard card */}
            <div className="card-border rounded-card bg-card p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Top Players</h2>
                <Link
                  href="/leaderboard"
                  className={`text-xs font-medium ${
                    isPractice
                      ? "text-purple-300 hover:text-purple-200"
                      : "text-teal-300 hover:text-teal-200"
                  }`}
                >
                  View all →
                </Link>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                {leaderboard.slice(0, 5).map((p, idx) => {
                  const rank = idx + 1;
                  let rankColor = "text-gray-400";
                  if (rank === 1) rankColor = "text-yellow-400";
                  if (rank === 2) rankColor = "text-gray-300";
                  if (rank === 3) rankColor = "text-amber-600";
                  const isCurrent = p.isCurrentUser || p.username === username;
                  return (
                    <div
                      key={`${p.id}-top-${rank}`}
                      className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${
                        isCurrent
                          ? isPractice
                            ? "bg-purple-500/10 border border-purple-500/40"
                            : "bg-teal-500/10 border border-teal-500/40"
                          : "border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className={`w-5 text-xs font-semibold ${rankColor}`}>#{rank}</span>
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${p.avatarGradient}`}
                        >
                          <span className="text-xs font-semibold text-white">
                            {p.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="max-w-[90px] truncate text-sm text-gray-100 sm:max-w-[120px]">
                          {isCurrent ? "You" : p.username}
                        </span>
                      </div>
                      <div className="text-right text-[11px] text-gray-400">
                        <div className="text-xs font-semibold text-emerald-300">
                          {formatCurrency(p.totalEarnings)}
                        </div>
                        <div className="text-[10px]">
                          {p.totalMatches > 0 ? `${p.winRate.toFixed(1)}% WR` : "0.0% WR"} •{" "}
                          {p.totalMatches.toLocaleString()} matches
                        </div>
                      </div>
                    </div>
                  );
                })}
                {playerRank && playerRank > 5 && (() => {
                  const current = leaderboard.find((p) => p.isCurrentUser || p.username === username);
                  if (!current) return null;
                  return (
                    <div
                      key={`${current.id}-you`}
                      className={`mt-2 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${
                        isPractice
                          ? "border border-purple-500/60 bg-purple-500/10"
                          : "border border-teal/50 bg-teal/10"
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span
                          className={`w-5 text-xs font-semibold ${
                            isPractice ? "text-purple-400" : "text-teal"
                          }`}
                        >
                          #{playerRank.toLocaleString()}
                        </span>
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${current.avatarGradient}`}
                        >
                          <span className="text-xs font-semibold text-white">
                            {current.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="max-w-[90px] truncate text-sm text-gray-100 sm:max-w-[120px]">
                          You
                        </span>
                      </div>
                      <div className="text-right text-[11px] text-gray-400">
                        <div className="text-xs font-semibold text-emerald-300">
                          {formatCurrency(current.totalEarnings)}
                        </div>
                        <div className="text-[10px]">
                          {current.totalMatches > 0 ? `${current.winRate.toFixed(1)}% WR` : "0.0% WR"} •{" "}
                          {current.totalMatches.toLocaleString()} matches
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Referral card */}
            <div className="card-border relative overflow-hidden rounded-card bg-card p-4">
              <div className="pointer-events-none absolute -right-6 top-4 text-6xl opacity-20" aria-hidden>
                🎁
              </div>
              <div className="relative space-y-2">
                <h2 className="text-sm font-semibold text-white">Invite &amp; Earn</h2>
                <p className="text-xs text-body-gray">
                  You both get <span className="font-semibold">$5</span> when your friend makes their first deposit.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/referrals")}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg bg-orange-400 px-4 py-2 text-xs font-semibold text-[#0A0E17] shadow-[0_0_18px_rgba(251,146,60,0.45)] hover:bg-orange-300"
                >
                  Share Your Link
                </button>
              </div>
            </div>

            {/* Quick match / Quick practice CTA */}
            {isPractice ? (
              <div className="rounded-card border border-purple-500/60 bg-purple-500/10 p-[1px] shadow-[0_4px_20px_rgba(168,85,247,0.45)]">
                <button
                  type="button"
                  onClick={handleQuickPractice}
                  className="relative flex w-full items-center justify-between overflow-hidden rounded-card bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 px-5 py-3.5 text-left text-white transition-transform hover:-translate-y-0.5"
                >
                  <div className="relative z-10 flex flex-col">
                    <span className="text-base font-bold md:text-lg">
                      🎮 Quick Practice
                    </span>
                    <span className="text-xs font-medium text-white/80 md:text-sm">
                      We&apos;ll pick a random game vs bot on Medium difficulty.
                    </span>
                  </div>
                  <div className="relative z-10 text-sm font-semibold uppercase tracking-[0.18em]">
                    Play now
                  </div>
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-y-0 -left-1 w-1/3 shimmer" />
                  </div>
                </button>
              </div>
            ) : (
              <div className="rounded-card border border-teal/40 bg-teal/10 p-[1px] shadow-[0_4px_20px_rgba(0,229,199,0.3)]">
                <button
                  type="button"
                  onClick={handleQuickMatch}
                  className="relative flex w-full items-center justify-between overflow-hidden rounded-card bg-gradient-to-r from-teal to-emerald-400 px-5 py-3.5 text-left text-[#0A0E17] transition-transform hover:-translate-y-0.5"
                >
                  <div className="relative z-10 flex flex-col">
                    <span className="text-base font-bold md:text-lg">
                      ⚡ Quick Match — {formatCurrency(selectedStake)}
                    </span>
                    <span className="text-xs font-medium text-[#0A0E17]/80 md:text-sm">
                      We&apos;ll find you a game instantly at this stake.
                    </span>
                  </div>
                  <div className="relative z-10 text-sm font-semibold uppercase tracking-[0.18em]">
                    Play now
                  </div>
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-y-0 -left-1 w-1/3 shimmer" />
                  </div>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Bottom banner */}
        {isPractice ? (
          <section className="mt-4 rounded-xl border border-purple-500/40 bg-gradient-to-r from-purple-500/15 via-fuchsia-500/10 to-purple-500/15 px-4 py-4 backdrop-blur-sm">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-2xl" aria-hidden>
                  💰
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-purple-200">Ready for Real Stakes?</h3>
                  <p className="text-xs text-gray-300">
                    Switch to real money matches and compete for cash.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMode("real")}
                className="rounded-lg bg-gradient-to-r from-purple-500 to-fuchsia-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_0_18px_rgba(139,92,246,0.45)] hover:brightness-110"
              >
                Play for Real Money
              </button>
            </div>
          </section>
        ) : (
          <section className="mt-4 rounded-xl border border-purple-400/40 bg-purple-500/10 px-4 py-4 backdrop-blur-sm">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-2xl" aria-hidden>
                  🎯
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-100">Practice Mode</h3>
                  <p className="text-xs text-gray-400">
                    Sharpen your skills with free matches — no money required.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMode("practice")}
                className="rounded-lg bg-purple-500/90 px-4 py-2 text-xs font-semibold text-white shadow-[0_0_14px_rgba(168,85,247,0.6)] hover:bg-purple-400"
              >
                Switch to Practice
              </button>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
