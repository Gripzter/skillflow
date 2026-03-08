"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  isPreset: boolean;
  timestamp: number;
  reported: boolean;
}

export interface GameChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string, isPreset: boolean) => void;
  onReportMessage: (messageId: string) => void;
  playerName: string;
  opponentName: string;
  playerId: string;
  unreadCount: number;
  isOpen: boolean;
  onToggle: () => void;
  /** Practice mode: use purple accent; otherwise teal */
  isPractice?: boolean;
}

const MAX_VISIBLE = 3;
const FLOATING_DURATION_MS = 4000;

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  const hour12 = ((h + 11) % 12) + 1;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

/** Simple client-side profanity filter: asterisk bad words */
function filterProfanity(text: string): string {
  const bad = /\b(shit|damn|hell|ass|fuck|fck|fuk|crap|wtf)\b/gi;
  return text.replace(bad, (match) => "*".repeat(match.length));
}

export default function GameChat({
  messages,
  onSendMessage,
  onReportMessage,
  playerName,
  opponentName,
  playerId,
  unreadCount: _unreadCount,
  isOpen: _isOpen,
  onToggle: _onToggle,
  isPractice = false,
}: GameChatProps) {
  const [input, setInput] = useState("");
  const [visibleMessages, setVisibleMessages] = useState<ChatMessage[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const expandAreaRef = useRef<HTMLDivElement>(null);
  const shownFloatingRef = useRef<Set<string>>(new Set());

  const accentClass = isPractice
    ? "text-purple-400 focus:border-purple-500 focus:ring-purple-500"
    : "text-teal focus:border-teal focus:ring-teal";
  const sendBtnClass = isPractice
    ? "text-purple-400 hover:bg-purple-500/20"
    : "text-teal hover:bg-teal/20";

  const sortedHistory = [...messages].filter((m) => m.senderId !== "system").sort((a, b) => a.timestamp - b.timestamp);

  useEffect(() => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current.clear();
    return () => {
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current.clear();
    };
  }, []);

  const addToVisible = useCallback(
    (msg: ChatMessage) => {
      const filtered = filterProfanity(msg.message);
      const display = { ...msg, message: filtered };
      setVisibleMessages((prev) => [display, ...prev].slice(0, MAX_VISIBLE));

      const id = msg.id;
      const t = setTimeout(() => {
        setExitingIds((prev) => new Set(prev).add(id));
        const t2 = setTimeout(() => {
          setVisibleMessages((prev) => prev.filter((m) => m.id !== id));
          setExitingIds((e) => {
            const next = new Set(e);
            next.delete(id);
            return next;
          });
          timeoutsRef.current.delete(id);
        }, 500);
        timeoutsRef.current.set(id, t2);
      }, FLOATING_DURATION_MS);
      timeoutsRef.current.set(id, t);
    },
    []
  );

  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.senderId === "system") return;
    if (shownFloatingRef.current.has(last.id)) return;
    shownFloatingRef.current.add(last.id);
    addToVisible(last);
  }, [messages, addToVisible]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > 200) return;
    const filtered = filterProfanity(trimmed);
    onSendMessage(filtered, false);
    setInput("");
  }, [input, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (!expanded || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [expanded, sortedHistory.length]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        expanded &&
        expandAreaRef.current &&
        !expandAreaRef.current.contains(e.target as Node)
      ) {
        setExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expanded]);

  return (
    <div
      ref={expandAreaRef}
      className="w-full"
      style={{
        background: "rgba(255,255,255,0.03)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "6px 12px",
      }}
    >
      {/* Compact bar: input + send (+ close when expanded) */}
      <div className="flex h-11 items-center gap-2">
        <input
          type="text"
          maxLength={200}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className={`flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-[#E5E7EB] placeholder:text-[#4B5563] focus:outline-none focus:ring-1 ${accentClass}`}
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "8px 12px",
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim()}
          className={`flex h-9 items-center justify-center rounded-lg px-3 text-[13px] font-semibold transition-colors disabled:opacity-40 ${sendBtnClass}`}
          style={{ background: "transparent" }}
          aria-label="Send message"
        >
          Send
        </button>
        {expanded && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-body-gray hover:bg-white/10 hover:text-white"
            aria-label="Close chat history"
          >
            ✕
          </button>
        )}
      </div>

      {/* Floating messages (below bar) — pointer-events: none */}
      <div
        className="space-y-1 pt-1"
        style={{ pointerEvents: "none" }}
        role="log"
        aria-live="polite"
      >
        {visibleMessages.map((m) => {
          const isMine = m.senderId === playerId;
          const isExiting = exitingIds.has(m.id);
          return (
            <div
              key={m.id}
              className={`text-[13px] ${isExiting ? "animate-chat-fade-out" : "animate-chat-fade-in"}`}
              style={{
                background: "rgba(10, 14, 23, 0.85)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6,
                padding: "6px 12px",
                marginTop: 4,
              }}
            >
              <span className={isMine ? (isPractice ? "text-purple-400" : "text-teal") : "text-white"}>
                {isMine ? "You" : m.senderName ?? opponentName}: &quot;{m.message}&quot;
              </span>
            </div>
          );
        })}
      </div>

      {/* Expandable history */}
      {expanded ? (
        <div
          ref={scrollRef}
          className="mt-2 max-h-[200px] overflow-y-auto rounded-b-xl border border-white/10 py-2"
          style={{
            background: "rgba(10, 14, 23, 0.92)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "0 0 12px 12px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {sortedHistory.length === 0 ? (
            <p className="px-3 py-4 text-center text-[13px] text-body-gray">
              No messages yet.
            </p>
          ) : (
            <div className="space-y-1 px-3">
              {sortedHistory.map((m) => {
                const isMine = m.senderId === playerId;
                const isSystem = m.senderId === "system";
                if (isSystem) {
                  return (
                    <div
                      key={m.id}
                      className="text-center text-[12px] text-body-gray"
                    >
                      {m.message}
                    </div>
                  );
                }
                const name = isMine ? "You" : m.senderName ?? opponentName;
                return (
                  <div
                    key={m.id}
                    className={`flex items-baseline justify-between gap-2 text-[13px] ${isMine ? "flex-row-reverse" : ""}`}
                  >
                    <span className="shrink-0 text-[11px] text-body-gray">
                      {formatTime(m.timestamp)}
                    </span>
                    <div className={`min-w-0 flex-1 ${isMine ? "text-right" : "text-left"}`}>
                      <span className={isMine ? (isPractice ? "text-purple-400" : "text-teal") : "text-white"}>
                        {name}: {filterProfanity(m.message)}
                      </span>
                      {!isMine && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onReportMessage(m.id);
                          }}
                          className="ml-1.5 text-[10px] text-body-gray hover:text-red-400"
                          style={{ pointerEvents: "auto" }}
                          aria-label="Report message"
                        >
                          Report
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Clickable area to expand */
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExpanded(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded(true);
            }
          }}
          className="mt-1 min-h-[24px] cursor-pointer rounded px-1 py-0.5 text-[11px] text-body-gray hover:bg-white/5 hover:text-white"
          aria-label="Open chat history"
        >
          {visibleMessages.length > 0
            ? "Click to see full chat history"
            : sortedHistory.length > 0
              ? "Click to see chat history"
              : "\u00a0"}
        </div>
      )}
    </div>
  );
}
