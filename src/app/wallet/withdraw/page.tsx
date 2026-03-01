"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppNavbar from "@/components/AppNavbar";
import { getCurrentUser, getWalletBalance } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { MIN_WITHDRAWAL, WITHDRAWAL_FEE_PERCENT } from "@/lib/constants";

export default function WithdrawPage() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [amount, setAmount] = useState("");
  const [withdrawalDetails, setWithdrawalDetails] = useState("");
  const [playerReceives, setPlayerReceives] = useState(0);

  const amountNum = parseFloat(amount) || 0;
  const validAmount = amountNum >= MIN_WITHDRAWAL && amountNum <= balance;
  const processingFee = Math.round(amountNum * WITHDRAWAL_FEE_PERCENT * 100) / 100;
  const youReceive = Math.round((amountNum - processingFee) * 100) / 100;

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

  async function handleSubmit() {
    if (!validAmount) return;
    setError(null);
    setSubmitLoading(true);

    try {
      const supabase = createClient();
      if (!supabase) {
        setError("Not configured");
        setSubmitLoading(false);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/stripe/create-payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          userId: user.id,
          withdrawalDetails: withdrawalDetails.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to submit withdrawal");
        setSubmitLoading(false);
        return;
      }

      setPlayerReceives(data.playerReceives ?? youReceive);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal border-t-transparent" />
      </div>
    );
  }

  if (success) {
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
          <div className="rounded-xl border border-white/10 bg-card p-8 text-center">
            <p className="text-2xl font-bold text-white">Withdrawal request submitted! ✅</p>
            <p className="mt-4 text-xl font-semibold text-teal">You&apos;ll receive: ${playerReceives.toFixed(2)}</p>
            <p className="mt-2 text-body-gray">Status: Pending review</p>
            <p className="mt-1 text-sm text-body-gray">Processing time: 3–5 business days</p>
            <Link
              href="/wallet"
              className="mt-6 inline-block w-full rounded-lg bg-teal py-3 font-semibold text-charcoal hover:shadow-teal-glow"
            >
              Back to Wallet
            </Link>
          </div>
        </main>
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

        <h1 className="mt-6 text-2xl font-bold text-white">Withdraw Funds</h1>
        <p className="mt-1 text-body-gray">Request a payout to your payment method</p>

        <div className="mt-6 rounded-card border border-white/10 bg-card p-4">
          <p className="text-body-gray">Current balance</p>
          <p className="text-2xl font-bold text-white">${balance.toFixed(2)}</p>
        </div>

        <div className="mt-8">
          <label htmlFor="withdraw-amount" className="font-medium text-white">
            Amount
          </label>
          <input
            id="withdraw-amount"
            type="number"
            min={MIN_WITHDRAWAL}
            max={balance}
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-2 w-full rounded-lg border border-white/10 bg-[#1A1D27] px-4 py-3 text-white placeholder:text-body-gray focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
          <p className="mt-2 text-sm text-body-gray">
            Min: ${MIN_WITHDRAWAL}.00 • Max: ${balance.toFixed(2)}
          </p>
        </div>

        <div className="mt-6">
          <label htmlFor="withdraw-details" className="font-medium text-white">
            PayPal email or payment details
          </label>
          <input
            id="withdraw-details"
            type="text"
            placeholder="e.g. paypal@email.com or bank details"
            value={withdrawalDetails}
            onChange={(e) => setWithdrawalDetails(e.target.value)}
            className="mt-2 w-full rounded-lg border border-white/10 bg-[#1A1D27] px-4 py-3 text-white placeholder:text-body-gray focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
        </div>

        {amountNum >= MIN_WITHDRAWAL && amountNum <= balance && (
          <div className="mt-8 rounded-xl border border-white/10 bg-card p-6">
            <h2 className="text-lg font-semibold text-white">Withdrawal Summary</h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-body-gray">Amount</span>
                <span className="text-white">${amountNum.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-body-gray">Processing fee (3%)</span>
                <span className="text-red-400">-${processingFee.toFixed(2)}</span>
              </div>
              <div className="border-t border-white/10 pt-2">
                <div className="flex justify-between font-medium">
                  <span className="text-white">You receive</span>
                  <span className="text-teal">${youReceive.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-body-gray">Processing time: 3–5 business days</p>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitLoading || !validAmount}
          className="mt-8 w-full rounded-lg bg-teal py-3.5 text-lg font-semibold text-charcoal transition-all hover:shadow-teal-glow disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitLoading ? "Processing…" : "Confirm Withdrawal"}
        </button>
      </main>
    </div>
  );
}
