"use client";

import { useEffect } from "react";
import { usePlayMode } from "@/contexts/PlayModeContext";

export default function PracticeModeClassToggle() {
  const { isPractice } = usePlayMode();

  useEffect(() => {
    const root = document.documentElement;
    if (isPractice) root.classList.add("practice-mode");
    else root.classList.remove("practice-mode");
    return () => {
      root.classList.remove("practice-mode");
    };
  }, [isPractice]);

  return null;
}

