"use client";

import PromoRotator from "@/components/landing/PromoRotator";

function goTo(href: string) {
  window.location.href = href;
}

export default function Hero() {
  return (
    <section className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-10 px-8 pb-[100px] pt-20 md:grid-cols-[1.1fr_1fr] md:gap-12">
      <div>
        <div className="inline-flex items-center gap-2 rounded-[20px] border border-[#2a2a35] px-3 py-1.5 text-[11px] tracking-[1px] text-[#888]">
          <span className="text-[#FF5E00]">●</span>
          <span>SEASON 01 — NOW LIVE</span>
        </div>

        <h1 className="mt-6 text-[40px] font-medium leading-[1.05] tracking-[-2px] text-white md:text-[64px]">
          <span className="block">Outplay.</span>
          <span className="block">Outrank.</span>
          <span className="block text-[#FF5E00]">Earn your spot.</span>
        </h1>

        <p className="mt-6 max-w-[480px] text-[16px] leading-[1.6] text-[#888]">
          Eight skill games. One ranked ladder. Real opponents, no luck, no pay-to-win. Climb from Bronze to Diamond and prove it.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => goTo("/signup")}
            className="rounded-[8px] bg-[#FF5E00] px-6 py-3.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Play now →
          </button>
          <button
            type="button"
            onClick={() => goTo("/founders")}
            className="rounded-[8px] border border-[#2a2a35] px-6 py-3.5 text-[14px] font-medium text-white transition-colors hover:border-[#FF5E00]"
          >
            Join Founders
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-6 text-[11px] tracking-[0.5px] text-[#666]">
          <span>FREE TO PLAY</span>
          <span>NO DOWNLOADS</span>
          <span>SKILL-BASED</span>
        </div>
      </div>

      <PromoRotator />
    </section>
  );
}
