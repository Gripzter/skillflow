"use client";

import { useRef, useCallback } from "react";
import ChessPiece from "./ChessPiece";
import {
  FILES,
  RANKS,
  LIGHT_SQUARE,
  DARK_SQUARE,
  BORDER_COLOR,
  isLightSquare,
  LAST_MOVE_OVERLAY,
  SELECTED_OVERLAY,
  CHECK_OVERLAY,
  indicesToSquare,
} from "@/lib/games/chess-utils";

type PieceCode = string; // "wK", "bQ", etc.

export interface ChessBoardProps {
  /** 8x8, board[rank][file] rank 0 = 8th rank (top) */
  board: (PieceCode | null)[][];
  selectedSquare: string | null;
  legalMoveTargets: string[];
  lastMove: { from: string; to: string } | null;
  checkSquare: string | null;
  squareSize: number;
  onSquareClick: (square: string) => void;
  onPieceDragStart: (square: string, piece: PieceCode, clientX: number, clientY: number) => void;
  onPieceDragMove: (clientX: number, clientY: number) => void;
  onPieceDragEnd: (targetSquare: string | null) => void;
  dragging: { square: string; piece: PieceCode; x: number; y: number } | null;
  /** Current turn: "w" | "b" - only that side's pieces are movable */
  turn: "w" | "b";
  /** When true, render board flipped (black at bottom) for player2 */
  flipped?: boolean;
}

export default function ChessBoard({
  board,
  selectedSquare,
  legalMoveTargets,
  lastMove,
  checkSquare,
  squareSize,
  onSquareClick,
  onPieceDragStart,
  onPieceDragMove,
  onPieceDragEnd,
  dragging,
  turn,
  flipped = false,
}: ChessBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const displayRows = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const displayCols = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, square: string, piece: PieceCode | null) => {
      e.preventDefault();
      if (piece) {
        const color = piece[0] as "w" | "b";
        if (color === turn) {
          onPieceDragStart(square, piece, e.clientX, e.clientY);
        }
      }
      onSquareClick(square);
    },
    [turn, onSquareClick, onPieceDragStart]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragging) {
        e.preventDefault();
        onPieceDragMove(e.clientX, e.clientY);
      }
    },
    [dragging, onPieceDragMove]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      e.preventDefault();
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-square]");
      const targetSquare = target?.getAttribute("data-square") ?? null;
      onPieceDragEnd(targetSquare);
    },
    [dragging, onPieceDragEnd]
  );

  const handlePointerLeave = useCallback(() => {
    if (dragging) onPieceDragEnd(null);
  }, [dragging, onPieceDragEnd]);

  const getSquareRect = useCallback(() => {
    if (!boardRef.current) return null;
    return boardRef.current.getBoundingClientRect();
  }, []);

  return (
    <div
      ref={boardRef}
      className="relative inline-block select-none touch-none"
      style={{
        border: `4px solid ${BORDER_COLOR}`,
        borderRadius: 4,
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerUp}
    >
      {/* Board grid */}
      <div className="flex flex-col" style={{ width: 20 + squareSize * 8, height: squareSize * 8 + 24 }}>
        {displayRows.map((displayRowIdx, rowIdx) => {
          const boardRow = displayRows[rowIdx];
          const boardColBase = displayCols[0];
          return (
          <div key={boardRow} className="flex">
            {/* Rank label (left side) */}
            <div
              className="flex items-center justify-end pr-1 font-bold"
              style={{
                width: 20,
                minWidth: 20,
                height: squareSize,
                fontSize: 11,
                color: isLightSquare(0, boardRow) ? DARK_SQUARE : LIGHT_SQUARE,
              }}
            >
              {RANKS[boardRow]}
            </div>
            {displayCols.map((displayColIdx, colIdx) => {
              const boardCol = displayCols[colIdx];
              const square = indicesToSquare(boardCol, boardRow);
              const piece = board[boardRow]?.[boardCol] ?? null;
              const isLight = isLightSquare(boardCol, boardRow);
              const isSelected = selectedSquare === square;
              const isLegal = legalMoveTargets.includes(square);
              const isCapture = isLegal && piece !== null;
              const isLastFrom = lastMove?.from === square;
              const isLastTo = lastMove?.to === square;
              const isCheck = checkSquare === square;

              return (
                <div
                  key={square}
                  data-square={square}
                  className="relative flex cursor-pointer items-center justify-center transition-colors hover:brightness-95"
                  style={{
                    width: squareSize,
                    height: squareSize,
                    backgroundColor: isLight ? LIGHT_SQUARE : DARK_SQUARE,
                  }}
                  onPointerDown={(e) => handlePointerDown(e, square, piece)}
                >
                  {/* Last move highlight */}
                  {(isLastFrom || isLastTo) && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{ backgroundColor: LAST_MOVE_OVERLAY }}
                    />
                  )}
                  {/* Selected highlight */}
                  {isSelected && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{ backgroundColor: SELECTED_OVERLAY }}
                    />
                  )}
                  {/* Check highlight */}
                  {isCheck && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{ backgroundColor: CHECK_OVERLAY }}
                    />
                  )}
                  {/* Legal move: dot or capture ring */}
                  {isLegal && !isCapture && (
                    <div
                      className="absolute inset-0 pointer-events-none flex items-center justify-center"
                      aria-hidden
                    >
                      <div
                        className="rounded-full bg-teal/50"
                        style={{ width: squareSize * 0.25, height: squareSize * 0.25 }}
                      />
                    </div>
                  )}
                  {isLegal && isCapture && (
                    <div
                      className="absolute inset-0 pointer-events-none rounded-sm border-2 border-teal/70"
                      style={{ borderWidth: Math.max(2, squareSize * 0.15) }}
                      aria-hidden
                    />
                  )}
                  {/* Piece */}
                  {piece && !(dragging?.square === square) && (
                    <div className="relative z-[1] cursor-grab active:cursor-grabbing">
                      <ChessPiece piece={piece} squareSize={squareSize} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );})}
        {/* File labels */}
        <div className="flex" style={{ height: 24 }}>
          <div style={{ width: 20, minWidth: 20 }} />
          {displayCols.map((boardCol) => (
            <div
              key={boardCol}
              className="flex items-center justify-center font-bold"
              style={{
                width: squareSize,
                height: 24,
                fontSize: 11,
                color: isLightSquare(boardCol, flipped ? 0 : 7) ? DARK_SQUARE : LIGHT_SQUARE,
              }}
            >
              {FILES[boardCol]}
            </div>
          ))}
        </div>
      </div>

      {/* Dragging piece overlay */}
      {dragging && (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            left: dragging.x - squareSize / 2,
            top: dragging.y - squareSize / 2,
          }}
        >
          <ChessPiece piece={dragging.piece} squareSize={squareSize} isDragging />
        </div>
      )}
    </div>
  );
}
