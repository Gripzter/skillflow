"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  createEmptyBoard,
  dropDisc,
  checkWin,
  isBoardFull,
  getNextRow,
  getValidColumns,
  COLS,
  ROWS,
  type Board,
  type Player,
  type WinResult,
} from "@/lib/games/connect4-logic";
import { getConnect4BotMove, getConnect4BotDelayMs, type BotDifficulty } from "@/lib/games/bot-engine";

const BOARD_BG = "#1A1A22";
const CELL_BORDER = "#2A2A38";
const HOLE_BG = "#0E0E12";
const RED_CENTER = "#FF4444";
const RED_EDGE = "#CC0000";
const YELLOW_CENTER = "#FFDD44";
const YELLOW_EDGE = "#CCAA00";

import type { GameMultiplayerProps } from "./Chess";
import { GamePlayerRow, GamePlayerStack, PlayerColorDot } from "@/components/games/GamePlayerStrip";
import { MobilePlayerCards } from "@/components/games/MobilePlayerCards";

interface ConnectFourProps extends GameMultiplayerProps {
  player1: { username: string; rating: number };
  player2: { username: string; rating: number };
  onGameEnd: (winner: "player1" | "player2") => void;
  onGameDraw: () => void;
  isPlayer2Bot?: boolean;
  botDifficulty?: BotDifficulty;
}

type MoveHistoryEntry = { player: 1 | 2; playerName: string; col: number; ts: number };

function formatTs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ConnectFour({
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
}: ConnectFourProps) {
  const [board, setBoard] = useState<Board>(() => createEmptyBoard());
  const [turn, setTurn] = useState<Player>(1);
  const [moveHistory, setMoveHistory] = useState<MoveHistoryEntry[]>([]);
  const [botThinking, setBotThinking] = useState(false);
  const [winResult, setWinResult] = useState<WinResult>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [dropping, setDropping] = useState<{ col: number; row: number; player: Player } | null>(null);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const gameOverRef = useRef(false);
  const gameStartTimeRef = useRef(Date.now());
  const moveListEndRef = useRef<HTMLDivElement | null>(null);
  const boardSlotMobileRef = useRef<HTMLDivElement>(null);
  const boardSlotDesktopRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(48);
  const lastProcessedEventRef = useRef<Record<string, unknown> | null>(null);

  const validColumns = useMemo(() => getValidColumns(board), [board]);
  const isColumnFull = useCallback(
    (col: number) => getNextRow(board, col) < 0,
    [board]
  );

  // Size board from the actual board column so it never overflows or gets cut off.
  // Board width = 7*cellSize + 24, board + preview height = 7*cellSize + 37.
  const updateCellSize = useCallback(() => {
    const m = boardSlotMobileRef.current;
    const d = boardSlotDesktopRef.current;
    const el =
      m && m.getBoundingClientRect().width > 0 && m.getBoundingClientRect().height > 0
        ? m
        : d && d.getBoundingClientRect().width > 0 && d.getBoundingClientRect().height > 0
          ? d
          : m || d;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w <= 0 || h <= 0) return;
    const pad = 8;
    const availableWidth = Math.max(120, w - pad * 2);
    const availableHeight = Math.max(120, h - pad * 2);
    const maxByWidth = (availableWidth - 24) / COLS;
    const maxByHeight = (availableHeight - 37) / (ROWS + 1);
    const raw = Math.floor(Math.min(maxByWidth, maxByHeight));
    if (!Number.isFinite(raw) || raw <= 0) return;
    setCellSize(Math.max(28, Math.min(raw, 75)));
  }, []);

  useLayoutEffect(() => {
    updateCellSize();
  }, [updateCellSize]);

  useEffect(() => {
    const ro = new ResizeObserver(updateCellSize);
    if (boardSlotMobileRef.current) ro.observe(boardSlotMobileRef.current);
    if (boardSlotDesktopRef.current) ro.observe(boardSlotDesktopRef.current);
    updateCellSize();
    window.addEventListener("resize", updateCellSize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateCellSize);
    };
  }, [updateCellSize]);

  useEffect(() => {
    window.addEventListener("resize", updateCellSize);
    return () => window.removeEventListener("resize", updateCellSize);
  }, [updateCellSize]);

  const handleDrop = useCallback(
    (col: number) => {
      if (gameOverRef.current) return;
      const isMyTurn =
        (turn === 1 && myRole === "player1") || (turn === 2 && myRole === "player2");
      if (!isMyTurn) return;
      const result = dropDisc(board, col, turn);
      if (!result) return;
      const playerName = turn === 1 ? player1.username : player2.username;
      setDropping({ col, row: result.row, player: turn });
      setBoard(result.board);
      const ts = (Date.now() - gameStartTimeRef.current) / 1000;
      setMoveHistory((prev) => [...prev, { player: turn, playerName, col, ts }]);
      const win = checkWin(result.board);
      if (win) {
        setTimeout(() => {
          setWinResult(win);
          setTimeout(() => {
            gameOverRef.current = true;
            onGameEnd(win.player === 1 ? "player1" : "player2");
          }, 1500);
        }, 520);
      } else if (isBoardFull(result.board)) {
        setTimeout(() => {
          setIsDraw(true);
          gameOverRef.current = true;
          onGameDraw();
        }, 520);
      } else {
        setTurn(turn === 1 ? 2 : 1);
      }
      if (isMultiplayer && sendGameEvent) {
        sendGameEvent({ type: "connect4_move", column: col }).catch(() => {});
      }
    },
    [board, turn, myRole, player1.username, player2.username, onGameEnd, onGameDraw, isMultiplayer, sendGameEvent]
  );

  // Incoming multiplayer events: apply opponent move or handle resign
  useEffect(() => {
    if (!incomingEvent || !onEventProcessed || incomingEvent === lastProcessedEventRef.current) return;
    const type = incomingEvent.type as string | undefined;
    if (type === "connect4_move") {
      const column = incomingEvent.column as number | undefined;
      if (typeof column !== "number" || column < 0 || column > 6 || gameOverRef.current) {
        onEventProcessed();
        return;
      }
      const nextRow = getNextRow(board, column);
      if (nextRow < 0) {
        onEventProcessed();
        return;
      }
      lastProcessedEventRef.current = incomingEvent;
      const result = dropDisc(board, column, turn);
      if (!result) {
        onEventProcessed();
        return;
      }
      const playerName = turn === 1 ? player1.username : player2.username;
      setDropping({ col: column, row: result.row, player: turn });
      setBoard(result.board);
      const ts = (Date.now() - gameStartTimeRef.current) / 1000;
      setMoveHistory((prev) => [...prev, { player: turn, playerName, col: column, ts }]);
      const win = checkWin(result.board);
      if (win) {
        setTimeout(() => {
          setWinResult(win);
          setTimeout(() => {
            gameOverRef.current = true;
            onGameEnd(win.player === 1 ? "player1" : "player2");
          }, 1500);
        }, 520);
      } else if (isBoardFull(result.board)) {
        setTimeout(() => {
          setIsDraw(true);
          gameOverRef.current = true;
          onGameDraw();
        }, 520);
      } else {
        setTurn(turn === 1 ? 2 : 1);
      }
      onEventProcessed();
      return;
    }
    if (type === "resign") {
      lastProcessedEventRef.current = incomingEvent;
      gameOverRef.current = true;
      onGameEnd(myRole);
      onEventProcessed();
    }
  }, [incomingEvent, onEventProcessed, board, turn, player1.username, player2.username, myRole, onGameEnd, onGameDraw]);

  const boardKey = board.map((r) => r.join("")).join("|");
  useEffect(() => {
    if (dropping) return;
    if (isMultiplayer || !isPlayer2Bot || turn !== 2 || gameOverRef.current) return;
    setBotThinking(true);
    const delay = getConnect4BotDelayMs(botDifficulty);
    const t = setTimeout(() => {
      const col = getConnect4BotMove(board, botDifficulty);
      if (col === null) {
        setBotThinking(false);
        return;
      }
      const result = dropDisc(board, col, 2);
      if (!result) {
        setBotThinking(false);
        return;
      }
      setDropping({ col, row: result.row, player: 2 });
      setBoard(result.board);
      const ts = (Date.now() - gameStartTimeRef.current) / 1000;
      setMoveHistory((prev) => [...prev, { player: 2, playerName: player2.username, col, ts }]);
      const win = checkWin(result.board);
      if (win) {
        setTimeout(() => {
          setWinResult(win);
          setTimeout(() => {
            gameOverRef.current = true;
            onGameEnd("player2");
          }, 1500);
        }, 520);
      } else if (isBoardFull(result.board)) {
        setTimeout(() => {
          setIsDraw(true);
          gameOverRef.current = true;
          onGameDraw();
        }, 520);
      } else {
        setTurn(1);
      }
      setBotThinking(false);
    }, delay);
    return () => clearTimeout(t);
  }, [boardKey, turn, isPlayer2Bot, botDifficulty, isMultiplayer, board, player2.username, onGameEnd, onGameDraw, dropping]);

  useEffect(() => {
    if (dropping) {
      const t = setTimeout(() => setDropping(null), 520);
      return () => clearTimeout(t);
    }
  }, [dropping]);

  useEffect(() => {
    moveListEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [moveHistory.length]);

  const winSet = useMemo(() => {
    if (!winResult) return null;
    return new Set(winResult.cells.map(([r, c]) => `${r},${c}`));
  }, [winResult]);

  const boardWidth = cellSize * COLS + (COLS + 1) * 3;
  const boardHeight = cellSize * ROWS + (ROWS + 1) * 3;
  const isPractice = !isMultiplayer;
  const ACCENT_P1 = "#FF5E00";
  const ACCENT_P2 = "#A855F7";
  const isMyTurn = (turn === 1 && myRole === "player1") || (turn === 2 && myRole === "player2");

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden md:hidden">
        <MobilePlayerCards
          player1Name={player1.username}
          player1Right="—"
          player2Name={player2.username}
          player2Right="—"
          player1Active={turn === 1}
          player2Active={turn === 2}
        />

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <div ref={boardSlotMobileRef} className="game-connect4-slot-mobile relative flex items-center justify-center overflow-hidden">
            <div className="relative flex max-h-full max-w-full shrink-0 flex-col items-center overflow-hidden">
              {/* Hover disc preview above board */}
              <div
                className="relative flex justify-center"
                style={{ width: boardWidth, height: cellSize + 16 }}
              >
                {hoverCol !== null && !isColumnFull(hoverCol) && ((turn === 1 && myRole === "player1") || (turn === 2 && myRole === "player2")) && !dropping && !gameOverRef.current && (
                  <div
                    className="absolute rounded-full opacity-50 pointer-events-none"
                    style={{
                      width: cellSize - 6,
                      height: cellSize - 6,
                      left: 3 + hoverCol * (cellSize + 3) + (cellSize - (cellSize - 6)) / 2,
                      top: 8,
                      background: turn === 1
                        ? `radial-gradient(circle at 30% 30%, ${RED_CENTER}, ${RED_EDGE})`
                        : `radial-gradient(circle at 30% 30%, ${YELLOW_CENTER}, ${YELLOW_EDGE})`,
                      boxShadow: "inset -2px -2px 4px rgba(0,0,0,0.3), inset 2px 2px 4px rgba(255,255,255,0.2)",
                    }}
                  />
                )}
              </div>

              {/* Board */}
              <div
                className="rounded-2xl p-3 flex flex-col gap-[3px] relative overflow-hidden"
                style={{
                  backgroundColor: BOARD_BG,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
                  width: boardWidth,
                  height: boardHeight,
                  cursor:
                    hoverCol !== null && ((turn === 1 && myRole === "player1") || (turn === 2 && myRole === "player2"))
                      ? isColumnFull(hoverCol)
                        ? "not-allowed"
                        : "pointer"
                      : "default",
                }}
              >
                {[0, 1, 2, 3, 4, 5].map((row) => (
                  <div
                    key={row}
                    className="flex gap-[3px] flex-none"
                    style={{ height: cellSize + 3, width: boardWidth - 6 }}
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((col) => {
                      const cell = board[row][col];
                      const isWinCell = winSet?.has(`${row},${col}`);
                      const isDroppingHere = dropping?.col === col && dropping?.row === row;
                      const dropPlayer = isDroppingHere ? dropping!.player : null;
                      const showDisc = cell !== 0 || dropPlayer;
                      const discPlayer = cell || dropPlayer;
                      const dropFromY = -(row * (cellSize + 3));
                      return (
                        <div
                          key={`${row}-${col}`}
                          data-col={col}
                          data-row={row}
                          className="rounded-full flex items-center justify-center transition-opacity flex-none"
                          style={{
                            width: cellSize + 3,
                            height: cellSize + 3,
                            backgroundColor: HOLE_BG,
                            border: `3px solid ${CELL_BORDER}`,
                            opacity: winResult && !isWinCell ? 0.5 : 1,
                          }}
                          onMouseEnter={() => setHoverCol(col)}
                          onMouseLeave={() => setHoverCol(null)}
                          onClick={() => handleDrop(col)}
                        >
                          {showDisc && (
                            <div
                              className="rounded-full connect4-disc"
                              style={{
                                width: cellSize - 4,
                                height: cellSize - 4,
                                background:
                                  discPlayer === 1
                                    ? `radial-gradient(circle at 32% 28%, ${RED_CENTER}, 70%, ${RED_EDGE})`
                                    : `radial-gradient(circle at 32% 28%, ${YELLOW_CENTER}, 70%, ${YELLOW_EDGE})`,
                                boxShadow: isWinCell
                                  ? "0 0 16px rgba(255, 94, 0, 0.8), inset -2px -2px 4px rgba(0,0,0,0.3)"
                                  : "inset -3px -3px 6px rgba(0,0,0,0.35), inset 3px 3px 6px rgba(255,255,255,0.25)",
                                border: isWinCell ? "3px solid rgba(255, 94, 0, 0.9)" : undefined,
                                ["--drop-from" as string]: `${dropFromY}px`,
                                animation: isDroppingHere ? "connect4Drop 500ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards" : "none",
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {winResult && (
                  <svg
                    className="absolute pointer-events-none inset-0 rounded-2xl"
                    width={boardWidth}
                    height={boardHeight}
                    style={{ left: 0, top: 0 }}
                  >
                    <line
                      x1={3 + winResult.cells[0][1] * (cellSize + 3) + cellSize / 2}
                      y1={3 + winResult.cells[0][0] * (cellSize + 3) + cellSize / 2}
                      x2={3 + winResult.cells[3][1] * (cellSize + 3) + cellSize / 2}
                      y2={3 + winResult.cells[3][0] * (cellSize + 3) + cellSize / 2}
                      stroke="rgba(255, 94, 0, 0.95)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Game status (~30px) */}
        <div className="flex h-[30px] shrink-0 items-center justify-between px-3">
          <span
            className="min-w-0 truncate text-[13px] font-medium"
            style={{ color: isMyTurn ? (myRole === "player1" ? ACCENT_P1 : ACCENT_P2) : "rgba(148, 163, 184, 1)" }}
          >
            {isMyTurn ? "Your Turn" : "Opponent's Turn"}
          </span>
          <span className="shrink-0 text-[13px] text-body-gray tabular-nums">15s</span>
        </div>

        {/* Game Log (~100px fixed) */}
        <div
          className="h-[100px] min-h-[100px] max-h-[100px] w-full shrink-0 flex flex-col overflow-hidden rounded-lg border border-white/10 bg-card/80"
            style={{ overflowX: "hidden" }}
          >
          <h3 className="shrink-0 border-b border-white/10 px-3 py-2 text-[11px] font-semibold text-white">
            Game Log
          </h3>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2 flex flex-col">
            <p className="text-center text-[11px] text-body-gray py-2 shrink-0">
                🔴🟡 Game Started • {player1.username} vs {player2.username}
                {isPlayer2Bot ? " 🤖" : ""}
              </p>
              {moveHistory.length === 0 ? (
              <p className="text-center text-[11px] text-body-gray py-3">Drop a disc to start!</p>
              ) : (
                moveHistory.map((entry, i) => {
                  const isP1 = entry.player === 1;
                  return (
                    <div
                      key={`${i}-${entry.col}`}
                      ref={i === moveHistory.length - 1 ? moveListEndRef : undefined}
                      className="mb-2 flex max-w-[75%] shrink-0"
                      style={{ marginLeft: isP1 ? "auto" : 0, marginRight: isP1 ? 0 : 40 }}
                    >
                      <div
                        className="rounded-xl px-3.5 py-2.5"
                        style={{
                          backgroundColor: isP1 ? "rgba(204, 0, 0, 0.25)" : "rgba(204, 170, 0, 0.2)",
                          borderLeft: isP1 ? "3px solid rgba(255, 68, 68, 0.6)" : "3px solid rgba(255, 221, 68, 0.6)",
                        }}
                      >
                        <p
                          className="text-xs font-bold"
                          style={{ color: isP1 ? "#f87171" : "#facc15" }}
                        >
                          {entry.playerName}{entry.player === 2 && isPlayer2Bot ? " 🤖" : ""}
                        </p>
                        <p className="text-sm text-white mt-0.5">
                          Dropped in column {entry.col + 1}
                        </p>
                        <p className="text-[11px] text-body-gray mt-1 tabular-nums">
                          Col {entry.col + 1} • {formatTs(entry.ts)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              {(winResult || isDraw) && (
                <p className="text-center text-sm text-white/90 py-2 font-medium shrink-0">
                  {winResult
                    ? `🏆 ${winResult.player === 1 ? player1.username : player2.username} wins!`
                    : "🤝 Draw!"}
                </p>
              )}
            </div>
          </div>
        </div>

      {/* Desktop: standardized 3-column layout */}
      <div className="hidden md:flex h-full min-h-0 w-full flex-1 flex-row gap-4 overflow-hidden">
        <div className="flex w-[200px] shrink-0 flex-col gap-2 overflow-y-auto overflow-x-hidden">
          <GamePlayerRow
            username={player1.username}
            avatarLetter={player1.username.charAt(0)}
            avatarClassName="bg-gradient-to-br from-red-600 to-red-800 text-white"
            nameDot={<PlayerColorDot color={RED_EDGE} />}
            scoreRight="—"
            active={turn === 1}
            isPractice={isPractice}
            rating={player1.rating}
          />
          <GamePlayerRow
            username={player2.username}
            avatarLetter={player2.username.charAt(0)}
            avatarClassName="bg-gradient-to-br from-amber-400 to-amber-600 text-gray-900"
            nameDot={<PlayerColorDot color={YELLOW_CENTER} />}
            scoreRight="—"
            active={turn === 2}
            isPractice={isPractice}
            rating={player2.rating}
            isBot={isPlayer2Bot}
            thinking={
              botThinking || (isMultiplayer && turn === (myRole === "player1" ? 2 : 1))
            }
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden">
          <div ref={boardSlotDesktopRef} className="game-connect4-slot-desktop">
            <div className="relative flex max-h-full max-w-full shrink-0 flex-col items-center overflow-hidden">
              <div className="relative flex justify-center" style={{ width: boardWidth, height: cellSize + 16 }}>
                {hoverCol !== null && !isColumnFull(hoverCol) && ((turn === 1 && myRole === "player1") || (turn === 2 && myRole === "player2")) && !dropping && !gameOverRef.current && (
                  <div
                    className="absolute rounded-full opacity-50 pointer-events-none"
                    style={{
                      width: cellSize - 6,
                      height: cellSize - 6,
                      left: 3 + hoverCol * (cellSize + 3) + (cellSize - (cellSize - 6)) / 2,
                      top: 8,
                      background: turn === 1
                        ? `radial-gradient(circle at 30% 30%, ${RED_CENTER}, ${RED_EDGE})`
                        : `radial-gradient(circle at 30% 30%, ${YELLOW_CENTER}, ${YELLOW_EDGE})`,
                      boxShadow: "inset -2px -2px 4px rgba(0,0,0,0.3), inset 2px 2px 4px rgba(255,255,255,0.2)",
                    }}
                  />
                )}
              </div>

              <div
                className="rounded-2xl p-3 flex flex-col gap-[3px] relative overflow-hidden"
                style={{
                  backgroundColor: BOARD_BG,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
                  width: boardWidth,
                  height: boardHeight,
                  cursor:
                    hoverCol !== null && ((turn === 1 && myRole === "player1") || (turn === 2 && myRole === "player2"))
                      ? isColumnFull(hoverCol)
                        ? "not-allowed"
                        : "pointer"
                      : "default",
                }}
              >
                {[0, 1, 2, 3, 4, 5].map((row) => (
                  <div
                    key={row}
                    className="flex gap-[3px] flex-none"
                    style={{ height: cellSize + 3, width: boardWidth - 6 }}
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((col) => {
                      const cell = board[row][col];
                      const isWinCell = winSet?.has(`${row},${col}`);
                      const isDroppingHere = dropping?.col === col && dropping?.row === row;
                      const dropPlayer = isDroppingHere ? dropping!.player : null;
                      const showDisc = cell !== 0 || dropPlayer;
                      const discPlayer = cell || dropPlayer;
                      const dropFromY = -(row * (cellSize + 3));
                      return (
                        <div
                          key={`${row}-${col}`}
                          className="rounded-full flex items-center justify-center transition-opacity flex-none"
                          style={{
                            width: cellSize + 3,
                            height: cellSize + 3,
                            backgroundColor: HOLE_BG,
                            border: `3px solid ${CELL_BORDER}`,
                            opacity: winResult && !isWinCell ? 0.5 : 1,
                          }}
                          onMouseEnter={() => setHoverCol(col)}
                          onMouseLeave={() => setHoverCol(null)}
                          onClick={() => handleDrop(col)}
                        >
                          {showDisc && (
                            <div
                              className="rounded-full connect4-disc"
                              style={{
                                width: cellSize - 4,
                                height: cellSize - 4,
                                background:
                                  discPlayer === 1
                                    ? `radial-gradient(circle at 32% 28%, ${RED_CENTER}, 70%, ${RED_EDGE})`
                                    : `radial-gradient(circle at 32% 28%, ${YELLOW_CENTER}, 70%, ${YELLOW_EDGE})`,
                                boxShadow: isWinCell
                                  ? "0 0 16px rgba(255, 94, 0, 0.8), inset -2px -2px 4px rgba(0,0,0,0.3)"
                                  : "inset -3px -3px 6px rgba(0,0,0,0.35), inset 3px 3px 6px rgba(255,255,255,0.25)",
                                border: isWinCell ? "3px solid rgba(255, 94, 0, 0.9)" : undefined,
                                ["--drop-from" as string]: `${dropFromY}px`,
                                animation: isDroppingHere ? "connect4Drop 500ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards" : "none",
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {winResult && (
                  <svg
                    className="absolute pointer-events-none inset-0 rounded-2xl"
                    width={boardWidth}
                    height={boardHeight}
                    style={{ left: 0, top: 0 }}
                  >
                    <line
                      x1={3 + winResult.cells[0][1] * (cellSize + 3) + cellSize / 2}
                      y1={3 + winResult.cells[0][0] * (cellSize + 3) + cellSize / 2}
                      x2={3 + winResult.cells[3][1] * (cellSize + 3) + cellSize / 2}
                      y2={3 + winResult.cells[3][0] * (cellSize + 3) + cellSize / 2}
                      stroke="rgba(255, 94, 0, 0.95)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 flex w-full max-w-[550px] items-center justify-between text-sm">
            <span className="text-body-gray">
              {((turn === 1 && myRole === "player1") || (turn === 2 && myRole === "player2")) ? "Your Turn" : "Opponent's Turn"}
            </span>
            <span className="text-body-gray"> </span>
          </div>
        </div>

        {/* Right: move log */}
        <div
          className="flex w-[280px] shrink-0 flex-col rounded-lg border border-white/10 bg-card/80 min-h-0 overflow-hidden flex-shrink-0 flex-grow-0 md:min-h-[500px] md:max-h-[500px]"
          style={{ overflowX: "hidden" }}
        >
          <h3 className="shrink-0 border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">Moves</h3>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 flex flex-col">
            <p className="text-center text-xs text-body-gray py-2 shrink-0">
              🔴🟡 Game Started • {player1.username} vs {player2.username}
              {isPlayer2Bot ? " 🤖" : ""}
            </p>
            {moveHistory.length === 0 ? (
              <p className="text-center text-sm text-body-gray py-4">Drop a disc to start!</p>
            ) : (
              moveHistory.map((entry, i) => {
                const isP1 = entry.player === 1;
                return (
                  <div
                    key={`${i}-${entry.col}`}
                    ref={i === moveHistory.length - 1 ? moveListEndRef : undefined}
                    className="mb-2 flex max-w-[75%] shrink-0"
                    style={{ marginLeft: isP1 ? "auto" : 0, marginRight: isP1 ? 0 : 40 }}
                  >
                    <div
                      className="rounded-xl px-3.5 py-2.5"
                      style={{
                        backgroundColor: isP1 ? "rgba(204, 0, 0, 0.25)" : "rgba(204, 170, 0, 0.2)",
                        borderLeft: isP1 ? "3px solid rgba(255, 68, 68, 0.6)" : "3px solid rgba(255, 221, 68, 0.6)",
                      }}
                    >
                      <p className="text-xs font-bold" style={{ color: isP1 ? "#f87171" : "#facc15" }}>
                        {entry.playerName}{entry.player === 2 && isPlayer2Bot ? " 🤖" : ""}
                      </p>
                      <p className="text-sm text-white mt-0.5">Dropped in column {entry.col + 1}</p>
                      <p className="text-[11px] text-body-gray mt-1 tabular-nums">
                        Col {entry.col + 1} • {formatTs(entry.ts)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            {(winResult || isDraw) && (
              <p className="text-center text-sm text-white/90 py-2 font-medium shrink-0">
                {winResult ? `🏆 ${winResult.player === 1 ? player1.username : player2.username} wins!` : "🤝 Draw!"}
              </p>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes connect4Drop {
          from { transform: translateY(var(--drop-from, 0)); }
          85% { transform: translateY(5px); }
          to { transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
