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
const ROUND_RESULT_DURATION = 2000;
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
import { GamePlayerRow, GamePlayerStack } from "@/components/games/GamePlayerStrip";
import { MobilePlayerCards } from "@/components/games/MobilePlayerCards";

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
  incomingEvent,
  onEventProcessed,
  isPractice: isPracticeProp,
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
  const [opponentReactionForRound, setOpponentReactionForRound] = useState<{ round: number; reactionTime: number } | null>(null);
  const [tapPos, setTapPos] = useState<{ x: number; y: number } | null>(null);
  const [showTooEarly, setShowTooEarly] = useState(false);
  const [showMiss, setShowMiss] = useState(false);
  const [lastP1Time, setLastP1Time] = useState<number | null>(null);
  const gameAreaMobileRef = useRef<HTMLDivElement>(null);
  const gameAreaDesktopRef = useRef<HTMLDivElement>(null);
  const targetAppearTimeRef = useRef<number>(0);
  const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const areaSizeRef = useRef({ w: GAME_AREA_MIN.w, h: GAME_AREA_MIN.h });
  const roundStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const gameLogMobileRef = useRef<HTMLDivElement | null>(null);
  const gameLogDesktopRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);
  const lastProcessedEventRef = useRef<Record<string, unknown> | null>(null);

  const baseTargetSize = isMobile ? TARGET_BASE_MOBILE : TARGET_BASE;

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
    const m = gameAreaMobileRef.current;
    const d = gameAreaDesktopRef.current;
    const rectM = m?.getBoundingClientRect();
    const rectD = d?.getBoundingClientRect();
    const pick =
      rectM && rectM.width > 0 && rectM.height > 0
        ? m!
        : rectD && rectD.width > 0 && rectD.height > 0
          ? d!
          : m || d;
    if (!pick) return;
    const rect = pick.getBoundingClientRect();
    areaSizeRef.current = { w: rect.width, h: rect.height };
  }, []);

  useEffect(() => {
    const ro = new ResizeObserver(() => syncGameAreaSize());
    if (gameAreaMobileRef.current) ro.observe(gameAreaMobileRef.current);
    if (gameAreaDesktopRef.current) ro.observe(gameAreaDesktopRef.current);
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

  // Auto-scroll game log to the latest round result when user hasn't scrolled up.
  useEffect(() => {
    const activeLogRef = window.innerWidth < 768 ? gameLogMobileRef.current : gameLogDesktopRef.current;
    if (!activeLogRef) return;
    if (!atBottomRef.current) return;
    activeLogRef.scrollTop = activeLogRef.scrollHeight;
  }, [roundHistory.length]);

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
          setP2Reaction(botMs);
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
      if (phase === "get_ready") {
        setShowTooEarly(true);
        const myReaction: Reaction = "false_start";
        if (!isMultiplayer || myRole === "player1") setP1Reaction(myReaction);
        else setP2Reaction(myReaction);
        if (isMultiplayer && sendGameEvent) {
          sendGameEvent({ type: "reaction_result", round, reactionTime: -1 }).catch(() => {});
        }
        if (botTimeoutRef.current) {
          clearTimeout(botTimeoutRef.current);
          botTimeoutRef.current = null;
        }
        if (!isMultiplayer && isPlayer2Bot) {
          const botMs = getReactionBotResponseMs(botDifficulty);
          setP2Reaction(botMs);
          setTimeout(() => {
            setPhase("round_result");
            roundResultTimeoutRef.current = setTimeout(() => advanceRound("false_start", botMs), ROUND_RESULT_DURATION);
          }, 800);
        }
        return;
      }
      const myReactionAlreadySet = isMultiplayer ? (myRole === "player1" ? p1Reaction !== null : p2Reaction !== null) : p1Reaction !== null;
      if (phase !== "target" || myReactionAlreadySet) return;
      const m = gameAreaMobileRef.current;
      const d = gameAreaDesktopRef.current;
      const rm = m?.getBoundingClientRect();
      const el =
        rm && rm.width > 0 && rm.height > 0
          ? m
          : (() => {
              const rd = d?.getBoundingClientRect();
              return rd && rd.width > 0 && rd.height > 0 ? d : m || d;
            })();
      if (!el || !targetPos) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const dist = Math.hypot(x - targetPos.x, y - targetPos.y);
      const radius = targetDiameter / 2 + 15;
      const hit = dist <= radius;
      const reactionMs = Math.round(performance.now() - targetAppearTimeRef.current);
      const value: Reaction = hit ? reactionMs : reactionMs + MISS_PENALTY_MS;
      const sendValue = typeof value === "number" ? value : -1;
      if (myRole === "player1") {
        setP1Reaction(value);
        setLastP1Time(typeof value === "number" ? value : null);
        if (typeof value === "number") setP1TotalMs((t) => t + value);
      } else {
        setP2Reaction(value);
        if (typeof value === "number") setP2TotalMs((t) => t + value);
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
    [phase, p1Reaction, p2Reaction, myRole, targetPos, targetDiameter, round, isMultiplayer, sendGameEvent, isPlayer2Bot, botDifficulty, advanceRound]
  );

  function toReaction(t: number): Reaction {
    if (t === -1) return "false_start";
    if (t === -2) return "timeout";
    return t;
  }

  useEffect(() => {
    if (phase !== "tapped") return;
    if (isMultiplayer && opponentReactionForRound?.round === round) {
      const myReaction = myRole === "player1" ? p1Reaction : p2Reaction;
      if (myReaction === null) return;
      const p1: Reaction = myRole === "player1" ? myReaction : toReaction(opponentReactionForRound.reactionTime);
      const p2: Reaction = myRole === "player1" ? toReaction(opponentReactionForRound.reactionTime) : myReaction;
      setPhase("round_result");
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
        setPhase("round_result");
        roundResultTimeoutRef.current = setTimeout(() => advanceRound(p1Reaction!, p2), ROUND_RESULT_DURATION);
      }
      return () => {
        if (roundResultTimeoutRef.current) clearTimeout(roundResultTimeoutRef.current);
      };
    }
  }, [phase, p1Reaction, p2Reaction, advanceRound, isMultiplayer, myRole, round, opponentReactionForRound]);

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

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden touch-manipulation"
      style={{ touchAction: "manipulation" }}
    >
      {/* Mobile */}
      <div className="flex h-full min-h-0 flex-col overflow-hidden md:hidden">
        <MobilePlayerCards
          player1Name={player1.username}
          player1Right={`${p1Wins}`}
          player2Name={player2.username}
          player2Right={`${p2Wins}`}
          player1Active={p1RowActive}
          player2Active={p2RowActive}
        />

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <div
            ref={gameAreaMobileRef}
            className="game-play-area-mobile flex min-w-0 select-none items-center justify-center overflow-hidden rounded-2xl border border-white/10"
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
          </div>
        </div>

        {/* Game status (~30px) */}
        <div className="flex h-[30px] shrink-0 items-center justify-between px-3">
          <span
            className="min-w-0 truncate text-[13px] font-medium"
            style={{ color: isMyTurn ? (myRole === "player1" ? ACCENT_P1 : ACCENT_P2) : "rgba(148, 163, 184, 1)" }}
          >
            {isMyTurn ? "Your Turn" : "Opponent's Turn"}
          </span>
          <span className="shrink-0 text-[13px] text-body-gray tabular-nums">15s</span>
        </div>

        {/* Game Log (~100px fixed) */}
        <div className="h-[100px] min-h-[100px] max-h-[100px] shrink-0 overflow-hidden rounded-lg border border-white/10 bg-card/80">
          <h3 className="shrink-0 border-b border-white/10 px-3 py-2 text-[11px] font-semibold text-white">
            Game Log
          </h3>
          <div
            ref={gameLogMobileRef}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2"
            onScroll={(e) => {
              const el = e.currentTarget;
              atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
            }}
          >
            {roundHistory.length === 0 ? (
              <p className="py-2 text-center text-[11px] text-body-gray">Rounds will appear here.</p>
            ) : (
              roundHistory.map((r, i) => {
                const p1Label = typeof r.p1 === "number" ? `${r.p1}ms` : r.p1;
                const p2Label = typeof r.p2 === "number" ? `${r.p2}ms` : r.p2;
                const winnerText =
                  r.winner === "draw"
                    ? "Round tied 🤝"
                    : r.winner === "player1"
                      ? `${player1.username} wins!`
                      : `${player2.username}${isPlayer2Bot ? " 🤖" : ""} wins!`;

                return (
                  <div key={i} className="mb-2 rounded-xl border border-white/5 bg-white/5 px-2 py-2">
                    <div className="text-[11px] font-semibold text-white/90">Round {i + 1} · {winnerText}</div>
                    <div className="mt-1 text-[11px] text-white/80">
                      {player1.username}: {p1Label} · {player2.username}: {p2Label}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden h-full min-h-0 w-full flex-1 flex-row gap-4 overflow-hidden md:flex">
        <div className="flex w-[200px] shrink-0 flex-col justify-center">
          <GamePlayerStack>
            <GamePlayerRow
              username={player1.username}
              avatarLetter={player1.username.charAt(0)}
              avatarClassName="bg-gradient-to-br from-teal/40 to-purple/40"
              scoreRight={`Score: ${p1Wins}`}
              active={p1RowActive}
              isPractice={isPractice}
              rating={player1.rating}
              footer={
                p1Streak >= 3 ? (
                  <span className="text-[10px] text-amber-400">🔥 {p1Streak} streak</span>
                ) : undefined
              }
            />
            <GamePlayerRow
              username={player2.username}
              avatarLetter={player2.username.charAt(0)}
              avatarClassName="bg-gradient-to-br from-purple/40 to-rose-500/40"
              scoreRight={`Score: ${p2Wins}`}
              active={p2RowActive}
              isPractice={isPractice}
              rating={player2.rating}
              isBot={isPlayer2Bot}
              footer={
                p2Streak >= 3 ? (
                  <span className="text-[10px] text-amber-400">🔥 {p2Streak} streak</span>
                ) : undefined
              }
            />
          </GamePlayerStack>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden py-2">
          <div className="shrink-0 flex items-center justify-between gap-4 px-4 py-3 border-b border-white/10">
            <span className="font-semibold text-white">Reaction Duel ⚡</span>
            <span className="text-body-gray tabular-nums">
              Round {phase === "match_over" ? TOTAL_ROUNDS : round}/{TOTAL_ROUNDS}
            </span>
          </div>

          <div className="shrink-0 px-4 py-3 bg-white/5 flex items-center justify-between">
            <span className="text-body-gray">First to {Math.ceil(TOTAL_ROUNDS / 2)} rounds</span>
            <span className="text-body-gray tabular-nums">
              {p1Wins}–{p2Wins}
            </span>
          </div>

          <div className="shrink-0 px-4 pb-2 pt-3 flex items-center gap-1">
            {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
              <div
                key={i}
                className="h-2 w-2 rounded-full flex-1 max-w-[8px]"
                style={{
                  backgroundColor: i < roundHistory.length
                    ? roundHistory[i].winner === "player1"
                      ? "var(--color-teal, #0d9488)"
                      : roundHistory[i].winner === "player2"
                        ? "#a855f7"
                        : "#6b7280"
                    : "rgba(255,255,255,0.15)",
                }}
              />
            ))}
          </div>

          <div className="shrink-0 h-2 mx-4 mb-3 flex rounded-full overflow-hidden bg-white/10">
            <div className="h-full bg-teal transition-all duration-300" style={{ width: `${progressP1 * 50}%` }} />
            <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${progressP2 * 50}%` }} />
          </div>

          <div
            ref={gameAreaDesktopRef}
            className="game-play-area-desktop relative mx-3 mb-2 flex min-h-0 flex-1 select-none items-center justify-center overflow-hidden rounded-2xl border border-white/10"
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
          </div>

          <div className="mt-1 flex w-full px-4 items-center justify-between text-sm text-body-gray">
            <span>{phase === "match_over" ? "Match Over" : "React fast when the target appears"}</span>
            <span className="tabular-nums">{lastP1Time !== null ? `Last: ${lastP1Time}ms` : " "}</span>
          </div>
        </div>

        {/* Right: game log */}
        <div className="flex w-[280px] shrink-0 flex-col overflow-hidden">
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-card/80"
            style={{ overflowX: "hidden" }}
          >
            <div className="sticky top-0 z-10 border-b border-white/10 bg-card/90 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">Game Log</h3>
            </div>
            <div
              ref={gameLogDesktopRef}
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3"
              onScroll={(e) => {
                const el = e.currentTarget;
                atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
              }}
            >
              {roundHistory.length === 0 ? (
                <p className="py-4 text-center text-xs text-body-gray">Rounds will appear here.</p>
              ) : (
                roundHistory.map((r, i) => {
                  const p1Label = typeof r.p1 === "number" ? `${r.p1}ms` : r.p1;
                  const p2Label = typeof r.p2 === "number" ? `${r.p2}ms` : r.p2;
                  const winnerText =
                    r.winner === "draw"
                      ? "Round tied 🤝"
                      : r.winner === "player1"
                        ? `${player1.username} wins!`
                        : `${player2.username}${isPlayer2Bot ? " 🤖" : ""} wins!`;
                  return (
                    <div key={i} className="mb-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2">
                      <div className="text-[11px] font-semibold text-white/90">
                        Round {i + 1} · {winnerText}
                      </div>
                      <div className="mt-1 text-[13px] text-white/90">
                        {player1.username}: {p1Label} · {player2.username}: {p2Label}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
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
