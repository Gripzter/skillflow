import type { BotDifficulty } from "./bot-engine";
import {
  applyMove,
  applyWall,
  getLegalMoves,
  goalRowFor,
  opponent,
  wallInBounds,
  type BlockadeGameState,
  type BlockadeRole,
  type Pos,
} from "./blockade-logic";
import { bfsHasPathToGoal, bfsPathLength, bfsShortestPath } from "./blockade-bfs";
import type { Wall } from "./blockade-collision";

export function getBlockadeBotDelayMs(_difficulty: BotDifficulty): number {
  return 800 + Math.random() * 700;
}

type BotAction =
  | { kind: "move"; to: Pos }
  | { kind: "wall"; wall: Wall };

type BotDecision =
  | { action: "move" }
  | { action: "wall"; wall: Wall };

function wallsOverlap(a: Wall, b: Wall): boolean {
  if (a.orientation === "horizontal" && b.orientation === "horizontal") {
    return a.y === b.y && (a.x === b.x || a.x === b.x + 1 || a.x === b.x - 1);
  }
  if (a.orientation === "vertical" && b.orientation === "vertical") {
    return a.x === b.x && (a.y === b.y || a.y === b.y + 1 || a.y === b.y - 1);
  }
  if (a.orientation === "horizontal" && b.orientation === "vertical") {
    return (
      (a.x === b.x || a.x + 1 === b.x) &&
      (a.y === b.y || a.y === b.y + 1)
    );
  }
  if (a.orientation === "vertical" && b.orientation === "horizontal") {
    return (
      (b.x === a.x || b.x + 1 === a.x) &&
      (b.y === a.y || b.y === a.y + 1)
    );
  }
  return false;
}

function wallOverlapsAny(candidate: Wall, walls: Wall[]): boolean {
  return walls.some((w) => wallsOverlap(candidate, w));
}

function botChooseWallPlacement(
  botPos: Pos,
  playerPos: Pos,
  botGoalRow: number,
  playerGoalRow: number,
  walls: Wall[],
  botWallsRemaining: number
): Wall | null {
  if (botWallsRemaining <= 0) return null;

  const playerPath = bfsShortestPath(playerPos, playerGoalRow, walls, null);
  if (!playerPath || playerPath.length <= 2) return null;

  const currentPlayerPathLen = playerPath.length - 1;

  let bestWall: Wall | null = null;
  let bestScore = 0;

  for (let i = 0; i < playerPath.length - 1; i++) {
    const from = playerPath[i];
    const to = playerPath[i + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const candidates: Wall[] = [];

    if (dy !== 0) {
      const wallY = dy > 0 ? to.y : from.y;
      for (let wx = Math.max(0, from.x - 1); wx <= Math.min(7, from.x); wx++) {
        candidates.push({ x: wx, y: wallY, orientation: "horizontal" });
      }
    }

    if (dx !== 0) {
      const wallX = dx > 0 ? to.x : from.x;
      for (let wy = Math.max(0, from.y - 1); wy <= Math.min(7, from.y); wy++) {
        candidates.push({ x: wallX, y: wy, orientation: "vertical" });
      }
    }

    for (const candidate of candidates) {
      if (wallOverlapsAny(candidate, walls)) continue;
      if (!wallInBounds(candidate)) continue;

      const testWalls = [...walls, candidate];
      if (!bfsHasPathToGoal(playerPos, playerGoalRow, testWalls)) continue;
      if (!bfsHasPathToGoal(botPos, botGoalRow, testWalls)) continue;

      const newPlayerPathLen = bfsPathLength(playerPos, playerGoalRow, testWalls, null);
      const newBotPathLen = bfsPathLength(botPos, botGoalRow, testWalls, null);
      const score =
        newPlayerPathLen - currentPlayerPathLen - (newBotPathLen - currentBotPathLen);

      if (score > bestScore) {
        bestScore = score;
        bestWall = candidate;
      }
    }
  }

  if (bestWall && bestScore > 0) {
    console.log(
      "BOT WALL:",
      bestWall,
      "SCORE:",
      bestScore,
      "Player path:",
      currentPlayerPathLen,
      "→",
      currentPlayerPathLen + (bestScore > 0 ? bestScore : 0)
    );
    return bestWall;
  }

  console.log("BOT: No good wall found, will move instead");
  return null;
}

function botDecideAction(
  botPos: Pos,
  playerPos: Pos,
  botGoalRow: number,
  playerGoalRow: number,
  walls: Wall[],
  botWallsRemaining: number
): BotDecision {
  const botPathLen = bfsPathLength(botPos, botGoalRow, walls, null);
  const playerPathLen = bfsPathLength(playerPos, playerGoalRow, walls, null);

  if (botPathLen <= 2) return { action: "move" };

  if (playerPathLen < botPathLen && botWallsRemaining > 0) {
    const wall = botChooseWallPlacement(
      botPos,
      playerPos,
      botGoalRow,
      playerGoalRow,
      walls,
      botWallsRemaining
    );
    if (wall) return { action: "wall", wall };
  }

  if (
    playerPathLen === botPathLen &&
    botWallsRemaining > 0 &&
    Math.random() < 0.3
  ) {
    const wall = botChooseWallPlacement(
      botPos,
      playerPos,
      botGoalRow,
      playerGoalRow,
      walls,
      botWallsRemaining
    );
    if (wall) return { action: "wall", wall };
  }

  return { action: "move" };
}

function chooseMove(
  state: BlockadeGameState,
  role: BlockadeRole
): Pos | null {
  const walls = state.walls;
  const me = state.players[role].position;
  const opp = state.players[opponent(role)].position;
  const myGoal = goalRowFor(role);

  const path = bfsShortestPath(me, myGoal, walls, opp);
  console.log("BOT PATH:", path);
  console.log("BOT NEXT MOVE:", path?.[1]);

  if (path && path.length > 1) {
    const next = path[1];
    const legal = getLegalMoves(state, role);
    if (legal.some((p) => p.x === next.x && p.y === next.y)) {
      return next;
    }
  }

  const moves = getLegalMoves(state, role);
  if (moves.length === 0) return null;

  let best = moves[0];
  let bestLen = bfsPathLength(best, myGoal, walls, opp);
  for (const m of moves) {
    const len = bfsPathLength(m, myGoal, walls, opp);
    if (len < bestLen) {
      bestLen = len;
      best = m;
    }
  }
  return best;
}

export function getBlockadeBotAction(
  state: BlockadeGameState,
  role: BlockadeRole,
  _difficulty: BotDifficulty
): BotAction | null {
  if (state.phase !== "in_progress" || state.currentTurn !== role) return null;

  const walls = state.walls;
  const botPos = state.players[role].position;
  const playerPos = state.players[opponent(role)].position;
  const botGoalRow = goalRowFor(role);
  const playerGoalRow = goalRowFor(opponent(role));
  const botWallsRemaining = state.players[role].wallsRemaining;

  const playerPath = bfsShortestPath(playerPos, playerGoalRow, walls, null);
  console.log("PLAYER PATH:", playerPath);

  const decision = botDecideAction(
    botPos,
    playerPos,
    botGoalRow,
    playerGoalRow,
    walls,
    botWallsRemaining
  );

  if (decision.action === "wall") {
    return { kind: "wall", wall: decision.wall };
  }

  const to = chooseMove(state, role);
  if (to) return { kind: "move", to };

  const fallbackWall = botChooseWallPlacement(
    botPos,
    playerPos,
    botGoalRow,
    playerGoalRow,
    walls,
    botWallsRemaining
  );
  if (fallbackWall) return { kind: "wall", wall: fallbackWall };

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
