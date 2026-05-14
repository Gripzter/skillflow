"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameMultiplayerProps } from "./Chess";
import { createInitialBoard, getCaptureStepsFrom, getGameWinnerOrDraw, getLegalTurnMoves, getMustCapture, getPiecesWithCaptures, getRegularStepsFrom, applyStep, opposite, posToAlgebraic, type Board, type Player, type Pos, type Step, type TurnMove } from "@/lib/games/checkers-logic";
import { getCheckersBotDelayMs, getCheckersBotTurnMove } from "@/lib/games/checkers-bot";
import type { BotDifficulty } from "@/lib/games/bot-engine";
import Link from "next/link";
import type { MatchUiState } from "@/components/game/matchUi";


const BOARD_LIGHT = "#1A1A22";
const BOARD_DARK = "#242430";
const BOARD_BORDER = "#2A3A5C";

const P1 = "#FFFF00";
const P2 = "#C8C8D4";
const KING_GOLD = "#FFD700";

const ACCENT_ORANGE = "#FFFF00";
const ACCENT_PURPLE = "#A855F7";

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

type LogEntry = { id: string; side: Player; message: string };

export interface CheckersProps extends GameMultiplayerProps {
  player1: { username: string; rating: number };
  player2: { username: string; rating: number };
  onGameEnd: (winner: "player1" | "player2") => void;
  onGameDraw: () => void;
  isPlayer2Bot?: boolean;
  botDifficulty?: BotDifficulty;

  isPractice?: boolean;
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
  onPlayerAction,
  incomingEvent,
  onEventProcessed,
  isPractice = false,
  onMatchUi,
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
  }, [currentTurn]);

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

      // Log the move (local) unless the caller intentionally skipped it
      // (e.g. capture chains where we log per-jump messages).
      if (turnLogText) {
        setLog((prev) => [...prev, { id: crypto.randomUUID(), side: currentTurn as Player, message: turnLogText }]);
      }

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
      const byRole = incomingEvent.byRole as "player1" | "player2" | undefined;
      if (byRole && byRole === myRole) {
        onEventProcessed();
        return;
      }
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
      const byRole = incomingEvent.byRole as "player1" | "player2" | undefined;
      if (byRole && byRole === myRole) {
        onEventProcessed();
        return;
      }
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
      const byRole = incomingEvent.byRole as "player1" | "player2" | undefined;
      if (byRole && byRole === myRole) {
        onEventProcessed();
        return;
      }
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

      const botName = getBotName(isPlayer2Bot, player2.username);

      for (const step of chosen.steps) {
        const applied = applyStep(b, step, 2);
        b = applied.board;

        if (step.type === "capture") {
          didCapture = true;
          capturedCount += 1;
          setLog((prev) => [...prev, { id: crypto.randomUUID(), side: 2, message: `${botName} captured a piece!` }]);
        }

        if (applied.didKing) {
          didKing = true;
          setLog((prev) => [...prev, { id: crypto.randomUUID(), side: 2, message: `${botName} got a King!` }]);
        }

        lastFrom = step.from;
        lastTo = step.to;
      }

      if (!didCapture) {
        setLog((prev) => [...prev, { id: crypto.randomUUID(), side: 2, message: `${botName} moved piece to ${posToAlgebraic(lastTo)}` }]);
      }
      if (didCapture && capturedCount > 1) {
        const label = capturedCount === 2 ? "double" : capturedCount === 3 ? "triple" : `${capturedCount}-jump`;
        setLog((prev) => [...prev, { id: crypto.randomUUID(), side: 2, message: `${botName} completed a ${label} jump!` }]);
      }

      const nextTurn: Player = 1;
      const nextNoProgressCount = didCapture || didKing ? 0 : noProgressCount + 1;
      const end = getGameWinnerOrDraw(b, nextNoProgressCount);

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

        const actorName = currentTurn === 1 ? player1.username : player2.username;
        setLog((prev) => [...prev, { id: crypto.randomUUID(), side: currentTurn, message: `${actorName} captured a piece!` }]);
        if (applied.didKing) {
          setLog((prev) => [...prev, { id: crypto.randomUUID(), side: currentTurn, message: `${actorName} got a King!` }]);
        }

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
        const chainCaptures = turnMetaRef.current.capturedCount;
        if (chainCaptures > 1) {
          const label = chainCaptures === 2 ? "double" : chainCaptures === 3 ? "triple" : `${chainCaptures}-jump`;
          setLog((prev) => [
            ...prev,
            { id: crypto.randomUUID(), side: currentTurn, message: `${actorName} completed a ${label} jump!` },
          ]);
        }

        const nextTurn = opposite(currentTurn);
        const nextNoProgressCount = didCapture || didKing ? 0 : noProgressCount + 1;
        applyTurnEnd(
          applied.board,
          nextTurn,
          step.from,
          finalTo,
          { didCapture, didKing, capturedCount: turnMetaRef.current.capturedCount },
          "",
          undefined,
          nextNoProgressCount
        );

        return;
      }

      // If no piece is selected yet, selecting is allowed if legal.
      if (!selected) {
        if (!isOwnPiece) return;
        if (mustCapture && getCaptureStepsFrom(board, pos, currentTurn).length === 0) return;
        onPlayerAction?.();
        setSelected(pos);
        return;
      }

      // Allow selecting a different own piece (only if it doesn't violate must-capture rules).
      if (isOwnPiece) {
        if (mustCapture) {
          const caps = getCaptureStepsFrom(board, pos, currentTurn);
          if (caps.length === 0) return;
        }
        onPlayerAction?.();
        setSelected(pos);
        return;
      }

      // Otherwise, try to move to a highlighted destination.
      const key = `${pos.r},${pos.c}`;
      if (!validDestinations.has(key)) return;

      const step = legalStepsFromSelected.find((s) => s.to.r === pos.r && s.to.c === pos.c);
      if (!step) return;
      onPlayerAction?.();

      if (step.type === "regular") {
        const applied = applyStep(board, step, currentTurn);
        const didKing = applied.didKing;
        const didCapture = false;

        const playerName = currentTurn === 1 ? player1.username : player2.username;
        const turnLogText = `${playerName} moved piece to ${posToAlgebraic(step.to)}`;
        if (didKing) {
          setLog((prev) => [...prev, { id: crypto.randomUUID(), side: currentTurn, message: `${playerName} got a King!` }]);
        }

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
        const playerName = currentTurn === 1 ? player1.username : player2.username;
        setLog((prev) => [...prev, { id: crypto.randomUUID(), side: currentTurn, message: `${playerName} captured a piece!` }]);
        if (applied.didKing) {
          setLog((prev) => [...prev, { id: crypto.randomUUID(), side: currentTurn, message: `${playerName} got a King!` }]);
        }
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
        const chainCaptures = turnMetaRef.current.capturedCount;
        if (chainCaptures > 1) {
          const label = chainCaptures === 2 ? "double" : chainCaptures === 3 ? "triple" : `${chainCaptures}-jump`;
          setLog((prev) => [
            ...prev,
            { id: crypto.randomUUID(), side: currentTurn, message: `${playerName} completed a ${label} jump!` },
          ]);
        }

        const nextTurn = opposite(currentTurn);
        const nextNoProgressCount = didCapture || didKing ? 0 : noProgressCount + 1;

        applyTurnEnd(
          applied.board,
          nextTurn,
          step.from,
          finalTo,
          { didCapture, didKing, capturedCount: turnMetaRef.current.capturedCount },
          "",
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
      onPlayerAction,
    ]
  );

  const accent = isPractice ? ACCENT_PURPLE : ACCENT_ORANGE;
  const validDotColor = isPractice ? "rgba(168,85,247,0.3)" : "rgba(255, 255, 0, 0.3)";
  const mandatoryGlow = isPractice ? "rgba(168,85,247,0.25)" : "rgba(255, 255, 0, 0.25)";
  const mandatoryGlow2 = isPractice ? "rgba(168,85,247,0.18)" : "rgba(255, 255, 0, 0.18)";
  const lastMoveGlow = "rgba(42,58,92,0.18)";

  const myName = myRole === "player1" ? player1.username : player2.username;
  const opponentName = myRole === "player1" ? player2.username : player1.username;

  const sideCardAccent = isPractice ? "rgba(168,85,247,0.45)" : "rgba(255, 255, 0, 0.45)";
  const sideCardBorder = isMyTurn ? sideCardAccent : "rgba(255,255,255,0.08)";

  // Derived highlights.
  const mandatoryCaptureKeySet = useMemo(() => new Set(piecesWithCaptures.map((p) => `${p.r},${p.c}`)), [piecesWithCaptures]);
  const lastFromKey = lastMove ? `${lastMove.from.r},${lastMove.from.c}` : null;
  const lastToKey = lastMove ? `${lastMove.to.r},${lastMove.to.c}` : null;

  const gameStartRef = useRef(Date.now());
  useEffect(() => {
    if (!onMatchUi) return;
    const turnText = isMyTurn
      ? mustCapture && !chainActive
        ? "YOUR TURN — Mandatory capture!"
        : "YOUR TURN — Move a piece!"
      : "Waiting for opponent...";
    const systemLogEntries: MatchUiState["systemLogEntries"] = log.map((e, i) => ({
      id: e.id,
      text: e.message,
      timestamp: gameStartRef.current + i * 100,
    }));
    onMatchUi({
      scores: { player1: p1Captured, player2: p2Captured },
      scoreLabel: "Captured",
      currentTurn: currentTurn === 1 ? "player1" : "player2",
      requiresAction: !gameOverRef.current,
      turnText,
      systemLogEntries,
    });
  }, [
    onMatchUi,
    p1Captured,
    p2Captured,
    currentTurn,
    isMyTurn,
    log,
    mustCapture,
    chainActive,
  ]);

  return (
    <div className="flex w-full flex-col items-center justify-center">
        {/* Board */}
        <div className="flex w-full items-center justify-center px-0 pb-0">
          <div
            className="relative grid rounded-lg"
            style={{
              width: "min(480px, 90vw)",
              aspectRatio: "1",
              gridTemplateColumns: "repeat(8, 1fr)",
              gridTemplateRows: "repeat(8, 1fr)",
              border: `2px solid ${BOARD_BORDER}`,
              background: BOARD_LIGHT,
              transition: "none",
              transform: "none",
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

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSquareClick({ r, c })}
                  className="relative flex items-center justify-center p-0 focus:outline-none"
                  style={{
                    background: bg,
                    border: "1px solid rgba(255,255,255,0.02)",
                    // inset box-shadow never affects layout — zero impact on cell/row dimensions
                    boxShadow: isSelected ? `inset 0 0 0 2px ${accent}` : undefined,
                    padding: 0,
                    cursor: "pointer",
                    width: "100%",
                    height: "100%",
                    transition: "none",
                    transform: "none",
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
                        border: "1px solid rgba(255,255,255,0.08)",
                        boxShadow: isSelected
                          ? `inset 0 3px 7px rgba(0,0,0,0.45), inset 0 -3px 7px rgba(255,255,255,0.05), 0 0 0 2px ${accent}`
                          : piece > 0
                          ? "inset 0 3px 7px rgba(0,0,0,0.45), inset 0 -3px 7px rgba(255,255,255,0.05)"
                          : "inset 0 3px 7px rgba(0,0,0,0.25), inset 0 -3px 7px rgba(255,255,255,0.12)",
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

    </div>
  );
}

function isDark(r: number, c: number): boolean {
  return (r + c) % 2 === 1;
}


