/**
 * Dedicated rendering for 8-ball pool: table, balls, aim line, cue stick, power bar.
 * All drawing uses world (play-area) coordinates and a worldToCanvas transform.
 */

import type { Pocket } from "./pool-physics";
import { BALL_COLORS, TABLE_FRAME, CUSHION_GREEN, FELT_GREEN, POCKET_DARK, POCKET_LIP, RAIL_WIDTH, CUSHION_INSET, FRAME_WIDTH } from "./pool-physics";

export type WorldToCanvas = (wx: number, wy: number) => { x: number; y: number };

let tableImage: HTMLImageElement | null = null;
let tableImageLoaded = false;

function getTableImage(): HTMLImageElement | null {
  if (tableImageLoaded && tableImage) return tableImage;
  if (!tableImage) {
    const img = new Image();
    img.onload = () => {
      tableImageLoaded = true;
    };
    img.src = "/images/pool-table.jpg";
    tableImage = img;
  }
  return tableImageLoaded ? tableImage : null;
}

export function isTableImageReady(): boolean {
  return tableImageLoaded;
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

  const img = getTableImage();
  if (img) {
    ctx.save();
    ctx.translate(tableWidth / 2, tableHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(img, -tableHeight / 2, -tableWidth / 2, tableHeight, tableWidth);
    ctx.restore();
    return;
  }

  const inset = FRAME_WIDTH + CUSHION_INSET;
  const railLeft = FRAME_WIDTH;
  const railTop = FRAME_WIDTH;
  const railW = tableWidth - 2 * FRAME_WIDTH;
  const railH = tableHeight - 2 * FRAME_WIDTH;
  const feltLeft = inset;
  const feltTop = inset;
  const feltW = tableWidth - 2 * inset;
  const feltH = tableHeight - 2 * inset;

  ctx.save();

  const r = 12;
  ctx.fillStyle = TABLE_FRAME;
  ctx.beginPath();
  ctx.roundRect(0, 0, tableWidth, tableHeight, r);
  ctx.fill();
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.03})`;
    ctx.fillRect((i * tableWidth) / 8, 0, tableWidth / 8 + 2, tableHeight);
  }

  ctx.fillStyle = CUSHION_GREEN;
  ctx.fillRect(railLeft, railTop, railW, railH);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(railLeft, railTop, railW, 2);
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(railLeft, railTop + railH - 2, railW, 2);

  ctx.fillStyle = FELT_GREEN;
  ctx.fillRect(feltLeft, feltTop, feltW, feltH);
  const pattern = getFeltPattern(ctx, feltW, feltH, scale);
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(feltLeft, feltTop, feltW, feltH);
  }

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
    const lip = Math.max(2, r * 0.15);
    ctx.save();
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "#0a0a0a");
    grad.addColorStop(0.7, POCKET_DARK);
    grad.addColorStop(1, "#222");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = POCKET_LIP;
    ctx.lineWidth = lip;
    ctx.stroke();
    if (callPocketMode || highlightPocketId === i) {
      ctx.strokeStyle = "rgba(0,229,199,0.6)";
      ctx.lineWidth = 4;
      ctx.shadowColor = "#00E5C7";
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
  scale: number
) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  const positions: { x: number; y: number }[] = [];
  for (let i = 1; i <= 3; i++) {
    positions.push({ x: (playWidth * i) / 4, y: -CUSHION_INSET - 4 });
    positions.push({ x: (playWidth * i) / 4, y: playHeight + CUSHION_INSET + 4 });
  }
  for (let i = 1; i <= 2; i++) {
    positions.push({ x: -CUSHION_INSET - 4, y: (playHeight * i) / 3 });
    positions.push({ x: playWidth + CUSHION_INSET + 4, y: (playHeight * i) / 3 });
  }
  positions.forEach((pos) => {
    const { x, y } = worldToCanvas(pos.x, pos.y);
    ctx.beginPath();
    ctx.moveTo(x, y - 3);
    ctx.lineTo(x + 3, y);
    ctx.lineTo(x, y + 3);
    ctx.lineTo(x - 3, y);
    ctx.closePath();
    ctx.fill();
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
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 3, r * 0.9, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  let baseFill = style.fill;
  if (style.stripe) {
    baseFill = "#FFFFFF";
  }
  const highlightX = x - r * 0.35;
  const highlightY = y - r * 0.35;
  const grad = ctx.createRadialGradient(highlightX, highlightY, 0, x, y, r * 1.2);
  grad.addColorStop(0, lighten(baseFill, 0.4));
  grad.addColorStop(0.4, baseFill);
  grad.addColorStop(1, darken(baseFill, 0.25));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
  ctx.fill();

  if (style.stripe) {
    ctx.fillStyle = style.fill;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.95, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    const bandGrad = ctx.createRadialGradient(highlightX, highlightY, 0, x, y, r);
    bandGrad.addColorStop(0, lighten(style.fill, 0.3));
    bandGrad.addColorStop(0.5, style.fill);
    bandGrad.addColorStop(1, darken(style.fill, 0.2));
    ctx.fillStyle = bandGrad;
    ctx.fill();
  }

  const shineGrad = ctx.createRadialGradient(
    x - r * 0.4,
    y - r * 0.4,
    0,
    x - r * 0.4,
    y - r * 0.4,
    r * 0.8
  );
  shineGrad.addColorStop(0, "rgba(255,255,255,0.55)");
  shineGrad.addColorStop(0.5, "rgba(255,255,255,0.15)");
  shineGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shineGrad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  if (ballNum > 0) {
    const numR = r * 0.45;
    if (ballNum !== 8) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(x, y, numR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = ballNum === 8 ? "#FFFFFF" : "#1a1a1a";
    ctx.font = `bold ${Math.max(10, r * 0.9)}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(ballNum), x, y);
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
  grad.addColorStop(0, "#4A90D9");
  grad.addColorStop(0.08, "#C4935A");
  grad.addColorStop(1, "#3D2317");
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
