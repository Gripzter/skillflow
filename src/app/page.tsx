"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import LandingPage from "@/components/landing";
import LoadingRing from "@/components/LoadingRing";

const REFERRAL_STORAGE_KEY = "skillflow_referral_code";

function HomeContent() {
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
    return <LoadingRing />;
  }

  return <LandingPage />;
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingRing />}>
      <HomeContent />
    </Suspense>
  );
}
