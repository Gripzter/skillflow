"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BOARD_SIZE,
  P1_GOAL_ROW,
  P2_GOAL_ROW,
  type BlockadeWall,
  type Pos,
} from "@/lib/games/blockade-logic";
import {
  boardPixelSize,
  edgeSlotHitRect,
  getWallBarRects,
  listPlaceableEdgeSlots,
  wallThickness,
  type BoardMetrics,
  type EdgeSlot,
} from "@/lib/games/blockade-wall-visual";

type Props = {
  p1Pos: Pos;
  p2Pos: Pos;
  walls: BlockadeWall[];
  turnNumber: number;
  highlightMoves?: Pos[];
  wallPreview?: BlockadeWall | null;
  wallPreviewValid?: boolean;
  wallMode?: boolean;
  wallType?: "standard" | "lshape" | "triple";
  onCellClick?: (pos: Pos) => void;
  onEdgePlace?: (slot: EdgeSlot) => void;
  onEdgeHover?: (slot: EdgeSlot | null) => void;
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
  wallMode = false,
  wallType = "standard",
  onCellClick,
  onEdgePlace,
  onEdgeHover,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(40);
  const groove = cellSize >= 36 ? 8 : 6;
  const pad = 10;

  const metrics: BoardMetrics = useMemo(
    () => ({ cellSize, groove, pad }),
    [cellSize, groove, pad]
  );

  const { width, height } = useMemo(() => boardPixelSize(metrics), [metrics]);
  const thick = wallThickness(metrics);
  const step = cellSize + groove;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const inner = w - pad * 2;
      const cs = Math.floor((inner - groove * (BOARD_SIZE - 1)) / BOARD_SIZE);
      setCellSize(Math.max(28, Math.min(cs, 52)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [groove, pad]);

  const highlightSet = useMemo(
    () => new Set(highlightMoves.map((p) => `${p.x},${p.y}`)),
    [highlightMoves]
  );

  const displayWalls = useMemo(() => {
    const list = [...walls];
    if (wallPreview) list.push({ ...wallPreview, id: "preview" });
    return list;
  }, [walls, wallPreview]);

  const edgeSlots = useMemo(() => listPlaceableEdgeSlots(wallType), [wallType]);

  const logicYToVisualRow = (logicY: number) => BOARD_SIZE - 1 - logicY;

  return (
    <div ref={containerRef} className="w-full max-w-full">
      <div
        className="relative mx-auto rounded-lg border border-[#2A3A5C] bg-[#1A1A2E]"
        style={{ width, height, maxWidth: "100%" }}
      >
        {/* Cells */}
        {Array.from({ length: BOARD_SIZE }, (_, logicY) =>
          Array.from({ length: BOARD_SIZE }, (_, x) => {
            const visualRow = logicYToVisualRow(logicY);
            const key = `${x},${logicY}`;
            const isP1 = p1Pos.x === x && p1Pos.y === logicY;
            const isP2 = p2Pos.x === x && p2Pos.y === logicY;
            const hl = highlightSet.has(key);
            const isP1Goal = logicY === P1_GOAL_ROW;
            const isP2Goal = logicY === P2_GOAL_ROW;

            return (
              <button
                key={key}
                type="button"
                onClick={() => onCellClick?.({ x, y: logicY })}
                className={`absolute rounded-sm border transition-colors ${
                  isP1Goal
                    ? "border-[#FFFF00]/50 bg-[#FFFF00]/15"
                    : isP2Goal
                      ? "border-[#FF6B6B]/50 bg-[#FF6B6B]/15"
                      : "border-white/[0.08] bg-[#16161e]"
                } ${hl ? "animate-pulse bg-[#FFFF00]/25 ring-1 ring-[#FFFF00]/40" : ""}`}
                style={{
                  left: pad + x * step,
                  top: pad + visualRow * step,
                  width: cellSize,
                  height: cellSize,
                  zIndex: 2,
                }}
              >
                {isP1 && <Piece color={P1_COLOR} />}
                {isP2 && <Piece color={P2_COLOR} />}
              </button>
            );
          })
        )}

        {/* Groove grid lines (subtle) */}
        {Array.from({ length: BOARD_SIZE - 1 }, (_, gi) => (
          <div
            key={`gh-${gi}`}
            className="pointer-events-none absolute bg-white/[0.06]"
            style={{
              left: pad,
              top: pad + (gi + 1) * step - groove / 2,
              width: BOARD_SIZE * step - groove,
              height: groove,
              zIndex: 1,
            }}
          />
        ))}
        {Array.from({ length: BOARD_SIZE - 1 }, (_, gi) => (
          <div
            key={`gv-${gi}`}
            className="pointer-events-none absolute bg-white/[0.06]"
            style={{
              left: pad + (gi + 1) * step - groove / 2,
              top: pad,
              width: groove,
              height: BOARD_SIZE * step - groove,
              zIndex: 1,
            }}
          />
        ))}

        {/* Placed walls — edge bars */}
        {displayWalls.map((wall) => {
          const ownerColor = wall.owner === "player1" ? P1_COLOR : P2_COLOR;
          const isPreview = wall.id === "preview";
          const color = isPreview
            ? wallPreviewValid
              ? "#22c55e"
              : "#ef4444"
            : ownerColor;
          const opacity = isPreview ? 0.85 : 0.7;
          const countdown =
            wall.isBomb && wall.expiresAtTurn !== undefined
              ? Math.max(0, wall.expiresAtTurn - turnNumber)
              : null;

          return getWallBarRects(wall, metrics).map((bar, bi) => (
            <div
              key={`${wall.id}-${bi}`}
              className={`pointer-events-none absolute rounded-sm ${wall.isBomb && !isPreview ? "animate-pulse" : ""}`}
              style={{
                left: bar.left,
                top: bar.top,
                width: bar.width,
                height: bar.height,
                background: color,
                opacity,
                boxShadow: `0 0 6px ${color}66`,
                zIndex: 5,
              }}
            >
              {countdown !== null && countdown > 0 && bi === 0 && (
                <span className="absolute -right-1 -top-3 text-[9px] font-bold text-white">
                  {countdown}
                </span>
              )}
            </div>
          ));
        })}

        {/* Edge hit zones (wall mode) */}
        {wallMode &&
          edgeSlots.map((slot) => {
            const hit = edgeSlotHitRect(slot, metrics);
            return (
              <button
                key={slot.key}
                type="button"
                className="absolute z-20 cursor-crosshair bg-transparent hover:bg-white/[0.06]"
                style={{
                  left: hit.left,
                  top: hit.top,
                  width: hit.width,
                  height: hit.height,
                }}
                onMouseEnter={() => onEdgeHover?.(slot)}
                onMouseLeave={() => onEdgeHover?.(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdgePlace?.(slot);
                }}
                aria-label={`Place wall ${slot.orientation} ${slot.row} ${slot.col}`}
              />
            );
          })}
      </div>

      {wallMode && wallPreview && !wallPreviewValid && (
        <p className="mt-2 text-center text-xs font-medium text-red-400">Invalid — would block a path</p>
      )}
    </div>
  );
}

function Piece({ color }: { color: string }) {
  return (
    <span
      className="absolute inset-[15%] rounded-full"
      style={{
        background: color,
        boxShadow: `0 0 10px ${color}99`,
      }}
    />
  );
}
