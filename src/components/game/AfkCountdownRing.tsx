"use client";

interface AfkCountdownRingProps {
  remainingMs: number;
  totalMs?: number;
}

export default function AfkCountdownRing({
  remainingMs,
  totalMs = 60_000,
}: AfkCountdownRingProps) {
  const stroke = 2.5;
  const R = 46;
  const circumference = 2 * Math.PI * R;
  const clamped = Math.max(0, Math.min(remainingMs, totalMs));
  const progress = totalMs > 0 ? clamped / totalMs : 0;
  const offset = circumference * (1 - progress);
  const isDanger = clamped <= 10_000;

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
          stroke={isDanger ? "#DC3545" : "#FF5E00"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          vectorEffect="non-scaling-stroke"
          transform={`rotate(-90 50 50)`}
        />
      </svg>
    </div>
  );
}
