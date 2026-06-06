import { BOARD_SIZE } from "./blockade-bfs";
import type { Wall } from "./blockade-collision";

export type BoardMetrics = {
  cellSize: number;
  groove: number;
  pad: number;
};

export type WallBarRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type EdgeSlot = {
  x: number;
  y: number;
  orientation: "horizontal" | "vertical";
  key: string;
};

export function boardPixelSize(m: BoardMetrics): { width: number; height: number } {
  const step = m.cellSize + m.groove;
  const inner = BOARD_SIZE * m.cellSize + (BOARD_SIZE - 1) * m.groove;
  return { width: inner + m.pad * 2, height: inner + m.pad * 2 };
}

export function wallThickness(m: BoardMetrics): number {
  return m.cellSize >= 36 ? 7 : 5;
}

function cellTop(y: number, m: BoardMetrics): number {
  const step = m.cellSize + m.groove;
  return m.pad + y * step;
}

function cellLeft(x: number, m: BoardMetrics): number {
  const step = m.cellSize + m.groove;
  return m.pad + x * step;
}

export function getWallBarRect(wall: Wall, m: BoardMetrics): WallBarRect {
  const thick = wallThickness(m);
  const step = m.cellSize + m.groove;
  const span2 = 2 * m.cellSize + m.groove;

  if (wall.orientation === "horizontal") {
    return {
      left: cellLeft(wall.x, m),
      top: cellTop(wall.y, m) - thick / 2,
      width: span2,
      height: thick,
    };
  }
  return {
    left: cellLeft(wall.x, m) - thick / 2,
    top: cellTop(wall.y, m),
    width: thick,
    height: span2,
  };
}

export function listPlaceableEdgeSlots(): EdgeSlot[] {
  const slots: EdgeSlot[] = [];
  for (let y = 1; y <= BOARD_SIZE - 1; y++) {
    for (let x = 0; x <= BOARD_SIZE - 2; x++) {
      slots.push({ x, y, orientation: "horizontal", key: `h:${x}:${y}` });
    }
  }
  for (let y = 0; y <= BOARD_SIZE - 2; y++) {
    for (let x = 1; x <= BOARD_SIZE - 1; x++) {
      slots.push({ x, y, orientation: "vertical", key: `v:${x}:${y}` });
    }
  }
  return slots;
}

export function edgeSlotHitRect(slot: EdgeSlot, m: BoardMetrics): WallBarRect {
  const thick = Math.max(m.groove, 14);
  const bar = getWallBarRect(
    { x: slot.x, y: slot.y, orientation: slot.orientation },
    m
  );
  return {
    left: bar.left - 2,
    top: bar.top - 2,
    width: bar.width + 4,
    height: bar.height + 4,
  };
}

export function wallFromSlot(slot: EdgeSlot): Wall {
  return { x: slot.x, y: slot.y, orientation: slot.orientation };
}
