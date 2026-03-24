import { opposite, type Board, type Player, type TurnMove, getLegalTurnMoves, applyStep, type Step } from "./checkers-logic";
import { type BotDifficulty } from "./bot-engine";

export function getCheckersBotDelayMs(difficulty: BotDifficulty = "gamer"): number {
  if (difficulty === "rookie") return 1000 + Math.floor(Math.random() * 1000); // 1-2s
  if (difficulty === "gamer") return 2000 + Math.floor(Math.random() * 1000); // 2-3s
  return 1500 + Math.floor(Math.random() * 1000); // 1.5-2.5s
}

function evaluateBoard(board: Board, botPlayer: Player): number {
  const bot = botPlayer;
  const opp = opposite(bot);

  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece === 0) continue;

      const owner: Player | null = piece === 1 || piece === 2 ? 1 : piece === -1 || piece === -2 ? 2 : null;
      if (!owner) continue;
      const sign = owner === bot ? 1 : -1;
      const king = Math.abs(piece) === 2;

      // Material.
      score += sign * (king ? 175 : 100);

      // Advancement toward king row.
      const advancement = owner === 1 ? (7 - r) : r; // closer to opponent king row => larger
      score += sign * advancement * (king ? 3 : 4);

      // Center control.
      const centerDist = Math.abs(r - 3.5) + Math.abs(c - 3.5);
      score += sign * Math.max(0, 10 - centerDist * 3) * (king ? 0.4 : 0.25);
    }
  }

  return score;
}

function getDepthForDifficulty(difficulty: BotDifficulty): number {
  if (difficulty === "rookie") return 1;
  if (difficulty === "gamer") return 3;
  return 6; // professional: deep search, near-optimal.
}

/**
 * Professional uses a minimax-like search with alpha/beta.
 * Note: we only simulate legal turn moves (multi-jumps are included in those moves).
 */
export function getCheckersBotTurnMove(board: Board, toPlay: Player, difficulty: BotDifficulty): TurnMove | null {
  const moves = getLegalTurnMoves(board, toPlay);
  if (moves.length === 0) return null;

  // Rookie: random move (but still fully legal with mandatory captures baked in).
  if (difficulty === "rookie") {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  // Gamer & Professional: minimax depth search.
  const depth = getDepthForDifficulty(difficulty);
  const bot = toPlay;
  const opp = opposite(bot);

  const scoredRoot = moves
    .map((m) => {
      const next = simulateTurn(board, m, toPlay);
      const value = minimax(next.board, opp, depth - 1, -Infinity, Infinity, bot);
      return { m, value };
    })
    .sort((a, b) => b.value - a.value);

  const best = scoredRoot[0];
  const second = scoredRoot[1];

  // Gamer: 25% chance to play a suboptimal move; Professional: 5% chance.
  const mistakeChance = difficulty === "gamer" ? 0.25 : 0.05;
  const mistake = Math.random() < mistakeChance && !!second;
  return mistake ? second.m : best.m;
}

function simulateTurn(board: Board, move: TurnMove, player: Player): {
  board: Board;
} {
  let b = board.map((row) => row.slice());
  for (const step of move.steps as Step[]) {
    const applied = applyStep(b, step, player);
    b = applied.board;
  }
  return { board: b };
}

function minimax(board: Board, toPlay: Player, depth: number, alpha: number, beta: number, botPlayer: Player): number {
  const moves = getLegalTurnMoves(board, toPlay);

  // Terminal.
  if (moves.length === 0) {
    return toPlay === botPlayer ? -1e9 : 1e9;
  }
  if (depth <= 0) return evaluateBoard(board, botPlayer);

  const maximizing = toPlay === botPlayer;
  if (maximizing) {
    let value = -Infinity;
    for (const m of moves) {
      const next = simulateTurn(board, m, toPlay);
      const nextValue = minimax(next.board, opposite(toPlay), depth - 1, alpha, beta, botPlayer);
      value = Math.max(value, nextValue);
      alpha = Math.max(alpha, value);
      if (beta <= alpha) break;
    }
    return value;
  }

  let value = Infinity;
  for (const m of moves) {
    const next = simulateTurn(board, m, toPlay);
    const nextValue = minimax(next.board, opposite(toPlay), depth - 1, alpha, beta, botPlayer);
    value = Math.min(value, nextValue);
    beta = Math.min(beta, value);
    if (beta <= alpha) break;
  }
  return value;
}

