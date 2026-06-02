"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameMultiplayerProps } from "./Chess";
import type { MatchUiState } from "@/components/game/matchUi";
import type { BotDifficulty } from "@/lib/games/bot-engine";
import BlockadeBoard from "./BlockadeBoard";
import BlockadeAbilitySelect from "./BlockadeAbilitySelect";
import {
  ABILITY_DEFS,
  applyGhostStep,
  applyMove,
  applyWall,
  applyWallBreak,
  createInitialState,
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

const TURN_SEC = 15;

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
  const [wallAnchor, setWallAnchor] = useState<{ row: number; col: number } | null>(null);
  const [turnSecLeft, setTurnSecLeft] = useState(TURN_SEC);
  const [abilityToast, setAbilityToast] = useState<string | null>(null);
  const gameOverRef = useRef(false);
  const lastEventRef = useRef<Record<string, unknown> | null>(null);
  const botScheduledRef = useRef(false);

  const isMyTurn = state.currentTurn === myRole && state.phase === "in_progress";
  const myPlayer = state.players[myRole];
  const oppRole = opponent(myRole);
  const oppPlayer = state.players[oppRole];

  const syncState = useCallback(
    (next: BlockadeGameState, logLine?: string) => {
      setState(next);
      if (isMultiplayer && sendGameEvent) {
        sendGameEvent({
          type: "blockade_state",
          state: serializeState(next),
          byRole: myRole,
          logLine,
        }).catch(() => {});
      }
    },
    [isMultiplayer, sendGameEvent, myRole]
  );

  const handleAbilityConfirm = useCallback(
    (chosen: BlockadeAbilityId[]) => {
      onPlayerAction?.();
      let next = setAbilities(state, myRole, chosen);
      if (isPlayer2Bot && !next.abilityReady.player2) {
        next = setAbilities(next, "player2", pickBotAbilities(botDifficulty));
      }
      syncState(next, `${player1.username} is ready`);
    },
    [state, myRole, isPlayer2Bot, botDifficulty, syncState, onPlayerAction, player1.username]
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
          const skipped = skipTurn(state, myRole);
          syncState(skipped, "Turn skipped (timeout)");
          return TURN_SEC;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [state.phase, state.currentTurn, isMyTurn, myRole, state, syncState]);

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
      const m = logLine.match(/used (.+)!/i);
      if (m) setAbilityToast(`${player2.username} used ${m[1]}!`);
    }
    if (parsed.winner && !gameOverRef.current) {
      gameOverRef.current = true;
      onGameEnd(parsed.winner);
    }
    onEventProcessed();
  }, [incomingEvent, onEventProcessed, myRole, onGameEnd, player2.username]);

  useEffect(() => {
    if (!isPlayer2Bot || isMultiplayer || state.phase !== "in_progress") return;
    if (state.currentTurn !== "player2" || botScheduledRef.current) return;
    botScheduledRef.current = true;
    const delay = getBlockadeBotDelayMs(botDifficulty);
    const timer = setTimeout(() => {
      botScheduledRef.current = false;
      const action = getBlockadeBotAction(state, "player2", botDifficulty);
      if (!action) {
        const skipped = skipTurn(state, "player2");
        setState(skipped);
        return;
      }
      const next = applyBotAction(state, "player2", action);
      if (next) {
        setState(next);
        if (next.winner) {
          gameOverRef.current = true;
          onGameEnd(next.winner);
        }
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [state, isPlayer2Bot, isMultiplayer, botDifficulty, onGameEnd]);

  const highlightMoves = useMemo(() => {
    if (!isMyTurn || mode !== "move" || state.pendingAbility) return [];
    if (state.pendingAbility === "ghost_step" || state.doubleMoveRemaining > 0) {
      return getLegalMoves(state, myRole);
    }
    if (state.doubleMoveRemaining > 0) return getLegalMoves(state, myRole);
    return getLegalMoves(state, myRole);
  }, [state, isMyTurn, mode, myRole]);

  const wallPreview = useMemo((): BlockadeWall | null => {
    if (!wallAnchor || mode !== "wall") return null;
    return {
      id: "preview",
      type: wallType,
      orientation: wallOrient,
      row: wallAnchor.row,
      col: wallAnchor.col,
      rotation: wallType === "lshape" ? wallRot : undefined,
      owner: myRole,
      placedTurn: state.turnNumber,
      isBomb: state.pendingAbility === "wall_bomb",
    };
  }, [wallAnchor, mode, wallType, wallOrient, wallRot, myRole, state.turnNumber, state.pendingAbility]);

  const wallPreviewValid = useMemo(() => {
    if (!wallPreview) return true;
    return validateWallPlacement(state, myRole, wallPreview).valid;
  }, [wallPreview, state, myRole]);

  const handleCellClick = useCallback(
    (pos: Pos) => {
      if (!isMyTurn || gameOverRef.current) return;
      onPlayerAction?.();

      if (state.pendingAbility === "ghost_step") {
        const res = applyGhostStep(state, myRole, pos);
        if (res) {
          setAbilityToast(`${player1.username} used Ghost Step!`);
          syncState(res.state, res.log);
          if (res.state.winner) {
            gameOverRef.current = true;
            onGameEnd(res.state.winner);
          }
        }
        return;
      }

      if (mode === "wall" && wallAnchor) {
        const w = wallPreview;
        if (!w || !wallPreviewValid) return;
        const asBomb = state.pendingAbility === "wall_bomb";
        const res = applyWall(state, myRole, w, asBomb);
        if (res) {
          if (asBomb) setAbilityToast(`${player1.username} used Wall Bomb!`);
          syncState(res.state, res.log);
          setWallAnchor(null);
          setMode("move");
          if (res.state.winner) {
            gameOverRef.current = true;
            onGameEnd(res.state.winner);
          }
        }
        return;
      }

      const res = applyMove(state, myRole, pos);
      if (res) {
        syncState(res.state, res.log);
        if (res.state.winner) {
          gameOverRef.current = true;
          onGameEnd(res.state.winner);
        }
      }
    },
    [
      isMyTurn,
      state,
      myRole,
      mode,
      wallAnchor,
      wallPreview,
      wallPreviewValid,
      onPlayerAction,
      syncState,
      onGameEnd,
      player1.username,
    ]
  );

  const useAbility = (id: BlockadeAbilityId) => {
    if (!isMyTurn || myPlayer.abilities.used.includes(id)) return;
    const next = startAbility(state, myRole, id);
    if (!next) return;
    onPlayerAction?.();
    if (id === "double_move") {
      setAbilityToast(`${myRole === "player1" ? player1.username : player2.username} used Double Move!`);
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
    onMatchUi({
      scores: { player1: myPlayer.walls.standard, player2: oppPlayer.walls.standard },
      currentTurn: state.currentTurn,
      turnText: state.phase === "ability_selection" ? "Select abilities" : `${activeName}'s turn · ${turnSecLeft}s`,
      scoreLabel: "walls left",
      systemLogEntries: [],
    });
  }, [onMatchUi, state, player1.username, player2.username, turnSecLeft, myPlayer.walls.standard, oppPlayer.walls.standard]);

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

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {abilityToast && (
        <div className="rounded-lg border border-[#FFFF00]/40 bg-[#FFFF00]/10 px-4 py-2 text-sm text-[#FFFF00]">
          {abilityToast}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => { setMode("move"); setWallAnchor(null); }}
          className={`rounded px-3 py-1.5 text-xs font-semibold ${mode === "move" ? "bg-[#FFFF00] text-black" : "bg-white/10 text-white"}`}
        >
          Move
        </button>
        <button
          type="button"
          onClick={() => setMode("wall")}
          disabled={state.doubleMoveRemaining > 0}
          className={`rounded px-3 py-1.5 text-xs font-semibold ${mode === "wall" ? "bg-[#FFFF00] text-black" : "bg-white/10 text-white"}`}
        >
          Place Wall (W)
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
              className="rounded border border-white/20 px-2 py-1 text-xs text-white disabled:opacity-40"
            >
              {def?.name}{used ? " (Used)" : ""}
            </button>
          );
        })}
      </div>

      {mode === "wall" && (
        <div className="flex flex-wrap gap-2 text-xs">
          {(["standard", "lshape", "triple"] as const).map((t) => (
            <button
              key={t}
              type="button"
              disabled={myPlayer.walls[t] <= 0}
              onClick={() => setWallType(t)}
              className={`rounded px-2 py-1 ${wallType === t ? "bg-teal text-black" : "bg-white/10 text-white"}`}
            >
              {t} ({myPlayer.walls[t]})
            </button>
          ))}
          <button type="button" onClick={() => setWallOrient(wallOrient === "h" ? "v" : "h")} className="rounded bg-white/10 px-2 py-1 text-white">
            {wallOrient === "h" ? "Horizontal" : "Vertical"}
          </button>
          {wallType === "lshape" && (
            <button type="button" onClick={() => setWallRot((r) => (r + 1) % 4)} className="rounded bg-white/10 px-2 py-1 text-white">
              Rotate L (R)
            </button>
          )}
          <span className="text-body-gray">Click a square to anchor wall</span>
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
        onCellClick={(pos) => {
          if (mode === "wall" && !wallAnchor) {
            setWallAnchor({ row: pos.y, col: pos.x });
            return;
          }
          handleCellClick(pos);
        }}
      />

      <p className="text-xs text-body-gray">
        P1 walls: {state.players.player1.walls.standard}S / {state.players.player1.walls.lshape}L /{" "}
        {state.players.player1.walls.triple}T · P2: {state.players.player2.walls.standard}S /{" "}
        {state.players.player2.walls.lshape}L / {state.players.player2.walls.triple}T
      </p>
    </div>
  );
}
