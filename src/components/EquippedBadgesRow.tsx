"use client";

import Image from "next/image";
import type { EquippedBadge } from "@/lib/inventory-cosmetics";
import type { CaseItemRarity } from "@/lib/cases";

const RARITY_STYLES: Record<CaseItemRarity, string> = {
  common: "border-slate-400/60",
  uncommon: "border-emerald-400/80",
  rare: "border-blue-400/80",
  epic: "border-purple-400/80",
  legendary: "border-amber-400/80",
};

function badgeImage(itemId: string): string | null {
  if (itemId === "badge_omega_founder") return "/images/badge-founders.png";
  return null;
}

type Props = {
  badges: EquippedBadge[];
  size?: "sm" | "md";
  className?: string;
};

export default function EquippedBadgesRow({ badges, size = "md", className = "" }: Props) {
  if (!badges.length) return null;

  const dim = size === "sm" ? "h-5 w-5" : "h-8 w-8";

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {badges.slice(0, 3).map((badge) => {
        const img = badgeImage(badge.itemId);
        return (
          <div
            key={badge.id}
            className={`group relative ${dim} shrink-0 overflow-hidden rounded-full border-2 bg-charcoal/90 ${RARITY_STYLES[badge.rarity]}`}
            title={`${badge.name} · ${badge.rarity}`}
          >
            {img ? (
              <Image src={img} alt={badge.name} fill className="object-contain p-0.5" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[8px] font-bold uppercase text-white/80">
                {badge.name.charAt(0)}
              </span>
            )}
            <span className="pointer-events-none absolute -bottom-8 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[10px] text-white group-hover:block">
              {badge.name} · {badge.rarity}
            </span>
          </div>
        );
      })}
    </div>
  );
}
