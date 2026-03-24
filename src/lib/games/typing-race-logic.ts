import type { BotDifficulty } from "./bot-engine";

export const ACCURACY_THRESHOLD = 90; // below this → penalty
export const ERROR_PENALTY_MS = 500; // ms added per error when accuracy < 90%
export const FINISH_TIMEOUT_MS = 120_000; // 2-minute max race time

/** Live WPM: chars typed / 5 / elapsed minutes */
export function calcWpm(charsTyped: number, elapsedMs: number): number {
  if (elapsedMs < 500) return 0;
  const minutes = elapsedMs / 60_000;
  return Math.round(charsTyped / 5 / minutes);
}

/** Accuracy percentage: correctly typed chars vs total typed */
export function calcAccuracy(typed: string, passage: string): number {
  if (!typed.length) return 100;
  let correct = 0;
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === passage[i]) correct++;
  }
  return Math.round((correct / typed.length) * 100);
}

/** Error count: positions where typed char ≠ passage char */
export function countErrors(typed: string, passage: string): number {
  let errors = 0;
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] !== passage[i]) errors++;
  }
  return errors;
}

/** Adjusted finish time with accuracy penalty applied */
export function adjustedTime(
  rawMs: number,
  errors: number,
  accuracy: number
): number {
  if (accuracy >= ACCURACY_THRESHOLD) return rawMs;
  return rawMs + errors * ERROR_PENALTY_MS;
}

export interface BotProfile {
  wpm: number;
  accuracy: number; // 0–1
}

export function getBotProfile(difficulty: BotDifficulty): BotProfile {
  if (difficulty === "rookie") {
    return {
      wpm: 25 + Math.floor(Math.random() * 11), // 25–35
      accuracy: 0.82 + Math.random() * 0.06,    // 82–88 % → ~15% error rate
    };
  }
  if (difficulty === "professional") {
    return {
      wpm: 70 + Math.floor(Math.random() * 11), // 70–80
      accuracy: 0.95 + Math.random() * 0.04,    // 95–99 %
    };
  }
  // gamer
  return {
    wpm: 45 + Math.floor(Math.random() * 11),   // 45–55
    accuracy: 0.90 + Math.random() * 0.04,      // 90–94 %
  };
}

/** Returns a cleanup function that cancels all scheduled bot activity */
export function simulateBotTyping(
  passage: string,
  profile: BotProfile,
  onProgress: (charsTyped: number, errors: number, wpm: number) => void,
  onFinish: (rawMs: number, errors: number, accuracy: number) => void
): () => void {
  const ids: ReturnType<typeof setTimeout>[] = [];
  const msPerChar = 60_000 / (profile.wpm * 5); // average ms between chars

  let cumMs = 0;
  let errorCount = 0;

  for (let i = 0; i < passage.length; i++) {
    // Variable delay: gaussian-ish via sum of two randoms
    const variation = 0.4 + (Math.random() + Math.random()) * 0.6; // 0.4–1.6x
    let delay = msPerChar * variation;

    // Occasional mistake → extra correction time
    const makeError = Math.random() > profile.accuracy;
    if (makeError) {
      errorCount++;
      delay += msPerChar * (1.5 + Math.random()); // backspace + retype lag
    }

    // Small burst pauses every 8-15 chars (like a real typist)
    if (i > 0 && i % (8 + Math.floor(Math.random() * 8)) === 0) {
      delay += 80 + Math.random() * 120;
    }

    cumMs += delay;

    const pos = i + 1;
    const t = cumMs;
    const errs = errorCount;

    ids.push(
      setTimeout(() => {
        const wpm = calcWpm(pos, t);
        onProgress(pos, errs, wpm);
      }, t)
    );
  }

  // Finish event
  const finishMs = cumMs + 50;
  const finalErrors = errorCount;
  const finalAccuracy = Math.round(
    ((passage.length - finalErrors) / passage.length) * 100
  );

  ids.push(
    setTimeout(() => {
      onFinish(finishMs, finalErrors, finalAccuracy);
    }, finishMs)
  );

  return () => ids.forEach(clearTimeout);
}
