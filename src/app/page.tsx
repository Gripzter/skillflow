"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import LandingPage from "@/components/landing";

const REFERRAL_STORAGE_KEY = "skillflow_referral_code";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const ref = searchParams.get("ref")?.trim()?.toLowerCase();
    if (ref && typeof window !== "undefined") {
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, ref);
    }
    getCurrentUser()
      .then((user) => {
        if (user) router.replace("/dashboard");
      })
      .finally(() => setChecking(false));
  }, [router, searchParams]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0E17]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal border-t-transparent" />
      </div>
    );
  }

  return <LandingPage />;
}
