"use client";

import { useEffect, useState } from "react";
import { getCurrentUser, getMyProfile } from "@/lib/api";
import { getUserSPData, type RankTier } from "@/lib/skillpoints";
import { markReturningUser } from "@/lib/auth-action";

export type ProfileState = {
  id: string;
  username: string;
  avatarUrl: string | null;
  lifetimeSp: number;
  balanceSp: number;
  rankTier: RankTier;
  isDevMode: boolean;
};

const FALLBACK_PROFILE: ProfileState = {
  id: "",
  username: "Player",
  avatarUrl: null,
  lifetimeSp: 0,
  balanceSp: 0,
  rankTier: "bronze",
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

        const [rawProfile, spData] = await Promise.all([
          getMyProfile(),
          getUserSPData(user.id),
        ]);

        if (cancelled) return;

        setProfile({
          id: user.id,
          username: user.username || "Player",
          avatarUrl:
            rawProfile && "avatar_url" in rawProfile
              ? (rawProfile.avatar_url as string | null) ?? null
              : null,
          lifetimeSp: Number(spData?.lifetimeSp ?? 0),
          balanceSp: Number(spData?.balanceSp ?? 0),
          rankTier: (spData?.rankTier ?? "bronze") as RankTier,
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
