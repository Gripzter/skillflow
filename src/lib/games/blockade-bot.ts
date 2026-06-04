import type { BotDifficulty } from "./bot-engine";
import {
  activeWalls,
  applyMove,
  applyWall,
  getLegalMoves,
  goalRowFor,
  opponent,
  validateWallPlacement,
  type BlockadeAbilityId,
  type BlockadeGameState,
  type BlockadeRole,
  type BlockadeWall,
  type WallOrientation,
  type WallType,
} from "./blockade-logic";
import { shortestPathToGoal, BOARD_SIZE } from "./blockade-bfs";

export function getBlockadeBotDelayMs(difficulty: BotDifficulty): number {
  if (difficulty === "rookie") return 2000 + Math.random() * 1000;
  if (difficulty === "professional") return 800 + Math.random() * 700;
  return 1200 + Math.random() * 900;
}

const ALL_ABILITIES: BlockadeAbilityId[] = ["double_move", "wall_break", "ghost_step", "wall_bomb"];

export function pickBotAbilities(difficulty: BotDifficulty): BlockadeAbilityId[] {
  if (difficulty === "rookie") {
    const shuffled = [...ALL_ABILITIES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 2);
  }
  return ["wall_break", "double_move"];
}

type BotAction =
  | { kind: "move"; to: { x: number; y: number } }
  | { kind: "wall"; wall: Omit<BlockadeWall, "id" | "owner" | "placedTurn"> };

export function getBlockadeBotAction(
  state: BlockadeGameState,
  role: BlockadeRole,
  difficulty: BotDifficulty
): BotAction | null {
  if (state.phase !== "in_progress" || state.currentTurn !== role) return null;

  if (difficulty === "rookie" && Math.random() < 0.35) {
    return randomAction(state, role);
  }

  const me = state.players[role].position;
  const opp = state.players[opponent(role)].position;
  const walls = activeWalls(state);
  const myGoal = goalRowFor(role);
  const oppGoal = goalRowFor(opponent(role));

  const moves = getLegalMoves(state, role);
  if (moves.length > 0) {
    let best = moves[0];
    let bestScore = -Infinity;
    for (const m of moves) {
      const myDist = Math.abs(m.y - myGoal);
      const oppDist = shortestPathToGoal(opp, oppGoal, walls, me);
      const score = -myDist * 2 + oppDist * (difficulty === "professional" ? 1.5 : 1);
      if (m.y === myGoal) return { kind: "move", to: m };
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    if (Math.random() < (difficulty === "rookie" ? 0.2 : 0.05)) {
      return { kind: "move", to: moves[Math.floor(Math.random() * moves.length)] };
    }
    return { kind: "move", to: best };
  }

  const wallAction = tryPlaceBlockingWall(state, role, difficulty);
  if (wallAction) return wallAction;

  return randomAction(state, role);
}

function randomAction(state: BlockadeGameState, role: BlockadeRole): BotAction | null {
  const moves = getLegalMoves(state, role);
  if (moves.length > 0) {
    return { kind: "move", to: moves[Math.floor(Math.random() * moves.length)] };
  }
  return tryPlaceBlockingWall(state, role, "rookie");
}

function tryPlaceBlockingWall(
  state: BlockadeGameState,
  role: BlockadeRole,
  difficulty: BotDifficulty
): BotAction | null {
  const supply = state.players[role].walls;
  const types: { type: WallType; orientation: WallOrientation }[] = [];
  if (supply.standard > 0) {
    types.push({ type: "standard", orientation: "h" }, { type: "standard", orientation: "v" });
  }

  const candidates: Omit<BlockadeWall, "id" | "owner" | "placedTurn">[] = [];
  for (const t of types) {
    for (let r = 0; r < BOARD_SIZE - 1; r++) {
      for (let c = 0; c < BOARD_SIZE - 1; c++) {
        candidates.push({ type: t.type, orientation: t.orientation, row: r, col: c });
      }
    }
  }

  const shuffled = candidates.sort(() => Math.random() - 0.5);
  const limit = difficulty === "professional" ? 40 : difficulty === "gamer" ? 20 : 8;

  for (let i = 0; i < Math.min(limit, shuffled.length); i++) {
    const w = shuffled[i];
    if (validateWallPlacement(state, role, w).valid) {
      return { kind: "wall", wall: w };
    }
  }
  return null;
}

export function applyBotAction(
  state: BlockadeGameState,
  role: BlockadeRole,
  action: BotAction
): BlockadeGameState | null {
  if (action.kind === "move") {
    const res = applyMove(state, role, action.to);
    return res?.state ?? null;
  }
  const res = applyWall(state, role, action.wall);
  return res?.state ?? null;
}
