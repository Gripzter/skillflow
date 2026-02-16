/**
 * Chess utilities: piece symbols, material values, square helpers.
 * chess.js handles all game rules.
 */

export type PieceColor = "w" | "b";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

/** Unicode chess symbols: white then black */
export const PIECE_SYMBOLS: Record<PieceColor, Record<PieceType, string>> = {
  w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
  b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
};

/** Material value for captured piece display and advantage */
export const PIECE_VALUE: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

/** Order for displaying captured pieces (by value) */
export const CAPTURED_DISPLAY_ORDER: PieceType[] = ["q", "r", "b", "n", "p"];

export function getPieceSymbol(color: PieceColor, type: PieceType): string {
  return PIECE_SYMBOLS[color][type];
}

/** Square is light (a1 is dark in standard board, so file+rank even = light) */
export function isLightSquare(file: number, rank: number): boolean {
  return (file + rank) % 2 === 0;
}

/** File index 0-7 from letter a-h */
export function fileToIndex(file: string): number {
  return file.charCodeAt(0) - 97;
}

/** Rank index 0-7 from "1"-"8" (rank 1 = index 7 for White at bottom) */
export function rankToIndex(rank: string): number {
  return 8 - parseInt(rank, 10);
}

/** Square key e.g. "e4" to file index 4, rank index 4 */
export function squareToIndices(square: string): { file: number; rank: number } {
  return {
    file: fileToIndex(square[0]),
    rank: rankToIndex(square[1]),
  };
}

/** Indices to square key (rank 0 = 8th rank = "8") */
export function indicesToSquare(file: number, rank: number): string {
  return String.fromCharCode(97 + file) + (8 - rank);
}

/** Files a-h */
export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
/** Ranks 1-8 (display order, White at bottom = 8 at bottom) */
export const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

/** Board colors chess.com style */
export const LIGHT_SQUARE = "#EBECD0";
export const DARK_SQUARE = "#779556";
export const BORDER_COLOR = "#4A3728";
export const LAST_MOVE_OVERLAY = "rgba(247, 236, 89, 0.3)";
export const SELECTED_OVERLAY = "rgba(0, 229, 199, 0.4)";
export const CHECK_OVERLAY = "rgba(239, 68, 68, 0.5)";

/** Full piece names for chat-style move log */
export const PIECE_NAMES: Record<PieceType, string> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

/** Format a single move for history: "♘ g1 → f3" or "♗ c1 × f4" */
export function formatMoveDisplay(
  color: PieceColor,
  piece: PieceType,
  from: string,
  to: string,
  capture: boolean,
  san: string
): string {
  const icon = getPieceSymbol(color, piece);
  const arrow = capture ? " × " : " → ";
  let suffix = "";
  if (san.endsWith("#")) suffix = "#";
  else if (san.endsWith("+")) suffix = "+";
  return `${icon} ${from}${arrow}${to}${suffix}`;
}

/** Promotion piece type to name */
export const PROMO_NAMES: Record<string, string> = {
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight",
};

/**
 * Chat-style move description: "[Piece Name] [from] → [to]" with × for capture,
 * castling text, check/checkmate, promotion. Used for move log bubbles.
 */
export function getMoveDescriptionForChat(
  piece: PieceType,
  from: string,
  to: string,
  capture: boolean,
  san: string,
  flags?: string
): string {
  const pieceName = PIECE_NAMES[piece];
  if (san.includes("O-O-O")) return "King castles queenside ♔⟷♖";
  if (san.includes("O-O")) return "King castles kingside ♔⟷♖";
  const arrow = capture ? " × " : " → ";
  let main = `${pieceName} ${from}${arrow}${to}`;
  if (san.endsWith("#")) main += "# Checkmate!";
  else if (san.endsWith("+")) main += "+";
  const promoMatch = san.match(/=([QRBN])/);
  if (promoMatch) {
    const promoPiece = promoMatch[1].toLowerCase() as PieceType;
    main += ` (promoted to ${PROMO_NAMES[promoPiece] || promoPiece})`;
  }
  return main;
}
