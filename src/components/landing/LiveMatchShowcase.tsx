"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { fallbackFeaturedMatches } from "@/lib/landingFallback";
import { isSanitizedUsername } from "@/lib/sanitize";

type MatchRow = {
  id: string;
  game_type: string | null;
  status: string | null;
  result: string | null;
  player1_id: string | null;
  player2_id: string | null;
  player1_username: string | null;
  player2_username: string | null;
  stake_amount: number | null;
  bet_amount?: number | null;
  created_at: string;
  completed_at: string | null;
  match_start_time?: string | null;
  move_log?: Array<{ player_id?: string; action?: Record<string, unknown> }> | null;
};

type ProfileTierRow = {
  id: string;
  rank_tier: string | null;
};

type ShowcaseMatch = {
  kind: "live" | "featured";
  id: string;
  game: string;
  timerLabel: string;
  startedAt: string | null;
  player1: { id: string | null; username: string; rank: string };
  player2: { id: string | null; username: string; rank: string };
  bet: number | null;
  moveLog: Array<{ player_id?: string; action?: Record<string, unknown> }>;
};

const BOARD_POSITIONS = [
  [
    "♜..♛♚..♜",
    ".♟♟.♝♟♟.",
    "..♞....♟",
    "....♟...",
    "..♗.♙...",
    ".....♘..",
    "♙♙♙..♙♙♙",
    "♖.♗♕♔..♖",
  ],
  [
    "♜..♛♚..♜",
    ".♟♟...♟.",
    "..♞.♝..♟",
    "...♟♟...",
    "..♗.♙...",
    "...♘...♘",
    "♙♙♙..♙♙♙",
    "♖.♗♕♔..♖",
  ],
  [
    "♜..♛♚..♜",
    ".♟♟...♟.",
    "....♝..♟",
    "..♞♟♟...",
    "..♗.♙...",
    "...♘...♘",
    "♙♙♙..♙♙♙",
    "♖.♗♕♔..♖",
  ],
] as const;

const FALLBACK_POSITION = BOARD_POSITIONS[1];

const TIER_SCORE: Record<string, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  diamond: 5,
};

function toTierLabel(raw: string | null | undefined): string {
  const normalized = (raw ?? "").toLowerCase();
  if (normalized === "diamond") return "DIAMOND";
  if (normalized === "platinum") return "PLATINUM I";
  if (normalized === "gold") return "GOLD I";
  if (normalized === "silver") return "SILVER I";
  return "BRONZE I";
}

function tierScore(raw: string | null | undefined): number {
  return TIER_SCORE[(raw ?? "").toLowerCase()] ?? 1;
}

function toGameLabel(gameType: string | null): string {
  if (!gameType) return "Chess";
  if (gameType === "chess") return "Chess";
  return gameType
    .split("-")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function pickFallbackFeatured(): ShowcaseMatch {
  const key = "skillflow_fallback_featured_index";
  let index = Math.floor(Math.random() * fallbackFeaturedMatches.length);
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) {
      index = Number(existing);
    } else {
      window.sessionStorage.setItem(key, String(index));
    }
  } catch {
    // no-op
  }
  const pick = fallbackFeaturedMatches[index] ?? fallbackFeaturedMatches[0];

  return {
    kind: "featured",
    id: `fallback-${index}`,
    game: pick.game,
    timerLabel: "Final",
    startedAt: null,
    player1: { id: null, username: pick.player1.username, rank: pick.player1.rank },
    player2: { id: null, username: pick.player2.username, rank: pick.player2.rank },
    bet: pick.bet,
    moveLog: [],
  };
}

function parseHighlightSquare(moveLog: ShowcaseMatch["moveLog"]): string | null {
  if (!Array.isArray(moveLog) || moveLog.length === 0) return null;
  const last = moveLog[moveLog.length - 1]?.action ?? {};
  const to = last.to;
  if (typeof to === "string" && /^[a-h][1-8]$/i.test(to)) {
    return to.toLowerCase();
  }
  return null;
}

export default function LiveMatchShowcase() {
  const [showcase, setShowcase] = useState<ShowcaseMatch | null>(null);
  const [liveSeconds, setLiveSeconds] = useState(0);

  const loadShowcase = useCallback(async () => {
    try {
      const supabase = createClient();
      if (!supabase) {
        setShowcase(pickFallbackFeatured());
        return;
      }

      const { data: rows, error } = await supabase
        .from("matches")
        .select("*")
        .eq("game_type", "chess")
        .order("created_at", { ascending: false })
        .limit(40);

      if (error || !rows) {
        setShowcase(pickFallbackFeatured());
        return;
      }

      const matches = rows as MatchRow[];
      const ids = [
        ...new Set(matches.flatMap((row) => [row.player1_id, row.player2_id]).filter((id): id is string => !!id)),
      ];

      let tierMap = new Map<string, string>();
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, rank_tier")
          .in("id", ids);
        if (profiles) {
          tierMap = new Map((profiles as ProfileTierRow[]).map((row) => [row.id, row.rank_tier ?? "bronze"]));
        }
      }

      const withScore = matches
        .filter((row) => isSanitizedUsername(row.player1_username) && isSanitizedUsername(row.player2_username))
        .map((row) => {
          const p1Tier = tierMap.get(row.player1_id ?? "") ?? "bronze";
          const p2Tier = tierMap.get(row.player2_id ?? "") ?? "bronze";
          const p1Score = tierScore(p1Tier);
          const p2Score = tierScore(p2Tier);
          const bothGoldOrHigher = p1Score >= 3 && p2Score >= 3 ? 1 : 0;
          const combinedRankScore = p1Score + p2Score;
          const bet = Number((row.bet_amount ?? row.stake_amount) ?? 0);
          return { row, p1Tier, p2Tier, bothGoldOrHigher, combinedRankScore, bet };
        });

      const active = withScore
        .filter((entry) => entry.row.status === "in_progress")
        .sort((a, b) => {
          if (b.bothGoldOrHigher !== a.bothGoldOrHigher) return b.bothGoldOrHigher - a.bothGoldOrHigher;
          if (b.bet !== a.bet) return b.bet - a.bet;
          return b.combinedRankScore - a.combinedRankScore;
        });

      const startOfTodayUtc = new Date();
      startOfTodayUtc.setUTCHours(0, 0, 0, 0);

      const completedToday = withScore
        .filter((entry) => {
          const status = entry.row.status ?? "";
          const created = new Date(entry.row.created_at).getTime();
          return status === "completed" && created >= startOfTodayUtc.getTime();
        })
        .sort((a, b) => b.combinedRankScore - a.combinedRankScore);

      const picked = active[0] ?? completedToday[0];
      if (!picked) {
        setShowcase(pickFallbackFeatured());
        return;
      }

      const row = picked.row;
      const isLive = row.status === "in_progress";
      const endedAt = row.completed_at ? new Date(row.completed_at).getTime() : null;
      const startedAt = row.match_start_time ?? row.created_at;

      const timerLabel =
        isLive
          ? formatDuration(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
          : endedAt
            ? formatDuration(Math.floor((endedAt - new Date(row.created_at).getTime()) / 1000))
            : "Final";

      setShowcase({
        kind: isLive ? "live" : "featured",
        id: row.id,
        game: toGameLabel(row.game_type),
        timerLabel,
        startedAt: startedAt ?? null,
        player1: {
          id: row.player1_id,
          username: row.player1_username ?? "player_one",
          rank: toTierLabel(picked.p1Tier),
        },
        player2: {
          id: row.player2_id,
          username: row.player2_username ?? "player_two",
          rank: toTierLabel(picked.p2Tier),
        },
        bet: picked.bet > 0 ? picked.bet : null,
        moveLog: Array.isArray(row.move_log) ? row.move_log : [],
      });
    } catch {
      setShowcase(pickFallbackFeatured());
    }
  }, []);

  useEffect(() => {
    void loadShowcase();
    const poll = setInterval(() => {
      void loadShowcase();
    }, 3000);
    return () => clearInterval(poll);
  }, [loadShowcase]);

  useEffect(() => {
    if (!showcase || showcase.kind !== "live" || !showcase.startedAt) return;
    const tick = () => {
      setLiveSeconds(Math.floor((Date.now() - new Date(showcase.startedAt as string).getTime()) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [showcase]);

  const board = useMemo(() => {
    if (!showcase || showcase.kind !== "live") return FALLBACK_POSITION;
    const index = showcase.moveLog.length % BOARD_POSITIONS.length;
    return BOARD_POSITIONS[index] ?? FALLBACK_POSITION;
  }, [showcase]);

  const highlightSquare = useMemo(() => parseHighlightSquare(showcase?.moveLog ?? []), [showcase?.moveLog]);

  const timerText =
    showcase?.kind === "live" ? formatDuration(liveSeconds) : (showcase?.timerLabel ?? "Final");

  const badgeLabel = showcase?.kind === "live" ? "LIVE — Chess match" : "FEATURED MATCH";
  const badgeDot = showcase?.kind === "live" ? "bg-[#22c55e]" : "bg-[#FF5E00]";

  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = "/auth/signup";
      }}
      className="w-full rounded-xl border border-[#1a1a22] bg-[#13131a] p-5 text-left transition-colors hover:border-[#2a2a35]"
    >
      <div className="mb-4 flex items-center justify-between text-[11px] tracking-[0.5px] text-[#888]">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${badgeDot}`} />
          <span>{badgeLabel}</span>
        </div>
        <span className="font-mono text-[12px] text-[#aaa]">{timerText}</span>
      </div>

      <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div>
          <p className="text-[13px] font-medium text-white">{showcase?.player1.username ?? "phoenix77"}</p>
          <p className="mt-1 text-[10px] tracking-[0.5px] text-[#FF5E00]">{showcase?.player1.rank ?? "GOLD II"}</p>
        </div>
        <p className="font-mono text-[18px] text-[#444]">vs</p>
        <div className="text-right">
          <p className="text-[13px] font-medium text-white">{showcase?.player2.username ?? "shadowfox"}</p>
          <p className="mt-1 text-[10px] tracking-[0.5px] text-[#FF5E00]">{showcase?.player2.rank ?? "GOLD I"}</p>
        </div>
      </div>

      <p className="mb-4 text-center text-[12px] text-[#888]">
        {showcase?.bet ? (
          <>
            <span className="text-[#FF5E00]">{showcase.bet} SP</span> on the line
          </>
        ) : (
          "Ranked match"
        )}
      </p>

      <div className="rounded-md bg-[#0E0E12] p-2">
        <div className="grid grid-cols-8 overflow-hidden rounded-sm">
          {board.flatMap((row, rowIndex) =>
            row.split("").map((piece, colIndex) => {
              const file = String.fromCharCode(97 + colIndex);
              const rank = String(8 - rowIndex);
              const square = `${file}${rank}`;
              const isDark = (rowIndex + colIndex) % 2 === 0;
              const isHighlight = highlightSquare === square && piece !== ".";

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`flex h-8 w-8 items-center justify-center text-[18px] sm:h-9 sm:w-9 ${
                    isDark ? "bg-[#2a2a35]" : "bg-[#13131a]"
                  }`}
                >
                  <span className={isHighlight ? "text-[#FF5E00]" : "text-[#f0f0f0]"}>
                    {piece === "." ? "" : piece}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-[#666]">Watch live matches across the platform</p>
    </button>
  );
}
