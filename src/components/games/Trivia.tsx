"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameMultiplayerProps } from "./Chess";
import type { MatchUiState } from "@/components/game/matchUi";
import type { BotDifficulty } from "@/lib/games/bot-engine";
import {
  TRIVIA_CATEGORIES,
  QUESTION_TIME_MS,
  calculatePoints,
  fetchTriviaQuestions,
  getTriviaBot,
  type TriviaCategory,
  type TriviaQuestion,
} from "@/lib/games/trivia-logic";
import { getUserFriendlyError } from "@/lib/errorHandler";

const TOTAL_QUESTIONS = 10;
const ANSWER_REVEAL_MS = 2500;
const BETWEEN_QUESTIONS_MS = 1000;
const COUNTDOWN_START = 3;
const SUDDEN_DEATH_CATEGORY = 9; // General Knowledge fallback for sudden death

interface TriviaProps extends GameMultiplayerProps {
  player1: { username: string; rating: number };
  player2: { username: string; rating: number };
  onGameEnd: (winner: "player1" | "player2") => void;
  onGameDraw: () => void;
  isPlayer2Bot?: boolean;
  botDifficulty?: BotDifficulty;
  isPractice?: boolean;
}

type Phase =
  | "category_select"
  | "loading"
  | "load_error"
  | "countdown"
  | "question"
  | "answer_reveal"
  | "between_questions"
  | "sudden_death_intro"
  | "sudden_death"
  | "sudden_death_reveal"
  | "match_over";

interface PlayerAnswer {
  questionIndex: number;
  answerIndex: number;
  correct: boolean;
  points: number;
  timeMs: number;
}

const ANSWER_LABELS = ["A", "B", "C", "D"];

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "#22C55E",
  medium: "#FACC15",
  hard: "#EF4444",
};

function TimerRing({ timeMs, totalMs }: { timeMs: number; totalMs: number }) {
  const pct = Math.max(0, timeMs / totalMs);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const color = pct > 0.5 ? "#00BCD4" : pct > 0.25 ? "#FACC15" : "#EF4444";
  const sec = Math.ceil(timeMs / 1000);
  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="64" height="64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.1s linear, stroke 0.3s" }}
        />
      </svg>
      <span className="relative text-lg font-black tabular-nums" style={{ color }}>
        {sec}
      </span>
    </div>
  );
}

export default function Trivia({
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
}: TriviaProps) {
  // — Phase & setup —
  const [phase, setPhase] = useState<Phase>("category_select");
  const [selectedCategory, setSelectedCategory] = useState<TriviaCategory>(TRIVIA_CATEGORIES[0]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // — Questions —
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [suddenDeathQ, setSuddenDeathQ] = useState<TriviaQuestion | null>(null);
  const [qIndex, setQIndex] = useState(0);

  // — Countdown —
  const [countdownN, setCountdownN] = useState(COUNTDOWN_START);

  // — Timer (ms remaining) —
  const [timerMs, setTimerMs] = useState(QUESTION_TIME_MS);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStartTimeRef = useRef<number>(0);

  // — Scores & answers —
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [myAnswers, setMyAnswers] = useState<PlayerAnswer[]>([]);
  const [myAnswer, setMyAnswer] = useState<number | null>(null); // chosen answer index or -1 = timeout
  const [opponentAnswer, setOpponentAnswer] = useState<{ correct: boolean; points: number; totalScore: number } | null>(null);

  // — Sudden death —
  const [sdMyAnswer, setSdMyAnswer] = useState<number | null>(null);
  const [sdOpponentResult, setSdOpponentResult] = useState<{ correct: boolean; timeMs: number } | null>(null);
  const [sdWinner, setSdWinner] = useState<"player1" | "player2" | null>(null);

  // — Multiplayer sync —
  const lastProcessedEventRef = useRef<Record<string, unknown> | null>(null);
  const waitingForQuestionsRef = useRef(false);

  // — Bot timeouts —
  const botTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const betweenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sdRevealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gameStartRef = useRef(Date.now());
  const isPractice = isPracticeProp ?? !isMultiplayer;

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setTimerMs(QUESTION_TIME_MS);
    questionStartTimeRef.current = performance.now();
    timerIntervalRef.current = setInterval(() => {
      setTimerMs(QUESTION_TIME_MS - Math.round(performance.now() - questionStartTimeRef.current));
    }, 50);
  }, [stopTimer]);

  const clearBotTimeout = useCallback(() => {
    if (botTimeoutRef.current) {
      clearTimeout(botTimeoutRef.current);
      botTimeoutRef.current = null;
    }
  }, []);

  // ─── Load questions ──────────────────────────────────────────────────────────

  const loadQuestions = useCallback(
    async (cat: TriviaCategory) => {
      setPhase("loading");
      setLoadError(null);
      try {
        const qs = await fetchTriviaQuestions(cat.id, TOTAL_QUESTIONS);
        setQuestions(qs);
        if (isMultiplayer && myRole === "player1" && sendGameEvent) {
          await sendGameEvent({
            type: "trivia_questions",
            questions: qs,
            categoryName: cat.name,
          });
        }
        setCountdownN(COUNTDOWN_START);
        setPhase("countdown");
      } catch (err) {
        setLoadError(getUserFriendlyError(err));
        setPhase("load_error");
      }
    },
    [isMultiplayer, myRole, sendGameEvent]
  );

  // ─── Category selection ──────────────────────────────────────────────────────

  const handleSelectCategory = useCallback(
    (cat: TriviaCategory) => {
      setSelectedCategory(cat);
    },
    []
  );

  const handleStartWithCategory = useCallback(
    (cat: TriviaCategory) => {
      if (isMultiplayer && myRole === "player1" && sendGameEvent) {
        sendGameEvent({ type: "trivia_category", categoryId: cat.id, categoryName: cat.name }).catch(() => {});
      }
      loadQuestions(cat).catch(() => {});
    },
    [isMultiplayer, myRole, sendGameEvent, loadQuestions]
  );

  // ─── Incoming multiplayer events ─────────────────────────────────────────────

  useEffect(() => {
    if (!incomingEvent || !onEventProcessed) return;
    if (incomingEvent === lastProcessedEventRef.current) return;
    lastProcessedEventRef.current = incomingEvent;

    const type = incomingEvent.type as string | undefined;

    if (type === "trivia_category") {
      // P2 receives P1's category selection — wait for questions
      waitingForQuestionsRef.current = true;
      setPhase("loading");
      onEventProcessed();
      return;
    }

    if (type === "trivia_questions") {
      // P2 receives questions from P1
      const qs = incomingEvent.questions as TriviaQuestion[] | undefined;
      if (!qs || !Array.isArray(qs)) { onEventProcessed(); return; }
      setQuestions(qs);
      waitingForQuestionsRef.current = false;
      setCountdownN(COUNTDOWN_START);
      setPhase("countdown");
      onEventProcessed();
      return;
    }

    if (type === "trivia_answer") {
      const correct = incomingEvent.correct as boolean;
      const points = incomingEvent.points as number;
      const totalScore = incomingEvent.totalScore as number;
      const opScore = typeof totalScore === "number" ? totalScore : 0;
      if (myRole === "player1") {
        setP2Score(opScore);
      } else {
        setP1Score(opScore);
      }
      setOpponentAnswer({ correct, points: points ?? 0, totalScore: opScore });
      onEventProcessed();
      return;
    }

    if (type === "trivia_sudden_death_answer") {
      const correct = incomingEvent.correct as boolean;
      const timeMs = incomingEvent.timeMs as number;
      setSdOpponentResult({ correct, timeMs });
      onEventProcessed();
      return;
    }

    onEventProcessed();
  }, [incomingEvent, onEventProcessed, myRole]);

  // ─── Countdown ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdownN > 0) {
      const t = setTimeout(() => setCountdownN((n) => n - 1), 1000);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setQIndex(0);
      setMyAnswer(null);
      setOpponentAnswer(null);
      setPhase("question");
    }, 800);
    return () => clearTimeout(t);
  }, [phase, countdownN]);

  // ─── Question start ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "question") return;
    setMyAnswer(null);
    setOpponentAnswer(null);
    startTimer();

    // Bot answer simulation
    if (!isMultiplayer && isPlayer2Bot) {
      const { correct, delayMs } = getTriviaBot(botDifficulty);
      const clampedDelay = Math.min(delayMs, QUESTION_TIME_MS - 100);
      botTimeoutRef.current = setTimeout(() => {
        const timeRemaining = Math.max(0, QUESTION_TIME_MS - clampedDelay);
        const pts = correct ? calculatePoints(timeRemaining) : 0;
        setP2Score((s) => s + pts);
        setOpponentAnswer({ correct, points: pts, totalScore: 0 }); // totalScore updated by setP2Score
      }, clampedDelay);
    }

    // Auto-timeout: if player hasn't answered in time
    const timeoutId = setTimeout(() => {
      setMyAnswer((prev) => {
        if (prev === null) {
          // Timed out — no points
          if (isMultiplayer && sendGameEvent) {
            const myCurrentScore = myRole === "player1" ? p1Score : p2Score;
            sendGameEvent({
              type: "trivia_answer",
              questionIndex: qIndex,
              correct: false,
              points: 0,
              totalScore: myCurrentScore,
            }).catch(() => {});
          }
          return -1;
        }
        return prev;
      });
    }, QUESTION_TIME_MS + 200);

    return () => {
      clearTimeout(timeoutId);
      clearBotTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qIndex]);

  // Stop timer when answer is given
  useEffect(() => {
    if (phase === "question" && myAnswer !== null) {
      stopTimer();
    }
  }, [phase, myAnswer, stopTimer]);

  // Advance to reveal when both have answered (or timed out).
  // NOTE: Only schedules the 200ms → "answer_reveal" hop here.
  // The subsequent "answer_reveal" → "between_questions" → "question" transitions
  // are handled by dedicated phase-based effects below so that this effect's
  // cleanup cannot cancel timers that belong to a later phase.
  useEffect(() => {
    if (phase !== "question") return;
    const myDone = myAnswer !== null;
    const opDone = isMultiplayer ? opponentAnswer !== null : (opponentAnswer !== null);
    const botDone = !isMultiplayer && (isPlayer2Bot ? opponentAnswer !== null : true);

    if (myDone && (opDone || botDone || !isPlayer2Bot)) {
      stopTimer();
      clearBotTimeout();
      revealTimeoutRef.current = setTimeout(() => {
        setPhase("answer_reveal");
      }, 200);
    }

    return () => {
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, myAnswer, opponentAnswer]);

  // answer_reveal → between_questions
  useEffect(() => {
    if (phase !== "answer_reveal") return;
    revealTimeoutRef.current = setTimeout(() => {
      setPhase("between_questions");
    }, ANSWER_REVEAL_MS);
    return () => {
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }
    };
  }, [phase]);

  // between_questions → question (or match_over)
  useEffect(() => {
    if (phase !== "between_questions") return;
    betweenTimeoutRef.current = setTimeout(() => {
      const nextIndex = qIndex + 1;
      if (nextIndex >= TOTAL_QUESTIONS) {
        setPhase("match_over");
      } else {
        setQIndex(nextIndex);
        setMyAnswer(null);
        setOpponentAnswer(null);
        setPhase("question");
      }
    }, BETWEEN_QUESTIONS_MS);
    return () => {
      if (betweenTimeoutRef.current) {
        clearTimeout(betweenTimeoutRef.current);
        betweenTimeoutRef.current = null;
      }
    };
  }, [phase, qIndex]);

  // ─── Handle user answer ──────────────────────────────────────────────────────

  const handleAnswer = useCallback(
    (answerIndex: number) => {
      if (phase !== "question" || myAnswer !== null) return;
      const q = questions[qIndex];
      if (!q) return;
      const correct = answerIndex === q.correctIndex;
      const elapsed = performance.now() - questionStartTimeRef.current;
      const timeRemaining = Math.max(0, QUESTION_TIME_MS - elapsed);
      const pts = correct ? calculatePoints(timeRemaining) : 0;

      setMyAnswer(answerIndex);
      setMyAnswers((prev) => [
        ...prev,
        { questionIndex: qIndex, answerIndex, correct, points: pts, timeMs: elapsed },
      ]);

      if (myRole === "player1" || !isMultiplayer) {
        setP1Score((s) => {
          const next = s + pts;
          if (isMultiplayer && sendGameEvent) {
            sendGameEvent({
              type: "trivia_answer",
              questionIndex: qIndex,
              correct,
              points: pts,
              totalScore: next,
            }).catch(() => {});
          }
          return next;
        });
      } else {
        setP2Score((s) => {
          const next = s + pts;
          if (isMultiplayer && sendGameEvent) {
            sendGameEvent({
              type: "trivia_answer",
              questionIndex: qIndex,
              correct,
              points: pts,
              totalScore: next,
            }).catch(() => {});
          }
          return next;
        });
      }
    },
    [phase, myAnswer, questions, qIndex, myRole, isMultiplayer, sendGameEvent]
  );

  // ─── Match over: resolve winner ──────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "match_over") return;
    const t = setTimeout(() => {
      // p1Score / p2Score may be stale due to closure; compare final state
      setP1Score((s1) => {
        setP2Score((s2) => {
          if (s1 > s2) onGameEnd("player1");
          else if (s2 > s1) onGameEnd("player2");
          else {
            // Tie — sudden death
            setSdMyAnswer(null);
            setSdOpponentResult(null);
            setSdWinner(null);
            setPhase("sudden_death_intro");
          }
          return s2;
        });
        return s1;
      });
    }, 300);
    return () => clearTimeout(t);
  }, [phase, onGameEnd]);

  // ─── Sudden death: fetch one question ────────────────────────────────────────

  useEffect(() => {
    if (phase !== "sudden_death_intro") return;
    const t = setTimeout(async () => {
      try {
        const [q] = await fetchTriviaQuestions(selectedCategory.id || SUDDEN_DEATH_CATEGORY, 1);
        setSuddenDeathQ(q);
        setPhase("sudden_death");
        questionStartTimeRef.current = performance.now();

        if (!isMultiplayer && isPlayer2Bot) {
          const { correct, delayMs } = getTriviaBot(botDifficulty);
          const clampedDelay = Math.min(delayMs, QUESTION_TIME_MS - 100);
          botTimeoutRef.current = setTimeout(() => {
            const elapsed = clampedDelay;
            setSdOpponentResult({ correct, timeMs: elapsed });
          }, clampedDelay);
        }
      } catch {
        // If fetch fails in sudden death, call draw
        onGameDraw();
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [phase, selectedCategory.id, isMultiplayer, isPlayer2Bot, botDifficulty, onGameDraw]);

  // ─── Handle sudden death answer ──────────────────────────────────────────────

  const handleSuddenDeathAnswer = useCallback(
    (answerIndex: number) => {
      if (phase !== "sudden_death" || sdMyAnswer !== null || !suddenDeathQ) return;
      const correct = answerIndex === suddenDeathQ.correctIndex;
      const elapsed = performance.now() - questionStartTimeRef.current;
      setSdMyAnswer(answerIndex);
      if (isMultiplayer && sendGameEvent) {
        sendGameEvent({
          type: "trivia_sudden_death_answer",
          correct,
          timeMs: elapsed,
        }).catch(() => {});
      }
    },
    [phase, sdMyAnswer, suddenDeathQ, isMultiplayer, sendGameEvent]
  );

  // Resolve sudden death when both answered
  useEffect(() => {
    if (phase !== "sudden_death" || !suddenDeathQ) return;
    const myDone = sdMyAnswer !== null;
    const opDone = isMultiplayer ? sdOpponentResult !== null : (sdOpponentResult !== null || !isPlayer2Bot);

    if (!myDone && !opDone) return;

    // Only wait for both in multiplayer; in bot mode wait for both
    const bothDone = myDone && (opDone || (!isMultiplayer && !isPlayer2Bot));
    const anyCorrect = myDone || opDone;

    if (!anyCorrect && !bothDone) return;

    const myCorrect = sdMyAnswer !== null && sdMyAnswer === suddenDeathQ.correctIndex;
    const opCorrect = sdOpponentResult?.correct ?? false;

    let winner: "player1" | "player2" | null = null;

    if (myCorrect && !opCorrect) {
      winner = myRole === "player1" ? "player1" : "player2";
    } else if (!myCorrect && opCorrect) {
      winner = myRole === "player1" ? "player2" : "player1";
    } else if (myCorrect && opCorrect) {
      // Both correct: faster wins
      const myTime = sdMyAnswer !== null ? performance.now() - questionStartTimeRef.current : Infinity;
      const opTime = sdOpponentResult?.timeMs ?? Infinity;
      winner = myTime <= opTime
        ? (myRole === "player1" ? "player1" : "player2")
        : (myRole === "player1" ? "player2" : "player1");
    }
    // Both wrong: no winner yet (could retry, but for simplicity call draw)

    if (winner || bothDone) {
      setSdWinner(winner);
      setPhase("sudden_death_reveal");
      sdRevealTimeoutRef.current = setTimeout(() => {
        if (winner) onGameEnd(winner);
        else onGameDraw();
      }, 2500);
    }
  }, [phase, sdMyAnswer, sdOpponentResult, suddenDeathQ, myRole, isMultiplayer, isPlayer2Bot, onGameEnd, onGameDraw]);

  // ─── Sudden death timer (15s limit) ─────────────────────────────────────────

  useEffect(() => {
    if (phase !== "sudden_death") return;
    setTimerMs(QUESTION_TIME_MS);
    questionStartTimeRef.current = performance.now();
    const interval = setInterval(() => {
      setTimerMs(QUESTION_TIME_MS - Math.round(performance.now() - questionStartTimeRef.current));
    }, 50);
    const timeout = setTimeout(() => {
      setSdMyAnswer((prev) => (prev === null ? -1 : prev));
    }, QUESTION_TIME_MS + 200);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [phase]);

  // ─── Cleanup ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopTimer();
      clearBotTimeout();
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
      if (betweenTimeoutRef.current) clearTimeout(betweenTimeoutRef.current);
      if (sdRevealTimeoutRef.current) clearTimeout(sdRevealTimeoutRef.current);
    };
  }, [stopTimer, clearBotTimeout]);

  // ─── onMatchUi ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!onMatchUi) return;
    let turnText = "Trivia";
    if (phase === "category_select") turnText = "Choose a category";
    else if (phase === "loading") turnText = "Loading questions...";
    else if (phase === "countdown") turnText = "Get ready!";
    else if (phase === "question") turnText = `Question ${qIndex + 1} of ${TOTAL_QUESTIONS}`;
    else if (phase === "answer_reveal") turnText = "Results";
    else if (phase === "sudden_death" || phase === "sudden_death_intro") turnText = " Sudden Death!";
    else if (phase === "match_over") turnText = "Match over";

    const logEntries: MatchUiState["systemLogEntries"] = [
      {
        id: "start",
        text: ` Trivia — ${player1.username} vs ${player2.username}`,
        timestamp: gameStartRef.current,
      },
      ...myAnswers.map((a, i) => ({
        id: `q-${i}`,
        text: `Q${i + 1}: ${a.correct ? ` +${a.points}pts` : " 0pts"}`,
        timestamp: gameStartRef.current + (i + 1) * 1000,
      })),
    ];

    onMatchUi({
      scores: { player1: p1Score, player2: p2Score },
      scoreLabel: "Points",
      currentTurn: myRole === "player1" ? "player1" : "player2",
      turnText,
      systemLogEntries: logEntries,
    });
  }, [onMatchUi, phase, qIndex, p1Score, p2Score, myRole, player1.username, player2.username, myAnswers]);

  // ─── Current question helper ─────────────────────────────────────────────────

  const currentQ = questions[qIndex] ?? null;

  // ─── Category select screen ──────────────────────────────────────────────────

  if (phase === "category_select") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        {isMultiplayer && myRole === "player2" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="text-4xl"></div>
            <p className="text-lg font-semibold text-white">Waiting for opponent to choose a category...</p>
            <div className="mt-2 flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 animate-bounce rounded-full bg-teal"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-auto p-4">
            <p className="mb-4 text-center text-sm font-medium text-body-gray">Choose a category</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {TRIVIA_CATEGORIES.map((cat) => (
                <button
                  key={`${cat.id}-${cat.name}`}
                  type="button"
                  onClick={() => handleSelectCategory(cat)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                    selectedCategory.name === cat.name
                      ? "border-teal bg-teal/20 shadow-[0_0_12px_rgba(0,188,212,0.3)]"
                      : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10"
                  }`}
                >
                  <span className="text-2xl leading-none">{cat.icon}</span>
                  <span className="text-xs font-medium leading-tight text-white">{cat.name}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => handleStartWithCategory(selectedCategory)}
              className="mt-4 w-full rounded-xl bg-teal py-3 font-bold text-charcoal hover:shadow-[0_0_20px_rgba(0,188,212,0.4)] transition-all"
            >
              Start with {selectedCategory.icon} {selectedCategory.name}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── Loading ─────────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal/30 border-t-teal" />
        <p className="text-body-gray">
          {waitingForQuestionsRef.current ? "Waiting for opponent's questions..." : "Loading questions..."}
        </p>
      </div>
    );
  }

  if (phase === "load_error") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-semibold text-red-400">Failed to load questions</p>
        <p className="text-sm text-body-gray">{loadError}</p>
        <button
          type="button"
          onClick={() => setPhase("category_select")}
          className="mt-2 rounded-lg border border-white/20 px-6 py-2 text-white hover:bg-white/10"
        >
          Try again
        </button>
      </div>
    );
  }

  // ─── Countdown ───────────────────────────────────────────────────────────────

  if (phase === "countdown") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center">
        {countdownN > 0 ? (
          <span
            className="animate-ping-once text-7xl font-black"
            style={{ color: countdownN === 3 ? "#fff" : countdownN === 2 ? "#FACC15" : "#00BCD4" }}
          >
            {countdownN}
          </span>
        ) : (
          <span className="text-5xl font-black text-teal animate-pulse">GO!</span>
        )}
        <p className="mt-4 text-body-gray text-sm">
          {selectedCategory.icon} {selectedCategory.name} • {TOTAL_QUESTIONS} questions
        </p>
      </div>
    );
  }

  // ─── Sudden death intro ──────────────────────────────────────────────────────

  if (phase === "sudden_death_intro") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center p-6">
        <div className="text-5xl"></div>
        <p className="text-2xl font-black text-white">It&apos;s a Tie!</p>
        <p className="text-lg font-semibold" style={{ color: "#FACC15" }}>
          {p1Score} – {p2Score}
        </p>
        <p className="mt-2 text-body-gray">Sudden Death — first correct answer wins!</p>
        <div className="mt-4 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-bounce rounded-full bg-yellow-400"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ─── Sudden death reveal ─────────────────────────────────────────────────────

  if (phase === "sudden_death_reveal" && suddenDeathQ) {
    const iWon = sdWinner === (myRole === "player1" ? "player1" : myRole === "player2" ? "player2" : null);
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center p-6">
        <div className="text-5xl">{sdWinner ? (iWon ? "" : "") : ""}</div>
        <p className="text-2xl font-black" style={{ color: sdWinner ? (iWon ? "#00BCD4" : "#EF4444") : "#FACC15" }}>
          {sdWinner
            ? iWon
              ? "You Win!"
              : "Opponent Wins!"
            : "Draw!"}
        </p>
        <p className="text-body-gray">
          Correct: <span className="font-semibold text-white">{suddenDeathQ.correct_answer}</span>
        </p>
      </div>
    );
  }

  // ─── Sudden death question ───────────────────────────────────────────────────

  if ((phase === "sudden_death") && suddenDeathQ) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden p-4">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-bold text-yellow-400">
             SUDDEN DEATH
          </span>
          <TimerRing timeMs={Math.max(0, timerMs)} totalMs={QUESTION_TIME_MS} />
        </div>
        <div className="flex-1 overflow-auto rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-base font-semibold leading-snug text-white">{suddenDeathQ.question}</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {suddenDeathQ.shuffledAnswers.map((ans, i) => {
            const chosen = sdMyAnswer === i;
            const revealed = sdMyAnswer !== null;
            const correct = i === suddenDeathQ.correctIndex;
            let style = "border-white/15 bg-white/5 hover:border-white/40 hover:bg-white/10";
            if (revealed) {
              if (correct) style = "border-emerald-500 bg-emerald-500/20 text-emerald-300";
              else if (chosen) style = "border-red-500 bg-red-500/20 text-red-300";
              else style = "border-white/10 bg-white/5 opacity-50";
            }
            return (
              <button
                key={i}
                type="button"
                disabled={sdMyAnswer !== null}
                onClick={() => handleSuddenDeathAnswer(i)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left text-sm font-medium text-white transition-all ${style} ${sdMyAnswer === null ? "cursor-pointer" : "cursor-default"}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
                  {ANSWER_LABELS[i]}
                </span>
                <span className="leading-snug">{ans}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Main question / reveal ──────────────────────────────────────────────────

  if (!currentQ) return null;

  const isReveal = phase === "answer_reveal";
  const isBetween = phase === "between_questions";

  const opIsCorrect = opponentAnswer?.correct ?? false;
  const myIsCorrect = myAnswer !== null && myAnswer >= 0 && myAnswer === currentQ.correctIndex;
  const myTimedOut = myAnswer === -1;

  const myPointsEarned = (() => {
    if (!myIsCorrect) return 0;
    const elapsed = myAnswers[myAnswers.length - 1]?.timeMs ?? 0;
    return calculatePoints(Math.max(0, QUESTION_TIME_MS - elapsed));
  })();

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden p-3">
      {/* Header: progress + timer */}
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-body-gray">
            <span className="font-medium text-white">Q{qIndex + 1}/{TOTAL_QUESTIONS}</span>
            <span>•</span>
            <span>{selectedCategory.icon} {selectedCategory.name}</span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase"
              style={{
                background: `${DIFFICULTY_COLOR[currentQ.difficulty] ?? "#9ca3af"}22`,
                color: DIFFICULTY_COLOR[currentQ.difficulty] ?? "#9ca3af",
              }}
            >
              {currentQ.difficulty}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-teal transition-all duration-300"
              style={{ width: `${((qIndex + 1) / TOTAL_QUESTIONS) * 100}%` }}
            />
          </div>
        </div>
        <TimerRing timeMs={Math.max(0, timerMs)} totalMs={QUESTION_TIME_MS} />
      </div>

      {/* Score row */}
      <div className="flex shrink-0 items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-teal" />
          <span className="text-white font-medium">{player1.username}</span>
          <span className="font-black text-teal tabular-nums">{p1Score}</span>
        </div>
        <span className="text-body-gray text-xs">pts</span>
        <div className="flex items-center gap-1.5">
          <span className="font-black text-purple-400 tabular-nums">{p2Score}</span>
          <span className="text-white font-medium">{player2.username}</span>
          <span className="h-2 w-2 rounded-full bg-purple-500" />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 overflow-auto rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold leading-snug text-white sm:text-base">{currentQ.question}</p>

        {isReveal && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className={`rounded-full px-2 py-0.5 font-medium ${myIsCorrect ? "bg-emerald-500/20 text-emerald-300" : myTimedOut ? "bg-white/10 text-body-gray" : "bg-red-500/20 text-red-300"}`}>
              You: {myTimedOut ? "⏱ timed out" : myIsCorrect ? ` +${myPointsEarned}pts` : " wrong"}
            </span>
            {(isPlayer2Bot || isMultiplayer) && (
              <span className={`rounded-full px-2 py-0.5 font-medium ${opIsCorrect ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                {player2.username}: {opIsCorrect ? ` +${opponentAnswer?.points ?? 0}pts` : " wrong"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Answers grid */}
      <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2">
        {currentQ.shuffledAnswers.map((ans, i) => {
          const chosen = myAnswer === i;
          const revealed = isReveal || isBetween || myAnswer !== null;
          const correct = i === currentQ.correctIndex;
          let style = "border-white/15 bg-white/5 hover:border-white/40 hover:bg-white/10";
          if (revealed) {
            if (correct) style = "border-emerald-500 bg-emerald-500/20 text-emerald-300";
            else if (chosen) style = "border-red-500 bg-red-500/20 text-red-300";
            else style = "border-white/10 bg-white/5 opacity-40";
          }
          return (
            <button
              key={i}
              type="button"
              disabled={myAnswer !== null || isReveal || isBetween}
              onClick={() => handleAnswer(i)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left text-sm font-medium text-white transition-all ${style} ${myAnswer === null && !isReveal && !isBetween ? "cursor-pointer" : "cursor-default"}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
                {ANSWER_LABELS[i]}
              </span>
              <span className="leading-snug">{ans}</span>
              {revealed && correct && (
                <span className="ml-auto text-emerald-400"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Waiting indicator */}
      {myAnswer !== null && !opponentAnswer && (isPlayer2Bot || isMultiplayer) && !isReveal && (
        <p className="shrink-0 text-center text-xs text-body-gray">Waiting for {player2.username}...</p>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes ping-once { 0% { transform: scale(0.7); opacity: 0; } 60% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
          .animate-ping-once { animation: ping-once 0.4s ease-out forwards; }
        `
      }} />
    </div>
  );
}
