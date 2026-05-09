"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { isSanitizedUsername } from "@/lib/sanitize";
import { nearestValidSpAmount } from "@/lib/spValidation";

type TickerEvent = {
  username: string;
  game: string;
  amount: number;
};

type SpRow = {
  user_id: string;
  amount: number | null;
  description: string | null;
  created_at: string;
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

const seededEvents: TickerEvent[] = [
  { username: "shadowfox", game: "Reaction Duel", amount: 100 },
  { username: "kira_06", game: "Chess", amount: 200 },
  { username: "nova_xx", game: "Memory Match", amount: 100 },
  { username: "drift99", game: "Connect 4", amount: 50 },
  { username: "alex_p", game: "Spelling Bee", amount: 100 },
  { username: "silent_k", game: "Checkers", amount: 200 },
  { username: "phoenix77", game: "Chess", amount: 500 },
  { username: "maverick", game: "Reaction Duel", amount: 100 },
  { username: "echo_99", game: "Typing Race", amount: 100 },
  { username: "vortex", game: "Trivia", amount: 200 },
  { username: "lunar_op", game: "Chess", amount: 100 },
  { username: "rogue_z", game: "Memory Match", amount: 50 },
];

const fallbackExtraEvents: TickerEvent[] = [
  { username: "ionblade", game: "Chess", amount: 100 },
  { username: "omega_run", game: "Reaction Duel", amount: 200 },
  { username: "quickmint", game: "Typing Race", amount: 50 },
  { username: "atlas_q", game: "Spelling Bee", amount: 100 },
  { username: "ravenbyte", game: "Checkers", amount: 200 },
  { username: "neongrid", game: "Connect 4", amount: 100 },
  { username: "solohex", game: "Trivia", amount: 50 },
  { username: "zenlock", game: "Memory Match", amount: 100 },
];

function parseGameType(description: string | null | undefined): string {
  if (!description) return "Ranked Match";
  const match = description.match(/game:([a-z0-9-]+)/i);
  if (!match) return "Ranked Match";
  return GAME_LABELS[match[1].toLowerCase()] ?? "Ranked Match";
}

function buildTickerEntries(real: TickerEvent[]): TickerEvent[] {
  const merged: TickerEvent[] = [];
  const seen = new Set<string>();
  const realPool = [...real];
  const seededPool = [...seededEvents, ...fallbackExtraEvents];

  let useReal = true;
  for (let i = 0; i < 8; i += 1) {
    const source = useReal ? realPool : seededPool;
    const next = source.shift();
    if (next && !seen.has(next.username.toLowerCase())) {
      merged.push(next);
      seen.add(next.username.toLowerCase());
    }
    useReal = !useReal;
  }

  while (merged.length < 16 && (realPool.length > 0 || seededPool.length > 0)) {
    const source = realPool.length >= seededPool.length ? realPool : seededPool;
    const next = source.shift();
    if (next && !seen.has(next.username.toLowerCase())) {
      merged.push(next);
      seen.add(next.username.toLowerCase());
    }
  }

  let topUpIndex = 0;
  while (merged.length < 16 && topUpIndex < seededPool.length) {
    const candidate = seededPool[topUpIndex];
    if (!seen.has(candidate.username.toLowerCase())) {
      merged.push(candidate);
      seen.add(candidate.username.toLowerCase());
    }
    topUpIndex += 1;
  }

  return merged.slice(0, 20);
}

export default function LiveTicker() {
  const [events, setEvents] = useState<TickerEvent[]>(seededEvents);

  const loadTicker = useCallback(async () => {
    try {
      const supabase = createClient();
      if (!supabase) {
        setEvents(buildTickerEntries([]));
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
        setEvents(buildTickerEntries([]));
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
        setEvents(buildTickerEntries([]));
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, created_at")
        .in("id", userIds);

      if (profileError || !profiles) {
        setEvents(buildTickerEntries([]));
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

      setEvents(buildTickerEntries(sanitized));
    } catch {
      setEvents(buildTickerEntries([]));
    }
  }, []);

  useEffect(() => {
    void loadTicker();
    const interval = setInterval(() => {
      void loadTicker();
    }, 60_000);
    return () => clearInterval(interval);
  }, [loadTicker]);

  const rendered = useMemo(() => (events.length > 0 ? events : seededEvents), [events]);
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
