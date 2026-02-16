/**
 * 8-ball pool table dimensions, ball definitions, pocket positions, and Matter.js physics config.
 * Table aspect ratio 2:1. Ball radius scales with table (playWidth / 56).
 */

export const TABLE_ASPECT = 2;
export const FRAME_WIDTH = 40;
export const CUSHION_INSET = 10;
/** Total rail (frame + cushion) from table edge to play area. */
export const RAIL_WIDTH = FRAME_WIDTH + CUSHION_INSET;

/** Base ball radius when play width is 700 (scales with playWidth/56). */
export const BALL_RADIUS_RATIO = 1 / 56;

export const TABLE_FRAME = "#2C1810";
export const CUSHION_GREEN = "#0B7A3E";
export const FELT_GREEN = "#0E8C45";
export const POCKET_DARK = "#111111";
export const POCKET_LIP = "#1a1a1a";

export const PHYSICS = {
  ballRestitution: 0.85,
  ballFriction: 0.02,
  ballFrictionAir: 0.012,
  frictionStatic: 0.05,
  ballDensity: 0.0025,
  cushionRestitution: 0.65,
  cushionFriction: 0.03,
  minVelocity: 0.05,
  gravity: { x: 0, y: 0 },
  slop: 0.01,
} as const;

export interface Pocket {
  x: number;
  y: number;
  radius: number;
  id: number;
}

export interface BallStyle {
  fill: string;
  stripe?: boolean;
  number: number;
}

export const CUE_BALL_NUMBER = 0;
export const BALL_COLORS: BallStyle[] = [
  { fill: "#FFFFFF", number: 0 },
  { fill: "#FDD835", number: 1 },
  { fill: "#1565C0", number: 2 },
  { fill: "#E53935", number: 3 },
  { fill: "#7B1FA2", number: 4 },
  { fill: "#FB8C00", number: 5 },
  { fill: "#2E7D32", number: 6 },
  { fill: "#8D1C1C", number: 7 },
  { fill: "#1A1A1A", number: 8 },
  { fill: "#FDD835", stripe: true, number: 9 },
  { fill: "#1565C0", stripe: true, number: 10 },
  { fill: "#E53935", stripe: true, number: 11 },
  { fill: "#7B1FA2", stripe: true, number: 12 },
  { fill: "#FB8C00", stripe: true, number: 13 },
  { fill: "#2E7D32", stripe: true, number: 14 },
  { fill: "#8D1C1C", stripe: true, number: 15 },
];

/** Ball radius from play area width (standard ratio). */
export function getBallRadius(playWidth: number): number {
  return Math.max(6, playWidth * BALL_RADIUS_RATIO);
}

/** Pocket radius: corner = ballRadius * 2.2, side = ballRadius * 2.0 */
export function getPocketRadiusCorner(ballRadius: number): number {
  return ballRadius * 2.2;
}
export function getPocketRadiusSide(ballRadius: number): number {
  return ballRadius * 2.0;
}

/**
 * Table size from container: width = container - 40 padding, height = width/2, min width 600.
 * Returns canvas width and height.
 */
export function getTableSize(containerWidth: number): { width: number; height: number } {
  const width = Math.max(600, (containerWidth || 800) - 40);
  return { width, height: width / 2 };
}

/** Playable area (felt) inside rails. */
export function getPlayableSize(tableWidth: number, tableHeight: number): { width: number; height: number } {
  return {
    width: tableWidth - 2 * RAIL_WIDTH - 2 * CUSHION_INSET,
    height: tableHeight - 2 * RAIL_WIDTH - 2 * CUSHION_INSET,
  };
}

/**
 * Pocket positions in playable-area coordinates.
 * Order: top-left, top-center, top-right, bottom-left, bottom-center, bottom-right.
 */
export function getPocketPositions(playWidth: number, playHeight: number, ballRadius: number): Pocket[] {
  const cornerR = getPocketRadiusCorner(ballRadius);
  const sideR = getPocketRadiusSide(ballRadius);
  const margin = cornerR + 4;
  return [
    { x: margin, y: margin, radius: cornerR, id: 0 },
    { x: playWidth / 2, y: margin, radius: sideR, id: 1 },
    { x: playWidth - margin, y: margin, radius: cornerR, id: 2 },
    { x: margin, y: playHeight - margin, radius: cornerR, id: 3 },
    { x: playWidth / 2, y: playHeight - margin, radius: sideR, id: 4 },
    { x: playWidth - margin, y: playHeight - margin, radius: cornerR, id: 5 },
  ];
}

/** Cue ball starting position: 1/4 from left (head string), vertically centered. */
export function getCueBallPosition(playWidth: number, playHeight: number): { x: number; y: number } {
  return { x: playWidth * 0.25, y: playHeight * 0.5 };
}

/** Head string X: cue ball must be placed left of this on break. */
export function getHeadStringX(playWidth: number): number {
  return playWidth * 0.25;
}

export const RACK_ORDER = [1, 9, 2, 3, 8, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15];

export function getRackPositionsOrdered(
  playWidth: number,
  playHeight: number,
  ballRadius: number
): { x: number; y: number; ballNumber: number }[] {
  const cx = playWidth * 0.75;
  const cy = playHeight * 0.5;
  const d = ballRadius * 2.02;
  const positions: { x: number; y: number; ballNumber: number }[] = [];
  let ballIdx = 0;
  for (let row = 0; row < 5; row++) {
    const count = row + 1;
    const startCol = -row / 2;
    for (let c = 0; c < count; c++) {
      const col = startCol + c;
      positions.push({
        x: cx + col * d * Math.sqrt(3) * 0.5,
        y: cy + row * d * 0.5 - d * 1.2,
        ballNumber: RACK_ORDER[ballIdx],
      });
      ballIdx++;
    }
  }
  return positions;
}

/** Ray-circle intersection. Returns t (0..1) along ray from (ox,oy) in dir (dx,dy), or null. */
export function rayCircleIntersect(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  r: number
): number | null {
  const ex = ox + dx;
  const ey = oy + dy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const toC = { x: cx - ox, y: cy - oy };
  const proj = toC.x * ux + toC.y * uy;
  if (proj < 0) return null;
  const perp = toC.x * uy - toC.y * ux;
  if (Math.abs(perp) > r) return null;
  const half = Math.sqrt(r * r - perp * perp);
  const t = (proj - half) / len;
  if (t >= 0 && t <= 1) return t;
  const t2 = (proj + half) / len;
  if (t2 >= 0 && t2 <= 1) return t2;
  return null;
}

/** Ray-rectangle (segment) intersection. Segment from (x1,y1) to (x2,y2), ray from (ox,oy) in (dx,dy). Returns t along ray or null. */
export function raySegmentIntersect(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number | null {
  const len = Math.hypot(dx, dy) || 1;
  const rx = dx / len;
  const ry = dy / len;
  const sx = x2 - x1;
  const sy = y2 - y1;
  const den = sx * ry - sy * rx;
  if (Math.abs(den) < 1e-6) return null;
  const t = ((x1 - ox) * sy - (y1 - oy) * sx) / den;
  const u = ((x1 - ox) * ry - (y1 - oy) * rx) / den;
  if (t >= 0 && u >= 0 && u <= 1) return t / len;
  return null;
}
