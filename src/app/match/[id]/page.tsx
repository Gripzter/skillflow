"use client";

import { useEffect, useState, useCallback, useRef, useMemo, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import AppNavbar, { dispatchWalletUpdated } from "@/components/AppNavbar";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import LoadingRing from "@/components/LoadingRing";
import {
  getCurrentUser,
  getMatch,
  getQrGuestMatch,
  completeMatchAndSettle,
  updateMatch as apiUpdateMatch,
  submitReport,
  type StoredMatch,
} from "@/lib/api";
import { updateMatch } from "@/lib/matchmaking";
import { createClient } from "@/lib/supabase";
import { CHESS_INITIAL_CLOCK_MS, getMatchTimeLimitMs } from "@/lib/games/match-timers";
import { startConnectionLogging, stopConnectionLogging } from "@/lib/connection-logger";
import type { ConnectionSnapshot } from "@/lib/connection-logger";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { AFK_TIMEOUT_SEC, useAfkTimer } from "@/hooks/useAfkTimer";
import EightBallPool from "@/components/games/EightBallPool";
import Chess from "@/components/games/Chess";
import ConnectFour from "@/components/games/ConnectFour";
import ReactionDuel from "@/components/games/ReactionDuel";
import MemoryMatch from "@/components/games/MemoryMatch";
import SpellingBee from "@/components/games/SpellingBee";
import Checkers from "@/components/games/Checkers";
import Blockade from "@/components/games/Blockade";
import Trivia from "@/components/games/Trivia";
import TypingRace from "@/components/games/TypingRace";
import { type ChatMessage } from "@/components/GameChat";
import GameLayout, { type GameLayoutLogEntry } from "@/components/game/GameLayout";
import GameResultOverlay from "@/components/game/GameResultOverlay";
import FirstMatchCelebration from "@/components/FirstMatchCelebration";
import type { MatchUiState } from "@/components/game/matchUi";
import { usePlayMode } from "@/contexts/PlayModeContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useToast } from "@/components/Toast";
import SettlementErrorScreen from "@/components/match/SettlementErrorScreen";
import { AnonymousWinClaimBanner } from "@/components/AnonymousWinClaim";
import AnonymousLossSettle from "@/components/AnonymousLossSettle";
import { getAnonymousGuestId, getOrCreateAnonymousToken } from "@/lib/qr-match";
import { pickOpponentName } from "@/lib/opponentNames";

const OPPONENT_RECONNECT_SEC = 60;

type Outcome = null | "victory" | "defeat" | "draw";
type ChatToastItem = { id: string; sender: string; message: string };
type MoveLogEntry = {
  player_id: string;
  action: Record<string, unknown>;
  timestamp_ms: number;
};

function toMoveAction(gameType: string, event: Record<string, unknown>): Record<string, unknown> | null {
  const type = event.type as string | undefined;
  if (!type) return null;
  if (gameType === "chess" && type === "chess_move") {
    return {
      type,
      san: event.san ?? null,
      from: event.from ?? null,
      to: event.to ?? null,
      promotion: event.promotion ?? null,
    };
  }
  if (gameType === "connect-4" && type === "connect4_move") {
    return { type, column: event.column ?? null };
  }
  if (gameType === "checkers" && type === "checkers_move") {
    const lm = event.lastMove as { from?: unknown; to?: unknown } | undefined;
    return { type, from: lm?.from ?? null, to: lm?.to ?? null };
  }
  if (gameType === "blockade" && type === "blockade_state") {
    return { type, turn: event.state?.currentTurn ?? null };
  }
  if (gameType === "trivia" && type === "trivia_answer") {
    return {
      type,
      question_number: typeof event.questionIndex === "number" ? (event.questionIndex as number) + 1 : null,
      answer_chosen: event.answerIndex ?? null,
      correct: event.correct ?? null,
    };
  }
  if (gameType === "typing-race" && type === "race_progress") {
    return {
      type,
      wpm: event.wpm ?? null,
      accuracy: event.accuracy ?? null,
      progress: event.progress ?? null,
    };
  }
  if (gameType === "typing-race" && type === "race_finish") {
    return {
      type,
      finishMs: event.finishMs ?? null,
      adjustedMs: event.adjustedMs ?? null,
      wpm: event.wpm ?? null,
      accuracy: event.accuracy ?? null,
    };
  }
  if (gameType === "memory-match" && type === "memory_flip") {
    return { type, card_index: event.cardIndex ?? null };
  }
  if (gameType === "spelling-bee" && type === "spelling_answer") {
    return {
      type,
      round: event.round ?? null,
      word_attempt: event.answer ?? null,
      time_ms: event.timeMs ?? null,
    };
  }
  if (gameType === "reaction-duel" && type === "reaction_result") {
    return {
      type,
      round: event.round ?? null,
      reaction_time_ms: event.reactionTime ?? null,
    };
  }
  return null;
}

function MatchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const matchId = (params?.id as string) || "";
  const opponentNameFromUrl = searchParams.get("opponent");
  const isGuestMode = searchParams.get("guest") === "1";
  const { isPractice } = usePlayMode();
  const { showToast } = useToast();

  const [username, setUsername] = useState<string>("Player");
  const [userId, setUserId] = useState<string>("");
  const [isQrGuest, setIsQrGuest] = useState(false);
  const [matchAvatars, setMatchAvatars] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [match, setMatch] = useState<StoredMatch | null>(null);
  const [timerNowMs, setTimerNowMs] = useState(Date.now());
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [resultTotals, setResultTotals] = useState<{
    payout: number;
    stakeLost: number;
    newBalance: number | null;
  } | null>(null);
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [forfeitConfirm, setForfeitConfirm] = useState(false);
  const [connectionCheckPassed, setConnectionCheckPassed] = useState(false);
  const [connectionCheckState, setConnectionCheckState] = useState<"checking" | "ok" | "warning" | "unrecommended">("checking");
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "poor" | "disconnected">("connecting");
  const [bothPlayersConfirmed, setBothPlayersConfirmed] = useState(false);
  const [opponentDisconnectedAt, setOpponentDisconnectedAt] = useState<number | null>(null);
  const [reconnectCountdown, setReconnectCountdown] = useState<number | null>(null);
  const [wonByForfeit, setWonByForfeit] = useState(false);
  const [incomingEvent, setIncomingEvent] = useState<Record<string, unknown> | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatToastQueue, setChatToastQueue] = useState<ChatToastItem[]>([]);
  const [activeChatToast, setActiveChatToast] = useState<ChatToastItem | null>(null);
  const [chatToastVisible, setChatToastVisible] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [matchUi, setMatchUi] = useState<MatchUiState | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportComment, setReportComment] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [moveLog, setMoveLog] = useState<MoveLogEntry[]>([]);
  /** Set to true when we receive an afk_forfeit event from the opponent. */
  const [afkForfeitPending, setAfkForfeitPending] = useState(false);
  const [preMatchCompletedCount, setPreMatchCompletedCount] = useState<number | null>(null);
  const [showFirstMatchCelebration, setShowFirstMatchCelebration] = useState(false);
  const [celebrationEarnedSkillies, setCelebrationEarnedSkillies] = useState(100);
  const forfeitHandledRef = useRef(false);
  const inProgressSetRef = useRef(false);
  const firstCelebrationTriggeredRef = useRef(false);
  const matchRef = useRef<StoredMatch | null>(null);
  const matchStartMsRef = useRef<number>(Date.now());
  const bothPlayersConfirmedRef = useRef(false);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  matchRef.current = match;
  bothPlayersConfirmedRef.current = bothPlayersConfirmed;

  // AFK ring display timer (shown to BOTH players on the active player's avatar).
  const afkTurnStartedAtMsRef = useRef<number | null>(null);
  const lastAfkTurnRef = useRef<"player1" | "player2" | null>(null);
  const [afkNowMs, setAfkNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!match?.matchStartTime) return;
    const ms = new Date(match.matchStartTime).getTime();
    if (Number.isFinite(ms)) matchStartMsRef.current = ms;
  }, [match?.matchStartTime]);

  const appendMoveLog = useCallback(
    (playerId: string, event: Record<string, unknown>) => {
      const current = matchRef.current;
      if (!current) return;
      const action = toMoveAction(current.gameType, event);
      if (!action) return;
      const timestamp_ms = Math.max(0, Date.now() - matchStartMsRef.current);
      setMoveLog((prev) => [...prev, { player_id: playerId, action, timestamp_ms }]);
    },
    []
  );

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
        if (!bothPlayersConfirmedRef.current) {
          return;
        }
        setOpponentDisconnectedAt((t) => (t === null ? Date.now() : t));
        return;
      }
      if (e.type === "afk_forfeit") {
        // Opponent forfeited due to AFK — mark pending so the effect below can fire
        // once myRole and handleGameEnd are in scope.
        setAfkForfeitPending(true);
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
          setChatToastQueue((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              sender: ev.senderName || "Opponent",
              message: ev.message as string,
            },
          ]);
          if (!chatOpen) {
            setUnreadCount((c) => c + 1);
          }
        }
        return;
      }
      appendMoveLog(
        typeof event.player_id === "string" ? (event.player_id as string) : "opponent",
        event as Record<string, unknown>
      );
      setIncomingEvent(event as Record<string, unknown>);
    },
  });

  useEffect(() => {
    async function load() {
      setLoadError(null);
      try {
        const guestId = isGuestMode ? getAnonymousGuestId() : null;
        const anonToken = isGuestMode ? getOrCreateAnonymousToken() : null;

        if (isGuestMode && anonToken) {
          setIsQrGuest(true);
          setUsername("Guest");
          setUserId(guestId ?? anonToken.slice(0, 36));
        } else if (guestId) {
          setIsQrGuest(true);
          setUsername("Guest");
          setUserId(guestId);
        } else {
          const user = await getCurrentUser();
          if (!user) {
            router.push("/login");
            return;
          }
          setUsername(user.username);
          setUserId(user.id);
          setIsDevMode(user.isDevMode ?? false);
          const supabase = createClient();
          if (supabase) {
            const { count: completedCount } = await supabase
              .from("matches")
              .select("id", { count: "exact", head: true })
              .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
              .eq("status", "completed");
            setPreMatchCompletedCount(completedCount ?? 0);
          }
        }

        const m =
          isGuestMode && anonToken
            ? await getQrGuestMatch(matchId, anonToken)
            : await getMatch(matchId);
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
        setMatch(m);
        if (isGuestMode) {
          setUsername(m.player2.username || "Guest Driver");
        }
        const playerIds = [m.player1Id, m.player2Id].filter((id): id is string => Boolean(id));
        const supabaseForProfiles = createClient();
        if (supabaseForProfiles && playerIds.length > 0) {
          const { data: profileRows } = await supabaseForProfiles
            .from("profiles")
            .select("id, avatar_url")
            .in("id", playerIds);
          const avatars: Record<string, string | null> = {};
          for (const row of profileRows ?? []) {
            avatars[row.id] = (row.avatar_url as string | null) ?? null;
          }
          setMatchAvatars(avatars);
        }
        setMoveLog(Array.isArray(m.moveLog) ? m.moveLog : []);
        const matchStartMs = m.matchStartTime ? new Date(m.matchStartTime).getTime() : NaN;
        const createdAtMs = new Date(m.createdAt).getTime();
        const fallbackMs = Number.isFinite(createdAtMs) ? createdAtMs : Date.now();
        matchStartMsRef.current = Number.isFinite(matchStartMs) ? matchStartMs : fallbackMs;

        // Fix 1 + 3: If the match is already completed (player refreshed the page,
        // closed and reopened the tab, or returned after a forfeit), derive the outcome
        // directly from the database record.  Never trust local React state for this.
        if (m.status === "completed") {
          // In practice / bot matches the current user is always player1.
          // In real-multiplayer matches resolve by comparing stored player IDs.
          const iAmPlayer1 = isGuestMode
            ? false
            : !m.isRealMultiplayer
              ? true
              : m.player1Id === userId;

          if (!m.winner) {
            setOutcome("draw");
          } else {
            const iWon =
              (m.winner === "player1" && iAmPlayer1) ||
              (m.winner === "player2" && !iAmPlayer1);
            setOutcome(iWon ? "victory" : "defeat");
          }
        }
      } catch (err) {
        console.error("Failed to load match:", err);
        setLoadError("Failed to load match. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [matchId, router, isGuestMode]);

  const isRealMultiplayerMatch = match?.isRealMultiplayer ?? false;
  const myRoleComputed: "player1" | "player2" =
    isQrGuest && match?.isQrMatch
      ? "player2"
      : isRealMultiplayerMatch && match?.player1Id && match.player1Id === userId
        ? "player1"
        : isRealMultiplayerMatch && match?.player2Id && match.player2Id === userId
          ? "player2"
          : "player1";
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
    if (!isRealMultiplayerMatch) {
      setBothPlayersConfirmed(false);
      return;
    }
    if (!connectionCheckPassed) return;
    if (realtimeConnected && opponentConnected) {
      setBothPlayersConfirmed(true);
    }
  }, [connectionCheckPassed, isRealMultiplayerMatch, opponentConnected, realtimeConnected]);

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
    const t = setInterval(() => setTimerNowMs(Date.now()), 250);
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
      setChatToastQueue((prev) => [
        ...prev,
        { id: crypto.randomUUID(), sender: senderName || "Player", message: text },
      ]);
    },
    [chatOpen, userId]
  );

  useEffect(() => {
    if (activeChatToast || chatToastQueue.length === 0) return;
    const [next, ...rest] = chatToastQueue;
    setChatToastQueue(rest);
    setActiveChatToast(next);
    setChatToastVisible(true);
  }, [chatToastQueue, activeChatToast]);

  useEffect(() => {
    if (!activeChatToast) return;
    const hideTimer = setTimeout(() => setChatToastVisible(false), 3000);
    const clearTimer = setTimeout(() => setActiveChatToast(null), 3350);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(clearTimer);
    };
  }, [activeChatToast]);

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
    const supabase = createClient();
    const startedAt = new Date().toISOString();
    const timeLimitMs = getMatchTimeLimitMs(match.gameType);

    if (!supabase) {
      apiUpdateMatch(matchId, {
        status: "in_progress",
        matchStartTime: startedAt,
        timeLimitMs,
        ...(match.gameType === "chess"
          ? {
              player1RemainingTimeMs: CHESS_INITIAL_CLOCK_MS,
              player2RemainingTimeMs: CHESS_INITIAL_CLOCK_MS,
              activeTurn: "player1" as const,
              turnStartedAt: startedAt,
            }
          : {}),
      }).catch(() => {});
      return;
    }

    supabase
      .from("matches")
      .update({
        status: "in_progress",
        match_start_time: startedAt,
        time_limit_ms: timeLimitMs,
        ...(match.gameType === "chess"
          ? {
              player1_remaining_time_ms: CHESS_INITIAL_CLOCK_MS,
              player2_remaining_time_ms: CHESS_INITIAL_CLOCK_MS,
              active_turn: "player1",
              turn_started_at: startedAt,
            }
          : {}),
      })
      .eq("id", matchId)
      .is("match_start_time", null)
      .select("match_start_time, time_limit_ms, player1_remaining_time_ms, player2_remaining_time_ms, active_turn, turn_started_at")
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setMatch((prev) =>
          prev
            ? {
                ...prev,
                matchStartTime: data.match_start_time ?? prev.matchStartTime,
                timeLimitMs: typeof data.time_limit_ms === "number" ? data.time_limit_ms : prev.timeLimitMs,
                player1RemainingTimeMs:
                  typeof data.player1_remaining_time_ms === "number"
                    ? data.player1_remaining_time_ms
                    : prev.player1RemainingTimeMs,
                player2RemainingTimeMs:
                  typeof data.player2_remaining_time_ms === "number"
                    ? data.player2_remaining_time_ms
                    : prev.player2RemainingTimeMs,
                activeTurn:
                  data.active_turn === "player1" || data.active_turn === "player2"
                    ? data.active_turn
                    : prev.activeTurn,
                turnStartedAt: data.turn_started_at ?? prev.turnStartedAt,
              }
            : prev
        );
      })
      .catch(() => {});
  }, [match, matchId, realtimeConnected, opponentConnected]);

  // Opponent disconnect: 30s countdown then forfeit win
  useEffect(() => {
    if (!match?.isRealMultiplayer || !bothPlayersConfirmed || forfeitHandledRef.current) return;
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
            setIsSettling(true);
            completeMatchAndSettle(m, "player1")
              .then((settlement) => {
                dispatchWalletUpdated();
                setResultTotals({
                  payout: settlement.payout,
                  stakeLost: m.stakeAmount,
                  newBalance: settlement.callerBalance,
                });
                setOutcome("victory");
                setIsSettling(false);
              })
              .catch((error) => {
                // eslint-disable-next-line no-console
                console.error("[MatchPage] Forfeit settlement failed", { matchId: m.id, error });
                setSettlementError(
                  "We couldn't finalize this match. Your stake is safe - refresh and check your balance. If anything looks off, contact support."
                );
                setIsSettling(false);
              });
          }
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [bothPlayersConfirmed, match?.isRealMultiplayer, opponentDisconnectedAt]);

  /**
   * Unified game end: winner is 'player1' or 'player2'.
   * Compare winner ID with current user to show the correct result to each player.
   * Only Player 1 persists the result (completeMatchAndSettle) to avoid double-writes.
   */
  const handleGameEnd = useCallback(
    async (winner: "player1" | "player2"): Promise<boolean> => {
      if (!match) return false;
      const winnerId = winner === "player1" ? match.player1Id : match.player2Id;
      const iWon = isQrGuest
        ? winner === "player2"
        : winnerId
          ? winnerId === userId
          : winner === "player1";

      if (isQrGuest) {
        setOutcome(iWon ? "victory" : "defeat");
        return true;
      }

      try {
        setIsSettling(true);
        const settlement = await completeMatchAndSettle(match, winner);
        dispatchWalletUpdated();
        if (iWon) {
          setResultTotals({
            payout: settlement.payout,
            stakeLost: match.stakeAmount,
            newBalance: settlement.callerBalance,
          });
        } else {
          setResultTotals({
            payout: settlement.payout,
            stakeLost: match.stakeAmount,
            newBalance: settlement.callerBalance,
          });
        }
        setOutcome(iWon ? "victory" : "defeat");
        setIsSettling(false);
        return true;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[MatchPage] Failed to persist match result", { matchId: match.id, winner, error });
        setSettlementError(
          "We couldn't finalize this match. Your stake is safe - refresh and check your balance. If anything looks off, contact support."
        );
        dispatchWalletUpdated();
        setIsSettling(false);
        return false;
      }
    },
    [match, userId, isQrGuest]
  );

  const handleWin = useCallback(() => handleGameEnd("player1"), [handleGameEnd]);
  const handleLoss = useCallback(() => handleGameEnd("player2"), [handleGameEnd]);

  const handleDraw = useCallback(async () => {
    if (!match) return;
    try {
      setIsSettling(true);
      const settlement = await completeMatchAndSettle(match, "draw");
      dispatchWalletUpdated();
      setResultTotals({
        payout: settlement.payout,
        stakeLost: match.stakeAmount,
        newBalance: settlement.callerBalance,
      });
      setOutcome("draw");
      setIsSettling(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[MatchPage] Failed to persist draw", { matchId: match.id, error });
      setSettlementError(
        "We couldn't finalize this match. Your stake is safe - refresh and check your balance. If anything looks off, contact support."
      );
      dispatchWalletUpdated();
      setIsSettling(false);
    }
  }, [match]);

  const handleForfeitConfirm = useCallback(async () => {
    if (match?.isRealMultiplayer && (match?.gameType === "chess" || match?.gameType === "connect-4")) {
      await sendGameEvent({ type: "resign" }).catch(() => {});
    }
    const settled = await handleGameEnd("player2");
    if (!settled) {
      setForfeitConfirm(false);
      return;
    }
    setForfeitConfirm(false);
    if (typeof window !== "undefined" && match) {
      window.location.href = `/play/${match.gameType}`;
    }
  }, [handleGameEnd, match, sendGameEvent]);

  // ── AFK forfeit triggered BY US (timer expired on our turn) ──────────────
  const handleAfkForfeit = useCallback(() => {
    if (forfeitHandledRef.current || !match) return;
    forfeitHandledRef.current = true;
    const opponentRole: "player1" | "player2" =
      myRoleComputed === "player1" ? "player2" : "player1";
    if (match.isRealMultiplayer) {
      // Notify opponent so they get the victory screen instantly.
      sendGameEvent({ type: "afk_forfeit" }).catch(() => {});
    }
    handleGameEnd(opponentRole)
      .then((settled) => {
        if (!settled) return;
        window.location.href = `/play/${match.gameType}`;
      })
      .catch(() => {
        window.location.href = `/play/${match.gameType}`;
      });
  }, [match, myRoleComputed, sendGameEvent, handleGameEnd]);

  // ── AFK forfeit triggered BY OPPONENT (we receive their afk_forfeit) ─────
  useEffect(() => {
    if (!afkForfeitPending || forfeitHandledRef.current || !match) return;
    setAfkForfeitPending(false);
    forfeitHandledRef.current = true;
    setWonByForfeit(true);
    handleGameEnd(myRoleComputed); // we are the winner
  }, [afkForfeitPending, match, myRoleComputed, handleGameEnd]);

  // ── AFK timer ─────────────────────────────────────────────────────────────
  const afkTimerEnabled =
    (match?.status === "in_progress") === true && !outcome;
  const isMyTurnNow =
    matchUi?.requiresAction === true &&
    matchUi?.currentTurn === myRoleComputed;

  const { secondsLeft: afkSecondsLeft, showWarning: afkShowWarning, resetTimer: afkResetTimer } =
    useAfkTimer({
      enabled: afkTimerEnabled,
      isMyTurn: isMyTurnNow ?? false,
      onForfeit: handleAfkForfeit,
    });

  // Keep a smooth clock for the ring display.
  useEffect(() => {
    if (!afkTimerEnabled) return;
    const t = setInterval(() => setAfkNowMs(Date.now()), 100);
    return () => clearInterval(t);
  }, [afkTimerEnabled]);

  // Reset the ring whenever the active turn changes.
  useEffect(() => {
    if (!afkTimerEnabled) return;
    const active = (matchUi?.currentTurn ?? null) as "player1" | "player2" | null;
    if (!active) return;
    if (lastAfkTurnRef.current === active) return;
    lastAfkTurnRef.current = active;
    afkTurnStartedAtMsRef.current = Date.now();
  }, [afkTimerEnabled, matchUi?.currentTurn]);

  const afkRemainingMs =
    afkTimerEnabled && afkTurnStartedAtMsRef.current !== null && matchUi?.currentTurn
      ? Math.max(0, AFK_TIMEOUT_SEC * 1000 - Math.max(0, afkNowMs - afkTurnStartedAtMsRef.current))
      : null;

  const handleTurnClockUpdate = useCallback(
    async (clock: {
      player1RemainingTimeMs: number;
      player2RemainingTimeMs: number;
      activeTurn: "player1" | "player2";
      turnStartedAt: string;
    }) => {
      if (!match?.isRealMultiplayer || match.gameType !== "chess") return;
      await apiUpdateMatch(match.id, clock);
      setMatch((prev) =>
        prev
          ? {
              ...prev,
              player1RemainingTimeMs: clock.player1RemainingTimeMs,
              player2RemainingTimeMs: clock.player2RemainingTimeMs,
              activeTurn: clock.activeTurn,
              turnStartedAt: clock.turnStartedAt,
            }
          : prev
      );
    },
    [match]
  );

  const handlePlayerAction = useCallback(() => {
    afkResetTimer();
  }, [afkResetTimer]);

  // Wrap sendGameEvent so any outbound move event also resets the AFK timer.
  const sendGameEventWithAfkReset = useCallback(
    async (event: Record<string, unknown>) => {
      afkResetTimer();
      const enriched = {
        ...event,
        player_id: userId || "unknown",
      };
      appendMoveLog(userId || "unknown", enriched);
      return sendGameEvent(enriched);
    },
    [sendGameEvent, afkResetTimer, userId, appendMoveLog]
  );

  useEffect(() => {
    if (!match || match.isPractice) return;
    if (!moveLog.length) return;
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(() => {
      apiUpdateMatch(match.id, { moveLog }).catch(() => {});
    }, 800);
    return () => {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    };
  }, [match, moveLog]);

  useEffect(() => {
    if (!outcome || !userId || !match) return;
    if (preMatchCompletedCount !== 0 || firstCelebrationTriggeredRef.current) return;

    let cancelled = false;

    async function maybeShowFirstMatchCelebration() {
      const supabase = createClient();
      if (!supabase) return;

      const { count: completedCount, error: countError } = await supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .eq("status", "completed");

      if (countError || cancelled || completedCount !== 1) return;

      const fallbackEarned = outcome === "victory" ? 100 : 25;
      let earnedSkillies = fallbackEarned;

      const { data: walletRows } = await supabase
        .from("transactions")
        .select("amount")
        .eq("user_id", userId)
        .in("type", ["match_win", "match_refund", "challenge_reward"])
        .ilike("description", `%match:${match.id}%`);

      if (walletRows && walletRows.length > 0) {
        const total = walletRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
        if (Number.isFinite(total) && total > 0) {
          earnedSkillies = total;
        }
      }

      if (cancelled) return;
      firstCelebrationTriggeredRef.current = true;
      setCelebrationEarnedSkillies(earnedSkillies);
      setShowFirstMatchCelebration(true);
    }

    void maybeShowFirstMatchCelebration();

    return () => {
      cancelled = true;
    };
  }, [outcome, preMatchCompletedCount, userId, match]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const { logout } = await import("@/lib/api");
      await logout();
    } catch {
      setLoggingOut(false);
    }
  }

  const handlePlayAgain = useCallback(() => {
    const fallbackGame = match?.gameType ?? "chess";
    const lastConfigJson = sessionStorage.getItem("lastMatchConfig");
    if (!lastConfigJson) {
      router.push(`/play/${fallbackGame}`);
      return;
    }

    try {
      const parsed = JSON.parse(lastConfigJson) as { game?: string; stake?: number };
      const rematchGame = parsed.game || fallbackGame;
      const rematchStake = Number(parsed.stake);
      if (!Number.isFinite(rematchStake)) {
        router.push(`/play/${rematchGame}`);
        return;
      }
      router.push(`/play/${rematchGame}?autostake=${Math.trunc(rematchStake)}`);
    } catch {
      router.push(`/play/${fallbackGame}`);
    }
  }, [match?.gameType, router]);

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
    return <LoadingRing />;
  }

  const safePlayer1 = match.player1 ?? { username: "Player 1", rating: 1000 };
  const safePlayer2 = match.player2 ?? { username: "Opponent", rating: 1000 };

  const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  const formatSkillies = (amount: number) => `${amount.toLocaleString()} Skillies`;
  const shortId = match.id.slice(0, 8);
  const myRole = myRoleComputed;
  const opponentDisplayName = opponentNameFromUrl?.trim() || pickOpponentName(matchId);
  const displayedPlayer1 =
    myRole === "player1" ? safePlayer1 : { ...safePlayer1, username: opponentDisplayName };
  const displayedPlayer2 =
    myRole === "player1" ? { ...safePlayer2, username: opponentDisplayName } : safePlayer2;
  const matchStartMs =
    typeof match.matchStartTime === "string" ? new Date(match.matchStartTime).getTime() : NaN;
  const effectiveMatchStartMs =
    Number.isFinite(matchStartMs) ? matchStartMs : new Date(match.createdAt).getTime();
  const timeLimitMs = match.timeLimitMs ?? getMatchTimeLimitMs(match.gameType);
  const timerSec =
    match.status === "in_progress"
      ? Math.max(0, Math.ceil((timeLimitMs - Math.max(0, timerNowMs - effectiveMatchStartMs)) / 1000))
      : 0;
  const opponentUsername = opponentDisplayName;
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
    "blockade",
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
    blockade: "Blockade",
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
      username: displayedPlayer1.username,
      avatar: match.player1Id ? matchAvatars[match.player1Id] ?? null : null,
      rating: displayedPlayer1.rating,
      score: matchUi?.scores.player1 ?? 0,
      scoreLabel: matchUi?.scoreLabel,
      isBot: false,
      timeLeftSec: matchUi?.playerTimeLeftSec?.player1,
    },
    player2: {
      username: displayedPlayer2.username,
      avatar: match.player2Id ? matchAvatars[match.player2Id] ?? null : null,
      rating: displayedPlayer2.rating,
      score: matchUi?.scores.player2 ?? 0,
      scoreLabel: matchUi?.scoreLabel,
      isBot: !isRealMultiplayer,
      timeLeftSec: matchUi?.playerTimeLeftSec?.player2,
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
    realStakeDisplay: match.isPractice ? undefined : formatSkillies(match.stakeAmount),
    afkRemainingMs,
    afkActivePlayer: !match.isPractice && afkRemainingMs !== null ? matchUi?.currentTurn ?? null : null,
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
      {isRealMultiplayer && bothPlayersConfirmed && opponentDisconnectedAt !== null && reconnectCountdown !== null && !outcome && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-charcoal/90 px-4">
          <p className="text-lg font-semibold text-amber-400">Opponent disconnected...</p>
          <p className="mt-2 text-body-gray">
            Waiting {reconnectCountdown}s for reconnection. If they don&apos;t return, you win by forfeit.
          </p>
        </div>
      )}

      {/* Connection quality: small indicator only when actually poor (no modal at start) */}
      {isRealMultiplayerMatch && bothPlayersConfirmed && match.status === "in_progress" && !outcome && connectionStatus === "poor" && (
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
      {isRealMultiplayerMatch && bothPlayersConfirmed && match.status === "in_progress" && !outcome && connectionStatus === "disconnected" && (
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

      {/* In-game chat toast (queued, one-at-a-time, 3s visible) */}
      {activeChatToast && (
        <div
          className={`pointer-events-none fixed left-1/2 z-[70] w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-white/10 bg-black/70 px-4 py-2.5 shadow-lg backdrop-blur-sm transition-all duration-300 ${
            chatToastVisible ? "top-3 opacity-100" : "-top-12 opacity-0"
          }`}
        >
          <p className="truncate text-xs font-semibold text-[#FFFF00]">{activeChatToast.sender}</p>
          <p className="truncate text-sm text-white/90">{activeChatToast.message}</p>
        </div>
      )}

      {/* Main: Chess and Connect 4 use full-width layout; Pool uses 3 columns */}
      {!waitingForOpponent && match.gameType === "chess" ? (
        <main className="mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden px-0 py-0">
          {match.status === "in_progress" && !outcome ? (
            <GameLayout {...gameLayoutProps}>
              <Chess
                player1={{ username: displayedPlayer1.username, rating: displayedPlayer1.rating }}
                player2={{ username: displayedPlayer2.username, rating: displayedPlayer2.rating }}
                onGameEnd={handleGameEnd}
                onGameDraw={handleDraw}
                isPlayer2Bot={!isRealMultiplayer}
                botDifficulty={match.botDifficulty ?? "gamer"}
                isMultiplayer={isRealMultiplayer}
                myRole={myRole}
                matchId={matchId}
                playerId={userId}
                player1Id={match.player1Id}
                player2Id={match.player2Id}
                sendGameEvent={sendGameEventWithAfkReset}
                onPlayerAction={handlePlayerAction}
                incomingEvent={incomingEvent}
                onEventProcessed={() => setIncomingEvent(null)}
                onMatchUi={setMatchUi}
                initialClockState={{
                  player1RemainingTimeMs: match.player1RemainingTimeMs,
                  player2RemainingTimeMs: match.player2RemainingTimeMs,
                  activeTurn: match.activeTurn,
                  turnStartedAt: match.turnStartedAt,
                }}
                onTurnClockUpdate={handleTurnClockUpdate}
              />
            </GameLayout>
          ) : null}
        </main>
      ) : !waitingForOpponent && match.gameType === "connect-4" ? (
        <main className="mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden px-0 py-0">
          {match.status === "in_progress" && !outcome ? (
            <GameLayout {...gameLayoutProps}>
              <ConnectFour
                player1={{ username: displayedPlayer1.username, rating: displayedPlayer1.rating }}
                player2={{ username: displayedPlayer2.username, rating: displayedPlayer2.rating }}
                onGameEnd={handleGameEnd}
                onGameDraw={handleDraw}
                isPlayer2Bot={!isRealMultiplayer}
                botDifficulty={match.botDifficulty ?? "gamer"}
                isMultiplayer={isRealMultiplayer}
                myRole={myRole}
                matchId={matchId}
                playerId={userId}
                player1Id={match.player1Id}
                player2Id={match.player2Id}
                sendGameEvent={sendGameEventWithAfkReset}
                onPlayerAction={handlePlayerAction}
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
                player1={{ username: displayedPlayer1.username, rating: displayedPlayer1.rating }}
                player2={{ username: displayedPlayer2.username, rating: displayedPlayer2.rating }}
                onGameEnd={handleGameEnd}
                onGameDraw={handleDraw}
                isPlayer2Bot={!isRealMultiplayer}
                botDifficulty={match.botDifficulty ?? "gamer"}
                isMultiplayer={isRealMultiplayer}
                myRole={myRole}
                matchId={matchId}
                playerId={userId}
                player1Id={match.player1Id}
                player2Id={match.player2Id}
                sendGameEvent={sendGameEventWithAfkReset}
                onPlayerAction={handlePlayerAction}
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
                player1={{ username: displayedPlayer1.username, rating: displayedPlayer1.rating }}
                player2={{ username: displayedPlayer2.username, rating: displayedPlayer2.rating }}
                onGameEnd={handleGameEnd}
                onGameDraw={handleDraw}
                isPlayer2Bot={!isRealMultiplayer}
                botDifficulty={match.botDifficulty ?? "gamer"}
                isPractice={match.isPractice}
                seed={matchId}
                isMultiplayer={isRealMultiplayer}
                myRole={myRole}
                matchId={matchId}
                playerId={userId}
                player1Id={match.player1Id}
                player2Id={match.player2Id}
                sendGameEvent={sendGameEventWithAfkReset}
                onPlayerAction={handlePlayerAction}
                incomingEvent={incomingEvent}
                onEventProcessed={() => setIncomingEvent(null)}
                onMatchUi={setMatchUi}
              />
            </GameLayout>
          ) : null}
        </main>
      ) : !waitingForOpponent && match.gameType === "blockade" ? (
        <main className="mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden px-0 py-0">
          {match.status === "in_progress" && !outcome ? (
            <GameLayout {...gameLayoutProps}>
              <Blockade
                player1={{ username: displayedPlayer1.username, rating: displayedPlayer1.rating }}
                player2={{ username: displayedPlayer2.username, rating: displayedPlayer2.rating }}
                onGameEnd={handleGameEnd}
                onGameDraw={handleDraw}
                isPlayer2Bot={!isRealMultiplayer}
                botDifficulty={match.botDifficulty ?? "gamer"}
                isMultiplayer={isRealMultiplayer}
                myRole={myRole}
                sendGameEvent={sendGameEventWithAfkReset}
                onPlayerAction={handlePlayerAction}
                incomingEvent={incomingEvent}
                onEventProcessed={() => setIncomingEvent(null)}
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
                player1={{ username: displayedPlayer1.username, rating: displayedPlayer1.rating }}
                player2={{ username: displayedPlayer2.username, rating: displayedPlayer2.rating }}
                onGameEnd={handleGameEnd}
                onGameDraw={handleDraw}
                isPlayer2Bot={!isRealMultiplayer}
                botDifficulty={match.botDifficulty ?? "gamer"}
                isMultiplayer={isRealMultiplayer}
                myRole={myRole}
                matchId={matchId}
                playerId={userId}
                player1Id={match.player1Id}
                player2Id={match.player2Id}
                sendGameEvent={sendGameEventWithAfkReset}
                onPlayerAction={handlePlayerAction}
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
                player1={{ username: displayedPlayer1.username, rating: displayedPlayer1.rating }}
                player2={{ username: displayedPlayer2.username, rating: displayedPlayer2.rating }}
                onGameEnd={handleGameEnd}
                onGameDraw={handleDraw}
                isPlayer2Bot={!isRealMultiplayer}
                botDifficulty={match.botDifficulty ?? "gamer"}
                isMultiplayer={isRealMultiplayer}
                myRole={myRole}
                matchId={matchId}
                playerId={userId}
                player1Id={match.player1Id}
                player2Id={match.player2Id}
                sendGameEvent={sendGameEventWithAfkReset}
                onPlayerAction={handlePlayerAction}
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
                player1={{ username: displayedPlayer1.username, rating: displayedPlayer1.rating }}
                player2={{ username: displayedPlayer2.username, rating: displayedPlayer2.rating }}
                onGameEnd={handleGameEnd}
                onGameDraw={handleDraw}
                isPlayer2Bot={!isRealMultiplayer}
                botDifficulty={match.botDifficulty ?? "gamer"}
                isMultiplayer={isRealMultiplayer}
                myRole={myRole}
                sendGameEvent={sendGameEventWithAfkReset}
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
                player1={{ username: displayedPlayer1.username, rating: displayedPlayer1.rating }}
                player2={{ username: displayedPlayer2.username, rating: displayedPlayer2.rating }}
                onGameEnd={handleGameEnd}
                onGameDraw={handleDraw}
                isPlayer2Bot={!isRealMultiplayer}
                botDifficulty={match.botDifficulty ?? "gamer"}
                isMultiplayer={isRealMultiplayer}
                myRole={myRole}
                sendGameEvent={sendGameEventWithAfkReset}
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
              player1={{ username: displayedPlayer1.username, rating: displayedPlayer1.rating }}
              player2={{ username: displayedPlayer2.username, rating: displayedPlayer2.rating }}
              onGameEnd={handleGameEnd}
              isPlayer2Bot={!isRealMultiplayer}
            />
          </div>
        </main>
      ) : !waitingForOpponent ? (
        <main className="mx-auto grid max-w-[1200px] grid-cols-1 gap-4 px-4 py-6 md:grid-cols-[1fr_2fr_1fr]">
          <div className="card-border rounded-card bg-card p-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-teal/40 to-purple/40 text-2xl font-bold text-white">
              {displayedPlayer1.username.charAt(0)}
            </div>
            <p className="mt-2 font-medium text-white">{displayedPlayer1.username}</p>
            <p className="text-xs text-body-gray">Rating {displayedPlayer1.rating}</p>
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
              {displayedPlayer2.username.charAt(0)}
            </div>
            <p className="mt-2 font-medium text-white">
              {displayedPlayer2.username}
            </p>
            <p className="text-xs text-body-gray">Rating {displayedPlayer2.rating}</p>
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
                : `Stake: ${formatSkillies(match.stakeAmount)} each • Winner gets: ${formatSkillies(match.winnerPayout)}`}
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

      {/* AFK warning banner — shown after 20s inactivity */}
      {afkShowWarning && !outcome && match.status === "in_progress" && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 border-t px-4 py-3 backdrop-blur-sm"
          style={{
            background: "rgba(185, 28, 28, 0.93)",
            borderColor: "rgba(239, 68, 68, 0.5)",
          }}
        >
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
            <p className="font-semibold text-white">
              ⚠ Make a move or you&apos;ll be kicked in {afkSecondsLeft}s
            </p>
            <div className="flex items-center gap-3">
              <div className="h-2 w-28 overflow-hidden rounded-full bg-red-950">
                <div
                  className="h-full bg-white/70 transition-all duration-1000 ease-linear"
                  style={{ width: `${((afkSecondsLeft ?? 0) / AFK_TIMEOUT_SEC) * 100}%` }}
                />
              </div>
              <span className="min-w-[2.5rem] font-mono text-sm font-bold text-white">
                {afkSecondsLeft}s
              </span>
            </div>
          </div>
        </div>
      )}

      {isSettling ? (
        <div className="fixed inset-0 z-[65] flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0E0E12]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FFFF00] border-t-transparent" />
          <p className="text-sm text-white/60">Finalizing result...</p>
        </div>
      ) : null}

      {/* Game result overlay — victory, defeat, or draw */}
      {outcome && !isQrGuest && (
        <GameResultOverlay
          outcome={outcome}
          isPractice={match.isPractice}
          stakeAmount={match.stakeAmount}
          winnerPayout={match.winnerPayout}
          payoutOverride={resultTotals?.payout}
          stakeLostOverride={resultTotals?.stakeLost}
          newBalance={resultTotals?.newBalance}
          gameType={match.gameType}
          opponentUsername={opponentUsername}
          wonByForfeit={wonByForfeit}
          onPlayAgain={handlePlayAgain}
          onLeave={() => { window.location.href = isQrGuest ? "/" : "/play"; }}
        />
      )}

      {isQrGuest && outcome === "victory" ? (
        <AnonymousWinClaimBanner
          amountSk={match.stakeAmount * 2}
          onSkip={() => {
            window.location.href = "/";
          }}
        />
      ) : null}

      {isQrGuest && outcome === "defeat" ? (
        <AnonymousLossSettle
          amountSk={match.stakeAmount}
          onSkip={() => {
            window.location.href = "/";
          }}
        />
      ) : null}

      {showFirstMatchCelebration ? (
        <FirstMatchCelebration
          earnedSkillies={celebrationEarnedSkillies}
          gameSlug={match.gameType}
          onClose={() => setShowFirstMatchCelebration(false)}
        />
      ) : null}

      {settlementError ? (
        <SettlementErrorScreen
          message={settlementError}
          onRefresh={() => window.location.reload()}
          onContinue={() => {
            setSettlementError(null);
            window.location.href = "/play";
          }}
        />
      ) : null}

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
                : `Are you sure you want to forfeit? You will lose your ${formatSkillies(match.stakeAmount)} stake.`}
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
      <Suspense>
        <MatchPageContent />
      </Suspense>
    </ErrorBoundary>
  );
}
