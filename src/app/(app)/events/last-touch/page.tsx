"use client";

import Image from "next/image";
import Link from "next/link";
import { redirectToAuthAction } from "@/lib/auth-action";

export default function LastTouchEventPage() {
  return (
    <div className="min-h-screen bg-[#0E0E12]">
      <div className="relative aspect-[16/9] sm:aspect-[21/9] lg:aspect-[24/7]">
        <Image
          src="/images/events/last-touch.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(14,14,18,0.3) 0%, rgba(14,14,18,0.95) 100%)",
          }}
        />

        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12">
          <div className="max-w-4xl mx-auto">
            <div className="inline-block px-2 py-1 bg-[#FFFF00] text-black text-[11px] font-bold uppercase tracking-wide rounded mb-3">
              Featured Event
            </div>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[0.95] mb-3">
              Last Touch
            </h1>
            <p className="text-base sm:text-lg text-white/70 max-w-xl">
              Hold your ground. Last finger standing wins the pot.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
          <Stat label="Current prize pool" value="1,247" suffix="Skillies" />
          <Stat label="Next round (UTC)" value="14:00" />
          <Stat label="Entry fee" value="100" suffix="Skillies" />
        </div>

        <button
          type="button"
          onClick={redirectToAuthAction}
          className="w-full sm:w-auto px-8 py-4 bg-[#FFFF00] text-black font-bold text-base sm:text-lg rounded-xl hover:brightness-110 transition-all"
        >
          Join next round →
        </button>

        <div className="mt-10 sm:mt-12">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">How it works</h2>
          <ul className="space-y-2 text-sm sm:text-base text-white/70 leading-relaxed">
            <li>&middot; Three scheduled rounds per day: 02:00, 14:00, 20:00 UTC</li>
            <li>&middot; Hold the button. Last player still holding wins.</li>
            <li>&middot; Periodic challenges interrupt - react fast or lose grip.</li>
            <li>&middot; Winner takes the full prize pool. No splits.</li>
          </ul>
        </div>

        <div className="mt-8">
          <Link href="/events" className="text-sm text-white/50 hover:text-white transition-colors">
            ← Back to events
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
      <div className="text-[10px] sm:text-[11px] uppercase tracking-wide text-white/50 mb-1">
        {label}
      </div>
      <div className="text-lg sm:text-2xl font-bold text-white">
        {value}
        {suffix && <span className="text-sm font-medium text-white/60 ml-1">{suffix}</span>}
      </div>
    </div>
  );
}
