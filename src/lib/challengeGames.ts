export type ChallengeGame =
  | "connect4"
  | "chess"
  | "reaction_duel"
  | "spelling_bee"
  | "memory_match"
  | "checkers"
  | "any";

export type ChallengeType =
  | "play_matches"
  | "win_matches"
  | "win_streak"
  | "play_minutes"
  | "earn_sp";

const APP_GAME_TO_CHALLENGE: Record<string, ChallengeGame> = {
  "connect-4": "connect4",
  chess: "chess",
  "reaction-duel": "reaction_duel",
  "spelling-bee": "spelling_bee",
  "memory-match": "memory_match",
  checkers: "checkers",
};

export const CHALLENGE_GAME_TO_SLUG: Record<ChallengeGame, string | null> = {
  connect4: "connect-4",
  chess: "chess",
  reaction_duel: "reaction-duel",
  spelling_bee: "spelling-bee",
  memory_match: "memory-match",
  checkers: "checkers",
  any: null,
};

export const CHALLENGE_GAME_LABELS: Record<ChallengeGame, string> = {
  connect4: "Connect 4",
  chess: "Chess",
  reaction_duel: "Reaction Duel",
  spelling_bee: "Spelling Bee",
  memory_match: "Memory Match",
  checkers: "Checkers",
  any: "Any Game",
};

export function toChallengeGameId(gameType: string): ChallengeGame | null {
  return APP_GAME_TO_CHALLENGE[gameType] ?? null;
}

export function challengeGameMatches(challengeGame: ChallengeGame, gameId: ChallengeGame): boolean {
  return challengeGame === "any" || challengeGame === gameId;
}
