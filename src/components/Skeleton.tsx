"use client";

import { useEffect, useState, type HTMLAttributes, type ReactNode } from "react";

type SkeletonProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "span";
  isLoading?: boolean;
  children?: ReactNode;
};

export default function Skeleton({
  className = "",
  as = "div",
  isLoading = true,
  children,
  ...props
}: SkeletonProps) {
  const Tag = as;
  const [showMask, setShowMask] = useState(isLoading);

  useEffect(() => {
    if (isLoading) {
      setShowMask(true);
      return;
    }
    const timeout = window.setTimeout(() => setShowMask(false), 250);
    return () => window.clearTimeout(timeout);
  }, [isLoading]);

  if (children == null) {
    return (
      <Tag
        aria-hidden
        className={`skeleton-shimmer ${className}`.trim()}
        {...props}
      />
    );
  }

  return (
    <Tag
      className={`relative ${className}`.trim()}
      {...props}
    >
      <div
        className={`transition-opacity duration-300 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
      >
        {children}
      </div>
      {showMask ? (
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 skeleton-shimmer rounded-[inherit] transition-opacity duration-300 ${
            isLoading ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : null}
    </Tag>
  );
}
