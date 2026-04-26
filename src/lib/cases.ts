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
  min_value?: number;
  max_value?: number;
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
      { item_type: "sp", item_id: "bronze_sp_50_150", item_name: "50-150 Skillies", rarity: "common", value: null, min_value: 50, max_value: 150, weight: 40 },
      { item_type: "sp", item_id: "bronze_sp_200_400", item_name: "200-400 Skillies", rarity: "uncommon", value: null, min_value: 200, max_value: 400, weight: 25 },
      { item_type: "border", item_id: "border_bronze_glow", item_name: "Bronze Glow Border", rarity: "common", value: null, weight: 10 },
      { item_type: "badge", item_id: "badge_rookie_crest", item_name: "Rookie Crest Badge", rarity: "common", value: null, weight: 10 },
      { item_type: "sp", item_id: "bronze_sp_500_800", item_name: "500-800 Skillies", rarity: "rare", value: null, min_value: 500, max_value: 800, weight: 10 },
      { item_type: "border", item_id: "border_ruby_arc", item_name: "Ruby Arc Border", rarity: "rare", value: null, weight: 3 },
      { item_type: "badge", item_id: "badge_nova_crest", item_name: "Nova Crest Badge", rarity: "rare", value: null, weight: 2 },
    ],
  },
  gold: {
    id: "gold",
    name: "Gold Case",
    cost_sp: 500,
    loot_table: [
      { item_type: "sp", item_id: "gold_sp_100_400", item_name: "100-400 Skillies", rarity: "common", value: null, min_value: 100, max_value: 400, weight: 35 },
      { item_type: "sp", item_id: "gold_sp_500_900", item_name: "500-900 Skillies", rarity: "uncommon", value: null, min_value: 500, max_value: 900, weight: 25 },
      { item_type: "border", item_id: "border_gold_aura", item_name: "Gold Aura Border", rarity: "rare", value: null, weight: 10 },
      { item_type: "badge", item_id: "badge_victory_mark", item_name: "Victory Mark Badge", rarity: "rare", value: null, weight: 10 },
      { item_type: "sp", item_id: "gold_sp_1000_2000", item_name: "1,000-2,000 Skillies", rarity: "epic", value: null, min_value: 1000, max_value: 2000, weight: 12 },
      { item_type: "border", item_id: "border_ember_crown", item_name: "Ember Crown Border", rarity: "epic", value: null, weight: 3 },
      { item_type: "badge", item_id: "badge_founders_star", item_name: "Founders Star Badge", rarity: "epic", value: null, weight: 2 },
      { item_type: "multiplier", item_id: "mult_2x_24h", item_name: "2x Skillies Multiplier (24h)", rarity: "legendary", value: 24, weight: 3 },
    ],
  },
  diamond: {
    id: "diamond",
    name: "Diamond Case",
    cost_sp: 1000,
    loot_table: [
      { item_type: "sp", item_id: "diamond_sp_200_800", item_name: "200-800 Skillies", rarity: "common", value: null, min_value: 200, max_value: 800, weight: 30 },
      { item_type: "sp", item_id: "diamond_sp_1000_1500", item_name: "1,000-1,500 Skillies", rarity: "uncommon", value: null, min_value: 1000, max_value: 1500, weight: 25 },
      { item_type: "border", item_id: "border_diamond_prism", item_name: "Diamond Prism Border", rarity: "epic", value: null, weight: 10 },
      { item_type: "badge", item_id: "badge_elite_core", item_name: "Elite Core Badge", rarity: "epic", value: null, weight: 10 },
      { item_type: "sp", item_id: "diamond_sp_2000_5000", item_name: "2,000-5,000 Skillies", rarity: "legendary", value: null, min_value: 2000, max_value: 5000, weight: 13 },
      { item_type: "badge", item_id: "badge_omega_founder", item_name: "Omega Founder Badge", rarity: "legendary", value: null, weight: 4 },
      { item_type: "border", item_id: "border_void_royal", item_name: "Void Royal Border", rarity: "legendary", value: null, weight: 3 },
      { item_type: "multiplier", item_id: "mult_3x_24h", item_name: "3x Skillies Multiplier (24h)", rarity: "legendary", value: 24, weight: 5 },
    ],
  },
  drop_crate: {
    id: "drop_crate",
    name: "Drop Crate",
    cost_sp: 0,
    loot_table: [
      { item_type: "sp", item_id: "drop_sp_35", item_name: "35 Skillies", rarity: "common", value: 35, weight: 30 },
      { item_type: "sp", item_id: "drop_sp_70", item_name: "70 Skillies", rarity: "common", value: 70, weight: 24 },
      { item_type: "sp", item_id: "drop_sp_130", item_name: "130 Skillies", rarity: "uncommon", value: 130, weight: 16 },
      { item_type: "sp", item_id: "drop_sp_220", item_name: "220 Skillies", rarity: "rare", value: 220, weight: 8 },
      { item_type: "border", item_id: "drop_border_brushed", item_name: "Brushed Border", rarity: "uncommon", value: null, weight: 8 },
      { item_type: "badge", item_id: "drop_badge_contender", item_name: "Contender Badge", rarity: "uncommon", value: null, weight: 6 },
      { item_type: "multiplier", item_id: "drop_mult_2x_2", item_name: "2x Skillies (2 matches)", rarity: "rare", value: 2, weight: 6 },
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
  created_at?: string;
  acquired_at?: string;
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

function randomIntInRange(min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return min;
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function resolveDropReward(drop: CaseDrop): CaseDrop {
  if (drop.item_type !== "sp") return drop;
  const min = Number(drop.min_value ?? drop.value ?? 0);
  const max = Number(drop.max_value ?? drop.value ?? min);
  const amount = randomIntInRange(min, max);
  return {
    ...drop,
    value: amount,
    item_name: `${amount.toLocaleString()} Skillies`,
  };
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
    .select("balance_sp")
    .eq("id", userId)
    .single();
  if (profileError || !profile) return { success: false, error: "Failed to load user profile." };

  const nextBalance = Number(profile.balance_sp ?? 0) + amount;
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ balance_sp: nextBalance })
    .eq("id", userId);
  if (updateError) return { success: false, error: "Failed to update Skillies balance for case reward." };

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

  const winningItemBase = pickWeightedItem(caseTier.loot_table);
  if (!winningItemBase) return { success: false, error: "Case has no valid rewards configured." };
  const winningItem = resolveDropReward(winningItemBase);

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
    const isTimeBasedMultiplier = /_(\d+)h$/i.test(winningItem.item_id);
    const { error } = await supabase.from("active_multipliers").insert({
      user_id: resolvedUserId,
      multiplier_id: winningItem.item_id,
      multiplier_name: winningItem.item_name,
      matches_remaining: isTimeBasedMultiplier ? 1 : Number(winningItem.value ?? 0),
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

  const normalizeRows = (rows: unknown[]): PlayerInventoryRow[] => {
    const normalized = rows.map((row) => {
      const inventoryRow = row as PlayerInventoryRow;
      return {
        ...inventoryRow,
        created_at: inventoryRow.created_at ?? inventoryRow.acquired_at,
      };
    });
    return normalized.sort((a, b) => {
      const aTime = new Date(a.created_at ?? "").getTime();
      const bTime = new Date(b.created_at ?? "").getTime();
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    });
  };

  const { data: typedData, error: typedError } = await supabase
    .from("player_inventory")
    .select("*")
    .eq("user_id", resolvedUserId);

  // eslint-disable-next-line no-console
  console.log("[getUserInventory] typed query result:", { data: typedData, error: typedError });
  if (!typedError) {
    const rows = normalizeRows((typedData ?? []) as unknown[]);
    // eslint-disable-next-line no-console
    console.log("[Inventory] Loaded inventory rows via typed query", {
      userId: resolvedUserId,
      count: rows.length,
      itemIds: rows.map((row) => row.item_id),
    });
    return rows;
  }

  // eslint-disable-next-line no-console
  console.warn("[Inventory] Typed query failed, trying minimal column fallback", {
    userId: resolvedUserId,
    error: typedError.message,
  });

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("player_inventory")
    .select("id, user_id, item_type, item_id, item_name, rarity, equipped, acquired_at")
    .eq("user_id", resolvedUserId);

  // eslint-disable-next-line no-console
  console.log("[getUserInventory] minimal fallback query result:", { data: fallbackData, error: fallbackError });
  if (!fallbackError) {
    const rows = normalizeRows((fallbackData ?? []) as unknown[]);
    // eslint-disable-next-line no-console
    console.log("[Inventory] Loaded inventory rows via minimal fallback query", {
      userId: resolvedUserId,
      count: rows.length,
      itemIds: rows.map((row) => row.item_id),
    });
    return rows;
  }

  // eslint-disable-next-line no-console
  console.warn("[Inventory] Minimal fallback query failed, trying REST API fallback", {
    userId: resolvedUserId,
    error: fallbackError.message,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    // eslint-disable-next-line no-console
    console.error("[Inventory] Supabase REST fallback unavailable: missing env vars", {
      userId: resolvedUserId,
    });
    return [];
  }

  try {
    const restUrl = `${supabaseUrl}/rest/v1/player_inventory?user_id=eq.${encodeURIComponent(
      resolvedUserId
    )}&select=*`;
    const response = await fetch(restUrl, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    });
    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error("[Inventory] REST fallback request failed", {
        userId: resolvedUserId,
        status: response.status,
      });
      return [];
    }
    const restRows = (await response.json()) as unknown[];
    const rows = normalizeRows(restRows ?? []);
    // eslint-disable-next-line no-console
    console.log("[Inventory] Loaded inventory rows via REST fallback", {
      userId: resolvedUserId,
      count: rows.length,
      itemIds: rows.map((row) => row.item_id),
    });
    return rows;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Inventory] REST fallback threw unexpected error", {
      userId: resolvedUserId,
      error,
    });
    return [];
  }
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
