/**
 * SkillFlow Creator SDK
 * Copy this file into your game project. No framework dependencies.
 *
 * Exposes exactly four methods: init, matchStart, reportWinner, matchEnd.
 */

const SKILLFLOW_API_BASE =
  "https://jouicnmzgujhkvwvtagf.supabase.co/functions/v1/sdk-match-event";

const MATCH_START_TIMEOUT_SECONDS = 300;
const REPORT_WINNER_TO_END_SECONDS = 30;

interface InitResult {
  player1Id: string;
  player2Id: string;
  entrySK: number;
  potSK: number;
}

interface MatchStartResult {
  started: true;
  timeoutSeconds: number;
}

interface ReportWinnerResult {
  pending: true;
}

interface MatchEndResult {
  winner: string;
  potSK: number;
  rakeSK: number;
  creatorEarnedSK: number;
}

interface SdkState {
  gameId: string;
  apiKey: string;
  matchId: string;
  player1Id: string | null;
  player2Id: string | null;
  initialized: boolean;
  started: boolean;
  winnerReported: boolean;
  ended: boolean;
}

const state: SdkState = {
  gameId: "",
  apiKey: "",
  matchId: "",
  player1Id: null,
  player2Id: null,
  initialized: false,
  started: false,
  winnerReported: false,
  ended: false,
};

function isDevTestMatch(matchId: string): boolean {
  return matchId.startsWith("test_");
}

function isDevelopmentMode(): boolean {
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
    return true;
  }
  if (typeof window !== "undefined") {
    const host = window.location?.hostname ?? "";
    return host === "localhost" || host === "127.0.0.1";
  }
  return false;
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoObj =
    typeof globalThis !== "undefined" && globalThis.crypto
      ? globalThis.crypto
      : null;

  if (!cryptoObj?.subtle) {
    throw new Error(
      "SkillFlow SDK requires Web Crypto API (crypto.subtle). Use a modern browser or Node 18+."
    );
  }

  const cryptoKey = await cryptoObj.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await cryptoObj.subtle.sign("HMAC", cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function nowTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

async function signRequest(apiKey: string, matchId: string, timestamp: number): Promise<string> {
  return hmacSha256Hex(`${apiKey}${matchId}${timestamp}`, apiKey);
}

async function signWinnerReport(
  apiKey: string,
  matchId: string,
  winnerId: string,
  timestamp: number
): Promise<string> {
  return hmacSha256Hex(`${apiKey}${matchId}${winnerId}${timestamp}`, apiKey);
}

async function postEvent<T>(
  eventType: "init" | "start" | "report_winner" | "end",
  extra: Record<string, unknown> = {}
): Promise<T> {
  const timestamp = nowTimestamp();
  let signature: string;

  if (eventType === "report_winner") {
    const winnerId = extra.winnerId as string;
    signature = await signWinnerReport(state.apiKey, state.matchId, winnerId, timestamp);
  } else {
    signature = await signRequest(state.apiKey, state.matchId, timestamp);
  }

  const response = await fetch(SKILLFLOW_API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SkillFlow-Game-Id": state.gameId,
      "X-SkillFlow-Match-Id": state.matchId,
      "X-SkillFlow-Timestamp": String(timestamp),
      "X-SkillFlow-Signature": signature,
    },
    body: JSON.stringify({
      event_type: eventType,
      game_id: state.gameId,
      match_id: state.matchId,
      timestamp,
      ...extra,
    }),
  });

  const body = (await response.json()) as T & { error?: string; message?: string };

  if (!response.ok) {
    const msg = body.error ?? body.message ?? `SkillFlow SDK error (${response.status})`;
    throw new Error(msg);
  }

  return body;
}

function mockTestInit(matchId: string): InitResult {
  return {
    player1Id: "00000000-0000-4000-8000-000000000001",
    player2Id: "00000000-0000-4000-8000-000000000002",
    entrySK: 400,
    potSK: 800,
  };
}

const SkillFlow = {
  async init(gameId: string, apiKey: string, matchId: string): Promise<InitResult> {
    if (!gameId || !apiKey || !matchId) {
      throw new Error("SkillFlow.init requires gameId, apiKey, and matchId.");
    }

    if (isDevelopmentMode() && isDevTestMatch(matchId)) {
      console.warn(
        "[SkillFlow SDK] Development mode: using test matchId. No real Skillies will move."
      );
      state.gameId = gameId;
      state.apiKey = apiKey;
      state.matchId = matchId;
      state.initialized = true;
      state.started = false;
      state.winnerReported = false;
      state.ended = false;
      const mock = mockTestInit(matchId);
      state.player1Id = mock.player1Id;
      state.player2Id = mock.player2Id;
      return mock;
    }

    state.gameId = gameId;
    state.apiKey = apiKey;
    state.matchId = matchId;
    state.initialized = false;
    state.started = false;
    state.winnerReported = false;
    state.ended = false;

    const result = await postEvent<InitResult>("init");

    state.initialized = true;
    state.player1Id = result.player1Id;
    state.player2Id = result.player2Id;

    return result;
  },

  async matchStart(): Promise<MatchStartResult> {
    if (!state.gameId || !state.apiKey || !state.matchId) {
      throw new Error("SkillFlow.matchStart: call init() first.");
    }
    if (!state.initialized) {
      throw new Error("SkillFlow.matchStart: call init() first.");
    }
    if (state.started) {
      throw new Error("SkillFlow.matchStart: match already started.");
    }
    if (state.ended) {
      throw new Error("SkillFlow.matchStart: match already ended.");
    }

    if (isDevelopmentMode() && isDevTestMatch(state.matchId)) {
      state.started = true;
      return { started: true, timeoutSeconds: MATCH_START_TIMEOUT_SECONDS };
    }

    const result = await postEvent<MatchStartResult>("start");
    state.started = true;
    return result;
  },

  async reportWinner(winnerId: string): Promise<ReportWinnerResult> {
    if (!state.initialized) {
      throw new Error("SkillFlow.reportWinner: call init() first.");
    }
    if (!state.started) {
      throw new Error("SkillFlow.reportWinner: call matchStart() first.");
    }
    if (state.winnerReported) {
      throw new Error("SkillFlow.reportWinner: winner already reported for this match.");
    }
    if (state.ended) {
      throw new Error("SkillFlow.reportWinner: match already ended.");
    }
    if (winnerId !== state.player1Id && winnerId !== state.player2Id) {
      throw new Error(
        "SkillFlow.reportWinner: winnerId must be player1Id or player2Id from init()."
      );
    }

    if (isDevelopmentMode() && isDevTestMatch(state.matchId)) {
      state.winnerReported = true;
      return { pending: true };
    }

    const result = await postEvent<ReportWinnerResult>("report_winner", { winnerId });
    state.winnerReported = true;
    return result;
  },

  async matchEnd(): Promise<MatchEndResult> {
    if (!state.initialized) {
      throw new Error("SkillFlow.matchEnd: call init() first.");
    }
    if (!state.started) {
      throw new Error("SkillFlow.matchEnd: call matchStart() first.");
    }
    if (!state.winnerReported) {
      throw new Error("SkillFlow.matchEnd: call reportWinner() first.");
    }
    if (state.ended) {
      throw new Error("SkillFlow.matchEnd: match already ended.");
    }

    if (isDevelopmentMode() && isDevTestMatch(state.matchId)) {
      state.ended = true;
      return {
        winner: state.player1Id ?? "",
        potSK: 800,
        rakeSK: 96,
        creatorEarnedSK: 19,
      };
    }

    const result = await postEvent<MatchEndResult>("end");
    state.ended = true;
    return result;
  },
};

export default SkillFlow;
