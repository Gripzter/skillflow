"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import AppNavbar, { dispatchWalletUpdated } from "@/components/AppNavbar";
import {
  getCurrentUser,
  getWalletBalance,
  creditWallet,
} from "@/lib/api";
import {
  getExternalMatch,
  updateExternalMatch,
  type ExternalMatch,
  type ExternalMatchResult,
  type ChatMessage,
} from "@/lib/external-matches";
import { generateId } from "@/lib/wallet";
import { getConnectionMetrics } from "@/lib/connection-tester";
import { startConnectionLogging, stopConnectionLogging } from "@/lib/connection-logger";
import type { ConnectionSnapshot } from "@/lib/connection-logger";
import { ConnectionCheckWarning, ConnectionCheckUnrecommended } from "@/components/ConnectionCheckModal";
import MatchSetup from "@/components/external/MatchSetup";
import ResultReporting from "@/components/external/ResultReporting";
import DisputePanel from "@/components/external/DisputePanel";

const MODE_DISPLAY: Record<string, string> = {
  "1v1-aim-duel": "1v1 Aim Duel",
  "1v1-competitive-mr12": "1v1 Competitive (MR12)",
  "5v5-competitive": "5v5 Competitive",
};
const MAP_DISPLAY: Record<string, string> = {
  random: "Any",
  dust2: "Dust 2",
  mirage: "Mirage",
  inferno: "Inferno",
  nuke: "Nuke",
  anubis: "Anubis",
  ancient: "Ancient",
  overpass: "Overpass",
};

export default function ExternalMatchRoomPage() {
  const router = useRouter();
  const params = useParams();
  const matchId = (params?.id as string) || "";

  const [username, setUsername] = useState<string>("Player");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [balance, setBalance] = useState(0);
  const [match, setMatch] = useState<ExternalMatch | null>(null);
  const [timerSec, setTimerSec] = useState(0);
  const [showResultForm, setShowResultForm] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [connectionCheckPassed, setConnectionCheckPassed] = useState(false);
  const [connectionCheckState, setConnectionCheckState] = useState<"checking" | "ok" | "warning" | "unrecommended">("checking");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const setupStartTimeRef = useRef<number>(Date.now());
  const botMessagesRef = useRef<string[]>([]);

  const isPlayer1 = match?.player1.username === username;

  const canCancel =
    match?.status === "setup" &&
    (Date.now() - setupStartTimeRef.current) / 1000 < 300;

  const loadMatch = useCallback(() => {
    const m = getExternalMatch(matchId);
    setMatch(m ? { ...m } : null);
    return m;
  }, [matchId]);

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
        const m = loadMatch();
        if (!m) {
          router.replace("/external");
          return;
        }
        setupStartTimeRef.current = Date.now();
      } catch {
        router.replace("/external");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [matchId, router, loadMatch]);

  useEffect(() => {
    const m = loadMatch();
    if (!m) return;
    const interval = setInterval(() => {
      loadMatch();
    }, 1000);
    return () => clearInterval(interval);
  }, [matchId, loadMatch]);

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
      updateExternalMatch(matchId, {
        connectionLog: [...log],
        connectionWarningAcknowledged: match.connectionWarningAcknowledged,
      });
    });
    return () => stopConnectionLogging();
  }, [match, matchId, connectionCheckPassed]);

  useEffect(() => {
    if (match?.status === "in_progress") {
      const t = setInterval(() => setTimerSec((s) => s + 1), 1000);
      return () => clearInterval(t);
    }
  }, [match?.status]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [match?.chatMessages?.length]);

  useEffect(() => {
    if (!match || !isDevMode) return;
    if (match.status === "setup" && match.chatMessages.length === 0) {
      const id = setTimeout(() => {
        const m = getExternalMatch(matchId);
        if (!m) return;
        const msg: ChatMessage = {
          id: generateId(),
          sender: "player2",
          text: "ready when you are",
          timestamp: new Date().toISOString(),
        };
        updateExternalMatch(matchId, {
          chatMessages: [...m.chatMessages, msg],
        });
        loadMatch();
      }, 2000);
      return () => clearTimeout(id);
    }
  }, [match?.status, match?.chatMessages.length, isDevMode, matchId, loadMatch, match]);

  useEffect(() => {
    if (!match || !isDevMode || match.status !== "setup") return;
    if (match.player1Ready && !match.player2Ready) {
      const id = setTimeout(() => {
        updateExternalMatch(matchId, { player2Ready: true });
        loadMatch();
      }, 2500);
      return () => clearTimeout(id);
    }
  }, [match?.player1Ready, match?.player2Ready, match?.status, isDevMode, matchId, loadMatch, match]);

  useEffect(() => {
    if (!match || !isDevMode || match.status !== "in_progress") return;
    const mins = Math.floor(timerSec / 60);
    if (mins >= 2 && !botMessagesRef.current.includes("gg")) {
      botMessagesRef.current.push("gg");
      const msg: ChatMessage = {
        id: generateId(),
        sender: "player2",
        text: "gg",
        timestamp: new Date().toISOString(),
      };
      const m = getExternalMatch(matchId);
      if (m) {
        updateExternalMatch(matchId, {
          chatMessages: [...m.chatMessages, msg],
        });
        loadMatch();
      }
    }
  }, [match?.status, timerSec, isDevMode, matchId, loadMatch, match]);

  const handleReady = useCallback(() => {
    if (!match) return;
    if (isPlayer1) {
      updateExternalMatch(matchId, { player1Ready: true });
    } else {
      updateExternalMatch(matchId, { player2Ready: true });
    }
    loadMatch();
  }, [match, isPlayer1, matchId, loadMatch]);

  const handleLobbyCodeSubmit = useCallback(
    (code: string) => {
      updateExternalMatch(matchId, { lobbyCode: code });
      loadMatch();
    },
    [matchId, loadMatch]
  );

  const handleChatSend = useCallback(
    (msg: Omit<ChatMessage, "id">) => {
      const full: ChatMessage = {
        ...msg,
        id: generateId(),
      };
      const m = getExternalMatch(matchId);
      if (m) {
        updateExternalMatch(matchId, {
          chatMessages: [...m.chatMessages, full],
        });
        loadMatch();
      }
    },
    [matchId, loadMatch]
  );

  const handleBothReady = useCallback(() => {
    updateExternalMatch(matchId, { status: "in_progress" });
    loadMatch();
  }, [matchId, loadMatch]);

  const handleCancelMatch = useCallback(async () => {
    if (!match) return;
    try {
      await creditWallet(match.stakeAmount, "CS2 match cancelled – stake refunded", "match_refund");
      dispatchWalletUpdated();
      setBalance(await getWalletBalance());
      updateExternalMatch(matchId, { status: "completed" });
      router.push("/external");
    } catch {
      dispatchWalletUpdated();
    }
  }, [match, matchId, router]);

  const handleSubmitResult = useCallback(
    async (result: ExternalMatchResult) => {
      if (!match) return;
      const fullResult = { ...result };
      if (isPlayer1) {
        updateExternalMatch(matchId, { player1Result: fullResult, status: "awaiting_results" });
      } else {
        updateExternalMatch(matchId, { player2Result: fullResult, status: "awaiting_results" });
      }
      loadMatch();
    },
    [match, isPlayer1, matchId, loadMatch]
  );

  const checkResolution = useCallback(() => {
    const m = getExternalMatch(matchId);
    if (!m || m.status !== "awaiting_results") return;
    const p1 = m.player1Result;
    const p2 = m.player2Result;
    if (!p1 || !p2) return;

    const p1SaysWin = p1.winner === "self";
    const p2SaysWin = p2.winner === "self";
    const p1SaysLost = p1.winner === "opponent";
    const p2SaysLost = p2.winner === "opponent";
    if (p1SaysWin && p2SaysWin) {
      updateExternalMatch(matchId, { status: "disputed" });
      return;
    }
    if (p1SaysWin && p2SaysLost) {
      creditWallet(m.winnerPayout, `CS2 match win – ${m.game}`, "match_win").then(() => {
        dispatchWalletUpdated();
        updateExternalMatch(matchId, {
          status: "completed",
          winnerId: "player1",
          completedAt: new Date().toISOString(),
        });
        loadMatch();
      });
      return;
    }
    if (p1SaysLost && p2SaysWin) {
      updateExternalMatch(matchId, {
        status: "completed",
        winnerId: "player2",
        completedAt: new Date().toISOString(),
      });
      loadMatch();
      return;
    }
    if (p1.winner === "draw" && p2.winner === "draw") {
      creditWallet(m.stakeAmount, "CS2 match draw – stake refunded", "match_refund").then(() => {
        dispatchWalletUpdated();
        updateExternalMatch(matchId, {
          status: "completed",
          winnerId: null,
          completedAt: new Date().toISOString(),
        });
        loadMatch();
      });
    }
  }, [matchId, loadMatch]);

  useEffect(() => {
    checkResolution();
    const interval = setInterval(checkResolution, 1000);
    return () => clearInterval(interval);
  }, [checkResolution]);

  const handleConnectionContinue = useCallback(
    (ack: { timestamp: string; rating: "warning" | "unrecommended" } | null) => {
      if (ack && match) {
        updateExternalMatch(matchId, { connectionWarningAcknowledged: ack });
        loadMatch();
      }
      setConnectionCheckPassed(true);
      setConnectionCheckState("ok");
    },
    [match, matchId, loadMatch]
  );

  const handleConnectionCancel = useCallback(() => {
    router.replace("/external");
  }, [router]);

  const handleResolveDispute = useCallback(
    async (winnerId: "player1" | "player2") => {
      const m = getExternalMatch(matchId);
      if (!m || m.status !== "disputed") return;
      if (winnerId === "player2") {
        updateExternalMatch(matchId, {
          status: "completed",
          winnerId: "player2",
          completedAt: new Date().toISOString(),
        });
      } else {
        await creditWallet(m.winnerPayout, `CS2 dispute resolved – ${m.game}`, "match_win");
        dispatchWalletUpdated();
        updateExternalMatch(matchId, {
          status: "completed",
          winnerId: "player1",
          completedAt: new Date().toISOString(),
        });
      }
      loadMatch();
    },
    [matchId, loadMatch]
  );

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

  const handleSendMessage = () => {
    if (chatInput.trim()) {
      handleChatSend({
        sender: isPlayer1 ? "player1" : "player2",
        text: chatInput.trim(),
        timestamp: new Date().toISOString(),
      });
      setChatInput("");
    }
  };

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

  const formatTime = (sec: number) =>
    `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  const modeDisplay = MODE_DISPLAY[match.mode] || match.mode;
  const mapDisplay = MAP_DISPLAY[match.map] || match.map;
  const bothReady = match.player1Ready && match.player2Ready;
  const isCompleted = match.status === "completed";
  const isVictory = isCompleted && match.winnerId === (isPlayer1 ? "player1" : "player2");
  const isDefeat = isCompleted && match.winnerId && match.winnerId !== (isPlayer1 ? "player1" : "player2");
  const isDraw = isCompleted && !match.winnerId;

  return (
    <div className="flex min-h-screen flex-col bg-charcoal">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-b from-orange-950/10 via-transparent" aria-hidden />
      <AppNavbar
        username={username}
        isDevMode={isDevMode}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        currentPage="external"
      />

      <div className="border-b border-white/5 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/external"
              className="flex items-center gap-2 text-body-gray transition-colors hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Counter-Strike 2
            </Link>
            {match.status === "in_progress" && connectionCheckPassed && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                ✓ Connection OK
              </span>
            )}
          </div>
          <span className="text-body-gray tabular-nums">
            {match.status === "in_progress" ? formatTime(timerSec) : ""}
          </span>
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-card/50 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-sm font-medium text-white">${balance.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-[1200px] flex-1 gap-4 px-4 py-6 sm:px-6 lg:flex-row">
        <div className="flex-1 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div className="card-border rounded-card bg-card p-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal/40 to-purple/40 text-xl font-bold text-white">
                {match.player1.username.charAt(0)}
              </div>
              <p className="mt-2 font-medium text-white">{match.player1.username}</p>
              <p className="text-xs text-body-gray">Rating {match.player1.rating}</p>
            </div>
            <div className="flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-teal">VS</span>
              <p className="mt-1 text-sm text-body-gray">
                ${match.stakeAmount} stake
              </p>
            </div>
            <div className="card-border rounded-card bg-card p-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/40 to-red-500/40 text-xl font-bold text-white">
                {match.player2.username.charAt(0)}
              </div>
              <p className="mt-2 font-medium text-white">{match.player2.username}</p>
              <p className="text-xs text-body-gray">Rating {match.player2.rating}</p>
            </div>
          </div>

          {(match.status === "setup" || (match.status === "in_progress" && bothReady === false)) && (
            <button
              type="button"
              onClick={() => {
                if (bothReady) handleBothReady();
              }}
              disabled={!bothReady}
              className="rounded-lg bg-teal px-6 py-2 font-semibold text-charcoal hover:shadow-teal-glow disabled:opacity-50"
            >
              {bothReady ? "Start Match" : "Waiting for both players to ready..."}
            </button>
          )}

          {match.status === "setup" && (
            <div className={bothReady ? "opacity-50" : ""}>
              <MatchSetup
                match={match}
                isPlayer1={isPlayer1}
                onReady={handleReady}
                onCancel={handleCancelMatch}
                onLobbyCodeSubmit={handleLobbyCodeSubmit}
                onChatSend={handleChatSend}
                canCancel={canCancel}
              />
            </div>
          )}

          {match.status === "in_progress" && (
            <div className="card-border rounded-card bg-card p-6">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 animate-pulse rounded-full bg-teal" />
                <p className="font-semibold text-white">Match in Progress...</p>
              </div>
              <p className="mt-2 text-body-gray">
                Playing CS2 — {modeDisplay} on {mapDisplay}
              </p>
              {(isPlayer1 ? match.player1Result : match.player2Result) ? (
                <p className="mt-4 text-body-gray">You&apos;ve reported. Waiting for opponent...</p>
              ) : !showResultForm ? (
                <button
                  type="button"
                  onClick={() => setShowResultForm(true)}
                  className="mt-4 rounded-lg bg-teal px-6 py-3 font-semibold text-charcoal hover:shadow-teal-glow"
                >
                  Report Result
                </button>
              ) : (
                <div className="mt-4">
                  <ResultReporting
                    onSubmit={(r) => {
                      handleSubmitResult(r);
                      setShowResultForm(false);
                    }}
                  />
                </div>
              )}
              <div className="card-border mt-4 rounded-lg bg-[#1A1D27] p-4 opacity-70">
                <p className="text-xs text-body-gray">How to Play — steps above still apply</p>
              </div>
            </div>
          )}

          {match.status === "awaiting_results" && (
            <div className="card-border rounded-card bg-card p-6">
              <p className="font-semibold text-white">Report your result</p>
              {(isPlayer1 ? match.player1Result : match.player2Result) ? (
                <p className="mt-2 text-body-gray">You&apos;ve reported. Waiting for opponent to report...</p>
              ) : !showResultForm ? (
                <>
                  <p className="mt-1 text-body-gray">Submit your result below.</p>
                  <button
                    type="button"
                    onClick={() => setShowResultForm(true)}
                    className="mt-4 rounded-lg bg-teal px-6 py-3 font-semibold text-charcoal hover:shadow-teal-glow"
                  >
                    Report Result
                  </button>
                </>
              ) : (
                <div className="mt-4">
                  <ResultReporting
                    onSubmit={(r) => {
                      handleSubmitResult(r);
                      setShowResultForm(false);
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {match.status === "disputed" && (
            <DisputePanel
              match={match}
              isDevMode={isDevMode}
              onResolve={handleResolveDispute}
            />
          )}
        </div>

        <div className="card-border w-full shrink-0 rounded-card bg-card lg:w-80">
          <h3 className="border-b border-white/5 p-3 font-semibold text-white">Match Chat</h3>
          <div className="flex h-48 flex-col overflow-y-auto p-3">
            {match.chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-2 max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                  msg.sender === (isPlayer1 ? "player1" : "player2")
                    ? "ml-auto bg-teal/20 text-right"
                    : "bg-white/5 text-left"
                }`}
              >
                <p className="text-xs text-body-gray">
                  {msg.sender === "player1" ? match.player1.username : match.player2.username}
                </p>
                <p className="text-white">{msg.text}</p>
                <p className="mt-1 text-xs text-body-gray">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="flex gap-2 border-t border-white/5 p-3">
            <input
              type="text"
              placeholder="Type a message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              className="flex-1 rounded-lg border border-white/10 bg-[#1A1D27] px-3 py-2 text-sm text-white placeholder:text-body-gray focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              className="rounded-lg bg-teal px-4 py-2 text-sm font-medium text-charcoal hover:shadow-teal-glow"
            >
              Send
            </button>
          </div>
        </div>
      </main>

      {isVictory && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-charcoal/98 px-4">
          <div className="absolute inset-0 bg-gradient-to-t from-teal/10 via-transparent to-teal/10 victory-glow" aria-hidden />
          <div className="animate-fade-in relative text-center">
            <p className="text-5xl font-bold text-white drop-shadow-[0_0_30px_rgba(0,229,199,0.5)] sm:text-6xl">
              🏆 VICTORY!
            </p>
            <p className="mt-4 text-2xl font-bold text-teal">
              You won ${match.winnerPayout.toFixed(2)}!
            </p>
            <p className="mt-2 text-body-gray">Defeated {match.player2.username}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/external"
                className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10"
              >
                Back to Arena
              </Link>
              <Link
                href="/external/cs2"
                className="rounded-lg bg-teal px-6 py-3 font-semibold text-charcoal hover:shadow-teal-glow"
              >
                Rematch
              </Link>
            </div>
          </div>
        </div>
      )}

      {isDefeat && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-charcoal/98 px-4">
          <div className="animate-fade-in text-center">
            <p className="text-2xl font-semibold text-white">Better luck next time</p>
            <p className="mt-2 text-lg text-red-400">You lost ${match.stakeAmount.toFixed(2)}</p>
            <p className="mt-1 text-body-gray">{match.player2.username} won</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/external"
                className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10"
              >
                Back to Arena
              </Link>
              <Link
                href="/external/cs2"
                className="rounded-lg bg-teal px-6 py-3 font-semibold text-charcoal hover:shadow-teal-glow"
              >
                Try Again
              </Link>
            </div>
          </div>
        </div>
      )}

      {isDraw && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-charcoal/98 px-4">
          <div className="animate-fade-in text-center">
            <p className="text-2xl font-semibold text-white">Draw!</p>
            <p className="mt-2 text-lg text-teal">Stakes refunded.</p>
            <p className="mt-1 text-body-gray">
              Your ${match.stakeAmount.toFixed(2)} has been returned to your wallet.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/external"
                className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10"
              >
                Back to Arena
              </Link>
              <Link
                href="/external/cs2"
                className="rounded-lg bg-teal px-6 py-3 font-semibold text-charcoal hover:shadow-teal-glow"
              >
                Rematch
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
