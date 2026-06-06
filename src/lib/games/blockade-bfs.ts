import { isBlocked, type Wall } from "./blockade-collision";

export const BOARD_SIZE = 9;

export type Pos = { x: number; y: number };

const CARDINAL = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

function inBounds(p: Pos): boolean {
  return p.x >= 0 && p.x < BOARD_SIZE && p.y >= 0 && p.y < BOARD_SIZE;
}

export function posKey(p: Pos): string {
  return `${p.x},${p.y}`;
}

export function getReachableNeighbors(from: Pos, walls: Wall[], blockCell: Pos | null): Pos[] {
  const out: Pos[] = [];
  for (const d of CARDINAL) {
    const to = { x: from.x + d.x, y: from.y + d.y };
    if (!inBounds(to)) continue;
    if (blockCell && to.x === blockCell.x && to.y === blockCell.y) continue;
    if (isBlocked(from.x, from.y, to.x, to.y, walls)) continue;
    out.push(to);
  }
  return out;
}

export function getLegalTargets(from: Pos, walls: Wall[], blockCell: Pos | null): Pos[] {
  return getReachableNeighbors(from, walls, blockCell);
}

/** Cardinal BFS — can start reach any cell on goalRow? (Quoridor wall check; pawns ignored) */
export function bfsHasPathToGoal(start: Pos, goalRow: number, walls: Wall[]): boolean {
  const visited = new Set<string>();
  const queue: Pos[] = [start];
  visited.add(posKey(start));

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.y === goalRow) return true;
    for (const n of getReachableNeighbors(cur, walls, null)) {
      const k = posKey(n);
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push(n);
    }
  }
  return false;
}

export function bfsShortestPath(
  start: Pos,
  goalRow: number,
  walls: Wall[],
  blockCell: Pos | null
): Pos[] | null {
  const visited = new Set<string>();
  const parent = new Map<string, Pos>();
  const queue: Pos[] = [start];
  visited.add(posKey(start));

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.y === goalRow) {
      const path: Pos[] = [cur];
      let k = posKey(cur);
      while (parent.has(k)) {
        const p = parent.get(k)!;
        path.unshift(p);
        k = posKey(p);
      }
      return path;
    }
    for (const n of getReachableNeighbors(cur, walls, blockCell)) {
      const k = posKey(n);
      if (visited.has(k)) continue;
      visited.add(k);
      parent.set(k, cur);
      queue.push(n);
    }
  }
  return null;
}

export function bfsPathLength(start: Pos, goalRow: number, walls: Wall[], blockCell: Pos | null): number {
  const path = bfsShortestPath(start, goalRow, walls, blockCell);
  return path ? path.length - 1 : 999;
}
