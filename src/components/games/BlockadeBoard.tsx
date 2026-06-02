"use client";

import { useMemo } from "react";
import {
  BOARD_SIZE,
  type BlockadeRole,
  type BlockadeWall,
  type Pos,
} from "@/lib/games/blockade-logic";
import { getBlockedEdges } from "@/lib/games/blockade-bfs";

type Props = {
  p1Pos: Pos;
  p2Pos: Pos;
  walls: BlockadeWall[];
  turnNumber: number;
  highlightMoves?: Pos[];
  wallPreview?: BlockadeWall | null;
  wallPreviewValid?: boolean;
  onCellClick?: (pos: Pos) => void;
  onEdgeClick?: (row: number, col: number, orientation: "h" | "v") => void;
  cellSize?: number;
};

const P1_COLOR = "#FFFF00";
const P2_COLOR = "#FF6B6B";

export default function BlockadeBoard({
  p1Pos,
  p2Pos,
  walls,
  turnNumber,
  highlightMoves = [],
  wallPreview,
  wallPreviewValid = true,
  onCellClick,
  cellSize = 44,
}: Props) {
  const gap = 4;
  const pad = 12;
  const size = BOARD_SIZE * cellSize + (BOARD_SIZE - 1) * gap + pad * 2;

  const highlightSet = useMemo(
    () => new Set(highlightMoves.map((p) => `${p.x},${p.y}`)),
    [highlightMoves]
  );

  const displayWalls = useMemo(() => {
    const list = [...walls];
    if (wallPreview) list.push({ ...wallPreview, id: "preview" });
    return list;
  }, [walls, wallPreview]);

  return (
    <div
      className="relative rounded-lg border border-[#2A3A5C] bg-[#1A1A2E]"
      style={{ width: size, height: size, padding: pad }}
    >
      {/* Goal row tints */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 opacity-25"
        style={{ height: cellSize + pad, background: P1_COLOR }}
        title="Player 1 goal row"
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 opacity-25"
        style={{ height: cellSize + pad, background: P2_COLOR }}
        title="Player 2 goal row"
      />

      <svg
        className="pointer-events-none absolute inset-0"
        width={size}
        height={size}
        style={{ padding: pad }}
      >
        {displayWalls.map((wall) => (
          <WallSegments
            key={wall.id}
            wall={wall}
            cellSize={cellSize}
            gap={gap}
            turnNumber={turnNumber}
            isPreview={wall.id === "preview"}
            invalid={wall.id === "preview" && !wallPreviewValid}
          />
        ))}
      </svg>

      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${BOARD_SIZE}, ${cellSize}px)`,
          gap,
        }}
      >
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => {
          const x = i % BOARD_SIZE;
          const y = BOARD_SIZE - 1 - Math.floor(i / BOARD_SIZE);
          const key = `${x},${y}`;
          const isP1 = p1Pos.x === x && p1Pos.y === y;
          const isP2 = p2Pos.x === x && p2Pos.y === y;
          const hl = highlightSet.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onCellClick?.({ x, y })}
              className={`relative rounded-sm border border-white/10 transition-colors ${
                hl ? "bg-[#FFFF00]/25 ring-1 ring-[#FFFF00]/60" : "bg-[#16161e]"
              }`}
              style={{ width: cellSize, height: cellSize }}
            >
              {isP1 && <Piece color={P1_COLOR} />}
              {isP2 && <Piece color={P2_COLOR} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Piece({ color }: { color: string }) {
  return (
    <span
      className="absolute inset-1 rounded-full"
      style={{
        background: color,
        boxShadow: `0 0 12px ${color}88`,
      }}
    />
  );
}

function WallSegments({
  wall,
  cellSize,
  gap,
  turnNumber,
  isPreview,
  invalid,
}: {
  wall: BlockadeWall;
  cellSize: number;
  gap: number;
  turnNumber: number;
  isPreview?: boolean;
  invalid?: boolean;
}) {
  const edges = getBlockedEdges(wall);
  const ownerColor = wall.owner === "player1" ? P1_COLOR : P2_COLOR;
  const stroke = isPreview ? (invalid ? "#ef4444" : "#22c55e") : ownerColor;
  const opacity = isPreview ? 0.55 : 0.95;
  const countdown =
    wall.isBomb && wall.expiresAtTurn !== undefined
      ? Math.max(0, wall.expiresAtTurn - turnNumber)
      : null;

  const toPx = (p: { x: number; y: number }) => {
    const gridY = BOARD_SIZE - 1 - p.y;
    return {
      cx: p.x * (cellSize + gap) + cellSize / 2,
      cy: gridY * (cellSize + gap) + cellSize / 2,
    };
  };

  return (
    <g opacity={opacity}>
      {edges.map(([a, b], i) => {
        const p1 = toPx(a);
        const p2 = toPx(b);
        const mx = (p1.cx + p2.cx) / 2;
        const my = (p1.cy + p2.cy) / 2;
        return (
          <line
            key={`${wall.id}-${i}`}
            x1={p1.cx}
            y1={p1.cy}
            x2={p2.cx}
            y2={p2.cy}
            stroke={stroke}
            strokeWidth={wall.type === "triple" ? 6 : 4}
            strokeLinecap="round"
          />
        );
      })}
      {countdown !== null && countdown > 0 && edges[0] && (
        <text
          x={toPx(edges[0][0]).cx}
          y={toPx(edges[0][0]).cy}
          fill="#fff"
          fontSize={10}
          textAnchor="middle"
          className={wall.isBomb ? "animate-pulse" : ""}
        >
          {countdown}
        </text>
      )}
    </g>
  );
}
