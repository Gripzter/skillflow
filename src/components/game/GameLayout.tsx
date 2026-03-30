"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AfkCountdownRing from "@/components/game/AfkCountdownRing";

export interface GameLayoutLogEntry {
  id: string;
  type: "system" | "chat";
  sender?: string;
  text: string;
  timestamp: number;
}

export interface GameLayoutProps {
  gameName: string;
  gameEmoji?: string;
  matchId: string;
  mode: "practice" | "real";
  player1: {
    username: string;
    avatar?: string | null;
    rating: number;
    score: number;
    scoreLabel?: string;
    isBot: boolean;
    timeLeftSec?: number;
  };
  player2: {
    username: string;
    avatar?: string | null;
    rating: number;
    score: number;
    scoreLabel?: string;
    isBot: boolean;
    timeLeftSec?: number;
  };
  currentTurn: "player1" | "player2";
  timerDisplay: string;
  turnTimerDisplay?: string;
  connectionStatus: "connected" | "reconnecting" | "disconnected";
  turnText: string;
  children: React.ReactNode;
  logEntries: GameLayoutLogEntry[];
  onSendChat: (message: string) => void;
  chatPresets?: string[];
  onLeaveMatch: () => void;
  onReportIssue: () => void;
  realStakeDisplay?: string;
  afkSecondsLeft?: number | null;
  afkActivePlayer?: "player1" | "player2" | null;
}

/* ── tiny helpers ────────────────────────────────────────── */

function ConnectionDot({ status }: { status: GameLayoutProps["connectionStatus"] }) {
  const color =
    status === "connected" ? "#22c55e" : status === "reconnecting" ? "#eab308" : "#ef4444";
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

function connectionLabel(s: GameLayoutProps["connectionStatus"]): string {
  if (s === "connected") return "Connected";
  if (s === "reconnecting") return "Reconnecting";
  return "Disconnected";
}

function formatPlayerClock(sec?: number): string | null {
  if (typeof sec !== "number" || Number.isNaN(sec)) return null;
  const clamped = Math.max(0, Math.floor(sec));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function PlayerCard({
  player,
  playerKey,
  isActive,
  scoreLabelDefault,
  afkSecondsLeft,
  afkRingVisible,
}: {
  player: GameLayoutProps["player1"];
  playerKey: "player1" | "player2";
  isActive: boolean;
  scoreLabelDefault: string;
  afkSecondsLeft?: number | null;
  afkRingVisible?: boolean;
}) {
  const initial = (player.username || "?").charAt(0).toUpperCase();
  const avatarBg = playerKey === "player1" ? "#FF5E00" : "#2A3A5C";
  const clockText = formatPlayerClock(player.timeLeftSec);
  const clockDanger = typeof player.timeLeftSec === "number" && player.timeLeftSec < 60;
  const clockColor = clockDanger ? "#ef4444" : isActive ? "#e0e0e0" : "#555";

  return (
    <div
      className={`relative flex min-w-0 flex-1 overflow-hidden rounded-[8px] border px-2 py-1.5 md:rounded-[10px] md:px-3 md:py-2.5 ${
        isActive ? "game-layout-card-active" : ""
      }`}
      style={{
        background: "#16161e",
        borderColor: isActive ? "#FF5E00" : "#2A3A5C",
      }}
    >
      {isActive && (
        <span
          className="absolute right-1.5 top-1 h-1.5 w-1.5 rounded-full md:right-2 md:top-1.5"
          style={{ background: "#22c55e" }}
          aria-hidden
        />
      )}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 md:gap-2.5">
        <div className="relative h-[26px] w-[26px] shrink-0 md:h-[34px] md:w-[34px]">
          {afkRingVisible && afkSecondsLeft !== null ? (
            <AfkCountdownRing
              secondsLeft={afkSecondsLeft}
              totalSeconds={60}
              isDanger={afkSecondsLeft <= 10}
            />
          ) : null}
          {player.avatar ? (
            <img
              src={player.avatar}
              alt=""
              className="h-[26px] w-[26px] rounded-full object-cover md:h-[34px] md:w-[34px]"
            />
          ) : (
            <div
              className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-xs font-semibold text-white md:h-[34px] md:w-[34px] md:text-sm"
              style={{ background: avatarBg }}
            >
              {initial}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-white md:text-[13px]">
            {player.username}
            {player.isBot ? (
              <span className="ml-1 text-[9px] text-[#888] md:text-[10px]">BOT</span>
            ) : null}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-[#555] md:text-[11px]">{player.rating}</p>
            {clockText ? (
              <span
                className="text-[10px] font-semibold tabular-nums md:text-[11px]"
                style={{ color: clockColor }}
              >
                {clockText}
              </span>
            ) : null}
          </div>
        </div>
        <div className="ml-auto flex shrink-0 flex-col items-end">
          <span className="text-[15px] font-medium tabular-nums md:text-[20px]" style={{ color: "#FF5E00" }}>
            {player.score}
          </span>
          <span className="text-[9px] uppercase tracking-wide text-[#555]">
            {player.scoreLabel ?? scoreLabelDefault}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── main component ──────────────────────────────────────── */

export default function GameLayout({
  gameName,
  gameEmoji,
  matchId,
  mode,
  player1,
  player2,
  currentTurn,
  timerDisplay,
  turnTimerDisplay,
  connectionStatus,
  turnText,
  children,
  logEntries,
  onSendChat,
  chatPresets,
  onLeaveMatch,
  onReportIssue,
  realStakeDisplay,
  afkSecondsLeft = null,
  afkActivePlayer = null,
}: GameLayoutProps) {
  const [chatInput, setChatInput] = useState("");
  const [mobileFeedOpen, setMobileFeedOpen] = useState(false);
  const mobileFeedRef = useRef<HTMLDivElement>(null);
  const desktopLogRef = useRef<HTMLDivElement>(null);
  const desktopChatRef = useRef<HTMLDivElement>(null);

  const sortedLog = useMemo(
    () => [...logEntries].sort((a, b) => a.timestamp - b.timestamp),
    [logEntries],
  );
  const systemOnly = useMemo(() => sortedLog.filter((e) => e.type === "system"), [sortedLog]);
  const chatOnly = useMemo(() => sortedLog.filter((e) => e.type === "chat"), [sortedLog]);

  useEffect(() => {
    const el = mobileFeedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sortedLog]);

  useEffect(() => {
    const el = desktopLogRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [systemOnly]);

  useEffect(() => {
    const el = desktopChatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatOnly]);

  const sendChat = useCallback(() => {
    const t = chatInput.trim();
    if (!t) return;
    onSendChat(t);
    setChatInput("");
  }, [chatInput, onSendChat]);

  const footerLeft =
    mode === "practice"
      ? "Practice — No stakes"
      : realStakeDisplay
        ? `${realStakeDisplay} Match`
        : "Real money match";

  const shortId = matchId.length > 8 ? `${matchId.slice(0, 8)}…` : matchId;

  return (
    <div className="flex w-full flex-1 flex-col overflow-hidden bg-[#0E0E12] text-[#e0e0e0]" style={{ minHeight: 0 }}>

      {/* ─── Top bar ─── */}
      <header className="flex w-full shrink-0 items-center border-b border-[#1a1a22] px-3 py-1.5 md:px-4 md:py-2" style={{ background: "#0E0E12" }}>
        <div className="flex shrink-0 items-center gap-2">
          <span className="whitespace-nowrap text-[14px] font-medium text-white">
            {gameEmoji ? `${gameEmoji} ` : ""}{gameName}
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-[#888]">
            <ConnectionDot status={connectionStatus} />
            <span className="hidden min-[360px]:inline">{connectionLabel(connectionStatus)}</span>
          </span>
        </div>
        <div className="flex-1 text-center">
          <span className="text-[18px] font-medium tabular-nums" style={{ color: "#FF5E00" }}>
            {timerDisplay}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {mode === "practice" ? (
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#a855f7" }}>
              PRACTICE
            </span>
          ) : (
            <span className="text-[13px] font-semibold tabular-nums" style={{ color: "#FF5E00" }}>
              {realStakeDisplay ?? "—"}
            </span>
          )}
          <button
            type="button"
            onClick={onLeaveMatch}
            className="rounded-md border border-[#2a2a34] px-2.5 py-0.5 text-[11px] text-[#666] hover:bg-white/5 md:hidden"
          >
            Leave
          </button>
        </div>
      </header>

      {/* ─── Content: main + sidebar ─── */}
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden md:flex-row">

        {/* Main area */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">

          {/* Player cards */}
          <div className="mx-auto flex w-full max-w-[600px] shrink-0 gap-2 px-2 py-1 md:gap-2.5 md:px-5 md:py-2">
            <PlayerCard
              playerKey="player1"
              player={player1}
              isActive={currentTurn === "player1"}
              scoreLabelDefault="Score"
              afkSecondsLeft={afkSecondsLeft}
              afkRingVisible={mode === "real" && afkActivePlayer === "player1"}
            />
            <PlayerCard
              playerKey="player2"
              player={player2}
              isActive={currentTurn === "player2"}
              scoreLabelDefault="Score"
              afkSecondsLeft={afkSecondsLeft}
              afkRingVisible={mode === "real" && afkActivePlayer === "player2"}
            />
          </div>

          {/* Board — flex:1 fills all remaining vertical space */}
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-1 py-0 md:px-5 md:py-1">
            <div
              className="flex h-full max-h-full w-full items-center justify-center"
              style={{ minHeight: 0, maxWidth: "min(480px, 100%)" }}
            >
              {children}
            </div>
          </div>

          {/* Turn indicator — hidden on mobile when no per-move timer (active card border shows turn) */}
          <div className={`shrink-0 flex-wrap items-center justify-center gap-2 px-2 py-0.5 text-center md:py-1 ${turnTimerDisplay ? "flex" : "hidden md:flex"}`}>
            <span className="hidden text-[12px] font-medium md:inline" style={{ color: "#FF5E00" }}>{turnText}</span>
            {turnTimerDisplay ? (
              <span className="rounded-full border border-[#2a2a34] px-2 py-0.5 text-[11px] tabular-nums text-[#ccc]" style={{ background: "#16161e" }}>
                {turnTimerDisplay}
              </span>
            ) : null}
          </div>

          {/* ─── Mobile: collapsible feed ─── */}
          <div className="flex shrink-0 flex-col border-t border-[#1a1a22] md:hidden">
            {/* Toggle bar — always visible */}
            <button
              type="button"
              onClick={() => setMobileFeedOpen((o) => !o)}
              className="flex w-full shrink-0 items-center justify-between px-3 py-1.5"
              style={{ background: "#0E0E12" }}
            >
              <span className="text-[11px] text-[#666]">
                {sortedLog.length > 0 ? sortedLog[sortedLog.length - 1].text.slice(0, 40) : "Live feed"}
                {sortedLog.length > 0 && sortedLog[sortedLog.length - 1].text.length > 40 ? "…" : ""}
              </span>
              <span className="ml-2 shrink-0 text-[10px] text-[#444]">{mobileFeedOpen ? "▼" : "▲"}</span>
            </button>
            {/* Expanded feed + chat */}
            {mobileFeedOpen && (
              <>
                <div ref={mobileFeedRef} className="flex max-h-[110px] min-h-0 flex-col justify-end overflow-y-auto overflow-x-hidden border-t border-[#1a1a22] px-2 py-1">
                  {sortedLog.map((entry) =>
                    entry.type === "system" ? (
                      <p key={entry.id} className="py-0.5 text-[11px] leading-snug" style={{ color: "#444" }}>
                        <span className="mr-1 opacity-80">●</span>{entry.text}
                      </p>
                    ) : (
                      <p key={entry.id} className="py-0.5 text-[12px] leading-snug">
                        <span className="text-[11px] font-bold" style={{ color: "#FF5E00" }}>{entry.sender ?? "?"}: </span>
                        <span style={{ color: "#ccc" }}>{entry.text}</span>
                      </p>
                    ),
                  )}
                </div>
                <div className="shrink-0 border-t border-[#1a1a22] px-2 py-1">
                  {chatPresets && chatPresets.length > 0 && (
                    <div className="mb-1 flex gap-1 overflow-x-auto">
                      {chatPresets.map((p) => (
                        <button key={p} type="button" onClick={() => onSendChat(p)} className="shrink-0 rounded-md border border-[#2a2a34] px-2 py-0.5 text-[10px] text-[#aaa] hover:bg-white/5">
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
                      placeholder="Type a message..."
                      className="min-w-0 flex-1 rounded-lg border border-[#2a2a34] px-2.5 py-1 text-[12px] text-[#e0e0e0] placeholder:text-[#666]"
                      style={{ background: "#1a1a22" }}
                    />
                    <button type="button" onClick={sendChat} className="shrink-0 rounded-lg px-3 py-1 text-[11px] font-medium text-white" style={{ background: "#FF5E00" }}>
                      Send
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ─── Desktop sidebar ─── */}
        <aside className="hidden min-h-0 w-[280px] shrink-0 flex-col border-l border-[#1a1a22] md:flex">
          {/* Game log */}
          <div className="flex min-h-0 flex-1 flex-col border-b border-[#1a1a22]">
            <div className="shrink-0 border-b border-[#1a1a22] px-3 py-2 text-[12px] font-medium text-[#666]">Game log</div>
            <div ref={desktopLogRef} className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto px-2 py-2">
              {systemOnly.map((entry) => (
                <p key={entry.id} className="py-0.5 text-[11px] leading-snug" style={{ color: "#444" }}>
                  <span className="mr-1">●</span>{entry.text}
                </p>
              ))}
            </div>
          </div>
          {/* Chat */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-[#1a1a22] px-3 py-2 text-[12px] font-medium text-[#666]">Chat</div>
            <div ref={desktopChatRef} className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto px-2 py-2">
              {chatOnly.map((entry) => (
                <p key={entry.id} className="py-0.5 text-[12px] leading-snug">
                  <span className="text-[11px] font-bold" style={{ color: "#FF5E00" }}>{entry.sender ?? "?"}: </span>
                  <span style={{ color: "#999" }}>{entry.text}</span>
                </p>
              ))}
            </div>
            <div className="shrink-0 border-t border-[#1a1a22] px-3 py-1.5">
              {chatPresets && chatPresets.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1">
                  {chatPresets.map((p) => (
                    <button key={p} type="button" onClick={() => onSendChat(p)} className="rounded-md border border-[#2a2a34] px-2 py-0.5 text-[10px] text-[#aaa] hover:bg-white/5">
                      {p}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
                  placeholder="Type a message..."
                  className="min-w-0 flex-1 rounded-lg border border-[#2a2a34] px-2.5 py-1.5 text-[12px] text-[#e0e0e0] placeholder:text-[#666]"
                  style={{ background: "#1a1a22" }}
                />
                <button type="button" onClick={sendChat} className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium text-white" style={{ background: "#FF5E00" }}>
                  Send
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ─── Footer ─── */}
      <footer className="hidden shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#1a1a22] px-3 py-1.5 md:flex">
        <p className="text-[11px] text-[#444]">{footerLeft} · ID {shortId}</p>
        <div className="flex gap-2">
          <button type="button" onClick={onReportIssue} className="rounded-md border border-[#2a2a34] px-3 py-1 text-[11px] text-[#666] hover:bg-white/5">
            Report
          </button>
          <button type="button" onClick={onLeaveMatch} className="rounded-md border border-[#2a2a34] px-3 py-1 text-[11px] text-[#666] hover:bg-white/5">
            Leave
          </button>
        </div>
      </footer>
    </div>
  );
}
