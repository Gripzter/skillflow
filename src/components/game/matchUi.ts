export interface MatchUiState {
  scores: { player1: number; player2: number };
  scoreLabel?: string;
  currentTurn: "player1" | "player2";
  turnText: string;
  turnTimerDisplay?: string;
  systemLogEntries: Array<{ id: string; text: string; timestamp: number }>;
}
