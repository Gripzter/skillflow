"use client";

import { createClient } from "@/lib/supabase/client";

const FUNCTIONS_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;

type StartMatchInput = {
  game: string;
  opponentId: string | null;
  stake: number;
  opponentIsBot: boolean;
};

type StartMatchResult = {
  match_id: string;
  stake_sp: number;
  player_a_balance_after: number;
  player_b_balance_after: number | null;
};

export async function startMatch(input: StartMatchInput): Promise<StartMatchResult> {
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase not configured");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  // Temporary diagnostics requested during recovery.
  // eslint-disable-next-line no-console
  console.log("[CLIENT_START_CALL]", input);
  const res = await fetch(`${FUNCTIONS_BASE}/match-start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  });
  // eslint-disable-next-line no-console
  console.log("[CLIENT_START_RESULT]", res.status);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown" }));
    throw new Error(err.error || `Match start failed: HTTP ${res.status}`);
  }

  return res.json();
}

type FinishMatchInput = {
  matchId: string;
  winnerId: string | null;
  gameResult?: unknown;
};

type FinishMatchResult = {
  status: "settled" | "already_settled";
  match_id: string;
  winner_id: string | null;
  winner_is_bot: boolean;
  caller_won: boolean;
  payout: number;
  caller_balance: number;
};

export async function finishMatch(input: FinishMatchInput): Promise<FinishMatchResult> {
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase not configured");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const idempotencyKey = `${input.matchId}-${session.user.id}`;

  // Temporary diagnostics requested during recovery.
  // eslint-disable-next-line no-console
  console.log("[CLIENT_FINISH_CALL]", input);
  const res = await fetch(`${FUNCTIONS_BASE}/match-finish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ ...input, idempotencyKey }),
  });
  // eslint-disable-next-line no-console
  console.log("[CLIENT_FINISH_RESULT]", res.status);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown" }));
    throw new Error(err.error || `Match finish failed: HTTP ${res.status}`);
  }

  return res.json();
}
