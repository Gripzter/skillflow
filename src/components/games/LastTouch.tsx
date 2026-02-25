"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  type LastTouchFeedEntry,
} from "@/lib/games/last-touch-simulation";

const TICK_INTERVAL_MS = 2000;
const COUNTDOWN_GAME_START_SEC = 5;
const CHALLENGE_DURATION_SEC = 5;
const CHALLENGE_MIN_INTERVAL_MS = 30_000;
const CHALLENGE_MAX_INTERVAL_MS = 90_000;
const MAX_WARNINGS = 3;
const STATIONARY_ANTICHEAT_MS = 60_000;

interface LastTouchProps {
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
  username,
  entryFee,
  onJoinRequest,
  onWin,
  onEliminated,
}: LastTouchProps) {
  const [state, setState] = useState<LastTouchState>(() =>
    createInitialState({
      initialBotsCount: 300 + Math.floor(Math.random() * 501),
      nextGameInSec: 14 * 60 + 32,
    })
  );
  const [joined, setJoined] = useState(false);
  const [countdownNum, setCountdownNum] = useState<number | null>(null);
  const [holdStartMs, setHoldStartMs] = useState<number | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [challengeActive, setChallengeActive] = useState(false);
  const [challengeSecLeft, setChallengeSecLeft] = useState(0);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const touchZoneRef = useRef<HTMLDivElement>(null);
  const lastTouchPosRef = useRef<{ x: number; y: number } | null>(null);
  const stationarySinceRef = useRef<number | null>(null);
  const challengeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const remaining = useMemo(
    () => state.players.filter((p) => p.eliminatedAtMs == null),
    [state.players]
  );
  const totalPlayers = state.players.length;
  const realPlayer = state.players.find((p) => p.isReal);
  const isEliminated = state.realPlayerEliminated;

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

  // Simulated lobby joins (fake feed)
  useEffect(() => {
    if (state.phase !== "lobby" || !joined) return;
    const addJoin = () => {
      setState((s) => {
        const fee = getEntryFeeAtMinute(0) ?? 1;
        const names = ["xKiller99", "ProGamer_Mike", "SnipeElite420", "NoScope360", "ChessMaster"];
        const name = names[Math.floor(Math.random() * names.length)];
        const entry = {
          id: "feed-" + Date.now(),
          type: "join" as const,
          username: name,
          message: `${name} just joined! ($${fee.toFixed(2)})`,
          atMs: Date.now(),
          amount: fee,
        };
        return {
          ...s,
          feed: [entry, ...s.feed].slice(0, 30),
          prizePool: s.prizePool + fee,
        };
      });
    };
    const id = setInterval(addJoin, 1500 + Math.random() * 1500);
    return () => clearInterval(id);
  }, [state.phase, joined]);

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
    setState((s) => ({ ...s, nextGameCountdownSec: 14 * 60 + 32 }));
  }, [state.phase, joined, state.nextGameCountdownSec]);

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
      setIsHolding(true);
      const now = Date.now();
      setHoldStartMs(now);
      setState((s) => setRealPlayerHolding(s, now));
      lastTouchPosRef.current = { x: e.clientX, y: e.clientY };
      stationarySinceRef.current = now;
      if (navigator.vibrate) navigator.vibrate(10);
    },
    [state.phase, isEliminated]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      if (!isHolding || isEliminated) return;
      const target = touchZoneRef.current;
      if (target && !target.contains(e.target as Node)) return; // only eliminate if release inside zone? No - spec says if you lift you're out. So any lift = out.
      setIsHolding(false);
      setHoldStartMs(null);
      setState((s) => eliminateRealPlayer(s, "lift", Date.now()));
      if (navigator.vibrate) navigator.vibrate(50);
    },
    [isHolding, isEliminated]
  );

  const handlePointerLeave = useCallback(() => {
    if (!isHolding || isEliminated) return;
    // Mouse left zone while holding = warning
    setState((s) => {
      const next = addRealPlayerWarning(s);
      const p = next.players.find((x) => x.isReal);
      if (p && p.warnings >= MAX_WARNINGS)
        return eliminateRealPlayer(next, "lift", Date.now());
      return next;
    });
  }, [isHolding, isEliminated]);

  // Global pointer up (catch release outside element)
  useEffect(() => {
    const up = (e: PointerEvent) => {
      if (!isHolding || isEliminated) return;
      const target = touchZoneRef.current;
      if (target?.contains(e.target as Node)) return;
      setIsHolding(false);
      setHoldStartMs(null);
      setState((s) => eliminateRealPlayer(s, "lift", Date.now()));
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [isHolding, isEliminated]);

  // Visibility: tab hidden = eliminated
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && isHolding && !isEliminated) {
        setState((s) => eliminateRealPlayer(s, "visibility", Date.now()));
        setIsHolding(false);
        setHoldStartMs(null);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isHolding, isEliminated]);

  // Anti-cheat: random challenge every 30–90s
  useEffect(() => {
    if (state.phase !== "playing" && state.phase !== "final10" && state.phase !== "final2" && state.phase !== "final3") return;
    if (challengeActive || isEliminated) return;
    const schedule = () => {
      const delay = CHALLENGE_MIN_INTERVAL_MS + Math.random() * (CHALLENGE_MAX_INTERVAL_MS - CHALLENGE_MIN_INTERVAL_MS);
      challengeTimerRef.current = setTimeout(() => {
        setChallengeActive(true);
        setChallengeSecLeft(CHALLENGE_DURATION_SEC);
      }, delay);
    };
    schedule();
    return () => {
      if (challengeTimerRef.current) clearTimeout(challengeTimerRef.current);
    };
  }, [state.phase, challengeActive, isEliminated]);

  useEffect(() => {
    if (!challengeActive) return;
    const t = setInterval(() => {
      setChallengeSecLeft((n) => {
        if (n <= 1) {
          setChallengeActive(false);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [challengeActive]);

  const handleChallengeTap = useCallback(() => {
    if (!challengeActive) return;
    setChallengeActive(false);
    setChallengeSecLeft(0);
  }, []);

  // Challenge timeout = warning
  useEffect(() => {
    if (!challengeActive || challengeSecLeft > 0) return;
    setState((s) => {
      const next = addRealPlayerWarning(s);
      const p = next.players.find((x) => x.isReal);
      if (p && p.warnings >= MAX_WARNINGS)
        return eliminateRealPlayer(next, "challenge", Date.now());
      return next;
    });
  }, [challengeActive, challengeSecLeft]);

  const handleJoin = useCallback(async () => {
    const ok = await onJoinRequest(entryFee);
    if (!ok) return;
    setJoined(true);
    setState((s) => ({
      ...s,
      players: addRealPlayer(s.players, username, entryFee),
      prizePool: s.prizePool + entryFee,
      feed: [
        {
          id: "join-" + Date.now(),
          type: "join",
          username,
          message: `${username} just joined! ($${entryFee.toFixed(2)})`,
          atMs: Date.now(),
          amount: entryFee,
        },
        ...s.feed,
      ].slice(0, 50),
    }));
  }, [username, entryFee, onJoinRequest]);

  const nextTier = state.phase === "lobby" ? getNextTierMinutes(0) : null;
  const currentFee = state.phase === "lobby" ? (getEntryFeeAtMinute(0) ?? 1) : state.lateEntryFee;

  // ----- Lobby -----
  if (state.phase === "lobby") {
    const mins = Math.floor(state.nextGameCountdownSec / 60);
    const secs = state.nextGameCountdownSec % 60;
    return (
      <div className="flex flex-col gap-6 pb-8">
        <div className="text-center">
          <h1 className="bg-gradient-to-r from-teal via-[#00E5C7] to-purple-500 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl md:text-6xl">
            LAST TOUCH
          </h1>
          <p className="mt-2 text-body-gray">Hold your ground. Win it all.</p>
          <div className="mt-4 inline-block animate-pulse text-4xl">👆</div>
        </div>

        <div className="mx-auto w-full max-w-md rounded-2xl border-2 border-teal/50 bg-card/90 p-6 shadow-[0_0_40px_rgba(0,229,199,0.15)]">
          <p className="text-center text-sm text-body-gray">Current Prize Pool</p>
          <p className="mt-2 text-center text-4xl font-bold text-white tabular-nums">
            $<AnimatedNumber value={state.prizePool} />
          </p>
          <p className="mt-1 text-center text-sm text-body-gray">
            {state.players.length} Players Joined
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
        </div>

        {!joined && (
          <div className="mx-auto w-full max-w-md">
            <button
              type="button"
              onClick={handleJoin}
              className="w-full rounded-xl bg-teal py-4 text-lg font-bold text-charcoal shadow-[0_0_30px_rgba(0,229,199,0.4)] transition hover:opacity-95"
            >
              JOIN NOW — ${entryFee.toFixed(2)}
            </button>
            <p className="mt-2 text-center text-sm text-body-gray">
              {state.players.length} players already joined
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
            {state.feed.slice(0, 12).map((f) => (
              <div key={f.id} className="text-xs text-white/90">
                {f.type === "join" && "🎮"} {f.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ----- Countdown 5,4,3,2,1 -----
  if (state.phase === "countdown" && countdownNum != null) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
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
  const gameElapsedMs = state.gameStartMs != null ? Date.now() - state.gameStartMs : 0;
  const myHoldMs = holdStartMs != null ? Date.now() - holdStartMs : 0;

  return (
    <div className="flex flex-col gap-4 pb-6">
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
          $<AnimatedNumber value={state.prizePool} />
        </p>
        <p className="mt-1 text-xs text-body-gray">Late entry: ${(getEntryFeeAtMinute(gameElapsedMs / 60000) ?? 0).toFixed(2)}</p>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-2">
        <span className="text-body-gray">Players Remaining</span>
        <span className="font-mono font-bold text-white tabular-nums">
          {remaining.length} / {totalPlayers}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-teal/80 transition-all duration-500"
          style={{ width: `${(remaining.length / totalPlayers) * 100}%` }}
        />
      </div>

      {challengeActive && (
        <div
          role="button"
          tabIndex={0}
          onClick={handleChallengeTap}
          onKeyDown={(e) => e.key === "Enter" && handleChallengeTap()}
          className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-4 border-amber-400 bg-amber-400/20 p-8 text-center"
        >
          <p className="font-bold text-amber-400">TAP TARGET</p>
          <p className="font-mono text-2xl text-white">{challengeSecLeft}s</p>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center">
        {!isEliminated ? (
          <div
            ref={touchZoneRef}
            role="button"
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onContextMenu={(e) => e.preventDefault()}
            className={`flex min-h-[200px] min-w-[200px] max-w-[min(90vw,320px)] cursor-pointer select-none flex-col items-center justify-center rounded-full border-4 transition-all ${
              isHolding
                ? "border-teal bg-gradient-to-br from-teal/60 to-purple-500/60 shadow-[0_0_60px_rgba(0,229,199,0.4)]"
                : "border-white/20 bg-white/5 hover:border-teal/50"
            }`}
            style={{ touchAction: "none" }}
          >
            {isHolding ? (
              <>
                <p className="font-mono text-2xl font-bold text-white tabular-nums">
                  {formatHoldTime(myHoldMs)}
                </p>
                <p className="mt-1 text-xs text-teal">HOLDING</p>
              </>
            ) : (
              <p className="text-center text-sm text-body-gray">PLACE YOUR FINGER HERE</p>
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
          <p>Your Rank: #{remaining.filter((p) => p.entryTimeMs <= realPlayer.entryTimeMs).length} / {totalPlayers}</p>
          <p>Warnings: {realPlayer.warnings} / {MAX_WARNINGS}</p>
        </div>
      )}
    </div>
  );
}
