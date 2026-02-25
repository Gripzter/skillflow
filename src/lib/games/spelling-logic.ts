/**
 * Spelling Bee game logic: rounds, difficulty, scoring, tiebreaker.
 */

import type { SpellingDifficulty, SpellingWord } from "./spelling-words";
import { SPELLING_WORDS } from "./spelling-words";

export const TOTAL_ROUNDS = 10;
export const ROUND_TIME_MS = 15_000;
export const PRE_ROUND_PAUSE_MS = 2_000;
export const GET_READY_MS = 2_000;
export const ROUND_RESULT_DURATION_MS = 3_000;
export const BETWEEN_ROUNDS_COUNTDOWN_SEC = 3;
export const MAX_TIEBREAKER_ROUNDS = 3;
export const SPEED_BONUS_POINTS = 0.5;

/** Difficulty for round 1-10: easy (1-3), medium (4-6), hard (7-9), expert (10) */
export function getDifficultyForRound(round: number): SpellingDifficulty {
  if (round <= 3) return "easy";
  if (round <= 6) return "medium";
  if (round <= 9) return "hard";
  return "expert";
}

const wordsByDifficulty: Record<SpellingDifficulty, SpellingWord[]> = (() => {
  const map: Record<SpellingDifficulty, SpellingWord[]> = {
    easy: [],
    medium: [],
    hard: [],
    expert: [],
  };
  for (const w of SPELLING_WORDS) {
    map[w.difficulty].push(w);
  }
  return map;
})();

/** Pick one word per round for a full match. Shuffled, no repeats. */
export function pickWordsForMatch(): SpellingWord[] {
  const chosen: SpellingWord[] = [];
  const used = new Set<string>();

  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    const difficulty = getDifficultyForRound(round);
    const pool = wordsByDifficulty[difficulty].filter((w) => !used.has(w.word.toLowerCase()));
    if (pool.length === 0) {
      // Fallback: allow reuse if pool exhausted
      const fallback = wordsByDifficulty[difficulty];
      const w = fallback[Math.floor(Math.random() * fallback.length)];
      chosen.push(w);
      continue;
    }
    const w = pool[Math.floor(Math.random() * pool.length)];
    chosen.push(w);
    used.add(w.word.toLowerCase());
  }
  return chosen;
}

/** Pick a single word for tiebreaker (hard or expert). */
export function pickTiebreakerWord(): SpellingWord {
  const pool = [...wordsByDifficulty.hard, ...wordsByDifficulty.expert];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Normalize answer for comparison: trim, lowercase. */
export function normalizeAnswer(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Check if answer is correct (normalized comparison). */
export function isAnswerCorrect(correctWord: string, rawAnswer: string): boolean {
  const correct = normalizeAnswer(correctWord);
  const answer = normalizeAnswer(rawAnswer);
  return correct === answer;
}

export interface RoundScore {
  p1Points: number;
  p2Points: number;
  p1Correct: boolean;
  p2Correct: boolean;
  speedBonus?: "player1" | "player2";
}

/**
 * Score a round: correct = +1, both correct => faster gets +0.5 speed bonus.
 */
export function scoreRound(
  p1Correct: boolean,
  p2Correct: boolean,
  p1TimeMs: number,
  p2TimeMs: number
): RoundScore {
  let p1Points = p1Correct ? 1 : 0;
  let p2Points = p2Correct ? 1 : 0;
  let speedBonus: "player1" | "player2" | undefined;

  if (p1Correct && p2Correct && p1TimeMs >= 0 && p2TimeMs >= 0) {
    if (p1TimeMs < p2TimeMs) {
      p1Points += SPEED_BONUS_POINTS;
      speedBonus = "player1";
    } else if (p2TimeMs < p1TimeMs) {
      p2Points += SPEED_BONUS_POINTS;
      speedBonus = "player2";
    }
  }

  return {
    p1Points,
    p2Points,
    p1Correct,
    p2Correct,
    speedBonus,
  };
}

/** Character-level comparison for wrong-answer highlight. */
export interface LetterCompareItem {
  char: string;
  status: "match" | "wrong" | "missing";
}

/**
 * Compare attempt to correct word; return array for display.
 * - match: correct letter in correct position
 * - wrong: letter present but wrong
 * - missing: correct letter was missing (show in correct word)
 */
export function compareSpelling(correctWord: string, attempt: string): LetterCompareItem[] {
  const correct = correctWord.toLowerCase().split("");
  const attemptChars = attempt.trim().toLowerCase().split("");
  const result: LetterCompareItem[] = [];
  const used = new Set<number>();

  for (let i = 0; i < correct.length; i++) {
    const c = correct[i];
    if (attemptChars[i] === c) {
      result.push({ char: c, status: "match" });
      used.add(i);
    } else if (attemptChars[i] !== undefined && attemptChars[i] !== c) {
      result.push({ char: attemptChars[i], status: "wrong" });
    } else {
      result.push({ char: c, status: "missing" });
    }
  }

  for (let i = correct.length; i < attemptChars.length; i++) {
    result.push({ char: attemptChars[i], status: "wrong" });
  }

  return result;
}

/** Get word by index from the full database (for multiplayer sync). */
export function getWordByIndex(index: number): SpellingWord | null {
  if (index < 0 || index >= SPELLING_WORDS.length) return null;
  return SPELLING_WORDS[index];
}

/** Find index of word in database (by normalized word). */
export function getWordIndex(word: SpellingWord): number {
  const lower = word.word.toLowerCase();
  return SPELLING_WORDS.findIndex((w) => w.word.toLowerCase() === lower);
}
