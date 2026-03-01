"use client";

import Link from "next/link";
import { useGeo } from "@/contexts/GeoContext";

interface GeoBlockModalProps {
  onClose: () => void;
  stateName?: string;
}

export default function GeoBlockModal({ onClose, stateName }: GeoBlockModalProps) {
  const { location } = useGeo();
  const displayState = stateName ?? location?.stateName ?? "your state";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="geo-block-title">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-card p-8 shadow-xl">
        <h2 id="geo-block-title" className="text-xl font-bold text-white">
          🌍 Not Available in Your Region
        </h2>
        <p className="mt-4 text-body-gray">
          Skill-based wagering is not currently available in {displayState} due to local regulations.
        </p>
        <p className="mt-4 text-sm font-medium text-white">You can still:</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-body-gray">
          <li>Play in Practice Mode (free)</li>
          <li>Browse games and leaderboards</li>
          <li>Create and manage your account</li>
        </ul>
        <p className="mt-4 text-sm text-body-gray">
          We&apos;re working to expand to more states. Check back soon!
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/play?practice=1"
            className="rounded-lg bg-teal py-3 text-center font-semibold text-charcoal hover:shadow-teal-glow"
          >
            🎯 Play Practice Mode
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-white/20 py-3 text-center font-medium text-white hover:bg-white/5"
          >
            🏠 Back to Dashboard
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-body-gray hover:text-white"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
