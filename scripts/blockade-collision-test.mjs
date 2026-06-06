import { createInitialState, applyWall, applyMove } from "../src/lib/games/blockade-logic.ts";
import { isBlocked } from "../src/lib/games/blockade-collision.ts";

let s = createInitialState();
// Horizontal wall on top edge of bottom-row cells blocks (4,8)↔(4,7)
const placed = applyWall(s, "player1", { x: 4, y: 8, orientation: "horizontal" });
if (!placed) throw new Error("wall place failed");

const blocked = isBlocked(4, 8, 4, 7, placed.state.walls);
if (!blocked) throw new Error("isBlocked should be true");

let s2 = createInitialState();
const w2 = applyWall(s2, "player1", { x: 4, y: 8, orientation: "horizontal" });
s2 = w2.state;
s2.currentTurn = "player1";
const rejected = applyMove(s2, "player1", { x: 4, y: 7 });
if (rejected !== null) throw new Error("move through wall should be rejected");

console.log("All collision checks passed");
