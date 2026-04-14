"use client";

import { useState } from "react";
import {
  IS_SWEEPSTAKES_LAUNCH,
  WAITLIST_EMAIL_KEY,
  WAITLIST_UNLOCKED_KEY,
} from "@/constants/economy";

interface WaitlistOverlayProps {
  onUnlock: () => void;
}

export default function WaitlistOverlay({ onUnlock }: WaitlistOverlayProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  if (!IS_SWEEPSTAKES_LAUNCH) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
      setError("Enter a valid email to join the alpha list.");
      return;
    }

    localStorage.setItem(WAITLIST_EMAIL_KEY, normalized);
    localStorage.setItem(WAITLIST_UNLOCKED_KEY, "true");
    onUnlock();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-charcoal/95 px-4">
      <div className="w-full max-w-md rounded-card border border-white/10 bg-card p-6 shadow-[0_0_32px_rgba(0,0,0,0.45)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal">
          Alpha Access
        </p>
        <h2 className="mt-2 text-xl font-bold text-white">
          Join the waitlist to enter the dashboard
        </h2>
        <p className="mt-2 text-sm text-body-gray">
          Enter your email to unlock free-entry tournament mode.
        </p>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError("");
            }}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-body-gray focus:border-teal focus:outline-none"
            autoComplete="email"
          />
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <button
            type="submit"
            className="w-full rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-charcoal transition hover:shadow-teal-glow"
          >
            Unlock Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}
