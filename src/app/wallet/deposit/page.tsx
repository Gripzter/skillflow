"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppNavbar from "@/components/AppNavbar";
import { getCurrentUser, getWalletBalance } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { MIN_DEPOSIT, MAX_DEPOSIT } from "@/lib/constants";

const PRESETS = [5, 10, 25, 50, 100];

export default function DepositPage() {
  const router = useRouter();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [depositLoading, setDepositLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(25);
  const [customAmount, setCustomAmount] = useState("");

  const amount =
    selectedPreset != null ? selectedPreset : parseFloat(customAmount) || 0;
  const validAmount = amount >= MIN_DEPOSIT && amount <= MAX_DEPOSIT;

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.push("/login");
          return;
        }
        const bal = await getWalletBalance();
        setBalance(bal);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleDeposit() {
    if (!validAmount) return;
    setError(null);
    setDepositLoading(true);

    try {
      const supabase = createClient();
      if (!supabase) {
        setError("Not configured");
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          userId: user.id,
          userEmail: user.email ?? undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to create checkout");
        setDepositLoading(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("No redirect URL received");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setDepositLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username=""
        isDevMode={false}
        onLogout={async () => {}}
        loggingOut={false}
        currentPage="wallet"
      />

      <main className="relative mx-auto max-w-[500px] px-4 pt-8 pb-12">
        <Link
          href="/wallet"
          className="inline-flex items-center gap-2 text-body-gray transition-colors hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Wallet
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-white">Deposit Funds</h1>
        <p className="mt-1 text-body-gray">Add money to your SkillFlow wallet</p>

        <div className="mt-6 rounded-card border border-white/10 bg-card p-4">
          <p className="text-body-gray">Current balance</p>
          <p className="text-2xl font-bold text-white">${balance.toFixed(2)}</p>
        </div>

        <div className="mt-8">
          <p className="font-medium text-white">Amount</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => {
                  setSelectedPreset(amt);
                  setCustomAmount("");
                }}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  selectedPreset === amt
                    ? "border-teal bg-teal text-charcoal"
                    : "border-teal/50 bg-[#1A1D27] text-white hover:border-teal"
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm text-body-gray">Other amount</p>
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
            className="mt-2 w-full rounded-lg border border-white/10 bg-[#1A1D27] px-4 py-3 text-white placeholder:text-body-gray focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
          {amount > 0 && (amount < MIN_DEPOSIT || amount > MAX_DEPOSIT) && (
            <p className="mt-2 text-sm text-red-400">
              {amount < MIN_DEPOSIT
                ? `Minimum is $${MIN_DEPOSIT}.00`
                : `Maximum is $${MAX_DEPOSIT}.00`}
            </p>
          )}
        </div>

        <div className="mt-8 rounded-card border border-white/10 bg-card/50 p-4 text-sm text-body-gray">
          <p>You&apos;ll be redirected to Stripe&apos;s secure payment page.</p>
          <p className="mt-2">We never see or store your card details.</p>
          <p className="mt-3 font-medium text-white">Visa, Mastercard, Amex</p>
          <p className="mt-1">🔒 Secured by Stripe</p>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        )}

        <button
          type="button"
          onClick={handleDeposit}
          disabled={depositLoading || !validAmount}
          className="mt-8 w-full rounded-lg bg-teal py-3.5 text-lg font-semibold text-charcoal transition-all hover:shadow-teal-glow disabled:cursor-not-allowed disabled:opacity-50"
        >
          {depositLoading ? "Redirecting…" : `Deposit $${amount.toFixed(2)}`}
        </button>
      </main>
    </div>
  );
}
