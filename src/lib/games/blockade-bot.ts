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
import { bfsPathLength, bfsShortestPath } from "./blockade-bfs";
import type { Wall } from "./blockade-collision";

export function getBlockadeBotDelayMs(_difficulty: BotDifficulty): number {
  return 800 + Math.random() * 700;
}

type BotAction =
  | { kind: "move"; to: Pos }
  | { kind: "wall"; wall: Wall };

function wallKey(w: Wall): string {
  return `${w.orientation}:${w.x}:${w.y}`;
}

/** Walls that would block a single step on the opponent's path. */
function wallsBlockingStep(from: Pos, to: Pos): Wall[] {
  const out: Wall[] = [];
  if (from.x === to.x && from.y !== to.y) {
    if (to.y < from.y) {
      out.push({ x: from.x, y: from.y, orientation: "horizontal" });
      if (from.x > 0) out.push({ x: from.x - 1, y: from.y, orientation: "horizontal" });
    } else {
      out.push({ x: from.x, y: to.y, orientation: "horizontal" });
      if (from.x > 0) out.push({ x: from.x - 1, y: to.y, orientation: "horizontal" });
    }
  }
  if (from.y === to.y && from.x !== to.x) {
    if (to.x < from.x) {
      out.push({ x: from.x, y: from.y, orientation: "vertical" });
      if (from.y > 0) out.push({ x: from.x, y: from.y - 1, orientation: "vertical" });
    } else {
      out.push({ x: to.x, y: from.y, orientation: "vertical" });
      if (from.y > 0) out.push({ x: to.x, y: from.y - 1, orientation: "vertical" });
    }
  }
  return out;
}

function findBestWall(
  state: BlockadeGameState,
  role: BlockadeRole
): { wall: Wall | null; score: number; playerPath: Pos[] | null } {
  const oppRole = opponent(role);
  const walls = state.walls;
  const oppPos = state.players[oppRole].position;
  const botPos = state.players[role].position;
  const oppGoal = goalRowFor(oppRole);
  const botGoal = goalRowFor(role);

  const playerPath = bfsShortestPath(oppPos, oppGoal, walls, botPos);
  console.log("PLAYER PATH:", playerPath);

  const currentOppLen = bfsPathLength(oppPos, oppGoal, walls, botPos);
  const currentBotLen = bfsPathLength(botPos, botGoal, walls, oppPos);

  const seen = new Set<string>();
  const candidates: Wall[] = [];

  if (playerPath) {
    for (let i = 0; i < playerPath.length - 1; i++) {
      for (const w of wallsBlockingStep(playerPath[i], playerPath[i + 1])) {
        const k = wallKey(w);
        if (!seen.has(k)) {
          seen.add(k);
          candidates.push(w);
        }
      }
    }
  }

  let best: Wall | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
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

  console.log("BOT WALL CHOICE:", best, "SCORE:", bestScore);
  return { wall: bestScore > 0 ? best : null, score: bestScore, playerPath };
}

function shouldPlaceWall(
  botPath: number,
  playerPath: number,
  wallsLeft: number,
  wallScore: number
): boolean {
  if (wallsLeft <= 0 || wallScore <= 0) return false;
  if (playerPath <= botPath) return true;
  if (wallScore >= 2) return true;
  return false;
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

  const path = bfsShortestPath(me, myGoal, walls, opp);
  console.log("BOT PATH:", path);
  console.log("BOT NEXT MOVE:", path?.[1]);
  console.log("BOT GOAL ROW:", myGoal, "OPP GOAL ROW:", oppGoal);

  const botPathLen = path ? path.length - 1 : 999;
  const playerPathLen = bfsPathLength(opp, oppGoal, walls, me);

  const { wall: bestWall, score: wallScore } = findBestWall(state, role);

  if (shouldPlaceWall(botPathLen, playerPathLen, state.players[role].wallsRemaining, wallScore)) {
    if (bestWall) return { kind: "wall", wall: bestWall };
  }

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

  if (bestWall) return { kind: "wall", wall: bestWall };

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
