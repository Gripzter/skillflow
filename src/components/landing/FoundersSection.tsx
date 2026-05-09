"use client";

import { useState } from "react";

type FoundersSectionProps = {
  remaining: number | null;
  closed: boolean;
};

export default function FoundersSection({ remaining, closed }: FoundersSectionProps) {
  const [showBadgeImage, setShowBadgeImage] = useState(true);

  return (
    <section id="founders" className="border-t border-[#1a1a22] bg-[#0a0a0e]">
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-12 px-8 py-[60px] md:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-[1.5px] text-[#FF5E00]">FOUNDERS PROGRAM</p>
          <h2 className="mt-2 text-[32px] font-medium tracking-[-1px] text-white">Get in before everyone else.</h2>
          <p className="mt-4 text-[14px] leading-[1.6] text-[#888]">
            Reach Platinum during beta and you&apos;re in. Permanent Founders badge nobody else can earn after launch.
            Launch credit for your account, three free Diamond cases, and early access to v2.
          </p>

          <ul className="mt-6 text-[13px] text-[#aaa]">
            {[
              "Permanent Founders badge — never droppable",
              "$10 launch credit when v2 opens",
              "3 free Diamond case openings",
              "Founders-only Discord channel + tournaments",
            ].map((item, index, arr) => (
              <li
                key={item}
                className={`flex items-start py-1.5 ${index !== arr.length - 1 ? "border-b border-[#1a1a22]" : ""}`}
              >
                <span className="mr-2 text-[#FF5E00]">●</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/founders";
            }}
            className="mt-6 rounded-[8px] bg-[#FF5E00] px-6 py-3.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Reserve my spot →
          </button>
        </div>

        <div className="rounded-xl border border-[#1a1a22] bg-[#13131a] p-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#FF5E00]">
            {showBadgeImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/badges/founder.png"
                alt="Omega Founder badge"
                className="h-full w-full object-cover"
                onError={() => setShowBadgeImage(false)}
              />
            ) : (
              <span className="text-[32px] font-bold text-white">F</span>
            )}
          </div>

          <p className="text-[11px] uppercase tracking-[1.5px] text-[#FF5E00]">MYTHIC TIER</p>
          <p className="mt-2 text-[18px] font-medium text-white">Omega Founder Badge</p>
          <p className="mt-1 text-[12px] text-[#666]">Awarded once. Never re-issued.</p>

          <div className="mt-4 flex items-center justify-between border-t border-[#1a1a22] pt-4 text-[11px] text-[#888]">
            <span>Spots remaining</span>
            <span className="font-medium text-[#FF5E00]">{closed ? "Closed" : `${remaining ?? 1000} / 1,000`}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
