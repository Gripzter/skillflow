"use client";

import { useEffect, useState } from "react";
import {
  ABILITY_DEFS,
  DEFAULT_ABILITIES,
  type BlockadeAbilityId,
} from "@/lib/games/blockade-logic";

type Props = {
  onConfirm: (chosen: BlockadeAbilityId[]) => void;
  seconds?: number;
};

export default function BlockadeAbilitySelect({ onConfirm, seconds = 15 }: Props) {
  const [selected, setSelected] = useState<BlockadeAbilityId[]>([]);
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) {
      onConfirm(selected.length === 2 ? selected : DEFAULT_ABILITIES);
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, selected, onConfirm]);

  function toggle(id: BlockadeAbilityId) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12">
      <h2 className="text-2xl font-bold text-white">Choose Your Abilities</h2>
      <p className="mt-2 text-sm text-body-gray">Pick 2 abilities for this match · {remaining}s</p>
      <div className="mt-8 grid w-full max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ABILITY_DEFS.map((ab) => {
          const isOn = selected.includes(ab.id);
          return (
            <button
              key={ab.id}
              type="button"
              onClick={() => toggle(ab.id)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                isOn
                  ? "border-[#FFFF00] bg-[#FFFF00]/15"
                  : "border-white/15 bg-card/80 hover:border-white/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-white">{ab.name}</span>
                <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-[#FFFF00]">
                  1 use
                </span>
              </div>
              <p className="mt-2 text-xs text-body-gray">{ab.description}</p>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={selected.length !== 2}
        onClick={() => onConfirm(selected)}
        className="mt-8 rounded-lg bg-[#FFFF00] px-8 py-3 text-sm font-bold text-black disabled:opacity-40"
      >
        Ready
      </button>
    </div>
  );
}
