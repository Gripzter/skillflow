"use client";

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
  const size = 42;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(secondsLeft, totalSeconds));
  const progress = clamped / totalSeconds;
  const offset = circumference * (1 - progress);

  return (
    <div className={isDanger ? "animate-afk-ring-pulse" : ""}>
      <svg width={size} height={size} className="pointer-events-none absolute -inset-1 z-10 overflow-visible">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isDanger ? "#ef4444" : "#FF5E00"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(90 ${size / 2} ${size / 2}) scale(-1,1) translate(${-size},0)`}
        />
      </svg>
    </div>
  );
}
