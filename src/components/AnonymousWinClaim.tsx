"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
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
};

export function AnonymousWinClaimBanner({ amountSk, onClaimed }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

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
          showToast(`Claimed ${result.amount_sk} SK!`, "success");
          onClaimed?.(result.balance_sp);
          router.push("/play");
          return;
        }

        showToast("Check your email to verify, then sign in to claim your winnings.", "info");
      } catch (err) {
        showToast(getUserFriendlyError(err), "error");
      } finally {
        setLoading(false);
      }
    },
    [email, password, username, onClaimed, router, showToast]
  );

  return (
    <div className="mx-auto mt-6 max-w-md rounded-2xl border border-[#FFFF00]/30 bg-[#FFFF00]/5 p-5">
      <p className="text-center text-lg font-black text-white">
        You won{" "}
        <span className="inline-flex items-center gap-1 text-[#FFFF00]">
          {amountSk} <SkilliesIcon className="h-5 w-5" />
        </span>
        !
      </p>
      <p className="mt-1 text-center text-sm text-[#9CA3AF]">Sign up free to claim your winnings.</p>

      <form onSubmit={(e) => void handleSignupAndClaim(e)} className="mt-4 space-y-3">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          className="w-full rounded-xl border border-[#1F1F26] bg-[#16161C] px-4 py-2.5 text-sm text-white focus:border-[#FFFF00] focus:outline-none"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-xl border border-[#1F1F26] bg-[#16161C] px-4 py-2.5 text-sm text-white focus:border-[#FFFF00] focus:outline-none"
        />
        <PasswordInput
          value={password}
          onChange={setPassword}
          placeholder="Password"
          required
          minLength={8}
        />
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFFF00] py-3 text-sm font-bold text-black disabled:opacity-50"
        >
          {loading ? <LoadingRing size={18} /> : null}
          Sign up &amp; claim
        </button>
      </form>

      <p className="mt-3 text-center text-xs text-[#6B7280]">
        Already have an account?{" "}
        <Link href="/login" className="text-[#FFFF00] hover:underline">
          Sign in
        </Link>{" "}
        — your win will be waiting.
      </p>
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
  return (
    <AuthLayout title="Claim your win">
      <AnonymousWinClaimBanner amountSk={amountSk} />
    </AuthLayout>
  );
}
