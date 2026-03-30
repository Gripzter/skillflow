export const DEFAULT_MATCH_TIME_LIMIT_MS = 30 * 60 * 1000;

const MATCH_TIME_LIMIT_MS_BY_GAME: Record<string, number> = {
  chess: 30 * 60 * 1000,
  "connect-4": 20 * 60 * 1000,
  "reaction-duel": 10 * 60 * 1000,
  "memory-match": 20 * 60 * 1000,
  checkers: 20 * 60 * 1000,
  "spelling-bee": 15 * 60 * 1000,
  trivia: 15 * 60 * 1000,
  "typing-race": 10 * 60 * 1000,
  "8-ball-pool": 30 * 60 * 1000,
};

export function getMatchTimeLimitMs(gameType: string): number {
  return MATCH_TIME_LIMIT_MS_BY_GAME[gameType] ?? DEFAULT_MATCH_TIME_LIMIT_MS;
}

export const CHESS_INITIAL_CLOCK_MS = 10 * 60 * 1000;
