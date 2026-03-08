"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppNavbar, { dispatchWalletUpdated } from "@/components/AppNavbar";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import { useToast } from "@/components/Toast";
import { usePlayMode } from "@/contexts/PlayModeContext";
import { useMatchmaking } from "@/hooks/useMatchmaking";
import {
  getCurrentUser,
  getWalletBalance,
  debitWallet,
  creditWallet,
  createMatch,
  generateFakeOpponent,
  computePayout,
  type PlayerInfo,
  type StoredMatch,
} from "@/lib/api";

const STAKE_PRESETS = [1, 2, 5, 10, 25, 50];
const MATCHMAKING_TIMEOUT_SEC = 60;
const MATCHMAKING_SLOW_SEC = 30;
const GAME_SLUG = "spelling-bee";
const GAME_NAME = "Spelling Bee";

type BotDifficulty = "rookie" | "gamer" | "professional";

const DIFFICULTY_OPTIONS: { value: BotDifficulty; label: string; emoji: string; description: string }[] = [
  { value: "rookie", emoji: "🟢", label: "Rookie", description: "Learning the ropes. A great place to start." },
  { value: "gamer", emoji: "🟡", label: "Gamer", description: "A solid opponent. Bring your A-game." },
  { value: "professional", emoji: "🔴", label: "Professional", description: "Near-perfect play. Only the best can win." },
];

export default function PlaySpellingBeePage() {
  const router = useRouter();
  const [username, setUsername] = useState<string>("Player");
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [balance, setBalance] = useState(0);

  const [stake, setStake] = useState(5);
  const [customStake, setCustomStake] = useState("");
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("gamer");
  const [matchmaking, setMatchmaking] = useState(false);
  const [matchmakingElapsed, setMatchmakingElapsed] = useState(0);
  const [opponentFound, setOpponentFound] = useState<PlayerInfo | null>(null);
  const [match, setMatch] = useState<StoredMatch | null>(null);
  const [elapsedTimer, setElapsedTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const findMatchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realMatchNavRef = useRef<string | null>(null);

  const { isPractice } = usePlayMode();
  const { showToast } = useToast();
  const {
    status: realMatchStatus,
    match: realMatch,
    role: realRole,
    error: realMatchError,
    startMatchmaking,
    cancelSearching,
  } = useMatchmaking();

  const stakeAmount = customStake ? (parseFloat(customStake) || 0) : stake;
  const { totalPot, platformFee, winnerPayout } = computePayout(stakeAmount);
  const insufficientBalance = !isPractice && balance < stakeAmount;
  const useRealMatchmaking = !isPractice;
  const timeoutReached = matchmakingElapsed >= MATCHMAKING_TIMEOUT_SEC;
  const slowMessage = matchmakingElapsed >= MATCHMAKING_SLOW_SEC;

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
        const bal = await getWalletBalance();
        setBalance(bal);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
    const handleUpdate = () => void getWalletBalance().then(setBalance);
    window.addEventListener("skillflow_wallet_updated", handleUpdate);
    return () => window.removeEventListener("skillflow_wallet_updated", handleUpdate);
  }, [router]);

  useEffect(() => {
    if (!matchmaking || !useRealMatchmaking) return;
    const timer = setInterval(() => setMatchmakingElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [matchmaking, useRealMatchmaking]);

  useEffect(() => {
    if (realMatchStatus !== "matched" || !realMatch || realMatchNavRef.current) return;
    realMatchNavRef.current = realMatch.id;
    const t = setTimeout(() => {
      router.push(`/match/${realMatch.id}`);
    }, 1500);
    return () => clearTimeout(t);
  }, [realMatchStatus, realMatch, router]);

  const player1 = useMemo<PlayerInfo>(
    () => ({
      username,
      rating: 1000,
      winRate: 50,
      matchesPlayed: 0,
    }),
    [username]
  );

  const handleCancelMatchmaking = useCallback(async () => {
    if (elapsedTimer) clearInterval(elapsedTimer);
    setElapsedTimer(null);
    if (findMatchTimeoutRef.current) {
      clearTimeout(findMatchTimeoutRef.current);
      findMatchTimeoutRef.current = null;
    }
    if (useRealMatchmaking) {
      await cancelSearching();
    }
    setMatchmaking(false);
    setOpponentFound(null);
    setMatch(null);
    setMatchmakingElapsed(0);
    if (!isPractice) {
      try {
        await creditWallet(stakeAmount, "Match cancelled – stake refunded", "match_refund");
        setBalance(await getWalletBalance());
        dispatchWalletUpdated();
      } catch {
        dispatchWalletUpdated();
      }
    }
  }, [elapsedTimer, stakeAmount, isPractice, useRealMatchmaking, cancelSearching]);

  const handleFindMatch = useCallback(async () => {
    if (isPractice) {
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
            gameType: GAME_SLUG,
            gameDisplayName: GAME_NAME,
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
        await debitWallet(stakeAmount, `Match entry – ${GAME_NAME}`);
        setBalance(await getWalletBalance());
        dispatchWalletUpdated();
      } catch {
        return;
      }
      setMatchmaking(true);
      setMatchmakingElapsed(0);
      try {
        await startMatchmaking({
          gameType: GAME_SLUG,
          stakeAmount,
          userId,
          username,
          rating: 1000,
        });
      } catch {
        await creditWallet(stakeAmount, "Matchmaking failed – stake refunded", "match_refund");
        dispatchWalletUpdated();
        setMatchmaking(false);
      }
      return;
    }

    if (insufficientBalance || stakeAmount < 1) return;
    try {
      await debitWallet(stakeAmount, `Match entry – ${GAME_NAME}`);
      setBalance(await getWalletBalance());
      dispatchWalletUpdated();
    } catch {
      return;
    }
  }, [
    balance,
    stakeAmount,
    insufficientBalance,
    isPractice,
    player1,
    router,
    useRealMatchmaking,
    userId,
    username,
    startMatchmaking,
    botDifficulty,
  ]);

  const handleSwitchToPractice = useCallback(async () => {
    await cancelSearching();
    setMatchmaking(false);
    setMatchmakingElapsed(0);
    setOpponentFound(null);
    setMatch(null);
    try {
      await creditWallet(stakeAmount, "Match cancelled – stake refunded", "match_refund");
      setBalance(await getWalletBalance());
      dispatchWalletUpdated();
    } catch {
      dispatchWalletUpdated();
    }
    router.push("/play/spelling-bee");
    showToast("Switched to lobby. Toggle Practice mode to play vs bot for free.", "success");
  }, [cancelSearching, stakeAmount, router, showToast]);

  useEffect(() => {
    return () => {
      if (findMatchTimeoutRef.current) clearTimeout(findMatchTimeoutRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <svg
          className={`h-10 w-10 animate-spin ${isPractice ? "text-purple-400" : "text-teal"}`}
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
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
            Spelling Bee 🐝
          </Link>
          {!isPractice && (
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-card/50 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-medium text-white">${balance.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border-l-4 border-amber-500 bg-amber-500/5 p-4">
          <p className="font-medium text-white">Spelling Bee 🐝</p>
          <p className="mt-1 text-sm text-body-gray">
            Test your spelling skills! Words get harder each round. Can you spell them all?
          </p>
        </div>

        {isPractice && (
          <>
            <div className="mt-6 rounded-xl border-2 border-purple-500/40 bg-purple-500/10 px-4 py-3 text-center">
              <p className="font-semibold text-purple-300">🎯 Practice Match — Free Play</p>
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
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-body-gray">
                &quot;{DIFFICULTY_OPTIONS.find((o) => o.value === botDifficulty)?.description}&quot;
              </p>
            </section>
          </>
        )}

        {!isPractice && (
          <section className="mt-8">
            <h2 className="text-xl font-bold text-white">Set Your Stake</h2>
            <p className="mt-1 text-body-gray">
              Both players put up the same amount. Winner takes all minus 5% platform fee.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              {STAKE_PRESETS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setStake(amt);
                    setCustomStake("");
                  }}
                  className={`pressable rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                    !customStake && stake === amt
                      ? "border-amber-500 bg-amber-500 text-charcoal shadow-lg shadow-amber-500/30"
                      : "border-amber-500/50 bg-[#1A1D27] text-white hover:border-amber-500"
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-body-gray">Custom amount</p>
            <input
              type="number"
              min={1}
              max={balance}
              step="0.01"
              placeholder="0.00"
              value={customStake}
              onChange={(e) => setCustomStake(e.target.value)}
              className="mt-1 w-full max-w-[200px] rounded-lg border border-white/10 bg-[#1A1D27] px-4 py-2 text-white placeholder:text-body-gray focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />

            <div className="card-border mt-6 rounded-card bg-card p-5">
              <p className="text-body-gray">Your Stake: ${stakeAmount.toFixed(2)}</p>
              <p className="mt-1 text-body-gray">Opponent&apos;s Stake: ${stakeAmount.toFixed(2)}</p>
              <p className="mt-1 text-body-gray">Total Pot: ${totalPot.toFixed(2)}</p>
              <p className="mt-1 text-body-gray">Platform fee (5%): ${platformFee.toFixed(2)}</p>
              <p className="mt-2 text-lg font-bold text-amber-400">Winner gets: ${winnerPayout.toFixed(2)}</p>
            </div>

            {insufficientBalance && stakeAmount > 0 && (
              <p className="mt-3 text-sm text-red-400">
                Insufficient balance. <Link href="/wallet" className="text-amber-400 underline">Deposit funds</Link> to play.
              </p>
            )}
          </section>
        )}

        {!isPractice && (
          <section className="mt-8">
            <h2 className="text-xl font-bold text-white">Match Settings</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="rounded-lg border border-white/10 bg-card px-3 py-2 text-sm text-white">
                Ranked 1v1
              </span>
              <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
                Matched by skill rating ±200
              </span>
            </div>
          </section>
        )}

        <div className="fixed bottom-[76px] left-0 right-0 z-30 px-4 pb-4 md:static md:mt-10 md:px-0 md:pb-0">
          <button
            type="button"
            onClick={handleFindMatch}
            disabled={!isPractice && (insufficientBalance || stakeAmount < 1)}
            className={`pressable h-14 w-full rounded-lg text-lg font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              isPractice
                ? "bg-gradient-to-r from-[#7C5CFC] to-purple-600 text-white hover:shadow-[0_0_24px_rgba(124,92,252,0.4)]"
                : "bg-amber-500 text-charcoal hover:shadow-[0_0_24px_rgba(245,158,11,0.4)]"
            }`}
          >
            {isPractice ? "Start Practice" : `Find Match — $${stakeAmount.toFixed(2)}`}
          </button>
        </div>
      </main>

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
              <p className="text-2xl font-bold text-amber-400">Opponent Found!</p>
              <div className="mt-8 flex w-full max-w-md items-center justify-center gap-4">
                <div className="card-border flex flex-1 flex-col items-center rounded-card bg-card p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/40 to-orange-500/40 text-lg font-bold text-white">
                    {username.charAt(0)}
                  </div>
                  <p className="mt-2 font-medium text-white">{username}</p>
                  <p className="text-xs text-body-gray">Rating 1000</p>
                </div>
                <span className="text-2xl font-bold text-amber-400 drop-shadow-lg">VS</span>
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
                <div className="absolute h-20 w-20 animate-ping rounded-full border-2 border-amber-500/40" />
                <div className="absolute h-16 w-16 animate-pulse rounded-full border-2 border-amber-500" />
                <div className="h-3 w-3 rounded-full bg-amber-500" />
              </div>
              <p className="mt-6 text-xl font-semibold text-white">
                {isPractice ? "Finding practice opponent..." : "Finding your opponent..."}
              </p>
              <p className="mt-2 text-body-gray">
                {isPractice ? "Spelling Bee • Free play" : `Stake: $${stakeAmount.toFixed(2)} • Spelling Bee • Ranked 1v1`}
              </p>
              <p className="mt-2 text-sm text-body-gray">Searching... {formatTime(matchmakingElapsed)}</p>
              {slowMessage && !timeoutReached && (
                <p className="mt-2 text-sm text-amber-400">Taking longer than usual...</p>
              )}
              {timeoutReached && useRealMatchmaking ? (
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleSwitchToPractice}
                    className="rounded-lg bg-amber-500 px-6 py-2.5 font-semibold text-charcoal hover:shadow-lg hover:shadow-amber-500/30"
                  >
                    Switch to Practice Mode
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelMatchmaking}
                    className="rounded-lg border border-white/30 px-6 py-2 text-white hover:bg-white/10"
                  >
                    Cancel (refund)
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelMatchmaking}
                  className="mt-8 rounded-lg border border-white/30 px-6 py-2 text-white hover:bg-white/10"
                >
                  Cancel
                </button>
              )}
            </>
          )}
          {opponentFound && match && (
            <>
              <p className={`text-2xl font-bold ${isPractice ? "text-purple-400" : "text-amber-400"}`}>Opponent Found!</p>
              <div className="mt-8 flex w-full max-w-md items-center justify-center gap-4">
                <div className="card-border flex flex-1 flex-col items-center rounded-card bg-card p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/40 to-orange-500/40 text-lg font-bold text-white">
                    {player1.username.charAt(0)}
                  </div>
                  <p className="mt-2 font-medium text-white">{player1.username}</p>
                  <p className="text-xs text-body-gray">Rating {player1.rating}</p>
                </div>
                <span className={`text-2xl font-bold drop-shadow-lg ${isPractice ? "text-purple-400" : "text-amber-400"}`}>VS</span>
                <div className="card-border flex flex-1 flex-col items-center rounded-card bg-card p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple/40 to-rose-500/40 text-lg font-bold text-white">
                    {opponentFound.username.charAt(0)}
                  </div>
                  <p className="mt-2 font-medium text-white">{opponentFound.username}</p>
                  <p className="text-xs text-body-gray">Rating {opponentFound.rating}</p>
                </div>
              </div>
              <p className="mt-6 text-body-gray">{isPractice ? "Starting practice match..." : "Starting match..."}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
