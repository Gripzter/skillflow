"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TOTAL_ROUNDS,
  getReadyDurationMs,
  getRandomTargetPosition,
  getTargetDiameter,
  getTargetColor,
  getRoundWinner,
  getMatchWinner,
} from "@/lib/games/reaction-logic";
import { getReactionBotResponseMs, type BotDifficulty } from "@/lib/games/bot-engine";

const GAME_AREA_MIN = { w: 600, h: 400 };
const TARGET_BASE = 70;
const TARGET_BASE_MOBILE = 80;
const ROUND_RESULT_DURATION = 3000;
const TAP_TIMEOUT_MS = 5000;
const MISS_PENALTY_MS = 500;
const ROUND_START_DELAY_MIN = 2000;
const ROUND_START_DELAY_MAX = 5000;

function reactionLabel(ms: number): { text: string; color: string } {
  if (ms < 200) return { text: "INSANE! 🔥", color: "#FACC15" };
  if (ms < 300) return { text: "Great!", color: "#FF5E00" };
  if (ms < 400) return { text: "Good", color: "#22C55E" };
  if (ms < 500) return { text: "OK", color: "#FACC15" };
  return { text: "Slow", color: "#9ca3af" };
}

import type { GameMultiplayerProps } from "./Chess";
import type { MatchUiState } from "@/components/game/matchUi";

interface ReactionDuelProps extends GameMultiplayerProps {
  player1: { username: string; rating: number };
  player2: { username: string; rating: number };
  onGameEnd: (winner: "player1" | "player2") => void;
  onGameDraw: () => void;
  isPlayer2Bot?: boolean;
  botDifficulty?: BotDifficulty;
  isPractice?: boolean;
}

type Phase = "countdown" | "get_ready" | "target" | "tapped" | "round_result" | "match_over";
type Reaction = number | "false_start" | "timeout";

function encodeReactionValue(value: Reaction): number {
  if (value === "false_start") return -1;
  if (value === "timeout") return -2;
  return value;
}

function getBotFalseStartChance(difficulty: BotDifficulty): number {
  if (difficulty === "rookie") return 0.1;
  if (difficulty === "professional") return 0.02;
  return 0.05;
}

export default function ReactionDuel({
  player1,
  player2,
  onGameEnd,
  onGameDraw,
  isPlayer2Bot = true,
  botDifficulty = "gamer",
  isMultiplayer = false,
  myRole = "player1",
  sendGameEvent,
  onPlayerAction,
  incomingEvent,
  onEventProcessed,
  isPractice: isPracticeProp,
  onMatchUi,
}: ReactionDuelProps) {
  const [phase, setPhase] = useState<Phase>("countdown");
  const [countdownN, setCountdownN] = useState(3);
  const [round, setRound] = useState(1);
  const [p1Wins, setP1Wins] = useState(0);
  const [p2Wins, setP2Wins] = useState(0);
  const [p1TotalMs, setP1TotalMs] = useState(0);
  const [p2TotalMs, setP2TotalMs] = useState(0);
  const [roundHistory, setRoundHistory] = useState<{ p1: Reaction; p2: Reaction; winner: "player1" | "player2" | "draw" }[]>([]);
  const [targetPos, setTargetPos] = useState<{ x: number; y: number } | null>(null);
  const [targetDiameter, setTargetDiameter] = useState(TARGET_BASE);
  const [targetColor, setTargetColor] = useState("#FF5E00");
  const [p1Reaction, setP1Reaction] = useState<Reaction | null>(null);
  const [p2Reaction, setP2Reaction] = useState<Reaction | null>(null);
  const [roundResult, setRoundResult] = useState<{ p1: Reaction; p2: Reaction; winner: "player1" | "player2" | "draw" } | null>(null);
  const [opponentReactionForRound, setOpponentReactionForRound] = useState<{ round: number; reactionTime: number } | null>(null);
  const [tapPos, setTapPos] = useState<{ x: number; y: number } | null>(null);
  const [showTooEarly, setShowTooEarly] = useState(false);
  const [showMiss, setShowMiss] = useState(false);
  const [lastP1Time, setLastP1Time] = useState<number | null>(null);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const targetAppearTimeRef = useRef<number>(0);
  const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const areaSizeRef = useRef({ w: GAME_AREA_MIN.w, h: GAME_AREA_MIN.h });
  const roundStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const lastProcessedEventRef = useRef<Record<string, unknown> | null>(null);
  const p1ReactionRef = useRef<Reaction | null>(null);
  const p2ReactionRef = useRef<Reaction | null>(null);

  const baseTargetSize = isMobile ? TARGET_BASE_MOBILE : TARGET_BASE;

  useEffect(() => {
    p1ReactionRef.current = p1Reaction;
  }, [p1Reaction]);

  useEffect(() => {
    p2ReactionRef.current = p2Reaction;
  }, [p2Reaction]);

  const clearAllTimeouts = useCallback(() => {
    if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
    if (roundStartTimeoutRef.current) clearTimeout(roundStartTimeoutRef.current);
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    if (roundResultTimeoutRef.current) clearTimeout(roundResultTimeoutRef.current);
    readyTimeoutRef.current = null;
    roundStartTimeoutRef.current = null;
    botTimeoutRef.current = null;
    tapTimeoutRef.current = null;
    roundResultTimeoutRef.current = null;
  }, []);

  const syncGameAreaSize = useCallback(() => {
    const el = gameAreaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    areaSizeRef.current = { w: rect.width, h: rect.height };
  }, []);

  useEffect(() => {
    const ro = new ResizeObserver(() => syncGameAreaSize());
    if (gameAreaRef.current) ro.observe(gameAreaRef.current);
    syncGameAreaSize();
    window.addEventListener("resize", syncGameAreaSize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncGameAreaSize);
    };
  }, [syncGameAreaSize]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdownN > 0) {
      const t = setTimeout(() => setCountdownN((n) => n - 1), 1000);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setPhase("get_ready");
      setCountdownN(3);
    }, 1000);
    return () => clearTimeout(t);
  }, [phase, countdownN]);

  // Incoming multiplayer: round_start (show target after delay), reaction_result (opponent's time)
  useEffect(() => {
    if (!incomingEvent || !onEventProcessed || incomingEvent === lastProcessedEventRef.current) return;
    const type = incomingEvent.type as string | undefined;
    if (type === "round_start") {
      const r = incomingEvent.round as number | undefined;
      const delay = incomingEvent.delay as number | undefined;
      const targetNormX = incomingEvent.targetNormX as number | undefined;
      const targetNormY = incomingEvent.targetNormY as number | undefined;
      if (typeof r !== "number" || typeof delay !== "number" || phase !== "get_ready") {
        onEventProcessed();
        return;
      }
      lastProcessedEventRef.current = incomingEvent;
      const area = areaSizeRef.current;
      const x = typeof targetNormX === "number" ? targetNormX * area.w : area.w / 2;
      const y = typeof targetNormY === "number" ? targetNormY * area.h : area.h / 2;
      const size = baseTargetSize;
      if (roundStartTimeoutRef.current) clearTimeout(roundStartTimeoutRef.current);
      roundStartTimeoutRef.current = setTimeout(() => {
        roundStartTimeoutRef.current = null;
        setP1Reaction(null);
        setP2Reaction(null);
        setShowTooEarly(false);
        setShowMiss(false);
        setTapPos(null);
        setTargetPos({ x, y });
        setTargetDiameter(getTargetDiameter(size));
        setTargetColor(getTargetColor(r - 1));
        targetAppearTimeRef.current = performance.now();
        setPhase("target");
        tapTimeoutRef.current = setTimeout(() => {
          tapTimeoutRef.current = null;
          const setReaction = myRole === "player1" ? setP1Reaction : setP2Reaction;
          setReaction((prev) => (prev === null ? "timeout" : prev));
          if (sendGameEvent) sendGameEvent({ type: "reaction_result", round: r, reactionTime: -2 }).catch(() => {});
        }, TAP_TIMEOUT_MS);
      }, delay);
      onEventProcessed();
    } else if (type === "reaction_result") {
      const r = incomingEvent.round as number | undefined;
      const reactionTime = incomingEvent.reactionTime as number | undefined;
      if (typeof r !== "number" || typeof reactionTime !== "number") {
        onEventProcessed();
        return;
      }
      lastProcessedEventRef.current = incomingEvent;
      const value = reactionTime === -1 ? -1 : reactionTime;
      setOpponentReactionForRound({ round: r, reactionTime: value });
      onEventProcessed();
    }
  }, [incomingEvent, onEventProcessed, phase, baseTargetSize, myRole, sendGameEvent]);

  useEffect(() => () => {
    if (roundStartTimeoutRef.current) clearTimeout(roundStartTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (phase !== "get_ready") return;
    setP1Reaction(null);
    setP2Reaction(null);
    setRoundResult(null);
    setOpponentReactionForRound(null);
    setShowTooEarly(false);
    setShowMiss(false);
    setTapPos(null);

    if (isMultiplayer && myRole === "player1" && sendGameEvent) {
      const area = areaSizeRef.current;
      const size = baseTargetSize;
      const pos = getRandomTargetPosition(area.w, area.h, size);
      const targetNormX = area.w > 0 ? pos.x / area.w : 0.5;
      const targetNormY = area.h > 0 ? pos.y / area.h : 0.5;
      const delay = ROUND_START_DELAY_MIN + Math.floor(Math.random() * (ROUND_START_DELAY_MAX - ROUND_START_DELAY_MIN + 1));
      sendGameEvent({ type: "round_start", round, delay, targetNormX, targetNormY }).catch(() => {});
      readyTimeoutRef.current = setTimeout(() => {
        readyTimeoutRef.current = null;
        setTargetPos(pos);
        setTargetDiameter(getTargetDiameter(size));
        setTargetColor(getTargetColor(round - 1));
        targetAppearTimeRef.current = performance.now();
        setPhase("target");
        tapTimeoutRef.current = setTimeout(() => {
          tapTimeoutRef.current = null;
          setP1Reaction((prev) => (prev === null ? "timeout" : prev));
          if (sendGameEvent) sendGameEvent({ type: "reaction_result", round, reactionTime: -2 }).catch(() => {});
        }, TAP_TIMEOUT_MS);
      }, delay);
      return () => {
        if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
      };
    }

    if (isMultiplayer && myRole === "player2") {
      return;
    }

    const duration = getReadyDurationMs();
    if (isPlayer2Bot) {
      const falseStartChance = getBotFalseStartChance(botDifficulty);
      if (Math.random() < falseStartChance) {
        const falseStartDelay = Math.max(
          50,
          Math.floor(Math.random() * Math.max(80, duration - 120))
        );
        botTimeoutRef.current = setTimeout(() => {
          botTimeoutRef.current = null;
          setP2Reaction((prev) => (prev === null ? "false_start" : prev));
          setShowTooEarly(true);
        }, falseStartDelay);
      }
    }

    readyTimeoutRef.current = setTimeout(() => {
      readyTimeoutRef.current = null;
      const area = areaSizeRef.current;
      const size = baseTargetSize;
      setTargetPos(getRandomTargetPosition(area.w, area.h, size));
      setTargetDiameter(getTargetDiameter(size));
      setTargetColor(getTargetColor(round - 1));
      targetAppearTimeRef.current = performance.now();
      setPhase("target");
      if (isPlayer2Bot) {
        const botMs = getReactionBotResponseMs(botDifficulty);
        botTimeoutRef.current = setTimeout(() => {
          botTimeoutRef.current = null;
          setP2Reaction((prev) => (prev === null ? botMs : prev));
          if (p1ReactionRef.current !== null) {
            setPhase("tapped");
          }
        }, botMs);
      }
      tapTimeoutRef.current = setTimeout(() => {
        tapTimeoutRef.current = null;
        setP1Reaction((prev) => (prev === null ? "timeout" : prev));
      }, TAP_TIMEOUT_MS);
    }, duration);
    return () => {
      if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
    };
  }, [phase, round, isPlayer2Bot, botDifficulty, isMultiplayer, myRole, sendGameEvent, baseTargetSize]);

  const advanceRound = useCallback(
    (p1: Reaction, p2: Reaction) => {
      if (roundResultTimeoutRef.current) {
        clearTimeout(roundResultTimeoutRef.current);
        roundResultTimeoutRef.current = null;
      }
      const winner = getRoundWinner(p1, p2);
      setRoundHistory((prev) => [...prev, { p1, p2, winner }]);
      setP1Wins((w) => (winner === "player1" ? w + 1 : w));
      setP2Wins((w) => (winner === "player2" ? w + 1 : w));
      if (typeof p1 === "number") setP1TotalMs((t) => t + p1);
      if (typeof p2 === "number") setP2TotalMs((t) => t + p2);
      setRound((r) => {
        if (r >= TOTAL_ROUNDS) {
          setPhase("match_over");
          setTimeout(() => {
            const newP1Wins = winner === "player1" ? p1Wins + 1 : p1Wins;
            const newP2Wins = winner === "player2" ? p2Wins + 1 : p2Wins;
            const totalP1 = p1TotalMs + (typeof p1 === "number" ? p1 : 0);
            const totalP2 = p2TotalMs + (typeof p2 === "number" ? p2 : 0);
            const matchWinner = getMatchWinner(newP1Wins, newP2Wins, totalP1, totalP2);
            if (matchWinner === "draw") onGameDraw();
            else onGameEnd(matchWinner);
          }, 500);
          return r;
        }
        setPhase("get_ready");
        return r + 1;
      });
    },
    [p1Wins, p2Wins, p1TotalMs, p2TotalMs, onGameEnd, onGameDraw]
  );

  const handleGameAreaTap = useCallback(
    (clientX: number, clientY: number) => {
      if (phase === "countdown") return;
      onPlayerAction?.();
      if (phase === "get_ready") {
        setShowTooEarly(true);
        const myReaction: Reaction = "false_start";
        if (!isMultiplayer || myRole === "player1") setP1Reaction(myReaction);
        else setP2Reaction(myReaction);
        if (isMultiplayer && sendGameEvent) {
          sendGameEvent({ type: "reaction_result", round, reactionTime: -1 }).catch(() => {});
        }
        return;
      }
      const myReactionAlreadySet = isMultiplayer ? (myRole === "player1" ? p1Reaction !== null : p2Reaction !== null) : p1Reaction !== null;
      if (phase !== "target" || myReactionAlreadySet) return;
      const el = gameAreaRef.current;
      const r = el?.getBoundingClientRect();
      if (!el || !r || r.width <= 0 || !targetPos) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const dist = Math.hypot(x - targetPos.x, y - targetPos.y);
      const radius = targetDiameter / 2 + 15;
      const hit = dist <= radius;
      const reactionMs = Math.round(performance.now() - targetAppearTimeRef.current);
      const value: Reaction = hit ? reactionMs : reactionMs + MISS_PENALTY_MS;
      const sendValue = encodeReactionValue(value);
      if (myRole === "player1") {
        setP1Reaction(value);
        setLastP1Time(typeof value === "number" ? value : null);
      } else {
        setP2Reaction(value);
      }
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      setTapPos({ x: hit ? targetPos.x : x, y: hit ? targetPos.y : y });
      if (!hit) setShowMiss(true);
      setPhase("tapped");
      if (isMultiplayer && sendGameEvent) {
        sendGameEvent({ type: "reaction_result", round, reactionTime: sendValue }).catch(() => {});
      }
    },
    [phase, p1Reaction, p2Reaction, myRole, targetPos, targetDiameter, round, isMultiplayer, sendGameEvent, onPlayerAction]
  );

  function toReaction(t: number): Reaction {
    if (t === -1) return "false_start";
    if (t === -2) return "timeout";
    return t;
  }

  useEffect(() => {
    if (phase !== "tapped" && phase !== "target") return;
    if (isMultiplayer && opponentReactionForRound?.round === round) {
      const myReaction = myRole === "player1" ? p1Reaction : p2Reaction;
      if (myReaction === null) return;
      const p1: Reaction = myRole === "player1" ? myReaction : toReaction(opponentReactionForRound.reactionTime);
      const p2: Reaction = myRole === "player1" ? toReaction(opponentReactionForRound.reactionTime) : myReaction;
      setPhase("round_result");
      setRoundResult({ p1, p2, winner: getRoundWinner(p1, p2) });
      setOpponentReactionForRound(null);
      roundResultTimeoutRef.current = setTimeout(() => {
        roundResultTimeoutRef.current = null;
        advanceRound(p1, p2);
      }, ROUND_RESULT_DURATION);
      return () => {
        if (roundResultTimeoutRef.current) clearTimeout(roundResultTimeoutRef.current);
      };
    }
    if (!isMultiplayer) {
      const p2 = p2Reaction;
      if (p2 !== null && p1Reaction !== null) {
        if (phase !== "tapped") {
          setPhase("tapped");
        }
        setPhase("round_result");
        setRoundResult({ p1: p1Reaction, p2, winner: getRoundWinner(p1Reaction, p2) });
        roundResultTimeoutRef.current = setTimeout(() => advanceRound(p1Reaction!, p2), ROUND_RESULT_DURATION);
      }
      return () => {
        if (roundResultTimeoutRef.current) clearTimeout(roundResultTimeoutRef.current);
      };
    }
  }, [phase, p1Reaction, p2Reaction, advanceRound, isMultiplayer, myRole, round, opponentReactionForRound]);

  // Multiplayer safety: if my reaction is recorded but opponent payload never arrives, force a timeout resolution.
  useEffect(() => {
    if (!isMultiplayer) return;
    if (phase !== "tapped" && phase !== "target") return;
    if (opponentReactionForRound?.round === round) return;
    const myReaction = myRole === "player1" ? p1Reaction : p2Reaction;
    if (myReaction === null) return;
    const fallback = setTimeout(() => {
      setOpponentReactionForRound((prev) => (prev?.round === round ? prev : { round, reactionTime: -2 }));
    }, 4500);
    return () => clearTimeout(fallback);
  }, [isMultiplayer, myRole, opponentReactionForRound, p1Reaction, p2Reaction, phase, round]);

  useEffect(() => {
    return () => clearAllTimeouts();
  }, [clearAllTimeouts]);

  const p1Streak = (() => {
    let s = 0;
    for (let i = roundHistory.length - 1; i >= 0; i--) {
      if (roundHistory[i].winner === "player1") s++;
      else break;
    }
    return s;
  })();
  const p2Streak = (() => {
    let s = 0;
    for (let i = roundHistory.length - 1; i >= 0; i--) {
      if (roundHistory[i].winner === "player2") s++;
      else break;
    }
    return s;
  })();

  const progressP1 = p1Wins / TOTAL_ROUNDS;
  const progressP2 = p2Wins / TOTAL_ROUNDS;

  const isPractice = isPracticeProp ?? !isMultiplayer;
  const p1RowActive =
    (phase === "target" || phase === "get_ready") &&
    p1Reaction === null &&
    (!isMultiplayer || myRole === "player1");
  const p2RowActive =
    (phase === "target" || phase === "get_ready") &&
    p2Reaction === null &&
    (!isMultiplayer || myRole === "player2");

  const ACCENT_P1 = "#FF5E00";
  const ACCENT_P2 = "#A855F7";
  const isMyTurn = isMultiplayer ? (myRole === "player1" ? p1RowActive : p2RowActive) : p1RowActive;

  const gameStartRef = useRef(Date.now());
  useEffect(() => {
    if (!onMatchUi) return;
    let turnText = "Get ready...";
    if (phase === "match_over") turnText = "Match over";
    else if (phase === "countdown") turnText = "Starting...";
    else if (isMyTurn) turnText = "YOUR TURN — Tap the target when it appears!";
    else turnText = "Waiting for opponent...";
    const systemLogEntries: MatchUiState["systemLogEntries"] = [
      {
        id: "start",
        text: `⚡ Reaction Duel — ${player1.username} vs ${player2.username}`,
        timestamp: gameStartRef.current,
      },
      ...roundHistory.map((r, i) => {
        const p1Label = typeof r.p1 === "number" ? `${r.p1}ms` : String(r.p1);
        const p2Label = typeof r.p2 === "number" ? `${r.p2}ms` : String(r.p2);
        const winnerText =
          r.winner === "draw"
            ? "Round tied"
            : r.winner === "player1"
              ? `${player1.username} wins`
              : `${player2.username} wins`;
        return {
          id: `round-${i}`,
          text: `Round ${i + 1}: ${winnerText} · ${player1.username}: ${p1Label}, ${player2.username}: ${p2Label}`,
          timestamp: gameStartRef.current + (i + 1) * 1000,
        };
      }),
    ];
    onMatchUi({
      scores: { player1: p1Wins, player2: p2Wins },
      scoreLabel: "Rounds",
      currentTurn: p1RowActive ? "player1" : "player2",
      requiresAction: p1RowActive || p2RowActive,
      turnText,
      systemLogEntries,
    });
  }, [
    onMatchUi,
    phase,
    isMyTurn,
    roundHistory,
    p1Wins,
    p2Wins,
    p1RowActive,
    player1.username,
    player2.username,
    isPlayer2Bot,
  ]);

  return (
    <div
      className="flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden touch-manipulation"
      style={{ touchAction: "manipulation" }}
    >
      <div className="mb-1.5 flex w-full max-w-[400px] shrink-0 flex-col gap-1 px-2">
        <div className="flex items-center justify-between text-[11px] text-body-gray">
          <span>
            Round {phase === "match_over" ? TOTAL_ROUNDS : round}/{TOTAL_ROUNDS}
          </span>
          <span className="tabular-nums">
            {p1Wins}–{p2Wins}
          </span>
        </div>
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-teal transition-all duration-300" style={{ width: `${progressP1 * 50}%` }} />
          <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${progressP2 * 50}%` }} />
        </div>
      </div>
      <div className="relative flex min-h-0 w-full max-w-[400px] flex-1 items-center justify-center overflow-hidden">
          <div
            ref={gameAreaRef}
            className="flex aspect-[3/2] min-h-[220px] w-full min-w-0 select-none items-center justify-center overflow-hidden rounded-2xl border border-white/10"
            style={{
              backgroundColor: phase === "target" ? "#1A1A22" : "#0E0E12",
              minWidth: 0,
              touchAction: "manipulation",
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              const t = e.changedTouches[0];
              if (t) handleGameAreaTap(t.clientX, t.clientY);
            }}
            onPointerDown={(e) => {
              if (e.pointerType === "mouse") handleGameAreaTap(e.clientX, e.clientY);
            }}
          >
            {phase === "countdown" && (
              <div className="text-center">
                {countdownN > 0 ? (
                  <span
                    className="text-6xl font-black animate-fade-in"
                    style={{
                      color: countdownN === 3 ? "#fff" : countdownN === 2 ? "#FACC15" : "#FF5E00",
                    }}
                  >
                    {countdownN}
                  </span>
                ) : (
                  <span className="text-6xl font-black text-teal animate-pulse">GO!</span>
                )}
              </div>
            )}

            {phase === "get_ready" && (
              <div className="text-center">
                <p className="text-3xl font-bold text-white animate-pulse">Get Ready...</p>
                <p className="mt-2 text-body-gray">Round {round} of {TOTAL_ROUNDS}</p>
              </div>
            )}

            {phase === "target" && targetPos && (
              <div
                className="absolute rounded-full border-[3px] border-white pointer-events-none animate-scale-in"
                style={{
                  left: targetPos.x - targetDiameter / 2,
                  top: targetPos.y - targetDiameter / 2,
                  width: targetDiameter,
                  height: targetDiameter,
                  backgroundColor: targetColor,
                  boxShadow: `0 0 20px ${targetColor}, 0 0 40px ${targetColor}40`,
                }}
              >
                <div className="absolute inset-[20%] rounded-full border-2 border-white/50" />
                <div className="absolute inset-[35%] rounded-full border border-white/30" />
              </div>
            )}

            {phase === "tapped" && tapPos && p1Reaction !== null && p1Reaction !== "false_start" && p1Reaction !== "timeout" && (
              <div
                className="absolute pointer-events-none text-2xl font-bold text-teal"
                style={{ left: tapPos.x - 30, top: tapPos.y - 50 }}
              >
                {p1Reaction}ms
                <span className="block text-sm font-normal" style={{ color: reactionLabel(p1Reaction).color }}>
                  {reactionLabel(p1Reaction).text}
                </span>
              </div>
            )}

            {showTooEarly && (
              <p className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-red-500 animate-pulse">
                TOO EARLY!
              </p>
            )}

            {showMiss && tapPos && (
              <p
                className="absolute text-xl font-bold text-red-500"
                style={{ left: tapPos.x - 30, top: tapPos.y - 20 }}
              >
                MISS!
              </p>
            )}

            {phase === "round_result" && roundResult && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0E0E12]/80 px-4 text-center">
                <p className="text-2xl font-bold text-white">Round Result</p>
                <div className="mt-3 grid w-full max-w-[320px] grid-cols-2 gap-3">
                  <div className={`rounded-lg border p-3 ${roundResult.winner === "player1" ? "border-teal bg-teal/20" : "border-white/15 bg-black/20"}`}>
                    <p className="text-xs uppercase text-body-gray">{player1.username}</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {typeof roundResult.p1 === "number" ? `${roundResult.p1}ms` : roundResult.p1.replace("_", " ")}
                    </p>
                  </div>
                  <div className={`rounded-lg border p-3 ${roundResult.winner === "player2" ? "border-purple-400 bg-purple-500/20" : "border-white/15 bg-black/20"}`}>
                    <p className="text-xs uppercase text-body-gray">{player2.username}</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {typeof roundResult.p2 === "number" ? `${roundResult.p2}ms` : roundResult.p2.replace("_", " ")}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-body-gray">
                  {roundResult.winner === "draw"
                    ? "Round draw"
                    : roundResult.winner === "player1"
                      ? `${player1.username} wins the round`
                      : `${player2.username} wins the round`}
                </p>
              </div>
            )}
          </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scale-in {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in { animation: scale-in 0.1s ease-out forwards; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
      `}} />
    </div>
  );
}
