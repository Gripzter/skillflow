"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppNavbar from "@/components/AppNavbar";
import GeoBlockModal from "@/components/GeoBlockModal";
import LoadingRing from "@/components/LoadingRing";
import { useGeo } from "@/contexts/GeoContext";
import { usePlayMode } from "@/contexts/PlayModeContext";
import { getCurrentUser, getWalletBalance } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { MIN_DEPOSIT, MAX_DEPOSIT } from "@/lib/constants";
import { getUserFriendlyError } from "@/lib/errorHandler";

const PRESETS = [5, 10, 25, 50, 100];

function ResendVerificationLink({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { isPractice } = usePlayMode();
  async function handleResend() {
    if (!email || loading || sent) return;
    setLoading(true);
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.resend({ type: "signup", email });
      setSent(true);
    }
    setLoading(false);
  }
  return (
    <span className="mt-2 inline-block">
      <button
        type="button"
        onClick={handleResend}
        disabled={loading || sent}
        className={`text-sm hover:underline disabled:opacity-60 ${
          isPractice ? "text-purple-400" : "text-teal"
        }`}
      >
        {sent ? "Verification email sent!" : loading ? "Sending…" : "Resend verification email"}
      </button>
    </span>
  );
}

export default function DepositPage() {
  const router = useRouter();
  const { isPractice } = usePlayMode();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [depositLoading, setDepositLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(25);
  const [customAmount, setCustomAmount] = useState("");
  const { isRestricted } = useGeo();

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
        setEmailVerified(user.emailVerified);
        setUserEmail(user.email ?? "");
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
    if (!validAmount || isRestricted) return;
    if (!emailVerified) {
      setError("Please verify your email before making a deposit.");
      return;
    }
    setError(null);
    setDepositLoading(true);

    try {
      const supabase = createClient();
      if (!supabase) {
        setError("Service is temporarily unavailable. Please try again later.");
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
        setError(getUserFriendlyError({ message: data.error }));
        setDepositLoading(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("Unable to start checkout. Please try again.");
    } catch (e) {
      setError(getUserFriendlyError(e));
    } finally {
      setDepositLoading(false);
    }
  }

  if (loading) {
    return <LoadingRing />;
  }

  return (
    <div className="min-h-screen bg-charcoal">
      {isRestricted && <GeoBlockModal onClose={() => router.push("/wallet")} />}
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
                    ? isPractice
                      ? "border-purple-500 bg-purple-500 text-white"
                      : "border-teal bg-teal text-charcoal"
                    : isPractice
                      ? "border-purple-500/50 bg-[#1A1D27] text-white hover:border-purple-500"
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
            className={`mt-2 w-full rounded-lg border border-white/10 bg-[#1A1D27] px-4 py-3 text-white placeholder:text-body-gray focus:outline-none focus:ring-1 ${
              isPractice ? "focus:border-purple-500 focus:ring-purple-500" : "focus:border-teal focus:ring-teal"
            }`}
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
          <p className="mt-1">Secured by Stripe</p>
        </div>

        {!emailVerified && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Please verify your email before making a deposit.{" "}
            <ResendVerificationLink email={userEmail} />
          </div>
        )}
        {error && (
          <div className="mt-4">
            <p className="text-sm text-red-400">{error}</p>
            {!emailVerified ? (
              <ResendVerificationLink email={userEmail} />
            ) : (
              <Link
                href="/settings/responsible-gaming"
                className={`mt-2 inline-block text-sm hover:underline ${
                  isPractice ? "text-purple-400" : "text-teal"
                }`}
              >
                Manage your limits in Responsible Gaming settings →
              </Link>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleDeposit}
          disabled={depositLoading || !validAmount || isRestricted}
          className={`mt-8 w-full rounded-lg py-3.5 text-lg font-semibold text-charcoal transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
            isPractice
              ? "bg-purple-500 text-white hover:shadow-[0_0_18px_rgba(139,92,246,0.45)]"
              : "bg-teal hover:shadow-teal-glow"
          }`}
        >
          {depositLoading ? "Redirecting…" : `Deposit $${amount.toFixed(2)}`}
        </button>
      </main>
    </div>
  );
}
