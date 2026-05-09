import Image from "next/image";

const tiers = [
  { name: "BRONZE", range: "0–1,999 SP", image: "/images/rank-bronze.png" },
  { name: "SILVER", range: "2,000–4,999 SP", image: "/images/rank-silver.png" },
  { name: "GOLD", range: "5,000–9,999 SP", image: "/images/rank-gold.png" },
  { name: "PLATINUM", range: "10,000–19,999 SP", image: "/images/rank-platinum.png" },
  { name: "DIAMOND", range: "20,000+ SP", image: "/images/rank-diamond.png", isFounders: true },
];

export default function RankLadder() {
  return (
    <section id="ranks" className="border-t border-[#1a1a22]">
      <div className="mx-auto w-full max-w-[1200px] px-8 py-[60px]">
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[1.5px] text-[#FF5E00]">THE LADDER</p>
          <h2 className="mt-2 text-[32px] font-medium tracking-[-1px] text-white">Five tiers. One climb.</h2>
          <p className="mt-4 max-w-[520px] text-[14px] leading-[1.6] text-[#888]">
            Earn SkillPoints for every match. Climb from Bronze to Diamond. Each tier unlocks cosmetics, multipliers, and bragging rights you can wear across the platform.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-[8px] bg-[#13131a] p-5 text-center ${
                tier.isFounders ? "border-2 border-[#FF5E00]" : "border border-[#1a1a22]"
              }`}
            >
              {tier.isFounders ? (
                <span className="absolute left-1/2 top-[-9px] -translate-x-1/2 rounded-[10px] bg-[#FF5E00] px-2 py-[2px] text-[9px] tracking-[0.5px] text-white">
                  FOUNDERS
                </span>
              ) : null}
              <Image
                src={tier.image}
                width={64}
                height={64}
                alt={tier.name}
                className="mx-auto mb-3"
              />
              <p className="text-[12px] font-medium uppercase text-white">{tier.name}</p>
              <p className="mt-[2px] text-[10px] text-[#666]">{tier.range}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
