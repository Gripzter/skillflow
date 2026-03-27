"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { GameMultiplayerProps } from "./Chess";
import type { MatchUiState } from "@/components/game/matchUi";
import type { BotDifficulty } from "@/lib/games/bot-engine";
import {
  calcWpm,
  calcAccuracy,
  countErrors,
  adjustedTime,
  getBotProfile,
  simulateBotTyping,
  FINISH_TIMEOUT_MS,
} from "@/lib/games/typing-race-logic";
import {
  PASSAGES,
  getRandomPassageIndex,
} from "@/lib/games/typing-race-passages";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TypingRaceProps extends GameMultiplayerProps {
  player1: { username: string; rating: number };
  player2: { username: string; rating: number };
  onGameEnd: (winner: "player1" | "player2") => void;
  onGameDraw: () => void;
  isPlayer2Bot?: boolean;
  botDifficulty?: BotDifficulty;
  isPractice?: boolean;
}

type Phase =
  | "waiting"      // selecting passage / waiting for P2's passage event
  | "countdown"    // 3-2-1 countdown
  | "racing"       // actively typing
  | "finished"     // local player done, waiting for opponent
  | "match_over";  // both done

// ─── Constants ────────────────────────────────────────────────────────────────

const COUNTDOWN_FROM = 3;
// Throttle rate for sending progress events (ms)
const PROGRESS_THROTTLE_MS = 1000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Render the passage with per-character highlighting */
function PassageDisplay({
  passage,
  typed,
  opponentPos,
  opponentName,
  revealAll,
}: {
  passage: string;
  typed: string;
  opponentPos: number;
  opponentName: string;
  revealAll: boolean;
}) {
  return (
    <div
      className="select-none font-mono text-base leading-relaxed tracking-wide"
      aria-label="Typing passage"
    >
      {passage.split("").map((char, i) => {
        const isTyped = i < typed.length;
        const isCorrect = isTyped && typed[i] === char;
        const isWrong = isTyped && typed[i] !== char;
        const isCursor = i === typed.length;
        const isOpponentCursor = i === opponentPos && opponentPos !== typed.length;

        let charClass =
          "relative transition-colors duration-75 ";

        if (!revealAll) {
          if (isCorrect) charClass += "text-teal";
          else if (isWrong) charClass += "text-red-400 bg-red-400/15 rounded-[2px]";
          else if (isCursor) charClass += "text-white";
          else charClass += "text-white/40";
        } else {
          charClass += "text-white/30";
        }

        return (
          <span key={i} className={charClass}>
            {isCursor && !revealAll && (
              <span
                className="absolute -left-px top-0 h-full w-0.5 animate-pulse bg-teal rounded-full"
                aria-hidden
              />
            )}
            {isOpponentCursor && (
              <span
                className="absolute -left-px top-0 h-full w-0.5 bg-purple-400 rounded-full opacity-80"
                title={opponentName}
                aria-hidden
              />
            )}
            {char === " " && isWrong ? "·" : char}
          </span>
        );
      })}
    </div>
  );
}

/** Progress bar for one player */
function RaceBar({
  label,
  progress,
  wpm,
  accuracy,
  finished,
  isMe,
}: {
  label: string;
  progress: number; // 0–1
  wpm: number;
  accuracy: number;
  finished: boolean;
  isMe: boolean;
}) {
  const color = isMe ? "#00BCD4" : "#A855F7";
  const pct = Math.min(1, progress) * 100;
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-20 shrink-0 truncate text-right text-[11px] font-medium"
        style={{ color }}
      >
        {label}
      </span>
      <div className="relative flex-1 h-4 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-150"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
        {/* Finish line ghost at 100% */}
        {finished && (
          <div
            className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold"
            style={{ color }}
          >
            ✓
          </div>
        )}
      </div>
      <div className="flex w-24 shrink-0 items-center gap-1.5 text-[11px] tabular-nums text-body-gray">
        <span>{wpm > 0 ? `${wpm} WPM` : "—"}</span>
        {accuracy < 100 && accuracy > 0 && (
          <span className={accuracy < 90 ? "text-red-400" : "text-body-gray"}>
            {accuracy}%
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TypingRace({
  player1,
  player2,
  onGameEnd,
  onGameDraw,
  isPlayer2Bot = true,
  botDifficulty = "gamer",
  isMultiplayer = false,
  myRole = "player1",
  sendGameEvent,
  incomingEvent,
  onEventProcessed,
  isPractice: isPracticeProp,
  onMatchUi,
}: TypingRaceProps) {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("waiting");
  const [passageIndex, setPassageIndex] = useState<number | null>(null);
  const [countdownN, setCountdownN] = useState(COUNTDOWN_FROM);

  // ── My typing state ─────────────────────────────────────────────────────────
  const [typed, setTyped] = useState("");
  const [myWpm, setMyWpm] = useState(0);
  const [myAccuracy, setMyAccuracy] = useState(100);
  const [myErrors, setMyErrors] = useState(0);
  const [myFinishMs, setMyFinishMs] = useState<number | null>(null);
  const [myAdjustedMs, setMyAdjustedMs] = useState<number | null>(null);

  // ── Opponent state ──────────────────────────────────────────────────────────
  const [opponentPos, setOpponentPos] = useState(0);
  const [opponentWpm, setOpponentWpm] = useState(0);
  const [opponentAccuracy, setOpponentAccuracy] = useState(100);
  const [opponentFinishedMs, setOpponentFinishedMs] = useState<number | null>(null);
  const [opponentAdjustedMs, setOpponentAdjustedMs] = useState<number | null>(null);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const raceStartRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastProgressSentRef = useRef<number>(0);
  const botCleanupRef = useRef<(() => void) | null>(null);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventRef = useRef<Record<string, unknown> | null>(null);
  const gameStartRef = useRef(Date.now());
  const settledRef = useRef(false);

  const passage = passageIndex !== null ? PASSAGES[passageIndex] : null;
  const isPractice = isPracticeProp ?? !isMultiplayer;

  // ── Settle result (called once) ─────────────────────────────────────────────
  const settle = useCallback(
    (myAdj: number | null, opAdj: number | null) => {
      if (settledRef.current) return;
      settledRef.current = true;

      if (myAdj === null && opAdj === null) {
        onGameDraw();
        return;
      }
      if (myAdj === null) {
        onGameEnd(myRole === "player1" ? "player2" : "player1");
        return;
      }
      if (opAdj === null) {
        onGameEnd(myRole === "player1" ? "player1" : "player2");
        return;
      }
      if (myAdj < opAdj) onGameEnd(myRole === "player1" ? "player1" : "player2");
      else if (opAdj < myAdj) onGameEnd(myRole === "player1" ? "player2" : "player1");
      else onGameDraw();
    },
    [myRole, onGameEnd, onGameDraw]
  );

  // ── Initialise passage ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "waiting") return;

    if (isMultiplayer && myRole === "player2") {
      // Wait for P1's passage event — handled in incomingEvent effect below
      return;
    }

    // P1 (or solo) picks a passage
    const idx = getRandomPassageIndex();
    setPassageIndex(idx);

    if (isMultiplayer && myRole === "player1" && sendGameEvent) {
      sendGameEvent({ type: "race_passage", index: idx }).catch(() => {});
    }

    setCountdownN(COUNTDOWN_FROM);
    setPhase("countdown");
  }, [phase, isMultiplayer, myRole, sendGameEvent]);

  // ── Incoming multiplayer events ─────────────────────────────────────────────
  useEffect(() => {
    if (!incomingEvent || !onEventProcessed) return;
    if (incomingEvent === lastEventRef.current) return;
    lastEventRef.current = incomingEvent;

    const type = incomingEvent.type as string | undefined;

    if (type === "race_passage") {
      const idx = incomingEvent.index as number;
      if (typeof idx === "number") {
        setPassageIndex(idx);
        setCountdownN(COUNTDOWN_FROM);
        setPhase("countdown");
      }
      onEventProcessed();
      return;
    }

    if (type === "race_progress") {
      const chars = incomingEvent.chars as number;
      const wpm = incomingEvent.wpm as number;
      const accuracy = incomingEvent.accuracy as number;
      if (typeof chars === "number") setOpponentPos(chars);
      if (typeof wpm === "number") setOpponentWpm(wpm);
      if (typeof accuracy === "number") setOpponentAccuracy(accuracy);
      onEventProcessed();
      return;
    }

    if (type === "race_finish") {
      const adjMs = incomingEvent.adjustedMs as number;
      const wpm = incomingEvent.wpm as number;
      const accuracy = incomingEvent.accuracy as number;
      if (typeof adjMs === "number") {
        setOpponentAdjustedMs(adjMs);
        setOpponentFinishedMs(adjMs);
      }
      if (typeof wpm === "number") setOpponentWpm(wpm);
      if (typeof accuracy === "number") setOpponentAccuracy(accuracy);
      onEventProcessed();
      return;
    }

    onEventProcessed();
  }, [incomingEvent, onEventProcessed]);

  // ── Countdown ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdownN > 0) {
      const t = setTimeout(() => setCountdownN((n) => n - 1), 1000);
      return () => clearTimeout(t);
    }
    // GO — start race
    const t = setTimeout(() => {
      raceStartRef.current = performance.now();
      settledRef.current = false;
      botCleanupRef.current = null; // allow bot to (re-)start
      setTyped("");
      setMyWpm(0);
      setMyAccuracy(100);
      setMyErrors(0);
      setMyFinishMs(null);
      setMyAdjustedMs(null);
      setOpponentPos(0);
      setOpponentWpm(0);
      setOpponentAccuracy(100);
      setOpponentFinishedMs(null);
      setOpponentAdjustedMs(null);
      setPhase("racing");
    }, 600);
    return () => clearTimeout(t);
  }, [phase, countdownN]);

  // ── Focus input when racing starts ──────────────────────────────────────────
  useEffect(() => {
    if (phase === "racing") {
      inputRef.current?.focus();
    }
  }, [phase]);

  // ── Bot simulation ──────────────────────────────────────────────────────────
  // NOTE: No cleanup return here — the bot must keep running even after the
  // player finishes (phase → "finished"). Cancelling timers here would prevent
  // opponentAdjustedMs from ever being set, causing a permanent freeze.
  // Timers are only cancelled on component unmount (see cleanup effect below).
  useEffect(() => {
    if (phase !== "racing" || !passage) return;
    if (isMultiplayer || !isPlayer2Bot) return;
    if (botCleanupRef.current) return; // already running — don't restart

    const profile = getBotProfile(botDifficulty);

    botCleanupRef.current = simulateBotTyping(
      passage,
      profile,
      (chars, _errors, wpm) => {
        setOpponentPos(chars);
        setOpponentWpm(wpm);
        const botAcc = Math.round(((chars - _errors) / chars) * 100);
        setOpponentAccuracy(botAcc);
      },
      (rawMs, errors, accuracy) => {
        const adjMs = adjustedTime(rawMs, errors, accuracy);
        setOpponentAccuracy(accuracy);
        setOpponentWpm(calcWpm(passage.length, rawMs));
        setOpponentFinishedMs(adjMs);
        setOpponentAdjustedMs(adjMs);
        setOpponentPos(passage.length);
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, passage]);

  // ── Finish timeout (2 min hard cap) ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== "racing") return;
    finishTimeoutRef.current = setTimeout(() => {
      setPhase("match_over");
    }, FINISH_TIMEOUT_MS);
    return () => {
      if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
    };
  }, [phase]);

  // ── Handle my finish ────────────────────────────────────────────────────────
  const handleMyFinish = useCallback(
    (finalTyped: string, pass: string) => {
      if (myFinishMs !== null) return;
      const rawMs = performance.now() - raceStartRef.current;
      const errors = countErrors(finalTyped, pass);
      const accuracy = calcAccuracy(finalTyped, pass);
      const adjMs = adjustedTime(rawMs, errors, accuracy);
      const wpm = calcWpm(pass.length, rawMs);

      setMyFinishMs(rawMs);
      setMyAdjustedMs(adjMs);
      setMyWpm(wpm);
      setMyAccuracy(accuracy);
      setMyErrors(errors);
      setPhase("finished");

      if (isMultiplayer && sendGameEvent) {
        sendGameEvent({
          type: "race_finish",
          adjustedMs: adjMs,
          wpm,
          accuracy,
        }).catch(() => {});
      }
    },
    [myFinishMs, isMultiplayer, sendGameEvent]
  );

  // ── Resolve winner when both are done ───────────────────────────────────────
  useEffect(() => {
    if (phase !== "finished" && phase !== "racing") return;
    if (myAdjustedMs === null && opponentAdjustedMs === null) return;
    if (phase === "finished" && opponentAdjustedMs !== null) {
      setTimeout(() => {
        setPhase("match_over");
        settle(myAdjustedMs, opponentAdjustedMs);
      }, 1500);
    }
    // If opponent finishes while I'm still racing: mark them done but keep me going
  }, [phase, myAdjustedMs, opponentAdjustedMs, settle]);

  // When match_over fires from timeout, settle with whatever we have
  useEffect(() => {
    if (phase !== "match_over") return;
    settle(myAdjustedMs, opponentAdjustedMs);
  }, [phase, myAdjustedMs, opponentAdjustedMs, settle]);

  // ── Input change handler ─────────────────────────────────────────────────────
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (phase !== "racing" || !passage) return;

      const val = e.target.value;
      // Don't allow typing past the passage
      if (val.length > passage.length) return;

      setTyped(val);

      const elapsed = performance.now() - raceStartRef.current;
      const errors = countErrors(val, passage);
      const accuracy = calcAccuracy(val, passage);
      const wpm = calcWpm(val.length, elapsed);

      setMyErrors(errors);
      setMyAccuracy(accuracy > 0 ? accuracy : 100);
      setMyWpm(val.length > 0 ? wpm : 0);

      // Throttled progress broadcast
      const now = Date.now();
      if (isMultiplayer && sendGameEvent && now - lastProgressSentRef.current > PROGRESS_THROTTLE_MS) {
        lastProgressSentRef.current = now;
        sendGameEvent({
          type: "race_progress",
          chars: val.length,
          wpm,
          accuracy,
        }).catch(() => {});
      }

      // Check finish
      if (val.length === passage.length) {
        handleMyFinish(val, passage);
      }
    },
    [phase, passage, isMultiplayer, sendGameEvent, handleMyFinish]
  );

  // ── WPM live ticker ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "racing") return;
    const interval = setInterval(() => {
      if (!typed.length) return;
      const elapsed = performance.now() - raceStartRef.current;
      setMyWpm(calcWpm(typed.length, elapsed));
    }, 500);
    return () => clearInterval(interval);
  }, [phase, typed]);

  // ── onMatchUi ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!onMatchUi) return;
    let turnText = "Typing Race";
    if (phase === "waiting") turnText = "Loading passage...";
    else if (phase === "countdown") turnText = `Starting in ${countdownN}...`;
    else if (phase === "racing") turnText = `${myWpm} WPM • ${myAccuracy}% accuracy`;
    else if (phase === "finished") turnText = "Finished! Waiting for opponent...";
    else if (phase === "match_over") turnText = "Race over";

    const myProgress = passage ? typed.length / passage.length : 0;
    const opProgress = passage ? opponentPos / passage.length : 0;

    onMatchUi({
      scores: {
        player1: Math.round((myRole === "player1" ? myProgress : opProgress) * 100),
        player2: Math.round((myRole === "player2" ? myProgress : opProgress) * 100),
      },
      scoreLabel: "%",
      currentTurn: "player1",
      turnText,
      systemLogEntries: [
        {
          id: "start",
          text: `⌨️ Typing Race — ${player1.username} vs ${player2.username}`,
          timestamp: gameStartRef.current,
        },
        ...(myFinishMs !== null
          ? [
              {
                id: "finish",
                text: `${myRole === "player1" ? player1.username : player2.username} finished — ${myWpm} WPM, ${myAccuracy}% accuracy`,
                timestamp: gameStartRef.current + (myFinishMs ?? 0),
              },
            ]
          : []),
      ],
    });
  }, [
    onMatchUi,
    phase,
    countdownN,
    myWpm,
    myAccuracy,
    typed,
    passage,
    opponentPos,
    myRole,
    player1.username,
    player2.username,
    myFinishMs,
  ]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      botCleanupRef.current?.();
      if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
    };
  }, []);

  // ── Derived display values ───────────────────────────────────────────────────
  const myProgress = passage ? typed.length / passage.length : 0;
  const opProgress = passage ? Math.min(1, opponentPos / passage.length) : 0;
  const elapsedSec = phase === "racing"
    ? Math.floor((performance.now() - raceStartRef.current) / 1000)
    : myFinishMs !== null
      ? Math.floor(myFinishMs / 1000)
      : 0;
  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const myLabel = myRole === "player1" ? player1.username : player2.username;
  const opLabel = myRole === "player1" ? player2.username : player1.username;

  const opFinishedDisplay = opponentFinishedMs !== null;
  const myFinishedDisplay = myFinishMs !== null;

  // ── Waiting / loading ────────────────────────────────────────────────────────
  if (phase === "waiting") {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal/30 border-t-teal" />
      </div>
    );
  }

  // ── Countdown ────────────────────────────────────────────────────────────────
  if (phase === "countdown") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6">
        {countdownN > 0 ? (
          <span
            key={countdownN}
            className="text-8xl font-black animate-countdown"
            style={{
              color: countdownN === 3 ? "#fff" : countdownN === 2 ? "#FACC15" : "#00BCD4",
            }}
          >
            {countdownN}
          </span>
        ) : (
          <span className="text-5xl font-black text-teal animate-pulse">GO!</span>
        )}
        {passage && (
          <p className="max-w-sm text-center text-xs text-body-gray opacity-60 select-none">
            {passage.substring(0, 40)}…
          </p>
        )}
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes countdown { 0%{transform:scale(1.4);opacity:0} 60%{transform:scale(0.95);opacity:1} 100%{transform:scale(1);opacity:1} }
            .animate-countdown { animation: countdown 0.4s ease-out forwards; }
          `
        }} />
      </div>
    );
  }

  // ── Racing / finished ─────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden p-3">

      {/* Progress bars */}
      <div className="shrink-0 flex flex-col gap-1.5 rounded-xl border border-white/5 bg-white/5 px-3 py-2">
        <RaceBar
          label={myLabel}
          progress={myProgress}
          wpm={myWpm}
          accuracy={myFinishedDisplay ? myAccuracy : (typed.length > 5 ? myAccuracy : 100)}
          finished={myFinishedDisplay}
          isMe
        />
        <RaceBar
          label={opLabel}
          progress={opProgress}
          wpm={opponentWpm}
          accuracy={opFinishedDisplay ? opponentAccuracy : (opponentPos > 5 ? opponentAccuracy : 100)}
          finished={opFinishedDisplay}
          isMe={false}
        />
      </div>

      {/* Timer + stats row */}
      <div className="shrink-0 flex items-center justify-between text-xs text-body-gray px-1">
        <span className="tabular-nums font-mono">{formatTime(elapsedSec)}</span>
        <div className="flex items-center gap-3">
          {myErrors > 0 && (
            <span className="text-red-400">{myErrors} error{myErrors !== 1 ? "s" : ""}</span>
          )}
          {myAccuracy < 90 && typed.length > 10 && (
            <span className="text-amber-400">+{myErrors * 0.5}s penalty</span>
          )}
        </div>
        <span className="font-mono tabular-nums text-teal">
          {typed.length > 0 && passage ? `${typed.length}/${passage.length}` : ""}
        </span>
      </div>

      {/* Passage display */}
      <div
        className="flex-1 overflow-auto rounded-xl border border-white/10 bg-[#0E0E12] p-4 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {passage && (
          <PassageDisplay
            passage={passage}
            typed={typed}
            opponentPos={opponentPos}
            opponentName={opLabel}
            revealAll={phase === "match_over"}
          />
        )}

        {/* Finished overlays */}
        {phase === "finished" && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-teal/30 bg-teal/10 px-3 py-2 text-sm">
            <span className="text-teal font-semibold">✓ You finished!</span>
            <span className="text-body-gray">
              {myWpm} WPM • {myAccuracy}% accuracy
              {myAccuracy < 90 && myErrors > 0 && (
                <span className="text-amber-400 ml-1">(+{(myErrors * 0.5).toFixed(1)}s penalty)</span>
              )}
            </span>
          </div>
        )}
        {opFinishedDisplay && phase !== "match_over" && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-sm">
            <span className="text-purple-400 font-semibold">{opLabel} finished!</span>
            <span className="text-body-gray">{opponentWpm} WPM • {opponentAccuracy}%</span>
          </div>
        )}
      </div>

      {/* Hidden / visible input */}
      {phase === "racing" && (
        <input
          ref={inputRef}
          type="text"
          value={typed}
          onChange={handleInput}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="h-10 w-full shrink-0 rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-body-gray focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          placeholder="Start typing here..."
          aria-label="Type the passage"
        />
      )}

      {phase === "finished" && (
        <div className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-body-gray">
          Waiting for {opLabel}
          <span className="ml-1 inline-flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-body-gray"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
