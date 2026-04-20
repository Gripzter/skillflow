"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import Footer from "@/components/Footer";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import LoadingRing from "@/components/LoadingRing";
import { useToast } from "@/components/Toast";
import { getCurrentUser, logout as apiLogout } from "@/lib/api";
import { equipItem, getUserInventory, type CaseItemRarity } from "@/lib/cases";
import { createClient } from "@/lib/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
};

const RARITY_STYLES: Record<CaseItemRarity, string> = {
  common: "bg-slate-500/20 text-slate-300",
  uncommon: "bg-blue-500/20 text-blue-300",
  rare: "bg-purple-500/20 text-purple-300",
  epic: "bg-pink-500/20 text-pink-300",
  legendary: "bg-amber-500/20 text-amber-300",
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
        let effectiveUserId = user.id;
        if (!UUID_RE.test(effectiveUserId)) {
          const supabase = createClient();
          if (supabase) {
            const { data: profileByName } = await supabase
              .from("profiles")
              .select("id")
              .eq("username", user.username)
              .maybeSingle();
            if (profileByName?.id) {
              effectiveUserId = profileByName.id;
            }
          }
        }
        setUserId(effectiveUserId);
        // eslint-disable-next-line no-console
        console.log("[InventoryPage] Loading inventory for user", {
          userId: effectiveUserId,
          originalUserId: user.id,
          username: user.username,
          isDevMode: user.isDevMode,
        });

        const inventoryRows = await getUserInventory(effectiveUserId);
        setInventory(inventoryRows as InventoryRow[]);

        const supabase = createClient();
        if (supabase) {
          const { data: multiplierRows } = await supabase
            .from("active_multipliers")
            .select("id, multiplier_id, multiplier_name, matches_remaining")
            .eq("user_id", effectiveUserId)
            .gt("matches_remaining", 0)
            .order("created_at", { ascending: true });
          setActiveMultipliers((multiplierRows ?? []) as ActiveMultiplierRow[]);
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
      router.push("/login");
      router.refresh();
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
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {borderItems.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg border p-4 ${
                    item.equipped ? "border-orange-400 bg-orange-500/10" : "border-white/10 bg-black/20"
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{item.item_name}</p>
                  <span className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-medium ${RARITY_STYLES[item.rarity]}`}>
                    {item.rarity}
                  </span>
                  <div className="mt-3">
                    {item.equipped ? (
                      <span className="rounded bg-orange-500/20 px-2 py-1 text-xs font-semibold text-orange-300">
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
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {badgeItems.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg border p-4 ${
                    item.equipped ? "border-orange-400 bg-orange-500/10" : "border-white/10 bg-black/20"
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{item.item_name}</p>
                  <span className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-medium ${RARITY_STYLES[item.rarity]}`}>
                    {item.rarity}
                  </span>
                  <div className="mt-3">
                    {item.equipped ? (
                      <span className="rounded bg-orange-500/20 px-2 py-1 text-xs font-semibold text-orange-300">
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
                  <p className="text-sm font-semibold text-white">
                    {multiplier.multiplier_name || multiplier.multiplier_id}
                  </p>
                  <p className="mt-2 text-xs text-purple-200">
                    {Number(multiplier.matches_remaining)} matches remaining
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
