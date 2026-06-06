import type { BotDifficulty } from "./bot-engine";
import {
  applyMove,
  applyWall,
  getLegalMoves,
  goalRowFor,
  opponent,
  skipTurn,
  wallInBounds,
  type BlockadeGameState,
  type BlockadeRole,
  type Pos,
} from "./blockade-logic";
import { bfsHasPathToGoal, bfsPathLength, bfsShortestPath } from "./blockade-bfs";
import type { Wall } from "./blockade-collision";

const MAX_WALL_CANDIDATES = 50;

export function getBlockadeBotDelayMs(_difficulty: BotDifficulty): number {
  return 1000;
}

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
  let candidatesChecked = 0;

  outer: for (let i = 0; i < playerPath.length - 1; i++) {
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
      candidatesChecked++;
      if (candidatesChecked > MAX_WALL_CANDIDATES) {
        console.warn("BOT: Hit candidate limit, stopping search");
        break outer;
      }

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
      currentPlayerPathLen + bestScore
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

/** Crash-safe bot turn — always produces a state change (move, wall, or skip). */
export function executeBotTurn(
  state: BlockadeGameState,
  role: BlockadeRole = "player2"
): { state: BlockadeGameState; log: string } {
  try {
    console.log("=== BOT TURN START ===");
    const botPos = state.players[role].position;
    const playerPos = state.players[opponent(role)].position;
    const botGoalRow = goalRowFor(role);
    const playerGoalRow = goalRowFor(opponent(role));
    const walls = state.walls;

    console.log("Bot position:", botPos);
    console.log("Bot goal row:", botGoalRow);
    console.log("Walls on board:", walls.length);

    if (state.phase !== "in_progress" || state.currentTurn !== role) {
      console.warn("BOT: Not active turn, skipping");
      return { state: skipTurn(state, role), log: "Bot skipped (inactive turn)" };
    }

    const decision = botDecideAction(
      botPos,
      playerPos,
      botGoalRow,
      playerGoalRow,
      walls,
      state.players[role].wallsRemaining
    );
    console.log("Bot decision:", decision);

    if (decision.action === "wall" && decision.wall) {
      const wallResult = applyWall(state, role, decision.wall);
      if (wallResult) return wallResult;
      console.warn("BOT: Wall placement failed, falling back to move");
    }

    const opp = state.players[opponent(role)].position;
    const path = bfsShortestPath(botPos, botGoalRow, walls, opp);
    console.log("Bot BFS path:", path);

    if (path && path.length > 1) {
      const moveResult = applyMove(state, role, path[1]);
      if (moveResult) return moveResult;
    }

    console.warn("BOT FALLBACK: BFS returned no path, trying any valid move");
    const validMoves = getLegalMoves(state, role);
    if (validMoves.length > 0) {
      const moveResult = applyMove(state, role, validMoves[0]);
      if (moveResult) return moveResult;
    }

    console.error("BOT: No valid moves at all — skipping turn");
    return {
      state: skipTurn(state, role),
      log: `${role === "player1" ? "Player1" : "Player2"} skipped turn`,
    };
  } catch (error) {
    console.error("BOT TURN CRASHED:", error);
    try {
      const validMoves = getLegalMoves(state, role);
      if (validMoves.length > 0) {
        const moveResult = applyMove(state, role, validMoves[0]);
        if (moveResult) return moveResult;
      }
      return {
        state: skipTurn(state, role),
        log: `${role === "player1" ? "Player1" : "Player2"} skipped turn`,
      };
    } catch (e) {
      console.error("BOT FALLBACK ALSO CRASHED:", e);
      return {
        state: skipTurn(state, role),
        log: `${role === "player1" ? "Player1" : "Player2"} skipped turn`,
      };
    }
  }
}

/** @deprecated use executeBotTurn */
export function getBlockadeBotAction(
  state: BlockadeGameState,
  role: BlockadeRole,
  _difficulty: BotDifficulty
): { kind: "move"; to: Pos } | { kind: "wall"; wall: Wall } | null {
  if (state.phase !== "in_progress" || state.currentTurn !== role) return null;
  const result = executeBotTurn(state, role);
  const next = result.state;
  if (next.currentTurn === role && next.phase === "in_progress") return null;
  const botPos = state.players[role].position;
  const newPos = next.players[role].position;
  if (newPos.x !== botPos.x || newPos.y !== botPos.y) {
    return { kind: "move", to: newPos };
  }
  if (next.walls.length > state.walls.length) {
    return { kind: "wall", wall: next.walls[next.walls.length - 1] };
  }
  return null;
}

/** @deprecated use executeBotTurn */
export function applyBotAction(
  state: BlockadeGameState,
  role: BlockadeRole,
  action: { kind: "move"; to: Pos } | { kind: "wall"; wall: Wall }
): { state: BlockadeGameState; log: string } | null {
  if (action.kind === "move") return applyMove(state, role, action.to);
  return applyWall(state, role, action.wall);
}

/** @deprecated abilities removed */
export function pickBotAbilities(): never[] {
  return [];
}
