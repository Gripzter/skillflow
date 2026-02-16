/**
 * 8-ball pool rules: ball types, turn logic, fouls, ball-in-hand, win/lose.
 */

export type BallGroup = "solid" | "stripe" | "eight";

export function getBallGroup(ballNumber: number): BallGroup {
  if (ballNumber === 0) return "eight"; // cue - treat as neutral
  if (ballNumber === 8) return "eight";
  if (ballNumber >= 1 && ballNumber <= 7) return "solid";
  return "stripe";
}

export function isSolid(ballNumber: number): boolean {
  return ballNumber >= 1 && ballNumber <= 7;
}

export function isStripe(ballNumber: number): boolean {
  return ballNumber >= 9 && ballNumber <= 15;
}

export function isCueBall(ballNumber: number): boolean {
  return ballNumber === 0;
}

export function isEightBall(ballNumber: number): boolean {
  return ballNumber === 8;
}

export type PlayerId = "player1" | "player2";

export interface GameState {
  currentTurn: PlayerId;
  player1Group: BallGroup | null;
  player2Group: BallGroup | null;
  ballInHand: PlayerId | null;
  breaking: boolean;
  shootingForEight: boolean;
  calledPocketId: number | null;
}

export function createInitialState(): GameState {
  return {
    currentTurn: "player1",
    player1Group: null,
    player2Group: null,
    ballInHand: null,
    breaking: true,
    shootingForEight: false,
    calledPocketId: null,
  };
}

export function getOpponent(player: PlayerId): PlayerId {
  return player === "player1" ? "player2" : "player1";
}

export function getPlayerGroup(state: GameState, player: PlayerId): BallGroup | null {
  return player === "player1" ? state.player1Group : state.player2Group;
}

export function assignGroupAfterBreak(state: GameState, firstPottedGroup: BallGroup): GameState {
  const next: GameState = { ...state, breaking: false };
  next.player1Group = firstPottedGroup;
  next.player2Group = firstPottedGroup === "solid" ? "stripe" : "solid";
  return next;
}

export function isPlayerBall(state: GameState, player: PlayerId, ballNumber: number): boolean {
  const group = getPlayerGroup(state, player);
  if (!group || group === "eight") return false;
  return getBallGroup(ballNumber) === group;
}

export function isOpponentBall(state: GameState, player: PlayerId, ballNumber: number): boolean {
  const group = getPlayerGroup(state, player);
  if (!group || group === "eight") return false;
  return getBallGroup(ballNumber) === (group === "solid" ? "stripe" : "solid");
}

export function hasClearedGroup(pottedByPlayer: number[]): boolean {
  return pottedByPlayer.length >= 7;
}

export function allBallsStopped(velocities: { vx: number; vy: number }[]): boolean {
  const threshold = 0.15;
  return velocities.every((v) => Math.hypot(v.vx, v.vy) < threshold);
}
