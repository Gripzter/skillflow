export interface MatchUiState {
  scores: { player1: number; player2: number };
  scoreLabel?: string;
  playerTimeLeftSec?: { player1: number; player2: number };
  currentTurn: "player1" | "player2";
  /** True only while the currentTurn player is expected to take an in-game action now. */
  requiresAction?: boolean;
  turnText: string;
  turnTimerDisplay?: string;
  systemLogEntries: Array<{ id: string; text: string; timestamp: number }>;
}
