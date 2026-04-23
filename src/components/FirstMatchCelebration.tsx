"use client";

import { useEffect, useMemo, useState } from "react";
import RankProgressBar from "@/components/RankProgressBar";
import type { RankTier } from "@/lib/skillpoints";

interface FirstMatchCelebrationProps {
  earnedSp: number;
  lifetimeSp: number;
  rankTier: RankTier;
  gameSlug: string;
  onClose: () => void;
}

const AUTO_CLOSE_MS = 5000;
const CONFETTI_DOTS = 28;

export default function FirstMatchCelebration({
  earnedSp,
  lifetimeSp,
  rankTier,
  gameSlug,
  onClose,
}: FirstMatchCelebrationProps) {
  const [displaySp, setDisplaySp] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 1100;
    let raf = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplaySp(Math.round(earnedSp * progress));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [earnedSp]);

  useEffect(() => {
    const timeout = window.setTimeout(onClose, AUTO_CLOSE_MS);
    return () => window.clearTimeout(timeout);
  }, [onClose]);

  const dots = useMemo(
    () =>
      Array.from({ length: CONFETTI_DOTS }).map((_, idx) => {
        const angle = (Math.PI * 2 * idx) / CONFETTI_DOTS;
        const distance = 90 + (idx % 7) * 16;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        const delay = (idx % 8) * 45;
        const size = 5 + (idx % 4);
        return { idx, x, y, delay, size };
      }),
    []
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#06070D]/92 px-4">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-orange-300/35 bg-[#0E111B] p-6 shadow-[0_0_60px_rgba(255,94,0,0.22)] md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,94,0,0.14),transparent_60%)]" />

        <div className="confetti-burst pointer-events-none absolute left-1/2 top-1/2">
          {dots.map((dot) => (
            <span
              key={dot.idx}
              className="dot"
              style={
                {
                  "--dx": `${dot.x}px`,
                  "--dy": `${dot.y}px`,
                  width: `${dot.size}px`,
                  height: `${dot.size}px`,
                  animationDelay: `${dot.delay}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        <div className="relative text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-200/90">
            First Match Complete!
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
            FIRST MATCH COMPLETE!
          </h2>
          <p className="mt-5 text-4xl font-black text-orange-300 md:text-6xl">
            +{displaySp.toLocaleString()} SP
          </p>
          <p className="mt-2 text-sm text-gray-300">Your Founders journey has begun.</p>

          <div className="mt-7 rounded-xl border border-white/10 bg-black/20 p-4">
            <RankProgressBar lifetimeSp={lifetimeSp} currentTier={rankTier} />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                window.location.href = `/play/${gameSlug}`;
              }}
              className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-400"
            >
              Play Again
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                window.location.href = "/cases";
              }}
              className="rounded-xl border border-orange-300/40 bg-orange-500/10 px-4 py-3 text-sm font-bold text-orange-100 transition hover:bg-orange-500/20"
            >
              Open a Case
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .dot {
          position: absolute;
          left: 0;
          top: 0;
          border-radius: 999px;
          background: #ff9b54;
          box-shadow: 0 0 10px rgba(255, 155, 84, 0.55);
          opacity: 0;
          transform: translate3d(0, 0, 0) scale(0.7);
          animation: burst 1200ms cubic-bezier(0.15, 0.78, 0.22, 1) forwards;
        }

        .dot:nth-child(3n) {
          background: #ffd166;
        }

        .dot:nth-child(4n) {
          background: #ffffff;
        }

        .dot:nth-child(5n) {
          background: #ff5e00;
        }

        @keyframes burst {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) scale(0.6);
          }
          15% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--dx), var(--dy), 0) scale(1.05);
          }
        }
      `}</style>
    </div>
  );
}
