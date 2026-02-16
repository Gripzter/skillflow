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
import { getReactionBotResponseMs } from "@/lib/games/bot-engine";

const GAME_AREA_MIN = { w: 600, h: 400 };
const TARGET_BASE = 70;
const TARGET_BASE_MOBILE = 80;
const ROUND_RESULT_DURATION = 2000;
const TAP_TIMEOUT_MS = 5000;
const MISS_PENALTY_MS = 500;

function reactionLabel(ms: number): { text: string; color: string } {
  if (ms < 200) return { text: "INSANE! 🔥", color: "#EAB308" };
  if (ms < 300) return { text: "Great!", color: "#00E5C7" };
  if (ms < 400) return { text: "Good", color: "#22C55E" };
  if (ms < 500) return { text: "OK", color: "#EAB308" };
  return { text: "Slow", color: "#9ca3af" };
}

interface ReactionDuelProps {
  player1: { username: string; rating: number };
  player2: { username: string; rating: number };
  onGameEnd: (winner: "player1" | "player2") => void;
  onGameDraw: () => void;
  isPlayer2Bot?: boolean;
}

type Phase = "countdown" | "get_ready" | "target" | "tapped" | "round_result" | "match_over";
type Reaction = number | "false_start" | "timeout";

export default function ReactionDuel({
  player1,
  player2,
  onGameEnd,
  onGameDraw,
  isPlayer2Bot = true,
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
  const [targetColor, setTargetColor] = useState("#00E5C7");
  const [p1Reaction, setP1Reaction] = useState<Reaction | null>(null);
  const [p2Reaction, setP2Reaction] = useState<Reaction | null>(null);
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
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const baseTargetSize = isMobile ? TARGET_BASE_MOBILE : TARGET_BASE;

  const clearAllTimeouts = useCallback(() => {
    if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    if (roundResultTimeoutRef.current) clearTimeout(roundResultTimeoutRef.current);
    readyTimeoutRef.current = null;
    botTimeoutRef.current = null;
    tapTimeoutRef.current = null;
    roundResultTimeoutRef.current = null;
  }, []);

  useEffect(() => {
    const el = gameAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      areaSizeRef.current = { w: rect.width, h: rect.height };
    });
    ro.observe(el);
    areaSizeRef.current = { w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height };
    return () => ro.disconnect();
  }, []);

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

  useEffect(() => {
    if (phase !== "get_ready") return;
    setP1Reaction(null);
    setP2Reaction(null);
    setShowTooEarly(false);
    setShowMiss(false);
    setTapPos(null);
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
        const botMs = getReactionBotResponseMs();
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
  }, [phase, round, isPlayer2Bot, baseTargetSize]);

  const handleGameAreaTap = useCallback(
    (clientX: number, clientY: number) => {
      if (phase === "countdown") return;
      if (phase === "get_ready") {
        setShowTooEarly(true);
        setP1Reaction("false_start");
        if (botTimeoutRef.current) {
          clearTimeout(botTimeoutRef.current);
          botTimeoutRef.current = null;
        }
        const botMs = getReactionBotResponseMs();
        setP2Reaction(botMs);
        setTimeout(() => {
          setPhase("round_result");
          roundResultTimeoutRef.current = setTimeout(() => advanceRound("false_start", botMs), ROUND_RESULT_DURATION);
        }, 800);
        return;
      }
      if (phase !== "target" || p1Reaction !== null) return;
      const el = gameAreaRef.current;
      if (!el || !targetPos) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const dist = Math.hypot(x - targetPos.x, y - targetPos.y);
      const radius = targetDiameter / 2 + 15;
      const hit = dist <= radius;
      const reactionMs = Math.round(performance.now() - targetAppearTimeRef.current);
      if (hit) {
        if (tapTimeoutRef.current) {
          clearTimeout(tapTimeoutRef.current);
          tapTimeoutRef.current = null;
        }
        setP1Reaction(reactionMs);
        setLastP1Time(reactionMs);
        setP1TotalMs((t) => t + reactionMs);
        setTapPos({ x: targetPos.x, y: targetPos.y });
        setPhase("tapped");
      } else {
        setShowMiss(true);
        setTapPos({ x, y });
        const withPenalty = reactionMs + MISS_PENALTY_MS;
        setP1Reaction(withPenalty);
        setLastP1Time(withPenalty);
        setP1TotalMs((t) => t + withPenalty);
        if (tapTimeoutRef.current) {
          clearTimeout(tapTimeoutRef.current);
          tapTimeoutRef.current = null;
        }
        setPhase("tapped");
      }
    },
    [phase, p1Reaction, targetPos, targetDiameter]
  );

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
      if (typeof p2 === "number") setP2TotalMs((t) => t + p2);
      if (typeof p2 === "number") setP2TotalMs((t) => t + p2);
      setRound((r) => {
        if (r >= TOTAL_ROUNDS) {
          setPhase("match_over");
          setTimeout(() => {
            const newP1Wins = winner === "player1" ? p1Wins + 1 : p1Wins;
            const newP2Wins = winner === "player2" ? p2Wins + 1 : p2Wins;
            const totalP1 = p1TotalMs;
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

  useEffect(() => {
    if (phase !== "tapped") return;
    const p2 = p2Reaction;
    if (p2 !== null && p1Reaction !== null) {
      setPhase("round_result");
      roundResultTimeoutRef.current = setTimeout(() => advanceRound(p1Reaction!, p2), ROUND_RESULT_DURATION);
    }
    return () => {
      if (roundResultTimeoutRef.current) clearTimeout(roundResultTimeoutRef.current);
    };
  }, [phase, p1Reaction, p2Reaction, advanceRound]);

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

  return (
    <div className="flex h-full flex-col touch-manipulation" style={{ touchAction: "manipulation" }}>
      <div className="flex flex-1 flex-col min-h-0">
        <div className="shrink-0 flex items-center justify-between gap-4 px-4 py-3 border-b border-white/10">
          <span className="font-semibold text-white">Reaction Duel ⚡</span>
          <span className="text-body-gray tabular-nums">
            Round {phase === "match_over" ? TOTAL_ROUNDS : round}/{TOTAL_ROUNDS}
          </span>
        </div>

        <div className="shrink-0 flex items-center justify-between gap-4 px-4 py-3 bg-white/5">
          <div className={`flex items-center gap-2 ${p1Wins >= p2Wins ? "text-teal" : "text-white"}`}>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-teal/40 to-purple/40 flex items-center justify-center text-sm font-bold text-white">
              {player1.username.charAt(0)}
            </div>
            <span className="font-medium">{player1.username}: {p1Wins}</span>
            {p1Streak >= 3 && <span className="text-amber-400 text-xs">🔥 {p1Streak} streak!</span>}
          </div>
          <span className="text-body-gray font-medium">VS</span>
          <div className={`flex items-center gap-2 ${p2Wins >= p1Wins ? "text-purple-400" : "text-white"}`}>
            <span className="font-medium">{player2.username}: {p2Wins}</span>
            {isPlayer2Bot && <span className="text-xs text-body-gray">🤖</span>}
            {p2Streak >= 3 && <span className="text-amber-400 text-xs">🔥 {p2Streak} streak!</span>}
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple/40 to-rose-500/40 flex items-center justify-center text-sm font-bold text-white">
              {player2.username.charAt(0)}
            </div>
          </div>
        </div>

        <div className="shrink-0 px-4 pb-2 flex items-center gap-1">
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

        <div className="shrink-0 h-2 mx-4 mb-2 flex rounded-full overflow-hidden bg-white/10">
          <div className="h-full bg-teal transition-all duration-300" style={{ width: `${progressP1 * 50}%` }} />
          <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${progressP2 * 50}%` }} />
        </div>

        <div
          ref={gameAreaRef}
          className="flex-1 min-h-[300px] mx-4 mb-4 rounded-2xl border border-white/10 flex items-center justify-center relative overflow-hidden select-none"
          style={{
            backgroundColor: phase === "target" ? "#151821" : "#0D0F14",
            minWidth: 0,
            minHeight: 400,
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
                    color: countdownN === 3 ? "#fff" : countdownN === 2 ? "#EAB308" : "#00E5C7",
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

        {(phase === "round_result" || phase === "tapped") && p1Reaction !== null && p2Reaction !== null && (
          <div className="shrink-0 mx-4 mb-4 p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-4">
            <div className={`text-center ${getRoundWinner(p1Reaction, p2Reaction) === "player1" ? "text-teal font-semibold" : "text-body-gray opacity-70"}`}>
              <p className="text-sm">{player1.username}</p>
              <p className="text-lg tabular-nums">
                {p1Reaction === "false_start" || p1Reaction === "timeout"
                  ? (p1Reaction === "false_start" ? "FALSE START" : "TIMEOUT")
                  : `${p1Reaction}ms`}
              </p>
              {typeof p1Reaction === "number" && p1Reaction < 5000 && (
                <p className="text-xs" style={{ color: reactionLabel(p1Reaction).color }}>{reactionLabel(p1Reaction).text}</p>
              )}
              {getRoundWinner(p1Reaction, p2Reaction) === "player1" && <span className="text-teal">✓</span>}
            </div>
            <span className="text-body-gray font-medium">VS</span>
            <div className={`text-center ${getRoundWinner(p1Reaction, p2Reaction) === "player2" ? "text-purple-400 font-semibold" : "text-body-gray opacity-70"}`}>
              <p className="text-sm">{player2.username}{isPlayer2Bot ? " 🤖" : ""}</p>
              <p className="text-lg tabular-nums">
                {p2Reaction === "false_start" || p2Reaction === "timeout"
                  ? (p2Reaction === "false_start" ? "FALSE START" : "TIMEOUT")
                  : `${p2Reaction}ms`}
              </p>
              {typeof p2Reaction === "number" && <p className="text-xs" style={{ color: reactionLabel(p2Reaction).color }}>{reactionLabel(p2Reaction).text}</p>}
              {getRoundWinner(p1Reaction, p2Reaction) === "player2" && <span className="text-purple-400">✓</span>}
            </div>
          </div>
        )}

        {phase === "match_over" && (
          <div className="shrink-0 mx-4 mb-4 p-6 rounded-xl bg-white/5 border border-white/10 space-y-4">
            <h3 className="text-xl font-bold text-white text-center">Match Over</h3>
            <div className="flex justify-between gap-4">
              <div className="text-center">
                <p className="text-teal font-semibold">{player1.username}</p>
                <p className="text-2xl font-bold text-white">{p1Wins} wins</p>
                <p className="text-sm text-body-gray">Avg: {roundHistory.length ? Math.round(p1TotalMs / roundHistory.length) : 0}ms</p>
              </div>
              <div className="text-center">
                <p className="text-purple-400 font-semibold">{player2.username}</p>
                <p className="text-2xl font-bold text-white">{p2Wins} wins</p>
                <p className="text-sm text-body-gray">Avg: {roundHistory.length ? Math.round(p2TotalMs / roundHistory.length) : 0}ms</p>
              </div>
            </div>
            <div className="text-sm text-body-gray space-y-1 max-h-32 overflow-y-auto">
              {roundHistory.map((r, i) => (
                <div key={i} className="flex justify-between">
                  <span>{typeof r.p1 === "number" ? `${r.p1}ms` : r.p1}</span>
                  <span>Round {i + 1}</span>
                  <span>{typeof r.p2 === "number" ? `${r.p2}ms` : r.p2}</span>
                </div>
              ))}
            </div>
            {roundHistory.length > 0 && (() => {
              const times = roundHistory.flatMap((r) => [
                ...(typeof r.p1 === "number" ? [r.p1] : []),
                ...(typeof r.p2 === "number" ? [r.p2] : []),
              ]);
              const best = times.length ? Math.min(...times) : 0;
              return (
                <p className="text-center text-teal text-sm">
                  Best: {best}ms 🔥
                </p>
              );
            })()}
          </div>
        )}
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
