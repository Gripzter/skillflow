"use client";

import type { ReactNode } from "react";

type CookieSettingsButtonProps = {
  className?: string;
  children?: ReactNode;
};

export default function CookieSettingsButton({
  className,
  children = "Cookie Settings",
}: CookieSettingsButtonProps) {
  const handleClick = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(new CustomEvent("sf-open-cookie-settings-modal"));
  };

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
