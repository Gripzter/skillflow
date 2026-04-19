"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CaseDrop, CaseItemRarity } from "@/lib/cases";

type CaseOpeningReelProps = {
  lootTable: CaseDrop[];
  winningItem: CaseDrop;
  onComplete: (item: CaseDrop) => void;
};

const ITEM_WIDTH = 100;
const ITEM_GAP = 12;
const ITEM_PITCH = ITEM_WIDTH + ITEM_GAP;
const TOTAL_ITEMS = 58;
const WIN_INDEX = 48;

function rarityClasses(rarity: CaseItemRarity): string {
  switch (rarity) {
    case "legendary":
      return "border-[#FFD700] bg-[#FFD700]/20 text-[#FFE999]";
    case "epic":
      return "border-[#FF69B4] bg-[#FF69B4]/20 text-[#FFC7E6]";
    case "rare":
      return "border-[#9B59B6] bg-[#9B59B6]/20 text-[#E3C2F0]";
    case "uncommon":
      return "border-[#4169E1] bg-[#4169E1]/20 text-[#BFD0FF]";
    case "common":
    default:
      return "border-[#4A4A4A] bg-[#4A4A4A]/30 text-gray-200";
  }
}

function iconForType(itemType: CaseDrop["item_type"]): string {
  if (itemType === "sp") return "💠";
  if (itemType === "badge") return "🏅";
  if (itemType === "border") return "🖼️";
  return "⚡";
}

function weightedRandom(lootTable: CaseDrop[]): CaseDrop {
  const total = lootTable.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of lootTable) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return lootTable[lootTable.length - 1];
}

export default function CaseOpeningReel({
  lootTable,
  winningItem,
  onComplete,
}: CaseOpeningReelProps) {
  const [containerWidth, setContainerWidth] = useState(800);
  const [translateX, setTranslateX] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [flash, setFlash] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const stripItems = useMemo(() => {
    const items: CaseDrop[] = [];
    for (let i = 0; i < TOTAL_ITEMS; i += 1) {
      items.push(weightedRandom(lootTable));
    }
    const nearMiss = lootTable.find((item) => item.rarity === "epic")
      ?? lootTable.find((item) => item.rarity === "rare")
      ?? lootTable[0];
    items[WIN_INDEX - 1] = nearMiss;
    items[WIN_INDEX] = winningItem;
    return items;
  }, [lootTable, winningItem]);

  useEffect(() => {
    const handleResize = () => {
      if (!trackRef.current) return;
      setContainerWidth(trackRef.current.clientWidth);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const centerOffset = containerWidth / 2 - ITEM_WIDTH / 2;
    const targetX = -(WIN_INDEX * ITEM_PITCH) + centerOffset;
    frameRef.current = window.requestAnimationFrame(() => {
      setTranslateX(targetX);
    });
    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    };
  }, [containerWidth]);

  function handleTransitionEnd() {
    if (doneRef.current) return;
    doneRef.current = true;
    setStopped(true);
    window.setTimeout(() => setFlash(true), 150);
    window.setTimeout(() => onComplete(winningItem), 650);
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-[#0F1118] p-5 shadow-[0_0_40px_rgba(0,0,0,0.55)]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Opening Case...</h3>
          <span className="text-xs uppercase tracking-[0.15em] text-gray-400">Good luck</span>
        </div>

        <div ref={trackRef} className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30 py-4">
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 -translate-x-1/2">
            <div className="mx-auto h-5 w-5 rotate-45 rounded-sm border border-[#FF5E00]/80 bg-[#FF5E00]/70 shadow-[0_0_20px_rgba(255,94,0,0.75)] animate-pulse" />
            <div className="mx-auto mt-1 h-[120px] w-[2px] bg-gradient-to-b from-[#FF5E00] via-[#FF5E00]/40 to-transparent" />
          </div>

          <div
            className="flex will-change-transform"
            style={{
              gap: `${ITEM_GAP}px`,
              transform: `translateX(${translateX}px)`,
              transition: "transform 6200ms cubic-bezier(0.15, 0.85, 0.35, 1)",
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {stripItems.map((item, index) => {
              const isWinning = index === WIN_INDEX;
              const isLegendary = item.rarity === "legendary";
              return (
                <div
                  key={`${item.item_id}-${index}`}
                  className={`shrink-0 rounded-lg border p-2 transition-all ${
                    rarityClasses(item.rarity)
                  } ${
                    isWinning && stopped
                      ? "scale-105 shadow-[0_0_28px_rgba(255,215,0,0.55)]"
                      : "opacity-95"
                  } ${
                    isLegendary ? "animate-[legendaryShimmer_1.5s_linear_infinite]" : ""
                  }`}
                  style={{ width: ITEM_WIDTH }}
                >
                  <p className="text-lg leading-none">{iconForType(item.item_type)}</p>
                  <p className="mt-2 line-clamp-2 text-xs font-semibold">{item.item_name}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.12em] opacity-90">
                    {item.rarity}
                  </p>
                </div>
              );
            })}
          </div>

          {flash ? (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[resultFlash_400ms_ease-out]" />
          ) : null}
        </div>
      </div>

      <style jsx>{`
        @keyframes resultFlash {
          0% { opacity: 0; }
          40% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes legendaryShimmer {
          0% { box-shadow: 0 0 0 rgba(255,215,0,0); }
          50% { box-shadow: 0 0 18px rgba(255,215,0,0.45); }
          100% { box-shadow: 0 0 0 rgba(255,215,0,0); }
        }
      `}</style>
    </div>
  );
}
