import type { CaseItemRarity } from "@/lib/cases";

export const INVENTORY_RARITY_STYLES: Record<CaseItemRarity, string> = {
  common: "bg-slate-500/20 text-slate-300",
  uncommon: "bg-emerald-500/20 text-emerald-300",
  rare: "bg-blue-500/20 text-blue-300",
  epic: "bg-purple-500/20 text-purple-300",
  legendary: "bg-amber-500/20 text-amber-300",
};

const BORDER_PREVIEW_BY_RARITY: Record<CaseItemRarity, string> = {
  common: "/images/border-common.png",
  uncommon: "",
  rare: "/images/border-rare.png",
  epic: "/images/border-epic.png",
  legendary: "/images/border-legendary.png",
};

const RARITY_RING_STYLES: Record<CaseItemRarity, string> = {
  common: "border-slate-400/80",
  uncommon: "border-emerald-400/80",
  rare: "border-blue-400/80",
  epic: "border-purple-400/80",
  legendary: "",
};

export function getInventoryPreviewImage(item: {
  item_type: "border" | "badge";
  item_id: string;
  item_name: string;
  rarity: CaseItemRarity;
}): string | null {
  if (item.item_type === "badge") {
    if (item.item_id === "badge_omega_founder" || item.item_name === "Omega Founder Badge") {
      return "/images/badge-founders.png";
    }
    return null;
  }
  const image = BORDER_PREVIEW_BY_RARITY[item.rarity];
  return image || null;
}

export function getInventoryRingFallbackClass(rarity: CaseItemRarity): string {
  return RARITY_RING_STYLES[rarity];
}
