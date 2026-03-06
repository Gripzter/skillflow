"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "skillflow_play_mode";
export type PlayMode = "real" | "practice";

function readStored(): PlayMode {
  if (typeof window === "undefined") return "real";
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "practice" || raw === "real") return raw;
  return "real";
}

function writeStored(mode: PlayMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, mode);
}

interface PlayModeContextValue {
  mode: PlayMode;
  setMode: (mode: PlayMode) => void;
  isPractice: boolean;
  isReal: boolean;
}

const PlayModeContext = createContext<PlayModeContextValue>({
  mode: "real",
  setMode: () => {},
  isPractice: false,
  isReal: true,
});

export function PlayModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<PlayMode>("real");

  useEffect(() => {
    setModeState(readStored());
  }, []);

  const setMode = useCallback((next: PlayMode) => {
    setModeState(next);
    writeStored(next);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      isPractice: mode === "practice",
      isReal: mode === "real",
    }),
    [mode, setMode]
  );

  return (
    <PlayModeContext.Provider value={value}>
      {children}
    </PlayModeContext.Provider>
  );
}

export function usePlayMode(): PlayModeContextValue {
  const ctx = useContext(PlayModeContext);
  if (!ctx) {
    throw new Error("usePlayMode must be used within PlayModeProvider");
  }
  return ctx;
}
