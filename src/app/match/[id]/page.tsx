"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import AppNavbar, { dispatchWalletUpdated } from "@/components/AppNavbar";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import {
  getCurrentUser,
  getMatch,
  completeMatchAndSettle,
  updateMatch as apiUpdateMatch,
  submitReport,
  type StoredMatch,
} from "@/lib/api";
import { updateMatch } from "@/lib/matchmaking";
import { startConnectionLogging, stopConnectionLogging } from "@/lib/connection-logger";
import type { ConnectionSnapshot } from "@/lib/connection-logger";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import EightBallPool from "@/components/games/EightBallPool";
import Chess from "@/components/games/Chess";
import ConnectFour from "@/components/games/ConnectFour";
import ReactionDuel from "@/components/games/ReactionDuel";
import MemoryMatch from "@/components/games/MemoryMatch";
import SpellingBee from "@/components/games/SpellingBee";
import Checkers from "@/components/games/Checkers";
import Trivia from "@/components/games/Trivia";
import TypingRace from "@/components/games/TypingRace";
import { type ChatMessage } from "@/components/GameChat";
import GameLayout, { type GameLayoutLogEntry } from "@/components/game/GameLayout";
import GameResultOverlay from "@/components/game/GameResultOverlay";
import type { MatchUiState } from "@/components/game/matchUi";
import { usePlayMode } from "@/contexts/PlayModeContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useToast } from "@/components/Toast";

const OPPONENT_RECONNECT_SEC = 30;

type Outcome = null | "victory" | "defeat" | "draw";

function MatchPageContent() {
  const router = useRouter();
  const params = useParams();
  const matchId = (params?.id as string) || "";
  const { isPractice } = usePlayMode();
  const { showToast } = useToast();

  const [username, setUsername] = useState<string>("Player");
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [match, setMatch] = useState<StoredMatch | null>(null);
  const [timerSec, setTimerSec] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [forfeitConfirm, setForfeitConfirm] = useState(false);
  const [connectionCheckPassed, setConnectionCheckPassed] = useState(false);
  const [connectionCheckState, setConnectionCheckState] = useState<"checking" | "ok" | "warning" | "unrecommended">("checking");
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "poor" | "disconnected">("connecting");
  const [opponentDisconnectedAt, setOpponentDisconnectedAt] = useState<number | null>(null);
  const [reconnectCountdown, setReconnectCountdown] = useState<number | null>(null);
  const [wonByForfeit, setWonByForfeit] = useState(false);
  const [incomingEvent, setIncomingEvent] = useState<Record<string, unknown> | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [matchUi, setMatchUi] = useState<MatchUiState | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportComment, setReportComment] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const forfeitHandledRef = useRef(false);
  const inProgressSetRef = useRef(false);
  const matchRef = useRef<StoredMatch | null>(null);
  matchRef.current = match;

  const {
    connected: realtimeConnected,
    opponentConnected,
    sendGameEvent,
  } = useMultiplayer({
    matchId: match?.isRealMultiplayer ? matchId : "",
    userId,
    onGameEvent: (event) => {
      const e = event as { type?: string };
      if (e.type === "opponent_disconnected") {
        setOpponentDisconnectedAt((t) => (t === null ? Date.now() : t));
        return;
      }
      if (e.type === "chat_message") {
        const ev = event as {
          message?: string;
          isPreset?: boolean;
          senderId?: string;
          senderName?: string;
          timestamp?: number;
        };
        if (ev.message && ev.senderId && ev.timestamp) {
          setChatMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              senderId: ev.senderId,
              senderName: ev.senderName || "Opponent",
              message: ev.message,
              isPreset: !!ev.isPreset,
              timestamp: ev.timestamp,
              reported: false,
            },
          ]);
          if (!chatOpen) {
            setUnreadCount((c) => c + 1);
          }
        }
        return;
      }
      setIncomingEvent(event as Record<string, unknown>);
    },
  });

  useEffect(() => {
    async function load() {
      setLoadError(null);
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.push("/login");
          return;
        }
        setUsername(user.username);
        setUserId(user.id);
        setIsDevMode(user.isDevMode ?? false);
        const m = await getMatch(matchId);
        if (!m) {
          setLoadError("Match not found. It may have been cancelled or the link is invalid.");
          setLoading(false);
          return;
        }
        if (!m.player1 || !m.player2) {
          setLoadError("Invalid match data. Please try again.");
          setLoading(false);
          return;
        }
        if (!m.isRealMultiplayer && !m.isPractice && (m.stakeAmount ?? 0) > 0) {
          setLoadError("Invalid match — real money matches require a real opponent. Please start a new match.");
          setLoading(false);
          return;
        }
        setMatch(m);
      } catch (err) {
        console.error("Failed to load match:", err);
        setLoadError("Failed to load match. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [matchId, router]);

  const isRealMultiplayerMatch = match?.isRealMultiplayer ?? false;
  const realtimeConnectedRef = useRef(realtimeConnected);
  realtimeConnectedRef.current = realtimeConnected;

  useEffect(() => {
    if (!match || match.status !== "in_progress" || loading) return;
    if (!isRealMultiplayerMatch) {
      setConnectionCheckPassed(true);
      setConnectionCheckState("ok");
      setConnectionStatus("connected");
      return;
    }
    const graceMs = 5000;
    const graceTimeout = setTimeout(() => {
      setConnectionCheckPassed(true);
      setConnectionCheckState("ok");
      setConnectionStatus(realtimeConnectedRef.current ? "connected" : "poor");
    }, graceMs);
    return () => clearTimeout(graceTimeout);
  }, [match, loading, isRealMultiplayerMatch]);

  useEffect(() => {
    if (!connectionCheckPassed || !isRealMultiplayerMatch) return;
    setConnectionStatus(realtimeConnected ? "connected" : "poor");
  }, [connectionCheckPassed, isRealMultiplayerMatch, realtimeConnected]);

  useEffect(() => {
    if (!match || match.status !== "in_progress" || !isRealMultiplayerMatch) return;
    const interval = setInterval(() => {
      setConnectionStatus((prev) => (realtimeConnectedRef.current ? "connected" : prev === "disconnected" ? "disconnected" : "poor"));
    }, 10000);
    return () => clearInterval(interval);
  }, [match, isRealMultiplayerMatch]);

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

  // Clear disconnect state when opponent reconnects
  useEffect(() => {
    if (opponentConnected) {
      setOpponentDisconnectedAt(null);
      setReconnectCountdown(null);
    }
  }, [opponentConnected]);

  const isRealMultiplayer = match?.isRealMultiplayer ?? false;

  const sendLocalChatMessage = useCallback(
    (text: string, isPreset: boolean, senderId: string, senderName: string) => {
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        senderId,
        senderName,
        message: text,
        isPreset,
        timestamp: Date.now(),
        reported: false,
      };
      setChatMessages((prev) => [...prev, msg]);
      if (!chatOpen && senderId !== userId && senderId !== "system") {
        setUnreadCount((c) => c + 1);
      }
    },
    [chatOpen, userId]
  );

  const handleSendChatMessage = useCallback(
    (message: string, isPreset: boolean) => {
      if (!message.trim()) return;
      const senderName = username || "Player";
      sendLocalChatMessage(message, isPreset, userId, senderName);
      const payload = {
        type: "chat_message",
        message,
        isPreset,
        senderId: userId,
        senderName,
        timestamp: Date.now(),
      };
      if (isRealMultiplayer && sendGameEvent) {
        sendGameEvent(payload).catch(() => {});
      }
    },
    [isRealMultiplayer, sendGameEvent, sendLocalChatMessage, userId, username]
  );

  const handleReportMessage = useCallback(
    (id: string) => {
      setChatMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, reported: true } : m))
      );
      try {
        if (typeof window !== "undefined") {
          const key = "skillflow_chat_reports";
          const existing = JSON.parse(
            window.localStorage.getItem(key) ?? "[]"
          ) as unknown[];
          const reported = chatMessages.find((m) => m.id === id);
          const entry = reported
            ? {
                id: reported.id,
                senderId: reported.senderId,
                senderName: reported.senderName,
                message: reported.message,
                timestamp: reported.timestamp,
              }
            : { id, timestamp: Date.now() };
          window.localStorage.setItem(
            key,
            JSON.stringify([...existing, entry])
          );
        }
      } catch {
        // ignore
      }
      // lightweight confirmation
      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          senderId: "system",
          senderName: "System",
          message: "Message reported. We'll review it.",
          isPreset: false,
          timestamp: Date.now(),
          reported: false,
        },
      ]);
    },
    [chatMessages]
  );

  // Real multiplayer: when both connected, set match status to in_progress in DB (once)
  useEffect(() => {
    if (!match?.isRealMultiplayer || !realtimeConnected || !opponentConnected) return;
    if (inProgressSetRef.current) return;
    inProgressSetRef.current = true;
    apiUpdateMatch(matchId, { status: "in_progress" });
  }, [match?.isRealMultiplayer, matchId, realtimeConnected, opponentConnected]);

  // Opponent disconnect: 30s countdown then forfeit win
  useEffect(() => {
    if (!match?.isRealMultiplayer || forfeitHandledRef.current) return;
    if (opponentDisconnectedAt === null) {
      setReconnectCountdown(null);
      return;
    }
    setReconnectCountdown(OPPONENT_RECONNECT_SEC);
    const interval = setInterval(() => {
      setReconnectCountdown((c) => {
        if (c === null || c <= 1) {
          clearInterval(interval);
          const m = matchRef.current;
          if (!forfeitHandledRef.current && m) {
            forfeitHandledRef.current = true;
            setWonByForfeit(true);
            completeMatchAndSettle(m, "player1").catch(() => {});
            dispatchWalletUpdated();
            setOutcome("victory");
          }
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [match?.isRealMultiplayer, opponentDisconnectedAt]);

  /**
   * Unified game end: winner is 'player1' or 'player2'.
   * Compare winner ID with current user to show the correct result to each player.
   * Only Player 1 persists the result (completeMatchAndSettle) to avoid double-writes.
   */
  const handleGameEnd = useCallback(
    async (winner: "player1" | "player2") => {
      if (!match) return;
      const winnerId = winner === "player1" ? match.player1Id : match.player2Id;
      // Practice/dev matches may not have stable user IDs on the match record,
      // so fall back to role-based win detection.
      const iWon = winnerId ? winnerId === userId : winner === "player1";

      try {
        await completeMatchAndSettle(match, winner);
        dispatchWalletUpdated();
      } catch {
        // eslint-disable-next-line no-console
        console.error("[MatchPage] Failed to persist match result", { matchId: match.id, winner });
        showToast("Match result could not be saved — please contact support", "error");
        dispatchWalletUpdated();
      }
      setOutcome(iWon ? "victory" : "defeat");
    },
    [match, userId, showToast]
  );

  const handleWin = useCallback(() => handleGameEnd("player1"), [handleGameEnd]);
  const handleLoss = useCallback(() => handleGameEnd("player2"), [handleGameEnd]);

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

  const handleForfeitConfirm = useCallback(async () => {
    if (match?.isRealMultiplayer && (match?.gameType === "chess" || match?.gameType === "connect-4")) {
      await sendGameEvent({ type: "resign" }).catch(() => {});
    }
    await handleGameEnd("player2");
    setForfeitConfirm(false);
    if (typeof window !== "undefined" && match) {
      window.location.href = `/play/${match.gameType}`;
    }
  }, [handleGameEnd, match, sendGameEvent]);

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

  useEffect(() => {
    setMatchUi(null);
  }, [matchId]);

  const mergedLogEntries = useMemo((): GameLayoutLogEntry[] => {
    const chatEntries: GameLayoutLogEntry[] = chatMessages.map((m) => ({
      id: `chat-${m.id}`,
      type: "chat",
      sender: m.senderName,
      text: m.message,
      timestamp: m.timestamp,
    }));
    const systemEntries: GameLayoutLogEntry[] = (matchUi?.systemLogEntries ?? []).map((e) => ({
      id: `sys-${e.id}`,
      type: "system",
      text: e.text,
      timestamp: e.timestamp,
    }));
    return [...chatEntries, ...systemEntries].sort((a, b) => a.timestamp - b.timestamp);
  }, [chatMessages, matchUi]);

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-charcoal px-4">
        <div className="text-center">
          <p className="text-lg font-medium text-white">{loadError}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              href="/play"
              className="rounded-lg bg-teal px-6 py-3 font-semibold text-charcoal hover:shadow-teal-glow"
            >
              Back to Play
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
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

  const safePlayer1 = match.player1 ?? { username: "Player 1", rating: 1000 };
  const safePlayer2 = match.player2 ?? { username: "Opponent", rating: 1000 };

  const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  const shortId = match.id.slice(0, 8);
  const myRole: "player1" | "player2" =
    isRealMultiplayer && match.player1Id && match.player2Id
      ? match.player1Id === userId
        ? "player1"
        : "player2"
      : "player1";
  const opponentUsername =
    myRole === "player1" ? safePlayer2.username : safePlayer1.username;
  const waitingForOpponent = isRealMultiplayer && connectionCheckPassed && !opponentConnected && !outcome;
  const connectionTone =
    connectionStatus === "disconnected"
      ? "#EF4444"
      : connectionStatus === "poor"
        ? "#FACC15"
        : "#22C55E";

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("[MatchPage] Loaded match room", {
      matchId: match.id,
      gameType: match.gameType,
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      myUserId: userId,
      myRole,
      isRealMultiplayer,
    });
  }

  const boardGameTypes = [
    "chess",
    "connect-4",
    "reaction-duel",
    "memory-match",
    "checkers",
    "spelling-bee",
    "trivia",
    "typing-race",
  ] as const;
  const lockGameViewport =
    match.status === "in_progress" &&
    !outcome &&
    !waitingForOpponent &&
    (boardGameTypes as readonly string[]).includes(match.gameType);

  const GAME_LAYOUT_TITLE: Record<string, string> = {
    chess: "Chess",
    "connect-4": "Connect 4",
    "reaction-duel": "Reaction Duel",
    "memory-match": "Memory Match",
    checkers: "Checkers",
    "spelling-bee": "Spelling Bee",
    trivia: "Trivia",
    "typing-race": "Typing Race",
  };

  function toLayoutConnection(
    s: typeof connectionStatus
  ): "connected" | "reconnecting" | "disconnected" {
    if (s === "disconnected") return "disconnected";
    if (s === "poor" || s === "connecting") return "reconnecting";
    return "connected";
  }

  const gameLayoutProps = {
    gameName: GAME_LAYOUT_TITLE[match.gameType] ?? match.gameDisplayName,
    matchId: match.id,
    mode: (match.isPractice ? "practice" : "real") as "practice" | "real",
    player1: {
      username: safePlayer1.username,
      rating: safePlayer1.rating,
      score: matchUi?.scores.player1 ?? 0,
      scoreLabel: matchUi?.scoreLabel,
      isBot: false,
    },
    player2: {
      username: safePlayer2.username,
      rating: safePlayer2.rating,
      score: matchUi?.scores.player2 ?? 0,
      scoreLabel: matchUi?.scoreLabel,
      isBot: !isRealMultiplayer,
    },
    currentTurn: matchUi?.currentTurn ?? "player1",
    timerDisplay: formatTime(timerSec),
    turnTimerDisplay: matchUi?.turnTimerDisplay,
    connectionStatus: toLayoutConnection(connectionStatus),
    turnText: matchUi?.turnText ?? "Loading…",
    logEntries: mergedLogEntries,
    onSendChat: (msg: string) => {
      handleSendChatMessage(msg, false);
    },
    chatPresets: ["gl hf!", "gg", "Nice move!", "Rematch?"],
    onLeaveMatch: () => setForfeitConfirm(true),
    onReportIssue: () => { setReportOpen(true); setReportSubmitted(false); },
    realStakeDisplay: match.isPractice ? undefined : `$${match.stakeAmount.toFixed(2)}`,
  };

  return (
    <div
      className={`relative flex flex-col bg-charcoal ${
        lockGameViewport
          ? "h-[100dvh] max-h-[100dvh] overflow-hidden"
          : "min-h-screen"
      }`}
    >
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username={username}
        isDevMode={isDevMode}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        currentPage="play"
      />
      {/* Gameplay mobile needs strict 100vh layout; hide the mode toggle on <768px for board games. */}
      <div className={lockGameViewport ? "hidden md:block" : ""}>
        <ModeToggleBarContent />
      </div>

      <div
        className={
          lockGameViewport
            ? "flex min-h-0 flex-1 flex-col overflow-hidden"
            : "flex flex-1 flex-col"
        }
      >
      {/* Top bar (hidden when unified GameLayout is active) */}
      {!lockGameViewport && (
      <div className="shrink-0 border-b border-white/5 px-3 py-0 h-[40px] md:px-6 md:py-3 md:h-auto">
        <div className="mx-auto hidden max-w-[1200px] items-center justify-between md:flex">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white">
              {match.gameType === "chess"
                ? "Chess"
                : match.gameType === "connect-4"
                  ? "Connect 4"
                  : match.gameType === "reaction-duel"
                    ? "Reaction Duel"
                    : match.gameType === "memory-match"
                      ? "Memory Match"
                    : match.gameType === "checkers"
                      ? "Checkers"
                      : match.gameType === "spelling-bee"
                        ? "Spelling Bee"
                        : match.gameType === "trivia"
                          ? "Trivia"
                          : match.gameType === "typing-race"
                            ? "Typing Race"
                            : match.gameDisplayName}
            </span>
            {match.isPractice && (
              <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-400">
                PRACTICE
              </span>
            )}
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
              ✓ Connection OK
            </span>
          </div>
          <span className="text-body-gray tabular-nums">{formatTime(timerSec)}</span>
          <span className="text-xs text-body-gray">Match ID: {shortId}</span>
        </div>
        <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold text-white text-[15px]">
              {match.gameType === "chess"
                ? "Chess"
                : match.gameType === "connect-4"
                  ? "Connect 4"
                  : match.gameType === "reaction-duel"
                    ? "Reaction Duel"
                    : match.gameType === "memory-match"
                      ? "Memory Match"
                      : match.gameType === "checkers"
                        ? "Checkers"
                        : match.gameType === "spelling-bee"
                          ? "Spelling Bee"
                          : match.gameType === "trivia"
                            ? "Trivia"
                            : match.gameType === "typing-race"
                              ? "Typing Race"
                              : match.gameDisplayName}
            </span>
            {match.isPractice ? (
              <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-400">PRACTICE</span>
            ) : (
              <span className="rounded-full bg-teal/10 px-2 py-0.5 text-[10px] font-semibold text-teal">REAL MONEY</span>
            )}
          </div>
          <span className="text-[24px] font-bold leading-none tabular-nums text-white">{formatTime(timerSec)}</span>
        </div>
      </div>
      )}

      {/* Waiting for opponent (real multiplayer) */}
      {waitingForOpponent && (
        <main className="mx-auto flex min-h-[40vh] flex-1 flex-col items-center justify-center px-4 py-8">
          <div className="h-12 w-12 animate-pulse rounded-full border-2 border-teal/50" />
          <p className="mt-4 text-lg font-semibold text-white">Waiting for opponent to connect...</p>
          <p className="mt-1 text-body-gray">They have joined the match and are loading the game.</p>
        </main>
      )}

      {/* Opponent disconnected countdown */}
      {isRealMultiplayer && opponentDisconnectedAt !== null && reconnectCountdown !== null && !outcome && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-charcoal/90 px-4">
          <p className="text-lg font-semibold text-amber-400">Opponent disconnected...</p>
          <p className="mt-2 text-body-gray">
            Waiting {reconnectCountdown}s for reconnection. If they don&apos;t return, you win by forfeit.
          </p>
        </div>
      )}

      {/* Connection quality: small indicator only when actually poor (no modal at start) */}
      {isRealMultiplayerMatch && match.status === "in_progress" && !outcome && connectionStatus === "poor" && (
        <div
          className="fixed right-2 top-[118px] z-30 rounded-md border px-2.5 py-1.5 text-[11px] font-medium text-amber-400"
          style={{
            background: "rgba(245, 158, 11, 0.15)",
            borderColor: "rgba(245, 158, 11, 0.3)",
          }}
        >
          Unstable connection
        </div>
      )}
      {isRealMultiplayerMatch && match.status === "in_progress" && !outcome && connectionStatus === "disconnected" && (
        <div
          className="fixed left-0 right-0 top-[72px] z-30 border-b px-4 py-2 text-center text-[13px] font-medium text-red-400"
          style={{
            background: "rgba(239, 68, 68, 0.15)",
            borderColor: "rgba(239, 68, 68, 0.3)",
          }}
        >
          Connection lost — trying to reconnect...
        </div>
      )}

      {/* Main: Chess and Connect 4 use full-width layout; Pool uses 3 columns */}
      {!waitingForOpponent && match.gameType === "chess" ? (
        <main className="mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden px-0 py-0">
          {match.status === "in_progress" && !outcome ? (
            <GameLayout {...gameLayoutProps}>
              <Chess
                player1={{ username: safePlayer1.username, rating: safePlayer1.rating }}
                player2={{ username: safePlayer2.username, rating: safePlayer2.rating }}
                onGameEnd={handleGameEnd}
                onGameDraw={handleDraw}
                isPlayer2Bot={!isRealMultiplayer}
                botDifficulty={match.botDifficulty ?? "gamer"}
                isMultiplayer={isRealMultiplayer}
                myRole={myRole}
                sendGameEvent={sendGameEvent}
                incomingEvent={incomingEvent}
                onEventProcessed={() => setIncomingEvent(null)}
                onMatchUi={setMatchUi}
              />
            </GameLayout>
          ) : null}
        </main>
      ) : !waitingForOpponent && match.gameType === "connect-4" ? (
        <main className="mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden px-0 py-0">
          {match.status === "in_progress" && !outcome ? (
            <GameLayout {...gameLayoutProps}>
              <ConnectFour
                player1={{ username: safePlayer1.username, rating: safePlayer1.rating }}
                player2={{ username: safePlayer2.username, rating: safePlayer2.rating }}
                onGameEnd={handleGameEnd}
                onGameDraw={handleDraw}
                isPlayer2Bot={!isRealMultiplayer}
                botDifficulty={match.botDifficulty ?? "gamer"}
                isMultiplayer={isRealMultiplayer}
                myRole={myRole}
                sendGameEvent={sendGameEvent}
                incomingEvent={incomingEvent}
                onEventProcessed={() => setIncomingEvent(null)}
                onMatchUi={setMatchUi}
              />
            </GameLayout>
          ) : null}
        </main>
      ) : !waitingForOpponent && match.gameType === "reaction-duel" ? (
        <main className="mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden px-0 py-0">
          {match.status === "in_progress" && !outcome ? (
            <GameLayout {...gameLayoutProps}>
              <ReactionDuel
                player1={{ username: safePlayer1.username, rating: safePlayer1.rating }}
                player2={{ username: safePlayer2.username, rating: safePlayer2.rating }}
                onGameEnd={handleGameEnd}
                onGameDraw={handleDraw}
                isPlayer2Bot={!isRealMultiplayer}
                botDifficulty={match.botDifficulty ?? "gamer"}
                isMultiplayer={isRealMultiplayer}
                myRole={myRole}
                sendGameEvent={sendGameEvent}
                incomingEvent={incomingEvent}
                onEventProcessed={() => setIncomingEvent(null)}
                isPractice={match.isPractice}
                onMatchUi={setMatchUi}
              />
            </GameLayout>
          ) : null}
        </main>
      ) : !waitingForOpponent && match.gameType === "memory-match" ? (
        <main className="mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden px-0 py-0">
          {match.status === "in_progress" && !outcome ? (
            <GameLayout {...gameLayoutProps}>
              <MemoryMatch
                player1={{ username: safePlayer1.username, rating: safePlayer1.rating }}
                player2={{ username: safePlayer2.username, rating: safePlayer2.rating }}
                onGameEnd={handleGameEnd}
                onGameDraw={handleDraw}
                isPlayer2Bot={!isRealMultiplayer}
                isPractice={match.isPractice}
                onMatchUi={setMatchUi}
              />
            </GameLayout>
          ) : null}
        </main>
      ) : !waitingForOpponent && match.gameType === "checkers" ? (
        <main className="mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden px-0 py-0">
          {match.status === "in_progress" && !outcome ? (
            <GameLayout {...gameLayoutProps}>
              <Checkers
                player1={{ username: safePlayer1.username, rating: safePlayer1.rating }}
                player2={{ username: safePlayer2.username, rating: safePlayer2.rating }}
                onGameEnd={handleGameEnd}
                onGameDraw={handleDraw}
                isPlayer2Bot={!isRealMultiplayer}
                botDifficulty={match.botDifficulty ?? "gamer"}
                isMultiplayer={isRealMultiplayer}
                myRole={myRole}
                sendGameEvent={sendGameEvent}
                incomingEvent={incomingEvent}
                onEventProcessed={() => setIncomingEvent(null)}
                isPractice={match.isPractice}
                onMatchUi={setMatchUi}
              />
            </GameLayout>
          ) : null}
        </main>
      ) : !waitingForOpponent && match.gameType === "spelling-bee" ? (
        <main className="mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden px-0 py-0">
          {match.status === "in_progress" && !outcome ? (
            <GameLayout {...gameLayoutProps}>
              <SpellingBee
                player1={{ username: safePlayer1.username, rating: safePlayer1.rating }}
                player2={{ username: safePlayer2.username, rating: safePlayer2.rating }}
                onGameEnd={handleGameEnd}
                onGameDraw={handleDraw}
                isPlayer2Bot={!isRealMultiplayer}
                botDifficulty={match.botDifficulty ?? "gamer"}
                isMultiplayer={isRealMultiplayer}
                myRole={myRole}
                sendGameEvent={sendGameEvent}
                incomingEvent={incomingEvent}
                onEventProcessed={() => setIncomingEvent(null)}
                isPractice={match.isPractice}
                onMatchUi={setMatchUi}
              />
            </GameLayout>
          ) : null}
        </main>
      ) : !waitingForOpponent && match.gameType === "trivia" ? (
        <main className="mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden px-0 py-0">
          {match.status === "in_progress" && !outcome ? (
            <GameLayout {...gameLayoutProps}>
              <Trivia
                player1={{ username: safePlayer1.username, rating: safePlayer1.rating }}
                player2={{ username: safePlayer2.username, rating: safePlayer2.rating }}
                onGameEnd={handleGameEnd}
                onGameDraw={handleDraw}
                isPlayer2Bot={!isRealMultiplayer}
                botDifficulty={match.botDifficulty ?? "gamer"}
                isMultiplayer={isRealMultiplayer}
                myRole={myRole}
                sendGameEvent={sendGameEvent}
                incomingEvent={incomingEvent}
                onEventProcessed={() => setIncomingEvent(null)}
                isPractice={match.isPractice}
                onMatchUi={setMatchUi}
              />
            </GameLayout>
          ) : null}
        </main>
      ) : !waitingForOpponent && match.gameType === "typing-race" ? (
        <main className="mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden px-0 py-0">
          {match.status === "in_progress" && !outcome ? (
            <GameLayout {...gameLayoutProps}>
              <TypingRace
                player1={{ username: safePlayer1.username, rating: safePlayer1.rating }}
                player2={{ username: safePlayer2.username, rating: safePlayer2.rating }}
                onGameEnd={handleGameEnd}
                onGameDraw={handleDraw}
                isPlayer2Bot={!isRealMultiplayer}
                botDifficulty={match.botDifficulty ?? "gamer"}
                isMultiplayer={isRealMultiplayer}
                myRole={myRole}
                sendGameEvent={sendGameEvent}
                incomingEvent={incomingEvent}
                onEventProcessed={() => setIncomingEvent(null)}
                isPractice={match.isPractice}
                onMatchUi={setMatchUi}
              />
            </GameLayout>
          ) : null}
        </main>
      ) : !waitingForOpponent && match.gameType === "8-ball-pool" && match.status === "in_progress" && !outcome ? (
        <main className="mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col px-4 py-6">
          <div className="flex w-full flex-col bg-transparent">
            <EightBallPool
              player1={{ username: safePlayer1.username, rating: safePlayer1.rating }}
              player2={{ username: safePlayer2.username, rating: safePlayer2.rating }}
              onGameEnd={handleGameEnd}
              isPlayer2Bot={!isRealMultiplayer}
            />
          </div>
        </main>
      ) : !waitingForOpponent ? (
        <main className="mx-auto grid max-w-[1200px] grid-cols-1 gap-4 px-4 py-6 md:grid-cols-[1fr_2fr_1fr]">
          <div className="card-border rounded-card bg-card p-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-teal/40 to-purple/40 text-2xl font-bold text-white">
              {safePlayer1.username.charAt(0)}
            </div>
            <p className="mt-2 font-medium text-white">{safePlayer1.username}</p>
            <p className="text-xs text-body-gray">Rating {safePlayer1.rating}</p>
            <p className="mt-4 text-3xl font-bold text-teal">0</p>
            <p className="text-xs text-body-gray">Score</p>
          </div>
          <div className="card-border flex flex-col items-center justify-center rounded-card bg-card p-4">
            {match.status === "in_progress" && !outcome ? (
              <>
                <p className="text-body-gray">Game in progress...</p>
                <div className="mt-6 flex flex-wrap justify-center gap-4">
                  <button
                    type="button"
                    onClick={handleWin}
                    className="rounded-lg bg-teal px-6 py-3 font-semibold text-charcoal hover:shadow-teal-glow"
                  >
                    I Won
                  </button>
                  <button
                    type="button"
                    onClick={handleLoss}
                    className="rounded-lg border border-red-500/50 bg-red-500/10 px-6 py-3 font-semibold text-red-400 hover:bg-red-500/20"
                  >
                    I Lost
                  </button>
                </div>
              </>
            ) : null}
          </div>
          <div className="card-border rounded-card bg-card p-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple/40 to-rose-500/40 text-2xl font-bold text-white">
              {safePlayer2.username.charAt(0)}
            </div>
            <p className="mt-2 font-medium text-white">
              {safePlayer2.username}
              {!isRealMultiplayer && (
                <span className="ml-1.5 inline-flex items-center rounded bg-white/10 px-1.5 py-0.5 text-xs font-medium text-body-gray">
                  BOT
                </span>
              )}
            </p>
            <p className="text-xs text-body-gray">Rating {safePlayer2.rating}</p>
            <p className="mt-4 text-3xl font-bold text-white">0</p>
            <p className="text-xs text-body-gray">Score</p>
          </div>
        </main>
      ) : null}

      {/* Bottom bar (hidden when unified GameLayout is active) */}
      {!lockGameViewport && (
      <div className="shrink-0 border-t border-white/5 px-3 py-0 h-[44px] md:px-6 md:py-3 md:h-auto">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 h-full">
          <p className="text-sm text-body-gray">
            {match.isPractice
              ? "Practice Match — No stakes"
              : `Stake: $${match.stakeAmount.toFixed(2)} each • Winner gets: $${match.winnerPayout.toFixed(2)}`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setReportOpen(true); setReportSubmitted(false); }}
              className="hidden md:inline-flex rounded-lg border border-white/10 px-4 py-2 text-sm text-body-gray hover:text-white"
            >
              Report Issue
            </button>
            {match.status === "in_progress" && !outcome && (
              <button
                type="button"
                onClick={() => setForfeitConfirm(true)}
                className={match.isPractice
                  ? "rounded-lg border border-white/20 px-4 py-2 text-sm text-body-gray hover:bg-white/10"
                  : "rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
                }
              >
                {match.isPractice ? "Leave Match" : "Forfeit Match"}
              </button>
            )}
          </div>
        </div>
      </div>
      )}
      </div>

      {/* Game result overlay — victory, defeat, or draw */}
      {outcome && (
        <GameResultOverlay
          outcome={outcome}
          isPractice={match.isPractice}
          stakeAmount={match.stakeAmount}
          winnerPayout={match.winnerPayout}
          gameType={match.gameType}
          opponentUsername={opponentUsername}
          wonByForfeit={wonByForfeit}
          onPlayAgain={() => { window.location.href = `/play/${match.gameType}`; }}
          onLeave={() => { window.location.href = "/play"; }}
        />
      )}

      {/* Report Issue modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="card-border w-full max-w-md rounded-card bg-card p-6">
            {reportSubmitted ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <span className="text-3xl">✓</span>
                <p className="font-medium text-white">Report submitted</p>
                <p className="text-sm text-body-gray">Our team will review this and take action if needed.</p>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="mt-2 rounded-lg border border-white/20 px-6 py-2 text-sm text-white hover:bg-white/10"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <h2 className="mb-4 text-lg font-semibold text-white">Report Issue</h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs text-body-gray">Reason</label>
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-teal focus:outline-none"
                    >
                      <option value="" disabled>Select a reason…</option>
                      <option value="Cheating / Hacking">Cheating / Hacking</option>
                      <option value="Abusive Behavior">Abusive Behavior</option>
                      <option value="Unsportsmanlike Conduct">Unsportsmanlike Conduct</option>
                      <option value="Technical Issue">Technical Issue</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-body-gray">Additional details (optional)</label>
                    <textarea
                      rows={3}
                      value={reportComment}
                      onChange={(e) => setReportComment(e.target.value)}
                      placeholder="Describe what happened…"
                      className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-body-gray focus:border-teal focus:outline-none"
                    />
                  </div>
                </div>
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setReportOpen(false)}
                    className="flex-1 rounded-lg border border-white/20 py-2.5 text-white hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!reportReason || reportSubmitting}
                    onClick={async () => {
                      if (!reportReason || !match) return;
                      setReportSubmitting(true);
                      const opponentId = myRole === "player1" ? match.player2Id : match.player1Id;
                      try {
                        await submitReport({
                          reporterUserId: userId,
                          reporterUsername: username,
                          reportedUserId: opponentId ?? null,
                          reportedUsername: opponentUsername,
                          matchId: match.id,
                          gameType: match.gameType,
                          reportReason,
                          reportComment,
                        });
                        setReportSubmitted(true);
                        setReportReason("");
                        setReportComment("");
                      } catch {
                        showToast("Failed to submit report. Please try again.", "error");
                      }
                      setReportSubmitting(false);
                    }}
                    className="flex-1 rounded-lg bg-red-500/20 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/30 disabled:opacity-40"
                  >
                    {reportSubmitting ? "Submitting…" : "Submit Report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Forfeit / Leave confirmation modal */}
      {forfeitConfirm && !outcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="card-border w-full max-w-sm rounded-card bg-card p-6">
            <p className="text-center font-medium text-white">
              {match.isPractice
                ? "Leave this practice match? Your progress will not be saved."
                : `Are you sure you want to forfeit? You will lose your $${match.stakeAmount.toFixed(2)} stake.`}
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
                className={`flex-1 rounded-lg py-2.5 font-medium ${match.isPractice ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/20 text-red-400 hover:bg-red-500/30"}`}
              >
                {match.isPractice ? "Leave" : "Forfeit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MatchPage() {
  return (
    <ErrorBoundary>
      <MatchPageContent />
    </ErrorBoundary>
  );
}
