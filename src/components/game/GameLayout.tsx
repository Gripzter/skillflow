"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  };
  player2: {
    username: string;
    avatar?: string | null;
    rating: number;
    score: number;
    scoreLabel?: string;
    isBot: boolean;
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
  /** Real mode: show stake in top bar (e.g. "$5.00"). Ignored when mode is practice. */
  realStakeDisplay?: string;
}

function ConnectionDot({
  status,
}: {
  status: GameLayoutProps["connectionStatus"];
}) {
  const color =
    status === "connected"
      ? "#22c55e"
      : status === "reconnecting"
        ? "#eab308"
        : "#ef4444";
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

function connectionLabel(status: GameLayoutProps["connectionStatus"]): string {
  if (status === "connected") return "Connected";
  if (status === "reconnecting") return "Reconnecting";
  return "Disconnected";
}

function PlayerCard({
  player,
  playerKey,
  isActive,
  scoreLabelDefault,
}: {
  player: GameLayoutProps["player1"];
  playerKey: "player1" | "player2";
  isActive: boolean;
  scoreLabelDefault: string;
}) {
  const initial = (player.username || "?").charAt(0).toUpperCase();
  const avatarBg = playerKey === "player1" ? "#FF5E00" : "#2A3A5C";

  return (
    <div
      className={`relative flex min-w-0 flex-1 overflow-hidden rounded-[10px] border px-3 py-2.5 ${
        isActive ? "game-layout-card-active" : ""
      }`}
      style={{
        background: "#16161e",
        borderColor: isActive ? "#FF5E00" : "#2A3A5C",
        boxSizing: "border-box",
      }}
    >
      {isActive && (
        <span
          className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full"
          style={{ background: "#22c55e" }}
          aria-hidden
        />
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {player.avatar ? (
          <img
            src={player.avatar}
            alt=""
            className="h-[34px] w-[34px] shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ background: avatarBg }}
          >
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-white">
            {player.username}
            {player.isBot ? (
              <span className="ml-1 text-[10px] text-[#888]">BOT</span>
            ) : null}
          </p>
          <p className="text-[11px] text-[#555]">{player.rating}</p>
        </div>
        <div className="ml-auto flex shrink-0 flex-col items-end">
          <span
            className="text-[20px] font-medium tabular-nums"
            style={{ color: "#FF5E00" }}
          >
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
}: GameLayoutProps) {
  const [chatInput, setChatInput] = useState("");
  const mobileFeedRef = useRef<HTMLDivElement>(null);
  const desktopLogRef = useRef<HTMLDivElement>(null);
  const desktopChatRef = useRef<HTMLDivElement>(null);

  const sortedLog = useMemo(
    () => [...logEntries].sort((a, b) => a.timestamp - b.timestamp),
    [logEntries]
  );

  const systemOnly = useMemo(
    () => sortedLog.filter((e) => e.type === "system"),
    [sortedLog]
  );

  const chatOnly = useMemo(
    () => sortedLog.filter((e) => e.type === "chat"),
    [sortedLog]
  );

  const mobileCombined = sortedLog;

  useEffect(() => {
    const el = mobileFeedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mobileCombined]);

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
    <div
      className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#0E0E12] text-[#e0e0e0]"
      style={{ minHeight: 0 }}
    >
      {/* Top bar */}
      <header
        className="flex w-full shrink-0 items-center justify-between border-b border-[#1a1a22] px-4 py-2.5"
        style={{ background: "#0E0E12" }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="truncate text-[14px] font-medium text-white"
            style={{ maxWidth: "42vw" }}
          >
            {gameEmoji ? `${gameEmoji} ` : ""}
            {gameName}
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-[#888]">
            <ConnectionDot status={connectionStatus} />
            <span className="hidden min-[360px]:inline">
              {connectionLabel(connectionStatus)}
            </span>
          </span>
        </div>
        <div
          className="shrink-0 px-2 text-[18px] font-medium tabular-nums"
          style={{ color: "#FF5E00" }}
        >
          {timerDisplay}
        </div>
        <div className="flex min-w-0 flex-1 justify-end">
          {mode === "practice" ? (
            <span
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "#a855f7" }}
            >
              PRACTICE
            </span>
          ) : (
            <span
              className="text-[13px] font-semibold tabular-nums"
              style={{ color: "#FF5E00" }}
            >
              {realStakeDisplay ?? "—"}
            </span>
          )}
        </div>
      </header>

      {/* Main row: content + desktop sidebar */}
      <div className="flex min-h-0 w-full flex-1 flex-col md:flex-row md:overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Player cards */}
          <div className="flex shrink-0 gap-2.5 px-3 py-2.5">
            <PlayerCard
              playerKey="player1"
              player={player1}
              isActive={currentTurn === "player1"}
              scoreLabelDefault="Score"
            />
            <PlayerCard
              playerKey="player2"
              player={player2}
              isActive={currentTurn === "player2"}
              scoreLabelDefault="Score"
            />
          </div>

          {/* Board */}
          <div className="flex min-h-0 shrink justify-center px-3 py-1.5 md:max-w-[440px] md:self-center">
            <div className="w-full max-w-[min(100%,440px)]">{children}</div>
          </div>

          {/* Turn indicator */}
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 px-2 py-1.5 text-center">
            <span
              className="text-[12px] font-medium"
              style={{ color: "#FF5E00" }}
            >
              {turnText}
            </span>
            {turnTimerDisplay ? (
              <span
                className="rounded-full border border-[#2a2a34] px-2 py-0.5 text-[11px] tabular-nums text-[#ccc]"
                style={{ background: "#16161e" }}
              >
                {turnTimerDisplay}
              </span>
            ) : null}
          </div>

          {/* Mobile: combined feed */}
          <div className="mt-auto flex min-h-0 shrink flex-col border-t border-[#1a1a22] md:hidden">
            <div className="flex items-center justify-between border-b border-[#1a1a22] px-3 py-1.5">
              <span className="text-[12px] text-[#666]">Live feed</span>
              <span className="text-[10px] text-[#555]">log + chat</span>
            </div>
            <div
              ref={mobileFeedRef}
              className="flex min-h-[110px] max-h-[130px] flex-col justify-end overflow-y-auto overflow-x-hidden px-2 py-2"
            >
              {mobileCombined.map((entry) =>
                entry.type === "system" ? (
                  <p
                    key={entry.id}
                    className="py-0.5 text-[11px] leading-snug"
                    style={{ color: "#444" }}
                  >
                    <span className="mr-1 opacity-80">●</span>
                    {entry.text}
                  </p>
                ) : (
                  <p key={entry.id} className="py-0.5 text-[12px] leading-snug">
                    <span
                      className="text-[11px] font-bold"
                      style={{ color: "#FF5E00" }}
                    >
                      {entry.sender ?? "?"}
                      {": "}
                    </span>
                    <span style={{ color: "#ccc" }}>{entry.text}</span>
                  </p>
                )
              )}
            </div>
            <div className="border-t border-[#1a1a22] px-3 py-1.5">
              {chatPresets && chatPresets.length > 0 ? (
                <div className="mb-1.5 flex flex-wrap gap-1">
                  {chatPresets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onSendChat(p)}
                      className="rounded-md border border-[#2a2a34] px-2 py-0.5 text-[10px] text-[#aaa] hover:bg-white/5"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendChat();
                  }}
                  placeholder="Type a message..."
                  className="min-w-0 flex-1 rounded-lg border border-[#2a2a34] px-2.5 py-1.5 text-[12px] text-[#e0e0e0] placeholder:text-[#666]"
                  style={{ background: "#1a1a22" }}
                />
                <button
                  type="button"
                  onClick={sendChat}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium text-white"
                  style={{ background: "#FF5E00" }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop sidebar */}
        <aside className="hidden min-h-0 w-[280px] shrink-0 flex-col border-l border-[#1a1a22] md:flex">
          <div className="flex min-h-0 flex-1 flex-col border-b border-[#1a1a22]">
            <div className="shrink-0 border-b border-[#1a1a22] px-3 py-2 text-[12px] text-[#666]">
              Game log
            </div>
            <div
              ref={desktopLogRef}
              className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto px-2 py-2"
            >
              {systemOnly.map((entry) => (
                <p
                  key={entry.id}
                  className="py-0.5 text-[11px] leading-snug"
                  style={{ color: "#444" }}
                >
                  <span className="mr-1">●</span>
                  {entry.text}
                </p>
              ))}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-[#1a1a22] px-3 py-2 text-[12px] text-[#666]">
              Chat
            </div>
            <div
              ref={desktopChatRef}
              className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto px-2 py-2"
            >
              {chatOnly.map((entry) => (
                <p key={entry.id} className="py-0.5 text-[12px] leading-snug">
                  <span
                    className="text-[11px] font-bold"
                    style={{ color: "#FF5E00" }}
                  >
                    {entry.sender ?? "?"}
                    {": "}
                  </span>
                  <span style={{ color: "#999" }}>{entry.text}</span>
                </p>
              ))}
            </div>
            <div className="shrink-0 border-t border-[#1a1a22] px-3 py-1.5">
              {chatPresets && chatPresets.length > 0 ? (
                <div className="mb-1.5 flex flex-wrap gap-1">
                  {chatPresets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onSendChat(p)}
                      className="rounded-md border border-[#2a2a34] px-2 py-0.5 text-[10px] text-[#aaa] hover:bg-white/5"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendChat();
                  }}
                  placeholder="Type a message..."
                  className="min-w-0 flex-1 rounded-lg border border-[#2a2a34] px-2.5 py-1.5 text-[12px] text-[#e0e0e0] placeholder:text-[#666]"
                  style={{ background: "#1a1a22" }}
                />
                <button
                  type="button"
                  onClick={sendChat}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium text-white"
                  style={{ background: "#FF5E00" }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#1a1a22] px-3 py-2">
        <p className="text-[11px] text-[#444]">
          {footerLeft} · ID {shortId}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onReportIssue}
            className="rounded-md border border-[#2a2a34] px-3 py-1 text-[11px] text-[#666] hover:bg-white/5"
          >
            Report
          </button>
          <button
            type="button"
            onClick={onLeaveMatch}
            className="rounded-md border border-[#2a2a34] px-3 py-1 text-[11px] text-[#666] hover:bg-white/5"
          >
            Leave
          </button>
        </div>
      </footer>
    </div>
  );
}
