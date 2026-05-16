"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

export type SpTransaction = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
};

export function useSpTransactions({
  userId,
  limit = 10,
  positiveOnly = false,
}: {
  userId: string;
  limit?: number;
  positiveOnly?: boolean;
}) {
  const [transactions, setTransactions] = useState<SpTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!userId) {
        setTransactions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const supabase = createClient();
      if (!supabase) {
        setTransactions([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from("sp_transactions")
        .select("id, type, amount, description, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (positiveOnly) query = query.gt("amount", 0);

      const { data } = await query;
      if (!cancelled) {
        setTransactions((data as SpTransaction[] | null) ?? []);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, limit, positiveOnly]);

  return { transactions, loading };
}
