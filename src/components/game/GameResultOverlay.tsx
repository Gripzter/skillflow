"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import SPIcon from "@/components/SPIcon";

const AUTO_REDIRECT_SEC = 8;

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
  newBalance,
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

  const bgSrc = isVictory ? "/results/victory-bg.png" : "/results/defeat-bg.png";
  const textSrc = isVictory
    ? "/results/victory-text.png"
    : isDefeat
      ? "/results/defeat-text.png"
      : null;

  const payoutAmount = payoutOverride ?? winnerPayout;
  const lostAmount = stakeLostOverride ?? stakeAmount;
  const previousBalanceVictory =
    typeof newBalance === "number" && !isPractice ? newBalance - payoutAmount : null;
  const previousBalanceDefeat =
    typeof newBalance === "number" && !isPractice ? newBalance + lostAmount : null;

  const subtitle = isVictory
    ? wonByForfeit
      ? "Opponent forfeited — you win"
      : "You outplayed your opponent"
    : isDefeat
      ? wonByForfeit
        ? "You lost the match"
        : "You lost the match"
      : isPractice
        ? "Even match"
        : "Stake returned";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bgSrc}
        alt=""
        className="absolute inset-0 z-0 h-full w-full object-cover object-center"
      />

      {textSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={textSrc}
          alt=""
          className="absolute left-1/2 top-0 z-10 w-[140%] max-w-[900px] -translate-x-1/2 object-contain md:w-full"
        />
      ) : null}

      <div className="relative z-20 flex h-full w-full flex-col items-center justify-end overflow-x-hidden px-6 pb-[10vh]">
        <p className="mb-4 text-center text-base text-white/60">{subtitle}</p>

        {!isPractice && isVictory ? (
          <div className="mb-4 w-full max-w-md rounded-xl border border-yellow-900/40 bg-black/60 px-8 py-5 backdrop-blur-sm">
            <p className="mb-2 text-xs tracking-widest text-yellow-400">SP EARNED</p>
            <p className="flex items-baseline justify-center gap-2 text-4xl font-bold text-white">
              <span>+{payoutAmount.toLocaleString()}</span>
              <span className="text-lg text-yellow-400">SP</span>
              <SPIcon size={22} />
            </p>
            {typeof newBalance === "number" && previousBalanceVictory !== null ? (
              <p className="mt-2 flex items-center justify-center gap-1 text-sm text-gray-400">
                Balance: {previousBalanceVictory.toLocaleString()} SP
                <SPIcon size={14} />
                <span className="mx-1">→</span>
                {newBalance.toLocaleString()} SP
                <SPIcon size={14} />
              </p>
            ) : null}
          </div>
        ) : null}

        {!isPractice && isDefeat ? (
          <div className="mb-4 w-full max-w-md rounded-xl border border-red-900/40 bg-black/60 px-8 py-5 backdrop-blur-sm">
            <p className="mb-2 text-xs tracking-widest text-red-500">ENTRY LOST</p>
            <p className="flex items-baseline justify-center gap-2 text-4xl font-bold text-white">
              <span>−{lostAmount.toLocaleString()}</span>
              <span className="text-lg text-red-500">SP</span>
              <SPIcon size={22} />
            </p>
            {typeof newBalance === "number" && previousBalanceDefeat !== null ? (
              <p className="mt-2 flex items-center justify-center gap-1 text-sm text-gray-400">
                Balance: {previousBalanceDefeat.toLocaleString()} SP
                <SPIcon size={14} />
                <span className="mx-1">→</span>
                {newBalance.toLocaleString()} SP
                <SPIcon size={14} />
              </p>
            ) : null}
          </div>
        ) : null}

        {!isPractice && isDraw ? (
          <div className="mb-4 w-full max-w-md rounded-xl border border-white/20 bg-black/60 px-8 py-5 backdrop-blur-sm">
            <p className="mb-2 text-xs tracking-widest text-white/60">STAKE RETURNED</p>
            <p className="flex items-baseline justify-center gap-2 text-4xl font-bold text-white">
              <span>{stakeAmount.toLocaleString()}</span>
              <span className="text-lg text-white/60">SP</span>
              <SPIcon size={22} />
            </p>
          </div>
        ) : null}

        {isPractice ? (
          <div className="mb-4 w-full max-w-md rounded-xl border border-white/20 bg-black/60 px-8 py-5 text-center backdrop-blur-sm">
            <p className="text-sm text-white/70">
              {isVictory
                ? wonByForfeit
                  ? "Practice win — opponent forfeited"
                  : "Practice win"
                : isDefeat
                  ? `${opponentUsername} won this one`
                  : "Practice draw"}
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handlePlayAgain}
          className={`mb-3 w-full max-w-md rounded-xl py-4 text-base font-bold transition-colors ${
            isVictory
              ? "border border-yellow-400 bg-yellow-400 text-black hover:bg-yellow-300"
              : "border border-red-400 bg-red-600 text-white hover:bg-red-500"
          }`}
        >
          REMATCH
        </button>

        <button
          type="button"
          onClick={handleLeave}
          className="mb-3 w-full max-w-md rounded-xl border border-white/20 bg-transparent py-4 text-base font-bold text-white transition-colors hover:bg-white/5"
        >
          BACK TO LOBBY
        </button>

        {countdown > 0 ? (
          <p className="text-center text-xs tabular-nums text-gray-500">
            Returning to lobby in {countdown}s…
          </p>
        ) : null}
      </div>
    </div>
  );
}
