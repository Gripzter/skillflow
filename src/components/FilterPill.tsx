"use client";

import type { ReactNode } from "react";

type FilterPillProps = {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
};

/**
 * Shared selector pill used for the Play page category filter and the profile
 * Game Stats tabs. Keeps active/selected styling identical across the app:
 * fixed pill size regardless of label length, brand-yellow active state,
 * gray inactive state.
 */
export default function FilterPill({ active, onClick, children, className = "" }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] transition-colors ${
        active
          ? "border-brand-yellow bg-brand-yellow text-black"
          : "border-[#1F1F26] bg-[#16161C] text-[#9CA3AF] hover:text-white"
      } ${className}`}
    >
      {children}
    </button>
  );
}
