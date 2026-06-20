"use client";

export type AvatarSize = "nav" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<AvatarSize, { outer: string; text: string }> = {
  nav: { outer: "h-9 w-9", text: "text-sm" },
  sm: { outer: "h-8 w-8", text: "text-xs" },
  md: { outer: "h-9 w-9 sm:h-10 sm:w-10", text: "text-sm" },
  lg: { outer: "h-16 w-16 md:h-20 md:w-20", text: "text-2xl md:text-3xl" },
  xl: { outer: "h-20 w-20 md:h-24 md:w-24", text: "text-3xl" },
};

type Props = {
  src?: string | null;
  fallbackInitial?: string;
  size?: AvatarSize;
  className?: string;
  fallbackBg?: string;
};

export default function AvatarWithBorder({
  src,
  fallbackInitial = "?",
  size = "md",
  className = "",
  fallbackBg = "#2A3A5C",
}: Props) {
  const sizeClass = SIZE_CLASSES[size];
  const initial = (fallbackInitial || "?").charAt(0).toUpperCase();

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${sizeClass.outer} ${className}`}
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
  );
}
