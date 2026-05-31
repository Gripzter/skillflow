"use client";

import { useCallback, useEffect, useState } from "react";
import { getEquippedCosmetics } from "@/lib/cases";
import {
  COSMETICS_UPDATED_EVENT,
  type EquippedBadge,
  type EquippedBorder,
} from "@/lib/inventory-cosmetics";

export function useEquippedCosmetics(userId: string | null | undefined) {
  const [border, setBorder] = useState<EquippedBorder | null>(null);
  const [badges, setBadges] = useState<EquippedBadge[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));

  const refresh = useCallback(async () => {
    if (!userId) {
      setBorder(null);
      setBadges([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getEquippedCosmetics(userId);
      setBorder(data.border);
      setBadges(data.badges);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const onUpdate = () => void refresh();
    window.addEventListener(COSMETICS_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(COSMETICS_UPDATED_EVENT, onUpdate);
  }, [userId, refresh]);

  return { border, badges, loading, refresh };
}
