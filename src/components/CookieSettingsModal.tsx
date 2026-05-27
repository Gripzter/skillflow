"use client";

import { useEffect, useState } from "react";
import { getCookieConsent, saveCookieConsent } from "@/lib/cookie-consent";

type CookieSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function CookieSettingsModal({ isOpen, onClose }: CookieSettingsModalProps) {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [savedConsent, setSavedConsent] = useState<"all" | "essential" | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const current = getCookieConsent();
    setSavedConsent(current);
    setAnalyticsEnabled(current === "all");
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const onSave = () => {
    const next = analyticsEnabled ? "all" : "essential";
    saveCookieConsent(next);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-4">
      <div className="relative w-full max-w-lg rounded-xl border border-white/10 bg-[#0E0E12] p-5 text-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close cookie settings"
          className="absolute right-3 top-3 rounded-md p-1 text-gray-300 transition hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>

        <h2 className="text-xl font-semibold">Cookie Settings</h2>
        <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">Cookie Preferences</p>
        <p className="mt-1 text-sm text-gray-300">Manage how SkillFlow uses cookies</p>
        <p className="mt-3 text-sm text-gray-300">
          We use essential cookies to keep you logged in and optional analytics cookies to improve SkillFlow.
        </p>

        <div className="mt-5 space-y-4">
          <div className="rounded-lg border border-white/10 bg-[#14141A] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-white">Essential Cookies</p>
                <p className="mt-1 text-xs text-gray-300">
                  Required for login, security, and basic platform functionality. Cannot be disabled.
                </p>
              </div>
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-full bg-teal px-3 py-1 text-xs font-semibold text-[#0B0B0D] opacity-80"
              >
                On
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-[#14141A] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-white">Analytics Cookies</p>
                <p className="mt-1 text-xs text-gray-300">
                  Help us understand how you use SkillFlow so we can improve the platform. No personal data is shared
                  with third parties.
                </p>
              </div>
              <button
                type="button"
                aria-pressed={analyticsEnabled}
                onClick={() => setAnalyticsEnabled((v) => !v)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  analyticsEnabled
                    ? "bg-teal text-[#0B0B0D]"
                    : "border border-white/20 bg-transparent text-gray-300 hover:bg-white/5"
                }`}
              >
                {analyticsEnabled ? "On" : "Off"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setAnalyticsEnabled(false)}
            className={`rounded-md border px-3 py-1.5 transition ${
              savedConsent === "essential"
                ? "border-teal bg-teal/20 text-teal"
                : "border-white/20 text-gray-200 hover:bg-white/5"
            }`}
          >
            Essential Only
          </button>
          <button
            type="button"
            onClick={() => setAnalyticsEnabled(true)}
            className={`rounded-md border px-3 py-1.5 transition ${
              savedConsent === "all"
                ? "border-teal bg-teal/20 text-teal"
                : "border-white/20 text-gray-200 hover:bg-white/5"
            }`}
          >
            Accept All
          </button>
          <span className="ml-auto text-gray-400">
            Current: {savedConsent === "all" ? "Accept All" : savedConsent === "essential" ? "Essential Only" : "Not set"}
          </span>
        </div>

        <button
          type="button"
          onClick={onSave}
          className="mt-5 w-full rounded-md bg-teal px-4 py-2 font-semibold text-[#0B0B0D] transition hover:opacity-90"
        >
          Save Preferences
        </button>
      </div>
    </div>
  );
}
