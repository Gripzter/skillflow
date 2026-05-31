"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import AppNavbar from "@/components/AppNavbar";
import Footer from "@/components/Footer";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import LoadingRing from "@/components/LoadingRing";
import { useToast } from "@/components/Toast";
import { dispatchWalletUpdated } from "@/components/AppNavbar";
import { getCurrentUser, logout as apiLogout } from "@/lib/api";
import {
  equipItem,
  getUserInventory,
  resolveCaseUserId,
  unequipItem,
  type CaseItemRarity,
} from "@/lib/cases";
import { createClient } from "@/lib/supabase";
import { redirectToAuthAction } from "@/lib/auth-action";
import {
  dispatchCosmeticsUpdated,
  getSellValue,
  sortByRarityDesc,
} from "@/lib/inventory-cosmetics";
import {
  getInventoryPreviewImage,
  getInventoryRingFallbackClass,
  INVENTORY_RARITY_STYLES,
} from "@/lib/inventory-ui";

type InventoryRow = {
  id: string;
  user_id: string;
  item_type: "border" | "badge";
  item_id: string;
  item_name: string;
  rarity: CaseItemRarity;
  equipped: boolean;
  created_at: string;
};

type ActiveMultiplierRow = {
  id: string;
  multiplier_id: string;
  multiplier_name: string | null;
  matches_remaining: number;
  created_at: string;
};

type SellTarget = InventoryRow | null;

export default function InventoryPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [username, setUsername] = useState("Player");
  const [isDevMode, setIsDevMode] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [activeMultipliers, setActiveMultipliers] = useState<ActiveMultiplierRow[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [actionRowId, setActionRowId] = useState<string | null>(null);
  const [sellTarget, setSellTarget] = useState<SellTarget>(null);
  const [selling, setSelling] = useState(false);
  const [badgeLimitOpen, setBadgeLimitOpen] = useState(false);

  const refreshInventory = useCallback(async (uid: string) => {
    const rows = await getUserInventory(uid);
    setInventory(rows as InventoryRow[]);
  }, []);

  function getMultiplierStatusLabel(multiplier: ActiveMultiplierRow): string {
    const hourMatch = multiplier.multiplier_id.match(/_(\d+)h$/i);
    if (hourMatch) {
      const totalHours = Number(hourMatch[1]);
      const createdAtMs = new Date(multiplier.created_at).getTime();
      const expiresAtMs = createdAtMs + totalHours * 60 * 60 * 1000;
      const remainingMs = expiresAtMs - Date.now();
      const remainingHours = Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000)));
      return remainingHours > 0 ? `${remainingHours}h remaining` : "Expired";
    }
    return `${Number(multiplier.matches_remaining)} matches remaining`;
  }

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }
        setIsAuthenticated(true);
        setUsername(user.username);
        setIsDevMode(user.isDevMode ?? false);
        const { resolvedUserId: effectiveUserId } = await resolveCaseUserId(user.id);
        setUserId(effectiveUserId);
        await refreshInventory(effectiveUserId);

        const supabase = createClient();
        if (supabase) {
          const { data: multiplierRows } = await supabase
            .from("active_multipliers")
            .select("id, multiplier_id, multiplier_name, matches_remaining, created_at")
            .eq("user_id", effectiveUserId)
            .order("created_at", { ascending: true });
          const filtered = ((multiplierRows ?? []) as ActiveMultiplierRow[]).filter((row) => {
            const hourMatch = row.multiplier_id.match(/_(\d+)h$/i);
            if (hourMatch) {
              const totalHours = Number(hourMatch[1]);
              const createdAtMs = new Date(row.created_at).getTime();
              const expiresAtMs = createdAtMs + totalHours * 60 * 60 * 1000;
              return Number.isFinite(createdAtMs) && Date.now() < expiresAtMs;
            }
            return Number(row.matches_remaining ?? 0) > 0;
          });
          setActiveMultipliers(filtered);
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [refreshInventory]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiLogout();
    } catch {
      setLoggingOut(false);
    }
  }

  async function handleEquip(row: InventoryRow) {
    if (!isAuthenticated) {
      redirectToAuthAction();
      return;
    }
    if (!userId || actionRowId) return;
    setActionRowId(row.id);
    try {
      const result = await equipItem(userId, row.id);
      if (!result.success) {
        if (result.code === "badge_limit") {
          setBadgeLimitOpen(true);
        } else {
          showToast(result.error, "error");
        }
        return;
      }
      await refreshInventory(userId);
      dispatchCosmeticsUpdated();
      showToast("Cosmetic equipped.", "success");
    } finally {
      setActionRowId(null);
    }
  }

  async function handleUnequip(row: InventoryRow) {
    if (!userId || actionRowId) return;
    setActionRowId(row.id);
    try {
      const result = await unequipItem(userId, row.id);
      if (!result.success) {
        showToast(result.error, "error");
        return;
      }
      await refreshInventory(userId);
      dispatchCosmeticsUpdated();
      showToast("Item unequipped.", "success");
    } finally {
      setActionRowId(null);
    }
  }

  async function confirmSell() {
    if (!sellTarget || selling) return;
    setSelling(true);
    try {
      const res = await fetch("/api/inventory/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: sellTarget.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Failed to sell item.", "error");
        return;
      }
      if (userId) await refreshInventory(userId);
      dispatchWalletUpdated();
      dispatchCosmeticsUpdated();
      showToast(`Sold ${data.itemName ?? sellTarget.item_name} for ${data.skilliesEarned} Skillies`, "success");
      setSellTarget(null);
    } catch {
      showToast("Failed to sell item. Please try again.", "error");
    } finally {
      setSelling(false);
    }
  }

  const borderItems = useMemo(
    () => sortByRarityDesc(inventory.filter((item) => item.item_type === "border")),
    [inventory]
  );
  const badgeItems = useMemo(
    () => sortByRarityDesc(inventory.filter((item) => item.item_type === "badge")),
    [inventory]
  );
  const equippedBadges = useMemo(() => badgeItems.filter((b) => b.equipped), [badgeItems]);

  function renderItemPreview(item: InventoryRow) {
    const preview = getInventoryPreviewImage(item);
    if (preview) {
      return (
        <div className="relative h-20 w-20 overflow-hidden rounded-full border border-white/20 bg-black/40 p-2">
          <Image src={preview} alt={`${item.item_name} preview`} fill className="object-contain p-2" />
        </div>
      );
    }
    if (item.rarity === "legendary") {
      return (
        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-amber-300 via-orange-500 to-yellow-400 p-1">
          <div className="h-full w-full rounded-full bg-charcoal/90" />
        </div>
      );
    }
    return (
      <div
        className={`h-20 w-20 rounded-full border-4 bg-charcoal/90 ${getInventoryRingFallbackClass(item.rarity)}`}
      />
    );
  }

  function renderItemCard(item: InventoryRow) {
    const sellValue = getSellValue(item.rarity);
    const busy = actionRowId === item.id;

    return (
      <div
        key={item.id}
        className={`rounded-xl border p-5 ${
          item.equipped ? "border-yellow-400 bg-yellow-500/10" : "border-white/10 bg-black/20"
        }`}
      >
        <div className="mb-4 flex items-center justify-center">{renderItemPreview(item)}</div>
        <p className="text-sm font-semibold text-white">{item.item_name}</p>
        <span
          className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${INVENTORY_RARITY_STYLES[item.rarity]}`}
        >
          {item.rarity}
        </span>
        <div className="mt-3 flex flex-wrap gap-2">
          {item.equipped ? (
            <button
              type="button"
              onClick={() => handleUnequip(item)}
              disabled={busy}
              className="rounded border border-white/25 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-60"
            >
              Unequip
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleEquip(item)}
              disabled={busy}
              className="rounded bg-[#FFFF00] px-3 py-1.5 text-xs font-bold text-black disabled:opacity-60"
            >
              Equip
            </button>
          )}
          {item.equipped ? (
            <span
              className="rounded bg-white/5 px-3 py-1.5 text-xs text-body-gray"
              title="Unequip before selling"
            >
              Equipped
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setSellTarget(item)}
              disabled={busy}
              className="rounded border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-60"
            >
              Sell · {sellValue} S
            </button>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingRing />;
  }

  return (
    <div className="min-h-screen bg-charcoal pb-20 md:pb-0">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username={isAuthenticated ? username : undefined}
        isDevMode={isDevMode}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        currentPage="inventory"
      />
      <ModeToggleBarContent />

      <main className="relative mx-auto flex max-w-[1100px] flex-col gap-8 px-4 py-8 pb-24 md:px-6">
        <section>
          <h1 className="text-2xl font-bold text-white">
            Inventory ({inventory.length} {inventory.length === 1 ? "item" : "items"})
          </h1>
        </section>

        <section className="rounded-card border border-white/10 bg-card/80 p-5">
          <h2 className="text-lg font-semibold text-white">Borders</h2>
          {borderItems.length === 0 ? (
            <p className="mt-3 text-sm text-body-gray">No borders yet — open cases to find some!</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {borderItems.map(renderItemCard)}
            </div>
          )}
        </section>

        <section className="rounded-card border border-white/10 bg-card/80 p-5">
          <h2 className="text-lg font-semibold text-white">Badges</h2>
          {badgeItems.length === 0 ? (
            <p className="mt-3 text-sm text-body-gray">No badges yet — open cases to find some!</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {badgeItems.map(renderItemCard)}
            </div>
          )}
        </section>

        <section className="rounded-card border border-white/10 bg-card/80 p-5">
          <h2 className="text-lg font-semibold text-white">Active Multipliers</h2>
          {activeMultipliers.length === 0 ? (
            <p className="mt-3 text-sm text-body-gray">No active multipliers</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeMultipliers.map((multiplier) => (
                <div key={multiplier.id} className="rounded-lg border border-purple-500/25 bg-purple-500/10 p-4">
                  <div className="flex items-center gap-2">
                    <div className="relative h-8 w-8 overflow-hidden rounded">
                      <Image
                        src={
                          multiplier.multiplier_id.includes("3x")
                            ? "/images/multiplier-3x.png"
                            : "/images/multiplier-2x.png"
                        }
                        alt={multiplier.multiplier_name || multiplier.multiplier_id}
                        fill
                        className="object-contain"
                      />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      {multiplier.multiplier_name || multiplier.multiplier_id}
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-purple-200">{getMultiplierStatusLabel(multiplier)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {sellTarget ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-card p-6">
            <h3 className="text-lg font-bold text-white">Sell item?</h3>
            <div className="mt-4 flex flex-col items-center gap-3">
              {renderItemPreview(sellTarget)}
              <p className="text-center font-semibold text-white">{sellTarget.item_name}</p>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${INVENTORY_RARITY_STYLES[sellTarget.rarity]}`}
              >
                {sellTarget.rarity}
              </span>
              <p className="text-sm text-[#FFFF00]">
                Sell for {getSellValue(sellTarget.rarity)} Skillies
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setSellTarget(null)}
                disabled={selling}
                className="flex-1 rounded-lg border border-white/20 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmSell()}
                disabled={selling}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-60"
              >
                {selling ? "Selling…" : "Sell"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {badgeLimitOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-card p-6">
            <h3 className="text-lg font-bold text-white">Badge limit reached</h3>
            <p className="mt-2 text-sm text-body-gray">
              You can only display 3 badges. Unequip one first.
            </p>
            <ul className="mt-4 space-y-2">
              {equippedBadges.map((badge) => (
                <li
                  key={badge.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                >
                  <span className="text-sm text-white">{badge.item_name}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleUnequip(badge);
                      setBadgeLimitOpen(false);
                    }}
                    className="rounded bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20"
                  >
                    Unequip
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setBadgeLimitOpen(false)}
              className="mt-4 w-full rounded-lg border border-white/20 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      <Footer />
    </div>
  );
}
