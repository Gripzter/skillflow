export type Player = 1 | 2;

export type Pos = { r: number; c: number };

/**
 * Piece encoding:
 *  1  => Player 1 man (bottom / red)
 *  2  => Player 1 king
 * -1  => Player 2 man (top / light)
 * -2  => Player 2 king
 */
export type Board = number[][];

export type Step =
  | {
      type: "regular";
      from: Pos;
      to: Pos;
    }
  | {
      type: "capture";
      from: Pos;
      to: Pos;
      captured: Pos;
    };

export type TurnMove = {
  start: Pos;
  end: Pos;
  steps: Step[];
  didCapture: boolean;
  didKing: boolean;
  capturedCount: number;
};

const EMPTY = 0;

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function isDarkSquare(r: number, c: number): boolean {
  // Using (row+col)%2 === 1 as the dark squares (standard mapping with a1 dark).
  return (r + c) % 2 === 1;
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

function getPiecePlayer(piece: number): Player | null {
  if (piece === 1 || piece === 2) return 1;
  if (piece === -1 || piece === -2) return 2;
  return null;
}

function isKingCode(piece: number): boolean {
  return piece === 2 || piece === -2;
}

function getKingedCode(piece: number, player: Player): number {
  const kingCode = player === 1 ? 2 : -2;
  return isKingCode(piece) ? piece : kingCode;
}

function isCrowningSquare(r: number, player: Player): boolean {
  // Player 1 kings on row 0 (top). Player 2 kings on row 7 (bottom).
  return player === 1 ? r === 0 : r === 7;
}

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => EMPTY));

  for (let r = 0; r <= 2; r++) {
    for (let c = 0; c < 8; c++) {
      if (!isDarkSquare(r, c)) continue;
      board[r][c] = -1; // Player 2 man
    }
  }

  for (let r = 5; r <= 7; r++) {
    for (let c = 0; c < 8; c++) {
      if (!isDarkSquare(r, c)) continue;
      board[r][c] = 1; // Player 1 man
    }
  }

  return board;
}

export function getPieceAt(board: Board, pos: Pos): number {
  return board[pos.r][pos.c] ?? EMPTY;
}

function setPieceAt(board: Board, pos: Pos, piece: number) {
  board[pos.r][pos.c] = piece;
}

export function getCaptureStepsFrom(board: Board, from: Pos, player: Player): Step[] {
  const piece = board[from.r][from.c];
  if (getPiecePlayer(piece) !== player) return [];

  const king = isKingCode(piece);
  const forwardDir = player === 1 ? -1 : 1;

  const directions: Array<{ dr: number; dc: number }> = [];

  if (king) {
    directions.push({ dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 });
  } else {
    directions.push({ dr: forwardDir, dc: -1 }, { dr: forwardDir, dc: 1 });
  }

  const steps: Step[] = [];
  for (const { dr, dc } of directions) {
    const midR = from.r + dr;
    const midC = from.c + dc;
    const landR = from.r + 2 * dr;
    const landC = from.c + 2 * dc;
    if (!inBounds(midR, midC) || !inBounds(landR, landC)) continue;
    if (!isDarkSquare(landR, landC)) continue;

    const midPiece = board[midR][midC];
    const midOwner = getPiecePlayer(midPiece);
    if (!midOwner || midOwner === player) continue;

    const landPiece = board[landR][landC];
    if (landPiece !== EMPTY) continue;

    steps.push({
      type: "capture",
      from,
      to: { r: landR, c: landC },
      captured: { r: midR, c: midC },
    });
  }

  return steps;
}

export function getRegularStepsFrom(board: Board, from: Pos, player: Player): Step[] {
  const piece = board[from.r][from.c];
  if (getPiecePlayer(piece) !== player) return [];
  const king = isKingCode(piece);
  const forwardDir = player === 1 ? -1 : 1;

  const directions: Array<{ dr: number; dc: number }> = [];
  if (king) {
    directions.push({ dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 });
  } else {
    directions.push({ dr: forwardDir, dc: -1 }, { dr: forwardDir, dc: 1 });
  }

  const steps: Step[] = [];
  for (const { dr, dc } of directions) {
    const toR = from.r + dr;
    const toC = from.c + dc;
    if (!inBounds(toR, toC)) continue;
    if (!isDarkSquare(toR, toC)) continue;
    if (board[toR][toC] !== EMPTY) continue;
    steps.push({
      type: "regular",
      from,
      to: { r: toR, c: toC },
    });
  }

  return steps;
}

export function getMustCapture(board: Board, player: Player): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (getPiecePlayer(piece) !== player) continue;
      if (getCaptureStepsFrom(board, { r, c }, player).length > 0) return true;
    }
  }
  return false;
}

export function getPiecesWithCaptures(board: Board, player: Player): Pos[] {
  const out: Pos[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (getPiecePlayer(piece) !== player) continue;
      if (getCaptureStepsFrom(board, { r, c }, player).length > 0) out.push({ r, c });
    }
  }
  return out;
}

export function applyStep(board: Board, step: Step, player: Player): { board: Board; didKing: boolean } {
  const next = cloneBoard(board);
  const movingPiece = next[step.from.r][step.from.c];
  const playerAtPiece = getPiecePlayer(movingPiece);
  if (playerAtPiece !== player) {
    return { board: next, didKing: false };
  }

  // Move piece.
  setPieceAt(next, step.from, EMPTY);
  if (step.type === "capture") {
    setPieceAt(next, step.captured, EMPTY);
  }

  let finalPiece = movingPiece;
  const kingedBefore = isCrowningSquare(step.to.r, player);
  if (kingedBefore) {
    finalPiece = getKingedCode(movingPiece, player);
  }

  setPieceAt(next, step.to, finalPiece);
  return { board: next, didKing: kingedBefore && !isKingCode(movingPiece) };
}

function countPieces(board: Board, player: Player): number {
  let n = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (getPiecePlayer(piece) === player) n++;
    }
  }
  return n;
}

export function getLegalTurnMoves(board: Board, player: Player): TurnMove[] {
  const mustCapture = getMustCapture(board, player);
  const turnMoves: TurnMove[] = [];

  // Capture lines (multi-jump) for each piece.
  if (mustCapture) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (getPiecePlayer(board[r][c]) !== player) continue;
        const from = { r, c };
        const lines = getCaptureLinesFrom(board, from, player);
        turnMoves.push(
          ...lines.map((line) => ({
            start: from,
            end: line.end,
            steps: line.steps,
            didCapture: true,
            didKing: line.didKing,
            capturedCount: line.capturedCount,
          }))
        );
      }
    }
    return turnMoves;
  }

  // Regular moves: one step.
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (getPiecePlayer(board[r][c]) !== player) continue;
      const from = { r, c };
      const movingPiece = board[r][c];
      for (const s of getRegularStepsFrom(board, from, player)) {
        const to = (s as { type: "regular"; to: Pos }).to;
        turnMoves.push({
          start: from,
          end: to,
          steps: [s],
          didCapture: false,
          didKing: isCrowningSquare(to.r, player) && !isKingCode(movingPiece),
          capturedCount: 0,
        });
      }
    }
  }

  return turnMoves;
}

type CaptureLine = { end: Pos; steps: Step[]; didKing: boolean; capturedCount: number };

function getCaptureLinesFrom(board: Board, from: Pos, player: Player): CaptureLine[] {
  const steps = getCaptureStepsFrom(board, from, player);
  if (steps.length === 0) return [];

  const out: CaptureLine[] = [];

  for (const s of steps) {
    const { board: nextBoard, didKing } = applyStep(board, s, player);
    const to = (s as { type: "capture"; to: Pos }).to;
    const moreCaptures = getCaptureStepsFrom(nextBoard, to, player);

    if (moreCaptures.length === 0) {
      out.push({
        end: to,
        steps: [s],
        didKing,
        capturedCount: 1,
      });
    } else {
      const tails = getCaptureLinesFrom(nextBoard, to, player);
      for (const t of tails) {
        out.push({
          end: t.end,
          steps: [s, ...t.steps],
          didKing: didKing || t.didKing,
          capturedCount: 1 + t.capturedCount,
        });
      }
    }
  }

  return out;
}

export function getGameWinnerOrDraw(
  board: Board,
  noProgressCount: number
): { kind: "win"; winner: Player } | { kind: "draw" } | null {
  const p1Pieces = countPieces(board, 1);
  const p2Pieces = countPieces(board, 2);
  if (p1Pieces === 0) return { kind: "win", winner: 2 };
  if (p2Pieces === 0) return { kind: "win", winner: 1 };

  // Win by having no legal moves.
  const p1Moves = getLegalTurnMoves(board, 1);
  if (p1Moves.length === 0) return { kind: "win", winner: 2 };
  const p2Moves = getLegalTurnMoves(board, 2);
  if (p2Moves.length === 0) return { kind: "win", winner: 1 };

  // 50-turn draw rule (no captures and no kinging, tracked by caller).
  if (noProgressCount >= 50) return { kind: "draw" };
  return null;
}

export function opposite(player: Player): Player {
  return player === 1 ? 2 : 1;
}

export function getBoardSummary(board: Board): {
  p1Pieces: number;
  p2Pieces: number;
} {
  return { p1Pieces: countPieces(board, 1), p2Pieces: countPieces(board, 2) };
}

export function posToAlgebraic(pos: Pos): string {
  const file = String.fromCharCode(65 + pos.c);
  const rank = 8 - pos.r;
  return `${file}${rank}`;
}

