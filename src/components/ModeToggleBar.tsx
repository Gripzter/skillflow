"use client";

import { usePlayMode } from "@/contexts/PlayModeContext";

interface ModeToggleBarContentProps {
  className?: string;
}

export default function ModeToggleBarContent({ className = "" }: ModeToggleBarContentProps) {
  const { mode, setMode } = usePlayMode();

  return (
    <div
      className={`mode-toggle-bar flex flex-col items-center justify-center gap-1 border-b border-white/5 bg-[#0E1018] py-2 md:h-10 md:flex-row md:gap-3 md:py-0 ${className}`}
      style={{ minHeight: 36 }}
      role="tablist"
      aria-label="Play mode"
    >
      <div className="mode-toggle flex items-center gap-1 rounded-[20px] bg-[#151821] p-[3px]">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "real"}
          onClick={() => setMode("real")}
          className={`relative rounded-[18px] px-4 py-2 text-sm font-bold transition-all duration-300 md:px-5 md:py-2 ${
            mode === "real"
              ? "active-real bg-gradient-to-r from-[#00E5C7] to-emerald-500 text-white shadow-[0_0_20px_rgba(0,229,199,0.3)]"
              : "bg-transparent text-body-gray hover:text-white/80"
          }`}
        >
          <span className="relative z-10 inline-flex items-center gap-1.5">
            <span aria-hidden>💰</span>
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
              ? "active-practice bg-gradient-to-r from-[#7C5CFC] to-purple-600 text-white shadow-[0_0_20px_rgba(124,92,252,0.3)]"
              : "bg-transparent text-body-gray hover:text-white/80"
          }`}
        >
          <span className="relative z-10 inline-flex items-center gap-1.5">
            <span aria-hidden>🎯</span>
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
