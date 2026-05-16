import { createClient } from "@/lib/supabase/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return !!value && UUID_RE.test(value);
}

async function getAccessToken() {
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase not configured");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  return session.access_token;
}

function getFunctionsBaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Supabase URL missing");
  return `${url}/functions/v1`;
}

export async function escrowMatch(opts: {
  matchId: string;
  opponentId: string | null;
  stake: number;
  opponentIsBot: boolean;
}) {
  if (!isUuid(opts.matchId)) throw new Error("Invalid matchId");
  if (!Number.isInteger(opts.stake) || opts.stake < 50 || opts.stake > 5000) {
    throw new Error("Invalid stake");
  }
  if (!opts.opponentIsBot && !isUuid(opts.opponentId)) {
    throw new Error("Invalid opponentId");
  }

  const token = await getAccessToken();
  const res = await fetch(`${getFunctionsBaseUrl()}/match-escrow`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      matchId: opts.matchId,
      opponentId: opts.opponentId,
      stake: opts.stake,
      opponentIsBot: opts.opponentIsBot,
    }),
  });

  const payload = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    const message =
      typeof payload.error === "string" ? payload.error : `Escrow failed: ${res.status}`;
    throw new Error(message);
  }
  return payload;
}

export async function settleMatch(opts: {
  matchId: string;
  winnerId: string | null;
  gameResult: unknown;
}) {
  if (!isUuid(opts.matchId)) throw new Error("Invalid matchId");
  if (opts.winnerId !== null && !isUuid(opts.winnerId)) {
    throw new Error("Invalid winnerId");
  }

  const token = await getAccessToken();
  const idempotencyKey = `${opts.matchId}:${opts.winnerId ?? "draw"}:${crypto.randomUUID()}`;

  const res = await fetch(`${getFunctionsBaseUrl()}/match-settle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      matchId: opts.matchId,
      winnerId: opts.winnerId,
      gameResult: opts.gameResult,
      idempotencyKey,
    }),
  });

  const payload = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    const message =
      typeof payload.error === "string" ? payload.error : `Settlement failed: ${res.status}`;
    throw new Error(message);
  }
  return payload;
}
