"use client";

import { useEffect, useState } from "react";
import { getCurrentUser, getMyProfile } from "@/lib/api";
import { getUserSPData, type RankTier } from "@/lib/skillpoints";
import { markReturningUser } from "@/lib/auth-action";
import { getEquippedCosmetics } from "@/lib/cases";
import {
  COSMETICS_UPDATED_EVENT,
  dispatchCosmeticsUpdated,
  type EquippedBadge,
  type EquippedBorder,
} from "@/lib/inventory-cosmetics";

export type ProfileState = {
  id: string;
  username: string;
  avatarUrl: string | null;
  lifetimeSp: number;
  balanceSp: number;
  rankTier: RankTier;
  isDevMode: boolean;
  equippedBorder: EquippedBorder | null;
  equippedBadges: EquippedBadge[];
};

export { dispatchCosmeticsUpdated };

const FALLBACK_PROFILE: ProfileState = {
  id: "",
  username: "Player",
  avatarUrl: null,
  lifetimeSp: 0,
  balanceSp: 0,
  rankTier: "bronze",
  isDevMode: false,
  equippedBorder: null,
  equippedBadges: [],
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

        const [rawProfile, spData, cosmetics] = await Promise.all([
          getMyProfile(),
          getUserSPData(user.id),
          getEquippedCosmetics(user.id),
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
          equippedBorder: cosmetics.border,
          equippedBadges: cosmetics.badges,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    const onCosmeticsUpdated = () => void load();
    window.addEventListener(COSMETICS_UPDATED_EVENT, onCosmeticsUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener(COSMETICS_UPDATED_EVENT, onCosmeticsUpdated);
    };
  }, []);

  return { profile, loading };
}
