/**
 * 8-ball pool table dimensions per WPA (World Pool-Billiard Association) tournament specs.
 * All dimensions in inches; converted to pixels via scale = tableWidth / WPA_OUTER_LENGTH.
 */

/** WPA 9-foot table: outer 110" × 60", play surface 100" × 50" (2:1). */
export const WPA = {
  OUTER_LENGTH: 110,
  OUTER_WIDTH: 60,
  PLAY_LENGTH: 100,
  PLAY_WIDTH: 50,
  RAIL: 5,
  CUSHION_DEPTH: 2,
  BALL_DIAMETER: 2.25,
  BALL_RADIUS: 1.125,
  CORNER_POCKET_MOUTH: 4.5,
  SIDE_POCKET_MOUTH: 5,
  HEAD_STRING: 25,
  FOOT_SPOT: 75,
  CENTER: 50,
} as const;

export const TABLE_ASPECT = WPA.OUTER_LENGTH / WPA.OUTER_WIDTH;

/** @deprecated Use getInset(tableWidth) for WPA. */
export const FRAME_WIDTH = 40;
/** @deprecated Use getCushionInset(playLength) for WPA. */
export const CUSHION_INSET = 10;
/** @deprecated Use getInset(tableWidth) for WPA. */
export const RAIL_WIDTH = 50;

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
  { fill: "#F5C518", number: 1 },
  { fill: "#1E3A8A", number: 2 },
  { fill: "#DC2626", number: 3 },
  { fill: "#581C87", number: 4 },
  { fill: "#EA580C", number: 5 },
  { fill: "#15803D", number: 6 },
  { fill: "#7C2D12", number: 7 },
  { fill: "#000000", number: 8 },
  { fill: "#F5C518", stripe: true, number: 9 },
  { fill: "#1E3A8A", stripe: true, number: 10 },
  { fill: "#DC2626", stripe: true, number: 11 },
  { fill: "#581C87", stripe: true, number: 12 },
  { fill: "#EA580C", stripe: true, number: 13 },
  { fill: "#15803D", stripe: true, number: 14 },
  { fill: "#7C2D12", stripe: true, number: 15 },
];

/** Rail inset in pixels from table edge to play area (5" in WPA). */
export function getInset(tableWidth: number): number {
  return tableWidth * (WPA.RAIL / WPA.OUTER_LENGTH);
}

/** Cushion depth in pixels for physics walls (2" in WPA). */
export function getCushionInset(playLength: number): number {
  return playLength * (WPA.CUSHION_DEPTH / WPA.PLAY_LENGTH);
}

/** Ball radius in pixels (1.125" in WPA). playLength = 100-unit dimension in pixels. */
export function getBallRadius(playLength: number): number {
  return Math.max(4, playLength * (WPA.BALL_RADIUS / WPA.PLAY_LENGTH));
}

/** Corner pocket radius in pixels (4.5" / 2 in WPA). */
export function getPocketRadiusCorner(ballRadius: number): number {
  return ballRadius * (WPA.CORNER_POCKET_MOUTH / WPA.BALL_DIAMETER);
}

/** Side pocket radius in pixels (5" / 2 in WPA). */
export function getPocketRadiusSide(ballRadius: number): number {
  return ballRadius * (WPA.SIDE_POCKET_MOUTH / WPA.BALL_DIAMETER);
}

/**
 * Table size in pixels. Outer aspect 110:60 (WPA).
 */
export function getTableSize(containerWidth: number): { width: number; height: number } {
  const width = Math.max(320, containerWidth || 800);
  return { width, height: width * (WPA.OUTER_WIDTH / WPA.OUTER_LENGTH) };
}

/** Playable area in pixels (100×50 in WPA). */
export function getPlayableSize(tableWidth: number, tableHeight: number): { width: number; height: number } {
  return {
    width: tableWidth * (WPA.PLAY_LENGTH / WPA.OUTER_LENGTH),
    height: tableHeight * (WPA.PLAY_WIDTH / WPA.OUTER_WIDTH),
  };
}

/**
 * Pocket positions in playable-area coordinates (WPA).
 * Order: top-left, top-center, top-right, bottom-left, bottom-center, bottom-right.
 */
export function getPocketPositions(playLength: number, playWidth: number, ballRadius: number): Pocket[] {
  const cornerR = getPocketRadiusCorner(ballRadius);
  const sideR = getPocketRadiusSide(ballRadius);
  const marginCorner = cornerR;
  const marginSide = sideR;
  return [
    { x: marginCorner, y: marginSide, radius: cornerR, id: 0 },
    { x: playLength / 2, y: marginSide, radius: sideR, id: 1 },
    { x: playLength - marginCorner, y: marginSide, radius: cornerR, id: 2 },
    { x: marginCorner, y: playWidth - marginSide, radius: cornerR, id: 3 },
    { x: playLength / 2, y: playWidth - marginSide, radius: sideR, id: 4 },
    { x: playLength - marginCorner, y: playWidth - marginSide, radius: cornerR, id: 5 },
  ];
}

/** Cue ball starting position: behind head string (WPA 25" from head rail), vertically centered. */
export function getCueBallPosition(playLength: number, playWidth: number): { x: number; y: number } {
  return { x: playLength * (WPA.HEAD_STRING / WPA.PLAY_LENGTH), y: playWidth * 0.5 };
}

/** Head string X: cue ball must be placed left of this on break. */
export function getHeadStringX(playLength: number): number {
  return playLength * (WPA.HEAD_STRING / WPA.PLAY_LENGTH);
}

export const RACK_ORDER = [1, 9, 2, 3, 8, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15];

export function getRackPositionsOrdered(
  playLength: number,
  playWidth: number,
  ballRadius: number
): { x: number; y: number; ballNumber: number }[] {
  const cx = playLength * (WPA.FOOT_SPOT / WPA.PLAY_LENGTH);
  const cy = playWidth * 0.5;
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
