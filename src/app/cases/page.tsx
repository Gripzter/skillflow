"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import Footer from "@/components/Footer";
import LoadingRing from "@/components/LoadingRing";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import CaseOpeningReel from "@/components/CaseOpeningReel";
import CaseResultModal from "@/components/CaseResultModal";
import SPIcon from "@/components/SPIcon";
import { useToast } from "@/components/Toast";
import {
  CASE_TIERS,
  claimFreeCrate,
  getFreeCrates,
  openCase,
  resolveCaseUserId,
  type CaseDrop,
} from "@/lib/cases";
import { getCurrentUser, logout as apiLogout } from "@/lib/api";
import { getUserSPData } from "@/lib/skillpoints";

type RecentDrop = {
  id: string;
  itemName: string;
  source: "sp" | "inventory";
  createdAt: string;
};

type CaseKey = "bronze" | "gold" | "diamond" | "drop_crate";

const CASE_CARD_META: Record<Exclude<CaseKey, "drop_crate">, { accent: string }> = {
  bronze: { accent: "#CD7F32" },
  gold: { accent: "#FFD700" },
  diamond: { accent: "#B9F2FF" },
};

function parseRewardDescription(description: string | null): string {
  if (!description) return "SP Reward";
  const parts = description.split(":");
  if (parts.length < 2) return description;
  return parts.slice(1).join(":").trim();
}

function renderDropName(itemName: string, source: "sp" | "inventory") {
  if (source !== "sp") return itemName;
  const match = itemName.match(/([+-]?\d[\d,]*)\s*SP/i);
  if (!match) return itemName;
  return (
    <span className="inline-flex items-center gap-1">
      {match[1]} <SPIcon size={14} />
    </span>
  );
}

export default function CasesPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [username, setUsername] = useState("Player");
  const [isDevMode, setIsDevMode] = useState(false);
  const [userId, setUserId] = useState("");
  const [spBalance, setSpBalance] = useState(0);
  const [freeCrates, setFreeCrates] = useState(0);
  const [recentDrops, setRecentDrops] = useState<RecentDrop[]>([]);
  const [isOpening, setIsOpening] = useState(false);
  const [lastOpenedCaseId, setLastOpenedCaseId] = useState<CaseKey | null>(null);
  const [reelData, setReelData] = useState<{ lootTable: CaseDrop[]; winningItem: CaseDrop } | null>(null);
  const [resultItem, setResultItem] = useState<CaseDrop | null>(null);

  const loadDashboard = useCallback(async (uid: string) => {
    const [spData, freeCrateResult] = await Promise.all([
      getUserSPData(uid),
      getFreeCrates(uid),
    ]);
    if (spData) setSpBalance(spData.balanceSp);
    if (freeCrateResult.success) setFreeCrates(freeCrateResult.freeCratesAvailable);

    const supabase = createClient();
    if (!supabase) return;
    const [spDropsRes, inventoryRes] = await Promise.all([
      supabase
        .from("sp_transactions")
        .select("id, description, created_at")
        .eq("user_id", uid)
        .eq("type", "case_reward")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("player_inventory")
        .select("id, item_name, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const spRows = (spDropsRes.data ?? []).map((row) => ({
      id: `sp-${row.id}`,
      itemName: parseRewardDescription(row.description),
      source: "sp" as const,
      createdAt: row.created_at,
    }));
    const inventoryRows = (inventoryRes.data ?? []).map((row) => ({
      id: `inv-${row.id}`,
      itemName: row.item_name ?? "Cosmetic",
      source: "inventory" as const,
      createdAt: row.created_at,
    }));

    const combined = [...spRows, ...inventoryRows]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
    setRecentDrops(combined);
  }, []);

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
        // eslint-disable-next-line no-console
        console.log("[CasesPage] Using user ID for case operations", {
          originalUserId: user.id,
          effectiveUserId,
          username: user.username,
        });
        setUserId(effectiveUserId);
        await loadDashboard(effectiveUserId);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [loadDashboard, router]);

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

  const canOpenAnother = useMemo(() => {
    if (!resultItem || !lastOpenedCaseId) return false;
    if (lastOpenedCaseId === "drop_crate") return freeCrates > 0;
    const tier = CASE_TIERS[lastOpenedCaseId];
    return !!tier && spBalance >= tier.cost_sp;
  }, [freeCrates, lastOpenedCaseId, resultItem, spBalance]);
  const canOpenFreeCrate = freeCrates > 0 && !isOpening;

  async function runOpenCase(caseId: CaseKey) {
    if (!userId) return;
    setIsOpening(true);
    setLastOpenedCaseId(caseId);
    setReelData(null);
    setResultItem(null);

    const result = caseId === "drop_crate"
      ? await claimFreeCrate(userId)
      : await openCase(userId, caseId);

    if (!result.success) {
      setIsOpening(false);
      showToast(result.error, "error");
      return;
    }
    setReelData({ lootTable: result.lootTable, winningItem: result.winningItem });
  }

  async function closeResultModal() {
    setResultItem(null);
    setReelData(null);
    setIsOpening(false);
    if (userId) await loadDashboard(userId);
  }

  if (loading) return <LoadingRing />;

  return (
    <div className="min-h-screen bg-charcoal pb-24 md:pb-0">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username={username}
        isDevMode={isDevMode}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        currentPage="cases"
      />
      <ModeToggleBarContent />

      <main className="relative mx-auto max-w-[1200px] px-4 pt-6 pb-24 sm:px-6 lg:px-8 md:pt-8 md:pb-12">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Cases</h1>
            <p className="mt-1 text-body-gray">
              Spend <SPIcon size={14} />. Open cases. Win rewards.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-2 text-sm">
            <span className="text-body-gray inline-flex items-center gap-1">
              <SPIcon size={14} /> Balance:
            </span>{" "}
            <span className="font-semibold text-teal inline-flex items-center gap-1">
              {spBalance.toLocaleString()} <SPIcon size={14} />
            </span>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {(["bronze", "gold", "diamond"] as const).map((caseId) => {
            const tier = CASE_TIERS[caseId];
            const canAfford = spBalance >= tier.cost_sp;
            const accent = CASE_CARD_META[caseId].accent;
            return (
              <article key={caseId} className="rounded-card border border-white/10 bg-card/80 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-white">{tier.name}</h2>
                  <span className="text-sm font-medium text-body-gray inline-flex items-center gap-1">
                    {tier.cost_sp.toLocaleString()} <SPIcon size={14} />
                  </span>
                </div>
                <div
                  className="mt-4 flex h-28 items-center justify-center rounded-xl border text-sm font-semibold"
                  style={{
                    borderColor: `${accent}88`,
                    boxShadow: `0 0 24px ${accent}33`,
                    color: accent,
                    background: `linear-gradient(135deg, ${accent}24, rgba(12,12,16,0.9))`,
                  }}
                >
                  {tier.name.toUpperCase()}
                </div>
                <button
                  type="button"
                  onClick={() => void runOpenCase(caseId)}
                  disabled={!canAfford || isOpening}
                  className={`mt-4 w-full rounded-lg px-4 py-2.5 font-semibold text-white transition-opacity ${
                    canAfford && !isOpening
                      ? "bg-[#FF5E00] hover:opacity-90"
                      : "cursor-not-allowed bg-white/10 text-gray-500"
                  }`}
                >
                  {canAfford ? "Open" : "Not enough"}
                </button>
              </article>
            );
          })}
        </section>

        <section className="mt-8 rounded-card border border-white/10 bg-card/80 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Drop Crates</h2>
            <p className="text-sm text-body-gray">You have {freeCrates} Drop Crates</p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-body-gray">
              Free case with Bronze-like odds
            </div>
            <button
              type="button"
              onClick={() => void runOpenCase("drop_crate")}
              disabled={!canOpenFreeCrate}
              className={`rounded-lg px-4 py-2.5 font-semibold text-white transition-opacity ${
                canOpenFreeCrate
                  ? "bg-[#FF5E00] hover:opacity-90"
                  : "cursor-not-allowed bg-white/10 text-gray-500"
              }`}
            >
              {freeCrates > 0 ? "Open Free" : "No free crates"}
            </button>
          </div>
        </section>

        <section className="mt-8 rounded-card border border-white/10 bg-card/80 p-5">
          <h2 className="text-lg font-semibold text-white">Recent Drops</h2>
          {recentDrops.length === 0 ? (
            <p className="mt-3 text-sm text-body-gray">No case drops yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {recentDrops.map((drop) => (
                <div
                  key={drop.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {renderDropName(drop.itemName, drop.source)}
                    </p>
                    <p className="text-xs text-body-gray">
                      {drop.source === "sp" ? (
                        <span className="inline-flex items-center gap-1">
                          <SPIcon size={12} /> reward
                        </span>
                      ) : (
                        "Inventory item"
                      )}
                    </p>
                  </div>
                  <p className="text-xs text-body-gray">{new Date(drop.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {reelData ? (
        <CaseOpeningReel
          lootTable={reelData.lootTable}
          winningItem={reelData.winningItem}
          onComplete={(item) => {
            setResultItem(item);
            setIsOpening(false);
          }}
        />
      ) : null}

      {resultItem ? (
        <CaseResultModal
          item={resultItem}
          canOpenAnother={canOpenAnother}
          onClose={() => void closeResultModal()}
          onOpenAnother={() => {
            const sameCase = lastOpenedCaseId;
            setResultItem(null);
            setReelData(null);
            if (sameCase) void runOpenCase(sameCase);
          }}
        />
      ) : null}

      <Footer />
    </div>
  );
}
