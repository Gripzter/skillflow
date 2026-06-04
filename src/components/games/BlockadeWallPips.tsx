"use client";

import type { WallSupply } from "@/lib/games/blockade-logic";

type Props = {
  walls: WallSupply;
  color: "yellow" | "red";
};

export default function BlockadeWallPips({ walls, color }: Props) {
  const barClass =
    color === "yellow"
      ? "bg-[#FFFF00]/70 border-[#FFFF00]/50"
      : "bg-[#FF6B6B]/70 border-[#FF6B6B]/50";
  const dimClass = "bg-white/10 border-white/10 opacity-30";

  return (
    <div className="flex flex-wrap items-center gap-1.5" title="Walls remaining">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={`s-${i}`}
            className={`h-1 w-3 rounded-sm border ${i < walls.standard ? barClass : dimClass}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 2 }).map((_, i) => (
          <span
            key={`l-${i}`}
            className={`relative h-3 w-3 border ${i < walls.lshape ? barClass : dimClass}`}
            style={{
              clipPath: "polygon(0 0, 100% 0, 100% 40%, 40% 40%, 40% 100%, 0 100%)",
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 1 }).map((_, i) => (
          <span
            key={`t-${i}`}
            className={`h-1 w-5 rounded-sm border ${i < walls.triple ? barClass : dimClass}`}
          />
        ))}
      </div>
    </div>
  );
}
