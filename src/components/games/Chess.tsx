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
import { GamePlayerRow, GamePlayerStack } from "@/components/games/GamePlayerStrip";
import { MobilePlayerCards } from "@/components/games/MobilePlayerCards";

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

const ACCENT_P1 = "#FF5E00"; // orange
const ACCENT_P2 = "#A855F7"; // purple

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
    const check = () => setIsMobile(typeof window !== "undefined" && window.innerWidth < 768);
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

  const boardSlotMobileRef = useRef<HTMLDivElement>(null);
  const boardSlotDesktopRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(400);
  useEffect(() => {
    const measure = () => {
      const m = boardSlotMobileRef.current;
      const d = boardSlotDesktopRef.current;
      const el =
        m && m.getBoundingClientRect().width > 0 && m.getBoundingClientRect().height > 0
          ? m
          : d && d.getBoundingClientRect().width > 0 && d.getBoundingClientRect().height > 0
            ? d
            : m || d;
      if (!el) return;
      const side = Math.min(el.clientWidth, el.clientHeight);
      setBoardSize(Math.max(200, Math.min(Math.floor(side), 520)));
    };
    const ro = new ResizeObserver(measure);
    if (boardSlotMobileRef.current) ro.observe(boardSlotMobileRef.current);
    if (boardSlotDesktopRef.current) ro.observe(boardSlotDesktopRef.current);
    measure();
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  const squareSize = Math.floor(boardSize / 8);

  const materialAdvantage = useMemo(() => {
    let w = 0,
      b = 0;
    capturedWhite.forEach((t) => (b += PIECE_VALUE[t]));
    capturedBlack.forEach((t) => (w += PIECE_VALUE[t]));
    return w - b;
  }, [capturedWhite, capturedBlack]);

  const p1Active = turn === "w";
  const p2Active = turn === "b";
  const isPractice = !isMultiplayer;

  const capturedFooter = (captured: PieceType[], pieceColor: PieceColor) => (
    <div className="flex flex-wrap items-center gap-0.5">
      {CAPTURED_DISPLAY_ORDER.map((t) =>
        captured.filter((p) => p === t).map((_, i) => (
          <span
            key={`${t}-${i}`}
            className="inline-flex items-center justify-center leading-none text-white/90"
            style={{ fontFamily: "system-ui", fontSize: 14, width: 14, height: 14 }}
          >
            {getPieceSymbol(pieceColor, t)}
          </span>
        ))
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      {/* Mobile */}
      <div className="md:hidden flex h-full min-h-0 w-full flex-col overflow-hidden">
        <MobilePlayerCards
          player1Name={player1.username}
          player1Right={materialAdvantage > 0 ? `+${materialAdvantage}` : "—"}
          player2Name={player2.username}
          player2Right={materialAdvantage < 0 ? `+${Math.abs(materialAdvantage)}` : "—"}
          player1Active={p1Active}
          player2Active={p2Active}
        />

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <div
            ref={boardSlotMobileRef}
            className="game-board-slot-mobile relative flex items-center justify-center overflow-hidden"
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
              showCoordinates={false}
            />

            {/* Overlays inside the board area (no extra vertical layout height). */}
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

        <div className="flex h-[30px] shrink-0 items-center justify-between px-3">
          <span
            className="min-w-0 truncate text-[13px] font-medium"
            style={{
              color: (() => {
                const myColor = isMultiplayer ? (myRole === "player1" ? "w" : "b") : "w";
                const myTurn = turn === myColor;
                if (inCheckmate) return "#F87171";
                if (inStalemate || inDraw) return "#9ca3af";
                if (!myTurn) return "rgba(148, 163, 184, 1)"; // text-body-gray-ish
                return myColor === "w" ? ACCENT_P1 : ACCENT_P2;
              })(),
            }}
          >
            {(() => {
              const myColor = isMultiplayer ? (myRole === "player1" ? "w" : "b") : "w";
              const myTurn = turn === myColor;
              if (inCheckmate) return "Checkmate!";
              if (inStalemate || inDraw) return "Draw!";
              return myTurn ? "Your Turn" : "Opponent's Turn";
            })()}
          </span>
          <span className="shrink-0 text-[13px] text-body-gray tabular-nums">15s</span>
        </div>

        {/* Mobile game log (~100px fixed) */}
        <div
          className="h-[100px] min-h-[100px] max-h-[100px] shrink-0 overflow-hidden rounded-lg border border-white/10 bg-card/80"
          style={{ overflowX: "hidden" }}
        >
          <h3 className="shrink-0 border-b border-white/10 px-3 py-2 text-[11px] font-semibold text-white">
            Game Log
          </h3>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
            {moveHistory.length === 0 ? (
              <p className="py-2 text-center text-[11px] text-body-gray">Make the first move!</p>
            ) : (
              moveHistory.map((bubble, i) => {
                const isPlayer1 = bubble.player === 1;
                const totalBubbles = moveHistory.length;
                const bubbleOrdinal = i + 1;
                const isInCollapsedRange =
                  isMobile && !showAllMoves && totalBubbles > 3 && bubbleOrdinal <= totalBubbles - 3;
                if (isInCollapsedRange) return null;
                return (
                  <div key={`move-${i}-${bubble.san}`} className="mb-1.5 text-[11px]">
                    <span
                      style={{ color: isPlayer1 ? "var(--color-teal, #0d9488)" : "#9ca3af" }}
                      className="font-bold"
                    >
                      {bubble.playerName}
                    </span>
                    <span className="text-white/90"> {bubble.san.replace(/[+#]$/, "")}</span>
                  </div>
                );
              })
            )}
            {isMobile && !showAllMoves && moveHistory.length > 3 && (
              <button
                type="button"
                className="mt-1 text-[11px] text-teal hover:underline"
                onClick={() => setShowAllMoves(true)}
              >
                Show all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Desktop: 3-column */}
      <div className="hidden md:flex h-full min-h-0 w-full flex-1 flex-row gap-4 overflow-hidden">
        <div className="w-[200px] shrink-0 flex flex-col gap-2 overflow-y-auto overflow-x-hidden">
          <GamePlayerRow
            username={player1.username}
            avatarLetter={player1.username.charAt(0)}
            avatarClassName="bg-gradient-to-br from-teal/40 to-purple/40 text-charcoal"
            scoreRight={materialAdvantage > 0 ? `+${materialAdvantage}` : "—"}
            active={p1Active}
            isPractice={isPractice}
            rating={player1.rating}
            footer={capturedFooter(capturedWhite, "b")}
          />
          <GamePlayerRow
            username={player2.username}
            avatarLetter={player2.username.charAt(0)}
            avatarClassName="bg-gradient-to-br from-purple/40 to-rose-500/40"
            scoreRight={materialAdvantage < 0 ? `+${Math.abs(materialAdvantage)}` : "—"}
            active={p2Active}
            isPractice={isPractice}
            rating={player2.rating}
            isBot={isPlayer2Bot}
            footer={capturedFooter(capturedBlack, "w")}
            thinking={
              botThinking || (isMultiplayer && turn === (myRole === "player1" ? "b" : "w"))
            }
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center justify-center overflow-hidden">
          <div
            ref={boardSlotDesktopRef}
            className="game-board-slot-desktop flex items-center justify-center overflow-hidden"
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
              showCoordinates={true}
            />
          </div>
          <div className="mt-2 flex w-full max-w-[500px] items-center justify-between text-sm text-body-gray">
            <span>
              {(() => {
                const myColor = isMultiplayer ? (myRole === "player1" ? "w" : "b") : "w";
                const myTurn = turn === myColor;
                return myTurn ? "Your Turn" : "Opponent's Turn";
              })()}
            </span>
          </div>
        </div>

        <div className="w-[280px] shrink-0 min-h-0">
          <div
            className="flex h-full max-h-full min-h-0 flex-col rounded-lg border border-white/10 bg-card/80 overflow-hidden"
            style={{ overflowX: "hidden" }}
          >
            <h3 className="shrink-0 border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">Moves</h3>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 flex flex-col">
              <p key="start" className="text-center text-xs text-body-gray py-2 shrink-0">
                ♟ Game Started • White: {player1.username} vs Black: {player2.username}
                {isPlayer2Bot ? " 🤖" : ""}
              </p>
              {moveHistory.length === 0 ? (
                <p className="text-center text-sm text-body-gray py-4">Make the first move!</p>
              ) : (
                <>
                  {moveHistory.map((bubble, i) => {
                    const isPlayer1 = bubble.player === 1;
                    return (
                      <div key={`move-${i}-${bubble.san}`}>
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
                </>
              )}
            </div>
          </div>
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
