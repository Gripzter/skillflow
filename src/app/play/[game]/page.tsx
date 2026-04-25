"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import AppNavbar, { dispatchWalletUpdated } from "@/components/AppNavbar";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import { useToast } from "@/components/Toast";
import LoadingRing from "@/components/LoadingRing";
import SkilliesIcon from "@/components/SkilliesIcon";
import { useGeo } from "@/contexts/GeoContext";
import { usePlayMode } from "@/contexts/PlayModeContext";
import { useMatchmaking } from "@/hooks/useMatchmaking";
import {
  getCurrentUser,
  createMatch,
  generateFakeOpponent,
  type PlayerInfo,
  type StoredMatch,
} from "@/lib/api";
import { creditSP, getUserSPData, spendSP } from "@/lib/skillpoints";

const STAKE_PRESETS = [100, 200, 500, 1000, 2500, 5000];

export type BotDifficulty = "rookie" | "gamer" | "professional";

const DIFFICULTY_OPTIONS: { value: BotDifficulty; label: string; description: string }[] = [
  { value: "rookie", label: "Rookie", description: "Learning the ropes. A great place to start." },
  { value: "gamer", label: "Gamer", description: "A solid opponent. Bring your A-game." },
  { value: "professional", label: "Professional", description: "Near-perfect play. Only the best can win." },
];
const GAME_SLUG_TO_NAME: Record<string, string> = {
  "8-ball-pool": "8 Ball Pool",
  chess: "Chess",
  "connect-4": "Connect 4",
  "reaction-duel": "Reaction Duel",
  "memory-match": "Memory Match",
  checkers: "Checkers",
  "spelling-bee": "Spelling Bee",
  trivia: "Trivia",
  "typing-race": "Typing Race",
  "last-touch": "Last Touch",
};

export default function PlayGamePage() {
  const router = useRouter();
  const params = useParams();
  const gameSlug = (params?.game as string) || "";
  const gameName = GAME_SLUG_TO_NAME[gameSlug] || gameSlug.replace(/-/g, " ");

  useEffect(() => {
    if (gameSlug === "last-touch") {
      router.replace("/last-touch");
    }
  }, [gameSlug, router]);

  const [username, setUsername] = useState<string>("Player");
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [balance, setBalance] = useState(0);
  const [myGameRating, setMyGameRating] = useState(1000);

  const [stake, setStake] = useState(500);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("gamer");
  const [matchmaking, setMatchmaking] = useState(false);
  const [matchmakingElapsed, setMatchmakingElapsed] = useState(0);
  const [opponentFound, setOpponentFound] = useState<PlayerInfo | null>(null);
  const [match, setMatch] = useState<StoredMatch | null>(null);
  const [elapsedTimer, setElapsedTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const findMatchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [navigateToMatchId, setNavigateToMatchId] = useState<string | null>(null);
  const botFallbackStartedRef = useRef(false);

  const { isPractice } = usePlayMode();
  const { isRestricted } = useGeo();
  const { showToast } = useToast();
  const effectivePractice = isPractice || isRestricted;
  const {
    status: realMatchStatus,
    match: realMatch,
    role: realRole,
    error: realMatchError,
    startMatchmaking,
    cancelSearching,
  } = useMatchmaking();

  const stakeAmount = stake;
  const insufficientBalance = !effectivePractice && balance < stakeAmount;
  const useRealMatchmaking =
    !isPractice && !isRestricted;

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
        const spData = await getUserSPData(user.id);
        setBalance(Number(spData?.balanceSp ?? 0));
        // Fetch player's Glicko-2 rating for this game
        if (user.id && gameSlug) {
          try {
            const { getPlayerGameRating } = await import("@/lib/ranking/updateRating");
            const ratingData = await getPlayerGameRating(user.id, gameSlug);
            setMyGameRating(ratingData.rating);
          } catch {
            // non-fatal — defaults to 1000
          }
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
    const handleUpdate = () =>
      void (userId
        ? getUserSPData(userId).then((spData) => setBalance(Number(spData?.balanceSp ?? 0)))
        : Promise.resolve());
    window.addEventListener("skillflow_wallet_updated", handleUpdate);
    return () => window.removeEventListener("skillflow_wallet_updated", handleUpdate);
  }, [router, userId]);

  // Elapsed timer for real matchmaking (and bot fallback timeout)
  useEffect(() => {
    if (!matchmaking || !useRealMatchmaking) return;
    const timer = setInterval(() => setMatchmakingElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [matchmaking, useRealMatchmaking]);

  // Fallback: if navigateToMatchId was set (e.g. from a code path that didn't use handleMatchReady), navigate
  useEffect(() => {
    if (!navigateToMatchId) return;
    const matchUrl = `/match/${navigateToMatchId}`;
    window.location.href = matchUrl;
  }, [navigateToMatchId]);

  const player1 = useMemo<PlayerInfo>(
    () => ({
      username,
      rating: myGameRating,
      winRate: 50,
      matchesPlayed: 0,
    }),
    [myGameRating, username]
  );

  const getBotDifficultyForRating = useCallback((rating: number): BotDifficulty => {
    if (rating < 1000) return "rookie";
    if (rating <= 1500) return "gamer";
    return "professional";
  }, []);

  const runBotFallbackMatch = useCallback(async () => {
    if (botFallbackStartedRef.current) return;
    botFallbackStartedRef.current = true;
    await cancelSearching();
    const resolvedBotDifficulty = getBotDifficultyForRating(myGameRating);
    const opponent = generateFakeOpponent(myGameRating);
    setOpponentFound(opponent);
    try {
      const newMatch = await createMatch({
        gameType: gameSlug,
        gameDisplayName: gameName,
        stakeAmount,
        player1,
        player2: opponent,
        botDifficulty: resolvedBotDifficulty,
      });
      setMatch(newMatch);
      setTimeout(() => router.push(`/match/${newMatch.id}`), 1200);
    } catch {
      try {
        await creditSP(userId, stakeAmount, "match_refund", "Matchmaking failed – stake refunded");
        dispatchWalletUpdated();
      } catch {
        dispatchWalletUpdated();
      }
      setMatchmaking(false);
      setOpponentFound(null);
      setMatch(null);
      botFallbackStartedRef.current = false;
    }
  }, [
    cancelSearching,
    gameName,
    gameSlug,
    getBotDifficultyForRating,
    myGameRating,
    player1,
    router,
    stakeAmount,
  ]);

  const handleCancelMatchmaking = useCallback(async () => {
    if (elapsedTimer) clearInterval(elapsedTimer);
    setElapsedTimer(null);
    if (findMatchTimeoutRef.current) {
      clearTimeout(findMatchTimeoutRef.current);
      findMatchTimeoutRef.current = null;
    }
    botFallbackStartedRef.current = false;
    setNavigateToMatchId(null);
    if (useRealMatchmaking) {
      await cancelSearching();
    }
    setMatchmaking(false);
    setOpponentFound(null);
    setMatch(null);
    setMatchmakingElapsed(0);
    if (!isPractice && !isRestricted) {
      try {
        await creditSP(userId, stakeAmount, "match_refund", "Match cancelled – stake refunded");
        const spData = await getUserSPData(userId);
        setBalance(Number(spData?.balanceSp ?? 0));
        dispatchWalletUpdated();
      } catch {
        dispatchWalletUpdated();
      }
    }
  }, [elapsedTimer, stakeAmount, isPractice, isRestricted, useRealMatchmaking, cancelSearching]);

  const handleMatchReady = useCallback((match: { id: string }, _role: "player1" | "player2") => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[PlayGamePage] onMatchReady called", match?.id, _role, "— navigating with window.location.href");
    }
    if (match?.id) {
      const matchUrl = `/match/${match.id}`;
      window.location.href = matchUrl;
    }
  }, []);

  const handleFindMatch = useCallback(async () => {
    if (!userId) {
      showToast("Still loading your profile. Please try again in a moment.", "error");
      return;
    }

    if (isPractice || isRestricted) {
      setMatchmaking(true);
      setMatchmakingElapsed(0);
      const timer = setInterval(() => setMatchmakingElapsed((e) => e + 1), 1000);
      setElapsedTimer(timer);
      const delay = 1000 + Math.floor(Math.random() * 2000);
      findMatchTimeoutRef.current = setTimeout(async () => {
        clearInterval(timer);
        setElapsedTimer(null);
        const opponent: PlayerInfo = {
          username: "Bot",
          rating: 1000,
          winRate: 50,
          matchesPlayed: 0,
        };
        setOpponentFound(opponent);
        try {
          const newMatch = await createMatch({
            gameType: gameSlug,
            gameDisplayName: gameName,
            stakeAmount: 0,
            player1,
            player2: opponent,
            isPractice: true,
            botDifficulty,
          });
          setMatch(newMatch);
          setTimeout(() => router.push(`/match/${newMatch.id}`), 1500);
        } catch {
          setMatchmaking(false);
          setOpponentFound(null);
        }
      }, delay);
      return;
    }

    if (useRealMatchmaking) {
      if (insufficientBalance || stakeAmount < 1) return;
      try {
        const spendResult = await spendSP(
          userId,
          stakeAmount,
          "match_entry",
          `Match entry – ${gameName}`
        );
        if (!spendResult.success) {
          showToast(spendResult.error, "error");
          return;
        }
        const spData = await getUserSPData(userId);
        setBalance(Number(spData?.balanceSp ?? 0));
        dispatchWalletUpdated();
      } catch {
        showToast("Unable to start match right now. Please try again.", "error");
        return;
      }
      setMatchmaking(true);
      setMatchmakingElapsed(0);
      botFallbackStartedRef.current = false;
      try {
        await startMatchmaking({
          gameType: gameSlug,
          stakeAmount,
          userId,
          username,
          rating: myGameRating,
          isRealMoney: true,
          onMatchReady: handleMatchReady,
        });
      } catch {
        void runBotFallbackMatch();
      }
      return;
    }
  }, [
    gameName,
    gameSlug,
    insufficientBalance,
    isPractice,
    isRestricted,
    player1,
    router,
    useRealMatchmaking,
    userId,
    username,
    startMatchmaking,
    handleMatchReady,
    botDifficulty,
    myGameRating,
    showToast,
    runBotFallbackMatch,
  ]);

  useEffect(() => {
    if (!useRealMatchmaking || !matchmaking || match || opponentFound) return;
    if (realMatchStatus !== "timeout" && realMatchStatus !== "error") return;
    void runBotFallbackMatch();
  }, [
    matchmaking,
    match,
    opponentFound,
    realMatchStatus,
    runBotFallbackMatch,
    useRealMatchmaking,
  ]);

  useEffect(() => {
    if (effectivePractice) return;
    if (stake <= balance) return;
    const highestAffordable = [...STAKE_PRESETS].reverse().find((amt) => amt <= balance);
    if (highestAffordable) {
      setStake(highestAffordable);
    }
  }, [balance, effectivePractice, stake]);

  useEffect(() => {
    return () => {
      if (findMatchTimeoutRef.current) clearTimeout(findMatchTimeoutRef.current);
    };
  }, []);

  if (loading) {
    return <LoadingRing />;
  }

  const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-charcoal pb-32 md:pb-0">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username={username}
        isDevMode={isDevMode}
        onLogout={async () => {
          setLoggingOut(true);
          try {
            const { logout } = await import("@/lib/api");
            await logout();
            router.push("/login");
            router.refresh();
          } catch {
            setLoggingOut(false);
          }
        }}
        loggingOut={loggingOut}
        currentPage="play"
      />
      <ModeToggleBarContent />

      <main className="relative mx-auto max-w-[800px] px-4 pt-4 pb-32 sm:px-6 md:pt-8 md:pb-12">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/play"
            className="flex items-center gap-2 text-body-gray transition-colors hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {gameName}
          </Link>
          {!effectivePractice && (
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-card/50 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-medium text-white inline-flex items-center gap-1">
                {Math.floor(balance).toLocaleString()} Skillies <SkilliesIcon size={14} />
              </span>
            </div>
          )}
        </div>

        {effectivePractice && (
          <>
            <div className="mt-6 rounded-xl border-2 border-purple-500/40 bg-purple-500/10 px-4 py-3 text-center">
              <p className="font-semibold text-purple-300">Practice Match — Free Play</p>
              <p className="mt-1 text-sm text-body-gray">No money required. Play against a bot to sharpen your skills.</p>
            </div>
            <section className="mt-8">
              <h2 className="text-xl font-bold text-white">Select Difficulty</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBotDifficulty(opt.value)}
                    className={`pressable rounded-full border px-4 py-2.5 text-sm font-medium transition-all ${
                      botDifficulty === opt.value
                        ? opt.value === "rookie"
                          ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                          : opt.value === "gamer"
                            ? "border-amber-500 bg-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                            : "border-red-500 bg-red-500/20 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.3)]"
                        : "border-white/20 bg-[#1A1D27] text-body-gray hover:border-white/40 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-body-gray">
                &quot;{DIFFICULTY_OPTIONS.find((o) => o.value === botDifficulty)?.description}&quot;
              </p>
            </section>
          </>
        )}

        {!effectivePractice && (
          <section className="mt-8">
            <h2 className="text-xl font-bold text-white">Set Your Stake</h2>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              {STAKE_PRESETS.map((amt) => {
                const affordable = amt <= balance;
                return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setStake(amt)}
                  disabled={!affordable}
                  className={`pressable rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                    !affordable
                      ? "cursor-not-allowed border-white/10 bg-white/5 text-body-gray opacity-60"
                      : stake === amt
                      ? "border-teal bg-teal text-charcoal shadow-teal-glow/30"
                      : "border-teal/50 bg-[#1A1D27] text-white hover:border-teal"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {amt.toLocaleString()} Skillies <SkilliesIcon size={14} />
                  </span>
                </button>
                );
              })}
            </div>

            {insufficientBalance && stakeAmount > 0 && (
              <p className="mt-3 text-sm text-red-400">
                Insufficient balance.{" "}
                <Link href="/dashboard" className="text-teal underline">
                  Earn more
                </Link>{" "}
                to play.
              </p>
            )}
          </section>
        )}

        {!effectivePractice && (
          <section className="mt-8">
            <h2 className="text-xl font-bold text-white">Match Settings</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="rounded-lg border border-white/10 bg-card px-3 py-2 text-sm text-white">
                Ranked 1v1
              </span>
              <span className="rounded-lg border border-teal/30 bg-teal/10 px-3 py-2 text-sm text-teal">
                Matched by skill rating ±200
              </span>
            </div>
          </section>
        )}

        <div className="fixed bottom-[76px] left-0 right-0 z-30 px-4 pb-4 md:static md:mt-10 md:px-0 md:pb-0">
          <button
            type="button"
            onClick={handleFindMatch}
            disabled={!effectivePractice && (insufficientBalance || stakeAmount < 1)}
            className={`pressable h-14 w-full rounded-lg text-lg font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              effectivePractice
                ? "bg-gradient-to-r from-purple to-[rgba(192,132,252,1)] text-white hover:shadow-[0_0_24px_rgba(168,85,247,0.4)]"
                : "bg-teal text-charcoal hover:shadow-teal-glow"
            }`}
          >
            {effectivePractice
              ? "Start Practice"
              : (
                <span className="inline-flex items-center gap-2">
                  Play - {stakeAmount.toLocaleString()} Skillies <SkilliesIcon size={18} />
                </span>
              )}
          </button>
        </div>
      </main>

      {/* Matchmaking overlay */}
      {matchmaking && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-charcoal/95 px-4">
          {realMatchStatus === "error" && (
            <>
              <p className="text-xl font-semibold text-red-400">Matchmaking failed</p>
              <p className="mt-2 text-body-gray">{realMatchError ?? "Please try again."}</p>
              <button
                type="button"
                onClick={handleCancelMatchmaking}
                className="mt-6 rounded-lg border border-white/30 px-6 py-2 text-white hover:bg-white/10"
              >
                Refund &amp; go back
              </button>
            </>
          )}
          {realMatchStatus === "matched" && realMatch && !opponentFound && !match && (
            <>
              <p className="text-2xl font-bold text-teal">Opponent Found!</p>
              <div className="mt-8 flex w-full max-w-md items-center justify-center gap-4">
                <div className="card-border flex flex-1 flex-col items-center rounded-card bg-card p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-teal/40 to-purple/40 text-lg font-bold text-white">
                    {username.charAt(0)}
                  </div>
                  <p className="mt-2 font-medium text-white">{username}</p>
                  <p className="text-xs text-body-gray">Rating 1000</p>
                </div>
                <span className="text-2xl font-bold text-teal drop-shadow-lg">VS</span>
                <div className="card-border flex flex-1 flex-col items-center rounded-card bg-card p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple/40 to-rose-500/40 text-lg font-bold text-white">
                    {(realRole === "player1" ? realMatch.player2_username : realMatch.player1_username)?.charAt(0) ?? "?"}
                  </div>
                  <p className="mt-2 font-medium text-white">
                    {realRole === "player1" ? realMatch.player2_username : realMatch.player1_username}
                  </p>
                  <p className="text-xs text-body-gray">
                    Rating {realRole === "player1" ? realMatch.player2_rating : realMatch.player1_rating}
                  </p>
                </div>
              </div>
              <p className="mt-6 text-body-gray">Starting match...</p>
            </>
          )}
          {!opponentFound && !match && realMatchStatus !== "matched" && realMatchStatus !== "error" && (
            <>
              <div className="relative flex h-24 w-24 items-center justify-center">
                <div className={`absolute h-20 w-20 animate-ping rounded-full border-2 ${effectivePractice ? "border-purple-500/40" : "border-teal/40"}`} />
                <div className={`absolute h-16 w-16 animate-pulse rounded-full border-2 ${effectivePractice ? "border-purple-500" : "border-teal"}`} />
                <div className={`h-3 w-3 rounded-full ${effectivePractice ? "bg-purple-500" : "bg-teal"}`} />
              </div>
              <p className="mt-6 text-xl font-semibold text-white">
                {realMatchStatus === "waiting"
                  ? "Waiting for opponent..."
                  : effectivePractice
                    ? "Finding practice opponent..."
                    : "Looking for opponent..."}
              </p>
              <p className="mt-2 text-body-gray">
                {effectivePractice
                  ? `${gameName} • Free play`
                  : `${gameName} • Ranked 1v1`}
              </p>
              <p className="mt-2 text-sm text-body-gray">
                {realMatchStatus === "waiting" ? "Someone will join soon..." : `Searching... ${formatTime(matchmakingElapsed)}`}
              </p>
              <button
                type="button"
                onClick={handleCancelMatchmaking}
                className="mt-8 rounded-lg border border-white/30 px-6 py-2 text-white hover:bg-white/10"
              >
                Cancel
              </button>
            </>
          )}
          {opponentFound && match && (
            <>
              <p className={`text-2xl font-bold ${effectivePractice ? "text-purple-400" : "text-teal"}`}>Opponent Found!</p>
              <div className="mt-8 flex w-full max-w-md items-center justify-center gap-4">
                <div className="card-border flex flex-1 flex-col items-center rounded-card bg-card p-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br text-lg font-bold text-white ${
                      effectivePractice ? "from-purple-500/40 to-fuchsia-500/40" : "from-teal/40 to-purple/40"
                    }`}
                  >
                    {player1.username.charAt(0)}
                  </div>
                  <p className="mt-2 font-medium text-white">{player1.username}</p>
                  <p className="text-xs text-body-gray">Rating {player1.rating}</p>
                </div>
                <span className={`text-2xl font-bold drop-shadow-lg ${effectivePractice ? "text-purple-400" : "text-teal"}`}>VS</span>
                <div className="card-border flex flex-1 flex-col items-center rounded-card bg-card p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple/40 to-rose-500/40 text-lg font-bold text-white">
                    {opponentFound.username.charAt(0)}
                  </div>
                  <p className="mt-2 font-medium text-white">{opponentFound.username}</p>
                  <p className="text-xs text-body-gray">Rating {opponentFound.rating}</p>
                </div>
              </div>
              <p className="mt-6 text-body-gray">{effectivePractice ? "Starting practice match..." : "Starting match..."}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
