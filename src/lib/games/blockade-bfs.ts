/**
 * BFS pathfinding for Blockade (9×9 grid, walls on edges between cells).
 */

import type { BlockadeWall, Pos } from "./blockade-logic";

export const BOARD_SIZE = 9;

export function posKey(p: Pos): string {
  return `${p.x},${p.y}`;
}

function inBounds(p: Pos): boolean {
  return p.x >= 0 && p.x < BOARD_SIZE && p.y >= 0 && p.y < BOARD_SIZE;
}

/** True if movement between adjacent cells a→b is blocked by any wall (incl. bombs). */
export function isEdgeBlocked(a: Pos, b: Pos, walls: BlockadeWall[]): boolean {
  if (!inBounds(a) || !inBounds(b)) return true;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return true;

  for (const wall of walls) {
    if (wallBlocksEdge(wall, a, b)) return true;
  }
  return false;
}

function wallBlocksEdge(wall: BlockadeWall, a: Pos, b: Pos): boolean {
  const edges = getBlockedEdges(wall);
  for (const [e1, e2] of edges) {
    if (
      (e1.x === a.x && e1.y === a.y && e2.x === b.x && e2.y === b.y) ||
      (e2.x === a.x && e2.y === a.y && e1.x === b.x && e1.y === b.y)
    ) {
      return true;
    }
  }
  return false;
}

/** All undirected edges blocked by a wall (pairs of adjacent cell centers). */
export function getBlockedEdges(wall: BlockadeWall): [Pos, Pos][] {
  const out: [Pos, Pos][] = [];
  const add = (x1: number, y1: number, x2: number, y2: number) => {
    out.push([{ x: x1, y: y1 }, { x: x2, y: y2 }]);
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
    return out;
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
    return out;
  }

  // L-shape: 4 rotations (0=┐, 1=┘, 2=└, 3=┌ from top-left anchor at row,col)
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
  return out;
}

const CARDINAL: Pos[] = [
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
];

export function getReachableNeighbors(from: Pos, walls: BlockadeWall[], opponentPos: Pos | null): Pos[] {
  const neighbors: Pos[] = [];
  for (const d of CARDINAL) {
    const next = { x: from.x + d.x, y: from.y + d.y };
    if (!inBounds(next)) continue;
    if (isEdgeBlocked(from, next, walls)) continue;
    if (opponentPos && next.x === opponentPos.x && next.y === opponentPos.y) continue;
    neighbors.push(next);
  }
  return neighbors;
}

/** Quoridor-style jump when adjacent to opponent. */
export function getJumpDestinations(from: Pos, opponentPos: Pos, walls: BlockadeWall[]): Pos[] {
  if (Math.abs(from.x - opponentPos.x) + Math.abs(from.y - opponentPos.y) !== 1) return [];

  const behind = { x: opponentPos.x + (opponentPos.x - from.x), y: opponentPos.y + (opponentPos.y - from.y) };
  const results: Pos[] = [];

  if (inBounds(behind) && !isEdgeBlocked(opponentPos, behind, walls)) {
    results.push(behind);
    return results;
  }

  const perp: Pos[] = [];
  if (from.x === opponentPos.x) {
    perp.push({ x: opponentPos.x - 1, y: opponentPos.y }, { x: opponentPos.x + 1, y: opponentPos.y });
  } else {
    perp.push({ x: opponentPos.x, y: opponentPos.y - 1 }, { x: opponentPos.x, y: opponentPos.y + 1 });
  }
  for (const p of perp) {
    if (!inBounds(p)) continue;
    if (isEdgeBlocked(opponentPos, p, walls)) continue;
    results.push(p);
  }
  return results;
}

export function getAllMoveTargets(
  from: Pos,
  walls: BlockadeWall[],
  opponentPos: Pos | null
): Pos[] {
  const set = new Set<string>();
  const add = (p: Pos) => {
    if (inBounds(p)) set.add(posKey(p));
  };

  for (const n of getReachableNeighbors(from, walls, opponentPos)) add(n);

  if (opponentPos) {
    for (const j of getJumpDestinations(from, opponentPos, walls)) add(j);
  }

  return Array.from(set).map((k) => {
    const [x, y] = k.split(",").map(Number);
    return { x, y };
  });
}

/** BFS: can `start` reach any cell in `goalRow`? */
export function canReachGoalRow(
  start: Pos,
  goalRow: number,
  walls: BlockadeWall[],
  opponentPos: Pos | null
): boolean {
  const visited = new Set<string>();
  const queue: Pos[] = [start];
  visited.add(posKey(start));

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.y === goalRow) return true;

    const candidates = getAllMoveTargets(cur, walls, opponentPos);
    for (const next of candidates) {
      const key = posKey(next);
      if (visited.has(key)) continue;
      if (opponentPos && next.x === opponentPos.x && next.y === opponentPos.y) continue;
      visited.add(key);
      queue.push(next);
    }

    for (const n of getReachableNeighbors(cur, walls, null)) {
      const key = posKey(n);
      if (visited.has(key)) continue;
      if (opponentPos && n.x === opponentPos.x && n.y === opponentPos.y) continue;
      visited.add(key);
      queue.push(n);
    }
  }
  return false;
}

/** Shortest path length to goal row (for bot). */
export function shortestPathToGoal(
  start: Pos,
  goalRow: number,
  walls: BlockadeWall[],
  opponentPos: Pos | null
): number {
  const visited = new Map<string, number>();
  const queue: { p: Pos; d: number }[] = [{ p: start, d: 0 }];
  visited.set(posKey(start), 0);

  while (queue.length > 0) {
    const { p: cur, d } = queue.shift()!;
    if (cur.y === goalRow) return d;

    const moves = getAllMoveTargets(cur, walls, opponentPos);
    for (const next of moves) {
      const key = posKey(next);
      if (visited.has(key)) continue;
      visited.set(key, d + 1);
      queue.push({ p: next, d: d + 1 });
    }
  }
  return 999;
}
