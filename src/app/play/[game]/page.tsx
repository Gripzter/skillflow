"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import AppNavbar, { dispatchWalletUpdated } from "@/components/AppNavbar";
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
const GAME_SLUG_TO_NAME: Record<string, string> = {
  "8-ball-pool": "8 Ball Pool",
  chess: "Chess",
  "connect-4": "Connect 4",
  "reaction-duel": "Reaction Duel",
};

export default function PlayGamePage() {
  const router = useRouter();
  const params = useParams();
  const gameSlug = (params?.game as string) || "";
  const gameName = GAME_SLUG_TO_NAME[gameSlug] || gameSlug.replace(/-/g, " ");

  const [username, setUsername] = useState<string>("Player");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [balance, setBalance] = useState(0);

  const [stake, setStake] = useState(5);
  const [customStake, setCustomStake] = useState("");
  const [matchmaking, setMatchmaking] = useState(false);
  const [matchmakingElapsed, setMatchmakingElapsed] = useState(0);
  const [opponentFound, setOpponentFound] = useState<PlayerInfo | null>(null);
  const [match, setMatch] = useState<StoredMatch | null>(null);
  const [elapsedTimer, setElapsedTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const findMatchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stakeAmount = customStake ? (parseFloat(customStake) || 0) : stake;
  const { totalPot, platformFee, winnerPayout } = computePayout(stakeAmount);
  const insufficientBalance = balance < stakeAmount;

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
    setMatchmaking(false);
    setOpponentFound(null);
    setMatch(null);
    setMatchmakingElapsed(0);
    try {
      await creditWallet(stakeAmount, "Match cancelled – stake refunded", "match_refund");
      setBalance(await getWalletBalance());
      dispatchWalletUpdated();
    } catch {
      dispatchWalletUpdated();
    }
  }, [elapsedTimer, stakeAmount]);

  const handleFindMatch = useCallback(async () => {
    if (insufficientBalance || stakeAmount < 1) return;
    try {
      await debitWallet(stakeAmount, `Match entry – ${gameName}`);
      setBalance(await getWalletBalance());
      dispatchWalletUpdated();
    } catch (e) {
      return;
    }
    setMatchmaking(true);
    setMatchmakingElapsed(0);

    const timer = setInterval(() => {
      setMatchmakingElapsed((e) => e + 1);
    }, 1000);
    setElapsedTimer(timer);

    const delay = 3000 + Math.floor(Math.random() * 5000);
    findMatchTimeoutRef.current = setTimeout(async () => {
      clearInterval(timer);
      setElapsedTimer(null);
      const opponent = generateFakeOpponent(1000);
      setOpponentFound(opponent);
      try {
        const newMatch = await createMatch({
          gameType: gameSlug,
          gameDisplayName: gameName,
          stakeAmount,
          player1,
          player2: opponent,
        });
        setMatch(newMatch);
        setTimeout(() => router.push(`/match/${newMatch.id}`), 2000);
      } catch {
        await creditWallet(stakeAmount, "Match creation failed – stake refunded", "match_refund");
        dispatchWalletUpdated();
        setMatchmaking(false);
        setOpponentFound(null);
      }
    }, delay);
  }, [balance, stakeAmount, gameName, gameSlug, insufficientBalance, player1, router]);

  useEffect(() => {
    return () => {
      if (findMatchTimeoutRef.current) clearTimeout(findMatchTimeoutRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <svg className="h-10 w-10 animate-spin text-teal" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-charcoal">
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

      <main className="relative mx-auto max-w-[800px] px-4 py-6 sm:px-6">
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
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-card/50 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-sm font-medium text-white">${balance.toFixed(2)}</span>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="text-xl font-bold text-white">Set Your Stake</h2>
          <p className="mt-1 text-body-gray">
            Both players put up the same amount. Winner takes all minus 3% platform fee.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {STAKE_PRESETS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => {
                  setStake(amt);
                  setCustomStake("");
                }}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  !customStake && stake === amt
                    ? "border-teal bg-teal text-charcoal shadow-teal-glow/30"
                    : "border-teal/50 bg-[#1A1D27] text-white hover:border-teal"
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
            className="mt-1 w-full max-w-[200px] rounded-lg border border-white/10 bg-[#1A1D27] px-4 py-2 text-white placeholder:text-body-gray focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />

          <div className="card-border mt-6 rounded-card bg-card p-5">
            <p className="text-body-gray">Your Stake: ${stakeAmount.toFixed(2)}</p>
            <p className="mt-1 text-body-gray">Opponent&apos;s Stake: ${stakeAmount.toFixed(2)}</p>
            <p className="mt-1 text-body-gray">Total Pot: ${totalPot.toFixed(2)}</p>
            <p className="mt-1 text-body-gray">Platform Fee (3%): -${platformFee.toFixed(2)}</p>
            <p className="mt-2 text-lg font-bold text-teal">Winner Takes: ${winnerPayout.toFixed(2)}</p>
          </div>

          {insufficientBalance && stakeAmount > 0 && (
            <p className="mt-3 text-sm text-red-400">
              Insufficient balance. <Link href="/wallet" className="text-teal underline">Deposit funds</Link> to play.
            </p>
          )}
        </section>

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

        <div className="mt-10">
          <button
            type="button"
            onClick={handleFindMatch}
            disabled={insufficientBalance || stakeAmount < 1}
            className="h-14 w-full rounded-lg bg-teal text-lg font-bold text-charcoal transition-all hover:shadow-teal-glow disabled:cursor-not-allowed disabled:opacity-50"
          >
            Find Match — ${stakeAmount.toFixed(2)}
          </button>
        </div>
      </main>

      {/* Matchmaking overlay */}
      {matchmaking && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-charcoal/95 px-4">
          {!opponentFound ? (
            <>
              <div className="relative flex h-24 w-24 items-center justify-center">
                <div className="absolute h-20 w-20 animate-ping rounded-full border-2 border-teal/40" />
                <div className="absolute h-16 w-16 animate-pulse rounded-full border-2 border-teal" />
                <div className="h-3 w-3 rounded-full bg-teal" />
              </div>
              <p className="mt-6 text-xl font-semibold text-white">Finding your opponent...</p>
              <p className="mt-2 text-body-gray">
                Stake: ${stakeAmount.toFixed(2)} • {gameName} • Ranked 1v1
              </p>
              <p className="mt-2 text-sm text-body-gray">Searching... {formatTime(matchmakingElapsed)}</p>
              <button
                type="button"
                onClick={handleCancelMatchmaking}
                className="mt-8 rounded-lg border border-white/30 px-6 py-2 text-white hover:bg-white/10"
              >
                Cancel
              </button>
            </>
          ) : opponentFound && match && (
            <>
              <p className="text-2xl font-bold text-teal">Opponent Found!</p>
              <div className="mt-8 flex w-full max-w-md items-center justify-center gap-4">
                <div className="card-border flex flex-1 flex-col items-center rounded-card bg-card p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-teal/40 to-purple/40 text-lg font-bold text-white">
                    {player1.username.charAt(0)}
                  </div>
                  <p className="mt-2 font-medium text-white">{player1.username}</p>
                  <p className="text-xs text-body-gray">Rating {player1.rating}</p>
                </div>
                <span className="text-2xl font-bold text-teal drop-shadow-teal-glow">VS</span>
                <div className="card-border flex flex-1 flex-col items-center rounded-card bg-card p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple/40 to-rose-500/40 text-lg font-bold text-white">
                    {opponentFound.username.charAt(0)}
                  </div>
                  <p className="mt-2 font-medium text-white">{opponentFound.username}</p>
                  <p className="text-xs text-body-gray">Rating {opponentFound.rating}</p>
                </div>
              </div>
              <p className="mt-6 text-body-gray">Starting match...</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
