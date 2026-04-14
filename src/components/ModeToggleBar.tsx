"use client";

import { usePlayMode } from "@/contexts/PlayModeContext";

interface ModeToggleBarContentProps {
  className?: string;
}

export default function ModeToggleBarContent({ className = "" }: ModeToggleBarContentProps) {
  const { mode, setMode } = usePlayMode();
  const showModeToggle = process.env.NEXT_PUBLIC_LAUNCH_MODE !== "SWEEPSTAKES";

  if (!showModeToggle) {
    return null;
  }

  return (
    <div
      className={`mode-toggle-bar flex flex-col items-center justify-center gap-1 border-b border-white/5 bg-charcoal py-2 md:h-10 md:flex-row md:gap-3 md:py-0 ${className}`}
      style={{ minHeight: 36 }}
      role="tablist"
      aria-label="Play mode"
    >
      <div className="mode-toggle flex items-center gap-1 rounded-[20px] bg-card p-[3px]">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "real"}
          onClick={() => setMode("real")}
          className={`relative rounded-[18px] px-4 py-2 text-sm font-bold transition-all duration-300 md:px-5 md:py-2 ${
            mode === "real"
              ? "active-real bg-gradient-to-r from-[#FF5E00] to-[#FF7A2E] text-white shadow-[0_0_20px_rgba(42,58,92,0.5)]"
              : "bg-transparent text-body-gray hover:text-primary-text/80"
          }`}
        >
          <span className="relative z-10 inline-flex items-center gap-1.5">
            Real Money
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "practice"}
          onClick={() => setMode("practice")}
          className={`relative rounded-[18px] px-4 py-2 text-sm font-bold transition-all duration-300 md:px-5 md:py-2 ${
            mode === "practice"
              ? "active-practice bg-gradient-to-r from-[#A855F7] to-[#C084FC] text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]"
              : "bg-transparent text-body-gray hover:text-primary-text/80"
          }`}
        >
          <span className="relative z-10 inline-flex items-center gap-1.5">
            Practice
          </span>
        </button>
      </div>
      <p
        className={`text-xs font-medium md:ml-0 ${
          mode === "real" ? "text-teal" : "text-purple-400"
        }`}
        aria-live="polite"
      >
        {mode === "real" ? "Playing for real stakes" : "Free play — no money required"}
      </p>
    </div>
  );
}
