"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";
import LoadingRing from "@/components/LoadingRing";
import SkilliesIcon from "@/components/SkilliesIcon";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase";
import { getUserFriendlyError } from "@/lib/errorHandler";

type Props = {
  amountSk: number;
  onSkip?: () => void;
};

export default function AnonymousLossSettle({ amountSk, onSkip }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  const handleSignup = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setLoading(true);
      try {
        const supabase = createClient();
        if (!supabase) throw new Error("Supabase not configured");

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username } },
        });
        if (error) throw error;
        if (!data.user) throw new Error("Sign up failed");

        setCreated(true);
        showToast("account created", "success");
        if (data.session) {
          window.setTimeout(() => router.push("/play"), 900);
        } else {
          showToast("check your email to verify, then come back swinging.", "info");
        }
      } catch (err) {
        showToast(getUserFriendlyError(err), "error");
      } finally {
        setLoading(false);
      }
    },
    [email, password, router, showToast, username]
  );

  if (created) {
    return (
      <div className="fixed inset-0 z-[70] flex min-h-screen items-center justify-center bg-[#0E0E12] px-4 text-center text-white">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#16161C] p-8 shadow-2xl">
          <p className="text-3xl font-black text-white">settled.</p>
          <p className="mt-2 text-sm text-[#9CA3AF]">new account, clean slate.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] min-h-screen overflow-y-auto bg-[#0E0E12] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="rounded-3xl border border-red-500/25 bg-[#16161C] p-6 shadow-2xl sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9CA3AF]">pay up</p>
          <h1 className="mt-3 text-3xl font-black leading-tight">
            you owe{" "}
            <span className="inline-flex items-center gap-1 text-red-400">
              {amountSk} <SkilliesIcon className="h-7 w-7" />
            </span>
            .
          </h1>
          <p className="mt-3 text-sm text-[#9CA3AF]">make it official — sign up to settle the bill.</p>

          <form onSubmit={(event) => void handleSignup(event)} className="mt-6 space-y-3">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              minLength={3}
              className="w-full rounded-xl border border-[#1F1F26] bg-[#0E0E12] px-4 py-3 text-sm text-white focus:border-red-400 focus:outline-none"
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-xl border border-[#1F1F26] bg-[#0E0E12] px-4 py-3 text-sm text-white focus:border-red-400 focus:outline-none"
            />
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="Password"
              required
              minLength={8}
              className="rounded-xl border-[#1F1F26] bg-[#0E0E12] focus:border-red-400 focus:ring-red-400"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFFF00] py-3.5 text-sm font-black text-black disabled:opacity-50"
            >
              {loading ? <LoadingRing size={18} /> : null}
              Sign up &amp; settle
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
