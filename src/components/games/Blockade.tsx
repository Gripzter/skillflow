"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameMultiplayerProps } from "./Chess";
import type { MatchUiState } from "@/components/game/matchUi";
import type { BotDifficulty } from "@/lib/games/bot-engine";
import BlockadeBoard from "./BlockadeBoard";
import BlockadeAbilitySelect from "./BlockadeAbilitySelect";
import BlockadeWallPips from "./BlockadeWallPips";
import {
  ABILITY_DEFS,
  applyGhostStep,
  applyMove,
  applyWall,
  createInitialState,
  getGhostStepTargets,
  getLegalMoves,
  opponent,
  parseState,
  serializeState,
  setAbilities,
  skipTurn,
  startAbility,
  type BlockadeAbilityId,
  type BlockadeGameState,
  type BlockadeRole,
  type BlockadeWall,
  type Pos,
  validateWallPlacement,
} from "@/lib/games/blockade-logic";
import {
  applyBotAction,
  getBlockadeBotAction,
  getBlockadeBotDelayMs,
  pickBotAbilities,
} from "@/lib/games/blockade-bot";
import {
  type EdgeSlot,
  wallFromEdgeSlot,
} from "@/lib/games/blockade-wall-visual";

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
  const [wallType, setWallType] = useState<"standard" | "lshape" | "triple">("standard");
  const [wallOrient, setWallOrient] = useState<"h" | "v">("h");
  const [wallRot, setWallRot] = useState(0);
  const [hoveredEdge, setHoveredEdge] = useState<EdgeSlot | null>(null);
  const [turnSecLeft, setTurnSecLeft] = useState(TURN_SEC);
  const [abilityToast, setAbilityToast] = useState<string | null>(null);
  const [gameLog, setGameLog] = useState<LogEntry[]>([]);
  const gameStartRef = useRef(Date.now());
  const gameOverRef = useRef(false);
  const lastEventRef = useRef<Record<string, unknown> | null>(null);
  const botScheduledRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const isMyTurn = state.currentTurn === myRole && state.phase === "in_progress";
  const myPlayer = state.players[myRole];
  const oppRole = opponent(myRole);
  const oppPlayer = state.players[oppRole];

  const appendLog = useCallback(
    (text: string) => {
      const entry: LogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text,
        timestamp: Date.now(),
      };
      setGameLog((prev) => [entry, ...prev].slice(0, 40));
    },
    []
  );

  const syncState = useCallback(
    (next: BlockadeGameState, logLine?: string) => {
      setState(next);
      if (logLine) {
        appendLog(formatLogLine(logLine, player1.username, player2.username));
      }
      if (isMultiplayer && sendGameEvent) {
        sendGameEvent({
          type: "blockade_state",
          state: serializeState(next),
          byRole: myRole,
          logLine,
        }).catch(() => {});
      }
    },
    [isMultiplayer, sendGameEvent, myRole, appendLog, player1.username, player2.username]
  );

  const handleAbilityConfirm = useCallback(
    (chosen: BlockadeAbilityId[]) => {
      onPlayerAction?.();
      let next = setAbilities(stateRef.current, myRole, chosen);
      if (isPlayer2Bot && !next.abilityReady.player2) {
        next = setAbilities(next, "player2", pickBotAbilities(botDifficulty));
      }
      syncState(next, `${player1.username} is ready`);
      if (next.phase === "in_progress") {
        appendLog(`🧱 ${player1.username} vs ${player2.username} — Blockade begins!`);
      }
    },
    [myRole, isPlayer2Bot, botDifficulty, syncState, onPlayerAction, player1.username, player2.username, appendLog]
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
          const skipped = skipTurn(stateRef.current, myRole);
          syncState(skipped, "Turn skipped (timeout)");
          return TURN_SEC;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [state.phase, state.currentTurn, isMyTurn, myRole, syncState]);

  useEffect(() => {
    if (!incomingEvent || !onEventProcessed || incomingEvent === lastEventRef.current) return;
    const type = incomingEvent.type as string;
    if (type !== "blockade_state") {
      onEventProcessed();
      return;
    }
    const byRole = incomingEvent.byRole as BlockadeRole | undefined;
    if (byRole === myRole) {
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
    if (logLine) {
      appendLog(formatLogLine(logLine, player1.username, player2.username));
      const m = logLine.match(/used (.+)!/i);
      if (m) setAbilityToast(`${player2.username} used ${m[1]}!`);
    }
    if (parsed.winner && !gameOverRef.current) {
      gameOverRef.current = true;
      onGameEnd(parsed.winner);
    }
    onEventProcessed();
  }, [incomingEvent, onEventProcessed, myRole, onGameEnd, player2.username, appendLog, player1.username]);

  useEffect(() => {
    if (!isPlayer2Bot || isMultiplayer || state.phase !== "in_progress") return;
    if (state.currentTurn !== "player2" || botScheduledRef.current) return;
    botScheduledRef.current = true;
    const delay = getBlockadeBotDelayMs(botDifficulty);
    const timer = setTimeout(() => {
      botScheduledRef.current = false;
      const action = getBlockadeBotAction(stateRef.current, "player2", botDifficulty);
      if (!action) {
        setState(skipTurn(stateRef.current, "player2"));
        return;
      }
      const result = applyBotAction(stateRef.current, "player2", action);
      if (result) {
        appendLog(formatLogLine(result.log, player1.username, player2.username));
        setState(result.state);
        if (result.state.winner) {
          gameOverRef.current = true;
          onGameEnd(result.state.winner);
        }
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [state, isPlayer2Bot, isMultiplayer, botDifficulty, onGameEnd, appendLog, player1.username, player2.username]);

  const activeEdge = hoveredEdge;

  const wallPreview = useMemo((): BlockadeWall | null => {
    if (mode !== "wall" || !activeEdge) return null;
    const base = wallFromEdgeSlot(activeEdge, wallType, wallRot);
    return {
      ...base,
      id: "preview",
      owner: myRole,
      placedTurn: state.turnNumber,
      isBomb: state.pendingAbility === "wall_bomb",
    };
  }, [mode, activeEdge, wallType, wallRot, myRole, state.turnNumber, state.pendingAbility]);

  const wallPreviewValid = useMemo(() => {
    if (!wallPreview) return true;
    return validateWallPlacement(state, myRole, wallPreview).valid;
  }, [wallPreview, state, myRole]);

  const highlightMoves = useMemo(() => {
    if (!isMyTurn || mode !== "move") return [];
    if (state.pendingAbility === "ghost_step") {
      return getGhostStepTargets(state, myRole);
    }
    return getLegalMoves(state, myRole);
  }, [state, isMyTurn, mode, myRole]);

  const placeWallFromSlot = useCallback(
    (slot: EdgeSlot) => {
      if (!isMyTurn || gameOverRef.current || mode !== "wall") return;

      const w = wallFromEdgeSlot(slot, wallType, wallRot);
      const check = validateWallPlacement(state, myRole, w);
      if (!check.valid) return;

      onPlayerAction?.();
      const asBomb = state.pendingAbility === "wall_bomb";
      const res = applyWall(state, myRole, w, asBomb);
      if (res) {
        console.log("[TRACE UI] wall applyWall ok — walls:", res.state.walls.length, "blockedEdges:", res.state.blockedEdges?.length);
        if (asBomb) setAbilityToast("Used Wall Bomb!");
        syncState(res.state, res.log);
        setMode("move");
        setHoveredEdge(null);
        if (res.state.winner) {
          gameOverRef.current = true;
          onGameEnd(res.state.winner);
        }
      }
    },
    [isMyTurn, mode, wallType, wallOrient, wallRot, state, myRole, onPlayerAction, syncState, onGameEnd]
  );

  const handleCellClick = useCallback(
    (pos: Pos) => {
      if (!isMyTurn || gameOverRef.current || mode !== "move") return;
      onPlayerAction?.();

      if (state.pendingAbility === "ghost_step") {
        const res = applyGhostStep(state, myRole, pos);
        if (res) {
          setAbilityToast("Used Ghost Step!");
          syncState(res.state, res.log);
          if (res.state.winner) {
            gameOverRef.current = true;
            onGameEnd(res.state.winner);
          }
        }
        return;
      }

      console.log("[TRACE UI] click move", pos, "state walls:", state.walls.length, "blockedEdges:", state.blockedEdges?.length);
      const res = applyMove(state, myRole, pos);
      console.log("[TRACE UI] applyMove result:", res ? "MOVED" : "REJECTED");
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

  const useAbility = (id: BlockadeAbilityId) => {
    if (!isMyTurn || myPlayer.abilities.used.includes(id)) return;
    const next = startAbility(state, myRole, id);
    if (!next) return;
    onPlayerAction?.();
    const name = ABILITY_DEFS.find((a) => a.id === id)?.name ?? id;
    setAbilityToast(`Used ${name}!`);
    if (id === "double_move") {
      syncState(next);
      setMode("move");
      return;
    }
    if (id === "wall_break") {
      setState(next);
      setMode("wall");
      return;
    }
    if (id === "ghost_step") {
      setState(next);
      setMode("move");
      return;
    }
    if (id === "wall_bomb") {
      setState(next);
      setMode("wall");
      setWallType("standard");
    }
  };

  useEffect(() => {
    if (!onMatchUi) return;
    const activeName = state.currentTurn === "player1" ? player1.username : player2.username;
    const turnColor = state.currentTurn === "player1" ? "yellow" : "red";
    const systemLogEntries: MatchUiState["systemLogEntries"] = [
      {
        id: "game-start",
        text: `🧱 Blockade — ${player1.username} vs ${player2.username}${isPlayer2Bot ? " 🤖" : ""}`,
        timestamp: gameStartRef.current,
      },
      ...gameLog,
    ];
    onMatchUi({
      scores: { player1: 0, player2: 0 },
      currentTurn: state.currentTurn,
      turnText:
        state.phase === "ability_selection"
          ? "Select abilities"
          : `${activeName}'s turn · ${turnSecLeft}s`,
      turnTimerDisplay: turnColor,
      scoreLabel: "",
      systemLogEntries,
    });
  }, [
    onMatchUi,
    state,
    player1.username,
    player2.username,
    turnSecLeft,
    gameLog,
    isPlayer2Bot,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "w" || e.key === "W") {
        if (!isMyTurn || state.doubleMoveRemaining > 0) return;
        setMode((m) => (m === "wall" ? "move" : "wall"));
        setHoveredEdge(null);
      }
      if (e.key === "Escape" && mode === "wall") {
        setMode("move");
        setHoveredEdge(null);
      }
      if (e.key === "r" || e.key === "R") {
        if (mode !== "wall") return;
        if (wallType === "lshape") setWallRot((r) => (r + 1) % 4);
        else setWallOrient((o) => (o === "h" ? "v" : "h"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMyTurn, mode, wallType, state.doubleMoveRemaining]);

  if (state.phase === "ability_selection" && !state.abilityReady[myRole]) {
    return <BlockadeAbilitySelect onConfirm={handleAbilityConfirm} />;
  }

  if (state.phase === "ability_selection") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-white">
        Waiting for opponent to choose abilities…
      </div>
    );
  }

  const p1Active = state.currentTurn === "player1";
  const p2Active = state.currentTurn === "player2";

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-2 px-2 py-2 md:gap-3 md:px-4">
      {abilityToast && (
        <div className="rounded-lg border border-[#FFFF00]/40 bg-[#FFFF00]/10 px-3 py-1.5 text-center text-xs text-[#FFFF00]">
          {abilityToast}
        </div>
      )}

      {/* Player panels */}
      <div className="grid w-full grid-cols-2 gap-2">
        <PlayerPanel
          name={player1.username}
          active={p1Active}
          color="yellow"
          walls={state.players.player1.walls}
          isMe={myRole === "player1"}
        />
        <PlayerPanel
          name={player2.username}
          active={p2Active}
          color="red"
          walls={state.players.player2.walls}
          isMe={myRole === "player2"}
        />
      </div>

      {/* Action row */}
      <div className="flex w-full flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setMode("move");
            setHoveredEdge(null);
          }}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "move" ? "bg-[#FFFF00] text-black" : "bg-white/10 text-white"}`}
        >
          Move
        </button>
        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "wall" ? "move" : "wall"));
            setHoveredEdge(null);
          }}
          disabled={!isMyTurn || state.doubleMoveRemaining > 0}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "wall" ? "bg-[#FFFF00] text-black" : "bg-white/10 text-white"} disabled:opacity-40`}
        >
          Wall {mode === "wall" ? "▲" : "▼"}
        </button>
        {myPlayer.abilities.chosen.map((id) => {
          const def = ABILITY_DEFS.find((a) => a.id === id);
          const used = myPlayer.abilities.used.includes(id);
          return (
            <button
              key={id}
              type="button"
              disabled={!isMyTurn || used}
              onClick={() => useAbility(id)}
              className="flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-white disabled:opacity-35"
            >
              <span aria-hidden>⚡</span>
              <span>{def?.name}{used ? " · Used" : ""}</span>
            </button>
          );
        })}
        {mode === "wall" && (
          <button
            type="button"
            onClick={() => {
              setMode("move");
              setHoveredEdge(null);
            }}
            className="rounded-md border border-white/20 px-2 py-1.5 text-xs text-body-gray"
          >
            Cancel
          </button>
        )}
      </div>

      {mode === "wall" && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {(
            [
              { t: "standard" as const, label: "Standard", n: myPlayer.walls.standard },
              { t: "lshape" as const, label: "L-Shape", n: myPlayer.walls.lshape },
              { t: "triple" as const, label: "Triple", n: myPlayer.walls.triple },
            ] as const
          ).map(({ t, label, n }) => (
            <button
              key={t}
              type="button"
              disabled={n <= 0}
              onClick={() => {
                setWallType(t);
                setHoveredEdge(null);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                wallType === t ? "bg-[#FFFF00] text-black" : "bg-white/10 text-white"
              } disabled:opacity-35`}
            >
              {label} ({n})
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              if (wallType === "lshape") setWallRot((r) => (r + 1) % 4);
              else setWallOrient((o) => (o === "h" ? "v" : "h"));
            }}
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-white"
          >
            Rotate
          </button>
        </div>
      )}

      <BlockadeBoard
        p1Pos={state.players.player1.position}
        p2Pos={state.players.player2.position}
        walls={state.walls}
        turnNumber={state.turnNumber}
        highlightMoves={highlightMoves}
        wallPreview={wallPreview}
        wallPreviewValid={wallPreviewValid}
        wallMode={mode === "wall" && isMyTurn}
        wallType={wallType}
        canHoverCells={isMyTurn && mode === "move"}
        onCellClick={handleCellClick}
        onEdgeHover={(slot) => {
          if (mode !== "wall" || !isMyTurn) return;
          setHoveredEdge(slot);
          if (slot) setWallOrient(slot.orientation);
        }}
        onEdgePlace={placeWallFromSlot}
      />

      <p
        className={`text-center text-sm font-bold md:text-base ${
          p1Active ? "text-[#FFFF00]" : "text-[#FF6B6B]"
        }`}
        style={{
          textShadow: p1Active
            ? "0 0 12px rgba(255,255,0,0.45)"
            : "0 0 12px rgba(255,107,107,0.45)",
        }}
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
  walls: { standard: number; lshape: number; triple: number };
  isMe: boolean;
}) {
  const glow =
    color === "yellow"
      ? "0 0 0 2px rgba(255,255,0,0.35), 0 0 18px rgba(255,255,0,0.2)"
      : "0 0 0 2px rgba(255,107,107,0.35), 0 0 18px rgba(255,107,107,0.2)";
  return (
    <div
      className="rounded-lg border border-white/10 bg-[#16161e] px-2 py-2 transition-shadow duration-300"
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
        <BlockadeWallPips walls={walls} color={color} />
      </div>
    </div>
  );
}
