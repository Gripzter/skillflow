"use client";

import type { ReactNode } from "react";

const ACCENT_REAL = "#FF5E00";
const ACCENT_PRACTICE = "#A855F7";

/** Truncate display for cramped UI (CSS also truncates at 150px). */
export function displayUsername(username: string, maxLen = 15): string {
  if (username.length <= maxLen) return username;
  return `${username.slice(0, maxLen)}…`;
}

export function GamePlayerStack({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`flex flex-col gap-2 ${className}`}>{children}</div>;
}

/**
 * Single player row: avatar 32px, name + optional dot, score right, rating optional, turn line.
 */
export function GamePlayerRow({
  username,
  avatarLetter,
  avatarClassName,
  scoreRight,
  active,
  isPractice,
  rating,
  isBot,
  thinking,
  nameDot,
  footer,
}: {
  username: string;
  avatarLetter: string;
  avatarClassName: string;
  scoreRight: ReactNode;
  active: boolean;
  isPractice: boolean;
  rating?: number;
  isBot?: boolean;
  thinking?: boolean;
  nameDot?: ReactNode;
  footer?: ReactNode;
}) {
  const accent = isPractice ? ACCENT_PRACTICE : ACCENT_REAL;

  return (
    <div
      className="rounded-lg border bg-[#1A1A22] px-3 py-3"
      style={{
        borderColor: "#2A3A5C",
        borderLeftWidth: active ? 3 : 1,
        borderLeftStyle: "solid",
        borderLeftColor: active ? accent : "#2A3A5C",
      }}
    >
      <div className="flex gap-2">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarClassName}`}
        >
          {avatarLetter}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {nameDot}
              <span
                className="min-w-0 max-w-[150px] truncate whitespace-nowrap text-sm font-medium text-white"
                title={username}
              >
                {displayUsername(username)}
                {isBot ? <span className="ml-1 text-[10px] font-normal text-[#7A7A8E]">(BOT)</span> : null}
              </span>
            </div>
            <div className="shrink-0 text-right text-xs tabular-nums text-[#C8C8D4]">{scoreRight}</div>
          </div>
          {rating !== undefined && (
            <p className="mt-0.5 text-[11px] text-[#7A7A8E]">Rating {rating}</p>
          )}
          <p className="mt-1 text-[11px] font-medium">
            {active ? (
              <span style={{ color: accent }} className="inline-flex items-center gap-1">
                <span className="text-emerald-400">●</span> Turn
                {thinking ? <span className="ml-1 animate-pulse text-[#7A7A8E]">…</span> : null}
              </span>
            ) : thinking ? (
              <span className="animate-pulse text-[#7A7A8E]">Thinking…</span>
            ) : (
              <span className="text-[#7A7A8E]">Waiting</span>
            )}
          </p>
          {footer ? <div className="mt-1.5">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

/** 16px colored dot for Connect 4 etc. */
export function PlayerColorDot({ color }: { color: string }) {
  return (
    <span
      className="h-4 w-4 shrink-0 rounded-full border border-white/10"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}
