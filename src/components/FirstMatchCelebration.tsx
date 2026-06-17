"use client";

import { useEffect, useMemo, useState } from "react";
import SkilliesIcon from "@/components/SkilliesIcon";

interface FirstMatchCelebrationProps {
  earnedSkillies: number;
  gameSlug: string;
  onClose: () => void;
}

const AUTO_CLOSE_MS = 8000;
const CONFETTI_DOTS = 28;

export default function FirstMatchCelebration({
  earnedSkillies,
  gameSlug,
  onClose,
}: FirstMatchCelebrationProps) {
  const [displaySkillies, setDisplaySkillies] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 1100;
    let raf = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplaySkillies(Math.round(earnedSkillies * progress));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [earnedSkillies]);

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
      <div className="first-match-pop relative w-full max-w-2xl overflow-hidden rounded-2xl border border-yellow-300/35 bg-[#0E111B] p-6 shadow-[0_0_60px_rgba(255, 255, 0, 0.22)] md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255, 255, 0, 0.14),transparent_60%)]" />

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
          <h2 className="mt-1 text-3xl font-black tracking-tight text-white md:text-5xl">
            FIRST MATCH COMPLETE! 🎉
          </h2>
          <p className="mt-3 text-sm text-gray-300 md:text-base">
            You just earned your first Skillies. Keep playing to win more.
          </p>
          <p className="mt-5 text-4xl font-black text-yellow-300 md:text-6xl">
            +{displaySkillies.toLocaleString()} Skillies <SkilliesIcon size={28} />
          </p>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                window.location.href = `/play/${gameSlug}`;
              }}
              className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-yellow-400"
            >
              Play Again
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                window.location.href = "/play";
              }}
              className="rounded-xl border border-yellow-300/40 bg-yellow-500/10 px-4 py-3 text-sm font-bold text-yellow-100 transition hover:bg-yellow-500/20"
            >
              Back to Play
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .first-match-pop {
          animation: popIn 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
          transform-origin: center;
        }
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
          background: #FFFF00;
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
        @keyframes popIn {
          0% {
            opacity: 0;
            transform: scale(0.92);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
