const tiers = [
  { name: "Bronze", range: "0–1,999 SP", color: "#7a4a1a" },
  { name: "Silver", range: "2,000–4,999 SP", color: "#888" },
  { name: "Gold", range: "5,000–9,999 SP", color: "#d4a017" },
  { name: "Platinum", range: "10,000–19,999 SP", color: "#7eb0b0" },
  { name: "Diamond", range: "20,000+ SP", color: "#5dd5d5", founders: true },
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
                tier.founders ? "border-2 border-[#FF5E00]" : "border border-[#1a1a22]"
              }`}
            >
              {tier.founders ? (
                <span className="absolute left-1/2 top-[-9px] -translate-x-1/2 rounded-[10px] bg-[#FF5E00] px-2 py-[2px] text-[9px] tracking-[0.5px] text-white">
                  FOUNDERS
                </span>
              ) : null}
              <span
                className="mx-auto mb-[10px] block h-8 w-8 rounded-full"
                style={{ backgroundColor: tier.color }}
                aria-hidden
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
