/**
 * BFS pathfinding for Blockade — uses flat blockedEdges array for collision.
 */

import type { BlockadeWall, Pos } from "./blockade-logic";
import {
  isMovementBlocked,
  rebuildBlockedEdges,
  wallToBlockedEdges,
  type BlockedEdge,
} from "./blockade-edges";

export const BOARD_SIZE = 9;

export function posKey(p: Pos): string {
  return `${p.x},${p.y}`;
}

function inBounds(p: Pos): boolean {
  return p.x >= 0 && p.x < BOARD_SIZE && p.y >= 0 && p.y < BOARD_SIZE;
}

/** Decompose wall to edge pairs (for overlap checks). */
export function getBlockedEdges(wall: BlockadeWall): [Pos, Pos][] {
  return wallToBlockedEdges(wall).map((e) => [
    { x: e.x1, y: e.y1 },
    { x: e.x2, y: e.y2 },
  ]);
}

export function edgeKey(a: Pos, b: Pos): string {
  const k1 = posKey(a);
  const k2 = posKey(b);
  return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
}

export function buildBlockedEdgeSet(walls: BlockadeWall[]): Set<string> {
  const set = new Set<string>();
  for (const e of rebuildBlockedEdges(walls)) {
    set.add(edgeKey({ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }));
  }
  return set;
}

export function isEdgeBlocked(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  blockedEdges: BlockedEdge[]
): boolean {
  return isMovementBlocked(x1, y1, x2, y2, blockedEdges);
}

export function isEdgeBlockedPos(a: Pos, b: Pos, blockedEdges: BlockedEdge[]): boolean {
  if (!inBounds(a) || !inBounds(b)) return true;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return true;
  return isMovementBlocked(a.x, a.y, b.x, b.y, blockedEdges);
}

/** @deprecated Use blockedEdges. */
export function isEdgeBlockedFromWalls(a: Pos, b: Pos, walls: BlockadeWall[]): boolean {
  return isEdgeBlockedPos(a, b, rebuildBlockedEdges(walls));
}

const CARDINAL: Pos[] = [
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
];

export function getReachableNeighbors(
  from: Pos,
  blockedEdges: BlockedEdge[],
  opponentPos: Pos | null
): Pos[] {
  const neighbors: Pos[] = [];
  for (const d of CARDINAL) {
    const next = { x: from.x + d.x, y: from.y + d.y };
    if (!inBounds(next)) continue;
    if (isMovementBlocked(from.x, from.y, next.x, next.y, blockedEdges)) continue;
    if (opponentPos && next.x === opponentPos.x && next.y === opponentPos.y) continue;
    neighbors.push(next);
  }
  return neighbors;
}

export function getJumpDestinations(
  from: Pos,
  opponentPos: Pos,
  blockedEdges: BlockedEdge[]
): Pos[] {
  if (Math.abs(from.x - opponentPos.x) + Math.abs(from.y - opponentPos.y) !== 1) return [];
  if (isMovementBlocked(from.x, from.y, opponentPos.x, opponentPos.y, blockedEdges)) return [];

  const behind = {
    x: opponentPos.x + (opponentPos.x - from.x),
    y: opponentPos.y + (opponentPos.y - from.y),
  };
  const results: Pos[] = [];

  if (inBounds(behind) && !isMovementBlocked(opponentPos.x, opponentPos.y, behind.x, behind.y, blockedEdges)) {
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
    if (isMovementBlocked(opponentPos.x, opponentPos.y, p.x, p.y, blockedEdges)) continue;
    results.push(p);
  }
  return results;
}

export function getAllMoveTargets(
  from: Pos,
  blockedEdges: BlockedEdge[],
  opponentPos: Pos | null
): Pos[] {
  const set = new Set<string>();
  const add = (p: Pos) => {
    if (inBounds(p)) set.add(posKey(p));
  };

  for (const n of getReachableNeighbors(from, blockedEdges, opponentPos)) add(n);

  if (opponentPos) {
    for (const j of getJumpDestinations(from, opponentPos, blockedEdges)) add(j);
  }

  return Array.from(set).map((k) => {
    const [x, y] = k.split(",").map(Number);
    return { x, y };
  });
}

export function bfsHasPath(start: Pos, goalRow: number, blockedEdges: BlockedEdge[]): boolean {
  const visited = new Set<string>();
  const queue: Pos[] = [start];
  visited.add(posKey(start));

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.y === goalRow) return true;

    for (const d of CARDINAL) {
      const next = { x: cur.x + d.x, y: cur.y + d.y };
      if (!inBounds(next)) continue;
      if (isMovementBlocked(cur.x, cur.y, next.x, next.y, blockedEdges)) continue;
      const key = posKey(next);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return false;
}

/** @deprecated */
export function canReachGoalRow(
  start: Pos,
  goalRow: number,
  walls: BlockadeWall[],
  _opponentPos: Pos | null
): boolean {
  return bfsHasPath(start, goalRow, rebuildBlockedEdges(walls));
}

export function bfsShortestPath(
  start: Pos,
  goalRow: number,
  blockedEdges: BlockedEdge[],
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

    for (const next of getAllMoveTargets(cur, blockedEdges, opponentPos)) {
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

export function shortestPathToGoal(
  start: Pos,
  goalRow: number,
  blockedEdges: BlockedEdge[],
  opponentPos: Pos | null
): number {
  const visited = new Map<string, number>();
  const queue: { p: Pos; d: number }[] = [{ p: start, d: 0 }];
  visited.set(posKey(start), 0);

  while (queue.length > 0) {
    const { p: cur, d } = queue.shift()!;
    if (cur.y === goalRow) return d;

    for (const next of getAllMoveTargets(cur, blockedEdges, opponentPos)) {
      if (opponentPos && next.x === opponentPos.x && next.y === opponentPos.y) continue;
      const key = posKey(next);
      if (visited.has(key)) continue;
      visited.set(key, d + 1);
      queue.push({ p: next, d: d + 1 });
    }
  }
  return 999;
}

/** Convenience: pathfinding from wall objects (rebuilds edges). */
export function bfsHasPathFromWalls(start: Pos, goalRow: number, walls: BlockadeWall[]): boolean {
  return bfsHasPath(start, goalRow, rebuildBlockedEdges(walls));
}

export function bfsShortestPathFromWalls(
  start: Pos,
  goalRow: number,
  walls: BlockadeWall[],
  opponentPos: Pos | null
): Pos[] | null {
  return bfsShortestPath(start, goalRow, rebuildBlockedEdges(walls), opponentPos);
}

export function shortestPathToGoalFromWalls(
  start: Pos,
  goalRow: number,
  walls: BlockadeWall[],
  opponentPos: Pos | null
): number {
  return shortestPathToGoal(start, goalRow, rebuildBlockedEdges(walls), opponentPos);
}
