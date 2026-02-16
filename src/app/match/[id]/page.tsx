"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import AppNavbar, { dispatchWalletUpdated } from "@/components/AppNavbar";
import {
  getCurrentUser,
  getMatch,
  completeMatchAndSettle,
  type StoredMatch,
} from "@/lib/api";
import { updateMatch } from "@/lib/matchmaking";
import { getConnectionMetrics } from "@/lib/connection-tester";
import { startConnectionLogging, stopConnectionLogging } from "@/lib/connection-logger";
import type { ConnectionSnapshot } from "@/lib/connection-logger";
import { ConnectionCheckWarning, ConnectionCheckUnrecommended } from "@/components/ConnectionCheckModal";
import EightBallPool from "@/components/games/EightBallPool";
import Chess from "@/components/games/Chess";
import ConnectFour from "@/components/games/ConnectFour";
import ReactionDuel from "@/components/games/ReactionDuel";

type Outcome = null | "victory" | "defeat" | "draw";

export default function MatchPage() {
  const router = useRouter();
  const params = useParams();
  const matchId = (params?.id as string) || "";

  const [username, setUsername] = useState<string>("Player");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [match, setMatch] = useState<StoredMatch | null>(null);
  const [timerSec, setTimerSec] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [forfeitConfirm, setForfeitConfirm] = useState(false);
  const [connectionCheckPassed, setConnectionCheckPassed] = useState(false);
  const [connectionCheckState, setConnectionCheckState] = useState<"checking" | "ok" | "warning" | "unrecommended">("checking");

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
        const m = await getMatch(matchId);
        if (!m) {
          router.replace("/play");
          return;
        }
        setMatch(m);
      } catch {
        router.replace("/play");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [matchId, router]);

  useEffect(() => {
    if (!match || match.status !== "in_progress" || loading) return;
    const m = getConnectionMetrics();
    const rating = m.overallRating;
    if (rating === "good" || rating === "medium") {
      setConnectionCheckPassed(true);
      setConnectionCheckState("ok");
    } else if (rating === "warning") {
      setConnectionCheckState("warning");
    } else {
      setConnectionCheckState("unrecommended");
    }
  }, [match, loading]);

  useEffect(() => {
    if (!match || match.status !== "in_progress" || !connectionCheckPassed) return;
    const log: ConnectionSnapshot[] = [];
    startConnectionLogging((snapshot) => {
      log.push(snapshot);
      updateMatch(matchId, {
        connectionLog: [...log],
        connectionWarningAcknowledged: match.connectionWarningAcknowledged,
      });
    });
    return () => stopConnectionLogging();
  }, [match, matchId, connectionCheckPassed]);

  useEffect(() => {
    if (!match || match.status !== "in_progress") return;
    const t = setInterval(() => setTimerSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [match]);

  const handleWin = useCallback(async () => {
    if (!match) return;
    try {
      await completeMatchAndSettle(match, "player1");
      dispatchWalletUpdated();
      setOutcome("victory");
    } catch {
      setOutcome("victory");
      dispatchWalletUpdated();
    }
  }, [match]);

  const handleLoss = useCallback(async () => {
    if (!match) return;
    try {
      await completeMatchAndSettle(match, "player2");
    } catch {
      // no wallet change
    }
    setOutcome("defeat");
  }, [match]);

  const handleDraw = useCallback(async () => {
    if (!match) return;
    try {
      await completeMatchAndSettle(match, "draw");
      dispatchWalletUpdated();
    } catch {
      dispatchWalletUpdated();
    }
    setOutcome("draw");
  }, [match]);

  const handleForfeitConfirm = useCallback(() => {
    handleLoss();
    setForfeitConfirm(false);
  }, [handleLoss]);

  const handleConnectionContinue = useCallback(
    (ack: { timestamp: string; rating: "warning" | "unrecommended" } | null) => {
      if (ack && match) {
        updateMatch(matchId, { connectionWarningAcknowledged: ack });
        setMatch((prev) => (prev ? { ...prev, connectionWarningAcknowledged: ack } : null));
      }
      setConnectionCheckPassed(true);
      setConnectionCheckState("ok");
    },
    [match, matchId]
  );

  const handleConnectionCancel = useCallback(() => {
    router.replace("/play");
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const { logout } = await import("@/lib/api");
      await logout();
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  if (loading || !match) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <svg className="h-10 w-10 animate-spin text-teal" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  if (!connectionCheckPassed && match.status === "in_progress") {
    const metrics = getConnectionMetrics();
    if (connectionCheckState === "warning") {
      return (
        <div className="flex min-h-screen flex-col bg-charcoal">
          <ConnectionCheckWarning
            metrics={metrics}
            onContinue={handleConnectionContinue}
            onCancel={handleConnectionCancel}
          />
        </div>
      );
    }
    if (connectionCheckState === "unrecommended") {
      return (
        <div className="flex min-h-screen flex-col bg-charcoal">
          <ConnectionCheckUnrecommended
            metrics={metrics}
            onContinue={handleConnectionContinue}
            onCancel={handleConnectionCancel}
          />
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
          <p className="mt-4 text-body-gray">Checking connection quality...</p>
        </div>
      </div>
    );
  }

  const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  const shortId = match.id.slice(0, 8);

  return (
    <div className="flex min-h-screen flex-col bg-charcoal">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username={username}
        isDevMode={isDevMode}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        currentPage="play"
      />

      {/* Top bar */}
      <div className="border-b border-white/5 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white">
            {match.gameType === "chess"
              ? "Chess ♟"
              : match.gameType === "connect-4"
                ? "Connect 4 🔴🟡"
                : match.gameType === "reaction-duel"
                  ? "Reaction Duel ⚡"
                  : match.gameDisplayName}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
              ✓ Connection OK
            </span>
          </div>
          <span className="text-body-gray tabular-nums">{formatTime(timerSec)}</span>
          <span className="text-xs text-body-gray">Match ID: {shortId}</span>
        </div>
      </div>

      {/* Main: Chess and Connect 4 use full-width layout; Pool uses 3 columns */}
      {match.gameType === "chess" ? (
        <main className="mx-auto flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 lg:max-w-[1200px]">
          {match.status === "in_progress" && !outcome ? (
            <div className="card-border flex min-h-[500px] flex-1 flex-col rounded-card bg-card p-4">
              <Chess
                player1={{ username: match.player1.username, rating: match.player1.rating }}
                player2={{ username: match.player2.username, rating: match.player2.rating }}
                onGameEnd={(winner) => {
                  if (winner === "player1") handleWin();
                  else handleLoss();
                }}
                onGameDraw={handleDraw}
                isPlayer2Bot={true}
              />
            </div>
          ) : null}
        </main>
      ) : match.gameType === "connect-4" ? (
        <main className="mx-auto flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 lg:max-w-[1200px]">
          {match.status === "in_progress" && !outcome ? (
            <div className="card-border flex min-h-[500px] flex-1 flex-col rounded-card bg-card p-4">
              <ConnectFour
                player1={{ username: match.player1.username, rating: match.player1.rating }}
                player2={{ username: match.player2.username, rating: match.player2.rating }}
                onGameEnd={(winner) => {
                  if (winner === "player1") handleWin();
                  else handleLoss();
                }}
                onGameDraw={handleDraw}
                isPlayer2Bot={true}
              />
            </div>
          ) : null}
        </main>
      ) : match.gameType === "reaction-duel" ? (
        <main className="mx-auto flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 lg:max-w-[1200px]">
          {match.status === "in_progress" && !outcome ? (
            <div className="card-border flex min-h-[400px] flex-1 flex-col rounded-card bg-card p-4">
              <ReactionDuel
                player1={{ username: match.player1.username, rating: match.player1.rating }}
                player2={{ username: match.player2.username, rating: match.player2.rating }}
                onGameEnd={(winner) => {
                  if (winner === "player1") handleWin();
                  else handleLoss();
                }}
                onGameDraw={handleDraw}
                isPlayer2Bot={true}
              />
            </div>
          ) : null}
        </main>
      ) : (
        <main className="mx-auto grid max-w-[1200px] grid-cols-1 gap-4 px-4 py-6 md:grid-cols-[1fr_2fr_1fr]">
          <div className="card-border rounded-card bg-card p-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-teal/40 to-purple/40 text-2xl font-bold text-white">
              {match.player1.username.charAt(0)}
            </div>
            <p className="mt-2 font-medium text-white">{match.player1.username}</p>
            <p className="text-xs text-body-gray">Rating {match.player1.rating}</p>
            <p className="mt-4 text-3xl font-bold text-teal">0</p>
            <p className="text-xs text-body-gray">Score</p>
          </div>
          <div className="card-border flex flex-col items-center justify-center rounded-card bg-card p-4">
            {match.gameType === "8-ball-pool" && match.status === "in_progress" && !outcome ? (
              <EightBallPool
                player1={{ username: match.player1.username, rating: match.player1.rating }}
                player2={{ username: match.player2.username, rating: match.player2.rating }}
                onGameEnd={(winner) => {
                  if (winner === "player1") handleWin();
                  else handleLoss();
                }}
                isPlayer2Bot={true}
              />
            ) : match.status === "in_progress" && !outcome ? (
              <>
                <p className="text-body-gray">Game in progress...</p>
                <div className="mt-6 flex flex-wrap justify-center gap-4">
                  <button
                    type="button"
                    onClick={handleWin}
                    className="rounded-lg bg-teal px-6 py-3 font-semibold text-charcoal hover:shadow-teal-glow"
                  >
                    🏆 I Won
                  </button>
                  <button
                    type="button"
                    onClick={handleLoss}
                    className="rounded-lg border border-red-500/50 bg-red-500/10 px-6 py-3 font-semibold text-red-400 hover:bg-red-500/20"
                  >
                    😞 I Lost
                  </button>
                </div>
              </>
            ) : null}
          </div>
          <div className="card-border rounded-card bg-card p-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple/40 to-rose-500/40 text-2xl font-bold text-white">
              {match.player2.username.charAt(0)}
            </div>
            <p className="mt-2 font-medium text-white">
              {match.player2.username}
              <span className="ml-1.5 inline-flex items-center rounded bg-white/10 px-1.5 py-0.5 text-xs font-medium text-body-gray">
                🤖 BOT
              </span>
            </p>
            <p className="text-xs text-body-gray">Rating {match.player2.rating}</p>
            <p className="mt-4 text-3xl font-bold text-white">0</p>
            <p className="text-xs text-body-gray">Score</p>
          </div>
        </main>
      )}

      {/* Bottom bar */}
      <div className="border-t border-white/5 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-body-gray">
            Stake: ${match.stakeAmount.toFixed(2)} each • Winner gets: ${match.winnerPayout.toFixed(2)} • Platform fee: ${match.platformFee.toFixed(2)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-body-gray hover:text-white"
            >
              Report Issue
            </button>
            {match.status === "in_progress" && !outcome && (
              <button
                type="button"
                onClick={() => setForfeitConfirm(true)}
                className="rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
              >
                Forfeit Match
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Victory overlay */}
      {outcome === "victory" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-charcoal/98 px-4">
          <div className="absolute inset-0 bg-gradient-to-t from-teal/10 via-transparent to-teal/10 victory-glow" aria-hidden />
          <div className="animate-fade-in relative text-center">
            <p className="text-5xl font-bold text-white drop-shadow-[0_0_30px_rgba(0,229,199,0.5)] sm:text-6xl">🏆 VICTORY!</p>
            <p className="mt-4 text-2xl font-bold text-teal">You won ${match.winnerPayout.toFixed(2)}!</p>
            <p className="mt-2 text-body-gray">Defeated {match.player2.username}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/play"
                className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10"
              >
                Back to Lobby
              </Link>
              <Link
                href={`/play/${match.gameType}`}
                className="rounded-lg bg-teal px-6 py-3 font-semibold text-charcoal hover:shadow-teal-glow"
              >
                Play Again
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Draw overlay */}
      {outcome === "draw" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-charcoal/98 px-4">
          <div className="animate-fade-in text-center">
            <p className="text-2xl font-semibold text-white">Draw!</p>
            <p className="mt-2 text-lg text-teal">Stakes refunded.</p>
            <p className="mt-1 text-body-gray">Your ${match.stakeAmount.toFixed(2)} has been returned to your wallet.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/play"
                className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10"
              >
                Back to Lobby
              </Link>
              <Link
                href={`/play/${match.gameType}`}
                className="rounded-lg bg-teal px-6 py-3 font-semibold text-charcoal hover:shadow-teal-glow"
              >
                Play Again
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Defeat overlay */}
      {outcome === "defeat" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-charcoal/98 px-4">
          <div className="animate-fade-in text-center">
            <p className="text-2xl font-semibold text-white">Better luck next time</p>
            <p className="mt-2 text-lg text-red-400">You lost ${match.stakeAmount.toFixed(2)}</p>
            <p className="mt-1 text-body-gray">{match.player2.username} won</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/play"
                className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10"
              >
                Back to Lobby
              </Link>
              <Link
                href={`/play/${match.gameType}`}
                className="rounded-lg bg-teal px-6 py-3 font-semibold text-charcoal hover:shadow-teal-glow"
              >
                Try Again
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Forfeit confirmation modal */}
      {forfeitConfirm && !outcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="card-border w-full max-w-sm rounded-card bg-card p-6">
            <p className="text-center font-medium text-white">
              Are you sure you want to forfeit? You will lose your ${match.stakeAmount.toFixed(2)} stake.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setForfeitConfirm(false)}
                className="flex-1 rounded-lg border border-white/20 py-2.5 text-white hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleForfeitConfirm}
                className="flex-1 rounded-lg bg-red-500/20 py-2.5 font-medium text-red-400 hover:bg-red-500/30"
              >
                Forfeit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
