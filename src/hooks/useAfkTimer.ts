import { useCallback, useEffect, useRef, useState } from "react";

const AFK_TIMEOUT_SEC = 60;
const AFK_WARN_SEC = 30;

interface UseAfkTimerOptions {
  /**
   * Whether the timer is active at all (false = completely disabled).
   * Pass false when the game is not in-progress or the outcome is already set.
   */
  enabled: boolean;
  /**
   * True when it is this client's turn to act.
   * The timer starts (or restarts from 60) each time this flips to true
   * and stops when it flips to false.
   */
  isMyTurn: boolean;
  /** Called when the countdown reaches zero. */
  onForfeit: () => void;
}

interface UseAfkTimerResult {
  /** Current seconds remaining, or null when the timer is not running. */
  secondsLeft: number | null;
  /** True when the warning banner should be shown (≤30 s left). */
  showWarning: boolean;
  /**
   * Reset the countdown back to 60 s.
   * Call this whenever the local player performs a valid action
   * (e.g. wrapping sendGameEvent).  No-op when the timer is not active.
   */
  resetTimer: () => void;
}

export function useAfkTimer({
  enabled,
  isMyTurn,
  onForfeit,
}: UseAfkTimerOptions): UseAfkTimerResult {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Always-current callback ref so stale closures inside setInterval never matter.
  const onForfeitRef = useRef(onForfeit);
  onForfeitRef.current = onForfeit;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks whether the countdown is currently running (distinct from secondsLeft
  // to avoid depending on state inside callbacks).
  const runningRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    runningRef.current = false;
    setSecondsLeft(null);
  }, []);

  const startTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
    }
    runningRef.current = true;
    setSecondsLeft(AFK_TIMEOUT_SEC);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s === null || s <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          runningRef.current = false;
          onForfeitRef.current();
          return null;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  /** Restart the countdown from 60 — only if the timer is already active. */
  const resetTimer = useCallback(() => {
    if (!enabled || !runningRef.current) return;
    startTimer();
  }, [enabled, startTimer]);

  // Start/stop based on isMyTurn transitions.
  useEffect(() => {
    if (!enabled || !isMyTurn) {
      clearTimer();
      return;
    }
    startTimer();
    return clearTimer;
  }, [enabled, isMyTurn, startTimer, clearTimer]);

  // Safety: clear on unmount.
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    secondsLeft,
    showWarning: secondsLeft !== null && secondsLeft <= AFK_WARN_SEC,
    resetTimer,
  };
}
