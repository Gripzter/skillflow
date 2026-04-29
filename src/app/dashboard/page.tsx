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
import OnboardingFlow from "@/components/OnboardingFlow";
import SPIcon from "@/components/SPIcon";
import SkilliesIcon from "@/components/SkilliesIcon";
import DailyLoginReward from "@/components/DailyLoginReward";
import { usePlayMode } from "@/contexts/PlayModeContext";
import {
  getCurrentUser,
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
  LAST_TOUCH_FEATURED_PRIZE_POOL_SP,
  IS_SWEEPSTAKES_LAUNCH,
} from "@/constants/economy";
import { formatCurrency } from "@/lib/formatCurrency";
import { getUserSPData, type UserSpData } from "@/lib/skillpoints";
import { createClient } from "@/lib/supabase";
import {
  claimChallengeReward,
  getDailyChallenges,
  resolveSessionUserId,
  type DailyChallengeRow,
} from "@/lib/daily-challenges";
import {
  markFoundersPromptShown,
  submitFoundersProgramSignup,
} from "@/lib/founders-program";

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

function formatTierLabel(tier: string): string {
  if (!tier) return "Bronze";
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
}

function getUtcResetCountdown() {
  const now = new Date();
  const nextUtcMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  const diffMs = Math.max(0, nextUtcMidnight.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;
}

function extractMatchIdFromDescription(description: string | null | undefined): string | null {
  if (!description) return null;
  const match = description.match(/\[.*match:([0-9a-f-]{36}).*\]/i);
  return match?.[1] ?? null;
}

const DAILY_REWARD_SCHEDULE = [50, 75, 100, 150, 200, 300, 500] as const;

function dateOnlyString(input: Date): string {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function getNextDailyStreak(lastRewardDate: string | null, currentStreak: number, today: Date): number | null {
  const todayStr = dateOnlyString(today);
  if (lastRewardDate === todayStr) return null;
  if (!lastRewardDate) return 1;

  const lastDate = parseDateOnly(lastRewardDate);
  const todayDate = parseDateOnly(todayStr);
  const msPerDay = 24 * 60 * 60 * 1000;
  const dayDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / msPerDay);
  if (dayDiff <= 0) return null;
  if (dayDiff === 1) return currentStreak >= 1 ? (currentStreak % 7) + 1 : 1;
  return 1;
}

const QUICK_GAMES = [
  {
    slug: "chess",
    name: "Chess",
    image: "/images/chess-card.png",
  },
  {
    slug: "connect-4",
    name: "Connect 4",
    image: "/images/connect4-card.png",
  },
  {
    slug: "reaction-duel",
    name: "Reaction Duel",
    image: "/images/reaction-duel-card.png",
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
  const [matches, setMatches] = useState<StoredMatch[]>([]);
  const [practiceMatches, setPracticeMatches] = useState<StoredMatch[]>([]);
  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [quickGameStats, setQuickGameStats] = useState<
    { playersOnline: number }[]
  >([]);
  const [spData, setSpData] = useState<UserSpData>({
    lifetimeSp: 1000,
    balanceSp: 1000,
    rankTier: "bronze",
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [dailyChallenges, setDailyChallenges] = useState<DailyChallengeRow[]>([]);
  const [claimingChallengeId, setClaimingChallengeId] = useState<string | null>(null);
  const [resetCountdown, setResetCountdown] = useState(getUtcResetCountdown());
  const [spByMatchId, setSpByMatchId] = useState<Record<string, number>>({});
  const [showFoundersPrompt, setShowFoundersPrompt] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [foundersEmail, setFoundersEmail] = useState("");
  const [foundersEmailError, setFoundersEmailError] = useState("");
  const [foundersSaving, setFoundersSaving] = useState(false);
  const [showDailyReward, setShowDailyReward] = useState(false);
  const [dailyRewardDay, setDailyRewardDay] = useState(1);
  const [dailyRewardAmount, setDailyRewardAmount] = useState(DAILY_REWARD_SCHEDULE[0]);
  const [claimingDailyReward, setClaimingDailyReward] = useState(false);

  const foundersPromptStorageKey = useMemo(
    () => (userId ? `skillflow_founders_prompt_seen_${userId}` : null),
    [userId]
  );

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
        const { resolvedUserId: effectiveUserId } = await resolveSessionUserId(user.id);
        setUserId(effectiveUserId);
        setFoundersEmail(user.email ?? "");
        // eslint-disable-next-line no-console
        console.log("[Dashboard] Using user ID for SP/challenges", {
          originalUserId: user.id,
          effectiveUserId,
          username: user.username,
        });

        const [matchList, txs, apiLeaderboard, userSpData, challenges] = await Promise.all([
          getMatches(),
          getTransactions(),
          getLeaderboard("total_earnings"),
          getUserSPData(effectiveUserId),
          getDailyChallenges(effectiveUserId),
        ]);
        setMatches(matchList as StoredMatch[]);
        setTransactions(txs);
        setDailyChallenges(challenges);
        if (userSpData) {
          setSpData(userSpData);
        }
        if (!challenges.length) {
          // eslint-disable-next-line no-console
          console.warn("[Dashboard] No daily challenges returned", {
            userId: effectiveUserId,
          });
        }

        const supabase = createClient();
        if (supabase) {
          const { data: dailyProfile, error: dailyProfileError } = await supabase
            .from("profiles")
            .select("daily_login_streak, last_login_reward_date")
            .eq("id", effectiveUserId)
            .maybeSingle();

          if (!dailyProfileError && dailyProfile) {
            const nextStreak = getNextDailyStreak(
              (dailyProfile as { last_login_reward_date?: string | null }).last_login_reward_date ?? null,
              Number((dailyProfile as { daily_login_streak?: number | null }).daily_login_streak ?? 0),
              new Date()
            );
            if (nextStreak) {
              const rewardAmount = DAILY_REWARD_SCHEDULE[nextStreak - 1];
              setDailyRewardDay(nextStreak);
              setDailyRewardAmount(rewardAmount);
              setShowDailyReward(true);
            }
          }

          const { data: onboardingData, error: onboardingError } = await supabase
            .from("profiles")
            .select("onboarding_completed, founders_prompt_shown")
            .eq("id", effectiveUserId)
            .maybeSingle();

          const promptShownLocally =
            typeof window !== "undefined" &&
            window.localStorage.getItem(`skillflow_founders_prompt_seen_${effectiveUserId}`) === "true";

          let shouldShowOnboarding = false;
          let shouldShowFounders = false;

          if (onboardingError?.code === "42703") {
            const { data: foundersPromptData } = await supabase
              .from("profiles")
              .select("founders_prompt_shown")
              .eq("id", effectiveUserId)
              .maybeSingle();

            const promptShownFromDb = Boolean(
              (foundersPromptData as { founders_prompt_shown?: boolean } | null)?.founders_prompt_shown
            );
            shouldShowOnboarding = !promptShownFromDb;
            shouldShowFounders = false;
          } else {
            const profileRow = onboardingData as
              | { onboarding_completed?: boolean | null; founders_prompt_shown?: boolean | null }
              | null;
            const onboardingCompleted = profileRow?.onboarding_completed === true;
            const promptShownFromDb = Boolean(profileRow?.founders_prompt_shown);
            shouldShowOnboarding = !onboardingCompleted;
            shouldShowFounders = !shouldShowOnboarding && !promptShownFromDb && !promptShownLocally;
          }

          if (shouldShowOnboarding) {
            setShowOnboarding(true);
          }
          if (shouldShowFounders && !promptShownLocally) {
            setShowFoundersPrompt(true);
          }

          const { data: spRows, error: spRowsError } = await supabase
            .from("sp_transactions")
            .select("amount, type, description, created_at")
            .eq("user_id", effectiveUserId)
            .in("type", ["match_win", "match_loss"])
            .order("created_at", { ascending: false })
            .limit(300);

          if (spRowsError) {
            // eslint-disable-next-line no-console
            console.error("[Dashboard] Failed to load match SP rows", spRowsError.message);
          } else {
            const nextMap: Record<string, number> = {};
            for (const row of spRows ?? []) {
              const matchId = extractMatchIdFromDescription(row.description as string | null);
              if (!matchId) continue;
              if (typeof nextMap[matchId] === "number") continue;
              nextMap[matchId] = Number(row.amount ?? 0);
            }
            setSpByMatchId(nextMap);
          }
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
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[Dashboard] Failed to load dashboard data", error);
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
    const interval = window.setInterval(() => {
      setResetCountdown(getUtcResetCountdown());
    }, 1000);
    return () => window.clearInterval(interval);
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

  async function handleClaimChallenge(challengeId: string) {
    if (!userId || claimingChallengeId) return;
    setClaimingChallengeId(challengeId);
    try {
      const result = await claimChallengeReward(userId, challengeId);
      if (!result.success) {
        showToast(result.error, "error");
        return;
      }

      showToast(`Claimed +${result.rewardSp}`, "success");
      const [nextChallenges, nextSpData] = await Promise.all([
        getDailyChallenges(userId),
        getUserSPData(userId),
      ]);
      setDailyChallenges(nextChallenges);
      if (nextSpData) {
        setSpData(nextSpData);
      }
    } finally {
      setClaimingChallengeId(null);
    }
  }

  async function handleClaimDailyReward() {
    if (!userId || claimingDailyReward) return;
    const supabase = createClient();
    if (!supabase) return;
    setClaimingDailyReward(true);
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("balance_sp, lifetime_sp, daily_login_streak, last_login_reward_date")
        .eq("id", userId)
        .single();

      if (profileError || !profile) {
        showToast("Could not claim daily reward right now.", "error");
        return;
      }

      const todayStr = dateOnlyString(new Date());
      const lastRewardDate = (profile as { last_login_reward_date?: string | null }).last_login_reward_date ?? null;
      if (lastRewardDate === todayStr) {
        setShowDailyReward(false);
        return;
      }

      const nextStreak =
        getNextDailyStreak(
          lastRewardDate,
          Number((profile as { daily_login_streak?: number | null }).daily_login_streak ?? 0),
          new Date()
        ) ?? dailyRewardDay;
      const rewardAmount = DAILY_REWARD_SCHEDULE[nextStreak - 1];
      const nextBalance = Number((profile as { balance_sp?: number | null }).balance_sp ?? 0) + rewardAmount;
      const nextLifetime = Number((profile as { lifetime_sp?: number | null }).lifetime_sp ?? 0) + rewardAmount;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          balance_sp: nextBalance,
          lifetime_sp: nextLifetime,
          daily_login_streak: nextStreak,
          last_login_reward_date: todayStr,
        })
        .eq("id", userId);

      if (updateError) {
        showToast("Failed to save daily reward.", "error");
        return;
      }

      await supabase.from("sp_transactions").insert({
        user_id: userId,
        amount: rewardAmount,
        type: "daily_bonus",
        description: `Daily login reward (Day ${nextStreak})`,
      });

      setSpData((prev) => ({
        ...prev,
        balanceSp: nextBalance,
        lifetimeSp: nextLifetime,
      }));
      setShowDailyReward(false);
      showToast(`Daily reward claimed: +${rewardAmount} Skillies`, "success");
    } finally {
      setClaimingDailyReward(false);
    }
  }

  async function dismissFoundersPrompt() {
    if (!userId) return;
    setFoundersSaving(true);
    await markFoundersPromptShown(userId);
    if (foundersPromptStorageKey) {
      window.localStorage.setItem(foundersPromptStorageKey, "true");
    }
    setShowFoundersPrompt(false);
    setFoundersSaving(false);
  }

  async function handleFoundersJoin() {
    if (!userId || foundersSaving) return;
    const normalizedEmail = foundersEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setFoundersEmailError("Enter a valid email address.");
      return;
    }

    setFoundersSaving(true);
    setFoundersEmailError("");
    const result = await submitFoundersProgramSignup({
      email: normalizedEmail,
      userId,
    });
    if (!result.success) {
      setFoundersSaving(false);
      setFoundersEmailError(result.message);
      return;
    }

    await markFoundersPromptShown(userId);
    if (foundersPromptStorageKey) {
      window.localStorage.setItem(foundersPromptStorageKey, "true");
    }
    setShowFoundersPrompt(false);
    showToast(result.message, "success");
    setFoundersSaving(false);
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
  const isLoading = loading;

  if (loading) {
    return <LoadingRing />;
  }

  return (
    <div className="min-h-screen bg-charcoal pb-20 md:pb-0">
      {showOnboarding && userId ? (
        <OnboardingFlow
          userId={userId}
          onComplete={() => {
            setShowOnboarding(false);
            setShowFoundersPrompt(false);
            if (foundersPromptStorageKey) {
              window.localStorage.setItem(foundersPromptStorageKey, "true");
            }
          }}
        />
      ) : null}
      {showFoundersPrompt && !showOnboarding ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-charcoal/95 px-4">
          <div className="w-full max-w-xl rounded-card border border-white/10 bg-card p-6 shadow-[0_0_32px_rgba(0,0,0,0.45)]">
            <div className="mb-3 flex items-center gap-2">
              <Image
                src="/images/badge-founders.png"
                alt="Founders badge"
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
              />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
                FOUNDERS PROGRAM
              </p>
            </div>
            <h2 className="mt-2 text-2xl font-extrabold text-white">FOUNDERS PROGRAM</h2>
            <p className="mt-3 text-sm text-body-gray">
              Join the SkillFlow Founders Program and earn exclusive rewards during our beta. Founders get permanent badges, starting credits, and early access to new features.
            </p>
            <button
              type="button"
              onClick={() => router.push("/founders")}
              className="mt-4 text-sm font-medium text-teal hover:underline"
            >
              Learn more about the Founders Program
            </button>

            <div className="mt-5">
              <p className="text-sm text-body-gray">Get Founders Program updates at:</p>
              <input
                type="email"
                value={foundersEmail}
                onChange={(event) => {
                  setFoundersEmail(event.target.value);
                  if (foundersEmailError) setFoundersEmailError("");
                }}
                placeholder="you@example.com"
                className="mt-2 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-body-gray focus:border-teal focus:outline-none"
                autoComplete="email"
                disabled={foundersSaving}
              />
              {foundersEmailError ? (
                <p className="mt-2 text-xs text-red-400">{foundersEmailError}</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handleFoundersJoin}
              disabled={foundersSaving}
              className="mt-5 w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {foundersSaving ? "Saving..." : "Join Founders Program"}
            </button>
            <button
              type="button"
              onClick={dismissFoundersPrompt}
              disabled={foundersSaving}
              className="mt-4 w-full text-center text-sm text-body-gray underline-offset-2 hover:text-white hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              I don&apos;t want to be a founder
            </button>
          </div>
        </div>
      ) : null}
      <DailyLoginReward
        isOpen={showDailyReward && !showOnboarding}
        streakDay={dailyRewardDay}
        rewardAmount={dailyRewardAmount}
        claiming={claimingDailyReward}
        onClaim={handleClaimDailyReward}
      />
      <div>
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
        {/* 1. Greeting */}
        <section className="animate-fade-in">
          <div>
            <Skeleton isLoading={isLoading} className="inline-block rounded-lg">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-100">
                {`${greeting}, ${username}`}
              </h1>
            </Skeleton>
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
              <span className="inline-flex items-center gap-1">
                <SkilliesIcon size={16} /> Skillies:
              </span>{" "}
              <span className="text-teal">{spData.balanceSp.toLocaleString()}</span>
            </p>
          </div>
          <div className="mt-4">
            <RankProgressBar lifetimeSp={spData.lifetimeSp} currentTier={spData.rankTier} />
          </div>
        </section>

        <section className="animate-fade-in" style={{ animationDelay: "60ms" }}>
          <FoundersReward lifetimeSp={spData.lifetimeSp} currentTier={spData.rankTier} />
        </section>

        <section className="animate-fade-in rounded-card border border-white/10 bg-card/80 p-5" style={{ animationDelay: "70ms" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Daily Challenges</h2>
            <p className="text-xs text-body-gray">Resets in {resetCountdown} (UTC)</p>
          </div>
          {dailyChallenges.length === 0 ? (
            <p className="mt-3 text-sm text-body-gray">No daily challenges available right now.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dailyChallenges.map((challenge) => {
                const progress = Number(challenge.progress ?? 0);
                const target = Number(challenge.target ?? 1);
                const percent = Math.max(0, Math.min(100, (progress / Math.max(1, target)) * 100));
                return (
                  <div key={challenge.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <p className="text-sm font-semibold text-white">{challenge.description}</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-teal transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-body-gray">
                      {progress}/{target}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-emerald-300">
                      <span className="inline-flex items-center gap-1">
                        +{Number(challenge.reward_sp).toLocaleString()} <SkilliesIcon size={16} />
                      </span>
                    </p>
                    <div className="mt-3">
                      {challenge.claimed ? (
                        <span className="rounded bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-300">
                          Claimed
                        </span>
                      ) : challenge.completed ? (
                        <button
                          type="button"
                          onClick={() => handleClaimChallenge(challenge.id)}
                          disabled={claimingChallengeId === challenge.id}
                          className="rounded bg-teal px-3 py-1.5 text-xs font-semibold text-charcoal disabled:opacity-60"
                        >
                          Claim
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
            <div className="relative pr-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                      <span className="inline-flex items-center gap-1">
                        {LAST_TOUCH_FEATURED_PRIZE_POOL_SP.toLocaleString()} <SkilliesIcon size={18} />
                      </span>
                    </p>
                  </Skeleton>
                </div>
                <Skeleton isLoading={isLoading} className="rounded-xl">
                  <span className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-charcoal shadow-[0_0_22px_rgba(255,94,0,0.6)] transition-transform duration-150 group-hover:-translate-y-0.5">
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
          <div className="-mx-1 overflow-x-auto px-1 pb-2">
            <div className="flex gap-4">
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
                  className={`group relative flex h-[280px] min-w-[200px] flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-card text-left text-sm text-gray-100 transition-all duration-200 hover:-translate-y-0.5 ${accentClasses}`}
                  style={{ animationDelay: `${160 + index * 60}ms` }}
                >
                  <Image
                    src={game.image}
                    alt={`${game.name} background`}
                    fill
                    className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
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
                <p className="mt-0.5 text-[11px] text-body-gray">
                  {IS_SWEEPSTAKES_LAUNCH ? "All matches" : "Real-money matches"}
                </p>
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

            {/* Net Earnings / Lifetime SP */}
            <div className="card-border relative min-w-[172px] overflow-hidden rounded-card border-emerald-400/40 bg-card/80 px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_26px_rgba(42,58,92,0.5)] sm:min-w-0">
              <div className="pointer-events-none absolute inset-0 rounded-card bg-gradient-to-br from-teal/30 via-emerald-500/10 to-transparent opacity-40" />
              <div className="pointer-events-none absolute -right-6 -top-6 h-12 w-12 rounded-full bg-emerald-400/25 blur-xl" />
              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
                    {IS_SWEEPSTAKES_LAUNCH ? "Total SP Earned" : "Net Earnings"}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span
                    className={`text-lg font-semibold ${
                      IS_SWEEPSTAKES_LAUNCH || netEarnings >= 0 ? "text-emerald-300" : "text-red-400"
                    }`}
                  >
                    <Skeleton as="span" isLoading={isLoading} className="inline-block rounded-md">
                      {IS_SWEEPSTAKES_LAUNCH
                        ? `${spData.lifetimeSp.toLocaleString()}`
                        : formatCurrency(netEarnings)}
                    </Skeleton>
                    {IS_SWEEPSTAKES_LAUNCH ? <SPIcon size={16} className="ml-1" /> : null}
                  </span>
                  {!IS_SWEEPSTAKES_LAUNCH && netEarnings > 0 && (
                    <span className="text-[10px] text-emerald-300">
                      ↑
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-body-gray">
                  {IS_SWEEPSTAKES_LAUNCH ? "Lifetime SkillPoints" : "Wins minus entries"}
                </p>
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
                    {IS_SWEEPSTAKES_LAUNCH
                      ? formatTierLabel(spData.rankTier)
                      : playerRank
                        ? `#${playerRank.toLocaleString()}`
                        : "Unranked"}
                  </Skeleton>
                </p>
                <p className="mt-0.5 text-[11px] text-body-gray">
                  {IS_SWEEPSTAKES_LAUNCH
                    ? "Based on lifetime SP"
                    : playerRank
                      ? "Global position"
                      : "Play 10 matches to rank"}
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
                    ? "/images/chess-card.png"
                    : match.gameType === "connect-4"
                    ? "/images/connect4-card.png"
                    : match.gameType === "reaction-duel"
                    ? "/images/reaction-duel-card.png"
                    : match.gameType === "spelling-bee"
                    ? "/images/spelling-bee-card.png"
                    : match.gameType === "checkers"
                    ? "/images/checkers-card.png"
                    : match.gameType === "memory-match"
                    ? "/images/memory-match-card.png"
                    : match.gameType === "typing-race"
                    ? "/images/typing-race-card.png"
                    : match.gameType === "trivia"
                    ? "/images/trivia-card.png"
                    : undefined;
                const borderColorClass = isDraw
                  ? "border-l-amber-400/60"
                  : isWin
                    ? "border-l-emerald-400/70"
                    : "border-l-red-400/70";
                const spDelta = isDraw
                  ? 0
                  : typeof spByMatchId[match.id] === "number"
                    ? spByMatchId[match.id]
                    : isWin
                      ? 100
                      : 25;
                const spPrefix = spDelta >= 0 ? "+" : "";

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
                        {!isDraw && (
                          <>
                            {" "}
                            ·{" "}
                            <span className="inline-flex items-center gap-1">
                              {spPrefix}
                              {Math.abs(spDelta).toLocaleString()} <SkilliesIcon size={12} />
                            </span>
                          </>
                        )}
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
