"use client";

import { useEffect, useMemo, useState } from "react";
import type { CaseDrop, CaseItemRarity } from "@/lib/cases";
import SkilliesIcon from "@/components/SkilliesIcon";

type CaseResultModalProps = {
  item: CaseDrop;
  canOpenAnother: boolean;
  onClose: () => void;
  onOpenAnother: () => void;
};

function rarityGlow(rarity: CaseItemRarity): string {
  switch (rarity) {
    case "legendary":
      return "shadow-[0_0_35px_rgba(255,215,0,0.6)] bg-[#FFD700]/20 border-[#FFD700]";
    case "epic":
      return "shadow-[0_0_30px_rgba(255,105,180,0.55)] bg-[#FF69B4]/20 border-[#FF69B4]";
    case "rare":
      return "shadow-[0_0_28px_rgba(155,89,182,0.5)] bg-[#9B59B6]/20 border-[#9B59B6]";
    case "uncommon":
      return "shadow-[0_0_24px_rgba(65,105,225,0.45)] bg-[#4169E1]/20 border-[#4169E1]";
    case "common":
    default:
      return "shadow-[0_0_18px_rgba(80,80,80,0.45)] bg-[#4A4A4A]/20 border-[#4A4A4A]";
  }
}

function iconForType(itemType: CaseDrop["item_type"]): string {
  if (itemType === "sp") return "💠";
  if (itemType === "badge") return "🏅";
  if (itemType === "border") return "🖼️";
  return "⚡";
}

export default function CaseResultModal({
  item,
  canOpenAnother,
  onClose,
  onOpenAnother,
}: CaseResultModalProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const isSp = item.item_type === "sp";
  const isMultiplier = item.item_type === "multiplier";

  useEffect(() => {
    if (!isSp) return;
    const target = Number(item.value ?? 0);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      const eased = 1 - (1 - t) ** 3;
      setDisplayValue(Math.round(target * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isSp, item.value]);

  const valueLabel = useMemo(() => {
    if (isSp) return `+${displayValue.toLocaleString()} Skillies`;
    if (isMultiplier) return `2x for next ${(item.value ?? 0).toLocaleString()} matches!`;
    return item.item_name;
  }, [displayValue, isMultiplier, isSp, item.item_name, item.value]);

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0F1118] p-6 text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">You Unboxed</p>
        <div
          className={`mx-auto mt-4 flex h-36 w-36 items-center justify-center rounded-2xl border text-5xl ${rarityGlow(item.rarity)} animate-pulse`}
        >
          {iconForType(item.item_type)}
        </div>
        <h3 className="mt-5 text-2xl font-bold text-white">{item.item_name}</h3>
        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-gray-400">{item.rarity}</p>

        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
          <p className={`text-lg font-semibold ${isSp ? "text-emerald-300" : "text-white"}`}>
            {isSp ? (
              <span className="inline-flex items-center gap-1">
                {valueLabel} <SkilliesIcon size={18} />
              </span>
            ) : isMultiplier ? (
              <span className="inline-flex items-center gap-1">
                2x SkillPoints for next {(item.value ?? 0).toLocaleString()} matches!
              </span>
            ) : (
              valueLabel
            )}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 font-medium text-white transition-colors hover:bg-white/10"
          >
            Awesome!
          </button>
          {canOpenAnother ? (
            <button
              type="button"
              onClick={onOpenAnother}
              className="w-full rounded-lg bg-[#FF5E00] px-4 py-2.5 font-semibold text-white transition-opacity hover:opacity-90"
            >
              Open Another
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
