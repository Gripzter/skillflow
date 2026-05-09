"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const REFERRAL_STORAGE_KEY = "skillflow_referral_code";

export default function ReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref")?.trim()?.toLowerCase();
    if (ref) {
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, ref);
    }
  }, [searchParams]);

  return null;
}
