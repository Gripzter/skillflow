import { isBlocked, type Wall } from "./blockade-collision";
import {
  BOARD_SIZE,
  bfsHasPathToGoal,
  bfsPathLength,
  bfsShortestPath,
  getLegalTargets,
  type Pos,
} from "./blockade-bfs";

export type { Pos } from "./blockade-bfs";
export { BOARD_SIZE };
export { isBlocked } from "./blockade-collision";

export type BlockadeRole = "player1" | "player2";
export type GamePhase = "in_progress" | "completed";

export type BlockadeWall = Wall & {
  id: string;
  owner: BlockadeRole;
};

export type PlayerState = {
  position: Pos;
  wallsRemaining: number;
};

export type BlockadeGameState = {
  phase: GamePhase;
  walls: BlockadeWall[];
  players: {
    player1: PlayerState;
    player2: PlayerState;
  };
  currentTurn: BlockadeRole;
  turnNumber: number;
  consecutiveSkips: { player1: number; player2: number };
  winner: BlockadeRole | null;
};

/** y=0 top, y=8 bottom — P1 starts bottom, reaches top */
export const P1_START: Pos = { x: 4, y: 8 };
export const P2_START: Pos = { x: 4, y: 0 };
export const P1_GOAL_ROW = 0;
export const P2_GOAL_ROW = 8;
export const WALLS_PER_PLAYER = 10;

export function createInitialState(): BlockadeGameState {
  return {
    phase: "in_progress",
    walls: [],
    players: {
      player1: { position: { ...P1_START }, wallsRemaining: WALLS_PER_PLAYER },
      player2: { position: { ...P2_START }, wallsRemaining: WALLS_PER_PLAYER },
    },
    currentTurn: "player1",
    turnNumber: 1,
    consecutiveSkips: { player1: 0, player2: 0 },
    winner: null,
  };
}

export function opponent(role: BlockadeRole): BlockadeRole {
  return role === "player1" ? "player2" : "player1";
}

export function goalRowFor(role: BlockadeRole): number {
  return role === "player1" ? P1_GOAL_ROW : P2_GOAL_ROW;
}

export function hasWon(role: BlockadeRole, pos: Pos): boolean {
  return pos.y === goalRowFor(role);
}

function cloneState(s: BlockadeGameState): BlockadeGameState {
  return JSON.parse(JSON.stringify(s)) as BlockadeGameState;
}

function wallsAsCollisionList(state: BlockadeGameState): Wall[] {
  return state.walls;
}

export function getLegalMoves(state: BlockadeGameState, role: BlockadeRole): Pos[] {
  const me = state.players[role].position;
  const opp = state.players[opponent(role)].position;
  const walls = wallsAsCollisionList(state);
  return getLegalTargets(me, walls, opp);
}

export function wallInBounds(wall: Wall): boolean {
  if (wall.orientation === "horizontal") {
    return (
      wall.x >= 0 &&
      wall.x <= BOARD_SIZE - 2 &&
      wall.y >= 1 &&
      wall.y <= BOARD_SIZE - 1
    );
  }
  return (
    wall.x >= 1 &&
    wall.x <= BOARD_SIZE - 1 &&
    wall.y >= 0 &&
    wall.y <= BOARD_SIZE - 2
  );
}

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

export function validateWallPlacement(
  state: BlockadeGameState,
  role: BlockadeRole,
  wall: Wall
): { valid: boolean; error?: string } {
  if (state.players[role].wallsRemaining <= 0) {
    return { valid: false, error: "No walls left" };
  }
  if (!wallInBounds(wall)) {
    return { valid: false, error: "Wall out of bounds" };
  }
  for (const existing of state.walls) {
    if (wallsOverlap(wall, existing)) {
      return { valid: false, error: "Wall overlaps existing wall" };
    }
  }

  const trial = [...state.walls, { ...wall, id: "tmp", owner: role }];
  const p1 = state.players.player1.position;
  const p2 = state.players.player2.position;

  if (!bfsHasPathToGoal(p1, P1_GOAL_ROW, trial)) {
    return { valid: false, error: "Invalid — would block a path" };
  }
  if (!bfsHasPathToGoal(p2, P2_GOAL_ROW, trial)) {
    return { valid: false, error: "Invalid — would block a path" };
  }

  return { valid: true };
}

export function applyMove(
  state: BlockadeGameState,
  role: BlockadeRole,
  to: Pos
): { state: BlockadeGameState; log: string } | null {
  if (state.phase !== "in_progress" || state.currentTurn !== role) return null;

  const from = state.players[role].position;
  const fromX = from.x;
  const fromY = from.y;
  const toX = to.x;
  const toY = to.y;
  const walls = wallsAsCollisionList(state);

  console.log("MOVE ATTEMPT:", fromX, fromY, "→", toX, toY);
  console.log("WALLS:", JSON.stringify(walls));
  console.log("BLOCKED:", isBlocked(fromX, fromY, toX, toY, walls));

  if (isBlocked(fromX, fromY, toX, toY, walls)) {
    console.error("BLOCKED BY WALL — move rejected");
    return null;
  }

  const legal = getLegalMoves(state, role);
  if (!legal.some((p) => p.x === to.x && p.y === to.y)) return null;

  const next = cloneState(state);
  next.players[role].position = { ...to };
  const name = role === "player1" ? "Player1" : "Player2";

  if (hasWon(role, to)) {
    next.winner = role;
    next.phase = "completed";
    return { state: next, log: `${name} reached the goal and wins!` };
  }

  return finishTurn(next, `${name} moved to (${to.x}, ${to.y})`);
}

function finishTurn(state: BlockadeGameState, log: string): { state: BlockadeGameState; log: string } {
  const next = {
    ...state,
    currentTurn: opponent(state.currentTurn),
    turnNumber: state.turnNumber + 1,
  };
  next.consecutiveSkips[next.currentTurn] = 0;
  return { state: next, log };
}

export function applyWall(
  state: BlockadeGameState,
  role: BlockadeRole,
  wallInput: Wall
): { state: BlockadeGameState; log: string } | null {
  if (state.phase !== "in_progress" || state.currentTurn !== role) return null;

  const check = validateWallPlacement(state, role, wallInput);
  if (!check.valid) return null;

  const next = cloneState(state);
  const wall: BlockadeWall = {
    ...wallInput,
    id: `w-${next.turnNumber}-${role}-${next.walls.length}`,
    owner: role,
  };
  next.walls.push(wall);
  next.players[role].wallsRemaining -= 1;

  console.log("Wall placed. Total walls:", next.walls.length);
  console.log("WALLS:", JSON.stringify(next.walls));

  const name = role === "player1" ? "Player1" : "Player2";
  return finishTurn(next, `${name} placed a wall`);
}

export function skipTurn(state: BlockadeGameState, role: BlockadeRole): BlockadeGameState {
  const next = cloneState(state);
  next.consecutiveSkips[role] += 1;
  if (next.consecutiveSkips[role] >= 3) {
    next.winner = opponent(role);
    next.phase = "completed";
    return next;
  }
  return finishTurn(next, `${role === "player1" ? "Player1" : "Player2"} skipped turn`).state;
}

export function serializeState(state: BlockadeGameState): Record<string, unknown> {
  return state as unknown as Record<string, unknown>;
}

export function parseState(raw: Record<string, unknown> | null): BlockadeGameState | null {
  if (!raw || typeof raw !== "object") return null;
  try {
    const state = raw as unknown as BlockadeGameState;
    if (!state.walls) state.walls = [];
    if (state.players?.player1?.wallsRemaining === undefined) {
      state.players.player1.wallsRemaining = WALLS_PER_PLAYER;
    }
    if (state.players?.player2?.wallsRemaining === undefined) {
      state.players.player2.wallsRemaining = WALLS_PER_PLAYER;
    }
    if (!state.phase) state.phase = "in_progress";
    return state;
  } catch {
    return null;
  }
}

/** @deprecated abilities removed */
export function setAbilities(state: BlockadeGameState): BlockadeGameState {
  return state;
}

export { bfsPathLength, bfsShortestPath, bfsHasPathToGoal };
