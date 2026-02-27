"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import AppNavbar, { dispatchWalletUpdated } from "@/components/AppNavbar";
import Footer from "@/components/Footer";
import {
  getCurrentUser,
  getWalletBalance,
  getTransactions,
  deposit as apiDeposit,
  withdraw as apiWithdraw,
  logout as apiLogout,
} from "@/lib/api";
import type { StoredTransaction } from "@/lib/wallet";
import { createClient } from "@/lib/supabase";

const MIN_DEPOSIT = 5;
const MAX_DEPOSIT = 500;
const MIN_WITHDRAWAL = 10;

type TransactionType = StoredTransaction["type"];

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

const TYPE_BADGE_CLASS: Record<TransactionType, string> = {
  deposit: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  withdrawal: "bg-red-500/20 text-red-400 border-red-500/30",
  match_entry: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  match_win: "bg-teal/20 text-teal border-teal/30",
  match_refund: "bg-purple/20 text-purple border-purple/30",
  platform_fee: "bg-white/10 text-body-gray border-white/10",
};

export default function WalletPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [username, setUsername] = useState<string>("Player");
  const [isDevMode, setIsDevMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);

  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [showDevTopUp, setShowDevTopUp] = useState(false);

  async function refreshFromApi() {
    try {
      const [bal, txs] = await Promise.all([getWalletBalance(), getTransactions()]);
      setBalance(bal);
      setTransactions(txs);
      dispatchWalletUpdated();
    } catch {
      showToast("Failed to refresh wallet", "error");
    }
  }

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
        // Ensure wallet exists with 0 balance for new users
        const supabase = createClient();
        if (supabase) {
          const { data: wallets } = await supabase
            .from("wallets")
            .select("id")
            .eq("user_id", user.id);
          if (!wallets || wallets.length === 0) {
            await supabase
              .from("wallets")
              .insert({ user_id: user.id, balance: 0 });
          }
        }
        const isDevEnv = process.env.NODE_ENV !== "production";
        let isDevHost = false;
        if (typeof window !== "undefined") {
          const host = window.location.hostname;
          isDevHost =
            host.includes("localhost") || host.includes("vercel.app");
        }
        setShowDevTopUp(isDevEnv || isDevHost || (user.isDevMode ?? false));
        await refreshFromApi();
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
      showToast("Logged out successfully", "success");
      router.push("/login");
      router.refresh();
    } catch {
      showToast("Something went wrong", "error");
      setLoggingOut(false);
    }
  }

  function getDepositAmount(): number {
    if (selectedPreset != null) return selectedPreset;
    const n = parseFloat(customAmount);
    return Number.isFinite(n) ? n : 0;
  }

  async function handleDeposit() {
    const amount = getDepositAmount();
    if (amount < MIN_DEPOSIT) {
      showToast(`Minimum deposit is $${MIN_DEPOSIT}.00`, "error");
      return;
    }
    if (amount > MAX_DEPOSIT) {
      showToast(`Maximum deposit is $${MAX_DEPOSIT}.00`, "error");
      return;
    }
    setDepositLoading(true);
    try {
      const newBalance = await apiDeposit(amount);
      setBalance(newBalance);
      const txs = await getTransactions();
      setTransactions(txs);
      dispatchWalletUpdated();
      setSelectedPreset(null);
      setCustomAmount("");
      showToast(`Successfully deposited $${amount.toFixed(2)}!`, "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Deposit failed", "error");
    } finally {
      setDepositLoading(false);
    }
  }

  async function handleWithdraw() {
    const amount = parseFloat(withdrawAmount);
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
      showToast(`Minimum withdrawal is $${MIN_WITHDRAWAL}.00`, "error");
      return;
    }
    if (amount > balance) {
      showToast("Insufficient balance", "error");
      return;
    }
    setWithdrawLoading(true);
    try {
      const newBalance = await apiWithdraw(amount);
      setBalance(newBalance);
      const txs = await getTransactions();
      setTransactions(txs);
      dispatchWalletUpdated();
      setWithdrawAmount("");
      showToast(`Withdrawal of $${amount.toFixed(2)} submitted.`, "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Withdrawal failed", "error");
    } finally {
      setWithdrawLoading(false);
    }
  }

  async function handleAddTestBalance() {
    try {
      // Dev-mode (localStorage wallet)
      const isDev =
        typeof window !== "undefined" &&
        window.localStorage.getItem("skillflow_dev_mode") === "true";
      if (isDev) {
        const newBalance = await apiDeposit(50);
        setBalance(newBalance);
        const txs = await getTransactions();
        setTransactions(txs);
        dispatchWalletUpdated();
        showToast("Added $50 test balance", "success");
        return;
      }

      // Real Supabase accounts
      const supabase = createClient();
      if (!supabase) {
        showToast("Supabase is not configured", "error");
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: wallets, error: walletError } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .single();
      if (walletError && walletError.code !== "PGRST116") {
        // PGRST116 = no rows
        throw walletError;
      }
      if (wallets) {
        await supabase
          .from("wallets")
          .update({ balance: Number(wallets.balance ?? 0) + 50 })
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("wallets")
          .insert({ user_id: user.id, balance: 50 });
      }

      await supabase.from("transactions").insert({
        user_id: user.id,
        type: "deposit",
        amount: 50,
        description: "Test balance (development)",
      });

      await refreshFromApi();
      showToast("Added $50 test balance", "success");
    } catch {
      showToast("Failed to add test balance", "error");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <svg className="h-10 w-10 animate-spin text-teal" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-charcoal pb-20 md:pb-0">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <p className="border-b border-white/5 bg-charcoal/80 px-4 py-2 text-center text-xs text-body-gray">
        Practice matches don&apos;t affect your balance.
      </p>
      <AppNavbar
        username={username}
        isDevMode={isDevMode}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        currentPage="wallet"
      />

      <main className="relative mx-auto max-w-[1000px] px-4 pt-6 pb-24 sm:px-6 lg:px-8 md:pt-8 md:pb-12">
        {/* Balance card */}
        <section className="animate-fade-in relative overflow-hidden rounded-card border border-white/10 bg-card p-8 sm:p-10">
          <div className="absolute inset-0 rounded-card border-2 border-transparent bg-gradient-to-r from-teal/20 via-transparent to-purple/20 opacity-60" />
          <div className="relative text-center">
            <p className="text-body-gray">Your Balance</p>
            <p className="mt-2 text-4xl font-bold text-white sm:text-5xl">
              ${balance.toFixed(2)}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => document.getElementById("quick-deposit")?.scrollIntoView({ behavior: "smooth" })}
                className="pressable w-full rounded-lg bg-teal px-6 py-3 font-semibold text-charcoal transition-all hover:shadow-teal-glow sm:w-auto"
              >
                Deposit
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("withdraw-funds")?.scrollIntoView({ behavior: "smooth" })}
                className="pressable w-full rounded-lg border border-white/30 bg-transparent px-6 py-3 font-semibold text-white transition-colors hover:bg-white/5 sm:w-auto"
              >
                Withdraw
              </button>
            </div>
            <p className="mt-4 text-xs text-body-gray">
              Minimum deposit: $5.00 • Minimum withdrawal: $10.00
            </p>
          </div>
        </section>

        {showDevTopUp && (
          <section className="mt-4">
            <div className="rounded-card border border-amber-400/70 border-dashed bg-amber-500/5 p-4 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/80 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span>DEV TOOL</span>
              </div>
              <button
                type="button"
                onClick={handleAddTestBalance}
                className="mt-3 w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-charcoal shadow-[0_0_16px_rgba(245,158,11,0.45)] transition hover:bg-amber-400 sm:w-auto"
              >
                🧪 Add $50 Test Balance
              </button>
              <p className="mt-2 text-xs text-amber-100/80">
                Development only — will be removed in production.
              </p>
            </div>
          </section>
        )}

        {/* Quick Deposit */}
        <section id="quick-deposit" className="mt-8">
          <h2 className="text-xl font-bold text-white">Quick Deposit</h2>
          <div className="card-border mt-4 rounded-card bg-card p-6">
            <div className="flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setSelectedPreset(selectedPreset === amt ? null : amt);
                    setCustomAmount("");
                  }}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-all active:scale-95 ${
                    selectedPreset === amt
                      ? "border-teal bg-teal text-charcoal"
                      : "border-teal/50 bg-[#1A1D27] text-white hover:border-teal"
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
            <p className="mt-4 text-sm text-body-gray">Or enter custom amount</p>
            <input
              type="number"
              min={MIN_DEPOSIT}
              max={MAX_DEPOSIT}
              step="0.01"
              placeholder="0.00"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setSelectedPreset(null);
              }}
              className="mt-2 w-full max-w-xs rounded-lg border border-white/10 bg-[#1A1D27] px-4 py-3 text-white placeholder:text-body-gray focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
            <button
              type="button"
              onClick={handleDeposit}
              disabled={depositLoading || getDepositAmount() < MIN_DEPOSIT}
              className="mt-4 w-full max-w-xs rounded-lg bg-teal py-3 font-semibold text-charcoal transition-all hover:shadow-teal-glow disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
            >
              {depositLoading ? "Processing…" : "Deposit"}
            </button>
          </div>
        </section>

        {/* Transaction History */}
        <section className="mt-10">
          <h2 className="text-xl font-bold text-white">Transaction History</h2>
          <div className="card-border mt-4 overflow-hidden rounded-card bg-card">
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-body-gray">
                <p>No transactions yet. Make your first deposit to get started!</p>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="px-4 py-3 font-medium text-body-gray">Date</th>
                        <th className="px-4 py-3 font-medium text-body-gray">Type</th>
                        <th className="px-4 py-3 font-medium text-body-gray">Description</th>
                        <th className="px-4 py-3 font-medium text-body-gray">Amount</th>
                        <th className="px-4 py-3 font-medium text-body-gray">Balance After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-white/5 last:border-0">
                          <td className="px-4 py-3 text-body-gray">
                            {new Date(tx.created_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_CLASS[tx.type]}`}
                            >
                              {tx.type.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-body-gray">{tx.description ?? "—"}</td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                tx.amount >= 0 ? "font-medium text-emerald-400" : "font-medium text-red-400"
                              }
                            >
                              {tx.amount >= 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-white">${tx.balance_after.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-2 p-4 md:hidden">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-[#1A1D27] p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_CLASS[tx.type]}`}
                        >
                          {tx.type.replace("_", " ")}
                        </span>
                        <span className="text-body-gray">{tx.description ?? "—"}</span>
                      </div>
                      <div className="text-right">
                        <span
                          className={
                            tx.amount >= 0 ? "font-medium text-emerald-400" : "font-medium text-red-400"
                          }
                        >
                          {tx.amount >= 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                        </span>
                        <p className="text-xs text-body-gray">
                          {new Date(tx.created_at).toLocaleDateString()} • ${tx.balance_after.toFixed(2)} after
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Withdraw */}
        <section id="withdraw-funds" className="mt-10">
          <h2 className="text-xl font-bold text-white">Withdraw Funds</h2>
          <div className="card-border mt-4 rounded-card bg-card p-6">
            <input
              type="number"
              min={MIN_WITHDRAWAL}
              max={balance}
              step="0.01"
              placeholder="0.00"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-white/10 bg-[#1A1D27] px-4 py-3 text-white placeholder:text-body-gray focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={
                withdrawLoading ||
                !withdrawAmount ||
                parseFloat(withdrawAmount) < MIN_WITHDRAWAL ||
                parseFloat(withdrawAmount) > balance
              }
              className="mt-4 rounded-lg border border-white/30 bg-transparent px-6 py-3 font-semibold text-white transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {withdrawLoading ? "Processing…" : "Withdraw"}
            </button>
            <p className="mt-4 text-xs text-body-gray">
              Withdrawals are processed within 1–3 business days.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
