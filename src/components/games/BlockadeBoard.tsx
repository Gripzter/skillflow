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
  getWallBarRect,
  listPlaceableEdgeSlots,
  wallThickness,
  type BoardMetrics,
  type EdgeSlot,
} from "@/lib/games/blockade-wall-visual";

type Props = {
  p1Pos: Pos;
  p2Pos: Pos;
  walls: BlockadeWall[];
  highlightMoves?: Pos[];
  wallPreview?: { x: number; y: number; orientation: "horizontal" | "vertical" } | null;
  wallPreviewValid?: boolean;
  wallMode?: boolean;
  onCellClick?: (pos: Pos) => void;
  onEdgePlace?: (slot: EdgeSlot) => void;
  onEdgeHover?: (slot: EdgeSlot | null) => void;
};

const P1_COLOR = "#FFFF00";
const P2_COLOR = "#FF4444";

export default function BlockadeBoard({
  p1Pos,
  p2Pos,
  walls,
  highlightMoves = [],
  wallPreview,
  wallPreviewValid = true,
  wallMode = false,
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
    if (wallPreview) list.push({ ...wallPreview, id: "preview", owner: "player1" });
    return list;
  }, [walls, wallPreview]);

  const edgeSlots = useMemo(() => listPlaceableEdgeSlots(), []);

  return (
    <div ref={containerRef} className="w-full max-w-full">
      <div
        className="relative mx-auto overflow-hidden rounded-xl"
        style={{
          width,
          height,
          maxWidth: "100%",
          background: "linear-gradient(165deg, #0A0A14 0%, #12121F 55%, #0D0D18 100%)",
          boxShadow: "0 0 0 1px rgba(0, 255, 208, 0.2), 0 0 24px rgba(0, 255, 208, 0.08)",
        }}
      >
        <div
          className="pointer-events-none absolute left-0 right-0 z-[1]"
          style={{
            top: pad,
            height: cellSize,
            background: "linear-gradient(180deg, rgba(255,68,68,0.2) 0%, transparent 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 z-[1]"
          style={{
            height: cellSize + pad,
            background: "linear-gradient(0deg, rgba(255,255,0,0.2) 0%, transparent 100%)",
          }}
        />

        {Array.from({ length: BOARD_SIZE }, (_, y) =>
          Array.from({ length: BOARD_SIZE }, (_, x) => {
            const key = `${x},${y}`;
            const isP1 = p1Pos.x === x && p1Pos.y === y;
            const isP2 = p2Pos.x === x && p2Pos.y === y;
            const hl = highlightSet.has(key);
            const isP1Goal = y === P1_GOAL_ROW;
            const isP2Goal = y === P2_GOAL_ROW;

            return (
              <button
                key={key}
                type="button"
                onClick={() => onCellClick?.({ x, y })}
                className="absolute rounded-sm border transition-colors duration-150"
                style={{
                  left: pad + x * step,
                  top: pad + y * step,
                  width: cellSize,
                  height: cellSize,
                  zIndex: 2,
                  borderColor: isP1Goal
                    ? "rgba(255,255,0,0.35)"
                    : isP2Goal
                      ? "rgba(255,68,68,0.35)"
                      : "rgba(0, 255, 208, 0.08)",
                  background: hl ? "rgba(255, 255, 0, 0.14)" : "rgba(22, 22, 30, 0.65)",
                  animation: hl ? "blockade-move-glow 1.6s ease-in-out infinite" : undefined,
                }}
              >
                {isP1 && <Piece color={P1_COLOR} />}
                {isP2 && <Piece color={P2_COLOR} />}
              </button>
            );
          })
        )}

        {displayWalls.map((wall) => {
          const isPreview = wall.id === "preview";
          const color = isPreview
            ? wallPreviewValid
              ? "#22c55e"
              : "#ef4444"
            : wall.owner === "player1"
              ? P1_COLOR
              : P2_COLOR;
          const bar = getWallBarRect(wall, metrics);
          return (
            <div
              key={wall.id}
              className="pointer-events-none absolute rounded-sm"
              style={{
                left: bar.left,
                top: bar.top,
                width: bar.width,
                height: bar.height,
                background: `linear-gradient(180deg, ${color} 0%, ${color}99 100%)`,
                boxShadow: `0 2px 4px rgba(0,0,0,0.45), 0 0 8px ${color}55`,
                zIndex: 5,
              }}
            />
          );
        })}

        {wallMode &&
          edgeSlots.map((slot) => {
            const hit = edgeSlotHitRect(slot, metrics);
            return (
              <button
                key={slot.key}
                type="button"
                className="absolute z-20 cursor-crosshair bg-transparent hover:bg-[#00FFD0]/10"
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
              />
            );
          })}
      </div>

      {wallMode && wallPreview && !wallPreviewValid && (
        <p className="mt-2 text-center text-xs font-medium text-red-400">Invalid — would block a path</p>
      )}

      <style>{`
        @keyframes blockade-move-glow {
          0%, 100% { box-shadow: 0 0 8px rgba(255, 255, 0, 0.35); }
          50% { box-shadow: 0 0 18px rgba(255, 255, 0, 0.65); }
        }
      `}</style>
    </div>
  );
}

function Piece({ color }: { color: string }) {
  return (
    <span
      className="absolute inset-[15%] rounded-full"
      style={{
        background: `radial-gradient(circle at 35% 30%, ${color} 0%, ${color}99 70%)`,
        boxShadow: `0 4px 10px rgba(0,0,0,0.5), 0 0 14px ${color}88`,
      }}
    />
  );
}
