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
const HOLE_BG = "#0E0E12";
const RED_CENTER = "#FF4444";
const RED_EDGE = "#CC0000";
const YELLOW_CENTER = "#FFDD44";
const YELLOW_EDGE = "#CCAA00";

import type { GameMultiplayerProps } from "./Chess";
import type { MatchUiState } from "@/components/game/matchUi";

interface ConnectFourProps extends GameMultiplayerProps {
  player1: { username: string; rating: number };
  player2: { username: string; rating: number };
  onGameEnd: (winner: "player1" | "player2") => void;
  onGameDraw: () => void;
  isPlayer2Bot?: boolean;
  botDifficulty?: BotDifficulty;
}

type MoveHistoryEntry = { player: 1 | 2; playerName: string; col: number; ts: number };

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
  onPlayerAction,
  incomingEvent,
  onEventProcessed,
  onMatchUi,
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
  const boardSlotRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(48);
  const lastProcessedEventRef = useRef<Record<string, unknown> | null>(null);

  const validColumns = useMemo(() => getValidColumns(board), [board]);
  const isColumnFull = useCallback(
    (col: number) => getNextRow(board, col) < 0,
    [board]
  );

  // GAP = 4px between cells, PAD = 8px board padding
  // boardWidth  = COLS*cs + (COLS-1)*4 + 16  →  maxByW = (availW - 40) / 7
  // hoverRow    = cs + 12
  // boardHeight = ROWS*cs + (ROWS-1)*4 + 16  →  totalH = (ROWS+1)*cs + 48
  //                                           →  maxByH = (availH - 48) / 7
  const updateCellSize = useCallback(() => {
    const el = boardSlotRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w <= 0 || h <= 0) return;
    const availW = Math.max(120, w - 8);
    const availH = Math.max(120, h - 8);
    const maxByWidth = (availW - (COLS - 1) * 4 - 16) / COLS;
    const maxByHeight = (availH - (ROWS - 1) * 4 - 28) / (ROWS + 1);
    const raw = Math.floor(Math.min(maxByWidth, maxByHeight));
    if (!Number.isFinite(raw) || raw <= 0) return;
    setCellSize(Math.max(28, Math.min(raw, 75)));
  }, []);

  useLayoutEffect(() => {
    updateCellSize();
  }, [updateCellSize]);

  useEffect(() => {
    const ro = new ResizeObserver(updateCellSize);
    if (boardSlotRef.current) ro.observe(boardSlotRef.current);
    updateCellSize();
    window.addEventListener("resize", updateCellSize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateCellSize);
    };
  }, [updateCellSize]);

  const handleDrop = useCallback(
    (col: number) => {
      if (gameOverRef.current) return;
      const isMyTurn =
        (turn === 1 && myRole === "player1") || (turn === 2 && myRole === "player2");
      if (!isMyTurn) return;
      const result = dropDisc(board, col, turn);
      if (!result) return;
      onPlayerAction?.();
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
        sendGameEvent({ type: "connect4_move", column: col, byRole: myRole }).catch(() => {});
      }
    },
    [board, turn, myRole, player1.username, player2.username, onGameEnd, onGameDraw, isMultiplayer, sendGameEvent, onPlayerAction]
  );

  // Incoming multiplayer events: apply opponent move or handle resign
  useEffect(() => {
    if (!incomingEvent || !onEventProcessed || incomingEvent === lastProcessedEventRef.current) return;
    const type = incomingEvent.type as string | undefined;
    if (type === "connect4_move") {
      const byRole = incomingEvent.byRole as "player1" | "player2" | undefined;
      if (byRole && byRole === myRole) {
        onEventProcessed();
        return;
      }
      const isLocalTurn =
        (turn === 1 && myRole === "player1") || (turn === 2 && myRole === "player2");
      if (isLocalTurn) {
        onEventProcessed();
        return;
      }
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

  const winSet = useMemo(() => {
    if (!winResult) return null;
    return new Set(winResult.cells.map(([r, c]) => `${r},${c}`));
  }, [winResult]);

  const GAP = 4;
  const PAD = 8;
  const boardWidth = COLS * cellSize + (COLS - 1) * GAP + PAD * 2;
  const boardHeight = ROWS * cellSize + (ROWS - 1) * GAP + PAD * 2;
  const isMyTurn = (turn === 1 && myRole === "player1") || (turn === 2 && myRole === "player2");

  useEffect(() => {
    if (!onMatchUi) return;
    const startTs = gameStartTimeRef.current;
    let turnText = "Waiting for opponent...";
    if (winResult) {
      turnText = `🏆 ${winResult.player === 1 ? player1.username : player2.username} wins!`;
    } else if (isDraw) {
      turnText = "Draw!";
    } else if (isMyTurn) {
      turnText = "YOUR TURN — Drop a disc!";
    } else {
      turnText = "Waiting for opponent...";
    }
    const systemLogEntries: MatchUiState["systemLogEntries"] = [
      {
        id: "game-start",
        text: `🔴🟡 Game started • ${player1.username} vs ${player2.username}${isPlayer2Bot ? " 🤖" : ""}`,
        timestamp: startTs,
      },
      ...moveHistory.map((e, i) => ({
        id: `move-${i}-${e.col}`,
        text: `${e.playerName} → column ${e.col + 1}`,
        timestamp: startTs + Math.round(e.ts * 1000),
      })),
    ];
    if (winResult) {
      systemLogEntries.push({
        id: "win",
        text: `${winResult.player === 1 ? player1.username : player2.username} wins!`,
        timestamp: Date.now(),
      });
    }
    if (isDraw) {
      systemLogEntries.push({ id: "draw", text: "Draw!", timestamp: Date.now() });
    }
    onMatchUi({
      scores: { player1: 0, player2: 0 },
      scoreLabel: "Score",
      currentTurn: turn === 1 ? "player1" : "player2",
      requiresAction: !winResult && !isDraw,
      turnText,
      systemLogEntries,
    });
  }, [
    onMatchUi,
    turn,
    moveHistory,
    winResult,
    isDraw,
    isMyTurn,
    player1.username,
    player2.username,
    isPlayer2Bot,
  ]);

  return (
    <div className="flex h-full max-h-full min-h-0 w-full flex-col items-center justify-center">
      <div ref={boardSlotRef} className="relative flex min-h-0 w-full flex-1 items-center justify-center">
        <div className="flex flex-col items-center">

          {/* Hover disc preview row */}
          <div className="relative" style={{ width: boardWidth, height: cellSize + 12 }}>
            {hoverCol !== null && !isColumnFull(hoverCol) && isMyTurn && !dropping && !gameOverRef.current && (
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: cellSize - 8,
                  height: cellSize - 8,
                  left: PAD + hoverCol * (cellSize + GAP) + 4,
                  top: 6,
                  opacity: 0.55,
                  background: turn === 1
                    ? `radial-gradient(circle at 30% 30%, ${RED_CENTER}, ${RED_EDGE})`
                    : `radial-gradient(circle at 30% 30%, ${YELLOW_CENTER}, ${YELLOW_EDGE})`,
                  boxShadow: "inset -2px -2px 4px rgba(0,0,0,0.3)",
                }}
              />
            )}
          </div>

          {/* Board — flat CSS grid, no border-radius, no overflow-hidden */}
          <div
            className="relative"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${ROWS}, ${cellSize}px)`,
              gap: GAP,
              padding: PAD,
              backgroundColor: BOARD_BG,
              cursor: hoverCol !== null && isMyTurn
                ? isColumnFull(hoverCol) ? "not-allowed" : "pointer"
                : "default",
            }}
            onMouseLeave={() => setHoverCol(null)}
          >
            {[0, 1, 2, 3, 4, 5].map((row) =>
              [0, 1, 2, 3, 4, 5, 6].map((col) => {
                const cell = board[row][col];
                const isWinCell = winSet?.has(`${row},${col}`);
                const isDroppingHere = dropping?.col === col && dropping?.row === row;
                const dropPlayer = isDroppingHere ? dropping!.player : null;
                const showDisc = cell !== 0 || !!dropPlayer;
                const discPlayer = cell || dropPlayer;
                const dropFromY = -(row * (cellSize + GAP));
                return (
                  <div
                    key={`${row}-${col}`}
                    className="flex items-center justify-center"
                    style={{
                      width: cellSize,
                      height: cellSize,
                      borderRadius: "50%",
                      backgroundColor: HOLE_BG,
                      boxShadow: "inset 0 4px 10px rgba(0,0,0,0.8), inset 0 1px 4px rgba(0,0,0,0.95)",
                      opacity: winResult && !isWinCell ? 0.4 : 1,
                    }}
                    onMouseEnter={() => setHoverCol(col)}
                    onClick={() => handleDrop(col)}
                  >
                    {showDisc && (
                      <div
                        className="rounded-full connect4-disc"
                        style={{
                          width: cellSize - 6,
                          height: cellSize - 6,
                          background: discPlayer === 1
                            ? `radial-gradient(circle at 32% 28%, ${RED_CENTER}, 70%, ${RED_EDGE})`
                            : `radial-gradient(circle at 32% 28%, ${YELLOW_CENTER}, 70%, ${YELLOW_EDGE})`,
                          boxShadow: isWinCell
                            ? "0 0 16px rgba(255,94,0,0.8), inset -2px -2px 4px rgba(0,0,0,0.3)"
                            : "inset -3px -3px 6px rgba(0,0,0,0.35), inset 3px 3px 6px rgba(255,255,255,0.25)",
                          border: isWinCell ? "3px solid rgba(255,94,0,0.9)" : undefined,
                          ["--drop-from" as string]: `${dropFromY}px`,
                          animation: isDroppingHere ? "connect4Drop 500ms cubic-bezier(0.34,1.56,0.64,1) forwards" : "none",
                        }}
                      />
                    )}
                  </div>
                );
              })
            )}

            {/* Win line SVG overlay */}
            {winResult && (
              <svg
                className="absolute pointer-events-none"
                style={{ left: 0, top: 0 }}
                width={boardWidth}
                height={boardHeight}
              >
                <line
                  x1={PAD + winResult.cells[0][1] * (cellSize + GAP) + cellSize / 2}
                  y1={PAD + winResult.cells[0][0] * (cellSize + GAP) + cellSize / 2}
                  x2={PAD + winResult.cells[3][1] * (cellSize + GAP) + cellSize / 2}
                  y2={PAD + winResult.cells[3][0] * (cellSize + GAP) + cellSize / 2}
                  stroke="rgba(255,94,0,0.95)"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
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
