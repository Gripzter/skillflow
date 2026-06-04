"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  canHoverCells?: boolean;
  onCellClick?: (pos: Pos) => void;
  onEdgePlace?: (slot: EdgeSlot) => void;
  onEdgeHover?: (slot: EdgeSlot | null) => void;
};

const P1_MAIN = "#FFFF00";
const P1_EDGE = "#B8A000";
const P2_MAIN = "#FF4444";
const P2_EDGE = "#AA2222";

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
  canHoverCells = false,
  onCellClick,
  onEdgePlace,
  onEdgeHover,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(40);
  const [hoverCell, setHoverCell] = useState<string | null>(null);
  const [bounceP1, setBounceP1] = useState(false);
  const [bounceP2, setBounceP2] = useState(false);
  const prevP1 = useRef(p1Pos);
  const prevP2 = useRef(p2Pos);
  const seenWalls = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    if (prevP1.current.x !== p1Pos.x || prevP1.current.y !== p1Pos.y) {
      setBounceP1(true);
      const t = setTimeout(() => setBounceP1(false), 220);
      prevP1.current = p1Pos;
      return () => clearTimeout(t);
    }
  }, [p1Pos]);

  useEffect(() => {
    if (prevP2.current.x !== p2Pos.x || prevP2.current.y !== p2Pos.y) {
      setBounceP2(true);
      const t = setTimeout(() => setBounceP2(false), 220);
      prevP2.current = p2Pos;
      return () => clearTimeout(t);
    }
  }, [p2Pos]);

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
      <style>{`
        @keyframes blockade-move-glow {
          0%,
          100% {
            box-shadow: 0 0 8px rgba(255, 255, 0, 0.35), inset 0 0 12px rgba(255, 255, 0, 0.12);
          }
          50% {
            box-shadow: 0 0 18px rgba(255, 255, 0, 0.65), inset 0 0 18px rgba(255, 255, 0, 0.22);
          }
        }
        @keyframes blockade-piece-bounce {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(1.15);
          }
          100% {
            transform: scale(1);
          }
        }
        @keyframes blockade-wall-pop {
          0% {
            transform: scale(0);
            opacity: 0.4;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes blockade-bomb-pulse {
          0%,
          100% {
            filter: brightness(1);
            box-shadow: 0 0 6px rgba(255, 120, 0, 0.5);
          }
          50% {
            filter: brightness(1.25);
            box-shadow: 0 0 14px rgba(255, 160, 0, 0.9);
          }
        }
      `}</style>

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
        {/* Goal zone overlays */}
        <div
          className="pointer-events-none absolute left-0 right-0 z-[1]"
          style={{
            top: pad,
            height: cellSize,
            background: "linear-gradient(180deg, rgba(255,255,0,0.22) 0%, transparent 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 z-[1]"
          style={{
            height: cellSize + pad,
            background: "linear-gradient(0deg, rgba(255,68,68,0.22) 0%, transparent 100%)",
          }}
        />

        {/* Sci-fi grid grooves */}
        {Array.from({ length: BOARD_SIZE - 1 }, (_, gi) => (
          <div
            key={`gh-${gi}`}
            className="pointer-events-none absolute"
            style={{
              left: pad,
              top: pad + (gi + 1) * step - groove / 2,
              width: BOARD_SIZE * step - groove,
              height: groove,
              background: "rgba(0, 255, 208, 0.15)",
              boxShadow: "0 0 6px rgba(0, 255, 208, 0.12)",
              zIndex: 1,
            }}
          />
        ))}
        {Array.from({ length: BOARD_SIZE - 1 }, (_, gi) => (
          <div
            key={`gv-${gi}`}
            className="pointer-events-none absolute"
            style={{
              left: pad + (gi + 1) * step - groove / 2,
              top: pad,
              width: groove,
              height: BOARD_SIZE * step - groove,
              background: "rgba(0, 255, 208, 0.15)",
              boxShadow: "0 0 6px rgba(0, 255, 208, 0.12)",
              zIndex: 1,
            }}
          />
        ))}

        {/* Cells */}
        {Array.from({ length: BOARD_SIZE }, (_, logicY) =>
          Array.from({ length: BOARD_SIZE }, (_, x) => {
            const visualRow = logicYToVisualRow(logicY);
            const key = `${x},${logicY}`;
            const isP1 = p1Pos.x === x && p1Pos.y === logicY;
            const isP2 = p2Pos.x === x && p2Pos.y === logicY;
            const hl = highlightSet.has(key);
            const isHovered = hoverCell === key;
            const isP1Goal = logicY === P1_GOAL_ROW;
            const isP2Goal = logicY === P2_GOAL_ROW;

            return (
              <button
                key={key}
                type="button"
                onClick={() => onCellClick?.({ x, y: logicY })}
                onMouseEnter={() => canHoverCells && setHoverCell(key)}
                onMouseLeave={() => setHoverCell((c) => (c === key ? null : c))}
                className="absolute rounded-sm border transition-colors duration-150"
                style={{
                  left: pad + x * step,
                  top: pad + visualRow * step,
                  width: cellSize,
                  height: cellSize,
                  zIndex: 2,
                  borderColor: isP1Goal
                    ? "rgba(255,255,0,0.35)"
                    : isP2Goal
                      ? "rgba(255,68,68,0.35)"
                      : "rgba(0, 255, 208, 0.08)",
                  background: isHovered && canHoverCells
                    ? "rgba(0, 255, 208, 0.12)"
                    : hl
                      ? "rgba(255, 255, 0, 0.14)"
                      : "rgba(22, 22, 30, 0.65)",
                  animation: hl ? "blockade-move-glow 1.6s ease-in-out infinite" : undefined,
                }}
              >
                {isP1 && <Piece color="yellow" bounce={bounceP1} />}
                {isP2 && <Piece color="red" bounce={bounceP2} />}
              </button>
            );
          })
        )}

        {/* Placed walls */}
        {displayWalls.map((wall) => {
          const isP1 = wall.owner === "player1";
          const isPreview = wall.id === "preview";
          const main = isPreview
            ? wallPreviewValid
              ? "#22c55e"
              : "#ef4444"
            : isP1
              ? P1_MAIN
              : P2_MAIN;
          const edge = isPreview
            ? wallPreviewValid
              ? "#15803d"
              : "#991b1b"
            : isP1
              ? P1_EDGE
              : P2_EDGE;
          const isNew = !isPreview && !seenWalls.current.has(wall.id);
          if (!isPreview) seenWalls.current.add(wall.id);

          const countdown =
            wall.isBomb && wall.expiresAtTurn !== undefined
              ? Math.max(0, wall.expiresAtTurn - turnNumber)
              : null;

          return getWallBarRects(wall, metrics).map((bar, bi) => (
            <div
              key={`${wall.id}-${bi}`}
              className="pointer-events-none absolute rounded-sm"
              style={{
                left: bar.left,
                top: bar.top,
                width: bar.width,
                height: bar.height,
                background: `linear-gradient(180deg, ${main} 0%, ${edge} 100%)`,
                boxShadow: `0 2px 4px rgba(0,0,0,0.45), 0 0 8px ${main}55`,
                zIndex: 5,
                animation: isNew
                  ? "blockade-wall-pop 0.15s ease-out forwards"
                  : wall.isBomb && !isPreview
                    ? "blockade-bomb-pulse 1.2s ease-in-out infinite"
                    : undefined,
              }}
            >
              {countdown !== null && countdown > 0 && bi === 0 && (
                <span
                  className="absolute -right-1 -top-3 flex h-4 min-w-4 items-center justify-center rounded bg-black/80 px-0.5 text-[9px] font-bold text-orange-300"
                  style={{ textShadow: "0 0 6px rgba(255,160,0,0.8)" }}
                >
                  {countdown}
                </span>
              )}
            </div>
          ));
        })}

        {/* Edge hit zones */}
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

function Piece({ color, bounce }: { color: "yellow" | "red"; bounce: boolean }) {
  const main = color === "yellow" ? P1_MAIN : P2_MAIN;
  const edge = color === "yellow" ? "#E6D800" : "#CC3333";
  const glow = color === "yellow" ? "rgba(255,255,0,0.55)" : "rgba(255,68,68,0.55)";

  return (
    <>
      <span
        className="pointer-events-none absolute inset-[18%] rounded-full opacity-50 blur-md"
        style={{ background: glow }}
      />
      <span
        className="absolute inset-[15%] rounded-full"
        style={{
          background: `radial-gradient(circle at 35% 30%, ${main} 0%, ${edge} 70%, #1a1a1a 100%)`,
          boxShadow: `0 4px 10px rgba(0,0,0,0.5), 0 0 14px ${glow}`,
          animation: bounce ? "blockade-piece-bounce 0.2s ease-out" : undefined,
        }}
      />
    </>
  );
}
