"use client";

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Chess as ChessEngine } from "chess.js";
import ChessBoard from "./chess/ChessBoard";
import {
  PIECE_VALUE,
  getPieceSymbol,
  getMoveDescriptionForChat,
  type PieceType,
  type PieceColor,
} from "@/lib/games/chess-utils";
import { getChessBotMove, getChessBotDelayMs, type BotDifficulty } from "@/lib/games/bot-engine";
import type { MatchUiState } from "@/components/game/matchUi";
import { CHESS_INITIAL_CLOCK_MS } from "@/lib/games/match-timers";

export interface GameMultiplayerProps {
  isMultiplayer?: boolean;
  myRole?: "player1" | "player2";
  sendGameEvent?: (event: Record<string, unknown>) => Promise<void>;
  incomingEvent?: Record<string, unknown> | null;
  onEventProcessed?: () => void;
  onMatchUi?: (state: MatchUiState) => void;
}

interface ChessProps extends GameMultiplayerProps {
  player1: { username: string; rating: number };
  player2: { username: string; rating: number };
  onGameEnd: (winner: "player1" | "player2") => void;
  onGameDraw: () => void;
  isPlayer2Bot?: boolean;
  botDifficulty?: BotDifficulty;
  initialClockState?: {
    player1RemainingTimeMs?: number;
    player2RemainingTimeMs?: number;
    activeTurn?: "player1" | "player2";
    turnStartedAt?: string;
  };
  onTurnClockUpdate?: (clock: {
    player1RemainingTimeMs: number;
    player2RemainingTimeMs: number;
    activeTurn: "player1" | "player2";
    turnStartedAt: string;
  }) => Promise<void> | void;
}

type PieceCode = string;

function boardFromGame(game: ChessEngine): (PieceCode | null)[][] {
  const b = game.board();
  return b.map((row) =>
    row.map((cell) => (cell ? `${cell.color}${cell.type}` : null))
  ) as (PieceCode | null)[][];
}

function getKingSquare(game: ChessEngine, color: "w" | "b"): string | null {
  const b = game.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const cell = b[r][f];
      if (cell && cell.color === color && cell.type === "k") {
        return String.fromCharCode(97 + f) + (8 - r);
      }
    }
  }
  return null;
}

export default function Chess({
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
  onMatchUi,
  initialClockState,
  onTurnClockUpdate,
}: ChessProps) {
  const [game, setGame] = useState(() => new ChessEngine());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [promotionPending, setPromotionPending] = useState<{
    from: string;
    to: string;
    color: PieceColor;
  } | null>(null);
  const [dragging, setDragging] = useState<{
    square: string;
    piece: PieceCode;
    x: number;
    y: number;
  } | null>(null);
  const [capturedWhite, setCapturedWhite] = useState<PieceType[]>([]);
  const [capturedBlack, setCapturedBlack] = useState<PieceType[]>([]);
  type MoveHistoryEntry = { player: 1 | 2; playerName: string; description: string; san: string; ts: number };
  const [moveHistory, setMoveHistory] = useState<MoveHistoryEntry[]>([]);
  const [botThinking, setBotThinking] = useState(false);
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [drawOfferSent, setDrawOfferSent] = useState(false);
  const [clockState, setClockState] = useState(() => ({
    player1RemainingTimeMs: initialClockState?.player1RemainingTimeMs ?? CHESS_INITIAL_CLOCK_MS,
    player2RemainingTimeMs: initialClockState?.player2RemainingTimeMs ?? CHESS_INITIAL_CLOCK_MS,
    activeTurn: initialClockState?.activeTurn ?? "player1",
    turnStartedAt: initialClockState?.turnStartedAt ?? new Date().toISOString(),
  }));
  const [clockNowMs, setClockNowMs] = useState(Date.now());
  const gameOverRef = useRef(false);
  const gameStartTimeRef = useRef(Date.now());
  const lastProcessedEventRef = useRef<Record<string, unknown> | null>(null);

  const resolveClockRemainingMs = useCallback(
    (player: "player1" | "player2", nowMs: number) => {
      const base =
        player === "player1"
          ? clockState.player1RemainingTimeMs
          : clockState.player2RemainingTimeMs;
      if (clockState.activeTurn !== player) return Math.max(0, base);
      const startMs = new Date(clockState.turnStartedAt).getTime();
      if (!Number.isFinite(startMs)) return Math.max(0, base);
      return Math.max(0, base - Math.max(0, nowMs - startMs));
    },
    [clockState]
  );

  const board = useMemo(() => boardFromGame(game), [game]);
  const turn = game.turn();
  const myColor: PieceColor = isMultiplayer ? (myRole === "player1" ? "w" : "b") : "w";
  const opponentColor: PieceColor = myColor === "w" ? "b" : "w";
  const canActOnTurn = !isMultiplayer || turn === myColor;
  const legalMoves = useMemo(() => {
    if (!selectedSquare) return [];
    return game.moves({ verbose: true, square: selectedSquare as any });
  }, [game, selectedSquare]);
  const legalMoveTargets = useMemo(
    () => legalMoves.map((m) => (m as { to: string }).to),
    [legalMoves]
  );
  const legalTargetsSet = useMemo(() => new Set(legalMoveTargets), [legalMoveTargets]);

  const inCheck = game.inCheck();
  const inCheckmate = game.isCheckmate();
  const inStalemate = game.isStalemate();
  const inDraw = game.isDraw();
  const inThreefold = typeof game.isThreefoldRepetition === "function" && game.isThreefoldRepetition();
  const insufficientMaterial = typeof game.isInsufficientMaterial === "function" && game.isInsufficientMaterial();
  const checkSquare = inCheck ? getKingSquare(game, turn) : null;

  useEffect(() => {
    if (!initialClockState) return;
    setClockState((prev) => ({
      player1RemainingTimeMs:
        typeof initialClockState.player1RemainingTimeMs === "number"
          ? initialClockState.player1RemainingTimeMs
          : prev.player1RemainingTimeMs,
      player2RemainingTimeMs:
        typeof initialClockState.player2RemainingTimeMs === "number"
          ? initialClockState.player2RemainingTimeMs
          : prev.player2RemainingTimeMs,
      activeTurn: initialClockState.activeTurn ?? prev.activeTurn,
      turnStartedAt: initialClockState.turnStartedAt ?? prev.turnStartedAt,
    }));
  }, [initialClockState]);

  const executeMove = useCallback(
    (from: string, to: string, promotion?: PieceType) => {
      if (gameOverRef.current) return;
      if (isMultiplayer && turn !== myColor) return;
      const next = new ChessEngine(game.fen());
      const moveOpt: { from: string; to: string; promotion?: "q" | "r" | "b" | "n" } = { from, to };
      if (promotion) moveOpt.promotion = promotion as "q" | "r" | "b" | "n";
      try {
        const result = next.move(moveOpt);
        if (result) {
          if (result.captured) {
            if (result.color === "w") setCapturedBlack((prev) => [...prev, result.captured as PieceType]);
            else setCapturedWhite((prev) => [...prev, result.captured as PieceType]);
          }
          setLastMove({ from, to });
          setSelectedSquare(null);
          setGame(next);
          const nowIso = new Date().toISOString();
          const nowMs = new Date(nowIso).getTime();
          const moverRole: "player1" | "player2" = result.color === "w" ? "player1" : "player2";
          const nextTurnRole: "player1" | "player2" = moverRole === "player1" ? "player2" : "player1";
          setClockState((prev) => {
            const startMs = new Date(prev.turnStartedAt).getTime();
            const elapsed =
              prev.activeTurn === moverRole && Number.isFinite(startMs)
                ? Math.max(0, nowMs - startMs)
                : 0;
            const nextClock = {
              player1RemainingTimeMs:
                moverRole === "player1"
                  ? Math.max(0, prev.player1RemainingTimeMs - elapsed)
                  : prev.player1RemainingTimeMs,
              player2RemainingTimeMs:
                moverRole === "player2"
                  ? Math.max(0, prev.player2RemainingTimeMs - elapsed)
                  : prev.player2RemainingTimeMs,
              activeTurn: nextTurnRole,
              turnStartedAt: nowIso,
            };
            onTurnClockUpdate?.(nextClock);
            return nextClock;
          });
          const ts = (Date.now() - gameStartTimeRef.current) / 1000;
          const player: 1 | 2 = result.color === "w" ? 1 : 2;
          const playerName = result.color === "w" ? player1.username : player2.username;
          const description = getMoveDescriptionForChat(
            result.piece as PieceType,
            result.from,
            result.to,
            !!result.captured,
            result.san,
            (result as { flags?: string }).flags
          );
          setMoveHistory((prev) => [...prev, { player, playerName, description, san: result.san, ts }]);
          if (isMultiplayer && sendGameEvent) {
            sendGameEvent({
              type: "chess_move",
              from,
              to,
              promotion: promotion ?? null,
              byRole: myRole,
              san: result.san,
            }).catch(() => {});
          }
        }
      } catch (e) {
        console.log("[Chess] move", { from, to, success: false, error: e, fen: game.fen() });
      }
    },
    [game, player1.username, player2.username, isMultiplayer, sendGameEvent, turn, myColor, myRole, onTurnClockUpdate]
  );

  const handleSquareClick = useCallback(
    (square: string) => {
      if (promotionPending || gameOverRef.current) return;
      if (!canActOnTurn) return;
      if (selectedSquare && legalTargetsSet.has(square)) {
        const move = legalMoves.find((m) => (m as { to: string }).to === square);
        const prom = (move as { promotion?: string })?.promotion;
        if (prom) {
          setPromotionPending({ from: selectedSquare, to: square, color: turn });
          return;
        }
        executeMove(selectedSquare, square);
        return;
      }
      const piece = game.get(square as any);
      if (piece && piece.color === turn) {
        setSelectedSquare(square);
      } else {
        setSelectedSquare(null);
      }
    },
    [selectedSquare, legalTargetsSet, legalMoves, turn, game, executeMove, promotionPending, canActOnTurn]
  );

  const handlePieceDragStart = useCallback(
    (square: string, piece: PieceCode, clientX: number, clientY: number) => {
      if (promotionPending || gameOverRef.current) return;
      if (!canActOnTurn) return;
      if ((piece[0] as PieceColor) === turn) {
        setSelectedSquare(square);
        setDragging({ square, piece, x: clientX, y: clientY });
      }
    },
    [turn, promotionPending, canActOnTurn]
  );

  const handlePieceDragMove = useCallback((clientX: number, clientY: number) => {
    setDragging((d) => (d ? { ...d, x: clientX, y: clientY } : null));
  }, []);

  const handlePieceDragEnd = useCallback(
    (targetSquare: string | null) => {
      if (!dragging) return;
      if (!canActOnTurn) {
        setDragging(null);
        return;
      }
      const from = dragging.square;
      setDragging(null);
      if (targetSquare && legalTargetsSet.has(targetSquare)) {
        const move = legalMoves.find((m) => (m as { to: string }).to === targetSquare);
        const prom = (move as { promotion?: string })?.promotion;
        if (prom) {
          setPromotionPending({ from, to: targetSquare, color: turn });
          return;
        }
        executeMove(from, targetSquare);
      }
    },
    [dragging, legalTargetsSet, legalMoves, turn, executeMove, canActOnTurn]
  );

  useEffect(() => {
    if (gameOverRef.current) return;
    const t = setInterval(() => setClockNowMs(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (gameOverRef.current) return;
    const active = clockState.activeTurn;
    const activeRemaining = resolveClockRemainingMs(active, clockNowMs);
    if (activeRemaining > 0) return;
    gameOverRef.current = true;
    if (isMultiplayer && sendGameEvent) {
      sendGameEvent({ type: "chess_timeout", loserRole: active }).catch(() => {});
    }
    onGameEnd(active === "player1" ? "player2" : "player1");
  }, [clockNowMs, clockState.activeTurn, isMultiplayer, onGameEnd, resolveClockRemainingMs, sendGameEvent]);

  const handlePromotionChoose = useCallback(
    (piece: PieceType) => {
      if (!promotionPending) return;
      executeMove(promotionPending.from, promotionPending.to, piece);
      setPromotionPending(null);
    },
    [promotionPending, executeMove]
  );

  useEffect(() => {
    if (inCheckmate) {
      gameOverRef.current = true;
      const winner = turn === "w" ? "player2" : "player1";
      onGameEnd(winner);
    }
  }, [inCheckmate, turn, onGameEnd]);

  useEffect(() => {
    if (inStalemate || inDraw || inThreefold || insufficientMaterial) {
      gameOverRef.current = true;
      onGameDraw();
    }
  }, [inStalemate, inDraw, inThreefold, insufficientMaterial, onGameDraw]);

  // Incoming multiplayer events: apply opponent move, handle resign, draw
  useEffect(() => {
    if (!incomingEvent || !onEventProcessed || incomingEvent === lastProcessedEventRef.current) return;
    const type = incomingEvent.type as string | undefined;
    const byRole = incomingEvent.byRole as "player1" | "player2" | undefined;
    if (byRole && byRole === myRole) {
      onEventProcessed();
      return;
    }
    if (type === "chess_move") {
      const from = incomingEvent.from as string | undefined;
      const to = incomingEvent.to as string | undefined;
      const promotion = incomingEvent.promotion as PieceType | undefined;
      if (from && to && !gameOverRef.current) {
        const next = new ChessEngine(game.fen());
        const moveOpt: { from: string; to: string; promotion?: "q" | "r" | "b" | "n" } = { from, to };
        if (promotion) moveOpt.promotion = promotion as "q" | "r" | "b" | "n";
        try {
          const result = next.move(moveOpt);
          if (result) {
            if (result.color !== opponentColor) {
              onEventProcessed();
              return;
            }
            lastProcessedEventRef.current = incomingEvent;
            if (result.captured) {
              if (result.color === "w") setCapturedBlack((prev) => [...prev, result.captured as PieceType]);
              else setCapturedWhite((prev) => [...prev, result.captured as PieceType]);
            }
            setLastMove({ from, to });
            setSelectedSquare(null);
            setGame(next);
            const nowIso = new Date().toISOString();
            const nowMs = new Date(nowIso).getTime();
            const moverRole: "player1" | "player2" = result.color === "w" ? "player1" : "player2";
            const nextTurnRole: "player1" | "player2" = moverRole === "player1" ? "player2" : "player1";
            setClockState((prev) => {
              const startMs = new Date(prev.turnStartedAt).getTime();
              const elapsed =
                prev.activeTurn === moverRole && Number.isFinite(startMs)
                  ? Math.max(0, nowMs - startMs)
                  : 0;
              return {
                player1RemainingTimeMs:
                  moverRole === "player1"
                    ? Math.max(0, prev.player1RemainingTimeMs - elapsed)
                    : prev.player1RemainingTimeMs,
                player2RemainingTimeMs:
                  moverRole === "player2"
                    ? Math.max(0, prev.player2RemainingTimeMs - elapsed)
                    : prev.player2RemainingTimeMs,
                activeTurn: nextTurnRole,
                turnStartedAt: nowIso,
              };
            });
            const ts = (Date.now() - gameStartTimeRef.current) / 1000;
            const player: 1 | 2 = result.color === "w" ? 1 : 2;
            const playerName = result.color === "w" ? player1.username : player2.username;
            const description = getMoveDescriptionForChat(
              result.piece as PieceType,
              result.from,
              result.to,
              !!result.captured,
              result.san,
              (result as { flags?: string }).flags
            );
            setMoveHistory((prev) => [...prev, { player, playerName, description, san: result.san, ts }]);
            onEventProcessed();
          }
        } catch {
          // invalid move, ignore
        }
      }
      return;
    }
    if (type === "chess_timeout") {
      lastProcessedEventRef.current = incomingEvent;
      gameOverRef.current = true;
      const loserRole = (incomingEvent.loserRole as "player1" | "player2" | undefined) ?? "player1";
      const winner = loserRole === "player1" ? "player2" : "player1";
      onGameEnd(winner);
      onEventProcessed();
      return;
    }
    if (type === "resign") {
      lastProcessedEventRef.current = incomingEvent;
      gameOverRef.current = true;
      onGameEnd(myRole);
      onEventProcessed();
      return;
    }
    if (type === "draw_offer") {
      lastProcessedEventRef.current = incomingEvent;
      setDrawOfferReceived(true);
      onEventProcessed();
      return;
    }
    if (type === "draw_response") {
      lastProcessedEventRef.current = incomingEvent;
      setDrawOfferReceived(false);
      if ((incomingEvent as { accepted?: boolean }).accepted) {
        gameOverRef.current = true;
        onGameDraw();
      }
      onEventProcessed();
    }
  }, [incomingEvent, onEventProcessed, game, player1.username, player2.username, myRole, onGameEnd, onGameDraw, opponentColor]);

  // Bot plays when it's Black's turn (only when not multiplayer).
  const fen = game.fen();
  useEffect(() => {
    if (isMultiplayer || !isPlayer2Bot || turn !== "b" || promotionPending || gameOverRef.current) return;
    setBotThinking(true);
    const delay = getChessBotDelayMs(botDifficulty);
    const t = setTimeout(() => {
      const botMove = getChessBotMove(game, botDifficulty);
      if (botMove) {
        executeMove(botMove.from, botMove.to, botMove.promotion as PieceType | undefined);
      }
      setBotThinking(false);
    }, delay);
    return () => clearTimeout(t);
  }, [fen, turn, isPlayer2Bot, botDifficulty, isMultiplayer, promotionPending, game, executeMove]);

  const boardSlotRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(400);
  const [showCoords, setShowCoords] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setShowCoords(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  useEffect(() => {
    const measure = () => {
      const el = boardSlotRef.current;
      if (!el) return;
      const side = Math.min(el.clientWidth, el.clientHeight);
      setBoardSize(Math.max(200, Math.min(Math.floor(side), 520)));
    };
    const ro = new ResizeObserver(measure);
    if (boardSlotRef.current) ro.observe(boardSlotRef.current);
    measure();
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  const squareSize = Math.floor((boardSize - 8) / 8); // subtract 4px border × 2 sides
  const whiteTimeLeft = Math.ceil(resolveClockRemainingMs("player1", clockNowMs) / 1000);
  const blackTimeLeft = Math.ceil(resolveClockRemainingMs("player2", clockNowMs) / 1000);

  const scoreP1 = useMemo(
    () => capturedBlack.reduce((s, t) => s + PIECE_VALUE[t], 0),
    [capturedBlack]
  );
  const scoreP2 = useMemo(
    () => capturedWhite.reduce((s, t) => s + PIECE_VALUE[t], 0),
    [capturedWhite]
  );

  useEffect(() => {
    if (!onMatchUi) return;
    const myColor = isMultiplayer ? (myRole === "player1" ? "w" : "b") : "w";
    const myTurn = turn === myColor;
    let turnText = "Waiting for opponent...";
    if (inCheckmate) turnText = "Checkmate!";
    else if (inStalemate || inDraw) turnText = "Draw!";
    else if (myTurn) turnText = "YOUR TURN — Move a piece!";
    else turnText = "Waiting for opponent...";

    const startTs = gameStartTimeRef.current;
    const systemLogEntries: MatchUiState["systemLogEntries"] = [
      {
        id: "game-start",
        text: `♟ Game started — ${player1.username} (White) vs ${player2.username} (Black)${isPlayer2Bot ? " 🤖" : ""}`,
        timestamp: startTs,
      },
      ...moveHistory.map((m, i) => ({
        id: `move-${i}-${m.san}`,
        text: `${m.playerName}: ${m.san.replace(/[+#]$/, "")}`,
        timestamp: startTs + Math.round(m.ts * 1000),
      })),
    ];

    onMatchUi({
      scores: { player1: scoreP1, player2: scoreP2 },
      scoreLabel: "Pts",
      playerTimeLeftSec: {
        player1: whiteTimeLeft,
        player2: blackTimeLeft,
      },
      currentTurn: turn === "w" ? "player1" : "player2",
      turnText,
      turnTimerDisplay:
        clockState.activeTurn === "player1"
          ? `${Math.max(whiteTimeLeft, 0)}s`
          : `${Math.max(blackTimeLeft, 0)}s`,
      systemLogEntries,
    });
  }, [
    onMatchUi,
    turn,
    inCheckmate,
    inStalemate,
    inDraw,
    moveHistory,
    player1.username,
    player2.username,
    isPlayer2Bot,
    isMultiplayer,
    myRole,
    scoreP1,
    scoreP2,
    whiteTimeLeft,
    blackTimeLeft,
    clockState.activeTurn,
  ]);

  return (
    <div className="flex h-full max-h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden">
      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
        <div
          ref={boardSlotRef}
          className="relative flex h-full max-h-full w-full max-w-[400px] items-center justify-center overflow-hidden"
        >
          <ChessBoard
            board={board}
            selectedSquare={selectedSquare}
            legalMoveTargets={legalMoveTargets}
            lastMove={lastMove}
            checkSquare={checkSquare}
            squareSize={squareSize}
            onSquareClick={handleSquareClick}
            onPieceDragStart={handlePieceDragStart}
            onPieceDragMove={handlePieceDragMove}
            onPieceDragEnd={handlePieceDragEnd}
            dragging={dragging}
            turn={turn}
            flipped={isMultiplayer && myRole === "player2"}
            showCoordinates={showCoords}
          />

          {inCheck && !inCheckmate && !inStalemate && !inDraw && (
            <div className="pointer-events-none absolute left-2 top-2 rounded-lg bg-black/30 px-2 py-1 text-[11px] font-semibold text-amber-400">
              Check!
            </div>
          )}
          {inCheckmate && (
            <div className="pointer-events-none absolute left-2 top-2 rounded-lg bg-black/30 px-2 py-1 text-[11px] font-semibold text-red-400">
              Checkmate!
            </div>
          )}
          {inStalemate && (
            <div className="pointer-events-none absolute left-2 top-2 rounded-lg bg-black/30 px-2 py-1 text-[11px] font-semibold text-body-gray">
              Stalemate — Draw!
            </div>
          )}
          {isMultiplayer &&
            !gameOverRef.current &&
            !inCheckmate &&
            !inStalemate &&
            !inDraw && (
              <button
                type="button"
                onClick={() => {
                  if (sendGameEvent && !drawOfferSent) {
                    setDrawOfferSent(true);
                    sendGameEvent({ type: "draw_offer" }).catch(() => {});
                  }
                }}
                disabled={drawOfferSent}
                className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-lg border border-white/20 px-3 py-1 text-[11px] text-body-gray hover:bg-white/10 disabled:opacity-50"
              >
                {drawOfferSent ? "Draw offered" : "Offer Draw"}
              </button>
            )}
        </div>
      </div>

      {/* Draw offer received modal */}
      {drawOfferReceived && sendGameEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card-border w-full max-w-sm rounded-card bg-card p-6">
            <p className="text-center font-medium text-white">Opponent offers a draw. Accept?</p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setDrawOfferReceived(false);
                  sendGameEvent({ type: "draw_response", accepted: false }).catch(() => {});
                }}
                className="flex-1 rounded-lg border border-white/20 py-2.5 text-white hover:bg-white/10"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => {
                  setDrawOfferReceived(false);
                  gameOverRef.current = true;
                  sendGameEvent({ type: "draw_response", accepted: true }).catch(() => {});
                  onGameDraw();
                }}
                className="flex-1 rounded-lg bg-teal py-2.5 font-medium text-charcoal hover:shadow-teal-glow"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promotion modal */}
      {promotionPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" aria-modal role="dialog">
          <div className="rounded-lg border border-white/20 bg-card p-4 shadow-xl">
            <p className="mb-3 text-center text-sm font-medium text-white">Choose promotion</p>
            <div className="flex gap-3">
              {(["q", "r", "b", "n"] as PieceType[]).map((piece) => (
                <button
                  key={piece}
                  type="button"
                  onClick={() => handlePromotionChoose(piece)}
                  className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-teal/50 bg-white/10 text-3xl transition-colors hover:border-teal hover:bg-white/20"
                >
                  {getPieceSymbol(promotionPending.color, piece)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
