"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess as ChessEngine } from "chess.js";
import ChessBoard from "@/components/games/chess/ChessBoard";

type MoveLogEntry = {
  player_id: string;
  action: Record<string, unknown>;
  timestamp_ms: number;
};

const SPEEDS = [0.5, 1, 2, 4] as const;

function toChessMove(action: Record<string, unknown>): { san?: string; from?: string; to?: string; promotion?: string } | null {
  const type = action.type;
  if (type !== "chess_move") return null;
  const san = typeof action.san === "string" ? action.san : undefined;
  const from = typeof action.from === "string" ? action.from : undefined;
  const to = typeof action.to === "string" ? action.to : undefined;
  const promotion = typeof action.promotion === "string" ? action.promotion : undefined;
  if (!san && (!from || !to)) return null;
  return { san, from, to, promotion };
}

export default function ChessReplayViewer({ moveLog }: { moveLog: MoveLogEntry[] }) {
  const chessMoves = useMemo(
    () =>
      moveLog
        .map((m) => ({ ...m, parsed: toChessMove(m.action) }))
        .filter((m): m is MoveLogEntry & { parsed: { san?: string; from?: string; to?: string; promotion?: string } } => !!m.parsed),
    [moveLog]
  );

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const game = useMemo(() => {
    const g = new ChessEngine();
    for (let i = 0; i < index; i += 1) {
      const mv = chessMoves[i]?.parsed;
      if (!mv) continue;
      try {
        if (mv.san) g.move(mv.san);
        else if (mv.from && mv.to) g.move({ from: mv.from, to: mv.to, promotion: mv.promotion as "q" | "r" | "b" | "n" | undefined });
      } catch {
        break;
      }
    }
    return g;
  }, [chessMoves, index]);

  const board = useMemo(() => game.board().map((row) => row.map((cell) => (cell ? `${cell.color}${cell.type}` : null))), [game]);
  const turn = game.turn();
  const lastMove = useMemo(() => {
    if (index <= 0 || index - 1 >= chessMoves.length) return null;
    const mv = chessMoves[index - 1].parsed;
    if (mv.from && mv.to) return { from: mv.from, to: mv.to };
    return null;
  }, [index, chessMoves]);

  useEffect(() => {
    if (!playing) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const intervalMs = Math.max(120, Math.round(1000 / speed));
    timerRef.current = setInterval(() => {
      setIndex((prev) => {
        if (prev >= chessMoves.length) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [playing, speed, chessMoves.length]);

  useEffect(() => {
    if (index >= chessMoves.length) setPlaying(false);
  }, [index, chessMoves.length]);

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="rounded border border-white/20 px-2.5 py-1 text-xs text-white hover:bg-white/10"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="rounded border border-white/20 px-2.5 py-1 text-xs text-white hover:bg-white/10"
        >
          Step Back
        </button>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(chessMoves.length, i + 1))}
          className="rounded border border-white/20 px-2.5 py-1 text-xs text-white hover:bg-white/10"
        >
          Step Forward
        </button>
        <span className="ml-1 text-xs text-[#9CA3AF]">
          Move {Math.min(index, chessMoves.length)} / {chessMoves.length}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[#9CA3AF]">Speed</span>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value) as (typeof SPEEDS)[number])}
            className="rounded border border-white/20 bg-transparent px-2 py-1 text-xs text-white"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s} className="bg-[#111]">
                {s}x
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[340px]">
        <ChessBoard
          board={board as (string | null)[][]}
          selectedSquare={null}
          legalMoveTargets={[]}
          lastMove={lastMove}
          checkSquare={null}
          squareSize={38}
          onSquareClick={() => {}}
          onPieceDragStart={() => {}}
          onPieceDragMove={() => {}}
          onPieceDragEnd={() => {}}
          dragging={null}
          turn={turn}
          flipped={false}
          showCoordinates={true}
        />
      </div>
    </div>
  );
}
