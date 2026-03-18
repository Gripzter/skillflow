"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameMultiplayerProps } from "./Chess";
import { createInitialBoard, getCaptureStepsFrom, getGameWinnerOrDraw, getLegalTurnMoves, getMustCapture, getPiecesWithCaptures, getRegularStepsFrom, applyStep, opposite, posToAlgebraic, type Board, type Player, type Pos, type Step, type TurnMove } from "@/lib/games/checkers-logic";
import { getCheckersBotDelayMs, getCheckersBotTurnMove } from "@/lib/games/checkers-bot";
import type { BotDifficulty } from "@/lib/games/bot-engine";
import Link from "next/link";

export interface CheckersChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  isPreset: boolean;
  timestamp: number;
  reported: boolean;
}

const BOARD_LIGHT = "#1A1A22";
const BOARD_DARK = "#242430";
const BOARD_BORDER = "#2A3A5C";

const P1 = "#FF5E00";
const P2 = "#C8C8D4";
const KING_GOLD = "#FFD700";

const ACCENT_ORANGE = "#FF5E00";
const ACCENT_PURPLE = "#A855F7";

function filterProfanity(text: string): string {
  // Same lightweight filter as `GameChat`, kept local to avoid UI coupling.
  const bad = /\b(shit|damn|hell|ass|fuck|fck|fuk|crap|wtf)\b/gi;
  return text.replace(bad, (match) => "*".repeat(match.length));
}

function formatPieceCodeToDisplay(piece: number): string {
  if (piece === 1) return "●";
  if (piece === 2) return "◆";
  if (piece === -1) return "○";
  if (piece === -2) return "◇";
  return "";
}

function getMyTurn(myRole: "player1" | "player2", currentTurn: Player): boolean {
  return (myRole === "player1" && currentTurn === 1) || (myRole === "player2" && currentTurn === 2);
}

function winnerRoleFromPlayer(p: Player): "player1" | "player2" {
  return p === 1 ? "player1" : "player2";
}

function getBotName(isPlayer2Bot: boolean, player2Username: string): string {
  return isPlayer2Bot ? `${player2Username} 🤖` : player2Username;
}

type ChatPanelProps = {
  enabled: boolean;
  isPractice: boolean;
  messages: CheckersChatMessage[];
  onSend: (message: string, isPreset: boolean) => void;
  onReport: (messageId: string) => void;
  playerName: string;
  opponentName: string;
  playerId: string;
};

function ChatPanel({
  enabled,
  isPractice,
  messages,
  onSend,
  playerName,
  opponentName,
}: ChatPanelProps) {
  const accent = isPractice ? ACCENT_PURPLE : ACCENT_ORANGE;
  const accentDim = isPractice ? "rgba(168,85,247,0.25)" : "rgba(255,94,0,0.25)";

  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);

  const presets = useMemo(
    () => [
      { label: "Good luck!", value: "Good luck!" },
      { label: "Nice move!", value: "Nice move!" },
      { label: "Your turn!", value: "Your turn!" },
      { label: "Well played.", value: "Well played." },
    ],
    []
  );

  useEffect(() => {
    if (!enabled) return;
    if (!logRef.current) return;
    if (!atBottomRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, enabled]);

  const handleSend = useCallback(
    (text: string, isPreset: boolean) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (trimmed.length > 200) return;
      const filtered = filterProfanity(trimmed);
      onSend(filtered, isPreset);
      setInput("");
    },
    [onSend]
  );

  if (!enabled) return null;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="sticky top-0 z-10 border-b border-[#2A3A5C] bg-[#1A1A22]/90 px-4 py-3">
        <h3 className="text-sm font-bold text-white">Chat</h3>
      </div>

      <div
        ref={logRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
        }}
      >
        {messages.length === 0 ? (
          <p className="py-2 text-xs text-[#7A7A8E]">No messages yet.</p>
        ) : (
          messages.map((m) => {
            const isMine = m.senderName === playerName;
            const bubbleBorder = isMine ? accent : "rgba(255,255,255,0.12)";
            const bubbleBg = isMine ? accentDim : "rgba(255,255,255,0.03)";
            return (
              <div
                key={m.id}
                className="mb-2 flex"
                style={{
                  justifyContent: isMine ? "flex-end" : "flex-start",
                }}
              >
                <div
                  className="rounded-xl border px-3 py-2"
                  style={{
                    maxWidth: "85%",
                    background: bubbleBg,
                    borderColor: bubbleBorder,
                  }}
                >
                  <div className="text-[11px] font-semibold text-white/90">
                    {isMine ? playerName : opponentName}
                    {m.isPreset ? <span className="ml-2 text-[10px] text-white/60">(preset)</span> : null}
                  </div>
                  <div className="mt-0.5 text-[13px] text-white/90">{m.message}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-[#2A3A5C] bg-[#1A1A22] px-4 py-3">
        <div className="mb-2 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleSend(p.value, true)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-semibold text-white hover:bg-white/10"
              style={{ borderColor: accentDim }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend(input, false);
            }}
            placeholder="Type a message..."
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-[#E5E7EB] placeholder:text-[#4B5563] focus:outline-none"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          />
          <button
            type="button"
            onClick={() => handleSend(input, false)}
            disabled={!input.trim()}
            className="rounded-lg px-3 py-2 text-[13px] font-semibold disabled:opacity-40"
            style={{ background: "transparent", border: `1px solid ${accentDim}`, color: "white" }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

type LogEntry = { id: string; side: Player; message: string };

export interface CheckersProps extends GameMultiplayerProps {
  player1: { username: string; rating: number };
  player2: { username: string; rating: number };
  onGameEnd: (winner: "player1" | "player2") => void;
  onGameDraw: () => void;
  isPlayer2Bot?: boolean;
  botDifficulty?: BotDifficulty;

  // UI extras for the right panel
  isPractice?: boolean;
  chatEnabled?: boolean;
  chatMessages?: CheckersChatMessage[];
  onSendChatMessage?: (message: string, isPreset: boolean) => void;
  onReportChatMessage?: (messageId: string) => void;
  playerId?: string;
}

export default function Checkers({
  player1,
  player2,
  onGameEnd,
  onGameDraw,
  isPlayer2Bot = true,
  botDifficulty = "gamer",
  isMultiplayer = false,
  myRole = "player1",
  sendGameEvent,
  incomingEvent,
  onEventProcessed,
  isPractice = false,
  chatEnabled = false,
  chatMessages = [],
  onSendChatMessage,
  onReportChatMessage,
  playerId = "",
}: CheckersProps) {
  const [board, setBoard] = useState<Board>(() => createInitialBoard());
  const [currentTurn, setCurrentTurn] = useState<Player>(1);
  const [selected, setSelected] = useState<Pos | null>(null);
  const [chainActive, setChainActive] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: Pos; to: Pos } | null>(null);
  const [noProgressCount, setNoProgressCount] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [winnerP1OrP2, setWinnerP1OrP2] = useState<"player1" | "player2" | "draw" | null>(null);

  const gameOverRef = useRef(false);
  const lastProcessedEventRef = useRef<Record<string, unknown> | null>(null);
  const lastSentMoveIdRef = useRef<string | null>(null);

  // Timer for active player (humans only; practice bot doesn't need it).
  const [timerSec, setTimerSec] = useState(30);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutHandledRef = useRef(false);

  // Accumulate meta across a whole turn (multi-jumps).
  const turnMetaRef = useRef<{ didCapture: boolean; didKing: boolean; capturedCount: number; finalTo: Pos | null }>(
    { didCapture: false, didKing: false, capturedCount: 0, finalTo: null }
  );

  const isMyTurn = getMyTurn(myRole, currentTurn);
  const mustCapture = useMemo(() => {
    if (gameOverRef.current) return false;
    return getMustCapture(board, currentTurn);
  }, [board, currentTurn]);

  const piecesWithCaptures = useMemo(() => {
    if (!mustCapture || chainActive) return [];
    return getPiecesWithCaptures(board, currentTurn);
  }, [board, currentTurn, mustCapture, chainActive]);

  const legalStepsFromSelected = useMemo(() => {
    if (!selected) return [];
    if (chainActive) {
      return getCaptureStepsFrom(board, selected, currentTurn);
    }
    if (mustCapture) {
      return getCaptureStepsFrom(board, selected, currentTurn);
    }
    return getRegularStepsFrom(board, selected, currentTurn);
  }, [board, selected, currentTurn, chainActive, mustCapture]);

  const validDestinations = useMemo(() => new Set(legalStepsFromSelected.map((s) => `${s.to.r},${s.to.c}`)), [legalStepsFromSelected]);

  const p1Captured = useMemo(() => 12 - getPiecesRemaining(board, 1), [board]);
  const p2Captured = useMemo(() => 12 - getPiecesRemaining(board, 2), [board]);

  function getPiecesRemaining(b: Board, p: Player): number {
    // Local helper (engine already has piece counting, but not exported).
    let n = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = b[r][c];
        if (p === 1 && (piece === 1 || piece === 2)) n++;
        if (p === 2 && (piece === -1 || piece === -2)) n++;
      }
    }
    return n;
  }

  function getForwardAccent(): string {
    return isPractice ? ACCENT_PURPLE : ACCENT_ORANGE;
  }

  // Reset per-turn meta when the turn changes.
  useEffect(() => {
    turnMetaRef.current = { didCapture: false, didKing: false, capturedCount: 0, finalTo: null };
    setSelected(null);
    setChainActive(false);
    setLastMove((prev) => prev); // keep as-is
    timeoutHandledRef.current = false;
  }, [currentTurn]);

  // Start timer when it's this client's turn (real multiplayer: humans only).
  useEffect(() => {
    if (gameOverRef.current) return;
    if (!isMyTurn) return;
    if (!isMultiplayer && isPlayer2Bot && currentTurn === 2) return; // bot's turn in practice

    // Reset timer.
    setTimerSec(30);

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setTimerSec((s) => s - 1);
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    };
  }, [currentTurn, isMyTurn, isMultiplayer, isPlayer2Bot]);

  useEffect(() => {
    if (!isMyTurn) return;
    if (gameOverRef.current) return;
    if (!timeoutHandledRef.current && timerSec <= 0) {
      timeoutHandledRef.current = true;
      const winner: "player1" | "player2" = myRole === "player1" ? "player2" : "player1";
      // Notify opponent so they end too.
      if (isMultiplayer && sendGameEvent) {
        const eventId = crypto.randomUUID();
        lastSentMoveIdRef.current = eventId;
        sendGameEvent({ type: "checkers_timeout", moveId: eventId, byRole: myRole }).catch(() => {});
      }
      gameOverRef.current = true;
      setWinnerP1OrP2(winner === "player1" ? "player1" : "player2");
      onGameEnd(winner);
    }
  }, [timerSec, isMyTurn, gameOverRef, myRole, isMultiplayer, sendGameEvent, onGameEnd]);

  const applyTurnEnd = useCallback(
    async (nextBoard: Board, nextTurn: Player, lastStepFrom: Pos, lastStepTo: Pos, moveMeta: { didCapture: boolean; didKing: boolean; capturedCount: number }, turnLogText: string, moveId?: string, nextNoProgress?: number) => {
      const nextNoProgressCount =
        typeof nextNoProgress === "number" ? nextNoProgress : moveMeta.didCapture || moveMeta.didKing ? 0 : noProgressCount + 1;

      const end = getGameWinnerOrDraw(nextBoard, nextNoProgressCount);
      setBoard(nextBoard);
      setCurrentTurn(nextTurn);
      setLastMove({ from: lastStepFrom, to: lastStepTo });
      setNoProgressCount(nextNoProgressCount);
      setSelected(null);
      setChainActive(false);

      // Log the move (local).
      setLog((prev) => [
        ...prev,
        { id: crypto.randomUUID(), side: moveMeta.didCapture ? (currentTurn as Player) : (currentTurn as Player), message: turnLogText },
      ]);

      if (end?.kind === "win") {
        const winnerRole = winnerRoleFromPlayer(end.winner);
        setWinnerP1OrP2(winnerRole);
        gameOverRef.current = true;
        // If we are in a multiplayer match, rely on game settlement, but log a win entry locally too.
        const winnerName = end.winner === 1 ? player1.username : player2.username;
        setLog((prev) => [...prev, { id: crypto.randomUUID(), side: end.winner, message: `${winnerName} wins!` }]);
        onGameEnd(winnerRole);
        return;
      }

      if (end?.kind === "draw") {
        setWinnerP1OrP2("draw");
        gameOverRef.current = true;
        setLog((prev) => [...prev, { id: crypto.randomUUID(), side: currentTurn, message: "Draw!" }]);
        onGameDraw();
        return;
      }

      // Broadcast turn end for real multiplayer.
      if (isMultiplayer && sendGameEvent) {
        const payloadMoveId = moveId ?? crypto.randomUUID();
        lastSentMoveIdRef.current = payloadMoveId;
        sendGameEvent({
          type: "checkers_move",
          moveId: payloadMoveId,
          byRole: myRole,
          board: nextBoard,
          currentTurn: nextTurn,
          lastMove: { from: lastStepFrom, to: lastStepTo },
          noProgressCount: nextNoProgressCount,
          logText: turnLogText,
          moveMeta,
          didWin: false,
          didDraw: false,
        }).catch(() => {});
      }
    },
    [currentTurn, noProgressCount, isMultiplayer, sendGameEvent, onGameEnd, onGameDraw, myRole, player1.username, player2.username]
  );

  // Incoming multiplayer events.
  useEffect(() => {
    if (!incomingEvent || !onEventProcessed) return;
    if (incomingEvent === lastProcessedEventRef.current) return;
    const type = incomingEvent.type as string | undefined;
    if (!type) return;

    if (type === "checkers_timeout") {
      lastProcessedEventRef.current = incomingEvent;
      if (!gameOverRef.current) {
        gameOverRef.current = true;
        setWinnerP1OrP2(myRole);
        onGameEnd(myRole);
      }
      onEventProcessed();
      return;
    }

    if (type === "checkers_resign") {
      lastProcessedEventRef.current = incomingEvent;
      if (!gameOverRef.current) {
        gameOverRef.current = true;
        setWinnerP1OrP2(myRole);
        onGameEnd(myRole);
      }
      onEventProcessed();
      return;
    }

    if (type === "checkers_move") {
      lastProcessedEventRef.current = incomingEvent;
      const payload = incomingEvent as any;
      if (payload?.moveId && payload.moveId === lastSentMoveIdRef.current) {
        onEventProcessed();
        return;
      }

      const nextBoard = payload.board as Board | undefined;
      const nextTurn = payload.currentTurn as Player | undefined;
      const nextNoProgress = typeof payload.noProgressCount === "number" ? payload.noProgressCount : 0;
      const lm = payload.lastMove as { from: Pos; to: Pos } | undefined;
      const logText = typeof payload.logText === "string" ? payload.logText : null;

      if (!nextBoard || !nextTurn) {
        onEventProcessed();
        return;
      }

      setBoard(nextBoard);
      setCurrentTurn(nextTurn);
      setNoProgressCount(nextNoProgress);
      setSelected(null);
      setChainActive(false);
      if (lm?.from && lm?.to) setLastMove({ from: lm.from, to: lm.to });
      if (logText) {
        // Actor side is inferred from the turn completion (we only receive the currentTurn after the move).
        const movedBy: Player = nextTurn === 1 ? 2 : 1;
        setLog((prev) => [...prev, { id: crypto.randomUUID(), side: movedBy, message: logText }]);
      }

      // End conditions.
      const end = getGameWinnerOrDraw(nextBoard, nextNoProgress);
      if (end?.kind === "win") {
        const winnerRole = winnerRoleFromPlayer(end.winner);
        setWinnerP1OrP2(winnerRole);
        gameOverRef.current = true;
        const winnerName = end.winner === 1 ? player1.username : player2.username;
        setLog((prev) => [...prev, { id: crypto.randomUUID(), side: end.winner, message: `${winnerName} wins!` }]);
        onGameEnd(winnerRole);
      } else if (end?.kind === "draw") {
        setWinnerP1OrP2("draw");
        gameOverRef.current = true;
        setLog((prev) => [...prev, { id: crypto.randomUUID(), side: 1, message: "Draw!" }]);
        onGameDraw();
      }

      onEventProcessed();
    }
  }, [incomingEvent, onEventProcessed, myRole, onGameEnd, onGameDraw]);

  // Local bot logic (practice mode).
  useEffect(() => {
    if (isMultiplayer) return;
    if (!isPlayer2Bot) return;
    if (currentTurn !== 2) return;
    if (gameOverRef.current) return;
    if (timerIntervalRef.current) {
      // Bot doesn't use the timer; stop any stray interval.
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    let cancelled = false;
    const delay = getCheckersBotDelayMs(botDifficulty);
    const t = setTimeout(() => {
      if (cancelled) return;

      const turnMoves = getLegalTurnMoves(board, 2);
      if (turnMoves.length === 0) {
        gameOverRef.current = true;
        setWinnerP1OrP2("player1");
        onGameEnd("player1");
        return;
      }

      const chosen = getCheckersBotTurnMove(board, 2, botDifficulty);
      if (!chosen) {
        gameOverRef.current = true;
        setWinnerP1OrP2("player1");
        onGameEnd("player1");
        return;
      }

      // Execute chosen move step-by-step locally.
      let b = board;
      let didCapture = false;
      let didKing = false;
      let capturedCount = 0;
      let lastFrom = chosen.start;
      let lastTo = chosen.end;

      for (const step of chosen.steps) {
        const applied = applyStep(b, step, 2);
        b = applied.board;
        if (step.type === "capture") {
          didCapture = true;
          capturedCount += 1;
        }
        didKing = didKing || applied.didKing;
        lastFrom = step.from;
        lastTo = step.to;
      }

      const playerName = getBotName(isPlayer2Bot, player2.username);
      let logText = "";
      if (didCapture) {
        logText = capturedCount > 1 ? `${playerName} captured ${capturedCount} pieces` : `${playerName} captured opponent's piece`;
        if (didKing) logText += ` and got a King!`;
      } else {
        logText = `${playerName} moved piece to ${posToAlgebraic(lastTo)}`;
        if (didKing) logText += ` and got a King!`;
      }

      const nextTurn: Player = 1;
      const nextNoProgressCount = didCapture || didKing ? 0 : noProgressCount + 1;
      const end = getGameWinnerOrDraw(b, nextNoProgressCount);
      setLog((prev) => [
        ...prev,
        { id: crypto.randomUUID(), side: 2, message: logText },
      ]);

      if (end?.kind === "win") {
        gameOverRef.current = true;
        setWinnerP1OrP2("player2");
        setBoard(b);
        setCurrentTurn(1);
        setNoProgressCount(nextNoProgressCount);
        setLastMove({ from: lastFrom, to: lastTo });
        const winnerName = player2.username;
        setLog((prev) => [...prev, { id: crypto.randomUUID(), side: 2, message: `${winnerName} wins!` }]);
        onGameEnd("player2");
      } else if (end?.kind === "draw") {
        gameOverRef.current = true;
        setWinnerP1OrP2("draw");
        setBoard(b);
        setCurrentTurn(1);
        setNoProgressCount(nextNoProgressCount);
        setLastMove({ from: lastFrom, to: lastTo });
        setLog((prev) => [...prev, { id: crypto.randomUUID(), side: 1, message: "Draw!" }]);
        onGameDraw();
      } else {
        setBoard(b);
        setCurrentTurn(nextTurn);
        setNoProgressCount(nextNoProgressCount);
        setLastMove({ from: lastFrom, to: lastTo });
      }
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [currentTurn, isMultiplayer, isPlayer2Bot, botDifficulty, board, noProgressCount, onGameEnd, onGameDraw, player2.username]);

  const handleSquareClick = useCallback(
    (pos: Pos) => {
      if (gameOverRef.current) return;
      if (!isMyTurn) return;

      const piece = board[pos.r][pos.c];
      const pieceOwner: Player | null = piece === 1 || piece === 2 ? 1 : piece === -1 || piece === -2 ? 2 : null;
      const isOwnPiece = pieceOwner === currentTurn;

      // If chain is active, only allow capture destinations for the selected piece.
      if (chainActive) {
        if (!selected) return;
        const key = `${pos.r},${pos.c}`;
        if (!validDestinations.has(key)) return;
        const step = legalStepsFromSelected.find((s) => s.type === "capture" && s.to.r === pos.r && s.to.c === pos.c) as
          | (Extract<Step, { type: "capture" }>)
          | undefined;
        if (!step || step.type !== "capture") return;

        const applied = applyStep(board, step, currentTurn);
        setBoard(applied.board);
        setLastMove({ from: step.from, to: step.to });

        turnMetaRef.current.didCapture = true;
        turnMetaRef.current.capturedCount += 1;
        turnMetaRef.current.didKing = turnMetaRef.current.didKing || applied.didKing;
        turnMetaRef.current.finalTo = step.to;

        const more = getCaptureStepsFrom(applied.board, step.to, currentTurn);
        if (more.length > 0) {
          setSelected(step.to);
          setChainActive(true);
          return;
        }

        // Turn ends after final jump.
        const didCapture = true;
        const didKing = turnMetaRef.current.didKing;
        const finalTo = turnMetaRef.current.finalTo ?? step.to;

        const playerName = currentTurn === 1 ? player1.username : player2.username;
        const captureText = turnMetaRef.current.capturedCount > 1 ? `${playerName} captured ${turnMetaRef.current.capturedCount} pieces` : `${playerName} captured opponent's piece`;
        const kingText = didKing ? ` and got a King!` : "";
        const turnLogText = captureText + kingText;

        const nextTurn = opposite(currentTurn);
        const nextNoProgressCount = didCapture || didKing ? 0 : noProgressCount + 1;
        applyTurnEnd(
          applied.board,
          nextTurn,
          step.from,
          finalTo,
          { didCapture, didKing, capturedCount: turnMetaRef.current.capturedCount },
          turnLogText,
          undefined,
          nextNoProgressCount
        );

        return;
      }

      // If no piece is selected yet, selecting is allowed if legal.
      if (!selected) {
        if (!isOwnPiece) return;
        if (mustCapture && getCaptureStepsFrom(board, pos, currentTurn).length === 0) return;
        setSelected(pos);
        return;
      }

      // Allow selecting a different own piece (only if it doesn't violate must-capture rules).
      if (isOwnPiece) {
        if (mustCapture) {
          const caps = getCaptureStepsFrom(board, pos, currentTurn);
          if (caps.length === 0) return;
        }
        setSelected(pos);
        return;
      }

      // Otherwise, try to move to a highlighted destination.
      const key = `${pos.r},${pos.c}`;
      if (!validDestinations.has(key)) return;

      const step = legalStepsFromSelected.find((s) => s.to.r === pos.r && s.to.c === pos.c);
      if (!step) return;

      if (step.type === "regular") {
        const applied = applyStep(board, step, currentTurn);
        const didKing = applied.didKing;
        const didCapture = false;

        const playerName = currentTurn === 1 ? player1.username : player2.username;
        const turnLogText = `${playerName} moved piece to ${posToAlgebraic(step.to)}${didKing ? " and got a King!" : ""}`;

        const nextTurn = opposite(currentTurn);
        const nextNoProgressCount = didCapture || didKing ? 0 : noProgressCount + 1;

        applyTurnEnd(
          applied.board,
          nextTurn,
          step.from,
          step.to,
          { didCapture, didKing, capturedCount: 0 },
          turnLogText,
          undefined,
          nextNoProgressCount
        );
        return;
      }

      if (step.type === "capture") {
        const applied = applyStep(board, step, currentTurn);
        setBoard(applied.board);
        setLastMove({ from: step.from, to: step.to });
        turnMetaRef.current.didCapture = true;
        turnMetaRef.current.capturedCount += 1;
        turnMetaRef.current.didKing = turnMetaRef.current.didKing || applied.didKing;
        turnMetaRef.current.finalTo = step.to;

        const more = getCaptureStepsFrom(applied.board, step.to, currentTurn);
        if (more.length > 0) {
          setSelected(step.to);
          setChainActive(true);
          return;
        }

        const didCapture = true;
        const didKing = turnMetaRef.current.didKing;
        const finalTo = turnMetaRef.current.finalTo ?? step.to;

        const playerName = currentTurn === 1 ? player1.username : player2.username;
        const captureText =
          turnMetaRef.current.capturedCount > 1
            ? `${playerName} captured ${turnMetaRef.current.capturedCount} pieces`
            : `${playerName} captured opponent's piece`;
        const kingText = didKing ? ` and got a King!` : "";
        const turnLogText = captureText + kingText;

        const nextTurn = opposite(currentTurn);
        const nextNoProgressCount = didCapture || didKing ? 0 : noProgressCount + 1;

        applyTurnEnd(
          applied.board,
          nextTurn,
          step.from,
          finalTo,
          { didCapture, didKing, capturedCount: turnMetaRef.current.capturedCount },
          turnLogText,
          undefined,
          nextNoProgressCount
        );
      }
    },
    [
      board,
      chainActive,
      selected,
      currentTurn,
      isMyTurn,
      mustCapture,
      validDestinations,
      legalStepsFromSelected,
      noProgressCount,
      player1.username,
      player2.username,
      applyTurnEnd,
    ]
  );

  const accent = isPractice ? ACCENT_PURPLE : ACCENT_ORANGE;
  const validDotColor = isPractice ? "rgba(168,85,247,0.3)" : "rgba(255,94,0,0.3)";
  const mandatoryGlow = isPractice ? "rgba(168,85,247,0.25)" : "rgba(255,94,0,0.25)";
  const mandatoryGlow2 = isPractice ? "rgba(168,85,247,0.18)" : "rgba(255,94,0,0.18)";
  const lastMoveGlow = "rgba(42,58,92,0.18)";
  const boardSideBackground = "#1A1A22";

  const myName = myRole === "player1" ? player1.username : player2.username;
  const opponentName = myRole === "player1" ? player2.username : player1.username;

  const sideCardAccent = isPractice ? "rgba(168,85,247,0.45)" : "rgba(255,94,0,0.45)";
  const sideCardBorder = isMyTurn ? sideCardAccent : "rgba(255,255,255,0.08)";

  // Derived highlights.
  const mandatoryCaptureKeySet = useMemo(() => new Set(piecesWithCaptures.map((p) => `${p.r},${p.c}`)), [piecesWithCaptures]);
  const lastFromKey = lastMove ? `${lastMove.from.r},${lastMove.from.c}` : null;
  const lastToKey = lastMove ? `${lastMove.to.r},${lastMove.to.c}` : null;

  // UI helpers.
  const activeText = currentTurn === 1 ? "Your Turn" : "Opponent's Turn";
  const showTurnText = isMyTurn ? "Your Turn" : "Opponent's Turn";

  // Board sizing.
  const cellMin = 40;

  const selectedPieceCode = selected ? board[selected.r][selected.c] : 0;
  const selectedIsKing = selected ? Math.abs(selectedPieceCode) === 2 : false;

  const gameLogEnabled = true;

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row lg:gap-4">
      {/* Left: board + turn info */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:pr-0">
        <div className="flex items-start justify-between gap-3 px-2 pb-2 pt-1 lg:px-4">
          <div
            className="flex-1 rounded-lg border px-3 py-2"
            style={{
              background: "rgba(255,255,255,0.03)",
              borderColor: currentTurn === 1 ? (isMyTurn ? accent : "rgba(255,255,255,0.08)") : "rgba(255,255,255,0.08)",
              boxShadow: currentTurn === 1 && isMyTurn ? `0 0 22px ${isPractice ? "rgba(168,85,247,0.2)" : "rgba(255,94,0,0.2)"}` : undefined,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-white">{player1.username}</div>
              <div className="text-xs text-body-gray">Captured: {p1Captured}</div>
            </div>
            <div className="mt-1 text-xs text-body-gray">
              {currentTurn === 1 ? (
                <span style={{ color: accent, fontWeight: 700 }}>● Turn</span>
              ) : (
                <span style={{ color: "rgba(255,255,255,0.45)" }}>Waiting</span>
              )}
            </div>
          </div>

          <div className="hidden lg:block" />

          <div
            className="flex-1 rounded-lg border px-3 py-2"
            style={{
              background: "rgba(255,255,255,0.03)",
              borderColor: currentTurn === 2 ? (!isMyTurn ? accent : "rgba(255,255,255,0.08)") : "rgba(255,255,255,0.08)",
              boxShadow: currentTurn === 2 && !isMyTurn ? `0 0 22px ${isPractice ? "rgba(168,85,247,0.2)" : "rgba(255,94,0,0.2)"}` : undefined,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-white">
                {player2.username}
                {isPlayer2Bot && !isMultiplayer ? <span className="ml-2 text-xs text-body-gray">(BOT)</span> : null}
              </div>
              <div className="text-xs text-body-gray">Captured: {p2Captured}</div>
            </div>
            <div className="mt-1 text-xs text-body-gray">
              {currentTurn === 2 ? (
                <span style={{ color: accent, fontWeight: 700 }}>● Turn</span>
              ) : (
                <span style={{ color: "rgba(255,255,255,0.45)" }}>Waiting</span>
              )}
            </div>
          </div>
        </div>

        <div className="px-2 pb-3 lg:px-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">{showTurnText}</p>
            {isMyTurn && (isMultiplayer || !isPlayer2Bot || currentTurn !== 2) ? (
              <div className="rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: "rgba(255,255,255,0.10)", color: accent }}>
                {timerSec}s
              </div>
            ) : (
              <div className="text-xs text-body-gray"> </div>
            )}
          </div>
          {!isPractice && mustCapture && !chainActive && (
            <p className="mt-1 text-xs text-body-gray">
              Mandatory captures available. Jump to win.
            </p>
          )}
        </div>

        {/* Board */}
        <div className="relative mx-auto w-full max-w-[520px] flex-1 min-h-0 px-2 pb-2 lg:px-4">
          <div
            className="relative grid w-full aspect-square rounded-lg"
            style={{
              gridTemplateColumns: "repeat(8, 1fr)",
              border: `2px solid ${BOARD_BORDER}`,
              background: BOARD_LIGHT,
            }}
          >
            {Array.from({ length: 64 }).map((_, idx) => {
              const r = Math.floor(idx / 8);
              const c = idx % 8;
              const dark = isDark(r, c);
              const key = `${r},${c}`;
              const piece = board[r][c];
              const hasPiece = piece !== 0;
              const isSelected = selected && selected.r === r && selected.c === c;
              const isValid = validDestinations.has(key);
              const isMandatory = mandatoryCaptureKeySet.has(key);
              const isLastFrom = lastFromKey === key;
              const isLastTo = lastToKey === key;

              const bg = dark ? BOARD_DARK : BOARD_LIGHT;
              const cellBorder = isSelected ? `2px solid ${accent}` : "1px solid rgba(255,255,255,0.02)";

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSquareClick({ r, c })}
                  className="relative flex items-center justify-center p-0 focus:outline-none"
                  style={{
                    minWidth: cellMin,
                    minHeight: cellMin,
                    background: bg,
                    border: cellBorder,
                    padding: 0,
                    cursor: "pointer",
                  }}
                  aria-label={`Square ${key}`}
                >
                  {/* Valid move dots */}
                  {isValid && (
                    <div
                      className="rounded-full"
                      style={{
                        width: 14,
                        height: 14,
                        background: validDotColor,
                        boxShadow: `0 0 0 3px rgba(0,0,0,0.15)`,
                      }}
                    />
                  )}

                  {/* Last move highlight */}
                  {(isLastFrom || isLastTo) && !isValid && (
                    <div
                      className="absolute inset-0"
                      style={{
                        background: lastMoveGlow,
                        boxShadow: isLastTo ? `0 0 18px rgba(42,58,92,0.22)` : undefined,
                      }}
                    />
                  )}

                  {/* Mandatory capture pulsing (only when not in chain) */}
                  {isMandatory && !isSelected && !chainActive && (
                    <div
                      className="absolute inset-0 rounded-[4px] animate-pulse"
                      style={{
                        boxShadow: `0 0 0 2px ${mandatoryGlow}, 0 0 22px ${mandatoryGlow2}`,
                        border: `1px solid ${mandatoryGlow}`,
                        pointerEvents: "none",
                      }}
                    />
                  )}

                  {/* Piece */}
                  {hasPiece && (
                    <div
                      className="relative z-10"
                      style={{
                        width: "72%",
                        height: "72%",
                        borderRadius: 9999,
                        background: piece > 0 ? P1 : P2,
                        boxShadow:
                          piece > 0
                            ? "inset 0 3px 7px rgba(0,0,0,0.45), inset 0 -3px 7px rgba(255,255,255,0.05)"
                            : "inset 0 3px 7px rgba(0,0,0,0.25), inset 0 -3px 7px rgba(255,255,255,0.12)",
                        border: isSelected ? `2px solid ${accent}` : "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {/* King crown / ring */}
                      {Math.abs(piece) === 2 && (
                        <>
                          <div
                            className="absolute inset-0 m-auto"
                            style={{
                              width: "80%",
                              height: "80%",
                              borderRadius: 9999,
                              border: `2px solid rgba(255,215,0,0.95)`,
                              boxShadow: "0 0 18px rgba(255,215,0,0.20)",
                            }}
                          />
                          <div
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                            style={{ color: "#FFD700", fontSize: 12, fontWeight: 900 }}
                          >
                            👑
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 pb-4 pt-2">
          <div className="flex items-center justify-between gap-3 text-xs text-body-gray">
            <div>
              {mustCapture && !chainActive ? (
                <span style={{ color: accent, fontWeight: 700 }}>Mandatory captures</span>
              ) : (
                <span>Free moves available</span>
              )}
            </div>
            <div>
              {chainActive ? (
                <span style={{ color: accent, fontWeight: 700 }}>Continue capturing</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Right: chat + game log (fixed height) */}
      <div
        className="w-full lg:w-[320px] lg:flex-shrink-0 lg:border lg:border-[#2A3A5C] lg:bg-[#1A1A22] lg:p-0 lg:rounded-lg overflow-hidden"
        style={{ background: "#1A1A22" }}
      >
        {/* Desktop */}
        <div className="hidden lg:flex h-full min-h-0 flex-col">
          {/* Real money: chat 40% + log 60% */}
          {chatEnabled ? (
            <>
              <div className="flex-[0_0_40%] min-h-0 overflow-hidden">
                <ChatPanel
                  enabled={chatEnabled}
                  isPractice={isPractice}
                  messages={chatMessages}
                  onSend={onSendChatMessage ?? (() => {})}
                  onReport={onReportChatMessage ?? (() => {})}
                  playerName={player1.username}
                  opponentName={player2.username}
                  playerId={playerId}
                />
              </div>
              <div className="flex-[0_0_60%] min-h-0 overflow-hidden" style={{ borderTop: "1px solid #2A3A5C" }}>
                <GameLogFeed log={log} player1Name={player1.username} player2Name={player2.username} isPlayer2Bot={isPlayer2Bot} />
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-0">
              <GameLogFeed log={log} player1Name={player1.username} player2Name={player2.username} isPlayer2Bot={isPlayer2Bot} />
            </div>
          )}
        </div>

        {/* Mobile stacking */}
        <div className="flex lg:hidden h-full flex-col min-h-0">
          {/* Mobile real-money: chat 120px + log 150px */}
          {chatEnabled ? (
            <>
              <div className="h-[120px] min-h-[120px] overflow-hidden">
                <ChatPanel
                  enabled={chatEnabled}
                  isPractice={isPractice}
                  messages={chatMessages}
                  onSend={onSendChatMessage ?? (() => {})}
                  onReport={onReportChatMessage ?? (() => {})}
                  playerName={player1.username}
                  opponentName={player2.username}
                  playerId={playerId}
                />
              </div>
              <div className="h-[150px] min-h-[150px] overflow-hidden border-t border-[#2A3A5C]">
                <GameLogFeed log={log} player1Name={player1.username} player2Name={player2.username} isPlayer2Bot={isPlayer2Bot} />
              </div>
            </>
          ) : (
            <div className="h-[200px] min-h-[200px] overflow-hidden">
              <GameLogFeed log={log} player1Name={player1.username} player2Name={player2.username} isPlayer2Bot={isPlayer2Bot} isPracticeOnly />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function isDark(r: number, c: number): boolean {
  return (r + c) % 2 === 1;
}

function GameLogFeed({
  log,
  player1Name,
  player2Name,
  isPlayer2Bot,
  isPracticeOnly,
}: {
  log: LogEntry[];
  player1Name: string;
  player2Name: string;
  isPlayer2Bot: boolean;
  isPracticeOnly?: boolean;
}) {
  const desktopLogRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  useEffect(() => {
    const el = desktopLogRef.current;
    if (!el) return;
    if (!atBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [log]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 border-b border-[#2A3A5C] bg-[#1A1A22]/90 px-4 py-3">
        <h3 className="text-sm font-bold text-white">Game Log</h3>
      </div>
      <div
        ref={desktopLogRef}
        className="flex-1 min-h-0 overflow-y-auto p-3"
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
        }}
      >
        {log.length === 0 ? (
          <p className="py-4 text-center text-xs text-[#7A7A8E]">Moves will appear here.</p>
        ) : (
          log.map((entry) => {
            const isP1 = entry.side === 1;
            const accentBg = isP1 ? "rgba(255,94,0,0.15)" : "rgba(168,85,247,0.15)";
            const accentBorder = isP1 ? "rgba(255,94,0,0.45)" : "rgba(168,85,247,0.55)";
            const name = isP1 ? player1Name : isPlayer2Bot ? `${player2Name} 🤖` : player2Name;
            return (
              <div
                key={entry.id}
                className="mb-2 flex"
                style={{
                  justifyContent: isP1 ? "flex-end" : "flex-start",
                }}
              >
                <div
                  className="rounded-xl border px-3 py-2"
                  style={{
                    maxWidth: "90%",
                    background: accentBg,
                    borderColor: accentBorder,
                  }}
                >
                  <div className="text-[11px] font-semibold text-white/90">{name}</div>
                  <div className="mt-0.5 text-[13px] text-white/90">{entry.message}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

