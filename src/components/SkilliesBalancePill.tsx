"use client";

import ConnectionStatusDot from "@/components/ConnectionStatusDot";

type Props = {
  balance: number;
  onClick: () => void;
  /** Show the compact connection dot inside the pill (mobile header). */
  showConnectionDot?: boolean;
};

/** Single balance pill used in the app header — one component, responsive sizing. */
export default function SkilliesBalancePill({ balance, onClick, showConnectionDot = false }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-bold text-brand-yellow transition-colors hover:bg-white/10"
      aria-label={`Skillies: ${balance.toLocaleString()}`}
    >
      {showConnectionDot ? <ConnectionStatusDot className="sm:hidden" /> : null}
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black">
        S
      </span>
      <span>{balance.toLocaleString()}</span>
    </button>
  );
}
