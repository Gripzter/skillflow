"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameMultiplayerProps } from "./Chess";
import type { MatchUiState } from "@/components/game/matchUi";
import type { BotDifficulty } from "@/lib/games/bot-engine";
import BlockadeBoard from "./BlockadeBoard";
import BlockadeWallPips from "./BlockadeWallPips";
import {
  applyMove,
  applyWall,
  createInitialState,
  getLegalMoves,
  parseState,
  serializeState,
  skipTurn,
  validateWallPlacement,
  type BlockadeGameState,
  type BlockadeRole,
  type Pos,
} from "@/lib/games/blockade-logic";
import { executeBotTurn, getBlockadeBotDelayMs } from "@/lib/games/blockade-bot";
import type { EdgeSlot } from "@/lib/games/blockade-wall-visual";

const TURN_SEC = 15;

type LogEntry = { id: string; text: string; timestamp: number };

function formatLogLine(line: string, p1Name: string, p2Name: string): string {
  return line.replace(/Player1/g, p1Name).replace(/Player2/g, p2Name);
}

export interface BlockadeProps extends GameMultiplayerProps {
  player1: { username: string; rating: number };
  player2: { username: string; rating: number };
  onGameEnd: (winner: "player1" | "player2") => void;
  onGameDraw?: () => void;
  isPlayer2Bot?: boolean;
  botDifficulty?: BotDifficulty;
}

type Mode = "move" | "wall";

export default function Blockade({
  player1,
  player2,
  onGameEnd,
  isPlayer2Bot = true,
  botDifficulty = "gamer",
  isMultiplayer = false,
  myRole = "player1",
  sendGameEvent,
  onPlayerAction,
  incomingEvent,
  onEventProcessed,
  onMatchUi,
}: BlockadeProps) {
  const [state, setState] = useState<BlockadeGameState>(() => createInitialState());
  const [mode, setMode] = useState<Mode>("move");
  const [wallOrient, setWallOrient] = useState<"horizontal" | "vertical">("horizontal");
  const [previewSlotKey, setPreviewSlotKey] = useState<string | null>(null);
  const [turnSecLeft, setTurnSecLeft] = useState(TURN_SEC);
  const [gameLog, setGameLog] = useState<LogEntry[]>([]);
  const [placementLocked, setPlacementLocked] = useState(false);

  const gameStartRef = useRef(Date.now());
  const gameOverRef = useRef(false);
  const lastEventRef = useRef<Record<string, unknown> | null>(null);
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botHandledTurnRef = useRef<number>(-1);
  const stateRef = useRef(state);
  const previewSlotRef = useRef<EdgeSlot | null>(null);
  const placingWallRef = useRef(false);
  const transitioningRef = useRef(false);

  stateRef.current = state;

  const isMyTurn = state.currentTurn === myRole && state.phase === "in_progress";

  const appendLog = useCallback((text: string) => {
    setGameLog((prev) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text, timestamp: Date.now() },
      ...prev,
    ].slice(0, 40));
  }, []);

  const syncState = useCallback(
    (next: BlockadeGameState, logLine?: string) => {
      transitioningRef.current = true;
      setPlacementLocked(true);
      setState(next);
      if (logLine) appendLog(formatLogLine(logLine, player1.username, player2.username));
      if (isMultiplayer && sendGameEvent) {
        sendGameEvent({
          type: "blockade_state",
          state: serializeState(next),
          byRole: myRole,
          logLine,
        }).catch(() => {});
      }
      window.setTimeout(() => {
        transitioningRef.current = false;
        setPlacementLocked(false);
      }, 150);
    },
    [isMultiplayer, sendGameEvent, myRole, appendLog, player1.username, player2.username]
  );

  useEffect(() => {
    if (state.phase !== "in_progress" || gameOverRef.current) return;
    if (!isMyTurn) {
      setTurnSecLeft(TURN_SEC);
      return;
    }
    setTurnSecLeft(TURN_SEC);
    const interval = setInterval(() => {
      setTurnSecLeft((s) => {
        if (s <= 1) {
          syncState(skipTurn(stateRef.current, myRole), "Turn skipped (timeout)");
          return TURN_SEC;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [state.phase, state.currentTurn, isMyTurn, myRole, syncState]);

  useEffect(() => {
    if (!incomingEvent || !onEventProcessed || incomingEvent === lastEventRef.current) return;
    if ((incomingEvent.type as string) !== "blockade_state") {
      onEventProcessed();
      return;
    }
    if ((incomingEvent.byRole as BlockadeRole) === myRole) {
      onEventProcessed();
      return;
    }
    const parsed = parseState(incomingEvent.state as Record<string, unknown>);
    if (!parsed) {
      onEventProcessed();
      return;
    }
    lastEventRef.current = incomingEvent;
    setState(parsed);
    const logLine = incomingEvent.logLine as string | undefined;
    if (logLine) appendLog(formatLogLine(logLine, player1.username, player2.username));
    if (parsed.winner && !gameOverRef.current) {
      gameOverRef.current = true;
      onGameEnd(parsed.winner);
    }
    onEventProcessed();
  }, [incomingEvent, onEventProcessed, myRole, onGameEnd, appendLog, player1.username, player2.username]);

  useEffect(() => {
    if (!isPlayer2Bot || isMultiplayer || state.phase !== "in_progress") return;

    console.log("Turn switched to:", state.currentTurn);

    if (state.currentTurn !== "player2") {
      if (botTimerRef.current) {
        clearTimeout(botTimerRef.current);
        botTimerRef.current = null;
      }
      return;
    }

    if (botHandledTurnRef.current >= state.turnNumber) return;

    console.log("Scheduling bot turn...", "turnNumber:", state.turnNumber);

    if (botTimerRef.current) clearTimeout(botTimerRef.current);

    const turnToHandle = state.turnNumber;
    botTimerRef.current = setTimeout(() => {
      console.log("Executing bot turn NOW");
      botTimerRef.current = null;
      botHandledTurnRef.current = turnToHandle;

      const result = executeBotTurn(stateRef.current, "player2");
      appendLog(formatLogLine(result.log, player1.username, player2.username));
      setState(result.state);
      if (result.state.winner) {
        gameOverRef.current = true;
        onGameEnd(result.state.winner);
      }
    }, getBlockadeBotDelayMs(botDifficulty));

    return () => {
      if (botTimerRef.current) {
        clearTimeout(botTimerRef.current);
        botTimerRef.current = null;
      }
    };
  }, [
    state.currentTurn,
    state.turnNumber,
    state.phase,
    isPlayer2Bot,
    isMultiplayer,
    botDifficulty,
    onGameEnd,
    appendLog,
    player1.username,
    player2.username,
  ]);

  const wallPreview = useMemo(() => {
    if (mode !== "wall" || !previewSlotRef.current) return null;
    const slot = previewSlotRef.current;
    return {
      x: slot.x,
      y: slot.y,
      orientation: wallOrient,
    };
  }, [mode, previewSlotKey, wallOrient]);

  const wallPreviewValid = useMemo(() => {
    if (!wallPreview) return true;
    return validateWallPlacement(state, myRole, wallPreview).valid;
  }, [wallPreview, state, myRole]);

  const highlightMoves = useMemo(() => {
    if (!isMyTurn || mode !== "move") return [];
    return getLegalMoves(state, myRole);
  }, [state, isMyTurn, mode, myRole]);

  const handleEdgeHover = useCallback((slot: EdgeSlot | null) => {
    if (slot === null) {
      if (previewSlotRef.current !== null) {
        previewSlotRef.current = null;
        setPreviewSlotKey(null);
      }
      return;
    }
    if (previewSlotRef.current?.key === slot.key) return;
    previewSlotRef.current = slot;
    setPreviewSlotKey(slot.key);
  }, []);

  const placeWallFromSlot = useCallback(
    (slot: EdgeSlot) => {
      if (placingWallRef.current || transitioningRef.current || placementLocked) return;
      if (!isMyTurn || gameOverRef.current || mode !== "wall") return;

      placingWallRef.current = true;
      const w = {
        x: slot.x,
        y: slot.y,
        orientation: wallOrient,
      };

      const check = validateWallPlacement(state, myRole, w);
      if (!check.valid) {
        placingWallRef.current = false;
        return;
      }

      onPlayerAction?.();
      const res = applyWall(state, myRole, w);
      if (res) {
        syncState(res.state, res.log);
        setMode("move");
        previewSlotRef.current = null;
        setPreviewSlotKey(null);
        if (res.state.winner) {
          gameOverRef.current = true;
          onGameEnd(res.state.winner);
        }
      }
      placingWallRef.current = false;
    },
    [
      placementLocked,
      isMyTurn,
      mode,
      wallOrient,
      state,
      myRole,
      onPlayerAction,
      syncState,
      onGameEnd,
    ]
  );

  const handleCellClick = useCallback(
    (pos: Pos) => {
      if (!isMyTurn || gameOverRef.current || mode !== "move" || transitioningRef.current) return;
      onPlayerAction?.();
      const res = applyMove(state, myRole, pos);
      if (res) {
        syncState(res.state, res.log);
        if (res.state.winner) {
          gameOverRef.current = true;
          onGameEnd(res.state.winner);
        }
      }
    },
    [isMyTurn, mode, state, myRole, onPlayerAction, syncState, onGameEnd]
  );

  useEffect(() => {
    if (!onMatchUi) return;
    const activeName = state.currentTurn === "player1" ? player1.username : player2.username;
    onMatchUi({
      scores: { player1: 0, player2: 0 },
      currentTurn: state.currentTurn,
      turnText: `${activeName}'s turn · ${turnSecLeft}s`,
      scoreLabel: "",
      systemLogEntries: [
        {
          id: "start",
          text: `🧱 ${player1.username} vs ${player2.username}${isPlayer2Bot ? " 🤖" : ""}`,
          timestamp: gameStartRef.current,
        },
        ...gameLog,
      ],
    });
  }, [onMatchUi, state, player1.username, player2.username, turnSecLeft, gameLog, isPlayer2Bot]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "w" || e.key === "W") {
        if (!isMyTurn) return;
        setMode((m) => (m === "wall" ? "move" : "wall"));
        previewSlotRef.current = null;
        setPreviewSlotKey(null);
      }
      if (e.key === "Escape" && mode === "wall") {
        setMode("move");
        previewSlotRef.current = null;
        setPreviewSlotKey(null);
      }
      if ((e.key === "h" || e.key === "H") && mode === "wall") setWallOrient("horizontal");
      if ((e.key === "v" || e.key === "V") && mode === "wall") setWallOrient("vertical");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMyTurn, mode]);

  const p1Active = state.currentTurn === "player1";
  const p2Active = state.currentTurn === "player2";

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-2 px-2 py-2 md:gap-3 md:px-4">
      <div className="grid w-full grid-cols-2 gap-2">
        <PlayerPanel
          name={player1.username}
          active={p1Active}
          color="yellow"
          walls={state.players.player1.wallsRemaining}
          isMe={myRole === "player1"}
        />
        <PlayerPanel
          name={player2.username}
          active={p2Active}
          color="red"
          walls={state.players.player2.wallsRemaining}
          isMe={myRole === "player2"}
        />
      </div>

      <div className="flex w-full flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setMode("move");
            previewSlotRef.current = null;
            setPreviewSlotKey(null);
          }}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "move" ? "bg-[#FFFF00] text-black" : "bg-white/10 text-white"}`}
        >
          Move
        </button>
        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "wall" ? "move" : "wall"));
            previewSlotRef.current = null;
            setPreviewSlotKey(null);
            setWallOrient("horizontal");
          }}
          disabled={!isMyTurn || state.players[myRole].wallsRemaining <= 0}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "wall" ? "bg-[#FFFF00] text-black" : "bg-white/10 text-white"} disabled:opacity-40`}
        >
          Wall
        </button>
        {mode === "wall" && (
          <>
            <button
              type="button"
              onClick={() => {
                setWallOrient("horizontal");
                previewSlotRef.current = null;
                setPreviewSlotKey(null);
              }}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${wallOrient === "horizontal" ? "bg-[#00FFD0] text-black" : "border border-white/20 text-white"}`}
            >
              H
            </button>
            <button
              type="button"
              onClick={() => {
                setWallOrient("vertical");
                previewSlotRef.current = null;
                setPreviewSlotKey(null);
              }}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${wallOrient === "vertical" ? "bg-[#00FFD0] text-black" : "border border-white/20 text-white"}`}
            >
              V
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("move");
                previewSlotRef.current = null;
                setPreviewSlotKey(null);
              }}
              className="rounded-md border border-white/20 px-2 py-1.5 text-xs text-body-gray"
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {mode === "wall" && (
        <p className="text-center text-xs text-body-gray">
          Choose H or V, hover an edge, then click to place
        </p>
      )}

      <BlockadeBoard
        p1Pos={state.players.player1.position}
        p2Pos={state.players.player2.position}
        walls={state.walls}
        highlightMoves={highlightMoves}
        wallPreview={wallPreview}
        wallPreviewValid={wallPreviewValid}
        wallMode={mode === "wall" && isMyTurn}
        wallOrient={wallOrient}
        placementLocked={placementLocked}
        onCellClick={handleCellClick}
        onEdgeHover={handleEdgeHover}
        onEdgePlace={placeWallFromSlot}
      />

      <p
        className={`text-center text-sm font-bold ${p1Active ? "text-[#FFFF00]" : "text-[#FF6B6B]"}`}
      >
        {state.currentTurn === "player1" ? player1.username : player2.username}&apos;s turn
        <span className="ml-2 font-mono text-xs font-normal text-body-gray">{turnSecLeft}s</span>
      </p>
    </div>
  );
}

function PlayerPanel({
  name,
  active,
  color,
  walls,
  isMe,
}: {
  name: string;
  active: boolean;
  color: "yellow" | "red";
  walls: number;
  isMe: boolean;
}) {
  const glow =
    color === "yellow"
      ? "0 0 0 2px rgba(255,255,0,0.35), 0 0 18px rgba(255,255,0,0.2)"
      : "0 0 0 2px rgba(255,107,107,0.35), 0 0 18px rgba(255,107,107,0.2)";
  return (
    <div
      className="rounded-lg border border-white/10 bg-[#16161e] px-2 py-2"
      style={active ? { boxShadow: glow } : undefined}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="truncate text-xs font-semibold text-white">
          {name}
          {isMe ? <span className="text-body-gray"> (you)</span> : null}
        </p>
        {active && <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />}
      </div>
      <div className="mt-1.5">
        <BlockadeWallPips count={walls} color={color} />
      </div>
    </div>
  );
}
