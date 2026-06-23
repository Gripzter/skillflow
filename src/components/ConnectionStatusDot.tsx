"use client";

import { useConnectionStatus } from "@/hooks/useConnectionStatus";

type Props = {
  className?: string;
};

/** Compact 8px connection indicator for mobile header chrome. */
export default function ConnectionStatusDot({ className = "" }: Props) {
  const { color, label } = useConnectionStatus();

  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: color }}
      title={label}
      aria-label={label}
      role="status"
    />
  );
}
