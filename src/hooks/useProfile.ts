"use client";

import { useEffect, useState } from "react";
import { getCurrentUser, getMyProfile, getWalletBalance } from "@/lib/api";
import { markReturningUser } from "@/lib/auth-action";

export type ProfileState = {
  id: string;
  username: string;
  avatarUrl: string | null;
  /** Real Skillies wallet balance. Kept as balanceSp for existing callers. */
  balanceSp: number;
  isDevMode: boolean;
};

export function dispatchCosmeticsUpdated() {
  // Backwards-compatible no-op for callers that still refresh profile styling.
}

const FALLBACK_PROFILE: ProfileState = {
  id: "",
  username: "Player",
  avatarUrl: null,
  balanceSp: 0,
  isDevMode: false,
};

export function useProfile() {
  const [profile, setProfile] = useState<ProfileState>(FALLBACK_PROFILE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user) {
          if (!cancelled) setLoading(false);
          return;
        }
        markReturningUser();

        const [rawProfile, walletBalance] = await Promise.all([
          getMyProfile(),
          getWalletBalance(),
        ]);

        if (cancelled) return;

        setProfile({
          id: user.id,
          username: user.username || "Player",
          avatarUrl:
            rawProfile && "avatar_url" in rawProfile
              ? (rawProfile.avatar_url as string | null) ?? null
              : null,
          balanceSp: Number(walletBalance ?? 0),
          isDevMode: Boolean(user.isDevMode),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { profile, loading };
}
