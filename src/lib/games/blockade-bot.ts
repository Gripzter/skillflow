import type { BotDifficulty } from "./bot-engine";
import {
  applyMove,
  applyWall,
  getLegalMoves,
  goalRowFor,
  opponent,
  validateWallPlacement,
  type BlockadeGameState,
  type BlockadeRole,
  type BlockadeWall,
  type Pos,
} from "./blockade-logic";
import { isBlocked, type Wall } from "./blockade-collision";
import { bfsPathLength, bfsShortestPath, BOARD_SIZE } from "./blockade-bfs";

export function getBlockadeBotDelayMs(_difficulty: BotDifficulty): number {
  return 800 + Math.random() * 700;
}

type BotAction =
  | { kind: "move"; to: Pos }
  | { kind: "wall"; wall: Wall };

function shouldPlaceWall(botPath: number, playerPath: number, wallsLeft: number): boolean {
  if (wallsLeft <= 0) return false;
  if (playerPath < botPath) return Math.random() < 0.75;
  if (playerPath === botPath) return Math.random() < 0.35;
  return Math.random() < 0.12;
}

function generateWallCandidatesNearCell(cell: Pos): Wall[] {
  const { x, y } = cell;
  const out: Wall[] = [];
  if (y >= 1) {
    out.push({ x, y, orientation: "horizontal" });
    if (x > 0) out.push({ x: x - 1, y, orientation: "horizontal" });
  }
  if (x >= 1) {
    out.push({ x, y, orientation: "vertical" });
    if (y > 0) out.push({ x, y: y - 1, orientation: "vertical" });
  }
  return out;
}

function findBestWall(state: BlockadeGameState, role: BlockadeRole): Wall | null {
  const oppRole = opponent(role);
  const walls = state.walls;
  const oppPos = state.players[oppRole].position;
  const botPos = state.players[role].position;
  const oppGoal = goalRowFor(oppRole);
  const botGoal = goalRowFor(role);

  const oppPath = bfsShortestPath(oppPos, oppGoal, walls, botPos);
  const pathCells = oppPath ? oppPath.slice(0, Math.min(6, oppPath.length)) : [oppPos];
  const currentOppLen = bfsPathLength(oppPos, oppGoal, walls, botPos);
  const currentBotLen = bfsPathLength(botPos, botGoal, walls, oppPos);

  let best: Wall | null = null;
  let bestScore = 0;

  for (const cell of pathCells) {
    for (const candidate of generateWallCandidatesNearCell(cell)) {
      if (!validateWallPlacement(state, role, candidate).valid) continue;
      const trial: BlockadeWall[] = [...walls, { ...candidate, id: "t", owner: role }];
      const newOppLen = bfsPathLength(oppPos, oppGoal, trial, botPos);
      const newBotLen = bfsPathLength(botPos, botGoal, trial, oppPos);
      const score = newOppLen - currentOppLen - (newBotLen - currentBotLen);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
  }

  return bestScore > 0 ? best : null;
}

export function getBlockadeBotAction(
  state: BlockadeGameState,
  role: BlockadeRole,
  _difficulty: BotDifficulty
): BotAction | null {
  if (state.phase !== "in_progress" || state.currentTurn !== role) return null;

  const walls = state.walls;
  const me = state.players[role].position;
  const opp = state.players[opponent(role)].position;
  const myGoal = goalRowFor(role);
  const oppGoal = goalRowFor(opponent(role));

  const botPath = bfsPathLength(me, myGoal, walls, opp);
  const playerPath = bfsPathLength(opp, oppGoal, walls, me);

  if (botPath === 1) {
    const path = bfsShortestPath(me, myGoal, walls, opp);
    if (path && path.length > 1) return { kind: "move", to: path[1] };
  }

  if (shouldPlaceWall(botPath, playerPath, state.players[role].wallsRemaining)) {
    const wall = findBestWall(state, role);
    if (wall) return { kind: "wall", wall };
  }

  const path = bfsShortestPath(me, myGoal, walls, opp);
  if (path && path.length > 1) {
    const next = path[1];
    const legal = getLegalMoves(state, role);
    if (legal.some((p) => p.x === next.x && p.y === next.y)) {
      return { kind: "move", to: next };
    }
  }

  const moves = getLegalMoves(state, role);
  if (moves.length > 0) {
    let best = moves[0];
    let bestLen = bfsPathLength(best, myGoal, walls, opp);
    for (const m of moves) {
      const len = bfsPathLength(m, myGoal, walls, opp);
      if (len < bestLen) {
        bestLen = len;
        best = m;
      }
    }
    return { kind: "move", to: best };
  }

  const wall = findBestWall(state, role);
  if (wall) return { kind: "wall", wall };

  return null;
}

export function applyBotAction(
  state: BlockadeGameState,
  role: BlockadeRole,
  action: BotAction
): { state: BlockadeGameState; log: string } | null {
  if (action.kind === "move") {
    return applyMove(state, role, action.to);
  }
  return applyWall(state, role, action.wall);
}

/** @deprecated abilities removed */
export function pickBotAbilities(): never[] {
  return [];
}
