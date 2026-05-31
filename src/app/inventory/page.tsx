"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import AppNavbar from "@/components/AppNavbar";
import Footer from "@/components/Footer";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import LoadingRing from "@/components/LoadingRing";
import { useToast } from "@/components/Toast";
import { getCurrentUser, logout as apiLogout } from "@/lib/api";
import { equipItem, getUserInventory, resolveCaseUserId, type CaseItemRarity } from "@/lib/cases";
import { createClient } from "@/lib/supabase";

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

const RARITY_STYLES: Record<CaseItemRarity, string> = {
  common: "bg-slate-500/20 text-slate-300",
  uncommon: "bg-blue-500/20 text-blue-300",
  rare: "bg-purple-500/20 text-purple-300",
  epic: "bg-pink-500/20 text-pink-300",
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

export default function InventoryPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [username, setUsername] = useState("Player");
  const [isDevMode, setIsDevMode] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [activeMultipliers, setActiveMultipliers] = useState<ActiveMultiplierRow[]>([]);
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

  const [equippingItemId, setEquippingItemId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.push("/login");
          return;
        }

        setUsername(user.username);
        setIsDevMode(user.isDevMode ?? false);
        const { resolvedUserId: effectiveUserId } = await resolveCaseUserId(user.id);
        setUserId(effectiveUserId);
        // eslint-disable-next-line no-console
        console.log("[InventoryPage] Loading inventory for user", {
          userId: effectiveUserId,
          originalUserId: user.id,
          username: user.username,
          isDevMode: user.isDevMode,
        });

        const inventory = await getUserInventory(effectiveUserId);
        // eslint-disable-next-line no-console
        console.log("[Inventory Page] userId:", effectiveUserId);
        // eslint-disable-next-line no-console
        console.log("[Inventory Page] raw inventory:", inventory);
        setInventory(inventory as InventoryRow[]);

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
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiLogout();
    } catch {
      setLoggingOut(false);
    }
  }

  async function handleEquip(itemId: string) {
    if (!userId || equippingItemId) return;
    setEquippingItemId(itemId);
    try {
      const result = await equipItem(userId, itemId);
      if (!result.success) {
        showToast(result.error, "error");
        return;
      }
      const updated = await getUserInventory(userId);
      setInventory(updated as InventoryRow[]);
      showToast("Cosmetic equipped.", "success");
    } finally {
      setEquippingItemId(null);
    }
  }

  const borderItems = useMemo(
    () => inventory.filter((item) => item.item_type === "border"),
    [inventory]
  );
  const badgeItems = useMemo(
    () => inventory.filter((item) => item.item_type === "badge"),
    [inventory]
  );

  function getInventoryPreviewImage(item: InventoryRow): string | null {
    if (item.item_type === "badge") {
      if (item.item_id === "badge_omega_founder" || item.item_name === "Omega Founder Badge") {
        return "/images/badge-founders.png";
      }
      return null;
    }
    const image = BORDER_PREVIEW_BY_RARITY[item.rarity];
    return image || null;
  }

  if (loading) {
    return <LoadingRing />;
  }

  return (
    <div className="min-h-screen bg-charcoal pb-20 md:pb-0">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username={username}
        isDevMode={isDevMode}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        currentPage="inventory"
      />
      <ModeToggleBarContent />

      <main className="relative mx-auto flex max-w-[1100px] flex-col gap-8 px-4 py-8 pb-24 md:px-6">
        <section>
          <h1 className="text-2xl font-bold text-white">Inventory</h1>
        </section>

        <section className="rounded-card border border-white/10 bg-card/80 p-5">
          <h2 className="text-lg font-semibold text-white">Borders</h2>
          {borderItems.length === 0 ? (
            <p className="mt-3 text-sm text-body-gray">No borders yet — open cases to find some!</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {borderItems.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border p-5 ${
                    item.equipped ? "border-yellow-400 bg-yellow-500/10" : "border-white/10 bg-black/20"
                  }`}
                >
                  <div className="mb-4 flex items-center justify-center">
                    {getInventoryPreviewImage(item) ? (
                      <div className="relative h-20 w-20 overflow-hidden rounded-full border border-white/20 bg-black/40 p-2">
                        <Image
                          src={getInventoryPreviewImage(item) as string}
                          alt={`${item.item_name} preview`}
                          fill
                          className="object-contain p-2"
                        />
                      </div>
                    ) : item.rarity === "legendary" ? (
                      <div className="h-20 w-20 rounded-full bg-gradient-to-br from-amber-300 via-orange-500 to-yellow-400 p-1">
                        <div className="h-full w-full rounded-full bg-charcoal/90" />
                      </div>
                    ) : (
                      <div className={`h-20 w-20 rounded-full border-4 ${RARITY_RING_STYLES[item.rarity]} bg-charcoal/90`} />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white">{item.item_name}</p>
                  <span className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-medium ${RARITY_STYLES[item.rarity]}`}>
                    {item.rarity}
                  </span>
                  <div className="mt-3">
                    {item.equipped ? (
                      <span className="rounded bg-yellow-500/20 px-2 py-1 text-xs font-semibold text-yellow-300">
                        Equipped
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleEquip(item.item_id)}
                        disabled={equippingItemId === item.item_id}
                        className="rounded bg-teal px-3 py-1.5 text-xs font-semibold text-charcoal disabled:opacity-60"
                      >
                        Equip
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-card border border-white/10 bg-card/80 p-5">
          <h2 className="text-lg font-semibold text-white">Badges</h2>
          {badgeItems.length === 0 ? (
            <p className="mt-3 text-sm text-body-gray">No badges yet — open cases to find some!</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {badgeItems.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border p-5 ${
                    item.equipped ? "border-yellow-400 bg-yellow-500/10" : "border-white/10 bg-black/20"
                  }`}
                >
                  <div className="mb-4 flex items-center justify-center">
                    {getInventoryPreviewImage(item) ? (
                      <div className="relative h-20 w-20 overflow-hidden rounded-full border border-white/20 bg-black/40 p-2">
                        <Image
                          src={getInventoryPreviewImage(item) as string}
                          alt={`${item.item_name} preview`}
                          fill
                          className="object-contain p-2"
                        />
                      </div>
                    ) : item.rarity === "legendary" ? (
                      <div className="h-20 w-20 rounded-full bg-gradient-to-br from-amber-300 via-orange-500 to-yellow-400 p-1">
                        <div className="h-full w-full rounded-full bg-charcoal/90" />
                      </div>
                    ) : (
                      <div className={`h-20 w-20 rounded-full border-4 ${RARITY_RING_STYLES[item.rarity]} bg-charcoal/90`} />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white">{item.item_name}</p>
                  <span className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-medium ${RARITY_STYLES[item.rarity]}`}>
                    {item.rarity}
                  </span>
                  <div className="mt-3">
                    {item.equipped ? (
                      <span className="rounded bg-yellow-500/20 px-2 py-1 text-xs font-semibold text-yellow-300">
                        Equipped
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleEquip(item.item_id)}
                        disabled={equippingItemId === item.item_id}
                        className="rounded bg-teal px-3 py-1.5 text-xs font-semibold text-charcoal disabled:opacity-60"
                      >
                        Equip
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
                        src={multiplier.multiplier_id.includes("3x") ? "/images/multiplier-3x.png" : "/images/multiplier-2x.png"}
                        alt={multiplier.multiplier_name || multiplier.multiplier_id}
                        fill
                        className="object-contain"
                      />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      {multiplier.multiplier_name || multiplier.multiplier_id}
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-purple-200">
                    {getMultiplierStatusLabel(multiplier)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
