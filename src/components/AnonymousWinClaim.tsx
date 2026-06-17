"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";
import LoadingRing from "@/components/LoadingRing";
import SkilliesIcon from "@/components/SkilliesIcon";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase";
import { getUserFriendlyError } from "@/lib/errorHandler";
import {
  QR_ANON_TOKEN_KEY,
  claimAnonymousPayout,
  getAnonymousPendingPayout,
  getAnonymousTokenFromCookie,
} from "@/lib/qr-match";

type Props = {
  amountSk: number;
  onClaimed?: (balance: number) => void;
  onSkip?: () => void;
};

export function AnonymousWinClaimBanner({ amountSk, onClaimed, onSkip }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const handleSignupAndClaim = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        const supabase = createClient();
        if (!supabase) throw new Error("Supabase not configured");

        const anonToken =
          localStorage.getItem(QR_ANON_TOKEN_KEY) ?? getAnonymousTokenFromCookie() ?? "";

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username } },
        });
        if (error) throw error;
        if (!data.user) throw new Error("Sign up failed");

        if (data.session) {
          const result = await claimAnonymousPayout(anonToken);
          showToast(`claimed ${result.amount_sk} SK`, "success");
          setClaimed(true);
          onClaimed?.(result.balance_sk);
          window.setTimeout(() => router.push("/play"), 900);
          return;
        }

        showToast("check your email to verify, then return here to claim.", "info");
      } catch (err) {
        showToast(getUserFriendlyError(err), "error");
      } finally {
        setLoading(false);
      }
    },
    [email, password, username, onClaimed, router, showToast]
  );

  if (claimed) {
    return (
      <div className="fixed inset-0 z-[70] flex min-h-screen items-center justify-center bg-[#0E0E12] px-4 text-center text-white">
        <div className="w-full max-w-md rounded-3xl border border-[#FFFF00]/30 bg-[#16161C] p-8 shadow-2xl">
          <p className="text-3xl font-black text-[#FFFF00]">collected.</p>
          <p className="mt-2 text-sm text-[#9CA3AF]">your Skillies are waiting in your account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] min-h-screen overflow-y-auto bg-[#0E0E12] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="rounded-3xl border border-[#FFFF00]/30 bg-[#16161C] p-6 shadow-2xl sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9CA3AF]">collect</p>
          <h1 className="mt-3 text-3xl font-black leading-tight">
            you won{" "}
            <span className="inline-flex items-center gap-1 text-[#FFFF00]">
              {amountSk} <SkilliesIcon className="h-7 w-7" />
            </span>
            .
          </h1>
          <p className="mt-3 text-sm text-[#9CA3AF]">sign up to collect your winnings.</p>

          <form onSubmit={(e) => void handleSignupAndClaim(e)} className="mt-6 space-y-3">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              className="w-full rounded-xl border border-[#1F1F26] bg-[#0E0E12] px-4 py-3 text-sm text-white focus:border-[#FFFF00] focus:outline-none"
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-[#1F1F26] bg-[#0E0E12] px-4 py-3 text-sm text-white focus:border-[#FFFF00] focus:outline-none"
            />
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="Password"
              required
              minLength={8}
              className="rounded-xl border-[#1F1F26] bg-[#0E0E12] focus:border-[#FFFF00] focus:ring-[#FFFF00]"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFFF00] py-3.5 text-sm font-black text-black disabled:opacity-50"
            >
              {loading ? <LoadingRing size={18} /> : null}
              Sign up &amp; collect
            </button>
          </form>

          <button
            type="button"
            onClick={onSkip ?? (() => { window.location.href = "/"; })}
            className="mt-5 w-full text-center text-xs font-semibold text-[#6B7280] hover:text-[#9CA3AF]"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

/** Check localStorage for pending anonymous payout (call after sign-in too). */
export function useAnonymousPendingPayout() {
  const [pending, setPending] = useState<{ amount_sk: number } | null>(null);

  useEffect(() => {
    async function check() {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem(QR_ANON_TOKEN_KEY) ?? getAnonymousTokenFromCookie()
          : null;
      if (!token) return;
      const result = await getAnonymousPendingPayout(token);
      if (result.found && result.amount_sk) {
        setPending({ amount_sk: result.amount_sk });
      }
    }
    void check();
  }, []);

  return pending;
}

export default function AnonymousWinClaim({ amountSk }: { amountSk: number }) {
  return <AnonymousWinClaimBanner amountSk={amountSk} />;
}
