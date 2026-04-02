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
  addRealPlayer,
  eliminateRealPlayer,
  setRealPlayerHolding,
  addRealPlayerWarning,
  formatHoldTime,
  netPrizePool,
  type LastTouchState,
} from "@/lib/games/last-touch-simulation";
import {
  joinSession,
  isUserJoined,
  fetchActiveSession,
  markSessionLive,
  markSessionCancelled,
  markSessionCompleted,
  ensureUpcomingSessions,
  type LastTouchSession,
} from "@/lib/games/last-touch-sessions";

const START_COUNTDOWN_SEC = 3;
const RELEASE_GRACE_MS = 1000;
const MAX_WARNINGS = 3;
const MIN_PLAYERS_TO_START = 2;
const CHALLENGE_MIN_MS = 20 * 60 * 1000;
const CHALLENGE_MAX_MS = 30 * 60 * 1000;
const CHALLENGE_MIN_SEC = 15;
const CHALLENGE_MAX_SEC = 30;
const NOTIFICATION_PERMISSION_KEY = "lasttouch:notification-permission";

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

interface Props {
  session: LastTouchSession | null;
  userId: string;
  username: string;
  onJoinRequest: (fee: number) => Promise<boolean>;
  onWin: (amount: number) => void;
  onEliminated: (rank: number, total: number) => void;
  onSessionUpdate: (s: LastTouchSession) => void;
  onSessionCancelled: (sessionId: string, amount: number) => void | Promise<void>;
}

function AnimatedNumber({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useLayoutEffect(() => {
    if (value === prevRef.current) return;
    const start = prevRef.current;
    prevRef.current = value;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 400);
      const e = 1 - (1 - p) * (1 - p);
      setDisplay(Math.round(start + (value - start) * e));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);
  return (
    <>
      {prefix}
      {display.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </>
  );
}

export default function LastTouch({
  session,
  userId,
  username,
  onJoinRequest,
  onWin,
  onEliminated,
  onSessionUpdate,
  onSessionCancelled,
}: Props) {
  // Live session — starts from prop, updated by realtime
  const [liveSession, setLiveSession] = useState<LastTouchSession | null>(session);
  const [dbPlayerCount, setDbPlayerCount] = useState(0);
  const [dbAliveCount, setDbAliveCount] = useState(0);
  const [joined, setJoined] = useState(false);
  const [countdownSec, setCountdownSec] = useState(0);
  const [startCountdownNum, setStartCountdownNum] = useState<number | null>(null);
  const [simState, setSimState] = useState<LastTouchState | null>(null);
  const [holdStartMs, setHoldStartMs] = useState<number | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [activeTouchCount, setActiveTouchCount] = useState(0);
  const [releaseGraceDeadline, setReleaseGraceDeadline] = useState<number | null>(null);
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const [nextChallengeAtMs, setNextChallengeAtMs] = useState<number | null>(null);
  const [challengeBanner, setChallengeBanner] = useState<string | null>(null);
  const [splitSpacePressed, setSplitSpacePressed] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  const activePointersRef = useRef<Set<number>>(new Set());
  const releaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const splitFailTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChallengeTypeRef = useRef<ChallengeType | null>(null);
  const onWinCalledRef = useRef(false);
  const markedLiveRef = useRef(false);
  const gameStartedRef = useRef(false);
  const dbPlayerCountRef = useRef(0);
  const liveSessionRef = useRef<LastTouchSession | null>(session);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync session from parent
  useEffect(() => {
    setLiveSession(session);
    liveSessionRef.current = session;
    markedLiveRef.current = false; // reset when session changes
    gameStartedRef.current = false;
    onWinCalledRef.current = false;
  }, [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // If a live session is shown to a non-joined user, immediately move them to the next upcoming session.
  useEffect(() => {
    if (!liveSession || liveSession.status !== "live" || joined) return;
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;
    void (async () => {
      const next = await fetchActiveSession(supabase);
      if (cancelled || !next || next.id === liveSession.id || next.status !== "upcoming") return;
      setLiveSession(next);
      liveSessionRef.current = next;
      onSessionUpdate(next);
    })();
    return () => { cancelled = true; };
  }, [liveSession, joined, onSessionUpdate]);

  // Check if user is already joined (handles page refresh)
  useEffect(() => {
    if (!session?.id || !userId) return;
    const supabase = createClient();
    if (!supabase) return;
    isUserJoined(supabase, session.id, userId).then((yes) => {
      if (yes) setJoined(true);
    });
  }, [session?.id, userId]);

  // Realtime: session updates + player inserts
  useEffect(() => {
    if (!session?.id) return;
    const supabase = createClient();
    if (!supabase) return;

    const refreshCounts = async () => {
      const { data } = await supabase
        .from("last_touch_players")
        .select("status")
        .eq("session_id", session.id);
      if (!Array.isArray(data)) return;
      const total = data.length;
      const alive = data.filter((row) => row.status === "alive").length;
      setDbPlayerCount(total);
      setDbAliveCount(alive);
      dbPlayerCountRef.current = total;
    };
    void refreshCounts();

    const ch = supabase
      .channel(`lt-session:${session.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "last_touch_sessions", filter: `id=eq.${session.id}` },
        (payload) => {
          const updated = payload.new as LastTouchSession;
          setLiveSession(updated);
          liveSessionRef.current = updated;
          onSessionUpdate(updated);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "last_touch_players", filter: `session_id=eq.${session.id}` },
        () => void refreshCounts()
      )
      .subscribe();

    return () => { ch.unsubscribe(); };
  }, [session?.id, onSessionUpdate]);

  // Countdown derived from scheduled_start_at
  useEffect(() => {
    if (!liveSession) return;
    const compute = () => {
      if (liveSession.status === "live") { setCountdownSec(0); return; }
      const sec = Math.max(0, Math.ceil((new Date(liveSession.scheduled_start_at).getTime() - Date.now()) / 1000));
      setCountdownSec(sec);
    };
    compute();
    const t = setInterval(compute, 500);
    return () => clearInterval(t);
  }, [liveSession]);

  // When countdown reaches 0, transition session → live (first client wins, idempotent)
  useEffect(() => {
    if (!liveSession || liveSession.status !== "upcoming" || countdownSec > 0) return;
    if (markedLiveRef.current) return;
    markedLiveRef.current = true;
    const supabase = createClient();
    if (!supabase) return;
    void (async () => {
      if (dbPlayerCountRef.current < MIN_PLAYERS_TO_START) {
        await markSessionCancelled(supabase, liveSession.id);
        if (joined) {
          await onSessionCancelled(liveSession.id, liveSession.entry_fee);
          setJoined(false);
          setCancelMessage(
            `Not enough players — game cancelled. Your $${liveSession.entry_fee.toFixed(2)} has been refunded.`
          );
        } else {
          setCancelMessage("Not enough players — game cancelled.");
        }
        await ensureUpcomingSessions(supabase);
        const next = await fetchActiveSession(supabase);
        if (next && next.status === "upcoming") {
          setLiveSession(next);
          liveSessionRef.current = next;
          onSessionUpdate(next);
        }
        return;
      }
      await markSessionLive(supabase, liveSession.id);
    })();
  }, [countdownSec, liveSession, joined, onSessionCancelled, onSessionUpdate]);

  // When session goes live + user joined → start 5s game countdown
  useEffect(() => {
    if (!liveSession || liveSession.status !== "live" || !joined || gameStartedRef.current) return;
    gameStartedRef.current = true;
    setStartCountdownNum(START_COUNTDOWN_SEC);
  }, [liveSession?.status, joined]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3, 2, 1 -> init live game state.
  useEffect(() => {
    if (startCountdownNum === null) return;
    if (startCountdownNum === 0) {
      setStartCountdownNum(null);
      const sess = liveSessionRef.current;
      const allPlayers = addRealPlayer([], username, sess?.entry_fee ?? 1);
      const prizePool = sess?.prize_pool ?? dbPlayerCountRef.current;
      setSimState({
        phase: "playing",
        gameStartMs: Date.now(),
        players: allPlayers,
        prizePool,
        feed: [],
        realPlayerEliminated: false,
        realPlayerRank: null,
        realPlayerHoldStartMs: null,
        realPlayerEliminatedAtMs: null,
        realPlayerWarnings: 0,
        nextGameCountdownSec: 0,
        lateEntryFee: sess?.entry_fee ?? 1,
        milestonesReached: [],
      });
      setNextChallengeAtMs(
        Date.now() + (CHALLENGE_MIN_MS + Math.random() * (CHALLENGE_MAX_MS - CHALLENGE_MIN_MS))
      );
      return;
    }
    const t = setTimeout(() => setStartCountdownNum((n) => (n != null ? n - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [startCountdownNum, username]);

  // Derived
  const remaining = useMemo(
    () => simState?.players.filter((p) => p.eliminatedAtMs == null) ?? [],
    [simState?.players]
  );
  const totalPlayers = simState?.players.length ?? 0;
  const realPlayer = simState?.players.find((p) => p.isReal);
  const isEliminated = simState?.realPlayerEliminated ?? false;
  const isGameActive =
    simState != null &&
    ["playing", "final10", "final3", "final2"].includes(simState.phase);
  const gameElapsedMs = simState?.gameStartMs != null ? Date.now() - simState.gameStartMs : 0;
  const difficulty = Math.min(1, gameElapsedMs / (60 * 60 * 1000));
  const myHoldMs = holdStartMs != null ? Date.now() - holdStartMs : 0;
  const playersRemaining = Math.max(0, dbAliveCount || remaining.length);
  const sessionTotalPlayers = Math.max(dbPlayerCount, totalPlayers, playersRemaining);
  const eliminatedThisSession = Math.max(0, sessionTotalPlayers - playersRemaining);
  const netPool = netPrizePool(liveSession?.prize_pool ?? 0);
  const challengeSecLeft =
    challenge == null ? 0 : Math.max(0, Math.ceil((challenge.endsAtMs - Date.now()) / 1000));
  const nextChallengeCountdownSec =
    nextChallengeAtMs == null
      ? null
      : Math.max(0, Math.ceil((nextChallengeAtMs - Date.now()) / 1000));

  const eliminateMe = useCallback(
    (reason: "lift" | "challenge" | "visibility") => {
      if (isEliminated) return;
      setIsHolding(false);
      setHoldStartMs(null);
      setReleaseGraceDeadline(null);
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
      if (splitFailTimeoutRef.current) clearTimeout(splitFailTimeoutRef.current);
      setSimState((s) => (s ? eliminateRealPlayer(s, reason, Date.now()) : s));
      const supabase = createClient();
      if (supabase && liveSessionRef.current) {
        void supabase
          .from("last_touch_players")
          .update({ status: "eliminated" })
          .eq("session_id", liveSessionRef.current.id)
          .eq("user_id", userId);
      }
      if (navigator.vibrate) navigator.vibrate(50);
    },
    [isEliminated, userId]
  );

  // Win detection
  useEffect(() => {
    if (!simState || onWinCalledRef.current) return;
    if (!["playing", "final10", "final3", "final2", "winner"].includes(simState.phase)) return;
    if (dbAliveCount > 1) return;
    if (simState.phase !== "winner") {
      setSimState((s) => (s ? { ...s, phase: "winner" } : s));
    }
    if (!simState.realPlayerEliminated && simState.gameStartMs != null) {
      onWinCalledRef.current = true;
      onWin(netPool);
      const supabase = createClient();
      if (supabase && liveSession) markSessionCompleted(supabase, liveSession.id);
    }
  }, [simState, dbAliveCount, netPool, onWin, liveSession]);

  // Elimination callback
  useEffect(() => {
    if (!simState?.realPlayerEliminated || simState.realPlayerRank == null) return;
    onEliminated(simState.realPlayerRank, sessionTotalPlayers);
  }, [simState?.realPlayerEliminated, simState?.realPlayerRank, sessionTotalPlayers, onEliminated]);

  // Pointer handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      if (!isGameActive || isEliminated) return;
      activePointersRef.current.add(e.pointerId);
      setActiveTouchCount(activePointersRef.current.size);
      setIsHolding(true);
      setReleaseGraceDeadline(null);
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
      const now = Date.now();
      setHoldStartMs(now);
      setSimState((s) => (s ? setRealPlayerHolding(s, now) : s));
      if (navigator.vibrate) navigator.vibrate(10);
    },
    [isGameActive, isEliminated]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      activePointersRef.current.delete(e.pointerId);
      setActiveTouchCount(activePointersRef.current.size);
      if (isEliminated || activePointersRef.current.size > 0) return;
      setIsHolding(false);
      const deadline = Date.now() + RELEASE_GRACE_MS;
      setReleaseGraceDeadline(deadline);
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
      releaseTimeoutRef.current = setTimeout(() => eliminateMe("lift"), RELEASE_GRACE_MS);
    },
    [isEliminated, eliminateMe]
  );

  const handlePointerLeave = useCallback(() => {
    if (!isHolding || isEliminated) return;
    setSimState((s) => {
      if (!s) return s;
      const next = addRealPlayerWarning(s);
      const p = next.players.find((x) => x.isReal);
      if (p && p.warnings >= MAX_WARNINGS) return eliminateRealPlayer(next, "lift", Date.now());
      return next;
    });
  }, [isHolding, isEliminated]);

  // Global pointer up
  useEffect(() => {
    const up = (e: PointerEvent) => {
      activePointersRef.current.delete(e.pointerId);
      setActiveTouchCount(activePointersRef.current.size);
      setIsHolding(false);
      if (activePointersRef.current.size > 0 || isEliminated) return;
      setReleaseGraceDeadline(Date.now() + RELEASE_GRACE_MS);
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
      releaseTimeoutRef.current = setTimeout(() => eliminateMe("lift"), RELEASE_GRACE_MS);
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [isEliminated, eliminateMe]);

  // Space key for split challenge
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === "Space") setSplitSpacePressed(true); };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setSplitSpacePressed(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // Visibility → eliminate
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden" && isHolding && !isEliminated)
        eliminateMe("visibility");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isHolding, isEliminated, eliminateMe]);

  // Challenge helpers
  const randomChallengeDelayMs = useCallback(
    () => CHALLENGE_MIN_MS + Math.random() * (CHALLENGE_MAX_MS - CHALLENGE_MIN_MS),
    []
  );

  const randomChallengeType = useCallback((): ChallengeType => {
    const all: ChallengeType[] = ["shrink", "split", "shape_shift", "rapid_tap", "squeeze", "maze"];
    const filtered = all.filter((x) => x !== lastChallengeTypeRef.current);
    return filtered[Math.floor(Math.random() * filtered.length)];
  }, []);

  const createChallenge = useCallback(
    (nowMs: number): ChallengeState => {
      const type = randomChallengeType();
      lastChallengeTypeRef.current = type;
      const durationSec =
        CHALLENGE_MIN_SEC + Math.floor(Math.random() * (CHALLENGE_MAX_SEC - CHALLENGE_MIN_SEC + 1));
      const labels: Record<ChallengeType, string> = {
        shrink: "SHRINK",
        split: "SPLIT",
        shape_shift: "SHAPE SHIFT",
        rapid_tap: "RAPID TAP",
        squeeze: "SQUEEZE",
        maze: "MAZE",
      };
      const base: ChallengeState = {
        type,
        startedAtMs: nowMs,
        endsAtMs: nowMs + durationSec * 1000,
        label: labels[type],
      };
      if (["shrink", "maze", "rapid_tap"].includes(type)) {
        base.position = { x: 15 + Math.random() * 70, y: 25 + Math.random() * 55 };
      }
      if (type === "shrink") base.sizeScale = 0.5 - difficulty * 0.15;
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
      if (type === "squeeze") base.sizeScale = 1;
      return base;
    },
    [difficulty, randomChallengeType]
  );

  // Schedule next challenge
  useEffect(() => {
    if (!isGameActive || isEliminated || nextChallengeAtMs != null || challenge != null) return;
    setNextChallengeAtMs(Date.now() + randomChallengeDelayMs());
  }, [isGameActive, isEliminated, challenge, nextChallengeAtMs, randomChallengeDelayMs]);

  // Fire challenge
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

  // Validate + end challenge
  useEffect(() => {
    if (!challenge) return;
    const t = setInterval(() => {
      const now = Date.now();
      if (challenge.type === "split") {
        const ok = activeTouchCount >= 2 || (activeTouchCount >= 1 && splitSpacePressed);
        if (!ok) {
          if (!splitFailTimeoutRef.current)
            splitFailTimeoutRef.current = setTimeout(() => eliminateMe("challenge"), RELEASE_GRACE_MS);
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
        deadlineMs: Date.now() + Math.max(700, 1500 - Math.round(difficulty * 500)),
        hitsLeft,
      },
    });
  }, [challenge, difficulty, randomChallengeDelayMs]);

  const handleJoin = useCallback(async () => {
    if (joined || !liveSession || liveSession.status !== "upcoming") return;
    setJoinError(null);
    const ok = await onJoinRequest(liveSession.entry_fee);
    if (!ok) return;
    const supabase = createClient();
    if (supabase) {
      const { error } = await joinSession(supabase, liveSession.id, userId, username);
      if (error) {
        setJoinError(error);
        return;
      }
    }
    setJoined(true);

    if (typeof window !== "undefined" && "Notification" in window) {
      const saved = localStorage.getItem(NOTIFICATION_PERMISSION_KEY);
      if (saved !== "granted") {
        const wants = window.confirm("Get notified when the game starts?");
        if (wants) {
          const permission = await Notification.requestPermission();
          localStorage.setItem(NOTIFICATION_PERMISSION_KEY, permission);
        } else {
          localStorage.setItem(NOTIFICATION_PERMISSION_KEY, "denied");
        }
      }
    }
  }, [joined, liveSession, onJoinRequest, userId, username]);

  // 5-minute pre-start browser notification for joined players.
  useEffect(() => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
      notificationTimeoutRef.current = null;
    }
    if (!joined || !liveSession || liveSession.status !== "upcoming") return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const saved = localStorage.getItem(NOTIFICATION_PERMISSION_KEY);
    if (saved !== "granted" || Notification.permission !== "granted") return;

    const triggerAtMs = new Date(liveSession.scheduled_start_at).getTime() - 5 * 60 * 1000;
    const delayMs = triggerAtMs - Date.now();
    if (delayMs <= 0) return;

    notificationTimeoutRef.current = setTimeout(() => {
      new Notification("Last Touch starts in 5 minutes!", {
        body: `Prize pool: $${liveSession.prize_pool.toFixed(2)}. Don't miss it!`,
      });
    }, delayMs);

    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
        notificationTimeoutRef.current = null;
      }
    };
  }, [joined, liveSession]);

  // ─── Rendering ────────────────────────────────────────────────────────────

  // No session
  if (!liveSession) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <h1 className="bg-gradient-to-r from-[#FF5E00] via-[#FF7A2E] to-[#FF5E00] bg-clip-text text-4xl font-black text-transparent">
          LAST TOUCH
        </h1>
        <p className="text-body-gray">No upcoming sessions. Check back soon!</p>
      </div>
    );
  }

  // 5, 4, 3, 2, 1 countdown
  if (startCountdownNum !== null) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        {startCountdownNum > 0 ? (
          <span className="animate-pulse font-mono text-9xl font-black text-white">
            {startCountdownNum}
          </span>
        ) : (
          <span className="bg-gradient-to-r from-teal to-purple-500 bg-clip-text text-5xl font-black text-transparent md:text-7xl">
            HOLD NOW!
          </span>
        )}
      </div>
    );
  }

  // Winner screen
  if (simState?.phase === "winner") {
    const winner = remaining[0];
    const isRealWinner = winner?.isReal ?? false;
    const holdTime =
      simState.gameStartMs != null && winner
        ? (winner.eliminatedAtMs ?? Date.now()) - simState.gameStartMs
        : 0;
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <h2 className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-5xl font-black text-transparent">
          WINNER!
        </h2>
        <p className="text-2xl font-bold text-white">{winner?.username}</p>
        <p className="text-xl text-teal">Won ${netPool.toFixed(2)}!</p>
        <p className="text-body-gray">Hold time: {formatHoldTime(holdTime)}</p>
        {isRealWinner && (
          <p className="text-lg text-teal">🎉 Congratulations! Funds added to your wallet.</p>
        )}
        {simState.realPlayerEliminated && (
          <p className="text-body-gray">
            You placed #{simState.realPlayerRank} of {totalPlayers}. Better luck next time!
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

  // Game active (playing / final10 / final3 / final2)
  if (simState != null) {
    const baseHoldSizePx = 240;
    const challengeScale =
      challenge?.type === "shrink"
        ? challenge.sizeScale ?? 0.5
        : challenge?.type === "squeeze"
          ? Math.max(
              0.25,
              1 -
                ((Date.now() - challenge.startedAtMs) /
                  Math.max(1, challenge.endsAtMs - challenge.startedAtMs)) *
                  0.75
            )
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
        <div className="flex items-center justify-between">
          <span className="font-bold text-white">LAST TOUCH</span>
          <span className="font-mono text-white tabular-nums">{formatHoldTime(gameElapsedMs)}</span>
          <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> LIVE
          </span>
        </div>

        <div className="rounded-xl border border-teal/30 bg-card/80 p-4 text-center">
          <p className="text-xs text-body-gray">PRIZE POOL</p>
          <p className="text-3xl font-bold text-white tabular-nums">
            $<AnimatedNumber value={netPool} />
          </p>
          <p className="mt-1 text-xs text-body-gray">
            Gross pool: ${liveSession.prize_pool.toFixed(2)} · Platform fee: 5%
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-2">
          <span className="text-body-gray">Players Remaining</span>
          <span className="font-mono font-bold text-white tabular-nums">
            {playersRemaining} / {sessionTotalPlayers}
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
            style={{
              width: `${Math.max(0, Math.min(100, (playersRemaining / Math.max(sessionTotalPlayers, 1)) * 100))}%`,
            }}
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
                    transform:
                      challenge?.type === "maze"
                        ? `translate(-50%, -50%) translate(${Math.sin(Date.now() / 400) * 48}px, ${Math.cos(Date.now() / 460) * 24}px)`
                        : "translate(-50%, -50%)",
                    touchAction: "none",
                    clipPath: zoneClipPath,
                    borderRadius: challenge?.type === "shape_shift" ? "18%" : "999px",
                  }}
                >
                  {isHolding ? (
                    <>
                      <p className="font-mono text-2xl font-bold text-white tabular-nums">
                        {formatHoldTime(myHoldMs)}
                      </p>
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
              {simState.realPlayerEliminatedAtMs != null && simState.realPlayerHoldStartMs != null && (
                <p className="mt-1 text-sm text-body-gray">
                  Hold time:{" "}
                  {formatHoldTime(simState.realPlayerEliminatedAtMs - simState.realPlayerHoldStartMs)}
                </p>
              )}
              <p className="mt-1 text-sm text-white">Rank #{simState.realPlayerRank}</p>
              <p className="mt-1 text-sm text-body-gray">Players remaining: {playersRemaining}</p>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-black/40 p-2">
          <p className="mb-1 text-xs text-body-gray">Eliminations</p>
          <div className="flex max-h-24 flex-col gap-0.5 overflow-y-auto">
            {simState.feed
              .filter((f) => f.type === "eliminate" || f.type === "late_join")
              .slice(0, 8)
              .map((f) => (
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
            <p>
              Your Rank: #{Math.max(1, playersRemaining)} / {sessionTotalPlayers}
            </p>
            <p>Warnings: {simState.realPlayerWarnings} / {MAX_WARNINGS}</p>
            {releaseGraceDeadline && (
              <p className="text-amber-300">Reconnect hold within 1s or you are out</p>
            )}
            {challenge?.type === "split" && (
              <p className="text-amber-300">
                SPLIT: hold two contacts (two fingers, or one finger + SPACE)
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Lobby ────────────────────────────────────────────────────────────────
  const mins = Math.floor(countdownSec / 60);
  const secs = countdownSec % 60;

  // Format next scheduled time for "game in progress" message
  const startDate = new Date(liveSession.scheduled_start_at);
  const timeLabel = startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" });

  return (
    <div className="relative flex flex-col gap-6 pb-8">
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-[#FF5E00] via-[#FF7A2E] to-[#FF5E00] bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl md:text-6xl">
          LAST TOUCH
        </h1>
        <p className="mt-2 text-body-gray">Hold your ground. Win it all.</p>
        <div className="mt-4 inline-block animate-pulse text-4xl">👆</div>
      </div>

      {/* Prize pool */}
      <div className="mx-auto w-full max-w-md rounded-2xl border-2 border-steel-blue bg-card/90 p-6 shadow-[0_0_40px_rgba(42,58,92,0.4)]">
        <p className="text-center text-sm text-body-gray">Current Prize Pool</p>
        <p className="mt-2 text-center text-4xl font-bold text-white tabular-nums">
          $<AnimatedNumber value={liveSession.prize_pool} />
        </p>
        <p className="mt-1 text-center text-sm text-body-gray">
          {dbPlayerCount} {dbPlayerCount === 1 ? "Player" : "Players"} Joined
        </p>
      </div>

      <>
          {/* Entry fee info */}
          <div className="card-border mx-auto w-full max-w-md rounded-xl bg-card/80 p-5">
            <p className="text-sm text-body-gray">Entry Fee</p>
            <p className="mt-1 text-2xl font-bold text-emerald-400">
              ${liveSession.entry_fee.toFixed(2)}
            </p>
            <ul className="mt-4 space-y-1 text-xs text-body-gray">
              <li>Flat entry fee — no tiers in this format</li>
              <li>Last player holding wins the entire prize pool</li>
              <li>5% platform fee deducted from winnings</li>
            </ul>
          </div>

          {/* Countdown */}
          <div className="text-center">
            {liveSession.status === "upcoming" ? (
              <>
                <p className="text-body-gray">Next Game Starts In</p>
                <p className="mt-2 font-mono text-4xl font-bold text-white tabular-nums">
                  {mins}:{secs.toString().padStart(2, "0")}
                </p>
                <p className="mt-1 text-xs text-body-gray">{timeLabel}</p>
              </>
            ) : (
              <p className="text-lg font-semibold text-[#FF5E00]">Game in progress…</p>
            )}
          </div>
          {cancelMessage && (
            <p className="text-center text-sm text-amber-300">{cancelMessage}</p>
          )}

          {/* Join / Already joined */}
          {joinError && (
            <div className="mx-auto w-full max-w-md rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {joinError}
            </div>
          )}

          <div className="mx-auto w-full max-w-md">
            {joined ? (
              <div className="rounded-xl border border-teal/40 bg-teal/10 py-4 text-center">
                <p className="font-semibold text-teal">✓ You&apos;re in!</p>
                <p className="mt-1 text-sm text-body-gray">
                  {liveSession.status === "upcoming"
                    ? `Next game starts at ${timeLabel}`
                    : "Game is in progress…"}
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleJoin}
                disabled={liveSession.status !== "upcoming"}
                className="w-full rounded-xl bg-teal py-4 text-lg font-bold text-charcoal shadow-[0_0_30px_rgba(255,94,0,0.4)] transition hover:opacity-95 disabled:opacity-50"
              >
                JOIN NOW — ${liveSession.entry_fee.toFixed(2)}
              </button>
            )}
            {!joined && (
              <p className="mt-2 text-center text-sm text-body-gray">
                {dbPlayerCount} {dbPlayerCount === 1 ? "player" : "players"} already joined
              </p>
            )}
          </div>

          {/* How it works */}
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
                <p>1. Join by paying the entry fee before the session starts.</p>
                <p>2. When the game starts, press and HOLD the touch zone.</p>
                <p>3. Don&apos;t lift your finger — if you do, you&apos;re out!</p>
                <p>4. Last person holding wins the ENTIRE prize pool.</p>
                <p className="mt-2">
                  Sessions run 3× daily at 02:00, 14:00, and 20:00 UTC. All players see the same
                  countdown — it&apos;s synchronized to the server.
                </p>
              </div>
            )}
          </div>
      </>
    </div>
  );
}
