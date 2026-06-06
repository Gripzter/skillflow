/**
 * Classic Quoridor wall collision — ONE function, used everywhere.
 * Coordinates: y=0 is TOP row, y=8 is BOTTOM row. x=0 is left.
 */

export type Wall = {
  x: number;
  y: number;
  orientation: "horizontal" | "vertical";
};

export function isBlocked(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  walls: Wall[]
): boolean {
  for (const wall of walls) {
    if (wall.orientation === "horizontal") {
      if (
        (fromX === wall.x || fromX === wall.x + 1) &&
        ((fromY === wall.y && toY === wall.y - 1) || (fromY === wall.y - 1 && toY === wall.y))
      ) {
        return true;
      }
    }
    if (wall.orientation === "vertical") {
      if (
        (fromY === wall.y || fromY === wall.y + 1) &&
        ((fromX === wall.x && toX === wall.x - 1) || (fromX === wall.x - 1 && toX === wall.x))
      ) {
        return true;
      }
    }
  }
  return false;
}
