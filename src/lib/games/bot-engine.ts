/**
 * Simple bot engine for testing games. Not meant to be strong — just functional.
 * Used when isPlayer2Bot is true (e.g. in match page with simulated opponent).
 */

import type { Chess } from "chess.js";
import type { Board } from "./connect4-logic";
import {
  COLS,
  getValidColumns,
  dropDisc,
  checkWin,
} from "./connect4-logic";

const BOT_PLAYER = 2 as const;
const HUMAN_PLAYER = 1 as const;
const CENTER_COL = 3;

const CENTER_SQUARES = new Set(["e4", "d4", "e5", "d5", "c3", "c4", "f3", "f4"]);
const PIECE_VALUE: Record<string, number> = {
  q: 9,
  r: 5,
  b: 3,
  n: 3,
  p: 1,
  k: 0,
};

export interface ChessBotMove {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
}

type VerboseMove = {
  from: string;
  to: string;
  piece: string;
  capture?: string;
  promotion?: string;
  san: string;
  flags?: string;
};

function isDevelopMove(m: VerboseMove): boolean {
  const backRank = m.piece === "p" ? false : m.from[1] === "8" || m.from[1] === "1";
  return backRank && (m.piece === "n" || m.piece === "b");
}

/**
 * Get a move for the chess bot (Player 2 / Black). Uses priority:
 * checkmate > capture queen > capture (highest value) > check (40%) > center (30%) > develop (25%) > random.
 * Always returns { from, to, promotion? } with promotion 'q' when move is a promotion.
 */
export function getChessBotMove(game: Chess): ChessBotMove | null {
  const moves = game.moves({ verbose: true }) as VerboseMove[];
  if (moves.length === 0) return null;

  const withPromo = (m: VerboseMove): ChessBotMove => ({
    from: m.from,
    to: m.to,
    promotion: (m.promotion as "q") || undefined,
  });

  // a) Checkmate
  const checkmate = moves.find((m) => m.san.endsWith("#"));
  if (checkmate) return withPromo(checkmate);

  // b) Capture queen
  const captureQueen = moves.find((m) => m.capture === "q");
  if (captureQueen) return withPromo(captureQueen);

  // c) Any capture — highest value first
  const captures = moves.filter((m) => m.capture);
  if (captures.length > 0) {
    const best = captures.reduce((a, b) =>
      (PIECE_VALUE[b.capture!] ?? 0) > (PIECE_VALUE[a.capture!] ?? 0) ? b : a
    );
    return withPromo(best);
  }

  // d) Check — 40% chance
  const checks = moves.filter((m) => m.san.endsWith("+"));
  if (checks.length > 0 && Math.random() < 0.4) {
    return withPromo(checks[Math.floor(Math.random() * checks.length)]);
  }

  // e) Center control — 30% chance
  const centerMoves = moves.filter((m) => CENTER_SQUARES.has(m.to));
  if (centerMoves.length > 0 && Math.random() < 0.3) {
    return withPromo(centerMoves[Math.floor(Math.random() * centerMoves.length)]);
  }

  // f) Develop pieces — 25% chance
  const developMoves = moves.filter(isDevelopMove);
  if (developMoves.length > 0 && Math.random() < 0.25) {
    return withPromo(developMoves[Math.floor(Math.random() * developMoves.length)]);
  }

  // g) Random
  const m = moves[Math.floor(Math.random() * moves.length)];
  return withPromo(m);
}

/**
 * Random delay for bot "thinking" (ms).
 */
export function getChessBotDelayMs(): number {
  return 800 + Math.floor(Math.random() * 700);
}

// --- Pool bot ---

export interface PoolBotShot {
  targetX: number;
  targetY: number;
  power: number;
}

export interface PoolBotContext {
  cueX: number;
  cueY: number;
  /** Ball number -> { x, y } in play coordinates */
  balls: Map<number, { x: number; y: number }>;
  player2Group: "solid" | "stripe" | null;
  playWidth: number;
  playHeight: number;
}

/**
 * Pick a target ball for the bot: prefer own group, else any (excluding cue 0).
 */
function getPoolTargetBalls(ctx: PoolBotContext): number[] {
  const own: number[] = [];
  const other: number[] = [];
  ctx.balls.forEach((_, num) => {
    if (num === 0) return;
    if (ctx.player2Group === "solid" && num >= 1 && num <= 7) own.push(num);
    else if (ctx.player2Group === "stripe" && num >= 9 && num <= 15) own.push(num);
    else if (num === 8) other.push(num); // 8-ball last
    else other.push(num);
  });
  return own.length > 0 ? own : other;
}

/**
 * Get shot parameters for the pool bot: aim at a ball with random error and power.
 */
export function getPoolBotShot(ctx: PoolBotContext): PoolBotShot | null {
  const targets = getPoolTargetBalls(ctx);
  if (targets.length === 0) return null;
  const ballNum = targets[Math.floor(Math.random() * targets.length)];
  const ball = ctx.balls.get(ballNum);
  if (!ball) return null;

  const dx = ball.x - ctx.cueX;
  const dy = ball.y - ctx.cueY;
  const len = Math.hypot(dx, dy) || 1;
  // Add angular error ±5–15 degrees
  const degError = 5 + Math.random() * 10;
  const rad = (degError * Math.PI) / 180;
  const sign = Math.random() < 0.5 ? -1 : 1;
  const cos = Math.cos(sign * rad);
  const sin = Math.sin(sign * rad);
  const nx = (dx * cos - dy * sin) / len;
  const ny = (dx * sin + dy * cos) / len;
  const dist = Math.hypot(dx, dy);
  const maxDist = Math.min(ctx.playWidth, ctx.playHeight) * 0.5;
  const targetDist = dist + Math.min(maxDist - dist, 50 + Math.random() * 80);
  const targetX = ctx.cueX + nx * targetDist;
  const targetY = ctx.cueY + ny * targetDist;

  const power = 0.3 + Math.random() * 0.5; // 30%–80%
  return { targetX, targetY, power };
}

/**
 * Random delay for pool bot "thinking" (ms).
 */
export function getPoolBotDelayMs(): number {
  return 1000 + Math.floor(Math.random() * 1000);
}

// --- Connect 4 bot ---

/** Columns ordered by preference (center first) */
const COL_PRIORITY = [3, 2, 4, 1, 5, 0, 6];

/**
 * Connect 4 bot (Player 2). Strategy:
 * 1. Win if possible
 * 2. Block player win
 * 3. Double threat 70%
 * 4. Center column 40%
 * 5. Prefer center columns
 * 6. Random valid
 */
export function getConnect4BotMove(board: Board): number | null {
  const valid = getValidColumns(board);
  if (valid.length === 0) return null;

  for (const col of valid) {
    const result = dropDisc(board, col, BOT_PLAYER as 1 | 2);
    if (result && checkWin(result.board)?.player === BOT_PLAYER) return col;
  }
  for (const col of valid) {
    const result = dropDisc(board, col, HUMAN_PLAYER as 1 | 2);
    if (result && checkWin(result.board)?.player === HUMAN_PLAYER) return col;
  }

  const doubleThreatCols = valid.filter((col) => {
    const result = dropDisc(board, col, BOT_PLAYER as 1 | 2);
    if (!result) return false;
    let wins = 0;
    for (let c = 0; c < COLS; c++) {
      const r2 = dropDisc(result.board, c, BOT_PLAYER as 1 | 2);
      if (r2 && checkWin(r2.board)?.player === BOT_PLAYER) wins++;
    }
    return wins >= 2;
  });
  if (doubleThreatCols.length > 0 && Math.random() < 0.7) {
    return doubleThreatCols[Math.floor(Math.random() * doubleThreatCols.length)];
  }

  if (valid.includes(CENTER_COL) && Math.random() < 0.4) return CENTER_COL;

  const nearCenter = COL_PRIORITY.filter((c) => valid.includes(c));
  if (nearCenter.length > 0) return nearCenter[0];

  return valid[Math.floor(Math.random() * valid.length)];
}

export function getConnect4BotDelayMs(): number {
  return 600 + Math.floor(Math.random() * 600);
}

// --- Reaction Duel bot ---

/**
 * Bot's simulated reaction time in ms. Called when target appears; bot "taps" after this delay.
 * 250–550ms normally; ~10% lucky 200ms; ~10% slow 600–800ms. Bot never false starts.
 */
export function getReactionBotResponseMs(): number {
  const r = Math.random();
  if (r < 0.1) return 200; // lucky fast
  if (r < 0.2) return 600 + Math.floor(Math.random() * 201); // slow
  return 250 + Math.floor(Math.random() * 301); // 250–550
}
