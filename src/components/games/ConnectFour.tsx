"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { getConnect4BotMove, getConnect4BotDelayMs } from "@/lib/games/bot-engine";

const BOARD_BG = "#1565C0";
const CELL_BORDER = "#0D47A1";
const HOLE_BG = "#0D0F14";
const RED_CENTER = "#FF4444";
const RED_EDGE = "#CC0000";
const YELLOW_CENTER = "#FFDD44";
const YELLOW_EDGE = "#CCAA00";

interface ConnectFourProps {
  player1: { username: string; rating: number };
  player2: { username: string; rating: number };
  onGameEnd: (winner: "player1" | "player2") => void;
  onGameDraw: () => void;
  isPlayer2Bot?: boolean;
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
  const boardRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(56);

  const validColumns = useMemo(() => getValidColumns(board), [board]);
  const isColumnFull = useCallback(
    (col: number) => getNextRow(board, col) < 0,
    [board]
  );

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const width = Math.min(500, window.innerWidth * 0.9);
    const cell = Math.floor((width - 24 - (COLS + 1) * 3) / COLS);
    setCellSize(Math.max(40, Math.min(cell, 64)));
  }, []);

  const handleDrop = useCallback(
    (col: number) => {
      if (gameOverRef.current || turn !== 1) return;
      const result = dropDisc(board, col, 1);
      if (!result) return;
      setDropping({ col, row: result.row, player: 1 });
      setBoard(result.board);
      const ts = (Date.now() - gameStartTimeRef.current) / 1000;
      setMoveHistory((prev) => [...prev, { player: 1, playerName: player1.username, col, ts }]);
      const win = checkWin(result.board);
      if (win) {
        setTimeout(() => {
          setWinResult(win);
          setTimeout(() => {
            gameOverRef.current = true;
            onGameEnd("player1");
          }, 1500);
        }, 520);
      } else if (isBoardFull(result.board)) {
        setTimeout(() => {
          setIsDraw(true);
          gameOverRef.current = true;
          onGameDraw();
        }, 520);
      } else {
        setTurn(2);
      }
    },
    [board, turn, player1.username, onGameEnd, onGameDraw]
  );

  const boardKey = board.map((r) => r.join("")).join("|");
  useEffect(() => {
    if (dropping) return;
    if (!isPlayer2Bot || turn !== 2 || gameOverRef.current) return;
    setBotThinking(true);
    const delay = getConnect4BotDelayMs();
    const t = setTimeout(() => {
      const col = getConnect4BotMove(board);
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
  }, [boardKey, turn, isPlayer2Bot, board, player2.username, onGameEnd, onGameDraw, dropping]);

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

  return (
    <div className="flex h-full min-h-0 w-full flex-col lg:flex-row lg:gap-6">
      <div className="flex flex-1 flex-col items-center gap-3 py-4 lg:min-w-0">
        {/* Player bar */}
        <div className="flex w-full max-w-[min(500px,90vw)] items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold text-sm">
              {player1.username.charAt(0)}
            </div>
            <span className="text-sm font-medium text-white truncate max-w-[100px]">{player1.username}</span>
            <span className="text-lg" title="Red">🔴</span>
          </div>
          <div
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              turn === 1 ? "bg-red-500/90 text-white" : "bg-amber-400/90 text-gray-900"
            }`}
          >
            {turn === 1 ? "Player 1's Turn" : "Player 2's Turn"}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg" title="Yellow">🟡</span>
            <span className="text-sm font-medium text-white truncate max-w-[100px]">{player2.username}</span>
            {isPlayer2Bot && (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-body-gray">🤖 BOT</span>
            )}
            {botThinking && <span className="animate-pulse text-body-gray text-sm">...</span>}
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-gray-900 font-bold text-sm">
              {player2.username.charAt(0)}
            </div>
          </div>
        </div>

        {/* Board container: hover preview above + grid */}
        <div ref={boardRef} className="flex flex-col items-center relative">
          {/* Hover disc preview above board */}
          <div
            className="relative flex justify-center"
            style={{ width: boardWidth, height: cellSize + 16 }}
          >
            {hoverCol !== null && !isColumnFull(hoverCol) && turn === 1 && !dropping && !gameOverRef.current && (
              <div
                className="absolute rounded-full opacity-50 pointer-events-none"
                style={{
                  width: cellSize - 6,
                  height: cellSize - 6,
                  left: 3 + hoverCol * (cellSize + 3) + (cellSize - (cellSize - 6)) / 2,
                  top: 8,
                  background: `radial-gradient(circle at 30% 30%, ${RED_CENTER}, ${RED_EDGE})`,
                  boxShadow: "inset -2px -2px 4px rgba(0,0,0,0.3), inset 2px 2px 4px rgba(255,255,255,0.2)",
                }}
              />
            )}
          </div>

          {/* Board */}
          <div
            className="rounded-2xl p-3 flex flex-col gap-[3px] relative"
            style={{
              backgroundColor: BOARD_BG,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
              width: boardWidth,
              height: boardHeight,
              cursor: hoverCol !== null && turn === 1 ? (isColumnFull(hoverCol) ? "not-allowed" : "pointer") : "default",
            }}
          >
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="flex gap-[3px]" style={{ height: cellSize + 3 }}>
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
                      className="rounded-full flex items-center justify-center transition-opacity"
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
                              ? "0 0 16px rgba(0, 229, 199, 0.8), inset -2px -2px 4px rgba(0,0,0,0.3)"
                              : "inset -3px -3px 6px rgba(0,0,0,0.35), inset 3px 3px 6px rgba(255,255,255,0.25)",
                            border: isWinCell ? "3px solid rgba(0, 229, 199, 0.9)" : undefined,
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
                  stroke="rgba(0, 229, 199, 0.95)"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Move log */}
      <div className="flex w-full flex-col rounded-lg border border-white/10 bg-card/80 lg:w-[32%] lg:min-w-[240px] min-h-0">
        <h3 className="shrink-0 border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">Moves</h3>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col" style={{ maxHeight: 400 }}>
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
