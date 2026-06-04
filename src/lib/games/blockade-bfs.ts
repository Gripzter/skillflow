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

/** Undirected edge key for two adjacent cell centers. */
export function edgeKey(a: Pos, b: Pos): string {
  const k1 = posKey(a);
  const k2 = posKey(b);
  return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
}

export function buildBlockedEdgeSet(walls: BlockadeWall[]): Set<string> {
  const set = new Set<string>();
  for (const wall of walls) {
    for (const [e1, e2] of getBlockedEdges(wall)) {
      set.add(edgeKey(e1, e2));
    }
  }
  return set;
}

/** True if a wall segment blocks the edge between (x1,y1) and (x2,y2). */
export function isEdgeBlocked(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  walls: BlockadeWall[]
): boolean {
  return isEdgeBlockedPos({ x: x1, y: y1 }, { x: x2, y: y2 }, walls);
}

export function isEdgeBlockedPos(a: Pos, b: Pos, walls: BlockadeWall[]): boolean {
  if (!inBounds(a) || !inBounds(b)) return true;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return true;
  const key = edgeKey(a, b);
  const set = buildBlockedEdgeSet(walls);
  return set.has(key);
}

function isEdgeBlockedInSet(a: Pos, b: Pos, edgeSet: Set<string>): boolean {
  if (!inBounds(a) || !inBounds(b)) return true;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return true;
  return edgeSet.has(edgeKey(a, b));
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

export function getReachableNeighbors(
  from: Pos,
  walls: BlockadeWall[],
  opponentPos: Pos | null
): Pos[] {
  const edgeSet = buildBlockedEdgeSet(walls);
  const neighbors: Pos[] = [];
  for (const d of CARDINAL) {
    const next = { x: from.x + d.x, y: from.y + d.y };
    if (!inBounds(next)) continue;
    if (isEdgeBlockedInSet(from, next, edgeSet)) continue;
    if (opponentPos && next.x === opponentPos.x && next.y === opponentPos.y) continue;
    neighbors.push(next);
  }
  return neighbors;
}

/** Quoridor-style jump when adjacent to opponent. */
export function getJumpDestinations(from: Pos, opponentPos: Pos, walls: BlockadeWall[]): Pos[] {
  if (Math.abs(from.x - opponentPos.x) + Math.abs(from.y - opponentPos.y) !== 1) return [];
  if (isEdgeBlockedPos(from, opponentPos, walls)) return [];

  const behind = {
    x: opponentPos.x + (opponentPos.x - from.x),
    y: opponentPos.y + (opponentPos.y - from.y),
  };
  const results: Pos[] = [];

  if (inBounds(behind) && !isEdgeBlockedPos(opponentPos, behind, walls)) {
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
    if (isEdgeBlockedPos(opponentPos, p, walls)) continue;
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

/**
 * Cardinal BFS for wall-placement legality (Quoridor rules).
 * Other pawns are NOT obstacles — only walls block edges.
 */
export function bfsHasPath(start: Pos, goalRow: number, walls: BlockadeWall[]): boolean {
  const edgeSet = buildBlockedEdgeSet(walls);
  const visited = new Set<string>();
  const queue: Pos[] = [start];
  visited.add(posKey(start));

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.y === goalRow) return true;

    for (const d of CARDINAL) {
      const next = { x: cur.x + d.x, y: cur.y + d.y };
      if (!inBounds(next)) continue;
      if (isEdgeBlockedInSet(cur, next, edgeSet)) continue;
      const key = posKey(next);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return false;
}

/** @deprecated Use bfsHasPath for wall validation; opponent is ignored for legality checks. */
export function canReachGoalRow(
  start: Pos,
  goalRow: number,
  walls: BlockadeWall[],
  _opponentPos: Pos | null
): boolean {
  return bfsHasPath(start, goalRow, walls);
}

/** Shortest path from start to any cell on goalRow (includes jumps). Returns full path or null. */
export function bfsShortestPath(
  start: Pos,
  goalRow: number,
  walls: BlockadeWall[],
  opponentPos: Pos | null
): Pos[] | null {
  const visited = new Set<string>();
  const parent = new Map<string, Pos>();
  const queue: Pos[] = [start];
  visited.add(posKey(start));

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.y === goalRow) {
      const path: Pos[] = [cur];
      let key = posKey(cur);
      while (parent.has(key)) {
        const prev = parent.get(key)!;
        path.unshift(prev);
        key = posKey(prev);
      }
      return path;
    }

    for (const next of getAllMoveTargets(cur, walls, opponentPos)) {
      if (opponentPos && next.x === opponentPos.x && next.y === opponentPos.y) continue;
      const key = posKey(next);
      if (visited.has(key)) continue;
      visited.add(key);
      parent.set(key, cur);
      queue.push(next);
    }
  }
  return null;
}

/** Shortest path length to goal row (for bot; includes jumps). */
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
      if (opponentPos && next.x === opponentPos.x && next.y === opponentPos.y) continue;
      const key = posKey(next);
      if (visited.has(key)) continue;
      visited.set(key, d + 1);
      queue.push({ p: next, d: d + 1 });
    }
  }
  return 999;
}
