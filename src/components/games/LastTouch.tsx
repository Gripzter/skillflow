"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase";
import {
  createInitialState,
  addRealPlayer,
  tickSimulation,
  eliminateRealPlayer,
  setRealPlayerHolding,
  addRealPlayerWarning,
  getEntryFeeAtMinute,
  getNextTierMinutes,
  formatHoldTime,
  netPrizePool,
  type LastTouchState,
} from "@/lib/games/last-touch-simulation";

const TICK_INTERVAL_MS = 2000;
const COUNTDOWN_GAME_START_SEC = 5;
const RELEASE_GRACE_MS = 1000;
const MAX_WARNINGS = 3;
const DEV_CHALLENGE_INTERVAL_MS = 30_000;
const CHALLENGE_MIN_INTERVAL_MS = 20 * 60 * 1000;
const CHALLENGE_MAX_INTERVAL_MS = 30 * 60 * 1000;
const CHALLENGE_MIN_DURATION_SEC = 15;
const CHALLENGE_MAX_DURATION_SEC = 30;
const DEV_CHALLENGE_EMAIL = "aras.axmas@gmail.com";
const NORMAL_LOBBY_COUNTDOWN_SEC = 15 * 60;
const DEV_LOBBY_COUNTDOWN_SEC = 30;
const LOBBY_HEARTBEAT_MS = 10_000;
const LOBBY_DISCONNECT_GRACE_MS = 60_000;

type ChallengeType = "shrink" | "split" | "shape_shift" | "rapid_tap" | "squeeze" | "maze";

interface ChallengeState {
  type: ChallengeType;
  startedAtMs: number;
  endsAtMs: number;
  label: string;
  position?: { x: number; y: number };
  sizeScale?: number;
  shape?: "triangle" | "star" | "l-shape";
  rapidTarget?: { x: number; y: number; deadlineMs: number; hitsLeft: number };
}

interface LobbyParticipant {
  userId: string;
  username: string;
  lastSeenMs: number;
}

interface LastTouchProps {
  userId?: string;
  userEmail?: string;
  devModeRequested?: boolean;
  username: string;
  entryFee: number;
  /** Called when user clicks Join. Parent should debit wallet and return true if success. */
  onJoinRequest: (fee: number) => Promise<boolean>;
  onWin: (amount: number) => void;
  onEliminated: (rank: number, total: number) => void;
}

function AnimatedNumber({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useLayoutEffect(() => {
    if (value === prevRef.current) return;
    const start = prevRef.current;
    prevRef.current = value;
    const duration = 400;
    const startTime = performance.now();
    const step = (t: number) => {
      const elapsed = t - startTime;
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - (1 - p) * (1 - p);
      setDisplay(Math.round(start + (value - start) * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);
  return <>{prefix}{display.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
}

export default function LastTouch({
  userId,
  userEmail,
  devModeRequested = false,
  username,
  entryFee,
  onJoinRequest,
  onWin,
  onEliminated,
}: LastTouchProps) {
  const canUseDevMode = devModeRequested && (userEmail ?? "").toLowerCase() === DEV_CHALLENGE_EMAIL;
  const [state, setState] = useState<LastTouchState>(() =>
    createInitialState({
      initialBotsCount: 0,
      nextGameInSec: canUseDevMode ? DEV_LOBBY_COUNTDOWN_SEC : NORMAL_LOBBY_COUNTDOWN_SEC,
    })
  );
  const [joined, setJoined] = useState(false);
  const [countdownNum, setCountdownNum] = useState<number | null>(null);
  const [holdStartMs, setHoldStartMs] = useState<number | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const [nextChallengeAtMs, setNextChallengeAtMs] = useState<number | null>(null);
  const [challengeBanner, setChallengeBanner] = useState<string | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [splitSpacePressed, setSplitSpacePressed] = useState(false);
  const [activeTouchCount, setActiveTouchCount] = useState(0);
  const [releaseGraceDeadline, setReleaseGraceDeadline] = useState<number | null>(null);
  const [lobbyFeed, setLobbyFeed] = useState<Array<{ id: string; username: string; message: string; atMs: number }>>([]);
  const [lobbyParticipants, setLobbyParticipants] = useState<Record<string, LobbyParticipant>>({});
  const touchZoneRef = useRef<HTMLDivElement>(null);
  const activePointersRef = useRef<Set<number>>(new Set());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const releaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const splitFailTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChallengeTypeRef = useRef<ChallengeType | null>(null);
  const selfLobbyIdRef = useRef<string>((userId && userId.trim()) || `u:${username.toLowerCase()}`);
  const seenLobbyUsersRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<NonNullable<ReturnType<typeof createClient>>["channel"]> | null>(null);

  const remaining = useMemo(
    () => state.players.filter((p) => p.eliminatedAtMs == null),
    [state.players]
  );
  const totalPlayers = state.players.length;
  const realPlayer = state.players.find((p) => p.isReal);
  const isEliminated = state.realPlayerEliminated;
  const lobbyJoinedCount = Object.keys(lobbyParticipants).length;
  const playersRemaining = remaining.length;
  const eliminatedThisSession = Math.max(0, totalPlayers - playersRemaining);
  const gameElapsedMs = state.gameStartMs != null ? Date.now() - state.gameStartMs : 0;
  const difficulty = Math.min(1, gameElapsedMs / (60 * 60 * 1000));
  const nextChallengeCountdownSec =
    nextChallengeAtMs == null ? null : Math.max(0, Math.ceil((nextChallengeAtMs - Date.now()) / 1000));
  const challengeSecLeft =
    challenge == null ? 0 : Math.max(0, Math.ceil((challenge.endsAtMs - Date.now()) / 1000));
  const netPool = netPrizePool(state.prizePool);
  const liveLobbyPrizePool = lobbyJoinedCount * entryFee;

  useEffect(() => {
    selfLobbyIdRef.current = (userId && userId.trim()) || `u:${username.toLowerCase()}`;
  }, [userId, username]);

  const broadcastLobbyUpsert = useCallback(async () => {
    const ch = channelRef.current;
    if (!ch || !joined || state.phase !== "lobby") return;
    const payload = {
      userId: selfLobbyIdRef.current,
      username,
      lastSeenMs: Date.now(),
    };
    localStorage.setItem(`lasttouch:lobby:${payload.userId}`, JSON.stringify(payload));
    await ch
      .send({
        type: "broadcast",
        event: "last_touch_lobby_upsert",
        payload,
      })
      .catch(() => {});
  }, [joined, state.phase, username]);

  const eliminateMe = useCallback(
    (reason: "lift" | "challenge" | "visibility") => {
      if (isEliminated) return;
      setIsHolding(false);
      setHoldStartMs(null);
      setReleaseGraceDeadline(null);
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
      if (splitFailTimeoutRef.current) clearTimeout(splitFailTimeoutRef.current);
      setState((s) => eliminateRealPlayer(s, reason, Date.now()));
      channelRef.current
        ?.send({
          type: "broadcast",
          event: "last_touch_elimination",
          payload: { username, reason, atMs: Date.now() },
        })
        .catch(() => {});
      if (navigator.vibrate) navigator.vibrate(50);
    },
    [isEliminated, username]
  );

  // Lobby: next game countdown
  useEffect(() => {
    if (state.phase !== "lobby") return;
    const t = setInterval(() => {
      setState((s) => {
        const next = Math.max(0, s.nextGameCountdownSec - 1);
        return { ...s, nextGameCountdownSec: next };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [state.phase]);

  // When lobby countdown hits 0 and joined → start game countdown
  useEffect(() => {
    if (state.phase !== "lobby" || !joined || state.nextGameCountdownSec > 0) return;
    setState((s) => ({
      ...s,
      phase: "countdown",
      gameStartMs: null,
    }));
    setCountdownNum(COUNTDOWN_GAME_START_SEC);
  }, [state.phase, joined, state.nextGameCountdownSec]);

  // If not joined when lobby countdown hits 0, reset for next session
  useEffect(() => {
    if (state.phase !== "lobby" || joined || state.nextGameCountdownSec !== 0) return;
    setState((s) => ({
      ...s,
      nextGameCountdownSec: canUseDevMode ? DEV_LOBBY_COUNTDOWN_SEC : NORMAL_LOBBY_COUNTDOWN_SEC,
    }));
  }, [state.phase, joined, state.nextGameCountdownSec, canUseDevMode]);

  // If dev mode toggles on for allowed user while still in lobby, speed up countdown.
  useEffect(() => {
    if (!canUseDevMode) return;
    if (state.phase !== "lobby" || joined) return;
    setState((s) => ({
      ...s,
      nextGameCountdownSec: Math.min(s.nextGameCountdownSec, DEV_LOBBY_COUNTDOWN_SEC),
    }));
  }, [canUseDevMode, state.phase, joined]);

  // Countdown 5,4,3,2,1 then HOLD NOW
  useEffect(() => {
    if (countdownNum === null) return;
    if (countdownNum === 0) {
      setCountdownNum(null);
      setState((s) => ({
        ...s,
        phase: "playing",
        gameStartMs: Date.now(),
      }));
      return;
    }
    const t = setTimeout(() => setCountdownNum((n) => (n != null ? n - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [countdownNum]);

  // Game tick: simulate bot eliminations and late entries
  useEffect(() => {
    if (state.phase !== "playing" && state.phase !== "final10" && state.phase !== "final2" && state.phase !== "final3") return;
    tickRef.current = setInterval(() => {
      setState((s) => tickSimulation(s, Date.now(), isHolding));
    }, TICK_INTERVAL_MS);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [state.phase, isHolding]);

  const onWinCalledRef = useRef(false);
  useEffect(() => {
    if (state.phase !== "winner" || onWinCalledRef.current) return;
    const onlyReal = remaining.length === 1 && remaining[0]?.isReal;
    if (onlyReal && state.gameStartMs != null) {
      onWinCalledRef.current = true;
      const net = netPrizePool(state.prizePool);
      onWin(net);
    }
  }, [state.phase, remaining, state.prizePool, state.gameStartMs, onWin]);

  // Eliminated: callback
  useEffect(() => {
    if (!state.realPlayerEliminated || state.realPlayerRank == null) return;
    onEliminated(state.realPlayerRank, totalPlayers);
  }, [state.realPlayerEliminated, state.realPlayerRank, totalPlayers, onEliminated]);

  // Touch zone: hold detection (mouse + touch)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      if (state.phase !== "playing" && state.phase !== "final10" && state.phase !== "final2" && state.phase !== "final3") return;
      if (isEliminated) return;
      activePointersRef.current.add(e.pointerId);
      setActiveTouchCount(activePointersRef.current.size);
      setIsHolding(true);
      setReleaseGraceDeadline(null);
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
      const now = Date.now();
      setHoldStartMs(now);
      setState((s) => setRealPlayerHolding(s, now));
      if (navigator.vibrate) navigator.vibrate(10);
    },
    [state.phase, isEliminated]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      activePointersRef.current.delete(e.pointerId);
      setActiveTouchCount(activePointersRef.current.size);
      if (isEliminated) return;
      if (activePointersRef.current.size > 0) return;
      setIsHolding(false);
      const deadline = Date.now() + RELEASE_GRACE_MS;
      setReleaseGraceDeadline(deadline);
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
      releaseTimeoutRef.current = setTimeout(() => {
        eliminateMe("lift");
      }, RELEASE_GRACE_MS);
    },
    [isEliminated, eliminateMe]
  );

  const handlePointerLeave = useCallback(() => {
    if (!isHolding || isEliminated) return;
    // Mouse left zone while holding = warning
    setState((s) => {
      const next = addRealPlayerWarning(s);
      const p = next.players.find((x) => x.isReal);
      if (p && p.warnings >= MAX_WARNINGS) return eliminateRealPlayer(next, "lift", Date.now());
      return next;
    });
  }, [isHolding, isEliminated]);

  // Global pointer up (catch release outside element)
  useEffect(() => {
    const up = (e: PointerEvent) => {
      activePointersRef.current.delete(e.pointerId);
      setActiveTouchCount(activePointersRef.current.size);
      setIsHolding(false);
      if (activePointersRef.current.size > 0 || isEliminated) return;
      const deadline = Date.now() + RELEASE_GRACE_MS;
      setReleaseGraceDeadline(deadline);
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
      releaseTimeoutRef.current = setTimeout(() => {
        eliminateMe("lift");
      }, RELEASE_GRACE_MS);
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [isEliminated, eliminateMe]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") setSplitSpacePressed(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSplitSpacePressed(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Visibility: tab hidden = eliminated
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && isHolding && !isEliminated) {
        eliminateMe("visibility");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isHolding, isEliminated, eliminateMe]);

  // Realtime lobby sync + elimination events
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    const channel = supabase.channel("last-touch:global");
    channel
      .on("broadcast", { event: "last_touch_lobby_upsert" }, ({ payload }) => {
        if (!payload || typeof payload !== "object") return;
        const p = payload as { userId?: unknown; username?: unknown; lastSeenMs?: unknown };
        if (typeof p.userId !== "string" || !p.userId) return;
        if (typeof p.username !== "string" || !p.username) return;
        const lastSeenMs = typeof p.lastSeenMs === "number" ? p.lastSeenMs : Date.now();

        setLobbyParticipants((prev) => {
          const existing = prev[p.userId];
          return {
            ...prev,
            [p.userId]: {
              userId: p.userId,
              username: p.username,
              lastSeenMs: Math.max(lastSeenMs, existing?.lastSeenMs ?? 0),
            },
          };
        });

        // One player = one feed entry.
        if (!seenLobbyUsersRef.current.has(p.userId)) {
          seenLobbyUsersRef.current.add(p.userId);
          setLobbyFeed((prev) => [
            {
              id: `join-${p.userId}`,
              username: p.username,
              message: `${p.username} joined Last Touch`,
              atMs: Date.now(),
            },
            ...prev,
          ].slice(0, 50));
        }
      })
      .on("broadcast", { event: "last_touch_elimination" }, () => {
        // Reserved for future live elimination feed UI.
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, []);

  // Heartbeat while in lobby and joined.
  useEffect(() => {
    if (!joined || state.phase !== "lobby") return;
    broadcastLobbyUpsert();
    const t = setInterval(() => {
      broadcastLobbyUpsert();
    }, LOBBY_HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [joined, state.phase, broadcastLobbyUpsert]);

  // Reconnect previous lobby entry after refresh/navigation if seen recently.
  useEffect(() => {
    const key = `lasttouch:lobby:${selfLobbyIdRef.current}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { userId?: string; username?: string; lastSeenMs?: number };
      if (!parsed?.userId || typeof parsed.lastSeenMs !== "number") return;
      if (Date.now() - parsed.lastSeenMs > LOBBY_DISCONNECT_GRACE_MS) {
        localStorage.removeItem(key);
        return;
      }
      if (state.phase === "lobby") {
        setJoined(true);
        setState((s) =>
          s.players.some((p) => p.isReal)
            ? s
            : {
                ...s,
                players: addRealPlayer(s.players, username, entryFee),
              }
        );
      }
    } catch {
      // ignore malformed local storage
    }
  }, [state.phase, username, entryFee]);

  // Drop disconnected lobby players after 60s.
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setLobbyParticipants((prev) => {
        const next: Record<string, LobbyParticipant> = {};
        for (const [id, p] of Object.entries(prev)) {
          if (now - p.lastSeenMs <= LOBBY_DISCONNECT_GRACE_MS) next[id] = p;
        }
        return next;
      });
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const randomChallengeDelayMs = useCallback(() => {
    if (canUseDevMode) return DEV_CHALLENGE_INTERVAL_MS;
    return CHALLENGE_MIN_INTERVAL_MS + Math.random() * (CHALLENGE_MAX_INTERVAL_MS - CHALLENGE_MIN_INTERVAL_MS);
  }, [canUseDevMode]);

  const randomChallengeType = useCallback((): ChallengeType => {
    const all: ChallengeType[] = ["shrink", "split", "shape_shift", "rapid_tap", "squeeze", "maze"];
    const filtered = all.filter((x) => x !== lastChallengeTypeRef.current);
    return filtered[Math.floor(Math.random() * filtered.length)];
  }, []);

  const createChallenge = useCallback((nowMs: number): ChallengeState => {
    const type = randomChallengeType();
    lastChallengeTypeRef.current = type;
    const durationSec =
      CHALLENGE_MIN_DURATION_SEC + Math.floor(Math.random() * (CHALLENGE_MAX_DURATION_SEC - CHALLENGE_MIN_DURATION_SEC + 1));
    const durationMs = durationSec * 1000;
    const base: ChallengeState = {
      type,
      startedAtMs: nowMs,
      endsAtMs: nowMs + durationMs,
      label:
        type === "shrink"
          ? "SHRINK"
          : type === "split"
            ? "SPLIT"
            : type === "shape_shift"
              ? "SHAPE SHIFT"
              : type === "rapid_tap"
                ? "RAPID TAP"
                : type === "squeeze"
                  ? "SQUEEZE"
                  : "MAZE",
    };
    if (type === "shrink" || type === "maze" || type === "rapid_tap") {
      base.position = {
        x: 15 + Math.random() * 70,
        y: 25 + Math.random() * 55,
      };
    }
    if (type === "shrink") {
      base.sizeScale = 0.5 - difficulty * 0.15;
    }
    if (type === "shape_shift") {
      const shapes: Array<"triangle" | "star" | "l-shape"> = ["triangle", "star", "l-shape"];
      base.shape = shapes[Math.floor(Math.random() * shapes.length)];
    }
    if (type === "rapid_tap") {
      base.rapidTarget = {
        x: 10 + Math.random() * 80,
        y: 20 + Math.random() * 70,
        deadlineMs: nowMs + Math.max(700, 1500 - Math.round(difficulty * 500)),
        hitsLeft: 4 + Math.round(difficulty * 4),
      };
    }
    if (type === "squeeze") {
      base.sizeScale = 1;
    }
    return base;
  }, [difficulty, randomChallengeType]);

  // Challenge scheduler
  useEffect(() => {
    if (state.phase !== "playing" && state.phase !== "final10" && state.phase !== "final2" && state.phase !== "final3") return;
    if (isEliminated) return;
    if (nextChallengeAtMs != null || challenge != null) return;
    setNextChallengeAtMs(Date.now() + randomChallengeDelayMs());
  }, [state.phase, isEliminated, challenge, nextChallengeAtMs, randomChallengeDelayMs]);

  useEffect(() => {
    if (nextChallengeAtMs == null || challenge != null) return;
    const t = setInterval(() => {
      if (Date.now() < nextChallengeAtMs) return;
      const next = createChallenge(Date.now());
      setChallenge(next);
      setChallengeBanner(`${next.label} CHALLENGE`);
      setTimeout(() => setChallengeBanner(null), 1800);
      setNextChallengeAtMs(null);
    }, 200);
    return () => clearInterval(t);
  }, [nextChallengeAtMs, challenge, createChallenge]);

  // Challenge validation and ending
  useEffect(() => {
    if (!challenge) return;
    const t = setInterval(() => {
      const now = Date.now();
      if (challenge.type === "split") {
        const splitOk = activeTouchCount >= 2 || (activeTouchCount >= 1 && splitSpacePressed);
        if (!splitOk) {
          if (!splitFailTimeoutRef.current) {
            splitFailTimeoutRef.current = setTimeout(() => eliminateMe("challenge"), RELEASE_GRACE_MS);
          }
        } else if (splitFailTimeoutRef.current) {
          clearTimeout(splitFailTimeoutRef.current);
          splitFailTimeoutRef.current = null;
        }
      }
      if (challenge.type === "rapid_tap" && challenge.rapidTarget && now > challenge.rapidTarget.deadlineMs) {
        eliminateMe("challenge");
      }
      if (now >= challenge.endsAtMs) {
        if (splitFailTimeoutRef.current) {
          clearTimeout(splitFailTimeoutRef.current);
          splitFailTimeoutRef.current = null;
        }
        setChallenge(null);
        setNextChallengeAtMs(Date.now() + randomChallengeDelayMs());
      }
    }, 100);
    return () => clearInterval(t);
  }, [challenge, activeTouchCount, splitSpacePressed, eliminateMe, randomChallengeDelayMs]);

  const handleRapidTapHit = useCallback(() => {
    if (!challenge || challenge.type !== "rapid_tap" || !challenge.rapidTarget) return;
    const now = Date.now();
    const hitsLeft = challenge.rapidTarget.hitsLeft - 1;
    if (hitsLeft <= 0) {
      setChallenge(null);
      setNextChallengeAtMs(Date.now() + randomChallengeDelayMs());
      return;
    }
    setChallenge({
      ...challenge,
      rapidTarget: {
        x: 10 + Math.random() * 80,
        y: 20 + Math.random() * 70,
        deadlineMs: now + Math.max(700, 1500 - Math.round(difficulty * 500)),
        hitsLeft,
      },
    });
  }, [challenge, difficulty, randomChallengeDelayMs]);

  const handleJoin = useCallback(async () => {
    const selfId = selfLobbyIdRef.current;
    if (joined || lobbyParticipants[selfId]) {
      setJoined(true);
      return;
    }
    const ok = await onJoinRequest(entryFee);
    if (!ok) return;
    setJoined(true);
    setState((s) => ({
      ...s,
      players: addRealPlayer(s.players, username, entryFee),
      prizePool: Math.max(s.prizePool, (lobbyJoinedCount + 1) * entryFee),
      feed: s.feed,
    }));
    setLobbyParticipants((prev) => ({
      ...prev,
      [selfId]: { userId: selfId, username, lastSeenMs: Date.now() },
    }));
    if (!seenLobbyUsersRef.current.has(selfId)) {
      seenLobbyUsersRef.current.add(selfId);
      setLobbyFeed((prev) => [
        {
          id: `join-${selfId}`,
          username,
          message: `${username} joined Last Touch`,
          atMs: Date.now(),
        },
        ...prev,
      ].slice(0, 50));
    }
    broadcastLobbyUpsert();
    setNextChallengeAtMs(Date.now() + randomChallengeDelayMs());
  }, [joined, lobbyParticipants, onJoinRequest, entryFee, username, lobbyJoinedCount, broadcastLobbyUpsert, randomChallengeDelayMs]);

  const handleDevStartNow = useCallback(() => {
    if (!canUseDevMode || state.phase !== "lobby") return;
    setCountdownNum(null);
    setState((s) => ({
      ...s,
      phase: "playing",
      gameStartMs: Date.now(),
      nextGameCountdownSec: 0,
    }));
  }, [canUseDevMode, state.phase]);

  const nextTier = state.phase === "lobby" ? getNextTierMinutes(0) : null;
  const currentFee = state.phase === "lobby" ? (getEntryFeeAtMinute(0) ?? 1) : state.lateEntryFee;
  const devBadge = canUseDevMode ? (
    <div className="fixed right-4 top-20 z-40 rounded-full border border-purple-400/50 bg-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-200">
      DEV MODE
    </div>
  ) : null;

  // ----- Lobby -----
  if (state.phase === "lobby") {
    const mins = Math.floor(state.nextGameCountdownSec / 60);
    const secs = state.nextGameCountdownSec % 60;
    return (
      <div className="relative flex flex-col gap-6 pb-8">
        {devBadge}
        <div className="text-center">
          <h1 className="bg-gradient-to-r from-[#FF5E00] via-[#FF7A2E] to-[#FF5E00] bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl md:text-6xl">
            LAST TOUCH
          </h1>
          <p className="mt-2 text-body-gray">Hold your ground. Win it all.</p>
          <div className="mt-4 inline-block animate-pulse text-4xl">👆</div>
        </div>

        <div className="mx-auto w-full max-w-md rounded-2xl border-2 border-steel-blue bg-card/90 p-6 shadow-[0_0_40px_rgba(42,58,92,0.4)]">
          <p className="text-center text-sm text-body-gray">Current Prize Pool</p>
          <p className="mt-2 text-center text-4xl font-bold text-white tabular-nums">
            $<AnimatedNumber value={liveLobbyPrizePool} />
          </p>
          <p className="mt-1 text-center text-sm text-body-gray">
            {lobbyJoinedCount} Players Joined
          </p>
        </div>

        <div className="card-border mx-auto w-full max-w-md rounded-xl bg-card/80 p-5">
          <p className="text-sm text-body-gray">Entry Fee</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">${currentFee.toFixed(2)}</p>
          {nextTier && (
            <p className="mt-1 text-xs text-body-gray">
              Price increases in: {Math.floor(state.nextGameCountdownSec / 60)}:
              {(state.nextGameCountdownSec % 60).toString().padStart(2, "0")}
            </p>
          )}
          <ul className="mt-4 space-y-1 text-xs text-body-gray">
            <li>Now: $1.00 {!joined ? "← YOU ARE HERE" : ""}</li>
            <li>After 10 min: $2.00</li>
            <li>After 20 min: $5.00</li>
            <li>After 30 min: $10.00</li>
            <li>After 45 min: $25.00</li>
            <li>After 60 min: $50.00 (FINAL) / Entries closed</li>
          </ul>
        </div>

        <div className="text-center">
          <p className="text-body-gray">Next Game Starts In</p>
          <p className="mt-2 font-mono text-4xl font-bold text-white tabular-nums">
            {mins}:{secs.toString().padStart(2, "0")}
          </p>
          {canUseDevMode && (
            <p className="mt-1 text-xs text-purple-300">Dev mode: accelerated lobby + challenge cadence</p>
          )}
        </div>

        {!joined && (
          <div className="mx-auto w-full max-w-md">
            <button
              type="button"
              onClick={handleJoin}
              className="w-full rounded-xl bg-teal py-4 text-lg font-bold text-charcoal shadow-[0_0_30px_rgba(255,94,0,0.4)] transition hover:opacity-95"
            >
              JOIN NOW — ${entryFee.toFixed(2)}
            </button>
            <p className="mt-2 text-center text-sm text-body-gray">
              {lobbyJoinedCount} players already joined
            </p>
          </div>
        )}

        <div className="mx-auto w-full max-w-md">
          <button
            type="button"
            onClick={() => setHowItWorksOpen((o) => !o)}
            className="w-full rounded-lg border border-white/10 py-2 text-sm text-body-gray"
          >
            How it works {howItWorksOpen ? "▲" : "▼"}
          </button>
          {howItWorksOpen && (
            <div className="mt-2 rounded-lg bg-white/5 p-4 text-sm text-body-gray">
              <p>1. Join by paying the entry fee.</p>
              <p>2. When the game starts, press and HOLD the touch zone.</p>
              <p>3. Don&apos;t lift your finger — if you do, you&apos;re out!</p>
              <p>4. Last person holding wins the ENTIRE prize pool.</p>
              <p className="mt-2">Rules: Keep your finger on the zone. Random challenges may require tapping a target with your other hand. If you leave the app, you&apos;re out.</p>
            </div>
          )}
        </div>

        <div className="mx-auto w-full max-w-md">
          <p className="mb-2 text-xs text-body-gray">Live feed</p>
          <div className="flex h-32 flex-col gap-1 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-2">
            {lobbyFeed.slice(0, 12).map((f) => (
              <div key={f.id} className="text-xs text-white/90">
                🎮 {f.message}
              </div>
            ))}
          </div>
        </div>

        {canUseDevMode && (
          <div className="mx-auto w-full max-w-md">
            <button
              type="button"
              onClick={handleDevStartNow}
              className="w-full rounded-full border-2 px-4 py-2 text-[12px] font-semibold"
              style={{ background: "#FF5E00", borderColor: "#FF5E00", color: "#0E0E12" }}
            >
              Start Now (Dev)
            </button>
          </div>
        )}
      </div>
    );
  }

  // ----- Countdown 5,4,3,2,1 -----
  if (state.phase === "countdown" && countdownNum != null) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        {devBadge}
        {countdownNum > 0 ? (
          <span className="animate-pulse font-mono text-9xl font-black text-white">
            {countdownNum}
          </span>
        ) : (
          <span className="bg-gradient-to-r from-teal to-purple-500 bg-clip-text text-5xl font-black text-transparent md:text-7xl">
            HOLD NOW!
          </span>
        )}
      </div>
    );
  }

  // ----- Winner -----
  if (state.phase === "winner") {
    const winner = remaining[0];
    const isRealWinner = winner?.isReal ?? false;
    const net = netPrizePool(state.prizePool);
    const holdTime = state.gameStartMs != null && winner
      ? (winner.eliminatedAtMs ?? Date.now()) - state.gameStartMs
      : 0;
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        {devBadge}
        <h2 className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-5xl font-black text-transparent">
          WINNER!
        </h2>
        <p className="text-2xl font-bold text-white">{winner?.username}</p>
        <p className="text-teal text-xl">Won ${net.toFixed(2)}!</p>
        <p className="text-body-gray">Hold time: {formatHoldTime(holdTime)}</p>
        {isRealWinner && (
          <p className="text-lg text-teal">🎉 Congratulations! Funds added to your wallet.</p>
        )}
        {state.realPlayerEliminated && (
          <p className="text-body-gray">
            You placed #{state.realPlayerRank} out of {totalPlayers} players. Better luck next time!
          </p>
        )}
        <div className="flex gap-4">
          <a
            href="/last-touch"
            className="rounded-xl bg-teal px-6 py-3 font-semibold text-charcoal"
          >
            Play Again
          </a>
          <button
            type="button"
            className="rounded-xl border border-white/20 px-6 py-3 font-semibold text-white"
          >
            Share Result
          </button>
        </div>
      </div>
    );
  }

  // ----- Playing / Final 10 / 2 / 3 -----
  const myHoldMs = holdStartMs != null ? Date.now() - holdStartMs : 0;
  const baseHoldSizePx = 240;
  const challengeScale =
    challenge?.type === "shrink"
      ? challenge.sizeScale ?? 0.5
      : challenge?.type === "squeeze"
        ? Math.max(0.25, 1 - ((Date.now() - challenge.startedAtMs) / Math.max(1, challenge.endsAtMs - challenge.startedAtMs)) * 0.75)
        : 1;
  const challengeSizePx = Math.round(baseHoldSizePx * challengeScale);
  const zoneClipPath =
    challenge?.type === "shape_shift"
      ? challenge.shape === "triangle"
        ? "polygon(50% 0%, 0% 100%, 100% 100%)"
        : challenge.shape === "star"
          ? "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)"
          : "polygon(0% 0%, 70% 0%, 70% 30%, 30% 30%, 30% 100%, 0% 100%)"
      : "circle(50% at 50% 50%)";

  return (
    <div className="flex flex-col gap-4 pb-6">
      {devBadge}
      <div className="flex items-center justify-between">
        <span className="font-bold text-white">LAST TOUCH</span>
        <span className="font-mono text-white tabular-nums">{formatHoldTime(gameElapsedMs)}</span>
        <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
        </span>
      </div>

      <div className="rounded-xl border border-teal/30 bg-card/80 p-4 text-center">
        <p className="text-xs text-body-gray">PRIZE POOL</p>
        <p className="text-3xl font-bold text-white tabular-nums">
          $<AnimatedNumber value={netPool} />
        </p>
        <p className="mt-1 text-xs text-body-gray">Gross pool: ${state.prizePool.toFixed(2)} · Platform fee: 5%</p>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-2">
        <span className="text-body-gray">Players Remaining</span>
        <span className="font-mono font-bold text-white tabular-nums">
          {playersRemaining} / {Math.max(totalPlayers, playersRemaining)}
        </span>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-2 text-sm">
        <span className="text-body-gray">Eliminated this session</span>
        <span className="font-mono font-bold text-white tabular-nums">{eliminatedThisSession}</span>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-2 text-sm">
        <span className="text-body-gray">Next challenge in</span>
        <span className="font-mono font-bold text-white tabular-nums">
          {nextChallengeCountdownSec == null ? "—" : `${nextChallengeCountdownSec}s`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-teal/80 transition-all duration-500"
          style={{ width: `${Math.max(0, Math.min(100, (playersRemaining / Math.max(totalPlayers, 1)) * 100))}%` }}
        />
      </div>

      {challengeBanner && (
        <div className="rounded-lg border border-amber-400/60 bg-amber-400/15 px-4 py-2 text-center text-sm font-semibold text-amber-300">
          {challengeBanner}
        </div>
      )}
      {challenge && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-center text-xs text-amber-300">
          {challenge.label} · {challengeSecLeft}s left
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center">
        {!isEliminated ? (
          <div className="relative h-[360px] w-full max-w-[380px] overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            {challenge?.type === "rapid_tap" && challenge.rapidTarget ? (
              <button
                type="button"
                onClick={handleRapidTapHit}
                className="absolute z-30 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-amber-300 bg-amber-300/20 text-xs font-bold text-amber-200"
                style={{ left: `${challenge.rapidTarget.x}%`, top: `${challenge.rapidTarget.y}%` }}
              >
                TAP
              </button>
            ) : (
              <div
                ref={touchZoneRef}
                role="button"
                tabIndex={0}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                onContextMenu={(e) => e.preventDefault()}
                className={`absolute z-20 flex cursor-pointer select-none flex-col items-center justify-center border-4 transition-all ${
                  isHolding
                    ? "border-teal bg-gradient-to-br from-teal/60 to-purple-500/60 shadow-[0_0_60px_rgba(255,94,0,0.6)]"
                    : "border-white/20 bg-white/5 hover:border-teal/50"
                }`}
                style={{
                  width: challengeSizePx,
                  height: challengeSizePx,
                  left: `${challenge?.position?.x ?? 50}%`,
                  top: `${challenge?.position?.y ?? 55}%`,
                  transform: challenge?.type === "maze" ? `translate(-50%, -50%) translate(${Math.sin(Date.now() / 400) * 48}px, ${Math.cos(Date.now() / 460) * 24}px)` : "translate(-50%, -50%)",
                  touchAction: "none",
                  clipPath: zoneClipPath,
                  borderRadius: challenge?.type === "shape_shift" ? "18%" : "999px",
                }}
              >
                {isHolding ? (
                  <>
                    <p className="font-mono text-2xl font-bold text-white tabular-nums">{formatHoldTime(myHoldMs)}</p>
                    <p className="mt-1 text-xs text-teal">HOLDING</p>
                  </>
                ) : (
                  <p className="text-center text-sm text-body-gray">HOLD HERE</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-[200px] min-w-[200px] flex-col items-center justify-center rounded-full border-4 border-red-500/80 bg-red-500/20">
            <p className="text-xl font-bold text-red-400">ELIMINATED</p>
            {state.realPlayerEliminatedAtMs != null && state.realPlayerHoldStartMs != null && (
              <p className="mt-1 text-sm text-body-gray">
                Hold time: {formatHoldTime(state.realPlayerEliminatedAtMs - state.realPlayerHoldStartMs)}
              </p>
            )}
            <p className="mt-1 text-sm text-white">Rank #{state.realPlayerRank}</p>
          </div>
        )}
      </div>

      <div className="rounded-lg bg-black/40 p-2">
        <p className="mb-1 text-xs text-body-gray">Eliminations</p>
        <div className="flex max-h-24 flex-col gap-0.5 overflow-y-auto">
          {state.feed.filter((f) => f.type === "eliminate" || f.type === "late_join").slice(0, 8).map((f) => (
            <div
              key={f.id}
              className={`text-xs ${f.type === "late_join" ? "text-emerald-400" : "text-red-400/90"}`}
            >
              {f.type === "late_join" && "💰"} {f.type === "eliminate" && "❌"} {f.message}
            </div>
          ))}
        </div>
      </div>

      {realPlayer && !isEliminated && (
        <div className="rounded-lg border border-white/10 bg-card/60 p-3 text-sm">
          <p>Your Hold Time: {formatHoldTime(myHoldMs)}</p>
          <p>Your Rank: #{Math.max(1, playersRemaining)} / {Math.max(totalPlayers, playersRemaining)}</p>
          <p>Warnings: {realPlayer.warnings} / {MAX_WARNINGS}</p>
          {releaseGraceDeadline && (
            <p className="text-amber-300">Reconnect hold within 1s or you are out</p>
          )}
          {challenge?.type === "split" && (
            <p className="text-amber-300">
              SPLIT: hold two contacts (two fingers, or one finger + SPACE)
            </p>
          )}
          {canUseDevMode && <p className="text-purple-300">Dev mode active: challenges every 30s</p>}
        </div>
      )}
    </div>
  );
}
