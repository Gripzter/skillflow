"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";

const AUTO_REDIRECT_SEC = 30;

interface GameResultOverlayProps {
  outcome: "victory" | "defeat" | "draw";
  isPractice: boolean;
  stakeAmount: number;
  winnerPayout: number;
  payoutOverride?: number;
  stakeLostOverride?: number;
  newBalance?: number | null;
  gameType: string;
  opponentUsername: string;
  wonByForfeit?: boolean;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export default function GameResultOverlay({
  outcome,
  isPractice,
  stakeAmount,
  winnerPayout,
  payoutOverride,
  stakeLostOverride,
  opponentUsername,
  wonByForfeit,
  onPlayAgain,
  onLeave,
}: GameResultOverlayProps) {
  const [countdown, setCountdown] = useState(AUTO_REDIRECT_SEC);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (outcome !== "victory") return;

    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
      colors: ["#FFFF00", "#ffffff", "#aaaaaa"],
      scalar: 0.9,
      gravity: 1.4,
      zIndex: 60,
    });
  }, [outcome]);

  useEffect(() => {
    const t = setInterval(() => {
      if (cancelledRef.current) return;
      setCountdown((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(t);
          window.location.href = "/play";
        }
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const handlePlayAgain = useCallback(() => {
    cancelledRef.current = true;
    onPlayAgain();
  }, [onPlayAgain]);

  const handleLeave = useCallback(() => {
    cancelledRef.current = true;
    onLeave();
  }, [onLeave]);

  const isVictory = outcome === "victory";
  const isDefeat = outcome === "defeat";
  const isDraw = outcome === "draw";

  let headline: string;
  let headlineClass: string;
  let resultLine: string;

  if (isVictory) {
    headline = "YOU WIN";
    headlineClass = "game-result-you-win";
    if (isPractice) {
      resultLine = wonByForfeit ? "You won · opponent forfeited" : "You won";
    } else {
      const amount = payoutOverride ?? winnerPayout;
      resultLine = wonByForfeit
        ? `You won · +${amount.toLocaleString()} SP · opponent forfeited`
        : `You won · +${amount.toLocaleString()} SP`;
    }
  } else if (isDefeat) {
    headline = "SKILL ISSUE";
    headlineClass = "game-result-skill-issue";
    if (isPractice) {
      resultLine = `You lost · ${opponentUsername} won`;
    } else {
      const lost = stakeLostOverride ?? stakeAmount;
      resultLine = `You lost · −${lost.toLocaleString()} SP`;
    }
  } else {
    headline = "DRAW";
    headlineClass = "game-result-draw";
    resultLine = isPractice
      ? "Even match"
      : `${stakeAmount.toLocaleString()} SP returned to your wallet`;
  }

  return (
    <>
      <style jsx global>{`
        @keyframes gameResultFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes skillIssueSlam {
          0% {
            transform: translateY(-120%);
            opacity: 0;
          }
          75% {
            transform: translateY(0);
            opacity: 1;
          }
          90% {
            transform: translateY(-8px);
          }
          100% {
            transform: translateY(0);
          }
        }

        @keyframes youWinPop {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          70% {
            transform: scale(1.08);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .game-result-overlay {
          animation: gameResultFadeIn 150ms ease-out forwards;
        }

        .game-result-skill-issue {
          animation: skillIssueSlam 400ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .game-result-you-win {
          animation: youWinPop 350ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .game-result-draw {
          animation: youWinPop 350ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
      `}</style>

      <div
        className="game-result-overlay fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden px-6"
        style={{ background: "#0E0E12" }}
      >
        <div className="relative flex w-full max-w-md flex-col items-center text-center">
          <h1
            className={`${headlineClass} font-bold uppercase tracking-widest leading-none`}
            style={{
              color: isVictory ? "#FFFF00" : isDefeat ? "#FF3333" : "#60A5FA",
              fontSize: "clamp(3rem, 10vw, 7rem)",
            }}
          >
            {headline}
          </h1>

          <p className="mt-4 text-sm text-white/60">{resultLine}</p>

          <div className="mt-10 flex w-full flex-col gap-3">
            <button
              type="button"
              onClick={handlePlayAgain}
              className="w-full rounded-xl py-3.5 text-[15px] font-bold uppercase tracking-wide text-black transition-opacity hover:opacity-90"
              style={{ background: "#FFFF00" }}
            >
              Rematch
            </button>
            <button
              type="button"
              onClick={handleLeave}
              className="w-full rounded-xl border border-white py-3.5 text-[15px] font-semibold uppercase tracking-wide text-white transition-colors hover:bg-white/5"
            >
              Back to Lobby
            </button>
          </div>

          {countdown > 0 && (
            <p className="mt-6 text-[12px] tabular-nums text-white/30">
              Returning to lobby in {countdown}s…
            </p>
          )}
        </div>
      </div>
    </>
  );
}
