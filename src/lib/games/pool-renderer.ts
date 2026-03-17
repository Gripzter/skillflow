/**
 * Dedicated rendering for 8-ball pool: table, balls, aim line, cue stick, power bar.
 * All drawing uses world (play-area) coordinates and a worldToCanvas transform.
 */

import type { Pocket } from "./pool-physics";
import {
  BALL_COLORS,
  WPA,
  getInset,
  getBallRadius,
  getPocketRadiusCorner,
  getPocketRadiusSide,
} from "./pool-physics";

export type WorldToCanvas = (wx: number, wy: number) => { x: number; y: number };

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

let feltPattern: CanvasPattern | null = null;

function getFeltPattern(ctx: CanvasRenderingContext2D, width: number, height: number, scale: number): CanvasPattern | null {
  if (feltPattern) return feltPattern;
  const size = Math.max(100, Math.floor(40 * scale));
  const offscreen = document.createElement("canvas");
  offscreen.width = size;
  offscreen.height = size;
  const octx = offscreen.getContext("2d");
  if (!octx) return null;
  for (let i = 0; i < 200; i++) {
    octx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.02})`;
    octx.beginPath();
    octx.arc(Math.random() * size, Math.random() * size, 0.5, 0, Math.PI * 2);
    octx.fill();
  }
  feltPattern = octx.createPattern(offscreen, "repeat");
  return feltPattern;
}

export function drawTable(
  ctx: CanvasRenderingContext2D,
  tableWidth: number,
  tableHeight: number,
  playWidth: number,
  playHeight: number,
  _worldToCanvas: WorldToCanvas,
  scale: number
) {
  ctx.imageSmoothingEnabled = true;
  const sc = tableWidth / WPA.OUTER_LENGTH;
  const inset = getInset(tableWidth);
  const cushionDepthPx = sc * WPA.CUSHION_DEPTH;
  const feltLeft = inset;
  const feltTop = inset;
  const feltW = playWidth;
  const feltH = playHeight;
  const r = Math.max(2, tableWidth * 0.003);

  // Layer 1 — outer frame (dark mahogany)
  ctx.save();
  const frameGrad = ctx.createLinearGradient(0, 0, 0, tableHeight);
  frameGrad.addColorStop(0, "#4A2511");
  frameGrad.addColorStop(1, "#3A1A0A");
  ctx.fillStyle = frameGrad;
  roundRect(ctx, 0, 0, tableWidth, tableHeight, r);
  ctx.fill();
  ctx.restore();

  // Layer 2 — rail surface (medium wood)
  ctx.save();
  const railInset = sc * 0.5;
  const railGrad = ctx.createLinearGradient(0, 0, 0, tableHeight);
  railGrad.addColorStop(0, "#6B3A1F");
  railGrad.addColorStop(1, "#5C3010");
  ctx.fillStyle = railGrad;
  roundRect(ctx, railInset, railInset, tableWidth - railInset * 2, tableHeight - railInset * 2, Math.max(0, r - 1));
  ctx.fill();
  ctx.restore();

  // Layer 3 — cushion rubber (gaps at pockets)
  const br = getBallRadius(playWidth);
  const cornerR = getPocketRadiusCorner(br);
  const sideR = getPocketRadiusSide(br);
  const cushionCenterX = feltLeft + feltW / 2;
  const topY = feltTop;
  const bottomY = feltTop + feltH;
  const noseW = Math.max(3, cushionDepthPx);
  ctx.save();
  ctx.fillStyle = "#1B5E20";
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  function cushionSeg(x1: number, y1: number, x2: number, y2: number, dx: number, dy: number) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2 + dx, y2 + dy);
    ctx.lineTo(x1 + dx, y1 + dy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  cushionSeg(feltLeft + cornerR, topY, cushionCenterX - sideR - 2, topY, 0, noseW);
  cushionSeg(cushionCenterX + sideR + 2, topY, feltLeft + feltW - cornerR, topY, 0, noseW);
  cushionSeg(feltLeft + cornerR, bottomY, cushionCenterX - sideR - 2, bottomY, 0, -noseW);
  cushionSeg(cushionCenterX + sideR + 2, bottomY, feltLeft + feltW - cornerR, bottomY, 0, -noseW);
  cushionSeg(feltLeft, feltTop + cornerR, feltLeft, bottomY - cornerR, noseW, 0);
  cushionSeg(feltLeft + feltW, feltTop + cornerR, feltLeft + feltW, bottomY - cornerR, -noseW, 0);
  ctx.restore();

  // Layer 4 — playing surface (felt)
  ctx.save();
  const cx = feltLeft + feltW / 2;
  const cy = feltTop + feltH / 2;
  const feltGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(feltW, feltH) * 0.7);
  feltGrad.addColorStop(0, "#0C7A3E");
  feltGrad.addColorStop(1, "#0A6B35");
  ctx.fillStyle = feltGrad;
  ctx.fillRect(feltLeft, feltTop, feltW, feltH);
  const pattern = getFeltPattern(ctx, feltW, feltH, scale);
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(feltLeft, feltTop, feltW, feltH);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Layer 6 — diamond sights (WPA: 6 per long rail, 3 per short rail)
  const diamondR = Math.max(1.5, sc * 0.4);
  ctx.save();
  ctx.fillStyle = "rgba(255,248,220,0.7)";
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 0.5;
  for (let i = 1; i <= 6; i++) {
    const tx = feltLeft + (feltW * i) / 7;
    ctx.beginPath();
    ctx.arc(tx, feltTop - cushionDepthPx * 0.5, diamondR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tx, feltTop + feltH + cushionDepthPx * 0.5, diamondR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  for (let i = 1; i <= 3; i++) {
    const ty = feltTop + (feltH * i) / 4;
    ctx.beginPath();
    ctx.arc(feltLeft - cushionDepthPx * 0.5, ty, diamondR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(feltLeft + feltW + cushionDepthPx * 0.5, ty, diamondR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // Layer 7 — table markings
  ctx.save();
  const headX = feltLeft + feltW * (WPA.HEAD_STRING / WPA.PLAY_LENGTH);
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(headX, feltTop + 2);
  ctx.lineTo(headX, feltTop + feltH - 2);
  ctx.stroke();
  const footX = feltLeft + feltW * (WPA.FOOT_SPOT / WPA.PLAY_LENGTH);
  const footY = feltTop + feltH * 0.5;
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.beginPath();
  ctx.arc(footX, footY, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath();
  ctx.arc(cx, cy, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(headX, cy, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Layer 8 — rail shadow on felt
  ctx.save();
  const shadowW = Math.min(sc * 3, feltW * 0.08);
  const shadowGradT = ctx.createLinearGradient(feltLeft, feltTop, feltLeft, feltTop + shadowW);
  shadowGradT.addColorStop(0, "rgba(0,0,0,0.15)");
  shadowGradT.addColorStop(1, "transparent");
  ctx.fillStyle = shadowGradT;
  ctx.fillRect(feltLeft, feltTop, feltW, shadowW);
  const shadowGradB = ctx.createLinearGradient(feltLeft, feltTop + feltH - shadowW, feltLeft, feltTop + feltH);
  shadowGradB.addColorStop(0, "transparent");
  shadowGradB.addColorStop(1, "rgba(0,0,0,0.15)");
  ctx.fillStyle = shadowGradB;
  ctx.fillRect(feltLeft, feltTop + feltH - shadowW, feltW, shadowW);
  const shadowGradL = ctx.createLinearGradient(feltLeft, feltTop, feltLeft + shadowW, feltTop);
  shadowGradL.addColorStop(0, "rgba(0,0,0,0.15)");
  shadowGradL.addColorStop(1, "transparent");
  ctx.fillStyle = shadowGradL;
  ctx.fillRect(feltLeft, feltTop, shadowW, feltH);
  const shadowGradR = ctx.createLinearGradient(feltLeft + feltW - shadowW, feltTop, feltLeft + feltW, feltTop);
  shadowGradR.addColorStop(0, "transparent");
  shadowGradR.addColorStop(1, "rgba(0,0,0,0.15)");
  ctx.fillStyle = shadowGradR;
  ctx.fillRect(feltLeft + feltW - shadowW, feltTop, shadowW, feltH);
  ctx.restore();
}

export function drawPockets(
  ctx: CanvasRenderingContext2D,
  pockets: Pocket[],
  worldToCanvas: WorldToCanvas,
  scale: number,
  highlightPocketId: number | null,
  callPocketMode: boolean
) {
  pockets.forEach((p, i) => {
    const { x, y } = worldToCanvas(p.x, p.y);
    const r = p.radius * scale;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 4;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "#000000");
    grad.addColorStop(0.7, "#0A0A0A");
    grad.addColorStop(1, "#1A1A1A");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    const rimGrad = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    rimGrad.addColorStop(0, "#A08860");
    rimGrad.addColorStop(1, "#6B5A3E");
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (callPocketMode || highlightPocketId === i) {
      ctx.strokeStyle = "rgba(0,229,199,0.6)";
      ctx.lineWidth = 4;
      ctx.shadowColor = "#FF5E00";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  });
}

export function drawRailDiamonds(
  ctx: CanvasRenderingContext2D,
  playWidth: number,
  playHeight: number,
  worldToCanvas: WorldToCanvas,
  _scale: number
) {
  ctx.save();
  const size = 4;
  const positions: { x: number; y: number }[] = [];
  const railOff = 8;
  for (let i = 1; i <= 3; i++) {
    positions.push({ x: (playWidth * i) / 4, y: -railOff });
    positions.push({ x: (playWidth * i) / 4, y: playHeight + railOff });
  }
  for (let i = 1; i <= 2; i++) {
    positions.push({ x: -railOff, y: (playHeight * i) / 3 });
    positions.push({ x: playWidth + railOff, y: (playHeight * i) / 3 });
  }
  positions.forEach((pos) => {
    const { x, y } = worldToCanvas(pos.x, pos.y);
    ctx.fillStyle = "rgba(255,255,200,0.6)";
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

function lighten(c: string, p: number): string {
  const hex = c.replace("#", "");
  const r = Math.min(255, parseInt(hex.slice(0, 2), 16) + 255 * p);
  const g = Math.min(255, parseInt(hex.slice(2, 4), 16) + 255 * p);
  const b = Math.min(255, parseInt(hex.slice(4, 6), 16) + 255 * p);
  return `rgb(${r},${g},${b})`;
}
function darken(c: string, p: number): string {
  const hex = c.replace("#", "");
  const r = Math.max(0, parseInt(hex.slice(0, 2), 16) * (1 - p));
  const g = Math.max(0, parseInt(hex.slice(2, 4), 16) * (1 - p));
  const b = Math.max(0, parseInt(hex.slice(4, 6), 16) * (1 - p));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export function drawBall(
  ctx: CanvasRenderingContext2D,
  ballNum: number,
  worldX: number,
  worldY: number,
  radius: number,
  worldToCanvas: WorldToCanvas,
  scale: number,
  isPreview?: boolean
) {
  const { x, y } = worldToCanvas(worldX, worldY);
  const r = radius * scale;
  const style = BALL_COLORS[ballNum === 8 ? 8 : ballNum];

  ctx.save();

  if (!isPreview) {
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 2, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  let baseFill = style.fill;
  if (style.stripe) {
    baseFill = "#FFFFFF";
  }
  const highlightX = x - r * 0.3;
  const highlightY = y - r * 0.3;
  const grad = ctx.createRadialGradient(highlightX, highlightY, 0, x, y, r * 1.1);
  grad.addColorStop(0, lighten(baseFill, 0.35));
  grad.addColorStop(0.45, baseFill);
  grad.addColorStop(1, darken(baseFill, 0.2));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
  ctx.fill();

  if (style.stripe) {
    ctx.fillStyle = style.fill;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.95, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    const bandGrad = ctx.createRadialGradient(highlightX, highlightY, 0, x, y, r);
    bandGrad.addColorStop(0, lighten(style.fill, 0.25));
    bandGrad.addColorStop(0.5, style.fill);
    bandGrad.addColorStop(1, darken(style.fill, 0.15));
    ctx.fillStyle = bandGrad;
    ctx.fill();
  }

  const specGrad = ctx.createRadialGradient(
    highlightX,
    highlightY,
    r * 0.1,
    x,
    y,
    r
  );
  specGrad.addColorStop(0, "rgba(255,255,255,0.3)");
  specGrad.addColorStop(0.5, "rgba(255,255,255,0)");
  specGrad.addColorStop(1, "rgba(0,0,0,0.2)");
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.arc(highlightX, highlightY, r * 0.15, 0, Math.PI * 2);
  ctx.fill();

  if (ballNum > 0) {
    const numR = r * 0.4;
    if (ballNum !== 8) {
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(x, y, numR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = ballNum === 8 ? "#FFFFFF" : "#000000";
    ctx.font = `bold ${Math.max(10, r * 0.55)}px system-ui, Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(ballNum), x, y + 1);
  }

  if (isPreview) {
    ctx.strokeStyle = "rgba(0,229,199,0.7)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
  }

  ctx.restore();
}

export interface AimState {
  cueX: number;
  cueY: number;
  aimDirX: number;
  aimDirY: number;
  power: number;
  firstHit?: { x: number; y: number; isBall: boolean };
  targetLine?: { x: number; y: number; dx: number; dy: number };
  cushionBounce?: { startX: number; startY: number; endX: number; endY: number };
}

export function drawAimLine(
  ctx: CanvasRenderingContext2D,
  aim: AimState,
  worldToCanvas: WorldToCanvas,
  scale: number
) {
  const { cueX, cueY, aimDirX, aimDirY, power, firstHit, targetLine, cushionBounce } = aim;
  const len = Math.hypot(aimDirX, aimDirY) || 1;
  const ux = aimDirX / len;
  const uy = aimDirY / len;
  const lineLen = 800;
  const opacity = 0.4 + power * 0.35;
  ctx.save();

  const start = worldToCanvas(cueX, cueY);
  const end = firstHit
    ? worldToCanvas(firstHit.x, firstHit.y)
    : worldToCanvas(cueX + ux * lineLen, cueY + uy * lineLen);
  ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
  ctx.setLineDash([10 * scale, 6 * scale]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  if (firstHit?.isBall && targetLine) {
    const t1 = worldToCanvas(targetLine.x, targetLine.y);
    const t2 = worldToCanvas(
      targetLine.x + targetLine.dx * 60,
      targetLine.y + targetLine.dy * 60
    );
    ctx.strokeStyle = "rgba(255,193,7,0.35)";
    ctx.setLineDash([6 * scale, 4 * scale]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t1.x, t1.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.stroke();
  }

  if (cushionBounce) {
    const b1 = worldToCanvas(cushionBounce.startX, cushionBounce.startY);
    const b2 = worldToCanvas(cushionBounce.endX, cushionBounce.endY);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.setLineDash([8 * scale, 6 * scale]);
    ctx.beginPath();
    ctx.moveTo(b1.x, b1.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.restore();
}

export function drawGhostBall(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  radius: number,
  worldToCanvas: WorldToCanvas,
  scale: number
) {
  const { x, y } = worldToCanvas(gx, gy);
  const r = radius * scale;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawCueStick(
  ctx: CanvasRenderingContext2D,
  cueX: number,
  cueY: number,
  aimDirX: number,
  aimDirY: number,
  power: number,
  tableWidth: number,
  worldToCanvas: WorldToCanvas,
  scale: number
) {
  const len = Math.hypot(aimDirX, aimDirY) || 1;
  const ux = aimDirX / len;
  const uy = aimDirY / len;
  const cueLength = tableWidth * 0.4;
  const tipGap = 2;
  const pullBack = 15 + power * 80;
  const tipX = cueX + ux * tipGap;
  const tipY = cueY + uy * tipGap;
  const buttX = cueX + ux * (tipGap + cueLength + pullBack);
  const buttY = cueY + uy * (tipGap + cueLength + pullBack);
  const t = worldToCanvas(tipX, tipY);
  const b = worldToCanvas(buttX, buttY);
  ctx.save();
  const grad = ctx.createLinearGradient(t.x, t.y, b.x, b.y);
  grad.addColorStop(0, "#FFFFFF");
  grad.addColorStop(0.03, "#F5DEB3");
  grad.addColorStop(0.15, "#C4935A");
  grad.addColorStop(1, "#5C3310");
  ctx.strokeStyle = grad;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(3, 4 * scale);
  ctx.beginPath();
  ctx.moveTo(t.x, t.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.lineWidth = Math.max(8, 12 * scale);
  const b2 = worldToCanvas(
    cueX + ux * (tipGap + cueLength * 0.4 + pullBack),
    cueY + uy * (tipGap + cueLength * 0.4 + pullBack)
  );
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b2.x, b2.y);
  ctx.stroke();
  ctx.restore();
}

export function drawPowerBar(
  ctx: CanvasRenderingContext2D,
  power: number,
  x: number,
  y: number,
  width: number,
  height: number,
  vertical: boolean
) {
  ctx.save();
  ctx.fillStyle = "#1A1D27";
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 4);
  ctx.fill();
  const grad = vertical
    ? ctx.createLinearGradient(x, y + height, x, y)
    : ctx.createLinearGradient(x, y, x + width, y);
  grad.addColorStop(0, "#22C55E");
  grad.addColorStop(0.5, "#EAB308");
  grad.addColorStop(1, "#EF4444");
  ctx.fillStyle = grad;
  const fill = Math.max(0.05, Math.min(1, power));
  if (vertical) {
    const h = height * fill;
    ctx.fillRect(x, y + height - h, width, h);
  } else {
    ctx.fillRect(x, y, width * fill, height);
  }
  ctx.fillStyle = "#fff";
  ctx.font = "12px system-ui";
  ctx.textAlign = "center";
  const pct = Math.round(fill * 100);
  if (vertical) {
    ctx.fillText(`${pct}%`, x + width / 2, y - 8);
  } else {
    ctx.fillText(`${pct}%`, x + width / 2, y + height + 14);
  }
  ctx.restore();
}

export function drawCallPocketOverlay(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  scale: number
) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${Math.min(24, 20 * scale)}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Call your pocket for the 8-ball", canvasWidth / 2, 36);
  ctx.restore();
}

export function drawFoulBanner(
  ctx: CanvasRenderingContext2D,
  message: string,
  canvasWidth: number,
  canvasHeight: number,
  alpha: number
) {
  ctx.save();
  ctx.fillStyle = `rgba(239,68,68,${alpha * 0.9})`;
  ctx.fillRect(0, canvasHeight / 2 - 28, canvasWidth, 56);
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.font = "bold 22px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("FOUL", canvasWidth / 2, canvasHeight / 2 - 8);
  ctx.font = "14px system-ui";
  ctx.fillText(message, canvasWidth / 2, canvasHeight / 2 + 12);
  ctx.restore();
}

export function drawBallAssignment(
  ctx: CanvasRenderingContext2D,
  group: "solid" | "stripe",
  canvasWidth: number,
  canvasHeight: number,
  alpha: number
) {
  ctx.save();
  ctx.fillStyle = `rgba(0,229,199,${alpha * 0.2})`;
  ctx.fillRect(canvasWidth / 2 - 140, canvasHeight / 2 - 40, 280, 80);
  ctx.strokeStyle = `rgba(0,229,199,${alpha})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(canvasWidth / 2 - 140, canvasHeight / 2 - 40, 280, 80);
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.font = "bold 18px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(`You are ${group.toUpperCase()}S`, canvasWidth / 2, canvasHeight / 2 - 10);
  ctx.font = "13px system-ui";
  ctx.fillText(group === "solid" ? "Balls 1–7" : "Balls 9–15", canvasWidth / 2, canvasHeight / 2 + 14);
  ctx.restore();
}
