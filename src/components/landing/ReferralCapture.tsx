"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

const REFERRAL_STORAGE_KEY = "skillflow_referral_code";

export default function ReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref")?.trim()?.toLowerCase();
    if (ref) {
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, ref);
    }
  }, [searchParams]);

  useEffect(() => {
    const redirectPath = "/dashboard";

    // Client-side fallback guard for dev mode sessions.
    if (window.localStorage.getItem("skillflow_dev_mode") === "true") {
      window.location.href = redirectPath;
      return;
    }

    const supabase = createClient();
    if (!supabase) return;

    let cancelled = false;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!cancelled && data.user) {
          window.location.href = redirectPath;
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
