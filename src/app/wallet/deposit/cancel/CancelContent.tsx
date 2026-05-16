"use client";

import Link from "next/link";
import AppNavbar from "@/components/AppNavbar";

export default function CancelContent() {
  return (
    <div className="min-h-screen bg-charcoal">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username=""
        isDevMode={false}
        onLogout={async () => {}}
        loggingOut={false}
        currentPage="wallet"
      />

      <div className="relative flex min-h-[80vh] flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-card p-8 text-center">
          <p className="text-xl font-semibold text-white">Deposit cancelled</p>
          <p className="mt-2 text-body-gray">No money was charged.</p>
          <Link
            href="/wallet"
            className="mt-6 inline-block w-full rounded-lg bg-teal py-3 font-semibold text-charcoal hover:shadow-teal-glow"
          >
            Back to Wallet
          </Link>
        </div>
      </div>
    </div>
  );
}
