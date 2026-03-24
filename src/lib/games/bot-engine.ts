/**
 * Simple bot engine for testing games. Not meant to be strong — just functional.
 * Used when isPlayer2Bot is true (e.g. in match page with simulated opponent).
 */

import type { Chess } from "chess.js";

export type BotDifficulty = "rookie" | "gamer" | "professional";
const DEFAULT_DIFFICULTY: BotDifficulty = "gamer";
import type { Board } from "./connect4-logic";
import type { SpellingDifficulty } from "./spelling-words";
import { COLS, ROWS, getValidColumns, dropDisc, checkWin, isBoardFull } from "./connect4-logic";

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
 * Score a move for ordering (higher = better). Used to get "top N" moves.
 */
function scoreChessMove(m: VerboseMove): number {
  let s = 0;
  if (m.san.endsWith("#")) s += 10000;
  if (m.capture === "q") s += 900;
  if (m.capture) s += (PIECE_VALUE[m.capture] ?? 0) * 100;
  if (m.san.endsWith("+")) s += 50;
  if (CENTER_SQUARES.has(m.to)) s += 20;
  if (isDevelopMove(m)) s += 15;
  return s;
}

/**
 * Get a move for the chess bot (Player 2 / Black).
 * difficulty: rookie = top 5 + 30% blunder; gamer = top 3 + 10% mistake; professional = best (or top 2).
 */
export function getChessBotMove(
  game: Chess,
  difficulty: BotDifficulty = DEFAULT_DIFFICULTY
): ChessBotMove | null {
  const moves = game.moves({ verbose: true }) as VerboseMove[];
  if (moves.length === 0) return null;

  const withPromo = (m: VerboseMove): ChessBotMove => ({
    from: m.from,
    to: m.to,
    promotion: (m.promotion as "q") || undefined,
  });

  const sorted = [...moves].sort((a, b) => scoreChessMove(b) - scoreChessMove(a));

  if (difficulty === "rookie") {
    // 50% pure blunder (random move), else pick from top 7
    if (Math.random() < 0.5) {
      const m = moves[Math.floor(Math.random() * moves.length)];
      return withPromo(m);
    }
    const topN = sorted.slice(0, Math.min(7, sorted.length));
    return withPromo(topN[Math.floor(Math.random() * topN.length)]);
  }

  if (difficulty === "gamer") {
    // 15% picks from top 5 (mistake), 85% picks from top 3
    if (Math.random() < 0.15) {
      const topN = sorted.slice(0, Math.min(5, sorted.length));
      return withPromo(topN[Math.floor(Math.random() * topN.length)]);
    }
    const topN = sorted.slice(0, Math.min(3, sorted.length));
    return withPromo(topN[Math.floor(Math.random() * topN.length)]);
  }

  // professional: almost always best, rarely top 2
  if (Math.random() < 0.05) {
    const topN = sorted.slice(0, Math.min(2, sorted.length));
    return withPromo(topN[Math.floor(Math.random() * topN.length)]);
  }
  return withPromo(sorted[0]);
}

/**
 * Random delay for bot "thinking" (ms). Rookie slower, professional faster.
 */
export function getChessBotDelayMs(difficulty: BotDifficulty = DEFAULT_DIFFICULTY): number {
  if (difficulty === "rookie") return 1000 + Math.floor(Math.random() * 1000);
  if (difficulty === "professional") return 400 + Math.floor(Math.random() * 400);
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

/** Score a window of 4 cells for `player` (higher = better for player) */
function scoreC4Window(w: number[], player: number): number {
  const opp = 3 - player;
  const p = w.filter((c) => c === player).length;
  const o = w.filter((c) => c === opp).length;
  const e = w.filter((c) => c === 0).length;
  if (p === 4) return 100;
  if (p === 3 && e === 1) return 5;
  if (p === 2 && e === 2) return 2;
  if (o === 3 && e === 1) return -4;
  return 0;
}

/** Heuristic board evaluation for Connect 4 (from `botPlayer` perspective) */
function evaluateC4(board: Board, botPlayer: number): number {
  let score = 0;

  // Center column bonus — controlling the center gives more winning paths
  for (let r = 0; r < ROWS; r++) {
    if (board[r][CENTER_COL] === botPlayer) score += 3;
  }

  // Score all horizontal windows
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      score += scoreC4Window([board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]], botPlayer);
    }
  }

  // Score all vertical windows
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      score += scoreC4Window([board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]], botPlayer);
    }
  }

  // Score diagonal \
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      score += scoreC4Window([board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]], botPlayer);
    }
  }

  // Score diagonal /
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 3; c < COLS; c++) {
      score += scoreC4Window([board[r][c], board[r + 1][c - 1], board[r + 2][c - 2], board[r + 3][c - 3]], botPlayer);
    }
  }

  return score;
}

/** Sort columns center-outward for better alpha-beta pruning */
function c4OrderedCols(valid: number[]): number[] {
  return [...valid].sort((a, b) => Math.abs(a - CENTER_COL) - Math.abs(b - CENTER_COL));
}

/**
 * Minimax with alpha-beta pruning for Connect 4.
 * `maximizing` = it is botPlayer's turn to move.
 */
function minimaxC4(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  botPlayer: number
): number {
  const win = checkWin(board);
  if (win) return win.player === botPlayer ? 1000 + depth : -(1000 + depth);
  if (isBoardFull(board)) return 0;
  if (depth === 0) return evaluateC4(board, botPlayer);

  const humanPlayer = (3 - botPlayer) as 1 | 2;
  const mover = (maximizing ? botPlayer : humanPlayer) as 1 | 2;
  const valid = c4OrderedCols(getValidColumns(board));

  if (maximizing) {
    let value = -Infinity;
    for (const col of valid) {
      const res = dropDisc(board, col, mover);
      if (!res) continue;
      value = Math.max(value, minimaxC4(res.board, depth - 1, alpha, beta, false, botPlayer));
      alpha = Math.max(alpha, value);
      if (beta <= alpha) break;
    }
    return value;
  } else {
    let value = Infinity;
    for (const col of valid) {
      const res = dropDisc(board, col, mover);
      if (!res) continue;
      value = Math.min(value, minimaxC4(res.board, depth - 1, alpha, beta, true, botPlayer));
      beta = Math.min(beta, value);
      if (beta <= alpha) break;
    }
    return value;
  }
}

/**
 * Connect 4 bot (Player 2).
 * Rookie: mostly random with occasional blocking of obvious wins.
 * Gamer: minimax depth 4 — blocks wins, sets up traps, 15% random slip.
 * Professional: minimax depth 7 with alpha-beta pruning, near-optimal play.
 */
export function getConnect4BotMove(
  board: Board,
  difficulty: BotDifficulty = DEFAULT_DIFFICULTY
): number | null {
  const valid = getValidColumns(board);
  if (valid.length === 0) return null;

  // --- Rookie: win if you can, block ~50% of the time, otherwise random ---
  if (difficulty === "rookie") {
    for (const col of valid) {
      const res = dropDisc(board, col, BOT_PLAYER as 1 | 2);
      if (res && checkWin(res.board)?.player === BOT_PLAYER) return col;
    }
    if (Math.random() < 0.5) {
      for (const col of valid) {
        const res = dropDisc(board, col, HUMAN_PLAYER as 1 | 2);
        if (res && checkWin(res.board)?.player === HUMAN_PLAYER) return col;
      }
    }
    return valid[Math.floor(Math.random() * valid.length)];
  }

  // --- Gamer / Professional: minimax with alpha-beta ---
  const depth = difficulty === "professional" ? 7 : 4;

  let bestScore = -Infinity;
  let bestCol = c4OrderedCols(valid)[0];

  for (const col of c4OrderedCols(valid)) {
    const res = dropDisc(board, col, BOT_PLAYER as 1 | 2);
    if (!res) continue;
    const score = minimaxC4(res.board, depth - 1, -Infinity, Infinity, false, BOT_PLAYER);
    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }

  // Gamer: 15% chance to play a random valid column instead of the optimal one
  if (difficulty === "gamer" && Math.random() < 0.15) {
    return valid[Math.floor(Math.random() * valid.length)];
  }

  return bestCol;
}

export function getConnect4BotDelayMs(difficulty: BotDifficulty = DEFAULT_DIFFICULTY): number {
  if (difficulty === "rookie") return 800 + Math.floor(Math.random() * 800);
  if (difficulty === "professional") return 300 + Math.floor(Math.random() * 300);
  return 600 + Math.floor(Math.random() * 600);
}

// --- Reaction Duel bot ---

/**
 * Bot's simulated reaction time in ms.
 * Rookie: 400–700ms; Gamer: 250–400ms; Professional: 150–250ms.
 */
export function getReactionBotResponseMs(
  difficulty: BotDifficulty = DEFAULT_DIFFICULTY
): number {
  if (difficulty === "rookie") {
    return 400 + Math.floor(Math.random() * 301); // 400–700
  }
  if (difficulty === "professional") {
    return 150 + Math.floor(Math.random() * 101); // 150–250
  }
  return 250 + Math.floor(Math.random() * 151); // 250–400
}

// --- Memory Match bot ---

export type MemoryAccuracy = "easy" | "medium" | "hard";

export interface MemoryMatchCardSnapshot {
  index: number;
  icon: string;
  state: "hidden" | "revealed" | "matched";
}

export interface MemoryMatchBotState {
  /** icon -> indices the bot believes are that icon and still useful (not matched) */
  memory: Record<string, number[]>;
}

export interface MemoryMatchBotMove {
  firstIndex: number;
  secondIndex: number;
  knowsPair: boolean;
  updatedMemory: Record<string, number[]>;
}

export interface MemoryMatchBotContext {
  cards: MemoryMatchCardSnapshot[];
  memory: Record<string, number[]>;
  accuracy?: MemoryAccuracy;
  botDifficulty?: BotDifficulty;
}

function getAccuracyRate(acc: MemoryAccuracy): number {
  if (acc === "easy") return 0.4;
  if (acc === "hard") return 0.85;
  return 0.65;
}

function difficultyToAccuracy(d: BotDifficulty): MemoryAccuracy {
  if (d === "rookie") return "easy";
  if (d === "professional") return "hard";
  return "medium";
}

/**
 * Update the bot's memory based on currently visible (revealed) cards.
 * Some cards are remembered based on the configured accuracy.
 */
function updateMemoryFromVisible(
  ctx: MemoryMatchBotContext
): Record<string, number[]> {
  const resolvedAccuracy = ctx.botDifficulty
    ? difficultyToAccuracy(ctx.botDifficulty)
    : (ctx.accuracy ?? "medium");
  const accuracy = getAccuracyRate(resolvedAccuracy);
  const next: Record<string, number[]> = {};

  // Start from previous memory but drop indices that are no longer hidden/revealed
  for (const [icon, indices] of Object.entries(ctx.memory ?? {})) {
    const filtered = indices.filter((i) => {
      const card = ctx.cards[i];
      return card && card.state !== "matched";
    });
    if (filtered.length) {
      next[icon] = filtered;
    }
  }

  // Consider currently revealed cards for potential remembering
  for (const card of ctx.cards) {
    if (card.state === "hidden" || card.state === "matched") continue;
    if (Math.random() > accuracy) continue;
    const arr = next[card.icon] ?? [];
    if (!arr.includes(card.index)) {
      arr.push(card.index);
    }
    next[card.icon] = arr;
  }

  return next;
}

export function getMemoryMatchBotMove(ctx: MemoryMatchBotContext): MemoryMatchBotMove {
  const memory = updateMemoryFromVisible(ctx);

  const hiddenIndices = ctx.cards
    .filter((c) => c.state === "hidden")
    .map((c) => c.index);

  // 1. If we know a full pair, pick that.
  for (const [icon, indices] of Object.entries(memory)) {
    const usable = indices.filter((i) => hiddenIndices.includes(i));
    if (usable.length >= 2) {
      const [a, b] = usable.slice(0, 2);
      return {
        firstIndex: a,
        secondIndex: b,
        knowsPair: true,
        updatedMemory: memory,
      };
    }
  }

  // 2. If we know one card of a pair, flip an unknown first, then that known card.
  let knownSingle: number | null = null;
  for (const indices of Object.values(memory)) {
    const usable = indices.filter((i) => hiddenIndices.includes(i));
    if (usable.length === 1) {
      knownSingle = usable[0];
      break;
    }
  }

  if (knownSingle != null && hiddenIndices.length > 1) {
    const unknownHidden = hiddenIndices.filter((i) => i !== knownSingle);
    const firstIndex =
      unknownHidden[Math.floor(Math.random() * unknownHidden.length)];
    return {
      firstIndex,
      secondIndex: knownSingle,
      knowsPair: false,
      updatedMemory: memory,
    };
  }

  // 3. Otherwise, flip two random hidden cards.
  if (hiddenIndices.length >= 2) {
    const shuffled = [...hiddenIndices];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return {
      firstIndex: shuffled[0],
      secondIndex: shuffled[1],
      knowsPair: false,
      updatedMemory: memory,
    };
  }

  // Fallback: just pick any two cards (should be rare / endgame).
  const allIndices = ctx.cards.map((c) => c.index);
  const [a = 0, b = 0] = allIndices;
  return {
    firstIndex: a,
    secondIndex: b,
    knowsPair: false,
    updatedMemory: memory,
  };
}

/**
 * Timing helper for memory match bot.
 * Slightly faster when it "knows" a pair.
 */
export function getMemoryMatchBotDelayMs(
  knowsPair: boolean,
  isSecondCard: boolean
): number {
  if (knowsPair) {
    return isSecondCard
      ? 500 + Math.floor(Math.random() * 400)
      : 500 + Math.floor(Math.random() * 400);
  }
  return isSecondCard
    ? 600 + Math.floor(Math.random() * 600)
    : 800 + Math.floor(Math.random() * 700);
}

// --- Spelling Bee bot ---

export interface SpellingBeeBotInput {
  word: string;
  difficulty: SpellingDifficulty;
  commonMisspellings?: string[];
  /** Practice mode bot strength; overrides effective accuracy. */
  botDifficulty?: BotDifficulty;
}

/**
 * Spelling Bee bot: returns answer and simulated response time.
 * Word difficulty (easy/medium/hard/expert) scales base accuracy; botDifficulty then scales:
 * rookie 40–50%, gamer 65–75%, professional 85–95%. Professional: faster typing.
 */
export function getSpellingBeeBotAnswer(input: SpellingBeeBotInput): {
  answer: string;
  timeMs: number;
  timedOut?: boolean;
} {
  const { word, difficulty, commonMisspellings, botDifficulty = DEFAULT_DIFFICULTY } = input;
  const correct = word.trim().toLowerCase();

  const baseByWord: Record<SpellingDifficulty, number> = {
    easy: 0.9,
    medium: 0.7,
    hard: 0.5,
    expert: 0.3,
  };
  const baseChance = baseByWord[difficulty];
  const botScale: Record<BotDifficulty, number> = {
    rookie: 0.45,
    gamer: 0.7,
    professional: 0.9,
  };
  const chance = Math.min(0.95, baseChance * botScale[botDifficulty]);
  const spellCorrectly = Math.random() < chance;

  const timeRangeByDifficulty: Record<SpellingDifficulty, [number, number]> = {
    easy: [2000, 5000],
    medium: [3000, 7000],
    hard: [5000, 10000],
    expert: [7000, 14000],
  };
  let [minMs, maxMs] = timeRangeByDifficulty[difficulty];
  if (botDifficulty === "professional") {
    minMs = Math.floor(minMs * 0.5);
    maxMs = Math.floor(maxMs * 0.6);
  } else if (botDifficulty === "rookie") {
    minMs = Math.floor(minMs * 1.2);
    maxMs = Math.floor(maxMs * 1.3);
  }

  const timedOut = difficulty === "expert" && botDifficulty !== "professional" && Math.random() < 0.05;
  if (timedOut) {
    return {
      answer: "",
      timeMs: 15000 + Math.floor(Math.random() * 500),
      timedOut: true,
    };
  }

  if (spellCorrectly) {
    const timeMs = minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
    return { answer: correct, timeMs };
  }

  const wrongTimeMs = Math.min(12000, minMs + 2000 + Math.floor(Math.random() * (maxMs - minMs + 3000)));
  const wrongAnswer = getRealisticMisspelling(correct, commonMisspellings);
  return { answer: wrongAnswer, timeMs: wrongTimeMs };
}

function getRealisticMisspelling(correct: string, commonMisspellings?: string[]): string {
  if (commonMisspellings?.length) {
    return commonMisspellings[Math.floor(Math.random() * commonMisspellings.length)];
  }
  const arr = correct.split("");
  const pattern = Math.floor(Math.random() * 5);
  switch (pattern) {
    case 0: {
      const i = arr.findIndex((_, j) => j < arr.length - 1 && arr[j] === arr[j + 1]);
      if (i >= 0) {
        const out = [...arr];
        out.splice(i, 1);
        return out.join("");
      }
      const dup = Math.min(arr.length - 1, Math.floor(Math.random() * arr.length));
      const out = [...arr];
      out.splice(dup, 0, arr[dup]);
      return out.join("");
    }
    case 1: {
      const vowels = "aeiou";
      const i = arr.findIndex((c) => vowels.includes(c));
      if (i >= 0) {
        const out = [...arr];
        out[i] = vowels[(vowels.indexOf(out[i]) + 1) % 5];
        return out.join("");
      }
      break;
    }
    case 2: {
      const i = arr.findIndex((c) => "kgndbt".includes(c));
      if (i >= 0) {
        const out = [...arr];
        out.splice(i, 1);
        return out.join("");
      }
      break;
    }
    case 3: {
      if (arr.length >= 2) {
        const i = Math.min(arr.length - 2, Math.floor(Math.random() * (arr.length - 1)));
        const out = [...arr];
        [out[i], out[i + 1]] = [out[i + 1], out[i]];
        return out.join("");
      }
      break;
    }
    case 4: {
      const suf = ["ence", "ance", "able", "ible", "tion", "sion"];
      for (const s of suf) {
        if (correct.endsWith(s)) {
          const alt = s === "ence" ? "ance" : s === "ance" ? "ence" : s === "able" ? "ible" : s === "ible" ? "able" : s === "tion" ? "sion" : "tion";
          return correct.slice(0, -s.length) + alt;
        }
      }
      if (correct.endsWith("er")) return correct.slice(0, -2) + "re";
      if (correct.endsWith("re")) return correct.slice(0, -2) + "er";
      break;
    }
  }
  const drop = Math.floor(Math.random() * arr.length);
  const out = arr.filter((_, i) => i !== drop);
  return out.length ? out.join("") : correct;
}

