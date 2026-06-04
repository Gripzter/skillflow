import { BOARD_SIZE } from "./blockade-bfs";
import type { BlockadeWall } from "./blockade-logic";

export type WallBarRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type BoardMetrics = {
  cellSize: number;
  groove: number;
  pad: number;
};

function logicYToTop(logicY: number, m: BoardMetrics): number {
  const step = m.cellSize + m.groove;
  const visualRow = BOARD_SIZE - 1 - logicY;
  return m.pad + visualRow * step;
}

/** Horizontal groove center between logic row r and r+1 */
export function horizontalGrooveTop(row: number, m: BoardMetrics): number {
  const step = m.cellSize + m.groove;
  const visualRowBelow = BOARD_SIZE - 1 - row;
  return m.pad + visualRowBelow * step + m.cellSize + (m.groove - wallThickness(m)) / 2;
}

/** Vertical groove center between logic col c and c+1 */
export function verticalGrooveLeft(col: number, row: number, m: BoardMetrics): number {
  const step = m.cellSize + m.groove;
  const visualRow = BOARD_SIZE - 1 - row;
  return m.pad + col * step + m.cellSize + (m.groove - wallThickness(m)) / 2;
}

export function wallThickness(m: BoardMetrics): number {
  return m.cellSize >= 36 ? 7 : 5;
}

export function boardPixelSize(m: BoardMetrics): { width: number; height: number } {
  const step = m.cellSize + m.groove;
  const inner = BOARD_SIZE * m.cellSize + (BOARD_SIZE - 1) * m.groove;
  return { width: inner + m.pad * 2, height: inner + m.pad * 2 };
}

export function getWallBarRects(wall: BlockadeWall, m: BoardMetrics): WallBarRect[] {
  const thick = wallThickness(m);
  const step = m.cellSize + m.groove;
  const span2 = 2 * m.cellSize + m.groove;
  const span3 = 3 * m.cellSize + 2 * m.groove;
  const { row, col } = wall;

  if (wall.type === "standard" || wall.type === "triple") {
    const isTriple = wall.type === "triple";
    if (wall.orientation === "h") {
      return [
        {
          left: m.pad + col * step,
          top: horizontalGrooveTop(row, m),
          width: isTriple ? span3 : span2,
          height: thick,
        },
      ];
    }
    return [
      {
        left: verticalGrooveLeft(col, row, m),
        top: logicYToTop(row + (isTriple ? 2 : 1), m),
        width: thick,
        height: isTriple ? span3 : span2,
      },
    ];
  }

  if (wall.type === "lshape") {
    const rot = wall.rotation ?? 0;
    const bars: WallBarRect[] = [];
    const hTop = horizontalGrooveTop(row, m);
    const vLeft = verticalGrooveLeft(col, row, m);
    const cellTop = logicYToTop(row + 1, m);

    if (rot === 0) {
      bars.push({ left: m.pad + col * step, top: hTop, width: span2, height: thick });
      bars.push({ left: verticalGrooveLeft(col + 1, row, m), top: cellTop, width: thick, height: m.cellSize + m.groove });
    } else if (rot === 1) {
      bars.push({ left: m.pad + col * step, top: horizontalGrooveTop(row + 1, m), width: span2, height: thick });
      bars.push({ left: verticalGrooveLeft(col, row, m), top: cellTop, width: thick, height: m.cellSize + m.groove });
    } else if (rot === 2) {
      bars.push({ left: m.pad + col * step, top: horizontalGrooveTop(row + 1, m), width: span2, height: thick });
      bars.push({ left: verticalGrooveLeft(col + 1, row + 1, m), top: logicYToTop(row + 1, m), width: thick, height: m.cellSize + m.groove });
    } else {
      bars.push({ left: m.pad + col * step, top: hTop, width: span2, height: thick });
      bars.push({ left: verticalGrooveLeft(col, row + 1, m), top: logicYToTop(row + 1, m), width: thick, height: m.cellSize + m.groove });
    }
    return bars;
  }

  return [];
}

export type EdgeSlot = {
  orientation: "h" | "v";
  row: number;
  col: number;
  key: string;
};

export function listPlaceableEdgeSlots(wallType: "standard" | "lshape" | "triple"): EdgeSlot[] {
  const slots: EdgeSlot[] = [];
  const hColMax = wallType === "triple" ? BOARD_SIZE - 3 : BOARD_SIZE - 2;
  const vRowMax = wallType === "triple" ? BOARD_SIZE - 3 : BOARD_SIZE - 2;
  for (let row = 0; row < BOARD_SIZE - 1; row++) {
    for (let col = 0; col <= hColMax; col++) {
      slots.push({ orientation: "h", row, col, key: `h:${row}:${col}` });
    }
  }
  for (let row = 0; row <= vRowMax; row++) {
    for (let col = 0; col < BOARD_SIZE - 1; col++) {
      slots.push({ orientation: "v", row, col, key: `v:${row}:${col}` });
    }
  }
  return slots;
}

export function edgeSlotHitRect(slot: EdgeSlot, m: BoardMetrics): WallBarRect {
  const thick = Math.max(m.groove, 12);
  if (slot.orientation === "h") {
    const step = m.cellSize + m.groove;
    const span2 = 2 * m.cellSize + m.groove;
    return {
      left: m.pad + slot.col * step - 2,
      top: horizontalGrooveTop(slot.row, m) - 2,
      width: span2 + 4,
      height: thick + 4,
    };
  }
  const step = m.cellSize + m.groove;
  const span2 = 2 * m.cellSize + m.groove;
  const top = logicYToTop(slot.row + 1, m);
  return {
    left: verticalGrooveLeft(slot.col, slot.row, m) - 2,
    top: top - 2,
    width: thick + 4,
    height: span2 + 4,
  };
}

export function wallFromEdgeSlot(
  slot: EdgeSlot,
  wallType: "standard" | "lshape" | "triple",
  rotation: number
): Omit<BlockadeWall, "id" | "owner" | "placedTurn"> {
  return {
    type: wallType,
    orientation: slot.orientation,
    row: slot.row,
    col: slot.col,
    rotation: wallType === "lshape" ? rotation : undefined,
  };
}
