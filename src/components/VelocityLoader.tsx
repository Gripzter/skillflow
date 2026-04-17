"use client";

import type { CSSProperties } from "react";

const THIN_STRIPES = [
  { top: "4%", width: 2.2, duration: 0.74, delay: -0.14, tone: "orange" },
  { top: "11%", width: 1.7, duration: 0.82, delay: -0.41, tone: "red" },
  { top: "18%", width: 3.1, duration: 0.68, delay: -0.05, tone: "orange" },
  { top: "25%", width: 2.6, duration: 0.91, delay: -0.58, tone: "red" },
  { top: "32%", width: 4.1, duration: 0.79, delay: -0.24, tone: "orange" },
  { top: "39%", width: 2.0, duration: 0.87, delay: -0.66, tone: "red" },
  { top: "46%", width: 3.4, duration: 0.72, delay: -0.31, tone: "orange" },
  { top: "53%", width: 1.9, duration: 0.95, delay: -0.52, tone: "red" },
  { top: "60%", width: 4.4, duration: 0.69, delay: -0.19, tone: "orange" },
  { top: "67%", width: 2.8, duration: 0.88, delay: -0.47, tone: "red" },
  { top: "74%", width: 3.7, duration: 0.77, delay: -0.27, tone: "orange" },
  { top: "82%", width: 2.3, duration: 0.84, delay: -0.62, tone: "red" },
] as const;

const GLOW_STRIPES = [
  { top: "9%", width: 14, duration: 0.98, delay: -0.11, tone: "orange" },
  { top: "27%", width: 22, duration: 0.92, delay: -0.44, tone: "red" },
  { top: "45%", width: 10, duration: 0.88, delay: -0.29, tone: "orange" },
  { top: "63%", width: 30, duration: 0.95, delay: -0.56, tone: "red" },
  { top: "79%", width: 18, duration: 0.9, delay: -0.36, tone: "orange" },
] as const;

function getStripeColors(tone: "orange" | "red") {
  if (tone === "orange") {
    return {
      start: "rgba(255, 94, 0, 0.08)",
      mid: "#FF5E00",
      end: "rgba(255, 61, 79, 0.4)",
    };
  }
  return {
    start: "rgba(255, 61, 79, 0.08)",
    mid: "#FF3D4F",
    end: "rgba(255, 94, 0, 0.4)",
  };
}

function toStripeStyle(
  stripe: { top: string; width: number; duration: number; delay: number; tone: "orange" | "red" },
  opacity: number
): CSSProperties {
  const colors = getStripeColors(stripe.tone);
  return {
    top: stripe.top,
    height: `${stripe.width}px`,
    opacity,
    backgroundImage: `linear-gradient(90deg, transparent 0%, ${colors.start} 34%, ${colors.mid} 50%, ${colors.end} 64%, transparent 100%)`,
    animationDuration: `${stripe.duration}s`,
    animationDelay: `${stripe.delay}s`,
  };
}

export default function VelocityLoader() {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#0E0E12]">
      <div className="absolute inset-0">
        {GLOW_STRIPES.map((stripe, index) => (
          <div
            key={`glow-${index}`}
            className="animate-velocity-stripe absolute left-[-130vmax] w-[260vmax] rotate-[-55deg] blur-[6px] will-change-transform"
            style={toStripeStyle(stripe, 0.15)}
            aria-hidden
          />
        ))}

        {THIN_STRIPES.map((stripe, index) => (
          <div
            key={`thin-${index}`}
            className="animate-velocity-stripe absolute left-[-130vmax] w-[260vmax] rotate-[-55deg] will-change-transform"
            style={toStripeStyle(stripe, 0.95)}
            aria-hidden
          />
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <p className="animate-velocity-logo-pulse text-[12px] font-medium uppercase tracking-[0.3em] text-white/60">
          SkillFlow
        </p>
      </div>
    </div>
  );
}
