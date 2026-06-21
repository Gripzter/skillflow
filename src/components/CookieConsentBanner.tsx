"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getCookieConsent, saveCookieConsent, type CookieConsentValue } from "@/lib/cookie-consent";

export default function CookieConsentBanner() {
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const hasBottomNav =
    pathname !== "/" &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/signup") &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/match");

  useEffect(() => {
    const saved = getCookieConsent();
    setIsVisible(!saved);
    setIsReady(true);

    const handleUpdated = () => {
      setIsVisible(!getCookieConsent());
    };

    window.addEventListener("sf-cookie-consent-updated", handleUpdated);
    return () => window.removeEventListener("sf-cookie-consent-updated", handleUpdated);
  }, []);

  const setConsent = (value: CookieConsentValue) => {
    saveCookieConsent(value);
    setIsVisible(false);
  };

  if (!isReady || !isVisible) {
    return null;
  }

  return (
    <div
      className={`fixed left-0 right-0 z-50 border-t border-white/10 bg-[#0E0E12] px-4 py-3 ${
        hasBottomNav
          ? "bottom-[calc(64px+env(safe-area-inset-bottom)+8px)] md:bottom-4"
          : "bottom-[env(safe-area-inset-bottom)] md:bottom-4"
      }`}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-xs leading-relaxed text-gray-300 md:text-sm">
          We use essential cookies to run SkillFlow and optional analytics cookies to improve the platform. You can
          accept or decline analytics cookies.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setConsent("essential")}
            className="rounded-md border border-white/25 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-white/5 md:text-sm"
          >
            Essential Only
          </button>
          <button
            type="button"
            onClick={() => setConsent("all")}
            className="rounded-md bg-teal px-3 py-1.5 text-xs font-semibold text-[#0B0B0D] transition hover:opacity-90 md:text-sm"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
