const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const matchStartLogged = new Set<string>();
const matchEndLogged = new Set<string>();
const lastMoveAtByMatch = new Map<string, number>();

export async function logMatchEvent({
  matchId,
  eventType,
  playerId,
  payload,
  reactionTimeMs,
}: {
  matchId: string;
  eventType: string;
  playerId?: string;
  payload?: Record<string, unknown>;
  reactionTimeMs?: number;
}) {
  if (!matchId || !UUID_RE.test(matchId)) return;

  try {
    void fetch("/api/match-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId,
        eventType,
        playerId: playerId && UUID_RE.test(playerId) ? playerId : undefined,
        payload: payload ?? {},
        reactionTimeMs:
          typeof reactionTimeMs === "number" && Number.isFinite(reactionTimeMs)
            ? Math.max(0, Math.round(reactionTimeMs))
            : undefined,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // fire-and-forget
  }
}

export function playerIdForRole(
  role: "player1" | "player2",
  player1Id?: string,
  player2Id?: string
): string | undefined {
  return role === "player1" ? player1Id : player2Id;
}

export function logMatchStartOnce(
  matchId: string | undefined,
  playerId: string | undefined,
  payload: Record<string, unknown>
) {
  if (!matchId || !UUID_RE.test(matchId)) return;
  if (matchStartLogged.has(matchId)) return;
  matchStartLogged.add(matchId);
  lastMoveAtByMatch.delete(matchId);
  void logMatchEvent({ matchId, eventType: "match_start", playerId, payload });
}

export function logPlayerMove(
  matchId: string | undefined,
  playerId: string | undefined,
  payload: Record<string, unknown>,
  options?: { reactionTimeMs?: number; usePayloadReactionTime?: boolean }
) {
  if (!matchId || !UUID_RE.test(matchId)) return;

  let reactionTimeMs = options?.reactionTimeMs;
  if (!options?.usePayloadReactionTime) {
    const now = Date.now();
    const last = lastMoveAtByMatch.get(matchId);
    lastMoveAtByMatch.set(matchId, now);
    if (reactionTimeMs === undefined && last !== undefined) {
      reactionTimeMs = now - last;
    }
  }

  void logMatchEvent({
    matchId,
    eventType: "player_move",
    playerId,
    payload,
    reactionTimeMs,
  });
}

export function logMatchEndOnce(
  matchId: string | undefined,
  playerId: string | undefined,
  payload: Record<string, unknown>
) {
  if (!matchId || !UUID_RE.test(matchId)) return;
  if (matchEndLogged.has(matchId)) return;
  matchEndLogged.add(matchId);
  void logMatchEvent({ matchId, eventType: "match_end", playerId, payload });
}
