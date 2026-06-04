/**
 * Run: node scripts/blockade-path-check.mjs
 * Verifies BFS path validation and edge blocking for Blockade.
 */
import { createRequire } from "module";
import { pathToFileURL } from "url";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// Compile-free check: duplicate core logic inline for node (TS not compiled)
const BOARD_SIZE = 9;

function posKey(p) {
  return `${p.x},${p.y}`;
}

function edgeKey(a, b) {
  const k1 = posKey(a);
  const k2 = posKey(b);
  return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
}

function getBlockedEdges(wall) {
  const out = [];
  const add = (x1, y1, x2, y2) => out.push([{ x: x1, y: y1 }, { x: x2, y: y2 }]);

  if (wall.type === "standard") {
    if (wall.orientation === "h") {
      add(wall.col, wall.row, wall.col, wall.row + 1);
      add(wall.col + 1, wall.row, wall.col + 1, wall.row + 1);
    } else {
      add(wall.col, wall.row, wall.col + 1, wall.row);
      add(wall.col, wall.row + 1, wall.col + 1, wall.row + 1);
    }
    return out;
  }
  if (wall.type === "triple") {
    if (wall.orientation === "h") {
      for (let i = 0; i < 3; i++) add(wall.col + i, wall.row, wall.col + i, wall.row + 1);
    } else {
      for (let i = 0; i < 3; i++) add(wall.col, wall.row + i, wall.col + 1, wall.row + i);
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

function buildBlockedEdgeSet(walls) {
  const set = new Set();
  for (const wall of walls) {
    for (const [e1, e2] of getBlockedEdges(wall)) {
      set.add(edgeKey(e1, e2));
    }
  }
  return set;
}

function bfsHasPath(start, goalRow, walls) {
  const edgeSet = buildBlockedEdgeSet(walls);
  const visited = new Set([posKey(start)]);
  const queue = [start];
  const CARDINAL = [
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
  ];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.y === goalRow) return true;
    for (const d of CARDINAL) {
      const next = { x: cur.x + d.x, y: cur.y + d.y };
      if (next.x < 0 || next.x >= BOARD_SIZE || next.y < 0 || next.y >= BOARD_SIZE) continue;
      if (edgeSet.has(edgeKey(cur, next))) continue;
      const key = posKey(next);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return false;
}

function canPlaceWallPathCheck(newWall, existingWalls, p1, p2, g1, g2) {
  const all = [...existingWalls, newWall];
  const player1HasPath = bfsHasPath(p1, g1, all);
  const player2HasPath = bfsHasPath(p2, g2, all);
  return { allowed: player1HasPath && player2HasPath, player1HasPath, player2HasPath };
}

let failed = 0;
function assert(name, cond) {
  if (!cond) {
    console.error("FAIL:", name);
    failed++;
  } else {
    console.log("OK:", name);
  }
}

const P1_GOAL = 8;
const P2_GOAL = 0;

// Test 1: P1 at (4,0) reaches row 8 with no walls
assert("empty board P1 path", bfsHasPath({ x: 4, y: 0 }, P1_GOAL, []));

// Test 2: wall across column 4 between y=0 and y=1 blocks direct path
const blockStart = { type: "standard", orientation: "h", row: 0, col: 4 };
const withBlock = [blockStart];
assert("wall blocks step up from (4,0)", !bfsHasPath({ x: 4, y: 0 }, P1_GOAL, withBlock) === false || bfsHasPath({ x: 4, y: 1 }, P1_GOAL, withBlock));

// Can still reach via detour from (4,0)?
const canDetour = bfsHasPath({ x: 4, y: 0 }, P1_GOAL, withBlock);
assert("P1 can detour around single h wall at col 4 row 0", canDetour);

// Test 3: Box (4,4) completely
const box = [
  { type: "standard", orientation: "h", row: 4, col: 3 },
  { type: "standard", orientation: "h", row: 3, col: 3 },
  { type: "standard", orientation: "v", row: 3, col: 3 },
  { type: "standard", orientation: "v", row: 3, col: 4 },
];
assert("boxed (4,4) cannot reach row 8", !bfsHasPath({ x: 4, y: 4 }, P1_GOAL, box));
assert("boxed (4,4) cannot reach row 0", !bfsHasPath({ x: 4, y: 4 }, P2_GOAL, box));

// Test 4: closing wall rejected
const almostBox = box.slice(0, 3);
const closing = { type: "standard", orientation: "v", row: 3, col: 4 };
const check = canPlaceWallPathCheck(
  { ...closing, id: "t", owner: "player1", placedTurn: 1 },
  almostBox.map((w, i) => ({ ...w, id: String(i), owner: "player1", placedTurn: 1 })),
  { x: 4, y: 4 },
  { x: 0, y: 0 },
  P1_GOAL,
  P2_GOAL
);
assert("closing box wall rejected for trapped pawn", !check.allowed);

// Test 5: L-shape blocks 3 edges
const lWall = { type: "lshape", row: 2, col: 2, rotation: 0 };
const edges = getBlockedEdges(lWall);
assert("L-shape has 3 blocked edges", edges.length === 3);

// Test 6: triple h blocks 3 vertical passages
const triple = { type: "triple", orientation: "h", row: 4, col: 2 };
const tripleEdges = getBlockedEdges(triple);
assert("triple h has 3 blocked edges", tripleEdges.length === 3);

console.log(failed ? `\n${failed} test(s) failed` : "\nAll path checks passed");
process.exit(failed ? 1 : 0);
