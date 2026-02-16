"use client";

import { getPieceSymbol, type PieceColor, type PieceType } from "@/lib/games/chess-utils";

interface ChessPieceProps {
  /** Piece code from chess.js: "w"|"b" + "K"|"Q"|"R"|"B"|"N"|"P" (uppercase) */
  piece: string;
  /** Size of the square in px (piece font ~70% of this) */
  squareSize: number;
  /** When true, piece is being dragged (scale + shadow) */
  isDragging?: boolean;
  /** Optional transition for move animation */
  animateTo?: { x: number; y: number } | null;
  className?: string;
}

export default function ChessPiece({
  piece,
  squareSize,
  isDragging = false,
  animateTo = null,
  className = "",
}: ChessPieceProps) {
  const color = piece[0] as PieceColor;
  const type = piece[1].toLowerCase() as PieceType;
  const symbol = getPieceSymbol(color, type);
  const fontSize = Math.max(14, squareSize * 0.7);
  const isWhite = color === "w";

  return (
    <span
      className={`inline-flex select-none items-center justify-center ${className}`}
      style={{
        fontSize: `${fontSize}px`,
        width: squareSize,
        height: squareSize,
        lineHeight: 1,
        color: isWhite ? "#FFFFFF" : "#1A1A1A",
        textShadow: isWhite
          ? "0 0 1px #000, 0 1px 2px rgba(0,0,0,0.5), 1px 1px 0 #000"
          : "0 0 1px #fff, 0 1px 2px rgba(255,255,255,0.3)",
        transform: isDragging ? "scale(1.1)" : "scale(1)",
        transition: animateTo ? "transform 150ms ease-out" : "transform 100ms ease-out",
        zIndex: isDragging ? 10 : 1,
        pointerEvents: "none",
      }}
      aria-label={`${isWhite ? "White" : "Black"} ${type}`}
    >
      {symbol}
    </span>
  );
}
