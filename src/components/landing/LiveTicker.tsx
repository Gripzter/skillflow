"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { isSanitizedUsername } from "@/lib/sanitize";
import { nearestValidSpAmount } from "@/lib/spValidation";
import { generateSeededTickerBatch } from "@/lib/tickerPool";

type TickerEvent = {
  username: string;
  game: string;
  amount: number;
};

type SpRow = {
  user_id: string;
  amount: number | null;
  description: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  created_at: string | null;
};

const GAME_LABELS: Record<string, string> = {
  chess: "Chess",
  checkers: "Checkers",
  "connect-4": "Connect 4",
  "reaction-duel": "Reaction Duel",
  "memory-match": "Memory Match",
  "spelling-bee": "Spelling Bee",
  trivia: "Trivia",
  "typing-race": "Typing Race",
};

function parseGameType(description: string | null | undefined): string {
  if (!description) return "Ranked Match";
  const match = description.match(/game:([a-z0-9-]+)/i);
  if (!match) return "Ranked Match";
  return GAME_LABELS[match[1].toLowerCase()] ?? "Ranked Match";
}

function buildTickerEntries(real: TickerEvent[], seeded: TickerEvent[]): TickerEvent[] {
  const merged: TickerEvent[] = [];
  const seen = new Set<string>();
  let realIndex = 0;
  let seededIndex = 0;

  // Place real entries every 3rd slot.
  while (merged.length < 28 && (realIndex < real.length || seededIndex < seeded.length)) {
    const slot = merged.length;
    const wantsReal = slot % 3 === 2;
    if (wantsReal && realIndex < real.length) {
      const candidate = real[realIndex];
      realIndex += 1;
      if (!seen.has(candidate.username.toLowerCase())) {
        merged.push(candidate);
        seen.add(candidate.username.toLowerCase());
      }
      continue;
    }

    if (seededIndex < seeded.length) {
      const candidate = seeded[seededIndex];
      seededIndex += 1;
      if (!seen.has(candidate.username.toLowerCase())) {
        merged.push(candidate);
        seen.add(candidate.username.toLowerCase());
      }
      continue;
    }

    if (realIndex < real.length) {
      const candidate = real[realIndex];
      realIndex += 1;
      if (!seen.has(candidate.username.toLowerCase())) {
        merged.push(candidate);
        seen.add(candidate.username.toLowerCase());
      }
      continue;
    }
  }

  while (merged.length < 24 && seededIndex < seeded.length) {
    const candidate = seeded[seededIndex];
    seededIndex += 1;
    if (!seen.has(candidate.username.toLowerCase())) {
      merged.push(candidate);
      seen.add(candidate.username.toLowerCase());
    }
  }

  return merged.slice(0, 28);
}

export default function LiveTicker() {
  const [events, setEvents] = useState<TickerEvent[]>(generateSeededTickerBatch(20));

  const loadTicker = useCallback(async () => {
    const seeded = generateSeededTickerBatch(20);
    try {
      const supabase = createClient();
      if (!supabase) {
        setEvents(buildTickerEntries([], seeded));
        return;
      }

      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: txRows, error: txError } = await supabase
        .from("sp_transactions")
        .select("user_id, amount, description, created_at")
        .eq("type", "match_win")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200);

      if (txError || !txRows) {
        setEvents(buildTickerEntries([], seeded));
        return;
      }

      const latestByUser = new Map<string, SpRow>();
      for (const row of txRows as SpRow[]) {
        if (!latestByUser.has(row.user_id)) {
          latestByUser.set(row.user_id, row);
        }
      }

      const dedupedRows = Array.from(latestByUser.values()).slice(0, 8);
      const userIds = dedupedRows.map((row) => row.user_id);
      if (userIds.length === 0) {
        setEvents(buildTickerEntries([], seeded));
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, created_at")
        .in("id", userIds);

      if (profileError || !profiles) {
        setEvents(buildTickerEntries([], seeded));
        return;
      }

      const profileMap = new Map((profiles as ProfileRow[]).map((row) => [row.id, row]));
      const nowMs = Date.now();

      const sanitized = dedupedRows
        .map((row) => {
          const profile = profileMap.get(row.user_id);
          const username = profile?.username?.trim() ?? "";
          const createdAtMs = profile?.created_at ? new Date(profile.created_at).getTime() : 0;
          const isSuspicious = createdAtMs > 0 && nowMs - createdAtMs < 5 * 60 * 1000;

          if (!isSanitizedUsername(username) || isSuspicious) return null;

          return {
            username,
            game: parseGameType(row.description),
            amount: nearestValidSpAmount(Number(row.amount ?? 100)),
          } satisfies TickerEvent;
        })
        .filter((row): row is TickerEvent => !!row);

      setEvents(buildTickerEntries(sanitized, seeded));
    } catch {
      setEvents(buildTickerEntries([], seeded));
    }
  }, []);

  useEffect(() => {
    void loadTicker();
    const interval = setInterval(() => {
      void loadTicker();
    }, 60_000);
    return () => clearInterval(interval);
  }, [loadTicker]);

  const rendered = useMemo(
    () => (events.length > 0 ? events : generateSeededTickerBatch(20)),
    [events]
  );
  const doubled = [...rendered, ...rendered];

  return (
    <section className="h-8 overflow-hidden border-b border-[#1a1a22] bg-[#13131a]">
      <div className="ticker-track flex h-full items-center gap-12 px-8">
        {doubled.map((event, index) => (
          <div key={`${event.username}-${event.game}-${index}`} className="flex items-center gap-2 whitespace-nowrap text-[12px]">
            <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
            <span className="text-[#888]">
              {event.username} won {event.game}
            </span>
            <span className="text-[#FF5E00]">+{event.amount} SP</span>
          </div>
        ))}
      </div>
      <style jsx>{`
        .ticker-track {
          width: max-content;
          animation: ticker-scroll 40s linear infinite;
        }
        section:hover .ticker-track {
          animation-play-state: paused;
        }
        @keyframes ticker-scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </section>
  );
}
