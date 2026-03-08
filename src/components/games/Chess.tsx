"use client";

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Chess as ChessEngine } from "chess.js";
import ChessBoard from "./chess/ChessBoard";
import {
  PIECE_VALUE,
  CAPTURED_DISPLAY_ORDER,
  getPieceSymbol,
  getMoveDescriptionForChat,
  type PieceType,
  type PieceColor,
} from "@/lib/games/chess-utils";
import { getChessBotMove, getChessBotDelayMs, type BotDifficulty } from "@/lib/games/bot-engine";

export interface GameMultiplayerProps {
  isMultiplayer?: boolean;
  myRole?: "player1" | "player2";
  sendGameEvent?: (event: Record<string, unknown>) => Promise<void>;
  incomingEvent?: Record<string, unknown> | null;
  onEventProcessed?: () => void;
}

interface ChessProps extends GameMultiplayerProps {
  player1: { username: string; rating: number };
  player2: { username: string; rating: number };
  onGameEnd: (winner: "player1" | "player2") => void;
  onGameDraw: () => void;
  isPlayer2Bot?: boolean;
  botDifficulty?: BotDifficulty;
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

function formatTs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
  const [showAllMoves, setShowAllMoves] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [drawOfferSent, setDrawOfferSent] = useState(false);
  const gameOverRef = useRef(false);
  const gameStartTimeRef = useRef(Date.now());
  const moveListEndRef = useRef<HTMLDivElement | null>(null);
  const lastProcessedEventRef = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    const check = () => setIsMobile(typeof window !== "undefined" && window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const board = useMemo(() => boardFromGame(game), [game]);
  const turn = game.turn();
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

  const executeMove = useCallback(
    (from: string, to: string, promotion?: PieceType) => {
      if (gameOverRef.current) return;
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
            }).catch(() => {});
          }
        }
      } catch (e) {
        console.log("[Chess] move", { from, to, success: false, error: e, fen: game.fen() });
      }
    },
    [game, player1.username, player2.username, isMultiplayer, sendGameEvent]
  );

  const handleSquareClick = useCallback(
    (square: string) => {
      if (promotionPending || gameOverRef.current) return;
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
    [selectedSquare, legalTargetsSet, legalMoves, turn, game, executeMove, promotionPending]
  );

  const handlePieceDragStart = useCallback(
    (square: string, piece: PieceCode, clientX: number, clientY: number) => {
      if (promotionPending || gameOverRef.current) return;
      if ((piece[0] as PieceColor) === turn) {
        setSelectedSquare(square);
        setDragging({ square, piece, x: clientX, y: clientY });
      }
    },
    [turn, promotionPending]
  );

  const handlePieceDragMove = useCallback((clientX: number, clientY: number) => {
    setDragging((d) => (d ? { ...d, x: clientX, y: clientY } : null));
  }, []);

  const handlePieceDragEnd = useCallback(
    (targetSquare: string | null) => {
      if (!dragging) return;
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
    [dragging, legalTargetsSet, legalMoves, turn, executeMove]
  );

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

  useEffect(() => {
    moveListEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [moveHistory.length]);

  // Incoming multiplayer events: apply opponent move, handle resign, draw
  useEffect(() => {
    if (!incomingEvent || !onEventProcessed || incomingEvent === lastProcessedEventRef.current) return;
    const type = incomingEvent.type as string | undefined;
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
            lastProcessedEventRef.current = incomingEvent;
            if (result.captured) {
              if (result.color === "w") setCapturedBlack((prev) => [...prev, result.captured as PieceType]);
              else setCapturedWhite((prev) => [...prev, result.captured as PieceType]);
            }
            setLastMove({ from, to });
            setSelectedSquare(null);
            setGame(next);
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
  }, [incomingEvent, onEventProcessed, game, player1.username, player2.username, myRole, onGameEnd, onGameDraw]);

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

  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(400);
  useEffect(() => {
    const el = boardContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight - 200;
      setBoardSize(Math.min(w, h, 520));
    });
    ro.observe(el);
    const w = el.clientWidth;
    const h = el.clientHeight - 200;
    setBoardSize(Math.min(w, Math.max(320, h), 520));
    return () => ro.disconnect();
  }, []);
  const squareSize = Math.floor(boardSize / 8);

  const materialAdvantage = useMemo(() => {
    let w = 0,
      b = 0;
    capturedWhite.forEach((t) => (b += PIECE_VALUE[t]));
    capturedBlack.forEach((t) => (w += PIECE_VALUE[t]));
    return w - b;
  }, [capturedWhite, capturedBlack]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col lg:flex-row lg:gap-6">
      {/* Left: Board area */}
      <div
        ref={boardContainerRef}
        className="flex flex-1 flex-col items-center justify-center gap-3 py-4 lg:min-w-0"
      >
        {/* Black (Player 2) info */}
        <div className="flex w-full max-w-[min(100%,520px)] flex-col gap-1 rounded-lg bg-white/5 px-3 py-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-purple/40 to-rose-500/40 flex items-center justify-center text-lg font-bold text-white">
              {player2.username.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-white">
                {player2.username}
                {isPlayer2Bot && (
                  <span className="ml-1.5 inline-flex items-center rounded bg-white/10 px-1.5 py-0.5 text-xs font-medium text-body-gray">
                    🤖 BOT
                  </span>
                )}
                {(botThinking || (isMultiplayer && turn === (myRole === "player1" ? "b" : "w"))) && (
                  <span className="ml-1.5 inline-flex animate-pulse text-body-gray">
                    {isMultiplayer ? "thinking..." : "..."}
                  </span>
                )}
              </p>
              <p className="text-xs text-body-gray">Rating {player2.rating}</p>
            </div>
            {materialAdvantage < 0 && (
              <span className="text-sm font-semibold text-teal">+{Math.abs(materialAdvantage)}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-0.5">
            {CAPTURED_DISPLAY_ORDER.map((t) =>
              capturedBlack.filter((p) => p === t).map((_, i) => (
                <span
                  key={`b-${t}-${i}`}
                  className="inline-flex items-center justify-center leading-none text-white/90"
                  style={{ fontFamily: "system-ui", fontSize: 20, width: 20, height: 20 }}
                >
                  {getPieceSymbol("w", t)}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Board */}
        <div className="flex items-center justify-center">
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
          />
        </div>

        {/* White (Player 1) info */}
        <div className="flex w-full max-w-[min(100%,520px)] flex-col gap-1 rounded-lg bg-white/5 px-3 py-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-teal/40 to-purple/40 flex items-center justify-center text-lg font-bold text-white">
              {player1.username.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-white">{player1.username}</p>
              <p className="text-xs text-body-gray">Rating {player1.rating}</p>
            </div>
            {materialAdvantage > 0 && (
              <span className="text-sm font-semibold text-teal">+{materialAdvantage}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-0.5">
            {CAPTURED_DISPLAY_ORDER.map((t) =>
              capturedWhite.filter((p) => p === t).map((_, i) => (
                <span
                  key={`w-${t}-${i}`}
                  className="inline-flex items-center justify-center leading-none text-body-gray"
                  style={{ fontFamily: "system-ui", fontSize: 20, width: 20, height: 20 }}
                >
                  {getPieceSymbol("b", t)}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Check / Checkmate / Stalemate indicator */}
        {inCheck && !inCheckmate && (
          <p className="text-sm font-semibold text-amber-400">Check!</p>
        )}
        {inCheckmate && (
          <p className="text-sm font-semibold text-red-400">Checkmate!</p>
        )}
        {inStalemate && (
          <p className="text-sm font-semibold text-body-gray">Stalemate — Draw!</p>
        )}
        {isMultiplayer && !gameOverRef.current && !inCheckmate && !inStalemate && !inDraw && (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (sendGameEvent && !drawOfferSent) {
                  setDrawOfferSent(true);
                  sendGameEvent({ type: "draw_offer" }).catch(() => {});
                }
              }}
              disabled={drawOfferSent}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-body-gray hover:bg-white/10 disabled:opacity-50"
            >
              {drawOfferSent ? "Draw offered" : "Offer Draw"}
            </button>
          </div>
        )}
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

      {/* Right: Chat-style move log — persisted moveHistory, append-only */}
      <div className="flex w-full flex-col rounded-lg border border-white/10 bg-card/80 lg:w-[32%] lg:min-w-[240px] min-h-0">
        <h3 className="shrink-0 border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">Moves</h3>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col" style={{ maxHeight: 400 }}>
          <p key="start" className="text-center text-xs text-body-gray py-2 shrink-0">
            ♟ Game Started • White: {player1.username} vs Black: {player2.username}
            {isPlayer2Bot ? " 🤖" : ""}
          </p>
          {moveHistory.length === 0 ? (
            <p className="text-center text-sm text-body-gray py-4">Make the first move!</p>
          ) : (
            <>
              {moveHistory.map((bubble, i) => {
                const totalBubbles = moveHistory.length;
                const bubbleOrdinal = i + 1;
                const isInCollapsedRange = isMobile && !showAllMoves && totalBubbles > 3 && bubbleOrdinal <= totalBubbles - 3;
                if (isInCollapsedRange) return null;
                const isPlayer1 = bubble.player === 1;
                return (
                  <div key={`move-${i}-${bubble.san}`}>
                    {i > 0 && (i + 1) % 10 === 0 && (
                      <p className="text-center text-xs text-body-gray py-1">— Move {i + 1} —</p>
                    )}
                    <div
                      ref={i === moveHistory.length - 1 ? moveListEndRef : undefined}
                      className="mb-2 flex max-w-[75%] shrink-0"
                      style={{ marginLeft: isPlayer1 ? "auto" : 0, marginRight: isPlayer1 ? 0 : 40 }}
                    >
                      <div
                        className="rounded-xl px-3.5 py-2.5"
                        style={{
                          backgroundColor: isPlayer1 ? "#1A3A2A" : "#1E1E2E",
                          borderLeft: isPlayer1 ? "3px solid rgba(0, 229, 199, 0.5)" : "none",
                        }}
                      >
                        <p className="text-xs font-bold" style={{ color: isPlayer1 ? "var(--color-teal, #0d9488)" : "#9ca3af" }}>
                          {bubble.playerName}{bubble.player === 2 && isPlayer2Bot ? " 🤖" : ""}
                        </p>
                        <p className="text-sm text-white mt-0.5">{bubble.description}</p>
                        <p className="text-[11px] text-body-gray mt-1 tabular-nums">
                          {bubble.san.replace(/[+#]$/, "")} • {formatTs(bubble.ts)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {isMobile && !showAllMoves && moveHistory.length > 3 && (
                <button
                  type="button"
                  className="mt-2 text-center text-sm text-teal hover:underline"
                  onClick={() => setShowAllMoves(true)}
                >
                  Show all
                </button>
              )}
            </>
          )}
          {(inCheckmate || inStalemate || inDraw || inThreefold || insufficientMaterial) && (
            <p key="end" className="text-center text-sm text-white/90 py-2 font-medium shrink-0">
              {inCheckmate
                ? `🏆 Checkmate! ${turn === "b" ? player1.username : player2.username} wins`
                : inStalemate
                  ? "🤝 Draw by stalemate"
                  : "🤝 Draw"}
            </p>
          )}
        </div>
        <div className="flex gap-2 border-t border-white/10 p-3 shrink-0">
          <button
            type="button"
            className="flex-1 rounded border border-white/20 py-2 text-xs font-medium text-body-gray hover:bg-white/5"
          >
            Offer Draw
          </button>
          <button
            type="button"
            onClick={() => onGameEnd("player2")}
            className="flex-1 rounded border border-red-500/50 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10"
          >
            Resign
          </button>
        </div>
      </div>

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
