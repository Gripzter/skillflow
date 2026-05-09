"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import { fabricatedMoveSequence, fallbackFeaturedMatches } from "@/lib/landingFallback";
import { isSanitizedUsername } from "@/lib/sanitize";
import { nearestValidSpAmount } from "@/lib/spValidation";

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
  match_start_time: string | null;
  move_log?: Array<{ player_id?: string; action?: Record<string, unknown> }> | null;
  move_history?: Array<{ from?: string; to?: string; piece?: string } | string> | null;
};

type ProfileTierRow = {
  id: string;
  rank_tier: string | null;
};

type ChessMove = { from: string; to: string; piece?: string };
type BoardState = Record<string, string | null>;

type ShowcaseMatch = {
  kind: "live" | "featured" | "fabricated";
  id: string;
  game: string;
  startedAt: string | null;
  player1: { id: string | null; username: string; rank: string };
  player2: { id: string | null; username: string; rank: string };
  bet: number | null;
  moves: ChessMove[];
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

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

function createInitialBoard(): BoardState {
  return {
    a8: "♜", b8: "♞", c8: "♝", d8: "♛", e8: "♚", f8: "♝", g8: "♞", h8: "♜",
    a7: "♟", b7: "♟", c7: "♟", d7: "♟", e7: "♟", f7: "♟", g7: "♟", h7: "♟",
    a6: null, b6: null, c6: null, d6: null, e6: null, f6: null, g6: null, h6: null,
    a5: null, b5: null, c5: null, d5: null, e5: null, f5: null, g5: null, h5: null,
    a4: null, b4: null, c4: null, d4: null, e4: null, f4: null, g4: null, h4: null,
    a3: null, b3: null, c3: null, d3: null, e3: null, f3: null, g3: null, h3: null,
    a2: "♙", b2: "♙", c2: "♙", d2: "♙", e2: "♙", f2: "♙", g2: "♙", h2: "♙",
    a1: "♖", b1: "♘", c1: "♗", d1: "♕", e1: "♔", f1: "♗", g1: "♘", h1: "♖",
  };
}

function isSquare(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[a-h][1-8]$/i.test(value);
}

function applyMove(board: BoardState, move: ChessMove): BoardState {
  if (!isSquare(move.from) || !isSquare(move.to)) return board;
  const next = { ...board };
  const from = move.from.toLowerCase();
  const to = move.to.toLowerCase();
  const movingPiece = next[from] ?? move.piece ?? null;
  if (!movingPiece) return board;
  next[from] = null;
  next[to] = movingPiece;
  return next;
}

function extractMoveLogMoves(log: MatchRow["move_log"]): ChessMove[] {
  if (!Array.isArray(log)) return [];
  const parsed: ChessMove[] = [];
  for (const row of log) {
    const action = row?.action ?? {};
    const from = typeof action.from === "string" ? action.from.toLowerCase() : null;
    const to = typeof action.to === "string" ? action.to.toLowerCase() : null;
    if (isSquare(from) && isSquare(to)) {
      parsed.push({ from, to });
    }
  }
  return parsed;
}

function extractMoveHistoryMoves(history: MatchRow["move_history"]): ChessMove[] {
  if (!Array.isArray(history)) return [];
  const parsed: ChessMove[] = [];
  for (const move of history) {
    if (!move || typeof move === "string") return [];
    const from = typeof move.from === "string" ? move.from.toLowerCase() : null;
    const to = typeof move.to === "string" ? move.to.toLowerCase() : null;
    const piece = typeof move.piece === "string" ? move.piece : undefined;
    if (!isSquare(from) || !isSquare(to)) return [];
    parsed.push({ from, to, piece });
  }
  return parsed;
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
    kind: "fabricated",
    id: `fallback-${index}`,
    game: pick.game,
    startedAt: null,
    player1: { id: null, username: pick.player1.username, rank: pick.player1.rank },
    player2: { id: null, username: pick.player2.username, rank: pick.player2.rank },
    bet: pick.bet,
    moves: fabricatedMoveSequence,
  };
}

export default function LiveMatchShowcase() {
  const [showcase, setShowcase] = useState<ShowcaseMatch | null>(null);
  const [board, setBoard] = useState<BoardState>(createInitialBoard);
  const [justMovedSquare, setJustMovedSquare] = useState<string | null>(null);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const appliedMoveCountRef = useRef(0);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateMove = useCallback((move: ChessMove) => {
    if (!isSquare(move.to)) return;
    setBoard((prev) => applyMove(prev, move));
    setJustMovedSquare(move.to.toLowerCase());
    if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
    pulseTimeoutRef.current = setTimeout(() => {
      setJustMovedSquare(null);
    }, 400);
  }, []);

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

      const pickedLive = active[0];
      if (pickedLive) {
        const liveMoves = extractMoveLogMoves(pickedLive.row.move_log);
        setShowcase({
          kind: "live",
          id: pickedLive.row.id,
          game: toGameLabel(pickedLive.row.game_type),
          startedAt: pickedLive.row.created_at,
          player1: {
            id: pickedLive.row.player1_id,
            username: pickedLive.row.player1_username ?? "player_one",
            rank: toTierLabel(pickedLive.p1Tier),
          },
          player2: {
            id: pickedLive.row.player2_id,
            username: pickedLive.row.player2_username ?? "player_two",
            rank: toTierLabel(pickedLive.p2Tier),
          },
          bet: pickedLive.bet > 0 ? pickedLive.bet : null,
          moves: liveMoves,
        });
        return;
      }

      const pickedCompleted = completedToday[0];
      if (pickedCompleted) {
        const replayMoves = extractMoveHistoryMoves(pickedCompleted.row.move_history);
        if (replayMoves.length > 0) {
          setShowcase({
            kind: "featured",
            id: pickedCompleted.row.id,
            game: toGameLabel(pickedCompleted.row.game_type),
            startedAt: pickedCompleted.row.created_at,
            player1: {
              id: pickedCompleted.row.player1_id,
              username: pickedCompleted.row.player1_username ?? "player_one",
              rank: toTierLabel(pickedCompleted.p1Tier),
            },
            player2: {
              id: pickedCompleted.row.player2_id,
              username: pickedCompleted.row.player2_username ?? "player_two",
              rank: toTierLabel(pickedCompleted.p2Tier),
            },
            bet: pickedCompleted.bet > 0 ? pickedCompleted.bet : null,
            moves: replayMoves,
          });
          return;
        }
      }

      setShowcase(pickFallbackFeatured());
    } catch {
      setShowcase(pickFallbackFeatured());
    }
  }, []);

  useEffect(() => {
    void loadShowcase();
    const refresh = setInterval(() => {
      void loadShowcase();
    }, 15_000);
    return () => clearInterval(refresh);
  }, [loadShowcase]);

  useEffect(() => {
    if (!showcase || showcase.kind !== "live") return;
    const supabase = createClient();
    if (!supabase) return;

    let cancelled = false;
    const syncFromMoves = (moves: ChessMove[]) => {
      const initial = createInitialBoard();
      let boardState = initial;
      for (const move of moves) {
        boardState = applyMove(boardState, move);
      }
      setBoard(boardState);
      appliedMoveCountRef.current = moves.length;
    };

    syncFromMoves(showcase.moves);

    const poll = setInterval(async () => {
      if (cancelled) return;
      try {
        const { data, error } = await supabase
          .from("matches")
          .select("id, status, created_at, move_log")
          .eq("id", showcase.id)
          .single();

        if (error || !data) {
          setShowcase(pickFallbackFeatured());
          return;
        }

        const status = String((data as { status?: string }).status ?? "");
        if (status !== "in_progress") {
          void loadShowcase();
          return;
        }

        const moves = extractMoveLogMoves((data as { move_log?: MatchRow["move_log"] }).move_log);
        const previousCount = appliedMoveCountRef.current;
        if (moves.length > previousCount) {
          for (let i = previousCount; i < moves.length; i += 1) {
            animateMove(moves[i]);
          }
          appliedMoveCountRef.current = moves.length;
        }
      } catch {
        setShowcase(pickFallbackFeatured());
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [animateMove, loadShowcase, showcase]);

  useEffect(() => {
    if (!showcase || showcase.kind === "live") return;
    let cancelled = false;
    let stepTimer: ReturnType<typeof setTimeout> | null = null;

    const runReplay = () => {
      let current = createInitialBoard();
      setBoard(current);
      let idx = 0;

      const step = () => {
        if (cancelled) return;
        if (idx < showcase.moves.length) {
          const move = showcase.moves[idx];
          current = applyMove(current, move);
          setBoard(current);
          setJustMovedSquare(move.to);
          if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
          pulseTimeoutRef.current = setTimeout(() => setJustMovedSquare(null), 400);
          idx += 1;
          stepTimer = setTimeout(step, 1500);
          return;
        }
        replayTimeoutRef.current = setTimeout(runReplay, 3000);
      };

      stepTimer = setTimeout(step, 1500);
    };

    runReplay();

    return () => {
      cancelled = true;
      if (stepTimer) clearTimeout(stepTimer);
      if (replayTimeoutRef.current) clearTimeout(replayTimeoutRef.current);
    };
  }, [showcase]);

  useEffect(() => {
    if (!showcase || showcase.kind !== "live" || !showcase.startedAt) return;
    const tick = () => {
      setLiveSeconds(Math.floor((Date.now() - new Date(showcase.startedAt).getTime()) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [showcase]);

  useEffect(() => {
    return () => {
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
      if (replayTimeoutRef.current) clearTimeout(replayTimeoutRef.current);
    };
  }, []);

  const timerText = showcase?.kind === "live" ? formatDuration(liveSeconds) : "REPLAY";
  const badgeLabel = showcase?.kind === "live" ? "LIVE — Chess match" : "FEATURED MATCH";
  const badgeDot = showcase?.kind === "live" ? "bg-[#22c55e]" : "bg-[#FF5E00]";
  const displayBet = showcase?.bet ? nearestValidSpAmount(showcase.bet) : null;
  const squares = useMemo(
    () =>
      RANKS.flatMap((rank, rowIndex) =>
        FILES.map((file, colIndex) => {
          const square = `${file}${rank}`;
          return { square, rowIndex, colIndex, piece: board[square] ?? null };
        })
      ),
    [board]
  );

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
        {displayBet ? (
          <>
            <span className="text-[#FF5E00]">{displayBet} SP</span> on the line
          </>
        ) : (
          "Ranked match"
        )}
      </p>

      <div className="rounded-md bg-[#0E0E12] p-2">
        <div className="grid grid-cols-8 overflow-hidden rounded-sm">
          {squares.map(({ square, rowIndex, colIndex, piece }) => {
            const isDark = (rowIndex + colIndex) % 2 === 0;
            const pulse = justMovedSquare === square ? "piece-just-moved" : "";
            return (
              <div
                key={square}
                className={`chess-square flex h-8 w-8 items-center justify-center text-[18px] sm:h-9 sm:w-9 ${
                  isDark ? "bg-[#2a2a35]" : "bg-[#13131a]"
                }`}
              >
                <span className={`text-[#f0f0f0] ${pulse}`}>{piece ?? ""}</span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-[#666]">Watch live matches across the platform</p>
      <style jsx>{`
        @keyframes piece-pulse {
          0% {
            color: #ff5e00;
            transform: scale(1.2);
          }
          100% {
            color: #ffffff;
            transform: scale(1);
          }
        }
        .piece-just-moved {
          animation: piece-pulse 400ms ease-out;
        }
        .chess-square > * {
          transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </button>
  );
}
