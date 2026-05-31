import type { CaseItemRarity } from "@/lib/cases";

export const SELL_VALUES_BY_RARITY: Record<CaseItemRarity, number> = {
  common: 5,
  uncommon: 15,
  rare: 40,
  epic: 100,
  legendary: 250,
};

export const MAX_EQUIPPED_BADGES = 3;

export type EquippedBorder = {
  name: string;
  rarity: CaseItemRarity;
  color: string;
  itemId: string;
};

export type EquippedBadge = {
  id: string;
  name: string;
  rarity: CaseItemRarity;
  itemId: string;
};

const RARITY_BORDER_COLORS: Record<CaseItemRarity, string> = {
  common: "#888888",
  uncommon: "#22C55E",
  rare: "#3B82F6",
  epic: "#A855F7",
  legendary: "#FFD700",
};

/** Item-specific border tints; falls back to rarity color. */
const BORDER_ITEM_COLORS: Record<string, string> = {
  border_bronze_glow: "#CD7F32",
  border_ruby_arc: "#E11D48",
  border_gold_aura: "#EAB308",
  border_ember_crown: "#F97316",
  border_diamond_prism: "#67E8F9",
  border_void_royal: "#A855F7",
  drop_border_brushed: "#94A3B8",
};

export function getBorderColor(itemId: string, rarity: CaseItemRarity): string {
  return BORDER_ITEM_COLORS[itemId] ?? RARITY_BORDER_COLORS[rarity];
}

export function toEquippedBorder(row: {
  item_id: string;
  item_name: string;
  rarity: CaseItemRarity;
}): EquippedBorder {
  return {
    itemId: row.item_id,
    name: row.item_name,
    rarity: row.rarity,
    color: getBorderColor(row.item_id, row.rarity),
  };
}

export function getSellValue(rarity: CaseItemRarity): number {
  return SELL_VALUES_BY_RARITY[rarity] ?? SELL_VALUES_BY_RARITY.common;
}

export const RARITY_ORDER: Record<CaseItemRarity, number> = {
  legendary: 0,
  epic: 1,
  rare: 2,
  uncommon: 3,
  common: 4,
};

export function sortByRarityDesc<T extends { rarity: CaseItemRarity }>(items: T[]): T[] {
  return [...items].sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);
}

export const COSMETICS_UPDATED_EVENT = "skillflow_cosmetics_updated";

export function dispatchCosmeticsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(COSMETICS_UPDATED_EVENT));
  }
}
