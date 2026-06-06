import {
  BOARD_SIZE,
  bfsHasPath,
  buildBlockedEdgeSet,
  getAllMoveTargets,
  getBlockedEdges,
  type Pos,
} from "./blockade-bfs";
import {
  isMovementBlocked,
  rebuildBlockedEdges,
  wallToBlockedEdges,
  type BlockedEdge,
} from "./blockade-edges";

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
  /** Flat list of every blocked cell-edge from active walls. Rebuilt on wall changes. */
  blockedEdges: BlockedEdge[];
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

export function syncBlockedEdges(state: BlockadeGameState): BlockadeGameState {
  state.blockedEdges = rebuildBlockedEdges(activeWalls(state));
  return state;
}

/** Active blocked edges — always rebuilt from active walls (source of truth). */
export function getBlockedEdgesForState(state: BlockadeGameState): BlockedEdge[] {
  const edges = rebuildBlockedEdges(activeWalls(state));
  state.blockedEdges = edges;
  return edges;
}

export function createInitialState(): BlockadeGameState {
  return {
    phase: "ability_selection",
    walls: [],
    blockedEdges: [],
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
  const next = { ...state, walls };
  return syncBlockedEdges(next);
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
  const blockedEdges = getBlockedEdgesForState(state);
  return getAllMoveTargets(me, blockedEdges, opp);
}

export function isValidMove(
  from: Pos,
  to: Pos,
  state: BlockadeGameState,
  role: BlockadeRole
): boolean {
  const walls = activeWalls(state);
  const blockedEdges = getBlockedEdgesForState(state);
  const opp = state.players[opponent(role)].position;

  console.log("=== MOVE VALIDATION ===");
  console.log("Moving from:", from, "to:", to);
  console.log("All walls on board:", JSON.stringify(walls, null, 2));
  console.log("Blocked edges count:", blockedEdges.length);
  console.log("Blocked edges:", JSON.stringify(blockedEdges, null, 2));

  const directBlocked = isMovementBlocked(from.x, from.y, to.x, to.y, blockedEdges);
  console.log("Direct edge blocked:", directBlocked);

  const legal = getAllMoveTargets(from, blockedEdges, opp);
  const allowed = legal.some((p) => p.x === to.x && p.y === to.y);
  console.log("Move allowed:", allowed, "legal targets:", legal);
  return allowed;
}

/**
 * Core path contract: both players must reach their goal row with all walls applied.
 * Uses the same edge set as movement (getBlockedEdges / isEdgeBlocked).
 */
export function canPlaceWallPathCheck(
  newWall: BlockadeWall,
  existingWalls: BlockadeWall[],
  player1Pos: Pos,
  player2Pos: Pos,
  player1GoalRow: number = P1_GOAL_ROW,
  player2GoalRow: number = P2_GOAL_ROW
): { allowed: boolean; player1HasPath: boolean; player2HasPath: boolean } {
  const trialEdges = [
    ...rebuildBlockedEdges(existingWalls),
    ...wallToBlockedEdges(newWall),
  ];
  const player1HasPath = bfsHasPath(player1Pos, player1GoalRow, trialEdges);
  const player2HasPath = bfsHasPath(player2Pos, player2GoalRow, trialEdges);
  return {
    allowed: player1HasPath && player2HasPath,
    player1HasPath,
    player2HasPath,
  };
}

function logWallPlacementCheck(
  wall: Omit<BlockadeWall, "id" | "owner" | "placedTurn">,
  p1: Pos,
  p2: Pos,
  player1HasPath: boolean,
  player2HasPath: boolean,
  allowed: boolean,
  phase: "check" | "placed" | "rejected"
) {
  console.log("Wall placement check:", {
    phase,
    wallType: wall.type,
    wallPosition: { row: wall.row, col: wall.col },
    wallOrientation: wall.orientation,
    rotation: wall.rotation,
    player1Position: p1,
    player2Position: p2,
    player1HasPath,
    player2HasPath,
    allowed: player1HasPath && player2HasPath,
  });
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
      logWallPlacementCheck(wall, state.players.player1.position, state.players.player2.position, false, false, false, "rejected");
      return { valid: false, error: "Wall overlaps existing wall" };
    }
  }

  const existingActive = activeWalls(state);

  const p1 = state.players.player1.position;
  const p2 = state.players.player2.position;
  const pathCheck = canPlaceWallPathCheck(candidate, existingActive, p1, p2);

  logWallPlacementCheck(
    wall,
    p1,
    p2,
    pathCheck.player1HasPath,
    pathCheck.player2HasPath,
    pathCheck.allowed,
    "check"
  );

  if (!pathCheck.allowed) {
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
  if (!check.valid) {
    console.log("Wall placement rejected by applyWall:", {
      error: check.error,
      wallType: wallInput.type,
      wallPosition: { row: wallInput.row, col: wallInput.col },
      wallOrientation: wallInput.orientation,
    });
    return null;
  }

  const preActive = activeWalls(state);
  const preCandidate: BlockadeWall = {
    ...wallInput,
    id: "pre-apply-guard",
    owner: role,
    placedTurn: state.turnNumber,
    isBomb: asBomb,
    expiresAtTurn: asBomb ? state.turnNumber + 3 : undefined,
  };
  const guard = canPlaceWallPathCheck(
    preCandidate,
    preActive,
    state.players.player1.position,
    state.players.player2.position
  );
  if (!guard.allowed) {
    console.error("Wall placement guard failed after validateWallPlacement:", {
      wallType: wallInput.type,
      wallPosition: { row: wallInput.row, col: wallInput.col },
      player1HasPath: guard.player1HasPath,
      player2HasPath: guard.player2HasPath,
    });
    return null;
  }

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
  syncBlockedEdges(next);

  console.log("Wall placed — new blocked edges:", JSON.stringify(next.blockedEdges, null, 2));

  const allAfter = activeWalls(next);
  const postP1 = bfsHasPath(next.players.player1.position, P1_GOAL_ROW, next.blockedEdges);
  const postP2 = bfsHasPath(next.players.player2.position, P2_GOAL_ROW, next.blockedEdges);
  console.log("Wall placement placed:", {
    wallType: wall.type,
    wallPosition: { row: wall.row, col: wall.col },
    wallOrientation: wall.orientation,
    rotation: wall.rotation,
    player1Position: next.players.player1.position,
    player2Position: next.players.player2.position,
    player1HasPath: postP1,
    player2HasPath: postP2,
    allowed: postP1 && postP2,
    blockedEdges: buildBlockedEdgeSet(allAfter).size,
  });

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
  syncBlockedEdges(next);
  markAbilityUsed(next, role, "wall_break");
  const name = role === "player1" ? "Player1" : "Player2";
  return finishTurn(next, `${name} used Wall Break!`);
}

export function getGhostStepTargets(state: BlockadeGameState, role: BlockadeRole): Pos[] {
  const me = state.players[role].position;
  const blockedEdges = getBlockedEdgesForState(state);
  const targets: Pos[] = [];
  const dirs = [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];

  for (const d of dirs) {
    const adj = { x: me.x + d.x, y: me.y + d.y };
    const beyond = { x: me.x + d.x * 2, y: me.y + d.y * 2 };
    if (beyond.x < 0 || beyond.x >= BOARD_SIZE || beyond.y < 0 || beyond.y >= BOARD_SIZE) continue;
    if (!isMovementBlocked(me.x, me.y, adj.x, adj.y, blockedEdges)) continue;
    if (isMovementBlocked(adj.x, adj.y, beyond.x, beyond.y, blockedEdges)) continue;
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
    const state = raw as unknown as BlockadeGameState;
    if (!Array.isArray(state.blockedEdges)) {
      state.blockedEdges = [];
    }
    return syncBlockedEdges(state);
  } catch {
    return null;
  }
}
