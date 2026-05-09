"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { seededTickerEvents } from "@/lib/landingFallback";
import { isSanitizedUsername } from "@/lib/sanitize";

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
};

function parseGameType(description: string | null): string {
  if (!description) return "Ranked Match";
  const match = description.match(/game:([a-z0-9-]+)/i);
  if (!match) return "Ranked Match";
  return GAME_LABELS[match[1].toLowerCase()] ?? "Ranked Match";
}

function interleaveWithSeeded(events: TickerEvent[]): TickerEvent[] {
  if (events.length >= 8) return events.slice(0, 20);
  const merged: TickerEvent[] = [];
  let realIndex = 0;
  let seededIndex = 0;

  while (merged.length < 8 && (realIndex < events.length || seededIndex < seededTickerEvents.length)) {
    if (realIndex < events.length) {
      merged.push(events[realIndex]);
      realIndex += 1;
    }
    if (merged.length < 8 && seededIndex < seededTickerEvents.length) {
      merged.push(seededTickerEvents[seededIndex]);
      seededIndex += 1;
    }
  }

  return merged;
}

export default function LiveTicker() {
  const [events, setEvents] = useState<TickerEvent[]>(seededTickerEvents);

  const loadTicker = useCallback(async () => {
    try {
      const supabase = createClient();
      if (!supabase) {
        setEvents(seededTickerEvents);
        return;
      }

      const { data: txRows, error: txError } = await supabase
        .from("sp_transactions")
        .select("user_id, amount, description, created_at")
        .eq("type", "match_win")
        .order("created_at", { ascending: false })
        .limit(20);

      if (txError || !txRows) {
        setEvents(seededTickerEvents);
        return;
      }

      const userIds = [...new Set((txRows as SpRow[]).map((row) => row.user_id).filter(Boolean))];
      if (userIds.length === 0) {
        setEvents(seededTickerEvents);
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, created_at")
        .in("id", userIds);

      if (profileError || !profiles) {
        setEvents(seededTickerEvents);
        return;
      }

      const profileMap = new Map((profiles as ProfileRow[]).map((row) => [row.id, row]));
      const nowMs = Date.now();

      const sanitized = (txRows as SpRow[])
        .map((row) => {
          const profile = profileMap.get(row.user_id);
          const username = profile?.username?.trim() ?? "";
          const createdAtMs = profile?.created_at ? new Date(profile.created_at).getTime() : 0;
          const isSuspicious = createdAtMs > 0 && nowMs - createdAtMs < 5 * 60 * 1000;

          if (!isSanitizedUsername(username) || isSuspicious) return null;

          return {
            username,
            game: parseGameType(row.description),
            amount: Number(row.amount ?? 100),
          } satisfies TickerEvent;
        })
        .filter((row): row is TickerEvent => !!row);

      if (sanitized.length === 0) {
        setEvents(seededTickerEvents);
        return;
      }

      setEvents(interleaveWithSeeded(sanitized));
    } catch {
      setEvents(seededTickerEvents);
    }
  }, []);

  useEffect(() => {
    void loadTicker();
    const interval = setInterval(() => {
      void loadTicker();
    }, 60_000);
    return () => clearInterval(interval);
  }, [loadTicker]);

  const rendered = useMemo(() => (events.length > 0 ? events : seededTickerEvents), [events]);
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
