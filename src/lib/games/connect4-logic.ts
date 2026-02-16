/**
 * Connect 4 game logic: 7 columns x 6 rows.
 * Player 1 = 1 (red), Player 2 = 2 (yellow), empty = 0.
 */

export const COLS = 7;
export const ROWS = 6;

export type Player = 1 | 2;
export type Cell = 0 | 1 | 2;

/** Board: board[row][col], row 0 = top, row 5 = bottom */
export type Board = Cell[][];

export function createEmptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0) as Cell[]);
}

/** Get the next empty row in a column (0 = top). Returns -1 if column full. */
export function getNextRow(board: Board, col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) return r;
  }
  return -1;
}

/** Get all columns that have at least one empty cell */
export function getValidColumns(board: Board): number[] {
  const cols: number[] = [];
  for (let c = 0; c < COLS; c++) {
    if (getNextRow(board, c) >= 0) cols.push(c);
  }
  return cols;
}

/** Drop a disc in column col. Returns new board and row where it landed, or null if invalid. */
export function dropDisc(board: Board, col: number, player: Player): { board: Board; row: number } | null {
  const row = getNextRow(board, col);
  if (row < 0) return null;
  const next = board.map((r, ri) =>
    r.map((cell, ci) => (ri === row && ci === col ? player : cell))
  ) as Board;
  return { board: next, row };
}

export type WinResult = { player: Player; cells: [number, number][] } | null;

/** Check for 4 in a row (horizontal, vertical, both diagonals). Returns winning player and the 4 cells. */
export function checkWin(board: Board): WinResult {
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const p = board[r][c];
      if (p === 0) continue;
      if (board[r][c + 1] === p && board[r][c + 2] === p && board[r][c + 3] === p) {
        return { player: p as Player, cells: [[r, c], [r, c + 1], [r, c + 2], [r, c + 3]] };
      }
    }
  }
  // Vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      const p = board[r][c];
      if (p === 0) continue;
      if (board[r + 1][c] === p && board[r + 2][c] === p && board[r + 3][c] === p) {
        return { player: p as Player, cells: [[r, c], [r + 1, c], [r + 2, c], [r + 3, c]] };
      }
    }
  }
  // Diagonal \ (top-left to bottom-right)
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const p = board[r][c];
      if (p === 0) continue;
      if (
        board[r + 1][c + 1] === p &&
        board[r + 2][c + 2] === p &&
        board[r + 3][c + 3] === p
      ) {
        return { player: p as Player, cells: [[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]] };
      }
    }
  }
  // Diagonal / (top-right to bottom-left)
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 3; c < COLS; c++) {
      const p = board[r][c];
      if (p === 0) continue;
      if (
        board[r + 1][c - 1] === p &&
        board[r + 2][c - 2] === p &&
        board[r + 3][c - 3] === p
      ) {
        return { player: p as Player, cells: [[r, c], [r + 1, c - 1], [r + 2, c - 2], [r + 3, c - 3]] };
      }
    }
  }
  return null;
}

/** True if every cell is filled */
export function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== 0));
}
