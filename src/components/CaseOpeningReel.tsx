"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import type { CaseDrop, CaseItemRarity } from "@/lib/cases";
import SkilliesIcon from "@/components/SkilliesIcon";

type CaseOpeningReelProps = {
  caseId: "bronze" | "gold" | "diamond" | "drop_crate" | null;
  lootTable: CaseDrop[];
  winningItem: CaseDrop;
  onComplete: (item: CaseDrop) => void;
};

const ITEM_WIDTH = 100;
const ITEM_GAP = 12;
const ITEM_PITCH = ITEM_WIDTH + ITEM_GAP;
const TOTAL_ITEMS = 58;
const WIN_INDEX = 48;

const BORDER_PREVIEW_BY_RARITY: Record<CaseItemRarity, string> = {
  common: "/images/border-common.png",
  uncommon: "/images/border-common.png",
  rare: "/images/border-rare.png",
  epic: "/images/border-epic.png",
  legendary: "/images/border-legendary.png",
};

const CASE_IMAGE_BY_ID: Record<"bronze" | "gold" | "diamond" | "drop_crate", string> = {
  bronze: "/images/Case-bronze.png",
  gold: "/images/case-gold.png",
  diamond: "/images/case-diamond.png",
  drop_crate: "/images/case-free.png",
};

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

function iconForType(itemType: CaseDrop["item_type"]): ReactNode {
  if (itemType === "sp") return <SkilliesIcon size={20} />;
  if (itemType === "badge") return "🏅";
  return null;
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

function isHighValueDrop(item: CaseDrop): boolean {
  if (item.item_type === "multiplier") return true;
  if (item.item_type === "sp") {
    const topValue = Number(item.max_value ?? item.value ?? 0);
    return topValue >= 1000;
  }
  return item.rarity === "epic" || item.rarity === "legendary";
}

export default function CaseOpeningReel({
  caseId,
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
    const highValuePool = lootTable.filter(isHighValueDrop);
    const nearMiss = highValuePool.length > 0
      ? weightedRandom(highValuePool)
      : weightedRandom(lootTable);
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
          <div className="flex items-center gap-3">
            {caseId ? (
              <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-white/10">
                <Image src={CASE_IMAGE_BY_ID[caseId]} alt={`${caseId} case`} fill className="object-cover" />
              </div>
            ) : null}
            <h3 className="text-lg font-semibold text-white">Opening Case...</h3>
          </div>
          <span className="text-xs uppercase tracking-[0.15em] text-gray-400">Good luck</span>
        </div>

        <div ref={trackRef} className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30 py-4">
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 -translate-x-1/2">
            <div className="mx-auto h-5 w-5 rotate-45 rounded-sm border border-[#FFFF00]/80 bg-[#FFFF00]/70 shadow-[0_0_20px_rgba(255, 255, 0, 0.75)] animate-pulse" />
            <div className="mx-auto mt-1 h-[120px] w-[2px] bg-gradient-to-b from-[#FFFF00] via-[#FFFF00]/40 to-transparent" />
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
                  <div className="flex h-12 items-center justify-center">
                    {item.item_type === "border" ? (
                      <div className="relative h-10 w-14 overflow-hidden rounded border border-white/20">
                        <Image
                          src={BORDER_PREVIEW_BY_RARITY[item.rarity]}
                          alt={`${item.rarity} border preview`}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : item.item_type === "multiplier" ? (
                      <div className="relative h-10 w-10 overflow-hidden rounded">
                        <Image
                          src={item.item_id.includes("3x") ? "/images/multiplier-3x.png" : "/images/multiplier-2x.png"}
                          alt={item.item_name}
                          fill
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <p className="text-lg leading-none">{iconForType(item.item_type)}</p>
                    )}
                  </div>
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
