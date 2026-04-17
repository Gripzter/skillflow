"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const TRANSITION_MS = 1500;

function getMajorSegment(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "home";
  return segments[0];
}

export default function WarpTransitionOverlay() {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [animationId, setAnimationId] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (reducedMotion.matches) return;
    }

    if (previousPathRef.current == null) {
      previousPathRef.current = pathname;
      return;
    }

    const previousMajor = getMajorSegment(previousPathRef.current);
    const nextMajor = getMajorSegment(pathname);
    previousPathRef.current = pathname;

    if (previousMajor === nextMajor) return;

    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
    }

    setAnimationId((value) => value + 1);
    setIsVisible(true);
    hideTimerRef.current = window.setTimeout(() => {
      setIsVisible(false);
      hideTimerRef.current = null;
    }, TRANSITION_MS);
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current != null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="warp-transition-overlay" aria-hidden>
      <div className="warp-transition-dim" />
      <div className="warp-transition-track" key={animationId} />
    </div>
  );
}
