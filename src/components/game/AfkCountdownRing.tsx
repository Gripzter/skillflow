"use client";

import { useRef } from "react";

interface AfkCountdownRingProps {
  secondsLeft: number;
  totalSeconds?: number;
  isDanger?: boolean;
}

export default function AfkCountdownRing({
  secondsLeft,
  totalSeconds = 60,
  isDanger = false,
}: AfkCountdownRingProps) {
  const stroke = 2.5;
  const R = 46;
  const circumference = 2 * Math.PI * R;
  const clamped = Math.max(0, Math.min(secondsLeft, totalSeconds));
  const progress = clamped / totalSeconds;
  const offset = circumference * (1 - progress);

  const prevSecondsRef = useRef(secondsLeft);
  const isReset = secondsLeft > prevSecondsRef.current + 2;
  prevSecondsRef.current = secondsLeft;

  return (
    <div className={`absolute inset-[-3px] z-10 ${isDanger ? "animate-afk-ring-pulse" : ""}`}>
      <svg
        viewBox="0 0 100 100"
        className="pointer-events-none h-full w-full overflow-visible"
      >
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={stroke}
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={isDanger ? "#ef4444" : "#FF5E00"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          vectorEffect="non-scaling-stroke"
          transform={`rotate(-90 50 50)`}
          style={{
            transition: isReset
              ? "none"
              : "stroke-dashoffset 1s linear",
          }}
        />
      </svg>
    </div>
  );
}
