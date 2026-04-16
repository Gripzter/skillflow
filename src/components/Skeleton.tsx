"use client";

import type { HTMLAttributes } from "react";

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export default function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={`skeleton-shimmer bg-white/[0.08] ${className}`.trim()}
      {...props}
    />
  );
}
