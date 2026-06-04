import type { BotDifficulty } from "./bot-engine";
import {
  activeWalls,
  applyGhostStep,
  applyMove,
  applyWall,
  applyWallBreak,
  getGhostStepTargets,
  getLegalMoves,
  goalRowFor,
  opponent,
  startAbility,
  validateWallPlacement,
  type BlockadeAbilityId,
  type BlockadeGameState,
  type BlockadeRole,
  type BlockadeWall,
  type Pos,
  type WallSupply,
  type WallType,
} from "./blockade-logic";
import {
  bfsShortestPath,
  BOARD_SIZE,
  posKey,
  shortestPathToGoal,
} from "./blockade-bfs";

export function getBlockadeBotDelayMs(difficulty: BotDifficulty): number {
  if (difficulty === "rookie") return 2000 + Math.random() * 1000;
  if (difficulty === "professional") return 800 + Math.random() * 700;
  return 1200 + Math.random() * 900;
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
  | { kind: "wall"; wall: Omit<BlockadeWall, "id" | "owner" | "placedTurn">; asBomb?: boolean }
  | { kind: "wall_break"; wallId: string }
  | { kind: "ghost_step"; to: Pos }
  | { kind: "start_double_move" };

function wallsRemainingTotal(supply: WallSupply): number {
  return supply.standard + supply.lshape + supply.triple;
}

export function botChooseMove(
  state: BlockadeGameState,
  role: BlockadeRole
): Pos | null {
  const me = state.players[role].position;
  const opp = state.players[opponent(role)].position;
  const walls = activeWalls(state);
  const goal = goalRowFor(role);
  const legal = getLegalMoves(state, role);
  if (legal.length === 0) return null;

  const path = bfsShortestPath(me, goal, walls, opp);
  if (path && path.length > 1) {
    let next = path[1];
    const last = lastBotPositions[role];
    if (last && next.x === last.x && next.y === last.y && legal.length > 1) {
      const alt = pickBestMoveAmong(legal.filter((p) => p.x !== last.x || p.y !== last.y), me, goal, walls, opp);
      if (alt) next = alt;
    }
    if (legal.some((p) => p.x === next.x && p.y === next.y)) return next;
  }

  return pickBestMoveAmong(legal, me, goal, walls, opp);
}

function pickBestMoveAmong(
  moves: Pos[],
  me: Pos,
  goal: number,
  walls: BlockadeWall[],
  opp: Pos
): Pos | null {
  if (moves.length === 0) return null;
  let best = moves[0];
  let bestLen = Infinity;
  for (const m of moves) {
    const len = shortestPathToGoal(m, goal, walls, opp);
    if (len < bestLen) {
      bestLen = len;
      best = m;
    }
  }
  return best;
}

function nearPositions(center: Pos, radius: number): Set<string> {
  const set = new Set<string>();
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const x = center.x + dx;
      const y = center.y + dy;
      if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
        set.add(posKey({ x, y }));
      }
    }
  }
  return set;
}

function getPathNeighborhood(state: BlockadeGameState, role: BlockadeRole): Set<string> {
  const oppRole = opponent(role);
  const oppPos = state.players[oppRole].position;
  const oppGoal = goalRowFor(oppRole);
  const walls = activeWalls(state);
  const mePos = state.players[role].position;
  const path = bfsShortestPath(oppPos, oppGoal, walls, mePos);
  const zone = nearPositions(oppPos, 3);
  if (path) {
    for (const p of path) zone.add(posKey(p));
  }
  return zone;
}

function wallTouchesZone(
  wall: Omit<BlockadeWall, "id" | "owner" | "placedTurn">,
  zone: Set<string>
): boolean {
  const r = wall.row;
  const c = wall.col;
  const cells: Pos[] = [{ x: c, y: r }, { x: c + 1, y: r }, { x: c, y: r + 1 }, { x: c + 1, y: r + 1 }];
  if (wall.type === "triple") {
    if (wall.orientation === "h") {
      for (let i = 0; i < 3; i++) cells.push({ x: c + i, y: r }, { x: c + i, y: r + 1 });
    } else {
      for (let i = 0; i < 3; i++) cells.push({ x: c, y: r + i }, { x: c + 1, y: r + i });
    }
  }
  return cells.some((p) => zone.has(posKey(p)));
}

function getWallCandidates(
  supply: WallSupply,
  zone: Set<string>,
  limit: number
): Omit<BlockadeWall, "id" | "owner" | "placedTurn">[] {
  const out: Omit<BlockadeWall, "id" | "owner" | "placedTurn">[] = [];

  const pushStandard = () => {
    for (let r = 0; r < BOARD_SIZE - 1; r++) {
      for (let c = 0; c < BOARD_SIZE - 1; c++) {
        for (const orientation of ["h", "v"] as const) {
          const w = { type: "standard" as const, orientation, row: r, col: c };
          if (wallTouchesZone(w, zone)) out.push(w);
        }
      }
    }
  };

  const pushTriple = () => {
    for (let r = 0; r < BOARD_SIZE - 1; r++) {
      for (let c = 0; c <= BOARD_SIZE - 3; c++) {
        const w = { type: "triple" as const, orientation: "h" as const, row: r, col: c };
        if (wallTouchesZone(w, zone)) out.push(w);
      }
    }
    for (let r = 0; r <= BOARD_SIZE - 3; r++) {
      for (let c = 0; c < BOARD_SIZE - 1; c++) {
        const w = { type: "triple" as const, orientation: "v" as const, row: r, col: c };
        if (wallTouchesZone(w, zone)) out.push(w);
      }
    }
  };

  const pushLshape = () => {
    for (let r = 0; r < BOARD_SIZE - 1; r++) {
      for (let c = 0; c < BOARD_SIZE - 1; c++) {
        for (let rotation = 0; rotation < 4; rotation++) {
          for (const orientation of ["h", "v"] as const) {
            const w = { type: "lshape" as const, orientation, row: r, col: c, rotation };
            if (wallTouchesZone(w, zone)) out.push(w);
          }
        }
      }
    }
  };

  if (supply.standard > 0) pushStandard();
  if (supply.triple > 0) pushTriple();
  if (supply.lshape > 0) pushLshape();

  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, limit);
}

function chooseBestWall(
  state: BlockadeGameState,
  role: BlockadeRole,
  difficulty: BotDifficulty
): BotAction | null {
  const supply = state.players[role].walls;
  if (wallsRemainingTotal(supply) <= 0) return null;

  const zone = getPathNeighborhood(state, role);
  const limit = difficulty === "professional" ? 120 : difficulty === "gamer" ? 80 : 40;
  const candidates = getWallCandidates(supply, zone, limit);

  const me = state.players[role].position;
  const opp = state.players[opponent(role)].position;
  const walls = activeWalls(state);
  const myGoal = goalRowFor(role);
  const oppGoal = goalRowFor(opponent(role));

  const oldPlayerPath = shortestPathToGoal(opp, oppGoal, walls, me);
  const oldBotPath = shortestPathToGoal(me, myGoal, walls, opp);

  let bestWall: Omit<BlockadeWall, "id" | "owner" | "placedTurn"> | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    if (!validateWallPlacement(state, role, candidate).valid) continue;
    const trial = [...walls, { ...candidate, id: "t", owner: role, placedTurn: 0 }];
    const newPlayerPath = shortestPathToGoal(opp, oppGoal, trial, me);
    const newBotPath = shortestPathToGoal(me, myGoal, trial, opp);
    const score = newPlayerPath - oldPlayerPath - (newBotPath - oldBotPath);
    if (score > bestScore) {
      bestScore = score;
      bestWall = candidate;
    }
  }

  if (bestWall && bestScore > 0) {
    return { kind: "wall", wall: bestWall };
  }
  return null;
}

function tryAbilityAction(
  state: BlockadeGameState,
  role: BlockadeRole,
  difficulty: BotDifficulty
): BotAction | null {
  const ab = state.players[role].abilities;
  const me = state.players[role].position;
  const opp = state.players[opponent(role)].position;
  const walls = activeWalls(state);
  const myGoal = goalRowFor(role);
  const myDist = shortestPathToGoal(me, myGoal, walls, opp);

  if (!ab.used.includes("double_move") && ab.chosen.includes("double_move") && state.doubleMoveRemaining === 0) {
    if (myDist <= 2 && myDist > 0) {
      const path = bfsShortestPath(me, myGoal, walls, opp);
      if (path && path.length <= 3) {
        return { kind: "start_double_move" };
      }
    }
  }

  if (!ab.used.includes("ghost_step") && ab.chosen.includes("ghost_step")) {
    const targets = getGhostStepTargets(state, role);
    if (targets.length > 0) {
      let best = targets[0];
      let bestLen = shortestPathToGoal(best, myGoal, walls, opp);
      const baseline = myDist;
      for (const t of targets) {
        const len = shortestPathToGoal(t, myGoal, walls, opp);
        if (len + 3 <= baseline && len < bestLen) {
          bestLen = len;
          best = t;
        }
      }
      if (baseline - bestLen >= 3 || (difficulty !== "rookie" && bestLen < baseline)) {
        return { kind: "ghost_step", to: best };
      }
    }
  }

  if (!ab.used.includes("wall_break") && ab.chosen.includes("wall_break")) {
    const oppRole = opponent(role);
    const oppWalls = state.walls.filter((w) => w.owner === oppRole);
    let bestId: string | null = null;
    let bestGain = 0;
    for (const w of oppWalls) {
      const without = walls.filter((x) => x.id !== w.id);
      const newLen = shortestPathToGoal(me, myGoal, without, opp);
      const gain = myDist - newLen;
      if (gain > bestGain) {
        bestGain = gain;
        bestId = w.id;
      }
    }
    if (bestId && bestGain >= 2) {
      return { kind: "wall_break", wallId: bestId };
    }
  }

  if (!ab.used.includes("wall_bomb") && ab.chosen.includes("wall_bomb") && state.players[role].walls.standard > 0) {
    const wall = chooseBestWall(state, role, difficulty);
    if (wall?.kind === "wall") {
      return { ...wall, asBomb: true };
    }
  }

  return null;
}

export function getBlockadeBotAction(
  state: BlockadeGameState,
  role: BlockadeRole,
  difficulty: BotDifficulty
): BotAction | null {
  if (state.phase !== "in_progress" || state.currentTurn !== role) return null;

  if (difficulty === "rookie" && Math.random() < 0.2) {
    const move = botChooseMove(state, role);
    if (move) return { kind: "move", to: move };
  }

  const ability = tryAbilityAction(state, role, difficulty);
  if (ability) return ability;

  const me = state.players[role].position;
  const opp = state.players[opponent(role)].position;
  const walls = activeWalls(state);
  const myGoal = goalRowFor(role);
  const oppGoal = goalRowFor(opponent(role));
  const botPath = shortestPathToGoal(me, myGoal, walls, opp);
  const playerPath = shortestPathToGoal(opp, oppGoal, walls, me);
  const supply = state.players[role].walls;
  const hasWalls = wallsRemainingTotal(supply) > 0;

  const mustMove = getLegalMoves(state, role).length > 0;
  const preferWall =
    hasWalls &&
    ((playerPath < botPath && Math.random() < 0.7) ||
      (botPath <= playerPath && Math.random() < 0.2));

  if (preferWall && state.doubleMoveRemaining === 0) {
    const wallAction = chooseBestWall(state, role, difficulty);
    if (wallAction) return wallAction;
  }

  if (mustMove) {
    const to = botChooseMove(state, role);
    if (to) return { kind: "move", to };
  }

  if (hasWalls && state.doubleMoveRemaining === 0) {
    const wallAction = chooseBestWall(state, role, difficulty);
    if (wallAction) return wallAction;
  }

  return null;
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
  return applyWall(state, role, action.wall, action.asBomb ?? false);
}
