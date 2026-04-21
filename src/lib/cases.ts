import { spendSP } from "@/lib/skillpoints";
import { createClient } from "@/lib/supabase";

export type CaseItemType = "sp" | "border" | "badge" | "multiplier";
export type CaseItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type CaseDrop = {
  item_type: CaseItemType;
  item_id: string;
  item_name: string;
  rarity: CaseItemRarity;
  value: number | null;
  weight: number;
};

export type CaseTier = {
  id: string;
  name: string;
  cost_sp: number;
  loot_table: CaseDrop[];
};

// NOTE: Replace with finalized product spec values if they differ.
export const CASE_TIERS: Record<string, CaseTier> = {
  bronze: {
    id: "bronze",
    name: "Bronze Case",
    cost_sp: 200,
    loot_table: [
      { item_type: "sp", item_id: "sp_40", item_name: "40 SP", rarity: "common", value: 40, weight: 30 },
      { item_type: "sp", item_id: "sp_80", item_name: "80 SP", rarity: "common", value: 80, weight: 25 },
      { item_type: "sp", item_id: "sp_140", item_name: "140 SP", rarity: "uncommon", value: 140, weight: 15 },
      { item_type: "sp", item_id: "sp_250", item_name: "250 SP", rarity: "rare", value: 250, weight: 8 },
      { item_type: "border", item_id: "border_bronze_glow", item_name: "Bronze Glow Border", rarity: "uncommon", value: null, weight: 8 },
      { item_type: "badge", item_id: "badge_rookie_crest", item_name: "Rookie Crest Badge", rarity: "uncommon", value: null, weight: 6 },
      { item_type: "multiplier", item_id: "mult_2x_3", item_name: "2x SP (3 matches)", rarity: "rare", value: 3, weight: 6 },
      { item_type: "badge", item_id: "badge_beta_flare", item_name: "Beta Flare Badge", rarity: "epic", value: null, weight: 2 },
    ],
  },
  gold: {
    id: "gold",
    name: "Gold Case",
    cost_sp: 500,
    loot_table: [
      { item_type: "sp", item_id: "sp_180", item_name: "180 SP", rarity: "common", value: 180, weight: 20 },
      { item_type: "sp", item_id: "sp_320", item_name: "320 SP", rarity: "uncommon", value: 320, weight: 20 },
      { item_type: "sp", item_id: "sp_550", item_name: "550 SP", rarity: "rare", value: 550, weight: 14 },
      { item_type: "sp", item_id: "sp_900", item_name: "900 SP", rarity: "epic", value: 900, weight: 6 },
      { item_type: "border", item_id: "border_gold_aura", item_name: "Gold Aura Border", rarity: "rare", value: null, weight: 12 },
      { item_type: "badge", item_id: "badge_victory_mark", item_name: "Victory Mark Badge", rarity: "rare", value: null, weight: 10 },
      { item_type: "multiplier", item_id: "mult_2x_5", item_name: "2x SP (5 matches)", rarity: "epic", value: 5, weight: 10 },
      { item_type: "border", item_id: "border_ember_crown", item_name: "Ember Crown Border", rarity: "legendary", value: null, weight: 2 },
      { item_type: "badge", item_id: "badge_founders_star", item_name: "Founders Star Badge", rarity: "legendary", value: null, weight: 1 },
    ],
  },
  diamond: {
    id: "diamond",
    name: "Diamond Case",
    cost_sp: 1000,
    loot_table: [
      { item_type: "sp", item_id: "sp_500", item_name: "500 SP", rarity: "common", value: 500, weight: 18 },
      { item_type: "sp", item_id: "sp_850", item_name: "850 SP", rarity: "uncommon", value: 850, weight: 18 },
      { item_type: "sp", item_id: "sp_1300", item_name: "1,300 SP", rarity: "rare", value: 1300, weight: 16 },
      { item_type: "sp", item_id: "sp_2400", item_name: "2,400 SP", rarity: "epic", value: 2400, weight: 8 },
      { item_type: "border", item_id: "border_diamond_prism", item_name: "Diamond Prism Border", rarity: "epic", value: null, weight: 10 },
      { item_type: "badge", item_id: "badge_elite_core", item_name: "Elite Core Badge", rarity: "epic", value: null, weight: 10 },
      { item_type: "multiplier", item_id: "mult_3x_5", item_name: "3x SP (5 matches)", rarity: "legendary", value: 5, weight: 8 },
      { item_type: "multiplier", item_id: "mult_2x_10", item_name: "2x SP (10 matches)", rarity: "legendary", value: 10, weight: 6 },
      { item_type: "badge", item_id: "badge_omega_founder", item_name: "Omega Founder Badge", rarity: "legendary", value: null, weight: 2 },
      { item_type: "border", item_id: "border_void_royal", item_name: "Void Royal Border", rarity: "legendary", value: null, weight: 2 },
    ],
  },
  drop_crate: {
    id: "drop_crate",
    name: "Drop Crate",
    cost_sp: 0,
    loot_table: [
      { item_type: "sp", item_id: "drop_sp_35", item_name: "35 SP", rarity: "common", value: 35, weight: 30 },
      { item_type: "sp", item_id: "drop_sp_70", item_name: "70 SP", rarity: "common", value: 70, weight: 24 },
      { item_type: "sp", item_id: "drop_sp_130", item_name: "130 SP", rarity: "uncommon", value: 130, weight: 16 },
      { item_type: "sp", item_id: "drop_sp_220", item_name: "220 SP", rarity: "rare", value: 220, weight: 8 },
      { item_type: "border", item_id: "drop_border_brushed", item_name: "Brushed Border", rarity: "uncommon", value: null, weight: 8 },
      { item_type: "badge", item_id: "drop_badge_contender", item_name: "Contender Badge", rarity: "uncommon", value: null, weight: 6 },
      { item_type: "multiplier", item_id: "drop_mult_2x_2", item_name: "2x SP (2 matches)", rarity: "rare", value: 2, weight: 6 },
      { item_type: "badge", item_id: "drop_badge_lucky", item_name: "Lucky Badge", rarity: "epic", value: null, weight: 2 },
    ],
  },
};

type OpenCaseResult =
  | { success: true; caseId: string; caseName: string; lootTable: CaseDrop[]; winningItem: CaseDrop }
  | { success: false; error: string };

type FreeCratesResult =
  | { success: true; freeCratesAvailable: number }
  | { success: false; error: string };

type IncrementMatchCountResult =
  | { success: true; matchesSinceLastCrate: number; freeCratesAvailable: number }
  | { success: false; error: string };

type PlayerInventoryRow = {
  id: string;
  user_id: string;
  item_type: "border" | "badge";
  item_id: string;
  item_name: string;
  rarity: CaseItemRarity;
  equipped: boolean;
  created_at: string;
};

export async function resolveCaseUserId(
  userId: string
): Promise<{ resolvedUserId: string; supabase: ReturnType<typeof createClient> }> {
  const supabase = createClient();
  if (!supabase) {
    return { resolvedUserId: userId, supabase };
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[Cases] Failed to resolve authenticated user", {
        providedUserId: userId,
        error: error.message,
      });
      return { resolvedUserId: userId, supabase };
    }
    if (user?.id && user.id !== userId) {
      // eslint-disable-next-line no-console
      console.warn("[Cases] Using authenticated user ID instead of provided user ID", {
        providedUserId: userId,
        authenticatedUserId: user.id,
      });
    }
    return { resolvedUserId: user?.id ?? userId, supabase };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Cases] Unexpected error resolving authenticated user", {
      providedUserId: userId,
      error,
    });
    return { resolvedUserId: userId, supabase };
  }
}

function getCaseTier(caseId: string): CaseTier | null {
  return CASE_TIERS[caseId] ?? null;
}

function pickWeightedItem(lootTable: CaseDrop[]): CaseDrop | null {
  const totalWeight = lootTable.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return null;
  let roll = Math.random() * totalWeight;
  for (const item of lootTable) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return lootTable[lootTable.length - 1] ?? null;
}

async function awardSpReward(
  userId: string,
  amount: number,
  description: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = createClient();
  if (!supabase) return { success: false, error: "Supabase is not configured." };
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("lifetime_sp, balance_sp")
    .eq("id", userId)
    .single();
  if (profileError || !profile) return { success: false, error: "Failed to load user profile." };

  const nextLifetime = Number(profile.lifetime_sp ?? 0) + amount;
  const nextBalance = Number(profile.balance_sp ?? 0) + amount;
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ lifetime_sp: nextLifetime, balance_sp: nextBalance })
    .eq("id", userId);
  if (updateError) return { success: false, error: "Failed to update SP balances for case reward." };

  const { error: txError } = await supabase.from("sp_transactions").insert({
    user_id: userId,
    amount,
    type: "case_reward",
    description,
  });
  if (txError) return { success: false, error: "Failed to log case reward transaction." };
  return { success: true };
}

async function openCaseInternal(
  userId: string,
  caseId: string,
  options: { skipSpend: boolean }
): Promise<OpenCaseResult> {
  const { resolvedUserId, supabase } = await resolveCaseUserId(userId);
  if (!supabase) return { success: false, error: "Supabase is not configured." };
  const caseTier = getCaseTier(caseId);
  if (!caseTier) return { success: false, error: "Invalid case selected." };

  if (!options.skipSpend && caseTier.cost_sp > 0) {
    const spend = await spendSP(resolvedUserId, caseTier.cost_sp, "case_open", `Opened ${caseTier.name}`);
    if (!spend.success) return { success: false, error: spend.error };
  }

  const winningItem = pickWeightedItem(caseTier.loot_table);
  if (!winningItem) return { success: false, error: "Case has no valid rewards configured." };

  if (winningItem.item_type === "sp") {
    const amount = Number(winningItem.value ?? 0);
    if (amount > 0) {
      const reward = await awardSpReward(resolvedUserId, amount, `${caseTier.name} reward: ${winningItem.item_name}`);
      if (!reward.success) return { success: false, error: reward.error };
    }
  } else if (winningItem.item_type === "border" || winningItem.item_type === "badge") {
    // eslint-disable-next-line no-console
    console.log("[Cases] Inserting cosmetic reward", {
      userId: resolvedUserId,
      itemType: winningItem.item_type,
      itemId: winningItem.item_id,
      itemName: winningItem.item_name,
      rarity: winningItem.rarity,
    });
    const { error } = await supabase.from("player_inventory").insert({
      user_id: resolvedUserId,
      item_type: winningItem.item_type,
      item_id: winningItem.item_id,
      item_name: winningItem.item_name,
      rarity: winningItem.rarity,
      equipped: false,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[Cases] Failed to insert cosmetic reward", {
        userId: resolvedUserId,
        itemType: winningItem.item_type,
        itemName: winningItem.item_name,
        itemId: winningItem.item_id,
        code: error.code,
        details: error.details,
        error: error.message,
      });
      return { success: false, error: "Failed to save cosmetic reward." };
    }
  } else if (winningItem.item_type === "multiplier") {
    const { error } = await supabase.from("active_multipliers").insert({
      user_id: resolvedUserId,
      multiplier_id: winningItem.item_id,
      multiplier_name: winningItem.item_name,
      matches_remaining: Number(winningItem.value ?? 0),
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[Cases] Failed to insert multiplier reward", {
        userId: resolvedUserId,
        itemId: winningItem.item_id,
        code: error.code,
        details: error.details,
        error: error.message,
      });
      return { success: false, error: "Failed to save multiplier reward." };
    }
  }

  return {
    success: true,
    caseId: caseTier.id,
    caseName: caseTier.name,
    lootTable: caseTier.loot_table,
    winningItem,
  };
}

export async function openCase(userId: string, caseId: string): Promise<OpenCaseResult> {
  return openCaseInternal(userId, caseId, { skipSpend: caseId === "drop_crate" });
}

export async function getFreeCrates(userId: string): Promise<FreeCratesResult> {
  const { resolvedUserId, supabase } = await resolveCaseUserId(userId);
  if (!supabase) return { success: false, error: "Supabase is not configured." };
  const { data, error } = await supabase
    .from("profiles")
    .select("free_crates_available")
    .eq("id", resolvedUserId)
    .single();
  if (error || !data) return { success: false, error: "Failed to fetch free crate count." };
  return { success: true, freeCratesAvailable: Number(data.free_crates_available ?? 0) };
}

export async function claimFreeCrate(userId: string): Promise<OpenCaseResult> {
  const { resolvedUserId, supabase } = await resolveCaseUserId(userId);
  if (!supabase) return { success: false, error: "Supabase is not configured." };
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("free_crates_available")
    .eq("id", resolvedUserId)
    .single();
  if (profileError || !profile) return { success: false, error: "Failed to load free crate count." };
  const available = Number(profile.free_crates_available ?? 0);
  if (available <= 0) return { success: false, error: "No free crates available." };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ free_crates_available: available - 1 })
    .eq("id", resolvedUserId);
  if (updateError) return { success: false, error: "Failed to claim free crate." };

  return openCaseInternal(resolvedUserId, "drop_crate", { skipSpend: true });
}

export async function incrementMatchCount(userId: string): Promise<IncrementMatchCountResult> {
  const { resolvedUserId, supabase } = await resolveCaseUserId(userId);
  if (!supabase) return { success: false, error: "Supabase is not configured." };
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("matches_since_last_crate, free_crates_available")
    .eq("id", resolvedUserId)
    .single();
  if (profileError || !profile) return { success: false, error: "Failed to load crate progress." };

  const currentMatches = Number(profile.matches_since_last_crate ?? 0);
  const currentFree = Number(profile.free_crates_available ?? 0);
  const nextMatchesRaw = currentMatches + 1;
  const grantCrate = nextMatchesRaw >= 5;
  const nextMatches = grantCrate ? 0 : nextMatchesRaw;
  const nextFree = grantCrate ? currentFree + 1 : currentFree;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      matches_since_last_crate: nextMatches,
      free_crates_available: nextFree,
    })
    .eq("id", resolvedUserId);
  if (updateError) return { success: false, error: "Failed to update crate progress." };

  return {
    success: true,
    matchesSinceLastCrate: nextMatches,
    freeCratesAvailable: nextFree,
  };
}

export async function getUserInventory(userId: string): Promise<PlayerInventoryRow[]> {
  const { resolvedUserId, supabase } = await resolveCaseUserId(userId);
  // eslint-disable-next-line no-console
  console.log("[getUserInventory] resolvedUserId:", resolvedUserId);
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("player_inventory")
    .select("*")
    .eq("user_id", resolvedUserId)
    .order("created_at", { ascending: false });
  // eslint-disable-next-line no-console
  console.log("[getUserInventory] query result:", { data, error });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[Inventory] Failed to load inventory rows", {
      userId: resolvedUserId,
      error: error.message,
    });
    return [];
  }
  // eslint-disable-next-line no-console
  console.log("[Inventory] Loaded inventory rows", {
    userId: resolvedUserId,
    count: (data ?? []).length,
    itemIds: (data ?? []).map((row) => row.item_id),
  });
  return (data ?? []) as PlayerInventoryRow[];
}

export async function equipItem(
  userId: string,
  itemId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const { resolvedUserId, supabase } = await resolveCaseUserId(userId);
  if (!supabase) return { success: false, error: "Supabase is not configured." };
  const { data: selected, error: selectedError } = await supabase
    .from("player_inventory")
    .select("id, item_type")
    .eq("user_id", resolvedUserId)
    .eq("item_id", itemId)
    .single();
  if (selectedError || !selected) return { success: false, error: "Item not found in inventory." };

  const { error: clearError } = await supabase
    .from("player_inventory")
    .update({ equipped: false })
    .eq("user_id", resolvedUserId)
    .eq("item_type", selected.item_type);
  if (clearError) return { success: false, error: "Failed to unequip previous item." };

  const { error: equipError } = await supabase
    .from("player_inventory")
    .update({ equipped: true })
    .eq("user_id", resolvedUserId)
    .eq("item_id", itemId);
  if (equipError) return { success: false, error: "Failed to equip item." };

  return { success: true };
}
