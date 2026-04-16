"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { formatCurrency } from "@/lib/formatCurrency";

const AUTO_REDIRECT_SEC = 30;

interface GameResultOverlayProps {
  outcome: "victory" | "defeat" | "draw";
  isPractice: boolean;
  stakeAmount: number;
  winnerPayout: number;
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
  opponentUsername,
  wonByForfeit,
  onPlayAgain,
  onLeave,
}: GameResultOverlayProps) {
  const [countdown, setCountdown] = useState(AUTO_REDIRECT_SEC);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (outcome !== "victory") return;
    const duration = 2200;
    const end = Date.now() + duration;

    function burst() {
      confetti({
        particleCount: 10,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.65 },
        colors: ["#FF5E00", "#FFD700", "#FF9900", "#FFFFFF", "#FF4444"],
        zIndex: 60,
      });
      confetti({
        particleCount: 10,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.65 },
        colors: ["#FF5E00", "#FFD700", "#FF9900", "#FFFFFF", "#44BBFF"],
        zIndex: 60,
      });
      if (Date.now() < end) {
        requestAnimationFrame(burst);
      }
    }

    burst();
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
  let headlineColor: string;
  let amountLine: string | null = null;
  let subtext: string;

  if (isVictory) {
    headline = "VICTORY";
    headlineColor = "#FF5E00";
    if (!isPractice) amountLine = `+ ${formatCurrency(winnerPayout)}`;
    subtext = wonByForfeit
      ? "Opponent forfeited. You win!"
      : isPractice
        ? "Nice work!"
        : `You defeated ${opponentUsername}`;
  } else if (isDefeat) {
    headline = "DEFEAT";
    headlineColor = "#6B7280";
    if (!isPractice) amountLine = `- ${formatCurrency(stakeAmount)}`;
    subtext = `${opponentUsername} won this one`;
  } else {
    headline = "DRAW";
    headlineColor = "#60A5FA";
    if (!isPractice) amountLine = "Stake returned";
    subtext = isPractice ? "Even match!" : `${formatCurrency(stakeAmount)} returned to your wallet`;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6" style={{ background: "rgba(10,10,14,0.97)" }}>
      {/* Background glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isVictory
            ? "radial-gradient(ellipse at 50% 60%, rgba(255,94,0,0.12) 0%, transparent 70%)"
            : isDraw
              ? "radial-gradient(ellipse at 50% 60%, rgba(96,165,250,0.08) 0%, transparent 70%)"
              : "radial-gradient(ellipse at 50% 60%, rgba(107,114,128,0.06) 0%, transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative flex flex-col items-center text-center">
        {/* Headline */}
        <h1
          className="text-6xl font-black tracking-wide sm:text-7xl"
          style={{ color: headlineColor, letterSpacing: "0.06em" }}
        >
          {headline}
        </h1>

        {/* Amount */}
        {amountLine && (
          <p
            className="mt-4 text-4xl font-bold tabular-nums sm:text-5xl"
            style={{
              color: isVictory ? "#FF5E00" : isDraw ? "#60A5FA" : "#6B7280",
            }}
          >
            {amountLine}
          </p>
        )}

        {/* Subtext */}
        <p className="mt-3 text-[15px]" style={{ color: "#888" }}>
          {subtext}
        </p>

        {/* Buttons */}
        <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
          <button
            type="button"
            onClick={handlePlayAgain}
            className="w-full rounded-xl py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "#FF5E00" }}
          >
            Play Again
          </button>
          <button
            type="button"
            onClick={handleLeave}
            className="w-full rounded-xl border py-3.5 text-[15px] font-semibold transition-colors hover:bg-white/5"
            style={{ borderColor: "#2A3A5C", color: "#aaa" }}
          >
            Leave
          </button>
        </div>

        {countdown > 0 && (
          <p className="mt-6 text-[12px] tabular-nums text-[#555]">
            Returning to lobby in {countdown}s…
          </p>
        )}
      </div>
    </div>
  );
}
