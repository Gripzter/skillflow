"use client";

import Link from "next/link";

export default function MatchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-charcoal px-4">
      <div className="text-center">
        <p className="text-lg font-medium text-white">Something went wrong loading this match.</p>
        <p className="mt-2 text-sm text-body-gray">
          {error?.message || "An unexpected error occurred."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-teal px-6 py-3 font-semibold text-charcoal hover:shadow-teal-glow"
          >
            Try again
          </button>
          <Link
            href="/play"
            className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10"
          >
            Back to Play
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-white/20 px-6 py-3 font-semibold text-white/90 hover:bg-white/10"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
