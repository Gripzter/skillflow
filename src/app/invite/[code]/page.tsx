"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import VelocityLoader from "@/components/VelocityLoader";

const REFERRAL_STORAGE_KEY = "skillflow_referral_code";

export default function InviteCodePage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string)?.trim?.()?.toLowerCase?.() || "";
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!code) {
      setInvalid(true);
      setLoading(false);
      return;
    }
    async function check() {
      const supabase = createClient();
      if (!supabase) {
        setInvalid(true);
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("referral_code", code)
        .maybeSingle();
      if (profile) {
        setReferrerName(profile.username ?? "A friend");
      } else {
        setInvalid(true);
      }
      setLoading(false);
    }
    check();
  }, [code]);

  function handleCreateAccount() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(REFERRAL_STORAGE_KEY, code);
    router.push(`/signup?ref=${encodeURIComponent(code)}`);
  }

  if (loading) {
    return <VelocityLoader />;
  }

  if (invalid) {
    router.replace("/signup");
    return null;
  }

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <header className="border-b border-white/5 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="text-xl font-bold text-white">
            Skill<span className="text-teal">Flow</span>
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white hover:bg-white/5"
          >
            Log in
          </Link>
        </div>
      </header>
      <main className="relative mx-auto max-w-lg px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-steel-blue bg-card p-8 text-center shadow-[0_0_40px_rgba(42,58,92,0.4)]">
          <span className="text-5xl" aria-hidden />
          <h1 className="mt-4 text-2xl font-bold text-white">
            You&apos;ve been invited by {referrerName}!
          </h1>
          <p className="mt-3 text-body-gray">
            Sign up now and you <strong className="text-white">both</strong> get a{" "}
            <strong className="text-teal">$5 bonus</strong> when you make your first deposit ($5+).
          </p>
          <button
            type="button"
            onClick={handleCreateAccount}
            className="mt-8 w-full rounded-xl bg-teal py-4 text-lg font-semibold text-charcoal transition-all hover:shadow-teal-glow"
          >
            Create Account
          </button>
          <p className="mt-4 text-sm text-body-gray">
            Already have an account?{" "}
            <Link href={`/login?ref=${encodeURIComponent(code)}`} className="text-teal hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
