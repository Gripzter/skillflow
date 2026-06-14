"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import LoadingRing from "@/components/LoadingRing";
import CreatorInviteApplication from "@/components/invite/CreatorInviteApplication";

const REFERRAL_STORAGE_KEY = "skillflow_referral_code";

function isCreatorInviteToken(token: string): boolean {
  return /^[a-f0-9]{32}$/i.test(token);
}

function ReferralInvitePage({ code }: { code: string }) {
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
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
    void check();
  }, [code]);

  function handleCreateAccount() {
    window.localStorage.setItem(REFERRAL_STORAGE_KEY, code);
    window.location.href = `/signup?ref=${encodeURIComponent(code)}`;
  }

  if (loading) return <LoadingRing />;

  if (invalid) {
    window.location.href = "/signup";
    return null;
  }

  return (
    <div className="min-h-screen bg-charcoal">
      <main className="relative mx-auto max-w-lg px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-steel-blue bg-card p-8 text-center">
          <h1 className="text-2xl font-bold text-white">
            You&apos;ve been invited by {referrerName}!
          </h1>
          <p className="mt-3 text-body-gray">
            Sign up now and you both get a $5 bonus when you make your first deposit ($5+).
          </p>
          <button
            type="button"
            onClick={handleCreateAccount}
            className="mt-8 w-full rounded-xl bg-teal py-4 text-lg font-semibold text-charcoal"
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

export default function InviteTokenPage({ params }: { params: { token: string } }) {
  const token = params.token?.trim() ?? "";

  if (isCreatorInviteToken(token)) {
    return <CreatorInviteApplication token={token} />;
  }

  return <ReferralInvitePage code={token.toLowerCase()} />;
}
