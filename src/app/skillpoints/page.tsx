"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import Footer from "@/components/Footer";
import ModeToggleBarContent from "@/components/ModeToggleBar";
import LoadingRing from "@/components/LoadingRing";
import RankBadge from "@/components/RankBadge";
import RankProgressBar from "@/components/RankProgressBar";
import FoundersReward from "@/components/FoundersReward";
import SPIcon from "@/components/SPIcon";
import { getCurrentUser, logout as apiLogout } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { getUserSPData, SP_REWARDS, type UserSpData } from "@/lib/skillpoints";

type SpTransactionRow = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
};

function formatTypeLabel(type: string): string {
  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function SkillPointsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [username, setUsername] = useState("Player");
  const [isDevMode, setIsDevMode] = useState(false);
  const [spData, setSpData] = useState<UserSpData>({
    lifetimeSp: 1000,
    balanceSp: 1000,
    rankTier: "bronze",
  });
  const [transactions, setTransactions] = useState<SpTransactionRow[]>([]);

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

        const [userSpData] = await Promise.all([getUserSPData(user.id)]);
        if (userSpData) setSpData(userSpData);

        const supabase = createClient();
        if (supabase) {
          const { data } = await supabase
            .from("sp_transactions")
            .select("id, type, amount, description, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20);
          setTransactions((data as SpTransactionRow[] | null) ?? []);
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
        currentPage="skillpoints"
      />
      <ModeToggleBarContent />

      <main className="relative mx-auto flex max-w-[1000px] flex-col gap-6 px-4 py-8 pb-24 md:px-6">
        <section className="rounded-card border border-white/10 bg-card/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-white sm:text-2xl">SkillPoints</h1>
            <RankBadge tier={spData.rankTier} size="large" />
          </div>
          <p className="mt-2 text-sm text-body-gray">
            Spendable balance:{" "}
            <span className="font-semibold text-teal inline-flex items-center gap-1">
              {spData.balanceSp.toLocaleString()} <SPIcon size={16} />
            </span>
          </p>
          <div className="mt-4">
            <RankProgressBar lifetimeSp={spData.lifetimeSp} currentTier={spData.rankTier} />
          </div>
        </section>

        <FoundersReward lifetimeSp={spData.lifetimeSp} currentTier={spData.rankTier} />

        <section className="rounded-card border border-white/10 bg-card/80 p-5">
          <h2 className="text-lg font-semibold text-white">How to Earn SP</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Win a match", value: `+${SP_REWARDS.MATCH_WIN}` },
              { label: "Complete a match", value: `+${SP_REWARDS.MATCH_LOSS}` },
              { label: "Daily first match", value: `+${SP_REWARDS.DAILY_FIRST_MATCH}` },
              { label: "3-win streak", value: `+${SP_REWARDS.STREAK_BONUS}` },
              { label: "Refer a friend", value: `+${SP_REWARDS.REFERRAL_BONUS}` },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-sm text-body-gray">{item.label}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-base font-semibold text-emerald-300">
                  {item.value} <SPIcon size={16} />
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-card border border-white/10 bg-card/80 p-5">
          <h2 className="text-lg font-semibold text-white">Recent SP Activity</h2>
          {transactions.length === 0 ? (
            <p className="mt-3 text-sm text-body-gray">No SP transactions yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{formatTypeLabel(tx.type)}</p>
                    <p className="truncate text-xs text-body-gray">
                      {tx.description || "SkillPoints transaction"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-body-gray">
                      {new Date(tx.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold ${tx.amount >= 0 ? "text-emerald-300" : "text-red-400"}`}>
                    <span className="inline-flex items-center gap-1">
                      {tx.amount >= 0 ? "+" : ""}
                      {tx.amount.toLocaleString()} <SPIcon size={14} />
                    </span>
                  </span>
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
