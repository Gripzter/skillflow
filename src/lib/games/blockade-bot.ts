import type { BotDifficulty } from "./bot-engine";
import {
  activeWalls,
  applyGhostStep,
  applyMove,
  applyWall,
  applyWallBreak,
  canPlaceWallPathCheck,
  getGhostStepTargets,
  getLegalMoves,
  goalRowFor,
  opponent,
  startAbility,
  validateWallPlacement,
  wallInBounds,
  wallsOverlap,
  type BlockadeAbilityId,
  type BlockadeGameState,
  type BlockadeRole,
  type BlockadeWall,
  type Pos,
  type WallSupply,
} from "./blockade-logic";
import { rebuildBlockedEdges } from "./blockade-edges";
import {
  bfsShortestPath,
  BOARD_SIZE,
  edgeKey,
  getBlockedEdges,
  shortestPathToGoal,
} from "./blockade-bfs";

/** Human-like think delay before the bot acts. */
export function getBlockadeBotDelayMs(_difficulty: BotDifficulty): number {
  return 800 + Math.random() * 700;
}

const ALL_ABILITIES: BlockadeAbilityId[] = ["double_move", "wall_break", "ghost_step", "wall_bomb"];

const lastBotPositions: Partial<Record<BlockadeRole, Pos>> = {};

export function pickBotAbilities(difficulty: BotDifficulty): BlockadeAbilityId[] {
  if (difficulty === "rookie") {
    const shuffled = [...ALL_ABILITIES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 2);
  }
  return ["wall_break", "double_move"];
}

type BotAction =
  | { kind: "move"; to: Pos }
  | { kind: "wall"; wall: Omit<BlockadeWall, "id" | "owner" | "placedTurn"> }
  | { kind: "wall_break"; wallId: string }
  | { kind: "ghost_step"; to: Pos }
  | { kind: "start_double_move" };

type BotView = {
  botPosition: Pos;
  playerPosition: Pos;
  walls: BlockadeWall[];
  botGoalRow: number;
  playerGoalRow: number;
  botWallsRemaining: WallSupply;
  botAbilities: {
    doubleMoveAvailable: boolean;
    ghostStepAvailable: boolean;
    wallBreakAvailable: boolean;
  };
  doubleMoveActive: boolean;
};

function wallsRemainingTotal(supply: WallSupply): number {
  return supply.standard + supply.lshape + supply.triple;
}

function bfsPathLength(
  start: Pos,
  goalRow: number,
  walls: BlockadeWall[],
  opponentPos: Pos
): number {
  return shortestPathToGoal(start, goalRow, rebuildBlockedEdges(walls), opponentPos);
}

function bfsPath(
  start: Pos,
  goalRow: number,
  walls: BlockadeWall[],
  opponentPos: Pos
): Pos[] | null {
  return bfsShortestPath(start, goalRow, rebuildBlockedEdges(walls), opponentPos);
}

function buildBotView(state: BlockadeGameState, role: BlockadeRole): BotView {
  const oppRole = opponent(role);
  const ab = state.players[role].abilities;
  return {
    botPosition: state.players[role].position,
    playerPosition: state.players[oppRole].position,
    walls: activeWalls(state),
    botGoalRow: goalRowFor(role),
    playerGoalRow: goalRowFor(oppRole),
    botWallsRemaining: state.players[role].walls,
    botAbilities: {
      doubleMoveAvailable:
        ab.chosen.includes("double_move") &&
        !ab.used.includes("double_move") &&
        state.doubleMoveRemaining === 0,
      ghostStepAvailable: ab.chosen.includes("ghost_step") && !ab.used.includes("ghost_step"),
      wallBreakAvailable: ab.chosen.includes("wall_break") && !ab.used.includes("wall_break"),
    },
    doubleMoveActive: state.doubleMoveRemaining > 0,
  };
}

function wallKey(w: Omit<BlockadeWall, "id" | "owner" | "placedTurn">): string {
  return `${w.type}:${w.orientation}:${w.row}:${w.col}:${w.rotation ?? 0}`;
}

function wallOverlapsExisting(
  candidate: Omit<BlockadeWall, "id" | "owner" | "placedTurn">,
  walls: BlockadeWall[]
): boolean {
  const tmp: BlockadeWall = { ...candidate, id: "tmp", owner: "player1", placedTurn: 0 };
  return walls.some((w) => wallsOverlap(tmp, w));
}

/** Walls adjacent to a cell the opponent must cross. */
function generateWallCandidatesNearCell(
  cell: Pos,
  wallsRemaining: WallSupply
): Omit<BlockadeWall, "id" | "owner" | "placedTurn">[] {
  const { x, y } = cell;
  const out: Omit<BlockadeWall, "id" | "owner" | "placedTurn">[] = [];
  const seen = new Set<string>();
  const push = (w: Omit<BlockadeWall, "id" | "owner" | "placedTurn">) => {
    if (!wallInBounds(w as BlockadeWall)) return;
    const k = wallKey(w);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(w);
  };

  if (wallsRemaining.standard > 0) {
    for (const dx of [-1, 0]) {
      if (y < BOARD_SIZE - 1) push({ type: "standard", orientation: "h", row: y, col: x + dx });
      if (y > 0) push({ type: "standard", orientation: "h", row: y - 1, col: x + dx });
    }
    for (const dy of [-1, 0]) {
      if (x < BOARD_SIZE - 1) push({ type: "standard", orientation: "v", row: y + dy, col: x });
      if (x > 0) push({ type: "standard", orientation: "v", row: y + dy, col: x - 1 });
    }
  }

  if (wallsRemaining.lshape > 0) {
    for (let rotation = 0; rotation < 4; rotation++) {
      push({ type: "lshape", orientation: "h", row: y, col: x, rotation });
      if (x > 0) push({ type: "lshape", orientation: "h", row: y, col: x - 1, rotation });
      if (y > 0) push({ type: "lshape", orientation: "h", row: y - 1, col: x, rotation });
    }
  }

  if (wallsRemaining.triple > 0) {
    for (const dx of [-2, -1, 0]) {
      if (y < BOARD_SIZE - 1) push({ type: "triple", orientation: "h", row: y, col: x + dx });
      if (y > 0) push({ type: "triple", orientation: "h", row: y - 1, col: x + dx });
    }
    for (const dy of [-2, -1, 0]) {
      if (x < BOARD_SIZE - 1) push({ type: "triple", orientation: "v", row: y + dy, col: x });
      if (x > 0) push({ type: "triple", orientation: "v", row: y + dy, col: x - 1 });
    }
  }

  return out;
}

function decideShouldPlaceWall(botPathLen: number, playerPathLen: number, view: BotView): boolean {
  if (wallsRemainingTotal(view.botWallsRemaining) === 0) return false;
  if (view.doubleMoveActive) return false;
  if (playerPathLen < botPathLen) return Math.random() < 0.8;
  if (playerPathLen === botPathLen) return Math.random() < 0.4;
  return Math.random() < 0.15;
}

function findBestWallPlacement(
  view: BotView,
  state: BlockadeGameState,
  role: BlockadeRole
): { wall: Omit<BlockadeWall, "id" | "owner" | "placedTurn">; score: number } | null {
  const { botPosition, playerPosition, walls, botGoalRow, playerGoalRow } = view;

  const playerPath = bfsPath(playerPosition, playerGoalRow, walls, botPosition);
  const currentPlayerPathLen = playerPath ? playerPath.length - 1 : 999;
  const currentBotPathLen = bfsPathLength(botPosition, botGoalRow, walls, playerPosition);

  const pathCells = playerPath ? playerPath.slice(0, Math.min(playerPath.length, 6)) : [];

  let bestWall: Omit<BlockadeWall, "id" | "owner" | "placedTurn"> | null = null;
  let bestScore = 0;

  for (const cell of pathCells) {
    const candidates = generateWallCandidatesNearCell(cell, view.botWallsRemaining);

    for (const candidate of candidates) {
      if (wallOverlapsExisting(candidate, walls)) continue;

      const tmp: BlockadeWall = {
        ...candidate,
        id: "bot-eval",
        owner: role,
        placedTurn: state.turnNumber,
      };
      const pathOk = canPlaceWallPathCheck(
        tmp,
        walls,
        state.players.player1.position,
        state.players.player2.position
      );
      if (!pathOk.allowed) continue;
      if (!validateWallPlacement(state, role, candidate).valid) continue;

      const testWalls = [...walls, tmp];
      const newPlayerPathLen = bfsPathLength(playerPosition, playerGoalRow, testWalls, botPosition);
      const newBotPathLen = bfsPathLength(botPosition, botGoalRow, testWalls, playerPosition);

      const playerSlowdown = newPlayerPathLen - currentPlayerPathLen;
      const botSlowdown = newBotPathLen - currentBotPathLen;
      const score = playerSlowdown - botSlowdown;

      if (score > bestScore) {
        bestScore = score;
        bestWall = candidate;
      }
    }
  }

  return bestWall && bestScore > 0 ? { wall: bestWall, score: bestScore } : null;
}

function evaluateGhostStep(
  view: BotView,
  state: BlockadeGameState,
  role: BlockadeRole
): { saving: number; target: Pos } | null {
  const baseline = bfsPathLength(view.botPosition, view.botGoalRow, view.walls, view.playerPosition);
  const targets = getGhostStepTargets(state, role);
  let bestTarget: Pos | null = null;
  let bestSaving = 0;

  for (const t of targets) {
    const len = bfsPathLength(t, view.botGoalRow, view.walls, view.playerPosition);
    const saving = baseline - len;
    if (saving > bestSaving) {
      bestSaving = saving;
      bestTarget = t;
    }
  }

  if (bestSaving >= 3 && bestTarget) {
    return { saving: bestSaving, target: bestTarget };
  }
  return null;
}

function pathUsesWallEdges(path: Pos[] | null, wall: BlockadeWall): boolean {
  if (!path || path.length < 2) return false;
  const blocked = new Set(getBlockedEdges(wall).map(([a, b]) => edgeKey(a, b)));
  for (let i = 0; i < path.length - 1; i++) {
    if (blocked.has(edgeKey(path[i], path[i + 1]))) return true;
  }
  return false;
}

function evaluateWallBreak(
  view: BotView,
  state: BlockadeGameState,
  role: BlockadeRole
): string | null {
  const me = view.botPosition;
  const opp = view.playerPosition;
  const walls = view.walls;
  const myGoal = view.botGoalRow;
  const baseline = bfsPathLength(me, myGoal, walls, opp);
  const botPath = bfsPath(me, myGoal, walls, opp);

  let bestId: string | null = null;
  let bestGain = 0;

  for (const w of state.walls) {
    const without = walls.filter((x) => x.id !== w.id);
    const newLen = bfsPathLength(me, myGoal, without, opp);
    const gain = baseline - newLen;
    if (gain < 2) continue;

    const isOpponentWall = w.owner === opponent(role);
    const onBotPath = isOpponentWall && pathUsesWallEdges(botPath, w);
    const ownWallHurting = w.owner === role && gain >= 2;

    if (onBotPath || ownWallHurting || (isOpponentWall && gain >= 2)) {
      if (gain > bestGain) {
        bestGain = gain;
        bestId = w.id;
      }
    }
  }

  return bestId;
}

function getAnyValidMove(state: BlockadeGameState, role: BlockadeRole): Pos | null {
  const legal = getLegalMoves(state, role);
  return legal.length > 0 ? legal[0] : null;
}

function pickMoveAlongPath(
  state: BlockadeGameState,
  role: BlockadeRole,
  view: BotView
): Pos | null {
  const legal = getLegalMoves(state, role);
  if (legal.length === 0) return null;

  const path = bfsPath(view.botPosition, view.botGoalRow, view.walls, view.playerPosition);
  if (path && path.length > 1) {
    let next = path[1];
    const last = lastBotPositions[role];
    if (last && next.x === last.x && next.y === last.y && legal.length > 1) {
      const alt = legal.find((p) => p.x !== last.x || p.y !== last.y);
      if (alt) next = alt;
    }
    if (legal.some((p) => p.x === next.x && p.y === next.y)) return next;
  }

  let best = legal[0];
  let bestLen = Infinity;
  for (const m of legal) {
    const len = bfsPathLength(m, view.botGoalRow, view.walls, view.playerPosition);
    if (len < bestLen) {
      bestLen = len;
      best = m;
    }
  }
  return best;
}

/** Master bot decision — every choice driven by BFS path length. */
function botTakeTurn(state: BlockadeGameState, role: BlockadeRole): BotAction | null {
  const view = buildBotView(state, role);
  const { botPosition, playerPosition, walls, botGoalRow, playerGoalRow } = view;

  if (view.doubleMoveActive) {
    const to = pickMoveAlongPath(state, role, view);
    return to ? { kind: "move", to } : null;
  }

  const botPathLen = bfsPathLength(botPosition, botGoalRow, walls, playerPosition);
  const playerPathLen = bfsPathLength(playerPosition, playerGoalRow, walls, botPosition);

  if (botPathLen === 2 && view.botAbilities.doubleMoveAvailable) {
    return { kind: "start_double_move" };
  }

  if (botPathLen === 1) {
    const path = bfsPath(botPosition, botGoalRow, walls, playerPosition);
    if (path && path.length > 1) {
      return { kind: "move", to: path[1] };
    }
  }

  if (decideShouldPlaceWall(botPathLen, playerPathLen, view)) {
    const best = findBestWallPlacement(view, state, role);
    if (best) {
      return { kind: "wall", wall: best.wall };
    }
  }

  if (view.botAbilities.wallBreakAvailable) {
    const breakId = evaluateWallBreak(view, state, role);
    if (breakId) {
      return { kind: "wall_break", wallId: breakId };
    }
  }

  if (view.botAbilities.ghostStepAvailable) {
    const ghost = evaluateGhostStep(view, state, role);
    if (ghost) {
      return { kind: "ghost_step", to: ghost.target };
    }
  }

  const to = pickMoveAlongPath(state, role, view);
  if (to) {
    return { kind: "move", to };
  }

  const fallback = getAnyValidMove(state, role);
  return fallback ? { kind: "move", to: fallback } : null;
}

export function getBlockadeBotAction(
  state: BlockadeGameState,
  role: BlockadeRole,
  _difficulty: BotDifficulty
): BotAction | null {
  if (state.phase !== "in_progress" || state.currentTurn !== role) return null;
  return botTakeTurn(state, role);
}

export function applyBotAction(
  state: BlockadeGameState,
  role: BlockadeRole,
  action: BotAction
): { state: BlockadeGameState; log: string } | null {
  if (action.kind === "move") {
    const res = applyMove(state, role, action.to);
    if (res) lastBotPositions[role] = state.players[role].position;
    return res;
  }
  if (action.kind === "ghost_step") {
    const res = applyGhostStep(state, role, action.to);
    if (res) lastBotPositions[role] = state.players[role].position;
    return res;
  }
  if (action.kind === "wall_break") {
    return applyWallBreak(state, role, action.wallId);
  }
  if (action.kind === "start_double_move") {
    const next = startAbility(state, role, "double_move");
    if (!next) return null;
    const name = role === "player1" ? "Player1" : "Player2";
    return { state: next, log: `${name} used Double Move!` };
  }
  return applyWall(state, role, action.wall);
}
