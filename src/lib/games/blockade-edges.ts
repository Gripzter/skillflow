/**
 * Blockade wall collision — single source of truth: flat blocked-edge list.
 * Coordinates: y=0 is bottom row, y=8 is top. Walls use row/col on the board grid.
 */

import type { BlockadeWall } from "./blockade-logic";

export type BlockedEdge = { x1: number; y1: number; x2: number; y2: number };

/** Decompose a wall into every cell-edge it blocks (both directions checked at runtime). */
export function wallToBlockedEdges(wall: BlockadeWall): BlockedEdge[] {
  const edges: BlockedEdge[] = [];
  const add = (x1: number, y1: number, x2: number, y2: number) => {
    edges.push({ x1, y1, x2, y2 });
  };

  if (wall.type === "standard") {
    if (wall.orientation === "h") {
      const r = wall.row;
      const c = wall.col;
      add(c, r, c, r + 1);
      add(c + 1, r, c + 1, r + 1);
    } else {
      const r = wall.row;
      const c = wall.col;
      add(c, r, c + 1, r);
      add(c, r + 1, c + 1, r + 1);
    }
    return edges;
  }

  if (wall.type === "triple") {
    if (wall.orientation === "h") {
      const r = wall.row;
      const c = wall.col;
      for (let i = 0; i < 3; i++) add(c + i, r, c + i, r + 1);
    } else {
      const r = wall.row;
      const c = wall.col;
      for (let i = 0; i < 3; i++) add(c, r + i, c + 1, r + i);
    }
    return edges;
  }

  const r = wall.row;
  const c = wall.col;
  const rot = wall.rotation ?? 0;
  if (rot === 0) {
    add(c, r, c + 1, r);
    add(c + 1, r, c + 1, r + 1);
    add(c, r, c, r + 1);
  } else if (rot === 1) {
    add(c, r, c, r + 1);
    add(c, r + 1, c + 1, r + 1);
    add(c + 1, r, c + 1, r + 1);
  } else if (rot === 2) {
    add(c, r + 1, c + 1, r + 1);
    add(c, r, c + 1, r);
    add(c, r, c, r + 1);
  } else {
    add(c, r, c + 1, r);
    add(c, r, c, r + 1);
    add(c, r + 1, c + 1, r + 1);
  }
  return edges;
}

export function rebuildBlockedEdges(walls: BlockadeWall[]): BlockedEdge[] {
  const out: BlockedEdge[] = [];
  for (const wall of walls) {
    out.push(...wallToBlockedEdges(wall));
  }
  return out;
}

/** True if movement between adjacent cells is blocked by any wall edge. */
export function isMovementBlocked(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  blockedEdges: BlockedEdge[]
): boolean {
  for (const edge of blockedEdges) {
    if (
      (edge.x1 === fromX && edge.y1 === fromY && edge.x2 === toX && edge.y2 === toY) ||
      (edge.x1 === toX && edge.y1 === toY && edge.x2 === fromX && edge.y2 === fromY)
    ) {
      return true;
    }
  }
  return false;
}
