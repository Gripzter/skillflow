"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

export const SKILLIES_PER_USD = 80;

export type CreatorStatus = "pending" | "active" | "suspended";

export type CreatorGame = {
  id: string;
  creator_id: string;
  game_name: string;
  game_id: string;
  status: CreatorStatus;
  revenue_share_pct: number;
  total_matches: number;
  total_earned_sk: number;
  created_at: string;
};

export type CreatorEarningRow = {
  id: string;
  creator_id: string;
  game_id: string;
  match_id: string;
  earned_sk: number;
  earned_usd: number;
  paid_out: boolean;
  created_at: string;
};

export type CreatorMatchRow = {
  matchId: string;
  date: string;
  entrySK: number;
  potSK: number;
  creatorCutSK: number;
  creatorCutUSD: number;
  status: "completed" | "voided";
};

export type CreatorDailyStat = {
  date: string;
  matches: number;
  earningsSK: number;
};

export type CreatorEarningsSummary = {
  rows: CreatorEarningRow[];
  totalEarnedSK: number;
  totalEarnedUSD: number;
  pendingPayoutUSD: number;
  pendingPayoutSK: number;
  monthly: Array<{
    month: string;
    matches: number;
    grossSK: number;
    grossUSD: number;
  }>;
};

export type MatchFilters = {
  status?: "completed" | "voided" | "all";
  dateFrom?: string;
  dateTo?: string;
};

function formatMonthKey(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function startOfDayIso(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function getUserId(): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export function useCreatorProfile() {
  const [profile, setProfile] = useState<CreatorGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) {
          setError("Supabase is not configured.");
          setLoading(false);
        }
        return;
      }

      const userId = await getUserId();
      if (!userId) {
        if (!cancelled) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("creator_games")
        .select(
          "id, creator_id, game_name, game_id, status, revenue_share_pct, total_matches, total_earned_sk, created_at"
        )
        .eq("creator_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setProfile(null);
      } else {
        setProfile(data as CreatorGame | null);
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { profile, loading, error, isSuspended: profile?.status === "suspended" };
}

export function useCreatorEarnings() {
  const [summary, setSummary] = useState<CreatorEarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) {
          setError("Supabase is not configured.");
          setLoading(false);
        }
        return;
      }

      const userId = await getUserId();
      if (!userId) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("creator_earnings")
        .select("*")
        .eq("creator_id", userId)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setSummary(null);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as CreatorEarningRow[];
      const totalEarnedSK = rows.reduce((sum, r) => sum + Number(r.earned_sk), 0);
      const totalEarnedUSD = rows.reduce((sum, r) => sum + Number(r.earned_usd), 0);
      const pendingRows = rows.filter((r) => !r.paid_out);
      const pendingPayoutSK = pendingRows.reduce((sum, r) => sum + Number(r.earned_sk), 0);
      const pendingPayoutUSD = pendingRows.reduce((sum, r) => sum + Number(r.earned_usd), 0);

      const monthlyMap = new Map<string, { matches: number; grossSK: number; grossUSD: number }>();
      for (const row of rows) {
        const key = formatMonthKey(row.created_at);
        const existing = monthlyMap.get(key) ?? { matches: 0, grossSK: 0, grossUSD: 0 };
        existing.matches += 1;
        existing.grossSK += Number(row.earned_sk);
        existing.grossUSD += Number(row.earned_usd);
        monthlyMap.set(key, existing);
      }

      const monthly = Array.from(monthlyMap.entries())
        .map(([month, stats]) => ({ month, ...stats }))
        .sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime());

      setSummary({
        rows,
        totalEarnedSK,
        totalEarnedUSD,
        pendingPayoutSK,
        pendingPayoutUSD,
        monthly,
      });
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { summary, loading, error };
}

function mapMatchStatus(
  state: string | null,
  sdkPhase: string | null
): "completed" | "voided" {
  if (state === "voided" || sdkPhase === "voided") return "voided";
  return "completed";
}

export function useCreatorMatches(page: number, filters: MatchFilters = {}) {
  const [rows, setRows] = useState<CreatorMatchRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const userId = await getUserId();
    if (!userId) {
      setLoading(false);
      return;
    }

    const { data: games } = await supabase
      .from("creator_games")
      .select("game_id")
      .eq("creator_id", userId);

    const gameIds = (games ?? []).map((g) => g.game_id as string);
    if (gameIds.length === 0) {
      setRows([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    let query = supabase
      .from("matches")
      .select("id, stake_sp, state, sdk_phase, settled_at, completed_at, created_at", {
        count: "exact",
      })
      .in("creator_game_id", gameIds)
      .not("sdk_phase", "is", null)
      .order("created_at", { ascending: false });

    if (filters.dateFrom) {
      query = query.gte("created_at", `${filters.dateFrom}T00:00:00.000Z`);
    }
    if (filters.dateTo) {
      query = query.lte("created_at", `${filters.dateTo}T23:59:59.999Z`);
    }

    const { data: matches, error: matchError, count } = await query;

    if (matchError) {
      setError(matchError.message);
      setLoading(false);
      return;
    }

    const matchIds = (matches ?? []).map((m) => m.id as string);
    const earningsMap = new Map<string, CreatorEarningRow>();

    if (matchIds.length > 0) {
      const { data: earnings } = await supabase
        .from("creator_earnings")
        .select("*")
        .eq("creator_id", userId)
        .in("match_id", matchIds);

      for (const e of earnings ?? []) {
        earningsMap.set(e.match_id as string, e as CreatorEarningRow);
      }
    }

    let mapped: CreatorMatchRow[] = (matches ?? []).map((m) => {
      const stake = Number(m.stake_sp ?? 0);
      const earning = earningsMap.get(m.id as string);
      const status = mapMatchStatus(m.state as string, m.sdk_phase as string);
      const date =
        (m.completed_at as string) ??
        (m.settled_at as string) ??
        (m.created_at as string);

      return {
        matchId: m.id as string,
        date,
        entrySK: stake,
        potSK: stake * 2,
        creatorCutSK: earning ? Number(earning.earned_sk) : 0,
        creatorCutUSD: earning ? Number(earning.earned_usd) : 0,
        status,
      };
    });

    if (filters.status && filters.status !== "all") {
      mapped = mapped.filter((r) => r.status === filters.status);
    }

    setTotal(filters.status && filters.status !== "all" ? mapped.length : (count ?? mapped.length));

    const from = (page - 1) * pageSize;
    const paginated = mapped.slice(from, from + pageSize);
    setRows(paginated);
    setLoading(false);
  }, [page, filters.dateFrom, filters.dateTo, filters.status]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, total, pageSize, loading, error, reload: load };
}

export function useCreatorStats() {
  const [daily, setDaily] = useState<CreatorDailyStat[]>([]);
  const [matchesToday, setMatchesToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) {
          setError("Supabase is not configured.");
          setLoading(false);
        }
        return;
      }

      const userId = await getUserId();
      if (!userId) {
        if (!cancelled) setLoading(false);
        return;
      }

      const since = new Date();
      since.setDate(since.getDate() - 29);
      since.setHours(0, 0, 0, 0);

      const { data: earnings, error: earningsError } = await supabase
        .from("creator_earnings")
        .select("earned_sk, created_at, match_id")
        .eq("creator_id", userId)
        .gte("created_at", since.toISOString());

      if (cancelled) return;

      if (earningsError) {
        setError(earningsError.message);
        setLoading(false);
        return;
      }

      const { data: games } = await supabase
        .from("creator_games")
        .select("game_id")
        .eq("creator_id", userId);

      const gameIds = (games ?? []).map((g) => g.game_id as string);

      let voidMatches: Array<{ created_at: string }> = [];
      if (gameIds.length > 0) {
        const { data: voidLogs } = await supabase
          .from("sdk_match_log")
          .select("created_at, match_id")
          .in("game_id", gameIds)
          .eq("event_type", "void")
          .gte("created_at", since.toISOString());
        voidMatches = voidLogs ?? [];
      }

      const dayMap = new Map<string, CreatorDailyStat>();
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        const key = startOfDayIso(d).slice(0, 10);
        dayMap.set(key, { date: key, matches: 0, earningsSK: 0 });
      }

      const todayKey = startOfDayIso(new Date()).slice(0, 10);
      let todayCount = 0;

      for (const row of earnings ?? []) {
        const key = (row.created_at as string).slice(0, 10);
        const entry = dayMap.get(key);
        if (entry) {
          entry.matches += 1;
          entry.earningsSK += Number(row.earned_sk);
        }
        if (key === todayKey) todayCount += 1;
      }

      for (const row of voidMatches) {
        const key = (row.created_at as string).slice(0, 10);
        const entry = dayMap.get(key);
        if (entry) entry.matches += 1;
        if (key === todayKey) todayCount += 1;
      }

      if (!cancelled) {
        setDaily(Array.from(dayMap.values()));
        setMatchesToday(todayCount);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const recentMatches = useMemo(() => [], []);

  return { daily, matchesToday, recentMatches, loading, error };
}

export function useRecentCreatorMatches(limit = 10) {
  const { rows, loading, error } = useCreatorMatches(1, { status: "all" });
  return {
    rows: rows.slice(0, limit),
    loading,
    error,
  };
}

export function formatSK(amount: number): string {
  return `${Math.round(amount).toLocaleString()} SK`;
}

export function formatUSD(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function truncateMatchId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}
