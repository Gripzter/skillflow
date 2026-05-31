"use client";

import type { EquippedBorder } from "@/lib/inventory-cosmetics";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<AvatarSize, { outer: string; text: string }> = {
  sm: { outer: "h-8 w-8", text: "text-xs" },
  md: { outer: "h-9 w-9 sm:h-10 sm:w-10", text: "text-sm" },
  lg: { outer: "h-16 w-16 md:h-20 md:w-20", text: "text-2xl md:text-3xl" },
  xl: { outer: "h-20 w-20 md:h-24 md:w-24", text: "text-3xl" },
};

const RING_WIDTH: Record<AvatarSize, string> = {
  sm: "p-[2px]",
  md: "p-[2px]",
  lg: "p-[3px]",
  xl: "p-[3px]",
};

type Props = {
  src?: string | null;
  fallbackInitial?: string;
  size?: AvatarSize;
  border?: EquippedBorder | null;
  className?: string;
  fallbackBg?: string;
};

function glowForRarity(rarity: EquippedBorder["rarity"]): string {
  switch (rarity) {
    case "legendary":
      return "shadow-[0_0_14px_rgba(255,215,0,0.75)] animate-pulse";
    case "epic":
      return "shadow-[0_0_12px_rgba(168,85,247,0.65)]";
    case "rare":
      return "shadow-[0_0_10px_rgba(59,130,246,0.55)]";
    case "uncommon":
      return "shadow-[0_0_8px_rgba(34,197,94,0.45)]";
    default:
      return "shadow-[0_0_4px_rgba(136,136,136,0.35)]";
  }
}

export default function AvatarWithBorder({
  src,
  fallbackInitial = "?",
  size = "md",
  border = null,
  className = "",
  fallbackBg = "#2A3A5C",
}: Props) {
  const sizeClass = SIZE_CLASSES[size];
  const ringColor = border?.color ?? "transparent";
  const ringGlow = border ? glowForRarity(border.rarity) : "";
  const initial = (fallbackInitial || "?").charAt(0).toUpperCase();

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${sizeClass.outer} ${className}`}
      title={border?.name}
    >
      <div
        className={`h-full w-full rounded-full ${border ? RING_WIDTH[size] : ""} ${ringGlow}`}
        style={
          border
            ? {
                background: `linear-gradient(135deg, ${ringColor}, ${ringColor}88)`,
              }
            : undefined
        }
      >
        <div className="relative h-full w-full overflow-hidden rounded-full bg-charcoal">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center font-semibold text-white ${sizeClass.text}`}
              style={{ background: fallbackBg }}
            >
              {initial}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
