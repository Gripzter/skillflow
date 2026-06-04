import {
  BOARD_SIZE,
  canReachGoalRow,
  getAllMoveTargets,
  getBlockedEdges,
  isEdgeBlocked,
  posKey,
  type Pos,
} from "./blockade-bfs";

export type { Pos };
export { BOARD_SIZE };

export type BlockadeRole = "player1" | "player2";
export type WallType = "standard" | "lshape" | "triple";
export type WallOrientation = "h" | "v";
export type BlockadeAbilityId = "double_move" | "wall_break" | "ghost_step" | "wall_bomb";
export type GamePhase = "ability_selection" | "in_progress" | "completed";

export type BlockadeWall = {
  id: string;
  type: WallType;
  orientation: WallOrientation;
  row: number;
  col: number;
  rotation?: number;
  owner: BlockadeRole;
  placedTurn: number;
  isBomb?: boolean;
  expiresAtTurn?: number;
};

export type WallSupply = {
  standard: number;
  lshape: number;
  triple: number;
};

export type PlayerState = {
  position: Pos;
  walls: WallSupply;
  abilities: {
    chosen: BlockadeAbilityId[];
    used: BlockadeAbilityId[];
    revealed: BlockadeAbilityId[];
  };
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
  abilityReady: { player1: boolean; player2: boolean };
  pendingAbility: BlockadeAbilityId | null;
  doubleMoveRemaining: number;
  winner: BlockadeRole | null;
};

export const P1_START: Pos = { x: 4, y: 0 };
export const P2_START: Pos = { x: 4, y: 8 };
export const P1_GOAL_ROW = 8;
export const P2_GOAL_ROW = 0;

export const INITIAL_WALL_SUPPLY: WallSupply = { standard: 6, lshape: 2, triple: 1 };

export const ABILITY_DEFS: {
  id: BlockadeAbilityId;
  name: string;
  description: string;
}[] = [
  { id: "double_move", name: "Double Move", description: "Move twice in one turn (no wall)." },
  { id: "wall_break", name: "Wall Break", description: "Destroy one opponent wall." },
  { id: "ghost_step", name: "Ghost Step", description: "Pass through one adjacent wall." },
  { id: "wall_bomb", name: "Wall Bomb", description: "Place a wall that expires in 3 turns." },
];

export const DEFAULT_ABILITIES: BlockadeAbilityId[] = ["double_move", "wall_break"];

export function createInitialState(): BlockadeGameState {
  return {
    phase: "ability_selection",
    walls: [],
    players: {
      player1: {
        position: { ...P1_START },
        walls: { ...INITIAL_WALL_SUPPLY },
        abilities: { chosen: [], used: [], revealed: [] },
      },
      player2: {
        position: { ...P2_START },
        walls: { ...INITIAL_WALL_SUPPLY },
        abilities: { chosen: [], used: [], revealed: [] },
      },
    },
    currentTurn: "player1",
    turnNumber: 1,
    consecutiveSkips: { player1: 0, player2: 0 },
    abilityReady: { player1: false, player2: false },
    pendingAbility: null,
    doubleMoveRemaining: 0,
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

export function activeWalls(state: BlockadeGameState): BlockadeWall[] {
  return state.walls.filter(
    (w) => !w.isBomb || w.expiresAtTurn === undefined || w.expiresAtTurn > state.turnNumber
  );
}

export function expireBombs(state: BlockadeGameState): BlockadeGameState {
  const before = state.walls.length;
  const walls = state.walls.filter(
    (w) => !w.isBomb || w.expiresAtTurn === undefined || w.expiresAtTurn > state.turnNumber
  );
  if (walls.length === before) return state;
  return { ...state, walls };
}

function cloneState(s: BlockadeGameState): BlockadeGameState {
  return JSON.parse(JSON.stringify(s)) as BlockadeGameState;
}

export function setAbilities(
  state: BlockadeGameState,
  role: BlockadeRole,
  chosen: BlockadeAbilityId[]
): BlockadeGameState {
  const next = cloneState(state);
  if (chosen.length !== 2) return next;
  next.players[role].abilities.chosen = chosen;
  next.abilityReady[role] = true;
  if (next.abilityReady.player1 && next.abilityReady.player2) {
    next.phase = "in_progress";
    next.currentTurn = "player1";
    next.turnNumber = 1;
  }
  return next;
}

export function getLegalMoves(
  state: BlockadeGameState,
  role: BlockadeRole
): Pos[] {
  const me = state.players[role].position;
  const opp = state.players[opponent(role)].position;
  return getAllMoveTargets(me, activeWalls(state), opp);
}

export function isValidMove(
  from: Pos,
  to: Pos,
  state: BlockadeGameState,
  role: BlockadeRole
): boolean {
  const opp = state.players[opponent(role)].position;
  return getAllMoveTargets(from, activeWalls(state), opp).some(
    (p) => p.x === to.x && p.y === to.y
  );
}

/** Temporarily adds a wall and verifies both players can still reach their goal row. */
export function canPlaceWall(
  state: BlockadeGameState,
  wall: Omit<BlockadeWall, "id" | "owner" | "placedTurn">
): boolean {
  return validateWallPlacement(state, state.currentTurn, wall).valid;
}

export function wallsOverlap(a: BlockadeWall, b: BlockadeWall): boolean {
  const ea = getBlockedEdges(a);
  const eb = getBlockedEdges(b);
  for (const [p1, p2] of ea) {
    for (const [q1, q2] of eb) {
      if (
        (p1.x === q1.x && p1.y === q1.y && p2.x === q2.x && p2.y === q2.y) ||
        (p1.x === q2.x && p1.y === q2.y && p2.x === q1.x && p2.y === q1.y)
      ) {
        return true;
      }
    }
  }
  return false;
}

export function wallInBounds(wall: BlockadeWall): boolean {
  if (wall.type === "standard") {
    if (wall.orientation === "h") {
      return wall.row >= 0 && wall.row < BOARD_SIZE - 1 && wall.col >= 0 && wall.col < BOARD_SIZE - 1;
    }
    return wall.row >= 0 && wall.row < BOARD_SIZE - 1 && wall.col >= 0 && wall.col < BOARD_SIZE - 1;
  }
  if (wall.type === "triple") {
    if (wall.orientation === "h") {
      return wall.row >= 0 && wall.row < BOARD_SIZE - 1 && wall.col >= 0 && wall.col < BOARD_SIZE - 2;
    }
    return wall.row >= 0 && wall.row < BOARD_SIZE - 2 && wall.col >= 0 && wall.col < BOARD_SIZE - 1;
  }
  const r = wall.row;
  const c = wall.col;
  return r >= 0 && r < BOARD_SIZE - 1 && c >= 0 && c < BOARD_SIZE - 1;
}

export function validateWallPlacement(
  state: BlockadeGameState,
  role: BlockadeRole,
  wall: Omit<BlockadeWall, "id" | "owner" | "placedTurn">
): { valid: boolean; error?: string } {
  const player = state.players[role];
  if (wall.type === "standard" && player.walls.standard <= 0) {
    return { valid: false, error: "No standard walls left" };
  }
  if (wall.type === "lshape" && player.walls.lshape <= 0) {
    return { valid: false, error: "No L-walls left" };
  }
  if (wall.type === "triple" && player.walls.triple <= 0) {
    return { valid: false, error: "No triple walls left" };
  }
  if (!wallInBounds(wall as BlockadeWall)) {
    return { valid: false, error: "Wall out of bounds" };
  }

  const candidate: BlockadeWall = {
    ...wall,
    id: "tmp",
    owner: role,
    placedTurn: state.turnNumber,
  };

  for (const existing of state.walls) {
    if (wallsOverlap(candidate, existing)) {
      return { valid: false, error: "Wall overlaps existing wall" };
    }
  }

  const trialWalls = [...activeWalls(state), candidate];
  const p1 = state.players.player1.position;
  const p2 = state.players.player2.position;

  if (!canReachGoalRow(p1, P1_GOAL_ROW, trialWalls, p2)) {
    return { valid: false, error: "Invalid — would block a path" };
  }
  if (!canReachGoalRow(p2, P2_GOAL_ROW, trialWalls, p1)) {
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
  if (!isValidMove(state.players[role].position, to, state, role)) return null;

  const next = cloneState(state);
  next.players[role].position = { ...to };
  const name = role === "player1" ? "Player1" : "Player2";

  if (hasWon(role, to)) {
    next.winner = role;
    next.phase = "completed";
    return { state: next, log: `${name} reached the goal and wins!` };
  }

  if (next.doubleMoveRemaining > 0) {
    next.doubleMoveRemaining -= 1;
    if (next.doubleMoveRemaining > 0) {
      return { state: next, log: `${name} moved to (${to.x}, ${to.y}) — second move` };
    }
  }

  return finishTurn(next, `${name} moved to (${to.x}, ${to.y})`);
}

function finishTurn(state: BlockadeGameState, log: string): { state: BlockadeGameState; log: string } {
  let next = expireBombs(state);
  next = { ...next, currentTurn: opponent(next.currentTurn), turnNumber: next.turnNumber + 1 };
  next.consecutiveSkips[next.currentTurn] = 0;
  next.pendingAbility = null;
  next.doubleMoveRemaining = 0;
  return { state: next, log };
}

export function applyWall(
  state: BlockadeGameState,
  role: BlockadeRole,
  wallInput: Omit<BlockadeWall, "id" | "owner" | "placedTurn">,
  asBomb = false
): { state: BlockadeGameState; log: string } | null {
  if (state.phase !== "in_progress" || state.currentTurn !== role) return null;
  if (state.doubleMoveRemaining > 0) return null;

  const check = validateWallPlacement(state, role, wallInput);
  if (!check.valid) return null;

  const next = cloneState(state);
  const wall: BlockadeWall = {
    ...wallInput,
    id: `w-${next.turnNumber}-${role}-${next.walls.length}`,
    owner: role,
    placedTurn: next.turnNumber,
    isBomb: asBomb,
    expiresAtTurn: asBomb ? next.turnNumber + 3 : undefined,
  };
  next.walls.push(wall);

  if (wall.type === "standard") next.players[role].walls.standard -= 1;
  if (wall.type === "lshape") next.players[role].walls.lshape -= 1;
  if (wall.type === "triple") next.players[role].walls.triple -= 1;

  const typeLabel = asBomb ? "Wall Bomb" : wall.type === "standard" ? "Standard" : wall.type === "lshape" ? "L-Shape" : "Triple";
  const name = role === "player1" ? "Player1" : "Player2";
  return finishTurn(next, `${name} placed ${typeLabel} wall`);
}

export function applyWallBreak(
  state: BlockadeGameState,
  role: BlockadeRole,
  wallId: string
): { state: BlockadeGameState; log: string } | null {
  if (state.phase !== "in_progress" || state.currentTurn !== role) return null;
  const idx = state.walls.findIndex((w) => w.id === wallId);
  if (idx < 0) return null;
  if (state.walls[idx].owner === role) return null;

  const next = cloneState(state);
  next.walls.splice(idx, 1);
  markAbilityUsed(next, role, "wall_break");
  const name = role === "player1" ? "Player1" : "Player2";
  return finishTurn(next, `${name} used Wall Break!`);
}

export function getGhostStepTargets(state: BlockadeGameState, role: BlockadeRole): Pos[] {
  const me = state.players[role].position;
  const walls = activeWalls(state);
  const targets: Pos[] = [];
  const dirs = [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];

  for (const d of dirs) {
    const adj = { x: me.x + d.x, y: me.y + d.y };
    const beyond = { x: me.x + d.x * 2, y: me.y + d.y * 2 };
    if (beyond.x < 0 || beyond.x >= BOARD_SIZE || beyond.y < 0 || beyond.y >= BOARD_SIZE) continue;
    if (!isEdgeBlocked(me, adj, walls)) continue;
    if (isEdgeBlocked(adj, beyond, walls)) continue;
    const opp = state.players[opponent(role)].position;
    if (beyond.x === opp.x && beyond.y === opp.y) continue;
    targets.push(beyond);
  }
  return targets;
}

export function applyGhostStep(
  state: BlockadeGameState,
  role: BlockadeRole,
  to: Pos
): { state: BlockadeGameState; log: string } | null {
  const targets = getGhostStepTargets(state, role);
  if (!targets.some((p) => p.x === to.x && p.y === to.y)) return null;
  const next = cloneState(state);
  next.players[role].position = { ...to };
  markAbilityUsed(next, role, "ghost_step");
  const name = role === "player1" ? "Player1" : "Player2";
  if (hasWon(role, to)) {
    next.winner = role;
    next.phase = "completed";
    return { state: next, log: `${name} used Ghost Step and wins!` };
  }
  return finishTurn(next, `${name} used Ghost Step to (${to.x}, ${to.y})`);
}

function markAbilityUsed(state: BlockadeGameState, role: BlockadeRole, id: BlockadeAbilityId) {
  const ab = state.players[role].abilities;
  if (!ab.used.includes(id)) ab.used.push(id);
  if (!ab.revealed.includes(id)) ab.revealed.push(id);
}

export function startAbility(
  state: BlockadeGameState,
  role: BlockadeRole,
  ability: BlockadeAbilityId
): BlockadeGameState | null {
  if (state.phase !== "in_progress" || state.currentTurn !== role) return null;
  const ab = state.players[role].abilities;
  if (!ab.chosen.includes(ability) || ab.used.includes(ability)) return null;

  const next = cloneState(state);
  next.pendingAbility = ability;

  if (ability === "double_move") {
    next.doubleMoveRemaining = 2;
    markAbilityUsed(next, role, ability);
    return next;
  }
  return next;
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
    return raw as unknown as BlockadeGameState;
  } catch {
    return null;
  }
}
