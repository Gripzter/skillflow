/**
 * Reaction Duel: 15 rounds, random target positions, reaction time scoring.
 */

export const TOTAL_ROUNDS = 15;
const PADDING = 50;

export type RoundResult = {
  player1Ms: number | "false_start" | "timeout";
  player2Ms: number | "false_start" | "timeout";
  winner: "player1" | "player2" | "draw";
};

/** Random "Get Ready" duration in ms (1500–3500) */
export function getReadyDurationMs(): number {
  return 1500 + Math.floor(Math.random() * 2001);
}

/** Random target position within area, with padding from edges */
export function getRandomTargetPosition(
  areaWidth: number,
  areaHeight: number,
  targetDiameter: number
): { x: number; y: number } {
  const pad = Math.max(PADDING, targetDiameter / 2 + 10);
  const x = pad + Math.random() * (areaWidth - 2 * pad);
  const y = pad + Math.random() * (areaHeight - 2 * pad);
  return { x, y };
}

/** Target diameter: base ±10px variation */
export function getTargetDiameter(base: number): number {
  return base + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 11);
}

/** Target colors per round (teal, green, blue, orange, pink) */
export const TARGET_COLORS = [
  "#FF5E00", // primary accent
  "#22C55E", // green
  "#3B82F6", // blue
  "#F97316", // orange
  "#EC4899", // pink
] as const;

export function getTargetColor(roundIndex: number): string {
  return TARGET_COLORS[roundIndex % TARGET_COLORS.length];
}

/** Compare round: lower ms wins; false_start/timeout loses. Draw if both same or both invalid. */
export function getRoundWinner(
  p1: number | "false_start" | "timeout",
  p2: number | "false_start" | "timeout"
): "player1" | "player2" | "draw" {
  const p1Fail = p1 === "false_start" || p1 === "timeout";
  const p2Fail = p2 === "false_start" || p2 === "timeout";
  if (p1Fail && p2Fail) return "draw";
  if (p1Fail) return "player2";
  if (p2Fail) return "player1";
  if (p1 < p2) return "player1";
  if (p2 < p1) return "player2";
  return "draw";
}

/** Effective ms for display (timeout = 5000, false_start = Infinity or show "FALSE START") */
export function effectiveMs(v: number | "false_start" | "timeout"): number {
  if (v === "false_start" || v === "timeout") return Infinity;
  return v;
}

/** Match winner: more rounds won; if tie, faster total reaction time */
export function getMatchWinner(
  p1RoundsWon: number,
  p2RoundsWon: number,
  p1TotalMs: number,
  p2TotalMs: number
): "player1" | "player2" | "draw" {
  if (p1RoundsWon > p2RoundsWon) return "player1";
  if (p2RoundsWon > p1RoundsWon) return "player2";
  if (p1TotalMs < p2TotalMs) return "player1";
  if (p2TotalMs < p1TotalMs) return "player2";
  return "draw";
}
