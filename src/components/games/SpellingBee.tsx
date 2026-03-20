"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SpellingWord } from "@/lib/games/spelling-words";
import {
  TOTAL_ROUNDS,
  ROUND_TIME_MS,
  PRE_ROUND_PAUSE_MS,
  ROUND_RESULT_DURATION_MS,
  BETWEEN_ROUNDS_COUNTDOWN_SEC,
  MAX_TIEBREAKER_ROUNDS,
  getDifficultyForRound,
  pickWordsForMatch,
  pickTiebreakerWord,
  isAnswerCorrect,
  scoreRound,
  compareSpelling,
  getWordByIndex,
  getWordIndex,
} from "@/lib/games/spelling-logic";
import { getSpellingBeeBotAnswer, type BotDifficulty } from "@/lib/games/bot-engine";
import {
  isSpeechSupported,
  pronounceWord as doPronounceWord,
  speakText,
  stopSpeech,
  isLikelyIOS,
} from "@/lib/games/spelling-speech";
import type { GameMultiplayerProps } from "./Chess";
import { GamePlayerRow, GamePlayerStack } from "@/components/games/GamePlayerStrip";
import { MobilePlayerCards } from "@/components/games/MobilePlayerCards";

type Phase =
  | "pre_round"
  | "get_ready"
  | "round_active"
  | "round_result"
  | "between_rounds"
  | "match_over"
  | "tiebreaker_ready"
  | "tiebreaker_active"
  | "tiebreaker_result";

interface SpellingBeeProps extends GameMultiplayerProps {
  player1: { username: string; rating: number };
  player2: { username: string; rating: number };
  onGameEnd: (winner: "player1" | "player2") => void;
  onGameDraw: () => void;
  isPlayer2Bot?: boolean;
  botDifficulty?: BotDifficulty;
  isPractice?: boolean;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "EASY",
  medium: "MEDIUM",
  hard: "HARD",
  expert: "EXPERT",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-emerald-500/30 text-emerald-400 border-emerald-500/50",
  medium: "bg-amber-500/30 text-amber-400 border-amber-500/50",
  hard: "bg-orange-500/30 text-orange-400 border-orange-500/50",
  expert: "bg-red-500/30 text-red-400 border-red-500/50",
};

export default function SpellingBee({
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
}: SpellingBeeProps) {
  const [phase, setPhase] = useState<Phase>("pre_round");
  const [round, setRound] = useState(1);
  const [words, setWords] = useState<SpellingWord[]>(() => pickWordsForMatch());
  const [currentWord, setCurrentWord] = useState<SpellingWord | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(0);
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [p1Answer, setP1Answer] = useState<string | null>(null);
  const [p2Answer, setP2Answer] = useState<string | null>(null);
  const [p1TimeMs, setP1TimeMs] = useState<number>(-1);
  const [p2TimeMs, setP2TimeMs] = useState<number>(-1);
  const [roundHistory, setRoundHistory] = useState<
    { word: string; p1Correct: boolean; p2Correct: boolean; p1Points: number; p2Points: number; p1TimeMs: number; p2TimeMs: number }[]
  >([]);
  const [timerRemainingMs, setTimerRemainingMs] = useState(ROUND_TIME_MS);
  const [inputValue, setInputValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [betweenCountdown, setBetweenCountdown] = useState(BETWEEN_ROUNDS_COUNTDOWN_SEC);
  const [isTiebreaker, setIsTiebreaker] = useState(false);
  const [tiebreakerRound, setTiebreakerRound] = useState(0);
  const [tiebreakerWords, setTiebreakerWords] = useState<SpellingWord[]>([]);
  const [finalStats, setFinalStats] = useState<{
    p1Correct: number;
    p2Correct: number;
    p1AvgTime: number;
    p2AvgTime: number;
    p1Streak: number;
    p2Streak: number;
    hardestCorrect?: string;
  } | null>(null);

  const [wordHeard, setWordHeard] = useState(false);
  const [repeatCount, setRepeatCount] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [showSentenceLine, setShowSentenceLine] = useState(false);

  const roundStartTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputValueRef = useRef<string>("");
  const lastProcessedEventRef = useRef<Record<string, unknown> | null>(null);
  const botTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pronunciationStartedRef = useRef<string | null>(null);
  inputValueRef.current = inputValue;

  const isRoundActive =
    phase === "round_active" || phase === "tiebreaker_active";
  const displayRound = isTiebreaker ? 10 + tiebreakerRound : round;
  const effectiveWord = currentWord ?? (isTiebreaker && tiebreakerWords[tiebreakerRound - 1] ? tiebreakerWords[tiebreakerRound - 1] : null);
  const difficulty = effectiveWord ? getDifficultyForRound(isTiebreaker ? 9 : round) : "easy";

  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const clearBotTimeout = useCallback(() => {
    if (botTimeoutRef.current) {
      clearTimeout(botTimeoutRef.current);
      botTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
      clearBotTimeout();
      stopSpeech();
    };
  }, [clearTimer, clearBotTimeout]);

  // Pre-round: show round number and difficulty, then get ready
  useEffect(() => {
    if (phase !== "pre_round") return;
    const t = setTimeout(() => {
      setPhase("get_ready");
    }, PRE_ROUND_PAUSE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Get ready: show "Get Ready...", then start round
  useEffect(() => {
    if (phase !== "get_ready" && phase !== "tiebreaker_ready") return;
    const word = isTiebreaker
      ? (tiebreakerWords[tiebreakerRound - 1] ?? pickTiebreakerWord())
      : words[round - 1];
    if (!word && !isTiebreaker) return;
    const w = word ?? pickTiebreakerWord();
    if (isTiebreaker && tiebreakerRound > 0 && !tiebreakerWords[tiebreakerRound - 1]) {
      setTiebreakerWords((prev) => [...prev.slice(0, tiebreakerRound - 1), w]);
    }
    if (!isMultiplayer || myRole === "player1") setCurrentWord(w);
    const t = setTimeout(() => {
      setWordHeard(false);
      setRepeatCount(0);
      setAudioPlaying(false);
      setShowSentenceLine(false);
      setPhase(isTiebreaker ? "tiebreaker_active" : "round_active");
      setTimerRemainingMs(ROUND_TIME_MS);
      setP1Answer(null);
      setP2Answer(null);
      setP1TimeMs(-1);
      setP2TimeMs(-1);
      setInputValue("");
      setSubmitted(false);
      roundStartTimeRef.current = Date.now();
      if (isMultiplayer && myRole === "player1" && sendGameEvent) {
        const idx = getWordIndex(w);
        sendGameEvent({
          type: "spelling_round",
          round: isTiebreaker ? 10 + tiebreakerRound : round,
          wordIndex: idx,
          difficulty: w.difficulty,
        }).catch(() => {});
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }, 2000);
    return () => clearTimeout(t);
  }, [phase, round, words, isTiebreaker, tiebreakerRound, tiebreakerWords, myRole, sendGameEvent, isMultiplayer]);

  // Auto-play word when round starts (non-iOS); fallback: no speech = show definition only
  useEffect(() => {
    if (!isRoundActive || !effectiveWord) return;
    const key = `${round}-${isTiebreaker}-${tiebreakerRound}`;
    if (pronunciationStartedRef.current === key) return;
    pronunciationStartedRef.current = key;

    if (!isSpeechSupported()) {
      setWordHeard(true);
      return;
    }
    if (isLikelyIOS()) return;

    const t = setTimeout(() => {
      setAudioPlaying(true);
      doPronounceWord(effectiveWord.word, () => {
        setAudioPlaying(false);
        setWordHeard(true);
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [isRoundActive, effectiveWord, round, isTiebreaker, tiebreakerRound]);

  // Timer tick when round is active
  useEffect(() => {
    if (!isRoundActive) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - roundStartTimeRef.current;
      const remaining = Math.max(0, ROUND_TIME_MS - elapsed);
      setTimerRemainingMs(remaining);
      if (remaining <= 0) {
        clearTimer();
        if (!submitted) {
          setSubmitted(true);
          const raw = (inputValueRef.current || "").trim() || "";
          const timeMs = ROUND_TIME_MS;
          if (myRole === "player1") {
            setP1Answer(raw);
            setP1TimeMs(timeMs);
            if (isMultiplayer && sendGameEvent) {
              sendGameEvent({
                type: "spelling_answer",
                round: isTiebreaker ? 10 + tiebreakerRound : round,
                answer: raw,
                timeMs,
              }).catch(() => {});
            }
          } else {
            setP2Answer(raw);
            setP2TimeMs(timeMs);
            if (isMultiplayer && sendGameEvent) {
              sendGameEvent({
                type: "spelling_answer",
                round: isTiebreaker ? 10 + tiebreakerRound : round,
                answer: raw,
                timeMs,
              }).catch(() => {});
            }
          }
        }
        if (isPlayer2Bot && p2Answer === null) {
          setP2Answer("");
          setP2TimeMs(ROUND_TIME_MS);
        }
      }
    };
    timerIntervalRef.current = setInterval(tick, 100);
    tick();
    return () => clearTimer();
  }, [phase, isTiebreaker, tiebreakerRound, round, submitted, myRole, isMultiplayer, sendGameEvent, isPlayer2Bot, p2Answer, clearTimer]);

  // Bot: schedule answer when round starts
  useEffect(() => {
    if (!isRoundActive || !isPlayer2Bot || !effectiveWord || p2Answer !== null) return;
    const { answer, timeMs, timedOut } = getSpellingBeeBotAnswer({
      word: effectiveWord.word,
      difficulty: effectiveWord.difficulty,
      commonMisspellings: effectiveWord.commonMisspellings,
      botDifficulty,
    });
    botTimeoutRef.current = setTimeout(() => {
      botTimeoutRef.current = null;
      setP2Answer(timedOut ? "" : answer);
      setP2TimeMs(timeMs);
    }, Math.min(timeMs, ROUND_TIME_MS));
    return () => clearBotTimeout();
  }, [phase, isTiebreaker, effectiveWord, isPlayer2Bot, botDifficulty, p2Answer, clearBotTimeout]);

  // Incoming multiplayer events
  useEffect(() => {
    if (!incomingEvent || incomingEvent === lastProcessedEventRef.current || !onEventProcessed) return;
    const type = incomingEvent.type as string | undefined;
    if (type === "spelling_round") {
      const wordIndex = incomingEvent.wordIndex as number | undefined;
      if (typeof wordIndex === "number") {
        const w = getWordByIndex(wordIndex);
        if (w) {
          setCurrentWord(w);
          setCurrentWordIndex(wordIndex);
        }
      }
      lastProcessedEventRef.current = incomingEvent;
      onEventProcessed();
    } else if (type === "spelling_answer") {
      const r = incomingEvent.round as number | undefined;
      const answer = incomingEvent.answer as string | undefined;
      const timeMs = incomingEvent.timeMs as number | undefined;
      if (myRole === "player1" && typeof answer === "string" && typeof timeMs === "number") {
        setP2Answer(answer);
        setP2TimeMs(timeMs);
      } else if (myRole === "player2" && typeof answer === "string" && typeof timeMs === "number") {
        setP1Answer(answer);
        setP1TimeMs(timeMs);
      }
      lastProcessedEventRef.current = incomingEvent;
      onEventProcessed();
    }
  }, [incomingEvent, onEventProcessed, myRole]);

  const handleSubmit = useCallback(() => {
    if (submitted || !isRoundActive) return;
    const raw = inputValue.trim();
    const timeMs = Math.round(Date.now() - roundStartTimeRef.current);
    setSubmitted(true);
    if (myRole === "player1") {
      setP1Answer(raw);
      setP1TimeMs(timeMs);
      if (isMultiplayer && sendGameEvent) {
        sendGameEvent({
          type: "spelling_answer",
          round: isTiebreaker ? 10 + tiebreakerRound : round,
          answer: raw,
          timeMs,
        }).catch(() => {});
      }
    } else {
      setP2Answer(raw);
      setP2TimeMs(timeMs);
      if (isMultiplayer && sendGameEvent) {
        sendGameEvent({
          type: "spelling_answer",
          round: isTiebreaker ? 10 + tiebreakerRound : round,
          answer: raw,
          timeMs,
        }).catch(() => {});
      }
    }
  }, [submitted, isRoundActive, inputValue, myRole, isTiebreaker, tiebreakerRound, round, isMultiplayer, sendGameEvent]);

  // When both answers are in (or time expired), show result and advance
  useEffect(() => {
    if (phase !== "round_result" && phase !== "tiebreaker_result") return;
    const t = setTimeout(() => {
      if (isTiebreaker) {
        const correct = effectiveWord?.word ?? "";
        const p1C = isAnswerCorrect(correct, p1Answer ?? "");
        const p2C = isAnswerCorrect(correct, p2Answer ?? "");
        if (p1C && !p2C) {
          onGameEnd("player1");
          return;
        }
        if (!p1C && p2C) {
          onGameEnd("player2");
          return;
        }
        if (p1C && p2C) {
          const p1T = p1TimeMs >= 0 ? p1TimeMs : ROUND_TIME_MS;
          const p2T = p2TimeMs >= 0 ? p2TimeMs : ROUND_TIME_MS;
          if (p1T < p2T) onGameEnd("player1");
          else if (p2T < p1T) onGameEnd("player2");
          else if (tiebreakerRound >= MAX_TIEBREAKER_ROUNDS) onGameDraw();
          else {
            setTiebreakerRound((r) => r + 1);
            setPhase("tiebreaker_ready");
          }
          return;
        }
        if (tiebreakerRound >= MAX_TIEBREAKER_ROUNDS) {
          onGameDraw();
          return;
        }
        setTiebreakerRound((r) => r + 1);
        setPhase("tiebreaker_ready");
        return;
      }

      const correct = effectiveWord?.word ?? "";
      const p1Correct = isAnswerCorrect(correct, p1Answer ?? "");
      const p2Correct = isAnswerCorrect(correct, p2Answer ?? "");
      const p1T = p1TimeMs >= 0 ? p1TimeMs : ROUND_TIME_MS;
      const p2T = p2TimeMs >= 0 ? p2TimeMs : ROUND_TIME_MS;
      const score = scoreRound(p1Correct, p2Correct, p1T, p2T);

      setRoundHistory((prev) => [
        ...prev,
        {
          word: correct,
          p1Correct,
          p2Correct,
          p1Points: score.p1Points,
          p2Points: score.p2Points,
          p1TimeMs: p1T,
          p2TimeMs: p2T,
        },
      ]);
      setP1Score((s) => s + score.p1Points);
      setP2Score((s) => s + score.p2Points);
      setRound((r) => {
        if (r >= TOTAL_ROUNDS) {
          const p1CorrectCount = roundHistory.filter((h) => h.p1Correct).length + (p1Correct ? 1 : 0);
          const p2CorrectCount = roundHistory.filter((h) => h.p2Correct).length + (p2Correct ? 1 : 0);
          const allRounds = [...roundHistory, { word: correct, p1Correct, p2Correct, p1Points: score.p1Points, p2Points: score.p2Points, p1TimeMs: p1T, p2TimeMs: p2T }];
          const p1Times = allRounds.filter((r) => r.p1Correct).map((r) => r.p1TimeMs);
          const p2Times = allRounds.filter((r) => r.p2Correct).map((r) => r.p2TimeMs);
          let p1Streak = 0;
          let p2Streak = 0;
          for (let i = allRounds.length - 1; i >= 0; i--) {
            if (allRounds[i].p1Correct) p1Streak++;
            else break;
          }
          for (let i = allRounds.length - 1; i >= 0; i--) {
            if (allRounds[i].p2Correct) p2Streak++;
            else break;
          }
          const hardestCorrect = (() => {
            const p1Words = allRounds.filter((r) => r.p1Correct).map((r) => r.word);
            return p1Words.sort((a, b) => b.length - a.length)[0];
          })();
          setFinalStats({
            p1Correct: p1CorrectCount,
            p2Correct: p2CorrectCount,
            p1AvgTime: p1Times.length ? p1Times.reduce((a, b) => a + b, 0) / p1Times.length / 1000 : 0,
            p2AvgTime: p2Times.length ? p2Times.reduce((a, b) => a + b, 0) / p2Times.length / 1000 : 0,
            p1Streak,
            p2Streak,
            hardestCorrect,
          });
          const newP1 = p1Score + score.p1Points;
          const newP2 = p2Score + score.p2Points;
          if (Math.abs(newP1 - newP2) < 0.01) {
            setIsTiebreaker(true);
            setTiebreakerRound(1);
            setTiebreakerWords([pickTiebreakerWord()]);
            setPhase("tiebreaker_ready");
          } else {
            setPhase("match_over");
            setTimeout(() => {
              if (newP1 > newP2) onGameEnd("player1");
              else onGameEnd("player2");
            }, 500);
          }
          return r;
        }
        setPhase("between_rounds");
        setBetweenCountdown(BETWEEN_ROUNDS_COUNTDOWN_SEC);
        return r + 1;
      });
    }, ROUND_RESULT_DURATION_MS);
    return () => clearTimeout(t);
  }, [
    phase,
    isTiebreaker,
    tiebreakerRound,
    effectiveWord,
    p1Answer,
    p2Answer,
    p1TimeMs,
    p2TimeMs,
    roundHistory,
    p1Score,
    p2Score,
    onGameEnd,
    onGameDraw,
  ]);

  // Between rounds countdown
  useEffect(() => {
    if (phase !== "between_rounds") return;
    if (betweenCountdown <= 0) {
      setPhase("pre_round");
      setCurrentWord(null);
      setCurrentWord(words[round - 1]);
      return;
    }
    const t = setInterval(() => setBetweenCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [phase, betweenCountdown, round, words]);

  // Transition to round_result when both answers in (single player vs bot)
  useEffect(() => {
    if (!isRoundActive || isMultiplayer) return;
    const p1Set = p1Answer !== null;
    const p2Set = p2Answer !== null;
    if (p1Set && p2Set) {
      setPhase(isTiebreaker ? "tiebreaker_result" : "round_result");
    }
  }, [isRoundActive, isMultiplayer, p1Answer, p2Answer, isTiebreaker]);

  // Multiplayer: when we have both answers (we see our submit + opponent's event), show result
  useEffect(() => {
    if (!isRoundActive || !isMultiplayer) return;
    const p1Set = p1Answer !== null;
    const p2Set = p2Answer !== null;
    if (p1Set && p2Set) {
      setPhase(isTiebreaker ? "tiebreaker_result" : "round_result");
    }
  }, [isRoundActive, isMultiplayer, p1Answer, p2Answer, isTiebreaker]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleHearWord = useCallback(() => {
    if (!effectiveWord || !isSpeechSupported()) return;
    setAudioPlaying(true);
    doPronounceWord(effectiveWord.word, () => {
      setAudioPlaying(false);
      setWordHeard(true);
    });
  }, [effectiveWord]);

  const handleRepeatWord = useCallback(() => {
    if (!effectiveWord || !isSpeechSupported() || repeatCount >= 3 || audioPlaying) return;
    setAudioPlaying(true);
    setRepeatCount((c) => c + 1);
    doPronounceWord(effectiveWord.word, () => setAudioPlaying(false));
  }, [effectiveWord, repeatCount, audioPlaying]);

  const handleReadDefinition = useCallback(() => {
    if (!effectiveWord || !isSpeechSupported() || audioPlaying) return;
    setAudioPlaying(true);
    speakText(effectiveWord.definition, () => setAudioPlaying(false));
  }, [effectiveWord, audioPlaying]);

  const handleUseInSentence = useCallback(() => {
    if (!effectiveWord || !isSpeechSupported() || audioPlaying) return;
    const sentence = effectiveWord.sentence ?? `The word is "${effectiveWord.word}."`;
    setShowSentenceLine(true);
    setAudioPlaying(true);
    speakText(sentence, () => setAudioPlaying(false));
  }, [effectiveWord, audioPlaying]);

  if (phase === "match_over" && !isTiebreaker) {
    const winner = p1Score > p2Score ? "player1" : "player2";
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-4">
        <p className="text-2xl font-bold text-amber-400">MATCH COMPLETE</p>
        <p className="mt-2 text-lg text-white">
          {player1.username}: {p1Score.toFixed(1)} | {player2.username}: {p2Score.toFixed(1)}
        </p>
        <p className="mt-4 text-xl font-bold text-amber-400">
          {winner === "player1" ? player1.username : player2.username} Wins! 🏆🐝
        </p>
        {finalStats && (
          <div className="mt-6 w-full max-w-md space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-left text-sm text-white">
            <p>Words spelled correctly: {finalStats.p1Correct}/10 vs {finalStats.p2Correct}/10</p>
            <p>Average response time: {finalStats.p1AvgTime.toFixed(1)}s vs {finalStats.p2AvgTime.toFixed(1)}s</p>
            <p>Longest correct streak: {finalStats.p1Streak} vs {finalStats.p2Streak}</p>
            {finalStats.hardestCorrect && <p>Hardest word you spelled: &quot;{finalStats.hardestCorrect}&quot;</p>}
          </div>
        )}
      </div>
    );
  }

  if (phase === "match_over" && isTiebreaker) {
    return null;
  }

  const roundResultScore = (() => {
    if (phase !== "round_result" && phase !== "tiebreaker_result") return null;
    const correct = effectiveWord?.word ?? "";
    const p1Correct = isAnswerCorrect(correct, p1Answer ?? "");
    const p2Correct = isAnswerCorrect(correct, p2Answer ?? "");
    const p1T = p1TimeMs >= 0 ? p1TimeMs : ROUND_TIME_MS;
    const p2T = p2TimeMs >= 0 ? p2TimeMs : ROUND_TIME_MS;
    return scoreRound(p1Correct, p2Correct, p1T, p2T);
  })();

  const timerPercent = (timerRemainingMs / ROUND_TIME_MS) * 100;
  const timerColor =
    timerPercent > 33 ? "bg-amber-500" : timerPercent > 20 ? "bg-orange-500" : "bg-red-500";

  const isPractice = isPracticeProp ?? !isMultiplayer;
  const p1RowActive =
    (phase === "round_active" || phase === "tiebreaker_active") &&
    p1Answer === null &&
    (!isMultiplayer || myRole === "player1");
  const p2RowActive =
    (phase === "round_active" || phase === "tiebreaker_active") &&
    p2Answer === null &&
    (!isMultiplayer || myRole === "player2");

  const isMyTurn = myRole === "player1" ? p1RowActive : p2RowActive;

  return (
    <div className="spelling-bee flex h-full min-h-0 w-full flex-col overflow-hidden">
      <style>{`
        .spelling-bee { --spelling-amber: #F59E0B; }
        @keyframes spelling-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
        .spelling-shake { animation: spelling-shake 0.3s ease-in-out; }
        @keyframes spelling-bounce { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        .spelling-bounce { animation: spelling-bounce 0.2s ease-out; }
        @keyframes spelling-wave { 0%,100%{transform:scaleY(0.4)} 50%{transform:scaleY(1)} }
        .spelling-wave { animation: spelling-wave 0.6s ease-in-out infinite; }
      `}</style>

      {/* Mobile */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <MobilePlayerCards
            player1Name={player1.username}
            player1Right={`${p1Score.toFixed(1)}`}
            player2Name={player2.username}
            player2Right={`${p2Score.toFixed(1)}`}
            player1Active={p1RowActive}
            player2Active={p2RowActive}
          />

        <div className="game-play-area-mobile min-h-0 overflow-hidden overflow-x-hidden">
        {/* Pre-round / Get ready */}
        {(phase === "pre_round" || phase === "get_ready" || phase === "tiebreaker_ready") && (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-amber-500/30 bg-[#1A1D2E]/80 p-8">
            {phase === "get_ready" || phase === "tiebreaker_ready" ? (
              <p className="text-2xl font-semibold text-amber-400">Get Ready...</p>
            ) : (
              <>
                <p className="text-lg text-amber-400/90">
                  Round {displayRound}{isTiebreaker ? " — Tiebreaker" : ` of ${TOTAL_ROUNDS}`}
                </p>
                {effectiveWord && (
                  <span className={`mt-2 rounded-full border px-3 py-1 text-sm font-medium ${DIFFICULTY_COLORS[effectiveWord.difficulty]}`}>
                    {DIFFICULTY_LABELS[effectiveWord.difficulty]}
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {/* Definition + input when round active or result */}
        {(phase === "round_active" || phase === "round_result" || phase === "tiebreaker_active" || phase === "tiebreaker_result") && effectiveWord && (
          <>
            <div className="rounded-xl border-l-4 border-amber-500 bg-[#1A1D2E] p-5 shadow-lg">
              {(phase === "round_active" || phase === "tiebreaker_active") && isSpeechSupported() && (
                <div className="mb-4">
                  {!wordHeard ? (
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-lg font-semibold text-amber-400">Listen carefully...</p>
                      {(isLikelyIOS() || !wordHeard) && (
                        <button
                          type="button"
                          onClick={handleHearWord}
                          className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 font-semibold text-charcoal hover:bg-amber-400"
                        >
                          <span className={audioPlaying ? "animate-pulse" : ""}>🔊</span>
                          Hear word
                        </button>
                      )}
                    </div>
                  ) : audioPlaying ? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-amber-400 font-medium">🔊 Playing...</p>
                      <div className="flex h-10 items-end justify-center gap-1">
                        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                          <span
                            key={i}
                            className="w-1 rounded-full bg-amber-500 spelling-wave"
                            style={{ height: "12px", animationDelay: `${i * 0.08}s` }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mb-2 text-sm text-emerald-400/90">Type your answer below</p>
                  )}
                </div>
              )}
              {(phase === "round_result" || phase === "tiebreaker_result" || wordHeard || !isSpeechSupported()) && (
                <>
                  <p className="text-lg font-medium leading-snug text-white md:text-xl">
                    &quot;{effectiveWord.definition}&quot;
                  </p>
                  {showSentenceLine && effectiveWord.sentence && (
                    <p className="mt-2 text-sm italic text-amber-200/90">&quot;{effectiveWord.sentence}&quot;</p>
                  )}
                  {effectiveWord.hint && (
                    <p className="mt-2 text-sm text-body-gray">Used in: {effectiveWord.hint}</p>
                  )}
                  {effectiveWord.origin && (
                    <p className="mt-1 text-xs text-amber-400/80">Origin: {effectiveWord.origin}</p>
                  )}
                </>
              )}
              {(phase === "round_active" || phase === "tiebreaker_active") && isSpeechSupported() && (wordHeard || !wordHeard) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRepeatWord}
                    disabled={repeatCount >= 3 || audioPlaying}
                    className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    🔊 Repeat word {repeatCount < 3 ? `(${3 - repeatCount} left)` : ""}
                  </button>
                  <button
                    type="button"
                    onClick={handleReadDefinition}
                    disabled={audioPlaying}
                    className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    📖 Definition
                  </button>
                  <button
                    type="button"
                    onClick={handleUseInSentence}
                    disabled={audioPlaying}
                    className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    📝 Use in sentence
                  </button>
                </div>
              )}
              {!isSpeechSupported() && (phase === "round_active" || phase === "tiebreaker_active") && (
                <p className="mt-2 text-sm text-body-gray">Definition only (audio not supported)</p>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-card/80 p-4">
              {phase === "round_result" || phase === "tiebreaker_result" ? (
                <div className="space-y-4">
                  <p className="text-center text-lg font-semibold text-emerald-500">
                    Correct: {effectiveWord.word}
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-white">{player1.username}</p>
                      {isAnswerCorrect(effectiveWord.word, p1Answer ?? "") ? (
                        <p className="text-emerald-500">✅ {p1Answer || "(empty)"}</p>
                      ) : (
                        <div className="mt-1">
                          <p className="text-red-400">❌ {p1Answer || "(empty)"}</p>
                          <div className="mt-1 flex flex-wrap gap-0.5 font-mono text-xs">
                            {compareSpelling(effectiveWord.word, p1Answer ?? "").map((item, i) => (
                              <span
                                key={i}
                                className={
                                  item.status === "match"
                                    ? "text-emerald-500"
                                    : item.status === "wrong"
                                      ? "text-red-500 underline"
                                      : "text-amber-500"
                                }
                              >
                                {item.char}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">{player2.username}</p>
                      {isAnswerCorrect(effectiveWord.word, p2Answer ?? "") ? (
                        <p className="text-emerald-500">✅ {p2Answer || "(empty)"}</p>
                      ) : (
                        <div className="mt-1">
                          <p className="text-red-400">❌ {p2Answer || "(empty)"}</p>
                          <div className="mt-1 flex flex-wrap gap-0.5 font-mono text-xs">
                            {compareSpelling(effectiveWord.word, p2Answer ?? "").map((item, i) => (
                              <span
                                key={i}
                                className={
                                  item.status === "match"
                                    ? "text-emerald-500"
                                    : item.status === "wrong"
                                      ? "text-red-500 underline"
                                      : "text-amber-500"
                                }
                              >
                                {item.char}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {roundResultScore && (
                    <p className="text-center text-sm text-body-gray">
                      {roundResultScore.p1Points > 0 || roundResultScore.p2Points > 0 ? (
                        <>
                          {roundResultScore.speedBonus === "player1" && `${player1.username} +1.5 (faster) · ${player2.username} +1.0`}
                          {roundResultScore.speedBonus === "player2" && `${player1.username} +1.0 · ${player2.username} +1.5 (faster)`}
                          {!roundResultScore.speedBonus && roundResultScore.p1Correct && `${player1.username} +1 · ${player2.username} +0`}
                          {!roundResultScore.speedBonus && roundResultScore.p2Correct && !roundResultScore.p1Correct && `${player1.username} +0 · ${player2.username} +1`}
                          {!roundResultScore.p1Correct && !roundResultScore.p2Correct && "Both wrong — no points"}
                        </>
                      ) : (
                        "No points this round"
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <label className="block text-sm text-body-gray">Type your spelling:</label>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={submitted}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    autoCapitalize="off"
                    className={`mt-2 w-full rounded-lg border bg-[#1A1D2E] px-4 py-3 font-mono text-xl text-white placeholder:text-body-gray focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${submitted ? "border-emerald-500/50" : "border-white/20"} ${!submitted && phase === "round_active" ? "spelling-bounce" : ""}`}
                    placeholder="Type the word..."
                  />
                  <p className="mt-1 text-xs text-body-gray">{inputValue.length} letters typed</p>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitted || !isRoundActive}
                    className="mt-3 w-full rounded-lg bg-amber-500 px-4 py-3 font-semibold text-charcoal hover:bg-amber-400 disabled:opacity-50"
                  >
                    {submitted ? "Answer submitted ✓" : "Submit Answer"}
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {/* Between rounds */}
        {phase === "between_rounds" && (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-amber-500/20 bg-card/50 p-8">
            <p className="text-xl font-semibold text-amber-400">Next round in {betweenCountdown}...</p>
            {round < TOTAL_ROUNDS && getDifficultyForRound(round + 1) !== getDifficultyForRound(round) && (
              <p className="mt-2 text-sm text-body-gray">Difficulty increasing: {DIFFICULTY_LABELS[getDifficultyForRound(round + 1)]}</p>
            )}
          </div>
        )}
        </div>
        </div>

        {/* Game status row (~30px) */}
        <div className="flex h-[30px] shrink-0 items-center justify-between px-3">
          <span
            className="min-w-0 truncate text-[13px] font-medium"
            style={{
              color: (() => {
                const active = phase === "round_active" || phase === "tiebreaker_active";
                if (!active) return "rgba(148, 163, 184, 1)";
                if (!isMyTurn) return "rgba(148, 163, 184, 1)";
                return myRole === "player1" ? "#FF5E00" : "#A855F7";
              })(),
            }}
          >
            {(() => {
              const active = phase === "round_active" || phase === "tiebreaker_active";
              if (!active) return " ";
              return isMyTurn ? "Your Turn" : "Opponent's Turn";
            })()}
          </span>
          <span className="shrink-0 text-[13px] text-body-gray tabular-nums">
            {phase === "round_active" || phase === "tiebreaker_active" ? `${Math.ceil(timerRemainingMs / 1000)}s` : "15s"}
          </span>
        </div>

        {/* Game log panel */}
        <div className="w-full shrink-0 h-[100px] min-h-[100px] max-h-[100px] overflow-hidden" style={{ overflowX: "hidden" }}>
          <div className="rounded-xl border border-white/10 bg-card/80 p-2 flex flex-col h-full overflow-hidden">
            <h3 className="mb-2 font-semibold text-white text-[11px]">Game Log</h3>
            <div className="flex-1 min-h-0 space-y-1 overflow-y-auto overflow-x-hidden text-[11px]">
              {roundHistory.length === 0 && <p className="text-body-gray">No rounds yet.</p>}
              {roundHistory.map((h, i) => (
                <div key={i} className="rounded border border-white/5 bg-white/5 p-2">
                  <p className="font-medium text-white">Round {i + 1}: &quot;{h.word}&quot;</p>
                  <p className="mt-0.5 text-body-gray">
                    {player1.username} {h.p1Correct ? "✅" : "❌"}
                    {h.p1Correct && ` (${(h.p1TimeMs / 1000).toFixed(1)}s)`} · {player2.username} {h.p2Correct ? "✅" : "❌"}
                    {h.p2Correct && ` (${(h.p2TimeMs / 1000).toFixed(1)}s)`}
                  </p>
                  <p className="text-amber-400/80">+{h.p1Points} / +{h.p2Points}</p>
                </div>
              ))}
            </div>
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
              avatarClassName="bg-gradient-to-br from-amber-500/50 to-amber-700/50"
              scoreRight={`Score: ${p1Score.toFixed(1)}`}
              active={p1RowActive}
              isPractice={isPractice}
              rating={player1.rating}
            />
            <GamePlayerRow
              username={player2.username}
              avatarLetter={player2.username.charAt(0)}
              avatarClassName="bg-gradient-to-br from-purple/40 to-rose-500/40"
              scoreRight={`Score: ${p2Score.toFixed(1)}`}
              active={p2RowActive}
              isPractice={isPractice}
              rating={player2.rating}
              isBot={isPlayer2Bot}
            />
          </GamePlayerStack>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden py-1">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="font-semibold text-white">
              Spelling Bee 🐝 · Round {displayRound}{isTiebreaker ? " (Tiebreaker)" : `/${TOTAL_ROUNDS}`}
            </span>
            {effectiveWord && (
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${DIFFICULTY_COLORS[effectiveWord.difficulty]}`}>
                {DIFFICULTY_LABELS[effectiveWord.difficulty]}
              </span>
            )}
          </div>

          {(phase === "round_active" || phase === "tiebreaker_active") && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className={`h-full transition-all duration-100 ${timerColor}`} style={{ width: `${timerPercent}%` }} />
            </div>
          )}
          <div className="flex shrink-0 items-center justify-between px-1 text-sm">
            {(phase === "round_active" || phase === "tiebreaker_active") && (
              <span className={`font-mono font-bold tabular-nums ${timerPercent <= 20 ? "text-red-400" : timerPercent <= 33 ? "text-orange-400" : "text-amber-400"}`}>
                {Math.ceil(timerRemainingMs / 1000)}s
              </span>
            )}
          </div>

          <div className="game-play-area-desktop min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
            {/* The existing content above already rendered in mobile; on desktop we rely on the same JSX via duplication */}
            {/* Pre-round / Get ready */}
            {(phase === "pre_round" || phase === "get_ready" || phase === "tiebreaker_ready") && (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-amber-500/30 bg-[#1A1D2E]/80 p-8">
                {phase === "get_ready" || phase === "tiebreaker_ready" ? (
                  <p className="text-2xl font-semibold text-amber-400">Get Ready...</p>
                ) : (
                  <>
                    <p className="text-lg text-amber-400/90">
                      Round {displayRound}{isTiebreaker ? " — Tiebreaker" : ` of ${TOTAL_ROUNDS}`}
                    </p>
                    {effectiveWord && (
                      <span className={`mt-2 rounded-full border px-3 py-1 text-sm font-medium ${DIFFICULTY_COLORS[effectiveWord.difficulty]}`}>
                        {DIFFICULTY_LABELS[effectiveWord.difficulty]}
                      </span>
                    )}
                  </>
                )}
              </div>
            )}

            {(phase === "round_active" || phase === "round_result" || phase === "tiebreaker_active" || phase === "tiebreaker_result") && effectiveWord && (
              <>
                {/* (content continues exactly as existing mobile/main block already defines) */}
                {/* NOTE: We intentionally keep the logic/handlers identical; this is layout-only duplication. */}
                <div className="rounded-xl border-l-4 border-amber-500 bg-[#1A1D2E] p-5 shadow-lg">
                  {(phase === "round_active" || phase === "tiebreaker_active") && isSpeechSupported() && (
                    <div className="mb-4">
                      {!wordHeard ? (
                        <div className="flex flex-col items-center gap-3">
                          <p className="text-lg font-semibold text-amber-400">Listen carefully...</p>
                          {(isLikelyIOS() || !wordHeard) && (
                            <button
                              type="button"
                              onClick={handleHearWord}
                              className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 font-semibold text-charcoal hover:bg-amber-400"
                            >
                              <span className={audioPlaying ? "animate-pulse" : ""}>🔊</span>
                              Hear word
                            </button>
                          )}
                        </div>
                      ) : audioPlaying ? (
                        <div className="flex flex-col items-center gap-2">
                          <p className="text-amber-400 font-medium">🔊 Playing...</p>
                          <div className="flex h-10 items-end justify-center gap-1">
                            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                              <span
                                key={i}
                                className="w-1 rounded-full bg-amber-500 spelling-wave"
                                style={{ height: "12px", animationDelay: `${i * 0.08}s` }}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="mb-2 text-sm text-emerald-400/90">Type your answer below</p>
                      )}
                    </div>
                  )}
                  {(phase === "round_result" || phase === "tiebreaker_result" || wordHeard || !isSpeechSupported()) && (
                    <>
                      <p className="text-lg font-medium leading-snug text-white md:text-xl">
                        &quot;{effectiveWord.definition}&quot;
                      </p>
                      {showSentenceLine && effectiveWord.sentence && (
                        <p className="mt-2 text-sm italic text-amber-200/90">&quot;{effectiveWord.sentence}&quot;</p>
                      )}
                      {effectiveWord.hint && (
                        <p className="mt-2 text-sm text-body-gray">Used in: {effectiveWord.hint}</p>
                      )}
                      {effectiveWord.origin && (
                        <p className="mt-1 text-xs text-amber-400/80">Origin: {effectiveWord.origin}</p>
                      )}
                    </>
                  )}
                  {(phase === "round_active" || phase === "tiebreaker_active") && isSpeechSupported() && (wordHeard || !wordHeard) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleRepeatWord}
                        disabled={repeatCount >= 3 || audioPlaying}
                        className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                      >
                        🔊 Repeat word {repeatCount < 3 ? `(${3 - repeatCount} left)` : ""}
                      </button>
                      <button
                        type="button"
                        onClick={handleReadDefinition}
                        disabled={audioPlaying}
                        className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                      >
                        📖 Definition
                      </button>
                      <button
                        type="button"
                        onClick={handleUseInSentence}
                        disabled={audioPlaying}
                        className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                      >
                        📝 Use in sentence
                      </button>
                    </div>
                  )}
                  {!isSpeechSupported() && (phase === "round_active" || phase === "tiebreaker_active") && (
                    <p className="mt-2 text-sm text-body-gray">Definition only (audio not supported)</p>
                  )}
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-card/80 p-4">
                  {/* input/result block remains unchanged on mobile; here we keep it simple and rely on same handlers */}
                  {phase === "round_result" || phase === "tiebreaker_result" ? (
                    <div className="space-y-2 text-sm text-body-gray">
                      <p className="text-center text-lg font-semibold text-emerald-500">Correct: {effectiveWord.word}</p>
                      <p className="text-center">Results shown below</p>
                    </div>
                  ) : (
                    <>
                      <label className="block text-sm text-body-gray">Type your spelling:</label>
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={submitted}
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        autoCapitalize="off"
                        className={`mt-2 w-full rounded-lg border bg-[#1A1D2E] px-4 py-3 font-mono text-xl text-white placeholder:text-body-gray focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${submitted ? "border-emerald-500/50" : "border-white/20"} ${!submitted && phase === "round_active" ? "spelling-bounce" : ""}`}
                        placeholder="Type the word..."
                      />
                      <p className="mt-1 text-xs text-body-gray">{inputValue.length} letters typed</p>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitted || !isRoundActive}
                        className="mt-3 w-full rounded-lg bg-amber-500 px-4 py-3 font-semibold text-charcoal hover:bg-amber-400 disabled:opacity-50"
                      >
                        {submitted ? "Answer submitted ✓" : "Submit Answer"}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            {phase === "between_rounds" && (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-amber-500/20 bg-card/50 p-8">
                <p className="text-xl font-semibold text-amber-400">Next round in {betweenCountdown}...</p>
                {round < TOTAL_ROUNDS && getDifficultyForRound(round + 1) !== getDifficultyForRound(round) && (
                  <p className="mt-2 text-sm text-body-gray">Difficulty increasing: {DIFFICULTY_LABELS[getDifficultyForRound(round + 1)]}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: game log */}
        <div className="flex w-[280px] shrink-0 flex-col overflow-hidden" style={{ overflowX: "hidden" }}>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-card/80 p-4">
            <p className="mb-2 font-medium text-white">Round history</p>
            <div className="flex-1 min-h-0 space-y-1 overflow-y-auto overflow-x-hidden text-xs">
              {roundHistory.length === 0 && <p className="text-body-gray">No rounds yet.</p>}
              {roundHistory.map((h, i) => (
                <div key={i} className="rounded border border-white/5 bg-white/5 p-2">
                  <p className="font-medium text-white">Round {i + 1}: &quot;{h.word}&quot;</p>
                  <p className="mt-0.5 text-body-gray">
                    {player1.username} {h.p1Correct ? "✅" : "❌"}
                    {h.p1Correct && ` (${(h.p1TimeMs / 1000).toFixed(1)}s)`} · {player2.username} {h.p2Correct ? "✅" : "❌"}
                    {h.p2Correct && ` (${(h.p2TimeMs / 1000).toFixed(1)}s)`}
                  </p>
                  <p className="text-amber-400/80">+{h.p1Points} / +{h.p2Points}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
